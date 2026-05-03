import {
  confirmPlacement,
  evaluateBattleOutcome,
  quickPlaceUnits,
  type BattleState,
} from "./battle";
import { CONSUMABLE_DATABASE } from "./crafting";
import { getAllStarterEquipment } from "./equipment";
import {
  RESOURCE_LABELS,
  type ResourceKey,
  createEmptyResourceWallet,
} from "./resources";
import { replaceBattleStateById, grantSessionResources } from "./session";
import { setActiveTheaterResourceDecayEnabled } from "./theaterSystem";
import type { GameState } from "./types";

export const QUAC_DEBUG_INPUT_HINT = 'Use /dev for debug commands. Example: "/give 5 healing kit".';
export const QUAC_DEBUG_HELP_TEXT =
  "Dev commands: /decay on|off, /auto win battles on|off, /give <amount> <name>, /heal squad.";

export type QuacDebugCommandPing = {
  type: "success" | "info" | "error";
  title: string;
  message: string;
  detail?: string;
  channel: string;
  replaceChannel?: boolean;
};

export type QuacDebugCommandResult =
  | {
      handled: false;
      state: GameState;
    }
  | {
      handled: true;
      success: boolean;
      state: GameState;
      statusText: string;
      ping?: QuacDebugCommandPing;
      shouldRenderBattle?: boolean;
    };

type GiveTarget =
  | {
      kind: "wad";
      id: "wad";
      label: string;
      aliases: string[];
    }
  | {
      kind: "resource";
      id: ResourceKey;
      label: string;
      aliases: string[];
    }
  | {
      kind: "consumable";
      id: string;
      label: string;
      aliases: string[];
    }
  | {
      kind: "equipment";
      id: string;
      label: string;
      aliases: string[];
    };

const AUTO_WIN_ON_COMMANDS = new Set([
  "/auto win battles on",
  "/auto win on",
  "/autowin on",
]);

const AUTO_WIN_OFF_COMMANDS = new Set([
  "/auto win battles off",
  "/auto win off",
  "/autowin off",
]);

function normalizeCommand(rawCommand: string): string {
  return rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeLookupToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildResourceAliases(resourceKey: ResourceKey): string[] {
  switch (resourceKey) {
    case "metalScrap":
      return ["metal scrap", "metal", "scrap", "metal scraps"];
    case "wood":
      return ["wood", "timber"];
    case "chaosShards":
      return ["chaos shards", "chaos shard", "shards", "shard"];
    case "steamComponents":
      return ["steam components", "steam component", "steam", "components"];
    case "alloy":
      return ["alloy"];
    case "drawcord":
      return ["drawcord", "draw cord"];
    case "fittings":
      return ["fittings", "fitting"];
    case "resin":
      return ["resin"];
    case "chargeCells":
      return ["charge cells", "charge cell", "chargecell", "chargecells"];
    default:
      return [RESOURCE_LABELS[resourceKey]];
  }
}

function dedupeTargets(targets: GiveTarget[]): GiveTarget[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.kind}:${target.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function findGiveMatches(query: string): GiveTarget[] {
  const normalizedQuery = normalizeLookupToken(query);
  if (!normalizedQuery) {
    return [];
  }

  const equipmentById = getAllStarterEquipment();
  const targets: GiveTarget[] = [
    {
      kind: "wad",
      id: "wad",
      label: "WAD",
      aliases: ["wad", "wads", "money", "cash"],
    },
    ...Object.keys(RESOURCE_LABELS).map((resourceKey) => ({
      kind: "resource" as const,
      id: resourceKey as ResourceKey,
      label: RESOURCE_LABELS[resourceKey as ResourceKey],
      aliases: [resourceKey, ...buildResourceAliases(resourceKey as ResourceKey)].map(normalizeLookupToken),
    })),
    ...Object.values(CONSUMABLE_DATABASE).map((consumable) => ({
      kind: "consumable" as const,
      id: consumable.id,
      label: consumable.name,
      aliases: [consumable.id, consumable.name].map(normalizeLookupToken),
    })),
    ...Object.values(equipmentById).map((equipment) => ({
      kind: "equipment" as const,
      id: equipment.id,
      label: equipment.name,
      aliases: [equipment.id, equipment.name].map(normalizeLookupToken),
    })),
  ];

  const exact = dedupeTargets(
    targets.filter((target) => target.aliases.some((alias) => alias === normalizedQuery)),
  );
  if (exact.length > 0) {
    return exact;
  }

  const prefix = dedupeTargets(
    targets.filter((target) => target.aliases.some((alias) => alias.startsWith(normalizedQuery))),
  );
  if (prefix.length > 0) {
    return prefix;
  }

  return dedupeTargets(
    targets.filter((target) => target.aliases.some((alias) => alias.includes(normalizedQuery))),
  );
}

function withUiLayout(
  state: GameState,
  patch: Partial<NonNullable<GameState["uiLayout"]>>,
): GameState {
  return {
    ...state,
    uiLayout: {
      ...(state.uiLayout ?? {}),
      ...patch,
    },
  };
}

export function isQuacDebugAutoWinBattlesEnabled(state: GameState): boolean {
  return Boolean(state.uiLayout?.quacDebugAutoWinBattles);
}

export function forceBattleVictory(battle: BattleState): BattleState {
  let nextBattle = battle;

  if (nextBattle.phase === "placement") {
    nextBattle = quickPlaceUnits(nextBattle);
    nextBattle = confirmPlacement(nextBattle);
  }

  if (nextBattle.phase === "victory" || nextBattle.phase === "defeat") {
    return nextBattle;
  }

  const nextUnits = Object.fromEntries(
    Object.entries(nextBattle.units).map(([unitId, unit]) => [
      unitId,
      unit.isEnemy
        ? {
            ...unit,
            hp: 0,
            pos: null,
          }
        : unit,
    ]),
  );

  const resolvedBattle = evaluateBattleOutcome({
    ...nextBattle,
    units: nextUnits,
    activeUnitId: null,
    log: [
      ...nextBattle.log,
      "SLK//DEBUG :: Q.U.A.C. forced hostile resistance to collapse.",
    ],
  });

  return resolvedBattle.phase === "victory"
    ? resolvedBattle
    : {
        ...resolvedBattle,
        phase: "victory",
        activeUnitId: null,
      };
}

function applyBattleVictoryToState(state: GameState): { state: GameState; success: boolean } {
  const currentBattle = state.currentBattle;
  if (!currentBattle) {
    return { state, success: false };
  }

  const resolvedBattle = forceBattleVictory(currentBattle);
  return {
    state: replaceBattleStateById(state, resolvedBattle.id, resolvedBattle),
    success: true,
  };
}

function toggleBattleAutoWin(state: GameState, enabled: boolean): QuacDebugCommandResult {
  let nextState = withUiLayout(state, {
    quacDebugAutoWinBattles: enabled,
  });

  let resolvedActiveBattle = false;
  if (enabled && nextState.currentBattle && nextState.currentBattle.phase !== "victory" && nextState.currentBattle.phase !== "defeat") {
    const victoryOutcome = applyBattleVictoryToState(nextState);
    nextState = victoryOutcome.state;
    resolvedActiveBattle = victoryOutcome.success;
  }

  const suffix = resolvedActiveBattle
    ? "Active battle resolved immediately."
    : enabled
      ? "Future battles will resolve immediately."
      : "Battles are back to normal resolution.";

  return {
    handled: true,
    success: true,
    state: nextState,
    statusText: `AUTO WIN :: ${enabled ? "Enabled." : "Disabled."} ${suffix}`,
    shouldRenderBattle: resolvedActiveBattle,
    ping: {
      type: enabled ? "success" : "info",
      title: enabled ? "AUTO WIN ENABLED" : "AUTO WIN DISABLED",
      message: suffix,
      channel: "quac-debug-auto-win",
      replaceChannel: true,
    },
  };
}

function grantGiveTarget(
  state: GameState,
  target: GiveTarget,
  amount: number,
): QuacDebugCommandResult {
  if (target.kind === "wad") {
    const nextState = grantSessionResources(state, { wad: amount });
    return {
      handled: true,
      success: true,
      state: nextState,
      statusText: `GIVE :: Added ${amount} WAD.`,
      ping: {
        type: "success",
        title: "DEBUG // WAD",
        message: `${amount} WAD added.`,
        channel: "quac-debug-give",
        replaceChannel: true,
      },
    };
  }

  if (target.kind === "resource") {
    const resourceReward = createEmptyResourceWallet({ [target.id]: amount } as Partial<Record<ResourceKey, number>>);
    const nextState = grantSessionResources(state, { resources: resourceReward });
    return {
      handled: true,
      success: true,
      state: nextState,
      statusText: `GIVE :: Added ${amount} ${target.label}.`,
      ping: {
        type: "success",
        title: "DEBUG // RESOURCES",
        message: `${amount} ${target.label} added.`,
        channel: "quac-debug-give",
        replaceChannel: true,
      },
    };
  }

  if (target.kind === "consumable") {
    const nextConsumables = { ...(state.consumables ?? {}) };
    nextConsumables[target.id] = Math.max(0, Number(nextConsumables[target.id] ?? 0)) + amount;
    return {
      handled: true,
      success: true,
      state: {
        ...state,
        consumables: nextConsumables,
      },
      statusText: `GIVE :: Added ${amount} ${target.label}${amount === 1 ? "" : "s"}.`,
      ping: {
        type: "success",
        title: "DEBUG // CONSUMABLES",
        message: `${amount} ${target.label}${amount === 1 ? "" : "s"} added.`,
        channel: "quac-debug-give",
        replaceChannel: true,
      },
    };
  }

  const authoredEquipment = getAllStarterEquipment()[target.id];
  if (!authoredEquipment) {
    return {
      handled: true,
      success: false,
      state,
      statusText: `GIVE :: "${target.label}" is not available in the authored equipment registry.`,
    };
  }

  const alreadyOwned = (state.equipmentPool ?? []).includes(target.id);
  const nextEquipmentPool = alreadyOwned
    ? [...(state.equipmentPool ?? [])]
    : [...(state.equipmentPool ?? []), target.id];

  return {
    handled: true,
    success: true,
    state: {
      ...state,
      equipmentById: {
        ...getAllStarterEquipment(),
        ...(state.equipmentById ?? {}),
        [target.id]: authoredEquipment,
      },
      equipmentPool: nextEquipmentPool,
    },
    statusText: alreadyOwned
      ? `GIVE :: ${target.label} is already owned. Equipment stays unique.`
      : `GIVE :: Added ${target.label} to equipment inventory.`,
    ping: {
      type: "success",
      title: "DEBUG // EQUIPMENT",
      message: alreadyOwned
        ? `${target.label} was already owned.`
        : `${target.label} added to equipment inventory.`,
      detail: amount > 1
        ? "Equipment is unique in this inventory model, so extra copies are ignored."
        : undefined,
      channel: "quac-debug-give",
      replaceChannel: true,
    },
  };
}

function handleGiveCommand(state: GameState, rawCommand: string): QuacDebugCommandResult {
  const match = rawCommand.trim().match(/^\/give(?:\s+(\d+))?\s+(.+)$/i);
  if (!match) {
    return {
      handled: true,
      success: false,
      state,
      statusText: "Usage: /give <amount> <equipment | consumable | resource | wad>",
    };
  }

  const amount = Math.max(0, Math.floor(Number(match[1] ?? "1")));
  const targetQuery = match[2]?.trim() ?? "";
  if (amount <= 0 || !targetQuery) {
    return {
      handled: true,
      success: false,
      state,
      statusText: "Usage: /give <amount> <equipment | consumable | resource | wad>",
    };
  }

  const matches = findGiveMatches(targetQuery);
  if (matches.length <= 0) {
    return {
      handled: true,
      success: false,
      state,
      statusText: `GIVE :: No equipment, consumable, resource, or WAD target matched "${targetQuery}".`,
    };
  }

  if (matches.length > 1) {
    const preview = matches.slice(0, 4).map((entry) => entry.label).join(", ");
    return {
      handled: true,
      success: false,
      state,
      statusText: `GIVE :: "${targetQuery}" is ambiguous. Try one of: ${preview}.`,
    };
  }

  return grantGiveTarget(state, matches[0]!, amount);
}

function healSquad(state: GameState): QuacDebugCommandResult {
  const nextUnitsById = { ...state.unitsById };
  let restoredRosterUnits = 0;

  Object.values(nextUnitsById).forEach((unit) => {
    if (unit.hp >= unit.maxHp) {
      return;
    }
    restoredRosterUnits += 1;
    nextUnitsById[unit.id] = {
      ...unit,
      hp: unit.maxHp,
    };
  });

  let nextState: GameState = restoredRosterUnits > 0
    ? {
        ...state,
        unitsById: nextUnitsById,
      }
    : state;

  let restoredBattleUnits = 0;
  if (nextState.currentBattle) {
    const nextBattleUnits = Object.fromEntries(
      Object.entries(nextState.currentBattle.units).map(([unitId, unit]) => {
        if (unit.isEnemy || unit.hp >= unit.maxHp) {
          return [unitId, unit];
        }
        restoredBattleUnits += 1;
        return [
          unitId,
          {
            ...unit,
            hp: unit.maxHp,
          },
        ];
      }),
    );
    nextState = replaceBattleStateById(nextState, nextState.currentBattle.id, {
      ...nextState.currentBattle,
      units: nextBattleUnits,
    });
  }

  return {
    handled: true,
    success: true,
    state: nextState,
    statusText: `HEAL :: Restored ${restoredRosterUnits} roster unit(s)${restoredBattleUnits > 0 ? ` and ${restoredBattleUnits} battle unit(s)` : ""}.`,
    shouldRenderBattle: restoredBattleUnits > 0,
    ping: {
      type: "success",
      title: "DEBUG // HEAL",
      message: restoredBattleUnits > 0
        ? "Squad and active battle party restored to full HP."
        : "Roster restored to full HP.",
      channel: "quac-debug-heal",
      replaceChannel: true,
    },
  };
}

export function runQuacDebugCommand(
  state: GameState,
  rawCommand: string,
): QuacDebugCommandResult {
  const normalized = normalizeCommand(rawCommand);
  if (!normalized.startsWith("/")) {
    return {
      handled: false,
      state,
    };
  }

  if (normalized === "/dev" || normalized === "/help" || normalized === "/debug") {
    return {
      handled: true,
      success: true,
      state,
      statusText: QUAC_DEBUG_HELP_TEXT,
    };
  }

  if (normalized === "/decay on" || normalized === "/decay off") {
    const enabled = normalized.endsWith("on");
    const outcome = setActiveTheaterResourceDecayEnabled(state, enabled);
    return {
      handled: true,
      success: outcome.success,
      state: outcome.state,
      statusText: `DECAY :: ${outcome.message}`,
      ping: outcome.success
        ? {
            type: enabled ? "success" : "info",
            title: enabled ? "THEATER DECAY ONLINE" : "THEATER DECAY OFFLINE",
            message: enabled
              ? "Room-to-room falloff has been restored for theater logistics."
              : "Crates, wattage, and bandwidth now travel without room-to-room falloff.",
            channel: "quac-debug-decay",
            replaceChannel: true,
          }
        : undefined,
    };
  }

  if (normalized === "/decay") {
    return {
      handled: true,
      success: false,
      state,
      statusText: "Usage: /decay off or /decay on",
    };
  }

  if (AUTO_WIN_ON_COMMANDS.has(normalized)) {
    return toggleBattleAutoWin(state, true);
  }

  if (AUTO_WIN_OFF_COMMANDS.has(normalized)) {
    return toggleBattleAutoWin(state, false);
  }

  if (normalized === "/auto win battles" || normalized === "/auto win" || normalized === "/autowin") {
    return {
      handled: true,
      success: false,
      state,
      statusText: "Usage: /auto win battles on or /auto win battles off",
    };
  }

  if (normalized === "/win battle" || normalized === "/battle win") {
    const outcome = applyBattleVictoryToState(state);
    return {
      handled: true,
      success: outcome.success,
      state: outcome.state,
      statusText: outcome.success
        ? "BATTLE :: Forced active battle victory."
        : "BATTLE :: No active battle to win.",
      shouldRenderBattle: outcome.success,
      ping: outcome.success
        ? {
            type: "success",
            title: "DEBUG // BATTLE WON",
            message: "Active battle forced to victory.",
            channel: "quac-debug-battle",
            replaceChannel: true,
          }
        : undefined,
    };
  }

  if (normalized === "/heal" || normalized === "/heal squad" || normalized === "/heal all") {
    return healSquad(state);
  }

  if (normalized.startsWith("/give")) {
    return handleGiveCommand(state, rawCommand);
  }

  return {
    handled: false,
    state,
  };
}

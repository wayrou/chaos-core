import { createBattleUnitState, type BattleState, type Tile } from "./battle";
import { generateCover } from "./coverGenerator";
import { getAllModules, getAllStarterEquipment, type UnitClass } from "./equipment";
import {
  SESSION_PLAYER_SLOTS,
  type AuthorityRole,
  type GameState,
  type SessionPlayerSlot,
  type SquadBattleObjectiveState,
  type SquadBattleSide,
  type Unit,
} from "./types";
import type { SquadDraftPick, SquadMatchState } from "./squadOnline";

export const SQUAD_BATTLE_PROTOCOL_VERSION = 1;
const SQUAD_OBJECTIVE_TARGET_SCORE = 3;

const UNIT_PICK_LABELS = [
  "Vanguard Core",
  "Ranger Line",
  "Shock Squire",
  "Hex Analyst",
  "Breacher",
  "Harrier",
  "Ward Marshal",
  "Signal Raider",
] as const;

const EQUIPMENT_PICK_LABELS = [
  "Arc Spear",
  "Heavy Carbine",
  "Scout Harness",
  "Mirror Plate",
  "Recoil Gloves",
  "Flux Buckler",
  "Hazard Lens",
  "Anchor Boots",
] as const;

const TACTICAL_PICK_LABELS = [
  "Priority Intercept",
  "Emergency Med Drop",
  "Ambush Window",
  "Fog Screen",
  "Rapid Advance",
  "Counter-Breach",
  "False Retreat",
  "Kill Box",
] as const;

type SquadArchetype = {
  label: string;
  unitClass: UnitClass;
  weaponId: string;
  hp: number;
  atk: number;
  def: number;
  agi: number;
  acc: number;
};

type TacticalModifier = {
  summary: string;
  buffs?: Array<{
    type: "atk_up" | "def_up" | "agi_up";
    amount: number;
    duration: number;
  }>;
};

type SquadBattlePayload = {
  protocolVersion: number;
  matchId: string;
  battle: BattleState;
};

export type SquadBattleCommand =
  | { type: "select_placement_unit"; unitId: string }
  | { type: "place_unit"; unitId: string; x: number; y: number }
  | { type: "remove_placed_unit"; unitId: string }
  | { type: "quick_place" }
  | { type: "move_unit"; unitId: string; x: number; y: number }
  | { type: "undo_move"; unitId: string }
  | { type: "play_card"; unitId: string; cardIndex: number; targetUnitId: string }
  | { type: "end_turn"; unitId: string; facing?: "north" | "south" | "east" | "west" };

type SquadBattleCommandPayload = {
  protocolVersion: number;
  matchId: string;
  battleId: string;
  command: SquadBattleCommand;
};

const SQUAD_ARCHETYPES: Record<string, SquadArchetype> = {
  "Vanguard Core": {
    label: "Vanguard Core",
    unitClass: "sentry",
    weaponId: "weapon_iron_longsword",
    hp: 15,
    atk: 8,
    def: 5,
    agi: 3,
    acc: 82,
  },
  "Ranger Line": {
    label: "Ranger Line",
    unitClass: "ranger",
    weaponId: "weapon_elm_recurve_bow",
    hp: 12,
    atk: 7,
    def: 3,
    agi: 5,
    acc: 85,
  },
  "Shock Squire": {
    label: "Shock Squire",
    unitClass: "squire",
    weaponId: "weapon_scissor_sword",
    hp: 14,
    atk: 9,
    def: 4,
    agi: 3,
    acc: 80,
  },
  "Hex Analyst": {
    label: "Hex Analyst",
    unitClass: "wizard",
    weaponId: "weapon_silver_channeling_rod",
    hp: 11,
    atk: 6,
    def: 3,
    agi: 4,
    acc: 88,
  },
  Breacher: {
    label: "Breacher",
    unitClass: "paladin",
    weaponId: "weapon_blazefang_saber",
    hp: 16,
    atk: 9,
    def: 5,
    agi: 2,
    acc: 80,
  },
  Harrier: {
    label: "Harrier",
    unitClass: "scout",
    weaponId: "weapon_willow_shortbow",
    hp: 11,
    atk: 6,
    def: 3,
    agi: 6,
    acc: 84,
  },
  "Ward Marshal": {
    label: "Ward Marshal",
    unitClass: "cleric",
    weaponId: "weapon_oak_battlestaff",
    hp: 14,
    atk: 6,
    def: 5,
    agi: 3,
    acc: 83,
  },
  "Signal Raider": {
    label: "Signal Raider",
    unitClass: "academic",
    weaponId: "weapon_emberclaw_repeater",
    hp: 12,
    atk: 8,
    def: 3,
    agi: 4,
    acc: 86,
  },
};

const EQUIPMENT_WEAPON_OVERRIDES: Record<string, string> = {
  "Arc Spear": "weapon_iron_longsword",
  "Heavy Carbine": "weapon_emberclaw_repeater",
  "Scout Harness": "weapon_willow_shortbow",
  "Mirror Plate": "weapon_blazefang_saber",
  "Recoil Gloves": "weapon_emberclaw_repeater",
  "Flux Buckler": "weapon_oak_battlestaff",
  "Hazard Lens": "weapon_silver_channeling_rod",
  "Anchor Boots": "weapon_scissor_sword",
};

const TACTICAL_MODIFIERS: Record<string, TacticalModifier> = {
  "Priority Intercept": {
    summary: "Opening initiative calibrated for rapid response.",
    buffs: [{ type: "agi_up", amount: 1, duration: 2 }],
  },
  "Emergency Med Drop": {
    summary: "Emergency treatment package attached to the roster.",
    buffs: [{ type: "def_up", amount: 1, duration: 2 }],
  },
  "Ambush Window": {
    summary: "Ambush telemetry uploaded to the opener.",
    buffs: [{ type: "atk_up", amount: 1, duration: 1 }],
  },
  "Fog Screen": {
    summary: "Smoke cover seeded across the approach lane.",
    buffs: [{ type: "def_up", amount: 1, duration: 1 }],
  },
  "Rapid Advance": {
    summary: "Movement planners staged a rapid advance route.",
    buffs: [{ type: "agi_up", amount: 1, duration: 1 }],
  },
  "Counter-Breach": {
    summary: "Counter-breach doctrine distributed to the squad.",
    buffs: [{ type: "atk_up", amount: 1, duration: 1 }],
  },
  "False Retreat": {
    summary: "Fallback vector set to lure the opposing line forward.",
    buffs: [{ type: "agi_up", amount: 1, duration: 1 }],
  },
  "Kill Box": {
    summary: "Kill-box firing data aligned with the opening salvo.",
    buffs: [{ type: "atk_up", amount: 2, duration: 1 }],
  },
};

function createRelayObjectiveTiles(width: number, height: number): Array<{ x: number; y: number }> {
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  if (Math.abs(width - height) <= 1) {
    const candidates = [
      { x: centerX, y: centerY },
      { x: Math.max(1, centerX - 1), y: centerY },
      { x: centerX, y: Math.max(1, centerY - 1) },
      { x: Math.max(1, centerX - 1), y: Math.max(1, centerY - 1) },
    ];
    return candidates.filter((tile, index, all) =>
      tile.x > 0
      && tile.x < width - 1
      && tile.y > 0
      && tile.y < height - 1
      && all.findIndex((candidate) => candidate.x === tile.x && candidate.y === tile.y) === index,
    );
  }

  if (width > height) {
    const relayRow = centerY;
    const startX = Math.max(1, centerX - 1);
    const endX = Math.min(width - 2, centerX + 1);
    return Array.from({ length: endX - startX + 1 }, (_, index) => ({
      x: startX + index,
      y: relayRow,
    }));
  }

  const relayColumn = centerX;
  const startY = Math.max(1, centerY - 1);
  const endY = Math.min(height - 2, centerY + 1);
  return Array.from({ length: endY - startY + 1 }, (_, index) => ({
    x: relayColumn,
    y: startY + index,
  }));
}

function createBreakthroughBreachTiles(width: number, height: number): Record<SquadBattleSide, Array<{ x: number; y: number }>> {
  const breachCount = width >= 9 ? 3 : width >= 7 ? 2 : 1;
  const centerY = Math.floor(height / 2);
  const offsets = breachCount === 1 ? [0] : breachCount === 2 ? [-1, 1] : [-1, 0, 1];
  const normalizedRows = offsets
    .map((offset) => Math.min(height - 2, Math.max(1, centerY + offset)))
    .filter((row, index, rows) => rows.indexOf(row) === index);
  return {
    friendly: normalizedRows.map((row) => ({ x: width - 2, y: row })),
    enemy: normalizedRows.map((row) => ({ x: 1, y: row })),
  };
}

function createSquadObjectiveState(match: SquadMatchState): SquadBattleObjectiveState | null {
  const { gridWidth, gridHeight, winCondition } = match.rules;
  if (winCondition === "elimination") {
    return null;
  }

  if (winCondition === "breakthrough") {
    const breachTiles = createBreakthroughBreachTiles(gridWidth, gridHeight);
    return {
      kind: "breakthrough",
      label: "Breakthrough",
      description: "Cross into the enemy breach lane and extract the scoring unit. First side to two breaches wins.",
      controlTiles: [],
      breachTiles,
      targetScore: 2,
      score: {
        friendly: 0,
        enemy: 0,
      },
      controllingSide: null,
      winnerSide: null,
      extractedUnitIds: [],
    };
  }

  return {
    kind: "control_relay",
    label: "Control Relay",
    description: "Hold the central relay uncontested at the end of each round. First side to three control marks wins.",
    controlTiles: createRelayObjectiveTiles(gridWidth, gridHeight),
    targetScore: SQUAD_OBJECTIVE_TARGET_SCORE,
    score: {
      friendly: 0,
      enemy: 0,
    },
    controllingSide: null,
    winnerSide: null,
  };
}

function createEmptySlotRecord<T>(factory: () => T): Record<SessionPlayerSlot, T> {
  return SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
    acc[slot] = factory();
    return acc;
  }, {} as Record<SessionPlayerSlot, T>);
}

function getConnectedSlots(match: SquadMatchState): SessionPlayerSlot[] {
  return SESSION_PLAYER_SLOTS.filter((slot) => Boolean(match.members[slot]?.connected));
}

function getSlotSide(match: SquadMatchState, slot: SessionPlayerSlot): SquadBattleSide | null {
  if (!match.members[slot]?.connected) {
    return null;
  }
  return slot === match.hostSlot ? "friendly" : "enemy";
}

function resolveDraftPickLabel(pick: SquadDraftPick): string {
  const [, indexToken] = pick.optionId.split("_");
  const optionIndex = Number.parseInt(indexToken ?? "", 10);
  if (pick.category === "unit") {
    return UNIT_PICK_LABELS[optionIndex] ?? pick.optionId;
  }
  if (pick.category === "equipment") {
    return EQUIPMENT_PICK_LABELS[optionIndex] ?? pick.optionId;
  }
  return TACTICAL_PICK_LABELS[optionIndex] ?? pick.optionId;
}

function getPicksForSlot(match: SquadMatchState, slot: SessionPlayerSlot) {
  return (match.draft?.picks ?? [])
    .filter((pick) => pick.slot === slot)
    .map((pick) => ({
      pick,
      label: resolveDraftPickLabel(pick),
    }));
}

function getFallbackArchetypes(slot: SessionPlayerSlot): SquadArchetype[] {
  const rotation = [
    SQUAD_ARCHETYPES["Vanguard Core"],
    SQUAD_ARCHETYPES["Ranger Line"],
    SQUAD_ARCHETYPES["Hex Analyst"],
    SQUAD_ARCHETYPES["Breacher"],
    SQUAD_ARCHETYPES["Harrier"],
    SQUAD_ARCHETYPES["Ward Marshal"],
  ];
  const offset = Math.max(0, SESSION_PLAYER_SLOTS.indexOf(slot));
  return rotation.map((_, index) => rotation[(index + offset) % rotation.length]);
}

function getWeaponOverride(label: string | null | undefined): string | null {
  if (!label) {
    return null;
  }
  return EQUIPMENT_WEAPON_OVERRIDES[label] ?? null;
}

function getTacticalModifier(label: string | null | undefined): TacticalModifier | null {
  if (!label) {
    return null;
  }
  return TACTICAL_MODIFIERS[label] ?? null;
}

function createDraftedBaseUnit(
  slot: SessionPlayerSlot,
  callsign: string,
  side: SquadBattleSide,
  unitIndex: number,
  archetype: SquadArchetype,
  equipmentLabel: string | null,
  tacticalLabel: string | null,
): Unit {
  const weaponId = getWeaponOverride(equipmentLabel) ?? archetype.weaponId;
  const tacticalModifier = getTacticalModifier(tacticalLabel);

  return {
    id: `squad_${slot.toLowerCase()}_${unitIndex + 1}`,
    name: `${callsign.toUpperCase()} ${archetype.label}`,
    isEnemy: side === "enemy",
    controller: slot,
    hp: archetype.hp,
    maxHp: archetype.hp,
    atk: archetype.atk,
    def: archetype.def,
    agi: archetype.agi,
    acc: archetype.acc,
    pos: null,
    hand: [],
    drawPile: [],
    discardPile: [],
    strain: 0,
    unitClass: archetype.unitClass,
    loadout: {
      primaryWeapon: weaponId,
      secondaryWeapon: null,
      helmet: null,
      chestpiece: null,
      accessory1: null,
      accessory2: null,
    },
    buffs: tacticalModifier?.buffs?.map((buff, index) => ({
      id: `squad_${slot.toLowerCase()}_${unitIndex + 1}_buff_${index}`,
      type: buff.type,
      amount: buff.amount,
      duration: buff.duration,
    })) ?? [],
  } as Unit;
}

function getSideCallsign(match: SquadMatchState, slot: SessionPlayerSlot): string {
  return match.members[slot]?.callsign?.trim() || slot;
}

function createDraftedUnitsForSlot(
  match: SquadMatchState,
  slot: SessionPlayerSlot,
  side: SquadBattleSide,
): Unit[] {
  const slotPicks = getPicksForSlot(match, slot);
  const unitLabels = slotPicks.filter(({ pick }) => pick.category === "unit").map(({ label }) => label);
  const equipmentLabels = slotPicks.filter(({ pick }) => pick.category === "equipment").map(({ label }) => label);
  const tacticalLabels = slotPicks.filter(({ pick }) => pick.category === "tactical").map(({ label }) => label);
  const fallbackArchetypes = getFallbackArchetypes(slot);
  const callsign = getSideCallsign(match, slot);

  return Array.from({ length: match.rules.targetSquadSize }, (_, unitIndex) => {
    const unitLabel = unitLabels[unitIndex] ?? fallbackArchetypes[unitIndex % fallbackArchetypes.length].label;
    const archetype = SQUAD_ARCHETYPES[unitLabel] ?? fallbackArchetypes[unitIndex % fallbackArchetypes.length];
    const equipmentLabel = equipmentLabels.length > 0
      ? equipmentLabels[unitIndex % equipmentLabels.length]
      : null;
    const tacticalLabel = tacticalLabels.length > 0
      ? tacticalLabels[unitIndex % tacticalLabels.length]
      : null;
    return createDraftedBaseUnit(slot, callsign, side, unitIndex, archetype, equipmentLabel, tacticalLabel);
  });
}

function createArenaTiles(match: SquadMatchState): Tile[] {
  const arenaWidth = match.rules.gridWidth;
  const arenaHeight = match.rules.gridHeight;
  const baseTiles: Tile[] = [];
  for (let y = 0; y < arenaHeight; y++) {
    for (let x = 0; x < arenaWidth; x++) {
      baseTiles.push({
        pos: { x, y },
        terrain: "floor",
        elevation: 0,
      });
    }
  }

  const reservedCells = [
    ...Array.from({ length: arenaHeight }, (_, y) => ({ x: 0, y })),
    ...Array.from({ length: arenaHeight }, (_, y) => ({ x: arenaWidth - 1, y })),
    ...(match.rules.winCondition === "control_relay" ? createRelayObjectiveTiles(arenaWidth, arenaHeight) : []),
    ...(match.rules.winCondition === "breakthrough"
      ? [
          ...createBreakthroughBreachTiles(arenaWidth, arenaHeight).friendly,
          ...createBreakthroughBreachTiles(arenaWidth, arenaHeight).enemy,
        ]
      : []),
  ];

  return generateCover(
    baseTiles,
    arenaWidth,
    arenaHeight,
    `squad_cover_${match.matchId}_${match.rules.mapSeed}`,
    reservedCells,
  );
}

export function createSquadBattleState(match: SquadMatchState, gameState: GameState): BattleState {
  const equipmentById = gameState.equipmentById ?? getAllStarterEquipment();
  const modulesById = gameState.modulesById ?? getAllModules();
  const connectedSlots = getConnectedSlots(match);
  const units: BattleState["units"] = {};
  const friendlyUnitIds: string[] = [];
  const slotSides = createEmptySlotRecord<"friendly" | "enemy" | null>(() => null);
  const slotCallsigns = createEmptySlotRecord<string | null>(() => null);

  connectedSlots.forEach((slot) => {
    const side = getSlotSide(match, slot);
    if (!side) {
      return;
    }

    slotSides[slot] = side;
    slotCallsigns[slot] = getSideCallsign(match, slot);

    const draftedUnits = createDraftedUnitsForSlot(match, slot, side);
    draftedUnits.forEach((baseUnit) => {
      const battleUnit = createBattleUnitState(
        baseUnit,
        {
          isEnemy: side === "enemy",
          pos: null,
          gearSlots: gameState.gearSlots ?? {},
          stable: gameState.stable,
        },
        equipmentById,
        modulesById,
      );

      units[battleUnit.id] = battleUnit;
      if (side === "friendly") {
        friendlyUnitIds.push(battleUnit.id);
      }
    });
  });

  const tacticalNotes = connectedSlots.flatMap((slot) =>
    getPicksForSlot(match, slot)
      .filter(({ pick }) => pick.category === "tactical")
      .map(({ label }) => `${getSideCallsign(match, slot)} :: ${getTacticalModifier(label)?.summary ?? `${label} loaded.`}`),
  );
  const objective = createSquadObjectiveState(match);

  return {
    id: match.battleStateId ?? `battle_${match.matchId}`,
    floorId: "squad_arena",
    roomId: match.matchId,
    gridWidth: match.rules.gridWidth,
    gridHeight: match.rules.gridHeight,
    tiles: createArenaTiles(match),
    units,
    turnOrder: [],
    activeUnitId: null,
    phase: "placement",
    turnCount: 0,
    log: [
      "SLK//SKIRMISH :: Host-authoritative skirmish battle online.",
      `SLK//MATCH :: ${slotCallsigns[match.hostSlot] ?? match.hostSlot} versus ${connectedSlots.filter((slot) => slot !== match.hostSlot).map((slot) => slotCallsigns[slot] ?? slot).join(", ") || "remote opposition"}.`,
      ...(objective ? [`SLK//OBJECTIVE :: ${objective.description}`] : []),
      ...tacticalNotes.map((note) => `SLK//TACTIC :: ${note}`),
      objective?.kind === "control_relay"
        ? "SLK//PLACE :: Friendly units deploy on the left edge. Opposing units deploy on the right edge. Relay nodes anchor the central lane."
        : objective?.kind === "breakthrough"
          ? "SLK//PLACE :: Friendly units deploy on the left edge. Opposing units deploy on the right edge. Breach lanes sit one column in from each far edge."
          : "SLK//PLACE :: Friendly units deploy on the left edge. Opposing units deploy on the right edge.",
    ],
    placementState: {
      placedUnitIds: [],
      selectedUnitId: friendlyUnitIds[0] ?? null,
      maxUnitsPerSide: match.rules.targetSquadSize,
    },
    modeContext: {
      kind: "squad",
      squad: {
        matchId: match.matchId,
        hostSlot: match.hostSlot,
        winCondition: match.rules.winCondition,
        slotSides,
        slotCallsigns,
        mapSeed: match.rules.mapSeed,
        objective,
      },
    },
  };
}

export function createSquadBattlePayload(match: SquadMatchState, battle: BattleState): string {
  return JSON.stringify({
    protocolVersion: SQUAD_BATTLE_PROTOCOL_VERSION,
    matchId: match.matchId,
    battle,
  } satisfies SquadBattlePayload);
}

export function parseSquadBattlePayload(payload: string): SquadBattlePayload | null {
  try {
    const parsed = JSON.parse(payload) as SquadBattlePayload;
    if (parsed?.protocolVersion !== SQUAD_BATTLE_PROTOCOL_VERSION || !parsed?.matchId || !parsed?.battle) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createSquadBattleCommandPayload(
  match: SquadMatchState,
  battle: BattleState,
  command: SquadBattleCommand,
): string {
  return JSON.stringify({
    protocolVersion: SQUAD_BATTLE_PROTOCOL_VERSION,
    matchId: match.matchId,
    battleId: battle.id,
    command,
  } satisfies SquadBattleCommandPayload);
}

export function parseSquadBattleCommandPayload(payload: string): SquadBattleCommandPayload | null {
  try {
    const parsed = JSON.parse(payload) as SquadBattleCommandPayload;
    if (
      parsed?.protocolVersion !== SQUAD_BATTLE_PROTOCOL_VERSION
      || !parsed?.matchId
      || !parsed?.battleId
      || !parsed?.command
      || typeof parsed.command.type !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getSquadBattleWinnerSlots(battle: BattleState): SessionPlayerSlot[] {
  const squadContext = battle.modeContext?.kind === "squad" ? battle.modeContext.squad ?? null : null;
  if (!squadContext) {
    return [];
  }

  const winningSide: SquadBattleSide | null =
    battle.phase === "victory"
      ? "friendly"
      : battle.phase === "defeat"
        ? "enemy"
        : null;
  if (!winningSide) {
    return [];
  }

  return SESSION_PLAYER_SLOTS.filter((slot) => squadContext.slotSides[slot] === winningSide);
}

export function getSquadBattleResultReason(battle: BattleState): string {
  const squadContext = battle.modeContext?.kind === "squad" ? battle.modeContext.squad ?? null : null;
  if (!squadContext) {
    return "Skirmish resolved.";
  }

  const winnerSlots = getSquadBattleWinnerSlots(battle);
  const winnerNames = winnerSlots
    .map((slot) => squadContext.slotCallsigns[slot] ?? slot)
    .filter(Boolean);
  const objective = squadContext.objective;
  const winningSide: SquadBattleSide | null =
    battle.phase === "victory"
      ? "friendly"
      : battle.phase === "defeat"
        ? "enemy"
        : null;
  if (objective?.winnerSide && winningSide && objective.winnerSide === winningSide) {
    return `${winnerNames.join(", ") || "Objective line"} secured ${objective.label.toLowerCase()} control ${objective.score[winningSide]}/${objective.targetScore}.`;
  }
  if (battle.phase === "victory") {
    return `${winnerNames.join(", ") || "Host skirmish line"} secured elimination control.`;
  }
  if (battle.phase === "defeat") {
    return `${winnerNames.join(", ") || "Opposing skirmish line"} broke the host line.`;
  }
  return "Skirmish resolved.";
}

export function applySquadBattleToGameState(
  state: GameState,
  match: SquadMatchState,
  battle: BattleState,
  authorityRole: AuthorityRole,
): GameState {
  return {
    ...state,
    phase: "battle",
    currentBattle: battle,
    players: {
      ...state.players,
      P1: {
        ...state.players.P1,
        active: true,
        inputSource: "keyboard1",
      },
      P2: {
        ...state.players.P2,
        active: authorityRole !== "client" && match.localSlot === "P2",
        inputSource: authorityRole !== "client" && match.localSlot === "P2" ? "keyboard2" : "none",
      },
    },
    session: {
      ...state.session,
      mode: "squad",
      authorityRole,
      maxPlayers: match.maxPlayers,
      activeBattleId: battle.id,
    },
  };
}

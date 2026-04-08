import { getHighestReachedFloorOrdinal, loadCampaignProgress, type CampaignProgress } from "./campaign";
import type { ResourceKey } from "./resources";
import type { GameState } from "./types";

export type OuterDeckZoneId =
  | "counterweight_shaft"
  | "outer_scaffold"
  | "drop_bay"
  | "supply_intake_port";

export type OuterDeckSubareaKind = "entry" | "mid" | "side" | "reward";

export type OuterDeckNpcEncounterId =
  | "shaft_mechanist"
  | "scaffold_lookout"
  | "dropbay_salvager"
  | "intake_quartermaster";

export interface OuterDeckRewardBundle {
  wad?: number;
  resources?: Partial<Record<ResourceKey, number>>;
}

export interface OuterDeckSubareaSpec {
  id: string;
  mapId: string;
  zoneId: OuterDeckZoneId;
  kind: OuterDeckSubareaKind;
  title: string;
  environmentFlavor: string;
  gateVerb: string;
  hazardTags: string[];
  enemyKinds: string[];
  enemyCount: number;
  advanceToSubareaId?: string | null;
  returnToSubareaId?: string | null;
  sideToSubareaId?: string | null;
  cacheId?: string | null;
  npcEncounterId?: OuterDeckNpcEncounterId | null;
}

export interface OuterDeckExpeditionState {
  expeditionId: string;
  zoneId: OuterDeckZoneId;
  seed: string;
  startedAt: number;
  currentSubareaId: string;
  rolledSideChamber: boolean;
  sideAttachmentSubareaId: string | null;
  subareas: OuterDeckSubareaSpec[];
  clearedSubareaIds: string[];
  rewardCacheClaimedIds: string[];
  npcEncounterIds: OuterDeckNpcEncounterId[];
  completionRewardClaimed: boolean;
}

export interface OuterDeckRunHistoryEntry {
  expeditionId: string;
  zoneId: OuterDeckZoneId;
  seed: string;
  startedAt: number;
  endedAt: number;
  outcome: "completed" | "aborted";
}

export interface OuterDecksState {
  isExpeditionActive: boolean;
  activeExpedition: OuterDeckExpeditionState | null;
  zoneCompletionCounts: Record<OuterDeckZoneId, number>;
  firstClearRecipeGranted: Partial<Record<OuterDeckZoneId, boolean>>;
  seenNpcEncounterIds: OuterDeckNpcEncounterId[];
  runHistory: OuterDeckRunHistoryEntry[];
}

export interface OuterDeckNpcEncounterDefinition {
  id: OuterDeckNpcEncounterId;
  name: string;
  lines: string[];
}

export interface OuterDeckZoneDefinition {
  id: OuterDeckZoneId;
  label: string;
  subtitle: string;
  unlockFloorOrdinal: number;
  gateVerb: string;
  environmentFlavors: string[];
  hazardTags: string[];
  mandatoryEnemyKinds: string[];
  optionalEnemyKinds: string[];
  rewardRecipeId: string;
  cacheReward: OuterDeckRewardBundle;
  completionReward: OuterDeckRewardBundle;
  npcEncounterId: OuterDeckNpcEncounterId;
}

export const OUTER_DECK_TRANSIT_OBJECT_ID = "outer_deck_transit_station";
export const OUTER_DECK_TRANSIT_ZONE_ID = "interact_outer_deck_transit";
export const OUTER_DECK_TRANSIT_OBJECT_TILE = { x: 35, y: 18 } as const;
export const OUTER_DECK_TRANSIT_SPAWN_TILE = { x: 35, y: 20, facing: "west" as const };

export const OUTER_DECK_ZONE_ORDER: OuterDeckZoneId[] = [
  "counterweight_shaft",
  "outer_scaffold",
  "drop_bay",
  "supply_intake_port",
];

export const OUTER_DECK_ZONE_DEFINITIONS: Record<OuterDeckZoneId, OuterDeckZoneDefinition> = {
  counterweight_shaft: {
    id: "counterweight_shaft",
    label: "COUNTERWEIGHT SHAFT",
    subtitle: "Vertical maintenance void around the elevator mass-rails.",
    unlockFloorOrdinal: 3,
    gateVerb: "Route lift power",
    environmentFlavors: ["Emergency-lit shaft", "Sparking service spine", "Counterweight crawl"],
    hazardTags: ["vertical", "power", "maintenance"],
    mandatoryEnemyKinds: ["maintenance_drone", "climber"],
    optionalEnemyKinds: ["perched_gunner", "nest_scuttler"],
    rewardRecipeId: "recipe_steam_valve_wristguard",
    cacheReward: {
      wad: 80,
      resources: { metalScrap: 3, steamComponents: 2 },
    },
    completionReward: {
      wad: 160,
      resources: { metalScrap: 4, steamComponents: 3 },
    },
    npcEncounterId: "shaft_mechanist",
  },
  outer_scaffold: {
    id: "outer_scaffold",
    label: "OUTER SCAFFOLD",
    subtitle: "Exposed catwalk rings and weathered support bridges.",
    unlockFloorOrdinal: 6,
    gateVerb: "Actuate scaffold winch",
    environmentFlavors: ["Wind-lashed span", "Signal relay ring", "Broken catwalk web"],
    hazardTags: ["exposed", "ranged", "bridges"],
    mandatoryEnemyKinds: ["scavenger_marksman", "shield_raider"],
    optionalEnemyKinds: ["fast_flanker", "sentry_construct"],
    rewardRecipeId: "recipe_coolant_flask",
    cacheReward: {
      wad: 110,
      resources: { wood: 2, steamComponents: 2, chaosShards: 1 },
    },
    completionReward: {
      wad: 200,
      resources: { metalScrap: 2, steamComponents: 3, chaosShards: 2 },
    },
    npcEncounterId: "scaffold_lookout",
  },
  drop_bay: {
    id: "drop_bay",
    label: "DROP BAY",
    subtitle: "Container clamps, release rails, and freight kill-boxes.",
    unlockFloorOrdinal: 9,
    gateVerb: "Reposition cargo train",
    environmentFlavors: ["Mag-clamp yard", "Container choke", "Release cradle floor"],
    hazardTags: ["cover", "salvage", "machinery"],
    mandatoryEnemyKinds: ["looter", "heavy_loader"],
    optionalEnemyKinds: ["cargo_ambusher", "containment_beast"],
    rewardRecipeId: "recipe_overcharge_cell",
    cacheReward: {
      wad: 140,
      resources: { metalScrap: 4, wood: 1, steamComponents: 1 },
    },
    completionReward: {
      wad: 250,
      resources: { metalScrap: 5, wood: 2, steamComponents: 2 },
    },
    npcEncounterId: "dropbay_salvager",
  },
  supply_intake_port: {
    id: "supply_intake_port",
    label: "SUPPLY INTAKE PORT",
    subtitle: "Sorting gates, intake channels, and jammed conveyor lanes.",
    unlockFloorOrdinal: 12,
    gateVerb: "Reroute intake flow",
    environmentFlavors: ["Quarantine sorter", "Flooded intake run", "Conveyor choke"],
    hazardTags: ["logistics", "swarm", "contamination"],
    mandatoryEnemyKinds: ["sort_bot", "smuggler"],
    optionalEnemyKinds: ["swarm", "contamination_husk"],
    rewardRecipeId: "recipe_brassback_scattergun",
    cacheReward: {
      wad: 170,
      resources: { wood: 3, chaosShards: 2, steamComponents: 2 },
    },
    completionReward: {
      wad: 300,
      resources: { metalScrap: 2, wood: 3, chaosShards: 3, steamComponents: 2 },
    },
    npcEncounterId: "intake_quartermaster",
  },
};

export const OUTER_DECK_NPC_ENCOUNTERS: Record<OuterDeckNpcEncounterId, OuterDeckNpcEncounterDefinition> = {
  shaft_mechanist: {
    id: "shaft_mechanist",
    name: "The Weaponsmith",
    lines: [
      "That bowblade is fighting the shaft harder than it has to. Bring it to my bench if you want it tuned properly.",
      "Keep the route stable and I'll set a temporary bench inside HAVEN. I can work there until the shaft shop is worth reopening.",
      "You need upgrades, find me in HAVEN for now. When the Counterweight is ready again, we'll move the real workshop back where it belongs.",
    ],
  },
  scaffold_lookout: {
    id: "scaffold_lookout",
    name: "Needle Lookout",
    lines: [
      "The scaffold sings before the raiders show. You hear it, you move.",
      "Sightlines out here are currency. Take the high rung first and the rest usually follows.",
      "You're making the outside lanes feel occupied again. That's worth more than scrap.",
    ],
  },
  dropbay_salvager: {
    id: "dropbay_salvager",
    name: "Brass Jack",
    lines: [
      "Cargo never really disappears. It just waits for the right hands.",
      "Half these clamps still answer to the old release patterns if you sweet-talk the rails.",
      "Bring HAVEN enough salvage and the whole rig starts looking less abandoned.",
    ],
  },
  intake_quartermaster: {
    id: "intake_quartermaster",
    name: "Quartermaster Pell",
    lines: [
      "The intake ports were built to feed an army, not starve in silence.",
      "Clear the jams, wake the sorters, and the elevator starts breathing again.",
      "You're not just scavenging. You're rebuilding supply memory into the machine.",
    ],
  },
};

function createZoneCompletionCounts(): Record<OuterDeckZoneId, number> {
  return {
    counterweight_shaft: 0,
    outer_scaffold: 0,
    drop_bay: 0,
    supply_intake_port: 0,
  };
}

function createSeedFromString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let current = seed >>> 0;
  return () => {
    current = (Math.imul(current, 1664525) + 1013904223) >>> 0;
    return current / 0x100000000;
  };
}

function chooseDeterministic<T>(items: T[], random: () => number): T {
  return items[Math.max(0, Math.min(items.length - 1, Math.floor(random() * items.length)))]!;
}

function createExpeditionSeed(zoneId: OuterDeckZoneId, now: number): string {
  const suffix = Math.floor(Math.random() * 1_000_000).toString(16).padStart(5, "0");
  return `${zoneId}:${now}:${suffix}`;
}

function buildOuterDeckSubareas(
  zone: OuterDeckZoneDefinition,
  expeditionId: string,
  seed: string,
): OuterDeckSubareaSpec[] {
  const random = createSeededRandom(createSeedFromString(seed));
  const entryId = `${expeditionId}:entry`;
  const midId = `${expeditionId}:mid`;
  const rewardId = `${expeditionId}:reward`;
  const sideId = `${expeditionId}:side`;
  const rolledSide = random() >= 0.45;
  const entryFlavor = chooseDeterministic(zone.environmentFlavors, random);
  const midFlavor = chooseDeterministic(zone.environmentFlavors, random);
  const rewardFlavor = chooseDeterministic(zone.environmentFlavors, random);
  const sideFlavor = chooseDeterministic(zone.environmentFlavors, random);

  const buildEnemyKinds = (mandatoryCount: number): string[] => {
    const kinds = [...zone.mandatoryEnemyKinds.slice(0, mandatoryCount)];
    const optionalPool = [...zone.optionalEnemyKinds];
    while (kinds.length < mandatoryCount && optionalPool.length > 0) {
      kinds.push(optionalPool.shift()!);
    }
    if (optionalPool.length > 0 && random() >= 0.5) {
      kinds.push(chooseDeterministic(optionalPool, random));
    }
    return kinds;
  };

  const entry: OuterDeckSubareaSpec = {
    id: entryId,
    mapId: `outerdeck_${entryId.replace(/[:]/g, "_")}`,
    zoneId: zone.id,
    kind: "entry",
    title: `${zone.label} // ENTRY`,
    environmentFlavor: entryFlavor,
    gateVerb: zone.gateVerb,
    hazardTags: zone.hazardTags,
    enemyKinds: buildEnemyKinds(2),
    enemyCount: 2,
    advanceToSubareaId: midId,
  };

  const mid: OuterDeckSubareaSpec = {
    id: midId,
    mapId: `outerdeck_${midId.replace(/[:]/g, "_")}`,
    zoneId: zone.id,
    kind: "mid",
    title: `${zone.label} // SPINE`,
    environmentFlavor: midFlavor,
    gateVerb: zone.gateVerb,
    hazardTags: zone.hazardTags,
    enemyKinds: buildEnemyKinds(3),
    enemyCount: 3,
    advanceToSubareaId: rewardId,
    returnToSubareaId: entryId,
    sideToSubareaId: rolledSide ? sideId : null,
  };

  const reward: OuterDeckSubareaSpec = {
    id: rewardId,
    mapId: `outerdeck_${rewardId.replace(/[:]/g, "_")}`,
    zoneId: zone.id,
    kind: "reward",
    title: `${zone.label} // RECOVERY NODE`,
    environmentFlavor: rewardFlavor,
    gateVerb: zone.gateVerb,
    hazardTags: zone.hazardTags,
    enemyKinds: [],
    enemyCount: 0,
    returnToSubareaId: midId,
    npcEncounterId: zone.npcEncounterId,
  };

  const side: OuterDeckSubareaSpec = {
    id: sideId,
    mapId: `outerdeck_${sideId.replace(/[:]/g, "_")}`,
    zoneId: zone.id,
    kind: "side",
    title: `${zone.label} // SIDE CACHE`,
    environmentFlavor: sideFlavor,
    gateVerb: zone.gateVerb,
    hazardTags: zone.hazardTags,
    enemyKinds: [chooseDeterministic([...zone.mandatoryEnemyKinds, ...zone.optionalEnemyKinds], random)],
    enemyCount: 1,
    returnToSubareaId: midId,
    cacheId: `${expeditionId}:cache`,
  };

  return rolledSide ? [entry, mid, side, reward] : [entry, mid, reward];
}

function findSubareaIndex(expedition: OuterDeckExpeditionState, subareaId: string): number {
  return expedition.subareas.findIndex((subarea) => subarea.id === subareaId);
}

function addKnownRecipe(knownRecipeIds: string[], recipeId: string): string[] {
  return knownRecipeIds.includes(recipeId) ? knownRecipeIds : [...knownRecipeIds, recipeId];
}

function appendRunHistory(
  history: OuterDeckRunHistoryEntry[],
  entry: OuterDeckRunHistoryEntry,
): OuterDeckRunHistoryEntry[] {
  return [...history, entry].slice(-20);
}

export function createDefaultOuterDecksState(): OuterDecksState {
  return {
    isExpeditionActive: false,
    activeExpedition: null,
    zoneCompletionCounts: createZoneCompletionCounts(),
    firstClearRecipeGranted: {},
    seenNpcEncounterIds: [],
    runHistory: [],
  };
}

export function getOuterDeckZoneDefinition(zoneId: OuterDeckZoneId): OuterDeckZoneDefinition {
  return OUTER_DECK_ZONE_DEFINITIONS[zoneId];
}

export function getOuterDeckNpcEncounterDefinition(
  encounterId: OuterDeckNpcEncounterId,
): OuterDeckNpcEncounterDefinition {
  return OUTER_DECK_NPC_ENCOUNTERS[encounterId];
}

export function isOuterDeckZoneUnlocked(
  zoneId: OuterDeckZoneId,
  progress: Partial<CampaignProgress> | null | undefined = loadCampaignProgress(),
): boolean {
  return getHighestReachedFloorOrdinal(progress) >= getOuterDeckZoneDefinition(zoneId).unlockFloorOrdinal;
}

export function getUnlockedOuterDeckZoneIds(
  progress: Partial<CampaignProgress> | null | undefined = loadCampaignProgress(),
): OuterDeckZoneId[] {
  return OUTER_DECK_ZONE_ORDER.filter((zoneId) => isOuterDeckZoneUnlocked(zoneId, progress));
}

export function isOuterDeckExpeditionActive(state: Pick<GameState, "outerDecks">): boolean {
  return Boolean(state.outerDecks?.isExpeditionActive && state.outerDecks?.activeExpedition);
}

export function isOuterDeckMapId(mapId: string | null | undefined): boolean {
  return typeof mapId === "string" && mapId.startsWith("outerdeck_");
}

export function getOuterDeckActiveExpedition(
  state: Pick<GameState, "outerDecks">,
): OuterDeckExpeditionState | null {
  return state.outerDecks?.activeExpedition ?? null;
}

export function getOuterDeckSubareaById(
  state: Pick<GameState, "outerDecks">,
  subareaId: string,
): OuterDeckSubareaSpec | null {
  const expedition = getOuterDeckActiveExpedition(state);
  return expedition?.subareas.find((subarea) => subarea.id === subareaId) ?? null;
}

export function getOuterDeckSubareaByMapId(
  state: Pick<GameState, "outerDecks">,
  mapId: string,
): OuterDeckSubareaSpec | null {
  const expedition = getOuterDeckActiveExpedition(state);
  return expedition?.subareas.find((subarea) => subarea.mapId === mapId) ?? null;
}

export function getCurrentOuterDeckSubarea(
  state: Pick<GameState, "outerDecks">,
): OuterDeckSubareaSpec | null {
  const expedition = getOuterDeckActiveExpedition(state);
  if (!expedition) {
    return null;
  }

  return getOuterDeckSubareaById(state, expedition.currentSubareaId);
}

export function beginOuterDeckExpedition(
  state: GameState,
  zoneId: OuterDeckZoneId,
  now = Date.now(),
): GameState {
  if (!isOuterDeckZoneUnlocked(zoneId)) {
    return state;
  }

  const zone = getOuterDeckZoneDefinition(zoneId);
  const seed = createExpeditionSeed(zoneId, now);
  const expeditionId = `outerdeck_${zoneId}_${now}`;
  const subareas = buildOuterDeckSubareas(zone, expeditionId, seed);
  const entrySubarea = subareas.find((subarea) => subarea.kind === "entry") ?? subareas[0];
  const sideSubarea = subareas.find((subarea) => subarea.kind === "side") ?? null;

  const activeExpedition: OuterDeckExpeditionState = {
    expeditionId,
    zoneId,
    seed,
    startedAt: now,
    currentSubareaId: entrySubarea.id,
    rolledSideChamber: Boolean(sideSubarea),
    sideAttachmentSubareaId: sideSubarea?.id ?? null,
    subareas,
    clearedSubareaIds: [],
    rewardCacheClaimedIds: [],
    npcEncounterIds: [],
    completionRewardClaimed: false,
  };

  return {
    ...state,
    outerDecks: {
      ...(state.outerDecks ?? createDefaultOuterDecksState()),
      isExpeditionActive: true,
      activeExpedition,
    },
  };
}

export function setOuterDeckCurrentSubarea(
  state: GameState,
  subareaId: string,
): GameState {
  const expedition = getOuterDeckActiveExpedition(state);
  if (!expedition || findSubareaIndex(expedition, subareaId) < 0) {
    return state;
  }

  return {
    ...state,
    outerDecks: {
      ...(state.outerDecks ?? createDefaultOuterDecksState()),
      isExpeditionActive: true,
      activeExpedition: {
        ...expedition,
        currentSubareaId: subareaId,
      },
    },
  };
}

export function isOuterDeckSubareaCleared(
  state: Pick<GameState, "outerDecks">,
  subareaId: string,
): boolean {
  const expedition = getOuterDeckActiveExpedition(state);
  return Boolean(expedition?.clearedSubareaIds.includes(subareaId));
}

export function markOuterDeckSubareaCleared(
  state: GameState,
  subareaId: string,
): GameState {
  const expedition = getOuterDeckActiveExpedition(state);
  if (!expedition || expedition.clearedSubareaIds.includes(subareaId) || findSubareaIndex(expedition, subareaId) < 0) {
    return state;
  }

  return {
    ...state,
    outerDecks: {
      ...(state.outerDecks ?? createDefaultOuterDecksState()),
      isExpeditionActive: true,
      activeExpedition: {
        ...expedition,
        clearedSubareaIds: [...expedition.clearedSubareaIds, subareaId],
      },
    },
  };
}

export function hasOuterDeckCacheBeenClaimed(
  state: Pick<GameState, "outerDecks">,
  cacheId: string,
): boolean {
  const expedition = getOuterDeckActiveExpedition(state);
  return Boolean(expedition?.rewardCacheClaimedIds.includes(cacheId));
}

export function markOuterDeckCacheClaimed(
  state: GameState,
  cacheId: string,
): GameState {
  const expedition = getOuterDeckActiveExpedition(state);
  if (!expedition || expedition.rewardCacheClaimedIds.includes(cacheId)) {
    return state;
  }

  return {
    ...state,
    outerDecks: {
      ...(state.outerDecks ?? createDefaultOuterDecksState()),
      isExpeditionActive: true,
      activeExpedition: {
        ...expedition,
        rewardCacheClaimedIds: [...expedition.rewardCacheClaimedIds, cacheId],
      },
    },
  };
}

export function hasSeenOuterDeckNpcEncounter(
  state: Pick<GameState, "outerDecks">,
  encounterId: OuterDeckNpcEncounterId,
): boolean {
  return Boolean(state.outerDecks?.seenNpcEncounterIds.includes(encounterId));
}

export function markOuterDeckNpcEncounterSeen(
  state: GameState,
  encounterId: OuterDeckNpcEncounterId,
): GameState {
  const outerDecks = state.outerDecks ?? createDefaultOuterDecksState();
  const activeExpedition = outerDecks.activeExpedition;
  if (outerDecks.seenNpcEncounterIds.includes(encounterId)) {
    return state;
  }

  return {
    ...state,
    outerDecks: {
      ...outerDecks,
      seenNpcEncounterIds: [...outerDecks.seenNpcEncounterIds, encounterId],
      activeExpedition: activeExpedition
        ? {
            ...activeExpedition,
            npcEncounterIds: activeExpedition.npcEncounterIds.includes(encounterId)
              ? activeExpedition.npcEncounterIds
              : [...activeExpedition.npcEncounterIds, encounterId],
          }
        : activeExpedition,
    },
  };
}

export function getOuterDeckCacheReward(
  zoneId: OuterDeckZoneId,
): OuterDeckRewardBundle {
  return getOuterDeckZoneDefinition(zoneId).cacheReward;
}

export function getOuterDeckCompletionReward(
  zoneId: OuterDeckZoneId,
): OuterDeckRewardBundle {
  return getOuterDeckZoneDefinition(zoneId).completionReward;
}

export function claimOuterDeckCompletion(
  state: GameState,
  now = Date.now(),
): { state: GameState; awardedRecipeId: string | null } {
  const outerDecks = state.outerDecks ?? createDefaultOuterDecksState();
  const expedition = outerDecks.activeExpedition;
  if (!expedition || expedition.completionRewardClaimed) {
    return { state, awardedRecipeId: null };
  }

  const zoneId = expedition.zoneId;
  const zone = getOuterDeckZoneDefinition(zoneId);
  const alreadyGranted = Boolean(outerDecks.firstClearRecipeGranted[zoneId]);
  const awardedRecipeId = alreadyGranted ? null : zone.rewardRecipeId;

  return {
    awardedRecipeId,
    state: {
      ...state,
      knownRecipeIds: awardedRecipeId ? addKnownRecipe(state.knownRecipeIds ?? [], awardedRecipeId) : (state.knownRecipeIds ?? []),
      outerDecks: {
        ...outerDecks,
        isExpeditionActive: false,
        activeExpedition: null,
        zoneCompletionCounts: {
          ...outerDecks.zoneCompletionCounts,
          [zoneId]: Math.max(0, Number(outerDecks.zoneCompletionCounts[zoneId] ?? 0)) + 1,
        },
        firstClearRecipeGranted: {
          ...outerDecks.firstClearRecipeGranted,
          [zoneId]: true,
        },
        runHistory: appendRunHistory(outerDecks.runHistory, {
          expeditionId: expedition.expeditionId,
          zoneId,
          seed: expedition.seed,
          startedAt: expedition.startedAt,
          endedAt: now,
          outcome: "completed",
        }),
      },
    },
  };
}

export function abortOuterDeckExpedition(
  state: GameState,
  now = Date.now(),
): GameState {
  const outerDecks = state.outerDecks ?? createDefaultOuterDecksState();
  const expedition = outerDecks.activeExpedition;
  if (!expedition) {
    return state;
  }

  return {
    ...state,
    outerDecks: {
      ...outerDecks,
      isExpeditionActive: false,
      activeExpedition: null,
      runHistory: appendRunHistory(outerDecks.runHistory, {
        expeditionId: expedition.expeditionId,
        zoneId: expedition.zoneId,
        seed: expedition.seed,
        startedAt: expedition.startedAt,
        endedAt: now,
        outcome: "aborted",
      }),
    },
  };
}

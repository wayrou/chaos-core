import type { GameState } from "./types";

export type OuterDeckZoneId =
  | "counterweight_shaft"
  | "outer_scaffold"
  | "drop_bay"
  | "supply_intake_port";

export type OuterDeckNpcEncounterId =
  | "shaft_mechanist"
  | "scaffold_spotter"
  | "dropbay_loader"
  | "intake_quartermaster";

export type OuterDeckMechanicId =
  | "counterweight_shaft_restore_lift_power"
  | "outer_scaffold_extend_bridge"
  | "drop_bay_route_crane"
  | "supply_intake_port_clear_sorter_jam";

export type OuterDeckRewardBundle = {
  wad?: number;
  resources?: {
    metalScrap?: number;
    wood?: number;
    chaosShards?: number;
    steamComponents?: number;
  };
};

export type OuterDeckSubareaKind = "entry" | "mid" | "reward";

export interface OuterDeckSubareaSpec {
  id: string;
  zoneId: OuterDeckZoneId;
  mapId: string;
  kind: OuterDeckSubareaKind;
  title: string;
  gateVerb: string;
  enemyCount: number;
  enemyKinds: string[];
  advanceToSubareaId: string | null;
  returnToSubareaId: string | null;
  requiredMechanicId?: OuterDeckMechanicId | null;
  requiredMechanicLabel?: string | null;
  requiredMechanicHint?: string | null;
  cacheId?: string | null;
  npcEncounterId?: OuterDeckNpcEncounterId | null;
}

export interface OuterDeckZoneDefinition {
  id: OuterDeckZoneId;
  name: string;
  description: string;
  unlockFloorOrdinal: number;
  gateLabel: string;
  lockedMessage: string;
  cacheReward: OuterDeckRewardBundle;
  completionReward: OuterDeckRewardBundle;
  firstClearRecipeId: string | null;
  subareas: OuterDeckSubareaSpec[];
}

export interface OuterDeckExpeditionState {
  expeditionId: string;
  zoneId: OuterDeckZoneId;
  startedAt: number;
  currentSubareaId: string;
  subareas: OuterDeckSubareaSpec[];
  clearedSubareaIds: string[];
  resolvedMechanicIds: OuterDeckMechanicId[];
  rewardCacheClaimedIds: string[];
  npcEncounterIds: OuterDeckNpcEncounterId[];
  completionRewardClaimed: boolean;
}

export interface OuterDeckRunHistoryEntry {
  expeditionId: string;
  zoneId: OuterDeckZoneId;
  startedAt: number;
  endedAt: number;
  outcome: "completed" | "aborted";
  clearedSubareaIds: string[];
}

export interface OuterDecksState {
  isExpeditionActive: boolean;
  activeExpedition: OuterDeckExpeditionState | null;
  zoneCompletionCounts: Record<OuterDeckZoneId, number>;
  zoneFirstClearRecipeClaimed: Partial<Record<OuterDeckZoneId, boolean>>;
  seenNpcEncounterIds: OuterDeckNpcEncounterId[];
  runHistory: OuterDeckRunHistoryEntry[];
}

export type OuterDeckFieldContext = "haven" | "outerDeckOverworld" | "outerDeckBranch";

export interface OuterDeckNpcEncounterDefinition {
  id: OuterDeckNpcEncounterId;
  name: string;
  lines: string[];
}

export const OUTER_DECK_OVERWORLD_MAP_ID = "outer_deck_overworld";
export const OUTER_DECK_HAVEN_EXIT_OBJECT_ID = "haven_outer_deck_south_gate";
export const OUTER_DECK_HAVEN_EXIT_ZONE_ID = "interact_haven_outer_deck_south_gate";
export const OUTER_DECK_HAVEN_EXIT_OBJECT_TILE = { x: 23, y: 21 };
export const OUTER_DECK_HAVEN_EXIT_SPAWN_TILE = { x: 24, y: 21, facing: "south" as const };
export const OUTER_DECK_OVERWORLD_ENTRY_SPAWN_TILE = { x: 70, y: 60, facing: "south" as const };
export const OUTER_DECK_OVERWORLD_HAVEN_GATE_ZONE_ID = "outer_deck_overworld_return_haven";
export const OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE = { x: 69, y: 57 };

const OUTER_DECK_ZONE_ORDER: OuterDeckZoneId[] = [
  "counterweight_shaft",
  "outer_scaffold",
  "drop_bay",
  "supply_intake_port",
];

const OUTER_DECK_OVERWORLD_BRANCH_SPAWNS: Record<
  OuterDeckZoneId,
  { gateTile: { x: number; y: number }; returnSpawn: { x: number; y: number; facing: "north" | "south" | "east" | "west" } }
> = {
  counterweight_shaft: {
    gateTile: { x: 69, y: 3 },
    returnSpawn: { x: 70, y: 7, facing: "south" },
  },
  outer_scaffold: {
    gateTile: { x: 133, y: 44 },
    returnSpawn: { x: 129, y: 45, facing: "west" },
  },
  drop_bay: {
    gateTile: { x: 69, y: 84 },
    returnSpawn: { x: 70, y: 80, facing: "north" },
  },
  supply_intake_port: {
    gateTile: { x: 5, y: 44 },
    returnSpawn: { x: 10, y: 45, facing: "east" },
  },
};

const OUTER_DECK_NPC_ENCOUNTERS: Record<OuterDeckNpcEncounterId, OuterDeckNpcEncounterDefinition> = {
  shaft_mechanist: {
    id: "shaft_mechanist",
    name: "Mechanist Reva",
    lines: [
      "You got the lift cage moving? Good. Means the bones of this thing still listen.",
      "Keep the power lines breathing and the shaft will stop trying to kill you every third rung.",
    ],
  },
  scaffold_spotter: {
    id: "scaffold_spotter",
    name: "Lookout Hesh",
    lines: [
      "Wind still carries signal out here. Not much else, but signal enough.",
      "If you want the long lanes clear, take the high catwalk before the crews do.",
    ],
  },
  dropbay_loader: {
    id: "dropbay_loader",
    name: "Loader Gant",
    lines: [
      "The clamps still answer in pairs. Move one stack wrong and the whole lane deadlocks.",
      "Plenty of salvage down here if you can keep the raiders off the rails.",
    ],
  },
  intake_quartermaster: {
    id: "intake_quartermaster",
    name: "Quartermaster Vale",
    lines: [
      "Intake still wants to sort everything. Cargo, bodies, bad decisions.",
      "Clear the jams and the port starts paying you back in real supplies.",
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

function createSubareas(
  zoneId: OuterDeckZoneId,
  specs: Array<{
    slug: string;
    kind: OuterDeckSubareaKind;
    title: string;
    gateVerb: string;
    enemyCount: number;
    enemyKinds: string[];
    requiredMechanicId?: OuterDeckMechanicId | null;
    requiredMechanicLabel?: string | null;
    requiredMechanicHint?: string | null;
    cacheId?: string | null;
    npcEncounterId?: OuterDeckNpcEncounterId | null;
  }>,
): OuterDeckSubareaSpec[] {
  return specs.map((spec, index) => ({
    id: `${zoneId}:${spec.slug}`,
    zoneId,
    mapId: `outerdeck_${zoneId}_${spec.slug}`,
    kind: spec.kind,
    title: spec.title,
    gateVerb: spec.gateVerb,
    enemyCount: spec.enemyCount,
    enemyKinds: [...spec.enemyKinds],
    advanceToSubareaId: specs[index + 1] ? `${zoneId}:${specs[index + 1].slug}` : null,
    returnToSubareaId: index > 0 ? `${zoneId}:${specs[index - 1].slug}` : null,
    requiredMechanicId: spec.requiredMechanicId ?? null,
    requiredMechanicLabel: spec.requiredMechanicLabel ?? null,
    requiredMechanicHint: spec.requiredMechanicHint ?? null,
    cacheId: spec.cacheId ?? null,
    npcEncounterId: spec.npcEncounterId ?? null,
  }));
}

const OUTER_DECK_ZONE_DEFINITIONS: Record<OuterDeckZoneId, OuterDeckZoneDefinition> = {
  counterweight_shaft: {
    id: "counterweight_shaft",
    name: "Counterweight Shaft",
    description: "A vertical service spine of maintenance lifts, offset ledges, and unstable machinery.",
    unlockFloorOrdinal: 3,
    gateLabel: "COUNTERWEIGHT SHAFT",
    lockedMessage: "Counterweight Shaft unlocks after Floor 03.",
    cacheReward: {
      wad: 28,
      resources: { metalScrap: 2, steamComponents: 1 },
    },
    completionReward: {
      wad: 52,
      resources: { metalScrap: 3, steamComponents: 2 },
    },
    firstClearRecipeId: "recipe_steam_valve_wristguard",
    subareas: createSubareas("counterweight_shaft", [
      {
        slug: "lower_access",
        kind: "entry",
        title: "Counterweight Shaft // Lower Access",
        gateVerb: "POWER LIFT",
        enemyCount: 2,
        enemyKinds: ["maintenance_drone", "climbing_scavenger"],
        requiredMechanicId: "counterweight_shaft_restore_lift_power",
        requiredMechanicLabel: "RESTORE LIFT POWER",
        requiredMechanicHint: "Route emergency power through the maintenance lift controls first.",
      },
      {
        slug: "lift_spine",
        kind: "mid",
        title: "Counterweight Shaft // Lift Spine",
        gateVerb: "ALIGN PLATFORM",
        enemyCount: 3,
        enemyKinds: ["perched_ranged", "climbing_scavenger", "maintenance_drone"],
        cacheId: "counterweight_shaft_cache_a",
        npcEncounterId: "shaft_mechanist",
      },
      {
        slug: "counterweight_cap",
        kind: "reward",
        title: "Counterweight Shaft // Counterweight Cap",
        gateVerb: "SECURE NODE",
        enemyCount: 2,
        enemyKinds: ["nest_creature", "perched_ranged"],
      },
    ]),
  },
  outer_scaffold: {
    id: "outer_scaffold",
    name: "Outer Scaffold",
    description: "Exposed catwalk rings and scaffold arms wrapped around HAVEN's outer shell.",
    unlockFloorOrdinal: 6,
    gateLabel: "OUTER SCAFFOLD",
    lockedMessage: "Outer Scaffold unlocks after Floor 06.",
    cacheReward: {
      wad: 30,
      resources: { wood: 2, steamComponents: 1 },
    },
    completionReward: {
      wad: 58,
      resources: { wood: 3, steamComponents: 2 },
    },
    firstClearRecipeId: "recipe_fleetfoot_anklet",
    subareas: createSubareas("outer_scaffold", [
      {
        slug: "ringwalk",
        kind: "entry",
        title: "Outer Scaffold // Ringwalk",
        gateVerb: "EXTEND BRIDGE",
        enemyCount: 2,
        enemyKinds: ["scaffold_sniper", "fast_flanker"],
        requiredMechanicId: "outer_scaffold_extend_bridge",
        requiredMechanicLabel: "RESTART WINCH",
        requiredMechanicHint: "Kick the scaffold winch back online before the bridge can extend.",
      },
      {
        slug: "signal_span",
        kind: "mid",
        title: "Outer Scaffold // Signal Span",
        gateVerb: "RESTART WINCH",
        enemyCount: 3,
        enemyKinds: ["scaffold_sniper", "shielded_defender", "fast_flanker"],
        cacheId: "outer_scaffold_cache_a",
        npcEncounterId: "scaffold_spotter",
      },
      {
        slug: "relay_roost",
        kind: "reward",
        title: "Outer Scaffold // Relay Roost",
        gateVerb: "SECURE NODE",
        enemyCount: 2,
        enemyKinds: ["sentry_construct", "scaffold_sniper"],
      },
    ]),
  },
  drop_bay: {
    id: "drop_bay",
    name: "Drop Bay",
    description: "A broken freight deployment lane full of clamp rails, cargo stacks, and release machinery.",
    unlockFloorOrdinal: 9,
    gateLabel: "DROP BAY",
    lockedMessage: "Drop Bay unlocks after Floor 09.",
    cacheReward: {
      wad: 34,
      resources: { metalScrap: 2, wood: 2 },
    },
    completionReward: {
      wad: 64,
      resources: { metalScrap: 3, wood: 2, steamComponents: 1 },
    },
    firstClearRecipeId: "recipe_repair_kit",
    subareas: createSubareas("drop_bay", [
      {
        slug: "clamp_lane",
        kind: "entry",
        title: "Drop Bay // Clamp Lane",
        gateVerb: "RELEASE CLAMPS",
        enemyCount: 2,
        enemyKinds: ["cargo_looter", "cargo_ambusher"],
        requiredMechanicId: "drop_bay_route_crane",
        requiredMechanicLabel: "ROUTE CRANE",
        requiredMechanicHint: "Route the cargo crane before the clamp lane will open.",
      },
      {
        slug: "cargo_field",
        kind: "mid",
        title: "Drop Bay // Cargo Field",
        gateVerb: "ROUTE CRANE",
        enemyCount: 3,
        enemyKinds: ["heavy_defender", "cargo_ambusher", "industrial_construct"],
        cacheId: "drop_bay_cache_a",
        npcEncounterId: "dropbay_loader",
      },
      {
        slug: "dispatch_cradle",
        kind: "reward",
        title: "Drop Bay // Dispatch Cradle",
        gateVerb: "SECURE NODE",
        enemyCount: 2,
        enemyKinds: ["industrial_construct", "containment_beast"],
      },
    ]),
  },
  supply_intake_port: {
    id: "supply_intake_port",
    name: "Supply Intake Port",
    description: "An intake and sorting lattice where cargo routes, gates, and conveyors still grind against each other.",
    unlockFloorOrdinal: 12,
    gateLabel: "SUPPLY INTAKE PORT",
    lockedMessage: "Supply Intake Port unlocks after Floor 12.",
    cacheReward: {
      wad: 36,
      resources: { chaosShards: 2, steamComponents: 1 },
    },
    completionReward: {
      wad: 68,
      resources: { chaosShards: 2, steamComponents: 2, wood: 1 },
    },
    firstClearRecipeId: "recipe_coolant_flask",
    subareas: createSubareas("supply_intake_port", [
      {
        slug: "intake_gate",
        kind: "entry",
        title: "Supply Intake Port // Intake Gate",
        gateVerb: "POWER INTAKE",
        enemyCount: 2,
        enemyKinds: ["swarm_cluster", "sort_bot"],
        requiredMechanicId: "supply_intake_port_clear_sorter_jam",
        requiredMechanicLabel: "CLEAR SORTER JAM",
        requiredMechanicHint: "Clear the sorter jam before the intake gate can cycle open.",
      },
      {
        slug: "sorting_channel",
        kind: "mid",
        title: "Supply Intake Port // Sorting Channel",
        gateVerb: "CLEAR JAM",
        enemyCount: 3,
        enemyKinds: ["swarm_cluster", "smuggler_raider", "sort_bot"],
        cacheId: "supply_intake_port_cache_a",
        npcEncounterId: "intake_quartermaster",
      },
      {
        slug: "quarantine_lock",
        kind: "reward",
        title: "Supply Intake Port // Quarantine Lock",
        gateVerb: "SECURE NODE",
        enemyCount: 2,
        enemyKinds: ["contamination_creature", "automated_defense"],
      },
    ]),
  },
};

function cloneSubareas(subareas: OuterDeckSubareaSpec[]): OuterDeckSubareaSpec[] {
  return subareas.map((subarea) => ({
    ...subarea,
    enemyKinds: [...subarea.enemyKinds],
  }));
}

function cloneActiveExpedition(expedition: OuterDeckExpeditionState | null): OuterDeckExpeditionState | null {
  if (!expedition) {
    return null;
  }

  return {
    ...expedition,
    subareas: cloneSubareas(expedition.subareas),
    clearedSubareaIds: [...expedition.clearedSubareaIds],
    resolvedMechanicIds: [...expedition.resolvedMechanicIds],
    rewardCacheClaimedIds: [...expedition.rewardCacheClaimedIds],
    npcEncounterIds: [...expedition.npcEncounterIds],
  };
}

function withOuterDecksState(state: GameState, outerDecks: OuterDecksState): GameState {
  return {
    ...state,
    outerDecks,
  };
}

function getSafeOuterDecksState(state: GameState): OuterDecksState {
  return state.outerDecks ?? createDefaultOuterDecksState();
}

export function createDefaultOuterDecksState(): OuterDecksState {
  return {
    isExpeditionActive: false,
    activeExpedition: null,
    zoneCompletionCounts: createZoneCompletionCounts(),
    zoneFirstClearRecipeClaimed: {},
    seenNpcEncounterIds: [],
    runHistory: [],
  };
}

export function getAllOuterDeckZoneDefinitions(): OuterDeckZoneDefinition[] {
  return OUTER_DECK_ZONE_ORDER.map((zoneId) => OUTER_DECK_ZONE_DEFINITIONS[zoneId]);
}

export function getOuterDeckZoneDefinition(zoneId: OuterDeckZoneId): OuterDeckZoneDefinition {
  return OUTER_DECK_ZONE_DEFINITIONS[zoneId];
}

export function getOuterDeckNpcEncounterDefinition(encounterId: OuterDeckNpcEncounterId): OuterDeckNpcEncounterDefinition {
  return OUTER_DECK_NPC_ENCOUNTERS[encounterId];
}

export function getOuterDeckCompletionReward(zoneId: OuterDeckZoneId): OuterDeckRewardBundle {
  return getOuterDeckZoneDefinition(zoneId).completionReward;
}

export function getOuterDeckZoneLockedMessage(zoneId: OuterDeckZoneId): string {
  return getOuterDeckZoneDefinition(zoneId).lockedMessage;
}

export function getOuterDeckOverworldGateTile(zoneId: OuterDeckZoneId): { x: number; y: number } {
  return OUTER_DECK_OVERWORLD_BRANCH_SPAWNS[zoneId].gateTile;
}

export function getOuterDeckOverworldReturnSpawn(zoneId: OuterDeckZoneId): { x: number; y: number; facing: "north" | "south" | "east" | "west" } {
  return OUTER_DECK_OVERWORLD_BRANCH_SPAWNS[zoneId].returnSpawn;
}

export function getOuterDeckZoneGateLabel(zoneId: OuterDeckZoneId): string {
  return getOuterDeckZoneDefinition(zoneId).gateLabel;
}

export function getOuterDeckBranchEntrySubarea(zoneId: OuterDeckZoneId): OuterDeckSubareaSpec {
  return getOuterDeckZoneDefinition(zoneId).subareas[0]!;
}

export function getUnlockedOuterDeckZoneIds(progress: { highestReachedFloorOrdinal?: number } | null | undefined): OuterDeckZoneId[] {
  const highestReachedFloorOrdinal = Math.max(0, Number(progress?.highestReachedFloorOrdinal ?? 0));
  return OUTER_DECK_ZONE_ORDER.filter((zoneId) => highestReachedFloorOrdinal >= getOuterDeckZoneDefinition(zoneId).unlockFloorOrdinal);
}

export function isOuterDeckZoneUnlocked(
  zoneId: OuterDeckZoneId,
  progress: { highestReachedFloorOrdinal?: number } | null | undefined,
): boolean {
  const highestReachedFloorOrdinal = Math.max(0, Number(progress?.highestReachedFloorOrdinal ?? 0));
  return highestReachedFloorOrdinal >= getOuterDeckZoneDefinition(zoneId).unlockFloorOrdinal;
}

export function isOuterDeckOverworldMap(mapId: string | null | undefined): boolean {
  return String(mapId ?? "") === OUTER_DECK_OVERWORLD_MAP_ID;
}

export function isOuterDeckBranchMap(mapId: string | null | undefined): boolean {
  const normalized = String(mapId ?? "");
  return getAllOuterDeckZoneDefinitions().some((zone) => zone.subareas.some((subarea) => subarea.mapId === normalized));
}

export function isOuterDeckAccessibleMap(mapId: string | null | undefined): boolean {
  return isOuterDeckOverworldMap(mapId) || isOuterDeckBranchMap(mapId);
}

export function getOuterDeckFieldContext(mapId: string | null | undefined): OuterDeckFieldContext {
  if (isOuterDeckBranchMap(mapId)) {
    return "outerDeckBranch";
  }
  if (isOuterDeckOverworldMap(mapId)) {
    return "outerDeckOverworld";
  }
  return "haven";
}

export function isOuterDeckExpeditionActive(state: GameState): boolean {
  const outerDecks = getSafeOuterDecksState(state);
  return Boolean(outerDecks.isExpeditionActive && outerDecks.activeExpedition);
}

export function getCurrentOuterDeckSubarea(state: GameState): OuterDeckSubareaSpec | null {
  const expedition = getSafeOuterDecksState(state).activeExpedition;
  if (!expedition) {
    return null;
  }
  return expedition.subareas.find((subarea) => subarea.id === expedition.currentSubareaId) ?? null;
}

export function getOuterDeckSubareaById(state: GameState, subareaId: string): OuterDeckSubareaSpec | null {
  const expeditionSubarea = getSafeOuterDecksState(state).activeExpedition?.subareas.find((subarea) => subarea.id === subareaId);
  if (expeditionSubarea) {
    return expeditionSubarea;
  }
  return getAllOuterDeckZoneDefinitions()
    .flatMap((zone) => zone.subareas)
    .find((subarea) => subarea.id === subareaId) ?? null;
}

export function getOuterDeckSubareaByMapId(state: GameState, mapId: string): OuterDeckSubareaSpec | null {
  const expeditionSubarea = getSafeOuterDecksState(state).activeExpedition?.subareas.find((subarea) => subarea.mapId === mapId);
  if (expeditionSubarea) {
    return expeditionSubarea;
  }
  return getAllOuterDeckZoneDefinitions()
    .flatMap((zone) => zone.subareas)
    .find((subarea) => subarea.mapId === mapId) ?? null;
}

export function getOuterDeckZoneIdByMapId(mapId: string): OuterDeckZoneId | null {
  return getAllOuterDeckZoneDefinitions()
    .flatMap((zone) => zone.subareas)
    .find((subarea) => subarea.mapId === mapId)?.zoneId ?? null;
}

export function isOuterDeckSubareaCleared(state: GameState, subareaId: string): boolean {
  return Boolean(getSafeOuterDecksState(state).activeExpedition?.clearedSubareaIds.includes(subareaId));
}

export function isOuterDeckMechanicResolved(state: GameState, mechanicId: OuterDeckMechanicId): boolean {
  return Boolean(getSafeOuterDecksState(state).activeExpedition?.resolvedMechanicIds.includes(mechanicId));
}

export function hasOuterDeckCacheBeenClaimed(state: GameState, cacheId: string): boolean {
  return Boolean(getSafeOuterDecksState(state).activeExpedition?.rewardCacheClaimedIds.includes(cacheId));
}

export function hasSeenOuterDeckNpcEncounter(state: GameState, encounterId: OuterDeckNpcEncounterId): boolean {
  return getSafeOuterDecksState(state).seenNpcEncounterIds.includes(encounterId);
}

export function hasOuterDeckZoneBeenReclaimed(state: GameState, zoneId: OuterDeckZoneId): boolean {
  return Math.max(0, Number(getSafeOuterDecksState(state).zoneCompletionCounts[zoneId] ?? 0)) > 0;
}

export function beginOuterDeckExpedition(
  state: GameState,
  zoneId: OuterDeckZoneId,
  startedAt: number = Date.now(),
): GameState {
  const zone = getOuterDeckZoneDefinition(zoneId);
  const expedition: OuterDeckExpeditionState = {
    expeditionId: `outerdeck_${zoneId}_${startedAt}`,
    zoneId,
    startedAt,
    currentSubareaId: zone.subareas[0]!.id,
    subareas: cloneSubareas(zone.subareas),
    clearedSubareaIds: [],
    resolvedMechanicIds: [],
    rewardCacheClaimedIds: [],
    npcEncounterIds: [],
    completionRewardClaimed: false,
  };

  return withOuterDecksState(state, {
    ...getSafeOuterDecksState(state),
    isExpeditionActive: true,
    activeExpedition: expedition,
  });
}

export function setOuterDeckCurrentSubarea(state: GameState, targetSubareaId: string): GameState {
  const outerDecks = getSafeOuterDecksState(state);
  const expedition = cloneActiveExpedition(outerDecks.activeExpedition);
  if (!expedition || !expedition.subareas.some((subarea) => subarea.id === targetSubareaId)) {
    return state;
  }

  expedition.currentSubareaId = targetSubareaId;
  return withOuterDecksState(state, {
    ...outerDecks,
    activeExpedition: expedition,
  });
}

export function markOuterDeckSubareaCleared(state: GameState, subareaId: string): GameState {
  const outerDecks = getSafeOuterDecksState(state);
  const expedition = cloneActiveExpedition(outerDecks.activeExpedition);
  if (!expedition || expedition.clearedSubareaIds.includes(subareaId)) {
    return state;
  }

  expedition.clearedSubareaIds.push(subareaId);
  return withOuterDecksState(state, {
    ...outerDecks,
    activeExpedition: expedition,
  });
}

export function resolveOuterDeckMechanic(
  state: GameState,
  mechanicId: OuterDeckMechanicId,
): GameState {
  const outerDecks = getSafeOuterDecksState(state);
  const expedition = cloneActiveExpedition(outerDecks.activeExpedition);
  if (!expedition || expedition.resolvedMechanicIds.includes(mechanicId)) {
    return state;
  }

  expedition.resolvedMechanicIds.push(mechanicId);
  return withOuterDecksState(state, {
    ...outerDecks,
    activeExpedition: expedition,
  });
}

export function markOuterDeckCacheClaimed(state: GameState, cacheId: string): GameState {
  const outerDecks = getSafeOuterDecksState(state);
  const expedition = cloneActiveExpedition(outerDecks.activeExpedition);
  if (!expedition || expedition.rewardCacheClaimedIds.includes(cacheId)) {
    return state;
  }

  expedition.rewardCacheClaimedIds.push(cacheId);
  return withOuterDecksState(state, {
    ...outerDecks,
    activeExpedition: expedition,
  });
}

export function markOuterDeckNpcEncounterSeen(
  state: GameState,
  encounterId: OuterDeckNpcEncounterId,
): GameState {
  const outerDecks = getSafeOuterDecksState(state);
  const expedition = cloneActiveExpedition(outerDecks.activeExpedition);
  const seenNpcEncounterIds = outerDecks.seenNpcEncounterIds.includes(encounterId)
    ? [...outerDecks.seenNpcEncounterIds]
    : [...outerDecks.seenNpcEncounterIds, encounterId];

  if (!expedition) {
    return withOuterDecksState(state, {
      ...outerDecks,
      seenNpcEncounterIds,
    });
  }

  if (!expedition.npcEncounterIds.includes(encounterId)) {
    expedition.npcEncounterIds.push(encounterId);
  }

  return withOuterDecksState(state, {
    ...outerDecks,
    seenNpcEncounterIds,
    activeExpedition: expedition,
  });
}

function finalizeOuterDeckExpedition(
  state: GameState,
  outcome: OuterDeckRunHistoryEntry["outcome"],
  endedAt: number,
  awardedRecipeId: string | null,
): { state: GameState; awardedRecipeId: string | null } {
  const outerDecks = getSafeOuterDecksState(state);
  const expedition = outerDecks.activeExpedition;
  if (!expedition) {
    return { state, awardedRecipeId };
  }

  const nextRunHistory = [
    ...outerDecks.runHistory,
    {
      expeditionId: expedition.expeditionId,
      zoneId: expedition.zoneId,
      startedAt: expedition.startedAt,
      endedAt,
      outcome,
      clearedSubareaIds: [...expedition.clearedSubareaIds],
    },
  ].slice(-20);

  const nextOuterDecks: OuterDecksState = {
    ...outerDecks,
    isExpeditionActive: false,
    activeExpedition: null,
    runHistory: nextRunHistory,
  };

  const nextKnownRecipeIds = awardedRecipeId && !state.knownRecipeIds.includes(awardedRecipeId)
    ? [...state.knownRecipeIds, awardedRecipeId]
    : state.knownRecipeIds;

  return {
    awardedRecipeId,
    state: {
      ...state,
      knownRecipeIds: nextKnownRecipeIds,
      outerDecks: nextOuterDecks,
    },
  };
}

export function claimOuterDeckCompletion(
  state: GameState,
  completedAt: number = Date.now(),
): { state: GameState; awardedRecipeId: string | null } {
  const outerDecks = getSafeOuterDecksState(state);
  const expedition = outerDecks.activeExpedition;
  if (!expedition) {
    return { state, awardedRecipeId: null };
  }

  const zoneId = expedition.zoneId;
  const definition = getOuterDeckZoneDefinition(zoneId);
  const firstClearAlreadyClaimed = Boolean(outerDecks.zoneFirstClearRecipeClaimed[zoneId]);
  const awardedRecipeId = !firstClearAlreadyClaimed ? definition.firstClearRecipeId : null;

  const nextOuterDecks: OuterDecksState = {
    ...outerDecks,
    zoneCompletionCounts: {
      ...outerDecks.zoneCompletionCounts,
      [zoneId]: Math.max(0, Number(outerDecks.zoneCompletionCounts[zoneId] ?? 0)) + 1,
    },
    zoneFirstClearRecipeClaimed: awardedRecipeId
      ? {
          ...outerDecks.zoneFirstClearRecipeClaimed,
          [zoneId]: true,
        }
      : { ...outerDecks.zoneFirstClearRecipeClaimed },
  };

  return finalizeOuterDeckExpedition(
    {
      ...state,
      outerDecks: nextOuterDecks,
    },
    "completed",
    completedAt,
    awardedRecipeId,
  );
}

export function abortOuterDeckExpedition(
  state: GameState,
  endedAt: number = Date.now(),
): GameState {
  return finalizeOuterDeckExpedition(state, "aborted", endedAt, null).state;
}

import type { GameState } from "./types";
import { createSeededRNG, generateSeed, randomInt } from "./rng";
import { getAllFieldModDefs } from "./fieldModDefinitions";
import type { FieldModDef, FieldModInstance, FieldModRarity } from "./fieldMods";
import {
  grantResolvedGearRewardToState,
  resolveGearRewardSpec,
  type GrantedGearReward,
} from "./gearRewards";
import { createEmptyResourceWallet, type ResourceWallet } from "./resources";
import { grantSessionResources } from "./session";

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

export interface OuterDeckOpenWorldState {
  seed: number;
  generationVersion: number;
  floorOrdinal: number;
  playerWorldX: number;
  playerWorldY: number;
  playerFacing: "north" | "south" | "east" | "west";
  streamCenterWorldX: number;
  streamCenterWorldY: number;
  streamRadiusChunks: number;
  collectedResourceKeys: string[];
  collectedTheaterChartKeys: string[];
  collectedApronKeyKeys: string[];
  defeatedEnemyKeys: string[];
  defeatedBossKeys: string[];
  bossHpByKey: Record<string, number>;
  exploredChunkKeys: string[];
  clearedInteriorRoomKeys: string[];
  claimedInteriorLootKeys: string[];
  completedInteriorKeys: string[];
  placedLanterns: OuterDeckPlacedLantern[];
}

export interface OuterDeckPlacedLantern {
  id: string;
  worldTileX: number;
  worldTileY: number;
  placedAt: number;
}

export interface OuterDecksState {
  isExpeditionActive: boolean;
  activeExpedition: OuterDeckExpeditionState | null;
  zoneCompletionCounts: Record<OuterDeckZoneId, number>;
  zoneFirstClearRecipeClaimed: Partial<Record<OuterDeckZoneId, boolean>>;
  seenNpcEncounterIds: OuterDeckNpcEncounterId[];
  runHistory: OuterDeckRunHistoryEntry[];
  openWorld: OuterDeckOpenWorldState;
  openWorldByFloor: Record<string, OuterDeckOpenWorldState>;
}

export type OuterDeckFieldContext = "haven" | "outerDeckOverworld" | "outerDeckBranch" | "outerDeckInterior";

export type OuterDeckInteriorVariant = "cave" | "structure" | "service_tunnel";

export interface OuterDeckInteriorMapRef {
  floorOrdinal: number;
  chunkX: number;
  chunkY: number;
  depth: number;
}

export interface OuterDeckInteriorSpec {
  key: string;
  floorOrdinal: number;
  chunkX: number;
  chunkY: number;
  chainLength: 2 | 3;
  variant: OuterDeckInteriorVariant;
  title: string;
  entranceLabel: string;
  cacheLabel: string;
  rewardLabel: string;
}

export interface OuterDeckInteriorCacheRewardResult {
  state: GameState;
  granted: boolean;
  alreadyClaimed: boolean;
  rewardKey: string;
  gearReward: GrantedGearReward | null;
  fieldMod: FieldModDef | null;
  wad: number;
  resources: ResourceWallet;
}

export interface OuterDeckNpcEncounterDefinition {
  id: OuterDeckNpcEncounterId;
  name: string;
  lines: string[];
}

export const OUTER_DECK_OVERWORLD_MAP_ID = "outer_deck_overworld";
export const OUTER_DECK_INTERIOR_MAP_PREFIX = "outerdeck_interior";
export const OUTER_DECK_HAVEN_EXIT_OBJECT_ID = "haven_outer_deck_south_gate";
export const OUTER_DECK_HAVEN_EXIT_ZONE_ID = "interact_haven_outer_deck_south_gate";
export const OUTER_DECK_HAVEN_EXIT_OBJECT_TILE = { x: 40, y: 48 };
export const OUTER_DECK_HAVEN_EXIT_SPAWN_TILE = { x: 41, y: 46, facing: "north" as const };
export const OUTER_DECK_OPEN_WORLD_GENERATION_VERSION = 1;
export const OUTER_DECK_OPEN_WORLD_TILE_SIZE = 64;
export const OUTER_DECK_OPEN_WORLD_CHUNK_SIZE = 24;
export const OUTER_DECK_OPEN_WORLD_STREAM_RADIUS = 2;
export const OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE = { x: 2, y: 4, facing: "south" as const };
export const OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE = { x: 1, y: 3 };
export const OUTER_DECK_OPEN_WORLD_DOME_RADIUS_TILES = 700;
export const OUTER_DECK_OVERWORLD_ENTRY_SPAWN_TILE = { x: 50, y: 52, facing: "south" as const };
export const OUTER_DECK_OVERWORLD_HAVEN_GATE_ZONE_ID = "outer_deck_overworld_return_haven";
export const OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE = { x: 0, y: 1 };
export const OUTER_DECK_OVERWORLD_TRAVELING_MERCHANT_ZONE_ID = "outer_deck_overworld_traveling_merchant";

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

const OUTER_DECK_INTERIOR_PRESENTATION: Record<
  OuterDeckInteriorVariant,
  Pick<OuterDeckInteriorSpec, "title" | "entranceLabel" | "cacheLabel" | "rewardLabel">
> = {
  cave: {
    title: "Apron Cave",
    entranceLabel: "ENTER CAVE",
    cacheLabel: "SECURE CACHE",
    rewardLabel: "Apron Cave Cache",
  },
  structure: {
    title: "Collapsed Structure",
    entranceLabel: "ENTER HATCH",
    cacheLabel: "SECURE CACHE",
    rewardLabel: "Apron Structure Cache",
  },
  service_tunnel: {
    title: "Service Tunnel",
    entranceLabel: "ENTER TUNNEL",
    cacheLabel: "SECURE CACHE",
    rewardLabel: "Apron Tunnel Cache",
  },
};

const OUTER_DECK_INTERIOR_VARIANTS: OuterDeckInteriorVariant[] = ["cave", "structure", "service_tunnel"];

function stableOuterDeckSeed(baseSeed: number, ...parts: Array<string | number>): number {
  let hash = (baseSeed >>> 0) || 2166136261;
  parts.forEach((part) => {
    const text = String(part);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 1249;
    hash = Math.imul(hash, 16777619);
  });
  return hash >>> 0;
}

function normalizeFloorOrdinal(value: number): number {
  return Math.max(1, Math.floor(Number(value) || 1));
}

function normalizeChunkCoord(value: number): number {
  return Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
}

function normalizeInteriorDepth(value: number): number {
  return Math.max(0, Math.floor(Number(value) || 0));
}

export function getOuterDeckInteriorEntranceKey(
  floorOrdinal: number,
  chunkX: number,
  chunkY: number,
): string {
  return `f${normalizeFloorOrdinal(floorOrdinal)}:cx${normalizeChunkCoord(chunkX)}:cy${normalizeChunkCoord(chunkY)}`;
}

export function getOuterDeckInteriorRoomKey(ref: OuterDeckInteriorMapRef): string {
  return `${getOuterDeckInteriorEntranceKey(ref.floorOrdinal, ref.chunkX, ref.chunkY)}:d${normalizeInteriorDepth(ref.depth)}`;
}

export function getOuterDeckInteriorLootKey(ref: Omit<OuterDeckInteriorMapRef, "depth">): string {
  return `${getOuterDeckInteriorEntranceKey(ref.floorOrdinal, ref.chunkX, ref.chunkY)}:cache`;
}

export function getOuterDeckInteriorSpec(
  seed: number,
  floorOrdinal: number,
  chunkX: number,
  chunkY: number,
): OuterDeckInteriorSpec {
  const normalizedFloor = normalizeFloorOrdinal(floorOrdinal);
  const normalizedChunkX = normalizeChunkCoord(chunkX);
  const normalizedChunkY = normalizeChunkCoord(chunkY);
  const rng = createSeededRNG(stableOuterDeckSeed(seed, "interior", normalizedFloor, normalizedChunkX, normalizedChunkY));
  const variant = OUTER_DECK_INTERIOR_VARIANTS[randomInt(rng, 0, OUTER_DECK_INTERIOR_VARIANTS.length - 1)] ?? "cave";
  const chainLength = (rng() > 0.5 ? 3 : 2) as 2 | 3;
  const presentation = OUTER_DECK_INTERIOR_PRESENTATION[variant];
  return {
    key: getOuterDeckInteriorEntranceKey(normalizedFloor, normalizedChunkX, normalizedChunkY),
    floorOrdinal: normalizedFloor,
    chunkX: normalizedChunkX,
    chunkY: normalizedChunkY,
    chainLength,
    variant,
    ...presentation,
  };
}

export function buildOuterDeckInteriorMapId(
  floorOrdinal: number,
  chunkX: number,
  chunkY: number,
  depth: number,
): string {
  return `${OUTER_DECK_INTERIOR_MAP_PREFIX}_f${normalizeFloorOrdinal(floorOrdinal)}_cx${normalizeChunkCoord(chunkX)}_cy${normalizeChunkCoord(chunkY)}_d${normalizeInteriorDepth(depth)}`;
}

export function parseOuterDeckInteriorMapId(mapId: string | null | undefined): OuterDeckInteriorMapRef | null {
  const match = String(mapId ?? "").match(/^outerdeck_interior_f(\d+)_cx(-?\d+)_cy(-?\d+)_d(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    floorOrdinal: normalizeFloorOrdinal(Number(match[1])),
    chunkX: normalizeChunkCoord(Number(match[2])),
    chunkY: normalizeChunkCoord(Number(match[3])),
    depth: normalizeInteriorDepth(Number(match[4])),
  };
}

export function isOuterDeckInteriorMap(mapId: string | null | undefined): boolean {
  return parseOuterDeckInteriorMapId(mapId) !== null;
}

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

const OUTER_DECK_LEGACY_BOSS_NPC_BY_ZONE: Record<OuterDeckZoneId, OuterDeckNpcEncounterId> = {
  counterweight_shaft: "shaft_mechanist",
  outer_scaffold: "scaffold_spotter",
  drop_bay: "dropbay_loader",
  supply_intake_port: "intake_quartermaster",
};

function createZoneCompletionCounts(): Record<OuterDeckZoneId, number> {
  return {
    counterweight_shaft: 0,
    outer_scaffold: 0,
    drop_bay: 0,
    supply_intake_port: 0,
  };
}

function createEntryWorldPosition(): Pick<OuterDeckOpenWorldState, "playerWorldX" | "playerWorldY" | "playerFacing"> {
  return {
    playerWorldX: (OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE.x + 0.5) * OUTER_DECK_OPEN_WORLD_TILE_SIZE,
    playerWorldY: (OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE.y + 0.5) * OUTER_DECK_OPEN_WORLD_TILE_SIZE,
    playerFacing: OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE.facing,
  };
}

function createEntryStreamWindow(): Pick<OuterDeckOpenWorldState, "streamCenterWorldX" | "streamCenterWorldY" | "streamRadiusChunks"> {
  return {
    streamCenterWorldX: (OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE.x + 0.5) * OUTER_DECK_OPEN_WORLD_TILE_SIZE,
    streamCenterWorldY: (OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE.y + 0.5) * OUTER_DECK_OPEN_WORLD_TILE_SIZE,
    streamRadiusChunks: OUTER_DECK_OPEN_WORLD_STREAM_RADIUS,
  };
}

export function createDefaultOuterDeckOpenWorldState(
  seed: number = generateSeed(),
  floorOrdinal = 1,
): OuterDeckOpenWorldState {
  return {
    seed,
    generationVersion: OUTER_DECK_OPEN_WORLD_GENERATION_VERSION,
    floorOrdinal: Math.max(1, Math.floor(Number(floorOrdinal) || 1)),
    ...createEntryWorldPosition(),
    ...createEntryStreamWindow(),
    collectedResourceKeys: [],
    collectedTheaterChartKeys: [],
    collectedApronKeyKeys: [],
    defeatedEnemyKeys: [],
    defeatedBossKeys: [],
    bossHpByKey: {},
    exploredChunkKeys: [],
    clearedInteriorRoomKeys: [],
    claimedInteriorLootKeys: [],
    completedInteriorKeys: [],
    placedLanterns: [],
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.flatMap((entry) => {
    if (typeof entry !== "string") {
      return [];
    }
    const trimmed = entry.trim();
    return trimmed ? [trimmed] : [];
  })));
}

function normalizeNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, amount]) => {
      const numeric = Number(amount);
      return key && Number.isFinite(numeric) && numeric > 0 ? [[key, numeric]] : [];
    }),
  );
}

function normalizePlacedLanterns(value: unknown): OuterDeckPlacedLantern[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const raw = entry as Partial<OuterDeckPlacedLantern>;
    const worldTileX = Number(raw.worldTileX);
    const worldTileY = Number(raw.worldTileY);
    if (!Number.isFinite(worldTileX) || !Number.isFinite(worldTileY)) {
      return [];
    }

    const normalizedX = Math.floor(worldTileX);
    const normalizedY = Math.floor(worldTileY);
    const id = String(raw.id ?? `lantern:${normalizedX}:${normalizedY}`).trim();
    const dedupeKey = `${normalizedX}:${normalizedY}`;
    if (!id || seen.has(dedupeKey)) {
      return [];
    }

    seen.add(dedupeKey);
    return [{
      id,
      worldTileX: normalizedX,
      worldTileY: normalizedY,
      placedAt: Number.isFinite(Number(raw.placedAt)) ? Number(raw.placedAt) : Date.now(),
    }];
  });
}

function getOpenWorldFloorKey(floorOrdinal: number): string {
  return String(Math.max(1, Math.floor(Number(floorOrdinal) || 1)));
}

function normalizeOpenWorldStreamRadius(value: unknown): number {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric >= OUTER_DECK_OPEN_WORLD_STREAM_RADIUS
    ? numeric
    : OUTER_DECK_OPEN_WORLD_STREAM_RADIUS;
}

function normalizeOuterDeckOpenWorldState(openWorld?: Partial<OuterDeckOpenWorldState> | null): OuterDeckOpenWorldState {
  const fallback = createDefaultOuterDeckOpenWorldState();
  return {
    seed: Number.isFinite(Number(openWorld?.seed)) ? Number(openWorld?.seed) : fallback.seed,
    generationVersion: OUTER_DECK_OPEN_WORLD_GENERATION_VERSION,
    floorOrdinal: Math.max(1, Math.floor(Number(openWorld?.floorOrdinal ?? fallback.floorOrdinal) || 1)),
    playerWorldX: Number.isFinite(Number(openWorld?.playerWorldX)) ? Number(openWorld?.playerWorldX) : fallback.playerWorldX,
    playerWorldY: Number.isFinite(Number(openWorld?.playerWorldY)) ? Number(openWorld?.playerWorldY) : fallback.playerWorldY,
    playerFacing:
      openWorld?.playerFacing === "north"
      || openWorld?.playerFacing === "south"
      || openWorld?.playerFacing === "east"
      || openWorld?.playerFacing === "west"
        ? openWorld.playerFacing
        : fallback.playerFacing,
    streamCenterWorldX: Number.isFinite(Number(openWorld?.streamCenterWorldX))
      ? Number(openWorld?.streamCenterWorldX)
      : Number.isFinite(Number(openWorld?.playerWorldX))
        ? Number(openWorld?.playerWorldX)
        : fallback.streamCenterWorldX,
    streamCenterWorldY: Number.isFinite(Number(openWorld?.streamCenterWorldY))
      ? Number(openWorld?.streamCenterWorldY)
      : Number.isFinite(Number(openWorld?.playerWorldY))
        ? Number(openWorld?.playerWorldY)
        : fallback.streamCenterWorldY,
    streamRadiusChunks: normalizeOpenWorldStreamRadius(openWorld?.streamRadiusChunks),
    collectedResourceKeys: normalizeStringList(openWorld?.collectedResourceKeys),
    collectedTheaterChartKeys: normalizeStringList(openWorld?.collectedTheaterChartKeys),
    collectedApronKeyKeys: normalizeStringList(openWorld?.collectedApronKeyKeys),
    defeatedEnemyKeys: normalizeStringList(openWorld?.defeatedEnemyKeys),
    defeatedBossKeys: normalizeStringList(openWorld?.defeatedBossKeys),
    bossHpByKey: normalizeNumberRecord(openWorld?.bossHpByKey),
    exploredChunkKeys: normalizeStringList(openWorld?.exploredChunkKeys),
    clearedInteriorRoomKeys: normalizeStringList(openWorld?.clearedInteriorRoomKeys),
    claimedInteriorLootKeys: normalizeStringList(openWorld?.claimedInteriorLootKeys),
    completedInteriorKeys: normalizeStringList(openWorld?.completedInteriorKeys),
    placedLanterns: normalizePlacedLanterns(openWorld?.placedLanterns),
  };
}

function normalizeOpenWorldByFloor(
  value: unknown,
  activeOpenWorld: OuterDeckOpenWorldState,
): Record<string, OuterDeckOpenWorldState> {
  const archive: Record<string, OuterDeckOpenWorldState> = {};

  if (value && typeof value === "object") {
    Object.entries(value as Record<string, Partial<OuterDeckOpenWorldState> | null | undefined>).forEach(([rawKey, rawOpenWorld]) => {
      const floorOrdinal = Math.max(
        1,
        Math.floor(Number(rawOpenWorld?.floorOrdinal ?? rawKey) || 1),
      );
      const key = getOpenWorldFloorKey(floorOrdinal);
      archive[key] = {
        ...normalizeOuterDeckOpenWorldState(rawOpenWorld),
        floorOrdinal,
      };
    });
  }

  archive[getOpenWorldFloorKey(activeOpenWorld.floorOrdinal)] = activeOpenWorld;
  return archive;
}

function normalizeOuterDecksState(outerDecks?: Partial<OuterDecksState> | null): OuterDecksState {
  const defaultOpenWorld = createDefaultOuterDeckOpenWorldState();
  const openWorld = normalizeOuterDeckOpenWorldState(outerDecks?.openWorld ?? defaultOpenWorld);
  const defaults = {
    isExpeditionActive: false,
    activeExpedition: null,
    zoneCompletionCounts: createZoneCompletionCounts(),
    zoneFirstClearRecipeClaimed: {},
    seenNpcEncounterIds: [],
    runHistory: [],
    openWorld: defaultOpenWorld,
  };

  return {
    isExpeditionActive: Boolean(outerDecks?.isExpeditionActive && outerDecks.activeExpedition),
    activeExpedition: cloneActiveExpedition(outerDecks?.activeExpedition ?? null),
    zoneCompletionCounts: {
      ...defaults.zoneCompletionCounts,
      ...(outerDecks?.zoneCompletionCounts ?? {}),
    },
    zoneFirstClearRecipeClaimed: { ...(outerDecks?.zoneFirstClearRecipeClaimed ?? {}) },
    seenNpcEncounterIds: normalizeStringList(outerDecks?.seenNpcEncounterIds) as OuterDeckNpcEncounterId[],
    runHistory: Array.isArray(outerDecks?.runHistory)
      ? outerDecks.runHistory.slice(-20).map((entry) => ({
          ...entry,
          clearedSubareaIds: [...(entry.clearedSubareaIds ?? [])],
        }))
      : [],
    openWorld,
    openWorldByFloor: normalizeOpenWorldByFloor(outerDecks?.openWorldByFloor, openWorld),
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
    outerDecks: normalizeOuterDecksState(outerDecks),
  };
}

function getSafeOuterDecksState(state: GameState): OuterDecksState {
  return normalizeOuterDecksState(state.outerDecks);
}

export function createDefaultOuterDecksState(): OuterDecksState {
  return normalizeOuterDecksState(null);
}

export function withNormalizedOuterDecksState<T extends GameState>(state: T): T {
  const normalized = normalizeOuterDecksState(state.outerDecks);
  if (state.outerDecks === normalized) {
    return state;
  }
  return {
    ...state,
    outerDecks: normalized,
  };
}

export function getOuterDeckOpenWorldState(state: GameState): OuterDeckOpenWorldState {
  return getSafeOuterDecksState(state).openWorld;
}

export function ensureOuterDeckOpenWorldState(state: GameState): GameState {
  return withOuterDecksState(state, getSafeOuterDecksState(state));
}

export function prepareOuterDeckOpenWorldEntry(state: GameState, floorOrdinal?: number): GameState {
  const outerDecks = getSafeOuterDecksState(state);
  const resolvedFloorOrdinal = Math.max(1, Math.floor(Number(floorOrdinal ?? outerDecks.openWorld.floorOrdinal ?? 1) || 1));
  const activeFloorKey = getOpenWorldFloorKey(outerDecks.openWorld.floorOrdinal);
  const targetFloorKey = getOpenWorldFloorKey(resolvedFloorOrdinal);
  const openWorldByFloor = {
    ...outerDecks.openWorldByFloor,
    [activeFloorKey]: outerDecks.openWorld,
  };
  const floorOpenWorld = openWorldByFloor[targetFloorKey]
    ? {
        ...openWorldByFloor[targetFloorKey],
        floorOrdinal: resolvedFloorOrdinal,
      }
    : createDefaultOuterDeckOpenWorldState(generateSeed(), resolvedFloorOrdinal);
  return withOuterDecksState(state, {
    ...outerDecks,
    isExpeditionActive: false,
    activeExpedition: null,
    openWorldByFloor: {
      ...openWorldByFloor,
      [targetFloorKey]: floorOpenWorld,
    },
    openWorld: {
      ...floorOpenWorld,
      floorOrdinal: resolvedFloorOrdinal,
      ...createEntryWorldPosition(),
      ...createEntryStreamWindow(),
    },
  });
}

export function setOuterDeckOpenWorldPlayerWorldPosition(
  state: GameState,
  playerWorldX: number,
  playerWorldY: number,
  playerFacing: "north" | "south" | "east" | "west" = getOuterDeckOpenWorldState(state).playerFacing,
): GameState {
  const outerDecks = getSafeOuterDecksState(state);
  const nextOpenWorld: OuterDeckOpenWorldState = {
    ...outerDecks.openWorld,
    playerWorldX: Number.isFinite(playerWorldX) ? playerWorldX : outerDecks.openWorld.playerWorldX,
    playerWorldY: Number.isFinite(playerWorldY) ? playerWorldY : outerDecks.openWorld.playerWorldY,
    playerFacing,
  };

  if (
    nextOpenWorld.playerWorldX === outerDecks.openWorld.playerWorldX
    && nextOpenWorld.playerWorldY === outerDecks.openWorld.playerWorldY
    && nextOpenWorld.playerFacing === outerDecks.openWorld.playerFacing
  ) {
    return state;
  }

  return withOuterDecksState(state, {
    ...outerDecks,
    openWorld: nextOpenWorld,
  });
}

export function setOuterDeckOpenWorldStreamWindow(
  state: GameState,
  centerWorldX: number,
  centerWorldY: number,
  radiusChunks: number,
): GameState {
  const outerDecks = getSafeOuterDecksState(state);
  const nextOpenWorld: OuterDeckOpenWorldState = {
    ...outerDecks.openWorld,
    streamCenterWorldX: Number.isFinite(centerWorldX) ? centerWorldX : outerDecks.openWorld.streamCenterWorldX,
    streamCenterWorldY: Number.isFinite(centerWorldY) ? centerWorldY : outerDecks.openWorld.streamCenterWorldY,
    streamRadiusChunks: normalizeOpenWorldStreamRadius(radiusChunks),
  };

  if (
    nextOpenWorld.streamCenterWorldX === outerDecks.openWorld.streamCenterWorldX
    && nextOpenWorld.streamCenterWorldY === outerDecks.openWorld.streamCenterWorldY
    && nextOpenWorld.streamRadiusChunks === outerDecks.openWorld.streamRadiusChunks
  ) {
    return state;
  }

  return withOuterDecksState(state, {
    ...outerDecks,
    openWorld: nextOpenWorld,
  });
}

function addOpenWorldKey(
  state: GameState,
  collectionKey:
    | "collectedResourceKeys"
    | "collectedTheaterChartKeys"
    | "collectedApronKeyKeys"
    | "defeatedEnemyKeys"
    | "defeatedBossKeys"
    | "exploredChunkKeys"
    | "clearedInteriorRoomKeys"
    | "claimedInteriorLootKeys"
    | "completedInteriorKeys",
  key: string,
): GameState {
  const normalizedKey = key.trim();
  if (!normalizedKey) {
    return state;
  }

  const outerDecks = getSafeOuterDecksState(state);
  const current = outerDecks.openWorld[collectionKey] ?? [];
  if (current.includes(normalizedKey)) {
    return state;
  }

  return withOuterDecksState(state, {
    ...outerDecks,
    openWorld: {
      ...outerDecks.openWorld,
      [collectionKey]: [...current, normalizedKey],
    },
  });
}

export function markOuterDeckOpenWorldResourceCollected(state: GameState, resourceKey: string): GameState {
  return addOpenWorldKey(state, "collectedResourceKeys", resourceKey);
}

export function markOuterDeckOpenWorldTheaterChartCollected(state: GameState, chartKey: string): GameState {
  return addOpenWorldKey(state, "collectedTheaterChartKeys", chartKey);
}

export function markOuterDeckOpenWorldApronKeyCollected(state: GameState, key: string): GameState {
  return addOpenWorldKey(state, "collectedApronKeyKeys", key);
}

export function placeOuterDeckOpenWorldLantern(
  state: GameState,
  lantern: Omit<OuterDeckPlacedLantern, "placedAt"> & { placedAt?: number },
): GameState {
  const worldTileX = Math.floor(Number(lantern.worldTileX));
  const worldTileY = Math.floor(Number(lantern.worldTileY));
  if (!Number.isFinite(worldTileX) || !Number.isFinite(worldTileY)) {
    return state;
  }

  const outerDecks = getSafeOuterDecksState(state);
  const tileKey = `${worldTileX}:${worldTileY}`;
  if (outerDecks.openWorld.placedLanterns.some((entry) => `${entry.worldTileX}:${entry.worldTileY}` === tileKey)) {
    return state;
  }

  const nextLantern: OuterDeckPlacedLantern = {
    id: String(lantern.id || `lantern:${tileKey}`).trim() || `lantern:${tileKey}`,
    worldTileX,
    worldTileY,
    placedAt: Number.isFinite(Number(lantern.placedAt)) ? Number(lantern.placedAt) : Date.now(),
  };

  return withOuterDecksState(state, {
    ...outerDecks,
    openWorld: {
      ...outerDecks.openWorld,
      placedLanterns: [...outerDecks.openWorld.placedLanterns, nextLantern],
    },
  });
}

export function markOuterDeckOpenWorldEnemyDefeated(state: GameState, enemyKey: string): GameState {
  return addOpenWorldKey(state, "defeatedEnemyKeys", enemyKey);
}

export function markOuterDeckOpenWorldChunkExplored(state: GameState, chunkKey: string): GameState {
  return addOpenWorldKey(state, "exploredChunkKeys", chunkKey);
}

export function markOuterDeckInteriorRoomCleared(state: GameState, roomKey: string): GameState {
  return addOpenWorldKey(state, "clearedInteriorRoomKeys", roomKey);
}

export function markOuterDeckInteriorLootClaimed(state: GameState, lootKey: string): GameState {
  let nextState = addOpenWorldKey(state, "claimedInteriorLootKeys", lootKey);
  const completedKey = lootKey.replace(/:cache$/, "");
  if (completedKey && completedKey !== lootKey) {
    nextState = addOpenWorldKey(nextState, "completedInteriorKeys", completedKey);
  }
  return nextState;
}

export function setOuterDeckOpenWorldBossHp(state: GameState, bossKey: string, hp: number | null): GameState {
  const normalizedKey = bossKey.trim();
  if (!normalizedKey) {
    return state;
  }

  const outerDecks = getSafeOuterDecksState(state);
  const nextBossHpByKey = { ...outerDecks.openWorld.bossHpByKey };
  if (hp === null || !Number.isFinite(hp) || hp <= 0) {
    delete nextBossHpByKey[normalizedKey];
  } else {
    nextBossHpByKey[normalizedKey] = hp;
  }

  if (JSON.stringify(nextBossHpByKey) === JSON.stringify(outerDecks.openWorld.bossHpByKey)) {
    return state;
  }

  return withOuterDecksState(state, {
    ...outerDecks,
    openWorld: {
      ...outerDecks.openWorld,
      bossHpByKey: nextBossHpByKey,
    },
  });
}

function getOuterDeckInteriorDistanceTier(ref: Pick<OuterDeckInteriorMapRef, "chunkX" | "chunkY">): number {
  return Math.max(0, Math.floor(Math.hypot(ref.chunkX, ref.chunkY)));
}

function getOuterDeckInteriorRewardResources(
  spec: OuterDeckInteriorSpec,
  distanceTier: number,
): ResourceWallet {
  const resources = createEmptyResourceWallet();
  const baseAmount = Math.max(1, 1 + Math.floor(distanceTier / 3));
  switch (spec.variant) {
    case "cave":
      resources.chaosShards = baseAmount;
      resources.metalScrap = distanceTier >= 4 ? 1 : 0;
      break;
    case "structure":
      resources.metalScrap = baseAmount + 1;
      resources.steamComponents = distanceTier >= 3 ? 1 : 0;
      break;
    case "service_tunnel":
      resources.steamComponents = baseAmount;
      resources.wood = distanceTier >= 3 ? 1 : 0;
      break;
  }
  return resources;
}

function getFieldModInventory(state: GameState): FieldModInstance[] {
  return [...(state.runFieldModInventory ?? [])];
}

function canAddFieldModStack(mod: FieldModDef, inventory: FieldModInstance[]): boolean {
  const existing = inventory.find((entry) => entry.defId === mod.id);
  const maxStacks = Math.max(1, Number(mod.maxStacks ?? 99));
  return !existing || existing.stacks < maxStacks;
}

function pickOuterDeckInteriorFieldMod(
  state: GameState,
  floorOrdinal: number,
  seed: number,
): FieldModDef | null {
  const rng = createSeededRNG(seed);
  if (rng() >= 0.3) {
    return null;
  }

  const inventory = getFieldModInventory(state);
  const allEligible = getAllFieldModDefs().filter((mod) => (
    Math.max(1, Number(mod.unlockAfterOperationFloor ?? 1)) <= floorOrdinal
    && canAddFieldModStack(mod, inventory)
  ));
  if (allEligible.length === 0) {
    return null;
  }

  const weights: Record<FieldModRarity, number> = {
    common: 45,
    uncommon: 40,
    rare: 15,
  };
  const rarityOrder: FieldModRarity[] = ["common", "uncommon", "rare"];
  const totalWeight = rarityOrder.reduce((sum, rarity) => sum + weights[rarity], 0);
  let roll = rng() * totalWeight;
  let rarity: FieldModRarity = "common";
  for (const candidateRarity of rarityOrder) {
    roll -= weights[candidateRarity];
    if (roll <= 0) {
      rarity = candidateRarity;
      break;
    }
  }

  const rarityPool = allEligible.filter((mod) => mod.rarity === rarity);
  const pool = rarityPool.length > 0 ? rarityPool : allEligible;
  return pool[randomInt(rng, 0, pool.length - 1)] ?? null;
}

function grantFieldModToRunInventory(
  state: GameState,
  mod: FieldModDef,
  instanceSeed: string,
): GameState {
  const inventory = getFieldModInventory(state);
  const existingIndex = inventory.findIndex((entry) => entry.defId === mod.id);
  const maxStacks = Math.max(1, Number(mod.maxStacks ?? 99));

  if (existingIndex >= 0) {
    const existing = inventory[existingIndex]!;
    inventory[existingIndex] = {
      ...existing,
      stacks: Math.min(maxStacks, Math.max(1, existing.stacks) + 1),
    };
  } else {
    inventory.push({
      defId: mod.id,
      stacks: 1,
      instanceId: `${mod.id}_${instanceSeed.replace(/[^a-z0-9_-]/gi, "_")}`,
    });
  }

  return {
    ...state,
    runFieldModInventory: inventory,
  };
}

export function grantOuterDeckInteriorCacheReward(
  state: GameState,
  mapIdOrRef: string | OuterDeckInteriorMapRef,
): OuterDeckInteriorCacheRewardResult {
  const ref = typeof mapIdOrRef === "string" ? parseOuterDeckInteriorMapId(mapIdOrRef) : mapIdOrRef;
  const emptyResources = createEmptyResourceWallet();
  if (!ref) {
    return {
      state,
      granted: false,
      alreadyClaimed: false,
      rewardKey: "",
      gearReward: null,
      fieldMod: null,
      wad: 0,
      resources: emptyResources,
    };
  }

  const rewardKey = getOuterDeckInteriorLootKey(ref);
  const outerDecks = getSafeOuterDecksState(state);
  if (outerDecks.openWorld.claimedInteriorLootKeys.includes(rewardKey)) {
    return {
      state,
      granted: false,
      alreadyClaimed: true,
      rewardKey,
      gearReward: null,
      fieldMod: null,
      wad: 0,
      resources: emptyResources,
    };
  }

  const spec = getOuterDeckInteriorSpec(outerDecks.openWorld.seed, ref.floorOrdinal, ref.chunkX, ref.chunkY);
  const distanceTier = getOuterDeckInteriorDistanceTier(ref);
  const rewardSeed = stableOuterDeckSeed(
    outerDecks.openWorld.seed,
    "interior-cache",
    ref.floorOrdinal,
    ref.chunkX,
    ref.chunkY,
    ref.depth,
  );
  const rng = createSeededRNG(rewardSeed);
  const slotPool = ["weapon", "helmet", "chestpiece", "accessory"] as const;
  const slotType = slotPool[randomInt(rng, 0, slotPool.length - 1)] ?? "weapon";
  const minStability = Math.min(78, 50 + ref.floorOrdinal + (distanceTier * 3));
  const gearReward = resolveGearRewardSpec({
    kind: "generated",
    slotType,
    minStability,
    seed: stableOuterDeckSeed(rewardSeed, "gear"),
    label: spec.rewardLabel,
  }, state);
  const resources = getOuterDeckInteriorRewardResources(spec, distanceTier);
  const wad = 30 + (ref.floorOrdinal * 2) + (distanceTier * 7) + (spec.chainLength === 3 ? 8 : 0);

  let nextState = gearReward ? grantResolvedGearRewardToState(state, gearReward) : state;
  nextState = grantSessionResources(nextState, { wad, resources });

  const fieldMod = pickOuterDeckInteriorFieldMod(
    nextState,
    ref.floorOrdinal,
    stableOuterDeckSeed(rewardSeed, "field-mod"),
  );
  if (fieldMod) {
    nextState = grantFieldModToRunInventory(nextState, fieldMod, rewardKey);
  }

  nextState = markOuterDeckInteriorLootClaimed(nextState, rewardKey);

  return {
    state: nextState,
    granted: true,
    alreadyClaimed: false,
    rewardKey,
    gearReward,
    fieldMod,
    wad,
    resources,
  };
}

export function claimOuterDeckWorldBossDefeat(
  state: GameState,
  bossKey: string,
  zoneId?: OuterDeckZoneId | null,
): { state: GameState; awardedRecipeId: string | null } {
  const normalizedBossKey = bossKey.trim();
  if (!normalizedBossKey) {
    return { state, awardedRecipeId: null };
  }

  const outerDecks = getSafeOuterDecksState(state);
  if (outerDecks.openWorld.defeatedBossKeys.includes(normalizedBossKey)) {
    return {
      state: setOuterDeckOpenWorldBossHp(state, normalizedBossKey, null),
      awardedRecipeId: null,
    };
  }

  const nextBossHpByKey = { ...outerDecks.openWorld.bossHpByKey };
  delete nextBossHpByKey[normalizedBossKey];

  let awardedRecipeId: string | null = null;
  let nextKnownRecipeIds = state.knownRecipeIds;
  let zoneCompletionCounts = { ...outerDecks.zoneCompletionCounts };
  let zoneFirstClearRecipeClaimed = { ...outerDecks.zoneFirstClearRecipeClaimed };
  let seenNpcEncounterIds = [...outerDecks.seenNpcEncounterIds];

  if (zoneId && OUTER_DECK_ZONE_DEFINITIONS[zoneId]) {
    const definition = getOuterDeckZoneDefinition(zoneId);
    zoneCompletionCounts = {
      ...zoneCompletionCounts,
      [zoneId]: Math.max(0, Number(zoneCompletionCounts[zoneId] ?? 0)) + 1,
    };

    if (!zoneFirstClearRecipeClaimed[zoneId] && definition.firstClearRecipeId) {
      awardedRecipeId = definition.firstClearRecipeId;
      zoneFirstClearRecipeClaimed = {
        ...zoneFirstClearRecipeClaimed,
        [zoneId]: true,
      };
      nextKnownRecipeIds = state.knownRecipeIds.includes(definition.firstClearRecipeId)
        ? state.knownRecipeIds
        : [...state.knownRecipeIds, definition.firstClearRecipeId];
    }

    const encounterId = OUTER_DECK_LEGACY_BOSS_NPC_BY_ZONE[zoneId];
    if (!seenNpcEncounterIds.includes(encounterId)) {
      seenNpcEncounterIds = [...seenNpcEncounterIds, encounterId];
    }
  }

  return {
    awardedRecipeId,
    state: {
      ...state,
      knownRecipeIds: nextKnownRecipeIds,
      outerDecks: normalizeOuterDecksState({
        ...outerDecks,
        zoneCompletionCounts,
        zoneFirstClearRecipeClaimed,
        seenNpcEncounterIds,
        openWorld: {
          ...outerDecks.openWorld,
          defeatedBossKeys: [...outerDecks.openWorld.defeatedBossKeys, normalizedBossKey],
          bossHpByKey: nextBossHpByKey,
        },
      }),
    },
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
  return isOuterDeckOverworldMap(mapId) || isOuterDeckBranchMap(mapId) || isOuterDeckInteriorMap(mapId);
}

export function getOuterDeckFieldContext(mapId: string | null | undefined): OuterDeckFieldContext {
  if (isOuterDeckInteriorMap(mapId)) {
    return "outerDeckInterior";
  }
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

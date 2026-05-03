import type { GameState } from "../core/types";
import {
  OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE,
  OUTER_DECK_OPEN_WORLD_DOME_RADIUS_TILES,
  OUTER_DECK_OPEN_WORLD_CHUNK_SIZE,
  OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE,
  OUTER_DECK_OPEN_WORLD_GENERATION_VERSION,
  OUTER_DECK_OPEN_WORLD_STREAM_RADIUS,
  OUTER_DECK_OPEN_WORLD_TILE_SIZE,
  OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE,
  OUTER_DECK_OVERWORLD_HAVEN_GATE_ZONE_ID,
  OUTER_DECK_OVERWORLD_MAP_ID,
  OUTER_DECK_OVERWORLD_TRAVELING_MERCHANT_ZONE_ID,
  buildOuterDeckInteriorMapId,
  getOuterDeckInteriorSpec,
  getOuterDeckOpenWorldState,
  type OuterDeckInteriorVariant,
  type OuterDeckOpenWorldState,
  type OuterDeckRewardBundle,
  type OuterDeckZoneId,
} from "../core/outerDecks";
import type { FieldMap, FieldObject, InteractionZone } from "./types";

type TileType = FieldMap["tiles"][number][number]["type"];

export type OuterDeckStreamMetadata = {
  kind: "outerDeckOpenWorld";
  generationVersion: number;
  seed: number;
  floorOrdinal: number;
  worldOriginTileX: number;
  worldOriginTileY: number;
  centerChunkX: number;
  centerChunkY: number;
  chunkSize: number;
  streamRadius: number;
  tileSize: number;
  finiteDome?: boolean;
  domeCenterWorldTileX?: number;
  domeCenterWorldTileY?: number;
  domeRadiusTiles?: number;
};

type GeneratedTile = FieldMap["tiles"][number][number];

type ResourceSpec = {
  resourceType: "metalScrap" | "wood" | "chaosShards" | "steamComponents";
  name: string;
};

type ApronPickupSpec = {
  pickupType: "theaterChart" | "apronKey";
  name: string;
  sprite: string;
  persistentKeyPrefix: string;
  collectedKeys: keyof Pick<OuterDeckOpenWorldState, "collectedTheaterChartKeys" | "collectedApronKeyKeys">;
};

type BossSpec = {
  zoneId: OuterDeckZoneId | null;
  archetype: string;
  name: string;
  enemyKind: string;
  drops: OuterDeckRewardBundle;
};

type GrappleRouteNode = {
  id: string;
  localX: number;
  localY: number;
  worldTileX: number;
  worldTileY: number;
  elevation: number;
  anchorHeight: number;
  candidateIndex: number;
};

type ZiplineTraversalNeed = {
  kind: "chasm" | "elevation";
  spanTiles: number;
  elevationDelta: number;
  blockedTiles: number;
  maxContiguousBlockedTiles: number;
  score: number;
};

type ZiplineSegmentPlan = {
  start: GrappleRouteNode;
  end: GrappleRouteNode;
  need: ZiplineTraversalNeed;
  score: number;
};

type GrindRailSegmentPlan = {
  start: GrappleRouteNode;
  end: GrappleRouteNode;
  need: ZiplineTraversalNeed;
  score: number;
};

type RouteCandidateTile = {
  localX: number;
  localY: number;
  worldTileX: number;
  worldTileY: number;
  elevation: number;
  hazardScore: number;
  randomScore: number;
};

export type OuterDeckInteriorEntranceSignal = {
  chunkX: number;
  chunkY: number;
  worldTileX: number;
  worldTileY: number;
  worldX: number;
  worldY: number;
  distancePx: number;
  variant: OuterDeckInteriorVariant;
  title: string;
  entranceLabel: string;
  completed: boolean;
};

const TILE_SIZE = OUTER_DECK_OPEN_WORLD_TILE_SIZE;
const OUTER_DECK_MAX_ELEVATION = 136;
const APRON_DOME_WALL_THICKNESS_TILES = 3;
const APRON_DOME_VISIBLE_OUTER_MARGIN_TILES = 1.25;
const APRON_DOME_OUTER_WALL_ELEVATION = 76;
const OUTER_DECK_DYNAMIC_STREAM_EXTRA_MARGIN_CHUNKS = 1;
const OUTER_DECK_MAX_DYNAMIC_STREAM_RADIUS = 8;

type OuterDeckStreamFocus = {
  x: number;
  y: number;
};

const LEGACY_BOSS_CHUNKS: Record<string, OuterDeckZoneId> = {
  "0:-2": "counterweight_shaft",
  "2:0": "outer_scaffold",
  "0:2": "drop_bay",
  "-2:0": "supply_intake_port",
};

const LEGACY_BOSS_SPECS: Record<OuterDeckZoneId, BossSpec> = {
  counterweight_shaft: {
    zoneId: "counterweight_shaft",
    archetype: "counterweight",
    name: "Counterweight Behemoth",
    enemyKind: "counterweight_world_boss",
    drops: { wad: 120, resources: { metalScrap: 4, steamComponents: 3 } },
  },
  outer_scaffold: {
    zoneId: "outer_scaffold",
    archetype: "scaffold",
    name: "Scaffold Crown Warden",
    enemyKind: "scaffold_world_boss",
    drops: { wad: 132, resources: { wood: 4, steamComponents: 3 } },
  },
  drop_bay: {
    zoneId: "drop_bay",
    archetype: "dropbay",
    name: "Drop Bay Hullbreaker",
    enemyKind: "dropbay_world_boss",
    drops: { wad: 144, resources: { metalScrap: 4, wood: 3, steamComponents: 2 } },
  },
  supply_intake_port: {
    zoneId: "supply_intake_port",
    archetype: "intake",
    name: "Intake Port Devourer",
    enemyKind: "intake_world_boss",
    drops: { wad: 156, resources: { chaosShards: 3, steamComponents: 3, wood: 2 } },
  },
};

const FAR_BOSS_SPECS: BossSpec[] = [
  {
    zoneId: null,
    archetype: "counterweight",
    name: "Loose Counterweight Titan",
    enemyKind: "counterweight_far_boss",
    drops: { wad: 110, resources: { metalScrap: 3, steamComponents: 2 } },
  },
  {
    zoneId: null,
    archetype: "scaffold",
    name: "High Scaffold Marauder",
    enemyKind: "scaffold_far_boss",
    drops: { wad: 118, resources: { wood: 3, steamComponents: 2 } },
  },
  {
    zoneId: null,
    archetype: "dropbay",
    name: "Freight Maw Brute",
    enemyKind: "dropbay_far_boss",
    drops: { wad: 126, resources: { metalScrap: 3, wood: 2 } },
  },
  {
    zoneId: null,
    archetype: "intake",
    name: "Sorting Lattice Horror",
    enemyKind: "intake_far_boss",
    drops: { wad: 134, resources: { chaosShards: 2, steamComponents: 2 } },
  },
];

const RESOURCE_SPECS: ResourceSpec[] = [
  { resourceType: "metalScrap", name: "Loose Deck Scrap" },
  { resourceType: "wood", name: "Scaffold Timber" },
  { resourceType: "steamComponents", name: "Pressure Fittings" },
  { resourceType: "chaosShards", name: "Chaos Glass" },
];

const THEATER_CHART_PICKUP: ApronPickupSpec = {
  pickupType: "theaterChart",
  name: "Theater Chart",
  sprite: "theater_chart",
  persistentKeyPrefix: "theater_chart",
  collectedKeys: "collectedTheaterChartKeys",
};

const APRON_KEY_PICKUP: ApronPickupSpec = {
  pickupType: "apronKey",
  name: "Apron Key",
  sprite: "apron_key",
  persistentKeyPrefix: "apron_key",
  collectedKeys: "collectedApronKeyKeys",
};

const ENEMY_KINDS = [
  "deck_scavenger",
  "maintenance_drone",
  "climbing_scavenger",
  "scaffold_sniper",
  "cargo_looter",
  "sort_bot",
  "containment_beast",
  "industrial_construct",
] as const;

const OUTER_DECK_ROAMING_ENEMY_DENSITY = 0.2;
const OUTER_DECK_INTERIOR_SUPERCELL_SIZE = 3;
const OUTER_DECK_INTERIOR_SPAWN_THRESHOLD = 0.48;
const OUTER_DECK_GRAPPLE_ROUTE_CHUNK_STRIDE = 5;
const OUTER_DECK_GRIND_RAIL_ROUTE_CHUNK_STRIDE = 2;
const OUTER_DECK_GRIND_RAIL_MAX_SEGMENTS_PER_CHUNK = 2;
const OUTER_DECK_GRIND_RAIL_MIN_SPAN_TILES = 5;
const OUTER_DECK_GRIND_RAIL_CHASM_MIN_SPAN_TILES = 5;
const OUTER_DECK_GRIND_RAIL_CHASM_MIN_BLOCKED_TILES = 2;
const OUTER_DECK_GRIND_RAIL_CHASM_MIN_CONTIGUOUS_BLOCKED_TILES = 1;
const OUTER_DECK_GRIND_RAIL_ELEVATION_DELTA = 8;
const OUTER_DECK_ZIPLINE_MAX_SEGMENTS_PER_ROUTE = 1;
const OUTER_DECK_ZIPLINE_MIN_SPAN_TILES = 6;
const OUTER_DECK_ZIPLINE_CHASM_MIN_SPAN_TILES = 8;
const OUTER_DECK_ZIPLINE_CHASM_MIN_BLOCKED_TILES = 3;
const OUTER_DECK_ZIPLINE_CHASM_MIN_CONTIGUOUS_BLOCKED_TILES = 2;
const OUTER_DECK_ZIPLINE_MASSIVE_ELEVATION_DELTA = 18;
const OUTER_DECK_ZIPLINE_CANDIDATE_POOL_LIMIT = 24;
const APRON_PLACED_LANTERN_LIGHT_RADIUS_PX = 390;
const APRON_HAVEN_ENTRY_LAMP_LIGHT_RADIUS_PX = 340;
const HAVEN_CARGO_ELEVATOR_EXTERIOR = {
  worldX: -40,
  worldY: -48,
  width: 84,
  height: 52,
  doorX: -2,
  doorY: 2,
  doorWidth: 6,
  doorHeight: 2,
  forecourtX: -8,
  forecourtY: 4,
  forecourtWidth: 20,
  forecourtHeight: 8,
  topElevation: 26,
  visualHeightWorld: 10.92,
  cornerTrackCount: 4,
  skylineTrackHeightWorld: 220,
};

const APRON_TRAVELING_MERCHANT = {
  worldX: 8,
  worldY: 8,
  width: 2,
  height: 2,
  interactX: 7,
  interactY: 8,
  interactWidth: 1,
  interactHeight: 2,
};

function floorDiv(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function hash32(seed: number, x: number, y: number, salt = 0): number {
  let hash = seed >>> 0;
  hash ^= Math.imul(x | 0, 374761393);
  hash ^= Math.imul(y | 0, 668265263);
  hash ^= Math.imul(salt | 0, 224682251);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function random01(seed: number, x: number, y: number, salt = 0): number {
  return hash32(seed, x, y, salt) / 0x100000000;
}

function smoothstep(value: number): number {
  return value * value * (3 - (2 * value));
}

function lerp(a: number, b: number, t: number): number {
  return a + ((b - a) * t);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function valueNoise(seed: number, x: number, y: number, scale: number, salt: number): number {
  const gx = Math.floor(x / scale);
  const gy = Math.floor(y / scale);
  const tx = smoothstep((x / scale) - gx);
  const ty = smoothstep((y / scale) - gy);
  const a = random01(seed, gx, gy, salt);
  const b = random01(seed, gx + 1, gy, salt);
  const c = random01(seed, gx, gy + 1, salt);
  const d = random01(seed, gx + 1, gy + 1, salt);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

function layeredNoise(seed: number, worldTileX: number, worldTileY: number, salt: number): number {
  const low = valueNoise(seed, worldTileX, worldTileY, 34, salt);
  const mid = valueNoise(seed, worldTileX, worldTileY, 13, salt + 17);
  const high = valueNoise(seed, worldTileX, worldTileY, 6, salt + 31);
  return (low * 0.54) + (mid * 0.32) + (high * 0.14);
}

function ridgeBand(seed: number, worldTileX: number, worldTileY: number, salt: number): number {
  const spine = valueNoise(seed, worldTileX, worldTileY, 58, salt);
  const folded = 1 - clamp01(Math.abs(spine - 0.52) / 0.19);
  const fracture = valueNoise(seed, worldTileX + 211, worldTileY - 179, 21, salt + 29);
  return clamp01(Math.pow(folded, 1.25) * (0.72 + fracture * 0.34));
}

function mountainRangeBand(seed: number, worldTileX: number, worldTileY: number, salt: number): number {
  const angle = random01(seed, salt, -salt, salt + 7) * Math.PI;
  const normalX = Math.cos(angle);
  const normalY = Math.sin(angle);
  const across = (worldTileX * normalX) + (worldTileY * normalY);
  const along = (-worldTileX * normalY) + (worldTileY * normalX);
  const period = 82 + random01(seed, salt + 17, salt - 23, salt + 31) * 54;
  const width = 12 + random01(seed, salt - 41, salt + 43, salt + 47) * 9;
  const phase = random01(seed, salt + 59, -salt - 61, salt + 67) * period;
  const meander = ((valueNoise(seed, along, across, 72, salt + 79) - 0.5) * 28)
    + Math.sin((along * 0.034) + phase) * 8;
  const lane = mod((across + meander + phase) / period, 1);
  const distance = Math.abs(lane - 0.5) * period;
  const shoulder = clamp01(1 - distance / (width * 2.8));
  const core = clamp01(1 - distance / width);
  const fracture = valueNoise(seed, worldTileX + 307, worldTileY - 263, 18, salt + 89);
  return clamp01((Math.pow(shoulder, 1.65) * 0.45 + Math.pow(core, 0.82) * 0.78) * (0.82 + fracture * 0.3));
}

function nearHavenMountainBelt(seed: number, worldTileX: number, worldTileY: number): number {
  const radial = Math.hypot(worldTileX - OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.x, worldTileY - OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.y);
  const center = 54 + (random01(seed, 19, -29, 1810) - 0.5) * 14;
  const band = clamp01(1 - Math.abs(radial - center) / 23);
  const corrugation = ridgeBand(seed, worldTileX + 97, worldTileY - 133, 1820);
  const breakup = valueNoise(seed, worldTileX - 41, worldTileY + 83, 31, 1840);
  return clamp01(Math.pow(band, 1.22) * (0.58 + corrugation * 0.58) * (0.76 + breakup * 0.36));
}

function encodeCoord(value: number): string {
  return value < 0 ? `m${Math.abs(value)}` : `p${value}`;
}

function objectPrefix(chunkX: number, chunkY: number): string {
  return `outerdeck_world_${encodeCoord(chunkX)}_${encodeCoord(chunkY)}`;
}

export function getOuterDeckChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX}:${chunkY}`;
}

export function getOuterDeckChunkCoordsFromWorldTile(worldTileX: number, worldTileY: number): { chunkX: number; chunkY: number } {
  return {
    chunkX: floorDiv(worldTileX, OUTER_DECK_OPEN_WORLD_CHUNK_SIZE),
    chunkY: floorDiv(worldTileY, OUTER_DECK_OPEN_WORLD_CHUNK_SIZE),
  };
}

export function getOuterDeckChunkCoordsFromWorldPixel(worldX: number, worldY: number): { chunkX: number; chunkY: number } {
  return getOuterDeckChunkCoordsFromWorldTile(
    Math.floor(worldX / TILE_SIZE),
    Math.floor(worldY / TILE_SIZE),
  );
}

function isNearHaven(worldTileX: number, worldTileY: number): boolean {
  return Math.abs(worldTileX - 1) <= 7 && Math.abs(worldTileY - 3) <= 7;
}

function getApronDomeDistance(worldTileX: number, worldTileY: number): number {
  return Math.hypot(
    worldTileX - OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.x,
    worldTileY - OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.y,
  );
}

function clampOuterDeckStreamRadius(streamRadius: number): number {
  return Math.max(
    OUTER_DECK_OPEN_WORLD_STREAM_RADIUS,
    Math.min(OUTER_DECK_MAX_DYNAMIC_STREAM_RADIUS, Math.floor(Number(streamRadius) || OUTER_DECK_OPEN_WORLD_STREAM_RADIUS)),
  );
}

function getOuterDeckWindowChunkSpan(streamRadius = OUTER_DECK_OPEN_WORLD_STREAM_RADIUS): number {
  return (clampOuterDeckStreamRadius(streamRadius) * 2) + 1;
}

function getOuterDeckWindowTileSize(streamRadius = OUTER_DECK_OPEN_WORLD_STREAM_RADIUS): number {
  return OUTER_DECK_OPEN_WORLD_CHUNK_SIZE * getOuterDeckWindowChunkSpan(streamRadius);
}

function isApronDomeFullyLoadedInWindow(
  radiusTiles = OUTER_DECK_OPEN_WORLD_DOME_RADIUS_TILES,
  streamRadius = OUTER_DECK_OPEN_WORLD_STREAM_RADIUS,
): boolean {
  return (radiusTiles * 2) + (APRON_DOME_VISIBLE_OUTER_MARGIN_TILES * 2) <= getOuterDeckWindowTileSize(streamRadius);
}

function createTerrainTile(seed: number, localX: number, localY: number, worldTileX: number, worldTileY: number): GeneratedTile {
  const domeDistance = getApronDomeDistance(worldTileX, worldTileY);
  const domeWall = domeDistance >= OUTER_DECK_OPEN_WORLD_DOME_RADIUS_TILES - APRON_DOME_WALL_THICKNESS_TILES;
  if (domeWall) {
    const visibleDomeShell = domeDistance <= OUTER_DECK_OPEN_WORLD_DOME_RADIUS_TILES + APRON_DOME_VISIBLE_OUTER_MARGIN_TILES;
    return {
      x: localX,
      y: localY,
      walkable: false,
      type: "wall",
      elevation: visibleDomeShell ? APRON_DOME_OUTER_WALL_ELEVATION : 0,
      render3d: visibleDomeShell,
    };
  }

  const withinChunkX = mod(worldTileX, OUTER_DECK_OPEN_WORLD_CHUNK_SIZE);
  const withinChunkY = mod(worldTileY, OUTER_DECK_OPEN_WORLD_CHUNK_SIZE);
  const chunkX = floorDiv(worldTileX, OUTER_DECK_OPEN_WORLD_CHUNK_SIZE);
  const chunkY = floorDiv(worldTileY, OUTER_DECK_OPEN_WORLD_CHUNK_SIZE);
  const seamConnector = withinChunkX <= 1
    || withinChunkY <= 1
    || withinChunkX >= OUTER_DECK_OPEN_WORLD_CHUNK_SIZE - 2
    || withinChunkY >= OUTER_DECK_OPEN_WORLD_CHUNK_SIZE - 2;
  const verticalWeaveCenter = 5 + Math.floor(valueNoise(seed, chunkX, worldTileY, 7, 1340) * 14);
  const horizontalWeaveCenter = 5 + Math.floor(valueNoise(seed, worldTileX, chunkY, 7, 1360) * 14);
  const traversalWeave = Math.abs(withinChunkX - verticalWeaveCenter) <= 1
    || Math.abs(withinChunkY - horizontalWeaveCenter) <= 1;
  const connectiveMask = seamConnector || traversalWeave;
  const havenPad = isNearHaven(worldTileX, worldTileY);
  const terrainNoise = layeredNoise(seed, worldTileX, worldTileY, 100);
  const cutNoise = layeredNoise(seed, worldTileX + 91, worldTileY - 57, 400);
  const ridgeNoise = layeredNoise(seed, worldTileX - 47, worldTileY + 131, 700);
  const mountainNoise = layeredNoise(seed, worldTileX + 383, worldTileY - 269, 940);
  const mountainRange = ridgeBand(seed, worldTileX - 151, worldTileY + 317, 1170);
  const primaryRange = mountainRangeBand(seed, worldTileX, worldTileY, 1480);
  const crossingRange = mountainRangeBand(seed, worldTileX + 37, worldTileY - 53, 1630);
  const havenRange = nearHavenMountainBelt(seed, worldTileX, worldTileY);
  const cragNoise = valueNoise(seed, worldTileX - 19, worldTileY + 47, 5, 1950);
  const hillMass = Math.max(0, terrainNoise - 0.18) * 11.5;
  const mountainMass = Math.pow(Math.max(0, mountainNoise - 0.22), 1.08) * 34;
  const radial = Math.hypot(worldTileX, worldTileY);
  const mountainProfile = hillMass
    + mountainMass
    + (mountainRange * 22)
    + (primaryRange * 42)
    + (crossingRange * 34)
    + (havenRange * 32)
    + Math.max(0, ridgeNoise - 0.42) * 11
    + Math.max(0, cragNoise - 0.54) * 8
    + Math.min(6, radial / 58)
    - 3.8;
  const terracedElevation = mountainProfile >= 28
    ? Math.round(mountainProfile / 4) * 4
    : mountainProfile >= 12
      ? Math.round(mountainProfile / 2) * 2
      : Math.round(mountainProfile);
  const rawElevation = Math.round(Math.max(0, Math.min(
    OUTER_DECK_MAX_ELEVATION,
    terracedElevation,
  )));
  const elevation = havenPad ? 0 : rawElevation;
  const brokenVoid = !havenPad && !connectiveMask && cutNoise > 0.82;
  const rangeCore = Math.max(primaryRange, crossingRange, havenRange * 0.9);
  const highWall = !havenPad && !connectiveMask && (
    (ridgeNoise > 0.9 && terrainNoise < 0.42)
    || (rangeCore > 0.82 && cutNoise > 0.58 && terrainNoise < 0.64)
  );
  const walkable = !brokenVoid;
  const type: TileType = !walkable
    ? "wall"
    : highWall
      ? "stone"
    : elevation >= 6
      ? "stone"
      : elevation >= 3
      ? "stone"
      : terrainNoise > 0.62
          ? "stone"
          : terrainNoise < 0.33
            ? "dirt"
            : "floor";

  return {
    x: localX,
    y: localY,
    walkable,
    type,
    elevation,
    render3d: brokenVoid ? false : undefined,
  };
}

function getLocalTileFromWorldTile(metadata: OuterDeckStreamMetadata, worldTileX: number, worldTileY: number): { x: number; y: number } | null {
  const x = worldTileX - metadata.worldOriginTileX;
  const y = worldTileY - metadata.worldOriginTileY;
  const windowTileSize = getOuterDeckWindowTileSize(metadata.streamRadius);
  if (x < 0 || y < 0 || x >= windowTileSize || y >= windowTileSize) {
    return null;
  }
  return { x, y };
}

function getTile(tiles: FieldMap["tiles"], localX: number, localY: number): GeneratedTile | null {
  return tiles[localY]?.[localX] ?? null;
}

function canPlaceLanternOnTile(tile: GeneratedTile | null): tile is GeneratedTile {
  return Boolean(tile && tile.render3d !== false && (tile.walkable || tile.standable3d === true));
}

function isTileFree(tiles: FieldMap["tiles"], localX: number, localY: number, occupied: Set<string>): boolean {
  const tile = getTile(tiles, localX, localY);
  return Boolean(tile?.walkable && !occupied.has(`${localX}:${localY}`));
}

function markOccupied(occupied: Set<string>, localX: number, localY: number, width = 1, height = 1): void {
  for (let y = localY; y < localY + height; y += 1) {
    for (let x = localX; x < localX + width; x += 1) {
      occupied.add(`${x}:${y}`);
    }
  }
}

function setWorldTile(
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  worldTileX: number,
  worldTileY: number,
  patch: Partial<Pick<GeneratedTile, "walkable" | "type" | "elevation" | "standable3d">>,
): void {
  const local = getLocalTileFromWorldTile(metadata, worldTileX, worldTileY);
  if (!local) {
    return;
  }

  const tile = getTile(tiles, local.x, local.y);
  if (!tile) {
    return;
  }

  if (patch.walkable !== undefined) {
    tile.walkable = patch.walkable;
  }
  if (patch.type !== undefined) {
    tile.type = patch.type;
  }
  if (patch.elevation !== undefined) {
    tile.elevation = patch.elevation;
  }
  if (patch.standable3d !== undefined) {
    tile.standable3d = patch.standable3d;
  }
}

function markOccupiedWorldRect(
  occupied: Set<string>,
  metadata: OuterDeckStreamMetadata,
  worldX: number,
  worldY: number,
  width: number,
  height: number,
): void {
  for (let y = worldY; y < worldY + height; y += 1) {
    for (let x = worldX; x < worldX + width; x += 1) {
      const local = getLocalTileFromWorldTile(metadata, x, y);
      if (local) {
        occupied.add(`${local.x}:${local.y}`);
      }
    }
  }
}

function findChunkSpawnTile(
  seed: number,
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  occupied: Set<string>,
  chunkX: number,
  chunkY: number,
  salt: number,
  options: { preferHigh?: boolean; avoidOrigin?: boolean } = {},
): { localX: number; localY: number; worldTileX: number; worldTileY: number; elevation: number } | null {
  let best: { localX: number; localY: number; worldTileX: number; worldTileY: number; elevation: number; score: number } | null = null;
  const startWorldX = chunkX * OUTER_DECK_OPEN_WORLD_CHUNK_SIZE;
  const startWorldY = chunkY * OUTER_DECK_OPEN_WORLD_CHUNK_SIZE;

  for (let attempt = 0; attempt < 96; attempt += 1) {
    const offsetX = Math.floor(random01(seed, chunkX, chunkY, salt + (attempt * 2)) * (OUTER_DECK_OPEN_WORLD_CHUNK_SIZE - 4)) + 2;
    const offsetY = Math.floor(random01(seed, chunkX, chunkY, salt + (attempt * 2) + 1) * (OUTER_DECK_OPEN_WORLD_CHUNK_SIZE - 4)) + 2;
    const worldTileX = startWorldX + offsetX;
    const worldTileY = startWorldY + offsetY;
    if (options.avoidOrigin && Math.hypot(worldTileX - 2, worldTileY - 4) < 9) {
      continue;
    }

    const local = getLocalTileFromWorldTile(metadata, worldTileX, worldTileY);
    if (!local || !isTileFree(tiles, local.x, local.y, occupied)) {
      continue;
    }

    const elevation = Math.max(0, Number(getTile(tiles, local.x, local.y)?.elevation ?? 0));
    const centerBias = 1 - Math.min(1, Math.hypot(offsetX - 12, offsetY - 12) / 18);
    const highBias = options.preferHigh ? elevation * 0.35 : 0;
    const score = centerBias + highBias + random01(seed, worldTileX, worldTileY, salt + 500);
    if (!best || score > best.score) {
      best = {
        localX: local.x,
        localY: local.y,
        worldTileX,
        worldTileY,
        elevation,
        score,
      };
    }
  }

  return best;
}

function shouldGenerateChunkGrappleRoute(seed: number, chunkX: number, chunkY: number): boolean {
  return mod(hash32(seed, chunkX, chunkY, 4090), OUTER_DECK_GRAPPLE_ROUTE_CHUNK_STRIDE) === 0;
}

function shouldGenerateChunkGrindRailRoute(seed: number, chunkX: number, chunkY: number): boolean {
  return mod(hash32(seed, chunkX, chunkY, 4062), OUTER_DECK_GRIND_RAIL_ROUTE_CHUNK_STRIDE) !== 0;
}

function getRouteCandidateHazardScore(tiles: FieldMap["tiles"], localX: number, localY: number): number {
  let score = 0;
  for (let y = localY - 2; y <= localY + 2; y += 1) {
    for (let x = localX - 2; x <= localX + 2; x += 1) {
      if (x === localX && y === localY) {
        continue;
      }
      const tile = getTile(tiles, x, y);
      if (tile && !tile.walkable && tile.standable3d !== true) {
        const distance = Math.max(1, Math.hypot(x - localX, y - localY));
        score += 1 / distance;
      }
    }
  }
  return score;
}

function collectChunkRouteCandidates(
  seed: number,
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  occupied: Set<string>,
  chunkX: number,
  chunkY: number,
  routeId: string,
): GrappleRouteNode[] {
  const startWorldX = chunkX * OUTER_DECK_OPEN_WORLD_CHUNK_SIZE;
  const startWorldY = chunkY * OUTER_DECK_OPEN_WORLD_CHUNK_SIZE;
  const candidateTiles: RouteCandidateTile[] = [];

  for (let offsetY = 2; offsetY <= OUTER_DECK_OPEN_WORLD_CHUNK_SIZE - 3; offsetY += 1) {
    for (let offsetX = 2; offsetX <= OUTER_DECK_OPEN_WORLD_CHUNK_SIZE - 3; offsetX += 1) {
      const worldTileX = startWorldX + offsetX;
      const worldTileY = startWorldY + offsetY;
      if (Math.hypot(worldTileX - 2, worldTileY - 4) < 8) {
        continue;
      }

      const local = getLocalTileFromWorldTile(metadata, worldTileX, worldTileY);
      if (!local || !isTileFree(tiles, local.x, local.y, occupied)) {
        continue;
      }

      const tile = getTile(tiles, local.x, local.y);
      candidateTiles.push({
        localX: local.x,
        localY: local.y,
        worldTileX,
        worldTileY,
        elevation: Math.max(0, Number(tile?.elevation ?? 0)),
        hazardScore: getRouteCandidateHazardScore(tiles, local.x, local.y),
        randomScore: random01(seed, worldTileX, worldTileY, 4250),
      });
    }
  }

  const selected = new Map<string, RouteCandidateTile>();
  const addCandidates = (candidates: RouteCandidateTile[], limit: number): void => {
    for (const candidate of candidates) {
      if (selected.size >= OUTER_DECK_ZIPLINE_CANDIDATE_POOL_LIMIT) {
        return;
      }
      if (limit <= 0) {
        return;
      }

      const key = `${candidate.worldTileX}:${candidate.worldTileY}`;
      if (selected.has(key)) {
        continue;
      }
      selected.set(key, candidate);
      limit -= 1;
    }
  };

  addCandidates(
    [...candidateTiles].sort((a, b) => (b.elevation - a.elevation) || (b.hazardScore - a.hazardScore) || (b.randomScore - a.randomScore)),
    7,
  );
  addCandidates(
    [...candidateTiles].sort((a, b) => (a.elevation - b.elevation) || (b.hazardScore - a.hazardScore) || (b.randomScore - a.randomScore)),
    7,
  );
  addCandidates(
    [...candidateTiles].sort((a, b) => (b.hazardScore - a.hazardScore) || (b.randomScore - a.randomScore)),
    6,
  );
  addCandidates(
    [...candidateTiles].sort((a, b) => b.randomScore - a.randomScore),
    4,
  );

  return Array.from(selected.values()).map((candidate, index) => ({
    id: `${routeId}_node_${index}`,
    localX: candidate.localX,
    localY: candidate.localY,
    worldTileX: candidate.worldTileX,
    worldTileY: candidate.worldTileY,
    elevation: candidate.elevation,
    anchorHeight: 3.2 + (candidate.elevation * 0.42) + (random01(seed, chunkX, chunkY, 4300 + index) * 1.25),
    candidateIndex: index,
  }));
}

function getSegmentTileSamples(
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  start: GrappleRouteNode,
  end: GrappleRouteNode,
): GeneratedTile[] {
  const spanTiles = Math.hypot(end.worldTileX - start.worldTileX, end.worldTileY - start.worldTileY);
  const steps = Math.max(1, Math.ceil(spanTiles * 2));
  const samples: GeneratedTile[] = [];
  const sampled = new Set<string>();

  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const worldTileX = Math.round(start.worldTileX + ((end.worldTileX - start.worldTileX) * t));
    const worldTileY = Math.round(start.worldTileY + ((end.worldTileY - start.worldTileY) * t));
    const key = `${worldTileX}:${worldTileY}`;
    if (sampled.has(key)) {
      continue;
    }
    sampled.add(key);

    const local = getLocalTileFromWorldTile(metadata, worldTileX, worldTileY);
    if (!local) {
      continue;
    }

    const tile = getTile(tiles, local.x, local.y);
    if (tile) {
      samples.push(tile);
    }
  }

  return samples;
}

function getZiplineTraversalNeed(
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  start: GrappleRouteNode,
  end: GrappleRouteNode,
): ZiplineTraversalNeed | null {
  const spanTiles = Math.hypot(end.worldTileX - start.worldTileX, end.worldTileY - start.worldTileY);
  if (spanTiles < OUTER_DECK_ZIPLINE_MIN_SPAN_TILES) {
    return null;
  }

  const elevationDelta = Math.abs(end.elevation - start.elevation);
  const samples = getSegmentTileSamples(tiles, metadata, start, end);
  let blockedTiles = 0;
  let contiguousBlockedTiles = 0;
  let maxContiguousBlockedTiles = 0;

  samples.forEach((tile) => {
    const blocked = !tile.walkable && tile.standable3d !== true;
    if (blocked) {
      blockedTiles += 1;
      contiguousBlockedTiles += 1;
      maxContiguousBlockedTiles = Math.max(maxContiguousBlockedTiles, contiguousBlockedTiles);
      return;
    }
    contiguousBlockedTiles = 0;
  });

  const crossesUnjumpableChasm = spanTiles >= OUTER_DECK_ZIPLINE_CHASM_MIN_SPAN_TILES
    && blockedTiles >= OUTER_DECK_ZIPLINE_CHASM_MIN_BLOCKED_TILES
    && maxContiguousBlockedTiles >= OUTER_DECK_ZIPLINE_CHASM_MIN_CONTIGUOUS_BLOCKED_TILES;
  const crossesMassiveElevation = elevationDelta >= OUTER_DECK_ZIPLINE_MASSIVE_ELEVATION_DELTA;

  if (!crossesUnjumpableChasm && !crossesMassiveElevation) {
    return null;
  }

  const kind = crossesMassiveElevation && (!crossesUnjumpableChasm || elevationDelta >= blockedTiles)
    ? "elevation"
    : "chasm";
  return {
    kind,
    spanTiles,
    elevationDelta,
    blockedTiles,
    maxContiguousBlockedTiles,
    score: (crossesUnjumpableChasm ? blockedTiles * 1.8 + maxContiguousBlockedTiles * 2.4 : 0)
      + (crossesMassiveElevation ? elevationDelta * 1.65 : 0)
      + spanTiles * 0.18,
  };
}

function getGrindRailTraversalNeed(
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  start: GrappleRouteNode,
  end: GrappleRouteNode,
): ZiplineTraversalNeed | null {
  const spanTiles = Math.hypot(end.worldTileX - start.worldTileX, end.worldTileY - start.worldTileY);
  if (spanTiles < OUTER_DECK_GRIND_RAIL_MIN_SPAN_TILES) {
    return null;
  }

  const elevationDelta = Math.abs(end.elevation - start.elevation);
  const samples = getSegmentTileSamples(tiles, metadata, start, end);
  let blockedTiles = 0;
  let contiguousBlockedTiles = 0;
  let maxContiguousBlockedTiles = 0;

  samples.forEach((tile) => {
    const blocked = !tile.walkable && tile.standable3d !== true;
    if (blocked) {
      blockedTiles += 1;
      contiguousBlockedTiles += 1;
      maxContiguousBlockedTiles = Math.max(maxContiguousBlockedTiles, contiguousBlockedTiles);
      return;
    }
    contiguousBlockedTiles = 0;
  });

  const crossesChasm = spanTiles >= OUTER_DECK_GRIND_RAIL_CHASM_MIN_SPAN_TILES
    && blockedTiles >= OUTER_DECK_GRIND_RAIL_CHASM_MIN_BLOCKED_TILES
    && maxContiguousBlockedTiles >= OUTER_DECK_GRIND_RAIL_CHASM_MIN_CONTIGUOUS_BLOCKED_TILES;
  const crossesElevation = elevationDelta >= OUTER_DECK_GRIND_RAIL_ELEVATION_DELTA;
  if (!crossesChasm && !crossesElevation) {
    return null;
  }

  const kind = crossesElevation && (!crossesChasm || elevationDelta >= blockedTiles)
    ? "elevation"
    : "chasm";
  return {
    kind,
    spanTiles,
    elevationDelta,
    blockedTiles,
    maxContiguousBlockedTiles,
    score: (crossesChasm ? blockedTiles * 1.5 + maxContiguousBlockedTiles * 1.8 : 0)
      + (crossesElevation ? elevationDelta * 1.2 : 0)
      + spanTiles * 0.14,
  };
}

function buildChunkZiplinePlans(
  seed: number,
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  occupied: Set<string>,
  chunkX: number,
  chunkY: number,
  routeId: string,
): ZiplineSegmentPlan[] {
  const candidates = collectChunkRouteCandidates(seed, tiles, metadata, occupied, chunkX, chunkY, routeId);

  const plans: ZiplineSegmentPlan[] = [];
  for (let startIndex = 0; startIndex < candidates.length; startIndex += 1) {
    for (let endIndex = startIndex + 1; endIndex < candidates.length; endIndex += 1) {
      const start = candidates[startIndex]!;
      const end = candidates[endIndex]!;
      const need = getZiplineTraversalNeed(tiles, metadata, start, end);
      if (!need) {
        continue;
      }

      plans.push({
        start,
        end,
        need,
        score: need.score + (random01(seed, start.worldTileX + end.worldTileX, start.worldTileY + end.worldTileY, 4600) * 0.5),
      });
    }
  }

  const selected: ZiplineSegmentPlan[] = [];
  const usedAnchors = new Set<string>();
  plans
    .sort((a, b) => b.score - a.score)
    .forEach((plan) => {
      if (selected.length >= OUTER_DECK_ZIPLINE_MAX_SEGMENTS_PER_ROUTE) {
        return;
      }
      if (usedAnchors.has(plan.start.id) && usedAnchors.has(plan.end.id)) {
        return;
      }

      selected.push(plan);
      usedAnchors.add(plan.start.id);
      usedAnchors.add(plan.end.id);
    });

  return selected;
}

function buildChunkGrindRailPlans(
  seed: number,
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  occupied: Set<string>,
  chunkX: number,
  chunkY: number,
  routeId: string,
): GrindRailSegmentPlan[] {
  const candidates = collectChunkRouteCandidates(seed, tiles, metadata, occupied, chunkX, chunkY, routeId);
  const plans: GrindRailSegmentPlan[] = [];
  for (let startIndex = 0; startIndex < candidates.length; startIndex += 1) {
    for (let endIndex = startIndex + 1; endIndex < candidates.length; endIndex += 1) {
      const start = candidates[startIndex]!;
      const end = candidates[endIndex]!;
      const need = getGrindRailTraversalNeed(tiles, metadata, start, end);
      if (!need) {
        continue;
      }

      plans.push({
        start,
        end,
        need,
        score: need.score + (random01(seed, start.worldTileX + end.worldTileX, start.worldTileY + end.worldTileY, 4520) * 0.38),
      });
    }
  }

  const selected: GrindRailSegmentPlan[] = [];
  const usedAnchors = new Set<string>();
  plans
    .sort((a, b) => b.score - a.score)
    .forEach((plan) => {
      if (selected.length >= OUTER_DECK_GRIND_RAIL_MAX_SEGMENTS_PER_CHUNK) {
        return;
      }
      if (usedAnchors.has(plan.start.id) || usedAnchors.has(plan.end.id)) {
        return;
      }
      selected.push(plan);
      usedAnchors.add(plan.start.id);
      usedAnchors.add(plan.end.id);
    });

  return selected;
}

function addHavenGate(
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  objects: FieldObject[],
  interactionZones: InteractionZone[],
  occupied: Set<string>,
): void {
  const elevator = HAVEN_CARGO_ELEVATOR_EXTERIOR;
  const elevatorLocal = getLocalTileFromWorldTile(metadata, elevator.worldX, elevator.worldY);
  const doorLocal = getLocalTileFromWorldTile(metadata, elevator.doorX, elevator.doorY);

  if (!doorLocal) {
    return;
  }

  for (let y = elevator.worldY; y < elevator.worldY + elevator.height; y += 1) {
    for (let x = elevator.worldX; x < elevator.worldX + elevator.width; x += 1) {
      setWorldTile(tiles, metadata, x, y, {
        walkable: false,
        type: "wall",
        elevation: elevator.topElevation,
        standable3d: true,
      });
    }
  }

  for (let y = elevator.doorY; y < elevator.doorY + elevator.doorHeight; y += 1) {
    for (let x = elevator.doorX; x < elevator.doorX + elevator.doorWidth; x += 1) {
      setWorldTile(tiles, metadata, x, y, {
        walkable: true,
        type: "floor",
        elevation: 0,
        standable3d: false,
      });
    }
  }

  for (let y = elevator.forecourtY; y < elevator.forecourtY + elevator.forecourtHeight; y += 1) {
    for (let x = elevator.forecourtX; x < elevator.forecourtX + elevator.forecourtWidth; x += 1) {
      setWorldTile(tiles, metadata, x, y, {
        walkable: true,
        type: "stone",
        elevation: 0,
        standable3d: false,
      });
    }
  }

  if (elevatorLocal) {
    objects.push({
      id: "outer_deck_world_haven_cargo_elevator",
      x: elevatorLocal.x,
      y: elevatorLocal.y,
      width: elevator.width,
      height: elevator.height,
      type: "station",
      sprite: "haven_cargo_elevator_exterior",
      metadata: {
        name: "",
        havenCargoElevatorExterior: true,
        useFull3DFootprint: true,
        doorWorldTileX: elevator.doorX,
        doorWorldTileY: elevator.doorY,
        doorWidth: elevator.doorWidth,
        doorHeight: elevator.doorHeight,
        objectBaseElevationWorld: 0,
        visualHeightWorld: elevator.visualHeightWorld,
        cornerTrackCount: elevator.cornerTrackCount,
        skylineTrackHeightWorld: elevator.skylineTrackHeightWorld,
        worldTileX: OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE.x,
        worldTileY: OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE.y,
      },
    });
  }

  [
    { id: "outer_deck_world_haven_entry_lamp_left", x: elevator.doorX - 2, y: elevator.forecourtY },
    { id: "outer_deck_world_haven_entry_lamp_right", x: elevator.doorX + elevator.doorWidth + 1, y: elevator.forecourtY },
  ].forEach((lamp) => {
    const lampLocal = getLocalTileFromWorldTile(metadata, lamp.x, lamp.y);
    if (!lampLocal) {
      return;
    }
    setWorldTile(tiles, metadata, lamp.x, lamp.y, {
      walkable: true,
      type: "stone",
      elevation: 0,
      standable3d: false,
    });
    objects.push({
      id: lamp.id,
      x: lampLocal.x,
      y: lampLocal.y,
      width: 1,
      height: 1,
      type: "decoration",
      sprite: "apron_lantern",
      metadata: {
        name: "HAVEN Threshold Light",
        apronLightSource: true,
        lightRadiusPx: APRON_HAVEN_ENTRY_LAMP_LIGHT_RADIUS_PX,
        worldTileX: lamp.x,
        worldTileY: lamp.y,
        elevation: 0,
      },
    });
  });

  interactionZones.push({
    id: OUTER_DECK_OVERWORLD_HAVEN_GATE_ZONE_ID,
    x: doorLocal.x,
    y: doorLocal.y,
    width: elevator.doorWidth,
    height: elevator.doorHeight,
    action: "custom",
    label: "ENTER HAVEN",
    metadata: {
      handlerId: "outer_deck_return_to_haven",
      autoTrigger: true,
    },
  });

  markOccupiedWorldRect(occupied, metadata, elevator.worldX, elevator.worldY, elevator.width, elevator.height);
  markOccupiedWorldRect(occupied, metadata, elevator.forecourtX, elevator.forecourtY, elevator.forecourtWidth, elevator.forecourtHeight);
}

function addTravelingMerchant(
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  objects: FieldObject[],
  interactionZones: InteractionZone[],
  occupied: Set<string>,
): void {
  const merchant = APRON_TRAVELING_MERCHANT;
  const merchantLocal = getLocalTileFromWorldTile(metadata, merchant.worldX, merchant.worldY);
  const interactionLocal = getLocalTileFromWorldTile(metadata, merchant.interactX, merchant.interactY);
  if (!merchantLocal || !interactionLocal) {
    return;
  }

  for (let y = merchant.worldY; y < merchant.worldY + merchant.height; y += 1) {
    for (let x = merchant.worldX; x < merchant.worldX + merchant.width; x += 1) {
      setWorldTile(tiles, metadata, x, y, {
        walkable: false,
        type: "stone",
        elevation: 0,
        standable3d: false,
      });
    }
  }

  for (let y = merchant.interactY; y < merchant.interactY + merchant.interactHeight; y += 1) {
    for (let x = merchant.interactX; x < merchant.interactX + merchant.interactWidth; x += 1) {
      setWorldTile(tiles, metadata, x, y, {
        walkable: true,
        type: "stone",
        elevation: 0,
        standable3d: false,
      });
    }
  }

  objects.push({
    id: "outer_deck_world_traveling_merchant",
    x: merchantLocal.x,
    y: merchantLocal.y,
    width: merchant.width,
    height: merchant.height,
    type: "station",
    sprite: "traveling_merchant_cart",
    metadata: {
      name: "Traveling Merchant",
      travelingMerchant: true,
      floorOrdinal: metadata.floorOrdinal,
      useFull3DFootprint: true,
      objectBaseElevationWorld: 0,
      visualHeightWorld: 2.3,
      worldTileX: merchant.worldX,
      worldTileY: merchant.worldY,
    },
  });

  interactionZones.push({
    id: OUTER_DECK_OVERWORLD_TRAVELING_MERCHANT_ZONE_ID,
    x: interactionLocal.x,
    y: interactionLocal.y,
    width: merchant.interactWidth,
    height: merchant.interactHeight,
    action: "custom",
    label: "TRAVELING MERCHANT",
    metadata: {
      handlerId: "outer_deck_traveling_merchant",
      floorOrdinal: metadata.floorOrdinal,
    },
  });

  markOccupiedWorldRect(occupied, metadata, merchant.worldX, merchant.worldY, merchant.width, merchant.height);
}

function getDistanceTier(chunkX: number, chunkY: number): number {
  return Math.max(0, Math.floor(Math.hypot(chunkX, chunkY)));
}

function getChunkResourceSpec(seed: number, chunkX: number, chunkY: number, index: number, distanceTier: number): ResourceSpec {
  const roll = Math.floor(random01(seed, chunkX, chunkY, 1400 + index) * RESOURCE_SPECS.length);
  if (distanceTier >= 5 && random01(seed, chunkX, chunkY, 1420 + index) > 0.68) {
    return RESOURCE_SPECS[3]!;
  }
  return RESOURCE_SPECS[roll] ?? RESOURCE_SPECS[0]!;
}

function addChunkResources(
  openWorld: OuterDeckOpenWorldState,
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  objects: FieldObject[],
  occupied: Set<string>,
  chunkX: number,
  chunkY: number,
): void {
  const seed = openWorld.seed;
  const distanceTier = getDistanceTier(chunkX, chunkY);
  const nearOrigin = Math.hypot(chunkX, chunkY) < 0.5;
  const count = nearOrigin ? 2 : 2 + (random01(seed, chunkX, chunkY, 1200) > 0.5 ? 1 : 0) + (distanceTier >= 4 ? 1 : 0);

  for (let index = 0; index < count; index += 1) {
    const persistentKey = `resource:${getOuterDeckChunkKey(chunkX, chunkY)}:${index}`;
    if (openWorld.collectedResourceKeys.includes(persistentKey)) {
      continue;
    }

    const spawn = findChunkSpawnTile(seed, tiles, metadata, occupied, chunkX, chunkY, 1500 + index, {
      avoidOrigin: true,
    });
    if (!spawn) {
      continue;
    }

    const spec = getChunkResourceSpec(seed, chunkX, chunkY, index, distanceTier);
    const amount = Math.max(1, 1 + Math.floor(distanceTier / 3) + (random01(seed, chunkX, chunkY, 1520 + index) > 0.76 ? 1 : 0));
    objects.push({
      id: `${objectPrefix(chunkX, chunkY)}_resource_${index}`,
      x: spawn.localX,
      y: spawn.localY,
      width: 1,
      height: 1,
      type: "resource",
      sprite: "resource",
      metadata: {
        ...spec,
        amount,
        persistentKey,
        worldTileX: spawn.worldTileX,
        worldTileY: spawn.worldTileY,
        elevation: spawn.elevation,
      },
    });
    markOccupied(occupied, spawn.localX, spawn.localY);
  }
}

function addChunkApronPickup(
  openWorld: OuterDeckOpenWorldState,
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  objects: FieldObject[],
  occupied: Set<string>,
  chunkX: number,
  chunkY: number,
  spec: ApronPickupSpec,
  salt: number,
): void {
  const chunkKey = getOuterDeckChunkKey(chunkX, chunkY);
  const persistentKey = `${spec.persistentKeyPrefix}:${chunkKey}`;
  if (openWorld[spec.collectedKeys].includes(persistentKey)) {
    return;
  }

  const spawn = findChunkSpawnTile(openWorld.seed, tiles, metadata, occupied, chunkX, chunkY, salt, {
    preferHigh: spec.pickupType === "theaterChart",
    avoidOrigin: true,
  });
  if (!spawn) {
    return;
  }

  objects.push({
    id: `${objectPrefix(chunkX, chunkY)}_${spec.persistentKeyPrefix}`,
    x: spawn.localX,
    y: spawn.localY,
    width: 1,
    height: 1,
    type: "resource",
    sprite: spec.sprite,
    metadata: {
      name: spec.name,
      apronPickupType: spec.pickupType,
      persistentKey,
      worldTileX: spawn.worldTileX,
      worldTileY: spawn.worldTileY,
      elevation: spawn.elevation,
    },
  });
  markOccupied(occupied, spawn.localX, spawn.localY);
}

function addChunkApronPickups(
  openWorld: OuterDeckOpenWorldState,
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  objects: FieldObject[],
  occupied: Set<string>,
  chunkX: number,
  chunkY: number,
): void {
  const distanceTier = getDistanceTier(chunkX, chunkY);
  if (distanceTier <= 0) {
    return;
  }

  const roll = random01(openWorld.seed, chunkX, chunkY, 1680);
  if (distanceTier >= 2 && roll > 0.925) {
    addChunkApronPickup(openWorld, tiles, metadata, objects, occupied, chunkX, chunkY, APRON_KEY_PICKUP, 1710);
    return;
  }

  if (roll > 0.74) {
    addChunkApronPickup(openWorld, tiles, metadata, objects, occupied, chunkX, chunkY, THEATER_CHART_PICKUP, 1720);
  }
}

function formatEnemyLabel(enemyKind: string): string {
  return enemyKind.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function addChunkEnemies(
  openWorld: OuterDeckOpenWorldState,
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  objects: FieldObject[],
  occupied: Set<string>,
  chunkX: number,
  chunkY: number,
): void {
  const seed = openWorld.seed;
  const distanceTier = getDistanceTier(chunkX, chunkY);
  const nearHavenChunk = Math.hypot(chunkX, chunkY) < 1.25;
  const count = nearHavenChunk
    ? (random01(seed, chunkX, chunkY, 2000) > 0.72 ? 1 : 0)
    : 1 + (random01(seed, chunkX, chunkY, 2001) > 0.48 ? 1 : 0) + (distanceTier >= 5 && random01(seed, chunkX, chunkY, 2002) > 0.72 ? 1 : 0);

  for (let index = 0; index < count; index += 1) {
    if (random01(seed, chunkX, chunkY, 2040 + index) >= OUTER_DECK_ROAMING_ENEMY_DENSITY) {
      continue;
    }

    const persistentKey = `enemy:${getOuterDeckChunkKey(chunkX, chunkY)}:${index}`;
    if (openWorld.defeatedEnemyKeys.includes(persistentKey)) {
      continue;
    }

    const spawn = findChunkSpawnTile(seed, tiles, metadata, occupied, chunkX, chunkY, 2100 + index, {
      avoidOrigin: true,
    });
    if (!spawn) {
      continue;
    }

    const kind = ENEMY_KINDS[Math.floor(random01(seed, chunkX, chunkY, 2120 + index) * ENEMY_KINDS.length)] ?? ENEMY_KINDS[0];
    const hp = 72
      + Math.min(96, distanceTier * 10)
      + (random01(seed, chunkX, chunkY, 2130 + index) > 0.7 ? 18 : 0);
    objects.push({
      id: `${objectPrefix(chunkX, chunkY)}_enemy_${index}`,
      x: spawn.localX,
      y: spawn.localY,
      width: 1,
      height: 1,
      type: "enemy",
      sprite: "field_enemy",
      metadata: {
        name: formatEnemyLabel(kind),
        enemyKind: kind,
        persistentKey,
        hp,
        speed: 82 + Math.min(42, distanceTier * 4),
        aggroRange: 220 + Math.min(180, distanceTier * 18),
        roamRadiusTiles: 4 + Math.min(5, Math.floor(distanceTier / 2)) + Math.floor(random01(seed, chunkX, chunkY, 2140 + index) * 3),
        roamSpeedMultiplier: 0.72 + (random01(seed, chunkX, chunkY, 2145 + index) * 0.22),
        gearbladeDefense: distanceTier >= 4 && index % 2 === 0 ? "armor" : "none",
        attackStyle: index % 3 === 0 ? "lunge" : index % 3 === 1 ? "shot" : "slash",
        drops: {
          wad: 18 + (distanceTier * 5),
          resources: {
            metalScrap: kind.includes("scaffold") ? 0 : 1,
            wood: kind.includes("scaffold") ? 1 : 0,
            chaosShards: distanceTier >= 5 && index === 0 ? 1 : 0,
            steamComponents: kind.includes("drone") || kind.includes("sort") ? 1 : 0,
          },
        },
        worldTileX: spawn.worldTileX,
        worldTileY: spawn.worldTileY,
        elevation: spawn.elevation,
      },
    });
    markOccupied(occupied, spawn.localX, spawn.localY);
  }
}

function isFarBossChunk(seed: number, chunkX: number, chunkY: number): boolean {
  if (Math.hypot(chunkX, chunkY) < 5) {
    return false;
  }
  const superX = floorDiv(chunkX, 4);
  const superY = floorDiv(chunkY, 4);
  const anchorX = (superX * 4) + Math.floor(random01(seed, superX, superY, 3100) * 4);
  const anchorY = (superY * 4) + Math.floor(random01(seed, superX, superY, 3101) * 4);
  return chunkX === anchorX && chunkY === anchorY;
}

function getBossSpec(seed: number, chunkX: number, chunkY: number): BossSpec | null {
  const legacyZone = LEGACY_BOSS_CHUNKS[getOuterDeckChunkKey(chunkX, chunkY)];
  if (legacyZone) {
    return LEGACY_BOSS_SPECS[legacyZone];
  }

  if (!isFarBossChunk(seed, chunkX, chunkY)) {
    return null;
  }

  return FAR_BOSS_SPECS[Math.floor(random01(seed, chunkX, chunkY, 3200) * FAR_BOSS_SPECS.length)] ?? FAR_BOSS_SPECS[0]!;
}

function addChunkBoss(
  openWorld: OuterDeckOpenWorldState,
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  objects: FieldObject[],
  occupied: Set<string>,
  chunkX: number,
  chunkY: number,
): void {
  const seed = openWorld.seed;
  const spec = getBossSpec(seed, chunkX, chunkY);
  if (!spec) {
    return;
  }

  const bossKey = `boss:${spec.archetype}:${getOuterDeckChunkKey(chunkX, chunkY)}`;
  if (openWorld.defeatedBossKeys.includes(bossKey)) {
    return;
  }

  const spawn = findChunkSpawnTile(seed, tiles, metadata, occupied, chunkX, chunkY, 3300, {
    preferHigh: true,
    avoidOrigin: true,
  });
  if (!spawn) {
    return;
  }

  const distanceTier = getDistanceTier(chunkX, chunkY);
  const maxHp = 280 + Math.min(420, distanceTier * 44);
  const currentHp = Math.max(1, Math.min(maxHp, Number(openWorld.bossHpByKey[bossKey] ?? maxHp)));
  objects.push({
    id: `${objectPrefix(chunkX, chunkY)}_world_boss`,
    x: spawn.localX,
    y: spawn.localY,
    width: 2,
    height: 2,
    type: "enemy",
    sprite: "field_enemy_boss",
    metadata: {
      name: spec.name,
      enemyKind: spec.enemyKind,
      persistentKey: bossKey,
      bossKey,
      bossZoneId: spec.zoneId,
      worldBoss: true,
      hp: maxHp,
      currentHp,
      width: 64,
      height: 64,
      speed: 76 + Math.min(26, distanceTier * 2),
      aggroRange: 340 + Math.min(180, distanceTier * 16),
      gearbladeDefense: distanceTier % 2 === 0 ? "shield" : "armor",
      attackStyle: spec.archetype === "scaffold" ? "shot" : spec.archetype === "dropbay" ? "shield_bash" : "lunge",
      drops: {
        wad: (spec.drops.wad ?? 0) + (distanceTier * 12),
        resources: {
          metalScrap: spec.drops.resources?.metalScrap ?? 0,
          wood: spec.drops.resources?.wood ?? 0,
          chaosShards: (spec.drops.resources?.chaosShards ?? 0) + (distanceTier >= 5 ? 1 : 0),
          steamComponents: spec.drops.resources?.steamComponents ?? 0,
        },
      },
      worldTileX: spawn.worldTileX,
      worldTileY: spawn.worldTileY,
      elevation: spawn.elevation,
    },
  });
  markOccupied(occupied, spawn.localX, spawn.localY, 2, 2);
}

function addChunkGrappleNodes(
  openWorld: OuterDeckOpenWorldState,
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  objects: FieldObject[],
  occupied: Set<string>,
  chunkX: number,
  chunkY: number,
): void {
  const seed = openWorld.seed;
  if (!shouldGenerateChunkGrappleRoute(seed, chunkX, chunkY)) {
    return;
  }

  const routeId = `${objectPrefix(chunkX, chunkY)}_grapple_route`;
  const plans = buildChunkZiplinePlans(seed, tiles, metadata, occupied, chunkX, chunkY, routeId);
  if (plans.length === 0) {
    return;
  }

  const nodes = new Map<string, GrappleRouteNode>();
  plans.forEach((plan) => {
    nodes.set(plan.start.id, plan.start);
    nodes.set(plan.end.id, plan.end);
  });

  Array.from(nodes.values())
    .sort((a, b) => a.candidateIndex - b.candidateIndex)
    .forEach((node, index) => {
      objects.push({
        id: node.id,
        x: node.localX,
        y: node.localY,
        width: 1,
        height: 1,
        type: "decoration",
        sprite: "grapple_anchor",
        metadata: {
          name: "Grapple Route Node",
          grappleAnchor: true,
          routeId,
          routeIndex: index,
          anchorHeight: node.anchorHeight,
          worldTileX: node.worldTileX,
          worldTileY: node.worldTileY,
          elevation: node.elevation,
        },
      });
      markOccupied(occupied, node.localX, node.localY);
    });

  plans.forEach((plan, index) => {
    const start = plan.start;
    const end = plan.end;
    objects.push({
      id: `${routeId}_zipline_${index}`,
      x: Math.min(start.localX, end.localX),
      y: Math.min(start.localY, end.localY),
      width: Math.max(1, Math.abs(end.localX - start.localX) + 1),
      height: Math.max(1, Math.abs(end.localY - start.localY) + 1),
      type: "decoration",
      sprite: "zipline_track",
      metadata: {
        name: "Zipline Track",
        ziplineTrack: true,
        routeId,
        routeIndex: index,
        startAnchorId: start.id,
        endAnchorId: end.id,
        startWorldTileX: start.worldTileX + 0.5,
        startWorldTileY: start.worldTileY + 0.5,
        endWorldTileX: end.worldTileX + 0.5,
        endWorldTileY: end.worldTileY + 0.5,
        startAnchorHeight: start.anchorHeight,
        endAnchorHeight: end.anchorHeight,
        elevation: Math.max(start.elevation, end.elevation),
        traversalNeed: plan.need.kind,
        traversalSpanTiles: Number(plan.need.spanTiles.toFixed(2)),
        traversalElevationDelta: plan.need.elevationDelta,
        traversalBlockedTiles: plan.need.blockedTiles,
        traversalMaxBlockedRunTiles: plan.need.maxContiguousBlockedTiles,
      },
    });
  });
}

function addChunkGrindRails(
  openWorld: OuterDeckOpenWorldState,
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  objects: FieldObject[],
  occupied: Set<string>,
  chunkX: number,
  chunkY: number,
): void {
  const seed = openWorld.seed;
  if (!shouldGenerateChunkGrindRailRoute(seed, chunkX, chunkY)) {
    return;
  }

  const routeId = `${objectPrefix(chunkX, chunkY)}_grind_route`;
  const plans = buildChunkGrindRailPlans(seed, tiles, metadata, occupied, chunkX, chunkY, routeId);
  plans.forEach((plan, index) => {
    const segmentRouteId = `${routeId}_${index}`;
    const startHeight = 0.56 + (plan.start.elevation * 0.42);
    const endHeight = 0.56 + (plan.end.elevation * 0.42);
    objects.push({
      id: `${segmentRouteId}_segment_0`,
      x: Math.min(plan.start.localX, plan.end.localX),
      y: Math.min(plan.start.localY, plan.end.localY),
      width: Math.max(1, Math.abs(plan.end.localX - plan.start.localX) + 1),
      height: Math.max(1, Math.abs(plan.end.localY - plan.start.localY) + 1),
      type: "decoration",
      sprite: "grind_rail",
      metadata: {
        name: "Grind Rail",
        grindRail: true,
        railRouteId: segmentRouteId,
        segmentIndex: 0,
        startWorldTileX: plan.start.worldTileX + 0.5,
        startWorldTileY: plan.start.worldTileY + 0.5,
        endWorldTileX: plan.end.worldTileX + 0.5,
        endWorldTileY: plan.end.worldTileY + 0.5,
        startHeight,
        endHeight,
        launchAtEnd: true,
        traversalNeed: plan.need.kind,
        traversalSpanTiles: Number(plan.need.spanTiles.toFixed(2)),
        traversalElevationDelta: plan.need.elevationDelta,
        traversalBlockedTiles: plan.need.blockedTiles,
        traversalMaxBlockedRunTiles: plan.need.maxContiguousBlockedTiles,
        elevation: Math.max(plan.start.elevation, plan.end.elevation),
      },
    });
    markOccupied(occupied, plan.start.localX, plan.start.localY);
    markOccupied(occupied, plan.end.localX, plan.end.localY);
  });
}

function addPlacedLanterns(
  openWorld: OuterDeckOpenWorldState,
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  objects: FieldObject[],
  occupied: Set<string>,
): void {
  openWorld.placedLanterns.forEach((lantern) => {
    const local = getLocalTileFromWorldTile(metadata, lantern.worldTileX, lantern.worldTileY);
    if (!local) {
      return;
    }

    const tile = getTile(tiles, local.x, local.y);
    if (!canPlaceLanternOnTile(tile)) {
      return;
    }

    objects.push({
      id: lantern.id,
      x: local.x,
      y: local.y,
      width: 1,
      height: 1,
      type: "decoration",
      sprite: "apron_lantern",
      metadata: {
        name: "Placed Lantern",
        apronLightSource: true,
        lightRadiusPx: APRON_PLACED_LANTERN_LIGHT_RADIUS_PX,
        worldTileX: lantern.worldTileX,
        worldTileY: lantern.worldTileY,
        elevation: Math.max(0, Number(tile.elevation ?? 0)),
        placedAt: lantern.placedAt,
      },
    });
    markOccupied(occupied, local.x, local.y);
  });
}

function shouldGenerateInteriorEntrance(openWorld: OuterDeckOpenWorldState, chunkX: number, chunkY: number): boolean {
  if (LEGACY_BOSS_CHUNKS[getOuterDeckChunkKey(chunkX, chunkY)]) {
    return false;
  }

  const distanceTier = getDistanceTier(chunkX, chunkY);
  if (distanceTier < 2) {
    return false;
  }

  const superX = floorDiv(chunkX, OUTER_DECK_INTERIOR_SUPERCELL_SIZE);
  const superY = floorDiv(chunkY, OUTER_DECK_INTERIOR_SUPERCELL_SIZE);
  const anchorX = (superX * OUTER_DECK_INTERIOR_SUPERCELL_SIZE)
    + Math.floor(random01(openWorld.seed, superX, superY, 5120) * OUTER_DECK_INTERIOR_SUPERCELL_SIZE);
  const anchorY = (superY * OUTER_DECK_INTERIOR_SUPERCELL_SIZE)
    + Math.floor(random01(openWorld.seed, superX, superY, 5121) * OUTER_DECK_INTERIOR_SUPERCELL_SIZE);
  if (chunkX !== anchorX || chunkY !== anchorY) {
    return false;
  }

  return random01(openWorld.seed, superX, superY, 5140) >= OUTER_DECK_INTERIOR_SPAWN_THRESHOLD;
}

export function findNearestOuterDeckInteriorEntranceSignal(
  openWorld: OuterDeckOpenWorldState,
  worldX: number,
  worldY: number,
  searchRadiusChunks = 18,
): OuterDeckInteriorEntranceSignal | null {
  const centerChunk = getOuterDeckChunkCoordsFromWorldPixel(worldX, worldY);
  const radius = Math.max(1, Math.floor(searchRadiusChunks));
  let best: OuterDeckInteriorEntranceSignal | null = null;

  for (let chunkY = centerChunk.chunkY - radius; chunkY <= centerChunk.chunkY + radius; chunkY += 1) {
    for (let chunkX = centerChunk.chunkX - radius; chunkX <= centerChunk.chunkX + radius; chunkX += 1) {
      if (!shouldGenerateInteriorEntrance(openWorld, chunkX, chunkY)) {
        continue;
      }

      const spec = getOuterDeckInteriorSpec(openWorld.seed, openWorld.floorOrdinal, chunkX, chunkY);
      const worldTileX = (chunkX * OUTER_DECK_OPEN_WORLD_CHUNK_SIZE) + Math.floor(OUTER_DECK_OPEN_WORLD_CHUNK_SIZE / 2);
      const worldTileY = (chunkY * OUTER_DECK_OPEN_WORLD_CHUNK_SIZE) + Math.floor(OUTER_DECK_OPEN_WORLD_CHUNK_SIZE / 2);
      const targetWorldX = (worldTileX + 0.5) * TILE_SIZE;
      const targetWorldY = (worldTileY + 0.5) * TILE_SIZE;
      const distancePx = Math.hypot(targetWorldX - worldX, targetWorldY - worldY);
      if (best && distancePx >= best.distancePx) {
        continue;
      }

      best = {
        chunkX,
        chunkY,
        worldTileX,
        worldTileY,
        worldX: targetWorldX,
        worldY: targetWorldY,
        distancePx,
        variant: spec.variant,
        title: spec.title,
        entranceLabel: spec.entranceLabel,
        completed: openWorld.completedInteriorKeys.includes(spec.key),
      };
    }
  }

  return best;
}

function getInteriorEntranceSprite(variant: ReturnType<typeof getOuterDeckInteriorSpec>["variant"]): string {
  switch (variant) {
    case "cave":
      return "doorway";
    case "structure":
      return "bulkhead";
    case "service_tunnel":
      return "bulkhead";
    default:
      return "doorway";
  }
}

function addChunkInteriorEntrance(
  openWorld: OuterDeckOpenWorldState,
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  objects: FieldObject[],
  interactionZones: InteractionZone[],
  occupied: Set<string>,
  chunkX: number,
  chunkY: number,
): void {
  if (!shouldGenerateInteriorEntrance(openWorld, chunkX, chunkY)) {
    return;
  }

  const spawn = findChunkSpawnTile(openWorld.seed, tiles, metadata, occupied, chunkX, chunkY, 5180, {
    avoidOrigin: true,
  });
  if (!spawn) {
    return;
  }

  const spec = getOuterDeckInteriorSpec(openWorld.seed, metadata.floorOrdinal, chunkX, chunkY);
  const targetMapId = buildOuterDeckInteriorMapId(metadata.floorOrdinal, chunkX, chunkY, 0);
  const objectId = `${objectPrefix(chunkX, chunkY)}_interior_${spec.variant}`;
  const zoneId = `${objectId}_zone`;
  const completed = openWorld.completedInteriorKeys.includes(spec.key);

  objects.push({
    id: objectId,
    x: spawn.localX,
    y: spawn.localY,
    width: 1,
    height: 1,
    type: "station",
    sprite: getInteriorEntranceSprite(spec.variant),
    metadata: {
      name: completed ? `${spec.title} Secured` : spec.title,
      outerDeckInteriorEntrance: true,
      variant: spec.variant,
      targetMapId,
      floorOrdinal: metadata.floorOrdinal,
      chunkX,
      chunkY,
      worldTileX: spawn.worldTileX,
      worldTileY: spawn.worldTileY,
      elevation: spawn.elevation,
      completed,
    },
  });

  interactionZones.push({
    id: zoneId,
    x: spawn.localX,
    y: spawn.localY,
    width: 1,
    height: 1,
    action: "custom",
    label: completed ? `${spec.entranceLabel} // SECURED` : spec.entranceLabel,
    metadata: {
      handlerId: "outer_deck_interior_entry",
      targetMapId,
      floorOrdinal: metadata.floorOrdinal,
      chunkX,
      chunkY,
      returnWorldTileX: spawn.worldTileX,
      returnWorldTileY: spawn.worldTileY,
      returnFacing: "south",
    },
  });
  markOccupied(occupied, spawn.localX, spawn.localY);
}

function addChunkContent(
  openWorld: OuterDeckOpenWorldState,
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  objects: FieldObject[],
  interactionZones: InteractionZone[],
  occupied: Set<string>,
  chunkX: number,
  chunkY: number,
): void {
  addChunkBoss(openWorld, tiles, metadata, objects, occupied, chunkX, chunkY);
  addChunkResources(openWorld, tiles, metadata, objects, occupied, chunkX, chunkY);
  addChunkApronPickups(openWorld, tiles, metadata, objects, occupied, chunkX, chunkY);
  addChunkInteriorEntrance(openWorld, tiles, metadata, objects, interactionZones, occupied, chunkX, chunkY);
  addChunkEnemies(openWorld, tiles, metadata, objects, occupied, chunkX, chunkY);
  addChunkGrindRails(openWorld, tiles, metadata, objects, occupied, chunkX, chunkY);
  addChunkGrappleNodes(openWorld, tiles, metadata, objects, occupied, chunkX, chunkY);
}

export function isOuterDeckOpenWorldMap(map: FieldMap | null | undefined): boolean {
  return map?.metadata?.kind === "outerDeckOpenWorld";
}

export function getOuterDeckStreamMetadata(map: FieldMap | null | undefined): OuterDeckStreamMetadata | null {
  if (!isOuterDeckOpenWorldMap(map)) {
    return null;
  }
  return (map as FieldMap).metadata as OuterDeckStreamMetadata;
}

export function outerDeckLocalPixelToWorld(map: FieldMap, localX: number, localY: number): { x: number; y: number } {
  const metadata = getOuterDeckStreamMetadata(map);
  if (!metadata) {
    return { x: localX, y: localY };
  }
  return {
    x: localX + (metadata.worldOriginTileX * TILE_SIZE),
    y: localY + (metadata.worldOriginTileY * TILE_SIZE),
  };
}

export function outerDeckWorldPixelToLocal(map: FieldMap, worldX: number, worldY: number): { x: number; y: number } {
  const metadata = getOuterDeckStreamMetadata(map);
  if (!metadata) {
    return { x: worldX, y: worldY };
  }
  return {
    x: worldX - (metadata.worldOriginTileX * TILE_SIZE),
    y: worldY - (metadata.worldOriginTileY * TILE_SIZE),
  };
}

export function getDesiredOuterDeckStreamWindow(worldPositions: OuterDeckStreamFocus[]): {
  centerChunkX: number;
  centerChunkY: number;
  streamRadius: number;
} {
  const validPositions = worldPositions.filter((position) => (
    Number.isFinite(position?.x) && Number.isFinite(position?.y)
  ));
  const fallbackWorldX = (OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE.x + 0.5) * TILE_SIZE;
  const fallbackWorldY = (OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE.y + 0.5) * TILE_SIZE;
  const chunkCoords = (validPositions.length > 0 ? validPositions : [{ x: fallbackWorldX, y: fallbackWorldY }])
    .map((position) => getOuterDeckChunkCoordsFromWorldPixel(position.x, position.y));
  const minChunkX = Math.min(...chunkCoords.map((chunk) => chunk.chunkX));
  const maxChunkX = Math.max(...chunkCoords.map((chunk) => chunk.chunkX));
  const minChunkY = Math.min(...chunkCoords.map((chunk) => chunk.chunkY));
  const maxChunkY = Math.max(...chunkCoords.map((chunk) => chunk.chunkY));
  const centerChunkX = Math.floor((minChunkX + maxChunkX) / 2);
  const centerChunkY = Math.floor((minChunkY + maxChunkY) / 2);
  const streamRadius = clampOuterDeckStreamRadius(Math.max(
    OUTER_DECK_OPEN_WORLD_STREAM_RADIUS,
    maxChunkX - centerChunkX + OUTER_DECK_DYNAMIC_STREAM_EXTRA_MARGIN_CHUNKS,
    centerChunkX - minChunkX + OUTER_DECK_DYNAMIC_STREAM_EXTRA_MARGIN_CHUNKS,
    maxChunkY - centerChunkY + OUTER_DECK_DYNAMIC_STREAM_EXTRA_MARGIN_CHUNKS,
    centerChunkY - minChunkY + OUTER_DECK_DYNAMIC_STREAM_EXTRA_MARGIN_CHUNKS,
  ));
  return {
    centerChunkX,
    centerChunkY,
    streamRadius,
  };
}

export function shouldRecenterOuterDeckStreamWindow(map: FieldMap, worldPositions: OuterDeckStreamFocus[]): boolean {
  const metadata = getOuterDeckStreamMetadata(map);
  if (!metadata) {
    return false;
  }
  if (
    metadata.finiteDome === true
    && isApronDomeFullyLoadedInWindow(
      Number(metadata.domeRadiusTiles ?? OUTER_DECK_OPEN_WORLD_DOME_RADIUS_TILES),
      metadata.streamRadius,
    )
  ) {
    return false;
  }
  const desired = getDesiredOuterDeckStreamWindow(worldPositions);
  return desired.centerChunkX !== metadata.centerChunkX
    || desired.centerChunkY !== metadata.centerChunkY
    || desired.streamRadius !== metadata.streamRadius;
}

export function createOuterDeckOpenWorldFieldMap(state: GameState): FieldMap {
  const openWorld = getOuterDeckOpenWorldState(state);
  const streamRadius = clampOuterDeckStreamRadius(openWorld.streamRadiusChunks);
  const centerChunk = isApronDomeFullyLoadedInWindow(OUTER_DECK_OPEN_WORLD_DOME_RADIUS_TILES, streamRadius)
    ? getOuterDeckChunkCoordsFromWorldTile(
      OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.x,
      OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.y,
    )
    : getOuterDeckChunkCoordsFromWorldPixel(openWorld.streamCenterWorldX, openWorld.streamCenterWorldY);
  const originChunkX = centerChunk.chunkX - streamRadius;
  const originChunkY = centerChunk.chunkY - streamRadius;
  const windowTileSize = getOuterDeckWindowTileSize(streamRadius);
  const metadata: OuterDeckStreamMetadata = {
    kind: "outerDeckOpenWorld",
    generationVersion: OUTER_DECK_OPEN_WORLD_GENERATION_VERSION,
    seed: openWorld.seed,
    floorOrdinal: openWorld.floorOrdinal,
    worldOriginTileX: originChunkX * OUTER_DECK_OPEN_WORLD_CHUNK_SIZE,
    worldOriginTileY: originChunkY * OUTER_DECK_OPEN_WORLD_CHUNK_SIZE,
    centerChunkX: centerChunk.chunkX,
    centerChunkY: centerChunk.chunkY,
    chunkSize: OUTER_DECK_OPEN_WORLD_CHUNK_SIZE,
    streamRadius,
    tileSize: TILE_SIZE,
    finiteDome: true,
    domeCenterWorldTileX: OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.x,
    domeCenterWorldTileY: OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.y,
    domeRadiusTiles: OUTER_DECK_OPEN_WORLD_DOME_RADIUS_TILES,
  };

  const tiles: FieldMap["tiles"] = [];
  for (let localY = 0; localY < windowTileSize; localY += 1) {
    tiles[localY] = [];
    for (let localX = 0; localX < windowTileSize; localX += 1) {
      const worldTileX = metadata.worldOriginTileX + localX;
      const worldTileY = metadata.worldOriginTileY + localY;
      tiles[localY]![localX] = createTerrainTile(openWorld.seed, localX, localY, worldTileX, worldTileY);
    }
  }

  const objects: FieldObject[] = [];
  const interactionZones: InteractionZone[] = [];
  const occupied = new Set<string>();
  addHavenGate(tiles, metadata, objects, interactionZones, occupied);
  addTravelingMerchant(tiles, metadata, objects, interactionZones, occupied);
  addPlacedLanterns(openWorld, tiles, metadata, objects, occupied);

  for (let chunkY = originChunkY; chunkY <= originChunkY + (streamRadius * 2); chunkY += 1) {
    for (let chunkX = originChunkX; chunkX <= originChunkX + (streamRadius * 2); chunkX += 1) {
      addChunkContent(openWorld, tiles, metadata, objects, interactionZones, occupied, chunkX, chunkY);
    }
  }

  return {
    id: OUTER_DECK_OVERWORLD_MAP_ID,
    name: "The Apron",
    width: windowTileSize,
    height: windowTileSize,
    tiles,
    objects,
    interactionZones,
    metadata,
  };
}

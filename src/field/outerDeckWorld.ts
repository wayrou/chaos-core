import type { GameState } from "../core/types";
import {
  OUTER_DECK_OPEN_WORLD_CHUNK_SIZE,
  OUTER_DECK_OPEN_WORLD_GENERATION_VERSION,
  OUTER_DECK_OPEN_WORLD_STREAM_RADIUS,
  OUTER_DECK_OPEN_WORLD_TILE_SIZE,
  OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE,
  OUTER_DECK_OVERWORLD_HAVEN_GATE_ZONE_ID,
  OUTER_DECK_OVERWORLD_MAP_ID,
  getOuterDeckOpenWorldState,
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
  worldOriginTileX: number;
  worldOriginTileY: number;
  centerChunkX: number;
  centerChunkY: number;
  chunkSize: number;
  streamRadius: number;
  tileSize: number;
};

type GeneratedTile = FieldMap["tiles"][number][number];

type ResourceSpec = {
  resourceType: "metalScrap" | "wood" | "chaosShards" | "steamComponents";
  name: string;
};

type BossSpec = {
  zoneId: OuterDeckZoneId | null;
  archetype: string;
  name: string;
  enemyKind: string;
  drops: OuterDeckRewardBundle;
};

const WINDOW_CHUNK_SPAN = OUTER_DECK_OPEN_WORLD_STREAM_RADIUS * 2 + 1;
const WINDOW_TILE_SIZE = OUTER_DECK_OPEN_WORLD_CHUNK_SIZE * WINDOW_CHUNK_SPAN;
const TILE_SIZE = OUTER_DECK_OPEN_WORLD_TILE_SIZE;

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

function createTerrainTile(seed: number, localX: number, localY: number, worldTileX: number, worldTileY: number): GeneratedTile {
  const withinChunkX = mod(worldTileX, OUTER_DECK_OPEN_WORLD_CHUNK_SIZE);
  const withinChunkY = mod(worldTileY, OUTER_DECK_OPEN_WORLD_CHUNK_SIZE);
  const borderCorridor = withinChunkX <= 1
    || withinChunkY <= 1
    || withinChunkX >= OUTER_DECK_OPEN_WORLD_CHUNK_SIZE - 2
    || withinChunkY >= OUTER_DECK_OPEN_WORLD_CHUNK_SIZE - 2;
  const rampCorridor = withinChunkX >= 10 && withinChunkX <= 13
    || withinChunkY >= 10 && withinChunkY <= 13;
  const havenPad = isNearHaven(worldTileX, worldTileY);
  const terrainNoise = layeredNoise(seed, worldTileX, worldTileY, 100);
  const cutNoise = layeredNoise(seed, worldTileX + 91, worldTileY - 57, 400);
  const ridgeNoise = layeredNoise(seed, worldTileX - 47, worldTileY + 131, 700);
  const radial = Math.hypot(worldTileX, worldTileY);
  const rawElevation = Math.floor(
    Math.max(0, Math.min(4.85, (terrainNoise * 4.6) + (ridgeNoise * 1.4) + Math.min(1.2, radial / 150) - 1.25)),
  );
  const elevation = havenPad || borderCorridor ? Math.min(rawElevation, havenPad ? 0 : 1) : rawElevation;
  const brokenVoid = !havenPad && !borderCorridor && !rampCorridor && cutNoise > 0.755;
  const highWall = !havenPad && !borderCorridor && !rampCorridor && ridgeNoise > 0.86 && terrainNoise < 0.48;
  const walkable = !brokenVoid && !highWall;
  const type: TileType = !walkable
    ? "wall"
    : elevation >= 3
      ? "stone"
      : rampCorridor || borderCorridor
        ? "floor"
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
  };
}

function getLocalTileFromWorldTile(metadata: OuterDeckStreamMetadata, worldTileX: number, worldTileY: number): { x: number; y: number } | null {
  const x = worldTileX - metadata.worldOriginTileX;
  const y = worldTileY - metadata.worldOriginTileY;
  if (x < 0 || y < 0 || x >= WINDOW_TILE_SIZE || y >= WINDOW_TILE_SIZE) {
    return null;
  }
  return { x, y };
}

function getTile(tiles: FieldMap["tiles"], localX: number, localY: number): GeneratedTile | null {
  return tiles[localY]?.[localX] ?? null;
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

function addHavenGate(
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  objects: FieldObject[],
  interactionZones: InteractionZone[],
  occupied: Set<string>,
): void {
  const local = getLocalTileFromWorldTile(
    metadata,
    OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE.x,
    OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE.y,
  );
  if (!local) {
    return;
  }

  for (let y = local.y; y < local.y + 2; y += 1) {
    for (let x = local.x; x < local.x + 2; x += 1) {
      const tile = getTile(tiles, x, y);
      if (tile) {
        tile.walkable = true;
        tile.type = "floor";
        tile.elevation = 0;
      }
    }
  }

  objects.push({
    id: "outer_deck_world_haven_airlock",
    x: local.x,
    y: local.y,
    width: 2,
    height: 2,
    type: "station",
    sprite: "bulkhead",
    metadata: {
      name: "HAVEN ACCESS",
      worldTileX: OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE.x,
      worldTileY: OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE.y,
    },
  });
  interactionZones.push({
    id: OUTER_DECK_OVERWORLD_HAVEN_GATE_ZONE_ID,
    x: local.x,
    y: local.y,
    width: 2,
    height: 2,
    action: "custom",
    label: "RETURN TO HAVEN",
    metadata: {
      handlerId: "outer_deck_return_to_haven",
      autoTrigger: true,
    },
  });
  markOccupied(occupied, local.x, local.y, 2, 2);
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
  const count = 2 + (random01(seed, chunkX, chunkY, 4100) > 0.52 ? 1 : 0);
  for (let index = 0; index < count; index += 1) {
    const spawn = findChunkSpawnTile(seed, tiles, metadata, occupied, chunkX, chunkY, 4200 + index, {
      preferHigh: true,
      avoidOrigin: false,
    });
    if (!spawn) {
      continue;
    }

    objects.push({
      id: `${objectPrefix(chunkX, chunkY)}_grapple_${index}`,
      x: spawn.localX,
      y: spawn.localY,
      width: 1,
      height: 1,
      type: "decoration",
      sprite: "grapple_anchor",
      metadata: {
        name: "Swing Node",
        grappleAnchor: true,
        anchorHeight: 3.0 + (spawn.elevation * 0.42) + (random01(seed, chunkX, chunkY, 4300 + index) * 1.25),
        worldTileX: spawn.worldTileX,
        worldTileY: spawn.worldTileY,
        elevation: spawn.elevation,
      },
    });
    markOccupied(occupied, spawn.localX, spawn.localY);
  }
}

function addChunkContent(
  openWorld: OuterDeckOpenWorldState,
  tiles: FieldMap["tiles"],
  metadata: OuterDeckStreamMetadata,
  objects: FieldObject[],
  occupied: Set<string>,
  chunkX: number,
  chunkY: number,
): void {
  addChunkBoss(openWorld, tiles, metadata, objects, occupied, chunkX, chunkY);
  addChunkResources(openWorld, tiles, metadata, objects, occupied, chunkX, chunkY);
  addChunkEnemies(openWorld, tiles, metadata, objects, occupied, chunkX, chunkY);
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

export function shouldRecenterOuterDeckStreamWindow(map: FieldMap, worldX: number, worldY: number): boolean {
  const metadata = getOuterDeckStreamMetadata(map);
  if (!metadata) {
    return false;
  }
  const chunk = getOuterDeckChunkCoordsFromWorldPixel(worldX, worldY);
  return chunk.chunkX !== metadata.centerChunkX || chunk.chunkY !== metadata.centerChunkY;
}

export function createOuterDeckOpenWorldFieldMap(state: GameState): FieldMap {
  const openWorld = getOuterDeckOpenWorldState(state);
  const centerChunk = getOuterDeckChunkCoordsFromWorldPixel(openWorld.playerWorldX, openWorld.playerWorldY);
  const originChunkX = centerChunk.chunkX - OUTER_DECK_OPEN_WORLD_STREAM_RADIUS;
  const originChunkY = centerChunk.chunkY - OUTER_DECK_OPEN_WORLD_STREAM_RADIUS;
  const metadata: OuterDeckStreamMetadata = {
    kind: "outerDeckOpenWorld",
    generationVersion: OUTER_DECK_OPEN_WORLD_GENERATION_VERSION,
    seed: openWorld.seed,
    worldOriginTileX: originChunkX * OUTER_DECK_OPEN_WORLD_CHUNK_SIZE,
    worldOriginTileY: originChunkY * OUTER_DECK_OPEN_WORLD_CHUNK_SIZE,
    centerChunkX: centerChunk.chunkX,
    centerChunkY: centerChunk.chunkY,
    chunkSize: OUTER_DECK_OPEN_WORLD_CHUNK_SIZE,
    streamRadius: OUTER_DECK_OPEN_WORLD_STREAM_RADIUS,
    tileSize: TILE_SIZE,
  };

  const tiles: FieldMap["tiles"] = [];
  for (let localY = 0; localY < WINDOW_TILE_SIZE; localY += 1) {
    tiles[localY] = [];
    for (let localX = 0; localX < WINDOW_TILE_SIZE; localX += 1) {
      const worldTileX = metadata.worldOriginTileX + localX;
      const worldTileY = metadata.worldOriginTileY + localY;
      tiles[localY]![localX] = createTerrainTile(openWorld.seed, localX, localY, worldTileX, worldTileY);
    }
  }

  const objects: FieldObject[] = [];
  const interactionZones: InteractionZone[] = [];
  const occupied = new Set<string>();
  addHavenGate(tiles, metadata, objects, interactionZones, occupied);

  for (let chunkY = originChunkY; chunkY <= originChunkY + (OUTER_DECK_OPEN_WORLD_STREAM_RADIUS * 2); chunkY += 1) {
    for (let chunkX = originChunkX; chunkX <= originChunkX + (OUTER_DECK_OPEN_WORLD_STREAM_RADIUS * 2); chunkX += 1) {
      addChunkContent(openWorld, tiles, metadata, objects, occupied, chunkX, chunkY);
    }
  }

  return {
    id: OUTER_DECK_OVERWORLD_MAP_ID,
    name: "Outer Deck Wilds",
    width: WINDOW_TILE_SIZE,
    height: WINDOW_TILE_SIZE,
    tiles,
    objects,
    interactionZones,
    metadata,
  };
}

import {
  getAllImportedFieldEnemyDefinitions,
  getImportedFieldMap,
} from "../content/technica";
import { loadCampaignProgress } from "../core/campaign";
import { createEmptyResourceWallet, RESOURCE_KEYS } from "../core/resources";
import type { ImportedFieldEnemyDefinition } from "../content/technica/types";
import type { FieldEnemy, FieldMap, FieldObject } from "./types";
import { normalizeHaven3DEnemyAttackStyle } from "./haven3d/enemyMoves";

const TILE_SIZE = 64;
const DEFAULT_ENEMY_WIDTH = 40;
const DEFAULT_ENEMY_HEIGHT = 40;
const DEFAULT_ENEMY_HP = 3;
const DEFAULT_ENEMY_SPEED = 90;
const DEFAULT_AGGRO_RANGE = 200;
const DEFAULT_IMPORTED_SPAWN_COUNT = 1;

type SpawnPoint = {
  x: number;
  y: number;
};

function coercePositiveNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}

function coerceNonNegativeInteger(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }

  return fallback;
}

function coercePositiveInteger(value: unknown, fallback: number) {
  return Math.max(1, coerceNonNegativeInteger(value, fallback));
}

function getEnemyName(object: FieldObject) {
  const metadataName = typeof object.metadata?.name === "string" ? object.metadata.name.trim() : "";
  const objectName = metadataName || object.id || "field_enemy";
  return objectName;
}

export function isEnemyFieldObject(object: FieldObject) {
  return object.type === "enemy";
}

function getCurrentFloorOrdinal(): number | null {
  const activeRun = loadCampaignProgress().activeRun;
  if (!activeRun || !Number.isFinite(activeRun.floorIndex)) {
    return null;
  }

  return Math.max(1, Math.floor(activeRun.floorIndex) + 1);
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry !== "string") {
      return [];
    }

    const trimmed = entry.trim();
    return trimmed ? [trimmed] : [];
  });
}

function normalizeFloorOrdinals(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.flatMap((entry) => {
        if (typeof entry === "number" && Number.isFinite(entry) && entry > 0) {
          return [Math.floor(entry)];
        }

        if (typeof entry === "string") {
          const parsed = Number(entry);
          if (Number.isFinite(parsed) && parsed > 0) {
            return [Math.floor(parsed)];
          }
        }

        return [];
      }),
    ),
  );
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

function buildBlockedTileSet(map: FieldMap): Set<string> {
  const blocked = new Set<string>();

  const blockRect = (left: number, top: number, width: number, height: number) => {
    for (let y = top; y < top + height; y += 1) {
      for (let x = left; x < left + width; x += 1) {
        blocked.add(`${x}:${y}`);
      }
    }
  };

  map.objects.forEach((object) => {
    blockRect(object.x, object.y, object.width, object.height);
  });

  map.interactionZones.forEach((zone) => {
    blockRect(zone.x, zone.y, zone.width, zone.height);
  });

  return blocked;
}

function getAvailableSpawnPoints(map: FieldMap): SpawnPoint[] {
  const blockedTiles = buildBlockedTileSet(map);
  const points: SpawnPoint[] = [];

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = map.tiles[y]?.[x];
      if (!tile?.walkable || blockedTiles.has(`${x}:${y}`)) {
        continue;
      }

      points.push({
        x: (x * TILE_SIZE) + (TILE_SIZE / 2),
        y: (y * TILE_SIZE) + (TILE_SIZE / 2),
      });
    }
  }

  return points;
}

function takeDeterministicSpawnPointsFromPool(
  pool: SpawnPoint[],
  seedSource: string,
  count: number,
): SpawnPoint[] {
  const selected: SpawnPoint[] = [];
  const random = createSeededRandom(createSeedFromString(seedSource));

  while (selected.length < count && pool.length > 0) {
    const nextIndex = Math.floor(random() * pool.length);
    const nextPoint = pool.splice(nextIndex, 1)[0];
    if (nextPoint) {
      selected.push(nextPoint);
    }
  }

  return selected;
}

function buildEnemyPersistentKey(enemy: FieldEnemy): string {
  if (enemy.sourceObjectId) {
    return `object:${enemy.sourceObjectId}`;
  }

  if (enemy.spawnKey) {
    return `spawn:${enemy.spawnKey}`;
  }

  return `runtime:${enemy.id}`;
}

function createObjectPersistentKey(objectId: string): string {
  return `object:${objectId}`;
}

function createImportedSpawnKey(mapId: string, definitionId: string, instanceIndex: number): string {
  return `${mapId}:${definitionId}:${instanceIndex}`;
}

function buildImportedEnemyDrops(definition: ImportedFieldEnemyDefinition): FieldEnemy["drops"] | undefined {
  const wad = coerceNonNegativeInteger(definition.drops?.wad, 0);
  const resources = createEmptyResourceWallet();
  RESOURCE_KEYS.forEach((key) => {
    resources[key] = coerceNonNegativeInteger(definition.drops?.resources?.[key], 0);
  });
  const items = Array.isArray(definition.drops?.items)
    ? definition.drops.items.flatMap((item) => {
        if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id.trim()) {
          return [];
        }

        const quantity = coercePositiveInteger(item.quantity, 1);
        const rawChance = typeof item.chance === "number" && Number.isFinite(item.chance) ? item.chance : 1;

        return [{
          id: item.id.trim(),
          quantity,
          chance: Math.min(1, Math.max(0, rawChance)),
        }];
      })
    : [];

  if (
    wad <= 0 &&
    RESOURCE_KEYS.every((key) => resources[key] <= 0) &&
    items.length === 0
  ) {
    return undefined;
  }

  return {
    wad,
    resources,
    items,
  };
}

function coerceGearbladeDefense(value: unknown, fallback: FieldEnemy["gearbladeDefense"] = "none"): FieldEnemy["gearbladeDefense"] {
  return value === "shield" || value === "armor" || value === "none" ? value : fallback;
}

function coerceEnemyAttackStyle(value: unknown, fallback: FieldEnemy["attackStyle"]): FieldEnemy["attackStyle"] {
  return normalizeHaven3DEnemyAttackStyle(value, fallback) ?? undefined;
}

function buildObjectEnemyDrops(object: FieldObject): FieldEnemy["drops"] | undefined {
  const rawDrops = object.metadata?.drops as Record<string, unknown> | undefined;
  if (!rawDrops) {
    return undefined;
  }

  const wad = coerceNonNegativeInteger(rawDrops.wad, 0);
  const resources = {
    metalScrap: coerceNonNegativeInteger((rawDrops.resources as Record<string, unknown> | undefined)?.metalScrap, 0),
    wood: coerceNonNegativeInteger((rawDrops.resources as Record<string, unknown> | undefined)?.wood, 0),
    chaosShards: coerceNonNegativeInteger((rawDrops.resources as Record<string, unknown> | undefined)?.chaosShards, 0),
    steamComponents: coerceNonNegativeInteger((rawDrops.resources as Record<string, unknown> | undefined)?.steamComponents, 0),
  };

  if (wad <= 0 && Object.values(resources).every((amount) => amount <= 0)) {
    return undefined;
  }

  return {
    wad,
    resources,
    items: [],
  };
}

function matchesImportedDefinitionForMap(
  definition: ImportedFieldEnemyDefinition,
  map: FieldMap,
  floorOrdinal: number | null,
): boolean {
  const mapId = String(map.id);
  const mapIds = normalizeStringArray(definition.spawn?.mapIds);
  if (mapIds.includes(mapId)) {
    return true;
  }

  if (!getImportedFieldMap(mapId) || floorOrdinal === null) {
    return false;
  }

  const floorOrdinals = normalizeFloorOrdinals(definition.spawn?.floorOrdinals);
  return floorOrdinals.includes(floorOrdinal);
}

export function syncFieldEnemiesForMap(
  map: FieldMap,
  currentEnemies: FieldEnemy[] = [],
  currentTime = Date.now()
): FieldEnemy[] {
  const currentEnemyByPersistentKey = new Map(
    currentEnemies.map((enemy) => [buildEnemyPersistentKey(enemy), enemy]),
  );

  const nextEnemies = map.objects
    .filter(isEnemyFieldObject)
    .map((object) => {
      const existing = currentEnemyByPersistentKey.get(createObjectPersistentKey(object.id));
      const maxHp = coercePositiveNumber(object.metadata?.hp, existing?.maxHp ?? DEFAULT_ENEMY_HP);
      const nextBase: FieldEnemy = {
        id: existing?.id ?? `field_enemy_${object.id}`,
        name: getEnemyName(object),
        x: (object.x + object.width / 2) * TILE_SIZE,
        y: (object.y + object.height / 2) * TILE_SIZE,
        width: coercePositiveNumber(object.metadata?.width, existing?.width ?? DEFAULT_ENEMY_WIDTH),
        height: coercePositiveNumber(object.metadata?.height, existing?.height ?? DEFAULT_ENEMY_HEIGHT),
        hp: maxHp,
        maxHp,
        speed: coercePositiveNumber(object.metadata?.speed, existing?.speed ?? DEFAULT_ENEMY_SPEED),
        facing: existing?.facing ?? "south",
        lastMoveTime: existing?.lastMoveTime ?? currentTime,
        deathAnimTime: existing?.deathAnimTime,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        knockbackTime: existing?.knockbackTime ?? 0,
        aggroRange: coercePositiveNumber(object.metadata?.aggroRange, existing?.aggroRange ?? DEFAULT_AGGRO_RANGE),
        gearbladeDefense: coerceGearbladeDefense(object.metadata?.gearbladeDefense, existing?.gearbladeDefense),
        gearbladeDefenseBroken: existing?.gearbladeDefenseBroken ?? false,
        attackStyle: coerceEnemyAttackStyle(object.metadata?.attackStyle, existing?.attackStyle),
        sourceObjectId: object.id,
        kind: typeof object.metadata?.enemyKind === "string" ? object.metadata.enemyKind : "light",
        spriteKey:
          typeof object.metadata?.spriteKey === "string"
            ? object.metadata.spriteKey
            : object.sprite || existing?.spriteKey,
        spritePath:
          typeof object.metadata?.spritePath === "string"
            ? object.metadata.spritePath
            : existing?.spritePath,
        drops: existing?.drops ?? buildObjectEnemyDrops(object),
      };

      if (!existing) {
        return nextBase;
      }

      return {
        ...nextBase,
        x: existing.x,
        y: existing.y,
        hp: Math.min(Math.max(existing.hp, 0), maxHp),
      };
    });

  const floorOrdinal = getCurrentFloorOrdinal();
  const availableSpawnPoints = getAvailableSpawnPoints(map);
  const importedDefinitions = getAllImportedFieldEnemyDefinitions()
    .filter((definition) => matchesImportedDefinitionForMap(definition, map, floorOrdinal))
    .sort((left, right) => left.id.localeCompare(right.id));

  importedDefinitions.forEach((definition) => {
    const spawnCount = coercePositiveInteger(definition.spawn?.count, DEFAULT_IMPORTED_SPAWN_COUNT);
    const spawnPoints = takeDeterministicSpawnPointsFromPool(
      availableSpawnPoints,
      `${map.id}:${definition.id}`,
      spawnCount,
    );
    const maxHp = coercePositiveNumber(definition.stats.maxHp, DEFAULT_ENEMY_HP);
    const width = coercePositiveNumber(definition.stats.width, DEFAULT_ENEMY_WIDTH);
    const height = coercePositiveNumber(definition.stats.height, DEFAULT_ENEMY_HEIGHT);
    const drops = buildImportedEnemyDrops(definition);

    for (let index = 0; index < spawnCount; index += 1) {
      const spawnKey = createImportedSpawnKey(String(map.id), definition.id, index);
      const existing = currentEnemyByPersistentKey.get(`spawn:${spawnKey}`);
      const spawnPoint = spawnPoints[index];

      if (!spawnPoint && !existing) {
        continue;
      }

      nextEnemies.push({
        id: existing?.id ?? `field_enemy_${String(map.id)}_${definition.id}_${index + 1}`,
        name: definition.name,
        x: existing?.x ?? spawnPoint?.x ?? 0,
        y: existing?.y ?? spawnPoint?.y ?? 0,
        width,
        height,
        hp: existing ? Math.min(Math.max(existing.hp, 0), maxHp) : maxHp,
        maxHp,
        speed: coercePositiveNumber(definition.stats.speed, DEFAULT_ENEMY_SPEED),
        facing: existing?.facing ?? "south",
        lastMoveTime: existing?.lastMoveTime ?? currentTime,
        deathAnimTime: existing?.deathAnimTime,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        knockbackTime: existing?.knockbackTime ?? 0,
        aggroRange: coercePositiveNumber(definition.stats.aggroRange, DEFAULT_AGGRO_RANGE),
        gearbladeDefense: coerceGearbladeDefense(definition.metadata?.gearbladeDefense, existing?.gearbladeDefense),
        gearbladeDefenseBroken: existing?.gearbladeDefenseBroken ?? false,
        attackStyle: coerceEnemyAttackStyle(definition.metadata?.attackStyle, existing?.attackStyle),
        sourceDefinitionId: definition.id,
        spawnKey,
        kind: definition.kind?.trim() || "light",
        spriteKey: definition.spriteKey ?? existing?.spriteKey,
        spritePath: definition.spritePath ?? existing?.spritePath,
        drops,
      });
    }
  });

  return nextEnemies;
}

export function hasLiveFieldEnemies(enemies: FieldEnemy[] = []) {
  return enemies.some((enemy) => enemy.hp > 0);
}

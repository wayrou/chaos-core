import { loadCampaignProgress } from "../core/campaign";
import {
  OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE,
  OUTER_DECK_OVERWORLD_HAVEN_GATE_ZONE_ID,
  OUTER_DECK_OVERWORLD_MAP_ID,
  buildOuterDeckInteriorMapId,
  getCurrentOuterDeckSubarea,
  getOuterDeckInteriorLootKey,
  getOuterDeckInteriorRoomKey,
  getOuterDeckInteriorSpec,
  getOuterDeckOpenWorldState,
  getOuterDeckCompletionReward,
  getOuterDeckOverworldGateTile,
  getOuterDeckSubareaByMapId,
  getOuterDeckZoneDefinition,
  getOuterDeckZoneGateLabel,
  getOuterDeckZoneLockedMessage,
  hasOuterDeckCacheBeenClaimed,
  hasOuterDeckZoneBeenReclaimed,
  hasSeenOuterDeckNpcEncounter,
  isOuterDeckMechanicResolved,
  isOuterDeckInteriorMap,
  isOuterDeckOverworldMap,
  isOuterDeckSubareaCleared,
  isOuterDeckZoneUnlocked,
  parseOuterDeckInteriorMapId,
  type OuterDeckInteriorMapRef,
  type OuterDeckMechanicId,
  type OuterDeckRewardBundle,
  type OuterDeckSubareaSpec,
  type OuterDeckZoneId,
} from "../core/outerDecks";
import { getGameState } from "../state/gameStore";
import type { GameState } from "../core/types";
import type { FieldMap, FieldObject, InteractionZone } from "./types";
import { createOuterDeckOpenWorldFieldMap } from "./outerDeckWorld";

const OVERWORLD_WIDTH = 140;
const OVERWORLD_HEIGHT = 90;
const HAVEN_FOOTPRINT_WIDTH = 50;
const HAVEN_FOOTPRINT_HEIGHT = 25;
const HAVEN_FOOTPRINT_LEFT = Math.floor((OVERWORLD_WIDTH - HAVEN_FOOTPRINT_WIDTH) / 2);
const HAVEN_FOOTPRINT_TOP = Math.floor((OVERWORLD_HEIGHT - HAVEN_FOOTPRINT_HEIGHT) / 2);
const HAVEN_RING_MARGIN = 8;
const BRANCH_WIDTH = 22;
const BRANCH_HEIGHT = 14;
const INTERIOR_WIDTH = 22;
const INTERIOR_HEIGHT = 16;

type TileType = FieldMap["tiles"][number][number]["type"];

function createStableMapSeed(...parts: Array<string | number>): number {
  let hash = 2166136261;
  parts.forEach((part) => {
    const text = String(part);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 97531;
    hash = Math.imul(hash, 16777619);
  });
  return hash >>> 0;
}

function randomFromSeed(seed: number): () => number {
  let current = seed >>> 0;
  return () => {
    current = (Math.imul(current, 1664525) + 1013904223) >>> 0;
    return current / 0x100000000;
  };
}

function randomIntFrom(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function createTiles(width: number, height: number, fillType: TileType): FieldMap["tiles"] {
  const tiles: FieldMap["tiles"] = [];
  for (let y = 0; y < height; y += 1) {
    tiles[y] = [];
    for (let x = 0; x < width; x += 1) {
      const boundary = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      tiles[y][x] = {
        x,
        y,
        walkable: !boundary,
        type: boundary ? "wall" : fillType,
      };
    }
  }
  return tiles;
}

function setTile(
  tiles: FieldMap["tiles"],
  x: number,
  y: number,
  walkable: boolean,
  type: TileType,
): void {
  if (!tiles[y]?.[x]) {
    return;
  }
  tiles[y][x] = {
    ...tiles[y][x],
    walkable,
    type,
  };
}

function fillRect(
  tiles: FieldMap["tiles"],
  left: number,
  top: number,
  width: number,
  height: number,
  walkable: boolean,
  type: TileType,
): void {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      setTile(tiles, x, y, walkable, type);
    }
  }
}

function carveLine(
  tiles: FieldMap["tiles"],
  from: { x: number; y: number },
  to: { x: number; y: number },
  thickness: number,
  type: TileType,
): void {
  if (from.x === to.x) {
    fillRect(tiles, from.x, Math.min(from.y, to.y), thickness, Math.abs(to.y - from.y) + 1, true, type);
    return;
  }
  if (from.y === to.y) {
    fillRect(tiles, Math.min(from.x, to.x), from.y, Math.abs(to.x - from.x) + 1, thickness, true, type);
  }
}

function getZoneFloorType(zoneId: OuterDeckZoneId): TileType {
  switch (zoneId) {
    case "counterweight_shaft":
      return "stone";
    case "outer_scaffold":
      return "floor";
    case "drop_bay":
      return "stone";
    case "supply_intake_port":
      return "floor";
    default:
      return "floor";
  }
}

function buildEnemyReward(zoneId: OuterDeckZoneId, index: number): OuterDeckRewardBundle {
  switch (zoneId) {
    case "counterweight_shaft":
      return {
        wad: 18 + (index * 4),
        resources: {
          metalScrap: 1,
          steamComponents: index % 2 === 0 ? 1 : 0,
        },
      };
    case "outer_scaffold":
      return {
        wad: 20 + (index * 4),
        resources: {
          wood: 1,
          steamComponents: index % 2 === 0 ? 1 : 0,
        },
      };
    case "drop_bay":
      return {
        wad: 22 + (index * 5),
        resources: {
          metalScrap: 1,
          wood: 1,
        },
      };
    case "supply_intake_port":
      return {
        wad: 24 + (index * 5),
        resources: {
          chaosShards: index % 2 === 0 ? 1 : 0,
          steamComponents: 1,
        },
      };
    default:
      return {};
  }
}

function buildEliteEnemyReward(zoneId: OuterDeckZoneId): OuterDeckRewardBundle {
  switch (zoneId) {
    case "counterweight_shaft":
      return { wad: 42, resources: { metalScrap: 2, steamComponents: 2 } };
    case "outer_scaffold":
      return { wad: 46, resources: { wood: 2, steamComponents: 2 } };
    case "drop_bay":
      return { wad: 50, resources: { metalScrap: 2, wood: 2, steamComponents: 1 } };
    case "supply_intake_port":
      return { wad: 54, resources: { chaosShards: 2, steamComponents: 2, wood: 1 } };
    default:
      return {};
  }
}

function getZoneSalvageResourceSpec(
  zoneId: OuterDeckZoneId,
  kind: OuterDeckSubareaSpec["kind"] | "overworld",
): { resourceType: "metalScrap" | "wood" | "chaosShards" | "steamComponents"; amount: number; name: string } {
  switch (zoneId) {
    case "counterweight_shaft":
      return {
        resourceType: "steamComponents",
        amount: kind === "reward" ? 2 : 1,
        name: "Lift Parts",
      };
    case "outer_scaffold":
      return {
        resourceType: "wood",
        amount: kind === "reward" ? 2 : 1,
        name: "Rigging Bundle",
      };
    case "drop_bay":
      return {
        resourceType: "metalScrap",
        amount: kind === "reward" ? 2 : 1,
        name: "Cargo Scrap",
      };
    case "supply_intake_port":
      return {
        resourceType: kind === "overworld" ? "steamComponents" : "chaosShards",
        amount: kind === "reward" ? 2 : 1,
        name: kind === "overworld" ? "Sorter Parts" : "Quarantine Resin",
      };
    default:
      return {
        resourceType: "metalScrap",
        amount: 1,
        name: "Loose Salvage",
      };
  }
}

function buildEnemyObjects(subarea: OuterDeckSubareaSpec): FieldObject[] {
  if (subarea.kind === "reward") {
    return buildRewardRoomEnemyObjects(subarea);
  }

  const positions = [
    { x: 7, y: 4 },
    { x: 14, y: 4 },
    { x: 11, y: 8 },
    { x: 6, y: 9 },
  ];

  return subarea.enemyKinds.slice(0, subarea.enemyCount).map((enemyKind, index) => {
    const position = positions[index] ?? positions[positions.length - 1]!;
    return {
      id: `${subarea.id.replace(/[:]/g, "_")}_enemy_${index + 1}`,
      x: position.x,
      y: position.y,
      width: 1,
      height: 1,
      type: "enemy",
      sprite: "field_enemy",
      metadata: {
        name: enemyKind.replace(/_/g, " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase()),
        enemyKind,
        hp: subarea.kind === "reward" ? 5 : 3,
        speed: 90,
        aggroRange: 240,
        drops: buildEnemyReward(subarea.zoneId, index),
      },
    };
  });
}

type OuterDeckEliteSpec = {
  name: string;
  enemyKind: string;
  hp: number;
  speed: number;
  aggroRange: number;
  width: number;
  height: number;
};

const OUTER_DECK_ELITE_SPECS: Record<OuterDeckZoneId, OuterDeckEliteSpec> = {
  counterweight_shaft: {
    name: "Lift Spine Overseer",
    enemyKind: "counterweight_overseer",
    hp: 8,
    speed: 96,
    aggroRange: 288,
    width: 48,
    height: 48,
  },
  outer_scaffold: {
    name: "Relay Roost Warden",
    enemyKind: "relay_warden",
    hp: 8,
    speed: 104,
    aggroRange: 304,
    width: 48,
    height: 48,
  },
  drop_bay: {
    name: "Dispatch Cradle Brute",
    enemyKind: "dispatch_brute",
    hp: 9,
    speed: 92,
    aggroRange: 288,
    width: 52,
    height: 52,
  },
  supply_intake_port: {
    name: "Quarantine Lock Sentinel",
    enemyKind: "quarantine_sentinel",
    hp: 9,
    speed: 94,
    aggroRange: 296,
    width: 52,
    height: 52,
  },
};

function buildRewardRoomEnemyObjects(subarea: OuterDeckSubareaSpec): FieldObject[] {
  const elite = OUTER_DECK_ELITE_SPECS[subarea.zoneId];
  const escortKind = subarea.enemyKinds.find((enemyKind) => enemyKind !== elite.enemyKind) ?? subarea.enemyKinds[0];
  const objects: FieldObject[] = [
    {
      id: `${subarea.id.replace(/[:]/g, "_")}_elite`,
      x: 11,
      y: 6,
      width: 1,
      height: 1,
      type: "enemy",
      sprite: "field_enemy",
      metadata: {
        name: elite.name,
        enemyKind: elite.enemyKind,
        hp: elite.hp,
        width: elite.width,
        height: elite.height,
        speed: elite.speed,
        aggroRange: elite.aggroRange,
        drops: buildEliteEnemyReward(subarea.zoneId),
      },
    },
  ];

  if (escortKind) {
    objects.push({
      id: `${subarea.id.replace(/[:]/g, "_")}_escort`,
      x: 7,
      y: 8,
      width: 1,
      height: 1,
      type: "enemy",
      sprite: "field_enemy",
      metadata: {
        name: formatEnemyLabel(escortKind),
        enemyKind: escortKind,
        hp: 4,
        speed: 94,
        aggroRange: 240,
        drops: buildEnemyReward(subarea.zoneId, 0),
      },
    });
  }

  return objects;
}

type OverworldPlaceholderEnemySpec = {
  id: string;
  zoneId: OuterDeckZoneId;
  x: number;
  y: number;
  enemyKind: string;
  hp?: number;
  speed?: number;
  aggroRange?: number;
};

type OverworldSalvageSpec = {
  id: string;
  zoneId: OuterDeckZoneId;
  x: number;
  y: number;
  name: string;
  amount?: number;
};

const OVERWORLD_PLACEHOLDER_ENEMIES: OverworldPlaceholderEnemySpec[] = [
  { id: "outer_deck_overworld_enemy_north_a", zoneId: "counterweight_shaft", x: 66, y: 16, enemyKind: "maintenance_drone" },
  { id: "outer_deck_overworld_enemy_north_b", zoneId: "counterweight_shaft", x: 73, y: 23, enemyKind: "climbing_scavenger" },
  { id: "outer_deck_overworld_enemy_east_a", zoneId: "outer_scaffold", x: 111, y: 41, enemyKind: "sentry_construct" },
  { id: "outer_deck_overworld_enemy_east_b", zoneId: "outer_scaffold", x: 122, y: 48, enemyKind: "scavenger_sniper" },
  { id: "outer_deck_overworld_enemy_south_a", zoneId: "drop_bay", x: 64, y: 71, enemyKind: "cargo_looter" },
  { id: "outer_deck_overworld_enemy_south_b", zoneId: "drop_bay", x: 76, y: 76, enemyKind: "industrial_construct" },
  { id: "outer_deck_overworld_enemy_west_a", zoneId: "supply_intake_port", x: 18, y: 41, enemyKind: "sort_bot" },
  { id: "outer_deck_overworld_enemy_west_b", zoneId: "supply_intake_port", x: 27, y: 48, enemyKind: "smuggler_runner" },
];

const OVERWORLD_EXTRA_SALVAGE: OverworldSalvageSpec[] = [
  { id: "outer_deck_overworld_salvage_north_inner", zoneId: "counterweight_shaft", x: 61, y: 20, name: "Shaft Couplings" },
  { id: "outer_deck_overworld_salvage_north_outer", zoneId: "counterweight_shaft", x: 78, y: 27, name: "Lift Bearings" },
  { id: "outer_deck_overworld_salvage_east_inner", zoneId: "outer_scaffold", x: 106, y: 47, name: "Relay Cable" },
  { id: "outer_deck_overworld_salvage_east_outer", zoneId: "outer_scaffold", x: 127, y: 39, name: "Rigging Spool" },
  { id: "outer_deck_overworld_salvage_south_inner", zoneId: "drop_bay", x: 60, y: 78, name: "Freight Latch" },
  { id: "outer_deck_overworld_salvage_south_outer", zoneId: "drop_bay", x: 80, y: 69, name: "Cargo Scrap Bin" },
  { id: "outer_deck_overworld_salvage_west_inner", zoneId: "supply_intake_port", x: 14, y: 46, name: "Sorter Parts" },
  { id: "outer_deck_overworld_salvage_west_outer", zoneId: "supply_intake_port", x: 31, y: 40, name: "Supply Canister" },
];

function formatEnemyLabel(enemyKind: string): string {
  return enemyKind.replace(/_/g, " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase());
}

function buildOverworldEnemyObjects(state: GameState): FieldObject[] {
  return OVERWORLD_PLACEHOLDER_ENEMIES
    .filter((enemy) => !hasOuterDeckZoneBeenReclaimed(state, enemy.zoneId))
    .map((enemy, index) => ({
    id: enemy.id,
    x: enemy.x,
    y: enemy.y,
    width: 1,
    height: 1,
    type: "enemy",
    sprite: "field_enemy",
    metadata: {
      name: formatEnemyLabel(enemy.enemyKind),
      enemyKind: enemy.enemyKind,
      hp: enemy.hp ?? 4,
      speed: enemy.speed ?? 84,
      aggroRange: enemy.aggroRange ?? 224,
      drops: buildEnemyReward(enemy.zoneId, index % 2),
    },
    }));
}

function buildOverworldSalvageObjects(state: GameState): FieldObject[] {
  const baseSalvage: FieldObject[] = OVERWORLD_EXTRA_SALVAGE.map((salvage) => {
    const salvageSpec = getZoneSalvageResourceSpec(salvage.zoneId, "overworld");
    return {
      id: salvage.id,
      x: salvage.x,
      y: salvage.y,
      width: 1,
      height: 1,
      type: "resource" as const,
      sprite: "resource",
      metadata: {
        ...salvageSpec,
        amount: salvage.amount ?? salvageSpec.amount,
        name: salvage.name,
      },
    };
  });

  const reclaimedSalvage: FieldObject[] = (["counterweight_shaft", "outer_scaffold", "drop_bay", "supply_intake_port"] as OuterDeckZoneId[])
    .filter((zoneId) => hasOuterDeckZoneBeenReclaimed(state, zoneId))
    .map((zoneId) => {
      const gateTile = getOuterDeckOverworldGateTile(zoneId);
      const salvageSpec = getZoneSalvageResourceSpec(zoneId, "overworld");
      return {
        id: `outer_deck_reclaimed_salvage_${zoneId}`,
        x: gateTile.x + (zoneId === "outer_scaffold" ? -4 : zoneId === "supply_intake_port" ? 9 : 0),
        y: gateTile.y + (zoneId === "counterweight_shaft" ? 5 : zoneId === "drop_bay" ? -5 : zoneId === "supply_intake_port" ? -4 : 0),
        width: 1,
        height: 1,
        type: "resource" as const,
        sprite: "resource",
        metadata: {
          ...salvageSpec,
          amount: salvageSpec.amount + 1,
          name: `${salvageSpec.name} Cache`,
        },
      };
    });

  return [...baseSalvage, ...reclaimedSalvage];
}

function buildTransitionZone(
  id: string,
  label: string,
  x: number,
  y: number,
  targetSubareaId: string,
): InteractionZone {
  return {
    id,
    x,
    y,
    width: 2,
    height: 2,
    action: "custom",
    label,
    metadata: {
      handlerId: "outer_deck_transition",
      targetSubareaId,
      autoTrigger: true,
    },
  };
}

type MechanicObjectSpec = {
  name: string;
  sprite: string;
  x: number;
  y: number;
};

const OUTER_DECK_MECHANIC_OBJECTS: Record<OuterDeckMechanicId, MechanicObjectSpec> = {
  counterweight_shaft_restore_lift_power: {
    name: "Lift Control Junction",
    sprite: "terminal",
    x: 9,
    y: 6,
  },
  outer_scaffold_extend_bridge: {
    name: "Scaffold Winch",
    sprite: "terminal",
    x: 9,
    y: 6,
  },
  drop_bay_route_crane: {
    name: "Cargo Crane Console",
    sprite: "terminal",
    x: 9,
    y: 6,
  },
  supply_intake_port_clear_sorter_jam: {
    name: "Sorter Jam Release",
    sprite: "terminal",
    x: 9,
    y: 6,
  },
};

function buildMechanicInteractionZone(subarea: OuterDeckSubareaSpec): InteractionZone | null {
  if (!subarea.requiredMechanicId || !subarea.requiredMechanicLabel) {
    return null;
  }

  const spec = OUTER_DECK_MECHANIC_OBJECTS[subarea.requiredMechanicId];
  return {
    id: `${subarea.mapId}_mechanic_zone`,
    x: spec.x,
    y: spec.y,
    width: 2,
    height: 2,
    action: "custom",
    label: subarea.requiredMechanicLabel,
    metadata: {
      handlerId: "outer_deck_mechanic",
      mechanicId: subarea.requiredMechanicId,
      mechanicLabel: subarea.requiredMechanicLabel,
      mechanicHint: subarea.requiredMechanicHint,
    },
  };
}

function decorateBranchTiles(
  tiles: FieldMap["tiles"],
  subarea: OuterDeckSubareaSpec,
  objects: FieldObject[],
): void {
  fillRect(tiles, 1, 1, BRANCH_WIDTH - 2, BRANCH_HEIGHT - 2, true, getZoneFloorType(subarea.zoneId));
  fillRect(tiles, 0, 0, BRANCH_WIDTH, 1, false, "wall");
  fillRect(tiles, 0, BRANCH_HEIGHT - 1, BRANCH_WIDTH, 1, false, "wall");
  fillRect(tiles, 0, 0, 1, BRANCH_HEIGHT, false, "wall");
  fillRect(tiles, BRANCH_WIDTH - 1, 0, 1, BRANCH_HEIGHT, false, "wall");
  carveLine(tiles, { x: 2, y: 6 }, { x: 19, y: 6 }, 2, getZoneFloorType(subarea.zoneId));

  switch (subarea.zoneId) {
    case "counterweight_shaft":
      fillRect(tiles, 9, 2, 2, 10, false, "wall");
      fillRect(tiles, 12, 2, 2, 10, false, "wall");
      objects.push(
        { id: `${subarea.mapId}_shaft_column_left`, x: 9, y: 2, width: 2, height: 10, type: "decoration", sprite: "shaft_column" },
        { id: `${subarea.mapId}_shaft_column_right`, x: 12, y: 2, width: 2, height: 10, type: "decoration", sprite: "shaft_column" },
      );
      if (subarea.kind !== "entry") {
        fillRect(tiles, 4, 3, 3, 1, true, "stone");
        fillRect(tiles, 15, 8, 3, 1, true, "stone");
      }
      break;
    case "outer_scaffold":
      fillRect(tiles, 4, 3, 14, 1, true, "stone");
      fillRect(tiles, 4, 9, 14, 1, true, "stone");
      fillRect(tiles, 8, 5, 2, 3, false, "wall");
      fillRect(tiles, 13, 5, 2, 3, false, "wall");
      objects.push(
        { id: `${subarea.mapId}_catwalk_upper`, x: 4, y: 3, width: 14, height: 1, type: "decoration", sprite: "catwalk" },
        { id: `${subarea.mapId}_catwalk_lower`, x: 4, y: 9, width: 14, height: 1, type: "decoration", sprite: "catwalk" },
      );
      break;
    case "drop_bay":
      fillRect(tiles, 6, 3, 3, 2, false, "wall");
      fillRect(tiles, 13, 7, 3, 2, false, "wall");
      objects.push(
        { id: `${subarea.mapId}_crate_stack_a`, x: 6, y: 3, width: 3, height: 2, type: "decoration", sprite: "crate_stack" },
        { id: `${subarea.mapId}_crate_stack_b`, x: 13, y: 7, width: 3, height: 2, type: "decoration", sprite: "crate_stack" },
      );
      break;
    case "supply_intake_port":
      fillRect(tiles, 5, 5, 12, 1, true, "stone");
      fillRect(tiles, 10, 2, 2, 2, false, "wall");
      fillRect(tiles, 10, 9, 2, 2, false, "wall");
      objects.push(
        { id: `${subarea.mapId}_conveyor`, x: 5, y: 5, width: 12, height: 1, type: "decoration", sprite: "conveyor" },
        { id: `${subarea.mapId}_sorter_upper`, x: 10, y: 2, width: 2, height: 2, type: "decoration", sprite: "sorter" },
        { id: `${subarea.mapId}_sorter_lower`, x: 10, y: 9, width: 2, height: 2, type: "decoration", sprite: "sorter" },
      );
      break;
  }

  fillRect(tiles, 1, 5, 2, 3, true, "floor");
  fillRect(tiles, BRANCH_WIDTH - 3, 5, 2, 3, true, "floor");
}

function buildBranchContent(state: GameState, subarea: OuterDeckSubareaSpec): { tiles: FieldMap["tiles"]; objects: FieldObject[]; interactionZones: InteractionZone[] } {
  const tiles = createTiles(BRANCH_WIDTH, BRANCH_HEIGHT, getZoneFloorType(subarea.zoneId));
  const objects: FieldObject[] = [];
  decorateBranchTiles(tiles, subarea, objects);
  const salvageSpec = getZoneSalvageResourceSpec(subarea.zoneId, subarea.kind);
  const mechanicResolved = subarea.requiredMechanicId
    ? isOuterDeckMechanicResolved(state, subarea.requiredMechanicId)
    : true;

  if (subarea.returnToSubareaId) {
    objects.push({
      id: `${subarea.mapId}_return_gate`,
      x: 1,
      y: 5,
      width: 2,
      height: 3,
      type: "station",
      sprite: "bulkhead",
      metadata: { name: "Return Gate" },
    });
  }

  if (subarea.advanceToSubareaId) {
    objects.push({
      id: `${subarea.mapId}_advance_gate`,
      x: BRANCH_WIDTH - 3,
      y: 5,
      width: 2,
      height: 3,
      type: "station",
      sprite: "bulkhead",
      metadata: { name: subarea.gateVerb },
    });
  }

  if (subarea.requiredMechanicId && !mechanicResolved) {
    const mechanicObject = OUTER_DECK_MECHANIC_OBJECTS[subarea.requiredMechanicId];
    objects.push({
      id: `${subarea.mapId}_mechanic`,
      x: mechanicObject.x,
      y: mechanicObject.y,
      width: 2,
      height: 2,
      type: "station",
      sprite: mechanicObject.sprite,
      metadata: { name: mechanicObject.name },
    });
  }

  if (subarea.cacheId && !hasOuterDeckCacheBeenClaimed(state, subarea.cacheId)) {
    objects.push({
      id: `${subarea.mapId}_cache`,
      x: 10,
      y: 2,
      width: 2,
      height: 2,
      type: "station",
      sprite: "crate_stack",
      metadata: { name: "Salvage Cache" },
    });
  }

  if (subarea.npcEncounterId && !hasSeenOuterDeckNpcEncounter(state, subarea.npcEncounterId)) {
    objects.push({
      id: `${subarea.mapId}_signal`,
      x: 10,
      y: 10,
      width: 2,
      height: 2,
      type: "station",
      sprite: "radio",
      metadata: { name: "Signal Source" },
    });
  }

  if (subarea.kind === "reward") {
    objects.push({
      id: `${subarea.mapId}_recovery_node`,
      x: 16,
      y: 2,
      width: 2,
      height: 2,
      type: "station",
      sprite: "terminal",
      metadata: { name: "Recovery Node" },
    });
  }

  objects.push({
    id: `${subarea.mapId}_salvage`,
    x: 4,
    y: 2,
    width: 1,
    height: 1,
    type: "resource",
    sprite: "resource",
    metadata: {
      name: salvageSpec.name,
      resourceType: salvageSpec.resourceType,
      amount: salvageSpec.amount,
    },
  });

  if (!isOuterDeckSubareaCleared(state, subarea.id)) {
    objects.push(...buildEnemyObjects(subarea));
  }

  const interactionZones: InteractionZone[] = [];
  if (subarea.returnToSubareaId) {
    interactionZones.push(buildTransitionZone(
      `${subarea.mapId}_return`,
      "RETURN",
      1,
      5,
      subarea.returnToSubareaId,
    ));
  }
  if (subarea.advanceToSubareaId) {
    interactionZones.push(buildTransitionZone(
      `${subarea.mapId}_advance`,
      subarea.gateVerb,
      BRANCH_WIDTH - 3,
      5,
      subarea.advanceToSubareaId,
    ));
  }

  const mechanicInteractionZone = buildMechanicInteractionZone(subarea);
  if (mechanicInteractionZone && !mechanicResolved) {
    interactionZones.push(mechanicInteractionZone);
  }

  if (subarea.cacheId && !hasOuterDeckCacheBeenClaimed(state, subarea.cacheId)) {
    interactionZones.push({
      id: `${subarea.mapId}_cache_zone`,
      x: 10,
      y: 2,
      width: 2,
      height: 2,
      action: "custom",
      label: "SALVAGE CACHE",
      metadata: {
        handlerId: "outer_deck_cache",
        cacheId: subarea.cacheId,
        rewardBundle: getOuterDeckZoneDefinition(subarea.zoneId).cacheReward,
      },
    });
  }

  if (subarea.npcEncounterId && !hasSeenOuterDeckNpcEncounter(state, subarea.npcEncounterId)) {
    interactionZones.push({
      id: `${subarea.mapId}_npc_zone`,
      x: 10,
      y: 10,
      width: 2,
      height: 2,
      action: "custom",
      label: "SIGNAL",
      metadata: {
        handlerId: "outer_deck_npc",
        npcEncounterId: subarea.npcEncounterId,
      },
    });
  }

  if (subarea.kind === "reward") {
    interactionZones.push({
      id: `${subarea.mapId}_complete`,
      x: 16,
      y: 2,
      width: 2,
      height: 2,
      action: "custom",
      label: "SECURE NODE",
      metadata: {
        handlerId: "outer_deck_completion",
        zoneId: subarea.zoneId,
        rewardBundle: getOuterDeckCompletionReward(subarea.zoneId),
      },
    });
  }

  return { tiles, objects, interactionZones };
}

function getInteriorFloorType(variant: ReturnType<typeof getOuterDeckInteriorSpec>["variant"]): TileType {
  switch (variant) {
    case "cave":
      return "stone";
    case "structure":
      return "floor";
    case "service_tunnel":
      return "stone";
    default:
      return "stone";
  }
}

function getInteriorWallSprite(variant: ReturnType<typeof getOuterDeckInteriorSpec>["variant"]): string {
  switch (variant) {
    case "cave":
      return "shaft_column";
    case "structure":
      return "crate_stack";
    case "service_tunnel":
      return "conveyor";
    default:
      return "shaft_column";
  }
}

function decorateInteriorTiles(
  tiles: FieldMap["tiles"],
  ref: OuterDeckInteriorMapRef,
  seed: number,
  variant: ReturnType<typeof getOuterDeckInteriorSpec>["variant"],
): { enemySpawns: Array<{ x: number; y: number }>; cacheTile: { x: number; y: number } } {
  const rng = randomFromSeed(createStableMapSeed(seed, ref.floorOrdinal, ref.chunkX, ref.chunkY, ref.depth, "interior-layout"));
  const floorType = getInteriorFloorType(variant);
  const bendA = randomIntFrom(rng, 4, 6);
  const bendB = randomIntFrom(rng, 9, 12);
  const highLane = randomIntFrom(rng, 3, 5);
  const lowLane = randomIntFrom(rng, 10, 12);
  const laneA = ref.depth % 2 === 0 ? highLane : lowLane;
  const laneB = ref.depth % 2 === 0 ? lowLane : highLane;
  const thickness = ref.depth === 1 && rng() > 0.35 ? 2 : 1;
  const path = [
    { x: 2, y: 8 },
    { x: bendA, y: 8 },
    { x: bendA, y: laneA },
    { x: bendB, y: laneA },
    { x: bendB, y: laneB },
    { x: 17, y: laneB },
    { x: 19, y: 8 },
  ];

  path.slice(0, -1).forEach((point, index) => {
    carveLine(tiles, point, path[index + 1]!, thickness, floorType);
  });

  fillRect(tiles, 1, 7, 3, 3, true, floorType);
  fillRect(tiles, 18, 7, 3, 3, true, floorType);

  const cacheTile = ref.depth % 2 === 0
    ? { x: 15, y: 3 }
    : { x: 15, y: 11 };
  const cacheRoomTop = Math.max(2, cacheTile.y - 1);
  fillRect(tiles, cacheTile.x - 2, cacheRoomTop, 5, 3, true, floorType);
  carveLine(tiles, { x: cacheTile.x, y: cacheRoomTop + 2 }, { x: 15, y: laneB }, 1, floorType);

  const sideRoom = ref.depth % 2 === 0
    ? { x: 6, y: 11 }
    : { x: 6, y: 3 };
  fillRect(tiles, sideRoom.x - 1, sideRoom.y - 1, 4, 3, true, floorType);
  carveLine(tiles, { x: sideRoom.x, y: sideRoom.y }, { x: bendA, y: laneA }, 1, floorType);

  return {
    enemySpawns: [
      { x: bendA + 1, y: laneA },
      { x: bendB + 1, y: laneB },
      { x: sideRoom.x + 1, y: sideRoom.y },
      { x: cacheTile.x - 1, y: cacheTile.y },
    ],
    cacheTile,
  };
}

function buildInteriorEnemyObjects(
  state: GameState,
  ref: OuterDeckInteriorMapRef,
  enemySpawns: Array<{ x: number; y: number }>,
): FieldObject[] {
  const roomKey = getOuterDeckInteriorRoomKey(ref);
  const openWorld = getOuterDeckOpenWorldState(state);
  if (openWorld.clearedInteriorRoomKeys.includes(roomKey)) {
    return [];
  }

  const distanceTier = Math.max(0, Math.floor(Math.hypot(ref.chunkX, ref.chunkY)));
  const enemyKinds = ["tunnel_scavenger", "apron_crawler", "cache_guard", "collapsed_sentry"];
  const enemyCount = Math.min(enemySpawns.length, 1 + ref.depth + (distanceTier >= 4 ? 1 : 0));
  return enemySpawns.slice(0, enemyCount).map((spawn, index) => {
    const enemyKind = enemyKinds[(index + ref.depth) % enemyKinds.length]!;
    return {
      id: `${roomKey.replace(/[^a-z0-9]/gi, "_")}_enemy_${index}`,
      x: spawn.x,
      y: spawn.y,
      width: 1,
      height: 1,
      type: "enemy",
      sprite: "field_enemy",
      metadata: {
        name: formatEnemyLabel(enemyKind),
        enemyKind,
        hp: 84 + (ref.depth * 18) + (distanceTier * 8),
        speed: 82 + (ref.depth * 7),
        aggroRange: 210,
        attackStyle: index % 2 === 0 ? "lunge" : "slash",
        drops: {
          wad: 12 + (distanceTier * 3),
          resources: {
            metalScrap: index % 2 === 0 ? 1 : 0,
            wood: enemyKind.includes("crawler") ? 1 : 0,
            chaosShards: distanceTier >= 5 && index === 0 ? 1 : 0,
            steamComponents: enemyKind.includes("sentry") ? 1 : 0,
          },
        },
      },
    };
  });
}

function buildInteriorContent(
  state: GameState,
  ref: OuterDeckInteriorMapRef,
): { tiles: FieldMap["tiles"]; objects: FieldObject[]; interactionZones: InteractionZone[]; name: string } | null {
  const openWorld = getOuterDeckOpenWorldState(state);
  const spec = getOuterDeckInteriorSpec(openWorld.seed, ref.floorOrdinal, ref.chunkX, ref.chunkY);
  if (ref.depth < 0 || ref.depth >= spec.chainLength) {
    return null;
  }

  const tiles = createTiles(INTERIOR_WIDTH, INTERIOR_HEIGHT, "wall");
  fillRect(tiles, 0, 0, INTERIOR_WIDTH, INTERIOR_HEIGHT, false, "wall");
  const objects: FieldObject[] = [];
  const { enemySpawns, cacheTile } = decorateInteriorTiles(tiles, ref, openWorld.seed, spec.variant);
  const roomKey = getOuterDeckInteriorRoomKey(ref);
  const lootKey = getOuterDeckInteriorLootKey(ref);
  const isFinalDepth = ref.depth === spec.chainLength - 1;
  const cacheClaimed = openWorld.claimedInteriorLootKeys.includes(lootKey);

  objects.push(
    {
      id: `${roomKey}_back_gate`,
      x: 1,
      y: 7,
      width: 2,
      height: 2,
      type: "station",
      sprite: "bulkhead",
      metadata: { name: ref.depth === 0 ? "Surface Route" : "Back Route" },
    },
    {
      id: `${roomKey}_deeper_gate`,
      x: 19,
      y: 7,
      width: 2,
      height: 2,
      type: "station",
      sprite: "bulkhead",
      metadata: { name: isFinalDepth ? "Terminal Wall" : "Deeper Route" },
    },
  );

  const wallSprite = getInteriorWallSprite(spec.variant);
  [
    { x: 8, y: 2, width: 2, height: 2 },
    { x: 11, y: 6, width: 2, height: 2 },
    { x: 4, y: 13, width: 2, height: 1 },
  ].forEach((decor, index) => {
    objects.push({
      id: `${roomKey}_decor_${index}`,
      ...decor,
      type: "decoration",
      sprite: wallSprite,
      metadata: { name: spec.variant === "cave" ? "Stone Choke" : "Corridor Obstruction" },
    });
  });

  if (isFinalDepth && !cacheClaimed) {
    objects.push({
      id: `${roomKey}_cache`,
      x: cacheTile.x,
      y: cacheTile.y,
      width: 2,
      height: 2,
      type: "station",
      sprite: "crate_stack",
      metadata: {
        name: spec.rewardLabel,
        lootKey,
      },
    });
  }

  objects.push(...buildInteriorEnemyObjects(state, ref, enemySpawns));

  const interactionZones: InteractionZone[] = [
    {
      id: `${roomKey}_back_zone`,
      x: 1,
      y: 7,
      width: 2,
      height: 2,
      action: "custom",
      label: ref.depth === 0 ? "SURFACE" : "BACK",
      metadata: ref.depth === 0
        ? {
            handlerId: "outer_deck_interior_exit",
            autoTrigger: true,
          }
        : {
            handlerId: "outer_deck_interior_transition",
            targetMapId: buildOuterDeckInteriorMapId(ref.floorOrdinal, ref.chunkX, ref.chunkY, ref.depth - 1),
            direction: "back",
            autoTrigger: true,
          },
    },
  ];

  if (!isFinalDepth) {
    interactionZones.push({
      id: `${roomKey}_deeper_zone`,
      x: 19,
      y: 7,
      width: 2,
      height: 2,
      action: "custom",
      label: "DEEPER",
      metadata: {
        handlerId: "outer_deck_interior_transition",
        targetMapId: buildOuterDeckInteriorMapId(ref.floorOrdinal, ref.chunkX, ref.chunkY, ref.depth + 1),
        direction: "deeper",
        requiresClear: true,
        autoTrigger: true,
      },
    });
  }

  if (isFinalDepth && !cacheClaimed) {
    interactionZones.push({
      id: `${roomKey}_cache_zone`,
      x: cacheTile.x,
      y: cacheTile.y,
      width: 2,
      height: 2,
      action: "custom",
      label: spec.cacheLabel,
      metadata: {
        handlerId: "outer_deck_interior_cache",
        lootKey,
        requiresClear: true,
      },
    });
  }

  return {
    tiles,
    objects,
    interactionZones,
    name: `${spec.title} // ${ref.depth + 1}/${spec.chainLength}`,
  };
}

function createOuterDeckInteriorMap(mapId: string, state: GameState): FieldMap | null {
  const ref = parseOuterDeckInteriorMapId(mapId);
  if (!ref) {
    return null;
  }

  const content = buildInteriorContent(state, ref);
  if (!content) {
    return null;
  }

  return {
    id: mapId,
    name: content.name,
    width: INTERIOR_WIDTH,
    height: INTERIOR_HEIGHT,
    tiles: content.tiles,
    objects: content.objects,
    interactionZones: content.interactionZones,
    metadata: {
      kind: "outerDeckInterior",
      floorOrdinal: ref.floorOrdinal,
      chunkX: ref.chunkX,
      chunkY: ref.chunkY,
      depth: ref.depth,
    },
  };
}

function createOuterDeckBranchMap(mapId: string, state: GameState): FieldMap | null {
  const subarea = getOuterDeckSubareaByMapId(state, mapId);
  if (!subarea) {
    return null;
  }

  const { tiles, objects, interactionZones } = buildBranchContent(state, subarea);
  return {
    id: mapId,
    name: subarea.title,
    width: BRANCH_WIDTH,
    height: BRANCH_HEIGHT,
    tiles,
    objects,
    interactionZones,
  };
}

function createOverworldTiles(): FieldMap["tiles"] {
  const tiles = createTiles(OVERWORLD_WIDTH, OVERWORLD_HEIGHT, "dirt");

  fillRect(tiles, 1, 1, OVERWORLD_WIDTH - 2, OVERWORLD_HEIGHT - 2, true, "stone");
  fillRect(
    tiles,
    HAVEN_FOOTPRINT_LEFT - HAVEN_RING_MARGIN,
    HAVEN_FOOTPRINT_TOP - HAVEN_RING_MARGIN,
    HAVEN_FOOTPRINT_WIDTH + (HAVEN_RING_MARGIN * 2),
    HAVEN_FOOTPRINT_HEIGHT + (HAVEN_RING_MARGIN * 2),
    true,
    "floor",
  );
  fillRect(tiles, 64, 1, 12, HAVEN_FOOTPRINT_TOP - 1, true, "floor");
  fillRect(
    tiles,
    64,
    HAVEN_FOOTPRINT_TOP + HAVEN_FOOTPRINT_HEIGHT,
    12,
    OVERWORLD_HEIGHT - (HAVEN_FOOTPRINT_TOP + HAVEN_FOOTPRINT_HEIGHT) - 1,
    true,
    "floor",
  );
  fillRect(tiles, 1, 42, HAVEN_FOOTPRINT_LEFT - 1, 6, true, "floor");
  fillRect(
    tiles,
    HAVEN_FOOTPRINT_LEFT + HAVEN_FOOTPRINT_WIDTH,
    42,
    OVERWORLD_WIDTH - (HAVEN_FOOTPRINT_LEFT + HAVEN_FOOTPRINT_WIDTH) - 1,
    6,
    true,
    "floor",
  );
  fillRect(tiles, HAVEN_FOOTPRINT_LEFT, HAVEN_FOOTPRINT_TOP, HAVEN_FOOTPRINT_WIDTH, HAVEN_FOOTPRINT_HEIGHT, false, "wall");
  return tiles;
}

function applyReclaimedLaneGeometry(tiles: FieldMap["tiles"], state: GameState): void {
  if (hasOuterDeckZoneBeenReclaimed(state, "counterweight_shaft")) {
    fillRect(tiles, 63, 1, 14, 12, true, "floor");
  }
  if (hasOuterDeckZoneBeenReclaimed(state, "outer_scaffold")) {
    fillRect(tiles, 124, 38, 15, 14, true, "floor");
  }
  if (hasOuterDeckZoneBeenReclaimed(state, "drop_bay")) {
    fillRect(tiles, 63, 78, 14, 11, true, "stone");
  }
  if (hasOuterDeckZoneBeenReclaimed(state, "supply_intake_port")) {
    fillRect(tiles, 1, 38, 15, 14, true, "floor");
  }
}

function buildReclaimedOverworldObjects(state: GameState): FieldObject[] {
  return ([
    {
      zoneId: "counterweight_shaft" as const,
      id: "outer_deck_counterweight_service_lift",
      name: "Service Lift Online",
      x: 66,
      y: 9,
    },
    {
      zoneId: "outer_scaffold" as const,
      id: "outer_deck_scaffold_outpost",
      name: "Lookout Railing Restored",
      x: 127,
      y: 44,
    },
    {
      zoneId: "drop_bay" as const,
      id: "outer_deck_dropbay_salvage_locker",
      name: "Drop Bay Salvage Locker",
      x: 66,
      y: 78,
    },
    {
      zoneId: "supply_intake_port" as const,
      id: "outer_deck_intake_supply_rack",
      name: "Quartermaster Supply Rack",
      x: 14,
      y: 39,
    },
  ])
    .filter((entry) => hasOuterDeckZoneBeenReclaimed(state, entry.zoneId))
    .map((entry) => ({
      id: entry.id,
      x: entry.x,
      y: entry.y,
      width: 2,
      height: 2,
      type: "station" as const,
      sprite: "terminal",
      metadata: { name: entry.name },
    }));
}

function createOuterDeckOverworldMap(state: GameState): FieldMap {
  const tiles = createOverworldTiles();
  applyReclaimedLaneGeometry(tiles, state);
  const progress = loadCampaignProgress();
  const objects: FieldObject[] = [
    {
      id: "outer_deck_overworld_haven_gate",
      x: OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE.x,
      y: OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE.y,
      width: 2,
      height: 2,
      type: "station",
      sprite: "doorway",
      metadata: { name: "HAVEN Door" },
    },
    {
      id: "outer_deck_overworld_counterweight_gate",
      x: 69,
      y: 3,
      width: 2,
      height: 2,
      type: "station",
      sprite: "bulkhead",
      metadata: { name: "Counterweight Shaft Gate" },
    },
    {
      id: "outer_deck_overworld_scaffold_gate",
      x: 133,
      y: 44,
      width: 2,
      height: 2,
      type: "station",
      sprite: "bulkhead",
      metadata: { name: "Outer Scaffold Gate" },
    },
    {
      id: "outer_deck_overworld_drop_gate",
      x: 69,
      y: 84,
      width: 2,
      height: 2,
      type: "station",
      sprite: "bulkhead",
      metadata: { name: "Drop Bay Gate" },
    },
    {
      id: "outer_deck_overworld_intake_gate",
      x: 5,
      y: 44,
      width: 2,
      height: 2,
      type: "station",
      sprite: "bulkhead",
      metadata: { name: "Supply Intake Port Gate" },
    },
    ...buildReclaimedOverworldObjects(state),
    ...buildOverworldEnemyObjects(state),
    ...buildOverworldSalvageObjects(state),
    {
      id: "outer_deck_overworld_salvage_nw",
      x: HAVEN_FOOTPRINT_LEFT - 18,
      y: HAVEN_FOOTPRINT_TOP - 10,
      width: 1,
      height: 1,
      type: "resource",
      sprite: "resource",
      metadata: {
        ...getZoneSalvageResourceSpec("counterweight_shaft", "overworld"),
        name: "North Brace Salvage",
      },
    },
    {
      id: "outer_deck_overworld_salvage_ne",
      x: HAVEN_FOOTPRINT_LEFT + HAVEN_FOOTPRINT_WIDTH + 17,
      y: HAVEN_FOOTPRINT_TOP - 10,
      width: 1,
      height: 1,
      type: "resource",
      sprite: "resource",
      metadata: {
        ...getZoneSalvageResourceSpec("outer_scaffold", "overworld"),
        name: "Relay Rigging",
      },
    },
    {
      id: "outer_deck_overworld_salvage_sw",
      x: HAVEN_FOOTPRINT_LEFT - 18,
      y: HAVEN_FOOTPRINT_TOP + HAVEN_FOOTPRINT_HEIGHT + 10,
      width: 1,
      height: 1,
      type: "resource",
      sprite: "resource",
      metadata: {
        ...getZoneSalvageResourceSpec("supply_intake_port", "overworld"),
        name: "Intake Residue",
      },
    },
    {
      id: "outer_deck_overworld_salvage_se",
      x: HAVEN_FOOTPRINT_LEFT + HAVEN_FOOTPRINT_WIDTH + 17,
      y: HAVEN_FOOTPRINT_TOP + HAVEN_FOOTPRINT_HEIGHT + 10,
      width: 1,
      height: 1,
      type: "resource",
      sprite: "resource",
      metadata: {
        ...getZoneSalvageResourceSpec("drop_bay", "overworld"),
        name: "Drop Bay Scrap",
      },
    },
  ];

  const interactionZones: InteractionZone[] = [
    {
      id: OUTER_DECK_OVERWORLD_HAVEN_GATE_ZONE_ID,
      x: OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE.x,
      y: OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE.y,
      width: 2,
      height: 2,
      action: "custom",
      label: "RETURN TO HAVEN",
      metadata: {
        handlerId: "outer_deck_return_to_haven",
        autoTrigger: true,
      },
    },
    ...(["counterweight_shaft", "outer_scaffold", "drop_bay", "supply_intake_port"] as OuterDeckZoneId[]).map((zoneId) => {
      const unlocked = isOuterDeckZoneUnlocked(zoneId, progress);
      const gateTile = getOuterDeckOverworldGateTile(zoneId);
      const floorRequirement = String(getOuterDeckZoneDefinition(zoneId).unlockFloorOrdinal).padStart(2, "0");
      return {
        id: `outer_deck_gate_${zoneId}`,
        x: gateTile.x,
        y: gateTile.y,
        width: 2,
        height: 2,
        action: "custom" as const,
        label: unlocked ? getOuterDeckZoneGateLabel(zoneId) : `${getOuterDeckZoneGateLabel(zoneId)} // FLOOR ${floorRequirement}`,
        metadata: {
          handlerId: "outer_deck_branch_gate",
          zoneId,
          autoTrigger: true,
          lockedMessage: unlocked ? undefined : getOuterDeckZoneLockedMessage(zoneId),
        },
      };
    }),
  ];

  return {
    id: OUTER_DECK_OVERWORLD_MAP_ID,
    name: "HAVEN Apron",
    width: OVERWORLD_WIDTH,
    height: OVERWORLD_HEIGHT,
    tiles,
    objects,
    interactionZones,
  };
}

export function createOuterDeckFieldMap(
  mapId: string,
  state: GameState = getGameState(),
): FieldMap | null {
  if (isOuterDeckOverworldMap(mapId)) {
    return createOuterDeckOpenWorldFieldMap(state);
  }
  if (isOuterDeckInteriorMap(mapId)) {
    return createOuterDeckInteriorMap(mapId, state);
  }
  return createOuterDeckBranchMap(mapId, state);
}

export function getCurrentOuterDeckRuntimeMap(): FieldMap | null {
  const state = getGameState();
  const currentSubarea = getCurrentOuterDeckSubarea(state);
  return currentSubarea ? createOuterDeckFieldMap(currentSubarea.mapId, state) : null;
}

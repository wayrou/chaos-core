import { loadCampaignProgress } from "../core/campaign";
import {
  OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE,
  OUTER_DECK_OVERWORLD_HAVEN_GATE_ZONE_ID,
  OUTER_DECK_OVERWORLD_MAP_ID,
  getCurrentOuterDeckSubarea,
  getOuterDeckCompletionReward,
  getOuterDeckOverworldGateTile,
  getOuterDeckSubareaByMapId,
  getOuterDeckZoneDefinition,
  getOuterDeckZoneGateLabel,
  getOuterDeckZoneLockedMessage,
  hasOuterDeckCacheBeenClaimed,
  hasSeenOuterDeckNpcEncounter,
  isOuterDeckOverworldMap,
  isOuterDeckSubareaCleared,
  isOuterDeckZoneUnlocked,
  type OuterDeckRewardBundle,
  type OuterDeckSubareaSpec,
  type OuterDeckZoneId,
} from "../core/outerDecks";
import { getGameState } from "../state/gameStore";
import type { GameState } from "../core/types";
import type { FieldMap, FieldObject, InteractionZone } from "./types";

const OVERWORLD_WIDTH = 70;
const OVERWORLD_HEIGHT = 45;
const HAVEN_FOOTPRINT_LEFT = 10;
const HAVEN_FOOTPRINT_TOP = 10;
const HAVEN_FOOTPRINT_WIDTH = 50;
const HAVEN_FOOTPRINT_HEIGHT = 25;
const BRANCH_WIDTH = 22;
const BRANCH_HEIGHT = 14;

type TileType = FieldMap["tiles"][number][number]["type"];

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
  fillRect(tiles, HAVEN_FOOTPRINT_LEFT, HAVEN_FOOTPRINT_TOP, HAVEN_FOOTPRINT_WIDTH, HAVEN_FOOTPRINT_HEIGHT, false, "wall");
  fillRect(tiles, 30, 1, 10, 8, true, "floor");
  fillRect(tiles, 30, 35, 10, 9, true, "floor");
  fillRect(tiles, 1, 18, 9, 9, true, "floor");
  fillRect(tiles, 60, 18, 9, 9, true, "floor");
  fillRect(tiles, 8, 8, 54, 29, true, "floor");
  fillRect(tiles, 14, 14, 42, 17, true, "stone");
  fillRect(tiles, HAVEN_FOOTPRINT_LEFT, HAVEN_FOOTPRINT_TOP, HAVEN_FOOTPRINT_WIDTH, HAVEN_FOOTPRINT_HEIGHT, false, "wall");
  return tiles;
}

function createOuterDeckOverworldMap(): FieldMap {
  const tiles = createOverworldTiles();
  const progress = loadCampaignProgress();
  const objects: FieldObject[] = [
    {
      id: "outer_deck_overworld_haven_gate",
      x: OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE.x,
      y: OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE.y,
      width: 2,
      height: 2,
      type: "station",
      sprite: "bulkhead",
      metadata: { name: "HAVEN ACCESS" },
    },
    {
      id: "outer_deck_overworld_counterweight_gate",
      x: 34,
      y: 3,
      width: 2,
      height: 2,
      type: "station",
      sprite: "bulkhead",
      metadata: { name: "Counterweight Shaft Gate" },
    },
    {
      id: "outer_deck_overworld_scaffold_gate",
      x: 63,
      y: 21,
      width: 2,
      height: 2,
      type: "station",
      sprite: "bulkhead",
      metadata: { name: "Outer Scaffold Gate" },
    },
    {
      id: "outer_deck_overworld_drop_gate",
      x: 34,
      y: 39,
      width: 2,
      height: 2,
      type: "station",
      sprite: "bulkhead",
      metadata: { name: "Drop Bay Gate" },
    },
    {
      id: "outer_deck_overworld_intake_gate",
      x: 5,
      y: 21,
      width: 2,
      height: 2,
      type: "station",
      sprite: "bulkhead",
      metadata: { name: "Supply Intake Port Gate" },
    },
    {
      id: "outer_deck_overworld_haven_core",
      x: HAVEN_FOOTPRINT_LEFT,
      y: HAVEN_FOOTPRINT_TOP,
      width: HAVEN_FOOTPRINT_WIDTH,
      height: HAVEN_FOOTPRINT_HEIGHT,
      type: "decoration",
      sprite: "bulkhead",
      metadata: { name: "HAVEN SUPERSTRUCTURE" },
    },
    {
      id: "outer_deck_overworld_salvage_nw",
      x: 18,
      y: 7,
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
      x: 51,
      y: 7,
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
      x: 18,
      y: 36,
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
      x: 51,
      y: 36,
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
    name: "HAVEN Outer Decks",
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
    return createOuterDeckOverworldMap();
  }
  return createOuterDeckBranchMap(mapId, state);
}

export function getCurrentOuterDeckRuntimeMap(): FieldMap | null {
  const state = getGameState();
  const currentSubarea = getCurrentOuterDeckSubarea(state);
  return currentSubarea ? createOuterDeckFieldMap(currentSubarea.mapId, state) : null;
}

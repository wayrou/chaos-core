import { getGameState } from "../state/gameStore";
import {
  getCurrentOuterDeckSubarea,
  getOuterDeckCompletionReward,
  getOuterDeckSubareaByMapId,
  getOuterDeckZoneDefinition,
  hasOuterDeckCacheBeenClaimed,
  hasSeenOuterDeckNpcEncounter,
  isOuterDeckSubareaCleared,
  type OuterDeckRewardBundle,
  type OuterDeckSubareaSpec,
  type OuterDeckZoneId,
} from "../core/outerDecks";
import type { GameState } from "../core/types";
import type { FieldMap, FieldObject, InteractionZone } from "./types";

const OUTER_DECK_WIDTH = 18;
const OUTER_DECK_HEIGHT = 12;

type TileType = FieldMap["tiles"][number][number]["type"];

function createBaseTiles(defaultType: TileType): FieldMap["tiles"] {
  const tiles: FieldMap["tiles"] = [];
  for (let y = 0; y < OUTER_DECK_HEIGHT; y += 1) {
    tiles[y] = [];
    for (let x = 0; x < OUTER_DECK_WIDTH; x += 1) {
      const isBoundary = x === 0 || x === OUTER_DECK_WIDTH - 1 || y === 0 || y === OUTER_DECK_HEIGHT - 1;
      tiles[y][x] = {
        x,
        y,
        walkable: !isBoundary,
        type: isBoundary ? "wall" : defaultType,
      };
    }
  }
  return tiles;
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
      if (!tiles[y]?.[x]) {
        continue;
      }
      tiles[y][x] = {
        ...tiles[y][x],
        walkable,
        type,
      };
    }
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

function addZoneDecorations(
  tiles: FieldMap["tiles"],
  zoneId: OuterDeckZoneId,
  objects: FieldObject[],
): void {
  switch (zoneId) {
    case "counterweight_shaft":
      fillRect(tiles, 5, 2, 2, 8, false, "wall");
      fillRect(tiles, 11, 2, 2, 8, false, "wall");
      objects.push(
        { id: "shaft_column_left", x: 5, y: 2, width: 2, height: 8, type: "decoration", sprite: "shaft_column" },
        { id: "shaft_column_right", x: 11, y: 2, width: 2, height: 8, type: "decoration", sprite: "shaft_column" },
      );
      break;
    case "outer_scaffold":
      fillRect(tiles, 4, 4, 10, 1, true, "stone");
      fillRect(tiles, 4, 7, 10, 1, true, "stone");
      objects.push(
        { id: "scaffold_bridge_top", x: 4, y: 4, width: 10, height: 1, type: "decoration", sprite: "catwalk" },
        { id: "scaffold_bridge_bottom", x: 4, y: 7, width: 10, height: 1, type: "decoration", sprite: "catwalk" },
      );
      break;
    case "drop_bay":
      objects.push(
        { id: "dropbay_crate_stack_a", x: 5, y: 3, width: 2, height: 2, type: "decoration", sprite: "crate_stack" },
        { id: "dropbay_crate_stack_b", x: 11, y: 6, width: 2, height: 2, type: "decoration", sprite: "crate_stack" },
      );
      fillRect(tiles, 5, 3, 2, 2, false, "wall");
      fillRect(tiles, 11, 6, 2, 2, false, "wall");
      break;
    case "supply_intake_port":
      fillRect(tiles, 3, 5, 12, 1, true, "stone");
      objects.push(
        { id: "intake_conveyor", x: 3, y: 5, width: 12, height: 1, type: "decoration", sprite: "conveyor" },
        { id: "intake_sorter", x: 8, y: 2, width: 2, height: 2, type: "decoration", sprite: "sorter" },
      );
      fillRect(tiles, 8, 2, 2, 2, false, "wall");
      break;
  }
}

function buildEnemyDrops(
  zoneId: OuterDeckZoneId,
  index: number,
): OuterDeckRewardBundle {
  switch (zoneId) {
    case "counterweight_shaft":
      return {
        wad: 20 + (index * 4),
        resources: {
          metalScrap: 1,
          steamComponents: index % 2 === 0 ? 1 : 0,
        },
      };
    case "outer_scaffold":
      return {
        wad: 26 + (index * 5),
        resources: {
          wood: 1,
          steamComponents: index % 2 === 0 ? 1 : 0,
        },
      };
    case "drop_bay":
      return {
        wad: 30 + (index * 6),
        resources: {
          metalScrap: 1,
          wood: 1,
        },
      };
    case "supply_intake_port":
      return {
        wad: 34 + (index * 6),
        resources: {
          chaosShards: index % 2 === 0 ? 1 : 0,
          steamComponents: 1,
        },
      };
    default:
      return {};
  }
}

function buildEnemyObjects(subarea: OuterDeckSubareaSpec): FieldObject[] {
  const positions = [
    { x: 3, y: 3 },
    { x: 14, y: 3 },
    { x: 9, y: 6 },
    { x: 4, y: 8 },
  ];

  return subarea.enemyKinds.slice(0, subarea.enemyCount).map((enemyKind, index) => {
    const position = positions[index] ?? positions[positions.length - 1]!;
    const drops = buildEnemyDrops(subarea.zoneId, index);
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
        hp: subarea.kind === "side" ? 5 : 3,
        speed: subarea.kind === "side" ? 110 : 90,
        aggroRange: 220,
        drops,
      },
    };
  });
}

function buildBundleMetadata(bundle: OuterDeckRewardBundle | undefined): Record<string, unknown> {
  return {
    rewardBundle: bundle ?? {},
  };
}

function buildTransitionZone(
  id: string,
  label: string,
  tile: { x: number; y: number },
  targetSubareaId: string,
): InteractionZone {
  return {
    id,
    x: tile.x,
    y: tile.y,
    width: 2,
    height: 1,
    action: "custom",
    label,
    metadata: {
      handlerId: "outer_deck_transition",
      targetSubareaId,
    },
  };
}

function buildCacheZone(subarea: OuterDeckSubareaSpec): InteractionZone | null {
  if (!subarea.cacheId) {
    return null;
  }

  return {
    id: `${subarea.id.replace(/[:]/g, "_")}_cache`,
    x: 8,
    y: 2,
    width: 2,
    height: 1,
    action: "custom",
    label: "SALVAGE CACHE",
    metadata: {
      handlerId: "outer_deck_cache",
      cacheId: subarea.cacheId,
      zoneId: subarea.zoneId,
      ...buildBundleMetadata(getZoneCacheReward(subarea.zoneId)),
    },
  };
}

function getZoneCacheReward(zoneId: OuterDeckZoneId): OuterDeckRewardBundle {
  return getOuterDeckZoneDefinition(zoneId).cacheReward;
}

function buildNpcZone(subarea: OuterDeckSubareaSpec, state: GameState): InteractionZone | null {
  if (!subarea.npcEncounterId || hasSeenOuterDeckNpcEncounter(state, subarea.npcEncounterId)) {
    return null;
  }

  return {
    id: `${subarea.id.replace(/[:]/g, "_")}_npc`,
    x: 8,
    y: 3,
    width: 2,
    height: 1,
    action: "custom",
    label: "SURVIVOR SIGNAL",
    metadata: {
      handlerId: "outer_deck_npc",
      npcEncounterId: subarea.npcEncounterId,
    },
  };
}

function buildCompletionZone(subarea: OuterDeckSubareaSpec): InteractionZone | null {
  if (subarea.kind !== "reward") {
    return null;
  }

  return {
    id: `${subarea.id.replace(/[:]/g, "_")}_completion`,
    x: 8,
    y: 7,
    width: 2,
    height: 1,
    action: "custom",
    label: "SECURE RECOVERY NODE",
    metadata: {
      handlerId: "outer_deck_completion",
      zoneId: subarea.zoneId,
      ...buildBundleMetadata(getOuterDeckCompletionReward(subarea.zoneId)),
    },
  };
}

function buildOuterDeckObjects(
  state: GameState,
  subarea: OuterDeckSubareaSpec,
): FieldObject[] {
  const objects: FieldObject[] = [];
  const cleared = isOuterDeckSubareaCleared(state, subarea.id);

  objects.push({
    id: `${subarea.id.replace(/[:]/g, "_")}_gate_console`,
    x: 15,
    y: 5,
    width: 2,
    height: 2,
    type: "station",
    sprite: "console",
    metadata: {
      name: subarea.gateVerb,
    },
  });

  if (subarea.returnToSubareaId) {
    objects.push({
      id: `${subarea.id.replace(/[:]/g, "_")}_return_gate`,
      x: 1,
      y: 5,
      width: 2,
      height: 2,
      type: "station",
      sprite: "door",
      metadata: {
        name: "Return Gate",
      },
    });
  }

  if (subarea.cacheId && !hasOuterDeckCacheBeenClaimed(state, subarea.cacheId)) {
    objects.push({
      id: `${subarea.id.replace(/[:]/g, "_")}_cache_object`,
      x: 8,
      y: 1,
      width: 2,
      height: 2,
      type: "station",
      sprite: "crate_stack",
      metadata: {
        name: "Salvage Cache",
      },
    });
  }

  if (subarea.kind === "reward") {
    objects.push({
      id: `${subarea.id.replace(/[:]/g, "_")}_reward_terminal`,
      x: 8,
      y: 6,
      width: 2,
      height: 2,
      type: "station",
      sprite: "terminal",
      metadata: {
        name: "Recovery Node",
      },
    });
  }

  if (!cleared) {
    objects.push(...buildEnemyObjects(subarea));
  }

  return objects;
}

function buildOuterDeckInteractionZones(
  state: GameState,
  subarea: OuterDeckSubareaSpec,
): InteractionZone[] {
  const zones: InteractionZone[] = [];

  if (subarea.advanceToSubareaId) {
    zones.push(buildTransitionZone(
      `${subarea.id.replace(/[:]/g, "_")}_advance`,
      subarea.gateVerb.toUpperCase(),
      { x: 15, y: 7 },
      subarea.advanceToSubareaId,
    ));
  }

  if (subarea.sideToSubareaId) {
    zones.push(buildTransitionZone(
      `${subarea.id.replace(/[:]/g, "_")}_side`,
      "OPEN SIDE CHAMBER",
      { x: 8, y: 1 },
      subarea.sideToSubareaId,
    ));
  }

  if (subarea.returnToSubareaId) {
    zones.push(buildTransitionZone(
      `${subarea.id.replace(/[:]/g, "_")}_return`,
      "RETURN",
      { x: 1, y: 7 },
      subarea.returnToSubareaId,
    ));
  }

  const cacheZone = buildCacheZone(subarea);
  if (cacheZone) {
    zones.push(cacheZone);
  }

  const npcZone = buildNpcZone(subarea, state);
  if (npcZone) {
    zones.push(npcZone);
  }

  const completionZone = buildCompletionZone(subarea);
  if (completionZone) {
    zones.push(completionZone);
  }

  return zones;
}

export function createOuterDeckFieldMap(
  mapId: string,
  state: GameState = getGameState(),
): FieldMap | null {
  const subarea = getOuterDeckSubareaByMapId(state, mapId);
  if (!subarea) {
    return null;
  }

  const tiles = createBaseTiles(getZoneFloorType(subarea.zoneId));
  const decorationObjects: FieldObject[] = [];
  addZoneDecorations(tiles, subarea.zoneId, decorationObjects);

  return {
    id: mapId,
    name: subarea.title,
    width: OUTER_DECK_WIDTH,
    height: OUTER_DECK_HEIGHT,
    tiles,
    objects: [...decorationObjects, ...buildOuterDeckObjects(state, subarea)],
    interactionZones: buildOuterDeckInteractionZones(state, subarea),
  };
}

export function getCurrentOuterDeckRuntimeMap(): FieldMap | null {
  const state = getGameState();
  const currentSubarea = getCurrentOuterDeckSubarea(state);
  return currentSubarea ? createOuterDeckFieldMap(currentSubarea.mapId, state) : null;
}

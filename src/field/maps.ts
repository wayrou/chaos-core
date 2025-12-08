// ============================================================================
// FIELD SYSTEM - MAP DEFINITIONS
// ============================================================================

import { FieldMap, FieldObject, InteractionZone } from "./types";

// ============================================================================
// BASE CAMP MAP
// ============================================================================

function createBaseCampMap(): FieldMap {
  const width = 20;
  const height = 15;
  
  // Create walkable floor grid
  const tiles: FieldMap["tiles"] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      // Walls around edges, floor in center
      const isWall = x === 0 || x === width - 1 || y === 0 || y === height - 1;
      tiles[y][x] = {
        x,
        y,
        walkable: !isWall,
        type: isWall ? "wall" : "floor",
      };
    }
  }
  
  // Station objects (visual placeholders)
  const objects: FieldObject[] = [
    {
      id: "shop_station",
      x: 3,
      y: 3,
      width: 2,
      height: 2,
      type: "station",
      sprite: "shop",
      metadata: { name: "Shop" },
    },
    {
      id: "workshop_station",
      x: 7,
      y: 3,
      width: 2,
      height: 2,
      type: "station",
      sprite: "workshop",
      metadata: { name: "Workshop" },
    },
    {
      id: "roster_station",
      x: 11,
      y: 3,
      width: 2,
      height: 2,
      type: "station",
      sprite: "roster",
      metadata: { name: "Unit Roster" },
    },
    {
      id: "loadout_station",
      x: 15,
      y: 3,
      width: 2,
      height: 2,
      type: "station",
      sprite: "loadout",
      metadata: { name: "Loadout" },
    },
    {
      id: "ops_terminal",
      x: 16,
      y: 10,
      width: 2,
      height: 2,
      type: "station",
      sprite: "ops_terminal",
      metadata: { name: "Ops Terminal" },
    },
    {
      id: "quest_board",
      x: 3,
      y: 10,
      width: 2,
      height: 2,
      type: "station",
      sprite: "quest_board",
      metadata: { name: "Quest Board" },
    },
    {
      id: "tavern_station",
      x: 7,
      y: 10,
      width: 2,
      height: 2,
      type: "station",
      sprite: "tavern",
      metadata: { name: "Tavern" },
    },
  ];
  
  // Interaction zones (in front of each station)
  const interactionZones: InteractionZone[] = [
    {
      id: "interact_shop",
      x: 3,
      y: 5,
      width: 2,
      height: 1,
      action: "shop",
      label: "SHOP",
    },
    {
      id: "interact_workshop",
      x: 7,
      y: 5,
      width: 2,
      height: 1,
      action: "workshop",
      label: "WORKSHOP",
    },
    {
      id: "interact_roster",
      x: 11,
      y: 5,
      width: 2,
      height: 1,
      action: "roster",
      label: "UNIT ROSTER",
    },
    {
      id: "interact_loadout",
      x: 15,
      y: 5,
      width: 2,
      height: 1,
      action: "loadout",
      label: "LOADOUT",
    },
    {
      id: "interact_ops",
      x: 16,
      y: 12,
      width: 2,
      height: 1,
      action: "ops_terminal",
      label: "OPS TERMINAL",
    },
    {
      id: "interact_quest_board",
      x: 3,
      y: 12,
      width: 2,
      height: 1,
      action: "quest_board",
      label: "QUEST BOARD",
    },
    {
      id: "interact_tavern",
      x: 7,
      y: 12,
      width: 2,
      height: 1,
      action: "tavern",
      label: "TAVERN",
    },
    {
      id: "enter_free_zone",
      x: 9,
      y: 13,
      width: 2,
      height: 1,
      action: "free_zone_entry",
      label: "ENTER FREE ZONE",
      metadata: { targetMap: "free_zone_1" },
    },
  ];
  
  return {
    id: "base_camp",
    name: "Base Camp",
    width,
    height,
    tiles,
    objects,
    interactionZones,
  };
}

// ============================================================================
// FREE ZONE MAP (Placeholder)
// ============================================================================

function createFreeZoneMap(): FieldMap {
  const width = 15;
  const height = 12;
  
  const tiles: FieldMap["tiles"] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      // Random walls for variety (simple pattern)
      const isWall = (x + y) % 5 === 0 && (x > 2 && x < width - 3 && y > 2 && y < height - 3);
      tiles[y][x] = {
        x,
        y,
        walkable: !isWall && (x !== 0 && x !== width - 1 && y !== 0 && y !== height - 1),
        type: isWall ? "wall" : "grass",
      };
    }
  }
  
  // Placeholder resources
  const objects: FieldObject[] = [
    {
      id: "resource_1",
      x: 5,
      y: 5,
      width: 1,
      height: 1,
      type: "resource",
      sprite: "resource",
      metadata: { resourceType: "metalScrap" },
    },
    {
      id: "resource_2",
      x: 10,
      y: 7,
      width: 1,
      height: 1,
      type: "resource",
      sprite: "resource",
      metadata: { resourceType: "wood" },
    },
  ];
  
  // Add entry point to free zone from base camp (will be added to base camp map)
  
  // Exit back to base camp (placed at walkable location)
  const interactionZones: InteractionZone[] = [
    {
      id: "exit_to_base_camp",
      x: 1,
      y: 6,
      width: 1,
      height: 1,
      action: "free_zone_entry",
      label: "RETURN TO BASE CAMP",
      metadata: { targetMap: "base_camp" },
    },
  ];
  
  return {
    id: "free_zone_1",
    name: "Free Zone",
    width,
    height,
    tiles,
    objects,
    interactionZones,
  };
}

// ============================================================================
// MAP REGISTRY
// ============================================================================

const maps = new Map<FieldMap["id"], FieldMap>([
  ["base_camp", createBaseCampMap()],
  ["free_zone_1", createFreeZoneMap()],
]);

export function getFieldMap(mapId: FieldMap["id"]): FieldMap {
  const map = maps.get(mapId);
  if (!map) {
    throw new Error(`Field map not found: ${mapId}`);
  }
  return map;
}

export function getAllMapIds(): FieldMap["id"][] {
  return Array.from(maps.keys());
}


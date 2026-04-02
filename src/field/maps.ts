// ============================================================================
// FIELD SYSTEM - MAP DEFINITIONS
// ============================================================================

import { FieldMap, FieldObject, InteractionZone } from "./types";
import {
  getAllImportedFieldMaps,
  getImportedFieldMap,
  isTechnicaContentDisabled,
} from "../content/technica";

// ============================================================================
// BASE CAMP MAP
// ============================================================================

function createBaseCampMap(): FieldMap {
  const width = 50;  // Increased width for annex
  const height = 25; // Increased height

  // Create walkable floor grid
  const tiles: FieldMap["tiles"] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      // Main Square: 0-30, 0-25
      const inMainSquare = x <= 30;

      // Annex: 38-50, 5-20
      const inAnnex = x >= 36 && y >= 5 && y <= 20;

      // Hallway: 30-38, 10-14
      const inHallway = x > 30 && x < 36 && y >= 10 && y <= 14;

      const isPlayableArea = inMainSquare || inAnnex || inHallway;

      if (!isPlayableArea) {
        // Void/Empty space
        tiles[y][x] = { x, y, walkable: false, type: "wall" }; // Visual wall or void
        continue;
      }

      // Walls around the playable areas
      let isWall = false;

      if (inMainSquare) {
        // Wall left, top, bottom of main square
        if (x === 0 || y === 0 || y === height - 1) isWall = true;
        // Wall right of main square (except hallway)
        if (x === 30 && !(y >= 10 && y <= 14)) isWall = true;
      } else if (inHallway) {
        // Wall top/bottom of hallway
        if (y === 10 || y === 14) isWall = true;
      } else if (inAnnex) {
        // Wall around annex
        if (x === width - 1 || y === 5 || y === 20) isWall = true;
        // Wall left of annex (except hallway)
        if (x === 36 && !(y >= 10 && y <= 14)) isWall = true;
      }

      tiles[y][x] = {
        x,
        y,
        walkable: !isWall,
        type: isWall ? "wall" : "floor",
      };
    }
  }

  // Station objects
  const objects: FieldObject[] = [
    // --- MAIN SQUARE ---
    {
      id: "shop_station",
      x: 3, y: 3, width: 2, height: 2, type: "station", sprite: "shop",
      metadata: { name: "Shop" },
    },

    {
      id: "roster_station",
      x: 11, y: 3, width: 2, height: 2, type: "station", sprite: "roster",
      metadata: { name: "Unit Roster" },
    },
    { // Loadout moved to above Ops
      id: "loadout_station",
      x: 27, y: 5, width: 2, height: 2, type: "station", sprite: "loadout",
      metadata: { name: "Loadout" },
    },
    {
      id: "ops_terminal",
      x: 27, y: 8, width: 2, height: 2, type: "station", sprite: "ops_terminal",
      metadata: { name: "Ops Terminal" },
    },
    {
      id: "quest_board",
      x: 3, y: 10, width: 2, height: 2, type: "station", sprite: "quest_board",
      metadata: { name: "Quest Board" },
    },
    {
      id: "tavern_station",
      x: 7, y: 10, width: 2, height: 2, type: "station", sprite: "tavern",
      metadata: { name: "Tavern" },
    },
    {
      id: "gear_workbench_station",
      x: 11, y: 10, width: 2, height: 2, type: "station", sprite: "gear_workbench",
      metadata: { name: "Workshop" },
    },
    {
      id: "port_station",
      x: 25, y: 15, width: 2, height: 2, type: "station", sprite: "port",
      metadata: { name: "Port" },
    },
    {
      id: "dispatch_station",
      x: 40, y: 12, width: 2, height: 2, type: "station", sprite: "dispatch",
      metadata: { name: "Dispatch" },
    },
    {
      id: "quarters_station",
      x: 7, y: 3, width: 2, height: 2, type: "station", sprite: "quarters",
      metadata: { name: "Quarters" },
    },
    {
      id: "black_market_station",
      x: 2, y: 17, width: 2, height: 2, type: "station", sprite: "black_market",
      metadata: { name: "Black Market" },
    },

    // --- ANNEX (New Area) ---
    {
      id: "comms_array_station",
      x: 40, y: 8, width: 2, height: 2, type: "station", sprite: "comms_array",
      metadata: { name: "Comms Array" },
    },
    {
      id: "stable_station",
      x: 44, y: 8, width: 2, height: 2, type: "station", sprite: "stable",
      metadata: { name: "Stable" },
    },
    {
      id: "mini_core_station",
      x: 42, y: 12, width: 2, height: 2, type: "station", sprite: "mini_core",
      metadata: { name: "Mini Core" },
    },
  ];

  // Interaction zones
  const interactionZones: InteractionZone[] = [
    { id: "interact_shop", x: 3, y: 3, width: 2, height: 2, action: "shop", label: "SHOP" },

    { id: "interact_roster", x: 11, y: 3, width: 2, height: 2, action: "roster", label: "UNIT ROSTER" },
    { id: "interact_loadout", x: 27, y: 5, width: 2, height: 2, action: "loadout", label: "LOADOUT" },
    { id: "interact_ops", x: 27, y: 8, width: 2, height: 2, action: "ops_terminal", label: "OPS TERMINAL" },
    { id: "interact_quest_board", x: 3, y: 10, width: 2, height: 2, action: "quest_board", label: "QUEST BOARD" },
    { id: "interact_tavern", x: 7, y: 10, width: 2, height: 2, action: "tavern", label: "TAVERN" },
    { id: "interact_gear_workbench", x: 11, y: 10, width: 2, height: 2, action: "gear_workbench", label: "WORKSHOP" },
    { id: "interact_port", x: 25, y: 15, width: 2, height: 2, action: "port", label: "PORT" },
    { id: "interact_dispatch", x: 40, y: 12, width: 2, height: 2, action: "dispatch", label: "DISPATCH" },
    { id: "interact_quarters", x: 7, y: 3, width: 2, height: 2, action: "quarters", label: "QUARTERS" },
    { id: "interact_black_market", x: 2, y: 17, width: 2, height: 2, action: "black_market", label: "BLACK MARKET" },

    // Annex Interactions
    { id: "interact_comms_array", x: 40, y: 8, width: 2, height: 2, action: "comms-array", label: "COMMS ARRAY" },
    { id: "interact_stable", x: 44, y: 8, width: 2, height: 2, action: "stable", label: "STABLE" },
    { id: "interact_mini_core", x: 42, y: 12, width: 2, height: 2, action: "mini_core", label: "MINI CORE" },

    {
      id: "enter_free_zone",
      x: 9, y: 13, width: 2, height: 1, action: "free_zone_entry",
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
// QUARTERS MAP
// ============================================================================

function createQuartersMap(): FieldMap {
  const width = 10;
  const height = 8;

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

  // Quarters objects (visual placeholders)
  const objects: FieldObject[] = [
    {
      id: "mailbox_object",
      x: 2,
      y: 2,
      width: 1,
      height: 1,
      type: "station",
      sprite: "mailbox",
      metadata: { name: "Mailbox" },
    },
    {
      id: "bunk_object",
      x: 7,
      y: 2,
      width: 2,
      height: 1,
      type: "station",
      sprite: "bunk",
      metadata: { name: "Bunk" },
    },
    {
      id: "pinboard_object",
      x: 2,
      y: 5,
      width: 1,
      height: 1,
      type: "station",
      sprite: "pinboard",
      metadata: { name: "Pinboard" },
    },
    {
      id: "footlocker_object",
      x: 7,
      y: 5,
      width: 1,
      height: 1,
      type: "station",
      sprite: "footlocker",
      metadata: { name: "Footlocker" },
    },
    {
      id: "exit_door_object",
      x: 4,
      y: 5,
      width: 2,
      height: 1,
      type: "station",
      sprite: "door",
      metadata: { name: "Exit" },
    },
  ];

  // Interaction zones for quarters interactables
  const interactionZones: InteractionZone[] = [
    {
      id: "interact_mailbox",
      x: 2,
      y: 3,
      width: 1,
      height: 1,
      action: "custom",
      label: "MAILBOX",
      metadata: { quartersAction: "mailbox" },
    },
    {
      id: "interact_bunk",
      x: 7,
      y: 3,
      width: 2,
      height: 1,
      action: "custom",
      label: "BUNK",
      metadata: { quartersAction: "bunk" },
    },
    {
      id: "interact_pinboard",
      x: 2,
      y: 6,
      width: 1,
      height: 1,
      action: "custom",
      label: "PINBOARD",
      metadata: { quartersAction: "pinboard" },
    },
    {
      id: "interact_footlocker",
      x: 7,
      y: 6,
      width: 1,
      height: 1,
      action: "custom",
      label: "FOOTLOCKER",
      metadata: { quartersAction: "footlocker" },
    },
    {
      id: "interact_sable",
      x: 5,
      y: 4,
      width: 1,
      height: 1,
      action: "custom",
      label: "SABLE",
      metadata: { quartersAction: "sable" },
    },
    {
      id: "exit_quarters",
      x: 4,
      y: 5,
      width: 2,
      height: 1,
      action: "base_camp_entry",
      label: "EXIT TO BASE CAMP",
      metadata: { targetMap: "base_camp" },
    },
  ];

  return {
    id: "quarters",
    name: "Quarters",
    width,
    height,
    tiles,
    objects,
    interactionZones,
  };
}

// KEY ROOM MAPS (Dynamic)
function createKeyRoomMap(mapId: string): FieldMap {
  // Extract key room ID from map ID (format: "keyroom_<roomNodeId>")
  const keyRoomId = mapId.replace("keyroom_", "");

  // Create a simple facility map for the key room
  // This is a placeholder - can be expanded with facility-specific layouts
  const width = 20;
  const height = 15;

  const tiles: Array<{ x: number; y: number; type: "floor" | "wall" }> = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Create walls around edges, floor in center
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        tiles.push({ x, y, type: "wall" });
      } else {
        tiles.push({ x, y, type: "floor" });
      }
    }
  }

  // Convert to 2D array format
  const tiles2D: import("./types").FieldTile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles2D[y] = [];
    for (let x = 0; x < width; x++) {
      const tile = tiles.find(t => t.x === x && t.y === y);
      tiles2D[y][x] = {
        x,
        y,
        walkable: tile?.type === "floor",
        type: tile?.type === "wall" ? "wall" : "floor",
      };
    }
  }

  return {
    id: mapId as FieldMap["id"],
    name: `Key Room: ${keyRoomId}`,
    width,
    height,
    tiles: tiles2D,
    objects: [],
    interactionZones: [
      {
        id: `exit_${keyRoomId}`,
        x: 1,
        y: height - 2,
        width: 2,
        height: 1,
        action: "base_camp_entry",
        label: "EXIT",
        metadata: { targetMap: "base_camp" },
      },
    ],
  };
}

// ============================================================================
// MAP REGISTRY
// ============================================================================

const maps = new Map<FieldMap["id"], FieldMap>([
  ...(isTechnicaContentDisabled("map", "base_camp") ? [] : [["base_camp", createBaseCampMap()] as const]),
  ...(isTechnicaContentDisabled("map", "free_zone_1") ? [] : [["free_zone_1", createFreeZoneMap()] as const]),
  ...(isTechnicaContentDisabled("map", "quarters") ? [] : [["quarters", createQuartersMap()] as const]),
]);

for (const importedMap of getAllImportedFieldMaps()) {
  maps.set(importedMap.id, importedMap);
}

export function getFieldMap(mapId: FieldMap["id"]): FieldMap {
  // Handle dynamic key room maps
  if (typeof mapId === "string" && mapId.startsWith("keyroom_")) {
    return createKeyRoomMap(mapId);
  }
  const map = maps.get(mapId) || getImportedFieldMap(mapId);
  if (!map) {
    throw new Error(`Field map not found: ${mapId}`);
  }
  return map;
}

export function getAllMapIds(): FieldMap["id"][] {
  return Array.from(maps.keys());
}

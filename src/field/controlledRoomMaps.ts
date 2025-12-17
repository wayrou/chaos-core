// ============================================================================
// CONTROLLED ROOM FIELD MAPS (Headline 14e)
// Field mode maps for controlled room exploration and fortification
// ============================================================================

import { FieldMap, FieldObject, InteractionZone } from "./types";
import { ControlledRoomType } from "../core/campaign";

/**
 * Create a controlled room field map
 * Generic template with fortification interaction points
 */
export function createControlledRoomMap(roomType: ControlledRoomType, nodeId: string): FieldMap {
  const width = 16;
  const height = 12;

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

  // Base objects (visual) - vary by room type
  const objects: FieldObject[] = getRoomTypeObjects(roomType);

  // Interaction zones - fortification build points + exit
  const interactionZones: InteractionZone[] = [
    // Barricade build points (3 locations)
    {
      id: "barricade_point_1",
      x: 2,
      y: 2,
      width: 2,
      height: 1,
      action: "build_barricade",
      label: "BUILD BARRICADE (Slot 1)",
      metadata: { barricadeSlot: 1, nodeId },
    },
    {
      id: "barricade_point_2",
      x: 6,
      y: 2,
      width: 2,
      height: 1,
      action: "build_barricade",
      label: "BUILD BARRICADE (Slot 2)",
      metadata: { barricadeSlot: 2, nodeId },
    },
    {
      id: "barricade_point_3",
      x: 12,
      y: 2,
      width: 2,
      height: 1,
      action: "build_barricade",
      label: "BUILD BARRICADE (Slot 3)",
      metadata: { barricadeSlot: 3, nodeId },
    },

    // Turret install points (2 locations)
    {
      id: "turret_point_1",
      x: 3,
      y: 8,
      width: 2,
      height: 2,
      action: "install_turret",
      label: "INSTALL TURRET (Slot 1)",
      metadata: { turretSlot: 1, nodeId },
    },
    {
      id: "turret_point_2",
      x: 11,
      y: 8,
      width: 2,
      height: 2,
      action: "install_turret",
      label: "INSTALL TURRET (Slot 2)",
      metadata: { turretSlot: 2, nodeId },
    },

    // Wall reinforcement point (center)
    {
      id: "wall_reinforcement_point",
      x: 7,
      y: 5,
      width: 2,
      height: 2,
      action: "reinforce_walls",
      label: "REINFORCE WALLS",
      metadata: { nodeId },
    },

    // Generator install point (back corner)
    {
      id: "generator_point",
      x: 13,
      y: 9,
      width: 2,
      height: 2,
      action: "install_generator",
      label: "INSTALL GENERATOR",
      metadata: { nodeId },
    },

    // Exit (bottom center)
    {
      id: "exit_controlled_room",
      x: 7,
      y: 10,
      width: 2,
      height: 1,
      action: "exit_controlled_room",
      label: "EXIT TO OPERATION MAP",
      metadata: { nodeId },
    },
  ];

  return {
    id: getFieldMapIdForRoomType(roomType),
    name: getRoomTypeName(roomType),
    width,
    height,
    tiles,
    objects,
    interactionZones,
  };
}

/**
 * Get field map ID for controlled room type
 */
function getFieldMapIdForRoomType(roomType: ControlledRoomType): FieldMap["id"] {
  const mapping: Record<ControlledRoomType, FieldMap["id"]> = {
    supply_depot: "controlled_supply_depot",
    medical_ward: "controlled_medical_ward",
    armory: "controlled_armory",
    command_center: "controlled_command_center",
    mine: "controlled_mine",
    outpost: "controlled_outpost",
  };
  return mapping[roomType];
}

/**
 * Get room type display name
 */
function getRoomTypeName(roomType: ControlledRoomType): string {
  const names: Record<ControlledRoomType, string> = {
    supply_depot: "Supply Depot (Controlled)",
    medical_ward: "Medical Ward (Controlled)",
    armory: "Armory (Controlled)",
    command_center: "Command Center (Controlled)",
    mine: "Mine (Controlled)",
    outpost: "Outpost (Controlled)",
  };
  return names[roomType];
}

/**
 * Get room-type-specific visual objects
 */
function getRoomTypeObjects(roomType: ControlledRoomType): FieldObject[] {
  switch (roomType) {
    case "supply_depot":
      return [
        {
          id: "supply_crates",
          x: 4,
          y: 4,
          width: 2,
          height: 2,
          type: "decoration",
          sprite: "crates",
          metadata: { description: "Supply Crates" },
        },
        {
          id: "supply_rack",
          x: 10,
          y: 4,
          width: 2,
          height: 2,
          type: "decoration",
          sprite: "rack",
          metadata: { description: "Supply Rack" },
        },
      ];

    case "medical_ward":
      return [
        {
          id: "medical_table",
          x: 7,
          y: 3,
          width: 2,
          height: 1,
          type: "decoration",
          sprite: "medical_table",
          metadata: { description: "Medical Table" },
        },
        {
          id: "medical_cabinet",
          x: 2,
          y: 5,
          width: 1,
          height: 2,
          type: "decoration",
          sprite: "cabinet",
          metadata: { description: "Medical Supplies" },
        },
      ];

    case "armory":
      return [
        {
          id: "weapon_rack_1",
          x: 3,
          y: 4,
          width: 1,
          height: 2,
          type: "decoration",
          sprite: "weapon_rack",
          metadata: { description: "Weapon Rack" },
        },
        {
          id: "weapon_rack_2",
          x: 12,
          y: 4,
          width: 1,
          height: 2,
          type: "decoration",
          sprite: "weapon_rack",
          metadata: { description: "Weapon Rack" },
        },
        {
          id: "armor_stand",
          x: 7,
          y: 6,
          width: 2,
          height: 2,
          type: "decoration",
          sprite: "armor_stand",
          metadata: { description: "Armor Stand" },
        },
      ];

    case "command_center":
      return [
        {
          id: "tactical_table",
          x: 6,
          y: 4,
          width: 4,
          height: 3,
          type: "decoration",
          sprite: "tactical_table",
          metadata: { description: "Tactical Map Table" },
        },
        {
          id: "comms_console",
          x: 2,
          y: 4,
          width: 2,
          height: 2,
          type: "decoration",
          sprite: "console",
          metadata: { description: "Comms Console" },
        },
      ];

    case "mine":
      return [
        {
          id: "mining_cart",
          x: 4,
          y: 7,
          width: 2,
          height: 2,
          type: "decoration",
          sprite: "cart",
          metadata: { description: "Mining Cart" },
        },
        {
          id: "ore_pile",
          x: 10,
          y: 6,
          width: 2,
          height: 2,
          type: "decoration",
          sprite: "ore",
          metadata: { description: "Ore Pile" },
        },
        {
          id: "pickaxe_rack",
          x: 13,
          y: 3,
          width: 1,
          height: 1,
          type: "decoration",
          sprite: "tools",
          metadata: { description: "Mining Tools" },
        },
      ];

    case "outpost":
    default:
      return [
        {
          id: "generic_table",
          x: 7,
          y: 4,
          width: 2,
          height: 2,
          type: "decoration",
          sprite: "table",
          metadata: { description: "Equipment Table" },
        },
        {
          id: "generic_bench",
          x: 3,
          y: 6,
          width: 3,
          height: 1,
          type: "decoration",
          sprite: "bench",
          metadata: { description: "Bench" },
        },
      ];
  }
}

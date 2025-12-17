// ============================================================================
// FIELD SYSTEM - TYPES
// ============================================================================

export type FieldMapId =
  | "base_camp"
  | "free_zone_1"
  | "free_zone_2"
  | "quarters"
  // Controlled Room maps (Headline 14e)
  | "controlled_supply_depot"
  | "controlled_medical_ward"
  | "controlled_armory"
  | "controlled_command_center"
  | "controlled_mine"
  | "controlled_outpost";

export interface FieldMap {
  id: FieldMapId;
  name: string;
  width: number;
  height: number;
  tiles: FieldTile[][];
  objects: FieldObject[];
  interactionZones: InteractionZone[];
}

export interface FieldTile {
  x: number;
  y: number;
  walkable: boolean;
  type: "floor" | "wall" | "grass" | "dirt" | "stone";
}

export interface FieldObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "station" | "resource" | "enemy" | "door" | "decoration";
  sprite?: string; // Placeholder sprite path
  metadata?: Record<string, any>;
}

export interface InteractionZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  action:
    | "shop"
    | "workshop"
    | "roster"
    | "loadout"
    | "ops_terminal"
    | "quest_board"
    | "tavern"
    | "gear_workbench"
    | "port"
    | "quarters"
    | "black_market"
    | "free_zone_entry"
    | "base_camp_entry"
    | "custom"
    // Controlled Room actions (Headline 14e)
    | "build_barricade"
    | "install_turret"
    | "reinforce_walls"
    | "install_generator"
    | "exit_controlled_room";
  label: string;
  metadata?: Record<string, any>;
}

export interface PlayerAvatar {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  facing: "north" | "south" | "east" | "west";
}

export interface FieldNpc {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  state: "idle" | "walk";
  direction: "north" | "south" | "east" | "west";
  path?: { x: number; y: number }[]; // Patrol path
  currentPathIndex?: number;
  dialogueId?: string;
  stateStartTime: number; // When current state (idle/walk) started
  stateDuration: number; // How long to stay in current state
}

export interface FieldState {
  currentMap: FieldMapId;
  player: PlayerAvatar;
  isPaused: boolean;
  activeInteraction: string | null; // ID of active interaction zone
  companion?: import("./companion").Companion; // Sable companion (Headline 15a)
  npcs?: FieldNpc[]; // NPCs for Base Camp (Headline 15b)
}


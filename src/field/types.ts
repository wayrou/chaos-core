// ============================================================================
// FIELD SYSTEM - TYPES
// ============================================================================

export type FieldMapId = "base_camp" | "free_zone_1" | "free_zone_2";

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
  action: "shop" | "workshop" | "roster" | "loadout" | "ops_terminal" | "quest_board" | "free_zone_entry" | "base_camp_entry" | "custom";
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

export interface FieldState {
  currentMap: FieldMapId;
  player: PlayerAvatar;
  isPaused: boolean;
  activeInteraction: string | null; // ID of active interaction zone
}


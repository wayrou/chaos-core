// ============================================================================
// FIELD SYSTEM - NPCs (Headline 15b)
// NPCs that walk around Base Camp and can be talked to
// ============================================================================

import { FieldNpc, FieldMap, PlayerAvatar } from "./types";
import {
  getAllImportedNpcs,
  isTechnicaContentDisabled,
} from "../content/technica";
import type { ImportedNpcTemplate } from "../content/technica/types";

// ============================================================================
// CONSTANTS
// ============================================================================

const NPC_SPEED = 40; // pixels per second (slow walk)
const NPC_WIDTH = 32;
const NPC_HEIGHT = 32;
const NPC_WALK_DURATION_MIN = 2000; // ms - minimum time to walk
const NPC_WALK_DURATION_MAX = 4000; // ms - maximum time to walk
const NPC_IDLE_DURATION_MIN = 3000; // ms - minimum time to idle
const NPC_IDLE_DURATION_MAX = 6000; // ms - maximum time to idle
const NPC_INTERACTION_RANGE = 50; // pixels
const FIELD_TILE_SIZE = 64;

export type BuiltInNpcDefinition = {
  id: string;
  name: string;
  mapId: string;
  tileX: number;
  tileY: number;
  routeMode?: "fixed" | "random" | "none";
  dialogueId?: string;
  portraitKey?: string;
  spriteKey?: string;
  portraitPath?: string;
  spritePath?: string;
  routePoints?: Array<{ id?: string; x: number; y: number }>;
};

export const BUILT_IN_NPCS: BuiltInNpcDefinition[] = [
  { id: "npc_medic", name: "Medic", mapId: "base_camp", tileX: 5, tileY: 8, routeMode: "random", dialogueId: "npc_medic" },
  { id: "npc_quartermaster", name: "Quartermaster", mapId: "base_camp", tileX: 12, tileY: 6, routeMode: "random", dialogueId: "npc_quartermaster" },
  { id: "npc_scout", name: "Scout", mapId: "base_camp", tileX: 8, tileY: 12, routeMode: "random", dialogueId: "npc_scout" },
  { id: "npc_engineer", name: "Engineer", mapId: "base_camp", tileX: 14, tileY: 10, routeMode: "random", dialogueId: "npc_engineer" },
  { id: "npc_supply_officer", name: "Supply Officer", mapId: "base_camp", tileX: 20, tileY: 8, routeMode: "random", dialogueId: "npc_supply_officer" },
  {
    "id": "npc_test",
    "name": "Tester",
    "mapId": "base_camp",
    "tileX": 4,
    "tileY": 14,
    "routeMode": "fixed",
    "dialogueId": "tester_dialogue",
  },
  {
    "id": "npc_commander",
    "name": "Commander",
    "mapId": "base_camp",
    "tileX": 43,
    "tileY": 8,
    "routeMode": "random",
    "dialogueId": "npc_commander",
  },
  { id: "npc_researcher", name: "Researcher", mapId: "base_camp", tileX: 4, tileY: 10, routeMode: "random", dialogueId: "npc_researcher" },
  { id: "npc_sentinel", name: "Sentinel", mapId: "base_camp", tileX: 18, tileY: 12, routeMode: "random", dialogueId: "npc_sentinel" },
];

// ============================================================================
// NPC CREATION
// ============================================================================

export function createNpc(
  id: string,
  name: string,
  x: number,
  y: number,
  dialogueId?: string,
  options?: {
    routeMode?: "fixed" | "random" | "none";
    routePoints?: Array<{ id?: string; x: number; y: number }>;
    routePointIndex?: number;
    spawnMapId?: string;
    portraitKey?: string;
    spriteKey?: string;
    portraitPath?: string;
    spritePath?: string;
  }
): FieldNpc {
  const idleDuration = NPC_IDLE_DURATION_MIN + Math.random() * (NPC_IDLE_DURATION_MAX - NPC_IDLE_DURATION_MIN);
  return {
    id,
    name,
    x,
    y,
    width: NPC_WIDTH,
    height: NPC_HEIGHT,
    state: "idle",
    direction: "south",
    dialogueId,
    routeMode: options?.routeMode ?? "random",
    routePoints: options?.routePoints?.map((point) => ({ ...point })) ?? [],
    routePointIndex: options?.routePointIndex ?? 0,
    spawnMapId: options?.spawnMapId,
    portraitKey: options?.portraitKey,
    spriteKey: options?.spriteKey,
    portraitPath: options?.portraitPath,
    spritePath: options?.spritePath,
    stateStartTime: 0, // Will be set when NPC is first updated
    stateDuration: idleDuration,
  };
}

function createNpcFromDefinition(definition: BuiltInNpcDefinition | ImportedNpcTemplate): FieldNpc {
  const tileX = "tileX" in definition ? definition.tileX : definition.x;
  const tileY = "tileY" in definition ? definition.tileY : definition.y;
  return createNpc(
    definition.id,
    definition.name,
    tileX * FIELD_TILE_SIZE + FIELD_TILE_SIZE / 2,
    tileY * FIELD_TILE_SIZE + FIELD_TILE_SIZE / 2,
    definition.dialogueId,
    {
      routeMode: definition.routeMode ?? "random",
      routePoints: (definition.routePoints ?? []).map((point) => ({
        id: point.id,
        x: point.x * FIELD_TILE_SIZE + FIELD_TILE_SIZE / 2,
        y: point.y * FIELD_TILE_SIZE + FIELD_TILE_SIZE / 2,
      })),
      routePointIndex: 0,
      spawnMapId: definition.mapId,
      portraitKey: definition.portraitKey,
      spriteKey: definition.spriteKey,
      portraitPath: definition.portraitPath,
      spritePath: definition.spritePath,
    }
  );
}

export function getFieldNpcsForMap(mapId: string): FieldNpc[] {
  const npcById = new Map<string, FieldNpc>();

  BUILT_IN_NPCS
    .filter((npc) => npc.mapId === mapId && !isTechnicaContentDisabled("npc", npc.id))
    .forEach((npc) => {
      npcById.set(npc.id, createNpcFromDefinition(npc));
    });

  getAllImportedNpcs()
    .filter((npc) => npc.mapId === mapId)
    .forEach((npc) => {
      npcById.set(npc.id, createNpcFromDefinition(npc));
    });

  return Array.from(npcById.values());
}

// ============================================================================
// NPC MOVEMENT (Simple Patrol)
// ============================================================================

export function updateNpc(
  npc: FieldNpc,
  map: FieldMap,
  deltaTime: number,
  currentTime: number
): FieldNpc {
  // Initialize stateStartTime if not set
  if (npc.stateStartTime === 0) {
    npc.stateStartTime = currentTime;
  }

  if (npc.routeMode === "none") {
    npc.state = "idle";
    return npc;
  }

  if (npc.routeMode === "fixed") {
    if (!npc.routePoints || npc.routePoints.length === 0) {
      npc.state = "idle";
      return npc;
    }

    const nextPointIndex = npc.routePointIndex ?? 0;
    const targetPoint = npc.routePoints[nextPointIndex % npc.routePoints.length];
    const dx = targetPoint.x - npc.x;
    const dy = targetPoint.y - npc.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= 2) {
      npc.routePointIndex = (nextPointIndex + 1) % npc.routePoints.length;
      npc.state = "idle";
      npc.stateStartTime = currentTime;
      npc.stateDuration = NPC_IDLE_DURATION_MIN;
      return npc;
    }

    const moveDistance = Math.min(NPC_SPEED * (deltaTime / 1000), distance);
    npc.x += (dx / distance) * moveDistance;
    npc.y += (dy / distance) * moveDistance;
    npc.state = "walk";
    npc.direction = Math.abs(dx) >= Math.abs(dy)
      ? dx >= 0 ? "east" : "west"
      : dy >= 0 ? "south" : "north";
    return npc;
  }
  
  const timeInState = currentTime - npc.stateStartTime;
  
  // Check if state duration has expired
  if (timeInState >= npc.stateDuration) {
    // Switch state
    if (npc.state === "idle") {
      // Start walking
      npc.state = "walk";
      npc.direction = ["north", "south", "east", "west"][Math.floor(Math.random() * 4)] as FieldNpc["direction"];
      npc.stateStartTime = currentTime;
      npc.stateDuration = NPC_WALK_DURATION_MIN + Math.random() * (NPC_WALK_DURATION_MAX - NPC_WALK_DURATION_MIN);
    } else {
      // Stop walking, go idle
      npc.state = "idle";
      npc.stateStartTime = currentTime;
      npc.stateDuration = NPC_IDLE_DURATION_MIN + Math.random() * (NPC_IDLE_DURATION_MAX - NPC_IDLE_DURATION_MIN);
    }
  }
  
  // If walking, move in current direction
  if (npc.state === "walk") {
    const moveDistance = NPC_SPEED * (deltaTime / 1000);
    let newX = npc.x;
    let newY = npc.y;
    
    switch (npc.direction) {
      case "north":
        newY -= moveDistance;
        break;
      case "south":
        newY += moveDistance;
        break;
      case "east":
        newX += moveDistance;
        break;
      case "west":
        newX -= moveDistance;
        break;
    }
    
    // Check collision with map boundaries
    const tileX = Math.floor(newX / FIELD_TILE_SIZE);
    const tileY = Math.floor(newY / FIELD_TILE_SIZE);
    
    if (
      tileX >= 0 && tileX < map.width &&
      tileY >= 0 && tileY < map.height &&
      map.tiles[tileY] && map.tiles[tileY][tileX]?.walkable
    ) {
      npc.x = newX;
      npc.y = newY;
    } else {
      // Hit a wall, change direction
      const directions: FieldNpc["direction"][] = ["north", "south", "east", "west"];
      const currentIndex = directions.indexOf(npc.direction);
      // Try opposite direction first, then random
      const oppositeIndex = (currentIndex + 2) % 4;
      npc.direction = directions[oppositeIndex];
    }
  }
  
  return npc;
}

// ============================================================================
// NPC INTERACTION
// ============================================================================

export function getNpcInRange(
  player: PlayerAvatar,
  npcs: FieldNpc[]
): FieldNpc | null {
  for (const npc of npcs) {
    const dx = npc.x - player.x;
    const dy = npc.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < NPC_INTERACTION_RANGE) {
      return npc;
    }
  }
  
  return null;
}

// ============================================================================
// DIALOGUE DATA
// ============================================================================

export const NPC_DIALOGUE: Record<string, string[]> = {
  npc_medic: [
    "Hey there, commander.",
    "If you get beat up out there, come back in one piece.",
    "I can patch you up, but I can't bring you back from the dead.",
  ],
  npc_quartermaster: [
    "Need gear? I keep track of the good stuff.",
    "For now this is just placeholder dialogue.",
    "But we're working on expanding the inventory system.",
  ],
  npc_scout: [
    "The field nodes are getting more dangerous.",
    "I've seen things out there... things that shouldn't exist.",
    "Stay sharp, commander.",
  ],
  npc_engineer: [
    "Those S/COM_OS terminals are ancient tech.",
    "Still works better than most modern systems though.",
    "Can't argue with reliability.",
  ],
  npc_supply_officer: [
    "The supply lines are holding, but we're running low on metal scrap.",
    "Every shipment counts. Make sure you're trading efficiently.",
    "If you need resources, the port is your best bet.",
  ],
  npc_armorer: [
    "I maintain all the equipment around here.",
    "Good gear makes the difference between life and death out there.",
    "Stop by the shop if you need upgrades. I keep it stocked.",
  ],
  "npc_commander": [
    "Oh, okay then.",
  ],
  npc_researcher: [
    "I've been studying the chaos shards we've collected.",
    "There's something strange about their energy patterns.",
    "The more we learn, the better prepared we'll be.",
  ],
  npc_sentinel: [
    "I keep watch over the base camp perimeter.",
    "Nothing gets past me. Safety is my priority.",
    "If you see anything suspicious out there, report it immediately.",
  ],
  npc_keyroom_logistics: [
    "We sorted this site into a working depot faster than expected.",
    "Every crate we recover here keeps the front from starving for stock.",
    "Hold the room and the flow keeps moving.",
  ],
  npc_keyroom_medic: [
    "This ward is rough, but it still keeps people breathing.",
    "Patch kits are stacked where I can reach them in a hurry.",
    "If this room falls, the whole line feels it.",
  ],
  npc_keyroom_armorer: [
    "The armory benches still have life in them.",
    "Keep metal coming and I can turn scrap into something useful.",
    "A held position is only as good as the gear behind it.",
  ],
  npc_keyroom_analyst: [
    "Command relays from this room keep the map from going blind.",
    "Every scouting report we pull here sharpens the route ahead.",
    "Lose the uplink and we're back to guessing.",
  ],
  npc_keyroom_miner: [
    "The haul from this shaft is ugly, but rich.",
    "We pull metal, timber, and the occasional shard if the walls behave.",
    "Just don't ask what keeps scratching beyond the supports.",
  ],
};

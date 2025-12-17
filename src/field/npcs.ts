// ============================================================================
// FIELD SYSTEM - NPCs (Headline 15b)
// NPCs that walk around Base Camp and can be talked to
// ============================================================================

import { FieldNpc, FieldMap, PlayerAvatar } from "./types";

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

// ============================================================================
// NPC CREATION
// ============================================================================

export function createNpc(
  id: string,
  name: string,
  x: number,
  y: number,
  dialogueId?: string
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
    stateStartTime: 0, // Will be set when NPC is first updated
    stateDuration: idleDuration,
  };
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
    const tileSize = 64;
    const tileX = Math.floor(newX / tileSize);
    const tileY = Math.floor(newY / tileSize);
    
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
    "Those Scroll Link terminals are ancient tech.",
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
  npc_commander: [
    "Operations are running smoothly, but we need more intel.",
    "The field nodes are our primary source of intelligence.",
    "Keep pushing forward, commander. We're counting on you.",
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
};


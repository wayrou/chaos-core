// ============================================================================
// FIELD SYSTEM - NPCs (Headline 15b)
// NPCs that walk around Base Camp and can be talked to
// ============================================================================

import { FieldNpc, FieldMap, PlayerAvatar } from "./types";

// ============================================================================
// CONSTANTS
// ============================================================================

const NPC_SPEED = 60; // pixels per second (slow walk)
const NPC_WIDTH = 32;
const NPC_HEIGHT = 32;
const NPC_MOVE_COOLDOWN = 2000; // ms between movement decisions
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
    lastMoveTime: 0,
    moveCooldown: NPC_MOVE_COOLDOWN,
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
  // Check if it's time to move
  if (currentTime - npc.lastMoveTime < npc.moveCooldown) {
    return npc;
  }
  
  // Simple random walk pattern
  if (npc.state === "idle") {
    // Occasionally start walking
    if (Math.random() < 0.3) {
      npc.state = "walk";
      npc.direction = ["north", "south", "east", "west"][Math.floor(Math.random() * 4)] as FieldNpc["direction"];
      npc.lastMoveTime = currentTime;
      npc.moveCooldown = 1000 + Math.random() * 2000; // Walk for 1-3 seconds
    }
  } else if (npc.state === "walk") {
    // Move in current direction
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
      map.tiles[tileY][tileX]?.walkable
    ) {
      npc.x = newX;
      npc.y = newY;
    } else {
      // Hit a wall, change direction or stop
      if (Math.random() < 0.5) {
        npc.direction = ["north", "south", "east", "west"][Math.floor(Math.random() * 4)] as FieldNpc["direction"];
      } else {
        npc.state = "idle";
        npc.lastMoveTime = currentTime;
        npc.moveCooldown = 2000 + Math.random() * 3000; // Idle for 2-5 seconds
      }
    }
    
    // Check if walk duration expired
    if (currentTime - npc.lastMoveTime > npc.moveCooldown) {
      npc.state = "idle";
      npc.lastMoveTime = currentTime;
      npc.moveCooldown = 2000 + Math.random() * 3000;
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
    "Those ScrollLink terminals are ancient tech.",
    "Still works better than most modern systems though.",
    "Can't argue with reliability.",
  ],
};


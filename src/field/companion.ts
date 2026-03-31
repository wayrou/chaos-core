// ============================================================================
// FIELD SYSTEM - COMPANION (SABLE)
// Headline 15a: Dog companion that follows, fetches resources, attacks enemies
// ============================================================================

import { PlayerAvatar, FieldMap } from "./types";

// Export Companion type
export interface Companion {
  id: "sable";
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  state: "idle" | "follow" | "fetch" | "attack";
  target?: { x: number; y: number; id?: string }; // For fetch/attack targets
  behaviorCooldownMs: number;
  lastBehaviorTime: number;
  attackCooldown: number; // Time remaining until next attack (ms)
  facing: "north" | "south" | "east" | "west";
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COMPANION_SPEED = 300; // pixels per second (faster than player for more active companion)
const COMPANION_ATTACK_SPEED = 500; // pixels per second when attacking
const COMPANION_WIDTH = 28;
const COMPANION_HEIGHT = 28;
const FOLLOW_RADIUS = 120; // Distance to maintain from player
const COMFORT_RADIUS = 60; // Distance where Sable idles
const FETCH_RADIUS = 150; // Radius to search for resources
const ATTACK_RADIUS = 200; // Radius to search for enemies
const BEHAVIOR_COOLDOWN = 500; // ms between behavior checks
const ATTACK_DAMAGE = 3; // Enough to kill light enemies in one hit

// ============================================================================
// COMPANION CREATION
// ============================================================================

export function createCompanion(startX: number, startY: number): Companion {
  return {
    id: "sable",
    x: startX,
    y: startY,
    width: COMPANION_WIDTH,
    height: COMPANION_HEIGHT,
    speed: COMPANION_SPEED,
    state: "follow",
    behaviorCooldownMs: BEHAVIOR_COOLDOWN,
    lastBehaviorTime: 0,
    attackCooldown: 0,
    facing: "south",
  };
}

// ============================================================================
// COMPANION UPDATE (Base Camp)
// ============================================================================

export interface CompanionContext {
  player: PlayerAvatar;
  map: FieldMap;
  deltaTime: number;
  currentTime: number;
}

export function updateCompanion(
  companion: Companion,
  context: CompanionContext
): Companion {
  const { player, map, deltaTime, currentTime } = context;
  
  // Update behavior cooldown
  if (currentTime - companion.lastBehaviorTime > companion.behaviorCooldownMs) {
    companion.lastBehaviorTime = currentTime;
    
    // Check for nearby resources to fetch (only in follow state)
    if (companion.state === "follow" || companion.state === "idle") {
      // Note: Resource fetching will be handled in Field Node rooms
      // Base Camp doesn't have sparkles, so we skip fetch behavior here
    }
  }
  
  // Update based on current state
  // For Base Camp, we only do follow behavior (no fetch/attack)
  return updateFollowBehavior(companion, player, deltaTime, map);
}

// ============================================================================
// FOLLOW BEHAVIOR
// ============================================================================

function updateFollowBehavior(
  companion: Companion,
  player: PlayerAvatar,
  deltaTime: number,
  map: FieldMap
): Companion {
  const dx = player.x - companion.x;
  const dy = player.y - companion.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Determine state based on distance
  let newState: "idle" | "follow" = companion.state;
  if (distance > FOLLOW_RADIUS) {
    newState = "follow";
  } else if (distance < COMFORT_RADIUS) {
    newState = "idle";
  } else {
    newState = "follow";
  }
  
  // Move toward player if too far
  if (distance > FOLLOW_RADIUS) {
    const moveDistance = companion.speed * (deltaTime / 1000);
    const moveX = (dx / distance) * moveDistance;
    const moveY = (dy / distance) * moveDistance;
    
    let newX = companion.x + moveX;
    let newY = companion.y + moveY;
    
    // Simple collision avoidance (don't move into walls)
    const tileSize = 64;
    const tileX = Math.floor(newX / tileSize);
    const tileY = Math.floor(newY / tileSize);
    
    if (tileX >= 0 && tileX < map.width && tileY >= 0 && tileY < map.height) {
      if (map.tiles[tileY][tileX]?.walkable) {
        companion.x = newX;
        companion.y = newY;
      }
    }
    
    // Update facing
    if (Math.abs(dx) > Math.abs(dy)) {
      companion.facing = dx > 0 ? "east" : "west";
    } else {
      companion.facing = dy > 0 ? "south" : "north";
    }
  }
  
  return {
    ...companion,
    state: newState,
  };
}

// ============================================================================
// FETCH BEHAVIOR (for Field Nodes)
// ============================================================================

export interface FetchTarget {
  x: number;
  y: number;
  id: string;
}

export function updateCompanionFetch(
  companion: Companion,
  player: PlayerAvatar,
  target: FetchTarget | null,
  deltaTime: number,
  map: FieldMap
): Companion {
  if (!target) {
    // No target, return to follow
    return {
      ...companion,
      state: "follow",
      target: undefined,
    };
  }
  
  const dx = target.x - companion.x;
  const dy = target.y - companion.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // If reached target, return to follow
  if (distance < 20) {
    return {
      ...companion,
      state: "follow",
      target: undefined,
    };
  }
  
  // Move toward target
  const moveDistance = companion.speed * 1.5 * (deltaTime / 1000); // Faster when fetching
  const moveX = (dx / distance) * moveDistance;
  const moveY = (dy / distance) * moveDistance;
  
  let newX = companion.x + moveX;
  let newY = companion.y + moveY;
  
  // Simple collision check
  const tileSize = 64;
  const tileX = Math.floor(newX / tileSize);
  const tileY = Math.floor(newY / tileSize);
  
  if (tileX >= 0 && tileX < map.width && tileY >= 0 && tileY < map.height) {
    if (map.tiles[tileY][tileX]?.walkable) {
      companion.x = newX;
      companion.y = newY;
    }
  }
  
  // Update facing
  if (Math.abs(dx) > Math.abs(dy)) {
    companion.facing = dx > 0 ? "east" : "west";
  } else {
    companion.facing = dy > 0 ? "south" : "north";
  }
  
  return {
    ...companion,
    state: "fetch",
    target: { x: target.x, y: target.y, id: target.id },
  };
}

// ============================================================================
// ATTACK BEHAVIOR (for Field Nodes)
// ============================================================================

export interface AttackTarget {
  x: number;
  y: number;
  id: string;
}

export function updateCompanionAttack(
  companion: Companion,
  player: PlayerAvatar,
  target: AttackTarget | null,
  deltaTime: number,
  map: FieldMap
): Companion {
  if (!target) {
    // No target, return to follow
    return {
      ...companion,
      state: "follow",
      target: undefined,
    };
  }
  
  const dx = target.x - companion.x;
  const dy = target.y - companion.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // If reached target, deal damage and return to follow
  if (distance < 30) {
    return {
      ...companion,
      state: "follow",
      target: undefined,
    };
  }
  
  // Dash toward target (faster than normal)
  const moveDistance = COMPANION_ATTACK_SPEED * (deltaTime / 1000);
  const moveX = (dx / distance) * moveDistance;
  const moveY = (dy / distance) * moveDistance;
  
  let newX = companion.x + moveX;
  let newY = companion.y + moveY;
  
  // Simple collision check
  const tileSize = 64;
  const tileX = Math.floor(newX / tileSize);
  const tileY = Math.floor(newY / tileSize);
  
  if (tileX >= 0 && tileX < map.width && tileY >= 0 && tileY < map.height) {
    if (map.tiles[tileY][tileX]?.walkable) {
      companion.x = newX;
      companion.y = newY;
    }
  }
  
  // Update facing
  if (Math.abs(dx) > Math.abs(dy)) {
    companion.facing = dx > 0 ? "east" : "west";
  } else {
    companion.facing = dy > 0 ? "south" : "north";
  }
  
  return {
    ...companion,
    state: "attack",
    target: { x: target.x, y: target.y, id: target.id },
  };
}

// ============================================================================
// HELPER: Find nearest resource sparkle
// ============================================================================

export interface ResourceSparkle {
  id: string;
  x: number;
  y: number;
  collected: boolean;
}

export function findNearestResource(
  companion: Companion,
  player: PlayerAvatar,
  sparkles: ResourceSparkle[]
): FetchTarget | null {
  const searchRadius = FETCH_RADIUS;
  let nearest: ResourceSparkle | null = null;
  let nearestDist = searchRadius;
  
  for (const sparkle of sparkles) {
    if (sparkle.collected) continue;
    
    // Check distance from companion
    const dx = sparkle.x - companion.x;
    const dy = sparkle.y - companion.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < nearestDist) {
      nearest = sparkle;
      nearestDist = dist;
    }
  }
  
  if (nearest) {
    return {
      x: nearest.x,
      y: nearest.y,
      id: nearest.id,
    };
  }
  
  return null;
}

// ============================================================================
// HELPER: Find nearest enemy
// ============================================================================

export interface LightEnemy {
  id: string;
  x: number;
  y: number;
  hp: number;
}

export function findNearestEnemy(
  companion: Companion,
  player: PlayerAvatar,
  enemies: LightEnemy[]
): AttackTarget | null {
  const searchRadius = ATTACK_RADIUS;
  let nearest: LightEnemy | null = null;
  let nearestDist = searchRadius;
  
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    
    // Check distance from companion
    const dx = enemy.x - companion.x;
    const dy = enemy.y - companion.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < nearestDist) {
      nearest = enemy;
      nearestDist = dist;
    }
  }
  
  if (nearest) {
    return {
      x: nearest.x,
      y: nearest.y,
      id: nearest.id,
    };
  }
  
  return null;
}

// ============================================================================
// HELPER: Check if companion reached target (for damage/collection)
// ============================================================================

export function checkCompanionReachedTarget(
  companion: Companion,
  targetId: string,
  threshold: number = 30
): boolean {
  if (!companion.target || companion.target.id !== targetId) {
    return false;
  }
  
  const dx = companion.target.x - companion.x;
  const dy = companion.target.y - companion.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  return distance < threshold;
}


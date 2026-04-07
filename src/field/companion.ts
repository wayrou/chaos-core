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
  lastPlayerX?: number;
  lastPlayerY?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COMPANION_SPEED = 240; // pixels per second (matches base player pace before dynamic syncing)
const COMPANION_ATTACK_SPEED = 500; // pixels per second when attacking
const COMPANION_WIDTH = 28;
const COMPANION_HEIGHT = 28;
const FOLLOW_RADIUS = 16; // Distance to maintain from the trailing slot behind the player
const COMFORT_RADIUS = 10; // Distance where Sable idles in the trailing slot
const FOLLOW_TRAIL_DISTANCE = 42;
const FOLLOW_CATCHUP_RADIUS = 72;
const FOLLOW_TELEPORT_RADIUS = 260;
const FOLLOW_CATCHUP_BONUS = 60;
const FETCH_RADIUS = 150; // Radius to search for resources
const ATTACK_RADIUS = 200; // Radius to search for enemies
const BEHAVIOR_COOLDOWN = 500; // ms between behavior checks

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
  return updateCompanionFollow(companion, player, deltaTime, map);
}

// ============================================================================
// FOLLOW BEHAVIOR
// ============================================================================

function getCompanionFollowTarget(player: PlayerAvatar): { x: number; y: number } {
  switch (player.facing) {
    case "north":
      return { x: player.x, y: player.y + FOLLOW_TRAIL_DISTANCE };
    case "south":
      return { x: player.x, y: player.y - FOLLOW_TRAIL_DISTANCE };
    case "east":
      return { x: player.x - FOLLOW_TRAIL_DISTANCE, y: player.y };
    case "west":
      return { x: player.x + FOLLOW_TRAIL_DISTANCE, y: player.y };
    default:
      return { x: player.x, y: player.y + FOLLOW_TRAIL_DISTANCE };
  }
}

function getCompanionFollowSpeed(companion: Companion, player: PlayerAvatar, deltaTime: number, distance: number): number {
  const playerTravelDistance =
    companion.lastPlayerX !== undefined && companion.lastPlayerY !== undefined
      ? Math.hypot(player.x - companion.lastPlayerX, player.y - companion.lastPlayerY)
      : 0;
  const livePlayerSpeed = deltaTime > 0 ? playerTravelDistance / (deltaTime / 1000) : player.speed;
  const baseFollowSpeed = Math.max(player.speed, livePlayerSpeed);
  return distance > FOLLOW_CATCHUP_RADIUS ? baseFollowSpeed + FOLLOW_CATCHUP_BONUS : baseFollowSpeed;
}

function tryMoveCompanion(
  companion: Companion,
  targetX: number,
  targetY: number,
  map: FieldMap,
): void {
  const tileSize = 64;
  const tileX = Math.floor(targetX / tileSize);
  const tileY = Math.floor(targetY / tileSize);

  if (tileX >= 0 && tileX < map.width && tileY >= 0 && tileY < map.height && map.tiles[tileY][tileX]?.walkable) {
    companion.x = targetX;
    companion.y = targetY;
  }
}

export function updateCompanionFollow(
  companion: Companion,
  player: PlayerAvatar,
  deltaTime: number,
  map: FieldMap
): Companion {
  const followTarget = getCompanionFollowTarget(player);
  const dx = followTarget.x - companion.x;
  const dy = followTarget.y - companion.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const playerDx =
    companion.lastPlayerX !== undefined && companion.lastPlayerY !== undefined
      ? player.x - companion.lastPlayerX
      : 0;
  const playerDy =
    companion.lastPlayerX !== undefined && companion.lastPlayerY !== undefined
      ? player.y - companion.lastPlayerY
      : 0;
  const playerMovedDistance = Math.hypot(playerDx, playerDy);
  
  // Determine state based on distance
  let newState: "idle" | "follow" = companion.state === "idle" ? "idle" : "follow";
  if (distance > FOLLOW_RADIUS) {
    newState = "follow";
  } else if (distance < COMFORT_RADIUS) {
    newState = "idle";
  } else {
    newState = "follow";
  }
  
  // Move toward player if too far
  if (distance > FOLLOW_TELEPORT_RADIUS) {
    tryMoveCompanion(companion, followTarget.x, followTarget.y, map);
  } else if (distance > FOLLOW_RADIUS) {
    const followSpeed = getCompanionFollowSpeed(companion, player, deltaTime, distance);
    const moveDistance = Math.min(distance, followSpeed * (deltaTime / 1000));
    const moveX = (dx / distance) * moveDistance;
    const moveY = (dy / distance) * moveDistance;
    const newX = companion.x + moveX;
    const newY = companion.y + moveY;

    tryMoveCompanion(companion, newX, newY, map);

    // Update facing
    if (playerMovedDistance > 1) {
      if (Math.abs(playerDx) > Math.abs(playerDy)) {
        companion.facing = playerDx > 0 ? "east" : "west";
      } else {
        companion.facing = playerDy > 0 ? "south" : "north";
      }
    } else if (Math.abs(dx) > Math.abs(dy)) {
      companion.facing = dx > 0 ? "east" : "west";
    } else {
      companion.facing = dy > 0 ? "south" : "north";
    }
  }
  
  return {
    ...companion,
    speed: player.speed,
    state: newState,
    lastPlayerX: player.x,
    lastPlayerY: player.y,
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
  _player: PlayerAvatar,
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
  _player: PlayerAvatar,
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
  _player: PlayerAvatar,
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
  _player: PlayerAvatar,
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

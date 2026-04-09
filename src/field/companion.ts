// ============================================================================
// FIELD SYSTEM - COMPANION (SABLE)
// Headline 15a: Dog companion that follows, fetches resources, attacks enemies
// ============================================================================

import { isOuterDeckAccessibleMap } from "../core/outerDecks";
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

const COMPANION_WIDTH = 28;
const COMPANION_HEIGHT = 28;
const DEFAULT_COMPANION_SPEED = 240;

type CompanionTuning = {
  baseSpeed: number;
  attackSpeed: number;
  fetchSpeedMultiplier: number;
  fetchMinSpeed: number;
  followRadius: number;
  comfortRadius: number;
  followTrailDistance: number;
  followCatchupRadius: number;
  followTeleportRadius: number;
  followCatchupBonus: number;
  fetchRadius: number;
  attackRadius: number;
  behaviorCooldownMs: number;
};

const DEFAULT_COMPANION_TUNING: CompanionTuning = {
  baseSpeed: DEFAULT_COMPANION_SPEED,
  attackSpeed: 500,
  fetchSpeedMultiplier: 1.5,
  fetchMinSpeed: 320,
  followRadius: 16,
  comfortRadius: 10,
  followTrailDistance: 42,
  followCatchupRadius: 72,
  followTeleportRadius: 260,
  followCatchupBonus: 60,
  fetchRadius: 150,
  attackRadius: 200,
  behaviorCooldownMs: 500,
};

const OUTER_DECK_COMPANION_TUNING: CompanionTuning = {
  baseSpeed: 300,
  attackSpeed: 700,
  fetchSpeedMultiplier: 2,
  fetchMinSpeed: 460,
  followRadius: 38,
  comfortRadius: 20,
  followTrailDistance: 82,
  followCatchupRadius: 170,
  followTeleportRadius: 640,
  followCatchupBonus: 180,
  fetchRadius: 420,
  attackRadius: 460,
  behaviorCooldownMs: 260,
};

function getCompanionTuning(map: FieldMap): CompanionTuning {
  return isOuterDeckAccessibleMap(map.id) ? OUTER_DECK_COMPANION_TUNING : DEFAULT_COMPANION_TUNING;
}

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
    speed: DEFAULT_COMPANION_SPEED,
    state: "follow",
    behaviorCooldownMs: DEFAULT_COMPANION_TUNING.behaviorCooldownMs,
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

function getCompanionFollowTarget(player: PlayerAvatar, map: FieldMap): { x: number; y: number } {
  const tuning = getCompanionTuning(map);
  switch (player.facing) {
    case "north":
      return { x: player.x, y: player.y + tuning.followTrailDistance };
    case "south":
      return { x: player.x, y: player.y - tuning.followTrailDistance };
    case "east":
      return { x: player.x - tuning.followTrailDistance, y: player.y };
    case "west":
      return { x: player.x + tuning.followTrailDistance, y: player.y };
    default:
      return { x: player.x, y: player.y + tuning.followTrailDistance };
  }
}

function getCompanionFollowSpeed(companion: Companion, player: PlayerAvatar, deltaTime: number, distance: number, map: FieldMap): number {
  const tuning = getCompanionTuning(map);
  const playerTravelDistance =
    companion.lastPlayerX !== undefined && companion.lastPlayerY !== undefined
      ? Math.hypot(player.x - companion.lastPlayerX, player.y - companion.lastPlayerY)
      : 0;
  const livePlayerSpeed = deltaTime > 0 ? playerTravelDistance / (deltaTime / 1000) : player.speed;
  const baseFollowSpeed = Math.max(player.speed, livePlayerSpeed, tuning.baseSpeed);
  return distance > tuning.followCatchupRadius ? baseFollowSpeed + tuning.followCatchupBonus : baseFollowSpeed;
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
  const tuning = getCompanionTuning(map);
  const followTarget = getCompanionFollowTarget(player, map);
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
  if (distance > tuning.followRadius) {
    newState = "follow";
  } else if (distance < tuning.comfortRadius) {
    newState = "idle";
  } else {
    newState = "follow";
  }
  
  // Move toward player if too far
  if (distance > tuning.followTeleportRadius) {
    tryMoveCompanion(companion, followTarget.x, followTarget.y, map);
  } else if (distance > tuning.followRadius) {
    const followSpeed = getCompanionFollowSpeed(companion, player, deltaTime, distance, map);
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
    speed: Math.max(player.speed, tuning.baseSpeed),
    behaviorCooldownMs: tuning.behaviorCooldownMs,
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
  const tuning = getCompanionTuning(map);
  if (!target) {
    // No target, return to follow
    return {
      ...companion,
      behaviorCooldownMs: tuning.behaviorCooldownMs,
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
  const moveDistance = Math.max(companion.speed * tuning.fetchSpeedMultiplier, tuning.fetchMinSpeed) * (deltaTime / 1000);
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
    speed: Math.max(companion.speed, tuning.baseSpeed),
    behaviorCooldownMs: tuning.behaviorCooldownMs,
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
  const tuning = getCompanionTuning(map);
  if (!target) {
    // No target, return to follow
    return {
      ...companion,
      behaviorCooldownMs: tuning.behaviorCooldownMs,
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
  const moveDistance = tuning.attackSpeed * (deltaTime / 1000);
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
    speed: Math.max(companion.speed, tuning.baseSpeed),
    behaviorCooldownMs: tuning.behaviorCooldownMs,
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
  sparkles: ResourceSparkle[],
  map: FieldMap,
): FetchTarget | null {
  const searchRadius = getCompanionTuning(map).fetchRadius;
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
  enemies: LightEnemy[],
  map: FieldMap,
): AttackTarget | null {
  const searchRadius = getCompanionTuning(map).attackRadius;
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

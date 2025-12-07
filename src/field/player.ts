// ============================================================================
// FIELD SYSTEM - PLAYER AVATAR & MOVEMENT
// ============================================================================

import { PlayerAvatar, FieldMap } from "./types";

// ============================================================================
// MOVEMENT & COLLISION
// ============================================================================

const PLAYER_SPEED = 120; // pixels per second
const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 32;

export function createPlayerAvatar(startX: number, startY: number): PlayerAvatar {
  return {
    x: startX,
    y: startY,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    speed: PLAYER_SPEED,
    facing: "south",
  };
}

export interface MovementInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  dash: boolean;
}

/**
 * Update player position based on input and collision
 */
export function updatePlayerMovement(
  player: PlayerAvatar,
  input: MovementInput,
  map: FieldMap,
  deltaTime: number
): PlayerAvatar {
  let newX = player.x;
  let newY = player.y;
  let newFacing = player.facing;
  
  // Dash multiplier (2x speed when dashing)
  const dashMultiplier = input.dash ? 2.0 : 1.0;
  const moveDistance = player.speed * dashMultiplier * (deltaTime / 1000);
  
  // Calculate desired movement
  if (input.up) {
    newY -= moveDistance;
    newFacing = "north";
  }
  if (input.down) {
    newY += moveDistance;
    newFacing = "south";
  }
  if (input.left) {
    newX -= moveDistance;
    newFacing = "west";
  }
  if (input.right) {
    newX += moveDistance;
    newFacing = "east";
  }
  
  // AABB collision detection
  const playerBounds = {
    left: newX - player.width / 2,
    right: newX + player.width / 2,
    top: newY - player.height / 2,
    bottom: newY + player.height / 2,
  };
  
  // Check collision with map boundaries and non-walkable tiles
  const tileSize = 64; // Assuming 64px tiles
  
  const minTileX = Math.floor(playerBounds.left / tileSize);
  const maxTileX = Math.floor(playerBounds.right / tileSize);
  const minTileY = Math.floor(playerBounds.top / tileSize);
  const maxTileY = Math.floor(playerBounds.bottom / tileSize);
  
  let canMoveX = true;
  let canMoveY = true;
  
  // Check X movement
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    if (ty < 0 || ty >= map.height) {
      canMoveX = false;
      break;
    }
    const checkX = input.left ? minTileX : maxTileX;
    if (checkX < 0 || checkX >= map.width) {
      canMoveX = false;
      break;
    }
    if (!map.tiles[ty][checkX]?.walkable) {
      canMoveX = false;
      break;
    }
  }
  
  // Check Y movement
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    if (tx < 0 || tx >= map.width) {
      canMoveY = false;
      break;
    }
    const checkY = input.up ? minTileY : maxTileY;
    if (checkY < 0 || checkY >= map.height) {
      canMoveY = false;
      break;
    }
    if (!map.tiles[checkY][tx]?.walkable) {
      canMoveY = false;
      break;
    }
  }
  
  // Apply movement only if no collision
  if (!canMoveX) {
    newX = player.x;
  }
  if (!canMoveY) {
    newY = player.y;
  }
  
  // Clamp to map bounds
  const mapPixelWidth = map.width * tileSize;
  const mapPixelHeight = map.height * tileSize;
  newX = Math.max(player.width / 2, Math.min(mapPixelWidth - player.width / 2, newX));
  newY = Math.max(player.height / 2, Math.min(mapPixelHeight - player.height / 2, newY));
  
  return {
    ...player,
    x: newX,
    y: newY,
    facing: newFacing,
  };
}

/**
 * Check if player is overlapping an interaction zone
 */
export function getOverlappingInteractionZone(
  player: PlayerAvatar,
  map: FieldMap
): string | null {
  const tileSize = 64;
  const playerTileX = Math.floor(player.x / tileSize);
  const playerTileY = Math.floor(player.y / tileSize);
  
  for (const zone of map.interactionZones) {
    if (
      playerTileX >= zone.x &&
      playerTileX < zone.x + zone.width &&
      playerTileY >= zone.y &&
      playerTileY < zone.y + zone.height
    ) {
      return zone.id;
    }
  }
  
  return null;
}


// ============================================================================
// LINE OF SIGHT - Cover blocking for ranged attacks
// ============================================================================

import { Tile, Vec2, BattleState } from "./battle";

/**
 * Check if there is line of sight between two cells
 * Returns true if LoS is clear, false if blocked by cover
 */
export function hasLineOfSight(
  from: Vec2,
  to: Vec2,
  battle: BattleState
): boolean {
  // Get all tiles along the line using Bresenham's line algorithm
  const lineTiles = getLineTiles(from, to);
  
  // Check each tile in the line (excluding start and end)
  for (let i = 1; i < lineTiles.length - 1; i++) {
    const tile = lineTiles[i];
    const gridTile = getTileAt(battle, tile.x, tile.y);
    
    if (!gridTile) continue;
    
    // Cover blocks line of sight
    if (gridTile.terrain === "light_cover" || gridTile.terrain === "heavy_cover") {
      if (gridTile.cover && gridTile.cover.hp > 0) {
        return false; // Blocked by cover
      }
    }
    
    // Walls also block (if they exist)
    if (gridTile.terrain === "wall") {
      return false;
    }
  }
  
  return true; // Clear line of sight
}

/**
 * Get all tiles along a line using Bresenham's line algorithm
 */
function getLineTiles(from: Vec2, to: Vec2): Vec2[] {
  const tiles: Vec2[] = [];
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = dx - dy;
  
  let x = from.x;
  let y = from.y;
  
  while (true) {
    tiles.push({ x, y });
    
    if (x === to.x && y === to.y) {
      break;
    }
    
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  
  return tiles;
}

/**
 * Get tile at a specific position
 */
function getTileAt(battle: BattleState, x: number, y: number): Tile | null {
  if (x < 0 || x >= battle.gridWidth || y < 0 || y >= battle.gridHeight) {
    return null;
  }
  
  const index = y * battle.gridWidth + x;
  return battle.tiles[index] || null;
}

/**
 * Get the first cover tile hit along a line of sight
 * Returns null if no cover is hit
 */
export function getFirstCoverInLine(
  from: Vec2,
  to: Vec2,
  battle: BattleState
): { tile: Tile; position: Vec2 } | null {
  const lineTiles = getLineTiles(from, to);
  
  // Check each tile in the line (excluding start)
  for (let i = 1; i < lineTiles.length; i++) {
    const tile = lineTiles[i];
    const gridTile = getTileAt(battle, tile.x, tile.y);
    
    if (!gridTile) continue;
    
    // Check if this is cover with HP
    if (gridTile.terrain === "light_cover" || gridTile.terrain === "heavy_cover") {
      if (gridTile.cover && gridTile.cover.hp > 0) {
        return { tile: gridTile, position: tile };
      }
    }
  }
  
  return null;
}


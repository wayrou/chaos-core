// ============================================================================
// ISOMETRIC PROJECTION UTILITIES
// For Final Fantasy Tactics Advance-style 45° isometric rendering
// ============================================================================

/**
 * Isometric projection constants
 * Based on FFTA-style diamond tiles
 */
export const ISO_TILE_WIDTH = 64;  // Base tile width in pixels (diamond diagonal)
export const ISO_TILE_HEIGHT = 32; // Base tile height in pixels (diamond vertical)
export const ISO_ELEVATION_STEP = 16; // Pixels per elevation level

/**
 * Project isometric grid coordinates to screen coordinates
 * @param x Grid X coordinate
 * @param y Grid Y coordinate
 * @param height Elevation level (0 = ground, 1+ = raised)
 * @returns Screen position {screenX, screenY}
 */
export function isoProject(x: number, y: number, height: number = 0): { screenX: number; screenY: number } {
  // Standard isometric projection formula
  const isoX = (x - y) * (ISO_TILE_WIDTH / 2);
  const isoY = (x + y) * (ISO_TILE_HEIGHT / 2) - (height * ISO_ELEVATION_STEP);
  
  return { screenX: isoX, screenY: isoY };
}

/**
 * Reverse project screen coordinates to isometric grid coordinates
 * @param screenX Screen X coordinate
 * @param screenY Screen Y coordinate
 * @returns Grid position {x, y} or null if outside bounds
 */
export function isoUnproject(screenX: number, screenY: number): { x: number; y: number } | null {
  // Reverse isometric projection
  const x = (screenX / (ISO_TILE_WIDTH / 2) + screenY / (ISO_TILE_HEIGHT / 2)) / 2;
  const y = (screenY / (ISO_TILE_HEIGHT / 2) - screenX / (ISO_TILE_WIDTH / 2)) / 2;
  
  // Round to nearest integer grid position
  const gridX = Math.round(x);
  const gridY = Math.round(y);
  
  return { x: gridX, y: gridY };
}

/**
 * Get the screen bounds of an isometric tile
 * @param x Grid X coordinate
 * @param y Grid Y coordinate
 * @param height Elevation level
 * @returns Bounding box {left, top, right, bottom, width, height}
 */
export function getIsoTileBounds(x: number, y: number, height: number = 0): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
} {
  const center = isoProject(x, y, height);
  
  return {
    left: center.screenX - ISO_TILE_WIDTH / 2,
    top: center.screenY - ISO_TILE_HEIGHT / 2,
    right: center.screenX + ISO_TILE_WIDTH / 2,
    bottom: center.screenY + ISO_TILE_HEIGHT / 2,
    width: ISO_TILE_WIDTH,
    height: ISO_TILE_HEIGHT,
  };
}

/**
 * Calculate draw order for back-to-front rendering
 * Higher values = render later (in front)
 * @param x Grid X coordinate
 * @param y Grid Y coordinate
 * @param height Elevation level
 * @returns Draw order value
 */
export function getIsoDrawOrder(x: number, y: number, height: number = 0): number {
  // Sort by: x + y (back to front), then by height (higher tiles in front)
  return (x + y) * 1000 + height * 100;
}

/**
 * Generate a simple noise-based elevation map
 * @param width Grid width
 * @param height Grid height
 * @param maxElevation Maximum elevation level
 * @param seed Random seed for reproducibility
 * @returns 2D array of elevation values [x][y]
 */
export function generateElevationMap(
  width: number,
  height: number,
  maxElevation: number = 3,
  seed?: number
): number[][] {
  const elevations: number[][] = [];
  
  // Simple seeded random function
  let rng = seed ?? Math.floor(Math.random() * 1000000);
  function random() {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  }
  
  // Initialize with random values
  for (let x = 0; x < width; x++) {
    elevations[x] = [];
    for (let y = 0; y < height; y++) {
      elevations[x][y] = Math.floor(random() * (maxElevation + 1));
    }
  }
  
  // Smooth the elevation map (simple blur)
  const smoothed: number[][] = [];
  for (let x = 0; x < width; x++) {
    smoothed[x] = [];
    for (let y = 0; y < height; y++) {
      let sum = elevations[x][y];
      let count = 1;
      
      // Average with neighbors
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            sum += elevations[nx][ny];
            count++;
          }
        }
      }
      
      smoothed[x][y] = Math.round(sum / count);
    }
  }
  
  return smoothed;
}

/**
 * Validate that all tiles are reachable (BFS connectivity check)
 * @param elevations 2D elevation map
 * @param startX Starting X
 * @param startY Starting Y
 * @param maxHeightDiff Maximum height difference that can be traversed
 * @returns true if all tiles are reachable
 */
export function validateReachability(
  elevations: number[][],
  startX: number,
  startY: number,
  maxHeightDiff: number = 1
): boolean {
  const width = elevations.length;
  const height = elevations[0]?.length ?? 0;
  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  visited.add(`${startX},${startY}`);
  
  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    
    // Check all 4 neighbors
    const neighbors = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];
    
    for (const n of neighbors) {
      if (n.x < 0 || n.x >= width || n.y < 0 || n.y >= height) continue;
      
      const key = `${n.x},${n.y}`;
      if (visited.has(key)) continue;
      
      const heightDiff = Math.abs(elevations[n.x][n.y] - elevations[x][y]);
      if (heightDiff <= maxHeightDiff) {
        visited.add(key);
        queue.push(n);
      }
    }
  }
  
  // Check if we visited all tiles
  return visited.size === width * height;
}


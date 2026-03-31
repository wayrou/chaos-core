// ============================================================================
// FIELD SYSTEM - SPAWN RESOLVER
// ============================================================================
// Centralized spawn position resolver to prevent spawning in impassable tiles
// CURSOR_PROOF_FCP_SPAWN_FIX

import { FieldMap, InteractionZone } from "./types";

export type SpawnSource = "normal" | "FCP";

export interface SpawnResult {
  x: number;
  y: number;
  tileX: number;
  tileY: number;
  passable: boolean;
  usedFallback: boolean;
  entryZoneUsed?: string;
  candidatesScanned: number;
  requestedTileX: number;
  requestedTileY: number;
}

/**
 * Get entry zone candidates for a map
 * Returns list of entry zone center positions (in tile coordinates)
 * Only returns zones that have at least one walkable tile within them
 */
function getEntryZoneCandidates(map: FieldMap, context: SpawnSource): { x: number; y: number; zoneId: string }[] {
  const candidates: { x: number; y: number; zoneId: string }[] = [];
  
  for (const zone of map.interactionZones) {
    // For FCP entry, prefer exit/entry zones
    if (context === "FCP") {
      if (zone.action === "base_camp_entry" || 
          zone.action === "free_zone_entry" ||
          zone.id.includes("exit") ||
          zone.id.includes("entry")) {
        // Find a walkable tile within the zone
        const walkableTile = findWalkableTileInZone(map, zone);
        if (walkableTile) {
          candidates.push({ x: walkableTile.x, y: walkableTile.y, zoneId: zone.id });
        }
      }
    } else {
      // For normal entry, accept any interaction zone as potential spawn point
      const walkableTile = findWalkableTileInZone(map, zone);
      if (walkableTile) {
        candidates.push({ x: walkableTile.x, y: walkableTile.y, zoneId: zone.id });
      }
    }
  }
  
  return candidates;
}

/**
 * Find a walkable tile within an interaction zone
 * Returns the center of the zone if walkable, otherwise searches for nearest walkable tile
 */
function findWalkableTileInZone(map: FieldMap, zone: InteractionZone): { x: number; y: number } | null {
  // Try center first
  const centerX = zone.x + Math.floor(zone.width / 2);
  const centerY = zone.y + Math.floor(zone.height / 2);
  
  if (isTilePassable(map, centerX, centerY)) {
    return { x: centerX, y: centerY };
  }
  
  // Search within zone bounds for any walkable tile
  for (let y = zone.y; y < zone.y + zone.height; y++) {
    for (let x = zone.x; x < zone.x + zone.width; x++) {
      if (isTilePassable(map, x, y)) {
        return { x, y };
      }
    }
  }
  
  // If no walkable tile found in zone, try nearest walkable tile to zone center
  const nearest = findNearestValidTile(map, centerX, centerY, 5);
  if (nearest) {
    return { x: nearest.tileX, y: nearest.tileY };
  }
  
  return null;
}

/**
 * Check if a tile is passable (walkable and within bounds)
 * Uses the same validation as movement/pathfinding
 * Explicitly checks for edge walls (right wall = width - 1, bottom wall = height - 1)
 */
function isTilePassable(map: FieldMap, tileX: number, tileY: number): boolean {
  // Check bounds (explicitly reject edge tiles which are typically walls)
  if (tileX < 0 || tileX >= map.width || tileY < 0 || tileY >= map.height) {
    return false;
  }
  
  // Explicit check for right wall (x = width - 1) and bottom wall (y = height - 1)
  // These are almost always impassable walls
  if (tileX === map.width - 1 || tileY === map.height - 1) {
    // Still check the tile data, but log if it's marked as walkable (data inconsistency)
    const tile = map.tiles[tileY]?.[tileX];
    if (tile?.walkable) {
      console.warn(`[SPAWN] Edge tile (${tileX}, ${tileY}) marked as walkable - this may be a data issue`);
    }
    return false;
  }
  
  // Check walkability
  const tile = map.tiles[tileY]?.[tileX];
  if (!tile || !tile.walkable) {
    return false;
  }
  
  return true;
}

/**
 * BFS search for nearest valid spawn tile
 * Returns tile coordinates of nearest passable tile, or null if none found
 * Also returns the number of candidates scanned
 */
function findNearestValidTile(
  map: FieldMap,
  startTileX: number,
  startTileY: number,
  maxRadius: number = 20
): { tileX: number; tileY: number; distance: number; candidatesScanned: number } | null {
  // If starting tile is valid, return it
  if (isTilePassable(map, startTileX, startTileY)) {
    return { tileX: startTileX, tileY: startTileY, distance: 0, candidatesScanned: 1 };
  }
  
  // BFS search expanding outward
  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number; distance: number }> = [
    { x: startTileX, y: startTileY, distance: 0 }
  ];
  visited.add(`${startTileX},${startTileY}`);
  let candidatesScanned = 1; // Count the starting tile
  
  const directions = [
    { dx: 0, dy: -1 }, // north
    { dx: 1, dy: 0 },  // east
    { dx: 0, dy: 1 },  // south
    { dx: -1, dy: 0 }, // west
    { dx: 1, dy: -1 }, // northeast
    { dx: 1, dy: 1 },  // southeast
    { dx: -1, dy: 1 }, // southwest
    { dx: -1, dy: -1 }, // northwest
  ];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current.distance > maxRadius) {
      continue;
    }
    
    // Check all 8 directions
    for (const dir of directions) {
      const nextX = current.x + dir.dx;
      const nextY = current.y + dir.dy;
      const key = `${nextX},${nextY}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      candidatesScanned++;
      
      if (isTilePassable(map, nextX, nextY)) {
        return { tileX: nextX, tileY: nextY, distance: current.distance + 1, candidatesScanned };
      }
      
      // Add to queue for further exploration
      queue.push({ x: nextX, y: nextY, distance: current.distance + 1 });
    }
  }
  
  return null;
}

/**
 * Find a safe fallback spawn position
 * Searches the entire map for any valid spawn point
 * Avoids edge tiles (x=0, x=width-1, y=0, y=height-1) which are typically walls
 */
function findFallbackSpawn(map: FieldMap): { tileX: number; tileY: number } | null {
  // Search from center outward, but avoid edges
  // Ensure we're at least 1 tile away from all edges
  const minX = 1;
  const maxX = map.width - 2;
  const minY = 1;
  const maxY = map.height - 2;
  
  // Validate bounds
  if (minX >= maxX || minY >= maxY) {
    // Map too small, search all tiles
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (isTilePassable(map, x, y)) {
          return { tileX: x, tileY: y };
        }
      }
    }
    return null;
  }
  
  const centerX = Math.floor((minX + maxX) / 2);
  const centerY = Math.floor((minY + maxY) / 2);
  
  // Try center first
  if (isTilePassable(map, centerX, centerY)) {
    return { tileX: centerX, tileY: centerY };
  }
  
  // Search in expanding spiral, staying within safe bounds
  const maxRadius = Math.max(maxX - minX, maxY - minY);
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
          const x = centerX + dx;
          const y = centerY + dy;
          // Ensure within safe bounds
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            if (isTilePassable(map, x, y)) {
              return { tileX: x, tileY: y };
            }
          }
        }
      }
    }
  }
  
  // Last resort: search all non-edge tiles
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (isTilePassable(map, x, y)) {
        return { tileX: x, tileY: y };
      }
    }
  }
  
  return null;
}

/**
 * Resolve player spawn position
 * 
 * @param spawnSource - "normal" or "FCP" (Forward Command Post / key room)
 * @param map - The field map
 * @param requestedPos - Requested spawn position in pixel coordinates
 * @param preferredZoneIds - Optional list of preferred entry zone IDs
 */
export function resolvePlayerSpawn(
  spawnSource: SpawnSource,
  map: FieldMap,
  requestedPos: { x: number; y: number },
  preferredZoneIds?: string[]
): SpawnResult {
  const tileSize = 64;
  const requestedTileX = Math.floor(requestedPos.x / tileSize);
  const requestedTileY = Math.floor(requestedPos.y / tileSize);
  
  // Log initial spawn request
  console.log(`[SPAWN] Source: ${spawnSource}, Requested: (${requestedTileX}, ${requestedTileY})`);
  
  let resolvedTileX = requestedTileX;
  let resolvedTileY = requestedTileY;
  let usedFallback = false;
  let entryZoneUsed: string | undefined;
  let candidatesScanned = 0;
  
  // For FCP entry, spawn near exit/entry nodes so player can leave easily
  if (spawnSource === "FCP") {
    // CURSOR_PROOF_FCP_SPAWN_FIX: First try to spawn near exit/entry zones
    const entryCandidates = getEntryZoneCandidates(map, "FCP");
    console.log(`[SPAWN] [CURSOR_PROOF_FCP_SPAWN_FIX] FCP spawn detected, searching for exit/entry zones...`);
    console.log(`[SPAWN] [CURSOR_PROOF_FCP_SPAWN_FIX] Found ${entryCandidates.length} exit/entry zone candidates`);
    if (entryCandidates.length > 0) {
      // Use the first exit/entry zone found (prefer exit zones)
      const preferredCandidate = entryCandidates.find(c => c.zoneId.includes("exit")) || entryCandidates[0];
      resolvedTileX = preferredCandidate.x;
      resolvedTileY = preferredCandidate.y;
      entryZoneUsed = preferredCandidate.zoneId;
      
      console.log(`[SPAWN] FCP spawn near exit/entry zone: (${resolvedTileX}, ${resolvedTileY}) from zone ${entryZoneUsed} [CURSOR_PROOF_FCP_SPAWN_FIX]`);
      
      // Validate the position - if it's not passable, find nearest valid tile
      if (!isTilePassable(map, resolvedTileX, resolvedTileY)) {
        console.warn(`[SPAWN] [CURSOR_PROOF_FCP_SPAWN_FIX] Entry zone position (${resolvedTileX}, ${resolvedTileY}) not passable, finding nearest valid tile...`);
        const nearest = findNearestValidTile(map, resolvedTileX, resolvedTileY, 10);
        if (nearest) {
          resolvedTileX = nearest.tileX;
          resolvedTileY = nearest.tileY;
          candidatesScanned = nearest.candidatesScanned;
          console.log(`[SPAWN] [CURSOR_PROOF_FCP_SPAWN_FIX] Found valid spawn near exit at (${resolvedTileX}, ${resolvedTileY})`);
        }
      }
    } else {
      // Fallback: Use safe center-left position if no exit/entry zones found
      console.warn(`[SPAWN] [CURSOR_PROOF_FCP_SPAWN_FIX] No exit/entry zones found, using safe fallback position`);
      const safeTileX = Math.max(2, Math.min(Math.floor(map.width * 0.25), map.width - 3));
      const safeTileY = Math.max(2, Math.min(Math.floor(map.height * 0.5), map.height - 3));
      
      resolvedTileX = safeTileX;
      resolvedTileY = safeTileY;
      
      console.log(`[SPAWN] FCP safe spawn requested: (${resolvedTileX}, ${resolvedTileY}) [CURSOR_PROOF_FCP_SPAWN_FIX]`);
      
      // Validate the safe position - if it's not passable, find nearest valid tile
      if (!isTilePassable(map, resolvedTileX, resolvedTileY)) {
        console.warn(`[SPAWN] [CURSOR_PROOF_FCP_SPAWN_FIX] Safe position (${resolvedTileX}, ${resolvedTileY}) not passable, finding nearest valid tile...`);
        const nearest = findNearestValidTile(map, resolvedTileX, resolvedTileY, 20);
        if (nearest) {
          resolvedTileX = nearest.tileX;
          resolvedTileY = nearest.tileY;
          candidatesScanned = nearest.candidatesScanned;
          console.log(`[SPAWN] [CURSOR_PROOF_FCP_SPAWN_FIX] Found valid spawn at (${resolvedTileX}, ${resolvedTileY})`);
        }
      }
    }
  }
  // Validate and resolve spawn position
  if (!isTilePassable(map, resolvedTileX, resolvedTileY)) {
    console.warn(`[SPAWN] Requested spawn (${resolvedTileX}, ${resolvedTileY}) is not passable, searching for nearest valid tile...`);
    console.log(`[SPAWN] Map size: ${map.width}x${map.height}, Tile at (${resolvedTileX}, ${resolvedTileY}): ${map.tiles[resolvedTileY]?.[resolvedTileX]?.walkable ? 'walkable' : 'blocked'}`);
    
    const nearest = findNearestValidTile(map, resolvedTileX, resolvedTileY, 20);
    
    if (nearest) {
      resolvedTileX = nearest.tileX;
      resolvedTileY = nearest.tileY;
      candidatesScanned = nearest.candidatesScanned;
      console.log(`[SPAWN] Found nearest valid tile at (${resolvedTileX}, ${resolvedTileY}) after ${nearest.distance} steps, scanned ${candidatesScanned} candidates`);
    } else {
      // Last resort: search entire map
      console.warn(`[SPAWN] No valid tile found within radius, using fallback search...`);
      const fallback = findFallbackSpawn(map);
      
      if (fallback) {
        resolvedTileX = fallback.tileX;
        resolvedTileY = fallback.tileY;
        usedFallback = true;
        // Estimate candidates scanned for fallback (searches entire map)
        candidatesScanned = map.width * map.height;
        console.log(`[SPAWN] Fallback spawn found at (${resolvedTileX}, ${resolvedTileY})`);
      } else {
        // This should never happen, but if it does, use center and log error
        console.error(`[SPAWN] CRITICAL: No valid spawn tile found in entire map! Using safe center as last resort.`);
        // Avoid edge tiles (typically walls) - explicitly avoid right wall (width - 1)
        resolvedTileX = Math.max(1, Math.min(map.width - 2, Math.floor(map.width / 2)));
        resolvedTileY = Math.max(1, Math.min(map.height - 2, Math.floor(map.height / 2)));
        usedFallback = true;
        candidatesScanned = map.width * map.height; // Searched entire map
      }
    }
  } else {
    // Spawn is valid, no search needed
    candidatesScanned = 1;
  }
  
  // Final validation
  const passable = isTilePassable(map, resolvedTileX, resolvedTileY);
  
  // Convert to pixel coordinates (center of tile)
  const pixelX = resolvedTileX * tileSize + tileSize / 2;
  const pixelY = resolvedTileY * tileSize + tileSize / 2;
  
  // Log final result with detailed info
  console.log(`[SPAWN] Resolved: (${resolvedTileX}, ${resolvedTileY}) -> (${pixelX}, ${pixelY}), Passable: ${passable}, Fallback: ${usedFallback}`);
  console.log(`[SPAWN] Map bounds: 0-${map.width - 1} x 0-${map.height - 1}, Resolved tile flags: walkable=${map.tiles[resolvedTileY]?.[resolvedTileX]?.walkable}, type=${map.tiles[resolvedTileY]?.[resolvedTileX]?.type}`);
  
  // Critical validation: ensure we're not on right wall
  if (resolvedTileX === map.width - 1) {
    console.error(`[SPAWN] CRITICAL ERROR: Resolved spawn is on right wall (x=${resolvedTileX})! This should never happen.`);
  }
  
  return {
    x: pixelX,
    y: pixelY,
    tileX: resolvedTileX,
    tileY: resolvedTileY,
    passable,
    usedFallback,
    entryZoneUsed,
    candidatesScanned,
    requestedTileX,
    requestedTileY,
  };
}



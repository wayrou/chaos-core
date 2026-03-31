// ============================================================================
// COVER GENERATOR - Deterministic cover placement for tactical battles
// ============================================================================

import { Tile, Vec2 } from "./battle";

// ----------------------------------------------------------------------------
// COVER STATS
// ----------------------------------------------------------------------------

export const COVER_STATS = {
  light_cover: {
    minHp: 3,
    maxHp: 5,
    damageReduction: 1,
  },
  heavy_cover: {
    minHp: 7,
    maxHp: 10,
    damageReduction: 2,
  },
} as const;

// ----------------------------------------------------------------------------
// COVER PROFILES
// ----------------------------------------------------------------------------

export type CoverProfile = "none" | "light" | "mixed";

export interface CoverProfileConfig {
  profile: CoverProfile;
  lightCoverPercent: number; // 0-100
  heavyCoverPercent: number; // 0-100
}

// Profile probabilities (tunable)
const PROFILE_PROBABILITIES: Record<CoverProfile, number> = {
  none: 0.25,  // 25% no cover
  light: 0.45, // 45% light only
  mixed: 0.30, // 30% mixed
};

// Profile configurations
const PROFILE_CONFIGS: Record<CoverProfile, CoverProfileConfig> = {
  none: {
    profile: "none",
    lightCoverPercent: 0,
    heavyCoverPercent: 0,
  },
  light: {
    profile: "light",
    lightCoverPercent: 8, // 6-12% average
    heavyCoverPercent: 0,
  },
  mixed: {
    profile: "mixed",
    lightCoverPercent: 6, // 4-8% average
    heavyCoverPercent: 3, // 2-4% average
  },
};

// ----------------------------------------------------------------------------
// DETERMINISTIC RNG
// ----------------------------------------------------------------------------

interface SeededRNG {
  nextInt(min: number, max: number): number;
  nextFloat(): number;
}

function createSeededRNG(seed: string): SeededRNG {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  let state = Math.abs(hash) || 1;
  
  return {
    nextInt(min: number, max: number): number {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      const normalized = state / 0x7fffffff;
      return Math.floor(min + normalized * (max - min + 1));
    },
    nextFloat(): number {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    },
  };
}

// ----------------------------------------------------------------------------
// COVER GENERATION
// ----------------------------------------------------------------------------

// Dev-only debug logging for cover generation
const DEBUG_COVER = true;

/**
 * Generate cover for a battle grid deterministically
 */
export function generateCover(
  tiles: Tile[],
  gridWidth: number,
  gridHeight: number,
  battleSeed: string,
  reservedCells: Vec2[] = []
): Tile[] {
  const rng = createSeededRNG(`${battleSeed}_cover`);

  // Select cover profile
  const profileRoll = rng.nextFloat();
  let selectedProfile: CoverProfile = "none";
  let cumulative = 0;
  for (const [profile, prob] of Object.entries(PROFILE_PROBABILITIES)) {
    cumulative += prob;
    if (profileRoll < cumulative) {
      selectedProfile = profile as CoverProfile;
      break;
    }
  }

  // DEV LOGGING: Log cover profile selection
  if (DEBUG_COVER) {
    console.log(
      `[Cover] seed=${battleSeed.substring(0, 20)}..., ` +
      `grid=${gridWidth}x${gridHeight}, profile=${selectedProfile} (roll=${(profileRoll * 100).toFixed(1)}%)`
    );
  }

  if (selectedProfile === "none") {
    if (DEBUG_COVER) {
      console.log(`[Cover] No cover generated for this battle`);
    }
    return tiles; // No cover
  }
  
  const config = PROFILE_CONFIGS[selectedProfile];
  const totalCells = gridWidth * gridHeight;
  
  // Calculate number of cover tiles
  const lightCoverCount = Math.floor((totalCells * config.lightCoverPercent) / 100);
  const heavyCoverCount = Math.floor((totalCells * config.heavyCoverPercent) / 100);
  
  // Create set of reserved positions for fast lookup
  const reservedSet = new Set<string>();
  reservedCells.forEach(cell => {
    reservedSet.add(`${cell.x},${cell.y}`);
  });
  
  // Get all available positions (not reserved, not on edges for spawn zones)
  const availablePositions: Vec2[] = [];
  for (let y = 1; y < gridHeight - 1; y++) {
    for (let x = 1; x < gridWidth - 1; x++) {
      const key = `${x},${y}`;
      if (!reservedSet.has(key)) {
        availablePositions.push({ x, y });
      }
    }
  }
  
  // Shuffle available positions deterministically
  const shuffled = [...availablePositions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // Place heavy cover first (higher priority)
  let positionIndex = 0;
  const updatedTiles = [...tiles];
  
  // Place heavy cover
  for (let i = 0; i < heavyCoverCount && positionIndex < shuffled.length; i++) {
    const pos = shuffled[positionIndex++];
    const tileIndex = pos.y * gridWidth + pos.x;
    if (tileIndex >= 0 && tileIndex < updatedTiles.length) {
      const maxHp = rng.nextInt(COVER_STATS.heavy_cover.minHp, COVER_STATS.heavy_cover.maxHp);
      updatedTiles[tileIndex] = {
        ...updatedTiles[tileIndex],
        terrain: "heavy_cover",
        cover: {
          type: "heavy_cover",
          hp: maxHp,
          maxHp,
        },
      };
    }
  }
  
  // Place light cover
  for (let i = 0; i < lightCoverCount && positionIndex < shuffled.length; i++) {
    const pos = shuffled[positionIndex++];
    const tileIndex = pos.y * gridWidth + pos.x;
    if (tileIndex >= 0 && tileIndex < updatedTiles.length) {
      // Skip if already has cover
      if (updatedTiles[tileIndex].terrain === "heavy_cover" || updatedTiles[tileIndex].terrain === "light_cover") {
        continue;
      }
      
      const maxHp = rng.nextInt(COVER_STATS.light_cover.minHp, COVER_STATS.light_cover.maxHp);
      updatedTiles[tileIndex] = {
        ...updatedTiles[tileIndex],
        terrain: "light_cover",
        cover: {
          type: "light_cover",
          hp: maxHp,
          maxHp,
        },
      };
    }
  }

  // DEV LOGGING: Final cover count
  if (DEBUG_COVER) {
    const finalLightCount = updatedTiles.filter(t => t.terrain === "light_cover").length;
    const finalHeavyCount = updatedTiles.filter(t => t.terrain === "heavy_cover").length;
    console.log(
      `[Cover] Generated: ${finalLightCount} light cover, ${finalHeavyCount} heavy cover`
    );
  }

  return updatedTiles;
}

/**
 * Get cover damage reduction for a unit at a position
 */
export function getCoverDamageReduction(tile: Tile | null | undefined): number {
  if (!tile || !tile.cover || tile.cover.hp <= 0) {
    return 0;
  }
  
  return COVER_STATS[tile.cover.type].damageReduction;
}

/**
 * Get visual state of cover
 */
export function getCoverVisualState(tile: Tile): "intact" | "damaged" | "rubble" {
  if (tile.terrain === "rubble") {
    return "rubble";
  }
  
  if (!tile.cover || tile.cover.hp <= 0) {
    return "rubble";
  }
  
  const hpPercent = tile.cover.hp / tile.cover.maxHp;
  if (hpPercent > 0.5) {
    return "intact";
  } else {
    return "damaged";
  }
}

/**
 * Damage cover at a tile
 * Returns the updated tile
 */
export function damageCover(tile: Tile, damage: number): Tile {
  if (!tile.cover || tile.cover.hp <= 0) {
    return tile;
  }
  
  const newHp = Math.max(0, tile.cover.hp - damage);
  
  if (newHp <= 0) {
    // Cover destroyed - becomes rubble
    return {
      ...tile,
      terrain: "rubble",
      cover: null,
    };
  }
  
  // Cover damaged but still standing
  return {
    ...tile,
    cover: {
      ...tile.cover,
      hp: newHp,
    },
  };
}


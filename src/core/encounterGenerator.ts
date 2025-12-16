// ============================================================================
// CHAOS CORE - ENCOUNTER GENERATOR
// Generate variable enemy encounters per battle room
// ============================================================================

import { OperationId, Difficulty, EncounterDefinition } from "./campaign";
import { getEnemyPool, getEnemyDefinition, EnemyDefinition } from "./enemies";

// ----------------------------------------------------------------------------
// ENCOUNTER GENERATION
// ----------------------------------------------------------------------------

/**
 * Generate an encounter definition for a battle room
 */
export function generateEncounter(
  nodeType: "battle" | "eliteBattle",
  floorIndex: number,
  operationId: OperationId,
  difficulty: Difficulty,
  rngSeed: string
): EncounterDefinition {
  // Create seeded RNG from seed
  const rng = createSeededRNG(rngSeed + `_floor${floorIndex}_${nodeType}`);
  
  // Get enemy pool for this operation
  const pool = getEnemyPool(operationId);
  
  // Determine grid size (4x3 to 8x6)
  const gridSize = determineGridSize(floorIndex, difficulty, nodeType, rng);
  const { width, height } = gridSize;
  const gridArea = width * height;
  
  // Calculate max enemies (grid area * 0.25, clamp 3-10)
  const maxEnemies = Math.max(3, Math.min(10, Math.floor(gridArea * 0.25)));
  
  // Determine enemy count based on node type and difficulty
  const baseCount = nodeType === "eliteBattle" ? 4 : 3;
  const difficultyMod = getDifficultyModifier(difficulty);
  const floorMod = Math.floor(floorIndex * 0.5); // Slight increase per floor
  
  const targetCount = Math.min(
    maxEnemies,
    baseCount + difficultyMod + floorMod + rng.nextInt(0, 2)
  );
  
  // Generate enemy composition
  const enemyUnits = generateEnemyComposition(
    pool,
    targetCount,
    floorIndex,
    difficulty,
    rng
  );
  
  // Generate intro text
  const introText = generateIntroText(nodeType, enemyUnits.length, rng);
  
  return {
    enemyUnits,
    gridWidth: width,
    gridHeight: height,
    introText,
  };
}

/**
 * Generate enemy composition from pool
 */
function generateEnemyComposition(
  pool: import("./enemies").EnemyPool,
  targetCount: number,
  floorIndex: number,
  difficulty: Difficulty,
  rng: SeededRNG
): EncounterDefinition["enemyUnits"] {
  const composition: EncounterDefinition["enemyUnits"] = [];
  let remaining = targetCount;
  
  // Filter enemies by floor constraints
  const availableEnemies = pool.enemies.filter(e => {
    if (e.minFloor !== undefined && floorIndex < e.minFloor) return false;
    if (e.maxFloor !== undefined && floorIndex > e.maxFloor) return false;
    return true;
  });
  
  if (availableEnemies.length === 0) {
    // Fallback to any enemy
    const fallback = Object.keys(pool.enemies)[0];
    if (fallback) {
      return [{
        enemyId: pool.enemies[0].enemyId,
        count: targetCount,
      }];
    }
  }
  
  // Weighted random selection
  const totalWeight = availableEnemies.reduce((sum, e) => sum + e.weight, 0);
  
  while (remaining > 0 && availableEnemies.length > 0) {
    // Pick random enemy from pool
    let random = rng.nextFloat() * totalWeight;
    let selected = availableEnemies[0];
    
    for (const enemy of availableEnemies) {
      random -= enemy.weight;
      if (random <= 0) {
        selected = enemy;
        break;
      }
    }
    
    // Determine count for this enemy type (1-3 typically)
    const countForType = Math.min(remaining, rng.nextInt(1, 3));
    
    // Check if we should make it elite (based on difficulty and floor)
    const elite = shouldBeElite(floorIndex, difficulty, rng);
    const levelMod = difficulty === "hard" ? 1 : 0;
    
    composition.push({
      enemyId: selected.enemyId,
      count: countForType,
      levelMod,
      elite,
    });
    
    remaining -= countForType;
  }
  
  return composition;
}

/**
 * Determine grid size based on floor, difficulty, and node type
 */
function determineGridSize(
  floorIndex: number,
  difficulty: Difficulty,
  nodeType: "battle" | "eliteBattle",
  rng: SeededRNG
): { width: number; height: number } {
  // Elite battles tend to be larger
  const baseSize = nodeType === "eliteBattle" ? 6 : 5;
  const difficultyBonus = difficulty === "hard" ? 1 : 0;
  const floorBonus = Math.floor(floorIndex / 2); // Every 2 floors, slightly larger
  
  const width = Math.min(8, Math.max(4, baseSize + difficultyBonus + floorBonus + rng.nextInt(-1, 1)));
  const height = Math.min(6, Math.max(3, Math.floor(width * 0.75) + rng.nextInt(-1, 1)));
  
  return { width, height };
}

/**
 * Get difficulty modifier for enemy counts
 */
function getDifficultyModifier(difficulty: Difficulty): number {
  switch (difficulty) {
    case "easy": return -1;
    case "normal": return 0;
    case "hard": return 1;
    case "custom": return 0;
  }
}

/**
 * Determine if enemy should be elite variant
 */
function shouldBeElite(
  floorIndex: number,
  difficulty: Difficulty,
  rng: SeededRNG
): boolean {
  const baseChance = 0.1 + (floorIndex * 0.05); // 10% base, +5% per floor
  const difficultyBonus = difficulty === "hard" ? 0.15 : 0;
  const chance = Math.min(0.5, baseChance + difficultyBonus);
  
  return rng.nextFloat() < chance;
}

/**
 * Generate intro text for encounter
 */
function generateIntroText(
  nodeType: "battle" | "eliteBattle",
  enemyCount: number,
  rng: SeededRNG
): string {
  const templates = nodeType === "eliteBattle"
    ? [
        `Elite enemy forces detected. ${enemyCount} units engaged.`,
        `Heavy resistance encountered. ${enemyCount} enemy units.`,
        `Command unit identified. ${enemyCount} hostiles in area.`,
      ]
    : [
        `Enemy patrol detected. ${enemyCount} units.`,
        `Hostile forces ahead. ${enemyCount} enemies.`,
        `Combat zone. ${enemyCount} enemy units.`,
      ];
  
  return templates[rng.nextInt(0, templates.length - 1)];
}

// ----------------------------------------------------------------------------
// SEEDED RNG
// ----------------------------------------------------------------------------

interface SeededRNG {
  nextInt(min: number, max: number): number;
  nextFloat(): number;
}

/**
 * Create a seeded RNG from a string seed
 */
function createSeededRNG(seed: string): SeededRNG {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use hash as seed for simple LCG
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


// ============================================================================
// CHAOS CORE - TRAINING ENCOUNTER SYSTEM
// Creates training battles with customizable rules
// ============================================================================

import { GameState } from "./types";
import { EncounterDefinition } from "./campaign";
import { getEnemyDefinition } from "./enemies";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export interface TrainingConfig {
  gridW: number; // 4..8
  gridH: number; // 3..6
  difficulty: "easy" | "normal" | "hard";
  rules: {
    noRewards: true; // Always true for training
  };
}

// ----------------------------------------------------------------------------
// TRAINING ENCOUNTER FACTORY
// ----------------------------------------------------------------------------

/**
 * Create a training encounter with customizable grid size and difficulty
 */
export function createTrainingEncounter(
  state: GameState,
  config: TrainingConfig
): EncounterDefinition | null {
  // Validate grid bounds
  if (config.gridW < 4 || config.gridW > 8) {
    console.error("[TRAINING] Invalid grid width:", config.gridW);
    return null;
  }
  if (config.gridH < 3 || config.gridH > 6) {
    console.error("[TRAINING] Invalid grid height:", config.gridH);
    return null;
  }
  
  // Determine enemy composition based on difficulty and grid size
  const enemyUnits = generateTrainingEnemies(config);
  
  if (enemyUnits.length === 0) {
    console.error("[TRAINING] Failed to generate enemies");
    return null;
  }
  
  const encounter: EncounterDefinition = {
    enemyUnits,
    gridWidth: config.gridW,
    gridHeight: config.gridH,
    introText: "SLK//TRAIN :: Training simulation initialized. Engage hostiles.",
  };
  
  // Mark as training encounter (for reward blocking)
  (encounter as any).isTraining = true;
  (encounter as any).trainingConfig = config;
  
  return encounter;
}

/**
 * Generate enemy units for training based on difficulty
 */
function generateTrainingEnemies(config: TrainingConfig): Array<{
  enemyId: string;
  count: number;
  levelMod?: number;
  elite?: boolean;
}> {
  const gridArea = config.gridW * config.gridH;
  const maxEnemies = Math.min(6, Math.floor(gridArea * 0.3)); // ~30% of grid, max 6
  
  // Base enemy count based on difficulty
  let enemyCount: number;
  switch (config.difficulty) {
    case "easy":
      enemyCount = Math.max(2, Math.floor(maxEnemies * 0.6));
      break;
    case "normal":
      enemyCount = Math.max(3, Math.floor(maxEnemies * 0.75));
      break;
    case "hard":
      enemyCount = maxEnemies;
      break;
  }
  
  // Select enemy types based on difficulty
  const enemyPool: string[] = [];
  
  // Easy: mostly basic enemies (use actual enemy IDs from database)
  if (config.difficulty === "easy") {
    enemyPool.push("gate_sentry", "gate_sentry", "corrupted_scout");
  }
  // Normal: mix of basic and medium
  else if (config.difficulty === "normal") {
    enemyPool.push("gate_sentry", "corrupted_scout", "basic_infantry", "gate_sentry");
  }
  // Hard: mix with elites
  else {
    enemyPool.push("gate_sentry", "corrupted_scout", "basic_infantry", "artillery_crew", "corrupted_scout");
  }
  
  // Distribute enemies
  const enemyUnits: Array<{
    enemyId: string;
    count: number;
    levelMod?: number;
    elite?: boolean;
  }> = [];
  
  let remaining = enemyCount;
  const usedEnemies = new Set<string>();
  
  // Try to use each enemy type at least once if possible
  for (const enemyId of enemyPool) {
    if (remaining <= 0) break;
    
    // Check if enemy definition exists
    try {
      const enemyDef = getEnemyDefinition(enemyId);
      if (!enemyDef) continue;
      
      const count = usedEnemies.has(enemyId) ? 0 : Math.min(remaining, Math.max(1, Math.floor(enemyCount / enemyPool.length)));
      if (count > 0) {
        enemyUnits.push({
          enemyId,
          count,
          elite: config.difficulty === "hard" && Math.random() < 0.3, // 30% chance for elite in hard mode
        });
        remaining -= count;
        usedEnemies.add(enemyId);
      }
    } catch {
      // Skip if enemy not found
      continue;
    }
  }
  
  // Fill remaining slots with random enemies from pool
  while (remaining > 0 && enemyPool.length > 0) {
    const randomEnemy = enemyPool[Math.floor(Math.random() * enemyPool.length)];
    try {
      const enemyDef = getEnemyDefinition(randomEnemy);
      if (enemyDef) {
        const existing = enemyUnits.find(e => e.enemyId === randomEnemy);
        if (existing) {
          existing.count++;
        } else {
          enemyUnits.push({
            enemyId: randomEnemy,
            count: 1,
          });
        }
        remaining--;
      }
    } catch {
      // Skip if enemy not found
      break;
    }
  }
  
  return enemyUnits;
}


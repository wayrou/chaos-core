// ============================================================================
// CHAOS CORE - ENEMY DEFINITIONS
// Data-driven enemy unit archetypes for encounter generation
// ============================================================================

import { OperationId } from "./campaign";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export interface EnemyDefinition {
  id: string;
  name: string;
  role: "melee" | "ranged" | "support" | "tank" | "artillery" | "scout";
  baseStats: {
    hp: number;
    atk: number;
    def: number;
    agi: number;
    move: number;
  };
  deck?: string[]; // Card IDs (optional, can use defaults)
  tags: string[];
  rarity: "common" | "uncommon" | "rare" | "elite";
  weight: number; // For weighted random selection
}

export interface EnemyPool {
  operationId: OperationId;
  enemies: Array<{
    enemyId: string;
    weight: number;
    minFloor?: number; // Only appear from this floor onwards
    maxFloor?: number; // Only appear up to this floor
  }>;
}

// ----------------------------------------------------------------------------
// ENEMY DEFINITIONS
// ----------------------------------------------------------------------------

export const ENEMY_DATABASE: Record<string, EnemyDefinition> = {
  // ==================== IRON GATE ENEMIES ====================
  gate_sentry: {
    id: "gate_sentry",
    name: "Gate Sentry",
    role: "melee",
    baseStats: { hp: 15, atk: 4, def: 2, agi: 3, move: 3 },
    tags: ["gate_sentry", "basic"],
    rarity: "common",
    weight: 10,
  },
  corrupted_scout: {
    id: "corrupted_scout",
    name: "Corrupted Scout",
    role: "scout",
    baseStats: { hp: 12, atk: 3, def: 1, agi: 5, move: 4 },
    tags: ["scout", "fast"],
    rarity: "common",
    weight: 8,
  },
  basic_infantry: {
    id: "basic_infantry",
    name: "Basic Infantry",
    role: "melee",
    baseStats: { hp: 18, atk: 5, def: 3, agi: 3, move: 3 },
    tags: ["infantry", "basic"],
    rarity: "common",
    weight: 10,
  },
  
  // ==================== BLACK SPIRE ENEMIES ====================
  artillery_crew: {
    id: "artillery_crew",
    name: "Artillery Crew",
    role: "artillery",
    baseStats: { hp: 20, atk: 7, def: 2, agi: 2, move: 2 },
    tags: ["artillery", "ranged"],
    rarity: "uncommon",
    weight: 6,
  },
  guard_tower: {
    id: "guard_tower",
    name: "Guard Tower",
    role: "tank",
    baseStats: { hp: 30, atk: 4, def: 5, agi: 1, move: 1 },
    tags: ["tower", "defensive"],
    rarity: "uncommon",
    weight: 4,
  },
  sniper: {
    id: "sniper",
    name: "Sniper",
    role: "ranged",
    baseStats: { hp: 14, atk: 8, def: 1, agi: 4, move: 3 },
    tags: ["ranged", "precision"],
    rarity: "uncommon",
    weight: 5,
  },
  
  // ==================== GHOST RUN ENEMIES ====================
  skirmisher: {
    id: "skirmisher",
    name: "Skirmisher",
    role: "scout",
    baseStats: { hp: 13, atk: 4, def: 1, agi: 6, move: 5 },
    tags: ["fast", "mobile"],
    rarity: "uncommon",
    weight: 7,
  },
  disruptor: {
    id: "disruptor",
    name: "Disruptor",
    role: "support",
    baseStats: { hp: 16, atk: 3, def: 2, agi: 4, move: 4 },
    tags: ["support", "debuff"],
    rarity: "uncommon",
    weight: 6,
  },
  raider: {
    id: "raider",
    name: "Raider",
    role: "melee",
    baseStats: { hp: 20, atk: 6, def: 2, agi: 5, move: 4 },
    tags: ["aggressive", "mobile"],
    rarity: "uncommon",
    weight: 7,
  },
  
  // ==================== EMBER SIEGE ENEMIES ====================
  fortification_unit: {
    id: "fortification_unit",
    name: "Fortification Unit",
    role: "tank",
    baseStats: { hp: 35, atk: 5, def: 6, agi: 2, move: 2 },
    tags: ["tank", "defensive"],
    rarity: "rare",
    weight: 4,
  },
  siege_engine: {
    id: "siege_engine",
    name: "Siege Engine",
    role: "artillery",
    baseStats: { hp: 25, atk: 9, def: 3, agi: 1, move: 1 },
    tags: ["artillery", "heavy"],
    rarity: "rare",
    weight: 3,
  },
  elite_guard: {
    id: "elite_guard",
    name: "Elite Guard",
    role: "tank",
    baseStats: { hp: 28, atk: 6, def: 5, agi: 3, move: 3 },
    tags: ["elite", "defensive"],
    rarity: "rare",
    weight: 5,
  },
  
  // ==================== FINAL DAWN ENEMIES ====================
  command_elite: {
    id: "command_elite",
    name: "Command Elite",
    role: "melee",
    baseStats: { hp: 32, atk: 8, def: 4, agi: 4, move: 4 },
    tags: ["elite", "command"],
    rarity: "rare",
    weight: 4,
  },
  elite_sniper: {
    id: "elite_sniper",
    name: "Elite Sniper",
    role: "ranged",
    baseStats: { hp: 18, atk: 10, def: 2, agi: 5, move: 3 },
    tags: ["elite", "ranged", "precision"],
    rarity: "rare",
    weight: 3,
  },
  battle_commander: {
    id: "battle_commander",
    name: "Battle Commander",
    role: "support",
    baseStats: { hp: 40, atk: 7, def: 5, agi: 3, move: 3 },
    tags: ["elite", "command", "support"],
    rarity: "elite",
    weight: 2,
  },
};

// ----------------------------------------------------------------------------
// ENEMY POOLS BY OPERATION
// ----------------------------------------------------------------------------

export const ENEMY_POOLS: Record<OperationId, EnemyPool> = {
  op_iron_gate: {
    operationId: "op_iron_gate",
    enemies: [
      { enemyId: "gate_sentry", weight: 10 },
      { enemyId: "corrupted_scout", weight: 8 },
      { enemyId: "basic_infantry", weight: 10 },
    ],
  },
  op_black_spire: {
    operationId: "op_black_spire",
    enemies: [
      { enemyId: "artillery_crew", weight: 8 },
      { enemyId: "guard_tower", weight: 5 },
      { enemyId: "sniper", weight: 7 },
      { enemyId: "basic_infantry", weight: 6 }, // Still appear
    ],
  },
  op_ghost_run: {
    operationId: "op_ghost_run",
    enemies: [
      { enemyId: "skirmisher", weight: 9 },
      { enemyId: "disruptor", weight: 7 },
      { enemyId: "raider", weight: 8 },
      { enemyId: "corrupted_scout", weight: 5 },
    ],
  },
  op_ember_siege: {
    operationId: "op_ember_siege",
    enemies: [
      { enemyId: "fortification_unit", weight: 6 },
      { enemyId: "siege_engine", weight: 4 },
      { enemyId: "elite_guard", weight: 7 },
      { enemyId: "artillery_crew", weight: 5 },
    ],
  },
  op_final_dawn: {
    operationId: "op_final_dawn",
    enemies: [
      { enemyId: "command_elite", weight: 6 },
      { enemyId: "elite_sniper", weight: 5 },
      { enemyId: "battle_commander", weight: 3 },
      { enemyId: "elite_guard", weight: 6 },
      { enemyId: "fortification_unit", weight: 4 },
    ],
  },
  op_custom: {
    operationId: "op_custom",
    enemies: [
      // Mix of all enemies, weighted by rarity
      { enemyId: "gate_sentry", weight: 5 },
      { enemyId: "basic_infantry", weight: 5 },
      { enemyId: "artillery_crew", weight: 4 },
      { enemyId: "skirmisher", weight: 4 },
      { enemyId: "elite_guard", weight: 3 },
      { enemyId: "command_elite", weight: 2 },
    ],
  },
};

/**
 * Get enemy definition by ID
 */
export function getEnemyDefinition(enemyId: string): EnemyDefinition | null {
  return ENEMY_DATABASE[enemyId] || null;
}

/**
 * Get enemy pool for an operation
 */
export function getEnemyPool(operationId: OperationId): EnemyPool {
  return ENEMY_POOLS[operationId] || ENEMY_POOLS.op_custom;
}


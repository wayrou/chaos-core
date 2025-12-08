// ============================================================================
// RECRUITMENT SYSTEM - Headline 14az
// ============================================================================
// Handles unit recruitment from Taverns/Contract Boards:
// - Candidate generation (3-6 candidates per hub)
// - PWR-based archetype generation (Rookie/Standard/Veteran/Rare)
// - Contract costs and hiring
// - Roster limit enforcement
// ============================================================================

import {
  UnitId,
  RecruitmentCandidate,
  UnitAffinities,
  GUILD_ROSTER_LIMITS,
} from "./types";
import { ClassId, CLASS_DEFINITIONS, getClassDefinition } from "./classes";
import { createDefaultAffinities } from "./affinity";
import { calculatePWR } from "./pwr";
import { getAllStarterEquipment } from "./equipment";

// ============================================================================
// TYPES
// ============================================================================

export type CandidateArchetype = "Rookie" | "Standard" | "Veteran" | "Rare";

export interface RecruitmentHub {
  id: string;
  name: string;
  type: "base_camp" | "operation_node";
  candidatePoolSize: number; // 3-6
}

// ============================================================================
// CANDIDATE GENERATION
// ============================================================================

/**
 * Generate a pool of recruitment candidates
 */
export function generateCandidates(
  hub: RecruitmentHub,
  existingRosterSize: number
): RecruitmentCandidate[] {
  const poolSize = Math.min(
    hub.candidatePoolSize,
    GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS - existingRosterSize
  );

  if (poolSize <= 0) {
    return [];
  }

  const candidates: RecruitmentCandidate[] = [];

  for (let i = 0; i < poolSize; i++) {
    const archetype = rollArchetype(hub.type);
    const candidate = generateCandidate(archetype, i);
    candidates.push(candidate);
  }

  return candidates;
}

/**
 * Roll archetype based on hub type
 */
function rollArchetype(hubType: "base_camp" | "operation_node"): CandidateArchetype {
  const roll = Math.random();

  if (hubType === "base_camp") {
    // Base Camp: Better odds for higher tiers
    if (roll < 0.1) return "Rare";
    if (roll < 0.3) return "Veteran";
    if (roll < 0.7) return "Standard";
    return "Rookie";
  } else {
    // Operation Node: Limited pool, mostly Standard/Rookie
    if (roll < 0.05) return "Rare";
    if (roll < 0.2) return "Veteran";
    if (roll < 0.6) return "Standard";
    return "Rookie";
  }
}

/**
 * Generate a single candidate
 */
function generateCandidate(
  archetype: CandidateArchetype,
  index: number
): RecruitmentCandidate {
  // Select base class
  const availableClasses: ClassId[] = ["squire", "ranger", "magician", "thief"];
  const baseClass = availableClasses[Math.floor(Math.random() * availableClasses.length)];
  const classDef = getClassDefinition(baseClass);

  // Generate stats based on archetype
  const stats = generateStatsForArchetype(archetype, classDef.baseStats);

  // Generate PWR (will be calculated, but estimate for cost)
  const estimatedPWR = estimatePWRFromArchetype(archetype, stats);

  // Generate name
  const name = generateCandidateName(baseClass, index);

  // Generate affinities (new recruits start with low affinities)
  const affinities = generateStartingAffinities(archetype);

  // Generate traits
  const traits = generateTraits(archetype, baseClass);

  // Calculate contract cost based on PWR
  const contractCost = calculateContractCost(estimatedPWR, archetype);

  return {
    id: `candidate_${Date.now()}_${index}`,
    name,
    baseClass,
    currentClass: baseClass,
    pwr: estimatedPWR,
    affinities,
    contractCost,
    traits,
    stats,
  };
}

/**
 * Generate stats for an archetype
 */
function generateStatsForArchetype(
  archetype: CandidateArchetype,
  baseClassStats: { maxHp: number; atk: number; def: number; agi: number; acc: number }
): { maxHp: number; atk: number; def: number; agi: number; acc: number } {
  const multipliers: Record<CandidateArchetype, number> = {
    Rookie: 0.8,
    Standard: 1.0,
    Veteran: 1.2,
    Rare: 1.4,
  };

  const mult = multipliers[archetype];
  const variance = 0.1; // ±10% variance

  const randomize = (base: number) => {
    const varAmount = base * variance;
    const randomVar = (Math.random() - 0.5) * 2 * varAmount;
    return Math.round(base * mult + randomVar);
  };

  return {
    maxHp: Math.max(10, randomize(baseClassStats.maxHp)),
    atk: Math.max(1, randomize(baseClassStats.atk)),
    def: Math.max(1, randomize(baseClassStats.def)),
    agi: Math.max(1, randomize(baseClassStats.agi)),
    acc: Math.max(50, Math.min(100, randomize(baseClassStats.acc))),
  };
}

/**
 * Estimate PWR from archetype and stats
 */
function estimatePWRFromArchetype(
  archetype: CandidateArchetype,
  stats: { maxHp: number; atk: number; def: number; agi: number; acc: number }
): number {
  const basePWR = (stats.maxHp + stats.atk * 5 + stats.def * 5 + stats.agi * 3 + stats.acc) / 5;
  
  const multipliers: Record<CandidateArchetype, number> = {
    Rookie: 0.7,
    Standard: 1.0,
    Veteran: 1.3,
    Rare: 1.6,
  };

  return Math.round(basePWR * multipliers[archetype]);
}

/**
 * Generate candidate name
 */
function generateCandidateName(baseClass: ClassId, index: number): string {
  const namePrefixes: Record<ClassId, string[]> = {
    squire: ["Aeriss", "Kael", "Thorne", "Valen", "Darius"],
    ranger: ["Mira", "Silas", "Raven", "Arrow", "Hawke"],
    magician: ["Lyra", "Zephyr", "Nyx", "Cinder", "Vex"],
    thief: ["Shadow", "Rook", "Whisper", "Blade", "Shade"],
  };

  const prefixes = namePrefixes[baseClass] || ["Recruit"];
  const prefix = prefixes[index % prefixes.length];
  const suffix = Math.floor(Math.random() * 100);
  
  return `${prefix} ${suffix}`;
}

/**
 * Generate starting affinities for a new recruit
 */
function generateStartingAffinities(archetype: CandidateArchetype): UnitAffinities {
  const base = createDefaultAffinities();
  
  // Veterans and Rare recruits start with some affinity
  if (archetype === "Veteran" || archetype === "Rare") {
    const bonus = archetype === "Rare" ? 20 : 10;
    const randomType = ["melee", "ranged", "magic", "support"][
      Math.floor(Math.random() * 4)
    ] as keyof UnitAffinities;
    base[randomType] = bonus;
  }
  
  return base;
}

/**
 * Generate trait tags for display
 */
function generateTraits(archetype: CandidateArchetype, baseClass: ClassId): string[] {
  const traits: string[] = [];

  // Archetype trait
  traits.push(archetype);

  // Class-based trait
  const classTraits: Record<ClassId, string[]> = {
    squire: ["Frontline", "Reliable"],
    ranger: ["Marksman", "Mobile"],
    magician: ["Caster", "Chaos"],
    thief: ["Stealth", "Agile"],
  };

  const classTraitList = classTraits[baseClass] || [];
  if (classTraitList.length > 0) {
    traits.push(classTraitList[Math.floor(Math.random() * classTraitList.length)]);
  }

  return traits.slice(0, 2); // Max 2 traits
}

/**
 * Calculate contract cost based on PWR and archetype
 */
function calculateContractCost(pwr: number, archetype: CandidateArchetype): number {
  const baseCost = pwr * 2; // Base: 2 WAD per PWR point
  
  const multipliers: Record<CandidateArchetype, number> = {
    Rookie: 0.8,
    Standard: 1.0,
    Veteran: 1.3,
    Rare: 1.6,
  };

  return Math.round(baseCost * multipliers[archetype]);
}

// ============================================================================
// RECRUITMENT ACTIONS
// ============================================================================

/**
 * Hire a candidate (convert to unit and add to roster)
 */
export function hireCandidate(
  candidateId: string,
  candidates: RecruitmentCandidate[],
  state: any
): { success: boolean; error?: string } {
  const candidate = candidates.find((c) => c.id === candidateId);
  if (!candidate) {
    return { success: false, error: "Candidate not found" };
  }

  // Check roster limits
  const currentRosterSize = Object.keys(state.unitsById || {}).length;
  if (currentRosterSize >= GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS) {
    return {
      success: false,
      error: `Roster is full (${GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS}/${GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS} members)`,
    };
  }

  // Check WAD cost
  if (state.wad < candidate.contractCost) {
    return {
      success: false,
      error: `Insufficient WAD. Need ${candidate.contractCost}, have ${state.wad}`,
    };
  }

  // Create unit from candidate
  const unitId: UnitId = `unit_${candidate.name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;
  
  const newUnit = {
    id: unitId,
    name: candidate.name,
    isEnemy: false,
    hp: candidate.stats.maxHp,
    maxHp: candidate.stats.maxHp,
    agi: candidate.stats.agi,
    pos: null,
    hand: [],
    drawPile: [],
    discardPile: [],
    strain: 0,
    unitClass: candidate.currentClass,
    stats: candidate.stats,
    pwr: candidate.pwr,
    affinities: { ...candidate.affinities },
    loadout: {
      weapon: null,
      helmet: null,
      chestpiece: null,
      accessory1: null,
      accessory2: null,
    },
  };

  // Add to roster
  state.unitsById = state.unitsById || {};
  state.unitsById[unitId] = newUnit;

  // Add to profile roster
  if (!state.profile.rosterUnitIds) {
    state.profile.rosterUnitIds = [];
  }
  state.profile.rosterUnitIds.push(unitId);

  // Deduct WAD
  state.wad -= candidate.contractCost;

  // Remove candidate from pool
  const updatedCandidates = candidates.filter((c) => c.id !== candidateId);
  state.recruitmentCandidates = updatedCandidates;

  return { success: true };
}

/**
 * Get current roster size
 */
export function getRosterSize(state: any): number {
  return Object.keys(state.unitsById || {}).filter(
    (id) => !state.unitsById[id]?.isEnemy
  ).length;
}

/**
 * Check if roster is at capacity
 */
export function isRosterFull(state: any): boolean {
  return getRosterSize(state) >= GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS;
}



"use strict";
// ============================================================================
// RECRUITMENT SYSTEM - Headline 14az
// ============================================================================
// Handles unit recruitment from Taverns/Contract Boards:
// - Candidate generation (3-6 candidates per hub)
// - PWR-based archetype generation (Rookie/Standard/Veteran/Rare)
// - Contract costs and hiring
// - Roster limit enforcement
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCandidates = generateCandidates;
exports.hireCandidate = hireCandidate;
exports.getRosterSize = getRosterSize;
exports.isRosterFull = isRosterFull;
const types_1 = require("./types");
const classes_1 = require("./classes");
const affinity_1 = require("./affinity");
const session_1 = require("./session");
// ============================================================================
// CANDIDATE GENERATION
// ============================================================================
/**
 * Generate a pool of recruitment candidates
 */
function generateCandidates(hub, existingRosterSize) {
    const poolSize = Math.min(hub.candidatePoolSize, types_1.GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS - existingRosterSize);
    if (poolSize <= 0) {
        return [];
    }
    const candidates = [];
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
function rollArchetype(hubType) {
    const roll = Math.random();
    if (hubType === "base_camp") {
        // Base Camp: Better odds for higher tiers
        if (roll < 0.1)
            return "Rare";
        if (roll < 0.3)
            return "Veteran";
        if (roll < 0.7)
            return "Standard";
        return "Rookie";
    }
    else {
        // Operation Node: Limited pool, mostly Standard/Rookie
        if (roll < 0.05)
            return "Rare";
        if (roll < 0.2)
            return "Veteran";
        if (roll < 0.6)
            return "Standard";
        return "Rookie";
    }
}
/**
 * Generate a single candidate
 */
function generateCandidate(archetype, index) {
    // Select base class
    const availableClasses = ["squire", "ranger", "magician", "thief"];
    const baseClass = availableClasses[Math.floor(Math.random() * availableClasses.length)];
    const classDef = (0, classes_1.getClassDefinition)(baseClass);
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
function generateStatsForArchetype(archetype, baseClassStats) {
    const multipliers = {
        Rookie: 0.8,
        Standard: 1.0,
        Veteran: 1.2,
        Rare: 1.4,
    };
    const mult = multipliers[archetype];
    const variance = 0.1; // ±10% variance
    const randomize = (base) => {
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
function estimatePWRFromArchetype(archetype, stats) {
    const basePWR = (stats.maxHp + stats.atk * 5 + stats.def * 5 + stats.agi * 3 + stats.acc) / 5;
    const multipliers = {
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
function generateCandidateName(baseClass, index) {
    const namePrefixes = {
        squire: ["Kael", "Thorne", "Valen", "Darius", "Maren"],
        ranger: ["Mira", "Silas", "Raven", "Arrow", "Hawke"],
        magician: ["Lyra", "Zephyr", "Nyx", "Cinder", "Vex"],
        thief: ["Shadow", "Rook", "Whisper", "Blade", "Shade"],
    };
    const prefixes = namePrefixes[baseClass] || ["Recruit"];
    const prefix = prefixes[index % prefixes.length];
    return prefix;
}
/**
 * Generate starting affinities for a new recruit
 */
function generateStartingAffinities(archetype) {
    const base = (0, affinity_1.createDefaultAffinities)();
    // Veterans and Rare recruits start with some affinity
    if (archetype === "Veteran" || archetype === "Rare") {
        const bonus = archetype === "Rare" ? 20 : 10;
        const randomType = ["melee", "ranged", "magic", "support"][Math.floor(Math.random() * 4)];
        base[randomType] = bonus;
    }
    return base;
}
/**
 * Generate trait tags for display
 */
function generateTraits(archetype, baseClass) {
    const traits = [];
    // Archetype trait
    traits.push(archetype);
    // Class-based trait
    const classTraits = {
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
function calculateContractCost(pwr, archetype) {
    const baseCost = pwr * 2; // Base: 2 WAD per PWR point
    const multipliers = {
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
function hireCandidate(candidateId, candidates, state) {
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate) {
        return { success: false, error: "Candidate not found" };
    }
    // Check roster limits
    const currentRosterSize = Object.keys(state.unitsById || {}).length;
    if (currentRosterSize >= types_1.GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS) {
        return {
            success: false,
            error: `Roster is full (${types_1.GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS}/${types_1.GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS} members)`,
        };
    }
    // Check WAD cost
    const localWalletHasFunds = (0, session_1.canSessionAffordCost)(state, { wad: candidate.contractCost });
    if (!localWalletHasFunds) {
        return {
            success: false,
            error: `Insufficient WAD. Need ${candidate.contractCost}.`,
        };
    }
    // Create unit from candidate
    const unitId = `unit_${candidate.name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;
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
            primaryWeapon: null,
            secondaryWeapon: null,
            helmet: null,
            chestpiece: null,
            accessory1: null,
            accessory2: null,
        },
    };
    const spendResult = (0, session_1.spendSessionCost)(state, { wad: candidate.contractCost });
    if (!spendResult.success) {
        return {
            success: false,
            error: `Insufficient WAD. Need ${candidate.contractCost}.`,
        };
    }
    // Remove candidate from pool
    const updatedCandidates = candidates.filter((c) => c.id !== candidateId);
    const nextState = {
        ...spendResult.state,
        unitsById: {
            ...(spendResult.state.unitsById || {}),
            [unitId]: newUnit,
        },
        profile: {
            ...spendResult.state.profile,
            rosterUnitIds: [...(spendResult.state.profile.rosterUnitIds || []), unitId],
        },
        recruitmentCandidates: updatedCandidates,
    };
    return { success: true, state: nextState };
}
/**
 * Get current roster size
 */
function getRosterSize(state) {
    return Object.keys(state.unitsById || {}).filter((id) => !state.unitsById[id]?.isEnemy).length;
}
/**
 * Check if roster is at capacity
 */
function isRosterFull(state) {
    return getRosterSize(state) >= types_1.GUILD_ROSTER_LIMITS.MAX_TOTAL_MEMBERS;
}

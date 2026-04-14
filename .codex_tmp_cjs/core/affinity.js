"use strict";
// ============================================================================
// AFFINITY TRACKING SYSTEM - Headline 14a
// ============================================================================
// Tracks long-term affinities for units based on combat actions:
// - Melee: Melee attacks performed
// - Ranged: Ranged skills used
// - Magic: Spells cast
// - Support: Buffs/heals/shields applied
// - Mobility: Movement/mobility skills used
// - Survival: Damage taken and survived / operations completed
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_AFFINITY = exports.AFFINITY_GAINS = void 0;
exports.createDefaultAffinities = createDefaultAffinities;
exports.getUnitAffinities = getUnitAffinities;
exports.addAffinity = addAffinity;
exports.recordMeleeAttack = recordMeleeAttack;
exports.recordRangedSkill = recordRangedSkill;
exports.recordMagicSpell = recordMagicSpell;
exports.recordSupportAction = recordSupportAction;
exports.recordMobilityAction = recordMobilityAction;
exports.recordSurvival = recordSurvival;
exports.meetsAffinityRequirement = meetsAffinityRequirement;
exports.getAffinityDiscount = getAffinityDiscount;
// ============================================================================
// AFFINITY CONSTANTS
// ============================================================================
/**
 * Base affinity gain per action
 */
exports.AFFINITY_GAINS = {
    melee: 2, // Per melee attack
    ranged: 2, // Per ranged skill
    magic: 2, // Per spell cast
    support: 2, // Per buff/heal/shield
    mobility: 1, // Per movement/mobility skill
    survival: 5, // Per operation completed alive, +1 per 10 damage taken
};
/**
 * Maximum affinity value (cap at 100)
 */
exports.MAX_AFFINITY = 100;
// ============================================================================
// AFFINITY MANAGEMENT
// ============================================================================
/**
 * Create default empty affinities
 */
function createDefaultAffinities() {
    return {
        melee: 0,
        ranged: 0,
        magic: 0,
        support: 0,
        mobility: 0,
        survival: 0,
    };
}
/**
 * Get affinities for a unit (with defaults)
 */
function getUnitAffinities(unitId, state) {
    const unit = state.unitsById[unitId];
    if (!unit)
        return createDefaultAffinities();
    return unit.affinities || createDefaultAffinities();
}
/**
 * Add affinity to a unit
 */
function addAffinity(unitId, type, amount, state) {
    const unit = state.unitsById[unitId];
    if (!unit || unit.isEnemy)
        return;
    const current = unit.affinities || createDefaultAffinities();
    const newValue = Math.min(exports.MAX_AFFINITY, current[type] + amount);
    unit.affinities = {
        ...current,
        [type]: newValue,
    };
}
/**
 * Record a melee attack
 */
function recordMeleeAttack(unitId, state) {
    addAffinity(unitId, "melee", exports.AFFINITY_GAINS.melee, state);
}
/**
 * Record a ranged skill use
 */
function recordRangedSkill(unitId, state) {
    addAffinity(unitId, "ranged", exports.AFFINITY_GAINS.ranged, state);
}
/**
 * Record a magic spell cast
 */
function recordMagicSpell(unitId, state) {
    addAffinity(unitId, "magic", exports.AFFINITY_GAINS.magic, state);
}
/**
 * Record a support action (buff/heal/shield)
 */
function recordSupportAction(unitId, state) {
    addAffinity(unitId, "support", exports.AFFINITY_GAINS.support, state);
}
/**
 * Record a mobility action (movement/mobility skill)
 */
function recordMobilityAction(unitId, state) {
    addAffinity(unitId, "mobility", exports.AFFINITY_GAINS.mobility, state);
}
/**
 * Record survival (damage taken, operation completion)
 */
function recordSurvival(unitId, damageTaken, operationCompleted, state) {
    // Base survival gain for completing operation
    if (operationCompleted) {
        addAffinity(unitId, "survival", exports.AFFINITY_GAINS.survival, state);
    }
    // Additional survival for damage taken (1 point per 10 damage)
    if (damageTaken > 0) {
        const damageBonus = Math.floor(damageTaken / 10);
        addAffinity(unitId, "survival", damageBonus, state);
    }
}
/**
 * Check if a unit meets an affinity requirement
 */
function meetsAffinityRequirement(affinities, type, threshold) {
    return (affinities[type] || 0) >= threshold;
}
/**
 * Get affinity discount for a class grid node
 * Example: Survival >= 60 → -10 XP discount
 */
function getAffinityDiscount(affinities, discountRules) {
    let totalDiscount = 0;
    for (const rule of discountRules) {
        if (meetsAffinityRequirement(affinities, rule.type, rule.threshold)) {
            totalDiscount += rule.discount;
        }
    }
    return totalDiscount;
}

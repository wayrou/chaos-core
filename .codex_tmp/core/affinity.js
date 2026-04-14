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
// ============================================================================
// AFFINITY CONSTANTS
// ============================================================================
/**
 * Base affinity gain per action
 */
export const AFFINITY_GAINS = {
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
export const MAX_AFFINITY = 100;
// ============================================================================
// AFFINITY MANAGEMENT
// ============================================================================
/**
 * Create default empty affinities
 */
export function createDefaultAffinities() {
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
export function getUnitAffinities(unitId, state) {
    const unit = state.unitsById[unitId];
    if (!unit)
        return createDefaultAffinities();
    return unit.affinities || createDefaultAffinities();
}
/**
 * Add affinity to a unit
 */
export function addAffinity(unitId, type, amount, state) {
    const unit = state.unitsById[unitId];
    if (!unit || unit.isEnemy)
        return;
    const current = unit.affinities || createDefaultAffinities();
    const newValue = Math.min(MAX_AFFINITY, current[type] + amount);
    unit.affinities = {
        ...current,
        [type]: newValue,
    };
}
/**
 * Record a melee attack
 */
export function recordMeleeAttack(unitId, state) {
    addAffinity(unitId, "melee", AFFINITY_GAINS.melee, state);
}
/**
 * Record a ranged skill use
 */
export function recordRangedSkill(unitId, state) {
    addAffinity(unitId, "ranged", AFFINITY_GAINS.ranged, state);
}
/**
 * Record a magic spell cast
 */
export function recordMagicSpell(unitId, state) {
    addAffinity(unitId, "magic", AFFINITY_GAINS.magic, state);
}
/**
 * Record a support action (buff/heal/shield)
 */
export function recordSupportAction(unitId, state) {
    addAffinity(unitId, "support", AFFINITY_GAINS.support, state);
}
/**
 * Record a mobility action (movement/mobility skill)
 */
export function recordMobilityAction(unitId, state) {
    addAffinity(unitId, "mobility", AFFINITY_GAINS.mobility, state);
}
/**
 * Record survival (damage taken, operation completion)
 */
export function recordSurvival(unitId, damageTaken, operationCompleted, state) {
    // Base survival gain for completing operation
    if (operationCompleted) {
        addAffinity(unitId, "survival", AFFINITY_GAINS.survival, state);
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
export function meetsAffinityRequirement(affinities, type, threshold) {
    return (affinities[type] || 0) >= threshold;
}
/**
 * Get affinity discount for a class grid node
 * Example: Survival >= 60 → -10 XP discount
 */
export function getAffinityDiscount(affinities, discountRules) {
    let totalDiscount = 0;
    for (const rule of discountRules) {
        if (meetsAffinityRequirement(affinities, rule.type, rule.threshold)) {
            totalDiscount += rule.discount;
        }
    }
    return totalDiscount;
}

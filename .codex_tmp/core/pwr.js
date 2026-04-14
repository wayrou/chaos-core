// ============================================================================
// PERSONNEL WARFARE RATING (PWR) SYSTEM - Headline 14a
// ============================================================================
// Calculates a unit's overall combat effectiveness rating based on:
// - Base stats (HP, ATK, DEF, AGI, ACC)
// - Class ranks and unlocked masteries
// - Gear tier/rarity
// - Cards/effects equipped
// - Passive flags or promotions
// ============================================================================
import { getClassDefinition } from "./classes";
import { calculateEquipmentStats } from "./equipment";
import { getAllStarterEquipment } from "./equipment";
// ============================================================================
// PWR BANDS (for UI display)
// ============================================================================
export const PWR_BANDS = {
    Rookie: { min: 0, max: 50, color: "#888" },
    Standard: { min: 51, max: 100, color: "#4a9" },
    Veteran: { min: 101, max: 150, color: "#6af" },
    Elite: { min: 151, max: 200, color: "#a6f" },
    Paragon: { min: 201, max: 999, color: "#ff6" },
};
// ============================================================================
// PWR CALCULATION
// ============================================================================
/**
 * Calculate PWR for a unit
 * Formula weights:
 * - Base stats: 35% (HP, ATK, DEF, AGI, ACC normalized)
 * - Class ranks: 20% (sum of all class ranks * 5)
 * - Ability grid: 15% (unlocked training nodes)
 * - Gear tier: 20% (equipment stat bonuses)
 * - Cards/effects: 5% (number of equipped cards)
 * - Promotions: 5% (bonus for advanced classes)
 */
export function calculatePWR(input) {
    const { unit, unitClassProgress, equipmentById } = input;
    // Get base stats (from unit.stats or defaults)
    const baseStats = unit.stats || {
        maxHp: unit.maxHp || 20,
        atk: 5,
        def: 3,
        agi: unit.agi || 4,
        acc: 80,
    };
    // Get equipment stats
    const loadout = unit.loadout || {
        weapon: null,
        helmet: null,
        chestpiece: null,
        accessory1: null,
        accessory2: null,
    };
    const equip = equipmentById || getAllStarterEquipment();
    const equipStats = calculateEquipmentStats(loadout, equip);
    // 1. Base Stats Component (35% weight)
    // Normalize stats to 0-100 scale
    const statHp = Math.min(100, (baseStats.maxHp / 150) * 100);
    const statAtk = Math.min(100, (baseStats.atk / 20) * 100);
    const statDef = Math.min(100, (baseStats.def / 15) * 100);
    const statAgi = Math.min(100, (baseStats.agi / 15) * 100);
    const statAcc = Math.min(100, baseStats.acc); // Already 0-100
    const baseStatsScore = (statHp + statAtk + statDef + statAgi + statAcc) / 5;
    const baseStatsComponent = baseStatsScore * 0.35;
    // 2. Class Ranks Component (20% weight)
    let classRanksScore = 0;
    if (unitClassProgress) {
        const totalRanks = Object.values(unitClassProgress.classRanks || {}).reduce((sum, rank) => sum + rank, 0);
        classRanksScore = Math.min(100, (totalRanks / 20) * 100); // Assume max ~20 total ranks across all classes
    }
    else {
        // Default: assume rank 1 in current class
        classRanksScore = 5; // 1 rank = 5 points
    }
    const classRanksComponent = classRanksScore * 0.2;
    // 3. Ability Grid Component (15% weight)
    const unlockedGridNodeCount = unitClassProgress
        ? Object.values(unitClassProgress.gridUnlocks || {}).reduce((sum, nodes) => sum + (nodes?.length || 0), 0)
        : 0;
    const gridScore = Math.min(100, (unlockedGridNodeCount / 18) * 100);
    const abilityGridComponent = gridScore * 0.15;
    // 4. Gear Tier Component (20% weight)
    // Sum equipment stat bonuses (normalized)
    const gearAtk = Math.min(50, equipStats.atk * 2);
    const gearDef = Math.min(50, equipStats.def * 2);
    const gearAgi = Math.min(50, equipStats.agi * 2);
    const gearAcc = Math.min(50, equipStats.acc * 2);
    const gearHp = Math.min(50, (equipStats.hp / 30) * 50);
    const gearScore = (gearAtk + gearDef + gearAgi + gearAcc + gearHp) / 5;
    const gearComponent = gearScore * 0.2;
    // 5. Cards/Effects Component (5% weight)
    // Count total cards in deck (from equipment)
    const unitClass = unit.unitClass || "squire";
    const deckSize = estimateDeckSize(unitClass, loadout, equip);
    const cardsScore = Math.min(100, (deckSize / 20) * 100); // Assume max 20 cards
    const cardsComponent = cardsScore * 0.05;
    // 6. Promotions Component (5% weight)
    let promotionsScore = 0;
    if (unitClassProgress) {
        const currentClass = getClassDefinition(unitClassProgress.currentClass);
        promotionsScore = currentClass.tier * 20; // Tier 0=0, Tier 1=20, Tier 2=40, Tier 3=60
    }
    const promotionsComponent = promotionsScore * 0.05;
    // Sum all components
    const totalPWR = Math.round(baseStatsComponent +
        classRanksComponent +
        abilityGridComponent +
        gearComponent +
        cardsComponent +
        promotionsComponent);
    return Math.max(0, totalPWR);
}
/**
 * Estimate deck size for a unit (helper for PWR calculation)
 */
function estimateDeckSize(_unitClass, loadout, equipmentById) {
    let count = 0;
    const slots = ["weapon", "helmet", "chestpiece", "accessory1", "accessory2"];
    for (const slot of slots) {
        const equipId = loadout[slot];
        if (equipId && equipmentById[equipId]) {
            // Estimate: each equipment piece contributes ~2-4 cards
            count += 3; // Average
        }
    }
    // Add base class cards (estimate)
    count += 3;
    return count;
}
/**
 * Get PWR band label for a given PWR value
 */
export function getPWRBand(pwr) {
    if (pwr <= 50)
        return "Rookie";
    if (pwr <= 100)
        return "Standard";
    if (pwr <= 150)
        return "Veteran";
    if (pwr <= 200)
        return "Elite";
    return "Paragon";
}
/**
 * Get PWR band color for UI
 */
export function getPWRBandColor(pwr) {
    const band = getPWRBand(pwr);
    return PWR_BANDS[band].color || "#888";
}
/**
 * Update PWR for a unit in game state
 * Call this whenever stats, gear, or class changes
 */
export function updateUnitPWR(unitId, state, unitClassProgress) {
    const unit = state.unitsById[unitId];
    if (!unit || unit.isEnemy)
        return;
    const pwr = calculatePWR({
        unit,
        unitClassProgress,
        equipmentById: state.equipmentById,
    });
    // Update unit with new PWR
    unit.pwr = pwr;
}

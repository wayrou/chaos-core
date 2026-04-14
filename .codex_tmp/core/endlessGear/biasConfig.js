// ============================================================================
// CHAOS CORE - ENDLESS GEAR BIAS CONFIGURATION
// Data-driven material biases and chassis base configs
// ============================================================================
/**
 * Material bias definitions
 */
export const MATERIAL_BIASES = {
    metal_scrap: {
        doctrineTagWeights: {
            assault: 1.5,
            suppression: 1.2,
        },
        modTagWeights: {
            damage: 1.3,
            defense: 1.1,
        },
        stabilityModifier: 5, // Metal is reliable
        stabilityRangeShift: { min: 0, max: 10 },
        slotLockChanceModifier: -0.05, // Metal = fewer locks
    },
    chaos_shard: {
        doctrineTagWeights: {
            control: 1.8,
            sustain: 1.3,
        },
        modTagWeights: {
            proc: 1.5,
            utility: 1.2,
        },
        stabilityModifier: -10, // Chaos is volatile
        stabilityRangeShift: { min: -15, max: 5 },
        slotLockChanceModifier: 0.1, // Chaos = more locks
        lockedCardCountModifier: 0.5, // More locked cards
    },
    steam_component: {
        doctrineTagWeights: {
            skirmish: 1.6,
            assault: 1.2,
        },
        modTagWeights: {
            utility: 1.4,
            draw: 1.2,
        },
        stabilityModifier: 0, // Neutral
        stabilityRangeShift: { min: -5, max: 5 },
        slotLockChanceModifier: 0,
    },
    wood: {
        doctrineTagWeights: {
            sustain: 1.4,
            control: 1.1,
        },
        modTagWeights: {
            defense: 1.3,
            shield: 1.2,
        },
        stabilityModifier: 3, // Wood is stable
        stabilityRangeShift: { min: 0, max: 8 },
        slotLockChanceModifier: -0.03,
    },
    crystal: {
        doctrineTagWeights: {
            control: 1.5,
            sustain: 1.3,
        },
        modTagWeights: {
            proc: 1.4,
            resource: 1.3,
        },
        stabilityModifier: -5,
        stabilityRangeShift: { min: -10, max: 0 },
        slotLockChanceModifier: 0.05,
    },
    medic_herb: {
        doctrineTagWeights: {
            sustain: 1.6,
        },
        modTagWeights: {
            defense: 1.2,
            shield: 1.3,
        },
        stabilityModifier: 2,
        stabilityRangeShift: { min: 0, max: 5 },
        slotLockChanceModifier: -0.02,
    },
};
/**
 * Chassis base configurations
 * Maps chassisId -> base config for endless generation
 */
export const CHASSIS_BASE_CONFIGS = {
    // Weapon chassis
    chassis_standard_rifle: {
        baseStabilityRange: { min: 60, max: 80 },
        allowedDoctrineTags: ["assault", "skirmish", "suppression"],
        allowedModTags: ["damage", "proc", "utility"],
        baseSlotLockChance: 0.1,
        maxLockedSlots: 1,
        baseLockedCardCount: 0,
        maxLockedCards: 1,
    },
    chassis_heavy_rifle: {
        baseStabilityRange: { min: 50, max: 75 },
        allowedDoctrineTags: ["assault", "suppression"],
        allowedModTags: ["damage", "defense"],
        baseSlotLockChance: 0.15,
        maxLockedSlots: 2,
        baseLockedCardCount: 0,
        maxLockedCards: 2,
    },
    chassis_light_rifle: {
        baseStabilityRange: { min: 65, max: 85 },
        allowedDoctrineTags: ["skirmish", "assault"],
        allowedModTags: ["utility", "draw", "proc"],
        baseSlotLockChance: 0.05,
        maxLockedSlots: 1,
        baseLockedCardCount: 0,
        maxLockedCards: 1,
    },
    // Helmet chassis
    chassis_standard_helmet: {
        baseStabilityRange: { min: 70, max: 90 },
        allowedDoctrineTags: ["sustain", "control"],
        allowedModTags: ["defense", "shield", "utility"],
        baseSlotLockChance: 0.08,
        maxLockedSlots: 1,
        baseLockedCardCount: 0,
        maxLockedCards: 1,
    },
    // Chestpiece chassis
    chassis_standard_chestplate: {
        baseStabilityRange: { min: 65, max: 85 },
        allowedDoctrineTags: ["sustain", "control", "suppression"],
        allowedModTags: ["defense", "shield"],
        baseSlotLockChance: 0.1,
        maxLockedSlots: 1,
        baseLockedCardCount: 0,
        maxLockedCards: 1,
    },
    // Accessory chassis
    chassis_utility_module: {
        baseStabilityRange: { min: 75, max: 95 },
        allowedDoctrineTags: ["control", "sustain"],
        allowedModTags: ["utility", "resource", "draw"],
        baseSlotLockChance: 0.05,
        maxLockedSlots: 0,
        baseLockedCardCount: 0,
        maxLockedCards: 0,
    },
};
/**
 * Get default chassis config (fallback if specific config not found)
 */
export function getDefaultChassisConfig() {
    return {
        baseStabilityRange: { min: 60, max: 80 },
        baseSlotLockChance: 0.1,
        maxLockedSlots: 1,
        baseLockedCardCount: 0,
        maxLockedCards: 1,
    };
}
/**
 * Get chassis config by ID
 */
export function getChassisConfig(chassisId) {
    return CHASSIS_BASE_CONFIGS[chassisId] || getDefaultChassisConfig();
}

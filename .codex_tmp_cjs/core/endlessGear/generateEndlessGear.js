"use strict";
// ============================================================================
// CHAOS CORE - ENDLESS GEAR GENERATION PIPELINE
// Procedural gear generation with material-based biases
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEndlessGearFromRecipe = generateEndlessGearFromRecipe;
exports.generateEndlessLoot = generateEndlessLoot;
exports.createGenerationContext = createGenerationContext;
exports.explainEndlessGear = explainEndlessGear;
const biasConfig_1 = require("./biasConfig");
const rng_1 = require("../rng");
const gearChassis_1 = require("../../data/gearChassis");
const gearDoctrines_1 = require("../../data/gearDoctrines");
const fieldModDefinitions_1 = require("../fieldModDefinitions");
const gearWorkbench_1 = require("../gearWorkbench");
/**
 * Generate endless gear from a recipe
 */
function generateEndlessGearFromRecipe(recipe, ctx, options) {
    const chassis = (0, gearChassis_1.getChassisById)(recipe.chassisId);
    if (!chassis) {
        throw new Error(`Invalid chassis ID: ${recipe.chassisId}`);
    }
    const allowWeapons = options?.allowWeapons ?? true;
    // Optional caller-level restriction for non-weapon crafting flows
    if (!allowWeapons && chassis.slotType === "weapon") {
        throw new Error(`Cannot generate weapons via endless crafting. Weapons must be built in Gear Builder. Chassis: ${chassis.id}`);
    }
    // Generate or use provided seed
    const seed = recipe.seed ?? (0, rng_1.generateSeed)();
    const rng = (0, rng_1.createSeededRNG)(seed);
    // Load chassis base config
    const chassisConfig = (0, biasConfig_1.getChassisConfig)(recipe.chassisId) || (0, biasConfig_1.getDefaultChassisConfig)();
    // Compute bias report from materials
    const bias = computeBiasReport(recipe.materials, chassis, chassisConfig, rng);
    // Roll doctrine (weighted)
    const doctrine = selectDoctrine(bias, chassis, ctx, rng);
    bias.chosenDoctrine = doctrine.id;
    // Roll 0-2 Field Mods (weighted by mod tag pools)
    const fieldMods = selectFieldMods(bias, chassis, ctx, rng);
    bias.chosenMods = fieldMods.map(m => m.id);
    // Roll stability within biased range
    const stability = Math.max(0, Math.min(100, (0, rng_1.randomInt)(rng, bias.stabilityRange.min, bias.stabilityRange.max)));
    bias.chosenStability = stability;
    // Determine slot locks / locked cards
    const slotLockResult = determineSlotLocks(chassis, chassisConfig, recipe.materials, rng);
    bias.slotsLocked = slotLockResult.slotsLocked;
    bias.slotLockChance = slotLockResult.slotLockChance;
    const lockedCards = selectLockedCards(chassis, ctx, slotLockResult.lockedCardCount, rng);
    bias.lockedCards = lockedCards;
    bias.lockedCardCount = lockedCards.length;
    // Create equipment object
    const equipment = createEquipmentFromGeneration(chassis, doctrine, stability, fieldMods, lockedCards, slotLockResult.slotsLocked, seed);
    // Add provenance
    const generatedGear = {
        ...equipment,
        provenance: {
            kind: "endless_crafted",
            recipe,
            seed,
            bias,
        },
        fieldMods: fieldMods.map(m => m.id),
        lockedCards,
    };
    return generatedGear;
}
/**
 * Generate endless loot (without explicit recipe)
 */
function generateEndlessLoot(ctx, params = {}) {
    const seed = params.seed ?? (0, rng_1.generateSeed)();
    const rng = (0, rng_1.createSeededRNG)(seed);
    // Select random chassis (filtered by slot type if provided)
    const availableChassis = ctx.chassisRegistry.filter(c => !params.slotType || c.slotType === params.slotType);
    if (availableChassis.length === 0) {
        throw new Error("No chassis available for loot generation");
    }
    const chassis = availableChassis[(0, rng_1.randomInt)(rng, 0, availableChassis.length - 1)];
    // Generate random materials (3-5 materials)
    const materialCount = (0, rng_1.randomInt)(rng, 3, 5);
    const allMaterials = [
        "metal_scrap",
        "chaos_shard",
        "steam_component",
        "wood",
    ];
    const materials = Array.from({ length: materialCount }, () => allMaterials[(0, rng_1.randomInt)(rng, 0, allMaterials.length - 1)]);
    // Create recipe
    const recipe = {
        chassisId: chassis.id,
        materials,
        seed,
    };
    // Generate gear using recipe
    const gear = generateEndlessGearFromRecipe(recipe, ctx, { allowWeapons: true });
    // Update provenance to indicate loot
    gear.provenance.kind = "endless_loot";
    return gear;
}
/**
 * Compute bias report from materials
 */
function computeBiasReport(materials, chassis, chassisConfig, rng) {
    // Start with chassis base stability range
    let stabilityMin = chassisConfig.baseStabilityRange.min;
    let stabilityMax = chassisConfig.baseStabilityRange.max;
    let stabilityModifier = 0;
    // Aggregate doctrine tag weights (start with 1.0 for all)
    const doctrineWeights = {};
    for (const doctrine of gearDoctrines_1.ALL_DOCTRINES) {
        doctrineWeights[doctrine.id] = 1.0;
    }
    // Aggregate mod tag weights
    const modTagWeights = {};
    // Apply material biases
    for (const material of materials) {
        const bias = biasConfig_1.MATERIAL_BIASES[material];
        if (!bias)
            continue;
        // Apply doctrine tag weights
        for (const [tag, weight] of Object.entries(bias.doctrineTagWeights || {})) {
            for (const doctrine of gearDoctrines_1.ALL_DOCTRINES) {
                if (doctrine.intentTags.includes(tag)) {
                    doctrineWeights[doctrine.id] = (doctrineWeights[doctrine.id] || 1.0) * weight;
                }
            }
        }
        // Apply mod tag weights
        for (const [tag, weight] of Object.entries(bias.modTagWeights || {})) {
            if (weight === undefined) {
                continue;
            }
            modTagWeights[tag] = (modTagWeights[tag] || 1.0) * weight;
        }
        // Apply stability modifiers
        stabilityModifier += bias.stabilityModifier;
        if (bias.stabilityRangeShift) {
            stabilityMin += bias.stabilityRangeShift.min || 0;
            stabilityMax += bias.stabilityRangeShift.max || 0;
        }
    }
    // Apply stability modifier to range
    stabilityMin = Math.max(0, Math.min(100, stabilityMin + stabilityModifier));
    stabilityMax = Math.max(0, Math.min(100, stabilityMax + stabilityModifier));
    // Filter doctrine weights by chassis allowed tags
    if (chassisConfig.allowedDoctrineTags && chassisConfig.allowedDoctrineTags.length > 0) {
        for (const doctrineId of Object.keys(doctrineWeights)) {
            const doctrine = (0, gearDoctrines_1.getDoctrineById)(doctrineId);
            if (!doctrine)
                continue;
            const hasAllowedTag = doctrine.intentTags.some(tag => chassisConfig.allowedDoctrineTags.includes(tag));
            if (!hasAllowedTag) {
                doctrineWeights[doctrineId] = 0; // Exclude
            }
        }
    }
    return {
        doctrineWeights,
        modTagWeights,
        stabilityRange: { min: stabilityMin, max: stabilityMax },
        stabilityModifier,
        chosenMods: [],
        chosenStability: 0,
        lockedCardCount: 0,
        lockedCards: [],
        slotLockChance: chassisConfig.baseSlotLockChance || 0.1,
        slotsLocked: 0,
    };
}
/**
 * Select doctrine based on weights
 */
function selectDoctrine(bias, chassis, ctx, rng) {
    // Filter doctrines by chassis compatibility
    const compatibleDoctrines = ctx.doctrineRegistry.filter(d => {
        // Check if chassis has fixed doctrine (future feature)
        // For now, all doctrines are compatible
        // Check if doctrine has any weight
        return (bias.doctrineWeights[d.id] || 0) > 0;
    });
    if (compatibleDoctrines.length === 0) {
        // Fallback: use balanced doctrine
        const balanced = ctx.doctrineRegistry.find(d => d.id === "doctrine_balanced");
        if (balanced)
            return balanced;
        // Last resort: first available
        return ctx.doctrineRegistry[0];
    }
    const weights = compatibleDoctrines.map(d => bias.doctrineWeights[d.id] || 0);
    const selectedIndex = (0, rng_1.weightedRandom)(rng, compatibleDoctrines, weights);
    return compatibleDoctrines[selectedIndex];
}
/**
 * Select 0-2 field mods based on tag weights
 */
function selectFieldMods(bias, chassis, ctx, rng) {
    // Determine how many mods (0-2, weighted toward 1)
    const modCountRoll = rng();
    let modCount = 0;
    if (modCountRoll < 0.3)
        modCount = 0;
    else if (modCountRoll < 0.8)
        modCount = 1;
    else
        modCount = 2;
    if (modCount === 0)
        return [];
    // Get all available mods
    const allMods = (0, fieldModDefinitions_1.getAllFieldModDefs)();
    // Filter by chassis allowed tags (if any)
    let compatibleMods = allMods;
    const chassisConfig = (0, biasConfig_1.getChassisConfig)(chassis.id);
    if (chassisConfig?.allowedModTags && chassisConfig.allowedModTags.length > 0) {
        compatibleMods = allMods.filter(mod => mod.tags?.some(tag => chassisConfig.allowedModTags.includes(tag)));
    }
    // If no compatible mods, use all mods
    if (compatibleMods.length === 0) {
        compatibleMods = allMods;
    }
    // Calculate weights for each mod based on tag weights
    const modWeights = compatibleMods.map(mod => {
        let weight = 1.0;
        for (const tag of mod.tags || []) {
            weight *= (bias.modTagWeights[tag] || 1.0);
        }
        return weight;
    });
    // Select mods (no duplicates)
    const selected = [];
    const available = [...compatibleMods];
    const availableWeights = [...modWeights];
    for (let i = 0; i < modCount && available.length > 0; i++) {
        const index = (0, rng_1.weightedRandom)(rng, available, availableWeights);
        selected.push(available[index]);
        available.splice(index, 1);
        availableWeights.splice(index, 1);
    }
    return selected;
}
/**
 * Determine slot locks based on chassis and materials
 */
function determineSlotLocks(chassis, chassisConfig, materials, rng) {
    // Calculate base slot lock chance
    let slotLockChance = chassisConfig.baseSlotLockChance || 0.1;
    // Apply material modifiers
    for (const material of materials) {
        const bias = biasConfig_1.MATERIAL_BIASES[material];
        if (bias?.slotLockChanceModifier) {
            slotLockChance += bias.slotLockChanceModifier;
        }
    }
    slotLockChance = Math.max(0, Math.min(1, slotLockChance));
    // Determine locked card count
    let lockedCardCount = chassisConfig.baseLockedCardCount || 0;
    for (const material of materials) {
        const bias = biasConfig_1.MATERIAL_BIASES[material];
        if (bias?.lockedCardCountModifier) {
            lockedCardCount += bias.lockedCardCountModifier;
        }
    }
    lockedCardCount = Math.max(0, Math.min(chassisConfig.maxLockedCards || 2, Math.round(lockedCardCount)));
    // Determine slots locked
    let slotsLocked = 0;
    const maxSlots = chassis.maxCardSlots;
    const maxLocked = chassisConfig.maxLockedSlots || 1;
    for (let i = 0; i < maxSlots && slotsLocked < maxLocked; i++) {
        if (rng() < slotLockChance) {
            slotsLocked++;
        }
    }
    return { slotsLocked, slotLockChance, lockedCardCount };
}
/**
 * Select locked cards from available card catalog
 */
function selectLockedCards(chassis, ctx, count, rng) {
    if (count === 0)
        return [];
    // Get all available card IDs
    const allCardIds = Object.keys(gearWorkbench_1.LIBRARY_CARD_DATABASE);
    // Filter by chassis restrictions if any (future feature)
    // For now, all cards are available
    if (allCardIds.length === 0)
        return [];
    // Select random cards (no duplicates)
    const selected = [];
    const available = [...allCardIds];
    for (let i = 0; i < count && available.length > 0; i++) {
        const index = (0, rng_1.randomInt)(rng, 0, available.length - 1);
        selected.push(available[index]);
        available.splice(index, 1);
    }
    return selected;
}
/**
 * Create equipment object from generation results
 */
function createEquipmentFromGeneration(chassis, doctrine, stability, fieldMods, lockedCards, slotsLocked, seed) {
    const equipmentId = `endless_${chassis.slotType}_${chassis.id}_${doctrine.id}_${seed}`;
    const equipmentName = `${doctrine.name} ${chassis.name}`;
    // Base stats (similar to gear builder)
    const baseStats = {
        atk: chassis.slotType === "weapon" ? 5 : 0,
        def: (chassis.slotType === "helmet" || chassis.slotType === "chestpiece") ? 3 : 0,
        agi: chassis.slotType === "accessory" ? 2 : 0,
        acc: 80,
        hp: 0,
    };
    // Create equipment based on slot type
    if (chassis.slotType === "weapon") {
        return {
            id: equipmentId,
            name: equipmentName,
            slot: "weapon",
            weaponType: "sword", // Default
            isMechanical: true,
            stats: baseStats,
            cardsGranted: [], // Empty - will be filled by slotting
            wear: 100,
            chassisId: chassis.id,
            doctrineId: doctrine.id,
            stability,
            builderVersion: 2, // Version 2 = endless gear
        };
    }
    else if (chassis.slotType === "helmet" || chassis.slotType === "chestpiece") {
        return {
            id: equipmentId,
            name: equipmentName,
            slot: chassis.slotType,
            stats: baseStats,
            cardsGranted: [],
            chassisId: chassis.id,
            doctrineId: doctrine.id,
            stability,
            builderVersion: 2,
        };
    }
    else {
        return {
            id: equipmentId,
            name: equipmentName,
            slot: "accessory",
            stats: baseStats,
            cardsGranted: [],
            chassisId: chassis.id,
            doctrineId: doctrine.id,
            stability,
            builderVersion: 2,
        };
    }
}
/**
 * Create generation context from game state
 */
function createGenerationContext() {
    return {
        chassisRegistry: gearChassis_1.ALL_CHASSIS,
        doctrineRegistry: gearDoctrines_1.ALL_DOCTRINES,
        fieldModRegistry: (0, fieldModDefinitions_1.getAllFieldModDefs)(),
        cardCatalog: Object.keys(gearWorkbench_1.LIBRARY_CARD_DATABASE),
    };
}
/**
 * Debug function: explain endless gear generation
 */
function explainEndlessGear(gear) {
    const bias = gear.provenance.bias;
    const lines = [];
    lines.push(`=== ENDLESS GEAR EXPLANATION ===`);
    lines.push(`ID: ${gear.id}`);
    lines.push(`Name: ${gear.name}`);
    lines.push(`Seed: ${gear.provenance.seed}`);
    lines.push(``);
    lines.push(`=== BIAS REPORT ===`);
    lines.push(`Stability Range: ${bias.stabilityRange.min}-${bias.stabilityRange.max}`);
    lines.push(`Stability Modifier: ${bias.stabilityModifier > 0 ? '+' : ''}${bias.stabilityModifier}`);
    lines.push(`Final Stability: ${bias.chosenStability}`);
    lines.push(``);
    lines.push(`Chosen Doctrine: ${bias.chosenDoctrine || 'N/A'}`);
    lines.push(`Doctrine Weights:`);
    for (const [id, weight] of Object.entries(bias.doctrineWeights)) {
        if (weight > 0) {
            lines.push(`  ${id}: ${weight.toFixed(2)}`);
        }
    }
    lines.push(``);
    lines.push(`Chosen Field Mods: ${bias.chosenMods.join(', ') || 'None'}`);
    lines.push(`Mod Tag Weights:`);
    for (const [tag, weight] of Object.entries(bias.modTagWeights)) {
        if (weight > 1.0) {
            lines.push(`  ${tag}: ${weight.toFixed(2)}x`);
        }
    }
    lines.push(``);
    lines.push(`Slot Lock Chance: ${(bias.slotLockChance * 100).toFixed(1)}%`);
    lines.push(`Slots Locked: ${bias.slotsLocked}`);
    lines.push(`Locked Cards: ${bias.lockedCards.join(', ') || 'None'}`);
    return lines.join('\n');
}

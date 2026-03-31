// ============================================================================
// CHAOS CORE - ENDLESS GEAR GENERATION PIPELINE
// Procedural gear generation with material-based biases
// ============================================================================

import { 
  EndlessRecipe, 
  GeneratedGear, 
  GenerationContext, 
  BiasReport,
  EndlessLootParams 
} from "./types";
import { MATERIAL_BIASES, getChassisConfig, getDefaultChassisConfig } from "./biasConfig";
import { createSeededRNG, generateSeed, deriveSeed, weightedRandom, randomInt } from "../rng";
import { GearChassis, getChassisById, ALL_CHASSIS } from "../../data/gearChassis";
import { GearDoctrine, getDoctrineById, ALL_DOCTRINES } from "../../data/gearDoctrines";
import { FIELD_MOD_DEFINITIONS, getAllFieldModDefs } from "../fieldModDefinitions";
import { FieldModDef } from "../fieldMods";
import { Equipment, WeaponEquipment, ArmorEquipment, AccessoryEquipment } from "../equipment";
import { LIBRARY_CARD_DATABASE } from "../gearWorkbench";

/**
 * Generate endless gear from a recipe
 */
export function generateEndlessGearFromRecipe(
  recipe: EndlessRecipe,
  ctx: GenerationContext,
  options?: { allowWeapons?: boolean } // For crafting context, set allowWeapons=false
): GeneratedGear {
  const chassis = getChassisById(recipe.chassisId);
  if (!chassis) {
    throw new Error(`Invalid chassis ID: ${recipe.chassisId}`);
  }
  
  // Prevent weapon generation in crafting context (weapons are built in Gear Builder)
  if (!options?.allowWeapons && chassis.slotType === "weapon") {
    throw new Error(`Cannot generate weapons via endless crafting. Weapons must be built in Gear Builder. Chassis: ${chassis.id}`);
  }
  
  // Generate or use provided seed
  const seed = recipe.seed ?? generateSeed();
  const rng = createSeededRNG(seed);
  
  // Load chassis base config
  const chassisConfig = getChassisConfig(recipe.chassisId) || getDefaultChassisConfig();
  
  // Compute bias report from materials
  const bias = computeBiasReport(recipe.materials, chassis, chassisConfig, rng);
  
  // Roll doctrine (weighted)
  const doctrine = selectDoctrine(bias, chassis, ctx, rng);
  bias.chosenDoctrine = doctrine.id;
  
  // Roll 0-2 Field Mods (weighted by mod tag pools)
  const fieldMods = selectFieldMods(bias, chassis, ctx, rng);
  bias.chosenMods = fieldMods.map(m => m.id);
  
  // Roll stability within biased range
  const stability = Math.max(0, Math.min(100, 
    randomInt(rng, bias.stabilityRange.min, bias.stabilityRange.max)
  ));
  bias.chosenStability = stability;
  
  // Determine slot locks / locked cards
  const slotLockResult = determineSlotLocks(chassis, chassisConfig, recipe.materials, rng);
  bias.slotsLocked = slotLockResult.slotsLocked;
  bias.slotLockChance = slotLockResult.slotLockChance;
  
  const lockedCards = selectLockedCards(
    chassis, 
    ctx, 
    slotLockResult.lockedCardCount, 
    rng
  );
  bias.lockedCards = lockedCards;
  bias.lockedCardCount = lockedCards.length;
  
  // Create equipment object
  const equipment = createEquipmentFromGeneration(
    chassis,
    doctrine,
    stability,
    fieldMods,
    lockedCards,
    slotLockResult.slotsLocked
  );
  
  // Add provenance
  const generatedGear: GeneratedGear = {
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
export function generateEndlessLoot(
  ctx: GenerationContext,
  params: EndlessLootParams = {}
): GeneratedGear {
  const seed = params.seed ?? generateSeed();
  const rng = createSeededRNG(seed);
  
  // Select random chassis (filtered by slot type if provided)
  const availableChassis = ctx.chassisRegistry.filter(c => 
    !params.slotType || c.slotType === params.slotType
  );
  
  if (availableChassis.length === 0) {
    throw new Error("No chassis available for loot generation");
  }
  
  const chassis = availableChassis[randomInt(rng, 0, availableChassis.length - 1)];
  
  // Generate random materials (3-5 materials)
  const materialCount = randomInt(rng, 3, 5);
  const allMaterials: Array<keyof typeof MATERIAL_BIASES> = [
    "metal_scrap",
    "chaos_shard", 
    "steam_component",
    "wood",
  ];
  const materials = Array.from({ length: materialCount }, () => 
    allMaterials[randomInt(rng, 0, allMaterials.length - 1)]
  );
  
  // Create recipe
  const recipe: EndlessRecipe = {
    chassisId: chassis.id,
    materials,
    seed,
  };
  
  // Generate gear using recipe
  const gear = generateEndlessGearFromRecipe(recipe, ctx);
  
  // Update provenance to indicate loot
  gear.provenance.kind = "endless_loot";
  
  return gear;
}

/**
 * Compute bias report from materials
 */
function computeBiasReport(
  materials: EndlessRecipe["materials"],
  chassis: GearChassis,
  chassisConfig: ReturnType<typeof getChassisConfig>,
  rng: () => number
): BiasReport {
  // Start with chassis base stability range
  let stabilityMin = chassisConfig.baseStabilityRange.min;
  let stabilityMax = chassisConfig.baseStabilityRange.max;
  let stabilityModifier = 0;
  
  // Aggregate doctrine tag weights (start with 1.0 for all)
  const doctrineWeights: Record<string, number> = {};
  for (const doctrine of ALL_DOCTRINES) {
    doctrineWeights[doctrine.id] = 1.0;
  }
  
  // Aggregate mod tag weights
  const modTagWeights: Record<string, number> = {};
  
  // Apply material biases
  for (const material of materials) {
    const bias = MATERIAL_BIASES[material];
    if (!bias) continue;
    
    // Apply doctrine tag weights
    for (const [tag, weight] of Object.entries(bias.doctrineTagWeights || {})) {
      for (const doctrine of ALL_DOCTRINES) {
        if (doctrine.intentTags.includes(tag as any)) {
          doctrineWeights[doctrine.id] = (doctrineWeights[doctrine.id] || 1.0) * weight;
        }
      }
    }
    
    // Apply mod tag weights
    for (const [tag, weight] of Object.entries(bias.modTagWeights || {})) {
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
      const doctrine = getDoctrineById(doctrineId);
      if (!doctrine) continue;
      
      const hasAllowedTag = doctrine.intentTags.some(tag => 
        chassisConfig.allowedDoctrineTags!.includes(tag)
      );
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
function selectDoctrine(
  bias: BiasReport,
  chassis: GearChassis,
  ctx: GenerationContext,
  rng: () => number
): GearDoctrine {
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
    if (balanced) return balanced;
    
    // Last resort: first available
    return ctx.doctrineRegistry[0];
  }
  
  const weights = compatibleDoctrines.map(d => bias.doctrineWeights[d.id] || 0);
  const selectedIndex = weightedRandom(rng, compatibleDoctrines, weights);
  
  return compatibleDoctrines[selectedIndex];
}

/**
 * Select 0-2 field mods based on tag weights
 */
function selectFieldMods(
  bias: BiasReport,
  chassis: GearChassis,
  ctx: GenerationContext,
  rng: () => number
): FieldModDef[] {
  // Determine how many mods (0-2, weighted toward 1)
  const modCountRoll = rng();
  let modCount = 0;
  if (modCountRoll < 0.3) modCount = 0;
  else if (modCountRoll < 0.8) modCount = 1;
  else modCount = 2;
  
  if (modCount === 0) return [];
  
  // Get all available mods
  const allMods = getAllFieldModDefs();
  
  // Filter by chassis allowed tags (if any)
  let compatibleMods = allMods;
  const chassisConfig = getChassisConfig(chassis.id);
  if (chassisConfig?.allowedModTags && chassisConfig.allowedModTags.length > 0) {
    compatibleMods = allMods.filter(mod => 
      mod.tags?.some(tag => chassisConfig.allowedModTags!.includes(tag))
    );
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
  const selected: FieldModDef[] = [];
  const available = [...compatibleMods];
  const availableWeights = [...modWeights];
  
  for (let i = 0; i < modCount && available.length > 0; i++) {
    const index = weightedRandom(rng, available, availableWeights);
    selected.push(available[index]);
    available.splice(index, 1);
    availableWeights.splice(index, 1);
  }
  
  return selected;
}

/**
 * Determine slot locks based on chassis and materials
 */
function determineSlotLocks(
  chassis: GearChassis,
  chassisConfig: ReturnType<typeof getChassisConfig>,
  materials: EndlessRecipe["materials"],
  rng: () => number
): { slotsLocked: number; slotLockChance: number; lockedCardCount: number } {
  // Calculate base slot lock chance
  let slotLockChance = chassisConfig.baseSlotLockChance || 0.1;
  
  // Apply material modifiers
  for (const material of materials) {
    const bias = MATERIAL_BIASES[material];
    if (bias?.slotLockChanceModifier) {
      slotLockChance += bias.slotLockChanceModifier;
    }
  }
  
  slotLockChance = Math.max(0, Math.min(1, slotLockChance));
  
  // Determine locked card count
  let lockedCardCount = chassisConfig.baseLockedCardCount || 0;
  
  for (const material of materials) {
    const bias = MATERIAL_BIASES[material];
    if (bias?.lockedCardCountModifier) {
      lockedCardCount += bias.lockedCardCountModifier;
    }
  }
  
  lockedCardCount = Math.max(0, Math.min(
    chassisConfig.maxLockedCards || 2,
    Math.round(lockedCardCount)
  ));
  
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
function selectLockedCards(
  chassis: GearChassis,
  ctx: GenerationContext,
  count: number,
  rng: () => number
): string[] {
  if (count === 0) return [];
  
  // Get all available card IDs
  const allCardIds = Object.keys(LIBRARY_CARD_DATABASE);
  
  // Filter by chassis restrictions if any (future feature)
  // For now, all cards are available
  
  if (allCardIds.length === 0) return [];
  
  // Select random cards (no duplicates)
  const selected: string[] = [];
  const available = [...allCardIds];
  
  for (let i = 0; i < count && available.length > 0; i++) {
    const index = randomInt(rng, 0, available.length - 1);
    selected.push(available[index]);
    available.splice(index, 1);
  }
  
  return selected;
}

/**
 * Create equipment object from generation results
 */
function createEquipmentFromGeneration(
  chassis: GearChassis,
  doctrine: GearDoctrine,
  stability: number,
  fieldMods: FieldModDef[],
  lockedCards: string[],
  slotsLocked: number
): Equipment {
  const equipmentId = `endless_${chassis.slotType}_${chassis.id}_${doctrine.id}_${Date.now()}`;
  const equipmentName = `[Endless] ${doctrine.name} ${chassis.name}`;
  
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
      moduleSlots: 0,
      attachedModules: [],
      wear: 100,
      chassisId: chassis.id,
      doctrineId: doctrine.id,
      stability,
      builderVersion: 2, // Version 2 = endless gear
    } as WeaponEquipment;
  } else if (chassis.slotType === "helmet" || chassis.slotType === "chestpiece") {
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
    } as ArmorEquipment;
  } else {
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
    } as AccessoryEquipment;
  }
}

/**
 * Create generation context from game state
 */
export function createGenerationContext(): GenerationContext {
  return {
    chassisRegistry: ALL_CHASSIS,
    doctrineRegistry: ALL_DOCTRINES,
    fieldModRegistry: getAllFieldModDefs(),
    cardCatalog: Object.keys(LIBRARY_CARD_DATABASE),
  };
}

/**
 * Debug function: explain endless gear generation
 */
export function explainEndlessGear(gear: GeneratedGear): string {
  const bias = gear.provenance.bias;
  const lines: string[] = [];
  
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


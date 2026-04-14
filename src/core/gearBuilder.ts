// ============================================================================
// CHAOS CORE - GEAR BUILDER SYSTEM
// Logic for building new gear from chassis + doctrine
// ============================================================================

import { Equipment, WeaponEquipment, ArmorEquipment, AccessoryEquipment, type WeaponType } from "./equipment";
import { GearSlotData } from "./gearWorkbench";
import { type GearChassis } from "../data/gearChassis";
import { getChassisById, getDoctrineById } from "./gearCatalog";
import { GameState } from "./types";
import { createSeededRNG, generateSeed, randomInt } from "./rng";
import { createGenerationContext, generateEndlessGearFromRecipe } from "./endlessGear/generateEndlessGear";
import { CraftingMaterialId } from "./endlessGear/types";
import { getLocalSessionPlayerSlot, getSessionResourcePool } from "./session";
import {
  addResourceWallet,
  createEmptyResourceWallet,
  hasEnoughResources,
  type ResourceWallet,
} from "./resources";
import { type GearBalanceReport, validateGearBalance } from "./gearBalanceValidation";
import {
  getCraftedGearBaseStats,
  getCraftedGearDescription,
  getDefaultCraftedWeaponShape,
  rollChaoticCraftedGearStats,
} from "./craftedGear";

export interface BuildGearResult {
  success: boolean;
  error?: string;
  equipment?: Equipment;
  gearSlots?: GearSlotData;
  validationReport?: GearBalanceReport;
}

const CHAOTIC_BUILD_SURCHARGE: ResourceWallet = createEmptyResourceWallet({
  chaosShards: 2,
  steamComponents: 2,
});

const CHAOTIC_MATERIAL_POOL: CraftingMaterialId[] = [
  "metal_scrap",
  "wood",
  "chaos_shard",
  "steam_component",
];

/**
 * Build a new piece of gear from chassis and doctrine
 */
export function buildGear(
  chassisId: string,
  doctrineId: string,
  state: GameState,
  customName?: string,
  weaponType?: WeaponType,
): BuildGearResult {
  const chassis = getChassisById(chassisId);
  const doctrine = getDoctrineById(doctrineId);

  if (!chassis) {
    return { success: false, error: "Invalid chassis ID" };
  }

  if (!doctrine) {
    return { success: false, error: "Invalid doctrine ID" };
  }

  const totalCost = getBuildCost(chassisId, doctrineId);
  if (!totalCost) {
    return { success: false, error: "Invalid build cost" };
  }

  if (!hasRequiredResources(totalCost, state)) {
    return { success: false, error: "Insufficient materials" };
  }

  const finalStability = Math.max(0, Math.min(100, chassis.baseStability + doctrine.stabilityModifier));
  const equipmentId = `built_${chassis.slotType}_${chassisId}_${doctrineId}_${Date.now()}`;
  const equipmentName = customName?.trim() || `${doctrine.name} ${chassis.name}`;

  const equipment = createEquipment(
    chassis,
    equipmentId,
    equipmentName,
    doctrine.id,
    finalStability,
    getCraftedGearBaseStats(chassis.slotType),
    1,
    weaponType,
    getCraftedGearDescription(chassis.name, doctrine.name),
  );
  const validationReport = validateBuiltGear(equipment, chassis.maxCardSlots);
  if (validationReport.status === "fail") {
    return {
      success: false,
      error: `Balance check failed. ${validationReport.summary}`,
      validationReport,
    };
  }

  return {
    success: true,
    equipment,
    gearSlots: {
      lockedCards: [],
      freeSlots: chassis.maxCardSlots,
      slottedCards: [],
    },
    validationReport,
  };
}

export function previewBuildGear(
  chassisId: string,
  doctrineId: string,
  customName?: string,
  weaponType?: WeaponType,
): Equipment | null {
  const chassis = getChassisById(chassisId);
  const doctrine = getDoctrineById(doctrineId);

  if (!chassis || !doctrine) {
    return null;
  }

  const finalStability = Math.max(0, Math.min(100, chassis.baseStability + doctrine.stabilityModifier));
  const equipmentId = `preview_${chassis.slotType}_${chassisId}_${doctrineId}`;
  const equipmentName = customName?.trim() || `${doctrine.name} ${chassis.name}`;

  return createEquipment(
    chassis,
    equipmentId,
    equipmentName,
    doctrine.id,
    finalStability,
    getCraftedGearBaseStats(chassis.slotType),
    1,
    weaponType,
    getCraftedGearDescription(chassis.name, doctrine.name),
  );
}

/**
 * Build a chaotic gear piece without a doctrine choice.
 * Stability, field mods, locked cards, and slot availability are procedurally rolled.
 */
export function buildChaoticGear(
  chassisId: string,
  state: GameState,
  customName?: string,
  weaponType?: WeaponType,
): BuildGearResult {
  const chassis = getChassisById(chassisId);
  if (!chassis) {
    return { success: false, error: "Invalid chassis ID" };
  }

  const totalCost = getChaoticBuildCost(chassisId);
  if (!totalCost) {
    return { success: false, error: "Invalid build cost" };
  }

  if (!hasRequiredResources(totalCost, state)) {
    return { success: false, error: "Insufficient materials" };
  }

  const seed = generateSeed();
  const rng = createSeededRNG(seed);
  const materialCount = randomInt(rng, 3, 5);
  const materials = Array.from({ length: materialCount }, () => {
    return CHAOTIC_MATERIAL_POOL[randomInt(rng, 0, CHAOTIC_MATERIAL_POOL.length - 1)];
  });

  const generatedGear = generateEndlessGearFromRecipe(
    {
      chassisId,
      materials,
      seed,
    },
    createGenerationContext(),
    { allowWeapons: true }
  ) as unknown as Equipment & {
    provenance?: { bias?: { slotsLocked?: number } };
    lockedCards?: string[];
    builderVersion?: number;
  };

  generatedGear.name = customName?.trim() || `Unbound ${chassis.name}`;
  generatedGear.stats = rollChaoticCraftedGearStats(chassis.slotType, rng);
  generatedGear.builderVersion = 3;
  generatedGear.description = getCraftedGearDescription(chassis.name);
  if (generatedGear.slot === "weapon") {
    generatedGear.weaponType = weaponType ?? getDefaultCraftedWeaponShape();
  }

  const slotsLocked = generatedGear.provenance?.bias?.slotsLocked ?? 0;
  const freeSlots = Math.max(0, chassis.maxCardSlots - slotsLocked);
  const validationReport = validateBuiltGear({
    ...generatedGear,
    cardsGranted: [...(generatedGear.cardsGranted ?? []), ...(generatedGear.lockedCards ?? [])],
  }, freeSlots);
  if (validationReport.status === "fail") {
    return {
      success: false,
      error: `Balance check failed. ${validationReport.summary}`,
      validationReport,
    };
  }

  return {
    success: true,
    equipment: generatedGear,
    gearSlots: {
      lockedCards: generatedGear.lockedCards ?? [],
      freeSlots,
      slottedCards: [],
    },
    validationReport,
  };
}

/**
 * Get build cost for chassis + doctrine combination
 */
export function getBuildCost(chassisId: string, doctrineId: string): ResourceWallet | null {
  const chassis = getChassisById(chassisId);
  const doctrine = getDoctrineById(doctrineId);

  if (!chassis || !doctrine) {
    return null;
  }

  return addResourceWallet(chassis.buildCost, doctrine.buildCostModifier);
}

export function getChaoticBuildCost(chassisId: string): ResourceWallet | null {
  const chassis = getChassisById(chassisId);
  if (!chassis) {
    return null;
  }

  return addResourceWallet(chassis.buildCost, CHAOTIC_BUILD_SURCHARGE);
}

/**
 * Check if player has required materials
 */
export function canAffordBuild(chassisId: string, doctrineId: string, state: GameState): boolean {
  const cost = getBuildCost(chassisId, doctrineId);
  return cost ? hasRequiredResources(cost, state) : false;
}

export function canAffordChaoticBuild(chassisId: string, state: GameState): boolean {
  const cost = getChaoticBuildCost(chassisId);
  return cost ? hasRequiredResources(cost, state) : false;
}

function hasRequiredResources(cost: ResourceWallet, state: GameState): boolean {
  const resources = getSessionResourcePool(state, getLocalSessionPlayerSlot(state)).resources;
  return hasEnoughResources(resources, cost);
}

function createEquipment(
  chassis: GearChassis,
  equipmentId: string,
  equipmentName: string,
  doctrineId: string | undefined,
  stability: number,
  stats: WeaponEquipment["stats"] | ArmorEquipment["stats"] | AccessoryEquipment["stats"],
  builderVersion: number,
  weaponType: WeaponType | undefined,
  description: string,
): Equipment {
  if (chassis.slotType === "weapon") {
    return {
      id: equipmentId,
      name: equipmentName,
      description,
      slot: "weapon",
      weaponType: weaponType ?? getDefaultCraftedWeaponShape(),
      isMechanical: true,
      stats,
      cardsGranted: [],
      wear: 100,
      chassisId: chassis.id,
      doctrineId,
      stability,
      builderVersion,
    } as WeaponEquipment;
  }

  if (chassis.slotType === "helmet" || chassis.slotType === "chestpiece") {
    return {
      id: equipmentId,
      name: equipmentName,
      description,
      slot: chassis.slotType,
      stats,
      cardsGranted: [],
      chassisId: chassis.id,
      doctrineId,
      stability,
      builderVersion,
    } as ArmorEquipment;
  }

  return {
    id: equipmentId,
    name: equipmentName,
    description,
    slot: "accessory",
    stats,
    cardsGranted: [],
    chassisId: chassis.id,
    doctrineId,
    stability,
    builderVersion,
  } as AccessoryEquipment;
}

function validateBuiltGear(equipment: Equipment, slotCapacity: number): GearBalanceReport {
  return validateGearBalance({
    ...equipment,
    cardsGranted: [...(equipment.cardsGranted ?? [])],
    validationSlotCapacity: slotCapacity,
  });
}


// ============================================================================
// CHAOS CORE - GEAR BUILDER SYSTEM
// Logic for building new gear from chassis + doctrine
// ============================================================================

import { Equipment, EquipmentStats, WeaponEquipment, ArmorEquipment, AccessoryEquipment } from "./equipment";
import { GearSlotData } from "./gearWorkbench";
import { GearChassis, getChassisById } from "../data/gearChassis";
import { getDoctrineById } from "../data/gearDoctrines";
import { GameState } from "./types";
import { createSeededRNG, generateSeed, randomInt } from "./rng";
import { createGenerationContext, generateEndlessGearFromRecipe } from "./endlessGear/generateEndlessGear";
import { CraftingMaterialId } from "./endlessGear/types";
import { getLocalSessionPlayerSlot, getSessionResourcePool } from "./session";

interface BuildCost {
  metalScrap: number;
  wood: number;
  chaosShards: number;
  steamComponents: number;
}

export interface BuildGearResult {
  success: boolean;
  error?: string;
  equipment?: Equipment;
  gearSlots?: GearSlotData;
}

const CHAOTIC_BUILD_SURCHARGE: BuildCost = {
  metalScrap: 0,
  wood: 0,
  chaosShards: 2,
  steamComponents: 2,
};

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
    createBaseStats(chassis),
    1
  );

  return {
    success: true,
    equipment,
    gearSlots: {
      lockedCards: [],
      freeSlots: chassis.maxCardSlots,
      slottedCards: [],
    },
  };
}

/**
 * Build a chaotic gear piece without a doctrine choice.
 * Stability, field mods, locked cards, and slot availability are procedurally rolled.
 */
export function buildChaoticGear(
  chassisId: string,
  state: GameState,
  customName?: string,
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
  generatedGear.stats = createChaoticStats(chassis, rng);
  generatedGear.builderVersion = 3;

  const slotsLocked = generatedGear.provenance?.bias?.slotsLocked ?? 0;

  return {
    success: true,
    equipment: generatedGear,
    gearSlots: {
      lockedCards: generatedGear.lockedCards ?? [],
      freeSlots: Math.max(0, chassis.maxCardSlots - slotsLocked),
      slottedCards: [],
    },
  };
}

/**
 * Get build cost for chassis + doctrine combination
 */
export function getBuildCost(chassisId: string, doctrineId: string): BuildCost | null {
  const chassis = getChassisById(chassisId);
  const doctrine = getDoctrineById(doctrineId);

  if (!chassis || !doctrine) {
    return null;
  }

  return {
    metalScrap: chassis.buildCost.metalScrap + doctrine.buildCostModifier.metalScrap,
    wood: chassis.buildCost.wood + doctrine.buildCostModifier.wood,
    chaosShards: chassis.buildCost.chaosShards + doctrine.buildCostModifier.chaosShards,
    steamComponents: chassis.buildCost.steamComponents + doctrine.buildCostModifier.steamComponents,
  };
}

export function getChaoticBuildCost(chassisId: string): BuildCost | null {
  const chassis = getChassisById(chassisId);
  if (!chassis) {
    return null;
  }

  return {
    metalScrap: chassis.buildCost.metalScrap + CHAOTIC_BUILD_SURCHARGE.metalScrap,
    wood: chassis.buildCost.wood + CHAOTIC_BUILD_SURCHARGE.wood,
    chaosShards: chassis.buildCost.chaosShards + CHAOTIC_BUILD_SURCHARGE.chaosShards,
    steamComponents: chassis.buildCost.steamComponents + CHAOTIC_BUILD_SURCHARGE.steamComponents,
  };
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

function hasRequiredResources(cost: BuildCost, state: GameState): boolean {
  const resources = getSessionResourcePool(state, getLocalSessionPlayerSlot(state)).resources;
  return resources.metalScrap >= cost.metalScrap &&
    resources.wood >= cost.wood &&
    resources.chaosShards >= cost.chaosShards &&
    resources.steamComponents >= cost.steamComponents;
}

function createBaseStats(chassis: GearChassis): EquipmentStats {
  return {
    atk: chassis.slotType === "weapon" ? 5 : 0,
    def: chassis.slotType === "helmet" || chassis.slotType === "chestpiece" ? 3 : 0,
    agi: chassis.slotType === "accessory" ? 2 : 0,
    acc: 80,
    hp: 0,
  };
}

function createChaoticStats(chassis: GearChassis, rng: () => number): EquipmentStats {
  const base = createBaseStats(chassis);

  const atkSwing = chassis.slotType === "weapon" ? randomInt(rng, -2, 4) : randomInt(rng, 0, 3);
  const defSwing = chassis.slotType === "accessory" ? randomInt(rng, 0, 2) : randomInt(rng, -1, 4);
  const agiSwing = chassis.slotType === "accessory" ? randomInt(rng, -1, 3) : randomInt(rng, 0, 2);
  const hpSwing = chassis.slotType === "chestpiece" ? randomInt(rng, 2, 10) : randomInt(rng, 0, 6);

  return {
    atk: clampStat(base.atk + atkSwing),
    def: clampStat(base.def + defSwing),
    agi: clampStat(base.agi + agiSwing),
    acc: Math.max(60, Math.min(98, base.acc + randomInt(rng, -12, 12))),
    hp: clampStat(base.hp + hpSwing),
  };
}

function clampStat(value: number): number {
  return Math.max(0, value);
}

function createEquipment(
  chassis: GearChassis,
  equipmentId: string,
  equipmentName: string,
  doctrineId: string | undefined,
  stability: number,
  stats: EquipmentStats,
  builderVersion: number
): Equipment {
  if (chassis.slotType === "weapon") {
    return {
      id: equipmentId,
      name: equipmentName,
      slot: "weapon",
      weaponType: "sword",
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
    slot: "accessory",
    stats,
    cardsGranted: [],
    chassisId: chassis.id,
    doctrineId,
    stability,
    builderVersion,
  } as AccessoryEquipment;
}


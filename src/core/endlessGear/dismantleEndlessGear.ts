// ============================================================================
// CHAOS CORE - ENDLESS GEAR DISMANTLING
// Returns materials when dismantling procedural gear
// ============================================================================

import { GeneratedGear } from "./types";
import { getEndlessRecipeCost } from "./craftEndlessGear";
import { updateGameState } from "../../state/gameStore";

/**
 * Dismantle return rate (50-75% of input materials)
 */
const DISMANTLE_RETURN_RATE_MIN = 0.5;
const DISMANTLE_RETURN_RATE_MAX = 0.75;

/**
 * Result of dismantling endless gear
 */
export interface DismantleResult {
  success: boolean;
  error?: string;
  materialsReturned?: {
    metalScrap: number;
    wood: number;
    chaosShards: number;
    steamComponents: number;
  };
}

/**
 * Dismantle endless gear and return materials
 * Returns 50-75% of input materials (randomized)
 */
export function dismantleEndlessGear(gear: GeneratedGear): DismantleResult {
  // Check if gear has provenance (is endless gear)
  if (!gear.provenance || gear.provenance.kind !== "endless_crafted") {
    return { success: false, error: "Only endless crafted gear can be dismantled" };
  }
  
  // Get original recipe
  const recipe = gear.provenance.recipe;
  if (!recipe) {
    return { success: false, error: "Gear missing recipe data" };
  }
  
  // Calculate original cost
  const originalCost = getEndlessRecipeCost(recipe.materials);
  
  // Calculate return rate (randomized between min and max)
  const returnRate = DISMANTLE_RETURN_RATE_MIN + 
    Math.random() * (DISMANTLE_RETURN_RATE_MAX - DISMANTLE_RETURN_RATE_MIN);
  
  // Calculate returned materials (rounded down)
  const materialsReturned = {
    metalScrap: Math.floor(originalCost.metalScrap * returnRate),
    wood: Math.floor(originalCost.wood * returnRate),
    chaosShards: Math.floor(originalCost.chaosShards * returnRate),
    steamComponents: Math.floor(originalCost.steamComponents * returnRate),
  };
  
  return {
    success: true,
    materialsReturned,
  };
}

/**
 * Dismantle endless gear and add materials to inventory
 */
export function dismantleAndReturnMaterials(gear: GeneratedGear): DismantleResult {
  const result = dismantleEndlessGear(gear);
  
  if (!result.success || !result.materialsReturned) {
    return result;
  }
  
  // Add materials to inventory
  updateGameState(prev => ({
    ...prev,
    resources: {
      metalScrap: prev.resources.metalScrap + result.materialsReturned!.metalScrap,
      wood: prev.resources.wood + result.materialsReturned!.wood,
      chaosShards: prev.resources.chaosShards + result.materialsReturned!.chaosShards,
      steamComponents: prev.resources.steamComponents + result.materialsReturned!.steamComponents,
    },
  }));
  
  // Remove gear from inventory
  updateGameState(prev => {
    const equipmentById = (prev as any).equipmentById || {};
    const equipmentPool = (prev as any).equipmentPool || [];
    const gearSlots = (prev as any).gearSlots || {};
    
    // Remove from equipmentById
    const newEquipmentById = { ...equipmentById };
    delete newEquipmentById[gear.id];
    
    // Remove from equipmentPool
    const newEquipmentPool = equipmentPool.filter((id: string) => id !== gear.id);
    
    // Remove gear slots
    const newGearSlots = { ...gearSlots };
    delete newGearSlots[gear.id];
    
    return {
      ...prev,
      equipmentById: newEquipmentById,
      equipmentPool: newEquipmentPool,
      gearSlots: newGearSlots,
    };
  });
  
  return result;
}

/**
 * Check if gear can be dismantled (is endless crafted gear)
 */
export function canDismantleGear(gear: any): boolean {
  return gear?.provenance?.kind === "endless_crafted";
}


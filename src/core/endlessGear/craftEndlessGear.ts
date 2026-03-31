// ============================================================================
// CHAOS CORE - ENDLESS GEAR CRAFTING INTEGRATION
// Helper functions for crafting endless gear and adding to inventory
// ============================================================================

import { EndlessRecipe, GeneratedGear } from "./types";
import { generateEndlessGearFromRecipe, createGenerationContext } from "./generateEndlessGear";
import { GameState } from "../types";
import { getChassisById } from "../../data/gearChassis";
import { getDefaultGearSlots } from "../gearWorkbench";
import { updateGameState } from "../../state/gameStore";

/**
 * Craft endless gear from recipe and add to inventory
 */
export function craftEndlessGear(
  recipe: EndlessRecipe,
  state: GameState
): { success: boolean; error?: string; equipment?: GeneratedGear } {
  // Validate chassis
  const chassis = getChassisById(recipe.chassisId);
  if (!chassis) {
    return { success: false, error: "Invalid chassis ID" };
  }
  
  // Check if player has required materials (3 materials required)
  if (recipe.materials.length < 3) {
    return { success: false, error: "Recipe requires at least 3 materials" };
  }
  
  // Count materials needed (1 of each selected material)
  const materialCounts: Record<string, number> = {};
  for (const material of recipe.materials) {
    materialCounts[material] = (materialCounts[material] || 0) + 1;
  }
  
  // Check resources
  const resources = state.resources;
  if (materialCounts.metal_scrap && resources.metalScrap < materialCounts.metal_scrap) {
    return { success: false, error: "Insufficient Metal Scrap" };
  }
  if (materialCounts.wood && resources.wood < materialCounts.wood) {
    return { success: false, error: "Insufficient Wood" };
  }
  if (materialCounts.chaos_shard && resources.chaosShards < materialCounts.chaos_shard) {
    return { success: false, error: "Insufficient Chaos Shards" };
  }
  if (materialCounts.steam_component && resources.steamComponents < materialCounts.steam_component) {
    return { success: false, error: "Insufficient Steam Components" };
  }
  
  // Generate gear
  const ctx = createGenerationContext();
  let equipment: GeneratedGear;
  try {
    equipment = generateEndlessGearFromRecipe(recipe, ctx);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Generation failed" };
  }
  
  return { success: true, equipment };
}

/**
 * Add endless gear to inventory (similar to buildGear flow)
 */
export function addEndlessGearToInventory(equipment: GeneratedGear, state: GameState): void {
  // Add to equipmentById and equipmentPool
  updateGameState((prev: GameState) => {
    const equipmentById = (prev as any).equipmentById || {};
    const equipmentPool = (prev as any).equipmentPool || [];
    
    return {
      ...prev,
      equipmentById: {
        ...equipmentById,
        [equipment.id]: equipment,
      },
      equipmentPool: [...equipmentPool, equipment.id],
    } as GameState;
  });
  
  // Initialize gear slots
  const gearSlots = (state as any).gearSlots || {};
  updateGameState((prev: GameState) => {
    const chassis = getChassisById(equipment.chassisId);
    const maxSlots = chassis?.maxCardSlots || 3;
    
    // Handle locked cards from endless generation
    const lockedCards = (equipment as any).lockedCards || [];
    const slotsLocked = (equipment as any).provenance?.bias?.slotsLocked || 0;
    
    const newGearSlots = {
      ...gearSlots,
      [equipment.id]: {
        lockedCards,
        freeSlots: Math.max(0, maxSlots - slotsLocked),
        slottedCards: [],
      },
    };
    
    return {
      ...prev,
      gearSlots: newGearSlots,
    } as GameState;
  });
}

/**
 * Get material cost for endless recipe
 */
export function getEndlessRecipeCost(materials: EndlessRecipe["materials"]): {
  metalScrap: number;
  wood: number;
  chaosShards: number;
  steamComponents: number;
} {
  const cost = {
    metalScrap: 0,
    wood: 0,
    chaosShards: 0,
    steamComponents: 0,
  };
  
  for (const material of materials) {
    switch (material) {
      case "metal_scrap":
        cost.metalScrap += 1;
        break;
      case "wood":
        cost.wood += 1;
        break;
      case "chaos_shard":
        cost.chaosShards += 1;
        break;
      case "steam_component":
        cost.steamComponents += 1;
        break;
      // Optional materials (not yet implemented)
      case "crystal":
      case "medic_herb":
        break;
    }
  }
  
  return cost;
}

/**
 * Check if player can afford endless recipe
 */
export function canAffordEndlessRecipe(
  materials: EndlessRecipe["materials"],
  state: GameState
): boolean {
  const cost = getEndlessRecipeCost(materials);
  const resources = state.resources;
  
  return resources.metalScrap >= cost.metalScrap &&
         resources.wood >= cost.wood &&
         resources.chaosShards >= cost.chaosShards &&
         resources.steamComponents >= cost.steamComponents;
}


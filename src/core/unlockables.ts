// ============================================================================
// CHAOS CORE - UNLOCKABLE REGISTRY
// Unified system for tracking unlockable chassis, doctrines, and field mods
// ============================================================================

import { ALL_CHASSIS, GearChassis } from "../data/gearChassis";
import { ALL_DOCTRINES, GearDoctrine } from "../data/gearDoctrines";
import { getAllFieldModDefs } from "./fieldModDefinitions";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export type UnlockableType = "chassis" | "doctrine" | "field_mod";

export interface UnlockableDefinition {
  id: string;
  type: UnlockableType;
  displayName: string;
  description: string;
  rarity: "common" | "uncommon" | "rare" | "epic";
  tags?: string[];
  cost?: {
    wad?: number;
    metalScrap?: number;
    wood?: number;
    chaosShards?: number;
    steamComponents?: number;
  };
  sourceRules?: {
    shopEligible: boolean;
    rewardEligible: boolean;
  };
}

// ----------------------------------------------------------------------------
// UNLOCKABLE REGISTRY
// ----------------------------------------------------------------------------

/**
 * Build the unified unlockable registry from chassis, doctrines, and field mods
 */
function buildUnlockableRegistry(): Record<string, UnlockableDefinition> {
  const registry: Record<string, UnlockableDefinition> = {};

  // Add all chassis
  for (const chassis of ALL_CHASSIS) {
    registry[chassis.id] = {
      id: chassis.id,
      type: "chassis",
      displayName: chassis.name,
      description: chassis.description,
      rarity: determineChassisRarity(chassis),
      tags: [chassis.slotType],
      cost: {
        metalScrap: chassis.buildCost.metalScrap,
        wood: chassis.buildCost.wood,
        chaosShards: chassis.buildCost.chaosShards,
        steamComponents: chassis.buildCost.steamComponents,
      },
      sourceRules: {
        shopEligible: true,
        rewardEligible: true,
      },
    };
  }

  // Add all doctrines
  for (const doctrine of ALL_DOCTRINES) {
    registry[doctrine.id] = {
      id: doctrine.id,
      type: "doctrine",
      displayName: doctrine.name,
      description: doctrine.description,
      rarity: determineDoctrineRarity(doctrine),
      tags: doctrine.intentTags,
      cost: {
        metalScrap: doctrine.buildCostModifier.metalScrap,
        wood: doctrine.buildCostModifier.wood,
        chaosShards: doctrine.buildCostModifier.chaosShards,
        steamComponents: doctrine.buildCostModifier.steamComponents,
      },
      sourceRules: {
        shopEligible: true,
        rewardEligible: true,
      },
    };
  }

  // Add all field mods
  const allFieldMods = getAllFieldModDefs();
  for (const mod of allFieldMods) {
    registry[mod.id] = {
      id: mod.id,
      type: "field_mod",
      displayName: mod.name,
      description: mod.description,
      rarity: mod.rarity,
      tags: mod.tags,
      cost: mod.cost ? { wad: mod.cost } : undefined,
      sourceRules: {
        shopEligible: true,
        rewardEligible: true,
      },
    };
  }

  return registry;
}

/**
 * Determine rarity for a chassis based on its stats
 */
function determineChassisRarity(chassis: GearChassis): "common" | "uncommon" | "rare" | "epic" {
  // Simple heuristic: more slots + higher cost = rarer
  const totalCost = chassis.buildCost.metalScrap + chassis.buildCost.wood + 
                   chassis.buildCost.chaosShards + chassis.buildCost.steamComponents;
  
  if (totalCost >= 40 || chassis.maxCardSlots >= 5) return "rare";
  if (totalCost >= 25 || chassis.maxCardSlots >= 4) return "uncommon";
  return "common";
}

/**
 * Determine rarity for a doctrine based on its modifiers
 */
function determineDoctrineRarity(doctrine: GearDoctrine): "common" | "uncommon" | "rare" | "epic" {
  const totalCost = doctrine.buildCostModifier.metalScrap + doctrine.buildCostModifier.wood +
                   doctrine.buildCostModifier.chaosShards + doctrine.buildCostModifier.steamComponents;
  
  if (totalCost >= 8) return "rare";
  if (totalCost >= 4) return "uncommon";
  return "common";
}

// Export the registry
export const UNLOCKABLE_REGISTRY = buildUnlockableRegistry();

// ----------------------------------------------------------------------------
// UTILITIES
// ----------------------------------------------------------------------------

/**
 * Get unlockable definition by ID
 */
export function getUnlockableById(id: string): UnlockableDefinition | undefined {
  return UNLOCKABLE_REGISTRY[id];
}

/**
 * Get all unlockables of a specific type
 */
export function getUnlockablesByType(type: UnlockableType): UnlockableDefinition[] {
  return Object.values(UNLOCKABLE_REGISTRY).filter(u => u.type === type);
}

/**
 * Get all unlockables eligible for shops
 */
export function getShopEligibleUnlockables(): UnlockableDefinition[] {
  return Object.values(UNLOCKABLE_REGISTRY).filter(
    u => u.sourceRules?.shopEligible !== false
  );
}

/**
 * Get all unlockables eligible for rewards
 */
export function getRewardEligibleUnlockables(): UnlockableDefinition[] {
  return Object.values(UNLOCKABLE_REGISTRY).filter(
    u => u.sourceRules?.rewardEligible !== false
  );
}

/**
 * Filter unlockables by rarity
 */
export function filterUnlockablesByRarity(
  unlockables: UnlockableDefinition[],
  rarities: ("common" | "uncommon" | "rare" | "epic")[]
): UnlockableDefinition[] {
  return unlockables.filter(u => rarities.includes(u.rarity));
}

/**
 * Get unlockables not owned by player
 */
export function getUnownedUnlockables(
  ownedIds: string[],
  type?: UnlockableType
): UnlockableDefinition[] {
  const ownedSet = new Set(ownedIds);
  const candidates = type 
    ? getUnlockablesByType(type)
    : Object.values(UNLOCKABLE_REGISTRY);
  
  return candidates.filter(u => !ownedSet.has(u.id));
}


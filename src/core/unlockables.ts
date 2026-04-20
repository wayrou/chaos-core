// ============================================================================
// CHAOS CORE - UNLOCKABLE REGISTRY
// Unified system for tracking unlockable chassis, doctrines, and field mods
// ============================================================================

import type { GearChassis } from "../data/gearChassis";
import type { GearDoctrine } from "../data/gearDoctrines";
import { getAllChassis, getAllDoctrines } from "./gearCatalog";
import { getAllFieldModDefs } from "./fieldModDefinitions";
import { getAllDecorItems } from "./decorSystem";
import type { ResourceWallet } from "./resources";
import { getHighestReachedFloorOrdinal, loadCampaignProgress } from "./campaign";
import type { GameState } from "./types";
import { getMerchantFloorOrdinal } from "./merchant";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export type UnlockableType = "chassis" | "doctrine" | "field_mod" | "decor";

export interface UnlockableDefinition {
  id: string;
  type: UnlockableType;
  displayName: string;
  description: string;
  rarity: "common" | "uncommon" | "rare" | "epic";
  tags?: string[];
  cost?: Partial<ResourceWallet> & { wad?: number };
  unlockAfterFloor?: number;
  requiredQuestIds?: string[];
  sourceRules?: {
    shopEligible: boolean;
    rewardEligible: boolean;
    merchantEligible?: boolean;
    merchantFloorOrdinal?: number;
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
  for (const chassis of getAllChassis()) {
    const shopEligible = chassis.availableInHavenShop !== false;
    const merchantFloorOrdinal = getMerchantFloorOrdinal(chassis.merchant);
    registry[chassis.id] = {
      id: chassis.id,
      type: "chassis",
      displayName: chassis.name,
      description: chassis.description,
      rarity: determineChassisRarity(chassis),
      tags: [chassis.slotType],
      cost: chassis.buildCost,
      unlockAfterFloor: shopEligible
        ? Number(chassis.havenShopUnlockAfterFloor ?? chassis.unlockAfterFloor ?? 0)
        : 0,
      requiredQuestIds: chassis.requiredQuestIds ?? [],
      sourceRules: {
        shopEligible,
        rewardEligible: true,
        merchantEligible: merchantFloorOrdinal !== null,
        merchantFloorOrdinal: merchantFloorOrdinal ?? undefined,
      },
    };
  }

  // Add all doctrines
  for (const doctrine of getAllDoctrines()) {
    const merchantFloorOrdinal = getMerchantFloorOrdinal(doctrine.merchant);
    registry[doctrine.id] = {
      id: doctrine.id,
      type: "doctrine",
      displayName: doctrine.name,
      description: doctrine.description,
      rarity: determineDoctrineRarity(doctrine),
      tags: doctrine.intentTags,
      cost: doctrine.buildCostModifier,
      unlockAfterFloor: Number(doctrine.unlockAfterFloor ?? 0),
      requiredQuestIds: doctrine.requiredQuestIds ?? [],
      sourceRules: {
        shopEligible: true,
        rewardEligible: true,
        merchantEligible: merchantFloorOrdinal !== null,
        merchantFloorOrdinal: merchantFloorOrdinal ?? undefined,
      },
    };
  }

  // Add all field mods
  const allFieldMods = getAllFieldModDefs();
  for (const mod of allFieldMods) {
    const merchantFloorOrdinal = getMerchantFloorOrdinal(mod.merchant);
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
        merchantEligible: merchantFloorOrdinal !== null,
        merchantFloorOrdinal: merchantFloorOrdinal ?? undefined,
      },
    };
  }

  // Add all decor unlocks
  for (const decor of getAllDecorItems()) {
    const merchantFloorOrdinal = getMerchantFloorOrdinal(decor.sourceRules?.merchant);
    registry[decor.id] = {
      id: decor.id,
      type: "decor",
      displayName: decor.name,
      description: decor.description,
      rarity: decor.rarityTag ?? "common",
      tags: [`decor:${decor.tileWidth}x${decor.tileHeight}`],
      cost: decor.shopCostWad ? { wad: decor.shopCostWad } : undefined,
      sourceRules: {
        shopEligible: decor.sourceRules?.shopEligible !== false,
        rewardEligible: decor.sourceRules?.rewardEligible !== false,
        merchantEligible: merchantFloorOrdinal !== null,
        merchantFloorOrdinal: merchantFloorOrdinal ?? undefined,
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
  const totalCost = Object.values(chassis.buildCost).reduce((sum, amount) => sum + Number(amount ?? 0), 0);
  
  if (totalCost >= 40 || chassis.maxCardSlots >= 5) return "rare";
  if (totalCost >= 25 || chassis.maxCardSlots >= 4) return "uncommon";
  return "common";
}

/**
 * Determine rarity for a doctrine based on its modifiers
 */
function determineDoctrineRarity(doctrine: GearDoctrine): "common" | "uncommon" | "rare" | "epic" {
  const totalCost = Object.values(doctrine.buildCostModifier).reduce((sum, amount) => sum + Number(amount ?? 0), 0);
  
  if (totalCost >= 8) return "rare";
  if (totalCost >= 4) return "uncommon";
  return "common";
}

function getUnlockableRegistry(): Record<string, UnlockableDefinition> {
  return buildUnlockableRegistry();
}

function meetsUnlockRequirements(unlockable: UnlockableDefinition, state?: GameState): boolean {
  const floorGate = Number(unlockable.unlockAfterFloor ?? 0);
  if (floorGate > 0) {
    const highestReachedFloorOrdinal = getHighestReachedFloorOrdinal(loadCampaignProgress());
    if (highestReachedFloorOrdinal < floorGate) {
      return false;
    }
  }

  const requiredQuestIds = unlockable.requiredQuestIds ?? [];
  if (requiredQuestIds.length > 0) {
    const completedQuestIds = new Set(state?.quests?.completedQuests ?? []);
    if (requiredQuestIds.some((questId) => !completedQuestIds.has(questId))) {
      return false;
    }
  }

  return true;
}

// ----------------------------------------------------------------------------
// UTILITIES
// ----------------------------------------------------------------------------

/**
 * Get unlockable definition by ID
 */
export function getUnlockableById(id: string): UnlockableDefinition | undefined {
  return getUnlockableRegistry()[id];
}

/**
 * Get all unlockables of a specific type
 */
export function getUnlockablesByType(type: UnlockableType): UnlockableDefinition[] {
  return Object.values(getUnlockableRegistry()).filter(u => u.type === type);
}

/**
 * Get all unlockables eligible for shops
 */
export function getShopEligibleUnlockables(state?: GameState): UnlockableDefinition[] {
  return Object.values(getUnlockableRegistry()).filter(
    (u) => u.sourceRules?.shopEligible !== false && meetsUnlockRequirements(u, state)
  );
}

export function getMerchantEligibleUnlockables(floorOrdinal: number, state?: GameState): UnlockableDefinition[] {
  const normalizedFloor = Math.floor(Number(floorOrdinal));
  return Object.values(getUnlockableRegistry()).filter(
    (u) => u.sourceRules?.merchantEligible === true
      && u.sourceRules?.merchantFloorOrdinal === normalizedFloor
      && meetsUnlockRequirements(u, state)
  );
}

/**
 * Get all unlockables eligible for rewards
 */
export function getRewardEligibleUnlockables(): UnlockableDefinition[] {
  return Object.values(getUnlockableRegistry()).filter(
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
  type?: UnlockableType,
  state?: GameState
): UnlockableDefinition[] {
  const ownedSet = new Set(ownedIds);
  const candidates = type 
    ? getUnlockablesByType(type)
    : Object.values(getUnlockableRegistry());
  
  return candidates.filter(u => !ownedSet.has(u.id) && meetsUnlockRequirements(u, state));
}

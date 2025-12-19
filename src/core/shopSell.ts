// ============================================================================
// CHAOS CORE - SHOP SELL SYSTEM
// Selling items to shop for WAD
// ============================================================================

import { GameState } from "./types";
import { Equipment } from "./equipment";
import { CONSUMABLE_DATABASE } from "./crafting";
import { getAllOwnedUnlockableIds } from "./unlockableOwnership";
import { getUnlockableById } from "./unlockables";

// ----------------------------------------------------------------------------
// CONSTANTS
// ----------------------------------------------------------------------------

/**
 * Sell multiplier: items sell for this fraction of their buy price
 * Tune this value to adjust sell prices across the board
 */
export const SELL_MULTIPLIER = 0.5;

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export type InventoryKind = "equipment" | "consumable" | "weaponPart" | "resource";

export interface SellLine {
  kind: InventoryKind;
  id: string;
  quantity: number;
}

export interface SellableEntry {
  key: string; // kind:id unique identifier
  kind: InventoryKind;
  id: string;
  name: string;
  owned: number;
  equipped?: boolean;
  locked?: boolean;
  unitSellPrice: number;
  stackable: boolean;
}

export interface SellResult {
  success: boolean;
  wadGained?: number;
  error?: string;
}

// ----------------------------------------------------------------------------
// PRICING
// ----------------------------------------------------------------------------

/**
 * Get sell price for an item
 * Priority: buyPrice > rarity-based > fallback
 */
export function getSellPrice(
  kind: InventoryKind,
  id: string,
  buyPrice?: number
): number {
  // If we have a buy price, use sell multiplier
  if (buyPrice !== undefined && buyPrice > 0) {
    return Math.floor(buyPrice * SELL_MULTIPLIER);
  }
  
  // Try to infer from item data
  if (kind === "consumable") {
    const consumable = CONSUMABLE_DATABASE[id];
    if (consumable) {
      // Base price on effect value
      const basePrice = consumable.value * 5;
      return Math.max(1, Math.floor(basePrice * SELL_MULTIPLIER));
    }
  }
  
  if (kind === "weaponPart") {
    try {
      const unlockable = getUnlockableById(id);
      if (unlockable?.cost) {
        const estimatedBuyPrice = unlockable.cost.wad || 
          (unlockable.cost.metalScrap || 0) * 5 + 
          (unlockable.cost.wood || 0) * 3 + 
          (unlockable.cost.chaosShards || 0) * 10 + 
          (unlockable.cost.steamComponents || 0) * 15;
        return Math.floor(estimatedBuyPrice * SELL_MULTIPLIER);
      }
    } catch {
      // Fall through to default
    }
  }
  
  // Fallback: small default price
  return 1;
}

/**
 * Get resource sell prices (fixed prices)
 */
export function getResourceSellPrice(resourceId: string): number {
  const prices: Record<string, number> = {
    metalScrap: 2,
    wood: 1,
    chaosShards: 5,
    steamComponents: 3,
  };
  return prices[resourceId] || 1;
}

// ----------------------------------------------------------------------------
// VALIDATION
// ----------------------------------------------------------------------------

/**
 * Check if equipment is equipped to any unit
 */
function isEquipmentEquipped(
  equipmentId: string,
  state: GameState
): boolean {
  if (!state.unitsById) return false;
  
  for (const unit of Object.values(state.unitsById)) {
    if (!unit.loadout) continue;
    
    if (
      unit.loadout.weapon === equipmentId ||
      unit.loadout.helmet === equipmentId ||
      unit.loadout.chestpiece === equipmentId ||
      unit.loadout.accessory1 === equipmentId ||
      unit.loadout.accessory2 === equipmentId
    ) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validate a sell line
 */
function validateSellLine(
  line: SellLine,
  state: GameState
): { valid: boolean; error?: string } {
  if (line.quantity <= 0) {
    return { valid: false, error: "Quantity must be greater than 0" };
  }
  
  switch (line.kind) {
    case "equipment": {
      const equipment = state.equipmentById?.[line.id];
      if (!equipment) {
        return { valid: false, error: `Equipment ${line.id} not found` };
      }
      
      if (line.quantity > 1) {
        return { valid: false, error: "Equipment items cannot be stacked" };
      }
      
      if (isEquipmentEquipped(line.id, state)) {
        return { valid: false, error: "Cannot sell equipped items" };
      }
      
      return { valid: true };
    }
    
    case "consumable": {
      const owned = state.consumables?.[line.id] || 0;
      if (line.quantity > owned) {
        return { valid: false, error: `Only ${owned} available, cannot sell ${line.quantity}` };
      }
      return { valid: true };
    }
    
    case "weaponPart": {
      const owned = getAllOwnedUnlockableIds();
      const allOwned = [...owned.chassis, ...owned.doctrines];
      if (!allOwned.includes(line.id)) {
        return { valid: false, error: `Weapon part ${line.id} not owned` };
      }
      
      // Weapon parts are typically not stackable, but allow selling 1
      if (line.quantity > 1) {
        return { valid: false, error: "Weapon parts cannot be stacked" };
      }
      
      return { valid: true };
    }
    
    case "resource": {
      const resourceMap: Record<string, keyof GameState["resources"]> = {
        metalScrap: "metalScrap",
        wood: "wood",
        chaosShards: "chaosShards",
        steamComponents: "steamComponents",
      };
      
      const resourceKey = resourceMap[line.id];
      if (!resourceKey) {
        return { valid: false, error: `Unknown resource: ${line.id}` };
      }
      
      const owned = state.resources?.[resourceKey] || 0;
      if (line.quantity > owned) {
        return { valid: false, error: `Only ${owned} available, cannot sell ${line.quantity}` };
      }
      
      return { valid: true };
    }
    
    default:
      return { valid: false, error: `Unknown inventory kind: ${line.kind}` };
  }
}

// ----------------------------------------------------------------------------
// TRANSACTION
// ----------------------------------------------------------------------------

/**
 * Execute sell transaction (atomic)
 * Returns new state and WAD gained, or error
 */
export function sellToShop(
  state: GameState,
  lines: SellLine[]
): { next: GameState; wadGained: number } | { error: string } {
  // Validate all lines first
  for (const line of lines) {
    const validation = validateSellLine(line, state);
    if (!validation.valid) {
      return { error: validation.error || "Validation failed" };
    }
  }
  
  // Calculate total WAD
  let totalWad = 0;
  for (const line of lines) {
    let unitPrice = 0;
    
    if (line.kind === "resource") {
      unitPrice = getResourceSellPrice(line.id);
    } else {
      // For equipment/consumables/weaponParts, we need to look up buy price
      // For now, use getSellPrice which has fallbacks
      unitPrice = getSellPrice(line.kind, line.id);
    }
    
    totalWad += unitPrice * line.quantity;
  }
  
  // Create new state with updates
  const nextState: GameState = JSON.parse(JSON.stringify(state)); // Deep clone
  
  // Apply all changes
  for (const line of lines) {
    switch (line.kind) {
      case "equipment": {
        // Remove from equipmentById and equipmentPool
        if (nextState.equipmentById) {
          delete nextState.equipmentById[line.id];
        }
        if (nextState.equipmentPool) {
          nextState.equipmentPool = nextState.equipmentPool.filter(id => id !== line.id);
        }
        // Also remove from gearSlots if present
        if (nextState.gearSlots) {
          delete nextState.gearSlots[line.id];
        }
        break;
      }
      
      case "consumable": {
        if (!nextState.consumables) nextState.consumables = {};
        const current = nextState.consumables[line.id] || 0;
        const newQty = current - line.quantity;
        if (newQty <= 0) {
          delete nextState.consumables[line.id];
        } else {
          nextState.consumables[line.id] = newQty;
        }
        break;
      }
      
      case "weaponPart": {
        // Remove from unlocked lists
        if (nextState.unlockedChassisIds) {
          nextState.unlockedChassisIds = nextState.unlockedChassisIds.filter(id => id !== line.id);
        }
        if (nextState.unlockedDoctrineIds) {
          nextState.unlockedDoctrineIds = nextState.unlockedDoctrineIds.filter(id => id !== line.id);
        }
        break;
      }
      
      case "resource": {
        const resourceMap: Record<string, keyof GameState["resources"]> = {
          metalScrap: "metalScrap",
          wood: "wood",
          chaosShards: "chaosShards",
          steamComponents: "steamComponents",
        };
        
        const resourceKey = resourceMap[line.id];
        if (resourceKey && nextState.resources) {
          const current = nextState.resources[resourceKey] || 0;
          nextState.resources[resourceKey] = Math.max(0, current - line.quantity);
        }
        break;
      }
    }
  }
  
  // Add WAD
  nextState.wad = (nextState.wad || 0) + totalWad;
  
  return { next: nextState, wadGained: totalWad };
}

// ----------------------------------------------------------------------------
// INVENTORY ENUMERATION
// ----------------------------------------------------------------------------

/**
 * Get all sellable entries from inventory
 */
export function getSellableEntries(state: GameState): SellableEntry[] {
  const entries: SellableEntry[] = [];
  
  // Equipment
  if (state.equipmentById) {
    for (const [id, equipment] of Object.entries(state.equipmentById)) {
      const eq = equipment as Equipment;
      const equipped = isEquipmentEquipped(id, state);
      
      entries.push({
        key: `equipment:${id}`,
        kind: "equipment",
        id,
        name: eq.name || id,
        owned: 1,
        equipped,
        unitSellPrice: getSellPrice("equipment", id),
        stackable: false,
      });
    }
  }
  
  // Consumables
  if (state.consumables) {
    for (const [id, quantity] of Object.entries(state.consumables)) {
      if (quantity > 0) {
        const consumable = CONSUMABLE_DATABASE[id];
        entries.push({
          key: `consumable:${id}`,
          kind: "consumable",
          id,
          name: consumable?.name || id,
          owned: quantity,
          unitSellPrice: getSellPrice("consumable", id),
          stackable: true,
        });
      }
    }
  }
  
  // Weapon Parts (unlockables)
  const owned = getAllOwnedUnlockableIds();
  const allOwned = [...owned.chassis, ...owned.doctrines];
  for (const id of allOwned) {
    try {
      const unlockable = getUnlockableById(id);
      if (unlockable) {
        entries.push({
          key: `weaponPart:${id}`,
          kind: "weaponPart",
          id,
          name: unlockable.displayName,
          owned: 1,
          unitSellPrice: getSellPrice("weaponPart", id),
          stackable: false,
        });
      }
    } catch {
      // Skip if not found
    }
  }
  
  // Resources
  if (state.resources) {
    const resources = [
      { id: "metalScrap", name: "Metal Scrap" },
      { id: "wood", name: "Wood" },
      { id: "chaosShards", name: "Chaos Shards" },
      { id: "steamComponents", name: "Steam Components" },
    ];
    
    for (const res of resources) {
      const quantity = state.resources[res.id as keyof typeof state.resources] as number || 0;
      if (quantity > 0) {
        entries.push({
          key: `resource:${res.id}`,
          kind: "resource",
          id: res.id,
          name: res.name,
          owned: quantity,
          unitSellPrice: getResourceSellPrice(res.id),
          stackable: true,
        });
      }
    }
  }
  
  return entries;
}


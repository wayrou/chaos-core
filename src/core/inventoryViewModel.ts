// ============================================================================
// INVENTORY VIEW MODEL - Normalized inventory data builder
// Builds a unified view of all player-owned items from GameState
// ============================================================================

import { GameState } from "./types";
import { Equipment, WeaponEquipment, ArmorEquipment } from "./equipment";
import { getRecipe } from "./craftingRecipes";
import { CONSUMABLE_DATABASE } from "./crafting";
import { BASIC_RESOURCE_KEYS, RESOURCE_LABELS, getResourceEntries } from "./resources";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export type InventoryCategory = "equipment" | "consumable" | "keyItem" | "weaponPart" | "recipe" | "resource";

export interface InventoryEntryVM {
  key: string;              // `${category}:${id}` unique
  category: InventoryCategory;
  id: string;
  name: string;
  description?: string;
  owned: number;            // 1 for unique items, quantity for stackables
  equipped?: boolean;        // if applicable
  rarity?: string | number;   // if exists
  sortGroup?: string;        // optional subtype: armor/accessory/weapon/etc
}

export interface InventoryViewModel {
  wad: number;
  entries: InventoryEntryVM[];
  countsByCategory: Record<InventoryCategory, number>;
}

// ----------------------------------------------------------------------------
// VIEW MODEL BUILDER
// ----------------------------------------------------------------------------

/**
 * Build a normalized inventory view model from game state
 * Aggregates equipment, consumables, weapon parts (modules), recipes, and resources
 */
export function buildInventoryVM(state: GameState): InventoryViewModel {
  const entries: InventoryEntryVM[] = [];
  const countsByCategory: Record<InventoryCategory, number> = {
    equipment: 0,
    consumable: 0,
    keyItem: 0,
    weaponPart: 0,
    recipe: 0,
    resource: 0,
  };

  // Track equipped equipment IDs
  const equippedIds = new Set<string>();
  if (state.unitsById) {
    for (const unit of Object.values(state.unitsById)) {
      if (unit.loadout) {
        if (unit.loadout.primaryWeapon) equippedIds.add(unit.loadout.primaryWeapon);
        if (unit.loadout.secondaryWeapon) equippedIds.add(unit.loadout.secondaryWeapon);
        if (unit.loadout.helmet) equippedIds.add(unit.loadout.helmet);
        if (unit.loadout.chestpiece) equippedIds.add(unit.loadout.chestpiece);
        if (unit.loadout.accessory1) equippedIds.add(unit.loadout.accessory1);
        if (unit.loadout.accessory2) equippedIds.add(unit.loadout.accessory2);
      }
    }
  }

  // 1. EQUIPMENT
  if (state.equipmentById) {
    for (const [id, equip] of Object.entries(state.equipmentById)) {
      const equipment = equip as Equipment;
      let sortGroup: string;

      if (equipment.slot === "weapon") {
        sortGroup = "weapon";
      } else if (equipment.slot === "helmet" || equipment.slot === "chestpiece") {
        sortGroup = "armor";
      } else {
        sortGroup = "accessory";
      }

      entries.push({
        key: `equipment:${id}`,
        category: "equipment",
        id,
        name: equipment.name,
        description: getEquipmentDescription(equipment),
        owned: 1,
        equipped: equippedIds.has(id),
        sortGroup,
      });
      countsByCategory.equipment++;
    }
  }

  // 2. CONSUMABLES
  if (state.consumables) {
    for (const [id, quantity] of Object.entries(state.consumables)) {
      if (quantity > 0) {
        const consumableDef = CONSUMABLE_DATABASE[id];
        entries.push({
          key: `consumable:${id}`,
          category: "consumable",
          id,
          name: consumableDef?.name || id,
          description: consumableDef?.description,
          owned: quantity,
          sortGroup: "consumable",
        });
        countsByCategory.consumable++;
      }
    }
  }

  // 3. KEY ITEMS
  const keyItemsById = new Map<string, { id: string; name: string; description?: string; quantity: number }>();
  [...(state.inventory?.baseStorage ?? []), ...(state.inventory?.forwardLocker ?? [])].forEach((item) => {
    if (item.kind !== "key_item") {
      return;
    }

    const quantity = Math.max(1, Number(item.quantity ?? 1));
    const existing = keyItemsById.get(item.id);
    if (existing) {
      existing.quantity += quantity;
      if (!existing.description && item.description) {
        existing.description = item.description;
      }
      return;
    }

    keyItemsById.set(item.id, {
      id: item.id,
      name: item.name || item.id,
      description: item.description,
      quantity,
    });
  });

  keyItemsById.forEach((item) => {
    entries.push({
      key: `keyItem:${item.id}`,
      category: "keyItem",
      id: item.id,
      name: item.name,
      description: item.description,
      owned: item.quantity,
      sortGroup: "quest",
    });
    countsByCategory.keyItem++;
  });

  // 4. WEAPON PARTS (Modules) - Only show modules attached to owned weapons
  if (state.modulesById && state.equipmentById) {
    const attachedModuleIds = new Set<string>();
    // Find all modules attached to owned weapons
    for (const equipment of Object.values(state.equipmentById)) {
      if (equipment.slot === "weapon" && equipment.attachedModules) {
        for (const modId of equipment.attachedModules) {
          attachedModuleIds.add(modId);
        }
      }
    }
    // Add entries for attached modules
    for (const modId of attachedModuleIds) {
      const module = state.modulesById[modId];
      if (module) {
        entries.push({
          key: `weaponPart:${modId}`,
          category: "weaponPart",
          id: modId,
          name: module.name,
          description: module.description,
          owned: 1, // Modules are unique items
          sortGroup: "module",
        });
        countsByCategory.weaponPart++;
      }
    }
  }

  // 5. RECIPES
  if (state.knownRecipeIds) {
    for (const recipeId of state.knownRecipeIds) {
      const recipe = getRecipe(recipeId);
      if (recipe) {
        entries.push({
          key: `recipe:${recipeId}`,
          category: "recipe",
          id: recipeId,
          name: recipe.itemName || recipeId,
          description: `Craft ${recipe.itemName}`,
          owned: 1, // Recipes are known/unknown, not quantities
          sortGroup: recipe.category || "recipe",
        });
        countsByCategory.recipe++;
      }
    }
  }

  // 6. RESOURCES
  if (state.resources) {
    getResourceEntries(state.resources, { keys: BASIC_RESOURCE_KEYS }).forEach((resource) => {
      entries.push({
        key: `resource:${resource.key}`,
        category: "resource",
        id: resource.key,
        name: resource.label,
        description: "Crafting material",
        owned: resource.amount,
        sortGroup: "resource",
      });
      countsByCategory.resource++;
    });
  }

  const storedResourceItems = new Map<string, { id: string; name: string; description?: string; quantity: number }>();
  [...(state.inventory?.baseStorage ?? []), ...(state.inventory?.forwardLocker ?? [])].forEach((item) => {
    if (item.kind !== "resource") {
      return;
    }

    const quantity = Math.max(0, Number(item.quantity ?? 0));
    if (quantity <= 0) {
      return;
    }

    const existing = storedResourceItems.get(item.id);
    if (existing) {
      existing.quantity += quantity;
      if (!existing.description && item.description) {
        existing.description = item.description;
      }
      return;
    }

    storedResourceItems.set(item.id, {
      id: item.id,
      name: item.name || RESOURCE_LABELS[item.id as keyof typeof RESOURCE_LABELS] || item.id,
      description: item.description,
      quantity,
    });
  });

  storedResourceItems.forEach((item) => {
    entries.push({
      key: `resource:${item.id}`,
      category: "resource",
      id: item.id,
      name: item.name,
      description: item.description ?? "Crafting material",
      owned: item.quantity,
      sortGroup: "resource",
    });
    countsByCategory.resource++;
  });

  // Sort entries: category -> sortGroup -> name
  entries.sort((a, b) => {
    const categoryOrder: Record<InventoryCategory, number> = {
      equipment: 0,
      consumable: 1,
      keyItem: 2,
      weaponPart: 3,
      recipe: 4,
      resource: 5,
    };

    const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
    if (catDiff !== 0) return catDiff;

    const groupDiff = (a.sortGroup || "").localeCompare(b.sortGroup || "");
    if (groupDiff !== 0) return groupDiff;

    return a.name.localeCompare(b.name);
  });

  return {
    wad: state.wad ?? 0,
    entries,
    countsByCategory,
  };
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function getEquipmentDescription(equipment: Equipment): string {
  if (equipment.slot === "weapon") {
    const weapon = equipment as WeaponEquipment;
    const parts: string[] = [];
    parts.push(`${weapon.weaponType} weapon`);
    if (weapon.isMechanical) parts.push("mechanical");
    if (weapon.heatCapacity) parts.push(`heat: ${weapon.heatCapacity}`);
    if (weapon.ammoMax) parts.push(`ammo: ${weapon.ammoMax}`);
    return parts.join(", ");
  } else if (equipment.slot === "helmet" || equipment.slot === "chestpiece") {
    const armor = equipment as ArmorEquipment;
    return `${armor.slot} armor`;
  } else {
    return "accessory";
  }
}

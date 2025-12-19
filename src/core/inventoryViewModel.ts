// ============================================================================
// INVENTORY VIEW MODEL - Normalized inventory data builder
// Builds a unified view of all player-owned items from GameState
// ============================================================================

import { GameState } from "./types";
import { Equipment, WeaponEquipment, ArmorEquipment, AccessoryEquipment } from "./equipment";
import { Module } from "./equipment";
import { getRecipe, getAllRecipes } from "./craftingRecipes";
import { CONSUMABLE_DATABASE } from "./crafting";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export type InventoryCategory = "equipment" | "consumable" | "weaponPart" | "recipe" | "resource";

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
    weaponPart: 0,
    recipe: 0,
    resource: 0,
  };

  // Track equipped equipment IDs
  const equippedIds = new Set<string>();
  if (state.unitsById) {
    for (const unit of Object.values(state.unitsById)) {
      if (unit.loadout) {
        if (unit.loadout.weapon) equippedIds.add(unit.loadout.weapon);
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

  // 3. WEAPON PARTS (Modules) - Only show modules attached to owned weapons
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

  // 4. RECIPES
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

  // 5. RESOURCES
  if (state.resources) {
    const resourceEntries = [
      { id: "metalScrap", name: "Metal Scrap", value: state.resources.metalScrap },
      { id: "wood", name: "Wood", value: state.resources.wood },
      { id: "chaosShards", name: "Chaos Shards", value: state.resources.chaosShards },
      { id: "steamComponents", name: "Steam Components", value: state.resources.steamComponents },
    ];

    for (const resource of resourceEntries) {
      if (resource.value > 0) {
        entries.push({
          key: `resource:${resource.id}`,
          category: "resource",
          id: resource.id,
          name: resource.name,
          description: `Crafting material`,
          owned: resource.value,
          sortGroup: "resource",
        });
        countsByCategory.resource++;
      }
    }
  }

  // Sort entries: category -> sortGroup -> name
  entries.sort((a, b) => {
    const categoryOrder: Record<InventoryCategory, number> = {
      equipment: 0,
      consumable: 1,
      weaponPart: 2,
      recipe: 3,
      resource: 4,
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
    const accessory = equipment as AccessoryEquipment;
    return "accessory";
  }
}

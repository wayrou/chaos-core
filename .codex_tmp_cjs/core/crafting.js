"use strict";
// ============================================================================
// CHAOS CORE - CRAFTING SYSTEM (Headline 11d)
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONSUMABLE_DATABASE = exports.RECIPE_DATABASE = void 0;
exports.getKnownRecipes = getKnownRecipes;
exports.getStarterRecipes = getStarterRecipes;
exports.getStarterRecipeIds = getStarterRecipeIds;
exports.canAffordRecipe = canAffordRecipe;
exports.hasRequiredItem = hasRequiredItem;
exports.getRecipeCostString = getRecipeCostString;
exports.getRecipesByCategory = getRecipesByCategory;
exports.getActiveRecipes = getActiveRecipes;
exports.getDeprecatedRecipes = getDeprecatedRecipes;
exports.learnRecipe = learnRecipe;
exports.craftItem = craftItem;
// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------
const technica_1 = require("../content/technica");
const resources_1 = require("./resources");
// ----------------------------------------------------------------------------
// RECIPE DATABASE
// ----------------------------------------------------------------------------
exports.RECIPE_DATABASE = {
    // ==================== DEPRECATED WEAPON RECIPES ====================
    // Weapons are now built in Gear Builder, not crafted
    // These recipes are kept for save compatibility but marked deprecated
    recipe_iron_longsword: {
        id: "recipe_iron_longsword",
        name: "Iron Longsword",
        category: "armor", // Changed to armor for type safety, but deprecated flag prevents use
        description: "A sturdy blade for frontline combat. [DEPRECATED: Use Gear Builder]",
        cost: { metalScrap: 5, wood: 2 },
        resultItemId: "weapon_iron_longsword",
        resultQuantity: 1,
        starterRecipe: true,
        deprecated: true,
    },
    recipe_runed_shortsword: {
        id: "recipe_runed_shortsword",
        name: "Runed Shortsword",
        category: "armor",
        description: "A quick blade etched with arcane symbols. [DEPRECATED: Use Gear Builder]",
        cost: { metalScrap: 4, chaosShards: 2 },
        resultItemId: "weapon_runed_shortsword",
        resultQuantity: 1,
        starterRecipe: true,
        deprecated: true,
    },
    recipe_elm_recurve_bow: {
        id: "recipe_elm_recurve_bow",
        name: "Elm Recurve Bow",
        category: "armor",
        description: "A reliable ranged weapon crafted from elm wood. [DEPRECATED: Use Gear Builder]",
        cost: { wood: 6, metalScrap: 2 },
        resultItemId: "weapon_elm_recurve_bow",
        resultQuantity: 1,
        starterRecipe: true,
        deprecated: true,
    },
    recipe_oak_battlestaff: {
        id: "recipe_oak_battlestaff",
        name: "Oak Battlestaff",
        category: "armor",
        description: "A sturdy staff for channeling and combat. [DEPRECATED: Use Gear Builder]",
        cost: { wood: 5, chaosShards: 1 },
        resultItemId: "weapon_oak_battlestaff",
        resultQuantity: 1,
        starterRecipe: true,
        deprecated: true,
    },
    recipe_steel_dagger: {
        id: "recipe_steel_dagger",
        name: "Steel Dagger",
        category: "armor",
        description: "A swift blade for quick strikes. [DEPRECATED: Use Gear Builder]",
        cost: { metalScrap: 3, wood: 1 },
        resultItemId: "weapon_steel_dagger",
        resultQuantity: 1,
        starterRecipe: true,
        deprecated: true,
    },
    // Mechanical Weapons (require steam components)
    recipe_emberclaw_repeater: {
        id: "recipe_emberclaw_repeater",
        name: "Emberclaw Repeater",
        category: "armor",
        description: "A repeating rifle powered by steam mechanisms. [DEPRECATED: Use Gear Builder]",
        cost: { metalScrap: 6, steamComponents: 4, chaosShards: 1 },
        resultItemId: "weapon_emberclaw_repeater",
        resultQuantity: 1,
        starterRecipe: false,
        deprecated: true,
    },
    recipe_brassback_scattergun: {
        id: "recipe_brassback_scattergun",
        name: "Brassback Scattergun",
        category: "armor",
        description: "A steam-powered shotgun with devastating spread. [DEPRECATED: Use Gear Builder]",
        cost: { metalScrap: 5, steamComponents: 3, wood: 2 },
        resultItemId: "weapon_brassback_scattergun",
        resultQuantity: 1,
        starterRecipe: false,
        deprecated: true,
    },
    recipe_blazefang_saber: {
        id: "recipe_blazefang_saber",
        name: "Blazefang Saber",
        category: "armor",
        description: "A steam-heated blade that sears on contact. [DEPRECATED: Use Gear Builder]",
        cost: { metalScrap: 4, steamComponents: 3, chaosShards: 2 },
        resultItemId: "weapon_blazefang_saber",
        resultQuantity: 1,
        starterRecipe: false,
        deprecated: true,
    },
    // ==================== ARMOR ====================
    recipe_ironguard_helm: {
        id: "recipe_ironguard_helm",
        name: "Ironguard Helm",
        category: "armor",
        description: "A solid helmet offering reliable protection.",
        cost: { metalScrap: 4, wood: 1 },
        resultItemId: "armor_ironguard_helm",
        resultQuantity: 1,
        starterRecipe: true,
    },
    recipe_rangers_hood: {
        id: "recipe_rangers_hood",
        name: "Ranger's Hood",
        category: "armor",
        description: "A lightweight hood favored by scouts.",
        cost: { wood: 3, chaosShards: 1 },
        resultItemId: "armor_rangers_hood",
        resultQuantity: 1,
        starterRecipe: true,
    },
    recipe_steelplate_cuirass: {
        id: "recipe_steelplate_cuirass",
        name: "Steelplate Cuirass",
        category: "armor",
        description: "Heavy chest armor for maximum protection.",
        cost: { metalScrap: 8, wood: 2 },
        resultItemId: "armor_steelplate_cuirass",
        resultQuantity: 1,
        starterRecipe: true,
    },
    recipe_leather_jerkin: {
        id: "recipe_leather_jerkin",
        name: "Leather Jerkin",
        category: "armor",
        description: "Light armor that doesn't restrict movement.",
        cost: { wood: 4, metalScrap: 1 },
        resultItemId: "armor_leather_jerkin",
        resultQuantity: 1,
        starterRecipe: true,
    },
    recipe_steam_valve_wristguard: {
        id: "recipe_steam_valve_wristguard",
        name: "Steam Valve Wristguard",
        category: "armor",
        description: "An accessory that vents heat from mechanical weapons.",
        cost: { steamComponents: 3, metalScrap: 2 },
        resultItemId: "accessory_steam_valve_wristguard",
        resultQuantity: 1,
        starterRecipe: false,
    },
    recipe_steel_signet_ring: {
        id: "recipe_steel_signet_ring",
        name: "Steel Signet Ring",
        category: "armor",
        description: "A ring that bolsters defense and luck.",
        cost: { metalScrap: 2, chaosShards: 1 },
        resultItemId: "accessory_steel_signet_ring",
        resultQuantity: 1,
        starterRecipe: true,
    },
    recipe_fleetfoot_anklet: {
        id: "recipe_fleetfoot_anklet",
        name: "Fleetfoot Anklet",
        category: "armor",
        description: "An anklet that enhances agility.",
        cost: { metalScrap: 2, wood: 2, chaosShards: 1 },
        resultItemId: "accessory_fleetfoot_anklet",
        resultQuantity: 1,
        starterRecipe: true,
    },
    // ==================== CONSUMABLES ====================
    recipe_healing_kit: {
        id: "recipe_healing_kit",
        name: "Healing Kit",
        category: "consumable",
        description: "Restores HP to a single unit during battle.",
        cost: { wood: 2, chaosShards: 1 },
        resultItemId: "consumable_healing_kit",
        resultQuantity: 2,
        starterRecipe: true,
    },
    recipe_field_ration: {
        id: "recipe_field_ration",
        name: "Field Ration",
        category: "consumable",
        description: "A small meal that restores a bit of HP.",
        cost: { wood: 2 },
        resultItemId: "consumable_field_ration",
        resultQuantity: 3,
        starterRecipe: true,
    },
    recipe_smoke_bomb: {
        id: "recipe_smoke_bomb",
        name: "Smoke Bomb",
        category: "consumable",
        description: "Creates a smoke screen, reducing enemy accuracy.",
        cost: { wood: 1, chaosShards: 2 },
        resultItemId: "consumable_smoke_bomb",
        resultQuantity: 2,
        starterRecipe: true,
    },
    recipe_repair_kit: {
        id: "recipe_repair_kit",
        name: "Repair Kit",
        category: "consumable",
        description: "Repairs weapon damage and reduces heat.",
        cost: { metalScrap: 3, steamComponents: 1 },
        resultItemId: "consumable_repair_kit",
        resultQuantity: 1,
        starterRecipe: true,
    },
    recipe_coolant_flask: {
        id: "recipe_coolant_flask",
        name: "Coolant Flask",
        category: "consumable",
        description: "Instantly removes heat from a mechanical weapon.",
        cost: { steamComponents: 2, chaosShards: 1 },
        resultItemId: "consumable_coolant_flask",
        resultQuantity: 2,
        starterRecipe: false,
    },
    recipe_overcharge_cell: {
        id: "recipe_overcharge_cell",
        name: "Overcharge Cell",
        category: "consumable",
        description: "Adds heat but boosts attack power temporarily.",
        cost: { steamComponents: 2, metalScrap: 1 },
        resultItemId: "consumable_overcharge_cell",
        resultQuantity: 2,
        starterRecipe: false,
    },
    // ==================== UPGRADES ====================
    // Weapon upgrades are deprecated - weapons are built/modified in Gear Builder
    recipe_iron_longsword_plus1: {
        id: "recipe_iron_longsword_plus1",
        name: "Iron Longsword +1",
        category: "upgrade",
        description: "An improved longsword with better stats. [DEPRECATED: Use Gear Builder]",
        cost: { metalScrap: 3, chaosShards: 1 },
        resultItemId: "weapon_iron_longsword_plus1",
        resultQuantity: 1,
        requiresItemId: "weapon_iron_longsword",
        starterRecipe: true,
        deprecated: true,
    },
    recipe_blazefang_saber_plus1: {
        id: "recipe_blazefang_saber_plus1",
        name: "Blazefang Saber +1",
        category: "upgrade",
        description: "An enhanced Blazefang with increased heat efficiency. [DEPRECATED: Use Gear Builder]",
        cost: { steamComponents: 4, chaosShards: 3 },
        resultItemId: "weapon_blazefang_saber_plus1",
        resultQuantity: 1,
        requiresItemId: "weapon_blazefang_saber",
        starterRecipe: false,
        deprecated: true,
    },
    recipe_steelplate_cuirass_plus1: {
        id: "recipe_steelplate_cuirass_plus1",
        name: "Steelplate Cuirass +1",
        category: "upgrade",
        description: "Reinforced armor with additional plating.",
        cost: { metalScrap: 5, steamComponents: 2 },
        resultItemId: "armor_steelplate_cuirass_plus1",
        resultQuantity: 1,
        requiresItemId: "armor_steelplate_cuirass",
        starterRecipe: true,
    },
};
// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------
/**
 * Get all recipes known by the player
 */
function getKnownRecipes(knownRecipeIds) {
    return knownRecipeIds
        .map(id => exports.RECIPE_DATABASE[id])
        .filter((r) => r !== undefined && !(0, technica_1.isTechnicaContentDisabled)("item", r.resultItemId));
}
/**
 * Get all starter recipes (known by default)
 */
function getStarterRecipes() {
    return Object.values(exports.RECIPE_DATABASE).filter(r => r.starterRecipe && !(0, technica_1.isTechnicaContentDisabled)("item", r.resultItemId));
}
/**
 * Get starter recipe IDs
 */
function getStarterRecipeIds() {
    return getStarterRecipes().map(r => r.id);
}
/**
 * Check if player has enough resources for a recipe
 */
function canAffordRecipe(recipe, resources) {
    return (0, resources_1.hasEnoughResources)(resources, recipe.cost);
}
/**
 * Check if player has the required base item for an upgrade
 */
function hasRequiredItem(recipe, inventoryItemIds) {
    if (!recipe.requiresItemId)
        return true;
    return inventoryItemIds.includes(recipe.requiresItemId);
}
/**
 * Calculate total cost for displaying
 */
function getRecipeCostString(recipe) {
    return resources_1.RESOURCE_KEYS
        .filter((resourceKey) => Number(recipe.cost[resourceKey] ?? 0) > 0)
        .map((resourceKey) => `${recipe.cost[resourceKey]} ${(0, resources_1.formatResourceLabel)(resourceKey)}`)
        .join(", ");
}
/**
 * Get recipes by category (excludes deprecated recipes)
 */
function getRecipesByCategory(recipes, category) {
    return recipes.filter(r => r.category === category && !r.deprecated);
}
/**
 * Get all active (non-deprecated) recipes
 */
function getActiveRecipes(recipes) {
    return recipes.filter(r => !r.deprecated);
}
/**
 * Get deprecated recipes (for migration/history purposes)
 */
function getDeprecatedRecipes(recipes) {
    return recipes.filter(r => r.deprecated);
}
/**
 * Learn a new recipe
 */
function learnRecipe(knownRecipeIds, recipeId) {
    if (knownRecipeIds.includes(recipeId))
        return knownRecipeIds;
    if (!exports.RECIPE_DATABASE[recipeId])
        return knownRecipeIds;
    return [...knownRecipeIds, recipeId];
}
function craftItem(recipe, resources, inventoryItemIds) {
    // Prevent weapon crafting - weapons are built in Gear Builder
    if (recipe.deprecated || recipe.resultItemId.startsWith("weapon_")) {
        console.error(`[CRAFTING] Attempted to craft weapon via deprecated recipe: ${recipe.id}. Weapons must be built in Gear Builder.`);
        return {
            success: false,
            error: "Weapons are engineered in the Gear Builder, not crafted here."
        };
    }
    // Validate category - runtime check for safety
    const validCategories = ["armor", "accessory", "consumable", "upgrade"];
    if (!validCategories.includes(recipe.category)) {
        console.error(`[CRAFTING] Invalid recipe category: ${recipe.category}. Recipe ID: ${recipe.id}`);
        return {
            success: false,
            error: `Invalid recipe category: ${recipe.category}`
        };
    }
    // Check resources
    if (!canAffordRecipe(recipe, resources)) {
        return { success: false, error: "Insufficient resources" };
    }
    // Check required item for upgrades
    if (recipe.requiresItemId && !hasRequiredItem(recipe, inventoryItemIds)) {
        return { success: false, error: `Requires ${recipe.requiresItemId}` };
    }
    return {
        success: true,
        itemId: recipe.resultItemId,
        quantity: recipe.resultQuantity,
        consumedItemId: recipe.requiresItemId,
    };
}
exports.CONSUMABLE_DATABASE = {
    consumable_healing_kit: {
        id: "consumable_healing_kit",
        name: "Healing Kit",
        description: "Restores 5 HP to a unit.",
        effect: "heal",
        value: 5,
    },
    consumable_field_ration: {
        id: "consumable_field_ration",
        name: "Field Ration",
        description: "Restores 2 HP to a unit.",
        effect: "heal",
        value: 2,
    },
    consumable_smoke_bomb: {
        id: "consumable_smoke_bomb",
        name: "Smoke Bomb",
        description: "Reduces enemy accuracy for 2 turns.",
        effect: "accuracy_debuff",
        value: 2,
    },
    consumable_repair_kit: {
        id: "consumable_repair_kit",
        name: "Repair Kit",
        description: "Repairs 2 weapon damage and reduces 3 heat.",
        effect: "repair",
        value: 2,
    },
    consumable_coolant_flask: {
        id: "consumable_coolant_flask",
        name: "Coolant Flask",
        description: "Removes 3 heat from a mechanical weapon.",
        effect: "heat_reduce",
        value: 3,
    },
    consumable_overcharge_cell: {
        id: "consumable_overcharge_cell",
        name: "Overcharge Cell",
        description: "Adds 3 heat but grants +3 ATK next attack.",
        effect: "attack_boost",
        value: 3,
    },
};

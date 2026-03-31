// ============================================================================
// CHAOS CORE - CRAFTING RECIPE REGISTRY
// Data-driven recipe system loading from JSON
// ============================================================================

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export interface CraftingRecipeIngredient {
  id: string;
  qty: number;
}

export interface CraftingRecipe {
  itemId: string;
  itemName: string;
  category: string;
  craftingStation: string;
  outputQty: number;
  ingredients: CraftingRecipeIngredient[];
}

export interface CraftingRecipeData {
  version: number;
  recipes: CraftingRecipe[];
}

// ----------------------------------------------------------------------------
// REGISTRY STATE
// ----------------------------------------------------------------------------

let recipeRegistry: Map<string, CraftingRecipe> = new Map();
let isLoaded = false;
let loadError: string | null = null;

// ----------------------------------------------------------------------------
// VALIDATION
// ----------------------------------------------------------------------------

function validateRecipe(recipe: any, index: number): recipe is CraftingRecipe {
  if (!recipe || typeof recipe !== "object") {
    console.warn(`[Crafting] Recipe at index ${index} is not an object`);
    return false;
  }

  // Check required fields
  if (!recipe.itemId || typeof recipe.itemId !== "string" || recipe.itemId.trim() === "") {
    console.warn(`[Crafting] Recipe at index ${index} has invalid or missing itemId`);
    return false;
  }

  if (!recipe.ingredients || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    console.warn(`[Crafting] Recipe ${recipe.itemId} has invalid or empty ingredients array`);
    return false;
  }

  // Validate ingredients
  for (let i = 0; i < recipe.ingredients.length; i++) {
    const ing = recipe.ingredients[i];
    if (!ing || typeof ing !== "object") {
      console.warn(`[Crafting] Recipe ${recipe.itemId} has invalid ingredient at index ${i}`);
      return false;
    }
    if (!ing.id || typeof ing.id !== "string" || ing.id.trim() === "") {
      console.warn(`[Crafting] Recipe ${recipe.itemId} has ingredient with invalid id at index ${i}`);
      return false;
    }
    if (typeof ing.qty !== "number" || ing.qty <= 0 || !Number.isInteger(ing.qty)) {
      console.warn(`[Crafting] Recipe ${recipe.itemId} has ingredient ${ing.id} with invalid qty (must be positive integer)`);
      return false;
    }
  }

  // Validate other fields
  if (typeof recipe.outputQty !== "number" || recipe.outputQty <= 0 || !Number.isInteger(recipe.outputQty)) {
    console.warn(`[Crafting] Recipe ${recipe.itemId} has invalid outputQty (must be positive integer)`);
    return false;
  }

  return true;
}

function validateData(data: any): data is CraftingRecipeData {
  if (!data || typeof data !== "object") {
    console.error("[Crafting] Recipe data is not an object");
    return false;
  }

  if (typeof data.version !== "number") {
    console.error("[Crafting] Recipe data missing or invalid version field");
    return false;
  }

  if (!Array.isArray(data.recipes)) {
    console.error("[Crafting] Recipe data missing or invalid recipes array");
    return false;
  }

  return true;
}

// ----------------------------------------------------------------------------
// LOADING
// ----------------------------------------------------------------------------

/**
 * Load crafting recipes from JSON file
 * Should be called once during game initialization
 */
export async function loadCraftingRecipes(): Promise<void> {
  if (isLoaded) {
    console.log("[Crafting] Recipes already loaded, skipping");
    return;
  }

  try {
    // Fetch JSON file - Vite serves files from src/ directory
    // Try multiple paths to handle different environments
    const urls = [
      "/src/data/chaos_core_gear_crafting_recipes.json", // Vite dev server
      "/data/chaos_core_gear_crafting_recipes.json",     // Alternative path
    ];
    
    // Also try URL constructor if available
    try {
      const urlFromImport = new URL("../../data/chaos_core_gear_crafting_recipes.json", import.meta.url).href;
      urls.unshift(urlFromImport);
    } catch {
      // URL constructor not available, use fetch paths only
    }
    
    let data: any;
    let lastError: Error | null = null;
    
    for (const url of urls) {
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          continue; // Try next URL
        }
        
        const text = await response.text();
        
        // Check if response is HTML (error page) instead of JSON
        if (text.trim().startsWith("<")) {
          continue; // Try next URL
        }
        
        // Try to parse JSON
        try {
          data = JSON.parse(text);
          // Success! Break out of loop
          break;
        } catch (parseError) {
          const preview = text.substring(0, 200);
          lastError = new Error(`Failed to parse JSON from ${url}: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Response preview: ${preview}`);
          continue; // Try next URL
        }
      } catch (fetchError) {
        // Network error or other fetch issue, try next URL
        lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
        continue;
      }
    }
    
    if (!data) {
      // All URLs failed
      throw new Error(`Failed to load crafting recipes from any of the following paths: ${urls.join(", ")}. Last error: ${lastError?.message || "Unknown error"}`);
    }

    if (!validateData(data)) {
      throw new Error("Recipe data validation failed");
    }

    // Clear registry
    recipeRegistry.clear();
    let loadedCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    // Load and validate each recipe
    for (let i = 0; i < data.recipes.length; i++) {
      const recipe = data.recipes[i];
      
      if (!validateRecipe(recipe, i)) {
        invalidCount++;
        continue;
      }

      // Check for duplicates
      if (recipeRegistry.has(recipe.itemId)) {
        console.warn(`[Crafting] Duplicate recipe itemId: ${recipe.itemId}. Last definition wins.`);
        duplicateCount++;
      }

      // Register recipe (last definition wins for duplicates)
      recipeRegistry.set(recipe.itemId, recipe);
      loadedCount++;
    }

    isLoaded = true;
    loadError = null;

    console.log(`[Crafting] Loaded ${loadedCount} crafting recipes from chaos_core_gear_crafting_recipes.json`);
    if (duplicateCount > 0) {
      console.warn(`[Crafting] Found ${duplicateCount} duplicate recipes (last definition used)`);
    }
    if (invalidCount > 0) {
      console.warn(`[Crafting] Skipped ${invalidCount} invalid recipes`);
    }

    // Validate item and ingredient existence (non-fatal warnings)
    validateItemReferences();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Crafting] Failed to load recipes: ${loadError}`);
    isLoaded = false;
    throw error;
  }
}

// ----------------------------------------------------------------------------
// QUERY FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Get a recipe by itemId
 */
export function getRecipe(itemId: string): CraftingRecipe | null {
  if (!isLoaded) {
    console.warn("[Crafting] Recipes not loaded yet. Call loadCraftingRecipes() first.");
    return null;
  }
  return recipeRegistry.get(itemId) || null;
}

/**
 * Check if a recipe exists
 */
export function hasRecipe(itemId: string): boolean {
  if (!isLoaded) {
    return false;
  }
  return recipeRegistry.has(itemId);
}

/**
 * Get all recipes
 */
export function getAllRecipes(): CraftingRecipe[] {
  if (!isLoaded) {
    console.warn("[Crafting] Recipes not loaded yet. Call loadCraftingRecipes() first.");
    return [];
  }
  return Array.from(recipeRegistry.values());
}

/**
 * Get all recipes for a specific crafting station
 */
export function getRecipesByStation(station: string): CraftingRecipe[] {
  if (!isLoaded) {
    console.warn("[Crafting] Recipes not loaded yet. Call loadCraftingRecipes() first.");
    return [];
  }
  return Array.from(recipeRegistry.values()).filter(recipe => recipe.craftingStation === station);
}

/**
 * Get the number of loaded recipes
 */
export function getRecipeCount(): number {
  return recipeRegistry.size;
}

/**
 * Check if recipes are loaded
 */
export function isRecipesLoaded(): boolean {
  return isLoaded;
}

/**
 * Get load error if any
 */
export function getLoadError(): string | null {
  return loadError;
}

// ----------------------------------------------------------------------------
// VALIDATION (Item/Ingredient Existence)
// ----------------------------------------------------------------------------

/**
 * Validate that recipe items and ingredients exist in the equipment/item system
 * Logs warnings but does not fail loading (non-fatal)
 */
function validateItemReferences(): void {
  // Lazy import to avoid circular dependencies
  import("./equipment").then(({ getAllStarterEquipment }) => {
    const equipmentById = getAllStarterEquipment();
    let unknownItemCount = 0;
    const unknownIngredients = new Set<string>();

    for (const recipe of recipeRegistry.values()) {
      // Check if output item exists
      if (!equipmentById[recipe.itemId]) {
        console.warn(`[Crafting] Recipe ${recipe.itemId} references unknown output item: ${recipe.itemId}`);
        unknownItemCount++;
      }

      // Check if ingredients exist (they might be resources, not equipment)
      // For now, we'll just log them - ingredient validation would require
      // checking both equipment and resource/item databases
      for (const ing of recipe.ingredients) {
        if (!equipmentById[ing.id]) {
          // Don't warn for every recipe - collect unique unknown ingredients
          unknownIngredients.add(ing.id);
        }
      }
    }

    if (unknownItemCount > 0) {
      console.warn(`[Crafting] Found ${unknownItemCount} recipes with unknown output items (recipes still loaded)`);
    }

    if (unknownIngredients.size > 0) {
      // Only log if there are many unknown ingredients (likely resources, not equipment)
      const unknownArray = Array.from(unknownIngredients);
      if (unknownArray.length > 10) {
        console.log(`[Crafting] Note: ${unknownIngredients.size} ingredient IDs not found in equipment database (likely resources or consumables)`);
      } else {
        console.log(`[Crafting] Ingredient IDs not in equipment database: ${unknownArray.join(", ")} (likely resources or consumables)`);
      }
    }
  }).catch(() => {
    // Non-fatal - equipment system might not be available yet
    console.log("[Crafting] Could not validate item references (equipment system not available)");
  });
}

// ----------------------------------------------------------------------------
// DEBUG / VERIFICATION
// ----------------------------------------------------------------------------

/**
 * Debug function to print recipe information
 * Call this from console or dev tools to verify recipes are loaded
 */
export function debugPrintRecipes(): void {
  if (!isLoaded) {
    console.log("[Crafting] Recipes not loaded. Call loadCraftingRecipes() first.");
    return;
  }

  console.log(`[Crafting] Total recipes loaded: ${recipeRegistry.size}`);
  console.log("\n=== Recipes by Station ===");
  
  const stations = ["workbench", "forge", "arcane_table", "leatherwork", "loom", "jeweler"];
  for (const station of stations) {
    const recipes = getRecipesByStation(station);
    console.log(`\n${station.toUpperCase()} (${recipes.length} recipes):`);
    recipes.slice(0, 3).forEach(recipe => {
      console.log(`  - ${recipe.itemName} (${recipe.itemId})`);
    });
    if (recipes.length > 3) {
      console.log(`  ... and ${recipes.length - 3} more`);
    }
  }

  // Print one full recipe as example
  const firstRecipe = Array.from(recipeRegistry.values())[0];
  if (firstRecipe) {
    console.log("\n=== Example Recipe ===");
    console.log(`Item: ${firstRecipe.itemName} (${firstRecipe.itemId})`);
    console.log(`Category: ${firstRecipe.category}`);
    console.log(`Station: ${firstRecipe.craftingStation}`);
    console.log(`Output: ${firstRecipe.outputQty}`);
    console.log("Ingredients:");
    firstRecipe.ingredients.forEach(ing => {
      console.log(`  - ${ing.id}: ${ing.qty}`);
    });
  }
}

// Make debug function available globally in dev mode
if (typeof window !== "undefined") {
  (window as any).debugCraftingRecipes = debugPrintRecipes;
}


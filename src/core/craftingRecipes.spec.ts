import { describe, expect, it } from "vitest";
import {
  getLoadError,
  getRecipeCount,
  isRecipesLoaded,
  loadCraftingRecipes,
} from "./craftingRecipes";

describe("loadCraftingRecipes", () => {
  it("loads the bundled recipe registry from the static JSON import", async () => {
    if (!isRecipesLoaded()) {
      await loadCraftingRecipes();
    }

    expect(isRecipesLoaded()).toBe(true);
    expect(getLoadError()).toBeNull();
    expect(getRecipeCount()).toBeGreaterThan(0);
  });
});

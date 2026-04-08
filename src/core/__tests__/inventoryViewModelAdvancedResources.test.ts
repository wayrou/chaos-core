// @ts-nocheck

import { createNewGameState } from "../initialState";
import { buildInventoryVM } from "../inventoryViewModel";
import { createAdvancedMaterialInventoryItem } from "../materialRefinery";

describe("inventoryViewModel advanced resources", () => {
  it("shows base wallet resources plus advanced resource items from storage", () => {
    const state = createNewGameState();
    state.resources.metalScrap = 4;
    state.resources.wood = 3;
    state.inventory.baseStorage.push(createAdvancedMaterialInventoryItem("resource_alloy", 2));
    state.inventory.forwardLocker.push(createAdvancedMaterialInventoryItem("resource_resin", 1));

    const vm = buildInventoryVM(state);
    const resourceEntries = vm.entries.filter((entry) => entry.category === "resource");

    expect(resourceEntries.some((entry) => entry.id === "metalScrap" && entry.owned === 4)).toBe(true);
    expect(resourceEntries.some((entry) => entry.id === "wood" && entry.owned === 3)).toBe(true);
    expect(resourceEntries.some((entry) => entry.id === "resource_alloy" && entry.owned === 2)).toBe(true);
    expect(resourceEntries.some((entry) => entry.id === "resource_resin" && entry.owned === 1)).toBe(true);
  });
});

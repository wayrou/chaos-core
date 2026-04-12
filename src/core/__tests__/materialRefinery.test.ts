// @ts-nocheck

import { createNewGameState } from "../initialState";
import {
  canCraftMaterialRefineryRecipe,
  countAdvancedMaterialOwned,
  craftMaterialRefineryRecipe,
  getMaterialRefineryEffectiveOutputQuantity,
  getMaterialRefineryShortage,
} from "../materialRefinery";
import { markOuterDeckNpcEncounterSeen } from "../outerDecks";

describe("materialRefinery", () => {
  it("deducts base resources and stores output in base storage from HAVEN", () => {
    const state = createNewGameState();
    state.resources.metalScrap = 5;
    state.resources.steamComponents = 3;

    const next = craftMaterialRefineryRecipe(state, "resource_alloy", "haven");
    expect(next.resources.metalScrap).toBe(3);
    expect(next.resources.steamComponents).toBe(2);
    expect(next.inventory.baseStorage.some((item) => item.id === "resource_alloy")).toBe(true);
    expect(countAdvancedMaterialOwned(next, "resource_alloy")).toBe(1);
  });

  it("stores output in forward locker during an expedition", () => {
    const state = createNewGameState();
    state.resources.wood = 3;
    state.resources.chaosShards = 2;

    const next = craftMaterialRefineryRecipe(state, "resource_resin", "expedition");
    expect(next.resources.wood).toBe(1);
    expect(next.resources.chaosShards).toBe(1);
    expect(next.inventory.forwardLocker.some((item) => item.id === "resource_resin")).toBe(true);
  });

  it("reports shortages and blocks crafting when costs are not met", () => {
    const state = createNewGameState();
    state.resources.chaosShards = 1;
    state.resources.steamComponents = 0;

    expect(canCraftMaterialRefineryRecipe(state, "resource_charge_cell")).toBe(false);
    const shortage = getMaterialRefineryShortage(state, "resource_charge_cell");
    expect(shortage.length).toBeGreaterThan(0);

    const next = craftMaterialRefineryRecipe(state, "resource_charge_cell", "haven");
    expect(next).toBe(state);
  });

  it("applies outer deck support bonuses to light crafting output", () => {
    const state = createNewGameState();
    state.resources.chaosShards = 3;
    state.resources.steamComponents = 2;

    const unlocked = markOuterDeckNpcEncounterSeen(state, "intake_quartermaster");
    expect(getMaterialRefineryEffectiveOutputQuantity(unlocked, "resource_charge_cell")).toBe(2);

    const next = craftMaterialRefineryRecipe(unlocked, "resource_charge_cell", "haven");
    expect(countAdvancedMaterialOwned(next, "resource_charge_cell")).toBe(2);
  });
});

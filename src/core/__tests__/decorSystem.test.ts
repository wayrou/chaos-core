// @ts-nocheck

import { createNewGameState } from "../initialState";
import { getGameState, setGameState } from "../../state/gameStore";
import {
  getAvailableFieldDecor,
  canCraftDecorItem,
  craftDecorItem,
  getFieldDecorTurretProfile,
  getPlacedFieldDecor,
  getCraftableDecorItems,
  isFieldDecorBlocking,
  placeFieldDecor,
  setFieldDecorRotation,
} from "../decorSystem";

describe("decorSystem field fabrication", () => {
  it("keeps fabrication recipes available and supports rotated duplicate placements", () => {
    const state = createNewGameState();
    state.resources.wood = 5;
    state.resources.metalScrap = 6;
    state.resources.chaosShards = 2;
    state.resources.steamComponents = 2;
    setGameState(state);

    expect(canCraftDecorItem("decor_field_barricade", state)).toBe(true);
    expect(getCraftableDecorItems(state).some((decor) => decor.id === "decor_field_barricade")).toBe(true);
    expect(craftDecorItem("decor_field_barricade")).toBe(true);
    expect(craftDecorItem("decor_field_barricade")).toBe(true);
    expect(getCraftableDecorItems(getGameState()).some((decor) => decor.id === "decor_field_barricade")).toBe(true);
    expect(getAvailableFieldDecor(getGameState()).filter((decor) => decor.id === "decor_field_barricade")).toHaveLength(2);

    expect(placeFieldDecor("decor_field_barricade", "free_zone_1", 4, 4, 1)).toBe(true);
    expect(placeFieldDecor("decor_field_barricade", "free_zone_1", 7, 4, 0)).toBe(true);

    const placed = getPlacedFieldDecor(getGameState(), "free_zone_1");
    expect(isFieldDecorBlocking("decor_field_barricade")).toBe(true);
    expect(getFieldDecorTurretProfile("decor_field_turret")?.damage).toBe(2);
    expect(placed.filter(({ decor }) => decor.id === "decor_field_barricade")).toHaveLength(2);
    expect(placed.find(({ placement }) => placement.x === 4 && placement.y === 4)?.placement.rotationQuarterTurns).toBe(1);
    expect(getAvailableFieldDecor(getGameState()).filter((decor) => decor.id === "decor_field_barricade")).toHaveLength(0);

    const firstPlacementId = placed.find(({ placement }) => placement.x === 4 && placement.y === 4)?.placement.placementId;
    expect(firstPlacementId).toBeTruthy();
    expect(setFieldDecorRotation(firstPlacementId!, 2)).toBe(true);
    expect(
      getPlacedFieldDecor(getGameState(), "free_zone_1")
        .find(({ placement }) => placement.placementId === firstPlacementId)?.placement.rotationQuarterTurns,
    ).toBe(2);
  });
});

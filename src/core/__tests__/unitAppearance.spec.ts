import { describe, expect, it } from "vitest";

import { createNewGameState } from "../initialState";
import {
  clampUnitNotes,
  clampUnitName,
  createDefaultUnitAppearance,
  getUnitStandSpriteVariant,
  withNormalizedUnitAppearanceState,
} from "../unitAppearance";

describe("unitAppearance", () => {
  it("normalizes missing unit appearance data from existing state", () => {
    const state = createNewGameState();
    delete (state.unitsById.unit_aeriss as { appearance?: unknown }).appearance;

    const normalized = withNormalizedUnitAppearanceState(state);

    expect(normalized.unitsById.unit_aeriss.appearance).toEqual(createDefaultUnitAppearance("squire"));
    expect(getUnitStandSpriteVariant(normalized.unitsById.unit_aeriss.appearance, "squire")).toBe("squire");
  });

  it("clamps edited unit names without allowing blanks", () => {
    expect(clampUnitName("  Nova   Lance  ", "Aeriss")).toBe("Nova Lance");
    expect(clampUnitName("   ", "Aeriss")).toBe("Aeriss");
  });

  it("normalizes unit notes while preserving line breaks", () => {
    expect(clampUnitNotes("  \n  ")).toBe("");
    expect(clampUnitNotes("Watch relay flank.\r\nSwap rifle after room 2.")).toBe(
      "Watch relay flank.\nSwap rifle after room 2.",
    );
  });
});

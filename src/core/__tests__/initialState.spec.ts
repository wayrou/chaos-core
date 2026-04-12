import { describe, expect, it } from "vitest";
import { createNewGameState } from "../initialState";

describe("createNewGameState", () => {
  it("does not include the removed mage and marksman starters", () => {
    const state = createNewGameState();

    expect(state.unitsById.unit_marksman_1).toBeUndefined();
    expect(state.unitsById.unit_mage_1).toBeUndefined();
    expect(state.profile.rosterUnitIds).not.toContain("unit_marksman_1");
    expect(state.profile.rosterUnitIds).not.toContain("unit_mage_1");
    expect(state.partyUnitIds).not.toContain("unit_marksman_1");
    expect(state.partyUnitIds).not.toContain("unit_mage_1");
    expect(state.wad).toBe(300);
    expect(state.session.resourceLedger.shared.wad).toBe(300);
  });
});

// @ts-nocheck

import { createNewGameState } from "../initialState";
import {
  OUTER_DECK_OVERWORLD_MAP_ID,
  beginOuterDeckExpedition,
  claimOuterDeckCompletion,
  resolveOuterDeckMechanic,
} from "../outerDecks";
import { createOuterDeckFieldMap } from "../../field/outerDeckMaps";

describe("outerDeckMaps", () => {
  it("renders unresolved branch mechanics until the route is restored", () => {
    const started = beginOuterDeckExpedition(createNewGameState(), "counterweight_shaft", 1);
    const entryMap = createOuterDeckFieldMap("outerdeck_counterweight_shaft_lower_access", started);

    expect(entryMap?.interactionZones.some((zone) => zone.metadata?.handlerId === "outer_deck_mechanic")).toBe(true);

    const resolved = resolveOuterDeckMechanic(started, "counterweight_shaft_restore_lift_power");
    const resolvedMap = createOuterDeckFieldMap("outerdeck_counterweight_shaft_lower_access", resolved);
    expect(resolvedMap?.interactionZones.some((zone) => zone.metadata?.handlerId === "outer_deck_mechanic")).toBe(false);
  });

  it("adds elite defenders to reward rooms", () => {
    const started = beginOuterDeckExpedition(createNewGameState(), "drop_bay", 1);
    const rewardMap = createOuterDeckFieldMap("outerdeck_drop_bay_dispatch_cradle", started);
    const elite = rewardMap?.objects.find((object) => object.id.includes("_elite"));

    expect(elite).toBeTruthy();
    expect(Number(elite?.metadata?.hp ?? 0)).toBeGreaterThan(5);
  });

  it("shows reclaimed overworld support features after a zone is secured", () => {
    const completed = claimOuterDeckCompletion(beginOuterDeckExpedition(createNewGameState(), "counterweight_shaft", 1)).state;
    const overworld = createOuterDeckFieldMap(OUTER_DECK_OVERWORLD_MAP_ID, completed);

    expect(overworld?.objects.some((object) => object.id === "outer_deck_counterweight_service_lift")).toBe(true);
    expect(overworld?.objects.some((object) => object.id === "outer_deck_overworld_enemy_north_a")).toBe(false);
  });
});

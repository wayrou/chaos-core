// @ts-nocheck

import { createNewGameState } from "../initialState";
import {
  OUTER_DECK_OVERWORLD_MAP_ID,
  abortOuterDeckExpedition,
  beginOuterDeckExpedition,
  claimOuterDeckCompletion,
  createDefaultOuterDecksState,
  getOuterDeckBranchEntrySubarea,
  getOuterDeckFieldContext,
  getOuterDeckSubareaByMapId,
  getUnlockedOuterDeckZoneIds,
  isOuterDeckBranchMap,
  isOuterDeckOverworldMap,
  isOuterDeckZoneUnlocked,
  markOuterDeckCacheClaimed,
  markOuterDeckNpcEncounterSeen,
  markOuterDeckSubareaCleared,
} from "../outerDecks";

describe("outerDecks", () => {
  it("unlocks zones at floors 3, 6, 9, and 12 in the requested order", () => {
    expect(getUnlockedOuterDeckZoneIds({ highestReachedFloorOrdinal: 2 })).toEqual([]);
    expect(getUnlockedOuterDeckZoneIds({ highestReachedFloorOrdinal: 3 })).toEqual(["counterweight_shaft"]);
    expect(getUnlockedOuterDeckZoneIds({ highestReachedFloorOrdinal: 6 })).toEqual(["counterweight_shaft", "outer_scaffold"]);
    expect(getUnlockedOuterDeckZoneIds({ highestReachedFloorOrdinal: 9 })).toEqual(["counterweight_shaft", "outer_scaffold", "drop_bay"]);
    expect(getUnlockedOuterDeckZoneIds({ highestReachedFloorOrdinal: 12 })).toEqual([
      "counterweight_shaft",
      "outer_scaffold",
      "drop_bay",
      "supply_intake_port",
    ]);
    expect(isOuterDeckZoneUnlocked("supply_intake_port", { highestReachedFloorOrdinal: 11 })).toBe(false);
    expect(isOuterDeckZoneUnlocked("supply_intake_port", { highestReachedFloorOrdinal: 12 })).toBe(true);
  });

  it("starts an authored branch expedition at the entry subarea", () => {
    const state = beginOuterDeckExpedition(createNewGameState(), "counterweight_shaft", 10);
    const active = state.outerDecks?.activeExpedition;
    const entrySubarea = getOuterDeckBranchEntrySubarea("counterweight_shaft");

    expect(state.outerDecks?.isExpeditionActive).toBe(true);
    expect(active?.zoneId).toBe("counterweight_shaft");
    expect(active?.currentSubareaId).toBe(entrySubarea.id);
    expect(active?.subareas.map((subarea) => subarea.mapId)).toEqual([
      "outerdeck_counterweight_shaft_lower_access",
      "outerdeck_counterweight_shaft_lift_spine",
      "outerdeck_counterweight_shaft_counterweight_cap",
    ]);
    expect(getOuterDeckSubareaByMapId(state, entrySubarea.mapId)?.title).toContain("Lower Access");
  });

  it("marks clear/cache/npc flags on an active branch expedition", () => {
    const started = beginOuterDeckExpedition(createNewGameState(), "counterweight_shaft", 20);
    const midSubarea = started.outerDecks?.activeExpedition?.subareas[1];

    const clearedState = markOuterDeckSubareaCleared(started, midSubarea.id);
    expect(clearedState.outerDecks?.activeExpedition?.clearedSubareaIds).toContain(midSubarea.id);

    const cachedState = markOuterDeckCacheClaimed(clearedState, midSubarea.cacheId);
    expect(cachedState.outerDecks?.activeExpedition?.rewardCacheClaimedIds).toContain(midSubarea.cacheId);

    const npcState = markOuterDeckNpcEncounterSeen(cachedState, midSubarea.npcEncounterId);
    expect(npcState.outerDecks?.seenNpcEncounterIds).toContain(midSubarea.npcEncounterId);
    expect(npcState.outerDecks?.activeExpedition?.npcEncounterIds).toContain(midSubarea.npcEncounterId);
  });

  it("completes and aborts authored branch expeditions cleanly", () => {
    const completingState = beginOuterDeckExpedition(createNewGameState(), "counterweight_shaft", 5);
    const completionResult = claimOuterDeckCompletion(completingState, 20);

    expect(completionResult.awardedRecipeId).toBe("recipe_steam_valve_wristguard");
    expect(completionResult.state.outerDecks?.isExpeditionActive).toBe(false);
    expect(completionResult.state.outerDecks?.activeExpedition).toBeNull();
    expect(completionResult.state.outerDecks?.zoneCompletionCounts.counterweight_shaft).toBe(1);
    expect(completionResult.state.outerDecks?.runHistory.at(-1)?.outcome).toBe("completed");

    const abortedState = beginOuterDeckExpedition(createNewGameState(), "outer_scaffold", 10);
    const aborted = abortOuterDeckExpedition(abortedState, 30);

    expect(aborted.outerDecks?.isExpeditionActive).toBe(false);
    expect(aborted.outerDecks?.activeExpedition).toBeNull();
    expect(aborted.outerDecks?.runHistory.at(-1)?.outcome).toBe("aborted");
  });

  it("distinguishes HAVEN, overworld, and branch map contexts", () => {
    expect(isOuterDeckOverworldMap(OUTER_DECK_OVERWORLD_MAP_ID)).toBe(true);
    expect(isOuterDeckBranchMap("outerdeck_drop_bay_cargo_field")).toBe(true);
    expect(isOuterDeckBranchMap("base_camp")).toBe(false);
    expect(getOuterDeckFieldContext("base_camp")).toBe("haven");
    expect(getOuterDeckFieldContext(OUTER_DECK_OVERWORLD_MAP_ID)).toBe("outerDeckOverworld");
    expect(getOuterDeckFieldContext("outerdeck_drop_bay_cargo_field")).toBe("outerDeckBranch");
  });

  it("keeps default state empty before any branch is entered", () => {
    expect(createDefaultOuterDecksState()).toEqual({
      isExpeditionActive: false,
      activeExpedition: null,
      zoneCompletionCounts: {
        counterweight_shaft: 0,
        outer_scaffold: 0,
        drop_bay: 0,
        supply_intake_port: 0,
      },
      zoneFirstClearRecipeClaimed: {},
      seenNpcEncounterIds: [],
      runHistory: [],
    });
  });
});

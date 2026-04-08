// @ts-nocheck

import { createNewGameState } from "../initialState";
import {
  abortOuterDeckExpedition,
  claimOuterDeckCompletion,
  createDefaultOuterDecksState,
  getUnlockedOuterDeckZoneIds,
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

  it("marks clear/cache/npc flags on an active expedition state", () => {
    const state = createNewGameState();
    state.outerDecks = {
      ...createDefaultOuterDecksState(),
      isExpeditionActive: true,
      activeExpedition: {
        expeditionId: "test_run",
        zoneId: "counterweight_shaft",
        seed: "seed",
        startedAt: 1,
        currentSubareaId: "entry",
        rolledSideChamber: true,
        sideAttachmentSubareaId: "side",
        subareas: [],
        clearedSubareaIds: [],
        rewardCacheClaimedIds: [],
        npcEncounterIds: [],
        completionRewardClaimed: false,
      },
    };

    const clearedState = markOuterDeckSubareaCleared(state, "entry");
    expect(clearedState.outerDecks?.activeExpedition?.clearedSubareaIds).toContain("entry");

    const cachedState = markOuterDeckCacheClaimed(clearedState, "cache_1");
    expect(cachedState.outerDecks?.activeExpedition?.rewardCacheClaimedIds).toContain("cache_1");

    const npcState = markOuterDeckNpcEncounterSeen(cachedState, "shaft_mechanist");
    expect(npcState.outerDecks?.seenNpcEncounterIds).toContain("shaft_mechanist");
    expect(npcState.outerDecks?.activeExpedition?.npcEncounterIds).toContain("shaft_mechanist");
  });

  it("completes and aborts expeditions cleanly", () => {
    const completedState = createNewGameState();
    completedState.outerDecks = {
      ...createDefaultOuterDecksState(),
      isExpeditionActive: true,
      activeExpedition: {
        expeditionId: "complete_run",
        zoneId: "counterweight_shaft",
        seed: "seed",
        startedAt: 5,
        currentSubareaId: "reward",
        rolledSideChamber: false,
        sideAttachmentSubareaId: null,
        subareas: [],
        clearedSubareaIds: ["entry", "mid"],
        rewardCacheClaimedIds: [],
        npcEncounterIds: [],
        completionRewardClaimed: false,
      },
    };

    const completionResult = claimOuterDeckCompletion(completedState, 20);
    expect(completionResult.awardedRecipeId).toBe("recipe_steam_valve_wristguard");
    expect(completionResult.state.outerDecks?.isExpeditionActive).toBe(false);
    expect(completionResult.state.outerDecks?.zoneCompletionCounts.counterweight_shaft).toBe(1);

    const abortedState = createNewGameState();
    abortedState.outerDecks = {
      ...createDefaultOuterDecksState(),
      isExpeditionActive: true,
      activeExpedition: {
        expeditionId: "abort_run",
        zoneId: "outer_scaffold",
        seed: "seed",
        startedAt: 10,
        currentSubareaId: "mid",
        rolledSideChamber: true,
        sideAttachmentSubareaId: "side",
        subareas: [],
        clearedSubareaIds: ["entry"],
        rewardCacheClaimedIds: [],
        npcEncounterIds: [],
        completionRewardClaimed: false,
      },
    };

    const aborted = abortOuterDeckExpedition(abortedState, 30);
    expect(aborted.outerDecks?.isExpeditionActive).toBe(false);
    expect(aborted.outerDecks?.activeExpedition).toBeNull();
    expect(aborted.outerDecks?.runHistory.at(-1)?.outcome).toBe("aborted");
  });
});

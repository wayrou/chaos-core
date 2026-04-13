import { describe, expect, it } from "vitest";
import { createNewGameState } from "../initialState";
import {
  buildOwnedBaseStorageItems,
  moveOwnedItemToBaseStorage,
  moveOwnedItemToForwardLocker,
} from "../loadoutInventory";

describe("loadoutInventory legacy base storage transfers", () => {
  it("removes staged legacy consumable stacks from base storage availability", () => {
    const state = createNewGameState();
    state.inventory.baseStorage = [
      {
        id: "item_phase_battery",
        name: "Phase Battery",
        kind: "consumable",
        stackable: true,
        quantity: 3,
        massKg: 1,
        bulkBu: 1,
        powerW: 0,
        description: "A compact reserve cell.",
      },
    ];
    state.inventory.forwardLocker = [];

    const stagedState = moveOwnedItemToForwardLocker(state, "item_phase_battery");
    const stagedLockerItem = stagedState.inventory.forwardLocker.find((item) => item.id === "item_phase_battery");
    const availableAfterStaging = buildOwnedBaseStorageItems(stagedState);

    expect(stagedLockerItem?.quantity).toBe(3);
    expect(availableAfterStaging.some((item) => item.id === "item_phase_battery")).toBe(false);
  });

  it("restores staged legacy consumable stacks to base storage when returned", () => {
    const state = createNewGameState();
    state.inventory.baseStorage = [
      {
        id: "item_phase_battery",
        name: "Phase Battery",
        kind: "consumable",
        stackable: true,
        quantity: 3,
        massKg: 1,
        bulkBu: 1,
        powerW: 0,
        description: "A compact reserve cell.",
      },
    ];
    state.inventory.forwardLocker = [];

    const stagedState = moveOwnedItemToForwardLocker(state, "item_phase_battery");
    const restoredState = moveOwnedItemToBaseStorage(stagedState, "item_phase_battery");
    const restoredAvailable = buildOwnedBaseStorageItems(restoredState);
    const restoredStack = restoredAvailable.find((item) => item.id === "item_phase_battery");

    expect(restoredState.inventory.forwardLocker.some((item) => item.id === "item_phase_battery")).toBe(false);
    expect(restoredStack?.quantity).toBe(3);
  });
});

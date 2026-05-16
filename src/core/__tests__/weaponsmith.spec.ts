import { describe, expect, it } from "vitest";
import { getFieldMap } from "../../field/maps";
import { createNewGameState } from "../initialState";
import { grantSessionResources } from "../session";
import {
  COUNTERWEIGHT_WEAPONSMITH_ENCOUNTER_ID,
  getWeaponsmithUtilityItemDefinitions,
  hasApronGlider,
  hasCounterweightBoots,
  isWeaponsmithUnlocked,
  purchaseWeaponsmithUtilityItem,
  type WeaponsmithUtilityItemId,
} from "../weaponsmith";

describe("weaponsmith", () => {
  const expectedApronUtilityIds: WeaponsmithUtilityItemId[] = [
    "apron_glider",
    "anchor_spikes",
    "counterweight_boots",
    "wall_kick_spurs",
    "signal_pennant",
    "belt_lantern_upgrade",
    "insulated_mantle",
    "spark_mine",
    "panel_key_set",
    "bridge_crank",
    "scrap_magnet",
  ];

  it("unlocks from floor-six campaign progress while preserving the legacy NPC rescue flag", () => {
    const state = createNewGameState();

    expect(isWeaponsmithUnlocked(state, { highestReachedFloorOrdinal: 5 })).toBe(false);
    expect(isWeaponsmithUnlocked(state, { highestReachedFloorOrdinal: 6 })).toBe(true);
    expect(isWeaponsmithUnlocked({
      ...state,
      outerDecks: {
        ...state.outerDecks!,
        seenNpcEncounterIds: [COUNTERWEIGHT_WEAPONSMITH_ENCOUNTER_ID],
      },
    }, { highestReachedFloorOrdinal: 1 })).toBe(true);
  });

  it("sells the apron glider as an owned weaponsmith utility item", () => {
    const funded = grantSessionResources(createNewGameState(), {
      wad: 180,
      resources: {
        drawcord: 1,
        fittings: 1,
      },
    });
    const unlocked = {
      ...funded,
      outerDecks: {
        ...funded.outerDecks!,
        seenNpcEncounterIds: [COUNTERWEIGHT_WEAPONSMITH_ENCOUNTER_ID],
      },
    };

    const result = purchaseWeaponsmithUtilityItem(unlocked, "apron_glider");
    expect(result.ok).toBe(true);
    expect(hasApronGlider(result.state)).toBe(true);

    const repeated = purchaseWeaponsmithUtilityItem(result.state, "apron_glider");
    expect(repeated.ok).toBe(false);
  });

  it("lists the full first-pass apron utility kit", () => {
    expect(getWeaponsmithUtilityItemDefinitions().map((definition) => definition.id)).toEqual(expectedApronUtilityIds);
  });

  it("sells counterweight boots as an owned weaponsmith utility item", () => {
    const funded = grantSessionResources(createNewGameState(), {
      wad: 210,
      resources: {
        alloy: 1,
        fittings: 2,
        chargeCells: 1,
      },
    });
    const unlocked = {
      ...funded,
      outerDecks: {
        ...funded.outerDecks!,
        seenNpcEncounterIds: [COUNTERWEIGHT_WEAPONSMITH_ENCOUNTER_ID],
      },
    };

    const result = purchaseWeaponsmithUtilityItem(unlocked, "counterweight_boots");
    expect(result.ok).toBe(true);
    expect(hasCounterweightBoots(result.state)).toBe(true);
  });

  it("places the HAVEN weaponsmith node when stored campaign progress reaches floor six", () => {
    const originalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => key === "chaoscore_campaign_progress"
          ? JSON.stringify({ highestReachedFloorOrdinal: 6 })
          : null,
      },
    });

    try {
      const map = getFieldMap("base_camp");
      expect(map.objects.some((object) => object.id === "haven_weaponsmith_station")).toBe(true);
      expect(map.interactionZones.some((zone) => zone.id === "interact_haven_weaponsmith")).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalStorage,
      });
    }
  });
});

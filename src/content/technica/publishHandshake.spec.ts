import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "../../core/types";
import type { ImportedMailEntry, ImportedUnitTemplate } from "./types";
import { syncPublishedTechnicaContentState } from "./stateSync";

const importedMailRegistry = vi.hoisted(() => {
  let entries: ImportedMailEntry[] = [];

  return {
    get(): ImportedMailEntry[] {
      return entries.map((entry) => ({
        ...entry,
        bodyPages: [...entry.bodyPages],
      }));
    },
    set(nextEntries: ImportedMailEntry[]): void {
      entries = nextEntries.map((entry) => ({
        ...entry,
        bodyPages: [...entry.bodyPages],
      }));
    },
  };
});

const importedUnitRegistry = vi.hoisted(() => {
  let entries: ImportedUnitTemplate[] = [];

  return {
    get(): ImportedUnitTemplate[] {
      return entries.map((entry) => ({
        ...entry,
        stats: { ...entry.stats },
        loadout: { ...entry.loadout },
        traits: [...(entry.traits ?? [])],
        enemySpawnFloorOrdinals: [...(entry.enemySpawnFloorOrdinals ?? [])],
        requiredQuestIds: [...(entry.requiredQuestIds ?? [])],
        metadata: { ...(entry.metadata ?? {}) },
      }));
    },
    set(nextEntries: ImportedUnitTemplate[]): void {
      entries = nextEntries.map((entry) => ({
        ...entry,
        stats: { ...entry.stats },
        loadout: { ...entry.loadout },
        traits: [...(entry.traits ?? [])],
        enemySpawnFloorOrdinals: [...(entry.enemySpawnFloorOrdinals ?? [])],
        requiredQuestIds: [...(entry.requiredQuestIds ?? [])],
        metadata: { ...(entry.metadata ?? {}) },
      }));
    },
  };
});

const disabledUnitRegistry = vi.hoisted(() => {
  let unitIds = new Set<string>();

  return {
    reset(): void {
      unitIds = new Set<string>();
    },
    set(nextUnitIds: string[]): void {
      unitIds = new Set(nextUnitIds);
    },
    has(contentType: string, contentId: string): boolean {
      return contentType === "unit" && unitIds.has(contentId);
    },
  };
});

vi.mock("./index", () => ({
  getAllImportedCards: () => [],
  getAllImportedCodexEntries: () => [],
  getAllImportedGear: () => [],
  getAllImportedItems: () => [],
  getAllImportedKeyItems: () => [],
  getAllImportedMailEntries: () => importedMailRegistry.get(),
  getAllImportedUnits: () => importedUnitRegistry.get(),
  isTechnicaContentDisabled: (contentType: string, contentId: string) => disabledUnitRegistry.has(contentType, contentId),
}));

vi.mock("../../core/campaign", () => ({
  getHighestReachedFloorOrdinal: () => 0,
  loadCampaignProgress: () => ({}),
}));

vi.mock("../../core/equipment", () => ({
  getAllStarterEquipment: () => [],
}));

vi.mock("../../core/schemaSystem", () => ({
  getSchemaUnlockState: () => ({
    unlockedCoreTypes: [],
    unlockedFortificationPips: [],
  }),
}));

function createImportedMailEntry(id: string, subject: string, bodyPages: string[]): ImportedMailEntry {
  return {
    id,
    category: "system",
    from: "Technica Smoke Test",
    subject,
    bodyPages,
    unlockAfterFloor: 0,
    requiredDialogueIds: [],
    requiredGearIds: [],
    requiredItemIds: [],
    requiredSchemaIds: [],
    requiredFieldModIds: [],
    createdAt: "2026-04-11T00:00:00.000Z",
    updatedAt: "2026-04-11T00:00:00.000Z",
  };
}

function createImportedUnitTemplate(id: string, primaryWeapon: string): ImportedUnitTemplate {
  return {
    id,
    name: "Lucien",
    description: "Imported unit template for regression coverage.",
    currentClassId: "squire",
    spawnRole: "player",
    enemySpawnFloorOrdinals: [],
    requiredQuestIds: [],
    stats: {
      maxHp: 15,
      atk: 9,
      def: 7,
      agi: 4,
      acc: 7,
    },
    loadout: {
      primaryWeapon,
      secondaryWeapon: "",
      helmet: "",
      chestpiece: "",
      accessory1: "",
      accessory2: "",
    },
    traits: ["Frontline"],
    pwr: 42,
    recruitCost: 120,
    startingInRoster: true,
    deployInParty: true,
    metadata: {},
  };
}

function createFreshState(): GameState {
  return {
    quarters: {
      mail: {
        inbox: [],
      },
    },
    equipmentById: {},
    equipmentPool: [],
    consumables: {},
    inventory: {
      baseStorage: [],
      forwardLocker: [],
    },
    runFieldModInventory: [],
    quests: {
      completedQuests: [],
    },
    unlockedCodexEntries: [],
    technicaSync: {
      registryFingerprint: "",
    },
  } as GameState;
}

describe("Technica publish handshake", () => {
  beforeEach(() => {
    importedMailRegistry.set([]);
    importedUnitRegistry.set([]);
    disabledUnitRegistry.reset();
  });

  it("delivers floor-0 published mail to a fresh game state", () => {
    const mailId = "mail_publish_handshake_floor0";
    importedMailRegistry.set([createImportedMailEntry(mailId, "TEST TEST TEST", ["TEST TEST TEST"])]);

    const syncedState = syncPublishedTechnicaContentState(createFreshState(), "mail-floor0-v1");
    const deliveredMail = syncedState.quarters?.mail?.inbox.find((entry) => entry.id === mailId);

    expect(deliveredMail).toBeDefined();
    expect(deliveredMail?.subject).toBe("TEST TEST TEST");
    expect(deliveredMail?.bodyPages).toEqual(["TEST TEST TEST"]);
  });

  it("updates already-delivered mail when the published Technica entry changes", () => {
    const mailId = "mail_publish_handshake_update";
    importedMailRegistry.set([createImportedMailEntry(mailId, "Before publish", ["Before publish"])]);

    let syncedState = syncPublishedTechnicaContentState(createFreshState(), "mail-update-v1");

    importedMailRegistry.set([
      createImportedMailEntry(mailId, "After publish", ["After publish", "TEST TEST TEST"]),
    ]);
    syncedState = syncPublishedTechnicaContentState(syncedState, "mail-update-v2");

    const deliveredMail = syncedState.quarters?.mail?.inbox.find((entry) => entry.id === mailId);

    expect(deliveredMail).toBeDefined();
    expect(deliveredMail?.subject).toBe("After publish");
    expect(deliveredMail?.bodyPages).toEqual(["After publish", "TEST TEST TEST"]);
  });

  it("restores imported starter weapons when an existing unit saved blank loadout ids", () => {
    importedUnitRegistry.set([createImportedUnitTemplate("unit_lucien", "gear_quill_sword")]);

    const syncedState = syncPublishedTechnicaContentState(
      {
        ...createFreshState(),
        unitsById: {
          unit_lucien: {
            id: "unit_lucien",
            name: "Lucien",
            isEnemy: false,
            loadout: {
              primaryWeapon: "",
              secondaryWeapon: "",
              helmet: "",
              chestpiece: "",
              accessory1: "",
              accessory2: "",
              weapon: "",
            },
          },
        },
        partyUnitIds: [],
        profile: {
          rosterUnitIds: [],
        },
        players: {
          P1: {
            controlledUnitIds: [],
          },
        },
      } as GameState,
      "unit-sync-v1",
    );

    expect(syncedState.unitsById?.unit_lucien?.loadout?.primaryWeapon).toBe("gear_quill_sword");
    expect((syncedState.unitsById?.unit_lucien?.loadout as { weapon?: string | null } | undefined)?.weapon).toBe("gear_quill_sword");
    expect(syncedState.profile?.rosterUnitIds).toContain("unit_lucien");
    expect(syncedState.partyUnitIds).toContain("unit_lucien");
    expect(syncedState.players?.P1?.controlledUnitIds).toContain("unit_lucien");
  });

  it("prunes disabled units from saved roster and deployment state", () => {
    disabledUnitRegistry.set(["unit_marksman_1", "unit_mage_1"]);

    const syncedState = syncPublishedTechnicaContentState(
      {
        ...createFreshState(),
        unitsById: {
          unit_aeriss: { id: "unit_aeriss", name: "Aeriss", isEnemy: false },
          unit_marksman_1: { id: "unit_marksman_1", name: "Mistguard Marksman", isEnemy: false },
          unit_mage_1: { id: "unit_mage_1", name: "Field Mage", isEnemy: false },
        },
        partyUnitIds: ["unit_aeriss", "unit_marksman_1", "unit_mage_1"],
        profile: {
          rosterUnitIds: ["unit_aeriss", "unit_marksman_1", "unit_mage_1"],
        },
        players: {
          P1: {
            controlledUnitIds: ["unit_aeriss", "unit_marksman_1", "unit_mage_1"],
          },
        },
        theaterDeploymentPreset: {
          squads: [
            {
              squadId: "tp_1",
              displayName: "Squad 1",
              icon: "amber",
              colorKey: "amber",
              unitIds: ["unit_aeriss", "unit_marksman_1", "unit_mage_1"],
            },
          ],
        },
      } as GameState,
      "disabled-units-v1",
    );

    expect(Object.keys(syncedState.unitsById ?? {})).toEqual(["unit_aeriss"]);
    expect(syncedState.partyUnitIds).toEqual(["unit_aeriss"]);
    expect(syncedState.profile?.rosterUnitIds).toEqual(["unit_aeriss"]);
    expect(syncedState.players?.P1?.controlledUnitIds).toEqual(["unit_aeriss"]);
    expect(syncedState.theaterDeploymentPreset?.squads).toEqual([
      {
        squadId: "tp_1",
        displayName: "Squad 1",
        icon: "amber",
        colorKey: "amber",
        unitIds: ["unit_aeriss"],
      },
    ]);
  });
});

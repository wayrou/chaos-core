import type { FieldMap } from "../../field/types";
import type { Quest } from "../../quests/types";
import { hasGameState, updateGameState } from "../../state/gameStore";
import {
  registerImportedBattleCard,
  registerImportedClassDefinition,
  registerImportedDialogue,
  registerImportedFieldMap,
  registerImportedGear,
  registerImportedItem,
  registerImportedOperation,
  registerImportedQuest,
  registerImportedUnitTemplate
} from "./index";
import type {
  ImportedBattleCard,
  ImportedClassDefinition,
  ImportedDialogue,
  ImportedGear,
  ImportedItem,
  ImportedOperation,
  ImportedUnitTemplate
} from "./types";

export interface TechnicaManifestDependency {
  contentType: "map" | "quest" | "dialogue" | "gear" | "item" | "card" | "unit" | "operation" | "class" | "scene";
  id: string;
  relation: string;
}

export interface TechnicaManifest {
  schemaVersion: string;
  sourceApp: "Technica";
  sourceAppVersion?: string;
  exportType: "map" | "quest" | "dialogue" | "gear" | "item" | "card" | "unit" | "operation" | "class";
  contentType: "map" | "quest" | "dialogue" | "gear" | "item" | "card" | "unit" | "operation" | "class";
  targetGame: string;
  targetSchemaVersion: string;
  exportedAt: string;
  contentId: string;
  title: string;
  description: string;
  entryFile: string;
  dependencies: TechnicaManifestDependency[];
  files: string[];
}

function isFieldMap(value: unknown): value is FieldMap {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "tiles" in value &&
      "interactionZones" in value &&
      "objects" in value
  );
}

function isQuest(value: unknown): value is Quest {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "questType" in value &&
      "objectives" in value &&
      "rewards" in value
  );
}

function isDialogue(value: unknown): value is ImportedDialogue {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "entryNodeId" in value &&
      "nodes" in value
  );
}

function isGear(value: unknown): value is ImportedGear {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "slot" in value &&
      "stats" in value &&
      "cardsGranted" in value
  );
}

function isItem(value: unknown): value is ImportedItem {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "kind" in value &&
      "quantity" in value &&
      "massKg" in value
  );
}

function isCard(value: unknown): value is ImportedBattleCard {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "targetType" in value &&
      "effects" in value &&
      "rarity" in value
  );
}

function isUnit(value: unknown): value is ImportedUnitTemplate {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "currentClassId" in value &&
      "stats" in value &&
      "loadout" in value
  );
}

function isOperation(value: unknown): value is ImportedOperation {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "codename" in value &&
      "floors" in value
  );
}

function isClassDefinition(value: unknown): value is ImportedClassDefinition {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "tier" in value &&
      "weaponTypes" in value &&
      "unlockConditions" in value
  );
}

export function validateTechnicaManifest(manifest: TechnicaManifest): void {
  if (manifest.sourceApp !== "Technica") {
    throw new Error("Unsupported source app in import manifest.");
  }

  if (manifest.targetGame !== "chaos-core") {
    throw new Error(`Unsupported target game '${manifest.targetGame}'.`);
  }

  if (!manifest.entryFile) {
    throw new Error("Import manifest is missing an entry file.");
  }
}

function syncImportedGearToState(gear: ImportedGear): void {
  if (!hasGameState()) {
    return;
  }

  updateGameState((state) => {
    const equipmentById = {
      ...(state.equipmentById || {}),
      [gear.id]: gear,
    };

    const equipmentPool = gear.inventory?.startingOwned === false
      ? [...(state.equipmentPool || [])]
      : Array.from(new Set([...(state.equipmentPool || []), gear.id]));

    return {
      ...state,
      equipmentById,
      equipmentPool,
    } as typeof state;
  });
}

function syncImportedItemToState(item: ImportedItem): void {
  if (!hasGameState()) {
    return;
  }

  updateGameState((state) => {
    const baseStorage = [...(state.inventory?.baseStorage || [])];
    const existingIndex = baseStorage.findIndex((entry) => entry.id === item.id);

    if (existingIndex >= 0) {
      const existing = baseStorage[existingIndex];
      baseStorage[existingIndex] = item.stackable
        ? { ...existing, ...item, quantity: Math.max(existing.quantity, item.quantity) }
        : { ...item };
    } else {
      baseStorage.push({ ...item });
    }

    return {
      ...state,
      inventory: {
        ...state.inventory,
        baseStorage,
      },
    } as typeof state;
  });
}

function syncImportedCardToState(card: ImportedBattleCard): void {
  if (!hasGameState()) {
    return;
  }

  updateGameState((state) => ({
    ...state,
    cardsById: {
      ...state.cardsById,
      [card.id]: {
        id: card.id,
        name: card.name,
        description: card.description,
        strainCost: card.strainCost,
        targetType: card.targetType,
        range: card.range,
        effects: [...card.effects],
      },
    },
    cardLibrary: {
      ...(state.cardLibrary || {}),
      [card.id]: Math.max((state.cardLibrary || {})[card.id] ?? 0, 1),
    },
  }));
}

function syncImportedUnitToState(unit: ImportedUnitTemplate): void {
  if (!hasGameState() || unit.startingInRoster === false) {
    return;
  }

  updateGameState((state) => {
    const primaryWeapon = unit.loadout.primaryWeapon || null;
    const runtimeUnit = {
      id: unit.id,
      name: unit.name,
      isEnemy: false,
      hp: unit.stats.maxHp,
      maxHp: unit.stats.maxHp,
      agi: unit.stats.agi,
      pos: null,
      hand: [],
      drawPile: [],
      discardPile: [],
      strain: 0,
      unitClass: unit.currentClassId,
      stats: {
        maxHp: unit.stats.maxHp,
        atk: unit.stats.atk,
        def: unit.stats.def,
        agi: unit.stats.agi,
        acc: unit.stats.acc,
      },
      pwr: unit.pwr,
      loadout: {
        primaryWeapon,
        secondaryWeapon: unit.loadout.secondaryWeapon || null,
        helmet: unit.loadout.helmet || null,
        chestpiece: unit.loadout.chestpiece || null,
        accessory1: unit.loadout.accessory1 || null,
        accessory2: unit.loadout.accessory2 || null,
        weapon: primaryWeapon,
      },
      controller: "P1",
    } as any;

    return {
      ...state,
      unitsById: {
        ...state.unitsById,
        [unit.id]: runtimeUnit,
      },
      profile: {
        ...state.profile,
        rosterUnitIds: Array.from(new Set([...(state.profile.rosterUnitIds || []), unit.id])),
      },
      partyUnitIds: unit.deployInParty
        ? Array.from(new Set([...(state.partyUnitIds || []), unit.id]))
        : state.partyUnitIds,
      players: unit.deployInParty
        ? {
            ...state.players,
            P1: {
              ...state.players.P1,
              controlledUnitIds: Array.from(new Set([...(state.players.P1.controlledUnitIds || []), unit.id])),
            },
          }
        : state.players,
    };
  });
}

export function importTechnicaEntry(manifest: TechnicaManifest, entryData: unknown): string {
  validateTechnicaManifest(manifest);

  switch (manifest.contentType) {
    case "map":
      if (!isFieldMap(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core field map shape.");
      }
      registerImportedFieldMap(entryData);
      return entryData.id;

    case "quest":
      if (!isQuest(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core quest shape.");
      }
      registerImportedQuest(entryData);
      return entryData.id;

    case "dialogue":
      if (!isDialogue(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core dialogue shape.");
      }
      registerImportedDialogue(entryData);
      return entryData.id;

    case "gear":
      if (!isGear(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core gear shape.");
      }
      registerImportedGear(entryData);
      syncImportedGearToState(entryData);
      return entryData.id;

    case "item":
      if (!isItem(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core item shape.");
      }
      registerImportedItem(entryData);
      syncImportedItemToState(entryData);
      return entryData.id;

    case "card":
      if (!isCard(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core card shape.");
      }
      registerImportedBattleCard(entryData);
      syncImportedCardToState(entryData);
      return entryData.id;

    case "unit":
      if (!isUnit(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core unit shape.");
      }
      registerImportedUnitTemplate(entryData);
      syncImportedUnitToState(entryData);
      return entryData.id;

    case "operation":
      if (!isOperation(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core operation shape.");
      }
      registerImportedOperation(entryData);
      return entryData.id;

    case "class":
      if (!isClassDefinition(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core class shape.");
      }
      registerImportedClassDefinition(entryData);
      return entryData.id;

    default:
      throw new Error(`Unsupported Technica content type '${manifest.contentType}'.`);
  }
}

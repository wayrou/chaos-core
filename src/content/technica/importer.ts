import type { FieldMap } from "../../field/types";
import { updateGameState } from "../../state/gameStore";
import type { Quest } from "../../quests/types";
<<<<<<< HEAD
import { hasGameState, updateGameState } from "../../state/gameStore";
import {
  registerImportedBattleCard,
  registerImportedClassDefinition,
=======
import {
  registerImportedCard,
  registerImportedClass,
>>>>>>> 3307f1b (technica compat)
  registerImportedDialogue,
  registerImportedFieldMap,
  registerImportedGear,
  registerImportedItem,
<<<<<<< HEAD
  registerImportedOperation,
  registerImportedQuest,
  registerImportedUnitTemplate
} from "./index";
import type {
  ImportedBattleCard,
=======
  registerImportedNpc,
  registerImportedOperation,
  registerImportedQuest,
  registerImportedUnit,
} from "./index";
import type {
  ImportedCard,
>>>>>>> 3307f1b (technica compat)
  ImportedClassDefinition,
  ImportedDialogue,
  ImportedGear,
  ImportedItem,
<<<<<<< HEAD
  ImportedOperation,
  ImportedUnitTemplate
} from "./types";

export interface TechnicaManifestDependency {
  contentType: "map" | "quest" | "dialogue" | "gear" | "item" | "card" | "unit" | "operation" | "class" | "scene";
=======
  ImportedNpcTemplate,
  ImportedOperationDefinition,
  ImportedUnitTemplate,
} from "./types";

export interface TechnicaManifestDependency {
  contentType: "map" | "quest" | "dialogue" | "npc" | "item" | "gear" | "card" | "unit" | "operation" | "class" | "scene";
>>>>>>> 3307f1b (technica compat)
  id: string;
  relation: string;
}

export interface TechnicaManifest {
  schemaVersion: string;
  sourceApp: "Technica";
  sourceAppVersion?: string;
<<<<<<< HEAD
  exportType: "map" | "quest" | "dialogue" | "gear" | "item" | "card" | "unit" | "operation" | "class";
  contentType: "map" | "quest" | "dialogue" | "gear" | "item" | "card" | "unit" | "operation" | "class";
=======
  exportType: "map" | "quest" | "dialogue" | "npc" | "item" | "gear" | "card" | "unit" | "operation" | "class";
  contentType: "map" | "quest" | "dialogue" | "npc" | "item" | "gear" | "card" | "unit" | "operation" | "class";
>>>>>>> 3307f1b (technica compat)
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

export interface ImportTechnicaOptions {
  resolveAssetPath?: (relativePath: string) => string;
  syncToGameState?: boolean;
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

<<<<<<< HEAD
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

=======
>>>>>>> 3307f1b (technica compat)
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

<<<<<<< HEAD
function isCard(value: unknown): value is ImportedBattleCard {
=======
function isNpcTemplate(value: unknown): value is ImportedNpcTemplate {
>>>>>>> 3307f1b (technica compat)
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
<<<<<<< HEAD
      "targetType" in value &&
      "effects" in value &&
      "rarity" in value
  );
}

function isUnit(value: unknown): value is ImportedUnitTemplate {
=======
      "name" in value &&
      "mapId" in value &&
      "routeMode" in value
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

function isCard(value: unknown): value is ImportedCard {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "type" in value &&
      "effects" in value &&
      "targetType" in value
  );
}

function isClassDefinition(value: unknown): value is ImportedClassDefinition {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "tier" in value &&
      "baseStats" in value &&
      "unlockConditions" in value
  );
}

function isUnitTemplate(value: unknown): value is ImportedUnitTemplate {
>>>>>>> 3307f1b (technica compat)
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "currentClassId" in value &&
      "stats" in value &&
      "loadout" in value
  );
}

<<<<<<< HEAD
function isOperation(value: unknown): value is ImportedOperation {
=======
function isOperationDefinition(value: unknown): value is ImportedOperationDefinition {
>>>>>>> 3307f1b (technica compat)
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "codename" in value &&
<<<<<<< HEAD
=======
      "description" in value &&
>>>>>>> 3307f1b (technica compat)
      "floors" in value
  );
}

<<<<<<< HEAD
function isClassDefinition(value: unknown): value is ImportedClassDefinition {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "tier" in value &&
      "weaponTypes" in value &&
      "unlockConditions" in value
  );
=======
function resolveAssetPath(path: string | undefined, options?: ImportTechnicaOptions): string | undefined {
  if (!path) {
    return undefined;
  }

  if (!options?.resolveAssetPath) {
    return path;
  }

  return options.resolveAssetPath(path);
}

function withResolvedItemAssets(item: ImportedItem, options?: ImportTechnicaOptions): ImportedItem {
  return {
    ...item,
    iconPath: resolveAssetPath(item.iconPath, options)
  };
}

function withResolvedGearAssets(gear: ImportedGear, options?: ImportTechnicaOptions): ImportedGear {
  return {
    ...gear,
    iconPath: resolveAssetPath(gear.iconPath, options)
  };
}

function withResolvedCardAssets(card: ImportedCard, options?: ImportTechnicaOptions): ImportedCard {
  return {
    ...card,
    artPath: resolveAssetPath(card.artPath, options)
  };
}

function withResolvedNpcAssets(npc: ImportedNpcTemplate, options?: ImportTechnicaOptions): ImportedNpcTemplate {
  return {
    ...npc,
    portraitPath: resolveAssetPath(npc.portraitPath, options),
    spritePath: resolveAssetPath(npc.spritePath, options)
  };
}

function syncImportedItemToGameState(item: ImportedItem): void {
  updateGameState((prev) => {
    const baseStorage = [...(prev.inventory?.baseStorage ?? [])];
    const existingIndex = baseStorage.findIndex((entry) => entry.id === item.id);

    if (existingIndex >= 0) {
      baseStorage[existingIndex] = {
        ...baseStorage[existingIndex],
        ...item
      };
    } else {
      baseStorage.push({ ...item });
    }

    const nextConsumables =
      item.kind === "consumable"
        ? {
            ...prev.consumables,
            [item.id]: item.quantity
          }
        : prev.consumables;

    return {
      ...prev,
      consumables: nextConsumables,
      inventory: {
        ...prev.inventory,
        baseStorage
      }
    };
  });
}

function syncImportedGearToGameState(gear: ImportedGear): void {
  updateGameState((prev) => {
    const equipmentById = {
      ...(prev.equipmentById ?? {}),
      [gear.id]: gear
    };

    const shouldOwn = gear.inventory?.startingOwned ?? true;
    const equipmentPool = shouldOwn
      ? Array.from(new Set([...(prev.equipmentPool ?? []), gear.id]))
      : prev.equipmentPool ?? [];

    return {
      ...prev,
      equipmentById,
      equipmentPool
    };
  });
}

function syncImportedCardToGameState(card: ImportedCard): void {
  updateGameState((prev) => ({
    ...prev,
    cardsById: {
      ...prev.cardsById,
      [card.id]: {
        id: card.id,
        name: card.name,
        description: card.description,
        strainCost: card.strainCost,
        targetType: card.targetType,
        range: card.range,
        effects: [...card.effects],
        artPath: card.artPath
      }
    }
  }));
}

function syncImportedUnitToGameState(unit: ImportedUnitTemplate): void {
  if (unit.startingInRoster === false && !unit.deployInParty) {
    return;
  }

  updateGameState((prev) => {
    const nextRosterUnitIds = unit.startingInRoster === false
      ? [...prev.profile.rosterUnitIds]
      : Array.from(new Set([...(prev.profile.rosterUnitIds ?? []), unit.id]));
    const nextPartyUnitIds = unit.deployInParty
      ? Array.from(new Set([...(prev.partyUnitIds ?? []), unit.id]))
      : [...(prev.partyUnitIds ?? [])];

    return {
      ...prev,
      profile: {
        ...prev.profile,
        rosterUnitIds: nextRosterUnitIds,
      },
      partyUnitIds: nextPartyUnitIds,
      unitsById: {
        ...(prev.unitsById ?? {}),
        [unit.id]: {
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
          loadout: {
            primaryWeapon: unit.loadout.primaryWeapon ?? null,
            secondaryWeapon: unit.loadout.secondaryWeapon ?? null,
            helmet: unit.loadout.helmet ?? null,
            chestpiece: unit.loadout.chestpiece ?? null,
            accessory1: unit.loadout.accessory1 ?? null,
            accessory2: unit.loadout.accessory2 ?? null,
          },
          pwr: unit.pwr,
          controller: "P1",
        },
      },
    };
  });
>>>>>>> 3307f1b (technica compat)
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

<<<<<<< HEAD
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
=======
export function importTechnicaEntry(
  manifest: TechnicaManifest,
  entryData: unknown,
  options?: ImportTechnicaOptions
): string {
>>>>>>> 3307f1b (technica compat)
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

<<<<<<< HEAD
=======
    case "item":
      if (!isItem(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core inventory item shape.");
      }
      {
        const resolvedItem = withResolvedItemAssets(entryData, options);
        registerImportedItem(resolvedItem);
        if (options?.syncToGameState) {
          syncImportedItemToGameState(resolvedItem);
        }
        return resolvedItem.id;
      }

    case "npc":
      if (!isNpcTemplate(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core NPC shape.");
      }
      {
        const resolvedNpc = withResolvedNpcAssets(entryData, options);
        registerImportedNpc(resolvedNpc);
        return resolvedNpc.id;
      }

>>>>>>> 3307f1b (technica compat)
    case "gear":
      if (!isGear(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core gear shape.");
      }
<<<<<<< HEAD
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
=======
      {
        const resolvedGear = withResolvedGearAssets(entryData, options);
        registerImportedGear(resolvedGear);
        if (options?.syncToGameState) {
          syncImportedGearToGameState(resolvedGear);
        }
        return resolvedGear.id;
      }
>>>>>>> 3307f1b (technica compat)

    case "card":
      if (!isCard(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core card shape.");
      }
<<<<<<< HEAD
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
=======
      {
        const resolvedCard = withResolvedCardAssets(entryData, options);
        registerImportedCard(resolvedCard);
        if (options?.syncToGameState) {
          syncImportedCardToGameState(resolvedCard);
        }
        return resolvedCard.id;
      }

    case "class":
      if (!isClassDefinition(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core class definition shape.");
      }
      registerImportedClass(entryData);
      return entryData.id;

    case "unit":
      if (!isUnitTemplate(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core unit template shape.");
      }
      registerImportedUnit(entryData);
      if (options?.syncToGameState) {
        syncImportedUnitToGameState(entryData);
      }
      return entryData.id;

    case "operation":
      if (!isOperationDefinition(entryData)) {
>>>>>>> 3307f1b (technica compat)
        throw new Error("Entry data does not match the expected Chaos Core operation shape.");
      }
      registerImportedOperation(entryData);
      return entryData.id;

<<<<<<< HEAD
    case "class":
      if (!isClassDefinition(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core class shape.");
      }
      registerImportedClassDefinition(entryData);
      return entryData.id;

=======
>>>>>>> 3307f1b (technica compat)
    default:
      throw new Error(`Unsupported Technica content type '${manifest.contentType}'.`);
  }
}

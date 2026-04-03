import type { FieldMap } from "../../field/types";
import type { Quest } from "../../quests/types";
import { hasGameState, updateGameState } from "../../state/gameStore";
import {
  registerImportedCard,
  registerImportedClass,
  registerImportedDialogue,
  registerImportedFieldMap,
  registerImportedGear,
  registerImportedItem,
  registerImportedNpc,
  registerImportedOperation,
  registerImportedQuest,
  registerImportedUnit,
} from "./index";
import type {
  ImportedCard,
  ImportedClassDefinition,
  ImportedDialogue,
  ImportedGear,
  ImportedItem,
  ImportedNpcTemplate,
  ImportedOperationDefinition,
  ImportedUnitTemplate,
} from "./types";

export interface TechnicaManifestDependency {
  contentType:
    | "map"
    | "quest"
    | "dialogue"
    | "npc"
    | "item"
    | "gear"
    | "card"
    | "unit"
    | "operation"
    | "class"
    | "scene";
  id: string;
  relation: string;
}

export interface TechnicaManifest {
  schemaVersion: string;
  sourceApp: "Technica";
  sourceAppVersion?: string;
  exportType: "map" | "quest" | "dialogue" | "npc" | "item" | "gear" | "card" | "unit" | "operation" | "class";
  contentType: "map" | "quest" | "dialogue" | "npc" | "item" | "gear" | "card" | "unit" | "operation" | "class";
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
  return Boolean(value && typeof value === "object" && "id" in value && "entryNodeId" in value && "nodes" in value);
}

function isItem(value: unknown): value is ImportedItem {
  return Boolean(value && typeof value === "object" && "id" in value && "kind" in value && "quantity" in value);
}

function isNpcTemplate(value: unknown): value is ImportedNpcTemplate {
  return Boolean(value && typeof value === "object" && "id" in value && "name" in value && "mapId" in value);
}

function isGear(value: unknown): value is ImportedGear {
  return Boolean(value && typeof value === "object" && "id" in value && "slot" in value && "stats" in value);
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
      "weaponTypes" in value &&
      "unlockConditions" in value
  );
}

function isUnitTemplate(value: unknown): value is ImportedUnitTemplate {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "currentClassId" in value &&
      "stats" in value &&
      "loadout" in value
  );
}

function isOperationDefinition(value: unknown): value is ImportedOperationDefinition {
  return Boolean(value && typeof value === "object" && "id" in value && "codename" in value && "floors" in value);
}

function resolveAssetPath(path: string | undefined, options?: ImportTechnicaOptions): string | undefined {
  if (!path) {
    return undefined;
  }

  return options?.resolveAssetPath ? options.resolveAssetPath(path) : path;
}

function withResolvedItemAssets(item: ImportedItem, options?: ImportTechnicaOptions): ImportedItem {
  return { ...item, iconPath: resolveAssetPath(item.iconPath, options) };
}

function withResolvedGearAssets(gear: ImportedGear, options?: ImportTechnicaOptions): ImportedGear {
  return { ...gear, iconPath: resolveAssetPath(gear.iconPath, options) };
}

function withResolvedCardAssets(card: ImportedCard, options?: ImportTechnicaOptions): ImportedCard {
  return { ...card, artPath: resolveAssetPath(card.artPath, options) };
}

function withResolvedNpcAssets(npc: ImportedNpcTemplate, options?: ImportTechnicaOptions): ImportedNpcTemplate {
  return {
    ...npc,
    portraitPath: resolveAssetPath(npc.portraitPath, options),
    spritePath: resolveAssetPath(npc.spritePath, options),
  };
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

function syncImportedItemToGameState(item: ImportedItem): void {
  if (!hasGameState()) {
    return;
  }

  updateGameState((prev) => {
    const baseStorage = [...(prev.inventory?.baseStorage ?? [])];
    const existingIndex = baseStorage.findIndex((entry) => entry.id === item.id);

    if (existingIndex >= 0) {
      baseStorage[existingIndex] = item.stackable
        ? { ...baseStorage[existingIndex], ...item, quantity: Math.max(baseStorage[existingIndex].quantity, item.quantity) }
        : { ...baseStorage[existingIndex], ...item };
    } else {
      baseStorage.push({ ...item });
    }

    const consumables =
      item.kind === "consumable"
        ? {
            ...prev.consumables,
            [item.id]: Math.max(prev.consumables?.[item.id] ?? 0, item.quantity),
          }
        : prev.consumables;

    return {
      ...prev,
      consumables,
      inventory: {
        ...prev.inventory,
        baseStorage,
      },
    };
  });
}

function syncImportedGearToGameState(gear: ImportedGear): void {
  if (!hasGameState()) {
    return;
  }

  updateGameState((prev) => {
    const equipmentById = {
      ...(prev.equipmentById ?? {}),
      [gear.id]: gear,
    };

    const equipmentPool = gear.inventory?.startingOwned === false
      ? [...(prev.equipmentPool ?? [])]
      : Array.from(new Set([...(prev.equipmentPool ?? []), gear.id]));

    return {
      ...prev,
      equipmentById,
      equipmentPool,
    };
  });
}

function syncImportedCardToGameState(card: ImportedCard): void {
  if (!hasGameState()) {
    return;
  }

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
        artPath: card.artPath,
      },
    },
    cardLibrary: {
      ...(prev.cardLibrary ?? {}),
      [card.id]: Math.max(prev.cardLibrary?.[card.id] ?? 0, 1),
    },
  }));
}

function syncImportedUnitToGameState(unit: ImportedUnitTemplate): void {
  if (!hasGameState() || (unit.startingInRoster === false && !unit.deployInParty)) {
    return;
  }

  updateGameState((prev) => {
    const rosterUnitIds =
      unit.startingInRoster === false
        ? [...(prev.profile.rosterUnitIds ?? [])]
        : Array.from(new Set([...(prev.profile.rosterUnitIds ?? []), unit.id]));
    const partyUnitIds = unit.deployInParty
      ? Array.from(new Set([...(prev.partyUnitIds ?? []), unit.id]))
      : [...(prev.partyUnitIds ?? [])];
    const controlledUnitIds = unit.deployInParty
      ? Array.from(new Set([...(prev.players?.P1?.controlledUnitIds ?? []), unit.id]))
      : [...(prev.players?.P1?.controlledUnitIds ?? [])];

    return {
      ...prev,
      profile: {
        ...prev.profile,
        rosterUnitIds,
      },
      partyUnitIds,
      players: {
        ...prev.players,
        P1: {
          ...prev.players.P1,
          controlledUnitIds,
        },
      },
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
          stats: {
            maxHp: unit.stats.maxHp,
            atk: unit.stats.atk,
            def: unit.stats.def,
            agi: unit.stats.agi,
            acc: unit.stats.acc,
          },
          pwr: unit.pwr,
          loadout: {
            primaryWeapon: unit.loadout.primaryWeapon ?? null,
            secondaryWeapon: unit.loadout.secondaryWeapon ?? null,
            helmet: unit.loadout.helmet ?? null,
            chestpiece: unit.loadout.chestpiece ?? null,
            accessory1: unit.loadout.accessory1 ?? null,
            accessory2: unit.loadout.accessory2 ?? null,
            weapon: unit.loadout.primaryWeapon ?? null,
          },
          controller: "P1",
        },
      },
    };
  });
}

export function importTechnicaEntry(
  manifest: TechnicaManifest,
  entryData: unknown,
  options?: ImportTechnicaOptions
): string {
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

    case "item": {
      if (!isItem(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core inventory item shape.");
      }
      const resolvedItem = withResolvedItemAssets(entryData, options);
      registerImportedItem(resolvedItem);
      if (options?.syncToGameState) {
        syncImportedItemToGameState(resolvedItem);
      }
      return resolvedItem.id;
    }

    case "npc": {
      if (!isNpcTemplate(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core NPC shape.");
      }
      const resolvedNpc = withResolvedNpcAssets(entryData, options);
      registerImportedNpc(resolvedNpc);
      return resolvedNpc.id;
    }

    case "gear": {
      if (!isGear(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core gear shape.");
      }
      const resolvedGear = withResolvedGearAssets(entryData, options);
      registerImportedGear(resolvedGear);
      if (options?.syncToGameState) {
        syncImportedGearToGameState(resolvedGear);
      }
      return resolvedGear.id;
    }

    case "card": {
      if (!isCard(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core card shape.");
      }
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
        throw new Error("Entry data does not match the expected Chaos Core operation shape.");
      }
      registerImportedOperation(entryData);
      return entryData.id;

    default:
      throw new Error(`Unsupported Technica content type '${manifest.contentType}'.`);
  }
}

import type { FieldMap } from "../../field/types";
import type { Quest } from "../../quests/types";
import { hasGameState, updateGameState } from "../../state/gameStore";
import {
  getTechnicaRegistryFingerprint,
  registerImportedCard,
  registerImportedChassis,
  registerImportedChatterEntry,
  registerImportedClass,
  registerImportedCodexEntry,
  registerImportedDoctrine,
  registerImportedDialogue,
  registerImportedFieldEnemyDefinition,
  registerImportedFieldMod,
  registerImportedFaction,
  registerImportedFieldMap,
  registerImportedGear,
  registerImportedItem,
  registerImportedKeyItem,
  registerImportedMailEntry,
  registerImportedNpc,
  registerImportedOperation,
  registerImportedQuest,
  registerImportedUnit,
} from "./index";
import { syncImportedCodexUnlocks } from "../../core/codexSystem";
import { syncImportedMailUnlocks } from "../../core/mailSystem";
import { syncPublishedTechnicaContentState } from "./stateSync";
import type {
  ImportedCard,
  ImportedChassis,
  ImportedChatterEntry,
  ImportedClassDefinition,
  ImportedCodexEntry,
  ImportedDoctrine,
  ImportedDialogue,
  ImportedFieldEnemyDefinition,
  ImportedFieldMod,
  ImportedFaction,
  ImportedGear,
  ImportedItem,
  ImportedKeyItem,
  ImportedMailEntry,
  ImportedNpcTemplate,
  ImportedOperationDefinition,
  ImportedUnitTemplate,
} from "./types";

export interface TechnicaManifestDependency {
  contentType:
    | "map"
    | "mail"
    | "chatter"
    | "quest"
    | "key_item"
    | "faction"
    | "chassis"
    | "doctrine"
    | "dialogue"
    | "field_enemy"
    | "npc"
    | "item"
    | "gear"
    | "card"
    | "fieldmod"
    | "unit"
    | "operation"
    | "class"
    | "codex"
    | "scene";
  id: string;
  relation: string;
}

export interface TechnicaManifest {
  schemaVersion: string;
  sourceApp: "Technica";
  sourceAppVersion?: string;
  exportType: "map" | "mail" | "chatter" | "quest" | "key_item" | "faction" | "chassis" | "doctrine" | "dialogue" | "field_enemy" | "npc" | "item" | "gear" | "card" | "fieldmod" | "unit" | "operation" | "class" | "codex";
  contentType: "map" | "mail" | "chatter" | "quest" | "key_item" | "faction" | "chassis" | "doctrine" | "dialogue" | "field_enemy" | "npc" | "item" | "gear" | "card" | "fieldmod" | "unit" | "operation" | "class" | "codex";
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

function isMailEntry(value: unknown): value is ImportedMailEntry {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "from" in value &&
      "subject" in value &&
      "bodyPages" in value
  );
}

function isChatterEntry(value: unknown): value is ImportedChatterEntry {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "location" in value &&
      "content" in value &&
      "aerissResponse" in value
  );
}

function isFieldEnemyDefinition(value: unknown): value is ImportedFieldEnemyDefinition {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "stats" in value &&
      "spawn" in value
  );
}

function isItem(value: unknown): value is ImportedItem {
  return Boolean(value && typeof value === "object" && "id" in value && "kind" in value && "quantity" in value);
}

function isKeyItem(value: unknown): value is ImportedKeyItem {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "kind" in value &&
      "quantity" in value &&
      (value as ImportedKeyItem).kind === "key_item"
  );
}

function isFaction(value: unknown): value is ImportedFaction {
  return Boolean(value && typeof value === "object" && "id" in value && "name" in value);
}

function isChassis(value: unknown): value is ImportedChassis {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "slotType" in value &&
      "maxCardSlots" in value
  );
}

function isDoctrine(value: unknown): value is ImportedDoctrine {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "intentTags" in value &&
      "buildCostModifier" in value
  );
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
      "name" in value &&
      "description" in value &&
      "type" in value &&
      "targetType" in value &&
      "strainCost" in value &&
      "range" in value &&
      (("effects" in value && Array.isArray((value as { effects?: unknown }).effects)) || "effectFlow" in value)
  );
}

function normalizeImportedCard(value: unknown): ImportedCard | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (!isCard(value)) {
    return null;
  }

  const card = value as ImportedCard & { effects?: ImportedCard["effects"] };
  return {
    ...card,
    effects: Array.isArray(card.effects) ? [...card.effects] : [],
  };
}

function isFieldMod(value: unknown): value is ImportedFieldMod {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "trigger" in value &&
      ("effectFlow" in value || "effects" in value)
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

function isCodexEntry(value: unknown): value is ImportedCodexEntry {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "title" in value &&
      "entryType" in value &&
      "content" in value
  );
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

function withResolvedKeyItemAssets(item: ImportedKeyItem, options?: ImportTechnicaOptions): ImportedKeyItem {
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

function withResolvedFieldEnemyAssets(
  definition: ImportedFieldEnemyDefinition,
  options?: ImportTechnicaOptions,
): ImportedFieldEnemyDefinition {
  return {
    ...definition,
    spritePath: resolveAssetPath(definition.spritePath, options),
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

function syncPublishedTechnicaGameState(): void {
  if (!hasGameState()) {
    return;
  }

  updateGameState((prev) => syncPublishedTechnicaContentState(prev, getTechnicaRegistryFingerprint()));
}

export function importTechnicaRuntimeEntry(
  contentType: TechnicaManifest["contentType"],
  entryData: unknown,
  options?: ImportTechnicaOptions
): string {
  switch (contentType) {
    case "map":
      if (!isFieldMap(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core field map shape.");
      }
      registerImportedFieldMap(entryData);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return entryData.id;

    case "quest":
      if (!isQuest(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core quest shape.");
      }
      registerImportedQuest(entryData);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return entryData.id;

    case "key_item": {
      if (!isKeyItem(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core key item shape.");
      }
      const resolvedItem = withResolvedKeyItemAssets(entryData, options);
      registerImportedKeyItem(resolvedItem);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return resolvedItem.id;
    }

    case "faction":
      if (!isFaction(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core faction shape.");
      }
      registerImportedFaction(entryData);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return entryData.id;

    case "chassis":
      if (!isChassis(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core chassis shape.");
      }
      registerImportedChassis(entryData);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return entryData.id;

    case "doctrine":
      if (!isDoctrine(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core doctrine shape.");
      }
      registerImportedDoctrine(entryData);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return entryData.id;

    case "dialogue":
      if (!isDialogue(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core dialogue shape.");
      }
      registerImportedDialogue(entryData);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return entryData.id;

    case "mail":
      if (!isMailEntry(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core mail shape.");
      }
      registerImportedMailEntry(entryData);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
        syncImportedMailUnlocks();
      }
      return entryData.id;

    case "chatter":
      if (!isChatterEntry(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core chatter shape.");
      }
      registerImportedChatterEntry(entryData);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return entryData.id;

    case "field_enemy": {
      if (!isFieldEnemyDefinition(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core field enemy shape.");
      }
      const resolvedDefinition = withResolvedFieldEnemyAssets(entryData, options);
      registerImportedFieldEnemyDefinition(resolvedDefinition);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return resolvedDefinition.id;
    }

    case "item": {
      if (!isItem(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core inventory item shape.");
      }
      const resolvedItem = withResolvedItemAssets(entryData, options);
      registerImportedItem(resolvedItem);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return resolvedItem.id;
    }

    case "npc": {
      if (!isNpcTemplate(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core NPC shape.");
      }
      const resolvedNpc = withResolvedNpcAssets(entryData, options);
      registerImportedNpc(resolvedNpc);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return resolvedNpc.id;
    }

    case "gear": {
      if (!isGear(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core gear shape.");
      }
      const resolvedGear = withResolvedGearAssets(entryData, options);
      registerImportedGear(resolvedGear);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return resolvedGear.id;
    }

    case "card": {
      const normalizedCard = normalizeImportedCard(entryData);
      if (!normalizedCard) {
        throw new Error("Entry data does not match the expected Chaos Core card shape.");
      }
      const resolvedCard = withResolvedCardAssets(normalizedCard, options);
      registerImportedCard(resolvedCard);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return resolvedCard.id;
    }

    case "fieldmod":
      if (!isFieldMod(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core field mod shape.");
      }
      registerImportedFieldMod(entryData);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return entryData.id;

    case "class":
      if (!isClassDefinition(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core class definition shape.");
      }
      registerImportedClass(entryData);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return entryData.id;

    case "unit":
      if (!isUnitTemplate(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core unit template shape.");
      }
      registerImportedUnit(entryData);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return entryData.id;

    case "operation":
      if (!isOperationDefinition(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core operation shape.");
      }
      registerImportedOperation(entryData);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
      }
      return entryData.id;

    case "codex":
      if (!isCodexEntry(entryData)) {
        throw new Error("Entry data does not match the expected Chaos Core codex entry shape.");
      }
      registerImportedCodexEntry(entryData);
      if (options?.syncToGameState) {
        syncPublishedTechnicaGameState();
        syncImportedCodexUnlocks();
      }
      return entryData.id;

    default:
      throw new Error(`Unsupported Technica content type '${contentType}'.`);
  }
}

export function importTechnicaEntry(
  manifest: TechnicaManifest,
  entryData: unknown,
  options?: ImportTechnicaOptions
): string {
  validateTechnicaManifest(manifest);
  return importTechnicaRuntimeEntry(manifest.contentType, entryData, options);
}

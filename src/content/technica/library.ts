import JSZip from "jszip";
import { importTechnicaEntry, type TechnicaManifest } from "./importer";
import {
  getAllImportedBattleCards,
  getAllImportedChatterEntries,
  getAllImportedClassDefinitions,
  getAllImportedChassis,
  getAllImportedDialogues,
  getAllImportedDoctrines,
  getAllImportedFieldMaps,
  getAllImportedGear,
  getAllImportedItems,
  getAllImportedKeyItems,
  getAllImportedOperations,
  getAllImportedQuests,
  getAllImportedUnitTemplates,
  hasTechnicaRegistryEntry,
} from "./index";

type TechnicaContentType = TechnicaManifest["contentType"];
type SourceKind = "zip" | "runtime-json";

interface ParsedTechnicaCandidate {
  manifest: TechnicaManifest;
  entryData: unknown;
  sourceName: string;
  sourceKind: SourceKind;
}

export interface InstalledTechnicaContent {
  key: string;
  manifest: TechnicaManifest;
  entryData: unknown;
  importedAt: string;
  sourceName: string;
  sourceKind: SourceKind;
  warnings: string[];
}

export interface TechnicaFileImportResult {
  sourceName: string;
  success: boolean;
  contentType?: TechnicaContentType;
  contentId?: string;
  title?: string;
  warnings: string[];
  error?: string;
}

const STORAGE_KEY = "chaoscore_technica_installed_content_v1";
const installedContent = new Map<string, InstalledTechnicaContent>();
let isInitialized = false;

function createContentKey(manifest: TechnicaManifest): string {
  return `${manifest.contentType}:${manifest.contentId}`;
}

function isManifestShape(value: unknown): value is TechnicaManifest {
  return Boolean(
    value &&
      typeof value === "object" &&
      "sourceApp" in value &&
      "entryFile" in value &&
      "contentType" in value &&
      "targetGame" in value
  );
}

function isFieldMapShape(value: unknown): value is { id: string; name: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "tiles" in value &&
      "interactionZones" in value &&
      "objects" in value
  );
}

function isQuestShape(value: unknown): value is { id: string; title: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "title" in value &&
      "questType" in value &&
      "objectives" in value &&
      "rewards" in value
  );
}

function isKeyItemShape(value: unknown): value is { id: string; name: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "kind" in value &&
      "quantity" in value &&
      (value as { kind?: unknown }).kind === "key_item"
  );
}

function isFactionShape(value: unknown): value is { id: string; name: string } {
  return Boolean(value && typeof value === "object" && "id" in value && "name" in value);
}

function isChassisShape(value: unknown): value is { id: string; name: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "slotType" in value &&
      "maxCardSlots" in value
  );
}

function isDoctrineShape(value: unknown): value is { id: string; name: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "intentTags" in value &&
      "buildCostModifier" in value
  );
}

function isDialogueShape(value: unknown): value is { id: string; title: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "title" in value &&
      "entryNodeId" in value &&
      "nodes" in value
  );
}

function isMailShape(value: unknown): value is { id: string; subject: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "subject" in value &&
      "from" in value &&
      "bodyPages" in value
  );
}

function isChatterShape(value: unknown): value is { id: string; location: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "location" in value &&
      "content" in value &&
      "aerissResponse" in value
  );
}

function isFieldEnemyShape(value: unknown): value is { id: string; name: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "stats" in value &&
      "spawn" in value
  );
}

function isGearShape(value: unknown): value is { id: string; name: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "slot" in value &&
      "stats" in value
  );
}

function isItemShape(value: unknown): value is { id: string; name: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "kind" in value &&
      "quantity" in value
  );
}

function isCardShape(value: unknown): value is { id: string; name: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "targetType" in value &&
      "effects" in value
  );
}

function isUnitShape(value: unknown): value is { id: string; name: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "currentClassId" in value &&
      "stats" in value
  );
}

function isOperationShape(value: unknown): value is { id: string; codename: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "codename" in value &&
      "floors" in value
  );
}

function isClassShape(value: unknown): value is { id: string; name: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "tier" in value &&
      "weaponTypes" in value
  );
}

function isCodexShape(value: unknown): value is { id: string; title: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "title" in value &&
      "entryType" in value &&
      "content" in value
  );
}

function createSyntheticManifest(fileName: string, entryData: unknown): TechnicaManifest | null {
  const exportedAt = new Date().toISOString();

  if (isFieldMapShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "map",
      contentType: "map",
      targetGame: "chaos-core",
      targetSchemaVersion: "field-map.v1",
      exportedAt,
      contentId: entryData.id,
      title: entryData.name,
      description: "Standalone Technica field map runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isQuestShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "quest",
      contentType: "quest",
      targetGame: "chaos-core",
      targetSchemaVersion: "quest.v1",
      exportedAt,
      contentId: entryData.id,
      title: entryData.title,
      description: "Standalone Technica quest runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isKeyItemShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "key_item",
      contentType: "key_item",
      targetGame: "chaos-core",
      targetSchemaVersion: "key-item.v1",
      exportedAt,
      contentId: entryData.id,
      title: entryData.name,
      description: "Standalone Technica key item runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isFactionShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "faction",
      contentType: "faction",
      targetGame: "chaos-core",
      targetSchemaVersion: "faction.v1",
      exportedAt,
      contentId: entryData.id,
      title: entryData.name,
      description: "Standalone Technica faction runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isChassisShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "chassis",
      contentType: "chassis",
      targetGame: "chaos-core",
      targetSchemaVersion: "gear-chassis.v2",
      exportedAt,
      contentId: entryData.id,
      title: entryData.name,
      description: "Standalone Technica chassis runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isDoctrineShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "doctrine",
      contentType: "doctrine",
      targetGame: "chaos-core",
      targetSchemaVersion: "gear-doctrine.v2",
      exportedAt,
      contentId: entryData.id,
      title: entryData.name,
      description: "Standalone Technica doctrine runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isDialogueShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "dialogue",
      contentType: "dialogue",
      targetGame: "chaos-core",
      targetSchemaVersion: "dialogue.v1",
      exportedAt,
      contentId: entryData.id,
      title: entryData.title,
      description: "Standalone Technica dialogue runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isMailShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "mail",
      contentType: "mail",
      targetGame: "chaos-core",
      targetSchemaVersion: "mail-entry.v1",
      exportedAt,
      contentId: entryData.id,
      title: entryData.subject,
      description: "Standalone Technica mail runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isChatterShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "chatter",
      contentType: "chatter",
      targetGame: "chaos-core",
      targetSchemaVersion: "chatter.v1",
      exportedAt,
      contentId: entryData.id,
      title: `${String(entryData.location)} chatter`,
      description: "Standalone Technica chatter runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isFieldEnemyShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "field_enemy",
      contentType: "field_enemy",
      targetGame: "chaos-core",
      targetSchemaVersion: "field-enemy.v1",
      exportedAt,
      contentId: entryData.id,
      title: entryData.name,
      description: "Standalone Technica field enemy runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isGearShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "gear",
      contentType: "gear",
      targetGame: "chaos-core",
      targetSchemaVersion: "equipment.v1",
      exportedAt,
      contentId: entryData.id,
      title: entryData.name,
      description: "Standalone Technica gear runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isItemShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "item",
      contentType: "item",
      targetGame: "chaos-core",
      targetSchemaVersion: "inventory-item.v1",
      exportedAt,
      contentId: entryData.id,
      title: entryData.name,
      description: "Standalone Technica item runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isCardShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "card",
      contentType: "card",
      targetGame: "chaos-core",
      targetSchemaVersion: "battle-card.v1",
      exportedAt,
      contentId: entryData.id,
      title: entryData.name,
      description: "Standalone Technica card runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isUnitShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "unit",
      contentType: "unit",
      targetGame: "chaos-core",
      targetSchemaVersion: "unit-template.v1",
      exportedAt,
      contentId: entryData.id,
      title: entryData.name,
      description: "Standalone Technica unit runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isOperationShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "operation",
      contentType: "operation",
      targetGame: "chaos-core",
      targetSchemaVersion: "operation.v1",
      exportedAt,
      contentId: entryData.id,
      title: entryData.codename,
      description: "Standalone Technica operation runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isClassShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "class",
      contentType: "class",
      targetGame: "chaos-core",
      targetSchemaVersion: "class.v1",
      exportedAt,
      contentId: entryData.id,
      title: entryData.name,
      description: "Standalone Technica class runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  if (isCodexShape(entryData)) {
    return {
      schemaVersion: "1.0.0",
      sourceApp: "Technica",
      sourceAppVersion: "runtime-json",
      exportType: "codex",
      contentType: "codex",
      targetGame: "chaos-core",
      targetSchemaVersion: "codex-entry.v1",
      exportedAt,
      contentId: entryData.id,
      title: entryData.title,
      description: "Standalone Technica codex runtime file.",
      entryFile: fileName,
      dependencies: [],
      files: [fileName]
    };
  }

  return null;
}

function persistInstalledContent(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(installedContent.values())));
}

function getExistingDependencyBuckets() {
  const mapIds = new Set(getAllImportedFieldMaps().map((entry) => entry.id));
  const questIds = new Set(getAllImportedQuests().map((entry) => entry.id));
  const chatterIds = new Set(getAllImportedChatterEntries().map((entry) => entry.id));
  const keyItemIds = new Set(getAllImportedKeyItems().map((entry) => entry.id));
  const dialogueIds = new Set(getAllImportedDialogues().map((entry) => entry.id));
  const gearIds = new Set(getAllImportedGear().map((entry) => entry.id));
  const itemIds = new Set(getAllImportedItems().map((entry) => entry.id));
  const cardIds = new Set(getAllImportedBattleCards().map((entry) => entry.id));
  const unitIds = new Set(getAllImportedUnitTemplates().map((entry) => entry.id));
  const operationIds = new Set(getAllImportedOperations().map((entry) => entry.id ?? entry.codename));
  const classIds = new Set(getAllImportedClassDefinitions().map((entry) => entry.id));
  const chassisIds = new Set(getAllImportedChassis().map((entry) => entry.id));
  const doctrineIds = new Set(getAllImportedDoctrines().map((entry) => entry.id));
  const sceneIds = new Set(mapIds);

  return {
    mapIds,
    questIds,
    chatterIds,
    keyItemIds,
    dialogueIds,
    gearIds,
    itemIds,
    cardIds,
    unitIds,
    operationIds,
    classIds,
    chassisIds,
    doctrineIds,
    sceneIds
  };
}

function buildDependencyBuckets(candidates: ParsedTechnicaCandidate[]) {
  const buckets = getExistingDependencyBuckets();

  candidates.forEach(({ manifest }) => {
    if (manifest.contentType === "map") {
      buckets.mapIds.add(manifest.contentId);
      buckets.sceneIds.add(manifest.contentId);
    }

    if (manifest.contentType === "quest") {
      buckets.questIds.add(manifest.contentId);
    }

    if (manifest.contentType === "key_item") {
      buckets.keyItemIds.add(manifest.contentId);
    }

    if (manifest.contentType === "dialogue") {
      buckets.dialogueIds.add(manifest.contentId);
    }
    if (manifest.contentType === "gear") {
      buckets.gearIds.add(manifest.contentId);
    }
    if (manifest.contentType === "item") {
      buckets.itemIds.add(manifest.contentId);
    }
    if (manifest.contentType === "card") {
      buckets.cardIds.add(manifest.contentId);
    }
    if (manifest.contentType === "unit") {
      buckets.unitIds.add(manifest.contentId);
    }
    if (manifest.contentType === "operation") {
      buckets.operationIds.add(manifest.contentId);
    }
    if (manifest.contentType === "class") {
      buckets.classIds.add(manifest.contentId);
    }

    if (manifest.contentType === "chassis") {
      buckets.chassisIds.add(manifest.contentId);
    }

    if (manifest.contentType === "doctrine") {
      buckets.doctrineIds.add(manifest.contentId);
    }
  });

  return buckets;
}

function getDependencyWarnings(
  manifest: TechnicaManifest,
  buckets: ReturnType<typeof buildDependencyBuckets>
): string[] {
  return manifest.dependencies.flatMap((dependency) => {
    if (dependency.contentType === "class" || dependency.contentType === "gear") {
      // Chaos Core ships a large built-in class/gear catalog that this import
      // library does not index separately, so warning here creates false
      // positives for perfectly valid references like "squire" or starter gear.
      return [];
    }

    let exists = false;

    if (dependency.contentType === "map") {
      exists = buckets.mapIds.has(dependency.id);
    } else if (dependency.contentType === "quest") {
      exists = buckets.questIds.has(dependency.id);
    } else if (dependency.contentType === "key_item") {
      exists = buckets.keyItemIds.has(dependency.id);
    } else if (dependency.contentType === "dialogue") {
      exists = buckets.dialogueIds.has(dependency.id);
    } else if (dependency.contentType === "item") {
      exists = buckets.itemIds.has(dependency.id);
    } else if (dependency.contentType === "card") {
      exists = buckets.cardIds.has(dependency.id);
    } else if (dependency.contentType === "unit") {
      exists = buckets.unitIds.has(dependency.id);
    } else if (dependency.contentType === "operation") {
      exists = buckets.operationIds.has(dependency.id);
    } else if (dependency.contentType === "scene") {
      exists = buckets.sceneIds.has(dependency.id);
    }

    if (exists) {
      return [];
    }

    return [`Missing ${dependency.contentType} dependency '${dependency.id}' (${dependency.relation}).`];
  });
}

async function parseZipCandidate(file: File): Promise<ParsedTechnicaCandidate> {
  const archive = await JSZip.loadAsync(await file.arrayBuffer());
  const manifestFile = archive.file("manifest.json");
  if (!manifestFile) {
    throw new Error("ZIP is missing manifest.json.");
  }

  const manifest = JSON.parse(await manifestFile.async("string")) as TechnicaManifest;
  if (!isManifestShape(manifest)) {
    throw new Error("manifest.json is not a valid Technica import manifest.");
  }

  const entryFile = archive.file(manifest.entryFile);
  if (!entryFile) {
    throw new Error(`ZIP is missing the entry file '${manifest.entryFile}'.`);
  }

  const entryData = JSON.parse(await entryFile.async("string")) as unknown;
  return {
    manifest,
    entryData,
    sourceName: file.name,
    sourceKind: "zip"
  };
}

async function parseJsonCandidate(file: File): Promise<ParsedTechnicaCandidate> {
  const entryData = JSON.parse(await file.text()) as unknown;

  if (isManifestShape(entryData)) {
    throw new Error("Manifest JSON needs its matching runtime file. Drag the full Technica ZIP bundle instead.");
  }

  const manifest = createSyntheticManifest(file.name, entryData);
  if (!manifest) {
    throw new Error("This JSON file is not a Chaos Core-ready Technica runtime export.");
  }

  return {
    manifest,
    entryData,
    sourceName: file.name,
    sourceKind: "runtime-json"
  };
}

async function parseTechnicaCandidate(file: File): Promise<ParsedTechnicaCandidate> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".zip")) {
    return parseZipCandidate(file);
  }

  if (lowerName.endsWith(".json")) {
    return parseJsonCandidate(file);
  }

  throw new Error("Only Technica ZIP bundles and runtime JSON files are supported.");
}

function restoreInstalledEntry(entry: InstalledTechnicaContent): boolean {
  try {
    importTechnicaEntry(entry.manifest, entry.entryData, { syncToGameState: true });
    installedContent.set(entry.key, entry);
    return true;
  } catch (error) {
    console.warn("[TECHNICA] Skipping stored import:", entry.sourceName, error);
    return false;
  }
}

function isShadowedByPublishedContent(entry: InstalledTechnicaContent): boolean {
  return hasTechnicaRegistryEntry(entry.manifest.contentType, entry.manifest.contentId);
}

export function initializeTechnicaContentLibrary(): void {
  if (isInitialized) {
    return;
  }

  isInitialized = true;
  if (typeof window === "undefined") {
    return;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw) as InstalledTechnicaContent[];
    let removedInvalidEntries = false;

    parsed.forEach((entry) => {
      if (!entry || typeof entry !== "object" || !entry.manifest || !entry.key) {
        removedInvalidEntries = true;
        return;
      }

      if (isShadowedByPublishedContent(entry)) {
        removedInvalidEntries = true;
        console.info(
          "[TECHNICA] Skipping stored import because published content already provides this id:",
          entry.key,
        );
        return;
      }

      if (!restoreInstalledEntry(entry)) {
        removedInvalidEntries = true;
      }
    });

    if (removedInvalidEntries) {
      persistInstalledContent();
    }
  } catch (error) {
    console.warn("[TECHNICA] Failed to restore installed content:", error);
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function getInstalledTechnicaContent(): InstalledTechnicaContent[] {
  return Array.from(installedContent.values()).sort((left, right) => right.importedAt.localeCompare(left.importedAt));
}

export function getInstalledTechnicaCounts(): Record<TechnicaContentType, number> {
  return getInstalledTechnicaContent().reduce<Record<TechnicaContentType, number>>(
    (counts, entry) => {
      counts[entry.manifest.contentType] += 1;
      return counts;
    },
    {
      map: 0,
      mail: 0,
      chatter: 0,
      quest: 0,
      key_item: 0,
      faction: 0,
      chassis: 0,
      doctrine: 0,
      dialogue: 0,
      field_enemy: 0,
      npc: 0,
      gear: 0,
      item: 0,
      card: 0,
      fieldmod: 0,
      unit: 0,
      operation: 0,
      class: 0,
      codex: 0
    }
  );
}

export async function installTechnicaFiles(files: File[] | FileList): Promise<TechnicaFileImportResult[]> {
  initializeTechnicaContentLibrary();

  const fileList = Array.from(files);
  const results: TechnicaFileImportResult[] = [];
  const candidates: ParsedTechnicaCandidate[] = [];

  for (const file of fileList) {
    try {
      candidates.push(await parseTechnicaCandidate(file));
    } catch (error) {
      results.push({
        sourceName: file.name,
        success: false,
        warnings: [],
        error: error instanceof Error ? error.message : "Unknown import error."
      });
    }
  }

  if (candidates.length === 0) {
    return results;
  }

  const dependencyBuckets = buildDependencyBuckets(candidates);
  let didImportAnything = false;

  candidates.forEach((candidate) => {
    const warnings = getDependencyWarnings(candidate.manifest, dependencyBuckets);

    try {
      importTechnicaEntry(candidate.manifest, candidate.entryData, { syncToGameState: true });
      const installedEntry: InstalledTechnicaContent = {
        key: createContentKey(candidate.manifest),
        manifest: candidate.manifest,
        entryData: candidate.entryData,
        importedAt: new Date().toISOString(),
        sourceName: candidate.sourceName,
        sourceKind: candidate.sourceKind,
        warnings
      };

      installedContent.set(installedEntry.key, installedEntry);
      didImportAnything = true;

      results.push({
        sourceName: candidate.sourceName,
        success: true,
        contentType: candidate.manifest.contentType,
        contentId: candidate.manifest.contentId,
        title: candidate.manifest.title,
        warnings
      });
    } catch (error) {
      results.push({
        sourceName: candidate.sourceName,
        success: false,
        contentType: candidate.manifest.contentType,
        contentId: candidate.manifest.contentId,
        title: candidate.manifest.title,
        warnings,
        error: error instanceof Error ? error.message : "Unknown import error."
      });
    }
  });

  if (didImportAnything) {
    persistInstalledContent();
  }

  return results;
}

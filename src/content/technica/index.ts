import { invoke } from "@tauri-apps/api/core";
import type { FieldMap } from "../../field/types";
import { upsertLibraryCard } from "../../core/gearWorkbench";
import type { Quest } from "../../quests/types";
import { DEFAULT_FACTIONS } from "./defaultFactions";
import type {
  DisabledTechnicaContent,
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
  TechnicaContentType,
} from "./types";

type JsonModule<TValue> = {
  default: TValue;
};

type ImportMetaWithOptionalGlob = ImportMeta & {
  glob?: <TModule>(pattern: string, options: { eager: true }) => Record<string, TModule>;
};

type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

type GeneratedRegistryFile = {
  updatedAt?: unknown;
  entriesByType?: Partial<Record<TechnicaContentType, unknown>>;
};

type GeneratedVersionFile = {
  updatedAt?: unknown;
  contentType?: unknown;
  contentId?: unknown;
};

const importedMaps = new Map<string, FieldMap>();
const importedQuests = new Map<string, Quest>();
const importedDialogues = new Map<string, ImportedDialogue>();
const importedMailEntries = new Map<string, ImportedMailEntry>();
const importedChatterEntries = new Map<string, ImportedChatterEntry>();
const importedKeyItems = new Map<string, ImportedKeyItem>();
const importedFactions = new Map<string, ImportedFaction>();
const importedChassis = new Map<string, ImportedChassis>();
const importedDoctrines = new Map<string, ImportedDoctrine>();
const importedItems = new Map<string, ImportedItem>();
const importedFieldEnemies = new Map<string, ImportedFieldEnemyDefinition>();
const importedNpcs = new Map<string, ImportedNpcTemplate>();
const importedGear = new Map<string, ImportedGear>();
const importedCards = new Map<string, ImportedCard>();
const importedFieldMods = new Map<string, ImportedFieldMod>();
const importedClasses = new Map<string, ImportedClassDefinition>();
const importedUnits = new Map<string, ImportedUnitTemplate>();
const importedOperations = new Map<string, ImportedOperationDefinition>();
const importedCodexEntries = new Map<string, ImportedCodexEntry>();
const technicaRegistrySnapshots = new Map<string, string>();
let technicaRegistryFingerprintCache = "";
const disabledContentIds = new Map<TechnicaContentType, Set<string>>([
  ["dialogue", new Set()],
  ["mail", new Set()],
  ["chatter", new Set()],
  ["quest", new Set()],
  ["key_item", new Set()],
  ["faction", new Set()],
  ["chassis", new Set()],
  ["doctrine", new Set()],
  ["map", new Set()],
  ["field_enemy", new Set()],
  ["npc", new Set()],
  ["item", new Set()],
  ["gear", new Set()],
  ["card", new Set()],
  ["fieldmod", new Set()],
  ["unit", new Set()],
  ["operation", new Set()],
  ["class", new Set()],
  ["codex", new Set()],
]);

const GENERATED_RUNTIME_FILE_EXTENSIONS: Record<TechnicaContentType, string> = {
  dialogue: ".dialogue.json",
  mail: ".mail.json",
  chatter: ".chatter.json",
  quest: ".quest.json",
  key_item: ".key_item.json",
  faction: ".faction.json",
  chassis: ".chassis.json",
  doctrine: ".doctrine.json",
  map: ".fieldmap.json",
  field_enemy: ".field_enemy.json",
  npc: ".npc.json",
  item: ".item.json",
  gear: ".gear.json",
  card: ".card.json",
  fieldmod: ".fieldmod.json",
  unit: ".unit.json",
  operation: ".operation.json",
  class: ".class.json",
  codex: ".codex.json",
};

const HYDRATABLE_GENERATED_CONTENT_TYPES: TechnicaContentType[] = [
  "dialogue",
  "mail",
  "chatter",
  "quest",
  "key_item",
  "faction",
  "chassis",
  "doctrine",
  "map",
  "field_enemy",
  "npc",
  "item",
  "gear",
  "card",
  "fieldmod",
  "unit",
  "operation",
  "class",
  "codex",
];

let generatedRegistryHydrationPromise: Promise<void> | null = null;
let generatedRegistryHydrated = false;

function getImportedUnitSpawnRole(unit: ImportedUnitTemplate): "player" | "enemy" {
  return unit.spawnRole === "enemy" ? "enemy" : "player";
}

function loadGeneratedRegistry<TValue extends { id: string }>(
  modules: Record<string, JsonModule<TValue>>,
  register: (value: TValue) => void
) {
  Object.values(modules).forEach((module) => {
    register(module.default);
  });
}

function buildGeneratedRuntimePath(contentType: TechnicaContentType, contentId: string): string {
  return `/src/content/technica/generated/${contentType}/${encodeURIComponent(contentId)}${GENERATED_RUNTIME_FILE_EXTENSIONS[contentType]}`;
}

function recordTechnicaRegistrySnapshot(contentType: TechnicaContentType, contentId: string, value: unknown): void {
  technicaRegistrySnapshots.set(`${contentType}:${contentId}`, JSON.stringify(value));
  technicaRegistryFingerprintCache = "";
}

function recordDisabledTechnicaContentSnapshot(entry: DisabledTechnicaContent): void {
  technicaRegistrySnapshots.set(`disabled:${entry.contentType}:${entry.id}`, JSON.stringify(entry));
  technicaRegistryFingerprintCache = "";
}

function getTauriInvoke(): TauriInvoke | null {
  if (typeof window === "undefined") {
    return null;
  }

  const anyWindow = window as unknown as {
    __TAURI__?: { invoke?: TauriInvoke };
    __TAURI_INTERNALS__?: unknown;
  };
  if (typeof anyWindow.__TAURI__?.invoke === "function") {
    return anyWindow.__TAURI__.invoke;
  }

  return anyWindow.__TAURI__ || anyWindow.__TAURI_INTERNALS__ ? invoke : null;
}

function isTauriAvailable(): boolean {
  return getTauriInvoke() !== null;
}

async function readGeneratedJsonThroughTauri<TValue>(
  command: string,
  args?: Record<string, unknown>
): Promise<TValue | null> {
  const invoke = getTauriInvoke();
  if (!invoke) {
    return null;
  }

  try {
    const raw = await invoke(command, args);
    if (typeof raw !== "string" || !raw.trim()) {
      return null;
    }

    return JSON.parse(raw) as TValue;
  } catch {
    return null;
  }
}

async function fetchGeneratedRuntimeEntry<TValue>(contentType: TechnicaContentType, contentId: string): Promise<TValue | null> {
  if (!contentId.trim()) {
    return null;
  }

  const tauriEntry = await readGeneratedJsonThroughTauri<TValue>("read_generated_technica_entry", {
    contentType,
    contentId
  });
  if (tauriEntry) {
    return tauriEntry;
  }

  if (typeof window === "undefined" || !import.meta.env.DEV) {
    return null;
  }

  try {
    const response = await fetch(`${buildGeneratedRuntimePath(contentType, contentId)}?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as TValue;
  } catch {
    return null;
  }
}

async function fetchGeneratedRuntimeRegistry(): Promise<GeneratedRegistryFile | null> {
  const tauriRegistry = await readGeneratedJsonThroughTauri<GeneratedRegistryFile>("read_generated_technica_registry");
  if (tauriRegistry) {
    return tauriRegistry;
  }

  if (typeof window === "undefined" || !import.meta.env.DEV) {
    return null;
  }

  try {
    const response = await fetch(`/src/content/technica/generated/registry.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as GeneratedRegistryFile;
  } catch {
    return null;
  }
}

export async function readGeneratedTechnicaVersionMarker(): Promise<GeneratedVersionFile | null> {
  const tauriVersion = await readGeneratedJsonThroughTauri<GeneratedVersionFile>("read_generated_technica_version");
  if (tauriVersion) {
    return tauriVersion;
  }

  if (typeof window === "undefined" || !import.meta.env.DEV) {
    return null;
  }

  try {
    const response = await fetch(`/src/content/technica/generated/version.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as GeneratedVersionFile;
  } catch {
    return null;
  }
}

function normalizeGeneratedRegistryIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map((entry) => String(entry).trim()).filter(Boolean)));
}

if (typeof (import.meta as ImportMetaWithOptionalGlob).glob === "function") {
  loadGeneratedRegistry(
    import.meta.glob<JsonModule<DisabledTechnicaContent>>("./disabled/*/*.disabled.json", { eager: true }) as Record<
      string,
      JsonModule<DisabledTechnicaContent>
    >,
    (entry) => {
      if (entry.origin === "game") {
        disabledContentIds.get(entry.contentType)?.add(entry.id);
        recordDisabledTechnicaContentSnapshot(entry);
      }
    }
  );

  DEFAULT_FACTIONS.forEach((entry) => {
    registerImportedFaction(entry);
  });

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<FieldMap>>("./generated/map/*.fieldmap.json", { eager: true }) as Record<
      string,
      JsonModule<FieldMap>
    >,
    registerImportedFieldMap
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<Quest>>("./generated/quest/*.quest.json", { eager: true }) as Record<
      string,
      JsonModule<Quest>
    >,
    registerImportedQuest
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedFieldEnemyDefinition>>("./generated/field_enemy/*.field_enemy.json", {
      eager: true,
    }) as Record<string, JsonModule<ImportedFieldEnemyDefinition>>,
    registerImportedFieldEnemyDefinition
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedDialogue>>("./generated/dialogue/*.dialogue.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedDialogue>
    >,
    registerImportedDialogue
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedMailEntry>>("./generated/mail/*.mail.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedMailEntry>
    >,
    registerImportedMailEntry
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedChatterEntry>>("./generated/chatter/*.chatter.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedChatterEntry>
    >,
    registerImportedChatterEntry
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedFaction>>("./generated/faction/*.faction.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedFaction>
    >,
    registerImportedFaction
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedChassis>>("./generated/chassis/*.chassis.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedChassis>
    >,
    registerImportedChassis
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedDoctrine>>("./generated/doctrine/*.doctrine.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedDoctrine>
    >,
    registerImportedDoctrine
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedKeyItem>>("./generated/key_item/*.key_item.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedKeyItem>
    >,
    registerImportedKeyItem
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedItem>>("./generated/item/*.item.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedItem>
    >,
    registerImportedItem
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedNpcTemplate>>("./generated/npc/*.npc.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedNpcTemplate>
    >,
    registerImportedNpc
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedGear>>("./generated/gear/*.gear.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedGear>
    >,
    registerImportedGear
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedCard>>("./generated/card/*.card.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedCard>
    >,
    registerImportedCard
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedFieldMod>>("./generated/fieldmod/*.fieldmod.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedFieldMod>
    >,
    registerImportedFieldMod
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedClassDefinition>>("./generated/class/*.class.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedClassDefinition>
    >,
    registerImportedClass
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedUnitTemplate>>("./generated/unit/*.unit.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedUnitTemplate>
    >,
    registerImportedUnit
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedOperationDefinition>>("./generated/operation/*.operation.json", {
      eager: true,
    }) as Record<string, JsonModule<ImportedOperationDefinition>>,
    registerImportedOperation
  );

  loadGeneratedRegistry(
    import.meta.glob<JsonModule<ImportedCodexEntry>>("./generated/codex/*.codex.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedCodexEntry>
    >,
    registerImportedCodexEntry
  );
}

export function registerImportedFieldMap(map: FieldMap): void {
  importedMaps.set(map.id, map);
  recordTechnicaRegistrySnapshot("map", map.id, map);
}

export function getImportedFieldMap(mapId: string): FieldMap | null {
  return importedMaps.get(mapId) || null;
}

export function getImportedFieldMapIds(): string[] {
  return Array.from(importedMaps.keys());
}

export function getAllImportedFieldMaps(): FieldMap[] {
  return Array.from(importedMaps.values());
}

export function registerImportedQuest(quest: Quest): void {
  importedQuests.set(quest.id, quest);
  recordTechnicaRegistrySnapshot("quest", quest.id, quest);
}

export function getImportedQuest(questId: string): Quest | null {
  return importedQuests.get(questId) || null;
}

export function getAllImportedQuests(): Quest[] {
  return Array.from(importedQuests.values());
}

export function registerImportedFieldEnemyDefinition(definition: ImportedFieldEnemyDefinition): void {
  importedFieldEnemies.set(definition.id, definition);
  recordTechnicaRegistrySnapshot("field_enemy", definition.id, definition);
}

export function getImportedFieldEnemyDefinition(definitionId: string): ImportedFieldEnemyDefinition | null {
  return importedFieldEnemies.get(definitionId) || null;
}

export function getAllImportedFieldEnemyDefinitions(): ImportedFieldEnemyDefinition[] {
  return Array.from(importedFieldEnemies.values());
}

export function registerImportedDialogue(dialogue: ImportedDialogue): void {
  importedDialogues.set(dialogue.id, dialogue);
  recordTechnicaRegistrySnapshot("dialogue", dialogue.id, dialogue);
}

export function getImportedDialogue(dialogueId: string): ImportedDialogue | null {
  return importedDialogues.get(dialogueId) || null;
}

export function getAllImportedDialogues(): ImportedDialogue[] {
  return Array.from(importedDialogues.values());
}

export function hasImportedDialogue(dialogueId: string): boolean {
  return importedDialogues.has(dialogueId);
}

export function registerImportedMailEntry(entry: ImportedMailEntry): void {
  importedMailEntries.set(entry.id, entry);
  recordTechnicaRegistrySnapshot("mail", entry.id, entry);
}

export function getImportedMailEntry(entryId: string): ImportedMailEntry | null {
  return importedMailEntries.get(entryId) || null;
}

export function getAllImportedMailEntries(): ImportedMailEntry[] {
  return Array.from(importedMailEntries.values());
}

export function registerImportedChatterEntry(entry: ImportedChatterEntry): void {
  importedChatterEntries.set(entry.id, entry);
  recordTechnicaRegistrySnapshot("chatter", entry.id, entry);
}

export function getImportedChatterEntry(entryId: string): ImportedChatterEntry | null {
  return importedChatterEntries.get(entryId) || null;
}

export function getAllImportedChatterEntries(): ImportedChatterEntry[] {
  return Array.from(importedChatterEntries.values());
}

export function registerImportedKeyItem(item: ImportedKeyItem): void {
  importedKeyItems.set(item.id, item);
  recordTechnicaRegistrySnapshot("key_item", item.id, item);
}

export function getImportedKeyItem(itemId: string): ImportedKeyItem | null {
  return importedKeyItems.get(itemId) || null;
}

export function getAllImportedKeyItems(): ImportedKeyItem[] {
  return Array.from(importedKeyItems.values());
}

export function registerImportedFaction(faction: ImportedFaction): void {
  importedFactions.set(faction.id, faction);
  recordTechnicaRegistrySnapshot("faction", faction.id, faction);
}

export function getImportedFaction(factionId: string): ImportedFaction | null {
  return importedFactions.get(factionId) || null;
}

export function getAllImportedFactions(): ImportedFaction[] {
  return Array.from(importedFactions.values());
}

export function registerImportedChassis(chassis: ImportedChassis): void {
  importedChassis.set(chassis.id, chassis);
  recordTechnicaRegistrySnapshot("chassis", chassis.id, chassis);
}

export function getImportedChassis(chassisId: string): ImportedChassis | null {
  return importedChassis.get(chassisId) || null;
}

export function getAllImportedChassis(): ImportedChassis[] {
  return Array.from(importedChassis.values()).filter((entry) => !isTechnicaContentDisabled("chassis", entry.id));
}

export function registerImportedDoctrine(doctrine: ImportedDoctrine): void {
  importedDoctrines.set(doctrine.id, doctrine);
  recordTechnicaRegistrySnapshot("doctrine", doctrine.id, doctrine);
}

export function getImportedDoctrine(doctrineId: string): ImportedDoctrine | null {
  return importedDoctrines.get(doctrineId) || null;
}

export function getAllImportedDoctrines(): ImportedDoctrine[] {
  return Array.from(importedDoctrines.values()).filter((entry) => !isTechnicaContentDisabled("doctrine", entry.id));
}

export function registerImportedItem(item: ImportedItem): void {
  importedItems.set(item.id, item);
  recordTechnicaRegistrySnapshot("item", item.id, item);
}

export function getImportedItem(itemId: string): ImportedItem | null {
  return importedItems.get(itemId) || null;
}

export function getAllImportedItems(): ImportedItem[] {
  return Array.from(importedItems.values());
}

export function getImportedStarterItems(): ImportedItem[] {
  return getAllImportedItems().filter((entry) => entry.acquisition?.startsWithPlayer !== false);
}

export function registerImportedNpc(npc: ImportedNpcTemplate): void {
  importedNpcs.set(npc.id, npc);
  recordTechnicaRegistrySnapshot("npc", npc.id, npc);
}

export function getImportedNpc(npcId: string): ImportedNpcTemplate | null {
  return importedNpcs.get(npcId) || null;
}

export function getAllImportedNpcs(): ImportedNpcTemplate[] {
  return Array.from(importedNpcs.values());
}

export function registerImportedGear(gear: ImportedGear): void {
  importedGear.set(gear.id, gear);
  recordTechnicaRegistrySnapshot("gear", gear.id, gear);
}

export function getImportedGear(gearId: string): ImportedGear | null {
  return importedGear.get(gearId) || null;
}

export function getAllImportedGear(): ImportedGear[] {
  return Array.from(importedGear.values());
}

export function getImportedStarterGear(): ImportedGear[] {
  return getAllImportedGear().filter((entry) => entry.inventory?.startingOwned !== false);
}

export function registerImportedCard(card: ImportedCard): void {
  importedCards.set(card.id, card);
  recordTechnicaRegistrySnapshot("card", card.id, card);
  upsertLibraryCard({
    id: card.id,
    name: card.name,
    rarity: card.rarity ?? "common",
    category: card.category ?? "utility",
    description: card.description,
    strainCost: card.strainCost,
    artPath: card.artPath,
  });
}

export function registerImportedFieldMod(fieldMod: ImportedFieldMod): void {
  importedFieldMods.set(fieldMod.id, fieldMod);
  recordTechnicaRegistrySnapshot("fieldmod", fieldMod.id, fieldMod);
}

export function getImportedFieldMod(fieldModId: string): ImportedFieldMod | null {
  return importedFieldMods.get(fieldModId) || null;
}

export function getAllImportedFieldMods(): ImportedFieldMod[] {
  return Array.from(importedFieldMods.values());
}

export function registerImportedBattleCard(card: ImportedCard): void {
  registerImportedCard(card);
}

export function getImportedCard(cardId: string): ImportedCard | null {
  return importedCards.get(cardId) || null;
}

export function getImportedBattleCard(cardId: string): ImportedCard | null {
  return getImportedCard(cardId);
}

export function getAllImportedCards(): ImportedCard[] {
  return Array.from(importedCards.values());
}

export function getAllImportedBattleCards(): ImportedCard[] {
  return getAllImportedCards();
}

export function getImportedStarterBattleCards(): ImportedCard[] {
  return getAllImportedCards();
}

export function registerImportedClass(classDefinition: ImportedClassDefinition): void {
  importedClasses.set(classDefinition.id, classDefinition);
  recordTechnicaRegistrySnapshot("class", classDefinition.id, classDefinition);
}

export function registerImportedClassDefinition(classDefinition: ImportedClassDefinition): void {
  registerImportedClass(classDefinition);
}

export function getImportedClass(classId: string): ImportedClassDefinition | null {
  return importedClasses.get(classId) || null;
}

export function getImportedClassDefinition(classId: string): ImportedClassDefinition | null {
  return getImportedClass(classId);
}

export function getAllImportedClasses(): ImportedClassDefinition[] {
  return Array.from(importedClasses.values());
}

export function getAllImportedClassDefinitions(): ImportedClassDefinition[] {
  return getAllImportedClasses();
}

export function registerImportedUnit(unit: ImportedUnitTemplate): void {
  importedUnits.set(unit.id, unit);
  recordTechnicaRegistrySnapshot("unit", unit.id, unit);
}

export function registerImportedUnitTemplate(unit: ImportedUnitTemplate): void {
  registerImportedUnit(unit);
}

export function getImportedUnit(unitId: string): ImportedUnitTemplate | null {
  if (isTechnicaContentDisabled("unit", unitId)) {
    return null;
  }

  return importedUnits.get(unitId) || null;
}

export function getImportedUnitTemplate(unitId: string): ImportedUnitTemplate | null {
  return getImportedUnit(unitId);
}

export function getAllImportedUnits(): ImportedUnitTemplate[] {
  return Array.from(importedUnits.values()).filter((entry) => !isTechnicaContentDisabled("unit", entry.id));
}

export function getAllImportedUnitTemplates(): ImportedUnitTemplate[] {
  return getAllImportedUnits();
}

export function getImportedRosterUnits(): ImportedUnitTemplate[] {
  return getAllImportedUnits().filter(
    (entry) => getImportedUnitSpawnRole(entry) !== "enemy" && entry.startingInRoster !== false
  );
}

export function getImportedEncounterUnitsForFloorOrdinal(floorOrdinal: number): ImportedUnitTemplate[] {
  return getAllImportedUnits().filter((entry) => {
    if (getImportedUnitSpawnRole(entry) !== "enemy") {
      return false;
    }

    return (entry.enemySpawnFloorOrdinals ?? []).includes(floorOrdinal);
  });
}

export function registerImportedOperation(operation: ImportedOperationDefinition): void {
  importedOperations.set(operation.id, operation);
  recordTechnicaRegistrySnapshot("operation", operation.id, operation);
}

export function getImportedOperation(operationId: string): ImportedOperationDefinition | null {
  return importedOperations.get(operationId) || null;
}

export function getAllImportedOperations(): ImportedOperationDefinition[] {
  return Array.from(importedOperations.values());
}

export function registerImportedCodexEntry(entry: ImportedCodexEntry): void {
  importedCodexEntries.set(entry.id, entry);
  recordTechnicaRegistrySnapshot("codex", entry.id, entry);
}

export function getImportedCodexEntry(entryId: string): ImportedCodexEntry | null {
  return importedCodexEntries.get(entryId) || null;
}

export function getAllImportedCodexEntries(): ImportedCodexEntry[] {
  return Array.from(importedCodexEntries.values());
}

function getTechnicaRegistry(contentType: TechnicaContentType): Map<string, unknown> {
  switch (contentType) {
    case "map":
      return importedMaps;
    case "quest":
      return importedQuests;
    case "dialogue":
      return importedDialogues;
    case "mail":
      return importedMailEntries;
    case "chatter":
      return importedChatterEntries;
    case "key_item":
      return importedKeyItems;
    case "faction":
      return importedFactions;
    case "chassis":
      return importedChassis;
    case "doctrine":
      return importedDoctrines;
    case "field_enemy":
      return importedFieldEnemies;
    case "npc":
      return importedNpcs;
    case "item":
      return importedItems;
    case "gear":
      return importedGear;
    case "card":
      return importedCards;
    case "fieldmod":
      return importedFieldMods;
    case "unit":
      return importedUnits;
    case "operation":
      return importedOperations;
    case "class":
      return importedClasses;
    case "codex":
      return importedCodexEntries;
  }
}

export function hasTechnicaRegistryEntry(contentType: TechnicaContentType, contentId: string): boolean {
  const normalizedContentId = contentId.trim();
  if (!normalizedContentId) {
    return false;
  }

  return getTechnicaRegistry(contentType).has(normalizedContentId);
}

export function isTechnicaContentDisabled(contentType: TechnicaContentType, contentId: string): boolean {
  return disabledContentIds.get(contentType)?.has(contentId) ?? false;
}

export function getTechnicaRegistryFingerprint(): string {
  if (!technicaRegistryFingerprintCache) {
    technicaRegistryFingerprintCache = Array.from(technicaRegistrySnapshots.entries())
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, snapshot]) => `${key}:${snapshot}`)
      .join("|");
  }

  return technicaRegistryFingerprintCache;
}

export async function hydrateGeneratedTechnicaRegistry(): Promise<void> {
  if (generatedRegistryHydrated) {
    return;
  }

  if (generatedRegistryHydrationPromise) {
    return generatedRegistryHydrationPromise;
  }

  generatedRegistryHydrationPromise = (async () => {
    const registry = await fetchGeneratedRuntimeRegistry();
    if (!registry?.entriesByType) {
      generatedRegistryHydrated = true;
      return;
    }

    const { importTechnicaRuntimeEntry } = await import("./importer");
    let importedAnyEntries = false;

    for (const contentType of HYDRATABLE_GENERATED_CONTENT_TYPES) {
      const contentIds = normalizeGeneratedRegistryIds(registry.entriesByType[contentType]);
      for (const contentId of contentIds) {
        const entry = await fetchGeneratedRuntimeEntry<unknown>(contentType, contentId);
        if (!entry) {
          continue;
        }

        try {
          importTechnicaRuntimeEntry(contentType, entry, { syncToGameState: false });
          importedAnyEntries = true;
        } catch (error) {
          console.warn(`[TECHNICA] Skipping generated ${contentType} '${contentId}' during startup hydration.`, error);
        }
      }
    }

    if (importedAnyEntries) {
      const [{ hasGameState, updateGameState }, { syncPublishedTechnicaContentState }] = await Promise.all([
        import("../../state/gameStore"),
        import("./stateSync"),
      ]);

      if (hasGameState()) {
        const registryFingerprint = getTechnicaRegistryFingerprint();
        updateGameState((prev) => syncPublishedTechnicaContentState(prev, registryFingerprint));
      }
    }

    generatedRegistryHydrated = true;
  })().finally(() => {
    generatedRegistryHydrationPromise = null;
  });

  return generatedRegistryHydrationPromise;
}

export async function reloadGeneratedTechnicaEntry(
  contentType: TechnicaContentType,
  contentId: string
): Promise<boolean> {
  const entry = await fetchGeneratedRuntimeEntry<unknown>(contentType, contentId);
  if (!entry) {
    return false;
  }

  const { importTechnicaRuntimeEntry } = await import("./importer");
  try {
    importTechnicaRuntimeEntry(contentType, entry, { syncToGameState: true });
    return true;
  } catch (error) {
    console.warn(`[TECHNICA] Failed to reload generated ${contentType} '${contentId}'.`, error);
    return false;
  }
}

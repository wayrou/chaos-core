import type { FieldMap } from "../../field/types";
import { upsertLibraryCard } from "../../core/gearWorkbench";
import type { Quest } from "../../quests/types";
import generatedContentVersion from "./generated/version.json";
import type {
  DisabledTechnicaContent,
  ImportedCard,
  ImportedClassDefinition,
  ImportedCodexEntry,
  ImportedDialogue,
  ImportedFieldEnemyDefinition,
  ImportedFieldMod,
  ImportedGear,
  ImportedItem,
  ImportedMailEntry,
  ImportedNpcTemplate,
  ImportedOperationDefinition,
  ImportedUnitTemplate,
  TechnicaContentType,
} from "./types";

void generatedContentVersion;

type JsonModule<TValue> = {
  default: TValue;
};

type ImportMetaWithOptionalGlob = ImportMeta & {
  glob?: <TModule>(pattern: string, options: { eager: true }) => Record<string, TModule>;
};

const importedMaps = new Map<string, FieldMap>();
const importedQuests = new Map<string, Quest>();
const importedDialogues = new Map<string, ImportedDialogue>();
const importedMailEntries = new Map<string, ImportedMailEntry>();
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
const disabledContentIds = new Map<TechnicaContentType, Set<string>>([
  ["dialogue", new Set()],
  ["mail", new Set()],
  ["quest", new Set()],
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
  quest: ".quest.json",
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

async function fetchGeneratedRuntimeEntry<TValue>(contentType: TechnicaContentType, contentId: string): Promise<TValue | null> {
  if (typeof window === "undefined" || !import.meta.env.DEV || !contentId.trim()) {
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

if (typeof (import.meta as ImportMetaWithOptionalGlob).glob === "function") {
  loadGeneratedRegistry(
    import.meta.glob<JsonModule<DisabledTechnicaContent>>("./disabled/*/*.disabled.json", { eager: true }) as Record<
      string,
      JsonModule<DisabledTechnicaContent>
    >,
    (entry) => {
      if (entry.origin === "game") {
        disabledContentIds.get(entry.contentType)?.add(entry.id);
      }
    }
  );

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

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.location.reload();
  });
}

export function registerImportedFieldMap(map: FieldMap): void {
  importedMaps.set(map.id, map);
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
}

export function getImportedQuest(questId: string): Quest | null {
  return importedQuests.get(questId) || null;
}

export function getAllImportedQuests(): Quest[] {
  return Array.from(importedQuests.values());
}

export function registerImportedFieldEnemyDefinition(definition: ImportedFieldEnemyDefinition): void {
  importedFieldEnemies.set(definition.id, definition);
}

export function getImportedFieldEnemyDefinition(definitionId: string): ImportedFieldEnemyDefinition | null {
  return importedFieldEnemies.get(definitionId) || null;
}

export function getAllImportedFieldEnemyDefinitions(): ImportedFieldEnemyDefinition[] {
  return Array.from(importedFieldEnemies.values());
}

export function registerImportedDialogue(dialogue: ImportedDialogue): void {
  importedDialogues.set(dialogue.id, dialogue);
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
}

export function getImportedMailEntry(entryId: string): ImportedMailEntry | null {
  return importedMailEntries.get(entryId) || null;
}

export function getAllImportedMailEntries(): ImportedMailEntry[] {
  return Array.from(importedMailEntries.values());
}

export function registerImportedItem(item: ImportedItem): void {
  importedItems.set(item.id, item);
}

export function getImportedItem(itemId: string): ImportedItem | null {
  return importedItems.get(itemId) || null;
}

export function getAllImportedItems(): ImportedItem[] {
  return Array.from(importedItems.values());
}

export function getImportedStarterItems(): ImportedItem[] {
  return getAllImportedItems();
}

export function registerImportedNpc(npc: ImportedNpcTemplate): void {
  importedNpcs.set(npc.id, npc);
}

export function getImportedNpc(npcId: string): ImportedNpcTemplate | null {
  return importedNpcs.get(npcId) || null;
}

export function getAllImportedNpcs(): ImportedNpcTemplate[] {
  return Array.from(importedNpcs.values());
}

export function registerImportedGear(gear: ImportedGear): void {
  importedGear.set(gear.id, gear);
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
}

export function registerImportedUnitTemplate(unit: ImportedUnitTemplate): void {
  registerImportedUnit(unit);
}

export function getImportedUnit(unitId: string): ImportedUnitTemplate | null {
  return importedUnits.get(unitId) || null;
}

export function getImportedUnitTemplate(unitId: string): ImportedUnitTemplate | null {
  return getImportedUnit(unitId);
}

export function getAllImportedUnits(): ImportedUnitTemplate[] {
  return Array.from(importedUnits.values());
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
}

export function getImportedOperation(operationId: string): ImportedOperationDefinition | null {
  return importedOperations.get(operationId) || null;
}

export function getAllImportedOperations(): ImportedOperationDefinition[] {
  return Array.from(importedOperations.values());
}

export function registerImportedCodexEntry(entry: ImportedCodexEntry): void {
  importedCodexEntries.set(entry.id, entry);
}

export function getImportedCodexEntry(entryId: string): ImportedCodexEntry | null {
  return importedCodexEntries.get(entryId) || null;
}

export function getAllImportedCodexEntries(): ImportedCodexEntry[] {
  return Array.from(importedCodexEntries.values());
}

export function isTechnicaContentDisabled(contentType: TechnicaContentType, contentId: string): boolean {
  return disabledContentIds.get(contentType)?.has(contentId) ?? false;
}

export async function reloadGeneratedTechnicaEntry(
  contentType: TechnicaContentType,
  contentId: string
): Promise<boolean> {
  switch (contentType) {
    case "map": {
      const entry = await fetchGeneratedRuntimeEntry<FieldMap>(contentType, contentId);
      if (!entry) {
        return false;
      }
      registerImportedFieldMap(entry);
      return true;
    }
    case "quest": {
      const entry = await fetchGeneratedRuntimeEntry<Quest>(contentType, contentId);
      if (!entry) {
        return false;
      }
      registerImportedQuest(entry);
      return true;
    }
    case "field_enemy": {
      const entry = await fetchGeneratedRuntimeEntry<ImportedFieldEnemyDefinition>(contentType, contentId);
      if (!entry) {
        return false;
      }
      registerImportedFieldEnemyDefinition(entry);
      return true;
    }
    case "dialogue": {
      const entry = await fetchGeneratedRuntimeEntry<ImportedDialogue>(contentType, contentId);
      if (!entry) {
        return false;
      }
      registerImportedDialogue(entry);
      return true;
    }
    case "mail": {
      const entry = await fetchGeneratedRuntimeEntry<ImportedMailEntry>(contentType, contentId);
      if (!entry) {
        return false;
      }
      registerImportedMailEntry(entry);
      return true;
    }
    case "item": {
      const entry = await fetchGeneratedRuntimeEntry<ImportedItem>(contentType, contentId);
      if (!entry) {
        return false;
      }
      registerImportedItem(entry);
      return true;
    }
    case "npc": {
      const entry = await fetchGeneratedRuntimeEntry<ImportedNpcTemplate>(contentType, contentId);
      if (!entry) {
        return false;
      }
      registerImportedNpc(entry);
      return true;
    }
    case "gear": {
      const entry = await fetchGeneratedRuntimeEntry<ImportedGear>(contentType, contentId);
      if (!entry) {
        return false;
      }
      registerImportedGear(entry);
      return true;
    }
    case "card": {
      const entry = await fetchGeneratedRuntimeEntry<ImportedCard>(contentType, contentId);
      if (!entry) {
        return false;
      }
      registerImportedCard(entry);
      return true;
    }
    case "fieldmod": {
      const entry = await fetchGeneratedRuntimeEntry<ImportedFieldMod>(contentType, contentId);
      if (!entry) {
        return false;
      }
      registerImportedFieldMod(entry);
      return true;
    }
    case "class": {
      const entry = await fetchGeneratedRuntimeEntry<ImportedClassDefinition>(contentType, contentId);
      if (!entry) {
        return false;
      }
      registerImportedClass(entry);
      return true;
    }
    case "unit": {
      const entry = await fetchGeneratedRuntimeEntry<ImportedUnitTemplate>(contentType, contentId);
      if (!entry) {
        return false;
      }
      registerImportedUnit(entry);
      return true;
    }
    case "operation": {
      const entry = await fetchGeneratedRuntimeEntry<ImportedOperationDefinition>(contentType, contentId);
      if (!entry) {
        return false;
      }
      registerImportedOperation(entry);
      return true;
    }
    case "codex": {
      const entry = await fetchGeneratedRuntimeEntry<ImportedCodexEntry>(contentType, contentId);
      if (!entry) {
        return false;
      }
      registerImportedCodexEntry(entry);
      return true;
    }
    default:
      return false;
  }
}

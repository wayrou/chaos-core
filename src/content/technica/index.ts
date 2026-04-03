import type { FieldMap } from "../../field/types";
import { upsertLibraryCard } from "../../core/gearWorkbench";
import type { Quest } from "../../quests/types";
import generatedContentVersion from "./generated/version.json";
import type {
  DisabledTechnicaContent,
  ImportedCard,
  ImportedClassDefinition,
  ImportedDialogue,
  ImportedGear,
  ImportedItem,
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
const importedItems = new Map<string, ImportedItem>();
const importedNpcs = new Map<string, ImportedNpcTemplate>();
const importedGear = new Map<string, ImportedGear>();
const importedCards = new Map<string, ImportedCard>();
const importedClasses = new Map<string, ImportedClassDefinition>();
const importedUnits = new Map<string, ImportedUnitTemplate>();
const importedOperations = new Map<string, ImportedOperationDefinition>();
const disabledContentIds = new Map<TechnicaContentType, Set<string>>([
  ["dialogue", new Set()],
  ["quest", new Set()],
  ["map", new Set()],
  ["npc", new Set()],
  ["item", new Set()],
  ["gear", new Set()],
  ["card", new Set()],
  ["unit", new Set()],
  ["operation", new Set()],
  ["class", new Set()],
]);

function loadGeneratedRegistry<TValue extends { id: string }>(
  modules: Record<string, JsonModule<TValue>>,
  register: (value: TValue) => void
) {
  Object.values(modules).forEach((module) => {
    register(module.default);
  });
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
    import.meta.glob<JsonModule<ImportedDialogue>>("./generated/dialogue/*.dialogue.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedDialogue>
    >,
    registerImportedDialogue
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
  return getAllImportedUnits().filter((entry) => entry.startingInRoster !== false);
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

export function isTechnicaContentDisabled(contentType: TechnicaContentType, contentId: string): boolean {
  return disabledContentIds.get(contentType)?.has(contentId) ?? false;
}

import type { FieldMap } from "../../field/types";
import { upsertLibraryCard } from "../../core/gearWorkbench";
import type { Quest } from "../../quests/types";
import type {
<<<<<<< HEAD
  ImportedBattleCard,
=======
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
import villageGuideIntro from "./generated/dialogue/village_guide_intro.dialogue.json";
import oakSquareMap from "./generated/map/oak_square.fieldmap.json";
import checkTheCourierBoard from "./generated/quest/check_the_courier_board.quest.json";
=======
  ImportedNpcTemplate,
  ImportedOperationDefinition,
  ImportedUnitTemplate,
  DisabledTechnicaContent,
  TechnicaContentType,
} from "./types";
>>>>>>> 3307f1b (technica compat)

type JsonModule<TValue> = {
  default: TValue;
};

type ImportMetaWithGlob = ImportMeta & {
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
const importedGear = new Map<string, ImportedGear>();
const importedItems = new Map<string, ImportedItem>();
const importedCards = new Map<string, ImportedBattleCard>();
const importedUnits = new Map<string, ImportedUnitTemplate>();
const importedOperations = new Map<string, ImportedOperation>();
const importedClasses = new Map<string, ImportedClassDefinition>();

function loadGeneratedRegistry<TValue extends { id: string }>(
  modules: Record<string, JsonModule<TValue>>,
  register: (value: TValue) => void
) {
  Object.values(modules).forEach((module) => {
    register(module.default);
  });
}

const importGlob = (import.meta as ImportMetaWithGlob).glob;

if (typeof importGlob === "function") {
  loadGeneratedRegistry(
    importGlob<JsonModule<DisabledTechnicaContent>>("./disabled/*/*.disabled.json", { eager: true }) as Record<
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
    importGlob<JsonModule<FieldMap>>("./generated/map/*.fieldmap.json", { eager: true }) as Record<string, JsonModule<FieldMap>>,
    (map) => importedMaps.set(map.id, map)
  );

  loadGeneratedRegistry(
    importGlob<JsonModule<Quest>>("./generated/quest/*.quest.json", { eager: true }) as Record<string, JsonModule<Quest>>,
    (quest) => importedQuests.set(quest.id, quest)
  );

  loadGeneratedRegistry(
    importGlob<JsonModule<ImportedDialogue>>("./generated/dialogue/*.dialogue.json", { eager: true }) as Record<string, JsonModule<ImportedDialogue>>,
    (dialogue) => importedDialogues.set(dialogue.id, dialogue)
  );

  loadGeneratedRegistry(
    importGlob<JsonModule<ImportedItem>>("./generated/item/*.item.json", { eager: true }) as Record<string, JsonModule<ImportedItem>>,
    (item) => importedItems.set(item.id, item)
  );

  loadGeneratedRegistry(
    importGlob<JsonModule<ImportedNpcTemplate>>("./generated/npc/*.npc.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedNpcTemplate>
    >,
    (npc) => registerImportedNpc(npc)
  );

  loadGeneratedRegistry(
    importGlob<JsonModule<ImportedGear>>("./generated/gear/*.gear.json", { eager: true }) as Record<string, JsonModule<ImportedGear>>,
    (gear) => importedGear.set(gear.id, gear)
  );

  loadGeneratedRegistry(
    importGlob<JsonModule<ImportedCard>>("./generated/card/*.card.json", { eager: true }) as Record<string, JsonModule<ImportedCard>>,
    (card) => registerImportedCard(card)
  );

  loadGeneratedRegistry(
    importGlob<JsonModule<ImportedClassDefinition>>("./generated/class/*.class.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedClassDefinition>
    >,
    (classDefinition) => registerImportedClass(classDefinition)
  );

  loadGeneratedRegistry(
    importGlob<JsonModule<ImportedUnitTemplate>>("./generated/unit/*.unit.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedUnitTemplate>
    >,
    (unit) => registerImportedUnit(unit)
  );

  loadGeneratedRegistry(
    importGlob<JsonModule<ImportedOperationDefinition>>("./generated/operation/*.operation.json", { eager: true }) as Record<
      string,
      JsonModule<ImportedOperationDefinition>
    >,
    (operation) => registerImportedOperation(operation)
  );
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

<<<<<<< HEAD
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

=======
>>>>>>> 3307f1b (technica compat)
export function registerImportedItem(item: ImportedItem): void {
  importedItems.set(item.id, item);
}

export function getImportedItem(itemId: string): ImportedItem | null {
  return importedItems.get(itemId) || null;
}

export function getAllImportedItems(): ImportedItem[] {
  return Array.from(importedItems.values());
}

<<<<<<< HEAD
export function getImportedStarterItems(): ImportedItem[] {
  return getAllImportedItems();
}

export function registerImportedBattleCard(card: ImportedBattleCard): void {
  importedCards.set(card.id, card);
}

export function getImportedBattleCard(cardId: string): ImportedBattleCard | null {
  return importedCards.get(cardId) || null;
}

export function getAllImportedBattleCards(): ImportedBattleCard[] {
  return Array.from(importedCards.values());
}

export function getImportedStarterBattleCards(): ImportedBattleCard[] {
  return getAllImportedBattleCards();
}

export function registerImportedUnitTemplate(unit: ImportedUnitTemplate): void {
  importedUnits.set(unit.id, unit);
}

export function getImportedUnitTemplate(unitId: string): ImportedUnitTemplate | null {
  return importedUnits.get(unitId) || null;
}

export function getAllImportedUnitTemplates(): ImportedUnitTemplate[] {
  return Array.from(importedUnits.values());
}

export function getImportedRosterUnits(): ImportedUnitTemplate[] {
  return getAllImportedUnitTemplates().filter((entry) => entry.startingInRoster !== false);
}

export function registerImportedOperation(operation: ImportedOperation): void {
  importedOperations.set(operation.id ?? operation.codename, operation);
}

export function getImportedOperation(operationId: string): ImportedOperation | null {
  return importedOperations.get(operationId) || null;
}

export function getAllImportedOperations(): ImportedOperation[] {
  return Array.from(importedOperations.values());
}

export function registerImportedClassDefinition(classDefinition: ImportedClassDefinition): void {
  importedClasses.set(classDefinition.id, classDefinition);
}

export function getImportedClassDefinition(classId: string): ImportedClassDefinition | null {
  return importedClasses.get(classId) || null;
}

export function getAllImportedClassDefinitions(): ImportedClassDefinition[] {
  return Array.from(importedClasses.values());
}
=======
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

export function registerImportedCard(card: ImportedCard): void {
  importedCards.set(card.id, card);
  upsertLibraryCard({
    id: card.id,
    name: card.name,
    rarity: card.rarity ?? "common",
    category: card.category ?? "utility",
    description: card.description,
    strainCost: card.strainCost,
    artPath: card.artPath
  });
}

export function getImportedCard(cardId: string): ImportedCard | null {
  return importedCards.get(cardId) || null;
}

export function getAllImportedCards(): ImportedCard[] {
  return Array.from(importedCards.values());
}

export function registerImportedClass(classDefinition: ImportedClassDefinition): void {
  importedClasses.set(classDefinition.id, classDefinition);
}

export function getImportedClass(classId: string): ImportedClassDefinition | null {
  return importedClasses.get(classId) || null;
}

export function getAllImportedClasses(): ImportedClassDefinition[] {
  return Array.from(importedClasses.values());
}

export function registerImportedUnit(unit: ImportedUnitTemplate): void {
  importedUnits.set(unit.id, unit);
}

export function getImportedUnit(unitId: string): ImportedUnitTemplate | null {
  return importedUnits.get(unitId) || null;
}

export function getAllImportedUnits(): ImportedUnitTemplate[] {
  return Array.from(importedUnits.values());
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
>>>>>>> 3307f1b (technica compat)

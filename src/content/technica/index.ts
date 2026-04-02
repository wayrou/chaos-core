import type { FieldMap } from "../../field/types";
import type { Quest } from "../../quests/types";
import type {
  ImportedBattleCard,
  ImportedClassDefinition,
  ImportedDialogue,
  ImportedGear,
  ImportedItem,
  ImportedOperation,
  ImportedUnitTemplate
} from "./types";
import villageGuideIntro from "./generated/dialogue/village_guide_intro.dialogue.json";
import oakSquareMap from "./generated/map/oak_square.fieldmap.json";
import checkTheCourierBoard from "./generated/quest/check_the_courier_board.quest.json";

const importedMaps = new Map<string, FieldMap>([[oakSquareMap.id, oakSquareMap as FieldMap]]);
const importedQuests = new Map<string, Quest>([[checkTheCourierBoard.id, checkTheCourierBoard as Quest]]);
const importedDialogues = new Map<string, ImportedDialogue>([
  [villageGuideIntro.id, villageGuideIntro as ImportedDialogue]
]);
const importedGear = new Map<string, ImportedGear>();
const importedItems = new Map<string, ImportedItem>();
const importedCards = new Map<string, ImportedBattleCard>();
const importedUnits = new Map<string, ImportedUnitTemplate>();
const importedOperations = new Map<string, ImportedOperation>();
const importedClasses = new Map<string, ImportedClassDefinition>();

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

import type { FieldMap } from "../../field/types";
import type { Quest } from "../../quests/types";
import type { ImportedDialogue } from "./types";
import villageGuideIntro from "./generated/dialogue/village_guide_intro.dialogue.json";
import oakSquareMap from "./generated/map/oak_square.fieldmap.json";
import checkTheCourierBoard from "./generated/quest/check_the_courier_board.quest.json";

const importedMaps = new Map<string, FieldMap>([[oakSquareMap.id, oakSquareMap as FieldMap]]);
const importedQuests = new Map<string, Quest>([[checkTheCourierBoard.id, checkTheCourierBoard as Quest]]);
const importedDialogues = new Map<string, ImportedDialogue>([
  [villageGuideIntro.id, villageGuideIntro as ImportedDialogue]
]);

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

export function hasImportedDialogue(dialogueId: string): boolean {
  return importedDialogues.has(dialogueId);
}

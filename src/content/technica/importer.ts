import type { FieldMap } from "../../field/types";
import type { Quest } from "../../quests/types";
import { registerImportedDialogue, registerImportedFieldMap, registerImportedQuest } from "./index";
import type { ImportedDialogue } from "./types";

export interface TechnicaManifestDependency {
  contentType: "map" | "quest" | "dialogue" | "scene";
  id: string;
  relation: string;
}

export interface TechnicaManifest {
  schemaVersion: string;
  sourceApp: "Technica";
  sourceAppVersion?: string;
  exportType: "map" | "quest" | "dialogue";
  contentType: "map" | "quest" | "dialogue";
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

export function importTechnicaEntry(manifest: TechnicaManifest, entryData: unknown): string {
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

    default:
      throw new Error(`Unsupported Technica content type '${manifest.contentType}'.`);
  }
}

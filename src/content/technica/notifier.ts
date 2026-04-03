import {
  getAllImportedCards,
  getAllImportedClassDefinitions,
  getAllImportedDialogues,
  getAllImportedFieldMaps,
  getAllImportedGear,
  getAllImportedItems,
  getAllImportedNpcs,
  getAllImportedOperations,
  getAllImportedQuests,
  getAllImportedUnitTemplates,
} from "./index";
import { showSystemPing } from "../../ui/components/systemPing";

type ImportedTechnicaDescriptor = {
  key: string;
  typeLabel: string;
  title: string;
};

const TECHNICA_SEEN_CONTENT_STORAGE_KEY = "chaoscore_technica_seen_content_v1";

function buildImportedTechnicaSnapshot(): ImportedTechnicaDescriptor[] {
  return [
    ...getAllImportedFieldMaps().map((entry) => ({
      key: `map:${entry.id}`,
      typeLabel: "Map",
      title: entry.name,
    })),
    ...getAllImportedQuests().map((entry) => ({
      key: `quest:${entry.id}`,
      typeLabel: "Quest",
      title: entry.title,
    })),
    ...getAllImportedDialogues().map((entry) => ({
      key: `dialogue:${entry.id}`,
      typeLabel: "Dialogue",
      title: entry.title,
    })),
    ...getAllImportedNpcs().map((entry) => ({
      key: `npc:${entry.id}`,
      typeLabel: "NPC",
      title: entry.name,
    })),
    ...getAllImportedItems().map((entry) => ({
      key: `item:${entry.id}`,
      typeLabel: "Item",
      title: entry.name,
    })),
    ...getAllImportedGear().map((entry) => ({
      key: `gear:${entry.id}`,
      typeLabel: "Gear",
      title: entry.name,
    })),
    ...getAllImportedCards().map((entry) => ({
      key: `card:${entry.id}`,
      typeLabel: "Card",
      title: entry.name,
    })),
    ...getAllImportedUnitTemplates().map((entry) => ({
      key: `unit:${entry.id}`,
      typeLabel: "Unit",
      title: entry.name,
    })),
    ...getAllImportedOperations().map((entry) => ({
      key: `operation:${entry.id}`,
      typeLabel: "Operation",
      title: entry.codename,
    })),
    ...getAllImportedClassDefinitions().map((entry) => ({
      key: `class:${entry.id}`,
      typeLabel: "Class",
      title: entry.name,
    })),
  ];
}

function readSeenTechnicaContentKeys(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(TECHNICA_SEEN_CONTENT_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }

    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set();
  }
}

function writeSeenTechnicaContentKeys(keys: Iterable<string>): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TECHNICA_SEEN_CONTENT_STORAGE_KEY, JSON.stringify(Array.from(keys)));
}

function formatNotificationDetail(entries: ImportedTechnicaDescriptor[]): string {
  return entries
    .slice(0, 3)
    .map((entry) => `${entry.typeLabel}: ${entry.title}`)
    .join(" | ");
}

export function notifyIfNewTechnicaContentLoaded(): number {
  const snapshot = buildImportedTechnicaSnapshot();
  const currentKeys = new Set(snapshot.map((entry) => entry.key));
  const seenKeys = readSeenTechnicaContentKeys();
  const newEntries = snapshot.filter((entry) => !seenKeys.has(entry.key));

  writeSeenTechnicaContentKeys(currentKeys);

  if (newEntries.length === 0) {
    return 0;
  }

  const message =
    newEntries.length === 1
      ? `${newEntries[0].title} loaded from Technica.`
      : `${newEntries.length} new Technica publishes loaded.`;
  const detail =
    newEntries.length === 1
      ? `${newEntries[0].typeLabel} content is now available in Chaos Core.`
      : `${formatNotificationDetail(newEntries)}${newEntries.length > 3 ? " ..." : ""}`;

  showSystemPing({
    type: "success",
    title: "Technica Content Loaded",
    message,
    detail,
    durationMs: 5600,
    channel: "technica-content-loaded",
    replaceChannel: true,
  });

  return newEntries.length;
}

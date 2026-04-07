import {
  getAllImportedCards,
  getAllImportedClassDefinitions,
  getAllImportedCodexEntries,
  getAllImportedDialogues,
  getAllImportedFieldEnemyDefinitions,
  getAllImportedFieldMaps,
  getAllImportedFieldMods,
  getAllImportedGear,
  getAllImportedItems,
  getAllImportedMailEntries,
  getAllImportedNpcs,
  getAllImportedOperations,
  getAllImportedQuests,
  getAllImportedUnitTemplates,
  reloadGeneratedTechnicaEntry,
} from "./index";
import { showSystemPing } from "../../ui/components/systemPing";
import generatedContentVersion from "./generated/version.json";
import type { TechnicaContentType } from "./types";

type ImportedTechnicaDescriptor = {
  key: string;
  typeLabel: string;
  title: string;
};

const TECHNICA_SEEN_CONTENT_STORAGE_KEY = "chaoscore_technica_seen_content_v1";
const TECHNICA_GENERATED_VERSION_POLL_INTERVAL_MS = 1500;
const TECHNICA_CODEX_UPDATED_EVENT = "chaoscore:codex-updated";
let technicaGeneratedVersionWatcherStarted = false;

function isTechnicaContentType(value: unknown): value is TechnicaContentType {
  switch (value) {
    case "dialogue":
    case "mail":
    case "quest":
    case "map":
    case "field_enemy":
    case "npc":
    case "item":
    case "gear":
    case "card":
    case "fieldmod":
    case "unit":
    case "operation":
    case "class":
    case "codex":
      return true;
    default:
      return false;
  }
}

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
    ...getAllImportedMailEntries().map((entry) => ({
      key: `mail:${entry.id}`,
      typeLabel: "Mail",
      title: entry.subject,
    })),
    ...getAllImportedFieldEnemyDefinitions().map((entry) => ({
      key: `field_enemy:${entry.id}`,
      typeLabel: "Field Enemy",
      title: entry.name,
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
    ...getAllImportedFieldMods().map((entry) => ({
      key: `fieldmod:${entry.id}`,
      typeLabel: "Field Mod",
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
    ...getAllImportedCodexEntries().map((entry) => ({
      key: `codex:${entry.id}`,
      typeLabel: "Codex",
      title: entry.title,
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

function emitCodexUpdated(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(TECHNICA_CODEX_UPDATED_EVENT));
}

export function getTechnicaCodexUpdatedEventName(): string {
  return TECHNICA_CODEX_UPDATED_EVENT;
}

export function watchForGeneratedTechnicaContentChanges(): void {
  if (technicaGeneratedVersionWatcherStarted || typeof window === "undefined" || !import.meta.env.DEV) {
    return;
  }

  technicaGeneratedVersionWatcherStarted = true;

  const versionUrl = new URL("./generated/version.json", import.meta.url);
  let lastSeenUpdatedAt =
    typeof generatedContentVersion?.updatedAt === "number" && Number.isFinite(generatedContentVersion.updatedAt)
      ? generatedContentVersion.updatedAt
      : 0;

  window.setInterval(() => {
    void (async () => {
      try {
        const response = await fetch(`${versionUrl.href}?t=${Date.now()}`, {
          cache: "no-store",
          headers: {
            Accept: "application/json"
          }
        });

        if (!response.ok) {
          return;
        }

        const nextVersion = (await response.json()) as {
          updatedAt?: unknown;
          contentType?: unknown;
          contentId?: unknown;
        };
        const nextUpdatedAt =
          typeof nextVersion.updatedAt === "number" && Number.isFinite(nextVersion.updatedAt)
            ? nextVersion.updatedAt
            : 0;

        if (nextUpdatedAt > lastSeenUpdatedAt) {
          lastSeenUpdatedAt = nextUpdatedAt;

          const nextContentType = nextVersion.contentType;
          const nextContentId =
            typeof nextVersion.contentId === "string" && nextVersion.contentId.trim()
              ? nextVersion.contentId.trim()
              : "";

          if (isTechnicaContentType(nextContentType) && nextContentId) {
            const reloaded = await reloadGeneratedTechnicaEntry(nextContentType, nextContentId);
            if (reloaded) {
              if (nextContentType === "codex") {
                const { syncImportedCodexUnlocks } = await import("../../core/codexSystem");
                syncImportedCodexUnlocks();
                emitCodexUpdated();
              }
              if (nextContentType === "mail") {
                const { syncImportedMailUnlocks } = await import("../../core/mailSystem");
                syncImportedMailUnlocks();
              }
              notifyIfNewTechnicaContentLoaded();
              return;
            }
          }

          window.location.reload();
          return;
        }

        lastSeenUpdatedAt = Math.max(lastSeenUpdatedAt, nextUpdatedAt);
      } catch {
        // Ignore polling failures while the dev server is refreshing.
      }
    })();
  }, TECHNICA_GENERATED_VERSION_POLL_INTERVAL_MS);
}

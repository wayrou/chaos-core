import {
  getAllImportedCards,
  getAllImportedChatterEntries,
  getAllImportedClassDefinitions,
  getAllImportedCodexEntries,
  getAllImportedDialogues,
  getAllImportedFieldEnemyDefinitions,
  getAllImportedFactions,
  getAllImportedFieldMaps,
  getAllImportedFieldMods,
  getAllImportedGear,
  getAllImportedItems,
  getAllImportedKeyItems,
  getAllImportedMailEntries,
  getAllImportedNpcs,
  getAllImportedOperations,
  getAllImportedQuests,
  getAllImportedUnitTemplates,
  readGeneratedTechnicaVersionMarker,
  reloadGeneratedTechnicaEntry,
} from "./index";
import { showSystemPing } from "../../ui/components/systemPing";
import type { TechnicaContentType } from "./types";

type ImportedTechnicaDescriptor = {
  key: string;
  typeLabel: string;
  title: string;
};

const TECHNICA_SEEN_CONTENT_STORAGE_KEY = "chaoscore_technica_seen_content_v1";
const TECHNICA_SEEN_PUBLISH_VERSION_STORAGE_KEY = "chaoscore_technica_seen_publish_version_v1";
const TECHNICA_GENERATED_VERSION_POLL_INTERVAL_MS = 1500;
const TECHNICA_CODEX_UPDATED_EVENT = "chaoscore:codex-updated";
let technicaGeneratedVersionWatcherStarted = false;

function isTechnicaContentType(value: unknown): value is TechnicaContentType {
  switch (value) {
    case "dialogue":
    case "mail":
    case "chatter":
    case "quest":
    case "key_item":
    case "faction":
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
    ...getAllImportedKeyItems().map((entry) => ({
      key: `key_item:${entry.id}`,
      typeLabel: "Key Item",
      title: entry.name,
    })),
    ...getAllImportedFactions().map((entry) => ({
      key: `faction:${entry.id}`,
      typeLabel: "Faction",
      title: entry.name,
    })),
    ...getAllImportedChatterEntries().map((entry) => ({
      key: `chatter:${entry.id}`,
      typeLabel: "Chatter",
      title: entry.content,
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

function readSeenTechnicaPublishVersion(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const raw = window.localStorage.getItem(TECHNICA_SEEN_PUBLISH_VERSION_STORAGE_KEY);
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeSeenTechnicaPublishVersion(updatedAt: number): void {
  if (typeof window === "undefined" || !Number.isFinite(updatedAt) || updatedAt <= 0) {
    return;
  }

  window.localStorage.setItem(TECHNICA_SEEN_PUBLISH_VERSION_STORAGE_KEY, String(updatedAt));
}

function formatNotificationDetail(entries: ImportedTechnicaDescriptor[]): string {
  return entries
    .slice(0, 3)
    .map((entry) => `${entry.typeLabel}: ${entry.title}`)
    .join(" | ");
}

function getDescriptorForTechnicaContent(
  contentType: TechnicaContentType,
  contentId: string
): ImportedTechnicaDescriptor | null {
  const normalizedContentId = contentId.trim();
  if (!normalizedContentId) {
    return null;
  }

  return buildImportedTechnicaSnapshot().find((entry) => entry.key === `${contentType}:${normalizedContentId}`) ?? null;
}

function getUpdatedAtFromVersionMarker(value: { updatedAt?: unknown } | null): number {
  return typeof value?.updatedAt === "number" && Number.isFinite(value.updatedAt) ? value.updatedAt : 0;
}

function getContentIdFromVersionMarker(value: { contentId?: unknown } | null): string {
  return typeof value?.contentId === "string" && value.contentId.trim() ? value.contentId.trim() : "";
}

function notifyTechnicaPublishApplied(contentType: TechnicaContentType, contentId: string): void {
  const descriptor = getDescriptorForTechnicaContent(contentType, contentId);
  const message = descriptor ? `${descriptor.title} synced from Technica.` : `${contentType}:${contentId} synced from Technica.`;
  const detail = descriptor
    ? `${descriptor.typeLabel} content is now live in Chaos Core.`
    : "Published content is now live in Chaos Core.";

  showSystemPing({
    type: "success",
    title: "Technica Publish Applied",
    message,
    detail,
    durationMs: 5600,
    channel: "technica-publish-applied",
    replaceChannel: true,
  });
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

export async function notifyIfTechnicaPublishVersionAdvanced(): Promise<boolean> {
  const nextVersion = await readGeneratedTechnicaVersionMarker();
  const nextUpdatedAt = getUpdatedAtFromVersionMarker(nextVersion);
  if (nextUpdatedAt <= 0 || nextUpdatedAt <= readSeenTechnicaPublishVersion()) {
    return false;
  }

  const nextContentType = nextVersion?.contentType;
  const nextContentId = getContentIdFromVersionMarker(nextVersion);
  if (isTechnicaContentType(nextContentType) && nextContentId) {
    notifyTechnicaPublishApplied(nextContentType, nextContentId);
  } else {
    showSystemPing({
      type: "success",
      title: "Technica Publish Applied",
      message: "Published content synced from Technica.",
      detail: "Updated content is now live in Chaos Core.",
      durationMs: 5600,
      channel: "technica-publish-applied",
      replaceChannel: true,
    });
  }

  writeSeenTechnicaPublishVersion(nextUpdatedAt);
  return true;
}

export function watchForGeneratedTechnicaContentChanges(): void {
  if (technicaGeneratedVersionWatcherStarted || typeof window === "undefined") {
    return;
  }

  technicaGeneratedVersionWatcherStarted = true;

  void (async () => {
    let lastSeenUpdatedAt = getUpdatedAtFromVersionMarker(await readGeneratedTechnicaVersionMarker());

    window.setInterval(() => {
      void (async () => {
        try {
          const nextVersion = await readGeneratedTechnicaVersionMarker();
          const nextUpdatedAt = getUpdatedAtFromVersionMarker(nextVersion);

          if (nextUpdatedAt > lastSeenUpdatedAt) {
            lastSeenUpdatedAt = nextUpdatedAt;

            const nextContentType = nextVersion?.contentType;
            const nextContentId = getContentIdFromVersionMarker(nextVersion);

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
                notifyTechnicaPublishApplied(nextContentType, nextContentId);
                writeSeenTechnicaPublishVersion(nextUpdatedAt);
                return;
              }
            }

            window.location.reload();
            return;
          }

          lastSeenUpdatedAt = Math.max(lastSeenUpdatedAt, nextUpdatedAt);
        } catch {
          // Ignore polling failures while the runtime is refreshing.
        }
      })();
    }, TECHNICA_GENERATED_VERSION_POLL_INTERVAL_MS);
  })();
}

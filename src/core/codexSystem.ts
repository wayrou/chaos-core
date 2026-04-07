import { getAllImportedCodexEntries } from "../content/technica";
import { getHighestReachedFloorOrdinal, loadCampaignProgress } from "./campaign";
import { getSchemaUnlockState } from "./schemaSystem";
import type { GameState } from "./types";
import { getGameState, updateGameState } from "../state/gameStore";

export type CodexCategory = "Lore" | "Faction" | "Bestiary" | "Tech";

export interface CodexEntry {
  id: string;
  title: string;
  category: CodexCategory;
  content: string;
  unlockAfterFloor?: number;
  requiredDialogueIds?: string[];
  requiredQuestIds?: string[];
  requiredGearIds?: string[];
  requiredItemIds?: string[];
  requiredSchemaIds?: string[];
  requiredFieldModIds?: string[];
}

function normalizeCodexCategory(value: unknown): CodexCategory {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "faction":
      return "Faction";
    case "bestiary":
      return "Bestiary";
    case "tech":
      return "Tech";
    case "lore":
    default:
      return "Lore";
  }
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map(String).map((entry) => entry.trim()).filter(Boolean)));
}

function normalizeImportedCodexEntry(entry: ReturnType<typeof getAllImportedCodexEntries>[number]): CodexEntry {
  return {
    id: entry.id,
    title: entry.title,
    category: normalizeCodexCategory(entry.entryType),
    content: entry.content,
    unlockAfterFloor:
      Number.isFinite(Number(entry.unlockAfterFloor)) && Number(entry.unlockAfterFloor) > 0
        ? Math.round(Number(entry.unlockAfterFloor))
        : 0,
    requiredDialogueIds: toStringList(entry.requiredDialogueIds),
    requiredQuestIds: toStringList(entry.requiredQuestIds),
    requiredGearIds: toStringList(entry.requiredGearIds),
    requiredItemIds: toStringList(entry.requiredItemIds),
    requiredSchemaIds: toStringList(entry.requiredSchemaIds),
    requiredFieldModIds: toStringList(entry.requiredFieldModIds)
  };
}

function getImportedCodexDatabase(): CodexEntry[] {
  return getAllImportedCodexEntries().map(normalizeImportedCodexEntry);
}

function getOwnedGearIds(state: GameState): Set<string> {
  return new Set(Object.keys(state.equipmentById ?? {}));
}

function getOwnedItemIds(state: GameState): Set<string> {
  const itemIds = new Set<string>();

  Object.entries(state.consumables ?? {}).forEach(([itemId, quantity]) => {
    if (Number(quantity) > 0) {
      itemIds.add(itemId);
    }
  });

  [...(state.inventory?.baseStorage ?? []), ...(state.inventory?.forwardLocker ?? [])].forEach((item) => {
    if (Number(item.quantity ?? 0) > 0) {
      itemIds.add(item.id);
    }
  });

  return itemIds;
}

function getOwnedFieldModIds(state: GameState): Set<string> {
  const campaignProgress = loadCampaignProgress();
  const fieldModIds = new Set<string>();

  [...(state.runFieldModInventory ?? [])].forEach((instance) => {
    if (instance?.defId) {
      fieldModIds.add(instance.defId);
    }
  });

  [...(campaignProgress.queuedFieldModsForNextRun ?? []), ...(campaignProgress.activeRun?.runFieldModInventory ?? [])].forEach(
    (instance) => {
      if (instance?.defId) {
        fieldModIds.add(instance.defId);
      }
    }
  );

  return fieldModIds;
}

function getUnlockedSchemaIds(state: GameState): Set<string> {
  const schemaState = getSchemaUnlockState(state);
  return new Set([...schemaState.unlockedCoreTypes, ...schemaState.unlockedFortificationPips]);
}

function areImportedCodexRequirementsMet(entry: CodexEntry, state: GameState): boolean {
  const highestReachedFloorOrdinal = getHighestReachedFloorOrdinal(loadCampaignProgress());
  if ((entry.unlockAfterFloor ?? 0) > 0 && highestReachedFloorOrdinal < (entry.unlockAfterFloor ?? 0)) {
    return false;
  }

  const completedDialogueIds = new Set(state.completedDialogueIds ?? []);
  if ((entry.requiredDialogueIds ?? []).some((dialogueId) => !completedDialogueIds.has(dialogueId))) {
    return false;
  }

  const completedQuestIds = new Set(state.quests?.completedQuests ?? []);
  if ((entry.requiredQuestIds ?? []).some((questId) => !completedQuestIds.has(questId))) {
    return false;
  }

  const ownedGearIds = getOwnedGearIds(state);
  if ((entry.requiredGearIds ?? []).some((gearId) => !ownedGearIds.has(gearId))) {
    return false;
  }

  const ownedItemIds = getOwnedItemIds(state);
  if ((entry.requiredItemIds ?? []).some((itemId) => !ownedItemIds.has(itemId))) {
    return false;
  }

  const unlockedSchemaIds = getUnlockedSchemaIds(state);
  if ((entry.requiredSchemaIds ?? []).some((schemaId) => !unlockedSchemaIds.has(schemaId))) {
    return false;
  }

  const ownedFieldModIds = getOwnedFieldModIds(state);
  if ((entry.requiredFieldModIds ?? []).some((fieldModId) => !ownedFieldModIds.has(fieldModId))) {
    return false;
  }

  return true;
}

function syncUnlockedImportedCodexIds(): Set<string> {
  const state = getGameState();
  const unlockedIds = new Set(state.unlockedCodexEntries || []);
  const eligibleImportedIds = getImportedCodexDatabase()
    .filter((entry) => !unlockedIds.has(entry.id) && areImportedCodexRequirementsMet(entry, state))
    .map((entry) => entry.id);

  if (eligibleImportedIds.length > 0) {
    eligibleImportedIds.forEach((entryId) => unlockedIds.add(entryId));
    updateGameState((current) => ({
      ...current,
      unlockedCodexEntries: Array.from(new Set([...(current.unlockedCodexEntries || []), ...eligibleImportedIds]))
    }));
  }

  return unlockedIds;
}

export function syncImportedCodexUnlocks(): string[] {
  return Array.from(syncUnlockedImportedCodexIds());
}

// Fixed repository of all Codex lore text in the game
export const CODEX_DATABASE: CodexEntry[] = [
  {
    id: "lore_the_collapse",
    title: "The Great Collapse",
    category: "Lore",
    content:
      "SLK//DECRYPTING...\n\nData fragment recovered. Subject: The Collapse.\n\nEighty years ago, the Aethernet shattered. It wasn't a slow fraying, but an instant, catastrophic severance. The steam engines that powered our wards died in a collective exhale. Over the next three days, the Mist rolled into the valleys.\n\nThose who survived did so behind the Iron Gates. We are the descendants of those who locked the doors."
  },
  {
    id: "tech_scrolllink_os",
    title: "S/COM_OS Operating System",
    category: "Tech",
    content:
      "S/COM//DECRYPTING...\n\nS/COM_OS v4.2.1\n\nDeveloped by the Architects of the Iron Gate. S/COM_OS utilizes minimal steam-power via harmonic crystals to maintain data integrity in high-Mist environments. \n\nWarning: Extended exposure to raw Aethernet data may cause ocular hemorrhaging."
  },
  {
    id: "faction_mistguard",
    title: "The Mistguard",
    category: "Faction",
    content:
      "SLK//DECRYPTING...\n\nTo be a Mistguard is to accept an early grave. They are the only fools willing to step outside the Iron Gates and breathe the fog. Their mandate is twofold: reclaim lost tech, and ensure the horrors of the valley do not knock on our walls."
  },
  {
    id: "bestiary_husk",
    title: "Wandering Husk",
    category: "Bestiary",
    content:
      "SLK//DECRYPTING...\n\nBiological Target Profile: Husk. \n\nFormer human, entirely corrupted by the Mist. The respiratory system has been replaced by a fungal-aether weave that perpetually exhales spores. Slow, but highly dangerous in numbers. Do not engage in melee if armor seals are comprised."
  }
];

export function getCodexDatabase(): CodexEntry[] {
  const importedEntries = getImportedCodexDatabase();
  const importedIds = new Set(importedEntries.map((entry) => entry.id));
  return [...CODEX_DATABASE.filter((entry) => !importedIds.has(entry.id)), ...importedEntries];
}

/**
 * Unlock a codex entry so it's readable to the player forever
 */
export function unlockCodexEntry(entryId: string): void {
  const state = getGameState();

  if (!state.unlockedCodexEntries) {
    updateGameState((s) => ({ ...s, unlockedCodexEntries: [entryId] }));
    console.log(`[CODEX] Unlocked new entry: ${entryId}`);
    return;
  }

  if (state.unlockedCodexEntries.includes(entryId)) {
    return;
  }

  updateGameState((s) => ({
    ...s,
    unlockedCodexEntries: [...s.unlockedCodexEntries!, entryId]
  }));

  console.log(`[CODEX] Unlocked new entry: ${entryId}`);
}

/**
 * Get the list of all unlocked codex entries
 */
export function getUnlockedCodexEntries(): CodexEntry[] {
  const unlockedIds = syncUnlockedImportedCodexIds();
  return getCodexDatabase().filter((entry) => unlockedIds.has(entry.id));
}

/**
 * Check if a specific entry is unlocked
 */
export function isCodexEntryUnlocked(entryId: string): boolean {
  return syncUnlockedImportedCodexIds().has(entryId);
}

/**
 * Fully unlock everything (for debugging)
 */
export function debugUnlockAllCodexEntries(): void {
  const allIds = getCodexDatabase().map((entry) => entry.id);
  updateGameState((s) => ({
    ...s,
    unlockedCodexEntries: allIds
  }));
  console.log("[CODEX] DEBUG: Unlocked all entries.");
}

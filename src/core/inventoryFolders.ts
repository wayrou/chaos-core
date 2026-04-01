import type { GameState, InventoryFolder, InventoryItem } from "./types";
import {
  buildOwnedBaseStorageItems,
  moveOwnedItemToBaseStorage,
  moveOwnedItemToForwardLocker,
} from "./loadoutInventory";

export const DEFAULT_INVENTORY_FOLDER_COLORS = [
  "#8e6dff",
  "#ff9f6e",
  "#62d6ff",
  "#7de9a4",
  "#ff7fb6",
  "#ffd36e",
] as const;

export interface InventoryFolderTransferSummary {
  id: string;
  name: string;
  color: string;
  entryKeys: string[];
  entryCount: number;
  deployableEntryCount: number;
  baseStorageItems: InventoryItem[];
  forwardLockerItems: InventoryItem[];
  baseMassKg: number;
  baseBulkBu: number;
  basePowerW: number;
  lockerMassKg: number;
  lockerBulkBu: number;
  lockerPowerW: number;
}

export function readInventoryFolders(state: GameState): Record<string, InventoryFolder> {
  return { ...(state.uiLayout?.inventoryFolders ?? {}) };
}

export function parseInventoryFolderEntryKey(entryKey: string): { category: string; id: string } | null {
  const separatorIndex = entryKey.indexOf(":");
  if (separatorIndex === -1) {
    return null;
  }
  const category = entryKey.slice(0, separatorIndex);
  const id = entryKey.slice(separatorIndex + 1);
  if (!category || !id) {
    return null;
  }
  return { category, id };
}

export function getDeployableInventoryIdFromEntryKey(entryKey: string): string | null {
  const parsed = parseInventoryFolderEntryKey(entryKey);
  if (!parsed) {
    return null;
  }
  return parsed.category === "equipment" || parsed.category === "consumable"
    ? parsed.id
    : null;
}

export function buildInventoryFolderTransferSummaries(state: GameState): InventoryFolderTransferSummary[] {
  const folders = Object.values(readInventoryFolders(state));
  const baseStorage = buildOwnedBaseStorageItems(state);
  const forwardLocker = state.inventory?.forwardLocker ?? [];
  const baseLookup = new Map(baseStorage.map((item) => [item.id, item] as const));
  const lockerLookup = new Map(forwardLocker.map((item) => [item.id, item] as const));

  const summaries = folders.map((folder) => {
    const baseStorageItems: InventoryItem[] = [];
    const forwardLockerItems: InventoryItem[] = [];

    folder.entryKeys.forEach((entryKey) => {
      const itemId = getDeployableInventoryIdFromEntryKey(entryKey);
      if (!itemId) {
        return;
      }
      const baseItem = baseLookup.get(itemId);
      if (baseItem) {
        baseStorageItems.push(baseItem);
      }
      const lockerItem = lockerLookup.get(itemId);
      if (lockerItem) {
        forwardLockerItems.push(lockerItem);
      }
    });

    return {
      id: folder.id,
      name: folder.name,
      color: folder.color,
      entryKeys: [...folder.entryKeys],
      entryCount: folder.entryKeys.length,
      deployableEntryCount: Array.from(new Set([
        ...baseStorageItems.map((item) => item.id),
        ...forwardLockerItems.map((item) => item.id),
      ])).length,
      baseStorageItems,
      forwardLockerItems,
      baseMassKg: sumInventoryMetric(baseStorageItems, "massKg"),
      baseBulkBu: sumInventoryMetric(baseStorageItems, "bulkBu"),
      basePowerW: sumInventoryMetric(baseStorageItems, "powerW"),
      lockerMassKg: sumInventoryMetric(forwardLockerItems, "massKg"),
      lockerBulkBu: sumInventoryMetric(forwardLockerItems, "bulkBu"),
      lockerPowerW: sumInventoryMetric(forwardLockerItems, "powerW"),
    };
  });

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

export function moveInventoryFolderToForwardLocker(state: GameState, folderId: string): GameState {
  const folders = readInventoryFolders(state);
  const folder = folders[folderId];
  if (!folder) {
    return state;
  }

  let nextState = state;
  folder.entryKeys.forEach((entryKey) => {
    const itemId = getDeployableInventoryIdFromEntryKey(entryKey);
    if (!itemId) {
      return;
    }
    nextState = moveOwnedItemToForwardLocker(nextState, itemId);
  });
  return nextState;
}

export function moveInventoryFolderToBaseStorage(state: GameState, folderId: string): GameState {
  const folders = readInventoryFolders(state);
  const folder = folders[folderId];
  if (!folder) {
    return state;
  }

  let nextState = state;
  folder.entryKeys.forEach((entryKey) => {
    const itemId = getDeployableInventoryIdFromEntryKey(entryKey);
    if (!itemId) {
      return;
    }
    nextState = moveOwnedItemToBaseStorage(nextState, itemId);
  });
  return nextState;
}

function sumInventoryMetric(items: InventoryItem[], key: "massKg" | "bulkBu" | "powerW"): number {
  return items.reduce((sum, item) => sum + (item[key] * Math.max(item.quantity || 1, 1)), 0);
}

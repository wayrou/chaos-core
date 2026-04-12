import { getImportedKeyItem } from "../content/technica";
import { getInventoryIconPath } from "./inventoryIcons";
import type { GameState, InventoryItem } from "./types";

function humanizeId(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function buildKeyItemInventoryItem(itemId: string, quantity: number, existing?: InventoryItem): InventoryItem {
  const definition = getImportedKeyItem(itemId);
  return {
    id: itemId,
    name: definition?.name ?? existing?.name ?? humanizeId(itemId),
    kind: "key_item",
    stackable: false,
    quantity: Math.max(1, quantity),
    massKg: 0,
    bulkBu: 0,
    powerW: 0,
    description: definition?.description ?? existing?.description,
    iconPath: getInventoryIconPath(definition?.iconPath ?? existing?.iconPath),
    metadata: {
      ...(existing?.metadata ?? {}),
      ...(definition?.metadata ?? {}),
      questOnly: true,
    },
  };
}

export function isRegisteredKeyItem(itemId: string): boolean {
  return Boolean(getImportedKeyItem(itemId));
}

export function getOwnedKeyItemQuantity(state: GameState, itemId: string): number {
  return [...(state.inventory?.baseStorage ?? []), ...(state.inventory?.forwardLocker ?? [])].reduce((total, item) => {
    if (item.kind !== "key_item" || item.id !== itemId) {
      return total;
    }

    return total + Math.max(1, Number(item.quantity ?? 1));
  }, 0);
}

export function getOwnedKeyItemIds(state: GameState): Set<string> {
  const keyItemIds = new Set<string>();

  [...(state.inventory?.baseStorage ?? []), ...(state.inventory?.forwardLocker ?? [])].forEach((item) => {
    if (item.kind === "key_item" && Number(item.quantity ?? 0) > 0) {
      keyItemIds.add(item.id);
    }
  });

  return keyItemIds;
}

export function grantKeyItemToState(state: GameState, itemId: string, quantity = 1): GameState {
  if (quantity <= 0) {
    return state;
  }

  const baseStorage = [...(state.inventory?.baseStorage ?? [])];
  const existingIndex = baseStorage.findIndex((entry) => entry.id === itemId && entry.kind === "key_item");

  if (existingIndex >= 0) {
    const existing = baseStorage[existingIndex];
    baseStorage[existingIndex] = buildKeyItemInventoryItem(itemId, Math.max(1, existing.quantity) + quantity, existing);
  } else {
    baseStorage.push(buildKeyItemInventoryItem(itemId, quantity));
  }

  return {
    ...state,
    inventory: {
      ...state.inventory,
      baseStorage,
    },
  };
}

export function consumeKeyItemFromState(
  state: GameState,
  itemId: string,
  quantity = 1,
): { state: GameState; consumed: number } {
  if (quantity <= 0) {
    return { state, consumed: 0 };
  }

  let remaining = quantity;
  const consumeFrom = (items: InventoryItem[]) =>
    items.flatMap((item) => {
      if (remaining <= 0 || item.kind !== "key_item" || item.id !== itemId) {
        return [item];
      }

      const available = Math.max(1, Number(item.quantity ?? 1));
      const used = Math.min(available, remaining);
      remaining -= used;
      const nextQuantity = available - used;
      return nextQuantity > 0 ? [{ ...item, quantity: nextQuantity }] : [];
    });

  const nextForwardLocker = consumeFrom([...(state.inventory?.forwardLocker ?? [])]);
  const nextBaseStorage = consumeFrom([...(state.inventory?.baseStorage ?? [])]);
  const consumed = quantity - remaining;

  if (consumed <= 0) {
    return { state, consumed: 0 };
  }

  return {
    consumed,
    state: {
      ...state,
      inventory: {
        ...state.inventory,
        forwardLocker: nextForwardLocker,
        baseStorage: nextBaseStorage,
      },
    },
  };
}

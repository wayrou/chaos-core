import type { GameState, InventoryItem } from "./types";
import type { Equipment } from "./equipment";

function makeEquipmentInventoryItem(equipment: Equipment, existing?: InventoryItem): InventoryItem {
<<<<<<< HEAD
  const importedInventory = (equipment as { inventory?: { massKg?: number; bulkBu?: number; powerW?: number } }).inventory;
=======
  const inventoryProfile = equipment.inventory;
>>>>>>> 3307f1b (technica compat)
  return {
    id: equipment.id,
    name: equipment.name,
    kind: "equipment",
    stackable: false,
    quantity: 1,
<<<<<<< HEAD
    massKg: existing?.massKg ?? importedInventory?.massKg ?? 2,
    bulkBu: existing?.bulkBu ?? importedInventory?.bulkBu ?? 1,
    powerW: existing?.powerW ?? importedInventory?.powerW ?? 1,
=======
    massKg: existing?.massKg ?? inventoryProfile?.massKg ?? 2,
    bulkBu: existing?.bulkBu ?? inventoryProfile?.bulkBu ?? 1,
    powerW: existing?.powerW ?? inventoryProfile?.powerW ?? 1,
    description: existing?.description ?? equipment.description,
    iconPath: existing?.iconPath ?? equipment.iconPath,
    metadata: existing?.metadata ?? equipment.metadata,
>>>>>>> 3307f1b (technica compat)
  };
}

function makeConsumableInventoryItem(id: string, quantity: number, existing?: InventoryItem): InventoryItem {
  return {
    id,
    name: existing?.name ?? id,
    kind: "consumable",
    stackable: true,
    quantity,
    massKg: existing?.massKg ?? 1,
    bulkBu: existing?.bulkBu ?? 1,
    powerW: existing?.powerW ?? 0,
    description: existing?.description,
    iconPath: existing?.iconPath,
    metadata: existing?.metadata,
  };
}

export function buildOwnedBaseStorageItems(state: GameState): InventoryItem[] {
  const forwardLocker = state.inventory?.forwardLocker ?? [];
  const inventoryLookup = new Map<string, InventoryItem>();
  [...forwardLocker, ...(state.inventory?.baseStorage ?? [])].forEach((item) => {
    inventoryLookup.set(item.id, item);
  });

  const reservedInForwardLocker = new Map<string, number>();
  forwardLocker.forEach((item) => {
    reservedInForwardLocker.set(item.id, (reservedInForwardLocker.get(item.id) ?? 0) + (item.quantity || 1));
  });

  const derivedItems: InventoryItem[] = [];
  const addedIds = new Set<string>();

  for (const equipmentId of state.equipmentPool || []) {
    if (reservedInForwardLocker.has(equipmentId)) {
      continue;
    }

    const equipment = state.equipmentById?.[equipmentId] as Equipment | undefined;
    if (!equipment) {
      continue;
    }

    derivedItems.push(makeEquipmentInventoryItem(equipment, inventoryLookup.get(equipmentId)));
    addedIds.add(equipmentId);
  }

  for (const [consumableId, ownedQty] of Object.entries(state.consumables || {})) {
    const remainingQty = ownedQty - (reservedInForwardLocker.get(consumableId) ?? 0);
    if (remainingQty <= 0) {
      continue;
    }

    derivedItems.push(makeConsumableInventoryItem(consumableId, remainingQty, inventoryLookup.get(consumableId)));
    addedIds.add(consumableId);
  }

  for (const legacyItem of state.inventory?.baseStorage ?? []) {
    if (!addedIds.has(legacyItem.id)) {
      derivedItems.push(legacyItem);
    }
  }

  return derivedItems.sort((a, b) => a.name.localeCompare(b.name));
}

export function moveOwnedItemToForwardLocker(state: GameState, itemId: string): GameState {
  const availableItems = buildOwnedBaseStorageItems(state);
  const item = availableItems.find((entry) => entry.id === itemId);
  if (!item) {
    return state;
  }

  const forwardLocker = [...(state.inventory?.forwardLocker ?? [])];
  const existing = forwardLocker.find((entry) => entry.id === itemId);

  if (existing && item.stackable) {
    existing.quantity += item.quantity;
  } else if (!existing) {
    forwardLocker.push({ ...item });
  }

  return {
    ...state,
    inventory: {
      ...state.inventory,
      forwardLocker,
    },
  };
}

export function moveOwnedItemToBaseStorage(state: GameState, itemId: string): GameState {
  const forwardLocker = [...(state.inventory?.forwardLocker ?? [])];
  const itemIndex = forwardLocker.findIndex((entry) => entry.id === itemId);
  if (itemIndex === -1) {
    return state;
  }

  forwardLocker.splice(itemIndex, 1);

  return {
    ...state,
    inventory: {
      ...state.inventory,
      forwardLocker,
    },
  };
}

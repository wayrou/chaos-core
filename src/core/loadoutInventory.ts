import type { GameState, InventoryItem, Unit, UnitId } from "./types";
import type { Equipment } from "./equipment";
import { getInventoryIconPath } from "./inventoryIcons";

export const PARTY_UNIT_FORWARD_LOCKER_MASS_KG = 5;
export const PARTY_UNIT_FORWARD_LOCKER_BULK_BU = 2;
export const PARTY_UNIT_FORWARD_LOCKER_POWER_W = 10;

const PARTY_AUTO_LOCKER_FLAG = "ccAutoForwardLocker";
const PARTY_AUTO_LOCKER_SOURCE = "ccAutoForwardLockerSource";
const PARTY_AUTO_LOCKER_UNIT_ID = "ccAutoForwardLockerUnitId";
const PARTY_AUTO_LOCKER_MANUAL_CARRYOVER = "ccAutoForwardLockerManualCarryover";

const PARTY_EQUIPMENT_SLOTS = [
  "primaryWeapon",
  "secondaryWeapon",
  "helmet",
  "chestpiece",
  "accessory1",
  "accessory2",
] as const;

type PartyAutoLockerSource = "partyUnit" | "partyGear";

function makeEquipmentInventoryItem(equipment: Equipment, existing?: InventoryItem): InventoryItem {
  const inventoryProfile = equipment.inventory;
  return {
    id: equipment.id,
    name: equipment.name,
    kind: "equipment",
    stackable: false,
    quantity: 1,
    massKg: existing?.massKg ?? inventoryProfile?.massKg ?? 2,
    bulkBu: existing?.bulkBu ?? inventoryProfile?.bulkBu ?? 1,
    powerW: existing?.powerW ?? inventoryProfile?.powerW ?? 1,
    description: existing?.description ?? equipment.description,
    iconPath: getInventoryIconPath(existing?.iconPath ?? equipment.iconPath),
    metadata: existing?.metadata ?? equipment.metadata,
  };
}

function getPartyUnitLockerItemId(unitId: UnitId): string {
  return `party-unit:${unitId}`;
}

function withPartyAutoLockerMetadata(
  item: InventoryItem,
  source: PartyAutoLockerSource,
  unitId: UnitId,
  manualCarryover = false,
): InventoryItem {
  return {
    ...item,
    metadata: {
      ...(item.metadata ?? {}),
      [PARTY_AUTO_LOCKER_FLAG]: true,
      [PARTY_AUTO_LOCKER_SOURCE]: source,
      [PARTY_AUTO_LOCKER_UNIT_ID]: unitId,
      [PARTY_AUTO_LOCKER_MANUAL_CARRYOVER]: manualCarryover,
    },
  };
}

function stripPartyAutoLockerMetadata(item: InventoryItem): InventoryItem {
  const metadata = { ...(item.metadata ?? {}) };
  delete metadata[PARTY_AUTO_LOCKER_FLAG];
  delete metadata[PARTY_AUTO_LOCKER_SOURCE];
  delete metadata[PARTY_AUTO_LOCKER_UNIT_ID];
  delete metadata[PARTY_AUTO_LOCKER_MANUAL_CARRYOVER];

  return {
    ...item,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}

function isPartyAutoLockerManualCarryover(item: InventoryItem): boolean {
  return Boolean(item.metadata?.[PARTY_AUTO_LOCKER_MANUAL_CARRYOVER]);
}

export function isPartyAutoStagedLockerItem(item: InventoryItem | null | undefined): boolean {
  return Boolean(item?.metadata?.[PARTY_AUTO_LOCKER_FLAG]);
}

function makePartyUnitInventoryItem(unit: Unit, existing?: InventoryItem): InventoryItem {
  const unitClass = unit.unitClass ?? "freelancer";
  return withPartyAutoLockerMetadata(
    {
      id: getPartyUnitLockerItemId(unit.id),
      name: unit.name,
      kind: "unit",
      stackable: false,
      quantity: 1,
      massKg: existing?.massKg ?? PARTY_UNIT_FORWARD_LOCKER_MASS_KG,
      bulkBu: existing?.bulkBu ?? PARTY_UNIT_FORWARD_LOCKER_BULK_BU,
      powerW: existing?.powerW ?? PARTY_UNIT_FORWARD_LOCKER_POWER_W,
      description: existing?.description ?? `${unit.name} staged for deployment (${unitClass}).`,
      iconPath: existing?.iconPath,
      metadata: existing?.metadata,
    },
    "partyUnit",
    unit.id,
  );
}

function makePartyGearInventoryItem(equipment: Equipment, unitId: UnitId, existing?: InventoryItem): InventoryItem {
  const manualCarryover = existing
    ? !isPartyAutoStagedLockerItem(existing) || isPartyAutoLockerManualCarryover(existing)
    : false;
  return withPartyAutoLockerMetadata(
    makeEquipmentInventoryItem(equipment, existing),
    "partyGear",
    unitId,
    manualCarryover,
  );
}

function getEquippedGearIdsForUnit(unit: Unit): string[] {
  const loadout = (unit.loadout ?? {}) as Unit["loadout"] & { weapon?: string | null };
  const gearIds: string[] = [];

  PARTY_EQUIPMENT_SLOTS.forEach((slot) => {
    const equipId = slot === "primaryWeapon"
      ? (loadout.primaryWeapon ?? loadout.weapon ?? null)
      : loadout[slot];
    if (equipId) {
      gearIds.push(equipId);
    }
  });

  return gearIds;
}

function buildAutoForwardLockerItemsForUnitIds(state: GameState, unitIds: UnitId[]): InventoryItem[] {
  const lockerLookup = new Map((state.inventory?.forwardLocker ?? []).map((item) => [item.id, item] as const));
  const equipmentById = state.equipmentById ?? {};
  const seenEquipmentIds = new Set<string>();
  const autoItems: InventoryItem[] = [];

  unitIds.forEach((unitId) => {
    const unit = state.unitsById[unitId];
    if (!unit) {
      return;
    }

    autoItems.push(makePartyUnitInventoryItem(unit, lockerLookup.get(getPartyUnitLockerItemId(unit.id))));

    getEquippedGearIdsForUnit(unit).forEach((equipmentId) => {
      if (seenEquipmentIds.has(equipmentId)) {
        return;
      }
      const equipment = equipmentById[equipmentId] as Equipment | undefined;
      if (!equipment) {
        return;
      }
      seenEquipmentIds.add(equipmentId);
      autoItems.push(makePartyGearInventoryItem(equipment, unit.id, lockerLookup.get(equipmentId)));
    });
  });

  return autoItems;
}

function inventoryItemsEqual(left: InventoryItem, right: InventoryItem): boolean {
  return left.id === right.id
    && left.name === right.name
    && left.kind === right.kind
    && left.stackable === right.stackable
    && left.quantity === right.quantity
    && left.massKg === right.massKg
    && left.bulkBu === right.bulkBu
    && left.powerW === right.powerW
    && left.description === right.description
    && left.iconPath === right.iconPath
    && JSON.stringify(left.metadata ?? null) === JSON.stringify(right.metadata ?? null);
}

function inventoryItemListsEqual(left: InventoryItem[], right: InventoryItem[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => inventoryItemsEqual(item, right[index]));
}

export function syncForwardLockerStateForUnitIds(state: GameState, unitIds: UnitId[]): GameState {
  const currentLocker = [...(state.inventory?.forwardLocker ?? [])];
  const autoItems = buildAutoForwardLockerItemsForUnitIds(state, unitIds);
  const autoItemIds = new Set(autoItems.map((item) => item.id));
  const manualItems: InventoryItem[] = [];

  currentLocker.forEach((item) => {
    if (autoItemIds.has(item.id)) {
      return;
    }

    if (isPartyAutoStagedLockerItem(item)) {
      if (item.kind === "equipment" && isPartyAutoLockerManualCarryover(item)) {
        manualItems.push(stripPartyAutoLockerMetadata(item));
      }
      return;
    }

    manualItems.push(item);
  });

  const nextForwardLocker = [...autoItems, ...manualItems];
  if (inventoryItemListsEqual(currentLocker, nextForwardLocker)) {
    return state;
  }

  return {
    ...state,
    inventory: {
      ...state.inventory,
      forwardLocker: nextForwardLocker,
    },
  };
}

export function syncPartyForwardLockerState(state: GameState): GameState {
  return syncForwardLockerStateForUnitIds(state, state.partyUnitIds ?? []);
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
    iconPath: getInventoryIconPath(existing?.iconPath),
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
  const syncedState = syncPartyForwardLockerState(state);
  const availableItems = buildOwnedBaseStorageItems(syncedState);
  const item = availableItems.find((entry) => entry.id === itemId);
  if (!item) {
    return syncedState;
  }

  const forwardLocker = [...(syncedState.inventory?.forwardLocker ?? [])];
  const existing = forwardLocker.find((entry) => entry.id === itemId);

  if (existing && item.stackable) {
    existing.quantity += item.quantity;
  } else if (!existing) {
    forwardLocker.push({ ...item });
  }

  return {
    ...syncedState,
    inventory: {
      ...syncedState.inventory,
      forwardLocker,
    },
  };
}

export function moveOwnedItemToBaseStorage(state: GameState, itemId: string): GameState {
  const syncedState = syncPartyForwardLockerState(state);
  const forwardLocker = [...(syncedState.inventory?.forwardLocker ?? [])];
  const itemIndex = forwardLocker.findIndex((entry) => entry.id === itemId);
  if (itemIndex === -1) {
    return syncedState;
  }

  if (isPartyAutoStagedLockerItem(forwardLocker[itemIndex])) {
    return syncedState;
  }

  forwardLocker.splice(itemIndex, 1);

  return syncPartyForwardLockerState({
    ...syncedState,
    inventory: {
      ...syncedState.inventory,
      forwardLocker,
    },
  });
}

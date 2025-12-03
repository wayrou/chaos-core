// src/core/inventory.ts

import {
  InventoryItem,
  InventoryState,
  MuleWeightClass,
  LoadPenaltyFlags,
} from "./types";

// -------------------------------------------------------------
//  MULE CLASS CAPACITY TABLE
// -------------------------------------------------------------

export const MULE_CLASS_CAPS: Record<
  MuleWeightClass,
  { massKg: number; bulkBu: number; powerW: number }
> = {
  E: { massKg: 100, bulkBu: 70, powerW: 300 },
  D: { massKg: 150, bulkBu: 100, powerW: 450 },
  C: { massKg: 200, bulkBu: 130, powerW: 600 },
  B: { massKg: 260, bulkBu: 170, powerW: 800 },
  A: { massKg: 330, bulkBu: 220, powerW: 1000 },
  S: { massKg: 400, bulkBu: 300, powerW: 1300 },
};

// -------------------------------------------------------------
//  LOAD CALCULATION
// -------------------------------------------------------------

export function computeLoad(state: InventoryState) {
  let mass = 0;
  let bulk = 0;
  let power = 0;

  for (const item of state.forwardLocker) {
    const q = item.quantity ?? 1;
    mass += (item.massKg ?? 0) * q;
    bulk += (item.bulkBu ?? 0) * q;
    power += (item.powerW ?? 0) * q;
  }

  return { mass, bulk, power };
}

// -------------------------------------------------------------
//  OVERCAPACITY FLAGS
// -------------------------------------------------------------

export function computeLoadPenaltyFlags(
  inv: InventoryState
): LoadPenaltyFlags {
  const load = computeLoad(inv);
  const caps = MULE_CLASS_CAPS[inv.muleClass];

  const massPct = load.mass / caps.massKg;
  const bulkPct = load.bulk / caps.bulkBu;
  const powerPct = load.power / caps.powerW;

  return {
    massOver: massPct > 1,
    bulkOver: bulkPct > 1,
    powerOver: powerPct > 1,
    massPct,
    bulkPct,
    powerPct,
  };
}

// -------------------------------------------------------------
//  INVENTORY TRANSFER
// -------------------------------------------------------------

export type InventoryBin = "forwardLocker" | "baseStorage";

export function transferItem(
  inv: InventoryState,
  fromBin: InventoryBin,
  toBin: InventoryBin,
  itemId: string
): InventoryState {
  if (fromBin === toBin) return inv;

  const from = [...inv[fromBin]];
  const to = [...inv[toBin]];

  const idx = from.findIndex((i) => i.id === itemId);
  if (idx === -1) return inv;

  const entry = from[idx];
  from.splice(idx, 1);

  if (entry.stackable) {
    const existing = to.find((i) => i.id === itemId);
    if (existing) {
      existing.quantity += entry.quantity;
      return {
        ...inv,
        [fromBin]: from,
        [toBin]: to,
      };
    }
  }

  to.push(entry);

  return {
    ...inv,
    [fromBin]: from,
    [toBin]: to,
  };
}

// -------------------------------------------------------------
//  MULE UPGRADE
// -------------------------------------------------------------

export function upgradeMuleClass(inv: InventoryState): InventoryState {
  const order: MuleWeightClass[] = ["E", "D", "C", "B", "A", "S"];
  const idx = order.indexOf(inv.muleClass);
  if (idx < 0 || idx === order.length - 1) return inv;

  const nextClass = order[idx + 1];
  const caps = MULE_CLASS_CAPS[nextClass];

  return {
    ...inv,
    muleClass: nextClass,
    capacityMassKg: caps.massKg,
    capacityBulkBu: caps.bulkBu,
    capacityPowerW: caps.powerW,
  };
}

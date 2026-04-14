// src/core/inventory.ts
// -------------------------------------------------------------
//  MULE CLASS CAPACITY TABLE
// -------------------------------------------------------------
export const MULE_CLASS_CAPS = {
    E: { massKg: 50, bulkBu: 35, powerW: 150 },
    D: { massKg: 75, bulkBu: 50, powerW: 225 },
    C: { massKg: 100, bulkBu: 65, powerW: 300 },
    B: { massKg: 130, bulkBu: 85, powerW: 400 },
    A: { massKg: 165, bulkBu: 110, powerW: 500 },
    S: { massKg: 200, bulkBu: 150, powerW: 650 },
};
export const MULE_CLASS_ORDER = ["E", "D", "C", "B", "A", "S"];
export const MULE_UPGRADE_WAD_COSTS = {
    E: 5000,
    D: 15000,
    C: 45000,
    B: 125000,
    A: 300000,
};
// -------------------------------------------------------------
//  LOAD CALCULATION
// -------------------------------------------------------------
export function computeLoad(state) {
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
export function computeLoadPenaltyFlags(inv) {
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
export function transferItem(inv, fromBin, toBin, itemId) {
    if (fromBin === toBin)
        return inv;
    const from = [...inv[fromBin]];
    const to = [...inv[toBin]];
    const idx = from.findIndex((i) => i.id === itemId);
    if (idx === -1)
        return inv;
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
export function getNextMuleClass(muleClass) {
    const idx = MULE_CLASS_ORDER.indexOf(muleClass);
    if (idx < 0 || idx === MULE_CLASS_ORDER.length - 1) {
        return null;
    }
    return MULE_CLASS_ORDER[idx + 1];
}
export function getMuleUpgradeWadCost(muleClass) {
    return MULE_UPGRADE_WAD_COSTS[muleClass] ?? null;
}
export function upgradeMuleClass(inv) {
    const nextClass = getNextMuleClass(inv.muleClass);
    if (!nextClass)
        return inv;
    const caps = MULE_CLASS_CAPS[nextClass];
    return {
        ...inv,
        muleClass: nextClass,
        capacityMassKg: caps.massKg,
        capacityBulkBu: caps.bulkBu,
        capacityPowerW: caps.powerW,
    };
}

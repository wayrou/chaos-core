export const RESOURCE_KEYS = [
    "metalScrap",
    "wood",
    "chaosShards",
    "steamComponents",
    "alloy",
    "drawcord",
    "fittings",
    "resin",
    "chargeCells",
];
export const BASIC_RESOURCE_KEYS = ["metalScrap", "wood", "chaosShards", "steamComponents"];
export const ADVANCED_RESOURCE_KEYS = ["alloy", "drawcord", "fittings", "resin", "chargeCells"];
export const RESOURCE_LABELS = {
    metalScrap: "Metal Scrap",
    wood: "Wood",
    chaosShards: "Chaos Shards",
    steamComponents: "Steam Components",
    alloy: "Alloy",
    drawcord: "Drawcord",
    fittings: "Fittings",
    resin: "Resin",
    chargeCells: "Charge Cells",
};
export const RESOURCE_SHORT_LABELS = {
    metalScrap: "METAL",
    wood: "WOOD",
    chaosShards: "SHARDS",
    steamComponents: "STEAM",
    alloy: "ALLOY",
    drawcord: "DRAWCORD",
    fittings: "FITTINGS",
    resin: "RESIN",
    chargeCells: "CHARGE CELLS",
};
export const RESOURCE_ABBREVIATIONS = {
    metalScrap: "MS",
    wood: "W",
    chaosShards: "CS",
    steamComponents: "SC",
    alloy: "AL",
    drawcord: "DC",
    fittings: "FT",
    resin: "RS",
    chargeCells: "CC",
};
export function createEmptyResourceWallet(partial) {
    return RESOURCE_KEYS.reduce((wallet, key) => {
        wallet[key] = Number(partial?.[key] ?? 0);
        return wallet;
    }, {});
}
export function addResourceWallet(base, delta) {
    return RESOURCE_KEYS.reduce((wallet, key) => {
        wallet[key] = Number(base?.[key] ?? 0) + Number(delta?.[key] ?? 0);
        return wallet;
    }, {});
}
export function subtractResourceWallet(base, delta, clampToZero = false) {
    return RESOURCE_KEYS.reduce((wallet, key) => {
        const amount = Number(base?.[key] ?? 0) - Number(delta?.[key] ?? 0);
        wallet[key] = clampToZero ? Math.max(0, amount) : amount;
        return wallet;
    }, {});
}
export function hasEnoughResources(resources, cost) {
    return RESOURCE_KEYS.every((key) => Number(resources?.[key] ?? 0) >= Number(cost?.[key] ?? 0));
}
export function getResourceEntries(wallet, options) {
    const keys = options?.keys ?? RESOURCE_KEYS;
    return keys
        .map((key) => ({
        key,
        amount: Number(wallet?.[key] ?? 0),
        label: RESOURCE_LABELS[key],
        shortLabel: RESOURCE_SHORT_LABELS[key],
        abbreviation: RESOURCE_ABBREVIATIONS[key],
    }))
        .filter((entry) => options?.includeZero || entry.amount > 0);
}
export function formatResourceLabel(key) {
    return RESOURCE_LABELS[key];
}
export function formatResourceShortLabel(key) {
    return RESOURCE_SHORT_LABELS[key];
}
export function formatResourceAbbreviation(key) {
    return RESOURCE_ABBREVIATIONS[key];
}

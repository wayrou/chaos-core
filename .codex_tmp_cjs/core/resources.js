"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESOURCE_ABBREVIATIONS = exports.RESOURCE_SHORT_LABELS = exports.RESOURCE_LABELS = exports.ADVANCED_RESOURCE_KEYS = exports.BASIC_RESOURCE_KEYS = exports.RESOURCE_KEYS = void 0;
exports.createEmptyResourceWallet = createEmptyResourceWallet;
exports.addResourceWallet = addResourceWallet;
exports.subtractResourceWallet = subtractResourceWallet;
exports.hasEnoughResources = hasEnoughResources;
exports.getResourceEntries = getResourceEntries;
exports.formatResourceLabel = formatResourceLabel;
exports.formatResourceShortLabel = formatResourceShortLabel;
exports.formatResourceAbbreviation = formatResourceAbbreviation;
exports.RESOURCE_KEYS = [
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
exports.BASIC_RESOURCE_KEYS = ["metalScrap", "wood", "chaosShards", "steamComponents"];
exports.ADVANCED_RESOURCE_KEYS = ["alloy", "drawcord", "fittings", "resin", "chargeCells"];
exports.RESOURCE_LABELS = {
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
exports.RESOURCE_SHORT_LABELS = {
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
exports.RESOURCE_ABBREVIATIONS = {
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
function createEmptyResourceWallet(partial) {
    return exports.RESOURCE_KEYS.reduce((wallet, key) => {
        wallet[key] = Number(partial?.[key] ?? 0);
        return wallet;
    }, {});
}
function addResourceWallet(base, delta) {
    return exports.RESOURCE_KEYS.reduce((wallet, key) => {
        wallet[key] = Number(base?.[key] ?? 0) + Number(delta?.[key] ?? 0);
        return wallet;
    }, {});
}
function subtractResourceWallet(base, delta, clampToZero = false) {
    return exports.RESOURCE_KEYS.reduce((wallet, key) => {
        const amount = Number(base?.[key] ?? 0) - Number(delta?.[key] ?? 0);
        wallet[key] = clampToZero ? Math.max(0, amount) : amount;
        return wallet;
    }, {});
}
function hasEnoughResources(resources, cost) {
    return exports.RESOURCE_KEYS.every((key) => Number(resources?.[key] ?? 0) >= Number(cost?.[key] ?? 0));
}
function getResourceEntries(wallet, options) {
    const keys = options?.keys ?? exports.RESOURCE_KEYS;
    return keys
        .map((key) => ({
        key,
        amount: Number(wallet?.[key] ?? 0),
        label: exports.RESOURCE_LABELS[key],
        shortLabel: exports.RESOURCE_SHORT_LABELS[key],
        abbreviation: exports.RESOURCE_ABBREVIATIONS[key],
    }))
        .filter((entry) => options?.includeZero || entry.amount > 0);
}
function formatResourceLabel(key) {
    return exports.RESOURCE_LABELS[key];
}
function formatResourceShortLabel(key) {
    return exports.RESOURCE_SHORT_LABELS[key];
}
function formatResourceAbbreviation(key) {
    return exports.RESOURCE_ABBREVIATIONS[key];
}

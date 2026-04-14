// ============================================================================
// PORT TRADE SYSTEM - DATA DEFINITIONS
// ============================================================================
import { ADVANCED_RESOURCE_KEYS, BASIC_RESOURCE_KEYS } from "./resources";
// ----------------------------------------------------------------------------
// BASIC RESOURCES
// ----------------------------------------------------------------------------
export const BASIC_RESOURCES = [...BASIC_RESOURCE_KEYS];
// Rare resources (only available for Bulk Shipment after Operation 4/5)
export const RARE_RESOURCES = [...ADVANCED_RESOURCE_KEYS];
// ----------------------------------------------------------------------------
// NORMAL TRADE TEMPLATES
// ----------------------------------------------------------------------------
const NORMAL_TRADE_TEMPLATES = [
    // Metal Scrap trades
    {
        name: "Scrap Exchange",
        description: "Trade metal scrap for wood",
        input: { resource: "metalScrap", amount: 15 },
        output: { resource: "wood", amount: 12 },
        weight: 10,
    },
    {
        name: "Metal Refinement",
        description: "Convert metal scrap to steam components",
        input: { resource: "metalScrap", amount: 20 },
        output: { resource: "steamComponents", amount: 8 },
        weight: 8,
    },
    {
        name: "Scrap for Shards",
        description: "Trade metal scrap for chaos shards",
        input: { resource: "metalScrap", amount: 25 },
        output: { resource: "chaosShards", amount: 5 },
        weight: 6,
    },
    // Wood trades
    {
        name: "Timber Exchange",
        description: "Trade wood for metal scrap",
        input: { resource: "wood", amount: 12 },
        output: { resource: "metalScrap", amount: 15 },
        weight: 10,
    },
    {
        name: "Wood Processing",
        description: "Convert wood to steam components",
        input: { resource: "wood", amount: 18 },
        output: { resource: "steamComponents", amount: 6 },
        weight: 8,
    },
    {
        name: "Wood for Shards",
        description: "Trade wood for chaos shards",
        input: { resource: "wood", amount: 20 },
        output: { resource: "chaosShards", amount: 4 },
        weight: 6,
    },
    // Chaos Shards trades
    {
        name: "Shard Conversion",
        description: "Trade chaos shards for metal scrap",
        input: { resource: "chaosShards", amount: 5 },
        output: { resource: "metalScrap", amount: 20 },
        weight: 7,
    },
    {
        name: "Shard Refinement",
        description: "Trade chaos shards for wood",
        input: { resource: "chaosShards", amount: 4 },
        output: { resource: "wood", amount: 15 },
        weight: 7,
    },
    {
        name: "Shard Processing",
        description: "Convert chaos shards to steam components",
        input: { resource: "chaosShards", amount: 6 },
        output: { resource: "steamComponents", amount: 10 },
        weight: 5,
    },
    // Steam Components trades
    {
        name: "Component Exchange",
        description: "Trade steam components for metal scrap",
        input: { resource: "steamComponents", amount: 8 },
        output: { resource: "metalScrap", amount: 18 },
        weight: 8,
    },
    {
        name: "Component Refinement",
        description: "Trade steam components for wood",
        input: { resource: "steamComponents", amount: 6 },
        output: { resource: "wood", amount: 16 },
        weight: 8,
    },
    {
        name: "Component Conversion",
        description: "Convert steam components to chaos shards",
        input: { resource: "steamComponents", amount: 10 },
        output: { resource: "chaosShards", amount: 5 },
        weight: 5,
    },
];
// ----------------------------------------------------------------------------
// BULK SHIPMENT PAYOUT TABLES
// ----------------------------------------------------------------------------
// Basic payouts (90% chance) - conservative resource bundles
const BULK_SHIPMENT_BASIC_PAYOUTS = [
    [{ resource: "wood", amount: 30 }, { resource: "metalScrap", amount: 25 }],
    [{ resource: "metalScrap", amount: 40 }, { resource: "steamComponents", amount: 12 }],
    [{ resource: "wood", amount: 35 }, { resource: "chaosShards", amount: 8 }],
    [{ resource: "steamComponents", amount: 20 }, { resource: "metalScrap", amount: 20 }],
    [{ resource: "chaosShards", amount: 10 }, { resource: "wood", amount: 25 }],
];
// Interesting payouts (10% chance) - slightly better but not optimal
const BULK_SHIPMENT_INTERESTING_PAYOUTS = [
    [{ resource: "chaosShards", amount: 15 }, { resource: "steamComponents", amount: 15 }],
    [{ resource: "metalScrap", amount: 50 }, { resource: "wood", amount: 40 }],
    [{ resource: "steamComponents", amount: 25 }, { resource: "chaosShards", amount: 12 }],
    [{ resource: "alloy", amount: 8 }, { resource: "fittings", amount: 10 }],
    [{ resource: "drawcord", amount: 12 }, { resource: "resin", amount: 9 }],
    [{ resource: "chargeCells", amount: 6 }, { resource: "alloy", amount: 5 }],
];
// ----------------------------------------------------------------------------
// EXPORTS
// ----------------------------------------------------------------------------
export function getNormalTradeTemplates() {
    return NORMAL_TRADE_TEMPLATES;
}
export function getBulkShipmentBasicPayouts() {
    return BULK_SHIPMENT_BASIC_PAYOUTS;
}
export function getBulkShipmentInterestingPayouts() {
    return BULK_SHIPMENT_INTERESTING_PAYOUTS;
}

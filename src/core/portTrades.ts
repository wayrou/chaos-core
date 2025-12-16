// ============================================================================
// PORT TRADE SYSTEM - DATA DEFINITIONS
// ============================================================================

export type ResourceType = "metalScrap" | "wood" | "chaosShards" | "steamComponents";

export interface ResourceAmount {
  resource: ResourceType;
  amount: number;
}

export interface TradeOffer {
  id: string;
  name: string;
  description: string;
  input: ResourceAmount;
  output: ResourceAmount;
  weight: number; // For weighted random selection
  fulfilled: boolean; // Track if this offer has been used
}

export interface BulkShipmentOffer {
  id: string;
  name: string;
  description: string;
  targetResource: ResourceType; // Resource type to consume ALL of
  basicPayout: ResourceAmount[]; // 90% chance - basic resources
  interestingPayout: ResourceAmount[]; // 10% chance - interesting rewards
}

export interface PortManifest {
  normalOffers: TradeOffer[];
  bulkShipmentOffer: BulkShipmentOffer;
  generatedAtVisitIndex: number;
  generatedAtTime: number; // Timestamp for UI display
}

// ----------------------------------------------------------------------------
// BASIC RESOURCES
// ----------------------------------------------------------------------------

export const BASIC_RESOURCES: ResourceType[] = [
  "metalScrap",
  "wood",
  "chaosShards",
  "steamComponents",
];

// Rare resources (only available for Bulk Shipment after Operation 4/5)
// For now, we'll use the same basic resources but could extend later
export const RARE_RESOURCES: ResourceType[] = []; // Placeholder for future expansion

// ----------------------------------------------------------------------------
// NORMAL TRADE TEMPLATES
// ----------------------------------------------------------------------------

const NORMAL_TRADE_TEMPLATES: Omit<TradeOffer, "id" | "fulfilled">[] = [
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
const BULK_SHIPMENT_BASIC_PAYOUTS: ResourceAmount[][] = [
  [{ resource: "wood", amount: 30 }, { resource: "metalScrap", amount: 25 }],
  [{ resource: "metalScrap", amount: 40 }, { resource: "steamComponents", amount: 12 }],
  [{ resource: "wood", amount: 35 }, { resource: "chaosShards", amount: 8 }],
  [{ resource: "steamComponents", amount: 20 }, { resource: "metalScrap", amount: 20 }],
  [{ resource: "chaosShards", amount: 10 }, { resource: "wood", amount: 25 }],
];

// Interesting payouts (10% chance) - slightly better but not optimal
const BULK_SHIPMENT_INTERESTING_PAYOUTS: ResourceAmount[][] = [
  [{ resource: "chaosShards", amount: 15 }, { resource: "steamComponents", amount: 15 }],
  [{ resource: "metalScrap", amount: 50 }, { resource: "wood", amount: 40 }],
  [{ resource: "steamComponents", amount: 25 }, { resource: "chaosShards", amount: 12 }],
];

// ----------------------------------------------------------------------------
// EXPORTS
// ----------------------------------------------------------------------------

export function getNormalTradeTemplates(): Omit<TradeOffer, "id" | "fulfilled">[] {
  return NORMAL_TRADE_TEMPLATES;
}

export function getBulkShipmentBasicPayouts(): ResourceAmount[][] {
  return BULK_SHIPMENT_BASIC_PAYOUTS;
}

export function getBulkShipmentInterestingPayouts(): ResourceAmount[][] {
  return BULK_SHIPMENT_INTERESTING_PAYOUTS;
}


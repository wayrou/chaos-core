export type ResourceKey =
  | "metalScrap"
  | "wood"
  | "chaosShards"
  | "steamComponents"
  | "alloy"
  | "drawcord"
  | "fittings"
  | "resin"
  | "chargeCells";

export type ResourceWallet = Record<ResourceKey, number>;

export const RESOURCE_KEYS: ResourceKey[] = [
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

export const BASIC_RESOURCE_KEYS = ["metalScrap", "wood", "chaosShards", "steamComponents"] as const;
export const ADVANCED_RESOURCE_KEYS = ["alloy", "drawcord", "fittings", "resin", "chargeCells"] as const;

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
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

export const RESOURCE_SHORT_LABELS: Record<ResourceKey, string> = {
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

export const RESOURCE_ABBREVIATIONS: Record<ResourceKey, string> = {
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

export function createEmptyResourceWallet(
  partial?: Partial<Record<ResourceKey, number>> | null,
): ResourceWallet {
  return RESOURCE_KEYS.reduce<ResourceWallet>((wallet, key) => {
    wallet[key] = Number(partial?.[key] ?? 0);
    return wallet;
  }, {} as ResourceWallet);
}

export function addResourceWallet(
  base: Partial<Record<ResourceKey, number>> | null | undefined,
  delta: Partial<Record<ResourceKey, number>> | null | undefined,
): ResourceWallet {
  return RESOURCE_KEYS.reduce<ResourceWallet>((wallet, key) => {
    wallet[key] = Number(base?.[key] ?? 0) + Number(delta?.[key] ?? 0);
    return wallet;
  }, {} as ResourceWallet);
}

export function subtractResourceWallet(
  base: Partial<Record<ResourceKey, number>> | null | undefined,
  delta: Partial<Record<ResourceKey, number>> | null | undefined,
  clampToZero = false,
): ResourceWallet {
  return RESOURCE_KEYS.reduce<ResourceWallet>((wallet, key) => {
    const amount = Number(base?.[key] ?? 0) - Number(delta?.[key] ?? 0);
    wallet[key] = clampToZero ? Math.max(0, amount) : amount;
    return wallet;
  }, {} as ResourceWallet);
}

export function hasEnoughResources(
  resources: Partial<Record<ResourceKey, number>> | null | undefined,
  cost: Partial<Record<ResourceKey, number>> | null | undefined,
): boolean {
  return RESOURCE_KEYS.every((key) => Number(resources?.[key] ?? 0) >= Number(cost?.[key] ?? 0));
}

export function getResourceEntries(
  wallet: Partial<Record<ResourceKey, number>> | null | undefined,
  options?: { includeZero?: boolean; keys?: readonly ResourceKey[] },
): Array<{ key: ResourceKey; amount: number; label: string; shortLabel: string; abbreviation: string }> {
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

export function formatResourceLabel(key: ResourceKey): string {
  return RESOURCE_LABELS[key];
}

export function formatResourceShortLabel(key: ResourceKey): string {
  return RESOURCE_SHORT_LABELS[key];
}

export function formatResourceAbbreviation(key: ResourceKey): string {
  return RESOURCE_ABBREVIATIONS[key];
}

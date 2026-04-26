export interface MerchantListingSource {
  floorOrdinal?: number;
  notes?: string;
}

export function getMerchantFloorOrdinal(source: MerchantListingSource | null | undefined): number | null {
  const floorOrdinal = Math.floor(Number(source?.floorOrdinal ?? 0));
  return Number.isFinite(floorOrdinal) && floorOrdinal > 0 ? floorOrdinal : null;
}

export function isMerchantListingAvailable(
  source: MerchantListingSource | null | undefined,
  floorOrdinal: number,
): boolean {
  return getMerchantFloorOrdinal(source) === Math.floor(Number(floorOrdinal));
}

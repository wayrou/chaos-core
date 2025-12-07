// ============================================================================
// PORTRAIT SYSTEM - Helper functions for unit portraits
// ============================================================================

import { UnitId } from "./types";

/**
 * Gets the portrait path for a unit based on its ID.
 * Looks for portraits in public/assets/portraits/units/{category}/{unitId}_Portrait.png
 * Falls back to a default portrait if not found.
 */
export function getUnitPortraitPath(unitId: UnitId | string | undefined): string {
  if (!unitId) {
    return "/assets/portraits/units/core/Test_Portrait.png";
  }

  // Try different possible paths based on unit ID structure
  // First, try the direct path: units/{category}/{unitId}_Portrait.png
  // For example: unit_aeriss -> units/core/unit_aeriss_Portrait.png
  
  // Extract category from unit ID (e.g., "unit_aeriss" -> "core")
  // For now, default to "core" category
  const category = "core";
  
  // Try the standard naming: {unitId}_Portrait.png
  const standardPath = `/assets/portraits/units/${category}/${unitId}_Portrait.png`;
  
  // Return the path (the actual file existence will be handled by the browser)
  return standardPath;
}

/**
 * Gets the portrait path for a battle unit.
 * Uses baseUnitId if available, otherwise falls back to id.
 */
export function getBattleUnitPortraitPath(
  unitId: UnitId | string | undefined,
  baseUnitId?: UnitId | string | undefined
): string {
  // Prefer baseUnitId for battle units to get the original unit's portrait
  return getUnitPortraitPath(baseUnitId || unitId);
}

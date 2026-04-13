// ============================================================================
// PORTRAIT SYSTEM - Helper functions for unit portraits
// ============================================================================

import { UnitId } from "./types";

const DEFAULT_UNIT_PORTRAIT_PATH = "/assets/portraits/units/core/Test_Portrait.png";
const DEFAULT_UNIT_MANAGEMENT_STAND_ICON_PATH = "/assets/portraits/units/core/Unit_Stand_Test.png";
const SQUIRE_UNIT_MANAGEMENT_STAND_ICON_PATH = "/assets/portraits/units/core/Squire_Stand.png";
const BATTLE_BILLBOARD_CATEGORY = "core";

export type BattleBillboardPerspective = "nw" | "ne" | "se" | "sw";

interface BattleBillboardSpriteOptions {
  unitId?: UnitId | string;
  baseUnitId?: UnitId | string;
  classId?: string | null;
  perspective: BattleBillboardPerspective;
  fallbackPath?: string | null;
}

function normalizeAssetToken(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\s+/g, "_");
}

function toTitleSnakeCase(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("_");
}

function getAssetTokenVariants(value: string | null | undefined): string[] {
  const normalized = normalizeAssetToken(value);
  if (!normalized) {
    return [];
  }

  const variants = [normalized, toTitleSnakeCase(normalized)];
  return Array.from(new Set(variants.filter(Boolean)));
}

function buildDirectionalBattleSpritePath(token: string, perspective: BattleBillboardPerspective): string {
  return `/assets/portraits/units/${BATTLE_BILLBOARD_CATEGORY}/${token}_Battle_${perspective.toUpperCase()}.png`;
}

function buildStandSpritePath(token: string): string {
  return `/assets/portraits/units/${BATTLE_BILLBOARD_CATEGORY}/${token}_Stand.png`;
}

function pushUnique(target: string[], value: string | null | undefined): void {
  if (!value || target.includes(value)) {
    return;
  }
  target.push(value);
}

export function getBattleBillboardPerspectiveFromOrbitYaw(orbitYaw: number): BattleBillboardPerspective {
  const normalizedYaw = ((orbitYaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const quadrantIndex = (((Math.round((normalizedYaw - Math.PI / 4) / (Math.PI / 2)) % 4) + 4) % 4);
  return (["nw", "ne", "se", "sw"] as const)[quadrantIndex] ?? "nw";
}

/**
 * Gets the portrait path for a unit based on its ID.
 * Looks for portraits in public/assets/portraits/units/{category}/{unitId}_Portrait.png
 * Falls back to a default portrait if not found.
 */
export function getUnitPortraitPath(unitId: UnitId | string | undefined): string {
  if (!unitId) {
    return DEFAULT_UNIT_PORTRAIT_PATH;
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

export function getUnitManagementStandIconPath(unitClass?: string | null): string {
  return unitClass === "squire"
    ? SQUIRE_UNIT_MANAGEMENT_STAND_ICON_PATH
    : DEFAULT_UNIT_MANAGEMENT_STAND_ICON_PATH;
}

// Battle billboards look for per-unit or per-class sprites named like
// `squire_Battle_NW.png` / `Squire_Battle_NE.png` before falling back.
export function getBattleUnitBillboardSpriteCandidates({
  unitId,
  baseUnitId,
  classId,
  perspective,
  fallbackPath,
}: BattleBillboardSpriteOptions): string[] {
  const candidates: string[] = [];
  const unitTokens = [
    ...getAssetTokenVariants(baseUnitId),
    ...getAssetTokenVariants(unitId),
  ];
  const classTokens = getAssetTokenVariants(classId);

  Array.from(new Set(unitTokens)).forEach((token) => {
    pushUnique(candidates, buildDirectionalBattleSpritePath(token, perspective));
    pushUnique(candidates, buildStandSpritePath(token));
  });

  Array.from(new Set(classTokens)).forEach((token) => {
    pushUnique(candidates, buildDirectionalBattleSpritePath(token, perspective));
    pushUnique(candidates, buildStandSpritePath(token));
  });

  pushUnique(candidates, getUnitManagementStandIconPath(classId));
  pushUnique(candidates, fallbackPath ?? null);
  pushUnique(candidates, DEFAULT_UNIT_MANAGEMENT_STAND_ICON_PATH);
  pushUnique(candidates, DEFAULT_UNIT_PORTRAIT_PATH);
  return candidates;
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

import type { GameState } from "./types";

export const UNIT_NAME_MAX_LENGTH = 24;
export const UNIT_NOTES_MAX_LENGTH = 600;

export const UNIT_APPEARANCE_HEAD_OPTIONS = [
  { id: "open_face", label: "Open Face" },
  { id: "visor_helm", label: "Visor Helm" },
] as const;

export const UNIT_APPEARANCE_HAIR_OPTIONS = [
  { id: "close_crop", label: "Close Crop" },
  { id: "long_braid", label: "Long Braid" },
] as const;

export type UnitAppearanceHeadId = (typeof UNIT_APPEARANCE_HEAD_OPTIONS)[number]["id"];
export type UnitAppearanceHairId = (typeof UNIT_APPEARANCE_HAIR_OPTIONS)[number]["id"];

export interface UnitAppearance {
  head: UnitAppearanceHeadId;
  hair: UnitAppearanceHairId;
}

export type UnitStandSpriteVariant = "standard" | "squire";

const UNIT_APPEARANCE_HEAD_IDS = new Set<UnitAppearanceHeadId>(
  UNIT_APPEARANCE_HEAD_OPTIONS.map((option) => option.id),
);
const UNIT_APPEARANCE_HAIR_IDS = new Set<UnitAppearanceHairId>(
  UNIT_APPEARANCE_HAIR_OPTIONS.map((option) => option.id),
);

export function createDefaultUnitAppearance(unitClass?: string | null): UnitAppearance {
  return unitClass === "squire"
    ? { head: "visor_helm", hair: "close_crop" }
    : { head: "open_face", hair: "close_crop" };
}

export function normalizeUnitAppearance(
  appearance: Partial<UnitAppearance> | null | undefined,
  unitClass?: string | null,
): UnitAppearance {
  const fallback = createDefaultUnitAppearance(unitClass);
  const head = appearance?.head;
  const hair = appearance?.hair;

  return {
    head: head && UNIT_APPEARANCE_HEAD_IDS.has(head) ? head : fallback.head,
    hair: hair && UNIT_APPEARANCE_HAIR_IDS.has(hair) ? hair : fallback.hair,
  };
}

export function getUnitStandSpriteVariant(
  appearance: Partial<UnitAppearance> | null | undefined,
  unitClass?: string | null,
): UnitStandSpriteVariant {
  const normalized = normalizeUnitAppearance(appearance, unitClass);
  const useSquireVariant = (normalized.head === "visor_helm") !== (normalized.hair === "long_braid");
  return useSquireVariant ? "squire" : "standard";
}

export function clampUnitName(value: string, fallback: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return fallback;
  }
  return collapsed.slice(0, UNIT_NAME_MAX_LENGTH);
}

export function clampUnitNotes(value: string): string {
  const normalized = value.replace(/\r\n?/g, "\n").slice(0, UNIT_NOTES_MAX_LENGTH);
  return normalized.trim() ? normalized : "";
}

export function withNormalizedUnitAppearanceState(state: GameState): GameState {
  let unitsChanged = false;
  const nextUnitsById = Object.fromEntries(
    Object.entries(state.unitsById ?? {}).map(([unitId, unit]) => {
      const normalizedAppearance = normalizeUnitAppearance(unit.appearance, unit.unitClass);
      const currentAppearance = unit.appearance;
      const hasChanged = currentAppearance?.head !== normalizedAppearance.head
        || currentAppearance?.hair !== normalizedAppearance.hair;

      if (!hasChanged) {
        return [unitId, unit];
      }

      unitsChanged = true;
      return [unitId, { ...unit, appearance: normalizedAppearance }];
    }),
  ) as GameState["unitsById"];

  let battleChanged = false;
  const nextCurrentBattle = state.currentBattle
    ? {
        ...state.currentBattle,
        units: Object.fromEntries(
          Object.entries(state.currentBattle.units).map(([unitId, unit]) => {
            const baseAppearance = nextUnitsById[unit.baseUnitId]?.appearance;
            const baseClassId = nextUnitsById[unit.baseUnitId]?.unitClass ?? unit.classId;
            const normalizedAppearance = normalizeUnitAppearance(
              (unit as { appearance?: Partial<UnitAppearance> | null }).appearance ?? baseAppearance,
              baseClassId,
            );
            const currentAppearance = (unit as { appearance?: UnitAppearance | null }).appearance;
            const hasChanged = currentAppearance?.head !== normalizedAppearance.head
              || currentAppearance?.hair !== normalizedAppearance.hair;

            if (!hasChanged) {
              return [unitId, unit];
            }

            battleChanged = true;
            return [unitId, { ...unit, appearance: normalizedAppearance }];
          }),
        ) as typeof state.currentBattle.units,
      }
    : state.currentBattle;

  if (!unitsChanged && !battleChanged) {
    return state;
  }

  return {
    ...state,
    unitsById: nextUnitsById,
    currentBattle: nextCurrentBattle,
  };
}

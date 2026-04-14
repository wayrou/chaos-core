import { type ChassisSlotType } from "../data/gearChassis";
import { randomInt } from "./rng";
import type { EquipmentStats, WeaponType } from "./equipment";

export const CRAFTED_WEAPON_SHAPES = [
  "sword",
  "bow",
  "shortsword",
  "greatsword",
  "staff",
  "shield",
  "gun",
  "greatbow",
  "greatstaff",
  "spear",
  "greatspear",
  "hammer",
] as const satisfies readonly WeaponType[];

export type CraftedWeaponShape = (typeof CRAFTED_WEAPON_SHAPES)[number];

const CRAFTED_ACCURACY_MIN = 0;
const CRAFTED_ACCURACY_MAX = 3;

export function getDefaultCraftedWeaponShape(): CraftedWeaponShape {
  return "sword";
}

export function formatCraftedWeaponShapeLabel(shape: WeaponType): string {
  return shape.replace(/_/g, " ").toUpperCase();
}

export function getCraftedGearBaseStats(slotType: ChassisSlotType): EquipmentStats {
  return {
    atk: slotType === "weapon" ? 5 : 0,
    def: slotType === "helmet" || slotType === "chestpiece" ? 3 : 0,
    agi: slotType === "accessory" ? 2 : 0,
    acc: slotType === "weapon" ? 1 : 0,
    hp: 0,
  };
}

export function clampCraftedAccuracyModifier(value: number): number {
  return Math.max(CRAFTED_ACCURACY_MIN, Math.min(CRAFTED_ACCURACY_MAX, value));
}

export function rollChaoticCraftedGearStats(slotType: ChassisSlotType, rng: () => number): EquipmentStats {
  const base = getCraftedGearBaseStats(slotType);
  const atkSwing = slotType === "weapon" ? randomInt(rng, -2, 4) : randomInt(rng, 0, 3);
  const defSwing = slotType === "accessory" ? randomInt(rng, 0, 2) : randomInt(rng, -1, 4);
  const agiSwing = slotType === "accessory" ? randomInt(rng, -1, 3) : randomInt(rng, 0, 2);
  const hpSwing = slotType === "chestpiece" ? randomInt(rng, 2, 10) : randomInt(rng, 0, 6);
  const accSwing = slotType === "weapon" ? randomInt(rng, -1, 2) : randomInt(rng, 0, 1);

  return {
    atk: clampStat(base.atk + atkSwing),
    def: clampStat(base.def + defSwing),
    agi: clampStat(base.agi + agiSwing),
    acc: clampCraftedAccuracyModifier(base.acc + accSwing),
    hp: clampStat(base.hp + hpSwing),
  };
}

export function getCraftedGearDescription(chassisName: string, doctrineName?: string | null): string {
  const trimmedChassis = chassisName.trim();
  const trimmedDoctrine = doctrineName?.trim();
  if (trimmedDoctrine) {
    return `${trimmedChassis} chassis tuned to the ${trimmedDoctrine} pattern for field deployment.`;
  }
  return `${trimmedChassis} chassis forced into an unbound field pattern for deployment.`;
}

export function normalizeWeaponTypeForRestrictions(weaponType: WeaponType): WeaponType {
  switch (weaponType) {
    case "spear":
      return "sword";
    case "greatspear":
      return "greatsword";
    case "hammer":
      return "greatsword";
    default:
      return weaponType;
  }
}

function clampStat(value: number): number {
  return Math.max(0, value);
}

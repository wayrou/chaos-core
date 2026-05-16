import type { FieldEnemy } from "../types";
import type { Haven3DGearbladeMode } from "./coordinates";

export type Haven3DEnemyDefense = "none" | "shield" | "armor";

function normalizeDefense(value: unknown): Haven3DEnemyDefense {
  return value === "shield" || value === "armor" ? value : "none";
}

export function getHaven3DEnemyDefense(enemy: Pick<FieldEnemy, "gearbladeDefense" | "kind" | "name" | "id">): Haven3DEnemyDefense {
  const explicitDefense = normalizeDefense(enemy.gearbladeDefense);
  if (explicitDefense !== "none") {
    return explicitDefense;
  }

  const descriptor = `${enemy.kind ?? ""} ${enemy.name ?? ""} ${enemy.id ?? ""}`.toLowerCase();
  if (/\b(shield|slinger|guarded|warded)\b/.test(descriptor)) {
    return "shield";
  }
  if (/\b(armor|armored|heavy|sentinel|plate|bulwark)\b/.test(descriptor)) {
    return "armor";
  }
  return "none";
}

export function isHaven3DEnemyDefenseBroken(enemy: Pick<FieldEnemy, "gearbladeDefenseBroken">): boolean {
  return enemy.gearbladeDefenseBroken === true;
}

export function getHaven3DRequiredDefenseBreaker(defense: Haven3DEnemyDefense): Haven3DGearbladeMode | null {
  switch (defense) {
    case "shield":
      return "grapple";
    case "armor":
      return "launcher";
    default:
      return null;
  }
}

export function resolveHaven3DGearbladeDamage(
  enemy: Pick<FieldEnemy, "gearbladeDefense" | "gearbladeDefenseBroken" | "kind" | "name" | "id">,
  mode: Haven3DGearbladeMode,
): {
  defense: Haven3DEnemyDefense;
  requiredBreaker: Haven3DGearbladeMode | null;
  breaksDefense: boolean;
  blocked: boolean;
  damageMultiplier: number;
} {
  const defense = getHaven3DEnemyDefense(enemy);
  const requiredBreaker = getHaven3DRequiredDefenseBreaker(defense);
  if (defense === "none" || isHaven3DEnemyDefenseBroken(enemy)) {
    return {
      defense,
      requiredBreaker,
      breaksDefense: false,
      blocked: false,
      damageMultiplier: 1,
    };
  }

  if (mode === requiredBreaker) {
    return {
      defense,
      requiredBreaker,
      breaksDefense: true,
      blocked: false,
      damageMultiplier: 1,
    };
  }

  return {
    defense,
    requiredBreaker,
    breaksDefense: false,
    blocked: true,
    damageMultiplier: 0,
  };
}

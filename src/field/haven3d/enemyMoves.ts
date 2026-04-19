import type { FieldEnemy } from "../types";
import { getHaven3DEnemyDefense } from "./combatRules";

export type Haven3DEnemyAttackStyle = "slash" | "lunge" | "shot" | "shield_bash";

export interface Haven3DEnemyAttackProfile {
  style: Haven3DEnemyAttackStyle;
  triggerRange: number;
  reach: number;
  halfWidth: number;
  windupMs: number;
  recoveryMs: number;
  cooldownMs: number;
  damage: number;
  knockbackForce: number;
  lungeDistancePx?: number;
  lungeStartMs?: number;
  lungeEndMs?: number;
}

const ATTACK_PROFILES: Record<Haven3DEnemyAttackStyle, Haven3DEnemyAttackProfile> = {
  slash: {
    style: "slash",
    triggerRange: 92,
    reach: 116,
    halfWidth: 34,
    windupMs: 760,
    recoveryMs: 680,
    cooldownMs: 1280,
    damage: 18,
    knockbackForce: 520,
  },
  lunge: {
    style: "lunge",
    triggerRange: 154,
    reach: 142,
    halfWidth: 30,
    windupMs: 650,
    recoveryMs: 740,
    cooldownMs: 1480,
    damage: 20,
    knockbackForce: 560,
    lungeDistancePx: 58,
    lungeStartMs: 250,
    lungeEndMs: 540,
  },
  shot: {
    style: "shot",
    triggerRange: 360,
    reach: 440,
    halfWidth: 18,
    windupMs: 900,
    recoveryMs: 760,
    cooldownMs: 1760,
    damage: 16,
    knockbackForce: 380,
  },
  shield_bash: {
    style: "shield_bash",
    triggerRange: 116,
    reach: 104,
    halfWidth: 50,
    windupMs: 820,
    recoveryMs: 900,
    cooldownMs: 1700,
    damage: 24,
    knockbackForce: 760,
    lungeDistancePx: 30,
    lungeStartMs: 470,
    lungeEndMs: 720,
  },
};

export function normalizeHaven3DEnemyAttackStyle(
  value: unknown,
  fallback: Haven3DEnemyAttackStyle | null = null,
): Haven3DEnemyAttackStyle | null {
  return value === "slash" || value === "lunge" || value === "shot" || value === "shield_bash"
    ? value
    : fallback;
}

export function getHaven3DEnemyAttackProfile(
  enemy: Pick<FieldEnemy, "attackStyle" | "gearbladeDefense" | "kind" | "name" | "id">,
): Haven3DEnemyAttackProfile {
  const explicitStyle = normalizeHaven3DEnemyAttackStyle(enemy.attackStyle);
  if (explicitStyle) {
    return ATTACK_PROFILES[explicitStyle];
  }

  const descriptor = `${enemy.kind ?? ""} ${enemy.name ?? ""} ${enemy.id ?? ""}`.toLowerCase();
  if (getHaven3DEnemyDefense(enemy) === "shield" || /\b(bash|bulwark|shield|guard|warden)\b/.test(descriptor)) {
    return ATTACK_PROFILES.shield_bash;
  }
  if (/\b(shot|shooter|slinger|sniper|marksman|drone|sentry|ranged|caster)\b/.test(descriptor)) {
    return ATTACK_PROFILES.shot;
  }
  if (/\b(lunge|runner|scavenger|climber|stalker|skirmisher|hound)\b/.test(descriptor)) {
    return ATTACK_PROFILES.lunge;
  }

  return ATTACK_PROFILES.slash;
}

export function getHaven3DEnemyAttackLabel(style: Haven3DEnemyAttackStyle): string {
  switch (style) {
    case "lunge":
      return "HOSTILE LUNGE";
    case "shot":
      return "HOSTILE SHOT";
    case "shield_bash":
      return "SHIELD BASH";
    default:
      return "HOSTILE STRIKE";
  }
}

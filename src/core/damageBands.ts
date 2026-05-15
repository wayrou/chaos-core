import type { BattleUnitState } from "./battle";

export type DamageBand = "low" | "normal" | "high" | "massive";

export const DAMAGE_BAND_MULTIPLIERS: Record<DamageBand, number> = {
  low: 0.75,
  normal: 1,
  high: 1.35,
  massive: 1.75,
};

const FRIENDLY_DAMAGE_SCALE = 0.85;
const ENEMY_DAMAGE_SCALE = 1.2;
const FRIENDLY_MINIMUM_HIT_DAMAGE = 1;
const ENEMY_MINIMUM_HIT_DAMAGE = 2;

export function getDamageBandLabel(band: DamageBand): string {
  return band === "normal" ? "damage" : `${band} damage`;
}

export function inferDamageBandFromAmount(amount: number | null | undefined): DamageBand | null {
  const safeAmount = Number(amount ?? 0);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
    return null;
  }
  if (safeAmount <= 3) {
    return "low";
  }
  if (safeAmount === 4) {
    return "normal";
  }
  if (safeAmount === 5) {
    return "high";
  }
  return "massive";
}

export function inferDamageBandFromText(text: string | null | undefined): DamageBand | null {
  const lower = (text ?? "").toLowerCase();
  if (lower.includes("massive damage")) {
    return "massive";
  }
  if (lower.includes("high damage") || lower.includes("heavy damage") || lower.includes("strong damage")) {
    return "high";
  }
  if (lower.includes("low damage") || lower.includes("light damage")) {
    return "low";
  }
  if (/\bdeal(?:s)?\s+damage\b/.test(lower) || /\bstandard attack\b/.test(lower) || /\bweapon damage\b/.test(lower)) {
    return "normal";
  }
  return null;
}

export function resolveDamageBand(
  explicitBand: DamageBand | null | undefined,
  fallbackAmount: number | null | undefined,
  text?: string | null,
): DamageBand | null {
  return explicitBand ?? inferDamageBandFromAmount(fallbackAmount) ?? inferDamageBandFromText(text);
}

export function getEffectiveAttackStat(unit: BattleUnitState): number {
  const buffDelta = (unit.buffs || [])
    .filter((buff) => buff.type === "atk_up" || buff.type === "atk_down")
    .reduce((sum, buff) => sum + buff.amount, 0);
  return Math.max(1, (unit.atk ?? 1) + buffDelta);
}

export function calculateDamageBandAmount(unit: BattleUnitState, band: DamageBand): number {
  return Math.max(1, Math.round(getEffectiveAttackStat(unit) * DAMAGE_BAND_MULTIPLIERS[band]));
}

export function scalePreMitigationDamage(amount: number, attacker: BattleUnitState): number {
  const scale = attacker.isEnemy ? ENEMY_DAMAGE_SCALE : FRIENDLY_DAMAGE_SCALE;
  return Math.max(0, Math.round(amount * scale));
}

export function getMinimumHitDamage(attacker: BattleUnitState): number {
  return attacker.isEnemy ? ENEMY_MINIMUM_HIT_DAMAGE : FRIENDLY_MINIMUM_HIT_DAMAGE;
}

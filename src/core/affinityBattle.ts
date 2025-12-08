// ============================================================================
// AFFINITY BATTLE INTEGRATION - Headline 14a
// ============================================================================
// Hooks affinity tracking into battle actions
// ============================================================================

import { UnitId, BattleState, BattleUnitState } from "./types";
import {
  recordMeleeAttack,
  recordRangedSkill,
  recordMagicSpell,
  recordSupportAction,
  recordMobilityAction,
  recordSurvival,
} from "./affinity";
import { getGameState, updateGameState } from "../state/gameStore";

/**
 * Track affinity for a melee attack
 */
export function trackMeleeAttackInBattle(attackerId: UnitId, battle: BattleState): void {
  const attacker = battle.units[attackerId];
  if (!attacker || attacker.isEnemy) return;

  const baseUnitId = attacker.baseUnitId || attackerId;
  updateGameState((state) => {
    recordMeleeAttack(baseUnitId, state);
    return state;
  });
}

/**
 * Track affinity for a ranged skill
 */
export function trackRangedSkillInBattle(unitId: UnitId, battle: BattleState): void {
  const unit = battle.units[unitId];
  if (!unit || unit.isEnemy) return;

  const baseUnitId = unit.baseUnitId || unitId;
  updateGameState((state) => {
    recordRangedSkill(baseUnitId, state);
    return state;
  });
}

/**
 * Track affinity for a magic spell
 */
export function trackMagicSpellInBattle(unitId: UnitId, battle: BattleState): void {
  const unit = battle.units[unitId];
  if (!unit || unit.isEnemy) return;

  const baseUnitId = unit.baseUnitId || unitId;
  updateGameState((state) => {
    recordMagicSpell(baseUnitId, state);
    return state;
  });
}

/**
 * Track affinity for a support action
 */
export function trackSupportActionInBattle(unitId: UnitId, battle: BattleState): void {
  const unit = battle.units[unitId];
  if (!unit || unit.isEnemy) return;

  const baseUnitId = unit.baseUnitId || unitId;
  updateGameState((state) => {
    recordSupportAction(baseUnitId, state);
    return state;
  });
}

/**
 * Track affinity for a mobility action
 */
export function trackMobilityActionInBattle(unitId: UnitId, battle: BattleState): void {
  const unit = battle.units[unitId];
  if (!unit || unit.isEnemy) return;

  const baseUnitId = unit.baseUnitId || unitId;
  updateGameState((state) => {
    recordMobilityAction(baseUnitId, state);
    return state;
  });
}

/**
 * Track survival for all player units at battle end
 */
export function trackBattleSurvival(battle: BattleState, victory: boolean): void {
  if (!victory) return; // Only track survival on victory

  const playerUnits = Object.values(battle.units).filter((u) => !u.isEnemy);

  updateGameState((state) => {
    for (const battleUnit of playerUnits) {
      const baseUnitId = battleUnit.baseUnitId || battleUnit.id;
      const baseUnit = state.unitsById[baseUnitId];
      if (!baseUnit) continue;

      // Calculate damage taken (estimate from HP difference)
      const maxHp = battleUnit.maxHp;
      const currentHp = battleUnit.hp;
      const damageTaken = Math.max(0, maxHp - currentHp);

      recordSurvival(baseUnitId, damageTaken, true, state);
    }
    return state;
  });
}

/**
 * Detect card type and track appropriate affinity
 * This is a helper to determine if a card is melee/ranged/magic/support/mobility
 */
export function detectCardAffinityType(
  cardName: string,
  cardDescription: string
): "melee" | "ranged" | "magic" | "support" | "mobility" | null {
  const nameLower = cardName.toLowerCase();
  const descLower = cardDescription.toLowerCase();

  // Support detection
  if (
    descLower.includes("heal") ||
    descLower.includes("buff") ||
    descLower.includes("shield") ||
    descLower.includes("boost") ||
    descLower.includes("restore")
  ) {
    return "support";
  }

  // Mobility detection
  if (
    descLower.includes("move") ||
    descLower.includes("dash") ||
    descLower.includes("teleport") ||
    descLower.includes("jump") ||
    nameLower.includes("move")
  ) {
    return "mobility";
  }

  // Magic detection
  if (
    descLower.includes("spell") ||
    descLower.includes("magic") ||
    descLower.includes("arcane") ||
    descLower.includes("chaos") ||
    descLower.includes("bolt") ||
    descLower.includes("fire") ||
    descLower.includes("ice") ||
    nameLower.includes("spell") ||
    nameLower.includes("magic")
  ) {
    return "magic";
  }

  // Ranged detection
  if (
    descLower.includes("shot") ||
    descLower.includes("arrow") ||
    descLower.includes("bow") ||
    descLower.includes("range") ||
    nameLower.includes("shot") ||
    nameLower.includes("arrow")
  ) {
    return "ranged";
  }

  // Melee detection (default for damage cards)
  if (descLower.includes("damage") || descLower.includes("attack") || descLower.includes("strike")) {
    return "melee";
  }

  return null;
}



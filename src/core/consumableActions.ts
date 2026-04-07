import { appendBattleLog, type BattleState, type BattleUnitState } from "./battle";
import { CONSUMABLE_DATABASE, type ConsumableItem } from "./crafting";
import type { GameState, TheaterNetworkState, UnitId } from "./types";
import { fieldPatch } from "./weaponSystem";

export type OwnedConsumableEntry = {
  id: string;
  quantity: number;
  definition: ConsumableItem;
};

export type BattleConsumableOutcome = {
  battle: BattleState;
  consumables: Record<string, number>;
  success: boolean;
  message: string;
  targetId: string | null;
  healedAmount: number;
};

function cloneConsumables(consumables: Record<string, number> | null | undefined): Record<string, number> {
  return { ...(consumables ?? {}) };
}

function spendConsumable(consumables: Record<string, number>, consumableId: string): Record<string, number> {
  const next = cloneConsumables(consumables);
  const current = next[consumableId] ?? 0;
  if (current <= 1) {
    delete next[consumableId];
  } else {
    next[consumableId] = current - 1;
  }
  return next;
}

function getCurrentWeaponHeat(unit: BattleUnitState): number {
  return unit.weaponState?.currentHeat ?? unit.weaponHeat ?? 0;
}

function buildConsumableItemMessage(
  consumable: ConsumableItem,
  unitName: string,
  suffix: string,
): string {
  return `${consumable.name} // ${unitName} ${suffix}`;
}

export function getOwnedConsumableEntries(consumables: Record<string, number> | null | undefined): OwnedConsumableEntry[] {
  return Object.entries(consumables ?? {})
    .map(([id, quantity]) => ({
      id,
      quantity,
      definition: CONSUMABLE_DATABASE[id],
    }))
    .filter((entry): entry is OwnedConsumableEntry => Boolean(entry.definition) && entry.quantity > 0)
    .sort((left, right) => left.definition.name.localeCompare(right.definition.name));
}

export function getBattleConsumableTargetIds(battle: BattleState, consumableId: string): UnitId[] {
  const consumable = CONSUMABLE_DATABASE[consumableId];
  if (!consumable) {
    return [];
  }

  return Object.values(battle.units)
    .filter((unit) => {
      if (unit.hp <= 0) {
        return false;
      }
      switch (consumable.effect) {
        case "accuracy_debuff":
          return unit.isEnemy;
        case "heal":
        case "heat_reduce":
        case "attack_boost":
        case "repair":
          return !unit.isEnemy;
        default:
          return false;
      }
    })
    .map((unit) => unit.id);
}

export function isConsumableUsableInTheater(consumableId: string): boolean {
  const consumable = CONSUMABLE_DATABASE[consumableId];
  if (!consumable) {
    return false;
  }
  return consumable.effect === "heal" || consumable.effect === "attack_boost";
}

export function getTheaterConsumableTargetIds(
  state: GameState,
  theater: TheaterNetworkState,
  consumableId: string,
): UnitId[] {
  if (!isConsumableUsableInTheater(consumableId)) {
    return [];
  }

  const seen = new Set<UnitId>();
  theater.squads.forEach((squad) => {
    squad.unitIds.forEach((unitId) => {
      const unit = state.unitsById[unitId];
      if (!unit || unit.isEnemy || unit.hp <= 0 || seen.has(unitId)) {
        return;
      }
      seen.add(unitId);
    });
  });

  return [...seen];
}

export function applyBattleConsumable(
  battle: BattleState,
  consumables: Record<string, number> | null | undefined,
  consumableId: string,
  targetId: UnitId,
): BattleConsumableOutcome {
  const quantity = consumables?.[consumableId] ?? 0;
  const consumable = CONSUMABLE_DATABASE[consumableId];
  const target = battle.units[targetId];

  if (!consumable || quantity <= 0) {
    return {
      battle,
      consumables: cloneConsumables(consumables),
      success: false,
      message: "That consumable is not available.",
      targetId: null,
      healedAmount: 0,
    };
  }

  if (!target || target.hp <= 0) {
    return {
      battle,
      consumables: cloneConsumables(consumables),
      success: false,
      message: "That target is unavailable.",
      targetId: null,
      healedAmount: 0,
    };
  }

  let updatedTarget: BattleUnitState = target;
  let healedAmount = 0;
  let message = "";
  let logMessage = "";

  switch (consumable.effect) {
    case "heal": {
      if (target.isEnemy) {
        return {
          battle,
          consumables: cloneConsumables(consumables),
          success: false,
          message: "Healing consumables can only target allies.",
          targetId: null,
          healedAmount: 0,
        };
      }
      const nextHp = Math.min(target.maxHp, target.hp + consumable.value);
      healedAmount = nextHp - target.hp;
      if (healedAmount <= 0) {
        return {
          battle,
          consumables: cloneConsumables(consumables),
          success: false,
          message: `${target.name} is already at full integrity.`,
          targetId: null,
          healedAmount: 0,
        };
      }
      updatedTarget = {
        ...target,
        hp: nextHp,
      };
      message = buildConsumableItemMessage(consumable, target.name, `recovers ${healedAmount} HP.`);
      logMessage = `SLK//ITEM   :: ${target.name} restores ${healedAmount} HP via ${consumable.name.toUpperCase()}.`;
      break;
    }
    case "heat_reduce": {
      if (target.isEnemy) {
        return {
          battle,
          consumables: cloneConsumables(consumables),
          success: false,
          message: "Cooling items can only target allies.",
          targetId: null,
          healedAmount: 0,
        };
      }
      const currentHeat = getCurrentWeaponHeat(target);
      if (currentHeat <= 0) {
        return {
          battle,
          consumables: cloneConsumables(consumables),
          success: false,
          message: `${target.name}'s weapon is already cool.`,
          targetId: null,
          healedAmount: 0,
        };
      }
      const nextHeat = Math.max(0, currentHeat - consumable.value);
      updatedTarget = {
        ...target,
        weaponState: target.weaponState
          ? {
              ...target.weaponState,
              currentHeat: nextHeat,
            }
          : target.weaponState,
        weaponHeat: nextHeat,
      };
      message = buildConsumableItemMessage(consumable, target.name, `cools weapon heat ${currentHeat} -> ${nextHeat}.`);
      logMessage = `SLK//ITEM   :: ${target.name} vents ${consumable.name.toUpperCase()} heat (${currentHeat} -> ${nextHeat}).`;
      break;
    }
    case "attack_boost": {
      if (target.isEnemy) {
        return {
          battle,
          consumables: cloneConsumables(consumables),
          success: false,
          message: "Overcharge cells can only target allies.",
          targetId: null,
          healedAmount: 0,
        };
      }
      const currentHeat = getCurrentWeaponHeat(target);
      const nextHeat = currentHeat + 3;
      updatedTarget = {
        ...target,
        buffs: [
          ...(target.buffs ?? []),
          {
            id: `consumable_atk_up_${Date.now()}`,
            type: "atk_up",
            amount: consumable.value,
            duration: 1,
          },
        ],
        weaponState: target.weaponState
          ? {
              ...target.weaponState,
              currentHeat: nextHeat,
            }
          : target.weaponState,
        weaponHeat: nextHeat,
      };
      message = buildConsumableItemMessage(consumable, target.name, `gains +${consumable.value} ATK.`);
      logMessage = `SLK//ITEM   :: ${target.name} primes ${consumable.name.toUpperCase()} (+${consumable.value} ATK, HEAT ${currentHeat} -> ${nextHeat}).`;
      break;
    }
    case "accuracy_debuff": {
      if (!target.isEnemy) {
        return {
          battle,
          consumables: cloneConsumables(consumables),
          success: false,
          message: "Smoke bombs must target hostiles.",
          targetId: null,
          healedAmount: 0,
        };
      }
      updatedTarget = {
        ...target,
        buffs: [
          ...(target.buffs ?? []),
          {
            id: `consumable_acc_down_${Date.now()}`,
            type: "acc_down",
            amount: -20,
            duration: Math.max(1, consumable.value),
          },
        ],
      };
      message = buildConsumableItemMessage(consumable, target.name, `accuracy is obscured.`);
      logMessage = `SLK//ITEM   :: ${target.name} loses targeting clarity under ${consumable.name.toUpperCase()}.`;
      break;
    }
    case "repair": {
      if (target.isEnemy) {
        return {
          battle,
          consumables: cloneConsumables(consumables),
          success: false,
          message: "Repair kits can only target allies.",
          targetId: null,
          healedAmount: 0,
        };
      }
      const currentHeat = getCurrentWeaponHeat(target);
      const reducedHeat = Math.max(0, currentHeat - 3);
      let repairedNodeCount = 0;
      let nextWeaponState = target.weaponState;
      if (nextWeaponState) {
        for (let index = 0; index < consumable.value; index += 1) {
          const patched = fieldPatch(nextWeaponState);
          nextWeaponState = patched.state;
          if (patched.repairedNodeId !== null) {
            repairedNodeCount += 1;
          }
        }
        nextWeaponState = {
          ...nextWeaponState,
          currentHeat: reducedHeat,
        };
      }
      if (repairedNodeCount <= 0 && reducedHeat === currentHeat) {
        return {
          battle,
          consumables: cloneConsumables(consumables),
          success: false,
          message: `${target.name}'s weapon does not need servicing.`,
          targetId: null,
          healedAmount: 0,
        };
      }
      updatedTarget = {
        ...target,
        weaponState: nextWeaponState,
        weaponHeat: reducedHeat,
      };
      message = buildConsumableItemMessage(
        consumable,
        target.name,
        `repairs ${repairedNodeCount} node${repairedNodeCount === 1 ? "" : "s"} and cools heat.`,
      );
      logMessage = `SLK//ITEM   :: ${target.name} applies ${consumable.name.toUpperCase()} (${repairedNodeCount} node${repairedNodeCount === 1 ? "" : "s"} repaired, HEAT ${currentHeat} -> ${reducedHeat}).`;
      break;
    }
    default:
      return {
        battle,
        consumables: cloneConsumables(consumables),
        success: false,
        message: "That consumable effect is not supported yet.",
        targetId: null,
        healedAmount: 0,
      };
  }

  const nextBattle = appendBattleLog(
    {
      ...battle,
      units: {
        ...battle.units,
        [target.id]: updatedTarget,
      },
    },
    logMessage,
  );

  return {
    battle: nextBattle,
    consumables: spendConsumable(cloneConsumables(consumables), consumableId),
    success: true,
    message,
    targetId: target.id,
    healedAmount,
  };
}

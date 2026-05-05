// ============================================================================
// TAVERN MEALS - Queued next-deployment buffs purchased in the tavern
// ============================================================================

import { GameState } from "./types";
import { canSessionAffordCost, spendSessionCost } from "./session";
import { recoverShakenFromTavernMeal } from "./operationStatuses";

export type TavernMealEffect = "hp" | "atk" | "def" | "agi";

export interface TavernMealBuff {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: TavernMealEffect;
  amount: number;
  icon: string;
}

export interface TavernMealBuffTarget {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  agi: number;
}

export const TAVERN_MEAL_DEFINITIONS: TavernMealBuff[] = [
  {
    id: "meal_iron_stew",
    name: "Iron Stew",
    description: "+6 max HP in every battle next deployment.",
    cost: 30,
    effect: "hp",
    amount: 6,
    icon: "STW",
  },
  {
    id: "meal_charred_skewers",
    name: "Charred Skewers",
    description: "+1 ATK in every battle next deployment.",
    cost: 35,
    effect: "atk",
    amount: 1,
    icon: "ATK",
  },
  {
    id: "meal_guardhouse_broth",
    name: "Guardhouse Broth",
    description: "+1 DEF in every battle next deployment.",
    cost: 35,
    effect: "def",
    amount: 1,
    icon: "DEF",
  },
  {
    id: "meal_scouts_rations",
    name: "Scout's Rations",
    description: "+1 AGI in every battle next deployment.",
    cost: 40,
    effect: "agi",
    amount: 1,
    icon: "AGI",
  },
];

export function getTavernMealDefinition(mealId: string): TavernMealBuff | null {
  return TAVERN_MEAL_DEFINITIONS.find((meal) => meal.id === mealId) ?? null;
}

export function getQueuedTavernMealBuff(state: GameState): TavernMealBuff | null {
  return state.tavern?.queuedMealBuff ?? null;
}

export function getActiveRunTavernMealBuff(state: GameState): TavernMealBuff | null {
  return state.tavern?.activeRunMealBuff ?? null;
}

export function getTavernMealBuffSummary(meal: TavernMealBuff | null | undefined): string | null {
  if (!meal) {
    return null;
  }
  switch (meal.effect) {
    case "hp":
      return `+${meal.amount} max HP / +${meal.amount} HP`;
    case "atk":
      return `+${meal.amount} ATK`;
    case "def":
      return `+${meal.amount} DEF`;
    case "agi":
      return `+${meal.amount} AGI`;
    default:
      return null;
  }
}

export function applyTavernMealBuffToTarget<T extends TavernMealBuffTarget>(
  target: T,
  meal: TavernMealBuff | null | undefined,
): T {
  if (!meal) {
    return target;
  }

  switch (meal.effect) {
    case "hp":
      target.maxHp += meal.amount;
      target.hp += meal.amount;
      break;
    case "atk":
      target.atk += meal.amount;
      break;
    case "def":
      target.def += meal.amount;
      break;
    case "agi":
      target.agi += meal.amount;
      break;
  }

  return target;
}

export function canQueueTavernMeal(state: GameState): boolean {
  return !getQueuedTavernMealBuff(state);
}

export function queueTavernMeal(
  state: GameState,
  mealId: string,
): { next: GameState; meal: TavernMealBuff; recoveredShakenUnitIds: string[] } | { error: string } {
  const meal = getTavernMealDefinition(mealId);
  if (!meal) {
    return { error: `Unknown meal: ${mealId}` };
  }

  if (getQueuedTavernMealBuff(state)) {
    return { error: "A tavern meal is already queued for your next deployment." };
  }

  const spendPool = canSessionAffordCost(state, { wad: meal.cost });
  if (!spendPool) {
    return { error: `Insufficient WAD. Need ${meal.cost}.` };
  }

  const spendResult = spendSessionCost(state, { wad: meal.cost });
  if (!spendResult.success) {
    return { error: `Insufficient WAD. Need ${meal.cost}.` };
  }

  const recovered = recoverShakenFromTavernMeal(spendResult.state);

  return {
    meal,
    recoveredShakenUnitIds: recovered.clearedUnitIds,
    next: {
      ...recovered.next,
      tavern: {
        ...(recovered.next.tavern ?? {}),
        queuedMealBuff: meal,
      },
    },
  };
}

export function activateQueuedTavernMealForRun(state: GameState): GameState {
  const queuedMeal = getQueuedTavernMealBuff(state);
  return {
    ...state,
    tavern: {
      ...(state.tavern ?? {}),
      queuedMealBuff: null,
      activeRunMealBuff: queuedMeal,
    },
  };
}

export function clearActiveRunTavernMeal(state: GameState): GameState {
  if (!state.tavern?.activeRunMealBuff) {
    return state;
  }

  return {
    ...state,
    tavern: {
      ...(state.tavern ?? {}),
      activeRunMealBuff: null,
    },
  };
}

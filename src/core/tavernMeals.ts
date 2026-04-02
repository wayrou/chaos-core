// ============================================================================
// TAVERN MEALS - Queued next-run buffs purchased in the tavern
// ============================================================================

import { GameState } from "./types";

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

export const TAVERN_MEAL_DEFINITIONS: TavernMealBuff[] = [
  {
    id: "meal_iron_stew",
    name: "Iron Stew",
    description: "+6 max HP in every battle next run.",
    cost: 30,
    effect: "hp",
    amount: 6,
    icon: "STW",
  },
  {
    id: "meal_charred_skewers",
    name: "Charred Skewers",
    description: "+1 ATK in every battle next run.",
    cost: 35,
    effect: "atk",
    amount: 1,
    icon: "ATK",
  },
  {
    id: "meal_guardhouse_broth",
    name: "Guardhouse Broth",
    description: "+1 DEF in every battle next run.",
    cost: 35,
    effect: "def",
    amount: 1,
    icon: "DEF",
  },
  {
    id: "meal_scouts_rations",
    name: "Scout's Rations",
    description: "+1 AGI in every battle next run.",
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

export function canQueueTavernMeal(state: GameState): boolean {
  return !getQueuedTavernMealBuff(state);
}

export function queueTavernMeal(
  state: GameState,
  mealId: string,
): { next: GameState; meal: TavernMealBuff } | { error: string } {
  const meal = getTavernMealDefinition(mealId);
  if (!meal) {
    return { error: `Unknown meal: ${mealId}` };
  }

  if (getQueuedTavernMealBuff(state)) {
    return { error: "A tavern meal is already queued for your next run." };
  }

  const currentWad = state.wad ?? 0;
  if (currentWad < meal.cost) {
    return { error: `Insufficient WAD. Need ${meal.cost}, have ${currentWad}.` };
  }

  return {
    meal,
    next: {
      ...state,
      wad: currentWad - meal.cost,
      tavern: {
        ...(state.tavern ?? {}),
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

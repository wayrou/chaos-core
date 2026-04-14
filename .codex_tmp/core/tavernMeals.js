// ============================================================================
// TAVERN MEALS - Queued next-deployment buffs purchased in the tavern
// ============================================================================
import { canSessionAffordCost, spendSessionCost } from "./session";
import { recoverShakenFromTavernMeal } from "./operationStatuses";
export const TAVERN_MEAL_DEFINITIONS = [
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
export function getTavernMealDefinition(mealId) {
    return TAVERN_MEAL_DEFINITIONS.find((meal) => meal.id === mealId) ?? null;
}
export function getQueuedTavernMealBuff(state) {
    return state.tavern?.queuedMealBuff ?? null;
}
export function getActiveRunTavernMealBuff(state) {
    return state.tavern?.activeRunMealBuff ?? null;
}
export function canQueueTavernMeal(state) {
    return !getQueuedTavernMealBuff(state);
}
export function queueTavernMeal(state, mealId) {
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
export function activateQueuedTavernMealForRun(state) {
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
export function clearActiveRunTavernMeal(state) {
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

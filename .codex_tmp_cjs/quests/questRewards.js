"use strict";
// ============================================================================
// QUEST SYSTEM - REWARD PAYOUT
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyQuestRewardsToState = applyQuestRewardsToState;
exports.grantQuestRewards = grantQuestRewards;
const gameStore_1 = require("../state/gameStore");
const gearWorkbench_1 = require("../core/gearWorkbench");
const crafting_1 = require("../core/crafting");
const gearRewards_1 = require("../core/gearRewards");
const keyItems_1 = require("../core/keyItems");
const session_1 = require("../core/session");
function applyQuestRewardsToState(state, quest) {
    const rewards = quest.rewards;
    let nextState = { ...state };
    if (rewards.wad || rewards.resources) {
        nextState = (0, session_1.grantSessionResources)(nextState, {
            wad: rewards.wad,
            resources: rewards.resources,
        });
    }
    if (rewards.items) {
        const updatedConsumables = { ...nextState.consumables };
        for (const item of rewards.items) {
            if ((0, keyItems_1.isRegisteredKeyItem)(item.id)) {
                nextState = (0, keyItems_1.grantKeyItemToState)(nextState, item.id, item.quantity);
                continue;
            }
            updatedConsumables[item.id] = (updatedConsumables[item.id] || 0) + item.quantity;
        }
        nextState = {
            ...nextState,
            consumables: updatedConsumables,
        };
    }
    if (rewards.cards && rewards.cards.length > 0) {
        nextState = {
            ...nextState,
            cardLibrary: (0, gearWorkbench_1.addCardsToLibrary)(nextState.cardLibrary || {}, rewards.cards),
        };
    }
    if (rewards.recipes && rewards.recipes.length > 0) {
        let updatedRecipeIds = [...(nextState.knownRecipeIds || [])];
        for (const recipeId of rewards.recipes) {
            updatedRecipeIds = (0, crafting_1.learnRecipe)(updatedRecipeIds, recipeId);
        }
        nextState = {
            ...nextState,
            knownRecipeIds: updatedRecipeIds,
        };
    }
    if (rewards.xp) {
        const xpPerUnit = Math.floor(rewards.xp / Math.max(1, nextState.partyUnitIds.length));
        nextState.partyUnitIds.forEach((unitId) => {
            const unit = nextState.unitsById[unitId];
            if (unit) {
                console.log(`[QUEST] Would grant ${xpPerUnit} XP to ${unit.name}`);
            }
        });
    }
    const gearRewardSpecs = [
        ...(rewards.equipment ?? []),
        ...(rewards.gearRewards ?? []),
    ];
    if (gearRewardSpecs.length > 0) {
        nextState = (0, gearRewards_1.grantGearRewardSpecsToState)(nextState, gearRewardSpecs);
    }
    if (rewards.unitRecruit) {
        console.log(`[QUEST] Would recruit unit: ${rewards.unitRecruit}`);
    }
    return nextState;
}
/**
 * Grant all rewards for a completed quest
 */
function grantQuestRewards(quest) {
    const rewards = quest.rewards;
    const state = (0, gameStore_1.getGameState)();
    console.log(`[QUEST] Granting rewards for quest: ${quest.title}`, rewards);
    if (rewards.wad || rewards.resources) {
        (0, gameStore_1.updateGameState)((s) => (0, session_1.grantSessionResources)(s, {
            wad: rewards.wad,
            resources: rewards.resources,
        }));
    }
    // Grant XP to party units
    if (rewards.xp) {
        const xpPerUnit = Math.floor(rewards.xp / state.partyUnitIds.length);
        (0, gameStore_1.updateGameState)(s => {
            const updatedUnits = { ...s.unitsById };
            for (const unitId of s.partyUnitIds) {
                const unit = updatedUnits[unitId];
                if (unit) {
                    // TODO: Integrate with unit XP system when available
                    // For now, just log it
                    console.log(`[QUEST] Would grant ${xpPerUnit} XP to ${unit.name}`);
                }
            }
            return { ...s, unitsById: updatedUnits };
        });
    }
    // Grant items (equipment, consumables, etc.)
    if (rewards.items) {
        (0, gameStore_1.updateGameState)((s) => applyQuestRewardsToState(s, {
            ...quest,
            rewards: {
                items: rewards.items,
            },
        }));
    }
    // Grant cards
    if (rewards.cards && rewards.cards.length > 0) {
        (0, gameStore_1.updateGameState)(s => ({
            ...s,
            cardLibrary: (0, gearWorkbench_1.addCardsToLibrary)(s.cardLibrary || {}, rewards.cards),
        }));
    }
    // Grant equipment
    const gearRewardSpecs = [
        ...(rewards.equipment ?? []),
        ...(rewards.gearRewards ?? []),
    ];
    if (gearRewardSpecs.length > 0) {
        (0, gameStore_1.updateGameState)((s) => applyQuestRewardsToState(s, {
            ...quest,
            rewards: {
                equipment: rewards.equipment,
                gearRewards: rewards.gearRewards,
            },
        }));
    }
    // Grant recipes
    if (rewards.recipes && rewards.recipes.length > 0) {
        (0, gameStore_1.updateGameState)((s) => applyQuestRewardsToState(s, {
            ...quest,
            rewards: {
                recipes: rewards.recipes,
            },
        }));
        console.log(`[QUEST] Learned recipes: ${rewards.recipes.join(", ")}`);
    }
    // Grant unit recruitment
    if (rewards.unitRecruit) {
        // TODO: Integrate with unit recruitment system
        console.log(`[QUEST] Would recruit unit: ${rewards.unitRecruit}`);
    }
}

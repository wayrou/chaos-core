// ============================================================================
// QUEST SYSTEM - REWARD PAYOUT
// ============================================================================

import { Quest } from "./types";
import { updateGameState, getGameState } from "../state/gameStore";
import { addCardsToLibrary } from "../core/gearWorkbench";
import { learnRecipe } from "../core/crafting";
import { grantGearRewardSpecsToState, type GearRewardSpec } from "../core/gearRewards";
import { grantKeyItemToState, isRegisteredKeyItem } from "../core/keyItems";
import { grantSessionResources } from "../core/session";
import type { GameState } from "../core/types";

export function applyQuestRewardsToState(state: GameState, quest: Quest): GameState {
  const rewards = quest.rewards;
  let nextState: GameState = { ...state };

  if (rewards.wad || rewards.resources) {
    nextState = grantSessionResources(nextState, {
      wad: rewards.wad,
      resources: rewards.resources,
    });
  }

  if (rewards.items) {
    const updatedConsumables = { ...nextState.consumables };
    for (const item of rewards.items) {
      if (isRegisteredKeyItem(item.id)) {
        nextState = grantKeyItemToState(nextState, item.id, item.quantity);
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
      cardLibrary: addCardsToLibrary(nextState.cardLibrary || {}, rewards.cards),
    };
  }

  if (rewards.recipes && rewards.recipes.length > 0) {
    let updatedRecipeIds = [...(nextState.knownRecipeIds || [])];
    for (const recipeId of rewards.recipes) {
      updatedRecipeIds = learnRecipe(updatedRecipeIds, recipeId);
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

  const gearRewardSpecs: GearRewardSpec[] = [
    ...(rewards.equipment ?? []),
    ...(rewards.gearRewards ?? []),
  ];

  if (gearRewardSpecs.length > 0) {
    nextState = grantGearRewardSpecsToState(nextState, gearRewardSpecs);
  }

  if (rewards.unitRecruit) {
    console.log(`[QUEST] Would recruit unit: ${rewards.unitRecruit}`);
  }

  return nextState;
}

/**
 * Grant all rewards for a completed quest
 */
export function grantQuestRewards(quest: Quest): void {
  const rewards = quest.rewards;
  const state = getGameState();

  console.log(`[QUEST] Granting rewards for quest: ${quest.title}`, rewards);

  if (rewards.wad || rewards.resources) {
    updateGameState((s) => grantSessionResources(s, {
      wad: rewards.wad,
      resources: rewards.resources,
    }));
  }

  // Grant XP to party units
  if (rewards.xp) {
    const xpPerUnit = Math.floor(rewards.xp / state.partyUnitIds.length);
    updateGameState(s => {
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
    updateGameState((s) => applyQuestRewardsToState(s, {
      ...quest,
      rewards: {
        items: rewards.items,
      },
    }));
  }

  // Grant cards
  if (rewards.cards && rewards.cards.length > 0) {
    updateGameState(s => ({
      ...s,
      cardLibrary: addCardsToLibrary(s.cardLibrary || {}, rewards.cards!),
    }));
  }

  // Grant equipment
  const gearRewardSpecs: GearRewardSpec[] = [
    ...(rewards.equipment ?? []),
    ...(rewards.gearRewards ?? []),
  ];

  if (gearRewardSpecs.length > 0) {
    updateGameState((s) => applyQuestRewardsToState(s, {
      ...quest,
      rewards: {
        equipment: rewards.equipment,
        gearRewards: rewards.gearRewards,
      },
    }));
  }

  // Grant recipes
  if (rewards.recipes && rewards.recipes.length > 0) {
    updateGameState((s) => applyQuestRewardsToState(s, {
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




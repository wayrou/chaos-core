// ============================================================================
// QUEST SYSTEM - REWARD PAYOUT
// ============================================================================

import { Quest } from "./types";
import { updateGameState, getGameState } from "../state/gameStore";
import { addWad, addResources } from "../state/gameStore";
import { addCardsToLibrary } from "../core/gearWorkbench";

/**
 * Grant all rewards for a completed quest
 */
export function grantQuestRewards(quest: Quest): void {
  const rewards = quest.rewards;
  const state = getGameState();

  console.log(`[QUEST] Granting rewards for quest: ${quest.title}`, rewards);

  // Grant WAD
  if (rewards.wad) {
    addWad(rewards.wad);
  }

  // Grant resources
  if (rewards.resources) {
    addResources(rewards.resources);
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
    updateGameState(s => {
      const updatedConsumables = { ...s.consumables };
      for (const item of rewards.items!) {
        // For now, treat as consumables
        // TODO: Integrate with inventory system for equipment
        updatedConsumables[item.id] = (updatedConsumables[item.id] || 0) + item.quantity;
      }
      return { ...s, consumables: updatedConsumables };
    });
  }

  // Grant cards
  if (rewards.cards && rewards.cards.length > 0) {
    updateGameState(s => ({
      ...s,
      cardLibrary: addCardsToLibrary(s.cardLibrary || {}, rewards.cards!),
    }));
  }

  // Grant equipment
  if (rewards.equipment && rewards.equipment.length > 0) {
    // TODO: Integrate with equipment system
    console.log(`[QUEST] Would grant equipment: ${rewards.equipment.join(", ")}`);
  }

  // Grant recipes
  if (rewards.recipes && rewards.recipes.length > 0) {
    import("../core/crafting").then(({ learnRecipe }) => {
      updateGameState(s => {
        let updatedRecipeIds = s.knownRecipeIds || [];
        for (const recipeId of rewards.recipes!) {
          updatedRecipeIds = learnRecipe(updatedRecipeIds, recipeId);
        }
        return {
          ...s,
          knownRecipeIds: updatedRecipeIds,
        };
      });
      console.log(`[QUEST] Learned recipes: ${rewards.recipes.join(", ")}`);
    }).catch((err: any) => {
      console.warn("[QUEST] Could not grant recipe rewards:", err);
    });
  }

  // Grant unit recruitment
  if (rewards.unitRecruit) {
    // TODO: Integrate with unit recruitment system
    console.log(`[QUEST] Would recruit unit: ${rewards.unitRecruit}`);
  }
}




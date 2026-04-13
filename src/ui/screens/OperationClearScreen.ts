// ============================================================================
// OPERATION CLEAR SCREEN
// Shows operation completion summary and rewards
// ============================================================================

import { renderOperationSelectScreen } from "./OperationSelectScreen";
import { getActiveRun, completeOperationRun } from "../../core/campaignManager";
import { OPERATION_DEFINITIONS } from "../../core/campaign";
import { getGameState, updateGameState } from "../../state/gameStore";
import { createEmptyResourceWallet, getResourceEntries, type ResourceWallet } from "../../core/resources";
import { addCardsToLibrary, generateBattleRewardCards, getLibraryCard } from "../../core/gearWorkbench";
import {
  createOperationGearRewardSpecs,
  grantResolvedGearRewardToState,
  resolveGearRewardSpecs,
  type GrantedGearReward,
} from "../../core/gearRewards";
import { grantSessionResources } from "../../core/session";

interface OperationClearRewards {
  cards: Array<{ id: string; name: string; description: string }>;
  wad: number;
  resources: ResourceWallet;
  gearChoices: GrantedGearReward[];
}

export function renderOperationClearScreen(): void {
  const root = document.getElementById("app");
  if (!root) return;

  const activeRun = getActiveRun();
  if (!activeRun) {
    renderOperationSelectScreen();
    return;
  }

  const opDef = OPERATION_DEFINITIONS[activeRun.operationId];
  const stats = {
    battlesWon: activeRun.battlesWon,
    battlesLost: activeRun.battlesLost,
    retries: activeRun.retries,
    nodesCleared: activeRun.nodesCleared,
  };

  const rewards = generateOperationRewards(activeRun);

  root.innerHTML = `
    <div class="opclear-root">
      <div class="opclear-card">
        <div class="opclear-header">
          <div class="opclear-title">ðŸŽ‰ OPERATION CLEAR</div>
          <div class="opclear-subtitle">${opDef.name}</div>
        </div>

        <div class="opclear-body">
          <div class="opclear-summary">
            <div class="opclear-summary-title">OPERATION SUMMARY</div>
            <div class="opclear-summary-stats">
              <div class="opclear-stat">
                <span class="opclear-stat-label">Battles Won:</span>
                <span class="opclear-stat-value">${stats.battlesWon}</span>
              </div>
              <div class="opclear-stat">
                <span class="opclear-stat-label">Battles Lost:</span>
                <span class="opclear-stat-value">${stats.battlesLost}</span>
              </div>
              <div class="opclear-stat">
                <span class="opclear-stat-label">Retries:</span>
                <span class="opclear-stat-value">${stats.retries}</span>
              </div>
              <div class="opclear-stat">
                <span class="opclear-stat-label">Nodes Cleared:</span>
                <span class="opclear-stat-value">${stats.nodesCleared}</span>
              </div>
            </div>
          </div>

          <div class="opclear-rewards">
            <div class="opclear-rewards-title">REWARDS</div>

            <div class="opclear-reward-section">
              <div class="opclear-reward-label">Choose 1 Card:</div>
              <div class="opclear-card-choices" id="cardChoices">
                ${rewards.cards.map((card, index) => `
                  <div class="opclear-card-choice" data-card-id="${card.id}" data-index="${index}">
                    <div class="opclear-card-name">${card.name}</div>
                    <div class="opclear-card-desc">${card.description}</div>
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="opclear-reward-section">
              <div class="opclear-reward-label">Resource Bundle:</div>
              <div class="opclear-resources">
                <div class="opclear-resource-item">
                  <span class="opclear-resource-label">WAD:</span>
                  <span class="opclear-resource-value">+${rewards.wad}</span>
                </div>
                ${getResourceEntries(rewards.resources).map((entry) => `
                  <div class="opclear-resource-item">
                    <span class="opclear-resource-label">${entry.label}:</span>
                    <span class="opclear-resource-value">+${entry.amount}</span>
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="opclear-reward-section">
              <div class="opclear-reward-label">Choose 1 Gear Item:</div>
              <div class="opclear-gear-choices" id="gearChoices">
                ${rewards.gearChoices.map((gear, index) => `
                  <div class="opclear-gear-choice" data-gear-reward-id="${gear.rewardId}" data-index="${index}">
                    <div class="opclear-gear-name">${gear.name}</div>
                    <div class="opclear-gear-desc">${gear.description}</div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>

          <div class="opclear-actions">
            <button class="opclear-continue-btn" id="continueBtn" disabled>
              CONTINUE â†’
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  let selectedCardId: string | null = null;
  let selectedGearRewardId: string | null = null;

  document.querySelectorAll(".opclear-card-choice").forEach((choice) => {
    choice.addEventListener("click", () => {
      document.querySelectorAll(".opclear-card-choice").forEach((candidate) => candidate.classList.remove("selected"));
      choice.classList.add("selected");
      selectedCardId = choice.getAttribute("data-card-id");
      syncContinueEnabled();
    });
  });

  document.querySelectorAll(".opclear-gear-choice").forEach((choice) => {
    choice.addEventListener("click", () => {
      document.querySelectorAll(".opclear-gear-choice").forEach((candidate) => candidate.classList.remove("selected"));
      choice.classList.add("selected");
      selectedGearRewardId = choice.getAttribute("data-gear-reward-id");
      syncContinueEnabled();
    });
  });

  function syncContinueEnabled(): void {
    const continueBtn = document.getElementById("continueBtn") as HTMLButtonElement | null;
    if (continueBtn) {
      continueBtn.disabled = !(selectedCardId && selectedGearRewardId);
    }
  }

  const continueBtn = document.getElementById("continueBtn") as HTMLButtonElement | null;
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      if (!selectedCardId || !selectedGearRewardId) {
        return;
      }

      const resolvedSelectedCardId = selectedCardId;
      const resolvedSelectedGearRewardId = selectedGearRewardId;
      const selectedGearReward = rewards.gearChoices.find(
        (reward) => reward.rewardId === resolvedSelectedGearRewardId,
      ) ?? null;
      updateGameState((prev) => {
        let nextState = grantSessionResources(prev, {
          wad: rewards.wad,
          resources: rewards.resources,
        });

        nextState = {
          ...nextState,
          cardLibrary: addCardsToLibrary(nextState.cardLibrary || {}, [resolvedSelectedCardId]),
        };

        return selectedGearReward
          ? grantResolvedGearRewardToState(nextState, selectedGearReward)
          : nextState;
      });

      completeOperationRun();

      import("../../core/mailSystem").then(({ triggerMailOnOperationComplete }) => {
        triggerMailOnOperationComplete(true);
      });

      renderOperationSelectScreen();
    });
  }
}

function generateOperationRewards(activeRun: import("../../core/campaign").ActiveRunState): OperationClearRewards {
  const state = getGameState();
  const baseMultiplier = activeRun.difficulty === "hard" ? 1.5 : activeRun.difficulty === "easy" ? 0.75 : 1.0;
  const floorMultiplier = 1 + (activeRun.floorsTotal * 0.2);
  const rewardEnemyCount = Math.max(3, activeRun.battlesWon + activeRun.nodesCleared);
  const cardIds = Array.from(new Set(generateBattleRewardCards(rewardEnemyCount))).slice(0, 3);
  const fallbackCardIds = ["card_power_strike", "card_guard", "card_focus"];

  while (cardIds.length < 3) {
    const fallbackCardId = fallbackCardIds[cardIds.length] ?? "card_guard";
    if (!cardIds.includes(fallbackCardId)) {
      cardIds.push(fallbackCardId);
      continue;
    }
    break;
  }

  return {
    cards: cardIds.map((cardId) => {
      const card = getLibraryCard(cardId);
      return {
        id: cardId,
        name: card?.name ?? cardId,
        description: card?.description ?? "Recovered tactical program.",
      };
    }),
    wad: Math.floor(100 * baseMultiplier * floorMultiplier),
    resources: createEmptyResourceWallet({
      metalScrap: Math.floor(50 * baseMultiplier * floorMultiplier),
      wood: Math.floor(30 * baseMultiplier * floorMultiplier),
      chaosShards: Math.floor(20 * baseMultiplier * floorMultiplier),
      steamComponents: Math.floor(15 * baseMultiplier * floorMultiplier),
    }),
    gearChoices: resolveGearRewardSpecs(
      createOperationGearRewardSpecs(3, `${activeRun.operationId}_${activeRun.floorsTotal}`),
      state,
    ),
  };
}

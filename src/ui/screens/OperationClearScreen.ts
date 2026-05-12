// ============================================================================
// OPERATION CLEAR SCREEN
// Shows operation completion summary and routes the player back to Base Camp.
// ============================================================================

import { renderAllNodesMenuScreen } from "./AllNodesMenuScreen";
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
import { showSystemPing } from "../components/systemPing";

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
    renderAllNodesMenuScreen();
    return;
  }

  const opDef = OPERATION_DEFINITIONS[activeRun.operationId];
  const state = getGameState();
  const stats = {
    battlesWon: activeRun.battlesWon,
    battlesLost: activeRun.battlesLost,
    retries: activeRun.retries,
    nodesCleared: activeRun.nodesCleared,
  };
  const rewards = generateOperationRewards(activeRun);
  const projectedTotals = {
    wad: state.wad + rewards.wad,
    resources: createEmptyResourceWallet({
      metalScrap: state.resources.metalScrap + rewards.resources.metalScrap,
      wood: state.resources.wood + rewards.resources.wood,
      chaosShards: state.resources.chaosShards + rewards.resources.chaosShards,
      steamComponents: state.resources.steamComponents + rewards.resources.steamComponents,
    }),
  };
  const operationName = opDef?.name ?? activeRun.operationId;
  const floorLabel = `${activeRun.floorsTotal} floor${activeRun.floorsTotal === 1 ? "" : "s"}`;
  const selectableCardCount = rewards.cards.length;
  const selectableGearCount = rewards.gearChoices.length;

  root.innerHTML = `
    <div class="opclear-root">
      <div class="opclear-card">
        <div class="opclear-header">
          <div class="opclear-kicker">SCROLLLINK // OPERATION DEBRIEF</div>
          <div class="opclear-title">OPERATION CLEAR</div>
          <div class="opclear-subtitle">${escapeOperationClearText(operationName)} secured. Rewards are ready for Base Camp transfer.</div>
        </div>

        <div class="opclear-body">
          <section class="opclear-summary">
            <div class="opclear-summary-title">Operation Summary</div>
            <div class="opclear-summary-stats">
              ${renderSummaryStat("Battles Won", String(stats.battlesWon))}
              ${renderSummaryStat("Battles Lost", String(stats.battlesLost))}
              ${renderSummaryStat("Retries", String(stats.retries))}
              ${renderSummaryStat("Nodes Cleared", String(stats.nodesCleared))}
              ${renderSummaryStat("Route", floorLabel)}
            </div>
          </section>

          <section class="opclear-rewards">
            <div class="opclear-rewards-title">Base Camp Transfer</div>

            <div class="opclear-reward-section">
              <div class="opclear-reward-label">Choose 1 Card</div>
              <div class="opclear-card-choices" id="cardChoices">
                ${rewards.cards.map((card, index) => `
                  <button class="opclear-card-choice" type="button" data-card-id="${card.id}" data-index="${index}">
                    <span class="opclear-card-name">${escapeOperationClearText(card.name)}</span>
                    <span class="opclear-card-desc">${escapeOperationClearText(card.description)}</span>
                  </button>
                `).join("")}
              </div>
            </div>

            <div class="opclear-reward-section">
              <div class="opclear-reward-label">Resource Bundle</div>
              <div class="opclear-resources">
                <div class="opclear-resource-item">
                  <span class="opclear-resource-label">WAD</span>
                  <span class="opclear-resource-value">+${rewards.wad}</span>
                  <span class="opclear-resource-total">${projectedTotals.wad} total</span>
                </div>
                ${getResourceEntries(rewards.resources).map((entry) => `
                  <div class="opclear-resource-item">
                    <span class="opclear-resource-label">${escapeOperationClearText(entry.label)}</span>
                    <span class="opclear-resource-value">+${entry.amount}</span>
                    <span class="opclear-resource-total">${projectedTotals.resources[entry.key]} total</span>
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="opclear-reward-section">
              <div class="opclear-reward-label">Choose 1 Gear Item</div>
              <div class="opclear-gear-choices" id="gearChoices">
                ${rewards.gearChoices.map((gear, index) => `
                  <button class="opclear-gear-choice" type="button" data-gear-reward-id="${gear.rewardId}" data-index="${index}">
                    <span class="opclear-gear-name">${escapeOperationClearText(gear.name)}</span>
                    <span class="opclear-gear-desc">${escapeOperationClearText(gear.description)}</span>
                  </button>
                `).join("")}
              </div>
            </div>

            <div class="opclear-next-actions">
              <div class="opclear-next-title">Recommended Base Camp follow-up</div>
              <div class="opclear-next-grid">
                ${renderNextAction("Workshop", "Tune the new gear before the next deployment.")}
                ${renderNextAction("Loadout", "Check mass, bulk, power, and deck changes.")}
                ${renderNextAction("Roster", "Review injured units and new card options.")}
              </div>
            </div>
          </section>

          <div class="opclear-actions">
            <button class="opclear-continue-btn" id="continueBtn" disabled>
              TRANSFER TO BASE CAMP
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
      continueBtn.disabled = !(
        (selectableCardCount <= 0 || selectedCardId)
        && (selectableGearCount <= 0 || selectedGearRewardId)
      );
    }
  }

  const continueBtn = document.getElementById("continueBtn") as HTMLButtonElement | null;
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      if ((selectableCardCount > 0 && !selectedCardId) || (selectableGearCount > 0 && !selectedGearRewardId)) {
        return;
      }

      const selectedGearReward = rewards.gearChoices.find(
        (reward) => reward.rewardId === selectedGearRewardId,
      ) ?? null;

      updateGameState((prev) => {
        let nextState = grantSessionResources(prev, {
          wad: rewards.wad,
          resources: rewards.resources,
        });

        nextState = {
          ...nextState,
          cardLibrary: selectedCardId
            ? addCardsToLibrary(nextState.cardLibrary || {}, [selectedCardId])
            : nextState.cardLibrary,
        };

        return selectedGearReward
          ? grantResolvedGearRewardToState(nextState, selectedGearReward)
          : nextState;
      });

      completeOperationRun();

      import("../../core/mailSystem").then(({ triggerMailOnOperationComplete }) => {
        triggerMailOnOperationComplete(true);
      });

      renderAllNodesMenuScreen();
      showSystemPing({
        title: "Operation rewards stowed",
        message: "Base Camp inventory, resources, and card library are updated.",
        type: "success",
      });
    });
  }

  syncContinueEnabled();
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

function renderSummaryStat(label: string, value: string): string {
  return `
    <div class="opclear-stat">
      <span class="opclear-stat-label">${escapeOperationClearText(label)}</span>
      <span class="opclear-stat-value">${escapeOperationClearText(value)}</span>
    </div>
  `;
}

function renderNextAction(label: string, description: string): string {
  return `
    <div class="opclear-next-item">
      <span>${escapeOperationClearText(label)}</span>
      ${escapeOperationClearText(description)}
    </div>
  `;
}

function escapeOperationClearText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

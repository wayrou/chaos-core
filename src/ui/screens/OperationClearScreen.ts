// ============================================================================
// OPERATION CLEAR SCREEN
// Shows operation completion summary and rewards
// ============================================================================

import { renderOperationSelectScreen } from "./OperationSelectScreen";
import { getActiveRun, completeOperationRun } from "../../core/campaignManager";
import { OPERATION_DEFINITIONS } from "../../core/campaign";
import { updateGameState } from "../../state/gameStore";

export function renderOperationClearScreen(): void {
  const root = document.getElementById("app");
  if (!root) return;

  const activeRun = getActiveRun();
  if (!activeRun) {
    // No active run, go back to operation select
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

  // Generate rewards (placeholder - can be enhanced)
  const rewards = generateOperationRewards(activeRun);

  root.innerHTML = `
    <div class="opclear-root">
      <div class="opclear-card">
        <div class="opclear-header">
          <div class="opclear-title">🎉 OPERATION CLEAR</div>
          <div class="opclear-subtitle">${opDef.name}</div>
        </div>

        <div class="opclear-body">
          <!-- Summary Panel -->
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

          <!-- Rewards Section -->
          <div class="opclear-rewards">
            <div class="opclear-rewards-title">REWARDS</div>
            
            <!-- Card Choice -->
            <div class="opclear-reward-section">
              <div class="opclear-reward-label">Choose 1 Card:</div>
              <div class="opclear-card-choices" id="cardChoices">
                ${rewards.cards.map((card, i) => `
                  <div class="opclear-card-choice" data-card-id="${card.id}" data-index="${i}">
                    <div class="opclear-card-name">${card.name}</div>
                    <div class="opclear-card-desc">${card.description}</div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Resource Bundle -->
            <div class="opclear-reward-section">
              <div class="opclear-reward-label">Resource Bundle:</div>
              <div class="opclear-resources">
                <div class="opclear-resource-item">
                  <span class="opclear-resource-label">WAD:</span>
                  <span class="opclear-resource-value">+${rewards.wad}</span>
                </div>
                <div class="opclear-resource-item">
                  <span class="opclear-resource-label">Metal Scrap:</span>
                  <span class="opclear-resource-value">+${rewards.metalScrap}</span>
                </div>
                <div class="opclear-resource-item">
                  <span class="opclear-resource-label">Wood:</span>
                  <span class="opclear-resource-value">+${rewards.wood}</span>
                </div>
                <div class="opclear-resource-item">
                  <span class="opclear-resource-label">Chaos Shards:</span>
                  <span class="opclear-resource-value">+${rewards.chaosShards}</span>
                </div>
                <div class="opclear-resource-item">
                  <span class="opclear-resource-label">Steam Components:</span>
                  <span class="opclear-resource-value">+${rewards.steamComponents}</span>
                </div>
              </div>
            </div>

            <!-- Gear Choice (placeholder) -->
            <div class="opclear-reward-section">
              <div class="opclear-reward-label">Choose 1 Gear Item:</div>
              <div class="opclear-gear-choices" id="gearChoices">
                ${rewards.gear.map((gear, i) => `
                  <div class="opclear-gear-choice" data-gear-id="${gear.id}" data-index="${i}">
                    <div class="opclear-gear-name">${gear.name}</div>
                    <div class="opclear-gear-desc">${gear.description}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="opclear-actions">
            <button class="opclear-continue-btn" id="continueBtn" disabled>
              CONTINUE →
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Card choice handlers
  let selectedCardId: string | null = null;
  let selectedGearId: string | null = null;

  document.querySelectorAll(".opclear-card-choice").forEach(choice => {
    choice.addEventListener("click", () => {
      document.querySelectorAll(".opclear-card-choice").forEach(c => c.classList.remove("selected"));
      choice.classList.add("selected");
      selectedCardId = choice.getAttribute("data-card-id");
      checkContinueEnabled();
    });
  });

  // Gear choice handlers
  document.querySelectorAll(".opclear-gear-choice").forEach(choice => {
    choice.addEventListener("click", () => {
      document.querySelectorAll(".opclear-gear-choice").forEach(c => c.classList.remove("selected"));
      choice.classList.add("selected");
      selectedGearId = choice.getAttribute("data-gear-id");
      checkContinueEnabled();
    });
  });

  function checkContinueEnabled(): void {
    const continueBtn = document.getElementById("continueBtn");
    if (continueBtn) {
      continueBtn.disabled = !(selectedCardId && selectedGearId);
    }
  }

  // Continue button
  const continueBtn = document.getElementById("continueBtn");
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      if (!selectedCardId || !selectedGearId) return;

      // Apply rewards
      updateGameState(prev => {
        const newCardLibrary = { ...prev.cardLibrary };
        if (selectedCardId) {
          newCardLibrary[selectedCardId] = (newCardLibrary[selectedCardId] || 0) + 1;
        }

        return {
          ...prev,
          wad: (prev.wad || 0) + rewards.wad,
          resources: {
            metalScrap: (prev.resources?.metalScrap || 0) + rewards.metalScrap,
            wood: (prev.resources?.wood || 0) + rewards.wood,
            chaosShards: (prev.resources?.chaosShards || 0) + rewards.chaosShards,
            steamComponents: (prev.resources?.steamComponents || 0) + rewards.steamComponents,
          },
          cardLibrary: newCardLibrary,
          // TODO: Add gear to inventory
        };
      });

      // Complete operation
      completeOperationRun();

      // Trigger mail on operation completion
      import("../../core/mailSystem").then(({ triggerMailOnOperationComplete }) => {
        triggerMailOnOperationComplete(true);
      });

      // Return to operation select
      renderOperationSelectScreen();
    });
  }
}

/**
 * Generate rewards for operation completion
 */
function generateOperationRewards(activeRun: import("../../core/campaign").ActiveRunState): {
  cards: Array<{ id: string; name: string; description: string }>;
  wad: number;
  metalScrap: number;
  wood: number;
  chaosShards: number;
  steamComponents: number;
  gear: Array<{ id: string; name: string; description: string }>;
} {
  // Base rewards scale with operation difficulty and floors
  const baseMultiplier = activeRun.difficulty === "hard" ? 1.5 : activeRun.difficulty === "easy" ? 0.75 : 1.0;
  const floorMultiplier = 1 + (activeRun.floorsTotal * 0.2);

  return {
    cards: [
      { id: "card_power_strike", name: "Power Strike", description: "Deal increased damage" },
      { id: "card_guard_plus", name: "Guard+", description: "Enhanced defensive card" },
      { id: "card_heal", name: "Heal", description: "Restore HP" },
    ],
    wad: Math.floor(100 * baseMultiplier * floorMultiplier),
    metalScrap: Math.floor(50 * baseMultiplier * floorMultiplier),
    wood: Math.floor(30 * baseMultiplier * floorMultiplier),
    chaosShards: Math.floor(20 * baseMultiplier * floorMultiplier),
    steamComponents: Math.floor(15 * baseMultiplier * floorMultiplier),
    gear: [
      { id: "gear_combat_vest", name: "Combat Vest", description: "Increases defense" },
      { id: "gear_tactical_boots", name: "Tactical Boots", description: "Increases movement" },
    ],
  };
}


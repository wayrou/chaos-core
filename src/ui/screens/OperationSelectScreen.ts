// ============================================================================
// OPERATION SELECT SCREEN - Campaign System Integration
// Choose and start operations with locking and custom operation support
// Flow: Select Operation → Loadout Screen → Floor Screen
// ============================================================================

import { updateGameState } from "../../state/gameStore";
import { renderFieldScreen } from "../../field/FieldScreen";
import { renderLoadoutScreen } from "./LoadoutScreen";
import {
  OPERATION_DEFINITIONS,
  OperationId,
  loadCampaignProgress,
  isOperationUnlocked,
  isOperationCompleted,
} from "../../core/campaign";
import { startOperationRun } from "../../core/campaignManager";
import { activeRunToOperationRun } from "../../core/campaignManager";

// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------

let customOperationConfig = {
  floors: 3,
  difficulty: "normal" as "easy" | "normal" | "hard",
  enemyDensity: "normal" as "low" | "normal" | "high",
};

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

export function renderOperationSelectScreen(returnTo: "basecamp" | "field" = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) return;

  const progress = loadCampaignProgress();

  // Story operations (exclude custom)
  const storyOperationIds: OperationId[] = [
    "op_iron_gate",
    "op_black_spire",
    "op_ghost_run",
    "op_ember_siege",
    "op_final_dawn",
  ];

  root.innerHTML = `
    <div class="opselect-root">
      <div class="opselect-card">
        <div class="opselect-header">
          <div class="opselect-title">SELECT OPERATION</div>
          <button class="opselect-back-btn" data-return-to="${returnTo}">← ${returnTo === "field" ? "BACK TO FIELD MODE" : "BACK TO BASE CAMP"}</button>
        </div>

        <div class="opselect-body">
          <div class="opselect-info">
            Choose an operation to deploy. Complete operations sequentially to unlock new ones.
          </div>

          <div class="opselect-operations">
            ${storyOperationIds.map(opId => {
              const opDef = OPERATION_DEFINITIONS[opId];
              const unlocked = isOperationUnlocked(opId, progress);
              const completed = isOperationCompleted(opId, progress);
              
              let statusBadge = "";
              if (completed) {
                statusBadge = '<span class="opselect-status-badge opselect-status--completed">✓ COMPLETED</span>';
              } else if (unlocked) {
                statusBadge = '<span class="opselect-status-badge opselect-status--available">AVAILABLE</span>';
              } else {
                statusBadge = '<span class="opselect-status-badge opselect-status--locked">🔒 LOCKED</span>';
              }
              
              return `
                <div class="opselect-op-card ${!unlocked ? 'opselect-op-card--locked' : ''}" data-op-id="${opId}">
                  <div class="opselect-op-header">
                    <div class="opselect-op-codename">${unlocked ? opDef.name : '???'}</div>
                    ${statusBadge}
                  </div>

                  <div class="opselect-op-description">
                    ${unlocked ? opDef.description : 'Complete previous operations to unlock this mission.'}
                  </div>

                  ${unlocked ? `
                    <div class="opselect-op-details">
                      <div class="opselect-op-detail">
                        <span class="opselect-op-detail-label">Floors:</span>
                        <span class="opselect-op-detail-value">${opDef.floors}</span>
                      </div>
                      ${opDef.recommendedPower ? `
                        <div class="opselect-op-detail">
                          <span class="opselect-op-detail-label">Recommended Power:</span>
                          <span class="opselect-op-detail-value">${opDef.recommendedPower}</span>
                        </div>
                      ` : ''}
                    </div>
                  ` : `
                    <div class="opselect-op-details opselect-op-details--locked">
                      <div class="opselect-op-detail opselect-op-detail--locked">
                        <span class="opselect-op-detail-label">Floors:</span>
                        <span class="opselect-op-detail-value">???</span>
                      </div>
                      <div class="opselect-op-detail opselect-op-detail--locked">
                        <span class="opselect-op-detail-label">Recommended Power:</span>
                        <span class="opselect-op-detail-value">???</span>
                      </div>
                    </div>
                  `}

                  <button class="opselect-deploy-btn" 
                          data-op-id="${opId}" 
                          ${!unlocked ? 'disabled' : ''}>
                    ${unlocked ? 'DEPLOY →' : 'LOCKED'}
                  </button>
                </div>
              `;
            }).join('')}
            
            <!-- Custom Operation Card -->
            <div class="opselect-op-card opselect-op-card--custom" id="customOpCard">
              <div class="opselect-op-header">
                <div class="opselect-op-codename">CUSTOM OPERATION</div>
                <span class="opselect-status-badge opselect-status--available">CUSTOM</span>
              </div>

              <div class="opselect-op-description">
                Create a custom operation with your own parameters.
              </div>

              <div class="opselect-custom-config">
                <div class="opselect-custom-row">
                  <label>Floors:</label>
                  <input type="number" 
                         id="customFloors" 
                         min="1" 
                         max="10" 
                         value="${customOperationConfig.floors}"
                         class="opselect-custom-input">
                </div>
                
                <div class="opselect-custom-row">
                  <label>Difficulty:</label>
                  <select id="customDifficulty" class="opselect-custom-select">
                    <option value="easy" ${customOperationConfig.difficulty === "easy" ? "selected" : ""}>Easy</option>
                    <option value="normal" ${customOperationConfig.difficulty === "normal" ? "selected" : ""}>Normal</option>
                    <option value="hard" ${customOperationConfig.difficulty === "hard" ? "selected" : ""}>Hard</option>
                  </select>
                </div>
                
                <div class="opselect-custom-row">
                  <label>Enemy Density:</label>
                  <select id="customDensity" class="opselect-custom-select">
                    <option value="low" ${customOperationConfig.enemyDensity === "low" ? "selected" : ""}>Low</option>
                    <option value="normal" ${customOperationConfig.enemyDensity === "normal" ? "selected" : ""}>Normal</option>
                    <option value="high" ${customOperationConfig.enemyDensity === "high" ? "selected" : ""}>High</option>
                  </select>
                </div>
              </div>

              <button class="opselect-deploy-btn" id="customDeployBtn">
                START CUSTOM RUN →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Event listeners
  root.querySelector(".opselect-back-btn")?.addEventListener("click", () => {
    const btn = root.querySelector(".opselect-back-btn") as HTMLElement;
    const returnDestination = btn?.getAttribute("data-return-to") || returnTo;
    if (returnDestination === "field") {
      renderFieldScreen("base_camp");
    } else {
      import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
        renderFieldScreen("base_camp");
      });
    }
  });

  // Story operation buttons
  root.querySelectorAll(".opselect-deploy-btn[data-op-id]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const opId = (e.target as HTMLElement).getAttribute("data-op-id") as OperationId;
      if (opId && isOperationUnlocked(opId, progress)) {
        startOperation(opId, "normal");
      }
    });
  });

  // Custom operation button
  const customDeployBtn = document.getElementById("customDeployBtn");
  if (customDeployBtn) {
    customDeployBtn.addEventListener("click", () => {
      const floorsInput = document.getElementById("customFloors") as HTMLInputElement;
      const difficultySelect = document.getElementById("customDifficulty") as HTMLSelectElement;
      const densitySelect = document.getElementById("customDensity") as HTMLSelectElement;
      
      const floors = parseInt(floorsInput.value) || 3;
      const difficulty = difficultySelect.value as "easy" | "normal" | "hard";
      
      customOperationConfig = {
        floors: Math.max(1, Math.min(10, floors)),
        difficulty,
        enemyDensity: densitySelect.value as "low" | "normal" | "high",
      };
      
      startOperation("op_custom", difficulty, floors);
    });
  }
}

// ----------------------------------------------------------------------------
// OPERATION START
// ----------------------------------------------------------------------------

function startOperation(
  operationId: OperationId,
  difficulty: "easy" | "normal" | "hard" = "normal",
  customFloors?: number
): void {
  console.log("[OPSELECT] Starting operation:", operationId, difficulty, customFloors);
  
  try {
    // Start campaign run
    const progress = startOperationRun(operationId, difficulty, customFloors);
    const activeRun = progress.activeRun;
    
    if (!activeRun) {
      console.error("[OPSELECT] Failed to start run");
      return;
    }
    
    // Convert to OperationRun format for existing UI
    const operation = activeRunToOperationRun(activeRun);
    
    // Store in game state
    updateGameState(prev => ({
      ...prev,
      operation: operation as any,
      phase: "loadout", // Go to loadout first
    }));
    
    // Navigate to loadout screen
    renderLoadoutScreen();
  } catch (error) {
    console.error("[OPSELECT] Error starting operation:", error);
    alert(`Failed to start operation: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

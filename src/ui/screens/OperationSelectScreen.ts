// ============================================================================
// OPERATION SELECT SCREEN - Campaign System Integration
// Choose and start operations with locking and custom operation support
// Flow: Select Operation → Loadout Screen → Floor Screen
// ============================================================================

import { getAllImportedOperations } from "../../content/technica";
import { updateGameState } from "../../state/gameStore";
import { renderLoadoutScreen } from "./LoadoutScreen";
import {
  BaseCampReturnTo,
  getBaseCampReturnLabel,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";
import {
  OPERATION_DEFINITIONS,
  OperationId,
  loadCampaignProgress,
  isOperationUnlocked,
  isOperationCompleted,
  getEffectiveFloors,
  calculateRecommendedPower,
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

export function renderOperationSelectScreen(returnTo: BaseCampReturnTo = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) return;

  const progress = loadCampaignProgress();
  const importedOperations = getAllImportedOperations();

  // Story operations (exclude custom)
  const storyOperationIds: OperationId[] = [
    "op_iron_gate",
    "op_black_spire",
    "op_ghost_run",
    "op_ember_siege",
    "op_final_dawn",
  ];

  root.innerHTML = `
    <div class="opselect-root ard-noise">
      <div class="opselect-card">
        <!-- Header - Adventure Gothic Panel -->
        <div class="opselect-header">
          <div class="opselect-header-left">
            <h1 class="opselect-title">SELECT OPERATION</h1>
            <div class="opselect-subtitle">S/COM_OS // OPERATION_SELECT</div>
          </div>
          <div class="opselect-header-right">
            <button class="opselect-back-btn" data-return-to="${returnTo}">
              <span class="btn-icon">←</span>
              <span class="btn-text">${getBaseCampReturnLabel(returnTo)}</span>
            </button>
          </div>
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
              
              // Calculate values before template string to ensure functions are in scope
              const effectiveFloors = unlocked ? getEffectiveFloors(opDef) : 0;
              const recommendedPWR = unlocked ? calculateRecommendedPower(0, opDef.recommendedPower) : 0;
              
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
                        <span class="opselect-op-detail-value">${effectiveFloors}</span>
                      </div>
                      <div class="opselect-op-detail">
                        <span class="opselect-op-detail-label">Recommended Power:</span>
                        <span class="opselect-op-detail-value">${recommendedPWR}</span>
                      </div>
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

            ${importedOperations.length > 0 ? `
              <div class="opselect-op-card opselect-op-card--custom">
                <div class="opselect-op-header">
                  <div class="opselect-op-codename">TECHNICA IMPORTS</div>
                  <span class="opselect-status-badge opselect-status--available">LIVE</span>
                </div>
                <div class="opselect-op-description">
                  Direct-run operations imported from Technica appear here.
                </div>
                <div class="opselect-imported-list">
                  ${importedOperations.map((operation) => `
                    <div class="opselect-imported-item">
                      <div class="opselect-imported-item__meta">
                        <strong>${operation.codename}</strong>
                        <span>${operation.description}</span>
                      </div>
                      <button class="opselect-deploy-btn" data-imported-op-id="${operation.id}">
                        DEPLOY IMPORT
                      </button>
                    </div>
                  `).join("")}
                </div>
              </div>
            ` : ""}
          </div>
        </div>
      </div>
    </div>
  `;

  // Event listeners
  root.querySelector(".opselect-back-btn")?.addEventListener("click", () => {
    const btn = root.querySelector(".opselect-back-btn") as HTMLElement;
    unregisterBaseCampReturnHotkey("operation-select-screen");
    const returnDestination = (btn?.getAttribute("data-return-to") as BaseCampReturnTo | null) || returnTo;
    returnFromBaseCampScreen(returnDestination);
  });

  registerBaseCampReturnHotkey("operation-select-screen", returnTo, { allowFieldEKey: true, activeSelector: ".opselect-root" });

  // Story operation buttons
  root.querySelectorAll(".opselect-deploy-btn[data-op-id]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const opId = (e.target as HTMLElement).getAttribute("data-op-id") as OperationId;
      if (opId && isOperationUnlocked(opId, progress)) {
        startOperation(opId, "normal");
      }
    });
  });

  root.querySelectorAll(".opselect-deploy-btn[data-imported-op-id]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const operationId = (e.target as HTMLElement).getAttribute("data-imported-op-id");
      if (operationId) {
        startImportedOperation(operationId);
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

function startImportedOperation(operationId: string): void {
  const importedOperation = getAllImportedOperations().find((entry) => entry.id === operationId);
  if (!importedOperation) {
    alert("Imported operation not found.");
    return;
  }

  const floors = importedOperation.floors.map((floor) => {
    const nodes = (floor.nodes || floor.rooms || []).map((node) => ({
      ...node,
      visited: node.visited ?? false,
      connections: [...(node.connections || [])],
    }));

    return {
      ...floor,
      nodes,
      rooms: nodes,
    };
  });

  const firstFloor = floors[0];
  const firstNodes = firstFloor?.nodes || firstFloor?.rooms || [];
  const startingRoomId =
    importedOperation.currentRoomId ||
    firstFloor?.startingRoomId ||
    firstNodes[0]?.id ||
    null;

  updateGameState((prev) => ({
    ...prev,
    operation: {
      ...importedOperation,
      currentFloorIndex: importedOperation.currentFloorIndex ?? 0,
      currentRoomId: startingRoomId,
      floors,
    } as any,
    phase: "loadout",
  }));

  renderLoadoutScreen();
}

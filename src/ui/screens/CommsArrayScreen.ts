// ============================================================================
// CHAOS CORE - COMMS ARRAY SCREEN
// Training battles and future multiplayer features
// ============================================================================

import { getGameState } from "../../state/gameStore";
import { renderAllNodesMenuScreen } from "./AllNodesMenuScreen";
import { renderFieldScreen } from "../../field/FieldScreen";
import { createTrainingEncounter, TrainingConfig } from "../../core/trainingEncounter";
import { createBattleFromEncounter } from "../../core/battleFromEncounter";
import { updateGameState } from "../../state/gameStore";
import { renderBattleScreen } from "./BattleScreen";

// Training config state
let trainingConfig: TrainingConfig = {
  gridW: 6,
  gridH: 4,
  difficulty: "normal",
  rules: {
    noRewards: true,
  },
};

// Store last training config for rematch
let lastTrainingConfig: TrainingConfig | null = null;

export function renderCommsArrayScreen(returnTo: "basecamp" | "field" | "operation" = "basecamp"): void {
  const app = document.getElementById("app");
  if (!app) return;
  
  const state = getGameState();
  const backButtonText = returnTo === "field" ? "FIELD MODE" : returnTo === "operation" ? "DUNGEON MAP" : "BASE CAMP";
  
  app.innerHTML = `
    <div class="comms-array-root">
      <!-- Header -->
      <div class="comms-array-header">
        <div class="comms-array-header-left">
          <h1 class="comms-array-title">COMMS ARRAY</h1>
          <div class="comms-array-subtitle">TACTICAL SIMULATION TERMINAL</div>
        </div>
        <div class="comms-array-header-right">
          <button class="comms-array-back-btn" id="backBtn" data-return-to="${returnTo}">
            <span class="btn-icon">←</span>
            <span class="btn-text">${backButtonText}</span>
          </button>
        </div>
      </div>
      
      <!-- Dev Debug Label -->
      <div class="comms-array-debug-label">CURSOR_PROOF_COMMS_ARRAY_NODE</div>
      
      <!-- Content -->
      <div class="comms-array-content">
        <!-- Section 1: Online Multiplayer (Locked) -->
        <div class="comms-array-section">
          <div class="comms-array-section-header">
            <h2 class="section-title">ONLINE MULTIPLAYER</h2>
            <div class="section-status section-status--locked">LOCKED</div>
          </div>
          <div class="comms-array-section-body">
            <p class="section-description">
              Online multiplayer features are coming in a future update.
            </p>
            <div class="comms-array-button-group">
              <button class="comms-array-btn comms-array-btn--disabled" id="hostSessionBtn" disabled>
                HOST SESSION
              </button>
              <button class="comms-array-btn comms-array-btn--disabled" id="joinSessionBtn" disabled>
                JOIN SESSION
              </button>
            </div>
          </div>
        </div>
        
        <!-- Section 2: Training Battles (Bots) -->
        <div class="comms-array-section">
          <div class="comms-array-section-header">
            <h2 class="section-title">TRAINING BATTLES</h2>
            <div class="section-status section-status--active">ACTIVE</div>
          </div>
          <div class="comms-array-section-body">
            <p class="section-description">
              Practice against AI opponents. No rewards, unlimited retries.
            </p>
            
            <!-- Training Configuration -->
            <div class="training-config">
              <div class="config-row">
                <label class="config-label">Grid Width:</label>
                <select class="config-select" id="gridWidthSelect">
                  ${[4, 5, 6, 7, 8].map(w => 
                    `<option value="${w}" ${trainingConfig.gridW === w ? 'selected' : ''}>${w}</option>`
                  ).join('')}
                </select>
              </div>
              
              <div class="config-row">
                <label class="config-label">Grid Height:</label>
                <select class="config-select" id="gridHeightSelect">
                  ${[3, 4, 5, 6].map(h => 
                    `<option value="${h}" ${trainingConfig.gridH === h ? 'selected' : ''}>${h}</option>`
                  ).join('')}
                </select>
              </div>
              
              <div class="config-row">
                <label class="config-label">Bot Difficulty:</label>
                <select class="config-select" id="difficultySelect">
                  <option value="easy" ${trainingConfig.difficulty === "easy" ? 'selected' : ''}>Easy</option>
                  <option value="normal" ${trainingConfig.difficulty === "normal" ? 'selected' : ''}>Normal</option>
                  <option value="hard" ${trainingConfig.difficulty === "hard" ? 'selected' : ''}>Hard</option>
                </select>
              </div>
              
              <div class="config-note">
                <span class="note-icon">ℹ</span>
                <span>No Rewards: Always enabled (training mode)</span>
              </div>
            </div>
            
            <div class="comms-array-button-group">
              <button class="comms-array-btn comms-array-btn--primary" id="startTrainingBtn">
                START TRAINING
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  attachCommsArrayListeners(returnTo);
}

function attachCommsArrayListeners(returnTo: "basecamp" | "field" | "operation"): void {
  // Back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.onclick = () => {
      if (returnTo === "field") {
        renderFieldScreen("base_camp");
      } else if (returnTo === "operation") {
        // Return to operation map if needed
        import("./OperationMapScreen").then(({ renderOperationMapScreen }) => {
          renderOperationMapScreen();
        });
      } else {
        renderAllNodesMenuScreen();
      }
    };
  }
  
  // Locked multiplayer buttons
  const hostBtn = document.getElementById("hostSessionBtn");
  const joinBtn = document.getElementById("joinSessionBtn");
  if (hostBtn) {
    hostBtn.onclick = () => {
      showNotification("Locked (Coming Soon)", "info");
    };
  }
  if (joinBtn) {
    joinBtn.onclick = () => {
      showNotification("Locked (Coming Soon)", "info");
    };
  }
  
  // Training config controls
  const gridWidthSelect = document.getElementById("gridWidthSelect") as HTMLSelectElement;
  const gridHeightSelect = document.getElementById("gridHeightSelect") as HTMLSelectElement;
  const difficultySelect = document.getElementById("difficultySelect") as HTMLSelectElement;
  const botAutoBattleCheck = document.getElementById("botAutoBattleCheck") as HTMLInputElement;
  
  if (gridWidthSelect) {
    gridWidthSelect.addEventListener("change", () => {
      trainingConfig.gridW = parseInt(gridWidthSelect.value);
    });
  }
  
  if (gridHeightSelect) {
    gridHeightSelect.addEventListener("change", () => {
      trainingConfig.gridH = parseInt(gridHeightSelect.value);
    });
  }
  
  if (difficultySelect) {
    difficultySelect.addEventListener("change", () => {
      trainingConfig.difficulty = difficultySelect.value as "easy" | "normal" | "hard";
    });
  }
  
  // Start Training button
  const startTrainingBtn = document.getElementById("startTrainingBtn");
  if (startTrainingBtn) {
    startTrainingBtn.onclick = () => {
      startTrainingBattle(returnTo);
    };
  }
}

function startTrainingBattle(returnTo: "basecamp" | "field" | "operation"): void {
  const state = getGameState();
  
  // Validate grid bounds
  if (trainingConfig.gridW < 4 || trainingConfig.gridW > 8) {
    showNotification("Grid width must be between 4 and 8", "error");
    return;
  }
  if (trainingConfig.gridH < 3 || trainingConfig.gridH > 6) {
    showNotification("Grid height must be between 3 and 6", "error");
    return;
  }
  
  // Create training encounter
  const encounter = createTrainingEncounter(state, trainingConfig);
  
  if (!encounter) {
    showNotification("Failed to create training encounter", "error");
    return;
  }
  
  // Store config for rematch
  lastTrainingConfig = { ...trainingConfig };
  
  // Create battle from encounter
  const battle = createBattleFromEncounter(state, encounter, `training_${Date.now()}`);
  
  if (!battle) {
    showNotification("Failed to create battle", "error");
    return;
  }
  
  // Mark as training battle
  (battle as any).isTraining = true;
  (battle as any).trainingConfig = trainingConfig;
  (battle as any).returnTo = returnTo;
  
  // Store battle in state
  updateGameState(prev => ({
    ...prev,
    currentBattle: { ...battle, turnIndex: 0 } as any,
    phase: "battle",
  }));
  
  // Render battle screen
  renderBattleScreen();
}

export function getLastTrainingConfig(): TrainingConfig | null {
  return lastTrainingConfig;
}

export function clearLastTrainingConfig(): void {
  lastTrainingConfig = null;
}

function showNotification(message: string, type: "success" | "error" | "info"): void {
  // Simple notification - reuse existing pattern if available
  const notification = document.createElement("div");
  notification.className = `notification notification--${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    background: ${type === "error" ? "#8b0000" : type === "success" ? "#006400" : "#1a4d7a"};
    color: white;
    border-radius: 4px;
    z-index: 10000;
    font-family: monospace;
    font-size: 0.9rem;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}


// ============================================================================
// TRAINING SIM SETUP SCREEN
// Configure and launch simulated battles (no rewards)
// ============================================================================

import { renderCommsArrayScreen } from "./CommsArrayScreen";
import { renderFieldScreen } from "../../field/FieldScreen";
import { getGameState, updateGameState } from "../../state/gameStore";
import { createBattleFromEncounter } from "../../core/battleFromEncounter";
import { renderBattleScreen } from "./BattleScreen";
import { GameState } from "../../core/types";

// Grid size options
const GRID_SIZES = [
  { label: "4x3", width: 4, height: 3 },
  { label: "5x4", width: 5, height: 4 },
  { label: "6x3", width: 6, height: 3 },
  { label: "6x4", width: 6, height: 4 },
  { label: "8x6", width: 8, height: 6 },
];

// Enemy roster presets
type EnemyRosterPreset = "random" | "all_grunts" | "ranged_focus" | "mixed";

interface TrainingSimConfig {
  gridSize: typeof GRID_SIZES[number];
  enemyCount: number;
  enemyRoster: EnemyRosterPreset;
  coverProfile: "none" | "light" | "mixed" | "random";
  difficulty: "easy" | "standard" | "hard";
}

// Default config
let currentConfig: TrainingSimConfig = {
  gridSize: GRID_SIZES[3], // 6x4
  enemyCount: 3,
  enemyRoster: "random",
  coverProfile: "mixed",
  difficulty: "standard",
};

/**
 * Render Training Sim Setup Screen
 * @param returnTo - Where to return when closing ("comms_array" or "field")
 */
export function renderTrainingSimSetupScreen(returnTo: "comms_array" | "field" = "comms_array"): void {
  const root = document.getElementById("app");
  if (!root) {
    console.error("[TRAININGSIM] Missing #app element");
    return;
  }

  // Check if player is in an active run
  const state = getGameState();
  const activeRun = (window as any).__campaignState?.activeRun;
  if (activeRun) {
    root.innerHTML = `
      <div class="training-sim-root">
        <div class="training-sim-panel">
          <div class="training-sim-header">
            <div class="training-sim-title">TRAINING SIM</div>
            <button class="training-sim-close" id="closeBtn">✕ CLOSE</button>
          </div>
          <div class="training-sim-blocked">
            <div class="training-sim-blocked-icon">⚠️</div>
            <div class="training-sim-blocked-title">OPERATION IN PROGRESS</div>
            <div class="training-sim-blocked-message">
              Finish or abandon current operation before entering Training Sim.
            </div>
            <button class="training-sim-btn-secondary" id="backBtn">BACK</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("closeBtn")?.addEventListener("click", () => handleBack(returnTo));
    document.getElementById("backBtn")?.addEventListener("click", () => handleBack(returnTo));
    return;
  }

  // Calculate max enemy count based on grid size
  const gridArea = currentConfig.gridSize.width * currentConfig.gridSize.height;
  const maxEnemies = Math.max(3, Math.min(10, Math.floor(gridArea * 0.25)));

  // Clamp current enemy count to max
  if (currentConfig.enemyCount > maxEnemies) {
    currentConfig.enemyCount = maxEnemies;
  }

  root.innerHTML = `
    <div class="training-sim-root">
      <div class="training-sim-panel">
        <!-- Header -->
        <div class="training-sim-header">
          <div class="training-sim-title">TRAINING SIM</div>
          <div class="training-sim-subtitle">Configure simulated engagement. No rewards issued.</div>
          <button class="training-sim-close" id="closeBtn">✕ CLOSE</button>
        </div>

        <!-- Configuration -->
        <div class="training-sim-config">
          <!-- Grid Size -->
          <div class="training-sim-field">
            <label class="training-sim-label">GRID SIZE</label>
            <select class="training-sim-select" id="gridSizeSelect">
              ${GRID_SIZES.map((size, index) => `
                <option value="${index}" ${size === currentConfig.gridSize ? "selected" : ""}>
                  ${size.label} (${size.width}×${size.height})
                </option>
              `).join("")}
            </select>
          </div>

          <!-- Enemy Count -->
          <div class="training-sim-field">
            <label class="training-sim-label">ENEMY COUNT</label>
            <div class="training-sim-stepper">
              <button class="training-sim-stepper-btn" id="enemyDecBtn">−</button>
              <input type="number" class="training-sim-stepper-input" id="enemyCountInput" value="${currentConfig.enemyCount}" min="1" max="${maxEnemies}" readonly>
              <button class="training-sim-stepper-btn" id="enemyIncBtn">+</button>
            </div>
            <div class="training-sim-hint">Max: ${maxEnemies} (25% of grid area)</div>
          </div>

          <!-- Enemy Roster -->
          <div class="training-sim-field">
            <label class="training-sim-label">ENEMY ROSTER</label>
            <select class="training-sim-select" id="enemyRosterSelect">
              <option value="random" ${currentConfig.enemyRoster === "random" ? "selected" : ""}>Random (Balanced)</option>
              <option value="all_grunts" ${currentConfig.enemyRoster === "all_grunts" ? "selected" : ""}>All Grunts</option>
              <option value="ranged_focus" ${currentConfig.enemyRoster === "ranged_focus" ? "selected" : ""}>Ranged Focus</option>
              <option value="mixed" ${currentConfig.enemyRoster === "mixed" ? "selected" : ""}>Mixed (2 types)</option>
            </select>
          </div>

          <!-- Cover Profile -->
          <div class="training-sim-field">
            <label class="training-sim-label">COVER</label>
            <select class="training-sim-select" id="coverSelect">
              <option value="none" ${currentConfig.coverProfile === "none" ? "selected" : ""}>None</option>
              <option value="light" ${currentConfig.coverProfile === "light" ? "selected" : ""}>Light</option>
              <option value="mixed" ${currentConfig.coverProfile === "mixed" ? "selected" : ""}>Mixed (Light + Heavy)</option>
              <option value="random" ${currentConfig.coverProfile === "random" ? "selected" : ""}>Random</option>
            </select>
          </div>

          <!-- Difficulty -->
          <div class="training-sim-field">
            <label class="training-sim-label">DIFFICULTY</label>
            <select class="training-sim-select" id="difficultySelect">
              <option value="easy" ${currentConfig.difficulty === "easy" ? "selected" : ""}>Easy (-1 enemy stats)</option>
              <option value="standard" ${currentConfig.difficulty === "standard" ? "selected" : ""}>Standard</option>
              <option value="hard" ${currentConfig.difficulty === "hard" ? "selected" : ""}>Hard (+1 enemy stats)</option>
            </select>
          </div>
        </div>

        <!-- Actions -->
        <div class="training-sim-actions">
          <button class="training-sim-btn-primary" id="launchBtn">LAUNCH SIM</button>
          <button class="training-sim-btn-secondary" id="backBtn">BACK</button>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  attachEventListeners(returnTo, maxEnemies);
}

function attachEventListeners(returnTo: "comms_array" | "field", maxEnemies: number): void {
  const closeBtn = document.getElementById("closeBtn");
  const backBtn = document.getElementById("backBtn");
  const launchBtn = document.getElementById("launchBtn");
  const gridSizeSelect = document.getElementById("gridSizeSelect") as HTMLSelectElement;
  const enemyCountInput = document.getElementById("enemyCountInput") as HTMLInputElement;
  const enemyDecBtn = document.getElementById("enemyDecBtn");
  const enemyIncBtn = document.getElementById("enemyIncBtn");
  const enemyRosterSelect = document.getElementById("enemyRosterSelect") as HTMLSelectElement;
  const coverSelect = document.getElementById("coverSelect") as HTMLSelectElement;
  const difficultySelect = document.getElementById("difficultySelect") as HTMLSelectElement;

  // Close/Back handlers
  closeBtn?.addEventListener("click", () => handleBack(returnTo));
  backBtn?.addEventListener("click", () => handleBack(returnTo));

  // Grid size change - recalculate max enemies
  gridSizeSelect?.addEventListener("change", () => {
    const index = parseInt(gridSizeSelect.value);
    currentConfig.gridSize = GRID_SIZES[index];
    // Re-render to update max enemies
    renderTrainingSimSetupScreen(returnTo);
  });

  // Enemy count stepper
  enemyDecBtn?.addEventListener("click", () => {
    const current = parseInt(enemyCountInput.value);
    if (current > 1) {
      currentConfig.enemyCount = current - 1;
      enemyCountInput.value = currentConfig.enemyCount.toString();
    }
  });

  enemyIncBtn?.addEventListener("click", () => {
    const current = parseInt(enemyCountInput.value);
    if (current < maxEnemies) {
      currentConfig.enemyCount = current + 1;
      enemyCountInput.value = currentConfig.enemyCount.toString();
    }
  });

  // Roster/Cover/Difficulty changes
  enemyRosterSelect?.addEventListener("change", () => {
    currentConfig.enemyRoster = enemyRosterSelect.value as EnemyRosterPreset;
  });

  coverSelect?.addEventListener("change", () => {
    currentConfig.coverProfile = coverSelect.value as TrainingSimConfig["coverProfile"];
  });

  difficultySelect?.addEventListener("change", () => {
    currentConfig.difficulty = difficultySelect.value as TrainingSimConfig["difficulty"];
  });

  // Launch button
  launchBtn?.addEventListener("click", () => {
    launchTrainingSim(currentConfig, returnTo);
  });
}

function handleBack(returnTo: "comms_array" | "field"): void {
  if (returnTo === "comms_array") {
    renderCommsArrayScreen("field");
  } else {
    renderFieldScreen("base_camp");
  }
}

/**
 * Launch the training sim battle
 */
function launchTrainingSim(config: TrainingSimConfig, returnTo: "comms_array" | "field"): void {
  console.log("[TRAININGSIM] Launching sim with config:", config);

  const state = getGameState();

  // Generate encounter definition
  const encounter = generateEncounterFromConfig(config);

  // Create battle state
  const simSeed = `trainingsim_${Date.now()}`;
  const battle = createBattleFromEncounter(state, encounter, simSeed);

  if (!battle) {
    console.error("[TRAININGSIM] Failed to create battle");
    alert("Failed to create training sim. Please try again.");
    return;
  }

  // Mark battle as training sim
  (battle as any).isTrainingSim = true;
  (battle as any).trainingSimReturnTo = returnTo;

  // Store battle in state
  updateGameState(prev => ({
    ...prev,
    currentBattle: { ...battle, turnIndex: 0 } as any,
    phase: "battle",
  }));

  // Launch battle screen
  renderBattleScreen();
}

/**
 * Generate encounter definition from training sim config
 */
function generateEncounterFromConfig(config: TrainingSimConfig): any {
  const { gridSize, enemyCount, enemyRoster, difficulty } = config;

  // Determine enemy composition
  let enemyUnits: Array<{ enemyId: string; count: number; levelMod?: number }> = [];

  // Level mod based on difficulty
  const levelMod = difficulty === "easy" ? -1 : difficulty === "hard" ? 1 : 0;

  // Generate enemy list based on roster type
  switch (enemyRoster) {
    case "all_grunts":
      enemyUnits = [
        { enemyId: "basic_infantry", count: enemyCount, levelMod },
      ];
      break;

    case "ranged_focus":
      const rangedCount = Math.ceil(enemyCount * 0.7);
      const meleeCount = enemyCount - rangedCount;
      enemyUnits = [
        { enemyId: "sniper", count: rangedCount, levelMod },
        { enemyId: "basic_infantry", count: meleeCount, levelMod },
      ];
      break;

    case "mixed":
      const half = Math.floor(enemyCount / 2);
      const remainder = enemyCount - half;
      enemyUnits = [
        { enemyId: "basic_infantry", count: half, levelMod },
        { enemyId: "corrupted_scout", count: remainder, levelMod },
      ];
      break;

    case "random":
    default:
      // Random balanced mix
      const enemyTypes = ["basic_infantry", "corrupted_scout", "gate_sentry"];
      const distribution = distributeEnemies(enemyCount, enemyTypes.length);
      enemyUnits = enemyTypes.map((id, index) => ({
        enemyId: id,
        count: distribution[index],
        levelMod,
      })).filter(e => e.count > 0);
      break;
  }

  return {
    enemyUnits,
    gridWidth: gridSize.width,
    gridHeight: gridSize.height,
    introText: `Training Sim: ${gridSize.label} grid, ${enemyCount} enemies`,
  };
}

/**
 * Distribute a total count across N buckets fairly
 */
function distributeEnemies(total: number, buckets: number): number[] {
  const result = new Array(buckets).fill(0);
  const base = Math.floor(total / buckets);
  const remainder = total % buckets;

  for (let i = 0; i < buckets; i++) {
    result[i] = base + (i < remainder ? 1 : 0);
  }

  return result;
}

/**
 * Store training sim config for "Run Again"
 */
export function getLastTrainingSimConfig(): TrainingSimConfig {
  return currentConfig;
}

// ============================================================================
// OPERATION SELECT SCREEN - Updated for Headline 13
// Choose and start procedurally generated operations
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderBaseCampScreen } from "./BaseCampScreen";
import { renderFieldScreen } from "../../field/FieldScreen";
import { renderOperationMapScreen } from "./OperationMapScreen";
import { generateOperation } from "../../core/procedural";
import { GameState } from "../../core/types";

export function renderOperationSelectScreen(returnTo: "basecamp" | "field" = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();

  // List of available operations
  const operations = [
    {
      codename: "IRON GATE",
      description: "Secure the Chaos Rift entrance and clear the corrupted garrison.",
      difficulty: "Normal",
      floors: 3,
    },
    {
      codename: "EMBER VAULT",
      description: "Infiltrate the abandoned research facility. Recover lost artifacts.",
      difficulty: "Hard",
      floors: 4,
    },
    {
      codename: "SHADOW NEXUS",
      description: "Investigate the dimensional anomaly deep within enemy territory.",
      difficulty: "Very Hard",
      floors: 5,
    },
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
            Choose an operation to deploy. Each run features procedurally generated encounters.
          </div>

          <div class="opselect-operations">
            ${operations.map((op, index) => `
              <div class="opselect-op-card" data-op-index="${index}">
                <div class="opselect-op-header">
                  <div class="opselect-op-codename">${op.codename}</div>
                  <div class="opselect-op-difficulty ${getDifficultyClass(op.difficulty)}">
                    ${op.difficulty.toUpperCase()}
                  </div>
                </div>

                <div class="opselect-op-description">
                  ${op.description}
                </div>

                <div class="opselect-op-details">
                  <div class="opselect-op-detail">
                    <span class="opselect-op-detail-label">Floors:</span>
                    <span class="opselect-op-detail-value">${op.floors}</span>
                  </div>
                  <div class="opselect-op-detail">
                    <span class="opselect-op-detail-label">Type:</span>
                    <span class="opselect-op-detail-value">Procedural</span>
                  </div>
                </div>

                <button class="opselect-deploy-btn" data-op-index="${index}">
                  DEPLOY →
                </button>
              </div>
            `).join('')}
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
      renderBaseCampScreen();
    }
  });

  root.querySelectorAll(".opselect-deploy-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const index = parseInt((e.target as HTMLElement).getAttribute("data-op-index") || "0");
      const operation = operations[index];
      if (operation) {
        startOperation(operation.codename, operation.description, operation.floors);
      }
    });
  });
}

function getDifficultyClass(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case "easy": return "difficulty-easy";
    case "normal": return "difficulty-normal";
    case "hard": return "difficulty-hard";
    case "very hard": return "difficulty-veryhard";
    default: return "difficulty-normal";
  }
}

function startOperation(codename: string, description: string, floors: number): void {
  console.log("[OPSELECT] Generating operation:", codename, floors, "floors");

  // Generate procedural operation
  const operation = generateOperation(codename, description, floors);

  // Store in game state
  updateGameState(prev => ({
    ...prev,
    operation: operation as any,
    phase: "operation",
  }));

  // Navigate to operation map
  renderOperationMapScreen();
}

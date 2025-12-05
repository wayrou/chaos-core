// src/ui/screens/OperationMapScreen.ts
import { getGameState, updateGameState } from "../../state/gameStore";
import { getCurrentOperation } from "../../core/ops";
import { createTestBattleForCurrentParty } from "../../core/battle";
import { renderBattleScreen } from "./BattleScreen";
import { renderScrollLinkShell } from "./ScrollLinkShell";
import { renderBaseCampScreen } from "./BaseCampScreen";

import { saveGame, loadGame } from "../../core/saveSystem";
import { getSettings, updateSettings } from "../../core/settings";
import { initControllerSupport } from "../../core/controllerSupport";
import { getGameState, updateGameState } from "../../state/gameStore";

export function renderOperationMap(): void {
  const root = document.getElementById("app");
  if (!root) {
    console.error("Missing #app element in index.html");
    return;
  }

  const state = getGameState();
  const operation = getCurrentOperation(state);

  if (!operation) {
    root.innerHTML = `
      <div class="opmap-root">
        <div class="opmap-card">
          <div class="opmap-header">
            <div class="opmap-title">NO ACTIVE OPERATION</div>
            <button class="opmap-back-btn">BACK TO SHELL</button>
          </div>
          <div class="opmap-body">
            <p>No operation run is currently active. Return to the shell and start a new operation.</p>
          </div>
        </div>
      </div>
    `;

    const backBtn = root.querySelector<HTMLButtonElement>(".opmap-back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
renderBaseCampScreen();

      });
    }

    return;
  }

  const floorIndex = operation.currentFloorIndex ?? 0;
  const floor = operation.floors[floorIndex];

  root.innerHTML = `
    <div class="opmap-root">
      <div class="opmap-card">
        <div class="opmap-header">
          <div>
            <div class="opmap-title">OPERATION: ${operation.codename}</div>
            <div class="opmap-subtitle">
              FLOOR ${floorIndex + 1}/${operation.floors.length} · ${floor.name}
            </div>
          </div>
          <div class="opmap-header-actions">
            <button class="opmap-back-btn">BACK TO SHELL</button>
          </div>
        </div>

        <div class="opmap-body">
          <p>
            This is a placeholder Operation Map screen.
            Later, this will show the full node graph and routing.
          </p>

          <p>
            For now, use the button below to spin up a test battle using your current party.
          </p>

          <button class="opmap-startbattle-btn">
            START TEST BATTLE
          </button>
        </div>
      </div>
    </div>
  `;

  // Back → shell
  const backBtn = root.querySelector<HTMLButtonElement>(".opmap-back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
renderBaseCampScreen();

    });
  }

  // Start test battle → create battle + render BattleScreen
  const startBattleBtn = root.querySelector<HTMLButtonElement>(
    ".opmap-startbattle-btn"
  );
  if (startBattleBtn) {
    startBattleBtn.addEventListener("click", () => {
      updateGameState((prev) => {
        return {
          ...prev,
          currentBattle: createTestBattleForCurrentParty(prev),
        };
      });

      renderBattleScreen();
    });
  }
}

// src/ui/screens/OperationSelectScreen.ts

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderBaseCampScreen } from "./BaseCampScreen";
import { renderOperationMap } from "./OperationMapScreen";

import { saveGame, loadGame } from "../../core/saveSystem";
import { getSettings, updateSettings } from "../../core/settings";
import { initControllerSupport } from "../../core/controllerSupport";
import { getGameState, updateGameState } from "../../state/gameStore";


export function renderOperationSelectScreen(): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const op = state.operation;

  root.innerHTML = `
    <div class="opselect-root">

      <div class="opselect-header">
        <div class="opselect-title">SELECT OPERATION</div>
      </div>

      <div class="opselect-section">

        <div class="op-card">
          <div class="op-card-title">MAIN STORY OPERATION</div>
          <div class="op-card-desc">${op.description}</div>
          <button class="opstart-story-btn">BEGIN STORY OPERATION</button>
        </div>

        <div class="op-card">
          <div class="op-card-title">CUSTOM OPERATION</div>
          <div class="op-card-desc">
            Create a custom layout, difficulty, and rewards.<br/>
            (Full customization coming in 11c/11d)
          </div>
          <button class="opstart-custom-btn">BEGIN CUSTOM OP (placeholder)</button>
        </div>

      </div>

      <button class="opselect-back-btn">BACK TO BASE CAMP</button>
    </div>
  `;

  // Story OP
  root.querySelector(".opstart-story-btn")?.addEventListener("click", () => {
    updateGameState((prev) => ({
      ...prev,
      phase: "map",
    }));
    renderOperationMap();
  });

  // Custom OP – placeholder: just load the same operation for now
  root.querySelector(".opstart-custom-btn")?.addEventListener("click", () => {
    updateGameState((prev) => ({
      ...prev,
      phase: "map",
    }));
    renderOperationMap();
  });

  root.querySelector(".opselect-back-btn")?.addEventListener("click", () => {
    renderBaseCampScreen();
  });
}

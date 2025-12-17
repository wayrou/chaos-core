// ============================================================================
// SCROLL LINK OS OPERATION LOADING SCREEN
// Shows loading animation between loadout screen and operation map
// ============================================================================

import { renderOperationMapScreen } from "./OperationMapScreen";
import { getGameState } from "../../state/gameStore";
import { getCurrentOperation } from "../../core/ops";

export function renderScrollLinkOperationLoad(): void {
  const root = document.getElementById("app");
  if (!root) {
    console.error("[SCROLLLINK] Missing #app element");
    return;
  }

  const state = getGameState();
  const operation = getCurrentOperation(state);
  const operationName = operation?.codename || "OPERATION";
  const operationDesc = operation?.description || "Initializing operation...";

  root.innerHTML = `
    <div class="scrolllink-boot">
      <div class="boot-inner">
        <div class="boot-logo">SCROLLLINK OS</div>
        <div class="boot-subtitle">OPERATION_INIT</div>
        <div class="boot-tagline">Legacy Solaris Systems — "Working for you."</div>
        <div class="boot-log"></div>
        <div class="boot-progress">
          <div class="boot-progress-bar"></div>
        </div>
      </div>
    </div>
  `;

  const logEl = root.querySelector(".boot-log") as HTMLDivElement | null;
  const progressBar = root.querySelector(
    ".boot-progress-bar"
  ) as HTMLDivElement | null;

  if (!logEl || !progressBar) return;

  const logLines = [
    "[OK] Initializing operation protocols...",
    `[OK] Loading operation profile: ${operationName}`,
    `[OK] ${operationDesc}`,
    "[OK] Verifying squad deployment status...",
    "[OK] Syncing loadout manifest...",
    "[OK] Generating floor map topology...",
    "[OK] Establishing Scroll Link node connections...",
    "[OK] Initializing encounter database...",
    "[OK] All systems ready for deployment.",
    ">> Launching OPERATION MAP..."
  ];

  let index = 0;
  const total = logLines.length;

  const interval = setInterval(() => {
    const line = logLines[index];
    const lineDiv = document.createElement("div");
    lineDiv.className = "boot-line";
    lineDiv.textContent = line;
    logEl.appendChild(lineDiv);
    logEl.scrollTop = logEl.scrollHeight;

    const percent = ((index + 1) / total) * 100;
    progressBar.style.width = `${percent}%`;

    index++;

    if (index >= total) {
      clearInterval(interval);
      setTimeout(() => {
        renderOperationMapScreen();
      }, 700);
    }
  }, 400);
}


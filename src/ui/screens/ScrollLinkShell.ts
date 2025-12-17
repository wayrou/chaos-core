// src/ui/screens/ScrollLinkShell.ts (Note: File name kept as ScrollLinkShell for code compatibility)

import { getGameState } from "../../state/gameStore";
import { getCurrentOperation } from "../../core/ops";
import { renderOperationMap } from "./OperationMapScreen";
import { renderInventoryScreen } from "./InventoryScreen";


export function renderScrollLinkShell(): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const profile = state.profile;
  const operation = getCurrentOperation(state);

  const callsign = profile.callsign;
  const squad = profile.squadName;
  const opName = operation.codename;
  const opDesc = operation.description;
  const floor = `FLOOR ${operation.currentFloorIndex + 1} / ${operation.floors.length}`;

  root.innerHTML = `
    <div class="scrolllink-shell">

      <div class="scrolllink-topbar">
        <div class="scrolllink-topbar-left">
          <div class="scrolllink-ident">
            <div class="scrolllink-ident-label">CALLSIGN</div>
            <div class="scrolllink-ident-value">${callsign}</div>
          </div>
          <div class="scrolllink-ident">
            <div class="scrolllink-ident-label">SQUAD</div>
            <div class="scrolllink-ident-value">${squad}</div>
          </div>
          <div class="scrolllink-ident">
            <div class="scrolllink-ident-label">OPERATION</div>
            <div class="scrolllink-ident-value">${opName}</div>
          </div>
        </div>

        <div class="scrolllink-topbar-right">
          <div class="scrolllink-tagline">SOLARIS (DEFUNCT) — "WORKING FOR YOU"</div>
          <button class="shell-loadout-btn">LOADOUT</button>
        </div>
      </div>

      <div class="scrolllink-main">
        <div class="window window--terminal">
          <div class="window-header">SCROLLINK OS // OPERATIONS_CONSOLE</div>
          <div class="window-body terminal-body">

            <div class="terminal-line">
              <span class="terminal-prompt">SLK&gt;</span>
              <span class="terminal-text">CURRENT_OP :: ${opName}</span>
            </div>

            <div class="terminal-line">
              <span class="terminal-prompt">SLK&gt;</span>
              <span class="terminal-text">${opDesc}</span>
            </div>

            <div class="terminal-line">
              <span class="terminal-prompt">SLK&gt;</span>
              <span class="terminal-text">${floor}</span>
            </div>

            <div class="terminal-line">--------------------------------------</div>

            <div class="terminal-line">
              <span class="terminal-prompt">SLK&gt;</span>
              <span class="terminal-text">Legacy Solaris Systems — "Working for you."</span>
            </div>

            <div class="terminal-line terminal-line--commands">
              <button class="terminal-command-btn" data-action="start-op">
                START_OP
              </button>
              <span class="terminal-text terminal-text--hint">← Begin operation map routing</span>
            </div>

          </div>
        </div>

        <div class="window window--status">
          <div class="window-header">MISSION_STATUS</div>
          <div class="window-body">
            Stub status panel – loadout summary will go here.
          </div>
        </div>
      </div>

    </div>
  `;

  root
    .querySelector(".terminal-command-btn")
    ?.addEventListener("click", () => renderOperationMap());

  root
    .querySelector(".shell-loadout-btn")
    ?.addEventListener("click", () => renderInventoryScreen());
}

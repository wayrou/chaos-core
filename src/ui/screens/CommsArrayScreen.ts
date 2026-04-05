// ============================================================================
// CHAOS CORE - COMMS ARRAY SCREEN
// Training battles and future multiplayer features
// ============================================================================

import { getGameState } from "../../state/gameStore";
import { createTrainingEncounter, TrainingConfig } from "../../core/trainingEncounter";
import { createBattleFromEncounter } from "../../core/battleFromEncounter";
import { updateGameState } from "../../state/gameStore";
import { renderBattleScreen } from "./BattleScreen";
import { abandonRun, startOperationRun, syncCampaignToGameState } from "../../core/campaignManager";
import { Difficulty, EnemyDensity } from "../../core/campaign";
import { SESSION_PLAYER_SLOTS, TheaterSprawlDirection, type SessionPlayerSlot } from "../../core/types";
import { ensureOperationHasTheater } from "../../core/theaterSystem";
import { renderLoadoutScreen } from "./LoadoutScreen";
import {
  applySquadMatchCommand,
  canStartSquadDraft,
  clearSquadMatchState,
  getConnectedSquadMembers,
  getNextOpenSquadSlot,
  getSquadLobbySummary,
  loadSquadMatchState,
  parseSquadMatchSnapshot,
  rehydrateSquadMatchState,
  saveSquadMatchState,
  serializeSquadMatchSnapshot,
  type SquadMatchState,
} from "../../core/squadOnline";
import {
  BaseCampReturnTo,
  getBaseCampReturnLabel,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";
import { showSystemPing } from "../components/systemPing";

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

type CustomOperationConfig = {
  difficulty: Difficulty;
  floors: number;
  enemyDensity: EnemyDensity;
  sprawlDirection: TheaterSprawlDirection;
};

let customOperationConfig: CustomOperationConfig = {
  difficulty: "normal",
  floors: 3,
  enemyDensity: "normal",
  sprawlDirection: "east",
};

type SquadPreviewConfig = {
  hostCallsign: string;
  peerCallsign: string;
  maxPlayers: number;
  snapshotDraft: string;
};

let squadPreviewConfig: SquadPreviewConfig = {
  hostCallsign: "",
  peerCallsign: "Remote Echo",
  maxPlayers: 2,
  snapshotDraft: "",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSquadMatchState(): SquadMatchState | null {
  return loadSquadMatchState();
}

function renderSquadOnlineSection(): string {
  const state = getGameState();
  const match = getSquadMatchState();
  const profileCallsign = state.profile.callsign || "HOST";
  const hostCallsign = squadPreviewConfig.hostCallsign || profileCallsign;
  const peerCallsign = squadPreviewConfig.peerCallsign || "Remote Echo";
  const connectedMembers = match ? getConnectedSquadMembers(match) : [];
  const snapshotText = squadPreviewConfig.snapshotDraft || (match ? serializeSquadMatchSnapshot(match) : "");
  const nextOpenSlot = match ? getNextOpenSquadSlot(match) : null;

  return `
    <div class="comms-array-section">
      <div class="comms-array-section-header">
        <h2 class="section-title">SQUAD ONLINE</h2>
        <div class="section-status section-status--active">${match ? match.phase.toUpperCase() : "PREVIEW"}</div>
      </div>
      <div class="comms-array-section-body">
        <p class="section-description">
          Host-authoritative Squad skirmish lobby and draft state. Transport is still running as a local protocol preview, but the contracts now support 2-4 linked player slots and serializable match snapshots.
        </p>

        <div class="training-config">
          <div class="config-row">
            <label class="config-label">Host Callsign:</label>
            <input class="config-select" id="squadHostCallsignInput" value="${escapeHtml(hostCallsign)}" />
          </div>

          <div class="config-row">
            <label class="config-label">Linked Peer:</label>
            <input class="config-select" id="squadPeerCallsignInput" value="${escapeHtml(peerCallsign)}" />
          </div>

          <div class="config-row">
            <label class="config-label">Lobby Size:</label>
            <select class="config-select" id="squadMaxPlayersSelect">
              ${[2, 3, 4].map((count) => (
                `<option value="${count}" ${(match?.maxPlayers ?? squadPreviewConfig.maxPlayers) === count ? "selected" : ""}>${count}</option>`
              )).join("")}
            </select>
          </div>

          <div class="config-note">
            <span class="note-icon">i</span>
            <span>${escapeHtml(getSquadLobbySummary(match))}</span>
          </div>
        </div>

        <div class="comms-array-button-group">
          ${!match ? `
            <button class="comms-array-btn comms-array-btn--primary" id="hostSessionBtn">
              HOST SQUAD LOBBY
            </button>
          ` : `
            <button class="comms-array-btn ${nextOpenSlot ? "comms-array-btn--primary" : "comms-array-btn--disabled"}" id="joinSessionBtn" ${nextOpenSlot ? "" : "disabled"}>
              LINK ${nextOpenSlot ?? "FULL"}
            </button>
            <button class="comms-array-btn ${canStartSquadDraft(match) ? "comms-array-btn--primary" : "comms-array-btn--disabled"}" id="startSquadDraftBtn" ${canStartSquadDraft(match) ? "" : "disabled"}>
              START DRAFT
            </button>
            <button class="comms-array-btn" id="copySquadSnapshotBtn">
              COPY SNAPSHOT
            </button>
            <button class="comms-array-btn" id="resetSquadMatchBtn">
              RESET SESSION
            </button>
          `}
        </div>

        ${match ? `
          <div class="settings-category" style="margin-top: 1rem;">
            <div class="settings-category-header">LOBBY MEMBERS</div>
            <div class="bindings-list">
              ${SESSION_PLAYER_SLOTS.map((slot) => {
                const member = match.members[slot];
                const picks = match.draft?.picks.filter((pick) => pick.slot === slot).length ?? 0;
                const isConfirmed = match.confirmation.confirmedSlots.includes(slot);
                return `
                  <div class="binding-item">
                    <span class="binding-action">${slot}${member ? ` // ${escapeHtml(member.callsign)}` : " // OPEN"}</span>
                    <span class="binding-keys">${member ? `${member.authorityRole.toUpperCase()} // ${member.presence.toUpperCase()} // ${member.ready ? "READY" : "STAGING"}${match.phase !== "lobby" ? ` // PICKS ${picks}` : ""}${match.phase === "confirmation" ? ` // ${isConfirmed ? "CONFIRMED" : "AWAITING CONFIRM"}` : ""}` : "Awaiting link"}</span>
                    ${member ? `
                      <button class="comms-array-btn" type="button" data-squad-ready-toggle="${slot}">${member.ready ? "UNREADY" : "READY"}</button>
                      ${slot !== match.hostSlot ? `<button class="comms-array-btn" type="button" data-squad-remove="${slot}">DROP</button>` : ""}
                      ${match.phase === "confirmation" && !isConfirmed ? `<button class="comms-array-btn comms-array-btn--primary" type="button" data-squad-confirm="${slot}">CONFIRM</button>` : ""}
                    ` : ""}
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          ${match.phase === "draft" && match.draft ? `
            <div class="settings-category" style="margin-top: 1rem;">
              <div class="settings-category-header">DRAFT POOL // CURRENT PICK ${match.draft.currentPickSlot ?? "COMPLETE"}</div>
              <div class="bindings-list">
                ${match.draft.pool.slice(0, 12).map((option) => `
                  <div class="binding-item">
                    <span class="binding-action">${escapeHtml(option.label)}</span>
                    <span class="binding-keys">${option.category.toUpperCase()} // ${escapeHtml(option.summary)}</span>
                    <button class="comms-array-btn comms-array-btn--primary" type="button" data-squad-pick="${option.id}" ${match.draft?.currentPickSlot ? "" : "disabled"}>
                      PICK FOR ${match.draft?.currentPickSlot ?? "LOCKED"}
                    </button>
                  </div>
                `).join("")}
              </div>
            </div>
          ` : ""}

          ${match.phase === "battle" ? `
            <div class="settings-category" style="margin-top: 1rem;">
              <div class="settings-category-header">BATTLE HANDOFF</div>
              <div class="config-note">
                <span class="note-icon">i</span>
                <span>Draft and confirmation are complete. The next milestone will hand this match snapshot to the transport and tactical battle runtime.</span>
              </div>
              <div class="comms-array-button-group">
                ${connectedMembers.map((member) => `
                  <button class="comms-array-btn comms-array-btn--primary" type="button" data-squad-complete="${member.slot}">
                    ${escapeHtml(member.callsign)} WINS
                  </button>
                `).join("")}
              </div>
            </div>
          ` : ""}

          ${match.phase === "result" && match.result ? `
            <div class="settings-category" style="margin-top: 1rem;">
              <div class="settings-category-header">MATCH RESULT</div>
              <div class="config-note">
                <span class="note-icon">OK</span>
                <span>${escapeHtml(match.result.winnerSlots.join(", "))} // ${escapeHtml(match.result.reason)}</span>
              </div>
            </div>
          ` : ""}
        ` : ""}

        <div class="settings-category" style="margin-top: 1rem;">
          <div class="settings-category-header">MATCH SNAPSHOT</div>
          <textarea class="setting-select" id="squadSnapshotText" style="min-height: 180px; width: 100%; resize: vertical;">${escapeHtml(snapshotText)}</textarea>
          <div class="comms-array-button-group" style="margin-top: 0.75rem;">
            <button class="comms-array-btn" id="importSquadSnapshotBtn">
              IMPORT SNAPSHOT
            </button>
            <button class="comms-array-btn" id="clearSquadSnapshotBtn">
              CLEAR SNAPSHOT TEXT
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function commitSquadMatchUpdate(
  match: SquadMatchState | null,
  returnTo: BaseCampReturnTo | "operation",
  message?: string,
  messageType: "success" | "error" | "info" = "info",
): void {
  if (match) {
    saveSquadMatchState(match);
    squadPreviewConfig.snapshotDraft = serializeSquadMatchSnapshot(match);
  } else {
    clearSquadMatchState();
  }

  if (message) {
    showNotification(message, messageType);
  }
  renderCommsArrayScreen(returnTo);
}

export function renderCommsArrayScreen(returnTo: BaseCampReturnTo | "operation" = "basecamp"): void {
  const app = document.getElementById("app");
  if (!app) return;
  
  const backButtonText = returnTo === "operation" ? "DUNGEON MAP" : getBaseCampReturnLabel(returnTo);
  
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
      <!-- Content -->
      <div class="comms-array-content">
        ${renderSquadOnlineSection()}
        
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

        <div class="comms-array-section">
          <div class="comms-array-section-header">
            <h2 class="section-title">CUSTOM OPERATIONS</h2>
            <div class="section-status section-status--active">DEPLOYABLE</div>
          </div>
          <div class="comms-array-section-body">
            <p class="section-description">
              Spin up a bespoke procedural theater run and deploy through loadout. Configure floor count, threat pressure, and sprawl direction here.
            </p>

            <div class="training-config">
              <div class="config-row">
                <label class="config-label">Difficulty:</label>
                <select class="config-select" id="customDifficultySelect">
                  <option value="easy" ${customOperationConfig.difficulty === "easy" ? "selected" : ""}>Easy</option>
                  <option value="normal" ${customOperationConfig.difficulty === "normal" ? "selected" : ""}>Normal</option>
                  <option value="hard" ${customOperationConfig.difficulty === "hard" ? "selected" : ""}>Hard</option>
                </select>
              </div>

              <div class="config-row">
                <label class="config-label">Floors:</label>
                <select class="config-select" id="customFloorsSelect">
                  ${[1, 2, 3, 4, 5, 6, 7, 8].map((floors) => (
                    `<option value="${floors}" ${customOperationConfig.floors === floors ? "selected" : ""}>${floors}</option>`
                  )).join("")}
                </select>
              </div>

              <div class="config-row">
                <label class="config-label">Enemy Density:</label>
                <select class="config-select" id="customDensitySelect">
                  <option value="low" ${customOperationConfig.enemyDensity === "low" ? "selected" : ""}>Low</option>
                  <option value="normal" ${customOperationConfig.enemyDensity === "normal" ? "selected" : ""}>Normal</option>
                  <option value="high" ${customOperationConfig.enemyDensity === "high" ? "selected" : ""}>High</option>
                </select>
              </div>

              <div class="config-row">
                <label class="config-label">Sprawl Direction:</label>
                <select class="config-select" id="customSprawlSelect">
                  ${[
                    ["north", "North"],
                    ["northeast", "Northeast"],
                    ["east", "East"],
                    ["southeast", "Southeast"],
                    ["south", "South"],
                    ["southwest", "Southwest"],
                    ["west", "West"],
                    ["northwest", "Northwest"],
                  ].map(([value, label]) => (
                    `<option value="${value}" ${customOperationConfig.sprawlDirection === value ? "selected" : ""}>${label}</option>`
                  )).join("")}
                </select>
              </div>
            </div>

            <div class="comms-array-button-group">
              <button class="comms-array-btn comms-array-btn--primary" id="startCustomOperationBtn">
                DEPLOY CUSTOM OPERATION
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  attachCommsArrayListeners(returnTo);
}

function attachCommsArrayListeners(returnTo: BaseCampReturnTo | "operation"): void {
  // Back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.onclick = () => {
      unregisterBaseCampReturnHotkey("comms-array-screen");
      if (returnTo === "operation") {
        // Return to operation map if needed
        import("./OperationMapScreen").then(({ renderOperationMapScreen }) => {
          renderOperationMapScreen();
        });
      } else {
        returnFromBaseCampScreen(returnTo);
      }
    };
  }

  if (returnTo !== "operation") {
    registerBaseCampReturnHotkey("comms-array-screen", returnTo, { allowFieldEKey: true, activeSelector: ".comms-array-root" });
  } else {
    unregisterBaseCampReturnHotkey("comms-array-screen");
  }
  
  const hostCallsignInput = document.getElementById("squadHostCallsignInput") as HTMLInputElement | null;
  const peerCallsignInput = document.getElementById("squadPeerCallsignInput") as HTMLInputElement | null;
  const squadMaxPlayersSelect = document.getElementById("squadMaxPlayersSelect") as HTMLSelectElement | null;
  const squadSnapshotText = document.getElementById("squadSnapshotText") as HTMLTextAreaElement | null;

  if (hostCallsignInput) {
    hostCallsignInput.addEventListener("input", () => {
      squadPreviewConfig.hostCallsign = hostCallsignInput.value;
    });
  }

  if (peerCallsignInput) {
    peerCallsignInput.addEventListener("input", () => {
      squadPreviewConfig.peerCallsign = peerCallsignInput.value;
    });
  }

  if (squadMaxPlayersSelect) {
    squadMaxPlayersSelect.addEventListener("change", () => {
      squadPreviewConfig.maxPlayers = Math.max(2, Math.min(4, parseInt(squadMaxPlayersSelect.value, 10) || 2));
    });
  }

  if (squadSnapshotText) {
    squadSnapshotText.addEventListener("input", () => {
      squadPreviewConfig.snapshotDraft = squadSnapshotText.value;
    });
  }

  const hostBtn = document.getElementById("hostSessionBtn");
  if (hostBtn) {
    hostBtn.onclick = () => {
      const nextMatch = applySquadMatchCommand(null, {
        type: "create_lobby",
        callsign: squadPreviewConfig.hostCallsign || getGameState().profile.callsign || "HOST",
        maxPlayers: squadPreviewConfig.maxPlayers,
      });
      commitSquadMatchUpdate(nextMatch, returnTo, "Squad lobby initialized.", "success");
    };
  }

  const joinBtn = document.getElementById("joinSessionBtn");
  if (joinBtn) {
    joinBtn.onclick = () => {
      const currentMatch = getSquadMatchState();
      if (!currentMatch) {
        showNotification("Create a lobby before linking a peer.", "error");
        return;
      }
      const nextSlot = getNextOpenSquadSlot(currentMatch);
      if (!nextSlot) {
        showNotification("Lobby is already at capacity.", "info");
        return;
      }
      const nextMatch = applySquadMatchCommand(currentMatch, {
        type: "join_lobby",
        callsign: squadPreviewConfig.peerCallsign || nextSlot,
        slot: nextSlot,
      });
      commitSquadMatchUpdate(nextMatch, returnTo, `${nextSlot} linked to the preview lobby.`, "success");
    };
  }

  const resetSquadMatchBtn = document.getElementById("resetSquadMatchBtn");
  if (resetSquadMatchBtn) {
    resetSquadMatchBtn.onclick = () => {
      squadPreviewConfig.snapshotDraft = "";
      commitSquadMatchUpdate(null, returnTo, "Squad preview session cleared.", "info");
    };
  }

  const startSquadDraftBtn = document.getElementById("startSquadDraftBtn");
  if (startSquadDraftBtn) {
    startSquadDraftBtn.onclick = () => {
      const currentMatch = getSquadMatchState();
      if (!currentMatch) {
        return;
      }
      const nextMatch = applySquadMatchCommand(currentMatch, { type: "start_draft" });
      commitSquadMatchUpdate(nextMatch, returnTo, "Draft phase live.", "success");
    };
  }

  const copySquadSnapshotBtn = document.getElementById("copySquadSnapshotBtn");
  if (copySquadSnapshotBtn) {
    copySquadSnapshotBtn.onclick = async () => {
      const currentMatch = getSquadMatchState();
      if (!currentMatch) {
        showNotification("No match snapshot available.", "error");
        return;
      }
      const snapshot = serializeSquadMatchSnapshot(currentMatch);
      squadPreviewConfig.snapshotDraft = snapshot;
      try {
        await navigator.clipboard.writeText(snapshot);
        showNotification("Match snapshot copied.", "success");
      } catch {
        showNotification("Snapshot copied into the text pane.", "info");
        renderCommsArrayScreen(returnTo);
      }
    };
  }

  const importSquadSnapshotBtn = document.getElementById("importSquadSnapshotBtn");
  if (importSquadSnapshotBtn) {
    importSquadSnapshotBtn.onclick = () => {
      const snapshotText = squadPreviewConfig.snapshotDraft || squadSnapshotText?.value || "";
      const parsedSnapshot = parseSquadMatchSnapshot(snapshotText);
      if (!parsedSnapshot) {
        showNotification("Snapshot import failed. Check protocol version and JSON shape.", "error");
        return;
      }
      const nextMatch = rehydrateSquadMatchState(parsedSnapshot);
      commitSquadMatchUpdate(nextMatch, returnTo, "Snapshot imported into the preview session.", "success");
    };
  }

  const clearSquadSnapshotBtn = document.getElementById("clearSquadSnapshotBtn");
  if (clearSquadSnapshotBtn) {
    clearSquadSnapshotBtn.onclick = () => {
      squadPreviewConfig.snapshotDraft = "";
      if (squadSnapshotText) {
        squadSnapshotText.value = "";
      }
    };
  }

  document.querySelectorAll<HTMLElement>("[data-squad-ready-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = button.getAttribute("data-squad-ready-toggle") as SessionPlayerSlot | null;
      const currentMatch = getSquadMatchState();
      if (!slot || !currentMatch) {
        return;
      }
      const nextMatch = applySquadMatchCommand(currentMatch, { type: "set_ready", slot });
      commitSquadMatchUpdate(nextMatch, returnTo);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-squad-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = button.getAttribute("data-squad-remove") as SessionPlayerSlot | null;
      const currentMatch = getSquadMatchState();
      if (!slot || !currentMatch) {
        return;
      }
      const nextMatch = applySquadMatchCommand(currentMatch, { type: "leave_lobby", slot });
      commitSquadMatchUpdate(nextMatch, returnTo, `${slot} dropped from the lobby.`, "info");
    });
  });

  document.querySelectorAll<HTMLElement>("[data-squad-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      const optionId = button.getAttribute("data-squad-pick");
      const currentMatch = getSquadMatchState();
      const currentSlot = currentMatch?.draft?.currentPickSlot ?? null;
      if (!optionId || !currentMatch || !currentSlot) {
        return;
      }
      const nextMatch = applySquadMatchCommand(currentMatch, {
        type: "make_pick",
        slot: currentSlot,
        optionId,
      });
      commitSquadMatchUpdate(nextMatch, returnTo);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-squad-confirm]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = button.getAttribute("data-squad-confirm") as SessionPlayerSlot | null;
      const currentMatch = getSquadMatchState();
      if (!slot || !currentMatch) {
        return;
      }
      const nextMatch = applySquadMatchCommand(currentMatch, {
        type: "confirm_loadout",
        slot,
      });
      commitSquadMatchUpdate(nextMatch, returnTo, `${slot} confirmed loadout handoff.`, "success");
    });
  });

  document.querySelectorAll<HTMLElement>("[data-squad-complete]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = button.getAttribute("data-squad-complete") as SessionPlayerSlot | null;
      const currentMatch = getSquadMatchState();
      if (!slot || !currentMatch) {
        return;
      }
      const nextMatch = applySquadMatchCommand(currentMatch, {
        type: "complete_match",
        winnerSlots: [slot],
        reason: "Preview battle result recorded from Comms Array.",
      });
      commitSquadMatchUpdate(nextMatch, returnTo, `${slot} recorded as the winner.`, "success");
    });
  });
  
  // Training config controls
  const gridWidthSelect = document.getElementById("gridWidthSelect") as HTMLSelectElement;
  const gridHeightSelect = document.getElementById("gridHeightSelect") as HTMLSelectElement;
  const difficultySelect = document.getElementById("difficultySelect") as HTMLSelectElement;
  const customDifficultySelect = document.getElementById("customDifficultySelect") as HTMLSelectElement | null;
  const customFloorsSelect = document.getElementById("customFloorsSelect") as HTMLSelectElement | null;
  const customDensitySelect = document.getElementById("customDensitySelect") as HTMLSelectElement | null;
  const customSprawlSelect = document.getElementById("customSprawlSelect") as HTMLSelectElement | null;
  
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

  if (customDifficultySelect) {
    customDifficultySelect.addEventListener("change", () => {
      customOperationConfig.difficulty = customDifficultySelect.value as Difficulty;
    });
  }

  if (customFloorsSelect) {
    customFloorsSelect.addEventListener("change", () => {
      customOperationConfig.floors = Math.max(1, parseInt(customFloorsSelect.value, 10) || 1);
    });
  }

  if (customDensitySelect) {
    customDensitySelect.addEventListener("change", () => {
      customOperationConfig.enemyDensity = customDensitySelect.value as EnemyDensity;
    });
  }

  if (customSprawlSelect) {
    customSprawlSelect.addEventListener("change", () => {
      customOperationConfig.sprawlDirection = customSprawlSelect.value as TheaterSprawlDirection;
    });
  }
  
  // Start Training button
  const startTrainingBtn = document.getElementById("startTrainingBtn");
  if (startTrainingBtn) {
    startTrainingBtn.onclick = () => {
      startTrainingBattle(returnTo);
    };
  }

  const startCustomOperationBtn = document.getElementById("startCustomOperationBtn");
  if (startCustomOperationBtn) {
    startCustomOperationBtn.onclick = () => {
      startCustomOperation();
    };
  }
}

function startTrainingBattle(returnTo: BaseCampReturnTo | "operation"): void {
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
    currentBattle: battle,
    phase: "battle",
  }));
  
  // Render battle screen
  renderBattleScreen();
}

function startCustomOperation(): void {
  try {
    abandonRun();
  } catch {
    // No active run to clear.
  }

  startOperationRun(
    "op_custom",
    customOperationConfig.difficulty,
    customOperationConfig.floors,
    customOperationConfig.enemyDensity,
    customOperationConfig.sprawlDirection,
  );
  syncCampaignToGameState();

  const operation = ensureOperationHasTheater(getGameState().operation);
  if (!operation) {
    showNotification("Failed to initialize custom operation", "error");
    return;
  }

  updateGameState((state) => ({
    ...state,
    phase: "loadout",
    operation: {
      ...operation,
      launchSource: "comms",
    },
  }));

  unregisterBaseCampReturnHotkey("comms-array-screen");
  renderLoadoutScreen();
  showNotification(
    `Custom operation ready // ${customOperationConfig.floors} floor${customOperationConfig.floors === 1 ? "" : "s"} // ${customOperationConfig.enemyDensity.toUpperCase()} density`,
    "success",
  );
}

export function getLastTrainingConfig(): TrainingConfig | null {
  return lastTrainingConfig;
}

export function clearLastTrainingConfig(): void {
  lastTrainingConfig = null;
}

function showNotification(message: string, type: "success" | "error" | "info"): void {
  showSystemPing({
    title: type === "error" ? "COMMS ERROR" : type === "success" ? "COMMS READY" : "COMMS NOTICE",
    message,
    type,
    channel: "comms-array",
  });
  return;

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

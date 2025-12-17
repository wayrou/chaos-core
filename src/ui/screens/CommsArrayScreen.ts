// ============================================================================
// COMMS ARRAY SCREEN
// Tactical uplink hub for Training Sim and (future) online multiplayer
// ============================================================================

import { renderFieldScreen } from "../../field/FieldScreen";
import { renderTrainingSimSetupScreen } from "./TrainingSimSetupScreen";

/**
 * Render Comms Array screen
 * @param returnTo - Where to return when closing ("field" or "base_camp")
 */
export function renderCommsArrayScreen(returnTo: "field" | "base_camp" = "field"): void {
  const root = document.getElementById("app");
  if (!root) {
    console.error("[COMMS] Missing #app element");
    return;
  }

  root.innerHTML = `
    <div class="comms-array-root">
      <div class="comms-array-panel">
        <!-- Header -->
        <div class="comms-array-header">
          <div class="comms-array-title">COMMS ARRAY</div>
          <div class="comms-array-subtitle">TACTICAL UPLINK</div>
          <button class="comms-array-close" id="closeBtn">✕ CLOSE</button>
        </div>

        <!-- Status -->
        <div class="comms-array-status">
          <div class="comms-array-status-label">LINK STATUS:</div>
          <div class="comms-array-status-value comms-array-status--offline">OFFLINE</div>
        </div>

        <!-- Flavor text -->
        <div class="comms-array-flavor">
          Supply manifests update as caravans come and go. Uplink window unstable. Authenticate and transmit.
        </div>

        <!-- Divider -->
        <div class="comms-array-divider"></div>

        <!-- Main menu options -->
        <div class="comms-array-menu">
          <button class="comms-array-btn comms-array-btn--primary" id="trainingSimBtn">
            <span class="comms-array-btn-icon">⚔️</span>
            <span class="comms-array-btn-label">TRAINING SIM</span>
            <span class="comms-array-btn-desc">Configure simulated encounters</span>
          </button>

          <button class="comms-array-btn comms-array-btn--disabled" id="quickMatchBtn" disabled>
            <span class="comms-array-btn-icon">🎯</span>
            <span class="comms-array-btn-label">QUICK MATCH</span>
            <span class="comms-array-btn-desc">Join random encounter</span>
            <span class="comms-array-btn-soon">COMING SOON</span>
          </button>

          <button class="comms-array-btn comms-array-btn--disabled" id="hostOpBtn" disabled>
            <span class="comms-array-btn-icon">📡</span>
            <span class="comms-array-btn-label">HOST OPERATION</span>
            <span class="comms-array-btn-desc">Create multiplayer session</span>
            <span class="comms-array-btn-soon">COMING SOON</span>
          </button>

          <button class="comms-array-btn comms-array-btn--disabled" id="joinOpBtn" disabled>
            <span class="comms-array-btn-icon">🔗</span>
            <span class="comms-array-btn-label">JOIN OPERATION</span>
            <span class="comms-array-btn-desc">Connect to existing session</span>
            <span class="comms-array-btn-soon">COMING SOON</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  attachEventListeners(returnTo);
}

function attachEventListeners(returnTo: "field" | "base_camp"): void {
  const closeBtn = document.getElementById("closeBtn");
  const trainingSimBtn = document.getElementById("trainingSimBtn");
  const quickMatchBtn = document.getElementById("quickMatchBtn");
  const hostOpBtn = document.getElementById("hostOpBtn");
  const joinOpBtn = document.getElementById("joinOpBtn");

  // Close button
  closeBtn?.addEventListener("click", () => {
    if (returnTo === "field") {
      renderFieldScreen("base_camp");
    } else {
      // Future: handle other return destinations
      renderFieldScreen("base_camp");
    }
  });

  // Training Sim button
  trainingSimBtn?.addEventListener("click", () => {
    renderTrainingSimSetupScreen("comms_array");
  });

  // Disabled buttons - show coming soon message
  const disabledButtons = [quickMatchBtn, hostOpBtn, joinOpBtn];
  disabledButtons.forEach(btn => {
    btn?.addEventListener("click", (e) => {
      e.preventDefault();
      showComingSoonToast();
    });
  });
}

/**
 * Show a small toast notification for disabled features
 */
function showComingSoonToast(): void {
  const existing = document.querySelector(".comms-array-toast");
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement("div");
  toast.className = "comms-array-toast";
  toast.textContent = "Online functions coming soon.";
  document.body.appendChild(toast);

  // Auto-remove after 2 seconds
  setTimeout(() => {
    toast.classList.add("comms-array-toast--fade");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

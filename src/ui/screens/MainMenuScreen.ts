// ============================================================================
// CHAOS CORE - MAIN MENU SCREEN (Headline 12 - Standalone Version)
// Works without save system files - add them later for full functionality
// ============================================================================

import { resetToNewGame } from "../../state/gameStore";
import { renderBaseCampScreen } from "./BaseCampScreen";

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

export function renderMainMenu(): void {
  const root = document.getElementById("app");
  if (!root) {
    console.error("Missing #app element in index.html");
    return;
  }

  root.innerHTML = /*html*/ `
    <div class="mainmenu-root">
      <!-- Background effects -->
      <div class="mainmenu-bg-effects">
        <div class="mainmenu-scanline"></div>
        <div class="mainmenu-vignette"></div>
      </div>
      
      <div class="mainmenu-card">
        <!-- Logo -->
        <div class="mainmenu-logo-container">
          <div class="mainmenu-logo">CHAOS CORE</div>
          <div class="mainmenu-logo-glow"></div>
        </div>
        <div class="mainmenu-subtitle">COMPANY OF QUILLS TACTICAL INTERFACE</div>

        <div class="mainmenu-divider"></div>

        <!-- Main Buttons -->
        <div class="mainmenu-buttons">
          <button class="mainmenu-btn mainmenu-btn-primary" data-action="new-op">
            <span class="btn-icon">+</span>
            <span class="btn-text">NEW OPERATION</span>
          </button>

          <button class="mainmenu-btn mainmenu-btn-secondary" data-action="continue" disabled>
            <span class="btn-icon">▶</span>
            <span class="btn-text">CONTINUE</span>
            <span class="btn-subtitle">Coming Soon</span>
          </button>

          <button class="mainmenu-btn mainmenu-btn-secondary" data-action="settings" disabled>
            <span class="btn-icon">⚙</span>
            <span class="btn-text">SETTINGS</span>
            <span class="btn-subtitle">Coming Soon</span>
          </button>

          <button class="mainmenu-btn mainmenu-btn-tertiary" data-action="exit">
            <span class="btn-icon">✕</span>
            <span class="btn-text">EXIT</span>
          </button>
        </div>

        <div class="mainmenu-footer">
          <span>SCROLLINK OS BUILD 0.1.0</span>
          <span class="mainmenu-separator">•</span>
          <span>ARDCYTECH PROTOTYPE</span>
        </div>
      </div>
    </div>
  `;

  attachMenuListeners();
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------------------

function attachMenuListeners(): void {
  const root = document.getElementById("app");
  if (!root) return;

  // New Operation button
  const newOpBtn = root.querySelector<HTMLButtonElement>('button[data-action="new-op"]');
  if (newOpBtn) {
    newOpBtn.addEventListener("click", () => {
      resetToNewGame();
      renderBaseCampScreen();
    });
  }

  // Exit button
  const exitBtn = root.querySelector<HTMLButtonElement>('button[data-action="exit"]');
  if (exitBtn) {
    exitBtn.addEventListener("click", () => {
      const anyWindow = window as any;
      if (anyWindow.__TAURI__?.window) {
        anyWindow.__TAURI__.window.getCurrent().close();
      } else {
        console.log("Exit requested (no Tauri window context)");
      }
    });
  }
}

// Export for initial call
export { renderMainMenu as default };
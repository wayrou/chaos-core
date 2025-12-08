// ============================================================================
// CHAOS CORE - MAIN MENU SCREEN (Headline 12bza)
// src/ui/screens/MainMenuScreen.ts
// Logo positioned above card, larger size
// ============================================================================

import { getGameState, setGameState, resetToNewGame } from "../../state/gameStore";
import { renderSettingsScreen } from "./SettingsScreen";
import { renderFieldScreen } from "../../field/FieldScreen";
import { renderBaseCampScreen } from "./BaseCampScreen";
import {
  canContinue,
  loadMostRecent,
  listSaves,
  SaveInfo,
  formatSaveTimestamp,
  getSaveSlotName,
  enableAutosave,
  saveGame,
  SAVE_SLOTS,
  SaveSlot,
  loadGame,
} from "../../core/saveSystem";
import { initializeSettings } from "../../core/settings";
import { initControllerSupport, updateFocusableElements } from "../../core/controllerSupport";

// ----------------------------------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------------------------------

let isInitialized = false;

async function initializeGame(): Promise<void> {
  if (isInitialized) return;
  
  console.log("[INIT] Initializing Chaos Core...");
  
  await initializeSettings();
  initControllerSupport();
  
  isInitialized = true;
  console.log("[INIT] Initialization complete");
}

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

export async function renderMainMenu(): Promise<void> {
  await initializeGame();
  
  const root = document.getElementById("app");
  if (!root) {
    console.error("Missing #app element");
    return;
  }
  
  const hasContinue = await canContinue();
  const saves = await listSaves();
  const mostRecentSave = saves.length > 0 ? saves[0] : null;
  
  root.innerHTML = /*html*/ `
    <div class="mainmenu-root">
      <div class="mainmenu-bg-effects">
        <div class="mainmenu-scanline"></div>
        <div class="mainmenu-vignette"></div>
      </div>
      
      <!-- Main content wrapper - centers everything vertically -->
      <div class="mainmenu-content">
        
        <!-- Logo ABOVE the card -->
        <div class="mainmenu-logo-container">
          <img 
            id="logoImage"
            alt="Chaos Core" 
            class="mainmenu-logo-image"
          />
          <!-- Fallback text logo if image fails to load -->
          <div id="logoFallback" class="mainmenu-logo mainmenu-logo-fallback" style="display: none;">CHAOS CORE</div>
          <div class="mainmenu-logo-glow"></div>
        </div>
        
        <div class="mainmenu-subtitle">COMPANY OF QUILLS TACTICAL INTERFACE</div>
      
        <!-- Card with buttons only -->
        <div class="mainmenu-card">
          <div class="mainmenu-buttons">
            ${hasContinue ? `
              <button class="mainmenu-btn mainmenu-btn-primary" data-action="continue">
                <span class="btn-icon">▶</span>
                <span class="btn-text">CONTINUE</span>
                ${mostRecentSave ? `
                  <span class="btn-subtitle">${formatSaveTimestamp(mostRecentSave.timestamp)}</span>
                ` : ''}
              </button>
            ` : ''}

            <button class="mainmenu-btn ${hasContinue ? 'mainmenu-btn-secondary' : 'mainmenu-btn-primary'}" data-action="new-op">
              <span class="btn-icon">+</span>
              <span class="btn-text">NEW OPERATION</span>
            </button>

            ${saves.length > 0 ? `
              <button class="mainmenu-btn mainmenu-btn-secondary" data-action="load">
                <span class="btn-icon">📂</span>
                <span class="btn-text">LOAD GAME</span>
              </button>
            ` : ''}

            <button class="mainmenu-btn mainmenu-btn-secondary" data-action="settings">
              <span class="btn-icon">⚙</span>
              <span class="btn-text">SETTINGS</span>
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
      
      <div class="mainmenu-modal" id="loadModal" style="display: none;">
        <div class="mainmenu-modal-content">
          <div class="mainmenu-modal-header">
            <span class="modal-title">LOAD GAME</span>
            <button class="modal-close" id="closeLoadModal">✕</button>
          </div>
          <div class="mainmenu-modal-body" id="loadModalBody"></div>
        </div>
      </div>
      
      <div class="mainmenu-modal" id="saveModal" style="display: none;">
        <div class="mainmenu-modal-content">
          <div class="mainmenu-modal-header">
            <span class="modal-title">SAVE GAME</span>
            <button class="modal-close" id="closeSaveModal">✕</button>
          </div>
          <div class="mainmenu-modal-body" id="saveModalBody"></div>
        </div>
      </div>
    </div>
  `;

  // Try to load the logo with multiple path attempts
  tryLoadLogo();
  
  attachMenuListeners(saves);
  updateFocusableElements();
}

// ----------------------------------------------------------------------------
// LOGO LOADING WITH FALLBACKS
// ----------------------------------------------------------------------------

function tryLoadLogo(): void {
  const logoImg = document.getElementById("logoImage") as HTMLImageElement;
  const logoFallback = document.getElementById("logoFallback");
  
  if (!logoImg || !logoFallback) return;
  
  // List of paths to try (in order)
  const pathsToTry = [
    "/assets/cc_logo.png",
    "/assets/CC_logo.png",
    "./assets/cc_logo.png",
    "./assets/CC_logo.png",
    "assets/cc_logo.png",
    "assets/CC_logo.png",
    "/cc_logo.png",
    "/CC_logo.png",
  ];
  
  let currentPathIndex = 0;
  
  const tryNextPath = () => {
    if (currentPathIndex >= pathsToTry.length) {
      console.error("[LOGO] All paths failed. Tried:", pathsToTry);
      logoImg.style.display = "none";
      logoFallback.style.display = "block";
      return;
    }
    
    const path = pathsToTry[currentPathIndex];
    console.log(`[LOGO] Trying path ${currentPathIndex + 1}/${pathsToTry.length}: ${path}`);
    logoImg.src = path;
    currentPathIndex++;
  };
  
  logoImg.onload = () => {
    console.log(`[LOGO] ✓ Successfully loaded from: ${logoImg.src}`);
    logoImg.style.display = "block";
    logoFallback.style.display = "none";
  };
  
  logoImg.onerror = () => {
    console.warn(`[LOGO] ✗ Failed to load from: ${logoImg.src}`);
    tryNextPath();
  };
  
  tryNextPath();
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------------------

function attachMenuListeners(saves: SaveInfo[]): void {
  const root = document.getElementById("app");
  if (!root) return;
  
  // Continue button
  const continueBtn = root.querySelector<HTMLButtonElement>('button[data-action="continue"]');
  if (continueBtn) {
    continueBtn.addEventListener("click", async () => {
      continueBtn.disabled = true;
      const originalHtml = continueBtn.innerHTML;
      continueBtn.innerHTML = `<span class="btn-text">Loading...</span>`;
      
      const result = await loadMostRecent();
      if (result.success && result.state) {
        setGameState(result.state);
        enableAutosave(() => getGameState());
        renderBaseCampScreen();
      } else {
        alert("Failed to load save: " + (result.error ?? "Unknown error"));
        continueBtn.disabled = false;
        continueBtn.innerHTML = originalHtml;
      }
    });
  }
  
  // New Operation button
  const newOpBtn = root.querySelector<HTMLButtonElement>('button[data-action="new-op"]');
  if (newOpBtn) {
    newOpBtn.addEventListener("click", () => {
      if (saves.length > 0) {
        if (!confirm("Starting a new operation will not delete your existing saves. Continue?")) {
          return;
        }
      }
      
      resetToNewGame();
      enableAutosave(() => getGameState());
      renderFieldScreen("base_camp");
    });
  }
  
  // Load Game button
  const loadBtn = root.querySelector<HTMLButtonElement>('button[data-action="load"]');
  if (loadBtn) {
    loadBtn.addEventListener("click", () => {
      openLoadModal(saves);
    });
  }
  
  // Settings button
  const settingsBtn = root.querySelector<HTMLButtonElement>('button[data-action="settings"]');
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      renderSettingsScreen("menu");
    });
  }
  
  // Exit button
  const exitBtn = root.querySelector<HTMLButtonElement>('button[data-action="exit"]');
  if (exitBtn) {
    exitBtn.addEventListener("click", async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().close();
      } catch (err) {
        console.log("Exit requested (no Tauri context):", err);
        window.close();
      }
    });
  }
  
  // Modal close buttons
  const closeLoadModal = document.getElementById("closeLoadModal");
  if (closeLoadModal) {
    closeLoadModal.addEventListener("click", () => {
      const modal = document.getElementById("loadModal");
      if (modal) modal.style.display = "none";
    });
  }
  
  const closeSaveModal = document.getElementById("closeSaveModal");
  if (closeSaveModal) {
    closeSaveModal.addEventListener("click", () => {
      const modal = document.getElementById("saveModal");
      if (modal) modal.style.display = "none";
    });
  }
  
  // Modal backdrop clicks
  document.getElementById("loadModal")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("mainmenu-modal")) {
      (e.target as HTMLElement).style.display = "none";
    }
  });
  
  document.getElementById("saveModal")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("mainmenu-modal")) {
      (e.target as HTMLElement).style.display = "none";
    }
  });
}

// ----------------------------------------------------------------------------
// LOAD MODAL
// ----------------------------------------------------------------------------

function openLoadModal(saves: SaveInfo[]): void {
  const modal = document.getElementById("loadModal");
  const modalBody = document.getElementById("loadModalBody");
  if (!modal || !modalBody) return;
  
  modalBody.innerHTML = saves.map(save => {
    const slotName = getSaveSlotName(save.slot as SaveSlot);
    const timeStr = formatSaveTimestamp(save.timestamp);
    const preview = save.preview;
    
    return /*html*/ `
      <div class="load-save-item" data-slot="${save.slot}">
        <div class="save-slot-info">
          <div class="save-slot-name">${slotName}</div>
          <div class="save-slot-time">${timeStr}</div>
        </div>
        ${preview ? `
          <div class="save-slot-preview">
            <span class="preview-detail">${preview.callsign}</span>
            <span class="preview-detail">${preview.operationName}</span>
            <span class="preview-detail">${preview.wad} WAD</span>
            <span class="preview-detail">${preview.partyCount} Units</span>
          </div>
        ` : ''}
        <button class="load-save-btn">LOAD</button>
      </div>
    `;
  }).join('');
  
  modalBody.querySelectorAll(".load-save-item").forEach(item => {
    const loadBtn = item.querySelector(".load-save-btn");
    if (loadBtn) {
      loadBtn.addEventListener("click", async () => {
        const slot = (item as HTMLElement).dataset.slot as SaveSlot;
        if (slot) {
          const result = await loadGame(slot);
          if (result.success && result.state) {
            setGameState(result.state);
            enableAutosave(() => getGameState());
            modal.style.display = "none";
            renderBaseCampScreen();
          } else {
            alert("Failed to load save: " + (result.error ?? "Unknown error"));
          }
        }
      });
    }
  });
  
  modal.style.display = "flex";
  updateFocusableElements();
}

// ----------------------------------------------------------------------------
// SAVE MODAL (for use from other screens)
// ----------------------------------------------------------------------------

export async function openSaveModal(): Promise<void> {
  const modal = document.getElementById("saveModal");
  const modalBody = document.getElementById("saveModalBody");
  if (!modal || !modalBody) return;
  
  const saves = await listSaves();
  const slots: SaveSlot[] = [SAVE_SLOTS.MANUAL_1, SAVE_SLOTS.MANUAL_2, SAVE_SLOTS.MANUAL_3];
  
  modalBody.innerHTML = slots.map(slot => {
    const existingSave = saves.find(s => s.slot === slot);
    const slotName = getSaveSlotName(slot);
    
    if (existingSave) {
      const timeStr = formatSaveTimestamp(existingSave.timestamp);
      const preview = existingSave.preview;
      
      return /*html*/ `
        <div class="save-slot-item" data-slot="${slot}">
          <div class="save-slot-info">
            <div class="save-slot-name">${slotName}</div>
            <div class="save-slot-time">${timeStr}</div>
          </div>
          ${preview ? `
            <div class="save-slot-preview">
              <span class="preview-detail">${preview.callsign}</span>
              <span class="preview-detail">${preview.operationName}</span>
            </div>
          ` : ''}
          <button class="save-slot-btn save-slot-btn--overwrite">OVERWRITE</button>
        </div>
      `;
    } else {
      return /*html*/ `
        <div class="save-slot-item save-slot-item--empty" data-slot="${slot}">
          <div class="save-slot-info">
            <div class="save-slot-name">${slotName}</div>
            <div class="save-slot-time">Empty</div>
          </div>
          <button class="save-slot-btn">SAVE</button>
        </div>
      `;
    }
  }).join('');
  
  modalBody.querySelectorAll(".save-slot-item").forEach(item => {
    const saveBtn = item.querySelector(".save-slot-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const slot = (item as HTMLElement).dataset.slot as SaveSlot;
        const isOverwrite = saveBtn.classList.contains("save-slot-btn--overwrite");
        
        if (isOverwrite && !confirm("Overwrite this save?")) {
          return;
        }
        
        const state = getGameState();
        const result = await saveGame(slot, state);
        
        if (result.success) {
          modal.style.display = "none";
          alert("Game saved successfully!");
        } else {
          alert("Failed to save: " + (result.error ?? "Unknown error"));
        }
      });
    }
  });
  
  modal.style.display = "flex";
  updateFocusableElements();
}

export { renderMainMenu as default };
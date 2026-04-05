// ============================================================================
// CHAOS CORE - SETTINGS SCREEN (Headline 12bz)
// src/ui/screens/SettingsScreen.ts
// UI for game settings and controller configuration
// ============================================================================

import { renderMainMenu } from "./MainMenuScreen";
import {
  BaseCampReturnTo,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";
import {
  getSettings,
  updateSettings,
  resetSettings,
  GameSettings,
  SETTING_DESCRIPTORS,
  getSettingsByCategory,
  getCategoryLabel,
  SettingDescriptor,
} from "../../core/settings";
import { getAllThemes, getTheme } from "../../core/themes";
import {
  getConnectedControllers,
  getButtonBindings,
  getButtonName,
  getActionName,
  GameAction,
  updateFocusableElements,
} from "../../core/controllerSupport";
import {
  listSaves,
  deleteSave,
  SaveInfo,
  formatSaveTimestamp,
  getSaveSlotName,
  SAVE_SLOTS,
  SaveSlot,
} from "../../core/saveSystem";
import { SCROLLINK_BUILD_LABEL } from "../../core/appVersion";

// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------

type SettingsTab = "general" | "controls" | "saves";
let currentTab: SettingsTab = "general";
let returnDestination: "menu" | BaseCampReturnTo = "menu";

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

export function renderSettingsScreen(returnTo: "menu" | BaseCampReturnTo = "menu"): void {
  returnDestination = returnTo;
  
  const app = document.getElementById("app");
  if (!app) return;
  
  const settings = getSettings();
  const categories = getSettingsByCategory();
  
  app.innerHTML = /*html*/ `
    <div class="settings-root">
      <div class="settings-header">
        <div class="settings-header-left">
          <h1 class="settings-title">SETTINGS</h1>
          <div class="settings-subtitle">S/COM://SYSTEM_CONFIG</div>
        </div>
        <div class="settings-header-right">
          <button class="settings-back-btn" id="backBtn">← BACK</button>
        </div>
      </div>
      
      <div class="settings-tabs">
        <button class="settings-tab ${currentTab === 'general' ? 'settings-tab--active' : ''}" 
                data-tab="general">
          ⚙ GENERAL
        </button>
        <button class="settings-tab ${currentTab === 'controls' ? 'settings-tab--active' : ''}" 
                data-tab="controls">
          🎮 CONTROLS
        </button>
        <button class="settings-tab ${currentTab === 'saves' ? 'settings-tab--active' : ''}" 
                data-tab="saves">
          💾 SAVE DATA
        </button>
      </div>
      
      <div class="settings-content">
        ${currentTab === 'general' ? renderGeneralTab(settings, categories) : ''}
        ${currentTab === 'controls' ? renderControlsTab(settings) : ''}
        ${currentTab === 'saves' ? renderSavesTab() : ''}
      </div>
      
      <div class="settings-footer">
        <button class="settings-reset-btn" id="resetBtn">RESET TO DEFAULTS</button>
        <div class="settings-version">${SCROLLINK_BUILD_LABEL}</div>
      </div>
    </div>
  `;
  
  attachSettingsListeners();
  if (returnDestination !== "menu") {
    registerBaseCampReturnHotkey("settings-screen", returnDestination, { allowFieldEKey: true, activeSelector: ".settings-root" });
  } else {
    unregisterBaseCampReturnHotkey("settings-screen");
  }
  updateFocusableElements();
}

// ----------------------------------------------------------------------------
// TAB RENDERERS
// ----------------------------------------------------------------------------

function renderGeneralTab(settings: GameSettings, categories: Record<string, SettingDescriptor[]>): string {
  const categoryOrder = ["audio", "display", "gameplay", "accessibility"];
  
  return /*html*/ `
    <div class="settings-general">
      ${categoryOrder.map(cat => renderSettingCategory(cat, categories[cat], settings)).join('')}
    </div>
  `;
}

function renderSettingCategory(category: string, descriptors: SettingDescriptor[], settings: GameSettings): string {
  if (!descriptors || descriptors.length === 0) return '';
  
  return /*html*/ `
    <div class="settings-category">
      <div class="settings-category-header">${getCategoryLabel(category).toUpperCase()}</div>
      <div class="settings-category-items">
        ${descriptors.map(desc => renderSettingItem(desc, settings)).join('')}
      </div>
    </div>
  `;
}

function renderSettingItem(desc: SettingDescriptor, settings: GameSettings): string {
  const value = settings[desc.key];
  
  let control = '';
  
  switch (desc.type) {
    case 'toggle':
      control = /*html*/ `
        <label class="setting-toggle">
          <input type="checkbox" 
                 data-setting="${desc.key}" 
                 ${value ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      `;
      break;
      
    case 'slider':
      control = /*html*/ `
        <div class="setting-slider-container">
          <input type="range" 
                 class="setting-slider"
                 data-setting="${desc.key}"
                 min="${desc.min ?? 0}"
                 max="${desc.max ?? 100}"
                 step="${desc.step ?? 1}"
                 value="${value}">
          <span class="setting-slider-value">${value}${desc.key.includes('Volume') ? '%' : ''}</span>
        </div>
      `;
      break;
      
    case 'select':
      // Special handling for theme selector with descriptions
      if (desc.key === "uiTheme") {
        const themes = getAllThemes();
        control = /*html*/ `
          <div class="setting-theme-container">
            <select class="setting-select" data-setting="${desc.key}">
              ${themes.map(theme => `
                <option value="${theme.id}" ${value === theme.id ? 'selected' : ''}>
                  ${theme.name}
                </option>
              `).join('')}
            </select>
            <div class="setting-theme-description">
              ${getTheme(value as any)?.description || ''}
            </div>
          </div>
        `;
      } else {
        control = /*html*/ `
          <select class="setting-select" data-setting="${desc.key}">
            ${desc.options?.map(opt => `
              <option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>
                ${opt.label}
              </option>
            `).join('')}
          </select>
        `;
      }
      break;
  }
  
  return /*html*/ `
    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-label">${desc.label}</div>
        <div class="setting-description">${desc.description}</div>
      </div>
      <div class="setting-control">
        ${control}
      </div>
    </div>
  `;
}

function renderControlsTab(settings: GameSettings): string {
  const controllers = getConnectedControllers();
  const bindings = getButtonBindings();
  
  const controlSettings = SETTING_DESCRIPTORS.filter(d => d.category === 'controls');
  
  return /*html*/ `
    <div class="settings-controls">
      <div class="settings-category">
        <div class="settings-category-header">CONTROLLER STATUS</div>
        <div class="controller-status">
          ${controllers.length > 0 ? `
            <div class="controller-connected">
              <span class="status-icon">✓</span>
              <span class="status-text">Controller Connected</span>
            </div>
            ${controllers.map(ctrl => `
              <div class="controller-info">${ctrl.id}${ctrl.assignedPlayer ? ` // ${ctrl.assignedPlayer}` : " // UNASSIGNED"}</div>
            `).join('')}
          ` : `
            <div class="controller-disconnected">
              <span class="status-icon">○</span>
              <span class="status-text">No Controller Detected</span>
              <div class="status-hint">Connect a controller to enable gamepad support</div>
            </div>
          `}
        </div>
      </div>
      
      <div class="settings-category">
        <div class="settings-category-header">CONTROLLER SETTINGS</div>
        <div class="settings-category-items">
          ${controlSettings.map(desc => renderSettingItem(desc, settings)).join('')}
        </div>
      </div>
      
      <div class="settings-category">
        <div class="settings-category-header">BUTTON BINDINGS</div>
        <div class="bindings-list">
          ${Object.entries(bindings).map(([action, buttons]) => `
            <div class="binding-item">
              <span class="binding-action">${getActionName(action as GameAction)}</span>
              <span class="binding-buttons">
                ${buttons.map(b => `<span class="binding-button">${getButtonName(b)}</span>`).join(' ')}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="settings-category">
        <div class="settings-category-header">KEYBOARD CONTROLS</div>
        <div class="keyboard-bindings">
          <div class="binding-item">
            <span class="binding-action">P1 Movement</span>
            <span class="binding-keys">WASD</span>
          </div>
          <div class="binding-item">
            <span class="binding-action">P1 Confirm / Interact / Attack</span>
            <span class="binding-keys">Enter / E / Space</span>
          </div>
          <div class="binding-item">
            <span class="binding-action">P2 Movement</span>
            <span class="binding-keys">Arrow Keys</span>
          </div>
          <div class="binding-item">
            <span class="binding-action">P2 Confirm / Interact / Attack</span>
            <span class="binding-keys">Numpad Enter / Slash / Numpad 0</span>
          </div>
          <div class="binding-item">
            <span class="binding-action">Shared Cancel / Special</span>
            <span class="binding-keys">Escape or Backspace / Left or Right Shift</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSavesTab(): string {
  return /*html*/ `
    <div class="settings-saves">
      <div class="settings-category">
        <div class="settings-category-header">SAVE FILES</div>
        <div class="saves-list" id="savesList">
          <div class="saves-loading">Loading save data...</div>
        </div>
      </div>
      
      <div class="settings-category">
        <div class="settings-category-header">DATA MANAGEMENT</div>
        <div class="data-actions">
          <button class="data-action-btn data-action-btn--danger" id="clearAllSavesBtn">
            🗑 DELETE ALL SAVES
          </button>
          <div class="data-action-warning">This action cannot be undone</div>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// SAVES LIST (ASYNC)
// ----------------------------------------------------------------------------

async function loadAndRenderSaves(): Promise<void> {
  const savesList = document.getElementById("savesList");
  if (!savesList) return;
  
  const saves = await listSaves();
  
  if (saves.length === 0) {
    savesList.innerHTML = /*html*/ `
      <div class="saves-empty">
        <div class="saves-empty-icon">💾</div>
        <div class="saves-empty-text">No save files found</div>
      </div>
    `;
    return;
  }
  
  savesList.innerHTML = saves.map(save => renderSaveItem(save)).join('');
  
  savesList.querySelectorAll(".save-delete-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const slot = (e.target as HTMLElement).dataset.slot as SaveSlot;
      if (slot && confirm(`Delete ${getSaveSlotName(slot)}?`)) {
        await deleteSave(slot);
        await loadAndRenderSaves();
      }
    });
  });
}

function renderSaveItem(save: SaveInfo): string {
  const slotName = getSaveSlotName(save.slot as SaveSlot);
  const timeStr = formatSaveTimestamp(save.timestamp);
  const preview = save.preview;
  
  return /*html*/ `
    <div class="save-item ${save.slot === SAVE_SLOTS.AUTOSAVE ? 'save-item--autosave' : ''}">
      <div class="save-info">
        <div class="save-slot-name">${slotName}</div>
        <div class="save-timestamp">${timeStr}</div>
        ${preview ? `
          <div class="save-preview">
            <span class="preview-callsign">${preview.callsign}</span>
            <span class="preview-separator">•</span>
            <span class="preview-operation">${preview.operationName}</span>
            <span class="preview-separator">•</span>
            <span class="preview-wad">${preview.wad} WAD</span>
          </div>
        ` : ''}
      </div>
      <div class="save-actions">
        <button class="save-delete-btn" data-slot="${save.slot}">🗑</button>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------------------

function attachSettingsListeners(): void {
  const app = document.getElementById("app");
  if (!app) return;
  
  // Back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.onclick = () => {
      unregisterBaseCampReturnHotkey("settings-screen");
      if (returnDestination !== "menu") {
        returnFromBaseCampScreen(returnDestination);
      } else {
        renderMainMenu();
      }
    };
  }
  
  // Tab buttons
  app.querySelectorAll(".settings-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      currentTab = (tab as HTMLElement).dataset.tab as SettingsTab;
      renderSettingsScreen(returnDestination);
    });
  });
  
  // Reset button
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    resetBtn.onclick = async () => {
      if (confirm("Reset all settings to defaults?")) {
        await resetSettings();
        renderSettingsScreen(returnDestination);
      }
    };
  }
  
  // Clear all saves button
  const clearAllSavesBtn = document.getElementById("clearAllSavesBtn");
  if (clearAllSavesBtn) {
    clearAllSavesBtn.onclick = async () => {
      if (confirm("Delete ALL save files? This cannot be undone!")) {
        for (const slot of Object.values(SAVE_SLOTS)) {
          await deleteSave(slot);
        }
        await loadAndRenderSaves();
      }
    };
  }
  
  // Toggles
  app.querySelectorAll('input[type="checkbox"][data-setting]').forEach(input => {
    input.addEventListener("change", async (e) => {
      const checkbox = e.target as HTMLInputElement;
      const key = checkbox.dataset.setting as keyof GameSettings;
      await updateSettings({ [key]: checkbox.checked });
    });
  });
  
  // Sliders
  app.querySelectorAll('input[type="range"][data-setting]').forEach(input => {
    input.addEventListener("input", (e) => {
      const slider = e.target as HTMLInputElement;
      const valueDisplay = slider.parentElement?.querySelector(".setting-slider-value");
      if (valueDisplay) {
        const key = slider.dataset.setting;
        valueDisplay.textContent = slider.value + (key?.includes("Volume") ? "%" : "");
      }
    });
    
    input.addEventListener("change", async (e) => {
      const slider = e.target as HTMLInputElement;
      const key = slider.dataset.setting as keyof GameSettings;
      await updateSettings({ [key]: parseInt(slider.value) });
    });
  });
  
  // Selects
  app.querySelectorAll('select[data-setting]').forEach(element => {
    const select = element as HTMLSelectElement;

    select.addEventListener("change", async (e) => {
      const sel = e.target as HTMLSelectElement;
      const key = sel.dataset.setting as keyof GameSettings;
      await updateSettings({ [key]: sel.value });
      
      // Update theme description if this is the theme selector
      if (key === "uiTheme") {
        const themeDesc = select.parentElement?.querySelector(".setting-theme-description");
        if (themeDesc) {
          const theme = getTheme(sel.value as any);
          themeDesc.textContent = theme?.description || "";
        }
      }
    });
    
    // Update theme description on initial load
    if (select.dataset.setting === "uiTheme") {
      const themeDesc = select.parentElement?.querySelector(".setting-theme-description");
      if (themeDesc) {
        const theme = getTheme(select.value as any);
        themeDesc.textContent = theme?.description || "";
      }
    }
  });
  
  // Load saves if on saves tab
  if (currentTab === "saves") {
    loadAndRenderSaves();
  }
}

// ============================================================================
// CHAOS CORE - MAIN MENU SCREEN (Headline 12bza)
// src/ui/screens/MainMenuScreen.ts
// Logo positioned above card, larger size
// ============================================================================

import { getGameState, setGameState, resetToNewGame } from "../../state/gameStore";
import { renderSettingsScreen } from "./SettingsScreen";
import { renderFieldScreen } from "../../field/FieldScreen";
import { renderAllNodesMenuScreen } from "./AllNodesMenuScreen";
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
import { clearControllerContext, initControllerSupport, registerControllerContext, updateFocusableElements } from "../../core/controllerSupport";
import { loadCraftingRecipes } from "../../core/craftingRecipes";
import { APP_VERSION, SCROLLINK_VERSION_LABEL } from "../../core/appVersion";
import { hydrateGeneratedTechnicaRegistry } from "../../content/technica";
import { initializeTechnicaContentLibrary } from "../../content/technica/library";
import { setMusicCue } from "../../core/audioSystem";
import { renderImportContentScreen } from "./ImportContentScreen";
import chaosCoreLogo from "../../assets/cc logo.png";
import { createDefaultCampaignProgress, saveCampaignProgress } from "../../core/campaign";
import { clearActiveEchoRun } from "../../core/echoRuns";
import {
  enhanceTerminalUiButtons,
  startTerminalTypingByIds,
} from "../components/terminalFeedback";
import { showConfirmDialog } from "../components/confirmDialog";

const TERMINAL_PROMPT_PREFIX = "S/COM&gt;";
const FLOATING_TERMINAL_TITLES = [
  "S/COM_OS // AUX_CONSOLE",
  "S/COM_OS // SIGNAL_MONITOR",
  "S/COM_OS // OPS_RELAY",
  "S/COM_OS // ARCHIVE_NODE",
];

let floatingTerminalCount = 0;
let floatingTerminalZIndex = 220;
let cleanupMainMenuWorkspace: (() => void) | null = null;
let cleanupMainMenuTerminalFx: (() => void) | null = null;

function teardownMainMenuWorkspace(): void {
  cleanupMainMenuWorkspace?.();
  cleanupMainMenuWorkspace = null;
  cleanupMainMenuTerminalFx?.();
  cleanupMainMenuTerminalFx = null;
}

type MainMenuActionId =
  | "continue"
  | "new-op"
  | "map-builder"
  | "multiplayer"
  | "echo-runs"
  | "load"
  | "settings"
  | "import-content"
  | "exit";

type MainMenuButtonLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  themeIndex: number;
};

type MainMenuBackgroundTheme = {
  key: string;
  label: string;
  vars: Record<string, string>;
};

type MainMenuLayoutRecord = Partial<Record<MainMenuActionId, MainMenuButtonLayout>>;

type SavedMainMenuButtonLayoutPayload = {
  version: number;
  viewport?: {
    width: number;
    height: number;
  };
  layout: MainMenuLayoutRecord;
};

type LoadedMainMenuButtonLayout = {
  layout: Partial<Record<MainMenuActionId, Partial<MainMenuButtonLayout>>>;
  viewport: { width: number; height: number } | null;
};

const MAIN_MENU_LAYOUT_STORAGE_KEY = "chaoscore_mainmenu_button_layout";
const MAIN_MENU_LAYOUT_VERSION = 5;
const MAIN_MENU_BACKGROUND_STORAGE_KEY = "chaoscore_mainmenu_background_theme";
const MAIN_MENU_DRAG_THRESHOLD = 6;
const MAIN_MENU_GRID_SIZE = 4;
const MAIN_MENU_MIN_WIDTH = 112;
const MAIN_MENU_MIN_HEIGHT = 44;
const MAIN_MENU_MINIMIZED_HEIGHT = 58;
const MAIN_MENU_MINIMIZED_WIDTH = 58;
const MAIN_MENU_THEMES = [
  "mainmenu-action-tile--theme-ember",
  "mainmenu-action-tile--theme-violet",
  "mainmenu-action-tile--theme-steel",
  "mainmenu-action-tile--theme-moss",
] as const;
const MAIN_MENU_BACKGROUND_THEMES: MainMenuBackgroundTheme[] = [
  {
    key: "ember",
    label: "Ember",
    vars: {
      "--mainmenu-bg-top": "#1d120d",
      "--mainmenu-bg-mid": "#251914",
      "--mainmenu-bg-bottom": "#090806",
      "--mainmenu-bg-glow-a": "rgba(255, 119, 61, 0.26)",
      "--mainmenu-bg-glow-b": "rgba(255, 204, 110, 0.14)",
      "--mainmenu-bg-control-accent": "#ffcc6e",
      "--mainmenu-bg-swatch-a": "#ffcf75",
      "--mainmenu-bg-swatch-b": "#9e452f",
    },
  },
  {
    key: "violet",
    label: "Violet",
    vars: {
      "--mainmenu-bg-top": "#15111d",
      "--mainmenu-bg-mid": "#221a2e",
      "--mainmenu-bg-bottom": "#07060c",
      "--mainmenu-bg-glow-a": "rgba(146, 104, 212, 0.28)",
      "--mainmenu-bg-glow-b": "rgba(192, 179, 255, 0.14)",
      "--mainmenu-bg-control-accent": "#d0c1ff",
      "--mainmenu-bg-swatch-a": "#d7c8ff",
      "--mainmenu-bg-swatch-b": "#5e4d69",
    },
  },
  {
    key: "teal",
    label: "Teal",
    vars: {
      "--mainmenu-bg-top": "#0d171b",
      "--mainmenu-bg-mid": "#13252c",
      "--mainmenu-bg-bottom": "#05090d",
      "--mainmenu-bg-glow-a": "rgba(79, 139, 147, 0.26)",
      "--mainmenu-bg-glow-b": "rgba(158, 216, 222, 0.13)",
      "--mainmenu-bg-control-accent": "#9ed8de",
      "--mainmenu-bg-swatch-a": "#a9e6eb",
      "--mainmenu-bg-swatch-b": "#3f6170",
    },
  },
  {
    key: "oxide",
    label: "Oxide",
    vars: {
      "--mainmenu-bg-top": "#20120d",
      "--mainmenu-bg-mid": "#311c16",
      "--mainmenu-bg-bottom": "#0a0605",
      "--mainmenu-bg-glow-a": "rgba(176, 104, 76, 0.28)",
      "--mainmenu-bg-glow-b": "rgba(255, 192, 164, 0.13)",
      "--mainmenu-bg-control-accent": "#ffc0a4",
      "--mainmenu-bg-swatch-a": "#ffd0b8",
      "--mainmenu-bg-swatch-b": "#67463d",
    },
  },
  {
    key: "moss",
    label: "Moss",
    vars: {
      "--mainmenu-bg-top": "#14170f",
      "--mainmenu-bg-mid": "#202618",
      "--mainmenu-bg-bottom": "#070905",
      "--mainmenu-bg-glow-a": "rgba(127, 145, 97, 0.28)",
      "--mainmenu-bg-glow-b": "rgba(210, 227, 173, 0.13)",
      "--mainmenu-bg-control-accent": "#d2e3ad",
      "--mainmenu-bg-swatch-a": "#e2efbf",
      "--mainmenu-bg-swatch-b": "#575f45",
    },
  },
  {
    key: "steel",
    label: "Steel",
    vars: {
      "--mainmenu-bg-top": "#101418",
      "--mainmenu-bg-mid": "#1a2128",
      "--mainmenu-bg-bottom": "#05070a",
      "--mainmenu-bg-glow-a": "rgba(112, 129, 141, 0.28)",
      "--mainmenu-bg-glow-b": "rgba(213, 224, 232, 0.13)",
      "--mainmenu-bg-control-accent": "#d5e0e8",
      "--mainmenu-bg-swatch-a": "#e4edf3",
      "--mainmenu-bg-swatch-b": "#4a555e",
    },
  },
];

function getStoredMainMenuBackgroundThemeKey(): string {
  try {
    return localStorage.getItem(MAIN_MENU_BACKGROUND_STORAGE_KEY) ?? MAIN_MENU_BACKGROUND_THEMES[0]?.key ?? "ember";
  } catch (error) {
    console.warn("[MAINMENU] Failed to load background theme", error);
    return MAIN_MENU_BACKGROUND_THEMES[0]?.key ?? "ember";
  }
}

function getMainMenuBackgroundTheme(key: string): MainMenuBackgroundTheme {
  return MAIN_MENU_BACKGROUND_THEMES.find((theme) => theme.key === key) ?? MAIN_MENU_BACKGROUND_THEMES[0];
}

function applyMainMenuBackgroundTheme(mainMenuRoot: HTMLElement, themeKey: string): void {
  const theme = getMainMenuBackgroundTheme(themeKey);
  Object.entries(theme.vars).forEach(([property, value]) => {
    mainMenuRoot.style.setProperty(property, value);
  });
  mainMenuRoot.dataset.mainmenuBackgroundTheme = theme.key;

  const cycleBtn = mainMenuRoot.querySelector<HTMLButtonElement>('button[data-action="cycle-background"]');
  if (cycleBtn) {
    cycleBtn.title = `Background: ${theme.label}`;
    cycleBtn.setAttribute("aria-label", `Cycle title background theme. Current theme: ${theme.label}`);
  }

  try {
    localStorage.setItem(MAIN_MENU_BACKGROUND_STORAGE_KEY, theme.key);
  } catch (error) {
    console.warn("[MAINMENU] Failed to save background theme", error);
  }
}

function cycleMainMenuBackgroundTheme(mainMenuRoot: HTMLElement): void {
  const currentKey = mainMenuRoot.dataset.mainmenuBackgroundTheme ?? getStoredMainMenuBackgroundThemeKey();
  const currentIndex = MAIN_MENU_BACKGROUND_THEMES.findIndex((theme) => theme.key === currentKey);
  const nextTheme = MAIN_MENU_BACKGROUND_THEMES[(currentIndex + 1 + MAIN_MENU_BACKGROUND_THEMES.length) % MAIN_MENU_BACKGROUND_THEMES.length];
  applyMainMenuBackgroundTheme(mainMenuRoot, nextTheme.key);
}

// ----------------------------------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------------------------------

let isInitialized = false;

async function initializeGame(): Promise<void> {
  if (isInitialized) return;
  
  console.log("[INIT] Initializing Chaos Core...");
  
  await initializeSettings();
  initControllerSupport();
  
  // Load crafting recipes
  try {
    await loadCraftingRecipes();
  } catch (error) {
    console.error("[INIT] Failed to load crafting recipes:", error);
    // Non-fatal - game can continue without recipes
  }

  await hydrateGeneratedTechnicaRegistry();
  initializeTechnicaContentLibrary();
  
  isInitialized = true;
  console.log("[INIT] Initialization complete");
}

async function resumeLoadedGame(defaultView: "field" | "esc"): Promise<void> {
  const state = getGameState();
  if (state.currentBattle?.modeContext?.kind === "echo") {
    const { renderBattleScreen } = await import("./BattleScreen");
    renderBattleScreen();
    return;
  }

  if (state.echoRun && state.phase === "echo") {
    const { renderEchoRunScreen } = await import("./EchoRunScreen");
    renderEchoRunScreen();
    return;
  }

  if (defaultView === "esc") {
    renderAllNodesMenuScreen();
    return;
  }

  renderFieldScreen("base_camp");
}

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

export async function renderMainMenu(): Promise<void> {
  await initializeGame();
  setMusicCue("main-menu");
  teardownMainMenuWorkspace();
  
  const root = document.getElementById("app");
  if (!root) {
    console.error("Missing #app element");
    return;
  }
  document.body.setAttribute("data-screen", "main-menu");
  clearControllerContext();
  
  const hasContinue = await canContinue();
  const saves = await listSaves();
  const mostRecentSave = saves.length > 0 ? saves[0] : null;
  
  // Flavor text for the terminal - will be output continuously
  const flavorLines = [
    `S/COM&gt; SYSTEM_STATUS    :: ${SCROLLINK_VERSION_LABEL} — All systems nominal.`,
    "S/COM&gt; CORE_STATUS      :: Chaos core containment: STABLE.",
    "S/COM&gt; NETWORK_STATUS   :: MISTGUARD relay connected. Signal strength: EXCELLENT.",
    "",
    "S/COM&gt; OPERATION_LOG    :: Accessing mission archives...",
    "S/COM&gt; OPERATION_LOG    :: Last deployment: Operation IRON GATE — Status: CLEARED",
    "S/COM&gt; OPERATION_LOG    :: Active units: 2 — Squad readiness: GREEN",
    "",
    "S/COM&gt; BRIEFING         :: In ARDYCIA, bandits, knights, wizards and gunslingers",
    "S/COM&gt; BRIEFING         :: fight for control over cold and rocky terrain.",
    "S/COM&gt; BRIEFING         :: Reports of a dark, growing chasm of evil magic",
    "S/COM&gt; BRIEFING         :: threaten the stability of the Fairhaven empire.",
    "",
    "S/COM&gt; MISSION_PARAMS   :: Objective: Locate and secure the CHAOS CORE",
    "S/COM&gt; MISSION_PARAMS   :: Close the rift before it consumes the region.",
    "S/COM&gt; MISSION_PARAMS   :: Leading officer: AERISS THORNE — Status: ACTIVE",
    "",
    "S/COM&gt; AWAITING_INPUT   :: Select operation or adjust loadout.",
    "S/COM&gt; LEGACY_SYSTEM    :: Solaris (defunct) — \"Working for you.\"",
    "",
    "S/COM&gt; SYSTEM_UPDATE    :: Running background diagnostics...",
    "S/COM&gt; SYSTEM_UPDATE    :: All subsystems operational.",
    "",
    "S/COM&gt; NETWORK_STATUS   :: Maintaining connection to MISTGUARD relay...",
    "S/COM&gt; NETWORK_STATUS   :: Latency: 12ms — Quality: EXCELLENT",
  ];

  root.innerHTML = /*html*/ `
    <div class="mainmenu-root">
      <div class="mainmenu-bg-effects">
        <div class="mainmenu-scanline"></div>
        <div class="mainmenu-vignette"></div>
        <div class="mainmenu-particles"></div>
      </div>
      
      <!-- Two-column layout: Logo/Menu on left, Terminal on right -->
      <div class="mainmenu-content">
        <!-- Left column: Logo and Menu -->
        <div class="mainmenu-left-panel">
          <!-- Logo at top -->
          <div class="mainmenu-logo-section">
            <div class="mainmenu-logo-container">
              <img 
                id="logoImage"
                src="${chaosCoreLogo}"
                alt="Chaos Core" 
                class="mainmenu-logo-image"
              />
              <div id="logoFallback" class="mainmenu-logo-fallback" style="display: none;">CHAOS CORE</div>
              <div class="mainmenu-logo-glow"></div>
            </div>
          </div>
          
          <!-- Menu buttons below logo -->
          <div class="mainmenu-menu-section">
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
                <span class="btn-icon">⚔</span>
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

              <button class="mainmenu-btn mainmenu-btn-half mainmenu-btn-secondary" data-action="import-content">
                <span class="btn-icon">IMP</span>
                <span class="btn-text">IMPORT CONTENT</span>
                <span class="btn-subtitle">Drag in Technica bundles</span>
              </button>

              <button class="mainmenu-btn mainmenu-btn-tertiary" data-action="exit">
                <span class="btn-icon">✕</span>
                <span class="btn-text">EXIT</span>
              </button>
            </div>
            
            <!-- Footer info -->
            <div class="mainmenu-version" aria-label="Game version">${APP_VERSION}</div>
          </div>
        </div>
        
        <!-- Right column: Terminal taking up remaining space -->
        <div class="mainmenu-terminal-container">
          <div class="mainmenu-terminal-window">
            <div class="mainmenu-terminal-header">
              <span class="terminal-window-title">S/COM_OS // SYSTEM_CONSOLE</span>
              <span class="terminal-window-status">[ACTIVE]</span>
            </div>
            <div class="mainmenu-terminal-body" id="terminalBody">
              <div class="mainmenu-terminal-output" id="terminalOutput">
                <!-- Terminal lines will be added dynamically -->
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        class="mainmenu-background-cycle"
        type="button"
        data-action="cycle-background"
        data-controller-exclude="true"
        aria-label="Cycle title background theme"
        title="Cycle title background theme"
      >
        <span class="mainmenu-background-cycle__swatch" aria-hidden="true"></span>
        <span class="mainmenu-background-cycle__label">BG</span>
      </button>

      <button
        class="mainmenu-terminal-fab"
        type="button"
        data-action="new-terminal"
        data-controller-exclude="true"
        aria-label="Open new S/COM_OS window"
        title="Open new S/COM_OS window"
      >
        +
      </button>

      <div class="mainmenu-floating-layer" id="mainmenuFloatingLayer" aria-live="polite"></div>
      
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

      <div class="mainmenu-modal" id="newOpConfirmModal" style="display: none;">
        <div class="mainmenu-modal-content mainmenu-modal-content--confirm">
          <div class="mainmenu-modal-header">
            <span class="modal-title">NEW OPERATION</span>
            <button class="modal-close" id="closeNewOpConfirmModal" type="button" aria-label="Close new operation confirmation">âœ•</button>
          </div>
          <div class="mainmenu-modal-body">
            <p class="mainmenu-confirm-copy">Starting a new operation will not delete your existing saves. Continue?</p>
            <div class="mainmenu-confirm-actions">
              <button class="mainmenu-btn mainmenu-btn-primary" id="confirmNewOpContinueBtn" type="button" data-controller-default-focus="true">
                <span class="btn-text">OK</span>
              </button>
              <button class="mainmenu-btn mainmenu-btn-secondary" id="confirmNewOpCancelBtn" type="button">
                <span class="btn-text">CANCEL</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="mainmenu-modal" id="saveOverwriteConfirmModal" style="display: none;">
        <div class="mainmenu-modal-content mainmenu-modal-content--confirm">
          <div class="mainmenu-modal-header">
            <span class="modal-title">OVERWRITE SAVE</span>
            <button class="modal-close" id="closeSaveOverwriteConfirmModal" type="button" aria-label="Close overwrite save confirmation">✕</button>
          </div>
          <div class="mainmenu-modal-body">
            <p class="mainmenu-confirm-copy">Overwrite this save?</p>
            <div class="mainmenu-confirm-actions">
              <button class="mainmenu-btn mainmenu-btn-primary" id="confirmSaveOverwriteBtn" type="button" data-controller-default-focus="true">
                <span class="btn-text">OVERWRITE</span>
              </button>
              <button class="mainmenu-btn mainmenu-btn-secondary" id="cancelSaveOverwriteBtn" type="button">
                <span class="btn-text">CANCEL</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const mainMenuRoot = root.querySelector<HTMLElement>(".mainmenu-root");
  if (mainMenuRoot) {
    applyMainMenuBackgroundTheme(mainMenuRoot, getStoredMainMenuBackgroundThemeKey());
    registerControllerContext({
      id: "main-menu",
      defaultMode: "focus",
      focusRoot: () => document.querySelector<HTMLElement>(".mainmenu-root"),
      defaultFocusSelector: 'button[data-action="continue"], button[data-action="new-op"]',
      suppressGameplayInput: true,
    });
  }

  upgradeMainMenuToWorkspace(hasContinue, saves.length > 0, mostRecentSave);
  attachMenuListeners(saves);
  if (mainMenuRoot) {
    enhanceTerminalUiButtons(mainMenuRoot);
  }
  updateFocusableElements();
  
  // Start terminal animation
  cleanupMainMenuTerminalFx?.();
  cleanupMainMenuTerminalFx = startTerminalAnimationByIds("terminalBody", "terminalOutput", flavorLines);
}

function getVisibleMainMenuModal(): HTMLElement | null {
  return Array.from(document.querySelectorAll<HTMLElement>(".mainmenu-modal"))
    .find((modal) => modal.style.display !== "none")
    ?? null;
}

function syncMainMenuModalFocusState(activeModal: HTMLElement | null): void {
  const mainMenuRoot = document.querySelector<HTMLElement>(".mainmenu-root");
  if (!mainMenuRoot) {
    return;
  }

  Array.from(mainMenuRoot.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) {
      return;
    }

    const isModal = child.classList.contains("mainmenu-modal");
    const isActiveModal = Boolean(activeModal && child === activeModal);

    if (activeModal) {
      if (isModal) {
        if (isActiveModal) {
          child.removeAttribute("data-controller-exclude");
          child.removeAttribute("aria-hidden");
        } else {
          child.setAttribute("data-controller-exclude", "true");
          child.setAttribute("aria-hidden", "true");
        }
      } else {
        child.setAttribute("data-controller-exclude", "true");
        child.setAttribute("aria-hidden", "true");
        child.setAttribute("inert", "");
      }
      return;
    }

    child.removeAttribute("data-controller-exclude");
    child.removeAttribute("aria-hidden");
    child.removeAttribute("inert");
  });
}

function showMainMenuModal(modalId: string, focusSelector?: string): void {
  const modal = document.getElementById(modalId) as HTMLElement | null;
  if (!modal) {
    return;
  }

  modal.style.display = "flex";
  syncMainMenuModalFocusState(modal);
  updateFocusableElements();

  requestAnimationFrame(() => {
    const focusTarget = (focusSelector
      ? modal.querySelector<HTMLElement>(focusSelector)
      : null)
      ?? modal.querySelector<HTMLElement>("[data-controller-default-focus='true'], button:not([disabled]), [href], input:not([disabled])");
    focusTarget?.focus();
  });
}

function hideMainMenuModal(modalId: string, restoreFocusSelector: string = 'button[data-action="new-op"]'): void {
  const modal = document.getElementById(modalId) as HTMLElement | null;
  if (!modal) {
    return;
  }

  modal.style.display = "none";
  const stillOpenModal = getVisibleMainMenuModal();
  syncMainMenuModalFocusState(stillOpenModal);
  updateFocusableElements();

  requestAnimationFrame(() => {
    if (stillOpenModal) {
      const modalFocus = stillOpenModal.querySelector<HTMLElement>("[data-controller-default-focus='true'], button:not([disabled]), [href], input:not([disabled])");
      modalFocus?.focus();
      return;
    }

    const focusTarget = document.querySelector<HTMLElement>(restoreFocusSelector)
      ?? document.querySelector<HTMLElement>(".mainmenu-btn");
    focusTarget?.focus();
  });
}

function confirmNewOperationStart(): Promise<boolean> {
  const modal = document.getElementById("newOpConfirmModal") as HTMLElement | null;
  const confirmBtn = document.getElementById("confirmNewOpContinueBtn") as HTMLButtonElement | null;
  const cancelBtn = document.getElementById("confirmNewOpCancelBtn") as HTMLButtonElement | null;
  const closeBtn = document.getElementById("closeNewOpConfirmModal") as HTMLButtonElement | null;

  if (!modal || !confirmBtn || !cancelBtn || !closeBtn) {
    return showConfirmDialog({
      title: "START NEW OPERATION",
      message: "Starting a new operation will not delete your existing saves. Continue?",
      confirmLabel: "CONTINUE",
      cancelLabel: "CANCEL",
      mount: () => document.querySelector(".mainmenu-root"),
      restoreFocusSelector: 'button[data-action="new-op"]',
    });
  }

  return new Promise((resolve) => {
    const cleanup = () => {
      confirmBtn.removeEventListener("click", handleConfirm);
      cancelBtn.removeEventListener("click", handleCancel);
      closeBtn.removeEventListener("click", handleCancel);
      modal.removeEventListener("click", handleBackdropClick);
      window.removeEventListener("keydown", handleKeyDown, true);
    };

    const finish = (accepted: boolean) => {
      cleanup();
      hideMainMenuModal("newOpConfirmModal", 'button[data-action="new-op"]');
      resolve(accepted);
    };

    const handleConfirm = () => finish(true);
    const handleCancel = () => finish(false);
    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target === modal) {
        finish(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    };

    confirmBtn.addEventListener("click", handleConfirm);
    cancelBtn.addEventListener("click", handleCancel);
    closeBtn.addEventListener("click", handleCancel);
    modal.addEventListener("click", handleBackdropClick);
    window.addEventListener("keydown", handleKeyDown, true);

    showMainMenuModal("newOpConfirmModal", "#confirmNewOpContinueBtn");
  });
}

function confirmSaveOverwrite(): Promise<boolean> {
  const modal = document.getElementById("saveOverwriteConfirmModal") as HTMLElement | null;
  const confirmBtn = document.getElementById("confirmSaveOverwriteBtn") as HTMLButtonElement | null;
  const cancelBtn = document.getElementById("cancelSaveOverwriteBtn") as HTMLButtonElement | null;
  const closeBtn = document.getElementById("closeSaveOverwriteConfirmModal") as HTMLButtonElement | null;

  if (!modal || !confirmBtn || !cancelBtn || !closeBtn) {
    return showConfirmDialog({
      title: "OVERWRITE SAVE",
      message: "Overwrite this save?",
      confirmLabel: "OVERWRITE",
      cancelLabel: "CANCEL",
      variant: "danger",
      mount: () => document.querySelector(".mainmenu-root"),
      restoreFocusSelector: "#saveModal .save-slot-btn, #closeSaveModal",
    });
  }

  return new Promise((resolve) => {
    const cleanup = () => {
      confirmBtn.removeEventListener("click", handleConfirm);
      cancelBtn.removeEventListener("click", handleCancel);
      closeBtn.removeEventListener("click", handleCancel);
      modal.removeEventListener("click", handleBackdropClick);
      window.removeEventListener("keydown", handleKeyDown, true);
    };

    const finish = (accepted: boolean) => {
      cleanup();
      hideMainMenuModal("saveOverwriteConfirmModal", "#saveModal .save-slot-btn, #closeSaveModal");
      resolve(accepted);
    };

    const handleConfirm = () => finish(true);
    const handleCancel = () => finish(false);
    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target === modal) {
        finish(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    };

    confirmBtn.addEventListener("click", handleConfirm);
    cancelBtn.addEventListener("click", handleCancel);
    closeBtn.addEventListener("click", handleCancel);
    modal.addEventListener("click", handleBackdropClick);
    window.addEventListener("keydown", handleKeyDown, true);

    showMainMenuModal("saveOverwriteConfirmModal", "#confirmSaveOverwriteBtn");
  });
}

function buildMainMenuButtonTiles(
  hasContinue: boolean,
  hasLoad: boolean,
  mostRecentSave: SaveInfo | null,
): string {
  const tiles: string[] = [];
  const nonBetaFeatureTag = '<span class="mainmenu-feature-status mainmenu-feature-status--nonbeta">NON-BETA</span>';

  if (hasContinue) {
    tiles.push(`
      <div class="mainmenu-action-tile mainmenu-action-tile--featured" data-mainmenu-tile="continue">
        <div class="mainmenu-action-tile__controls">
          <span class="mainmenu-action-tile__grip all-nodes-item-grip" aria-hidden="true">::</span>
          <button class="mainmenu-action-tile__control mainmenu-action-tile__control--color all-nodes-item-color" type="button" data-mainmenu-color="continue" aria-label="Cycle continue color"><span class="all-nodes-item-color-dot" aria-hidden="true"></span></button>
          <button class="mainmenu-action-tile__control mainmenu-action-tile__control--minimize all-nodes-item-minimize" type="button" data-mainmenu-minimize="continue" aria-label="Minimize continue">_</button>
        </div>
        <button class="mainmenu-btn mainmenu-btn-primary all-nodes-node-btn all-nodes-node-btn--primary" data-action="continue" type="button">
          <span class="btn-icon node-icon">▶</span>
          <span class="btn-text node-label">CONTINUE</span>
          ${mostRecentSave ? `<span class="btn-subtitle node-desc">${formatSaveTimestamp(mostRecentSave.timestamp)}</span>` : ""}
        </button>
        <button class="mainmenu-action-tile__resize all-nodes-item-resize" type="button" data-mainmenu-resize="continue" aria-label="Resize continue"></button>
      </div>
    `);
  }

  tiles.push(`
    <div class="mainmenu-action-tile ${hasContinue ? "mainmenu-action-tile--compact" : "mainmenu-action-tile--featured"}" data-mainmenu-tile="new-op">
      <div class="mainmenu-action-tile__controls">
        <span class="mainmenu-action-tile__grip all-nodes-item-grip" aria-hidden="true">::</span>
        <button class="mainmenu-action-tile__control mainmenu-action-tile__control--color all-nodes-item-color" type="button" data-mainmenu-color="new-op" aria-label="Cycle new operation color"><span class="all-nodes-item-color-dot" aria-hidden="true"></span></button>
        <button class="mainmenu-action-tile__control mainmenu-action-tile__control--minimize all-nodes-item-minimize" type="button" data-mainmenu-minimize="new-op" aria-label="Minimize new operation">_</button>
      </div>
      <button class="mainmenu-btn ${hasContinue ? "mainmenu-btn-secondary" : "mainmenu-btn-primary"} all-nodes-node-btn all-nodes-node-btn--primary" data-action="new-op" type="button">
        <span class="btn-icon node-icon">⚔</span>
        <span class="btn-text node-label">NEW OPERATION</span>
      </button>
      <button class="mainmenu-action-tile__resize all-nodes-item-resize" type="button" data-mainmenu-resize="new-op" aria-label="Resize new operation"></button>
    </div>
  `);

  tiles.push(`
    <div class="mainmenu-action-tile mainmenu-action-tile--featured" data-mainmenu-tile="echo-runs">
      <div class="mainmenu-action-tile__controls">
        <span class="mainmenu-action-tile__grip all-nodes-item-grip" aria-hidden="true">::</span>
        <button class="mainmenu-action-tile__control mainmenu-action-tile__control--color all-nodes-item-color" type="button" data-mainmenu-color="echo-runs" aria-label="Cycle echo runs color"><span class="all-nodes-item-color-dot" aria-hidden="true"></span></button>
        <button class="mainmenu-action-tile__control mainmenu-action-tile__control--minimize all-nodes-item-minimize" type="button" data-mainmenu-minimize="echo-runs" aria-label="Minimize echo runs">_</button>
      </div>
      <button class="mainmenu-btn mainmenu-btn-secondary all-nodes-node-btn all-nodes-node-btn--stable" data-action="echo-runs" type="button">
        <span class="btn-icon node-icon">◈</span>
        <span class="btn-text node-label">ECHO RUNS</span>
        <span class="btn-subtitle node-desc">Draft-only simulation mode</span>
        ${nonBetaFeatureTag}
      </button>
      <button class="mainmenu-action-tile__resize all-nodes-item-resize" type="button" data-mainmenu-resize="echo-runs" aria-label="Resize echo runs"></button>
    </div>
  `);

  tiles.push(`
    <div class="mainmenu-action-tile mainmenu-action-tile--featured" data-mainmenu-tile="multiplayer">
      <div class="mainmenu-action-tile__controls">
        <span class="mainmenu-action-tile__grip all-nodes-item-grip" aria-hidden="true">::</span>
        <button class="mainmenu-action-tile__control mainmenu-action-tile__control--color all-nodes-item-color" type="button" data-mainmenu-color="multiplayer" aria-label="Cycle multiplayer color"><span class="all-nodes-item-color-dot" aria-hidden="true"></span></button>
        <button class="mainmenu-action-tile__control mainmenu-action-tile__control--minimize all-nodes-item-minimize" type="button" data-mainmenu-minimize="multiplayer" aria-label="Minimize multiplayer">_</button>
      </div>
      <button class="mainmenu-btn mainmenu-btn-secondary all-nodes-node-btn all-nodes-node-btn--utility" data-action="multiplayer" type="button">
        <span class="btn-icon node-icon">COM</span>
        <span class="btn-text node-label">MULTIPLAYER</span>
        <span class="btn-subtitle node-desc">Lobby, Skirmish, Co-Op Ops</span>
        ${nonBetaFeatureTag}
      </button>
      <button class="mainmenu-action-tile__resize all-nodes-item-resize" type="button" data-mainmenu-resize="multiplayer" aria-label="Resize multiplayer"></button>
    </div>
  `);

  tiles.push(`
    <div class="mainmenu-action-tile mainmenu-action-tile--featured" data-mainmenu-tile="map-builder">
      <div class="mainmenu-action-tile__controls">
        <span class="mainmenu-action-tile__grip all-nodes-item-grip" aria-hidden="true">::</span>
        <button class="mainmenu-action-tile__control mainmenu-action-tile__control--color all-nodes-item-color" type="button" data-mainmenu-color="map-builder" aria-label="Cycle map builder color"><span class="all-nodes-item-color-dot" aria-hidden="true"></span></button>
        <button class="mainmenu-action-tile__control mainmenu-action-tile__control--minimize all-nodes-item-minimize" type="button" data-mainmenu-minimize="map-builder" aria-label="Minimize map builder">_</button>
      </div>
      <button class="mainmenu-btn mainmenu-btn-secondary all-nodes-node-btn all-nodes-node-btn--utility" data-action="map-builder" type="button">
        <span class="btn-icon node-icon">MAP</span>
        <span class="btn-text node-label">MAP BUILDER</span>
        <span class="btn-subtitle node-desc">Custom Skirmish Maps & Quick Tests</span>
        ${nonBetaFeatureTag}
      </button>
      <button class="mainmenu-action-tile__resize all-nodes-item-resize" type="button" data-mainmenu-resize="map-builder" aria-label="Resize map builder"></button>
    </div>
  `);

  if (hasLoad) {
    tiles.push(`
      <div class="mainmenu-action-tile mainmenu-action-tile--compact" data-mainmenu-tile="load">
        <div class="mainmenu-action-tile__controls">
          <span class="mainmenu-action-tile__grip all-nodes-item-grip" aria-hidden="true">::</span>
          <button class="mainmenu-action-tile__control mainmenu-action-tile__control--color all-nodes-item-color" type="button" data-mainmenu-color="load" aria-label="Cycle load game color"><span class="all-nodes-item-color-dot" aria-hidden="true"></span></button>
          <button class="mainmenu-action-tile__control mainmenu-action-tile__control--minimize all-nodes-item-minimize" type="button" data-mainmenu-minimize="load" aria-label="Minimize load game">_</button>
        </div>
        <button class="mainmenu-btn mainmenu-btn-secondary all-nodes-node-btn all-nodes-node-btn--stable" data-action="load" type="button">
          <span class="btn-icon node-icon">📂</span>
          <span class="btn-text node-label">LOAD GAME</span>
        </button>
        <button class="mainmenu-action-tile__resize all-nodes-item-resize" type="button" data-mainmenu-resize="load" aria-label="Resize load game"></button>
      </div>
    `);
  }

  tiles.push(`
    <div class="mainmenu-action-tile mainmenu-action-tile--compact" data-mainmenu-tile="settings">
      <div class="mainmenu-action-tile__controls">
        <span class="mainmenu-action-tile__grip all-nodes-item-grip" aria-hidden="true">::</span>
        <button class="mainmenu-action-tile__control mainmenu-action-tile__control--color all-nodes-item-color" type="button" data-mainmenu-color="settings" aria-label="Cycle settings color"><span class="all-nodes-item-color-dot" aria-hidden="true"></span></button>
        <button class="mainmenu-action-tile__control mainmenu-action-tile__control--minimize all-nodes-item-minimize" type="button" data-mainmenu-minimize="settings" aria-label="Minimize settings">_</button>
      </div>
      <button class="mainmenu-btn mainmenu-btn-secondary all-nodes-node-btn all-nodes-node-btn--utility" data-action="settings" type="button">
        <span class="btn-icon node-icon">⚙</span>
        <span class="btn-text node-label">SETTINGS</span>
      </button>
      <button class="mainmenu-action-tile__resize all-nodes-item-resize" type="button" data-mainmenu-resize="settings" aria-label="Resize settings"></button>
    </div>
    <div class="mainmenu-action-tile mainmenu-action-tile--compact" data-mainmenu-tile="import-content">
      <div class="mainmenu-action-tile__controls">
        <span class="mainmenu-action-tile__grip all-nodes-item-grip" aria-hidden="true">::</span>
        <button class="mainmenu-action-tile__control mainmenu-action-tile__control--color all-nodes-item-color" type="button" data-mainmenu-color="import-content" aria-label="Cycle import content color"><span class="all-nodes-item-color-dot" aria-hidden="true"></span></button>
        <button class="mainmenu-action-tile__control mainmenu-action-tile__control--minimize all-nodes-item-minimize" type="button" data-mainmenu-minimize="import-content" aria-label="Minimize import content">_</button>
      </div>
      <button class="mainmenu-btn mainmenu-btn-half mainmenu-btn-secondary all-nodes-node-btn all-nodes-node-btn--stable" data-action="import-content" type="button">
        <span class="btn-icon node-icon">IMP</span>
        <span class="btn-text node-label">IMPORT CONTENT</span>
        <span class="btn-subtitle node-desc">Drag in Technica bundles</span>
      </button>
      <button class="mainmenu-action-tile__resize all-nodes-item-resize" type="button" data-mainmenu-resize="import-content" aria-label="Resize import content"></button>
    </div>
    <div class="mainmenu-action-tile mainmenu-action-tile--compact" data-mainmenu-tile="exit">
      <div class="mainmenu-action-tile__controls">
        <span class="mainmenu-action-tile__grip all-nodes-item-grip" aria-hidden="true">::</span>
        <button class="mainmenu-action-tile__control mainmenu-action-tile__control--color all-nodes-item-color" type="button" data-mainmenu-color="exit" aria-label="Cycle exit color"><span class="all-nodes-item-color-dot" aria-hidden="true"></span></button>
        <button class="mainmenu-action-tile__control mainmenu-action-tile__control--minimize all-nodes-item-minimize" type="button" data-mainmenu-minimize="exit" aria-label="Minimize exit">_</button>
      </div>
      <button class="mainmenu-btn mainmenu-btn-tertiary all-nodes-node-btn all-nodes-node-btn--utility" data-action="exit" type="button">
        <span class="btn-icon node-icon">✕</span>
        <span class="btn-text node-label">EXIT</span>
      </button>
      <button class="mainmenu-action-tile__resize all-nodes-item-resize" type="button" data-mainmenu-resize="exit" aria-label="Resize exit"></button>
    </div>
  `);

  let html = tiles.join("");
  html = html.split(' data-mainmenu-color="').join(' data-controller-exclude="true" data-mainmenu-color="');
  html = html.split(' data-mainmenu-minimize="').join(' data-controller-exclude="true" data-mainmenu-minimize="');
  html = html.split(' data-mainmenu-resize="').join(' data-controller-exclude="true" data-mainmenu-resize="');
  if (hasContinue) {
    html = html.replace('data-action="continue" type="button"', 'data-action="continue" type="button" data-controller-default-focus="true"');
  } else {
    html = html.replace('data-action="new-op" type="button"', 'data-action="new-op" type="button" data-controller-default-focus="true"');
  }
  return html;
}

function getMainMenuViewport(): { width: number; height: number } {
  return {
    width: Math.max(window.innerWidth, 1),
    height: Math.max(window.innerHeight, 1),
  };
}

function getDefaultMainMenuTileSize(actionId: MainMenuActionId): { width: number; height: number } {
  switch (actionId) {
    case "continue":
      return { width: 387, height: 163 };
    case "echo-runs":
    case "map-builder":
    case "multiplayer":
      return { width: 359, height: 163 };
    case "new-op":
    case "load":
    case "settings":
    case "import-content":
    case "exit":
      return { width: 191, height: 61 };
    default:
      return { width: 359, height: 163 };
  }
}

function normalizeMainMenuButtonLayout(
  actionId: MainMenuActionId,
  partial: Partial<MainMenuButtonLayout> | undefined,
  fallback: MainMenuButtonLayout,
): MainMenuButtonLayout {
  const defaultSize = getDefaultMainMenuTileSize(actionId);
  const clampedSize = clampMainMenuTileSize(
    partial?.width ?? defaultSize.width,
    partial?.height ?? defaultSize.height,
  );
  return {
    x: partial?.x ?? fallback.x,
    y: partial?.y ?? fallback.y,
    width: clampedSize.width,
    height: clampedSize.height,
    minimized: partial?.minimized ?? fallback.minimized,
    themeIndex: partial?.themeIndex ?? fallback.themeIndex,
  };
}

function loadSavedMainMenuButtonLayout(): LoadedMainMenuButtonLayout {
  try {
    const raw = localStorage.getItem(MAIN_MENU_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return { layout: {}, viewport: null };
    }
    const parsed = JSON.parse(raw) as SavedMainMenuButtonLayoutPayload | Partial<Record<MainMenuActionId, Partial<MainMenuButtonLayout>>>;
    if (
      parsed
      && typeof parsed === "object"
      && "version" in parsed
      && parsed.version === MAIN_MENU_LAYOUT_VERSION
      && "layout" in parsed
      && parsed.layout
      && typeof parsed.layout === "object"
    ) {
      const viewport = "viewport" in parsed
        && parsed.viewport
        && typeof parsed.viewport === "object"
        && typeof parsed.viewport.width === "number"
        && Number.isFinite(parsed.viewport.width)
        && parsed.viewport.width > 0
        && typeof parsed.viewport.height === "number"
        && Number.isFinite(parsed.viewport.height)
        && parsed.viewport.height > 0
          ? { width: parsed.viewport.width, height: parsed.viewport.height }
          : null;
      return {
        layout: parsed.layout as Partial<Record<MainMenuActionId, Partial<MainMenuButtonLayout>>>,
        viewport,
      };
    }
    return { layout: {}, viewport: null };
  } catch (error) {
    console.warn("[MAINMENU] Failed to load button layout", error);
    return { layout: {}, viewport: null };
  }
}

function saveMainMenuButtonLayout(layout: Partial<Record<MainMenuActionId, MainMenuButtonLayout>>): void {
  try {
    const payload: SavedMainMenuButtonLayoutPayload = {
      version: MAIN_MENU_LAYOUT_VERSION,
      viewport: getMainMenuViewport(),
      layout,
    };
    localStorage.setItem(MAIN_MENU_LAYOUT_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("[MAINMENU] Failed to save button layout", error);
  }
}

function scaleSavedMainMenuButtonLayout(
  layout: Partial<Record<MainMenuActionId, Partial<MainMenuButtonLayout>>>,
  fromViewport: { width: number; height: number },
  toViewport: { width: number; height: number },
): Partial<Record<MainMenuActionId, Partial<MainMenuButtonLayout>>> {
  const widthScale = toViewport.width / Math.max(fromViewport.width, 1);
  const heightScale = toViewport.height / Math.max(fromViewport.height, 1);
  const scaled: Partial<Record<MainMenuActionId, Partial<MainMenuButtonLayout>>> = {};

  (Object.keys(layout) as MainMenuActionId[]).forEach((actionId) => {
    const entry = layout[actionId];
    if (!entry) {
      return;
    }
    scaled[actionId] = {
      ...entry,
      x: entry.x !== undefined ? Math.round(entry.x * widthScale) : undefined,
      y: entry.y !== undefined ? Math.round(entry.y * heightScale) : undefined,
      width: entry.width !== undefined ? Math.round(entry.width * widthScale) : undefined,
      height: entry.height !== undefined ? Math.round(entry.height * heightScale) : undefined,
    };
  });

  return scaled;
}

function getDefaultMainMenuButtonLayout(
  hasContinue: boolean,
  hasLoad: boolean,
): Partial<Record<MainMenuActionId, MainMenuButtonLayout>> {
  const viewport = getMainMenuViewport();
  const layoutScale = Math.max(0.72, Math.min(1.08, Math.min(viewport.width / 1440, viewport.height / 900)));
  const continueSize = clampMainMenuTileSize(387 * layoutScale, 163 * layoutScale);
  const featuredSize = clampMainMenuTileSize(359 * layoutScale, 163 * layoutScale);
  const compactSize = clampMainMenuTileSize(191 * layoutScale, 61 * layoutScale);
  const edgeMargin = Math.max(28, Math.round(viewport.width * 0.07));
  const topMargin = Math.max(88, Math.round(viewport.height * 0.16));
  const bottomMargin = Math.max(72, Math.round(viewport.height * 0.1));
  const columnGap = Math.max(32, Math.round(viewport.width * 0.032));
  const featuredRowGap = Math.max(28, Math.round(viewport.height * 0.04));
  const compactGap = Math.max(18, Math.round(viewport.height * 0.022));
  const leftPrimaryX = edgeMargin;
  const rightFeaturedX = Math.max(24, viewport.width - edgeMargin - featuredSize.width);
  const bottomPrimaryY = Math.max(24, viewport.height - bottomMargin - continueSize.height);
  const defaults: Partial<Record<MainMenuActionId, MainMenuButtonLayout>> = {
    "echo-runs": {
      x: rightFeaturedX,
      y: topMargin,
      ...featuredSize,
      minimized: false,
      themeIndex: 0,
    },
    multiplayer: {
      x: rightFeaturedX,
      y: topMargin + featuredSize.height + featuredRowGap,
      ...featuredSize,
      minimized: false,
      themeIndex: 1,
    },
    "map-builder": {
      x: rightFeaturedX,
      y: topMargin + (featuredSize.height + featuredRowGap) * 2,
      ...featuredSize,
      minimized: false,
      themeIndex: 3,
    },
  };
  const compactActions: MainMenuActionId[] = [];

  if (hasContinue) {
    defaults.continue = {
      x: leftPrimaryX,
      y: bottomPrimaryY,
      ...continueSize,
      minimized: false,
      themeIndex: 3,
    };
    compactActions.push("new-op");
  } else {
    defaults["new-op"] = {
      x: leftPrimaryX,
      y: bottomPrimaryY,
      ...continueSize,
      minimized: false,
      themeIndex: 3,
    };
  }

  if (hasLoad) {
    compactActions.push("load");
  }

  compactActions.push("settings", "import-content", "exit");

  const compactStackHeight = compactActions.length * compactSize.height + Math.max(0, compactActions.length - 1) * compactGap;
  const compactColumnX = Math.min(
    leftPrimaryX + continueSize.width + columnGap,
    Math.max(24, rightFeaturedX - compactSize.width - columnGap),
  );
  const compactStartY = Math.max(
    topMargin + Math.round(featuredSize.height * 0.35),
    Math.round((viewport.height - compactStackHeight) * 0.5),
  );

  compactActions.forEach((actionId, index) => {
    defaults[actionId] = {
      x: compactColumnX,
      y: compactStartY + index * (compactSize.height + compactGap),
      ...compactSize,
      minimized: false,
      themeIndex: 2,
    };
  });

  return defaults;
}

function clampMainMenuTilePosition(tile: HTMLElement, x: number, y: number, width?: number, height?: number): { x: number; y: number } {
  const tileWidth = width ?? (tile.offsetWidth || 280);
  const tileHeight = height ?? (tile.offsetHeight || 72);
  const snappedX = Math.round(x / MAIN_MENU_GRID_SIZE) * MAIN_MENU_GRID_SIZE;
  const snappedY = Math.round(y / MAIN_MENU_GRID_SIZE) * MAIN_MENU_GRID_SIZE;
  return {
    x: Math.min(Math.max(snappedX, 24), Math.max(24, window.innerWidth - tileWidth - 24)),
    y: Math.min(Math.max(snappedY, 24), Math.max(24, window.innerHeight - tileHeight - 24)),
  };
}

function clampMainMenuTileSize(width: number, height: number): { width: number; height: number } {
  const maxWidth = Math.max(MAIN_MENU_MIN_WIDTH, window.innerWidth - 48);
  const maxHeight = Math.max(MAIN_MENU_MIN_HEIGHT, window.innerHeight - 48);
  return {
    width: Math.min(maxWidth, Math.max(MAIN_MENU_MIN_WIDTH, Math.round(width / MAIN_MENU_GRID_SIZE) * MAIN_MENU_GRID_SIZE)),
    height: Math.min(maxHeight, Math.max(MAIN_MENU_MIN_HEIGHT, Math.round(height / MAIN_MENU_GRID_SIZE) * MAIN_MENU_GRID_SIZE)),
  };
}

function applyMainMenuTileState(
  tile: HTMLElement,
  layout: MainMenuButtonLayout,
  renderedPosition?: { x: number; y: number },
): void {
  const themeClassNames = [...MAIN_MENU_THEMES];
  tile.classList.remove("mainmenu-action-tile--minimized", ...themeClassNames);
  tile.classList.add(themeClassNames[layout.themeIndex % themeClassNames.length]);
  if (layout.minimized) {
    tile.classList.add("mainmenu-action-tile--minimized");
  }

  tile.style.left = `${renderedPosition?.x ?? layout.x}px`;
  tile.style.top = `${renderedPosition?.y ?? layout.y}px`;
  tile.style.width = `${layout.minimized ? MAIN_MENU_MINIMIZED_WIDTH : layout.width}px`;
  tile.style.height = `${layout.minimized ? MAIN_MENU_MINIMIZED_HEIGHT : layout.height}px`;

  const button = tile.querySelector<HTMLButtonElement>("button[data-action]");
  if (button) {
    button.classList.toggle("all-nodes-node-btn--minimized", layout.minimized);
    button.disabled = false;
  }
}

function getMinimizedMainMenuTilePosition(index: number): { x: number; y: number } {
  const gap = 12;
  const right = 24;
  const bottom = 24;
  const column = Math.floor(index / 5);
  const row = index % 5;
  return {
    x: window.innerWidth - MAIN_MENU_MINIMIZED_WIDTH - right - column * (MAIN_MENU_MINIMIZED_WIDTH + gap),
    y: window.innerHeight - MAIN_MENU_MINIMIZED_HEIGHT - bottom - row * (MAIN_MENU_MINIMIZED_HEIGHT + gap),
  };
}

function upgradeMainMenuToWorkspace(
  hasContinue: boolean,
  hasLoad: boolean,
  mostRecentSave: SaveInfo | null,
): void {
  cleanupMainMenuWorkspace?.();
  cleanupMainMenuWorkspace = null;

  const appRoot = document.getElementById("app");
  const mainMenuRoot = appRoot?.querySelector<HTMLElement>(".mainmenu-root");
  if (!mainMenuRoot) return;

  const legacyMenuSection = mainMenuRoot.querySelector<HTMLElement>(".mainmenu-menu-section");
  if (legacyMenuSection) {
    legacyMenuSection.classList.add("mainmenu-menu-section--ghost");
    legacyMenuSection.innerHTML = '<div class="mainmenu-menu-section-spacer" aria-hidden="true"></div>';
  }

  const workspace = document.createElement("div");
  workspace.className = "mainmenu-button-workspace";
  workspace.id = "mainmenuButtonWorkspace";
  workspace.setAttribute("aria-label", "Main menu action workspace");
  workspace.innerHTML = buildMainMenuButtonTiles(hasContinue, hasLoad, mostRecentSave);
  mainMenuRoot.appendChild(workspace);

  const version = document.createElement("div");
  version.className = "mainmenu-version mainmenu-version--floating";
  version.setAttribute("aria-label", "Game version");
  version.textContent = APP_VERSION;
  mainMenuRoot.appendChild(version);

  let currentViewport = getMainMenuViewport();
  const defaultLayout = getDefaultMainMenuButtonLayout(hasContinue, hasLoad);
  const loadedLayoutState = loadSavedMainMenuButtonLayout();
  const savedLayout = loadedLayoutState.viewport
    ? scaleSavedMainMenuButtonLayout(loadedLayoutState.layout, loadedLayoutState.viewport, currentViewport)
    : loadedLayoutState.layout;
  let isCustomLayout = Object.keys(savedLayout).length > 0;
  const layout = Object.fromEntries(
    Object.entries(defaultLayout).map(([actionId, fallback]) => [
      actionId,
      normalizeMainMenuButtonLayout(actionId as MainMenuActionId, savedLayout[actionId as MainMenuActionId], fallback as MainMenuButtonLayout),
    ]),
  ) as Partial<Record<MainMenuActionId, MainMenuButtonLayout>>;
  const tiles = Array.from(workspace.querySelectorAll<HTMLElement>("[data-mainmenu-tile]"));
  const applyDefaultLayout = () => {
    const nextDefaults = getDefaultMainMenuButtonLayout(hasContinue, hasLoad);
    (Object.keys(layout) as MainMenuActionId[]).forEach((actionId) => {
      delete layout[actionId];
    });
    Object.entries(nextDefaults).forEach(([actionId, nextLayout]) => {
      layout[actionId as MainMenuActionId] = nextLayout as MainMenuButtonLayout;
    });
  };
  const persistLayout = () => {
    isCustomLayout = true;
    saveMainMenuButtonLayout(layout);
  };

  const applyPositions = () => {
    const minimizedActionIds = tiles
      .map((tile) => tile.dataset.mainmenuTile as MainMenuActionId | undefined)
      .filter((actionId): actionId is MainMenuActionId => Boolean(actionId && layout[actionId]?.minimized));

    tiles.forEach((tile) => {
      const actionId = tile.dataset.mainmenuTile as MainMenuActionId | undefined;
      if (!actionId) return;
      const tileLayout = layout[actionId];
      if (!tileLayout) return;
      if (tileLayout.minimized) {
        const dockIndex = minimizedActionIds.indexOf(actionId);
        const dockedPos = getMinimizedMainMenuTilePosition(Math.max(dockIndex, 0));
        applyMainMenuTileState(tile, tileLayout, dockedPos);
        return;
      }

      const clampedSize = clampMainMenuTileSize(tileLayout.width, tileLayout.height);
      const clampedPos = clampMainMenuTilePosition(tile, tileLayout.x, tileLayout.y, clampedSize.width, clampedSize.height);
      layout[actionId] = { ...tileLayout, ...clampedSize, ...clampedPos };
      applyMainMenuTileState(tile, layout[actionId] as MainMenuButtonLayout);
    });
  };

  requestAnimationFrame(() => {
    applyPositions();
    if (isCustomLayout) {
      saveMainMenuButtonLayout(layout);
    }
  });

  const handleResize = () => {
    const nextViewport = getMainMenuViewport();
    if (nextViewport.width === currentViewport.width && nextViewport.height === currentViewport.height) {
      return;
    }

    if (isCustomLayout) {
      const scaledLayout = scaleSavedMainMenuButtonLayout(layout, currentViewport, nextViewport);
      (Object.keys(scaledLayout) as MainMenuActionId[]).forEach((actionId) => {
        const currentLayout = layout[actionId];
        const scaledEntry = scaledLayout[actionId];
        if (!currentLayout || !scaledEntry) {
          return;
        }
        layout[actionId] = normalizeMainMenuButtonLayout(actionId, scaledEntry, currentLayout);
      });
      currentViewport = nextViewport;
      applyPositions();
      saveMainMenuButtonLayout(layout);
      return;
    }

    currentViewport = nextViewport;
    applyDefaultLayout();
    applyPositions();
  };

  window.addEventListener("resize", handleResize, { passive: true });
  const cleanupCallbacks: Array<() => void> = [
    () => window.removeEventListener("resize", handleResize),
  ];

  tiles.forEach((tile) => {
    const actionId = tile.dataset.mainmenuTile as MainMenuActionId | undefined;
    const button = tile.querySelector<HTMLButtonElement>("button[data-action]");
    const colorBtn = tile.querySelector<HTMLButtonElement>(`button[data-mainmenu-color="${actionId}"]`);
    const minimizeBtn = tile.querySelector<HTMLButtonElement>(`button[data-mainmenu-minimize="${actionId}"]`);
    const resizeBtn = tile.querySelector<HTMLButtonElement>(`button[data-mainmenu-resize="${actionId}"]`);
    if (!actionId || !button) return;

    let activePointerId: number | null = null;
    let originX = 0;
    let originY = 0;
    let startX = 0;
    let startY = 0;
    let dragged = false;
    let resizePointerId: number | null = null;
    let resizeStartWidth = 0;
    let resizeStartHeight = 0;

    const removeDragListeners = () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
    };

    const endDrag = () => {
      removeDragListeners();
      activePointerId = null;
      tile.classList.remove("mainmenu-action-tile--dragging");
      if (dragged) {
        tile.dataset.preventClick = "true";
        window.setTimeout(() => delete tile.dataset.preventClick, 0);
      }
      dragged = false;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement).closest(".mainmenu-action-tile__control, .mainmenu-action-tile__resize")) return;
      const tileLayout = layout[actionId];
      if (!tileLayout) return;
      if (tileLayout.minimized) return;
      if (activePointerId !== null) {
        endDrag();
      }
      activePointerId = event.pointerId;
      originX = tileLayout.x;
      originY = tileLayout.y;
      startX = event.clientX;
      startY = event.clientY;
      dragged = false;
      window.addEventListener("pointermove", handleWindowPointerMove);
      window.addEventListener("pointerup", handleWindowPointerUp);
      window.addEventListener("pointercancel", handleWindowPointerCancel);
    };

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) return;
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (!dragged && Math.hypot(deltaX, deltaY) < MAIN_MENU_DRAG_THRESHOLD) {
        return;
      }
      if (!dragged) {
        dragged = true;
        tile.classList.add("mainmenu-action-tile--dragging");
      }
      const currentLayout = layout[actionId];
      if (!currentLayout) return;
      const clamped = clampMainMenuTilePosition(tile, originX + deltaX, originY + deltaY, currentLayout.width, currentLayout.minimized ? MAIN_MENU_MINIMIZED_HEIGHT : currentLayout.height);
      layout[actionId] = { ...currentLayout, ...clamped };
      applyMainMenuTileState(tile, layout[actionId] as MainMenuButtonLayout);
    };

    const handleWindowPointerUp = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) return;
      if (dragged) {
        persistLayout();
      }
      endDrag();
    };

    const handleWindowPointerCancel = (event: PointerEvent) => {
      if (activePointerId !== event.pointerId) return;
      endDrag();
    };

    const handleClickCapture = (event: Event) => {
      const currentLayout = layout[actionId];
      if (currentLayout?.minimized) {
        event.preventDefault();
        event.stopImmediatePropagation();
        layout[actionId] = {
          ...currentLayout,
          minimized: false,
        };
        applyPositions();
        persistLayout();
        return;
      }
      if (tile.dataset.preventClick === "true") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const handleResizePointerDown = (event: PointerEvent) => {
      if (!resizeBtn || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const currentLayout = layout[actionId];
      if (!currentLayout || currentLayout.minimized) return;
      resizePointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      resizeStartWidth = currentLayout.width;
      resizeStartHeight = currentLayout.height;
      tile.classList.add("mainmenu-action-tile--resizing");
      resizeBtn.setPointerCapture(event.pointerId);
    };

    const handleResizePointerMove = (event: PointerEvent) => {
      if (resizePointerId !== event.pointerId) return;
      const currentLayout = layout[actionId];
      if (!currentLayout) return;
      const nextSize = clampMainMenuTileSize(resizeStartWidth + (event.clientX - startX), resizeStartHeight + (event.clientY - startY));
      const nextPos = clampMainMenuTilePosition(tile, currentLayout.x, currentLayout.y, nextSize.width, nextSize.height);
      layout[actionId] = { ...currentLayout, ...nextPos, ...nextSize };
      applyMainMenuTileState(tile, layout[actionId] as MainMenuButtonLayout);
    };

    const handleResizePointerUp = (event: PointerEvent) => {
      if (!resizeBtn || resizePointerId !== event.pointerId) return;
      resizeBtn.releasePointerCapture(event.pointerId);
      resizePointerId = null;
      tile.classList.remove("mainmenu-action-tile--resizing");
      persistLayout();
    };

    const handleColorClick = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      const currentLayout = layout[actionId];
      if (!currentLayout) return;
      layout[actionId] = {
        ...currentLayout,
        themeIndex: (currentLayout.themeIndex + 1) % MAIN_MENU_THEMES.length,
      };
      applyMainMenuTileState(tile, layout[actionId] as MainMenuButtonLayout);
      persistLayout();
    };

    const handleMinimizeClick = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      const currentLayout = layout[actionId];
      if (!currentLayout) return;
      layout[actionId] = {
        ...currentLayout,
        minimized: !currentLayout.minimized,
      };
      if (!currentLayout.minimized) {
        layout[actionId] = {
          ...layout[actionId] as MainMenuButtonLayout,
          ...clampMainMenuTilePosition(tile, currentLayout.x, currentLayout.y, currentLayout.width, currentLayout.height),
        };
      }
      applyPositions();
      persistLayout();
    };

    tile.addEventListener("pointerdown", handlePointerDown);
    button.addEventListener("click", handleClickCapture, true);
    resizeBtn?.addEventListener("pointerdown", handleResizePointerDown);
    resizeBtn?.addEventListener("pointermove", handleResizePointerMove);
    resizeBtn?.addEventListener("pointerup", handleResizePointerUp);
    resizeBtn?.addEventListener("pointercancel", handleResizePointerUp as EventListener);
    colorBtn?.addEventListener("click", handleColorClick);
    minimizeBtn?.addEventListener("click", handleMinimizeClick);

    cleanupCallbacks.push(() => tile.removeEventListener("pointerdown", handlePointerDown));
    cleanupCallbacks.push(removeDragListeners);
    cleanupCallbacks.push(() => button.removeEventListener("click", handleClickCapture, true));
    if (resizeBtn) {
      cleanupCallbacks.push(() => resizeBtn.removeEventListener("pointerdown", handleResizePointerDown));
      cleanupCallbacks.push(() => resizeBtn.removeEventListener("pointermove", handleResizePointerMove));
      cleanupCallbacks.push(() => resizeBtn.removeEventListener("pointerup", handleResizePointerUp));
      cleanupCallbacks.push(() => resizeBtn.removeEventListener("pointercancel", handleResizePointerUp as EventListener));
    }
    if (colorBtn) cleanupCallbacks.push(() => colorBtn.removeEventListener("click", handleColorClick));
    if (minimizeBtn) cleanupCallbacks.push(() => minimizeBtn.removeEventListener("click", handleMinimizeClick));
  });

  cleanupMainMenuWorkspace = () => {
    cleanupCallbacks.forEach((callback) => callback());
  };
}

// ----------------------------------------------------------------------------
// TERMINAL ANIMATION
// ----------------------------------------------------------------------------

function isTerminalPromptLine(line: string): boolean {
  return line.startsWith(TERMINAL_PROMPT_PREFIX);
}

function startTerminalAnimationByIds(bodyId: string, outputId: string, flavorLines: string[]): () => void {
  return startTerminalTypingByIds(bodyId, outputId, flavorLines, {
    cursorPrompt: TERMINAL_PROMPT_PREFIX,
    baseCharDelayMs: 20,
    minCharDelayMs: 7,
    accelerationPerCharMs: 0.65,
    pauseAfterLineMs: 220,
    pauseAfterEmptyLineMs: 120,
    maxLines: 18,
    loop: true,
    scrollBehavior: "auto",
    promptParser: (line) => {
      if (!isTerminalPromptLine(line)) {
        return null;
      }
      const parts = line.split("::");
      return {
        prompt: parts[0],
        text: parts.slice(1).join("::"),
      };
    },
  });
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------------------

function attachMenuListeners(saves: SaveInfo[]): void {
  const root = document.getElementById("app");
  if (!root) return;
  const mainMenuRoot = root.querySelector<HTMLElement>(".mainmenu-root");

  // Continue button
  const continueBtn = root.querySelector<HTMLButtonElement>('button[data-action="continue"]');
  if (continueBtn) {
    continueBtn.addEventListener("click", async () => {
      continueBtn.disabled = true;
      const originalHtml = continueBtn.innerHTML;
      continueBtn.innerHTML = `<span class="btn-text">Loading...</span>`;
      
      const result = await loadMostRecent();
      if (result.success && result.state) {
        saveCampaignProgress(result.campaignProgress ?? createDefaultCampaignProgress());
        setGameState(result.state);
        enableAutosave(() => getGameState());
        teardownMainMenuWorkspace();
        void resumeLoadedGame("field");
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
    newOpBtn.addEventListener("click", async () => {
      if (saves.length > 0) {
        if (!(await confirmNewOperationStart())) {
          return;
        }
      }

      newOpBtn.disabled = true;
      const originalHtml = newOpBtn.innerHTML;
      newOpBtn.innerHTML = `<span class="btn-text">Starting...</span>`;

      clearActiveEchoRun();
      saveCampaignProgress(createDefaultCampaignProgress());
      resetToNewGame();
      const freshState = getGameState();

      const saveResult = await saveGame(SAVE_SLOTS.AUTOSAVE, freshState);
      if (!saveResult.success) {
        console.warn("[MAINMENU] Failed to initialize fresh autosave for new operation:", saveResult.error);
      }

      enableAutosave(() => getGameState());
      teardownMainMenuWorkspace();
      renderFieldScreen("base_camp");

      newOpBtn.disabled = false;
      newOpBtn.innerHTML = originalHtml;
    });
  }

  const echoRunsBtn = root.querySelector<HTMLButtonElement>('button[data-action="echo-runs"]');
  if (echoRunsBtn) {
    echoRunsBtn.addEventListener("click", async () => {
      const { renderEchoRunTitleScreen } = await import("./EchoRunTitleScreen");
      teardownMainMenuWorkspace();
      renderEchoRunTitleScreen();
    });
  }

  const multiplayerBtn = root.querySelector<HTMLButtonElement>('button[data-action="multiplayer"]');
  if (multiplayerBtn) {
    multiplayerBtn.addEventListener("click", async () => {
      const { renderCommsArrayScreen } = await import("./CommsArrayScreen");
      teardownMainMenuWorkspace();
      renderCommsArrayScreen("menu");
    });
  }

  const mapBuilderBtn = root.querySelector<HTMLButtonElement>('button[data-action="map-builder"]');
  if (mapBuilderBtn) {
    mapBuilderBtn.addEventListener("click", async () => {
      const { renderMapBuilderScreen } = await import("./MapBuilderScreen");
      teardownMainMenuWorkspace();
      renderMapBuilderScreen();
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
      teardownMainMenuWorkspace();
      renderSettingsScreen("menu");
    });
  }

  const importContentBtn = root.querySelector<HTMLButtonElement>('button[data-action="import-content"]');
  if (importContentBtn) {
    importContentBtn.addEventListener("click", () => {
      teardownMainMenuWorkspace();
      renderImportContentScreen();
    });
  }

  const newTerminalBtn = root.querySelector<HTMLButtonElement>('button[data-action="new-terminal"]');
  if (newTerminalBtn) {
    newTerminalBtn.addEventListener("click", () => {
      createFloatingTerminalWindow();
    });
  }

  const cycleBackgroundBtn = root.querySelector<HTMLButtonElement>('button[data-action="cycle-background"]');
  if (cycleBackgroundBtn && mainMenuRoot) {
    cycleBackgroundBtn.addEventListener("click", () => {
      cycleMainMenuBackgroundTheme(mainMenuRoot);
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
      hideMainMenuModal("loadModal", 'button[data-action="load"]');
    });
  }
  
  const closeSaveModal = document.getElementById("closeSaveModal");
  if (closeSaveModal) {
    closeSaveModal.addEventListener("click", () => {
      hideMainMenuModal("saveModal", 'button[data-action="settings"]');
    });
  }
  
  // Modal backdrop clicks
  document.getElementById("loadModal")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("mainmenu-modal")) {
      hideMainMenuModal("loadModal", 'button[data-action="load"]');
    }
  });
  
  document.getElementById("saveModal")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("mainmenu-modal")) {
      hideMainMenuModal("saveModal", 'button[data-action="settings"]');
    }
  });

  document.getElementById("saveOverwriteConfirmModal")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("mainmenu-modal")) {
      hideMainMenuModal("saveOverwriteConfirmModal", "#saveModal .save-slot-btn, #closeSaveModal");
    }
  });
}

function createFloatingTerminalWindow(): void {
  const floatingLayer = document.getElementById("mainmenuFloatingLayer");
  if (!floatingLayer) return;

  floatingTerminalCount += 1;
  const terminalId = `mainmenuFloatingTerminal${floatingTerminalCount}`;
  const terminalBodyId = `${terminalId}Body`;
  const terminalOutputId = `${terminalId}Output`;
  const title = FLOATING_TERMINAL_TITLES[(floatingTerminalCount - 1) % FLOATING_TERMINAL_TITLES.length];
  const offsetIndex = floatingTerminalCount - 1;
  const left = Math.min(480 + offsetIndex * 28, Math.max(480, window.innerWidth - 420));
  const top = Math.min(72 + offsetIndex * 22, Math.max(24, window.innerHeight - 360));

  const windowEl = document.createElement("div");
  windowEl.className = "mainmenu-terminal-window mainmenu-terminal-window--floating";
  windowEl.id = terminalId;
  windowEl.style.left = `${left}px`;
  windowEl.style.top = `${top}px`;
  windowEl.style.zIndex = String(++floatingTerminalZIndex);
  windowEl.innerHTML = `
    <div class="mainmenu-terminal-header">
      <span class="terminal-window-title">${title}</span>
      <div class="mainmenu-terminal-controls">
        <span class="terminal-window-status">[ACTIVE]</span>
        <button
          class="mainmenu-terminal-close"
          type="button"
          aria-label="Close terminal window"
          data-close-terminal="${terminalId}"
        >
          ✕
        </button>
      </div>
    </div>
    <div class="mainmenu-terminal-body" id="${terminalBodyId}">
      <div class="mainmenu-terminal-output" id="${terminalOutputId}"></div>
    </div>
  `;

  floatingLayer.appendChild(windowEl);
  enhanceTerminalUiButtons(windowEl);

  windowEl.addEventListener("pointerdown", () => {
    windowEl.style.zIndex = String(++floatingTerminalZIndex);
  });

  const closeBtn = windowEl.querySelector<HTMLButtonElement>(`button[data-close-terminal="${terminalId}"]`);

  const floatingFlavorLines = [
    `${TERMINAL_PROMPT_PREFIX} WINDOW_STATUS   :: Auxiliary console online.`,
    `${TERMINAL_PROMPT_PREFIX} NODE_ID         :: ${terminalId.toUpperCase()}`,
    `${TERMINAL_PROMPT_PREFIX} QUAC_BRIDGE     :: Listening for local shell requests.`,
    "",
    `${TERMINAL_PROMPT_PREFIX} DIAGNOSTICS     :: Memory lattice stable.`,
    `${TERMINAL_PROMPT_PREFIX} DIAGNOSTICS     :: Riftwatch telemetry buffered.`,
    `${TERMINAL_PROMPT_PREFIX} USER_HINT       :: Drag this header to reposition.`,
    `${TERMINAL_PROMPT_PREFIX} USER_HINT       :: Use ✕ to dismiss the pane.`,
  ];

  const cleanupFloatingTerminal = startTerminalAnimationByIds(terminalBodyId, terminalOutputId, floatingFlavorLines);
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      cleanupFloatingTerminal();
      windowEl.remove();
    });
  }
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
            saveCampaignProgress(result.campaignProgress ?? createDefaultCampaignProgress());
            setGameState(result.state);
            enableAutosave(() => getGameState());
            hideMainMenuModal("loadModal", 'button[data-action="load"]');
            teardownMainMenuWorkspace();
            void resumeLoadedGame("esc");
          } else {
            alert("Failed to load save: " + (result.error ?? "Unknown error"));
          }
        }
      });
    }
  });
  
  showMainMenuModal("loadModal", "#loadModal .load-save-btn, #closeLoadModal");
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

        if (isOverwrite && !(await confirmSaveOverwrite())) {
          return;
        }

        const state = getGameState();
        const result = await saveGame(slot, state);
        
        if (result.success) {
          hideMainMenuModal("saveModal", 'button[data-action="settings"]');
          alert("Game saved successfully!");
        } else {
          alert("Failed to save: " + (result.error ?? "Unknown error"));
        }
      });
    }
  });
  
  showMainMenuModal("saveModal", "#saveModal .save-slot-btn, #closeSaveModal");
}

export { renderMainMenu as default };

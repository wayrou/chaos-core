// ============================================================================
// ALL NODES MENU SCREEN - Standalone menu for quick node access
// An independent screen (not an overlay) containing all base camp nodes
// ============================================================================

import "../../field/field.css"; // Import styles for the menu screen
import { getGameState } from "../../state/gameStore";
import { renderBaseCampScreen } from "./BaseCampScreen";
import { renderFieldScreen } from "../../field/FieldScreen";

// Track last field map for returning to field mode
let lastFieldMap: string = "base_camp";

/**
 * Render the All Nodes Menu Screen
 * This is a standalone screen that shows all available nodes as clickable buttons
 */
export function renderAllNodesMenuScreen(fromFieldMap?: string): void {
  const root = document.getElementById("app");
  if (!root) return;

  // Remember where we came from
  if (fromFieldMap) {
    lastFieldMap = fromFieldMap;
  }

  const state = getGameState();
  const wad = state.wad ?? 0;
  const res = state.resources ?? {
    metalScrap: 0,
    wood: 0,
    chaosShards: 0,
    steamComponents: 0,
  };

  root.innerHTML = `
    <div class="all-nodes-menu-screen">
      <div class="all-nodes-menu-header">
        <div class="all-nodes-menu-title">BASE CAMP</div>
        <div class="all-nodes-menu-subtitle">QUICK ACCESS MENU</div>
      </div>

      <div class="all-nodes-menu-mode-toggle">
        <button class="all-nodes-menu-mode-btn all-nodes-menu-mode-btn--active" data-mode="menu">
          <span class="mode-icon">📋</span>
          <span class="mode-label">COMMAND</span>
        </button>
        <button class="all-nodes-menu-mode-btn" data-mode="field">
          <span class="mode-icon">🌍</span>
          <span class="mode-label">FIELD</span>
        </button>
      </div>

      <div class="all-nodes-menu-resources">
        <div class="all-nodes-menu-resource">
          <span class="resource-icon">💰</span>
          <span class="resource-label">WAD</span>
          <span class="resource-value">${wad.toLocaleString()}</span>
        </div>
        <div class="all-nodes-menu-resource">
          <span class="resource-icon">⚙</span>
          <span class="resource-label">METAL</span>
          <span class="resource-value">${res.metalScrap}</span>
        </div>
        <div class="all-nodes-menu-resource">
          <span class="resource-icon">🪵</span>
          <span class="resource-label">WOOD</span>
          <span class="resource-value">${res.wood}</span>
        </div>
        <div class="all-nodes-menu-resource">
          <span class="resource-icon">💎</span>
          <span class="resource-label">SHARDS</span>
          <span class="resource-value">${res.chaosShards}</span>
        </div>
        <div class="all-nodes-menu-resource">
          <span class="resource-icon">⚗</span>
          <span class="resource-label">STEAM</span>
          <span class="resource-value">${res.steamComponents}</span>
        </div>
      </div>

      <div class="all-nodes-menu-grid">
        <button class="all-nodes-menu-btn" data-action="ops-terminal">
          <span class="btn-icon">🎯</span>
          <span class="btn-label">OPS TERMINAL</span>
          <span class="btn-desc">Start operations</span>
        </button>
        <button class="all-nodes-menu-btn" data-action="roster">
          <span class="btn-icon">👥</span>
          <span class="btn-label">UNIT ROSTER</span>
          <span class="btn-desc">Manage your units</span>
        </button>
        <button class="all-nodes-menu-btn" data-action="loadout">
          <span class="btn-icon">🎒</span>
          <span class="btn-label">LOADOUT</span>
          <span class="btn-desc">Equipment & inventory</span>
        </button>
        <button class="all-nodes-menu-btn" data-action="gear-workbench">
          <span class="btn-icon">🔧</span>
          <span class="btn-label">GEAR WORKBENCH</span>
          <span class="btn-desc">Upgrade weapons</span>
        </button>
        <button class="all-nodes-menu-btn" data-action="shop">
          <span class="btn-icon">🛒</span>
          <span class="btn-label">SHOP</span>
          <span class="btn-desc">Buy items & PAKs</span>
        </button>
        <button class="all-nodes-menu-btn" data-action="workshop">
          <span class="btn-icon">🔨</span>
          <span class="btn-label">WORKSHOP</span>
          <span class="btn-desc">Craft items</span>
        </button>
        <button class="all-nodes-menu-btn" data-action="tavern">
          <span class="btn-icon">🍺</span>
          <span class="btn-label">TAVERN</span>
          <span class="btn-desc">Recruit units</span>
        </button>
        <button class="all-nodes-menu-btn" data-action="quest-board">
          <span class="btn-icon">📋</span>
          <span class="btn-label">QUEST BOARD</span>
          <span class="btn-desc">View quests</span>
        </button>
        <button class="all-nodes-menu-btn" data-action="port">
          <span class="btn-icon">⚓</span>
          <span class="btn-label">PORT</span>
          <span class="btn-desc">Trade resources</span>
        </button>
        <button class="all-nodes-menu-btn" data-action="quarters">
          <span class="btn-icon">🛏</span>
          <span class="btn-label">QUARTERS</span>
          <span class="btn-desc">Rest & buffs</span>
        </button>
        <button class="all-nodes-menu-btn" data-action="settings">
          <span class="btn-icon">⚙</span>
          <span class="btn-label">SETTINGS</span>
          <span class="btn-desc">Game options</span>
        </button>
      </div>

      <div class="all-nodes-menu-footer">
        <div class="all-nodes-menu-debug-section">
          <div class="debug-label">DEBUG MODES</div>
          <div class="debug-buttons">
            <button class="all-nodes-menu-btn all-nodes-menu-btn--debug" data-action="endless-field-nodes">
              <span class="btn-icon">∞</span>
              <span class="btn-label">ENDLESS ROOMS</span>
            </button>
            <button class="all-nodes-menu-btn all-nodes-menu-btn--debug" data-action="endless-battles">
              <span class="btn-icon">⚔</span>
              <span class="btn-label">ENDLESS BATTLES</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  attachAllNodesMenuListeners();
}

function attachAllNodesMenuListeners(): void {
  const root = document.getElementById("app");
  if (!root) return;

  // Mode toggle buttons
  const modeButtons = root.querySelectorAll(".all-nodes-menu-mode-btn");
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const mode = (btn as HTMLElement).dataset.mode;
      handleModeSwitch(mode);
    });
  });

  // Node action buttons
  const actionButtons = root.querySelectorAll(".all-nodes-menu-btn[data-action]");
  actionButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const action = (btn as HTMLElement).dataset.action;
      if (action) {
        handleNodeAction(action);
      }
    });
  });

  // ESC key to go to field mode
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleModeSwitch("field");
      window.removeEventListener("keydown", escHandler);
    }
  };
  window.addEventListener("keydown", escHandler);
}

function handleModeSwitch(mode: string | undefined): void {
  switch (mode) {
    case "field":
      renderFieldScreen(lastFieldMap as any);
      break;
    case "classic":
      renderBaseCampScreen();
      break;
    case "menu":
      // Already on menu, do nothing
      break;
  }
}

function handleNodeAction(action: string): void {
  switch (action) {
    case "shop":
      import("./ShopScreen").then(({ renderShopScreen }) => {
        renderShopScreen("basecamp");
      });
      break;
    case "workshop":
      import("./WorkshopScreen").then(({ renderCraftingScreen }) => {
        renderCraftingScreen("basecamp");
      });
      break;
    case "roster":
      import("./RosterScreen").then(({ renderRosterScreen }) => {
        renderRosterScreen("basecamp");
      });
      break;
    case "loadout":
      import("./InventoryScreen").then(({ renderInventoryScreen }) => {
        renderInventoryScreen("basecamp");
      });
      break;
    case "quest-board":
      import("./QuestBoardScreen").then(({ renderQuestBoardScreen }) => {
        renderQuestBoardScreen("basecamp");
      });
      break;
    case "tavern":
      import("./RecruitmentScreen").then(({ renderRecruitmentScreen }) => {
        renderRecruitmentScreen("basecamp");
      });
      break;
    case "ops-terminal":
      import("./OperationSelectScreen").then(({ renderOperationSelectScreen }) => {
        renderOperationSelectScreen("basecamp");
      });
      break;
    case "gear-workbench":
      import("./GearWorkbenchScreen").then(({ renderGearWorkbenchScreen }) => {
        const state = getGameState();
        const firstUnitId = state.partyUnitIds?.[0] ?? null;
        if (firstUnitId) {
          const unit = state.unitsById[firstUnitId];
          const weaponId = (unit as any)?.loadout?.weapon ?? null;
          renderGearWorkbenchScreen(firstUnitId, weaponId, "basecamp");
        } else {
          renderGearWorkbenchScreen(undefined, undefined, "basecamp");
        }
      });
      break;
    case "port":
      import("./PortScreen").then(({ renderPortScreen }) => {
        renderPortScreen("basecamp");
      });
      break;
    case "quarters":
      // Go to quarters in field mode
      renderFieldScreen("quarters");
      break;
    case "settings":
      import("./SettingsScreen").then(({ renderSettingsScreen }) => {
        renderSettingsScreen("basecamp");
      });
      break;
    case "endless-field-nodes":
      import("./FieldNodeRoomScreen").then(({ renderFieldNodeRoomScreen }) => {
        const initialSeed = Math.floor(Math.random() * 1000000);
        renderFieldNodeRoomScreen("endless_room_0", initialSeed, true);
      });
      break;
    case "endless-battles":
      import("./BattleScreen").then(({ startEndlessBattleMode }) => {
        startEndlessBattleMode();
      });
      break;
  }
}

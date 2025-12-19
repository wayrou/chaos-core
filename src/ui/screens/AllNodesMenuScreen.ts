// ============================================================================
// ALL NODES MENU SCREEN - Standalone menu for quick node access
// An independent screen (not an overlay) containing all base camp nodes
// ============================================================================

import "../../field/field.css"; // Import styles for the menu screen
import { getGameState } from "../../state/gameStore";
// BaseCampScreen removed - using AllNodesMenuScreen instead
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
    <div class="all-nodes-menu-screen ard-noise">
      <!-- Terminal Header (ScrollLink OS) -->
      <header class="all-nodes-menu-header">
        <div class="all-nodes-terminal-bar">
          <span class="terminal-indicator"></span>
          <span class="terminal-text">SCROLLLINK.OS // BASE_CAMP.SYS</span>
        </div>
        <h1 class="all-nodes-menu-title">BASE CAMP</h1>
        <p class="all-nodes-menu-subtitle">QUICK ACCESS COMMAND INTERFACE</p>
      </header>

      <!-- Mode Toggle (FFTA-style tabs) -->
      <nav class="all-nodes-menu-mode-toggle">
        <button class="all-nodes-mode-tab all-nodes-mode-tab--active" data-mode="menu">
          <span class="mode-icon">[CMD]</span>
          <span class="mode-label">COMMAND</span>
        </button>
        <button class="all-nodes-mode-tab" data-mode="field">
          <span class="mode-icon">[FLD]</span>
          <span class="mode-label">FIELD</span>
        </button>
      </nav>

      <!-- Resources Bar (Adventure Gothic panel) -->
      <div class="all-nodes-menu-resources ard-panel--inset">
        <div class="all-nodes-resource">
          <span class="resource-icon">W</span>
          <span class="resource-value">${wad.toLocaleString()}</span>
          <span class="resource-label">WAD</span>
        </div>
        <div class="all-nodes-resource">
          <span class="resource-icon">M</span>
          <span class="resource-value">${res.metalScrap}</span>
          <span class="resource-label">METAL</span>
        </div>
        <div class="all-nodes-resource">
          <span class="resource-icon">T</span>
          <span class="resource-value">${res.wood}</span>
          <span class="resource-label">TIMBER</span>
        </div>
        <div class="all-nodes-resource">
          <span class="resource-icon">C</span>
          <span class="resource-value">${res.chaosShards}</span>
          <span class="resource-label">CHAOS</span>
        </div>
        <div class="all-nodes-resource">
          <span class="resource-icon">S</span>
          <span class="resource-value">${res.steamComponents}</span>
          <span class="resource-label">STEAM</span>
        </div>
      </div>

      <!-- Node Grid (World Panels) -->
      <div class="all-nodes-menu-grid">
        <button class="all-nodes-node-btn all-nodes-node-btn--primary" data-action="ops-terminal">
          <span class="node-icon">OPS</span>
          <span class="node-label">OPS TERMINAL</span>
          <span class="node-desc">Deploy on operations</span>
        </button>
        <button class="all-nodes-node-btn" data-action="roster">
          <span class="node-icon">RST</span>
          <span class="node-label">UNIT ROSTER</span>
          <span class="node-desc">Manage your units</span>
        </button>
        <button class="all-nodes-node-btn" data-action="loadout">
          <span class="node-icon">LDT</span>
          <span class="node-label">LOADOUT</span>
          <span class="node-desc">Equipment & inventory</span>
        </button>
        <button class="all-nodes-node-btn" data-action="inventory">
          <span class="node-icon">INV</span>
          <span class="node-label">INVENTORY</span>
          <span class="node-desc">View all owned items</span>
        </button>
        <button class="all-nodes-node-btn" data-action="gear-workbench">
          <span class="node-icon">GWB</span>
          <span class="node-label">GEAR WORKBENCH</span>
          <span class="node-desc">Upgrade & modify gear</span>
        </button>
        <button class="all-nodes-node-btn" data-action="shop">
          <span class="node-icon">SHP</span>
          <span class="node-label">SHOP</span>
          <span class="node-desc">Buy items & PAKs</span>
        </button>
        <button class="all-nodes-node-btn" data-action="workshop">
          <span class="node-icon">WKS</span>
          <span class="node-label">WORKSHOP</span>
          <span class="node-desc">Craft new items</span>
        </button>
        <button class="all-nodes-node-btn" data-action="tavern">
          <span class="node-icon">TAV</span>
          <span class="node-label">TAVERN</span>
          <span class="node-desc">Recruit new units</span>
        </button>
        <button class="all-nodes-node-btn" data-action="quest-board">
          <span class="node-icon">QST</span>
          <span class="node-label">QUEST BOARD</span>
          <span class="node-desc">View active quests</span>
        </button>
        <button class="all-nodes-node-btn" data-action="port">
          <span class="node-icon">PRT</span>
          <span class="node-label">PORT</span>
          <span class="node-desc">Trade resources</span>
        </button>
        <button class="all-nodes-node-btn" data-action="quarters">
          <span class="node-icon">QTR</span>
          <span class="node-label">QUARTERS</span>
          <span class="node-desc">Rest & heal units</span>
        </button>
        <button class="all-nodes-node-btn all-nodes-node-btn--stable" data-action="stable">
          <span class="node-icon">STB</span>
          <span class="node-label">STABLE</span>
          <span class="node-desc">Manage mounts</span>
        </button>
        <button class="all-nodes-node-btn all-nodes-node-btn--utility" data-action="settings">
          <span class="node-icon">CFG</span>
          <span class="node-label">SETTINGS</span>
          <span class="node-desc">Game options</span>
        </button>
        <button class="all-nodes-node-btn all-nodes-node-btn--utility" data-action="comms-array">
          <span class="node-icon">COM</span>
          <span class="node-label">COMMS ARRAY</span>
          <span class="node-desc">Training & multiplayer</span>
        </button>
      </div>

      <!-- Footer with Debug Section -->
      <footer class="all-nodes-menu-footer">
        <div class="all-nodes-debug-section">
          <span class="debug-label">[DEV]</span>
          <button class="all-nodes-debug-btn" data-action="endless-field-nodes">
            <span class="debug-icon">INF</span>
            <span class="debug-text">ENDLESS ROOMS</span>
          </button>
          <button class="all-nodes-debug-btn" data-action="endless-battles">
            <span class="debug-icon">BTL</span>
            <span class="debug-text">ENDLESS BATTLES</span>
          </button>
        </div>
        <div class="all-nodes-escape-hint">
          <span class="hint-key">[ESC]</span>
          <span class="hint-text">Return to Field</span>
        </div>
      </footer>

      <!-- Ghost Text Watermark -->
      <div class="ard-ghost-text all-nodes-ghost">CHAOS_CORE.v0.12</div>
    </div>
  `;

  // Attach event listeners
  attachAllNodesMenuListeners();
}

function attachAllNodesMenuListeners(): void {
  const root = document.getElementById("app");
  if (!root) return;

  // Mode toggle buttons (tabs)
  const modeButtons = root.querySelectorAll(".all-nodes-mode-tab");
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const mode = (btn as HTMLElement).dataset.mode;
      handleModeSwitch(mode);
    });
  });

  // Node action buttons
  const actionButtons = root.querySelectorAll(".all-nodes-node-btn[data-action]");
  actionButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const action = (btn as HTMLElement).dataset.action;
      if (action) {
        handleNodeAction(action);
      }
    });
  });

  // Debug buttons
  const debugButtons = root.querySelectorAll(".all-nodes-debug-btn[data-action]");
  debugButtons.forEach((btn) => {
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
      // Already on AllNodesMenuScreen, do nothing
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
    case "inventory":
      import("./InventoryViewScreen").then(({ renderInventoryViewScreen }) => {
        renderInventoryViewScreen("basecamp");
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
    case "stable":
      import("./StableScreen").then(({ renderStableScreen }) => {
        renderStableScreen("basecamp");
      });
      break;
    case "settings":
      import("./SettingsScreen").then(({ renderSettingsScreen }) => {
        renderSettingsScreen("basecamp");
      });
      break;
    case "comms-array":
      import("./CommsArrayScreen").then(({ renderCommsArrayScreen }) => {
        renderCommsArrayScreen("basecamp");
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

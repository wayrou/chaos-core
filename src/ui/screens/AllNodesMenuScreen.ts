// ============================================================================
// ALL NODES MENU SCREEN - Standalone menu for quick node access
// An independent screen (not an overlay) containing all base camp nodes
// ============================================================================

import "../../field/field.css"; // Import styles for the menu screen
import { getGameState, updateGameState } from "../../state/gameStore";
// BaseCampScreen removed - using AllNodesMenuScreen instead
import { renderFieldScreen } from "../../field/FieldScreen";

// Track last field map for returning to field mode
let lastFieldMap: string = "base_camp";
let quacLastFeedback = 'Type a node name, then press ENTER. Example: "unit roster" or "inventory".';

const QUAC_COMMAND_ALIASES: Array<{ action: string; aliases: string[] }> = [
  { action: "ops-terminal", aliases: ["ops", "ops terminal", "operation", "operations", "deploy", "mission", "missions"] },
  { action: "roster", aliases: ["roster", "unit roster", "units", "party", "manage units"] },
  { action: "loadout", aliases: ["loadout", "gear", "equipment", "equip", "locker"] },
  { action: "inventory", aliases: ["inventory", "items", "assets", "storage", "owned items"] },
  { action: "gear-workbench", aliases: ["workshop", "workbench", "gear workbench", "craft", "crafting", "upgrade gear"] },
  { action: "shop", aliases: ["shop", "store", "quartermaster", "buy", "market"] },
  { action: "tavern", aliases: ["tavern", "recruit", "recruitment", "hire"] },
  { action: "quest-board", aliases: ["quest", "quests", "quest board", "board", "jobs"] },
  { action: "port", aliases: ["port", "trade", "trading", "manifest", "supply"] },
  { action: "quarters", aliases: ["quarters", "rest", "barracks", "heal"] },
  { action: "stable", aliases: ["stable", "mounts", "mount", "mounted units"] },
  { action: "codex", aliases: ["codex", "archive", "archives", "bestiary"] },
  { action: "settings", aliases: ["settings", "config", "configuration", "options"] },
  { action: "comms-array", aliases: ["comms", "comms array", "multiplayer", "training"] },
  { action: "endless-field-nodes", aliases: ["endless rooms", "debug endless rooms"] },
  { action: "endless-battles", aliases: ["endless battles", "debug endless battles"] },
  { action: "debug-wad", aliases: ["debug wad", "money", "give wad", "add wad"] },
];

function normalizeQuacCommand(value: string): string {
  return value.toLowerCase().trim().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ");
}

function resolveQuacCommand(input: string): string | null {
  const normalized = normalizeQuacCommand(input);
  if (!normalized) return null;

  for (const entry of QUAC_COMMAND_ALIASES) {
    for (const alias of entry.aliases) {
      const normalizedAlias = normalizeQuacCommand(alias);
      if (normalized === normalizedAlias || normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized)) {
        return entry.action;
      }
    }
  }

  return null;
}

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
    <div class="all-nodes-menu-screen town-screen town-screen--hub ard-noise">
      <!-- Terminal Header (S/COM_OS) -->
      <header class="all-nodes-menu-header town-screen__hero">
        <div class="all-nodes-terminal-bar">
          <span class="terminal-indicator"></span>
          <span class="terminal-text">S/COM_OS // BASE_CAMP.SYS</span>
        </div>
        <h1 class="all-nodes-menu-title">BASE CAMP</h1>
        <p class="all-nodes-menu-subtitle">Q.U.A.C. // QUICK USER ACCESS CONSOLE</p>
      </header>

      <!-- Mode Toggle (FFTA-style tabs) -->
      <nav class="all-nodes-menu-mode-toggle">
        <button class="all-nodes-mode-tab all-nodes-mode-tab--active" data-mode="menu">
          <span class="mode-icon">[CMD]</span>
          <span class="mode-label">COMMAND</span>
        </button>
      </nav>

      <!-- Resources Bar (Adventure Gothic panel) -->
      <div class="all-nodes-menu-resources town-screen__resource-strip ard-panel--inset">
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

      <section class="all-nodes-cli-panel" aria-label="Quick User Access Console">
        <div class="all-nodes-cli-header">
          <div class="all-nodes-cli-title">Q.U.A.C. TERMINAL</div>
          <div class="all-nodes-cli-hint">Direct command access to all town nodes</div>
        </div>
        <form class="all-nodes-cli-form" id="quacForm">
          <label class="all-nodes-cli-prompt" for="quacInput">S/COM://QUAC&gt;</label>
          <input
            class="all-nodes-cli-input"
            id="quacInput"
            name="quacInput"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder='Enter command: "unit roster", "loadout", "inventory"...'
          />
          <button class="all-nodes-cli-submit" type="submit">EXECUTE</button>
        </form>
        <div class="all-nodes-cli-status" id="quacStatus">${quacLastFeedback}</div>
      </section>

      <!-- Node Grid (World Panels) -->
      <div class="all-nodes-menu-grid town-screen__grid">
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
          <span class="node-icon">WKS</span>
          <span class="node-label">WORKSHOP</span>
          <span class="node-desc">Craft, upgrade & tinker</span>
        </button>
        <button class="all-nodes-node-btn" data-action="shop">
          <span class="node-icon">SHP</span>
          <span class="node-label">SHOP</span>
          <span class="node-desc">Buy items & PAKs</span>
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
        <button class="all-nodes-node-btn all-nodes-node-btn--utility" data-action="codex">
          <span class="node-icon">CDX</span>
          <span class="node-label">CODEX</span>
          <span class="node-desc">Archives & bestiary</span>
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
      <footer class="all-nodes-menu-footer town-screen__footer">
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
          <button class="all-nodes-debug-btn" data-action="debug-wad">
            <span class="debug-icon">WAD</span>
            <span class="debug-text">+999999 WAD</span>
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

  const quacForm = root.querySelector<HTMLFormElement>("#quacForm");
  const quacInput = root.querySelector<HTMLInputElement>("#quacInput");
  const quacStatus = root.querySelector<HTMLElement>("#quacStatus");
  if (quacForm && quacInput && quacStatus) {
    quacForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const rawCommand = quacInput.value;
      const resolvedAction = resolveQuacCommand(rawCommand);

      if (!resolvedAction) {
        quacLastFeedback = `Unknown command: "${rawCommand.trim() || "blank"}". Try "unit roster", "loadout", "inventory", "shop", or "port".`;
        quacStatus.textContent = quacLastFeedback;
        quacStatus.classList.add("all-nodes-cli-status--error");
        quacInput.select();
        return;
      }

      quacLastFeedback = `Executing ${resolvedAction.toUpperCase()}...`;
      quacStatus.textContent = quacLastFeedback;
      quacStatus.classList.remove("all-nodes-cli-status--error");
      quacInput.value = "";
      handleNodeAction(resolvedAction);
    });

    quacInput.addEventListener("input", () => {
      if (quacStatus.classList.contains("all-nodes-cli-status--error")) {
        quacStatus.classList.remove("all-nodes-cli-status--error");
        quacStatus.textContent = 'Type a node name, then press ENTER. Example: "unit roster" or "inventory".';
      }
    });

    setTimeout(() => quacInput.focus(), 0);
  }

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
      // Redirect legacy workshop action to gear workbench
      import("./GearWorkbenchScreen").then(({ renderGearWorkbenchScreen }) => {
        renderGearWorkbenchScreen(undefined, undefined, "basecamp");
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
      import("./TavernDialogueScreen").then(({ renderTavernDialogueScreen }) => {
        renderTavernDialogueScreen("base_camp_tavern", "Tavern", "basecamp");
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
          const weaponId = (unit as any)?.loadout?.primaryWeapon ?? null;
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
    case "codex":
      import("./CodexScreen").then(({ renderCodexScreen }) => {
        renderCodexScreen("basecamp");
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
    case "debug-wad":
      updateGameState((state) => ({
        ...state,
        wad: 999999,
        resources: {
          metalScrap: 99999,
          wood: 99999,
          chaosShards: 99999,
          steamComponents: 99999,
        },
      }));
      // Re-render to show updated wad and resources
      renderAllNodesMenuScreen();
      break;
  }
}

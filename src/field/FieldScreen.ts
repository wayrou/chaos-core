// ============================================================================
// FIELD SYSTEM - FIELD MODE SCREEN
// ============================================================================

import "./field.css";
import { FieldMap, FieldState } from "./types";
import { getFieldMap } from "./maps";
import {
  createPlayerAvatar,
  updatePlayerMovement,
  getOverlappingInteractionZone,
} from "./player";
import { handleInteraction, getInteractionZone } from "./interactions";
import { getGameState, updateGameState } from "../state/gameStore";
import { renderBaseCampScreen } from "../ui/screens/BaseCampScreen";
import { createCompanion, updateCompanion } from "./companion";
import { createNpc, updateNpc, getNpcInRange, NPC_DIALOGUE } from "./npcs";
import { showDialogue } from "../ui/screens/DialogueScreen";
import { getPlayerInput, handleKeyDown as handlePlayerInputKeyDown, handleKeyUp as handlePlayerInputKeyUp } from "../core/playerInput";
import { tryJoinAsP2, dropOutP2, applyTetherConstraint } from "../core/coop";
import { PlayerId } from "../core/types";
import { renderAllNodesMenuScreen } from "../ui/screens/AllNodesMenuScreen";

// ============================================================================
// STATE
// ============================================================================

let fieldState: FieldState | null = null;
let currentMap: FieldMap | null = null;
let animationFrameId: number | null = null;
let lastFrameTime = 0;
// Legacy movementInput kept for backward compatibility, but we'll use getPlayerInput instead
let movementInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  dash: false,
};

let activeInteractionPrompt: string | null = null;

// Panel state - simple boolean
let isPanelOpen = false;

// Track if global listeners are attached (prevents duplicates)
let globalListenersAttached = false;

// ============================================================================
// GETTERS
// ============================================================================

/**
 * Get the current map ID from field state
 */
export function getCurrentFieldMap(): FieldMap["id"] | null {
  return fieldState?.currentMap || null;
}

// ============================================================================
// RENDER
// ============================================================================

export function renderFieldScreen(mapId: FieldMap["id"] = "base_camp"): void {
  const root = document.getElementById("app");
  if (!root) return;

  // Load map
  currentMap = getFieldMap(mapId);

  // Initialize or restore player avatars from game state
  const state = getGameState();
  const tileSize = 64;
  let playerX: number;
  let playerY: number;

  const isResuming = fieldState && fieldState.currentMap === mapId;

  // Always reset position when entering quarters (small map, needs specific spawn)
  // For other maps, restore position if resuming
  if (isResuming && mapId !== "quarters") {
    // Restore from fieldState if available, otherwise from game state
    playerX = fieldState!.player.x;
    playerY = fieldState!.player.y;
  } else {
    // Set spawn position based on map (including quarters - always reset)
    if (mapId === "quarters") {
      // Spawn in the middle bottom of the walkable area
      // Quarters is 10x8, walkable area is x:1-8, y:1-6
      // Middle of x range (1-8): between 4 and 5, use tile 4 for clean positioning
      // Bottom walkable row: y:6
      // Use tile 4 center: 4 * 64 + 32 = 288px
      const spawnTileX = 4; // Middle of walkable area (tiles 1-8, middle is ~4.5, use 4)
      const spawnTileY = 6; // Bottom walkable row (y:1-6, bottom is 6)
      playerX = spawnTileX * tileSize + tileSize / 2; // Center of tile 4 = 288px
      playerY = spawnTileY * tileSize + tileSize / 2; // Center of tile 6 = 416px
      
      // Skip validation for quarters - we know this position is walkable
      // (tile 4,6 is in the middle-bottom of walkable area x:1-8, y:1-6)
    } else if (mapId === "base_camp") {
      // Spawn outside quarters node
      // Quarters station is at x:25, y:12 (size 2x2)
      // Quarters interaction zone is at x:25, y:14 (size 2x1)
      // Spawn to the left of quarters interaction zone at x:23, y:14 (center of tile)
      playerX = 23 * tileSize + tileSize / 2; // 1472px
      playerY = 14 * tileSize + tileSize / 2; // 896px
    } else {
      // Default: center of map
      playerX = (currentMap.width * tileSize) / 2;
      playerY = (currentMap.height * tileSize) / 2;
    }
    
    // Validate spawn position is walkable, if not, find nearest walkable tile
    // Skip validation for quarters - we set a specific position
    if (mapId !== "quarters") {
      const spawnTileX = Math.floor(playerX / tileSize);
      const spawnTileY = Math.floor(playerY / tileSize);
      if (spawnTileX < 0 || spawnTileX >= currentMap.width || 
          spawnTileY < 0 || spawnTileY >= currentMap.height ||
          !currentMap.tiles[spawnTileY]?.[spawnTileX]?.walkable) {
        // Find first walkable tile
        for (let y = 1; y < currentMap.height - 1; y++) {
          for (let x = 1; x < currentMap.width - 1; x++) {
            if (currentMap.tiles[y]?.[x]?.walkable) {
              playerX = x * tileSize + tileSize / 2;
              playerY = y * tileSize + tileSize / 2;
              break;
            }
          }
          if (playerX !== (currentMap.width * tileSize) / 2) break;
        }
      }
    }
  }

  // Initialize or update P1 avatar in game state
  // Always update position when entering quarters to ensure correct spawn
  updateGameState(s => {
    // Initialize players if they don't exist
    const players = s.players || {
      P1: {
        id: "P1",
        active: true,
        color: "#ff8a00",
        inputSource: "keyboard1" as const,
        avatar: null,
        controlledUnitIds: [],
      },
      P2: {
        id: "P2",
        active: false,
        color: "#6849c2",
        inputSource: "none" as const,
        avatar: null,
        controlledUnitIds: [],
      },
    };
    
    // Always update position for quarters, or initialize if missing
    const shouldUpdatePosition = mapId === "quarters" || !players.P1.avatar;
    
    return {
      ...s,
      players: {
        ...players,
        P1: {
          ...players.P1,
          active: true,
          avatar: shouldUpdatePosition ? {
            x: playerX,
            y: playerY,
            facing: "south",
            spriteId: "aeriss_p1",
          } : players.P1.avatar,
        },
      },
    };
  });

  if (isResuming && fieldState && fieldState.player && mapId !== "quarters") {
    // Preserve companion if it exists
    // For quarters, always reset position, so skip this resume logic
    const companion = fieldState.companion || createCompanion(playerX - 40, playerY - 40);
    fieldState = {
      ...fieldState,
      currentMap: mapId,
      player: {
        ...fieldState.player,
        x: playerX,
        y: playerY,
      },
      isPaused: false,
      activeInteraction: null,
      companion,
    };
  } else {
    // Initialize Sable near player
    const companion = createCompanion(playerX - 40, playerY - 40);
    
    // Initialize NPCs for Base Camp (Headline 15b)
    const npcs: import("./types").FieldNpc[] = [];
    if (mapId === "base_camp") {
      const tileSize = 64;
      // Add NPCs at different locations
      npcs.push(
        createNpc("npc_medic", "Medic", 5 * tileSize + tileSize / 2, 8 * tileSize + tileSize / 2, "npc_medic"),
        createNpc("npc_quartermaster", "Quartermaster", 12 * tileSize + tileSize / 2, 6 * tileSize + tileSize / 2, "npc_quartermaster"),
        createNpc("npc_scout", "Scout", 8 * tileSize + tileSize / 2, 12 * tileSize + tileSize / 2, "npc_scout"),
        createNpc("npc_engineer", "Engineer", 14 * tileSize + tileSize / 2, 10 * tileSize + tileSize / 2, "npc_engineer"),
        // 5 additional NPCs
        createNpc("npc_supply_officer", "Supply Officer", 20 * tileSize + tileSize / 2, 8 * tileSize + tileSize / 2, "npc_supply_officer"),
        createNpc("npc_armorer", "Armorer", 6 * tileSize + tileSize / 2, 6 * tileSize + tileSize / 2, "npc_armorer"),
        createNpc("npc_commander", "Commander", 10 * tileSize + tileSize / 2, 10 * tileSize + tileSize / 2, "npc_commander"),
        createNpc("npc_researcher", "Researcher", 4 * tileSize + tileSize / 2, 10 * tileSize + tileSize / 2, "npc_researcher"),
        createNpc("npc_sentinel", "Sentinel", 18 * tileSize + tileSize / 2, 12 * tileSize + tileSize / 2, "npc_sentinel")
      );
    }
    
    fieldState = {
      currentMap: mapId,
      player: createPlayerAvatar(playerX, playerY),
      isPaused: false,
      activeInteraction: null,
      companion,
      npcs,
    };
  }

  // Setup input handlers (only once)
  setupGlobalListeners();

  // Restart game loop
  if (animationFrameId !== null) {
    stopGameLoop();
  }

  movementInput = {
    up: false,
    down: false,
    left: false,
    right: false,
    dash: false,
  };

  // Create panel first (outside field-root)
  createAllNodesPanel();

  startGameLoop();
  render();
}

function render(): void {
  const root = document.getElementById("app");
  if (!root || !currentMap || !fieldState) return;

  const tileSize = 64;
  const mapPixelWidth = currentMap.width * tileSize;
  const mapPixelHeight = currentMap.height * tileSize;

  // Build tiles HTML
  let tilesHtml = "";
  for (let y = 0; y < currentMap.height; y++) {
    for (let x = 0; x < currentMap.width; x++) {
      const tile = currentMap.tiles[y][x];
      const tileClass = tile.walkable ? "field-tile-walkable" : "field-tile-wall";
      const tileType = tile.type;
      tilesHtml += `
        <div class="field-tile ${tileClass} field-tile-${tileType}" 
             style="left: ${x * tileSize}px; top: ${y * tileSize}px; width: ${tileSize}px; height: ${tileSize}px;"></div>
      `;
    }
  }

  // Build objects HTML
  let objectsHtml = "";
  for (const obj of currentMap.objects) {
    const associatedZone = currentMap.interactionZones.find((zone) => {
      const zoneCenterX = zone.x + zone.width / 2;
      const zoneCenterY = zone.y + zone.height / 2;
      const objCenterX = obj.x + obj.width / 2;
      const objCenterY = obj.y + obj.height / 2;
      return (
        Math.abs(zoneCenterX - objCenterX) < 2 &&
        Math.abs(zoneCenterY - objCenterY) < 2
      );
    });
    const clickAction = associatedZone ? `data-interaction-zone="${associatedZone.id}"` : "";
    const cursorStyle = associatedZone ? "cursor: pointer;" : "";

    objectsHtml += `
      <div class="field-object field-object-${obj.type}" 
           style="left: ${obj.x * tileSize}px; top: ${obj.y * tileSize}px; width: ${obj.width * tileSize}px; height: ${obj.height * tileSize}px; ${cursorStyle}"
           title="${obj.metadata?.name || obj.type}${associatedZone ? " (Click to interact)" : ""}"
           ${clickAction}>
        <div class="field-object-placeholder">${obj.metadata?.name || obj.type}</div>
      </div>
    `;
  }

  // Player avatars (P1 and P2)
  const state = getGameState();
  // Ensure players object exists (backward compatibility)
  const players = state.players || {
    P1: { id: "P1", active: true, color: "#ff8a00", inputSource: "keyboard1" as const, avatar: null, controlledUnitIds: [] },
    P2: { id: "P2", active: false, color: "#6849c2", inputSource: "none" as const, avatar: null, controlledUnitIds: [] },
  };
  const p1Avatar = players.P1.avatar;
  const p2Avatar = players.P2.active ? players.P2.avatar : null;
  
  let playerHtml = "";
  
  // P1 Avatar (always present)
  if (p1Avatar) {
    playerHtml += `
      <div class="field-player field-player-p1" 
           style="left: ${p1Avatar.x - 16}px; top: ${p1Avatar.y - 16}px; width: 32px; height: 32px; border: 2px solid ${state.players.P1.color};"
           data-facing="${p1Avatar.facing}">
        <div class="field-player-sprite">A</div>
        <div class="field-player-indicator" style="background: ${state.players.P1.color}; color: white; font-size: 10px; padding: 2px 4px; border-radius: 4px; position: absolute; top: -18px; left: 50%; transform: translateX(-50%);">P1</div>
      </div>
    `;
  }
  
  // P2 Avatar (if active)
  if (p2Avatar) {
    playerHtml += `
      <div class="field-player field-player-p2" 
           style="left: ${p2Avatar.x - 16}px; top: ${p2Avatar.y - 16}px; width: 32px; height: 32px; border: 2px solid ${state.players.P2.color};"
           data-facing="${p2Avatar.facing}">
        <div class="field-player-sprite">A</div>
        <div class="field-player-indicator" style="background: ${players.P2.color}; color: white; font-size: 10px; padding: 2px 4px; border-radius: 4px; position: absolute; top: -18px; left: 50%; transform: translateX(-50%);">P2</div>
      </div>
    `;
  }

  // Sable companion (Headline 15a)
  const companionHtml = fieldState.companion ? `
    <div class="field-companion field-companion-sable" 
         style="left: ${fieldState.companion.x - fieldState.companion.width / 2}px; top: ${
    fieldState.companion.y - fieldState.companion.height / 2
  }px; width: ${fieldState.companion.width}px; height: ${fieldState.companion.height}px;"
         data-facing="${fieldState.companion.facing}" data-state="${fieldState.companion.state}">
      <div class="field-companion-sprite">🐕</div>
    </div>
  ` : "";

  // NPCs (Headline 15b)
  const npcsHtml = fieldState.npcs ? fieldState.npcs.map(npc => `
    <div class="field-npc" 
         style="left: ${npc.x - npc.width / 2}px; top: ${npc.y - npc.height / 2}px; width: ${npc.width}px; height: ${npc.height}px;"
         data-facing="${npc.direction}" data-state="${npc.state}">
      <div class="field-npc-sprite">👤</div>
      <div class="field-npc-name">${npc.name}</div>
    </div>
  `).join("") : "";

  // Interaction prompt
  const promptHtml = activeInteractionPrompt
    ? `<div class="field-interaction-prompt">E — ${activeInteractionPrompt}</div>`
    : "";

  // Get field-root container or create it
  let fieldRoot = root.querySelector(".field-root") as HTMLElement | null;
  if (!fieldRoot) {
    // Clear any existing content (like main menu) before creating field screen
    // But preserve the all-nodes panel if it exists
    const existingPanel = root.querySelector("#allNodesPanel");
    root.innerHTML = "";
    if (existingPanel) {
      root.appendChild(existingPanel);
    }
    
    fieldRoot = document.createElement("div");
    fieldRoot.className = "field-root";
    root.insertBefore(fieldRoot, root.firstChild);
  }

  // Update only the field-root content (preserves panel)
  fieldRoot.innerHTML = `
    <div class="field-header">
      <div class="field-header-title">FIELD MODE — ${currentMap.name.toUpperCase()}</div>
      <div class="field-header-buttons">
        <button class="field-basecamp-btn" id="fieldAllNodesBtn">ALL NODES (ESC)</button>
      </div>
    </div>
    
    <div class="field-viewport">
      <div class="field-map" style="width: ${mapPixelWidth}px; height: ${mapPixelHeight}px;">
        ${tilesHtml}
        ${objectsHtml}
        ${npcsHtml}
        ${playerHtml}
        ${companionHtml}
      </div>
    </div>
    
    ${promptHtml}
    
    <div class="field-hud">
      <div class="field-hud-instructions">
        WASD to move • Shift to dash • E to interact • ESC for All Nodes
      </div>
    </div>
  `;

  centerViewportOnPlayer();
  
  // Attach button listener directly to the button element
  // Use requestAnimationFrame to ensure DOM is ready
  requestAnimationFrame(() => {
    const allNodesBtn = document.getElementById("fieldAllNodesBtn");
    if (allNodesBtn) {
      // Remove any existing listener first
      const existingListener = (allNodesBtn as any).__allNodesBtnListener;
      if (existingListener) {
        allNodesBtn.removeEventListener("click", existingListener);
      }
      
      // Create new listener
      const allNodesBtnHandler = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("[FIELD] All Nodes button clicked");
        toggleAllNodesPanel();
      };
      
      // Store reference and attach
      (allNodesBtn as any).__allNodesBtnListener = allNodesBtnHandler;
      allNodesBtn.addEventListener("click", allNodesBtnHandler);
    } else {
      console.warn("[FIELD] All Nodes button not found in DOM");
    }
  });
}

function centerViewportOnPlayer(): void {
  if (!fieldState) return;

  const viewport = document.querySelector(".field-viewport");
  const map = document.querySelector(".field-map");
  if (!viewport || !map) return;

  const viewportRect = viewport.getBoundingClientRect();
  const mapElement = map as HTMLElement;
  
  const state = getGameState();
  const p1Avatar = state.players.P1.avatar;
  const p2Avatar = state.players.P2.active ? state.players.P2.avatar : null;
  
  let centerX: number;
  let centerY: number;
  
  if (p2Avatar && p1Avatar) {
    // Center between both avatars
    centerX = (p1Avatar.x + p2Avatar.x) / 2;
    centerY = (p1Avatar.y + p2Avatar.y) / 2;
  } else if (p1Avatar) {
    // Center on P1 only
    centerX = p1Avatar.x;
    centerY = p1Avatar.y;
  } else {
    // Fallback to fieldState.player (legacy)
    centerX = fieldState.player.x;
    centerY = fieldState.player.y;
  }

  const offsetX = centerX - viewportRect.width / 2;
  const offsetY = centerY - viewportRect.height / 2;

  mapElement.style.transform = `translate(${-offsetX}px, ${-offsetY}px)`;
}

// ============================================================================
// ALL NODES PANEL - Bulletproof Implementation
// ============================================================================

function createAllNodesPanel(): void {
  const root = document.getElementById("app");
  if (!root) return;

  // Check if panel already exists
  let panel = document.getElementById("allNodesPanel");
  if (panel) {
    // Make sure it's visible and update content
    panel.style.display = "";
    updateAllNodesPanelContent();
    updatePanelVisibility();
    return;
  }

  // Create panel element
  panel = document.createElement("div");
  panel.id = "allNodesPanel";
  panel.className = "all-nodes-panel";
  root.appendChild(panel);

  // Populate content
  updateAllNodesPanelContent();
  updatePanelVisibility();
}

function updateAllNodesPanelContent(): void {
  const panel = document.getElementById("allNodesPanel");
  if (!panel) return;

  const state = getGameState();
  const wad = state.wad ?? 0;
  const res = state.resources ?? {
    metalScrap: 0,
    wood: 0,
    chaosShards: 0,
    steamComponents: 0,
  };

  // Check if we're currently in field mode
  const isInFieldMode = document.querySelector(".field-root") !== null;

  panel.innerHTML = `
    <div class="all-nodes-panel-content">
      <div class="all-nodes-panel-header">
        <div class="all-nodes-panel-title">ALL NODES</div>
        <button class="all-nodes-panel-close" id="allNodesPanelClose">×</button>
      </div>
      <div class="all-nodes-panel-body">
        <div class="all-nodes-mode-toggle">
          <div class="all-nodes-mode-toggle-label">MODE</div>
          <div class="all-nodes-mode-toggle-switch">
            <button class="all-nodes-mode-btn ${!isInFieldMode ? 'all-nodes-mode-btn--active' : ''}" data-mode="basecamp">
              <span class="mode-icon">🏠</span>
              <span class="mode-label">BASE CAMP</span>
            </button>
            <button class="all-nodes-mode-btn ${isInFieldMode ? 'all-nodes-mode-btn--active' : ''}" data-mode="field">
              <span class="mode-icon">🌍</span>
              <span class="mode-label">FIELD</span>
            </button>
          </div>
        </div>
        
        <div class="all-nodes-panel-resources">
          <div class="all-nodes-resource-item">
            <span class="all-nodes-resource-label">WAD</span>
            <span class="all-nodes-resource-value">${wad}</span>
          </div>
          <div class="all-nodes-resource-item">
            <span class="all-nodes-resource-label">METAL</span>
            <span class="all-nodes-resource-value">${res.metalScrap}</span>
          </div>
          <div class="all-nodes-resource-item">
            <span class="all-nodes-resource-label">WOOD</span>
            <span class="all-nodes-resource-value">${res.wood}</span>
          </div>
          <div class="all-nodes-resource-item">
            <span class="all-nodes-resource-label">SHARDS</span>
            <span class="all-nodes-resource-value">${res.chaosShards}</span>
          </div>
          <div class="all-nodes-resource-item">
            <span class="all-nodes-resource-label">STEAM</span>
            <span class="all-nodes-resource-value">${res.steamComponents}</span>
          </div>
        </div>
        
        <div class="all-nodes-panel-buttons">
          <button class="all-nodes-btn" data-action="shop">
            <span class="btn-icon">🛒</span>
            <span class="btn-label">SHOP</span>
          </button>
          <button class="all-nodes-btn" data-action="workshop">
            <span class="btn-icon">🔨</span>
            <span class="btn-label">WORKSHOP</span>
          </button>
          <button class="all-nodes-btn" data-action="roster">
            <span class="btn-icon">👥</span>
            <span class="btn-label">UNIT ROSTER</span>
          </button>
          <button class="all-nodes-btn" data-action="loadout">
            <span class="btn-icon">🎒</span>
            <span class="btn-label">LOADOUT</span>
          </button>
          <button class="all-nodes-btn" data-action="quest-board">
            <span class="btn-icon">📋</span>
            <span class="btn-label">QUEST BOARD</span>
          </button>
          <button class="all-nodes-btn" data-action="tavern">
            <span class="btn-icon">🍺</span>
            <span class="btn-label">TAVERN</span>
          </button>
          <button class="all-nodes-btn" data-action="ops-terminal">
            <span class="btn-icon">🎯</span>
            <span class="btn-label">OPS TERMINAL</span>
          </button>
          <button class="all-nodes-btn" data-action="gear-workbench">
            <span class="btn-icon">🔧</span>
            <span class="btn-label">GEAR WORKBENCH</span>
          </button>
          <button class="all-nodes-btn" data-action="port">
            <span class="btn-icon">⚓</span>
            <span class="btn-label">PORT</span>
          </button>
          <button class="all-nodes-btn all-nodes-btn--stable" data-action="stable">
            <span class="btn-icon">🐎</span>
            <span class="btn-label">STABLE</span>
          </button>
          <button class="all-nodes-btn" data-action="settings">
            <span class="btn-icon">⚙</span>
            <span class="btn-label">SETTINGS</span>
          </button>
          <div class="all-nodes-divider"></div>
          <button class="all-nodes-btn all-nodes-btn--debug" data-action="endless-field-nodes">
            <span class="btn-icon">∞</span>
            <span class="btn-label">ENDLESS FIELD NODES</span>
          </button>
          <button class="all-nodes-btn all-nodes-btn--debug" data-action="endless-battles">
            <span class="btn-icon">⚔</span>
            <span class="btn-label">ENDLESS BATTLES</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Attach close button listener
  const closeBtn = panel.querySelector("#allNodesPanelClose");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleAllNodesPanel();
    });
  }

  // Attach mode toggle listeners
  const modeButtons = panel.querySelectorAll(".all-nodes-mode-btn");
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const mode = (btn as HTMLElement).dataset.mode;
      if (mode === "basecamp") {
        toggleAllNodesPanel();
        renderBaseCampScreen();
      } else if (mode === "field") {
        toggleAllNodesPanel();
        // Use current map if in field mode, otherwise default to base_camp
        const currentMapName = fieldState?.currentMap ?? "base_camp";
        renderFieldScreen(currentMapName);
      }
    });
  });

  // Attach button listeners via delegation
  panel.addEventListener("click", handlePanelClick);
}

function handlePanelClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;
  const btn = target.closest(".all-nodes-btn") as HTMLElement;
  if (!btn) return;

  e.preventDefault();
  e.stopPropagation();

  const action = btn.getAttribute("data-action");
  if (action) {
    handleNodeAction(action);
  }
}

function updatePanelVisibility(): void {
  const panel = document.getElementById("allNodesPanel");
  if (!panel) return;

  if (isPanelOpen) {
    panel.classList.add("all-nodes-panel--open");
  } else {
    panel.classList.remove("all-nodes-panel--open");
  }
}

function toggleAllNodesPanel(): void {
  // Navigate to the standalone All Nodes Menu Screen
  // This exits field mode and shows the menu as an independent screen
  const currentMapId = fieldState?.currentMap ?? "base_camp";

  // Stop the game loop and cleanup
  stopGameLoop();
  cleanupGlobalListeners();

  // Remove the overlay panel if it exists
  const panel = document.getElementById("allNodesPanel");
  if (panel) {
    panel.remove();
  }

  isPanelOpen = false;

  // Navigate to the All Nodes Menu Screen
  renderAllNodesMenuScreen(currentMapId);
}

function closeAllNodesPanel(): void {
  isPanelOpen = false;
  updatePanelVisibility();
}

// ============================================================================
// GLOBAL INPUT HANDLING (Attached once, never duplicated)
// ============================================================================

function setupGlobalListeners(): void {
  if (globalListenersAttached) return;

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  document.addEventListener("click", handleFieldObjectClick, true);
  
  // Also add document-level click handler for All Nodes button as fallback
  document.addEventListener("click", handleAllNodesButtonClick, true);

  globalListenersAttached = true;
}

function handleAllNodesButtonClick(e: MouseEvent): void {
  // Only handle when field screen is active
  if (!document.querySelector(".field-root")) return;
  
  const target = e.target as HTMLElement;
  const allNodesBtn = target.closest("#fieldAllNodesBtn") as HTMLElement;
  
  if (allNodesBtn) {
    e.preventDefault();
    e.stopPropagation();
    console.log("[FIELD] All Nodes button clicked (document delegation)");
    toggleAllNodesPanel();
  }
}

function cleanupGlobalListeners(): void {
  if (!globalListenersAttached) return;

  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  document.removeEventListener("click", handleFieldObjectClick, true);
  document.removeEventListener("click", handleAllNodesButtonClick, true);

  globalListenersAttached = false;
}

function handleKeyDown(e: KeyboardEvent): void {
  // Only handle when field screen is active
  if (!document.querySelector(".field-root")) return;

  const key = e.key?.toLowerCase() ?? "";

  // ESC key: toggle All Nodes panel
  if (key === "escape" || e.code === "Escape" || e.keyCode === 27) {
    e.preventDefault();
    e.stopPropagation();
    toggleAllNodesPanel();
    return;
  }

  // Co-op drop-in/drop-out keys (only outside battle)
  const state = getGameState();
  if (state.phase !== "battle" && state.currentBattle === null) {
    // J key: Join as P2
    if (key === "j" || key === "J") {
      e.preventDefault();
      e.stopPropagation();
      tryJoinAsP2();
      return;
    }
    
    // K key: Drop out P2
    if (key === "k" || key === "K") {
      e.preventDefault();
      e.stopPropagation();
      dropOutP2();
      return;
    }
  }

  // Update player input system
  handlePlayerInputKeyDown(e);

  // Don't process movement if paused
  if (fieldState?.isPaused) return;

  // Legacy movementInput for backward compatibility (P1 only)
  // Dash modifier
  if (e.shiftKey) {
    movementInput.dash = true;
  }

  switch (key) {
    case "w":
      movementInput.up = true;
      e.preventDefault();
      break;
    case "s":
      movementInput.down = true;
      e.preventDefault();
      break;
    case "a":
      movementInput.left = true;
      e.preventDefault();
      break;
    case "d":
      movementInput.right = true;
      e.preventDefault();
      break;
    case "e":
      const p1Input = getPlayerInput("P1");
      if (p1Input.interact) {
        handleInteractKey();
        e.preventDefault();
      }
      break;
  }
}

function handleKeyUp(e: KeyboardEvent): void {
  if (!document.querySelector(".field-root")) return;

  // Update player input system
  handlePlayerInputKeyUp(e);

  const key = e.key?.toLowerCase() ?? "";

  // Legacy movementInput for backward compatibility
  if (!e.shiftKey) {
    movementInput.dash = false;
  }

  switch (key) {
    case "w":
      movementInput.up = false;
      break;
    case "s":
      movementInput.down = false;
      break;
    case "a":
      movementInput.left = false;
      break;
    case "d":
      movementInput.right = false;
      break;
  }
}

function handleFieldObjectClick(e: MouseEvent): void {
  if (!document.querySelector(".field-root")) return;

  const target = e.target as HTMLElement;
  const objEl = target.closest(".field-object[data-interaction-zone]") as HTMLElement;
  if (!objEl) return;

  e.stopPropagation();
  e.preventDefault();

  const zoneId = objEl.getAttribute("data-interaction-zone");
  if (!zoneId || !currentMap || !fieldState) return;

  const zone = getInteractionZone(currentMap, zoneId);
  if (!zone) return;

  const savedPlayerPos = { x: fieldState.player.x, y: fieldState.player.y };
  fieldState.isPaused = true;

  handleInteraction(zone, currentMap, () => {
    if (fieldState) {
      fieldState.isPaused = false;
      const tileSize = 64;
      const offsetX = savedPlayerPos.x % tileSize < tileSize / 2 ? -8 : 8;
      const offsetY = savedPlayerPos.y % tileSize < tileSize / 2 ? -8 : 8;
      fieldState.player.x = savedPlayerPos.x + offsetX;
      fieldState.player.y = savedPlayerPos.y + offsetY;
      renderFieldScreen(fieldState.currentMap);
    }
  });
}

function handleInteractKey(): void {
  if (!fieldState || !currentMap || fieldState.isPaused) return;

  // Check for NPC interaction first (Headline 15b)
  if (fieldState.npcs) {
    const nearbyNpc = getNpcInRange(fieldState.player, fieldState.npcs);
    if (nearbyNpc && nearbyNpc.dialogueId) {
      const dialogueLines = NPC_DIALOGUE[nearbyNpc.dialogueId] || [
        "Hello there!",
        "This is placeholder dialogue.",
      ];
      
      // Pause field movement while in dialogue
      fieldState.isPaused = true;
      
      showDialogue(nearbyNpc.name, dialogueLines, () => {
        // Resume field movement after dialogue
        if (fieldState) {
          fieldState.isPaused = false;
        }
      });
      
      return;
    }
  }

  const zoneId = getOverlappingInteractionZone(fieldState.player, currentMap);
  if (!zoneId) return;

  const zone = getInteractionZone(currentMap, zoneId);
  if (!zone) return;

  const savedPlayerPos = { x: fieldState.player.x, y: fieldState.player.y };
  fieldState.isPaused = true;

  try {
    handleInteraction(zone, currentMap, () => {
      if (fieldState) {
        fieldState.isPaused = false;
        const tileSize = 64;
        const offsetX = savedPlayerPos.x % tileSize < tileSize / 2 ? -8 : 8;
        const offsetY = savedPlayerPos.y % tileSize < tileSize / 2 ? -8 : 8;
        fieldState.player.x = savedPlayerPos.x + offsetX;
        fieldState.player.y = savedPlayerPos.y + offsetY;
        renderFieldScreen(fieldState.currentMap);
      }
    });
  } catch (error) {
    console.error("[FIELD] Error handling interaction:", error);
    if (fieldState) {
      fieldState.isPaused = false;
      renderFieldScreen(fieldState.currentMap);
    }
  }
}

// ============================================================================
// NODE ACTIONS
// ============================================================================

function handleNodeAction(action: string): void {
  if (fieldState) {
    fieldState.isPaused = true;
  }

  closeAllNodesPanel();

  switch (action) {
    case "shop":
      import("../ui/screens/ShopScreen").then(({ renderShopScreen }) => {
        renderShopScreen("basecamp");
      });
      break;
    case "workshop":
      import("../ui/screens/WorkshopScreen").then(({ renderCraftingScreen }) => {
        renderCraftingScreen("basecamp");
      });
      break;
    case "roster":
      import("../ui/screens/RosterScreen").then(({ renderRosterScreen }) => {
        renderRosterScreen("basecamp");
      });
      break;
    case "loadout":
      import("../ui/screens/InventoryScreen").then(({ renderInventoryScreen }) => {
        renderInventoryScreen("basecamp");
      });
      break;
    case "quest-board":
      import("../ui/screens/QuestBoardScreen").then(({ renderQuestBoardScreen }) => {
        renderQuestBoardScreen("basecamp");
      });
      break;
    case "tavern":
      import("../ui/screens/RecruitmentScreen").then(({ renderRecruitmentScreen }) => {
        renderRecruitmentScreen("basecamp");
      });
      break;
    case "ops-terminal":
      import("../ui/screens/OperationSelectScreen").then(({ renderOperationSelectScreen }) => {
        renderOperationSelectScreen("basecamp");
      });
      break;
    case "gear-workbench":
      import("../ui/screens/GearWorkbenchScreen").then(({ renderGearWorkbenchScreen }) => {
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
      import("../ui/screens/PortScreen").then(({ renderPortScreen }) => {
        renderPortScreen("basecamp");
      });
      break;
    case "stable":
      import("../ui/screens/StableScreen").then(({ renderStableScreen }) => {
        renderStableScreen("basecamp");
      });
      break;
    case "settings":
      import("../ui/screens/SettingsScreen").then(({ renderSettingsScreen }) => {
        renderSettingsScreen("basecamp");
      });
      break;
    case "endless-field-nodes":
      // Endless field nodes mode - continuous rooms until ESC pressed
      import("../ui/screens/FieldNodeRoomScreen").then(({ renderFieldNodeRoomScreen }) => {
        const initialSeed = Math.floor(Math.random() * 1000000);
        console.log("[ENDLESS] Starting endless field nodes mode with seed:", initialSeed);
        renderFieldNodeRoomScreen("endless_room_0", initialSeed, true);
      });
      break;
    case "endless-battles":
      // Endless battles mode - continuous battles until exit
      import("../ui/screens/BattleScreen").then(({ startEndlessBattleMode }) => {
        console.log("[ENDLESS] Starting endless battles mode");
        startEndlessBattleMode();
      });
      break;
  }
}

// ============================================================================
// GAME LOOP
// ============================================================================

function startGameLoop(): void {
  lastFrameTime = performance.now();
  animationFrameId = requestAnimationFrame(gameLoop);
}

function gameLoop(currentTime: number): void {
  if (!fieldState || !currentMap) return;

  const deltaTime = currentTime - lastFrameTime;
  lastFrameTime = currentTime;

  if (!fieldState.isPaused) {
    const state = getGameState();
    // Ensure players object exists (backward compatibility)
    const players = state.players || {
      P1: { id: "P1", active: true, color: "#ff8a00", inputSource: "keyboard1" as const, avatar: null, controlledUnitIds: [] },
      P2: { id: "P2", active: false, color: "#6849c2", inputSource: "none" as const, avatar: null, controlledUnitIds: [] },
    };
    const p1 = players.P1;
    const p2 = players.P2;
    
    // Update P1 avatar movement
    if (p1.active && p1.avatar) {
      const p1Input = getPlayerInput("P1");
      const p1MovementInput = {
        up: p1Input.up,
        down: p1Input.down,
        left: p1Input.left,
        right: p1Input.right,
        dash: p1Input.special1,
      };
      
      // Convert FieldAvatar to PlayerAvatar for movement function
      const p1PlayerAvatar = {
        x: p1.avatar.x,
        y: p1.avatar.y,
        width: 32,
        height: 32,
        speed: 240,
        facing: p1.avatar.facing,
      };
      
      let newP1Avatar = updatePlayerMovement(
        p1PlayerAvatar,
        p1MovementInput,
        currentMap,
        deltaTime,
      );
      
      // Apply tether constraint if P2 is active
      if (p2.active && p2.avatar) {
        const constrained = applyTetherConstraint(
          { x: newP1Avatar.x, y: newP1Avatar.y },
          { x: newP1Avatar.x, y: newP1Avatar.y },
          p2.avatar
        );
        newP1Avatar.x = constrained.x;
        newP1Avatar.y = constrained.y;
      }
      
      // Update P1 avatar in game state
      updateGameState(s => ({
        ...s,
        players: {
          ...s.players,
          P1: {
            ...s.players.P1,
            avatar: {
              x: newP1Avatar.x,
              y: newP1Avatar.y,
              facing: newP1Avatar.facing,
            },
          },
        },
      }));
    }
    
    // Update P2 avatar movement
    if (p2.active && p2.avatar) {
      const p2Input = getPlayerInput("P2");
      const p2MovementInput = {
        up: p2Input.up,
        down: p2Input.down,
        left: p2Input.left,
        right: p2Input.right,
        dash: p2Input.special1,
      };
      
      // Convert FieldAvatar to PlayerAvatar for movement function
      const p2PlayerAvatar = {
        x: p2.avatar.x,
        y: p2.avatar.y,
        width: 32,
        height: 32,
        speed: 240,
        facing: p2.avatar.facing,
      };
      
      let newP2Avatar = updatePlayerMovement(
        p2PlayerAvatar,
        p2MovementInput,
        currentMap,
        deltaTime,
      );
      
      // Apply tether constraint (P2 constrained by P1)
      if (p1.active && p1.avatar) {
        const constrained = applyTetherConstraint(
          { x: newP2Avatar.x, y: newP2Avatar.y },
          { x: newP2Avatar.x, y: newP2Avatar.y },
          p1.avatar
        );
        newP2Avatar.x = constrained.x;
        newP2Avatar.y = constrained.y;
      }
      
      // Update P2 avatar in game state
      updateGameState(s => ({
        ...s,
        players: {
          ...s.players,
          P2: {
            ...s.players.P2,
            avatar: {
              x: newP2Avatar.x,
              y: newP2Avatar.y,
              facing: newP2Avatar.facing,
            },
          },
        },
      }));
    }
    
    // Update legacy fieldState.player for backward compatibility (use P1 position)
    const updatedState = getGameState();
    if (updatedState.players.P1.avatar) {
      fieldState.player = {
        ...fieldState.player,
        x: updatedState.players.P1.avatar.x,
        y: updatedState.players.P1.avatar.y,
        facing: updatedState.players.P1.avatar.facing as any,
      };
    }

    // Update Sable companion (Headline 15a) - follows P1
    if (fieldState.companion && currentMap && updatedState.players.P1.avatar) {
      const p1Avatar = updatedState.players.P1.avatar;
      const p1PlayerAvatar = {
        x: p1Avatar.x,
        y: p1Avatar.y,
        width: 32,
        height: 32,
        speed: 240,
        facing: p1Avatar.facing as any,
      };
      fieldState.companion = updateCompanion(fieldState.companion, {
        player: p1PlayerAvatar,
        map: currentMap,
        deltaTime,
        currentTime,
      });
    }

    // Update NPCs (Headline 15b)
    if (fieldState.npcs && currentMap) {
      const map = currentMap; // Type narrowing
      fieldState.npcs = fieldState.npcs.map(npc => 
        updateNpc(npc, map, deltaTime, currentTime)
      );
    }

    // Check interaction zones (use P1 for now, could check both)
    const updatedPlayers = updatedState.players || {
      P1: { id: "P1", active: true, color: "#ff8a00", inputSource: "keyboard1" as const, avatar: null, controlledUnitIds: [] },
      P2: { id: "P2", active: false, color: "#6849c2", inputSource: "none" as const, avatar: null, controlledUnitIds: [] },
    };
    const p1Avatar = updatedPlayers.P1.avatar;
    if (p1Avatar) {
      const p1PlayerAvatar = {
        x: p1Avatar.x,
        y: p1Avatar.y,
        width: 32,
        height: 32,
        speed: 240,
        facing: p1Avatar.facing as any,
      };
      const overlappingZone = getOverlappingInteractionZone(p1PlayerAvatar, currentMap);
      if (overlappingZone) {
        const zone = getInteractionZone(currentMap, overlappingZone);
        activeInteractionPrompt = zone?.label || null;
      } else {
        activeInteractionPrompt = null;
      }
    }

    render();
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

function stopGameLoop(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// ============================================================================
// EXIT
// ============================================================================

export function exitFieldMode(): void {
  stopGameLoop();
  cleanupGlobalListeners();

  // Remove panel
  const panel = document.getElementById("allNodesPanel");
  if (panel) {
    panel.remove();
  }

  isPanelOpen = false;
  renderBaseCampScreen();
}

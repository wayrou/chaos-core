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
import { getGameState } from "../state/gameStore";
import { renderBaseCampScreen } from "../ui/screens/BaseCampScreen";
import { createCompanion, updateCompanion } from "./companion";
import { createNpc, updateNpc, getNpcInRange, NPC_DIALOGUE } from "./npcs";
import { showDialogue } from "../ui/screens/DialogueScreen";

// ============================================================================
// STATE
// ============================================================================

let fieldState: FieldState | null = null;
let currentMap: FieldMap | null = null;
let animationFrameId: number | null = null;
let lastFrameTime = 0;
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
// RENDER
// ============================================================================

export function renderFieldScreen(mapId: FieldMap["id"] = "base_camp"): void {
  const root = document.getElementById("app");
  if (!root) return;

  // Load map
  currentMap = getFieldMap(mapId);

  // Preserve player position if resuming, otherwise initialize at center
  const tileSize = 64;
  let playerX: number;
  let playerY: number;

  const isResuming = fieldState && fieldState.currentMap === mapId;

  if (isResuming) {
    playerX = fieldState!.player.x;
    playerY = fieldState!.player.y;
  } else {
    playerX = (currentMap.width * tileSize) / 2;
    playerY = (currentMap.height * tileSize) / 2;
  }

  if (isResuming && fieldState && fieldState.player) {
    // Preserve companion if it exists
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
      // Add a few NPCs at different locations
      npcs.push(
        createNpc("npc_medic", "Medic", 5 * tileSize + tileSize / 2, 8 * tileSize + tileSize / 2, "npc_medic"),
        createNpc("npc_quartermaster", "Quartermaster", 12 * tileSize + tileSize / 2, 6 * tileSize + tileSize / 2, "npc_quartermaster"),
        createNpc("npc_scout", "Scout", 8 * tileSize + tileSize / 2, 12 * tileSize + tileSize / 2, "npc_scout"),
        createNpc("npc_engineer", "Engineer", 14 * tileSize + tileSize / 2, 10 * tileSize + tileSize / 2, "npc_engineer")
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

  // Player avatar
  const playerHtml = `
    <div class="field-player" 
         style="left: ${fieldState.player.x - fieldState.player.width / 2}px; top: ${
    fieldState.player.y - fieldState.player.height / 2
  }px; width: ${fieldState.player.width}px; height: ${fieldState.player.height}px;"
         data-facing="${fieldState.player.facing}">
      <div class="field-player-sprite">A</div>
    </div>
  `;

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
  
  // Attach button listener (needs to be done each render since innerHTML replaces it)
  const allNodesBtn = document.getElementById("fieldAllNodesBtn");
  if (allNodesBtn) {
    allNodesBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleAllNodesPanel();
    };
  }
}

function centerViewportOnPlayer(): void {
  if (!fieldState) return;

  const viewport = document.querySelector(".field-viewport");
  const map = document.querySelector(".field-map");
  if (!viewport || !map) return;

  const viewportRect = viewport.getBoundingClientRect();
  const mapElement = map as HTMLElement;

  const offsetX = fieldState.player.x - viewportRect.width / 2;
  const offsetY = fieldState.player.y - viewportRect.height / 2;

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

  panel.innerHTML = `
    <div class="all-nodes-panel-content">
      <div class="all-nodes-panel-header">
        <div class="all-nodes-panel-title">ALL NODES</div>
        <button class="all-nodes-panel-close" id="allNodesPanelClose">×</button>
      </div>
      <div class="all-nodes-panel-body">
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
          <button class="all-nodes-btn" data-action="settings">
            <span class="btn-icon">⚙</span>
            <span class="btn-label">SETTINGS</span>
          </button>
          <div class="all-nodes-divider"></div>
          <button class="all-nodes-btn all-nodes-btn--debug" data-action="endless-field-nodes">
            <span class="btn-icon">∞</span>
            <span class="btn-label">ENDLESS FIELD NODES</span>
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
  isPanelOpen = !isPanelOpen;
  
  // Refresh content when opening
  if (isPanelOpen) {
    updateAllNodesPanelContent();
  }
  
  updatePanelVisibility();
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

  globalListenersAttached = true;
}

function cleanupGlobalListeners(): void {
  if (!globalListenersAttached) return;

  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  document.removeEventListener("click", handleFieldObjectClick, true);

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

  // Don't process movement if paused
  if (fieldState?.isPaused) return;

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
      handleInteractKey();
      e.preventDefault();
      break;
  }
}

function handleKeyUp(e: KeyboardEvent): void {
  if (!document.querySelector(".field-root")) return;

  const key = e.key?.toLowerCase() ?? "";

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
      import("../ui/screens/WorkshopScreen").then(({ renderWorkshopScreen }) => {
        renderWorkshopScreen("basecamp");
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
    fieldState.player = updatePlayerMovement(
      fieldState.player,
      movementInput,
      currentMap,
      deltaTime,
    );

    // Update Sable companion (Headline 15a)
    if (fieldState.companion && currentMap) {
      fieldState.companion = updateCompanion(fieldState.companion, {
        player: fieldState.player,
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

    const overlappingZone = getOverlappingInteractionZone(fieldState.player, currentMap);
    if (overlappingZone) {
      const zone = getInteractionZone(currentMap, overlappingZone);
      activeInteractionPrompt = zone?.label || null;
    } else {
      activeInteractionPrompt = null;
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

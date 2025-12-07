// ============================================================================
// FIELD SYSTEM - FIELD MODE SCREEN
// ============================================================================

import "./field.css";
import { FieldMap, FieldState, PlayerAvatar, InteractionZone } from "./types";
import { getFieldMap } from "./maps";
import { createPlayerAvatar, updatePlayerMovement, getOverlappingInteractionZone, MovementInput } from "./player";
import { handleInteraction, getInteractionZone } from "./interactions";
import { getGameState } from "../state/gameStore";

// ============================================================================
// STATE
// ============================================================================

let fieldState: FieldState | null = null;
let currentMap: FieldMap | null = null;
let animationFrameId: number | null = null;
let lastFrameTime = 0;
let movementInput: MovementInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  dash: false,
};

let activeInteractionPrompt: string | null = null;
let inputHandlersSetup = false;

// ============================================================================
// RENDER
// ============================================================================

// Store root element reference for event delegation
let appRoot: HTMLElement | null = null;

export function renderFieldScreen(mapId: FieldMap["id"] = "base_camp"): void {
  const root = document.getElementById("app");
  if (!root) return;
  
  // Store root reference for event delegation
  appRoot = root;
  
  // Load map
  currentMap = getFieldMap(mapId);
  
  // Preserve player position if resuming, otherwise initialize at center
  const tileSize = 64;
  let playerX: number;
  let playerY: number;
  
  // Check if we're resuming the same map (preserve position)
  const isResuming = fieldState && fieldState.currentMap === mapId;
  
  if (isResuming) {
    // Preserve existing position when returning to the same map
    playerX = fieldState.player.x;
    playerY = fieldState.player.y;
  } else {
    // Initialize at center for new map or first load
    playerX = (currentMap.width * tileSize) / 2;
    playerY = (currentMap.height * tileSize) / 2;
  }
  
  // Preserve existing player state or create new one
  if (isResuming && fieldState.player) {
    // Keep existing player but update position (in case it changed)
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
    };
  } else {
    // Create new player
    fieldState = {
      currentMap: mapId,
      player: createPlayerAvatar(playerX, playerY),
      isPaused: false,
      activeInteraction: null,
    };
  }
  
  // Setup input handlers (only once, or re-setup if needed)
  if (!inputHandlersSetup) {
    setupInputHandlers();
    inputHandlersSetup = true;
  }
  
  // Always restart game loop when rendering (in case it was stopped)
  if (animationFrameId !== null) {
    stopGameLoop();
  }
  
  // Reset movement input to prevent stuck movement
  movementInput = {
    up: false,
    down: false,
    left: false,
    right: false,
    dash: false,
  };
  
  startGameLoop();
  
  // Render initial view
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
  
  // Build objects HTML (stations, resources, etc.) - make them clickable
  let objectsHtml = "";
  for (const obj of currentMap.objects) {
    // Find associated interaction zone for this object (usually in front of it)
    const associatedZone = currentMap.interactionZones.find(
      zone => {
        // Zone is typically in front of the object (same x, y + height)
        const zoneCenterX = zone.x + zone.width / 2;
        const zoneCenterY = zone.y + zone.height / 2;
        const objCenterX = obj.x + obj.width / 2;
        const objCenterY = obj.y + obj.height / 2;
        // Check if zone is near the object (within 2 tiles)
        return Math.abs(zoneCenterX - objCenterX) < 2 && Math.abs(zoneCenterY - objCenterY) < 2;
      }
    );
    const clickAction = associatedZone ? `data-interaction-zone="${associatedZone.id}"` : "";
    const cursorStyle = associatedZone ? "cursor: pointer;" : "";
    
    objectsHtml += `
      <div class="field-object field-object-${obj.type}" 
           style="left: ${obj.x * tileSize}px; top: ${obj.y * tileSize}px; width: ${obj.width * tileSize}px; height: ${obj.height * tileSize}px; ${cursorStyle}"
           title="${obj.metadata?.name || obj.id}${associatedZone ? ' (Click to interact)' : ''}"
           ${clickAction}>
        <div class="field-object-placeholder">${obj.metadata?.name || obj.type}</div>
      </div>
    `;
  }
  
  // Player avatar
  const playerHtml = `
    <div class="field-player" 
         style="left: ${fieldState.player.x - fieldState.player.width / 2}px; top: ${fieldState.player.y - fieldState.player.height / 2}px; width: ${fieldState.player.width}px; height: ${fieldState.player.height}px;"
         data-facing="${fieldState.player.facing}">
      <div class="field-player-sprite">A</div>
    </div>
  `;
  
  // Interaction prompt
  const promptHtml = activeInteractionPrompt
    ? `<div class="field-interaction-prompt">E — ${activeInteractionPrompt}</div>`
    : "";
  
  root.innerHTML = `
    <div class="field-root">
      <div class="field-header">
        <div class="field-header-title">FIELD MODE — ${currentMap.name.toUpperCase()}</div>
        <div class="field-header-buttons">
          <button class="field-basecamp-btn" id="fieldBaseCampBtn" title="Open Base Camp Menu (M)">BASE CAMP</button>
          <button class="field-exit-btn" id="fieldExitBtn">EXIT FIELD MODE</button>
        </div>
      </div>
      
      <div class="field-viewport">
        <div class="field-map" style="width: ${mapPixelWidth}px; height: ${mapPixelHeight}px;">
          ${tilesHtml}
          ${objectsHtml}
          ${playerHtml}
        </div>
      </div>
      
      ${promptHtml}
      
      <div class="field-hud">
        <div class="field-hud-instructions">
          WASD to move • Shift to dash • E to interact • M for Base Camp • ESC to exit
        </div>
      </div>
      
      <!-- Base Camp Side Panel -->
      <div class="field-basecamp-panel" id="fieldBaseCampPanel">
        <div class="field-basecamp-panel-content">
          <div class="field-basecamp-panel-header">
            <div class="field-basecamp-panel-title">BASE CAMP</div>
            <button class="field-basecamp-panel-close" id="fieldBaseCampPanelClose">×</button>
          </div>
          <div class="field-basecamp-panel-body" id="fieldBaseCampPanelBody">
            <!-- Content will be populated by showBaseCampPanel -->
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Center viewport on player
  centerViewportOnPlayer();
  
  // Attach event listeners (use setTimeout to ensure DOM is fully rendered)
  // Use requestAnimationFrame to ensure DOM is ready
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      attachEventListeners();
    });
  });
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
// INPUT HANDLING
// ============================================================================

function setupInputHandlers(): void {
  console.log("[FIELD] Setting up input handlers");
  // Remove existing listeners first to prevent duplicates
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  document.removeEventListener("keydown", handleKeyDown);
  document.removeEventListener("keyup", handleKeyUp);
  
  // Add listeners to both window and document for maximum coverage
  window.addEventListener("keydown", handleKeyDown, true); // Use capture phase
  window.addEventListener("keyup", handleKeyUp, true);
  document.addEventListener("keydown", handleKeyDown, true);
  document.addEventListener("keyup", handleKeyUp, true);
  
  console.log("[FIELD] Input handlers attached");
}

function handleKeyDown(e: KeyboardEvent): void {
  // M key handler - check FIRST before any other checks
  // This must work even if field mode is paused or in transition
  const isMKey = e.key === "m" || e.key === "M" || e.code === "KeyM" || e.keyCode === 77;
  if (isMKey) {
    // Only process if we're actually in field mode
    const fieldRoot = document.querySelector(".field-root");
    if (fieldRoot) {
      e.preventDefault();
      e.stopPropagation();
      console.log("[FIELD] M key pressed, toggling base camp panel");
      try {
        toggleBaseCampPanel();
      } catch (error) {
        console.error("[FIELD] Error toggling base camp panel:", error);
      }
      return;
    }
  }
  
  // Only handle other keys when in field mode
  const fieldRoot = document.querySelector(".field-root");
  if (!fieldRoot) {
    return;
  }
  
  // Note: Shift key handling is done in the switch statement below
  // to properly handle shift+movement combinations
  
  if (fieldState?.isPaused) return;
  
  // Check for dash modifier
  const isDashing = e.shiftKey;
  if (isDashing) {
    movementInput.dash = true;
  }
  
  switch (e.key.toLowerCase()) {
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
    case "escape":
      // Close base camp panel if open, otherwise exit field mode
      const panel = document.getElementById("fieldBaseCampPanel");
      if (panel && panel.classList.contains("field-basecamp-panel--open")) {
        hideBaseCampPanel();
      } else {
        exitFieldMode();
      }
      e.preventDefault();
      break;
  }
}

function handleKeyUp(e: KeyboardEvent): void {
  // Only handle keys when in field mode
  if (!document.querySelector(".field-root")) {
    return;
  }
  
  // Check if shift is still held
  if (!e.shiftKey) {
    movementInput.dash = false;
  }
  
  switch (e.key.toLowerCase()) {
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

function handleInteractKey(): void {
  if (!fieldState || !currentMap || fieldState.isPaused) return;
  
  const zoneId = getOverlappingInteractionZone(fieldState.player, currentMap);
  if (!zoneId) return;
  
  const zone = getInteractionZone(currentMap, zoneId);
  if (!zone) {
    console.warn("[FIELD] Interaction zone not found:", zoneId);
    return;
  }
  
  // Store current player position before pausing
  const savedPlayerPos = { x: fieldState.player.x, y: fieldState.player.y };
  
  // Pause field mode
  fieldState.isPaused = true;
  
  // Handle interaction
  // Note: Most interactions will open a new screen. To return to field mode,
  // those screens should call renderFieldScreen() when closed.
  try {
    handleInteraction(zone, currentMap, () => {
      // Resume field mode (for interactions that don't open a new screen)
      if (fieldState) {
        fieldState.isPaused = false;
        // Ensure player position is preserved - move slightly away from interaction zone to prevent getting stuck
        const tileSize = 64;
        const offsetX = (savedPlayerPos.x % tileSize < tileSize / 2) ? -8 : 8;
        const offsetY = (savedPlayerPos.y % tileSize < tileSize / 2) ? -8 : 8;
        fieldState.player.x = savedPlayerPos.x + offsetX;
        fieldState.player.y = savedPlayerPos.y + offsetY;
        renderFieldScreen(fieldState.currentMap);
      }
    });
  } catch (error) {
    console.error("[FIELD] Error handling interaction:", error);
    // Resume field mode on error
    if (fieldState) {
      fieldState.isPaused = false;
      renderFieldScreen(fieldState.currentMap);
    }
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
  if (!fieldState || !currentMap) {
    return;
  }
  
  const deltaTime = currentTime - lastFrameTime;
  lastFrameTime = currentTime;
  
  if (!fieldState.isPaused) {
    // Update player movement
    fieldState.player = updatePlayerMovement(
      fieldState.player,
      movementInput,
      currentMap,
      deltaTime
    );
    
    // Check for interaction zones (only show prompt, don't block movement)
    const overlappingZone = getOverlappingInteractionZone(fieldState.player, currentMap);
    if (overlappingZone) {
      const zone = getInteractionZone(currentMap, overlappingZone);
      activeInteractionPrompt = zone?.label || null;
    } else {
      activeInteractionPrompt = null;
    }
    
    // Re-render (but only update viewport, not full DOM to avoid breaking event listeners)
    // For now, we'll do a full render but ensure event listeners are re-attached
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
// EVENT LISTENERS
// ============================================================================

// Click handler for field objects (defined once, reused)
function handleFieldObjectClick(e: MouseEvent): void {
  // Only handle clicks when we're in field mode
  if (!document.querySelector(".field-root")) {
    return;
  }
  
  const target = e.target as HTMLElement;
  const objEl = target.closest(".field-object[data-interaction-zone]") as HTMLElement;
  if (objEl) {
    e.stopPropagation();
    e.preventDefault();
    const zoneId = objEl.getAttribute("data-interaction-zone");
    if (!zoneId || !currentMap || !fieldState) {
      return;
    }
    
    const zone = getInteractionZone(currentMap, zoneId);
    if (!zone) {
      return;
    }
    
    // Store current player position before pausing
    const savedPlayerPos = { x: fieldState.player.x, y: fieldState.player.y };
    
    // Pause field mode
    fieldState.isPaused = true;
    
    // Handle interaction
    handleInteraction(zone, currentMap, () => {
      // Resume field mode
      if (fieldState) {
        fieldState.isPaused = false;
        // Ensure player position is preserved - move slightly away from interaction zone to prevent getting stuck
        const tileSize = 64;
        const offsetX = (savedPlayerPos.x % tileSize < tileSize / 2) ? -8 : 8;
        const offsetY = (savedPlayerPos.y % tileSize < tileSize / 2) ? -8 : 8;
        fieldState.player.x = savedPlayerPos.x + offsetX;
        fieldState.player.y = savedPlayerPos.y + offsetY;
        renderFieldScreen(fieldState.currentMap);
      }
    });
  }
}

function attachEventListeners(): void {
  console.log("[FIELD] attachEventListeners called");
  
  // Exit button
  const exitBtn = document.getElementById("fieldExitBtn");
  if (exitBtn) {
    exitBtn.onclick = exitFieldMode;
    console.log("[FIELD] Exit button handler attached");
  } else {
    console.warn("[FIELD] Exit button not found");
  }
  
  // Base camp button - use onclick for maximum reliability
  const baseCampBtn = document.getElementById("fieldBaseCampBtn");
  if (baseCampBtn) {
    console.log("[FIELD] Found base camp button, attaching handlers");
    // Clear any existing handlers
    baseCampBtn.onclick = null;
    
    // Use onclick (more reliable than addEventListener for buttons)
    baseCampBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("[FIELD] Base camp button clicked (onclick)");
      try {
        toggleBaseCampPanel();
      } catch (error) {
        console.error("[FIELD] Error toggling panel from button:", error);
        alert(`Error opening base camp: ${error}`);
      }
    };
    
    // Also add event listener as backup
    baseCampBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("[FIELD] Base camp button clicked (addEventListener)");
      try {
        toggleBaseCampPanel();
      } catch (error) {
        console.error("[FIELD] Error toggling panel from button:", error);
      }
    }, { once: false, passive: false });
    
    // Ensure button is clickable
    baseCampBtn.style.pointerEvents = "auto";
    baseCampBtn.style.cursor = "pointer";
    baseCampBtn.style.zIndex = "101";
  } else {
    console.error("[FIELD] Base camp button not found in DOM!");
    // Try to find it again after a short delay
    setTimeout(() => {
      const retryBtn = document.getElementById("fieldBaseCampBtn");
      if (retryBtn) {
        console.log("[FIELD] Found button on retry, attaching handler");
        retryBtn.onclick = () => toggleBaseCampPanel();
      } else {
        console.error("[FIELD] Button still not found after retry");
      }
    }, 100);
  }
  
  // Close button for panel
  const panelCloseBtn = document.getElementById("fieldBaseCampPanelClose");
  if (panelCloseBtn) {
    panelCloseBtn.onclick = () => {
      hideBaseCampPanel();
    };
  }
  
  // Use event delegation for clickable field objects
  // Attach to appRoot (#app) which persists across all renders
  // This is set up once in renderFieldScreen, but we ensure it's attached here
  if (appRoot) {
    // Remove any existing listener first to prevent duplicates
    appRoot.removeEventListener("click", handleFieldObjectClick);
    // Add new listener
    appRoot.addEventListener("click", handleFieldObjectClick);
  }
}

function toggleBaseCampPanel(): void {
  console.log("[FIELD] toggleBaseCampPanel called");
  const panel = document.getElementById("fieldBaseCampPanel");
  if (!panel) {
    console.error("[FIELD] Base camp panel not found in DOM - attempting to create it");
    // Try to find the field root and create panel if missing
    const fieldRoot = document.querySelector(".field-root");
    if (fieldRoot) {
      console.log("[FIELD] Field root found, panel should exist. Checking DOM...");
      // Panel should exist from renderFieldScreen, but let's verify
      const checkPanel = document.getElementById("fieldBaseCampPanel");
      if (!checkPanel) {
        console.error("[FIELD] Panel still missing after check. This is a bug.");
        return;
      }
    } else {
      console.error("[FIELD] Not in field mode - cannot toggle panel");
      return;
    }
  }
  
  const isOpen = panel.classList.contains("field-basecamp-panel--open");
  console.log(`[FIELD] Panel is currently ${isOpen ? "open" : "closed"}`);
  
  if (isOpen) {
    hideBaseCampPanel();
  } else {
    showBaseCampPanel();
  }
}

function showBaseCampPanel(): void {
  console.log("[FIELD] showBaseCampPanel called");
  const panel = document.getElementById("fieldBaseCampPanel");
  const panelBody = document.getElementById("fieldBaseCampPanelBody");
  if (!panel) {
    console.error("[FIELD] Panel element not found");
    return;
  }
  if (!panelBody) {
    console.error("[FIELD] Panel body element not found");
    return;
  }
  
  const state = getGameState();
  const wad = state.wad ?? 0;
  const res = state.resources ?? { metalScrap: 0, wood: 0, chaosShards: 0, steamComponents: 0 };
  
  panelBody.innerHTML = `
    <div class="field-basecamp-panel-resources">
      <div class="field-basecamp-panel-resource-item">
        <span class="field-basecamp-panel-resource-label">WAD</span>
        <span class="field-basecamp-panel-resource-value">${wad}</span>
      </div>
      <div class="field-basecamp-panel-resource-item">
        <span class="field-basecamp-panel-resource-label">METAL</span>
        <span class="field-basecamp-panel-resource-value">${res.metalScrap}</span>
      </div>
      <div class="field-basecamp-panel-resource-item">
        <span class="field-basecamp-panel-resource-label">WOOD</span>
        <span class="field-basecamp-panel-resource-value">${res.wood}</span>
      </div>
      <div class="field-basecamp-panel-resource-item">
        <span class="field-basecamp-panel-resource-label">SHARDS</span>
        <span class="field-basecamp-panel-resource-value">${res.chaosShards}</span>
      </div>
      <div class="field-basecamp-panel-resource-item">
        <span class="field-basecamp-panel-resource-label">STEAM</span>
        <span class="field-basecamp-panel-resource-value">${res.steamComponents}</span>
      </div>
    </div>
    
    <div class="field-basecamp-panel-buttons">
      <button class="field-basecamp-panel-btn" data-action="startop">
        <span class="btn-icon">🎯</span>
        <span class="btn-label">START OPERATION</span>
      </button>
      <button class="field-basecamp-panel-btn" data-action="loadout">
        <span class="btn-icon">🎒</span>
        <span class="btn-label">LOADOUT</span>
      </button>
      <button class="field-basecamp-panel-btn" data-action="shop">
        <span class="btn-icon">🛒</span>
        <span class="btn-label">SHOP</span>
      </button>
      <button class="field-basecamp-panel-btn" data-action="roster">
        <span class="btn-icon">👥</span>
        <span class="btn-label">UNIT ROSTER</span>
      </button>
      <button class="field-basecamp-panel-btn" data-action="workshop">
        <span class="btn-icon">🔨</span>
        <span class="btn-label">WORKSHOP</span>
      </button>
      <button class="field-basecamp-panel-btn" data-action="tavern">
        <span class="btn-icon">🍺</span>
        <span class="btn-label">TAVERN</span>
      </button>
      <button class="field-basecamp-panel-btn" data-action="gear-workbench">
        <span class="btn-icon">🔧</span>
        <span class="btn-label">GEAR WORKBENCH</span>
      </button>
      <button class="field-basecamp-panel-btn" data-action="settings">
        <span class="btn-icon">⚙</span>
        <span class="btn-label">SETTINGS</span>
      </button>
    </div>
  `;
  
  // Attach button listeners
  panelBody.querySelectorAll(".field-basecamp-panel-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const action = (e.currentTarget as HTMLElement).getAttribute("data-action");
      handleBaseCampPanelAction(action);
    });
  });
  
  // Show panel
  panel.classList.add("field-basecamp-panel--open");
}

function hideBaseCampPanel(): void {
  console.log("[FIELD] hideBaseCampPanel called");
  const panel = document.getElementById("fieldBaseCampPanel");
  if (panel) {
    panel.classList.remove("field-basecamp-panel--open");
    console.log("[FIELD] Panel hidden");
  } else {
    console.warn("[FIELD] Panel not found when trying to hide");
  }
}

function handleBaseCampPanelAction(action: string | null): void {
  if (!action) return;
  
  // Pause field mode
  if (fieldState) {
    fieldState.isPaused = true;
  }
  
  // Hide panel
  hideBaseCampPanel();
  
  // Import screens dynamically to avoid circular dependencies
  switch (action) {
    case "startop":
      import("../ui/screens/OperationSelectScreen").then(({ renderOperationSelectScreen }) => {
        renderOperationSelectScreen("field");
      });
      break;
    case "loadout":
      import("../ui/screens/InventoryScreen").then(({ renderInventoryScreen }) => {
        renderInventoryScreen("field");
      });
      break;
    case "shop":
      import("../ui/screens/ShopScreen").then(({ renderShopScreen }) => {
        renderShopScreen("field");
      });
      break;
    case "roster":
      import("../ui/screens/RosterScreen").then(({ renderRosterScreen }) => {
        renderRosterScreen("field");
      });
      break;
    case "workshop":
      import("../ui/screens/WorkshopScreen").then(({ renderWorkshopScreen }) => {
        renderWorkshopScreen("field");
      });
      break;
    case "tavern":
      import("../ui/screens/RecruitmentScreen").then(({ renderRecruitmentScreen }) => {
        renderRecruitmentScreen("field");
      });
      break;
    case "gear-workbench":
      import("../ui/screens/GearWorkbenchScreen").then(({ renderGearWorkbenchScreen }) => {
        const state = getGameState();
        const firstUnitId = state.partyUnitIds?.[0] ?? null;
        if (firstUnitId) {
          const unit = state.unitsById[firstUnitId];
          const weaponId = (unit as any)?.loadout?.weapon ?? null;
          renderGearWorkbenchScreen(firstUnitId, weaponId, "field");
        } else {
          renderGearWorkbenchScreen(undefined, undefined, "field");
        }
      });
      break;
    case "settings":
      import("../ui/screens/SettingsScreen").then(({ renderSettingsScreen }) => {
        renderSettingsScreen("basecamp");
      });
      break;
  }
}

function exitFieldMode(): void {
  stopGameLoop();
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  inputHandlersSetup = false;
  
  // Remove click handler from app root
  if (appRoot) {
    appRoot.removeEventListener("click", handleFieldObjectClick);
    appRoot = null;
  }
  
  // Return to Base Camp screen (full screen version)
  const { renderBaseCampScreen } = require("../ui/screens/BaseCampScreen");
  renderBaseCampScreen();
}


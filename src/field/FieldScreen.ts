// ============================================================================
// FIELD SYSTEM - FIELD MODE SCREEN
// ============================================================================

import "./field.css";
import { FieldMap, FieldState, PlayerAvatar, InteractionZone } from "./types";
import { getFieldMap } from "./maps";
import { createPlayerAvatar, updatePlayerMovement, getOverlappingInteractionZone, MovementInput } from "./player";
import { handleInteraction, getInteractionZone } from "./interactions";
import { showBaseCampModal, hideBaseCampModal } from "../ui/screens/BaseCampScreen";

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

// ============================================================================
// RENDER
// ============================================================================

export function renderFieldScreen(mapId: FieldMap["id"] = "base_camp"): void {
  const root = document.getElementById("app");
  if (!root) return;
  
  // Load map
  currentMap = getFieldMap(mapId);
  
  // Initialize player at center of map
  const tileSize = 64;
  const startX = (currentMap.width * tileSize) / 2;
  const startY = (currentMap.height * tileSize) / 2;
  
  fieldState = {
    currentMap: mapId,
    player: createPlayerAvatar(startX, startY),
    isPaused: false,
    activeInteraction: null,
  };
  
  // Setup input handlers
  setupInputHandlers();
  
  // Start game loop
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
    </div>
  `;
  
  // Center viewport on player
  centerViewportOnPlayer();
  
  // Attach event listeners
  attachEventListeners();
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
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
}

function handleKeyDown(e: KeyboardEvent): void {
  // Allow M key to toggle base camp menu even when paused
  if (e.key.toLowerCase() === "m" || e.key === "M") {
    toggleBaseCampModal();
    e.preventDefault();
    return;
  }
  
  // Handle shift for dash
  if (e.key === "Shift") {
    movementInput.dash = true;
    e.preventDefault();
    return;
  }
  
  if (fieldState?.isPaused) return;
  
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
      // Close base camp modal if open, otherwise exit field mode
      if (document.getElementById("basecamp-modal")?.style.display === "flex") {
        hideBaseCampModal();
      } else {
        exitFieldMode();
      }
      e.preventDefault();
      break;
  }
}

function handleKeyUp(e: KeyboardEvent): void {
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
  
  // Handle shift release for dash
  if (e.key === "Shift") {
    movementInput.dash = false;
  }
}

function handleInteractKey(): void {
  if (!fieldState || !currentMap || fieldState.isPaused) return;
  
  const zoneId = getOverlappingInteractionZone(fieldState.player, currentMap);
  if (!zoneId) return;
  
  const zone = getInteractionZone(currentMap, zoneId);
  if (!zone) return;
  
  // Pause field mode
  fieldState.isPaused = true;
  
  // Handle interaction
  // Note: Most interactions will open a new screen. To return to field mode,
  // those screens should call renderFieldScreen() when closed.
  handleInteraction(zone, currentMap, () => {
    // Resume field mode (for interactions that don't open a new screen)
    if (fieldState) {
      fieldState.isPaused = false;
      renderFieldScreen(fieldState.currentMap);
    }
  });
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
    
    // Check for interaction zones
    const overlappingZone = getOverlappingInteractionZone(fieldState.player, currentMap);
    if (overlappingZone) {
      const zone = getInteractionZone(currentMap, overlappingZone);
      activeInteractionPrompt = zone?.label || null;
    } else {
      activeInteractionPrompt = null;
    }
    
    // Re-render
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

function attachEventListeners(): void {
  const exitBtn = document.getElementById("fieldExitBtn");
  exitBtn?.addEventListener("click", exitFieldMode);
  
  // Use event delegation for clickable field objects (works even after re-renders)
  const fieldMap = document.querySelector(".field-map");
  if (fieldMap) {
    fieldMap.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const objEl = target.closest(".field-object[data-interaction-zone]") as HTMLElement;
      if (objEl) {
        e.stopPropagation();
        const zoneId = objEl.getAttribute("data-interaction-zone");
        if (!zoneId || !currentMap || !fieldState) return;
        
        const zone = getInteractionZone(currentMap, zoneId);
        if (!zone) return;
        
        // Pause field mode
        fieldState.isPaused = true;
        
        // Handle interaction
        handleInteraction(zone, currentMap, () => {
          // Resume field mode
          if (fieldState) {
            fieldState.isPaused = false;
            renderFieldScreen(fieldState.currentMap);
          }
        });
      }
    });
  }
  
  // Add button to open base camp menu
  const baseCampBtn = document.getElementById("fieldBaseCampBtn");
  if (baseCampBtn) {
    baseCampBtn.addEventListener("click", () => {
      toggleBaseCampModal();
    });
  }
}

function toggleBaseCampModal(): void {
  const modal = document.getElementById("basecamp-modal");
  if (modal && modal.style.display === "flex") {
    hideBaseCampModal();
  } else {
    showBaseCampModal();
  }
}

function exitFieldMode(): void {
  stopGameLoop();
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  
  // Return to Base Camp screen (full screen version)
  const { renderBaseCampScreen } = require("../ui/screens/BaseCampScreen");
  renderBaseCampScreen();
}


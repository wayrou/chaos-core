// ============================================================================
// OPERATION MAP SCREEN - Updated for Headline 14c
// Shows dungeon floors as a roguelike node-based map
// Features: Linear progression, locked rooms, unit management access, WASD pan
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { getCurrentOperation, getCurrentFloor } from "../../core/ops";
import { createTestBattleForCurrentParty } from "../../core/battle";
import { renderBattleScreen } from "./BattleScreen";
import { renderBaseCampScreen } from "./BaseCampScreen";
import { renderEventRoomScreen } from "./EventRoomScreen";
import { renderShopScreen } from "./ShopScreen";
import { renderRosterScreen } from "./RosterScreen";
import { renderFieldNodeRoomScreen } from "./FieldNodeRoomScreen";
import { GameState, RoomNode, RoomType } from "../../core/types";
import { canAdvanceToNextFloor, advanceToNextFloor, getBattleTemplate } from "../../core/procedural";
import { updateQuestProgress } from "../../quests/questManager";

// ============================================================================
// PAN STATE & CONTROLS
// ============================================================================

interface PanState {
  x: number;
  y: number;
  keysPressed: Set<string>;
}

let panState: PanState = {
  x: 0,
  y: 0,
  keysPressed: new Set(),
};

let panAnimationFrame: number | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;
let keyupHandler: ((e: KeyboardEvent) => void) | null = null;

const PAN_SPEED = 12;
const PAN_KEYS = new Set(["w", "a", "s", "d", "W", "A", "S", "D", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);
const ADVANCE_KEYS = new Set([" ", "Enter"]); // Space and Enter to advance

function cleanupPanHandlers(): void {
  if (keydownHandler) {
    window.removeEventListener("keydown", keydownHandler);
    keydownHandler = null;
  }
  if (keyupHandler) {
    window.removeEventListener("keyup", keyupHandler);
    keyupHandler = null;
  }
  if (panAnimationFrame) {
    cancelAnimationFrame(panAnimationFrame);
    panAnimationFrame = null;
  }
  panState.keysPressed.clear();
}

function setupPanHandlers(): void {
  cleanupPanHandlers();
  
  // Reset pan position
  panState = { x: 0, y: 0, keysPressed: new Set() };

  keydownHandler = (e: KeyboardEvent) => {
    // Don't handle keys if typing in an input
    if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
      return;
    }
    
    // Handle SPACE and ENTER to advance to next room
    if (ADVANCE_KEYS.has(e.key)) {
      e.preventDefault();
      advanceToNextRoom();
      return;
    }
    
    // Handle pan keys
    if (!PAN_KEYS.has(e.key)) return;
    
    e.preventDefault();
    panState.keysPressed.add(e.key.toLowerCase());
    
    if (!panAnimationFrame) {
      startPanLoop();
    }
  };

  keyupHandler = (e: KeyboardEvent) => {
    panState.keysPressed.delete(e.key.toLowerCase());
    
    // Also handle arrow keys
    const arrowToWasd: Record<string, string> = {
      "arrowup": "w",
      "arrowleft": "a", 
      "arrowdown": "s",
      "arrowright": "d",
    };
    const mapped = arrowToWasd[e.key.toLowerCase()];
    if (mapped) {
      panState.keysPressed.delete(mapped);
    }
  };

  window.addEventListener("keydown", keydownHandler);
  window.addEventListener("keyup", keyupHandler);
}

function startPanLoop(): void {
  const update = () => {
    let dx = 0;
    let dy = 0;

    if (panState.keysPressed.has("w") || panState.keysPressed.has("arrowup")) dy += PAN_SPEED;
    if (panState.keysPressed.has("s") || panState.keysPressed.has("arrowdown")) dy -= PAN_SPEED;
    if (panState.keysPressed.has("a") || panState.keysPressed.has("arrowleft")) dx += PAN_SPEED;
    if (panState.keysPressed.has("d") || panState.keysPressed.has("arrowright")) dx -= PAN_SPEED;

    if (dx !== 0 || dy !== 0) {
      panState.x += dx;
      panState.y += dy;
      
      // Apply transform to map
      const mapContainer = document.querySelector(".opmap-floor-map-full") as HTMLElement;
      if (mapContainer) {
        mapContainer.style.transform = `translate(${panState.x}px, ${panState.y}px)`;
      }
    }

    if (panState.keysPressed.size > 0) {
      panAnimationFrame = requestAnimationFrame(update);
    } else {
      panAnimationFrame = null;
    }
  };

  panAnimationFrame = requestAnimationFrame(update);
}

function resetPan(): void {
  panState.x = 0;
  panState.y = 0;
  const mapContainer = document.querySelector(".opmap-floor-map-full") as HTMLElement;
  if (mapContainer) {
    mapContainer.style.transform = `translate(0px, 0px)`;
  }
}

// Advance to the next available room via keyboard
function advanceToNextRoom(): void {
  const state = getGameState();
  const operation = getCurrentOperation(state);
  if (!operation) return;

  const floor = getCurrentFloor(operation);
  if (!floor) return;

  const nodes = floor.nodes || floor.rooms || [];
  const nextIndex = getNextAvailableRoomIndex(nodes);
  
  // Check if there's a next room to enter
  if (nextIndex >= 0 && nextIndex < nodes.length) {
    const nextRoom = nodes[nextIndex];
    if (nextRoom && !nextRoom.visited) {
      console.log("[OPMAP] Advancing to next room via keyboard:", nextRoom.id);
      enterRoom(nextRoom.id);
    }
  }
}

// ============================================================================
// MAIN RENDER
// ============================================================================

export function renderOperationMapScreen(): void {
  const root = document.getElementById("app");
  if (!root) {
    console.error("Missing #app element");
    return;
  }

  const state = getGameState();
  const operation = getCurrentOperation(state);

  if (!operation) {
    root.innerHTML = `
      <div class="opmap-root">
        <div class="opmap-card">
          <div class="opmap-header">
            <div class="opmap-title">NO ACTIVE OPERATION</div>
            <button class="opmap-back-btn">BACK TO BASE CAMP</button>
          </div>
          <div class="opmap-body">
            <p>No operation is currently active. Return to Base Camp and start a new operation.</p>
          </div>
        </div>
      </div>
    `;

    root.querySelector(".opmap-back-btn")?.addEventListener("click", () => {
      renderBaseCampScreen();
    });

    return;
  }

  const floor = getCurrentFloor(operation);
  if (!floor) {
    root.innerHTML = `<div class="error">Error: Floor not found</div>`;
    return;
  }

  const nodes = floor.nodes || floor.rooms || [];
  
  // Determine current room index for progression tracking
  const currentRoomIndex = getCurrentRoomIndex(nodes, operation.currentRoomId);
  const canAdvance = canAdvanceToNextFloor(operation);

  root.innerHTML = `
    <div class="opmap-root opmap-root--fullscreen">
      <!-- Full-screen floor map background -->
      <div class="opmap-floor-background">
        <div class="opmap-floor-map-full">
          ${renderRoguelikeMap(nodes, currentRoomIndex)}
        </div>
      </div>

      <!-- Floating control panel -->
      <div class="opmap-control-panel">
        <div class="opmap-panel-header">
          <div class="opmap-panel-title">${operation.codename}</div>
          <div class="opmap-panel-subtitle">
            FLOOR ${operation.currentFloorIndex + 1}/${operation.floors.length} · ${floor.name}
          </div>
        </div>

        <div class="opmap-panel-description">
          ${operation.description}
        </div>

        ${renderFloorProgress(nodes, currentRoomIndex)}

        <div class="opmap-panel-actions">
          <button class="opmap-units-btn" id="unitsBtn">
            👥 UNIT MANAGEMENT
          </button>
          <button class="opmap-abandon-btn" id="abandonBtn">
            ✕ ABANDON
          </button>
        </div>

        ${canAdvance ? `
          <div class="opmap-panel-advance">
            <div class="opmap-advance-text">
              ✓ Floor ${operation.currentFloorIndex + 1} Complete!
            </div>
            ${operation.currentFloorIndex < operation.floors.length - 1 ? `
              <button class="opmap-advance-btn" id="advanceFloorBtn">
                PROCEED TO FLOOR ${operation.currentFloorIndex + 2} →
              </button>
            ` : `
              <button class="opmap-complete-btn" id="completeOpBtn">
                🎉 COMPLETE OPERATION
              </button>
            `}
          </div>
        ` : ''}
      </div>

      <!-- Floor indicator on the map -->
      <div class="opmap-floor-indicator">
        <span class="opmap-floor-label">FLOOR</span>
        <span class="opmap-floor-number">${operation.currentFloorIndex + 1}</span>
        <span class="opmap-floor-total">/ ${operation.floors.length}</span>
      </div>

      <!-- Pan controls hint -->
      <div class="opmap-pan-controls">
        <div class="opmap-pan-hint">
          <span class="opmap-pan-keys">WASD</span> or <span class="opmap-pan-keys">↑←↓→</span> to pan
          · <span class="opmap-pan-keys">SPACE</span> or <span class="opmap-pan-keys">ENTER</span> to advance
        </div>
        <button class="opmap-pan-reset" id="resetPanBtn">⟲ CENTER</button>
      </div>
    </div>
  `;

  // Setup pan handlers and attach event listeners
  setupPanHandlers();
  
  // Setup document-level click handler for abandon button (event delegation fallback)
  setupAbandonButtonHandler();
  
  // Use requestAnimationFrame to ensure DOM is fully ready
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      attachEventListeners(nodes, currentRoomIndex);
    });
  });
}

// Global abandon button handler using event delegation
let abandonHandlerAttached = false;
function setupAbandonButtonHandler(): void {
  if (abandonHandlerAttached) return;
  abandonHandlerAttached = true;
  
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    // Check if click was on abandon button or its children
    const abandonBtn = target.closest("#abandonBtn");
    if (abandonBtn && document.querySelector(".opmap-root")) {
      e.stopPropagation();
      e.preventDefault();
      console.log("[OPMAP] Abandon button clicked (document delegation)!");
      
      if (confirm("Abandon this operation? Progress will be lost.")) {
        cleanupPanHandlers();
        updateGameState(prev => ({
          ...prev,
          operation: null,
          phase: "shell",
        }));
        renderBaseCampScreen();
      }
    }
  }, true); // Use capture phase
}

// ============================================================================
// ROOM INDEX TRACKING
// ============================================================================

function getCurrentRoomIndex(nodes: RoomNode[], currentRoomId: string | null): number {
  if (!currentRoomId) return -1;
  return nodes.findIndex(n => n.id === currentRoomId);
}

function getNextAvailableRoomIndex(nodes: RoomNode[]): number {
  // Find the first unvisited room
  for (let i = 0; i < nodes.length; i++) {
    if (!nodes[i].visited) {
      return i;
    }
  }
  return nodes.length; // All rooms visited
}

// ============================================================================
// ROGUELIKE MAP RENDERING
// ============================================================================

function renderRoguelikeMap(nodes: RoomNode[], currentRoomIndex: number): string {
  const nextAvailableIndex = getNextAvailableRoomIndex(nodes);
  
  let mapHtml = '<div class="opmap-nodes-container">';
  
  nodes.forEach((node, index) => {
    const isVisited = node.visited === true;
    const isCurrent = index === currentRoomIndex;
    const isNext = index === nextAvailableIndex;
    const isLocked = !isVisited && !isNext;
    
    const icon = getRoomIcon(node.type);
    const typeLabel = getRoomTypeLabel(node.type);
    
    // Status classes
    let statusClass = '';
    if (isVisited) statusClass = 'opmap-node--visited';
    else if (isCurrent) statusClass = 'opmap-node--current';
    else if (isNext) statusClass = 'opmap-node--next';
    else statusClass = 'opmap-node--locked';
    
    // Room type class
    const typeClass = `opmap-node--${node.type || 'unknown'}`;
    
    mapHtml += `
      <div class="opmap-node-wrapper">
        ${index > 0 ? '<div class="opmap-node-connector"></div>' : ''}
        <div class="opmap-node ${statusClass} ${typeClass}" 
             data-room-id="${node.id}" 
             data-room-index="${index}"
             data-is-locked="${isLocked}">
          <div class="opmap-node-icon">${icon}</div>
          <div class="opmap-node-info">
            <div class="opmap-node-label">${node.label}</div>
            <div class="opmap-node-type">${typeLabel}</div>
            ${isVisited ? '<div class="opmap-node-badge opmap-node-badge--cleared">✓ CLEARED</div>' : ''}
            ${isCurrent ? '<div class="opmap-node-badge opmap-node-badge--current">● CURRENT</div>' : ''}
            ${isNext ? '<div class="opmap-node-badge opmap-node-badge--next">→ NEXT</div>' : ''}
            ${isLocked ? '<div class="opmap-node-badge opmap-node-badge--locked">🔒 LOCKED</div>' : ''}
          </div>
          ${isNext && !isVisited ? `
            <button class="opmap-node-enter" data-room-id="${node.id}">
              ENTER →
            </button>
          ` : ''}
        </div>
      </div>
    `;
  });
  
  mapHtml += '</div>';
  return mapHtml;
}

function renderFloorProgress(nodes: RoomNode[], _currentRoomIndex: number): string {
  const totalRooms = nodes.length;
  const visitedRooms = nodes.filter(n => n.visited).length;
  const progressPercent = (visitedRooms / totalRooms) * 100;

  return `
    <div class="opmap-progress">
      <div class="opmap-progress-label">Floor Progress: ${visitedRooms}/${totalRooms} rooms cleared</div>
      <div class="opmap-progress-bar">
        <div class="opmap-progress-fill" style="width: ${progressPercent}%"></div>
      </div>
    </div>
  `;
}

// ============================================================================
// ROOM ICONS & LABELS
// ============================================================================

function getRoomIcon(type?: RoomType): string {
  switch (type) {
    case "tavern": return "🏠";
    case "battle": return "⚔️";
    case "event": return "❓";
    case "shop": return "🛒";
    case "rest": return "🛏️";
    case "boss": return "👹";
    case "field_node": return "🗺️";
    default: return "●";
  }
}

function getRoomTypeLabel(type?: RoomType): string {
  switch (type) {
    case "tavern": return "Safe Zone";
    case "battle": return "Battle";
    case "event": return "Event";
    case "shop": return "Shop";
    case "rest": return "Rest Site";
    case "boss": return "BOSS FIGHT";
    case "field_node": return "Exploration";
    default: return "Unknown";
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function attachEventListeners(_nodes: RoomNode[], _currentRoomIndex: number): void {
  const root = document.getElementById("app");
  if (!root) {
    console.error("[OPMAP] Root element not found!");
    return;
  }

  console.log("[OPMAP] Attaching event listeners...");

  // Reset pan button
  root.querySelector("#resetPanBtn")?.addEventListener("click", () => {
    resetPan();
  });

  // Abandon button - use multiple approaches to ensure it works
  const abandonBtn = root.querySelector("#abandonBtn") as HTMLButtonElement | null;
  console.log("[OPMAP] Looking for abandon button, found:", abandonBtn);
  
  if (abandonBtn) {
    console.log("[OPMAP] Attaching click handlers to abandon button");
    
    // Approach 1: Direct onclick
    abandonBtn.onclick = function(e) {
      e.stopPropagation();
      e.preventDefault();
      console.log("[OPMAP] Abandon button clicked (onclick)!");
      handleAbandon();
    };
    
    // Approach 2: addEventListener
    abandonBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      e.preventDefault();
      console.log("[OPMAP] Abandon button clicked (addEventListener)!");
      handleAbandon();
    });
    
    // Approach 3: mousedown as fallback
    abandonBtn.addEventListener("mousedown", function(e) {
      console.log("[OPMAP] Abandon button mousedown detected!");
    });
  } else {
    console.warn("[OPMAP] Abandon button NOT found in DOM!");
  }
  
  function handleAbandon() {
    if (confirm("Abandon this operation? Progress will be lost.")) {
      cleanupPanHandlers();
      updateGameState(prev => ({
        ...prev,
        operation: null,
        phase: "shell",
      }));
      renderBaseCampScreen();
    }
  }

  // Unit Management button
  root.querySelector("#unitsBtn")?.addEventListener("click", () => {
    cleanupPanHandlers();
    // Store current operation state and go to roster
    // The roster will return to operation map
    renderRosterScreen("operation" as any);
  });

  // Enter room buttons (only on next available room)
  const enterBtns = root.querySelectorAll(".opmap-node-enter");
  console.log("[OPMAP] Found", enterBtns.length, "enter buttons");
  enterBtns.forEach((btn, index) => {
    console.log("[OPMAP] Attaching click handler to enter button", index);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const button = e.currentTarget as HTMLElement;
      const roomId = button.getAttribute("data-room-id");
      console.log("[OPMAP] Enter button clicked, roomId:", roomId);
      if (roomId) {
        enterRoom(roomId);
      } else {
        console.warn("[OPMAP] Enter button clicked but no roomId found");
      }
    });
  });

  // Clicking on the node itself (for next available room)
  root.querySelectorAll(".opmap-node--next").forEach(node => {
    node.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const clickedNode = (e.currentTarget as HTMLElement).closest(".opmap-node") || e.currentTarget as HTMLElement;
      const roomId = clickedNode.getAttribute("data-room-id");
      if (roomId) {
        enterRoom(roomId);
      }
    });
  });

  // Advance floor button
  root.querySelector("#advanceFloorBtn")?.addEventListener("click", () => {
    const state = getGameState();
    if (state.operation) {
      cleanupPanHandlers();
      const { currentFloorIndex, currentRoomId } = advanceToNextFloor(state.operation);

      // Update quest progress for floor completion (Headline 15)
      updateQuestProgress("clear_node", "floor", 1);

      updateGameState(prev => ({
        ...prev,
        operation: {
          ...prev.operation!,
          currentFloorIndex,
          currentRoomId,
        },
      }));

      renderOperationMapScreen();
    }
  });

  // Complete operation button
  root.querySelector("#completeOpBtn")?.addEventListener("click", () => {
    showOperationComplete();
  });
}

// ============================================================================
// ROOM ENTRY
// ============================================================================

function enterRoom(roomId: string): void {
  const state = getGameState();
  const operation = getCurrentOperation(state);
  if (!operation) return;

  const floor = getCurrentFloor(operation);
  if (!floor) return;

  const nodes = floor.nodes || floor.rooms || [];
  const room = nodes.find(n => n.id === roomId);
  if (!room) return;

  // Check if this room is actually the next available one
  const nextIndex = getNextAvailableRoomIndex(nodes);
  const roomIndex = nodes.findIndex(n => n.id === roomId);
  
  if (roomIndex !== nextIndex) {
    console.warn("[OPMAP] Attempted to enter locked room:", roomId);
    return;
  }

  // Cleanup pan handlers before leaving screen
  cleanupPanHandlers();

  // Update current room
  updateGameState(prev => ({
    ...prev,
    operation: {
      ...prev.operation!,
      currentRoomId: roomId,
    },
  }));

  // Route to appropriate screen based on room type
  switch (room.type) {
    case "battle":
    case "boss":
      enterBattleRoom(room);
      break;

    case "event":
      if (room.eventTemplate) {
        renderEventRoomScreen(room.eventTemplate);
      } else {
        console.error("[OPMAP] Event room missing eventTemplate");
        markRoomVisited(roomId);
        renderOperationMapScreen();
      }
      break;

    case "shop":
      renderShopScreen("operation" as any);
      break;

    case "rest":
      enterRestRoom(room);
      break;

    case "tavern":
      // Safe zone, just mark as visited
      markRoomVisited(roomId);
      renderOperationMapScreen();
      break;

    case "field_node":
      // Mystery dungeon-style exploration room (Headline 14d)
      renderFieldNodeRoomScreen(roomId, room.fieldNodeSeed);
      break;

    default:
      console.warn("[OPMAP] Unknown room type:", room.type);
      markRoomVisited(roomId);
      renderOperationMapScreen();
  }
}

function enterBattleRoom(room: RoomNode): void {
  try {
    const state = getGameState();

    // Get battle template if specified
    let battleTemplate = null;
    if (room.battleTemplate) {
      battleTemplate = getBattleTemplate(room.battleTemplate);
    }

    // Create battle (using template or fallback)
    const battle = battleTemplate
      ? createBattleFromTemplate(state, battleTemplate)
      : createTestBattleForCurrentParty(state);

    if (!battle) {
      console.error("[OPMAP] Failed to create battle");
      return;
    }

    // Store battle in state
    updateGameState(prev => ({
      ...prev,
      currentBattle: battle,
      phase: "battle",
    }));

    renderBattleScreen();
  } catch (error) {
    console.error("[OPMAP] Error entering battle room:", error);
    // Return to operation map on error
    renderOperationMapScreen();
  }
}

function createBattleFromTemplate(state: GameState, template: any): any {
  // TODO: Use template to create enemies
  console.log("[BATTLE] Would create battle from template:", template.name);
  return createTestBattleForCurrentParty(state);
}

function enterRestRoom(room: RoomNode): void {
  // Heal all party members
  updateGameState(prev => {
    const updated = { ...prev };

    prev.partyUnitIds.forEach(unitId => {
      const unit = updated.unitsById[unitId];
      if (unit) {
        updated.unitsById[unitId] = {
          ...unit,
          hp: unit.maxHp,
        };
      }
    });

    return updated as GameState;
  });

  markRoomVisited(room.id);

  // Show rest result
  const root = document.getElementById("app");
  if (root) {
    root.innerHTML = `
      <div class="event-result-overlay">
        <div class="event-result-card">
          <div class="event-result-title">REST SITE</div>
          <div class="event-result-message">
            Your party rests and recovers.<br>
            All units restored to full HP.
          </div>
          <button class="event-result-continue" id="continueBtn">CONTINUE</button>
        </div>
      </div>
    `;

    root.querySelector("#continueBtn")?.addEventListener("click", () => {
      renderOperationMapScreen();
    });
  }
}

export function markRoomVisited(roomId: string): void {
  updateGameState(prev => {
    if (!prev.operation) return prev;
    
    const operation = { ...prev.operation };
    const floor = operation.floors[operation.currentFloorIndex];

    if (floor && (floor.nodes || floor.rooms)) {
      const nodes = floor.nodes || floor.rooms || [];
      const room = nodes.find(n => n.id === roomId);
      if (room) {
        room.visited = true;
      }
    }

    return {
      ...prev,
      operation,
    } as GameState;
  });
}

// Helper to mark the current room as visited (uses currentRoomId from state)
export function markCurrentRoomVisited(): void {
  const state = getGameState();
  if (state.operation?.currentRoomId) {
    markRoomVisited(state.operation.currentRoomId);
  }
}

function showOperationComplete(): void {
  const root = document.getElementById("app");
  if (!root) return;

  root.innerHTML = `
    <div class="event-result-overlay">
      <div class="event-result-card">
        <div class="event-result-title">🎉 OPERATION COMPLETE!</div>
        <div class="event-result-message">
          You have successfully completed the operation.<br>
          Returning to Base Camp...
        </div>
        <button class="event-result-continue" id="returnBtn">RETURN TO BASE CAMP</button>
      </div>
    </div>
  `;

  root.querySelector("#returnBtn")?.addEventListener("click", () => {
    // Clear operation
    updateGameState(prev => ({
      ...prev,
      operation: null,
      phase: "shell",
    }));

    renderBaseCampScreen();
  });
}

// Export alias for backwards compatibility
export const renderOperationMap = renderOperationMapScreen;

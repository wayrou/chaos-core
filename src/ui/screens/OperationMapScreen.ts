// ============================================================================
// OPERATION MAP SCREEN - Updated for Headline 14c
// Shows dungeon floors as a roguelike node-based map
// Features: Linear progression, locked rooms, unit management access, WASD pan
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { getCurrentOperation, getCurrentFloor } from "../../core/ops";
import { renderBattleScreen } from "./BattleScreen";
import { renderFieldScreen } from "../../field/FieldScreen";
import { renderEventRoomScreen } from "./EventRoomScreen";
import { renderShopScreen } from "./ShopScreen";
import { renderFieldNodeRoomScreen } from "./FieldNodeRoomScreen";
import { renderOperationSelectScreen } from "./OperationSelectScreen";
import { renderFieldModRewardScreen } from "./FieldModRewardScreen";
import { GameState, RoomNode, RoomType, OperationRun } from "../../core/types";
import { canAdvanceToNextFloor } from "../../core/procedural";
import { syncCampaignToGameState, getAvailableNodes, isNodeAccessible } from "../../core/campaignSync";
import {
  moveToNode,
  clearNode,
  prepareBattleForNode,
  completeOperationRun,
  abandonRun,
  getActiveRun,
} from "../../core/campaignManager";
import { createBattleFromEncounter } from "../../core/battleFromEncounter";
import { getKeyRoomsForFloor, FACILITY_CONFIG } from "../../core/keyRoomSystem";
// Supply chain removed for now

// ============================================================================
// FEATURE FLAG - NEW MAP UX
// ============================================================================
const FEATURE_NEW_MAP_UX = true;

// ============================================================================
// UX STATE - Node Interaction
// ============================================================================
let hoveredNodeId: string | null = null;
let selectedNodeId: string | null = null;

// ============================================================================
// PAN STATE & CONTROLS
// ============================================================================

interface PanState {
  x: number;
  y: number;
  zoom: number;
  keysPressed: Set<string>;
  shiftPressed: boolean;
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.8;
const DEFAULT_ZOOM = 1.5;
const ZOOM_SENSITIVITY = 0.1;

let panState: PanState = {
  x: 0,
  y: 0,
  zoom: DEFAULT_ZOOM,
  keysPressed: new Set(),
  shiftPressed: false,
};

let panAnimationFrame: number | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;
let keyupHandler: ((e: KeyboardEvent) => void) | null = null;
let wheelHandler: ((e: WheelEvent) => void) | null = null;
let opmapWindowMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
let opmapWindowMouseUpHandler: ((e: MouseEvent) => void) | null = null;
let opmapContextPanelFrame = {
  x: 16,
  y: 16,
  width: 360,
  height: 0,
};

const PAN_SPEED = 12;
const PAN_KEYS = new Set(["w", "a", "s", "d", "W", "A", "S", "D", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);
const ADVANCE_KEYS = new Set([" ", "Enter"]); // Space and Enter to advance

function cleanupPanHandlers(): void {
  cleanupOperationWindowHandlers();
  if (keydownHandler) {
    window.removeEventListener("keydown", keydownHandler);
    keydownHandler = null;
  }
  if (keyupHandler) {
    window.removeEventListener("keyup", keyupHandler);
    keyupHandler = null;
  }
  if (wheelHandler) {
    window.removeEventListener("wheel", wheelHandler);
    wheelHandler = null;
  }
  if (panAnimationFrame) {
    cancelAnimationFrame(panAnimationFrame);
    panAnimationFrame = null;
  }
  panState.keysPressed.clear();
  panState.shiftPressed = false;
}

function cleanupOperationWindowHandlers(): void {
  if (opmapWindowMouseMoveHandler) {
    window.removeEventListener("mousemove", opmapWindowMouseMoveHandler);
    opmapWindowMouseMoveHandler = null;
  }
  if (opmapWindowMouseUpHandler) {
    window.removeEventListener("mouseup", opmapWindowMouseUpHandler);
    opmapWindowMouseUpHandler = null;
  }
}

function clampOperationWindowFrame(frame: { x: number; y: number; width: number; height: number }): typeof opmapContextPanelFrame {
  const viewportWidth = window.innerWidth || 1280;
  const viewportHeight = window.innerHeight || 720;
  const width = Math.max(320, Math.min(frame.width || 360, viewportWidth - 16));
  const measuredHeight = frame.height > 0 ? frame.height : Math.min(640, viewportHeight - 32);
  const maxY = Math.max(8, viewportHeight - Math.min(measuredHeight, viewportHeight - 16) - 8);
  const maxX = Math.max(8, viewportWidth - width - 8);

  return {
    x: Math.min(Math.max(8, frame.x), maxX),
    y: Math.min(Math.max(8, frame.y), maxY),
    width,
    height: measuredHeight,
  };
}

function applyOperationContextPanelFrame(): void {
  const panel = document.getElementById("opmapContextPanel") as HTMLElement | null;
  if (!panel) return;

  if (!opmapContextPanelFrame.height) {
    opmapContextPanelFrame.height = panel.offsetHeight || 0;
  }

  const clamped = clampOperationWindowFrame(opmapContextPanelFrame);
  opmapContextPanelFrame = clamped;
  panel.style.left = `${clamped.x}px`;
  panel.style.top = `${clamped.y}px`;
  panel.style.width = `${clamped.width}px`;
}

function setupOperationWindowInteractions(): void {
  cleanupOperationWindowHandlers();

  const panel = document.getElementById("opmapContextPanel") as HTMLElement | null;
  const dragHandle = panel?.querySelector(".opmap-context-header") as HTMLElement | null;
  const resizeHandle = panel?.querySelector(".opmap-context-resize") as HTMLElement | null;
  if (!panel || !dragHandle || !resizeHandle) return;

  applyOperationContextPanelFrame();

  dragHandle.onmousedown = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startFrame = { ...opmapContextPanelFrame };

    opmapWindowMouseMoveHandler = (moveEvent: MouseEvent) => {
      opmapContextPanelFrame = clampOperationWindowFrame({
        ...startFrame,
        x: startFrame.x + (moveEvent.clientX - startX),
        y: startFrame.y + (moveEvent.clientY - startY),
      });
      applyOperationContextPanelFrame();
    };

    opmapWindowMouseUpHandler = () => {
      cleanupOperationWindowHandlers();
    };

    window.addEventListener("mousemove", opmapWindowMouseMoveHandler);
    window.addEventListener("mouseup", opmapWindowMouseUpHandler);
  };

  resizeHandle.onmousedown = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = opmapContextPanelFrame.width || panel.offsetWidth || 360;

    opmapWindowMouseMoveHandler = (moveEvent: MouseEvent) => {
      opmapContextPanelFrame = clampOperationWindowFrame({
        ...opmapContextPanelFrame,
        width: startWidth + (moveEvent.clientX - startX),
      });
      applyOperationContextPanelFrame();
    };

    opmapWindowMouseUpHandler = () => {
      cleanupOperationWindowHandlers();
    };

    window.addEventListener("mousemove", opmapWindowMouseMoveHandler);
    window.addEventListener("mouseup", opmapWindowMouseUpHandler);
  };
}

function setupPanHandlers(): void {
  cleanupPanHandlers();

  // Don't reset pan position here - let centerOnCurrentNode handle it
  panState.keysPressed = new Set();
  panState.shiftPressed = false;

  keydownHandler = (e: KeyboardEvent) => {
    // Don't handle keys if typing in an input
    if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
      return;
    }

    // Track shift key for speed boost
    if (e.key === "Shift" || e.key === "ShiftLeft" || e.key === "ShiftRight") {
      panState.shiftPressed = true;
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
    // Track shift key release
    if (e.key === "Shift" || e.key === "ShiftLeft" || e.key === "ShiftRight") {
      panState.shiftPressed = false;
    }

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

  wheelHandler = (e: WheelEvent) => {
    // Don't handle wheel if typing in an input
    if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
      return;
    }

    // Handle zoom with scroll wheel (no modifier needed)
    e.preventDefault();
    e.stopPropagation();

    // Calculate zoom delta
    const zoomDelta = -e.deltaY * ZOOM_SENSITIVITY * 0.01;
    const oldZoom = panState.zoom;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom + zoomDelta));

    if (oldZoom === newZoom) return; // No change

    // Adjust pan to zoom around viewport center
    const viewport = document.querySelector(".opmap-floor-background") as HTMLElement;
    const mapContainer = document.querySelector(".opmap-floor-map-full") as HTMLElement;

    if (viewport && mapContainer) {
      const viewportRect = viewport.getBoundingClientRect();
      const viewportCenterX = viewportRect.width / 2;
      const viewportCenterY = viewportRect.height / 2;

      // Calculate zoom factor
      const zoomFactor = newZoom / oldZoom;

      // Adjust pan to zoom around viewport center
      // When zooming in, we need to move the pan to keep the center point in the same place
      panState.x = viewportCenterX - (viewportCenterX - panState.x) * zoomFactor;
      panState.y = viewportCenterY - (viewportCenterY - panState.y) * zoomFactor;
    }

    panState.zoom = newZoom;
    applyMapTransform();
    updateZoomDisplay();
  };

  window.addEventListener("keydown", keydownHandler);
  window.addEventListener("keyup", keyupHandler);
  window.addEventListener("wheel", wheelHandler, { passive: false });
}

function startPanLoop(): void {
  const update = () => {
    let dx = 0;
    let dy = 0;

    // Apply speed multiplier when shift is held
    const speedMultiplier = panState.shiftPressed ? 2.5 : 1;
    const currentSpeed = PAN_SPEED * speedMultiplier;

    if (panState.keysPressed.has("w") || panState.keysPressed.has("arrowup")) dy += currentSpeed;
    if (panState.keysPressed.has("s") || panState.keysPressed.has("arrowdown")) dy -= currentSpeed;
    if (panState.keysPressed.has("a") || panState.keysPressed.has("arrowleft")) dx += currentSpeed;
    if (panState.keysPressed.has("d") || panState.keysPressed.has("arrowright")) dx -= currentSpeed;

    if (dx !== 0 || dy !== 0) {
      panState.x += dx;
      panState.y += dy;
      applyMapTransform();
    }

    if (panState.keysPressed.size > 0) {
      panAnimationFrame = requestAnimationFrame(update);
    } else {
      panAnimationFrame = null;
    }
  };

  panAnimationFrame = requestAnimationFrame(update);
}

/**
 * Apply current pan and zoom transform to map container
 */
function applyMapTransform(): void {
  const mapContainer = document.querySelector(".opmap-floor-map-full") as HTMLElement;
  if (mapContainer) {
    // Set transform origin to center for zooming around viewport center
    mapContainer.style.transformOrigin = "center center";
    mapContainer.style.transform = `translate(${panState.x}px, ${panState.y}px) scale(${panState.zoom})`;
  }
}

function resetPan(): void {
  // Reset zoom to default
  panState.zoom = DEFAULT_ZOOM;
  // Center on current node instead of (0, 0)
  centerOnCurrentNode();
}

function centerOnStartNode(): void {
  const state = getGameState();
  const operation = getCurrentOperation(state);
  if (!operation) {
    console.warn("[OPMAP] No operation found for centering");
    return;
  }

  const floor = getCurrentFloor(operation);
  if (!floor) {
    console.warn("[OPMAP] No floor found for centering");
    return;
  }

  const nodes = floor.nodes || floor.rooms || [];

  // Identify node to center on
  let targetNode: RoomNode | null = null;
  let targetNodeIndex = -1;

  if (nodes.length > 0) {
    // 1. First choice: current active node
    if (operation.currentRoomId) {
      targetNodeIndex = nodes.findIndex(n => n.id === operation.currentRoomId);
      if (targetNodeIndex >= 0) targetNode = nodes[targetNodeIndex];
    }

    // 2. Second choice: node without incoming connections (start)
    if (!targetNode) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        let hasIncoming = false;
        for (const other of nodes) {
          if (other.connections?.includes(node.id)) {
            hasIncoming = true;
            break;
          }
        }
        if (!hasIncoming) {
          targetNode = node;
          targetNodeIndex = i;
          break;
        }
      }
    }

    // 3. Fallback to first node
    if (!targetNode && nodes.length > 0) {
      targetNode = nodes[0];
      targetNodeIndex = 0;
    }
  }

  if (!targetNode || targetNodeIndex < 0) {
    // Fallback to (0, 0) if no start node found
    panState.x = 0;
    panState.y = 0;
    panState.zoom = DEFAULT_ZOOM;
    applyMapTransform();
    updateZoomDisplay();
    return;
  }

  // Wait for DOM to be ready, then find the target node element
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const targetNodeEl = document.querySelector(`.opmap-node[data-room-index="${targetNodeIndex}"]`) as HTMLElement;
      if (!targetNodeEl) {
        console.warn("[OPMAP] Target node element not found, index:", targetNodeIndex);
        return;
      }

      const mapContainer = document.querySelector(".opmap-floor-map-full") as HTMLElement;
      if (!mapContainer) {
        console.warn("[OPMAP] Map container not found");
        return;
      }

      const viewport = document.querySelector(".opmap-floor-background") as HTMLElement;
      if (!viewport) {
        console.warn("[OPMAP] Viewport not found");
        return;
      }

      // Get viewport dimensions
      const viewportRect = viewport.getBoundingClientRect();

      // Reset transform to get base positions
      mapContainer.style.transform = "translate(0px, 0px) scale(1)";
      mapContainer.style.transformOrigin = "center center";

      // Force layout recalculation
      void mapContainer.offsetHeight;

      // Get node position relative to container (at transform 0,0)
      const nodeRect = targetNodeEl.getBoundingClientRect();
      const containerRect = mapContainer.getBoundingClientRect();

      // Node center relative to container origin
      const nodeCenterXRelative = nodeRect.left - containerRect.left + nodeRect.width / 2;
      const nodeCenterYRelative = nodeRect.top - containerRect.top + nodeRect.height / 2;

      // Get container position relative to viewport
      const containerXRelative = containerRect.left - viewportRect.left;
      const containerYRelative = containerRect.top - viewportRect.top;

      // Calculate where node center would be in viewport coordinates (at transform 0,0)
      const nodeCenterInViewportX = containerXRelative + nodeCenterXRelative;
      const nodeCenterInViewportY = containerYRelative + nodeCenterYRelative;

      // Calculate transform needed to move node to viewport center
      const viewportCenterXRelative = viewportRect.width / 2;
      const viewportCenterYRelative = viewportRect.height / 2;

      const offsetX = viewportCenterXRelative - nodeCenterInViewportX;
      const offsetY = viewportCenterYRelative - nodeCenterInViewportY;

      // Update pan state
      panState.x = offsetX;
      panState.y = offsetY;
      panState.zoom = DEFAULT_ZOOM;

      // Apply transform with zoom
      applyMapTransform();
      updateZoomDisplay();
    });
  });
}

/**
 * Center the camera/viewport on the current active node (for reset button)
 */
function centerOnCurrentNode(): void {
  centerOnStartNode(); // Use start node for now
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
    if (nextRoom) {
      // Check if the room is accessible according to the campaign system
      // This allows entering event nodes and other accessible nodes even if visited
      if (isNodeAccessible(nextRoom.id)) {
        console.log("[OPMAP] Advancing to next room via keyboard:", nextRoom.id);
        enterRoom(nextRoom.id);
      } else {
        console.log("[OPMAP] Next room is not accessible:", nextRoom.id);
      }
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

  // Sync campaign state to game state
  syncCampaignToGameState();

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
      renderFieldScreen("base_camp");
    });

    return;
  }

  const floor = getCurrentFloor(operation);
  if (!floor) {
    root.innerHTML = `<div class="error">Error: Floor not found</div>`;
    return;
  }

  const nodes = floor.nodes || floor.rooms || [];

  // ------------------------------------------------------------------------
  // Hotfix: enforce battle density so the map feels combat-forward.
  // Target: >= 50% of nodes are battles (or key-room battles).
  // NOTE: Ideally this lives in the procedural generator. We patch in-place
  // here only if we haven't already patched this floor during this run.
  // ------------------------------------------------------------------------
  ensureBattleDensity(operation, nodes);

  // Determine current room index for progression tracking
  const currentRoomIndex = getCurrentRoomIndex(nodes, operation.currentRoomId);
  const canAdvance = canAdvanceToNextFloor(operation);

  root.innerHTML = `
    <div class="opmap-root opmap-root--fullscreen">
      <style>
        /* Scoped overrides for better interactivity */
        .opmap-root .opmap-node-wrapper { will-change: transform; transition: z-index 0s; }
        .opmap-root .opmap-node-wrapper:hover { z-index: 1000 !important; }
        
        /* Ensure buttons are large and clickable */
        .opmap-root .opmap-units-btn-compact,
        .opmap-root .opmap-abandon-btn-compact {
          padding: 12px 20px !important;
          font-size: 14px !important;
          letter-spacing: 0.12em !important;
          border-width: 2px !important;
        }
        
        .opmap-context-panel {
          pointer-events: auto;
        }

        /* Next floor button highlight animation */
        @keyframes pulse-glow {
          0% { box-shadow: 0 0 5px rgba(0, 255, 128, 0.5); border-color: rgba(0, 255, 128, 0.5); }
          50% { box-shadow: 0 0 20px rgba(0, 255, 128, 1); border-color: rgba(0, 255, 128, 1); }
          100% { box-shadow: 0 0 5px rgba(0, 255, 128, 0.5); border-color: rgba(0, 255, 128, 0.5); }
        }

        .opmap-root .opmap-advance-btn-compact {
          animation: pulse-glow 2s infinite;
          background: rgba(0, 80, 40, 0.8) !important;
          color: #fff !important;
        }
      </style>
      <!-- PRIMARY LAYER: The Map -->
      <div class="opmap-floor-background">
        <div class="opmap-floor-map-full">
          ${renderRoguelikeMap(nodes, currentRoomIndex, canAdvance)}
        </div>
      </div>

      <!-- SECONDARY LAYER: Context Panel (updates on hover/selection) -->
      <div class="opmap-context-panel" id="opmapContextPanel">
        <div class="opmap-context-header">
          <div class="opmap-context-title">${operation.codename}</div>
          <div class="opmap-context-subtitle">Floor ${operation.currentFloorIndex + 1}/${operation.floors.length} · ${floor.name}</div>
        </div>
        <div class="opmap-context-body" id="opmapContextBody">
          <div class="opmap-context-default">
            <div class="opmap-context-description">${operation.description}</div>
            <div class="opmap-context-hint">Hover or click a node to view details</div>
          </div>
        </div>
        ${renderKeyRoomStatus(operation.currentFloorIndex)}
        <button class="opmap-context-resize" id="opmapContextResize" type="button" aria-label="Resize operation panel"></button>
      </div>

      <!-- TERTIARY LAYER: Controls -->
      <div class="opmap-controls-compact">
        <button class="opmap-back-btn-compact" id="opmapBackBtn">← BACK</button>
        <div class="opmap-pan-controls-compact">
          <div class="opmap-pan-hint-compact">
            <span class="opmap-pan-keys">WASD</span> pan · <span class="opmap-pan-keys">SCROLL</span> zoom
          </div>
          <button class="opmap-pan-reset-compact" id="resetPanBtn">⟲ CENTER</button>
        </div>
        <div class="opmap-panel-actions-compact">
          <button class="opmap-units-btn-compact" id="opmapUnitsBtn">👥 UNITS</button>
          <button class="opmap-abandon-btn-compact" id="opmapAbandonBtn">✕ ABANDON</button>
        </div>
        ${canAdvance ? `
          <button class="opmap-advance-btn-compact" id="opmapAdvanceBtn">
            → NEXT FLOOR
          </button>
        ` : ''}
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
      setupOperationWindowInteractions();
      // Center camera on start node after DOM is ready
      centerOnStartNode();
      // Some browsers/layouts still need one extra tick for accurate bounds.
      setTimeout(centerOnStartNode, 0);
      // Update zoom display
      updateZoomDisplay();
    });
  });
}

/**
 * Update zoom display value
 */
function updateZoomDisplay(): void {
  const zoomValueEl = document.getElementById("zoomValue");
  if (zoomValueEl) {
    zoomValueEl.textContent = `${Math.round(panState.zoom * 100)}%`;
  }
}

// Global abandon button handler using event delegation
let abandonHandlerAttached = false;
function setupAbandonButtonHandler(): void {
  if (abandonHandlerAttached) return;
  abandonHandlerAttached = true;

  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    // Check if click was on abandon button or its children
    const abandonBtn = target.closest("#opmapAbandonBtn");
    if (abandonBtn && document.querySelector(".opmap-root")) {
      e.stopPropagation();
      e.preventDefault();
      console.log("[OPMAP] Abandon button clicked (document delegation)!");

      if (confirm("Abandon this operation? Progress will be lost.")) {
        cleanupPanHandlers();
        abandonRun();
        syncCampaignToGameState();
        renderFieldScreen("base_camp");
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
  // First, try to use campaign system to find accessible nodes
  try {
    const availableNodeIds = getAvailableNodes();
    if (availableNodeIds.length > 0) {
      // Find the first available node that isn't visited
      for (let i = 0; i < nodes.length; i++) {
        if (!nodes[i].visited && availableNodeIds.includes(nodes[i].id)) {
          return i;
        }
      }
      // If all available nodes are visited, still return first available for fallback
      for (let i = 0; i < nodes.length; i++) {
        if (availableNodeIds.includes(nodes[i].id)) {
          return i;
        }
      }
    }
  } catch (error) {
    console.warn("[OPMAP] Error getting available nodes from campaign system:", error);
  }

  // Fallback: Find the first unvisited room by index
  for (let i = 0; i < nodes.length; i++) {
    if (!nodes[i].visited) {
      return i;
    }
  }
  return nodes.length; // All rooms visited
}

// ---------------------------------------------------------------------------
// MAP BALANCING HOTFIX
// ---------------------------------------------------------------------------
// Enforce that at least 50% of nodes on the current floor are combats.
// This is a safety net in case the generator produces too many non-combat nodes.
function ensureBattleDensity(operation: OperationRun, nodes: RoomNode[]): void {
  try {
    const floorIndex = operation.currentFloorIndex;
    const patched = ((operation as any)._battleDensityPatchedFloors as number[] | undefined) || [];
    if (patched.includes(floorIndex)) return;

    // Compute start/end so we don't retcon those.
    const startNodeId: string | null = (() => {
      for (const node of nodes) {
        let hasIncoming = false;
        for (const other of nodes) {
          if (other.connections?.includes(node.id)) {
            hasIncoming = true;
            break;
          }
        }
        if (!hasIncoming) return node.id;
      }
      return nodes[0]?.id ?? null;
    })();
    const endNodeId: string | null = (() => {
      for (const node of nodes) {
        if ((node.connections || []).length === 0) return node.id;
      }
      let best: { id: string; layer: number } | null = null;
      for (const node of nodes) {
        const layer = node.position?.x ?? 0;
        if (!best || layer > best.layer) best = { id: node.id, layer };
      }
      return best?.id ?? null;
    })();

    const isCombat = (n: RoomNode) => n.type === "battle" || n.type === "elite" || n.type === "boss" || (n as any).isKeyRoom;
    const currentCombatCount = nodes.filter(isCombat).length;
    const targetCombatCount = Math.ceil(nodes.length * 0.5);

    if (currentCombatCount >= targetCombatCount) {
      // Mark as patched anyway so we don't re-check every render.
      updateGameState(draft => {
        if (!draft.operation) return draft;
        (draft.operation as any)._battleDensityPatchedFloors = [...patched, floorIndex];
        return draft;
      });
      return;
    }

    // Candidates: nodes that are revealed types but non-essential.
    const mutableTypes = new Set<RoomType>(["event", "treasure", "field_node", "rest", "tavern", "shop"]);
    const candidates = nodes
      .filter(n => n.id !== startNodeId && n.id !== endNodeId)
      .filter(n => !isCombat(n))
      .filter(n => mutableTypes.has((n.type as any) || "event"));

    const needed = Math.max(0, targetCombatCount - currentCombatCount);
    const toConvert = candidates.slice(0, needed).map(n => n.id);
    if (toConvert.length === 0) {
      updateGameState(draft => {
        if (!draft.operation) return draft;
        (draft.operation as any)._battleDensityPatchedFloors = [...patched, floorIndex];
        return draft;
      });
      return;
    }

    updateGameState(draft => {
      if (!draft.operation) return draft;
      const op = draft.operation;
      const fl = op.floors[op.currentFloorIndex];
      const list = (fl.nodes || fl.rooms || []) as any[];
      for (const node of list) {
        if (toConvert.includes(node.id)) {
          node.type = "battle";
          node.label = getPatchedNodeLabel("battle");
        }
      }
      (op as any)._battleDensityPatchedFloors = [...patched, floorIndex];
      return draft;
    });

    // We must also update the campaign progress so prepareBattleForNode doesn't 
    // think the node is still a non-battle and throw an error.
    try {
      import("../../core/campaign").then(({ loadCampaignProgress, saveCampaignProgress }) => {
        const progress = loadCampaignProgress();
        if (progress?.activeRun?.nodeMapByFloor[floorIndex]?.nodes) {
          const mapNodes = progress.activeRun.nodeMapByFloor[floorIndex].nodes;
          for (const node of mapNodes) {
            if (toConvert.includes(node.id)) {
              node.type = "battle";
              node.label = getPatchedNodeLabel("battle");
            }
          }
          saveCampaignProgress(progress);
        }
      });
    } catch (e) {
      console.warn("[OPMAP] Failed to patch campaign progress for battle density", e);
    }
  } catch (error) {
    console.warn("[OPMAP] ensureBattleDensity failed:", error);
  }
}

// ============================================================================
// ROGUELIKE MAP RENDERING - REBUILT FOR CORRECT PATH VISUALIZATION
// ============================================================================

/**
 * Compute the cleared route path from start to current node using BFS
 * Returns a Set of edge IDs (fromId->toId) that form the cleared route
 */
function computeClearedRoute(
  nodes: RoomNode[],
  currentRoomId: string | null,
  clearedNodeIds: string[]
): Set<string> {
  if (!currentRoomId) return new Set();

  // Build graph: nodeId -> connected node IDs
  const graph = new Map<string, string[]>();
  const nodeMap = new Map<string, RoomNode>();

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    graph.set(node.id, node.connections || []);
  }

  // Find start node (first node or node with no incoming connections)
  let startNodeId: string | null = null;
  if (nodes.length > 0) {
    startNodeId = nodes[0].id;
  }

  // Find node with no incoming connections as start
  for (const node of nodes) {
    let hasIncoming = false;
    for (const other of nodes) {
      if (other.connections?.includes(node.id)) {
        hasIncoming = true;
        break;
      }
    }
    if (!hasIncoming) {
      startNodeId = node.id;
      break;
    }
  }

  if (!startNodeId) return new Set();

  // BFS from start to current, only using cleared nodes
  const route = new Set<string>();
  const queue: Array<{ id: string; path: string[] }> = [{ id: startNodeId, path: [startNodeId] }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;

    if (id === currentRoomId) {
      // Reconstruct route from path
      for (let i = 0; i < path.length - 1; i++) {
        route.add(`${path[i]}->${path[i + 1]}`);
      }
      break;
    }

    if (visited.has(id)) continue;
    visited.add(id);

    // Only traverse cleared nodes
    if (!clearedNodeIds.includes(id) && id !== startNodeId) continue;

    const connections: string[] = graph.get(id) || [];
    for (const nextId of connections) {
      if (!visited.has(nextId) && (clearedNodeIds.includes(nextId) || nextId === currentRoomId)) {
        queue.push({ id: nextId, path: [...path, nextId] });
      }
    }
  }

  return route;
}

function renderRoguelikeMap(nodes: RoomNode[], _currentRoomIndex: number, canAdvance: boolean): string {
  const state = getGameState();
  const operation = getCurrentOperation(state);
  const currentRoomId = operation?.currentRoomId;
  const availableNodeIds = getAvailableNodes();
  const intelRevealDepth = Math.max(0, state.dispatch?.activeIntelBonus ?? 0);

  // Identify start/end nodes for icon overrides.
  const startNodeId: string | null = (() => {
    for (const node of nodes) {
      let hasIncoming = false;
      for (const other of nodes) {
        if (other.connections?.includes(node.id)) {
          hasIncoming = true;
          break;
        }
      }
      if (!hasIncoming) return node.id;
    }
    return nodes[0]?.id ?? null;
  })();

  const endNodeId: string | null = (() => {
    // Prefer node with no outgoing connections.
    for (const node of nodes) {
      const out = node.connections || [];
      if (out.length === 0) return node.id;
    }
    // Fallback: last node by progression layer.
    let best: { id: string; layer: number } | null = null;
    for (const node of nodes) {
      const layer = node.position?.x ?? 0;
      if (!best || layer > best.layer) best = { id: node.id, layer };
    }
    return best?.id ?? null;
  })();

  // Get cleared nodes from campaign system
  const activeRun = getActiveRun();
  const clearedNodeIds = activeRun?.clearedNodeIds || nodes.filter(n => n.visited).map(n => n.id);

  // Compute cleared route
  const clearedRoute = computeClearedRoute(nodes, currentRoomId || null, clearedNodeIds);

  // Determine coordinate normalization (handles negative lanes)
  const minY = Math.min(...nodes.map(n => n.position?.y ?? 0));
  const maxY = Math.max(...nodes.map(n => n.position?.y ?? 0));
  const widthInLanes = (maxY - minY) + 1;
  const mapWidth = widthInLanes * 400 + 400;  // include margin

  const minX = Math.min(...nodes.map(n => n.position?.x ?? 0));
  const maxX = Math.max(...nodes.map(n => n.position?.x ?? 0));
  const heightInLayers = (maxX - minX) + 1;
  const mapHeight = heightInLayers * 300 + 300;

  let mapHtml = `<div class="opmap-nodes-container" style="position: relative; width: ${mapWidth}px; height: ${mapHeight}px; padding: 0; margin: 0;">`;

  // Use maxLayer for flipping for bottom-to-top if needed, or just normalize
  const maxLayer = maxX;

  // Build node visibility map (fog of war)
  const revealedNodeIds = new Set<string>();
  for (const node of nodes) {
    const isCleared = clearedNodeIds.includes(node.id);
    const isCurrent = node.id === currentRoomId;
    const isAvailable = availableNodeIds.includes(node.id);

    if (isCleared || isCurrent || isAvailable) {
      revealedNodeIds.add(node.id);
      // Also reveal adjacent nodes
      if (node.connections) {
        for (const connectedId of node.connections) {
          revealedNodeIds.add(connectedId);
        }
      }
    }
  }

  for (let depth = 0; depth < intelRevealDepth; depth++) {
    const currentlyRevealed = Array.from(revealedNodeIds);
    for (const nodeId of currentlyRevealed) {
      const node = nodes.find((entry) => entry.id === nodeId);
      if (!node?.connections) continue;
      for (const connectedId of node.connections) {
        revealedNodeIds.add(connectedId);
      }
    }
  }

  // Render connections as a SINGLE SVG overlay layer.
  // This avoids sub-SVG offset math issues that can make lines appear "off to the side".
  const renderedEdges = new Set<string>();
  let connectionLines = "";

  for (const fromNode of nodes) {
    if (!fromNode.connections || !fromNode.position) continue;

    for (const toNodeId of fromNode.connections) {
      const edgeId1 = `${fromNode.id}->${toNodeId}`;
      const edgeId2 = `${toNodeId}->${fromNode.id}`;
      if (renderedEdges.has(edgeId1) || renderedEdges.has(edgeId2)) continue;
      renderedEdges.add(edgeId1);

      const toNode = nodes.find(n => n.id === toNodeId);
      if (!toNode || !toNode.position) continue;

      const fromRevealed = revealedNodeIds.has(fromNode.id);
      const toRevealed = revealedNodeIds.has(toNodeId);
      if (!fromRevealed || !toRevealed) continue;

      const isOnClearedRoute = clearedRoute.has(edgeId1) || clearedRoute.has(edgeId2);
      const isBranchChoice = fromNode.id === currentRoomId && availableNodeIds.includes(toNodeId);
      const fromCleared = clearedNodeIds.includes(fromNode.id);
      const toCleared = clearedNodeIds.includes(toNodeId);

      // Calculate positions (normalized using minY and baseLayer)
      const x1 = (fromNode.position.y - minY) * 400 + 200;
      const y1 = (maxLayer - fromNode.position.x) * 300 + 150;
      const x2 = (toNode.position.y - minY) * 400 + 200;
      const y2 = (maxLayer - toNode.position.x) * 300 + 150;

      let strokeColor: string;
      let strokeWidth: number;
      let extraClass = "";

      if (isOnClearedRoute) {
        strokeColor = "rgba(243, 163, 16, 0.8)";
        strokeWidth = 3;
        extraClass = "opmap-connection--cleared-route";
      } else if (isBranchChoice) {
        strokeColor = "rgba(235, 156, 101, 0.9)";
        strokeWidth = 3;
        extraClass = "opmap-connection--branch-choice";
      } else if (fromCleared && toCleared) {
        strokeColor = "rgba(128, 109, 78, 0.4)";
        strokeWidth = 2;
        extraClass = "opmap-connection--cleared-off-route";
      } else {
        strokeColor = "rgba(88, 81, 80, 0.3)";
        strokeWidth = 1.5;
        extraClass = "opmap-connection--unexplored";
      }

      connectionLines += `
        <line class="opmap-connection ${extraClass}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" />
      `;
    }
  }

  mapHtml += `
    <svg class="opmap-connection-layer" style="position:absolute; left:0; top:0; width:${mapWidth}px; height:${mapHeight}px; pointer-events:none; z-index:0; overflow:visible;">
      ${connectionLines}
    </svg>
  `;

  // Render nodes
  nodes.forEach((node, index) => {
    const isVisited = clearedNodeIds.includes(node.id);
    const isCurrent = node.id === currentRoomId;
    const isAvailable = availableNodeIds.includes(node.id);
    const isRevealed = revealedNodeIds.has(node.id);

    // Check if captured (for key rooms)
    const keyRoomsByFloor = activeRun?.keyRoomsByFloor || {};
    const floorKeyRooms = keyRoomsByFloor[activeRun?.floorIndex ?? 0] || [];
    const isCapturedKeyRoom = (node as any).isKeyRoom && floorKeyRooms.some(kr => kr.roomNodeId === node.id);

    const isCombatType = node.type === "battle" || node.type === "elite" || node.type === "boss";
    // Combat nodes or key rooms are completed if visited/captured
    const isCompletedNode = isVisited && (isCombatType || isCapturedKeyRoom);

    // Locked for click purposes if: unrevealed OR completed (prevents re-entering)
    const isLocked = (!isRevealed && !isCurrent && !isAvailable) || isCompletedNode;

    // Icon overrides for start/end
    const icon = getRoomIcon(node.type, {
      ...node,
      isStart: startNodeId === node.id,
      isEnd: endNodeId === node.id,
    });
    const typeLabel = getRoomTypeLabel(node.type, node);

    // Status classes
    let statusClass = '';
    if (isCurrent) statusClass = 'opmap-node--current';
    else if (isAvailable) statusClass = 'opmap-node--available';
    else if (isVisited) statusClass = 'opmap-node--visited';
    else if (isRevealed) statusClass = 'opmap-node--revealed';
    else statusClass = 'opmap-node--locked';

    if (isCompletedNode) statusClass += ' opmap-node--completed';

    // Room type class
    const typeClass = `opmap-node--${node.type || 'unknown'}`;

    // Calculate position (normalized)
    const nodeX = ((node.position?.y ?? 0) - minY) * 400 + 200;
    const nodeY = (maxLayer - (node.position?.x ?? 0)) * 300 + 150;

    // Determine node shape based on room type
    const shapeClass = getNodeShapeClass(node.type);
    const isExitNode = endNodeId === node.id;
    const showAdvancePinnedAction = isExitNode && canAdvance;

    mapHtml += `
      <div class="opmap-node-wrapper" style="position: absolute; left: ${nodeX}px; top: ${nodeY}px; transform: translate(-50%, -50%);">
        <div class="opmap-node ${statusClass} ${typeClass} ${shapeClass}"
             data-room-id="${node.id}"
             data-room-index="${index}"
             data-is-locked="${isLocked}"
             data-room-type="${node.type || 'unknown'}"
             data-room-label="${node.label || ''}"
             data-room-type-label="${typeLabel}">
          ${isRevealed ? `
            <div class="opmap-node-shape">
              <span class="opmap-node-icon-small">${icon}</span>
            </div>
            <div class="opmap-node-label-compact">${node.label}</div>
          ` : `
            <div class="opmap-node-shape opmap-node-shape--hidden">
              <span class="opmap-node-icon-small">?</span>
            </div>
            <div class="opmap-node-label-compact">???</div>
          `}
        </div>
        ${showAdvancePinnedAction ? `
          <button class="opmap-node-advance-btn" id="opmapAdvanceNodeBtn" type="button" aria-label="Advance to next floor from the exit node">
            <span class="opmap-node-advance-btn__label">NEXT FLOOR</span>
          </button>
        ` : ""}
      </div>
    `;
  });

  mapHtml += '</div>';
  return mapHtml;
}

// Floor progress removed - misleading with branching paths

/**
 * Render Key Room status summary
 */
function renderKeyRoomStatus(currentFloorIndex: number): string {
  // Show all captured key rooms from previous floors too (still accessible).
  const keyRoomsByFloor: Array<{ floorIndex: number; rooms: ReturnType<typeof getKeyRoomsForFloor> }> = [];
  for (let i = 0; i <= currentFloorIndex; i++) {
    const rooms = getKeyRoomsForFloor(i);
    if (rooms.length > 0) keyRoomsByFloor.push({ floorIndex: i, rooms });
  }

  const keyRooms = keyRoomsByFloor.flatMap(x => x.rooms);

  if (keyRooms.length === 0) {
    return "";
  }

  // Calculate total stored resources
  let totalWad = 0;
  let totalMetal = 0;
  let totalWood = 0;
  let totalShards = 0;

  for (const kr of keyRooms) {
    totalWad += kr.storedResources?.wad || 0;
    totalMetal += kr.storedResources?.metalScrap || 0;
    totalWood += kr.storedResources?.wood || 0;
    totalShards += kr.storedResources?.chaosShards || 0;
  }

  const hasUnderAttack = keyRooms.some(kr => kr.isUnderAttack);
  const hasDelayed = keyRooms.some(kr => kr.isDelayed);

  return `
    <div class="opmap-keyroom-status">
      <div class="opmap-keyroom-header">
        <span class="opmap-keyroom-icon">🔑</span>
        <span class="opmap-keyroom-title">KEY ROOMS (${keyRooms.length})</span>
        ${hasUnderAttack ? '<span class="opmap-keyroom-alert">⚠️ UNDER ATTACK</span>' : ""}
        ${hasDelayed && !hasUnderAttack ? '<span class="opmap-keyroom-delayed">⏸ DELAYED</span>' : ""}
      </div>
      <div class="opmap-keyroom-list">
        ${keyRoomsByFloor.map(group => `
          <div class="opmap-keyroom-floor-group">
            <div class="opmap-keyroom-floor-title">FLOOR ${group.floorIndex + 1}</div>
            ${group.rooms.map(kr => renderKeyRoomItem(kr, group.floorIndex)).join("")}
          </div>
        `).join("")}
      </div>
      <div class="opmap-keyroom-resources">
        <span class="opmap-keyroom-resources-label">Stored:</span>
        ${totalWad > 0 ? `<span class="opmap-resource-item">💰${totalWad}</span>` : ""}
        ${totalMetal > 0 ? `<span class="opmap-resource-item">⚙️${totalMetal}</span>` : ""}
        ${totalWood > 0 ? `<span class="opmap-resource-item">🪵${totalWood}</span>` : ""}
        ${totalShards > 0 ? `<span class="opmap-resource-item">💎${totalShards}</span>` : ""}
        ${totalWad === 0 && totalMetal === 0 && totalWood === 0 && totalShards === 0 ? '<span class="opmap-resource-empty">None yet</span>' : ""}
      </div>
    </div>
  `;
}

/**
 * Render individual key room item
 */

function renderKeyRoomItem(keyRoom: { roomNodeId: string; facility: string; isUnderAttack?: boolean; isDelayed?: boolean }, floorIndex: number): string {
  const facilityConfig = FACILITY_CONFIG[keyRoom.facility as keyof typeof FACILITY_CONFIG];
  const facilityName = facilityConfig?.name || keyRoom.facility;

  let statusIcon = "";
  let statusClass = "";

  if (keyRoom.isUnderAttack) {
    statusIcon = "⚠️";
    statusClass = "opmap-keyroom-item--attack";
  } else if (keyRoom.isDelayed) {
    statusIcon = "⏸";
    statusClass = "opmap-keyroom-item--delayed";
  }

  return `
    <div class="opmap-keyroom-item ${statusClass}">
      <div class="opmap-keyroom-item-header">
        <span class="opmap-keyroom-facility">${facilityName}</span>
        ${statusIcon ? `<span class="opmap-keyroom-status-icon">${statusIcon}</span>` : ""}
      </div>
      <div class="opmap-keyroom-item-actions">
        <button class="opmap-keyroom-btn opmap-keyroom-btn--access" data-keyroom-id="${keyRoom.roomNodeId}" data-floor-index="${floorIndex}" data-action="access">
          <span class="btn-icon">📋</span>
          <span class="btn-label">ACCESS</span>
        </button>
        <button class="opmap-keyroom-btn opmap-keyroom-btn--reinforce" data-keyroom-id="${keyRoom.roomNodeId}" data-floor-index="${floorIndex}" data-action="reinforce">
          <span class="btn-icon">🛡️</span>
          <span class="btn-label">REINFORCE</span>
        </button>
        <button class="opmap-keyroom-btn opmap-keyroom-btn--field" data-keyroom-id="${keyRoom.roomNodeId}" data-floor-index="${floorIndex}" data-action="field">
          <span class="btn-icon">🌍</span>
          <span class="btn-label">FIELD MODE</span>
        </button>
      </div>
    </div>
  `;
}

function getPatchedNodeLabel(type: RoomType): string {
  switch (type) {
    case "battle":
      return "Combat Zone";
    case "elite":
      return "Elite Encounter";
    case "boss":
      return "Boss Encounter";
    case "treasure":
      return "Treasure Cache";
    case "event":
      return "Strange Occurrence";
    case "shop":
      return "Merchant";
    case "rest":
      return "Safe Zone";
    case "tavern":
      return "Tavern";
    case "field_node":
      return "Field Exploration";
    default:
      return "Room";
  }
}

function getRoomDescription(node: RoomNode): string {
  if ((node as any).isKeyRoom) return "A vital strategic location. Capture to establish a Forward Command Post.";

  switch (node.type) {
    case "battle": return "Standard hostile engagement. Defeat all enemies to proceed.";
    case "elite": return "A dangerous encounter with improved enemy units. High risk, high reward.";
    case "boss": return "A massive threat blocking the path forward. Prepare for a final showdown.";
    case "treasure": return "A cache of valuable equipment or field modifications.";
    case "event": return "A point of interest. Something unexpected may happen.";
    case "shop": return "Trade your resources for equipment and supplies.";
    case "rest": return "A safe spot to recover HP and regroup.";
    case "tavern": return "A place to meet weary travelers and potentially recruit new allies.";
    case "field_node": return "An open area suitable for exploration and resource gathering.";
    default: return "An uncharted room in the chaos core.";
  }
}

function updateContextPanel(node: RoomNode | null, _allNodes: RoomNode[], operation: any, _floor: any): void {
  const panelBody = document.getElementById("opmapContextBody");
  if (!panelBody) return;
  const intelBonus = getGameState().dispatch?.activeIntelBonus ?? 0;

  if (!node) {
    panelBody.innerHTML = `
      <div class="opmap-context-default">
        <div class="opmap-context-description">${operation.description || "Neutralize the chaos threat."}</div>
        <div class="opmap-context-hint">Hover over a node to view its details.</div>
        ${intelBonus > 0 ? `<div class="opmap-context-hint">Dispatch intel active: +${intelBonus} reveal depth on this run.</div>` : ""}
      </div>
    `;
    return;
  }

  const statusHtml = node.visited ? '<span class="node-status-visited">VISITED</span>' : '<span class="node-status-available">AVAILABLE</span>';
  const icon = getRoomIcon(node.type, node);
  const typeLabel = getRoomTypeLabel(node.type, node);

  panelBody.innerHTML = `
    <div class="opmap-context-node">
      <div class="opmap-context-node-header">
        <div class="opmap-context-node-icon">${icon}</div>
        <div class="opmap-context-node-titles">
          <div class="opmap-context-node-label">${node.label}</div>
          <div class="opmap-context-node-type">${typeLabel} · ${statusHtml}</div>
        </div>
      </div>
      <div class="opmap-context-node-body">
        <div class="opmap-context-node-description">${getRoomDescription(node)}</div>
      </div>
    </div>
  `;
}

// ============================================================================
// ROOM ICONS & LABELS
// ============================================================================

function getRoomIcon(type?: RoomType, room?: any): string {
  // Start/end overrides (avoid using 🛏️ for both)
  if (room?.isStart) return "🚪";
  if (room?.isEnd) return "🏁";

  // Check for Key Room flag first
  if (room?.isKeyRoom) {
    return "🔑";
  }

  switch (type) {
    case "tavern": return "🏠";
    case "battle": return "⚔️";
    case "event": return "❓";
    case "shop": return "🛒";
    case "rest": return "🛏️";
    case "boss": return "👹";
    case "field_node": return "🗺️";
    case "elite": return "⭐";
    case "treasure": return "💎";
    default: return "●";
  }
}

function getRoomTypeLabel(type?: RoomType, room?: any): string {
  // Check for Key Room flag first
  if (room?.isKeyRoom) {
    return "Key Room";
  }

  switch (type) {
    case "tavern": return "Safe Zone";
    case "battle": return "Battle";
    case "event": return "Event";
    case "shop": return "Shop";
    case "rest": return "Rest Site";
    case "boss": return "BOSS FIGHT";
    case "field_node": return "Exploration";
    case "elite": return "Elite Battle";
    case "treasure": return "Treasure";
    default: return "Unknown";
  }
}

/**
 * Get shape class for node based on room type
 * Shapes communicate category: circle (battle), diamond (boss), square (shop/event), etc.
 */
function getNodeShapeClass(type?: RoomType): string {
  switch (type) {
    case "battle":
    case "elite":
      return "opmap-node-shape--circle";
    case "boss":
      return "opmap-node-shape--diamond";
    case "shop":
    case "tavern":
      return "opmap-node-shape--square";
    case "event":
    case "field_node":
      return "opmap-node-shape--hexagon";
    case "rest":
    case "treasure":
      return "opmap-node-shape--rounded-square";
    default:
      return "opmap-node-shape--circle";
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

  // Abandon button
  const abandonBtn = root.querySelector("#opmapAbandonBtn") as HTMLButtonElement | null;
  console.log("[OPMAP] Looking for abandon button, found:", abandonBtn);

  if (abandonBtn) {
    console.log("[OPMAP] Attaching click handlers to abandon button");

    // Approach 1: Direct onclick
    abandonBtn.onclick = function (e) {
      e.stopPropagation();
      e.preventDefault();
      console.log("[OPMAP] Abandon button clicked (onclick)!");
      handleAbandon();
    };

    // Approach 2: addEventListener
    abandonBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      console.log("[OPMAP] Abandon button clicked (addEventListener)!");
      handleAbandon();
    });

    // Approach 3: mousedown as fallback
    abandonBtn.addEventListener("mousedown", function () {
      console.log("[OPMAP] Abandon button mousedown detected!");
    });
  } else {
    console.warn("[OPMAP] Abandon button NOT found in DOM!");
  }

  function handleAbandon() {
    if (confirm("Abandon this operation? Progress will be lost.")) {
      cleanupPanHandlers();
      abandonRun();
      syncCampaignToGameState();
      renderOperationSelectScreen();
    }
  }

  function handleAdvanceFloor() {
    console.log("[OPMAP] Advance to next floor clicked");
    import("../../core/campaignManager").then(({ advanceToNextFloor, syncCampaignToGameState }) => {
      try {
        advanceToNextFloor();
        syncCampaignToGameState();
        renderOperationMapScreen();
      } catch (err) {
        console.error("[OPMAP] Failed to advance floor:", err);
      }
    });
  }

  // Node hover/click handlers for context panel updates and navigation
  const state = getGameState();
  const operation = getCurrentOperation(state);
  const floor = operation ? getCurrentFloor(operation) : null;
  const availableNodeIds = getAvailableNodes();

  if (operation && floor) {
    root.addEventListener("mouseenter", (e) => {
      const target = e.target as HTMLElement;
      const nodeEl = target.closest(".opmap-node") as HTMLElement;
      if (!nodeEl) return;

      const roomId = nodeEl.getAttribute("data-room-id");
      if (!roomId || !operation || !floor) return;

      const node = (floor.nodes || floor.rooms || []).find(n => n.id === roomId);
      if (node) {
        updateContextPanel(node, floor.nodes || floor.rooms || [], operation, floor);
        nodeEl.classList.add("opmap-node--hovered");
      }
    }, true);

    root.addEventListener("mouseleave", (e) => {
      const target = e.target as HTMLElement;
      const nodeEl = target.closest(".opmap-node") as HTMLElement;
      if (nodeEl) {
        nodeEl.classList.remove("opmap-node--hovered");
        // Optionally reset to default, or keep last hovered node visible
      }
    }, true);

    // Clicking on available nodes to enter
    root.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const nodeEl = target.closest(".opmap-node") as HTMLElement;
      if (!nodeEl) return;

      e.stopPropagation();
      e.preventDefault();

      const roomId = nodeEl.getAttribute("data-room-id");
      const isLocked = nodeEl.getAttribute("data-is-locked") === "true";

      if (roomId && !isLocked) {
        const isAvailable = availableNodeIds.includes(roomId);
        if (isAvailable) {
          enterRoom(roomId);
        } else {
          // Invalid action - provide feedback
          nodeEl.classList.add("opmap-node--invalid-click");
          setTimeout(() => {
            nodeEl.classList.remove("opmap-node--invalid-click");
          }, 300);
        }
      }
    }, true);
  }

  // Initialize context panel with default state
  if (operation && floor) {
    updateContextPanel(null, floor.nodes || floor.rooms || [], operation, floor);
  }

  // Complete operation button (if using old ID, handled above)
  root.querySelector("#completeOpBtn")?.addEventListener("click", () => {
    completeOperationRun();
    syncCampaignToGameState();
    import("./OperationClearScreen").then(m => m.renderOperationClearScreen());
  });

  // Key room action buttons
  root.querySelectorAll(".opmap-keyroom-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const keyRoomId = (btn as HTMLElement).getAttribute("data-keyroom-id");
      const action = (btn as HTMLElement).getAttribute("data-action");
      const floorIndexStr = (btn as HTMLElement).getAttribute("data-floor-index");
      const floorIndex = floorIndexStr ? Number(floorIndexStr) : undefined;
      if (keyRoomId && action) {
        handleKeyRoomAction(keyRoomId, action, floorIndex);
      }
    });
  });

  // Units button handling
  root.querySelector("#opmapUnitsBtn")?.addEventListener("click", () => {
    console.log("[OPMAP] Units button clicked");
    import("./RosterScreen").then(m => m.renderRosterScreen("operation"));
  });

  // Next Floor branch logic
  root.querySelector("#opmapAdvanceBtn")?.addEventListener("click", handleAdvanceFloor);
  root.querySelector("#opmapAdvanceNodeBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    handleAdvanceFloor();
  });
}

// ============================================================================
// KEY ROOM ACTIONS
// ============================================================================

function handleKeyRoomAction(keyRoomId: string, action: string, floorIndexHint?: number): void {
  const activeRun = getActiveRun();
  if (!activeRun) {
    console.warn("[OPMAP] No active run for key room action");
    return;
  }

  // Key rooms can come from previous floors; find the matching record across all floors.
  const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
  let foundFloorIndex: number | null = (typeof floorIndexHint === "number" && !Number.isNaN(floorIndexHint)) ? floorIndexHint : null;
  let keyRoom: any | undefined;

  if (foundFloorIndex !== null) {
    keyRoom = (keyRoomsByFloor[foundFloorIndex] || []).find((kr: any) => kr.roomNodeId === keyRoomId);
    if (!keyRoom) foundFloorIndex = null;
  }

  if (foundFloorIndex === null) {
    for (const [floorIdxStr, rooms] of Object.entries(keyRoomsByFloor)) {
      const floorIdx = Number(floorIdxStr);
      const found = (rooms as any[]).find(kr => kr.roomNodeId === keyRoomId);
      if (found) {
        foundFloorIndex = floorIdx;
        keyRoom = found;
        break;
      }
    }
  }

  if (!keyRoom || foundFloorIndex === null) {
    console.warn("[OPMAP] Key room not found:", keyRoomId);
    return;
  }

  switch (action) {
    case "access":
      // Show key room details/management screen
      import("./KeyRoomManagementScreen").then(m => {
        m.renderKeyRoomManagementScreen(keyRoomId);
      }).catch(() => {
        // Fallback: show alert with key room info
        const facilityConfig = FACILITY_CONFIG[keyRoom.facility as keyof typeof FACILITY_CONFIG];
        alert(`Key Room: ${facilityConfig.name}\n\n${facilityConfig.description}\n\nStored Resources:\n${Object.entries(keyRoom.storedResources || {}).map(([type, amount]) => `${type}: ${amount}`).join("\n") || "None"}`);
      });
      break;

    case "reinforce":
      // Show reinforcement/upgrade screen
      import("./KeyRoomReinforceScreen").then(m => {
        m.renderKeyRoomReinforceScreen(keyRoomId);
      }).catch(() => {
        // Fallback: show alert
        alert("Reinforcement system coming soon!");
      });
      break;

    case "field":
      // Enter field mode for this key room
      cleanupPanHandlers();
      // Create a field map ID for the key room
      const fieldMapId = `keyroom_${keyRoomId}` as any;
      // Some field-mode interaction code expects a global `map` reference.
      // Provide a best-effort shim to avoid "map is not defined" crashes.
      (window as any).map = fieldMapId;
      renderFieldScreen(fieldMapId);
      break;

    default:
      console.warn("[OPMAP] Unknown key room action:", action);
  }
}

// ============================================================================
// ROOM ENTRY
// ============================================================================

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

  // Persist to campaign progress so cleared nodes unlock next connections
  try {
    clearNode(roomId);
    syncCampaignToGameState();

    // Generate Key Room resources and check for attacks (after room cleared)
    import("../../core/keyRoomSystem").then(({ generateKeyRoomResources, applyKeyRoomPassiveEffects, rollKeyRoomAttack }) => {
      generateKeyRoomResources();
      applyKeyRoomPassiveEffects();

      // Check for attack (async, may show UI)
      const attackResult = rollKeyRoomAttack();
      if (attackResult) {
        // Show defense decision UI
        import("./DefenseDecisionScreen").then(m => {
          const activeRun = getActiveRun();
          if (activeRun?.pendingDefenseDecision) {
            m.renderDefenseDecisionScreen(
              activeRun.pendingDefenseDecision.keyRoomId,
              activeRun.pendingDefenseDecision.nodeId
            );
          }
        });
      }
    });
  } catch (error) {
    console.warn("[OPMAP] Failed to persist cleared node to campaign:", error);
  }
}



function enterRoom(roomId: string): void {


  const state = getGameState();
  const operation = getCurrentOperation(state);
  if (!operation) {
    console.warn("[OPMAP] No active operation when trying to enter room:", roomId);
    return;
  }

  const floor = getCurrentFloor(operation);
  if (!floor) {
    console.warn("[OPMAP] No current floor when trying to enter room:", roomId);
    return;
  }

  const nodes = floor.nodes || floor.rooms || [];
  const room = nodes.find(n => n.id === roomId);
  if (!room) {
    console.warn("[OPMAP] Room not found:", roomId);
    return;
  }

  // Prevent re-entering completed combat nodes (especially after victory screens).
  try {
    const activeRun = getActiveRun();
    const clearedNodeIds = activeRun?.clearedNodeIds || [];
    const isCombat = room.type === "battle" || room.type === "elite" || room.type === "boss";
    const isCapturedKeyRoom = (room as any).isKeyRoom && (activeRun?.keyRoomsByFloor?.[activeRun.floorIndex] || []).some(kr => kr.roomNodeId === room.id);

    if (isCombat && clearedNodeIds.includes(roomId) && !isCapturedKeyRoom) {
      console.log("[OPMAP] Blocking re-entry to cleared combat node:", roomId);
      renderOperationMapScreen();
      return;
    }
  } catch {
    // ignore
  }

  // Check if node is accessible (campaign system) OR if it's the next available room
  const nextIndex = getNextAvailableRoomIndex(nodes);
  const isNextRoom = nextIndex >= 0 && nextIndex < nodes.length && nodes[nextIndex].id === roomId;

  if (!isNodeAccessible(roomId) && !isNextRoom) {
    console.warn("[OPMAP] Attempted to enter inaccessible room:", roomId, {
      isAccessible: isNodeAccessible(roomId),
      isNextRoom,
      nextIndex,
      nextRoomId: nextIndex >= 0 && nextIndex < nodes.length ? nodes[nextIndex].id : null
    });
    return;
  }

  // Cleanup pan handlers before leaving screen
  cleanupPanHandlers();

  // Move to node in campaign system (must happen before entering room)
  // This updates currentNodeId but does NOT mark the node as cleared
  try {
    moveToNode(roomId);
    // Don't sync here - wait until after room is actually entered/completed
    // syncCampaignToGameState() will be called by the room's completion handler
  } catch (error) {
    console.error("[OPMAP] Failed to move to node:", error);
    // Don't return - still try to enter the room if it's accessible
    // The error might be because we're already on that node
  }

  // Route to appropriate screen based on room type
  switch (room.type) {
    case "battle":
    case "boss":
      // Check if this is a Key Room battle
      if ((room as any).isKeyRoom) {
        enterKeyRoom(room);
      } else {
        enterBattleRoom(room);
      }
      break;

    case "elite":
      // Elite battle - tougher encounter, better rewards including Field Mods
      enterEliteRoom(room);
      break;

    case "treasure":
      // Treasure room - choose 1 of 3 Field Mods
      enterTreasureRoom(room);
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
      // Safe zone - show flavor dialogue
      enterTavernRoom(room);
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
    const activeRun = getActiveRun();

    if (!activeRun) {
      console.error("[OPMAP] No active run for battle");
      return;
    }

    // Set campaign flag for battle screen
    (window as any).__isCampaignRun = true;

    // Prepare battle for this node (generates encounter)
    // Note: moveToNode was already called in enterRoom, so currentNodeId is set
    prepareBattleForNode(room.id);
    // Sync after preparing battle so battle screen has correct state
    syncCampaignToGameState();

    // Get the pending battle encounter
    const updatedRun = getActiveRun();
    if (!updatedRun || !updatedRun.pendingBattle) {
      console.error("[OPMAP] Failed to prepare battle");
      return;
    }

    const encounter = updatedRun.pendingBattle.encounterDefinition;
    const encounterSeed = updatedRun.pendingBattle.encounterSeed;

    // Create battle from encounter with seed for deterministic cover generation
    const battle = createBattleFromEncounter(state, encounter, encounterSeed);

    if (!battle) {
      console.error("[OPMAP] Failed to create battle from encounter");
      return;
    }

    // Store battle in state (add turnIndex for types.ts compatibility)
    updateGameState(prev => ({
      ...prev,
      currentBattle: { ...battle, turnIndex: 0 } as any,
      phase: "battle",
    }));

    renderBattleScreen();
  } catch (error) {
    console.error("[OPMAP] Error entering battle room:", error);
    // Return to operation map on error
    renderOperationMapScreen();
  }
}

function enterKeyRoom(room: RoomNode): void {
  try {
    const state = getGameState();
    const activeRun = getActiveRun();

    if (!activeRun) {
      console.error("[OPMAP] No active run for key room");
      return;
    }

    // Check if already captured
    const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
    const floorKeyRooms = keyRoomsByFloor[activeRun.floorIndex] || [];
    const isCaptured = floorKeyRooms.some(kr => kr.roomNodeId === room.id);

    if (isCaptured) {
      // Already captured - just mark as visited and return to map
      markRoomVisited(room.id);
      renderOperationMapScreen();
      return;
    }

    // Set campaign flag for battle screen
    (window as any).__isCampaignRun = true;
    (window as any).__isKeyRoomCapture = true;
    (window as any).__keyRoomNodeId = room.id;

    // Prepare battle for this node (generates encounter)
    prepareBattleForNode(room.id);
    syncCampaignToGameState();

    // Get the pending battle encounter
    const updatedRun = getActiveRun();
    if (!updatedRun || !updatedRun.pendingBattle) {
      console.error("[OPMAP] Failed to prepare battle for key room");
      // Return to map on error instead of getting stuck
      renderOperationMapScreen();
      return;
    }

    const encounter = updatedRun.pendingBattle.encounterDefinition;
    const encounterSeed = updatedRun.pendingBattle.encounterSeed;

    // Create battle from encounter with seed for deterministic cover generation
    const battle = createBattleFromEncounter(state, encounter, encounterSeed);

    if (!battle) {
      console.error("[OPMAP] Failed to create battle from encounter");
      // Return to map on error instead of getting stuck
      renderOperationMapScreen();
      return;
    }

    // Store battle in state (add turnIndex for types.ts compatibility)
    updateGameState(prev => ({
      ...prev,
      currentBattle: { ...battle, turnIndex: 0 } as any,
      phase: "battle",
    }));

    renderBattleScreen();
  } catch (error) {
    console.error("[OPMAP] Error entering key room:", error);
    // Return to operation map on error
    renderOperationMapScreen();
  }
}

function enterEliteRoom(room: RoomNode): void {
  try {
    const state = getGameState();
    const activeRun = getActiveRun();

    if (!activeRun) {
      console.error("[OPMAP] No active run for elite battle");
      return;
    }

    // Set campaign flag for battle screen
    (window as any).__isCampaignRun = true;
    (window as any).__isEliteBattle = true;
    (window as any).__eliteRoomId = room.id;

    // Prepare battle for this node (generates encounter)
    prepareBattleForNode(room.id);
    syncCampaignToGameState();

    // Get the pending battle encounter
    const updatedRun = getActiveRun();
    if (!updatedRun || !updatedRun.pendingBattle) {
      console.error("[OPMAP] Failed to prepare elite battle");
      renderOperationMapScreen();
      return;
    }

    const encounter = updatedRun.pendingBattle.encounterDefinition;
    const encounterSeed = updatedRun.pendingBattle.encounterSeed;

    // Create battle from encounter
    const battle = createBattleFromEncounter(state, encounter, encounterSeed);

    if (!battle) {
      console.error("[OPMAP] Failed to create elite battle");
      renderOperationMapScreen();
      return;
    }

    // Store battle in state
    updateGameState(prev => ({
      ...prev,
      currentBattle: { ...battle, turnIndex: 0 } as any,
      phase: "battle",
    }));

    renderBattleScreen();
  } catch (error) {
    console.error("[OPMAP] Error entering elite room:", error);
    renderOperationMapScreen();
  }
}

function enterTreasureRoom(room: RoomNode): void {
  try {
    const activeRun = getActiveRun();

    if (!activeRun) {
      console.error("[OPMAP] No active run for treasure room");
      return;
    }

    // Generate deterministic seed for treasure rewards
    const rewardSeed = `${activeRun.rngSeed}_treasure_${room.id}`;

    console.log("[OPMAP] Entering treasure room:", room.id);

    // Show Field Mod reward screen with treasure weights
    renderFieldModRewardScreen(room.id, rewardSeed, false);
  } catch (error) {
    console.error("[OPMAP] Error entering treasure room:", error);
    renderOperationMapScreen();
  }
}

function enterTavernRoom(room: RoomNode): void {
  // Show tavern dialogue window
  import("./TavernDialogueScreen").then(m => {
    m.renderTavernDialogueScreen(room.id, room.label, "operation");
  });
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

// Helper to mark the current room as visited (uses currentRoomId from state)
export function markCurrentRoomVisited(): void {
  const state = getGameState();
  if (state.operation?.currentRoomId) {
    markRoomVisited(state.operation.currentRoomId);
  }
}

// Export alias for backwards compatibility
export const renderOperationMap = renderOperationMapScreen;

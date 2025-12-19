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
import { renderRosterScreen } from "./RosterScreen";
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
  advanceToNextFloor as campaignAdvanceFloor,
  completeOperationRun,
  abandonRun,
  getActiveRun,
} from "../../core/campaignManager";
import { createBattleFromEncounter } from "../../core/battleFromEncounter";
import { getKeyRoomsForFloor, FACILITY_CONFIG } from "../../core/keyRoomSystem";
import * as supplyChain from "../../core/supplyChain";

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
const DEFAULT_ZOOM = 1.0;
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
    
    // Handle zoom with Ctrl/Cmd + wheel
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * ZOOM_SENSITIVITY * 0.01;
      panState.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, panState.zoom + delta));
      applyMapTransform();
    }
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
    mapContainer.style.transform = `translate(${panState.x}px, ${panState.y}px) scale(${panState.zoom})`;
    mapContainer.style.transformOrigin = "0 0";
  }
}

function resetPan(): void {
  // Reset zoom to default
  panState.zoom = DEFAULT_ZOOM;
  // Center on current node instead of (0, 0)
  centerOnCurrentNode();
}

/**
 * Center the camera/viewport on the current active node
 */
function centerOnCurrentNode(): void {
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
  const currentRoomIndex = getCurrentRoomIndex(nodes, operation.currentRoomId);
  
  console.log("[OPMAP] Centering on node, index:", currentRoomIndex, "roomId:", operation.currentRoomId);
  
  if (currentRoomIndex < 0) {
    // Fallback to (0, 0) if no current node found
    console.warn("[OPMAP] Current room index not found, resetting to origin");
    panState.x = 0;
    panState.y = 0;
    panState.zoom = DEFAULT_ZOOM;
    applyMapTransform();
    updateZoomDisplay();
    return;
  }

  // Wait for DOM to be ready, then find the current node element
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const currentNode = document.querySelector(`.opmap-node[data-room-index="${currentRoomIndex}"]`) as HTMLElement;
      if (!currentNode) {
        console.warn("[OPMAP] Current node element not found, index:", currentRoomIndex);
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
      mapContainer.style.transform = "translate(0px, 0px)";
      
      // Force layout recalculation
      void mapContainer.offsetHeight;

      // Get node position relative to container (at transform 0,0)
      const nodeRect = currentNode.getBoundingClientRect();
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
      // We want: containerXRelative + nodeCenterXRelative + offsetX = viewportCenterX - viewportRect.left
      // So: offsetX = (viewportCenterX - viewportRect.left) - (containerXRelative + nodeCenterXRelative)
      const viewportCenterXRelative = viewportRect.width / 2;
      const viewportCenterYRelative = viewportRect.height / 2;
      
      const offsetX = viewportCenterXRelative - nodeCenterInViewportX;
      const offsetY = viewportCenterYRelative - nodeCenterInViewportY;

      // Update pan state
      panState.x = offsetX;
      panState.y = offsetY;

      // Apply transform
      mapContainer.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      
      console.log("[OPMAP] Centered on node:", {
        nodeIndex: currentRoomIndex,
        nodeCenterInViewport: { x: nodeCenterInViewportX, y: nodeCenterInViewportY },
        viewportCenter: { x: viewportCenterXRelative, y: viewportCenterYRelative },
        offset: { x: offsetX, y: offsetY }
      });
    });
  });
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
          <div class="opmap-panel-header-left">
            <h1 class="opmap-panel-title">${operation.codename}</h1>
            <div class="opmap-panel-subtitle">
              SCROLLINK OS // FLOOR ${operation.currentFloorIndex + 1}/${operation.floors.length} · ${floor.name}
            </div>
          </div>
        </div>

        <div class="opmap-panel-description">
          ${operation.description}
        </div>


        ${renderKeyRoomStatus(operation.currentFloorIndex)}

        ${renderSupplyChainPanel(operation, nodes)}

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
          · <span class="opmap-pan-keys">SCROLL</span> to zoom
        </div>
        <div class="opmap-zoom-display">
          <span class="opmap-zoom-label">Zoom:</span>
          <span class="opmap-zoom-value" id="zoomValue">${Math.round(panState.zoom * 100)}%</span>
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
      // Center camera on current node after DOM is ready
      centerOnCurrentNode();
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
    const abandonBtn = target.closest("#abandonBtn");
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

function renderRoguelikeMap(nodes: RoomNode[], _currentRoomIndex: number): string {
  const state = getGameState();
  const operation = getCurrentOperation(state);
  const currentRoomId = operation?.currentRoomId;
  const availableNodeIds = getAvailableNodes();
  
  // Get cleared nodes from campaign system
  const activeRun = getActiveRun();
  const clearedNodeIds = activeRun?.clearedNodeIds || nodes.filter(n => n.visited).map(n => n.id);
  
  // Compute cleared route
  const clearedRoute = computeClearedRoute(nodes, currentRoomId || null, clearedNodeIds);
  
  // Check if supply overlay is active
  const supplyOverlayActive = (window as any).__supplyOverlayActive === true;
  
  let mapHtml = '<div class="opmap-nodes-container">';
  
  // Find max layer (x in position = progression depth) to flip for bottom-to-top
  const maxLayer = Math.max(...nodes.map(n => n.position?.x || 0));
  
  // Get supply state for overlay rendering (synchronous)
  let supplyFlowCache: Record<string, number> = {};
  let supplyEdgeState: Record<string, any> = {};
  if (supplyOverlayActive) {
    const supplyState = supplyChain.getSupplyState(state);
    if (supplyState) {
      supplyFlowCache = supplyState.flowCache || supplyChain.computeSupplyFlow(nodes, supplyState, supplyState.supplyProfile);
      supplyEdgeState = supplyState.edgeState || {};
    }
  }

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

  // Render connections ONLY from explicit graph edges (node.connections arrays)
  // Track rendered edges to avoid duplicates
  const renderedEdges = new Set<string>();
  
  for (const fromNode of nodes) {
    if (!fromNode.connections || !fromNode.position) continue;
    
    for (const toNodeId of fromNode.connections) {
      // Create edge ID to prevent duplicates (bidirectional check)
      const edgeId1 = `${fromNode.id}->${toNodeId}`;
      const edgeId2 = `${toNodeId}->${fromNode.id}`;
      if (renderedEdges.has(edgeId1) || renderedEdges.has(edgeId2)) continue;
      renderedEdges.add(edgeId1);
      
      const toNode = nodes.find(n => n.id === toNodeId);
      if (!toNode || !toNode.position) continue;
      
      // Determine edge visibility and styling
      const fromRevealed = revealedNodeIds.has(fromNode.id);
      const toRevealed = revealedNodeIds.has(toNodeId);
      const isOnClearedRoute = clearedRoute.has(edgeId1) || clearedRoute.has(edgeId2);
      const isBranchChoice = fromNode.id === currentRoomId && availableNodeIds.includes(toNodeId);
      const fromCleared = clearedNodeIds.includes(fromNode.id);
      const toCleared = clearedNodeIds.includes(toNodeId);
      
      // Only show revealed edges
      if (!fromRevealed || !toRevealed) continue;
      
      // Calculate positions
      const x1 = fromNode.position.y * 400 + 200;
      const y1 = (maxLayer - fromNode.position.x) * 300 + 150;
      const x2 = toNode.position.y * 400 + 200;
      const y2 = (maxLayer - toNode.position.x) * 300 + 150;
      
      // Determine edge styling
      const edgeId = edgeId1;
      let strokeColor: string;
      let strokeWidth: number;
      let edgeClass = "opmap-connection";
      
      if (supplyOverlayActive) {
        const flow = supplyFlowCache[edgeId] || 0;
        const edgeState = supplyEdgeState[edgeId];
        const integrity = edgeState?.integrity || 100;
        
        strokeWidth = 2 + Math.min(6, (flow / 20) * 6);
        
        if (integrity < 30) {
          strokeColor = "rgba(255, 60, 60, 0.8)";
          edgeClass += " opmap-connection--critical";
        } else if (integrity < 60) {
          strokeColor = "rgba(255, 150, 60, 0.6)";
          edgeClass += " opmap-connection--damaged";
        } else if (flow > 30) {
          strokeColor = "rgba(100, 255, 100, 0.6)";
          edgeClass += " opmap-connection--high-flow";
        } else {
          strokeColor = "rgba(255, 215, 0, 0.5)";
        }
        
        if (flow > 40) {
          edgeClass += " opmap-connection--glow";
        }
      } else {
        // Normal styling: cleared route = gold, branch choices = amber, others = muted (Ardycia colors)
        if (isOnClearedRoute) {
          strokeColor = "rgba(243, 163, 16, 0.8)"; // Gold - cleared route
          strokeWidth = 3;
          edgeClass += " opmap-connection--cleared-route";
        } else if (isBranchChoice) {
          strokeColor = "rgba(235, 156, 101, 0.9)"; // Amber - available choice
          strokeWidth = 3;
          edgeClass += " opmap-connection--branch-choice";
        } else if (fromCleared && toCleared) {
          strokeColor = "rgba(128, 109, 78, 0.4)"; // Brown - cleared but not on route
          strokeWidth = 2;
          edgeClass += " opmap-connection--cleared-off-route";
        } else {
          strokeColor = "rgba(88, 81, 80, 0.3)"; // Charcoal - known but untraveled
          strokeWidth = 1.5;
          edgeClass += " opmap-connection--unexplored";
        }
      }
      
      mapHtml += `
        <svg class="${edgeClass}" data-edge-from="${fromNode.id}" data-edge-to="${toNodeId}" style="position: absolute; left: ${Math.min(x1, x2) - 2}px; top: ${Math.min(y1, y2) - 2}px; width: ${Math.abs(x2 - x1) + 4}px; height: ${Math.abs(y2 - y1) + 4}px; pointer-events: none; z-index: 0;">
          <line x1="${x1 - Math.min(x1, x2) + 2}" y1="${y1 - Math.min(y1, y2) + 2}"
                x2="${x2 - Math.min(x1, x2) + 2}" y2="${y2 - Math.min(y1, y2) + 2}"
                stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" />
        </svg>
      `;
    }
  }

  // Render nodes
  nodes.forEach((node, index) => {
    const isVisited = clearedNodeIds.includes(node.id);
    const isCurrent = node.id === currentRoomId;
    const isAvailable = availableNodeIds.includes(node.id);
    const isRevealed = revealedNodeIds.has(node.id);
    const isLocked = !isRevealed && !isCurrent && !isAvailable;

    const icon = getRoomIcon(node.type, node);
    const typeLabel = getRoomTypeLabel(node.type, node);

    // Status classes
    let statusClass = '';
    if (isCurrent) statusClass = 'opmap-node--current';
    else if (isAvailable) statusClass = 'opmap-node--available';
    else if (isVisited) statusClass = 'opmap-node--visited';
    else if (isRevealed) statusClass = 'opmap-node--revealed';
    else statusClass = 'opmap-node--locked';

    // Room type class
    const typeClass = `opmap-node--${node.type || 'unknown'}`;

    // Calculate position
    const nodeX = (node.position?.y || 0) * 400;
    const nodeY = (maxLayer - (node.position?.x || 0)) * 300;

    mapHtml += `
      <div class="opmap-node-wrapper" style="position: absolute; left: ${nodeX}px; top: ${nodeY}px;">
        <div class="opmap-node ${statusClass} ${typeClass}"
             data-room-id="${node.id}"
             data-room-index="${index}"
             data-is-locked="${isLocked}">
          <div class="opmap-node-icon">${isRevealed ? icon : '???'}</div>
          ${isRevealed ? `
            <div class="opmap-node-info">
              <div class="opmap-node-label">${node.label}</div>
              <div class="opmap-node-type">${typeLabel}</div>
              ${isVisited ? '<div class="opmap-node-badge opmap-node-badge--cleared">✓ CLEARED</div>' : ''}
              ${isCurrent ? '<div class="opmap-node-badge opmap-node-badge--current">● CURRENT</div>' : ''}
            </div>
          ` : `
            <div class="opmap-node-info opmap-node-info--hidden">
              <div class="opmap-node-label">???</div>
            </div>
          `}
          ${isAvailable && !isVisited ? `
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

// Floor progress removed - misleading with branching paths

/**
 * Render Key Room status summary
 */
function renderKeyRoomStatus(floorIndex: number): string {
  const keyRooms = getKeyRoomsForFloor(floorIndex);

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
        ${keyRooms.map(kr => renderKeyRoomItem(kr)).join("")}
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
/**
 * Render Supply Chain Panel
 */
function renderSupplyChainPanel(_operation: OperationRun, nodes: RoomNode[]): string {
  const state = getGameState();
  const supplyState = supplyChain.getSupplyState(state);
  const supplyOverlayActive = (window as any).__supplyOverlayActive === true;
  
  // Get supply state values
  let currentProfile: string = "balanced";
  let supplyHealth: string = "stable";
  
  if (supplyState) {
    currentProfile = supplyState.supplyProfile || "balanced";
    if (supplyState.flowCache) {
      supplyHealth = supplyChain.computeSupplyHealth(supplyState.flowCache, nodes);
    }
  }
  
  return `
    <div class="opmap-supply-panel">
      <div class="opmap-supply-header">
        <span class="opmap-supply-title">SUPPLY CHAIN</span>
        <button class="opmap-supply-overlay-toggle ${supplyOverlayActive ? 'opmap-supply-overlay-toggle--active' : ''}" id="supplyOverlayToggle">
          ${supplyOverlayActive ? 'OVERLAY ON' : 'OVERLAY OFF'}
        </button>
      </div>
      <div class="opmap-supply-profile">
        <label class="opmap-supply-label">Profile:</label>
        <select class="opmap-supply-select" id="supplyProfileSelect">
          <option value="balanced" ${currentProfile === "balanced" ? "selected" : ""}>Balanced</option>
          <option value="forward_push" ${currentProfile === "forward_push" ? "selected" : ""}>Forward Push</option>
          <option value="defensive_hold" ${currentProfile === "defensive_hold" ? "selected" : ""}>Defensive Hold</option>
          <option value="consolidation" ${currentProfile === "consolidation" ? "selected" : ""}>Consolidation</option>
        </select>
      </div>
      <div class="opmap-supply-status opmap-supply-status--${supplyHealth}">
        <span class="opmap-supply-status-label">Status:</span>
        <span class="opmap-supply-status-value">${supplyHealth.toUpperCase()}</span>
      </div>
      ${supplyHealth !== "stable" ? `
        <div class="opmap-supply-warning">
          ⚠️ SUPPLY ${supplyHealth.toUpperCase()}
        </div>
      ` : ''}
    </div>
  `;
}

function renderKeyRoomItem(keyRoom: { roomNodeId: string; facility: string; isUnderAttack?: boolean; isDelayed?: boolean }): string {
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
        <button class="opmap-keyroom-btn opmap-keyroom-btn--access" data-keyroom-id="${keyRoom.roomNodeId}" data-action="access">
          <span class="btn-icon">📋</span>
          <span class="btn-label">ACCESS</span>
        </button>
        <button class="opmap-keyroom-btn opmap-keyroom-btn--reinforce" data-keyroom-id="${keyRoom.roomNodeId}" data-action="reinforce">
          <span class="btn-icon">🛡️</span>
          <span class="btn-label">REINFORCE</span>
        </button>
        <button class="opmap-keyroom-btn opmap-keyroom-btn--field" data-keyroom-id="${keyRoom.roomNodeId}" data-action="field">
          <span class="btn-icon">🌍</span>
          <span class="btn-label">FIELD MODE</span>
        </button>
      </div>
    </div>
  `;
}

// ============================================================================
// ROOM ICONS & LABELS
// ============================================================================

function getRoomIcon(type?: RoomType, room?: any): string {
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
    abandonBtn.addEventListener("mousedown", function() {
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

  // Unit Management button
  root.querySelector("#unitsBtn")?.addEventListener("click", () => {
    cleanupPanHandlers();
    // Store current operation state and go to roster
    // The roster will return to operation map
    renderRosterScreen("operation" as any);
  });

  // Enter room buttons (only on next available room)
  // Use event delegation for reliability - attach once to root
  root.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const enterBtn = target.closest(".opmap-node-enter") as HTMLElement;
    if (!enterBtn) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const roomId = enterBtn.getAttribute("data-room-id");
    console.log("[OPMAP] Enter button clicked (delegation), roomId:", roomId);
    if (roomId) {
      enterRoom(roomId);
    } else {
      console.warn("[OPMAP] Enter button clicked but no roomId found");
    }
  }, true); // Use capture phase for reliability

  // Clicking on the node itself (for next available room or any available node)
  root.querySelectorAll(".opmap-node--next, .opmap-node[data-is-locked='false']").forEach(node => {
    node.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const clickedNode = (e.currentTarget as HTMLElement).closest(".opmap-node") || e.currentTarget as HTMLElement;
      const roomId = clickedNode.getAttribute("data-room-id");
      const isLocked = clickedNode.getAttribute("data-is-locked") === "true";
      if (roomId && !isLocked) {
        enterRoom(roomId);
      }
    });
  });

  // Supply overlay toggle
  root.querySelector("#supplyOverlayToggle")?.addEventListener("click", () => {
    (window as any).__supplyOverlayActive = !(window as any).__supplyOverlayActive;
    renderOperationMapScreen(); // Re-render to update overlay
  });
  
  // Supply profile selector
  root.querySelector("#supplyProfileSelect")?.addEventListener("change", (e) => {
    const select = e.target as HTMLSelectElement;
    const newProfile = select.value as import("../../core/supplyChain").SupplyProfile;
    
    import("../../core/supplyChain").then(({ updateSupplyState, getSupplyState, computeSupplyFlow }) => {
      const state = getGameState();
      const supplyState = getSupplyState(state);
      if (!supplyState) return;
      
      const floor = getCurrentFloor(getCurrentOperation(state)!);
      if (!floor) return;
      const nodes = floor.nodes || floor.rooms || [];
      
      // Update profile and recompute flow
      updateSupplyState(state, (supply) => {
        const updated = {
          ...supply,
          supplyProfile: newProfile,
        };
        updated.flowCache = computeSupplyFlow(nodes, updated, newProfile);
        return updated;
      });
      
      // Re-render if overlay is active
      if ((window as any).__supplyOverlayActive) {
        renderOperationMapScreen();
      }
    });
  });

  // Advance floor button
  // Advance floor button is handled above in the new handler

  // Complete operation button
  root.querySelector("#completeOpBtn")?.addEventListener("click", () => {
    // Complete operation via campaign manager
    completeOperationRun();
    syncCampaignToGameState();
    // Show operation clear screen
    import("./OperationClearScreen").then(m => m.renderOperationClearScreen());
  });
  
  root.querySelector("#advanceFloorBtn")?.addEventListener("click", () => {
    try {
      campaignAdvanceFloor();
      syncCampaignToGameState();
      renderOperationMapScreen();
    } catch (error) {
      console.error("[OPMAP] Failed to advance floor:", error);
      alert(`Failed to advance floor: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  });

  // Key room action buttons
  root.querySelectorAll(".opmap-keyroom-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const keyRoomId = (btn as HTMLElement).getAttribute("data-keyroom-id");
      const action = (btn as HTMLElement).getAttribute("data-action");
      if (keyRoomId && action) {
        handleKeyRoomAction(keyRoomId, action);
      }
    });
  });
}

// ============================================================================
// KEY ROOM ACTIONS
// ============================================================================

function handleKeyRoomAction(keyRoomId: string, action: string): void {
  const activeRun = getActiveRun();
  if (!activeRun) {
    console.warn("[OPMAP] No active run for key room action");
    return;
  }

  const floorIndex = activeRun.floorIndex;
  const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
  const floorKeyRooms = keyRoomsByFloor[floorIndex] || [];
  const keyRoom = floorKeyRooms.find(kr => kr.roomNodeId === keyRoomId);

  if (!keyRoom) {
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
      renderFieldScreen(fieldMapId);
      break;

    default:
      console.warn("[OPMAP] Unknown key room action:", action);
  }
}

// ============================================================================
// ROOM ENTRY
// ============================================================================

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
    
    // Advance supply step (deterministic link attacks)
    supplyChain.advanceSupplyStep(getGameState());
    
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

// Helper to mark the current room as visited (uses currentRoomId from state)
export function markCurrentRoomVisited(): void {
  const state = getGameState();
  if (state.operation?.currentRoomId) {
    markRoomVisited(state.operation.currentRoomId);
  }
}

// Export alias for backwards compatibility
export const renderOperationMap = renderOperationMapScreen;

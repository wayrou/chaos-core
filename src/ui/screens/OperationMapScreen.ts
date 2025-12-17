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
import { GameState, RoomNode, RoomType } from "../../core/types";
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

// ============================================================================
// PAN STATE & CONTROLS
// ============================================================================

interface PanState {
  x: number;
  y: number;
  keysPressed: Set<string>;
  shiftPressed: boolean;
}

let panState: PanState = {
  x: 0,
  y: 0,
  keysPressed: new Set(),
  shiftPressed: false,
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

  window.addEventListener("keydown", keydownHandler);
  window.addEventListener("keyup", keyupHandler);
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
    const mapContainer = document.querySelector(".opmap-floor-map-full") as HTMLElement;
    if (mapContainer) {
      mapContainer.style.transform = `translate(0px, 0px)`;
    }
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
          <div class="opmap-panel-title">${operation.codename}</div>
          <div class="opmap-panel-subtitle">
            FLOOR ${operation.currentFloorIndex + 1}/${operation.floors.length} · ${floor.name}
          </div>
        </div>

        <div class="opmap-panel-description">
          ${operation.description}
        </div>

        ${renderFloorProgress(nodes, currentRoomIndex)}

        ${renderKeyRoomStatus(operation.currentFloorIndex)}

        <div class="opmap-panel-actions">
          <button class="opmap-units-btn" id="unitsBtn">
            👥 UNIT MANAGEMENT
          </button>
          <button class="opmap-controlled-rooms-btn" id="controlledRoomsBtn">
            🏰 CONTROLLED ROOMS
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

  // Use requestAnimationFrame to ensure DOM is fully ready
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      attachEventListeners(nodes, currentRoomIndex);
      // Setup resize observer for connection redrawing
      setupConnectionRedrawOnResize();
      // Draw connections after DOM is ready
      drawMapConnections();
      // Center camera on current node after DOM is ready
      centerOnCurrentNode();
    });
  });
}

// Global resize handler for redrawing connections
let resizeObserver: ResizeObserver | null = null;

function setupConnectionRedrawOnResize(): void {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  const container = document.querySelector(".opmap-nodes-container") as HTMLElement | null;
  if (!container) return;

  resizeObserver = new ResizeObserver(() => {
    // Redraw connections when container size changes
    requestAnimationFrame(() => {
      drawMapConnections();
    });
  });

  resizeObserver.observe(container);
}

// Removed global abandon button handler - now handled in attachEventListeners

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
// ROGUELIKE MAP RENDERING
// ============================================================================

/**
 * Draw path connections between nodes using SVG overlay
 * This is called after DOM is ready to ensure accurate measurements
 */
function drawMapConnections(): void {
  const connectionData = (window as any).__opmapConnectionData as Array<{
    fromNodeId: string;
    toNodeId: string;
    fromVisited: boolean;
    isAvailable: boolean;
  }>;

  if (!connectionData || connectionData.length === 0) {
    console.log("[OPMAP] No connection data to draw");
    return;
  }

  const svg = document.getElementById("opmap-connections-overlay") as SVGSVGElement | null;
  const container = document.querySelector(".opmap-nodes-container") as HTMLElement | null;

  if (!svg || !container) {
    console.warn("[OPMAP] SVG overlay or container not found");
    return;
  }

  // Clear existing paths
  svg.innerHTML = "";

  // Get container bounding rect for coordinate conversion
  const containerRect = container.getBoundingClientRect();

  // Create SVG filter for glow effect (tactical map style)
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
  filter.setAttribute("id", "opmap-path-glow");
  filter.setAttribute("x", "-50%");
  filter.setAttribute("y", "-50%");
  filter.setAttribute("width", "200%");
  filter.setAttribute("height", "200%");

  const blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
  blur.setAttribute("in", "SourceGraphic");
  blur.setAttribute("stdDeviation", "2");
  blur.setAttribute("result", "blur");

  const merge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
  const mergeNode1 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
  mergeNode1.setAttribute("in", "blur");
  const mergeNode2 = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
  mergeNode2.setAttribute("in", "SourceGraphic");

  merge.appendChild(mergeNode1);
  merge.appendChild(mergeNode2);
  filter.appendChild(blur);
  filter.appendChild(merge);
  defs.appendChild(filter);
  svg.appendChild(defs);

  // Draw each connection
  connectionData.forEach(({ fromNodeId, toNodeId, fromVisited, isAvailable }) => {
    const fromNode = document.querySelector(`.opmap-node[data-room-id="${fromNodeId}"]`) as HTMLElement | null;
    const toNode = document.querySelector(`.opmap-node[data-room-id="${toNodeId}"]`) as HTMLElement | null;

    if (!fromNode || !toNode) {
      console.warn(`[OPMAP] Node elements not found: ${fromNodeId} -> ${toNodeId}`);
      return;
    }

    // Get node positions
    const fromRect = fromNode.getBoundingClientRect();
    const toRect = toNode.getBoundingClientRect();

    // Calculate centers relative to container
    const x1 = fromRect.left - containerRect.left + fromRect.width / 2;
    const y1 = fromRect.top - containerRect.top + fromRect.height / 2;
    const x2 = toRect.left - containerRect.left + toRect.width / 2;
    const y2 = toRect.top - containerRect.top + toRect.height / 2;

    // Determine line style based on state
    let strokeColor: string;
    let strokeWidth: number;
    let strokeOpacity: number;
    let useGlow: boolean;

    if (isAvailable) {
      // Available next edges: bright + glow
      strokeColor = "rgba(255, 215, 0, 1)"; // Gold
      strokeWidth = 3;
      strokeOpacity = 0.9;
      useGlow = true;
    } else if (fromVisited) {
      // Cleared path: muted greenish
      strokeColor = "rgba(100, 255, 150, 1)"; // Greenish
      strokeWidth = 2;
      strokeOpacity = 0.4;
      useGlow = false;
    } else {
      // Normal edges: dim
      strokeColor = "rgba(150, 200, 255, 1)"; // Blue-ish
      strokeWidth = 2;
      strokeOpacity = 0.3;
      useGlow = false;
    }

    // Create path element
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1.toString());
    line.setAttribute("y1", y1.toString());
    line.setAttribute("x2", x2.toString());
    line.setAttribute("y2", y2.toString());
    line.setAttribute("stroke", strokeColor);
    line.setAttribute("stroke-width", strokeWidth.toString());
    line.setAttribute("stroke-opacity", strokeOpacity.toString());
    line.setAttribute("stroke-linecap", "round");

    if (useGlow) {
      line.setAttribute("filter", "url(#opmap-path-glow)");
    }

    svg.appendChild(line);
  });

  console.log(`[OPMAP] Drew ${connectionData.length} connections`);
}

function renderRoguelikeMap(nodes: RoomNode[], currentRoomIndex: number): string {
  const nextAvailableIndex = getNextAvailableRoomIndex(nodes);
  const availableNodeIds = getAvailableNodes();

  // Debug logging
  const state = getGameState();
  const operation = getCurrentOperation(state);
  const currentRoomId = operation?.currentRoomId;
  console.log(`[OPMAP] Rendering map: currentRoomId=${currentRoomId}, availableNodeIds=${availableNodeIds.length}`, availableNodeIds);

  let mapHtml = '<div class="opmap-nodes-container">';

  // Find max layer (x in position = progression depth) to flip for bottom-to-top
  const maxLayer = Math.max(...nodes.map(n => n.position?.x || 0));

  // SVG overlay will be added via ID for proper coordinate alignment
  mapHtml += '<svg id="opmap-connections-overlay" class="opmap-connections-overlay"></svg>';

  // Store connection data for rendering after DOM is ready
  const connections = operation?.connections || {};
  const connectionData: Array<{fromNodeId: string, toNodeId: string, fromVisited: boolean, isAvailable: boolean}> = [];

  for (const fromNodeId in connections) {
    const fromNode = nodes.find(n => n.id === fromNodeId);
    if (!fromNode || !fromNode.position) continue;

    connections[fromNodeId].forEach(toNodeId => {
      const toNode = nodes.find(n => n.id === toNodeId);
      if (!toNode || !toNode.position) return;

      // Only show connections from visited/current nodes or to available nodes
      const fromVisited = fromNode.visited || fromNode.id === currentRoomId;
      const toAvailable = availableNodeIds.includes(toNodeId) || toNode.visited;

      if (fromVisited && toAvailable) {
        connectionData.push({
          fromNodeId,
          toNodeId,
          fromVisited,
          isAvailable: availableNodeIds.includes(toNodeId) && !toNode.visited
        });
      }
    });
  }

  // Store connection data on window for post-render drawing
  (window as any).__opmapConnectionData = connectionData;

  nodes.forEach((node, index) => {
    const isVisited = node.visited === true;
    const isCurrent = index === currentRoomIndex;
    const isNext = index === nextAvailableIndex;
    // Node is available if it's in the available nodes list (forward-only branching)
    const isAvailable = availableNodeIds.includes(node.id);
    // Current room is never locked (can be re-entered), and available/next rooms are never locked
    const isLocked = !isVisited && !isNext && !isAvailable && !isCurrent;

    // Debug logging for each node
    if (isAvailable && !isVisited) {
      console.log(`[OPMAP] Node ${node.id} is available and not visited`);
    }

    const icon = getRoomIcon(node.type, node);
    const typeLabel = getRoomTypeLabel(node.type, node);

    // Hide detailed info for distant nodes (only show for visited, current, or next available)
    const showDetails = isVisited || isCurrent || isAvailable;

    // Status classes
    let statusClass = '';
    if (isVisited) statusClass = 'opmap-node--visited';
    else if (isCurrent) statusClass = 'opmap-node--current';
    else if (isNext || isAvailable) statusClass = 'opmap-node--next';
    else statusClass = 'opmap-node--locked';

    // Room type class
    const typeClass = `opmap-node--${node.type || 'unknown'}`;

    // SWAP x and y for bottom-to-top: position.x is vertical progression, position.y is horizontal branching
    // x=0 is bottom (start), x=max is top (exit)
    const nodeX = (node.position?.y || 0) * 400; // Horizontal (branches) - wider spacing
    const nodeY = (maxLayer - (node.position?.x || 0)) * 300; // Vertical (progression) - taller spacing, flipped

    mapHtml += `
      <div class="opmap-node-wrapper" style="position: absolute; left: ${nodeX}px; top: ${nodeY}px;">
        <div class="opmap-node ${statusClass} ${typeClass}"
             data-room-id="${node.id}"
             data-room-index="${index}"
             data-is-locked="${isLocked}">
          <div class="opmap-node-icon">${icon}</div>
          ${showDetails ? `
            <div class="opmap-node-info">
              <div class="opmap-node-label">${node.label}</div>
              <div class="opmap-node-type">${typeLabel}</div>
              ${isVisited ? '<div class="opmap-node-badge opmap-node-badge--cleared">✓ CLEARED</div>' : ''}
              ${isCurrent ? '<div class="opmap-node-badge opmap-node-badge--current">● CURRENT</div>' : ''}
              ${(isNext || isAvailable) && !isVisited ? '<div class="opmap-node-badge opmap-node-badge--next">→ NEXT</div>' : ''}
            </div>
          ` : `
            <div class="opmap-node-info opmap-node-info--hidden">
              <div class="opmap-node-label">???</div>
            </div>
          `}
          ${(isNext || isAvailable) && !isVisited ? `
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
      <span class="opmap-keyroom-facility">${facilityName}</span>
      ${statusIcon ? `<span class="opmap-keyroom-status-icon">${statusIcon}</span>` : ""}
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

  // All click handlers are now in the unified handler below

  // Unit Management button
  root.querySelector("#unitsBtn")?.addEventListener("click", () => {
    cleanupPanHandlers();
    // Store current operation state and go to roster
    // The roster will return to operation map
    renderRosterScreen("operation" as any);
  });

  // Controlled Rooms button (Headline 14e)
  root.querySelector("#controlledRoomsBtn")?.addEventListener("click", () => {
    cleanupPanHandlers();
    import("./ControlledRoomsWindowScreen").then(({ renderControlledRoomsWindow }) => {
      renderControlledRoomsWindow("operation_map");
    });
  });

  // Single unified click handler for all interactive elements - use event delegation
  // This handler is attached to root and uses event delegation to catch all clicks
  const clickHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target) return;
    
    console.log("[OPMAP] Click detected on:", target.tagName, target.className, target.id);
    
    // Priority 1: Abandon button (must be checked first to avoid conflicts)
    const abandonBtn = target.closest("#abandonBtn") as HTMLElement;
    if (abandonBtn) {
      e.stopPropagation();
      e.preventDefault();
      console.log("[OPMAP] Abandon button clicked!");
      
      if (confirm("Abandon this operation? Progress will be lost.")) {
        cleanupPanHandlers();
        abandonRun();
        syncCampaignToGameState();
        renderOperationSelectScreen();
      }
      return;
    }
    
    // Priority 2: Enter button
    const enterBtn = target.closest(".opmap-node-enter") as HTMLElement;
    if (enterBtn) {
      e.stopPropagation();
      e.preventDefault();

      const roomId = enterBtn.getAttribute("data-room-id");
      console.log("[OPMAP] ===== ENTER BUTTON CLICKED =====, roomId:", roomId);
      if (roomId) {
        enterRoom(roomId);
      } else {
        console.warn("[OPMAP] Enter button clicked but no roomId found");
      }
      return;
    }
    
    // Priority 3: Node click (but not if clicking on buttons or other interactive elements)
    const clickedNode = target.closest(".opmap-node") as HTMLElement;
    if (clickedNode) {
      // Don't handle if clicking on a button or other interactive element inside the node
      if (target.closest(".opmap-node-enter") ||
          target.closest("button") ||
          target.closest("#abandonBtn") ||
          target.tagName === "BUTTON") {
        console.log("[OPMAP] Click on node but inside button, ignoring");
        return;
      }

      e.stopPropagation();
      e.preventDefault();

      const roomId = clickedNode.getAttribute("data-room-id");
      const isLocked = clickedNode.getAttribute("data-is-locked") === "true";

      console.log("[OPMAP] ===== NODE CLICKED =====, roomId:", roomId, "isLocked:", isLocked);

      // Allow clicking on any unlocked node - enterRoom will validate accessibility
      if (roomId && !isLocked) {
        console.log("[OPMAP] Calling enterRoom for:", roomId);
        enterRoom(roomId);
      } else {
        console.log("[OPMAP] Node click blocked - locked or no roomId:", { roomId, isLocked });
        if (isLocked) {
          alert("This room is locked. Complete connected rooms first.");
        }
      }
    }
  };
  
  root.addEventListener("click", clickHandler, true); // Use capture phase for reliability

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
}

// ============================================================================
// ROOM ENTRY
// ============================================================================

function enterRoom(roomId: string): void {
  console.log("[OPMAP] ========== enterRoom called for roomId:", roomId, "==========");

  const state = getGameState();
  const operation = getCurrentOperation(state);
  if (!operation) {
    console.warn("[OPMAP] No active operation when trying to enter room:", roomId);
    alert("Error: No active operation found. Please start a new operation.");
    return;
  }

  const floor = getCurrentFloor(operation);
  if (!floor) {
    console.warn("[OPMAP] No current floor when trying to enter room:", roomId);
    alert("Error: No current floor found.");
    return;
  }

  const nodes = floor.nodes || floor.rooms || [];
  const room = nodes.find(n => n.id === roomId);
  if (!room) {
    console.warn("[OPMAP] Room not found:", roomId);
    alert(`Error: Room ${roomId} not found.`);
    return;
  }

  console.log("[OPMAP] Room found:", { id: room.id, type: room.type, label: room.label, visited: room.visited });

  // Check if node is accessible (campaign system) OR if it's the next available room OR if it's the current room
  const nextIndex = getNextAvailableRoomIndex(nodes);
  const isNextRoom = nextIndex >= 0 && nextIndex < nodes.length && nodes[nextIndex].id === roomId;
  const isCurrentRoom = operation.currentRoomId === roomId;
  const isAccessible = isNodeAccessible(roomId);

  console.log("[OPMAP] Room accessibility check:", {
    roomId,
    isAccessible,
    isNextRoom,
    isCurrentRoom,
    currentRoomId: operation.currentRoomId,
    nextIndex,
    nextRoomId: nextIndex >= 0 && nextIndex < nodes.length ? nodes[nextIndex].id : null
  });

  if (!isAccessible && !isNextRoom && !isCurrentRoom) {
    console.warn("[OPMAP] Attempted to enter inaccessible room:", roomId);
    alert(`Room ${room.label} is not accessible yet. Complete connected rooms first.`);
    return;
  }

  // Cleanup pan handlers before leaving screen
  cleanupPanHandlers();

  // Move to node in campaign system (must happen before entering room)
  // IMPORTANT: moveToNode only updates currentNodeId, it does NOT clear the node
  // Nodes are cleared later via clearNode() when the room is actually completed
  try {
    console.log("[OPMAP] Calling moveToNode for:", roomId);
    moveToNode(roomId);
    syncCampaignToGameState();
    console.log("[OPMAP] Successfully moved to node:", roomId);
  } catch (error) {
    console.error("[OPMAP] Failed to move to node:", error);
    alert(`Failed to move to room: ${error instanceof Error ? error.message : "Unknown error"}`);
    // Don't return - still try to enter the room if it's accessible
    // The error might be because we're already on that node
  }

  console.log("[OPMAP] Routing to room type:", room.type, "for room:", room.id);
  
  // Route to appropriate screen based on room type
  switch (room.type) {
    case "battle":
    case "boss":
      // Check if this is a Key Room battle
      if ((room as any).isKeyRoom) {
        console.log("[OPMAP] Entering key room battle:", room.id);
        enterKeyRoom(room);
      } else {
        console.log("[OPMAP] Entering normal battle:", room.id);
        enterBattleRoom(room);
      }
      break;

    case "elite":
      // Elite battle - tougher encounter, better rewards including Field Mods
      console.log("[OPMAP] Entering elite battle:", room.id);
      enterEliteRoom(room);
      break;

    case "treasure":
      // Treasure room - choose 1 of 3 Field Mods
      console.log("[OPMAP] Entering treasure room:", room.id);
      enterTreasureRoom(room);
      break;

    case "event":
      console.log("[OPMAP] Entering event room:", room.id);
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
      renderOperationMapScreen();
      return;
    }

    // Set campaign flag for battle screen
    (window as any).__isCampaignRun = true;

    // Prepare battle for this node (generates encounter)
    prepareBattleForNode(room.id);
    syncCampaignToGameState();
    
    // Get the pending battle encounter
    const updatedRun = getActiveRun();
    if (!updatedRun || !updatedRun.pendingBattle) {
      console.error("[OPMAP] Failed to prepare battle");
      renderOperationMapScreen();
      return;
    }
    
    const encounter = updatedRun.pendingBattle.encounterDefinition;
    const encounterSeed = updatedRun.pendingBattle.encounterSeed;
    
    // Create battle from encounter with seed for deterministic cover generation
    const battle = createBattleFromEncounter(state, encounter, encounterSeed);

    if (!battle) {
      console.error("[OPMAP] Failed to create battle from encounter");
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
      renderOperationMapScreen();
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
      renderOperationMapScreen();
      return;
    }

    // Set campaign flag for battle screen
    (window as any).__isCampaignRun = true;
    (window as any).__isEliteBattle = true;
    (window as any).__eliteRoomId = room.id;

    // Prepare battle for this node (generates encounter)
    // Note: prepareBattleForNode now accepts "elite" nodes
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
      renderOperationMapScreen();
      return;
    }

    // Generate deterministic seed for treasure rewards
    const rewardSeed = `${activeRun.runSeed}_treasure_${room.id}`;

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

// ============================================================================
// OPERATION MAP SCREEN - Updated for Headline 13
// Shows dungeon floors, procedural rooms, navigation
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { getCurrentOperation, getCurrentFloor, getCurrentRoom } from "../../core/ops";
import { createTestBattleForCurrentParty } from "../../core/battle";
import { renderBattleScreen } from "./BattleScreen";
import { renderBaseCampScreen } from "./BaseCampScreen";
import { renderEventRoomScreen } from "./EventRoomScreen";
import { renderShopScreen } from "./ShopScreen";
import { GameState, RoomNode, RoomType } from "../../core/types";
import { canAdvanceToNextFloor, advanceToNextFloor, getBattleTemplate } from "../../core/procedural";

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
  const currentRoom = getCurrentRoom(operation);

  root.innerHTML = `
    <div class="opmap-root">
      <div class="opmap-card">
        <div class="opmap-header">
          <div>
            <div class="opmap-title">OPERATION: ${operation.codename}</div>
            <div class="opmap-subtitle">
              FLOOR ${operation.currentFloorIndex + 1}/${operation.floors.length} · ${floor.name}
            </div>
          </div>
          <div class="opmap-header-actions">
            <button class="opmap-back-btn">← BACK TO BASE CAMP</button>
          </div>
        </div>

        <div class="opmap-body">
          <div class="opmap-description">
            ${operation.description}
          </div>

          ${renderFloorProgress(nodes, operation.currentRoomId)}

          <div class="opmap-rooms">
            ${nodes.map(node => renderRoomNode(node, operation.currentRoomId)).join('')}
          </div>

          ${canAdvanceToNextFloor(operation) ? `
            <div class="opmap-floor-advance">
              <div class="opmap-floor-advance-text">
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
      </div>
    </div>
  `;

  // Attach event listeners
  attachEventListeners(nodes);
}

function renderFloorProgress(nodes: RoomNode[], currentRoomId: string | null): string {
  const totalRooms = nodes.length;
  const visitedRooms = nodes.filter(n => n.visited || n.id === currentRoomId).length;
  const progressPercent = (visitedRooms / totalRooms) * 100;

  return `
    <div class="opmap-progress">
      <div class="opmap-progress-label">Floor Progress: ${visitedRooms}/${totalRooms} rooms</div>
      <div class="opmap-progress-bar">
        <div class="opmap-progress-fill" style="width: ${progressPercent}%"></div>
      </div>
    </div>
  `;
}

function renderRoomNode(node: RoomNode, currentRoomId: string | null): string {
  const isCurrent = node.id === currentRoomId;
  const isVisited = node.visited;
  const isAvailable = canEnterRoom(node, currentRoomId);

  const icon = getRoomIcon(node.type);
  const typeLabel = getRoomTypeLabel(node.type);

  return `
    <div class="opmap-room ${isCurrent ? 'opmap-room--current' : ''} ${isVisited ? 'opmap-room--visited' : ''} ${isAvailable ? 'opmap-room--available' : 'opmap-room--locked'}"
         data-room-id="${node.id}">
      <div class="opmap-room-icon">${icon}</div>
      <div class="opmap-room-content">
        <div class="opmap-room-label">${node.label}</div>
        <div class="opmap-room-type">${typeLabel}</div>
        ${isCurrent ? '<div class="opmap-room-current-badge">● CURRENT</div>' : ''}
        ${isVisited && !isCurrent ? '<div class="opmap-room-visited-badge">✓ Cleared</div>' : ''}
      </div>
      ${isAvailable && !isCurrent && !isVisited ? `
        <button class="opmap-room-enter-btn" data-room-id="${node.id}">
          ENTER →
        </button>
      ` : ''}
    </div>
  `;
}

function canEnterRoom(node: RoomNode, currentRoomId: string | null): boolean {
  // First room is always available
  if (!currentRoomId) return true;

  // Can only enter rooms connected to current room
  // For now, linear progression - can enter next room if current room is visited
  return node.visited === false || node.visited === undefined;
}

function getRoomIcon(type?: RoomType): string {
  switch (type) {
    case "tavern": return "🏠";
    case "battle": return "⚔️";
    case "event": return "❓";
    case "shop": return "🛒";
    case "rest": return "🛏️";
    case "boss": return "👹";
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
    default: return "Unknown";
  }
}

function attachEventListeners(nodes: RoomNode[]): void {
  const root = document.getElementById("app");
  if (!root) return;

  // Back button
  root.querySelector(".opmap-back-btn")?.addEventListener("click", () => {
    renderBaseCampScreen();
  });

  // Enter room buttons
  root.querySelectorAll(".opmap-room-enter-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const roomId = (e.target as HTMLElement).getAttribute("data-room-id");
      if (roomId) {
        enterRoom(roomId);
      }
    });
  });

  // Advance floor button
  root.querySelector("#advanceFloorBtn")?.addEventListener("click", () => {
    const state = getGameState();
    if (state.operation) {
      const { currentFloorIndex, currentRoomId } = advanceToNextFloor(state.operation);

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

function enterRoom(roomId: string): void {
  const state = getGameState();
  const operation = getCurrentOperation(state);
  if (!operation) return;

  const floor = getCurrentFloor(operation);
  if (!floor) return;

  const nodes = floor.nodes || floor.rooms || [];
  const room = nodes.find(n => n.id === roomId);
  if (!room) return;

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
        renderOperationMapScreen();
      }
      break;

    case "shop":
      renderShopScreen();
      break;

    case "rest":
      enterRestRoom(room);
      break;

    case "tavern":
      // Safe zone, just mark as visited
      markRoomVisited(roomId);
      renderOperationMapScreen();
      break;

    default:
      console.warn("[OPMAP] Unknown room type:", room.type);
      renderOperationMapScreen();
  }
}

function enterBattleRoom(room: RoomNode): void {
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

  // Store battle in state
  updateGameState(prev => ({
    ...prev,
    currentBattle: battle,
    phase: "battle",
  }));

  renderBattleScreen();
}

function createBattleFromTemplate(state: GameState, template: any): any {
  // TODO: Use template to create enemies
  // For now, use test battle
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

function markRoomVisited(roomId: string): void {
  updateGameState(prev => {
    const operation = { ...prev.operation! };
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

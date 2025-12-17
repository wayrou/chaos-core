// ============================================================================
// CONTROLLED ROOMS WINDOW SCREEN (Headline 14e)
// Management window for controlled rooms across all floors
// ============================================================================

import {
  getAllControlledRooms,
  getControlledRoom,
  getControlledRoomBenefitMultiplier,
  abandonControlledRoom,
  reduceThreat,
  CONTROLLED_ROOM_CONFIG,
} from "../../core/controlledRoomsSystem";
import { getActiveRun } from "../../core/campaignManager";
import { loadCampaignProgress, saveCampaignProgress } from "../../core/campaign";
import { renderOperationMapScreen } from "./OperationMapScreen";

/**
 * Render Controlled Rooms Window
 * @param returnScreen - Screen to return to when closing ("operation_map")
 */
export function renderControlledRoomsWindow(returnScreen: string = "operation_map"): void {
  const root = document.getElementById("app");
  if (!root) {
    console.error("[CONTROLLEDROOMS] Missing #app element");
    return;
  }

  const activeRun = getActiveRun();
  if (!activeRun) {
    console.error("[CONTROLLEDROOMS] No active run");
    return;
  }

  const currentFloorIndex = activeRun.floorIndex;
  const allRooms = getAllControlledRooms();

  // Group rooms by floor
  const roomsByFloor: Record<number, typeof allRooms> = {};
  for (const room of allRooms) {
    if (!roomsByFloor[room.floorIndex]) {
      roomsByFloor[room.floorIndex] = [];
    }
    roomsByFloor[room.floorIndex].push(room);
  }

  // Sort floor indices
  const floorIndices = Object.keys(roomsByFloor).map(Number).sort((a, b) => a - b);

  root.innerHTML = `
    <div class="controlled-rooms-window">
      <div class="controlled-rooms-panel">
        <!-- Header -->
        <div class="controlled-rooms-header">
          <div class="controlled-rooms-title">CONTROLLED ROOMS</div>
          <div class="controlled-rooms-subtitle">Operation-wide asset management</div>
          <button class="controlled-rooms-close" id="closeBtn">✕ CLOSE</button>
        </div>

        <!-- Summary Bar -->
        <div class="controlled-rooms-summary">
          <div class="controlled-rooms-summary-item">
            <span class="controlled-rooms-summary-label">Total Rooms:</span>
            <span class="controlled-rooms-summary-value">${allRooms.length}</span>
          </div>
          <div class="controlled-rooms-summary-item">
            <span class="controlled-rooms-summary-label">Current Floor:</span>
            <span class="controlled-rooms-summary-value">Floor ${currentFloorIndex + 1}</span>
          </div>
          <div class="controlled-rooms-summary-item">
            <span class="controlled-rooms-summary-label">Time Step:</span>
            <span class="controlled-rooms-summary-value">${activeRun.opTimeStep || 0}</span>
          </div>
        </div>

        ${allRooms.length === 0 ? renderEmptyState() : renderRoomList(roomsByFloor, floorIndices, currentFloorIndex)}
      </div>
    </div>
  `;

  attachEventListeners(returnScreen);
}

/**
 * Render empty state (no controlled rooms)
 */
function renderEmptyState(): string {
  return `
    <div class="controlled-rooms-empty">
      <div class="controlled-rooms-empty-icon">🏚️</div>
      <div class="controlled-rooms-empty-title">NO CONTROLLED ROOMS</div>
      <div class="controlled-rooms-empty-message">
        Capture Key Rooms during operations to establish persistent control.
        Controlled rooms provide benefits across floors within this operation.
      </div>
    </div>
  `;
}

/**
 * Render room list grouped by floor
 */
function renderRoomList(
  roomsByFloor: Record<number, ReturnType<typeof getAllControlledRooms>>,
  floorIndices: number[],
  currentFloorIndex: number
): string {
  return `
    <div class="controlled-rooms-list">
      ${floorIndices.map(floorIndex => renderFloorSection(roomsByFloor[floorIndex], floorIndex, currentFloorIndex)).join("")}
    </div>
  `;
}

/**
 * Render floor section with rooms
 */
function renderFloorSection(
  rooms: ReturnType<typeof getAllControlledRooms>,
  floorIndex: number,
  currentFloorIndex: number
): string {
  const isCurrentFloor = floorIndex === currentFloorIndex;
  const floorDistance = Math.abs(floorIndex - currentFloorIndex);
  const benefitMultiplier = getControlledRoomBenefitMultiplier(floorIndex, currentFloorIndex);

  return `
    <div class="controlled-rooms-floor-section ${isCurrentFloor ? "controlled-rooms-floor-section--current" : ""}">
      <div class="controlled-rooms-floor-header">
        <span class="controlled-rooms-floor-title">
          FLOOR ${floorIndex + 1}
          ${isCurrentFloor ? '<span class="controlled-rooms-floor-badge">CURRENT</span>' : ""}
        </span>
        <span class="controlled-rooms-floor-distance">
          ${floorDistance === 0 ? "100% Benefits" : floorDistance === 1 ? "85% Benefits" : floorDistance === 2 ? "70% Benefits" : "No Benefits"}
        </span>
      </div>
      <div class="controlled-rooms-floor-rooms">
        ${rooms.map(room => renderRoomCard(room, benefitMultiplier, isCurrentFloor)).join("")}
      </div>
    </div>
  `;
}

/**
 * Render individual room card
 */
function renderRoomCard(
  room: ReturnType<typeof getAllControlledRooms>[0],
  benefitMultiplier: number,
  isCurrentFloor: boolean
): string {
  const config = CONTROLLED_ROOM_CONFIG[room.roomType];
  const statusClass = getStatusClass(room.status);
  const threatClass = getThreatClass(room.threatLevel);
  const fortIcon = getFortificationIcon(room.fortificationLevel);

  return `
    <div class="controlled-room-card ${statusClass}" data-node-id="${room.nodeId}">
      <div class="controlled-room-card-header">
        <div class="controlled-room-card-title">${config.name}</div>
        <div class="controlled-room-card-status">${room.status.toUpperCase()}</div>
      </div>

      <div class="controlled-room-card-stats">
        <div class="controlled-room-card-stat">
          <span class="controlled-room-card-stat-label">Threat:</span>
          <span class="controlled-room-card-stat-value ${threatClass}">${room.threatLevel}/100</span>
        </div>
        <div class="controlled-room-card-stat">
          <span class="controlled-room-card-stat-label">Fort:</span>
          <span class="controlled-room-card-stat-value">${fortIcon} Level ${room.fortificationLevel}</span>
        </div>
        <div class="controlled-room-card-stat">
          <span class="controlled-room-card-stat-label">Time Held:</span>
          <span class="controlled-room-card-stat-value">${room.timeControlled} steps</span>
        </div>
      </div>

      <div class="controlled-room-card-upgrades">
        <span class="controlled-room-card-upgrade">🛡️ ${room.upgrades.barricades}/3</span>
        <span class="controlled-room-card-upgrade">🔫 ${room.upgrades.turrets}/2</span>
        <span class="controlled-room-card-upgrade">${room.upgrades.reinforcedWalls ? "🧱✓" : "🧱✗"}</span>
        <span class="controlled-room-card-upgrade">${room.upgrades.powerGenerator ? "⚡✓" : "⚡✗"}</span>
      </div>

      <div class="controlled-room-card-actions">
        ${isCurrentFloor && room.status === "controlled" ? `
          <button class="controlled-room-btn controlled-room-btn--primary" data-action="visit" data-node-id="${room.nodeId}">
            VISIT (Field Mode)
          </button>
        ` : ""}
        ${room.status === "under_attack" ? `
          <button class="controlled-room-btn controlled-room-btn--danger" data-action="defend" data-node-id="${room.nodeId}">
            DEFEND NOW
          </button>
          <button class="controlled-room-btn controlled-room-btn--secondary" data-action="delay" data-node-id="${room.nodeId}">
            DELAY DEFENSE
          </button>
        ` : ""}
        ${room.status === "controlled" && room.threatLevel < 30 ? `
          <button class="controlled-room-btn controlled-room-btn--secondary" data-action="quick-reinforce" data-node-id="${room.nodeId}">
            QUICK REINFORCE (-10 Threat, -5 WAD)
          </button>
        ` : ""}
        <button class="controlled-room-btn controlled-room-btn--danger" data-action="abandon" data-node-id="${room.nodeId}">
          ABANDON
        </button>
      </div>
    </div>
  `;
}

/**
 * Get status CSS class
 */
function getStatusClass(status: string): string {
  switch (status) {
    case "controlled":
      return "controlled-room-card--controlled";
    case "under_attack":
      return "controlled-room-card--under-attack";
    case "fortifying":
      return "controlled-room-card--fortifying";
    case "lost":
      return "controlled-room-card--lost";
    default:
      return "";
  }
}

/**
 * Get threat level CSS class
 */
function getThreatClass(threatLevel: number): string {
  if (threatLevel >= 70) return "controlled-room-threat--high";
  if (threatLevel >= 40) return "controlled-room-threat--medium";
  return "controlled-room-threat--low";
}

/**
 * Get fortification icon
 */
function getFortificationIcon(fortLevel: number): string {
  switch (fortLevel) {
    case 3:
      return "🟢";
    case 2:
      return "🟡";
    case 1:
      return "🟠";
    default:
      return "🔴";
  }
}

/**
 * Attach event listeners
 */
function attachEventListeners(returnScreen: string): void {
  const closeBtn = document.getElementById("closeBtn");
  closeBtn?.addEventListener("click", () => handleClose(returnScreen));

  // Action buttons
  const visitBtns = document.querySelectorAll("[data-action='visit']");
  visitBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const nodeId = (btn as HTMLElement).dataset.nodeId!;
      handleVisitRoom(nodeId);
    });
  });

  const defendBtns = document.querySelectorAll("[data-action='defend']");
  defendBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const nodeId = (btn as HTMLElement).dataset.nodeId!;
      handleDefendRoom(nodeId);
    });
  });

  const delayBtns = document.querySelectorAll("[data-action='delay']");
  delayBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const nodeId = (btn as HTMLElement).dataset.nodeId!;
      handleDelayDefense(nodeId);
    });
  });

  const quickReinforceBtns = document.querySelectorAll("[data-action='quick-reinforce']");
  quickReinforceBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const nodeId = (btn as HTMLElement).dataset.nodeId!;
      handleQuickReinforce(nodeId);
    });
  });

  const abandonBtns = document.querySelectorAll("[data-action='abandon']");
  abandonBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const nodeId = (btn as HTMLElement).dataset.nodeId!;
      handleAbandonRoom(nodeId);
    });
  });
}

/**
 * Handle close button
 */
function handleClose(returnScreen: string): void {
  if (returnScreen === "operation_map") {
    renderOperationMapScreen();
  }
}

/**
 * Handle visit room (enter field mode)
 */
function handleVisitRoom(nodeId: string): void {
  console.log(`[CONTROLLEDROOMS] Visiting room ${nodeId} in field mode`);
  import("../../field/controlledRoomFieldMode").then(({ enterControlledRoomFieldMode }) => {
    enterControlledRoomFieldMode(nodeId);
  });
}

/**
 * Handle defend room
 */
function handleDefendRoom(nodeId: string): void {
  console.log(`[CONTROLLEDROOMS] Defending room ${nodeId}`);
  // TODO: Implement defense battle system
  alert("Defense battle not yet implemented. Coming soon!");
}

/**
 * Handle delay defense
 */
function handleDelayDefense(nodeId: string): void {
  const room = getControlledRoom(nodeId);
  if (!room) return;

  const confirmed = confirm(`Delay defense for ${CONTROLLED_ROOM_CONFIG[room.roomType].name}? Threat will continue to increase.`);
  if (!confirmed) return;

  // Set status back to controlled but leave threat high
  const progress = loadCampaignProgress();
  if (!progress.activeRun) return;

  const updatedRooms = {
    ...progress.activeRun.controlledRooms,
    [nodeId]: {
      ...room,
      status: "controlled" as const,
    },
  };

  const updated = {
    ...progress,
    activeRun: {
      ...progress.activeRun,
      controlledRooms: updatedRooms,
    },
  };

  saveCampaignProgress(updated);
  renderControlledRoomsWindow("operation_map");
}

/**
 * Handle quick reinforce (reduce threat for WAD cost)
 */
function handleQuickReinforce(nodeId: string): void {
  const room = getControlledRoom(nodeId);
  if (!room) return;

  const confirmed = confirm(`Quick Reinforce: Reduce threat by 10 for 5 WAD?`);
  if (!confirmed) return;

  // TODO: Check if player has 5 WAD
  // For now, just reduce threat
  reduceThreat(nodeId, 10);
  console.log(`[CONTROLLEDROOMS] Quick reinforced room ${nodeId}`);
  renderControlledRoomsWindow("operation_map");
}

/**
 * Handle abandon room
 */
function handleAbandonRoom(nodeId: string): void {
  const room = getControlledRoom(nodeId);
  if (!room) return;

  const confirmed = confirm(`Abandon ${CONTROLLED_ROOM_CONFIG[room.roomType].name}? This cannot be undone.`);
  if (!confirmed) return;

  abandonControlledRoom(nodeId);
  console.log(`[CONTROLLEDROOMS] Abandoned room ${nodeId}`);
  renderControlledRoomsWindow("operation_map");
}

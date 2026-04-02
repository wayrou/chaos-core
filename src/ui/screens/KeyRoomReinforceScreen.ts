// ============================================================================
// KEY ROOM REINFORCEMENT SCREEN
// Allows upgrading/reinforcing captured key rooms
// ============================================================================

import { getActiveRun } from "../../core/campaignManager";
import { getKeyRoomsForFloor, getFacilityConfig } from "../../core/keyRoomSystem";
import { renderOperationMapScreen } from "./OperationMapScreen";

/**
 * Render key room reinforcement screen
 */
export function renderKeyRoomReinforceScreen(keyRoomId: string): void {
  const root = document.getElementById("app");
  if (!root) return;

  const activeRun = getActiveRun();
  if (!activeRun) {
    console.warn("[KEYROOM] No active run");
    renderOperationMapScreen();
    return;
  }

  const floorIndex = activeRun.floorIndex;
  const keyRooms = getKeyRoomsForFloor(floorIndex);
  const keyRoom = keyRooms.find(kr => kr.roomNodeId === keyRoomId);

  if (!keyRoom) {
    console.warn("[KEYROOM] Key room not found:", keyRoomId);
    renderOperationMapScreen();
    return;
  }

  const facilityConfig = getFacilityConfig(keyRoom.facility);

  // Reinforcement options (placeholder - can be expanded)
  const reinforcementOptions = [
    {
      id: "defense_boost",
      name: "Defense Boost",
      description: "Increases defense rating, reducing attack chance by 5%",
      cost: { wad: 100 },
      effect: "reduce_attack_chance",
    },
    {
      id: "resource_boost",
      name: "Resource Boost",
      description: "Increases resource generation by 25%",
      cost: { wad: 150 },
      effect: "increase_generation",
    },
    {
      id: "storage_expansion",
      name: "Storage Expansion",
      description: "Increases storage capacity for resources",
      cost: { wad: 200 },
      effect: "increase_storage",
    },
  ];

  root.innerHTML = `
    <div class="keyroom-screen">
      <div class="keyroom-screen__panel">
        <div class="keyroom-screen__header">
          <div class="keyroom-screen__titleblock">
            <span class="keyroom-screen__eyebrow">S/COM // FACILITY UPGRADE</span>
            <h1 class="keyroom-screen__title">REINFORCE KEY ROOM</h1>
            <p class="keyroom-screen__subtitle">Commit resources to harden the site and improve what this command post contributes during the run.</p>
          </div>
          <button class="keyroom-screen__back-btn" id="backBtn">BACK TO MAP</button>
        </div>

        <div class="keyroom-screen__hero">
          <div class="keyroom-screen__hero-mark">RF</div>
          <div class="keyroom-screen__hero-copy">
            <span class="keyroom-screen__hero-kicker">Upgrade Queue</span>
            <h2 class="keyroom-screen__hero-title">${facilityConfig.name}</h2>
            <p class="keyroom-screen__hero-desc">${facilityConfig.description}</p>
          </div>
        </div>

        <div class="keyroom-screen__section keyroom-screen__section--wide">
          <div class="keyroom-screen__section-header">
            <h3 class="keyroom-screen__section-title">Reinforcement Packages</h3>
          </div>
          <div class="keyroom-reinforce__options">
            ${reinforcementOptions.map(option => `
              <div class="keyroom-reinforce__option">
                <div class="keyroom-reinforce__copy">
                  <div class="keyroom-reinforce__topline">
                    <h4 class="keyroom-reinforce__name">${option.name}</h4>
                    <div class="keyroom-reinforce__costs">
                      ${Object.entries(option.cost).map(([type, amount]) => `
                        <span class="keyroom-reinforce__cost">${amount} ${formatCostLabel(type)}</span>
                      `).join("")}
                    </div>
                  </div>
                  <p class="keyroom-reinforce__description">${option.description}</p>
                </div>
                <button class="keyroom-screen__action-btn keyroom-reinforce-option-btn" data-option-id="${option.id}" data-keyroom-id="${keyRoomId}">
                  APPLY PACKAGE
                </button>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  root.querySelector("#backBtn")?.addEventListener("click", () => {
    renderOperationMapScreen();
  });

  root.querySelectorAll(".keyroom-reinforce-option-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const optionId = (btn as HTMLElement).getAttribute("data-option-id");
      const roomId = (btn as HTMLElement).getAttribute("data-keyroom-id");
      if (optionId && roomId) {
        applyReinforcement(roomId, optionId);
      }
    });
  });
}

function applyReinforcement(keyRoomId: string, optionId: string): void {
  // TODO: Implement reinforcement logic
  // For now, just show a message
  alert(`Reinforcement "${optionId}" applied to key room ${keyRoomId}!\n\n(Full implementation coming soon)`);

  // Return to map
  renderOperationMapScreen();
}

function formatCostLabel(type: string): string {
  return type.toUpperCase();
}


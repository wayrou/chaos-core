// ============================================================================
// KEY ROOM REINFORCEMENT SCREEN
// Allows upgrading/reinforcing captured key rooms
// ============================================================================

import { getActiveRun } from "../../core/campaignManager";
import { getKeyRoomsForFloor, FACILITY_CONFIG, getFacilityConfig } from "../../core/keyRoomSystem";
import { renderOperationMapScreen } from "./OperationMapScreen";
import { syncCampaignToGameState } from "../../core/campaignSync";
import { loadCampaignProgress, saveCampaignProgress } from "../../core/campaign";

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
    <div class="keyroom-reinforce-root">
      <div class="keyroom-reinforce-card">
        <div class="keyroom-reinforce-header">
          <h1 class="keyroom-reinforce-title">REINFORCE KEY ROOM</h1>
          <button class="keyroom-reinforce-back-btn" id="backBtn">← BACK TO MAP</button>
        </div>

        <div class="keyroom-reinforce-body">
          <div class="keyroom-reinforce-facility">
            <div class="keyroom-reinforce-facility-header">
              <span class="keyroom-reinforce-facility-icon">🔑</span>
              <h2 class="keyroom-reinforce-facility-name">${facilityConfig.name}</h2>
            </div>
            <p class="keyroom-reinforce-facility-desc">${facilityConfig.description}</p>
          </div>

          <div class="keyroom-reinforce-options">
            <h3 class="keyroom-reinforce-section-title">REINFORCEMENT OPTIONS</h3>
            <div class="keyroom-reinforce-options-list">
              ${reinforcementOptions.map(option => `
                <div class="keyroom-reinforce-option">
                  <div class="keyroom-reinforce-option-header">
                    <h4 class="keyroom-reinforce-option-name">${option.name}</h4>
                    <div class="keyroom-reinforce-option-cost">
                      ${Object.entries(option.cost).map(([type, amount]) => `
                        <span class="cost-item">💰 ${amount} ${type.toUpperCase()}</span>
                      `).join("")}
                    </div>
                  </div>
                  <p class="keyroom-reinforce-option-desc">${option.description}</p>
                  <button class="keyroom-reinforce-option-btn" data-option-id="${option.id}" data-keyroom-id="${keyRoomId}">
                    APPLY REINFORCEMENT
                  </button>
                </div>
              `).join("")}
            </div>
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


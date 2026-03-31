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
    <div class="ard-fullscreen-overlay ard-noise flex-center">
      <div class="ard-panel" style="max-width: 800px; width: 90%;">
        
        <!-- Header -->
        <div class="ard-panel-header">
          <div class="flex-col">
            <h1 class="ard-heading-lg">REINFORCE KEY ROOM</h1>
            <div class="ard-subheading">S/COM_OS // FACILITY_UPGRADE</div>
          </div>
          <button class="ard-btn-secondary" id="backBtn">
            <span class="ard-icon">←</span> BACK TO MAP
          </button>
        </div>

        <!-- Body -->
        <div class="ard-panel-section" style="padding: var(--space-lg);">
          
          <!-- Facility Info -->
          <div class="ard-panel-inset" style="margin-bottom: var(--space-lg); display: flex; align-items: flex-start; gap: var(--space-md);">
            <div style="font-size: 2rem; line-height: 1; color: var(--accent-bronze);">🔑</div>
            <div>
              <h2 class="ard-heading-md" style="margin-bottom: var(--space-xs);">${facilityConfig.name}</h2>
              <p class="ard-text-muted" style="margin: 0; line-height: 1.5;">${facilityConfig.description}</p>
            </div>
          </div>

          <!-- Options -->
          <div>
            <h3 class="ard-subheading" style="margin-bottom: var(--space-md);">REINFORCEMENT OPTIONS</h3>
            <div style="display: flex; flex-direction: column; gap: var(--space-md);">
              ${reinforcementOptions.map(option => `
                <div class="ard-panel-inset" style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-md);">
                  <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-xs);">
                      <h4 class="ard-heading-sm" style="color: var(--tech-amber);">${option.name}</h4>
                      <div style="display: flex; gap: var(--space-sm);">
                        ${Object.entries(option.cost).map(([type, amount]) => `
                          <span class="ard-badge ard-badge-warning" style="font-family: var(--font-mono); font-size: 0.8rem;">
                            💰 ${amount} ${type.toUpperCase()}
                          </span>
                        `).join("")}
                      </div>
                    </div>
                    <p class="ard-text" style="margin: 0; font-size: 0.9rem;">${option.description}</p>
                  </div>
                  <button class="ard-btn-primary keyroom-reinforce-option-btn" data-option-id="${option.id}" data-keyroom-id="${keyRoomId}" style="white-space: nowrap;">
                    APPLY <span class="ard-icon">→</span>
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


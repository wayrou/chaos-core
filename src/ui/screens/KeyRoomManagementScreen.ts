// ============================================================================
// KEY ROOM MANAGEMENT SCREEN
// Shows details and allows management of a captured key room
// ============================================================================

import { getActiveRun } from "../../core/campaignManager";
import { getKeyRoomsForFloor, FACILITY_CONFIG, getFacilityConfig } from "../../core/keyRoomSystem";
import { renderOperationMapScreen } from "./OperationMapScreen";
import { syncCampaignToGameState } from "../../core/campaignSync";

/**
 * Render key room management screen
 */
export function renderKeyRoomManagementScreen(keyRoomId: string): void {
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

  root.innerHTML = `
    <div class="keyroom-mgmt-root">
      <div class="keyroom-mgmt-card">
        <div class="keyroom-mgmt-header">
          <h1 class="keyroom-mgmt-title">KEY ROOM MANAGEMENT</h1>
          <button class="keyroom-mgmt-back-btn" id="backBtn">← BACK TO MAP</button>
        </div>

        <div class="keyroom-mgmt-body">
          <div class="keyroom-mgmt-facility">
            <div class="keyroom-mgmt-facility-header">
              <span class="keyroom-mgmt-facility-icon">🔑</span>
              <h2 class="keyroom-mgmt-facility-name">${facilityConfig.name}</h2>
            </div>
            <p class="keyroom-mgmt-facility-desc">${facilityConfig.description}</p>
            ${facilityConfig.passiveEffect ? `
              <div class="keyroom-mgmt-effect">
                <span class="keyroom-mgmt-effect-label">Passive Effect:</span>
                <span class="keyroom-mgmt-effect-text">${getPassiveEffectDescription(facilityConfig.passiveEffect)}</span>
              </div>
            ` : ""}
          </div>

          <div class="keyroom-mgmt-status">
            <div class="keyroom-mgmt-status-item">
              <span class="keyroom-mgmt-status-label">Status:</span>
              <span class="keyroom-mgmt-status-value ${keyRoom.isUnderAttack ? 'status-attack' : keyRoom.isDelayed ? 'status-delayed' : 'status-normal'}">
                ${keyRoom.isUnderAttack ? '⚠️ UNDER ATTACK' : keyRoom.isDelayed ? '⏸ DELAYED' : '✓ OPERATIONAL'}
              </span>
            </div>
          </div>

          <div class="keyroom-mgmt-resources">
            <h3 class="keyroom-mgmt-section-title">STORED RESOURCES</h3>
            <div class="keyroom-mgmt-resources-list">
              ${Object.keys(keyRoom.storedResources || {}).length > 0 ? `
                ${Object.entries(keyRoom.storedResources || {}).map(([type, amount]) => `
                  <div class="keyroom-mgmt-resource-item">
                    <span class="keyroom-mgmt-resource-type">${type}:</span>
                    <span class="keyroom-mgmt-resource-amount">${amount}</span>
                  </div>
                `).join("")}
              ` : `
                <div class="keyroom-mgmt-resource-empty">No resources stored yet</div>
              `}
            </div>
          </div>

          <div class="keyroom-mgmt-generation">
            <h3 class="keyroom-mgmt-section-title">RESOURCE GENERATION</h3>
            <div class="keyroom-mgmt-generation-list">
              ${Object.entries(facilityConfig.resourceGeneration).map(([type, amount]) => `
                <div class="keyroom-mgmt-generation-item">
                  <span class="keyroom-mgmt-generation-type">${type}:</span>
                  <span class="keyroom-mgmt-generation-amount">+${amount} per room cleared</span>
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
}

function getPassiveEffectDescription(effect: string): string {
  switch (effect) {
    case "heal_party_small":
      return "Heals party by 10% max HP after each battle";
    case "field_mod_reroll_token":
      return "Grants field mod reroll tokens";
    case "reveal_nodes":
      return "Reveals additional nodes on the map";
    default:
      return effect;
  }
}


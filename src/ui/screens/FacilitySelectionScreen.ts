// ============================================================================
// FACILITY SELECTION SCREEN
// Shown after capturing a Key Room
// ============================================================================

import { FacilityType, getFacilityConfig, getAllFacilityTypes } from "../../core/keyRoomSystem";
import { captureKeyRoom } from "../../core/keyRoomSystem";
import { renderOperationMapScreen, markRoomVisited } from "./OperationMapScreen";
import { syncCampaignToGameState } from "../../core/campaignSync";

/**
 * Render facility selection screen
 */
export function renderFacilitySelectionScreen(nodeId: string): void {
  const root = document.getElementById("app");
  if (!root) return;
  
  const facilityTypes = getAllFacilityTypes();
  const facilityConfigs = facilityTypes.map(ft => ({
    type: ft,
    config: getFacilityConfig(ft),
  }));
  
  root.innerHTML = `
    <div class="facility-selection-root">
      <div class="facility-selection-card">
        <div class="facility-selection-header">
          <h1 class="facility-selection-title">KEY ROOM CAPTURED</h1>
          <p class="facility-selection-subtitle">Choose a facility to establish in this room</p>
        </div>
        
        <div class="facility-selection-options">
          ${facilityConfigs.map(fc => `
            <div class="facility-option" data-facility="${fc.type}">
              <div class="facility-option-header">
                <h2 class="facility-option-name">${fc.config.name}</h2>
              </div>
              <div class="facility-option-description">
                ${fc.config.description}
              </div>
              <div class="facility-option-resources">
                <div class="facility-resources-title">Resource Generation:</div>
                <div class="facility-resources-list">
                  ${Object.entries(fc.config.resourceGeneration).map(([type, amount]) => `
                    <div class="facility-resource-item">
                      <span class="facility-resource-type">${type}:</span>
                      <span class="facility-resource-amount">+${amount}</span>
                    </div>
                  `).join("")}
                </div>
              </div>
              ${fc.config.passiveEffect ? `
                <div class="facility-option-effect">
                  <span class="facility-effect-label">Passive Effect:</span>
                  <span class="facility-effect-text">${getPassiveEffectDescription(fc.config.passiveEffect)}</span>
                </div>
              ` : ""}
              <button class="facility-option-select" data-facility="${fc.type}">
                SELECT
              </button>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
  
  // Attach event listeners
  root.querySelectorAll(".facility-option-select, .facility-option").forEach(element => {
    element.addEventListener("click", (e) => {
      e.stopPropagation();
      const facility = (e.currentTarget as HTMLElement).getAttribute("data-facility") as FacilityType;
      if (facility) {
        selectFacility(nodeId, facility);
      }
    });
  });
}

/**
 * Select a facility for the Key Room
 */
function selectFacility(nodeId: string, facility: FacilityType): void {
  // Capture the key room (floor-scoped)
  captureKeyRoom(nodeId, facility);

  // ALSO capture as Controlled Room (operation-scoped, Headline 14e)
  import("../../core/controlledRoomsSystem").then(({ captureRoom }) => {
    import("../../core/campaignManager").then(({ getActiveRun }) => {
      const activeRun = getActiveRun();
      if (activeRun) {
        // Convert FacilityType to ControlledRoomType (same types)
        captureRoom(nodeId, activeRun.floorIndex, facility as any);
        console.log(`[FACILITY] Captured as Controlled Room: ${nodeId} on floor ${activeRun.floorIndex}`);
      }
    });
  });

  // Mark the room as visited/cleared
  markRoomVisited(nodeId);

  // Sync campaign state
  syncCampaignToGameState();

  // Return to operation map
  renderOperationMapScreen();
}

/**
 * Get description for passive effect
 */
function getPassiveEffectDescription(effect: string): string {
  switch (effect) {
    case "heal_party_small":
      return "Heals party by 10% max HP after each battle";
    case "field_mod_reroll_token":
      return "Grants +1 Field Mod reroll token after each battle";
    case "reveal_nodes":
      return "Reveals additional nodes on the map";
    default:
      return effect;
  }
}


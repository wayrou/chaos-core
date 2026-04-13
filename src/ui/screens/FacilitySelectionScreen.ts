// ============================================================================
// FACILITY SELECTION SCREEN
// Shown after capturing a Key Room
// ============================================================================

import { FacilityType, getFacilityConfig, getAllFacilityTypes } from "../../core/keyRoomSystem";
import { captureKeyRoom } from "../../core/keyRoomSystem";
import { markOperationRoomVisited, renderActiveOperationSurface } from "./activeOperationFlow";

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
      <div class="ard-panel ard-panel--framed facility-selection-card">
        <div class="ard-panel__header">
          <h1 class="ard-panel__title">KEY ROOM CAPTURED</h1>
        </div>
        
        <div class="ard-panel__body">
          <p class="facility-selection-subtitle">Choose a facility to establish in this room</p>
          <div class="facility-selection-options">
            ${facilityConfigs.map(fc => `
              <div class="ard-list-item facility-option" data-facility="${fc.type}">
                <div class="ard-list-item__content">
                  <h2 class="ard-list-item__label" style="color: var(--tech-amber); margin-bottom: var(--space-2);">${fc.config.name}</h2>
                  <div class="ard-list-item__sublabel" style="margin-bottom: var(--space-3); color: var(--ink);">
                    ${fc.config.description}
                  </div>
                  <div class="facility-option-resources" style="font-family: var(--font-terminal); font-size: var(--text-xs); color: var(--tech-crt); background: var(--bg-surface); padding: var(--space-2); border-radius: var(--radius-sm); border: 1px solid var(--stroke-subtle); margin-bottom: var(--space-3);">
                    <div style="color: var(--ink-secondary); margin-bottom: var(--space-1);">Resource Generation:</div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      ${Object.entries(fc.config.resourceGeneration).map(([type, amount]) => `
                        <div style="display: flex; justify-content: space-between;">
                          <span style="opacity: 0.8;">${type}:</span>
                          <span style="color: var(--tech-crt);">+${amount}</span>
                        </div>
                      `).join("")}
                    </div>
                  </div>
                  ${fc.config.passiveEffect ? `
                    <div class="facility-option-effect" style="font-size: var(--text-xs); background: rgba(140, 230, 255, 0.1); padding: var(--space-2); border-radius: var(--radius-sm); border: 1px solid var(--tech-teal-dim); color: var(--tech-teal);">
                      <span style="font-weight: 600; opacity: 0.8; margin-right: var(--space-1);">Passive Effect:</span>
                      <span>${getPassiveEffectDescription(fc.config.passiveEffect)}</span>
                    </div>
                  ` : ""}
                </div>
                <div style="flex-shrink: 0; align-self: center; margin-left: var(--space-4);">
                  <button class="ard-btn ard-btn--primary facility-option-select" data-facility="${fc.type}">
                    SELECT
                  </button>
                </div>
              </div>
            `).join("")}
          </div>
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
  // Capture the key room
  captureKeyRoom(nodeId, facility);

  // Mark the room as visited/cleared
  markOperationRoomVisited(nodeId);

  // Return to the active operation surface
  renderActiveOperationSurface();
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


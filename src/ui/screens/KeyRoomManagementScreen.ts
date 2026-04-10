// ============================================================================
// KEY ROOM MANAGEMENT SCREEN
// Shows details and allows management of a captured key room
// ============================================================================

import { getActiveRun } from "../../core/campaignManager";
import { getKeyRoomsForFloor, getFacilityConfig } from "../../core/keyRoomSystem";
import { renderActiveOperationSurface } from "./activeOperationFlow";

function findKeyRoomAcrossFloors(keyRoomId: string): { floorIndex: number; keyRoom: ReturnType<typeof getKeyRoomsForFloor>[number] } | null {
  const activeRun = getActiveRun();
  if (!activeRun) return null;

  const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
  for (const [floorIndexStr, rooms] of Object.entries(keyRoomsByFloor)) {
    const match = (rooms || []).find((room) => room.roomNodeId === keyRoomId);
    if (match) {
      return {
        floorIndex: Number(floorIndexStr),
        keyRoom: match,
      };
    }
  }

  return null;
}

/**
 * Render key room management screen
 */
export function renderKeyRoomManagementScreen(keyRoomId: string): void {
  const root = document.getElementById("app");
  if (!root) return;

  const activeRun = getActiveRun();
  if (!activeRun) {
    console.warn("[KEYROOM] No active run");
    renderActiveOperationSurface();
    return;
  }

  const keyRoomMatch = findKeyRoomAcrossFloors(keyRoomId);
  if (!keyRoomMatch) {
    console.warn("[KEYROOM] Key room not found:", keyRoomId);
    renderActiveOperationSurface();
    return;
  }
  const { floorIndex, keyRoom } = keyRoomMatch;

  const facilityConfig = getFacilityConfig(keyRoom.facility);

  const statusText = keyRoom.isUnderAttack
    ? "UNDER ATTACK"
    : keyRoom.isDelayed
      ? "DELAYED"
      : "OPERATIONAL";
  const statusClass = keyRoom.isUnderAttack
    ? "keyroom-screen__status--attack"
    : keyRoom.isDelayed
      ? "keyroom-screen__status--delayed"
      : "keyroom-screen__status--normal";

  root.innerHTML = `
    <div class="keyroom-screen">
      <div class="keyroom-screen__panel">
        <div class="keyroom-screen__header">
          <div class="keyroom-screen__titleblock">
            <span class="keyroom-screen__eyebrow">S/COM // CAPTURED FACILITY</span>
            <h1 class="keyroom-screen__title">KEY ROOM ACCESS</h1>
            <p class="keyroom-screen__subtitle">Review forward command output, room status, and support gains before resuming the operation.</p>
          </div>
          <button class="keyroom-screen__back-btn" id="backBtn">BACK TO OPERATION</button>
        </div>

        <div class="keyroom-screen__hero">
          <div class="keyroom-screen__hero-mark">KR</div>
          <div class="keyroom-screen__hero-copy">
            <span class="keyroom-screen__hero-kicker">Captured Site</span>
            <h2 class="keyroom-screen__hero-title">${facilityConfig.name}</h2>
            <p class="keyroom-screen__hero-desc">${facilityConfig.description}</p>
          </div>
        </div>

        <div class="keyroom-screen__meta">
          <div class="keyroom-screen__meta-item">
            <span class="keyroom-screen__meta-label">Floor</span>
            <span class="keyroom-screen__meta-value">${floorIndex + 1}</span>
          </div>
          <div class="keyroom-screen__meta-item">
            <span class="keyroom-screen__meta-label">Room</span>
            <span class="keyroom-screen__meta-value">${keyRoom.roomNodeId}</span>
          </div>
          <div class="keyroom-screen__meta-item">
            <span class="keyroom-screen__meta-label">Status</span>
            <span class="keyroom-screen__status ${statusClass}">${statusText}</span>
          </div>
        </div>

        <div class="keyroom-screen__grid">
          <section class="keyroom-screen__section">
            <div class="keyroom-screen__section-header">
              <h3 class="keyroom-screen__section-title">Facility Effect</h3>
            </div>
            <p class="keyroom-screen__body-copy">
              ${facilityConfig.passiveEffect
                ? getPassiveEffectDescription(facilityConfig.passiveEffect)
                : "This capture point is active and awaiting future command protocols."}
            </p>
          </section>

          <section class="keyroom-screen__section">
            <div class="keyroom-screen__section-header">
              <h3 class="keyroom-screen__section-title">Stored Resources</h3>
            </div>
            <div class="keyroom-screen__list">
              ${Object.keys(keyRoom.storedResources || {}).length > 0
                ? Object.entries(keyRoom.storedResources || {}).map(([type, amount]) => `
                    <div class="keyroom-screen__list-item">
                      <span class="keyroom-screen__list-label">${formatResourceLabel(type)}</span>
                      <span class="keyroom-screen__list-value">${amount}</span>
                    </div>
                  `).join("")
                : `<div class="keyroom-screen__empty">No resources banked from this facility yet.</div>`}
            </div>
          </section>

          <section class="keyroom-screen__section keyroom-screen__section--wide">
            <div class="keyroom-screen__section-header">
              <h3 class="keyroom-screen__section-title">Generation Output</h3>
            </div>
            <div class="keyroom-screen__list">
              ${Object.entries(facilityConfig.resourceGeneration).map(([type, amount]) => `
                <div class="keyroom-screen__list-item">
                  <span class="keyroom-screen__list-label">${formatResourceLabel(type)}</span>
                  <span class="keyroom-screen__list-value">+${amount} per room cleared</span>
                </div>
              `).join("")}
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  root.querySelector("#backBtn")?.addEventListener("click", () => {
    renderActiveOperationSurface();
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

function formatResourceLabel(type: string): string {
  return type
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}


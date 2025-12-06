// ============================================================================
// WEAPON WINDOW - Battle UI Component for Weapon Management
// Shows heat, ammo, wear, clutch toggles, and weapon node diagram
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { WeaponEquipment } from "../../core/equipment";


import {
  WeaponRuntimeState,
  WeaponNodeId,
  NodeDamageLevel,
  WEAPON_NODE_NAMES,
  NODE_DAMAGE_EFFECTS,
  getHeatZone,
  getHeatZoneColor,
  getWearPenalties,
  activateClutch,
  deactivateClutch,
  activateDoubleClutch,
  deactivateDoubleClutch,
  quickReload,
  fullReload,
  isWeaponDestroyed,
} from "../../core/weaponSystem";

// ----------------------------------------------------------------------------
// RENDER WEAPON WINDOW
// Renders the weapon panel for the active unit in battle
// ----------------------------------------------------------------------------

export function renderWeaponWindow(
  weapon: WeaponEquipment,
  weaponState: WeaponRuntimeState,
  onClutchToggle: () => void,
  onDoubleClutchToggle: () => void,
  onQuickReload: () => void,
  onFullReload: () => void,
  onVent: () => void
): string {
  const isDestroyed = isWeaponDestroyed(weaponState);
  const heatZone = getHeatZone(weaponState, weapon);
  const heatColor = getHeatZoneColor(heatZone);
  const wearPenalties = getWearPenalties(weaponState.wear);

  // Calculate current max heat (affected by node damage)
  let maxHeat = weapon.heatCapacity ?? 0;
  if (weaponState.nodes[5] === "damaged" || weaponState.nodes[5] === "broken") {
    maxHeat = Math.max(1, maxHeat - 2);
  }

  return `
    <div class="weapon-window ${isDestroyed ? "weapon-window--destroyed" : ""}">
      <div class="weapon-window-header">
        <div class="weapon-window-title">${weapon.name}</div>
        <div class="weapon-window-type">${weapon.weaponType.toUpperCase()} ${weapon.isMechanical ? "• MECHANICAL" : ""}</div>
      </div>

      <div class="weapon-window-body">
        <!-- Stats and Controls -->
        <div class="weapon-stats-panel-wrapper">
        <div class="weapon-stats-panel">
          ${weapon.isMechanical && weapon.heatCapacity ? `
            <div class="weapon-stat-row">
              <div class="weapon-stat-label">HEAT</div>
              <div class="weapon-stat-bar">
                <div class="weapon-stat-bar-track">
                  <div class="weapon-stat-bar-fill" style="width: ${(weaponState.currentHeat / maxHeat) * 100}%; background: ${heatColor};"></div>
                </div>
                <div class="weapon-stat-value">${weaponState.currentHeat}/${maxHeat}</div>
              </div>
              ${weaponState.isJammed ? '<div class="weapon-jammed-badge">JAMMED</div>' : ''}
            </div>
          ` : ''}

          ${weapon.ammoMax ? `
            <div class="weapon-stat-row">
              <div class="weapon-stat-label">AMMO</div>
              <div class="weapon-stat-bar">
                <div class="weapon-stat-bar-track">
                  <div class="weapon-stat-bar-fill weapon-stat-bar-fill--ammo" style="width: ${(weaponState.currentAmmo / weapon.ammoMax) * 100}%;"></div>
                </div>
                <div class="weapon-stat-value">${weaponState.currentAmmo}/${weapon.ammoMax}</div>
              </div>
            </div>
          ` : ''}

          <div class="weapon-stat-row">
            <div class="weapon-stat-label">WEAR</div>
            <div class="weapon-wear-display">
              <div class="weapon-wear-pips">
                ${[0, 1, 2, 3, 4].map(i => `
                  <div class="weapon-wear-pip ${i < weaponState.wear ? 'weapon-wear-pip--filled' : ''}"></div>
                `).join('')}
              </div>
              <div class="weapon-wear-value">${weaponState.wear}/5</div>
            </div>
          </div>

          ${wearPenalties.accPenalty > 0 || wearPenalties.dmgPenalty > 0 ? `
            <div class="weapon-penalty-row">
              ${wearPenalties.accPenalty > 0 ? `<span class="weapon-penalty">-${wearPenalties.accPenalty} ACC</span>` : ''}
              ${wearPenalties.dmgPenalty > 0 ? `<span class="weapon-penalty">-${wearPenalties.dmgPenalty} DMG</span>` : ''}
            </div>
          ` : ''}

          <!-- Clutch Toggle -->
          ${weapon.clutchToggle ? `
            <div class="weapon-clutch-section">
              <button class="weapon-clutch-btn ${weaponState.clutchActive ? 'weapon-clutch-btn--active' : ''}" data-action="clutch">
                <div class="weapon-clutch-label">CLUTCH ${weaponState.clutchActive ? '(ACTIVE - click to cancel)' : ''}</div>
                <div class="weapon-clutch-effect">${weapon.clutchToggle}</div>
              </button>
            </div>
          ` : ''}

          ${weapon.doubleClutch ? `
            <div class="weapon-clutch-section">
              <button class="weapon-clutch-btn ${weaponState.doubleClutchActive ? 'weapon-clutch-btn--active' : ''}" data-action="double-clutch">
                <div class="weapon-clutch-label">DOUBLE CLUTCH ${weaponState.doubleClutchActive ? '(ACTIVE - click to cancel)' : ''}</div>
                <div class="weapon-clutch-effect">${weapon.doubleClutch}</div>
              </button>
            </div>
          ` : ''}

          <!-- Action Buttons -->
          <div class="weapon-actions">
            ${weapon.ammoMax ? `
              <button class="weapon-action-btn" data-action="quick-reload">
                QCK RLD <span class="weapon-action-cost">(${weapon.quickReloadStrain ?? 1} STR)</span>
              </button>
              <button class="weapon-action-btn" data-action="full-reload">
                FULL RLD <span class="weapon-action-cost">(${weapon.fullReloadStrain ?? 0} STR)</span>
              </button>
            ` : ''}
            ${weapon.isMechanical && weapon.heatCapacity ? `
              <button class="weapon-action-btn weapon-action-btn--vent" data-action="vent">
                VENT <span class="weapon-action-cost">(10% HP)</span>
              </button>
            ` : ''}
          </div>
        </div>
        </div>

        <!-- Node Diagram -->
        ${weapon.isMechanical ? renderNodeDiagram(weaponState) : ''}
      </div>

      ${isDestroyed ? `
        <div class="weapon-destroyed-overlay">
          <div class="weapon-destroyed-text">WEAPON OFFLINE</div>
          <div class="weapon-destroyed-hint">Repair required at Base Camp</div>
        </div>
      ` : ''}
    </div>
  `;
}

// ----------------------------------------------------------------------------
// RENDER NODE DIAGRAM
// Shows the 6 weapon nodes with their damage status
// ----------------------------------------------------------------------------

function renderNodeDiagram(weaponState: WeaponRuntimeState): string {
  const nodes = [1, 2, 3, 4, 5, 6] as WeaponNodeId[];

  return `
    <div class="weapon-node-diagram">
      <div class="weapon-node-title">SYSTEM STATUS</div>
      <div class="weapon-node-grid">
        ${nodes.map(nodeId => {
          const status = weaponState.nodes[nodeId];
          const names = WEAPON_NODE_NAMES[nodeId];
          const effects = NODE_DAMAGE_EFFECTS[nodeId];
          const statusClass = `weapon-node--${status}`;
          const statusLabel = status === "ok" ? "OK" : status.toUpperCase();

          return `
            <div class="weapon-node ${statusClass}" data-node="${nodeId}">
              <div class="weapon-node-id">${nodeId}</div>
              <div class="weapon-node-name">${names.primary}</div>
              <div class="weapon-node-status">${statusLabel}</div>
              <div class="weapon-node-tooltip">
                <div class="weapon-node-tooltip-title">${names.primary} / ${names.alt}</div>
                ${status === "damaged" ? `<div class="weapon-node-tooltip-effect">${effects.damaged}</div>` : ''}
                ${status === "broken" ? `<div class="weapon-node-tooltip-effect">${effects.broken}</div>` : ''}
                ${status === "destroyed" ? `<div class="weapon-node-tooltip-effect">OFFLINE - Weapon unusable</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// WEAPON WINDOW CSS
// Add this to your styles.css
// ----------------------------------------------------------------------------

export const WEAPON_WINDOW_STYLES = `
/* ===========================
   WEAPON WINDOW
   =========================== */

.weapon-window {
  background: linear-gradient(145deg, rgba(15, 18, 35, 0.98), rgba(25, 30, 55, 0.98));
  border: 1px solid rgba(100, 120, 180, 0.6);
  border-radius: 10px;
  padding: 12px;
  font-family: "IBM Plex Mono", monospace;
  color: #e0e4ff;
  position: relative;
  overflow: hidden;
}

.weapon-window--destroyed {
  opacity: 0.7;
  border-color: #ff4444;
}

.weapon-window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(100, 120, 180, 0.3);
}

.weapon-window-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.weapon-window-type {
  font-size: 10px;
  opacity: 0.7;
  letter-spacing: 0.12em;
}

.weapon-window-body {
  display: flex;
  gap: 16px;
}

/* Stats Panel */

.weapon-stats-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.weapon-stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.weapon-stat-label {
  font-size: 10px;
  letter-spacing: 0.1em;
  opacity: 0.8;
  width: 50px;
}

.weapon-stat-bar {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.weapon-stat-bar-track {
  flex: 1;
  height: 8px;
  background: rgba(40, 50, 80, 0.8);
  border-radius: 4px;
  overflow: hidden;
}

.weapon-stat-bar-fill {
  height: 100%;
  background: #4ade80;
  transition: width 0.2s ease-out;
}

.weapon-stat-bar-fill--ammo {
  background: #60a5fa;
}

.weapon-stat-value {
  font-size: 11px;
  min-width: 40px;
  text-align: right;
}

.weapon-jammed-badge {
  font-size: 9px;
  padding: 2px 6px;
  background: #ef4444;
  border-radius: 3px;
  animation: pulse 1s infinite;
}

/* Wear Display */

.weapon-wear-display {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.weapon-wear-pips {
  display: flex;
  gap: 3px;
}

.weapon-wear-pip {
  width: 12px;
  height: 12px;
  border: 1px solid rgba(100, 120, 180, 0.5);
  border-radius: 2px;
  background: rgba(40, 50, 80, 0.5);
}

.weapon-wear-pip--filled {
  background: #f59e0b;
  border-color: #f59e0b;
}

.weapon-wear-value {
  font-size: 11px;
  opacity: 0.8;
}

.weapon-penalty-row {
  display: flex;
  gap: 8px;
  margin-left: 58px;
}

.weapon-penalty {
  font-size: 10px;
  color: #ef4444;
}

/* Clutch Toggles */

.weapon-clutch-section {
  margin-top: 4px;
}

.weapon-clutch-btn {
  width: 100%;
  padding: 8px;
  background: rgba(30, 40, 70, 0.8);
  border: 1px solid rgba(100, 120, 180, 0.4);
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  color: #e0e4ff;
  transition: all 0.15s ease-out;
}

.weapon-clutch-btn:hover {
  background: rgba(50, 60, 100, 0.8);
  border-color: rgba(150, 170, 220, 0.6);
}

.weapon-clutch-btn--active {
  background: rgba(74, 222, 128, 0.2);
  border-color: #4ade80;
  box-shadow: 0 0 10px rgba(74, 222, 128, 0.3);
}

.weapon-clutch-label {
  font-size: 10px;
  letter-spacing: 0.12em;
  opacity: 0.7;
  margin-bottom: 2px;
}

.weapon-clutch-effect {
  font-size: 11px;
}

/* Action Buttons */

.weapon-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.weapon-action-btn {
  padding: 6px 10px;
  background: rgba(30, 40, 70, 0.8);
  border: 1px solid rgba(100, 120, 180, 0.4);
  border-radius: 4px;
  color: #e0e4ff;
  font-size: 10px;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.15s ease-out;
}

.weapon-action-btn:hover {
  background: rgba(50, 60, 100, 0.8);
  border-color: rgba(150, 170, 220, 0.6);
}

.weapon-action-btn--vent {
  border-color: rgba(239, 68, 68, 0.5);
}

.weapon-action-btn--vent:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
}

.weapon-action-cost {
  opacity: 0.6;
  font-size: 9px;
}

/* Node Diagram */

.weapon-node-diagram {
  width: 160px;
  padding: 8px;
  background: rgba(20, 25, 45, 0.8);
  border: 1px solid rgba(80, 100, 150, 0.4);
  border-radius: 8px;
}

.weapon-node-title {
  font-size: 10px;
  letter-spacing: 0.12em;
  opacity: 0.7;
  text-align: center;
  margin-bottom: 8px;
}

.weapon-node-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.weapon-node {
  position: relative;
  padding: 6px;
  background: rgba(40, 50, 80, 0.6);
  border: 1px solid rgba(100, 120, 180, 0.3);
  border-radius: 4px;
  text-align: center;
  cursor: help;
}

.weapon-node--ok {
  border-color: rgba(74, 222, 128, 0.5);
}

.weapon-node--damaged {
  background: rgba(251, 191, 36, 0.15);
  border-color: #fbbf24;
}

.weapon-node--broken {
  background: rgba(239, 68, 68, 0.15);
  border-color: #ef4444;
}

.weapon-node--destroyed {
  background: rgba(100, 100, 100, 0.2);
  border-color: #666;
  opacity: 0.5;
}

.weapon-node-id {
  font-size: 14px;
  font-weight: 700;
  color: rgba(200, 210, 255, 0.9);
}

.weapon-node-name {
  font-size: 7px;
  letter-spacing: 0.08em;
  opacity: 0.7;
  margin-top: 2px;
}

.weapon-node-status {
  font-size: 8px;
  letter-spacing: 0.1em;
  margin-top: 2px;
}

.weapon-node--ok .weapon-node-status {
  color: #4ade80;
}

.weapon-node--damaged .weapon-node-status {
  color: #fbbf24;
}

.weapon-node--broken .weapon-node-status {
  color: #ef4444;
}

.weapon-node--destroyed .weapon-node-status {
  color: #888;
}

/* Node Tooltip */

.weapon-node-tooltip {
  display: none;
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 180px;
  padding: 8px;
  background: rgba(10, 15, 30, 0.98);
  border: 1px solid rgba(100, 120, 180, 0.6);
  border-radius: 6px;
  z-index: 100;
  text-align: left;
  margin-bottom: 4px;
}

.weapon-node:hover .weapon-node-tooltip {
  display: block;
}

.weapon-node-tooltip-title {
  font-size: 10px;
  font-weight: 600;
  margin-bottom: 4px;
}

.weapon-node-tooltip-effect {
  font-size: 9px;
  line-height: 1.3;
  opacity: 0.9;
}

/* Destroyed Overlay */

.weapon-destroyed-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}

.weapon-destroyed-text {
  font-size: 18px;
  font-weight: 700;
  color: #ef4444;
  letter-spacing: 0.15em;
}

.weapon-destroyed-hint {
  font-size: 11px;
  opacity: 0.7;
  margin-top: 4px;
}

/* Pulse animation for jammed badge */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
`;

// ----------------------------------------------------------------------------
// ATTACH WEAPON WINDOW EVENT HANDLERS
// Call this after rendering the weapon window
// ----------------------------------------------------------------------------

export function attachWeaponWindowHandlers(
  container: HTMLElement,
  weaponState: WeaponRuntimeState,
  weapon: WeaponEquipment,
  onStateChange: (newState: WeaponRuntimeState) => void
): void {
  // Clutch toggle
  const clutchBtn = container.querySelector('[data-action="clutch"]');
  if (clutchBtn) {
    clutchBtn.addEventListener("click", () => {
      if (weaponState.clutchActive) {
        // Deactivate and refund wear
        onStateChange(deactivateClutch(weaponState));
      } else {
        onStateChange(activateClutch(weaponState));
      }
    });
  }

  // Double clutch toggle
  const doubleClutchBtn = container.querySelector('[data-action="double-clutch"]');
  if (doubleClutchBtn) {
    doubleClutchBtn.addEventListener("click", () => {
      if (weaponState.doubleClutchActive) {
        // Deactivate and refund wear
        onStateChange(deactivateDoubleClutch(weaponState));
      } else {
        onStateChange(activateDoubleClutch(weaponState));
      }
    });
  }

  // Quick reload
  const quickReloadBtn = container.querySelector('[data-action="quick-reload"]');
  if (quickReloadBtn) {
    quickReloadBtn.addEventListener("click", () => {
      const result = quickReload(weaponState, weapon);
      onStateChange(result.state);
      // TODO: Apply strain cost to unit
    });
  }

  // Full reload
  const fullReloadBtn = container.querySelector('[data-action="full-reload"]');
  if (fullReloadBtn) {
    fullReloadBtn.addEventListener("click", () => {
      const result = fullReload(weaponState, weapon);
      onStateChange(result.state);
      // TODO: Apply strain cost to unit
    });
  }

  // Vent
  const ventBtn = container.querySelector('[data-action="vent"]');
  if (ventBtn) {
    ventBtn.addEventListener("click", () => {
      // Full vent: reset heat to 0, but costs 10% HP
      const newState: WeaponRuntimeState = {
        ...weaponState,
        currentHeat: 0,
        isJammed: false,
      };
      onStateChange(newState);
      // TODO: Apply 10% HP damage to unit
    });
  }
}
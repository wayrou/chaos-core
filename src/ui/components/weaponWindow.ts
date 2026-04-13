import { WeaponEquipment } from "../../core/equipment";
import {
  NODE_DAMAGE_EFFECTS,
  WEAPON_NODE_NAMES,
  WeaponRuntimeState,
  getEffectiveMaxHeat,
  getWeaponHeatProfile,
  getHeatZone,
  getHeatZoneColor,
  getWeaponActionDisabledReason,
  getWeaponAmmoProfile,
  getWeaponClutches,
  getWearPenalties,
  isWeaponDestroyed,
} from "../../core/weaponSystem";

export interface WeaponWindowRenderOptions {
  instabilityWarning?: string | null;
  cardDisabledHint?: string | null;
}

function renderActionButton(
  id: string,
  label: string,
  costLabel: string,
  disabledReason: string | null,
  extraClass = "",
): string {
  return `
    <button class="weapon-action-btn ${extraClass}" id="${id}" ${disabledReason ? "disabled" : ""} title="${disabledReason ?? label}">
      ${label} <span class="weapon-action-cost">${costLabel}</span>
    </button>
  `;
}

export function renderWeaponWindow(
  weapon: WeaponEquipment,
  weaponState: WeaponRuntimeState,
  options: WeaponWindowRenderOptions = {},
): string {
  const isDestroyed = isWeaponDestroyed(weaponState);
  const heatProfile = getWeaponHeatProfile(weapon);
  const ammoProfile = getWeaponAmmoProfile(weapon);
  const heatZone = getHeatZone(weaponState, weapon);
  const heatColor = getHeatZoneColor(heatZone);
  const maxHeat = getEffectiveMaxHeat(weaponState, weapon);
  const wearPenalties = getWearPenalties(weaponState.wear);
  const clutches = getWeaponClutches(weapon);
  const hasActiveClutch = weaponState.activeClutchIds.length > 0;

  return `
    <div class="weapon-window weapon-window--battle weapon-window--heat-${heatZone} ${isDestroyed ? "weapon-window--destroyed" : ""} ${hasActiveClutch ? "weapon-window--clutch-on" : ""}">
      <div class="weapon-window-header">
        <div>
          <div class="weapon-window-title">${weapon.name}</div>
          <div class="weapon-window-type">${weapon.weaponType.toUpperCase()}${weapon.isMechanical ? " // MECHANICAL" : " // STANDARD"}</div>
        </div>
      </div>
      ${options.instabilityWarning ? `<div class="weapon-window-warning">${options.instabilityWarning}</div>` : ""}
      <div class="weapon-window-body">
        <div class="weapon-stats-panel">
          ${heatProfile ? `
            <div class="weapon-stat-row">
              <div class="weapon-stat-label">HEAT</div>
              <div class="weapon-stat-bar">
                <div class="weapon-stat-bar-track">
                  <div class="weapon-stat-bar-fill weapon-stat-bar-fill--heat weapon-stat-bar-fill--heat-zone-${heatZone}" style="width:${maxHeat > 0 ? (weaponState.currentHeat / maxHeat) * 100 : 0}%;background:${heatColor};"></div>
                </div>
                <div class="weapon-stat-value">${weaponState.currentHeat}/${maxHeat}</div>
              </div>
            </div>
          ` : ""}
          ${ammoProfile ? `
            <div class="weapon-stat-row">
              <div class="weapon-stat-label">AMMO</div>
              <div class="weapon-stat-bar">
                <div class="weapon-stat-bar-track">
                  <div class="weapon-stat-bar-fill weapon-stat-bar-fill--ammo" style="width:${ammoProfile.max > 0 ? (weaponState.currentAmmo / ammoProfile.max) * 100 : 0}%;"></div>
                </div>
                <div class="weapon-stat-value">${weaponState.currentAmmo}/${ammoProfile.max}</div>
              </div>
            </div>
          ` : ""}
          <div class="weapon-stat-row">
            <div class="weapon-stat-label">WEAR</div>
            <div class="weapon-wear-pips">
              ${[0, 1, 2, 3, 4].map((pip) => `<div class="weapon-wear-pip ${pip < weaponState.wear ? "weapon-wear-pip--filled" : ""}"></div>`).join("")}
            </div>
            <div class="weapon-stat-value">${weaponState.wear}/5</div>
          </div>
          ${weaponState.isJammed ? `<div class="weapon-window-empty-copy">JAMMED</div>` : ""}
          ${wearPenalties.accPenalty > 0 || wearPenalties.dmgPenalty > 0 ? `
            <div class="weapon-window-empty-copy">WEAR PENALTY${wearPenalties.accPenalty > 0 ? ` // -${wearPenalties.accPenalty} ACC` : ""}${wearPenalties.dmgPenalty > 0 ? ` // -${wearPenalties.dmgPenalty} DMG` : ""}</div>
          ` : ""}
          ${clutches.map((clutch, index) => {
            const active = weaponState.activeClutchIds.includes(clutch.id);
            return `
              <div class="weapon-clutch-section">
                <button
                  class="weapon-clutch-btn ${active ? "weapon-clutch-btn--active" : ""}"
                  id="weaponClutchBtn${index}"
                  data-clutch-id="${clutch.id}"
                  title="${clutch.description}"
                >
                  <div class="weapon-clutch-label">${clutch.label}${active ? " [ON]" : " [OFF]"}</div>
                  <div class="weapon-clutch-effect">${clutch.description}</div>
                </button>
              </div>
            `;
          }).join("")}
          <div class="weapon-actions">
            ${ammoProfile ? renderActionButton("quickReloadBtn", "QCK RLD", `(${ammoProfile.quickReloadStrain} STR)`, getWeaponActionDisabledReason("quick_reload", weaponState, weapon)) : ""}
            ${ammoProfile ? renderActionButton("fullReloadBtn", "FULL RLD", `(${ammoProfile.fullReloadStrain} STR)`, getWeaponActionDisabledReason("full_reload", weaponState, weapon)) : ""}
            ${renderActionButton("fieldPatchBtn", "PATCH", "(1 STR)", getWeaponActionDisabledReason("field_patch", weaponState, weapon), "weapon-action-btn--patch")}
            ${heatProfile ? renderActionButton("ventBtn", "VENT", "(10% HP)", getWeaponActionDisabledReason("vent", weaponState, weapon), "weapon-action-btn--vent") : ""}
          </div>
          ${options.cardDisabledHint ? `<div class="weapon-window-empty-copy">${options.cardDisabledHint}</div>` : ""}
        </div>
        <div class="weapon-node-scroll">
          <div class="weapon-node-diagram">
            <div class="weapon-node-title">SYSTEM STATUS</div>
            <div class="weapon-node-grid">
              ${([1, 2, 3, 4, 5, 6] as const).map((nodeId) => {
                const status = weaponState.nodes[nodeId];
                const names = WEAPON_NODE_NAMES[nodeId];
                const effects = NODE_DAMAGE_EFFECTS[nodeId];
                const statusText = status === "ok" ? "OK" : status.toUpperCase();
                const tooltip =
                  status === "damaged"
                    ? effects.damaged
                    : status === "broken"
                      ? effects.broken
                      : status === "destroyed"
                        ? "WEAPON OFFLINE"
                        : "Nominal";
                return `
                  <div class="weapon-node weapon-node--${status}" data-node="${nodeId}" title="${names.primary} / ${names.alt}: ${tooltip}">
                    <div class="weapon-node-id">${nodeId}</div>
                    <div class="weapon-node-name">${names.primary}</div>
                    <div class="weapon-node-status">${statusText}</div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

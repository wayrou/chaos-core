// ============================================================================
// STABLE SCREEN - Mount management and unit assignment
// Part of the Stable & Mounted Units system
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderBaseCampScreen } from "./BaseCampScreen";
import {
  Mount,
  OwnedMount,
  Unit,
} from "../../core/types";
import {
  getMountById,
  getPurchasableMounts,
  canUnitUseMount,
  findOwnedMount,
  findMountForUnit,
  getUnassignedMounts,
  createInitialStableState,
  unlockMount,
  assignMountToUnit,
  unassignMount,
} from "../../core/mounts";

// ----------------------------------------------------------------------------
// RENDER HELPERS
// ----------------------------------------------------------------------------

function formatMountType(type: string): string {
  const names: Record<string, string> = {
    horse: "Horse",
    warhorse: "Warhorse",
    lizard: "Lizard",
    mechanical: "Mechanical",
    beast: "Beast",
    bird: "Bird",
  };
  return names[type] || type;
}

function formatTraitName(trait: string): string {
  const names: Record<string, string> = {
    trample: "Trample",
    charge: "Charge",
    surefooted: "Surefooted",
    swift: "Swift",
    armored: "Armored",
    intimidate: "Intimidate",
    loyal: "Loyal",
    heat_resistant: "Heat Resistant",
    cold_resistant: "Cold Resistant",
    aquatic: "Aquatic",
  };
  return names[trait] || trait;
}

function formatTraitDescription(trait: string): string {
  const descriptions: Record<string, string> = {
    trample: "Deal damage when moving through enemy tiles",
    charge: "+2 damage when attacking after moving 3+ tiles",
    surefooted: "Immune to knockback/push effects",
    swift: "+1 movement on first turn",
    armored: "Reduce incoming damage by 1",
    intimidate: "Adjacent enemies have -10 ACC",
    loyal: "Cannot be dismounted by enemy effects",
    heat_resistant: "Immune to burn status",
    cold_resistant: "Immune to freeze status",
    aquatic: "Can traverse water tiles",
  };
  return descriptions[trait] || "";
}

function formatStatModifier(value: number | undefined, label: string): string {
  if (value === undefined || value === 0) return "";
  const sign = value > 0 ? "+" : "";
  const className = value > 0 ? "stat-bonus" : "stat-penalty";
  return `<span class="${className}">${sign}${value} ${label}</span>`;
}

function renderMountStats(mount: Mount): string {
  const stats = mount.statModifiers;
  const statParts: string[] = [];

  if (stats.hp) statParts.push(formatStatModifier(stats.hp, "HP"));
  if (stats.atk) statParts.push(formatStatModifier(stats.atk, "ATK"));
  if (stats.def) statParts.push(formatStatModifier(stats.def, "DEF"));
  if (stats.agi) statParts.push(formatStatModifier(stats.agi, "AGI"));
  if (stats.acc) statParts.push(formatStatModifier(stats.acc, "ACC"));
  if (stats.movement) statParts.push(formatStatModifier(stats.movement, "MOV"));

  return statParts.filter(Boolean).join(" / ") || "No stat modifiers";
}

function renderMountTraits(mount: Mount): string {
  if (mount.passiveTraits.length === 0) {
    return '<span class="stable-no-traits">No passive traits</span>';
  }

  return mount.passiveTraits
    .map(
      (trait) => `
      <span class="stable-trait" title="${formatTraitDescription(trait)}">
        ${formatTraitName(trait)}
      </span>
    `
    )
    .join("");
}

function renderMountCards(mount: Mount): string {
  if (mount.grantedCards.length === 0) {
    return '<span class="stable-no-cards">No cards granted</span>';
  }

  return mount.grantedCards
    .map((cardId) => {
      // Convert card ID to readable name
      const cardName = cardId
        .replace(/^mount_/, "")
        .replace(/_/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      return `<span class="stable-card">${cardName}</span>`;
    })
    .join("");
}

// ----------------------------------------------------------------------------
// MAIN RENDER FUNCTION
// ----------------------------------------------------------------------------

export function renderStableScreen(returnTo: "basecamp" | "field" = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();

  // Initialize stable if not present
  let stable = state.stable;
  if (!stable) {
    stable = createInitialStableState();
    updateGameState((s) => ({ ...s, stable }));
  }

  const units = state.unitsById;
  const wad = state.wad ?? 0;

  // Get available mounts for purchase
  const purchasableMounts = getPurchasableMounts(stable);

  // Get owned mounts
  const ownedMounts = stable.ownedMounts;
  const unassignedMounts = getUnassignedMounts(stable);

  // Render mount card (owned or available for purchase)
  const renderMountCard = (mount: Mount, owned: OwnedMount | null): string => {
    const isOwned = owned !== null;
    const isAssigned = owned?.assignedToUnitId !== null;
    const assignedUnit = isAssigned && owned?.assignedToUnitId
      ? units[owned.assignedToUnitId]
      : null;

    return `
      <div class="stable-mount-card ${isOwned ? "stable-mount-card--owned" : "stable-mount-card--locked"}
                                    ${isAssigned ? "stable-mount-card--assigned" : ""}"
           data-mount-id="${mount.id}"
           data-instance-id="${owned?.instanceId || ""}">
        <div class="stable-mount-header">
          <div class="stable-mount-icon">${getMountIcon(mount.mountType)}</div>
          <div class="stable-mount-title">
            <div class="stable-mount-name">${mount.name}</div>
            <div class="stable-mount-type">${formatMountType(mount.mountType)}</div>
          </div>
          ${isOwned && isAssigned && assignedUnit ? `
            <div class="stable-mount-assigned-badge">
              Assigned to ${assignedUnit.name}
            </div>
          ` : ""}
        </div>

        <div class="stable-mount-body">
          <div class="stable-mount-desc">${mount.description}</div>

          <div class="stable-mount-stats">
            <div class="stable-section-label">STAT MODIFIERS</div>
            <div class="stable-stats-list">${renderMountStats(mount)}</div>
          </div>

          <div class="stable-mount-traits">
            <div class="stable-section-label">PASSIVE TRAITS</div>
            <div class="stable-traits-list">${renderMountTraits(mount)}</div>
          </div>

          <div class="stable-mount-cards">
            <div class="stable-section-label">GRANTED CARDS</div>
            <div class="stable-cards-list">${renderMountCards(mount)}</div>
          </div>

          ${mount.restrictions.length > 0 ? `
            <div class="stable-mount-restrictions">
              <div class="stable-section-label">RESTRICTIONS</div>
              <div class="stable-restrictions-text">
                ${renderRestrictions(mount)}
              </div>
            </div>
          ` : ""}
        </div>

        <div class="stable-mount-footer">
          ${!isOwned ? `
            <button class="stable-unlock-btn"
                    data-mount-id="${mount.id}"
                    ${wad < (mount.unlockCost || 0) ? "disabled" : ""}>
              UNLOCK (${mount.unlockCost || 0} WAD)
            </button>
          ` : isAssigned ? `
            <button class="stable-unassign-btn"
                    data-instance-id="${owned?.instanceId}">
              UNASSIGN
            </button>
          ` : `
            <button class="stable-assign-btn"
                    data-instance-id="${owned?.instanceId}"
                    data-mount-id="${mount.id}">
              ASSIGN TO UNIT
            </button>
          `}
        </div>
      </div>
    `;
  };

  // Render unit selector for assignment
  const renderUnitSelector = (): string => {
    const partyUnitIds = state.partyUnitIds || [];
    const allUnitIds = Object.keys(units);

    return `
      <div class="stable-unit-selector" id="unitSelector" style="display: none;">
        <div class="stable-unit-selector-overlay"></div>
        <div class="stable-unit-selector-modal">
          <div class="stable-selector-header">
            <div class="stable-selector-title">SELECT UNIT</div>
            <button class="stable-selector-close" id="closeSelectorBtn">&times;</button>
          </div>
          <div class="stable-selector-body">
            <div class="stable-selector-section">
              <div class="stable-selector-section-title">PARTY UNITS</div>
              <div class="stable-selector-units">
                ${partyUnitIds
                  .map((id) => {
                    const unit = units[id];
                    if (!unit) return "";
                    const existingMount = findMountForUnit(stable!, id);
                    return renderUnitOption(unit, existingMount);
                  })
                  .join("")}
              </div>
            </div>
            <div class="stable-selector-section">
              <div class="stable-selector-section-title">RESERVE UNITS</div>
              <div class="stable-selector-units">
                ${allUnitIds
                  .filter((id) => !partyUnitIds.includes(id))
                  .map((id) => {
                    const unit = units[id];
                    if (!unit) return "";
                    const existingMount = findMountForUnit(stable!, id);
                    return renderUnitOption(unit, existingMount);
                  })
                  .join("")}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const renderUnitOption = (unit: Unit, existingMount: OwnedMount | null): string => {
    const mountInfo = existingMount
      ? getMountById(existingMount.mountId)
      : null;

    return `
      <div class="stable-unit-option" data-unit-id="${unit.id}">
        <div class="stable-unit-info">
          <div class="stable-unit-name">${unit.name}</div>
          <div class="stable-unit-class">${unit.unitClass || "Unknown"}</div>
        </div>
        ${mountInfo ? `
          <div class="stable-unit-current-mount">
            <span class="stable-mount-indicator">${getMountIcon(mountInfo.mountType)}</span>
            ${mountInfo.name}
          </div>
        ` : `
          <div class="stable-unit-no-mount">No Mount</div>
        `}
      </div>
    `;
  };

  // Build owned mounts section
  const ownedMountsHtml = ownedMounts
    .map((owned) => {
      const mount = getMountById(owned.mountId);
      if (!mount) return "";
      return renderMountCard(mount, owned);
    })
    .join("");

  // Build purchasable mounts section
  const purchasableMountsHtml = purchasableMounts
    .map((mount) => renderMountCard(mount, null))
    .join("");

  root.innerHTML = `
    <div class="stable-root">
      <div class="stable-header">
        <div class="stable-header-left">
          <div class="stable-title">STABLE</div>
          <div class="stable-subtitle">Manage mounts and assignments</div>
        </div>
        <div class="stable-header-right">
          <div class="stable-wad">WAD: ${wad}</div>
          <button class="stable-back-btn" id="backBtn">BACK TO BASE CAMP</button>
        </div>
      </div>

      <div class="stable-body">
        <div class="stable-section stable-owned-section">
          <div class="stable-section-header">
            <div class="stable-section-title">YOUR MOUNTS (${ownedMounts.length})</div>
            <div class="stable-section-info">${unassignedMounts.length} unassigned</div>
          </div>
          <div class="stable-mounts-grid">
            ${ownedMountsHtml || '<div class="stable-empty">No mounts owned yet. Unlock mounts below!</div>'}
          </div>
        </div>

        <div class="stable-section stable-available-section">
          <div class="stable-section-header">
            <div class="stable-section-title">AVAILABLE FOR PURCHASE</div>
          </div>
          <div class="stable-mounts-grid">
            ${purchasableMountsHtml || '<div class="stable-empty">All mounts unlocked!</div>'}
          </div>
        </div>
      </div>

      ${renderUnitSelector()}
    </div>
  `;

  // --- EVENT LISTENERS ---

  // Back button
  root.querySelector("#backBtn")?.addEventListener("click", () => {
    // renderBaseCampScreen only accepts "basecamp" | "menu", so map "field" to "basecamp"
    const navReturnTo = returnTo === "field" ? "basecamp" : returnTo;
    renderBaseCampScreen(navReturnTo);
  });

  // Unlock mount buttons
  root.querySelectorAll(".stable-unlock-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const mountId = (e.target as HTMLElement).dataset.mountId;
      if (!mountId) return;

      const mount = getMountById(mountId);
      if (!mount) return;

      const currentState = getGameState();
      const currentWad = currentState.wad ?? 0;
      const cost = mount.unlockCost || 0;

      if (currentWad < cost) {
        alert(`Not enough WAD! Need ${cost}, have ${currentWad}`);
        return;
      }

      // Deduct cost and unlock mount
      updateGameState((s) => {
        const newStable = unlockMount(s.stable || createInitialStableState(), mountId);
        return {
          ...s,
          wad: (s.wad ?? 0) - cost,
          stable: newStable,
        };
      });

      // Re-render
      renderStableScreen(returnTo);
    });
  });

  // Assign mount buttons
  let selectedMountInstanceId: string | null = null;
  let selectedMountId: string | null = null;

  root.querySelectorAll(".stable-assign-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      selectedMountInstanceId = (e.target as HTMLElement).dataset.instanceId || null;
      selectedMountId = (e.target as HTMLElement).dataset.mountId || null;

      // Show unit selector
      const selector = document.getElementById("unitSelector");
      if (selector) {
        selector.style.display = "flex";
      }
    });
  });

  // Unassign mount buttons
  root.querySelectorAll(".stable-unassign-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const instanceId = (e.target as HTMLElement).dataset.instanceId;
      if (!instanceId) return;

      updateGameState((s) => {
        if (!s.stable) return s;
        const newStable = unassignMount(s.stable, instanceId);

        // Also clear the mountInstanceId from the unit
        const mount = findOwnedMount(s.stable, instanceId);
        if (mount?.assignedToUnitId && s.unitsById[mount.assignedToUnitId]) {
          const updatedUnits = { ...s.unitsById };
          updatedUnits[mount.assignedToUnitId] = {
            ...updatedUnits[mount.assignedToUnitId],
            mountInstanceId: undefined,
          };
          return { ...s, stable: newStable, unitsById: updatedUnits };
        }

        return { ...s, stable: newStable };
      });

      // Re-render
      renderStableScreen(returnTo);
    });
  });

  // Close selector button
  root.querySelector("#closeSelectorBtn")?.addEventListener("click", () => {
    const selector = document.getElementById("unitSelector");
    if (selector) {
      selector.style.display = "none";
    }
    selectedMountInstanceId = null;
    selectedMountId = null;
  });

  // Selector overlay click to close
  root.querySelector(".stable-unit-selector-overlay")?.addEventListener("click", () => {
    const selector = document.getElementById("unitSelector");
    if (selector) {
      selector.style.display = "none";
    }
    selectedMountInstanceId = null;
    selectedMountId = null;
  });

  // Unit option click
  root.querySelectorAll(".stable-unit-option").forEach((option) => {
    option.addEventListener("click", (e) => {
      const unitId = (e.currentTarget as HTMLElement).dataset.unitId;
      if (!unitId || !selectedMountInstanceId || !selectedMountId) return;

      const currentState = getGameState();
      const unit = currentState.unitsById[unitId];
      if (!unit) return;

      const mount = getMountById(selectedMountId);
      if (!mount) return;

      // Check compatibility
      const compatibility = canUnitUseMount(unit, mount);
      if (!compatibility.canUse) {
        alert(compatibility.reason || "Unit cannot use this mount");
        return;
      }

      // Assign mount
      updateGameState((s) => {
        if (!s.stable) return s;

        const result = assignMountToUnit(s.stable, selectedMountInstanceId!, unitId, unit);
        if (result.error) {
          console.warn("[STABLE] Assignment failed:", result.error);
          return s;
        }

        // Also update the unit's mountInstanceId
        const updatedUnits = { ...s.unitsById };

        // Clear any previous mount from this unit
        Object.values(updatedUnits).forEach((u) => {
          if (u.mountInstanceId === selectedMountInstanceId) {
            updatedUnits[u.id] = { ...u, mountInstanceId: undefined };
          }
        });

        // Set new mount
        updatedUnits[unitId] = {
          ...updatedUnits[unitId],
          mountInstanceId: selectedMountInstanceId ?? undefined,
        };

        return { ...s, stable: result.stable, unitsById: updatedUnits };
      });

      // Close selector and re-render
      const selector = document.getElementById("unitSelector");
      if (selector) {
        selector.style.display = "none";
      }
      selectedMountInstanceId = null;
      selectedMountId = null;

      renderStableScreen(returnTo);
    });
  });
}

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------

function getMountIcon(mountType: string): string {
  const icons: Record<string, string> = {
    horse: "&#127943;", // Horse racing emoji
    warhorse: "&#9876;", // Crossed swords (represents war)
    lizard: "&#129422;", // Lizard emoji
    mechanical: "&#9881;", // Gear emoji
    beast: "&#128058;", // Wolf emoji
    bird: "&#128038;", // Bird emoji
  };
  return icons[mountType] || "&#128052;"; // Default horse face
}

function renderRestrictions(mount: Mount): string {
  return mount.restrictions
    .map((r) => {
      if (r.type === "unit_class") {
        if (r.allowed) {
          return `Only for: ${r.allowed.join(", ")}`;
        }
        if (r.disallowed) {
          return `Not for: ${r.disallowed.join(", ")}`;
        }
      }
      return "";
    })
    .filter(Boolean)
    .join("; ");
}

// ============================================================================
// STABLE SCREEN - Mount Management
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderBaseCampScreen } from "./BaseCampScreen";
import { 
  MOUNT_DEFINITIONS, 
  getAllMountsByClass, 
  getMountDef,
  MOUNT_GEAR_DEFINITIONS,
  getMountGearDef,
  type MountClass,
  type MountId,
  type MountInstance,
} from "../../data/mounts";
import { loadCampaignProgress, saveCampaignProgress } from "../../core/campaign";

type ReturnTo = "basecamp" | "field" | "menu";

/**
 * Render the Stable screen
 */
export function renderStableScreen(returnTo: ReturnTo = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const progress = loadCampaignProgress();
  const mountUnlocks = progress.mountUnlocks || state.mountUnlocks || {
    stableUnlocked: false,
    heavyUnlocked: false,
    supportUnlocked: false,
  };
  
  const mountInventory = state.mountInventory || [];
  const resources = state.resources || { metalScrap: 0, wood: 0, chaosShards: 0, steamComponents: 0 };
  
  // Get all units
  const units = Object.values(state.unitsById).filter(u => !u.isEnemy);
  
  // Check if stable is unlocked
  if (!mountUnlocks.stableUnlocked) {
    root.innerHTML = `
      <div class="stable-screen">
        <div class="stable-header">
          <h1>STABLE</h1>
          <button class="stable-back-btn" id="stableBackBtn">← BACK</button>
        </div>
        <div class="stable-content">
          <p class="stable-locked-message">
            The Stable is not yet available. Complete Operation 2 to unlock.
          </p>
        </div>
      </div>
    `;
    
    root.querySelector("#stableBackBtn")?.addEventListener("click", () => {
      if (returnTo === "field") {
        import("../../field/FieldScreen").then(({ renderFieldScreen, getCurrentFieldMap }) => {
          const currentMap = getCurrentFieldMap() || "base_camp";
          renderFieldScreen(currentMap);
        });
      } else {
        renderBaseCampScreen(returnTo);
      }
    });
    return;
  }
  
  // Get available mount classes
  const availableClasses: MountClass[] = ["light"];
  if (mountUnlocks.heavyUnlocked) availableClasses.push("heavy");
  if (mountUnlocks.supportUnlocked) availableClasses.push("support");
  
  // Build mount inventory display
  const mountInventoryHtml = mountInventory.length > 0
    ? mountInventory.map(mount => {
        const def = getMountDef(mount.id);
        if (!def) return "";
        const conditionColor = mount.condition > 50 ? "#4caf50" : mount.condition > 25 ? "#ff9800" : "#f44336";
        return `
          <div class="stable-mount-item" data-mount-id="${mount.id}">
            <div class="stable-mount-header">
              <span class="stable-mount-name">${def.name}</span>
              <span class="stable-mount-class">${def.class.toUpperCase()}</span>
            </div>
            <div class="stable-mount-condition">
              <span>Condition: </span>
              <span style="color: ${conditionColor}">${mount.condition}%</span>
            </div>
            <div class="stable-mount-gear">
              <div>Gear: ${mount.gear.length}/${def.gearSlots} slots</div>
              ${mount.gear.length > 0 
                ? mount.gear.map(gearId => {
                    const gearDef = getMountGearDef(gearId);
                    return gearDef ? `<div class="stable-gear-item">${gearDef.name}</div>` : "";
                  }).join("")
                : "<div class=\"stable-gear-empty\">No gear equipped</div>"
              }
              ${mount.gear.length < def.gearSlots
                ? `<select class="stable-gear-select" data-mount-id="${mount.id}">
                    <option value="">-- Add Gear --</option>
                    ${Object.values(MOUNT_GEAR_DEFINITIONS)
                      .filter(gear => !mount.gear.includes(gear.id))
                      .map(gear => `<option value="${gear.id}">${gear.name}</option>`)
                      .join("")
                    }
                   </select>`
                : ""
              }
            </div>
            <div class="stable-mount-actions">
              <button class="stable-btn stable-repair-btn" data-mount-id="${mount.id}">REPAIR</button>
            </div>
          </div>
        `;
      }).join("")
    : "<p class=\"stable-empty\">No mounts owned yet.</p>";
  
  // Build unit assignment display
  const unitAssignmentHtml = units.map(unit => {
    const equippedMountId = unit.equippedMountId;
    const mountDef = equippedMountId ? getMountDef(equippedMountId) : null;
    const mountInstance = equippedMountId ? mountInventory.find(m => m.id === equippedMountId) : null;
    
    return `
      <div class="stable-unit-item" data-unit-id="${unit.id}">
        <div class="stable-unit-header">
          <span class="stable-unit-name">${unit.name}</span>
        </div>
        <div class="stable-unit-mount">
          ${mountDef 
            ? `<span>Mount: ${mountDef.name} (${mountInstance?.condition ?? 0}%)</span>`
            : "<span>No mount assigned</span>"
          }
        </div>
        <div class="stable-unit-actions">
          <select class="stable-mount-select" data-unit-id="${unit.id}">
            <option value="">-- No Mount --</option>
            ${mountInventory
              .filter(m => {
                const mDef = getMountDef(m.id);
                if (!mDef) return false;
                if (!availableClasses.includes(mDef.class)) return false;
                if (m.condition <= 0) return false; // Can't use broken mounts
                return true;
              })
              .map(m => {
                const mDef = getMountDef(m.id);
                return `<option value="${m.id}" ${m.id === equippedMountId ? "selected" : ""}>${mDef?.name} (${m.condition}%)</option>`;
              })
              .join("")
            }
          </select>
        </div>
      </div>
    `;
  }).join("");
  
  root.innerHTML = `
    <div class="stable-screen">
      <div class="stable-header">
        <h1>STABLE</h1>
        <button class="stable-back-btn" id="stableBackBtn">← BACK</button>
      </div>
      
      <div class="stable-resources">
        <div class="resource-item"><span class="resource-label">METAL</span><span class="resource-value">${resources.metalScrap}</span></div>
        <div class="resource-item"><span class="resource-label">WOOD</span><span class="resource-value">${resources.wood}</span></div>
        <div class="resource-item"><span class="resource-label">SHARDS</span><span class="resource-value">${resources.chaosShards}</span></div>
      </div>
      
      <div class="stable-content">
        <div class="stable-section">
          <h2>MOUNT INVENTORY</h2>
          <div class="stable-mount-list">
            ${mountInventoryHtml}
          </div>
        </div>
        
        <div class="stable-section">
          <h2>UNIT ASSIGNMENTS</h2>
          <div class="stable-unit-list">
            ${unitAssignmentHtml}
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Event listeners
  root.querySelector("#stableBackBtn")?.addEventListener("click", () => {
    if (returnTo === "field") {
      import("../../field/FieldScreen").then(({ renderFieldScreen, getCurrentFieldMap }) => {
        const currentMap = getCurrentFieldMap() || "base_camp";
        renderFieldScreen(currentMap);
      });
    } else {
      renderBaseCampScreen(returnTo);
    }
  });
  
  // Mount assignment
  root.querySelectorAll(".stable-mount-select").forEach(select => {
    select.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement;
      const unitId = target.dataset.unitId;
      const mountId = target.value || undefined;
      
      if (!unitId) return;
      
      updateGameState(s => {
        const unit = s.unitsById[unitId];
        if (!unit) return s;
        
        return {
          ...s,
          unitsById: {
            ...s.unitsById,
            [unitId]: {
              ...unit,
              equippedMountId: mountId,
            },
          },
        };
      });
      
      // Re-render to show updated assignment
      renderStableScreen(returnTo);
    });
  });
  
  // Gear selection
  root.querySelectorAll(".stable-gear-select").forEach(select => {
    select.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement;
      const mountId = target.dataset.mountId;
      const gearId = target.value;
      
      if (!mountId || !gearId) return;
      
      updateGameState(s => {
        const inventory = s.mountInventory || [];
        const updated = inventory.map(m => {
          if (m.id === mountId) {
            const def = getMountDef(mountId);
            if (def && m.gear.length < def.gearSlots) {
              return { ...m, gear: [...m.gear, gearId] };
            }
          }
          return m;
        });
        
        return {
          ...s,
          mountInventory: updated,
        };
      });
      
      renderStableScreen(returnTo);
    });
  });
  
  // Repair buttons
  root.querySelectorAll(".stable-repair-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const mountId = target.dataset.mountId;
      if (!mountId) return;
      
      const mount = mountInventory.find(m => m.id === mountId);
      if (!mount) return;
      
      // Repair cost: 5 metal scrap per 10 condition points
      const conditionNeeded = 100 - mount.condition;
      const repairCost = Math.ceil(conditionNeeded / 10) * 5;
      
      if (resources.metalScrap < repairCost) {
        alert(`Not enough Metal Scrap. Need ${repairCost}, have ${resources.metalScrap}.`);
        return;
      }
      
      if (confirm(`Repair ${getMountDef(mountId)?.name} to 100%? Cost: ${repairCost} Metal Scrap`)) {
        updateGameState(s => {
          const updatedInventory = (s.mountInventory || []).map(m => 
            m.id === mountId ? { ...m, condition: 100 } : m
          );
          
          return {
            ...s,
            mountInventory: updatedInventory,
            resources: {
              ...s.resources,
              metalScrap: s.resources.metalScrap - repairCost,
            },
          };
        });
        
        renderStableScreen(returnTo);
      }
    });
  });
}


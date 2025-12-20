// ============================================================================
// LOADOUT SCREEN - Headline 14c
// Pre-operation loadout management with auto-populated forward locker
// Flow: Operation Select → THIS SCREEN → Floor Screen
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderOperationMapScreen } from "./OperationMapScreen";
import { renderOperationSelectScreen } from "./OperationSelectScreen";
import { renderRosterScreen } from "./RosterScreen";
import { getAllStarterEquipment, getAllModules, Equipment } from "../../core/equipment";
import { computeLoad, computeLoadPenaltyFlags, transferItem, MULE_CLASS_CAPS } from "../../core/inventory";
import { InventoryState, InventoryItem } from "../../core/types";

type InventoryBin = "forwardLocker" | "baseStorage";

// ============================================================================
// TYPES
// ============================================================================

interface PartyUnitSummary {
  id: string;
  name: string;
  unitClass: string;
  equippedItems: Equipment[];
  totalMass: number;
  totalBulk: number;
  totalPower: number;
}

// ============================================================================
// MAIN RENDER
// ============================================================================

export function renderLoadoutScreen(): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const operation = state.operation;

  if (!operation) {
    console.error("[LOADOUT] No active operation");
    renderOperationSelectScreen("field");
    return;
  }

  const equipmentById = (state as any).equipmentById || getAllStarterEquipment();
  // Future: modulesById can be used for gear slot calculations
  void getAllModules();

  // Build party unit summaries with equipment
  const partyUnits: PartyUnitSummary[] = state.partyUnitIds.map(unitId => {
    const unit = state.unitsById[unitId];
    if (!unit) return null;

    const loadout = (unit as any).loadout || {};
    const equippedItems: Equipment[] = [];
    let totalMass = 0;
    let totalBulk = 0;
    let totalPower = 0;

    // Collect equipped items
    const slots = ["weapon", "helmet", "chestpiece", "accessory1", "accessory2"];
    for (const slot of slots) {
      const equipId = loadout[slot];
      if (equipId && equipmentById[equipId]) {
        const equip = equipmentById[equipId];
        equippedItems.push(equip);
        // Estimate load values (equipment doesn't have mass/bulk/power, so use defaults)
        totalMass += 2; // Default mass per equipment
        totalBulk += 1; // Default bulk per equipment
        totalPower += 1; // Default power per equipment
      }
    }

    return {
      id: unit.id,
      name: unit.name,
      unitClass: (unit as any).unitClass || "freelancer",
      equippedItems,
      totalMass,
      totalBulk,
      totalPower,
    };
  }).filter(Boolean) as PartyUnitSummary[];

  // Calculate total forward locker load from all party equipment
  const totalEquipmentMass = partyUnits.reduce((sum, u) => sum + u.totalMass, 0);
  const totalEquipmentBulk = partyUnits.reduce((sum, u) => sum + u.totalBulk, 0);
  const totalEquipmentPower = partyUnits.reduce((sum, u) => sum + u.totalPower, 0);

  // Get inventory state
  const inv: InventoryState = state.inventory;
  const forwardLocker: InventoryItem[] = inv.forwardLocker ?? [];
  const baseStorage: InventoryItem[] = inv.baseStorage ?? [];
  const load = computeLoad(inv);
  const penalties = computeLoadPenaltyFlags(inv);

  // Add equipment load to forward locker load
  const effectiveLoad = {
    mass: load.mass + totalEquipmentMass,
    bulk: load.bulk + totalEquipmentBulk,
    power: load.power + totalEquipmentPower,
  };

  // Get current MULE class caps directly from MULE_CLASS_CAPS (always up-to-date)
  const muleCaps = MULE_CLASS_CAPS[inv.muleClass];
  const caps = {
    mass: muleCaps.massKg,
    bulk: muleCaps.bulkBu,
    power: muleCaps.powerW,
  };

  root.innerHTML = `
    <div class="loadout-screen-root ard-noise">
      <div class="loadout-screen-card">
        <!-- Header - Adventure Gothic Panel -->
        <div class="loadout-screen-header">
          <div class="loadout-screen-header-left">
            <h1 class="loadout-screen-title">OPERATION LOADOUT</h1>
            <div class="loadout-screen-subtitle">
              SCROLLINK OS // ${operation.codename} • ${operation.floors.length} FLOORS
            </div>
          </div>
          <div class="loadout-screen-header-right">
            <button class="loadout-screen-back-btn" id="backBtn">
              <span class="btn-icon">←</span>
              <span class="btn-text">CANCEL</span>
            </button>
            <button class="loadout-screen-proceed-btn" id="proceedBtn" ${partyUnits.length === 0 ? 'disabled' : ''}>
              <span class="btn-text">PROCEED</span>
              <span class="btn-icon">→</span>
            </button>
          </div>
        </div>

        <div class="loadout-screen-body">
          <div class="loadout-screen-left">
            <div class="loadout-screen-section">
              <div class="loadout-screen-section-title">FORWARD LOCKER CAPACITY</div>
              <div class="loadout-screen-capacity-info">
                Equipment from your party auto-populates the forward locker.
              </div>
              ${renderCapacityBar("MASS", effectiveLoad.mass, caps.mass, "kg")}
              ${renderCapacityBar("BULK", effectiveLoad.bulk, caps.bulk, "bu")}
              ${renderCapacityBar("POWER", effectiveLoad.power, caps.power, "w")}
              
              ${(penalties.massOver || penalties.bulkOver || penalties.powerOver) ? `
                <div class="loadout-screen-warning">
                  ⚠️ OVERLOAD WARNING: Movement penalties will apply!
                </div>
              ` : ''}
            </div>

            <div class="loadout-screen-section">
              <div class="loadout-screen-section-title">OPERATION SUMMARY</div>
              <div class="loadout-screen-op-details">
                <div class="loadout-screen-op-detail">
                  <span class="loadout-screen-op-label">Codename:</span>
                  <span class="loadout-screen-op-value">${operation.codename}</span>
                </div>
                <div class="loadout-screen-op-detail">
                  <span class="loadout-screen-op-label">Floors:</span>
                  <span class="loadout-screen-op-value">${operation.floors.length}</span>
                </div>
                <div class="loadout-screen-op-detail">
                  <span class="loadout-screen-op-label">Party Size:</span>
                  <span class="loadout-screen-op-value">${partyUnits.length} Units</span>
                </div>
              </div>
            </div>
          </div>

          <div class="loadout-screen-right">
            <div class="loadout-screen-section">
              <div class="loadout-screen-section-title">DEPLOYED UNITS</div>
              <div class="loadout-screen-party">
                ${partyUnits.length === 0 ? `
                  <div class="loadout-screen-empty">
                    No units in party! Add units from the Roster.
                  </div>
                ` : partyUnits.map(unit => renderPartyUnit(unit)).join('')}
              </div>
              <button class="loadout-screen-manage-btn" id="manageUnitsBtn">
                👥 MANAGE UNITS
              </button>
            </div>
          </div>
        </div>

        <div class="loadout-screen-inventory-section">
          <div class="loadout-screen-inventory-title">INVENTORY MANAGEMENT</div>
          <div class="loadout-screen-inventory-columns">
            <div class="inventory-column" data-bin="baseStorage">
              <div class="inventory-column-header">
                <div class="inventory-column-title">BASE CAMP STORAGE</div>
                <div class="inventory-column-subtitle">
                  Stored back at camp. No risk, no load penalties.
                </div>
              </div>
              <div class="inventory-column-body" data-bin="baseStorage">
                ${
                  baseStorage.length === 0
                    ? `<div class="inv-empty">[ EMPTY ]</div>`
                    : baseStorage
                        .map((i) => renderInventoryItem(i, "baseStorage"))
                        .join("")
                }
              </div>
            </div>

            <div class="inventory-column" data-bin="forwardLocker">
              <div class="inventory-column-header">
                <div class="inventory-column-title">FORWARD LOCKER</div>
                <div class="inventory-column-subtitle">
                  Items carried into the dungeon. Count against load.
                </div>
              </div>
              <div class="inventory-column-body" data-bin="forwardLocker">
                ${
                  forwardLocker.length === 0
                    ? `<div class="inv-empty">[ EMPTY ]</div>`
                    : forwardLocker
                        .map((i) => renderInventoryItem(i, "forwardLocker"))
                        .join("")
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  attachLoadoutListeners();
}

// ============================================================================
// RENDER HELPERS
// ============================================================================

function renderCapacityBar(label: string, current: number, cap: number, unit: string): string {
  const pct = current / cap;
  let color = "#52a0ff";
  let isFlashing = false;

  if (pct >= 0.8 && pct < 1) {
    color = "#e4d96f";
  } else if (pct >= 1 && pct < 1.2) {
    color = "#ff5c5c";
  } else if (pct >= 1.2) {
    color = "#ff3030";
    isFlashing = true;
  }

  const fillWidth = Math.min(pct * 100, 150);

  return `
    <div class="loadout-screen-bar">
      <div class="loadout-screen-bar-label">${label}</div>
      <div class="loadout-screen-bar-track">
        <div class="loadout-screen-bar-fill ${isFlashing ? 'loadout-screen-bar-fill--flashing' : ''}"
             style="width: ${fillWidth}%; background: ${color};">
        </div>
      </div>
      <div class="loadout-screen-bar-value">${current.toFixed(0)} / ${cap} ${unit}</div>
    </div>
  `;
}

function renderPartyUnit(unit: PartyUnitSummary): string {
  const classDisplay = formatClassName(unit.unitClass);
  const equipCount = unit.equippedItems.length;

  return `
    <div class="loadout-screen-unit">
      <div class="loadout-screen-unit-header">
        <div class="loadout-screen-unit-name">${unit.name}</div>
        <div class="loadout-screen-unit-class">${classDisplay}</div>
      </div>
      <div class="loadout-screen-unit-equipment">
        ${equipCount === 0 ? `
          <span class="loadout-screen-unit-noequip">No equipment</span>
        ` : unit.equippedItems.map(eq => `
          <span class="loadout-screen-unit-equip">${eq.name}</span>
        `).join('')}
      </div>
      <div class="loadout-screen-unit-load">
        Load: ${unit.totalMass}kg / ${unit.totalBulk}bu / ${unit.totalPower}w
      </div>
    </div>
  `;
}

function formatClassName(cls: string): string {
  const names: Record<string, string> = {
    squire: "Squire",
    sentry: "Sentry",
    paladin: "Paladin",
    watchGuard: "Watch Guard",
    ranger: "Ranger",
    hunter: "Hunter",
    bowmaster: "Bowmaster",
    trapper: "Trapper",
    magician: "Magician",
    cleric: "Cleric",
    wizard: "Wizard",
    chaosmancer: "Chaosmancer",
    thief: "Thief",
    scout: "Scout",
    shadow: "Shadow",
    trickster: "Trickster",
    academic: "Academic",
    freelancer: "Freelancer",
  };
  return names[cls] || cls;
}

function renderInventoryItem(item: InventoryItem, bin: InventoryBin): string {
  return `
    <div class="inv-item"
         draggable="true"
         data-id="${item.id}"
         data-bin="${bin}">
      <div class="inv-item-header">
        <div class="inv-item-name">${item.name}</div>
        <div class="inv-item-qty">x${item.quantity}</div>
      </div>
      <div class="inv-item-kind">${item.kind.toUpperCase()}</div>
      <div class="inv-item-stats">
        <span>${item.massKg}kg</span>
        <span>${item.bulkBu}bu</span>
        <span>${item.powerW}w</span>
      </div>
    </div>
  `;
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function attachLoadoutListeners(): void {
  const root = document.getElementById("app");
  if (!root) return;

  // Back button - cancel operation
  root.querySelector("#backBtn")?.addEventListener("click", () => {
    // Clear operation and return to operation select
    updateGameState(prev => ({
      ...prev,
      operation: null,
      phase: "shell",
    }));
    renderOperationSelectScreen("field");
  });

  // Manage units button
  root.querySelector("#manageUnitsBtn")?.addEventListener("click", () => {
    // Open roster screen, will return to loadout
    renderRosterScreen("loadout");
  });

  // Proceed button
  root.querySelector("#proceedBtn")?.addEventListener("click", () => {
    const state = getGameState();
    if (state.partyUnitIds.length === 0) {
      alert("You need at least one unit in your party to proceed!");
      return;
    }

    // Auto-populate forward locker from equipped items
    const equipmentById = (state as any).equipmentById || getAllStarterEquipment();
    let totalMass = 0;
    let totalBulk = 0;
    let totalPower = 0;

    // Calculate total load from all party equipment
    state.partyUnitIds.forEach(unitId => {
      const unit = state.unitsById[unitId];
      if (!unit) return;

      const loadout = (unit as any).loadout || {};
      const slots = ["weapon", "helmet", "chestpiece", "accessory1", "accessory2"];
      
      for (const slot of slots) {
        const equipId = loadout[slot];
        if (equipId && equipmentById[equipId]) {
          // Add estimated load values
          totalMass += 2;
          totalBulk += 1;
          totalPower += 1;
        }
      }
    });

    // Update phase and auto-populate forward locker capacity usage
    updateGameState(prev => ({
      ...prev,
      phase: "operation",
      inventory: {
        ...prev.inventory,
        // Store the equipment load contribution for reference
        equipmentMassUsed: totalMass,
        equipmentBulkUsed: totalBulk,
        equipmentPowerUsed: totalPower,
      } as any,
    }));

    renderOperationMapScreen();
  });

  // ------------------------------
  // INVENTORY TRANSFER FUNCTIONALITY
  // ------------------------------
  
  // Click-to-transfer
  const itemEls = root.querySelectorAll<HTMLElement>(".inv-item");
  itemEls.forEach((el) => {
    el.style.cursor = "pointer";

    el.addEventListener("click", () => {
      const itemId = el.dataset.id;
      const fromBinRaw = el.dataset.bin as InventoryBin | undefined;
      if (!itemId || !fromBinRaw) return;

      const fromBin = fromBinRaw;
      const toBin: InventoryBin =
        fromBin === "forwardLocker" ? "baseStorage" : "forwardLocker";

      updateGameState((prev) => ({
        ...prev,
        inventory: transferItem(prev.inventory, fromBin, toBin, itemId),
      }));

      renderLoadoutScreen();
    });
  });

  // Drag & Drop
  itemEls.forEach((el) => {
    el.addEventListener("dragstart", (event: DragEvent) => {
      if (!event.dataTransfer) return;
      const itemId = el.dataset.id;
      const fromBin = el.dataset.bin as InventoryBin | undefined;
      if (!itemId || !fromBin) return;

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", itemId);
      event.dataTransfer.setData("itemId", itemId);
      event.dataTransfer.setData("fromBin", fromBin);
    });
  });

  const columnBodies = root.querySelectorAll<HTMLElement>(".inventory-column-body");
  columnBodies.forEach((colBody) => {
    colBody.addEventListener("dragover", (event: DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      colBody.classList.add("inventory-column-body--dragover");
    });

    colBody.addEventListener("dragleave", () => {
      colBody.classList.remove("inventory-column-body--dragover");
    });

    colBody.addEventListener("drop", (event: DragEvent) => {
      event.preventDefault();
      colBody.classList.remove("inventory-column-body--dragover");
      if (!event.dataTransfer) return;

      const itemId =
        event.dataTransfer.getData("itemId") ||
        event.dataTransfer.getData("text/plain");
      const fromBinRaw = event.dataTransfer.getData("fromBin");
      const toBinRaw = colBody.dataset.bin;

      if (!itemId || !fromBinRaw || !toBinRaw) return;

      const fromBin = fromBinRaw as InventoryBin;
      const toBin = toBinRaw as InventoryBin;

      if (fromBin === toBin) return;
      if (
        (fromBin !== "forwardLocker" && fromBin !== "baseStorage") ||
        (toBin !== "forwardLocker" && toBin !== "baseStorage")
      ) {
        return;
      }

      updateGameState((prev) => ({
        ...prev,
        inventory: transferItem(prev.inventory, fromBin, toBin, itemId),
      }));

      renderLoadoutScreen();
    });
  });
}


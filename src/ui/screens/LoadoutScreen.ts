// ============================================================================
// LOADOUT SCREEN - Headline 14c
// Pre-operation loadout management with auto-populated forward locker
// Flow: Operation Select → THIS SCREEN → Floor Screen
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderActiveOperationSurface } from "./activeOperationFlow";
import { renderOperationSelectScreen } from "./OperationSelectScreen";
import { renderRosterScreen } from "./RosterScreen";
import { getAllStarterEquipment, getAllModules, Equipment } from "../../core/equipment";
import { computeLoad, computeLoadPenaltyFlags, MULE_CLASS_CAPS } from "../../core/inventory";
import { InventoryState, InventoryItem } from "../../core/types";
import {
  buildOwnedBaseStorageItems,
  isPartyAutoStagedLockerItem,
  moveOwnedItemToBaseStorage,
  moveOwnedItemToForwardLocker,
  PARTY_UNIT_FORWARD_LOCKER_BULK_BU,
  PARTY_UNIT_FORWARD_LOCKER_MASS_KG,
  PARTY_UNIT_FORWARD_LOCKER_POWER_W,
  syncForwardLockerStateForUnitIds,
  syncPartyForwardLockerState,
} from "../../core/loadoutInventory";
import { getBusyDispatchUnitIds } from "../../core/dispatchSystem";
import { buildTheaterDeploymentLaunchPreview, TheaterDeploymentLaunchPreview } from "../../core/theaterDeploymentPreset";
import {
  buildInventoryFolderTransferSummaries,
  InventoryFolderTransferSummary,
  moveInventoryFolderToBaseStorage,
  moveInventoryFolderToForwardLocker,
} from "../../core/inventoryFolders";
import { abandonRun } from "../../core/campaignManager";
import { clearControllerContext, updateFocusableElements } from "../../core/controllerSupport";

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

interface DeployedSquadSummary {
  squadId: string;
  displayName: string;
  icon: string;
  colorKey: string;
  units: PartyUnitSummary[];
}

// ============================================================================
// MAIN RENDER
// ============================================================================

export function renderLoadoutScreen(): void {
  const root = document.getElementById("app");
  if (!root) return;
  document.body.setAttribute("data-screen", "loadout");
  clearControllerContext();

  const rawState = getGameState();
  const rawOperation = rawState.operation;
  const isTheaterOperation = Boolean(rawOperation?.theater);
  const initialTheaterPreview = isTheaterOperation ? buildTheaterDeploymentLaunchPreview(rawState) : null;
  const initialDeployUnitIds = initialTheaterPreview?.deployUnitIds ?? rawState.partyUnitIds;
  const state = isTheaterOperation
    ? syncForwardLockerStateForUnitIds(rawState, initialDeployUnitIds)
    : syncPartyForwardLockerState(rawState);
  const theaterPreview = isTheaterOperation ? buildTheaterDeploymentLaunchPreview(state) : null;
  const operation = state.operation;

  if (!operation) {
    console.error("[LOADOUT] No active operation");
    renderOperationSelectScreen("field");
    return;
  }

  const equipmentById = (state as any).equipmentById || getAllStarterEquipment();
  const theaterName = operation.theater?.definition.name ?? "THEATER COMMAND";
  const deployUnitIds = theaterPreview?.deployUnitIds ?? state.partyUnitIds;
  // Future: modulesById can be used for gear slot calculations
  void getAllModules();

  // Build party unit summaries with equipment
  const partyUnits: PartyUnitSummary[] = deployUnitIds.map(unitId => {
    const unit = state.unitsById[unitId];
    if (!unit) return null;

    const loadout = (unit as any).loadout || {};
    const equippedItems: Equipment[] = [];
    let totalMass = PARTY_UNIT_FORWARD_LOCKER_MASS_KG;
    let totalBulk = PARTY_UNIT_FORWARD_LOCKER_BULK_BU;
    let totalPower = PARTY_UNIT_FORWARD_LOCKER_POWER_W;

    // Collect equipped items
    const slots = [
      loadout.primaryWeapon ?? loadout.weapon ?? null,
      loadout.secondaryWeapon ?? null,
      loadout.helmet ?? null,
      loadout.chestpiece ?? null,
      loadout.accessory1 ?? null,
      loadout.accessory2 ?? null,
    ];
    for (const slot of slots) {
      const equipId = typeof slot === "string" ? slot : null;
      if (equipId && equipmentById[equipId]) {
        const equip = equipmentById[equipId];
        equippedItems.push(equip);
        const inventoryProfile = equip.inventory;
        totalMass += inventoryProfile?.massKg ?? 2;
        totalBulk += inventoryProfile?.bulkBu ?? 1;
        totalPower += inventoryProfile?.powerW ?? 1;
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
  const partyUnitsById = new Map(partyUnits.map((unit) => [unit.id, unit] as const));
  const deployedSquads: DeployedSquadSummary[] = theaterPreview?.squads.map((squad) => ({
    squadId: squad.squadId,
    displayName: squad.displayName,
    icon: squad.icon,
    colorKey: squad.colorKey,
    units: squad.unitIds
      .map((unitId) => partyUnitsById.get(unitId) ?? null)
      .filter((unit): unit is PartyUnitSummary => Boolean(unit)),
  })) ?? [];

  // Get inventory state
  const inv: InventoryState = state.inventory;
  const forwardLocker: InventoryItem[] = inv.forwardLocker ?? [];
  const baseStorage: InventoryItem[] = buildOwnedBaseStorageItems(state);
  const folderSummaries = buildInventoryFolderTransferSummaries(state);
  const baseStorageFolders = folderSummaries.filter((folder) => folder.baseStorageItems.length > 0);
  const forwardLockerFolders = folderSummaries.filter((folder) => folder.forwardLockerItems.length > 0);
  const load = computeLoad(inv);
  const penalties = computeLoadPenaltyFlags(inv);

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
              S/COM_OS // ${operation.codename} // ${theaterName}
            </div>
          </div>
          <div class="loadout-screen-header-right">
            <button class="loadout-screen-back-btn" id="backBtn">
              <span class="btn-icon">←</span>
              <span class="btn-text">CANCEL</span>
            </button>
            <button class="loadout-screen-proceed-btn" id="proceedBtn" ${deployUnitIds.length === 0 ? 'disabled' : ''}>
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
                ${isTheaterOperation
                  ? "Theater deployment squads and their equipped gear auto-populate the forward locker."
                  : "Party units and their equipped gear auto-populate the forward locker."}
              </div>
              ${renderCapacityBar("MASS", load.mass, caps.mass, "kg")}
              ${renderCapacityBar("BULK", load.bulk, caps.bulk, "bu")}
              ${renderCapacityBar("POWER", load.power, caps.power, "w")}
              
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
                  <span class="loadout-screen-op-label">Theater:</span>
                  <span class="loadout-screen-op-value">${theaterName}</span>
                </div>
                <div class="loadout-screen-op-detail">
                  <span class="loadout-screen-op-label">${isTheaterOperation ? "Deploy Size:" : "Party Size:"}</span>
                  <span class="loadout-screen-op-value">${deployUnitIds.length} Units</span>
                </div>
              </div>
            </div>
          </div>

          <div class="loadout-screen-right">
            <div class="loadout-screen-section">
              <div class="loadout-screen-section-title">${isTheaterOperation ? "DEPLOYMENT SQUADS" : "DEPLOYED UNITS"}</div>
              ${theaterPreview ? renderTheaterDeploymentWarning(theaterPreview) : ""}
              <div class="loadout-screen-party">
                ${deployUnitIds.length === 0 ? `
                  <div class="loadout-screen-empty">
                    ${isTheaterOperation
                      ? "No valid theater deployment units. Update your roster squads before launching."
                      : "No units in party! Add units from the Roster."}
                  </div>
                ` : isTheaterOperation
                  ? deployedSquads.map((squad) => renderDeployedSquad(squad)).join("")
                  : partyUnits.map(unit => renderPartyUnit(unit)).join('')}
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
                  baseStorageFolders.length > 0
                    ? `
                      <div class="loadout-folder-list">
                        ${baseStorageFolders
                          .map((folder) => renderInventoryFolderCard(folder, "baseStorage"))
                          .join("")}
                      </div>
                    `
                    : ""
                }
                ${
                  baseStorage.length === 0
                    ? (baseStorageFolders.length === 0 ? `<div class="inv-empty">[ EMPTY ]</div>` : "")
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
                  forwardLockerFolders.length > 0
                    ? `
                      <div class="loadout-folder-list">
                        ${forwardLockerFolders
                          .map((folder) => renderInventoryFolderCard(folder, "forwardLocker"))
                          .join("")}
                      </div>
                    `
                    : ""
                }
                ${
                  forwardLocker.length === 0
                    ? (forwardLockerFolders.length === 0 ? `<div class="inv-empty">[ EMPTY ]</div>` : "")
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
  updateFocusableElements();
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

function renderDeployedSquad(squad: DeployedSquadSummary): string {
  return `
    <div class="loadout-screen-squad" data-loadout-squad-id="${squad.squadId}">
      <div class="loadout-screen-squad-header">
        <div class="loadout-screen-squad-title">
          <span class="loadout-screen-squad-icon">${squad.icon}</span>
          <span>${squad.displayName}</span>
        </div>
        <div class="loadout-screen-squad-count">${squad.units.length} UNIT${squad.units.length === 1 ? "" : "S"}</div>
      </div>
      <div class="loadout-screen-squad-units">
        ${squad.units.map((unit) => renderPartyUnit(unit)).join("")}
      </div>
    </div>
  `;
}

function renderTheaterDeploymentWarning(preview: TheaterDeploymentLaunchPreview): string {
  if (preview.skippedUnits.length <= 0) {
    return "";
  }

  const reasonLabels: Record<string, string> = {
    dispatched: "on Dispatch",
    missing: "missing",
    duplicate: "duplicated",
    over_cap: "over squad cap",
  };
  const reasonCounts = preview.skippedUnits.reduce<Record<string, number>>((acc, skippedUnit) => {
    acc[skippedUnit.reason] = (acc[skippedUnit.reason] ?? 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(reasonCounts)
    .map(([reason, count]) => `${count} ${reasonLabels[reason] ?? reason}`)
    .join(" // ");
  const impactedUnits = preview.skippedUnits
    .slice(0, 4)
    .map((skippedUnit) => skippedUnit.unitName ?? skippedUnit.unitId)
    .join(", ");
  const overflowCount = Math.max(0, preview.skippedUnits.length - 4);

  return `
    <div class="loadout-screen-warning loadout-screen-warning--squads">
      <strong>Launch Preview Adjusted</strong>
      <div>${summary}</div>
      <div>${impactedUnits}${overflowCount > 0 ? ` +${overflowCount} more` : ""}</div>
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
  const isLocked = isPartyAutoStagedLockerItem(item);
  const iconMarkup = item.iconPath
    ? `<img src="${item.iconPath}" alt="${item.name}" style="width:36px;height:36px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);" />`
    : "";
  const noteMarkup = isLocked
    ? `<div class="inv-item-note">${item.kind === "unit" ? "DEPLOY UNIT // AUTO-STAGED" : "EQUIPPED GEAR // AUTO-STAGED"}</div>`
    : "";

  return `
    <div class="inv-item${isLocked ? " inv-item--locked" : ""}"
         draggable="${isLocked ? "false" : "true"}"
         data-id="${item.id}"
         data-bin="${bin}"
         data-locked="${isLocked ? "true" : "false"}">
      <div class="inv-item-header">
        ${iconMarkup}
        <div class="inv-item-name">${item.name}</div>
        <div class="inv-item-qty">x${item.quantity}</div>
      </div>
      <div class="inv-item-kind">${item.kind.toUpperCase()}</div>
      ${noteMarkup}
      <div class="inv-item-stats">
        <span>${item.massKg}kg</span>
        <span>${item.bulkBu}bu</span>
        <span>${item.powerW}w</span>
      </div>
    </div>
  `;
}

function renderInventoryFolderCard(folder: InventoryFolderTransferSummary, bin: InventoryBin): string {
  const items = bin === "forwardLocker" ? folder.forwardLockerItems : folder.baseStorageItems;
  const mass = bin === "forwardLocker" ? folder.lockerMassKg : folder.baseMassKg;
  const bulk = bin === "forwardLocker" ? folder.lockerBulkBu : folder.baseBulkBu;
  const power = bin === "forwardLocker" ? folder.lockerPowerW : folder.basePowerW;
  const buttonLabel = bin === "forwardLocker" ? "RETURN FOLDER" : "STAGE FOLDER";
  const previewNames = items.slice(0, 3).map((item) => item.name).join(", ");
  const moreCount = Math.max(items.length - 3, 0);

  return `
    <div
      class="loadout-folder-card"
      draggable="true"
      data-folder-id="${folder.id}"
      data-bin="${bin}"
      style="--loadout-folder-color:${folder.color};"
    >
      <div class="loadout-folder-card-header">
        <div class="loadout-folder-card-name">${folder.name}</div>
        <div class="loadout-folder-card-count">${folder.entryCount} ASSETS</div>
      </div>
      <div class="loadout-folder-card-preview">
        ${previewNames || "No deployable items in this section"}${moreCount > 0 ? ` +${moreCount} more` : ""}
      </div>
      <div class="loadout-folder-card-stats">
        <span>${mass}kg</span>
        <span>${bulk}bu</span>
        <span>${power}w</span>
      </div>
      <div class="loadout-folder-card-action">${buttonLabel}</div>
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
    const launchSource = getGameState().operation?.launchSource;
    // Clear operation and return to operation select
    if (launchSource === "comms") {
      try {
        abandonRun();
      } catch (error) {
        console.warn("[LOADOUT] abandon comms run failed", error);
      }
    }

    updateGameState(prev => ({
      ...prev,
      operation: null,
      phase: "shell",
    }));

    if (launchSource === "atlas") {
      renderOperationSelectScreen("esc");
      return;
    }

    if (launchSource === "comms") {
      import("./CommsArrayScreen").then(({ renderCommsArrayScreen }) => {
        renderCommsArrayScreen("field");
      });
      return;
    }

    renderOperationSelectScreen("field");
  });

  // Manage units button
  root.querySelector("#manageUnitsBtn")?.addEventListener("click", () => {
    // Open roster screen, will return to loadout
    renderRosterScreen("loadout");
  });

  // Proceed button
  root.querySelector("#proceedBtn")?.addEventListener("click", () => {
    const currentState = getGameState();
    const isTheaterOperation = Boolean(currentState.operation?.theater);
    const preview = isTheaterOperation ? buildTheaterDeploymentLaunchPreview(currentState) : null;
    const deployUnitIds = preview?.deployUnitIds ?? currentState.partyUnitIds;
    const state = isTheaterOperation
      ? syncForwardLockerStateForUnitIds(currentState, deployUnitIds)
      : syncPartyForwardLockerState(currentState);
    if (deployUnitIds.length === 0) {
      alert(isTheaterOperation
        ? "You need at least one valid unit assigned to your theater deployment squads to proceed!"
        : "You need at least one unit in your party to proceed!");
      return;
    }

    if (!isTheaterOperation) {
      const busyDispatchUnitIds = getBusyDispatchUnitIds(state);
      const dispatchedPartyUnits = state.partyUnitIds
        .map((unitId) => state.unitsById[unitId])
        .filter((unit) => unit && busyDispatchUnitIds.has(unit.id))
        .map((unit) => unit!.name);

      if (dispatchedPartyUnits.length > 0) {
        alert(`These units are still assigned to Dispatch and cannot deploy:\n\n${dispatchedPartyUnits.join("\n")}`);
        return;
      }
    }

    // Enter operation with the forward locker already synchronized to party units and gear.
    updateGameState(prev => ({
      ...(isTheaterOperation
        ? syncForwardLockerStateForUnitIds(prev, buildTheaterDeploymentLaunchPreview(prev).deployUnitIds)
        : syncPartyForwardLockerState(prev)),
      phase: "operation",
    }));
    renderActiveOperationSurface();
  });

  // ------------------------------
  // INVENTORY TRANSFER FUNCTIONALITY
  // ------------------------------
  
  // Click-to-transfer
  const itemEls = root.querySelectorAll<HTMLElement>(".inv-item");
  itemEls.forEach((el) => {
    const isLocked = el.dataset.locked === "true";
    el.style.cursor = isLocked ? "not-allowed" : "pointer";

    if (isLocked) {
      return;
    }

    el.addEventListener("click", () => {
      const itemId = el.dataset.id;
      const fromBinRaw = el.dataset.bin as InventoryBin | undefined;
      if (!itemId || !fromBinRaw) return;

      const fromBin = fromBinRaw;
      updateGameState((prev) => (
        fromBin === "forwardLocker"
          ? moveOwnedItemToBaseStorage(prev, itemId)
          : moveOwnedItemToForwardLocker(prev, itemId)
      ));

      renderLoadoutScreen();
    });
  });

  const folderEls = root.querySelectorAll<HTMLElement>(".loadout-folder-card");
  folderEls.forEach((el) => {
    el.style.cursor = "pointer";

    el.addEventListener("click", () => {
      const folderId = el.dataset.folderId;
      const fromBinRaw = el.dataset.bin as InventoryBin | undefined;
      if (!folderId || !fromBinRaw) return;

      updateGameState((prev) => (
        fromBinRaw === "forwardLocker"
          ? moveInventoryFolderToBaseStorage(prev, folderId)
          : moveInventoryFolderToForwardLocker(prev, folderId)
      ));

      renderLoadoutScreen();
    });
  });

  // Drag & Drop
  itemEls.forEach((el) => {
    if (el.dataset.locked === "true") {
      return;
    }

    el.addEventListener("dragstart", (event: DragEvent) => {
      if (!event.dataTransfer) return;
      const itemId = el.dataset.id;
      const fromBin = el.dataset.bin as InventoryBin | undefined;
      if (!itemId || !fromBin) return;

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", itemId);
      event.dataTransfer.setData("itemId", itemId);
      event.dataTransfer.setData("fromBin", fromBin);
      event.dataTransfer.setData("transferKind", "item");
    });
  });

  folderEls.forEach((el) => {
    el.addEventListener("dragstart", (event: DragEvent) => {
      if (!event.dataTransfer) return;
      const folderId = el.dataset.folderId;
      const fromBin = el.dataset.bin as InventoryBin | undefined;
      if (!folderId || !fromBin) return;

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("folderId", folderId);
      event.dataTransfer.setData("fromBin", fromBin);
      event.dataTransfer.setData("transferKind", "folder");
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
      const folderId = event.dataTransfer.getData("folderId");
      const fromBinRaw = event.dataTransfer.getData("fromBin");
      const toBinRaw = colBody.dataset.bin;
      const transferKind = event.dataTransfer.getData("transferKind");

      if ((!itemId && !folderId) || !fromBinRaw || !toBinRaw) return;

      const fromBin = fromBinRaw as InventoryBin;
      const toBin = toBinRaw as InventoryBin;

      if (fromBin === toBin) return;
      if (
        (fromBin !== "forwardLocker" && fromBin !== "baseStorage") ||
        (toBin !== "forwardLocker" && toBin !== "baseStorage")
      ) {
        return;
      }

      if (transferKind !== "folder" && !itemId) {
        return;
      }

      updateGameState((prev) => {
        if (transferKind === "folder" && folderId) {
          return fromBin === "forwardLocker"
            ? moveInventoryFolderToBaseStorage(prev, folderId)
            : moveInventoryFolderToForwardLocker(prev, folderId);
        }

        return fromBin === "forwardLocker"
          ? moveOwnedItemToBaseStorage(prev, itemId)
          : moveOwnedItemToForwardLocker(prev, itemId);
      });

      renderLoadoutScreen();
    });
  });
}

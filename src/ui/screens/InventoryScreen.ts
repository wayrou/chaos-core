import { getGameState, updateGameState } from "../../state/gameStore";
import {
  computeLoad,
  getMuleUpgradeWadCost,
  getNextMuleClass,
  upgradeMuleClass,
  MULE_CLASS_CAPS,
} from "../../core/inventory";
import { InventoryItem, InventoryState } from "../../core/types";
import {
  buildOwnedBaseStorageItems,
  moveOwnedItemToBaseStorage,
  moveOwnedItemToForwardLocker,
} from "../../core/loadoutInventory";
import {
  buildInventoryFolderTransferSummaries,
  InventoryFolderTransferSummary,
  moveInventoryFolderToBaseStorage,
  moveInventoryFolderToForwardLocker,
} from "../../core/inventoryFolders";
import {
  BaseCampReturnTo,
  returnFromBaseCampScreen,
  registerBaseCampReturnHotkey,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";
import { clearControllerContext, updateFocusableElements } from "../../core/controllerSupport";

type InventoryBin = "forwardLocker" | "baseStorage";

function formatWadAmount(amount: number): string {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.floor(amount)));
}

function renderBar(label: string, current: number, cap: number, unit: string): string {
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
    <div class="loadout-bar">
      <div class="loadout-bar-label">${label}</div>
      <div class="loadout-bar-track">
        <div class="loadout-bar-fill ${isFlashing ? "loadout-bar-fill--flashing" : ""}" style="width:${fillWidth}%;background:${color};"></div>
      </div>
      <div class="loadout-bar-value">${current.toFixed(0)} / ${cap} ${unit}</div>
    </div>
  `;
}

function renderInventoryItem(item: InventoryItem, bin: InventoryBin): string {
  const iconMarkup = item.iconPath
    ? `<img src="${item.iconPath}" alt="${item.name}" style="width:36px;height:36px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);" />`
    : "";

  return `
    <div class="inv-item"
         draggable="true"
         data-id="${item.id}"
         data-bin="${bin}">
      <div class="inv-item-header">
        ${iconMarkup}
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

function renderInventoryFolderCard(folder: InventoryFolderTransferSummary, bin: InventoryBin): string {
  const items = bin === "forwardLocker" ? folder.forwardLockerItems : folder.baseStorageItems;
  const mass = bin === "forwardLocker" ? folder.lockerMassKg : folder.baseMassKg;
  const bulk = bin === "forwardLocker" ? folder.lockerBulkBu : folder.baseBulkBu;
  const power = bin === "forwardLocker" ? folder.lockerPowerW : folder.basePowerW;
  const actionLabel = bin === "forwardLocker" ? "RETURN FOLDER" : "STAGE FOLDER";
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
      <div class="loadout-folder-card-action">${actionLabel}</div>
    </div>
  `;
}

function attachInventoryManagementListeners(returnTo: BaseCampReturnTo): void {
  const root = document.getElementById("app");
  if (!root) return;

  const backBtn = root.querySelector<HTMLButtonElement>("#backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      unregisterBaseCampReturnHotkey("inventory-screen");
      const returnDestination = (backBtn.getAttribute("data-return-to") as BaseCampReturnTo | null) || returnTo;
      returnFromBaseCampScreen(returnDestination);
    });
  }

  registerBaseCampReturnHotkey("inventory-screen", returnTo, {
    allowFieldEKey: true,
    activeSelector: ".inventory-root",
  });

  const muleBtn = root.querySelector<HTMLButtonElement>(".mule-upgrade-btn");
  if (muleBtn) {
    muleBtn.addEventListener("click", () => {
      const currentState = getGameState();
      const cost = getMuleUpgradeWadCost(currentState.inventory.muleClass);
      const nextClass = getNextMuleClass(currentState.inventory.muleClass);
      if (!nextClass || cost === null) {
        return;
      }
      if ((currentState.wad ?? 0) < cost) {
        alert(`Insufficient WAD. Need ${formatWadAmount(cost)} to upgrade M.U.L.E. Class ${currentState.inventory.muleClass} to ${nextClass}.`);
        return;
      }

      updateGameState((prev) => ({
        ...prev,
        wad: Math.max(0, (prev.wad ?? 0) - cost),
        inventory: upgradeMuleClass(prev.inventory),
      }));
      renderInventoryScreen(returnTo);
    });
  }

  const itemEls = root.querySelectorAll<HTMLElement>(".inv-item");
  itemEls.forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => {
      const itemId = el.dataset.id;
      const fromBin = el.dataset.bin as InventoryBin | undefined;
      if (!itemId || !fromBin) return;

      updateGameState((prev) => (
        fromBin === "forwardLocker"
          ? moveOwnedItemToBaseStorage(prev, itemId)
          : moveOwnedItemToForwardLocker(prev, itemId)
      ));

      renderInventoryScreen(returnTo);
    });
  });

  const folderEls = root.querySelectorAll<HTMLElement>(".loadout-folder-card");
  folderEls.forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => {
      const folderId = el.dataset.folderId;
      const fromBin = el.dataset.bin as InventoryBin | undefined;
      if (!folderId || !fromBin) return;

      updateGameState((prev) => (
        fromBin === "forwardLocker"
          ? moveInventoryFolderToBaseStorage(prev, folderId)
          : moveInventoryFolderToForwardLocker(prev, folderId)
      ));

      renderInventoryScreen(returnTo);
    });
  });

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

      renderInventoryScreen(returnTo);
    });
  });
}

export function renderInventoryScreen(returnTo: BaseCampReturnTo = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) {
    console.error("Missing #app element in index.html");
    return;
  }
  document.body.setAttribute("data-screen", "inventory");
  clearControllerContext();

  const state = getGameState();
  const inv: InventoryState = state.inventory;
  const forwardLocker: InventoryItem[] = inv.forwardLocker ?? [];
  const baseStorage: InventoryItem[] = buildOwnedBaseStorageItems(state);
  const folderSummaries = buildInventoryFolderTransferSummaries(state);
  const baseStorageFolders = folderSummaries.filter((folder) => folder.baseStorageItems.length > 0);
  const forwardLockerFolders = folderSummaries.filter((folder) => folder.forwardLockerItems.length > 0);
  const load = computeLoad(inv);
  const muleCaps = MULE_CLASS_CAPS[inv.muleClass];
  const nextMuleClass = getNextMuleClass(inv.muleClass);
  const muleUpgradeWadCost = getMuleUpgradeWadCost(inv.muleClass);
  const canUpgradeMule = Boolean(nextMuleClass && muleUpgradeWadCost !== null);
  const canAffordMuleUpgrade = canUpgradeMule && (state.wad ?? 0) >= (muleUpgradeWadCost ?? 0);
  const caps = {
    mass: muleCaps.massKg,
    bulk: muleCaps.bulkBu,
    power: muleCaps.powerW,
  };

  root.innerHTML = `
    <div class="inventory-root town-screen ard-noise">
      <div class="inventory-card town-screen__panel">
        <div class="inventory-header town-screen__header">
          <div class="inventory-header-left town-screen__titleblock">
            <h1 class="inventory-title">LOADOUT</h1>
            <div class="inventory-subtitle">S/COM_OS // FORWARD_LOCKER • BASE_STORAGE</div>
          </div>
          <div class="inventory-header-right town-screen__header-right">
            <button class="inventory-back-btn town-screen__back-btn" id="backBtn" data-return-to="${returnTo}">
              <span class="btn-icon">&larr;</span>
              <span class="btn-text">${returnTo === "field" ? "FIELD MODE" : "BASE CAMP"}</span>
            </button>
          </div>
        </div>

        <div class="loadout-body">
          <div class="loadout-left">
            <div class="loadout-capacity-section">
              <div class="loadout-section-title">FORWARD LOCKER CAPACITY</div>
              <div class="inventory-column-subtitle">
                Staged here in town means it will already be ready when you open the ops terminal loadout.
              </div>
              ${renderBar("MASS", load.mass, caps.mass, "kg")}
              ${renderBar("BULK", load.bulk, caps.bulk, "bu")}
              ${renderBar("POWER", load.power, caps.power, "w")}
            </div>

            <div class="mule-upgrade">
              <div class="mule-class-display">
                <div class="mule-class-label">MULE SYSTEM</div>
                <div class="mule-class-value">CLASS ${inv.muleClass}</div>
                <div class="inventory-column-subtitle">
                  ${nextMuleClass && muleUpgradeWadCost !== null
                    ? `Next Class ${nextMuleClass} // Upgrade Cost ${formatWadAmount(muleUpgradeWadCost)} WAD // Current WAD ${formatWadAmount(state.wad ?? 0)}`
                    : `Maximum M.U.L.E. class reached // Current WAD ${formatWadAmount(state.wad ?? 0)}`}
                </div>
              </div>
              <button class="mule-upgrade-btn" type="button" ${!canUpgradeMule || !canAffordMuleUpgrade ? "disabled" : ""}>
                ${nextMuleClass && muleUpgradeWadCost !== null
                  ? `UPGRADE TO ${nextMuleClass} // ${formatWadAmount(muleUpgradeWadCost)} WAD`
                  : "MULE MAXED"}
              </button>
            </div>
          </div>

          <div class="loadout-right">
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
                    : baseStorage.map((item) => renderInventoryItem(item, "baseStorage")).join("")
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
                    : forwardLocker.map((item) => renderInventoryItem(item, "forwardLocker")).join("")
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  attachInventoryManagementListeners(returnTo);
  updateFocusableElements();
}

// src/ui/screens/InventoryScreen.ts

import { getGameState, updateGameState } from "../../state/gameStore";
import {
  computeLoad,
  computeLoadPenaltyFlags,
  transferItem,
  upgradeMuleClass,
} from "../../core/inventory";
import { InventoryItem, InventoryState } from "../../core/types";
import { renderBaseCampScreen } from "./BaseCampScreen";
import { renderFieldScreen } from "../../field/FieldScreen";


type InventoryBin = "forwardLocker" | "baseStorage";

export function renderInventoryScreen(returnTo: "basecamp" | "field" = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) {
    console.error("Missing #app element in index.html");
    return;
  }

  const state = getGameState();
  const inv: InventoryState = state.inventory;

  const forwardLocker: InventoryItem[] = inv.forwardLocker ?? [];
  const baseStorage: InventoryItem[] = inv.baseStorage ?? [];

  // --- LOAD + CAPACITY (10za) ---
  const load = computeLoad(inv);
  const penalties = computeLoadPenaltyFlags(inv);

  const caps = {
    mass: inv.capacityMassKg,
    bulk: inv.capacityBulkBu,
    power: inv.capacityPowerW,
  };

  function renderBar(label: string, current: number, cap: number, unit: string): string {
    const pct = current / cap;
    let color = "#52a0ff"; // White/Blue = normal
    let isFlashing = false;
    
    if (pct >= 0.8 && pct < 1) {
      color = "#e4d96f"; // Yellow = nearing capacity (≥ 80%)
    } else if (pct >= 1 && pct < 1.2) {
      color = "#ff5c5c"; // Red = overloaded (>100%)
    } else if (pct >= 1.2) {
      color = "#ff3030"; // Flashing Red = extreme overload
      isFlashing = true;
    }

    const fillWidth = Math.min(pct * 100, 150);
    const displayText = `${current.toFixed(0)} / ${cap} ${unit}`;

    return `
      <div class="loadout-bar">
        <div class="loadout-bar-label">${label}</div>
        <div class="loadout-bar-track">
          <div class="loadout-bar-fill ${isFlashing ? 'loadout-bar-fill--flashing' : ''}"
               style="
                 width:${fillWidth}%;
                 background:${color};
               ">
          </div>
        </div>
        <div class="loadout-bar-value">${displayText}</div>
      </div>
    `;
  }

  function renderItem(item: InventoryItem, bin: InventoryBin): string {
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

  root.innerHTML = `
    <div class="inventory-root">
      <div class="inventory-card">

        <div class="inventory-header">
          <div class="inventory-header-left">
            <div class="inventory-title">LOADOUT</div>
            <div class="inventory-subtitle">SCROLLINK OS // FORWARD_LOCKER • BASE_STORAGE</div>
          </div>
          <div class="inventory-header-right">
            <button class="inventory-back-btn" id="backBtn" data-return-to="${returnTo}">
              <span class="btn-icon">←</span>
              <span class="btn-text">${returnTo === "field" ? "FIELD MODE" : "BASE CAMP"}</span>
            </button>
          </div>
        </div>

        <div class="loadout-body">
          <div class="loadout-left">
            <div class="loadout-capacity-section">
              <div class="loadout-section-title">CAPACITY METERS</div>
              ${renderBar("MASS", load.mass, caps.mass, "kg")}
              ${renderBar("BULK", load.bulk, caps.bulk, "bu")}
              ${renderBar("POWER", load.power, caps.power, "w")}
            </div>

            <div class="mule-upgrade">
              <div class="mule-class-display">
                <div class="mule-class-label">MULE SYSTEM</div>
                <div class="mule-class-value">CLASS ${inv.muleClass}</div>
              </div>
              <button class="mule-upgrade-btn">UPGRADE MULE</button>
            </div>
          </div>

          <div class="loadout-right">
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
                        .map((i) => renderItem(i, "forwardLocker"))
                        .join("")
                }
              </div>
            </div>

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
                        .map((i) => renderItem(i, "baseStorage"))
                        .join("")
                }
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  // --- BUTTON: BACK ---
  const backBtn = root.querySelector<HTMLButtonElement>("#backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      const returnDestination = backBtn.getAttribute("data-return-to") || returnTo;
      if (returnDestination === "field") {
        renderFieldScreen("base_camp");
      } else {
        renderBaseCampScreen();
      }
    });
  }

  // --- BUTTON: MULE UPGRADE (placeholder logic: no WAD cost yet) ---
  const muleBtn = root.querySelector<HTMLButtonElement>(".mule-upgrade-btn");
  if (muleBtn) {
    muleBtn.addEventListener("click", () => {
      updateGameState((prev) => ({
        ...prev,
        inventory: upgradeMuleClass(prev.inventory),
      }));
      renderInventoryScreen();
    });
  }

  // ------------------------------
  // CLICK-TO-TRANSFER (reliable)
  // ------------------------------
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

      renderInventoryScreen();
    });
  });

  // ------------------------------
  // DRAG & DROP (still there, but optional)
  // ------------------------------

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

      renderInventoryScreen();
    });
  });
}

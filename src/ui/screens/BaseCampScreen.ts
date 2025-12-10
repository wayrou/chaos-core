// src/ui/screens/BaseCampScreen.ts

import { getGameState } from "../../state/gameStore";
import { renderInventoryScreen } from "./InventoryScreen";
import { renderOperationSelectScreen } from "./OperationSelectScreen";
import { renderShopScreen } from "./ShopScreen";
import { renderRosterScreen } from "./RosterScreen";
import { renderCraftingScreen } from "./WorkshopScreen";
import { renderGearWorkbenchScreen } from "./GearWorkbenchScreen";
import { renderSettingsScreen } from "./SettingsScreen";
import { renderFieldScreen } from "../../field/FieldScreen";
import { renderRecruitmentScreen } from "./RecruitmentScreen";
import { renderQuestBoardScreen } from "./QuestBoardScreen";

// Check if we're in field mode (base camp modal should be shown as overlay)
function isInFieldMode(): boolean {
  return document.querySelector(".field-root") !== null;
}

export function renderBaseCampScreen(): void {
  // If we're in field mode, show as modal overlay
  if (isInFieldMode()) {
    showBaseCampModal();
    return;
  }
  
  // Otherwise, render as full screen (legacy behavior)
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const profile = state.profile;
  const wad = state.wad ?? 0;
  const res = state.resources ?? { metalScrap: 0, wood: 0, chaosShards: 0, steamComponents: 0 };

  root.innerHTML = `
    <div class="basecamp-root">

      <div class="basecamp-header">
        <div class="basecamp-title">BASE CAMP - SCROLLINK OS</div>

        <div class="basecamp-ident">
          <div>CALLSIGN: ${profile.callsign}</div>
          <div>SQUAD: ${profile.squadName}</div>
          <div class="basecamp-wad">WAD: ${wad}</div>
        </div>
      </div>

      <div class="basecamp-resources">
        <div class="resource-item"><span class="resource-label">METAL</span><span class="resource-value">${res.metalScrap}</span></div>
        <div class="resource-item"><span class="resource-label">WOOD</span><span class="resource-value">${res.wood}</span></div>
        <div class="resource-item"><span class="resource-label">SHARDS</span><span class="resource-value">${res.chaosShards}</span></div>
        <div class="resource-item"><span class="resource-label">STEAM</span><span class="resource-value">${res.steamComponents}</span></div>
      </div>

      <div class="basecamp-buttons">
        <button class="bc-btn bc-field-mode" id="fieldModeBtn">
          <span class="btn-icon">🌍</span>
          <span class="btn-label">FIELD MODE</span>
        </button>
        <button class="bc-btn bc-startop">
          <span class="btn-icon">🎯</span>
          <span class="btn-label">START OPERATION</span>
        </button>
        <button class="bc-btn bc-loadout">
          <span class="btn-icon">🎒</span>
          <span class="btn-label">LOADOUT</span>
        </button>
        <button class="bc-btn bc-shop">
          <span class="btn-icon">🛒</span>
          <span class="btn-label">SHOP</span>
        </button>
        <button class="bc-btn bc-roster">
          <span class="btn-icon">👥</span>
          <span class="btn-label">UNIT ROSTER</span>
        </button>
        <button class="bc-btn bc-workshop">
          <span class="btn-icon">🔨</span>
          <span class="btn-label">CRAFTING</span>
        </button>
        <button class="bc-btn bc-tavern" id="tavernBtn">
          <span class="btn-icon">🍺</span>
          <span class="btn-label">TAVERN</span>
        </button>
        <button class="bc-btn bc-gear-workbench" id="gearWorkbenchBtn">
          <span class="btn-icon">&#128295;</span>
          <span class="btn-label">GEAR WORKBENCH</span>
        </button>
        <button class="bc-btn bc-quest-board" id="questBoardBtn">
          <span class="btn-icon">📋</span>
          <span class="btn-label">QUEST BOARD</span>
        </button>
        <button class="bc-btn bc-settings" id="settingsBtn">
          <span class="btn-icon">⚙</span>
          <span class="btn-label">SETTINGS</span>
        </button>
        <button class="bc-btn bc-exit-to-menu" id="exitToMenuBtn">← BACK TO TITLE SCREEN</button>
      </div>

      <div class="basecamp-terminal-body">
        SLK&gt; LINK_STATUS    :: Carrier signal stabilized.<br/>
        SLK&gt; CORE_STATUS    :: Chaos core containment: GREEN.<br/>
        SLK&gt; AWAITING_INPUT :: Select operation or adjust loadout.
      </div>

    </div>
  `;

  // --- EVENT LISTENERS ---

  root.querySelector("#fieldModeBtn")?.addEventListener("click", () => {
    renderFieldScreen("base_camp");
  });

  root.querySelector(".bc-startop")?.addEventListener("click", () => {
    renderOperationSelectScreen();
  });

  root.querySelector(".bc-loadout")?.addEventListener("click", () => {
    renderInventoryScreen();
  });

  root.querySelector(".bc-shop")?.addEventListener("click", () => {
    renderShopScreen();
  });

  root.querySelector(".bc-roster")?.addEventListener("click", () => {
    renderRosterScreen();
  });

  root.querySelector(".bc-workshop")?.addEventListener("click", () => {
    renderCraftingScreen();
  });

  root.querySelector("#tavernBtn")?.addEventListener("click", () => {
    renderRecruitmentScreen();
  });

  // Gear Workbench - Opens with first party unit's weapon selected
  root.querySelector("#gearWorkbenchBtn")?.addEventListener("click", () => {
    const currentState = getGameState();
    const firstUnitId = currentState.partyUnitIds?.[0] ?? null;

    if (firstUnitId) {
      const unit = currentState.unitsById[firstUnitId];
      const weaponId = (unit as any)?.loadout?.weapon ?? null;
      renderGearWorkbenchScreen(firstUnitId, weaponId);
    } else {
      // No party units - just open without selection
      renderGearWorkbenchScreen();
    }
  });

  // Quest Board button
  const questBoardBtn = root.querySelector("#questBoardBtn");
  if (questBoardBtn) {
    questBoardBtn.addEventListener("click", () => {
      console.log("[BASE CAMP] Quest Board button clicked");
      renderQuestBoardScreen("basecamp");
    });
  } else {
    console.warn("[BASE CAMP] Quest Board button not found");
  }

  // Settings button
  root.querySelector("#settingsBtn")?.addEventListener("click", () => {
    renderSettingsScreen("basecamp");
  });

  // Exit to Title Screen
  root.querySelector("#exitToMenuBtn")?.addEventListener("click", async () => {
    if (confirm("Return to title screen? Make sure your game is saved!")) {
      const { renderMainMenu } = await import("./MainMenuScreen");
      renderMainMenu();
    }
  });
}

// Show base camp as modal overlay in field mode
export function showBaseCampModal(): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const profile = state.profile;
  const wad = state.wad ?? 0;
  const res = state.resources ?? { metalScrap: 0, wood: 0, chaosShards: 0, steamComponents: 0 };

  // Check if modal already exists
  let modal = document.getElementById("basecamp-modal");
  if (!modal) {
    // Create modal container
    modal = document.createElement("div");
    modal.id = "basecamp-modal";
    modal.className = "basecamp-modal-overlay";
    root.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="basecamp-modal-content">
      <div class="basecamp-root basecamp-modal-inner">

        <div class="basecamp-header">
          <div class="basecamp-title">BASE CAMP - SCROLLINK OS</div>
          <button class="basecamp-modal-close" id="basecampModalClose">×</button>
          <div class="basecamp-ident">
            <div>CALLSIGN: ${profile.callsign}</div>
            <div>SQUAD: ${profile.squadName}</div>
            <div class="basecamp-wad">WAD: ${wad}</div>
          </div>
        </div>

        <div class="basecamp-resources">
          <div class="resource-item"><span class="resource-label">METAL</span><span class="resource-value">${res.metalScrap}</span></div>
          <div class="resource-item"><span class="resource-label">WOOD</span><span class="resource-value">${res.wood}</span></div>
          <div class="resource-item"><span class="resource-label">SHARDS</span><span class="resource-value">${res.chaosShards}</span></div>
          <div class="resource-item"><span class="resource-label">STEAM</span><span class="resource-value">${res.steamComponents}</span></div>
        </div>

        <div class="basecamp-buttons">
          <button class="bc-btn bc-startop">
            <span class="btn-icon">🎯</span>
            <span class="btn-label">START OPERATION</span>
          </button>
          <button class="bc-btn bc-loadout">
            <span class="btn-icon">🎒</span>
            <span class="btn-label">LOADOUT</span>
          </button>
          <button class="bc-btn bc-shop">
            <span class="btn-icon">🛒</span>
            <span class="btn-label">SHOP</span>
          </button>
          <button class="bc-btn bc-roster">
            <span class="btn-icon">👥</span>
            <span class="btn-label">UNIT ROSTER</span>
          </button>
          <button class="bc-btn bc-workshop">
            <span class="btn-icon">🔨</span>
            <span class="btn-label">WORKSHOP</span>
          </button>
          <button class="bc-btn bc-gear-workbench" id="gearWorkbenchBtn">
            <span class="btn-icon">&#128295;</span>
            <span class="btn-label">GEAR WORKBENCH</span>
          </button>
          <button class="bc-btn bc-quest-board" id="questBoardBtn">
            <span class="btn-icon">📋</span>
            <span class="btn-label">QUEST BOARD</span>
          </button>
          <button class="bc-btn bc-settings" id="settingsBtn">
            <span class="btn-icon">⚙</span>
            <span class="btn-label">SETTINGS</span>
          </button>
          <button class="bc-btn bc-exit-to-menu" id="exitToMenuBtn">← BACK TO TITLE SCREEN</button>
        </div>

        <div class="basecamp-terminal-body">
          SLK&gt; LINK_STATUS    :: Carrier signal stabilized.<br/>
          SLK&gt; CORE_STATUS    :: Chaos core containment: GREEN.<br/>
          SLK&gt; AWAITING_INPUT :: Select operation or adjust loadout.
        </div>

      </div>
    </div>
  `;

  // Close button
  modal.querySelector("#basecampModalClose")?.addEventListener("click", () => {
    hideBaseCampModal();
  });

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("basecamp-modal-overlay")) {
      hideBaseCampModal();
    }
  });

  // Attach all the same event listeners as the full screen version
  attachBaseCampListeners(modal);
  
  // Show modal - ensure it's visible
  modal.style.display = "flex";
}

// Hide base camp modal
export function hideBaseCampModal(): void {
  const modal = document.getElementById("basecamp-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

// Attach event listeners for base camp buttons
function attachBaseCampListeners(container: HTMLElement): void {
  container.querySelector(".bc-startop")?.addEventListener("click", () => {
    hideBaseCampModal();
    renderOperationSelectScreen();
  });

  container.querySelector(".bc-loadout")?.addEventListener("click", () => {
    hideBaseCampModal();
    renderInventoryScreen();
  });

  container.querySelector(".bc-shop")?.addEventListener("click", () => {
    hideBaseCampModal();
    renderShopScreen();
  });

  container.querySelector(".bc-roster")?.addEventListener("click", () => {
    hideBaseCampModal();
    renderRosterScreen();
  });

  container.querySelector(".bc-workshop")?.addEventListener("click", () => {
    hideBaseCampModal();
    renderCraftingScreen();
  });

  container.querySelector("#tavernBtn")?.addEventListener("click", () => {
    hideBaseCampModal();
    renderRecruitmentScreen();
  });

  // Gear Workbench
  container.querySelector("#gearWorkbenchBtn")?.addEventListener("click", () => {
    const currentState = getGameState();
    const firstUnitId = currentState.partyUnitIds?.[0] ?? null;

    if (firstUnitId) {
      const unit = currentState.unitsById[firstUnitId];
      const weaponId = (unit as any)?.loadout?.weapon ?? null;
      hideBaseCampModal();
      renderGearWorkbenchScreen(firstUnitId, weaponId);
    } else {
      hideBaseCampModal();
      renderGearWorkbenchScreen();
    }
  });

  // Quest Board button
  const questBoardBtn = container.querySelector("#questBoardBtn");
  if (questBoardBtn) {
    questBoardBtn.addEventListener("click", () => {
      console.log("[BASE CAMP MODAL] Quest Board button clicked");
      hideBaseCampModal();
      renderQuestBoardScreen("basecamp");
    });
  } else {
    console.warn("[BASE CAMP MODAL] Quest Board button not found");
  }

  // Settings button
  container.querySelector("#settingsBtn")?.addEventListener("click", () => {
    hideBaseCampModal();
    renderSettingsScreen("basecamp");
  });

  // Exit to Title Screen
  container.querySelector("#exitToMenuBtn")?.addEventListener("click", async () => {
    if (confirm("Return to title screen? Make sure your game is saved!")) {
      const { renderMainMenu } = await import("./MainMenuScreen");
      renderMainMenu();
    }
  });
}
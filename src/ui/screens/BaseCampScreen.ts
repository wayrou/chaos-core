// src/ui/screens/BaseCampScreen.ts

import { getGameState } from "../../state/gameStore";
import { renderInventoryScreen } from "./InventoryScreen";
import { renderOperationSelectScreen } from "./OperationSelectScreen";
import { renderShopScreen } from "./ShopScreen";
import { renderRosterScreen } from "./RosterScreen";
import { renderWorkshopScreen } from "./WorkshopScreen";

export function renderBaseCampScreen(): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const profile = state.profile;
  const wad = state.wad ?? 0;

  root.innerHTML = `
    <div class="basecamp-root">

      <div class="basecamp-header">
        <div class="basecamp-title">BASE CAMP – SCROLLINK OS</div>

        <div class="basecamp-ident">
          <div>CALLSIGN: ${profile.callsign}</div>
          <div>SQUAD: ${profile.squadName}</div>
          <div>WAD: ${wad}</div>
        </div>
      </div>

      <div class="basecamp-buttons">

        <button class="bc-btn bc-startop">START OPERATION</button>
        <button class="bc-btn bc-loadout">LOADOUT</button>

        <button class="bc-btn bc-shop">SHOP</button>
        <button class="bc-btn bc-roster">UNIT ROSTER</button>

        <button class="bc-btn bc-workshop">WORKSHOP</button>

      </div>

  <div class="basecamp-terminal-body">
  SLK&gt; LINK_STATUS    :: Carrier signal stabilized.<br/>
  SLK&gt; CORE_STATUS    :: Chaos core containment: GREEN.<br/>
  SLK&gt; AWAITING_INPUT :: Select operation or adjust loadout.
</div>

  `;

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
    renderWorkshopScreen();
  });
}

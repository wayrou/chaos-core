// src/ui/screens/ShopScreen.ts

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderBaseCampScreen } from "./BaseCampScreen";

import { saveGame, loadGame } from "../../core/saveSystem";
import { getSettings, updateSettings } from "../../core/settings";
import { initControllerSupport } from "../../core/controllerSupport";
import { getGameState, updateGameState } from "../../state/gameStore";

import { 
  PAK_DATABASE, 
  openPAK, 
  addCardsToLibrary,
  LIBRARY_CARD_DATABASE 
} from "../../core/gearWorkbench";

const PAK_PRICES: Record<string, number> = {
  pak_core: 50,
  pak_steam: 75,
  pak_void: 100,
  pak_tech: 75,
  pak_boss: 200,
};

export function renderShopScreen(): void {
  const app = document.getElementById("app");
  if (!app) return;
  
  const state = getGameState();
  
  app.innerHTML = `
    <div class="shop-root">
      <div class="shop-header">
        <h1>QUARTERMASTER</h1>
        <div class="shop-wad">WAD: ${state.wad}</div>
        <button class="shop-back-btn" id="backBtn">← BASE CAMP</button>
      </div>
      
      <div class="shop-section">
        <h2>DATA PACKS (.PAK)</h2>
        <div class="pak-grid">
          ${Object.values(PAK_DATABASE).map(pak => `
            <div class="pak-item" data-pak-id="${pak.id}">
              <div class="pak-name">${pak.name}</div>
              <div class="pak-desc">${pak.description}</div>
              <div class="pak-cards">${pak.cardCount} cards</div>
              <div class="pak-price">${PAK_PRICES[pak.id]} WAD</div>
              <button class="pak-buy-btn" 
                      data-pak-id="${pak.id}"
                      ${state.wad < PAK_PRICES[pak.id] ? 'disabled' : ''}>
                BUY
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  // Back button
  document.getElementById("backBtn")?.addEventListener("click", () => {
    renderBaseCampScreen();
  });
  
  // PAK purchase buttons
  document.querySelectorAll(".pak-buy-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const pakId = (e.currentTarget as HTMLElement).getAttribute("data-pak-id");
      if (pakId) {
        purchasePAK(pakId);
      }
    });
  });
}

function purchasePAK(pakId: string): void {
  const state = getGameState();
  const price = PAK_PRICES[pakId];
  
  if (state.wad < price) {
    alert("Not enough WAD!");
    return;
  }
  
  // Open the PAK and get cards
  const cards = openPAK(pakId);
  
  // Update state
  updateGameState(draft => {
    draft.wad -= price;
    draft.cardLibrary = addCardsToLibrary(draft.cardLibrary ?? {}, cards);
  });
  
  // Show acquired cards
  const cardNames = cards.map(id => {
    const card = LIBRARY_CARD_DATABASE[id];
    return card ? `${card.name} (${card.rarity})` : id;
  });
  
  alert(`DECOMPILING ${PAK_DATABASE[pakId].name}...\n\nCards acquired:\n${cardNames.join('\n')}`);
  
  // Re-render shop
  renderShopScreen();
}
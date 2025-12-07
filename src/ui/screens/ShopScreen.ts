// ============================================================================
// CHAOS CORE - SHOP SCREEN (Headline 12x - Improved)
// src/ui/screens/ShopScreen.ts
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderBaseCampScreen } from "./BaseCampScreen";
import { renderFieldScreen } from "../../field/FieldScreen";
import { 
  PAK_DATABASE, 
  openPAK, 
  addCardsToLibrary,
  LIBRARY_CARD_DATABASE 
} from "../../core/gearWorkbench";

// ----------------------------------------------------------------------------
// SHOP DATA
// ----------------------------------------------------------------------------

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "pak" | "equipment" | "consumable" | "recipe";
  rarity?: "common" | "uncommon" | "rare" | "epic";
  stock?: number; // undefined = unlimited
}

const PAK_ITEMS: ShopItem[] = [
  {
    id: "pak_core",
    name: "CORE.PAK",
    description: "Standard issue tactical data. Contains basic attack and defense cards.",
    price: 50,
    category: "pak",
    rarity: "common"
  },
  {
    id: "pak_steam",
    name: "STEAM.PAK",
    description: "Mechanical weapon enhancements. Heat management and venting cards.",
    price: 75,
    category: "pak",
    rarity: "uncommon"
  },
  {
    id: "pak_void",
    name: "VOID.PAK",
    description: "Chaos-infused abilities. High risk, high reward cards.",
    price: 100,
    category: "pak",
    rarity: "rare"
  },
  {
    id: "pak_tech",
    name: "TECH.PAK",
    description: "Advanced tactical protocols. Buff and debuff oriented.",
    price: 75,
    category: "pak",
    rarity: "uncommon"
  },
  {
    id: "pak_boss",
    name: "BOSS.PAK",
    description: "Legendary combat data extracted from fallen commanders.",
    price: 200,
    category: "pak",
    rarity: "epic"
  }
];

const CONSUMABLE_ITEMS: ShopItem[] = [
  {
    id: "item_repair_kit",
    name: "Field Repair Kit",
    description: "Restores 2 weapon wear during battle.",
    price: 25,
    category: "consumable",
    rarity: "common"
  },
  {
    id: "item_coolant",
    name: "Emergency Coolant",
    description: "Instantly reduces weapon heat to 0.",
    price: 30,
    category: "consumable",
    rarity: "common"
  },
  {
    id: "item_stim_pack",
    name: "Combat Stim",
    description: "Reduces strain by 3 for one unit.",
    price: 40,
    category: "consumable",
    rarity: "uncommon"
  },
  {
    id: "item_smoke_bomb",
    name: "Smoke Grenade",
    description: "Creates cover in a 2-tile radius.",
    price: 35,
    category: "consumable",
    rarity: "common"
  }
];

const EQUIPMENT_ITEMS: ShopItem[] = [
  {
    id: "weapon_iron_sword",
    name: "Iron Longsword",
    description: "Basic melee weapon. Reliable and sturdy.",
    price: 80,
    category: "equipment",
    rarity: "common"
  },
  {
    id: "weapon_elm_bow",
    name: "Elm Recurve Bow",
    description: "Standard ranged weapon. Range 3-6.",
    price: 85,
    category: "equipment",
    rarity: "common"
  },
  {
    id: "armor_leather_vest",
    name: "Leather Jerkin",
    description: "Light armor. +2 DEF, no movement penalty.",
    price: 60,
    category: "equipment",
    rarity: "common"
  },
  {
    id: "accessory_fleetfoot",
    name: "Fleetfoot Anklet",
    description: "+1 AGI. Movement enhancement accessory.",
    price: 70,
    category: "equipment",
    rarity: "uncommon"
  }
];

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

let currentTab: "paks" | "equipment" | "consumables" = "paks";

export function renderShopScreen(returnTo: "basecamp" | "field" = "basecamp"): void {
  const app = document.getElementById("app");
  if (!app) return;
  
  const state = getGameState();
  const backButtonText = returnTo === "field" ? "FIELD MODE" : "BASE CAMP";
  
  app.innerHTML = `
    <div class="shop-root">
      <!-- Header -->
      <div class="shop-header">
        <div class="shop-header-left">
          <h1 class="shop-title">QUARTERMASTER</h1>
          <div class="shop-subtitle">SCROLLINK SUPPLY TERMINAL</div>
        </div>
        <div class="shop-header-right">
          <div class="shop-wallet">
            <span class="wallet-label">AVAILABLE WAD</span>
            <span class="wallet-value">${state.wad.toLocaleString()}</span>
          </div>
          <button class="shop-back-btn" id="backBtn" data-return-to="${returnTo}">
            <span class="btn-icon">←</span>
            <span class="btn-text">${backButtonText}</span>
          </button>
        </div>
      </div>
      
      <!-- Tabs -->
      <div class="shop-tabs">
        <button class="shop-tab ${currentTab === 'paks' ? 'shop-tab--active' : ''}" data-tab="paks">
          <span class="tab-icon">📦</span>
          <span class="tab-text">DATA PACKS</span>
        </button>
        <button class="shop-tab ${currentTab === 'equipment' ? 'shop-tab--active' : ''}" data-tab="equipment">
          <span class="tab-icon">⚔️</span>
          <span class="tab-text">EQUIPMENT</span>
        </button>
        <button class="shop-tab ${currentTab === 'consumables' ? 'shop-tab--active' : ''}" data-tab="consumables">
          <span class="tab-icon">💊</span>
          <span class="tab-text">CONSUMABLES</span>
        </button>
      </div>
      
      <!-- Content -->
      <div class="shop-content">
        ${renderShopContent(state)}
      </div>
      
      <!-- Resources Footer -->
      <div class="shop-footer">
        <div class="resource-display">
          <div class="resource-item">
            <span class="resource-icon">⚙</span>
            <span class="resource-value">${state.resources?.metalScrap ?? 0}</span>
            <span class="resource-label">Metal</span>
          </div>
          <div class="resource-item">
            <span class="resource-icon">🪵</span>
            <span class="resource-value">${state.resources?.wood ?? 0}</span>
            <span class="resource-label">Wood</span>
          </div>
          <div class="resource-item">
            <span class="resource-icon">💎</span>
            <span class="resource-value">${state.resources?.chaosShards ?? 0}</span>
            <span class="resource-label">Shards</span>
          </div>
          <div class="resource-item">
            <span class="resource-icon"></span>
            <span class="resource-value">${state.resources?.steamComponents ?? 0}</span>
            <span class="resource-label">Steam</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  attachShopListeners(returnTo);
}

function renderShopContent(state: any): string {
  let items: ShopItem[] = [];
  let sectionTitle = "";
  let sectionDesc = "";
  
  switch (currentTab) {
    case "paks":
      items = PAK_ITEMS;
      sectionTitle = "DATA PACKS (.PAK)";
      sectionDesc = "Decompress tactical data to add cards to your library.";
      break;
    case "equipment":
      items = EQUIPMENT_ITEMS;
      sectionTitle = "EQUIPMENT";
      sectionDesc = "Weapons and armor for your squad.";
      break;
    case "consumables":
      items = CONSUMABLE_ITEMS;
      sectionTitle = "CONSUMABLES";
      sectionDesc = "Single-use items for battle support.";
      break;
  }
  
  return `
    <div class="shop-section">
      <div class="shop-section-header">
        <h2 class="section-title">${sectionTitle}</h2>
        <p class="section-desc">${sectionDesc}</p>
      </div>
      <div class="shop-grid">
        ${items.map(item => renderShopItem(item, state)).join('')}
      </div>
    </div>
  `;
}

function renderShopItem(item: ShopItem, state: any): string {
  const canAfford = state.wad >= item.price;
  const rarityClass = `shop-item--${item.rarity ?? 'common'}`;
  
  return `
    <div class="shop-item ${rarityClass} ${!canAfford ? 'shop-item--disabled' : ''}" data-item-id="${item.id}">
      <div class="shop-item-header">
        <span class="shop-item-name">${item.name}</span>
        <span class="shop-item-rarity">${(item.rarity ?? 'common').toUpperCase()}</span>
      </div>
      <div class="shop-item-body">
        <p class="shop-item-desc">${item.description}</p>
        ${item.category === 'pak' ? `
          <div class="shop-item-meta">
            <span class="meta-tag">${PAK_DATABASE[item.id]?.cardCount ?? '?'} cards</span>
          </div>
        ` : ''}
      </div>
      <div class="shop-item-footer">
        <div class="shop-item-price">
          <span class="price-value">${item.price}</span>
          <span class="price-label">WAD</span>
        </div>
        <button class="shop-buy-btn ${!canAfford ? 'shop-buy-btn--disabled' : ''}" 
                data-item-id="${item.id}"
                data-category="${item.category}"
                ${!canAfford ? 'disabled' : ''}>
          ${canAfford ? 'PURCHASE' : 'INSUFFICIENT'}
        </button>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// EVENT HANDLERS
// ----------------------------------------------------------------------------

function attachShopListeners(returnTo: "basecamp" | "field" = "basecamp"): void {
  // Back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    // Get return destination from button's data attribute or parameter
    const returnDestination = (backBtn as HTMLElement).getAttribute("data-return-to") || returnTo;
    backBtn.onclick = () => {
      if (returnDestination === "field") {
        renderFieldScreen("base_camp");
      } else {
        renderBaseCampScreen();
      }
    };
  }
  
  // Tab buttons - preserve return destination when switching tabs
  document.querySelectorAll(".shop-tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
      const tabName = (e.currentTarget as HTMLElement).getAttribute("data-tab");
      if (tabName) {
        currentTab = tabName as "paks" | "equipment" | "consumables";
        // Get current return destination from button
        const currentReturnTo = (document.getElementById("backBtn") as HTMLElement)?.getAttribute("data-return-to") || returnTo;
        renderShopScreen(currentReturnTo as "basecamp" | "field");
      }
    });
  });
  
  // Buy buttons
  document.querySelectorAll(".shop-buy-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const itemId = (e.currentTarget as HTMLElement).getAttribute("data-item-id");
      const category = (e.currentTarget as HTMLElement).getAttribute("data-category");
      if (itemId && category) {
        purchaseItem(itemId, category as ShopItem["category"]);
      }
    });
  });
}

function purchaseItem(itemId: string, category: ShopItem["category"]): void {
  const allItems = [...PAK_ITEMS, ...EQUIPMENT_ITEMS, ...CONSUMABLE_ITEMS];
  const item = allItems.find(i => i.id === itemId);
  if (!item) return;
  
  const state = getGameState();
  if (state.wad < item.price) {
    showNotification("INSUFFICIENT WAD", "error");
    return;
  }
  
  if (category === "pak") {
    purchasePAK(itemId, item);
  } else if (category === "equipment") {
    purchaseEquipment(itemId, item);
  } else if (category === "consumable") {
    purchaseConsumable(itemId, item);
  }
}

function purchasePAK(pakId: string, item: ShopItem): void {
  // Open the PAK and get cards
  const cards = openPAK(pakId);
  
  // Update state
  updateGameState(draft => {
    draft.wad -= item.price;
    draft.cardLibrary = addCardsToLibrary(draft.cardLibrary ?? {}, cards);
  });
  
  // Show acquired cards
  const cardNames = cards.map(id => {
    const card = LIBRARY_CARD_DATABASE[id];
    return card ? card.name : id;
  });
  
  showPurchaseModal(item.name, cardNames, "Cards acquired:");
  
  // Re-render shop
  renderShopScreen();
}

function purchaseEquipment(itemId: string, item: ShopItem): void {
  updateGameState(draft => {
    draft.wad -= item.price;
    draft.inventory = draft.inventory ?? [];
    draft.inventory.push({ id: itemId, quantity: 1 });
  });
  
  showNotification(`${item.name} added to inventory!`, "success");
  renderShopScreen();
}

function purchaseConsumable(itemId: string, item: ShopItem): void {
  updateGameState(draft => {
    draft.wad -= item.price;
    draft.consumables = draft.consumables ?? [];
    
    // Check if already have this consumable
    const existing = draft.consumables.find((c: any) => c.id === itemId);
    if (existing) {
      existing.quantity = (existing.quantity ?? 1) + 1;
    } else {
      draft.consumables.push({ id: itemId, quantity: 1 });
    }
  });
  
  showNotification(`${item.name} added to supplies!`, "success");
  renderShopScreen();
}

// ----------------------------------------------------------------------------
// UI HELPERS
// ----------------------------------------------------------------------------

function showNotification(message: string, type: "success" | "error" | "info"): void {
  // Remove existing notification
  const existing = document.querySelector(".shop-notification");
  if (existing) existing.remove();
  
  const notification = document.createElement("div");
  notification.className = `shop-notification shop-notification--${type}`;
  notification.innerHTML = `
    <span class="notification-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
    <span class="notification-text">${message}</span>
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => notification.classList.add("shop-notification--visible"), 10);
  
  // Remove after delay
  setTimeout(() => {
    notification.classList.remove("shop-notification--visible");
    setTimeout(() => notification.remove(), 300);
  }, 2500);
}

function showPurchaseModal(itemName: string, items: string[], subtitle: string): void {
  const modal = document.createElement("div");
  modal.className = "shop-modal";
  modal.innerHTML = `
    <div class="shop-modal-content">
      <div class="shop-modal-header">
        <span class="modal-icon">📦</span>
        <span class="modal-title">DECOMPRESSING ${itemName}...</span>
      </div>
      <div class="shop-modal-body">
        <p class="modal-subtitle">${subtitle}</p>
        <ul class="modal-items">
          ${items.map(item => `<li class="modal-item">${item}</li>`).join('')}
        </ul>
      </div>
      <div class="shop-modal-footer">
        <button class="modal-close-btn" id="closeModalBtn">CONFIRM</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Animate in
  setTimeout(() => modal.classList.add("shop-modal--visible"), 10);
  
  // Close button
  modal.querySelector("#closeModalBtn")?.addEventListener("click", () => {
    modal.classList.remove("shop-modal--visible");
    setTimeout(() => modal.remove(), 300);
  });
  
  // Click outside to close
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("shop-modal--visible");
      setTimeout(() => modal.remove(), 300);
    }
  });
}

export { renderShopScreen as default };
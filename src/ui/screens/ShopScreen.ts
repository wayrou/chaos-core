// ============================================================================
// CHAOS CORE - SHOP SCREEN (Headline 12x - Improved)
// src/ui/screens/ShopScreen.ts
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderBaseCampScreen } from "./BaseCampScreen";
import { renderFieldScreen } from "../../field/FieldScreen";
import { renderOperationMapScreen, markRoomVisited } from "./OperationMapScreen";
import { 
  PAK_DATABASE, 
  openPAK, 
  addCardsToLibrary,
  LIBRARY_CARD_DATABASE 
} from "../../core/gearWorkbench";
import { getAllStarterEquipment } from "../../core/equipment";

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
    id: "weapon_iron_longsword",
    name: "Iron Longsword",
    description: "Basic melee weapon. Reliable and sturdy.",
    price: 80,
    category: "equipment",
    rarity: "common"
  },
  {
    id: "weapon_elm_recurve_bow",
    name: "Elm Recurve Bow",
    description: "Standard ranged weapon. Range 3-6.",
    price: 85,
    category: "equipment",
    rarity: "common"
  },
  {
    id: "armor_leather_jerkin",
    name: "Leather Jerkin",
    description: "Light armor. +1 DEF, +1 AGI.",
    price: 60,
    category: "equipment",
    rarity: "common"
  },
  {
    id: "accessory_fleetfoot_anklet",
    name: "Fleetfoot Anklet",
    description: "+2 AGI. Movement enhancement accessory.",
    price: 70,
    category: "equipment",
    rarity: "uncommon"
  }
];

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

let currentTab: "paks" | "equipment" | "consumables" = "paks";

export function renderShopScreen(returnTo: "basecamp" | "field" | "operation" = "basecamp"): void {
  const app = document.getElementById("app");
  if (!app) return;
  
  const state = getGameState();
  const backButtonText = returnTo === "field" ? "FIELD MODE" : returnTo === "operation" ? "DUNGEON MAP" : "BASE CAMP";
  
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

function attachShopListeners(returnTo: "basecamp" | "field" | "operation" = "basecamp"): void {
  // Back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    // Get return destination from button's data attribute or parameter
    const returnDestination = (backBtn as HTMLElement).getAttribute("data-return-to") || returnTo;
    backBtn.onclick = () => {
      if (returnDestination === "field") {
        renderFieldScreen("base_camp");
      } else if (returnDestination === "operation") {
        // Mark the current room as visited when leaving the shop (uses campaign system)
        const state = getGameState();
        if (state.operation?.currentRoomId) {
          markRoomVisited(state.operation.currentRoomId);
        }
        renderOperationMapScreen();
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
        renderShopScreen(currentReturnTo as "basecamp" | "field" | "operation");
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
    return draft;
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
  const state = getGameState();
  if (state.wad < item.price) {
    showNotification("INSUFFICIENT WAD", "error");
    return;
  }

  // Get return destination from button
  const backBtn = document.getElementById("backBtn");
  const returnTo = (backBtn?.getAttribute("data-return-to") as "basecamp" | "field" | "operation") || "basecamp";

  // Create equipment entry (basic structure - will need proper equipment data)
  const equipmentData = createEquipmentFromShopItem(itemId, item);
  
  updateGameState(draft => {
    draft.wad -= item.price;
    
    // Add to equipmentById
    if (!draft.equipmentById) draft.equipmentById = {};
    draft.equipmentById[itemId] = equipmentData;
    
    // Add to equipmentPool
    if (!draft.equipmentPool) draft.equipmentPool = [];
    if (!draft.equipmentPool.includes(itemId)) {
      draft.equipmentPool.push(itemId);
    }
    
    // Add to inventory baseStorage as InventoryItem
    if (!draft.inventory) {
      draft.inventory = {
        muleClass: "E",
        capacityMassKg: 100,
        capacityBulkBu: 70,
        capacityPowerW: 300,
        forwardLocker: [],
        baseStorage: [],
      };
    }
    
    const inventoryItem: import("../../core/types").InventoryItem = {
      id: itemId,
      name: item.name,
      kind: "equipment",
      stackable: false,
      quantity: 1,
      massKg: getEquipmentMass(itemId, item),
      bulkBu: getEquipmentBulk(itemId, item),
      powerW: getEquipmentPower(itemId, item),
    };
    
    // Check if already in baseStorage
    const existingIndex = draft.inventory.baseStorage.findIndex(i => i.id === itemId);
    if (existingIndex >= 0) {
      // Equipment doesn't stack, but we can increment quantity for tracking
      draft.inventory.baseStorage[existingIndex].quantity += 1;
    } else {
      draft.inventory.baseStorage.push(inventoryItem);
    }
    
    return draft;
  });
  
  showNotification(`${item.name} added to inventory!`, "success");
  renderShopScreen(returnTo);
}

function purchaseConsumable(itemId: string, item: ShopItem): void {
  const state = getGameState();
  if (state.wad < item.price) {
    showNotification("INSUFFICIENT WAD", "error");
    return;
  }

  // Get return destination from button
  const backBtn = document.getElementById("backBtn");
  const returnTo = (backBtn?.getAttribute("data-return-to") as "basecamp" | "field" | "operation") || "basecamp";

  updateGameState(draft => {
    draft.wad -= item.price;
    
    // Add to consumables Record (consumable ID -> quantity)
    if (!draft.consumables) draft.consumables = {};
    const newQuantity = (draft.consumables[itemId] || 0) + 1;
    draft.consumables[itemId] = newQuantity;
    
    // Also add to inventory baseStorage as InventoryItem for organization
    if (!draft.inventory) {
      draft.inventory = {
        muleClass: "E",
        capacityMassKg: 100,
        capacityBulkBu: 70,
        capacityPowerW: 300,
        forwardLocker: [],
        baseStorage: [],
      };
    }
    
    const inventoryItem: import("../../core/types").InventoryItem = {
      id: itemId,
      name: item.name,
      kind: "consumable",
      stackable: true,
      quantity: newQuantity,
      massKg: getConsumableMass(itemId),
      bulkBu: getConsumableBulk(itemId),
      powerW: getConsumablePower(itemId),
    };
    
    // Update or add to baseStorage
    const existingIndex = draft.inventory.baseStorage.findIndex(i => i.id === itemId);
    if (existingIndex >= 0) {
      draft.inventory.baseStorage[existingIndex].quantity = newQuantity;
    } else {
      draft.inventory.baseStorage.push(inventoryItem);
    }
    
    return draft;
  });
  
  showNotification(`${item.name} added to supplies!`, "success");
  renderShopScreen(returnTo);
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

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Create basic equipment data structure from shop item
 * Maps to existing equipment database or creates new entry
 */
function createEquipmentFromShopItem(itemId: string, item: ShopItem): any {
  // First, try to get from existing equipment database
  const existingEquipment = getAllStarterEquipment();
  
  if (existingEquipment[itemId]) {
    // Equipment already exists in database, return it
    return existingEquipment[itemId];
  }
  
  // Create new equipment entry
  const isWeapon = itemId.startsWith("weapon_");
  const isArmor = itemId.startsWith("armor_");
  const isAccessory = itemId.startsWith("accessory_");
  
  if (isWeapon) {
    // Determine weapon type from name/ID
    let weaponType: string = "sword";
    if (itemId.includes("bow")) weaponType = "bow";
    else if (itemId.includes("gun")) weaponType = "gun";
    else if (itemId.includes("staff")) weaponType = "staff";
    else if (itemId.includes("dagger")) weaponType = "dagger";
    
    return {
      id: itemId,
      name: item.name,
      slot: "weapon",
      weaponType,
      isMechanical: itemId.includes("gun") || itemId.includes("steam"),
      stats: { atk: 2, def: 0, agi: 0, acc: 0, hp: 0 }, // Basic stats
      cardsGranted: [], // Will be empty for shop-bought items
      moduleSlots: 1,
      attachedModules: [],
      wear: 0,
    };
  } else if (isArmor) {
    const slot = itemId.includes("helmet") || itemId.includes("hood") || itemId.includes("circlet") ? "helmet" : "chestpiece";
    // Basic stats based on description
    let stats = { atk: 0, def: 1, agi: 0, acc: 0, hp: 0 };
    if (itemId.includes("leather")) {
      stats = { atk: 0, def: 1, agi: 1, acc: 0, hp: 0 };
    }
    return {
      id: itemId,
      name: item.name,
      slot,
      stats,
      cardsGranted: [],
    };
  } else if (isAccessory) {
    // Basic stats based on description
    let stats = { atk: 0, def: 0, agi: 1, acc: 0, hp: 0 };
    if (itemId.includes("fleetfoot")) {
      stats = { atk: 0, def: 0, agi: 2, acc: 0, hp: 0 };
    }
    return {
      id: itemId,
      name: item.name,
      slot: "accessory",
      stats,
      cardsGranted: [],
    };
  }
  
  // Default fallback
  return {
    id: itemId,
    name: item.name,
    slot: "accessory",
    stats: { atk: 0, def: 0, agi: 0, acc: 0, hp: 0 },
    cardsGranted: [],
  };
}

/**
 * Get mass (kg) for equipment items
 */
function getEquipmentMass(itemId: string, _item: ShopItem): number {
  // Equipment mass based on type
  if (itemId.startsWith("weapon_")) {
    if (itemId.includes("great")) return 8; // Greatsword/greatbow
    if (itemId.includes("bow")) return 3;
    if (itemId.includes("gun")) return 5;
    return 4; // Standard weapon
  } else if (itemId.startsWith("armor_")) {
    if (itemId.includes("leather")) return 2;
    if (itemId.includes("plate")) return 6;
    return 3; // Default armor
  } else if (itemId.startsWith("accessory_")) {
    return 0.5; // Accessories are light
  }
  return 2; // Default
}

/**
 * Get bulk (bu) for equipment items
 */
function getEquipmentBulk(itemId: string, _item: ShopItem): number {
  if (itemId.startsWith("weapon_")) {
    if (itemId.includes("great")) return 4;
    if (itemId.includes("bow")) return 3;
    return 2;
  } else if (itemId.startsWith("armor_")) {
    return 2;
  } else if (itemId.startsWith("accessory_")) {
    return 0.5;
  }
  return 1;
}

/**
 * Get power (w) for equipment items
 */
function getEquipmentPower(itemId: string, _item: ShopItem): number {
  if (itemId.startsWith("weapon_")) {
    if (itemId.includes("gun") || itemId.includes("steam")) return 15; // Mechanical weapons
    return 5; // Standard weapons
  } else if (itemId.startsWith("armor_")) {
    return 3;
  } else if (itemId.startsWith("accessory_")) {
    return 2;
  }
  return 3;
}

/**
 * Get mass (kg) for consumable items
 */
function getConsumableMass(itemId: string): number {
  // Consumables are generally light
  if (itemId.includes("kit")) return 1;
  if (itemId.includes("bomb") || itemId.includes("grenade")) return 0.5;
  return 0.3; // Default consumable
}

/**
 * Get bulk (bu) for consumable items
 */
function getConsumableBulk(itemId: string): number {
  if (itemId.includes("kit")) return 1;
  if (itemId.includes("bomb") || itemId.includes("grenade")) return 0.5;
  return 0.3;
}

/**
 * Get power (w) for consumable items
 */
function getConsumablePower(_itemId: string): number {
  // Consumables generally don't use power
  return 0;
}

export { renderShopScreen as default };
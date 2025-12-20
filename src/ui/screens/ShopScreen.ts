// ============================================================================
// CHAOS CORE - SHOP SCREEN (Headline 12x - Improved)
// src/ui/screens/ShopScreen.ts
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderAllNodesMenuScreen } from "./AllNodesMenuScreen";
import { renderFieldScreen } from "../../field/FieldScreen";
import { renderOperationMapScreen, markRoomVisited } from "./OperationMapScreen";
import { 
  PAK_DATABASE, 
  openPAK, 
  addCardsToLibrary,
  LIBRARY_CARD_DATABASE 
} from "../../core/gearWorkbench";
import { getAllStarterEquipment } from "../../core/equipment";
import { getShopEligibleUnlockables, getUnlockableById, getUnownedUnlockables } from "../../core/unlockables";
import { getAllOwnedUnlockableIds } from "../../core/unlockableOwnership";
import { getSellableEntries, sellToShop, SellLine, SellableEntry } from "../../core/shopSell";

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

const RECIPE_ITEMS: ShopItem[] = [
  {
    id: "recipe_emberclaw_repeater",
    name: "Emberclaw Repeater Blueprint",
    description: "Learn to craft a mechanical repeater weapon.",
    price: 150,
    category: "recipe",
    rarity: "uncommon"
  },
  {
    id: "recipe_brassback_scattergun",
    name: "Brassback Scattergun Schematic",
    description: "Learn to craft a steam-powered shotgun.",
    price: 180,
    category: "recipe",
    rarity: "uncommon"
  },
  {
    id: "recipe_blazefang_saber",
    name: "Blazefang Saber Pattern",
    description: "Learn to craft a steam-heated blade.",
    price: 200,
    category: "recipe",
    rarity: "rare"
  },
  {
    id: "recipe_steam_valve_wristguard",
    name: "Steam Valve Wristguard Blueprint",
    description: "Learn to craft a heat-venting accessory.",
    price: 120,
    category: "recipe",
    rarity: "common"
  },
  {
    id: "recipe_coolant_flask",
    name: "Coolant Flask Formula",
    description: "Learn to craft a heat-removing consumable.",
    price: 100,
    category: "recipe",
    rarity: "uncommon"
  },
  {
    id: "recipe_overcharge_cell",
    name: "Overcharge Cell Formula",
    description: "Learn to craft a power-boosting consumable.",
    price: 110,
    category: "recipe",
    rarity: "uncommon"
  },
  {
    id: "recipe_blazefang_saber_plus1",
    name: "Blazefang Saber +1 Upgrade",
    description: "Learn to upgrade the Blazefang Saber.",
    price: 250,
    category: "recipe",
    rarity: "rare"
  }
];

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

let currentTab: "paks" | "equipment" | "consumables" | "recipes" | "unlockables" | "sell" = "paks";

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
        <button class="shop-tab ${currentTab === 'recipes' ? 'shop-tab--active' : ''}" data-tab="recipes">
          <span class="tab-icon">📜</span>
          <span class="tab-text">RECIPES</span>
        </button>
        <button class="shop-tab ${currentTab === 'unlockables' ? 'shop-tab--active' : ''}" data-tab="unlockables">
          <span class="tab-icon">🔓</span>
          <span class="tab-text">WEAPON PARTS</span>
        </button>
        <button class="shop-tab ${currentTab === 'sell' ? 'shop-tab--active' : ''}" data-tab="sell">
          <span class="tab-icon">💰</span>
          <span class="tab-text">SELL</span>
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
    case "recipes":
      // Filter out recipes that are already known
      const knownRecipeIds = state.knownRecipeIds || [];
      items = RECIPE_ITEMS.filter(item => !knownRecipeIds.includes(item.id));
      sectionTitle = "CRAFTING RECIPES";
      sectionDesc = "Learn new schematics and blueprints for the workshop.";
      break;
    case "unlockables":
      // Generate unlockable items dynamically
      try {
        const owned = getAllOwnedUnlockableIds();
        const allOwnedIds = [...owned.chassis, ...owned.doctrines];
        const eligible = getShopEligibleUnlockables();
        const unowned = getUnownedUnlockables(allOwnedIds);
        
        // Convert to ShopItem format
        items = unowned.map(unlock => ({
          id: unlock.id,
          name: unlock.displayName,
          description: unlock.description,
          price: unlock.cost?.wad || (unlock.cost?.metalScrap || 0) * 5 + (unlock.cost?.wood || 0) * 3 + (unlock.cost?.chaosShards || 0) * 10 + (unlock.cost?.steamComponents || 0) * 15,
          category: "unlockable" as any,
          rarity: unlock.rarity,
        }));
        
        sectionTitle = "WEAPON PARTS";
        sectionDesc = "Chassis, doctrines, and field modifications for the gear builder.";
      } catch (err) {
        console.warn("[SHOP] Could not load unlockables:", err);
        items = [];
        sectionTitle = "WEAPON PARTS";
        sectionDesc = "No weapon parts available.";
      }
      break;
    case "sell":
      return renderSellTab(state);
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
  const isRecipe = item.category === 'recipe';
  const isKnown = isRecipe && state.knownRecipeIds && state.knownRecipeIds.includes(item.id);
  
  return `
    <div class="shop-item ${rarityClass} ${!canAfford || isKnown ? 'shop-item--disabled' : ''}" data-item-id="${item.id}">
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
        ${isKnown ? `
          <div class="shop-item-meta">
            <span class="meta-tag" style="color: #35ff95;">ALREADY LEARNED</span>
          </div>
        ` : ''}
      </div>
      <div class="shop-item-footer">
        <div class="shop-item-price">
          <span class="price-value">${item.price}</span>
          <span class="price-label">WAD</span>
        </div>
        <button class="shop-buy-btn ${!canAfford || isKnown ? 'shop-buy-btn--disabled' : ''}" 
                data-item-id="${item.id}"
                data-category="${item.category}"
                ${!canAfford || isKnown ? 'disabled' : ''}>
          ${isKnown ? 'KNOWN' : canAfford ? 'PURCHASE' : 'INSUFFICIENT'}
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
        renderAllNodesMenuScreen();
      }
    };
  }
  
  // Tab buttons - preserve return destination when switching tabs
  document.querySelectorAll(".shop-tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
      const tabName = (e.currentTarget as HTMLElement).getAttribute("data-tab");
      if (tabName) {
        currentTab = tabName as "paks" | "equipment" | "consumables" | "recipes" | "unlockables" | "sell";
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
  
  // Sell tab handlers (only attach if sell tab is active)
  if (currentTab === "sell") {
    attachSellListeners(returnTo);
  }

  // ESC and E key handlers to exit to field mode (only when opened from field)
  if (returnTo === "field") {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase() ?? "";
      if (key === "escape" || e.key === "Escape" || e.keyCode === 27 || key === "e") {
        // Only exit if E key and not typing in an input
        if (key === "e") {
          const target = e.target as HTMLElement;
          if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
            return; // Don't exit if typing in an input
          }
        }
        e.preventDefault();
        e.stopPropagation();
        renderFieldScreen("base_camp");
        window.removeEventListener("keydown", handleKeyDown);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
  }
}

function purchaseItem(itemId: string, category: ShopItem["category"]): void {
  const allItems = [...PAK_ITEMS, ...EQUIPMENT_ITEMS, ...CONSUMABLE_ITEMS, ...RECIPE_ITEMS];
  let item = allItems.find(i => i.id === itemId);
  
  // If not found in static items, check if it's an unlockable
  if (!item && category === "unlockable") {
    try {
      const unlock = getUnlockableById(itemId);
      if (unlock) {
        item = {
          id: unlock.id,
          name: unlock.displayName,
          description: unlock.description,
          price: unlock.cost?.wad || (unlock.cost?.metalScrap || 0) * 5 + (unlock.cost?.wood || 0) * 3 + (unlock.cost?.chaosShards || 0) * 10 + (unlock.cost?.steamComponents || 0) * 15,
          category: "unlockable" as any,
          rarity: unlock.rarity,
        };
      }
    } catch (err) {
      console.warn("[SHOP] Could not load unlockable:", err);
    }
  }
  
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
  } else if (category === "recipe") {
    purchaseRecipe(itemId, item);
  } else if (category === "unlockable") {
    purchaseUnlockable(itemId, item);
  }
}

function purchaseRecipe(itemId: string, item: ShopItem): void {
  const state = getGameState();
  
  // Check if already known
  if (state.knownRecipeIds && state.knownRecipeIds.includes(itemId)) {
    showNotification("RECIPE ALREADY KNOWN", "error");
    return;
  }
  
  // Deduct WAD and learn recipe
  import("../../core/crafting").then(({ learnRecipe, RECIPE_DATABASE }) => {
    const recipe = RECIPE_DATABASE[itemId];
    if (!recipe) {
      showNotification("INVALID RECIPE", "error");
      return;
    }
    
    updateGameState(s => ({
      ...s,
      wad: s.wad - item.price,
      knownRecipeIds: learnRecipe(s.knownRecipeIds || [], itemId),
    }));
    
    showNotification(`LEARNED: ${recipe.name}`, "success");
    renderShopScreen((document.getElementById("backBtn") as HTMLElement)?.getAttribute("data-return-to") as "basecamp" | "field" | "operation" || "basecamp");
  }).catch((err: any) => {
    console.error("[SHOP] Failed to purchase recipe:", err);
    showNotification("PURCHASE FAILED", "error");
  });
}

function purchaseUnlockable(itemId: string, item: ShopItem): void {
  const state = getGameState();
  
  // Check if already owned
  import("../../core/unlockableOwnership").then(({ hasUnlock, grantUnlock }) => {
    if (hasUnlock(itemId)) {
      showNotification("ALREADY OWNED", "error");
      return;
    }
    
    // Deduct WAD and grant unlock
    updateGameState(s => ({
      ...s,
      wad: s.wad - item.price,
    }));
    
    grantUnlock(itemId, "shop_purchase");
    showNotification(`UNLOCKED: ${item.name}`, "success");
    
    // Refresh shop screen
    const returnTo = (document.getElementById("backBtn") as HTMLElement)?.getAttribute("data-return-to") as "basecamp" | "field" | "operation" || "basecamp";
    renderShopScreen(returnTo);
  }).catch((err: any) => {
    console.error("[SHOP] Failed to purchase unlockable:", err);
    showNotification("PURCHASE FAILED", "error");
  });
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

// ----------------------------------------------------------------------------
// SELL TAB
// ----------------------------------------------------------------------------

let sellCategoryFilter: "all" | "equipment" | "consumable" | "weaponPart" | "resource" = "all";
let sellSelectedLines: Map<string, number> = new Map(); // key -> quantity

function renderSellTab(state: any): string {
  const entries = getSellableEntries(state);
  
  // Filter by category
  const filteredEntries = sellCategoryFilter === "all"
    ? entries
    : entries.filter(e => e.kind === sellCategoryFilter);
  
  // Sort: equipped/locked items last
  filteredEntries.sort((a, b) => {
    if (a.equipped && !b.equipped) return 1;
    if (!a.equipped && b.equipped) return -1;
    if (a.locked && !b.locked) return 1;
    if (!a.locked && b.locked) return -1;
    return a.name.localeCompare(b.name);
  });
  
  // Calculate transaction summary
  let totalWad = 0;
  const selectedItems: Array<{ entry: SellableEntry; quantity: number }> = [];
  for (const [key, quantity] of sellSelectedLines.entries()) {
    const entry = entries.find(e => e.key === key);
    if (entry && quantity > 0) {
      selectedItems.push({ entry, quantity });
      totalWad += entry.unitSellPrice * quantity;
    }
  }
  
  return `
    <div class="sell-layout">
      <!-- Left: Category Filter -->
      <div class="sell-sidebar">
        <div class="panel-section-title">CATEGORIES</div>
        <div class="sell-category-list">
          <button class="sell-category-btn ${sellCategoryFilter === 'all' ? 'sell-category-btn--active' : ''}" 
                  data-category="all">
            ALL
          </button>
          <button class="sell-category-btn ${sellCategoryFilter === 'equipment' ? 'sell-category-btn--active' : ''}" 
                  data-category="equipment">
            EQUIPMENT
          </button>
          <button class="sell-category-btn ${sellCategoryFilter === 'consumable' ? 'sell-category-btn--active' : ''}" 
                  data-category="consumable">
            CONSUMABLES
          </button>
          <button class="sell-category-btn ${sellCategoryFilter === 'weaponPart' ? 'sell-category-btn--active' : ''}" 
                  data-category="weaponPart">
            WEAPON PARTS
          </button>
          <button class="sell-category-btn ${sellCategoryFilter === 'resource' ? 'sell-category-btn--active' : ''}" 
                  data-category="resource">
            RESOURCES
          </button>
        </div>
      </div>
      
      <!-- Center: Item List -->
      <div class="sell-main">
        <div class="panel-section-title">SELLABLE ITEMS</div>
        <div class="sell-item-list">
          ${filteredEntries.length === 0
            ? '<div class="sell-empty">No items available in this category.</div>'
            : filteredEntries.map(entry => renderSellItem(entry)).join('')
          }
        </div>
      </div>
      
      <!-- Right: Transaction Summary -->
      <div class="sell-summary">
        <div class="panel-section-title">TRANSACTION</div>
        <div class="sell-summary-content">
          ${selectedItems.length === 0
            ? '<div class="sell-summary-empty">Select items to sell</div>'
            : `
              <div class="sell-summary-items">
                ${selectedItems.map(({ entry, quantity }) => `
                  <div class="sell-summary-item">
                    <span class="summary-item-name">${entry.name}</span>
                    <span class="summary-item-qty">×${quantity}</span>
                    <span class="summary-item-price">${entry.unitSellPrice * quantity} WAD</span>
                  </div>
                `).join('')}
              </div>
              <div class="sell-summary-total">
                <div class="summary-total-label">TOTAL:</div>
                <div class="summary-total-value">${totalWad} WAD</div>
              </div>
              <button class="sell-confirm-btn" id="sellConfirmBtn" ${selectedItems.length === 0 ? 'disabled' : ''}>
                CONFIRM SELL
              </button>
            `
          }
        </div>
      </div>
    </div>
  `;
}

function renderSellItem(entry: SellableEntry): string {
  const selectedQty = sellSelectedLines.get(entry.key) || 0;
  const canSell = !entry.equipped && !entry.locked && entry.owned > 0;
  const maxQty = entry.stackable ? entry.owned : 1;
  
  return `
    <div class="sell-item ${!canSell ? 'sell-item--disabled' : ''}" data-entry-key="${entry.key}">
      <div class="sell-item-info">
        <div class="sell-item-name">${entry.name}</div>
        <div class="sell-item-meta">
          <span class="sell-item-owned">Owned: ${entry.owned}</span>
          ${entry.equipped ? '<span class="sell-item-status sell-item-status--equipped">EQUIPPED</span>' : ''}
          ${entry.locked ? '<span class="sell-item-status sell-item-status--locked">LOCKED</span>' : ''}
        </div>
      </div>
      <div class="sell-item-price">${entry.unitSellPrice} WAD</div>
      ${canSell ? `
        <div class="sell-item-controls">
          ${entry.stackable ? `
            <input type="number" 
                   class="sell-qty-input" 
                   data-entry-key="${entry.key}"
                   min="1" 
                   max="${maxQty}" 
                   value="${selectedQty}"
                   placeholder="0">
          ` : `
            <button class="sell-toggle-btn ${selectedQty > 0 ? 'sell-toggle-btn--active' : ''}" 
                    data-entry-key="${entry.key}">
              ${selectedQty > 0 ? 'SELECTED' : 'SELECT'}
            </button>
          `}
        </div>
      ` : ''}
    </div>
  `;
}

function attachSellListeners(returnTo: "basecamp" | "field" | "operation"): void {
  // Category filter buttons
  document.querySelectorAll(".sell-category-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const category = (e.currentTarget as HTMLElement).getAttribute("data-category");
      if (category) {
        sellCategoryFilter = category as typeof sellCategoryFilter;
        const currentReturnTo = (document.getElementById("backBtn") as HTMLElement)?.getAttribute("data-return-to") || returnTo;
        renderShopScreen(currentReturnTo as "basecamp" | "field" | "operation");
      }
    });
  });
  
  // Quantity inputs (for stackables)
  document.querySelectorAll(".sell-qty-input").forEach(input => {
    const el = input as HTMLInputElement;
    el.addEventListener("change", () => {
      const key = el.getAttribute("data-entry-key");
      if (key) {
        const qty = parseInt(el.value) || 0;
        if (qty > 0) {
          sellSelectedLines.set(key, qty);
        } else {
          sellSelectedLines.delete(key);
        }
        const currentReturnTo = (document.getElementById("backBtn") as HTMLElement)?.getAttribute("data-return-to") || returnTo;
        renderShopScreen(currentReturnTo as "basecamp" | "field" | "operation");
      }
    });
  });
  
  // Toggle buttons (for non-stackables)
  document.querySelectorAll(".sell-toggle-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const key = (e.currentTarget as HTMLElement).getAttribute("data-entry-key");
      if (key) {
        const current = sellSelectedLines.get(key) || 0;
        if (current > 0) {
          sellSelectedLines.delete(key);
        } else {
          sellSelectedLines.set(key, 1);
        }
        const currentReturnTo = (document.getElementById("backBtn") as HTMLElement)?.getAttribute("data-return-to") || returnTo;
        renderShopScreen(currentReturnTo as "basecamp" | "field" | "operation");
      }
    });
  });
  
  // Confirm sell button
  const confirmBtn = document.getElementById("sellConfirmBtn");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      const state = getGameState();
      const entries = getSellableEntries(state);
      
      // Build sell lines
      const lines: SellLine[] = [];
      for (const [key, quantity] of sellSelectedLines.entries()) {
        const entry = entries.find(e => e.key === key);
        if (entry && quantity > 0) {
          lines.push({
            kind: entry.kind,
            id: entry.id,
            quantity,
          });
        }
      }
      
      if (lines.length === 0) {
        showNotification("No items selected", "error");
        return;
      }
      
      // Execute transaction
      const result = sellToShop(state, lines);
      
      if ("error" in result) {
        showNotification(result.error, "error");
        return;
      }
      
      // Apply state update (merge result.next into current state)
      updateGameState(draft => {
        // Merge all changes from result.next
        Object.assign(draft, result.next);
        return draft;
      });
      
      // Clear selection
      sellSelectedLines.clear();
      
      showNotification(`Sold items for ${result.wadGained} WAD`, "success");
      
      // Re-render
      const currentReturnTo = (document.getElementById("backBtn") as HTMLElement)?.getAttribute("data-return-to") || returnTo;
      renderShopScreen(currentReturnTo as "basecamp" | "field" | "operation");
    });
  }
}

export { renderShopScreen as default };
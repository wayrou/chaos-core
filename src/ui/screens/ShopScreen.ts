// ============================================================================
// CHAOS CORE - SHOP SCREEN (Headline 12x - Improved)
// src/ui/screens/ShopScreen.ts
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import {
  BaseCampReturnTo,
  getBaseCampReturnLabel,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";
import { markOperationRoomVisited, renderActiveOperationSurface } from "./activeOperationFlow";
import { 
  PAK_DATABASE, 
  openPAK, 
  addCardsToLibrary,
  LIBRARY_CARD_DATABASE 
} from "../../core/gearWorkbench";
import { getAllStarterEquipment } from "../../core/equipment";
import { getUnlockableById, getUnownedUnlockables } from "../../core/unlockables";
import { getAllOwnedUnlockableIdList } from "../../core/unlockableOwnership";
import { getSellableEntries, sellToShop, SellLine, SellableEntry } from "../../core/shopSell";
import { showSystemPing } from "../components/systemPing";
import { clearControllerContext, updateFocusableElements } from "../../core/controllerSupport";
import { getInventoryIconPath } from "../../core/inventoryIcons";
import { getResourceEntries, RESOURCE_KEYS, type ResourceKey } from "../../core/resources";
import {
  canSessionAffordCost,
  getLocalSessionPlayerSlot,
  getSessionResourcePool,
  spendSessionCost,
} from "../../core/session";

// ----------------------------------------------------------------------------
// SHOP DATA
// ----------------------------------------------------------------------------

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "pak" | "equipment" | "consumable" | "recipe" | "unlockable";
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

const SHOP_RESOURCE_PRICE_WEIGHTS: Record<ResourceKey, number> = {
  metalScrap: 5,
  wood: 3,
  chaosShards: 10,
  steamComponents: 15,
  alloy: 18,
  drawcord: 12,
  fittings: 14,
  resin: 12,
  chargeCells: 20,
};

function estimateUnlockablePrice(cost?: Partial<Record<ResourceKey, number>> & { wad?: number }): number {
  if (!cost) {
    return 0;
  }

  if ((cost.wad ?? 0) > 0) {
    return cost.wad ?? 0;
  }

  return RESOURCE_KEYS.reduce((total, key) => total + ((cost[key] ?? 0) * SHOP_RESOURCE_PRICE_WEIGHTS[key]), 0);
}

function getQuartermasterWallet(state = getGameState()) {
  return getSessionResourcePool(state, getLocalSessionPlayerSlot(state));
}

export function renderShopScreen(returnTo: BaseCampReturnTo | "operation" = "basecamp"): void {
  const app = document.getElementById("app");
  if (!app) return;
  document.body.setAttribute("data-screen", "shop");
  clearControllerContext();
  
  const state = getGameState();
  const wallet = getQuartermasterWallet(state);
  const resources = wallet.resources;
  const fallbackInventoryIcon = getInventoryIconPath();
  const backButtonText = returnTo === "operation" ? "ACTIVE OPERATION" : getBaseCampReturnLabel(returnTo);
  
  app.innerHTML = `
    <div class="shop-root town-screen town-screen--shop">
      <!-- Header -->
      <div class="shop-header town-screen__header">
        <div class="shop-header-left town-screen__titleblock">
          <h1 class="shop-title">QUARTERMASTER</h1>
          <div class="shop-subtitle">S/COM_OS SUPPLY TERMINAL</div>
        </div>
        <div class="shop-header-right town-screen__header-right">
          <div class="shop-wallet">
            <span class="wallet-label">AVAILABLE WAD</span>
            <span class="wallet-value">${wallet.wad.toLocaleString()}</span>
          </div>
          <button class="shop-back-btn town-screen__back-btn" id="backBtn" data-return-to="${returnTo}">
            <span class="btn-icon">←</span>
            <span class="btn-text">${backButtonText}</span>
          </button>
        </div>
      </div>
      
      <!-- Tabs -->
      <div class="shop-tabs town-screen__subnav">
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
          <span class="tab-text">UNLOCKS</span>
        </button>
        <button class="shop-tab ${currentTab === 'sell' ? 'shop-tab--active' : ''}" data-tab="sell">
          <span class="tab-icon">💰</span>
          <span class="tab-text">SELL</span>
        </button>
      </div>
      
      <!-- Content -->
      <div class="shop-content town-screen__content-panel">
        ${renderShopContent(state)}
      </div>
      
      <!-- Resources Footer -->
      <div class="shop-footer">
        <div class="resource-display">
          <div class="resource-item">
            <img src="${fallbackInventoryIcon}" alt="" class="resource-icon-img" aria-hidden="true" />
            <span class="resource-value">${resources.metalScrap ?? 0}</span>
            <span class="resource-label">Metal</span>
          </div>
          <div class="resource-item">
            <img src="${fallbackInventoryIcon}" alt="" class="resource-icon-img" aria-hidden="true" />
            <span class="resource-value">${resources.wood ?? 0}</span>
            <span class="resource-label">Wood</span>
          </div>
          <div class="resource-item">
            <img src="${fallbackInventoryIcon}" alt="" class="resource-icon-img" aria-hidden="true" />
            <span class="resource-value">${resources.chaosShards ?? 0}</span>
            <span class="resource-label">Shards</span>
          </div>
          <div class="resource-item">
            <img src="${fallbackInventoryIcon}" alt="" class="resource-icon-img" aria-hidden="true" />
            <span class="resource-value">${resources.steamComponents ?? 0}</span>
            <span class="resource-label">Steam</span>
          </div>
          ${getResourceEntries(resources, { includeZero: true }).filter((entry) => (
            entry.key === "alloy"
            || entry.key === "drawcord"
            || entry.key === "fittings"
            || entry.key === "resin"
            || entry.key === "chargeCells"
          )).map((entry) => `
            <div class="resource-item">
              <img src="${fallbackInventoryIcon}" alt="" class="resource-icon-img" aria-hidden="true" />
              <span class="resource-value">${entry.amount}</span>
              <span class="resource-label">${entry.label}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
  
  attachShopListeners(returnTo);
  updateFocusableElements();
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
        const unowned = getUnownedUnlockables(getAllOwnedUnlockableIdList());
        
        // Convert to ShopItem format
        items = unowned.map(unlock => ({
          id: unlock.id,
          name: unlock.displayName,
          description: unlock.description,
          price: estimateUnlockablePrice(unlock.cost),
          category: "unlockable" as any,
          rarity: unlock.rarity,
        }));
        
        sectionTitle = "UNLOCKABLES";
        sectionDesc = "Permanent unlocks including chassis, doctrines, tactical mods, and Haven decor pieces.";
      } catch (err) {
        console.warn("[SHOP] Could not load unlockables:", err);
        items = [];
        sectionTitle = "UNLOCKABLES";
        sectionDesc = "No unlocks available.";
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
  const canAfford = canSessionAffordCost(state, { wad: item.price });
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

function attachShopListeners(returnTo: BaseCampReturnTo | "operation" = "basecamp"): void {
  // Back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    // Get return destination from button's data attribute or parameter
    const returnDestination = (backBtn as HTMLElement).getAttribute("data-return-to") || returnTo;
    backBtn.onclick = () => {
      unregisterBaseCampReturnHotkey("shop-screen");
      if (returnDestination === "operation") {
        // Mark the current room as visited when leaving the shop (uses campaign system)
        const state = getGameState();
        if (state.operation?.currentRoomId) {
          markOperationRoomVisited(state.operation.currentRoomId);
        }
        renderActiveOperationSurface();
      } else {
        returnFromBaseCampScreen(returnDestination as BaseCampReturnTo);
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
        renderShopScreen(currentReturnTo as BaseCampReturnTo | "operation");
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

  if (returnTo !== "operation") {
    registerBaseCampReturnHotkey("shop-screen", returnTo, { allowFieldEKey: true, activeSelector: ".shop-root" });
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
          price: estimateUnlockablePrice(unlock.cost),
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
  if (!canSessionAffordCost(state, { wad: item.price })) {
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
    
    updateGameState((s) => {
      const spendResult = spendSessionCost(s, { wad: item.price });
      if (!spendResult.success) {
        return s;
      }

      return {
        ...spendResult.state,
        knownRecipeIds: learnRecipe(spendResult.state.knownRecipeIds || [], itemId),
      };
    });
    
    showNotification(`LEARNED: ${recipe.name}`, "success");
    renderShopScreen((document.getElementById("backBtn") as HTMLElement)?.getAttribute("data-return-to") as BaseCampReturnTo | "operation" || "basecamp");
  }).catch((err: any) => {
    console.error("[SHOP] Failed to purchase recipe:", err);
    showNotification("PURCHASE FAILED", "error");
  });
}

function purchaseUnlockable(itemId: string, item: ShopItem): void {
  // Check if already owned
  import("../../core/unlockableOwnership").then(({ hasUnlock, grantUnlock }) => {
    if (hasUnlock(itemId)) {
      showNotification("ALREADY OWNED", "error");
      return;
    }
    
    // Deduct WAD and grant unlock
    updateGameState((s) => {
      const spendResult = spendSessionCost(s, { wad: item.price });
      return spendResult.success ? spendResult.state : s;
    });
    
    grantUnlock(itemId, "shop_purchase");
    showNotification(`UNLOCKED: ${item.name}`, "success");
    
    // Refresh shop screen
    const returnTo = (document.getElementById("backBtn") as HTMLElement)?.getAttribute("data-return-to") as BaseCampReturnTo | "operation" || "basecamp";
    renderShopScreen(returnTo);
  }).catch((err: any) => {
    console.error("[SHOP] Failed to purchase unlockable:", err);
    showNotification("PURCHASE FAILED", "error");
  });
}

function purchasePAK(pakId: string, item: ShopItem): void {
  const backBtn = document.getElementById("backBtn");
  const returnTo = (backBtn?.getAttribute("data-return-to") as BaseCampReturnTo | "operation") || "basecamp";

  // Open the PAK and get cards
  const cards = openPAK(pakId);
  
  // Update state
  updateGameState((draft) => {
    const spendResult = spendSessionCost(draft, { wad: item.price });
    if (!spendResult.success) {
      return draft;
    }

    return {
      ...spendResult.state,
      cardLibrary: addCardsToLibrary(spendResult.state.cardLibrary ?? {}, cards),
    };
  });

  showPurchaseModal(item.name, cards, "Recovered card set:");
  
  // Re-render shop
  renderShopScreen(returnTo);
}

function purchaseEquipment(itemId: string, item: ShopItem): void {
  const state = getGameState();
  if (!canSessionAffordCost(state, { wad: item.price })) {
    showNotification("INSUFFICIENT WAD", "error");
    return;
  }

  // Get return destination from button
  const backBtn = document.getElementById("backBtn");
  const returnTo = (backBtn?.getAttribute("data-return-to") as BaseCampReturnTo | "operation") || "basecamp";

  // Create equipment entry (basic structure - will need proper equipment data)
  const equipmentData = createEquipmentFromShopItem(itemId, item);
  
  updateGameState((draft) => {
    const spendResult = spendSessionCost(draft, { wad: item.price });
    if (!spendResult.success) {
      return draft;
    }

    const next = { ...spendResult.state };

    if (!next.equipmentById) next.equipmentById = {};
    next.equipmentById[itemId] = equipmentData;

    if (!next.equipmentPool) next.equipmentPool = [];
    if (!next.equipmentPool.includes(itemId)) {
      next.equipmentPool.push(itemId);
    }

    if (!next.inventory) {
      next.inventory = {
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
    const existingIndex = next.inventory.baseStorage.findIndex(i => i.id === itemId);
    if (existingIndex >= 0) {
      next.inventory.baseStorage[existingIndex].quantity += 1;
    } else {
      next.inventory.baseStorage.push(inventoryItem);
    }
    
    return next;
  });
  
  showNotification(`${item.name} added to inventory!`, "success");
  renderShopScreen(returnTo);
}

function purchaseConsumable(itemId: string, item: ShopItem): void {
  const state = getGameState();
  if (!canSessionAffordCost(state, { wad: item.price })) {
    showNotification("INSUFFICIENT WAD", "error");
    return;
  }

  // Get return destination from button
  const backBtn = document.getElementById("backBtn");
  const returnTo = (backBtn?.getAttribute("data-return-to") as BaseCampReturnTo | "operation") || "basecamp";

  updateGameState((draft) => {
    const spendResult = spendSessionCost(draft, { wad: item.price });
    if (!spendResult.success) {
      return draft;
    }

    const next = { ...spendResult.state };

    if (!next.consumables) next.consumables = {};
    const newQuantity = (next.consumables[itemId] || 0) + 1;
    next.consumables[itemId] = newQuantity;

    if (!next.inventory) {
      next.inventory = {
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
    const existingIndex = next.inventory.baseStorage.findIndex(i => i.id === itemId);
    if (existingIndex >= 0) {
      next.inventory.baseStorage[existingIndex].quantity = newQuantity;
    } else {
      next.inventory.baseStorage.push(inventoryItem);
    }
    
    return next;
  });
  
  showNotification(`${item.name} added to supplies!`, "success");
  renderShopScreen(returnTo);
}

// ----------------------------------------------------------------------------
// UI HELPERS
// ----------------------------------------------------------------------------

function showNotification(message: string, type: "success" | "error" | "info"): void {
  showSystemPing({
    title: type === "error" ? "SHOP ERROR" : type === "success" ? "SHOP CONFIRM" : "SHOP NOTICE",
    message,
    type,
    channel: "shop",
  });
  return;

  /*
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
  */
}

function getShopCardGlyph(category: string): string {
  const icons: Record<string, string> = {
    attack: "⚔",
    defense: "🛡",
    utility: "🔧",
    mobility: "💨",
    buff: "✨",
    debuff: "💀",
    steam: "♨",
    chaos: "🌀",
  };
  return icons[category] ?? "📜";
}

function renderPAKRevealCard(cardId: string, index: number): string {
  const card = LIBRARY_CARD_DATABASE[cardId];
  if (!card) {
    return `
      <div class="shop-pak-reveal-card">
        <div class="battle-cardui">
          <div class="hs-card-cost">?</div>
          <div class="hs-card-type">UNKNOWN</div>
          <div class="hs-card-art">
            <span class="hs-card-art-glyph">?</span>
          </div>
          <div class="hs-card-name-banner">
            <div class="hs-card-name">${cardId}</div>
          </div>
          <div class="hs-card-desc">Recovered data block could not be identified.</div>
          <div class="hs-card-footer">
            <span class="hs-card-stat">DRAW ${index + 1}</span>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="shop-pak-reveal-card library-card library-card--${card.rarity}">
      <div class="battle-cardui">
        <div class="hs-card-cost">${card.strainCost}</div>
        <div class="hs-card-type">${card.category.toUpperCase()}</div>
        <div class="hs-card-art">
          <span class="hs-card-art-glyph">${getShopCardGlyph(card.category)}</span>
        </div>
        <div class="hs-card-name-banner">
          <div class="hs-card-name">${card.name}</div>
        </div>
        <div class="hs-card-desc">${card.description}</div>
        <div class="hs-card-footer">
          <span class="hs-card-stat">${card.rarity.toUpperCase()}</span>
          <span class="hs-card-stat">DRAW ${index + 1}</span>
        </div>
      </div>
    </div>
  `;
}

function showPurchaseModal(itemName: string, cardIds: string[], subtitle: string): void {
  const modal = document.createElement("div");
  modal.className = "shop-modal";
  modal.innerHTML = `
    <div class="shop-modal-content shop-modal-content--pak">
      <div class="shop-modal-header">
        <span class="modal-icon">📦</span>
        <span class="modal-title">DECOMPRESSING ${itemName}...</span>
      </div>
      <div class="shop-modal-body">
        <div class="shop-pak-loader" id="shopPakLoader">
          <div class="shop-pak-terminal">
            <div class="shop-pak-terminal-header">S/COM_OS // ARCHIVE_DECOMPRESS</div>
            <div class="shop-pak-log" id="shopPakLog"></div>
            <div class="shop-pak-progress">
              <div class="shop-pak-progress-bar" id="shopPakProgressBar"></div>
            </div>
          </div>
        </div>
        <div class="shop-pak-results" id="shopPakResults" hidden>
          <p class="modal-subtitle">${subtitle}</p>
          <div class="shop-pak-reveal-status" id="shopPakRevealStatus">Awaiting decompression...</div>
          <div class="shop-pak-reveal-grid" id="shopPakRevealGrid">
          </div>
        </div>
      </div>
      <div class="shop-modal-footer">
        <button class="modal-close-btn" id="closeModalBtn" disabled>CONFIRM</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Animate in
  setTimeout(() => modal.classList.add("shop-modal--visible"), 10);

  const logEl = modal.querySelector<HTMLElement>("#shopPakLog");
  const progressBar = modal.querySelector<HTMLElement>("#shopPakProgressBar");
  const resultsEl = modal.querySelector<HTMLElement>("#shopPakResults");
  const loaderEl = modal.querySelector<HTMLElement>("#shopPakLoader");
  const revealGridEl = modal.querySelector<HTMLElement>("#shopPakRevealGrid");
  const revealStatusEl = modal.querySelector<HTMLElement>("#shopPakRevealStatus");
  const closeBtn = modal.querySelector<HTMLButtonElement>("#closeModalBtn");
  const titleEl = modal.querySelector<HTMLElement>(".modal-title");
  const logLines = [
    `S/COM> Mounting ${itemName} archive...`,
    `S/COM> Verifying tactical signatures...`,
    `S/COM> Inflating card payload blocks...`,
    `S/COM> Syncing recovered data to library...`,
  ];

  let logIndex = 0;
  let closed = false;
  let revealTimer: number | null = null;
  let logTimer: number | null = null;
  let revealedCount = 0;

  const cleanupTimers = () => {
    if (logTimer !== null) {
      window.clearInterval(logTimer);
      logTimer = null;
    }
    if (revealTimer !== null) {
      window.clearTimeout(revealTimer);
      revealTimer = null;
    }
  };

  const closeModal = () => {
    closed = true;
    cleanupTimers();
    modal.classList.remove("shop-modal--visible");
    setTimeout(() => modal.remove(), 300);
  };

  const finishReveal = () => {
    if (closed) return;
    titleEl && (titleEl.textContent = `${itemName} DECOMPRESSED`);
    if (revealStatusEl) {
      revealStatusEl.textContent = `Recovered ${revealedCount}/${cardIds.length} tactical data cards.`;
    }
    if (closeBtn) {
      closeBtn.disabled = false;
      closeBtn.textContent = "CONFIRM";
    }
  };

  const revealNextCard = () => {
    if (closed) return;
    if (!revealGridEl) {
      finishReveal();
      return;
    }
    if (revealedCount >= cardIds.length) {
      finishReveal();
      return;
    }

    revealGridEl.insertAdjacentHTML("beforeend", renderPAKRevealCard(cardIds[revealedCount], revealedCount));
    const newestCard = revealGridEl.lastElementChild as HTMLElement | null;
    newestCard?.classList.add("shop-pak-reveal-card--enter");

    revealedCount += 1;
    if (revealStatusEl) {
      revealStatusEl.textContent = `Recovered card ${revealedCount}/${cardIds.length}...`;
    }
    if (closeBtn) {
      closeBtn.textContent = `REVEALING ${revealedCount}/${cardIds.length}`;
    }

    revealTimer = window.setTimeout(() => {
      newestCard?.classList.remove("shop-pak-reveal-card--enter");
      if (revealedCount >= cardIds.length) {
        finishReveal();
        return;
      }
      revealNextCard();
    }, 280);
  };

  const beginCardReveal = () => {
    if (closed) return;
    loaderEl?.setAttribute("hidden", "true");
    resultsEl?.removeAttribute("hidden");
    titleEl && (titleEl.textContent = `${itemName} CARD REVEAL`);
    if (revealGridEl) {
      revealGridEl.innerHTML = "";
    }
    if (revealStatusEl) {
      revealStatusEl.textContent = "Decompression complete. Revealing tactical rewards...";
    }
    if (closeBtn) {
      closeBtn.disabled = true;
      closeBtn.textContent = `REVEALING 0/${cardIds.length}`;
    }
    revealTimer = window.setTimeout(revealNextCard, 320);
  };

  if (logEl && progressBar) {
    logTimer = window.setInterval(() => {
      if (closed) return;

      if (logIndex >= logLines.length) {
        cleanupTimers();
        revealTimer = window.setTimeout(beginCardReveal, 350);
        return;
      }

      const line = document.createElement("div");
      line.className = "shop-pak-log-line";
      line.textContent = logLines[logIndex];
      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;

      const percent = ((logIndex + 1) / logLines.length) * 100;
      progressBar.style.width = `${percent}%`;
      logIndex += 1;
    }, 260);
  } else {
    beginCardReveal();
  }

  closeBtn?.addEventListener("click", () => {
    if (!closeBtn.disabled) {
      closeModal();
    }
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal && closeBtn && !closeBtn.disabled) {
      closeModal();
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
    else if (itemId.includes("shield")) weaponType = "shield";
    
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

function attachSellListeners(returnTo: BaseCampReturnTo | "operation"): void {
  // Category filter buttons
  document.querySelectorAll(".sell-category-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const category = (e.currentTarget as HTMLElement).getAttribute("data-category");
      if (category) {
        sellCategoryFilter = category as typeof sellCategoryFilter;
        const currentReturnTo = (document.getElementById("backBtn") as HTMLElement)?.getAttribute("data-return-to") || returnTo;
        renderShopScreen(currentReturnTo as BaseCampReturnTo | "operation");
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
        renderShopScreen(currentReturnTo as BaseCampReturnTo | "operation");
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
        renderShopScreen(currentReturnTo as BaseCampReturnTo | "operation");
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
      renderShopScreen(currentReturnTo as BaseCampReturnTo | "operation");
    });
  }
}

export { renderShopScreen as default };

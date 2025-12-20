// ============================================================================
// CHAOS CORE - CRAFTING SCREEN (Headline 11d)
// Crafting interface at Base Camp
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderAllNodesMenuScreen } from "./AllNodesMenuScreen";
import { renderFieldScreen } from "../../field/FieldScreen";

import {
  Recipe,
  RECIPE_DATABASE,
  getKnownRecipes,
  getStarterRecipeIds,
  canAffordRecipe,
  hasRequiredItem,
  getRecipeCostString,
  getRecipesByCategory,
  craftItem,
  CONSUMABLE_DATABASE,
} from "../../core/crafting";

// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------

let selectedCategory: Recipe["category"] = "armor";
let selectedRecipeId: string | null = null;
let craftingExitKeyHandler: ((e: KeyboardEvent) => void) | null = null;

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

export function renderCraftingScreen(returnTo: "basecamp" | "field" = "basecamp"): void {
  // Ensure recipes are loaded (lazy load if not already loaded, non-blocking)
  import("../../core/craftingRecipes").then(({ loadCraftingRecipes, isRecipesLoaded }) => {
    if (!isRecipesLoaded()) {
      loadCraftingRecipes().catch(error => {
        console.error("[Workshop] Failed to load recipes:", error);
      });
    }
  });
  const app = document.getElementById("app");
  if (!app) return;

  const state = getGameState();
  
  // Ensure crafting state exists
  const knownRecipeIds = state.knownRecipeIds ?? getStarterRecipeIds();
  const resources = state.resources ?? { metalScrap: 0, wood: 0, chaosShards: 0, steamComponents: 0 };
  const consumables = state.consumables ?? {};
  
  // Get recipes for current category
  const knownRecipes = getKnownRecipes(knownRecipeIds);
  const categoryRecipes = getRecipesByCategory(knownRecipes, selectedCategory);
  
  // Get selected recipe details
  const selectedRecipe = selectedRecipeId ? RECIPE_DATABASE[selectedRecipeId] : null;
  
  // Check if player can craft selected recipe
  const inventoryItemIds = getInventoryItemIds(state);
  const canCraft = selectedRecipe 
    ? canAffordRecipe(selectedRecipe, resources) && hasRequiredItem(selectedRecipe, inventoryItemIds)
    : false;

  app.innerHTML = /*html*/ `
    <div class="crafting-root">
      <!-- Header -->
      <div class="crafting-header">
        <div class="crafting-header-left">
          <h1 class="crafting-title">CRAFTING</h1>
          <div class="crafting-subtitle">SLK://CRAFT_NODE • FABRICATION TERMINAL</div>
        </div>
        <div class="crafting-header-right">
          <button class="crafting-back-btn" id="backBtn" data-return-to="${returnTo}">← ${returnTo === "field" ? "FIELD MODE" : "BASE CAMP"}</button>
        </div>
      </div>
      
      <!-- Main Content -->
      <div class="crafting-main">
        <!-- Left Panel: Resources & Categories -->
        <div class="crafting-sidebar">
          <!-- Resources Display -->
          <div class="crafting-resources">
            <div class="panel-section-title">MATERIALS</div>
            <div class="resource-grid">
              <div class="resource-item">
                <span class="resource-icon">⚙</span>
                <span class="resource-name">Metal Scrap</span>
                <span class="resource-value">${resources.metalScrap}</span>
              </div>
              <div class="resource-item">
                <span class="resource-icon">🪵</span>
                <span class="resource-name">Wood</span>
                <span class="resource-value">${resources.wood}</span>
              </div>
              <div class="resource-item">
                <span class="resource-icon">💎</span>
                <span class="resource-name">Chaos Shards</span>
                <span class="resource-value">${resources.chaosShards}</span>
              </div>
              <div class="resource-item">
                <span class="resource-icon">⚡</span>
                <span class="resource-name">Steam Comp.</span>
                <span class="resource-value">${resources.steamComponents}</span>
              </div>
            </div>
          </div>
          
          <!-- Category Tabs -->
          <div class="crafting-categories">
            <div class="panel-section-title">CATEGORIES</div>
            <div class="category-tabs">
              <button class="category-tab ${selectedCategory === 'armor' ? 'category-tab--active' : ''}" data-category="armor">
                🛡 Armor
              </button>
              <button class="category-tab ${selectedCategory === 'consumable' ? 'category-tab--active' : ''}" data-category="consumable">
                🧪 Consumables
              </button>
              <button class="category-tab ${selectedCategory === 'upgrade' ? 'category-tab--active' : ''}" data-category="upgrade">
                ⬆ Upgrades
              </button>
            </div>
            <div class="crafting-note">
              <div class="note-text">⚔ Weapons are engineered in the <button class="gear-builder-link" id="gearBuilderLink">Gear Builder</button></div>
            </div>
          </div>
          
          <!-- Consumables Inventory -->
          <div class="crafting-consumables">
            <div class="panel-section-title">CONSUMABLES POUCH</div>
            <div class="consumables-list">
              ${renderConsumablesList(consumables)}
            </div>
          </div>
        </div>
        
        <!-- Center Panel: Recipe List -->
        <div class="crafting-recipes">
          <div class="panel-section-title">${getCategoryTitle(selectedCategory)}</div>
          <div class="recipe-list">
            ${categoryRecipes.length === 0 
              ? '<div class="recipe-empty">No recipes known in this category.</div>'
              : categoryRecipes.map(recipe => renderRecipeItem(recipe, resources, inventoryItemIds, selectedRecipeId)).join('')
            }
          </div>
        </div>
        
        <!-- Right Panel: Recipe Details -->
        <div class="crafting-details">
          ${selectedRecipe 
            ? renderRecipeDetails(selectedRecipe, resources, inventoryItemIds, canCraft)
            : renderNoSelection()
          }
        </div>
      </div>
      
      <!-- ScrollLink Console -->
      <div class="crafting-console">
        <div class="console-header">SCROLLINK OS // CRAFTING_LOG</div>
        <div class="console-body" id="craftingLog">
          <div class="console-line">SLK//CRAFTING :: Fabrication terminal online.</div>
          <div class="console-line">SLK//READY :: Select a recipe to begin crafting.</div>
        </div>
      </div>
    </div>
  `;
  attachCraftingExitHotkey(returnTo);

  // Attach event listeners
  attachCraftingListeners(state, knownRecipeIds, resources, consumables, inventoryItemIds, returnTo);
}

// ----------------------------------------------------------------------------
// RENDER HELPERS
// ----------------------------------------------------------------------------

function getCategoryTitle(category: Recipe["category"]): string {
  switch (category) {
    case "armor": return "ARMOR BLUEPRINTS";
    case "consumable": return "CONSUMABLE FORMULAE";
    case "upgrade": return "UPGRADE PATHS";
    default: return "RECIPES";
  }
}

function renderRecipeItem(
  recipe: Recipe,
  resources: any,
  inventoryItemIds: string[],
  selectedId: string | null
): string {
  const canAfford = canAffordRecipe(recipe, resources);
  const hasItem = hasRequiredItem(recipe, inventoryItemIds);
  const isSelected = recipe.id === selectedId;
  const canMake = canAfford && hasItem;
  
  return `
    <div class="recipe-item ${isSelected ? 'recipe-item--selected' : ''} ${!canMake ? 'recipe-item--disabled' : ''}" 
         data-recipe-id="${recipe.id}">
      <div class="recipe-item-name">${recipe.name}</div>
      <div class="recipe-item-cost">${getRecipeCostString(recipe)}</div>
      ${!canAfford ? '<div class="recipe-item-warning">⚠ Need resources</div>' : ''}
      ${recipe.requiresItemId && !hasItem ? '<div class="recipe-item-warning">⚠ Need base item</div>' : ''}
    </div>
  `;
}

function renderRecipeDetails(
  recipe: Recipe,
  resources: any,
  inventoryItemIds: string[],
  canCraft: boolean
): string {
  // Handle deprecated weapon recipes
  if (recipe.deprecated || recipe.resultItemId.startsWith("weapon_")) {
    return `
      <div class="detail-panel detail-panel--deprecated">
        <div class="detail-header">
          <div class="detail-title">${recipe.name}</div>
          <div class="detail-category">DEPRECATED</div>
        </div>
        <div class="detail-description">
          <p>Weapon crafting has moved to the Gear Builder.</p>
          <p>Use the Gear Builder to engineer and customize weapons.</p>
        </div>
        <div class="detail-actions">
          <button class="craft-btn" id="openGearBuilderBtn">
            ⚔ Open Gear Builder
          </button>
        </div>
      </div>
    `;
  }
  const costLines = [];
  if (recipe.cost.metalScrap) costLines.push({ name: "Metal Scrap", need: recipe.cost.metalScrap, have: resources.metalScrap });
  if (recipe.cost.wood) costLines.push({ name: "Wood", need: recipe.cost.wood, have: resources.wood });
  if (recipe.cost.chaosShards) costLines.push({ name: "Chaos Shards", need: recipe.cost.chaosShards, have: resources.chaosShards });
  if (recipe.cost.steamComponents) costLines.push({ name: "Steam Comp.", need: recipe.cost.steamComponents, have: resources.steamComponents });

  return `
    <div class="detail-panel">
      <div class="detail-header">
        <h2 class="detail-title">${recipe.name}</h2>
        <div class="detail-category">${recipe.category.toUpperCase()}</div>
      </div>
      
      <div class="detail-description">${recipe.description}</div>
      
      ${recipe.requiresItemId ? `
        <div class="detail-requires">
          <div class="detail-label">REQUIRES BASE ITEM:</div>
          <div class="detail-requires-item ${hasRequiredItem(recipe, inventoryItemIds) ? 'detail-requires-item--have' : 'detail-requires-item--missing'}">
            ${formatItemName(recipe.requiresItemId)}
            ${hasRequiredItem(recipe, inventoryItemIds) ? '✓' : '✗'}
          </div>
        </div>
      ` : ''}
      
      <div class="detail-costs">
        <div class="detail-label">MATERIAL COST:</div>
        ${costLines.map(c => `
          <div class="cost-line ${c.have >= c.need ? 'cost-line--ok' : 'cost-line--short'}">
            <span class="cost-name">${c.name}</span>
            <span class="cost-values">${c.have} / ${c.need}</span>
          </div>
        `).join('')}
      </div>
      
      <div class="detail-output">
        <div class="detail-label">PRODUCES:</div>
        <div class="output-item">
          <span class="output-name">${formatItemName(recipe.resultItemId)}</span>
          <span class="output-qty">ร—${recipe.resultQuantity}</span>
        </div>
      </div>
      
      <div class="detail-actions">
        <button class="craft-btn ${canCraft ? '' : 'craft-btn--disabled'}"
                id="craftBtn"
                ${canCraft ? '' : 'disabled'}>
          ${canCraft ? '⚒ CRAFT ITEM' : '⛔ CANNOT CRAFT'}
        </button>
      </div>
    </div>
  `;
}

function renderNoSelection(): string {
  return `
    <div class="detail-panel detail-panel--empty">
      <div class="detail-empty-icon">⚙</div>
      <div class="detail-empty-text">Select a recipe to view details</div>
    </div>
  `;
}

function renderConsumablesList(consumables: Record<string, number>): string {
  const items = Object.entries(consumables).filter(([_, qty]) => qty > 0);
  
  if (items.length === 0) {
    return '<div class="consumables-empty">No consumables</div>';
  }
  
  return items.map(([id, qty]) => {
    const item = CONSUMABLE_DATABASE[id];
    const name = item?.name ?? formatItemName(id);
    return `
      <div class="consumable-item">
        <span class="consumable-name">${name}</span>
        <span class="consumable-qty">ร—${qty}</span>
      </div>
    `;
  }).join('');
}

function formatItemName(itemId: string): string {
  return itemId
    .replace(/^(weapon_|armor_|accessory_|consumable_)/, '')
    .replace(/_/g, ' ')
    .replace(/plus(\d+)/, '+$1')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getInventoryItemIds(state: any): string[] {
  // Get all equipment IDs from inventory
  const ids: string[] = [];
  
  // From equipment pool
  if (state.equipmentById) {
    Object.keys(state.equipmentById).forEach(id => ids.push(id));
  }
  
  // From inventory items
  if (state.inventory?.baseCamp?.items) {
    state.inventory.baseCamp.items.forEach((item: any) => {
      if (item.equipmentId) ids.push(item.equipmentId);
    });
  }
  if (state.inventory?.forwardLocker?.items) {
    state.inventory.forwardLocker.items.forEach((item: any) => {
      if (item.equipmentId) ids.push(item.equipmentId);
    });
  }
  
  return ids;
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------------------

function attachCraftingListeners(
  state: any,
  knownRecipeIds: string[],
  resources: any,
  consumables: Record<string, number>,
  inventoryItemIds: string[],
  returnTo: "basecamp" | "field" = "basecamp"
): void {
  // Back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.onclick = () => {
      detachCraftingExitHotkey();
      selectedRecipeId = null;
      const returnDestination = (backBtn as HTMLElement).getAttribute("data-return-to") || returnTo;
      if (returnDestination === "field") {
        renderFieldScreen("base_camp");
      } else {
        renderAllNodesMenuScreen();
      }
    };
  }
  
  // Gear Builder link
  const gearBuilderLink = document.getElementById("gearBuilderLink");
  if (gearBuilderLink) {
    gearBuilderLink.onclick = () => {
      const currentReturnTo = (document.getElementById("backBtn") as HTMLElement)?.getAttribute("data-return-to") || returnTo;
      renderGearWorkbenchScreen(undefined, undefined, currentReturnTo === "field" ? "field" : "basecamp");
    };
  }
  
  // Category tabs
  document.querySelectorAll(".category-tab").forEach(tab => {
    (tab as HTMLElement).onclick = () => {
      const category = tab.getAttribute("data-category") as Recipe["category"];
      if (category) {
        selectedCategory = category;
        selectedRecipeId = null;
        // Get current return destination from button
        const currentReturnTo = (document.getElementById("backBtn") as HTMLElement)?.getAttribute("data-return-to") || returnTo;
        renderCraftingScreen(currentReturnTo as "basecamp" | "field");
      }
    };
  });
  
  // Recipe items
  document.querySelectorAll(".recipe-item").forEach(item => {
    (item as HTMLElement).onclick = () => {
      const recipeId = item.getAttribute("data-recipe-id");
      if (recipeId) {
        selectedRecipeId = recipeId;
        // Get current return destination from button
        const currentReturnTo = (document.getElementById("backBtn") as HTMLElement)?.getAttribute("data-return-to") || returnTo;
        renderCraftingScreen(currentReturnTo as "basecamp" | "field");
      }
    };
  });
  
  // Open Gear Builder button (for deprecated recipes)
  const openGearBuilderBtn = document.getElementById("openGearBuilderBtn");
  if (openGearBuilderBtn) {
    openGearBuilderBtn.onclick = () => {
      const currentReturnTo = (document.getElementById("backBtn") as HTMLElement)?.getAttribute("data-return-to") || returnTo;
      renderGearWorkbenchScreen(undefined, undefined, currentReturnTo === "field" ? "field" : "basecamp");
    };
  }
  
  // Craft button
  const craftBtn = document.getElementById("craftBtn");
  if (craftBtn && selectedRecipeId) {
    craftBtn.onclick = () => {
      const recipe = RECIPE_DATABASE[selectedRecipeId!];
      if (!recipe) return;
      
      // Double-check: prevent weapon crafting
      if (recipe.deprecated || recipe.resultItemId.startsWith("weapon_")) {
        addCraftingLog(`SLK//ERROR :: Weapons must be built in Gear Builder.`);
        return;
      }
      
      const result = craftItem(recipe, resources, inventoryItemIds);
      
      if (result.success) {
        // Update game state
        updateGameState(draft => {
          // Deduct resources
          if (recipe.cost.metalScrap) draft.resources.metalScrap -= recipe.cost.metalScrap;
          if (recipe.cost.wood) draft.resources.wood -= recipe.cost.wood;
          if (recipe.cost.chaosShards) draft.resources.chaosShards -= recipe.cost.chaosShards;
          if (recipe.cost.steamComponents) draft.resources.steamComponents -= recipe.cost.steamComponents;
          
          // Remove base item for upgrades
          if (result.consumedItemId) {
            // Remove from equipment pool or inventory
            if (draft.equipmentById && draft.equipmentById[result.consumedItemId]) {
              delete draft.equipmentById[result.consumedItemId];
            }
          }
          
          // Add crafted item
          if (recipe.category === "consumable") {
            // Add to consumables
            if (!draft.consumables) draft.consumables = {};
            const currentQty = draft.consumables[result.itemId!] ?? 0;
            draft.consumables[result.itemId!] = currentQty + (result.quantity ?? 1);
          } else {
            // Add to equipment pool
            if (!draft.equipmentById) draft.equipmentById = {};
            // For now, just mark as owned - actual equipment data would come from equipment database
            draft.equipmentById[result.itemId!] = { id: result.itemId!, owned: true };
          }
        });
        
        // Log success
        addCraftingLog(`SLK//CRAFT :: ${recipe.name} fabricated successfully.`);
        addCraftingLog(`SLK//OUTPUT :: +${result.quantity} ${formatItemName(result.itemId!)}`);
        
        // Re-render
        renderCraftingScreen(returnTo);
      } else {
        addCraftingLog(`SLK//ERROR :: Crafting failed - ${result.error}`);
      }
    };
  }
}

function addCraftingLog(message: string): void {
  const logEl = document.getElementById("craftingLog");
  if (logEl) {
    const line = document.createElement("div");
    line.className = "console-line";
    line.textContent = message;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }
}

function detachCraftingExitHotkey(): void {
  if (craftingExitKeyHandler) {
    window.removeEventListener("keydown", craftingExitKeyHandler);
    craftingExitKeyHandler = null;
  }
}

function attachCraftingExitHotkey(returnTo: "basecamp" | "field"): void {
  detachCraftingExitHotkey();

  if (returnTo !== "field") return;

  craftingExitKeyHandler = (e: KeyboardEvent) => {
    const key = e.key?.toLowerCase() ?? "";
    if (key === "escape" || key === "e") {
      if (key === "e") {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return;
        }
      }
      e.preventDefault();
      e.stopPropagation();
      detachCraftingExitHotkey();
      renderFieldScreen("base_camp");
    }
  };

  window.addEventListener("keydown", craftingExitKeyHandler);
}

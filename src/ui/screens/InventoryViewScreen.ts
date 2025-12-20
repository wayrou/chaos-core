// ============================================================================
// INVENTORY VIEW SCREEN - Read-only inventory display
// Shows all owned items: equipment, consumables, weapon parts, recipes, resources
// ============================================================================

import { getGameState } from "../../state/gameStore";
import { buildInventoryVM, InventoryCategory, InventoryEntryVM } from "../../core/inventoryViewModel";
import { renderAllNodesMenuScreen } from "./AllNodesMenuScreen";
import { renderFieldScreen } from "../../field/FieldScreen";

// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------

let selectedCategory: InventoryCategory | "all" = "all";
let searchQuery: string = "";

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

export function renderInventoryViewScreen(returnTo: "basecamp" | "field" = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) return;

  const state = getGameState();
  const vm = buildInventoryVM(state);

  // Filter entries
  const filteredEntries = filterEntries(vm.entries, selectedCategory, searchQuery);

  const backButtonText = returnTo === "field" ? "FIELD MODE" : "BASE CAMP";

  root.innerHTML = `
    <div class="inventory-view-root">
      <!-- Header -->
      <div class="inventory-view-header">
        <div class="inventory-view-header-left">
          <h1 class="inventory-view-title">INVENTORY</h1>
          <div class="inventory-view-subtitle">SCROLLINK OS // ASSETS_REGISTRY</div>
        </div>
        <div class="inventory-view-header-right">
          <div class="inventory-view-wad">
            <span class="wad-label">WAD</span>
            <span class="wad-value">${vm.wad.toLocaleString()}</span>
          </div>
          <button class="inventory-view-back-btn" id="backBtn" data-return-to="${returnTo}">
            <span class="btn-icon">←</span>
            <span class="btn-text">${backButtonText}</span>
          </button>
        </div>
      </div>

      <div class="inventory-view-body">
        <!-- Left Sidebar: Categories -->
        <div class="inventory-view-sidebar">
          <div class="inventory-view-section-title">CATEGORIES</div>
          <div class="inventory-view-categories">
            <button class="inventory-view-category-btn ${selectedCategory === "all" ? "inventory-view-category-btn--active" : ""}" 
                    data-category="all">
              <span class="category-label">ALL</span>
              <span class="category-count">${vm.entries.length}</span>
            </button>
            <button class="inventory-view-category-btn ${selectedCategory === "equipment" ? "inventory-view-category-btn--active" : ""}" 
                    data-category="equipment">
              <span class="category-label">EQUIPMENT</span>
              <span class="category-count">${vm.countsByCategory.equipment}</span>
            </button>
            <button class="inventory-view-category-btn ${selectedCategory === "consumable" ? "inventory-view-category-btn--active" : ""}" 
                    data-category="consumable">
              <span class="category-label">CONSUMABLES</span>
              <span class="category-count">${vm.countsByCategory.consumable}</span>
            </button>
            <button class="inventory-view-category-btn ${selectedCategory === "weaponPart" ? "inventory-view-category-btn--active" : ""}" 
                    data-category="weaponPart">
              <span class="category-label">WEAPON PARTS</span>
              <span class="category-count">${vm.countsByCategory.weaponPart}</span>
            </button>
            <button class="inventory-view-category-btn ${selectedCategory === "recipe" ? "inventory-view-category-btn--active" : ""}" 
                    data-category="recipe">
              <span class="category-label">RECIPES</span>
              <span class="category-count">${vm.countsByCategory.recipe}</span>
            </button>
            <button class="inventory-view-category-btn ${selectedCategory === "resource" ? "inventory-view-category-btn--active" : ""}" 
                    data-category="resource">
              <span class="category-label">RESOURCES</span>
              <span class="category-count">${vm.countsByCategory.resource}</span>
            </button>
          </div>
        </div>

        <!-- Main Panel: Search + Items List -->
        <div class="inventory-view-main">
          <!-- Search Box -->
          <div class="inventory-view-search">
            <input 
              type="text" 
              class="inventory-view-search-input" 
              id="searchInput"
              placeholder="Search items..."
              value="${searchQuery}"
            />
            ${searchQuery ? `
              <button class="inventory-view-search-clear" id="clearSearchBtn">✕</button>
            ` : ""}
          </div>

          <!-- Items List -->
          <div class="inventory-view-items">
            ${filteredEntries.length === 0 ? `
              <div class="inventory-view-empty">
                <div class="empty-icon">📦</div>
                <div class="empty-text">No items found</div>
                ${searchQuery ? `<div class="empty-hint">Try a different search term</div>` : ""}
              </div>
            ` : filteredEntries.map(entry => renderInventoryEntry(entry)).join("")}
          </div>
        </div>
      </div>
    </div>
  `;

  attachInventoryViewListeners(returnTo);
}

// ----------------------------------------------------------------------------
// RENDER HELPERS
// ----------------------------------------------------------------------------

function renderInventoryEntry(entry: InventoryEntryVM): string {
  const equippedBadge = entry.equipped ? `<span class="entry-badge entry-badge--equipped">EQUIPPED</span>` : "";
  const quantityBadge = entry.owned > 1 ? `<span class="entry-badge entry-badge--quantity">x${entry.owned}</span>` : "";
  const categoryBadge = `<span class="entry-badge entry-badge--category">${getCategoryLabel(entry.category)}</span>`;

  return `
    <div class="inventory-view-entry" data-key="${entry.key}">
      <div class="entry-main">
        <div class="entry-header">
          <div class="entry-name">${entry.name}</div>
          <div class="entry-badges">
            ${equippedBadge}
            ${quantityBadge}
            ${categoryBadge}
          </div>
        </div>
        ${entry.description ? `
          <div class="entry-description">${entry.description}</div>
        ` : ""}
        ${entry.sortGroup ? `
          <div class="entry-meta">${entry.sortGroup.toUpperCase()}</div>
        ` : ""}
      </div>
    </div>
  `;
}

function getCategoryLabel(category: InventoryCategory): string {
  const labels: Record<InventoryCategory, string> = {
    equipment: "EQUIPMENT",
    consumable: "CONSUMABLE",
    weaponPart: "PART",
    recipe: "RECIPE",
    resource: "RESOURCE",
  };
  return labels[category] || category.toUpperCase();
}

// ----------------------------------------------------------------------------
// FILTERING
// ----------------------------------------------------------------------------

function filterEntries(
  entries: InventoryEntryVM[],
  category: InventoryCategory | "all",
  query: string
): InventoryEntryVM[] {
  let filtered = entries;

  // Category filter
  if (category !== "all") {
    filtered = filtered.filter(e => e.category === category);
  }

  // Search filter
  if (query.trim()) {
    const lowerQuery = query.toLowerCase();
    filtered = filtered.filter(e => 
      e.name.toLowerCase().includes(lowerQuery) ||
      (e.description && e.description.toLowerCase().includes(lowerQuery))
    );
  }

  return filtered;
}

// ----------------------------------------------------------------------------
// EVENT HANDLERS
// ----------------------------------------------------------------------------

function attachInventoryViewListeners(returnTo: "basecamp" | "field"): void {
  const root = document.getElementById("app");
  if (!root) return;

  // Back button
  const backBtn = root.querySelector<HTMLButtonElement>("#backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      const returnDestination = backBtn.getAttribute("data-return-to") || returnTo;
      if (returnDestination === "field") {
        renderFieldScreen("base_camp");
      } else {
        renderAllNodesMenuScreen();
      }
    });
  }

  // Category buttons
  const categoryButtons = root.querySelectorAll<HTMLButtonElement>(".inventory-view-category-btn");
  categoryButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const category = btn.getAttribute("data-category");
      if (category) {
        selectedCategory = category as InventoryCategory | "all";
        renderInventoryViewScreen(returnTo);
      }
    });
  });

  // Search input
  const searchInput = root.querySelector<HTMLInputElement>("#searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      searchQuery = target.value;
      
      // Preserve focus and cursor position before re-rendering
      const hadFocus = document.activeElement === searchInput;
      const cursorPosition = searchInput.selectionStart || 0;
      
      renderInventoryViewScreen(returnTo);
      
      // Restore focus and cursor position after re-rendering
      if (hadFocus) {
        requestAnimationFrame(() => {
          const newSearchInput = document.querySelector<HTMLInputElement>("#searchInput");
          if (newSearchInput) {
            newSearchInput.focus();
            newSearchInput.setSelectionRange(cursorPosition, cursorPosition);
          }
        });
      }
    });

    // Focus search on Ctrl+F or Cmd+F
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
  }

  // Clear search button
  const clearSearchBtn = root.querySelector<HTMLButtonElement>("#clearSearchBtn");
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      searchQuery = "";
      renderInventoryViewScreen(returnTo);
    });
  }
}

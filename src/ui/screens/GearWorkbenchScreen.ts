// ============================================================================
// CHAOS CORE - GEAR WORKBENCH SCREEN (Headline 11da)
// Card slotting interface for equipment customization
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderBaseCampScreen } from "./BaseCampScreen";
import { renderUnitDetailScreen } from "./Unitdetailscreen";

import { saveGame, loadGame } from "../../core/saveSystem";
import { getSettings, updateSettings } from "../../core/settings";
import { initControllerSupport } from "../../core/controllerSupport";
import { getGameState, updateGameState } from "../../state/gameStore";

import {
  GearSlotData,
  CardLibrary,
  LibraryCard,
  CompiledDeck,
  LIBRARY_CARD_DATABASE,
  getDefaultGearSlots,
  getLibraryCards,
  filterLibraryCards,
  slotCard,
  unslotCard,
  getGearCards,
  compileDeck,
  getDeckPreview,
  getStarterCardLibrary,
  CardRarity,
  CardCategory,
} from "../../core/gearWorkbench";

// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------

type ReturnDestination = "basecamp" | "unitdetail";

interface WorkbenchState {
  selectedEquipmentId: string | null;
  selectedUnitId: string | null;
  draggedCardId: string | null;
  searchFilter: string;
  rarityFilter: CardRarity | null;
  categoryFilter: CardCategory | null;
  isCompiling: boolean;
  compileMessages: string[];
  returnDestination: ReturnDestination;
}

let workbenchState: WorkbenchState = {
  selectedEquipmentId: null,
  selectedUnitId: null,
  draggedCardId: null,
  searchFilter: "",
  rarityFilter: null,
  categoryFilter: null,
  isCompiling: false,
  compileMessages: [],
  returnDestination: "basecamp",
};

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

export function renderGearWorkbenchScreen(
  unitId?: string, 
  equipmentId?: string,
  returnTo?: ReturnDestination
): void {
  const app = document.getElementById("app");
  if (!app) return;

  const state = getGameState();
  
  // Initialize workbench state
  if (unitId) workbenchState.selectedUnitId = unitId;
  if (equipmentId) workbenchState.selectedEquipmentId = equipmentId;
  if (returnTo) workbenchState.returnDestination = returnTo;
  
  // Get card library (ensure it exists)
  const cardLibrary: CardLibrary = (state as any).cardLibrary ?? getStarterCardLibrary();
  
  // Get gear slots for selected equipment
  const gearSlots: Record<string, GearSlotData> = (state as any).gearSlots ?? {};
  const selectedGear = workbenchState.selectedEquipmentId 
    ? gearSlots[workbenchState.selectedEquipmentId] ?? getDefaultGearSlots(workbenchState.selectedEquipmentId)
    : null;
  
  // Get filtered library cards
  const allLibraryCards = getLibraryCards(cardLibrary);
  const filteredCards = filterLibraryCards(allLibraryCards, {
    rarity: workbenchState.rarityFilter ?? undefined,
    category: workbenchState.categoryFilter ?? undefined,
    search: workbenchState.searchFilter || undefined,
  });
  
  // Get unit's equipped gear for deck preview and gear selector
  const unitEquipment = getUnitEquippedGear(state, workbenchState.selectedUnitId);
  const unitGearSlots = unitEquipment.map(eqId => gearSlots[eqId] ?? getDefaultGearSlots(eqId));
  const compiledDeck = compileDeck(unitGearSlots);
  const deckPreview = getDeckPreview(compiledDeck);

  // Get equipment data for names
  const equipmentById = (state as any).equipmentById ?? {};

  const backBtnText = workbenchState.returnDestination === "unitdetail" 
    ? "← UNIT ROSTER" 
    : "← BASE CAMP";

  app.innerHTML = /*html*/ `
    <div class="workbench-root ${workbenchState.isCompiling ? 'workbench-root--compiling' : ''}">
      <!-- Compile Overlay -->
      ${workbenchState.isCompiling ? renderCompileOverlay() : ''}
      
      <!-- Header -->
      <div class="workbench-header">
        <div class="workbench-header-left">
          <h1 class="workbench-title">GEAR WORKBENCH</h1>
          <div class="workbench-subtitle">SLK://CARD_SLOT_INTERFACE • DECK COMPILER v2.3</div>
        </div>
        <div class="workbench-header-right">
          <button class="workbench-back-btn" id="backBtn">${backBtnText}</button>
        </div>
      </div>
      
      <!-- Main Content -->
      <div class="workbench-main">
        <!-- Left Panel: Selected Gear -->
        <div class="workbench-gear-panel">
          <div class="panel-section-title">SELECTED GEAR</div>
          
          <!-- Gear Selector -->
          ${renderGearSelector(unitEquipment, equipmentById, workbenchState.selectedEquipmentId)}
          
          ${selectedGear ? renderGearEditor(selectedGear, workbenchState.selectedEquipmentId!) : renderNoGearSelected()}
          
          <!-- Deck Preview -->
          <div class="deck-preview">
            <div class="panel-section-title">COMPILED DECK PREVIEW</div>
            <div class="deck-preview-stats">
              <span class="deck-stat">Total Cards: ${compiledDeck.totalCards}</span>
            </div>
            <div class="deck-preview-list">
              ${deckPreview.length > 0 
                ? deckPreview.map(line => `<div class="deck-preview-item">${line}</div>`).join('')
                : '<div class="deck-preview-empty">No cards in deck</div>'
              }
            </div>
          </div>
          
          <!-- Compile Button -->
          <div class="workbench-actions">
            <button class="compile-btn" id="compileBtn" ${!selectedGear ? 'disabled' : ''}>
              ⚙ COMPILE GEAR
            </button>
          </div>
        </div>
        
        <!-- Right Panel: Card Library -->
        <div class="workbench-library-panel">
          <div class="panel-section-title">CARD LIBRARY</div>
          
          <!-- Filters -->
          <div class="library-filters">
            <input type="text" 
                   class="library-search" 
                   id="cardSearch"
                   placeholder="Search cards..." 
                   value="${workbenchState.searchFilter}">
            
            <div class="filter-row">
              <select class="filter-select" id="rarityFilter">
                <option value="">All Rarities</option>
                <option value="common" ${workbenchState.rarityFilter === 'common' ? 'selected' : ''}>Common</option>
                <option value="uncommon" ${workbenchState.rarityFilter === 'uncommon' ? 'selected' : ''}>Uncommon</option>
                <option value="rare" ${workbenchState.rarityFilter === 'rare' ? 'selected' : ''}>Rare</option>
                <option value="epic" ${workbenchState.rarityFilter === 'epic' ? 'selected' : ''}>Epic</option>
              </select>
              
              <select class="filter-select" id="categoryFilter">
                <option value="">All Types</option>
                <option value="attack" ${workbenchState.categoryFilter === 'attack' ? 'selected' : ''}>Attack</option>
                <option value="defense" ${workbenchState.categoryFilter === 'defense' ? 'selected' : ''}>Defense</option>
                <option value="mobility" ${workbenchState.categoryFilter === 'mobility' ? 'selected' : ''}>Mobility</option>
                <option value="buff" ${workbenchState.categoryFilter === 'buff' ? 'selected' : ''}>Buff</option>
                <option value="debuff" ${workbenchState.categoryFilter === 'debuff' ? 'selected' : ''}>Debuff</option>
                <option value="steam" ${workbenchState.categoryFilter === 'steam' ? 'selected' : ''}>Steam</option>
                <option value="chaos" ${workbenchState.categoryFilter === 'chaos' ? 'selected' : ''}>Chaos</option>
              </select>
            </div>
          </div>
          
          <!-- Card List -->
          <div class="library-card-list" id="cardLibraryList">
            ${filteredCards.length > 0 
              ? filteredCards.map(card => renderLibraryCard(card, cardLibrary[card.id] ?? 0)).join('')
              : '<div class="library-empty">No cards match your filters</div>'
            }
          </div>
        </div>
      </div>
      
      <!-- Console -->
      <div class="workbench-console">
        <div class="console-header">SCROLLINK OS // WORKBENCH_LOG</div>
        <div class="console-body" id="workbenchLog">
          <div class="console-line">SLK//WORKBENCH :: Card slotting interface online.</div>
          <div class="console-line">SLK//READY :: Drag cards from library to gear slots.</div>
        </div>
      </div>
    </div>
  `;

  attachWorkbenchListeners(state, cardLibrary, gearSlots, selectedGear);
}

// ----------------------------------------------------------------------------
// RENDER HELPERS
// ----------------------------------------------------------------------------

function renderGearSelector(
  unitEquipment: string[], 
  equipmentById: Record<string, any>,
  selectedId: string | null
): string {
  if (unitEquipment.length === 0) {
    return `
      <div class="gear-selector gear-selector--empty">
        <div class="gear-selector-label">No equipment to customize</div>
      </div>
    `;
  }

  const options = unitEquipment.map(eqId => {
    const eq = equipmentById[eqId];
    const name = eq?.name ?? formatEquipmentName(eqId);
    const isSelected = eqId === selectedId;
    return `
      <button class="gear-selector-option ${isSelected ? 'gear-selector-option--selected' : ''}"
              data-equipment-id="${eqId}">
        <span class="gear-option-icon">${getEquipmentIcon(eqId)}</span>
        <span class="gear-option-name">${name}</span>
      </button>
    `;
  }).join('');

  return `
    <div class="gear-selector">
      <div class="gear-selector-label">SELECT GEAR TO CUSTOMIZE</div>
      <div class="gear-selector-options">
        ${options}
      </div>
    </div>
  `;
}

function getEquipmentIcon(equipmentId: string): string {
  if (equipmentId.includes('weapon') || equipmentId.includes('sword') || equipmentId.includes('bow') || equipmentId.includes('staff')) {
    return '⚔';
  }
  if (equipmentId.includes('helm') || equipmentId.includes('hood')) {
    return '🪖';
  }
  if (equipmentId.includes('chest') || equipmentId.includes('armor') || equipmentId.includes('jerkin')) {
    return '🛡';
  }
  return '💎';
}

function renderGearEditor(gear: GearSlotData, equipmentId: string): string {
  const equipmentName = formatEquipmentName(equipmentId);
  const slotsUsed = gear.slottedCards.length;
  const slotsTotal = gear.freeSlots;
  
  return `
    <div class="gear-editor">
      <div class="gear-name">${equipmentName}</div>
      <div class="gear-slot-info">Slots: ${slotsUsed} / ${slotsTotal}</div>
      
      <!-- Locked Cards -->
      <div class="gear-section">
        <div class="gear-section-label">LOCKED CARDS (Permanent)</div>
        <div class="locked-cards">
          ${gear.lockedCards.length > 0 
            ? gear.lockedCards.map(cardId => renderLockedCard(cardId)).join('')
            : '<div class="no-cards">No locked cards</div>'
          }
        </div>
      </div>
      
      <!-- Free Slots -->
      <div class="gear-section">
        <div class="gear-section-label">FREE SLOTS (Customizable)</div>
        <div class="free-slots" id="freeSlots">
          ${renderFreeSlots(gear)}
        </div>
      </div>
    </div>
  `;
}

function renderFreeSlots(gear: GearSlotData): string {
  const slots: string[] = [];
  
  // Render slotted cards
  gear.slottedCards.forEach((cardId, index) => {
    const card = LIBRARY_CARD_DATABASE[cardId];
    slots.push(`
      <div class="slot-card slot-card--filled" data-slot-index="${index}">
        <div class="slot-card-name">${card?.name ?? cardId}</div>
        <div class="slot-card-remove" data-remove-index="${index}">✕</div>
      </div>
    `);
  });
  
  // Render empty slots
  const emptyCount = gear.freeSlots - gear.slottedCards.length;
  for (let i = 0; i < emptyCount; i++) {
    slots.push(`
      <div class="slot-card slot-card--empty" data-drop-target="true">
        <div class="slot-empty-text">DROP CARD HERE</div>
      </div>
    `);
  }
  
  return slots.join('');
}

function renderLockedCard(cardId: string): string {
  const card = LIBRARY_CARD_DATABASE[cardId];
  return `
    <div class="locked-card">
      <span class="locked-card-icon">🔒</span>
      <span class="locked-card-name">${card?.name ?? cardId}</span>
    </div>
  `;
}

function renderLibraryCard(card: LibraryCard, count: number): string {
  const rarityClass = `library-card--${card.rarity}`;
  const categoryIcon = getCategoryIcon(card.category);
  
  return `
    <div class="library-card ${rarityClass}" 
         draggable="true" 
         data-card-id="${card.id}">
      <!-- Card Frame -->
      <div class="card-frame">
        <!-- Card Header -->
        <div class="card-header">
          <span class="card-name">${card.name}</span>
          <span class="card-strain">
            <span class="strain-value">${card.strainCost}</span>
            <span class="strain-label">STR</span>
          </span>
        </div>
        
        <!-- Card Art Area -->
        <div class="card-art">
          <span class="card-art-icon">${categoryIcon}</span>
        </div>
        
        <!-- Card Type Bar -->
        <div class="card-type-bar">
          <span class="card-category">${card.category.toUpperCase()}</span>
          <span class="card-rarity">${card.rarity.toUpperCase()}</span>
        </div>
        
        <!-- Card Text -->
        <div class="card-text">
          <p class="card-description">${card.description}</p>
        </div>
        
        <!-- Card Footer -->
        <div class="card-footer">
          <span class="card-owned">×${count}</span>
        </div>
      </div>
    </div>
  `;
}

function getCategoryIcon(category: CardCategory): string {
  const icons: Record<CardCategory, string> = {
    attack: '⚔',
    defense: '🛡',
    utility: '🔧',
    mobility: '💨',
    buff: '✨',
    debuff: '💀',
    steam: '♨',
    chaos: '🌀',
  };
  return icons[category] ?? '📜';
}

function renderNoGearSelected(): string {
  return `
    <div class="no-gear-selected">
      <div class="no-gear-icon">⚙</div>
      <div class="no-gear-text">Select equipment above to customize its card slots.</div>
    </div>
  `;
}

function renderCompileOverlay(): string {
  return `
    <div class="compile-overlay">
      <div class="compile-window">
        <div class="compile-header">[ COMPILING... ]</div>
        <div class="compile-messages" id="compileMessages">
          ${workbenchState.compileMessages.map(msg => `<div class="compile-line">${msg}</div>`).join('')}
        </div>
        <div class="compile-progress">
          <div class="compile-progress-bar" id="compileProgressBar"></div>
        </div>
      </div>
    </div>
  `;
}

function formatEquipmentName(equipmentId: string): string {
  return equipmentId
    .replace(/^(weapon_|armor_|accessory_)/, '')
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getUnitEquippedGear(state: any, unitId: string | null): string[] {
  if (!unitId) return [];
  
  const unit = state.unitsById?.[unitId];
  if (!unit?.loadout) return [];
  
  const gear: string[] = [];
  if (unit.loadout.weapon) gear.push(unit.loadout.weapon);
  if (unit.loadout.helmet) gear.push(unit.loadout.helmet);
  if (unit.loadout.chestpiece) gear.push(unit.loadout.chestpiece);
  if (unit.loadout.accessory1) gear.push(unit.loadout.accessory1);
  if (unit.loadout.accessory2) gear.push(unit.loadout.accessory2);
  
  return gear;
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------------------

function attachWorkbenchListeners(
  state: any,
  cardLibrary: CardLibrary,
  gearSlots: Record<string, GearSlotData>,
  selectedGear: GearSlotData | null
): void {
  // Back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.onclick = () => {
      const unitId = workbenchState.selectedUnitId;
      const returnTo = workbenchState.returnDestination;
      
      // Reset state
      workbenchState = {
        selectedEquipmentId: null,
        selectedUnitId: null,
        draggedCardId: null,
        searchFilter: "",
        rarityFilter: null,
        categoryFilter: null,
        isCompiling: false,
        compileMessages: [],
        returnDestination: "basecamp",
      };
      
      // Navigate back
      if (returnTo === "unitdetail" && unitId) {
        renderUnitDetailScreen(unitId);
      } else {
        renderBaseCampScreen();
      }
    };
  }
  
  // Gear selector buttons
  document.querySelectorAll(".gear-selector-option").forEach(btn => {
    const el = btn as HTMLElement;
    el.onclick = () => {
      const equipmentId = el.getAttribute("data-equipment-id");
      if (equipmentId) {
        workbenchState.selectedEquipmentId = equipmentId;
        renderGearWorkbenchScreen();
      }
    };
  });
  
  // Search filter
  const searchInput = document.getElementById("cardSearch") as HTMLInputElement;
  if (searchInput) {
    searchInput.oninput = () => {
      workbenchState.searchFilter = searchInput.value;
      renderGearWorkbenchScreen();
    };
  }
  
  // Rarity filter
  const raritySelect = document.getElementById("rarityFilter") as HTMLSelectElement;
  if (raritySelect) {
    raritySelect.onchange = () => {
      workbenchState.rarityFilter = raritySelect.value as CardRarity || null;
      renderGearWorkbenchScreen();
    };
  }
  
  // Category filter
  const categorySelect = document.getElementById("categoryFilter") as HTMLSelectElement;
  if (categorySelect) {
    categorySelect.onchange = () => {
      workbenchState.categoryFilter = categorySelect.value as CardCategory || null;
      renderGearWorkbenchScreen();
    };
  }
  
  // Drag and drop for library cards
  document.querySelectorAll(".library-card").forEach(card => {
    const el = card as HTMLElement;
    
    el.addEventListener("dragstart", (e: DragEvent) => {
      const cardId = el.getAttribute("data-card-id");
      if (cardId && e.dataTransfer) {
        workbenchState.draggedCardId = cardId;
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", cardId);
        el.classList.add("library-card--dragging");
        
        // Add visual feedback to drop targets
        document.querySelectorAll(".slot-card--empty").forEach(slot => {
          slot.classList.add("slot-card--highlight");
        });
      }
    });
    
    el.addEventListener("dragend", () => {
      workbenchState.draggedCardId = null;
      el.classList.remove("library-card--dragging");
      
      // Remove visual feedback from drop targets
      document.querySelectorAll(".slot-card--empty").forEach(slot => {
        slot.classList.remove("slot-card--highlight");
        slot.classList.remove("slot-card--dragover");
      });
    });
  });
  
  // Drop targets (empty slots)
  document.querySelectorAll(".slot-card--empty").forEach(slot => {
    const el = slot as HTMLElement;
    
    el.addEventListener("dragover", (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
      el.classList.add("slot-card--dragover");
    });
    
    el.addEventListener("dragleave", (e: DragEvent) => {
      // Only remove if actually leaving the element
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (!el.contains(relatedTarget)) {
        el.classList.remove("slot-card--dragover");
      }
    });
    
    el.addEventListener("drop", (e: DragEvent) => {
      e.preventDefault();
      el.classList.remove("slot-card--dragover");
      
      const cardId = e.dataTransfer?.getData("text/plain");
      if (cardId && workbenchState.selectedEquipmentId && selectedGear) {
        // Slot the card
        const newGear = slotCard(selectedGear, cardId);
        if (newGear) {
          updateGameState(draft => {
            if (!(draft as any).gearSlots) (draft as any).gearSlots = {};
            (draft as any).gearSlots[workbenchState.selectedEquipmentId!] = newGear;
          });
          
          addWorkbenchLog(`SLK//SLOT :: ${LIBRARY_CARD_DATABASE[cardId]?.name ?? cardId} installed.`);
          renderGearWorkbenchScreen();
        } else {
          addWorkbenchLog(`SLK//ERROR :: No free slots available.`);
        }
      }
    });
  });
  
  // Remove card from slot
  document.querySelectorAll(".slot-card-remove").forEach(btn => {
    const el = btn as HTMLElement;
    el.onclick = (e) => {
      e.stopPropagation();
      const indexStr = el.getAttribute("data-remove-index");
      if (indexStr !== null && workbenchState.selectedEquipmentId && selectedGear) {
        const index = parseInt(indexStr);
        const removedCardId = selectedGear.slottedCards[index];
        const newGear = unslotCard(selectedGear, index);
        
        updateGameState(draft => {
          if (!(draft as any).gearSlots) (draft as any).gearSlots = {};
          (draft as any).gearSlots[workbenchState.selectedEquipmentId!] = newGear;
        });
        
        addWorkbenchLog(`SLK//UNSLOT :: ${LIBRARY_CARD_DATABASE[removedCardId]?.name ?? removedCardId} removed.`);
        renderGearWorkbenchScreen();
      }
    };
  });
  
  // Compile button
  const compileBtn = document.getElementById("compileBtn");
  if (compileBtn) {
    compileBtn.onclick = () => {
      if (selectedGear) {
        runCompileAnimation();
      }
    };
  }
}

function addWorkbenchLog(message: string): void {
  const logEl = document.getElementById("workbenchLog");
  if (logEl) {
    const line = document.createElement("div");
    line.className = "console-line";
    line.textContent = message;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }
}

// ----------------------------------------------------------------------------
// COMPILE ANIMATION
// ----------------------------------------------------------------------------

function runCompileAnimation(): void {
  workbenchState.isCompiling = true;
  workbenchState.compileMessages = [];
  renderGearWorkbenchScreen();
  
  const messages = [
    "→ Initializing card matrix...",
    "→ Building Strike.exe",
    "→ Installing Guard.dll",
    "→ Resolving Steam_Burst.pkg",
    "→ Linking runtime dependencies...",
    "→ Optimizing combat protocols...",
    "→ Validating deck integrity...",
    "→ Compilation Successful ✓",
  ];
  
  let currentIndex = 0;
  const progressBar = document.getElementById("compileProgressBar");
  
  const interval = setInterval(() => {
    if (currentIndex < messages.length) {
      workbenchState.compileMessages.push(messages[currentIndex]);
      
      // Update progress bar
      if (progressBar) {
        const progress = ((currentIndex + 1) / messages.length) * 100;
        progressBar.style.width = `${progress}%`;
      }
      
      // Update messages display
      const messagesEl = document.getElementById("compileMessages");
      if (messagesEl) {
        const line = document.createElement("div");
        line.className = "compile-line";
        line.textContent = messages[currentIndex];
        messagesEl.appendChild(line);
      }
      
      currentIndex++;
    } else {
      clearInterval(interval);
      
      // Finish after a short delay
      setTimeout(() => {
        workbenchState.isCompiling = false;
        addWorkbenchLog("SLK//COMPILE :: Gear configuration saved.");
        renderGearWorkbenchScreen();
      }, 800);
    }
  }, 400);
}

// ----------------------------------------------------------------------------
// EXPORTS FOR OTHER SCREENS
// ----------------------------------------------------------------------------

export function openWorkbenchForEquipment(
  unitId: string, 
  equipmentId: string, 
  returnTo: ReturnDestination = "basecamp"
): void {
  workbenchState.selectedUnitId = unitId;
  workbenchState.selectedEquipmentId = equipmentId;
  workbenchState.returnDestination = returnTo;
  renderGearWorkbenchScreen();
}
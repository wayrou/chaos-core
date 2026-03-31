// ============================================================================
// CHAOS CORE - WORKSHOP SCREEN (Headline 11da)
// Card slotting interface for equipment customization
// ============================================================================

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderAllNodesMenuScreen } from "./AllNodesMenuScreen";
import { renderUnitDetailScreen } from "./UnitDetailScreen";
import { renderFieldScreen } from "../../field/FieldScreen";
import { GameState } from "../../core/types";

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
  compileDeck,
  getDeckPreview,
  getStarterCardLibrary,
  CardRarity,
  CardCategory,
} from "../../core/gearWorkbench";
import {
  getChassisById,
  getChassisBySlotType,
  ChassisSlotType,
  GearChassis,
  ALL_CHASSIS
} from "../../data/gearChassis";
import {
  ALL_DOCTRINES,
  getDoctrineById,
  GearDoctrine
} from "../../data/gearDoctrines";
import { buildGear, getBuildCost, canAffordBuild } from "../../core/gearBuilder";
import {
  craftEndlessGear,
  addEndlessGearToInventory,
  getEndlessRecipeCost,
  canAffordEndlessRecipe
} from "../../core/endlessGear/craftEndlessGear";
import { CraftingMaterialId } from "../../core/endlessGear/types";
import { createGenerationContext } from "../../core/endlessGear/generateEndlessGear";
import { generateEndlessGearFromRecipe } from "../../core/endlessGear/generateEndlessGear";
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

type ReturnDestination = "basecamp" | "unitdetail" | "field";

type WorkbenchTab = "build" | "customize" | "endless" | "craft";

interface WorkbenchState {
  activeTab: WorkbenchTab;
  selectedEquipmentId: string | null;
  selectedUnitId: string | null;
  draggedCardId: string | null;
  searchFilter: string;
  rarityFilter: CardRarity | null;
  categoryFilter: CardCategory | null;
  isCompiling: boolean;
  compileMessages: string[];
  returnDestination: ReturnDestination;

  // Build Gear tab state
  buildSlotType: "weapon" | "helmet" | "chestpiece" | "accessory" | null;
  buildChassisId: string | null;
  buildDoctrineId: string | null;

  // Endless Craft tab state
  endlessChassisId: string | null;
  endlessMaterials: string[]; // CraftingMaterialId[]

  // Craft Tab State
  craftingCategory: Recipe["category"];
  selectedRecipeId: string | null;
}

let workbenchState: WorkbenchState = {
  activeTab: "build",
  selectedEquipmentId: null,
  selectedUnitId: null,
  draggedCardId: null,
  searchFilter: "",
  rarityFilter: null,
  categoryFilter: null,
  isCompiling: false,
  compileMessages: [],
  returnDestination: "basecamp",
  buildSlotType: null,
  buildChassisId: null,
  buildDoctrineId: null,
  endlessChassisId: null,
  endlessMaterials: [],
  craftingCategory: "armor",
  selectedRecipeId: null,
};

let gearWorkbenchExitKeyHandler: ((e: KeyboardEvent) => void) | null = null;

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

  // Ensure recipes are loaded for Craft tab
  import("../../core/craftingRecipes").then(({ loadCraftingRecipes, isRecipesLoaded }) => {
    if (!isRecipesLoaded()) {
      loadCraftingRecipes().catch(error => {
        console.error("[Workshop] Failed to load recipes:", error);
      });
    }
  });

  const state = getGameState();

  // Initialize workbench state
  if (unitId) workbenchState.selectedUnitId = unitId;
  if (equipmentId) workbenchState.selectedEquipmentId = equipmentId;
  if (returnTo) workbenchState.returnDestination = returnTo;

  // Get card library (ensure it exists)
  const cardLibrary: CardLibrary = (state as any).cardLibrary ?? getStarterCardLibrary();

  // Get gear slots for selected equipment
  const gearSlots: Record<string, GearSlotData> = (state as any).gearSlots ?? {};
  const equipmentById = (state as any).equipmentById ?? {};
  const selectedEquipment = workbenchState.selectedEquipmentId ? equipmentById[workbenchState.selectedEquipmentId] : null;
  let selectedGear = workbenchState.selectedEquipmentId
    ? gearSlots[workbenchState.selectedEquipmentId] ?? getDefaultGearSlots(workbenchState.selectedEquipmentId, selectedEquipment)
    : null;

  // Ensure we have the latest gear data from state
  if (workbenchState.selectedEquipmentId && selectedGear) {
    const currentGearFromState = (state as any).gearSlots?.[workbenchState.selectedEquipmentId];
    console.log("[RENDER] selectedEquipmentId:", workbenchState.selectedEquipmentId);
    console.log("[RENDER] currentGearFromState:", currentGearFromState);
    console.log("[RENDER] selectedGear before:", selectedGear);
    if (currentGearFromState) {
      selectedGear = currentGearFromState;
      console.log("[RENDER] selectedGear updated to:", selectedGear);
    }
  }

  // Get filtered library cards
  const allLibraryCards = getLibraryCards(cardLibrary);
  const filteredCards = filterLibraryCards(allLibraryCards, {
    rarity: workbenchState.rarityFilter ?? undefined,
    category: workbenchState.categoryFilter ?? undefined,
    search: workbenchState.searchFilter || undefined,
  });

  // Get unit's equipped gear for deck preview and gear selector
  const unitEquipment = getUnitEquippedGear(state, workbenchState.selectedUnitId);
  const unitGearSlots = unitEquipment.map(eqId => {
    const eq = equipmentById[eqId];
    return gearSlots[eqId] ?? getDefaultGearSlots(eqId, eq);
  });
  const compiledDeck = compileDeck(unitGearSlots);
  const deckPreview = getDeckPreview(compiledDeck);

  // equipmentById already retrieved above

  const backBtnText = workbenchState.returnDestination === "unitdetail"
    ? "← UNIT ROSTER"
    : workbenchState.returnDestination === "field"
      ? "← FIELD MODE"
      : "← BASE CAMP";

  app.innerHTML = /*html*/ `
    <div class="workbench-root town-screen ${workbenchState.isCompiling ? 'workbench-root--compiling' : ''}">
      <!-- Compile Overlay -->
      ${workbenchState.isCompiling ? renderCompileOverlay() : ''}
      
      <!-- Header -->
      <div class="workbench-header town-screen__header">
        <div class="workbench-header-left town-screen__titleblock">
          <h1 class="workbench-title">WORKSHOP</h1>
          <div class="workbench-subtitle">SLK://GEAR_FABRICATION_INTERFACE • DECK COMPILER v2.3</div>
        </div>
        <div class="workbench-header-right town-screen__header-right">
          <button class="workbench-back-btn town-screen__back-btn" id="backBtn">${backBtnText}</button>
        </div>
      </div>
      
      <!-- Tabs -->
      <div class="workbench-tabs town-screen__subnav">
        <button class="workbench-tab ${workbenchState.activeTab === 'build' ? 'workbench-tab--active' : ''}" 
                data-tab="build" 
                id="buildTabBtn">
          BUILD GEAR
        </button>
        <button class="workbench-tab ${workbenchState.activeTab === 'customize' ? 'workbench-tab--active' : ''}" 
                data-tab="customize" 
                id="customizeTabBtn">
          CUSTOMIZE GEAR
        </button>
        <button class="workbench-tab ${workbenchState.activeTab === 'endless' ? 'workbench-tab--active' : ''}" 
                data-tab="endless" 
                id="endlessTabBtn">
          TINKER
        </button>
        <button class="workbench-tab ${workbenchState.activeTab === 'craft' ? 'workbench-tab--active' : ''}" 
                data-tab="craft" 
                id="craftTabBtn">
          CRAFT
        </button>
      </div>
      
      <!-- Main Content -->
      <div class="workbench-main">
        ${workbenchState.activeTab === "build"
      ? renderBuildGearTab(state)
      : workbenchState.activeTab === "endless"
        ? renderEndlessCraftTab(state)
        : workbenchState.activeTab === "craft"
          ? renderCraftTab(state)
          : renderCustomizeGearTab(state, unitEquipment, equipmentById, selectedGear, filteredCards, cardLibrary, gearSlots, compiledDeck, deckPreview)
    }
      </div>
          <!-- Gear Selector (Only for Customize tab) -->
          ${workbenchState.activeTab === 'customize' ? `
            <div class="panel-section-title">SELECTED GEAR</div>
            ${renderGearSelector(unitEquipment, equipmentById, workbenchState.selectedEquipmentId)}
          ` : ''}
          
      
      <!-- Console -->
      <div class="workbench-console">
        <div class="console-header">SCROLLINK OS // WORKBENCH_LOG</div>
        <div class="console-body" id="workbenchLog">
          ${workbenchState.activeTab === "build"
      ? '<div class="console-line">SLK//BUILDER :: Gear fabrication interface online.</div>'
      : workbenchState.activeTab === "craft"
        ? '<div class="console-line">SLK//CRAFTING :: Fabrication terminal online.</div>'
        : '<div class="console-line">SLK//WORKBENCH :: Card slotting interface online.</div><div class="console-line">SLK//READY :: Drag cards from library to gear slots.</div>'
    }
        </div>
      </div>
    </div>
  `;

  attachGearWorkbenchExitHotkey(workbenchState.returnDestination);
  if (workbenchState.activeTab === "build") {
    attachBuildGearListeners(state);
  } else if (workbenchState.activeTab === "endless") {
    attachEndlessCraftListeners(state);
  } else if (workbenchState.activeTab === "craft") {
    attachCraftTabListeners(state);
  } else {
    attachWorkbenchListeners(state, cardLibrary, gearSlots, selectedGear);
  }
}

// ----------------------------------------------------------------------------
// BUILD GEAR TAB
// ----------------------------------------------------------------------------

function renderBuildGearTab(state: GameState): string {
  const unlockedChassisIds = state.unlockedChassisIds || [];
  const unlockedDoctrineIds = state.unlockedDoctrineIds || [];

  // Get available chassis for selected slot type
  const availableChassis = workbenchState.buildSlotType
    ? getChassisBySlotType(workbenchState.buildSlotType).filter(c => unlockedChassisIds.includes(c.id))
    : [];

  // Get available doctrines
  const availableDoctrines = ALL_DOCTRINES.filter(d => unlockedDoctrineIds.includes(d.id));

  // Get selected chassis and doctrine
  let selectedChassis = workbenchState.buildChassisId ? getChassisById(workbenchState.buildChassisId) : null;
  let selectedDoctrine = workbenchState.buildDoctrineId ? getDoctrineById(workbenchState.buildDoctrineId) : null;

  // Validate ownership - if selected items are not owned, reset to null
  if (selectedChassis && !unlockedChassisIds.includes(selectedChassis.id)) {
    console.warn(`[GEAR BUILDER] Selected chassis ${selectedChassis.id} is not owned, resetting`);
    selectedChassis = null;
    workbenchState.buildChassisId = null;
  }
  if (selectedDoctrine && !unlockedDoctrineIds.includes(selectedDoctrine.id)) {
    console.warn(`[GEAR BUILDER] Selected doctrine ${selectedDoctrine.id} is not owned, resetting`);
    selectedDoctrine = null;
    workbenchState.buildDoctrineId = null;
  }

  // Calculate build cost and can afford
  let buildCost = null;
  let canAfford = false;
  if (selectedChassis && selectedDoctrine) {
    buildCost = getBuildCost(selectedChassis.id, selectedDoctrine.id);
    canAfford = buildCost ? canAffordBuild(selectedChassis.id, selectedDoctrine.id, state) : false;
  }

  // Generate item name preview
  let itemNamePreview = "—";
  if (selectedChassis && selectedDoctrine) {
    itemNamePreview = `${selectedDoctrine.name} ${selectedChassis.name}`;
  }

  // Calculate final stability
  let finalStability = 0;
  if (selectedChassis && selectedDoctrine) {
    finalStability = Math.max(0, Math.min(100, selectedChassis.baseStability + selectedDoctrine.stabilityModifier));
  }

  return `
    <div class="builder-main">
      <!-- Left: Slot Type Selection -->
      <div class="builder-slot-selector">
        <div class="panel-section-title">SELECT SLOT TYPE</div>
        <div class="slot-type-options">
          <button class="slot-type-btn ${workbenchState.buildSlotType === 'weapon' ? 'slot-type-btn--active' : ''}" 
                  data-slot-type="weapon">
            ⚔ WEAPON
          </button>
          <button class="slot-type-btn ${workbenchState.buildSlotType === 'helmet' ? 'slot-type-btn--active' : ''}" 
                  data-slot-type="helmet">
            🪖 HELMET
          </button>
          <button class="slot-type-btn ${workbenchState.buildSlotType === 'chestpiece' ? 'slot-type-btn--active' : ''}" 
                  data-slot-type="chestpiece">
            🛡 CHESTPIECE
          </button>
          <button class="slot-type-btn ${workbenchState.buildSlotType === 'accessory' ? 'slot-type-btn--active' : ''}" 
                  data-slot-type="accessory">
            💎 ACCESSORY
          </button>
        </div>
      </div>
      
      <!-- Middle: Chassis Selection -->
      <div class="builder-chassis-panel">
        <div class="panel-section-title">CHASSIS</div>
        <div class="chassis-list" id="chassisList">
          ${availableChassis.length > 0
      ? availableChassis.map(chassis => renderChassisCard(chassis, workbenchState.buildChassisId === chassis.id)).join('')
      : '<div class="builder-empty">Select slot type to view available chassis</div>'
    }
        </div>
      </div>
      
      <!-- Right: Doctrine Selection -->
      <div class="builder-doctrine-panel">
        <div class="panel-section-title">DOCTRINE</div>
        <div class="doctrine-list" id="doctrineList">
          ${availableDoctrines.map(doctrine => renderDoctrineCard(doctrine, workbenchState.buildDoctrineId === doctrine.id)).join('')}
        </div>
      </div>
      
      <!-- Bottom: Summary and Build -->
      <div class="builder-summary-panel">
        <div class="panel-section-title">BUILD SUMMARY</div>
        <div class="summary-content">
          <div class="summary-row">
            <span class="summary-label">Item Name:</span>
            <span class="summary-value">${itemNamePreview}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Slot Type:</span>
            <span class="summary-value">${workbenchState.buildSlotType ? workbenchState.buildSlotType.toUpperCase() : "—"}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Base Stability:</span>
            <span class="summary-value">${finalStability}</span>
          </div>
          ${selectedChassis ? `
            <div class="summary-row">
              <span class="summary-label">Logistics:</span>
              <span class="summary-value">${selectedChassis.baseMassKg}kg / ${selectedChassis.baseBulkBu}bu / ${selectedChassis.basePowerW}W</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Card Slots:</span>
              <span class="summary-value">${selectedChassis.maxCardSlots}</span>
            </div>
          ` : ''}
          ${buildCost ? `
            <div class="summary-cost">
              <div class="summary-label">BUILD COST:</div>
              <div class="cost-items">
                <span class="cost-item ${state.resources.metalScrap >= buildCost.metalScrap ? '' : 'cost-item--insufficient'}">
                  ⚙ ${buildCost.metalScrap} Metal (${state.resources.metalScrap})
                </span>
                <span class="cost-item ${state.resources.wood >= buildCost.wood ? '' : 'cost-item--insufficient'}">
                  🪵 ${buildCost.wood} Wood (${state.resources.wood})
                </span>
                <span class="cost-item ${state.resources.chaosShards >= buildCost.chaosShards ? '' : 'cost-item--insufficient'}">
                  💎 ${buildCost.chaosShards} Shards (${state.resources.chaosShards})
                </span>
                <span class="cost-item ${state.resources.steamComponents >= buildCost.steamComponents ? '' : 'cost-item--insufficient'}">
                  ⚙ ${buildCost.steamComponents} Steam (${state.resources.steamComponents})
                </span>
              </div>
            </div>
          ` : ''}
        </div>
        <div class="builder-actions">
          <button class="builder-btn builder-btn--cancel" id="cancelBuildBtn">CANCEL</button>
          <button class="builder-btn builder-btn--build" 
                  id="buildBtn" 
                  ${(workbenchState.buildSlotType && selectedChassis && selectedDoctrine && canAfford) ? '' : 'disabled'}>
            ${canAfford ? 'BUILD' : (selectedChassis && selectedDoctrine ? 'INSUFFICIENT MATERIALS' : 'SELECT OPTIONS')}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderChassisCard(chassis: GearChassis, isSelected: boolean): string {
  return `
    <div class="chassis-card ${isSelected ? 'chassis-card--selected' : ''}" 
         data-chassis-id="${chassis.id}">
      <div class="chassis-card-header">
        <div class="chassis-card-name">${chassis.name}</div>
        ${isSelected ? '<div class="chassis-card-badge">SELECTED</div>' : ''}
      </div>
      <div class="chassis-card-stability">
        <span class="stability-label">Stability:</span>
        <span class="stability-value">${chassis.baseStability}</span>
      </div>
      <div class="chassis-card-logistics">
        <span>${chassis.baseMassKg}kg / ${chassis.baseBulkBu}bu / ${chassis.basePowerW}W</span>
      </div>
      <div class="chassis-card-slots">
        <span>${chassis.maxCardSlots} Card Slots</span>
      </div>
      <div class="chassis-card-description">${chassis.description}</div>
    </div>
  `;
}

function renderDoctrineCard(doctrine: GearDoctrine, isSelected: boolean): string {
  const stabilityMod = doctrine.stabilityModifier >= 0 ? `+${doctrine.stabilityModifier}` : `${doctrine.stabilityModifier}`;

  return `
    <div class="doctrine-card ${isSelected ? 'doctrine-card--selected' : ''}" 
         data-doctrine-id="${doctrine.id}">
      <div class="doctrine-card-header">
        <div class="doctrine-card-name">${doctrine.name}</div>
        ${isSelected ? '<div class="doctrine-card-badge">SELECTED</div>' : ''}
      </div>
      <div class="doctrine-card-intent">
        <span class="intent-tags">${doctrine.intentTags.map(t => t.toUpperCase()).join(', ')}</span>
      </div>
      <div class="doctrine-card-stability">
        <span class="stability-label">Stability Mod:</span>
        <span class="stability-value ${doctrine.stabilityModifier >= 0 ? 'stability-value--positive' : 'stability-value--negative'}">
          ${stabilityMod}
        </span>
      </div>
      <div class="doctrine-card-description">${doctrine.shortDescription}</div>
      <div class="doctrine-card-rules">${doctrine.doctrineRules || ''}</div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// ENDLESS CRAFT TAB
// ----------------------------------------------------------------------------

function renderEndlessCraftTab(state: GameState): string {
  const unlockedChassisIds = state.unlockedChassisIds || [];
  const resources = state.resources;

  // Get available chassis (all slot types)
  const availableChassis = ALL_CHASSIS.filter(c => unlockedChassisIds.includes(c.id));

  // Get selected chassis
  const selectedChassis = workbenchState.endlessChassisId
    ? getChassisById(workbenchState.endlessChassisId)
    : null;

  // Material options
  const materialOptions: Array<{ id: CraftingMaterialId; name: string; icon: string; available: number }> = [
    { id: "metal_scrap", name: "Metal Scrap", icon: "⚙", available: resources.metalScrap },
    { id: "wood", name: "Wood", icon: "🪵", available: resources.wood },
    { id: "chaos_shard", name: "Chaos Shard", icon: "💎", available: resources.chaosShards },
    { id: "steam_component", name: "Steam Component", icon: "⚡", available: resources.steamComponents },
  ];

  // Calculate cost
  const recipeCost = workbenchState.endlessMaterials.length > 0
    ? getEndlessRecipeCost(workbenchState.endlessMaterials as CraftingMaterialId[])
    : { metalScrap: 0, wood: 0, chaosShards: 0, steamComponents: 0 };

  const canAfford = workbenchState.endlessMaterials.length >= 3
    ? canAffordEndlessRecipe(workbenchState.endlessMaterials as CraftingMaterialId[], state)
    : false;

  // Generate preview if chassis and 3 materials selected
  let previewHtml = "";
  if (selectedChassis && workbenchState.endlessMaterials.length >= 3) {
    try {
      const ctx = createGenerationContext();
      const previewRecipe = {
        chassisId: selectedChassis.id,
        materials: workbenchState.endlessMaterials.slice(0, 3) as CraftingMaterialId[],
        seed: 99999, // Fixed seed for preview
      };
      const previewGear = generateEndlessGearFromRecipe(previewRecipe, ctx);
      previewHtml = `
        <div class="endless-preview">
          <div class="panel-section-title">PREVIEW (Deterministic)</div>
          <div class="endless-preview-item">
            <div class="preview-label">Name:</div>
            <div class="preview-value">${(previewGear as any).name}</div>
          </div>
          <div class="endless-preview-item">
            <div class="preview-label">Stability:</div>
            <div class="preview-value">${previewGear.stability}%</div>
          </div>
          <div class="endless-preview-item">
            <div class="preview-label">Doctrine:</div>
            <div class="preview-value">${previewGear.doctrineId || "N/A"}</div>
          </div>
          <div class="endless-preview-item">
            <div class="preview-label">Field Mods:</div>
            <div class="preview-value">${(previewGear as any).fieldMods?.length || 0}</div>
          </div>
          <div class="endless-preview-note">
            Note: Actual result will vary (non-deterministic unless seed provided)
          </div>
        </div>
      `;
    } catch (e) {
      previewHtml = `<div class="endless-preview-error">Preview error: ${e}</div>`;
    }
  }

  return `
    <div class="endless-craft-main">
      <!-- Left: Chassis Selection -->
      <div class="endless-chassis-panel">
        <div class="panel-section-title">SELECT CHASSIS</div>
        <div class="endless-chassis-list" id="endlessChassisList">
          ${availableChassis.length > 0
      ? availableChassis.map(chassis => `
              <div class="endless-chassis-card ${workbenchState.endlessChassisId === chassis.id ? 'endless-chassis-card--selected' : ''}" 
                   data-chassis-id="${chassis.id}">
                <div class="chassis-card-header">
                  <div class="chassis-card-name">${chassis.name}</div>
                  <div class="chassis-card-slot">${chassis.slotType.toUpperCase()}</div>
                </div>
                <div class="chassis-card-stats">
                  <div>Stability: ${chassis.baseStability}</div>
                  <div>Slots: ${chassis.maxCardSlots}</div>
                </div>
              </div>
            `).join('')
      : '<div class="endless-empty">No chassis unlocked</div>'
    }
        </div>
      </div>
      
      <!-- Middle: Material Selection -->
      <div class="endless-materials-panel">
        <div class="panel-section-title">SELECT MATERIALS (3 required)</div>
        <div class="endless-materials-list" id="endlessMaterialsList">
          ${materialOptions.map(mat => {
      const count = workbenchState.endlessMaterials.filter(m => m === mat.id).length;
      const canAdd = workbenchState.endlessMaterials.length < 3 && mat.available > 0;
      return `
              <div class="endless-material-card ${!canAdd && count === 0 ? 'endless-material-card--disabled' : ''}" 
                   data-material-id="${mat.id}">
                <div class="material-card-icon">${mat.icon}</div>
                <div class="material-card-name">${mat.name}</div>
                <div class="material-card-count">Available: ${mat.available}</div>
                <div class="material-card-selected">Selected: ${count}</div>
                <button class="material-add-btn" ${!canAdd ? 'disabled' : ''} data-action="add" data-material="${mat.id}">+</button>
                ${count > 0 ? `<button class="material-remove-btn" data-action="remove" data-material="${mat.id}">-</button>` : ''}
              </div>
            `;
    }).join('')}
        </div>
        
        <div class="endless-recipe-summary">
          <div class="panel-section-title">RECIPE COST</div>
          <div class="recipe-cost-item">
            <span>Metal Scrap:</span>
            <span class="${resources.metalScrap < recipeCost.metalScrap ? 'cost-insufficient' : ''}">${recipeCost.metalScrap}</span>
          </div>
          <div class="recipe-cost-item">
            <span>Wood:</span>
            <span class="${resources.wood < recipeCost.wood ? 'cost-insufficient' : ''}">${recipeCost.wood}</span>
          </div>
          <div class="recipe-cost-item">
            <span>Chaos Shards:</span>
            <span class="${resources.chaosShards < recipeCost.chaosShards ? 'cost-insufficient' : ''}">${recipeCost.chaosShards}</span>
          </div>
          <div class="recipe-cost-item">
            <span>Steam Components:</span>
            <span class="${resources.steamComponents < recipeCost.steamComponents ? 'cost-insufficient' : ''}">${recipeCost.steamComponents}</span>
          </div>
        </div>
        
        ${previewHtml}
      </div>
      
      <!-- Right: Craft Button -->
      <div class="endless-craft-panel">
        <div class="panel-section-title">CRAFT</div>
        <div class="endless-craft-info">
          <p><strong>Endless Crafting</strong> uses materials to bias procedural generation.</p>
          <p>Same recipe ≠ same result (unless seed provided).</p>
          <p>Materials influence:</p>
          <ul>
            <li>Doctrine selection (weighted)</li>
            <li>Field mods (tag-biased)</li>
            <li>Stability range</li>
            <li>Slot locks</li>
          </ul>
        </div>
        <button class="endless-craft-btn" 
                id="endlessCraftBtn" 
                ${!canAfford || !selectedChassis || workbenchState.endlessMaterials.length < 3 ? 'disabled' : ''}>
          CRAFT ENDLESS GEAR
        </button>
        <div class="endless-craft-warning">
          ⚠ Procedural gear - results vary!
        </div>
      </div>
    </div>
  `;
}

function renderCustomizeGearTab(
  state: any,
  unitEquipment: string[],
  equipmentById: Record<string, any>,
  selectedGear: GearSlotData | null,
  filteredCards: LibraryCard[],
  cardLibrary: CardLibrary,
  gearSlots: Record<string, GearSlotData>,
  compiledDeck: CompiledDeck,
  deckPreview: string[],
  selectedEquipment?: any
): string {
  return `
    <!-- Left Panel: Selected Gear -->
    <div class="workbench-gear-panel">
      <div class="panel-section-title">SELECTED GEAR</div>
      
      <!-- Gear Selector -->
      ${renderGearSelector(unitEquipment, equipmentById, workbenchState.selectedEquipmentId)}
      
      ${selectedGear ? renderGearEditor(selectedGear, workbenchState.selectedEquipmentId!, selectedEquipment) : renderNoGearSelected()}
      
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
  `;
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

function renderGearEditor(gear: GearSlotData, equipmentId: string, equipment?: any): string {
  const equipmentName = equipment?.name ?? formatEquipmentName(equipmentId);
  const slotsUsed = gear.slottedCards.length;
  const slotsTotal = gear.freeSlots;
  const stability = equipment?.stability;

  return `
    <div class="gear-editor">
      <div class="gear-name">${equipmentName}</div>
      <div class="gear-slot-info">Slots: ${slotsUsed} / ${slotsTotal}</div>
      ${stability !== undefined ? `
        <div class="gear-stability-info" title="Lower stability increases jam/strain volatility (future)">
          Stability: ${stability}/100
        </div>
      ` : ''}
      
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
  if (unit.loadout.primaryWeapon) gear.push(unit.loadout.primaryWeapon);
  if (unit.loadout.secondaryWeapon) gear.push(unit.loadout.secondaryWeapon);
  if (unit.loadout.helmet) gear.push(unit.loadout.helmet);
  if (unit.loadout.chestpiece) gear.push(unit.loadout.chestpiece);
  if (unit.loadout.accessory1) gear.push(unit.loadout.accessory1);
  if (unit.loadout.accessory2) gear.push(unit.loadout.accessory2);

  return gear;
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------------------

function attachEndlessCraftListeners(state: any): void {
  attachTabListeners();

  // Back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.onclick = () => {
      detachGearWorkbenchExitHotkey();
      const returnTo = workbenchState.returnDestination;
      workbenchState = {
        activeTab: "build",
        selectedEquipmentId: null,
        selectedUnitId: null,
        draggedCardId: null,
        searchFilter: "",
        rarityFilter: null,
        categoryFilter: null,
        isCompiling: false,
        compileMessages: [],
        returnDestination: "basecamp",
        buildSlotType: null,
        buildChassisId: null,
        buildDoctrineId: null,
        endlessChassisId: null,
        endlessMaterials: [],
        craftingCategory: "armor",
        selectedRecipeId: null,
      };

      if (returnTo === "field") {
        renderFieldScreen("base_camp");
      } else {
        renderAllNodesMenuScreen();
      }
    };
  }

  // Chassis selection
  document.querySelectorAll(".endless-chassis-card").forEach(card => {
    card.addEventListener("click", (e) => {
      const chassisId = (e.currentTarget as HTMLElement).getAttribute("data-chassis-id");
      if (chassisId) {
        workbenchState.endlessChassisId = chassisId;
        renderGearWorkbenchScreen(
          workbenchState.selectedUnitId ?? undefined,
          workbenchState.selectedEquipmentId ?? undefined,
          workbenchState.returnDestination
        );
      }
    });
  });

  // Material add/remove buttons
  document.querySelectorAll(".material-add-btn, .material-remove-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = (btn as HTMLElement).getAttribute("data-action");
      const materialId = (btn as HTMLElement).getAttribute("data-material");

      if (action === "add" && materialId && workbenchState.endlessMaterials.length < 3) {
        workbenchState.endlessMaterials.push(materialId);
        renderGearWorkbenchScreen(
          workbenchState.selectedUnitId ?? undefined,
          workbenchState.selectedEquipmentId ?? undefined,
          workbenchState.returnDestination
        );
      } else if (action === "remove" && materialId) {
        const index = workbenchState.endlessMaterials.indexOf(materialId);
        if (index >= 0) {
          workbenchState.endlessMaterials.splice(index, 1);
          renderGearWorkbenchScreen(
            workbenchState.selectedUnitId ?? undefined,
            workbenchState.selectedEquipmentId ?? undefined,
            workbenchState.returnDestination
          );
        }
      }
    });
  });

  // Craft button
  const craftBtn = document.getElementById("endlessCraftBtn");
  if (craftBtn) {
    craftBtn.onclick = () => {
      if (!workbenchState.endlessChassisId || workbenchState.endlessMaterials.length < 3) {
        return;
      }

      const recipe = {
        chassisId: workbenchState.endlessChassisId,
        materials: workbenchState.endlessMaterials.slice(0, 3) as CraftingMaterialId[],
      };

      const result = craftEndlessGear(recipe, state);

      if (result.success && result.equipment) {
        // Deduct materials
        const cost = getEndlessRecipeCost(recipe.materials);
        updateGameState(prev => ({
          ...prev,
          resources: {
            metalScrap: prev.resources.metalScrap - cost.metalScrap,
            wood: prev.resources.wood - cost.wood,
            chaosShards: prev.resources.chaosShards - cost.chaosShards,
            steamComponents: prev.resources.steamComponents - cost.steamComponents,
          },
        }));

        // Add to inventory
        addEndlessGearToInventory(result.equipment, state);

        // Show success message
        addWorkbenchLog(`SLK//ENDLESS_CRAFT :: ${(result.equipment as any).name} generated.`);
        addWorkbenchLog(`SLK//STABILITY :: ${result.equipment.stability}%`);
        addWorkbenchLog(`SLK//SEED :: ${result.equipment.provenance.seed}`);
        addWorkbenchLog(`SLK//READY :: Gear added to inventory.`);

        // Reset state
        workbenchState.endlessChassisId = null;
        workbenchState.endlessMaterials = [];

        // Re-render
        renderGearWorkbenchScreen(
          workbenchState.selectedUnitId ?? undefined,
          workbenchState.selectedEquipmentId ?? undefined,
          workbenchState.returnDestination
        );
      } else {
        addWorkbenchLog(`SLK//ERROR :: ${result.error || "Crafting failed"}`);
      }
    };
  }
}

function attachTabListeners(): void {
  const buildTabBtn = document.getElementById("buildTabBtn");
  const customizeTabBtn = document.getElementById("customizeTabBtn");
  const endlessTabBtn = document.getElementById("endlessTabBtn");
  const craftTabBtn = document.getElementById("craftTabBtn");

  if (buildTabBtn) {
    buildTabBtn.onclick = () => {
      workbenchState.activeTab = "build";
      renderGearWorkbenchScreen();
    };
  }

  if (customizeTabBtn) {
    customizeTabBtn.onclick = () => {
      workbenchState.activeTab = "customize";
      renderGearWorkbenchScreen();
    };
  }

  if (endlessTabBtn) {
    endlessTabBtn.onclick = () => {
      workbenchState.activeTab = "endless";
      renderGearWorkbenchScreen();
    };
  }

  if (craftTabBtn) {
    craftTabBtn.onclick = () => {
      workbenchState.activeTab = "craft";
      renderGearWorkbenchScreen();
    };
  }
}

function attachBuildGearListeners(state: any): void {
  attachTabListeners();

  // Back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.onclick = () => {
      const returnTo = workbenchState.returnDestination;
      workbenchState = {
        activeTab: "build",
        selectedEquipmentId: null,
        selectedUnitId: null,
        draggedCardId: null,
        searchFilter: "",
        rarityFilter: null,
        categoryFilter: null,
        isCompiling: false,
        compileMessages: [],
        returnDestination: "basecamp",
        buildSlotType: null,
        buildChassisId: null,
        buildDoctrineId: null,
        endlessChassisId: null,
        endlessMaterials: [],
        craftingCategory: "armor",
        selectedRecipeId: null,
      };

      if (returnTo === "field") {
        renderFieldScreen("base_camp");
      } else {
        renderAllNodesMenuScreen();
      }
    };
  }

  // Slot type selection
  document.querySelectorAll(".slot-type-btn").forEach(btn => {
    const el = btn as HTMLElement;
    el.onclick = () => {
      const slotType = el.getAttribute("data-slot-type") as ChassisSlotType;
      workbenchState.buildSlotType = slotType;
      workbenchState.buildChassisId = null; // Reset chassis selection when slot type changes
      renderGearWorkbenchScreen();
    };
  });

  // Chassis selection
  document.querySelectorAll(".chassis-card").forEach(card => {
    const el = card as HTMLElement;
    el.onclick = () => {
      const chassisId = el.getAttribute("data-chassis-id");
      if (chassisId) {
        workbenchState.buildChassisId = chassisId;
        renderGearWorkbenchScreen();
      }
    };
  });

  // Doctrine selection
  document.querySelectorAll(".doctrine-card").forEach(card => {
    const el = card as HTMLElement;
    el.onclick = () => {
      const doctrineId = el.getAttribute("data-doctrine-id");
      if (doctrineId) {
        workbenchState.buildDoctrineId = doctrineId;
        renderGearWorkbenchScreen();
      }
    };
  });

  // Build button
  const buildBtn = document.getElementById("buildBtn");
  if (buildBtn) {
    buildBtn.onclick = () => {
      if (!workbenchState.buildChassisId || !workbenchState.buildDoctrineId) return;

      // Validate ownership before building
      const unlockedChassisIds = state.unlockedChassisIds || [];
      const unlockedDoctrineIds = state.unlockedDoctrineIds || [];

      if (!unlockedChassisIds.includes(workbenchState.buildChassisId)) {
        alert("Some components were unavailable and were replaced. Please select a different chassis.");
        workbenchState.buildChassisId = null;
        renderGearWorkbenchScreen();
        return;
      }

      if (!unlockedDoctrineIds.includes(workbenchState.buildDoctrineId)) {
        alert("Some components were unavailable and were replaced. Please select a different doctrine.");
        workbenchState.buildDoctrineId = null;
        renderGearWorkbenchScreen();
        return;
      }

      const result = buildGear(workbenchState.buildChassisId, workbenchState.buildDoctrineId, state);

      if (result.success && result.equipment) {
        // Deduct materials
        const cost = getBuildCost(workbenchState.buildChassisId, workbenchState.buildDoctrineId);
        if (cost) {
          updateGameState(prev => ({
            ...prev,
            resources: {
              metalScrap: prev.resources.metalScrap - cost.metalScrap,
              wood: prev.resources.wood - cost.wood,
              chaosShards: prev.resources.chaosShards - cost.chaosShards,
              steamComponents: prev.resources.steamComponents - cost.steamComponents,
            },
          }));
        }

        // Add equipment to inventory
        const currentState = getGameState();
        updateGameState(prev => {
          const equipmentById = (prev as any).equipmentById || {};
          const equipmentPool = (prev as any).equipmentPool || [];

          return {
            ...prev,
            equipmentById: {
              ...equipmentById,
              [result.equipment!.id]: result.equipment,
            },
            equipmentPool: [...equipmentPool, result.equipment!.id],
          } as GameState;
        });

        // Initialize gear slots for new equipment
        const gearSlots = (currentState as any).gearSlots || {};
        updateGameState(prev => {
          const newGearSlots = {
            ...gearSlots,
            [result.equipment!.id]: {
              lockedCards: [],
              freeSlots: getChassisById(workbenchState.buildChassisId!)?.maxCardSlots || 3,
              slottedCards: [],
            },
          };

          return {
            ...prev,
            gearSlots: newGearSlots,
          } as GameState;
        });

        // Show success message
        addWorkbenchLog(`SLK//FABRICATE :: ${result.equipment.name} fabricated successfully.`);
        addWorkbenchLog(`SLK//READY :: Gear added to inventory. Switch to Customize tab to slot cards.`);

        // Reset build state
        workbenchState.buildSlotType = null;
        workbenchState.buildChassisId = null;
        workbenchState.buildDoctrineId = null;

        // Optionally switch to customize tab and select the new gear
        // For now, just refresh the build tab
        renderGearWorkbenchScreen();
      } else {
        addWorkbenchLog(`SLK//ERROR :: ${result.error || "Build failed"}`);
      }
    };
  }

  // Cancel button
  const cancelBtn = document.getElementById("cancelBuildBtn");
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      workbenchState.buildSlotType = null;
      workbenchState.buildChassisId = null;
      workbenchState.buildDoctrineId = null;
      renderGearWorkbenchScreen();
    };
  }
}

function attachWorkbenchListeners(
  state: any,
  cardLibrary: CardLibrary,
  gearSlots: Record<string, GearSlotData>,
  selectedGear: GearSlotData | null
): void {
  attachTabListeners();

  // Back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.onclick = () => {
      const unitId = workbenchState.selectedUnitId;
      const returnTo = workbenchState.returnDestination;

      // Reset state
      workbenchState = {
        activeTab: "customize",
        selectedEquipmentId: null,
        selectedUnitId: null,
        draggedCardId: null,
        searchFilter: "",
        rarityFilter: null,
        categoryFilter: null,
        isCompiling: false,
        compileMessages: [],
        returnDestination: "basecamp",
        buildSlotType: null,
        buildChassisId: null,
        buildDoctrineId: null,
        endlessChassisId: null,
        endlessMaterials: [],
        craftingCategory: "armor",
        selectedRecipeId: null,
      };

      // Navigate back
      if (returnTo === "unitdetail" && unitId) {
        renderUnitDetailScreen(unitId);
      } else if (returnTo === "field") {
        renderFieldScreen("base_camp");
      } else {
        renderAllNodesMenuScreen();
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
        renderGearWorkbenchScreen(
          workbenchState.selectedUnitId ?? undefined,
          equipmentId,
          workbenchState.returnDestination
        );
      }
    };
  });

  // Search filter
  const searchInput = document.getElementById("cardSearch") as HTMLInputElement;
  if (searchInput) {
    searchInput.oninput = () => {
      workbenchState.searchFilter = searchInput.value;
      renderGearWorkbenchScreen(
        workbenchState.selectedUnitId ?? undefined,
        workbenchState.selectedEquipmentId ?? undefined,
        workbenchState.returnDestination
      );
    };
  }

  // Rarity filter
  const raritySelect = document.getElementById("rarityFilter") as HTMLSelectElement;
  if (raritySelect) {
    raritySelect.onchange = () => {
      workbenchState.rarityFilter = raritySelect.value as CardRarity || null;
      renderGearWorkbenchScreen(
        workbenchState.selectedUnitId ?? undefined,
        workbenchState.selectedEquipmentId ?? undefined,
        workbenchState.returnDestination
      );
    };
  }

  // Category filter
  const categorySelect = document.getElementById("categoryFilter") as HTMLSelectElement;
  if (categorySelect) {
    categorySelect.onchange = () => {
      workbenchState.categoryFilter = categorySelect.value as CardCategory || null;
      renderGearWorkbenchScreen(
        workbenchState.selectedUnitId ?? undefined,
        workbenchState.selectedEquipmentId ?? undefined,
        workbenchState.returnDestination
      );
    };
  }

  // Drag and drop for library cards
  document.querySelectorAll(".library-card").forEach(card => {
    const el = card as HTMLElement;

    // FALLBACK: Click to select card
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cardId = el.getAttribute("data-card-id");
      console.log("[CLICK] Library card clicked:", cardId);
      if (cardId) {
        // Toggle selection
        if (workbenchState.draggedCardId === cardId) {
          // Deselect
          console.log("[CLICK] Deselecting card:", cardId);
          workbenchState.draggedCardId = null;
          el.classList.remove("library-card--selected");
          document.querySelectorAll(".slot-card--empty").forEach(slot => {
            slot.classList.remove("slot-card--highlight");
          });
        } else {
          // Clear previous selection
          console.log("[CLICK] Selecting card:", cardId);
          document.querySelectorAll(".library-card").forEach(c => {
            c.classList.remove("library-card--selected");
          });

          // Select this card
          workbenchState.draggedCardId = cardId;
          el.classList.add("library-card--selected");
          console.log("[CLICK] workbenchState.draggedCardId set to:", workbenchState.draggedCardId);

          // Highlight empty slots
          const emptySlots = document.querySelectorAll(".slot-card--empty");
          console.log("[CLICK] Found empty slots:", emptySlots.length);
          emptySlots.forEach(slot => {
            slot.classList.add("slot-card--highlight");
          });

          addWorkbenchLog(`SLK//SELECT :: ${LIBRARY_CARD_DATABASE[cardId]?.name ?? cardId} selected. Click an empty slot to install.`);
        }
      }
    });

    el.addEventListener("dragstart", (e: DragEvent) => {
      const cardId = el.getAttribute("data-card-id");
      console.log("[DRAG] Drag started for card:", cardId);
      if (cardId && e.dataTransfer) {
        workbenchState.draggedCardId = cardId;
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", cardId);
        el.classList.add("library-card--dragging");
        console.log("[DRAG] dataTransfer set, draggedCardId:", workbenchState.draggedCardId);

        // Add visual feedback to drop targets
        const emptySlots = document.querySelectorAll(".slot-card--empty");
        console.log("[DRAG] Highlighting", emptySlots.length, "empty slots");
        emptySlots.forEach(slot => {
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

    // FALLBACK: Click to slot selected card
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("[SLOT CLICK] Empty slot clicked");
      const cardId = workbenchState.draggedCardId;
      console.log("[SLOT CLICK] draggedCardId:", cardId);
      console.log("[SLOT CLICK] selectedEquipmentId:", workbenchState.selectedEquipmentId);

      if (cardId && workbenchState.selectedEquipmentId) {
        console.log("[SLOT CLICK] Attempting to slot card:", cardId);
        // Get fresh gear state
        const currentState = getGameState();
        const currentGearSlots = (currentState as any).gearSlots ?? {};
        const currentEquipmentById = (currentState as any).equipmentById ?? {};
        const currentEquipment = workbenchState.selectedEquipmentId ? currentEquipmentById[workbenchState.selectedEquipmentId] : null;
        const currentGear = currentGearSlots[workbenchState.selectedEquipmentId] ?? getDefaultGearSlots(workbenchState.selectedEquipmentId, currentEquipment);

        console.log("[SLOT CLICK] Current gear:", currentGear);
        console.log("[SLOT CLICK] Slotted cards:", currentGear.slottedCards);
        console.log("[SLOT CLICK] Free slots:", currentGear.freeSlots);

        // Slot the card
        const newGear = slotCard(currentGear, cardId);
        console.log("[SLOT CLICK] slotCard returned:", newGear);

        if (newGear) {
          console.log("[SLOT CLICK] SUCCESS - Updating game state");
          updateGameState(prev => {
            const gearSlots = (prev as any).gearSlots || {};
            const updatedState = {
              ...prev,
              gearSlots: {
                ...gearSlots,
                [workbenchState.selectedEquipmentId!]: newGear
              }
            };
            console.log("[SLOT CLICK] Returning updated state with gearSlots:", updatedState.gearSlots);
            return updatedState as GameState;
          });

          // Clear selection
          workbenchState.draggedCardId = null;
          document.querySelectorAll(".library-card").forEach(c => {
            c.classList.remove("library-card--selected");
          });

          addWorkbenchLog(`SLK//SLOT :: ${LIBRARY_CARD_DATABASE[cardId]?.name ?? cardId} installed.`);

          // Verify state before re-render
          const verifyState = getGameState();
          console.log("[SLOT CLICK] About to re-render. Verify gearSlots:", (verifyState as any).gearSlots);

          renderGearWorkbenchScreen(
            workbenchState.selectedUnitId ?? undefined,
            workbenchState.selectedEquipmentId ?? undefined,
            workbenchState.returnDestination
          );
        } else {
          console.log("[SLOT CLICK] FAILED - No free slots");
          addWorkbenchLog(`SLK//ERROR :: No free slots available.`);
        }
      } else {
        console.log("[SLOT CLICK] Missing cardId or equipmentId - no action taken");
      }
    });

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
      console.log("[DROP] Drop event fired");

      const cardId = e.dataTransfer?.getData("text/plain");
      console.log("[DROP] Card ID from dataTransfer:", cardId);
      console.log("[DROP] selectedEquipmentId:", workbenchState.selectedEquipmentId);

      if (cardId && workbenchState.selectedEquipmentId) {
        console.log("[DROP] Attempting to slot card:", cardId);
        // Get fresh gear state
        const currentState = getGameState();
        const currentGearSlots = (currentState as any).gearSlots ?? {};
        const currentEquipmentById = (currentState as any).equipmentById ?? {};
        const currentEquipment = workbenchState.selectedEquipmentId ? currentEquipmentById[workbenchState.selectedEquipmentId] : null;
        const currentGear = currentGearSlots[workbenchState.selectedEquipmentId] ?? getDefaultGearSlots(workbenchState.selectedEquipmentId, currentEquipment);

        console.log("[DROP] Current gear:", currentGear);

        // Slot the card
        const newGear = slotCard(currentGear, cardId);
        console.log("[DROP] slotCard returned:", newGear);

        if (newGear) {
          console.log("[DROP] SUCCESS - Updating game state");
          updateGameState(prev => {
            const gearSlots = (prev as any).gearSlots || {};
            return {
              ...prev,
              gearSlots: {
                ...gearSlots,
                [workbenchState.selectedEquipmentId!]: newGear
              }
            } as GameState;
          });

          addWorkbenchLog(`SLK//SLOT :: ${LIBRARY_CARD_DATABASE[cardId]?.name ?? cardId} installed.`);
          renderGearWorkbenchScreen(
            workbenchState.selectedUnitId ?? undefined,
            workbenchState.selectedEquipmentId ?? undefined,
            workbenchState.returnDestination
          );
        } else {
          console.log("[DROP] FAILED - No free slots");
          addWorkbenchLog(`SLK//ERROR :: No free slots available.`);
        }
      } else {
        console.log("[DROP] Missing cardId or equipmentId");
      }
    });
  });

  // Remove card from slot
  document.querySelectorAll(".slot-card-remove").forEach(btn => {
    const el = btn as HTMLElement;
    el.onclick = (e) => {
      e.stopPropagation();
      const indexStr = el.getAttribute("data-remove-index");
      if (indexStr !== null && workbenchState.selectedEquipmentId) {
        const index = parseInt(indexStr);

        // Get fresh gear state
        const currentState = getGameState();
        const currentGearSlots = (currentState as any).gearSlots ?? {};
        const currentEquipmentById = (currentState as any).equipmentById ?? {};
        const currentEquipment = workbenchState.selectedEquipmentId ? currentEquipmentById[workbenchState.selectedEquipmentId] : null;
        const currentGear = currentGearSlots[workbenchState.selectedEquipmentId] ?? getDefaultGearSlots(workbenchState.selectedEquipmentId, currentEquipment);

        const removedCardId = currentGear.slottedCards[index];
        const newGear = unslotCard(currentGear, index);

        updateGameState(prev => {
          const gearSlots = (prev as any).gearSlots || {};
          return {
            ...prev,
            gearSlots: {
              ...gearSlots,
              [workbenchState.selectedEquipmentId!]: newGear
            }
          } as GameState;
        });

        addWorkbenchLog(`SLK//UNSLOT :: ${LIBRARY_CARD_DATABASE[removedCardId]?.name ?? removedCardId} removed.`);
        renderGearWorkbenchScreen(
          workbenchState.selectedUnitId ?? undefined,
          workbenchState.selectedEquipmentId ?? undefined,
          workbenchState.returnDestination
        );
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
  renderGearWorkbenchScreen(
    workbenchState.selectedUnitId ?? undefined,
    workbenchState.selectedEquipmentId ?? undefined,
    workbenchState.returnDestination
  );

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
        renderGearWorkbenchScreen(
          workbenchState.selectedUnitId ?? undefined,
          workbenchState.selectedEquipmentId ?? undefined,
          workbenchState.returnDestination
        );
      }, 800);
    }
  }, 400);
}

function detachGearWorkbenchExitHotkey(): void {
  if (gearWorkbenchExitKeyHandler) {
    window.removeEventListener("keydown", gearWorkbenchExitKeyHandler);
    gearWorkbenchExitKeyHandler = null;
  }
}

// ----------------------------------------------------------------------------
// CRAFT TAB
// ----------------------------------------------------------------------------

function renderCraftTab(state: GameState): string {
  const knownRecipeIds = state.knownRecipeIds ?? getStarterRecipeIds();
  const resources = state.resources ?? { metalScrap: 0, wood: 0, chaosShards: 0, steamComponents: 0 };
  const consumables = state.consumables ?? {};

  const knownRecipes = getKnownRecipes(knownRecipeIds);
  const categoryRecipes = getRecipesByCategory(knownRecipes, workbenchState.craftingCategory);

  const selectedRecipe = workbenchState.selectedRecipeId ? RECIPE_DATABASE[workbenchState.selectedRecipeId] : null;

  const inventoryItemIds = getInventoryItemIds(state);
  const canCraft = selectedRecipe
    ? canAffordRecipe(selectedRecipe, resources) && hasRequiredItem(selectedRecipe, inventoryItemIds)
    : false;

  return `
    <div class="crafting-tab-layout">
      <!-- Left Panel: Resources & Categories -->
      <div class="crafting-sidebar">
        <!-- Resources Display -->
        <div class="crafting-resources">
          <div class="panel-section-title">MATERIALS</div>
          <div class="resource-grid">
            <div class="resource-item">
              <span class="resource-icon">⚙</span>
              <span class="resource-name">Metal</span>
              <span class="resource-value">${resources.metalScrap}</span>
            </div>
            <div class="resource-item">
              <span class="resource-icon">🪵</span>
              <span class="resource-name">Wood</span>
              <span class="resource-value">${resources.wood}</span>
            </div>
            <div class="resource-item">
              <span class="resource-icon">💎</span>
              <span class="resource-name">Shards</span>
              <span class="resource-value">${resources.chaosShards}</span>
            </div>
            <div class="resource-item">
              <span class="resource-icon">⚡</span>
              <span class="resource-name">Steam</span>
              <span class="resource-value">${resources.steamComponents}</span>
            </div>
          </div>
        </div>
        
        <!-- Category Tabs -->
        <div class="crafting-categories">
          <div class="panel-section-title">CATEGORIES</div>
          <div class="category-tabs">
            <button class="category-tab ${workbenchState.craftingCategory === 'armor' ? 'category-tab--active' : ''}" data-category="armor">
              🛡 Armor
            </button>
            <button class="category-tab ${workbenchState.craftingCategory === 'consumable' ? 'category-tab--active' : ''}" data-category="consumable">
              🧪 Consumables
            </button>
            <button class="category-tab ${workbenchState.craftingCategory === 'upgrade' ? 'category-tab--active' : ''}" data-category="upgrade">
              ⬆ Upgrades
            </button>
          </div>
          <div class="crafting-note">
            <div class="note-text">⚔ Weapons are engineered in the BUILD GEAR tab.</div>
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
        <div class="panel-section-title">${getCategoryTitle(workbenchState.craftingCategory)}</div>
        <div class="recipe-list" id="recipeList">
          ${categoryRecipes.length === 0
      ? '<div class="recipe-empty">No recipes known in this category.</div>'
      : categoryRecipes.map(recipe => renderRecipeItem(recipe, resources, inventoryItemIds, workbenchState.selectedRecipeId)).join('')
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
  `;
}

// Copied helper functions from WorkshopScreen
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
  if (recipe.deprecated || recipe.resultItemId.startsWith("weapon_")) {
    return `
      <div class="detail-panel detail-panel--deprecated">
        <div class="detail-header">
          <div class="detail-title">${recipe.name}</div>
          <div class="detail-category">MOVED</div>
        </div>
        <div class="detail-description">
          <p>Weapon crafting has moved to the BUILD GEAR tab.</p>
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
  const ids: string[] = [];
  if (state.equipmentById) {
    Object.keys(state.equipmentById).forEach(id => ids.push(id));
  }
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

function attachCraftTabListeners(state: any): void {
  attachTabListeners();

  // Category tabs
  document.querySelectorAll(".category-tab").forEach(tab => {
    (tab as HTMLElement).onclick = () => {
      const category = tab.getAttribute("data-category") as Recipe["category"];
      if (category) {
        workbenchState.craftingCategory = category;
        workbenchState.selectedRecipeId = null;
        renderGearWorkbenchScreen(undefined, undefined, workbenchState.returnDestination);
      }
    };
  });

  // Recipe items
  document.querySelectorAll(".recipe-item").forEach(item => {
    (item as HTMLElement).onclick = () => {
      const recipeId = item.getAttribute("data-recipe-id");
      if (recipeId) {
        workbenchState.selectedRecipeId = recipeId;
        renderGearWorkbenchScreen(undefined, undefined, workbenchState.returnDestination);
      }
    };
  });

  // Craft button
  const craftBtn = document.getElementById("craftBtn");
  if (craftBtn && workbenchState.selectedRecipeId) {
    craftBtn.onclick = () => {
      const recipe = RECIPE_DATABASE[workbenchState.selectedRecipeId!];
      if (!recipe) return;

      const inventoryItemIds = getInventoryItemIds(state);
      const result = craftItem(recipe, state.resources, inventoryItemIds);

      if (result.success) {
        updateGameState(prev => {
          const newResources = { ...prev.resources };
          const newEquipmentById = { ...(prev.equipmentById || {}) };
          const newConsumables = { ...(prev.consumables || {}) };

          // Deduct resources
          if (recipe.cost.metalScrap) newResources.metalScrap -= recipe.cost.metalScrap;
          if (recipe.cost.wood) newResources.wood -= recipe.cost.wood;
          if (recipe.cost.chaosShards) newResources.chaosShards -= recipe.cost.chaosShards;
          if (recipe.cost.steamComponents) newResources.steamComponents -= recipe.cost.steamComponents;

          // Remove base item for upgrades
          if (result.consumedItemId) {
            if (newEquipmentById[result.consumedItemId]) {
              delete newEquipmentById[result.consumedItemId];
            }
          }

          // Add crafted item
          if (recipe.category === "consumable") {
            const currentQty = newConsumables[result.itemId!] ?? 0;
            newConsumables[result.itemId!] = currentQty + (result.quantity ?? 1);
          } else {
            newEquipmentById[result.itemId!] = { id: result.itemId!, owned: true };
          }

          return {
            ...prev,
            resources: newResources,
            equipmentById: newEquipmentById,
            consumables: newConsumables
          } as GameState;
        });

        // Log success
        // simple re-render.
        renderGearWorkbenchScreen(undefined, undefined, workbenchState.returnDestination);
      }
    };
  }
}


function attachGearWorkbenchExitHotkey(returnTo: ReturnDestination): void {
  detachGearWorkbenchExitHotkey();

  if (returnTo !== "field") return;

  gearWorkbenchExitKeyHandler = (e: KeyboardEvent) => {
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
      detachGearWorkbenchExitHotkey();
      renderFieldScreen("base_camp");
    }
  };

  window.addEventListener("keydown", gearWorkbenchExitKeyHandler);
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

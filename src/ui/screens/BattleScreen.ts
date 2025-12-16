// src/ui/screens/BattleScreen.ts
// Battle screen with unit panel + weapon window alongside hand at bottom

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderOperationMapScreen, markCurrentRoomVisited } from "./OperationMapScreen";
const renderOperationMap = renderOperationMapScreen; // Alias for compatibility
import { renderBaseCampScreen } from "./BaseCampScreen";
import { addCardsToLibrary } from "../../core/gearWorkbench";
import { saveGame, loadGame } from "../../core/saveSystem";
import { getSettings, updateSettings } from "../../core/settings";
import { initControllerSupport } from "../../core/controllerSupport";

import {
  BattleState,
  advanceTurn,
  createTestBattleForCurrentParty,
  evaluateBattleOutcome,
  moveUnit,
  performEnemyTurn,
  BASE_STRAIN_THRESHOLD,
  BattleUnitState,
  placeUnit,
  quickPlaceUnits,
  confirmPlacement,
  calculateMaxUnitsPerSide,
  getEquippedWeapon,
  getMovePath,
  Vec2,
  performAutoBattleTurn,
} from "../../core/battle";
import { createBattleFromEncounter } from "../../core/battleFromEncounter";
import { getAllStarterEquipment } from "../../core/equipment";
import { getBattleUnitPortraitPath } from "../../core/portraits";
import { updateQuestProgress } from "../../quests/questManager";
import { trackBattleSurvival } from "../../core/affinityBattle";
// Isometric imports removed - using simple grid now
import { BattleGridRenderer } from "./BattleGridRenderer";

// Card type definition
interface Card {
  id: string;
  name: string;
  type: "core" | "class" | "equipment" | "gambit";
  target: "enemy" | "ally" | "self" | "tile";
  strainCost: number;
  range: number;
  description: string;
  damage?: number;
  healing?: number;
  defBuff?: number;
  atkBuff?: number;
}

// CARD DATABASE - Based on GDD
const CARD_DATABASE: Record<string, Card> = {
  // CORE CARDS
  "core_move_plus": { id: "core_move_plus", name: "Move+", type: "core", target: "self", strainCost: 1, range: 0, description: "Move 2 extra tiles this turn." },
  "core_basic_attack": { id: "core_basic_attack", name: "Basic Attack", type: "core", target: "enemy", strainCost: 0, range: 1, description: "Deal weapon damage to adjacent enemy.", damage: 0 },
  "core_aid": { id: "core_aid", name: "Aid", type: "core", target: "ally", strainCost: 1, range: 2, description: "Restore 3 HP to nearby ally.", healing: 3 },
  "core_overwatch": { id: "core_overwatch", name: "Overwatch", type: "core", target: "self", strainCost: 1, range: 0, description: "Attack enemy that enters range." },
  "core_guard": { id: "core_guard", name: "Guard", type: "core", target: "self", strainCost: 0, range: 0, description: "Gain +2 DEF until next turn.", defBuff: 2 },
  "core_wait": { id: "core_wait", name: "Wait", type: "core", target: "self", strainCost: 0, range: 0, description: "End turn. Reduce strain by 1." },
  
  // ELM RECURVE BOW (Range 3-6)
  "card_pinpoint_shot": { id: "card_pinpoint_shot", name: "Pinpoint Shot", type: "equipment", target: "enemy", strainCost: 1, range: 6, description: "Deal 4 damage; +1 ACC.", damage: 4 },
  "card_warning_shot": { id: "card_warning_shot", name: "Warning Shot", type: "equipment", target: "enemy", strainCost: 1, range: 6, description: "Target suffers -2 ACC for 1 turn.", damage: 1 },
  "card_defensive_draw": { id: "card_defensive_draw", name: "Defensive Draw", type: "equipment", target: "self", strainCost: 1, range: 0, description: "+1 DEF and +1 ACC until next attack.", defBuff: 1 },
  
  // HUNTER'S COIF
  "card_quick_shot": { id: "card_quick_shot", name: "Quick Shot", type: "equipment", target: "enemy", strainCost: 1, range: 5, description: "Deal 3 damage.", damage: 3 },
  "card_tracking_shot": { id: "card_tracking_shot", name: "Tracking Shot", type: "equipment", target: "enemy", strainCost: 1, range: 4, description: "Reveal target movement for 1 turn.", damage: 2 },
  "card_predators_brace": { id: "card_predators_brace", name: "Predator's Brace", type: "equipment", target: "self", strainCost: 1, range: 0, description: "First attacker loses 1 DEF.", defBuff: 1 },
  
  // HUNTER'S VEST
  "card_quiver_barrage": { id: "card_quiver_barrage", name: "Quiver Barrage", type: "equipment", target: "enemy", strainCost: 2, range: 4, description: "Three attacks, 2 damage each.", damage: 6 },
  "card_camouflage": { id: "card_camouflage", name: "Camouflage", type: "equipment", target: "self", strainCost: 1, range: 0, description: "+3 ACC on next ranged attack." },
  "card_camouflage_guard": { id: "card_camouflage_guard", name: "Camouflage Guard", type: "equipment", target: "self", strainCost: 1, range: 0, description: "+2 DEF if attacked at range.", defBuff: 2 },
  
  // HUNTER'S TALISMAN
  "card_hunters_pounce": { id: "card_hunters_pounce", name: "Hunter's Pounce", type: "equipment", target: "enemy", strainCost: 1, range: 2, description: "Deal 4 damage if target moved this turn.", damage: 4 },
  "card_scent_mark": { id: "card_scent_mark", name: "Scent Mark", type: "equipment", target: "enemy", strainCost: 1, range: 4, description: "Reveal target location for 2 turns.", damage: 1 },
  "card_trackers_guard": { id: "card_trackers_guard", name: "Tracker's Guard", type: "equipment", target: "self", strainCost: 1, range: 0, description: "Reveal first attacker on map.", defBuff: 1 },
  
  // EAGLE EYE LENS
  "card_spotters_shot": { id: "card_spotters_shot", name: "Spotter's Shot", type: "equipment", target: "enemy", strainCost: 1, range: 6, description: "Deal 4 damage; mark for +1 damage.", damage: 4 },
  "card_target_paint": { id: "card_target_paint", name: "Target Paint", type: "equipment", target: "enemy", strainCost: 1, range: 6, description: "Allies deal +1 damage to target this turn.", damage: 1 },
  "card_farsight_guard": { id: "card_farsight_guard", name: "Farsight Guard", type: "equipment", target: "self", strainCost: 1, range: 0, description: "Ignore overwatch this turn." },
  
  // FLEETFOOT ANKLET
  "card_flying_kick": { id: "card_flying_kick", name: "Flying Kick", type: "equipment", target: "enemy", strainCost: 1, range: 2, description: "Deal 3 damage; pass through target tile.", damage: 3 },
  "card_speed_burst": { id: "card_speed_burst", name: "Speed Burst", type: "equipment", target: "self", strainCost: 1, range: 0, description: "+2 movement this turn." },
  "card_swift_guard": { id: "card_swift_guard", name: "Swift Guard", type: "equipment", target: "self", strainCost: 1, range: 0, description: "+2 movement and +1 DEF this turn.", defBuff: 1 },
  
  // RANGER'S HOOD
  "card_aimed_strike": { id: "card_aimed_strike", name: "Aimed Strike", type: "equipment", target: "enemy", strainCost: 1, range: 4, description: "Deal 3 damage with +1 ACC.", damage: 3 },
  "card_hunters_mark": { id: "card_hunters_mark", name: "Hunter's Mark", type: "equipment", target: "enemy", strainCost: 1, range: 5, description: "Mark target; next ranged attack deals +2 damage.", damage: 1 },
  "card_hide_in_shadows": { id: "card_hide_in_shadows", name: "Hide in Shadows", type: "equipment", target: "self", strainCost: 1, range: 0, description: "+2 AGI, untargetable at range for 1 turn." },
  
  // LEATHER JERKIN
  "card_knife_toss": { id: "card_knife_toss", name: "Knife Toss", type: "equipment", target: "enemy", strainCost: 1, range: 3, description: "Deal 2 damage; +1 AGI next turn.", damage: 2 },
  "card_quick_roll": { id: "card_quick_roll", name: "Quick Roll", type: "equipment", target: "self", strainCost: 0, range: 0, description: "Move 1 tile as free action." },
  "card_light_guard": { id: "card_light_guard", name: "Light Guard", type: "equipment", target: "self", strainCost: 1, range: 0, description: "+1 DEF and +1 AGI until next turn.", defBuff: 1 },
  
  // SHADOW CLOAK
  "card_ambush_slash": { id: "card_ambush_slash", name: "Ambush Slash", type: "equipment", target: "enemy", strainCost: 2, range: 1, description: "Deal 5 damage if undetected at turn start.", damage: 5 },
  "card_fade": { id: "card_fade", name: "Fade", type: "equipment", target: "self", strainCost: 1, range: 0, description: "Untargetable by ranged attacks until next turn." },
  "card_shade_guard": { id: "card_shade_guard", name: "Shade Guard", type: "equipment", target: "self", strainCost: 1, range: 0, description: "Untargetable if you don't move this turn." },
  
  // CLASS - RANGER
  "class_pinning_shot": { id: "class_pinning_shot", name: "Pinning Shot", type: "class", target: "enemy", strainCost: 2, range: 5, description: "Immobilize enemy for 1 turn.", damage: 2 },
  "class_volley": { id: "class_volley", name: "Volley", type: "class", target: "enemy", strainCost: 3, range: 6, description: "Deal light damage to all enemies in range.", damage: 3 },
  "class_scouts_mark": { id: "class_scouts_mark", name: "Scout's Mark", type: "class", target: "self", strainCost: 1, range: 0, description: "Reveal all enemies and traps in range." },
  
  // CLASS - SQUIRE
  "class_power_slash": { id: "class_power_slash", name: "Power Slash", type: "class", target: "enemy", strainCost: 2, range: 1, description: "Deal heavy melee damage.", damage: 6 },
  "class_shield_wall": { id: "class_shield_wall", name: "Shield Wall", type: "class", target: "self", strainCost: 3, range: 0, description: "All allies gain +2 DEF for 1 turn.", defBuff: 2 },
  "class_rally_cry": { id: "class_rally_cry", name: "Rally Cry", type: "class", target: "self", strainCost: 2, range: 0, description: "All allies gain +2 ATK for 2 turns.", atkBuff: 2 },
  
  // IRON LONGSWORD
  "card_cleave": { id: "card_cleave", name: "Cleave", type: "equipment", target: "enemy", strainCost: 1, range: 1, description: "Deal 3 damage to up to 3 adjacent enemies.", damage: 3 },
  "card_parry_readiness": { id: "card_parry_readiness", name: "Parry Readiness", type: "equipment", target: "self", strainCost: 1, range: 0, description: "Cancel next attack against you.", defBuff: 3 },
  "card_guarded_stance": { id: "card_guarded_stance", name: "Guarded Stance", type: "equipment", target: "self", strainCost: 1, range: 0, description: "+2 DEF until your next turn.", defBuff: 2 },
  
  // STEEL SIGNET RING
  "card_knuckle_jab": { id: "card_knuckle_jab", name: "Knuckle Jab", type: "equipment", target: "enemy", strainCost: 1, range: 1, description: "Deal 2 damage and push target 1 tile.", damage: 2 },
  "card_mark_of_command": { id: "card_mark_of_command", name: "Mark of Command", type: "equipment", target: "self", strainCost: 1, range: 0, description: "All allies gain +1 ACC next turn." },
  "card_signet_shield": { id: "card_signet_shield", name: "Signet Shield", type: "equipment", target: "self", strainCost: 1, range: 0, description: "+1 DEF and +1 LUK until next turn.", defBuff: 1 },
  
  // IRONGUARD HELM
  "card_headbutt": { id: "card_headbutt", name: "Headbutt", type: "equipment", target: "enemy", strainCost: 1, range: 1, description: "Deal 2 damage and stun for 1 turn.", damage: 2 },
  "card_shield_sight": { id: "card_shield_sight", name: "Shield Sight", type: "equipment", target: "self", strainCost: 1, range: 0, description: "Ignore flanking penalties until next turn." },
  "card_shield_headbutt": { id: "card_shield_headbutt", name: "Shield Headbutt", type: "equipment", target: "enemy", strainCost: 1, range: 1, description: "Stun target for 1 turn.", damage: 1 },
  
  // STEELPLATE CUIRASS
  "card_shoulder_charge": { id: "card_shoulder_charge", name: "Shoulder Charge", type: "equipment", target: "enemy", strainCost: 1, range: 1, description: "Deal 3 damage; push target 1 tile.", damage: 3 },
  "card_fortify": { id: "card_fortify", name: "Fortify", type: "equipment", target: "self", strainCost: 1, range: 0, description: "Immunity to knockback until next turn.", defBuff: 1 },
  "card_fortress_form": { id: "card_fortress_form", name: "Fortress Form", type: "equipment", target: "self", strainCost: 1, range: 0, description: "+3 DEF but -1 movement this turn.", defBuff: 3 },
};

function getCardById(id: string): Card | null {
  if (CARD_DATABASE[id]) return CARD_DATABASE[id];
  const normalized = id.toLowerCase().replace(/-/g, "_");
  if (CARD_DATABASE[normalized]) return CARD_DATABASE[normalized];
  return null;
}

function fallbackGetCardById(id: string): Card {
  const cleanId = id.replace(/^(core_|class_|equip_|card_|gambit_|equipment_)/, "").replace(/_/g, " ");
  const name = cleanId.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  let type: Card["type"] = "equipment";
  if (id.startsWith("core_")) type = "core";
  if (id.startsWith("class_")) type = "class";
  if (id.startsWith("gambit_")) type = "gambit";
  let target: Card["target"] = "enemy";
  let range = 5;
  let damage: number | undefined = 3;
  const lower = name.toLowerCase();
  if (lower.includes("guard") || lower.includes("stance") || lower.includes("draw") || lower.includes("brace") || lower.includes("hide") || lower.includes("fade") || lower.includes("roll") || lower.includes("burst") || lower.includes("overwatch") || lower.includes("wait") || lower.includes("form")) {
    target = "self";
    range = 0;
    damage = undefined;
  } else if (lower.includes("aid") || lower.includes("heal")) {
    target = "ally";
    range = 2;
    damage = undefined;
  } else if (lower.includes("slash") || lower.includes("strike") || lower.includes("attack") || lower.includes("stab") || lower.includes("jab") || lower.includes("charge") || lower.includes("headbutt")) {
    range = 1;
  }
  return { id, name, type, target, strainCost: 1, range, damage, description: `Use ${name}.` };
}

function renderWeaponWindow(unit: BattleUnitState | undefined): string {
  if (!unit || !unit.equippedWeaponId) {
    return `<div class="weapon-window weapon-window--empty"><div class="weapon-window-title">NO WEAPON</div></div>`;
  }

  // Pull weapon data from equipment for accurate mechanical flags and stats
  const state = getGameState();
  const equipmentById = (state as any).equipmentById || getAllStarterEquipment();
  const weapon = getEquippedWeapon(unit, equipmentById);

  if (!weapon) {
    return `<div class="weapon-window weapon-window--empty"><div class="weapon-window-title">UNKNOWN WEAPON</div></div>`;
  }

  const weaponName = weapon.name || unit.equippedWeaponId.replace(/^weapon_/, "").replace(/_/g, " ").toUpperCase();
  const isMechanical = weapon.isMechanical ?? false;

  // Prefer weaponState for runtime values; fall back to legacy fields
  const heat = unit.weaponState?.currentHeat ?? unit.weaponHeat ?? 0;
  const maxHeat = weapon.heatCapacity ?? 6;
  const wear = unit.weaponState?.wear ?? unit.weaponWear ?? 0;
  const clutchActive = unit.weaponState?.clutchActive ?? unit.clutchActive ?? false;
  const ammo = unit.weaponState?.currentAmmo ?? weapon.ammoMax ?? 0;
  const ammoMax = weapon.ammoMax ?? 0;
  const nodes: Record<number, string> = unit.weaponState?.nodes ?? {
    1: "ok", 2: "ok", 3: "ok", 4: "ok", 5: "ok", 6: "ok"
  };
  
  const nodeNames: Record<number, string> = {
    1: "BARREL", 2: "TRIGGER", 3: "STOCK", 4: "SCOPE", 5: "COOLING", 6: "CORE"
  };
  
  // Build stats HTML
  let statsHtml = '';
  if (isMechanical) {
    const heatPct = (heat / maxHeat) * 100;
    let heatColor = "#84c1e6";
    if (heatPct > 80) heatColor = "#c3132c";
    else if (heatPct > 60) heatColor = "#f06b58";
    else if (heatPct > 40) heatColor = "#f3a310";
    
    statsHtml += `
      <div class="weapon-stat-row">
        <span class="weapon-stat-label">HEAT</span>
        <div class="weapon-stat-bar">
          <div class="weapon-stat-bar-track">
            <div class="weapon-stat-bar-fill" style="width:${heatPct}%; background:${heatColor}"></div>
          </div>
          <span class="weapon-stat-value">${heat}/${maxHeat}</span>
        </div>
      </div>
    `;
  }
  
  if (wear > 0) {
    statsHtml += `
      <div class="weapon-stat-row">
        <span class="weapon-stat-label">WEAR</span>
        <div class="weapon-wear-pips">
          ${[0,1,2,3,4].map(i => `<div class="weapon-wear-pip ${i < wear ? 'weapon-wear-pip--filled' : ''}"></div>`).join('')}
        </div>
        <span class="weapon-stat-value">${wear}/5</span>
      </div>
    `;
  }
  
  // Build node diagram
  const nodeDiagramHtml = `
    <div class="weapon-node-diagram">
      <div class="weapon-node-title">SYSTEM STATUS</div>
      <div class="weapon-node-grid">
        ${[1,2,3,4,5,6].map(id => {
          const status = nodes[id] ?? "ok";
          return `
            <div class="weapon-node weapon-node--${status}" data-node="${id}">
              <div class="weapon-node-id">${id}</div>
              <div class="weapon-node-name">${nodeNames[id]}</div>
              <div class="weapon-node-status">${status.toUpperCase()}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  
  return `
    <div class="weapon-window">
      <div class="weapon-window-header">
        <span class="weapon-window-title">${weaponName}</span>
        <span class="weapon-window-type">${isMechanical ? 'MECHANICAL' : 'STANDARD'}</span>
      </div>
      <div class="weapon-window-body">
        <div class="weapon-stats-panel">${statsHtml}</div>
        
        ${isMechanical ? `
          <div class="weapon-clutch-section">
            <button class="weapon-clutch-btn ${clutchActive ? 'weapon-clutch-btn--active' : ''}" id="clutchToggleBtn">
              <span class="clutch-dot ${clutchActive ? 'clutch-dot--active' : ''}"></span>
              <span class="clutch-label">CLUTCH ${clutchActive ? '[ENGAGED]' : '[OFF]'}</span>
            </button>
          </div>
          
          ${nodeDiagramHtml}
          
          <div class="weapon-actions">
            <button class="weapon-action-btn weapon-action-btn--vent" id="ventBtn">VENT (10% HP)</button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// ============================================================================
// STATE MANAGEMENT - Store movement in battle state itself
// ============================================================================

let localBattleState: BattleState | null = null;
let selectedCardIndex: number | null = null;
let pendingMoveOrigin: { x: number; y: number } | null = null;

// Zoom state for the battle grid
let battleZoom = 1.3; // Increased default zoom for better visibility
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.1;

// ============================================================================
// FFTA-STYLE MOVEMENT ANIMATION SYSTEM
// ============================================================================

// Debug flag for movement instrumentation
const DEBUG_MOVEMENT = true; // Enable for debugging

interface MovingUnitAnim {
  unitId: string;
  path: Vec2[];        // includes start and end
  currentStep: number;  // current segment index (0 = first step)
  progress: number;     // 0..1 interpolation in current segment
  msPerTile: number;    // milliseconds per tile
  active: boolean;
  startTime: number;    // timestamp when animation started
  lastUpdateTime: number; // timestamp of last frame
  movingElement: HTMLElement | null; // Reference to the moving DOM element
  unitData: BattleUnitState; // Store unit data for rendering
}

let activeMovementAnim: MovingUnitAnim | null = null;
let animationFrameId: number | null = null;

// PERSISTENT ANIMATION CONTAINER - survives DOM replacement
let persistentAnimationContainer: HTMLElement | null = null;

/**
 * Get or create the persistent animation container
 * This container is attached to the battle grid and survives re-renders
 */
function getOrCreateAnimationContainer(): HTMLElement | null {
  // Try to find existing container first
  if (persistentAnimationContainer && document.body.contains(persistentAnimationContainer)) {
    return persistentAnimationContainer;
  }
  
  // Find the battle grid container
  const gridContainer = document.querySelector('.battle-grid-container--simple') as HTMLElement;
  if (!gridContainer) {
    console.error(`[ANIMATION] Grid container not found for animation container`);
    return null;
  }
  
  // Create or find animation container
  let animContainer = gridContainer.querySelector('.battle-animation-container') as HTMLElement;
  if (!animContainer) {
    animContainer = document.createElement('div');
    animContainer.className = 'battle-animation-container';
    animContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2000;
      overflow: visible;
    `;
    gridContainer.appendChild(animContainer);
  }
  
  persistentAnimationContainer = animContainer;
  return animContainer;
}

function setBattleZoom(z: number) {
  battleZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  const inner = document.querySelector(".battle-grid-zoom-inner") as HTMLElement | null;
  if (inner) {
    inner.style.transform = `scale(${battleZoom})`;
    inner.style.transformOrigin = "center center";
  }
}

function zoomIn() {
  setBattleZoom(battleZoom + ZOOM_STEP);
}

function zoomOut() {
  setBattleZoom(battleZoom - ZOOM_STEP);
}

// These are stored PER UNIT in an extended battle state
interface TurnState {
  hasMoved: boolean;
  hasCommittedMove: boolean; // True after clicking a tile - hides green until undo
  hasActed: boolean; // True after playing a card - ends the turn for this unit
  movementRemaining: number;
  originalPosition: { x: number; y: number } | null;
  isFacingSelection: boolean; // True when selecting facing after movement (FFTA-style)
}
let turnState: TurnState = { hasMoved: false, hasCommittedMove: false, hasActed: false, movementRemaining: 0, originalPosition: null, isFacingSelection: false };

// ============================================================================
// PAN STATE & CONTROLS (for WASD grid panning)
// ============================================================================

interface BattlePanState {
  x: number;
  y: number;
  keysPressed: Set<string>;
}

let battlePanState: BattlePanState = {
  x: 0,
  y: 0,
  keysPressed: new Set(),
};

let battlePanAnimationFrame: number | null = null;
let battleKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
let battleKeyupHandler: ((e: KeyboardEvent) => void) | null = null;

// UI panel visibility state
let uiPanelsMinimized = false;

// Endless battle mode state
let isEndlessBattleMode = false;
let endlessBattleCount = 0;

const BATTLE_PAN_SPEED = 15;
const BATTLE_PAN_KEYS = new Set(["w", "a", "s", "d", "W", "A", "S", "D", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);

function cleanupBattlePanHandlers(): void {
  if (battleKeydownHandler) {
    window.removeEventListener("keydown", battleKeydownHandler);
    battleKeydownHandler = null;
  }
  if (battleKeyupHandler) {
    window.removeEventListener("keyup", battleKeyupHandler);
    battleKeyupHandler = null;
  }
  if (battlePanAnimationFrame) {
    cancelAnimationFrame(battlePanAnimationFrame);
    battlePanAnimationFrame = null;
  }
  battlePanState.keysPressed.clear();
}

function setupBattlePanHandlers(): void {
  cleanupBattlePanHandlers();
  
  // Reset pan position
  battlePanState = { x: 0, y: 0, keysPressed: new Set() };

  battleKeydownHandler = (e: KeyboardEvent) => {
    // Handle facing selection first (if active, arrow keys select facing instead of panning)
    if (turnState.isFacingSelection && localBattleState && activeUnit) {
      const key = e.key.toLowerCase();
      let newFacing: "north" | "south" | "east" | "west" | null = null;
      
      if (key === "arrowup" || key === "w") {
        newFacing = "north";
      } else if (key === "arrowdown" || key === "s") {
        newFacing = "south";
      } else if (key === "arrowleft" || key === "a") {
        newFacing = "west";
      } else if (key === "arrowright" || key === "d") {
        newFacing = "east";
      }
      
      if (newFacing) {
        e.preventDefault();
        // Update facing and exit facing selection phase
        const newUnits = { ...localBattleState.units };
        newUnits[activeUnit.id] = { ...newUnits[activeUnit.id], facing: newFacing };
        const newState = { ...localBattleState, units: newUnits };
        setBattleState(newState);
        turnState.isFacingSelection = false;
        renderBattleScreen();
        return;
      }
    }
    
    if (!BATTLE_PAN_KEYS.has(e.key)) return;
    
    // Don't pan if typing in an input
    if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
      return;
    }
    
    e.preventDefault();
    battlePanState.keysPressed.add(e.key.toLowerCase());
    
    if (!battlePanAnimationFrame) {
      startBattlePanLoop();
    }
  };

  battleKeyupHandler = (e: KeyboardEvent) => {
    battlePanState.keysPressed.delete(e.key.toLowerCase());
    
    // Also handle arrow keys
    const arrowToWasd: Record<string, string> = {
      "arrowup": "w",
      "arrowleft": "a", 
      "arrowdown": "s",
      "arrowright": "d",
    };
    const mapped = arrowToWasd[e.key.toLowerCase()];
    if (mapped) {
      battlePanState.keysPressed.delete(mapped);
    }
  };

  window.addEventListener("keydown", battleKeydownHandler);
  window.addEventListener("keyup", battleKeyupHandler);
}

function startBattlePanLoop(): void {
  const update = () => {
    let dx = 0;
    let dy = 0;

    if (battlePanState.keysPressed.has("w") || battlePanState.keysPressed.has("arrowup")) dy += BATTLE_PAN_SPEED;
    if (battlePanState.keysPressed.has("s") || battlePanState.keysPressed.has("arrowdown")) dy -= BATTLE_PAN_SPEED;
    if (battlePanState.keysPressed.has("a") || battlePanState.keysPressed.has("arrowleft")) dx += BATTLE_PAN_SPEED;
    if (battlePanState.keysPressed.has("d") || battlePanState.keysPressed.has("arrowright")) dx -= BATTLE_PAN_SPEED;

    if (dx !== 0 || dy !== 0) {
      battlePanState.x += dx;
      battlePanState.y += dy;
      
      // Apply transform to battle grid pan wrapper
      const panWrapper = document.querySelector(".battle-grid-pan-wrapper") as HTMLElement;
      if (panWrapper) {
        panWrapper.style.transform = `translate(${battlePanState.x}px, ${battlePanState.y}px)`;
      }
    }

    if (battlePanState.keysPressed.size > 0) {
      battlePanAnimationFrame = requestAnimationFrame(update);
    } else {
      battlePanAnimationFrame = null;
    }
  };

  battlePanAnimationFrame = requestAnimationFrame(update);
}

function resetBattlePan(): void {
  battlePanState.x = 0;
  battlePanState.y = 0;
  const panWrapper = document.querySelector(".battle-grid-pan-wrapper") as HTMLElement;
  if (panWrapper) {
    panWrapper.style.transform = `translate(0px, 0px)`;
  }
}

function toggleUiPanels(): void {
  uiPanelsMinimized = !uiPanelsMinimized;
  
  const bottomOverlay = document.querySelector(".battle-bottom-overlay") as HTMLElement;
  const handFloating = document.querySelector(".battle-hand-floating") as HTMLElement;
  const consoleOverlay = document.querySelector(".scrollink-console-overlay") as HTMLElement;
  const toggleBtn = document.getElementById("toggleUiBtn");
  
  if (bottomOverlay) {
    bottomOverlay.style.transform = uiPanelsMinimized ? "translateY(100%)" : "translateY(0)";
    bottomOverlay.style.opacity = uiPanelsMinimized ? "0" : "1";
    bottomOverlay.style.pointerEvents = uiPanelsMinimized ? "none" : "auto";
  }
  
  if (handFloating) {
    handFloating.style.transform = uiPanelsMinimized ? "translateY(100%)" : "translateY(0)";
    handFloating.style.opacity = uiPanelsMinimized ? "0" : "1";
    handFloating.style.pointerEvents = uiPanelsMinimized ? "none" : "auto";
  }
  
  if (consoleOverlay) {
    consoleOverlay.style.transform = uiPanelsMinimized ? "translateX(-100%)" : "translateX(0)";
    consoleOverlay.style.opacity = uiPanelsMinimized ? "0" : "1";
    consoleOverlay.style.pointerEvents = uiPanelsMinimized ? "none" : "auto";
  }
  
  if (toggleBtn) {
    toggleBtn.textContent = uiPanelsMinimized ? "👁 SHOW UI" : "👁 HIDE UI";
    toggleBtn.classList.toggle("battle-toggle-btn--active", uiPanelsMinimized);
  }
}

function setBattleState(newState: BattleState) {
  // Validate all unit positions before setting state
  const validatedUnits: Record<string, BattleUnitState> = {};
  
  for (const [unitId, unit] of Object.entries(newState.units)) {
    if (unit.pos) {
      // Validate position is within bounds
      if (unit.pos.x < 0 || unit.pos.x >= newState.gridWidth ||
          unit.pos.y < 0 || unit.pos.y >= newState.gridHeight) {
        console.error("[BATTLE_STATE] Invalid unit position detected!", {
          unitId,
          pos: unit.pos,
          bounds: { width: newState.gridWidth, height: newState.gridHeight }
        });
        // Remove invalid position (unit will need to be repositioned)
        validatedUnits[unitId] = { ...unit, pos: undefined };
        continue;
      }
      
      // Validate position is an integer
      if (!Number.isInteger(unit.pos.x) || !Number.isInteger(unit.pos.y)) {
        console.error("[BATTLE_STATE] Non-integer unit position!", {
          unitId,
          pos: unit.pos
        });
        // Round to nearest integer
        validatedUnits[unitId] = {
          ...unit,
          pos: {
            x: Math.round(unit.pos.x),
            y: Math.round(unit.pos.y)
          }
        };
        continue;
      }
    }
    
    validatedUnits[unitId] = unit;
  }
  
  // Check for duplicate positions
  const positionMap = new Map<string, string>();
  for (const [unitId, unit] of Object.entries(validatedUnits)) {
    if (unit.pos && unit.hp > 0) {
      const key = `${unit.pos.x},${unit.pos.y}`;
      const existingUnitId = positionMap.get(key);
      if (existingUnitId && existingUnitId !== unitId) {
        console.error("[BATTLE_STATE] Duplicate unit positions detected!", {
          unit1: existingUnitId,
          unit2: unitId,
          pos: unit.pos
        });
        // Keep the first unit, remove position from the second
        validatedUnits[unitId] = { ...unit, pos: undefined };
      } else {
        positionMap.set(key, unitId);
      }
    }
  }
  
  localBattleState = {
    ...newState,
    units: validatedUnits
  };
}

function resetTurnStateForUnit(unit: BattleUnitState | null) {
  turnState = {
    hasMoved: false,
    hasCommittedMove: false,
    hasActed: false,
    movementRemaining: unit?.agi ?? 3,
    originalPosition: null,
    isFacingSelection: false,
  };
}

/**
 * Get elevation for a tile from battle state
 */
function getTileElevation(battle: BattleState, x: number, y: number): number {
  const tile = battle.tiles.find(t => t.pos.x === x && t.pos.y === y);
  return tile?.elevation ?? 0;
}

// Removed calculateOriginOffset - no longer needed for simple grid

/**
 * Completely rewritten movement animation system
 * Ensures smooth, consistent animations for all units
 */
function startMovementAnimation(
  unitId: string,
  path: Vec2[],
  battle: BattleState,
  onComplete: () => void
): void {
  // Validate inputs
  if (!path || path.length < 2) {
    if (DEBUG_MOVEMENT) console.log(`[MOVEMENT] No movement needed for ${unitId}`);
    onComplete();
    return;
  }

  if (!battle.units[unitId]) {
    console.error(`[MOVEMENT] Unit ${unitId} not found in battle state`);
    onComplete();
    return;
  }

  if (DEBUG_MOVEMENT) {
    console.log(`[MOVEMENT] Starting animation for unit ${unitId}`);
    console.log(`[MOVEMENT] Path:`, path.map(p => `(${p.x},${p.y})`).join(' -> '));
  }

  // Stop any existing animation
  stopMovementAnimation();

  // Get unit data
  const unit = battle.units[unitId];
  if (!unit) {
    console.error(`[MOVEMENT] Unit ${unitId} not found`);
    onComplete();
    return;
  }

  // Get or create persistent animation container
  const animContainer = getOrCreateAnimationContainer();
  if (!animContainer) {
    console.error(`[MOVEMENT] Failed to get animation container`);
    onComplete();
    return;
  }

  // Get grid container to hide original unit
  const gridContainer = document.querySelector('.battle-grid-container--simple') as HTMLElement;
  if (gridContainer) {
    const originalUnit = gridContainer.querySelector(`.battle-unit[data-unit-id="${unitId}"]:not(.battle-unit--moving)`) as HTMLElement;
    if (originalUnit) {
      // Hide original unit
      originalUnit.style.opacity = '0';
      originalUnit.style.visibility = 'hidden';
      originalUnit.style.pointerEvents = 'none';
    }
  }

  // Create moving unit element from scratch (don't clone - more reliable)
  const movingUnit = document.createElement('div');
  movingUnit.className = 'battle-unit battle-unit--moving';
  movingUnit.setAttribute('data-unit-id', unitId);
  movingUnit.setAttribute('data-animating', 'true');
  
  // Get unit portrait path
  const portraitPath = getBattleUnitPortraitPath(unit.id, unit.baseUnitId);
  const side = unit.isEnemy ? "battle-unit--enemy" : "battle-unit--ally";
  const truncName = unit.name.length > 8 ? unit.name.slice(0, 8) + "…" : unit.name;
  
  // Build unit HTML
  movingUnit.innerHTML = `
    <div class="battle-unit-portrait-wrapper">
      <div class="battle-unit-portrait">
        <img src="${portraitPath}" alt="${unit.name}" class="battle-unit-portrait-img" onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
      </div>
      <div class="battle-unit-info-overlay">
        <div class="battle-unit-name">${truncName}</div>
        <div class="battle-unit-hp">HP ${unit.hp}/${unit.maxHp}</div>
      </div>
    </div>
  `;
  
  // Set up moving unit styles
  movingUnit.style.position = 'absolute';
  movingUnit.style.pointerEvents = 'none';
  movingUnit.style.opacity = '1';
  movingUnit.style.visibility = 'visible';
  movingUnit.style.display = 'flex';
  movingUnit.style.width = 'auto';
  movingUnit.style.height = 'auto';
  movingUnit.style.transform = 'translate(-50%, -50%)';
  movingUnit.style.transition = 'none';
  movingUnit.style.willChange = 'left, top';
  movingUnit.style.zIndex = '2000';
  movingUnit.style.background = 'none';
  movingUnit.style.border = 'none';
  movingUnit.style.padding = '0';
  movingUnit.style.margin = '0';
  movingUnit.style.boxShadow = 'none';

  // Remove backgrounds from children
  const children = movingUnit.querySelectorAll('*');
  children.forEach((child: Element) => {
    const el = child as HTMLElement;
    if (el.classList.contains('battle-unit-portrait')) {
      el.style.background = 'rgba(0,0,0,0.4)'; // Keep dark background for portrait
    } else if (el.classList.contains('battle-unit-info-overlay')) {
      el.style.background = 'rgba(0,0,0,0.7)'; // Keep dark background for info
    } else {
      el.style.background = 'none';
    }
    el.style.border = 'none';
    el.style.boxShadow = 'none';
  });

  // Calculate initial position (start of path)
  const TILE_SIZE = 75;
  const GRID_PADDING = 12;
  const GAP = 4;
  const startPos = path[0];
  const startX = GRID_PADDING + startPos.x * (TILE_SIZE + GAP) + TILE_SIZE / 2;
  const startY = GRID_PADDING + startPos.y * (TILE_SIZE + GAP) + TILE_SIZE / 2;

  // Set initial position
  movingUnit.style.left = `${startX}px`;
  movingUnit.style.top = `${startY}px`;

  // Add to animation container (persistent, survives re-renders)
  animContainer.appendChild(movingUnit);

  // Create animation state
  activeMovementAnim = {
    unitId,
    path,
    currentStep: 0,
    progress: 0,
    msPerTile: 200, // 200ms per tile for smooth movement
    active: true,
    startTime: performance.now(),
    lastUpdateTime: performance.now(),
    movingElement: movingUnit,
    unitData: unit, // Store unit data
  };

  if (DEBUG_MOVEMENT) {
    console.log(`[MOVEMENT] Animation started for ${unitId}, element created and added to container`);
  }

  // Start animation loop immediately
  animationFrameId = requestAnimationFrame(() => animateMovement(battle, onComplete));
}

/**
 * Main animation loop - updates every frame
 */
function animateMovement(battle: BattleState, onComplete: () => void): void {
  if (!activeMovementAnim || !activeMovementAnim.active || !activeMovementAnim.movingElement) {
    animationFrameId = null;
    if (activeMovementAnim && !activeMovementAnim.active) {
      onComplete();
    }
    return;
  }

  const anim = activeMovementAnim;
  const now = performance.now();
  const deltaMs = Math.min(now - anim.lastUpdateTime, 100); // Clamp to prevent large jumps
  anim.lastUpdateTime = now;

  // Validate path
  if (!anim.path || anim.path.length < 2 || anim.currentStep < 0 || anim.currentStep >= anim.path.length - 1) {
    console.error(`[MOVEMENT] Invalid animation state`, anim);
    stopMovementAnimation();
    onComplete();
    return;
  }

  // Update progress
  const progressStep = deltaMs / anim.msPerTile;
  anim.progress += progressStep;

  // Move to next segment if current one is complete
  while (anim.progress >= 1.0 && anim.currentStep < anim.path.length - 1) {
    anim.progress -= 1.0;
    anim.currentStep++;
    
    if (DEBUG_MOVEMENT && anim.currentStep < anim.path.length) {
      const tile = anim.path[anim.currentStep];
      console.log(`[MOVEMENT] Entered tile (${tile.x}, ${tile.y})`);
    }
  }

  // Check if animation is complete
  if (anim.currentStep >= anim.path.length - 1) {
    // Animation complete
    const finalPos = anim.path[anim.path.length - 1];
    if (DEBUG_MOVEMENT) {
      console.log(`[MOVEMENT] Animation complete for ${anim.unitId}, final position: (${finalPos.x}, ${finalPos.y})`);
    }
    stopMovementAnimation();
    onComplete();
    return;
  }

  // Calculate current position
  const from = anim.path[anim.currentStep];
  const to = anim.path[anim.currentStep + 1];
  
  const TILE_SIZE = 75;
  const GRID_PADDING = 12;
  const GAP = 4;
  
  const fromX = GRID_PADDING + from.x * (TILE_SIZE + GAP) + TILE_SIZE / 2;
  const fromY = GRID_PADDING + from.y * (TILE_SIZE + GAP) + TILE_SIZE / 2;
  const toX = GRID_PADDING + to.x * (TILE_SIZE + GAP) + TILE_SIZE / 2;
  const toY = GRID_PADDING + to.y * (TILE_SIZE + GAP) + TILE_SIZE / 2;

  // Apply easing (ease-in-out)
  const easedProgress = anim.progress < 0.5
    ? 2 * anim.progress * anim.progress
    : 1 - Math.pow(-2 * anim.progress + 2, 2) / 2;
  const clampedProgress = Math.max(0, Math.min(1, easedProgress));

  // Interpolate position
  const currentX = fromX + (toX - fromX) * clampedProgress;
  const currentY = fromY + (toY - fromY) * clampedProgress;

  // Update DOM element position
  if (anim.movingElement) {
    anim.movingElement.style.left = `${currentX}px`;
    anim.movingElement.style.top = `${currentY}px`;
  }

  // Continue animation loop
  animationFrameId = requestAnimationFrame(() => animateMovement(battle, onComplete));
}

// renderMovingUnit function removed - animation is now handled directly in animateMovement

/**
 * Stop movement animation and clean up
 */
function stopMovementAnimation(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (activeMovementAnim) {
    const unitId = activeMovementAnim.unitId;
    
    if (DEBUG_MOVEMENT) {
      console.log(`[MOVEMENT] Stopping animation for ${unitId}`);
    }
    
    // Remove moving unit element using stored reference
    if (activeMovementAnim.movingElement) {
      try {
        activeMovementAnim.movingElement.remove();
      } catch (e) {
        console.warn(`[MOVEMENT] Error removing moving element:`, e);
      }
      activeMovementAnim.movingElement = null;
    }
    
    // Also try to find and remove from animation container
    const animContainer = getOrCreateAnimationContainer();
    if (animContainer) {
      const movingUnit = animContainer.querySelector(`[data-unit-id="${unitId}"][data-animating="true"]`) as HTMLElement;
      if (movingUnit) {
        try {
          movingUnit.remove();
        } catch (e) {
          console.warn(`[MOVEMENT] Error removing from container:`, e);
        }
      }
    }

    // Show original unit again (will be re-rendered in final position)
    const gridContainer = document.querySelector('.battle-grid-container--simple') as HTMLElement;
    if (gridContainer) {
      const originalUnit = gridContainer.querySelector(`.battle-unit[data-unit-id="${unitId}"]:not(.battle-unit--moving)`) as HTMLElement;
      if (originalUnit) {
        originalUnit.style.opacity = '1';
        originalUnit.style.visibility = 'visible';
        originalUnit.style.pointerEvents = 'auto';
      }
    }

    // Clear animation state
    activeMovementAnim.active = false;
    activeMovementAnim = null;
  }

  // Remove debug overlay
  const debugEl = document.getElementById('movement-debug');
  if (debugEl) {
    debugEl.remove();
  }
}

function getUnitsArray(battle: BattleState): BattleUnitState[] {
  return Object.values(battle.units);
}

function resolveCard(cardId: string | Card): Card {
  if (typeof cardId !== "string") return cardId as Card;
  return getCardById(cardId) ?? fallbackGetCardById(cardId);
}

function resolveHandCards(hand: (string | Card)[]): Card[] {
  return hand.map(resolveCard);
}

function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

// ============================================================================
// CUSTOM playCard that uses our card database
// ============================================================================

function playCardFromScreen(
  state: BattleState,
  unitId: string,
  cardIndex: number,
  targetId: string
): BattleState {
  const unit = state.units[unitId];
  const target = state.units[targetId];

  if (!unit || !target) {
    return { ...state, log: [...state.log, "SLK//ERROR :: Invalid unit or target."] };
  }

  const cardIdOrObj = unit.hand[cardIndex];
  if (!cardIdOrObj) {
    return { ...state, log: [...state.log, "SLK//ERROR :: No card at index " + cardIndex] };
  }

  // Resolve card from our database
  const card = resolveCard(cardIdOrObj);

  // Create new hand without the played card
  const newHand = [...unit.hand];
  newHand.splice(cardIndex, 1);
  
  // Create new discard with the played card
  const newDiscard = [...unit.discardPile, cardIdOrObj];

  // Apply strain
  const newStrain = unit.strain + card.strainCost;

  // Start building the new unit
  let updatedUnit: BattleUnitState = {
    ...unit,
    hand: newHand,
    discardPile: newDiscard,
    strain: newStrain,
  };

  // Start building updated target
  let updatedTarget: BattleUnitState = targetId === unitId ? updatedUnit : { ...target };

  // Log the card play
  let newLog = [...state.log, `SLK//CARD :: ${unit.name} plays ${card.name} on ${target.name}.`];

  // Process damage
  if (card.damage !== undefined && card.damage > 0 && targetId !== unitId) {
    const finalDamage = Math.max(1, card.damage + unit.atk - target.def);
    const newHp = Math.max(0, target.hp - finalDamage);
    updatedTarget = { ...updatedTarget, hp: newHp };
    newLog.push(`SLK//DMG :: ${target.name} takes ${finalDamage} damage. (HP: ${newHp}/${target.maxHp})`);
    if (newHp <= 0) {
      newLog.push(`SLK//KILL :: ${target.name} has been eliminated!`);
    }
  } else if (card.damage === 0 && card.name.toLowerCase().includes("basic attack") && targetId !== unitId) {
    // Basic attack uses weapon damage (unit ATK)
    const finalDamage = Math.max(1, unit.atk - target.def);
    const newHp = Math.max(0, target.hp - finalDamage);
    updatedTarget = { ...updatedTarget, hp: newHp };
    newLog.push(`SLK//DMG :: ${target.name} takes ${finalDamage} damage. (HP: ${newHp}/${target.maxHp})`);
    if (newHp <= 0) {
      newLog.push(`SLK//KILL :: ${target.name} has been eliminated!`);
    }
  }

  // Process healing
  if (card.healing && card.healing > 0) {
    const oldHp = updatedTarget.hp;
    const newHp = Math.min(updatedTarget.maxHp, oldHp + card.healing);
    const actualHeal = newHp - oldHp;
    if (actualHeal > 0) {
      updatedTarget = { ...updatedTarget, hp: newHp };
      newLog.push(`SLK//HEAL :: ${target.name} restores ${actualHeal} HP. (HP: ${newHp}/${target.maxHp})`);
    }
  }

  // Process DEF buff
  if (card.defBuff && card.defBuff > 0) {
    const newBuffs = [...(updatedTarget.buffs || []), { stat: "def" as const, amount: card.defBuff, duration: 1 }];
    updatedTarget = { ...updatedTarget, buffs: newBuffs };
    newLog.push(`SLK//BUFF :: ${target.name} gains +${card.defBuff} DEF for 1 turn.`);
  }

  // Process ATK buff
  if (card.atkBuff && card.atkBuff > 0) {
    const newBuffs = [...(updatedTarget.buffs || []), { stat: "atk" as const, amount: card.atkBuff, duration: 1 }];
    updatedTarget = { ...updatedTarget, buffs: newBuffs };
    newLog.push(`SLK//BUFF :: ${target.name} gains +${card.atkBuff} ATK for 1 turn.`);
  }

  // Build new units Record
  const newUnits = { ...state.units };
  if (targetId === unitId) {
    newUnits[unitId] = updatedTarget;
  } else {
    newUnits[unitId] = updatedUnit;
    newUnits[targetId] = updatedTarget;
  }

  // Remove dead units from turn order
  let newTurnOrder = [...state.turnOrder];
  if (updatedTarget.hp <= 0 && targetId !== unitId) {
    newTurnOrder = newTurnOrder.filter(id => id !== targetId);
  }

  // Build new state
  let newState: BattleState = {
    ...state,
    units: newUnits,
    turnOrder: newTurnOrder,
    log: newLog,
  };

  // Check for battle outcome
  newState = evaluateBattleOutcome(newState);

  return newState;
}

// ============================================================================
// MAIN RENDER
// ============================================================================

export function renderBattleScreen() {
  const app = document.getElementById("app");
  if (!app) return;
  
  const state = getGameState();
  
  // CRITICAL: If animation is active, preserve the animation container
  // We'll restore it after rendering
  let preservedAnimationContainer: HTMLElement | null = null;
  let preservedGridContainer: HTMLElement | null = null;
  if (activeMovementAnim && activeMovementAnim.active && persistentAnimationContainer) {
    preservedAnimationContainer = persistentAnimationContainer;
    preservedGridContainer = preservedAnimationContainer.parentElement as HTMLElement;
    if (DEBUG_MOVEMENT) {
      console.log(`[RENDER] Preserving animation container during render for ${activeMovementAnim.unitId}`);
    }
  }
  
  // Initialize battle if needed
  if (!localBattleState) {
    const newBattle = createTestBattleForCurrentParty(state);
    if (!newBattle) {
      app.innerHTML = `<div class="battle-root"><div class="battle-card"><p>Error: No party members.</p><button id="backBtn">BACK</button></div></div>`;
      document.getElementById("backBtn")?.addEventListener("click", () => renderOperationMap());
      return;
    }
    localBattleState = newBattle;
    // Initialize turn state for first unit
    const firstUnit = newBattle.activeUnitId ? newBattle.units[newBattle.activeUnitId] : null;
    resetTurnStateForUnit(firstUnit);
  }
  
  const battle = localBattleState;
  const activeUnit = battle.activeUnitId ? battle.units[battle.activeUnitId] : undefined;
  const isPlayerTurn = activeUnit && !activeUnit.isEnemy;
  const isPlacementPhase = battle.phase === "placement";
  const roomLabel = isEndlessBattleMode 
    ? `ENDLESS MODE — BATTLE ${endlessBattleCount}` 
    : (state.operation?.currentRoomId ?? "ROOM_START");

  app.innerHTML = `
    <div class="battle-root">
      <!-- Battle grid as full-screen background -->
      <div class="battle-grid-background">
        ${renderBattleGrid(battle, selectedCardIndex, activeUnit, isPlacementPhase)}
      </div>
      
      <!-- Header overlay at top -->
      <div class="battle-header-overlay">
        <div class="battle-header-left">
          <div class="battle-title">${isEndlessBattleMode ? '∞ ' : ''}ENGAGEMENT – ${roomLabel}</div>
          <div class="battle-subtitle">${isPlacementPhase ? "PLACEMENT PHASE" : `TURN ${battle.turnCount}`} • GRID ${battle.gridWidth}×${battle.gridHeight}</div>
        </div>
        <div class="battle-header-right">
          ${!isPlacementPhase ? `
            <div class="battle-active-info">
              <div class="battle-active-label">ACTIVE UNIT</div>
              <div class="battle-active-value">${activeUnit?.name ?? "—"}</div>
            </div>
          ` : ""}
          <button class="battle-toggle-btn ${uiPanelsMinimized ? 'battle-toggle-btn--active' : ''}" id="toggleUiBtn">
            ${uiPanelsMinimized ? '👁 SHOW UI' : '👁 HIDE UI'}
          </button>
          <button class="battle-back-btn" id="exitBattleBtn">${isEndlessBattleMode ? 'EXIT ENDLESS' : 'EXIT BATTLE'}</button>
        </div>
      </div>
      
      <!-- Pan controls hint -->
      <div class="battle-pan-controls">
        <div class="battle-pan-hint">
          <span class="battle-pan-keys">WASD</span> or <span class="battle-pan-keys">↑←↓→</span> to pan
        </div>
        <button class="battle-pan-reset" id="resetBattlePanBtn">⟲ CENTER</button>
      </div>
      
      <!-- Console overlay -->
      <div class="scrollink-console-overlay">
        <div class="scrollink-console-header">SCROLLINK OS // ENGAGEMENT_FEED</div>
        <div class="scrollink-console-body" id="battleLog">${battle.log.slice(-8).map(l => `<div class="scrollink-console-line">${l}</div>`).join("")}</div>
      </div>
      
      ${isPlacementPhase ? renderPlacementUI(battle) : `
        <!-- Bottom UI panels overlay -->
        <div class="battle-bottom-overlay">
          <div class="battle-unit-panel">${renderUnitPanel(activeUnit)}</div>
          <div class="battle-weapon-panel">${renderWeaponWindow(activeUnit)}</div>
        </div>
        
        <!-- Floating hand overlay (independent of bottom panel) -->
        <div class="battle-hand-floating ${activeUnit && activeUnit.strain > BASE_STRAIN_THRESHOLD ? "battle-hand--strained" : ""}" id="battleHandContainer">
          ${renderHandPanel(activeUnit, isPlayerTurn)}
        </div>
      `}
      
      ${renderBattleResultOverlay(battle)}
    </div>
  `;
  
  // CRITICAL: Restore animation container if it was preserved
  if (preservedAnimationContainer && preservedGridContainer) {
    // Find the new grid container
    const newGridContainer = document.querySelector('.battle-grid-container--simple') as HTMLElement;
    if (newGridContainer) {
      // Check if container already exists in new DOM
      let existingContainer = newGridContainer.querySelector('.battle-animation-container') as HTMLElement;
      
      if (existingContainer) {
        // Move preserved children to existing container
        while (preservedAnimationContainer.firstChild) {
          existingContainer.appendChild(preservedAnimationContainer.firstChild);
        }
        persistentAnimationContainer = existingContainer;
        if (DEBUG_MOVEMENT) {
          console.log(`[RENDER] Merged animation container children into existing container`);
        }
      } else {
        // No existing container, append preserved one
        newGridContainer.appendChild(preservedAnimationContainer);
        persistentAnimationContainer = preservedAnimationContainer;
        if (DEBUG_MOVEMENT) {
          console.log(`[RENDER] Restored animation container after render`);
        }
      }
    } else {
      console.warn(`[RENDER] Could not find new grid container to restore animation container`);
    }
  } else {
    // Initialize animation container reference if it exists
    const gridContainer = document.querySelector('.battle-grid-container--simple') as HTMLElement;
    if (gridContainer) {
      const animContainer = gridContainer.querySelector('.battle-animation-container') as HTMLElement;
      if (animContainer) {
        persistentAnimationContainer = animContainer;
      }
    }
    
    // Clear reference if animation is not active and container is empty
    if (!activeMovementAnim || !activeMovementAnim.active) {
      const animContainer = getOrCreateAnimationContainer();
      if (animContainer && animContainer.children.length === 0) {
        // Container is empty, safe to clear reference
        // But keep it for next animation
      }
    }
  }
  
  // Setup pan handlers and attach event listeners
  setupBattlePanHandlers();
  // Use requestAnimationFrame to ensure DOM is fully ready, especially for victory overlay
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      attachBattleListeners();
      
      // Check for auto-battle (15a)
      if (localBattleState && activeUnit && !activeUnit.isEnemy && activeUnit.autoBattle) {
        // Delay auto-battle slightly to allow UI to update
        setTimeout(() => {
          if (!localBattleState) return;
          const currentActive = localBattleState.activeUnitId 
            ? localBattleState.units[localBattleState.activeUnitId] 
            : null;
          // Only trigger if this is still the active unit and it's still auto-battle
          if (currentActive && currentActive.id === activeUnit.id && currentActive.autoBattle && !currentActive.isEnemy) {
            const newState = performAutoBattleTurn(localBattleState, activeUnit.id);
            setBattleState(newState);
            // Only re-render if the battle is still active and it's still this unit's turn
            // This prevents infinite loops
            if (newState.phase === "battle" && newState.activeUnitId === activeUnit.id && newState.units[activeUnit.id]?.autoBattle) {
              // If it's still the same unit's turn after auto-battle, it means the turn didn't advance
              // This could happen if auto-battle couldn't take any action
              // In that case, manually advance the turn to prevent infinite loop
              if (newState.activeUnitId === activeUnit.id) {
                const advancedState = advanceTurn(newState);
                setBattleState(advancedState);
              }
            }
            renderBattleScreen();
          }
        }, 250);
      }
    });
  });
}

// ============================================================================
// RENDER HELPERS
// ============================================================================

/**
 * Render segmented strain ring SVG around portrait
 */
function renderStrainRing(currentStrain: number, maxStrain: number): string {
  const filled = Math.max(0, Math.min(currentStrain, maxStrain));
  const overflow = Math.max(0, currentStrain - maxStrain);
  
  // Determine tier based on overflow
  const tier = overflow <= 0 ? 0 : overflow === 1 ? 1 : overflow === 2 ? 2 : 3;
  
  // SVG parameters
  const centerX = 50;
  const centerY = 50;
  const radius = 45; // Ring radius - make it larger to be more visible
  const strokeWidth = 5; // Thicker stroke for visibility
  const gapAngle = 2; // Degrees gap between segments
  
  // Calculate segment angle
  const totalAngle = 360 - (gapAngle * maxStrain); // Total angle for all segments
  const segmentAngle = totalAngle / maxStrain; // Angle per segment
  
  // Build SVG path segments
  let segmentsHtml = '';
  for (let i = 0; i < maxStrain; i++) {
    const startAngle = (i * (segmentAngle + gapAngle)) - 90; // Start at top (-90 degrees)
    const endAngle = startAngle + segmentAngle;
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    
    const largeArc = segmentAngle > 180 ? 1 : 0;
    
    const isFilled = i < filled;
    const segmentClass = isFilled ? 'strain-seg is-filled' : 'strain-seg is-empty';
    
    segmentsHtml += `
      <path class="${segmentClass}" 
            d="M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}"
            stroke-width="${strokeWidth}"
            fill="none"
            stroke-linecap="round" />
    `;
  }
  
  // Overflow counter
  const overflowHtml = overflow > 0 
    ? `<div class="strain-ring__overflow">+${overflow}</div>`
    : '';
  
  return `
    <div class="strain-ring strain-tier-${tier}">
      <svg class="strain-ring__svg" viewBox="0 0 100 100" aria-hidden="true">
        ${segmentsHtml}
      </svg>
      ${overflowHtml}
    </div>
  `;
}

function renderUnitPanel(activeUnit: BattleUnitState | undefined): string {
  if (!activeUnit || activeUnit.isEnemy) {
    return `<div class="unit-panel-empty"><div class="unit-panel-empty-text">NO ACTIVE UNIT</div></div>`;
  }
  const hp = activeUnit.hp ?? 0;
  const maxHp = activeUnit.maxHp ?? 1;
  
  // Use maxStrain if available, otherwise fallback to BASE_STRAIN_THRESHOLD
  const maxStrain = (activeUnit as any).maxStrain ?? BASE_STRAIN_THRESHOLD;
  const currentStrain = activeUnit.strain ?? 0;
  
  const strainPct = Math.min(100, (currentStrain / maxStrain) * 100);
  const isOver = currentStrain > maxStrain;
  const maxMove = activeUnit.agi || 1;
  const movePct = (turnState.movementRemaining / maxMove) * 100;
  const portraitPath = getBattleUnitPortraitPath(activeUnit.id, activeUnit.baseUnitId);
  
  return `
    <div class="unit-panel-header">
      <div class="unit-panel-portrait">
        ${renderStrainRing(currentStrain, maxStrain)}
        <img src="${portraitPath}" alt="${activeUnit.name}" class="unit-panel-portrait-img" onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
      </div>
      <div class="unit-panel-header-text">
        <div class="unit-panel-label">ACTIVE UNIT</div>
        <div class="unit-panel-name">${activeUnit.name}</div>
        <button class="unit-auto-battle-toggle ${activeUnit.autoBattle ? 'unit-auto-battle-toggle--active' : ''}" id="toggleAutoBattleBtn" data-unit-id="${activeUnit.id}">
          AUTO: ${activeUnit.autoBattle ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
    <div class="unit-panel-stats">
      <div class="unit-stat-row">
        <span class="unit-stat-label">HP</span>
        <div class="unit-stat-bar">
          <div class="unit-stat-bar-track">
            <div class="unit-stat-bar-fill unit-stat-bar-fill--hp" style="width:${(hp/maxHp)*100}%"></div>
          </div>
          <span class="unit-stat-value">${hp}/${maxHp}</span>
        </div>
      </div>
      <div class="unit-stat-row unit-stat-row--strain">
        <span class="unit-stat-label unit-stat-label--strain">STRAIN</span>
        <div class="unit-stat-bar unit-stat-bar--strain">
          <div class="unit-stat-bar-track ${isOver ? "unit-stat-bar-track--danger" : ""}">
            <div class="unit-stat-bar-fill unit-stat-bar-fill--strain ${isOver ? "unit-stat-bar-fill--over" : ""}" style="width:${strainPct}%"></div>
          </div>
          <span class="unit-stat-value ${isOver ? "unit-stat-value--danger" : ""}">${currentStrain}/${maxStrain}</span>
        </div>
      </div>
      <div class="unit-stat-row">
        <span class="unit-stat-label">MOVE</span>
        <div class="unit-stat-bar">
          <div class="unit-stat-bar-track">
            <div class="unit-stat-bar-fill unit-stat-bar-fill--move" style="width:${movePct}%"></div>
          </div>
          <span class="unit-stat-value">${turnState.movementRemaining}/${maxMove}</span>
        </div>
      </div>
      <div class="unit-stat-row unit-stat-row--inline">
        <span class="unit-stat-chip">ATK ${activeUnit.atk}</span>
        <span class="unit-stat-chip">DEF ${activeUnit.def}</span>
        <span class="unit-stat-chip">AGI ${activeUnit.agi}</span>
        <span class="unit-stat-chip">ACC ${activeUnit.acc}</span>
      </div>
    </div>
  `;
}

function renderHandPanel(activeUnit: BattleUnitState | undefined, isPlayerTurn: boolean | undefined): string {
  const hand = resolveHandCards(activeUnit?.hand ?? []);
  return `
    <div class="hand-header-floating">
      <div class="hand-info">
        <span class="hand-label">HAND</span>
        <span class="hand-count">${hand.length} CARDS</span>
      </div>
      <div class="hand-meters">
        <div class="hand-counter">
          <span class="hand-counter-label">Deck:</span>
          <span class="hand-counter-value">${activeUnit?.drawPile?.length ?? 0}</span>
        </div>
        <div class="hand-counter">
          <span class="hand-counter-label">Discard:</span>
          <span class="hand-counter-value">${activeUnit?.discardPile?.length ?? 0}</span>
        </div>
      </div>
      <div class="hand-actions">
        <button class="battle-undo-btn" id="undoMoveBtn" ${!turnState.hasCommittedMove ? "disabled" : ""}>UNDO MOVE</button>
        <button class="battle-endturn-btn" id="endTurnBtn" ${!isPlayerTurn ? "disabled" : ""}>END TURN</button>
        <button class="battle-debug-autowin-btn" id="debugAutoWinBtn">DEBUG: AUTO WIN</button>
      </div>
    </div>
    <div class="hand-cards-row-floating">${renderHandCards(hand, isPlayerTurn)}</div>
  `;
}

function renderHandCards(hand: Card[], isPlayerTurn: boolean | undefined): string {
  if (hand.length === 0) return `<div class="hand-empty">No cards in hand</div>`;
  
  const total = hand.length;
  const maxAngle = Math.min(total * 4, 20);
  
  return hand.map((card, i) => {
    const sel = selectedCardIndex === i;
    const step = total > 1 ? maxAngle / (total - 1) : 0;
    const angle = total > 1 ? -maxAngle / 2 + step * i : 0;
    const yOff = Math.abs(angle) * 0.5;
    const icon = card.type === "core" ? "◆" : card.type === "class" ? "★" : card.type === "gambit" ? "⚡" : "⚔";
    
    return `
      <div class="battle-card-slot" style="--fan-rotate:${angle}deg;--fan-translateY:${yOff}px;z-index:${i+1};" data-card-index="${i}">
        <div class="battle-cardui ${sel ? "battle-cardui--selected" : ""} ${!isPlayerTurn ? "battle-cardui--disabled" : ""}" data-card-index="${i}">
          <div class="card-top-row">
            <span class="card-icon">${icon}</span>
            <span class="card-cost">STR ${card.strainCost}</span>
          </div>
          <div class="card-name">${card.name}</div>
          <div class="card-tag">${card.target.toUpperCase()}${card.range > 0 ? ` R${card.range}` : ""}</div>
          <div class="card-desc">${card.description}</div>
        </div>
      </div>
    `;
  }).join("");
}

// Calculate all reachable tiles using BFS flood fill
function getReachableTiles(
  startX: number,
  startY: number,
  movement: number,
  gridWidth: number,
  gridHeight: number,
  units: BattleUnitState[]
): Set<string> {
  const reachable = new Set<string>();
  const visited = new Map<string, number>(); // tile -> cost to reach
  const queue: { x: number; y: number; cost: number }[] = [{ x: startX, y: startY, cost: 0 }];
  visited.set(`${startX},${startY}`, 0);
  
  const dirs = [{x:0,y:-1}, {x:0,y:1}, {x:-1,y:0}, {x:1,y:0}];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    for (const d of dirs) {
      const nx = current.x + d.x;
      const ny = current.y + d.y;
      const newCost = current.cost + 1;
      const key = `${nx},${ny}`;
      
      // Check bounds
      if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) continue;
      
      // Check if we can reach it with remaining movement
      if (newCost > movement) continue;
      
      // Check if already visited with lower cost
      if (visited.has(key) && visited.get(key)! <= newCost) continue;
      
      // Check if occupied by a unit
      const occupied = units.some(u => u.pos?.x === nx && u.pos?.y === ny && u.hp > 0);
      if (occupied) continue;
      
      // Valid tile to move to
      visited.set(key, newCost);
      reachable.add(key);
      queue.push({ x: nx, y: ny, cost: newCost });
    }
  }
  
  return reachable;
}

function renderPlacementUI(battle: BattleState): string {
  const placementState = battle.placementState;
  if (!placementState) return "";
  
  const friendlyUnits = Object.values(battle.units).filter(u => !u.isEnemy);
  const unplacedUnits = friendlyUnits.filter(
    u => !placementState.placedUnitIds.includes(u.id) && !u.pos
  );
  const placedCount = placementState.placedUnitIds.length;
  const canConfirm = placedCount > 0 && (placedCount >= placementState.maxUnitsPerSide || unplacedUnits.length === 0);
  
  return `
    <div class="battle-placement-overlay">
      <div class="battle-placement-panel">
        <div class="placement-header">
          <div class="placement-title">UNIT PLACEMENT</div>
          <div class="placement-subtitle">Place units on the left edge (x=0)</div>
        </div>
        <div class="placement-info">
          <div class="placement-stats">
            <span>Placed: ${placedCount}/${placementState.maxUnitsPerSide}</span>
            <span>Unplaced: ${unplacedUnits.length}</span>
          </div>
          <div class="placement-units-list">
            <div class="placement-units-label">Party Units (click to select, then place on grid):</div>
            ${friendlyUnits.map(u => {
              const isPlaced = placementState.placedUnitIds.includes(u.id);
              const isSelected = placementState.selectedUnitId === u.id;
              return `
                <div class="placement-unit-item ${isPlaced ? 'placement-unit-item--placed' : ''} ${isSelected ? 'placement-unit-item--selected' : ''}" 
                     data-unit-id="${u.id}" 
                     data-placed="${isPlaced}">
                  <span>${u.name}</span>
                  ${isPlaced ? '<span class="placement-status">✓ PLACED</span>' : '<span class="placement-status">AVAILABLE</span>'}
                  ${isSelected ? '<span class="placement-selected-indicator">→ SELECTED</span>' : ''}
                </div>
              `;
            }).join("")}
          </div>
        </div>
        <div class="placement-actions">
          <button class="battle-quick-place-btn" id="quickPlaceBtn">QUICK PLACE</button>
          <button class="battle-confirm-btn ${canConfirm ? '' : 'battle-confirm-btn--disabled'}" id="confirmPlacementBtn" ${!canConfirm ? 'disabled' : ''}>CONFIRM</button>
        </div>
      </div>
    </div>
  `;
}

function renderBattleGrid(battle: BattleState, selectedCardIdx: number | null, activeUnit: BattleUnitState | undefined, isPlacementPhase: boolean = false): string {
  const { gridWidth, gridHeight } = battle;
  const units = getUnitsArray(battle);
  
  // Calculate move/attack tiles if needed
  const moveOpts = new Set<string>();
  const atkOpts = new Set<string>();
  
  if (activeUnit && !activeUnit.isEnemy && activeUnit.pos && !isPlacementPhase) {
    const ux = activeUnit.pos.x;
    const uy = activeUnit.pos.y;
    
    let selectedCard: Card | null = null;
    if (selectedCardIdx !== null && activeUnit.hand[selectedCardIdx]) {
      selectedCard = resolveCard(activeUnit.hand[selectedCardIdx]);
    }
    
    if (selectedCard) {
      const cardRange = selectedCard.range;
      
      if (selectedCard.target === "enemy") {
        units.filter(u => u.isEnemy && u.hp > 0 && u.pos).forEach(e => {
          const dist = getDistance(ux, uy, e.pos!.x, e.pos!.y);
          if (dist <= cardRange) {
            atkOpts.add(`${e.pos!.x},${e.pos!.y}`);
          }
        });
      } else if (selectedCard.target === "ally") {
        units.filter(u => !u.isEnemy && u.hp > 0 && u.pos).forEach(a => {
          const dist = getDistance(ux, uy, a.pos!.x, a.pos!.y);
          if (dist <= cardRange || cardRange === 0) {
            atkOpts.add(`${a.pos!.x},${a.pos!.y}`);
          }
        });
      } else if (selectedCard.target === "self") {
        atkOpts.add(`${ux},${uy}`);
      }
    } else if (!turnState.hasCommittedMove && turnState.movementRemaining > 0) {
      const originX = turnState.originalPosition?.x ?? ux;
      const originY = turnState.originalPosition?.y ?? uy;
      const maxMove = activeUnit.agi;
      const reachable = getReachableTiles(originX, originY, maxMove, gridWidth, gridHeight, units);
      reachable.forEach(key => moveOpts.add(key));
    }
  }
  
  // Calculate facing selection tiles if in facing selection phase
  const facingTiles = new Set<string>();
  if (turnState.isFacingSelection && activeUnit && activeUnit.pos) {
    const { x, y } = activeUnit.pos;
    // Add adjacent tiles for facing selection
    if (x > 0) facingTiles.add(`${x - 1},${y}`); // west
    if (x < battle.gridWidth - 1) facingTiles.add(`${x + 1},${y}`); // east
    if (y > 0) facingTiles.add(`${x},${y - 1}`); // north
    if (y < battle.gridHeight - 1) facingTiles.add(`${x},${y + 1}`); // south
  }
  
  // Use the new simple renderer - it uses unit.pos as single source of truth
  return BattleGridRenderer.render(battle, selectedCardIdx, activeUnit, isPlacementPhase, battleZoom, moveOpts, atkOpts, facingTiles);
}

function renderBattleResultOverlay(battle: BattleState): string {
  if (battle.phase === "victory") {
    const r = battle.rewards ?? { wad: 0, metalScrap: 0, wood: 0, chaosShards: 0, steamComponents: 0 };
    return `
      <div class="battle-result-overlay">
        <div class="battle-result-card">
          <div class="battle-result-title">VICTORY</div>
          <div class="battle-reward-grid">
            <div class="battle-reward-item"><div class="reward-label">WAD</div><div class="reward-value">+${r.wad}</div></div>
            <div class="battle-reward-item"><div class="reward-label">METAL SCRAP</div><div class="reward-value">+${r.metalScrap}</div></div>
            <div class="battle-reward-item"><div class="reward-label">WOOD</div><div class="reward-value">+${r.wood}</div></div>
            <div class="battle-reward-item"><div class="reward-label">CHAOS SHARDS</div><div class="reward-value">+${r.chaosShards}</div></div>
            <div class="battle-reward-item"><div class="reward-label">STEAM COMP</div><div class="reward-value">+${r.steamComponents}</div></div>
          </div>
          <div class="battle-result-footer">
            <button class="battle-result-btn" id="claimRewardsBtn">CLAIM & CONTINUE</button>
          </div>
        </div>
      </div>
    `;
  }
  
  if (battle.phase === "defeat") {
    // Check if in campaign run (for retry option)
    const isCampaignRun = (window as any).__isCampaignRun || false;
    
    return `
      <div class="battle-result-overlay battle-result-overlay--defeat">
        <div class="battle-result-card">
          <div class="battle-result-title">DEFEAT</div>
          <div class="battle-defeat-text">Your squad has been wiped out.</div>
          <div class="battle-result-footer">
            ${isCampaignRun ? `
              <button class="battle-result-btn battle-result-btn--primary" id="retryRoomBtn">RETRY ROOM</button>
              <button class="battle-result-btn" id="abandonRunBtn">ABANDON RUN</button>
            ` : `
              <button class="battle-result-btn" id="defeatReturnBtn">RETURN TO BASE</button>
            `}
          </div>
        </div>
      </div>
    `;
  }
  
  return "";
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Animation state for hand draw/discard
let isHandAnimating = false;

function animateHandDraw(container: HTMLElement, onComplete: () => void) {
  if (isHandAnimating) {
    onComplete();
    return;
  }
  
  isHandAnimating = true;
  const cards = container.querySelectorAll(".battle-card-slot");
  
  // Set initial state (invisible, below)
  cards.forEach((card, i) => {
    const el = card as HTMLElement;
    el.style.opacity = "0";
    el.style.transform = "translateY(50px)";
    el.style.transition = "none";
  });
  
  // Force reflow
  void container.offsetHeight;
  
  // Animate each card in with stagger
  cards.forEach((card, i) => {
    const el = card as HTMLElement;
    setTimeout(() => {
      el.style.transition = "opacity 0.3s ease-out, transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)";
      el.style.opacity = "1";
      el.style.transform = "";
    }, i * 50);
  });
  
  // Complete after all animations
  setTimeout(() => {
    isHandAnimating = false;
    onComplete();
  }, cards.length * 50 + 300);
}

function animateHandDiscard(container: HTMLElement, onComplete: () => void) {
  if (isHandAnimating) {
    onComplete();
    return;
  }
  
  isHandAnimating = true;
  const cards = container.querySelectorAll(".battle-card-slot");
  
  // Animate cards out
  cards.forEach((card, i) => {
    const el = card as HTMLElement;
    setTimeout(() => {
      el.style.transition = "opacity 0.3s ease-out, transform 0.3s ease-out";
      el.style.opacity = "0";
      el.style.transform = "translateY(50px) scale(0.8)";
    }, i * 30);
  });
  
  // Complete after animations
  setTimeout(() => {
    isHandAnimating = false;
    onComplete();
  }, cards.length * 30 + 300);
}

function attachBattleListeners() {
  if (!localBattleState) return;
  
  const battle = localBattleState;
  const activeUnit = battle.activeUnitId ? battle.units[battle.activeUnitId] : undefined;
  const isPlayerTurn = activeUnit && !activeUnit.isEnemy;
  const units = getUnitsArray(battle);
  const isPlacementPhase = battle.phase === "placement";

  // Zoom controls
  const zoomInBtn = document.getElementById("battleZoomInBtn");
  const zoomOutBtn = document.getElementById("battleZoomOutBtn");
  const zoomViewport = document.querySelector(".battle-grid-zoom-viewport");
  if (zoomInBtn) {
    zoomInBtn.onclick = (e) => { e.stopPropagation(); zoomIn(); };
  }
  if (zoomOutBtn) {
    zoomOutBtn.onclick = (e) => { e.stopPropagation(); zoomOut(); };
  }
  if (zoomViewport) {
    zoomViewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    }, { passive: false });
  }

  // Exit battle button
  const exitBtn = document.getElementById("exitBattleBtn");
  if (exitBtn) {
    exitBtn.onclick = () => {
      cleanupBattlePanHandlers();
      localBattleState = null;
      selectedCardIndex = null;
      resetTurnStateForUnit(null);
      uiPanelsMinimized = false; // Reset UI visibility
      
      // If in endless mode, exit to base camp with summary
      if (isEndlessBattleMode) {
        console.log(`[ENDLESS BATTLE] Exiting after ${endlessBattleCount} battles`);
        const finalCount = endlessBattleCount;
        isEndlessBattleMode = false;
        endlessBattleCount = 0;
        
        // Show summary and return to base camp
        alert(`Endless Battle Mode Exited!\nBattles Completed: ${finalCount - 1}`);
        import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
          renderFieldScreen("base_camp");
        });
      } else {
        renderOperationMap();
      }
    };
  }
  
  // Toggle UI panels button
  const toggleUiBtn = document.getElementById("toggleUiBtn");
  if (toggleUiBtn) {
    toggleUiBtn.onclick = () => {
      toggleUiPanels();
    };
  }
  
  // Reset pan button
  const resetPanBtn = document.getElementById("resetBattlePanBtn");
  if (resetPanBtn) {
    resetPanBtn.onclick = () => {
      resetBattlePan();
    };
  }


  // Card selection
  document.querySelectorAll(".battle-cardui").forEach(el => {
    (el as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      if (!isPlayerTurn) return;
      const i = parseInt((el as HTMLElement).dataset.cardIndex ?? "-1");
      if (i >= 0) {
        selectedCardIndex = selectedCardIndex === i ? null : i;
        renderBattleScreen();
      }
    };
  });

  // Placement phase handlers
  if (isPlacementPhase) {
    console.log("[BATTLE] Setting up placement phase handlers");
    
    // Quick Place button
    const quickPlaceBtn = document.getElementById("quickPlaceBtn");
    if (quickPlaceBtn) {
      console.log("[BATTLE] Quick Place button found, attaching handler");
      quickPlaceBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log("[BATTLE] Quick Place button clicked");
        if (!localBattleState) return;
        let newState = quickPlaceUnits(localBattleState);
        setBattleState(newState);
        renderBattleScreen();
      });
    } else {
      console.warn("[BATTLE] Quick Place button NOT found");
    }
    
    // Confirm button
    const confirmBtn = document.getElementById("confirmPlacementBtn");
    if (confirmBtn) {
      console.log("[BATTLE] Confirm button found, attaching handler");
      confirmBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log("[BATTLE] Confirm button clicked");
        if (!localBattleState) return;
        let newState = confirmPlacement(localBattleState);
        setBattleState(newState);
        // Reset turn state for first active unit
        if (newState.activeUnitId) {
          const firstUnit = newState.units[newState.activeUnitId];
          resetTurnStateForUnit(firstUnit);
        }
        renderBattleScreen();
        
        // Trigger hand draw animation for first unit
        requestAnimationFrame(() => {
          const handContainer = document.getElementById("battleHandContainer");
          if (handContainer && newState.activeUnitId) {
            const unit = newState.units[newState.activeUnitId];
            if (unit && !unit.isEnemy) {
              animateHandDraw(handContainer, () => {});
            }
          }
        });
      });
    } else {
      console.warn("[BATTLE] Confirm button NOT found");
    }
    
    // Simple placement click handler using data attributes
    const gridContainer = document.getElementById("battleGridContainer") || 
                          document.querySelector(".battle-grid-container--simple");
    if (gridContainer) {
      // Remove old handler
      const oldHandler = (gridContainer as any).__placementHandler;
      if (oldHandler) {
        gridContainer.removeEventListener("click", oldHandler);
      }
      
      // Create new handler
      const placementHandler = (e: MouseEvent) => {
        // Check if clicking on a placed unit (to remove it) - prioritize unit clicks
        const placedUnitEl = (e.target as HTMLElement).closest(".battle-unit[data-unit-id]") as HTMLElement;
        if (placedUnitEl && localBattleState && localBattleState.placementState) {
          const unitId = placedUnitEl.getAttribute("data-unit-id");
          if (unitId) {
            const unit = localBattleState.units[unitId];
            if (unit && !unit.isEnemy && localBattleState.placementState.placedUnitIds.includes(unitId)) {
              // Remove placed unit
              e.preventDefault();
              e.stopPropagation();
              let newState = removePlacedUnit(localBattleState, unitId);
              setBattleState(newState);
              renderBattleScreen();
              return;
            }
          }
        }
        
        // Otherwise, try to place selected unit
        const tile = (e.target as HTMLElement).closest(".battle-tile--placement-option") as HTMLElement;
        if (!tile) return;
        
        const coords = BattleGridRenderer.getTileCoordinates(tile);
        if (!coords) return;
        
        const { x, y } = coords;
        
        if (!localBattleState || !localBattleState.placementState) return;
        if (x !== 0) return;
        if (y < 0 || y >= localBattleState.gridHeight) return;
        
        const occupied = Object.values(localBattleState.units).some(
          u => u.pos && u.pos.x === x && u.pos.y === y && u.hp > 0
        );
        if (occupied) return;
        
        // Use selected unit if available, otherwise use first unplaced
        const selectedUnitId = localBattleState.placementState.selectedUnitId;
        let unitToPlace = null;
        
        if (selectedUnitId) {
          const selectedUnit = localBattleState.units[selectedUnitId];
          if (selectedUnit && !selectedUnit.isEnemy && 
              !localBattleState.placementState.placedUnitIds.includes(selectedUnitId)) {
            unitToPlace = selectedUnit;
          }
        }
        
        if (!unitToPlace) {
          const friendlyUnits = Object.values(localBattleState.units).filter(u => !u.isEnemy);
          unitToPlace = friendlyUnits.find(
            u => !localBattleState.placementState!.placedUnitIds.includes(u.id) && !u.pos
          );
        }
        
        if (!unitToPlace) return;
        
        let newState = placeUnit(localBattleState, unitToPlace.id, { x, y });
        setBattleState(newState);
        renderBattleScreen();
      };
      
      // Add click handler for unit selection in placement panel
      const placementPanel = document.querySelector(".battle-placement-panel");
      if (placementPanel) {
        // Remove old handler if exists
        const oldPanelHandler = (placementPanel as any).__placementPanelHandler;
        if (oldPanelHandler) {
          placementPanel.removeEventListener("click", oldPanelHandler);
        }
        
        const placementPanelHandler = (e: MouseEvent) => {
          const unitItem = (e.target as HTMLElement).closest(".placement-unit-item") as HTMLElement;
          if (unitItem && localBattleState && localBattleState.placementState) {
            e.preventDefault();
            e.stopPropagation();
            
            const unitId = unitItem.getAttribute("data-unit-id");
            const isPlaced = unitItem.getAttribute("data-placed") === "true";
            
            if (unitId) {
              if (isPlaced) {
                // Clicking a placed unit removes it
                let newState = removePlacedUnit(localBattleState, unitId);
                setBattleState(newState);
                renderBattleScreen();
              } else {
                // Clicking an unplaced unit selects it for placement
                let newState = setPlacementSelectedUnit(localBattleState, unitId);
                setBattleState(newState);
                renderBattleScreen();
              }
            }
          }
        };
        
        (placementPanel as any).__placementPanelHandler = placementPanelHandler;
        placementPanel.addEventListener("click", placementPanelHandler);
      }
      
      (gridContainer as any).__placementHandler = placementHandler;
      gridContainer.addEventListener("click", placementHandler);
    }
    
    // Don't attach normal battle listeners during placement
    return;
  }

  // Simple click handler for movement and attacks using data attributes
  const gridContainer = document.getElementById("battleGridContainer") || 
                        document.querySelector(".battle-grid-container--simple");
  if (gridContainer && !isPlacementPhase) {
    // Remove old handler
    const oldHandler = (gridContainer as any).__battleHandler;
    if (oldHandler) {
      gridContainer.removeEventListener("click", oldHandler);
    }
    
    // Create new handler
    const battleHandler = (e: MouseEvent) => {
      const tile = (e.target as HTMLElement).closest(".battle-tile") as HTMLElement;
      if (!tile) return;
      
      const coords = BattleGridRenderer.getTileCoordinates(tile);
      if (!coords) return;
      
      const { x, y } = coords;
      
      if (!isPlayerTurn || !activeUnit || !localBattleState) return;
      
      // Handle facing selection (FFTA-style, after movement)
      if (turnState.isFacingSelection && tile.classList.contains("battle-tile--facing-option")) {
        if (!activeUnit.pos) return;
        
        // Determine facing based on clicked tile position relative to unit
        const dx = x - activeUnit.pos.x;
        const dy = y - activeUnit.pos.y;
        let newFacing: "north" | "south" | "east" | "west";
        
        if (Math.abs(dx) >= Math.abs(dy)) {
          newFacing = dx > 0 ? "east" : "west";
        } else {
          newFacing = dy > 0 ? "south" : "north";
        }
        
        // Update facing and exit facing selection phase
        const newUnits = { ...localBattleState.units };
        newUnits[activeUnit.id] = { ...newUnits[activeUnit.id], facing: newFacing };
        const newState = { ...localBattleState, units: newUnits };
        setBattleState(newState);
        turnState.isFacingSelection = false;
        renderBattleScreen();
        return;
      }
      
      // Handle movement
      if (tile.classList.contains("battle-tile--move-option")) {
        if (!isPlayerTurn || !activeUnit || !localBattleState) return;
        if (activeMovementAnim && activeMovementAnim.active) return;
        
        if (!turnState.hasMoved && activeUnit.pos) {
          turnState.originalPosition = { x: activeUnit.pos.x, y: activeUnit.pos.y };
        }
        
        const originX = turnState.originalPosition?.x ?? activeUnit.pos?.x ?? 0;
        const originY = turnState.originalPosition?.y ?? activeUnit.pos?.y ?? 0;
        const currentX = activeUnit.pos?.x ?? 0;
        const currentY = activeUnit.pos?.y ?? 0;
        const maxMove = activeUnit.agi;
        
        // Validate destination is within bounds
        if (x < 0 || x >= localBattleState.gridWidth || 
            y < 0 || y >= localBattleState.gridHeight) {
          console.error("[MOVE] Destination out of bounds!", { x, y, bounds: { width: localBattleState.gridWidth, height: localBattleState.gridHeight } });
          return;
        }
        
        // Validate current position
        if (currentX < 0 || currentX >= localBattleState.gridWidth ||
            currentY < 0 || currentY >= localBattleState.gridHeight) {
          console.error("[MOVE] Current position out of bounds!", { currentX, currentY, bounds: { width: localBattleState.gridWidth, height: localBattleState.gridHeight } });
          return;
        }
        
        const path = getMovePath(localBattleState, { x: currentX, y: currentY }, { x, y }, maxMove);
        
        if (path.length < 2) {
          console.warn("[MOVE] No valid path found", { from: { x: currentX, y: currentY }, to: { x, y } });
          return;
        }
        
        // CRITICAL: Validate path ends at destination
        const pathEnd = path[path.length - 1];
        if (pathEnd.x !== x || pathEnd.y !== y) {
          console.error("[MOVE] Path does not end at destination!", {
            expected: { x, y },
            actual: pathEnd,
            path
          });
          return;
        }
        
        const totalCost = getDistance(originX, originY, x, y);
        if (totalCost > activeUnit.agi) {
          console.warn("[MOVE] Path cost exceeds movement range", { totalCost, agi: activeUnit.agi });
          return;
        }
        
        turnState.movementRemaining = activeUnit.agi - totalCost;
        turnState.hasMoved = true;
        turnState.hasCommittedMove = true;
        
        const finalStep = path[path.length - 1];
        const prevStep = path[path.length - 2];
        const dx = finalStep.x - prevStep.x;
        const dy = finalStep.y - prevStep.y;
        
        let newFacing: "north" | "south" | "east" | "west" = activeUnit.facing ?? "east";
        if (Math.abs(dx) >= Math.abs(dy)) {
          newFacing = dx > 0 ? "east" : "west";
        } else {
          newFacing = dy > 0 ? "south" : "north";
        }
        
        // CRITICAL: Capture current state in closure to avoid stale state
        const currentState = localBattleState;
        const finalPos = path[path.length - 1];
        
        // Validate final position
        if (finalPos.x < 0 || finalPos.x >= currentState.gridWidth || 
            finalPos.y < 0 || finalPos.y >= currentState.gridHeight) {
          console.error("[MOVE] Invalid final position!", finalPos);
          return;
        }
        
        // CRITICAL: Prevent re-rendering during animation
        // Store a flag to prevent renderBattleScreen from breaking animation
        const wasAnimating = activeMovementAnim?.active || false;
        
        startMovementAnimation(activeUnit.id, path, currentState, () => {
          // Animation complete - now update state and re-render
          // Get fresh state (might have changed during animation)
          const stateAtCompletion = localBattleState || currentState;
          
          // Move unit to final position
          let newState = moveUnit(stateAtCompletion, activeUnit.id, finalPos);
          
          // Validate the move succeeded
          const movedUnit = newState.units[activeUnit.id];
          if (!movedUnit || !movedUnit.pos || 
              movedUnit.pos.x !== finalPos.x || movedUnit.pos.y !== finalPos.y) {
            console.error("[MOVE] Position mismatch after move!", {
              expected: finalPos,
              actual: movedUnit?.pos,
              unitId: activeUnit.id
            });
            // Try to fix it
            const fixedUnits = { ...newState.units };
            fixedUnits[activeUnit.id] = {
              ...fixedUnits[activeUnit.id],
              pos: { ...finalPos }
            };
            newState = { ...newState, units: fixedUnits };
          }
          
          // Set default facing based on movement direction, but enter facing selection phase
          const newUnits = { ...newState.units };
          newUnits[activeUnit.id] = { ...newUnits[activeUnit.id], facing: newFacing };
          newState = { ...newState, units: newUnits };
          
          // Validate final state
          const finalUnit = newState.units[activeUnit.id];
          if (finalUnit.pos && (finalUnit.pos.x !== finalPos.x || finalUnit.pos.y !== finalPos.y)) {
            console.error("[MOVE] Final validation failed!", {
              expected: finalPos,
              actual: finalUnit.pos
            });
          }
          
          // Enter facing selection phase (FFTA-style)
          turnState.isFacingSelection = true;
          const facingLog = [...newState.log, `SLK//FACING :: Select facing direction for ${activeUnit.name} (Arrow keys or click adjacent tile).`];
          newState = { ...newState, log: facingLog };
          
          // Update state and re-render AFTER animation completes
          setBattleState(newState);
          // Ensure animation is fully stopped before re-rendering
          // Use setTimeout to give the browser a chance to complete cleanup
          setTimeout(() => {
            // Double-check animation is stopped
            if (!activeMovementAnim || !activeMovementAnim.active) {
              renderBattleScreen();
            } else {
              // If animation is still active, wait a bit more
              setTimeout(() => renderBattleScreen(), 50);
            }
          }, 10);
        });
        return;
      }
      
      // Handle attack
      if (tile.classList.contains("battle-tile--attack-option") && selectedCardIndex !== null) {
        if (!isPlayerTurn || !activeUnit || !localBattleState) return;
        
        const units = getUnitsArray(localBattleState);
        const cardIdOrObj = activeUnit.hand[selectedCardIndex];
        const card = resolveCard(cardIdOrObj);
        const tgt = units.find(u => u.pos?.x === x && u.pos?.y === y && u.hp > 0);
        const ux = activeUnit.pos?.x ?? 0;
        const uy = activeUnit.pos?.y ?? 0;
        const dist = getDistance(ux, uy, x, y);
        
        let shouldPlay = false;
        let targetUnitId = "";
        
        if (card.target === "enemy" && tgt?.isEnemy && dist <= card.range) {
          shouldPlay = true;
          targetUnitId = tgt.id;
        } else if (card.target === "ally" && tgt && !tgt.isEnemy && (dist <= card.range || card.range === 0)) {
          shouldPlay = true;
          targetUnitId = tgt.id;
        } else if (card.target === "self" && x === ux && y === uy) {
          shouldPlay = true;
          targetUnitId = activeUnit.id;
        }
        
        if (shouldPlay) {
          const targetUnit = units.find(u => u.id === targetUnitId);
          let newFacing = activeUnit.facing ?? "east";
          
          if (targetUnit && targetUnit.pos && activeUnit.pos && targetUnitId !== activeUnit.id) {
            const dx = targetUnit.pos.x - activeUnit.pos.x;
            const dy = targetUnit.pos.y - activeUnit.pos.y;
            if (Math.abs(dx) >= Math.abs(dy)) {
              newFacing = dx > 0 ? "east" : "west";
            } else {
              newFacing = dy > 0 ? "south" : "north";
            }
          }
          
          let stateWithFacing = localBattleState;
          if (newFacing !== activeUnit.facing) {
            const newUnits = { ...localBattleState.units };
            newUnits[activeUnit.id] = { ...newUnits[activeUnit.id], facing: newFacing };
            stateWithFacing = { ...localBattleState, units: newUnits };
          }
          
          let newState = playCardFromScreen(stateWithFacing, activeUnit.id, selectedCardIndex, targetUnitId);
          selectedCardIndex = null;
          newState = evaluateBattleOutcome(newState);
          setBattleState(newState);
          renderBattleScreen();
        }
      }
    };
    
    (gridContainer as any).__battleHandler = battleHandler;
    gridContainer.addEventListener("click", battleHandler);
  }
  
  // OLD TILE CLICK HANDLER - REMOVED (replaced by new grid click handler system above)

  // Undo move button
  const undoBtn = document.getElementById("undoMoveBtn");
  if (undoBtn) {
    undoBtn.onclick = () => {
      if (turnState.hasCommittedMove && turnState.originalPosition && activeUnit && localBattleState) {
        const newUnits = { ...localBattleState.units };
        newUnits[activeUnit.id] = {
          ...newUnits[activeUnit.id],
          pos: { ...turnState.originalPosition }
        };
        const newLog = [...localBattleState.log, `SLK//UNDO :: ${activeUnit.name} returns to original position.`];
        setBattleState({
          ...localBattleState,
          units: newUnits,
          log: newLog
        });
        
        // Reset movement tracking - this shows green tiles again
        turnState.movementRemaining = activeUnit.agi;
        turnState.hasMoved = false;
        turnState.hasCommittedMove = false;
        turnState.originalPosition = null;
        
        renderBattleScreen();
      }
    };
  }

  // End turn button
  // Auto-battle toggle (15a)
  const toggleAutoBattleBtn = document.getElementById("toggleAutoBattleBtn");
  if (toggleAutoBattleBtn) {
    toggleAutoBattleBtn.onclick = () => {
      if (!localBattleState || !activeUnit) return;
      const unitId = toggleAutoBattleBtn.getAttribute("data-unit-id");
      if (!unitId) return;
      
      const unit = localBattleState.units[unitId];
      if (!unit) return;
      
      const newAutoBattle = !unit.autoBattle;
      const newUnits = { ...localBattleState.units };
      newUnits[unitId] = { ...unit, autoBattle: newAutoBattle };
      
      setBattleState({
        ...localBattleState,
        units: newUnits,
      });
      
      renderBattleScreen();
    };
  }

  const endTurnBtn = document.getElementById("endTurnBtn");
  if (endTurnBtn) {
    endTurnBtn.onclick = () => {
      if (!isPlayerTurn || !localBattleState) return;
      
      // Animate hand discard first
      const handContainer = document.getElementById("battleHandContainer");
      if (handContainer) {
        animateHandDiscard(handContainer, () => {
          // After discard animation, advance turn
          let newState = advanceTurn(localBattleState);
          selectedCardIndex = null;
          
          // Trigger hand draw animation for next unit
          requestAnimationFrame(() => {
            const nextHandContainer = document.getElementById("battleHandContainer");
            if (nextHandContainer && newState.activeUnitId) {
              const nextUnit = newState.units[newState.activeUnitId];
              if (nextUnit && !nextUnit.isEnemy) {
                animateHandDraw(nextHandContainer, () => {});
              }
            }
          });
          
          // Run enemy turns with animation
          runEnemyTurnsAnimated(newState);
        });
      } else {
        // Fallback if container not found
        let newState = advanceTurn(localBattleState);
        selectedCardIndex = null;
        runEnemyTurnsAnimated(newState);
      }
    };
  }

  // Debug auto-win button
  const autoWinBtn = document.getElementById("debugAutoWinBtn");
  if (autoWinBtn) {
    autoWinBtn.onclick = () => {
      if (!localBattleState) return;
      const newUnits = { ...localBattleState.units };
      
      // Kill all enemies
      Object.keys(newUnits).forEach(id => {
        if (newUnits[id].isEnemy) {
          newUnits[id] = { ...newUnits[id], hp: 0 };
        }
      });
      
      // Remove dead enemies from turn order
      const newTurnOrder = localBattleState.turnOrder.filter(id => {
        const unit = newUnits[id];
        return unit && (!unit.isEnemy || unit.hp > 0);
      });
      
      const newLog = [...localBattleState.log, "SLK//DEBUG :: Auto-win triggered."];
      let newState: BattleState = { 
        ...localBattleState, 
        units: newUnits, 
        turnOrder: newTurnOrder,
        log: newLog 
      };
      
      // Force evaluate outcome
      newState = evaluateBattleOutcome(newState);
      
      // If still not victory, force it
      if (newState.phase !== "victory") {
        newState = {
          ...newState,
          phase: "victory",
          rewards: {
            wad: 50,
            metalScrap: 10,
            wood: 5,
            chaosShards: 2,
            steamComponents: 2
          }
        };
      }
      
      setBattleState(newState);
      renderBattleScreen();
      
      // Auto-advance: automatically claim rewards and advance to next encounter
      // Wait a frame for the victory screen to render, then auto-click claim button
      setTimeout(() => {
        const claimBtn = document.getElementById("claimRewardsBtn");
        if (claimBtn) {
          console.log("[BATTLE DEBUG] Auto-clicking claim rewards button to advance");
          claimBtn.click();
        }
      }, 100);
    };
  }

  // Claim rewards button - use both onclick and addEventListener for maximum reliability
  const claimBtn = document.getElementById("claimRewardsBtn");
  if (claimBtn) {
    console.log("[BATTLE] Found claim rewards button, attaching handlers");
    
    // Clear any existing handlers
    claimBtn.onclick = null;
    
    // Use onclick as primary handler (more reliable)
    claimBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("[BATTLE] Claim rewards button clicked (onclick)");
      
      if (!localBattleState) {
        console.warn("[BATTLE] No battle state when claiming rewards");
        return;
      }
      
      const r = localBattleState.rewards;
      if (!r) {
        console.warn("[BATTLE] No rewards to claim");
        return;
      }
      
      console.log("[BATTLE] Claiming rewards:", r);
      
      try {
        updateGameState(s => {
          // MUST create a new object and RETURN it!
          return {
            ...s,
            wad: (s.wad ?? 0) + (r.wad ?? 0),
            resources: {
              metalScrap: (s.resources?.metalScrap ?? 0) + (r.metalScrap ?? 0),
              wood: (s.resources?.wood ?? 0) + (r.wood ?? 0),
              chaosShards: (s.resources?.chaosShards ?? 0) + (r.chaosShards ?? 0),
              steamComponents: (s.resources?.steamComponents ?? 0) + (r.steamComponents ?? 0),
            },
            cardLibrary: r.cards && r.cards.length > 0 
              ? addCardsToLibrary(s.cardLibrary ?? {}, r.cards)
              : s.cardLibrary,
          };
        });

        // Update quest progress for battle completion
        // Count enemies defeated (estimate from rewards or battle state)
        const enemyCount = Math.max(1, Math.floor((r.wad || 0) / 10)); // Rough estimate
        updateQuestProgress("kill_enemies", enemyCount, enemyCount);
        updateQuestProgress("complete_battle", "any", 1);
        
        // Update resource collection quests
        if (r.metalScrap) updateQuestProgress("collect_resource", "metalScrap", r.metalScrap);
        if (r.wood) updateQuestProgress("collect_resource", "wood", r.wood);
        if (r.chaosShards) updateQuestProgress("collect_resource", "chaosShards", r.chaosShards);
        if (r.steamComponents) updateQuestProgress("collect_resource", "steamComponents", r.steamComponents);
        
        // Track survival affinity for all units that survived
        trackBattleSurvival(localBattleState, true);
        
        // Mark battle as won in campaign system
        import("../../core/campaignManager").then(m => {
          m.recordBattleVictory();
          m.syncCampaignToGameState?.();
        }).catch(() => {
          // Fallback if campaign system not available
          markCurrentRoomVisited();
        });
        
        console.log("[BATTLE] Rewards claimed successfully");
      } catch (error) {
        console.error("[BATTLE] Error claiming rewards:", error);
        alert(`Error claiming rewards: ${error}`);
        return;
      }
      
      cleanupBattlePanHandlers();
      localBattleState = null;
      selectedCardIndex = null;
      resetTurnStateForUnit(null);
      uiPanelsMinimized = false;
      
      // Clear campaign flag
      (window as any).__isCampaignRun = false;
      
      // If in endless mode, start next battle instead of returning to operation map
      if (isEndlessBattleMode) {
        startNextEndlessBattle();
      } else {
        renderOperationMap();
      }
    };
    
    // Also add event listener as backup
    claimBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("[BATTLE] Claim rewards button clicked (addEventListener)");
      
      if (!localBattleState) return;
      const r = localBattleState.rewards;
      if (r) {
        // Same logic as onclick handler
        updateGameState(s => ({
          ...s,
          wad: (s.wad ?? 0) + (r.wad ?? 0),
          resources: {
            metalScrap: (s.resources?.metalScrap ?? 0) + (r.metalScrap ?? 0),
            wood: (s.resources?.wood ?? 0) + (r.wood ?? 0),
            chaosShards: (s.resources?.chaosShards ?? 0) + (r.chaosShards ?? 0),
            steamComponents: (s.resources?.steamComponents ?? 0) + (r.steamComponents ?? 0),
          },
          cardLibrary: r.cards && r.cards.length > 0 
            ? addCardsToLibrary(s.cardLibrary ?? {}, r.cards)
            : s.cardLibrary,
        }));
        
        // Update quest progress for battle completion
        const enemyCount = Math.max(1, Math.floor((r.wad || 0) / 10));
        updateQuestProgress("kill_enemies", enemyCount, enemyCount);
        updateQuestProgress("complete_battle", "any", 1);
        if (r.metalScrap) updateQuestProgress("collect_resource", "metalScrap", r.metalScrap);
        if (r.wood) updateQuestProgress("collect_resource", "wood", r.wood);
        if (r.chaosShards) updateQuestProgress("collect_resource", "chaosShards", r.chaosShards);
        if (r.steamComponents) updateQuestProgress("collect_resource", "steamComponents", r.steamComponents);
        
        // Track survival affinity for all units that survived
        trackBattleSurvival(localBattleState, true);
        
        // Mark the current battle room as visited/completed
        markCurrentRoomVisited();
      }
      
      cleanupBattlePanHandlers();
      localBattleState = null;
      selectedCardIndex = null;
      resetTurnStateForUnit(null);
      uiPanelsMinimized = false;
      
      // If in endless mode, start next battle instead of returning to operation map
      if (isEndlessBattleMode) {
        startNextEndlessBattle();
      } else {
        renderOperationMap();
      }
    }, { once: false, passive: false });
    
    // Ensure button is clickable
    claimBtn.style.pointerEvents = "auto";
    claimBtn.style.cursor = "pointer";
    claimBtn.style.zIndex = "1001";
  } else {
    console.warn("[BATTLE] Claim rewards button not found in DOM");
  }

  // Defeat handlers - retry or abandon
  const retryBtn = document.getElementById("retryRoomBtn");
  if (retryBtn) {
    retryBtn.onclick = () => {
      // Record defeat (increments retry counter)
      import("../../core/campaignManager").then(m => {
        m.recordBattleDefeat();
        // Retry uses same encounter (stored in pendingBattle)
        // Just re-enter the battle room
        cleanupBattlePanHandlers();
        localBattleState = null;
        selectedCardIndex = null;
        resetTurnStateForUnit(null);
        uiPanelsMinimized = false;
        
        // Re-enter battle (will use same encounter from pendingBattle)
        import("../../core/campaignManager").then(m => {
          const activeRun = m.getActiveRun();
          if (activeRun && activeRun.pendingBattle) {
            // Re-create battle from same encounter
            const state = getGameState();
            const battle = createBattleFromEncounter(state, activeRun.pendingBattle.encounterDefinition);
            updateGameState(prev => ({
              ...prev,
              currentBattle: battle,
              phase: "battle",
            }));
            renderBattleScreen();
          }
        });
      });
    };
  }
  
  const abandonBtn = document.getElementById("abandonRunBtn");
  if (abandonBtn) {
    abandonBtn.onclick = () => {
      import("../../core/campaignManager").then(m => {
        m.abandonRun();
        m.syncCampaignToGameState?.();
      });
      cleanupBattlePanHandlers();
      localBattleState = null;
      selectedCardIndex = null;
      resetTurnStateForUnit(null);
      uiPanelsMinimized = false;
      import("../screens/OperationSelectScreen").then(m => m.renderOperationSelectScreen());
    };
  }
  
  const defeatBtn = document.getElementById("defeatReturnBtn");
  if (defeatBtn) {
    defeatBtn.onclick = () => {
      cleanupBattlePanHandlers();
      localBattleState = null;
      selectedCardIndex = null;
      resetTurnStateForUnit(null);
      uiPanelsMinimized = false;
      
      if (isEndlessBattleMode) {
        console.log(`[ENDLESS BATTLE] Defeated after ${endlessBattleCount} battles`);
        isEndlessBattleMode = false;
        endlessBattleCount = 0;
      }
      
      renderBaseCampScreen();
    };
  }

  // Scroll battle log to bottom
  const log = document.getElementById("battleLog");
  if (log) log.scrollTop = log.scrollHeight;
  
  // Clutch toggle button
  const clutchBtn = document.getElementById("clutchToggleBtn");
  if (clutchBtn && activeUnit && localBattleState) {
    // Verify weapon is mechanical before allowing clutch toggle
    const state = getGameState();
    const equipmentById = (state as any).equipmentById || getAllStarterEquipment();
    const weapon = getEquippedWeapon(activeUnit, equipmentById);
    
    // Only allow clutch toggle for mechanical weapons
    if (weapon && weapon.isMechanical && weapon.clutchToggle) {
      clutchBtn.onclick = () => {
        const newUnits = { ...localBattleState!.units };
        const unit = newUnits[activeUnit.id];
        console.log("[CLUTCH] Toggle clicked, current state:", unit.weaponState?.clutchActive ?? unit.clutchActive ?? false);
        // Get current clutch state from weaponState if available, otherwise from unit
        const currentClutch = unit.weaponState?.clutchActive ?? unit.clutchActive ?? false;
        const newClutchState = !currentClutch;
        
        // Update both weaponState and unit for backward compatibility
        if (unit.weaponState) {
          newUnits[activeUnit.id] = {
            ...unit,
            weaponState: {
              ...unit.weaponState,
              clutchActive: newClutchState
            },
            clutchActive: newClutchState // Also update for backward compatibility
          };
        } else {
          newUnits[activeUnit.id] = {
            ...unit,
            clutchActive: newClutchState
          };
        }
        
        const action = newClutchState ? "engages" : "disengages";
        const newLog = [...localBattleState!.log, `SLK//CLUTCH :: ${activeUnit.name} ${action} weapon clutch.`];
        setBattleState({
          ...localBattleState!,
          units: newUnits,
          log: newLog
        });
        renderBattleScreen();
      };
    }
  }
}

// ============================================================================
// ENEMY TURN HELPER - Runs enemy turns with animation
// ============================================================================

let isAnimatingEnemyTurn = false;

function runEnemyTurns(state: BattleState): BattleState {
  if (state.phase !== "player_turn" && state.phase !== "enemy_turn") return state;
  
  let currentState = state;
  let safety = 0;
  
  while (safety < 20) {
    const active = currentState.activeUnitId ? currentState.units[currentState.activeUnitId] : null;
    
    if (!active || active.hp <= 0) {
      // Unit is dead, remove it and check for victory
      currentState = advanceTurn(currentState);
      // Explicitly check for victory after removing dead unit
      currentState = evaluateBattleOutcome(currentState);
      if (currentState.phase === "victory" || currentState.phase === "defeat") {
        break;
      }
      safety++;
      continue;
    }
    
    if (!active.isEnemy) {
      // Player's turn - reset their movement
      resetTurnStateForUnit(active);
      break;
    }
    
    // For enemies, we need to capture position before and after for animation
    const beforePos = active.pos ? { ...active.pos } : null;
    currentState = performEnemyTurn(currentState);
    // CRITICAL: Explicitly check for victory/defeat after enemy turn
    // This ensures victory is detected even if evaluateBattleOutcome wasn't called
    currentState = evaluateBattleOutcome(currentState);
    const afterUnit = currentState.units[active.id];
    const afterPos = afterUnit?.pos ? { ...afterUnit.pos } : null;
    
    // Queue animation if position changed (will be handled by re-render for now)
    // The animation will happen on next render cycle
    
    if (currentState.phase === "victory" || currentState.phase === "defeat") {
      console.log(`[BATTLE] Battle ended during enemy turn: ${currentState.phase}`);
      break;
    }
    
    safety++;
  }
  
  return currentState;
}

// Animated enemy turn runner - processes one enemy at a time with delays
function runEnemyTurnsAnimated(initialState: BattleState) {
  if (isAnimatingEnemyTurn) return;
  
  function processNextEnemy(state: BattleState) {
    if (state.phase !== "player_turn" && state.phase !== "enemy_turn") {
      isAnimatingEnemyTurn = false;
      setBattleState(state);
      renderBattleScreen();
      return;
    }
    
    const active = state.activeUnitId ? state.units[state.activeUnitId] : null;
    
    if (!active || active.hp <= 0) {
      // Unit is dead, remove it and check for victory
      let newState = advanceTurn(state);
      // Explicitly check for victory after removing dead unit
      newState = evaluateBattleOutcome(newState);
      if (newState.phase === "victory" || newState.phase === "defeat") {
        console.log(`[BATTLE] Battle ended during turn advance: ${newState.phase}`);
        isAnimatingEnemyTurn = false;
        setBattleState(newState);
        renderBattleScreen();
        return;
      }
      processNextEnemy(newState);
      return;
    }
    
    if (!active.isEnemy) {
      // Player's turn
      isAnimatingEnemyTurn = false;
      resetTurnStateForUnit(active);
      setBattleState(state);
      renderBattleScreen();
      
      // Trigger hand draw animation for player unit
      requestAnimationFrame(() => {
        const handContainer = document.getElementById("battleHandContainer");
        if (handContainer && active) {
          animateHandDraw(handContainer, () => {});
        }
      });
      return;
    }
    
    // Capture position before enemy acts
    const beforePos = active.pos ? { x: active.pos.x, y: active.pos.y } : null;
    
    // Perform enemy turn
    let newState = performEnemyTurn(state);
    
    // CRITICAL: Explicitly check for victory/defeat after enemy turn
    // This ensures victory is detected even if evaluateBattleOutcome wasn't called
    newState = evaluateBattleOutcome(newState);
    
    // Check if position changed
    const afterUnit = newState.units[active.id];
    const afterPos = afterUnit?.pos;
    
    const didMove = beforePos && afterPos && 
      (beforePos.x !== afterPos.x || beforePos.y !== afterPos.y);
    
    if (didMove && beforePos && afterPos) {
      // Animate enemy movement first, then update state
      console.log(`[ENEMY ANIMATION] Animating enemy ${active.id} from (${beforePos.x}, ${beforePos.y}) to (${afterPos.x}, ${afterPos.y})`);
      
      // Compute path for enemy movement
      // Use the state before the move to compute the path (unit is at beforePos in this state)
      if (!state) {
        // Fallback: update state immediately if battle state is missing
        setBattleState(newState);
        renderBattleScreen();
        setTimeout(() => processNextEnemy(newState), 300);
        return;
      }
      
      // Get movement range (use AGI or a reasonable default)
      const maxMove = active.agi ?? 10;
      const path = getMovePath(state, beforePos, afterPos, maxMove);
      
      if (path.length < 2) {
        // No valid path, update state immediately
        console.warn(`[ENEMY ANIMATION] No valid path found for enemy ${active.id}`);
        setBattleState(newState);
        renderBattleScreen();
        setTimeout(() => processNextEnemy(newState), 300);
        return;
      }
      
      // CRITICAL: Capture the newState in closure to ensure we use the correct state
      const capturedNewState = newState;
      const capturedAfterPos = { ...afterPos };
      
      // Validate the captured position
      if (capturedAfterPos.x < 0 || capturedAfterPos.x >= capturedNewState.gridWidth ||
          capturedAfterPos.y < 0 || capturedAfterPos.y >= capturedNewState.gridHeight) {
        console.error("[ENEMY MOVE] Invalid position!", capturedAfterPos);
        setBattleState(capturedNewState);
        renderBattleScreen();
        setTimeout(() => processNextEnemy(capturedNewState), 300);
        return;
      }
      
      // Start path-based animation
      // Use state (before move) for pathfinding, but capturedNewState will be applied after animation
      startMovementAnimation(active.id, path, state, () => {
        // After animation, update state with the captured state
        setBattleState(capturedNewState);
        
        // Validate the unit is at the correct position
        const unitAfterMove = capturedNewState.units[active.id];
        if (unitAfterMove && unitAfterMove.pos) {
          if (unitAfterMove.pos.x !== capturedAfterPos.x || unitAfterMove.pos.y !== capturedAfterPos.y) {
            console.error("[ENEMY MOVE] Position mismatch!", {
              expected: capturedAfterPos,
              actual: unitAfterMove.pos,
              unitId: active.id
            });
            // Fix it
            const fixedUnits = { ...capturedNewState.units };
            fixedUnits[active.id] = {
              ...fixedUnits[active.id],
              pos: { ...capturedAfterPos }
            };
            const fixedState = { ...capturedNewState, units: fixedUnits };
            setBattleState(fixedState);
            renderBattleScreen();
            setTimeout(() => processNextEnemy(fixedState), 100);
            return;
          }
        }
        
        // Check for victory/defeat (double-check after animation)
        if (capturedNewState.phase === "victory" || capturedNewState.phase === "defeat") {
          console.log(`[BATTLE] Battle ended: ${capturedNewState.phase}`);
          isAnimatingEnemyTurn = false;
          renderBattleScreen();
          return;
        }
        
        // Re-render to finalize position
        renderBattleScreen();
        
        // Process next enemy after animation
        setTimeout(() => processNextEnemy(capturedNewState), 100);
      });
      return; // Wait for animation to complete
    } else {
      // No movement, just update and continue
      setBattleState(newState);
      
      // Check for victory/defeat immediately
      if (newState.phase === "victory" || newState.phase === "defeat") {
        console.log(`[BATTLE] Battle ended: ${newState.phase}`);
        isAnimatingEnemyTurn = false;
        renderBattleScreen();
        return;
      }
      
      renderBattleScreen();
      
      // Small delay between enemy actions
      setTimeout(() => processNextEnemy(newState), 300);
    }
  }
  
  isAnimatingEnemyTurn = true;
  processNextEnemy(initialState);
}

// ============================================================================
// ENDLESS BATTLE MODE
// ============================================================================

/**
 * Start endless battle mode - continuous battles until defeat or exit
 */
export function startEndlessBattleMode(): void {
  console.log("[ENDLESS BATTLE] Starting endless battle mode");
  isEndlessBattleMode = true;
  endlessBattleCount = 0;
  
  // Reset any stale state
  localBattleState = null;
  selectedCardIndex = null;
  resetTurnStateForUnit(null);
  uiPanelsMinimized = false;
  
  // Start first battle
  startNextEndlessBattle();
}

/**
 * Start the next battle in endless mode
 */
function startNextEndlessBattle(): void {
  if (!isEndlessBattleMode) {
    console.warn("[ENDLESS BATTLE] Not in endless mode, cannot start next battle");
    return;
  }
  
  endlessBattleCount++;
  console.log(`[ENDLESS BATTLE] Starting battle ${endlessBattleCount}`);
  
  // Get current game state
  const state = getGameState();
  
  // Create a new test battle
  const battle = createTestBattleForCurrentParty(state);
  
  if (!battle) {
    console.error("[ENDLESS BATTLE] Failed to create battle");
    isEndlessBattleMode = false;
    endlessBattleCount = 0;
    import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
      renderFieldScreen("base_camp");
    });
    return;
  }
  
  // Set the battle state
  // Note: type cast needed due to BattleState interface mismatch between core/battle and core/types
  updateGameState(prev => ({
    ...prev,
    phase: "battle",
    currentBattle: battle as any,
  }));
  
  // Render the battle screen
  renderBattleScreen();
}

/**
 * Exit endless battle mode and return to base camp
 */
export function exitEndlessBattleMode(): void {
  console.log(`[ENDLESS BATTLE] Exiting after ${endlessBattleCount} battles`);
  
  cleanupBattlePanHandlers();
  localBattleState = null;
  selectedCardIndex = null;
  resetTurnStateForUnit(null);
  uiPanelsMinimized = false;
  isEndlessBattleMode = false;
  
  const finalCount = endlessBattleCount;
  endlessBattleCount = 0;
  
  // Show exit message
  alert(`Endless Battle Mode Complete!\nBattles Won: ${finalCount}`);
  
  import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
    renderFieldScreen("base_camp");
  });
}
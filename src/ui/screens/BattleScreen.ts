// src/ui/screens/BattleScreen.ts
// Battle screen with unit panel + weapon window alongside hand at bottom

import { getGameState, updateGameState } from "../../state/gameStore";
import { renderOperationMap, markCurrentRoomVisited } from "./OperationMapScreen";
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
} from "../../core/battle";
import { getBattleUnitPortraitPath } from "../../core/portraits";
import { updateQuestProgress } from "../../quests/questManager";
import { trackBattleSurvival } from "../../core/affinityBattle";

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
  
  const weaponName = unit.equippedWeaponId.replace(/^weapon_/, "").replace(/_/g, " ").toUpperCase();
  
  // Check if mechanical weapon
  const isMechanical = unit.equippedWeaponId.includes("repeater") || 
                       unit.equippedWeaponId.includes("coilgun") ||
                       unit.equippedWeaponId.includes("scattergun") ||
                       unit.equippedWeaponId.includes("crossbow") ||
                       unit.equippedWeaponId.includes("mortar") ||
                       unit.equippedWeaponId.includes("cannon");
  
  const heat = unit.weaponHeat ?? 0;
  const maxHeat = 6;
  const wear = unit.weaponWear ?? 0;
  const clutchActive = unit.clutchActive ?? false;
  
  // Node status (default all OK)
  const nodes: Record<number, string> = (unit as any).weaponNodes ?? {
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
        
        <div class="weapon-clutch-section">
          <button class="weapon-clutch-btn ${clutchActive ? 'weapon-clutch-btn--active' : ''}" id="clutchToggleBtn">
            <span class="clutch-dot ${clutchActive ? 'clutch-dot--active' : ''}"></span>
            <span class="clutch-label">CLUTCH ${clutchActive ? '[ENGAGED]' : '[OFF]'}</span>
          </button>
        </div>
        
        ${nodeDiagramHtml}
        
        ${isMechanical ? `
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

// These are stored PER UNIT in an extended battle state
interface TurnState {
  hasMoved: boolean;
  hasCommittedMove: boolean; // True after clicking a tile - hides green until undo
  hasActed: boolean; // True after playing a card - ends the turn for this unit
  movementRemaining: number;
  originalPosition: { x: number; y: number } | null;
}
let turnState: TurnState = { hasMoved: false, hasCommittedMove: false, hasActed: false, movementRemaining: 0, originalPosition: null };

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
  localBattleState = newState;
}

function resetTurnStateForUnit(unit: BattleUnitState | null) {
  turnState = {
    hasMoved: false,
    hasCommittedMove: false,
    hasActed: false,
    movementRemaining: unit?.agi ?? 3,
    originalPosition: null,
  };
}

// Animation helper - moves unit visually along path with smooth animation
// Works with units positioned using inset (not transform-based centering)
function animateUnitMovement(
  unitId: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
  onComplete: () => void
) {
  console.log(`[ANIMATION] Starting animation for unit ${unitId} from (${from.x}, ${from.y}) to (${to.x}, ${to.y})`);
  
  // Find the unit element on the grid - it should be in the source tile
  const grid = document.querySelector('.battle-grid');
  if (!grid) {
    console.warn('[ANIMATION] Grid not found');
    onComplete();
    return;
  }
  
  // Find the unit element in the source tile (where it currently is)
  const sourceTile = grid.querySelector(`[data-x="${from.x}"][data-y="${from.y}"]`) as HTMLElement;
  if (!sourceTile) {
    console.warn(`[ANIMATION] Source tile not found at (${from.x}, ${from.y})`);
    onComplete();
    return;
  }
  
  const unitEl = sourceTile.querySelector(`[data-unit-id="${unitId}"]`) as HTMLElement;
  if (!unitEl) {
    console.warn(`[ANIMATION] Unit ${unitId} not found in source tile`);
    onComplete();
    return;
  }
  
  // Get destination tile
  const destTile = grid.querySelector(`[data-x="${to.x}"][data-y="${to.y}"]`) as HTMLElement;
  if (!destTile) {
    console.warn(`[ANIMATION] Destination tile not found at (${to.x}, ${to.y})`);
    onComplete();
    return;
  }
  
  // Store original transform (units use inset for positioning, so transform is usually empty)
  const originalTransform = unitEl.style.transform || '';
  
  // Calculate the actual pixel offset from source to destination using getBoundingClientRect
  // Do this BEFORE moving the element
  const sourceRect = sourceTile.getBoundingClientRect();
  const destRect = destTile.getBoundingClientRect();
  
  // Calculate the pixel offset (negative because we're offsetting FROM destination BACK TO source)
  const offsetX = sourceRect.left - destRect.left;
  const offsetY = sourceRect.top - destRect.top;
  
  console.log(`[ANIMATION] Pixel offset: x=${offsetX}, y=${offsetY}`);
  
  // Calculate distance for animation duration (longer distance = longer animation, but capped)
  const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
  const baseDuration = 300; // Base duration in ms
  const duration = Math.min(baseDuration + (distance * 0.5), 600); // Scale with distance, max 600ms
  
  console.log(`[ANIMATION] Animation duration: ${duration}ms`);
  
  // Move the unit element to destination tile DOM-wise (but keep it visually at source)
  destTile.appendChild(unitEl);
  
  // Set initial position: unit is now in dest tile DOM but offset visually to source position
  unitEl.style.transition = 'none';
  unitEl.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  unitEl.style.zIndex = '100';
  
  // Force a reflow to ensure the initial position is applied
  void unitEl.offsetHeight;
  
  // Use double requestAnimationFrame for reliability
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Verify element still exists and is in the DOM
      if (!unitEl.parentElement || !document.body.contains(unitEl)) {
        console.warn('[ANIMATION] Unit element removed from DOM during animation setup');
        onComplete();
        return;
      }
      
      // Animate to final position (no transform offset = unit at its natural position in dest tile)
      unitEl.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1), filter ${duration}ms ease-out`;
      unitEl.style.transform = originalTransform || 'translate(0, 0)';
      unitEl.style.filter = 'brightness(1.2) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))';
      
      console.log(`[ANIMATION] Animation started, will complete in ${duration}ms`);
      
      // After animation completes, call onComplete and reset styles
      const timeoutId = setTimeout(() => {
        // Verify element still exists before modifying
        if (!unitEl.parentElement || !document.body.contains(unitEl)) {
          console.warn('[ANIMATION] Unit element removed from DOM during animation');
          onComplete();
          return;
        }
        
        // Reset to original state
        unitEl.style.filter = '';
        unitEl.style.zIndex = '';
        unitEl.style.transform = originalTransform;
        unitEl.style.transition = '';
        
        console.log(`[ANIMATION] Animation completed for unit ${unitId}`);
        onComplete();
      }, duration);
      
      // Store timeout ID on element for potential cleanup
      (unitEl as any).__animationTimeout = timeoutId;
    });
  });
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
  const roomLabel = state.operation?.currentRoomId ?? "ROOM_START";

  app.innerHTML = `
    <div class="battle-root">
      <!-- Battle grid as full-screen background -->
      <div class="battle-grid-background">
        ${renderBattleGrid(battle, selectedCardIndex, activeUnit)}
      </div>
      
      <!-- Header overlay at top -->
      <div class="battle-header-overlay">
        <div class="battle-header-left">
          <div class="battle-title">ENGAGEMENT – ${roomLabel}</div>
          <div class="battle-subtitle">TURN ${battle.turnCount} • GRID ${battle.gridWidth}×${battle.gridHeight}</div>
        </div>
        <div class="battle-header-right">
          <div class="battle-active-info">
            <div class="battle-active-label">ACTIVE UNIT</div>
            <div class="battle-active-value">${activeUnit?.name ?? "—"}</div>
          </div>
          <button class="battle-toggle-btn ${uiPanelsMinimized ? 'battle-toggle-btn--active' : ''}" id="toggleUiBtn">
            ${uiPanelsMinimized ? '👁 SHOW UI' : '👁 HIDE UI'}
          </button>
          <button class="battle-back-btn" id="exitBattleBtn">EXIT BATTLE</button>
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
      
      <!-- Bottom UI panels overlay -->
      <div class="battle-bottom-overlay">
        <div class="battle-unit-panel">${renderUnitPanel(activeUnit)}</div>
        <div class="battle-weapon-panel">${renderWeaponWindow(activeUnit)}</div>
      </div>
      
      <!-- Floating hand overlay (independent of bottom panel) -->
      <div class="battle-hand-floating ${activeUnit && activeUnit.strain > BASE_STRAIN_THRESHOLD ? "battle-hand--strained" : ""}">
        ${renderHandPanel(activeUnit, isPlayerTurn)}
      </div>
      
      ${renderBattleResultOverlay(battle)}
    </div>
  `;
  
  // Setup pan handlers and attach event listeners
  setupBattlePanHandlers();
  // Use requestAnimationFrame to ensure DOM is fully ready, especially for victory overlay
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      attachBattleListeners();
    });
  });
}

// ============================================================================
// RENDER HELPERS
// ============================================================================

function renderUnitPanel(activeUnit: BattleUnitState | undefined): string {
  if (!activeUnit || activeUnit.isEnemy) {
    return `<div class="unit-panel-empty"><div class="unit-panel-empty-text">NO ACTIVE UNIT</div></div>`;
  }
  const hp = activeUnit.hp ?? 0;
  const maxHp = activeUnit.maxHp ?? 1;
  const strainPct = Math.min(100, (activeUnit.strain / BASE_STRAIN_THRESHOLD) * 100);
  const isOver = activeUnit.strain > BASE_STRAIN_THRESHOLD;
  const maxMove = activeUnit.agi || 1;
  const movePct = (turnState.movementRemaining / maxMove) * 100;
  const portraitPath = getBattleUnitPortraitPath(activeUnit.id, activeUnit.baseUnitId);
  
  return `
    <div class="unit-panel-header">
      <div class="unit-panel-portrait">
        <img src="${portraitPath}" alt="${activeUnit.name}" class="unit-panel-portrait-img" onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
      </div>
      <div class="unit-panel-header-text">
        <div class="unit-panel-label">ACTIVE UNIT</div>
        <div class="unit-panel-name">${activeUnit.name}</div>
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
      <div class="unit-stat-row">
        <span class="unit-stat-label">STRAIN</span>
        <div class="unit-stat-bar">
          <div class="unit-stat-bar-track ${isOver ? "unit-stat-bar-track--danger" : ""}">
            <div class="unit-stat-bar-fill unit-stat-bar-fill--strain ${isOver ? "unit-stat-bar-fill--over" : ""}" style="width:${strainPct}%"></div>
          </div>
          <span class="unit-stat-value ${isOver ? "unit-stat-value--danger" : ""}">${activeUnit.strain}/${BASE_STRAIN_THRESHOLD}</span>
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

function renderBattleGrid(battle: BattleState, selectedCardIdx: number | null, activeUnit: BattleUnitState | undefined): string {
  const { gridWidth, gridHeight } = battle;
  const units = getUnitsArray(battle);
  
  let selectedCard: Card | null = null;
  if (selectedCardIdx !== null && activeUnit?.hand[selectedCardIdx]) {
    selectedCard = resolveCard(activeUnit.hand[selectedCardIdx]);
  }
  
  const moveOpts = new Set<string>();
  const atkOpts = new Set<string>();
  
  if (activeUnit && !activeUnit.isEnemy && activeUnit.pos) {
    const ux = activeUnit.pos.x;
    const uy = activeUnit.pos.y;
    
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
      // Only show movement options if we haven't committed to a move yet
      // Calculate all reachable tiles from ORIGINAL position (or current if not moved yet)
      const originX = turnState.originalPosition?.x ?? ux;
      const originY = turnState.originalPosition?.y ?? uy;
      const maxMove = activeUnit.agi; // Always use full AGI from original position
      const reachable = getReachableTiles(originX, originY, maxMove, gridWidth, gridHeight, units);
      reachable.forEach(key => moveOpts.add(key));
    }
  }
  
  let tiles = "";
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const k = `${x},${y}`;
      const isMv = moveOpts.has(k);
      const isAtk = atkOpts.has(k);
      
      let cls = "battle-tile battle-tile--floor";
      if (isMv) cls += " battle-tile--move-option";
      if (isAtk) cls += " battle-tile--attack-option";
      
      const u = units.find(u => u.pos?.x === x && u.pos?.y === y && u.hp > 0);
      let uHtml = "";
      if (u) {
        const side = u.isEnemy ? "battle-unit--enemy" : "battle-unit--ally";
        const act = u.id === battle.activeUnitId ? "battle-unit--active" : "";
        const truncName = u.name.length > 8 ? u.name.slice(0, 8) + "…" : u.name;
        // Unit facing - default to east for allies, west for enemies
        const facing = u.facing ?? (u.isEnemy ? "west" : "east");
        const portraitPath = getBattleUnitPortraitPath(u.id, u.baseUnitId);
        uHtml = `
          <div class="battle-unit ${side} ${act}" data-unit-id="${u.id}" data-facing="${facing}">
            <div class="battle-unit-portrait-wrapper">
              <div class="battle-unit-portrait">
                <img src="${portraitPath}" alt="${u.name}" class="battle-unit-portrait-img" onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
              </div>
              <div class="battle-unit-info-overlay">
                <div class="battle-unit-name">${truncName}</div>
                <div class="battle-unit-hp">HP ${u.hp}/${u.maxHp}</div>
              </div>
            </div>
          </div>
        `;
      }
      // Make tiles easily clickable - ensure the tile itself is the click target
      tiles += `<div class="${cls}" data-x="${x}" data-y="${y}">${uHtml}</div>`;
    }
  }
  
  return `<div class="battle-grid-pan-wrapper"><div class="battle-grid-container"><div class="battle-grid" style="--battle-grid-cols:${gridWidth};--battle-grid-rows:${gridHeight};">${tiles}</div></div></div>`;
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
    return `
      <div class="battle-result-overlay battle-result-overlay--defeat">
        <div class="battle-result-card">
          <div class="battle-result-title">DEFEAT</div>
          <div class="battle-defeat-text">Your squad has been wiped out.</div>
          <div class="battle-result-footer">
            <button class="battle-result-btn" id="defeatReturnBtn">RETURN TO BASE</button>
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

function attachBattleListeners() {
  if (!localBattleState) return;
  
  const battle = localBattleState;
  const activeUnit = battle.activeUnitId ? battle.units[battle.activeUnitId] : undefined;
  const isPlayerTurn = activeUnit && !activeUnit.isEnemy;
  const units = getUnitsArray(battle);

  // Exit battle button
  const exitBtn = document.getElementById("exitBattleBtn");
  if (exitBtn) {
    exitBtn.onclick = () => {
      cleanupBattlePanHandlers();
      localBattleState = null;
      selectedCardIndex = null;
      resetTurnStateForUnit(null);
      uiPanelsMinimized = false; // Reset UI visibility
      renderOperationMap();
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

  // Tile clicks (move or attack) - use event delegation for better click handling
  document.querySelectorAll(".battle-tile").forEach(el => {
    // Make sure the tile itself handles clicks, not just children
    (el as HTMLElement).style.pointerEvents = 'auto';
    (el as HTMLElement).onclick = (e) => {
      // Stop propagation to ensure tile click is handled
      e.stopPropagation();
      if (!isPlayerTurn || !activeUnit || !localBattleState) return;
      
      const x = parseInt((el as HTMLElement).dataset.x ?? "-1");
      const y = parseInt((el as HTMLElement).dataset.y ?? "-1");
      
      if (selectedCardIndex !== null) {
        // Playing a card
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
          // Calculate facing towards target
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
          
          // Update facing before playing card
          let stateWithFacing = localBattleState;
          if (newFacing !== activeUnit.facing) {
            const newUnits = { ...localBattleState.units };
            newUnits[activeUnit.id] = { ...newUnits[activeUnit.id], facing: newFacing };
            stateWithFacing = { ...localBattleState, units: newUnits };
          }
          
          let newState = playCardFromScreen(stateWithFacing, activeUnit.id, selectedCardIndex, targetUnitId);
selectedCardIndex = null;

// Do NOT auto-advance turn - players can play multiple cards per turn
// Strain accumulates but turn only ends when End Turn is clicked

// Check for victory/defeat after card play
newState = evaluateBattleOutcome(newState);

// Update state and re-render (stay on same unit's turn)
setBattleState(newState);
renderBattleScreen();
        }
      } else {
        // Movement - clicking any green tile commits the move
        if (el.classList.contains("battle-tile--move-option")) {
          // Save original position for undo (only on first move)
          if (!turnState.hasMoved && activeUnit.pos) {
            turnState.originalPosition = { x: activeUnit.pos.x, y: activeUnit.pos.y };
          }
          
          // Calculate movement cost from ORIGINAL position
          const originX = turnState.originalPosition?.x ?? activeUnit.pos?.x ?? 0;
          const originY = turnState.originalPosition?.y ?? activeUnit.pos?.y ?? 0;
          const moveCost = getDistance(originX, originY, x, y);
          
          // Update movement remaining
          turnState.movementRemaining = activeUnit.agi - moveCost;
          
          // Mark as moved - this will hide green tiles until undo
          turnState.hasMoved = true;
          turnState.hasCommittedMove = true;
          
          // Calculate facing based on movement direction
          const currentX = activeUnit.pos?.x ?? 0;
          const currentY = activeUnit.pos?.y ?? 0;
          let newFacing: "north" | "south" | "east" | "west" = activeUnit.facing ?? "east";
          
          const dx = x - currentX;
          const dy = y - currentY;
          
          // Determine primary direction of movement
          if (Math.abs(dx) >= Math.abs(dy)) {
            newFacing = dx > 0 ? "east" : "west";
          } else {
            newFacing = dy > 0 ? "south" : "north";
          }
          
          // DON'T update state yet - animate first, then update
          // This ensures the animation can find the unit in its current position
          // Use CURRENT position (already declared above), not original position, for animation
          console.log(`[PLAYER ANIMATION] Animating unit ${activeUnit.id} from (${currentX}, ${currentY}) to (${x}, ${y})`);
          animateUnitMovement(activeUnit.id, { x: currentX, y: currentY }, { x, y }, () => {
            // After animation completes, update state and re-render
            if (!localBattleState) return;
            let newState = moveUnit(localBattleState, activeUnit.id, { x, y });
            
            // Update facing
            const newUnits = { ...newState.units };
            newUnits[activeUnit.id] = {
              ...newUnits[activeUnit.id],
              facing: newFacing
            };
            newState = { ...newState, units: newUnits };
            setBattleState(newState);
            
            // Re-render to finalize the position
            renderBattleScreen();
          });
        }
      }
    };
  });

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
  const endTurnBtn = document.getElementById("endTurnBtn");
  if (endTurnBtn) {
    endTurnBtn.onclick = () => {
      if (!isPlayerTurn || !localBattleState) return;
      
      // Advance turn
      let newState = advanceTurn(localBattleState);
      selectedCardIndex = null;
      
      // Run enemy turns with animation
      runEnemyTurnsAnimated(newState);
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
        
        // Mark the current battle room as visited/completed
        markCurrentRoomVisited();
        
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
      renderOperationMap();
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
      renderOperationMap();
    }, { once: false, passive: false });
    
    // Ensure button is clickable
    claimBtn.style.pointerEvents = "auto";
    claimBtn.style.cursor = "pointer";
    claimBtn.style.zIndex = "1001";
  } else {
    console.warn("[BATTLE] Claim rewards button not found in DOM");
  }

  // Defeat return button
  const defeatBtn = document.getElementById("defeatReturnBtn");
  if (defeatBtn) {
    defeatBtn.onclick = () => {
      cleanupBattlePanHandlers();
      localBattleState = null;
      selectedCardIndex = null;
      resetTurnStateForUnit(null);
      uiPanelsMinimized = false;
      renderBaseCampScreen();
    };
  }

  // Scroll battle log to bottom
  const log = document.getElementById("battleLog");
  if (log) log.scrollTop = log.scrollHeight;
  
  // Clutch toggle button
  const clutchBtn = document.getElementById("clutchToggleBtn");
  if (clutchBtn && activeUnit && localBattleState) {
    clutchBtn.onclick = () => {
      const newUnits = { ...localBattleState!.units };
      const currentClutch = newUnits[activeUnit.id].clutchActive ?? false;
      newUnits[activeUnit.id] = {
        ...newUnits[activeUnit.id],
        clutchActive: !currentClutch
      };
      const action = !currentClutch ? "engages" : "disengages";
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
      animateUnitMovement(active.id, beforePos, afterPos, () => {
        // After animation, update state
        setBattleState(newState);
        
        // Check for victory/defeat (double-check after animation)
        if (newState.phase === "victory" || newState.phase === "defeat") {
          console.log(`[BATTLE] Battle ended: ${newState.phase}`);
          isAnimatingEnemyTurn = false;
          renderBattleScreen();
          return;
        }
        
        // Re-render to finalize position
        renderBattleScreen();
        
        // Process next enemy after animation
        setTimeout(() => processNextEnemy(newState), 100);
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
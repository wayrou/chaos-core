// ============================================================================
// BATTLE SYSTEM - Updated with Equipment-Based Decks (11b/11c integration)
// ============================================================================

import { GameState, Unit, CardId, UnitId } from "./types";
import { computeLoadPenaltyFlags, LoadPenaltyFlags } from "./inventory";
import { GameState } from "./types";
import { getSettings } from "./settings";

import {
  UnitLoadout,
  UnitClass,
  buildDeckFromLoadout,
  calculateEquipmentStats,
  getAllStarterEquipment,
  getAllModules,
  Equipment,
  Module,
  WeaponEquipment,
} from "./equipment";
import {
  WeaponRuntimeState,
  createWeaponRuntimeState,
  passiveCooling,
} from "./weaponSystem";

// STEP 6 & 7: Import gear workbench functions
import { 
  GearSlotData,
  getDefaultGearSlots,
  generateBattleRewardCards,
  LIBRARY_CARD_DATABASE,
} from "./gearWorkbench";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export type TerrainType = "floor" | "wall" | "cover" | "hazard";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Tile {
  pos: Vec2;
  terrain: TerrainType;
}

export interface BattleUnitState {
  id: UnitId;
  baseUnitId: UnitId;
  name: string;
  classId: string;
  isEnemy: boolean;
  pos: Vec2 | null;
  facing: "north" | "south" | "east" | "west";
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  agi: number;
  acc: number;
  strain: number;
  drawPile: CardId[];
  hand: CardId[];
  discardPile: CardId[];
  exhaustedPile: CardId[];
  buffs: Array<{
    id: string;
    type: "def_up" | "atk_up" | "agi_up" | string;
    amount: number;
    duration: number;
  }>;
  // Weapon system (14b)
  equippedWeaponId: string | null;
  weaponState: WeaponRuntimeState | null;
  // Clutch toggle
  clutchActive?: boolean;
  weaponHeat?: number;
  weaponWear?: number;
}

export interface BattleState {
  id: string;
  floorId: string;
  roomId: string;
  gridWidth: number;
  gridHeight: number;
  tiles: Tile[];
  units: Record<UnitId, BattleUnitState>;
  turnOrder: UnitId[];
  activeUnitId: UnitId | null;
  phase: "player_turn" | "enemy_turn" | "victory" | "defeat";
  turnCount: number;
  log: string[];
  rewards?: {
    wad: number;
    metalScrap: number;
    wood: number;
    chaosShards: number;
    steamComponents: number;
    cards?: string[];  // NEW: Card IDs won
  };
  loadPenalties?: LoadPenaltyFlags;
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function getLoadPenalties(state: BattleState): LoadPenaltyFlags | null {
  return state.loadPenalties ?? null;
}

// ----------------------------------------------------------------------------
// GRID CREATION
// ----------------------------------------------------------------------------

export function createGrid(width: number, height: number): Tile[] {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const terrain: TerrainType = "floor";
      tiles.push({
        pos: { x, y },
        terrain,
      });
    }
  }
  return tiles;
}

// ----------------------------------------------------------------------------
// BATTLE UNIT STATE CREATION - NOW WITH EQUIPMENT-BASED DECKS
// ----------------------------------------------------------------------------

/**
 * Build a BattleUnitState from a global Unit and placement info.
 * NOW: Builds deck from equipment loadout instead of using base.deck
 */
export function createBattleUnitState(
  base: Unit,
  opts: {
    isEnemy: boolean;
    pos: Vec2 | null;
    gearSlots?: Record<string, GearSlotData>;  // NEW
  },
  equipmentById?: Record<string, Equipment>,
  modulesById?: Record<string, Module>
): BattleUnitState {
  // Get equipment and module data
  const equipment = equipmentById || getAllStarterEquipment();
  const modules = modulesById || getAllModules();

  // Get unit's class and loadout (with fallbacks)
  const unitClass: UnitClass = (base as any).unitClass || "squire";
  const loadout: UnitLoadout = (base as any).loadout || {
    weapon: null,
    helmet: null,
    chestpiece: null,
    accessory1: null,
    accessory2: null,
  };

  // BUILD DECK FROM EQUIPMENT (the key change!)
  let deckCards: CardId[];

  if (opts.isEnemy) {
    // Enemies still use their base deck (or a simple default)
    deckCards = base.deck && base.deck.length > 0
      ? [...base.deck]
      : ["core_basic_attack", "core_basic_attack", "core_guard", "core_wait"];
  } else {
    // STEP 6: Player units - build deck from equipment + slotted cards
    const baseCards = buildDeckFromLoadout(unitClass, loadout, equipment, modules);
    
    // Get slotted cards from gear workbench
    const gearSlots = opts.gearSlots ?? {};
    
    // Collect all equipped gear IDs
    const equippedGearIds: string[] = [];
    if (loadout.weapon) equippedGearIds.push(loadout.weapon);
    if (loadout.helmet) equippedGearIds.push(loadout.helmet);
    if (loadout.chestpiece) equippedGearIds.push(loadout.chestpiece);
    if (loadout.accessory1) equippedGearIds.push(loadout.accessory1);
    if (loadout.accessory2) equippedGearIds.push(loadout.accessory2);
    
    // Get slotted cards from each piece of gear
    const slottedCards: string[] = [];
    equippedGearIds.forEach(eqId => {
      const slots = gearSlots[eqId] ?? getDefaultGearSlots(eqId);
      slottedCards.push(...slots.slottedCards);
    });
    
    // Combine base cards + slotted cards
    deckCards = [...baseCards, ...slottedCards];
  }

  // Shuffle the deck
  const deck = shuffleArray(deckCards);
  const hand: CardId[] = [];
  const discardPile: CardId[] = [];
  const exhaustedPile: CardId[] = [];

  // Calculate equipment stat bonuses
  const equipStats = calculateEquipmentStats(loadout, equipment, modules);

  // Base stats + equipment bonuses
  const finalAtk = base.stats.atk + (opts.isEnemy ? 0 : equipStats.atk);
  const finalDef = base.stats.def + (opts.isEnemy ? 0 : equipStats.def);
  const finalAgi = base.stats.agi + (opts.isEnemy ? 0 : equipStats.agi);
  const finalAcc = base.stats.acc + (opts.isEnemy ? 0 : equipStats.acc);
  const finalMaxHp = base.stats.maxHp + (opts.isEnemy ? 0 : equipStats.hp);

  // Initialize weapon state (14b)
  let equippedWeaponId: string | null = null;
  let weaponState: WeaponRuntimeState | null = null;

  if (!opts.isEnemy && loadout.weapon) {
    const weapon = equipment[loadout.weapon];
    if (weapon && weapon.slot === "weapon") {
      equippedWeaponId = loadout.weapon;
      weaponState = createWeaponRuntimeState(weapon as WeaponEquipment);
    }
  }

  return {
    id: base.id,
    baseUnitId: base.id,
    name: base.name,
    classId: base.classId,
    isEnemy: opts.isEnemy,
    pos: opts.pos,
    facing: opts.isEnemy ? "west" : "east", // Enemies face left, allies face right
    hp: finalMaxHp,
    maxHp: finalMaxHp,
    atk: finalAtk,
    def: finalDef,
    agi: finalAgi,
    acc: finalAcc,
    strain: 0,
    drawPile: deck,
    hand,
    discardPile,
    exhaustedPile,
    buffs: [],
    equippedWeaponId,
    weaponState,
    clutchActive: false,
    weaponHeat: 0,
    weaponWear: 0,
  };
}

// ----------------------------------------------------------------------------
// TURN ORDER
// ----------------------------------------------------------------------------

export function computeTurnOrder(
  units: Record<UnitId, BattleUnitState>
): UnitId[] {
  const entries = Object.values(units);
  entries.sort((a, b) => {
    if (b.agi !== a.agi) {
      return b.agi - a.agi;
    }
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
  return entries.map((u) => u.id);
}

// ----------------------------------------------------------------------------
// STRAIN SYSTEM
// ----------------------------------------------------------------------------

export const BASE_STRAIN_THRESHOLD = 6;

export function getStrainThreshold(unit: BattleUnitState): number {
  return BASE_STRAIN_THRESHOLD;
}

export function isOverStrainThreshold(unit: BattleUnitState): boolean {
  return unit.strain >= getStrainThreshold(unit);
}

export function applyStrain(
  state: BattleState,
  unit: BattleUnitState,
  amount: number
): BattleState {
  const oldStrain = unit.strain;
  const newStrain = Math.max(0, oldStrain + amount);

  const updated: BattleUnitState = {
    ...unit,
    strain: newStrain,
  };

  let next: BattleState = {
    ...state,
    units: {
      ...state.units,
      [unit.id]: updated,
    },
  };

  const wasOver = oldStrain >= getStrainThreshold(unit);
  const nowOver = newStrain >= getStrainThreshold(updated);

  if (!wasOver && nowOver) {
    next = appendBattleLog(
      next,
      `SLK//ALERT :: ${unit.name}'s vitals spike - STRAIN threshold exceeded.`
    );
  }

  return next;
}

// ----------------------------------------------------------------------------
// TURN ADVANCEMENT
// ----------------------------------------------------------------------------

export function advanceTurn(state: BattleState): BattleState {
  if (state.turnOrder.length === 0) {
    return state;
  }

  const currentIndex = state.activeUnitId
    ? state.turnOrder.indexOf(state.activeUnitId)
    : -1;

  const nextIndex =
    currentIndex === -1 || currentIndex === state.turnOrder.length - 1
      ? 0
      : currentIndex + 1;

  const nextActiveId = state.turnOrder[nextIndex];

  let newState: BattleState = {
    ...state,
    activeUnitId: nextActiveId,
    turnCount:
      currentIndex === -1
        ? 1
        : state.turnCount + (nextIndex === 0 ? 1 : 0),
  };

  // --- STRAIN COOLDOWN ON NEW ACTIVE UNIT ---
  if (nextActiveId && newState.units[nextActiveId]) {
    const u = newState.units[nextActiveId];
    const oldStrain = u.strain;
    const cooledStrain = Math.max(0, oldStrain - 1);

    let cooledUnit: BattleUnitState = {
      ...u,
      strain: cooledStrain,
    };

    const wasOver = oldStrain >= getStrainThreshold(u);
    const nowOver = cooledStrain >= getStrainThreshold(cooledUnit);

    let cooledState: BattleState = {
      ...newState,
      units: {
        ...newState.units,
        [nextActiveId]: cooledUnit,
      },
    };

    if (wasOver && !nowOver) {
      cooledState = appendBattleLog(
        cooledState,
        `${u.name}'s vitals normalize - strain cooling.`
      );
    }

    newState = cooledState;
  }

  // --- BUFF TICK / DESPAWN ON NEW ACTIVE UNIT ---
  if (nextActiveId && newState.units[nextActiveId]) {
    const u = newState.units[nextActiveId];
    const updatedBuffs = (u.buffs ?? [])
      .map((b) => ({ ...b, duration: b.duration - 1 }))
      .filter((b) => b.duration > 0);

    newState = {
      ...newState,
      units: {
        ...newState.units,
        [nextActiveId]: {
          ...u,
          buffs: updatedBuffs,
        },
      },
    };
  }

  // --- WEAPON PASSIVE COOLING (14b) ---
  if (nextActiveId && newState.units[nextActiveId]) {
    const u = newState.units[nextActiveId];
    if (u.weaponState && !u.isEnemy) {
      const cooledWeaponState = passiveCooling(u.weaponState);
      // Also clear jammed status at start of turn
      const unjammedState = {
        ...cooledWeaponState,
        isJammed: false,
      };
      newState = {
        ...newState,
        units: {
          ...newState.units,
          [nextActiveId]: {
            ...newState.units[nextActiveId],
            weaponState: unjammedState,
          },
        },
      };
    }
  }

  // --- POWER SURGE CHECK (10za POWER overload) ---
  const loadPenalties = getLoadPenalties(newState);
  if (loadPenalties && loadPenalties.powerOver) {
    if (Math.random() < 0.15) {
      let units = { ...newState.units };
      const allies = Object.values(units).filter((u) => !u.isEnemy);
      for (const ally of allies) {
        const cur = units[ally.id];
        units[ally.id] = {
          ...cur,
          hp: Math.max(0, cur.hp - 1),
        };
      }
      newState = {
        ...newState,
        units,
        log: [
          ...newState.log,
          "SLK//SURGE :: Power overload shocks your squad (-1 HP).",
        ],
      };
    }
  }

  // --- DRAW CARDS FOR PLAYER UNIT ---
  const nextUnit = nextActiveId ? newState.units[nextActiveId] : null;
  if (nextUnit && !nextUnit.isEnemy) {
    newState = drawCardsForTurn(newState, nextUnit);
  }

  return newState;
}

// ----------------------------------------------------------------------------
// LOGGING
// ----------------------------------------------------------------------------

export function appendBattleLog(
  state: BattleState,
  message: string
): BattleState {
  return {
    ...state,
    log: [...state.log, message],
  };
}

// ----------------------------------------------------------------------------
// ACTIVE UNIT
// ----------------------------------------------------------------------------

export function getActiveUnit(state: BattleState): BattleUnitState | null {
  if (!state.activeUnitId) return null;
  return state.units[state.activeUnitId] ?? null;
}

// ----------------------------------------------------------------------------
// WEAPON HELPERS (14b)
// ----------------------------------------------------------------------------

/**
 * Get the equipped weapon for a battle unit
 */
export function getEquippedWeapon(
  unit: BattleUnitState,
  equipmentById?: Record<string, Equipment>
): WeaponEquipment | null {
  if (!unit.equippedWeaponId) return null;
  
  const equipment = equipmentById || getAllStarterEquipment();
  const weapon = equipment[unit.equippedWeaponId];
  
  if (weapon && weapon.slot === "weapon") {
    return weapon as WeaponEquipment;
  }
  
  return null;
}

/**
 * Update weapon state for a unit in battle
 */
export function updateUnitWeaponState(
  state: BattleState,
  unitId: UnitId,
  newWeaponState: WeaponRuntimeState
): BattleState {
  const unit = state.units[unitId];
  if (!unit) return state;
  
  return {
    ...state,
    units: {
      ...state.units,
      [unitId]: {
        ...unit,
        weaponState: newWeaponState,
      },
    },
  };
}

// ----------------------------------------------------------------------------
// POSITION / MOVEMENT HELPERS
// ----------------------------------------------------------------------------

export function arePositionsAdjacent(a: Vec2, b: Vec2): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx + dy === 1;
}

export function isInsideBounds(state: BattleState, pos: Vec2): boolean {
  return (
    pos.x >= 0 &&
    pos.y >= 0 &&
    pos.x < state.gridWidth &&
    pos.y < state.gridHeight
  );
}

export function isWalkableTile(state: BattleState, pos: Vec2): boolean {
  if (!isInsideBounds(state, pos)) return false;
  const tile = state.tiles.find(
    (t) => t.pos.x === pos.x && t.pos.y === pos.y
  );
  if (!tile || tile.terrain === "wall") return false;

  const unitOnTile = Object.values(state.units).find(
    (u) => u.pos && u.pos.x === pos.x && u.pos.y === pos.y
  );
  if (unitOnTile) return false;

  return true;
}

export function canUnitMoveTo(
  state: BattleState,
  unit: BattleUnitState,
  dest: Vec2
): boolean {
  if (!unit.pos) return false;

  const dx = Math.abs(unit.pos.x - dest.x);
  const dy = Math.abs(unit.pos.y - dest.y);
  const distance = dx + dy;

  if (distance === 0 || distance > unit.agi) return false;

  return isWalkableTile(state, dest);
}

export function moveUnit(
  state: BattleState,
  unitId: UnitId,
  dest: Vec2
): BattleState {
  const unit = state.units[unitId];
  if (!unit) return state;

  const updatedUnit: BattleUnitState = {
    ...unit,
    pos: { ...dest },
  };

  const units = {
    ...state.units,
    [unitId]: updatedUnit,
  };

  let next: BattleState = {
    ...state,
    units,
  };

  next = appendBattleLog(
    next,
    `SLK//MOVE   :: ${unit.name} repositions to (${dest.x}, ${dest.y}).`
  );

  return next;
}

// ----------------------------------------------------------------------------
// ATTACK HELPERS
// ----------------------------------------------------------------------------

export function canUnitAttackTarget(
  attacker: BattleUnitState,
  target: BattleUnitState
): boolean {
  if (!attacker.pos || !target.pos) return false;
  return arePositionsAdjacent(attacker.pos, target.pos);
}

export function computeHitChance(unit: BattleUnitState): number {
  let baseChance = unit.acc;

  if (isOverStrainThreshold(unit)) {
    baseChance -= 20;
  }

  return Math.max(10, Math.min(100, baseChance));
}

function isPlayerUnit(u: BattleUnitState): boolean {
  return !u.isEnemy;
}

function isEnemyUnit(u: BattleUnitState): boolean {
  return u.isEnemy;
}

// ----------------------------------------------------------------------------
// ATTACK
// ----------------------------------------------------------------------------

export function attackUnit(
  state: BattleState,
  attackerId: UnitId,
  defenderId: UnitId
): BattleState {
  const attacker = state.units[attackerId];
  const defender = state.units[defenderId];
  if (!attacker || !defender) return state;

  // --- BULK overload: JAM chance for *player* attacks ---
  const loadPenalties = getLoadPenalties(state);
  if (loadPenalties && loadPenalties.bulkOver && !attacker.isEnemy) {
    const over = Math.max(0, loadPenalties.bulkPct - 1);
    const jamChance = Math.min(over, 0.5);
    if (Math.random() < jamChance) {
      return appendBattleLog(
        state,
        `SLK//JAM   :: ${attacker.name}'s weapon jams under BULK overload.`
      );
    }
  }

  // Accuracy check
  const hitChance = computeHitChance(attacker);
  const roll = Math.random() * 100;

  if (roll > hitChance) {
    return appendBattleLog(
      state,
      `SLK//MISS  :: ${attacker.name} swings at ${defender.name} but the strike goes wide (strain interference).`
    );
  }

  // DEF buffs
  const totalDefBuff =
    defender.buffs?.length
      ? defender.buffs
          .filter((b) => b.type === "def_up")
          .reduce((sum, b) => sum + b.amount, 0)
      : 0;

  const rawDamage = attacker.atk - (defender.def + totalDefBuff);
  const damage = rawDamage <= 0 ? 1 : rawDamage;

  const newHp = defender.hp - damage;

  let units = { ...state.units };
  let turnOrder = [...state.turnOrder];
  let next: BattleState = { ...state };

  if (newHp <= 0) {
    delete units[defenderId];
    turnOrder = turnOrder.filter((id) => id !== defenderId);
    next = {
      ...next,
      units,
      turnOrder,
    };
    next = appendBattleLog(
      next,
      `SLK//HIT   :: ${attacker.name} hits ${defender.name} for ${damage} - TARGET OFFLINE.`
    );
  } else {
    const updatedDefender: BattleUnitState = {
      ...defender,
      hp: newHp,
    };
    units = {
      ...state.units,
      [defenderId]: updatedDefender,
    };
    next = {
      ...next,
      units,
    };
    next = appendBattleLog(
      next,
      `SLK//HIT   :: ${attacker.name} hits ${defender.name} for ${damage} (HP ${newHp}/${defender.maxHp}).`
    );
  }

  // Track affinity for melee attack (if attacker is player unit)
  if (!attacker.isEnemy) {
    const { trackMeleeAttackInBattle } = require("./affinityBattle");
    trackMeleeAttackInBattle(attackerId, next);
  }

  next = evaluateBattleOutcome(next);
  return next;
}

// ----------------------------------------------------------------------------
// ENEMY AI
// ----------------------------------------------------------------------------

export function performEnemyTurn(state: BattleState): BattleState {
  const active = getActiveUnit(state);
  if (!active || !active.isEnemy || !active.pos) {
    return advanceTurn(state);
  }

  const players = Object.values(state.units).filter(isPlayerUnit);
  if (players.length === 0) {
    return advanceTurn(state);
  }

  let target = players[0];
  let bestDist = Infinity;
  for (const u of players) {
    if (!u.pos) continue;
    const d =
      Math.abs(active.pos.x - u.pos.x) +
      Math.abs(active.pos.y - u.pos.y);
    if (d < bestDist) {
      bestDist = d;
      target = u;
    }
  }

  let next: BattleState = { ...state };

  // Helper to update facing
  const updateFacing = (s: BattleState, unitId: string, targetPos: Vec2): BattleState => {
    const unit = s.units[unitId];
    if (!unit || !unit.pos) return s;
    
    const dx = targetPos.x - unit.pos.x;
    const dy = targetPos.y - unit.pos.y;
    let newFacing: "north" | "south" | "east" | "west" = unit.facing;
    
    if (Math.abs(dx) >= Math.abs(dy)) {
      newFacing = dx > 0 ? "east" : "west";
    } else {
      newFacing = dy > 0 ? "south" : "north";
    }
    
    if (newFacing !== unit.facing) {
      const newUnits = { ...s.units };
      newUnits[unitId] = { ...unit, facing: newFacing };
      return { ...s, units: newUnits };
    }
    return s;
  };

  if (canUnitAttackTarget(active, target)) {
    // Face the target before attacking
    if (target.pos) {
      next = updateFacing(next, active.id, target.pos);
    }
    next = attackUnit(next, active.id, target.id);
    next = advanceTurn(next);
    return next;
  }

  const dx = Math.sign(target.pos!.x - active.pos.x);
  const dy = Math.sign(target.pos!.y - active.pos.y);

  const candidate1 = { x: active.pos.x + dx, y: active.pos.y };
  const candidate2 = { x: active.pos.x, y: active.pos.y + dy };

  let movedState = next;

  if (dx !== 0 && canUnitMoveTo(next, active, candidate1)) {
    movedState = moveUnit(next, active.id, candidate1);
    // Update facing based on movement direction
    movedState = updateFacing(movedState, active.id, candidate1);
  } else if (dy !== 0 && canUnitMoveTo(next, active, candidate2)) {
    movedState = moveUnit(next, active.id, candidate2);
    // Update facing based on movement direction
    movedState = updateFacing(movedState, active.id, candidate2);
  }

  movedState = advanceTurn(movedState);
  return movedState;
}

// ----------------------------------------------------------------------------
// BATTLE OUTCOME
// ----------------------------------------------------------------------------

export function evaluateBattleOutcome(state: BattleState): BattleState {
  if (state.phase === "victory" || state.phase === "defeat") {
    return state;
  }

  const units = Object.values(state.units);
  const anyPlayers = units.some(isPlayerUnit);
  const anyEnemies = units.some(isEnemyUnit);

  if (!anyPlayers) {
    return {
      ...state,
      phase: "defeat",
      activeUnitId: null,
      log: [
        ...state.log,
        "SLK//ENGAGE :: Player squad offline. Link severed.",
      ],
    };
  }

 if (!anyEnemies) {
    const rewards = generateBattleRewards(state);
    
    // STEP 7: Build card reward log
    const cardNames = (rewards.cards ?? [])
      .map(id => LIBRARY_CARD_DATABASE[id]?.name ?? id)
      .join(", ");
    const cardLog = rewards.cards && rewards.cards.length > 0 
      ? `SLK//CARDS :: Acquired: ${cardNames}`
      : "";

    return {
      ...state,
      phase: "victory",
      activeUnitId: null,
      rewards,
      log: [
        ...state.log,
        "SLK//ENGAGE :: All hostiles cleared. Engagement complete.",
        `SLK//REWARD :: +${rewards.wad} WAD, +${rewards.metalScrap} Metal Scrap, +${rewards.wood} Wood, +${rewards.chaosShards} Chaos Shards, +${rewards.steamComponents} Steam Components.`,
        ...(cardLog ? [cardLog] : []),
      ],
    };
  }

  return state;
}

function generateBattleRewards(state: BattleState) {
  const enemies = Object.values(state.units).filter(isEnemyUnit);
  const enemyCount = enemies.length || 1;

  // STEP 7: Generate card rewards
  const cardRewards = generateBattleRewardCards(enemyCount);

  return {
    wad: 10 * enemyCount,
    metalScrap: 2 * enemyCount,
    wood: 1 * enemyCount,
    chaosShards: enemyCount >= 2 ? 1 : 0,
    steamComponents: enemyCount >= 2 ? 1 : 0,
    cards: cardRewards,
  };
}

// ----------------------------------------------------------------------------
// CARD DRAW
// ----------------------------------------------------------------------------

export function drawCardsForTurn(
  state: BattleState,
  unit: BattleUnitState,
  handSize: number = 5
): BattleState {
  let u = unit;

  // If deck is empty, reshuffle discard
  if (u.drawPile.length === 0 && u.discardPile.length > 0) {
    u = {
      ...u,
      drawPile: shuffleArray([...u.discardPile]),
      discardPile: [],
    };
  }

  const newHand: CardId[] = [...u.hand];
  const newDraw = [...u.drawPile];

  while (newHand.length < handSize && newDraw.length > 0) {
    newHand.push(newDraw.shift()!);
  }

  const updatedUnit: BattleUnitState = {
    ...u,
    hand: newHand,
    drawPile: newDraw,
  };

  return {
    ...state,
    units: {
      ...state.units,
      [updatedUnit.id]: updatedUnit,
    },
  };
}

// ----------------------------------------------------------------------------
// TEST BATTLE CREATION - WITH EQUIPMENT INTEGRATION
// ----------------------------------------------------------------------------

export function createTestBattleForCurrentParty(
  state: GameState
): BattleState | null {
  const partyIds = state.partyUnitIds;
  if (partyIds.length === 0) return null;

  // Grid sized to fit in battle window while allowing AGI-based movement
  const gridWidth = 8;
  const gridHeight = 6;
  const tiles = createGrid(gridWidth, gridHeight);

  // Get equipment data from state (or use defaults)
  const equipmentById = (state as any).equipmentById || getAllStarterEquipment();
  const modulesById = (state as any).modulesById || getAllModules();

  const units: Record<UnitId, BattleUnitState> = {};

  // Place player units on the left
  partyIds.forEach((id, index) => {
    const base = state.unitsById[id];
    if (!base) return;

    // Pass equipment data to createBattleUnitState
    // Spread units vertically with spacing
    const yPos = Math.min(index * 2, gridHeight - 1);
    units[id] = createBattleUnitState(
      base,
      {
        isEnemy: false,
        pos: { x: 0, y: yPos },
        gearSlots: (state as any).gearSlots ?? {},  // NEW: Pass gear slots
      },
      equipmentById,
      modulesById
    );
  });

  // Dummy enemies (use simple stats, not player equipment)
  const first = state.unitsById[partyIds[0]];
  if (first) {
    const enemyBase = {
      ...first,
      id: "enemy_grunt_1",
      name: "Gate Sentry",
      deck: ["core_basic_attack", "core_basic_attack", "core_guard"],
      stats: { maxHp: 15, atk: 4, def: 2, agi: 3, acc: 75 },
    };

    units["enemy_grunt_1"] = createBattleUnitState(
      enemyBase as any,
      { isEnemy: true, pos: { x: gridWidth - 1, y: 1 } },
      equipmentById,
      modulesById
    );

    units["enemy_grunt_2"] = createBattleUnitState(
      { ...enemyBase, id: "enemy_grunt_2", name: "Gate Sentry" } as any,
      { isEnemy: true, pos: { x: gridWidth - 1, y: 4 } },
      equipmentById,
      modulesById
    );
  }

  const turnOrder = computeTurnOrder(units);
  const activeUnitId = turnOrder[0] ?? null;

  let battle: BattleState = {
    id: "battle_test_1",
    floorId:
      state.operation?.floors[state.operation.currentFloorIndex]?.id ??
      "unknown_floor",
    roomId: state.operation?.currentRoomId ?? "unknown_room",
    gridWidth,
    gridHeight,
    tiles,
    units,
    turnOrder,
    activeUnitId,
    phase: "player_turn",
    turnCount: 1,
    log: [
      `SLK//ENGAGE :: Engagement feed online.`,
      `SLK//ROOM   :: Linked to node ${state.operation?.currentRoomId}.`,
    ],
  };

  // Attach 10za load penalties based on current inventory
  if ((state as any).inventory) {
    const loadPenalties = computeLoadPenaltyFlags(
      (state as any).inventory
    );
    battle.loadPenalties = loadPenalties;

    // MASS overload -> AGI down for all allies at start
    if (loadPenalties.massOver) {
      const newUnits: Record<UnitId, BattleUnitState> = { ...battle.units };
      const allies = Object.values(newUnits).filter((u) => !u.isEnemy);
      for (const ally of allies) {
        const cur = newUnits[ally.id];
        newUnits[ally.id] = {
          ...cur,
          agi: Math.max(1, cur.agi - 1),
        };
      }
      battle = {
        ...battle,
        units: newUnits,
        log: [
          ...battle.log,
          "SLK//LOAD  :: MASS overload - squad AGI reduced.",
        ],
      };
    }
  }

  // Ensure we start on a player-controlled unit
  let guard = 0;
  while (
    battle.activeUnitId &&
    battle.units[battle.activeUnitId].isEnemy &&
    guard < 20
  ) {
    battle = advanceTurn(battle);
    guard++;
  }

  // Starting player unit draws an opening hand
  const firstActive =
    battle.activeUnitId != null ? battle.units[battle.activeUnitId] : null;

  if (firstActive && !firstActive.isEnemy) {
    battle = drawCardsForTurn(battle, firstActive);
    battle = appendBattleLog(
      battle,
      `SLK//UNIT   :: ${firstActive.name} draws opening hand.`
    );
  }

  return battle;
}

// ==========================================
// PLAY CARD FUNCTION
// ==========================================

/**
 * Play a card from a unit's hand onto a target
 */
export function playCard(
  state: BattleState,
  unitId: string,
  cardIndex: number,
  targetId: string
): BattleState {
  // Get units from Record (not array!)
  const unit = state.units[unitId];
  const target = state.units[targetId];

  if (!unit || !target) {
    return appendBattleLog(state, "SLK//ERROR :: Invalid unit or target for card play.");
  }

  const card = unit.hand[cardIndex];
  if (!card) {
    return appendBattleLog(state, "SLK//ERROR :: No card at index " + cardIndex);
  }

  // Get card info (card might be string ID or object)
  const cardName = typeof card === "string" ? card.replace(/^(core_|class_|card_|equip_)/, "").replace(/_/g, " ") : card.name;
  const cardDesc = typeof card === "string" ? "" : (card.description || "").toLowerCase();
  const strainCost = typeof card === "string" ? 1 : (card.strainCost || 1);

  // Create new hand without the played card
  const newHand = [...unit.hand];
  newHand.splice(cardIndex, 1);
  
  // Create new discard with the played card
  const newDiscard = [...unit.discardPile, card];

  // Apply strain
  const newStrain = unit.strain + strainCost;

  // Start building the new unit
  let updatedUnit: BattleUnitState = {
    ...unit,
    hand: newHand,
    discardPile: newDiscard,
    strain: newStrain,
  };

  // Start building updated target (may be same as unit for self-target)
  let updatedTarget: BattleUnitState = targetId === unitId ? updatedUnit : { ...target };

  // Log the card play
  let newLog = [...state.log, `SLK//CARD :: ${unit.name} plays ${cardName} on ${target.name}.`];

  // Process card effects based on description parsing
  // Damage effects
  const dmgMatch = cardDesc.match(/deal\s+(\d+)\s+damage/i);
  if (dmgMatch && targetId !== unitId) {
    const baseDamage = parseInt(dmgMatch[1], 10);
    const finalDamage = Math.max(1, baseDamage + unit.atk - target.def);
    const newHp = Math.max(0, target.hp - finalDamage);
    updatedTarget = { ...updatedTarget, hp: newHp };
    newLog.push(`SLK//DMG :: ${target.name} takes ${finalDamage} damage. (HP: ${newHp}/${target.maxHp})`);

    // Check if target died
    if (newHp <= 0) {
      newLog.push(`SLK//KILL :: ${target.name} has been eliminated!`);
    }
  }

  // Basic attack (no damage in description) - use weapon damage
  if (cardName.toLowerCase().includes("basic attack") && targetId !== unitId) {
    const finalDamage = Math.max(1, unit.atk - target.def);
    const newHp = Math.max(0, target.hp - finalDamage);
    updatedTarget = { ...updatedTarget, hp: newHp };
    newLog.push(`SLK//DMG :: ${target.name} takes ${finalDamage} damage. (HP: ${newHp}/${target.maxHp})`);
    
    if (newHp <= 0) {
      newLog.push(`SLK//KILL :: ${target.name} has been eliminated!`);
    }
  }

  // Healing effects
  const healMatch = cardDesc.match(/restore\s+(\d+)\s+hp/i) || cardDesc.match(/heal\s+(\d+)/i);
  if (healMatch) {
    const healAmount = parseInt(healMatch[1], 10);
    const oldHp = updatedTarget.hp;
    const newHp = Math.min(updatedTarget.maxHp, oldHp + healAmount);
    const actualHeal = newHp - oldHp;
    if (actualHeal > 0) {
      updatedTarget = { ...updatedTarget, hp: newHp };
      newLog.push(`SLK//HEAL :: ${target.name} restores ${actualHeal} HP. (HP: ${newHp}/${target.maxHp})`);
    }
  }

  // Buff effects (DEF)
  const defBuffMatch = cardDesc.match(/\+(\d+)\s+def/i) || cardDesc.match(/gain\s+(\d+)\s+def/i);
  if (defBuffMatch) {
    const buffAmount = parseInt(defBuffMatch[1], 10);
    const newBuffs = [...(updatedTarget.buffs || []), { stat: "def" as const, amount: buffAmount, duration: 1 }];
    updatedTarget = { ...updatedTarget, buffs: newBuffs };
    newLog.push(`SLK//BUFF :: ${target.name} gains +${buffAmount} DEF for 1 turn.`);
  }

  // ATK buff
  const atkBuffMatch = cardDesc.match(/\+(\d+)\s+atk/i) || cardDesc.match(/gain\s+(\d+)\s+atk/i);
  if (atkBuffMatch) {
    const buffAmount = parseInt(atkBuffMatch[1], 10);
    const newBuffs = [...(updatedTarget.buffs || []), { stat: "atk" as const, amount: buffAmount, duration: 1 }];
    updatedTarget = { ...updatedTarget, buffs: newBuffs };
    newLog.push(`SLK//BUFF :: ${target.name} gains +${buffAmount} ATK for 1 turn.`);
  }

  // Build new units Record
  const newUnits = { ...state.units };
  newUnits[unitId] = updatedUnit;
  if (targetId !== unitId) {
    newUnits[targetId] = updatedTarget;
  } else {
    // Self-target: updatedUnit already has the changes
    newUnits[unitId] = updatedTarget;
  }

  // Remove dead units from turn order
  let newTurnOrder = [...state.turnOrder];
  if (updatedTarget.hp <= 0) {
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

/**
 * Alias for drawCardsForTurn for backwards compatibility
 */
export function drawCards(
  state: BattleState,
  unit: BattleUnitState,
  count: number = 5
): BattleState {
  return drawCardsForTurn(state, unit);
}
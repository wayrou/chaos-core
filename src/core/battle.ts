// src/core/battle.ts
import {
  BattleState,
  BattleUnitState,
  CardId,
  GameState,
  TerrainType,
  Tile,
  Unit,
  UnitId,
  Vec2,
} from "./types";

import { computeLoadPenaltyFlags } from "./inventory";

function isPlayerUnit(u: BattleUnitState): boolean {
  return !u.isEnemy;
}

function isEnemyUnit(u: BattleUnitState): boolean {
  return u.isEnemy;
}

/**
 * Small helper to read load penalties off the battle object.
 * We store them as a loose property on the battle state.
 */
function getLoadPenalties(
  state: BattleState
): {
  massOver: boolean;
  bulkOver: boolean;
  powerOver: boolean;
  massPct: number;
  bulkPct: number;
  powerPct: number;
} | null {
  return (state as any).loadPenalties ?? null;
}

/**
 * Create a rectangular grid of tiles for a battle.
 */
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

/**
 * Build a BattleUnitState from a global Unit and placement info.
 */
export function createBattleUnitState(
  base: Unit,
  opts: {
    isEnemy: boolean;
    pos: Vec2 | null;
  }
): BattleUnitState {
  const deck = shuffleArray([...base.deck]);
  const hand: CardId[] = [];
  const discardPile: CardId[] = [];
  const exhaustedPile: CardId[] = [];

  return {
    id: base.id,
    baseUnitId: base.id,
    name: base.name,
    classId: base.classId,
    isEnemy: opts.isEnemy,
    pos: opts.pos,
    hp: base.stats.maxHp,
    maxHp: base.stats.maxHp,
    atk: base.stats.atk,
    def: base.stats.def,
    agi: base.stats.agi,
    acc: base.stats.acc,
    strain: 0,
    drawPile: deck,
    hand,
    discardPile,
    exhaustedPile,
    buffs: [],
  };
}

/**
 * Compute a turn order array based on AGI (descending).
 */
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

/**
 * Base strain threshold; can later be per-class or stat-based.
 */
export const BASE_STRAIN_THRESHOLD = 6;

export function getStrainThreshold(unit: BattleUnitState): number {
  return BASE_STRAIN_THRESHOLD;
}

export function isOverStrainThreshold(unit: BattleUnitState): boolean {
  return unit.strain >= getStrainThreshold(unit);
}

/**
 * Advance to the next unit in the turn order.
 * - Loops if needed
 * - Ticks down buff durations
 * - Auto-draws cards for player units
 * - Cools strain by 1 on the new active unit
 */
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
    const cooledStrain = Math.max(0, oldStrain - 1); // cool by 1 per turn

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
        `${u.name}'s vitals normalize – strain cooling.`
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

  // --- POWER SURGE CHECK (10za POWER overload) ---
  const loadPenalties = getLoadPenalties(newState);
  if (loadPenalties && loadPenalties.powerOver) {
    // 15% chance at the start of each unit's turn
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

/**
 * Helper to log a message in the battle log.
 */
export function appendBattleLog(
  state: BattleState,
  message: string
): BattleState {
  return {
    ...state,
    log: [...state.log, message],
  };
}

/**
 * Get the currently active unit, if any.
 */
export function getActiveUnit(state: BattleState): BattleUnitState | null {
  if (!state.activeUnitId) return null;
  return state.units[state.activeUnitId] ?? null;
}

/**
 * Check if two positions are adjacent in Manhattan distance.
 */
export function arePositionsAdjacent(a: Vec2, b: Vec2): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx + dy === 1;
}

/**
 * Check if a tile is within bounds.
 */
export function isInsideBounds(state: BattleState, pos: Vec2): boolean {
  return (
    pos.x >= 0 &&
    pos.y >= 0 &&
    pos.x < state.gridWidth &&
    pos.y < state.gridHeight
  );
}

/**
 * Check if a tile is walkable (in bounds, not wall, no unit).
 */
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

/**
 * Can this unit move to the given tile?
 * Movement range is up to the unit's AGI (Manhattan distance).
 * (Movement locking is handled in the UI layer, not here.)
 */
export function canUnitMoveTo(
  state: BattleState,
  unit: BattleUnitState,
  dest: Vec2
): boolean {
  if (!unit.pos) return false;

  const dx = Math.abs(unit.pos.x - dest.x);
  const dy = Math.abs(unit.pos.y - dest.y);
  const distance = dx + dy;

  // can't stay in place, can't exceed AGI range
  if (distance === 0 || distance > unit.agi) return false;

  return isWalkableTile(state, dest);
}

/**
 * Move a unit to a destination tile and log it.
 */
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

/**
 * Can attacker attack defender (adjacent, opposite sides)?
 */
export function canUnitAttackTarget(
  attacker: BattleUnitState,
  defender: BattleUnitState
): boolean {
  if (!attacker.pos || !defender.pos) return false;
  if (attacker.isEnemy === defender.isEnemy) return false;
  return arePositionsAdjacent(attacker.pos, defender.pos);
}

/**
 * Compute hit chance based on ACC, with a penalty when over strain threshold.
 * We treat ACC as 0–100 for now.
 */
function computeHitChance(attacker: BattleUnitState): number {
  const baseAcc = attacker.acc ?? 100;
  const penalty = isOverStrainThreshold(attacker) ? 20 : 0; // -20% when strained
  const finalAcc = Math.max(10, Math.min(100, baseAcc - penalty));
  return finalAcc;
}

/**
 * Very simple enemy AI:
 * - If adjacent to a player, basic attack.
 * - Otherwise, step 1 tile toward the nearest player (if possible),
 *   then advance turn.
 */
export function performEnemyTurn(state: BattleState): BattleState {
  const active = getActiveUnit(state);
  if (!active || !active.isEnemy || !active.pos) return state;

  const unitsArray = Object.values(state.units);
  const playerUnits = unitsArray.filter((u) => !u.isEnemy && u.pos);
  if (playerUnits.length === 0) {
    // no players left – nothing to do
    return state;
  }

  // Find nearest player by Manhattan distance
  let target = playerUnits[0]!;
  let bestDist =
    Math.abs(active.pos.x - target.pos!.x) +
    Math.abs(active.pos.y - target.pos!.y);

  for (const u of playerUnits) {
    const d =
      Math.abs(active.pos.x - u.pos!.x) +
      Math.abs(active.pos.y - u.pos!.y);
    if (d < bestDist) {
      bestDist = d;
      target = u;
    }
  }

  let next: BattleState = { ...state };

  // If adjacent, attack once then advance
  if (canUnitAttackTarget(active, target)) {
    next = attackUnit(next, active.id, target.id);
    next = advanceTurn(next);
    return next;
  }

  // Otherwise, try to step 1 tile toward the target
  const dx = Math.sign(target.pos!.x - active.pos.x);
  const dy = Math.sign(target.pos!.y - active.pos.y);

  const candidate1 = { x: active.pos.x + dx, y: active.pos.y };
  const candidate2 = { x: active.pos.x, y: active.pos.y + dy };

  let movedState = next;

  if (dx !== 0 && canUnitMoveTo(next, active, candidate1)) {
    movedState = moveUnit(next, active.id, candidate1);
  } else if (dy !== 0 && canUnitMoveTo(next, active, candidate2)) {
    movedState = moveUnit(next, active.id, candidate2);
  }

  movedState = advanceTurn(movedState);
  return movedState;
}

/**
 * Apply damage from attacker to defender, with accuracy and buffs taken into account.
 * Includes BULK overload jam chance (10za).
 */
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
    const jamChance = Math.min(over, 0.5); // up to 50% jam chance
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

  // DEF buffs (including negative amounts)
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
    // Defender dies
    delete units[defenderId];
    turnOrder = turnOrder.filter((id) => id !== defenderId);
    next = {
      ...next,
      units,
      turnOrder,
    };
    next = appendBattleLog(
      next,
      `SLK//HIT   :: ${attacker.name} hits ${defender.name} for ${damage} • TARGET OFFLINE.`
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

  next = evaluateBattleOutcome(next);
  return next;
}

/**
 * Create a simple test battle.
 * Integrates MASS overload → AGI down at battle start (10za).
 */
export function createTestBattleForCurrentParty(
  state: GameState
): BattleState | null {
  const partyIds = state.partyUnitIds;
  if (partyIds.length === 0) return null;

  const gridWidth = 6;
  const gridHeight = 4;
  const tiles = createGrid(gridWidth, gridHeight);

  const units: Record<UnitId, BattleUnitState> = {};

  // Place player units on the left
  partyIds.forEach((id, index) => {
    const base = state.unitsById[id];
    if (!base) return;

    units[id] = createBattleUnitState(base, {
      isEnemy: false,
      pos: { x: 0, y: Math.min(index, gridHeight - 1) },
    });
  });

  // Dummy enemies
  const first = state.unitsById[partyIds[0]];
  if (first) {
    units["enemy_grunt_1"] = createBattleUnitState(
      { ...first, id: "enemy_grunt_1", name: "Gate Sentry" },
      { isEnemy: true, pos: { x: gridWidth - 1, y: 1 } }
    );

    units["enemy_grunt_2"] = createBattleUnitState(
      { ...first, id: "enemy_grunt_2", name: "Gate Sentry" },
      { isEnemy: true, pos: { x: gridWidth - 1, y: 2 } }
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
    (battle as any).loadPenalties = loadPenalties;

    // MASS overload → AGI down for all allies at start
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
          "SLK//LOAD  :: MASS overload – squad AGI reduced.",
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

/**
 * Draw up to handSize cards for the given unit.
 */
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

/**
 * Apply strain to a unit and log when it crosses the threshold.
 */
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
      `SLK//ALERT :: ${unit.name}'s vitals spike – STRAIN threshold exceeded.`
    );
  }

  return next;
}

/**
 * Check if the battle has been won or lost and, if so,
 * mark phase + attach rewards (for victory).
 */
export function evaluateBattleOutcome(state: BattleState): BattleState {
  if (state.phase === "victory" || state.phase === "defeat") {
    return state;
  }

  const units = Object.values(state.units);
  const anyPlayers = units.some(isPlayerUnit);
  const anyEnemies = units.some(isEnemyUnit);

  // No players left -> defeat
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

  // No enemies left -> victory + rewards
  if (!anyEnemies) {
    const rewards = generateBattleRewards(state);

    return {
      ...state,
      phase: "victory",
      activeUnitId: null,
      rewards,
      log: [
        ...state.log,
        "SLK//ENGAGE :: All hostiles cleared. Engagement complete.",
        `SLK//REWARD :: +${rewards.wad} WAD, +${rewards.metalScrap} Metal Scrap, +${rewards.wood} Wood, +${rewards.chaosShards} Chaos Shards, +${rewards.steamComponents} Steam Components.`,
      ],
    };
  }

  return state;
}

/**
 * Simple reward generator – you can later branch this based
 * on enemy types, floor, difficulty, etc.
 */
function generateBattleRewards(state: BattleState) {
  const enemies = Object.values(state.units).filter(isEnemyUnit);

  // Very simple scaling by enemy count for now:
  const enemyCount = enemies.length || 1;

  return {
    wad: 10 * enemyCount,
    metalScrap: 2 * enemyCount,
    wood: 1 * enemyCount,
    chaosShards: enemyCount >= 2 ? 1 : 0,
    steamComponents: enemyCount >= 2 ? 1 : 0,
  };
}

/**
 * Fisher–Yates shuffle for arrays.
 */
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

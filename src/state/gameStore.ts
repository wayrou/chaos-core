// ============================================================================
// CHAOS CORE - GAME STORE (Headline 12 Compatible)
// Centralized state management - works standalone or with save system
// ============================================================================

import { GameState } from "../core/types";
import { createNewGameState } from "../core/initialState";

// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------

let _gameState: GameState | null = null;

type Listener = (state: GameState) => void;
const listeners = new Set<Listener>();

// ----------------------------------------------------------------------------
// CORE API
// ----------------------------------------------------------------------------

/**
 * Get current game state, lazily creating it if needed
 */
export function getGameState(): GameState {
  if (!_gameState) {
    _gameState = createNewGameState();
  }
  return _gameState;
}

/**
 * Replace the entire game state and notify listeners
 */
export function setGameState(newState: GameState): void {
  _gameState = newState;
  notifyListeners();
}

/**
 * Convenience: update state immutably via an updater.
 */
export function updateGameState(
  updater: (prev: GameState) => GameState
): GameState {
  const prev = getGameState();
  const next = updater(prev);
  setGameState(next);
  return next;
}

/**
 * Subscribe to state changes
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Start a completely new run
 */
export function resetToNewGame(): void {
  const state = createNewGameState();
  setGameState(state);
}

// ----------------------------------------------------------------------------
// LISTENERS
// ----------------------------------------------------------------------------

function notifyListeners(): void {
  const state = getGameState();
  for (const listener of listeners) {
    listener(state);
  }
}

// ----------------------------------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Check if game state exists (has been initialized)
 */
export function hasGameState(): boolean {
  return _gameState !== null;
}

/**
 * Get a specific part of the state (for optimized renders)
 */
export function selectState<T>(selector: (state: GameState) => T): T {
  return selector(getGameState());
}

/**
 * Create a selector that only triggers when selected value changes
 */
export function createSelector<T>(
  selector: (state: GameState) => T,
  onChange: (value: T) => void
): () => void {
  let previousValue: T | undefined;
  
  const listener = (state: GameState) => {
    const newValue = selector(state);
    if (newValue !== previousValue) {
      previousValue = newValue;
      onChange(newValue);
    }
  };
  
  // Initialize with current value
  previousValue = selector(getGameState());
  
  return subscribe(listener);
}

// ----------------------------------------------------------------------------
// PHASE MANAGEMENT
// ----------------------------------------------------------------------------

/**
 * Set the current game phase
 */
export function setPhase(phase: GameState["phase"]): void {
  updateGameState(state => ({
    ...state,
    phase,
  }));
}

/**
 * Get the current game phase
 */
export function getPhase(): GameState["phase"] {
  return getGameState().phase;
}

// ----------------------------------------------------------------------------
// RESOURCE HELPERS
// ----------------------------------------------------------------------------

/**
 * Add resources to the game state
 */
export function addResources(resources: Partial<GameState["resources"]>): void {
  updateGameState(state => ({
    ...state,
    resources: {
      metalScrap: state.resources.metalScrap + (resources.metalScrap ?? 0),
      wood: state.resources.wood + (resources.wood ?? 0),
      chaosShards: state.resources.chaosShards + (resources.chaosShards ?? 0),
      steamComponents: state.resources.steamComponents + (resources.steamComponents ?? 0),
    },
  }));
}

/**
 * Add WAD (currency) to the game state
 */
export function addWad(amount: number): void {
  updateGameState(state => ({
    ...state,
    wad: state.wad + amount,
  }));
}

/**
 * Spend WAD if available
 */
export function spendWad(amount: number): boolean {
  const state = getGameState();
  if (state.wad < amount) {
    return false;
  }
  
  updateGameState(s => ({
    ...s,
    wad: s.wad - amount,
  }));
  
  return true;
}

// ----------------------------------------------------------------------------
// UNIT HELPERS
// ----------------------------------------------------------------------------

/**
 * Get a unit by ID
 */
export function getUnit(unitId: string) {
  return getGameState().unitsById[unitId];
}

/**
 * Get all party units
 */
export function getPartyUnits() {
  const state = getGameState();
  return state.partyUnitIds.map(id => state.unitsById[id]).filter(Boolean);
}

/**
 * Update a specific unit
 */
export function updateUnit(unitId: string, updates: Partial<GameState["unitsById"][string]>): void {
  updateGameState(state => ({
    ...state,
    unitsById: {
      ...state.unitsById,
      [unitId]: {
        ...state.unitsById[unitId],
        ...updates,
      },
    },
  }));
}

// ----------------------------------------------------------------------------
// BATTLE STATE HELPERS
// ----------------------------------------------------------------------------

/**
 * Set the current battle state
 */
export function setBattleState(battle: GameState["currentBattle"]): void {
  updateGameState(state => ({
    ...state,
    currentBattle: battle,
    phase: battle ? "battle" : state.phase,
  }));
}

/**
 * Clear the current battle
 */
export function clearBattle(): void {
  updateGameState(state => ({
    ...state,
    currentBattle: null,
    phase: "shell",
  }));
}

/**
 * Get current battle state
 */
export function getBattleState(): GameState["currentBattle"] {
  return getGameState().currentBattle;
}

// ----------------------------------------------------------------------------
// OPERATION HELPERS
// ----------------------------------------------------------------------------

/**
 * Update operation state
 */
export function updateOperation(updates: Partial<GameState["operation"]>): void {
  updateGameState(state => ({
    ...state,
    operation: {
      ...state.operation,
      ...updates,
    },
  }));
}

/**
 * Set current room in operation
 */
export function setCurrentRoom(roomId: string): void {
  updateOperation({ currentRoomId: roomId });
}
// ============================================================================
// CHAOS CORE - GAME STORE (Headline 12)
// src/state/gameStore.ts
// Centralized state management
// ============================================================================

import { GameState } from "../core/types";
import { createNewGameState } from "../core/initialState";
import { getTechnicaRegistryFingerprint } from "../content/technica";
import { syncPublishedTechnicaContentState } from "../content/technica/stateSync";
import { withNormalizedLobbyState } from "../core/multiplayerLobby";
import { withNormalizedNotesState } from "../core/notesSystem";
import {
  getMountedOrActiveBattleState,
  grantSessionResources,
  mountBattleContextById,
  mountBattleState,
  withNormalizedSessionState,
} from "../core/session";
import { withNormalizedFoundryState } from "../core/foundrySystem";
import { withNormalizedSchemaState } from "../core/schemaSystem";
import { withNormalizedTheaterDeploymentPresetState } from "../core/theaterDeploymentPreset";
import { withNormalizedWeaponsmithState } from "../core/weaponsmith";

// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------

let _gameState: GameState | null = null;

type Listener = (state: GameState) => void;
const listeners = new Set<Listener>();

function syncPublishedTechnicaContent(state: GameState): GameState {
  return syncPublishedTechnicaContentState(state, getTechnicaRegistryFingerprint());
}

function syncSchemaState(state: GameState): GameState {
  const normalizedState = {
    ...state,
    echoRun: state.echoRun ?? null,
  };
  return withNormalizedLobbyState(
    withNormalizedSessionState(
      withNormalizedNotesState(
        withNormalizedFoundryState(
          withNormalizedSchemaState(
            withNormalizedWeaponsmithState(withNormalizedTheaterDeploymentPresetState(normalizedState)),
          ),
        ),
      ),
    ),
  );
}

// ----------------------------------------------------------------------------
// CORE API
// ----------------------------------------------------------------------------

/**
 * Get current game state, lazily creating it if needed
 */
export function getGameState(): GameState {
  if (!_gameState) {
    _gameState = syncSchemaState(syncPublishedTechnicaContent(createNewGameState()));
  } else {
    _gameState = syncSchemaState(syncPublishedTechnicaContent(_gameState));
  }
  return _gameState;
}

/**
 * Replace the entire game state and notify listeners
 */
export function setGameState(newState: GameState): void {
  _gameState = syncSchemaState(syncPublishedTechnicaContent(newState));
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
 * Check if game state exists
 */
export function hasGameState(): boolean {
  return _gameState !== null;
}

/**
 * Get a specific part of the state
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
  
  previousValue = selector(getGameState());
  
  return subscribe(listener);
}

// ----------------------------------------------------------------------------
// PHASE MANAGEMENT
// ----------------------------------------------------------------------------

export function setPhase(phase: GameState["phase"]): void {
  updateGameState(state => ({
    ...state,
    phase,
  }));
}

export function getPhase(): GameState["phase"] {
  return getGameState().phase;
}

// ----------------------------------------------------------------------------
// RESOURCE HELPERS
// ----------------------------------------------------------------------------

export function addResources(resources: Partial<GameState["resources"]>): void {
  updateGameState((state) => grantSessionResources(state, { resources }));
}

export function addWad(amount: number): void {
  updateGameState((state) => grantSessionResources(state, { wad: amount }));
}

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

export function getUnit(unitId: string) {
  return getGameState().unitsById[unitId];
}

export function getPartyUnits() {
  const state = getGameState();
  return state.partyUnitIds.map(id => state.unitsById[id]).filter(Boolean);
}

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

export function setBattleState(battle: GameState["currentBattle"]): void {
  updateGameState(state => mountBattleState(state, battle));
}

export function mountBattleById(battleId: string): GameState["currentBattle"] {
  const nextState = updateGameState((state) => mountBattleContextById(state, battleId));
  return nextState.currentBattle;
}

export function clearBattle(): void {
  updateGameState(state => ({
    ...state,
    currentBattle: null,
    phase: "shell",
  }));
}

export function getBattleState(): GameState["currentBattle"] {
  return getMountedOrActiveBattleState(getGameState());
}

// ----------------------------------------------------------------------------
// OPERATION HELPERS
// ----------------------------------------------------------------------------

export function updateOperation(updates: Partial<NonNullable<GameState["operation"]>>): void {
  const definedUpdates = Object.fromEntries(
    Object.entries(updates as Record<string, unknown>).filter(([, value]) => value !== undefined),
  ) as Partial<NonNullable<GameState["operation"]>>;

  updateGameState(state => ({
    ...state,
    operation: state.operation
      ? ({
          ...state.operation,
          ...definedUpdates,
        } as NonNullable<GameState["operation"]>)
      : state.operation,
  }));
}

export function setCurrentRoom(roomId: string): void {
  updateOperation({ currentRoomId: roomId });
}

// src/state/gameStore.ts
import { GameState } from "../core/types";
import { createNewGameState } from "../core/initialState";

import { getStarterRecipeIds } from "../core/crafting";

let _gameState: GameState | null = null;

type Listener = (state: GameState) => void;
const listeners = new Set<Listener>();

/** Get current game state, lazily creating it if needed */
export function getGameState(): GameState {
  if (!_gameState) {
    _gameState = createNewGameState();
  }
  return _gameState;
}

/** Replace the entire game state and notify listeners */
export function setGameState(newState: GameState) {
  _gameState = newState;
  for (const listener of listeners) {
    listener(newState);
  }
}

/**
 * Convenience: update state immutably via an updater.
 * (We can evolve this into a reducer/dispatch later.)
 */
export function updateGameState(
  updater: (prev: GameState) => GameState
): GameState {
  const prev = getGameState();
  const next = updater(prev);
  setGameState(next);
  return next;
}

/** Subscribe to state changes */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Start a completely new run */
export function resetToNewGame() {
  const state = createNewGameState();
  setGameState(state);
}

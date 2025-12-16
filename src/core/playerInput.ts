// ============================================================================
// PLAYER INPUT ABSTRACTION - Local Co-op
// ============================================================================

import { PlayerId } from "./types";
import { getGameState } from "../state/gameStore";

export interface PlayerInputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean; // Space/Enter for P1, Right Shift/Enter for P2
  cancel: boolean; // Escape/Backspace
  special1: boolean; // Shift for dash, Right Shift for P2 dash
  attack?: boolean; // Space for attack (field nodes)
  interact?: boolean; // E for interact
}

// Global input state tracking
const keyboard1State: PlayerInputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  confirm: false,
  cancel: false,
  special1: false,
  attack: false,
  interact: false,
};

const keyboard2State: PlayerInputState = {
  up: false,
  down: false,
  left: false,
  right: false,
  confirm: false,
  cancel: false,
  special1: false,
  attack: false,
  interact: false,
};

// Key mappings
const KEYBOARD1_MAP: Record<string, keyof PlayerInputState> = {
  "w": "up",
  "W": "up",
  "ArrowUp": "up",
  "s": "down",
  "S": "down",
  "ArrowDown": "down",
  "a": "left",
  "A": "left",
  "ArrowLeft": "left",
  "d": "right",
  "D": "right",
  "ArrowRight": "right",
  " ": "attack", // Space for attack
  "e": "interact", // E for interact
  "E": "interact", // E for interact
  "Enter": "confirm",
  "Escape": "cancel",
  "Shift": "special1",
};

const KEYBOARD2_MAP: Record<string, keyof PlayerInputState> = {
  "ArrowUp": "up",
  "ArrowDown": "down",
  "ArrowLeft": "left",
  "ArrowRight": "right",
  " ": "attack", // Space for attack (P2 can also use space)
  "Enter": "confirm",
  "Backspace": "cancel",
  "Shift": "special1", // Right Shift for P2 dash
};

/**
 * Get input state for a specific player
 */
export function getPlayerInput(playerId: PlayerId): PlayerInputState {
  const state = getGameState();
  const player = state.players[playerId];
  
  if (!player.active) {
    // Return empty input if player is not active
    return {
      up: false,
      down: false,
      left: false,
      right: false,
      confirm: false,
      cancel: false,
      special1: false,
      attack: false,
      interact: false,
    };
  }
  
  switch (player.inputSource) {
    case "keyboard1":
      return { ...keyboard1State };
    case "keyboard2":
      return { ...keyboard2State };
    case "gamepad1":
      // TODO: Implement gamepad support
      return {
        up: false,
        down: false,
        left: false,
        right: false,
        confirm: false,
        cancel: false,
        special1: false,
        attack: false,
        interact: false,
      };
    default:
      return {
        up: false,
        down: false,
        left: false,
        right: false,
        confirm: false,
        cancel: false,
        special1: false,
        attack: false,
        interact: false,
      };
  }
}

/**
 * Handle keydown event and update appropriate input state
 */
export function handleKeyDown(e: KeyboardEvent, playerId?: PlayerId): void {
  const key = e.key;
  
  // If playerId specified, only update that player's input
  if (playerId) {
    const state = getGameState();
    const player = state.players[playerId];
    if (!player.active) return;
    
    const map = player.inputSource === "keyboard1" ? KEYBOARD1_MAP : KEYBOARD2_MAP;
    const inputState = player.inputSource === "keyboard1" ? keyboard1State : keyboard2State;
    
    const action = map[key];
    if (action && inputState.hasOwnProperty(action)) {
      (inputState[action] as boolean) = true;
      e.preventDefault();
    }
    return;
  }
  
  // Otherwise, update both keyboard states
  const action1 = KEYBOARD1_MAP[key];
  if (action1 && keyboard1State.hasOwnProperty(action1)) {
    (keyboard1State[action1] as boolean) = true;
    e.preventDefault();
  }
  
  const action2 = KEYBOARD2_MAP[key];
  if (action2 && keyboard2State.hasOwnProperty(action2)) {
    (keyboard2State[action2] as boolean) = true;
    e.preventDefault();
  }
}

/**
 * Handle keyup event and update appropriate input state
 */
export function handleKeyUp(e: KeyboardEvent, playerId?: PlayerId): void {
  const key = e.key;
  
  // If playerId specified, only update that player's input
  if (playerId) {
    const state = getGameState();
    const player = state.players[playerId];
    if (!player.active) return;
    
    const map = player.inputSource === "keyboard1" ? KEYBOARD1_MAP : KEYBOARD2_MAP;
    const inputState = player.inputSource === "keyboard1" ? keyboard1State : keyboard2State;
    
    const action = map[key];
    if (action && inputState.hasOwnProperty(action)) {
      (inputState[action] as boolean) = false;
    }
    return;
  }
  
  // Otherwise, update both keyboard states
  const action1 = KEYBOARD1_MAP[key];
  if (action1 && keyboard1State.hasOwnProperty(action1)) {
    (keyboard1State[action1] as boolean) = false;
  }
  
  const action2 = KEYBOARD2_MAP[key];
  if (action2 && keyboard2State.hasOwnProperty(action2)) {
    (keyboard2State[action2] as boolean) = false;
  }
}

/**
 * Reset all input states (useful when switching screens)
 */
export function resetPlayerInput(): void {
  Object.keys(keyboard1State).forEach(key => {
    (keyboard1State[key as keyof PlayerInputState] as boolean) = false;
  });
  Object.keys(keyboard2State).forEach(key => {
    (keyboard2State[key as keyof PlayerInputState] as boolean) = false;
  });
}








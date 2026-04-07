// ============================================================================
// PLAYER INPUT ABSTRACTION - Local Co-op
// ============================================================================

import {
  getAssignedGamepad,
  getControllerActionLabel,
  isGamepadActionActive,
  markKeyboardInputActive,
  shouldSuppressGameplayInput,
} from "./controllerSupport";
import { PlayerId, type PlayerInputSource } from "./types";
import { getGameState } from "../state/gameStore";

export interface PlayerInputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  cancel: boolean;
  special1: boolean;
  attack?: boolean;
  interact?: boolean;
}

type InputAction = keyof PlayerInputState;
type KeyboardBinding = {
  codeMap: Partial<Record<string, InputAction>>;
  keyMap: Partial<Record<string, InputAction>>;
};

const EMPTY_INPUT_STATE: PlayerInputState = {
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

const keyboard1State: PlayerInputState = { ...EMPTY_INPUT_STATE };
const keyboard2State: PlayerInputState = { ...EMPTY_INPUT_STATE };

const KEYBOARD1_BINDINGS: KeyboardBinding = {
  codeMap: {
    KeyW: "up",
    KeyS: "down",
    KeyA: "left",
    KeyD: "right",
    Space: "attack",
    KeyE: "interact",
    Enter: "confirm",
    Escape: "cancel",
    ShiftLeft: "special1",
  },
  keyMap: {
    w: "up",
    W: "up",
    s: "down",
    S: "down",
    a: "left",
    A: "left",
    d: "right",
    D: "right",
    " ": "attack",
    e: "interact",
    E: "interact",
    Enter: "confirm",
    Escape: "cancel",
  },
};

const KEYBOARD2_BINDINGS: KeyboardBinding = {
  codeMap: {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    Numpad0: "attack",
    Slash: "interact",
    ControlRight: "interact",
    NumpadEnter: "confirm",
    Backspace: "cancel",
    ShiftRight: "special1",
  },
  keyMap: {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    "/": "interact",
    Backspace: "cancel",
  },
};

function getBindingForSource(inputSource: PlayerInputSource): KeyboardBinding | null {
  switch (inputSource) {
    case "keyboard1":
      return KEYBOARD1_BINDINGS;
    case "keyboard2":
      return KEYBOARD2_BINDINGS;
    default:
      return null;
  }
}

function resolveKeyboardAction(
  event: Pick<KeyboardEvent, "code" | "key">,
  bindings: KeyboardBinding,
): InputAction | null {
  return bindings.codeMap[event.code] ?? bindings.keyMap[event.key] ?? null;
}

function updateKeyboardInputState(
  inputState: PlayerInputState,
  action: InputAction | null,
  isPressed: boolean,
): void {
  if (!action || !Object.prototype.hasOwnProperty.call(inputState, action)) {
    return;
  }
  (inputState[action] as boolean) = isPressed;
}

function readGamepadInput(playerId: PlayerId): PlayerInputState {
  const gamepad = getAssignedGamepad(playerId);
  if (!gamepad || shouldSuppressGameplayInput(playerId)) {
    return { ...EMPTY_INPUT_STATE };
  }

  return {
    up: isGamepadActionActive(playerId, "moveUp"),
    down: isGamepadActionActive(playerId, "moveDown"),
    left: isGamepadActionActive(playerId, "moveLeft"),
    right: isGamepadActionActive(playerId, "moveRight"),
    confirm: isGamepadActionActive(playerId, "confirm"),
    cancel: isGamepadActionActive(playerId, "cancel"),
    special1: isGamepadActionActive(playerId, "tabPrev") || isGamepadActionActive(playerId, "tabNext"),
    attack: isGamepadActionActive(playerId, "attack"),
    interact: isGamepadActionActive(playerId, "interact"),
  };
}

function mergeInputStates(baseState: PlayerInputState, overlayState: PlayerInputState): PlayerInputState {
  return {
    up: baseState.up || overlayState.up,
    down: baseState.down || overlayState.down,
    left: baseState.left || overlayState.left,
    right: baseState.right || overlayState.right,
    confirm: baseState.confirm || overlayState.confirm,
    cancel: baseState.cancel || overlayState.cancel,
    special1: baseState.special1 || overlayState.special1,
    attack: Boolean(baseState.attack || overlayState.attack),
    interact: Boolean(baseState.interact || overlayState.interact),
  };
}

export function getPlayerInput(playerId: PlayerId): PlayerInputState {
  const state = getGameState();
  const player = state.players[playerId];

  if (!player.active) {
    return { ...EMPTY_INPUT_STATE };
  }

  let inputState: PlayerInputState;

  switch (player.inputSource) {
    case "keyboard1":
      inputState = { ...keyboard1State };
      break;
    case "keyboard2":
      inputState = { ...keyboard2State };
      break;
    case "gamepad1":
    case "gamepad2":
      inputState = readGamepadInput(playerId);
      break;
    default:
      inputState = { ...EMPTY_INPUT_STATE };
      break;
  }

  if (getAssignedGamepad(playerId)) {
    return mergeInputStates(inputState, readGamepadInput(playerId));
  }

  return inputState;
}

export function isPlayerInputActionEvent(
  event: Pick<KeyboardEvent, "code" | "key">,
  playerId: PlayerId,
  action: InputAction,
): boolean {
  const state = getGameState();
  const player = state.players[playerId];
  const bindings = getBindingForSource(player.inputSource);
  if (!bindings) {
    return false;
  }

  return resolveKeyboardAction(event, bindings) === action;
}

export function handleKeyDown(e: KeyboardEvent, playerId?: PlayerId): void {
  markKeyboardInputActive();
  const state = getGameState();

  if (playerId) {
    const player = state.players[playerId];
    if (!player.active) return;

    const bindings = getBindingForSource(player.inputSource);
    if (!bindings) return;

    const inputState = player.inputSource === "keyboard1" ? keyboard1State : keyboard2State;
    const action = resolveKeyboardAction(e, bindings);
    updateKeyboardInputState(inputState, action, true);
    if (action) {
      e.preventDefault();
    }
    return;
  }

  const p1Bindings = getBindingForSource(state.players.P1.inputSource);
  const p2Bindings = getBindingForSource(state.players.P2.inputSource);
  const p1Action = p1Bindings ? resolveKeyboardAction(e, p1Bindings) : null;
  const p2Action = p2Bindings ? resolveKeyboardAction(e, p2Bindings) : null;

  updateKeyboardInputState(keyboard1State, p1Action, true);
  updateKeyboardInputState(keyboard2State, p2Action, true);

  if (p1Action || p2Action) {
    e.preventDefault();
  }
}

export function handleKeyUp(e: KeyboardEvent, playerId?: PlayerId): void {
  const state = getGameState();

  if (playerId) {
    const player = state.players[playerId];
    if (!player.active) return;

    const bindings = getBindingForSource(player.inputSource);
    if (!bindings) return;

    const inputState = player.inputSource === "keyboard1" ? keyboard1State : keyboard2State;
    const action = resolveKeyboardAction(e, bindings);
    updateKeyboardInputState(inputState, action, false);
    return;
  }

  const p1Bindings = getBindingForSource(state.players.P1.inputSource);
  const p2Bindings = getBindingForSource(state.players.P2.inputSource);
  const p1Action = p1Bindings ? resolveKeyboardAction(e, p1Bindings) : null;
  const p2Action = p2Bindings ? resolveKeyboardAction(e, p2Bindings) : null;

  updateKeyboardInputState(keyboard1State, p1Action, false);
  updateKeyboardInputState(keyboard2State, p2Action, false);
}

export function resetPlayerInput(): void {
  Object.keys(keyboard1State).forEach((key) => {
    (keyboard1State[key as keyof PlayerInputState] as boolean) = false;
  });
  Object.keys(keyboard2State).forEach((key) => {
    (keyboard2State[key as keyof PlayerInputState] as boolean) = false;
  });
}

function getKeyboardActionLabelForSource(inputSource: PlayerInputSource, action: InputAction): string {
  if (inputSource === "keyboard2") {
    switch (action) {
      case "up":
        return "UP";
      case "down":
        return "DOWN";
      case "left":
        return "LEFT";
      case "right":
        return "RIGHT";
      case "confirm":
        return "NUM ENTER";
      case "cancel":
        return "BACKSPACE";
      case "special1":
        return "SHIFT";
      case "attack":
        return "NUM 0";
      case "interact":
        return "/";
      default:
        return String(action).toUpperCase();
    }
  }

  switch (action) {
    case "up":
      return "W";
    case "down":
      return "S";
    case "left":
      return "A";
    case "right":
      return "D";
    case "confirm":
      return "ENTER";
    case "cancel":
      return "ESC";
    case "special1":
      return "SHIFT";
    case "attack":
      return "SPACE";
    case "interact":
      return "E";
    default:
      return String(action).toUpperCase();
  }
}

function mapInputActionToControllerAction(action: InputAction): Parameters<typeof getControllerActionLabel>[0] {
  switch (action) {
    case "up":
      return "moveUp";
    case "down":
      return "moveDown";
    case "left":
      return "moveLeft";
    case "right":
      return "moveRight";
    case "confirm":
      return "confirm";
    case "cancel":
      return "cancel";
    case "special1":
      return "tabNext";
    case "attack":
      return "attack";
    case "interact":
      return "interact";
  }
}

export function getPlayerActionLabel(playerId: PlayerId, action: InputAction): string {
  if (getAssignedGamepad(playerId)) {
    return getControllerActionLabel(mapInputActionToControllerAction(action));
  }

  const player = getGameState().players[playerId];
  return getKeyboardActionLabelForSource(player.inputSource, action);
}

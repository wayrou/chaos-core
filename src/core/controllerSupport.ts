// ============================================================================
// CHAOS CORE - CONTROLLER SUPPORT (Headline 12b)
// src/core/controllerSupport.ts
// Gamepad input handling for full controller support
// ============================================================================

import { getSettings, subscribeToSettings } from "./settings";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export interface ControllerState {
  connected: boolean;
  id: string;
  buttons: ButtonState[];
  axes: number[];
}

export interface ButtonState {
  pressed: boolean;
  value: number;
  justPressed: boolean;
  justReleased: boolean;
}

// Standard gamepad button indices
export const BUTTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
} as const;

// Axis indices
export const AXIS = {
  LEFT_X: 0,
  LEFT_Y: 1,
  RIGHT_X: 2,
  RIGHT_Y: 3,
} as const;

// Input actions
export type GameAction =
  | "confirm"
  | "cancel"
  | "menu"
  | "moveUp"
  | "moveDown"
  | "moveLeft"
  | "moveRight"
  | "nextUnit"
  | "prevUnit"
  | "endTurn"
  | "openInventory"
  | "openMap"
  | "pause";

// Default button bindings
export const DEFAULT_BINDINGS: Record<GameAction, number[]> = {
  confirm: [BUTTON.A],
  cancel: [BUTTON.B],
  menu: [BUTTON.START],
  moveUp: [BUTTON.DPAD_UP],
  moveDown: [BUTTON.DPAD_DOWN],
  moveLeft: [BUTTON.DPAD_LEFT],
  moveRight: [BUTTON.DPAD_RIGHT],
  nextUnit: [BUTTON.RB],
  prevUnit: [BUTTON.LB],
  endTurn: [BUTTON.Y],
  openInventory: [BUTTON.SELECT],
  openMap: [BUTTON.X],
  pause: [BUTTON.START],
};

// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------

let isEnabled = true;
let deadzone = 0.15;
let vibrationEnabled = true;
let currentBindings = { ...DEFAULT_BINDINGS };
let prevButtonStates: boolean[] = new Array(16).fill(false);

type ActionListener = (action: GameAction) => void;
const actionListeners = new Set<ActionListener>();

let navCooldown = 0;
const NAV_COOLDOWN_MS = 150;

let focusableElements: HTMLElement[] = [];
let currentFocusIndex = 0;

// ----------------------------------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------------------------------

let animationFrameId: number | null = null;
let lastFrameTime = 0;
let initialized = false;

/**
 * Initialize controller support
 */
export function initControllerSupport(): void {
  if (initialized) return;
  
  try {
    const settings = getSettings();
    isEnabled = settings.controllerEnabled;
    vibrationEnabled = settings.controllerVibration;
    deadzone = settings.controllerDeadzone / 100;
  } catch {
    // Settings not initialized yet, use defaults
  }
  
  subscribeToSettings((newSettings) => {
    isEnabled = newSettings.controllerEnabled;
    vibrationEnabled = newSettings.controllerVibration;
    deadzone = newSettings.controllerDeadzone / 100;
  });
  
  window.addEventListener("gamepadconnected", onGamepadConnected);
  window.addEventListener("gamepaddisconnected", onGamepadDisconnected);
  
  startPolling();
  initialized = true;
  
  console.log("[CONTROLLER] Initialized");
}

/**
 * Shutdown controller support
 */
export function shutdownControllerSupport(): void {
  stopPolling();
  window.removeEventListener("gamepadconnected", onGamepadConnected);
  window.removeEventListener("gamepaddisconnected", onGamepadDisconnected);
  initialized = false;
}

// ----------------------------------------------------------------------------
// POLLING
// ----------------------------------------------------------------------------

function startPolling(): void {
  if (animationFrameId !== null) return;
  lastFrameTime = performance.now();
  pollLoop();
}

function stopPolling(): void {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function pollLoop(): void {
  animationFrameId = requestAnimationFrame(pollLoop);
  
  if (!isEnabled) return;
  
  const now = performance.now();
  const deltaTime = now - lastFrameTime;
  lastFrameTime = now;
  
  if (navCooldown > 0) {
    navCooldown = Math.max(0, navCooldown - deltaTime);
  }
  
  const gamepads = navigator.getGamepads();
  
  for (const gamepad of gamepads) {
    if (gamepad) {
      processGamepad(gamepad);
    }
  }
}

// ----------------------------------------------------------------------------
// GAMEPAD PROCESSING
// ----------------------------------------------------------------------------

function processGamepad(gamepad: Gamepad): void {
  const buttons = gamepad.buttons;
  
  for (let i = 0; i < buttons.length; i++) {
    const pressed = buttons[i].pressed;
    const wasPressed = prevButtonStates[i];
    
    if (pressed && !wasPressed) {
      handleButtonPress(i);
    }
    
    prevButtonStates[i] = pressed;
  }
  
  processAxesNavigation(gamepad.axes);
}

function handleButtonPress(buttonIndex: number): void {
  for (const [action, buttons] of Object.entries(currentBindings)) {
    if (buttons.includes(buttonIndex)) {
      triggerAction(action as GameAction);
    }
  }
}

function processAxesNavigation(axes: readonly number[]): void {
  if (navCooldown > 0) return;
  
  const leftX = axes[AXIS.LEFT_X] ?? 0;
  const leftY = axes[AXIS.LEFT_Y] ?? 0;
  
  const processedX = Math.abs(leftX) > deadzone ? leftX : 0;
  const processedY = Math.abs(leftY) > deadzone ? leftY : 0;
  
  if (Math.abs(processedX) > Math.abs(processedY)) {
    if (processedX > 0.5) {
      triggerAction("moveRight");
      navCooldown = NAV_COOLDOWN_MS;
    } else if (processedX < -0.5) {
      triggerAction("moveLeft");
      navCooldown = NAV_COOLDOWN_MS;
    }
  } else {
    if (processedY > 0.5) {
      triggerAction("moveDown");
      navCooldown = NAV_COOLDOWN_MS;
    } else if (processedY < -0.5) {
      triggerAction("moveUp");
      navCooldown = NAV_COOLDOWN_MS;
    }
  }
}

// ----------------------------------------------------------------------------
// ACTION HANDLING
// ----------------------------------------------------------------------------

function triggerAction(action: GameAction): void {
  console.log(`[CONTROLLER] Action: ${action}`);
  
  if (handleUIAction(action)) {
    return;
  }
  
  for (const listener of actionListeners) {
    listener(action);
  }
}

function handleUIAction(action: GameAction): boolean {
  switch (action) {
    case "moveUp":
      navigateFocus(-1);
      return true;
    case "moveDown":
      navigateFocus(1);
      return true;
    case "confirm":
      activateFocusedElement();
      return true;
    default:
      return false;
  }
}

// ----------------------------------------------------------------------------
// UI FOCUS NAVIGATION
// ----------------------------------------------------------------------------

/**
 * Update the list of focusable elements
 */
export function updateFocusableElements(): void {
  focusableElements = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), a[href]'
    )
  );
  
  focusableElements.forEach((el, index) => {
    el.classList.add("controller-focusable");
    el.dataset.focusIndex = String(index);
  });
  
  if (focusableElements.length > 0 && !document.activeElement?.classList.contains("controller-focusable")) {
    currentFocusIndex = 0;
    setFocus(0);
  }
}

function navigateFocus(delta: number): void {
  if (focusableElements.length === 0) {
    updateFocusableElements();
  }
  
  if (focusableElements.length === 0) return;
  
  const newIndex = (currentFocusIndex + delta + focusableElements.length) % focusableElements.length;
  setFocus(newIndex);
}

function setFocus(index: number): void {
  focusableElements.forEach(el => el.classList.remove("controller-focused"));
  
  currentFocusIndex = index;
  const element = focusableElements[index];
  
  if (element) {
    element.classList.add("controller-focused");
    element.focus();
    element.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function activateFocusedElement(): void {
  const element = focusableElements[currentFocusIndex];
  
  if (element) {
    element.click();
    vibrate(50);
  }
}

// ----------------------------------------------------------------------------
// VIBRATION
// ----------------------------------------------------------------------------

/**
 * Trigger controller vibration
 */
export function vibrate(durationMs: number, intensity: number = 1.0): void {
  if (!vibrationEnabled) return;
  
  const gamepads = navigator.getGamepads();
  
  for (const gamepad of gamepads) {
    if (gamepad?.vibrationActuator) {
      gamepad.vibrationActuator.playEffect("dual-rumble", {
        startDelay: 0,
        duration: durationMs,
        weakMagnitude: intensity * 0.5,
        strongMagnitude: intensity,
      }).catch(() => {});
    }
  }
}

/**
 * Vibration patterns
 */
export const VIBRATION_PATTERNS = {
  confirm: () => vibrate(50, 0.3),
  cancel: () => vibrate(30, 0.2),
  hit: () => vibrate(100, 0.7),
  criticalHit: () => vibrate(200, 1.0),
  damage: () => vibrate(150, 0.8),
  error: () => {
    vibrate(50, 0.5);
    setTimeout(() => vibrate(50, 0.5), 100);
  },
};

// ----------------------------------------------------------------------------
// EVENT HANDLERS
// ----------------------------------------------------------------------------

function onGamepadConnected(event: GamepadEvent): void {
  console.log(`[CONTROLLER] Connected: ${event.gamepad.id}`);
  updateFocusableElements();
  vibrate(100, 0.5);
}

function onGamepadDisconnected(event: GamepadEvent): void {
  console.log(`[CONTROLLER] Disconnected: ${event.gamepad.id}`);
  document.querySelectorAll(".controller-focused").forEach(el => {
    el.classList.remove("controller-focused");
  });
}

// ----------------------------------------------------------------------------
// PUBLIC API
// ----------------------------------------------------------------------------

/**
 * Subscribe to controller actions
 */
export function onControllerAction(listener: ActionListener): () => void {
  actionListeners.add(listener);
  return () => actionListeners.delete(listener);
}

/**
 * Check if a controller is connected
 */
export function isControllerConnected(): boolean {
  const gamepads = navigator.getGamepads();
  return gamepads.some(gp => gp !== null);
}

/**
 * Get connected controllers
 */
export function getConnectedControllers(): ControllerState[] {
  const gamepads = navigator.getGamepads();
  const controllers: ControllerState[] = [];
  
  for (const gamepad of gamepads) {
    if (gamepad) {
      controllers.push({
        connected: true,
        id: gamepad.id,
        buttons: gamepad.buttons.map((btn, i) => ({
          pressed: btn.pressed,
          value: btn.value,
          justPressed: btn.pressed && !prevButtonStates[i],
          justReleased: !btn.pressed && prevButtonStates[i],
        })),
        axes: [...gamepad.axes],
      });
    }
  }
  
  return controllers;
}

/**
 * Get button bindings
 */
export function getButtonBindings(): Record<GameAction, number[]> {
  return { ...currentBindings };
}

/**
 * Get button name
 */
export function getButtonName(buttonIndex: number): string {
  const names: Record<number, string> = {
    [BUTTON.A]: "A",
    [BUTTON.B]: "B",
    [BUTTON.X]: "X",
    [BUTTON.Y]: "Y",
    [BUTTON.LB]: "LB",
    [BUTTON.RB]: "RB",
    [BUTTON.LT]: "LT",
    [BUTTON.RT]: "RT",
    [BUTTON.SELECT]: "Select",
    [BUTTON.START]: "Start",
    [BUTTON.L3]: "L3",
    [BUTTON.R3]: "R3",
    [BUTTON.DPAD_UP]: "D-Up",
    [BUTTON.DPAD_DOWN]: "D-Down",
    [BUTTON.DPAD_LEFT]: "D-Left",
    [BUTTON.DPAD_RIGHT]: "D-Right",
  };
  return names[buttonIndex] ?? `Button ${buttonIndex}`;
}

/**
 * Get action name
 */
export function getActionName(action: GameAction): string {
  const names: Record<GameAction, string> = {
    confirm: "Confirm",
    cancel: "Cancel / Back",
    menu: "Menu",
    moveUp: "Navigate Up",
    moveDown: "Navigate Down",
    moveLeft: "Navigate Left",
    moveRight: "Navigate Right",
    nextUnit: "Next Unit",
    prevUnit: "Previous Unit",
    endTurn: "End Turn",
    openInventory: "Inventory",
    openMap: "Map",
    pause: "Pause",
  };
  return names[action] ?? action;
}
// ============================================================================
// CHAOS CORE - CONTROLLER SUPPORT (Headline 12b)
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
  A: 0,           // Bottom face button (confirm)
  B: 1,           // Right face button (cancel/back)
  X: 2,           // Left face button
  Y: 3,           // Top face button
  LB: 4,          // Left bumper
  RB: 5,          // Right bumper
  LT: 6,          // Left trigger
  RT: 7,          // Right trigger
  SELECT: 8,      // Select/Back
  START: 9,       // Start/Menu
  L3: 10,         // Left stick press
  R3: 11,         // Right stick press
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

// Input actions that can be bound
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

// Previous frame's button states (for edge detection)
let prevButtonStates: boolean[] = new Array(16).fill(false);

// Action listeners
type ActionListener = (action: GameAction) => void;
const actionListeners = new Set<ActionListener>();

// Navigation state for UI
let navCooldown = 0;
const NAV_COOLDOWN_MS = 150; // Prevent too-fast navigation

// Focused element tracking for UI navigation
let focusableElements: HTMLElement[] = [];
let currentFocusIndex = 0;

// ----------------------------------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------------------------------

let animationFrameId: number | null = null;
let lastFrameTime = 0;

/**
 * Initialize controller support
 */
export function initControllerSupport(): void {
  // Load settings
  const settings = getSettings();
  isEnabled = settings.controllerEnabled;
  vibrationEnabled = settings.controllerVibration;
  deadzone = settings.controllerDeadzone / 100;
  
  // Subscribe to settings changes
  subscribeToSettings((newSettings) => {
    isEnabled = newSettings.controllerEnabled;
    vibrationEnabled = newSettings.controllerVibration;
    deadzone = newSettings.controllerDeadzone / 100;
  });
  
  // Listen for gamepad connect/disconnect
  window.addEventListener("gamepadconnected", onGamepadConnected);
  window.addEventListener("gamepaddisconnected", onGamepadDisconnected);
  
  // Start polling loop
  startPolling();
  
  console.log("[CONTROLLER] Initialized");
}

/**
 * Shutdown controller support
 */
export function shutdownControllerSupport(): void {
  stopPolling();
  window.removeEventListener("gamepadconnected", onGamepadConnected);
  window.removeEventListener("gamepaddisconnected", onGamepadDisconnected);
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
  
  // Update navigation cooldown
  if (navCooldown > 0) {
    navCooldown = Math.max(0, navCooldown - deltaTime);
  }
  
  // Get gamepads
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
  // Process buttons
  const buttons = gamepad.buttons;
  
  for (let i = 0; i < buttons.length; i++) {
    const pressed = buttons[i].pressed;
    const wasPressed = prevButtonStates[i];
    
    // Detect just pressed
    if (pressed && !wasPressed) {
      handleButtonPress(i);
    }
    
    prevButtonStates[i] = pressed;
  }
  
  // Process axes for navigation
  processAxesNavigation(gamepad.axes);
}

function handleButtonPress(buttonIndex: number): void {
  // Find which action this button is bound to
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
  
  // Apply deadzone
  const processedX = Math.abs(leftX) > deadzone ? leftX : 0;
  const processedY = Math.abs(leftY) > deadzone ? leftY : 0;
  
  // Determine direction
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
  
  // Handle UI navigation actions
  if (handleUIAction(action)) {
    return;
  }
  
  // Notify listeners
  for (const listener of actionListeners) {
    listener(action);
  }
}

function handleUIAction(action: GameAction): boolean {
  switch (action) {
    case "moveUp":
      navigateFocus(-1, "vertical");
      return true;
    case "moveDown":
      navigateFocus(1, "vertical");
      return true;
    case "moveLeft":
      navigateFocus(-1, "horizontal");
      return true;
    case "moveRight":
      navigateFocus(1, "horizontal");
      return true;
    case "confirm":
      activateFocusedElement();
      return true;
    case "cancel":
      // Let the listener handle cancel
      return false;
    default:
      return false;
  }
}

// ----------------------------------------------------------------------------
// UI FOCUS NAVIGATION
// ----------------------------------------------------------------------------

/**
 * Update the list of focusable elements (call when screen changes)
 */
export function updateFocusableElements(): void {
  focusableElements = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), a[href]'
    )
  );
  
  // Add controller-focusable class to all
  focusableElements.forEach((el, index) => {
    el.classList.add("controller-focusable");
    el.dataset.focusIndex = String(index);
  });
  
  // Focus first element if nothing focused
  if (focusableElements.length > 0 && !document.activeElement?.classList.contains("controller-focusable")) {
    currentFocusIndex = 0;
    setFocus(0);
  }
}

function navigateFocus(delta: number, direction: "vertical" | "horizontal"): void {
  if (focusableElements.length === 0) {
    updateFocusableElements();
  }
  
  if (focusableElements.length === 0) return;
  
  // Simple linear navigation for now
  const newIndex = (currentFocusIndex + delta + focusableElements.length) % focusableElements.length;
  setFocus(newIndex);
}

function setFocus(index: number): void {
  // Remove previous focus indicator
  focusableElements.forEach(el => el.classList.remove("controller-focused"));
  
  // Set new focus
  currentFocusIndex = index;
  const element = focusableElements[index];
  
  if (element) {
    element.classList.add("controller-focused");
    element.focus();
    
    // Scroll into view if needed
    element.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function activateFocusedElement(): void {
  const element = focusableElements[currentFocusIndex];
  
  if (element) {
    // Trigger click
    element.click();
    
    // Provide haptic feedback
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
      }).catch(() => {
        // Vibration not supported, ignore
      });
    }
  }
}

/**
 * Vibration patterns for different events
 */
export const VIBRATION_PATTERNS = {
  confirm: () => vibrate(50, 0.3),
  cancel: () => vibrate(30, 0.2),
  hit: () => vibrate(100, 0.7),
  criticalHit: () => vibrate(200, 1.0),
  damage: () => vibrate(150, 0.8),
  levelUp: () => {
    vibrate(100, 0.5);
    setTimeout(() => vibrate(100, 0.5), 150);
    setTimeout(() => vibrate(200, 0.8), 300);
  },
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
  
  // Update focusable elements when controller connects
  updateFocusableElements();
  
  // Vibrate to confirm connection
  vibrate(100, 0.5);
}

function onGamepadDisconnected(event: GamepadEvent): void {
  console.log(`[CONTROLLER] Disconnected: ${event.gamepad.id}`);
  
  // Remove controller focus indicators
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
 * Get information about connected controllers
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
 * Update button bindings
 */
export function setButtonBinding(action: GameAction, buttons: number[]): void {
  currentBindings[action] = buttons;
}

/**
 * Get current button bindings
 */
export function getButtonBindings(): Record<GameAction, number[]> {
  return { ...currentBindings };
}

/**
 * Reset bindings to defaults
 */
export function resetBindings(): void {
  currentBindings = { ...DEFAULT_BINDINGS };
}

/**
 * Get button name for display
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
    [BUTTON.DPAD_UP]: "D-Pad Up",
    [BUTTON.DPAD_DOWN]: "D-Pad Down",
    [BUTTON.DPAD_LEFT]: "D-Pad Left",
    [BUTTON.DPAD_RIGHT]: "D-Pad Right",
  };
  
  return names[buttonIndex] ?? `Button ${buttonIndex}`;
}

/**
 * Get action display name
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
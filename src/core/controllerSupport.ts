// ============================================================================
// CHAOS CORE - CONTROLLER SUPPORT
// Shared controller runtime for UI focus, grid/map cursors, layout mode, and
// gameplay input bindings.
// ============================================================================

import {
  DEFAULT_SETTINGS,
  type ControllerActionBindingMap,
  type ControllerAssignmentSettings,
  type ControllerBindingDescriptor,
  getSettings,
  subscribeToSettings,
} from "./settings";
import type { PlayerSlot } from "./types";

export interface ControllerState {
  connected: boolean;
  id: string;
  index: number;
  assignedPlayer: PlayerSlot | null;
  buttons: ButtonState[];
  axes: number[];
}

export interface ButtonState {
  pressed: boolean;
  value: number;
  justPressed: boolean;
  justReleased: boolean;
}

export type ControllerMode = "focus" | "cursor" | "layout";
export type ControllerInputMode = "keyboard" | "controller";

export interface ControllerDebugState {
  focus?: string;
  hovered?: string;
  window?: string;
  x?: number;
  y?: number;
}

export interface ControllerContext {
  id: string;
  defaultMode?: ControllerMode;
  focusRoot?: HTMLElement | null | (() => HTMLElement | null);
  focusSelector?: string;
  defaultFocusSelector?: string;
  onAction?: (action: GameAction, playerId?: PlayerSlot, mode?: ControllerMode) => boolean;
  onFocusAction?: (action: GameAction, playerId?: PlayerSlot) => boolean;
  onCursorAction?: (action: GameAction, playerId?: PlayerSlot) => boolean;
  onLayoutAction?: (action: GameAction, playerId?: PlayerSlot) => boolean;
  onModeChange?: (mode: ControllerMode) => void;
  suppressGameplayInput?: boolean | ((playerId?: PlayerSlot, mode?: ControllerMode) => boolean);
  getDebugState?: () => ControllerDebugState;
}

export interface ControllerBindingCapture {
  onCapture: (binding: ControllerBindingDescriptor) => void;
  onCancel?: () => void;
}

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

export const AXIS = {
  LEFT_X: 0,
  LEFT_Y: 1,
  RIGHT_X: 2,
  RIGHT_Y: 3,
} as const;

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
  | "pause"
  | "attack"
  | "interact"
  | "dash"
  | "tabPrev"
  | "tabNext"
  | "zoomIn"
  | "zoomOut"
  | "toggleSurfaceMode"
  | "toggleLayoutMode"
  | "windowPrimary"
  | "windowSecondary";

export const GAME_ACTIONS: GameAction[] = [
  "confirm",
  "cancel",
  "menu",
  "moveUp",
  "moveDown",
  "moveLeft",
  "moveRight",
  "nextUnit",
  "prevUnit",
  "endTurn",
  "openInventory",
  "openMap",
  "pause",
  "attack",
  "interact",
  "dash",
  "tabPrev",
  "tabNext",
  "zoomIn",
  "zoomOut",
  "toggleSurfaceMode",
  "toggleLayoutMode",
  "windowPrimary",
  "windowSecondary",
];

export const DEFAULT_CONTROLLER_BINDINGS: Record<GameAction, ControllerBindingDescriptor[]> = {
  confirm: [{ kind: "button", code: BUTTON.A }],
  cancel: [{ kind: "button", code: BUTTON.B }],
  menu: [{ kind: "button", code: BUTTON.START }],
  moveUp: [
    { kind: "button", code: BUTTON.DPAD_UP },
    { kind: "axis", code: AXIS.LEFT_Y, direction: "negative", threshold: 0.35 },
  ],
  moveDown: [
    { kind: "button", code: BUTTON.DPAD_DOWN },
    { kind: "axis", code: AXIS.LEFT_Y, direction: "positive", threshold: 0.35 },
  ],
  moveLeft: [
    { kind: "button", code: BUTTON.DPAD_LEFT },
    { kind: "axis", code: AXIS.LEFT_X, direction: "negative", threshold: 0.35 },
  ],
  moveRight: [
    { kind: "button", code: BUTTON.DPAD_RIGHT },
    { kind: "axis", code: AXIS.LEFT_X, direction: "positive", threshold: 0.35 },
  ],
  nextUnit: [{ kind: "button", code: BUTTON.RB }],
  prevUnit: [{ kind: "button", code: BUTTON.LB }],
  endTurn: [{ kind: "button", code: BUTTON.Y }],
  openInventory: [{ kind: "button", code: BUTTON.SELECT }],
  openMap: [{ kind: "button", code: BUTTON.X }],
  pause: [{ kind: "button", code: BUTTON.START }],
  attack: [{ kind: "button", code: BUTTON.A }],
  interact: [{ kind: "button", code: BUTTON.X }],
  dash: [{ kind: "button", code: BUTTON.RB }],
  tabPrev: [{ kind: "button", code: BUTTON.LB }],
  tabNext: [{ kind: "button", code: BUTTON.RB }],
  zoomIn: [{ kind: "button", code: BUTTON.RT }],
  zoomOut: [{ kind: "button", code: BUTTON.LT }],
  toggleSurfaceMode: [{ kind: "button", code: BUTTON.L3 }],
  toggleLayoutMode: [{ kind: "button", code: BUTTON.R3 }],
  windowPrimary: [{ kind: "button", code: BUTTON.X }],
  windowSecondary: [{ kind: "button", code: BUTTON.Y }],
};

export const DEFAULT_BINDINGS: Record<GameAction, number[]> = Object.fromEntries(
  GAME_ACTIONS.map((action) => [
    action,
    DEFAULT_CONTROLLER_BINDINGS[action]
      .filter((binding) => binding.kind === "button")
      .map((binding) => binding.code),
  ]),
) as Record<GameAction, number[]>;

let isEnabled = true;
let deadzone = 0.15;
let vibrationEnabled = true;
let currentBindings = normalizeBindingMap(DEFAULT_SETTINGS.controllerBindings);
let controllerAssignments: ControllerAssignmentSettings = {
  P1: DEFAULT_SETTINGS.controllerAssignments.P1,
  P2: DEFAULT_SETTINGS.controllerAssignments.P2,
};
let lastInputMode: ControllerInputMode = "keyboard";

const actionListeners = new Set<(action: GameAction, playerId?: PlayerSlot) => void>();

let focusableElements: HTMLElement[] = [];
let currentFocusIndex = 0;
let focusObserver: MutationObserver | null = null;
let focusRefreshRaf: number | null = null;

let currentContext: ControllerContext | null = null;
let currentMode: ControllerMode = "focus";
let suppressFocusRefresh = false;

let captureState: (ControllerBindingCapture & { primed: boolean }) | null = null;

let animationFrameId: number | null = null;
let initialized = false;
let navCooldown = 0;
const NAV_COOLDOWN_MS = 150;
let lastFrameTime = 0;
const BUTTON_PRESS_THRESHOLD = 0.35;

const previousActionStatesByPad: Record<number, Partial<Record<GameAction, boolean>>> = {};
const previousButtonStatesByPad: boolean[][] = [];
const previousAxisDigitalByPad: Record<number, Record<string, boolean>> = {};

const DEBUG_OVERLAY_ID = "controllerDebugOverlay";
// Keep manual UI focus/navigation active, but leave the global DOM mutation
// observer disabled so screen transitions do not trigger the old focus-scan stalls.
const CONTROLLER_UI_FOCUS_ENABLED = true;
const CONTROLLER_UI_FOCUS_OBSERVER_ENABLED = false;
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[data-controller-focusable='true']",
].join(", ");

export function initControllerSupport(): void {
  if (initialized) {
    return;
  }

  try {
    applySettings(getSettings());
  } catch {
    applySettings(DEFAULT_SETTINGS);
  }

  subscribeToSettings((settings) => {
    applySettings(settings);
  });

  window.addEventListener("gamepadconnected", onGamepadConnected);
  window.addEventListener("gamepaddisconnected", onGamepadDisconnected);
  startPolling();
  if (CONTROLLER_UI_FOCUS_ENABLED && CONTROLLER_UI_FOCUS_OBSERVER_ENABLED) {
    ensureFocusObserver();
  }
  ensureDebugOverlay();
  syncDebugOverlay();
  initialized = true;
  console.log("[CONTROLLER] Initialized");
}

export function shutdownControllerSupport(): void {
  stopPolling();
  focusObserver?.disconnect();
  focusObserver = null;
  clearScheduledFocusRefresh();
  window.removeEventListener("gamepadconnected", onGamepadConnected);
  window.removeEventListener("gamepaddisconnected", onGamepadDisconnected);
  currentContext = null;
  focusableElements = [];
  initialized = false;
}

function applySettings(settings: {
  controllerEnabled: boolean;
  controllerVibration: boolean;
  controllerDeadzone: number;
  controllerBindings?: ControllerActionBindingMap;
  controllerAssignments?: ControllerAssignmentSettings;
}): void {
  isEnabled = settings.controllerEnabled;
  vibrationEnabled = settings.controllerVibration;
  deadzone = Math.max(0, Math.min(0.9, settings.controllerDeadzone / 100));
  currentBindings = normalizeBindingMap(settings.controllerBindings);
  controllerAssignments = {
    P1: settings.controllerAssignments?.P1 ?? DEFAULT_SETTINGS.controllerAssignments.P1,
    P2: settings.controllerAssignments?.P2 ?? DEFAULT_SETTINGS.controllerAssignments.P2,
  };
  scheduleFocusRefresh();
  syncDebugOverlay();
}

function startPolling(): void {
  if (animationFrameId !== null) {
    return;
  }
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
  if (!isEnabled || typeof navigator.getGamepads !== "function") {
    return;
  }

  const now = performance.now();
  const deltaTime = now - lastFrameTime;
  lastFrameTime = now;

  if (navCooldown > 0) {
    navCooldown = Math.max(0, navCooldown - deltaTime);
  }

  const gamepads = navigator.getGamepads();
  for (let index = 0; index < gamepads.length; index++) {
    const gamepad = gamepads[index];
    if (!gamepad) {
      continue;
    }
    processGamepad(gamepad, index);
  }
}

function processGamepad(gamepad: Gamepad, gamepadIndex: number): void {
  const previousButtons = previousButtonStatesByPad[gamepadIndex] ?? new Array(gamepad.buttons.length).fill(false);
  const previousActionStates = previousActionStatesByPad[gamepadIndex] ?? {};
  const previousAxisDigital = previousAxisDigitalByPad[gamepadIndex] ?? {};
  const assignedPlayer = getAssignedPlayerForGamepad(gamepadIndex);

  if (captureState) {
    const captureBinding = detectCapturedBinding(gamepad, previousButtons, previousAxisDigital);
    updatePreviousRawStates(gamepad, gamepadIndex);
    if (captureBinding) {
      const activeCapture = captureState;
      captureState = null;
      activeCapture.onCapture(captureBinding);
      syncDebugOverlay();
    }
    return;
  }

  const currentActionStates: Partial<Record<GameAction, boolean>> = {};
  for (const action of GAME_ACTIONS) {
    const active = isActionActiveForGamepad(gamepad, action);
    currentActionStates[action] = active;
    const wasActive = Boolean(previousActionStates[action]);

    if (isNavigationAction(action)) {
      if (active && (!wasActive || navCooldown <= 0)) {
        triggerAction(action, assignedPlayer ?? undefined);
        navCooldown = NAV_COOLDOWN_MS;
      }
      continue;
    }

    if (active && !wasActive) {
      triggerAction(action, assignedPlayer ?? undefined);
    }
  }

  previousActionStatesByPad[gamepadIndex] = currentActionStates;
  updatePreviousRawStates(gamepad, gamepadIndex);
}

function updatePreviousRawStates(gamepad: Gamepad, gamepadIndex: number): void {
  previousButtonStatesByPad[gamepadIndex] = gamepad.buttons.map((button) => isGamepadButtonPressed(button));
  const axisDigital: Record<string, boolean> = {};
  Object.values(AXIS).forEach((axisIndex) => {
    axisDigital[`${axisIndex}:positive`] = isAxisDirectionActive(gamepad.axes[axisIndex] ?? 0, "positive", 0.35);
    axisDigital[`${axisIndex}:negative`] = isAxisDirectionActive(gamepad.axes[axisIndex] ?? 0, "negative", 0.35);
  });
  previousAxisDigitalByPad[gamepadIndex] = axisDigital;
}

function normalizeBinding(binding: ControllerBindingDescriptor): ControllerBindingDescriptor {
  return {
    kind: binding.kind === "axis" ? "axis" : "button",
    code: Number(binding.code ?? 0),
    direction: binding.kind === "axis"
      ? (binding.direction === "positive" ? "positive" : "negative")
      : undefined,
    threshold: binding.kind === "axis"
      ? clampThreshold(binding.threshold)
      : undefined,
  };
}

function normalizeBindingMap(bindings?: ControllerActionBindingMap | null): Record<GameAction, ControllerBindingDescriptor[]> {
  const normalized = {} as Record<GameAction, ControllerBindingDescriptor[]>;
  GAME_ACTIONS.forEach((action) => {
    const nextBindings = bindings?.[action];
    normalized[action] = nextBindings && nextBindings.length > 0
      ? nextBindings.map(normalizeBinding)
      : DEFAULT_CONTROLLER_BINDINGS[action].map(normalizeBinding);
  });
  return normalized;
}

function clampThreshold(value: number | undefined): number {
  const threshold = Number.isFinite(value) ? Number(value) : 0.35;
  return Math.max(0.15, Math.min(0.95, threshold));
}

function isAxisDirectionActive(value: number, direction: "positive" | "negative", threshold: number): boolean {
  return direction === "positive"
    ? value >= threshold
    : value <= -threshold;
}

function isGamepadButtonPressed(button: GamepadButton | undefined, threshold: number = BUTTON_PRESS_THRESHOLD): boolean {
  if (!button) {
    return false;
  }
  return Boolean(button.pressed || button.value >= threshold);
}

function isBindingActive(gamepad: Gamepad, binding: ControllerBindingDescriptor): boolean {
  if (binding.kind === "button") {
    return isGamepadButtonPressed(gamepad.buttons[binding.code]);
  }
  const axisValue = gamepad.axes[binding.code] ?? 0;
  return isAxisDirectionActive(axisValue, binding.direction ?? "positive", clampThreshold(binding.threshold));
}

function isActionActiveForGamepad(gamepad: Gamepad, action: GameAction): boolean {
  const bindings = currentBindings[action] ?? DEFAULT_CONTROLLER_BINDINGS[action];
  return bindings.some((binding) => isBindingActive(gamepad, binding));
}

function detectCapturedBinding(
  gamepad: Gamepad,
  previousButtons: boolean[],
  previousAxisDigital: Record<string, boolean>,
): ControllerBindingDescriptor | null {
  if (!captureState) {
    return null;
  }

  const hasAnyActiveRawInput = gamepad.buttons.some((button) => isGamepadButtonPressed(button))
    || gamepad.axes.some((axis) => Math.abs(axis) >= Math.max(deadzone + 0.05, 0.35));

  if (!captureState.primed) {
    if (!hasAnyActiveRawInput) {
      captureState.primed = true;
    }
    return null;
  }

  for (let buttonIndex = 0; buttonIndex < gamepad.buttons.length; buttonIndex++) {
    const pressed = isGamepadButtonPressed(gamepad.buttons[buttonIndex]);
    const wasPressed = Boolean(previousButtons[buttonIndex]);
    if (pressed && !wasPressed) {
      return { kind: "button", code: buttonIndex };
    }
  }

  const threshold = Math.max(deadzone + 0.05, 0.4);
  for (const axisIndex of Object.values(AXIS)) {
    const axisValue = gamepad.axes[axisIndex] ?? 0;
    const positiveKey = `${axisIndex}:positive`;
    const negativeKey = `${axisIndex}:negative`;
    const positiveActive = isAxisDirectionActive(axisValue, "positive", threshold);
    const negativeActive = isAxisDirectionActive(axisValue, "negative", threshold);

    if (positiveActive && !previousAxisDigital[positiveKey]) {
      return { kind: "axis", code: axisIndex, direction: "positive", threshold };
    }
    if (negativeActive && !previousAxisDigital[negativeKey]) {
      return { kind: "axis", code: axisIndex, direction: "negative", threshold };
    }
  }

  return null;
}

function isNavigationAction(action: GameAction): boolean {
  return action === "moveUp"
    || action === "moveDown"
    || action === "moveLeft"
    || action === "moveRight";
}

export function getButtonBindings(): Record<GameAction, number[]> {
  return Object.fromEntries(
    GAME_ACTIONS.map((action) => [
      action,
      (currentBindings[action] ?? [])
        .filter((binding) => binding.kind === "button")
        .map((binding) => binding.code),
    ]),
  ) as Record<GameAction, number[]>;
}

export function getControllerBindings(): Record<GameAction, ControllerBindingDescriptor[]> {
  return Object.fromEntries(
    GAME_ACTIONS.map((action) => [action, (currentBindings[action] ?? []).map((binding) => ({ ...binding }))]),
  ) as Record<GameAction, ControllerBindingDescriptor[]>;
}

export function getControllerAssignments(): ControllerAssignmentSettings {
  return {
    P1: controllerAssignments.P1,
    P2: controllerAssignments.P2,
  };
}

export function getControllerActionLabel(action: GameAction): string {
  return getControllerActionLabelForPlayer(action);
}

export function getControllerActionLabelForPlayer(action: GameAction, playerId?: PlayerSlot): string {
  const bindings = currentBindings[action] ?? DEFAULT_CONTROLLER_BINDINGS[action];
  if (bindings.length <= 0) {
    return "UNBOUND";
  }
  const gamepadId = playerId ? getAssignedGamepad(playerId)?.id ?? null : null;
  return bindings.map((binding) => getBindingLabel(binding, gamepadId)).join(" / ");
}

export function getBindingLabel(binding: ControllerBindingDescriptor, gamepadId?: string | null): string {
  if (binding.kind === "button") {
    return getButtonName(binding.code, gamepadId);
  }

  const axisName = binding.code === AXIS.LEFT_X
    ? "LS H"
    : binding.code === AXIS.LEFT_Y
      ? "LS V"
      : binding.code === AXIS.RIGHT_X
        ? "RS H"
        : binding.code === AXIS.RIGHT_Y
          ? "RS V"
          : `AXIS ${binding.code}`;
  const direction = binding.direction === "negative"
    ? (binding.code === AXIS.LEFT_X || binding.code === AXIS.RIGHT_X ? "-" : "UP")
    : (binding.code === AXIS.LEFT_X || binding.code === AXIS.RIGHT_X ? "+" : "DOWN");
  return `${axisName} ${direction}`;
}

export function findActionsUsingBinding(
  binding: ControllerBindingDescriptor,
  options?: { excludeAction?: GameAction },
): GameAction[] {
  return GAME_ACTIONS.filter((action) => {
    if (options?.excludeAction && action === options.excludeAction) {
      return false;
    }

    return (currentBindings[action] ?? []).some((entry) => bindingsMatch(entry, binding));
  });
}

function bindingsMatch(left: ControllerBindingDescriptor, right: ControllerBindingDescriptor): boolean {
  return left.kind === right.kind
    && left.code === right.code
    && (left.direction ?? undefined) === (right.direction ?? undefined);
}

export function startControllerBindingCapture(config: ControllerBindingCapture): void {
  captureState = {
    ...config,
    primed: false,
  };
  syncDebugOverlay();
}

export function cancelControllerBindingCapture(): void {
  if (!captureState) {
    return;
  }
  const nextCapture = captureState;
  captureState = null;
  nextCapture.onCancel?.();
  syncDebugOverlay();
}

export function isControllerBindingCaptureActive(): boolean {
  return Boolean(captureState);
}

function triggerAction(action: GameAction, playerId?: PlayerSlot): void {
  markControllerInputActive();
  console.log(`[CONTROLLER] Action: ${action}${playerId ? ` (${playerId})` : ""}`);

  if (handleGlobalModalAction(action)) {
    return;
  }

  if (handleContextAction(action, playerId)) {
    return;
  }

  if (!currentContext && handleDefaultFocusAction(action)) {
    return;
  }

  for (const listener of actionListeners) {
    listener(action, playerId);
  }
}

function handleGlobalModalAction(action: GameAction): boolean {
  const modal = document.querySelector<HTMLElement>(".game-confirm-modal-backdrop");
  if (!modal) {
    return false;
  }

  switch (action) {
    case "moveUp":
      navigateFocus("up");
      return true;
    case "moveDown":
      navigateFocus("down");
      return true;
    case "moveLeft":
    case "tabPrev":
    case "prevUnit":
      navigateFocus("left");
      return true;
    case "moveRight":
    case "tabNext":
    case "nextUnit":
      navigateFocus("right");
      return true;
    case "confirm":
      activateFocusedElement();
      return true;
    case "cancel": {
      const dismissTarget = modal.querySelector<HTMLElement>(
        [
          "[data-confirm-dialog-action='cancel']",
          "[data-alert-dialog-action='dismiss']",
          "[data-opmap-confirm-action='cancel']",
          "[data-theater-exit-confirm-action='cancel']",
          "[data-battle-exit-confirm-action='cancel']",
          ".game-confirm-modal__actions .game-confirm-modal__btn:not(.game-confirm-modal__btn--primary)",
          ".game-confirm-modal__actions .game-confirm-modal__btn",
        ].join(", "),
      );
      dismissTarget?.click();
      return true;
    }
    default:
      return false;
  }
}

function handleContextAction(action: GameAction, playerId?: PlayerSlot): boolean {
  if (!ensureCurrentContextIsMounted()) {
    return false;
  }

  if (!currentContext) {
    return false;
  }

  if (action === "toggleLayoutMode" && currentContext.onLayoutAction) {
    setControllerMode(currentMode === "layout"
      ? (currentContext.onCursorAction ? "cursor" : "focus")
      : "layout");
    return true;
  }

  if (action === "toggleSurfaceMode" && currentContext.onCursorAction) {
    setControllerMode(currentMode === "cursor" ? "focus" : "cursor");
    return true;
  }

  if (action === "cancel" && currentMode === "layout") {
    setControllerMode(currentContext.onCursorAction ? "cursor" : "focus");
    return true;
  }

  if (currentMode === "layout" && currentContext.onLayoutAction?.(action, playerId)) {
    return true;
  }

  if (currentMode === "cursor" && currentContext.onCursorAction?.(action, playerId)) {
    return true;
  }

  if (currentMode === "focus") {
    if (currentContext.onFocusAction?.(action, playerId)) {
      return true;
    }
    if (handleDefaultFocusAction(action)) {
      return true;
    }
  }

  return currentContext.onAction?.(action, playerId, currentMode) ?? false;
}

function handleDefaultFocusAction(action: GameAction): boolean {
  switch (action) {
    case "moveUp":
      navigateFocus("up");
      return true;
    case "moveDown":
      navigateFocus("down");
      return true;
    case "moveLeft":
      navigateFocus("left");
      return true;
    case "moveRight":
      navigateFocus("right");
      return true;
    case "confirm":
      activateFocusedElement();
      return true;
    case "tabPrev":
    case "prevUnit":
      navigateFocus("left");
      return true;
    case "tabNext":
    case "nextUnit":
      navigateFocus("right");
      return true;
    default:
      return false;
  }
}

export function registerControllerContext(context: ControllerContext): () => void {
  currentContext = context;
  currentMode = context.defaultMode ?? "focus";
  scheduleFocusRefresh();
  currentContext.onModeChange?.(currentMode);
  syncDebugOverlay();
  return () => {
    if (currentContext?.id === context.id) {
      currentContext = null;
      currentMode = "focus";
      scheduleFocusRefresh();
      syncDebugOverlay();
    }
  };
}

export function clearControllerContext(contextId?: string): void {
  if (!currentContext) {
    return;
  }
  if (contextId && currentContext.id !== contextId) {
    return;
  }
  currentContext = null;
  currentMode = "focus";
  scheduleFocusRefresh();
  syncDebugOverlay();
}

export function getControllerMode(): ControllerMode {
  return currentMode;
}

export function setControllerMode(mode: ControllerMode): void {
  if (currentMode === mode) {
    return;
  }
  currentMode = mode;
  currentContext?.onModeChange?.(currentMode);
  scheduleFocusRefresh();
  syncDebugOverlay();
}

export function getLastInputMode(): ControllerInputMode {
  return lastInputMode;
}

export function markKeyboardInputActive(): void {
  lastInputMode = "keyboard";
  syncDebugOverlay();
}

export function markControllerInputActive(): void {
  lastInputMode = "controller";
  syncDebugOverlay();
}

export function shouldSuppressGameplayInput(playerId?: PlayerSlot): boolean {
  ensureCurrentContextIsMounted();
  if (!currentContext) {
    return false;
  }

  if (typeof currentContext.suppressGameplayInput === "function") {
    return currentContext.suppressGameplayInput(playerId, currentMode);
  }

  return Boolean(currentContext.suppressGameplayInput);
}

function ensureDebugOverlay(): void {
  if (!(import.meta as any)?.env?.DEV) {
    return;
  }

  if (document.getElementById(DEBUG_OVERLAY_ID)) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = DEBUG_OVERLAY_ID;
  overlay.className = "controller-debug-overlay";
  overlay.setAttribute("aria-hidden", "true");
  document.body.appendChild(overlay);
}

function syncDebugOverlay(): void {
  const overlay = document.getElementById(DEBUG_OVERLAY_ID);
  if (!overlay) {
    return;
  }

  const assignments = `P1:${controllerAssignments.P1 ?? "NONE"} P2:${controllerAssignments.P2 ?? "NONE"}`;
  const contextId = currentContext?.id ?? "none";
  const debugState = currentContext?.getDebugState?.() ?? {};
  const screen = document.body.getAttribute("data-screen") ?? document.querySelector("[data-screen]")?.getAttribute("data-screen") ?? "unknown";
  const focusLabel = debugState.focus ?? getFocusedElementDebugLabel() ?? "none";
  const hoverLabel = debugState.hovered ?? "none";
  const windowLabel = debugState.window ?? "none";
  const coords = Number.isFinite(debugState.x) && Number.isFinite(debugState.y)
    ? `${debugState.x},${debugState.y}`
    : "--";

  overlay.innerHTML = `
    <div>CURSOR_PROOF_CONTROLLER_COUCH screen:${escapeHtml(screen)} context:${escapeHtml(contextId)} mode:${escapeHtml(currentMode)} input:${escapeHtml(lastInputMode)}</div>
    <div>focus:${escapeHtml(focusLabel)} hovered:${escapeHtml(hoverLabel)} window:${escapeHtml(windowLabel)} coords:${escapeHtml(coords)} controllers:${escapeHtml(assignments)}</div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFocusedElementDebugLabel(): string | null {
  const element = focusableElements[currentFocusIndex] ?? (document.activeElement as HTMLElement | null);
  if (!element) {
    return null;
  }
  const text = (element.getAttribute("aria-label")
    || element.textContent
    || element.getAttribute("data-controller-window")
    || element.id
    || element.className
    || "")
    .trim()
    .replace(/\s+/g, " ");
  return text.slice(0, 56) || element.tagName.toLowerCase();
}

function ensureFocusObserver(): void {
  if (focusObserver || typeof MutationObserver === "undefined") {
    return;
  }

  const nodeMayAffectFocusState = (node: Node | null, selector: string): boolean => {
    if (!(node instanceof HTMLElement)) {
      return false;
    }

    const extendedSelector = `${selector}, [data-controller-default-focus='true']`;
    return node.matches(extendedSelector) || node.querySelector(extendedSelector) !== null;
  };

  const isFocusMutationRelevant = (records: MutationRecord[]): boolean => {
    const selector = currentContext?.focusSelector || FOCUSABLE_SELECTOR;
    return records.some((record) => {
      if (record.type === "childList") {
        return (
          nodeMayAffectFocusState(record.target, selector)
          || Array.from(record.addedNodes).some((node) => nodeMayAffectFocusState(node, selector))
          || Array.from(record.removedNodes).some((node) => nodeMayAffectFocusState(node, selector))
        );
      }

      return nodeMayAffectFocusState(record.target, selector);
    });
  };

  const startObserver = () => {
    const target = document.body;
    if (!target) {
      window.setTimeout(startObserver, 50);
      return;
    }

    focusObserver = new MutationObserver((records) => {
      if (suppressFocusRefresh) {
        return;
      }
      if (!isFocusMutationRelevant(records)) {
        return;
      }
      scheduleFocusRefresh();
    });

    focusObserver.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "hidden", "aria-hidden", "data-controller-exclude", "data-controller-focusable"],
    });
  };

  startObserver();
}

function clearScheduledFocusRefresh(): void {
  if (focusRefreshRaf !== null) {
    cancelAnimationFrame(focusRefreshRaf);
    focusRefreshRaf = null;
  }
}

function scheduleFocusRefresh(): void {
  if (!CONTROLLER_UI_FOCUS_ENABLED) {
    clearScheduledFocusRefresh();
    focusableElements = [];
    currentFocusIndex = 0;
    return;
  }
  clearScheduledFocusRefresh();
  focusRefreshRaf = requestAnimationFrame(() => {
    focusRefreshRaf = null;
    updateFocusableElements();
  });
}

export function updateFocusableElements(): void {
  if (!CONTROLLER_UI_FOCUS_ENABLED) {
    focusableElements = [];
    currentFocusIndex = 0;
    syncDebugOverlay();
    return;
  }

  const root = resolveFocusRoot();
  const nextFocusable = Array.from(
    root.querySelectorAll<HTMLElement>(currentContext?.focusSelector || FOCUSABLE_SELECTOR),
  ).filter(isElementFocusable);

  const previousFocus = focusableElements[currentFocusIndex]
    ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);

  const previousSuppressFocusRefresh = suppressFocusRefresh;
  suppressFocusRefresh = true;
  try {
    focusableElements = nextFocusable;
    focusableElements.forEach((element, index) => {
      element.classList.add("controller-focusable");
      element.dataset.focusIndex = String(index);
    });
  } finally {
    suppressFocusRefresh = previousSuppressFocusRefresh;
  }

  if (focusableElements.length <= 0) {
    currentFocusIndex = 0;
    syncDebugOverlay();
    return;
  }

  const existingIndex = previousFocus
    ? focusableElements.findIndex((element) => element === previousFocus)
    : -1;

  if (existingIndex >= 0) {
    currentFocusIndex = existingIndex;
    focusableElements[currentFocusIndex]?.classList.add("controller-focused");
    syncDebugOverlay();
    return;
  }

  const defaultFocus = resolveDefaultFocusable(root);
  if (defaultFocus) {
    setFocusByElement(defaultFocus);
    return;
  }

  currentFocusIndex = clampIndex(currentFocusIndex, focusableElements.length);
  setFocus(currentFocusIndex);
}

function resolveFocusRoot(): ParentNode {
  ensureCurrentContextIsMounted();
  const configuredRoot = typeof currentContext?.focusRoot === "function"
    ? currentContext.focusRoot()
    : currentContext?.focusRoot;
  return configuredRoot ?? document;
}

function ensureCurrentContextIsMounted(): boolean {
  if (!currentContext) {
    return false;
  }

  const configuredRoot = typeof currentContext.focusRoot === "function"
    ? currentContext.focusRoot()
    : currentContext.focusRoot;

  if (!configuredRoot) {
    return true;
  }

  if (configuredRoot.isConnected) {
    return true;
  }

  currentContext = null;
  currentMode = "focus";
  scheduleFocusRefresh();
  syncDebugOverlay();
  return false;
}

function resolveDefaultFocusable(root: ParentNode): HTMLElement | null {
  const selector = currentContext?.defaultFocusSelector ?? "[data-controller-default-focus='true']";
  if (!selector) {
    return null;
  }
  const candidate = root.querySelector<HTMLElement>(selector);
  return candidate && isElementFocusable(candidate) ? candidate : null;
}

function isElementFocusable(element: HTMLElement): boolean {
  if (element.dataset.controllerExclude === "true") {
    return false;
  }
  if (element.hasAttribute("disabled")) {
    return false;
  }
  if (element.getAttribute("aria-hidden") === "true") {
    return false;
  }
  if (element.tabIndex < 0 && element.dataset.controllerFocusable !== "true") {
    const tagName = element.tagName.toLowerCase();
    if (!["button", "input", "select", "textarea", "a"].includes(tagName)) {
      return false;
    }
  }

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

type FocusDirection = "up" | "down" | "left" | "right";

function navigateFocus(direction: FocusDirection): void {
  if (!CONTROLLER_UI_FOCUS_ENABLED) {
    return;
  }
  if (focusableElements.length <= 0) {
    updateFocusableElements();
  }
  if (focusableElements.length <= 0) {
    return;
  }

  const current = focusableElements[currentFocusIndex] ?? focusableElements[0];
  const currentRect = current.getBoundingClientRect();
  const currentCenterX = currentRect.left + currentRect.width / 2;
  const currentCenterY = currentRect.top + currentRect.height / 2;

  let bestIndex = currentFocusIndex;
  let bestScore = Number.POSITIVE_INFINITY;

  focusableElements.forEach((candidate, index) => {
    if (index === currentFocusIndex) {
      return;
    }

    const rect = candidate.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = centerX - currentCenterX;
    const deltaY = centerY - currentCenterY;

    if (direction === "up" && deltaY >= -4) return;
    if (direction === "down" && deltaY <= 4) return;
    if (direction === "left" && deltaX >= -4) return;
    if (direction === "right" && deltaX <= 4) return;

    const primaryDistance = direction === "left" || direction === "right"
      ? Math.abs(deltaX)
      : Math.abs(deltaY);
    const secondaryDistance = direction === "left" || direction === "right"
      ? Math.abs(deltaY)
      : Math.abs(deltaX);
    const score = primaryDistance + (secondaryDistance * 0.35);

    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  if (bestIndex !== currentFocusIndex) {
    setFocus(bestIndex);
    return;
  }

  const wrappedIndex = direction === "up" || direction === "left"
    ? currentFocusIndex - 1
    : currentFocusIndex + 1;
  setFocus((wrappedIndex + focusableElements.length) % focusableElements.length);
}

function setFocusByElement(element: HTMLElement): void {
  if (!CONTROLLER_UI_FOCUS_ENABLED) {
    return;
  }
  const index = focusableElements.findIndex((candidate) => candidate === element);
  if (index >= 0) {
    setFocus(index);
  }
}

function setFocus(index: number): void {
  if (!CONTROLLER_UI_FOCUS_ENABLED) {
    return;
  }
  if (focusableElements.length <= 0) {
    return;
  }

  focusableElements.forEach((element) => element.classList.remove("controller-focused"));
  currentFocusIndex = clampIndex(index, focusableElements.length);
  const element = focusableElements[currentFocusIndex];
  if (!element) {
    syncDebugOverlay();
    return;
  }

  suppressFocusRefresh = true;
  element.classList.add("controller-focused");
  element.focus({ preventScroll: true });
  suppressFocusRefresh = false;
  element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  syncDebugOverlay();
}

function activateFocusedElement(): void {
  if (!CONTROLLER_UI_FOCUS_ENABLED) {
    return;
  }
  const element = focusableElements[currentFocusIndex];
  if (!element) {
    return;
  }

  if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
    element.click();
  } else if (typeof element.click === "function") {
    element.click();
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus();
  }
  vibrate(50, 0.3);
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  if (!Number.isFinite(index)) {
    return 0;
  }
  return Math.max(0, Math.min(length - 1, index));
}

export function isControllerConnected(): boolean {
  return typeof navigator.getGamepads === "function"
    ? Array.from(navigator.getGamepads()).some((gamepad) => gamepad !== null)
    : false;
}

export function getConnectedControllers(): ControllerState[] {
  if (typeof navigator.getGamepads !== "function") {
    return [];
  }

  const controllers: ControllerState[] = [];
  for (const gamepad of navigator.getGamepads()) {
    if (!gamepad) {
      continue;
    }

    controllers.push({
      connected: true,
      id: gamepad.id,
      index: gamepad.index,
      assignedPlayer: getAssignedPlayerForGamepad(gamepad.index),
      buttons: gamepad.buttons.map((button, buttonIndex) => ({
        pressed: isGamepadButtonPressed(button),
        value: button.value,
        justPressed: isGamepadButtonPressed(button) && !(previousButtonStatesByPad[gamepad.index]?.[buttonIndex] ?? false),
        justReleased: !isGamepadButtonPressed(button) && Boolean(previousButtonStatesByPad[gamepad.index]?.[buttonIndex]),
      })),
      axes: [...gamepad.axes],
    });
  }

  return controllers;
}

export function bindControllerToPlayer(playerId: PlayerSlot, gamepadIndex: number | null): void {
  controllerAssignments[playerId] = gamepadIndex;
  syncDebugOverlay();
}

export function getControllerBindingForPlayer(playerId: PlayerSlot): number | null {
  return controllerAssignments[playerId];
}

function getAssignedPlayerForGamepad(gamepadIndex: number): PlayerSlot | null {
  for (const playerId of Object.keys(controllerAssignments) as PlayerSlot[]) {
    if (controllerAssignments[playerId] === gamepadIndex) {
      return playerId;
    }
  }
  return null;
}

function bindUnassignedController(gamepadIndex: number): void {
  if (getAssignedPlayerForGamepad(gamepadIndex)) {
    return;
  }

  if (controllerAssignments.P1 === null) {
    controllerAssignments.P1 = gamepadIndex;
    return;
  }
  if (controllerAssignments.P2 === null) {
    controllerAssignments.P2 = gamepadIndex;
  }
}

export function getAssignedGamepad(playerId: PlayerSlot): Gamepad | null {
  const gamepadIndex = controllerAssignments[playerId];
  if (gamepadIndex === null || typeof navigator.getGamepads !== "function") {
    return null;
  }
  return navigator.getGamepads()[gamepadIndex] ?? null;
}

export function isGamepadActionActive(playerId: PlayerSlot, action: GameAction): boolean {
  const gamepad = getAssignedGamepad(playerId);
  if (!gamepad || !isEnabled) {
    return false;
  }
  return isActionActiveForGamepad(gamepad, action);
}

export function vibrate(durationMs: number, intensity: number = 1.0): void {
  if (!vibrationEnabled || typeof navigator.getGamepads !== "function") {
    return;
  }

  const gamepads = navigator.getGamepads();
  for (const gamepad of gamepads) {
    if (!gamepad?.vibrationActuator) {
      continue;
    }
    gamepad.vibrationActuator.playEffect("dual-rumble", {
      startDelay: 0,
      duration: durationMs,
      weakMagnitude: intensity * 0.5,
      strongMagnitude: intensity,
    }).catch(() => {});
  }
}

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

type ControllerGlyphProfile = "generic" | "playstation";

function getControllerGlyphProfile(gamepadId?: string | null): ControllerGlyphProfile {
  const normalizedId = String(gamepadId ?? "").toLowerCase();
  if (
    normalizedId.includes("dualsense")
    || normalizedId.includes("dualsense edge")
    || normalizedId.includes("wireless controller")
    || normalizedId.includes("playstation")
    || normalizedId.includes("sony")
  ) {
    return "playstation";
  }
  return "generic";
}

export function getButtonName(buttonIndex: number, gamepadId?: string | null): string {
  const profile = getControllerGlyphProfile(gamepadId);
  const names: Record<number, string> = profile === "playstation"
    ? {
        [BUTTON.A]: "CROSS",
        [BUTTON.B]: "CIRCLE",
        [BUTTON.X]: "SQUARE",
        [BUTTON.Y]: "TRIANGLE",
        [BUTTON.LB]: "L1",
        [BUTTON.RB]: "R1",
        [BUTTON.LT]: "L2",
        [BUTTON.RT]: "R2",
        [BUTTON.SELECT]: "CREATE",
        [BUTTON.START]: "OPTIONS",
        [BUTTON.L3]: "L3",
        [BUTTON.R3]: "R3",
        [BUTTON.DPAD_UP]: "DPAD UP",
        [BUTTON.DPAD_DOWN]: "DPAD DOWN",
        [BUTTON.DPAD_LEFT]: "DPAD LEFT",
        [BUTTON.DPAD_RIGHT]: "DPAD RIGHT",
      }
    : {
        [BUTTON.A]: "A",
        [BUTTON.B]: "B",
        [BUTTON.X]: "X",
        [BUTTON.Y]: "Y",
        [BUTTON.LB]: "LB",
        [BUTTON.RB]: "RB",
        [BUTTON.LT]: "LT",
        [BUTTON.RT]: "RT",
        [BUTTON.SELECT]: "VIEW",
        [BUTTON.START]: "MENU",
        [BUTTON.L3]: "L3",
        [BUTTON.R3]: "R3",
        [BUTTON.DPAD_UP]: "DPAD UP",
        [BUTTON.DPAD_DOWN]: "DPAD DOWN",
        [BUTTON.DPAD_LEFT]: "DPAD LEFT",
        [BUTTON.DPAD_RIGHT]: "DPAD RIGHT",
      };
  return names[buttonIndex] ?? `BTN ${buttonIndex}`;
}

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
    openInventory: "Open Inventory",
    openMap: "Open Map",
    pause: "Pause",
    attack: "Attack",
    interact: "Interact",
    dash: "Dash",
    tabPrev: "Previous Tab",
    tabNext: "Next Tab",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    toggleSurfaceMode: "Toggle Surface Mode",
    toggleLayoutMode: "Toggle Layout Mode",
    windowPrimary: "Window Primary",
    windowSecondary: "Window Secondary",
  };
  return names[action] ?? action;
}

function onGamepadConnected(event: GamepadEvent): void {
  console.log(`[CONTROLLER] Connected: ${event.gamepad.id}`);
  bindUnassignedController(event.gamepad.index);
  scheduleFocusRefresh();
  syncDebugOverlay();
  vibrate(100, 0.5);
}

function onGamepadDisconnected(event: GamepadEvent): void {
  console.log(`[CONTROLLER] Disconnected: ${event.gamepad.id}`);
  previousButtonStatesByPad[event.gamepad.index] = [];
  previousActionStatesByPad[event.gamepad.index] = {};
  previousAxisDigitalByPad[event.gamepad.index] = {};

  for (const playerId of Object.keys(controllerAssignments) as PlayerSlot[]) {
    if (controllerAssignments[playerId] === event.gamepad.index) {
      controllerAssignments[playerId] = null;
    }
  }

  document.querySelectorAll(".controller-focused").forEach((element) => {
    element.classList.remove("controller-focused");
  });
  scheduleFocusRefresh();
  syncDebugOverlay();
}

export function onControllerAction(listener: (action: GameAction, playerId?: PlayerSlot) => void): () => void {
  actionListeners.add(listener);
  return () => actionListeners.delete(listener);
}

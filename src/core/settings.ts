// ============================================================================
// CHAOS CORE - SETTINGS SYSTEM (Headline 12bz)
// src/core/settings.ts
// Game settings management with persistence
// ============================================================================

import { applyTheme, ThemeId } from "./themes";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export interface GameSettings {
  // Audio
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  
  // Display
  screenShake: boolean;
  showDamageNumbers: boolean;
  showGridCoordinates: boolean;
  animationSpeed: "slow" | "normal" | "fast";
  uiTheme: "ardycia" | "cyberpunk" | "monochrome" | "warm" | "cool" | "neon" | "forest" | "sunset" | "ocean" | "void";
  
  // Gameplay
  autosaveEnabled: boolean;
  confirmEndTurn: boolean;
  showTutorialHints: boolean;
  
  // Controls
  controllerEnabled: boolean;
  controllerVibration: boolean;
  controllerDeadzone: number;
  
  // Accessibility
  highContrastMode: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  colorblindMode: "none" | "protanopia" | "deuteranopia" | "tritanopia";
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 80,
  musicVolume: 70,
  sfxVolume: 100,
  
  screenShake: true,
  showDamageNumbers: true,
  showGridCoordinates: false,
  animationSpeed: "normal",
  uiTheme: "ardycia",
  
  autosaveEnabled: true,
  confirmEndTurn: false,
  showTutorialHints: true,
  
  controllerEnabled: true,
  controllerVibration: true,
  controllerDeadzone: 15,
  
  highContrastMode: false,
  largeText: false,
  reducedMotion: false,
  colorblindMode: "none",
};

// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------

let currentSettings: GameSettings = { ...DEFAULT_SETTINGS };
type SettingsListener = (settings: GameSettings) => void;
const settingsListeners = new Set<SettingsListener>();

// ----------------------------------------------------------------------------
// TAURI INTEGRATION
// ----------------------------------------------------------------------------

interface TauriInvoke {
  (cmd: string, args?: Record<string, unknown>): Promise<unknown>;
}

function getTauriInvoke(): TauriInvoke | null {
  const anyWindow = window as any;
  if (anyWindow.__TAURI__?.invoke) {
    return anyWindow.__TAURI__.invoke;
  }
  return null;
}

function isTauriAvailable(): boolean {
  return getTauriInvoke() !== null;
}

// ----------------------------------------------------------------------------
// PERSISTENCE
// ----------------------------------------------------------------------------

const SETTINGS_STORAGE_KEY = "chaoscore_settings";

async function saveSettingsToDisk(): Promise<void> {
  const json = JSON.stringify(currentSettings);
  
  if (isTauriAvailable()) {
    const invoke = getTauriInvoke()!;
    try {
      await invoke("save_settings", { json });
    } catch (e) {
      console.warn("[SETTINGS] Tauri save failed, using localStorage", e);
      localStorage.setItem(SETTINGS_STORAGE_KEY, json);
    }
  } else {
    localStorage.setItem(SETTINGS_STORAGE_KEY, json);
  }
}

async function loadSettingsFromDisk(): Promise<GameSettings | null> {
  try {
    let json: string | null = null;
    
    if (isTauriAvailable()) {
      const invoke = getTauriInvoke()!;
      try {
        json = (await invoke("load_settings")) as string;
      } catch {
        // Fall back to localStorage
        json = localStorage.getItem(SETTINGS_STORAGE_KEY);
      }
    } else {
      json = localStorage.getItem(SETTINGS_STORAGE_KEY);
    }
    
    if (json) {
      return JSON.parse(json) as GameSettings;
    }
  } catch (error) {
    console.warn("[SETTINGS] Failed to load settings:", error);
  }
  
  return null;
}

// ----------------------------------------------------------------------------
// PUBLIC API
// ----------------------------------------------------------------------------

/**
 * Initialize settings system
 */
export async function initializeSettings(): Promise<void> {
  const loaded = await loadSettingsFromDisk();
  
  if (loaded) {
    currentSettings = { ...DEFAULT_SETTINGS, ...loaded };
  } else {
    currentSettings = { ...DEFAULT_SETTINGS };
  }
  
  applySettings(currentSettings);
  console.log("[SETTINGS] Initialized:", currentSettings);
}

/**
 * Get current settings
 */
export function getSettings(): GameSettings {
  return { ...currentSettings };
}

/**
 * Update one or more settings
 */
export async function updateSettings(updates: Partial<GameSettings>): Promise<void> {
  currentSettings = { ...currentSettings, ...updates };
  await saveSettingsToDisk();
  applySettings(currentSettings);
  notifyListeners();
}

/**
 * Reset all settings to defaults
 */
export async function resetSettings(): Promise<void> {
  currentSettings = { ...DEFAULT_SETTINGS };
  await saveSettingsToDisk();
  applySettings(currentSettings);
  notifyListeners();
}

/**
 * Subscribe to settings changes
 */
export function subscribeToSettings(listener: SettingsListener): () => void {
  settingsListeners.add(listener);
  return () => settingsListeners.delete(listener);
}

function notifyListeners(): void {
  for (const listener of settingsListeners) {
    listener(currentSettings);
  }
}

// ----------------------------------------------------------------------------
// APPLY SETTINGS
// ----------------------------------------------------------------------------

function applySettings(settings: GameSettings): void {
  const root = document.documentElement;
  
  // Large text
  if (settings.largeText) {
    root.style.setProperty("--base-font-size", "18px");
    root.classList.add("large-text");
  } else {
    root.style.setProperty("--base-font-size", "14px");
    root.classList.remove("large-text");
  }
  
  // High contrast
  if (settings.highContrastMode) {
    root.classList.add("high-contrast");
  } else {
    root.classList.remove("high-contrast");
  }
  
  // Reduced motion
  if (settings.reducedMotion) {
    root.classList.add("reduced-motion");
  } else {
    root.classList.remove("reduced-motion");
  }
  
  // Colorblind modes
  root.classList.remove("colorblind-protanopia", "colorblind-deuteranopia", "colorblind-tritanopia");
  if (settings.colorblindMode !== "none") {
    root.classList.add(`colorblind-${settings.colorblindMode}`);
  }
  
  // Animation speed
  const animSpeeds = { slow: "1.5", normal: "1", fast: "0.5" };
  root.style.setProperty("--animation-speed", animSpeeds[settings.animationSpeed]);
  
  // UI Theme
  applyTheme(settings.uiTheme as ThemeId);
}

// ----------------------------------------------------------------------------
// SETTING DESCRIPTORS (for UI generation)
// ----------------------------------------------------------------------------

export interface SettingDescriptor {
  key: keyof GameSettings;
  label: string;
  description: string;
  type: "toggle" | "slider" | "select";
  category: "audio" | "display" | "gameplay" | "controls" | "accessibility";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

export const SETTING_DESCRIPTORS: SettingDescriptor[] = [
  // Audio
  {
    key: "masterVolume",
    label: "Master Volume",
    description: "Overall volume level",
    type: "slider",
    category: "audio",
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: "musicVolume",
    label: "Music Volume",
    description: "Background music volume",
    type: "slider",
    category: "audio",
    min: 0,
    max: 100,
    step: 5,
  },
  {
    key: "sfxVolume",
    label: "Sound Effects",
    description: "Sound effects volume",
    type: "slider",
    category: "audio",
    min: 0,
    max: 100,
    step: 5,
  },
  
  // Display
  {
    key: "screenShake",
    label: "Screen Shake",
    description: "Enable screen shake effects during combat",
    type: "toggle",
    category: "display",
  },
  {
    key: "showDamageNumbers",
    label: "Damage Numbers",
    description: "Show floating damage numbers in battle",
    type: "toggle",
    category: "display",
  },
  {
    key: "showGridCoordinates",
    label: "Grid Coordinates",
    description: "Display tile coordinates on battle grid",
    type: "toggle",
    category: "display",
  },
  {
    key: "animationSpeed",
    label: "Animation Speed",
    description: "Speed of battle animations",
    type: "select",
    category: "display",
    options: [
      { value: "slow", label: "Slow" },
      { value: "normal", label: "Normal" },
      { value: "fast", label: "Fast" },
    ],
  },
  {
    key: "uiTheme",
    label: "UI Theme",
    description: "Color theme for the game interface",
    type: "select",
    category: "display",
    options: [
      { value: "ardycia", label: "Ardycia (Default)" },
      { value: "cyberpunk", label: "Cyberpunk" },
      { value: "monochrome", label: "Monochrome" },
      { value: "warm", label: "Warm" },
      { value: "cool", label: "Cool" },
      { value: "neon", label: "Neon" },
      { value: "forest", label: "Forest" },
      { value: "sunset", label: "Sunset" },
      { value: "ocean", label: "Ocean" },
      { value: "void", label: "Void" },
    ],
  },
  
  // Gameplay
  {
    key: "autosaveEnabled",
    label: "Autosave",
    description: "Automatically save progress periodically",
    type: "toggle",
    category: "gameplay",
  },
  {
    key: "confirmEndTurn",
    label: "Confirm End Turn",
    description: "Ask for confirmation before ending turn",
    type: "toggle",
    category: "gameplay",
  },
  {
    key: "showTutorialHints",
    label: "Tutorial Hints",
    description: "Show helpful hints and tips",
    type: "toggle",
    category: "gameplay",
  },
  
  // Controls
  {
    key: "controllerEnabled",
    label: "Controller Support",
    description: "Enable gamepad/controller input",
    type: "toggle",
    category: "controls",
  },
  {
    key: "controllerVibration",
    label: "Controller Vibration",
    description: "Enable haptic feedback on compatible controllers",
    type: "toggle",
    category: "controls",
  },
  {
    key: "controllerDeadzone",
    label: "Stick Deadzone",
    description: "Analog stick deadzone percentage",
    type: "slider",
    category: "controls",
    min: 0,
    max: 50,
    step: 5,
  },
  
  // Accessibility
  {
    key: "highContrastMode",
    label: "High Contrast",
    description: "Increase visual contrast for better visibility",
    type: "toggle",
    category: "accessibility",
  },
  {
    key: "largeText",
    label: "Large Text",
    description: "Increase text size throughout the game",
    type: "toggle",
    category: "accessibility",
  },
  {
    key: "reducedMotion",
    label: "Reduced Motion",
    description: "Minimize animations and movement",
    type: "toggle",
    category: "accessibility",
  },
  {
    key: "colorblindMode",
    label: "Colorblind Mode",
    description: "Adjust colors for colorblind players",
    type: "select",
    category: "accessibility",
    options: [
      { value: "none", label: "Off" },
      { value: "protanopia", label: "Protanopia (Red-Weak)" },
      { value: "deuteranopia", label: "Deuteranopia (Green-Weak)" },
      { value: "tritanopia", label: "Tritanopia (Blue-Weak)" },
    ],
  },
];

/**
 * Get settings grouped by category
 */
export function getSettingsByCategory(): Record<string, SettingDescriptor[]> {
  const grouped: Record<string, SettingDescriptor[]> = {
    audio: [],
    display: [],
    gameplay: [],
    controls: [],
    accessibility: [],
  };
  
  for (const desc of SETTING_DESCRIPTORS) {
    grouped[desc.category].push(desc);
  }
  
  return grouped;
}

/**
 * Get human-readable category name
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    audio: "Audio",
    display: "Display",
    gameplay: "Gameplay",
    controls: "Controls",
    accessibility: "Accessibility",
  };
  return labels[category] ?? category;
}
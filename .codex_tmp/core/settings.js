// ============================================================================
// CHAOS CORE - SETTINGS SYSTEM (Headline 12bz)
// src/core/settings.ts
// Game settings management with persistence
// ============================================================================
import { applyTheme } from "./themes";
export const DEFAULT_SETTINGS = {
    masterVolume: 80,
    musicVolume: 70,
    sfxVolume: 100,
    screenShake: true,
    showDamageNumbers: true,
    showGridCoordinates: false,
    animationSpeed: "normal",
    uiTheme: "ardycia",
    cardTheme: "dark",
    autosaveEnabled: true,
    confirmEndTurn: false,
    showTutorialHints: true,
    dismissedTutorialHintIds: [],
    controllerEnabled: true,
    controllerVibration: true,
    controllerDeadzone: 15,
    controllerBindings: {
        confirm: [{ kind: "button", code: 0 }],
        cancel: [{ kind: "button", code: 1 }],
        menu: [{ kind: "button", code: 9 }],
        pause: [{ kind: "button", code: 9 }],
        moveUp: [
            { kind: "button", code: 12 },
            { kind: "axis", code: 1, direction: "negative", threshold: 0.35 },
        ],
        moveDown: [
            { kind: "button", code: 13 },
            { kind: "axis", code: 1, direction: "positive", threshold: 0.35 },
        ],
        moveLeft: [
            { kind: "button", code: 14 },
            { kind: "axis", code: 0, direction: "negative", threshold: 0.35 },
        ],
        moveRight: [
            { kind: "button", code: 15 },
            { kind: "axis", code: 0, direction: "positive", threshold: 0.35 },
        ],
        nextUnit: [{ kind: "button", code: 5 }],
        prevUnit: [{ kind: "button", code: 4 }],
        endTurn: [{ kind: "button", code: 3 }],
        openInventory: [{ kind: "button", code: 8 }],
        openMap: [{ kind: "button", code: 2 }],
        attack: [{ kind: "button", code: 0 }],
        interact: [{ kind: "button", code: 2 }],
        dash: [{ kind: "button", code: 5 }],
        tabPrev: [{ kind: "button", code: 4 }],
        tabNext: [{ kind: "button", code: 5 }],
        zoomOut: [{ kind: "button", code: 6 }],
        zoomIn: [{ kind: "button", code: 7 }],
        toggleSurfaceMode: [{ kind: "button", code: 10 }],
        toggleLayoutMode: [{ kind: "button", code: 11 }],
        windowPrimary: [{ kind: "button", code: 2 }],
        windowSecondary: [{ kind: "button", code: 3 }],
    },
    controllerAssignments: {
        P1: 0,
        P2: 1,
    },
    highContrastMode: false,
    largeText: false,
    reducedMotion: false,
    colorblindMode: "none",
};
// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------
let currentSettings = { ...DEFAULT_SETTINGS };
const settingsListeners = new Set();
function getTauriInvoke() {
    const anyWindow = window;
    if (anyWindow.__TAURI__?.invoke) {
        return anyWindow.__TAURI__.invoke;
    }
    return null;
}
function isTauriAvailable() {
    return getTauriInvoke() !== null;
}
// ----------------------------------------------------------------------------
// PERSISTENCE
// ----------------------------------------------------------------------------
const SETTINGS_STORAGE_KEY = "chaoscore_settings";
const SETTINGS_IO_TIMEOUT_MS = 1500;
async function withSettingsTimeout(label, task) {
    let timeoutId = null;
    try {
        return await Promise.race([
            task,
            new Promise((_, reject) => {
                timeoutId = window.setTimeout(() => {
                    reject(new Error(`${label} timed out after ${SETTINGS_IO_TIMEOUT_MS}ms`));
                }, SETTINGS_IO_TIMEOUT_MS);
            }),
        ]);
    }
    finally {
        if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
        }
    }
}
async function saveSettingsToDisk() {
    const json = JSON.stringify(currentSettings);
    if (isTauriAvailable()) {
        const invoke = getTauriInvoke();
        try {
            await withSettingsTimeout("save_settings", invoke("save_settings", { json }));
        }
        catch (e) {
            console.warn("[SETTINGS] Tauri save failed, using localStorage", e);
            localStorage.setItem(SETTINGS_STORAGE_KEY, json);
        }
    }
    else {
        localStorage.setItem(SETTINGS_STORAGE_KEY, json);
    }
}
async function loadSettingsFromDisk() {
    try {
        let json = null;
        if (isTauriAvailable()) {
            const invoke = getTauriInvoke();
            try {
                json = (await withSettingsTimeout("load_settings", invoke("load_settings")));
            }
            catch {
                // Fall back to localStorage
                json = localStorage.getItem(SETTINGS_STORAGE_KEY);
            }
        }
        else {
            json = localStorage.getItem(SETTINGS_STORAGE_KEY);
        }
        if (json) {
            return JSON.parse(json);
        }
    }
    catch (error) {
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
export async function initializeSettings() {
    const loaded = await loadSettingsFromDisk();
    if (loaded) {
        currentSettings = { ...DEFAULT_SETTINGS, ...loaded };
    }
    else {
        currentSettings = { ...DEFAULT_SETTINGS };
    }
    applySettings(currentSettings);
    console.log("[SETTINGS] Initialized:", currentSettings);
}
/**
 * Get current settings
 */
export function getSettings() {
    return { ...currentSettings };
}
/**
 * Update one or more settings
 */
export async function updateSettings(updates) {
    currentSettings = { ...currentSettings, ...updates };
    await saveSettingsToDisk();
    applySettings(currentSettings);
    notifyListeners();
}
/**
 * Reset all settings to defaults
 */
export async function resetSettings() {
    currentSettings = { ...DEFAULT_SETTINGS };
    await saveSettingsToDisk();
    applySettings(currentSettings);
    notifyListeners();
}
/**
 * Subscribe to settings changes
 */
export function subscribeToSettings(listener) {
    settingsListeners.add(listener);
    return () => settingsListeners.delete(listener);
}
function notifyListeners() {
    for (const listener of settingsListeners) {
        listener(currentSettings);
    }
}
// ----------------------------------------------------------------------------
// APPLY SETTINGS
// ----------------------------------------------------------------------------
function applySettings(settings) {
    const root = document.documentElement;
    // Large text
    if (settings.largeText) {
        root.style.setProperty("--base-font-size", "18px");
        root.classList.add("large-text");
    }
    else {
        root.style.setProperty("--base-font-size", "14px");
        root.classList.remove("large-text");
    }
    // High contrast
    if (settings.highContrastMode) {
        root.classList.add("high-contrast");
    }
    else {
        root.classList.remove("high-contrast");
    }
    // Reduced motion
    if (settings.reducedMotion) {
        root.classList.add("reduced-motion");
    }
    else {
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
    applyTheme(settings.uiTheme);
    // Card Theme
    root.classList.remove("card-theme-light", "card-theme-dark");
    root.classList.add(`card-theme-${settings.cardTheme}`);
}
export const SETTING_DESCRIPTORS = [
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
    {
        key: "cardTheme",
        label: "Card Theme",
        description: "Color theme for battle cards",
        type: "select",
        category: "display",
        options: [
            { value: "dark", label: "Dark (Default)" },
            { value: "light", label: "Light" },
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
export function getSettingsByCategory() {
    const grouped = {
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
export function getCategoryLabel(category) {
    const labels = {
        audio: "Audio",
        display: "Display",
        gameplay: "Gameplay",
        controls: "Controls",
        accessibility: "Accessibility",
    };
    return labels[category] ?? category;
}

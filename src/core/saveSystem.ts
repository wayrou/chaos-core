// ============================================================================
// CHAOS CORE - SAVE SYSTEM (Headline 12)
// src/core/saveSystem.ts
// Save/load with Tauri integration and localStorage fallback
// ============================================================================

import { GameState } from "./types";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export interface SaveInfo {
  slot: string;
  timestamp: number;
  preview?: SavePreview;
}

export interface SavePreview {
  callsign: string;
  squadName: string;
  operationName: string;
  wad: number;
  partyCount: number;
}

export interface SaveResult {
  success: boolean;
  error?: string;
}

export interface LoadResult {
  success: boolean;
  state?: GameState;
  error?: string;
}

// Save slot constants
export const SAVE_SLOTS = {
  AUTOSAVE: "autosave",
  MANUAL_1: "save_1",
  MANUAL_2: "save_2",
  MANUAL_3: "save_3",
} as const;

export type SaveSlot = typeof SAVE_SLOTS[keyof typeof SAVE_SLOTS];

// ----------------------------------------------------------------------------
// TAURI DETECTION
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
// TAURI COMMANDS
// ----------------------------------------------------------------------------

async function tauriSaveGame(slot: string, json: string): Promise<void> {
  const invoke = getTauriInvoke();
  if (!invoke) throw new Error("Tauri not available");
  await invoke("save_game", { slot, json });
}

async function tauriLoadGame(slot: string): Promise<string> {
  const invoke = getTauriInvoke();
  if (!invoke) throw new Error("Tauri not available");
  return (await invoke("load_game", { slot })) as string;
}

async function tauriHasSave(slot: string): Promise<boolean> {
  const invoke = getTauriInvoke();
  if (!invoke) throw new Error("Tauri not available");
  return (await invoke("has_save", { slot })) as boolean;
}

async function tauriDeleteSave(slot: string): Promise<void> {
  const invoke = getTauriInvoke();
  if (!invoke) throw new Error("Tauri not available");
  await invoke("delete_save", { slot });
}

async function tauriListSaves(): Promise<SaveInfo[]> {
  const invoke = getTauriInvoke();
  if (!invoke) throw new Error("Tauri not available");
  return (await invoke("list_saves")) as SaveInfo[];
}

// ----------------------------------------------------------------------------
// LOCALSTORAGE FALLBACK
// ----------------------------------------------------------------------------

const STORAGE_PREFIX = "chaoscore_save_";
const STORAGE_META_PREFIX = "chaoscore_meta_";

function localStorageSaveGame(slot: string, json: string): void {
  localStorage.setItem(STORAGE_PREFIX + slot, json);
  localStorage.setItem(STORAGE_META_PREFIX + slot, JSON.stringify({
    timestamp: Date.now(),
  }));
}

function localStorageLoadGame(slot: string): string | null {
  return localStorage.getItem(STORAGE_PREFIX + slot);
}

function localStorageHasSave(slot: string): boolean {
  return localStorage.getItem(STORAGE_PREFIX + slot) !== null;
}

function localStorageDeleteSave(slot: string): void {
  localStorage.removeItem(STORAGE_PREFIX + slot);
  localStorage.removeItem(STORAGE_META_PREFIX + slot);
}

function localStorageListSaves(): SaveInfo[] {
  const saves: SaveInfo[] = [];
  const slots = Object.values(SAVE_SLOTS);
  
  for (const slot of slots) {
    if (localStorageHasSave(slot)) {
      const metaStr = localStorage.getItem(STORAGE_META_PREFIX + slot);
      const meta = metaStr ? JSON.parse(metaStr) : { timestamp: 0 };
      
      let preview: SavePreview | undefined;
      try {
        const saveStr = localStorage.getItem(STORAGE_PREFIX + slot);
        if (saveStr) {
          const state = JSON.parse(saveStr) as GameState;
          preview = extractSavePreview(state);
        }
      } catch {
        // Ignore parse errors
      }
      
      saves.push({
        slot,
        timestamp: meta.timestamp,
        preview,
      });
    }
  }
  
  return saves.sort((a, b) => b.timestamp - a.timestamp);
}

// ----------------------------------------------------------------------------
// PREVIEW EXTRACTION
// ----------------------------------------------------------------------------

function extractSavePreview(state: GameState): SavePreview {
  return {
    callsign: state.profile?.callsign ?? "Unknown",
    squadName: state.profile?.squadName ?? "Unknown Squad",
    operationName: state.operation?.codename ?? "Unknown Operation",
    wad: state.wad ?? 0,
    partyCount: state.partyUnitIds?.length ?? 0,
  };
}

// ----------------------------------------------------------------------------
// PUBLIC API
// ----------------------------------------------------------------------------

/**
 * Save the game state to a slot
 */
export async function saveGame(slot: SaveSlot, state: GameState): Promise<SaveResult> {
  try {
    const saveData = {
      ...state,
      _saveMetadata: {
        version: 1,
        timestamp: Date.now(),
        slot,
      },
    };
    
    const json = JSON.stringify(saveData);
    
    if (isTauriAvailable()) {
      await tauriSaveGame(slot, json);
    } else {
      localStorageSaveGame(slot, json);
    }
    
    console.log(`[SAVE] Game saved to slot: ${slot}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[SAVE] Failed to save game:`, error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Load the game state from a slot
 */
/**
 * Migrate old crafted weapons to mark them as migrated
 * This preserves old saves while preventing new weapon crafting
 */
function migrateCraftedWeapons(state: GameState): void {
  if (!state.equipmentById) return;
  
  let migratedCount = 0;
  for (const [equipmentId, equipment] of Object.entries(state.equipmentById)) {
    // Check if this is a weapon that might have been crafted
    if (equipmentId.startsWith("weapon_") && typeof equipment === "object" && equipment !== null) {
      const eq = equipment as any;
      
      // If it has provenance indicating it was crafted, mark as migrated
      if (eq.provenance?.kind === "crafted" || eq.provenance?.kind === "endless_crafted") {
        if (!eq.provenance.migratedFromWeaponCrafting) {
          eq.provenance = {
            ...eq.provenance,
            migratedFromWeaponCrafting: true,
            migrationNote: "This weapon was crafted before weapon crafting moved to Gear Builder",
          };
          migratedCount++;
        }
      }
      // If no provenance but it's a weapon from a deprecated recipe ID pattern, add migration marker
      else if (!eq.provenance && (
        equipmentId.includes("iron_longsword") ||
        equipmentId.includes("runed_shortsword") ||
        equipmentId.includes("elm_recurve_bow") ||
        equipmentId.includes("oak_battlestaff") ||
        equipmentId.includes("steel_dagger") ||
        equipmentId.includes("emberclaw_repeater") ||
        equipmentId.includes("brassback_scattergun") ||
        equipmentId.includes("blazefang_saber")
      )) {
        eq.provenance = {
          kind: "crafted",
          migratedFromWeaponCrafting: true,
          migrationNote: "This weapon was crafted before weapon crafting moved to Gear Builder",
        };
        migratedCount++;
      }
    }
  }
  
  if (migratedCount > 0) {
    console.log(`[MIGRATION] Migrated ${migratedCount} crafted weapon(s) from old crafting system`);
  }
}

export async function loadGame(slot: SaveSlot): Promise<LoadResult> {
  try {
    let json: string | null;
    
    if (isTauriAvailable()) {
      json = await tauriLoadGame(slot);
    } else {
      json = localStorageLoadGame(slot);
    }
    
    if (!json) {
      return { success: false, error: "No save file found" };
    }
    
    const state = JSON.parse(json) as GameState;
    delete (state as any)._saveMetadata;
    
    // Run migration for old crafted weapons
    migrateCraftedWeapons(state);
    
    console.log(`[LOAD] Game loaded from slot: ${slot}`);
    return { success: true, state };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[LOAD] Failed to load game:`, error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Check if a save exists in a slot
 */
export async function hasSave(slot: SaveSlot): Promise<boolean> {
  try {
    if (isTauriAvailable()) {
      return await tauriHasSave(slot);
    } else {
      return localStorageHasSave(slot);
    }
  } catch {
    return false;
  }
}

/**
 * Delete a save from a slot
 */
export async function deleteSave(slot: SaveSlot): Promise<SaveResult> {
  try {
    if (isTauriAvailable()) {
      await tauriDeleteSave(slot);
    } else {
      localStorageDeleteSave(slot);
    }
    
    console.log(`[DELETE] Save deleted: ${slot}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[DELETE] Failed to delete save:`, error);
    return { success: false, error: errorMsg };
  }
}

/**
 * List all available saves with their info
 */
export async function listSaves(): Promise<SaveInfo[]> {
  try {
    let saves: SaveInfo[];
    
    if (isTauriAvailable()) {
      saves = await tauriListSaves();
      for (const save of saves) {
        const result = await loadGame(save.slot as SaveSlot);
        if (result.success && result.state) {
          save.preview = extractSavePreview(result.state);
        }
      }
    } else {
      saves = localStorageListSaves();
    }
    
    return saves;
  } catch (error) {
    console.error(`[LIST] Failed to list saves:`, error);
    return [];
  }
}

/**
 * Quick check if continue is available (any save exists)
 */
export async function canContinue(): Promise<boolean> {
  const saves = await listSaves();
  return saves.length > 0;
}

/**
 * Load the most recent save
 */
export async function loadMostRecent(): Promise<LoadResult> {
  const saves = await listSaves();
  
  if (saves.length === 0) {
    return { success: false, error: "No saves found" };
  }
  
  // Autosave takes priority if it exists
  const autosave = saves.find(s => s.slot === SAVE_SLOTS.AUTOSAVE);
  if (autosave) {
    return await loadGame(SAVE_SLOTS.AUTOSAVE);
  }
  
  // Otherwise load most recent
  return await loadGame(saves[0].slot as SaveSlot);
}

// ----------------------------------------------------------------------------
// AUTOSAVE SYSTEM
// ----------------------------------------------------------------------------

let autosaveTimer: number | null = null;
let autosaveEnabled = true;
let autosaveStateGetter: (() => GameState) | null = null;
const AUTOSAVE_INTERVAL = 60000; // 1 minute

/**
 * Enable autosave with the given state getter
 */
export function enableAutosave(getState: () => GameState): void {
  autosaveEnabled = true;
  autosaveStateGetter = getState;
  
  if (autosaveTimer !== null) {
    clearInterval(autosaveTimer);
  }
  
  autosaveTimer = window.setInterval(async () => {
    if (autosaveEnabled && autosaveStateGetter) {
      const state = autosaveStateGetter();
      if (state.phase !== "battle") {
        await saveGame(SAVE_SLOTS.AUTOSAVE, state);
      }
    }
  }, AUTOSAVE_INTERVAL);
  
  console.log("[AUTOSAVE] Enabled with interval:", AUTOSAVE_INTERVAL);
}

/**
 * Disable autosave
 */
export function disableAutosave(): void {
  autosaveEnabled = false;
  
  if (autosaveTimer !== null) {
    clearInterval(autosaveTimer);
    autosaveTimer = null;
  }
  
  console.log("[AUTOSAVE] Disabled");
}

/**
 * Trigger an immediate autosave
 */
export async function triggerAutosave(state: GameState): Promise<SaveResult> {
  if (!autosaveEnabled) {
    return { success: false, error: "Autosave is disabled" };
  }
  
  return await saveGame(SAVE_SLOTS.AUTOSAVE, state);
}

/**
 * Set autosave enabled/disabled
 */
export function setAutosaveEnabled(enabled: boolean): void {
  autosaveEnabled = enabled;
}

/**
 * Check if autosave is currently enabled
 */
export function isAutosaveEnabled(): boolean {
  return autosaveEnabled;
}

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

/**
 * Format a timestamp as a readable date string
 */
export function formatSaveTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) {
    return "Just now";
  }
  
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  }
  
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

/**
 * Get a friendly name for a save slot
 */
export function getSaveSlotName(slot: SaveSlot): string {
  switch (slot) {
    case SAVE_SLOTS.AUTOSAVE:
      return "Autosave";
    case SAVE_SLOTS.MANUAL_1:
      return "Save Slot 1";
    case SAVE_SLOTS.MANUAL_2:
      return "Save Slot 2";
    case SAVE_SLOTS.MANUAL_3:
      return "Save Slot 3";
    default:
      return slot;
  }
}
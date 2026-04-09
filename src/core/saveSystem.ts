// ============================================================================
// CHAOS CORE - SAVE SYSTEM (Headline 12)
// src/core/saveSystem.ts
// Save/load with Tauri integration and localStorage fallback
// ============================================================================

import { GameState } from "./types";
import { CampaignProgress, createDefaultCampaignProgress, loadCampaignProgress } from "./campaign";
import { withNormalizedTheaterDeploymentPresetState } from "./theaterDeploymentPreset";

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
  campaignProgress?: CampaignProgress;
  sharedCampaignMetadata?: SharedCampaignMetadata;
  error?: string;
}

export interface SharedCampaignMetadata {
  version: number;
  timestamp: number;
  slot: string;
  label: string;
  economyPreset?: string | null;
  sessionMode?: string | null;
}

type PersistedSaveState = GameState & {
  _saveMetadata?: {
    version: number;
    timestamp: number;
    slot: string;
  };
  _campaignProgressSnapshot?: CampaignProgress;
  _sharedCampaignMetadata?: SharedCampaignMetadata;
};

// Save slot constants
export const SAVE_SLOTS = {
  AUTOSAVE: "autosave",
  MANUAL_1: "save_1",
  MANUAL_2: "save_2",
  MANUAL_3: "save_3",
} as const;

export type SaveSlot = typeof SAVE_SLOTS[keyof typeof SAVE_SLOTS];

export const SHARED_CAMPAIGN_SLOTS = {
  CAMPAIGN_1: "coop_campaign_1",
  CAMPAIGN_2: "coop_campaign_2",
  CAMPAIGN_3: "coop_campaign_3",
} as const;

export type SharedCampaignSlot = typeof SHARED_CAMPAIGN_SLOTS[keyof typeof SHARED_CAMPAIGN_SLOTS];
const KNOWN_PERSISTED_SLOTS = [
  ...Object.values(SAVE_SLOTS),
  ...Object.values(SHARED_CAMPAIGN_SLOTS),
] as const;

function isPrimarySaveSlot(slot: string): slot is SaveSlot {
  return Object.values(SAVE_SLOTS).includes(slot as SaveSlot);
}

export function isSharedCampaignSlot(slot: string): slot is SharedCampaignSlot {
  return Object.values(SHARED_CAMPAIGN_SLOTS).includes(slot as SharedCampaignSlot);
}

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

function localStorageListKnownSaves(): SaveInfo[] {
  const saves: SaveInfo[] = [];
  const slots = [...KNOWN_PERSISTED_SLOTS];
  
  for (const slot of slots) {
    if (localStorageHasSave(slot)) {
      const metaStr = localStorage.getItem(STORAGE_META_PREFIX + slot);
      const meta = metaStr ? JSON.parse(metaStr) : { timestamp: 0 };
      
      let preview: SavePreview | undefined;
      try {
        const saveStr = localStorage.getItem(STORAGE_PREFIX + slot);
        if (saveStr) {
          const state = JSON.parse(saveStr) as PersistedSaveState;
          delete state._saveMetadata;
          delete state._campaignProgressSnapshot;
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
  const echoBattle = state.currentBattle?.modeContext?.kind === "echo"
    ? state.currentBattle.modeContext.echo ?? null
    : null;
  const echoRun = state.echoRun ?? null;
  const echoOperationName = echoBattle
    ? `ECHO RUN // STRATUM ${echoBattle.stratum ?? echoRun?.currentStratum ?? 1} // ENCOUNTER ${echoBattle.encounterNumber}`
    : echoRun
      ? `ECHO RUN // STRATUM ${echoRun.currentStratum} // ${echoRun.stage.replace(/_/g, " ").toUpperCase()}`
      : null;

  return {
    callsign: state.profile?.callsign ?? "Unknown",
    squadName: state.profile?.squadName ?? "Unknown Squad",
    operationName: echoOperationName ?? state.operation?.codename ?? "Unknown Operation",
    wad: state.wad ?? 0,
    partyCount: echoRun?.squadUnitIds?.length ?? state.partyUnitIds?.length ?? 0,
  };
}

function prepareSharedCampaignState(state: GameState, slot: SharedCampaignSlot, label: string, timestamp: number): GameState {
  return {
    ...state,
    lobby: null,
    session: {
      ...state.session,
      sharedCampaignSlot: slot,
      sharedCampaignLabel: label,
      sharedCampaignLastSavedAt: timestamp,
    },
  };
}

function buildPersistedState(
  slot: string,
  state: GameState,
  timestamp: number,
  sharedCampaignMetadata?: SharedCampaignMetadata,
): PersistedSaveState {
  return {
    ...state,
    _saveMetadata: {
      version: 1,
      timestamp,
      slot,
    },
    _campaignProgressSnapshot: loadCampaignProgress(),
    _sharedCampaignMetadata: sharedCampaignMetadata,
  };
}

async function savePersistedSlot(
  slot: string,
  state: GameState,
  sharedCampaignMetadata?: SharedCampaignMetadata,
): Promise<SaveResult> {
  try {
    const timestamp = sharedCampaignMetadata?.timestamp ?? Date.now();
    const saveData = buildPersistedState(slot, state, timestamp, sharedCampaignMetadata);
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

// ----------------------------------------------------------------------------
// PUBLIC API
// ----------------------------------------------------------------------------

/**
 * Save the game state to a slot
 */
export async function saveGame(slot: SaveSlot, state: GameState): Promise<SaveResult> {
  return savePersistedSlot(slot, state);
}

export async function saveSharedCampaign(
  slot: SharedCampaignSlot,
  state: GameState,
  options: {
    label?: string;
  } = {},
): Promise<SaveResult> {
  const timestamp = Date.now();
  const label = options.label?.trim() || getSharedCampaignSlotName(slot);
  const sharedCampaignState = prepareSharedCampaignState(state, slot, label, timestamp);
  return savePersistedSlot(slot, sharedCampaignState, {
    version: 1,
    timestamp,
    slot,
    label,
    economyPreset: sharedCampaignState.session.resourceLedger?.preset ?? "shared",
    sessionMode: sharedCampaignState.session.mode ?? "singleplayer",
  });
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
  return loadPersistedSlot(slot);
}

export async function loadSharedCampaign(slot: SharedCampaignSlot): Promise<LoadResult> {
  const result = await loadPersistedSlot(slot);
  if (!result.success || !result.state) {
    return result;
  }

  const metadata = result.sharedCampaignMetadata ?? {
    version: 1,
    timestamp: Date.now(),
    slot,
    label: getSharedCampaignSlotName(slot),
  };

  return {
    ...result,
    state: {
      ...result.state,
      lobby: null,
      session: {
        ...result.state.session,
        sharedCampaignSlot: metadata.slot,
        sharedCampaignLabel: metadata.label,
        sharedCampaignLastSavedAt: metadata.timestamp,
      },
    },
    sharedCampaignMetadata: metadata,
  };
}

async function loadPersistedSlot(slot: string): Promise<LoadResult> {
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
    
    const persistedState = JSON.parse(json) as PersistedSaveState;
    const campaignProgress = persistedState._campaignProgressSnapshot ?? createDefaultCampaignProgress();
    const sharedCampaignMetadata = persistedState._sharedCampaignMetadata;
    delete persistedState._saveMetadata;
    delete persistedState._campaignProgressSnapshot;
    delete persistedState._sharedCampaignMetadata;
    const state = withNormalizedTheaterDeploymentPresetState({
      ...(persistedState as GameState),
      echoRun: (persistedState as GameState).echoRun ?? null,
    });
    
    // Run migration for old crafted weapons
    migrateCraftedWeapons(state);
    
    console.log(`[LOAD] Game loaded from slot: ${slot}`);
    return { success: true, state, campaignProgress, sharedCampaignMetadata };
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

export async function hasSharedCampaignSave(slot: SharedCampaignSlot): Promise<boolean> {
  try {
    if (isTauriAvailable()) {
      return await tauriHasSave(slot);
    }
    return localStorageHasSave(slot);
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
  return listFilteredSaves(
    (slot) => isPrimarySaveSlot(slot),
    async (slot) => loadPersistedSlot(slot),
  );
}

export async function listSharedCampaignSaves(): Promise<SaveInfo[]> {
  return listFilteredSaves(
    (slot) => isSharedCampaignSlot(slot),
    async (slot) => loadPersistedSlot(slot),
  );
}

async function listFilteredSaves(
  predicate: (slot: string) => boolean,
  loader: (slot: string) => Promise<LoadResult>,
): Promise<SaveInfo[]> {
  try {
    let saves: SaveInfo[];
    
    if (isTauriAvailable()) {
      saves = await tauriListSaves();
    } else {
      saves = localStorageListKnownSaves();
    }

    const filtered = saves.filter((save) => predicate(save.slot));
    for (const save of filtered) {
      const result = await loader(save.slot);
      if (result.success && result.state) {
        save.preview = extractSavePreview(result.state);
      }
    }
    
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
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
let sharedCampaignAutosaveTimer: number | null = null;
let sharedCampaignAutosaveStateGetter: (() => GameState) | null = null;
let sharedCampaignAutosaveSlotGetter: (() => SharedCampaignSlot | null) | null = null;
const SHARED_CAMPAIGN_AUTOSAVE_INTERVAL = 60000; // 1 minute

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

export function enableSharedCampaignAutosave(
  getState: () => GameState,
  getSlot: () => SharedCampaignSlot | null,
  onSaved?: (info: { slot: SharedCampaignSlot; timestamp: number }) => void | Promise<void>,
): void {
  sharedCampaignAutosaveStateGetter = getState;
  sharedCampaignAutosaveSlotGetter = getSlot;

  if (sharedCampaignAutosaveTimer !== null) {
    clearInterval(sharedCampaignAutosaveTimer);
  }

  sharedCampaignAutosaveTimer = window.setInterval(async () => {
    if (!sharedCampaignAutosaveStateGetter || !sharedCampaignAutosaveSlotGetter) {
      return;
    }
    const slot = sharedCampaignAutosaveSlotGetter();
    const state = sharedCampaignAutosaveStateGetter();
    if (
      !slot
      || state.session.mode !== "coop_operations"
      || state.session.authorityRole !== "host"
    ) {
      return;
    }
    const result = await saveSharedCampaign(slot, state, {
      label: state.session.sharedCampaignLabel ?? getSharedCampaignSlotName(slot),
    });
    if (result.success && onSaved) {
      await onSaved({
        slot,
        timestamp: Date.now(),
      });
    }
  }, SHARED_CAMPAIGN_AUTOSAVE_INTERVAL);
}

export function disableSharedCampaignAutosave(): void {
  if (sharedCampaignAutosaveTimer !== null) {
    clearInterval(sharedCampaignAutosaveTimer);
    sharedCampaignAutosaveTimer = null;
  }
  sharedCampaignAutosaveStateGetter = null;
  sharedCampaignAutosaveSlotGetter = null;
}

export async function triggerSharedCampaignAutosave(state: GameState): Promise<SaveResult> {
  const slot = state.session.sharedCampaignSlot;
  if (!slot || !isSharedCampaignSlot(slot)) {
    return { success: false, error: "No shared campaign slot is active" };
  }
  return saveSharedCampaign(slot, state, {
    label: state.session.sharedCampaignLabel ?? getSharedCampaignSlotName(slot),
  });
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

export function getSharedCampaignSlotName(slot: SharedCampaignSlot): string {
  switch (slot) {
    case SHARED_CAMPAIGN_SLOTS.CAMPAIGN_1:
      return "Shared Campaign 1";
    case SHARED_CAMPAIGN_SLOTS.CAMPAIGN_2:
      return "Shared Campaign 2";
    case SHARED_CAMPAIGN_SLOTS.CAMPAIGN_3:
      return "Shared Campaign 3";
    default:
      return slot;
  }
}

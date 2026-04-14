// ============================================================================
// CHAOS CORE - SAVE SYSTEM (Headline 12)
// src/core/saveSystem.ts
// Save/load with Tauri integration and localStorage fallback
// ============================================================================
import { createDefaultCampaignProgress, loadCampaignProgress } from "./campaign";
import { withNormalizedTheaterDeploymentPresetState } from "./theaterDeploymentPreset";
// Save slot constants
export const SAVE_SLOTS = {
    AUTOSAVE: "autosave",
    MANUAL_1: "save_1",
    MANUAL_2: "save_2",
    MANUAL_3: "save_3",
};
export const SHARED_CAMPAIGN_SLOTS = {
    CAMPAIGN_1: "coop_campaign_1",
    CAMPAIGN_2: "coop_campaign_2",
    CAMPAIGN_3: "coop_campaign_3",
};
const KNOWN_PERSISTED_SLOTS = [
    ...Object.values(SAVE_SLOTS),
    ...Object.values(SHARED_CAMPAIGN_SLOTS),
];
function isPrimarySaveSlot(slot) {
    return Object.values(SAVE_SLOTS).includes(slot);
}
export function isSharedCampaignSlot(slot) {
    return Object.values(SHARED_CAMPAIGN_SLOTS).includes(slot);
}
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
// TAURI COMMANDS
// ----------------------------------------------------------------------------
async function tauriSaveGame(slot, json) {
    const invoke = getTauriInvoke();
    if (!invoke)
        throw new Error("Tauri not available");
    await invoke("save_game", { slot, json });
}
async function tauriLoadGame(slot) {
    const invoke = getTauriInvoke();
    if (!invoke)
        throw new Error("Tauri not available");
    return (await invoke("load_game", { slot }));
}
async function tauriHasSave(slot) {
    const invoke = getTauriInvoke();
    if (!invoke)
        throw new Error("Tauri not available");
    return (await invoke("has_save", { slot }));
}
async function tauriDeleteSave(slot) {
    const invoke = getTauriInvoke();
    if (!invoke)
        throw new Error("Tauri not available");
    await invoke("delete_save", { slot });
}
async function tauriListSaves() {
    const invoke = getTauriInvoke();
    if (!invoke)
        throw new Error("Tauri not available");
    return (await invoke("list_saves"));
}
// ----------------------------------------------------------------------------
// LOCALSTORAGE FALLBACK
// ----------------------------------------------------------------------------
const STORAGE_PREFIX = "chaoscore_save_";
const STORAGE_META_PREFIX = "chaoscore_meta_";
function localStorageSaveGame(slot, json) {
    localStorage.setItem(STORAGE_PREFIX + slot, json);
    localStorage.setItem(STORAGE_META_PREFIX + slot, JSON.stringify({
        timestamp: Date.now(),
    }));
}
function localStorageLoadGame(slot) {
    return localStorage.getItem(STORAGE_PREFIX + slot);
}
function localStorageHasSave(slot) {
    return localStorage.getItem(STORAGE_PREFIX + slot) !== null;
}
function localStorageDeleteSave(slot) {
    localStorage.removeItem(STORAGE_PREFIX + slot);
    localStorage.removeItem(STORAGE_META_PREFIX + slot);
}
function localStorageListKnownSaves() {
    const saves = [];
    const slots = [...KNOWN_PERSISTED_SLOTS];
    for (const slot of slots) {
        if (localStorageHasSave(slot)) {
            const metaStr = localStorage.getItem(STORAGE_META_PREFIX + slot);
            const meta = metaStr ? JSON.parse(metaStr) : { timestamp: 0 };
            let preview;
            try {
                const saveStr = localStorage.getItem(STORAGE_PREFIX + slot);
                if (saveStr) {
                    const state = JSON.parse(saveStr);
                    delete state._saveMetadata;
                    delete state._campaignProgressSnapshot;
                    preview = extractSavePreview(state);
                }
            }
            catch {
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
function extractSavePreview(state) {
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
function prepareSharedCampaignState(state, slot, label, timestamp) {
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
function buildPersistedState(slot, state, timestamp, sharedCampaignMetadata) {
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
async function savePersistedSlot(slot, state, sharedCampaignMetadata) {
    try {
        const timestamp = sharedCampaignMetadata?.timestamp ?? Date.now();
        const saveData = buildPersistedState(slot, state, timestamp, sharedCampaignMetadata);
        const json = JSON.stringify(saveData);
        if (isTauriAvailable()) {
            await tauriSaveGame(slot, json);
        }
        else {
            localStorageSaveGame(slot, json);
        }
        console.log(`[SAVE] Game saved to slot: ${slot}`);
        return { success: true };
    }
    catch (error) {
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
export async function saveGame(slot, state) {
    return savePersistedSlot(slot, state);
}
export async function saveSharedCampaign(slot, state, options = {}) {
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
function migrateCraftedWeapons(state) {
    if (!state.equipmentById)
        return;
    let migratedCount = 0;
    for (const [equipmentId, equipment] of Object.entries(state.equipmentById)) {
        // Check if this is a weapon that might have been crafted
        if (equipmentId.startsWith("weapon_") && typeof equipment === "object" && equipment !== null) {
            const eq = equipment;
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
            else if (!eq.provenance && (equipmentId.includes("iron_longsword") ||
                equipmentId.includes("runed_shortsword") ||
                equipmentId.includes("elm_recurve_bow") ||
                equipmentId.includes("oak_battlestaff") ||
                equipmentId.includes("steel_dagger") ||
                equipmentId.includes("emberclaw_repeater") ||
                equipmentId.includes("brassback_scattergun") ||
                equipmentId.includes("blazefang_saber"))) {
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
export async function loadGame(slot) {
    return loadPersistedSlot(slot);
}
export async function loadSharedCampaign(slot) {
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
async function loadPersistedSlot(slot) {
    try {
        let json;
        if (isTauriAvailable()) {
            json = await tauriLoadGame(slot);
        }
        else {
            json = localStorageLoadGame(slot);
        }
        if (!json) {
            return { success: false, error: "No save file found" };
        }
        const persistedState = JSON.parse(json);
        const campaignProgress = persistedState._campaignProgressSnapshot ?? createDefaultCampaignProgress();
        const sharedCampaignMetadata = persistedState._sharedCampaignMetadata;
        delete persistedState._saveMetadata;
        delete persistedState._campaignProgressSnapshot;
        delete persistedState._sharedCampaignMetadata;
        const state = withNormalizedTheaterDeploymentPresetState({
            ...persistedState,
            echoRun: persistedState.echoRun ?? null,
        });
        // Run migration for old crafted weapons
        migrateCraftedWeapons(state);
        console.log(`[LOAD] Game loaded from slot: ${slot}`);
        return { success: true, state, campaignProgress, sharedCampaignMetadata };
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`[LOAD] Failed to load game:`, error);
        return { success: false, error: errorMsg };
    }
}
/**
 * Check if a save exists in a slot
 */
export async function hasSave(slot) {
    try {
        if (isTauriAvailable()) {
            return await tauriHasSave(slot);
        }
        else {
            return localStorageHasSave(slot);
        }
    }
    catch {
        return false;
    }
}
export async function hasSharedCampaignSave(slot) {
    try {
        if (isTauriAvailable()) {
            return await tauriHasSave(slot);
        }
        return localStorageHasSave(slot);
    }
    catch {
        return false;
    }
}
/**
 * Delete a save from a slot
 */
export async function deleteSave(slot) {
    try {
        if (isTauriAvailable()) {
            await tauriDeleteSave(slot);
        }
        else {
            localStorageDeleteSave(slot);
        }
        console.log(`[DELETE] Save deleted: ${slot}`);
        return { success: true };
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`[DELETE] Failed to delete save:`, error);
        return { success: false, error: errorMsg };
    }
}
/**
 * List all available saves with their info
 */
export async function listSaves() {
    return listFilteredSaves((slot) => isPrimarySaveSlot(slot), async (slot) => loadPersistedSlot(slot));
}
export async function listSharedCampaignSaves() {
    return listFilteredSaves((slot) => isSharedCampaignSlot(slot), async (slot) => loadPersistedSlot(slot));
}
async function listFilteredSaves(predicate, loader) {
    try {
        let saves;
        if (isTauriAvailable()) {
            saves = await tauriListSaves();
        }
        else {
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
    }
    catch (error) {
        console.error(`[LIST] Failed to list saves:`, error);
        return [];
    }
}
/**
 * Quick check if continue is available (any save exists)
 */
export async function canContinue() {
    const saves = await listSaves();
    return saves.length > 0;
}
/**
 * Load the most recent save
 */
export async function loadMostRecent() {
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
    return await loadGame(saves[0].slot);
}
// ----------------------------------------------------------------------------
// AUTOSAVE SYSTEM
// ----------------------------------------------------------------------------
let autosaveTimer = null;
let autosaveEnabled = true;
let autosaveStateGetter = null;
const AUTOSAVE_INTERVAL = 60000; // 1 minute
let sharedCampaignAutosaveTimer = null;
let sharedCampaignAutosaveStateGetter = null;
let sharedCampaignAutosaveSlotGetter = null;
const SHARED_CAMPAIGN_AUTOSAVE_INTERVAL = 60000; // 1 minute
/**
 * Enable autosave with the given state getter
 */
export function enableAutosave(getState) {
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
export function disableAutosave() {
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
export async function triggerAutosave(state) {
    if (!autosaveEnabled) {
        return { success: false, error: "Autosave is disabled" };
    }
    return await saveGame(SAVE_SLOTS.AUTOSAVE, state);
}
/**
 * Set autosave enabled/disabled
 */
export function setAutosaveEnabled(enabled) {
    autosaveEnabled = enabled;
}
/**
 * Check if autosave is currently enabled
 */
export function isAutosaveEnabled() {
    return autosaveEnabled;
}
export function enableSharedCampaignAutosave(getState, getSlot, onSaved) {
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
        if (!slot
            || state.session.mode !== "coop_operations"
            || state.session.authorityRole !== "host") {
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
export function disableSharedCampaignAutosave() {
    if (sharedCampaignAutosaveTimer !== null) {
        clearInterval(sharedCampaignAutosaveTimer);
        sharedCampaignAutosaveTimer = null;
    }
    sharedCampaignAutosaveStateGetter = null;
    sharedCampaignAutosaveSlotGetter = null;
}
export async function triggerSharedCampaignAutosave(state) {
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
export function formatSaveTimestamp(timestamp) {
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
export function getSaveSlotName(slot) {
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
export function getSharedCampaignSlotName(slot) {
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

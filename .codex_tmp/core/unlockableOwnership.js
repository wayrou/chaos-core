// ============================================================================
// CHAOS CORE - UNLOCKABLE OWNERSHIP TRACKING
// Manages player ownership of chassis, doctrines, and field mods
// ============================================================================
import { getGameState, updateGameState } from "../state/gameStore";
import { getUnlockableById, getUnlockablesByType } from "./unlockables";
import { getDecorState, grantDecorItem } from "./decorSystem";
// ----------------------------------------------------------------------------
// OWNERSHIP API
// ----------------------------------------------------------------------------
/**
 * Check if player owns an unlockable
 */
export function hasUnlock(unlockableId) {
    const state = getGameState();
    const unlockable = getUnlockableById(unlockableId);
    if (!unlockable) {
        console.warn(`[UNLOCKABLES] Unknown unlockable ID: ${unlockableId}`);
        return false;
    }
    switch (unlockable.type) {
        case "chassis":
            return (state.unlockedChassisIds || []).includes(unlockableId);
        case "doctrine":
            return (state.unlockedDoctrineIds || []).includes(unlockableId);
        case "field_mod":
            // Field mods are always available (they're not permanently unlocked)
            // But we can track them if needed in the future
            return true; // For now, field mods are always available
        case "decor":
            return getDecorState(state).owned.includes(unlockableId);
        default:
            return false;
    }
}
/**
 * Grant an unlockable to the player
 */
export function grantUnlock(unlockableId, reason) {
    const unlockable = getUnlockableById(unlockableId);
    if (!unlockable) {
        console.warn(`[UNLOCKABLES] Cannot grant unknown unlockable: ${unlockableId}`);
        return;
    }
    // Check if already owned
    if (hasUnlock(unlockableId)) {
        console.log(`[UNLOCKABLES] Already owned: ${unlockableId}`);
        return;
    }
    // Grant based on type
    switch (unlockable.type) {
        case "chassis":
            updateGameState(state => ({
                ...state,
                unlockedChassisIds: [...(state.unlockedChassisIds || []), unlockableId],
            }));
            console.log(`[UNLOCKABLES] ✓ Granted chassis: ${unlockable.displayName}${reason ? ` (${reason})` : ""}`);
            break;
        case "doctrine":
            updateGameState(state => ({
                ...state,
                unlockedDoctrineIds: [...(state.unlockedDoctrineIds || []), unlockableId],
            }));
            console.log(`[UNLOCKABLES] ✓ Granted doctrine: ${unlockable.displayName}${reason ? ` (${reason})` : ""}`);
            break;
        case "field_mod":
            // Field mods are not permanently unlocked, they're run-scoped
            // But we can track them for future use
            console.log(`[UNLOCKABLES] Field mod unlocked: ${unlockable.displayName}${reason ? ` (${reason})` : ""}`);
            break;
        case "decor":
            if (grantDecorItem(unlockableId)) {
                console.log(`[UNLOCKABLES] Granted decor: ${unlockable.displayName}${reason ? ` (${reason})` : ""}`);
            }
            break;
        default:
            console.warn(`[UNLOCKABLES] Unknown unlockable type: ${unlockable.type}`);
    }
}
/**
 * Get all owned unlockables of a specific type
 */
export function listUnlocksByType(type) {
    const state = getGameState();
    const allOfType = getUnlockablesByType(type);
    switch (type) {
        case "chassis":
            const ownedChassisIds = state.unlockedChassisIds || [];
            return allOfType.filter(u => ownedChassisIds.includes(u.id));
        case "doctrine":
            const ownedDoctrineIds = state.unlockedDoctrineIds || [];
            return allOfType.filter(u => ownedDoctrineIds.includes(u.id));
        case "field_mod":
            // Field mods are always available (not permanently unlocked)
            return allOfType;
        case "decor":
            const ownedDecorIds = getDecorState(state).owned;
            return allOfType.filter(u => ownedDecorIds.includes(u.id));
        default:
            return [];
    }
}
/**
 * Get all owned unlockable IDs (for persistence/save)
 */
export function getAllOwnedUnlockableIds() {
    const state = getGameState();
    return {
        chassis: state.unlockedChassisIds || [],
        doctrines: state.unlockedDoctrineIds || [],
    };
}
export function getAllOwnedUnlockableIdList() {
    const state = getGameState();
    const owned = getAllOwnedUnlockableIds();
    return [
        ...owned.chassis,
        ...owned.doctrines,
        ...getDecorState(state).owned,
    ];
}
/**
 * Initialize ownership from save data
 */
export function initializeOwnership(chassisIds, doctrineIds) {
    updateGameState(state => ({
        ...state,
        unlockedChassisIds: chassisIds,
        unlockedDoctrineIds: doctrineIds,
    }));
}

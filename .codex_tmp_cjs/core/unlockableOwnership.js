"use strict";
// ============================================================================
// CHAOS CORE - UNLOCKABLE OWNERSHIP TRACKING
// Manages player ownership of chassis, doctrines, and field mods
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasUnlock = hasUnlock;
exports.grantUnlock = grantUnlock;
exports.listUnlocksByType = listUnlocksByType;
exports.getAllOwnedUnlockableIds = getAllOwnedUnlockableIds;
exports.getAllOwnedUnlockableIdList = getAllOwnedUnlockableIdList;
exports.initializeOwnership = initializeOwnership;
const gameStore_1 = require("../state/gameStore");
const unlockables_1 = require("./unlockables");
const decorSystem_1 = require("./decorSystem");
// ----------------------------------------------------------------------------
// OWNERSHIP API
// ----------------------------------------------------------------------------
/**
 * Check if player owns an unlockable
 */
function hasUnlock(unlockableId) {
    const state = (0, gameStore_1.getGameState)();
    const unlockable = (0, unlockables_1.getUnlockableById)(unlockableId);
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
            return (0, decorSystem_1.getDecorState)(state).owned.includes(unlockableId);
        default:
            return false;
    }
}
/**
 * Grant an unlockable to the player
 */
function grantUnlock(unlockableId, reason) {
    const unlockable = (0, unlockables_1.getUnlockableById)(unlockableId);
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
            (0, gameStore_1.updateGameState)(state => ({
                ...state,
                unlockedChassisIds: [...(state.unlockedChassisIds || []), unlockableId],
            }));
            console.log(`[UNLOCKABLES] ✓ Granted chassis: ${unlockable.displayName}${reason ? ` (${reason})` : ""}`);
            break;
        case "doctrine":
            (0, gameStore_1.updateGameState)(state => ({
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
            if ((0, decorSystem_1.grantDecorItem)(unlockableId)) {
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
function listUnlocksByType(type) {
    const state = (0, gameStore_1.getGameState)();
    const allOfType = (0, unlockables_1.getUnlockablesByType)(type);
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
            const ownedDecorIds = (0, decorSystem_1.getDecorState)(state).owned;
            return allOfType.filter(u => ownedDecorIds.includes(u.id));
        default:
            return [];
    }
}
/**
 * Get all owned unlockable IDs (for persistence/save)
 */
function getAllOwnedUnlockableIds() {
    const state = (0, gameStore_1.getGameState)();
    return {
        chassis: state.unlockedChassisIds || [],
        doctrines: state.unlockedDoctrineIds || [],
    };
}
function getAllOwnedUnlockableIdList() {
    const state = (0, gameStore_1.getGameState)();
    const owned = getAllOwnedUnlockableIds();
    return [
        ...owned.chassis,
        ...owned.doctrines,
        ...(0, decorSystem_1.getDecorState)(state).owned,
    ];
}
/**
 * Initialize ownership from save data
 */
function initializeOwnership(chassisIds, doctrineIds) {
    (0, gameStore_1.updateGameState)(state => ({
        ...state,
        unlockedChassisIds: chassisIds,
        unlockedDoctrineIds: doctrineIds,
    }));
}

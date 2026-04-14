// ============================================================================
// CHAOS CORE - GAME STORE (Headline 12)
// src/state/gameStore.ts
// Centralized state management
// ============================================================================
import { createNewGameState } from "../core/initialState";
import { getTechnicaRegistryFingerprint } from "../content/technica";
import { syncPublishedTechnicaContentState } from "../content/technica/stateSync";
import { withNormalizedLobbyState } from "../core/multiplayerLobby";
import { withNormalizedNotesState } from "../core/notesSystem";
import { getMountedOrActiveBattleState, grantSessionResources, mountBattleContextById, mountBattleState, withNormalizedSessionState, } from "../core/session";
import { withNormalizedFoundryState } from "../core/foundrySystem";
import { withNormalizedSchemaState } from "../core/schemaSystem";
import { withNormalizedTheaterDeploymentPresetState } from "../core/theaterDeploymentPreset";
import { withNormalizedWeaponsmithState } from "../core/weaponsmith";
// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------
let _gameState = null;
const listeners = new Set();
function syncPublishedTechnicaContent(state) {
    return syncPublishedTechnicaContentState(state, getTechnicaRegistryFingerprint());
}
function syncSchemaState(state) {
    const normalizedState = {
        ...state,
        echoRun: state.echoRun ?? null,
    };
    return withNormalizedLobbyState(withNormalizedSessionState(withNormalizedNotesState(withNormalizedFoundryState(withNormalizedSchemaState(withNormalizedWeaponsmithState(withNormalizedTheaterDeploymentPresetState(normalizedState)))))));
}
// ----------------------------------------------------------------------------
// CORE API
// ----------------------------------------------------------------------------
/**
 * Get current game state, lazily creating it if needed.
 * Includes a recursion guard to prevent infinite loops from normalizers.
 */
let _getGameStateDepth = 0;
let _setGameStateDepth = 0;
export function getGameState() {
    _getGameStateDepth++;
    if (_getGameStateDepth > 5) {
        _getGameStateDepth--;
        return _gameState;
    }
    if (!_gameState) {
        _gameState = syncSchemaState(syncPublishedTechnicaContent(createNewGameState()));
    }
    else {
        _gameState = syncSchemaState(syncPublishedTechnicaContent(_gameState));
    }
    _getGameStateDepth--;
    return _gameState;
}
/**
 * Replace the entire game state and notify listeners.
 * Includes a recursion guard to prevent infinite loops from listeners.
 */
export function setGameState(newState) {
    _setGameStateDepth++;
    if (_setGameStateDepth > 5) {
        _setGameStateDepth--;
        return;
    }
    _gameState = syncSchemaState(syncPublishedTechnicaContent(newState));
    notifyListeners();
    _setGameStateDepth--;
}
/**
 * Convenience: update state immutably via an updater.
 */
export function updateGameState(updater) {
    const prev = getGameState();
    const next = updater(prev);
    setGameState(next);
    return next;
}
/**
 * Subscribe to state changes
 */
export function subscribe(listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
/**
 * Start a completely new run
 */
export function resetToNewGame() {
    const state = createNewGameState();
    setGameState(state);
}
// ----------------------------------------------------------------------------
// LISTENERS
// ----------------------------------------------------------------------------
function notifyListeners() {
    const state = getGameState();
    for (const listener of listeners) {
        listener(state);
    }
}
// ----------------------------------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------------------------------
/**
 * Check if game state exists
 */
export function hasGameState() {
    return _gameState !== null;
}
/**
 * Get a specific part of the state
 */
export function selectState(selector) {
    return selector(getGameState());
}
/**
 * Create a selector that only triggers when selected value changes
 */
export function createSelector(selector, onChange) {
    let previousValue;
    const listener = (state) => {
        const newValue = selector(state);
        if (newValue !== previousValue) {
            previousValue = newValue;
            onChange(newValue);
        }
    };
    previousValue = selector(getGameState());
    return subscribe(listener);
}
// ----------------------------------------------------------------------------
// PHASE MANAGEMENT
// ----------------------------------------------------------------------------
export function setPhase(phase) {
    updateGameState(state => ({
        ...state,
        phase,
    }));
}
export function getPhase() {
    return getGameState().phase;
}
// ----------------------------------------------------------------------------
// RESOURCE HELPERS
// ----------------------------------------------------------------------------
export function addResources(resources) {
    updateGameState((state) => grantSessionResources(state, { resources }));
}
export function addWad(amount) {
    updateGameState((state) => grantSessionResources(state, { wad: amount }));
}
export function spendWad(amount) {
    const state = getGameState();
    if (state.wad < amount) {
        return false;
    }
    updateGameState(s => ({
        ...s,
        wad: s.wad - amount,
    }));
    return true;
}
// ----------------------------------------------------------------------------
// UNIT HELPERS
// ----------------------------------------------------------------------------
export function getUnit(unitId) {
    return getGameState().unitsById[unitId];
}
export function getPartyUnits() {
    const state = getGameState();
    return state.partyUnitIds.map(id => state.unitsById[id]).filter(Boolean);
}
export function updateUnit(unitId, updates) {
    updateGameState(state => ({
        ...state,
        unitsById: {
            ...state.unitsById,
            [unitId]: {
                ...state.unitsById[unitId],
                ...updates,
            },
        },
    }));
}
// ----------------------------------------------------------------------------
// BATTLE STATE HELPERS
// ----------------------------------------------------------------------------
export function setBattleState(battle) {
    updateGameState(state => mountBattleState(state, battle));
}
export function mountBattleById(battleId) {
    const nextState = updateGameState((state) => mountBattleContextById(state, battleId));
    return nextState.currentBattle;
}
export function clearBattle() {
    updateGameState(state => ({
        ...state,
        currentBattle: null,
        phase: "shell",
    }));
}
export function getBattleState() {
    return getMountedOrActiveBattleState(getGameState());
}
// ----------------------------------------------------------------------------
// OPERATION HELPERS
// ----------------------------------------------------------------------------
export function updateOperation(updates) {
    const definedUpdates = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined));
    updateGameState(state => ({
        ...state,
        operation: state.operation
            ? {
                ...state.operation,
                ...definedUpdates,
            }
            : state.operation,
    }));
}
export function setCurrentRoom(roomId) {
    updateOperation({ currentRoomId: roomId });
}

"use strict";
// ============================================================================
// CHAOS CORE - GAME STORE (Headline 12)
// src/state/gameStore.ts
// Centralized state management
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGameState = getGameState;
exports.setGameState = setGameState;
exports.updateGameState = updateGameState;
exports.subscribe = subscribe;
exports.resetToNewGame = resetToNewGame;
exports.hasGameState = hasGameState;
exports.selectState = selectState;
exports.createSelector = createSelector;
exports.setPhase = setPhase;
exports.getPhase = getPhase;
exports.addResources = addResources;
exports.addWad = addWad;
exports.spendWad = spendWad;
exports.getUnit = getUnit;
exports.getPartyUnits = getPartyUnits;
exports.updateUnit = updateUnit;
exports.setBattleState = setBattleState;
exports.mountBattleById = mountBattleById;
exports.clearBattle = clearBattle;
exports.getBattleState = getBattleState;
exports.updateOperation = updateOperation;
exports.setCurrentRoom = setCurrentRoom;
const initialState_1 = require("../core/initialState");
const technica_1 = require("../content/technica");
const stateSync_1 = require("../content/technica/stateSync");
const multiplayerLobby_1 = require("../core/multiplayerLobby");
const notesSystem_1 = require("../core/notesSystem");
const session_1 = require("../core/session");
const foundrySystem_1 = require("../core/foundrySystem");
const schemaSystem_1 = require("../core/schemaSystem");
const theaterDeploymentPreset_1 = require("../core/theaterDeploymentPreset");
const weaponsmith_1 = require("../core/weaponsmith");
// ----------------------------------------------------------------------------
// STATE
// ----------------------------------------------------------------------------
let _gameState = null;
const listeners = new Set();
function syncPublishedTechnicaContent(state) {
    return (0, stateSync_1.syncPublishedTechnicaContentState)(state, (0, technica_1.getTechnicaRegistryFingerprint)());
}
function syncSchemaState(state) {
    const normalizedState = {
        ...state,
        echoRun: state.echoRun ?? null,
    };
    return (0, multiplayerLobby_1.withNormalizedLobbyState)((0, session_1.withNormalizedSessionState)((0, notesSystem_1.withNormalizedNotesState)((0, foundrySystem_1.withNormalizedFoundryState)((0, schemaSystem_1.withNormalizedSchemaState)((0, weaponsmith_1.withNormalizedWeaponsmithState)((0, theaterDeploymentPreset_1.withNormalizedTheaterDeploymentPresetState)(normalizedState)))))));
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
function getGameState() {
    _getGameStateDepth++;
    if (_getGameStateDepth > 5) {
        _getGameStateDepth--;
        return _gameState;
    }
    if (!_gameState) {
        _gameState = syncSchemaState(syncPublishedTechnicaContent((0, initialState_1.createNewGameState)()));
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
function setGameState(newState) {
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
function updateGameState(updater) {
    const prev = getGameState();
    const next = updater(prev);
    setGameState(next);
    return next;
}
/**
 * Subscribe to state changes
 */
function subscribe(listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
/**
 * Start a completely new run
 */
function resetToNewGame() {
    const state = (0, initialState_1.createNewGameState)();
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
function hasGameState() {
    return _gameState !== null;
}
/**
 * Get a specific part of the state
 */
function selectState(selector) {
    return selector(getGameState());
}
/**
 * Create a selector that only triggers when selected value changes
 */
function createSelector(selector, onChange) {
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
function setPhase(phase) {
    updateGameState(state => ({
        ...state,
        phase,
    }));
}
function getPhase() {
    return getGameState().phase;
}
// ----------------------------------------------------------------------------
// RESOURCE HELPERS
// ----------------------------------------------------------------------------
function addResources(resources) {
    updateGameState((state) => (0, session_1.grantSessionResources)(state, { resources }));
}
function addWad(amount) {
    updateGameState((state) => (0, session_1.grantSessionResources)(state, { wad: amount }));
}
function spendWad(amount) {
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
function getUnit(unitId) {
    return getGameState().unitsById[unitId];
}
function getPartyUnits() {
    const state = getGameState();
    return state.partyUnitIds.map(id => state.unitsById[id]).filter(Boolean);
}
function updateUnit(unitId, updates) {
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
function setBattleState(battle) {
    updateGameState(state => (0, session_1.mountBattleState)(state, battle));
}
function mountBattleById(battleId) {
    const nextState = updateGameState((state) => (0, session_1.mountBattleContextById)(state, battleId));
    return nextState.currentBattle;
}
function clearBattle() {
    updateGameState(state => ({
        ...state,
        currentBattle: null,
        phase: "shell",
    }));
}
function getBattleState() {
    return (0, session_1.getMountedOrActiveBattleState)(getGameState());
}
// ----------------------------------------------------------------------------
// OPERATION HELPERS
// ----------------------------------------------------------------------------
function updateOperation(updates) {
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
function setCurrentRoom(roomId) {
    updateOperation({ currentRoomId: roomId });
}

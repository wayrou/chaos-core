"use strict";
// ============================================================================
// CHAOS CORE - CAMPAIGN SYNC
// Syncs campaign active run with game state OperationRun format
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCampaignToGameState = syncCampaignToGameState;
exports.getCurrentNodeFromCampaign = getCurrentNodeFromCampaign;
exports.getAvailableNodes = getAvailableNodes;
exports.isNodeAccessible = isNodeAccessible;
const campaignManager_1 = require("./campaignManager");
const theaterSystem_1 = require("./theaterSystem");
const gameStore_1 = require("../state/gameStore");
/**
 * Sync campaign active run to game state
 * Call this before rendering operation map screen
 */
function syncCampaignToGameState() {
    const activeRun = (0, campaignManager_1.getActiveRun)();
    if (!activeRun) {
        // No active run - clear operation
        (0, gameStore_1.updateGameState)(prev => ({
            ...prev,
            operation: null,
            phase: "shell",
        }));
        return;
    }
    // Convert to OperationRun format
    const operation = (0, theaterSystem_1.ensureOperationHasTheater)((0, campaignManager_1.activeRunToOperationRun)(activeRun));
    // Update game state
    (0, gameStore_1.updateGameState)(prev => ({
        ...prev,
        operation: operation,
        phase: "operation",
    }));
}
/**
 * Get current node from campaign active run
 */
function getCurrentNodeFromCampaign() {
    const activeRun = (0, campaignManager_1.getActiveRun)();
    if (!activeRun)
        return null;
    const currentFloorMap = activeRun.nodeMapByFloor[activeRun.floorIndex];
    if (!currentFloorMap)
        return null;
    return currentFloorMap.nodes.find(n => n.id === activeRun.currentNodeId) || null;
}
/**
 * Get available nodes (forward-only branching - nodes connected from current node that aren't cleared)
 */
function getAvailableNodes() {
    const activeRun = (0, campaignManager_1.getActiveRun)();
    if (!activeRun)
        return [];
    const currentFloorMap = activeRun.nodeMapByFloor[activeRun.floorIndex];
    if (!currentFloorMap)
        return [];
    // Use forward-only branching logic
    const availableNodes = (0, campaignManager_1.getAvailableNextNodes)(activeRun.currentNodeId, currentFloorMap, activeRun.clearedNodeIds);
    return availableNodes.map(n => n.id);
}
/**
 * Check if node is accessible (forward-only branching - must be connected from current node and not cleared)
 */
function isNodeAccessible(nodeId) {
    const activeRun = (0, campaignManager_1.getActiveRun)();
    if (!activeRun)
        return false;
    // Current node is always accessible
    if (nodeId === activeRun.currentNodeId)
        return true;
    // Check if this is an available next node (forward-only branching)
    const availableNodes = getAvailableNodes();
    return availableNodes.includes(nodeId);
}

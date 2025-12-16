// ============================================================================
// CHAOS CORE - CAMPAIGN SYNC
// Syncs campaign active run with game state OperationRun format
// ============================================================================

import { GameState, OperationRun } from "./types";
import { getActiveRun, activeRunToOperationRun, getAvailableNextNodes } from "./campaignManager";
import { updateGameState } from "../state/gameStore";

/**
 * Sync campaign active run to game state
 * Call this before rendering operation map screen
 */
export function syncCampaignToGameState(): void {
  const activeRun = getActiveRun();
  if (!activeRun) {
    // No active run - clear operation
    updateGameState(prev => ({
      ...prev,
      operation: null,
      phase: "shell",
    }));
    return;
  }
  
  // Convert to OperationRun format
  const operation = activeRunToOperationRun(activeRun);
  
  // Update game state
  updateGameState(prev => ({
    ...prev,
    operation: operation as any,
    phase: "operation",
  }));
}

/**
 * Get current node from campaign active run
 */
export function getCurrentNodeFromCampaign(): import("./campaign").NodeMap["nodes"][0] | null {
  const activeRun = getActiveRun();
  if (!activeRun) return null;
  
  const currentFloorMap = activeRun.nodeMapByFloor[activeRun.floorIndex];
  if (!currentFloorMap) return null;
  
  return currentFloorMap.nodes.find(n => n.id === activeRun.currentNodeId) || null;
}

/**
 * Get available nodes (forward-only branching - nodes connected from current node that aren't cleared)
 */
export function getAvailableNodes(): string[] {
  const activeRun = getActiveRun();
  if (!activeRun) return [];

  const currentFloorMap = activeRun.nodeMapByFloor[activeRun.floorIndex];
  if (!currentFloorMap) return [];

  // Use forward-only branching logic
  const availableNodes = getAvailableNextNodes(
    activeRun.currentNodeId,
    currentFloorMap,
    activeRun.clearedNodeIds
  );

  return availableNodes.map(n => n.id);
}

/**
 * Check if node is accessible (forward-only branching - must be connected from current node and not cleared)
 */
export function isNodeAccessible(nodeId: string): boolean {
  const activeRun = getActiveRun();
  if (!activeRun) return false;

  // Current node is always accessible
  if (nodeId === activeRun.currentNodeId) return true;

  // Check if this is an available next node (forward-only branching)
  const availableNodes = getAvailableNodes();
  return availableNodes.includes(nodeId);
}


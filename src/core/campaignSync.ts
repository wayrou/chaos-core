// ============================================================================
// CHAOS CORE - CAMPAIGN SYNC
// Syncs campaign active run with game state OperationRun format
// ============================================================================

import { GameState, OperationRun } from "./types";
import { getActiveRun, activeRunToOperationRun } from "./campaignManager";
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
      phase: "basecamp",
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
 * Get available nodes (connected and not cleared)
 */
export function getAvailableNodes(): string[] {
  const activeRun = getActiveRun();
  if (!activeRun) return [];
  
  const currentFloorMap = activeRun.nodeMapByFloor[activeRun.floorIndex];
  if (!currentFloorMap) return [];
  
  const connections = currentFloorMap.connections[activeRun.currentNodeId] || [];
  return connections.filter(nodeId => {
    // Available if not cleared OR if it's the current node
    return !activeRun.clearedNodeIds.includes(nodeId) || nodeId === activeRun.currentNodeId;
  });
}

/**
 * Check if node is accessible (cleared or connected to current)
 */
export function isNodeAccessible(nodeId: string): boolean {
  const activeRun = getActiveRun();
  if (!activeRun) return false;
  
  // Current node is always accessible
  if (nodeId === activeRun.currentNodeId) return true;
  
  // Cleared nodes are accessible
  if (activeRun.clearedNodeIds.includes(nodeId)) return true;
  
  // Check if connected to current node
  const currentFloorMap = activeRun.nodeMapByFloor[activeRun.floorIndex];
  if (!currentFloorMap) return false;
  
  const connections = currentFloorMap.connections[activeRun.currentNodeId] || [];
  return connections.includes(nodeId);
}


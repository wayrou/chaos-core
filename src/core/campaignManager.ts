// ============================================================================
// CHAOS CORE - CAMPAIGN MANAGER
// Coordinates campaign flow: starting runs, progressing nodes, floor transitions
// ============================================================================

import {
  CampaignProgress,
  ActiveRunState,
  OperationId,
  Difficulty,
  NodeMap,
  PendingBattleState,
  completeOperation as markOperationComplete,
} from "./campaign";
import {
  loadCampaignProgress,
  saveCampaignProgress,
  OPERATION_DEFINITIONS,
} from "./campaign";
import { generateNodeMap } from "./nodeMapGenerator";
import { generateEncounter, EncounterDefinition } from "./encounterGenerator";
import { generateOperation } from "./procedural";
import { OperationRun, Floor, RoomNode } from "./types";

// ----------------------------------------------------------------------------
// CAMPAIGN MANAGER
// ----------------------------------------------------------------------------

/**
 * Start a new operation run
 */
export function startOperationRun(
  operationId: OperationId,
  difficulty: Difficulty = "normal",
  customFloors?: number
): CampaignProgress {
  const progress = loadCampaignProgress();
  const opDef = OPERATION_DEFINITIONS[operationId];
  
  if (!opDef) {
    throw new Error(`Unknown operation: ${operationId}`);
  }
  
  const floorsTotal = customFloors || opDef.floors;
  const rngSeed = generateRunSeed();
  
  // Generate node maps for all floors
  const nodeMapByFloor: Record<number, NodeMap> = {};
  for (let i = 0; i < floorsTotal; i++) {
    nodeMapByFloor[i] = generateNodeMap(i, floorsTotal, difficulty, rngSeed);
  }
  
  // Create active run state
  const activeRun: ActiveRunState = {
    operationId,
    difficulty,
    floorsTotal,
    floorIndex: 0,
    nodeMapByFloor,
    currentNodeId: nodeMapByFloor[0].startNodeId,
    clearedNodeIds: [nodeMapByFloor[0].startNodeId], // Start node is cleared
    rngSeed,
    battlesWon: 0,
    battlesLost: 0,
    retries: 0,
    nodesCleared: 1,
  };
  
  const updated = {
    ...progress,
    activeRun,
  };
  
  saveCampaignProgress(updated);
  console.log(`[CAMPAIGN] Started operation: ${operationId}, difficulty: ${difficulty}, floors: ${floorsTotal}`);
  
  return updated;
}

/**
 * Mark a node as cleared
 */
export function clearNode(nodeId: string): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    throw new Error("No active run");
  }
  
  const activeRun = progress.activeRun;
  if (activeRun.clearedNodeIds.includes(nodeId)) {
    return progress; // Already cleared
  }
  
  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      clearedNodeIds: [...activeRun.clearedNodeIds, nodeId],
      nodesCleared: activeRun.nodesCleared + 1,
    },
  };
  
  saveCampaignProgress(updated);
  return updated;
}

/**
 * Move to a new node
 */
export function moveToNode(nodeId: string): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    throw new Error("No active run");
  }
  
  const activeRun = progress.activeRun;
  const currentFloorMap = activeRun.nodeMapByFloor[activeRun.floorIndex];
  
  // Verify node is connected
  const connected = currentFloorMap.connections[activeRun.currentNodeId] || [];
  if (!connected.includes(nodeId) && nodeId !== activeRun.currentNodeId) {
    throw new Error(`Node ${nodeId} is not connected to current node`);
  }
  
  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      currentNodeId: nodeId,
    },
  };
  
  saveCampaignProgress(updated);
  return updated;
}

/**
 * Generate encounter for current node and store as pending battle
 */
export function prepareBattleForNode(nodeId: string): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    throw new Error("No active run");
  }
  
  const activeRun = progress.activeRun;
  const currentFloorMap = activeRun.nodeMapByFloor[activeRun.floorIndex];
  const node = currentFloorMap.nodes.find(n => n.id === nodeId);
  
  if (!node || (node.type !== "battle" && node.type !== "boss")) {
    throw new Error(`Node ${nodeId} is not a battle node`);
  }
  
  // Generate encounter seed (deterministic per node)
  const encounterSeed = `${activeRun.rngSeed}_node_${nodeId}`;
  
  // Generate encounter
  const encounter = generateEncounter(
    node.type === "boss" ? "eliteBattle" : "battle",
    activeRun.floorIndex,
    activeRun.operationId,
    activeRun.difficulty,
    encounterSeed
  );
  
  const pendingBattle: PendingBattleState = {
    nodeId,
    encounterSeed,
    encounterDefinition: encounter,
  };
  
  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      pendingBattle,
    },
  };
  
  saveCampaignProgress(updated);
  return updated;
}

/**
 * Record battle victory
 */
export function recordBattleVictory(): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    throw new Error("No active run");
  }
  
  const activeRun = progress.activeRun;
  const nodeId = activeRun.currentNodeId;
  
  // Clear the node
  const clearedNodeIds = activeRun.clearedNodeIds.includes(nodeId)
    ? activeRun.clearedNodeIds
    : [...activeRun.clearedNodeIds, nodeId];
  
  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      clearedNodeIds: clearedNodeIds,
      battlesWon: activeRun.battlesWon + 1,
      pendingBattle: undefined, // Clear pending battle
    },
  };
  
  saveCampaignProgress(updated);
  return updated;
}

/**
 * Record battle defeat (increment retry counter, keep pending battle)
 */
export function recordBattleDefeat(): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    throw new Error("No active run");
  }
  
  const activeRun = progress.activeRun;
  
  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      battlesLost: activeRun.battlesLost + 1,
      retries: activeRun.retries + 1,
      // Keep pendingBattle so retry uses same encounter
    },
  };
  
  saveCampaignProgress(updated);
  return updated;
}

/**
 * Advance to next floor
 */
export function advanceToNextFloor(): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    throw new Error("No active run");
  }
  
  const activeRun = progress.activeRun;
  const currentFloorMap = activeRun.nodeMapByFloor[activeRun.floorIndex];
  
  // Verify we're at exit node
  if (activeRun.currentNodeId !== currentFloorMap.exitNodeId) {
    throw new Error("Must be at exit node to advance floor");
  }
  
  // Check if there's a next floor
  if (activeRun.floorIndex >= activeRun.floorsTotal - 1) {
    throw new Error("Already on last floor");
  }
  
  const nextFloorIndex = activeRun.floorIndex + 1;
  const nextFloorMap = activeRun.nodeMapByFloor[nextFloorIndex];
  
  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      floorIndex: nextFloorIndex,
      currentNodeId: nextFloorMap.startNodeId,
      clearedNodeIds: [nextFloorMap.startNodeId], // Start node is cleared
      pendingBattle: undefined,
    },
  };
  
  saveCampaignProgress(updated);
  console.log(`[CAMPAIGN] Advanced to floor ${nextFloorIndex + 1}`);
  
  return updated;
}

/**
 * Complete the operation run
 */
export function completeOperationRun(): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    throw new Error("No active run");
  }
  
  const activeRun = progress.activeRun;
  const operationId = activeRun.operationId;
  
  // Mark operation as completed
  const updated = markOperationComplete(operationId, progress);
  
  // Clear active run
  const final = {
    ...updated,
    activeRun: null,
  };
  
  saveCampaignProgress(final);
  console.log(`[CAMPAIGN] Completed operation: ${operationId}`);
  
  return final;
}

/**
 * Abandon the current run
 */
export function abandonRun(): CampaignProgress {
  const progress = loadCampaignProgress();
  
  const updated = {
    ...progress,
    activeRun: null,
  };
  
  saveCampaignProgress(updated);
  console.log("[CAMPAIGN] Run abandoned");
  
  return updated;
}

/**
 * Get current active run
 */
export function getActiveRun(): ActiveRunState | null {
  const progress = loadCampaignProgress();
  return progress.activeRun;
}

/**
 * Re-export sync function for convenience
 */
export { syncCampaignToGameState } from "./campaignSync";

/**
 * Convert active run to OperationRun format for existing UI
 */
export function activeRunToOperationRun(activeRun: ActiveRunState): OperationRun {
  const opDef = OPERATION_DEFINITIONS[activeRun.operationId];
  const cleared = new Set(activeRun.clearedNodeIds);
  
  // Convert node maps to floors
  const floors: Floor[] = [];
  for (let i = 0; i < activeRun.floorsTotal; i++) {
    const nodeMap = activeRun.nodeMapByFloor[i];
    // Tag visited state based on clearedNodeIds for UI consumption
    const nodesWithVisitFlag = nodeMap.nodes.map(n => ({
      ...n,
      visited: cleared.has(n.id),
    }));
    floors.push({
      id: `floor_${i}`,
      name: `Floor ${i + 1}`,
      nodes: nodesWithVisitFlag,
    });
  }
  
  return {
    id: activeRun.operationId,
    codename: opDef.name,
    description: opDef.description,
    floors,
    currentFloorIndex: activeRun.floorIndex,
    currentRoomId: activeRun.currentNodeId,
  };
}

// ----------------------------------------------------------------------------
// UTILITIES
// ----------------------------------------------------------------------------

/**
 * Generate a unique run seed
 */
function generateRunSeed(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}



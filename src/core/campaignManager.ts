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
import { generateEncounter } from "./encounterGenerator";
import { OperationRun, Floor, RoomNode } from "./types";
import { getGameState, updateGameState } from "../state/gameStore";

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
  
  // Get field mods from game state (purchased from black market)
  const gameState = getGameState();
  const purchasedFieldMods = gameState.runFieldModInventory || [];
  
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
    runFieldModInventory: purchasedFieldMods, // Transfer purchased mods to active run
    unitHardpoints: {}, // Initialize empty hardpoints
  };
  
  const updated = {
    ...progress,
    activeRun,
  };
  
  saveCampaignProgress(updated);
  console.log(`[CAMPAIGN] Started operation: ${operationId}, difficulty: ${difficulty}, floors: ${floorsTotal}`);
  
  // Clear field mod inventory from game state (they're now in the active run)
  updateGameState(s => ({
    ...s,
    runFieldModInventory: [],
  }));
  
  // Consume quarters buff if active
  import("./quartersBuffs").then(({ consumeBuffOnRunStart }) => {
    consumeBuffOnRunStart();
  });
  
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
 * Get available next nodes (forward-only movement)
 */
export function getAvailableNextNodes(
  currentNodeId: string,
  nodeMap: NodeMap,
  clearedNodeIds: string[]
): RoomNode[] {
  // Get connections from current node (forward-only: only nodes we can move TO from here)
  const connections = nodeMap.connections[currentNodeId] || [];
  const available: RoomNode[] = [];
  
  console.log(`[CAMPAIGN] getAvailableNextNodes: currentNodeId=${currentNodeId}, connections=${connections.length}, clearedNodeIds=${clearedNodeIds.length}`);
  
  for (const connectedId of connections) {
    const node = nodeMap.nodes.find(n => n.id === connectedId);
    if (node) {
      // Available if not yet cleared (forward-only: can't go back to cleared nodes)
      // But we CAN go to uncleared nodes that are connected from current node
      if (!clearedNodeIds.includes(connectedId)) {
        available.push(node);
        console.log(`[CAMPAIGN] Node ${connectedId} is available (connected from ${currentNodeId})`);
      } else {
        console.log(`[CAMPAIGN] Node ${connectedId} is not available (already cleared)`);
      }
    } else {
      console.warn(`[CAMPAIGN] Connected node ${connectedId} not found in nodeMap`);
    }
  }
  
  console.log(`[CAMPAIGN] Returning ${available.length} available nodes: ${available.map(n => n.id).join(", ")}`);
  return available;
}

/**
 * Move to a new node (forward-only branching movement)
 */
export function moveToNode(nodeId: string): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    throw new Error("No active run");
  }

  const activeRun = progress.activeRun;
  const currentFloorMap = activeRun.nodeMapByFloor[activeRun.floorIndex];

  // Allow staying on current node
  if (nodeId === activeRun.currentNodeId) {
    return progress;
  }

  // Check if node is available (forward-only movement)
  const availableNodes = getAvailableNextNodes(
    activeRun.currentNodeId,
    currentFloorMap,
    activeRun.clearedNodeIds
  );
  
  const isAvailable = availableNodes.some(n => n.id === nodeId);
  
  if (!isAvailable) {
    throw new Error(`Node ${nodeId} is not available. Available nodes: ${availableNodes.map(n => n.id).join(", ")}`);
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
      // Keep pendingBattle and pendingDefenseBattle so retry uses same encounter
    },
  };

  saveCampaignProgress(updated);
  return updated;
}

/**
 * Prepare a defense battle for a key room under attack
 */
export function prepareDefenseBattle(keyRoomId: string): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    throw new Error("No active run");
  }

  const activeRun = progress.activeRun;
  const floorIndex = activeRun.floorIndex;

  // Find the key room
  const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
  const floorKeyRooms = keyRoomsByFloor[floorIndex] || [];
  const keyRoom = floorKeyRooms.find(kr => kr.roomNodeId === keyRoomId);

  if (!keyRoom) {
    throw new Error(`Key room ${keyRoomId} not found`);
  }

  // Generate encounter seed for determinism
  const encounterSeed = `${activeRun.rngSeed}_defense_${keyRoomId}_${activeRun.nodesCleared}`;

  // Get turns to survive from key room system config
  const turnsToSurvive = 6; // Default, will be imported from keyRoomSystem

  // Import dynamically to avoid circular dependency
  import("./keyRoomSystem").then(({ getDefenseBattleTurns }) => {
    // This runs async but the value is already set above
  });

  // Generate defense encounter
  import("./defenseBattleGenerator").then(({ generateDefenseEncounter }) => {
    const encounter = generateDefenseEncounter(floorIndex, encounterSeed);

    // Update with encounter definition
    const updatedProgress = loadCampaignProgress();
    if (updatedProgress.activeRun?.pendingDefenseBattle) {
      updatedProgress.activeRun.pendingDefenseBattle.encounterDefinition = encounter;
      saveCampaignProgress(updatedProgress);
    }
  });

  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      pendingDefenseBattle: {
        keyRoomId,
        nodeId: keyRoomId,
        turnsToSurvive,
        encounterSeed,
      },
      pendingDefenseDecision: undefined, // Clear the decision prompt
    },
  };

  saveCampaignProgress(updated);
  console.log(`[CAMPAIGN] Prepared defense battle for key room: ${keyRoomId}`);
  return updated;
}

/**
 * Record defense battle victory
 */
export function recordDefenseVictory(keyRoomId: string): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    throw new Error("No active run");
  }

  const activeRun = progress.activeRun;
  const floorIndex = activeRun.floorIndex;
  const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
  const floorKeyRooms = keyRoomsByFloor[floorIndex] || [];

  // Update the key room to clear attack and delay flags
  const updatedKeyRooms = floorKeyRooms.map(kr =>
    kr.roomNodeId === keyRoomId
      ? { ...kr, isUnderAttack: false, isDelayed: false }
      : kr
  );

  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      keyRoomsByFloor: {
        ...keyRoomsByFloor,
        [floorIndex]: updatedKeyRooms,
      },
      pendingDefenseBattle: undefined, // Clear pending defense
      battlesWon: activeRun.battlesWon + 1,
    },
  };

  saveCampaignProgress(updated);
  console.log(`[CAMPAIGN] Defense victory for key room: ${keyRoomId}`);
  return updated;
}

/**
 * Record defense battle defeat (allows retry)
 */
export function recordDefenseDefeat(): CampaignProgress {
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
      // Keep pendingDefenseBattle so retry uses same encounter
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
  
  // Grant floor resources before advancing
  import("./keyRoomSystem").then(({ grantFloorResources }) => {
    grantFloorResources();
  });
  
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
  
  // Update pinboard
  import("../state/gameStore").then(({ updateGameState }) => {
    updateGameState(s => {
      const quarters = s.quarters ?? {};
      const pinboard = quarters.pinboard ?? {
        completedOperations: [],
        failedOperations: [],
        log: [],
      };
      
      pinboard.completedOperations = pinboard.completedOperations || [];
      if (!pinboard.completedOperations.includes(operationId)) {
        pinboard.completedOperations.push(operationId);
      }
      
      pinboard.log = pinboard.log || [];
      pinboard.log.push({
        timestamp: Date.now(),
        message: `Completed operation: ${operationId}`,
      });
      
      return {
        ...s,
        quarters: {
          ...quarters,
          pinboard,
        },
      };
    });
  });
  
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
  
  // Get operation ID if available
  const operationId = progress.activeRun?.operationId;
  
  // Trigger mail on operation failure
  import("./mailSystem").then(({ triggerMailOnOperationComplete }) => {
    triggerMailOnOperationComplete(false);
  });
  
  // Update pinboard if operation ID available
  if (operationId) {
    import("../state/gameStore").then(({ updateGameState }) => {
      updateGameState(s => {
        const quarters = s.quarters ?? {};
        const pinboard = quarters.pinboard ?? {
          completedOperations: [],
          failedOperations: [],
          log: [],
        };
        
        if (!pinboard.failedOperations?.includes(operationId)) {
          pinboard.failedOperations = pinboard.failedOperations || [];
          pinboard.failedOperations.push(operationId);
        }
        
        pinboard.log = pinboard.log || [];
        pinboard.log.push({
          timestamp: Date.now(),
          message: `Failed operation: ${operationId}`,
        });
        
        return {
          ...s,
          quarters: {
            ...quarters,
            pinboard,
          },
        };
      });
    });
  }
  
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
    if (!nodeMap) {
      console.warn(`[CAMPAIGN] No node map for floor ${i}`);
      continue;
    }
    
    // Tag visited state and connections based on clearedNodeIds for UI consumption
    const nodesWithVisitFlag = nodeMap.nodes.map(n => ({
      ...n,
      visited: cleared.has(n.id),
      connections: nodeMap.connections[n.id] || [], // Include connections for branching UI
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
    connections: activeRun.nodeMapByFloor[activeRun.floorIndex]?.connections || {}, // Add connections for UI
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



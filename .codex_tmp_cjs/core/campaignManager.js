"use strict";
// ============================================================================
// CHAOS CORE - CAMPAIGN MANAGER
// Coordinates campaign flow: starting runs, progressing nodes, floor transitions
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCampaignToGameState = void 0;
exports.startOperationRun = startOperationRun;
exports.clearNode = clearNode;
exports.getAvailableNextNodes = getAvailableNextNodes;
exports.moveToNode = moveToNode;
exports.prepareBattleForNode = prepareBattleForNode;
exports.recordBattleVictory = recordBattleVictory;
exports.recordBattleDefeat = recordBattleDefeat;
exports.prepareDefenseBattle = prepareDefenseBattle;
exports.recordDefenseVictory = recordDefenseVictory;
exports.recordDefenseDefeat = recordDefenseDefeat;
exports.advanceToNextFloor = advanceToNextFloor;
exports.completeOperationRun = completeOperationRun;
exports.abandonRun = abandonRun;
exports.getActiveRun = getActiveRun;
exports.activeRunToOperationRun = activeRunToOperationRun;
const campaign_1 = require("./campaign");
const controlledRooms_1 = require("./controlledRooms");
const supplyChain_1 = require("./supplyChain");
const campaign_2 = require("./campaign");
const technica_1 = require("../content/technica");
const nodeMapGenerator_1 = require("./nodeMapGenerator");
const encounterGenerator_1 = require("./encounterGenerator");
const gameStore_1 = require("../state/gameStore");
const importedOperationTheater_1 = require("./importedOperationTheater");
const tavernMeals_1 = require("./tavernMeals");
const dispatchSystem_1 = require("./dispatchSystem");
// ----------------------------------------------------------------------------
// CAMPAIGN MANAGER
// ----------------------------------------------------------------------------
/**
 * Start a new operation run
 */
function startOperationRun(operationId, difficulty = "normal", customFloors, customEnemyDensity = "normal", customSprawlDirection = "east") {
    const progress = (0, campaign_2.loadCampaignProgress)();
    const opDef = campaign_2.OPERATION_DEFINITIONS[operationId];
    if (!opDef) {
        throw new Error(`Unknown operation: ${operationId}`);
    }
    // Apply 10× floor scaling
    const rngSeed = generateRunSeed();
    const importedOperation = (0, technica_1.getImportedOperation)(operationId);
    const isCustomOperation = operationId === "op_custom";
    const floorsTotal = importedOperation
        ? Math.max(1, importedOperation.floors.length)
        : isCustomOperation
            ? Math.max(1, customFloors || opDef.floors)
            : (customFloors || opDef.floors) * 10;
    // Generate node maps for all floors
    const nodeMapByFloor = importedOperation
        ? createImportedOperationNodeMaps(importedOperation)
        : createProceduralNodeMaps(floorsTotal, difficulty, rngSeed, isCustomOperation ? customEnemyDensity : "normal", !isCustomOperation);
    // Get field mods from game state (purchased from black market)
    const gameState = (0, gameStore_1.getGameState)();
    const purchasedFieldMods = gameState.runFieldModInventory || [];
    // Create active run state
    const activeRun = {
        operationId,
        difficulty,
        enemyDensity: isCustomOperation ? customEnemyDensity : "normal",
        sprawlDirection: isCustomOperation ? customSprawlDirection : undefined,
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
        unitHardpoints: Object.fromEntries(Object.entries(gameState.unitHardpoints || {}).map(([unitId, hardpoints]) => [unitId, [...hardpoints]])),
    };
    const updated = {
        ...progress,
        activeRun,
    };
    (0, campaign_2.saveCampaignProgress)(updated);
    console.log(`[CAMPAIGN] Started operation: ${operationId}, difficulty: ${difficulty}, floors: ${floorsTotal}, density: ${isCustomOperation ? customEnemyDensity : "normal"}, sprawl: ${isCustomOperation ? customSprawlDirection : "atlas"}`);
    // Clear field mod inventory from game state (they're now in the active run)
    (0, gameStore_1.updateGameState)((state) => {
        const withMealBuff = (0, tavernMeals_1.activateQueuedTavernMealForRun)(state);
        const withDispatchIntel = (0, dispatchSystem_1.consumeDispatchIntelForOperation)(withMealBuff);
        return {
            ...withDispatchIntel,
            runFieldModInventory: [],
        };
    });
    // Consume quarters buff if active
    Promise.resolve().then(() => require("./quartersBuffs")).then(({ consumeBuffOnRunStart }) => {
        consumeBuffOnRunStart();
    });
    return updated;
}
/**
 * Mark a node as cleared
 */
function clearNode(nodeId) {
    const progress = (0, campaign_2.loadCampaignProgress)();
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
    (0, campaign_2.saveCampaignProgress)(updated);
    // Advance Time Step for Controlled Rooms
    (0, controlledRooms_1.processControlledRoomsTimeStep)("room_cleared", 100);
    (0, supplyChain_1.advanceSupplyStep)((0, gameStore_1.getGameState)());
    (0, gameStore_1.updateGameState)((state) => (0, dispatchSystem_1.advanceDispatchTime)(state, 1));
    return updated;
}
/**
 * Get available next nodes (forward-only movement)
 */
function getAvailableNextNodes(currentNodeId, nodeMap, clearedNodeIds) {
    // Get connections from current node (forward-only: only nodes we can move TO from here)
    const connections = nodeMap.connections[currentNodeId] || [];
    const available = [];
    console.log(`[CAMPAIGN] getAvailableNextNodes: currentNodeId=${currentNodeId}, connections=${connections.length}, clearedNodeIds=${clearedNodeIds.length}`);
    for (const connectedId of connections) {
        const node = nodeMap.nodes.find(n => n.id === connectedId);
        if (node) {
            // Available if not yet cleared (forward-only: can't go back to cleared nodes)
            // But we CAN go to uncleared nodes that are connected from current node
            if (!clearedNodeIds.includes(connectedId)) {
                available.push(node);
                console.log(`[CAMPAIGN] Node ${connectedId} is available (connected from ${currentNodeId})`);
            }
            else {
                console.log(`[CAMPAIGN] Node ${connectedId} is not available (already cleared)`);
            }
        }
        else {
            console.warn(`[CAMPAIGN] Connected node ${connectedId} not found in nodeMap`);
        }
    }
    console.log(`[CAMPAIGN] Returning ${available.length} available nodes: ${available.map(n => n.id).join(", ")}`);
    return available;
}
/**
 * Move to a new node (forward-only branching movement)
 */
function moveToNode(nodeId) {
    const progress = (0, campaign_2.loadCampaignProgress)();
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
    const availableNodes = getAvailableNextNodes(activeRun.currentNodeId, currentFloorMap, activeRun.clearedNodeIds);
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
    (0, campaign_2.saveCampaignProgress)(updated);
    return updated;
}
/**
 * Generate encounter for current node and store as pending battle
 */
function prepareBattleForNode(nodeId) {
    const progress = (0, campaign_2.loadCampaignProgress)();
    if (!progress.activeRun) {
        throw new Error("No active run");
    }
    const activeRun = progress.activeRun;
    const currentFloorMap = activeRun.nodeMapByFloor[activeRun.floorIndex];
    const node = currentFloorMap.nodes.find(n => n.id === nodeId);
    if (!node || (node.type !== "battle" && node.type !== "boss" && node.type !== "elite")) {
        throw new Error(`Node ${nodeId} is not a battle node`);
    }
    // Generate encounter seed (deterministic per node)
    const encounterSeed = `${activeRun.rngSeed}_node_${nodeId}`;
    // Generate encounter
    const encounter = (0, encounterGenerator_1.generateEncounter)(node.type === "boss" || node.type === "elite" ? "eliteBattle" : "battle", activeRun.floorIndex, activeRun.operationId, activeRun.difficulty, encounterSeed, {
        floorId: (0, technica_1.getImportedOperation)(activeRun.operationId)?.floors[activeRun.floorIndex]?.id ?? `floor_${activeRun.floorIndex}`,
        roomId: nodeId,
    });
    const pendingBattle = {
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
    (0, campaign_2.saveCampaignProgress)(updated);
    return updated;
}
/**
 * Record battle victory
 */
function recordBattleVictory() {
    const progress = (0, campaign_2.loadCampaignProgress)();
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
    (0, campaign_2.saveCampaignProgress)(updated);
    return updated;
}
/**
 * Record battle defeat (increment retry counter, keep pending battle)
 */
function recordBattleDefeat() {
    const progress = (0, campaign_2.loadCampaignProgress)();
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
    (0, campaign_2.saveCampaignProgress)(updated);
    return updated;
}
/**
 * Prepare a defense battle for a key room under attack
 */
function prepareDefenseBattle(keyRoomId) {
    const progress = (0, campaign_2.loadCampaignProgress)();
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
    // Generate defense encounter
    Promise.resolve().then(() => require("./defenseBattleGenerator")).then(({ generateDefenseEncounter }) => {
        const encounter = generateDefenseEncounter(floorIndex, encounterSeed);
        // Update with encounter definition
        const updatedProgress = (0, campaign_2.loadCampaignProgress)();
        if (updatedProgress.activeRun?.pendingDefenseBattle) {
            updatedProgress.activeRun.pendingDefenseBattle.encounterDefinition = encounter;
            (0, campaign_2.saveCampaignProgress)(updatedProgress);
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
    (0, campaign_2.saveCampaignProgress)(updated);
    console.log(`[CAMPAIGN] Prepared defense battle for key room: ${keyRoomId}`);
    return updated;
}
/**
 * Record defense battle victory
 */
function recordDefenseVictory(keyRoomId) {
    const progress = (0, campaign_2.loadCampaignProgress)();
    if (!progress.activeRun) {
        throw new Error("No active run");
    }
    const activeRun = progress.activeRun;
    const floorIndex = activeRun.floorIndex;
    const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
    const floorKeyRooms = keyRoomsByFloor[floorIndex] || [];
    // Update the key room to clear attack and delay flags
    const updatedKeyRooms = floorKeyRooms.map(kr => kr.roomNodeId === keyRoomId
        ? { ...kr, isUnderAttack: false, isDelayed: false }
        : kr);
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
    (0, campaign_2.saveCampaignProgress)(updated);
    console.log(`[CAMPAIGN] Defense victory for key room: ${keyRoomId}`);
    return updated;
}
/**
 * Record defense battle defeat (allows retry)
 */
function recordDefenseDefeat() {
    const progress = (0, campaign_2.loadCampaignProgress)();
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
    (0, campaign_2.saveCampaignProgress)(updated);
    return updated;
}
/**
 * Advance to next floor
 */
function advanceToNextFloor(options = {}) {
    const progress = (0, campaign_2.loadCampaignProgress)();
    if (!progress.activeRun) {
        throw new Error("No active run");
    }
    const activeRun = progress.activeRun;
    const currentFloorMap = activeRun.nodeMapByFloor[activeRun.floorIndex];
    // Verify we're at exit node
    if (!options.bypassExitRequirement && activeRun.currentNodeId !== currentFloorMap.exitNodeId) {
        throw new Error("Must be at exit node to advance floor");
    }
    // Grant floor resources before advancing
    Promise.resolve().then(() => require("./keyRoomSystem")).then(({ grantFloorResources }) => {
        grantFloorResources();
    });
    // Check if there's a next floor
    if (activeRun.floorIndex >= activeRun.floorsTotal - 1) {
        throw new Error("Already on last floor");
    }
    const nextFloorIndex = activeRun.floorIndex + 1;
    // Generate nodes for the new floor
    if (!activeRun.nodeMapByFloor[nextFloorIndex]) {
        Promise.resolve().then(() => require("./nodeMapGenerator")).then(({ generateNodeMap }) => {
            activeRun.nodeMapByFloor[nextFloorIndex] = generateNodeMap(nextFloorIndex, activeRun.floorsTotal, activeRun.difficulty, activeRun.rngSeed, activeRun.enemyDensity ?? "normal", activeRun.operationId !== "op_custom");
        });
    }
    const updated = {
        ...progress,
        schemaNodeUnlocked: progress.schemaNodeUnlocked || nextFloorIndex >= 1,
        activeRun: {
            ...activeRun,
            floorIndex: nextFloorIndex,
            currentNodeId: activeRun.nodeMapByFloor[nextFloorIndex].startNodeId,
            clearedNodeIds: [activeRun.nodeMapByFloor[nextFloorIndex].startNodeId], // Start node is cleared
            pendingBattle: undefined,
        },
    };
    (0, campaign_2.saveCampaignProgress)(updated);
    // Advance Time Step for floor transition
    (0, controlledRooms_1.processControlledRoomsTimeStep)("floor_transition", 100);
    (0, supplyChain_1.advanceSupplyStep)((0, gameStore_1.getGameState)());
    (0, gameStore_1.updateGameState)((state) => (0, dispatchSystem_1.advanceDispatchTime)(state, 1));
    console.log(`[CAMPAIGN] Advanced to floor ${nextFloorIndex + 1}`);
    return updated;
}
/**
 * Complete the operation run
 */
function completeOperationRun() {
    const progress = (0, campaign_2.loadCampaignProgress)();
    if (!progress.activeRun) {
        throw new Error("No active run");
    }
    const activeRun = progress.activeRun;
    const operationId = activeRun.operationId;
    // Mark operation as completed
    const updated = (0, campaign_1.completeOperation)(operationId, progress);
    // Clear active run
    const final = {
        ...updated,
        activeRun: null,
    };
    (0, campaign_2.saveCampaignProgress)(final);
    console.log(`[CAMPAIGN] Completed operation: ${operationId}`);
    (0, gameStore_1.updateGameState)((state) => {
        const clearedState = (0, tavernMeals_1.clearActiveRunTavernMeal)(state);
        const withDispatchProgress = (0, dispatchSystem_1.advanceDispatchTime)(clearedState, 1);
        const finalizedState = (0, dispatchSystem_1.clearDispatchIntelBonus)(withDispatchProgress);
        const quarters = finalizedState.quarters ?? {};
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
            ...finalizedState,
            quarters: {
                ...quarters,
                pinboard,
            },
        };
    });
    return final;
}
/**
 * Abandon the current run
 */
function abandonRun() {
    const progress = (0, campaign_2.loadCampaignProgress)();
    const updated = {
        ...progress,
        activeRun: null,
    };
    (0, campaign_2.saveCampaignProgress)(updated);
    console.log("[CAMPAIGN] Run abandoned");
    // Get operation ID if available
    const operationId = progress.activeRun?.operationId;
    // Trigger mail on operation failure
    Promise.resolve().then(() => require("./mailSystem")).then(({ triggerMailOnOperationComplete }) => {
        triggerMailOnOperationComplete(false);
    });
    (0, gameStore_1.updateGameState)((state) => {
        const clearedState = (0, tavernMeals_1.clearActiveRunTavernMeal)(state);
        const withDispatchProgress = (0, dispatchSystem_1.advanceDispatchTime)(clearedState, 1);
        const finalizedState = (0, dispatchSystem_1.clearDispatchIntelBonus)(withDispatchProgress);
        if (!operationId) {
            return finalizedState;
        }
        const quarters = finalizedState.quarters ?? {};
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
            ...finalizedState,
            quarters: {
                ...quarters,
                pinboard,
            },
        };
    });
    return updated;
}
/**
 * Get current active run
 */
function getActiveRun() {
    const progress = (0, campaign_2.loadCampaignProgress)();
    return progress.activeRun;
}
/**
 * Re-export sync function for convenience
 */
var campaignSync_1 = require("./campaignSync");
Object.defineProperty(exports, "syncCampaignToGameState", { enumerable: true, get: function () { return campaignSync_1.syncCampaignToGameState; } });
/**
 * Convert active run to OperationRun format for existing UI
 */
function activeRunToOperationRun(activeRun) {
    const opDef = campaign_2.OPERATION_DEFINITIONS[activeRun.operationId];
    const importedOperation = (0, technica_1.getImportedOperation)(activeRun.operationId);
    const cleared = new Set(activeRun.clearedNodeIds);
    const customProfile = activeRun.operationId === "op_custom"
        ? createCustomRunBriefing(activeRun)
        : null;
    // Convert node maps to floors
    const floors = [];
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
            id: importedOperation?.floors[i]?.id ?? `floor_${i}`,
            name: importedOperation?.floors[i]?.name ?? customProfile?.floorNames[i] ?? `Floor ${i + 1}`,
            nodes: nodesWithVisitFlag,
        });
    }
    if (importedOperation) {
        return {
            ...(0, importedOperationTheater_1.buildImportedOperationRuntime)(importedOperation, {
                currentFloorIndex: activeRun.floorIndex,
                currentRoomId: activeRun.currentNodeId,
                clearedRoomIdsByFloor: {
                    [activeRun.floorIndex]: [...activeRun.clearedNodeIds],
                },
                floorsOverride: floors,
                connectionsOverride: activeRun.nodeMapByFloor[activeRun.floorIndex]?.connections || {},
            }),
            floors,
            currentFloorIndex: activeRun.floorIndex,
            currentRoomId: activeRun.currentNodeId,
            connections: activeRun.nodeMapByFloor[activeRun.floorIndex]?.connections || {},
            launchSource: "ops_terminal",
        };
    }
    return {
        id: activeRun.operationId,
        codename: customProfile?.codename ?? opDef.name,
        description: customProfile?.description ?? opDef.description,
        objective: customProfile?.objective ?? opDef.objective ?? opDef.description,
        recommendedPWR: customProfile?.recommendedPWR ?? opDef.recommendedPower,
        beginningState: customProfile?.beginningState ?? opDef.beginningState,
        endState: customProfile?.endState ?? opDef.endState,
        floors,
        currentFloorIndex: activeRun.floorIndex,
        currentRoomId: activeRun.currentNodeId,
        connections: activeRun.nodeMapByFloor[activeRun.floorIndex]?.connections || {}, // Add connections for UI
        launchSource: "ops_terminal",
        sprawlDirection: activeRun.sprawlDirection,
    };
}
// ----------------------------------------------------------------------------
// UTILITIES
// ----------------------------------------------------------------------------
/**
 * Generate a unique run seed
 */
function generateRunSeed() {
    return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
function createProceduralNodeMaps(floorsTotal, difficulty, rngSeed, enemyDensity, includeKeyRooms) {
    const nodeMapByFloor = {};
    for (let i = 0; i < floorsTotal; i++) {
        nodeMapByFloor[i] = (0, nodeMapGenerator_1.generateNodeMap)(i, floorsTotal, difficulty, rngSeed, enemyDensity, includeKeyRooms);
    }
    return nodeMapByFloor;
}
function createBriefingRng(seed) {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    let state = hash >>> 0;
    return () => {
        state = Math.imul(state, 1664525) + 1013904223;
        return (state >>> 0) / 4294967295;
    };
}
function pickBriefingToken(tokens, next) {
    return tokens[Math.floor(next() * tokens.length)] ?? tokens[0];
}
function createCustomRunBriefing(activeRun) {
    const next = createBriefingRng(`${activeRun.rngSeed}:${activeRun.floorsTotal}:${activeRun.enemyDensity ?? "normal"}`);
    const prefixes = ["BROKEN", "NULL", "SCARLET", "HOLLOW", "IRON", "GLASS", "BLACK", "EMBER", "STATIC"];
    const suffixes = ["SPIRAL", "LANTERN", "HARBOR", "GAUNTLET", "THRESHOLD", "CASCADE", "CIRCUIT", "MAZE", "DESCENT"];
    const floorFamilies = ["Rust", "Cinder", "Glass", "Echo", "Shard", "Soot", "Relay", "Wire", "Ash"];
    const floorLandmarks = ["Crossing", "Vault", "Gallery", "Spine", "Hollows", "Works", "Fork", "Channel", "Lock"];
    const densityLabel = (activeRun.enemyDensity ?? "normal").toUpperCase();
    const directionLabel = formatSprawlDirection(activeRun.sprawlDirection ?? "east");
    const codename = `${pickBriefingToken(prefixes, next)} ${pickBriefingToken(suffixes, next)}`;
    const recommendedPWR = Math.max(18, Math.round(22 + (activeRun.floorsTotal * 1.5) + (activeRun.difficulty === "hard" ? 5 : activeRun.difficulty === "easy" ? -3 : 0)));
    const floorNames = Array.from({ length: activeRun.floorsTotal }, (_, floorIndex) => (`Floor ${floorIndex + 1} // ${pickBriefingToken(floorFamilies, next)} ${pickBriefingToken(floorLandmarks, next)}`));
    return {
        codename,
        description: `Procedural theater seeded at runtime. ${activeRun.floorsTotal} randomized floor${activeRun.floorsTotal === 1 ? "" : "s"}, ${densityLabel} enemy density, and ${directionLabel} theater sprawl.`,
        objective: "Push from the uplink root to the descent point on each floor and survive until the final theater is secured.",
        beginningState: "Randomized theater spin-up complete. Floor 1 is live; push outward from the uplink root to the first descent point.",
        endState: "Final descent point secured. Theater traversal complete.",
        recommendedPWR,
        floorNames,
    };
}
function formatSprawlDirection(direction) {
    switch (direction) {
        case "north":
            return "northbound";
        case "northeast":
            return "northeast-bound";
        case "east":
            return "eastbound";
        case "southeast":
            return "southeast-bound";
        case "south":
            return "southbound";
        case "southwest":
            return "southwest-bound";
        case "west":
            return "westbound";
        case "northwest":
            return "northwest-bound";
        default:
            return "eastbound";
    }
}
function createImportedOperationNodeMaps(operation) {
    const nodeMapByFloor = {};
    operation.floors.forEach((floor, floorIndex) => {
        const nodes = floor.rooms.map((room) => ({
            id: room.id,
            label: room.label,
            type: room.type,
            position: room.position ?? room.localPosition,
            connections: [...(room.connections ?? room.adjacency ?? [])],
            battleTemplate: room.battleTemplate,
            eventTemplate: room.eventTemplate,
            shopInventory: [...(room.shopInventory ?? [])],
        }));
        const connections = Object.fromEntries(nodes.map((node) => [node.id, [...(node.connections ?? [])]]));
        const startNodeId = floor.startingRoomId
            || floor.rooms.find((room) => room.role === "ingress")?.id
            || nodes[0]?.id
            || `floor_${floorIndex}_start`;
        const exitNodeId = nodes.find((node) => (node.connections ?? []).length === 0)?.id ||
            nodes[nodes.length - 1]?.id ||
            startNodeId;
        nodeMapByFloor[floorIndex] = {
            nodes,
            connections,
            startNodeId,
            exitNodeId,
        };
    });
    return nodeMapByFloor;
}

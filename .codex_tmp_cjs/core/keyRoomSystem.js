"use strict";
// ============================================================================
// CHAOS CORE - KEY ROOM SYSTEM
// Handles Key Room capture, facilities, resource generation, and attacks
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.FACILITY_CONFIG = void 0;
exports.getKeyRoomsForFloor = getKeyRoomsForFloor;
exports.captureKeyRoom = captureKeyRoom;
exports.generateKeyRoomResources = generateKeyRoomResources;
exports.applyKeyRoomPassiveEffects = applyKeyRoomPassiveEffects;
exports.rollKeyRoomAttack = rollKeyRoomAttack;
exports.defendKeyRoom = defendKeyRoom;
exports.delayKeyRoomDefense = delayKeyRoomDefense;
exports.abandonKeyRoom = abandonKeyRoom;
exports.clearDefenseBattle = clearDefenseBattle;
exports.grantFloorResources = grantFloorResources;
exports.getFacilityConfig = getFacilityConfig;
exports.getAllFacilityTypes = getAllFacilityTypes;
exports.getDefenseBattleTurns = getDefenseBattleTurns;
const campaign_1 = require("./campaign");
const campaignManager_1 = require("./campaignManager");
// ----------------------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------------------
exports.FACILITY_CONFIG = {
    supply_depot: {
        name: "Supply Depot",
        description: "Generates basic resources after each room cleared.",
        resourceGeneration: {
            metalScrap: 5,
            wood: 3,
            wad: 10,
        },
    },
    medical_ward: {
        name: "Medical Ward",
        description: "Heals party after each battle cleared (small amount).",
        resourceGeneration: {
            wad: 5,
        },
        passiveEffect: "heal_party_small",
    },
    armory: {
        name: "Armory",
        description: "Grants combat-tempo benefits after each battle.",
        resourceGeneration: {
            wad: 5,
        },
        passiveEffect: "field_mod_reroll_token",
    },
    command_center: {
        name: "Command Center",
        description: "Provides map control and intel.",
        resourceGeneration: {
            wad: 5,
        },
        passiveEffect: "reveal_nodes",
    },
    mine: {
        name: "Mine",
        description: "Higher resource generation, but increases attack chance.",
        resourceGeneration: {
            metalScrap: 10,
            wood: 5,
            chaosShards: 2,
            wad: 15,
        },
    },
};
const ATTACK_CONFIG = {
    baseChance: 0.10, // 10%
    perRoomBonus: 0.05, // +5% per captured room
    mineBonus: 0.05, // +5% if any Mine exists
    maxChance: 0.35, // Cap at 35%
};
const DEFENSE_BATTLE_TURNS = 6; // Survive 6 turns
// ----------------------------------------------------------------------------
// KEY ROOM STATE MANAGEMENT
// ----------------------------------------------------------------------------
/**
 * Get Key Rooms for current floor
 */
function getKeyRoomsForFloor(floorIndex) {
    const activeRun = (0, campaignManager_1.getActiveRun)();
    if (!activeRun)
        return [];
    return activeRun.keyRoomsByFloor?.[floorIndex] || [];
}
/**
 * Capture a Key Room (after battle victory)
 */
function captureKeyRoom(nodeId, facility) {
    const progress = (0, campaign_1.loadCampaignProgress)();
    if (!progress.activeRun) {
        throw new Error("No active run");
    }
    const activeRun = progress.activeRun;
    const floorIndex = activeRun.floorIndex;
    // Initialize keyRoomsByFloor if needed
    const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
    const floorKeyRooms = keyRoomsByFloor[floorIndex] || [];
    // Check if already captured
    if (floorKeyRooms.some(kr => kr.roomNodeId === nodeId)) {
        console.warn(`[KEYROOM] Room ${nodeId} already captured`);
        return progress;
    }
    // Create new Key Room state
    const newKeyRoom = {
        roomNodeId: nodeId,
        facility,
        storedResources: {},
        isUnderAttack: false,
        isDelayed: false,
        threatLevel: 0,
        fortificationLevel: 0,
        distancePenalty: 100,
        upkeepFailed: false,
        captureFloorIndex: floorIndex,
    };
    const updated = {
        ...progress,
        activeRun: {
            ...activeRun,
            keyRoomsByFloor: {
                ...keyRoomsByFloor,
                [floorIndex]: [...floorKeyRooms, newKeyRoom],
            },
            pendingKeyRoomCapture: undefined,
        },
    };
    (0, campaign_1.saveCampaignProgress)(updated);
    console.log(`[KEYROOM] Captured room ${nodeId} with facility ${facility}`);
    return updated;
}
/**
 * Generate resources from all captured Key Rooms (called after room cleared)
 */
function generateKeyRoomResources() {
    const progress = (0, campaign_1.loadCampaignProgress)();
    if (!progress.activeRun) {
        return progress;
    }
    const activeRun = progress.activeRun;
    const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
    const updatedKeyRoomsByFloor = {};
    let hasKeyRooms = false;
    for (const [fIndexStr, floorKeyRooms] of Object.entries(keyRoomsByFloor)) {
        const fIndex = parseInt(fIndexStr, 10);
        if (floorKeyRooms.length > 0)
            hasKeyRooms = true;
        updatedKeyRoomsByFloor[fIndex] = floorKeyRooms.map(keyRoom => {
            const facilityConfig = exports.FACILITY_CONFIG[keyRoom.facility];
            const newStoredResources = { ...keyRoom.storedResources };
            // Apply delay penalty (50% output) and distance penalty
            const delayMultiplier = keyRoom.isDelayed ? 0.5 : 1.0;
            const distanceMultiplier = (keyRoom.distancePenalty || 100) / 100;
            const multiplier = delayMultiplier * distanceMultiplier;
            // Add generated resources
            if (facilityConfig.resourceGeneration) {
                for (const [resourceType, amount] of Object.entries(facilityConfig.resourceGeneration)) {
                    const currentAmount = newStoredResources[resourceType] || 0;
                    newStoredResources[resourceType] = currentAmount + Math.floor(amount * multiplier);
                }
            }
            return {
                ...keyRoom,
                storedResources: newStoredResources,
            };
        });
    }
    if (!hasKeyRooms)
        return progress;
    const updated = {
        ...progress,
        activeRun: {
            ...activeRun,
            keyRoomsByFloor: updatedKeyRoomsByFloor,
        },
    };
    (0, campaign_1.saveCampaignProgress)(updated);
    return updated;
}
/**
 * Apply passive effects from Key Rooms (healing, tokens, etc.)
 */
function applyKeyRoomPassiveEffects() {
    const activeRun = (0, campaignManager_1.getActiveRun)();
    if (!activeRun)
        return;
    const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
    for (const floorKeyRooms of Object.values(keyRoomsByFloor)) {
        for (const keyRoom of floorKeyRooms) {
            if (keyRoom.isDelayed)
                continue; // Delayed rooms don't provide passive effects
            const facilityConfig = exports.FACILITY_CONFIG[keyRoom.facility];
            const effect = facilityConfig.passiveEffect;
            if (effect === "heal_party_small") {
                // Heal party by 10% max HP
                Promise.resolve().then(() => require("../state/gameStore")).then(({ updateGameState }) => {
                    updateGameState(prev => {
                        const updated = { ...prev };
                        prev.partyUnitIds.forEach(unitId => {
                            const unit = updated.unitsById[unitId];
                            if (unit) {
                                const healAmount = Math.floor(unit.maxHp * 0.1);
                                updated.unitsById[unitId] = {
                                    ...unit,
                                    hp: Math.min(unit.maxHp, unit.hp + healAmount),
                                };
                            }
                        });
                        return updated;
                    });
                });
            }
            else if (effect === "field_mod_reroll_token") {
                // TODO: Add field mod reroll token to run state
                console.log("[KEYROOM] Field mod reroll token granted (placeholder)");
            }
            else if (effect === "reveal_nodes") {
                // TODO: Reveal additional nodes on map
                console.log("[KEYROOM] Nodes revealed (placeholder)");
            }
        }
    }
}
/**
 * Roll for Key Room attack (called after room cleared)
 * Uses seeded RNG for deterministic attack rolls (retry-safe)
 */
function rollKeyRoomAttack() {
    const progress = (0, campaign_1.loadCampaignProgress)();
    if (!progress.activeRun) {
        return null;
    }
    const activeRun = progress.activeRun;
    const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
    // Flatten all key rooms across all floors
    const allKeyRooms = [];
    for (const [fStr, rooms] of Object.entries(keyRoomsByFloor)) {
        const fIdx = parseInt(fStr, 10);
        rooms.forEach((kr, idx) => allKeyRooms.push({ kr, floorIdx: fIdx, idx }));
    }
    if (allKeyRooms.length === 0) {
        return null; // No key rooms to attack
    }
    // Skip if already has a pending defense decision (don't double-attack)
    if (activeRun.pendingDefenseDecision) {
        return null;
    }
    // Use seeded RNG for deterministic attack roll (based on run seed + nodes cleared)
    const rng = createSeededRNG(`${activeRun.rngSeed}_attack_${activeRun.nodesCleared}`);
    // Calculate attack chance
    let attackChance = ATTACK_CONFIG.baseChance;
    attackChance += allKeyRooms.length * ATTACK_CONFIG.perRoomBonus;
    // Check for Mine
    const hasMine = allKeyRooms.some(r => r.kr.facility === "mine");
    if (hasMine) {
        attackChance += ATTACK_CONFIG.mineBonus;
    }
    attackChance = Math.min(attackChance, ATTACK_CONFIG.maxChance);
    // Roll for attack using seeded RNG (deterministic)
    const roll = rng.nextFloat();
    console.log(`[KEYROOM] Attack roll: ${(roll * 100).toFixed(1)}% vs ${(attackChance * 100).toFixed(1)}% chance`);
    if (roll >= attackChance) {
        return null; // No attack
    }
    // Select a random key room to attack (also seeded)
    const targetIndex = rng.nextInt(0, allKeyRooms.length - 1);
    const target = allKeyRooms[targetIndex];
    // Update that specific floor's array
    const updatedKeyRoomsByFloor = { ...keyRoomsByFloor };
    updatedKeyRoomsByFloor[target.floorIdx] = updatedKeyRoomsByFloor[target.floorIdx].map((kr, idx) => idx === target.idx ? { ...kr, isUnderAttack: true } : kr);
    const updated = {
        ...progress,
        activeRun: {
            ...activeRun,
            keyRoomsByFloor: updatedKeyRoomsByFloor,
            pendingDefenseDecision: {
                keyRoomId: target.kr.roomNodeId,
                floorIndex: target.floorIdx,
                nodeId: target.kr.roomNodeId,
            },
        },
    };
    (0, campaign_1.saveCampaignProgress)(updated);
    console.log(`[KEYROOM] Attack triggered on room ${target.kr.roomNodeId} on floor ${target.floorIdx}`);
    return updated;
}
/**
 * Handle defend decision (start defense battle)
 */
function defendKeyRoom(keyRoomId) {
    const progress = (0, campaign_1.loadCampaignProgress)();
    if (!progress.activeRun) {
        throw new Error("No active run");
    }
    const activeRun = progress.activeRun;
    const floorIndex = activeRun.floorIndex;
    const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
    const floorKeyRooms = keyRoomsByFloor[floorIndex] || [];
    const keyRoomIndex = floorKeyRooms.findIndex(kr => kr.roomNodeId === keyRoomId);
    if (keyRoomIndex === -1) {
        throw new Error(`Key room ${keyRoomId} not found`);
    }
    // Defense battle will be prepared separately
    // Just clear the pending decision flag
    const updated = {
        ...progress,
        activeRun: {
            ...activeRun,
            pendingDefenseDecision: undefined,
        },
    };
    (0, campaign_1.saveCampaignProgress)(updated);
    return updated;
}
/**
 * Handle delay decision
 */
function delayKeyRoomDefense(keyRoomId) {
    const progress = (0, campaign_1.loadCampaignProgress)();
    if (!progress.activeRun) {
        throw new Error("No active run");
    }
    const activeRun = progress.activeRun;
    const floorIndex = activeRun.floorIndex;
    const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
    const floorKeyRooms = keyRoomsByFloor[floorIndex] || [];
    const keyRoomIndex = floorKeyRooms.findIndex(kr => kr.roomNodeId === keyRoomId);
    if (keyRoomIndex === -1) {
        throw new Error(`Key room ${keyRoomId} not found`);
    }
    const updatedKeyRooms = floorKeyRooms.map((kr, idx) => idx === keyRoomIndex ? { ...kr, isDelayed: true, isUnderAttack: false } : kr);
    const updated = {
        ...progress,
        activeRun: {
            ...activeRun,
            keyRoomsByFloor: {
                ...keyRoomsByFloor,
                [floorIndex]: updatedKeyRooms,
            },
            pendingDefenseDecision: undefined,
        },
    };
    (0, campaign_1.saveCampaignProgress)(updated);
    console.log(`[KEYROOM] Defense delayed for room ${keyRoomId}`);
    return updated;
}
/**
 * Handle abandon decision
 */
function abandonKeyRoom(keyRoomId) {
    const progress = (0, campaign_1.loadCampaignProgress)();
    if (!progress.activeRun) {
        throw new Error("No active run");
    }
    const activeRun = progress.activeRun;
    const floorIndex = activeRun.floorIndex;
    const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
    const floorKeyRooms = keyRoomsByFloor[floorIndex] || [];
    // Remove the key room
    const updatedKeyRooms = floorKeyRooms.filter(kr => kr.roomNodeId !== keyRoomId);
    const updated = {
        ...progress,
        activeRun: {
            ...activeRun,
            keyRoomsByFloor: {
                ...keyRoomsByFloor,
                [floorIndex]: updatedKeyRooms,
            },
            pendingDefenseDecision: undefined,
        },
    };
    (0, campaign_1.saveCampaignProgress)(updated);
    console.log(`[KEYROOM] Room ${keyRoomId} abandoned`);
    return updated;
}
/**
 * Clear defense battle victory (survived X turns)
 */
function clearDefenseBattle(keyRoomId) {
    const progress = (0, campaign_1.loadCampaignProgress)();
    if (!progress.activeRun) {
        throw new Error("No active run");
    }
    const activeRun = progress.activeRun;
    const floorIndex = activeRun.floorIndex;
    const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
    const floorKeyRooms = keyRoomsByFloor[floorIndex] || [];
    const keyRoomIndex = floorKeyRooms.findIndex(kr => kr.roomNodeId === keyRoomId);
    if (keyRoomIndex === -1) {
        throw new Error(`Key room ${keyRoomId} not found`);
    }
    const updatedKeyRooms = floorKeyRooms.map((kr, idx) => idx === keyRoomIndex ? { ...kr, isUnderAttack: false, isDelayed: false } : kr);
    const updated = {
        ...progress,
        activeRun: {
            ...activeRun,
            keyRoomsByFloor: {
                ...keyRoomsByFloor,
                [floorIndex]: updatedKeyRooms,
            },
        },
    };
    (0, campaign_1.saveCampaignProgress)(updated);
    console.log(`[KEYROOM] Defense successful for room ${keyRoomId}`);
    return updated;
}
/**
 * Grant stored resources at floor completion
 */
function grantFloorResources() {
    const progress = (0, campaign_1.loadCampaignProgress)();
    if (!progress.activeRun) {
        return progress;
    }
    const activeRun = progress.activeRun;
    const floorIndex = activeRun.floorIndex;
    const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
    // Sum all stored resources across ALL floors
    const totalResources = {};
    const updatedKeyRoomsByFloor = {};
    for (const [fIndexStr, floorKeyRooms] of Object.entries(keyRoomsByFloor)) {
        const fIndex = parseInt(fIndexStr, 10);
        const updatedFloorRooms = floorKeyRooms.map(kr => {
            // Extract resources
            for (const [resourceType, amount] of Object.entries(kr.storedResources)) {
                if (amount > 0) {
                    const current = totalResources[resourceType] || 0;
                    totalResources[resourceType] = current + amount;
                }
            }
            // Reset stores to 0 after granting
            return {
                ...kr,
                storedResources: {}
            };
        });
        updatedKeyRoomsByFloor[fIndex] = updatedFloorRooms;
    }
    // Grant resources to player
    if (Object.keys(totalResources).length > 0) {
        Promise.resolve().then(() => require("../state/gameStore")).then(({ updateGameState }) => {
            Promise.resolve().then(() => require("./session")).then(({ grantSessionResources }) => {
                updateGameState(prev => grantSessionResources(prev, {
                    wad: totalResources.wad || 0,
                    resources: {
                        metalScrap: totalResources.metalScrap || 0,
                        wood: totalResources.wood || 0,
                        chaosShards: totalResources.chaosShards || 0,
                        steamComponents: totalResources.steamComponents || 0,
                    },
                }));
            });
        });
    }
    // According to GDD, Controlled Rooms PERSIST across floors within the same Operation.
    // We do NOT delete them until the run resets!
    const updated = {
        ...progress,
        activeRun: {
            ...activeRun,
            keyRoomsByFloor: updatedKeyRoomsByFloor, // Retain and save reset rooms
        },
    };
    (0, campaign_1.saveCampaignProgress)(updated);
    console.log(`[KEYROOM] Floor ${floorIndex} resources granted (rooms retained across floors)`);
    return updated;
}
/**
 * Get facility configuration
 */
function getFacilityConfig(facility) {
    return exports.FACILITY_CONFIG[facility];
}
/**
 * Get all facility types
 */
function getAllFacilityTypes() {
    return Object.keys(exports.FACILITY_CONFIG);
}
/**
 * Get defense battle turn requirement
 */
function getDefenseBattleTurns() {
    return DEFENSE_BATTLE_TURNS;
}
function createSeededRNG(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    let state = Math.abs(hash) || 1;
    return {
        nextInt(min, max) {
            state = (state * 1103515245 + 12345) & 0x7fffffff;
            const normalized = state / 0x7fffffff;
            return Math.floor(min + normalized * (max - min + 1));
        },
        nextFloat() {
            state = (state * 1103515245 + 12345) & 0x7fffffff;
            return state / 0x7fffffff;
        },
    };
}

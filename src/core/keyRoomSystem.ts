// ============================================================================
// CHAOS CORE - KEY ROOM SYSTEM
// Handles Key Room capture, facilities, resource generation, and attacks
// ============================================================================

import {
  CampaignProgress,
  ActiveRunState,
  KeyRoomState,
  FacilityType,
  ResourceType,
  loadCampaignProgress,
  saveCampaignProgress,
} from "./campaign";
import { getActiveRun } from "./campaignManager";

// ----------------------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------------------

const FACILITY_CONFIG: Record<FacilityType, {
  name: string;
  description: string;
  resourceGeneration: Partial<Record<ResourceType, number>>;
  passiveEffect?: string;
}> = {
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
export function getKeyRoomsForFloor(floorIndex: number): KeyRoomState[] {
  const activeRun = getActiveRun();
  if (!activeRun) return [];
  
  return activeRun.keyRoomsByFloor?.[floorIndex] || [];
}

/**
 * Capture a Key Room (after battle victory)
 */
export function captureKeyRoom(nodeId: string, facility: FacilityType): CampaignProgress {
  const progress = loadCampaignProgress();
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
  const newKeyRoom: KeyRoomState = {
    roomNodeId: nodeId,
    facility,
    storedResources: {},
    isUnderAttack: false,
    isDelayed: false,
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
  
  saveCampaignProgress(updated);
  console.log(`[KEYROOM] Captured room ${nodeId} with facility ${facility}`);
  return updated;
}

/**
 * Generate resources from all captured Key Rooms (called after room cleared)
 */
export function generateKeyRoomResources(): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    return progress;
  }
  
  const activeRun = progress.activeRun;
  const floorIndex = activeRun.floorIndex;
  const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
  const floorKeyRooms = keyRoomsByFloor[floorIndex] || [];
  
  if (floorKeyRooms.length === 0) {
    return progress; // No key rooms captured
  }
  
  // Generate resources for each key room
  const updatedKeyRooms = floorKeyRooms.map(keyRoom => {
    const facilityConfig = FACILITY_CONFIG[keyRoom.facility];
    const newStoredResources = { ...keyRoom.storedResources };
    
    // Apply delay penalty (50% output)
    const multiplier = keyRoom.isDelayed ? 0.5 : 1.0;
    
    // Add generated resources
    for (const [resourceType, amount] of Object.entries(facilityConfig.resourceGeneration)) {
      const currentAmount = newStoredResources[resourceType as ResourceType] || 0;
      newStoredResources[resourceType as ResourceType] = currentAmount + Math.floor(amount * multiplier);
    }
    
    return {
      ...keyRoom,
      storedResources: newStoredResources,
    };
  });
  
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
  
  saveCampaignProgress(updated);
  return updated;
}

/**
 * Apply passive effects from Key Rooms (healing, tokens, etc.)
 */
export function applyKeyRoomPassiveEffects(): void {
  const activeRun = getActiveRun();
  if (!activeRun) return;
  
  const floorIndex = activeRun.floorIndex;
  const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
  const floorKeyRooms = keyRoomsByFloor[floorIndex] || [];
  
  for (const keyRoom of floorKeyRooms) {
    if (keyRoom.isDelayed) continue; // Delayed rooms don't provide passive effects
    
    const facilityConfig = FACILITY_CONFIG[keyRoom.facility];
    const effect = facilityConfig.passiveEffect;
    
    if (effect === "heal_party_small") {
      // Heal party by 10% max HP
      import("../state/gameStore").then(({ getGameState, updateGameState }) => {
        const state = getGameState();
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
    } else if (effect === "field_mod_reroll_token") {
      // TODO: Add field mod reroll token to run state
      console.log("[KEYROOM] Field mod reroll token granted (placeholder)");
    } else if (effect === "reveal_nodes") {
      // TODO: Reveal additional nodes on map
      console.log("[KEYROOM] Nodes revealed (placeholder)");
    }
  }
}

/**
 * Roll for Key Room attack (called after room cleared)
 */
export function rollKeyRoomAttack(): CampaignProgress | null {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    return null;
  }
  
  const activeRun = progress.activeRun;
  const floorIndex = activeRun.floorIndex;
  const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
  const floorKeyRooms = keyRoomsByFloor[floorIndex] || [];
  
  if (floorKeyRooms.length === 0) {
    return null; // No key rooms to attack
  }
  
  // Calculate attack chance
  let attackChance = ATTACK_CONFIG.baseChance;
  attackChance += floorKeyRooms.length * ATTACK_CONFIG.perRoomBonus;
  
  // Check for Mine
  const hasMine = floorKeyRooms.some(kr => kr.facility === "mine");
  if (hasMine) {
    attackChance += ATTACK_CONFIG.mineBonus;
  }
  
  attackChance = Math.min(attackChance, ATTACK_CONFIG.maxChance);
  
  // Roll for attack
  const roll = Math.random();
  if (roll >= attackChance) {
    return null; // No attack
  }
  
  // Select a random key room to attack (seeded)
  const rng = createSeededRNG(`${activeRun.rngSeed}_attack_${activeRun.nodesCleared}`);
  const targetIndex = rng.nextInt(0, floorKeyRooms.length - 1);
  const targetKeyRoom = floorKeyRooms[targetIndex];
  
  // Set attack flag
  const updatedKeyRooms = floorKeyRooms.map((kr, idx) => 
    idx === targetIndex ? { ...kr, isUnderAttack: true } : kr
  );
  
  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      keyRoomsByFloor: {
        ...keyRoomsByFloor,
        [floorIndex]: updatedKeyRooms,
      },
      pendingDefenseDecision: {
        keyRoomId: targetKeyRoom.roomNodeId,
        floorIndex,
        nodeId: targetKeyRoom.roomNodeId,
      },
    },
  };
  
  saveCampaignProgress(updated);
  console.log(`[KEYROOM] Attack triggered on room ${targetKeyRoom.roomNodeId}`);
  return updated;
}

/**
 * Handle defend decision (start defense battle)
 */
export function defendKeyRoom(keyRoomId: string): CampaignProgress {
  const progress = loadCampaignProgress();
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
  
  saveCampaignProgress(updated);
  return updated;
}

/**
 * Handle delay decision
 */
export function delayKeyRoomDefense(keyRoomId: string): CampaignProgress {
  const progress = loadCampaignProgress();
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
  
  const updatedKeyRooms = floorKeyRooms.map((kr, idx) => 
    idx === keyRoomIndex ? { ...kr, isDelayed: true, isUnderAttack: false } : kr
  );
  
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
  
  saveCampaignProgress(updated);
  console.log(`[KEYROOM] Defense delayed for room ${keyRoomId}`);
  return updated;
}

/**
 * Handle abandon decision
 */
export function abandonKeyRoom(keyRoomId: string): CampaignProgress {
  const progress = loadCampaignProgress();
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
  
  saveCampaignProgress(updated);
  console.log(`[KEYROOM] Room ${keyRoomId} abandoned`);
  return updated;
}

/**
 * Clear defense battle victory (survived X turns)
 */
export function clearDefenseBattle(keyRoomId: string): CampaignProgress {
  const progress = loadCampaignProgress();
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
  
  const updatedKeyRooms = floorKeyRooms.map((kr, idx) => 
    idx === keyRoomIndex ? { ...kr, isUnderAttack: false, isDelayed: false } : kr
  );
  
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
  
  saveCampaignProgress(updated);
  console.log(`[KEYROOM] Defense successful for room ${keyRoomId}`);
  return updated;
}

/**
 * Grant stored resources at floor completion
 */
export function grantFloorResources(): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    return progress;
  }
  
  const activeRun = progress.activeRun;
  const floorIndex = activeRun.floorIndex;
  const keyRoomsByFloor = activeRun.keyRoomsByFloor || {};
  const floorKeyRooms = keyRoomsByFloor[floorIndex] || [];
  
  // Sum all stored resources
  const totalResources: Partial<Record<ResourceType, number>> = {};
  
  for (const keyRoom of floorKeyRooms) {
    for (const [resourceType, amount] of Object.entries(keyRoom.storedResources)) {
      const current = totalResources[resourceType as ResourceType] || 0;
      totalResources[resourceType as ResourceType] = current + amount;
    }
  }
  
  // Grant resources to player
  if (Object.keys(totalResources).length > 0) {
    import("../state/gameStore").then(({ updateGameState }) => {
      updateGameState(prev => {
        const updated = { ...prev };
        
        // Grant WAD
        if (totalResources.wad) {
          updated.wad = (updated.wad || 0) + totalResources.wad;
        }
        
        // Grant other resources
        if (totalResources.metalScrap) {
          updated.resources.metalScrap = (updated.resources.metalScrap || 0) + totalResources.metalScrap;
        }
        if (totalResources.wood) {
          updated.resources.wood = (updated.resources.wood || 0) + totalResources.wood;
        }
        if (totalResources.chaosShards) {
          updated.resources.chaosShards = (updated.resources.chaosShards || 0) + totalResources.chaosShards;
        }
        if (totalResources.steamComponents) {
          updated.resources.steamComponents = (updated.resources.steamComponents || 0) + totalResources.steamComponents;
        }
        
        return updated;
      });
    });
  }
  
  // Clear key rooms for this floor (lost at floor end)
  const updatedKeyRoomsByFloor = { ...keyRoomsByFloor };
  delete updatedKeyRoomsByFloor[floorIndex];
  
  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      keyRoomsByFloor: updatedKeyRoomsByFloor,
    },
  };
  
  saveCampaignProgress(updated);
  console.log(`[KEYROOM] Floor ${floorIndex} resources granted and key rooms cleared`);
  return updated;
}

/**
 * Get facility configuration
 */
export function getFacilityConfig(facility: FacilityType) {
  return FACILITY_CONFIG[facility];
}

/**
 * Get all facility types
 */
export function getAllFacilityTypes(): FacilityType[] {
  return Object.keys(FACILITY_CONFIG) as FacilityType[];
}

/**
 * Get defense battle turn requirement
 */
export function getDefenseBattleTurns(): number {
  return DEFENSE_BATTLE_TURNS;
}

// ----------------------------------------------------------------------------
// SEEDED RNG
// ----------------------------------------------------------------------------

interface SeededRNG {
  nextInt(min: number, max: number): number;
}

function createSeededRNG(seed: string): SeededRNG {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  let state = Math.abs(hash) || 1;
  
  return {
    nextInt(min: number, max: number): number {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      const normalized = state / 0x7fffffff;
      return Math.floor(min + normalized * (max - min + 1));
    },
  };
}


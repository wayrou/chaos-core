// ============================================================================
// CHAOS CORE - CONTROLLED ROOMS SYSTEM (Headline 14e)
// Persistent room control across floors within an operation
// ============================================================================

import {
  CampaignProgress,
  ControlledRoomState,
  ControlledRoomType,
  ControlledRoomStatus,
  ResourceType,
  loadCampaignProgress,
  saveCampaignProgress,
} from "./campaign";
import { getActiveRun } from "./campaignManager";

// Re-export types for screens that import from controlledRoomsSystem
export type { ControlledRoomType, ControlledRoomStatus } from "./campaign";

// ----------------------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------------------

export const CONTROLLED_ROOM_CONFIG: Record<ControlledRoomType, {
  name: string;
  description: string;
  baseUpkeepCost: Partial<Record<ResourceType, number>>;
  baseThreatIncrease: number; // Per time step
  fortificationBenefit?: string;
}> = {
  supply_depot: {
    name: "Supply Depot",
    description: "Generates resources continuously. Low threat generation.",
    baseUpkeepCost: {
      metalScrap: 2,
      wad: 5,
    },
    baseThreatIncrease: 3,
    fortificationBenefit: "resource_bonus",
  },
  medical_ward: {
    name: "Medical Ward",
    description: "Provides healing between battles. Minimal threat.",
    baseUpkeepCost: {
      wad: 8,
    },
    baseThreatIncrease: 2,
    fortificationBenefit: "healing_bonus",
  },
  armory: {
    name: "Armory",
    description: "Provides combat bonuses. Moderate threat.",
    baseUpkeepCost: {
      metalScrap: 3,
      wad: 10,
    },
    baseThreatIncrease: 5,
    fortificationBenefit: "combat_bonus",
  },
  command_center: {
    name: "Command Center",
    description: "Reveals map information. Moderate threat.",
    baseUpkeepCost: {
      wad: 12,
    },
    baseThreatIncrease: 5,
    fortificationBenefit: "map_reveal",
  },
  mine: {
    name: "Mine",
    description: "High resource generation. HIGH THREAT.",
    baseUpkeepCost: {
      metalScrap: 5,
      wood: 3,
      wad: 15,
    },
    baseThreatIncrease: 10,
    fortificationBenefit: "high_resource_bonus",
  },
  outpost: {
    name: "Outpost",
    description: "Generic controlled position. Low upkeep, low threat.",
    baseUpkeepCost: {
      wad: 3,
    },
    baseThreatIncrease: 2,
  },
  forward_stable: {
    name: "Forward Stable",
    description: "Reduces mount condition loss and allows limited repairs during operation.",
    baseUpkeepCost: {
      metalScrap: 3,
      wad: 8,
    },
    baseThreatIncrease: 4,
    fortificationBenefit: "mount_support",
  },
};

// Attack roll configuration
const ATTACK_CONFIG = {
  baseChance: 0.05, // 5% base
  perThreatPoint: 0.002, // +0.2% per threat point (20% at 100 threat)
  perControlledRoom: 0.03, // +3% per controlled room
  maxChance: 0.40, // Cap at 40%
};

// Distance penalty for benefits (Model A)
const DISTANCE_BENEFIT_MULTIPLIERS = {
  sameFloor: 1.0, // 100%
  oneFloorAway: 0.85, // 85%
  twoFloorsAway: 0.70, // 70%
  threeOrMoreAway: 0.0, // No benefit
};

// Fortification level thresholds
const FORTIFICATION_THRESHOLDS = {
  level0: { barricades: 0, turrets: 0, walls: false, generator: false },
  level1: { barricades: 1, turrets: 0, walls: false, generator: false },
  level2: { barricades: 2, turrets: 1, walls: true, generator: false },
  level3: { barricades: 3, turrets: 2, walls: true, generator: true },
};

// ----------------------------------------------------------------------------
// CONTROLLED ROOM MANAGEMENT
// ----------------------------------------------------------------------------

/**
 * Get all controlled rooms for current operation
 */
export function getAllControlledRooms(): ControlledRoomState[] {
  const activeRun = getActiveRun();
  if (!activeRun || !activeRun.controlledRooms) return [];

  return Object.values(activeRun.controlledRooms);
}

/**
 * Get controlled rooms for a specific floor
 */
export function getControlledRoomsForFloor(floorIndex: number): ControlledRoomState[] {
  const allRooms = getAllControlledRooms();
  return allRooms.filter(room => room.floorIndex === floorIndex);
}

/**
 * Get a specific controlled room by nodeId
 */
export function getControlledRoom(nodeId: string): ControlledRoomState | null {
  const activeRun = getActiveRun();
  if (!activeRun || !activeRun.controlledRooms) return null;

  return activeRun.controlledRooms[nodeId] || null;
}

/**
 * Capture a room (convert to controlled room)
 */
export function captureRoom(
  nodeId: string,
  floorIndex: number,
  roomType: ControlledRoomType
): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    throw new Error("No active run");
  }

  const activeRun = progress.activeRun;
  const controlledRooms = activeRun.controlledRooms || {};

  // Check if already captured
  if (controlledRooms[nodeId]) {
    console.warn(`[CONTROLLEDROOMS] Room ${nodeId} already captured`);
    return progress;
  }

  // Calculate base upkeep cost
  const config = CONTROLLED_ROOM_CONFIG[roomType];
  const baseUpkeep = config.baseUpkeepCost;

  // Create new controlled room state
  const newRoom: ControlledRoomState = {
    nodeId,
    floorIndex,
    roomType,
    status: "controlled",
    threatLevel: 0,
    fortificationLevel: 0,
    upkeepCost: { ...baseUpkeep },
    timeControlled: 0,
    lastVisited: activeRun.opTimeStep || 0,
    upgrades: {
      barricades: 0,
      turrets: 0,
      reinforcedWalls: false,
      powerGenerator: false,
    },
  };

  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      controlledRooms: {
        ...controlledRooms,
        [nodeId]: newRoom,
      },
    },
  };

  saveCampaignProgress(updated);
  console.log(`[CONTROLLEDROOMS] Captured room ${nodeId} as ${roomType}`);
  
  // Check if Medical Ward was captured (unlocks Support mounts)
  if (roomType === "medical_ward") {
    import("./mountSystem").then(({ unlockSupportMounts }) => {
      unlockSupportMounts();
    });
  }
  
  return updated;
}

/**
 * Calculate fortification level based on upgrades
 */
export function calculateFortificationLevel(room: ControlledRoomState): number {
  const upgrades = room.upgrades;

  // Level 3: Max everything
  if (upgrades.barricades >= 3 && upgrades.turrets >= 2 && upgrades.reinforcedWalls && upgrades.powerGenerator) {
    return 3;
  }

  // Level 2: 2 barricades, 1 turret, walls
  if (upgrades.barricades >= 2 && upgrades.turrets >= 1 && upgrades.reinforcedWalls) {
    return 2;
  }

  // Level 1: At least 1 barricade
  if (upgrades.barricades >= 1) {
    return 1;
  }

  // Level 0: No upgrades
  return 0;
}

/**
 * Upgrade a controlled room (install barricade, turret, etc.)
 */
export function upgradeControlledRoom(
  nodeId: string,
  upgradeType: "barricade" | "turret" | "walls" | "generator",
  resourceCost: Partial<Record<ResourceType, number>>
): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    throw new Error("No active run");
  }

  const activeRun = progress.activeRun;
  const controlledRooms = activeRun.controlledRooms || {};
  const room = controlledRooms[nodeId];

  if (!room) {
    throw new Error(`Room ${nodeId} is not controlled`);
  }

  // Apply upgrade
  const updatedUpgrades = { ...room.upgrades };

  switch (upgradeType) {
    case "barricade":
      updatedUpgrades.barricades = Math.min(3, updatedUpgrades.barricades + 1);
      break;
    case "turret":
      updatedUpgrades.turrets = Math.min(2, updatedUpgrades.turrets + 1);
      break;
    case "walls":
      updatedUpgrades.reinforcedWalls = true;
      break;
    case "generator":
      updatedUpgrades.powerGenerator = true;
      break;
  }

  const updatedRoom = {
    ...room,
    upgrades: updatedUpgrades,
  };

  // Recalculate fortification level
  updatedRoom.fortificationLevel = calculateFortificationLevel(updatedRoom);

  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      controlledRooms: {
        ...controlledRooms,
        [nodeId]: updatedRoom,
      },
    },
  };

  saveCampaignProgress(updated);
  console.log(`[CONTROLLEDROOMS] Upgraded room ${nodeId}: ${upgradeType} (Fort Level: ${updatedRoom.fortificationLevel})`);
  return updated;
}

/**
 * Abandon a controlled room (remove from roster)
 */
export function abandonControlledRoom(nodeId: string): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    throw new Error("No active run");
  }

  const activeRun = progress.activeRun;
  const controlledRooms = activeRun.controlledRooms || {};

  if (!controlledRooms[nodeId]) {
    console.warn(`[CONTROLLEDROOMS] Room ${nodeId} not found`);
    return progress;
  }

  // Remove room
  const updatedRooms = { ...controlledRooms };
  delete updatedRooms[nodeId];

  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      controlledRooms: updatedRooms,
    },
  };

  saveCampaignProgress(updated);
  console.log(`[CONTROLLEDROOMS] Abandoned room ${nodeId}`);
  return updated;
}

// ----------------------------------------------------------------------------
// TIME STEP & THREAT MECHANICS
// ----------------------------------------------------------------------------

/**
 * Advance operation time step (called after room clears and floor transitions)
 */
export function advanceOpTimeStep(): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    return progress;
  }

  const activeRun = progress.activeRun;
  const currentTimeStep = activeRun.opTimeStep || 0;
  const controlledRooms = activeRun.controlledRooms || {};

  // Increment time step
  const newTimeStep = currentTimeStep + 1;

  // Update all controlled rooms
  const updatedRooms: Record<string, ControlledRoomState> = {};

  for (const [nodeId, room] of Object.entries(controlledRooms)) {
    const config = CONTROLLED_ROOM_CONFIG[room.roomType];

    // Increase threat based on room type
    let threatIncrease = config.baseThreatIncrease;

    // Reduce threat increase based on fortification level
    const fortReduction = room.fortificationLevel * 2;
    threatIncrease = Math.max(1, threatIncrease - fortReduction);

    const newThreat = Math.min(100, room.threatLevel + threatIncrease);

    updatedRooms[nodeId] = {
      ...room,
      threatLevel: newThreat,
      timeControlled: room.timeControlled + 1,
    };
  }

  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      opTimeStep: newTimeStep,
      controlledRooms: updatedRooms,
    },
  };

  saveCampaignProgress(updated);
  console.log(`[CONTROLLEDROOMS] Advanced to time step ${newTimeStep}`);
  return updated;
}

/**
 * Roll for controlled room attack (deterministic, based on opSeed + opTimeStep)
 */
export function rollControlledRoomAttack(): CampaignProgress | null {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    return null;
  }

  const activeRun = progress.activeRun;
  const controlledRooms = activeRun.controlledRooms || {};
  const roomsArray = Object.values(controlledRooms);

  if (roomsArray.length === 0) {
    return null; // No controlled rooms
  }

  // Use seeded RNG for deterministic attack roll
  const opSeed = activeRun.opSeed || activeRun.rngSeed;
  const opTimeStep = activeRun.opTimeStep || 0;
  const rng = createSeededRNG(`${opSeed}_controlled_attack_${opTimeStep}`);

  // Calculate total attack chance
  let attackChance = ATTACK_CONFIG.baseChance;
  attackChance += roomsArray.length * ATTACK_CONFIG.perControlledRoom;

  // Add threat-based chance (average threat across all rooms)
  const avgThreat = roomsArray.reduce((sum, r) => sum + r.threatLevel, 0) / roomsArray.length;
  attackChance += avgThreat * ATTACK_CONFIG.perThreatPoint;

  attackChance = Math.min(attackChance, ATTACK_CONFIG.maxChance);

  // Roll for attack
  const roll = rng.nextFloat();
  console.log(`[CONTROLLEDROOMS] Attack roll: ${(roll * 100).toFixed(1)}% vs ${(attackChance * 100).toFixed(1)}% chance`);

  if (roll >= attackChance) {
    return null; // No attack
  }

  // Select a random room to attack (weighted by threat level)
  const totalThreat = roomsArray.reduce((sum, r) => sum + Math.max(1, r.threatLevel), 0);
  let targetRoll = rng.nextFloat() * totalThreat;
  let targetRoom: ControlledRoomState | null = null;

  for (const room of roomsArray) {
    targetRoll -= Math.max(1, room.threatLevel);
    if (targetRoll <= 0) {
      targetRoom = room;
      break;
    }
  }

  if (!targetRoom) {
    targetRoom = roomsArray[0]; // Fallback
  }

  // Set room under attack
  const updatedRooms = {
    ...controlledRooms,
    [targetRoom.nodeId]: {
      ...targetRoom,
      status: "under_attack" as ControlledRoomStatus,
    },
  };

  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      controlledRooms: updatedRooms,
    },
  };

  saveCampaignProgress(updated);
  console.log(`[CONTROLLEDROOMS] Room ${targetRoom.nodeId} is under attack!`);
  return updated;
}

/**
 * Reduce threat level for a controlled room (after visiting/defending)
 */
export function reduceThreat(nodeId: string, amount: number): CampaignProgress {
  const progress = loadCampaignProgress();
  if (!progress.activeRun) {
    throw new Error("No active run");
  }

  const activeRun = progress.activeRun;
  const controlledRooms = activeRun.controlledRooms || {};
  const room = controlledRooms[nodeId];

  if (!room) {
    throw new Error(`Room ${nodeId} is not controlled`);
  }

  const updatedRoom = {
    ...room,
    threatLevel: Math.max(0, room.threatLevel - amount),
  };

  const updated = {
    ...progress,
    activeRun: {
      ...activeRun,
      controlledRooms: {
        ...controlledRooms,
        [nodeId]: updatedRoom,
      },
    },
  };

  saveCampaignProgress(updated);
  console.log(`[CONTROLLEDROOMS] Reduced threat for room ${nodeId} by ${amount}`);
  return updated;
}

// ----------------------------------------------------------------------------
// BENEFITS WITH DISTANCE PENALTY
// ----------------------------------------------------------------------------

/**
 * Calculate benefit multiplier based on floor distance (Model A)
 */
export function getControlledRoomBenefitMultiplier(
  roomFloorIndex: number,
  currentFloorIndex: number
): number {
  const distance = Math.abs(roomFloorIndex - currentFloorIndex);

  if (distance === 0) return DISTANCE_BENEFIT_MULTIPLIERS.sameFloor;
  if (distance === 1) return DISTANCE_BENEFIT_MULTIPLIERS.oneFloorAway;
  if (distance === 2) return DISTANCE_BENEFIT_MULTIPLIERS.twoFloorsAway;
  return DISTANCE_BENEFIT_MULTIPLIERS.threeOrMoreAway;
}

/**
 * Get aggregated benefits from all controlled rooms
 */
export function getAggregatedControlledRoomBenefits(currentFloorIndex: number): {
  resourceBonus: Partial<Record<ResourceType, number>>;
  healingBonus: number;
  combatBonus: number;
  mapReveal: boolean;
} {
  const allRooms = getAllControlledRooms();
  const activeRun = getActiveRun();
  if (!activeRun) {
    return { resourceBonus: {}, healingBonus: 0, combatBonus: 0, mapReveal: false };
  }

  const benefits = {
    resourceBonus: {} as Partial<Record<ResourceType, number>>,
    healingBonus: 0,
    combatBonus: 0,
    mapReveal: false,
  };

  for (const room of allRooms) {
    if (room.status !== "controlled") continue; // Skip rooms under attack or lost

    const multiplier = getControlledRoomBenefitMultiplier(room.floorIndex, currentFloorIndex);
    if (multiplier === 0) continue; // Too far away

    const config = CONTROLLED_ROOM_CONFIG[room.roomType];
    const benefit = config.fortificationBenefit;

    if (benefit === "resource_bonus") {
      benefits.resourceBonus.metalScrap = (benefits.resourceBonus.metalScrap || 0) + Math.floor(5 * multiplier);
      benefits.resourceBonus.wad = (benefits.resourceBonus.wad || 0) + Math.floor(10 * multiplier);
    } else if (benefit === "high_resource_bonus") {
      benefits.resourceBonus.metalScrap = (benefits.resourceBonus.metalScrap || 0) + Math.floor(15 * multiplier);
      benefits.resourceBonus.wood = (benefits.resourceBonus.wood || 0) + Math.floor(10 * multiplier);
      benefits.resourceBonus.wad = (benefits.resourceBonus.wad || 0) + Math.floor(25 * multiplier);
    } else if (benefit === "healing_bonus") {
      benefits.healingBonus += Math.floor(10 * multiplier);
    } else if (benefit === "combat_bonus") {
      benefits.combatBonus += Math.floor(5 * multiplier);
    } else if (benefit === "map_reveal") {
      if (multiplier >= 0.85) benefits.mapReveal = true; // Only within 1 floor
    }
  }

  return benefits;
}

// ----------------------------------------------------------------------------
// SEEDED RNG (Shared with key room system)
// ----------------------------------------------------------------------------

interface SeededRNG {
  nextInt(min: number, max: number): number;
  nextFloat(): number;
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
    nextFloat(): number {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    },
  };
}

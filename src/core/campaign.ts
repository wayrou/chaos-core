// ============================================================================
// CHAOS CORE - CAMPAIGN SYSTEM
// Campaign progress, operation definitions, and run management
// ============================================================================

import { OperationRun, Floor, RoomNode } from "./types";

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export type OperationId = 
  | "op_iron_gate"
  | "op_black_spire"
  | "op_ghost_run"
  | "op_ember_siege"
  | "op_final_dawn"
  | "op_custom";

export type Difficulty = "easy" | "normal" | "hard" | "custom";

export interface CampaignProgress {
  version: number; // Schema version for migrations
  completedOperations: OperationId[];
  unlockedOperations: OperationId[];
  activeRun: ActiveRunState | null;
  // Field Mods System - Black Market queue
  queuedFieldModsForNextRun?: import("./fieldMods").FieldModInstance[];
}

export interface ActiveRunState {
  operationId: OperationId;
  difficulty: Difficulty;
  floorsTotal: number;
  floorIndex: number; // 0-based
  nodeMapByFloor: Record<number, NodeMap>;
  currentNodeId: string;
  clearedNodeIds: string[];
  pendingBattle?: PendingBattleState;
  rngSeed: string;
  // Run statistics
  battlesWon: number;
  battlesLost: number;
  retries: number;
  nodesCleared: number;
  // Field Mods System
  runFieldModInventory?: import("./fieldMods").FieldModInstance[];
  unitHardpoints?: Record<string, import("./fieldMods").HardpointState>; // unitId -> [mod1, mod2]
  // Key Room System
  keyRoomsByFloor?: Record<number, KeyRoomState[]>; // floorIndex -> KeyRoomState[]
  pendingKeyRoomCapture?: {
    nodeId: string;
    floorIndex: number;
  };
  pendingDefenseDecision?: {
    keyRoomId: string;
    floorIndex: number;
    nodeId: string;
  };
}

export interface NodeMap {
  nodes: RoomNode[];
  connections: Record<string, string[]>; // nodeId -> connected nodeIds
  startNodeId: string;
  exitNodeId: string;
}

export interface PendingBattleState {
  nodeId: string;
  encounterSeed: string;
  encounterDefinition: EncounterDefinition;
}

export interface EncounterDefinition {
  enemyUnits: Array<{
    enemyId: string;
    count: number;
    levelMod?: number;
    elite?: boolean;
  }>;
  gridWidth: number;
  gridHeight: number;
  introText?: string;
}

// Key Room System Types
export type FacilityType = "supply_depot" | "medical_ward" | "armory" | "command_center" | "mine";

export type ResourceType = "metalScrap" | "wood" | "chaosShards" | "steamComponents" | "wad";

export interface KeyRoomState {
  roomNodeId: string;
  facility: FacilityType;
  storedResources: Partial<Record<ResourceType, number>>;
  isUnderAttack: boolean;
  isDelayed: boolean;
}

export interface OperationDefinition {
  id: OperationId;
  name: string;
  description: string;
  floors: number;
  recommendedPower?: number;
  unlocksNextOperationId?: OperationId;
  isCustom: boolean;
}

// ----------------------------------------------------------------------------
// OPERATION DEFINITIONS
// ----------------------------------------------------------------------------

export const OPERATION_DEFINITIONS: Record<OperationId, OperationDefinition> = {
  op_iron_gate: {
    id: "op_iron_gate",
    name: "IRON GATE",
    description: "Secure the Chaos Rift entrance and clear the corrupted garrison.",
    floors: 3,
    recommendedPower: 10,
    unlocksNextOperationId: "op_black_spire",
    isCustom: false,
  },
  op_black_spire: {
    id: "op_black_spire",
    name: "BLACK SPIRE",
    description: "Capture enemy artillery positions and neutralize long-range threats.",
    floors: 3,
    recommendedPower: 20,
    unlocksNextOperationId: "op_ghost_run",
    isCustom: false,
  },
  op_ghost_run: {
    id: "op_ghost_run",
    name: "GHOST RUN",
    description: "Disrupt enemy supply lines and eliminate fast-moving skirmishers.",
    floors: 3,
    recommendedPower: 30,
    unlocksNextOperationId: "op_ember_siege",
    isCustom: false,
  },
  op_ember_siege: {
    id: "op_ember_siege",
    name: "EMBER SIEGE",
    description: "Destroy key enemy fortifications and break through defensive lines.",
    floors: 3,
    recommendedPower: 40,
    unlocksNextOperationId: "op_final_dawn",
    isCustom: false,
  },
  op_final_dawn: {
    id: "op_final_dawn",
    name: "FINAL DAWN",
    description: "Assault the enemy command center and end the conflict.",
    floors: 3,
    recommendedPower: 50,
    isCustom: false,
  },
  op_custom: {
    id: "op_custom",
    name: "CUSTOM OPERATION",
    description: "Create a custom operation with your own parameters.",
    floors: 3, // Default, can be overridden
    isCustom: true,
  },
};

// ----------------------------------------------------------------------------
// CAMPAIGN PROGRESS PERSISTENCE
// ----------------------------------------------------------------------------

const CAMPAIGN_STORAGE_KEY = "chaoscore_campaign_progress";
const CAMPAIGN_VERSION = 1;

/**
 * Load campaign progress from storage
 */
export function loadCampaignProgress(): CampaignProgress {
  try {
    const stored = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as CampaignProgress;
      // Version migration check
      if (parsed.version !== CAMPAIGN_VERSION) {
        console.warn("[CAMPAIGN] Version mismatch, resetting progress");
        return createDefaultCampaignProgress();
      }
      return parsed;
    }
  } catch (error) {
    console.error("[CAMPAIGN] Failed to load progress:", error);
  }
  
  return createDefaultCampaignProgress();
}

/**
 * Save campaign progress to storage
 */
export function saveCampaignProgress(progress: CampaignProgress): void {
  try {
    const toSave = {
      ...progress,
      version: CAMPAIGN_VERSION,
    };
    localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(toSave));
    console.log("[CAMPAIGN] Progress saved");
  } catch (error) {
    console.error("[CAMPAIGN] Failed to save progress:", error);
  }
}

/**
 * Create default campaign progress (only Operation 1 unlocked)
 */
export function createDefaultCampaignProgress(): CampaignProgress {
  return {
    version: CAMPAIGN_VERSION,
    completedOperations: [],
    unlockedOperations: ["op_iron_gate"], // Only first operation unlocked
    activeRun: null,
  };
}

// ----------------------------------------------------------------------------
// OPERATION LOCKING LOGIC
// ----------------------------------------------------------------------------

/**
 * Check if an operation is unlocked
 */
export function isOperationUnlocked(
  operationId: OperationId,
  progress: CampaignProgress
): boolean {
  // Custom operation is always available (or after first op - choose always)
  if (operationId === "op_custom") {
    return progress.unlockedOperations.includes("op_iron_gate");
  }
  
  return progress.unlockedOperations.includes(operationId);
}

/**
 * Check if an operation is completed
 */
export function isOperationCompleted(
  operationId: OperationId,
  progress: CampaignProgress
): boolean {
  return progress.completedOperations.includes(operationId);
}

/**
 * Unlock the next operation after completing one
 */
export function unlockNextOperation(
  completedOperationId: OperationId,
  progress: CampaignProgress
): CampaignProgress {
  const opDef = OPERATION_DEFINITIONS[completedOperationId];
  if (!opDef || !opDef.unlocksNextOperationId) {
    return progress;
  }
  
  const nextOpId = opDef.unlocksNextOperationId;
  if (progress.unlockedOperations.includes(nextOpId)) {
    return progress; // Already unlocked
  }
  
  return {
    ...progress,
    unlockedOperations: [...progress.unlockedOperations, nextOpId],
  };
}

/**
 * Mark an operation as completed
 */
export function completeOperation(
  operationId: OperationId,
  progress: CampaignProgress
): CampaignProgress {
  if (progress.completedOperations.includes(operationId)) {
    return progress; // Already completed
  }
  
  const updated = {
    ...progress,
    completedOperations: [...progress.completedOperations, operationId],
  };
  
  // Unlock next operation
  return unlockNextOperation(operationId, updated);
}

// ----------------------------------------------------------------------------
// DEV MODE HELPERS
// ----------------------------------------------------------------------------

const DEBUG_UNLOCK_ALL_OPS = false; // Set to true in dev mode

/**
 * Get unlocked operations (with dev mode bypass)
 */
export function getUnlockedOperations(progress: CampaignProgress): OperationId[] {
  if (DEBUG_UNLOCK_ALL_OPS) {
    return Object.keys(OPERATION_DEFINITIONS) as OperationId[];
  }
  return progress.unlockedOperations;
}

/**
 * Dev mode: Unlock all operations
 */
export function debugUnlockAllOperations(): CampaignProgress {
  const progress = loadCampaignProgress();
  return {
    ...progress,
    unlockedOperations: Object.keys(OPERATION_DEFINITIONS) as OperationId[],
  };
}


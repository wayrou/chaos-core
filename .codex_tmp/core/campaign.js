// ============================================================================
// CHAOS CORE - CAMPAIGN SYSTEM
// Campaign progress, operation definitions, and run management
// ============================================================================
import { getAllImportedOperations, isTechnicaContentDisabled, } from "../content/technica";
import { getGameState } from "../state/gameStore";
import { getAtlasTheaterByOperationId } from "./atlasSystem";
import { getImportedOperationBriefing } from "./importedOperationTheater";
/**
 * Get effective floor count for an operation.
 */
export function getEffectiveFloors(opDef, customFloors) {
    const baseFloors = customFloors || opDef.floors;
    return baseFloors;
}
/**
 * Calculate recommended power for a floor
 * Starts at 25 for floor 0, scales linearly
 */
export function calculateRecommendedPower(floorIndex, baseRecommendedPower) {
    const basePWR = baseRecommendedPower ?? 25;
    const pwrPerFloor = 2.5;
    return Math.round(basePWR + (floorIndex * pwrPerFloor));
}
// ----------------------------------------------------------------------------
// OPERATION DEFINITIONS
// ----------------------------------------------------------------------------
export const OPERATION_DEFINITIONS = {
    op_iron_gate: {
        id: "op_iron_gate",
        name: "IRON GATE",
        description: "Secure the Chaos Rift entrance and clear the corrupted garrison.",
        objective: "Establish a forward logistics chain through the Gateworks and break the eastern lockline.",
        beginningState: "Ingress Yard secured. Causeway mapped. Generator and command sectors dark.",
        endState: "Objective lock secured with at least one operational C.O.R.E. and a stable supply chain.",
        theaterId: "op_iron_gate_castellan_gateworks",
        floors: 3,
        recommendedPower: 25, // Base, will scale per floor
        unlocksNextOperationId: "op_black_spire",
        isCustom: false,
    },
    op_black_spire: {
        id: "op_black_spire",
        name: "BLACK SPIRE",
        description: "Capture enemy artillery positions and neutralize long-range threats.",
        floors: 3,
        recommendedPower: 25, // Base, will scale per floor
        unlocksNextOperationId: "op_ghost_run",
        isCustom: false,
    },
    op_ghost_run: {
        id: "op_ghost_run",
        name: "GHOST RUN",
        description: "Disrupt enemy supply lines and eliminate fast-moving skirmishers.",
        floors: 3,
        recommendedPower: 25, // Base, will scale per floor
        unlocksNextOperationId: "op_ember_siege",
        isCustom: false,
    },
    op_ember_siege: {
        id: "op_ember_siege",
        name: "EMBER SIEGE",
        description: "Destroy key enemy fortifications and break through defensive lines.",
        floors: 3,
        recommendedPower: 25, // Base, will scale per floor
        unlocksNextOperationId: "op_final_dawn",
        isCustom: false,
    },
    op_final_dawn: {
        id: "op_final_dawn",
        name: "FINAL DAWN",
        description: "Assault the enemy command center and end the conflict.",
        floors: 3,
        recommendedPower: 25, // Base, will scale per floor
        isCustom: false,
    },
    op_custom: {
        id: "op_custom",
        name: "CUSTOM OPERATION",
        description: "Generate a fully randomized theater operation with custom floor count and combat density.",
        objective: "Push from the uplink to the descent point on each floor until the final theater is secured.",
        floors: 3, // Default, can be overridden
        isCustom: true,
    },
};
getAllImportedOperations().forEach((operation) => {
    const briefing = getImportedOperationBriefing(operation);
    const atlasSummary = getAtlasTheaterByOperationId(operation.id);
    OPERATION_DEFINITIONS[operation.id] = {
        id: operation.id,
        name: operation.codename,
        description: operation.description,
        objective: briefing.objective,
        beginningState: briefing.beginningState,
        endState: briefing.endState,
        theaterId: atlasSummary?.theaterId,
        floors: Math.max(1, operation.floors.length),
        recommendedPower: operation.recommendedPower,
        unlocksNextOperationId: typeof operation.metadata?.unlocksNextOperationId === "string"
            ? operation.metadata.unlocksNextOperationId
            : undefined,
        isCustom: false,
    };
});
Object.keys(OPERATION_DEFINITIONS).forEach((operationId) => {
    if (!getAllImportedOperations().some((operation) => operation.id === operationId) && isTechnicaContentDisabled("operation", operationId)) {
        delete OPERATION_DEFINITIONS[operationId];
    }
});
// ----------------------------------------------------------------------------
// CAMPAIGN PROGRESS PERSISTENCE
// ----------------------------------------------------------------------------
const CAMPAIGN_STORAGE_KEY = "chaoscore_campaign_progress";
const CAMPAIGN_VERSION = 1;
export const SCHEMA_UNLOCK_FLOOR_ORDINAL = 2;
export const ADVANCED_CORE_TIER_UNLOCK_FLOOR_ORDINAL = 3;
export const PORT_UNLOCK_FLOOR_ORDINAL = 4;
export const STABLE_UNLOCK_FLOOR_ORDINAL = 5;
export const DISPATCH_UNLOCK_FLOOR_ORDINAL = 6;
export const BLACK_MARKET_UNLOCK_FLOOR_ORDINAL = 7;
export const PROTOTYPE_CORE_TIER_UNLOCK_FLOOR_ORDINAL = 8;
export const FOUNDRY_ANNEX_UNLOCK_FLOOR_ORDINAL = 9;
export const HAVEN_BUILD_MODE_UNLOCK_FLOOR_ORDINAL = 10;
export const FINAL_RESET_UNLOCK_FLOOR_ORDINAL = 12;
export const CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL = 12;
export const ADVANCED_SCHEMA_CORE_TYPES = [
    "logistics_hub",
    "forward_maintenance_bay",
    "emergency_supply_cache",
    "operations_planning_cell",
    "quartermaster_cell",
    "stable",
    "survey_array",
    "recovery_yard",
    "transit_hub",
    "tavern",
];
export const PROTOTYPE_SCHEMA_CORE_TYPES = [
    "prototype_systems_lab",
    "forward_fire_support_post",
    "tactics_school",
    "workshop",
];
export const MASTER_UNLOCK_GUIDE = [
    { floorOrdinal: 0, label: "Opening Cutscene", kind: "cutscene" },
    { floorOrdinal: 1, label: "A.T.L.A.S. / Ops Terminal Online", kind: "system" },
    { floorOrdinal: 2, label: "Schema Node", kind: "node" },
    { floorOrdinal: 3, label: "Advanced C.O.R.E. Tier", kind: "system" },
    { floorOrdinal: 4, label: "Port Node", kind: "node" },
    { floorOrdinal: 5, label: "Stable Node", kind: "node" },
    { floorOrdinal: 6, label: "Dispatch Node", kind: "node" },
    { floorOrdinal: 7, label: "Black Market Node", kind: "node" },
    { floorOrdinal: 8, label: "Experimental / Prototype C.O.R.E. Tier", kind: "system" },
    { floorOrdinal: 9, label: "Foundry + Annex", kind: "placeholder" },
    { floorOrdinal: 10, label: "HAVEN Build Mode", kind: "system" },
    { floorOrdinal: 11, label: "No New Unlock", kind: "reserved" },
    { floorOrdinal: 12, label: "Final Completion Unlock", kind: "endgame" },
];
function getDefaultUnlockedOperationIds() {
    const builtInDefaults = ["op_iron_gate"].filter((operationId) => !isTechnicaContentDisabled("operation", operationId));
    const importedOperationIds = getAllImportedOperations()
        .map((operation) => operation.id)
        .filter((operationId) => operationId !== "op_custom" && operationId !== "op_iron_gate");
    return Array.from(new Set([...builtInDefaults, ...importedOperationIds]));
}
function getDerivedHighestReachedFloorOrdinal(progress) {
    const activeRunFloorOrdinal = Math.max(1, (progress?.activeRun?.floorIndex ?? 0) + 1);
    const atlasCurrentFloorOrdinal = Math.max(1, progress?.opsTerminalAtlas?.currentFloorOrdinal ?? 1);
    const atlasGeneratedFloorOrdinal = Math.max(1, ...Object.values(progress?.opsTerminalAtlas?.floorsById ?? {}).map((floor) => Math.max(1, floor.floorOrdinal ?? 1)));
    const liveOperationFloorOrdinal = (() => {
        try {
            return Math.max(1, (getGameState().operation?.currentFloorIndex ?? 0) + 1);
        }
        catch {
            return 1;
        }
    })();
    return Math.max(activeRunFloorOrdinal, atlasCurrentFloorOrdinal, atlasGeneratedFloorOrdinal, liveOperationFloorOrdinal);
}
export function getHighestReachedFloorOrdinal(progress) {
    const storedFloorOrdinal = Math.max(1, Number(progress?.highestReachedFloorOrdinal ?? 1));
    return Math.max(storedFloorOrdinal, getDerivedHighestReachedFloorOrdinal(progress));
}
function hasReachedFloorOrdinal(floorOrdinal, progress) {
    return getHighestReachedFloorOrdinal(progress) >= floorOrdinal;
}
function normalizeCampaignProgress(progress) {
    return {
        ...progress,
        unlockedOperations: Array.from(new Set([...(progress.unlockedOperations ?? []), ...getDefaultUnlockedOperationIds()])),
        schemaNodeUnlocked: Boolean(progress.schemaNodeUnlocked || getHighestReachedFloorOrdinal(progress) >= SCHEMA_UNLOCK_FLOOR_ORDINAL),
        highestReachedFloorOrdinal: getHighestReachedFloorOrdinal(progress),
        postgameUnlocked: Boolean(progress.postgameUnlocked || getHighestReachedFloorOrdinal(progress) >= FINAL_RESET_UNLOCK_FLOOR_ORDINAL),
        endingCutsceneSeen: Boolean(progress.endingCutsceneSeen),
    };
}
/**
 * Load campaign progress from storage
 */
export function loadCampaignProgress() {
    try {
        const stored = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Version migration check
            if (parsed.version !== CAMPAIGN_VERSION) {
                console.warn("[CAMPAIGN] Version mismatch, resetting progress");
                return normalizeCampaignProgress(createDefaultCampaignProgress());
            }
            return normalizeCampaignProgress(parsed);
        }
    }
    catch (error) {
        console.error("[CAMPAIGN] Failed to load progress:", error);
    }
    return normalizeCampaignProgress(createDefaultCampaignProgress());
}
/**
 * Save campaign progress to storage
 */
export function saveCampaignProgress(progress) {
    try {
        const toSave = {
            ...normalizeCampaignProgress(progress),
            version: CAMPAIGN_VERSION,
        };
        localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(toSave));
        console.log("[CAMPAIGN] Progress saved");
    }
    catch (error) {
        console.error("[CAMPAIGN] Failed to save progress:", error);
    }
}
/**
 * Create default campaign progress (only Operation 1 unlocked)
 */
export function createDefaultCampaignProgress() {
    return {
        version: CAMPAIGN_VERSION,
        completedOperations: [],
        unlockedOperations: getDefaultUnlockedOperationIds(),
        activeRun: null,
        schemaNodeUnlocked: false,
        highestReachedFloorOrdinal: 1,
        postgameUnlocked: false,
        endingCutsceneSeen: false,
    };
}
// ----------------------------------------------------------------------------
// OPERATION LOCKING LOGIC
// ----------------------------------------------------------------------------
/**
 * Check if an operation is unlocked
 */
export function isOperationUnlocked(operationId, progress) {
    // Custom operation is always available (or after first op - choose always)
    if (operationId === "op_custom") {
        return progress.unlockedOperations.length > 0;
    }
    return progress.unlockedOperations.includes(operationId);
}
/**
 * Check if an operation is completed
 */
export function isOperationCompleted(operationId, progress) {
    return progress.completedOperations.includes(operationId);
}
function isEscDebugHavenAnnexUnlocked() {
    try {
        return Boolean(getGameState().uiLayout?.escDebugPortStableUnlock);
    }
    catch {
        return false;
    }
}
export function isHavenAnnexUnlocked(progress = loadCampaignProgress()) {
    return Boolean(isPortNodeUnlocked(progress)
        || isStableNodeUnlocked(progress)
        || isDispatchNodeUnlocked(progress));
}
export function isSchemaNodeUnlocked(progress = loadCampaignProgress()) {
    return Boolean(progress.schemaNodeUnlocked || getHighestReachedFloorOrdinal(progress) >= SCHEMA_UNLOCK_FLOOR_ORDINAL);
}
export function isAdvancedCoreTierUnlocked(progress = loadCampaignProgress()) {
    return hasReachedFloorOrdinal(ADVANCED_CORE_TIER_UNLOCK_FLOOR_ORDINAL, progress);
}
export function isPrototypeCoreTierUnlocked(progress = loadCampaignProgress()) {
    return hasReachedFloorOrdinal(PROTOTYPE_CORE_TIER_UNLOCK_FLOOR_ORDINAL, progress);
}
export function getSchemaCoreUnlockFloorOrdinal(coreType) {
    if (PROTOTYPE_SCHEMA_CORE_TYPES.includes(coreType)) {
        return PROTOTYPE_CORE_TIER_UNLOCK_FLOOR_ORDINAL;
    }
    if (ADVANCED_SCHEMA_CORE_TYPES.includes(coreType)) {
        return ADVANCED_CORE_TIER_UNLOCK_FLOOR_ORDINAL;
    }
    return 1;
}
export function isSchemaCoreTierAvailable(coreType, progress = loadCampaignProgress()) {
    return hasReachedFloorOrdinal(getSchemaCoreUnlockFloorOrdinal(coreType), progress);
}
export function isPortNodeUnlocked(progress = loadCampaignProgress()) {
    return Boolean(isEscDebugHavenAnnexUnlocked() || hasReachedFloorOrdinal(PORT_UNLOCK_FLOOR_ORDINAL, progress));
}
export function isStableNodeUnlocked(progress = loadCampaignProgress()) {
    return Boolean(isEscDebugHavenAnnexUnlocked() || hasReachedFloorOrdinal(STABLE_UNLOCK_FLOOR_ORDINAL, progress));
}
export function isDispatchNodeUnlocked(progress = loadCampaignProgress()) {
    return Boolean(isEscDebugHavenAnnexUnlocked() || hasReachedFloorOrdinal(DISPATCH_UNLOCK_FLOOR_ORDINAL, progress));
}
export function isBlackMarketNodeUnlocked(progress = loadCampaignProgress()) {
    return hasReachedFloorOrdinal(BLACK_MARKET_UNLOCK_FLOOR_ORDINAL, progress);
}
export function isFoundryAnnexUnlocked(progress = loadCampaignProgress()) {
    return hasReachedFloorOrdinal(FOUNDRY_ANNEX_UNLOCK_FLOOR_ORDINAL, progress);
}
export function isHavenBuildModeUnlocked(progress = loadCampaignProgress()) {
    return hasReachedFloorOrdinal(HAVEN_BUILD_MODE_UNLOCK_FLOOR_ORDINAL, progress);
}
export function isFinalResetUnlocked(progress = loadCampaignProgress()) {
    return Boolean(progress.postgameUnlocked || hasReachedFloorOrdinal(FINAL_RESET_UNLOCK_FLOOR_ORDINAL, progress));
}
export function unlockCampaignPostgame(progress = loadCampaignProgress()) {
    if (progress.postgameUnlocked) {
        return progress;
    }
    const updated = normalizeCampaignProgress({
        ...progress,
        postgameUnlocked: true,
    });
    saveCampaignProgress(updated);
    return updated;
}
export function hasSeenEndingCutscene(progress = loadCampaignProgress()) {
    return Boolean(progress.endingCutsceneSeen);
}
export function markEndingCutsceneSeen(progress = loadCampaignProgress()) {
    if (progress.endingCutsceneSeen) {
        return progress;
    }
    const updated = normalizeCampaignProgress({
        ...progress,
        endingCutsceneSeen: true,
    });
    saveCampaignProgress(updated);
    return updated;
}
/**
 * Unlock the next operation after completing one
 */
export function unlockNextOperation(completedOperationId, progress) {
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
export function completeOperation(operationId, progress) {
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
export function getUnlockedOperations(progress) {
    if (DEBUG_UNLOCK_ALL_OPS) {
        return Object.keys(OPERATION_DEFINITIONS);
    }
    return progress.unlockedOperations;
}
/**
 * Dev mode: Unlock all operations
 */
export function debugUnlockAllOperations() {
    const progress = loadCampaignProgress();
    return {
        ...progress,
        unlockedOperations: Object.keys(OPERATION_DEFINITIONS),
    };
}

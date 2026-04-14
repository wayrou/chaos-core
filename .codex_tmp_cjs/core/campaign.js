"use strict";
// ============================================================================
// CHAOS CORE - CAMPAIGN SYSTEM
// Campaign progress, operation definitions, and run management
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.MASTER_UNLOCK_GUIDE = exports.PROTOTYPE_SCHEMA_CORE_TYPES = exports.ADVANCED_SCHEMA_CORE_TYPES = exports.CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL = exports.FINAL_RESET_UNLOCK_FLOOR_ORDINAL = exports.HAVEN_BUILD_MODE_UNLOCK_FLOOR_ORDINAL = exports.FOUNDRY_ANNEX_UNLOCK_FLOOR_ORDINAL = exports.PROTOTYPE_CORE_TIER_UNLOCK_FLOOR_ORDINAL = exports.BLACK_MARKET_UNLOCK_FLOOR_ORDINAL = exports.DISPATCH_UNLOCK_FLOOR_ORDINAL = exports.STABLE_UNLOCK_FLOOR_ORDINAL = exports.PORT_UNLOCK_FLOOR_ORDINAL = exports.ADVANCED_CORE_TIER_UNLOCK_FLOOR_ORDINAL = exports.SCHEMA_UNLOCK_FLOOR_ORDINAL = exports.OPERATION_DEFINITIONS = void 0;
exports.getEffectiveFloors = getEffectiveFloors;
exports.calculateRecommendedPower = calculateRecommendedPower;
exports.getHighestReachedFloorOrdinal = getHighestReachedFloorOrdinal;
exports.loadCampaignProgress = loadCampaignProgress;
exports.saveCampaignProgress = saveCampaignProgress;
exports.createDefaultCampaignProgress = createDefaultCampaignProgress;
exports.isOperationUnlocked = isOperationUnlocked;
exports.isOperationCompleted = isOperationCompleted;
exports.isHavenAnnexUnlocked = isHavenAnnexUnlocked;
exports.isSchemaNodeUnlocked = isSchemaNodeUnlocked;
exports.isAdvancedCoreTierUnlocked = isAdvancedCoreTierUnlocked;
exports.isPrototypeCoreTierUnlocked = isPrototypeCoreTierUnlocked;
exports.getSchemaCoreUnlockFloorOrdinal = getSchemaCoreUnlockFloorOrdinal;
exports.isSchemaCoreTierAvailable = isSchemaCoreTierAvailable;
exports.isPortNodeUnlocked = isPortNodeUnlocked;
exports.isStableNodeUnlocked = isStableNodeUnlocked;
exports.isDispatchNodeUnlocked = isDispatchNodeUnlocked;
exports.isBlackMarketNodeUnlocked = isBlackMarketNodeUnlocked;
exports.isFoundryAnnexUnlocked = isFoundryAnnexUnlocked;
exports.isHavenBuildModeUnlocked = isHavenBuildModeUnlocked;
exports.isFinalResetUnlocked = isFinalResetUnlocked;
exports.unlockCampaignPostgame = unlockCampaignPostgame;
exports.hasSeenEndingCutscene = hasSeenEndingCutscene;
exports.markEndingCutsceneSeen = markEndingCutsceneSeen;
exports.unlockNextOperation = unlockNextOperation;
exports.completeOperation = completeOperation;
exports.getUnlockedOperations = getUnlockedOperations;
exports.debugUnlockAllOperations = debugUnlockAllOperations;
const technica_1 = require("../content/technica");
const gameStore_1 = require("../state/gameStore");
const atlasSystem_1 = require("./atlasSystem");
const importedOperationTheater_1 = require("./importedOperationTheater");
/**
 * Get effective floor count for an operation.
 */
function getEffectiveFloors(opDef, customFloors) {
    const baseFloors = customFloors || opDef.floors;
    return baseFloors;
}
/**
 * Calculate recommended power for a floor
 * Starts at 25 for floor 0, scales linearly
 */
function calculateRecommendedPower(floorIndex, baseRecommendedPower) {
    const basePWR = baseRecommendedPower ?? 25;
    const pwrPerFloor = 2.5;
    return Math.round(basePWR + (floorIndex * pwrPerFloor));
}
// ----------------------------------------------------------------------------
// OPERATION DEFINITIONS
// ----------------------------------------------------------------------------
exports.OPERATION_DEFINITIONS = {
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
(0, technica_1.getAllImportedOperations)().forEach((operation) => {
    const briefing = (0, importedOperationTheater_1.getImportedOperationBriefing)(operation);
    const atlasSummary = (0, atlasSystem_1.getAtlasTheaterByOperationId)(operation.id);
    exports.OPERATION_DEFINITIONS[operation.id] = {
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
Object.keys(exports.OPERATION_DEFINITIONS).forEach((operationId) => {
    if (!(0, technica_1.getAllImportedOperations)().some((operation) => operation.id === operationId) && (0, technica_1.isTechnicaContentDisabled)("operation", operationId)) {
        delete exports.OPERATION_DEFINITIONS[operationId];
    }
});
// ----------------------------------------------------------------------------
// CAMPAIGN PROGRESS PERSISTENCE
// ----------------------------------------------------------------------------
const CAMPAIGN_STORAGE_KEY = "chaoscore_campaign_progress";
const CAMPAIGN_VERSION = 1;
exports.SCHEMA_UNLOCK_FLOOR_ORDINAL = 2;
exports.ADVANCED_CORE_TIER_UNLOCK_FLOOR_ORDINAL = 3;
exports.PORT_UNLOCK_FLOOR_ORDINAL = 4;
exports.STABLE_UNLOCK_FLOOR_ORDINAL = 5;
exports.DISPATCH_UNLOCK_FLOOR_ORDINAL = 6;
exports.BLACK_MARKET_UNLOCK_FLOOR_ORDINAL = 7;
exports.PROTOTYPE_CORE_TIER_UNLOCK_FLOOR_ORDINAL = 8;
exports.FOUNDRY_ANNEX_UNLOCK_FLOOR_ORDINAL = 9;
exports.HAVEN_BUILD_MODE_UNLOCK_FLOOR_ORDINAL = 10;
exports.FINAL_RESET_UNLOCK_FLOOR_ORDINAL = 12;
exports.CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL = 12;
exports.ADVANCED_SCHEMA_CORE_TYPES = [
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
exports.PROTOTYPE_SCHEMA_CORE_TYPES = [
    "prototype_systems_lab",
    "forward_fire_support_post",
    "tactics_school",
    "workshop",
];
exports.MASTER_UNLOCK_GUIDE = [
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
    const builtInDefaults = ["op_iron_gate"].filter((operationId) => !(0, technica_1.isTechnicaContentDisabled)("operation", operationId));
    const importedOperationIds = (0, technica_1.getAllImportedOperations)()
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
            return Math.max(1, ((0, gameStore_1.getGameState)().operation?.currentFloorIndex ?? 0) + 1);
        }
        catch {
            return 1;
        }
    })();
    return Math.max(activeRunFloorOrdinal, atlasCurrentFloorOrdinal, atlasGeneratedFloorOrdinal, liveOperationFloorOrdinal);
}
function getHighestReachedFloorOrdinal(progress) {
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
        schemaNodeUnlocked: Boolean(progress.schemaNodeUnlocked || getHighestReachedFloorOrdinal(progress) >= exports.SCHEMA_UNLOCK_FLOOR_ORDINAL),
        highestReachedFloorOrdinal: getHighestReachedFloorOrdinal(progress),
        postgameUnlocked: Boolean(progress.postgameUnlocked || getHighestReachedFloorOrdinal(progress) >= exports.FINAL_RESET_UNLOCK_FLOOR_ORDINAL),
        endingCutsceneSeen: Boolean(progress.endingCutsceneSeen),
    };
}
/**
 * Load campaign progress from storage
 */
function loadCampaignProgress() {
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
function saveCampaignProgress(progress) {
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
function createDefaultCampaignProgress() {
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
function isOperationUnlocked(operationId, progress) {
    // Custom operation is always available (or after first op - choose always)
    if (operationId === "op_custom") {
        return progress.unlockedOperations.length > 0;
    }
    return progress.unlockedOperations.includes(operationId);
}
/**
 * Check if an operation is completed
 */
function isOperationCompleted(operationId, progress) {
    return progress.completedOperations.includes(operationId);
}
function isEscDebugHavenAnnexUnlocked() {
    try {
        return Boolean((0, gameStore_1.getGameState)().uiLayout?.escDebugPortStableUnlock);
    }
    catch {
        return false;
    }
}
function isHavenAnnexUnlocked(progress = loadCampaignProgress()) {
    return Boolean(isPortNodeUnlocked(progress)
        || isStableNodeUnlocked(progress)
        || isDispatchNodeUnlocked(progress));
}
function isSchemaNodeUnlocked(progress = loadCampaignProgress()) {
    return Boolean(progress.schemaNodeUnlocked || getHighestReachedFloorOrdinal(progress) >= exports.SCHEMA_UNLOCK_FLOOR_ORDINAL);
}
function isAdvancedCoreTierUnlocked(progress = loadCampaignProgress()) {
    return hasReachedFloorOrdinal(exports.ADVANCED_CORE_TIER_UNLOCK_FLOOR_ORDINAL, progress);
}
function isPrototypeCoreTierUnlocked(progress = loadCampaignProgress()) {
    return hasReachedFloorOrdinal(exports.PROTOTYPE_CORE_TIER_UNLOCK_FLOOR_ORDINAL, progress);
}
function getSchemaCoreUnlockFloorOrdinal(coreType) {
    if (exports.PROTOTYPE_SCHEMA_CORE_TYPES.includes(coreType)) {
        return exports.PROTOTYPE_CORE_TIER_UNLOCK_FLOOR_ORDINAL;
    }
    if (exports.ADVANCED_SCHEMA_CORE_TYPES.includes(coreType)) {
        return exports.ADVANCED_CORE_TIER_UNLOCK_FLOOR_ORDINAL;
    }
    return 1;
}
function isSchemaCoreTierAvailable(coreType, progress = loadCampaignProgress()) {
    return hasReachedFloorOrdinal(getSchemaCoreUnlockFloorOrdinal(coreType), progress);
}
function isPortNodeUnlocked(progress = loadCampaignProgress()) {
    return Boolean(isEscDebugHavenAnnexUnlocked() || hasReachedFloorOrdinal(exports.PORT_UNLOCK_FLOOR_ORDINAL, progress));
}
function isStableNodeUnlocked(progress = loadCampaignProgress()) {
    return Boolean(isEscDebugHavenAnnexUnlocked() || hasReachedFloorOrdinal(exports.STABLE_UNLOCK_FLOOR_ORDINAL, progress));
}
function isDispatchNodeUnlocked(progress = loadCampaignProgress()) {
    return Boolean(isEscDebugHavenAnnexUnlocked() || hasReachedFloorOrdinal(exports.DISPATCH_UNLOCK_FLOOR_ORDINAL, progress));
}
function isBlackMarketNodeUnlocked(progress = loadCampaignProgress()) {
    return hasReachedFloorOrdinal(exports.BLACK_MARKET_UNLOCK_FLOOR_ORDINAL, progress);
}
function isFoundryAnnexUnlocked(progress = loadCampaignProgress()) {
    return hasReachedFloorOrdinal(exports.FOUNDRY_ANNEX_UNLOCK_FLOOR_ORDINAL, progress);
}
function isHavenBuildModeUnlocked(progress = loadCampaignProgress()) {
    return hasReachedFloorOrdinal(exports.HAVEN_BUILD_MODE_UNLOCK_FLOOR_ORDINAL, progress);
}
function isFinalResetUnlocked(progress = loadCampaignProgress()) {
    return Boolean(progress.postgameUnlocked || hasReachedFloorOrdinal(exports.FINAL_RESET_UNLOCK_FLOOR_ORDINAL, progress));
}
function unlockCampaignPostgame(progress = loadCampaignProgress()) {
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
function hasSeenEndingCutscene(progress = loadCampaignProgress()) {
    return Boolean(progress.endingCutsceneSeen);
}
function markEndingCutsceneSeen(progress = loadCampaignProgress()) {
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
function unlockNextOperation(completedOperationId, progress) {
    const opDef = exports.OPERATION_DEFINITIONS[completedOperationId];
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
function completeOperation(operationId, progress) {
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
function getUnlockedOperations(progress) {
    if (DEBUG_UNLOCK_ALL_OPS) {
        return Object.keys(exports.OPERATION_DEFINITIONS);
    }
    return progress.unlockedOperations;
}
/**
 * Dev mode: Unlock all operations
 */
function debugUnlockAllOperations() {
    const progress = loadCampaignProgress();
    return {
        ...progress,
        unlockedOperations: Object.keys(exports.OPERATION_DEFINITIONS),
    };
}

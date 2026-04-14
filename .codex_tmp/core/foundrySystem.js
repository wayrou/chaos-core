import { hasEnoughResources as hasEnoughResourceValues, subtractResourceWallet, } from "./resources";
function hasEnoughResources(resources, cost) {
    return hasEnoughResourceValues(resources, cost);
}
function subtractResources(resources, cost) {
    return subtractResourceWallet(resources, cost);
}
export const ANNEX_FRAME_DEFINITIONS = {
    lightweight_annex: {
        id: "lightweight_annex",
        displayName: "Lightweight Annex Frame",
        frameCategory: "light",
        buildCost: { metalScrap: 2, wood: 2 },
        durability: 1,
        slotBonus: 1,
    },
    standard_annex: {
        id: "standard_annex",
        displayName: "Standard Annex Frame",
        frameCategory: "standard",
        buildCost: { metalScrap: 4, wood: 3, steamComponents: 1 },
        durability: 2,
        slotBonus: 2,
    },
    heavy_annex: {
        id: "heavy_annex",
        displayName: "Heavy Annex Frame",
        frameCategory: "heavy",
        buildCost: { metalScrap: 7, wood: 4, steamComponents: 2, chaosShards: 1 },
        durability: 3,
        slotBonus: 4,
    },
};
export const FOUNDRY_MODULE_UNLOCK_ORDER = [
    "threat_sensor",
    "power_sensor",
    "bandwidth_sensor",
    "loom_terminal",
    "threshold_switch",
    "delay_timer",
    "and_gate",
    "or_gate",
    "door_controller",
    "cache_release",
    "turret_controller",
    "capacitor",
    "supply_cache",
    "bandwidth_buffer",
    "latch",
    "delay_buffer",
    "accumulator",
    "power_stabilizer",
    "comms_stabilizer",
    "power_router",
    "bandwidth_router",
    "signal_splitter",
    "signal_relay",
    "motion_sensor",
    "supply_threshold_sensor",
    "room_state_sensor",
    "not_gate",
    "power_redirector",
    "bandwidth_redirector",
    "artillery_uplink",
    "memory_cell",
    "supply_stabilizer",
    "supply_router",
    "signal_merger",
    "cross_branch_relay",
];
export const FOUNDRY_PARTITION_UNLOCK_ORDER = [
    "blast_door",
];
export const FOUNDRY_MODULE_DEFINITIONS = {
    threat_sensor: {
        id: "threat_sensor",
        displayName: "Threat Sensor",
        category: "sensor",
        description: "Reads hostile threat pressure in the monitored room.",
        buildCost: { metalScrap: 2, chaosShards: 1 },
    },
    motion_sensor: {
        id: "motion_sensor",
        displayName: "Motion Sensor",
        category: "sensor",
        description: "Prototype motion reader for future presence-based logic.",
        buildCost: { metalScrap: 2, wood: 1 },
        placeholder: true,
    },
    power_sensor: {
        id: "power_sensor",
        displayName: "Power Sensor",
        category: "sensor",
        description: "Reads live wattage in the monitored room.",
        buildCost: { metalScrap: 2, steamComponents: 1 },
    },
    supply_threshold_sensor: {
        id: "supply_threshold_sensor",
        displayName: "Supply Threshold Sensor",
        category: "sensor",
        description: "Prototype supply-floor monitor for future automation chains.",
        buildCost: { metalScrap: 2, wood: 1 },
        placeholder: true,
    },
    bandwidth_sensor: {
        id: "bandwidth_sensor",
        displayName: "Bandwidth Sensor",
        category: "sensor",
        description: "Reads live BW throughput in the monitored room.",
        buildCost: { metalScrap: 2, chaosShards: 1 },
    },
    room_state_sensor: {
        id: "room_state_sensor",
        displayName: "Room State Sensor",
        category: "sensor",
        description: "Prototype room-state monitor for future logic chains.",
        buildCost: { metalScrap: 2, wood: 1 },
        placeholder: true,
    },
    loom_terminal: {
        id: "loom_terminal",
        displayName: "Loom Terminal",
        category: "logic",
        description: "Prototype signal-weaving terminal reserved for future orchestration and chain-authoring workflows.",
        buildCost: { metalScrap: 2, chaosShards: 1, steamComponents: 1 },
        placeholder: true,
    },
    and_gate: {
        id: "and_gate",
        displayName: "AND Gate",
        category: "logic",
        description: "Outputs high only when both linked inputs are high.",
        buildCost: { metalScrap: 1, steamComponents: 1 },
    },
    or_gate: {
        id: "or_gate",
        displayName: "OR Gate",
        category: "logic",
        description: "Outputs high when either linked input is high.",
        buildCost: { metalScrap: 1, steamComponents: 1 },
    },
    not_gate: {
        id: "not_gate",
        displayName: "NOT Gate",
        category: "logic",
        description: "Prototype inverter module.",
        buildCost: { metalScrap: 1, steamComponents: 1 },
        placeholder: true,
    },
    threshold_switch: {
        id: "threshold_switch",
        displayName: "Threshold Switch",
        category: "logic",
        description: "Compares a numeric input against a configured threshold.",
        buildCost: { metalScrap: 2, steamComponents: 1 },
    },
    delay_timer: {
        id: "delay_timer",
        displayName: "Delay Timer",
        category: "logic",
        description: "Holds output until an input stays active for the configured delay.",
        buildCost: { metalScrap: 2, steamComponents: 1 },
    },
    turret_controller: {
        id: "turret_controller",
        displayName: "Turret Controller",
        category: "actuator",
        description: "Arms installed turret pips for automated defensive fire.",
        buildCost: { metalScrap: 3, steamComponents: 2 },
        powerRequirement: 10,
    },
    cache_release: {
        id: "cache_release",
        displayName: "Cache Release",
        category: "actuator",
        description: "Pushes stored resources from a local cache into a target room on signal.",
        buildCost: { metalScrap: 2, wood: 1, steamComponents: 1 },
    },
    power_redirector: {
        id: "power_redirector",
        displayName: "Power Redirector",
        category: "actuator",
        description: "Prototype power reroute actuator.",
        buildCost: { metalScrap: 2, steamComponents: 2 },
        placeholder: true,
    },
    bandwidth_redirector: {
        id: "bandwidth_redirector",
        displayName: "Bandwidth Redirector",
        category: "actuator",
        description: "Prototype BW reroute actuator.",
        buildCost: { metalScrap: 2, chaosShards: 1 },
        placeholder: true,
    },
    artillery_uplink: {
        id: "artillery_uplink",
        displayName: "Artillery Uplink",
        category: "actuator",
        description: "Prototype remote artillery trigger.",
        buildCost: { metalScrap: 3, chaosShards: 2, steamComponents: 2 },
        placeholder: true,
    },
    door_controller: {
        id: "door_controller",
        displayName: "Door Controller",
        category: "actuator",
        description: "Controls a linked Blast Door partition.",
        buildCost: { metalScrap: 2, steamComponents: 1 },
        remoteTargetMinBw: 100,
    },
    capacitor: {
        id: "capacitor",
        displayName: "Capacitor",
        category: "buffer",
        description: "Stores excess power for later release or stabilization.",
        buildCost: { metalScrap: 2, steamComponents: 2 },
    },
    supply_cache: {
        id: "supply_cache",
        displayName: "Supply Cache",
        category: "buffer",
        description: "Stores excess crate throughput for local fallback.",
        buildCost: { metalScrap: 2, wood: 2 },
    },
    bandwidth_buffer: {
        id: "bandwidth_buffer",
        displayName: "Bandwidth Buffer",
        category: "buffer",
        description: "Stores excess comms headroom for emergency reroutes.",
        buildCost: { metalScrap: 2, chaosShards: 1 },
    },
    latch: {
        id: "latch",
        displayName: "Latch",
        category: "storage",
        description: "Once triggered, stays active until manually reset.",
        buildCost: { metalScrap: 1, steamComponents: 1 },
    },
    memory_cell: {
        id: "memory_cell",
        displayName: "Memory Cell",
        category: "storage",
        description: "Prototype long-form state memory cell.",
        buildCost: { metalScrap: 1, chaosShards: 1 },
        placeholder: true,
    },
    delay_buffer: {
        id: "delay_buffer",
        displayName: "Delay Buffer",
        category: "storage",
        description: "Delays signal transitions by a configurable number of ticks.",
        buildCost: { metalScrap: 2, steamComponents: 1 },
    },
    accumulator: {
        id: "accumulator",
        displayName: "Accumulator",
        category: "storage",
        description: "Accumulates numeric input over time until reset.",
        buildCost: { metalScrap: 2, steamComponents: 1 },
    },
    power_stabilizer: {
        id: "power_stabilizer",
        displayName: "Power Stabilizer",
        category: "stabilizer",
        description: "Uses stored charge to keep room wattage above a floor.",
        buildCost: { metalScrap: 2, steamComponents: 2 },
    },
    supply_stabilizer: {
        id: "supply_stabilizer",
        displayName: "Supply Stabilizer",
        category: "stabilizer",
        description: "Prototype crate-floor stabilizer.",
        buildCost: { metalScrap: 2, wood: 2 },
        placeholder: true,
    },
    comms_stabilizer: {
        id: "comms_stabilizer",
        displayName: "Comms Stabilizer",
        category: "stabilizer",
        description: "Uses buffered BW to keep command coverage above a floor.",
        buildCost: { metalScrap: 2, chaosShards: 1, steamComponents: 1 },
    },
    power_router: {
        id: "power_router",
        displayName: "Power Router",
        category: "router",
        description: "Redirects a fixed amount of power to another connected room.",
        buildCost: { metalScrap: 2, steamComponents: 1 },
        remoteTargetMinBw: 50,
    },
    supply_router: {
        id: "supply_router",
        displayName: "Supply Router",
        category: "router",
        description: "Prototype supply routing module.",
        buildCost: { metalScrap: 2, wood: 2 },
        placeholder: true,
    },
    bandwidth_router: {
        id: "bandwidth_router",
        displayName: "Bandwidth Router",
        category: "router",
        description: "Redirects BW to a target room when comms reach permits it.",
        buildCost: { metalScrap: 2, chaosShards: 1 },
        remoteTargetMinBw: 50,
    },
    signal_splitter: {
        id: "signal_splitter",
        displayName: "Signal Splitter",
        category: "router",
        description: "Copies one signal for multiple downstream consumers.",
        buildCost: { metalScrap: 1, steamComponents: 1 },
    },
    signal_relay: {
        id: "signal_relay",
        displayName: "Signal Relay",
        category: "router",
        description: "Relays a signal to another connected room if BW reach is high enough.",
        buildCost: { metalScrap: 1, chaosShards: 1 },
        remoteTargetMinBw: 100,
    },
    signal_merger: {
        id: "signal_merger",
        displayName: "Signal Merger",
        category: "router",
        description: "Prototype multi-branch signal merger.",
        buildCost: { metalScrap: 1, steamComponents: 1 },
        placeholder: true,
    },
    cross_branch_relay: {
        id: "cross_branch_relay",
        displayName: "Cross-Branch Relay",
        category: "router",
        description: "Prototype cross-branch signal handoff module.",
        buildCost: { metalScrap: 2, chaosShards: 1 },
        placeholder: true,
    },
};
export const FOUNDRY_PARTITION_DEFINITIONS = {
    blast_door: {
        id: "blast_door",
        displayName: "Blast Door",
        partitionType: "blast_door",
        buildCost: { metalScrap: 4, steamComponents: 1 },
        powerRequirement: 5,
    },
};
export function getOrderedFoundryModuleTypes() {
    return [...FOUNDRY_MODULE_UNLOCK_ORDER];
}
export function getOrderedFoundryPartitionTypes() {
    return [...FOUNDRY_PARTITION_UNLOCK_ORDER];
}
export function createDefaultFoundryState() {
    return {
        unlockedModuleTypes: [],
        unlockedPartitionTypes: [],
    };
}
export function normalizeFoundryUnlockState(foundry) {
    const moduleSet = new Set();
    (foundry?.unlockedModuleTypes ?? []).forEach((moduleType) => {
        if (FOUNDRY_MODULE_UNLOCK_ORDER.includes(moduleType)) {
            moduleSet.add(moduleType);
        }
    });
    const partitionSet = new Set();
    (foundry?.unlockedPartitionTypes ?? []).forEach((partitionType) => {
        if (FOUNDRY_PARTITION_UNLOCK_ORDER.includes(partitionType)) {
            partitionSet.add(partitionType);
        }
    });
    return {
        unlockedModuleTypes: FOUNDRY_MODULE_UNLOCK_ORDER.filter((moduleType) => moduleSet.has(moduleType)),
        unlockedPartitionTypes: FOUNDRY_PARTITION_UNLOCK_ORDER.filter((partitionType) => partitionSet.has(partitionType)),
    };
}
export function withNormalizedFoundryState(state) {
    const normalized = normalizeFoundryUnlockState(state.foundry);
    const current = state.foundry;
    if (current
        && current.unlockedModuleTypes.length === normalized.unlockedModuleTypes.length
        && current.unlockedPartitionTypes.length === normalized.unlockedPartitionTypes.length
        && current.unlockedModuleTypes.every((moduleType, index) => normalized.unlockedModuleTypes[index] === moduleType)
        && current.unlockedPartitionTypes.every((partitionType, index) => normalized.unlockedPartitionTypes[index] === partitionType)) {
        return state;
    }
    return {
        ...state,
        foundry: normalized,
    };
}
export function getFoundryUnlockState(state) {
    return normalizeFoundryUnlockState(state.foundry);
}
export function isModuleTypeUnlocked(state, moduleType) {
    return getFoundryUnlockState(state).unlockedModuleTypes.includes(moduleType);
}
export function isPartitionTypeUnlocked(state, partitionType) {
    return getFoundryUnlockState(state).unlockedPartitionTypes.includes(partitionType);
}
export function unlockFoundryModuleTypeInState(state, moduleType) {
    const normalizedState = withNormalizedFoundryState(state);
    const definition = FOUNDRY_MODULE_DEFINITIONS[moduleType];
    if (!definition) {
        return { state: normalizedState, success: false, message: "Unknown module authorization." };
    }
    if (isModuleTypeUnlocked(normalizedState, moduleType)) {
        return { state: normalizedState, success: false, message: `${definition.displayName} is already unlocked.` };
    }
    if (!hasEnoughResources(normalizedState.resources, definition.buildCost)) {
        return { state: normalizedState, success: false, message: `Insufficient resources to unlock ${definition.displayName}.` };
    }
    console.log("[FOUNDRY] module type unlocked", moduleType);
    return {
        success: true,
        message: `${definition.displayName} unlocked in the Foundry.`,
        state: {
            ...normalizedState,
            resources: subtractResources(normalizedState.resources, definition.buildCost),
            foundry: {
                ...getFoundryUnlockState(normalizedState),
                unlockedModuleTypes: [...getFoundryUnlockState(normalizedState).unlockedModuleTypes, moduleType],
            },
        },
    };
}
export function unlockFoundryPartitionTypeInState(state, partitionType) {
    const normalizedState = withNormalizedFoundryState(state);
    const definition = FOUNDRY_PARTITION_DEFINITIONS[partitionType];
    if (!definition) {
        return { state: normalizedState, success: false, message: "Unknown partition authorization." };
    }
    if (isPartitionTypeUnlocked(normalizedState, partitionType)) {
        return { state: normalizedState, success: false, message: `${definition.displayName} is already unlocked.` };
    }
    if (!hasEnoughResources(normalizedState.resources, definition.buildCost)) {
        return { state: normalizedState, success: false, message: `Insufficient resources to unlock ${definition.displayName}.` };
    }
    console.log("[FOUNDRY] partition type unlocked", partitionType);
    return {
        success: true,
        message: `${definition.displayName} unlocked in the Foundry.`,
        state: {
            ...normalizedState,
            resources: subtractResources(normalizedState.resources, definition.buildCost),
            foundry: {
                ...getFoundryUnlockState(normalizedState),
                unlockedPartitionTypes: [...getFoundryUnlockState(normalizedState).unlockedPartitionTypes, partitionType],
            },
        },
    };
}

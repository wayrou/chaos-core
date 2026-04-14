const EMPTY_SIGNAL = { kind: "empty", value: 0 };
const ANNEX_FRAME_LABELS = {
    lightweight_annex: "Light",
    standard_annex: "Standard",
    heavy_annex: "Heavy",
};
function cloneSignal(signal) {
    if (!signal) {
        return EMPTY_SIGNAL;
    }
    return { ...signal };
}
function cloneRuntime(runtime) {
    return {
        lastOutput: cloneSignal(runtime?.lastOutput),
        active: Boolean(runtime?.active),
        latched: Boolean(runtime?.latched),
        timerTicks: Math.max(0, Number(runtime?.timerTicks ?? 0)),
        storedAmount: Math.max(0, Number(runtime?.storedAmount ?? 0)),
        lastTriggeredTick: Number(runtime?.lastTriggeredTick ?? 0),
    };
}
export function createEmptyTheaterAutomationState() {
    return {
        moduleInstancesById: {},
        moduleRuntimeById: {},
        powerOverlayByRoomId: {},
        supplyOverlayByRoomId: {},
        commsOverlayByRoomId: {},
        activeSignalSnapshots: [],
    };
}
export function normalizeTheaterAutomationState(automation) {
    return {
        moduleInstancesById: Object.fromEntries(Object.entries(automation?.moduleInstancesById ?? {}).map(([instanceId, instance]) => [
            instanceId,
            {
                ...instance,
                configuration: { ...(instance.configuration ?? {}) },
                active: Boolean(instance.active),
            },
        ])),
        moduleRuntimeById: Object.fromEntries(Object.entries(automation?.moduleRuntimeById ?? {}).map(([instanceId, runtime]) => [
            instanceId,
            cloneRuntime(runtime),
        ])),
        powerOverlayByRoomId: { ...(automation?.powerOverlayByRoomId ?? {}) },
        supplyOverlayByRoomId: { ...(automation?.supplyOverlayByRoomId ?? {}) },
        commsOverlayByRoomId: { ...(automation?.commsOverlayByRoomId ?? {}) },
        activeSignalSnapshots: (automation?.activeSignalSnapshots ?? []).map((snapshot) => ({
            ...snapshot,
            output: cloneSignal(snapshot.output),
        })),
    };
}
export function normalizeTheaterAnnexes(annexes) {
    return Object.fromEntries(Object.entries(annexes ?? {}).map(([annexId, annex]) => [
        annexId,
        {
            ...annex,
            moduleSlotCapacity: Math.max(0, Number(annex.moduleSlotCapacity ?? 0)),
            moduleSlots: [...(annex.moduleSlots ?? Array.from({ length: Math.max(0, Number(annex.moduleSlotCapacity ?? 0)) }, () => null))],
            integrity: Math.max(0, Number(annex.integrity ?? 0)),
            inheritedControl: Boolean(annex.inheritedControl),
            inheritedSupply: Math.max(0, Number(annex.inheritedSupply ?? 0)),
            inheritedPower: Math.max(0, Number(annex.inheritedPower ?? 0)),
            inheritedComms: Math.max(0, Number(annex.inheritedComms ?? 0)),
            position: { ...annex.position },
            size: { ...annex.size },
        },
    ]));
}
export function normalizeTheaterPartitions(partitions) {
    return Object.fromEntries(Object.entries(partitions ?? {}).map(([edgeId, partition]) => [
        edgeId,
        {
            ...partition,
            automationHooks: partition.automationHooks ? {
                controllingModuleIds: [...(partition.automationHooks.controllingModuleIds ?? [])],
            } : undefined,
        },
    ]));
}
export function getTheaterEdgeId(nodeAId, nodeBId) {
    return [nodeAId, nodeBId].sort().join("__");
}
export function getTheaterSelectedNodeId(theater) {
    return theater.selectedNodeId ?? theater.selectedRoomId;
}
export function getTheaterCurrentNodeId(theater) {
    return theater.currentNodeId ?? theater.currentRoomId;
}
export function getAnnexChildIds(theater, parentNodeId) {
    return Object.values(theater.annexesById ?? {})
        .filter((annex) => annex.parentNodeId === parentNodeId)
        .map((annex) => annex.annexId);
}
export function getTheaterRootRoomIdForNode(theater, nodeId) {
    if (!nodeId) {
        return null;
    }
    if (theater.rooms[nodeId]) {
        return nodeId;
    }
    let cursor = theater.annexesById?.[nodeId] ?? null;
    const visited = new Set();
    while (cursor && !visited.has(cursor.annexId)) {
        visited.add(cursor.annexId);
        if (theater.rooms[cursor.parentNodeId]) {
            return cursor.parentNodeId;
        }
        cursor = theater.annexesById?.[cursor.parentNodeId] ?? null;
    }
    return theater.annexesById?.[nodeId]?.parentRoomId ?? null;
}
export function getTheaterRootRoomForNode(theater, nodeId) {
    const roomId = getTheaterRootRoomIdForNode(theater, nodeId);
    return roomId ? theater.rooms[roomId] ?? null : null;
}
export function resolveTheaterNode(theater, nodeId) {
    if (!nodeId) {
        return null;
    }
    const room = theater.rooms[nodeId];
    if (room) {
        return {
            id: room.id,
            kind: "room",
            label: room.label,
            position: { ...room.position },
            size: { ...room.size },
            room,
            annex: null,
            rootRoom: room,
        };
    }
    const annex = theater.annexesById?.[nodeId] ?? null;
    if (!annex) {
        return null;
    }
    return {
        id: annex.annexId,
        kind: "annex",
        label: `${ANNEX_FRAME_LABELS[annex.frameType]} Annex`,
        position: { ...annex.position },
        size: { ...annex.size },
        room: null,
        annex,
        rootRoom: getTheaterRootRoomForNode(theater, annex.annexId),
    };
}
export function isTheaterNodeVisible(theater, nodeId) {
    const resolved = resolveTheaterNode(theater, nodeId);
    if (!resolved) {
        return false;
    }
    if (resolved.kind === "room") {
        return resolved.room.intelLevel > 0 || resolved.room.secured;
    }
    return Boolean(resolved.rootRoom && (resolved.rootRoom.intelLevel > 0 || resolved.rootRoom.secured));
}
export function isTheaterNodeSecured(theater, nodeId) {
    const resolved = resolveTheaterNode(theater, nodeId);
    if (!resolved) {
        return false;
    }
    if (resolved.kind === "room") {
        return resolved.room?.secured ?? false;
    }
    return Boolean(resolved.annex?.inheritedControl);
}
export function getTheaterNodeAdjacency(theater, nodeId) {
    const room = theater.rooms[nodeId];
    if (room) {
        return [...room.adjacency, ...getAnnexChildIds(theater, nodeId)];
    }
    const annex = theater.annexesById?.[nodeId];
    if (!annex) {
        return [];
    }
    return [annex.parentNodeId, ...getAnnexChildIds(theater, annex.annexId)];
}
export function isBlastDoorClosed(theater, nodeAId, nodeBId) {
    return theater.partitionsByEdgeId?.[getTheaterEdgeId(nodeAId, nodeBId)]?.state === "closed";
}
function isRoomToRoomEdgePowered(theater, nodeAId, nodeBId) {
    const roomA = theater.rooms[nodeAId];
    const roomB = theater.rooms[nodeBId];
    if (!roomA || !roomB) {
        return true;
    }
    const requirement = Math.max(Math.max(0, roomA.powerGateWatts?.[roomB.id] ?? 0), Math.max(0, roomB.powerGateWatts?.[roomA.id] ?? 0));
    if (requirement <= 0) {
        return true;
    }
    return Math.max(roomA.powerFlow ?? 0, roomB.powerFlow ?? 0) >= requirement;
}
export function canTraverseTheaterEdge(theater, fromNodeId, toNodeId) {
    if (!getTheaterNodeAdjacency(theater, fromNodeId).includes(toNodeId)) {
        return false;
    }
    if (isBlastDoorClosed(theater, fromNodeId, toNodeId)) {
        return false;
    }
    return isRoomToRoomEdgePowered(theater, fromNodeId, toNodeId);
}
export function getTheaterNodeMoveTickCost(theater, nodeId) {
    const room = theater.rooms[nodeId];
    if (!room) {
        return 1;
    }
    return room.secured ? 1 : 2;
}
export function findTheaterNodeRoute(theater, fromNodeId, toNodeId, options) {
    if (fromNodeId === toNodeId) {
        return [fromNodeId];
    }
    const destination = resolveTheaterNode(theater, toNodeId);
    if (!destination) {
        return null;
    }
    if (!options?.allowUnknownDestination && !isTheaterNodeVisible(theater, toNodeId)) {
        return null;
    }
    const bestCost = new Map([[fromNodeId, 0]]);
    const previous = new Map([[fromNodeId, null]]);
    const queue = [{ nodeId: fromNodeId, cost: 0 }];
    while (queue.length > 0) {
        queue.sort((left, right) => left.cost - right.cost);
        const current = queue.shift();
        if (current.cost > (bestCost.get(current.nodeId) ?? Number.POSITIVE_INFINITY)) {
            continue;
        }
        if (current.nodeId === toNodeId) {
            break;
        }
        getTheaterNodeAdjacency(theater, current.nodeId).forEach((adjacentId) => {
            if (!options?.ignoreClosedPartitions && !canTraverseTheaterEdge(theater, current.nodeId, adjacentId)) {
                return;
            }
            if (adjacentId !== toNodeId && !isTheaterNodeSecured(theater, adjacentId)) {
                return;
            }
            if (adjacentId !== toNodeId && !isTheaterNodeVisible(theater, adjacentId)) {
                return;
            }
            if (adjacentId === toNodeId
                && !options?.allowUnsecuredDestination
                && !isTheaterNodeSecured(theater, adjacentId)
                && resolveTheaterNode(theater, adjacentId)?.kind !== "room") {
                return;
            }
            const nextCost = current.cost + getTheaterNodeMoveTickCost(theater, adjacentId);
            if (nextCost >= (bestCost.get(adjacentId) ?? Number.POSITIVE_INFINITY)) {
                return;
            }
            bestCost.set(adjacentId, nextCost);
            previous.set(adjacentId, current.nodeId);
            queue.push({ nodeId: adjacentId, cost: nextCost });
        });
    }
    if (!previous.has(toNodeId)) {
        return null;
    }
    const path = [];
    let cursor = toNodeId;
    while (cursor) {
        path.push(cursor);
        cursor = previous.get(cursor) ?? null;
    }
    return path.reverse();
}
function findRootRoomRoute(theater, fromRoomId, toRoomId) {
    if (fromRoomId === toRoomId) {
        return [fromRoomId];
    }
    const queue = [fromRoomId];
    const previous = new Map([[fromRoomId, null]]);
    while (queue.length > 0) {
        const currentRoomId = queue.shift();
        const room = theater.rooms[currentRoomId];
        if (!room) {
            continue;
        }
        for (const adjacentId of room.adjacency) {
            if (previous.has(adjacentId) || !theater.rooms[adjacentId]) {
                continue;
            }
            previous.set(adjacentId, currentRoomId);
            if (adjacentId === toRoomId) {
                queue.length = 0;
                break;
            }
            queue.push(adjacentId);
        }
    }
    if (!previous.has(toRoomId)) {
        return null;
    }
    const path = [];
    let cursor = toRoomId;
    while (cursor) {
        path.push(cursor);
        cursor = previous.get(cursor) ?? null;
    }
    return path.reverse();
}
export function canAutomationReachTarget(theater, sourceNodeId, targetNodeId, requiredBw) {
    const sourceRoot = getTheaterRootRoomForNode(theater, sourceNodeId);
    const targetRoot = getTheaterRootRoomForNode(theater, targetNodeId);
    if (!sourceRoot || !targetRoot) {
        return false;
    }
    if (sourceRoot.id === targetRoot.id) {
        return true;
    }
    if (!sourceRoot.commsLinked || !targetRoot.secured || !targetRoot.commsVisible) {
        return false;
    }
    if ((sourceRoot.commsFlow ?? 0) < requiredBw) {
        return false;
    }
    return Boolean(findRootRoomRoute(theater, sourceRoot.id, targetRoot.id));
}
export function applyAnnexInheritedNetwork(theater) {
    const annexes = theater.annexesById ?? {};
    Object.values(annexes).forEach((annex) => {
        const rootRoom = getTheaterRootRoomForNode(theater, annex.annexId);
        annex.inheritedControl = Boolean(rootRoom?.secured);
        annex.inheritedSupply = Math.max(0, Number(rootRoom?.supplyFlow ?? 0));
        annex.inheritedPower = Math.max(0, Number(rootRoom?.powerFlow ?? 0));
        annex.inheritedComms = Math.max(0, Number(rootRoom?.commsFlow ?? 0));
    });
    return theater;
}
function getSignalNumber(signal) {
    if (!signal) {
        return 0;
    }
    return signal.kind === "number" ? signal.value : 0;
}
function getSignalBoolean(signal) {
    if (!signal) {
        return false;
    }
    if (signal.kind === "boolean") {
        return Boolean(signal.value);
    }
    if (signal.kind === "number") {
        return Number(signal.value) > 0;
    }
    return false;
}
function asBooleanSignal(value) {
    return { kind: "boolean", value };
}
function asNumberSignal(value) {
    return { kind: "number", value: Number.isFinite(value) ? value : 0 };
}
function addRoomOverlay(theater, roomId, type, amount) {
    const automation = theater.automation;
    if (type === "power") {
        automation.powerOverlayByRoomId[roomId] = (automation.powerOverlayByRoomId[roomId] ?? 0) + amount;
    }
    else if (type === "supply") {
        automation.supplyOverlayByRoomId[roomId] = (automation.supplyOverlayByRoomId[roomId] ?? 0) + amount;
    }
    else {
        automation.commsOverlayByRoomId[roomId] = (automation.commsOverlayByRoomId[roomId] ?? 0) + amount;
    }
}
function getRoomEffectiveValue(theater, roomId, type) {
    const room = theater.rooms[roomId];
    if (!room) {
        return 0;
    }
    const automation = theater.automation;
    if (type === "power") {
        return Math.max(0, room.powerFlow + (automation.powerOverlayByRoomId[roomId] ?? 0));
    }
    if (type === "supply") {
        return Math.max(0, room.supplyFlow + (automation.supplyOverlayByRoomId[roomId] ?? 0));
    }
    return Math.max(0, room.commsFlow + (automation.commsOverlayByRoomId[roomId] ?? 0));
}
function getModuleRuntime(theater, moduleId) {
    const automation = theater.automation;
    const existing = automation.moduleRuntimeById[moduleId];
    const runtime = cloneRuntime(existing);
    automation.moduleRuntimeById[moduleId] = runtime;
    return runtime;
}
function readModuleInputs(theater, moduleId) {
    const module = theater.automation.moduleInstancesById[moduleId];
    const inputIds = module?.configuration.inputModuleIds ?? [];
    return inputIds.map((inputId) => theater.automation.moduleRuntimeById[inputId]?.lastOutput ?? EMPTY_SIGNAL);
}
function spendStoredAmount(theater, hostNodeId, amount, preferredModuleTypes) {
    const modules = Object.values(theater.automation.moduleInstancesById).filter((module) => module.installedNodeId === hostNodeId && preferredModuleTypes.includes(module.moduleType));
    for (const module of modules) {
        const runtime = getModuleRuntime(theater, module.instanceId);
        if (runtime.storedAmount <= 0) {
            continue;
        }
        const released = Math.min(runtime.storedAmount, amount);
        runtime.storedAmount -= released;
        return { released, moduleId: module.instanceId };
    }
    return { released: 0, moduleId: null };
}
function buildSignalSnapshot(moduleId, label, output, active) {
    return {
        moduleId,
        label,
        output: cloneSignal(output),
        active,
    };
}
function applyRoomFlowOverlays(theater) {
    const automation = theater.automation;
    Object.values(theater.rooms).forEach((room) => {
        room.powerFlow = Math.max(0, room.powerFlow + (automation.powerOverlayByRoomId[room.id] ?? 0));
        room.supplyFlow = Math.max(0, room.supplyFlow + (automation.supplyOverlayByRoomId[room.id] ?? 0));
        room.commsFlow = Math.max(0, room.commsFlow + (automation.commsOverlayByRoomId[room.id] ?? 0));
        room.powered = room.powerFlow > 0;
        room.supplied = room.supplyFlow > 0;
        room.commsLinked = room.commsFlow > 0;
        room.connected = room.supplied || room.powered || room.commsLinked || room.secured;
    });
    return applyAnnexInheritedNetwork(theater);
}
export function getAutomatedTurretCountForRoom(theater, roomId) {
    const automation = normalizeTheaterAutomationState(theater.automation);
    return Object.values(automation.moduleInstancesById).filter((module) => {
        if (module.moduleType !== "turret_controller") {
            return false;
        }
        const runtime = automation.moduleRuntimeById[module.instanceId];
        return getTheaterRootRoomIdForNode(theater, module.installedNodeId) === roomId && Boolean(runtime?.active);
    }).length;
}
export function evaluateTheaterAutomation(theater) {
    theater.automation = normalizeTheaterAutomationState(theater.automation);
    theater.automation.activeSignalSnapshots = [];
    theater.automation.powerOverlayByRoomId = {};
    theater.automation.supplyOverlayByRoomId = {};
    theater.automation.commsOverlayByRoomId = {};
    applyAnnexInheritedNetwork(theater);
    const modules = Object.values(theater.automation.moduleInstancesById);
    const sensors = modules.filter((module) => module.category === "sensor");
    const storage = modules.filter((module) => module.category === "buffer" || module.category === "storage");
    const logic = modules.filter((module) => module.category === "logic" || module.moduleType === "signal_splitter" || module.moduleType === "signal_relay");
    const stabilizers = modules.filter((module) => module.category === "stabilizer");
    const actuators = modules.filter((module) => module.category === "router" || module.category === "actuator");
    const evaluateBatch = (batch) => {
        batch.forEach((module) => {
            const runtime = getModuleRuntime(theater, module.instanceId);
            const rootRoom = getTheaterRootRoomForNode(theater, module.installedNodeId);
            const inputs = readModuleInputs(theater, module.instanceId);
            let output = cloneSignal(runtime.lastOutput);
            let active = runtime.active;
            switch (module.moduleType) {
                case "threat_sensor": {
                    const monitoredNodeId = module.configuration.monitorTarget?.nodeId ?? module.installedNodeId;
                    const monitoredRoot = getTheaterRootRoomForNode(theater, monitoredNodeId);
                    const threatScore = (monitoredRoot?.underThreat ? 1 : 0)
                        + (monitoredRoot?.damaged ? 1 : 0)
                        + theater.activeThreats.filter((threat) => threat.active && threat.currentRoomId === monitoredRoot?.id).length;
                    output = asNumberSignal(threatScore);
                    active = threatScore > 0;
                    if (active)
                        console.log("[AUTOMATION] sensor fired", module.moduleType, module.instanceId, threatScore);
                    break;
                }
                case "power_sensor": {
                    const monitoredNodeId = module.configuration.monitorTarget?.nodeId ?? module.installedNodeId;
                    const monitoredRootId = getTheaterRootRoomIdForNode(theater, monitoredNodeId);
                    const power = monitoredRootId ? getRoomEffectiveValue(theater, monitoredRootId, "power") : 0;
                    output = asNumberSignal(power);
                    active = power > 0;
                    if (active)
                        console.log("[AUTOMATION] sensor fired", module.moduleType, module.instanceId, power);
                    break;
                }
                case "bandwidth_sensor": {
                    const monitoredNodeId = module.configuration.monitorTarget?.nodeId ?? module.installedNodeId;
                    const monitoredRootId = getTheaterRootRoomIdForNode(theater, monitoredNodeId);
                    const bw = monitoredRootId ? getRoomEffectiveValue(theater, monitoredRootId, "comms") : 0;
                    output = asNumberSignal(bw);
                    active = bw > 0;
                    if (active)
                        console.log("[AUTOMATION] sensor fired", module.moduleType, module.instanceId, bw);
                    break;
                }
                case "threshold_switch": {
                    const inputValue = getSignalNumber(inputs[0]);
                    const threshold = Number(module.configuration.threshold ?? 1);
                    const comparison = module.configuration.comparison ?? ">=";
                    active = comparison === "<=" ? inputValue <= threshold : inputValue >= threshold;
                    output = asBooleanSignal(active);
                    if (active)
                        console.log("[AUTOMATION] logic resolved true", module.moduleType, module.instanceId, inputValue, comparison, threshold);
                    break;
                }
                case "delay_timer": {
                    const inputActive = getSignalBoolean(inputs[0]);
                    const requiredTicks = Math.max(1, Number(module.configuration.delayTicks ?? 1));
                    runtime.timerTicks = inputActive ? runtime.timerTicks + 1 : 0;
                    active = inputActive && runtime.timerTicks >= requiredTicks;
                    output = asBooleanSignal(active);
                    if (active)
                        console.log("[AUTOMATION] logic resolved true", module.moduleType, module.instanceId, runtime.timerTicks);
                    break;
                }
                case "and_gate": {
                    active = inputs.length > 0 && inputs.every((signal) => getSignalBoolean(signal));
                    output = asBooleanSignal(active);
                    if (active)
                        console.log("[AUTOMATION] logic resolved true", module.moduleType, module.instanceId);
                    break;
                }
                case "or_gate": {
                    active = inputs.some((signal) => getSignalBoolean(signal));
                    output = asBooleanSignal(active);
                    if (active)
                        console.log("[AUTOMATION] logic resolved true", module.moduleType, module.instanceId);
                    break;
                }
                case "signal_splitter": {
                    active = getSignalBoolean(inputs[0]);
                    output = inputs[0] ?? EMPTY_SIGNAL;
                    break;
                }
                case "signal_relay": {
                    const targetNodeId = module.configuration.target?.nodeId;
                    const reachable = targetNodeId ? canAutomationReachTarget(theater, module.installedNodeId, targetNodeId, 100) : false;
                    if (!reachable && targetNodeId) {
                        console.log("[AUTOMATION] remote target rejected due to low comms", module.instanceId, targetNodeId);
                    }
                    active = reachable && getSignalBoolean(inputs[0]);
                    output = active ? (inputs[0] ?? asBooleanSignal(true)) : EMPTY_SIGNAL;
                    break;
                }
                case "capacitor":
                case "supply_cache":
                case "bandwidth_buffer": {
                    const hostRoomId = rootRoom?.id;
                    const type = module.moduleType === "capacitor" ? "power" : module.moduleType === "supply_cache" ? "supply" : "comms";
                    const floor = type === "power" ? 50 : 25;
                    const surplus = hostRoomId ? Math.max(0, getRoomEffectiveValue(theater, hostRoomId, type) - floor) : 0;
                    runtime.storedAmount = Math.min(100, runtime.storedAmount + Math.min(10, surplus));
                    active = runtime.storedAmount > 0;
                    output = asNumberSignal(runtime.storedAmount);
                    break;
                }
                case "latch": {
                    if (getSignalBoolean(inputs[0])) {
                        runtime.latched = true;
                    }
                    active = runtime.latched;
                    output = asBooleanSignal(active);
                    break;
                }
                case "delay_buffer": {
                    const desired = getSignalBoolean(inputs[0]);
                    const delay = Math.max(1, Number(module.configuration.delayTicks ?? 1));
                    if (desired !== runtime.active) {
                        runtime.timerTicks += 1;
                        if (runtime.timerTicks >= delay) {
                            runtime.active = desired;
                            runtime.timerTicks = 0;
                        }
                    }
                    else {
                        runtime.timerTicks = 0;
                    }
                    active = runtime.active;
                    output = asBooleanSignal(active);
                    break;
                }
                case "accumulator": {
                    runtime.storedAmount = Math.min(999, runtime.storedAmount + getSignalNumber(inputs[0]));
                    active = runtime.storedAmount > 0;
                    output = asNumberSignal(runtime.storedAmount);
                    break;
                }
                case "power_stabilizer":
                case "comms_stabilizer": {
                    const hostRoomId = rootRoom?.id;
                    const type = module.moduleType === "power_stabilizer" ? "power" : "comms";
                    const floorAmount = Math.max(0, Number(module.configuration.floorAmount ?? (type === "power" ? 50 : 25)));
                    const currentValue = hostRoomId ? getRoomEffectiveValue(theater, hostRoomId, type) : 0;
                    const needed = Math.max(0, floorAmount - currentValue);
                    const preferred = type === "power" ? ["capacitor"] : ["bandwidth_buffer"];
                    const { released } = needed > 0 ? spendStoredAmount(theater, module.installedNodeId, needed, preferred) : { released: 0 };
                    if (hostRoomId && released > 0) {
                        addRoomOverlay(theater, hostRoomId, type, released);
                        active = true;
                        console.log("[AUTOMATION] actuator executed", module.moduleType, module.instanceId, hostRoomId, released);
                    }
                    else {
                        active = false;
                    }
                    output = asBooleanSignal(active);
                    break;
                }
                case "power_router":
                case "bandwidth_router": {
                    const targetNodeId = module.configuration.target?.nodeId;
                    const hostRoomId = rootRoom?.id;
                    const targetRoomId = getTheaterRootRoomIdForNode(theater, targetNodeId ?? null);
                    const amount = Math.max(1, Number(module.configuration.transferAmount ?? 20));
                    const shouldFire = inputs.length === 0 || getSignalBoolean(inputs[0]);
                    const type = module.moduleType === "power_router" ? "power" : "comms";
                    const requiredBw = targetNodeId && hostRoomId && targetRoomId && hostRoomId !== targetRoomId ? 50 : 0;
                    const reachable = !targetNodeId || canAutomationReachTarget(theater, module.installedNodeId, targetNodeId, requiredBw);
                    if (!reachable && targetNodeId) {
                        console.log("[AUTOMATION] remote target rejected due to low comms", module.instanceId, targetNodeId);
                    }
                    if (hostRoomId && targetRoomId && shouldFire && reachable) {
                        const available = getRoomEffectiveValue(theater, hostRoomId, type);
                        const transferred = Math.min(amount, available);
                        addRoomOverlay(theater, hostRoomId, type, -transferred);
                        addRoomOverlay(theater, targetRoomId, type, transferred);
                        active = transferred > 0;
                        if (active)
                            console.log("[AUTOMATION] actuator executed", module.moduleType, module.instanceId, `${hostRoomId}->${targetRoomId}`, transferred);
                    }
                    else {
                        active = false;
                    }
                    output = asBooleanSignal(active);
                    break;
                }
                case "cache_release": {
                    const targetNodeId = module.configuration.target?.nodeId ?? module.installedNodeId;
                    const targetRoomId = getTheaterRootRoomIdForNode(theater, targetNodeId);
                    const shouldFire = inputs.length === 0 || getSignalBoolean(inputs[0]);
                    let released = 0;
                    if (shouldFire && targetRoomId) {
                        released = spendStoredAmount(theater, module.installedNodeId, Number(module.configuration.transferAmount ?? 25), ["capacitor"]).released;
                        if (released > 0) {
                            addRoomOverlay(theater, targetRoomId, "power", released);
                        }
                        else {
                            released = spendStoredAmount(theater, module.installedNodeId, Number(module.configuration.transferAmount ?? 25), ["supply_cache"]).released;
                            if (released > 0) {
                                addRoomOverlay(theater, targetRoomId, "supply", released);
                            }
                            else {
                                released = spendStoredAmount(theater, module.installedNodeId, Number(module.configuration.transferAmount ?? 25), ["bandwidth_buffer"]).released;
                                if (released > 0) {
                                    addRoomOverlay(theater, targetRoomId, "comms", released);
                                }
                            }
                        }
                    }
                    active = released > 0;
                    if (active)
                        console.log("[AUTOMATION] actuator executed", module.moduleType, module.instanceId, targetRoomId, released);
                    output = asBooleanSignal(active);
                    break;
                }
                case "door_controller": {
                    const targetEdgeId = module.configuration.target?.edgeId;
                    const desiredDoorState = module.configuration.desiredDoorState ?? "closed";
                    const shouldFire = inputs.length === 0 || getSignalBoolean(inputs[0]);
                    const targetNodeId = targetEdgeId?.split("__")[0] ?? null;
                    const reachable = targetNodeId ? canAutomationReachTarget(theater, module.installedNodeId, targetNodeId, 100) : true;
                    if (!reachable && targetEdgeId) {
                        console.log("[AUTOMATION] remote target rejected due to low comms", module.instanceId, targetEdgeId);
                    }
                    if (targetEdgeId && theater.partitionsByEdgeId?.[targetEdgeId] && reachable) {
                        const partition = theater.partitionsByEdgeId[targetEdgeId];
                        const nextState = shouldFire ? desiredDoorState : (desiredDoorState === "closed" ? "open" : "closed");
                        if (partition.state !== nextState) {
                            partition.state = nextState;
                            console.log("[AUTOMATION] actuator executed", module.moduleType, module.instanceId, targetEdgeId, nextState);
                            console.log("[THEATER] blast door state changed", targetEdgeId, nextState);
                        }
                        active = shouldFire;
                    }
                    else {
                        active = false;
                    }
                    output = asBooleanSignal(active);
                    break;
                }
                case "turret_controller": {
                    const hostRoomId = rootRoom?.id;
                    const shouldFire = inputs.length === 0 || getSignalBoolean(inputs[0]);
                    if (hostRoomId && shouldFire && (theater.rooms[hostRoomId]?.fortificationPips.turret ?? 0) > 0) {
                        theater.activeThreats = theater.activeThreats.map((threat) => (threat.active && threat.currentRoomId === hostRoomId
                            ? { ...threat, strength: Math.max(0, threat.strength - 1), active: Math.max(0, threat.strength - 1) > 0 }
                            : threat));
                        active = true;
                        console.log("[AUTOMATION] actuator executed", module.moduleType, module.instanceId, hostRoomId);
                    }
                    else {
                        active = false;
                    }
                    output = asBooleanSignal(active);
                    break;
                }
                default:
                    break;
            }
            runtime.lastOutput = cloneSignal(output);
            runtime.active = active;
            if (active) {
                runtime.lastTriggeredTick = theater.tickCount;
            }
            theater.automation.activeSignalSnapshots.push(buildSignalSnapshot(module.instanceId, module.moduleType, runtime.lastOutput, runtime.active));
        });
    };
    evaluateBatch(sensors);
    evaluateBatch(storage);
    evaluateBatch(logic);
    evaluateBatch(stabilizers);
    evaluateBatch(actuators);
    return applyRoomFlowOverlays(theater);
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImportedOperationZoneName = getImportedOperationZoneName;
exports.getImportedOperationBriefing = getImportedOperationBriefing;
exports.buildImportedOperationTheaterFloor = buildImportedOperationTheaterFloor;
exports.buildImportedOperationTheaterFloors = buildImportedOperationTheaterFloors;
exports.buildImportedOperationRuntime = buildImportedOperationRuntime;
const atlasSystem_1 = require("./atlasSystem");
const schemaSystem_1 = require("./schemaSystem");
const theaterAutomation_1 = require("./theaterAutomation");
const MAP_WIDTH = 4400;
const MAP_HEIGHT = 3200;
const MAP_CENTER_X = Math.round(MAP_WIDTH / 2);
const MAP_CENTER_Y = Math.round(MAP_HEIGHT / 2);
const EDGE_MARGIN_X = 620;
const EDGE_MARGIN_Y = 420;
const DEFAULT_MAP_ANCHOR = { x: EDGE_MARGIN_X, y: MAP_CENTER_Y };
const THEATER_DEPTH_STEP = 430;
const THEATER_LATERAL_STEP = 360;
const DIRECTION_ANGLE_MAP = {
    east: 0,
    southeast: 45,
    south: 90,
    southwest: 135,
    west: 180,
    northwest: 225,
    north: 270,
    northeast: 315,
};
const KNOWN_ROOM_ROLES = new Set([
    "ingress",
    "frontline",
    "relay",
    "field",
    "resource_pocket",
    "core",
    "power",
    "elite",
    "objective",
]);
const KNOWN_LAYOUT_STYLES = new Set([
    "vector_lance",
    "split_fan",
    "central_bloom",
    "offset_arc",
]);
const KNOWN_CLEAR_MODES = new Set(["battle", "field", "empty"]);
const KNOWN_ROOM_CLASSES = new Set(["standard", "mega"]);
const KNOWN_KEY_TYPES = new Set(["triangle", "square", "circle", "spade", "star"]);
const KNOWN_SPRAWL_DIRECTIONS = new Set([
    "north",
    "northeast",
    "east",
    "southeast",
    "south",
    "southwest",
    "west",
    "northwest",
]);
function clampFloorIndex(operation, floorIndex) {
    const maxFloorIndex = Math.max(0, operation.floors.length - 1);
    return Math.max(0, Math.min(maxFloorIndex, floorIndex ?? 0));
}
function normalizeAngle(angleDeg) {
    const normalized = angleDeg % 360;
    return normalized < 0 ? normalized + 360 : normalized;
}
function createRadialDirection(angleDeg) {
    const radians = (angleDeg * Math.PI) / 180;
    return {
        x: Number(Math.cos(radians).toFixed(4)),
        y: Number(Math.sin(radians).toFixed(4)),
    };
}
function createDirectionalAnchor(direction, layoutStyle, floorIndex) {
    if (layoutStyle === "central_bloom") {
        return {
            x: MAP_CENTER_X + (floorIndex % 2 === 0 ? 0 : 140),
            y: MAP_CENTER_Y + (floorIndex % 3 === 0 ? 0 : -120),
        };
    }
    const offsetX = Math.round(MAP_WIDTH * 0.29);
    const offsetY = Math.round(MAP_HEIGHT * 0.24);
    if (layoutStyle === "offset_arc") {
        return {
            east: { x: offsetX, y: MAP_CENTER_Y - 260 },
            southeast: { x: offsetX + 140, y: offsetY + 80 },
            south: { x: MAP_CENTER_X, y: offsetY },
            southwest: { x: MAP_WIDTH - offsetX - 140, y: offsetY + 80 },
            west: { x: MAP_WIDTH - offsetX, y: MAP_CENTER_Y + 260 },
            northwest: { x: MAP_WIDTH - offsetX - 140, y: MAP_HEIGHT - offsetY - 80 },
            north: { x: MAP_CENTER_X, y: MAP_HEIGHT - offsetY },
            northeast: { x: offsetX + 140, y: MAP_HEIGHT - offsetY - 80 },
        }[direction];
    }
    return {
        east: { x: EDGE_MARGIN_X, y: MAP_CENTER_Y },
        southeast: { x: EDGE_MARGIN_X + 180, y: EDGE_MARGIN_Y + 140 },
        south: { x: MAP_CENTER_X, y: EDGE_MARGIN_Y },
        southwest: { x: MAP_WIDTH - EDGE_MARGIN_X - 180, y: EDGE_MARGIN_Y + 140 },
        west: { x: MAP_WIDTH - EDGE_MARGIN_X, y: MAP_CENTER_Y },
        northwest: { x: MAP_WIDTH - EDGE_MARGIN_X - 180, y: MAP_HEIGHT - EDGE_MARGIN_Y - 140 },
        north: { x: MAP_CENTER_X, y: MAP_HEIGHT - EDGE_MARGIN_Y },
        northeast: { x: EDGE_MARGIN_X + 180, y: MAP_HEIGHT - EDGE_MARGIN_Y - 140 },
    }[direction];
}
function projectTheaterPosition(angleDeg, localPosition, mapAnchor) {
    const radians = (angleDeg * Math.PI) / 180;
    const forward = { x: Math.cos(radians), y: Math.sin(radians) };
    const lateral = { x: -forward.y, y: forward.x };
    const anchor = mapAnchor ?? DEFAULT_MAP_ANCHOR;
    return {
        x: Math.round(anchor.x
            + (localPosition.x * THEATER_DEPTH_STEP * forward.x)
            + (localPosition.y * THEATER_LATERAL_STEP * lateral.x)),
        y: Math.round(anchor.y
            + (localPosition.x * THEATER_DEPTH_STEP * forward.y)
            + (localPosition.y * THEATER_LATERAL_STEP * lateral.y)),
    };
}
function dedupeIds(values) {
    return Array.from(new Set(values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)));
}
function inferRoomRole(room) {
    const explicitRole = typeof room.role === "string" ? room.role : "";
    if (KNOWN_ROOM_ROLES.has(explicitRole)) {
        return explicitRole;
    }
    const tags = dedupeIds(room.tags ?? []);
    if (tags.includes("ingress") || tags.includes("uplink")) {
        return "ingress";
    }
    if (tags.includes("objective")) {
        return "objective";
    }
    if (tags.includes("power_source") || room.isPowerSource === true) {
        return "power";
    }
    if (tags.includes("resource_pocket")) {
        return "resource_pocket";
    }
    if (tags.includes("command_suitable")) {
        return "core";
    }
    if (tags.includes("junction") || tags.includes("relay")) {
        return "relay";
    }
    if (tags.includes("elite")) {
        return "elite";
    }
    switch (room.type) {
        case "rest":
        case "tavern":
            return "ingress";
        case "boss":
            return "objective";
        case "elite":
            return "elite";
        case "event":
            return "relay";
        case "field_node":
            return "field";
        case "treasure":
            return "resource_pocket";
        default:
            return "frontline";
    }
}
function normalizeLayoutStyle(value, fallback) {
    return KNOWN_LAYOUT_STYLES.has(value)
        ? value
        : fallback;
}
function normalizeClearMode(value, fallback) {
    return KNOWN_CLEAR_MODES.has(value)
        ? value
        : fallback;
}
function normalizeRoomClass(value, fallback) {
    return KNOWN_ROOM_CLASSES.has(value) ? value : fallback;
}
function normalizeKeyType(value) {
    return KNOWN_KEY_TYPES.has(value) ? value : null;
}
function normalizeSprawlDirection(value) {
    return KNOWN_SPRAWL_DIRECTIONS.has(value)
        ? value
        : undefined;
}
function getDefaultRoomTags(role) {
    switch (role) {
        case "ingress":
            return ["ingress", "uplink"];
        case "frontline":
            return ["frontier"];
        case "relay":
            return ["junction", "relay"];
        case "field":
            return ["core_candidate", "metal_rich", "timber_rich", "salvage_rich"];
        case "resource_pocket":
            return ["core_candidate", "resource_pocket", "salvage_rich"];
        case "core":
            return ["core_candidate", "command_suitable"];
        case "power":
            return ["power_source", "steam_vent"];
        case "elite":
            return ["elite", "frontier"];
        case "objective":
            return ["objective", "elite", "survey_highground"];
        default:
            return [];
    }
}
function getDefaultClearMode(role) {
    switch (role) {
        case "ingress":
        case "power":
            return "empty";
        case "field":
        case "resource_pocket":
            return "field";
        default:
            return "battle";
    }
}
function getDefaultCoreSlotCapacity(role, roomClass) {
    if (roomClass === "mega") {
        return 2;
    }
    switch (role) {
        case "ingress":
        case "relay":
        case "field":
        case "resource_pocket":
        case "core":
        case "objective":
            return 1;
        default:
            return 0;
    }
}
function getDefaultFortificationCapacity(role) {
    switch (role) {
        case "ingress":
        case "objective":
            return 4;
        default:
            return 3;
    }
}
function getDefaultPowerSource(role) {
    return role === "ingress" || role === "power";
}
function getDefaultRoomSize(role, roomClass) {
    if (roomClass === "mega") {
        return { width: 520, height: 292 };
    }
    switch (role) {
        case "ingress":
            return { width: 230, height: 138 };
        case "field":
        case "resource_pocket":
            return { width: 360, height: 214 };
        case "objective":
            return { width: 320, height: 180 };
        default:
            return { width: 250, height: 150 };
    }
}
function createSectorTag(depth, lateral) {
    const row = String.fromCharCode(65 + Math.max(0, Math.min(25, Math.floor(depth))));
    const lane = Math.round(lateral);
    return `${row}${lane >= 0 ? lane : `${lane}`}`;
}
function resolveRoomConnections(room) {
    return dedupeIds([...(room.connections ?? []), ...(room.adjacency ?? [])]);
}
function resolveLocalPosition(room, index) {
    if (room.localPosition) {
        return {
            x: Number(room.localPosition.x ?? 0),
            y: Number(room.localPosition.y ?? 0),
        };
    }
    if (room.position) {
        return {
            x: Number(room.position.x ?? 0),
            y: Number(room.position.y ?? 0),
        };
    }
    return { x: index, y: 0 };
}
function resolveCurrentState(summaryState) {
    if (summaryState === "cold" || summaryState === "warm") {
        return summaryState;
    }
    return "active";
}
function getImportedOperationZoneName(operation) {
    return operation.zoneName?.trim() || operation.floors[0]?.name?.trim() || operation.codename;
}
function getImportedOperationBriefing(operation) {
    const zoneName = getImportedOperationZoneName(operation);
    return {
        objective: operation.objective?.trim() || operation.description,
        beginningState: operation.beginningState?.trim()
            || `${zoneName} synchronized. The ingress route is mapped and ready for deployment.`,
        endState: operation.endState?.trim()
            || `${zoneName} stabilized. Objective secured and theater control extended outward.`,
        recommendedPWR: operation.recommendedPower,
        zoneName,
        sprawlDirection: normalizeSprawlDirection(operation.sprawlDirection),
    };
}
function buildImportedOperationFloor(floor) {
    return {
        id: floor.id,
        name: floor.name,
        startingNodeId: floor.startingRoomId || floor.rooms[0]?.id,
        nodes: floor.rooms.map((room) => ({
            id: room.id,
            label: room.label,
            type: room.type,
            position: room.position ?? room.localPosition ?? { x: 0, y: 0 },
            connections: resolveRoomConnections(room),
            battleTemplate: room.battleTemplate,
            eventTemplate: room.eventTemplate,
            shopInventory: [...(room.shopInventory ?? [])],
        })),
        rooms: floor.rooms.map((room) => ({
            id: room.id,
            label: room.label,
            type: room.type,
            position: room.position ?? room.localPosition ?? { x: 0, y: 0 },
            connections: resolveRoomConnections(room),
            battleTemplate: room.battleTemplate,
            eventTemplate: room.eventTemplate,
            shopInventory: [...(room.shopInventory ?? [])],
        })),
    };
}
function buildImportedOperationTheaterFloor(operation, floorIndex, options = {}) {
    const floor = operation.floors[floorIndex];
    if (!floor) {
        throw new Error(`Imported operation '${operation.id}' does not have floor ${floorIndex + 1}.`);
    }
    const briefing = getImportedOperationBriefing(operation);
    const atlasSummary = floorIndex === 0 ? (0, atlasSystem_1.getAtlasTheaterByOperationId)(operation.id) : null;
    const preferredDirection = briefing.sprawlDirection ?? "east";
    const layoutStyle = normalizeLayoutStyle(floor.layoutStyle, "vector_lance");
    const angleDeg = normalizeAngle(atlasSummary?.angleDeg ?? DIRECTION_ANGLE_MAP[preferredDirection]);
    const mapAnchor = createDirectionalAnchor(preferredDirection, layoutStyle, floorIndex);
    const floorOrdinal = operation.floors.length <= 1
        ? Math.max(1, floor.floorOrdinal ?? atlasSummary?.floorOrdinal ?? 1)
        : floorIndex + 1;
    const roomIds = new Set(floor.rooms.map((room) => room.id));
    const startRoomId = floor.startingRoomId
        || floor.rooms.find((room) => inferRoomRole(room) === "ingress")?.id
        || floor.rooms[0]?.id
        || `floor_${floorIndex + 1}_ingress`;
    const clearedRoomIds = new Set(dedupeIds([startRoomId, ...(options.clearedRoomIds ?? [])]));
    const currentRoomId = options.currentRoomId && roomIds.has(options.currentRoomId)
        ? options.currentRoomId
        : startRoomId;
    const currentState = resolveCurrentState(atlasSummary?.currentState);
    const definition = {
        id: atlasSummary?.theaterId ?? `${operation.id}_floor_${floorIndex + 1}`,
        name: briefing.zoneName,
        zoneName: briefing.zoneName,
        theaterStatus: currentState,
        currentState,
        operationId: operation.id,
        objective: briefing.objective,
        recommendedPWR: briefing.recommendedPWR ?? atlasSummary?.recommendedPwr ?? 24,
        beginningState: briefing.beginningState,
        endState: briefing.endState,
        floorId: floor.atlasFloorId || atlasSummary?.floorId || floor.id,
        floorOrdinal,
        sectorLabel: floor.sectorLabel || atlasSummary?.sectorLabel || `SECTOR ${floorOrdinal}`,
        radialSlotIndex: atlasSummary?.radialSlotIndex ?? (floorIndex % 6),
        radialSlotCount: atlasSummary?.radialSlotCount ?? 6,
        angleDeg,
        radialDirection: atlasSummary?.radialDirection ?? createRadialDirection(angleDeg),
        discovered: atlasSummary?.discovered ?? true,
        operationAvailable: atlasSummary?.operationAvailable ?? true,
        passiveEffectText: floor.passiveEffectText
            || atlasSummary?.passiveEffectText
            || "Technica-authored theater route synchronized for live deployment.",
        threatLevel: floor.threatLevel || atlasSummary?.threatLevel || "Moderate",
        ingressRoomId: startRoomId,
        uplinkRoomId: startRoomId,
        outwardDepth: 0,
        powerSourceRoomIds: [],
        mapAnchor,
        layoutStyle,
        originLabel: floor.originLabel
            || (layoutStyle === "central_bloom"
                ? "CENTER BREACH"
                : layoutStyle === "offset_arc"
                    ? "OFFSET BREACH"
                    : layoutStyle === "split_fan"
                        ? "FAN INSERT"
                        : "TECHNICA INSERT"),
        floorKeyInventory: {
            triangle: false,
            square: false,
            circle: false,
            spade: false,
            star: false,
        },
    };
    const rooms = Object.fromEntries(floor.rooms.map((room, roomIndex) => {
        const role = inferRoomRole(room);
        const localPosition = resolveLocalPosition(room, roomIndex);
        const roomClass = normalizeRoomClass(room.roomClass, "standard");
        const clearMode = normalizeClearMode(room.clearMode, getDefaultClearMode(role));
        const isUplinkRoom = room.id === startRoomId;
        const tags = dedupeIds([...(room.tags ?? []), ...getDefaultRoomTags(role)]);
        if (isUplinkRoom) {
            tags.push("ingress", "uplink");
        }
        const dedupedTags = Array.from(new Set(tags));
        const isPowerSource = typeof room.isPowerSource === "boolean"
            ? room.isPowerSource
            : getDefaultPowerSource(role) || dedupedTags.includes("power_source");
        if (isPowerSource && !dedupedTags.includes("power_source")) {
            dedupedTags.push("power_source");
        }
        const depthFromUplink = Math.max(0, Number.isFinite(Number(room.depthFromUplink))
            ? Math.round(Number(room.depthFromUplink))
            : Math.max(0, Math.round(localPosition.x)));
        const secured = clearedRoomIds.has(room.id);
        const coreSlotCapacity = Math.max(0, Number.isFinite(Number(room.coreSlotCapacity))
            ? Math.round(Number(room.coreSlotCapacity))
            : getDefaultCoreSlotCapacity(role, roomClass));
        const resolvedCurrentRoom = currentRoomId === room.id;
        const resolvedAdjacency = resolveRoomConnections(room).filter((adjacentId) => adjacentId !== room.id && roomIds.has(adjacentId));
        const tacticalEncounter = clearMode === "battle"
            ? room.tacticalEncounter?.trim()
                || room.battleTemplate?.trim()
                || `${definition.id}_${room.id}`
            : null;
        const runtimeRoom = {
            id: room.id,
            theaterId: definition.id,
            label: room.label,
            sectorTag: room.sectorTag?.trim() || createSectorTag(depthFromUplink, localPosition.y),
            position: projectTheaterPosition(definition.angleDeg, localPosition, definition.mapAnchor),
            localPosition,
            depthFromUplink,
            isUplinkRoom,
            size: getDefaultRoomSize(role, roomClass),
            roomClass,
            adjacency: resolvedAdjacency,
            powerGateWatts: {},
            status: secured ? "secured" : "mapped",
            clearMode,
            fortificationCapacity: Math.max(0, Number.isFinite(Number(room.fortificationCapacity))
                ? Math.round(Number(room.fortificationCapacity))
                : getDefaultFortificationCapacity(role)),
            coreSlotCapacity,
            moduleSlotCapacity: 0,
            moduleSlots: [],
            moduleSlotUpgradeLevel: 0,
            secured,
            fortified: isUplinkRoom,
            coreAssignment: null,
            coreSlots: Array.from({ length: coreSlotCapacity }, () => null),
            underThreat: false,
            damaged: false,
            connected: secured || isUplinkRoom || resolvedCurrentRoom,
            powered: isUplinkRoom || (secured && isPowerSource),
            supplied: isUplinkRoom || secured,
            commsVisible: isUplinkRoom || secured || resolvedCurrentRoom,
            commsLinked: isUplinkRoom || secured,
            battleMapId: room.battleMapId ?? null,
            placedFieldAssets: [],
            fieldAssetRuntimeState: {},
            naturalResourceStock: { metalScrap: 0, wood: 0, steamComponents: 0 },
            naturalResourceStockMax: { metalScrap: 0, wood: 0, steamComponents: 0 },
            supplyFlow: 0,
            powerFlow: 0,
            commsFlow: 0,
            sandboxOverheating: false,
            sandboxOverheatSeverity: 0,
            sandboxRouteNoise: false,
            sandboxPhantomRouteRoomIds: [],
            sandboxCommsAttraction: 0,
            sandboxScavengerPressure: 0,
            sandboxScavengerPresence: 0,
            sandboxScavengerActivity: "quiet",
            sandboxEnemyPresence: 0,
            sandboxMigrationAnchorRoomId: null,
            sandboxHeatValue: 0,
            sandboxSmokeValue: 0,
            sandboxBurning: false,
            sandboxBurnSeverity: 0,
            sandboxContainmentMode: "normal",
            sandboxEmergencyDumpTicks: 0,
            sandboxStructuralStress: 0,
            sandboxSignalPosture: "normal",
            sandboxSignalBloom: false,
            sandboxSupplyFireRisk: false,
            sandboxExtractionEfficiency: 1,
            intelLevel: 0,
            fortificationPips: (0, schemaSystem_1.createEmptyFortificationPips)(),
            tacticalEncounter,
            tags: dedupedTags,
            isPowerSource,
            abandoned: false,
            requiredKeyType: normalizeKeyType(room.requiredKeyType),
            grantsKeyType: normalizeKeyType(room.grantsKeyType),
            keyCollected: false,
            enemySite: null,
        };
        return [room.id, runtimeRoom];
    }));
    definition.outwardDepth = Math.max(0, ...Object.values(rooms).map((room) => room.depthFromUplink));
    definition.powerSourceRoomIds = Object.values(rooms)
        .filter((room) => room.isPowerSource)
        .map((room) => room.id);
    return {
        definition,
        rooms,
        currentRoomId,
        selectedRoomId: currentRoomId,
        currentNodeId: currentRoomId,
        selectedNodeId: currentRoomId,
        annexesById: {},
        partitionsByEdgeId: {},
        automation: (0, theaterAutomation_1.createEmptyTheaterAutomationState)(),
        squads: [],
        selectedSquadId: null,
        tickCount: 0,
        activeThreats: [],
        recentEvents: [
            `TECHNICA // ${operation.codename} authored floor ${floorOrdinal} synchronized for live deployment.`,
        ],
        objectiveDefinition: null,
        objectiveComplete: false,
        completion: null,
    };
}
function buildImportedOperationTheaterFloors(operation, options = {}) {
    const currentFloorIndex = clampFloorIndex(operation, options.currentFloorIndex);
    return Object.fromEntries(operation.floors.map((floor, floorIndex) => [
        floorIndex,
        buildImportedOperationTheaterFloor(operation, floorIndex, {
            currentRoomId: floorIndex === currentFloorIndex
                ? options.currentRoomId
                : floor.startingRoomId || floor.rooms[0]?.id || null,
            clearedRoomIds: options.clearedRoomIdsByFloor?.[floorIndex] ?? [],
        }),
    ]));
}
function buildImportedOperationRuntime(operation, options = {}) {
    const briefing = getImportedOperationBriefing(operation);
    const currentFloorIndex = clampFloorIndex(operation, options.currentFloorIndex);
    const floors = options.floorsOverride ?? operation.floors.map((floor) => buildImportedOperationFloor(floor));
    const activeFloor = operation.floors[currentFloorIndex];
    const defaultCurrentRoomId = activeFloor?.startingRoomId
        || activeFloor?.rooms[0]?.id
        || floors[currentFloorIndex]?.startingNodeId
        || floors[currentFloorIndex]?.nodes?.[0]?.id
        || null;
    const currentRoomId = options.currentRoomId ?? defaultCurrentRoomId;
    const theaterFloors = buildImportedOperationTheaterFloors(operation, {
        currentFloorIndex,
        currentRoomId,
        clearedRoomIdsByFloor: options.clearedRoomIdsByFloor,
    });
    const atlasSummary = (0, atlasSystem_1.getAtlasTheaterByOperationId)(operation.id);
    const fallbackConnections = Object.fromEntries((floors[currentFloorIndex]?.nodes ?? []).map((node) => [node.id, [...(node.connections ?? [])]]));
    return {
        id: operation.id,
        codename: operation.codename,
        description: operation.description,
        objective: briefing.objective,
        recommendedPWR: briefing.recommendedPWR,
        beginningState: briefing.beginningState,
        endState: briefing.endState,
        floors,
        currentFloorIndex,
        currentRoomId,
        connections: options.connectionsOverride ?? fallbackConnections,
        launchSource: "ops_terminal",
        atlasTheaterId: operation.floors.length <= 1 ? atlasSummary?.theaterId : undefined,
        atlasFloorId: operation.floors.length <= 1 ? activeFloor?.atlasFloorId || undefined : undefined,
        sprawlDirection: briefing.sprawlDirection,
        theater: theaterFloors[currentFloorIndex],
        theaterFloors,
    };
}

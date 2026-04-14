"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.THEATER_CORE_BLUEPRINTS = exports.THEATER_SQUAD_ICON_CHOICES = exports.THEATER_SQUAD_COLOR_CHOICES = void 0;
exports.getTheaterRoomBattleMapId = getTheaterRoomBattleMapId;
exports.getTheaterRoomTacticalMap = getTheaterRoomTacticalMap;
exports.formatTheaterKeyLabel = formatTheaterKeyLabel;
exports.hasTheaterKey = hasTheaterKey;
exports.isTheaterRoomLocked = isTheaterRoomLocked;
exports.getPreparedTheaterOperation = getPreparedTheaterOperation;
exports.getPreparedTheaterOperationForSessionSlot = getPreparedTheaterOperationForSessionSlot;
exports.getPendingTheaterBattleConfirmationForSessionSlot = getPendingTheaterBattleConfirmationForSessionSlot;
exports.createScopedTheaterStateForSessionSlot = createScopedTheaterStateForSessionSlot;
exports.mergeScopedTheaterStateForSessionSlot = mergeScopedTheaterStateForSessionSlot;
exports.selectTheaterSquadForSessionSlot = selectTheaterSquadForSessionSlot;
exports.setTheaterCurrentRoomForSessionSlot = setTheaterCurrentRoomForSessionSlot;
exports.moveToTheaterRoomForSessionSlot = moveToTheaterRoomForSessionSlot;
exports.holdPositionInTheaterForSessionSlot = holdPositionInTheaterForSessionSlot;
exports.issueTheaterRoomCommandForSessionSlot = issueTheaterRoomCommandForSessionSlot;
exports.refuseTheaterDefenseForSessionSlot = refuseTheaterDefenseForSessionSlot;
exports.canManuallyControlTheaterSquad = canManuallyControlTheaterSquad;
exports.getTheaterPassagePowerRequirement = getTheaterPassagePowerRequirement;
exports.isTheaterPassagePowered = isTheaterPassagePowered;
exports.ensureOperationHasTheater = ensureOperationHasTheater;
exports.hasTheaterOperation = hasTheaterOperation;
exports.getMoveTickCost = getMoveTickCost;
exports.setTheaterSelectedRoom = setTheaterSelectedRoom;
exports.setTheaterCurrentRoom = setTheaterCurrentRoom;
exports.getTheaterSelectedNode = getTheaterSelectedNode;
exports.setTheaterSelectedNode = setTheaterSelectedNode;
exports.getTheaterRoomModuleSlotUpgradeCost = getTheaterRoomModuleSlotUpgradeCost;
exports.buildTheaterAnnex = buildTheaterAnnex;
exports.upgradeTheaterRoomModuleSlots = upgradeTheaterRoomModuleSlots;
exports.installTheaterModule = installTheaterModule;
exports.removeTheaterModule = removeTheaterModule;
exports.configureTheaterModule = configureTheaterModule;
exports.resetTheaterModuleState = resetTheaterModuleState;
exports.installTheaterPartition = installTheaterPartition;
exports.toggleTheaterPartitionState = toggleTheaterPartitionState;
exports.setTheaterRoomSignalPosture = setTheaterRoomSignalPosture;
exports.setTheaterRoomContainmentMode = setTheaterRoomContainmentMode;
exports.triggerTheaterEmergencyDump = triggerTheaterEmergencyDump;
exports.moveToTheaterNode = moveToTheaterNode;
exports.moveToTheaterRoom = moveToTheaterRoom;
exports.holdPositionInTheater = holdPositionInTheater;
exports.getSelectedTheaterSquad = getSelectedTheaterSquad;
exports.getTheaterObjectiveDefinition = getTheaterObjectiveDefinition;
exports.selectTheaterSquad = selectTheaterSquad;
exports.setTheaterSquadAutomationMode = setTheaterSquadAutomationMode;
exports.renameTheaterSquad = renameTheaterSquad;
exports.useTheaterConsumable = useTheaterConsumable;
exports.setTheaterSquadIcon = setTheaterSquadIcon;
exports.setTheaterSquadColor = setTheaterSquadColor;
exports.splitUnitToNewSquad = splitUnitToNewSquad;
exports.transferUnitBetweenSquads = transferUnitBetweenSquads;
exports.mergeTheaterSquads = mergeTheaterSquads;
exports.refuseTheaterDefense = refuseTheaterDefense;
exports.getTheaterCoreRepairCost = getTheaterCoreRepairCost;
exports.repairTheaterCore = repairTheaterCore;
exports.destroyTheaterCore = destroyTheaterCore;
exports.destroyTheaterFortification = destroyTheaterFortification;
exports.destroyTheaterAnnex = destroyTheaterAnnex;
exports.secureTheaterRoomInState = secureTheaterRoomInState;
exports.clearTheaterEnemyThreatsInState = clearTheaterEnemyThreatsInState;
exports.buildCoreInTheaterRoom = buildCoreInTheaterRoom;
exports.fortifyTheaterRoom = fortifyTheaterRoom;
exports.getFieldAssetPlacementError = getFieldAssetPlacementError;
exports.fabricateFieldAssetInTheaterRoom = fabricateFieldAssetInTheaterRoom;
exports.removeFieldAssetFromTheaterRoom = removeFieldAssetFromTheaterRoom;
exports.applyTheaterOperationFailure = applyTheaterOperationFailure;
exports.clearCurrentTheaterOperationInjuries = clearCurrentTheaterOperationInjuries;
exports.createTheaterBattleState = createTheaterBattleState;
exports.applyTheaterBattleOutcome = applyTheaterBattleOutcome;
exports.resolveTheaterAutoBattle = resolveTheaterAutoBattle;
exports.getTheaterSummary = getTheaterSummary;
exports.getTheaterStarterResources = getTheaterStarterResources;
exports.getFortificationCost = getFortificationCost;
exports.formatResourceCost = formatResourceCost;
exports.getTheaterUpkeepPerTick = getTheaterUpkeepPerTick;
exports.getTheaterRoomCoreAssignments = getTheaterRoomCoreAssignments;
exports.getTheaterRoomOpenCoreSlots = getTheaterRoomOpenCoreSlots;
exports.isTheaterCoreOperational = isTheaterCoreOperational;
exports.getTheaterCoreOperationalRequirements = getTheaterCoreOperationalRequirements;
exports.getTheaterCoreOfflineReason = getTheaterCoreOfflineReason;
exports.hasCompletedTheaterObjective = hasCompletedTheaterObjective;
exports.recomputeTheaterNetwork = recomputeTheaterNetwork;
const battle_1 = require("./battle");
const atlasSystem_1 = require("./atlasSystem");
const theaterGenerator_1 = require("./theaterGenerator");
const questRuntime_1 = require("../quests/questRuntime");
const theaterDeploymentPreset_1 = require("./theaterDeploymentPreset");
const schemaSystem_1 = require("./schemaSystem");
const crafting_1 = require("./crafting");
const foundrySystem_1 = require("./foundrySystem");
const theaterAutomation_1 = require("./theaterAutomation");
const tacticalBattle_1 = require("./tacticalBattle");
const tacticalMaps_1 = require("./tacticalMaps");
const resources_1 = require("./resources");
const session_1 = require("./session");
const operationStatuses_1 = require("./operationStatuses");
const campaignRegions_1 = require("./campaignRegions");
function syncQuestRuntime(state) {
    return (0, questRuntime_1.syncQuestProgressFromSnapshotState)(state);
}
const THEATER_ROOM_BASE = {
    fortified: false,
    coreAssignment: null,
    coreSlots: [null],
    coreSlotCapacity: 1,
    moduleSlots: [],
    moduleSlotCapacity: 0,
    moduleSlotUpgradeLevel: 0,
    roomClass: "standard",
    underThreat: false,
    damaged: false,
    connected: false,
    powered: false,
    supplied: false,
    commsVisible: false,
    commsLinked: false,
    battleMapId: null,
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
    powerGateWatts: {},
    isPowerSource: false,
    abandoned: false,
    requiredKeyType: null,
    grantsKeyType: null,
    keyCollected: false,
    enemySite: null,
};
const SUPPLY_SOURCE_CRATES_PER_TICK = 50;
const SUPPLY_FALLOFF_PER_ROOM = 3;
const POWER_SOURCE_WATTS_PER_TICK = 50;
const POWER_FALLOFF_PER_ROOM = 5;
const COMMS_SOURCE_BANDWIDTH_PER_TICK = 50;
const COMMS_FALLOFF_PER_ROOM = 7;
const CORE_SUPPLY_REQUIREMENT = 50;
const CORE_POWER_REQUIREMENT = 50;
const CORE_COMMS_REQUIREMENT = 0;
const GENERATOR_MIN_INPUT_WATTS = 1;
const SQUAD_CONTROL_BW_PER_UNIT = 5;
const ROOM_MODULE_SLOT_UPGRADE_COSTS = [
    { metalScrap: 6, wood: 4 },
    { metalScrap: 10, wood: 6, steamComponents: 2 },
    { metalScrap: 14, wood: 8, steamComponents: 4 },
];
exports.THEATER_SQUAD_COLOR_CHOICES = ["amber", "teal", "verdant", "violet", "oxide", "moss", "steel"];
exports.THEATER_SQUAD_ICON_CHOICES = ["◉", "▲", "◆", "■", "✦", "⬢", "✚", "⬣"];
function clampSquadName(name, fallback) {
    const sanitized = (name ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 24);
    return sanitized || fallback;
}
function normalizeSquadIcon(icon, index = 0) {
    if (icon && exports.THEATER_SQUAD_ICON_CHOICES.includes(icon)) {
        return icon;
    }
    return exports.THEATER_SQUAD_ICON_CHOICES[index % exports.THEATER_SQUAD_ICON_CHOICES.length] ?? "◉";
}
function normalizeSquadColorKey(colorKey, index = 0) {
    if (colorKey && exports.THEATER_SQUAD_COLOR_CHOICES.includes(colorKey)) {
        return colorKey;
    }
    return exports.THEATER_SQUAD_COLOR_CHOICES[index % exports.THEATER_SQUAD_COLOR_CHOICES.length] ?? "amber";
}
function formatDefaultSquadName(index) {
    return `Squad ${index + 1}`;
}
exports.THEATER_CORE_BLUEPRINTS = schemaSystem_1.SCHEMA_CORE_DEFINITIONS;
const FORTIFICATION_COSTS = Object.fromEntries(Object.entries(schemaSystem_1.SCHEMA_FORTIFICATION_DEFINITIONS).map(([fortificationType, definition]) => [
    fortificationType,
    { ...definition.buildCost },
]));
const THEATER_STARTER_RESERVE = (0, resources_1.createEmptyResourceWallet)({
    metalScrap: 10,
    wood: 8,
    chaosShards: 3,
    steamComponents: 3,
});
const THEATER_MAP_ORIGIN = { x: 230, y: 390 };
const THEATER_DEPTH_STEP = 300;
const THEATER_LATERAL_STEP = 220;
function createEmptyKeyInventory() {
    return {
        triangle: false,
        square: false,
        circle: false,
        spade: false,
        star: false,
    };
}
function getDefaultBattleMapIdForRoom(room) {
    if ((0, schemaSystem_1.roomHasTag)(room, "survey_highground")) {
        return "builtin_quarry_steps";
    }
    if ((0, schemaSystem_1.roomHasTag)(room, "relay") || (0, schemaSystem_1.roomHasTag)(room, "junction") || (0, schemaSystem_1.roomHasTag)(room, "transit_junction")) {
        return "builtin_relay_spine";
    }
    return "builtin_bunker_breach";
}
function clonePlacedFieldAssets(room) {
    return (room.placedFieldAssets ?? []).map((asset) => ({
        ...asset,
    }));
}
function cloneFieldAssetRuntimeState(room) {
    return Object.fromEntries(Object.entries(room.fieldAssetRuntimeState ?? {}).map(([assetId, runtimeState]) => [
        assetId,
        { ...runtimeState },
    ]));
}
function toTacticalObjectType(fieldAssetType) {
    switch (fieldAssetType) {
        case "barricade_wall":
        case "med_station":
        case "ammo_crate":
        case "proximity_mine":
        case "smoke_emitter":
        case "portable_ladder":
        case "light_tower":
            return fieldAssetType;
        default:
            return null;
    }
}
function createFieldAssetMapObject(room, asset) {
    const objectType = toTacticalObjectType(asset.type);
    if (!objectType) {
        return null;
    }
    const runtimeState = room.fieldAssetRuntimeState?.[asset.id];
    if (runtimeState?.destroyed || runtimeState?.consumed) {
        return null;
    }
    return {
        id: asset.id,
        type: objectType,
        x: asset.x,
        y: asset.y,
        active: asset.active ?? true,
        hidden: objectType === "proximity_mine",
        blocksMovement: objectType === "barricade_wall",
        blocksLineOfSight: objectType === "barricade_wall" || objectType === "smoke_emitter",
        charges: runtimeState?.charges ?? asset.charges,
        radius: objectType === "smoke_emitter" || objectType === "light_tower" ? 1 : undefined,
    };
}
function getTheaterRoomBattleMapId(room) {
    return room.battleMapId ?? getDefaultBattleMapIdForRoom(room);
}
function getTheaterRoomTacticalMap(room) {
    const sourceMap = (0, tacticalMaps_1.getTacticalMapById)(getTheaterRoomBattleMapId(room));
    if (!sourceMap) {
        return null;
    }
    const map = (0, tacticalMaps_1.cloneTacticalMapDefinition)(sourceMap);
    const occupiedKeys = new Set(map.objects.map((objectDef) => (0, tacticalMaps_1.createPointKey)(objectDef)));
    const playableKeys = new Set(map.tiles.map((tile) => (0, tacticalMaps_1.createPointKey)(tile)));
    clonePlacedFieldAssets(room).forEach((asset) => {
        const key = `${asset.x},${asset.y}`;
        if (!playableKeys.has(key) || occupiedKeys.has(key)) {
            return;
        }
        const objectDef = createFieldAssetMapObject(room, asset);
        if (!objectDef) {
            return;
        }
        occupiedKeys.add(key);
        map.objects.push(objectDef);
    });
    return map;
}
function cloneKeyInventory(inventory) {
    return {
        triangle: Boolean(inventory?.triangle),
        square: Boolean(inventory?.square),
        circle: Boolean(inventory?.circle),
        spade: Boolean(inventory?.spade),
        star: Boolean(inventory?.star),
    };
}
function formatTheaterKeyLabel(keyType) {
    switch (keyType) {
        case "triangle":
            return "Triangle Key";
        case "square":
            return "Square Key";
        case "circle":
            return "Circle Key";
        case "spade":
            return "Spade Key";
        case "star":
            return "Star Key";
        default:
            return "Key";
    }
}
function hasTheaterKey(theater, keyType) {
    if (!keyType) {
        return true;
    }
    return Boolean(theater.definition.floorKeyInventory?.[keyType]);
}
function isTheaterRoomLocked(theater, room) {
    return Boolean(room.requiredKeyType && !hasTheaterKey(theater, room.requiredKeyType));
}
function syncTheaterKeyInventory(theater) {
    const nextInventory = cloneKeyInventory(theater.definition.floorKeyInventory);
    Object.values(theater.rooms).forEach((room) => {
        if (room.grantsKeyType && room.keyCollected) {
            nextInventory[room.grantsKeyType] = true;
        }
    });
    theater.definition.floorKeyInventory = nextInventory;
    return theater;
}
function collectRoomKeyIfPresent(theater, roomId) {
    const room = theater.rooms[roomId];
    if (!room?.grantsKeyType || room.keyCollected) {
        return theater;
    }
    const next = cloneTheater(theater);
    const nextRoom = next.rooms[roomId];
    if (!nextRoom?.grantsKeyType || nextRoom.keyCollected) {
        return next;
    }
    nextRoom.keyCollected = true;
    next.definition.floorKeyInventory = cloneKeyInventory(next.definition.floorKeyInventory);
    next.definition.floorKeyInventory[nextRoom.grantsKeyType] = true;
    return addTheaterEvent(next, `KEY ACQUIRED :: ${formatTheaterKeyLabel(nextRoom.grantsKeyType)} recovered at ${nextRoom.label}.`);
}
function resolveAtlasSummaryForOperation(operation) {
    return ((operation.atlasTheaterId ? (0, atlasSystem_1.getAtlasTheaterSummary)(operation.atlasTheaterId) : null)
        ?? (0, atlasSystem_1.getAtlasTheaterByOperationId)(operation.id));
}
function projectTheaterPosition(definition, localPosition) {
    const radians = (definition.angleDeg * Math.PI) / 180;
    const forward = { x: Math.cos(radians), y: Math.sin(radians) };
    const lateral = { x: -forward.y, y: forward.x };
    const anchor = definition.mapAnchor ?? THEATER_MAP_ORIGIN;
    return {
        x: Math.round(anchor.x
            + (localPosition.x * THEATER_DEPTH_STEP * forward.x)
            + (localPosition.y * THEATER_LATERAL_STEP * lateral.x)),
        y: Math.round(anchor.y
            + (localPosition.x * THEATER_DEPTH_STEP * forward.y)
            + (localPosition.y * THEATER_LATERAL_STEP * lateral.y)),
    };
}
function createRoom(definition, room) {
    const naturalStock = (0, schemaSystem_1.normalizeTheaterRoomNaturalStock)(room.tags, room.naturalResourceStock, room.naturalResourceStockMax);
    const coreSlots = (room.coreSlots && room.coreSlots.length > 0)
        ? room.coreSlots.map((assignment) => assignment ? {
            ...assignment,
            buildCost: { ...assignment.buildCost },
            upkeepPerTick: { ...assignment.upkeepPerTick },
            incomePerTick: { ...assignment.incomePerTick },
        } : null)
        : [room.coreAssignment ? {
                ...room.coreAssignment,
                buildCost: { ...room.coreAssignment.buildCost },
                upkeepPerTick: { ...room.coreAssignment.upkeepPerTick },
                incomePerTick: { ...room.coreAssignment.incomePerTick },
            } : null];
    const primaryCoreAssignment = coreSlots.find((assignment) => assignment !== null) ?? null;
    return {
        ...THEATER_ROOM_BASE,
        theaterId: room.theaterId ?? definition.id,
        ...room,
        position: room.position ?? projectTheaterPosition(definition, room.localPosition),
        clearMode: room.clearMode ?? (room.tacticalEncounter ? "battle" : "empty"),
        fortificationCapacity: room.fortificationCapacity ?? 3,
        fortificationPips: (0, schemaSystem_1.normalizeFortificationPips)(room.fortificationPips),
        roomClass: room.roomClass ?? "standard",
        coreSlotCapacity: room.coreSlotCapacity ?? coreSlots.length,
        coreSlots,
        coreAssignment: primaryCoreAssignment,
        enemySite: room.enemySite ? { ...room.enemySite } : null,
        naturalResourceStock: naturalStock.current,
        naturalResourceStockMax: naturalStock.max,
        battleSizeOverride: room.battleSizeOverride ? { ...room.battleSizeOverride } : undefined,
    };
}
function createIronGateTheater(operation) {
    const atlasSummary = resolveAtlasSummaryForOperation(operation);
    const operationId = operation.id ?? "op_iron_gate";
    const objective = operation.objective ?? operation.description ?? "Advance through the Gateworks, stabilize a logistics chain, and crack the eastern lockline.";
    const recommendedPWR = operation.recommendedPWR ?? atlasSummary?.recommendedPwr ?? 24;
    const beginningState = operation.beginningState ?? `${atlasSummary?.zoneName ?? "CASTELLAN GATEWORKS"} uplink secured. Forward routes mapped only one room deep. Generator sector offline.`;
    const endState = operation.endState ?? "Eastern objective node secured with a powered support chain and at least one C.O.R.E. online.";
    const currentState = atlasSummary?.currentState === "undiscovered" ? "active" : (atlasSummary?.currentState ?? "active");
    const angleDeg = atlasSummary?.angleDeg ?? 0;
    const zoneName = atlasSummary?.zoneName ?? "CASTELLAN GATEWORKS";
    const sectorLabel = atlasSummary?.sectorLabel ?? "SECTOR E-01";
    const uplinkRoomId = atlasSummary?.uplinkRoomId ?? "ig_ingress";
    const definition = {
        id: atlasSummary?.theaterId ?? `${operationId}_castellan_gateworks`,
        name: zoneName,
        zoneName,
        theaterStatus: currentState === "cold" ? "cold" : currentState === "warm" ? "warm" : "active",
        currentState,
        operationId,
        objective,
        recommendedPWR,
        beginningState,
        endState,
        floorId: atlasSummary?.floorId ?? operation.atlasFloorId ?? "haven_floor_03",
        floorOrdinal: atlasSummary?.floorOrdinal ?? 3,
        sectorLabel,
        radialSlotIndex: atlasSummary?.radialSlotIndex ?? 0,
        radialSlotCount: atlasSummary?.radialSlotCount ?? 5,
        angleDeg,
        radialDirection: atlasSummary?.radialDirection ?? { x: 1, y: 0 },
        discovered: atlasSummary?.discovered ?? true,
        operationAvailable: atlasSummary?.operationAvailable ?? true,
        passiveEffectText: atlasSummary?.passiveEffectText ?? "Passive Benefit // Forward relay improves early deployment stability.",
        threatLevel: atlasSummary?.threatLevel ?? "High",
        ingressRoomId: uplinkRoomId,
        uplinkRoomId,
        outwardDepth: atlasSummary?.outwardDepth ?? 5,
        powerSourceRoomIds: ["ig_ingress", "ig_generator"],
        floorKeyInventory: createEmptyKeyInventory(),
    };
    const makeRoom = (room) => createRoom(definition, room);
    const rooms = {
        ig_ingress: makeRoom({
            id: "ig_ingress",
            label: "Gateworks Aperture",
            sectorTag: "A0",
            localPosition: { x: 0, y: 0 },
            depthFromUplink: 0,
            isUplinkRoom: true,
            size: { width: 230, height: 138 },
            adjacency: ["ig_checkpoint"],
            status: "secured",
            secured: true,
            clearMode: "empty",
            fortificationCapacity: 4,
            fortified: true,
            tacticalEncounter: null,
            tags: ["ingress", "uplink"],
            fortificationPips: { barricade: 1, powerRail: 1 },
            isPowerSource: true,
        }),
        ig_checkpoint: makeRoom({
            id: "ig_checkpoint",
            label: "Broken Causeway",
            sectorTag: "A1",
            localPosition: { x: 1, y: 0 },
            depthFromUplink: 1,
            isUplinkRoom: false,
            size: { width: 250, height: 150 },
            adjacency: ["ig_ingress", "ig_junction", "ig_depot"],
            status: "mapped",
            secured: false,
            clearMode: "battle",
            fortificationCapacity: 2,
            tacticalEncounter: "gate_skirmish",
            tags: ["frontier"],
        }),
        ig_depot: makeRoom({
            id: "ig_depot",
            label: "Freight Annex",
            sectorTag: "B1",
            localPosition: { x: 1.3, y: 1.1 },
            depthFromUplink: 2,
            isUplinkRoom: false,
            size: { width: 520, height: 292 },
            adjacency: ["ig_checkpoint", "ig_storage"],
            status: "mapped",
            secured: false,
            clearMode: "field",
            fortificationCapacity: 8,
            roomClass: "mega",
            coreSlotCapacity: 4,
            coreSlots: [null, null, null, null],
            battleSizeOverride: { width: 10, height: 8 },
            tacticalEncounter: null,
            tags: ["core_candidate", "resource_pocket", "metal_rich", "timber_rich", "salvage_rich"],
        }),
        ig_junction: makeRoom({
            id: "ig_junction",
            label: "Signal Junction",
            sectorTag: "B0",
            localPosition: { x: 2, y: 0 },
            depthFromUplink: 2,
            isUplinkRoom: false,
            size: { width: 250, height: 152 },
            adjacency: ["ig_checkpoint", "ig_generator", "ig_command", "ig_redoubt"],
            status: "unknown",
            secured: false,
            clearMode: "battle",
            fortificationCapacity: 3,
            tacticalEncounter: "junction_melee",
            tags: ["junction"],
        }),
        ig_generator: makeRoom({
            id: "ig_generator",
            label: "Dyno Chamber",
            sectorTag: "B-1",
            localPosition: { x: 2.1, y: -1.1 },
            depthFromUplink: 3,
            isUplinkRoom: false,
            size: { width: 250, height: 150 },
            adjacency: ["ig_junction"],
            status: "unknown",
            secured: false,
            clearMode: "empty",
            fortificationCapacity: 4,
            tacticalEncounter: null,
            tags: ["power_source", "steam_vent"],
            isPowerSource: true,
        }),
        ig_command: makeRoom({
            id: "ig_command",
            label: "Overwatch Gallery",
            sectorTag: "C0",
            localPosition: { x: 3.1, y: -0.55 },
            depthFromUplink: 3,
            isUplinkRoom: false,
            size: { width: 280, height: 152 },
            adjacency: ["ig_junction", "ig_storage"],
            status: "unknown",
            secured: false,
            clearMode: "battle",
            fortificationCapacity: 4,
            tacticalEncounter: "command_gallery",
            tags: ["core_candidate", "command_suitable", "survey_highground"],
        }),
        ig_storage: makeRoom({
            id: "ig_storage",
            label: "Cold Storage Spur",
            sectorTag: "C1",
            localPosition: { x: 3.1, y: 0.85 },
            depthFromUplink: 3,
            isUplinkRoom: false,
            size: { width: 280, height: 150 },
            adjacency: ["ig_depot", "ig_command"],
            status: "unknown",
            secured: false,
            clearMode: "empty",
            fortificationCapacity: 2,
            tacticalEncounter: null,
            tags: ["side_branch", "timber_rich"],
        }),
        ig_redoubt: makeRoom({
            id: "ig_redoubt",
            label: "Redoubt Mouth",
            sectorTag: "D0",
            localPosition: { x: 4, y: 0 },
            depthFromUplink: 4,
            isUplinkRoom: false,
            size: { width: 250, height: 152 },
            adjacency: ["ig_junction", "ig_objective"],
            status: "unknown",
            secured: false,
            clearMode: "battle",
            fortificationCapacity: 3,
            tacticalEncounter: "elite_redoubt",
            tags: ["elite", "frontier", "enemy_staging"],
            enemySite: {
                type: "staging",
                reserveStrength: 3,
                dispatchInterval: 4,
                nextDispatchTick: 3,
                patrolStrength: 2,
            },
        }),
        ig_objective: makeRoom({
            id: "ig_objective",
            label: "Iron Gate Lock",
            sectorTag: "E0",
            localPosition: { x: 5, y: 0 },
            depthFromUplink: 5,
            isUplinkRoom: false,
            size: { width: 260, height: 160 },
            adjacency: ["ig_redoubt"],
            status: "unknown",
            secured: false,
            clearMode: "battle",
            fortificationCapacity: 4,
            tacticalEncounter: "objective_lock",
            tags: ["objective", "elite"],
        }),
    };
    return recomputeTheaterNetwork({
        definition,
        rooms,
        currentRoomId: uplinkRoomId,
        selectedRoomId: uplinkRoomId,
        squads: [],
        selectedSquadId: null,
        tickCount: 0,
        activeThreats: [],
        recentEvents: ["S/COM :: Gateworks Aperture secured. Push outward, build C.O.R.E.s, and hold the line."],
        objectiveDefinition: null,
        objectiveComplete: false,
        completion: null,
    });
}
function cloneTheater(theater) {
    return {
        definition: {
            ...theater.definition,
            radialDirection: { ...theater.definition.radialDirection },
            powerSourceRoomIds: [...theater.definition.powerSourceRoomIds],
            mapAnchor: theater.definition.mapAnchor ? { ...theater.definition.mapAnchor } : undefined,
            floorKeyInventory: cloneKeyInventory(theater.definition.floorKeyInventory),
        },
        rooms: Object.fromEntries(Object.entries(theater.rooms).map(([roomId, room]) => [
            roomId,
            (() => {
                const naturalStock = (0, schemaSystem_1.normalizeTheaterRoomNaturalStock)(room, room.naturalResourceStock, room.naturalResourceStockMax);
                return {
                    ...room,
                    position: { ...room.position },
                    localPosition: { ...room.localPosition },
                    size: { ...room.size },
                    adjacency: [...room.adjacency],
                    roomClass: room.roomClass ?? "standard",
                    powerGateWatts: { ...(room.powerGateWatts ?? {}) },
                    fortificationPips: (0, schemaSystem_1.normalizeFortificationPips)(room.fortificationPips),
                    coreSlotCapacity: room.coreSlotCapacity ?? Math.max(1, room.coreSlots?.length ?? (room.coreAssignment ? 1 : 1)),
                    moduleSlotCapacity: Math.max(0, Number(room.moduleSlotCapacity ?? room.moduleSlots?.length ?? 0)),
                    moduleSlots: Array.from({
                        length: Math.max(0, Number(room.moduleSlotCapacity ?? room.moduleSlots?.length ?? 0)),
                    }, (_, index) => room.moduleSlots?.[index] ?? null),
                    moduleSlotUpgradeLevel: Math.max(0, Number(room.moduleSlotUpgradeLevel ?? 0)),
                    abandoned: room.abandoned ?? false,
                    requiredKeyType: room.requiredKeyType ?? null,
                    grantsKeyType: room.grantsKeyType ?? null,
                    keyCollected: room.keyCollected ?? false,
                    coreSlots: (room.coreSlots && room.coreSlots.length > 0
                        ? room.coreSlots
                        : [room.coreAssignment ?? null]).map((assignment) => assignment ? {
                        ...assignment,
                        buildCost: { ...assignment.buildCost },
                        upkeepPerTick: { ...assignment.upkeepPerTick },
                        incomePerTick: { ...assignment.incomePerTick },
                    } : null),
                    coreAssignment: room.coreAssignment ? {
                        ...room.coreAssignment,
                        buildCost: { ...room.coreAssignment.buildCost },
                        upkeepPerTick: { ...room.coreAssignment.upkeepPerTick },
                        incomePerTick: { ...room.coreAssignment.incomePerTick },
                    } : null,
                    enemySite: room.enemySite ? { ...room.enemySite } : null,
                    battleMapId: room.battleMapId ?? getDefaultBattleMapIdForRoom(room),
                    placedFieldAssets: clonePlacedFieldAssets(room),
                    fieldAssetRuntimeState: cloneFieldAssetRuntimeState(room),
                    naturalResourceStock: naturalStock.current,
                    naturalResourceStockMax: naturalStock.max,
                    battleSizeOverride: room.battleSizeOverride ? { ...room.battleSizeOverride } : undefined,
                    tags: [...room.tags],
                };
            })(),
        ])),
        currentRoomId: theater.currentRoomId,
        selectedRoomId: theater.selectedRoomId,
        currentNodeId: theater.currentNodeId ?? theater.currentRoomId,
        selectedNodeId: theater.selectedNodeId ?? theater.selectedRoomId,
        annexesById: (0, theaterAutomation_1.normalizeTheaterAnnexes)(theater.annexesById),
        partitionsByEdgeId: (0, theaterAutomation_1.normalizeTheaterPartitions)(theater.partitionsByEdgeId),
        automation: (0, theaterAutomation_1.normalizeTheaterAutomationState)(theater.automation),
        squads: theater.squads.map((squad) => ({
            ...squad,
            displayName: clampSquadName(squad.displayName, squad.squadId.toUpperCase()),
            icon: normalizeSquadIcon(squad.icon),
            colorKey: normalizeSquadColorKey(squad.colorKey),
            unitIds: [...squad.unitIds],
            currentNodeId: squad.currentNodeId ?? squad.currentRoomId,
            automationMode: squad.automationMode ?? "manual",
            autoStatus: squad.autoStatus ?? "idle",
            autoTargetRoomId: squad.autoTargetRoomId ?? null,
        })),
        selectedSquadId: theater.selectedSquadId,
        tickCount: theater.tickCount,
        activeThreats: theater.activeThreats.map((threat) => ({ ...threat })),
        recentEvents: [...theater.recentEvents],
        objectiveDefinition: theater.objectiveDefinition
            ? {
                ...theater.objectiveDefinition,
                requiredCoreType: theater.objectiveDefinition.requiredCoreType ?? null,
                multiResource: theater.objectiveDefinition.multiResource
                    ? { ...theater.objectiveDefinition.multiResource }
                    : undefined,
                progress: { ...theater.objectiveDefinition.progress },
            }
            : null,
        objectiveComplete: theater.objectiveComplete,
        completion: theater.completion
            ? {
                ...theater.completion,
                reward: { ...theater.completion.reward },
                recapLines: [...theater.completion.recapLines],
            }
            : null,
    };
}
function createEmptyObjectiveProgress() {
    return {
        cratesDelivered: 0,
        ticksHeld: 0,
        powerRouted: 0,
        bwEstablished: 0,
        builtCoreType: null,
        completed: false,
    };
}
function buildSquadState(squadId, unitIds, currentRoomId, theaterId, options) {
    const orderIndex = options?.orderIndex ?? 0;
    return {
        squadId,
        displayName: clampSquadName(options?.displayName, formatDefaultSquadName(orderIndex)),
        icon: normalizeSquadIcon(options?.icon, orderIndex),
        colorKey: normalizeSquadColorKey(options?.colorKey, orderIndex),
        unitIds: [...unitIds],
        currentRoomId,
        currentNodeId: currentRoomId,
        currentTheaterId: theaterId,
        bwRequired: unitIds.length * SQUAD_CONTROL_BW_PER_UNIT,
        bwAvailable: 0,
        isInContact: false,
        status: "idle",
        automationMode: "manual",
        autoStatus: "idle",
        autoTargetRoomId: null,
    };
}
function createInitialSquads(sourceSquads, theater) {
    if (sourceSquads.length <= 0) {
        return [];
    }
    return sourceSquads
        .filter((squad) => squad.unitIds.length > 0)
        .map((squad, index) => buildSquadState(squad.squadId || `sq_${index + 1}`, squad.unitIds, theater.definition.uplinkRoomId, theater.definition.id, {
        displayName: squad.displayName,
        icon: squad.icon,
        colorKey: squad.colorKey,
        orderIndex: index,
    }));
}
function getObjectiveTargetRoom(theater, preferredTags) {
    for (const tag of preferredTags) {
        const taggedRoom = Object.values(theater.rooms)
            .filter((room) => room.tags.includes(tag))
            .sort((left, right) => right.depthFromUplink - left.depthFromUplink)[0];
        if (taggedRoom) {
            return taggedRoom;
        }
    }
    return getObjectiveRoom(theater) ?? Object.values(theater.rooms)[0] ?? null;
}
function formatObjectiveLabel(theater, objective) {
    const targetRoom = theater.rooms[objective.targetRoomId];
    const roomLabel = targetRoom?.label ?? objective.targetRoomId;
    switch (objective.objectiveType) {
        case "build_core":
            return `Build ${exports.THEATER_CORE_BLUEPRINTS[objective.requiredCoreType ?? "command_center"]?.displayName ?? "C.O.R.E."} in ${roomLabel}.`;
        case "route_power":
            return `Route ${objective.powerRequired ?? 0} W/TICK to ${roomLabel}.`;
        case "establish_comms":
            return `Establish ${objective.bwRequired ?? 0} BW in ${roomLabel}.`;
        case "deliver_supply":
            return `Deliver ${objective.cratesRequired ?? 0} crates/tick to ${roomLabel}.`;
        case "sustain_occupation":
            return `Hold ${roomLabel} for ${objective.ticksRequired ?? 0} ticks.`;
        case "multi_resource": {
            const fragments = [
                objective.multiResource?.crates ? `${objective.multiResource.crates} crates` : null,
                objective.multiResource?.power ? `${objective.multiResource.power} watts` : null,
                objective.multiResource?.bw ? `${objective.multiResource.bw} BW` : null,
            ].filter(Boolean);
            return `Establish ${fragments.join(" + ")} in ${roomLabel}.`;
        }
        default:
            return theater.definition.objective;
    }
}
function createObjectiveForTheater(theater) {
    const variant = Math.abs(theater.definition.radialSlotIndex ?? 0) % 3;
    const buildRoom = getObjectiveTargetRoom(theater, ["core_candidate", "core", "relay"]);
    const routeRoom = getObjectiveTargetRoom(theater, ["objective", "elite", "power"]);
    const commsRoom = getObjectiveTargetRoom(theater, ["objective", "relay", "elite"]);
    const objective = variant === 0
        ? {
            objectiveType: "build_core",
            targetRoomId: buildRoom?.id ?? theater.definition.uplinkRoomId,
            requiredCoreType: "command_center",
            label: "",
            progress: createEmptyObjectiveProgress(),
        }
        : variant === 1
            ? {
                objectiveType: "route_power",
                targetRoomId: routeRoom?.id ?? theater.definition.uplinkRoomId,
                powerRequired: 25,
                label: "",
                progress: createEmptyObjectiveProgress(),
            }
            : {
                objectiveType: "establish_comms",
                targetRoomId: commsRoom?.id ?? theater.definition.uplinkRoomId,
                bwRequired: 24,
                label: "",
                progress: createEmptyObjectiveProgress(),
            };
    objective.label = formatObjectiveLabel(theater, objective);
    return objective;
}
function getObjectiveProgressSignature(objective) {
    if (!objective) {
        return "none";
    }
    const progress = objective.progress;
    return [
        objective.objectiveType,
        objective.targetRoomId,
        progress.cratesDelivered,
        progress.ticksHeld,
        progress.powerRouted,
        progress.bwEstablished,
        progress.builtCoreType ?? "none",
        progress.completed ? "1" : "0",
    ].join("|");
}
function computeObjectiveProgress(theater, objective) {
    const targetRoom = theater.rooms[objective.targetRoomId];
    const previousProgress = objective.progress;
    const progress = {
        ...previousProgress,
        cratesDelivered: targetRoom?.supplyFlow ?? 0,
        powerRouted: targetRoom?.powerFlow ?? 0,
        bwEstablished: targetRoom?.commsFlow ?? 0,
        builtCoreType: getRoomPrimaryCoreAssignment(targetRoom)?.type ?? null,
        completed: previousProgress.completed,
    };
    switch (objective.objectiveType) {
        case "build_core":
            progress.completed = Boolean(targetRoom?.secured
                && roomHasAnyCore(targetRoom)
                && (!objective.requiredCoreType || roomHasCoreType(targetRoom, objective.requiredCoreType)));
            break;
        case "route_power":
            progress.completed = Boolean((targetRoom?.powerFlow ?? 0) >= (objective.powerRequired ?? 0));
            break;
        case "establish_comms":
            progress.completed = Boolean((targetRoom?.commsFlow ?? 0) >= (objective.bwRequired ?? 0));
            break;
        case "deliver_supply":
            progress.completed = Boolean((targetRoom?.supplyFlow ?? 0) >= (objective.cratesRequired ?? 0));
            break;
        case "sustain_occupation":
            progress.completed = progress.ticksHeld >= (objective.ticksRequired ?? 0);
            break;
        case "multi_resource":
            progress.completed =
                (targetRoom?.supplyFlow ?? 0) >= (objective.multiResource?.crates ?? 0)
                    && (targetRoom?.powerFlow ?? 0) >= (objective.multiResource?.power ?? 0)
                    && (targetRoom?.commsFlow ?? 0) >= (objective.multiResource?.bw ?? 0);
            break;
        default:
            progress.completed = false;
            break;
    }
    return {
        ...objective,
        label: formatObjectiveLabel(theater, objective),
        progress,
    };
}
function advanceOccupationObjective(theater, ticks) {
    if (!theater.objectiveDefinition || theater.objectiveDefinition.objectiveType !== "sustain_occupation") {
        return theater;
    }
    const targetRoom = theater.rooms[theater.objectiveDefinition.targetRoomId];
    const occupied = theater.squads.some((squad) => squad.currentRoomId === theater.objectiveDefinition.targetRoomId);
    const next = cloneTheater(theater);
    next.objectiveDefinition.progress.ticksHeld =
        occupied && targetRoom?.secured
            ? next.objectiveDefinition.progress.ticksHeld + Math.max(1, ticks)
            : 0;
    return next;
}
function applySquadContactState(theater) {
    const next = cloneTheater(theater);
    next.squads = next.squads.map((squad) => {
        const nodeId = squad.currentNodeId ?? squad.currentRoomId;
        const room = (0, theaterAutomation_1.getTheaterRootRoomForNode)(next, nodeId) ?? next.rooms[squad.currentRoomId];
        const bwRequired = Math.max(SQUAD_CONTROL_BW_PER_UNIT, squad.unitIds.length * SQUAD_CONTROL_BW_PER_UNIT);
        const bwAvailable = room?.commsFlow ?? 0;
        const isInContact = bwAvailable >= bwRequired;
        const status = !isInContact
            ? "out_of_contact"
            : room?.underThreat || room?.damaged
                ? "threatened"
                : "idle";
        if (squad.isInContact && !isInContact) {
            console.log("[THEATER] squad became out of contact", squad.squadId, squad.currentRoomId, bwRequired, bwAvailable);
        }
        return {
            ...squad,
            currentRoomId: room?.id ?? squad.currentRoomId,
            currentNodeId: nodeId,
            bwRequired,
            bwAvailable,
            isInContact,
            status,
        };
    });
    const selectedSquad = next.squads.find((squad) => squad.squadId === next.selectedSquadId)
        ?? next.squads[0]
        ?? null;
    next.selectedSquadId = selectedSquad?.squadId ?? null;
    next.currentRoomId = selectedSquad?.currentRoomId ?? next.currentRoomId;
    if (!next.rooms[next.selectedRoomId]) {
        next.selectedRoomId = next.currentRoomId;
    }
    return next;
}
function syncObjectiveState(theater) {
    if (!theater.objectiveDefinition) {
        return theater;
    }
    const previousSignature = getObjectiveProgressSignature(theater.objectiveDefinition);
    const next = cloneTheater(theater);
    if (!next.objectiveDefinition) {
        return next;
    }
    next.objectiveDefinition = computeObjectiveProgress(next, next.objectiveDefinition);
    const nextSignature = getObjectiveProgressSignature(next.objectiveDefinition);
    if (previousSignature !== nextSignature) {
        console.log("[THEATER] objective progress changed", next.definition.id, next.objectiveDefinition.objectiveType, next.objectiveDefinition.progress);
    }
    next.definition.objective = next.objectiveDefinition.label;
    return next;
}
function initializeTheaterRuntime(theater, state) {
    let next = cloneTheater(theater);
    next.currentNodeId = next.currentNodeId ?? next.currentRoomId;
    next.selectedNodeId = next.selectedNodeId ?? next.selectedRoomId;
    next.annexesById = (0, theaterAutomation_1.normalizeTheaterAnnexes)(next.annexesById);
    next.partitionsByEdgeId = (0, theaterAutomation_1.normalizeTheaterPartitions)(next.partitionsByEdgeId);
    next.automation = (0, theaterAutomation_1.normalizeTheaterAutomationState)(next.automation ?? (0, theaterAutomation_1.createEmptyTheaterAutomationState)());
    if (!next.squads || next.squads.length === 0) {
        next.squads = createInitialSquads((0, theaterDeploymentPreset_1.buildTheaterDeploymentLaunchPreview)(state).squads, next);
        next.selectedSquadId = next.squads[0]?.squadId ?? null;
    }
    else {
        next.squads = next.squads.map((squad) => ({
            ...squad,
            automationMode: squad.automationMode === "cautious" ? "undaring" : squad.automationMode,
            currentNodeId: squad.currentNodeId ?? squad.currentRoomId,
        }));
    }
    if (!next.objectiveDefinition) {
        next.objectiveDefinition = createObjectiveForTheater(next);
        next.definition.objective = next.objectiveDefinition.label;
    }
    return next;
}
function parseTheaterContextSnapshot(snapshot) {
    if (!snapshot) {
        return null;
    }
    try {
        const parsed = JSON.parse(snapshot);
        return parsed?.definition?.id && parsed?.rooms ? parsed : null;
    }
    catch {
        return null;
    }
}
function getLocalCoopOperationsSessionSlot(state) {
    if (state.session.mode !== "coop_operations") {
        return null;
    }
    return Object.values(state.session.players).find((player) => player.presence === "local" && player.connected)?.slot ?? null;
}
function getPreferredTheaterFromSessionContext(state, operation, preferredSlot) {
    if (state.session.mode !== "coop_operations") {
        return null;
    }
    const resolvedSlot = preferredSlot ?? getLocalCoopOperationsSessionSlot(state);
    if (!resolvedSlot) {
        return null;
    }
    const preferredTheaterId = state.session.players[resolvedSlot]?.currentTheaterId
        ?? state.session.theaterAssignments[resolvedSlot]?.theaterId
        ?? null;
    if (!preferredTheaterId) {
        return null;
    }
    const context = state.session.activeTheaterContexts?.[preferredTheaterId];
    const parsed = parseTheaterContextSnapshot(context?.snapshot);
    if (parsed) {
        return parsed;
    }
    if (operation.theater?.definition.id === preferredTheaterId) {
        return operation.theater;
    }
    return null;
}
function getPreparedTheaterOperation(state) {
    const operation = ensureOperationHasTheater(state.operation);
    if (!operation?.theater) {
        return operation;
    }
    const selectedTheater = getPreferredTheaterFromSessionContext(state, operation) ?? operation.theater;
    const initializedTheater = initializeTheaterRuntime(selectedTheater, state);
    const preparedTheater = prepareTheaterForOperation(initializedTheater);
    return resolveOperationFields(operation, preparedTheater);
}
function getPreparedTheaterOperationForSessionSlot(state, slot) {
    const operation = ensureOperationHasTheater(state.operation);
    if (!operation?.theater) {
        return operation;
    }
    const selectedTheater = getPreferredTheaterFromSessionContext(state, operation, slot) ?? operation.theater;
    const initializedTheater = initializeTheaterRuntime(selectedTheater, state);
    const preparedTheater = prepareTheaterForOperation(initializedTheater);
    return resolveOperationFields(operation, preparedTheater);
}
function getPreferredTheaterIdForSessionSlot(state, slot) {
    if (!slot) {
        return null;
    }
    return state.session.players[slot]?.currentTheaterId
        ?? state.session.theaterAssignments[slot]?.theaterId
        ?? null;
}
function getPendingTheaterBattleConfirmationForSessionSlot(state, slot) {
    const preferredTheaterId = getPreferredTheaterIdForSessionSlot(state, slot);
    if (!preferredTheaterId) {
        return state.session.pendingTheaterBattleConfirmation ?? null;
    }
    return state.session.activeTheaterContexts[preferredTheaterId]?.pendingTheaterBattleConfirmation
        ?? state.session.pendingTheaterBattleConfirmation
        ?? null;
}
function createScopedTheaterStateForSessionSlot(state, slot) {
    if (!slot) {
        return null;
    }
    const operation = getPreparedTheaterOperationForSessionSlot(state, slot);
    if (!operation?.theater) {
        return null;
    }
    const pendingTheaterBattleConfirmation = getPendingTheaterBattleConfirmationForSessionSlot(state, slot);
    const nextPlayers = { ...state.session.players };
    Object.keys(nextPlayers).forEach((playerSlot) => {
        const player = nextPlayers[playerSlot];
        if (!player) {
            return;
        }
        nextPlayers[playerSlot] = {
            ...player,
            presence: playerSlot === slot
                ? (player.connected ? "local" : player.presence)
                : (player.presence === "local" ? "remote" : player.presence),
        };
    });
    return {
        ...state,
        phase: pendingTheaterBattleConfirmation ? "operation" : state.phase,
        operation,
        session: {
            ...state.session,
            players: nextPlayers,
            pendingTheaterBattleConfirmation,
        },
    };
}
function mergeScopedOperationState(baseState, scopedOperation) {
    const normalizedScopedOperation = ensureOperationHasTheater(scopedOperation);
    if (!normalizedScopedOperation?.theater) {
        return baseState.operation;
    }
    const normalizedBaseOperation = ensureOperationHasTheater(baseState.operation);
    if (!normalizedBaseOperation?.theater) {
        return normalizedScopedOperation;
    }
    const mergedTheaterFloors = {
        ...(normalizedBaseOperation.theaterFloors ?? {}),
        ...(normalizedScopedOperation.theaterFloors ?? {}),
        [normalizedScopedOperation.currentFloorIndex]: cloneTheater(normalizedScopedOperation.theater),
    };
    if (normalizedBaseOperation.theater.definition.id === normalizedScopedOperation.theater.definition.id) {
        return {
            ...normalizedScopedOperation,
            theaterFloors: mergedTheaterFloors,
        };
    }
    return {
        ...normalizedBaseOperation,
        theaterFloors: mergedTheaterFloors,
    };
}
function parseTheaterRuntimeSnapshot(snapshot) {
    if (!snapshot) {
        return null;
    }
    try {
        const parsed = JSON.parse(snapshot);
        return parsed?.definition?.id && parsed?.rooms ? parsed : null;
    }
    catch {
        return null;
    }
}
function mergeTheaterRuntimeState(baseState, scopedState, theaterId) {
    const scopedOperation = ensureOperationHasTheater(scopedState.operation);
    const scopedTheater = scopedOperation?.theater;
    if (!scopedOperation || !scopedTheater || scopedTheater.definition.id !== theaterId) {
        return baseState;
    }
    const baseOperation = ensureOperationHasTheater(baseState.operation);
    const baseActiveTheaterId = baseOperation?.theater?.definition.id ?? null;
    const shouldPromoteOperationContext = baseActiveTheaterId === theaterId;
    const scopedBattle = scopedState.currentBattle;
    const hasScopedBattle = scopedBattle?.theaterMeta?.theaterId === theaterId;
    const scopedBattleId = hasScopedBattle ? scopedBattle?.id ?? null : null;
    const currentContext = baseState.session.activeTheaterContexts[theaterId];
    const nextPendingBattleConfirmation = scopedState.session.pendingTheaterBattleConfirmation ?? null;
    const nextPlayers = { ...baseState.session.players };
    const nextTheaterAssignments = { ...baseState.session.theaterAssignments };
    Object.keys(nextPlayers).forEach((slot) => {
        const currentPlayer = nextPlayers[slot];
        const currentAssignment = nextTheaterAssignments[slot];
        const targetsTheater = currentPlayer?.currentTheaterId === theaterId
            || currentAssignment?.theaterId === theaterId;
        if (!targetsTheater) {
            return;
        }
        const trackedSquadId = currentPlayer?.assignedSquadId ?? currentAssignment?.squadId ?? null;
        const trackedSquad = trackedSquadId
            ? scopedTheater.squads.find((squad) => squad.squadId === trackedSquadId) ?? null
            : null;
        const resolvedRoomId = trackedSquad?.currentRoomId ?? currentAssignment?.roomId ?? scopedTheater.currentRoomId ?? null;
        const trackedBattleId = hasScopedBattle && trackedSquadId && scopedBattle
            && (scopedBattle.theaterBonuses?.squadId === trackedSquadId
                || scopedBattle.theaterMeta?.squadId === trackedSquadId)
            ? scopedBattleId
            : (!hasScopedBattle
                && currentPlayer?.activeBattleId
                && baseState.session.activeBattleContexts[currentPlayer.activeBattleId]?.theaterId === theaterId
                ? null
                : currentPlayer?.activeBattleId ?? null);
        if (currentPlayer) {
            nextPlayers[slot] = {
                ...currentPlayer,
                currentTheaterId: theaterId,
                activeBattleId: trackedBattleId,
                lastSafeRoomId: resolvedRoomId ?? currentPlayer.lastSafeRoomId ?? null,
                stagingState: trackedBattleId ? "battle" : "theater",
            };
        }
        if (currentAssignment) {
            nextTheaterAssignments[slot] = {
                ...currentAssignment,
                theaterId,
                roomId: resolvedRoomId,
                stagingState: trackedBattleId ? "battle" : "theater",
            };
        }
    });
    const nextActiveTheaterContexts = {
        ...baseState.session.activeTheaterContexts,
        ...scopedState.session.activeTheaterContexts,
        [theaterId]: {
            theaterId,
            operationId: scopedOperation.id ?? currentContext?.operationId ?? null,
            snapshot: JSON.stringify(scopedTheater),
            phase: hasScopedBattle ? "battle" : scopedState.phase,
            battleSnapshot: hasScopedBattle
                ? JSON.stringify(scopedBattle)
                : (scopedState.session.activeTheaterContexts?.[theaterId]?.battleSnapshot
                    ?? currentContext?.battleSnapshot
                    ?? null),
            pendingTheaterBattleConfirmation: nextPendingBattleConfirmation,
            updatedAt: Date.now(),
        },
    };
    const nextActiveBattleContexts = {
        ...baseState.session.activeBattleContexts,
        ...scopedState.session.activeBattleContexts,
    };
    if (hasScopedBattle && scopedBattleId) {
        nextActiveBattleContexts[scopedBattleId] = {
            battleId: scopedBattleId,
            theaterId,
            roomId: scopedBattle.theaterMeta?.roomId ?? scopedBattle.roomId ?? null,
            squadId: scopedBattle.theaterBonuses?.squadId
                ?? scopedBattle.theaterMeta?.squadId
                ?? null,
            snapshot: JSON.stringify(scopedBattle),
            phase: scopedBattle.phase ?? null,
            updatedAt: Date.now(),
        };
    }
    return {
        ...scopedState,
        phase: shouldPromoteOperationContext ? scopedState.phase : baseState.phase,
        currentBattle: shouldPromoteOperationContext && hasScopedBattle ? scopedBattle : baseState.currentBattle,
        operation: mergeScopedOperationState(baseState, scopedOperation),
        session: {
            ...baseState.session,
            players: nextPlayers,
            theaterAssignments: nextTheaterAssignments,
            activeTheaterContexts: nextActiveTheaterContexts,
            activeBattleContexts: nextActiveBattleContexts,
            pendingTheaterBattleConfirmation: shouldPromoteOperationContext
                ? nextPendingBattleConfirmation
                : baseState.session.pendingTheaterBattleConfirmation,
            activeBattleId: shouldPromoteOperationContext && hasScopedBattle
                ? (scopedBattle?.id ?? baseState.session.activeBattleId)
                : baseState.session.activeBattleId,
        },
    };
}
function mergeScopedTheaterStateForSessionSlot(baseState, scopedState, slot) {
    if (!slot) {
        return baseState;
    }
    const scopedOperation = ensureOperationHasTheater(scopedState.operation);
    const scopedTheater = scopedOperation?.theater;
    if (!scopedOperation || !scopedTheater) {
        return baseState;
    }
    const scopedTheaterId = scopedTheater.definition.id;
    const scopedBattle = scopedState.currentBattle;
    const hasScopedBattle = scopedBattle?.theaterMeta?.theaterId === scopedTheaterId;
    const scopedBattleId = hasScopedBattle ? scopedBattle?.id ?? null : null;
    const mergedState = mergeTheaterRuntimeState(baseState, scopedState, scopedTheaterId);
    return {
        ...mergedState,
        session: {
            ...mergedState.session,
            players: {
                ...mergedState.session.players,
                [slot]: {
                    ...mergedState.session.players[slot],
                    currentTheaterId: scopedTheaterId,
                    assignedSquadId: scopedTheater.selectedSquadId ?? mergedState.session.players[slot]?.assignedSquadId ?? null,
                    activeBattleId: scopedBattleId,
                    lastSafeRoomId: scopedTheater.currentRoomId ?? mergedState.session.players[slot]?.lastSafeRoomId ?? null,
                    stagingState: hasScopedBattle ? "battle" : "theater",
                },
            },
            theaterAssignments: {
                ...mergedState.session.theaterAssignments,
                [slot]: {
                    ...mergedState.session.theaterAssignments[slot],
                    theaterId: scopedTheaterId,
                    squadId: scopedTheater.selectedSquadId ?? mergedState.session.theaterAssignments[slot]?.squadId ?? null,
                    roomId: scopedTheater.currentRoomId ?? mergedState.session.theaterAssignments[slot]?.roomId ?? null,
                    stagingState: hasScopedBattle ? "battle" : "theater",
                },
            },
        },
    };
}
function selectTheaterSquadForSessionSlot(state, slot, squadId) {
    const scopedState = createScopedTheaterStateForSessionSlot(state, slot);
    if (!scopedState) {
        return { state, success: false, message: "No active theater operation." };
    }
    const outcome = selectTheaterSquad(scopedState, squadId);
    return {
        ...outcome,
        state: mergeScopedTheaterStateForSessionSlot(state, outcome.state, slot),
    };
}
function setTheaterCurrentRoomForSessionSlot(state, slot, roomId) {
    const scopedState = createScopedTheaterStateForSessionSlot(state, slot);
    if (!scopedState) {
        return state;
    }
    return mergeScopedTheaterStateForSessionSlot(state, setTheaterCurrentRoom(scopedState, roomId), slot);
}
function moveToTheaterRoomForSessionSlot(state, slot, roomId) {
    const scopedState = createScopedTheaterStateForSessionSlot(state, slot);
    if (!scopedState) {
        return {
            state,
            roomId,
            squadId: null,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "No active theater operation.",
        };
    }
    const outcome = moveToTheaterRoom(scopedState, roomId);
    return {
        ...outcome,
        state: mergeScopedTheaterStateForSessionSlot(state, outcome.state, slot),
    };
}
function holdPositionInTheaterForSessionSlot(state, slot, ticks = 1) {
    const scopedState = createScopedTheaterStateForSessionSlot(state, slot);
    if (!scopedState) {
        return {
            state,
            roomId: "",
            squadId: null,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "No active theater operation.",
        };
    }
    const outcome = holdPositionInTheater(scopedState, ticks);
    return {
        ...outcome,
        state: mergeScopedTheaterStateForSessionSlot(state, outcome.state, slot),
    };
}
function issueTheaterRoomCommandForSessionSlot(state, slot, roomId) {
    const operation = getPreparedTheaterOperationForSessionSlot(state, slot);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return {
            state,
            roomId,
            squadId: null,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "No active theater operation.",
        };
    }
    const selectedRoom = theater.rooms[roomId];
    const currentRoom = theater.rooms[theater.currentRoomId];
    const currentNodeId = theater.currentNodeId ?? theater.currentRoomId;
    const canHoldPosition = Boolean(currentRoom
        && selectedRoom
        && roomId === currentNodeId
        && selectedRoom.secured
        && !selectedRoom.underThreat
        && !selectedRoom.damaged);
    return canHoldPosition
        ? holdPositionInTheaterForSessionSlot(state, slot, 1)
        : moveToTheaterRoomForSessionSlot(state, slot, roomId);
}
function refuseTheaterDefenseForSessionSlot(state, slot, roomId) {
    const scopedState = createScopedTheaterStateForSessionSlot(state, slot);
    if (!scopedState) {
        return { state, success: false, message: "No active theater operation." };
    }
    const outcome = refuseTheaterDefense(scopedState, roomId);
    return {
        ...outcome,
        state: mergeScopedTheaterStateForSessionSlot(state, outcome.state, slot),
    };
}
function getSelectedSquad(theater) {
    return theater.squads.find((squad) => squad.squadId === theater.selectedSquadId) ?? theater.squads[0] ?? null;
}
function getEmergencyControlSquadId(theater) {
    if (theater.squads.some((squad) => squad.isInContact)) {
        return null;
    }
    const selectedSquadId = theater.selectedSquadId;
    if (selectedSquadId && theater.squads.some((squad) => squad.squadId === selectedSquadId)) {
        return selectedSquadId;
    }
    return theater.squads[0]?.squadId ?? null;
}
function canManuallyControlTheaterSquad(theater, squad) {
    if (!squad) {
        return false;
    }
    if (squad.automationMode !== "manual") {
        return false;
    }
    return squad.isInContact || squad.squadId === getEmergencyControlSquadId(theater);
}
function findSquad(theater, squadId) {
    return theater.squads.find((squad) => squad.squadId === squadId) ?? null;
}
function getNextSquadId(theater) {
    let index = 1;
    const usedIds = new Set(theater.squads.map((squad) => squad.squadId));
    while (usedIds.has(`sq_${index}`)) {
        index += 1;
    }
    return `sq_${index}`;
}
function getNextSquadOrderIndex(theater) {
    return theater.squads.length;
}
function getTheaterPassagePowerRequirement(room, adjacentId) {
    return Math.max(0, Math.ceil((room.powerGateWatts?.[adjacentId] ?? 0) * 0.5));
}
function isTheaterPassagePowered(theater, fromRoomId, toRoomId) {
    const fromRoom = theater.rooms[fromRoomId];
    const toRoom = theater.rooms[toRoomId];
    if (!fromRoom || !toRoom) {
        return false;
    }
    const requirement = Math.max(getTheaterPassagePowerRequirement(fromRoom, toRoomId), getTheaterPassagePowerRequirement(toRoom, fromRoomId));
    if (requirement <= 0) {
        return true;
    }
    return Math.max(fromRoom.powerFlow ?? 0, toRoom.powerFlow ?? 0) >= requirement;
}
function addTheaterEvent(theater, message) {
    return {
        ...theater,
        recentEvents: [message, ...theater.recentEvents].slice(0, 8),
    };
}
const SANDBOX_ROUTE_NOISE_POWER_THRESHOLD = 500;
const SANDBOX_OVERHEAT_POWER_THRESHOLD = 300;
const SANDBOX_HIGH_COMMS_THRESHOLD = 500;
const SANDBOX_HIGH_SUPPLY_THRESHOLD = 500;
const SANDBOX_SIGNAL_BLOOM_BW_THRESHOLD = 700;
const SANDBOX_COLLAPSE_SUPPLY_THRESHOLD = 0;
const SANDBOX_SCAVENGER_THEFT_PER_PRESENCE = 18;
const SANDBOX_EMERGENCY_DUMP_SUPPLY_REDUCTION = 400;
function clampSandboxLevel(value, max) {
    return Math.max(0, Math.min(max, Math.round(value)));
}
function getSandboxSignalPosture(room) {
    return room.sandboxSignalPosture ?? "normal";
}
function getSandboxContainmentMode(room) {
    return room.sandboxContainmentMode ?? "normal";
}
function getSandboxEmergencyDumpTicks(room) {
    return Math.max(0, Number(room.sandboxEmergencyDumpTicks ?? 0));
}
function getSandboxEffectiveSupply(room) {
    const emergencyDumpReduction = getSandboxEmergencyDumpTicks(room) > 0
        ? SANDBOX_EMERGENCY_DUMP_SUPPLY_REDUCTION
        : 0;
    return Math.max(0, room.supplyFlow - emergencyDumpReduction);
}
function getSandboxOverheatSeverity(room) {
    if (room.powerFlow > SANDBOX_ROUTE_NOISE_POWER_THRESHOLD && room.supplyFlow > SANDBOX_HIGH_SUPPLY_THRESHOLD) {
        return 2;
    }
    if (room.powerFlow > SANDBOX_OVERHEAT_POWER_THRESHOLD) {
        return 1;
    }
    return 0;
}
function getSandboxSignalBloom(room) {
    const posture = getSandboxSignalPosture(room);
    if (posture === "masked") {
        return false;
    }
    return room.commsFlow > SANDBOX_SIGNAL_BLOOM_BW_THRESHOLD || (posture === "bait" && room.commsFlow > 250);
}
function getSandboxCommsAttraction(room) {
    const posture = getSandboxSignalPosture(room);
    const postureModifier = posture === "masked" ? -2 : posture === "bait" ? 3 : 0;
    const baseAttraction = room.commsFlow <= SANDBOX_HIGH_COMMS_THRESHOLD
        ? 0
        : Math.max(1, Math.ceil((room.commsFlow - SANDBOX_HIGH_COMMS_THRESHOLD) / 100));
    const bloomModifier = getSandboxSignalBloom(room) ? 1 : 0;
    return Math.max(0, baseAttraction + postureModifier + bloomModifier);
}
function getSandboxScavengerPressure(room) {
    const effectiveSupply = getSandboxEffectiveSupply(room);
    if (effectiveSupply <= SANDBOX_HIGH_SUPPLY_THRESHOLD) {
        return 0;
    }
    return Math.max(1, Math.ceil((effectiveSupply - SANDBOX_HIGH_SUPPLY_THRESHOLD) / 100));
}
function getSandboxEnemyPresenceByRoom(theater) {
    const presence = new Map();
    theater.activeThreats
        .filter((threat) => threat.active)
        .forEach((threat) => {
        const touchedRooms = new Set([
            threat.currentRoomId,
            threat.targetRoomId,
            ...threat.route,
        ]);
        touchedRooms.forEach((roomId) => {
            presence.set(roomId, (presence.get(roomId) ?? 0) + 1);
        });
    });
    return presence;
}
function getSandboxOpenAdjacentRooms(theater, roomId) {
    const room = theater.rooms[roomId];
    if (!room) {
        return [];
    }
    return room.adjacency
        .filter((adjacentId) => (0, theaterAutomation_1.canTraverseTheaterEdge)(theater, roomId, adjacentId))
        .map((adjacentId) => theater.rooms[adjacentId])
        .filter((adjacent) => Boolean(adjacent));
}
function getSandboxGuardingSquadCount(theater, roomId) {
    return theater.squads.filter((squad) => {
        const squadNodeId = squad.currentNodeId ?? squad.currentRoomId;
        return (0, theaterAutomation_1.getTheaterRootRoomIdForNode)(theater, squadNodeId) === roomId;
    }).length;
}
function getSandboxSupplyFireRisk(room) {
    return room.powerFlow > SANDBOX_ROUTE_NOISE_POWER_THRESHOLD && getSandboxEffectiveSupply(room) > SANDBOX_HIGH_SUPPLY_THRESHOLD;
}
function getSandboxHeatValue(theater, room, previousTheater) {
    const previousRoom = previousTheater?.rooms[room.id];
    const openAdjacentRooms = getSandboxOpenAdjacentRooms(theater, room.id);
    const containmentMode = getSandboxContainmentMode(room);
    const ventBonus = containmentMode === "venting" ? 2 : 0;
    const containedLoad = containmentMode === "lockdown" ? 1 : 0;
    const previousBurnSeverity = previousRoom?.sandboxBurnSeverity ?? 0;
    const baseHeat = (getSandboxOverheatSeverity(room) * 2)
        + (getSandboxSupplyFireRisk(room) ? 1 : 0)
        + Math.min(2, previousBurnSeverity)
        + containedLoad;
    const previousHeat = Math.max(0, (previousRoom?.sandboxHeatValue ?? 0) - (openAdjacentRooms.length >= 2 ? 2 : 1) - ventBonus);
    const neighborHeat = openAdjacentRooms.reduce((total, adjacent) => {
        const adjacentPrevious = previousTheater?.rooms[adjacent.id];
        const adjacentHeat = adjacentPrevious?.sandboxHeatValue ?? (getSandboxOverheatSeverity(adjacent) * 2);
        return total + (adjacentHeat >= 2 ? 1 : 0);
    }, 0);
    const venting = baseHeat > 0
        ? Math.max(0, openAdjacentRooms.length - 2)
        : Math.max(0, openAdjacentRooms.length - 1);
    return clampSandboxLevel(Math.max(baseHeat, previousHeat, baseHeat + neighborHeat - venting - ventBonus), 5);
}
function getSandboxSmokeValue(theater, room, previousTheater) {
    const previousRoom = previousTheater?.rooms[room.id];
    const openAdjacentRooms = getSandboxOpenAdjacentRooms(theater, room.id);
    const containmentMode = getSandboxContainmentMode(room);
    const ventBonus = containmentMode === "venting" ? 1 : 0;
    const previousSmoke = Math.max(0, (previousRoom?.sandboxSmokeValue ?? 0) - 1 - ventBonus);
    const neighborSmoke = openAdjacentRooms.reduce((total, adjacent) => {
        const adjacentPrevious = previousTheater?.rooms[adjacent.id];
        return total + ((adjacentPrevious?.sandboxSmokeValue ?? 0) > 0 ? 1 : 0);
    }, 0);
    const industrialSmoke = room.damaged && (roomHasOperationalCoreType(room, "refinery") || roomHasOperationalCoreType(room, "generator"))
        ? 1
        : 0;
    const containedLoad = (openAdjacentRooms.length <= 1 || containmentMode === "lockdown") && (room.sandboxHeatValue ?? 0) >= 2 ? 1 : 0;
    const previousBurnSeverity = previousRoom?.sandboxBurnSeverity ?? 0;
    const baseSmoke = (room.sandboxSupplyFireRisk ? 2 : ((room.sandboxHeatValue ?? 0) >= 3 ? 1 : 0))
        + industrialSmoke
        + containedLoad
        + previousBurnSeverity;
    const venting = Math.max(0, openAdjacentRooms.length - 1) + ventBonus;
    return clampSandboxLevel(Math.max(baseSmoke, previousSmoke, baseSmoke + neighborSmoke - venting), 4);
}
function getSandboxBurnSeverity(room, previousRoom, advanceDynamics = false) {
    const previousBurnSeverity = previousRoom?.sandboxBurnSeverity ?? 0;
    const heatValue = room.sandboxHeatValue ?? 0;
    const smokeValue = room.sandboxSmokeValue ?? 0;
    const containmentMode = getSandboxContainmentMode(room);
    let desiredBurnSeverity = 0;
    if (room.sandboxSupplyFireRisk && heatValue >= 4 && smokeValue >= 2) {
        desiredBurnSeverity = 1;
    }
    if (room.sandboxSupplyFireRisk && heatValue >= 5 && smokeValue >= 2) {
        desiredBurnSeverity = 2;
    }
    if (room.sandboxSupplyFireRisk && heatValue >= 5 && smokeValue >= 3) {
        desiredBurnSeverity = 3;
    }
    if (containmentMode === "venting") {
        desiredBurnSeverity = Math.max(0, desiredBurnSeverity - 1);
    }
    if (getSandboxEmergencyDumpTicks(room) > 0) {
        desiredBurnSeverity = Math.max(0, desiredBurnSeverity - 1);
    }
    if (!advanceDynamics) {
        return Math.max(room.sandboxBurnSeverity ?? previousBurnSeverity, desiredBurnSeverity);
    }
    if (desiredBurnSeverity > previousBurnSeverity) {
        return Math.min(3, previousBurnSeverity + 1);
    }
    if (desiredBurnSeverity < previousBurnSeverity) {
        return Math.max(0, previousBurnSeverity - 1);
    }
    return previousBurnSeverity;
}
function getSandboxScavengerMigrationTarget(theater, fromRoomId) {
    const candidates = Object.values(theater.rooms)
        .filter((room) => room.id !== fromRoomId && room.secured && (room.sandboxScavengerPressure ?? 0) > 0)
        .map((room) => ({
        room,
        distance: getRoomDistance(theater, fromRoomId, room.id),
        guarded: getSandboxGuardingSquadCount(theater, room.id),
    }))
        .filter((candidate) => Number.isFinite(candidate.distance));
    if (candidates.length <= 0) {
        return null;
    }
    candidates.sort((left, right) => ((right.room.sandboxScavengerPressure ?? 0) - (left.room.sandboxScavengerPressure ?? 0)
        || left.guarded - right.guarded
        || left.distance - right.distance
        || left.room.id.localeCompare(right.room.id)));
    return candidates[0]?.room ?? null;
}
function getSandboxScavengerActivity(theater, room) {
    const presence = room.sandboxScavengerPresence ?? 0;
    if (presence <= 0) {
        return "quiet";
    }
    if (getSandboxGuardingSquadCount(theater, room.id) > 0) {
        return "probing";
    }
    return presence >= 2 || (room.sandboxScavengerPressure ?? 0) >= 2 ? "raiding" : "probing";
}
function getSandboxPhantomRouteTargets(theater, room) {
    if (!room.sandboxRouteNoise) {
        return [];
    }
    const realThreatEndpointIds = new Set();
    theater.activeThreats
        .filter((threat) => threat.active)
        .forEach((threat) => {
        realThreatEndpointIds.add(threat.currentRoomId);
        realThreatEndpointIds.add(threat.targetRoomId);
    });
    const desiredCount = (getSandboxOverheatSeverity(room) >= 2 || room.sandboxSignalBloom) ? 2 : 1;
    const candidates = Object.values(theater.rooms)
        .filter((candidate) => candidate.id !== room.id)
        .map((candidate) => ({
        room: candidate,
        distance: getRoomDistance(theater, room.id, candidate.id),
    }))
        .filter((candidate) => Number.isFinite(candidate.distance) && candidate.distance > 0)
        .sort((left, right) => (left.distance - right.distance
        || left.room.depthFromUplink - right.room.depthFromUplink
        || left.room.id.localeCompare(right.room.id)));
    const preferred = candidates
        .filter((candidate) => !realThreatEndpointIds.has(candidate.room.id))
        .slice(0, desiredCount);
    const fallback = preferred.length >= desiredCount
        ? preferred
        : [
            ...preferred,
            ...candidates.filter((candidate) => !preferred.some((picked) => picked.room.id === candidate.room.id)),
        ].slice(0, desiredCount);
    return fallback.map((candidate) => candidate.room.id);
}
function applySandboxScavengerMigration(theater) {
    const moves = [];
    const sourceRooms = Object.values(theater.rooms)
        .filter((room) => (room.sandboxScavengerPresence ?? 0) > 0 && (room.sandboxScavengerPressure ?? 0) <= 0)
        .sort((left, right) => ((right.sandboxScavengerPresence ?? 0) - (left.sandboxScavengerPresence ?? 0)
        || left.id.localeCompare(right.id)));
    sourceRooms.forEach((room) => {
        const targetRoom = getSandboxScavengerMigrationTarget(theater, room.id);
        if (!targetRoom || targetRoom.id === room.id) {
            return;
        }
        room.sandboxScavengerPresence = Math.max(0, (room.sandboxScavengerPresence ?? 0) - 1);
        targetRoom.sandboxScavengerPresence = Math.min(3, (targetRoom.sandboxScavengerPresence ?? 0) + 1);
        moves.push({ fromRoomId: room.id, toRoomId: targetRoom.id });
    });
    return moves;
}
function applySandboxRoomDerivedState(theater, previousTheater, advanceDynamics = false) {
    const priorTheater = previousTheater ?? theater;
    const threatPresenceByRoom = getSandboxEnemyPresenceByRoom(theater);
    Object.values(theater.rooms).forEach((room) => {
        const previousRoom = priorTheater.rooms[room.id];
        const containmentMode = room.sandboxContainmentMode ?? previousRoom?.sandboxContainmentMode ?? "normal";
        const previousEmergencyDumpTicks = previousRoom?.sandboxEmergencyDumpTicks ?? room.sandboxEmergencyDumpTicks ?? 0;
        const emergencyDumpTicks = advanceDynamics
            ? Math.max(0, previousEmergencyDumpTicks - 1)
            : Math.max(0, room.sandboxEmergencyDumpTicks ?? previousEmergencyDumpTicks);
        const overheatSeverity = getSandboxOverheatSeverity(room);
        const signalBloom = getSandboxSignalBloom(room);
        const previousPresence = previousRoom?.sandboxScavengerPresence ?? room.sandboxScavengerPresence ?? 0;
        const guardedSquads = getSandboxGuardingSquadCount(theater, room.id);
        const scavengerPressure = getSandboxScavengerPressure(room);
        const desiredScavengerPresence = room.secured && !room.underThreat && scavengerPressure > 0
            ? Math.min(3, scavengerPressure + (guardedSquads > 0 ? 0 : 1))
            : 0;
        const scavengerPresence = advanceDynamics
            ? desiredScavengerPresence > previousPresence
                ? Math.min(3, previousPresence + 1)
                : desiredScavengerPresence < previousPresence
                    ? Math.max(0, previousPresence - 1)
                    : previousPresence
            : Math.max(0, room.sandboxScavengerPresence ?? previousPresence);
        room.sandboxContainmentMode = containmentMode;
        room.sandboxEmergencyDumpTicks = emergencyDumpTicks;
        room.sandboxOverheatSeverity = overheatSeverity;
        room.sandboxOverheating = overheatSeverity > 0;
        room.sandboxSignalBloom = signalBloom;
        room.sandboxRouteNoise = room.powerFlow > SANDBOX_ROUTE_NOISE_POWER_THRESHOLD || signalBloom;
        room.sandboxCommsAttraction = getSandboxCommsAttraction(room);
        room.sandboxScavengerPressure = scavengerPressure;
        room.sandboxScavengerPresence = scavengerPresence;
        room.sandboxEnemyPresence = threatPresenceByRoom.get(room.id) ?? 0;
        room.sandboxMigrationAnchorRoomId = null;
        room.sandboxPhantomRouteRoomIds = [];
        room.sandboxSupplyFireRisk = getSandboxSupplyFireRisk(room);
        room.sandboxHeatValue = 0;
        room.sandboxSmokeValue = 0;
        room.sandboxBurning = false;
        room.sandboxBurnSeverity = 0;
        room.sandboxStructuralStress = Math.max(0, room.sandboxStructuralStress ?? previousRoom?.sandboxStructuralStress ?? 0);
        room.sandboxExtractionEfficiency = getSandboxRoomExtractionEfficiency(room);
    });
    Object.values(theater.rooms).forEach((room) => {
        room.sandboxHeatValue = advanceDynamics
            ? getSandboxHeatValue(theater, room, priorTheater)
            : Math.max(room.sandboxHeatValue ?? 0, (room.sandboxOverheatSeverity ?? 0) * 2, room.sandboxSupplyFireRisk ? 1 : 0);
    });
    Object.values(theater.rooms).forEach((room) => {
        room.sandboxSmokeValue = advanceDynamics
            ? getSandboxSmokeValue(theater, room, priorTheater)
            : Math.max(room.sandboxSmokeValue ?? 0, room.sandboxSupplyFireRisk ? 2 : 0);
    });
    Object.values(theater.rooms).forEach((room) => {
        const previousRoom = priorTheater.rooms[room.id];
        const burnSeverity = getSandboxBurnSeverity(room, previousRoom, advanceDynamics);
        const annexLoad = Object.values(theater.annexesById ?? {}).filter((annex) => annex.parentRoomId === room.id).length;
        const previousStress = previousRoom?.sandboxStructuralStress ?? 0;
        const desiredStress = burnSeverity > 0
            ? Math.min(6, burnSeverity + ((room.sandboxHeatValue ?? 0) >= 4 ? 1 : 0) + (annexLoad > 0 ? 1 : 0))
            : (room.sandboxHeatValue ?? 0) >= 3
                ? Math.min(3, 1 + (annexLoad > 1 ? 1 : 0))
                : 0;
        const structuralStress = advanceDynamics
            ? desiredStress > previousStress
                ? Math.min(6, previousStress + 1)
                : desiredStress < previousStress
                    ? Math.max(0, previousStress - 1)
                    : previousStress
            : Math.max(room.sandboxStructuralStress ?? previousStress, desiredStress);
        room.sandboxBurnSeverity = burnSeverity;
        room.sandboxBurning = burnSeverity > 0;
        room.sandboxStructuralStress = structuralStress;
        room.sandboxScavengerActivity = getSandboxScavengerActivity(theater, room);
        room.sandboxPhantomRouteRoomIds = room.sandboxRouteNoise
            ? getSandboxPhantomRouteTargets(theater, room)
            : [];
    });
    return theater;
}
function collapseAnnexBranchInTheater(theater, annexId) {
    const annex = theater.annexesById?.[annexId];
    if (!annex) {
        return [];
    }
    const removedAnnexIds = [annexId, ...collectAnnexBranchIds(theater, annexId)];
    const automation = theater.automation ?? (0, theaterAutomation_1.createEmptyTheaterAutomationState)();
    removedAnnexIds.forEach((removedId) => {
        const removedAnnex = theater.annexesById?.[removedId];
        if (!removedAnnex) {
            return;
        }
        removedAnnex.moduleSlots.forEach((moduleId) => {
            if (!moduleId) {
                return;
            }
            delete automation.moduleInstancesById[moduleId];
            delete automation.moduleRuntimeById[moduleId];
        });
        delete theater.annexesById?.[removedId];
    });
    theater.squads = theater.squads.map((squad) => (removedAnnexIds.includes(squad.currentNodeId ?? squad.currentRoomId)
        ? {
            ...squad,
            currentNodeId: annex.parentNodeId,
            currentRoomId: annex.parentRoomId,
            automationMode: "manual",
            autoStatus: "idle",
            autoTargetRoomId: null,
        }
        : squad));
    if (removedAnnexIds.includes(theater.currentNodeId ?? theater.currentRoomId)) {
        theater.currentNodeId = annex.parentNodeId;
        theater.currentRoomId = annex.parentRoomId;
    }
    if (removedAnnexIds.includes(theater.selectedNodeId ?? theater.selectedRoomId)) {
        theater.selectedNodeId = annex.parentNodeId;
        theater.selectedRoomId = annex.parentRoomId;
    }
    return removedAnnexIds;
}
function applySandboxStructuralDamage(theater, emitEvents = false) {
    let next = theater;
    Object.values(next.rooms).forEach((room) => {
        if ((room.sandboxStructuralStress ?? 0) >= 4 && !room.damaged) {
            room.damaged = true;
            if (emitEvents) {
                next = addTheaterEvent(next, `Structural stress compromised room(${room.id})`);
            }
        }
        if ((room.sandboxBurnSeverity ?? 0) < 2 || next.tickCount % 3 !== 0) {
            return;
        }
        const directChildAnnex = Object.values(next.annexesById ?? {})
            .filter((annex) => annex.parentRoomId === room.id)
            .sort((left, right) => left.annexId.localeCompare(right.annexId))[0];
        if (!directChildAnnex) {
            return;
        }
        directChildAnnex.integrity = Math.max(0, directChildAnnex.integrity - 1);
        const annexLabel = foundrySystem_1.ANNEX_FRAME_DEFINITIONS[directChildAnnex.frameType]?.displayName ?? directChildAnnex.annexId;
        if (emitEvents) {
            next = addTheaterEvent(next, `Annex(${directChildAnnex.annexId}) lost integrity under room fire in room(${room.id})`);
        }
        if (directChildAnnex.integrity > 0) {
            return;
        }
        const removedAnnexIds = collapseAnnexBranchInTheater(next, directChildAnnex.annexId);
        if (emitEvents && removedAnnexIds.length > 0) {
            next = addTheaterEvent(next, `Annex(${directChildAnnex.annexId}) collapsed from thermal stress in room(${room.id})`);
        }
        if (removedAnnexIds.includes(next.currentNodeId ?? next.currentRoomId)) {
            next.currentNodeId = room.id;
            next.currentRoomId = room.id;
        }
        if (removedAnnexIds.includes(next.selectedNodeId ?? next.selectedRoomId)) {
            next.selectedNodeId = room.id;
            next.selectedRoomId = room.id;
        }
    });
    return next;
}
function appendSandboxThresholdEvents(theater, previousTheater, scavengerMoves) {
    let next = theater;
    Object.values(next.rooms).forEach((room) => {
        const previousRoom = previousTheater?.rooms[room.id];
        const previousOverheatSeverity = previousRoom?.sandboxOverheatSeverity ?? 0;
        const currentOverheatSeverity = room.sandboxOverheatSeverity ?? 0;
        const previousRouteNoise = previousRoom?.sandboxRouteNoise ?? false;
        const currentRouteNoise = room.sandboxRouteNoise ?? false;
        const previousCommsAttraction = previousRoom?.sandboxCommsAttraction ?? 0;
        const currentCommsAttraction = room.sandboxCommsAttraction ?? 0;
        const previousSmokeValue = previousRoom?.sandboxSmokeValue ?? 0;
        const currentSmokeValue = room.sandboxSmokeValue ?? 0;
        const previousBurnSeverity = previousRoom?.sandboxBurnSeverity ?? 0;
        const currentBurnSeverity = room.sandboxBurnSeverity ?? 0;
        const previousSignalBloom = previousRoom?.sandboxSignalBloom ?? false;
        const currentSignalBloom = room.sandboxSignalBloom ?? false;
        const previousSupplyFireRisk = previousRoom?.sandboxSupplyFireRisk ?? false;
        const currentSupplyFireRisk = room.sandboxSupplyFireRisk ?? false;
        const previousStructuralStress = previousRoom?.sandboxStructuralStress ?? 0;
        const currentStructuralStress = room.sandboxStructuralStress ?? 0;
        const previousScavengerPresence = previousRoom?.sandboxScavengerPresence ?? 0;
        const currentScavengerPresence = room.sandboxScavengerPresence ?? 0;
        const previousScavengerActivity = previousRoom?.sandboxScavengerActivity ?? "quiet";
        const currentScavengerActivity = room.sandboxScavengerActivity ?? "quiet";
        if (currentOverheatSeverity > 0 && previousOverheatSeverity <= 0) {
            next = addTheaterEvent(next, `Overheat detected in room(${room.id})`);
        }
        if (currentOverheatSeverity > previousOverheatSeverity && currentOverheatSeverity > 1) {
            next = addTheaterEvent(next, `Room(${room.id}) overheating severity increased`);
        }
        if (currentRouteNoise && !previousRouteNoise) {
            next = addTheaterEvent(next, `Route telemetry in room(${room.id}) compromised by excess power`);
        }
        if (currentCommsAttraction > 0 && previousCommsAttraction <= 0) {
            next = addTheaterEvent(next, `High comms signature in room(${room.id}) is attracting enemy attention`);
        }
        if (currentSignalBloom && !previousSignalBloom) {
            next = addTheaterEvent(next, `Signal bloom in room(${room.id}) is leaking false telemetry`);
        }
        if (currentSmokeValue > 0 && previousSmokeValue <= 0) {
            next = addTheaterEvent(next, `Smoke buildup detected in room(${room.id})`);
        }
        if (currentSupplyFireRisk && !previousSupplyFireRisk) {
            next = addTheaterEvent(next, `Supply fire risk rising in room(${room.id})`);
        }
        if (currentBurnSeverity > 0 && previousBurnSeverity <= 0) {
            next = addTheaterEvent(next, `Ignition in room(${room.id})`);
        }
        if (currentBurnSeverity > previousBurnSeverity && currentBurnSeverity > 1) {
            next = addTheaterEvent(next, `Room(${room.id}) fire intensity increased`);
        }
        if (currentStructuralStress >= 3 && previousStructuralStress < 3) {
            next = addTheaterEvent(next, `Structural stress rising in room(${room.id})`);
        }
        if (currentScavengerPresence > 0 && previousScavengerPresence <= 0) {
            next = addTheaterEvent(next, `Scavenger activity rising in room(${room.id})`);
        }
        if (currentScavengerActivity === "raiding" && previousScavengerActivity !== "raiding") {
            next = addTheaterEvent(next, `Scavenger raiders reached room(${room.id})`);
        }
    });
    scavengerMoves.forEach(({ fromRoomId, toRoomId }) => {
        next = addTheaterEvent(next, `Scavenger bands shifted from room(${fromRoomId}) to room(${toRoomId})`);
    });
    return next;
}
function getSandboxMigrationAnchorRoom(theater, starvingRoomId) {
    const candidates = Object.values(theater.rooms)
        .filter((room) => room.id !== starvingRoomId && room.secured && room.supplyFlow > SANDBOX_COLLAPSE_SUPPLY_THRESHOLD)
        .map((room) => ({
        room,
        distance: getRoomDistance(theater, starvingRoomId, room.id),
    }))
        .filter((candidate) => Number.isFinite(candidate.distance));
    if (candidates.length <= 0) {
        return null;
    }
    candidates.sort((left, right) => (right.room.supplyFlow - left.room.supplyFlow
        || left.distance - right.distance
        || left.room.id.localeCompare(right.room.id)));
    return candidates[0]?.room ?? null;
}
function applySandboxMigrationAnchors(theater) {
    Object.values(theater.rooms).forEach((room) => {
        room.sandboxMigrationAnchorRoomId = null;
    });
    Object.values(theater.rooms).forEach((room) => {
        if ((room.sandboxEnemyPresence ?? 0) <= 0 || room.supplyFlow > SANDBOX_COLLAPSE_SUPPLY_THRESHOLD) {
            return;
        }
        room.sandboxMigrationAnchorRoomId = getSandboxMigrationAnchorRoom(theater, room.id)?.id ?? null;
    });
    return theater;
}
function applySandboxCollapseInward(theater) {
    let next = theater;
    const starvingRooms = Object.values(next.rooms)
        .filter((room) => (room.sandboxEnemyPresence ?? 0) > 0 && room.supplyFlow <= SANDBOX_COLLAPSE_SUPPLY_THRESHOLD)
        .sort((left, right) => ((right.sandboxEnemyPresence ?? 0) - (left.sandboxEnemyPresence ?? 0)
        || left.id.localeCompare(right.id)));
    starvingRooms.forEach((room) => {
        const anchorRoom = getSandboxMigrationAnchorRoom(next, room.id);
        if (!anchorRoom) {
            return;
        }
        const threat = next.activeThreats.find((candidate) => (candidate.active
            && (candidate.currentRoomId === room.id
                || candidate.targetRoomId === room.id
                || candidate.route.includes(room.id))));
        if (!threat) {
            return;
        }
        if (threat.targetRoomId === anchorRoom.id) {
            room.sandboxMigrationAnchorRoomId = anchorRoom.id;
            return;
        }
        const route = findAnyTheaterRoute(next, threat.currentRoomId, anchorRoom.id);
        if (!route || route.length <= 0) {
            room.sandboxMigrationAnchorRoomId = anchorRoom.id;
            return;
        }
        threat.targetRoomId = anchorRoom.id;
        threat.route = route;
        threat.routeIndex = 0;
        threat.roomId = threat.currentRoomId;
        threat.etaTick = next.tickCount + Math.max(1, route.length - 1);
        room.sandboxMigrationAnchorRoomId = anchorRoom.id;
        console.log("[THEATER] sandbox enemy migration", room.id, anchorRoom.id, threat.id);
        next = addTheaterEvent(next, "Supply starvation triggered enemy migration");
        next = addTheaterEvent(next, `Enemy presence collapsed inward from room(${room.id}) to room(${anchorRoom.id})`);
    });
    return next;
}
function applySandboxScavengerRaids(theater, emitEvents = false) {
    let next = theater;
    Object.values(next.rooms).forEach((room) => {
        const presence = room.sandboxScavengerPresence ?? 0;
        if ((room.sandboxScavengerActivity ?? "quiet") !== "raiding" || presence <= 0) {
            return;
        }
        if (getSandboxGuardingSquadCount(next, room.id) > 0) {
            return;
        }
        const theftAmount = Math.min(room.supplyFlow, presence * SANDBOX_SCAVENGER_THEFT_PER_PRESENCE);
        if (theftAmount > 0) {
            room.supplyFlow = Math.max(0, room.supplyFlow - theftAmount);
            if (emitEvents && next.tickCount % 2 === 0) {
                next = addTheaterEvent(next, `Scavengers skimmed ${theftAmount} crates in room(${room.id})`);
            }
        }
        const naturalStock = (0, schemaSystem_1.normalizeTheaterRoomNaturalStock)(room, room.naturalResourceStock, room.naturalResourceStockMax);
        const nextStock = { ...naturalStock.current };
        nextStock.metalScrap = Math.max(0, nextStock.metalScrap - (presence * 4));
        nextStock.wood = Math.max(0, nextStock.wood - (presence * 4));
        nextStock.steamComponents = Math.max(0, nextStock.steamComponents - (presence * 3));
        room.naturalResourceStock = nextStock;
        room.naturalResourceStockMax = naturalStock.max;
    });
    return next;
}
function applySandboxSlice(theater, previousTheater, emitEvents = false) {
    let next = applySandboxRoomDerivedState(theater, previousTheater, emitEvents);
    const scavengerMoves = emitEvents ? applySandboxScavengerMigration(next) : [];
    next = applySandboxRoomDerivedState(next, previousTheater, emitEvents);
    if (emitEvents) {
        next = applySandboxStructuralDamage(next, true);
        next = appendSandboxThresholdEvents(next, previousTheater, scavengerMoves);
        next = applySandboxScavengerRaids(next, true);
        next = applySandboxCollapseInward(next);
        next = applySandboxRoomDerivedState(next, previousTheater, true);
    }
    return applySandboxMigrationAnchors(next);
}
function cloneCoreAssignment(assignment) {
    if (!assignment) {
        return null;
    }
    return {
        ...assignment,
        buildCost: { ...assignment.buildCost },
        upkeepPerTick: { ...assignment.upkeepPerTick },
        incomePerTick: { ...assignment.incomePerTick },
    };
}
function ensureRoomCoreSlots(room) {
    const desiredSize = Math.max(1, room.coreSlotCapacity ?? room.coreSlots?.length ?? (room.coreAssignment ? 1 : 1));
    const baseSlots = room.coreSlots && room.coreSlots.length > 0
        ? room.coreSlots.map((assignment) => cloneCoreAssignment(assignment))
        : [cloneCoreAssignment(room.coreAssignment)];
    while (baseSlots.length < desiredSize) {
        baseSlots.push(null);
    }
    return baseSlots.slice(0, desiredSize);
}
function syncRoomPrimaryCoreAssignment(room) {
    room.coreSlots = ensureRoomCoreSlots(room);
    room.coreSlotCapacity = Math.max(1, room.coreSlotCapacity ?? room.coreSlots.length);
    room.coreAssignment = room.coreSlots.find((assignment) => assignment !== null) ?? null;
    room.roomClass = room.roomClass ?? "standard";
    return room;
}
function getRoomCoreAssignments(room) {
    if (!room) {
        return [];
    }
    return ensureRoomCoreSlots(room).filter((assignment) => assignment !== null);
}
function getRoomOperationalCoreAssignments(room) {
    if (!room || !room.secured || room.damaged) {
        return [];
    }
    return getRoomCoreAssignments(room).filter((assignment) => {
        const requirements = getCoreOperationalRequirements(assignment.type);
        return (room.supplyFlow >= requirements.supplyCrates
            && room.powerFlow >= requirements.powerWatts
            && room.commsFlow >= requirements.commsBw);
    });
}
function roomHasAnyCore(room) {
    return getRoomCoreAssignments(room).length > 0;
}
function roomHasCoreType(room, coreType) {
    return getRoomCoreAssignments(room).some((assignment) => assignment.type === coreType);
}
function roomHasOperationalCoreType(room, coreType) {
    return getRoomOperationalCoreAssignments(room).some((assignment) => assignment.type === coreType);
}
function getRoomPrimaryCoreAssignmentByType(room, coreType) {
    return getRoomCoreAssignments(room).find((assignment) => assignment.type === coreType) ?? null;
}
function getRoomPrimaryCoreAssignment(room) {
    return getRoomCoreAssignments(room)[0] ?? null;
}
function clearRoomCoreAssignments(room) {
    room.coreSlots = ensureRoomCoreSlots(room).map(() => null);
    syncRoomPrimaryCoreAssignment(room);
}
function collectAnnexBranchIds(theater, parentNodeId) {
    const annexesById = theater.annexesById ?? {};
    const childIds = Object.values(annexesById)
        .filter((annex) => annex.parentNodeId === parentNodeId)
        .map((annex) => annex.annexId);
    return childIds.flatMap((childId) => [childId, ...collectAnnexBranchIds(theater, childId)]);
}
function removeAnnexBranch(theater, parentNodeId) {
    const annexesById = theater.annexesById ?? {};
    const automation = theater.automation ?? (0, theaterAutomation_1.createEmptyTheaterAutomationState)();
    const childIds = Object.values(annexesById)
        .filter((annex) => annex.parentNodeId === parentNodeId)
        .map((annex) => annex.annexId);
    childIds.forEach((childId) => {
        removeAnnexBranch(theater, childId);
        const childAnnex = annexesById[childId];
        if (!childAnnex) {
            return;
        }
        childAnnex.moduleSlots.forEach((moduleId) => {
            if (moduleId) {
                delete automation.moduleInstancesById[moduleId];
                delete automation.moduleRuntimeById[moduleId];
            }
        });
        delete annexesById[childId];
    });
}
function isUnitOperationIncapacitated(unit, operationId, theaterId) {
    if (!unit?.operationInjury) {
        return false;
    }
    return unit.operationInjury.operationId === operationId
        && (!theaterId || unit.operationInjury.theaterId === theaterId);
}
function getSquadCombatReadyUnitIds(state, operationId, theaterId, squad) {
    return squad.unitIds.filter((unitId) => !isUnitOperationIncapacitated(state.unitsById[unitId], operationId, theaterId));
}
function getSquadIncapacitatedUnitIds(state, operationId, theaterId, squad) {
    return squad.unitIds.filter((unitId) => isUnitOperationIncapacitated(state.unitsById[unitId], operationId, theaterId));
}
function getCoreOperationalRequirements(coreType) {
    const definition = coreType ? exports.THEATER_CORE_BLUEPRINTS[coreType] : null;
    return {
        powerWatts: definition?.operationalRequirements?.powerWatts ?? CORE_POWER_REQUIREMENT,
        commsBw: definition?.operationalRequirements?.commsBw ?? CORE_COMMS_REQUIREMENT,
        supplyCrates: definition?.operationalRequirements?.supplyCrates ?? CORE_SUPPLY_REQUIREMENT,
    };
}
function getRoomCoreOperationalRequirements(room) {
    return getCoreOperationalRequirements(getRoomPrimaryCoreAssignment(room)?.type);
}
function resolveCoreNetworkOutput(configuredAmount, configuredMode, incomingAmount, fallbackAmount) {
    const baseAmount = configuredAmount ?? fallbackAmount;
    return configuredMode === "add_input"
        ? Math.max(0, incomingAmount) + baseAmount
        : baseAmount;
}
function getCorePowerOutputWatts(room, incomingWatts) {
    const generatorAssignment = getRoomPrimaryCoreAssignmentByType(room, "generator");
    const definition = generatorAssignment?.type ? exports.THEATER_CORE_BLUEPRINTS[generatorAssignment.type] : null;
    return resolveCoreNetworkOutput(definition?.powerOutputWatts, definition?.powerOutputMode, incomingWatts, POWER_SOURCE_WATTS_PER_TICK);
}
function getCoreCommsOutputBw(room, incomingBandwidth) {
    const commandAssignment = getRoomPrimaryCoreAssignmentByType(room, "command_center");
    const definition = commandAssignment?.type ? exports.THEATER_CORE_BLUEPRINTS[commandAssignment.type] : null;
    return resolveCoreNetworkOutput(definition?.commsOutputBw, definition?.commsOutputMode, incomingBandwidth, COMMS_SOURCE_BANDWIDTH_PER_TICK);
}
function getCoreSupplyOutputCrates(room, incomingCrates) {
    const supplyAssignment = getRoomPrimaryCoreAssignmentByType(room, "supply_depot");
    const definition = supplyAssignment?.type ? exports.THEATER_CORE_BLUEPRINTS[supplyAssignment.type] : null;
    return resolveCoreNetworkOutput(definition?.supplyOutputCrates, definition?.supplyOutputMode, incomingCrates, SUPPLY_SOURCE_CRATES_PER_TICK);
}
function roomCanCarryPower(room) {
    return room.isPowerSource === true
        || roomHasCoreType(room, "generator")
        || room.fortificationPips.powerRail > 0;
}
function getSupplyTraversalDecay(currentRoom, adjacentRoom) {
    return currentRoom.fortificationPips.waystation > 0 || adjacentRoom.fortificationPips.waystation > 0
        ? 0
        : SUPPLY_FALLOFF_PER_ROOM;
}
function roomHasOperationalCore(room) {
    return getRoomOperationalCoreAssignments(room).length > 0;
}
function getCoreOfflineReason(room) {
    if (!roomHasAnyCore(room)) {
        return null;
    }
    if (!room.secured) {
        return "low_supply";
    }
    if (room.damaged) {
        return "damaged";
    }
    const requirements = getRoomCoreAssignments(room).reduce((maxima, assignment) => {
        const nextRequirements = getCoreOperationalRequirements(assignment.type);
        return {
            powerWatts: Math.max(maxima.powerWatts, nextRequirements.powerWatts),
            commsBw: Math.max(maxima.commsBw, nextRequirements.commsBw),
            supplyCrates: Math.max(maxima.supplyCrates, nextRequirements.supplyCrates),
        };
    }, { powerWatts: 0, commsBw: 0, supplyCrates: 0 });
    if (room.supplyFlow < requirements.supplyCrates) {
        return "low_supply";
    }
    if (room.powerFlow < requirements.powerWatts) {
        return "low_power";
    }
    if (room.commsFlow < requirements.commsBw) {
        return "low_comms";
    }
    return null;
}
function roomHasLinkedOperationalCore(theater, room, coreType, requiredCommsFlow) {
    if (room.commsFlow < requiredCommsFlow) {
        return false;
    }
    return Object.values(theater.rooms).some((candidate) => (roomHasOperationalCoreType(candidate, coreType)));
}
function deriveTheaterCoreRepairCost(room) {
    const buildCost = getRoomPrimaryCoreAssignment(room)?.buildCost ?? {};
    const repairCost = (0, resources_1.createEmptyResourceWallet)();
    resources_1.RESOURCE_KEYS.forEach((key) => {
        repairCost[key] = buildCost[key] ? Math.max(1, Math.ceil(buildCost[key] * 0.5)) : 0;
    });
    if (formatResourceCost(repairCost) !== "0") {
        return repairCost;
    }
    return {
        metalScrap: 4,
        wood: 2,
    };
}
function sumWadUpkeep(theater, ticks) {
    return Object.values(theater.rooms).reduce((total, room) => {
        if (!room.secured || !roomHasAnyCore(room)) {
            return total;
        }
        return total + getRoomCoreAssignments(room)
            .reduce((roomTotal, assignment) => roomTotal + ((assignment.wadUpkeepPerTick ?? 0) * ticks), 0);
    }, 0);
}
const NATURAL_STOCK_KEYS = ["metalScrap", "wood", "steamComponents"];
const NATURAL_STOCK_RECOVERY_RATES = {
    metalScrap: 0.00045,
    wood: 0.0008,
    steamComponents: 0.001,
};
function getNaturalStockYieldMultiplier(room, stockKey) {
    const max = Math.max(0, room.naturalResourceStockMax?.[stockKey] ?? 0);
    const current = Math.max(0, room.naturalResourceStock?.[stockKey] ?? 0);
    if (max <= 0 || current <= 0) {
        return 0;
    }
    const ratio = current / max;
    if (ratio <= 0.05) {
        return 0.25;
    }
    if (ratio <= 0.15) {
        return 0.45;
    }
    if (ratio <= 0.33) {
        return 0.7;
    }
    if (ratio <= 0.6) {
        return 0.85;
    }
    return 1;
}
function getSandboxRoomExtractionEfficiency(room) {
    if (roomHasOperationalCoreType(room, "mine")) {
        return getNaturalStockYieldMultiplier(room, "metalScrap");
    }
    if (roomHasOperationalCoreType(room, "refinery")) {
        return getNaturalStockYieldMultiplier(room, "steamComponents");
    }
    return 1;
}
function recoverRoomNaturalStock(room, ticks) {
    const naturalStock = (0, schemaSystem_1.normalizeTheaterRoomNaturalStock)(room, room.naturalResourceStock, room.naturalResourceStockMax);
    const nextStock = { ...naturalStock.current };
    NATURAL_STOCK_KEYS.forEach((stockKey) => {
        const max = Math.max(0, naturalStock.max[stockKey] ?? 0);
        if (max <= 0) {
            nextStock[stockKey] = 0;
            return;
        }
        const recoveryRate = NATURAL_STOCK_RECOVERY_RATES[stockKey];
        const baseRecovery = Math.max(1, Math.round(max * recoveryRate * Math.max(1, ticks)));
        const threatenedPenalty = room.underThreat || room.damaged ? 0.5 : 1;
        const recoveryAmount = Math.max(0, Math.round(baseRecovery * threatenedPenalty));
        nextStock[stockKey] = Math.min(max, (nextStock[stockKey] ?? 0) + recoveryAmount);
    });
    room.naturalResourceStock = nextStock;
    room.naturalResourceStockMax = naturalStock.max;
}
function getRoomNaturalStockIncome(room, coreAssignment, ticks) {
    const naturalStock = (0, schemaSystem_1.normalizeTheaterRoomNaturalStock)(room, room.naturalResourceStock, room.naturalResourceStockMax);
    const currentStock = { ...naturalStock.current };
    room.naturalResourceStock = currentStock;
    room.naturalResourceStockMax = naturalStock.max;
    const income = (0, resources_1.createEmptyResourceWallet)();
    resources_1.RESOURCE_KEYS.forEach((key) => {
        const desired = Math.max(0, (coreAssignment.incomePerTick?.[key] ?? 0) * ticks);
        if (desired <= 0) {
            return;
        }
        if (NATURAL_STOCK_KEYS.includes(key)) {
            const stockKey = key;
            const available = currentStock[stockKey] ?? 0;
            const effectiveDesired = Math.max(0, Math.ceil(desired * getNaturalStockYieldMultiplier(room, stockKey)));
            const granted = Math.min(available, effectiveDesired);
            currentStock[stockKey] = Math.max(0, available - granted);
            income[key] += granted;
            return;
        }
        income[key] += desired;
    });
    return income;
}
function collectResourceIncome(theater, ticks) {
    const next = cloneTheater(theater);
    const incomePerTick = (0, resources_1.createEmptyResourceWallet)();
    Object.values(next.rooms).forEach((room) => {
        recoverRoomNaturalStock(room, ticks);
        getRoomOperationalCoreAssignments(room).forEach((coreAssignment) => {
            const roomIncome = (coreAssignment.type === "mine" || coreAssignment.type === "refinery")
                ? getRoomNaturalStockIncome(room, coreAssignment, ticks)
                : (0, resources_1.createEmptyResourceWallet)(Object.fromEntries(resources_1.RESOURCE_KEYS.map((key) => [key, Math.max(0, (coreAssignment.incomePerTick?.[key] ?? 0) * ticks)])));
            resources_1.RESOURCE_KEYS.forEach((key) => {
                incomePerTick[key] += roomIncome[key] ?? 0;
            });
        });
    });
    return {
        theater: next,
        incomePerTick,
    };
}
function addResources(base, delta) {
    return (0, resources_1.addResourceWallet)(base, delta);
}
function hasPositiveResourceDelta(delta) {
    return resources_1.RESOURCE_KEYS.some((key) => Number(delta?.[key] ?? 0) > 0);
}
function toResourceWalletDelta(delta) {
    return (0, resources_1.createEmptyResourceWallet)({
        metalScrap: Math.max(0, Math.floor(Number(delta?.metalScrap ?? 0))),
        wood: Math.max(0, Math.floor(Number(delta?.wood ?? 0))),
        chaosShards: Math.max(0, Math.floor(Number(delta?.chaosShards ?? 0))),
        steamComponents: Math.max(0, Math.floor(Number(delta?.steamComponents ?? 0))),
    });
}
function applyTheaterSessionEconomyForTicks(state, theater, ticks) {
    const economyTheater = recomputeTheaterNetwork(theater);
    const wadUpkeep = sumWadUpkeep(economyTheater, ticks);
    const spendResult = wadUpkeep > 0 ? (0, session_1.spendSessionCost)(state, { wad: wadUpkeep }) : null;
    let nextState = state;
    let nextTheater = cloneTheater(economyTheater);
    if (wadUpkeep <= 0 || spendResult?.success) {
        if (spendResult?.success) {
            nextState = spendResult.state;
        }
        const resourceCollection = collectResourceIncome(nextTheater, ticks);
        nextTheater = resourceCollection.theater;
        const resourceIncome = toResourceWalletDelta(resourceCollection.incomePerTick);
        if (hasPositiveResourceDelta(resourceIncome)) {
            nextState = (0, session_1.grantSessionResources)(nextState, { resources: resourceIncome });
        }
        return { state: nextState, theater: nextTheater };
    }
    Object.values(nextTheater.rooms).forEach((room) => {
        if (roomHasAnyCore(room)) {
            room.underThreat = true;
            room.damaged = room.damaged || room.fortificationPips.barricade <= 0;
        }
    });
    nextTheater = addTheaterEvent(nextTheater, "UPKEEP :: Wad reserves too low for maintenance. Unsupported C.O.R.E.s are destabilizing.");
    return { state, theater: nextTheater };
}
function getObjectiveRoom(theater) {
    if (theater.objectiveDefinition?.targetRoomId) {
        return theater.rooms[theater.objectiveDefinition.targetRoomId] ?? null;
    }
    return Object.values(theater.rooms).find((room) => room.tags.includes("objective")) ?? null;
}
function createCompletionSummary(theater, room) {
    const securedCount = Object.values(theater.rooms).filter((candidate) => candidate.secured).length;
    const coreCount = Object.values(theater.rooms)
        .reduce((total, candidate) => total + getRoomOperationalCoreAssignments(candidate).length, 0);
    const poweredCount = Object.values(theater.rooms).filter((candidate) => candidate.powered).length;
    return {
        roomId: room.id,
        completedAtTick: theater.tickCount,
        reward: {
            wad: 120,
            ...(0, resources_1.createEmptyResourceWallet)({
                metalScrap: 8,
                wood: 6,
                chaosShards: 3,
                steamComponents: 3,
            }),
        },
        recapLines: [
            `${room.label} secured at tick ${theater.tickCount}.`,
            `${securedCount}/${Object.keys(theater.rooms).length} rooms secured across ${theater.definition.name}.`,
            `${coreCount} C.O.R.E. facilities online, ${poweredCount} secured rooms powered by rail.`,
        ],
    };
}
function resolveCompletionRoom(theater) {
    if (theater.objectiveDefinition) {
        if (!theater.objectiveDefinition.progress.completed) {
            return null;
        }
        return (theater.rooms[theater.objectiveDefinition.targetRoomId]
            ?? getObjectiveRoom(theater)
            ?? theater.rooms[theater.currentRoomId]
            ?? Object.values(theater.rooms)[0]
            ?? null);
    }
    const objectiveRoom = getObjectiveRoom(theater);
    if (objectiveRoom?.secured) {
        return objectiveRoom;
    }
    const rooms = Object.values(theater.rooms);
    if (rooms.length > 0 && rooms.every((room) => room.secured)) {
        return objectiveRoom ?? theater.rooms[theater.currentRoomId] ?? rooms[0] ?? null;
    }
    return null;
}
function reconcileTheaterCompletion(theater) {
    const completionRoom = resolveCompletionRoom(theater);
    if (!completionRoom) {
        return theater;
    }
    if (theater.objectiveComplete && theater.completion) {
        return theater;
    }
    const next = cloneTheater(theater);
    const nextCompletionRoom = next.rooms[completionRoom.id] ?? completionRoom;
    next.objectiveComplete = true;
    next.completion = next.completion ?? createCompletionSummary(next, nextCompletionRoom);
    return addTheaterEvent(next, `OBJECTIVE :: ${nextCompletionRoom.label} secured. ${next.definition.name} operation complete.`);
}
function recomputeSupplyAndPower(theater) {
    const next = cloneTheater(theater);
    const rooms = next.rooms;
    const ingressId = next.definition.ingressRoomId;
    const ingress = rooms[ingressId];
    Object.values(rooms).forEach((room) => {
        syncRoomPrimaryCoreAssignment(room);
        room.coreSlots = ensureRoomCoreSlots(room).map((assignment) => {
            if (!assignment) {
                return null;
            }
            const blueprint = exports.THEATER_CORE_BLUEPRINTS[assignment.type];
            return {
                ...assignment,
                buildCost: { ...blueprint.buildCost },
                upkeepPerTick: { ...blueprint.upkeep },
                wadUpkeepPerTick: blueprint.wadUpkeepPerTick,
                incomePerTick: (0, schemaSystem_1.getCoreIncomeForRoom)(assignment.type, room),
                supportRadius: blueprint.supportRadius,
            };
        });
        room.coreAssignment = room.coreSlots.find((assignment) => assignment !== null) ?? null;
        room.supplied = false;
        room.connected = false;
        room.powered = false;
        room.commsVisible = false;
        room.commsLinked = false;
        room.supplyFlow = 0;
        room.powerFlow = 0;
        room.commsFlow = 0;
        room.intelLevel = 0;
    });
    const propagateSupplyFromSource = (sourceId, sourceCrates) => {
        const sourceRoom = rooms[sourceId];
        if (!sourceRoom) {
            return;
        }
        const supplyQueue = [{ roomId: sourceId, loss: 0 }];
        const bestLoss = new Map([[sourceId, 0]]);
        while (supplyQueue.length > 0) {
            const current = supplyQueue.shift();
            const currentRoom = rooms[current.roomId];
            if (!currentRoom) {
                continue;
            }
            const crates = Math.max(0, sourceCrates - current.loss);
            if (crates <= 0) {
                continue;
            }
            currentRoom.supplyFlow = Math.max(currentRoom.supplyFlow, crates);
            currentRoom.supplied = currentRoom.supplyFlow > 0;
            currentRoom.adjacency.forEach((adjacentId) => {
                const adjacentRoom = rooms[adjacentId];
                if (!adjacentRoom || !adjacentRoom.secured) {
                    return;
                }
                if (currentRoom.damaged || adjacentRoom.damaged) {
                    return;
                }
                const nextLoss = current.loss + getSupplyTraversalDecay(currentRoom, adjacentRoom);
                if (Math.max(0, sourceCrates - nextLoss) <= 0) {
                    return;
                }
                if ((bestLoss.get(adjacentId) ?? Number.POSITIVE_INFINITY) <= nextLoss) {
                    return;
                }
                bestLoss.set(adjacentId, nextLoss);
                supplyQueue.push({ roomId: adjacentId, loss: nextLoss });
            });
        }
    };
    const baseSupplySourceIds = new Set();
    if (ingress?.secured && !ingress.damaged) {
        baseSupplySourceIds.add(ingress.id);
    }
    baseSupplySourceIds.forEach((sourceId) => {
        propagateSupplyFromSource(sourceId, SUPPLY_SOURCE_CRATES_PER_TICK);
    });
    const propagatePowerFromSource = (sourceId, sourceWatts) => {
        const sourceRoom = rooms[sourceId];
        if (!sourceRoom) {
            return;
        }
        const queue = [{ roomId: sourceId, depth: 0 }];
        const bestDepth = new Map([[sourceId, 0]]);
        while (queue.length > 0) {
            const current = queue.shift();
            const currentRoom = rooms[current.roomId];
            if (!currentRoom) {
                continue;
            }
            const watts = Math.max(0, sourceWatts - (current.depth * POWER_FALLOFF_PER_ROOM));
            if (watts <= 0) {
                continue;
            }
            currentRoom.powerFlow += watts;
            currentRoom.powered = currentRoom.powerFlow > 0;
            if (watts <= POWER_FALLOFF_PER_ROOM) {
                continue;
            }
            currentRoom.adjacency.forEach((adjacentId) => {
                const adjacentRoom = rooms[adjacentId];
                if (!adjacentRoom || !adjacentRoom.secured || adjacentRoom.damaged) {
                    return;
                }
                if (!roomCanCarryPower(adjacentRoom)) {
                    return;
                }
                if (!roomCanCarryPower(currentRoom) && current.roomId !== sourceId) {
                    return;
                }
                const nextDepth = current.depth + 1;
                if ((bestDepth.get(adjacentId) ?? Number.POSITIVE_INFINITY) <= nextDepth) {
                    return;
                }
                bestDepth.set(adjacentId, nextDepth);
                queue.push({ roomId: adjacentId, depth: nextDepth });
            });
        }
    };
    const basePowerSourceIds = new Set();
    if (ingress?.secured && !ingress.damaged) {
        basePowerSourceIds.add(ingress.id);
    }
    Object.values(rooms).forEach((room) => {
        if (!room.secured || room.damaged) {
            return;
        }
        if (room.isPowerSource && !roomHasCoreType(room, "generator")) {
            basePowerSourceIds.add(room.id);
        }
    });
    basePowerSourceIds.forEach((sourceId) => {
        propagatePowerFromSource(sourceId, POWER_SOURCE_WATTS_PER_TICK);
    });
    const activeGeneratorSourceIds = new Set(Object.values(rooms)
        .filter((room) => (room.secured
        && !room.damaged
        && roomHasCoreType(room, "generator")
        && room.supplyFlow >= getRoomCoreOperationalRequirements(room).supplyCrates
        && room.powerFlow >= Math.max(GENERATOR_MIN_INPUT_WATTS, getRoomCoreOperationalRequirements(room).powerWatts)))
        .map((room) => room.id));
    const generatorInputWattsByRoom = new Map(Object.values(rooms).map((room) => [room.id, room.powerFlow]));
    activeGeneratorSourceIds.forEach((sourceId) => {
        const sourceRoom = rooms[sourceId];
        propagatePowerFromSource(sourceId, getCorePowerOutputWatts(sourceRoom, generatorInputWattsByRoom.get(sourceId) ?? 0));
    });
    const propagateCommsFromSource = (sourceId, sourceBandwidth) => {
        const sourceRoom = rooms[sourceId];
        if (!sourceRoom) {
            return;
        }
        const queue = [{ roomId: sourceId, depth: 0 }];
        const bestDepth = new Map([[sourceId, 0]]);
        while (queue.length > 0) {
            const current = queue.shift();
            const currentRoom = rooms[current.roomId];
            if (!currentRoom || currentRoom.damaged) {
                continue;
            }
            const bandwidth = Math.max(0, sourceBandwidth - (current.depth * COMMS_FALLOFF_PER_ROOM));
            if (bandwidth <= 0) {
                continue;
            }
            currentRoom.commsLinked = true;
            currentRoom.connected = true;
            currentRoom.commsFlow = Math.max(currentRoom.commsFlow, bandwidth);
            if (bandwidth <= COMMS_FALLOFF_PER_ROOM) {
                continue;
            }
            currentRoom.adjacency.forEach((adjacentId) => {
                const adjacentRoom = rooms[adjacentId];
                if (!adjacentRoom || adjacentRoom.damaged) {
                    return;
                }
                if (current.roomId !== sourceId && !adjacentRoom.secured) {
                    return;
                }
                const nextDepth = current.depth + 1;
                if ((bestDepth.get(adjacentId) ?? Number.POSITIVE_INFINITY) <= nextDepth) {
                    return;
                }
                bestDepth.set(adjacentId, nextDepth);
                queue.push({ roomId: adjacentId, depth: nextDepth });
            });
        }
    };
    const commsSourceIds = new Set();
    if (ingress?.secured && !ingress.damaged) {
        commsSourceIds.add(ingress.id);
    }
    commsSourceIds.forEach((sourceId) => {
        propagateCommsFromSource(sourceId, COMMS_SOURCE_BANDWIDTH_PER_TICK);
    });
    const activeCommandSourceIds = new Set(Object.values(rooms)
        .filter((room) => room.secured && roomHasCoreType(room, "command_center") && roomHasOperationalCore(room))
        .map((room) => room.id));
    const commandInputBandwidthByRoom = new Map(Object.values(rooms).map((room) => [room.id, room.commsFlow]));
    activeCommandSourceIds.forEach((sourceId) => {
        const sourceRoom = rooms[sourceId];
        propagateCommsFromSource(sourceId, getCoreCommsOutputBw(sourceRoom, commandInputBandwidthByRoom.get(sourceId) ?? 0));
    });
    const activeSupplySourceIds = new Set(Object.values(rooms)
        .filter((room) => room.secured && !room.damaged && roomHasCoreType(room, "supply_depot") && roomHasOperationalCore(room))
        .map((room) => room.id));
    const supplyInputCratesByRoom = new Map(Object.values(rooms).map((room) => [room.id, room.supplyFlow]));
    activeSupplySourceIds.forEach((sourceId) => {
        const sourceRoom = rooms[sourceId];
        propagateSupplyFromSource(sourceId, getCoreSupplyOutputCrates(sourceRoom, supplyInputCratesByRoom.get(sourceId) ?? 0));
    });
    const newlyActiveGenerators = Object.values(rooms)
        .filter((room) => (room.secured
        && !room.damaged
        && roomHasCoreType(room, "generator")
        && !activeGeneratorSourceIds.has(room.id)
        && room.supplyFlow >= getRoomCoreOperationalRequirements(room).supplyCrates
        && room.powerFlow >= Math.max(GENERATOR_MIN_INPUT_WATTS, getRoomCoreOperationalRequirements(room).powerWatts)));
    const newlyActiveGeneratorInputWattsByRoom = new Map(newlyActiveGenerators.map((room) => [room.id, room.powerFlow]));
    newlyActiveGenerators.forEach((room) => {
        activeGeneratorSourceIds.add(room.id);
        propagatePowerFromSource(room.id, getCorePowerOutputWatts(room, newlyActiveGeneratorInputWattsByRoom.get(room.id) ?? 0));
    });
    const newlyActiveCommands = Object.values(rooms)
        .filter((room) => (room.secured
        && roomHasCoreType(room, "command_center")
        && !activeCommandSourceIds.has(room.id)
        && roomHasOperationalCore(room)));
    const newlyActiveCommandInputBandwidthByRoom = new Map(newlyActiveCommands.map((room) => [room.id, room.commsFlow]));
    newlyActiveCommands.forEach((room) => {
        activeCommandSourceIds.add(room.id);
        propagateCommsFromSource(room.id, getCoreCommsOutputBw(room, newlyActiveCommandInputBandwidthByRoom.get(room.id) ?? 0));
    });
    const newlyActiveSupplyDepots = Object.values(rooms)
        .filter((room) => (room.secured
        && !room.damaged
        && roomHasCoreType(room, "supply_depot")
        && !activeSupplySourceIds.has(room.id)
        && roomHasOperationalCore(room)));
    const newlyActiveSupplyInputCratesByRoom = new Map(newlyActiveSupplyDepots.map((room) => [room.id, room.supplyFlow]));
    newlyActiveSupplyDepots.forEach((room) => {
        activeSupplySourceIds.add(room.id);
        propagateSupplyFromSource(room.id, getCoreSupplyOutputCrates(room, newlyActiveSupplyInputCratesByRoom.get(room.id) ?? 0));
    });
    const applyIntel = (sourceId, detailedLimit, fringeLimit) => {
        const sourceRoom = rooms[sourceId];
        if (!sourceRoom) {
            return;
        }
        const queue = [{ roomId: sourceId, depth: 0 }];
        const bestDepth = new Map([[sourceId, 0]]);
        while (queue.length > 0) {
            const current = queue.shift();
            const currentRoom = rooms[current.roomId];
            if (!currentRoom) {
                continue;
            }
            if (current.depth <= detailedLimit) {
                currentRoom.intelLevel = 2;
            }
            else if (current.depth <= fringeLimit) {
                currentRoom.intelLevel = currentRoom.intelLevel === 2 ? 2 : 1;
            }
            if (current.depth >= fringeLimit) {
                continue;
            }
            currentRoom.adjacency.forEach((adjacentId) => {
                const nextDepth = current.depth + 1;
                if ((bestDepth.get(adjacentId) ?? Number.POSITIVE_INFINITY) <= nextDepth) {
                    return;
                }
                bestDepth.set(adjacentId, nextDepth);
                queue.push({ roomId: adjacentId, depth: nextDepth });
            });
        }
    };
    Object.values(rooms).forEach((room) => {
        if (room.secured) {
            room.intelLevel = 2;
            applyIntel(room.id, 0, 1);
        }
    });
    const activeCommandCenters = Object.values(rooms).filter((room) => (room.commsLinked && roomHasCoreType(room, "command_center") && roomHasOperationalCore(room)));
    activeCommandCenters.forEach((room) => {
        const detailedLimit = Math.max(1, getRoomPrimaryCoreAssignmentByType(room, "command_center")?.supportRadius ?? 1);
        applyIntel(room.id, detailedLimit, detailedLimit + 1);
    });
    const currentRoom = rooms[next.currentRoomId];
    if (currentRoom) {
        currentRoom.intelLevel = 2;
        if (currentRoom.commsLinked || currentRoom.adjacency.some((adjacentId) => rooms[adjacentId]?.commsLinked)) {
            applyIntel(currentRoom.id, 1, 2);
        }
        else {
            applyIntel(currentRoom.id, 0, 1);
        }
    }
    Object.values(rooms).forEach((room) => {
        room.supplied = room.supplyFlow > 0;
        room.powered = room.powerFlow > 0;
        room.commsVisible = room.intelLevel > 0 || room.secured || room.id === next.currentRoomId;
    });
    return syncObjectiveState(applySquadContactState(next));
}
function resolveThreatDamage(theater, roomId, reason, allowRoomLoss) {
    const next = cloneTheater(theater);
    const room = next.rooms[roomId];
    if (!room) {
        return theater;
    }
    let message = `THREAT :: ${room.label} absorbed perimeter damage.`;
    if (room.fortificationPips.barricade > 0) {
        room.fortificationPips.barricade = Math.max(0, room.fortificationPips.barricade - 1);
        room.fortified = getInstalledFortificationCount(room) > 0;
        room.damaged = true;
        room.abandoned = true;
        message = `THREAT :: ${room.label} lost a Barricade (${reason}).`;
    }
    else if (allowRoomLoss || room.damaged || room.abandoned) {
        room.secured = false;
        room.status = "mapped";
        room.damaged = true;
        room.abandoned = true;
        clearRoomCoreAssignments(room);
        room.fortificationPips.powerRail = Math.max(0, room.fortificationPips.powerRail - 1);
        room.fortified = getInstalledFortificationCount(room) > 0;
        removeAnnexBranch(next, room.id);
        next.squads = next.squads.map((squad) => {
            const currentNodeId = squad.currentNodeId ?? squad.currentRoomId;
            const nextRoomId = currentNodeId === room.id || (0, theaterAutomation_1.getTheaterRootRoomIdForNode)(next, currentNodeId) === room.id
                ? next.definition.uplinkRoomId
                : squad.currentRoomId;
            return {
                ...squad,
                currentRoomId: nextRoomId,
                currentNodeId: nextRoomId,
            };
        });
        if ((0, theaterAutomation_1.getTheaterCurrentNodeId)(next) === room.id || (0, theaterAutomation_1.getTheaterRootRoomIdForNode)(next, (0, theaterAutomation_1.getTheaterCurrentNodeId)(next)) === room.id) {
            next.currentNodeId = next.definition.uplinkRoomId;
            next.currentRoomId = next.definition.uplinkRoomId;
        }
        if ((0, theaterAutomation_1.getTheaterSelectedNodeId)(next) === room.id || (0, theaterAutomation_1.getTheaterRootRoomIdForNode)(next, (0, theaterAutomation_1.getTheaterSelectedNodeId)(next)) === room.id) {
            next.selectedNodeId = next.definition.uplinkRoomId;
            next.selectedRoomId = next.definition.uplinkRoomId;
        }
        message = `THREAT :: ${room.label} was abandoned and control was lost (${reason}).`;
    }
    else {
        room.damaged = true;
        room.abandoned = true;
        message = `THREAT :: ${room.label} was left unsupported and is now damaged (${reason}).`;
    }
    room.underThreat = false;
    next.activeThreats = next.activeThreats.map((threat) => threat.roomId === roomId || threat.currentRoomId === roomId || threat.targetRoomId === roomId
        ? { ...threat, active: false }
        : threat);
    return addTheaterEvent(recomputeTheaterNetwork(next), message);
}
function resolveOperationFields(operation, theater) {
    const floorIndex = operation.atlasFloorId && operation.floors.length <= 1
        ? 0
        : Math.max(0, (theater.definition.floorOrdinal ?? 1) - 1);
    return {
        ...operation,
        objective: theater.definition.objective,
        recommendedPWR: theater.definition.recommendedPWR,
        beginningState: theater.definition.beginningState,
        endState: theater.definition.endState,
        currentFloorIndex: floorIndex,
        currentRoomId: theater.currentRoomId,
        theater,
        theaterFloors: {
            ...(operation.theaterFloors ?? {}),
            [floorIndex]: cloneTheater(theater),
        },
    };
}
function isValidTheaterNetwork(theater) {
    return Boolean(theater
        && typeof theater.definition?.uplinkRoomId === "string"
        && typeof theater.definition?.floorId === "string"
        && Object.values(theater.rooms).every((room) => (typeof room.theaterId === "string"
            && room.localPosition !== undefined
            && typeof room.depthFromUplink === "number"
            && typeof room.isUplinkRoom === "boolean")));
}
function getClampedOperationFloorIndex(operation) {
    const maxFloorIndex = Math.max(0, operation.floors.length - 1);
    return Math.max(0, Math.min(operation.currentFloorIndex ?? 0, maxFloorIndex));
}
function getTheaterFloorIndex(theater) {
    return Math.max(0, (theater.definition.floorOrdinal ?? 1) - 1);
}
function doesTheaterMatchOperationFloor(operation, theater, currentFloorIndex) {
    if (operation.atlasFloorId && operation.floors.length <= 1) {
        return theater.definition.floorId === operation.atlasFloorId;
    }
    return getTheaterFloorIndex(theater) === currentFloorIndex;
}
function prepareTheaterForOperation(theater) {
    return reconcileTheaterCompletion(applySandboxSlice((0, theaterAutomation_1.evaluateTheaterAutomation)(recomputeTheaterNetwork(theater))));
}
function generateTheaterForFloor(operation, floorIndex) {
    try {
        return (0, theaterGenerator_1.createGeneratedTheaterFloor)(operation, floorIndex);
    }
    catch (error) {
        console.error("[THEATER] generated floor fallback", operation.id, floorIndex, error);
        return createIronGateTheater(operation);
    }
}
function ensureOperationHasTheater(operation) {
    if (!operation) {
        return null;
    }
    const currentFloorIndex = getClampedOperationFloorIndex(operation);
    const normalizedOperation = currentFloorIndex === operation.currentFloorIndex
        ? operation
        : {
            ...operation,
            currentFloorIndex,
        };
    if (isValidTheaterNetwork(normalizedOperation.theater)
        && doesTheaterMatchOperationFloor(normalizedOperation, normalizedOperation.theater, currentFloorIndex)) {
        return resolveOperationFields(normalizedOperation, prepareTheaterForOperation(normalizedOperation.theater));
    }
    const storedFloorTheater = normalizedOperation.theaterFloors?.[currentFloorIndex];
    if (isValidTheaterNetwork(storedFloorTheater)
        && doesTheaterMatchOperationFloor(normalizedOperation, storedFloorTheater, currentFloorIndex)) {
        return resolveOperationFields({
            ...normalizedOperation,
            theater: storedFloorTheater,
        }, prepareTheaterForOperation(storedFloorTheater));
    }
    return resolveOperationFields(normalizedOperation, prepareTheaterForOperation(generateTheaterForFloor(normalizedOperation, currentFloorIndex)));
}
function hasTheaterOperation(operation) {
    return Boolean(operation?.theater);
}
function getMoveTickCost(theater, roomId) {
    const room = theater.rooms[roomId];
    if (!room) {
        return 0;
    }
    return room.secured ? 1 : 2;
}
function getInstalledFortificationCount(room) {
    return (0, schemaSystem_1.getInstalledFortificationCount)(room.fortificationPips);
}
function isDefenseBattleRoom(room) {
    return room.secured && (room.underThreat || room.damaged);
}
function findTheaterRoute(theater, roomId) {
    const originId = theater.currentRoomId;
    if (originId === roomId) {
        return [originId];
    }
    const destination = theater.rooms[roomId];
    if (!destination
        || (destination.status === "unknown" && !destination.commsVisible)
        || isTheaterRoomLocked(theater, destination)) {
        return null;
    }
    const bestCost = new Map([[originId, 0]]);
    const previous = new Map([[originId, null]]);
    const queue = [{ roomId: originId, cost: 0 }];
    while (queue.length > 0) {
        queue.sort((a, b) => a.cost - b.cost);
        const current = queue.shift();
        if (current.cost > (bestCost.get(current.roomId) ?? Number.POSITIVE_INFINITY)) {
            continue;
        }
        if (current.roomId === roomId) {
            break;
        }
        const currentRoom = theater.rooms[current.roomId];
        if (!currentRoom) {
            continue;
        }
        currentRoom.adjacency.forEach((adjacentId) => {
            const adjacentRoom = theater.rooms[adjacentId];
            if (!adjacentRoom) {
                return;
            }
            if (!isTheaterPassagePowered(theater, current.roomId, adjacentId)) {
                return;
            }
            if (isTheaterRoomLocked(theater, adjacentRoom)) {
                return;
            }
            if (adjacentId !== roomId && !adjacentRoom.secured) {
                return;
            }
            if (adjacentRoom.status === "unknown" && !adjacentRoom.commsVisible) {
                return;
            }
            const nextCost = current.cost + getMoveTickCost(theater, adjacentId);
            if (nextCost >= (bestCost.get(adjacentId) ?? Number.POSITIVE_INFINITY)) {
                return;
            }
            bestCost.set(adjacentId, nextCost);
            previous.set(adjacentId, current.roomId);
            queue.push({ roomId: adjacentId, cost: nextCost });
        });
    }
    if (!previous.has(roomId)) {
        return null;
    }
    const path = [];
    let cursor = roomId;
    while (cursor) {
        path.push(cursor);
        cursor = previous.get(cursor) ?? null;
    }
    return path.reverse();
}
function getCoreBattleRewardBonus(theater, room) {
    if (room.commsFlow < 50) {
        return (0, resources_1.createEmptyResourceWallet)();
    }
    const activeMineCount = Object.values(theater.rooms).filter((candidate) => (roomHasOperationalCoreType(candidate, "mine"))).length;
    const activeRefineryCount = Object.values(theater.rooms).filter((candidate) => (roomHasOperationalCoreType(candidate, "refinery"))).length;
    if (activeMineCount <= 0 && activeRefineryCount <= 0) {
        return (0, resources_1.createEmptyResourceWallet)();
    }
    return (0, resources_1.createEmptyResourceWallet)({
        metalScrap: activeMineCount * ((0, schemaSystem_1.roomHasTag)(room, "metal_rich") ? 3 : 1),
        wood: activeMineCount * ((0, schemaSystem_1.roomHasTag)(room, "timber_rich") ? 3 : 1),
        chaosShards: 0,
        steamComponents: activeRefineryCount * ((0, schemaSystem_1.roomHasTag)(room, "steam_vent") ? 3 : 1),
    });
}
function autoResolveNonCombatRoom(theater, roomId) {
    const room = theater.rooms[roomId];
    // Field-sweep rooms must stay unresolved until the generated field map is completed.
    if (!room || room.secured || room.clearMode !== "empty") {
        return theater;
    }
    room.status = "secured";
    room.secured = true;
    room.underThreat = false;
    room.damaged = false;
    room.fortified = getInstalledFortificationCount(room) > 0;
    const logLine = `CLEAR :: ${room.label} checked and secured. No hostile contact.`;
    return syncTheaterKeyInventory(collectRoomKeyIfPresent(addTheaterEvent(theater, logLine), roomId));
}
function setTheaterSelectedRoom(state, roomId) {
    const operation = getPreparedTheaterOperation(state);
    if (!operation?.theater || !operation.theater.rooms[roomId]) {
        return state;
    }
    return {
        ...state,
        phase: "operation",
        operation: resolveOperationFields(operation, {
            ...operation.theater,
            selectedRoomId: roomId,
            selectedNodeId: roomId,
        }),
    };
}
function setTheaterCurrentRoom(state, roomId) {
    const operation = getPreparedTheaterOperation(state);
    if (!operation?.theater || !operation.theater.rooms[roomId]) {
        return state;
    }
    const theater = cloneTheater(operation.theater);
    theater.currentRoomId = roomId;
    theater.selectedRoomId = roomId;
    theater.currentNodeId = roomId;
    theater.selectedNodeId = roomId;
    const selectedSquad = getSelectedSquad(theater);
    if (selectedSquad) {
        selectedSquad.currentRoomId = roomId;
        selectedSquad.currentNodeId = roomId;
    }
    return {
        ...state,
        phase: "operation",
        operation: resolveOperationFields(operation, theater),
    };
}
function getTheaterSelectedNode(theater) {
    return (0, theaterAutomation_1.resolveTheaterNode)(theater, (0, theaterAutomation_1.getTheaterSelectedNodeId)(theater))
        ?? (0, theaterAutomation_1.resolveTheaterNode)(theater, theater.selectedRoomId)
        ?? (0, theaterAutomation_1.resolveTheaterNode)(theater, theater.currentRoomId);
}
function setTheaterSelectedNode(state, nodeId) {
    const operation = getPreparedTheaterOperation(state);
    if (!operation?.theater) {
        return state;
    }
    const resolved = (0, theaterAutomation_1.resolveTheaterNode)(operation.theater, nodeId);
    const rootRoomId = (0, theaterAutomation_1.getTheaterRootRoomIdForNode)(operation.theater, nodeId);
    if (!resolved || !rootRoomId || !operation.theater.rooms[rootRoomId]) {
        return state;
    }
    return {
        ...state,
        phase: "operation",
        operation: resolveOperationFields(operation, {
            ...operation.theater,
            selectedRoomId: rootRoomId,
            selectedNodeId: nodeId,
        }),
    };
}
function getNextAnnexId(theater) {
    let index = 1;
    const annexes = theater.annexesById ?? {};
    while (annexes[`annex_${index}`]) {
        index += 1;
    }
    return `annex_${index}`;
}
function getAnnexFrameSize(frameType) {
    switch (frameType) {
        case "lightweight_annex":
            return { width: 120, height: 92 };
        case "heavy_annex":
            return { width: 190, height: 138 };
        case "standard_annex":
        default:
            return { width: 150, height: 112 };
    }
}
function getAnnexOffsetForEdge(edge, size, parentSize) {
    const gap = 48;
    switch (edge) {
        case "north":
            return { x: 0, y: -((parentSize.height / 2) + (size.height / 2) + gap) };
        case "south":
            return { x: 0, y: (parentSize.height / 2) + (size.height / 2) + gap };
        case "east":
            return { x: (parentSize.width / 2) + (size.width / 2) + gap, y: 0 };
        case "west":
        default:
            return { x: -((parentSize.width / 2) + (size.width / 2) + gap), y: 0 };
    }
}
function rectOverlaps(rectA, rectB) {
    return !(rectA.right < rectB.left
        || rectA.left > rectB.right
        || rectA.bottom < rectB.top
        || rectA.top > rectB.bottom);
}
function createNodeRect(position, size) {
    return {
        left: position.x - size.width / 2,
        right: position.x + size.width / 2,
        top: position.y - size.height / 2,
        bottom: position.y + size.height / 2,
    };
}
function doesAnnexCandidateOverlap(theater, position, size) {
    const candidateRect = createNodeRect(position, size);
    const roomOverlap = Object.values(theater.rooms).some((room) => rectOverlaps(candidateRect, createNodeRect(room.position, room.size)));
    if (roomOverlap) {
        return true;
    }
    return Object.values(theater.annexesById ?? {}).some((annex) => rectOverlaps(candidateRect, createNodeRect(annex.position, annex.size)));
}
function ensureRoomModuleSlots(room) {
    const desiredSize = Math.max(0, room.moduleSlotCapacity ?? room.moduleSlots?.length ?? 0);
    room.moduleSlots = Array.from({ length: desiredSize }, (_, index) => room.moduleSlots?.[index] ?? null);
    room.moduleSlotCapacity = desiredSize;
    room.moduleSlotUpgradeLevel = Math.max(0, Number(room.moduleSlotUpgradeLevel ?? 0));
    return room;
}
function getOpenModuleSlotIndex(node) {
    if (!node) {
        return -1;
    }
    const slots = node.kind === "room"
        ? ensureRoomModuleSlots(node.room).moduleSlots ?? []
        : node.annex?.moduleSlots ?? [];
    return slots.findIndex((slot) => slot === null);
}
function getTheaterRoomModuleSlotUpgradeCost(room) {
    const level = Math.max(0, Number(room.moduleSlotUpgradeLevel ?? 0));
    return ROOM_MODULE_SLOT_UPGRADE_COSTS[level] ?? null;
}
function getEdgeRect(fromNodeId, toNodeId, theater) {
    const fromNode = (0, theaterAutomation_1.resolveTheaterNode)(theater, fromNodeId);
    const toNode = (0, theaterAutomation_1.resolveTheaterNode)(theater, toNodeId);
    if (!fromNode || !toNode) {
        return null;
    }
    const left = Math.min(fromNode.position.x, toNode.position.x);
    const right = Math.max(fromNode.position.x, toNode.position.x);
    const top = Math.min(fromNode.position.y, toNode.position.y);
    const bottom = Math.max(fromNode.position.y, toNode.position.y);
    const corridorWidth = 44;
    if (Math.abs(fromNode.position.x - toNode.position.x) >= Math.abs(fromNode.position.y - toNode.position.y)) {
        const centerY = (fromNode.position.y + toNode.position.y) / 2;
        return {
            left,
            right,
            top: centerY - corridorWidth / 2,
            bottom: centerY + corridorWidth / 2,
        };
    }
    const centerX = (fromNode.position.x + toNode.position.x) / 2;
    return {
        left: centerX - corridorWidth / 2,
        right: centerX + corridorWidth / 2,
        top,
        bottom,
    };
}
function doesAnnexCandidateOverlapConnection(theater, position, size, ignoredNodeIds = []) {
    const candidateRect = createNodeRect(position, size);
    const edges = new Set();
    const ignoredIds = new Set(ignoredNodeIds);
    Object.values(theater.rooms).forEach((room) => {
        room.adjacency.forEach((adjacentId) => {
            edges.add((0, theaterAutomation_1.getTheaterEdgeId)(room.id, adjacentId));
        });
    });
    Object.values(theater.annexesById ?? {}).forEach((annex) => {
        edges.add((0, theaterAutomation_1.getTheaterEdgeId)(annex.annexId, annex.parentNodeId));
    });
    return Array.from(edges).some((edgeId) => {
        const [fromNodeId, toNodeId] = edgeId.split("__");
        if (ignoredIds.has(fromNodeId) || ignoredIds.has(toNodeId)) {
            return false;
        }
        const edgeRect = getEdgeRect(fromNodeId, toNodeId, theater);
        return edgeRect ? rectOverlaps(candidateRect, edgeRect) : false;
    });
}
function getNextAutomationModuleId(theater) {
    let index = 1;
    const moduleIds = new Set(Object.keys(theater.automation?.moduleInstancesById ?? {}));
    while (moduleIds.has(`module_${index}`)) {
        index += 1;
    }
    return `module_${index}`;
}
function getModuleInstanceDefaultConfiguration(moduleType) {
    switch (moduleType) {
        case "threshold_switch":
            return { inputModuleIds: [], comparison: ">=", threshold: 1 };
        case "delay_timer":
        case "delay_buffer":
            return { inputModuleIds: [], delayTicks: 2 };
        case "and_gate":
        case "or_gate":
            return { inputModuleIds: [] };
        case "power_router":
        case "bandwidth_router":
        case "cache_release":
            return { inputModuleIds: [], target: null, transferAmount: 25 };
        case "power_stabilizer":
        case "comms_stabilizer":
            return { floorAmount: 25 };
        case "door_controller":
            return { inputModuleIds: [], target: null, desiredDoorState: "closed" };
        case "signal_relay":
            return { inputModuleIds: [], target: null };
        case "threat_sensor":
        case "power_sensor":
        case "bandwidth_sensor":
            return { monitorTarget: null };
        default:
            return { inputModuleIds: [] };
    }
}
function getNodeModuleSlots(node) {
    if (!node) {
        return [];
    }
    if (node.kind === "room") {
        return ensureRoomModuleSlots(node.room).moduleSlots ?? [];
    }
    return node.annex?.moduleSlots ?? [];
}
function setNodeModuleSlots(node, slots) {
    if (!node) {
        return;
    }
    if (node.kind === "room") {
        const room = ensureRoomModuleSlots(node.room);
        room.moduleSlots = [...slots];
        room.moduleSlotCapacity = room.moduleSlots.length;
        return;
    }
    if (node.annex) {
        node.annex.moduleSlots = [...slots];
        node.annex.moduleSlotCapacity = node.annex.moduleSlots.length;
    }
}
function getNodeRootRoomIdOrSelf(theater, nodeId) {
    if (theater.rooms[nodeId]) {
        return nodeId;
    }
    return (0, theaterAutomation_1.getTheaterRootRoomIdForNode)(theater, nodeId);
}
function buildConfiguredTheaterState(state, operation, theater, message) {
    const recomputed = applySandboxSlice((0, theaterAutomation_1.evaluateTheaterAutomation)(recomputeTheaterNetwork(theater)));
    return syncQuestRuntime({
        ...state,
        phase: "operation",
        operation: resolveOperationFields(operation, addTheaterEvent(recomputed, message)),
    });
}
function buildTheaterAnnex(state, parentNodeId, frameType, edge) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    const frame = foundrySystem_1.ANNEX_FRAME_DEFINITIONS[frameType];
    if (!operation || !theater || !frame) {
        return { state, success: false, message: "No active theater annex target." };
    }
    if ((theater.definition.floorOrdinal ?? 0) < 9) {
        return {
            state: setTheaterSelectedNode(state, parentNodeId),
            success: false,
            message: "Annex construction unlocks on Floor 09.",
        };
    }
    const parentNode = (0, theaterAutomation_1.resolveTheaterNode)(theater, parentNodeId);
    const parentRootRoomId = (0, theaterAutomation_1.getTheaterRootRoomIdForNode)(theater, parentNodeId);
    if (!parentNode || !parentRootRoomId) {
        return { state, success: false, message: "Parent node is not available." };
    }
    if (!(0, theaterAutomation_1.isTheaterNodeSecured)(theater, parentNodeId)) {
        return {
            state: setTheaterSelectedNode(state, parentNodeId),
            success: false,
            message: "Annexes can only be built from secured rooms or live annexes.",
        };
    }
    const annexSpendResult = (0, session_1.spendSessionCost)(state, { resources: frame.buildCost });
    if (!annexSpendResult.success) {
        return {
            state: setTheaterSelectedNode(state, parentNodeId),
            success: false,
            message: `Insufficient resources. Required: ${formatResourceCost(frame.buildCost)}.`,
        };
    }
    const nextTheater = cloneTheater(theater);
    const nextParent = (0, theaterAutomation_1.resolveTheaterNode)(nextTheater, parentNodeId);
    if (!nextParent) {
        return { state, success: false, message: "Parent node is no longer available." };
    }
    const size = getAnnexFrameSize(frameType);
    const offset = getAnnexOffsetForEdge(edge, size, nextParent.size);
    const position = {
        x: nextParent.position.x + offset.x,
        y: nextParent.position.y + offset.y,
    };
    if (doesAnnexCandidateOverlap(nextTheater, position, size)
        || doesAnnexCandidateOverlapConnection(nextTheater, position, size, [parentNodeId])) {
        return {
            state: setTheaterSelectedNode(state, parentNodeId),
            success: false,
            message: "That attachment point is occupied by another node or passage.",
        };
    }
    const annexId = getNextAnnexId(nextTheater);
    const rootRoom = nextTheater.rooms[parentRootRoomId];
    const annex = {
        annexId,
        parentNodeId,
        parentRoomId: parentRootRoomId,
        frameType,
        attachedEdge: edge,
        position,
        size,
        moduleSlotCapacity: frame.slotBonus,
        moduleSlots: Array.from({ length: frame.slotBonus }, () => null),
        integrity: frame.durability,
        inheritedControl: Boolean(rootRoom?.secured),
        inheritedSupply: Math.max(0, Number(rootRoom?.supplyFlow ?? 0)),
        inheritedPower: Math.max(0, Number(rootRoom?.powerFlow ?? 0)),
        inheritedComms: Math.max(0, Number(rootRoom?.commsFlow ?? 0)),
    };
    nextTheater.annexesById[annexId] = annex;
    nextTheater.selectedNodeId = annexId;
    nextTheater.selectedRoomId = parentRootRoomId;
    console.log("[THEATER] annex built", annexId, "onto", parentNodeId, frameType, edge);
    return {
        state: buildConfiguredTheaterState(annexSpendResult.state, operation, nextTheater, `ANNEX :: ${frame.displayName} attached to ${nextParent.label} on the ${edge.toUpperCase()} edge.`),
        success: true,
        message: `${frame.displayName} built.`,
    };
}
function upgradeTheaterRoomModuleSlots(state, roomId) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const room = theater.rooms[roomId];
    if (!room || !room.secured) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "Secure the room before expanding module capacity.",
        };
    }
    ensureRoomModuleSlots(room);
    if ((room.moduleSlotCapacity ?? 0) >= 4) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "This room is already at maximum module capacity.",
        };
    }
    const cost = getTheaterRoomModuleSlotUpgradeCost(room);
    if (!cost) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "No further module slot upgrades remain.",
        };
    }
    const moduleSlotSpendResult = (0, session_1.spendSessionCost)(state, { resources: cost });
    if (!moduleSlotSpendResult.success) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: `Insufficient resources. Required: ${formatResourceCost(cost)}.`,
        };
    }
    const nextTheater = cloneTheater(theater);
    const nextRoom = ensureRoomModuleSlots(nextTheater.rooms[roomId]);
    nextRoom.moduleSlotUpgradeLevel = Math.max(0, Number(nextRoom.moduleSlotUpgradeLevel ?? 0)) + 1;
    nextRoom.moduleSlotCapacity = Math.min(4, Math.max(0, nextRoom.moduleSlotCapacity ?? 0) + 1);
    nextRoom.moduleSlots = Array.from({ length: nextRoom.moduleSlotCapacity }, (_, index) => nextRoom.moduleSlots?.[index] ?? null);
    return {
        state: buildConfiguredTheaterState(moduleSlotSpendResult.state, operation, nextTheater, `MODULES :: ${nextRoom.label} gained an additional module slot (${nextRoom.moduleSlotCapacity}/4).`),
        success: true,
        message: `${nextRoom.label} module capacity increased.`,
    };
}
function installTheaterModule(state, nodeId, moduleType) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    const definition = foundrySystem_1.FOUNDRY_MODULE_DEFINITIONS[moduleType];
    if (!operation || !theater || !definition) {
        return { state, success: false, message: "No active theater module target." };
    }
    if (!(0, foundrySystem_1.isModuleTypeUnlocked)(state, moduleType)) {
        return {
            state: setTheaterSelectedNode(state, nodeId),
            success: false,
            message: `${definition.displayName} is still locked in the Foundry.`,
        };
    }
    if (definition.placeholder) {
        return {
            state: setTheaterSelectedNode(state, nodeId),
            success: false,
            message: `${definition.displayName} is still a prototype placeholder.`,
        };
    }
    const moduleSpendResult = (0, session_1.spendSessionCost)(state, { resources: definition.buildCost });
    if (!moduleSpendResult.success) {
        return {
            state: setTheaterSelectedNode(state, nodeId),
            success: false,
            message: `Insufficient resources. Required: ${formatResourceCost(definition.buildCost)}.`,
        };
    }
    const nextTheater = cloneTheater(theater);
    const node = (0, theaterAutomation_1.resolveTheaterNode)(nextTheater, nodeId);
    if (!node || !(0, theaterAutomation_1.isTheaterNodeSecured)(nextTheater, nodeId)) {
        return {
            state: setTheaterSelectedNode(state, nodeId),
            success: false,
            message: "Modules can only be installed in secured rooms or live annexes.",
        };
    }
    const slotIndex = getOpenModuleSlotIndex(node);
    if (slotIndex < 0) {
        return {
            state: setTheaterSelectedNode(state, nodeId),
            success: false,
            message: "No open module slots remain on that node.",
        };
    }
    const instanceId = getNextAutomationModuleId(nextTheater);
    const rootRoomId = getNodeRootRoomIdOrSelf(nextTheater, nodeId);
    const moduleInstance = {
        instanceId,
        moduleType,
        category: definition.category,
        installedNodeId: nodeId,
        installedRoomId: node.kind === "room" ? node.id : rootRoomId,
        installedAnnexId: node.kind === "annex" ? node.id : null,
        configuration: getModuleInstanceDefaultConfiguration(moduleType),
        active: false,
    };
    nextTheater.automation.moduleInstancesById[instanceId] = moduleInstance;
    const slots = [...getNodeModuleSlots(node)];
    slots[slotIndex] = instanceId;
    setNodeModuleSlots(node, slots);
    nextTheater.selectedNodeId = nodeId;
    console.log("[THEATER] module installed", moduleType, instanceId, "on", nodeId);
    return {
        state: buildConfiguredTheaterState(moduleSpendResult.state, operation, nextTheater, `AUTOMATION :: ${definition.displayName} installed on ${node.label}.`),
        success: true,
        message: `${definition.displayName} installed.`,
    };
}
function removeTheaterModule(state, moduleId) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const nextTheater = cloneTheater(theater);
    const moduleInstance = nextTheater.automation.moduleInstancesById[moduleId];
    if (!moduleInstance) {
        return { state, success: false, message: "Module is no longer installed." };
    }
    const node = (0, theaterAutomation_1.resolveTheaterNode)(nextTheater, moduleInstance.installedNodeId);
    const slots = getNodeModuleSlots(node).map((slot) => (slot === moduleId ? null : slot));
    setNodeModuleSlots(node, slots);
    delete nextTheater.automation.moduleInstancesById[moduleId];
    delete nextTheater.automation.moduleRuntimeById[moduleId];
    nextTheater.selectedNodeId = moduleInstance.installedNodeId;
    console.log("[THEATER] module removed", moduleInstance.moduleType, moduleId);
    return {
        state: buildConfiguredTheaterState(state, operation, nextTheater, `AUTOMATION :: ${foundrySystem_1.FOUNDRY_MODULE_DEFINITIONS[moduleInstance.moduleType]?.displayName ?? moduleInstance.moduleType} removed from ${node?.label ?? moduleInstance.installedNodeId}.`),
        success: true,
        message: "Module removed.",
    };
}
function configureTheaterModule(state, moduleId, configuration) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const nextTheater = cloneTheater(theater);
    const moduleInstance = nextTheater.automation.moduleInstancesById[moduleId];
    if (!moduleInstance) {
        return { state, success: false, message: "Module is no longer installed." };
    }
    const sanitizedConfig = {
        ...moduleInstance.configuration,
        ...configuration,
    };
    if (configuration.inputModuleIds) {
        sanitizedConfig.inputModuleIds = configuration.inputModuleIds
            .filter((inputId) => inputId !== moduleId && Boolean(nextTheater.automation.moduleInstancesById[inputId]))
            .slice(0, 4);
    }
    if (configuration.threshold !== undefined) {
        sanitizedConfig.threshold = Math.max(0, Number(configuration.threshold));
    }
    if (configuration.delayTicks !== undefined) {
        sanitizedConfig.delayTicks = Math.max(1, Math.floor(Number(configuration.delayTicks)));
    }
    if (configuration.transferAmount !== undefined) {
        sanitizedConfig.transferAmount = Math.max(1, Math.floor(Number(configuration.transferAmount)));
    }
    if (configuration.floorAmount !== undefined) {
        sanitizedConfig.floorAmount = Math.max(1, Math.floor(Number(configuration.floorAmount)));
    }
    moduleInstance.configuration = sanitizedConfig;
    nextTheater.selectedNodeId = moduleInstance.installedNodeId;
    return {
        state: buildConfiguredTheaterState(state, operation, nextTheater, `AUTOMATION :: ${foundrySystem_1.FOUNDRY_MODULE_DEFINITIONS[moduleInstance.moduleType]?.displayName ?? moduleInstance.moduleType} configuration updated.`),
        success: true,
        message: "Module configuration updated.",
    };
}
function resetTheaterModuleState(state, moduleId) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const nextTheater = cloneTheater(theater);
    if (!nextTheater.automation.moduleInstancesById[moduleId]) {
        return { state, success: false, message: "Module is no longer installed." };
    }
    delete nextTheater.automation.moduleRuntimeById[moduleId];
    return {
        state: buildConfiguredTheaterState(state, operation, nextTheater, `AUTOMATION :: Module runtime state reset.`),
        success: true,
        message: "Module state reset.",
    };
}
function installTheaterPartition(state, nodeAId, nodeBId, partitionType) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    const definition = foundrySystem_1.FOUNDRY_PARTITION_DEFINITIONS[partitionType];
    if (!operation || !theater || !definition) {
        return { state, success: false, message: "No active theater partition target." };
    }
    if (!(0, foundrySystem_1.isPartitionTypeUnlocked)(state, partitionType)) {
        return {
            state,
            success: false,
            message: `${definition.displayName} is still locked in the Foundry.`,
        };
    }
    const partitionSpendResult = (0, session_1.spendSessionCost)(state, { resources: definition.buildCost });
    if (!partitionSpendResult.success) {
        return {
            state,
            success: false,
            message: `Insufficient resources. Required: ${formatResourceCost(definition.buildCost)}.`,
        };
    }
    const nextTheater = cloneTheater(theater);
    const fromNode = (0, theaterAutomation_1.resolveTheaterNode)(nextTheater, nodeAId);
    const toNode = (0, theaterAutomation_1.resolveTheaterNode)(nextTheater, nodeBId);
    if (!fromNode || !toNode || !(0, theaterAutomation_1.getTheaterNodeAdjacency)(nextTheater, nodeAId).includes(nodeBId)) {
        return { state, success: false, message: "That connection is not valid for partition installation." };
    }
    const edgeId = (0, theaterAutomation_1.getTheaterEdgeId)(nodeAId, nodeBId);
    if (nextTheater.partitionsByEdgeId[edgeId]) {
        return { state, success: false, message: "A partition is already installed on that connection." };
    }
    const partition = {
        edgeId,
        partitionType,
        state: "open",
        automationHooks: {
            controllingModuleIds: [],
        },
    };
    nextTheater.partitionsByEdgeId[edgeId] = partition;
    return {
        state: buildConfiguredTheaterState(partitionSpendResult.state, operation, nextTheater, `PARTITION :: ${definition.displayName} installed between ${fromNode.label} and ${toNode.label}.`),
        success: true,
        message: `${definition.displayName} installed.`,
    };
}
function toggleTheaterPartitionState(state, edgeId, nextStateOverride) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const nextTheater = cloneTheater(theater);
    const partition = nextTheater.partitionsByEdgeId[edgeId];
    if (!partition) {
        return { state, success: false, message: "No partition is installed on that connection." };
    }
    partition.state = nextStateOverride ?? (partition.state === "open" ? "closed" : "open");
    console.log("[AUTOMATION] blast door state changed", edgeId, partition.state);
    return {
        state: buildConfiguredTheaterState(state, operation, nextTheater, `PARTITION :: ${foundrySystem_1.FOUNDRY_PARTITION_DEFINITIONS[partition.partitionType]?.displayName ?? "Partition"} ${partition.state.toUpperCase()} on ${edgeId}.`),
        success: true,
        message: `${partition.state === "open" ? "Opened" : "Closed"} ${foundrySystem_1.FOUNDRY_PARTITION_DEFINITIONS[partition.partitionType]?.displayName ?? "partition"}.`,
    };
}
function setTheaterRoomSignalPosture(state, roomId, posture) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const room = theater.rooms[roomId];
    if (!room) {
        return { state, success: false, message: "Selected room is unavailable." };
    }
    if (!room.secured) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "Secure the room before changing its signal posture.",
        };
    }
    room.sandboxSignalPosture = posture;
    const postureLabel = posture === "masked" ? "MASKED" : posture === "bait" ? "BAIT" : "NORMAL";
    return {
        state: buildConfiguredTheaterState(state, operation, theater, `SIGNATURE :: ${room.label} posture set to ${postureLabel}.`),
        success: true,
        message: `${room.label} signal posture updated.`,
    };
}
function setTheaterRoomContainmentMode(state, roomId, mode) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const nextTheater = cloneTheater(theater);
    const room = nextTheater.rooms[roomId];
    if (!room) {
        return { state, success: false, message: "Selected room is unavailable." };
    }
    if (!room.secured) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "Secure the room before changing containment posture.",
        };
    }
    room.sandboxContainmentMode = mode;
    if (mode === "venting" || mode === "lockdown") {
        room.adjacency.forEach((adjacentId) => {
            const edgeId = (0, theaterAutomation_1.getTheaterEdgeId)(room.id, adjacentId);
            const partition = nextTheater.partitionsByEdgeId?.[edgeId];
            if (partition?.partitionType === "blast_door") {
                partition.state = mode === "lockdown" ? "closed" : "open";
            }
        });
    }
    const label = mode === "venting" ? "VENTING" : mode === "lockdown" ? "LOCKDOWN" : "NORMAL";
    return {
        state: buildConfiguredTheaterState(state, operation, nextTheater, `CONTAINMENT :: ${room.label} set to ${label}.`),
        success: true,
        message: `${room.label} containment posture updated.`,
    };
}
function triggerTheaterEmergencyDump(state, roomId) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const nextTheater = cloneTheater(theater);
    const room = nextTheater.rooms[roomId];
    if (!room) {
        return { state, success: false, message: "Selected room is unavailable." };
    }
    if (!room.secured) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "Secure the room before dumping volatile stock.",
        };
    }
    if ((room.sandboxEmergencyDumpTicks ?? 0) > 0) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "Emergency dump is already running in that room.",
        };
    }
    room.sandboxEmergencyDumpTicks = 4;
    return {
        state: buildConfiguredTheaterState(state, operation, nextTheater, `CONTAINMENT :: ${room.label} initiated an emergency dump to reduce volatile load.`),
        success: true,
        message: `${room.label} emergency dump initiated.`,
    };
}
function moveToTheaterNode(state, nodeId) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return {
            state,
            roomId: "",
            squadId: null,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "No active theater operation.",
        };
    }
    const selectedSquad = getSelectedSquad(theater);
    if (!selectedSquad) {
        return {
            state,
            roomId: "",
            squadId: null,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "No active squad is available in this theater.",
        };
    }
    if (!canManuallyControlTheaterSquad(theater, selectedSquad)) {
        return {
            state: setTheaterSelectedNode(state, nodeId),
            roomId: selectedSquad.currentRoomId,
            squadId: selectedSquad.squadId,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: `${selectedSquad.squadId.toUpperCase()} is COMMS OFFLINE and cannot be moved manually.`,
        };
    }
    const destinationNode = (0, theaterAutomation_1.resolveTheaterNode)(theater, nodeId);
    const destinationRootRoomId = (0, theaterAutomation_1.getTheaterRootRoomIdForNode)(theater, nodeId);
    const originNodeId = (0, theaterAutomation_1.getTheaterCurrentNodeId)(theater);
    const originRootRoomId = selectedSquad.currentRoomId;
    if (!destinationNode || !destinationRootRoomId || !originNodeId) {
        return {
            state,
            roomId: originRootRoomId,
            squadId: selectedSquad.squadId,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "Target node is not part of this theater.",
        };
    }
    const destinationRootRoom = theater.rooms[destinationRootRoomId];
    if (!destinationRootRoom) {
        return {
            state,
            roomId: originRootRoomId,
            squadId: selectedSquad.squadId,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "Target room is not part of this theater.",
        };
    }
    if (destinationNode.kind === "room" && isTheaterRoomLocked(theater, destinationRootRoom)) {
        return {
            state: setTheaterSelectedNode(state, nodeId),
            roomId: destinationRootRoomId,
            squadId: selectedSquad.squadId,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: `${formatTheaterKeyLabel(destinationRootRoom.requiredKeyType)} required to access that room.`,
        };
    }
    if (destinationNode.kind === "room" && destinationRootRoom.status === "unknown" && !destinationRootRoom.commsVisible) {
        return {
            state: setTheaterSelectedNode(state, nodeId),
            roomId: destinationRootRoomId,
            squadId: selectedSquad.squadId,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "Comms cannot verify this room yet.",
        };
    }
    const route = (0, theaterAutomation_1.findTheaterNodeRoute)(theater, originNodeId, nodeId, {
        allowUnsecuredDestination: destinationNode.kind === "room",
    });
    if (!route) {
        return {
            state: setTheaterSelectedNode(state, nodeId),
            roomId: destinationRootRoomId,
            squadId: selectedSquad.squadId,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "No secured route reaches that node yet.",
        };
    }
    if (originNodeId === nodeId) {
        return {
            state: setTheaterSelectedNode(state, nodeId),
            roomId: destinationRootRoomId,
            squadId: selectedSquad.squadId,
            path: [destinationRootRoomId],
            nodePath: [nodeId],
            tickCost: 0,
            requiresBattle: destinationNode.kind === "room" && (isDefenseBattleRoom(destinationRootRoom) || (!destinationRootRoom.secured && destinationRootRoom.clearMode === "battle" && destinationRootRoom.tacticalEncounter !== null)),
            requiresField: destinationNode.kind === "room" && !destinationRootRoom.secured && destinationRootRoom.clearMode === "field",
        };
    }
    const tickCost = route.slice(1).reduce((total, stepNodeId) => total + (0, theaterAutomation_1.getTheaterNodeMoveTickCost)(theater, stepNodeId), 0);
    const roomPath = route.reduce((path, stepNodeId) => {
        const rootId = (0, theaterAutomation_1.getTheaterRootRoomIdForNode)(theater, stepNodeId);
        if (!rootId) {
            return path;
        }
        if (path[path.length - 1] !== rootId) {
            path.push(rootId);
        }
        return path;
    }, []);
    const economyResolution = applyTheaterSessionEconomyForTicks(state, theater, tickCost);
    let nextState = economyResolution.state;
    let nextTheater = economyResolution.theater;
    nextTheater.currentRoomId = destinationRootRoomId;
    nextTheater.selectedRoomId = destinationRootRoomId;
    nextTheater.currentNodeId = nodeId;
    nextTheater.selectedNodeId = nodeId;
    const nextSelectedSquad = nextTheater.squads.find((squad) => squad.squadId === selectedSquad.squadId);
    if (nextSelectedSquad) {
        nextSelectedSquad.currentRoomId = destinationRootRoomId;
        nextSelectedSquad.currentNodeId = nodeId;
        nextSelectedSquad.status = "moving";
        nextSelectedSquad.automationMode = "manual";
        nextSelectedSquad.autoStatus = "idle";
        nextSelectedSquad.autoTargetRoomId = null;
    }
    if (destinationNode.kind === "room" && destinationRootRoom.status === "unknown") {
        nextTheater.rooms[destinationRootRoomId].status = "mapped";
    }
    if (destinationNode.kind === "room") {
        nextTheater = autoResolveNonCombatRoom(nextTheater, destinationRootRoomId);
    }
    nextTheater = advanceOccupationObjective(nextTheater, tickCost);
    nextState = advanceTheaterRuntimeTicks(nextState, nextTheater, tickCost);
    nextState = recoverOperationalSquadsAtMedicalWards(nextState);
    const runtimeTheater = getPreparedTheaterOperation(nextState)?.theater ?? nextTheater;
    const runtimeDestinationRoom = runtimeTheater.rooms[destinationRootRoomId] ?? destinationRootRoom;
    return {
        state: nextState,
        roomId: destinationRootRoomId,
        squadId: selectedSquad.squadId,
        path: roomPath.length > 0 ? roomPath : [destinationRootRoomId],
        nodePath: route,
        tickCost,
        requiresBattle: destinationNode.kind === "room" && (isDefenseBattleRoom(runtimeDestinationRoom) || (!runtimeDestinationRoom.secured && runtimeDestinationRoom.clearMode === "battle" && runtimeDestinationRoom.tacticalEncounter !== null)),
        requiresField: destinationNode.kind === "room" && !runtimeDestinationRoom.secured && runtimeDestinationRoom.clearMode === "field",
    };
}
function advanceMountedTheaterRuntimeTicks(state, theater, ticks) {
    let nextState = {
        ...state,
        phase: "operation",
        operation: state.operation ? resolveOperationFields(state.operation, theater) : state.operation,
    };
    for (let tickIndex = 0; tickIndex < ticks; tickIndex += 1) {
        const operation = getPreparedTheaterOperation(nextState);
        const activeTheater = operation?.theater;
        if (!operation || !activeTheater) {
            break;
        }
        const nextTheater = cloneTheater(activeTheater);
        nextTheater.tickCount += 1;
        const afterThreats = applySandboxSlice((0, theaterAutomation_1.evaluateTheaterAutomation)(resolveEnemyRoomThreats(nextState, nextTheater)), activeTheater, true);
        nextState = {
            ...nextState,
            operation: resolveOperationFields(operation, afterThreats),
        };
        if (operation.id) {
            nextState = (0, operationStatuses_1.expireShakenStatusesForTheater)(nextState, operation.id, nextTheater.definition.id, nextTheater.tickCount);
        }
        nextState = advanceAutomatedSquads(nextState);
    }
    return nextState;
}
function advanceParallelCoopTheaterContexts(state, activeTheaterId, ticks) {
    if (ticks <= 0
        || state.session.mode !== "coop_operations"
        || state.session.authorityRole !== "host") {
        return state;
    }
    const busyTheaterIds = new Set(Object.values(state.session.activeBattleContexts)
        .map((context) => context.theaterId)
        .filter((theaterId) => Boolean(theaterId)));
    return Object.entries(state.session.activeTheaterContexts).reduce((nextState, [theaterId, context]) => {
        if (theaterId === activeTheaterId
            || context.phase === "battle"
            || busyTheaterIds.has(theaterId)) {
            return nextState;
        }
        const runtimeTheater = parseTheaterRuntimeSnapshot(context.snapshot);
        if (!runtimeTheater) {
            return nextState;
        }
        const scopedState = {
            ...nextState,
            phase: "operation",
            currentBattle: null,
            operation: nextState.operation
                ? resolveOperationFields(nextState.operation, runtimeTheater)
                : nextState.operation,
            session: {
                ...nextState.session,
                pendingTheaterBattleConfirmation: context.pendingTheaterBattleConfirmation ?? null,
            },
        };
        let advancedScopedState = advanceMountedTheaterRuntimeTicks(scopedState, runtimeTheater, ticks);
        advancedScopedState = recoverOperationalSquadsAtMedicalWards(advancedScopedState);
        return mergeTheaterRuntimeState(nextState, advancedScopedState, theaterId);
    }, state);
}
function advanceTheaterRuntimeTicks(state, theater, ticks) {
    const mountedState = advanceMountedTheaterRuntimeTicks(state, theater, ticks);
    return advanceParallelCoopTheaterContexts(mountedState, theater.definition.id, ticks);
}
function moveToTheaterRoom(state, roomId) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return {
            state,
            roomId,
            squadId: null,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "No active theater operation.",
        };
    }
    const selectedSquad = getSelectedSquad(theater);
    if (!selectedSquad) {
        return {
            state,
            roomId,
            squadId: null,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "No active squad is available in this theater.",
        };
    }
    if (!canManuallyControlTheaterSquad(theater, selectedSquad)) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            roomId,
            squadId: selectedSquad.squadId,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: `${selectedSquad.squadId.toUpperCase()} is COMMS OFFLINE and cannot be moved manually.`,
        };
    }
    const currentRoom = theater.rooms[selectedSquad.currentRoomId];
    const destination = theater.rooms[roomId];
    if (!currentRoom || !destination) {
        return {
            state,
            roomId,
            squadId: selectedSquad.squadId,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "Target room is not part of this theater.",
        };
    }
    if (isTheaterRoomLocked(theater, destination)) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            roomId,
            squadId: selectedSquad.squadId,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: `${formatTheaterKeyLabel(destination.requiredKeyType)} required to access that room.`,
        };
    }
    const route = findTheaterRoute(theater, roomId);
    if (!route) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            roomId,
            squadId: selectedSquad.squadId,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "No secured route reaches that room yet.",
        };
    }
    if (currentRoom.id === destination.id) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            roomId,
            squadId: selectedSquad.squadId,
            path: route,
            tickCost: 0,
            requiresBattle: isDefenseBattleRoom(destination) || (!destination.secured && destination.clearMode === "battle" && destination.tacticalEncounter !== null),
            requiresField: !destination.secured && destination.clearMode === "field",
        };
    }
    if (destination.status === "unknown" && !destination.commsVisible) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            roomId,
            squadId: selectedSquad.squadId,
            path: route,
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "Comms cannot verify this room yet.",
        };
    }
    const tickCost = route.slice(1).reduce((total, stepRoomId) => total + getMoveTickCost(theater, stepRoomId), 0);
    const economyResolution = applyTheaterSessionEconomyForTicks(state, theater, tickCost);
    let nextState = economyResolution.state;
    let nextTheater = economyResolution.theater;
    const destinationRoom = nextTheater.rooms[roomId];
    nextTheater.currentRoomId = roomId;
    nextTheater.selectedRoomId = roomId;
    const nextSelectedSquad = nextTheater.squads.find((squad) => squad.squadId === selectedSquad.squadId);
    if (nextSelectedSquad) {
        nextSelectedSquad.currentRoomId = roomId;
        nextSelectedSquad.status = "moving";
        nextSelectedSquad.automationMode = "manual";
        nextSelectedSquad.autoStatus = "idle";
        nextSelectedSquad.autoTargetRoomId = null;
    }
    if (destinationRoom.status === "unknown") {
        destinationRoom.status = "mapped";
    }
    nextTheater = autoResolveNonCombatRoom(nextTheater, roomId);
    nextTheater = advanceOccupationObjective(nextTheater, tickCost);
    nextState = advanceTheaterRuntimeTicks(nextState, nextTheater, tickCost);
    nextState = recoverOperationalSquadsAtMedicalWards(nextState);
    const nextOperation = getPreparedTheaterOperation(nextState);
    const runtimeTheater = nextOperation?.theater ?? nextTheater;
    const runtimeDestinationRoom = runtimeTheater.rooms[roomId] ?? destinationRoom;
    return {
        state: nextState,
        roomId,
        squadId: selectedSquad.squadId,
        path: route,
        tickCost,
        requiresBattle: isDefenseBattleRoom(runtimeDestinationRoom) || (!runtimeDestinationRoom.secured && runtimeDestinationRoom.clearMode === "battle" && runtimeDestinationRoom.tacticalEncounter !== null),
        requiresField: !runtimeDestinationRoom.secured && runtimeDestinationRoom.clearMode === "field",
    };
}
function holdPositionInTheater(state, ticks = 1) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return {
            state,
            roomId: "",
            squadId: null,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "No active theater operation.",
        };
    }
    const selectedSquad = getSelectedSquad(theater);
    if (!selectedSquad) {
        return {
            state,
            roomId: "",
            squadId: null,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "No active squad is available in this theater.",
        };
    }
    if (!canManuallyControlTheaterSquad(theater, selectedSquad)) {
        return {
            state,
            roomId: selectedSquad.currentRoomId,
            squadId: selectedSquad.squadId,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: `${selectedSquad.squadId.toUpperCase()} is COMMS OFFLINE and cannot receive hold orders.`,
        };
    }
    const resolvedTicks = Math.max(1, Math.floor(ticks));
    const currentRoom = theater.rooms[selectedSquad.currentRoomId];
    if (!currentRoom) {
        return {
            state,
            roomId: selectedSquad.currentRoomId,
            squadId: selectedSquad.squadId,
            path: [],
            tickCost: 0,
            requiresBattle: false,
            requiresField: false,
            error: "Current room is not available.",
        };
    }
    const economyResolution = applyTheaterSessionEconomyForTicks(state, theater, resolvedTicks);
    let nextState = economyResolution.state;
    let nextTheater = economyResolution.theater;
    nextTheater.currentRoomId = currentRoom.id;
    nextTheater.selectedRoomId = currentRoom.id;
    nextTheater = advanceOccupationObjective(nextTheater, resolvedTicks);
    const holdingSquad = findSquad(nextTheater, selectedSquad.squadId);
    if (holdingSquad) {
        holdingSquad.automationMode = "manual";
        holdingSquad.autoStatus = "holding";
        holdingSquad.autoTargetRoomId = null;
    }
    nextState = advanceTheaterRuntimeTicks(nextState, nextTheater, resolvedTicks);
    nextState = recoverOperationalSquadsAtMedicalWards(nextState);
    const nextOperation = getPreparedTheaterOperation(nextState);
    const runtimeTheater = nextOperation?.theater ?? nextTheater;
    const nextCurrentRoom = runtimeTheater.rooms[currentRoom.id] ?? currentRoom;
    return {
        state: nextState,
        roomId: currentRoom.id,
        squadId: selectedSquad.squadId,
        path: [currentRoom.id],
        tickCost: resolvedTicks,
        requiresBattle: isDefenseBattleRoom(nextCurrentRoom),
        requiresField: false,
    };
}
function getSelectedTheaterSquad(theater) {
    return getSelectedSquad(theater);
}
function getTheaterObjectiveDefinition(theater) {
    return theater.objectiveDefinition ? { ...theater.objectiveDefinition, progress: { ...theater.objectiveDefinition.progress } } : null;
}
function findAnyTheaterRoute(theater, fromRoomId, toRoomId) {
    if (fromRoomId === toRoomId) {
        return [fromRoomId];
    }
    const queue = [fromRoomId];
    const previous = new Map([[fromRoomId, null]]);
    while (queue.length > 0) {
        const currentRoomId = queue.shift();
        const currentRoom = theater.rooms[currentRoomId];
        if (!currentRoom) {
            continue;
        }
        for (const adjacentId of currentRoom.adjacency) {
            if (!(0, theaterAutomation_1.canTraverseTheaterEdge)(theater, currentRoomId, adjacentId)) {
                continue;
            }
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
function getVisibleThreatCount(theater) {
    return theater.activeThreats.filter((threat) => threat.active).length;
}
function selectPatrolTargetRoom(theater, sourceRoomId) {
    const ingressRoom = theater.rooms[theater.definition.ingressRoomId] ?? null;
    const candidates = Object.values(theater.rooms)
        .filter((room) => room.id !== sourceRoomId && room.secured);
    let bestRoom = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    candidates.forEach((room) => {
        const hasOperationalCore = roomHasOperationalCore(room);
        const posture = getSandboxSignalPosture(room);
        const isFrontier = room.adjacency.some((adjacentId) => !theater.rooms[adjacentId]?.secured);
        const isMajorRoute = room.supplyFlow > 0 || room.powerFlow > 0 || room.commsFlow > 0;
        const industrialNoise = roomHasOperationalCoreType(room, "mine")
            || roomHasOperationalCoreType(room, "refinery")
            || roomHasOperationalCoreType(room, "generator")
            || (0, theaterAutomation_1.getAutomatedTurretCountForRoom)(theater, room.id) > 0;
        const postureScore = posture === "masked" ? -35 : posture === "bait" ? 55 : 0;
        const score = (hasOperationalCore ? 100 : 0)
            + (isFrontier ? 70 : 0)
            + (isMajorRoute ? 40 : 0)
            + (industrialNoise ? 18 : 0)
            + room.depthFromUplink
            + (getSandboxCommsAttraction(room) * 2)
            + ((room.sandboxSignalBloom ?? false) ? 12 : 0)
            + (room.underThreat ? -20 : 0)
            + postureScore;
        if (score > bestScore) {
            bestScore = score;
            bestRoom = room;
        }
    });
    return bestRoom ?? ingressRoom;
}
function dispatchStagingThreats(theater) {
    let next = cloneTheater(theater);
    const activeThreatCount = getVisibleThreatCount(next);
    if (activeThreatCount >= 3) {
        return next;
    }
    Object.values(next.rooms).forEach((room) => {
        if (!room.enemySite || room.secured || getVisibleThreatCount(next) >= 3) {
            return;
        }
        if (next.tickCount < room.enemySite.nextDispatchTick) {
            return;
        }
        const targetRoom = selectPatrolTargetRoom(next, room.id);
        const route = targetRoom ? findAnyTheaterRoute(next, room.id, targetRoom.id) : null;
        if (!targetRoom || !route || route.length <= 1) {
            room.enemySite = {
                ...room.enemySite,
                nextDispatchTick: next.tickCount + room.enemySite.dispatchInterval,
            };
            return;
        }
        room.enemySite = {
            ...room.enemySite,
            nextDispatchTick: next.tickCount + room.enemySite.dispatchInterval,
        };
        const threat = {
            id: `patrol_${next.definition.id}_${room.id}_${next.tickCount}_${next.activeThreats.length + 1}`,
            type: "patrol",
            roomId: room.id,
            sourceRoomId: room.id,
            currentRoomId: room.id,
            targetRoomId: targetRoom.id,
            route,
            routeIndex: 0,
            etaTick: next.tickCount + Math.max(1, route.length - 1),
            strength: Math.max(1, room.enemySite.patrolStrength),
            cause: `Patrol launched from ${room.label}`,
            severity: Math.max(1, room.enemySite.reserveStrength),
            spawnedAtTick: next.tickCount,
            active: true,
        };
        console.log("[THEATER] threat event triggered", threat.id, threat.sourceRoomId, threat.targetRoomId);
        next.activeThreats = [...next.activeThreats, threat].slice(-8);
        next = addTheaterEvent(next, room.commsVisible
            ? `PATROL :: Hostile squad departing ${room.label} toward ${targetRoom.label}.`
            : `PATROL :: Enemy movement detected in the active theater.`);
    });
    return next;
}
function advancePatrolThreats(theater) {
    let next = cloneTheater(theater);
    let pendingDamage = [];
    next.activeThreats = next.activeThreats.map((threat) => {
        if (!threat.active) {
            return threat;
        }
        const currentRoom = next.rooms[threat.currentRoomId];
        const targetRoom = next.rooms[threat.targetRoomId];
        if (!currentRoom || !targetRoom) {
            return { ...threat, active: false };
        }
        if (threat.routeIndex >= threat.route.length - 1) {
            if (targetRoom.secured) {
                targetRoom.underThreat = true;
                if (next.tickCount > threat.etaTick) {
                    pendingDamage.push({ roomId: targetRoom.id, reason: `${currentRoom.label} patrol broke through` });
                    return { ...threat, active: false };
                }
            }
            return {
                ...threat,
                roomId: targetRoom.id,
                currentRoomId: targetRoom.id,
            };
        }
        const nextRouteIndex = Math.min(threat.route.length - 1, threat.routeIndex + 1);
        const nextRoomId = threat.route[nextRouteIndex] ?? threat.currentRoomId;
        const nextRoom = next.rooms[nextRoomId];
        if (!nextRoom) {
            return { ...threat, active: false };
        }
        if (!(0, theaterAutomation_1.canTraverseTheaterEdge)(next, threat.currentRoomId, nextRoomId)) {
            return threat;
        }
        if (nextRoom.secured) {
            nextRoom.underThreat = true;
        }
        return {
            ...threat,
            roomId: nextRoomId,
            currentRoomId: nextRoomId,
            routeIndex: nextRouteIndex,
            etaTick: nextRouteIndex >= threat.route.length - 1 ? next.tickCount : threat.etaTick,
        };
    });
    pendingDamage.forEach(({ roomId, reason }) => {
        next = resolveThreatDamage(next, roomId, reason, false);
    });
    return next;
}
function getRoomDistance(theater, fromRoomId, toRoomId) {
    const route = findAnyTheaterRoute(theater, fromRoomId, toRoomId);
    return route ? Math.max(0, route.length - 1) : Number.POSITIVE_INFINITY;
}
function findThreatForSquad(theater, squad) {
    const localThreats = theater.activeThreats
        .filter((threat) => threat.active && theater.rooms[threat.currentRoomId]?.commsVisible)
        .filter((threat) => getRoomDistance(theater, squad.currentRoomId, threat.currentRoomId) <= 2)
        .sort((left, right) => (getRoomDistance(theater, squad.currentRoomId, left.currentRoomId)
        - getRoomDistance(theater, squad.currentRoomId, right.currentRoomId)));
    return localThreats[0] ?? null;
}
function setThreatResolved(theater, roomId) {
    const next = cloneTheater(theater);
    const room = next.rooms[roomId];
    if (room) {
        room.underThreat = false;
        room.damaged = false;
    }
    next.activeThreats = next.activeThreats.map((threat) => threat.currentRoomId === roomId || threat.targetRoomId === roomId
        ? { ...threat, active: false }
        : threat);
    return next;
}
function runAutoSquadStep(state, squadId, mode) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return state;
    }
    const squad = findSquad(theater, squadId);
    if (!squad) {
        return state;
    }
    const room = theater.rooms[squad.currentRoomId];
    if (!room) {
        return state;
    }
    const operationId = operation.id;
    const theaterId = theater.definition.id;
    if (!operationId || !theaterId) {
        return state;
    }
    const combatReadyUnitIds = getSquadCombatReadyUnitIds(state, operationId, theaterId, squad);
    const incapacitatedUnitIds = getSquadIncapacitatedUnitIds(state, operationId, theaterId, squad);
    if (incapacitatedUnitIds.length > 0) {
        if (roomHasOperationalCoreType(room, "medical_ward")) {
            const nextTheater = cloneTheater(theater);
            const nextSquad = findSquad(nextTheater, squad.squadId);
            if (nextSquad) {
                nextSquad.autoStatus = "recovering";
                nextSquad.autoTargetRoomId = room.id;
            }
            return {
                ...state,
                operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater)),
            };
        }
        const nearestMedicalWard = Object.values(theater.rooms)
            .filter((candidate) => candidate.secured && roomHasOperationalCoreType(candidate, "medical_ward"))
            .map((candidate) => ({
            room: candidate,
            route: findAnyTheaterRoute(theater, squad.currentRoomId, candidate.id),
        }))
            .filter((candidate) => Boolean(candidate.route && candidate.route.length > 0))
            .sort((left, right) => left.route.length - right.route.length)[0] ?? null;
        if (nearestMedicalWard && nearestMedicalWard.route.length > 1) {
            const nextRoomId = nearestMedicalWard.route[1];
            const nextTheater = cloneTheater(theater);
            const nextSquad = findSquad(nextTheater, squad.squadId);
            if (nextSquad) {
                nextSquad.currentRoomId = nextRoomId;
                nextSquad.autoStatus = "recovering";
                nextSquad.autoTargetRoomId = nearestMedicalWard.room.id;
            }
            return {
                ...state,
                operation: resolveOperationFields(operation, addTheaterEvent(recomputeTheaterNetwork(nextTheater), `AUTO-${mode.toUpperCase()} :: ${squad.displayName} falling back toward ${nearestMedicalWard.room.label} for casualty recovery.`)),
            };
        }
    }
    if (combatReadyUnitIds.length <= 0) {
        const nextTheater = cloneTheater(theater);
        const nextSquad = findSquad(nextTheater, squad.squadId);
        if (nextSquad) {
            nextSquad.autoStatus = "recovering";
            nextSquad.autoTargetRoomId = null;
        }
        return {
            ...state,
            operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater)),
        };
    }
    const threat = findThreatForSquad(theater, squad);
    if (room.underThreat || room.damaged || threat?.currentRoomId === squad.currentRoomId) {
        const stagedTheater = cloneTheater(theater);
        const stagedSquad = findSquad(stagedTheater, squad.squadId);
        if (stagedSquad) {
            stagedSquad.autoStatus = "intercepting";
            stagedSquad.autoTargetRoomId = squad.currentRoomId;
        }
        const stagedState = {
            ...state,
            operation: resolveOperationFields(operation, recomputeTheaterNetwork(stagedTheater)),
        };
        const resolved = resolveTheaterAutoBattle(stagedState, squad.squadId, squad.currentRoomId, mode);
        const nextOperation = getPreparedTheaterOperation(resolved);
        const nextTheater = nextOperation?.theater;
        if (!nextOperation || !nextTheater) {
            return resolved;
        }
        return {
            ...resolved,
            operation: resolveOperationFields(nextOperation, addTheaterEvent(setThreatResolved(nextTheater, squad.currentRoomId), `AUTO-${mode.toUpperCase()} :: ${squad.displayName} intercepted hostile contact in ${room.label}.`)),
        };
    }
    if (threat) {
        const route = findAnyTheaterRoute(theater, squad.currentRoomId, threat.currentRoomId);
        if (route && route.length > 1) {
            const nextRoomId = route[1];
            const nextTheater = cloneTheater(theater);
            const nextSquad = findSquad(nextTheater, squad.squadId);
            if (nextSquad) {
                nextSquad.currentRoomId = nextRoomId;
                nextSquad.autoStatus = "intercepting";
                nextSquad.autoTargetRoomId = threat.currentRoomId;
            }
            nextTheater.currentRoomId = theater.currentRoomId;
            nextTheater.selectedRoomId = theater.selectedRoomId;
            return {
                ...state,
                operation: resolveOperationFields(operation, addTheaterEvent(recomputeTheaterNetwork(nextTheater), `AUTO-${mode.toUpperCase()} :: ${squad.displayName} redeploying toward ${nextTheater.rooms[nextRoomId]?.label ?? nextRoomId}.`)),
            };
        }
    }
    const adjacentPushTarget = room.adjacency
        .map((adjacentId) => theater.rooms[adjacentId])
        .filter((candidate) => Boolean(candidate))
        .find((candidate) => (candidate.commsVisible
        && !candidate.secured
        && (mode === "daring" || !candidate.tags.includes("enemy_staging"))));
    if (adjacentPushTarget) {
        const stagedTheater = cloneTheater(theater);
        const stagedSquad = findSquad(stagedTheater, squad.squadId);
        if (stagedSquad) {
            stagedSquad.currentRoomId = adjacentPushTarget.id;
            stagedSquad.autoStatus = "pushing";
            stagedSquad.autoTargetRoomId = adjacentPushTarget.id;
        }
        const stagedState = {
            ...state,
            operation: resolveOperationFields(operation, recomputeTheaterNetwork(stagedTheater)),
        };
        if (adjacentPushTarget.clearMode !== "battle" || !adjacentPushTarget.tacticalEncounter) {
            return secureTheaterRoomInState(stagedState, adjacentPushTarget.id, squad.squadId);
        }
        const resolved = resolveTheaterAutoBattle(stagedState, squad.squadId, adjacentPushTarget.id, mode);
        return resolved;
    }
    const nextTheater = cloneTheater(theater);
    const nextSquad = findSquad(nextTheater, squad.squadId);
    if (nextSquad) {
        nextSquad.autoStatus = "holding";
        nextSquad.autoTargetRoomId = null;
    }
    return {
        ...state,
        operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater)),
    };
}
function advanceAutomatedSquads(state) {
    let nextState = state;
    const operation = getPreparedTheaterOperation(nextState);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return nextState;
    }
    theater.squads
        .filter((squad) => squad.automationMode !== "manual")
        .forEach((squad) => {
        nextState = runAutoSquadStep(nextState, squad.squadId, squad.automationMode);
    });
    return recoverOperationalSquadsAtMedicalWards(nextState);
}
function areEnemyRoomAttacksDisabled(_state) {
    // Legacy debug toggle removed from the theater UI. Ignore any stale saved flag.
    return false;
}
function clearTheaterThreatPressure(theater) {
    const hasActiveThreats = theater.activeThreats.some((threat) => threat.active);
    const hasThreatenedRooms = Object.values(theater.rooms).some((room) => room.underThreat);
    if (!hasActiveThreats && !hasThreatenedRooms) {
        return theater;
    }
    const next = cloneTheater(theater);
    Object.values(next.rooms).forEach((room) => {
        room.underThreat = false;
    });
    next.activeThreats = next.activeThreats.map((threat) => ({ ...threat, active: false }));
    return recomputeTheaterNetwork(next);
}
function resolveEnemyRoomThreats(state, theater) {
    if (areEnemyRoomAttacksDisabled(state)) {
        return clearTheaterThreatPressure(recomputeTheaterNetwork(theater));
    }
    return advancePatrolThreats(dispatchStagingThreats(recomputeTheaterNetwork(theater)));
}
function selectTheaterSquad(state, squadId) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const squad = findSquad(theater, squadId);
    if (!squad) {
        return { state, success: false, message: "Squad not found." };
    }
    const nextTheater = cloneTheater(theater);
    nextTheater.selectedSquadId = squadId;
    nextTheater.currentRoomId = squad.currentRoomId;
    nextTheater.selectedRoomId = squad.currentRoomId;
    nextTheater.currentNodeId = squad.currentNodeId ?? squad.currentRoomId;
    nextTheater.selectedNodeId = squad.currentNodeId ?? squad.currentRoomId;
    const nextSquad = findSquad(nextTheater, squadId);
    if (nextSquad) {
        nextSquad.automationMode = "manual";
        nextSquad.autoStatus = "idle";
        nextSquad.autoTargetRoomId = null;
    }
    return {
        state: {
            ...state,
            phase: "operation",
            operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater)),
        },
        success: true,
        message: `${squadId.toUpperCase()} selected and set to manual control.`,
    };
}
function setTheaterSquadAutomationMode(state, squadId, automationMode) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const squad = findSquad(theater, squadId);
    if (!squad) {
        return { state, success: false, message: "Squad not found." };
    }
    const nextTheater = cloneTheater(theater);
    const nextSquad = findSquad(nextTheater, squadId);
    if (!nextSquad) {
        return { state, success: false, message: "Squad not found." };
    }
    nextSquad.automationMode = automationMode;
    nextSquad.autoStatus = automationMode === "manual" ? "idle" : "holding";
    nextSquad.autoTargetRoomId = null;
    if (automationMode !== "manual" && nextTheater.selectedSquadId === squadId) {
        const fallbackManualSquad = nextTheater.squads.find((candidate) => candidate.squadId !== squadId && candidate.automationMode === "manual" && candidate.isInContact) ?? nextTheater.squads.find((candidate) => candidate.squadId !== squadId && candidate.automationMode === "manual") ?? null;
        nextTheater.selectedSquadId = fallbackManualSquad?.squadId ?? squadId;
    }
    const stateAfterModeChange = {
        ...state,
        phase: "operation",
        operation: resolveOperationFields(operation, addTheaterEvent(recomputeTheaterNetwork(nextTheater), `SQUAD MODE :: ${nextSquad.displayName} set to ${automationMode.toUpperCase()}.`)),
    };
    const activatedState = automationMode === "manual"
        ? stateAfterModeChange
        : runAutoSquadStep(stateAfterModeChange, squadId, automationMode);
    return {
        state: activatedState,
        success: true,
        message: `${nextSquad.displayName} set to ${automationMode}.`,
    };
}
function renameTheaterSquad(state, squadId, displayName) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const squad = findSquad(theater, squadId);
    if (!squad) {
        return { state, success: false, message: "Squad not found." };
    }
    const nextTheater = cloneTheater(theater);
    const nextSquad = findSquad(nextTheater, squadId);
    if (!nextSquad) {
        return { state, success: false, message: "Squad not found." };
    }
    nextSquad.displayName = clampSquadName(displayName, nextSquad.displayName || squad.squadId.toUpperCase());
    return {
        state: {
            ...state,
            phase: "operation",
            operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater)),
        },
        success: true,
        message: `${nextSquad.displayName} updated.`,
    };
}
function useTheaterConsumable(state, targetUnitId, consumableId) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const consumable = crafting_1.CONSUMABLE_DATABASE[consumableId];
    const quantity = state.consumables?.[consumableId] ?? 0;
    if (!consumable || quantity <= 0) {
        return { state, success: false, message: "That consumable is not available." };
    }
    const squad = theater.squads.find((entry) => entry.unitIds.includes(targetUnitId));
    const unit = state.unitsById[targetUnitId];
    if (!squad || !unit || unit.isEnemy) {
        return { state, success: false, message: "That operator is not available in the current theater." };
    }
    const nextConsumables = { ...(state.consumables ?? {}) };
    if (quantity <= 1) {
        delete nextConsumables[consumableId];
    }
    else {
        nextConsumables[consumableId] = quantity - 1;
    }
    let nextUnit = unit;
    let eventLine = "";
    let message = "";
    if (consumable.effect === "heal") {
        const nextHp = Math.min(unit.maxHp, unit.hp + consumable.value);
        const healedAmount = nextHp - unit.hp;
        if (healedAmount <= 0) {
            return { state, success: false, message: `${unit.name} is already at full integrity.` };
        }
        nextUnit = {
            ...unit,
            hp: nextHp,
        };
        eventLine = `THEATER//ITEM :: ${unit.name} restores ${healedAmount} HP via ${consumable.name.toUpperCase()}.`;
        message = `${consumable.name} restores ${healedAmount} HP to ${unit.name}.`;
    }
    else if (consumable.effect === "attack_boost") {
        nextUnit = {
            ...unit,
            buffs: [
                ...(unit.buffs ?? []),
                {
                    id: `theater_consumable_atk_up_${Date.now()}`,
                    type: "atk_up",
                    amount: consumable.value,
                    duration: 1,
                },
            ],
        };
        eventLine = `THEATER//ITEM :: ${unit.name} primes ${consumable.name.toUpperCase()} for +${consumable.value} ATK on deployment.`;
        message = `${consumable.name} primes ${unit.name} for the next battle.`;
    }
    else {
        return {
            state,
            success: false,
            message: `${consumable.name} can only be used during tactical battle turns.`,
        };
    }
    const nextTheater = addTheaterEvent(cloneTheater(theater), eventLine);
    return {
        state: {
            ...state,
            phase: "operation",
            consumables: nextConsumables,
            unitsById: {
                ...state.unitsById,
                [targetUnitId]: nextUnit,
            },
            operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater)),
        },
        success: true,
        message,
    };
}
function setTheaterSquadIcon(state, squadId, icon) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const squad = findSquad(theater, squadId);
    if (!squad) {
        return { state, success: false, message: "Squad not found." };
    }
    const nextTheater = cloneTheater(theater);
    const nextSquad = findSquad(nextTheater, squadId);
    if (!nextSquad) {
        return { state, success: false, message: "Squad not found." };
    }
    nextSquad.icon = normalizeSquadIcon(icon, exports.THEATER_SQUAD_ICON_CHOICES.indexOf(nextSquad.icon));
    return {
        state: {
            ...state,
            phase: "operation",
            operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater)),
        },
        success: true,
        message: `${nextSquad.displayName} icon updated.`,
    };
}
function setTheaterSquadColor(state, squadId, colorKey) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const squad = findSquad(theater, squadId);
    if (!squad) {
        return { state, success: false, message: "Squad not found." };
    }
    const nextTheater = cloneTheater(theater);
    const nextSquad = findSquad(nextTheater, squadId);
    if (!nextSquad) {
        return { state, success: false, message: "Squad not found." };
    }
    nextSquad.colorKey = normalizeSquadColorKey(colorKey, exports.THEATER_SQUAD_COLOR_CHOICES.indexOf(nextSquad.colorKey));
    return {
        state: {
            ...state,
            phase: "operation",
            operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater)),
        },
        success: true,
        message: `${nextSquad.displayName} color updated.`,
    };
}
function splitUnitToNewSquad(state, squadId, unitId) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const squad = findSquad(theater, squadId);
    if (!squad || !squad.unitIds.includes(unitId)) {
        return { state, success: false, message: "Unit is not part of that squad." };
    }
    const operationId = operation.id;
    const theaterId = theater.definition.id;
    if (!operationId || !theaterId) {
        return { state, success: false, message: "Operation context is incomplete." };
    }
    if (isUnitOperationIncapacitated(state.unitsById[unitId], operationId, theaterId)) {
        return { state, success: false, message: "Incapacitated units must be recovered at a Medical Ward before reassignment." };
    }
    if (squad.unitIds.length <= 1) {
        return { state, success: false, message: "Each squad must keep at least one unit." };
    }
    const nextTheater = cloneTheater(theater);
    const donor = findSquad(nextTheater, squadId);
    if (!donor) {
        return { state, success: false, message: "Squad is no longer available." };
    }
    donor.unitIds = donor.unitIds.filter((id) => id !== unitId);
    const newSquadOrderIndex = getNextSquadOrderIndex(nextTheater);
    nextTheater.squads.push(buildSquadState(getNextSquadId(nextTheater), [unitId], donor.currentRoomId, nextTheater.definition.id, {
        displayName: formatDefaultSquadName(newSquadOrderIndex),
        icon: normalizeSquadIcon(undefined, newSquadOrderIndex),
        colorKey: normalizeSquadColorKey(undefined, newSquadOrderIndex),
        orderIndex: newSquadOrderIndex,
    }));
    console.log("[THEATER] squad split", squadId, unitId);
    return {
        state: {
            ...state,
            phase: "operation",
            operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater)),
        },
        success: true,
        message: `${unitId} split into a new squad.`,
    };
}
function transferUnitBetweenSquads(state, fromSquadId, toSquadId, unitId) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const fromSquad = findSquad(theater, fromSquadId);
    const toSquad = findSquad(theater, toSquadId);
    if (!fromSquad || !toSquad || !fromSquad.unitIds.includes(unitId)) {
        return { state, success: false, message: "Squad transfer is not valid." };
    }
    const operationId = operation.id;
    const theaterId = theater.definition.id;
    if (!operationId || !theaterId) {
        return { state, success: false, message: "Operation context is incomplete." };
    }
    if (isUnitOperationIncapacitated(state.unitsById[unitId], operationId, theaterId)) {
        return { state, success: false, message: "Incapacitated units must be recovered at a Medical Ward before reassignment." };
    }
    if (fromSquad.currentRoomId !== toSquad.currentRoomId) {
        return { state, success: false, message: "Squads must share a room to transfer units." };
    }
    if (fromSquad.unitIds.length <= 1) {
        return { state, success: false, message: "A squad cannot be emptied." };
    }
    if (toSquad.unitIds.length >= theaterDeploymentPreset_1.THEATER_SQUAD_UNIT_LIMIT) {
        return { state, success: false, message: `A squad cannot exceed ${theaterDeploymentPreset_1.THEATER_SQUAD_UNIT_LIMIT} units.` };
    }
    const nextTheater = cloneTheater(theater);
    const nextFrom = findSquad(nextTheater, fromSquadId);
    const nextTo = findSquad(nextTheater, toSquadId);
    nextFrom.unitIds = nextFrom.unitIds.filter((id) => id !== unitId);
    nextTo.unitIds = [...nextTo.unitIds, unitId];
    return {
        state: {
            ...state,
            phase: "operation",
            operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater)),
        },
        success: true,
        message: `${unitId} transferred to ${toSquadId.toUpperCase()}.`,
    };
}
function mergeTheaterSquads(state, fromSquadId, intoSquadId) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const fromSquad = findSquad(theater, fromSquadId);
    const intoSquad = findSquad(theater, intoSquadId);
    if (!fromSquad || !intoSquad || fromSquadId === intoSquadId) {
        return { state, success: false, message: "Squads cannot be merged." };
    }
    const operationId = operation.id;
    const theaterId = theater.definition.id;
    if (!operationId || !theaterId) {
        return { state, success: false, message: "Operation context is incomplete." };
    }
    if (getSquadIncapacitatedUnitIds(state, operationId, theaterId, fromSquad).length > 0
        || getSquadIncapacitatedUnitIds(state, operationId, theaterId, intoSquad).length > 0) {
        return { state, success: false, message: "Squads carrying incapacitated units cannot merge until those operators are recovered." };
    }
    if (fromSquad.currentRoomId !== intoSquad.currentRoomId) {
        return { state, success: false, message: "Squads must share a room to merge." };
    }
    if ((fromSquad.unitIds.length + intoSquad.unitIds.length) > theaterDeploymentPreset_1.THEATER_SQUAD_UNIT_LIMIT) {
        return { state, success: false, message: `Merged squads cannot exceed ${theaterDeploymentPreset_1.THEATER_SQUAD_UNIT_LIMIT} units.` };
    }
    const nextTheater = cloneTheater(theater);
    const nextInto = findSquad(nextTheater, intoSquadId);
    const nextFrom = findSquad(nextTheater, fromSquadId);
    nextInto.unitIds = [...nextInto.unitIds, ...nextFrom.unitIds];
    nextTheater.squads = nextTheater.squads.filter((squad) => squad.squadId !== fromSquadId);
    if (nextTheater.selectedSquadId === fromSquadId) {
        nextTheater.selectedSquadId = intoSquadId;
        nextTheater.currentRoomId = nextInto.currentRoomId;
    }
    console.log("[THEATER] squads merged", fromSquadId, intoSquadId);
    return {
        state: {
            ...state,
            phase: "operation",
            operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater)),
        },
        success: true,
        message: `${fromSquadId.toUpperCase()} merged into ${intoSquadId.toUpperCase()}.`,
    };
}
function refuseTheaterDefense(state, roomId) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const room = theater.rooms[roomId];
    if (!room || (!room.underThreat && !room.damaged)) {
        return { state, success: false, message: "That room is not under active defense pressure." };
    }
    console.log("[THEATER] player refuses to defend a room", roomId);
    const nextTheater = resolveThreatDamage(theater, roomId, "player refused to defend", true);
    return {
        state: syncQuestRuntime({
            ...state,
            phase: "operation",
            operation: resolveOperationFields(operation, nextTheater),
        }),
        success: true,
        message: `${room.label} left unsupported.`,
    };
}
function getTheaterCoreRepairCost(room) {
    return deriveTheaterCoreRepairCost(room);
}
function repairTheaterCore(state, roomId) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const room = theater.rooms[roomId];
    if (!room || !roomHasAnyCore(room)) {
        return { state, success: false, message: "No C.O.R.E. is installed in that room." };
    }
    if (!room.damaged) {
        return { state, success: false, message: "That C.O.R.E. does not need repairs." };
    }
    const repairCost = deriveTheaterCoreRepairCost(room);
    const repairSpendResult = (0, session_1.spendSessionCost)(state, { resources: repairCost });
    if (!repairSpendResult.success) {
        return {
            state,
            success: false,
            message: `Insufficient resources to repair ${room.label}. Required: ${formatResourceCost(repairCost)}.`,
        };
    }
    const nextTheater = cloneTheater(theater);
    const nextRoom = nextTheater.rooms[roomId];
    if (!nextRoom || !roomHasAnyCore(nextRoom)) {
        return { state, success: false, message: "No C.O.R.E. is installed in that room." };
    }
    nextRoom.damaged = false;
    nextRoom.underThreat = false;
    nextRoom.abandoned = false;
    const repairedCoreType = getRoomPrimaryCoreAssignment(nextRoom)?.type ?? null;
    const repairedCoreLabel = repairedCoreType
        ? schemaSystem_1.SCHEMA_CORE_DEFINITIONS[repairedCoreType]?.displayName ?? repairedCoreType
        : "C.O.R.E.";
    nextTheater.recentEvents = [
        `REPAIR :: ${repairedCoreLabel} restored at ${nextRoom.label}.`,
        ...nextTheater.recentEvents,
    ].slice(0, 8);
    return {
        state: syncQuestRuntime({
            ...repairSpendResult.state,
            phase: "operation",
            operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater)),
        }),
        success: true,
        message: `${nextRoom.label} repaired.`,
    };
}
function destroyTheaterCore(state, roomId, slotIndex) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater operation." };
    }
    const nextTheater = cloneTheater(theater);
    const room = nextTheater.rooms[roomId];
    if (!room) {
        return { state, success: false, message: "Selected room is no longer available." };
    }
    const roomSlots = ensureRoomCoreSlots(room);
    const targetAssignment = roomSlots[slotIndex] ?? null;
    if (!targetAssignment) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "No C.O.R.E. is installed in that slot.",
        };
    }
    roomSlots[slotIndex] = null;
    room.coreSlots = roomSlots;
    syncRoomPrimaryCoreAssignment(room);
    const coreLabel = schemaSystem_1.SCHEMA_CORE_DEFINITIONS[targetAssignment.type]?.displayName ?? targetAssignment.type;
    return {
        state: {
            ...state,
            phase: "operation",
            operation: resolveOperationFields(operation, addTheaterEvent(recomputeTheaterNetwork(nextTheater), `C.O.R.E. :: ${coreLabel} dismantled at ${room.label}. No materials were recovered.`)),
        },
        success: true,
        message: `${coreLabel} destroyed.`,
    };
}
function destroyTheaterFortification(state, roomId, fortificationType) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    const definition = schemaSystem_1.SCHEMA_FORTIFICATION_DEFINITIONS[fortificationType];
    if (!operation || !theater || !definition) {
        return { state, success: false, message: "No active theater fortification target." };
    }
    const nextTheater = cloneTheater(theater);
    const room = nextTheater.rooms[roomId];
    if (!room || room.fortificationPips[fortificationType] <= 0) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: `No ${definition.displayName} is installed in that room.`,
        };
    }
    room.fortificationPips[fortificationType] = Math.max(0, room.fortificationPips[fortificationType] - 1);
    room.fortified = getInstalledFortificationCount(room) > 0;
    return {
        state: {
            ...state,
            phase: "operation",
            operation: resolveOperationFields(operation, addTheaterEvent(recomputeTheaterNetwork(nextTheater), `FORTIFICATION :: ${definition.displayName} dismantled in ${room.label}. No materials were recovered.`)),
        },
        success: true,
        message: `${definition.displayName} destroyed.`,
    };
}
function destroyTheaterAnnex(state, annexId) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return { state, success: false, message: "No active theater annex target." };
    }
    const nextTheater = cloneTheater(theater);
    const annex = nextTheater.annexesById?.[annexId];
    if (!annex) {
        return {
            state,
            success: false,
            message: "That annex is no longer available.",
        };
    }
    const removedAnnexIds = [annexId, ...collectAnnexBranchIds(nextTheater, annexId)];
    const automation = nextTheater.automation ?? (0, theaterAutomation_1.createEmptyTheaterAutomationState)();
    removedAnnexIds.forEach((removedId) => {
        const removedAnnex = nextTheater.annexesById?.[removedId];
        if (!removedAnnex) {
            return;
        }
        removedAnnex.moduleSlots.forEach((moduleId) => {
            if (!moduleId) {
                return;
            }
            delete automation.moduleInstancesById[moduleId];
            delete automation.moduleRuntimeById[moduleId];
        });
        delete nextTheater.annexesById?.[removedId];
    });
    nextTheater.squads = nextTheater.squads.map((squad) => (removedAnnexIds.includes(squad.currentNodeId ?? squad.currentRoomId)
        ? {
            ...squad,
            currentNodeId: annex.parentNodeId,
            currentRoomId: annex.parentRoomId,
            automationMode: "manual",
            autoStatus: "idle",
            autoTargetRoomId: null,
        }
        : squad));
    if (removedAnnexIds.includes(nextTheater.currentNodeId ?? nextTheater.currentRoomId)) {
        nextTheater.currentNodeId = annex.parentNodeId;
        nextTheater.currentRoomId = annex.parentRoomId;
    }
    if (removedAnnexIds.includes(nextTheater.selectedNodeId ?? nextTheater.selectedRoomId)) {
        nextTheater.selectedNodeId = annex.parentNodeId;
        nextTheater.selectedRoomId = annex.parentRoomId;
    }
    const annexLabel = foundrySystem_1.ANNEX_FRAME_DEFINITIONS[annex.frameType]?.displayName ?? annexId;
    return {
        state: {
            ...state,
            phase: "operation",
            operation: resolveOperationFields(operation, addTheaterEvent(recomputeTheaterNetwork(nextTheater), `ANNEX :: ${annexLabel} dismantled from ${annex.parentRoomId}. No materials were recovered.`)),
        },
        success: true,
        message: `${annexLabel} destroyed.`,
    };
}
function secureTheaterRoomInState(state, roomId, squadId) {
    const operation = getPreparedTheaterOperation(state);
    if (!operation?.theater) {
        return state;
    }
    const theater = cloneTheater(operation.theater);
    const room = theater.rooms[roomId];
    if (!room) {
        return state;
    }
    room.status = "secured";
    room.secured = true;
    room.underThreat = false;
    room.damaged = false;
    room.fortified = getInstalledFortificationCount(room) > 0;
    room.abandoned = false;
    room.enemySite = null;
    theater.currentRoomId = roomId;
    theater.selectedRoomId = roomId;
    theater.currentNodeId = roomId;
    theater.selectedNodeId = roomId;
    const actingSquad = (squadId ? findSquad(theater, squadId) : null)
        ?? getSelectedSquad(theater);
    if (actingSquad) {
        actingSquad.currentRoomId = roomId;
        actingSquad.currentNodeId = roomId;
    }
    theater.activeThreats = theater.activeThreats.map((threat) => threat.roomId === roomId || threat.currentRoomId === roomId || threat.targetRoomId === roomId
        ? { ...threat, active: false }
        : threat);
    console.log("[THEATER] room secured", roomId);
    const keyedTheater = syncTheaterKeyInventory(collectRoomKeyIfPresent(theater, roomId));
    const recomputedTheater = recomputeTheaterNetwork(keyedTheater);
    const resourceBonus = toResourceWalletDelta(getCoreBattleRewardBonus(recomputedTheater, recomputedTheater.rooms[roomId] ?? room));
    let nextState = (0, session_1.grantSessionResources)(syncQuestRuntime({
        ...state,
        phase: "operation",
        currentBattle: null,
        operation: resolveOperationFields(operation, addTheaterEvent(resolveEnemyRoomThreats(state, recomputedTheater), resourceBonus.metalScrap > 0 || resourceBonus.wood > 0 || resourceBonus.steamComponents > 0
            ? `SECURE :: ${room.label} locked down. Linked C.O.R.E. support added ${formatResourceCost(resourceBonus)}.`
            : `SECURE :: ${room.label} locked down. Logistics paths recalculated.`)),
    }), {
        resources: resourceBonus,
    });
    nextState = recoverOperationalSquadsAtMedicalWards(nextState);
    const completedOperation = getPreparedTheaterOperation(nextState);
    const completedTheater = completedOperation?.theater;
    if (!completedOperation || !completedTheater) {
        return nextState;
    }
    if (!operation.theater?.objectiveComplete && completedTheater.objectiveComplete && completedTheater.completion) {
        const completion = completedTheater.completion;
        return syncQuestRuntime((0, session_1.grantSessionResources)({
            ...nextState,
            phase: "operation",
            currentBattle: null,
            operation: resolveOperationFields(completedOperation, completedTheater),
        }, {
            wad: completion.reward.wad ?? 0,
            resources: toResourceWalletDelta(completion.reward),
        }));
    }
    return nextState;
}
function clearTheaterEnemyThreatsInState(state) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return state;
    }
    const clearedTheater = clearTheaterThreatPressure(theater);
    if (clearedTheater === theater) {
        return state;
    }
    return {
        ...state,
        phase: "operation",
        operation: resolveOperationFields(operation, clearedTheater),
    };
}
function buildCoreInTheaterRoom(state, roomId, coreType) {
    const operation = getPreparedTheaterOperation(state);
    const blueprint = exports.THEATER_CORE_BLUEPRINTS[coreType];
    if (!operation?.theater || !blueprint) {
        return {
            state,
            success: false,
            message: "No active theater C.O.R.E. target.",
        };
    }
    if (!(0, schemaSystem_1.isCoreTypeUnlocked)(state, coreType)) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: `${blueprint.displayName} is still locked in S.C.H.E.M.A.`,
        };
    }
    const theater = cloneTheater(operation.theater);
    const room = theater.rooms[roomId];
    if (!room || !room.secured) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "Secure the room before assigning a C.O.R.E.",
        };
    }
    const roomSlots = ensureRoomCoreSlots(room);
    const openSlotIndex = roomSlots.findIndex((assignment) => assignment === null);
    if (openSlotIndex < 0) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "No open C.O.R.E. slots remain in this room.",
        };
    }
    const coreSpendResult = (0, session_1.spendSessionCost)(state, { resources: blueprint.buildCost });
    if (!coreSpendResult.success) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "Insufficient build resources.",
        };
    }
    const coreAssignment = {
        type: coreType,
        assignedAtTick: theater.tickCount,
        buildCost: { ...blueprint.buildCost },
        upkeepPerTick: { ...blueprint.upkeep },
        wadUpkeepPerTick: blueprint.wadUpkeepPerTick,
        incomePerTick: (0, schemaSystem_1.getCoreIncomeForRoom)(coreType, room),
        supportRadius: blueprint.supportRadius,
    };
    room.coreSlots = roomSlots;
    room.coreSlots[openSlotIndex] = coreAssignment;
    syncRoomPrimaryCoreAssignment(room);
    room.status = "secured";
    room.secured = true;
    console.log("[THEATER] core built", roomId, coreType, `slot:${openSlotIndex}`);
    return {
        state: {
            ...syncQuestRuntime({
                ...coreSpendResult.state,
                phase: "operation",
                operation: resolveOperationFields(operation, addTheaterEvent(recomputeTheaterNetwork(theater), `C.O.R.E. :: ${blueprint.displayName} online at ${room.label} (${getRoomCoreAssignments(room).length}/${Math.max(1, room.coreSlotCapacity ?? 1)} slots occupied). Wad upkeep ${blueprint.wadUpkeepPerTick}/tick.`)),
            }),
        },
        success: true,
        message: `${blueprint.displayName} assigned.`,
    };
}
function fortifyTheaterRoom(state, roomId, fortificationType) {
    const operation = getPreparedTheaterOperation(state);
    if (!operation?.theater) {
        return {
            state,
            success: false,
            message: "No active theater room selected.",
        };
    }
    const definition = schemaSystem_1.SCHEMA_FORTIFICATION_DEFINITIONS[fortificationType];
    if (!definition) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "Unknown fortification type.",
        };
    }
    if (!(0, schemaSystem_1.isFortificationUnlocked)(state, fortificationType)) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: `${definition.displayName} is still locked in S.C.H.E.M.A.`,
        };
    }
    const cost = definition.buildCost;
    const theater = cloneTheater(operation.theater);
    const room = theater.rooms[roomId];
    if (!room || !room.secured) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "Only secured rooms can be fortified.",
        };
    }
    const fortifySpendResult = (0, session_1.spendSessionCost)(state, { resources: cost });
    if (!fortifySpendResult.success) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "Insufficient resources for fortification construction.",
        };
    }
    const maxSlots = room.fortificationCapacity ?? 3;
    if (getInstalledFortificationCount(room) >= maxSlots) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "No fortification slots remain in this room.",
        };
    }
    room.fortificationPips[fortificationType] += 1;
    room.fortified = getInstalledFortificationCount(room) > 0;
    if (fortificationType === "barricade") {
        room.damaged = false;
        room.underThreat = false;
        theater.activeThreats = theater.activeThreats.map((threat) => threat.roomId === roomId || threat.currentRoomId === roomId || threat.targetRoomId === roomId
            ? { ...threat, active: false }
            : threat);
    }
    const label = definition.displayName;
    return {
        state: {
            ...syncQuestRuntime({
                ...fortifySpendResult.state,
                phase: "operation",
                operation: resolveOperationFields(operation, addTheaterEvent(recomputeTheaterNetwork(theater), `FORTIFY :: ${label} installed at ${room.label}.`)),
            }),
        },
        success: true,
        message: `${label} installed.`,
    };
}
function getFieldAssetPlacementError(room, fieldAssetType, x, y) {
    const map = getTheaterRoomTacticalMap(room);
    if (!map) {
        return "This room does not have a tactical map assignment yet.";
    }
    const tile = map.tiles.find((entry) => entry.x === x && entry.y === y);
    if (!tile) {
        return "Field assets can only be placed on playable tiles.";
    }
    const zoneOccupied = [
        ...map.zones.friendlySpawn,
        ...map.zones.enemySpawn,
        ...map.zones.relay,
        ...map.zones.friendlyBreach,
        ...map.zones.enemyBreach,
        ...map.zones.extraction,
    ].some((point) => point.x === x && point.y === y);
    if (zoneOccupied) {
        return "That tile is reserved for deployment or objective routing.";
    }
    if (map.objects.some((objectDef) => objectDef.x === x && objectDef.y === y)) {
        return "That tile is already occupied by a tactical object.";
    }
    if ((room.placedFieldAssets ?? []).some((asset) => asset.x === x && asset.y === y)) {
        return "That tile already contains a fabricated field asset.";
    }
    if (fieldAssetType === "portable_ladder") {
        const neighbors = [
            { x: x + 1, y },
            { x: x - 1, y },
            { x, y: y + 1 },
            { x, y: y - 1 },
        ];
        const hasVerticalNeed = neighbors.some((point) => {
            const adjacentTile = map.tiles.find((entry) => entry.x === point.x && entry.y === point.y);
            return adjacentTile && Math.abs((adjacentTile.elevation ?? 0) - (tile.elevation ?? 0)) >= 1;
        });
        if (!hasVerticalNeed) {
            return "Portable ladders need nearby elevation to create a useful route.";
        }
    }
    return null;
}
function fabricateFieldAssetInTheaterRoom(state, roomId, fieldAssetType, x, y) {
    const operation = getPreparedTheaterOperation(state);
    if (!operation?.theater) {
        return {
            state,
            success: false,
            message: "No active theater room selected.",
        };
    }
    const definition = schemaSystem_1.SCHEMA_FIELD_ASSET_DEFINITIONS[fieldAssetType];
    if (!definition) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "Unknown field asset authorization.",
        };
    }
    if (!(0, schemaSystem_1.isFieldAssetUnlocked)(state, fieldAssetType)) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: `${definition.displayName} is still locked in S.C.H.E.M.A.`,
        };
    }
    const theater = cloneTheater(operation.theater);
    const room = theater.rooms[roomId];
    if (!room) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "Unknown room selection.",
        };
    }
    if (!room.secured) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "Secure the room before fabricating field assets.",
        };
    }
    const placementError = getFieldAssetPlacementError(room, fieldAssetType, x, y);
    if (placementError) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: placementError,
        };
    }
    const buildCost = (0, schemaSystem_1.getFieldAssetBuildCost)(fieldAssetType);
    const fieldAssetSpendResult = (0, session_1.spendSessionCost)(state, { resources: buildCost });
    if (!fieldAssetSpendResult.success) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "Insufficient resources for field asset fabrication.",
        };
    }
    const assetId = `asset_${fieldAssetType}_${roomId}_${Date.now().toString(36)}`;
    room.battleMapId = getTheaterRoomBattleMapId(room);
    room.placedFieldAssets = [
        ...(room.placedFieldAssets ?? []),
        {
            id: assetId,
            type: fieldAssetType,
            x,
            y,
            active: true,
            charges: fieldAssetType === "med_station" || fieldAssetType === "ammo_crate" ? 1 : undefined,
        },
    ];
    room.fieldAssetRuntimeState = {
        ...(room.fieldAssetRuntimeState ?? {}),
        [assetId]: {
            charges: fieldAssetType === "med_station" || fieldAssetType === "ammo_crate" ? 1 : undefined,
        },
    };
    return {
        state: {
            ...syncQuestRuntime({
                ...fieldAssetSpendResult.state,
                phase: "operation",
                operation: resolveOperationFields(operation, addTheaterEvent(recomputeTheaterNetwork(theater), `FIELD ASSET :: ${definition.displayName} fabricated for ${room.label} at (${x}, ${y}).`)),
            }),
        },
        success: true,
        message: `${definition.displayName} deployed to ${room.label}.`,
    };
}
function removeFieldAssetFromTheaterRoom(state, roomId, assetId) {
    const operation = getPreparedTheaterOperation(state);
    if (!operation?.theater) {
        return {
            state,
            success: false,
            message: "No active theater room selected.",
        };
    }
    const theater = cloneTheater(operation.theater);
    const room = theater.rooms[roomId];
    if (!room) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "Unknown room selection.",
        };
    }
    const asset = (room.placedFieldAssets ?? []).find((entry) => entry.id === assetId);
    if (!asset) {
        return {
            state: setTheaterSelectedRoom(state, roomId),
            success: false,
            message: "That field asset is no longer installed in this room.",
        };
    }
    room.placedFieldAssets = (room.placedFieldAssets ?? []).filter((entry) => entry.id !== assetId);
    if (room.fieldAssetRuntimeState?.[assetId]) {
        const nextRuntimeState = { ...(room.fieldAssetRuntimeState ?? {}) };
        delete nextRuntimeState[assetId];
        room.fieldAssetRuntimeState = nextRuntimeState;
    }
    const definition = schemaSystem_1.SCHEMA_FIELD_ASSET_DEFINITIONS[asset.type];
    return {
        state: {
            ...syncQuestRuntime({
                ...state,
                phase: "operation",
                operation: resolveOperationFields(operation, addTheaterEvent(recomputeTheaterNetwork(theater), `FIELD ASSET :: ${(definition?.displayName ?? asset.type)} removed from ${room.label}.`)),
            }),
        },
        success: true,
        message: `${definition?.displayName ?? asset.type} removed from ${room.label}.`,
    };
}
function buildTheaterBattleStateForSquad(state, operation, theater, room, squad, automationMode = "manual") {
    const operationId = operation.id;
    const theaterId = theater.definition.id;
    if (!operationId || !theaterId) {
        return null;
    }
    const deployedSquads = theater.squads.filter((candidate) => candidate.currentRoomId === room.id);
    const getSquadController = (squadId) => {
        if (state.session.mode !== "coop_operations") {
            return "P1";
        }
        const assignment = Object.values(state.session.theaterAssignments ?? {}).find((candidate) => candidate.squadId === squadId && (candidate.playerId === "P1" || candidate.playerId === "P2"));
        return assignment?.playerId === "P2" ? "P2" : "P1";
    };
    const controllerByUnitId = new Map();
    const deployedUnitIds = Array.from(new Set(deployedSquads.flatMap((candidate) => {
        const controller = getSquadController(candidate.squadId);
        const readyUnitIds = getSquadCombatReadyUnitIds(state, operationId, theaterId, candidate);
        readyUnitIds.forEach((unitId) => {
            controllerByUnitId.set(unitId, controller);
        });
        return readyUnitIds;
    })));
    if (deployedUnitIds.length <= 0) {
        return null;
    }
    const patchedUnitsById = { ...state.unitsById };
    controllerByUnitId.forEach((controller, unitId) => {
        const unit = patchedUnitsById[unitId];
        if (!unit) {
            return;
        }
        patchedUnitsById[unitId] = {
            ...unit,
            controller,
        };
    });
    const patchedState = {
        ...state,
        unitsById: patchedUnitsById,
        partyUnitIds: [...deployedUnitIds],
        operation: resolveOperationFields(operation, {
            ...theater,
            currentRoomId: room.id,
            selectedRoomId: room.id,
        }),
    };
    let battle = (0, battle_1.createTestBattleForCurrentParty)(patchedState, room.battleSizeOverride);
    if (!battle) {
        return null;
    }
    const tacticalMap = getTheaterRoomTacticalMap(room);
    if (tacticalMap) {
        battle = (0, tacticalBattle_1.applyTacticalMapToBattleState)(battle, tacticalMap);
        battle = (0, tacticalBattle_1.assignBattleUnitsToSpawnPoints)(battle, "enemy", tacticalMap.zones.enemySpawn);
    }
    const neighborPressure = room.adjacency.some((adjacentId) => {
        const adjacent = theater.rooms[adjacentId];
        return Boolean(adjacent?.underThreat || adjacent?.damaged || (adjacent?.secured && !adjacent?.supplied));
    });
    const isCutOff = room.secured ? !room.supplied : neighborPressure;
    const signalPosture = getSandboxSignalPosture(room);
    const hasCommandSupport = roomHasLinkedOperationalCore(theater, room, "command_center", 100);
    const hasMedicalSupport = roomHasLinkedOperationalCore(theater, room, "medical_ward", 100);
    const hasArmorySupport = roomHasLinkedOperationalCore(theater, room, "armory", 100);
    const hasMineSupport = roomHasLinkedOperationalCore(theater, room, "mine", 50);
    const hasRefinerySupport = roomHasLinkedOperationalCore(theater, room, "refinery", 50);
    const supplyOnline = room.supplied;
    const commsOnline = room.commsLinked && room.commsFlow >= Math.max(SQUAD_CONTROL_BW_PER_UNIT, deployedUnitIds.length * SQUAD_CONTROL_BW_PER_UNIT);
    const detailedEnemyIntel = signalPosture !== "masked" && room.commsLinked && room.commsFlow >= 100;
    const powerTurretCount = Math.max(0, Math.floor(room.powerFlow / 100)) + (0, theaterAutomation_1.getAutomatedTurretCountForRoom)(theater, room.id);
    const smokeSeverity = clampSandboxLevel(room.sandboxSmokeValue ?? 0, 2);
    const smokeObscured = smokeSeverity > 0;
    const regionPresentation = (0, campaignRegions_1.getActiveRegionPresentation)(theater.definition.floorOrdinal ?? 1);
    const regionBattleModifier = regionPresentation.battleModifier;
    const regionHeatOnMiss = regionBattleModifier.heatOnMiss > 0 ? regionBattleModifier.heatOnMiss : undefined;
    const regionHeatOnAttack = regionBattleModifier.heatOnAttack > 0 ? regionBattleModifier.heatOnAttack : undefined;
    const allyStartStatus = regionBattleModifier.allyStartStatus ?? null;
    const enemyStartStatus = regionBattleModifier.enemyStartStatus ?? null;
    const enemyIntelScrambled = Boolean(regionBattleModifier.scrambleEnemyIntel);
    const enemyIntelScrambleLabel = enemyIntelScrambled
        ? (regionBattleModifier.intelScrambleLabel ?? regionPresentation.mechanicLabel)
        : undefined;
    const regionObscurationSeverity = regionBattleModifier.obscurationSeverity;
    const regionObscurationActive = regionObscurationSeverity > 0;
    const combinedObscurationSeverity = Math.max(smokeSeverity, regionObscurationSeverity);
    const obscurationActive = combinedObscurationSeverity > 0;
    const obscurationSuppressesRanged = Boolean(smokeObscured || regionBattleModifier.obscurationSuppressesRanged);
    const obscurationLabel = regionObscurationActive
        ? regionPresentation.mechanicLabel
        : smokeObscured
            ? "Smoke Obscuration"
            : undefined;
    const combinedCombatInstability = Boolean((room.sandboxOverheating ?? false) || regionBattleModifier.combatInstability);
    const combinedOverheatSeverity = Math.max(room.sandboxOverheatSeverity ?? 0, regionBattleModifier.overheatSeverity);
    const burningRoom = Boolean(room.sandboxBurning);
    const burnSeverity = Math.max(0, room.sandboxBurnSeverity ?? 0);
    const units = { ...battle.units };
    const isObjectiveRoom = theater.objectiveDefinition?.targetRoomId === room.id;
    Object.values(units).forEach((unit) => {
        if (unit.isEnemy && (room.underThreat || room.damaged || isCutOff || room.tags.includes("elite") || isObjectiveRoom)) {
            const hpBonus = (room.tags.includes("elite") || isObjectiveRoom) ? 4 : 2;
            unit.maxHp += hpBonus;
            unit.hp += hpBonus;
            unit.atk += room.damaged || isCutOff ? 1 : 0;
        }
        if (!unit.isEnemy) {
            if (supplyOnline) {
                unit.maxHp += 2;
                unit.hp += 2;
            }
            if (commsOnline) {
                unit.agi += 2;
            }
            if (hasCommandSupport) {
                unit.def += 1;
            }
            if (hasArmorySupport) {
                unit.atk += 1;
            }
            if (hasMedicalSupport) {
                unit.maxHp += 1;
                unit.hp += 1;
            }
        }
        const startStatus = unit.isEnemy ? enemyStartStatus : allyStartStatus;
        if (startStatus && !(unit.statuses ?? []).some((status) => status.type === startStatus.type)) {
            unit.statuses = [
                ...(unit.statuses ?? []),
                { type: startStatus.type, duration: startStatus.duration },
            ];
        }
        if (obscurationActive) {
            unit.agi = Math.max(1, unit.agi - combinedObscurationSeverity);
            if (obscurationSuppressesRanged && !(unit.statuses ?? []).some((status) => status.type === "suppressed")) {
                unit.statuses = [
                    ...(unit.statuses ?? []),
                    { type: "suppressed", duration: 1 },
                ];
            }
        }
    });
    const enemyUnits = Object.values(units).filter((unit) => unit.isEnemy);
    const combinedDetailedEnemyIntel = detailedEnemyIntel && !enemyIntelScrambled;
    const enemyPreview = combinedDetailedEnemyIntel ? enemyUnits.map((unit) => unit.name) : [];
    if (powerTurretCount > 0 && enemyUnits.length > 0) {
        for (let index = 0; index < powerTurretCount; index += 1) {
            const target = enemyUnits[index % enemyUnits.length];
            target.hp = Math.max(1, target.hp - 2);
        }
    }
    const theaterBattleLog = [
        `THEATER//ROOM :: ${room.label} [${room.sectorTag}]`,
        `THEATER//LOGISTICS :: SUP=${room.supplied ? "ONLINE" : "CUT"} PWR=${room.powered ? "RAILED" : "OFF"} COMMS=${room.commsVisible ? "VISIBLE" : "BLIND"}`,
        `THEATER//SQUAD :: ${(squad.displayName || squad.squadId.toUpperCase()).toUpperCase()} deploying with ${deployedUnitIds.length} combat-ready unit(s).`,
        `THEATER//REGION :: ${regionPresentation.regionName.toUpperCase()} // ${regionPresentation.variantLabel.toUpperCase()} // ${regionPresentation.factionTag.toUpperCase()}`,
        `THEATER//REGION RULE :: ${regionPresentation.mechanicLabel.toUpperCase()} :: ${regionPresentation.ruleSummary}`,
    ];
    if (tacticalMap) {
        theaterBattleLog.push(`THEATER//TACTICAL :: ${tacticalMap.name} loaded for ${room.label}.`);
        if ((room.placedFieldAssets ?? []).length > 0) {
            theaterBattleLog.push(`THEATER//PREP :: ${(room.placedFieldAssets ?? []).length} fabricated field asset(s) are active in this room.`);
        }
    }
    const supportingSquads = theater.squads.filter((candidate) => candidate.currentRoomId === room.id);
    if (supportingSquads.length > 1) {
        theaterBattleLog.push(`THEATER//REINFORCEMENTS :: ${supportingSquads.map((candidate) => candidate.displayName).join(", ")} are deploying from the same room.`);
    }
    if (room.underThreat || room.damaged || isCutOff || neighborPressure) {
        theaterBattleLog.push("THEATER//PRESSURE :: Active theater instability is strengthening the hostile response.");
    }
    if (hasCommandSupport || hasArmorySupport || hasMedicalSupport) {
        theaterBattleLog.push(`THEATER//SUPPORT :: ${[
            hasCommandSupport ? "Command Center" : null,
            hasArmorySupport ? "Armory" : null,
            hasMedicalSupport ? "Medical Ward" : null,
        ].filter(Boolean).join(", ")} support is affecting the squad.`);
    }
    if (hasMineSupport || hasRefinerySupport) {
        theaterBattleLog.push(`THEATER//INDUSTRY :: ${[
            hasMineSupport ? "Mine" : null,
            hasRefinerySupport ? "Refinery" : null,
        ].filter(Boolean).join(", ")} support will improve recovered resources after this fight.`);
    }
    if (supplyOnline) {
        console.log("[THEATER] tactical battle receives supply bonus", room.id, squad.squadId);
        theaterBattleLog.push("THEATER//SUPPLY BONUS :: Supply line online. Squad enters with reinforced medical and ordnance support.");
    }
    if (commsOnline) {
        console.log("[THEATER] tactical battle receives comms bonus", room.id, squad.squadId);
        theaterBattleLog.push("THEATER//COMMS BONUS :: Comms uplink stable. Enemy presence preview and initiative advantage granted.");
    }
    if (combinedDetailedEnemyIntel) {
        theaterBattleLog.push("THEATER//INTEL :: Full enemy telemetry resolved. Detailed combat dossiers available.");
    }
    if (enemyIntelScrambled) {
        theaterBattleLog.push(`THEATER//STATIC :: ${enemyIntelScrambleLabel} is scrambling hostile telemetry in ${room.label}.`);
    }
    if (room.sandboxOverheating) {
        console.log("[THEATER] tactical battle inherits overheating", room.id, room.sandboxOverheatSeverity ?? 1);
        theaterBattleLog.push(`THEATER//ALERT :: Combat instability active in room(${room.id}). Strain accumulation doubled and weapon heat accelerated.`);
    }
    if (!room.sandboxOverheating && (regionHeatOnMiss || regionHeatOnAttack)) {
        theaterBattleLog.push(`THEATER//PRESSURE :: ${regionPresentation.ruleSummary}`);
    }
    if (allyStartStatus) {
        theaterBattleLog.push(`THEATER//FLOW :: ${allyStartStatus.label} is applying ${allyStartStatus.type.toUpperCase()} to allied units on deployment.`);
    }
    if (enemyStartStatus) {
        theaterBattleLog.push(`THEATER//HOSTILES :: ${enemyStartStatus.label} is applying ${enemyStartStatus.type.toUpperCase()} to hostile units on deployment.`);
    }
    if (regionObscurationActive) {
        const suppressionClause = regionBattleModifier.obscurationSuppressesRanged
            ? " and ranged fire enters the fight suppressed."
            : ".";
        theaterBattleLog.push(`THEATER//CANOPY :: ${regionPresentation.mechanicLabel} is active in room(${room.id}). Movement reduced by ${regionObscurationSeverity}${suppressionClause}`);
    }
    if (smokeObscured) {
        theaterBattleLog.push(`THEATER//SMOKE :: Room(${room.id}) is obscured by smoke. Movement reduced by ${smokeSeverity} and ranged fire enters the fight suppressed.`);
    }
    if (burningRoom) {
        theaterBattleLog.push(`THEATER//FIRE :: Room(${room.id}) is actively burning. Ambient thermal damage will strike every turn and ignition pressure is elevated.`);
    }
    if (room.sandboxSupplyFireRisk) {
        theaterBattleLog.push(`THEATER//FIRE RISK :: Dense supply and heat load are making ${room.label} volatile.`);
    }
    if (signalPosture === "masked") {
        theaterBattleLog.push(`THEATER//POSTURE :: ${room.label} is running masked signal posture. Enemy attraction is dampened, but detailed enemy telemetry is reduced.`);
    }
    else if (signalPosture === "bait") {
        theaterBattleLog.push(`THEATER//POSTURE :: ${room.label} is broadcasting bait signatures to draw hostile attention and spoof route confidence.`);
    }
    if (room.sandboxSignalBloom) {
        theaterBattleLog.push(`THEATER//BLOOM :: Signal bloom is leaking false intel into local telemetry.`);
    }
    if (powerTurretCount > 0) {
        console.log("[THEATER] tactical battle receives power bonus", room.id, squad.squadId, powerTurretCount);
        theaterBattleLog.push(`THEATER//POWER BONUS :: ${powerTurretCount} auto-turret emplacement(s) opened fire before contact.`);
    }
    return {
        ...battle,
        id: `${operation.id}_${room.id}_${theater.tickCount}_${squad.squadId}_${automationMode}`,
        roomId: room.id,
        mapId: tacticalMap?.id ?? battle.mapId ?? null,
        units,
        log: [...theaterBattleLog, ...battle.log],
        theaterBonuses: {
            squadId: squad.squadId,
            squadDisplayName: squad.displayName,
            squadIcon: squad.icon,
            supplyOnline,
            commsOnline,
            powerTurretCount,
            enemyPreview,
            detailedEnemyIntel: combinedDetailedEnemyIntel,
            overheating: room.sandboxOverheating ?? false,
            overheatSeverity: combinedOverheatSeverity,
            combatInstability: combinedCombatInstability,
            heatOnMiss: regionHeatOnMiss,
            heatOnAttack: regionHeatOnAttack,
            regionId: regionPresentation.regionId,
            regionName: regionPresentation.regionName,
            regionVariantLabel: regionPresentation.variantLabel,
            regionMechanicLabel: regionPresentation.mechanicLabel,
            regionRuleSummary: regionPresentation.ruleSummary,
            factionTag: regionPresentation.factionTag,
            enemyIntelScrambled,
            enemyIntelScrambleLabel,
            allyStartStatusType: allyStartStatus?.type,
            allyStartStatusDuration: allyStartStatus?.duration,
            allyStartStatusLabel: allyStartStatus?.label,
            enemyStartStatusType: enemyStartStatus?.type,
            enemyStartStatusDuration: enemyStartStatus?.duration,
            enemyStartStatusLabel: enemyStartStatus?.label,
            obscurationActive,
            obscurationSeverity: obscurationActive ? combinedObscurationSeverity : undefined,
            obscurationLabel,
            obscurationSuppressesRanged: obscurationActive ? obscurationSuppressesRanged : undefined,
            smokeObscured,
            smokeSeverity,
            burningRoom,
            burnSeverity,
            supplyFireRisk: room.sandboxSupplyFireRisk ?? false,
            signalPosture,
            signalBloom: room.sandboxSignalBloom ?? false,
        },
        theaterMeta: {
            operationId,
            theaterId,
            roomId: room.id,
            squadId: squad.squadId,
            deployedUnitIds,
            autoMode: automationMode,
        },
        defenseObjective: isDefenseBattleRoom(room)
            ? {
                type: "survive_turns",
                turnsRequired: 3,
                turnsRemaining: 3,
                keyRoomId: room.id,
            }
            : battle.defenseObjective,
    };
}
function syncBattleUnitsBackToCampaignState(state, battle) {
    const updatedUnits = { ...state.unitsById };
    Object.values(battle.units).forEach((battleUnit) => {
        const baseUnit = state.unitsById[battleUnit.baseUnitId];
        if (!baseUnit || battleUnit.isEnemy) {
            return;
        }
        updatedUnits[battleUnit.baseUnitId] = {
            ...baseUnit,
            hp: Math.max(0, Math.min(baseUnit.maxHp, battleUnit.hp)),
            pos: null,
        };
    });
    return {
        ...state,
        unitsById: updatedUnits,
        currentBattle: null,
        phase: "operation",
    };
}
function markOperationBattleCasualties(state, battle) {
    const operationId = battle.theaterMeta?.operationId;
    const theaterId = battle.theaterMeta?.theaterId;
    const squadId = battle.theaterMeta?.squadId;
    const roomId = battle.theaterMeta?.roomId ?? battle.roomId;
    if (!operationId || !theaterId || !squadId) {
        return state;
    }
    const updatedUnits = { ...state.unitsById };
    battle.theaterMeta?.deployedUnitIds.forEach((unitId) => {
        const battleUnit = battle.units[unitId];
        const baseUnit = updatedUnits[unitId];
        if (!battleUnit || !baseUnit) {
            return;
        }
        if (battleUnit.hp <= 0) {
            updatedUnits[unitId] = {
                ...baseUnit,
                hp: 0,
                operationInjury: {
                    operationId,
                    theaterId,
                    squadId,
                    incapacitatedAtTick: battle.turnCount,
                    sourceRoomId: roomId,
                },
            };
        }
    });
    return {
        ...state,
        unitsById: updatedUnits,
    };
}
function applyPlaceholderOperationScopedFailureCleanup(state, _battle) {
    // Placeholder hook for future operation-scoped temporary rewards or inventory.
    return state;
}
function applyOperationFailureShakenStatus(state, battle) {
    const operationId = battle.theaterMeta?.operationId;
    const theaterId = battle.theaterMeta?.theaterId;
    const roomId = battle.theaterMeta?.roomId ?? battle.roomId;
    const deployedUnitIds = battle.theaterMeta?.deployedUnitIds ?? [];
    if (!operationId || !theaterId || deployedUnitIds.length <= 0) {
        return state;
    }
    const activeTheaterTick = getPreparedTheaterOperation(state)?.theater?.tickCount ?? 0;
    return (0, operationStatuses_1.applyShakenStatusToUnitIds)(state, deployedUnitIds, {
        operationId,
        theaterId,
        sourceRoomId: roomId,
        currentTick: activeTheaterTick,
    });
}
function applyTheaterOperationFailure(state, battle) {
    if (!hasTheaterOperation(state.operation) || !battle.theaterMeta || battle.phase !== "defeat") {
        return state;
    }
    let nextState = syncBattleUnitsBackToCampaignState(state, battle);
    nextState = markOperationBattleCasualties(nextState, battle);
    nextState = applyPlaceholderOperationScopedFailureCleanup(nextState, battle);
    nextState = applyOperationFailureShakenStatus(nextState, battle);
    return nextState;
}
function syncTheaterRoomFieldAssetsFromBattle(theater, battle) {
    const roomId = battle.theaterMeta?.roomId ?? battle.roomId;
    if (!roomId) {
        return theater;
    }
    const room = theater.rooms[roomId];
    if (!room || (room.placedFieldAssets ?? []).length <= 0) {
        return theater;
    }
    const nextTheater = cloneTheater(theater);
    const nextRoom = nextTheater.rooms[roomId];
    if (!nextRoom || (nextRoom.placedFieldAssets ?? []).length <= 0) {
        return nextTheater;
    }
    const nextRuntimeState = { ...(nextRoom.fieldAssetRuntimeState ?? {}) };
    nextRoom.placedFieldAssets = (nextRoom.placedFieldAssets ?? []).filter((asset) => {
        const mapObject = battle.mapObjects?.find((objectDef) => objectDef.id === asset.id) ?? null;
        if (!mapObject) {
            return true;
        }
        if (mapObject.active === false || mapObject.charges === 0) {
            delete nextRuntimeState[asset.id];
            return false;
        }
        nextRuntimeState[asset.id] = {
            ...(nextRuntimeState[asset.id] ?? {}),
            charges: mapObject.charges,
        };
        return true;
    });
    nextRoom.fieldAssetRuntimeState = nextRuntimeState;
    return nextTheater;
}
function clearOperationInjuriesForOperation(state, operationId, theaterId) {
    if (!operationId) {
        return state;
    }
    const updatedUnits = { ...state.unitsById };
    let changed = false;
    Object.entries(updatedUnits).forEach(([unitId, unit]) => {
        if (!unit.operationInjury || unit.operationInjury.operationId !== operationId) {
            return;
        }
        if (theaterId && unit.operationInjury.theaterId !== theaterId) {
            return;
        }
        updatedUnits[unitId] = {
            ...unit,
            hp: unit.maxHp,
            operationInjury: null,
            buffs: [],
        };
        changed = true;
    });
    return changed ? { ...state, unitsById: updatedUnits } : state;
}
function clearCurrentTheaterOperationInjuries(state) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return state;
    }
    return clearOperationInjuriesForOperation(state, operation.id, theater.definition.id);
}
function recoverSquadAtOperationalMedicalWard(state, theater, squadId) {
    const operationId = theater.definition.operationId;
    const squad = findSquad(theater, squadId);
    if (!squad) {
        return { state, recoveredCount: 0 };
    }
    const room = theater.rooms[squad.currentRoomId];
    if (!room || !roomHasOperationalCoreType(room, "medical_ward")) {
        return { state, recoveredCount: 0 };
    }
    const updatedUnits = { ...state.unitsById };
    let recoveredCount = 0;
    squad.unitIds.forEach((unitId) => {
        const unit = updatedUnits[unitId];
        if (!isUnitOperationIncapacitated(unit, operationId, theater.definition.id)) {
            return;
        }
        recoveredCount += 1;
        updatedUnits[unitId] = {
            ...unit,
            hp: unit.maxHp,
            operationInjury: null,
            buffs: [],
        };
    });
    return recoveredCount > 0
        ? { state: { ...state, unitsById: updatedUnits }, recoveredCount }
        : { state, recoveredCount: 0 };
}
function recoverOperationalSquadsAtMedicalWards(state) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return state;
    }
    let nextState = state;
    let nextTheater = cloneTheater(theater);
    let recoveredAny = false;
    nextTheater.squads.forEach((squad) => {
        const recovery = recoverSquadAtOperationalMedicalWard(nextState, nextTheater, squad.squadId);
        if (recovery.recoveredCount > 0) {
            recoveredAny = true;
            nextState = recovery.state;
            nextTheater = addTheaterEvent(cloneTheater(nextTheater), `MEDICAL WARD :: ${squad.displayName} restored ${recovery.recoveredCount} incapacitated operator(s) in ${nextTheater.rooms[squad.currentRoomId]?.label ?? squad.currentRoomId}.`);
        }
    });
    return recoveredAny
        ? { ...nextState, operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater)) }
        : state;
}
function simulateAutomatedBattle(battle, mode) {
    let nextBattle = (0, battle_1.quickPlaceUnits)(battle);
    nextBattle = (0, battle_1.confirmPlacement)(nextBattle);
    let safety = 0;
    while (nextBattle.phase !== "victory" && nextBattle.phase !== "defeat" && safety < 300) {
        const activeUnit = nextBattle.activeUnitId ? nextBattle.units[nextBattle.activeUnitId] ?? null : null;
        if (!activeUnit) {
            nextBattle = (0, battle_1.advanceTurn)(nextBattle);
            nextBattle = (0, battle_1.evaluateBattleOutcome)(nextBattle);
            safety += 1;
            continue;
        }
        if (activeUnit.isEnemy) {
            nextBattle = (0, battle_1.performEnemyTurn)(nextBattle);
        }
        else {
            nextBattle = (0, battle_1.performAutoBattleTurn)(nextBattle, activeUnit.id, mode);
            if (nextBattle.phase !== "victory"
                && nextBattle.phase !== "defeat"
                && nextBattle.activeUnitId === activeUnit.id) {
                nextBattle = (0, battle_1.advanceTurn)(nextBattle);
            }
        }
        nextBattle = (0, battle_1.evaluateBattleOutcome)(nextBattle);
        const friendlyUnits = Object.values(nextBattle.units).filter((unit) => !unit.isEnemy);
        const incapacitatedCount = friendlyUnits.filter((unit) => unit.hp <= 0).length;
        const lowHealthCount = friendlyUnits.filter((unit) => unit.hp > 0 && unit.hp / Math.max(1, unit.maxHp) <= 0.4).length;
        const shouldRetreat = mode === "undaring"
            ? incapacitatedCount > 0 || lowHealthCount >= 2
            : incapacitatedCount >= Math.ceil(Math.max(1, friendlyUnits.length) / 2);
        if (nextBattle.phase !== "victory" && nextBattle.phase !== "defeat" && shouldRetreat) {
            nextBattle = {
                ...nextBattle,
                phase: "defeat",
                log: [
                    ...nextBattle.log,
                    `THEATER//AUTO :: ${mode.toUpperCase()} protocol ordered a retreat before total squad collapse.`,
                ],
            };
            break;
        }
        safety += 1;
    }
    return nextBattle;
}
function scaleBattleRewards(rewards, multiplier) {
    if (!rewards) {
        return rewards;
    }
    return {
        ...rewards,
        wad: Math.max(0, Math.floor((rewards.wad ?? 0) * multiplier)),
        metalScrap: Math.max(0, Math.floor((rewards.metalScrap ?? 0) * multiplier)),
        wood: Math.max(0, Math.floor((rewards.wood ?? 0) * multiplier)),
        chaosShards: Math.max(0, Math.floor((rewards.chaosShards ?? 0) * multiplier)),
        steamComponents: Math.max(0, Math.floor((rewards.steamComponents ?? 0) * multiplier)),
        squadXp: Math.max(0, Math.floor((rewards.squadXp ?? 0) * multiplier)),
    };
}
function createTheaterBattleState(state, roomId, squadId) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return null;
    }
    const room = theater.rooms[roomId];
    if (!room) {
        return null;
    }
    const initiatingSquad = squadId
        ? theater.squads.find((squad) => squad.squadId === squadId) ?? null
        : getSelectedSquad(theater);
    if (!initiatingSquad || !canManuallyControlTheaterSquad(theater, initiatingSquad)) {
        return null;
    }
    return buildTheaterBattleStateForSquad(state, operation, theater, room, initiatingSquad, "manual");
}
function applyTheaterBattleOutcome(state, battle) {
    if (!hasTheaterOperation(state.operation) || !battle.theaterMeta) {
        return state;
    }
    let nextState = syncBattleUnitsBackToCampaignState(state, battle);
    nextState = markOperationBattleCasualties(nextState, battle);
    const operation = getPreparedTheaterOperation(nextState);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return nextState;
    }
    const theaterWithFieldAssets = syncTheaterRoomFieldAssetsFromBattle(theater, battle);
    if (battle.phase === "victory") {
        return secureTheaterRoomInState({
            ...nextState,
            operation: resolveOperationFields(operation, theaterWithFieldAssets),
        }, battle.theaterMeta.roomId, battle.theaterMeta.squadId);
    }
    const nextTheater = cloneTheater(theaterWithFieldAssets);
    const room = nextTheater.rooms[battle.theaterMeta.roomId];
    if (room?.secured) {
        room.underThreat = true;
        room.damaged = room.damaged || battle.defenseObjective?.type === "survive_turns";
        nextTheater.activeThreats = nextTheater.activeThreats.map((threat) => threat.currentRoomId === room.id || threat.targetRoomId === room.id
            ? { ...threat, active: true, roomId: room.id, currentRoomId: room.id, routeIndex: threat.route.length - 1, etaTick: nextTheater.tickCount }
            : threat);
    }
    return {
        ...nextState,
        operation: resolveOperationFields(operation, addTheaterEvent(recomputeTheaterNetwork(nextTheater), `CONTACT :: ${room?.label ?? battle.theaterMeta.roomId} repelled the squad. Theater line remains contested.`)),
    };
}
function resolveTheaterAutoBattle(state, squadId, roomId, mode) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    if (!operation || !theater) {
        return state;
    }
    const squad = findSquad(theater, squadId);
    const room = theater.rooms[roomId];
    if (!squad || !room) {
        return state;
    }
    const battle = buildTheaterBattleStateForSquad(state, operation, theater, room, squad, mode);
    if (!battle) {
        return state;
    }
    const resolvedBattle = simulateAutomatedBattle(battle, mode);
    const rewardMultiplier = mode === "undaring" ? 0.7 : 0.9;
    const scaledRewards = scaleBattleRewards(resolvedBattle.rewards, rewardMultiplier);
    let nextState = (0, session_1.grantSessionResources)(state, {
        wad: scaledRewards?.wad ?? 0,
        resources: toResourceWalletDelta(scaledRewards),
    });
    nextState = applyTheaterBattleOutcome(nextState, { ...resolvedBattle, rewards: scaledRewards });
    const nextOperation = getPreparedTheaterOperation(nextState);
    const nextTheater = nextOperation?.theater;
    if (!nextOperation || !nextTheater) {
        return nextState;
    }
    const latestSquad = findSquad(nextTheater, squadId);
    const roomLabel = nextTheater.rooms[roomId]?.label ?? roomId;
    const outcomeLabel = resolvedBattle.phase === "victory" ? "cleared" : "was repelled from";
    return {
        ...nextState,
        operation: resolveOperationFields(nextOperation, addTheaterEvent(cloneTheater(nextTheater), `AUTO-${mode.toUpperCase()} :: ${latestSquad?.displayName ?? squadId.toUpperCase()} ${outcomeLabel} ${roomLabel}. Rewards scaled to ${Math.round(rewardMultiplier * 100)}%.`)),
    };
}
function getTheaterSummary(state) {
    const operation = getPreparedTheaterOperation(state);
    const theater = operation?.theater;
    const rooms = theater ? Object.values(theater.rooms) : [];
    return {
        currentScreen: "THEATER_COMMAND",
        currentOperation: operation?.codename ?? "NONE",
        currentTheater: theater?.definition.name ?? "NONE",
        selectedRoomId: theater?.selectedRoomId ?? "none",
        currentTickCount: theater?.tickCount ?? 0,
        securedRooms: rooms.filter((room) => room.secured).length,
        coreCount: rooms.reduce((total, room) => total + getRoomCoreAssignments(room).length, 0),
        threatenedRooms: rooms.filter((room) => room.underThreat || room.damaged).length,
    };
}
function getTheaterStarterResources() {
    return { ...THEATER_STARTER_RESERVE };
}
function getFortificationCost(type) {
    return { ...(FORTIFICATION_COSTS[type] ?? {}) };
}
function formatResourceCost(cost) {
    return (0, resources_1.getResourceEntries)(cost).map((entry) => `${entry.amount} ${(0, resources_1.formatResourceLabel)(entry.key)}`).join(" / ") || "0";
}
function getTheaterUpkeepPerTick(theater) {
    const recomputedTheater = recomputeTheaterNetwork(theater);
    const resourceCollection = collectResourceIncome(recomputedTheater, 1);
    return {
        wadUpkeep: sumWadUpkeep(recomputedTheater, 1),
        incomePerTick: resourceCollection.incomePerTick,
    };
}
function getTheaterRoomCoreAssignments(room) {
    return getRoomCoreAssignments(room);
}
function getTheaterRoomOpenCoreSlots(room) {
    return Math.max(0, Math.max(1, room.coreSlotCapacity ?? 1) - getRoomCoreAssignments(room).length);
}
function isTheaterCoreOperational(room) {
    return roomHasOperationalCore(room);
}
function getTheaterCoreOperationalRequirements(room) {
    return getRoomCoreOperationalRequirements(room);
}
function getTheaterCoreOfflineReason(room) {
    return getCoreOfflineReason(room);
}
function hasCompletedTheaterObjective(theater) {
    return theater.objectiveComplete && theater.completion !== null;
}
function recomputeTheaterNetwork(theater) {
    return applySandboxSlice(recomputeSupplyAndPower(theater));
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEMA_FIELD_ASSET_DEFINITIONS = exports.SCHEMA_FORTIFICATION_DEFINITIONS = exports.SCHEMA_CORE_DEFINITIONS = exports.ROOM_TAG_LABELS = exports.SCHEMA_FIELD_ASSET_ORDER = exports.SCHEMA_FORTIFICATION_ORDER = exports.SCHEMA_CORE_BUILD_ORDER = exports.SCHEMA_STARTER_FORTIFICATION_TYPES = exports.SCHEMA_STARTER_CORE_TYPES = void 0;
exports.formatRoomTagLabel = formatRoomTagLabel;
exports.getOrderedSchemaCoreTypes = getOrderedSchemaCoreTypes;
exports.getOrderedSchemaFortificationTypes = getOrderedSchemaFortificationTypes;
exports.getOrderedSchemaFieldAssetTypes = getOrderedSchemaFieldAssetTypes;
exports.createDefaultSchemaUnlockState = createDefaultSchemaUnlockState;
exports.normalizeSchemaUnlockState = normalizeSchemaUnlockState;
exports.withNormalizedSchemaState = withNormalizedSchemaState;
exports.getSchemaUnlockState = getSchemaUnlockState;
exports.isCoreTypeUnlocked = isCoreTypeUnlocked;
exports.isFortificationUnlocked = isFortificationUnlocked;
exports.isFieldAssetUnlocked = isFieldAssetUnlocked;
exports.getFieldAssetBuildCost = getFieldAssetBuildCost;
exports.createEmptyFortificationPips = createEmptyFortificationPips;
exports.normalizeFortificationPips = normalizeFortificationPips;
exports.getInstalledFortificationCount = getInstalledFortificationCount;
exports.getInstalledFortificationSummary = getInstalledFortificationSummary;
exports.getRoomTags = getRoomTags;
exports.getNaturalResourceStockCapacityForRoom = getNaturalResourceStockCapacityForRoom;
exports.normalizeTheaterRoomNaturalStock = normalizeTheaterRoomNaturalStock;
exports.roomHasTag = roomHasTag;
exports.getCoreIncomeForRoom = getCoreIncomeForRoom;
exports.getCoreSynergyLinesForRoom = getCoreSynergyLinesForRoom;
exports.formatResourceWalletInline = formatResourceWalletInline;
exports.unlockSchemaCoreTypeInState = unlockSchemaCoreTypeInState;
exports.unlockSchemaFortificationInState = unlockSchemaFortificationInState;
exports.unlockSchemaFieldAssetInState = unlockSchemaFieldAssetInState;
const resources_1 = require("./resources");
const session_1 = require("./session");
const EMPTY_NATURAL_STOCK = {
    metalScrap: 0,
    wood: 0,
    steamComponents: 0,
};
exports.SCHEMA_STARTER_CORE_TYPES = [
    "supply_depot",
    "command_center",
    "medical_ward",
    "armory",
    "mine",
    "generator",
    "refinery",
];
exports.SCHEMA_STARTER_FORTIFICATION_TYPES = [
    "barricade",
    "powerRail",
    "waystation",
];
exports.SCHEMA_CORE_BUILD_ORDER = [
    "supply_depot",
    "command_center",
    "medical_ward",
    "armory",
    "mine",
    "generator",
    "logistics_hub",
    "prototype_systems_lab",
    "forward_maintenance_bay",
    "emergency_supply_cache",
    "forward_fire_support_post",
    "operations_planning_cell",
    "tactics_school",
    "quartermaster_cell",
    "stable",
    "workshop",
    "survey_array",
    "recovery_yard",
    "transit_hub",
    "tavern",
    "refinery",
];
exports.SCHEMA_FORTIFICATION_ORDER = [
    "barricade",
    "powerRail",
    "bulkhead",
    "turret",
    "substation",
    "capacitor",
    "switchgear",
    "overcharger",
    "repeater",
    "sensorArray",
    "signalBooster",
    "waystation",
    "bridgeRig",
    "repairBench",
    "securityTerminal",
];
exports.SCHEMA_FIELD_ASSET_ORDER = [
    "barricade_wall",
    "med_station",
    "ammo_crate",
    "proximity_mine",
    "smoke_emitter",
    "portable_ladder",
    "light_tower",
];
exports.ROOM_TAG_LABELS = {
    ingress: "Ingress",
    uplink: "Base Camp Uplink",
    frontier: "Frontier",
    objective: "Objective",
    power_source: "Power Source",
    elite: "Elite Pressure",
    side_branch: "Side Branch",
    junction: "Junction",
    core_candidate: "C.O.R.E. Candidate",
    relay: "Relay Link",
    metal_rich: "Metal-Rich",
    timber_rich: "Timber-Rich",
    steam_vent: "Steam Vent",
    survey_highground: "Survey Highground",
    transit_junction: "Transit Junction",
    command_suitable: "Command Suitable",
    salvage_rich: "Salvage-Rich",
    medical_supplies: "Medical Supplies",
    stable_suitable: "Stable Suitable",
    tavern_suitable: "Tavern Suitable",
};
function withZeroIncome(incomePerTick) {
    return (0, resources_1.createEmptyResourceWallet)(incomePerTick);
}
function withNaturalStock(stock) {
    return {
        metalScrap: Math.max(0, Math.floor(Number(stock?.metalScrap ?? 0))),
        wood: Math.max(0, Math.floor(Number(stock?.wood ?? 0))),
        steamComponents: Math.max(0, Math.floor(Number(stock?.steamComponents ?? 0))),
    };
}
function addResourceWallet(base, delta) {
    return (0, resources_1.addResourceWallet)(base, delta);
}
exports.SCHEMA_CORE_DEFINITIONS = {
    supply_depot: {
        id: "supply_depot",
        displayName: "Supply Depot",
        shortCode: "SD",
        category: "logistics",
        description: "Logistics anchor that converts a live 100-watt power feed into a 100-crate supply relay for connected rooms.",
        operationalRequirements: {
            powerWatts: 100,
            commsBw: 0,
            supplyCrates: 0,
        },
        supplyOutputCrates: 100,
        buildCost: { metalScrap: 4, wood: 2 },
        upkeep: {},
        wadUpkeepPerTick: 6,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "starter",
        preferredRoomTags: ["transit_junction"],
    },
    command_center: {
        id: "command_center",
        displayName: "Command Center",
        shortCode: "CC",
        category: "command",
        description: "Local control hub that relays a live uplink into a 100 BW comms lattice for connected rooms.",
        operationalRequirements: {
            powerWatts: 100,
            commsBw: 1,
            supplyCrates: 50,
        },
        commsOutputBw: 100,
        buildCost: { metalScrap: 2, chaosShards: 1, steamComponents: 1 },
        upkeep: {},
        wadUpkeepPerTick: 8,
        incomePerTick: {},
        supportRadius: 2,
        unlockSource: "starter",
        preferredRoomTags: ["command_suitable"],
    },
    medical_ward: {
        id: "medical_ward",
        displayName: "Medical Ward",
        shortCode: "MW",
        category: "support",
        description: "Casualty control and stabilization wing that keeps sustained pushes from collapsing.",
        operationalRequirements: {
            powerWatts: 50,
            commsBw: 0,
            supplyCrates: 50,
        },
        buildCost: { wood: 3, chaosShards: 1 },
        upkeep: {},
        wadUpkeepPerTick: 5,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "starter",
        preferredRoomTags: ["medical_supplies"],
    },
    armory: {
        id: "armory",
        displayName: "Armory",
        shortCode: "AR",
        category: "combat",
        description: "Munitions support core that keeps connected squads battle-ready and aggressive.",
        operationalRequirements: {
            powerWatts: 25,
            commsBw: 0,
            supplyCrates: 100,
        },
        buildCost: { metalScrap: 3, steamComponents: 1 },
        upkeep: {},
        wadUpkeepPerTick: 7,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "starter",
    },
    mine: {
        id: "mine",
        displayName: "Mine",
        shortCode: "MN",
        category: "industry",
        description: "Extraction core that turns secured sectors into a steady Metal Scrap and Timber stream.",
        operationalRequirements: {
            powerWatts: 50,
            commsBw: 0,
            supplyCrates: 50,
        },
        buildCost: { metalScrap: 3, wood: 2, steamComponents: 1 },
        upkeep: {},
        wadUpkeepPerTick: 4,
        incomePerTick: { metalScrap: 1, wood: 1 },
        supportRadius: 0,
        unlockSource: "starter",
        preferredRoomTags: ["metal_rich", "timber_rich"],
        tagOutputModifiers: [
            { tag: "metal_rich", output: { metalScrap: 2 }, note: "Mine +2 Metal Scrap/tick" },
            { tag: "timber_rich", output: { wood: 2 }, note: "Mine +2 Wood/tick" },
        ],
    },
    generator: {
        id: "generator",
        displayName: "Generator",
        shortCode: "GN",
        category: "command",
        description: "Strategic power relay that passes through incoming room power and adds +100 watts on top for connected rooms.",
        operationalRequirements: {
            powerWatts: 1,
            commsBw: 0,
            supplyCrates: 50,
        },
        powerOutputWatts: 100,
        powerOutputMode: "add_input",
        buildCost: { metalScrap: 3, steamComponents: 2 },
        upkeep: {},
        wadUpkeepPerTick: 6,
        incomePerTick: {},
        supportRadius: 0,
        unlockSource: "starter",
        preferredRoomTags: ["steam_vent"],
    },
    logistics_hub: {
        id: "logistics_hub",
        displayName: "Logistics Hub",
        shortCode: "LH",
        category: "logistics",
        description: "Placeholder logistics escalation facility for future supply-routing bonuses.",
        buildCost: { metalScrap: 5, wood: 3, steamComponents: 1 },
        upkeep: {},
        wadUpkeepPerTick: 10,
        incomePerTick: {},
        supportRadius: 2,
        unlockSource: "schema",
        unlockCost: { metalScrap: 6, wood: 4 },
        unlockWadCost: 40,
        preferredRoomTags: ["transit_junction"],
        placeholder: true,
    },
    prototype_systems_lab: {
        id: "prototype_systems_lab",
        displayName: "Prototype Systems Lab",
        shortCode: "PL",
        category: "research",
        description: "Placeholder research wing reserved for future experimental support systems.",
        buildCost: { metalScrap: 4, chaosShards: 3, steamComponents: 2 },
        upkeep: {},
        wadUpkeepPerTick: 11,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { chaosShards: 3, steamComponents: 2 },
        unlockWadCost: 55,
        placeholder: true,
    },
    forward_maintenance_bay: {
        id: "forward_maintenance_bay",
        displayName: "Forward Maintenance Bay",
        shortCode: "MB",
        category: "support",
        description: "Placeholder repair-and-refit node for future equipment sustain.",
        buildCost: { metalScrap: 4, wood: 2, steamComponents: 2 },
        upkeep: {},
        wadUpkeepPerTick: 8,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { metalScrap: 4, steamComponents: 2 },
        unlockWadCost: 36,
        placeholder: true,
    },
    emergency_supply_cache: {
        id: "emergency_supply_cache",
        displayName: "Emergency Supply Cache",
        shortCode: "EC",
        category: "logistics",
        description: "Placeholder reserve stockpile for future emergency resupply bursts.",
        buildCost: { wood: 4, metalScrap: 2 },
        upkeep: {},
        wadUpkeepPerTick: 5,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { wood: 5, metalScrap: 2 },
        unlockWadCost: 28,
        placeholder: true,
    },
    forward_fire_support_post: {
        id: "forward_fire_support_post",
        displayName: "Forward Fire Support Post",
        shortCode: "FP",
        category: "combat",
        description: "Placeholder fire-support site for future bombardment and defense pressure tools.",
        buildCost: { metalScrap: 5, steamComponents: 2 },
        upkeep: {},
        wadUpkeepPerTick: 10,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { metalScrap: 5, steamComponents: 2 },
        unlockWadCost: 48,
        placeholder: true,
    },
    operations_planning_cell: {
        id: "operations_planning_cell",
        displayName: "Operations Planning Cell",
        shortCode: "OP",
        category: "command",
        description: "Placeholder planning room for future route, threat, and support forecasting.",
        buildCost: { metalScrap: 3, chaosShards: 2 },
        upkeep: {},
        wadUpkeepPerTick: 8,
        incomePerTick: {},
        supportRadius: 2,
        unlockSource: "schema",
        unlockCost: { chaosShards: 2, metalScrap: 3 },
        unlockWadCost: 38,
        preferredRoomTags: ["command_suitable"],
        placeholder: true,
    },
    tactics_school: {
        id: "tactics_school",
        displayName: "Tactics School",
        shortCode: "TS",
        category: "support",
        description: "Placeholder doctrine-training facility for future unit progression support.",
        buildCost: { wood: 4, chaosShards: 1 },
        upkeep: {},
        wadUpkeepPerTick: 7,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { wood: 4, chaosShards: 1 },
        unlockWadCost: 30,
        placeholder: true,
    },
    quartermaster_cell: {
        id: "quartermaster_cell",
        displayName: "Quartermaster Cell",
        shortCode: "QM",
        category: "logistics",
        description: "Placeholder procurement office for future supply efficiency bonuses.",
        buildCost: { metalScrap: 3, wood: 3 },
        upkeep: {},
        wadUpkeepPerTick: 7,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { metalScrap: 3, wood: 3 },
        unlockWadCost: 32,
        placeholder: true,
    },
    stable: {
        id: "stable",
        displayName: "Stable",
        shortCode: "ST",
        category: "mobility",
        description: "Placeholder mount staging yard for future movement and convoy bonuses.",
        buildCost: { wood: 5, metalScrap: 2 },
        upkeep: {},
        wadUpkeepPerTick: 6,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { wood: 5, metalScrap: 2 },
        unlockWadCost: 26,
        preferredRoomTags: ["stable_suitable", "transit_junction"],
        placeholder: true,
    },
    workshop: {
        id: "workshop",
        displayName: "Workshop",
        shortCode: "WK",
        category: "industry",
        description: "Forward workshop C.O.R.E. that mirrors the HAVEN workshop node for gear building, customization, and crafting inside the theater.",
        buildCost: { metalScrap: 5, steamComponents: 2, wood: 1 },
        upkeep: {},
        wadUpkeepPerTick: 9,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { metalScrap: 6, steamComponents: 2 },
        unlockWadCost: 44,
        placeholder: false,
    },
    fabrication_bay: {
        id: "fabrication_bay",
        displayName: "Fabrication Bay",
        shortCode: "FB",
        category: "industry",
        description: "Placeholder fabrication shop for future on-site production effects.",
        buildCost: { metalScrap: 5, steamComponents: 2, wood: 1 },
        upkeep: {},
        wadUpkeepPerTick: 9,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { metalScrap: 6, steamComponents: 2 },
        unlockWadCost: 44,
        placeholder: true,
    },
    survey_array: {
        id: "survey_array",
        displayName: "Survey Array",
        shortCode: "SV",
        category: "command",
        description: "Placeholder recon node for future theater scouting and reveal bonuses.",
        buildCost: { metalScrap: 2, chaosShards: 2, steamComponents: 1 },
        upkeep: {},
        wadUpkeepPerTick: 8,
        incomePerTick: {},
        supportRadius: 2,
        unlockSource: "schema",
        unlockCost: { chaosShards: 2, steamComponents: 1 },
        unlockWadCost: 34,
        preferredRoomTags: ["survey_highground"],
        placeholder: true,
    },
    recovery_yard: {
        id: "recovery_yard",
        displayName: "Recovery Yard",
        shortCode: "RY",
        category: "industry",
        description: "Placeholder salvage-processing yard for future post-battle recovery bonuses.",
        buildCost: { metalScrap: 3, wood: 2 },
        upkeep: {},
        wadUpkeepPerTick: 7,
        incomePerTick: {},
        supportRadius: 0,
        unlockSource: "schema",
        unlockCost: { metalScrap: 4, wood: 2 },
        unlockWadCost: 28,
        preferredRoomTags: ["salvage_rich"],
        placeholder: true,
    },
    transit_hub: {
        id: "transit_hub",
        displayName: "Transit Hub",
        shortCode: "TH",
        category: "mobility",
        description: "Placeholder movement hub for future travel-time smoothing and routing bonuses.",
        buildCost: { metalScrap: 4, wood: 3, steamComponents: 1 },
        upkeep: {},
        wadUpkeepPerTick: 9,
        incomePerTick: {},
        supportRadius: 2,
        unlockSource: "schema",
        unlockCost: { metalScrap: 4, wood: 3 },
        unlockWadCost: 36,
        preferredRoomTags: ["transit_junction"],
        placeholder: true,
    },
    tavern: {
        id: "tavern",
        displayName: "Tavern",
        shortCode: "TV",
        category: "civic",
        description: "Forward tavern C.O.R.E. that mirrors HAVEN's recruitment hub, keeping contracts and mess-hall services online during an operation.",
        buildCost: { wood: 4, chaosShards: 1 },
        upkeep: {},
        wadUpkeepPerTick: 6,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { wood: 4, chaosShards: 1 },
        unlockWadCost: 24,
        preferredRoomTags: ["tavern_suitable"],
        placeholder: false,
    },
    refinery: {
        id: "refinery",
        displayName: "Refinery",
        shortCode: "RF",
        category: "industry",
        description: "Processing core that distills theater throughput into a steady Steam Components stream.",
        operationalRequirements: {
            powerWatts: 50,
            commsBw: 0,
            supplyCrates: 50,
        },
        buildCost: { metalScrap: 4, steamComponents: 1, wood: 1 },
        upkeep: {},
        wadUpkeepPerTick: 7,
        incomePerTick: { steamComponents: 1 },
        supportRadius: 0,
        unlockSource: "starter",
        preferredRoomTags: ["steam_vent"],
        tagOutputModifiers: [
            { tag: "steam_vent", output: { steamComponents: 3 }, note: "Refinery +3 Steam Components/tick" },
        ],
        placeholder: false,
    },
};
exports.SCHEMA_FORTIFICATION_DEFINITIONS = {
    barricade: {
        id: "barricade",
        displayName: "Barricade",
        description: "Reduces frontier damage and is consumed first when a secured room is overwhelmed.",
        buildCost: { metalScrap: 2, wood: 2 },
        unlockSource: "starter",
        preferredRoomTags: ["frontier"],
    },
    powerRail: {
        id: "powerRail",
        displayName: "Power Rail",
        description: "Required for routing power through secured rooms.",
        buildCost: { metalScrap: 2, steamComponents: 1 },
        unlockSource: "starter",
        preferredRoomTags: ["power_source", "transit_junction"],
    },
    bulkhead: {
        id: "bulkhead",
        displayName: "Bulkhead",
        description: "Placeholder hard-seal fortification for future structural defense bonuses.",
        buildCost: { metalScrap: 3, wood: 1 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 3, wood: 1 },
        unlockWadCost: 16,
        placeholder: true,
    },
    turret: {
        id: "turret",
        displayName: "Turret",
        description: "Placeholder defensive emplacement for future theater attack responses.",
        buildCost: { metalScrap: 3, steamComponents: 1 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 4, steamComponents: 1 },
        unlockWadCost: 20,
        placeholder: true,
    },
    substation: {
        id: "substation",
        displayName: "Substation",
        description: "Placeholder power-routing node for future grid smoothing.",
        buildCost: { metalScrap: 2, steamComponents: 2 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 2, steamComponents: 2 },
        unlockWadCost: 18,
        preferredRoomTags: ["steam_vent"],
        placeholder: true,
    },
    capacitor: {
        id: "capacitor",
        displayName: "Capacitor",
        description: "Placeholder charge reservoir for future burst power support.",
        buildCost: { metalScrap: 2, chaosShards: 1, steamComponents: 1 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 2, chaosShards: 1 },
        unlockWadCost: 18,
        placeholder: true,
    },
    switchgear: {
        id: "switchgear",
        displayName: "Switchgear",
        description: "Placeholder routing control package for future dynamic network switching.",
        buildCost: { metalScrap: 2, steamComponents: 1 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 2, steamComponents: 1 },
        unlockWadCost: 14,
        placeholder: true,
    },
    overcharger: {
        id: "overcharger",
        displayName: "Overcharger",
        description: "Placeholder power booster for future high-demand facility spikes.",
        buildCost: { metalScrap: 2, chaosShards: 1, steamComponents: 2 },
        unlockSource: "schema",
        unlockCost: { chaosShards: 1, steamComponents: 2 },
        unlockWadCost: 22,
        placeholder: true,
    },
    repeater: {
        id: "repeater",
        displayName: "Repeater",
        description: "Placeholder comms repeater for future visibility and warning coverage.",
        buildCost: { metalScrap: 1, steamComponents: 1 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 1, steamComponents: 1 },
        unlockWadCost: 12,
        preferredRoomTags: ["survey_highground"],
        placeholder: true,
    },
    sensorArray: {
        id: "sensorArray",
        displayName: "Sensor Array",
        description: "Placeholder sensor package for future recon and threat detection.",
        buildCost: { metalScrap: 1, chaosShards: 1, steamComponents: 1 },
        unlockSource: "schema",
        unlockCost: { chaosShards: 1, steamComponents: 1 },
        unlockWadCost: 16,
        preferredRoomTags: ["survey_highground"],
        placeholder: true,
    },
    signalBooster: {
        id: "signalBooster",
        displayName: "Signal Booster",
        description: "Placeholder signal booster for future comms bandwidth bonuses.",
        buildCost: { metalScrap: 1, steamComponents: 1, wood: 1 },
        unlockSource: "schema",
        unlockCost: { steamComponents: 1, wood: 1 },
        unlockWadCost: 12,
        placeholder: true,
    },
    waystation: {
        id: "waystation",
        displayName: "Way Station",
        description: "Eliminates supply decay into and out of this room, preserving the logistics line through the route.",
        buildCost: { wood: 2, metalScrap: 2 },
        unlockSource: "starter",
        preferredRoomTags: ["transit_junction"],
        placeholder: false,
    },
    bridgeRig: {
        id: "bridgeRig",
        displayName: "Bridge Rig",
        description: "Placeholder structural kit for future route repair and reconnect effects.",
        buildCost: { metalScrap: 2, wood: 2 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 2, wood: 2 },
        unlockWadCost: 14,
        preferredRoomTags: ["transit_junction"],
        placeholder: true,
    },
    repairBench: {
        id: "repairBench",
        displayName: "Repair Bench",
        description: "Placeholder maintenance fixture for future damage recovery.",
        buildCost: { metalScrap: 2, wood: 1, steamComponents: 1 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 2, steamComponents: 1 },
        unlockWadCost: 16,
        placeholder: true,
    },
    securityTerminal: {
        id: "securityTerminal",
        displayName: "Security Terminal",
        description: "Placeholder command-security node for future defense responses and access control.",
        buildCost: { metalScrap: 1, chaosShards: 1, steamComponents: 1 },
        unlockSource: "schema",
        unlockCost: { chaosShards: 1, steamComponents: 1 },
        unlockWadCost: 18,
        preferredRoomTags: ["command_suitable"],
        placeholder: true,
    },
};
exports.SCHEMA_FIELD_ASSET_DEFINITIONS = {
    barricade_wall: {
        id: "barricade_wall",
        displayName: "Barricade Wall",
        description: "Deployable wall segment that blocks movement and sightlines to reshape a room before contact.",
        buildCost: { wood: 1 },
        unlockSource: "schema",
        unlockCost: { wood: 1 },
        unlockWadCost: 8,
        tacticalRole: "Hard route control / artificial chokepoint",
    },
    med_station: {
        id: "med_station",
        displayName: "Med Station",
        description: "One-use recovery station that restores a unit holding the prepared defensive line.",
        buildCost: { wood: 1 },
        unlockSource: "schema",
        unlockCost: { wood: 1, chaosShards: 1 },
        unlockWadCost: 12,
        tacticalRole: "One-use sustain anchor",
    },
    ammo_crate: {
        id: "ammo_crate",
        displayName: "Ammo Crate",
        description: "One-use reload point for rooms expected to support prolonged ranged pressure.",
        buildCost: { wood: 1 },
        unlockSource: "schema",
        unlockCost: { wood: 1, metalScrap: 1 },
        unlockWadCost: 12,
        tacticalRole: "One-use reload anchor",
    },
    proximity_mine: {
        id: "proximity_mine",
        displayName: "Proximity Mine",
        description: "Hidden explosive trap for punishing predictable pushes through narrow lanes.",
        buildCost: { metalScrap: 1 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 2, chaosShards: 1 },
        unlockWadCost: 16,
        tacticalRole: "Triggered route denial",
    },
    smoke_emitter: {
        id: "smoke_emitter",
        displayName: "Smoke Emitter",
        description: "Deployable obscurant that breaks sightlines and softens long-range pressure.",
        buildCost: { metalScrap: 1 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 2, steamComponents: 1 },
        unlockWadCost: 16,
        tacticalRole: "Sightline denial",
    },
    portable_ladder: {
        id: "portable_ladder",
        displayName: "Portable Ladder",
        description: "Adds a flexible climb route to elevated positions without rebuilding the room itself.",
        buildCost: { wood: 2 },
        unlockSource: "schema",
        unlockCost: { wood: 2, metalScrap: 1 },
        unlockWadCost: 18,
        tacticalRole: "Vertical access tool",
    },
    light_tower: {
        id: "light_tower",
        displayName: "Deployable Light Tower",
        description: "Prepared illumination rig for rooms where visibility and control matter.",
        buildCost: { metalScrap: 1, steamComponents: 1 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 2, steamComponents: 1 },
        unlockWadCost: 20,
        tacticalRole: "Vision support / area denial cue",
    },
};
function formatRoomTagLabel(tag) {
    return exports.ROOM_TAG_LABELS[tag] ?? String(tag).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
function getOrderedSchemaCoreTypes() {
    return [...exports.SCHEMA_CORE_BUILD_ORDER];
}
function getOrderedSchemaFortificationTypes() {
    return [...exports.SCHEMA_FORTIFICATION_ORDER];
}
function getOrderedSchemaFieldAssetTypes() {
    return [...exports.SCHEMA_FIELD_ASSET_ORDER];
}
function createDefaultSchemaUnlockState() {
    return {
        unlockedCoreTypes: [...exports.SCHEMA_STARTER_CORE_TYPES],
        unlockedFortificationPips: [...exports.SCHEMA_STARTER_FORTIFICATION_TYPES],
        unlockedFieldAssetTypes: [],
    };
}
function normalizeSchemaUnlockState(schema) {
    const coreSet = new Set(exports.SCHEMA_STARTER_CORE_TYPES);
    (schema?.unlockedCoreTypes ?? []).forEach((coreType) => {
        if (exports.SCHEMA_CORE_BUILD_ORDER.includes(coreType) || coreType === "fabrication_bay") {
            coreSet.add(coreType);
        }
    });
    const fortificationSet = new Set(exports.SCHEMA_STARTER_FORTIFICATION_TYPES);
    (schema?.unlockedFortificationPips ?? []).forEach((fortificationType) => {
        if (exports.SCHEMA_FORTIFICATION_ORDER.includes(fortificationType)) {
            fortificationSet.add(fortificationType);
        }
    });
    const fieldAssetSet = new Set();
    (schema?.unlockedFieldAssetTypes ?? []).forEach((fieldAssetType) => {
        if (exports.SCHEMA_FIELD_ASSET_ORDER.includes(fieldAssetType)) {
            fieldAssetSet.add(fieldAssetType);
        }
    });
    return {
        unlockedCoreTypes: [
            ...exports.SCHEMA_CORE_BUILD_ORDER.filter((coreType) => coreSet.has(coreType)),
            ...(coreSet.has("fabrication_bay") ? ["fabrication_bay"] : []),
        ],
        unlockedFortificationPips: exports.SCHEMA_FORTIFICATION_ORDER.filter((fortificationType) => fortificationSet.has(fortificationType)),
        unlockedFieldAssetTypes: exports.SCHEMA_FIELD_ASSET_ORDER.filter((fieldAssetType) => fieldAssetSet.has(fieldAssetType)),
    };
}
function withNormalizedSchemaState(state) {
    const normalized = normalizeSchemaUnlockState(state.schema);
    const current = state.schema;
    if (current
        && current.unlockedCoreTypes.length === normalized.unlockedCoreTypes.length
        && current.unlockedFortificationPips.length === normalized.unlockedFortificationPips.length
        && current.unlockedFieldAssetTypes.length === normalized.unlockedFieldAssetTypes.length
        && current.unlockedCoreTypes.every((coreType, index) => normalized.unlockedCoreTypes[index] === coreType)
        && current.unlockedFortificationPips.every((fortificationType, index) => normalized.unlockedFortificationPips[index] === fortificationType)
        && current.unlockedFieldAssetTypes.every((fieldAssetType, index) => normalized.unlockedFieldAssetTypes[index] === fieldAssetType)) {
        return state;
    }
    return {
        ...state,
        schema: normalized,
    };
}
function getSchemaUnlockState(state) {
    return normalizeSchemaUnlockState(state.schema);
}
function isCoreTypeUnlocked(state, coreType) {
    return getSchemaUnlockState(state).unlockedCoreTypes.includes(coreType);
}
function isFortificationUnlocked(state, fortificationType) {
    return getSchemaUnlockState(state).unlockedFortificationPips.includes(fortificationType);
}
function isFieldAssetUnlocked(state, fieldAssetType) {
    return getSchemaUnlockState(state).unlockedFieldAssetTypes.includes(fieldAssetType);
}
function getFieldAssetBuildCost(fieldAssetType) {
    return { ...(exports.SCHEMA_FIELD_ASSET_DEFINITIONS[fieldAssetType]?.buildCost ?? {}) };
}
function createEmptyFortificationPips() {
    return Object.fromEntries(exports.SCHEMA_FORTIFICATION_ORDER.map((fortificationType) => [fortificationType, 0]));
}
function normalizeFortificationPips(pips) {
    const normalized = createEmptyFortificationPips();
    exports.SCHEMA_FORTIFICATION_ORDER.forEach((fortificationType) => {
        normalized[fortificationType] = Math.max(0, Number(pips?.[fortificationType] ?? 0));
    });
    return normalized;
}
function getInstalledFortificationCount(pips) {
    return exports.SCHEMA_FORTIFICATION_ORDER.reduce((total, fortificationType) => total + Math.max(0, Number(pips?.[fortificationType] ?? 0)), 0);
}
function getInstalledFortificationSummary(pips) {
    return exports.SCHEMA_FORTIFICATION_ORDER
        .filter((fortificationType) => Number(pips?.[fortificationType] ?? 0) > 0)
        .map((fortificationType) => `${exports.SCHEMA_FORTIFICATION_DEFINITIONS[fortificationType].displayName} x${Number(pips?.[fortificationType] ?? 0)}`);
}
function getRoomTags(roomOrTags) {
    const tags = Array.isArray(roomOrTags)
        ? roomOrTags
        : roomOrTags?.tags ?? [];
    return Array.from(new Set(tags));
}
function getNaturalResourceStockCapacityForRoom(roomOrTags) {
    const tags = getRoomTags(roomOrTags);
    const stock = { ...EMPTY_NATURAL_STOCK };
    stock.metalScrap += 3000;
    stock.wood += 3000;
    stock.steamComponents += 2500;
    if (tags.includes("metal_rich")) {
        stock.metalScrap += 4000;
    }
    if (tags.includes("timber_rich")) {
        stock.wood += 4000;
    }
    if (tags.includes("salvage_rich")) {
        stock.metalScrap += 2500;
        stock.wood += 1500;
    }
    if (tags.includes("resource_pocket")) {
        stock.metalScrap += 2000;
        stock.wood += 2000;
    }
    if (tags.includes("steam_vent")) {
        stock.steamComponents += 5500;
    }
    return withNaturalStock(stock);
}
function normalizeTheaterRoomNaturalStock(roomOrTags, currentStock, maxStock) {
    const normalizedMax = withNaturalStock(maxStock && Object.values(maxStock).some((value) => Number(value ?? 0) > 0)
        ? maxStock
        : getNaturalResourceStockCapacityForRoom(roomOrTags));
    const normalizedCurrent = withNaturalStock(currentStock && Object.values(currentStock).some((value) => value !== undefined)
        ? {
            metalScrap: Math.min(Number(currentStock.metalScrap ?? normalizedMax.metalScrap), normalizedMax.metalScrap),
            wood: Math.min(Number(currentStock.wood ?? normalizedMax.wood), normalizedMax.wood),
            steamComponents: Math.min(Number(currentStock.steamComponents ?? normalizedMax.steamComponents), normalizedMax.steamComponents),
        }
        : normalizedMax);
    return {
        current: normalizedCurrent,
        max: normalizedMax,
    };
}
function roomHasTag(roomOrTags, tag) {
    return getRoomTags(roomOrTags).includes(tag);
}
function getCoreIncomeForRoom(coreType, roomOrTags) {
    const definition = exports.SCHEMA_CORE_DEFINITIONS[coreType];
    let income = withZeroIncome(definition.incomePerTick);
    const tags = getRoomTags(roomOrTags);
    definition.tagOutputModifiers?.forEach((modifier) => {
        if (tags.includes(modifier.tag)) {
            income = addResourceWallet(income, modifier.output);
        }
    });
    return income;
}
function getCoreSynergyLinesForRoom(coreType, roomOrTags) {
    const definition = exports.SCHEMA_CORE_DEFINITIONS[coreType];
    const tags = getRoomTags(roomOrTags);
    return (definition.tagOutputModifiers ?? [])
        .filter((modifier) => tags.includes(modifier.tag))
        .map((modifier) => {
        const note = modifier.note ?? formatResourceWalletInline(modifier.output);
        return `${formatRoomTagLabel(modifier.tag)}: ${note}`;
    });
}
function formatResourceWalletInline(delta) {
    const parts = (0, resources_1.getResourceEntries)(delta).map((entry) => `+${entry.amount} ${entry.label}/tick`);
    return parts.length > 0 ? parts.join(" / ") : "No resource output";
}
function hasEnoughResources(resources, cost) {
    return (0, resources_1.hasEnoughResources)(resources, cost);
}
function subtractResources(resources, cost) {
    return (0, resources_1.subtractResourceWallet)(resources, cost, true);
}
function unlockSchemaCoreTypeInState(state, coreType) {
    const normalizedState = withNormalizedSchemaState(state);
    const definition = exports.SCHEMA_CORE_DEFINITIONS[coreType];
    if (!definition) {
        return { state: normalizedState, success: false, message: "Unknown C.O.R.E. authorization." };
    }
    if (definition.unlockSource === "starter") {
        return { state: normalizedState, success: false, message: `${definition.displayName} is already authorized.` };
    }
    if (isCoreTypeUnlocked(normalizedState, coreType)) {
        return { state: normalizedState, success: false, message: `${definition.displayName} is already unlocked.` };
    }
    if (!(0, session_1.canSessionAffordCost)(normalizedState, {
        wad: definition.unlockWadCost ?? 0,
        resources: definition.unlockCost,
    })) {
        return { state: normalizedState, success: false, message: `Insufficient resources to authorize ${definition.displayName}.` };
    }
    const schema = getSchemaUnlockState(normalizedState);
    const spendResult = (0, session_1.spendSessionCost)(normalizedState, {
        wad: definition.unlockWadCost ?? 0,
        resources: definition.unlockCost,
    });
    if (!spendResult.success) {
        return { state: normalizedState, success: false, message: `Insufficient resources to authorize ${definition.displayName}.` };
    }
    return {
        success: true,
        message: `${definition.displayName} authorized in S.C.H.E.M.A.`,
        state: {
            ...spendResult.state,
            schema: {
                ...schema,
                unlockedCoreTypes: [...schema.unlockedCoreTypes, coreType],
            },
        },
    };
}
function unlockSchemaFortificationInState(state, fortificationType) {
    const normalizedState = withNormalizedSchemaState(state);
    const definition = exports.SCHEMA_FORTIFICATION_DEFINITIONS[fortificationType];
    if (!definition) {
        return { state: normalizedState, success: false, message: "Unknown fortification authorization." };
    }
    if (definition.unlockSource === "starter") {
        return { state: normalizedState, success: false, message: `${definition.displayName} is already authorized.` };
    }
    if (isFortificationUnlocked(normalizedState, fortificationType)) {
        return { state: normalizedState, success: false, message: `${definition.displayName} is already unlocked.` };
    }
    if (!(0, session_1.canSessionAffordCost)(normalizedState, {
        wad: definition.unlockWadCost ?? 0,
        resources: definition.unlockCost,
    })) {
        return { state: normalizedState, success: false, message: `Insufficient resources to authorize ${definition.displayName}.` };
    }
    const schema = getSchemaUnlockState(normalizedState);
    const spendResult = (0, session_1.spendSessionCost)(normalizedState, {
        wad: definition.unlockWadCost ?? 0,
        resources: definition.unlockCost,
    });
    if (!spendResult.success) {
        return { state: normalizedState, success: false, message: `Insufficient resources to authorize ${definition.displayName}.` };
    }
    return {
        success: true,
        message: `${definition.displayName} authorized in S.C.H.E.M.A.`,
        state: {
            ...spendResult.state,
            schema: {
                ...schema,
                unlockedFortificationPips: [...schema.unlockedFortificationPips, fortificationType],
            },
        },
    };
}
function unlockSchemaFieldAssetInState(state, fieldAssetType) {
    const normalizedState = withNormalizedSchemaState(state);
    const definition = exports.SCHEMA_FIELD_ASSET_DEFINITIONS[fieldAssetType];
    if (!definition) {
        return { state: normalizedState, success: false, message: "Unknown field asset authorization." };
    }
    if (isFieldAssetUnlocked(normalizedState, fieldAssetType)) {
        return { state: normalizedState, success: false, message: `${definition.displayName} is already unlocked.` };
    }
    if (!(0, session_1.canSessionAffordCost)(normalizedState, {
        wad: definition.unlockWadCost ?? 0,
        resources: definition.unlockCost,
    })) {
        return { state: normalizedState, success: false, message: `Insufficient resources to authorize ${definition.displayName}.` };
    }
    const schema = getSchemaUnlockState(normalizedState);
    const spendResult = (0, session_1.spendSessionCost)(normalizedState, {
        wad: definition.unlockWadCost ?? 0,
        resources: definition.unlockCost,
    });
    if (!spendResult.success) {
        return { state: normalizedState, success: false, message: `Insufficient resources to authorize ${definition.displayName}.` };
    }
    return {
        success: true,
        message: `${definition.displayName} authorized in S.C.H.E.M.A.`,
        state: {
            ...spendResult.state,
            schema: {
                ...schema,
                unlockedFieldAssetTypes: [...schema.unlockedFieldAssetTypes, fieldAssetType],
            },
        },
    };
}

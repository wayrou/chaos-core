"use strict";
// ============================================================================
// QUEST SYSTEM - QUEST DATA DEFINITIONS
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEST_DATABASE = void 0;
exports.getAvailableQuests = getAvailableQuests;
exports.getQuestById = getQuestById;
exports.cloneQuest = cloneQuest;
const technica_1 = require("../content/technica");
/**
 * Quest database - authored standing contracts aligned to the theater / atlas runtime.
 * Imported Technica quests still coexist with these.
 */
exports.QUEST_DATABASE = {
    quest_secure_foothold: {
        id: "quest_secure_foothold",
        title: "Secure The Foothold",
        description: "Chart and secure the first logistics spine around HAVEN.",
        questType: "clear",
        difficultyTier: 1,
        objectives: [
            {
                id: "obj_secure_floor_one_rooms",
                type: "secure_rooms",
                target: "floor_1",
                current: 0,
                required: 6,
                description: "Secure 6 rooms across Floor 1 sectors",
                criteria: {
                    floorOrdinal: 1,
                },
            },
        ],
        rewards: {
            wad: 80,
            xp: 100,
            resources: {
                metalScrap: 8,
                wood: 4,
            },
            gearRewards: [
                {
                    kind: "authored",
                    equipmentId: "gear_coil_gun",
                    fallbackToGenerated: true,
                },
            ],
        },
        status: "available",
    },
    quest_establish_command: {
        id: "quest_establish_command",
        title: "Establish Command",
        description: "Field a command C.O.R.E. so theater squads can stay under direct control.",
        questType: "delivery",
        difficultyTier: 1,
        objectives: [
            {
                id: "obj_build_command_center",
                type: "build_core",
                target: "command_center",
                current: 0,
                required: 1,
                description: "Build 1 Command Center C.O.R.E. on Floor 1",
                criteria: {
                    floorOrdinal: 1,
                    coreType: "command_center",
                },
            },
        ],
        rewards: {
            wad: 100,
            xp: 125,
            resources: {
                chaosShards: 2,
                steamComponents: 2,
            },
        },
        status: "available",
    },
    quest_restore_power_lane: {
        id: "quest_restore_power_lane",
        title: "Restore Power Lane",
        description: "Rebuild a working power route deep enough to hold a contested branch.",
        questType: "delivery",
        difficultyTier: 2,
        objectives: [
            {
                id: "obj_route_power_floor_one",
                type: "route_power",
                target: 40,
                current: 0,
                required: 40,
                description: "Route 40 W to an objective or relay room on Floor 1",
                criteria: {
                    floorOrdinal: 1,
                    roomTag: "objective",
                },
            },
        ],
        rewards: {
            wad: 140,
            xp: 160,
            resources: {
                metalScrap: 10,
                steamComponents: 4,
            },
        },
        status: "available",
    },
    quest_signal_lock: {
        id: "quest_signal_lock",
        title: "Signal Lock",
        description: "Bring the floor under comms control so HAVEN can coordinate deeper pushes.",
        questType: "exploration",
        difficultyTier: 2,
        objectives: [
            {
                id: "obj_establish_comms_floor_one",
                type: "establish_comms",
                target: 30,
                current: 0,
                required: 30,
                description: "Establish 30 BW in an objective or relay room on Floor 1",
                criteria: {
                    floorOrdinal: 1,
                    roomTag: "objective",
                },
            },
        ],
        rewards: {
            wad: 150,
            xp: 180,
            resources: {
                chaosShards: 3,
                wood: 6,
            },
        },
        status: "available",
    },
    quest_floor_one_stabilized: {
        id: "quest_floor_one_stabilized",
        title: "Floor One Stabilized",
        description: "Complete enough sector objectives to lock down the first ring around HAVEN.",
        questType: "clear",
        difficultyTier: 3,
        objectives: [
            {
                id: "obj_complete_floor_one_sectors",
                type: "complete_sector_objectives",
                target: "floor_1",
                current: 0,
                required: 4,
                description: "Complete 4 sector objectives on Floor 1",
                criteria: {
                    floorOrdinal: 1,
                },
            },
        ],
        rewards: {
            wad: 220,
            xp: 250,
            resources: {
                metalScrap: 12,
                wood: 8,
                chaosShards: 4,
                steamComponents: 4,
            },
            gearRewards: [
                {
                    kind: "generated",
                    slotType: "weapon",
                    minStability: 68,
                },
            ],
        },
        status: "available",
    },
};
/**
 * Get all available quests (not yet accepted)
 */
function getAvailableQuests() {
    return [
        ...Object.values(exports.QUEST_DATABASE).filter((quest) => !(0, technica_1.isTechnicaContentDisabled)("quest", quest.id)),
        ...(0, technica_1.getAllImportedQuests)(),
    ].filter((q) => q.status === "available");
}
/**
 * Get quest by ID
 */
function getQuestById(questId) {
    return ((0, technica_1.getImportedQuest)(questId) ||
        ((0, technica_1.isTechnicaContentDisabled)("quest", questId) ? null : exports.QUEST_DATABASE[questId]) ||
        null);
}
/**
 * Generate a fresh copy of a quest (for accepting)
 */
function cloneQuest(quest) {
    return {
        ...quest,
        status: "active",
        acceptedAt: Date.now(),
        objectives: quest.objectives.map((obj) => ({
            ...obj,
            current: 0,
        })),
    };
}

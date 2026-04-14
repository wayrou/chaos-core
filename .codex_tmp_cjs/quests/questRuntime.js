"use strict";
// ============================================================================
// QUEST SYSTEM - THEATER / ATLAS RUNTIME SYNC
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncQuestProgressFromSnapshotState = syncQuestProgressFromSnapshotState;
const campaign_1 = require("../core/campaign");
const systemPing_1 = require("../ui/components/systemPing");
const questRewards_1 = require("./questRewards");
const SNAPSHOT_OBJECTIVE_TYPES = new Set([
    "secure_rooms",
    "complete_sector_objectives",
    "complete_floor",
    "build_core",
    "route_power",
    "establish_comms",
    "deliver_supply",
    "complete_operation",
    "reach_floor",
]);
function cloneQuestState(questState) {
    return {
        ...questState,
        availableQuests: [...questState.availableQuests],
        activeQuests: questState.activeQuests.map((quest) => ({
            ...quest,
            objectives: quest.objectives.map((objective) => ({ ...objective })),
        })),
        completedQuests: [...questState.completedQuests],
        failedQuests: [...questState.failedQuests],
    };
}
function buildRuntimeSnapshot(state, progress) {
    const theatersById = new Map();
    const atlas = progress.opsTerminalAtlas;
    Object.values(atlas?.floorsById ?? {}).forEach((floor) => {
        floor.sectors.forEach((sector) => {
            theatersById.set(sector.theaterId, {
                theaterId: sector.theaterId,
                operationId: sector.operationId,
                floorId: sector.floorId,
                floorOrdinal: sector.floorOrdinal,
                sectorLabel: sector.sectorLabel,
                theater: sector.theater,
            });
        });
    });
    const liveTheater = state.operation?.theater;
    if (liveTheater) {
        const liveTheaterId = state.operation?.atlasTheaterId ?? liveTheater.definition.id;
        theatersById.set(liveTheaterId, {
            theaterId: liveTheaterId,
            operationId: state.operation?.id ?? liveTheater.definition.operationId,
            floorId: state.operation?.atlasFloorId ?? liveTheater.definition.floorId,
            floorOrdinal: liveTheater.definition.floorOrdinal || ((state.operation?.currentFloorIndex ?? 0) + 1),
            sectorLabel: liveTheater.definition.sectorLabel,
            theater: liveTheater,
        });
    }
    const theaterOrdinals = Array.from(theatersById.values()).map((entry) => entry.floorOrdinal);
    const highestFloorOrdinal = Math.max(1, atlas?.currentFloorOrdinal ?? 1, ...Object.values(atlas?.floorsById ?? {}).map((floor) => floor.floorOrdinal), ...theaterOrdinals);
    return {
        completedOperations: new Set(progress.completedOperations),
        currentFloorOrdinal: atlas?.currentFloorOrdinal ?? liveTheater?.definition.floorOrdinal ?? 1,
        highestFloorOrdinal,
        theaters: Array.from(theatersById.values()),
    };
}
function matchesTheater(runtime, objective) {
    const criteria = objective.criteria;
    if (!criteria) {
        return true;
    }
    if (typeof criteria.floorOrdinal === "number" && runtime.floorOrdinal !== criteria.floorOrdinal) {
        return false;
    }
    if (criteria.floorId && runtime.floorId !== criteria.floorId) {
        return false;
    }
    if (criteria.theaterId && runtime.theaterId !== criteria.theaterId) {
        return false;
    }
    if (criteria.operationId && runtime.operationId !== criteria.operationId) {
        return false;
    }
    if (criteria.sectorLabel && runtime.sectorLabel !== criteria.sectorLabel) {
        return false;
    }
    return true;
}
function matchesRoom(runtime, room, objective) {
    if (!matchesTheater(runtime, objective)) {
        return false;
    }
    const criteria = objective.criteria;
    if (!criteria) {
        return true;
    }
    if (criteria.roomId && room.id !== criteria.roomId) {
        return false;
    }
    if (criteria.roomTag && !room.tags.includes(criteria.roomTag)) {
        return false;
    }
    return true;
}
function countMatchingRooms(snapshot, objective, predicate) {
    return snapshot.theaters.reduce((total, runtime) => (total + Object.values(runtime.theater.rooms).filter((room) => matchesRoom(runtime, room, objective) && predicate(room)).length), 0);
}
function countMatchingTheaters(snapshot, objective, predicate) {
    return snapshot.theaters.filter((runtime) => matchesTheater(runtime, objective) && predicate(runtime)).length;
}
function getMatchingRoomFlow(snapshot, objective, flowType) {
    let best = 0;
    snapshot.theaters.forEach((runtime) => {
        Object.values(runtime.theater.rooms).forEach((room) => {
            if (!matchesRoom(runtime, room, objective)) {
                return;
            }
            best = Math.max(best, Math.floor(room[flowType] ?? 0));
        });
    });
    return best;
}
function getObjectiveCurrentValue(objective, snapshot) {
    switch (objective.type) {
        case "secure_rooms":
            return countMatchingRooms(snapshot, objective, (room) => room.secured);
        case "complete_sector_objectives":
            return countMatchingTheaters(snapshot, objective, (runtime) => runtime.theater.objectiveComplete);
        case "complete_floor": {
            const criteriaFloor = objective.criteria?.floorOrdinal;
            if (typeof criteriaFloor === "number") {
                const matching = snapshot.theaters.filter((runtime) => runtime.floorOrdinal === criteriaFloor);
                return matching.length > 0 && matching.every((runtime) => runtime.theater.objectiveComplete) ? 1 : 0;
            }
            const floors = new Map();
            snapshot.theaters.forEach((runtime) => {
                const bucket = floors.get(runtime.floorOrdinal) ?? [];
                bucket.push(runtime);
                floors.set(runtime.floorOrdinal, bucket);
            });
            return Array.from(floors.values()).filter((entries) => entries.length > 0 && entries.every((runtime) => runtime.theater.objectiveComplete)).length;
        }
        case "build_core":
            return countMatchingRooms(snapshot, objective, (room) => (Boolean(room.coreAssignment)
                && (!objective.criteria?.coreType || room.coreAssignment?.type === objective.criteria.coreType)));
        case "route_power":
            return getMatchingRoomFlow(snapshot, objective, "powerFlow");
        case "establish_comms":
            return getMatchingRoomFlow(snapshot, objective, "commsFlow");
        case "deliver_supply":
            return getMatchingRoomFlow(snapshot, objective, "supplyFlow");
        case "complete_operation":
            if (objective.criteria?.operationId) {
                return snapshot.completedOperations.has(objective.criteria.operationId) ? 1 : 0;
            }
            return snapshot.completedOperations.size;
        case "reach_floor":
            return snapshot.highestFloorOrdinal;
        default:
            return objective.current;
    }
}
function isQuestComplete(quest) {
    return quest.objectives.every((objective) => objective.current >= objective.required);
}
function showQuestCompletionNotification(quest) {
    const rewardParts = [];
    if (quest.rewards.wad)
        rewardParts.push(`${quest.rewards.wad} WAD`);
    if (quest.rewards.xp)
        rewardParts.push(`${quest.rewards.xp} XP`);
    (0, systemPing_1.showSystemPing)({
        title: "QUEST COMPLETE",
        message: quest.title,
        detail: rewardParts.length > 0 ? rewardParts.join(" • ") : undefined,
        type: "success",
        channel: "quest-complete",
    });
}
function syncQuestProgressFromSnapshotState(state, progress = (0, campaign_1.loadCampaignProgress)()) {
    if (!state.quests) {
        return state;
    }
    const snapshot = buildRuntimeSnapshot(state, progress);
    const nextQuestState = cloneQuestState(state.quests);
    let progressChanged = false;
    nextQuestState.activeQuests = nextQuestState.activeQuests.map((quest) => {
        let questChanged = false;
        const nextObjectives = quest.objectives.map((objective) => {
            if (!SNAPSHOT_OBJECTIVE_TYPES.has(objective.type)) {
                return objective;
            }
            const current = Math.min(objective.required, getObjectiveCurrentValue(objective, snapshot));
            if (current === objective.current) {
                return objective;
            }
            questChanged = true;
            progressChanged = true;
            return {
                ...objective,
                current,
            };
        });
        if (!questChanged) {
            return quest;
        }
        console.log("[QUEST] snapshot progress changed", quest.id, nextObjectives.map((objective) => ({
            id: objective.id,
            current: objective.current,
            required: objective.required,
        })));
        return {
            ...quest,
            objectives: nextObjectives,
        };
    });
    const completedNow = nextQuestState.activeQuests.filter((quest) => !nextQuestState.completedQuests.includes(quest.id) && isQuestComplete(quest));
    if (completedNow.length === 0 && !progressChanged) {
        return state;
    }
    let nextState = {
        ...state,
        quests: nextQuestState,
    };
    if (completedNow.length === 0) {
        return nextState;
    }
    const completedIds = new Set(nextQuestState.completedQuests);
    const completedCount = completedNow.filter((quest) => !completedIds.has(quest.id)).length;
    completedNow.forEach((quest) => {
        if (completedIds.has(quest.id)) {
            return;
        }
        console.log(`[QUEST] Completed quest: ${quest.title}`);
        completedIds.add(quest.id);
        nextState = (0, questRewards_1.applyQuestRewardsToState)(nextState, quest);
        showQuestCompletionNotification(quest);
    });
    nextState = {
        ...nextState,
        quests: {
            ...nextState.quests,
            activeQuests: nextState.quests.activeQuests.filter((quest) => !completedIds.has(quest.id)),
            completedQuests: [...completedIds],
            totalQuestsCompleted: (nextState.quests.totalQuestsCompleted ?? 0) + completedCount,
        },
    };
    return nextState;
}

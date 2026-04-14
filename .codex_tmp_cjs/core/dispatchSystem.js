"use strict";
// ============================================================================
// DISPATCH / EXPEDITIONS SYSTEM
// Off-screen missions for reserve units
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitialDispatchState = createInitialDispatchState;
exports.getDispatchState = getDispatchState;
exports.getDispatchMissionBoard = getDispatchMissionBoard;
exports.getBusyDispatchUnitIds = getBusyDispatchUnitIds;
exports.getDispatchEligibleUnits = getDispatchEligibleUnits;
exports.estimateDispatchSuccessChance = estimateDispatchSuccessChance;
exports.launchDispatchExpedition = launchDispatchExpedition;
exports.advanceDispatchTime = advanceDispatchTime;
exports.consumeDispatchIntelForOperation = consumeDispatchIntelForOperation;
exports.clearDispatchIntelBonus = clearDispatchIntelBonus;
exports.claimDispatchReport = claimDispatchReport;
const classes_1 = require("./classes");
const pwr_1 = require("./pwr");
const recruitment_1 = require("./recruitment");
const codexSystem_1 = require("./codexSystem");
const equipment_1 = require("./equipment");
const resources_1 = require("./resources");
const session_1 = require("./session");
const DISPATCH_MISSION_BOARD = [
    {
        id: "scouting_run",
        name: "Scouting Run",
        summary: "Send a fast detachment to chart safe approaches, trace node routes, and return with tactical notes.",
        recommendedPwr: 55,
        durationTicks: 2,
        baseSuccessRate: 58,
        minSuccessRate: 35,
        maxSuccessRate: 92,
        pwrFactor: 0.45,
        favoredAffinities: ["mobility", "survival"],
        favoredClasses: ["ranger", "scout", "trapper", "thief"],
    },
    {
        id: "salvage_expedition",
        name: "Salvage Expedition",
        summary: "Break down abandoned sites for raw stock, recovered chassis, and whatever useful metal survived the rot.",
        recommendedPwr: 75,
        durationTicks: 3,
        baseSuccessRate: 56,
        minSuccessRate: 32,
        maxSuccessRate: 90,
        pwrFactor: 0.35,
        favoredAffinities: ["survival", "mobility"],
        favoredClasses: ["squire", "sentry", "paladin", "ranger"],
    },
    {
        id: "arcane_survey",
        name: "Arcane Survey",
        summary: "Dispatch trained researchers to read corruption signatures, secure shards, and retrieve anomalous data.",
        recommendedPwr: 95,
        durationTicks: 3,
        baseSuccessRate: 52,
        minSuccessRate: 28,
        maxSuccessRate: 88,
        pwrFactor: 0.32,
        favoredAffinities: ["magic", "support"],
        favoredClasses: ["wizard", "chaosmancer", "academic"],
    },
    {
        id: "escort_detail",
        name: "Escort / Protection",
        summary: "Assign a hardened reserve team to guard a convoy, protect civilians, and hold a perimeter under pressure.",
        recommendedPwr: 120,
        durationTicks: 4,
        baseSuccessRate: 50,
        minSuccessRate: 25,
        maxSuccessRate: 86,
        pwrFactor: 0.28,
        favoredAffinities: ["survival", "support"],
        favoredClasses: ["paladin", "sentry", "freelancer"],
    },
];
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function chance(probability) {
    return Math.random() < probability;
}
function normalizeClassToken(value) {
    return (value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}
function resolveUnitClassId(unit, progress) {
    const desired = normalizeClassToken(progress?.currentClass || unit.unitClass || "squire");
    const match = (0, classes_1.getAvailableClasses)().find((classId) => normalizeClassToken(classId) === desired);
    return match || "squire";
}
function createProgressForUnit(unit) {
    const resolvedClassId = resolveUnitClassId(unit);
    const progress = (0, classes_1.createDefaultClassProgress)(unit.id);
    if (!progress.unlockedClasses.includes(resolvedClassId)) {
        progress.unlockedClasses = [...progress.unlockedClasses, resolvedClassId];
    }
    progress.currentClass = resolvedClassId;
    progress.classRanks[resolvedClassId] = progress.classRanks[resolvedClassId] || 1;
    return progress;
}
function pickLockedCodexEntryId(state) {
    const unlocked = new Set(state.unlockedCodexEntries || []);
    const lockedEntries = codexSystem_1.CODEX_DATABASE.filter((entry) => !unlocked.has(entry.id));
    if (lockedEntries.length === 0)
        return undefined;
    return lockedEntries[randomInt(0, lockedEntries.length - 1)].id;
}
function pickSalvageEquipmentId(state) {
    const allEquipment = (0, equipment_1.getAllStarterEquipment)();
    const owned = new Set(state.equipmentPool || []);
    for (const unit of Object.values(state.unitsById)) {
        const loadout = unit.loadout || {};
        Object.values(loadout).forEach((equipmentId) => {
            if (typeof equipmentId === "string" && equipmentId) {
                owned.add(equipmentId);
            }
        });
    }
    const candidates = Object.keys(allEquipment).filter((equipmentId) => !owned.has(equipmentId));
    if (candidates.length === 0)
        return undefined;
    return candidates[randomInt(0, candidates.length - 1)];
}
function generateRecruitLead(state) {
    const rosterSize = Object.values(state.unitsById).filter((unit) => !unit.isEnemy).length;
    const candidates = (0, recruitment_1.generateCandidates)({
        id: "dispatch_escort_lead",
        name: "Dispatch Lead",
        type: "base_camp",
        candidatePoolSize: 1,
    }, rosterSize);
    return candidates[0];
}
function buildRewardBundle(template, success, state) {
    switch (template.id) {
        case "scouting_run": {
            const rewards = {
                wad: success ? randomInt(18, 36) : randomInt(6, 14),
                resources: (0, resources_1.createEmptyResourceWallet)({
                    metalScrap: success ? randomInt(2, 5) : randomInt(0, 2),
                    wood: success ? randomInt(3, 7) : randomInt(1, 3),
                    chaosShards: 0,
                    steamComponents: success ? randomInt(0, 2) : 0,
                }),
                squadXp: success ? 40 : 18,
                classXpPerUnit: success ? 60 : 25,
                intelDossiers: success ? 1 : 0,
            };
            return {
                summary: success
                    ? "Recon packet secured. The team returned with route notes, threat sketches, and a clean extraction window."
                    : "The patrol returned under pressure. Charts are incomplete, but the route still produced minor field experience.",
                rewards,
            };
        }
        case "salvage_expedition": {
            const rewards = {
                wad: success ? randomInt(24, 48) : randomInt(10, 20),
                resources: (0, resources_1.createEmptyResourceWallet)({
                    metalScrap: success ? randomInt(10, 18) : randomInt(4, 8),
                    wood: success ? randomInt(6, 12) : randomInt(2, 5),
                    chaosShards: success ? randomInt(0, 2) : 0,
                    steamComponents: success ? randomInt(3, 6) : randomInt(0, 2),
                }),
                squadXp: success ? 52 : 24,
                classXpPerUnit: success ? 72 : 30,
                intelDossiers: 0,
                gearDropId: success && chance(0.35) ? pickSalvageEquipmentId(state) : undefined,
            };
            return {
                summary: success
                    ? rewards.gearDropId
                        ? "Recovery crews returned with usable chassis stock and one intact piece of field gear."
                        : "Recovery crews returned with heavy material gains and no major losses."
                    : "The salvage team had to pull out early. Some stock was saved, but the best pieces stayed buried.",
                rewards,
            };
        }
        case "arcane_survey": {
            const rewards = {
                wad: success ? randomInt(20, 38) : randomInt(8, 16),
                resources: (0, resources_1.createEmptyResourceWallet)({
                    metalScrap: success ? randomInt(0, 3) : 0,
                    wood: 0,
                    chaosShards: success ? randomInt(10, 18) : randomInt(3, 7),
                    steamComponents: success ? randomInt(2, 5) : randomInt(0, 2),
                }),
                squadXp: success ? 64 : 28,
                classXpPerUnit: success ? 84 : 36,
                intelDossiers: 0,
                codexEntryId: success ? pickLockedCodexEntryId(state) : undefined,
            };
            return {
                summary: success
                    ? rewards.codexEntryId
                        ? "Surveyors brought back stable readings, shard samples, and one decipherable archive fragment."
                        : "Surveyors returned with shard-rich residue and usable anomaly measurements."
                    : "The survey was forced to retreat before the anomaly stabilized, but some partial readings survived.",
                rewards,
            };
        }
        case "escort_detail":
        default: {
            const rewards = {
                wad: success ? randomInt(42, 78) : randomInt(16, 28),
                resources: (0, resources_1.createEmptyResourceWallet)({
                    metalScrap: success ? randomInt(1, 4) : 0,
                    wood: success ? randomInt(1, 3) : 0,
                    chaosShards: 0,
                    steamComponents: success ? randomInt(0, 2) : 0,
                }),
                squadXp: success ? 70 : 30,
                classXpPerUnit: success ? 92 : 42,
                intelDossiers: 0,
                recruitCandidate: success && chance(0.3) ? generateRecruitLead(state) : undefined,
            };
            return {
                summary: success
                    ? rewards.recruitCandidate
                        ? "The escort returned with payment secured and a grateful survivor willing to hear out a contract."
                        : "The escort held the line, delivered the convoy, and collected full payment."
                    : "The detail completed only part of the route. Payment was cut, but the team still returned with hard-earned experience.",
                rewards,
            };
        }
    }
}
function getMissionTemplate(missionId) {
    const template = DISPATCH_MISSION_BOARD.find((entry) => entry.id === missionId);
    if (!template) {
        throw new Error(`Unknown dispatch mission: ${missionId}`);
    }
    return template;
}
function calculateAveragePwr(units) {
    if (units.length === 0)
        return 0;
    const total = units.reduce((sum, unit) => sum + (unit.pwr || 0), 0);
    return Math.round(total / units.length);
}
function calculateAffinityBonus(units, favoredAffinities) {
    if (units.length === 0 || favoredAffinities.length === 0)
        return 0;
    const totalAffinity = units.reduce((sum, unit) => {
        const affinities = unit.affinities || {
            melee: 0,
            ranged: 0,
            magic: 0,
            support: 0,
            mobility: 0,
            survival: 0,
        };
        return sum + favoredAffinities.reduce((affinitySum, affinity) => affinitySum + (affinities[affinity] || 0), 0);
    }, 0);
    const averageAffinity = totalAffinity / (units.length * favoredAffinities.length);
    return Math.round(averageAffinity * 0.18);
}
function calculateClassSynergyBonus(units, favoredClasses) {
    const favored = new Set(favoredClasses.map((value) => normalizeClassToken(value)));
    const matches = units.filter((unit) => favored.has(normalizeClassToken(unit.unitClass))).length;
    return Math.min(18, matches * 6);
}
function createInitialDispatchState() {
    return {
        missionSlots: 2,
        dispatchTick: 0,
        intelDossiers: 0,
        activeIntelBonus: 0,
        squadXpBank: 0,
        activeExpeditions: [],
        completedReports: [],
    };
}
function getDispatchState(state) {
    return {
        ...createInitialDispatchState(),
        ...(state.dispatch || {}),
    };
}
function getDispatchMissionBoard() {
    return DISPATCH_MISSION_BOARD;
}
function getBusyDispatchUnitIds(state) {
    return new Set(getDispatchState(state).activeExpeditions.flatMap((expedition) => expedition.assignedUnitIds));
}
function getDispatchEligibleUnits(state) {
    const busy = getBusyDispatchUnitIds(state);
    const party = new Set(state.partyUnitIds || []);
    return Object.values(state.unitsById).filter((unit) => !unit.isEnemy && !party.has(unit.id) && !busy.has(unit.id));
}
function estimateDispatchSuccessChance(state, missionId, unitIds) {
    const template = getMissionTemplate(missionId);
    const units = unitIds
        .map((unitId) => state.unitsById[unitId])
        .filter((unit) => Boolean(unit) && !unit.isEnemy);
    const averagePwr = calculateAveragePwr(units);
    const pwrBonus = (averagePwr - template.recommendedPwr) * template.pwrFactor;
    const unitCountBonus = Math.min(15, Math.max(0, units.length - 1) * 5);
    const affinityBonus = calculateAffinityBonus(units, template.favoredAffinities);
    const classSynergyBonus = calculateClassSynergyBonus(units, template.favoredClasses);
    return clamp(Math.round(template.baseSuccessRate + pwrBonus + unitCountBonus + affinityBonus + classSynergyBonus), template.minSuccessRate, template.maxSuccessRate);
}
function launchDispatchExpedition(state, missionId, unitIds) {
    const dispatch = getDispatchState(state);
    const template = getMissionTemplate(missionId);
    const busyUnits = getBusyDispatchUnitIds(state);
    const eligibleUnits = getDispatchEligibleUnits(state);
    const eligibleSet = new Set(eligibleUnits.map((unit) => unit.id));
    if (dispatch.activeExpeditions.length >= dispatch.missionSlots) {
        throw new Error("All dispatch slots are currently occupied.");
    }
    if (unitIds.length === 0) {
        throw new Error("Assign at least one reserve unit before launching an expedition.");
    }
    if (unitIds.some((unitId) => busyUnits.has(unitId))) {
        throw new Error("One or more selected units are already on an active dispatch.");
    }
    if (unitIds.some((unitId) => !eligibleSet.has(unitId))) {
        throw new Error("Dispatch can only assign reserve units that are not already deployed.");
    }
    const units = unitIds
        .map((unitId) => state.unitsById[unitId])
        .filter((unit) => Boolean(unit) && !unit.isEnemy);
    const successChance = estimateDispatchSuccessChance(state, missionId, unitIds);
    const averagePwr = calculateAveragePwr(units);
    const success = Math.random() * 100 < successChance;
    const outcome = buildRewardBundle(template, success, state);
    const expedition = {
        id: `dispatch_${missionId}_${Date.now()}`,
        missionId,
        missionName: template.name,
        summary: template.summary,
        assignedUnitIds: unitIds,
        assignedUnitNames: units.map((unit) => unit.name),
        recommendedPwr: template.recommendedPwr,
        durationTicks: template.durationTicks,
        startedTick: dispatch.dispatchTick,
        completesAtTick: dispatch.dispatchTick + template.durationTicks,
        successChance,
        averagePwr,
        favoredAffinities: [...template.favoredAffinities],
        favoredClasses: [...template.favoredClasses],
        outcome: {
            success,
            summary: outcome.summary,
            rewards: outcome.rewards,
        },
    };
    return {
        ...state,
        dispatch: {
            ...dispatch,
            activeExpeditions: [...dispatch.activeExpeditions, expedition],
        },
    };
}
function advanceDispatchTime(state, ticks = 1) {
    if (ticks <= 0)
        return state;
    const dispatch = getDispatchState(state);
    const nextTick = dispatch.dispatchTick + ticks;
    const activeExpeditions = [];
    const completedReports = [...dispatch.completedReports];
    for (const expedition of dispatch.activeExpeditions) {
        if (expedition.completesAtTick <= nextTick) {
            completedReports.unshift({
                id: `${expedition.id}_report`,
                missionId: expedition.missionId,
                missionName: expedition.missionName,
                summary: expedition.summary,
                assignedUnitIds: [...expedition.assignedUnitIds],
                assignedUnitNames: [...expedition.assignedUnitNames],
                completedTick: nextTick,
                successChance: expedition.successChance,
                averagePwr: expedition.averagePwr,
                outcome: expedition.outcome,
            });
            continue;
        }
        activeExpeditions.push(expedition);
    }
    return {
        ...state,
        dispatch: {
            ...dispatch,
            dispatchTick: nextTick,
            activeExpeditions,
            completedReports: completedReports.slice(0, 12),
        },
    };
}
function consumeDispatchIntelForOperation(state) {
    const dispatch = getDispatchState(state);
    if (dispatch.intelDossiers <= 0) {
        return {
            ...state,
            dispatch: {
                ...dispatch,
                activeIntelBonus: 0,
            },
        };
    }
    return {
        ...state,
        dispatch: {
            ...dispatch,
            intelDossiers: dispatch.intelDossiers - 1,
            activeIntelBonus: 1,
        },
    };
}
function clearDispatchIntelBonus(state) {
    const dispatch = getDispatchState(state);
    if (dispatch.activeIntelBonus === 0)
        return state;
    return {
        ...state,
        dispatch: {
            ...dispatch,
            activeIntelBonus: 0,
        },
    };
}
function claimDispatchReport(state, reportId) {
    const dispatch = getDispatchState(state);
    const report = dispatch.completedReports.find((entry) => entry.id === reportId);
    if (!report)
        return state;
    const rewards = report.outcome.rewards;
    const nextCompletedReports = dispatch.completedReports.filter((entry) => entry.id !== reportId);
    const nextRecruitmentCandidates = [...(state.recruitmentCandidates || [])];
    const nextUnlockedCodexEntries = [...(state.unlockedCodexEntries || [])];
    const nextEquipmentPool = [...(state.equipmentPool || [])];
    const rewardResources = (0, resources_1.createEmptyResourceWallet)(rewards.resources);
    const nextUnitClassProgress = { ...(state.unitClassProgress || {}) };
    const nextUnitsById = { ...state.unitsById };
    const equipmentById = state.equipmentById || (0, equipment_1.getAllStarterEquipment)();
    if (rewards.codexEntryId && !nextUnlockedCodexEntries.includes(rewards.codexEntryId)) {
        nextUnlockedCodexEntries.push(rewards.codexEntryId);
    }
    if (rewards.recruitCandidate) {
        nextRecruitmentCandidates.push(rewards.recruitCandidate);
    }
    if (rewards.gearDropId && !nextEquipmentPool.includes(rewards.gearDropId)) {
        nextEquipmentPool.push(rewards.gearDropId);
    }
    else if (rewards.gearDropId && nextEquipmentPool.includes(rewards.gearDropId)) {
        rewardResources.metalScrap += 3;
        rewardResources.steamComponents += 1;
    }
    for (const unitId of report.assignedUnitIds) {
        const unit = nextUnitsById[unitId];
        if (!unit || unit.isEnemy)
            continue;
        const existingProgress = nextUnitClassProgress[unitId] || createProgressForUnit(unit);
        const currentClassId = resolveUnitClassId(unit, existingProgress);
        let updatedProgress = {
            ...existingProgress,
            battlesWon: existingProgress.battlesWon + (report.outcome.success ? 1 : 0),
        };
        updatedProgress = (0, classes_1.addClassXP)(updatedProgress, currentClassId, rewards.classXpPerUnit);
        updatedProgress = (0, classes_1.unlockEligibleClasses)(updatedProgress);
        nextUnitClassProgress[unitId] = updatedProgress;
        nextUnitsById[unitId] = {
            ...unit,
            pwr: (0, pwr_1.calculatePWR)({
                unit,
                unitClassProgress: updatedProgress,
                equipmentById,
            }),
        };
    }
    const rewardedState = (0, session_1.grantSessionResources)(state, {
        wad: rewards.wad,
        resources: rewardResources,
    });
    return {
        ...rewardedState,
        recruitmentCandidates: nextRecruitmentCandidates,
        unlockedCodexEntries: nextUnlockedCodexEntries,
        equipmentPool: nextEquipmentPool,
        unitsById: nextUnitsById,
        unitClassProgress: nextUnitClassProgress,
        dispatch: {
            ...dispatch,
            squadXpBank: dispatch.squadXpBank + rewards.squadXp,
            intelDossiers: dispatch.intelDossiers + rewards.intelDossiers,
            completedReports: nextCompletedReports,
        },
    };
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllChassis = getAllChassis;
exports.getChassisById = getChassisById;
exports.getChassisBySlotType = getChassisBySlotType;
exports.getAllChassisIds = getAllChassisIds;
exports.getAllDoctrines = getAllDoctrines;
exports.getDoctrineById = getDoctrineById;
exports.getAllDoctrineIds = getAllDoctrineIds;
exports.getDoctrinesByIntent = getDoctrinesByIntent;
const technica_1 = require("../content/technica");
const gearChassis_1 = require("../data/gearChassis");
const gearDoctrines_1 = require("../data/gearDoctrines");
const resources_1 = require("./resources");
function normalizeChassis(entry) {
    return {
        ...entry,
        buildCost: (0, resources_1.createEmptyResourceWallet)(entry.buildCost),
        unlockAfterFloor: Number(entry.unlockAfterFloor ?? 0),
        requiredQuestIds: Array.isArray(entry.requiredQuestIds)
            ? Array.from(new Set(entry.requiredQuestIds.map(String).map((value) => value.trim()).filter(Boolean)))
            : []
    };
}
function normalizeDoctrine(entry) {
    return {
        ...entry,
        buildCostModifier: (0, resources_1.createEmptyResourceWallet)(entry.buildCostModifier),
        unlockAfterFloor: Number(entry.unlockAfterFloor ?? 0),
        requiredQuestIds: Array.isArray(entry.requiredQuestIds)
            ? Array.from(new Set(entry.requiredQuestIds.map(String).map((value) => value.trim()).filter(Boolean)))
            : []
    };
}
function getAllChassis() {
    const merged = new Map();
    gearChassis_1.ALL_CHASSIS.forEach((entry) => {
        merged.set(entry.id, normalizeChassis(entry));
    });
    (0, technica_1.getAllImportedChassis)().forEach((entry) => {
        merged.set(entry.id, normalizeChassis(entry));
    });
    return Array.from(merged.values()).filter((entry) => !(0, technica_1.isTechnicaContentDisabled)("chassis", entry.id));
}
function getChassisById(id) {
    return getAllChassis().find((entry) => entry.id === id);
}
function getChassisBySlotType(slotType) {
    return getAllChassis().filter((entry) => entry.slotType === slotType);
}
function getAllChassisIds() {
    return getAllChassis().map((entry) => entry.id);
}
function getAllDoctrines() {
    const merged = new Map();
    gearDoctrines_1.ALL_DOCTRINES.forEach((entry) => {
        merged.set(entry.id, normalizeDoctrine(entry));
    });
    (0, technica_1.getAllImportedDoctrines)().forEach((entry) => {
        merged.set(entry.id, normalizeDoctrine(entry));
    });
    return Array.from(merged.values()).filter((entry) => !(0, technica_1.isTechnicaContentDisabled)("doctrine", entry.id));
}
function getDoctrineById(id) {
    return getAllDoctrines().find((entry) => entry.id === id);
}
function getAllDoctrineIds() {
    return getAllDoctrines().map((entry) => entry.id);
}
function getDoctrinesByIntent(intent) {
    return getAllDoctrines().filter((entry) => entry.intentTags.includes(intent));
}

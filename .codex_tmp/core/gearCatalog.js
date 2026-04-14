import { getAllImportedChassis, getAllImportedDoctrines, isTechnicaContentDisabled, } from "../content/technica";
import { ALL_CHASSIS, } from "../data/gearChassis";
import { ALL_DOCTRINES, } from "../data/gearDoctrines";
import { createEmptyResourceWallet } from "./resources";
function normalizeChassis(entry) {
    return {
        ...entry,
        buildCost: createEmptyResourceWallet(entry.buildCost),
        unlockAfterFloor: Number(entry.unlockAfterFloor ?? 0),
        requiredQuestIds: Array.isArray(entry.requiredQuestIds)
            ? Array.from(new Set(entry.requiredQuestIds.map(String).map((value) => value.trim()).filter(Boolean)))
            : []
    };
}
function normalizeDoctrine(entry) {
    return {
        ...entry,
        buildCostModifier: createEmptyResourceWallet(entry.buildCostModifier),
        unlockAfterFloor: Number(entry.unlockAfterFloor ?? 0),
        requiredQuestIds: Array.isArray(entry.requiredQuestIds)
            ? Array.from(new Set(entry.requiredQuestIds.map(String).map((value) => value.trim()).filter(Boolean)))
            : []
    };
}
export function getAllChassis() {
    const merged = new Map();
    ALL_CHASSIS.forEach((entry) => {
        merged.set(entry.id, normalizeChassis(entry));
    });
    getAllImportedChassis().forEach((entry) => {
        merged.set(entry.id, normalizeChassis(entry));
    });
    return Array.from(merged.values()).filter((entry) => !isTechnicaContentDisabled("chassis", entry.id));
}
export function getChassisById(id) {
    return getAllChassis().find((entry) => entry.id === id);
}
export function getChassisBySlotType(slotType) {
    return getAllChassis().filter((entry) => entry.slotType === slotType);
}
export function getAllChassisIds() {
    return getAllChassis().map((entry) => entry.id);
}
export function getAllDoctrines() {
    const merged = new Map();
    ALL_DOCTRINES.forEach((entry) => {
        merged.set(entry.id, normalizeDoctrine(entry));
    });
    getAllImportedDoctrines().forEach((entry) => {
        merged.set(entry.id, normalizeDoctrine(entry));
    });
    return Array.from(merged.values()).filter((entry) => !isTechnicaContentDisabled("doctrine", entry.id));
}
export function getDoctrineById(id) {
    return getAllDoctrines().find((entry) => entry.id === id);
}
export function getAllDoctrineIds() {
    return getAllDoctrines().map((entry) => entry.id);
}
export function getDoctrinesByIntent(intent) {
    return getAllDoctrines().filter((entry) => entry.intentTags.includes(intent));
}

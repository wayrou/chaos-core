"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHAKEN_RECOVERY_TICKS = exports.SHAKEN_STARTING_STRAIN = exports.SHAKEN_STATUS_TYPE = void 0;
exports.unitHasOperationStatus = unitHasOperationStatus;
exports.getShakenStartingStrain = getShakenStartingStrain;
exports.applyShakenStatusToUnitIds = applyShakenStatusToUnitIds;
exports.clearShakenStatusesFromUnitIds = clearShakenStatusesFromUnitIds;
exports.expireShakenStatusesForTheater = expireShakenStatusesForTheater;
exports.recoverShakenFromTavernMeal = recoverShakenFromTavernMeal;
exports.SHAKEN_STATUS_TYPE = "shaken";
exports.SHAKEN_STARTING_STRAIN = 2;
exports.SHAKEN_RECOVERY_TICKS = 5;
function upsertOperationStatus(statuses, nextStatus) {
    const current = statuses ?? [];
    return [
        ...current.filter((status) => !(status.type === nextStatus.type
            && status.operationId === nextStatus.operationId
            && status.theaterId === nextStatus.theaterId)),
        nextStatus,
    ];
}
function filterOperationStatuses(unit, predicate) {
    const current = unit.operationStatuses ?? [];
    if (current.length <= 0) {
        return { unit, changed: false };
    }
    const nextStatuses = current.filter(predicate);
    if (nextStatuses.length === current.length) {
        return { unit, changed: false };
    }
    return {
        unit: {
            ...unit,
            operationStatuses: nextStatuses.length > 0 ? nextStatuses : undefined,
        },
        changed: true,
    };
}
function isShakenExpired(status, currentTick) {
    if (status.type !== exports.SHAKEN_STATUS_TYPE) {
        return false;
    }
    if (typeof status.expiresAtTick === "number") {
        return currentTick >= status.expiresAtTick;
    }
    if (typeof status.createdAtTick === "number") {
        return currentTick >= status.createdAtTick + exports.SHAKEN_RECOVERY_TICKS;
    }
    return false;
}
function unitHasOperationStatus(unit, type) {
    return Boolean(unit?.operationStatuses?.some((status) => status.type === type));
}
function getShakenStartingStrain(unit) {
    return unitHasOperationStatus(unit, exports.SHAKEN_STATUS_TYPE) ? exports.SHAKEN_STARTING_STRAIN : 0;
}
function applyShakenStatusToUnitIds(state, unitIds, details) {
    const uniqueUnitIds = [...new Set(unitIds)];
    if (uniqueUnitIds.length <= 0) {
        return state;
    }
    const updatedUnits = { ...state.unitsById };
    let changed = false;
    uniqueUnitIds.forEach((unitId) => {
        const unit = updatedUnits[unitId];
        if (!unit) {
            return;
        }
        updatedUnits[unitId] = {
            ...unit,
            operationStatuses: upsertOperationStatus(unit.operationStatuses, {
                id: `${details.operationId}_${details.theaterId}_${exports.SHAKEN_STATUS_TYPE}`,
                type: exports.SHAKEN_STATUS_TYPE,
                label: "Shaken",
                placeholder: false,
                operationId: details.operationId,
                theaterId: details.theaterId,
                sourceRoomId: details.sourceRoomId,
                createdAtTick: details.currentTick,
                expiresAtTick: details.currentTick + exports.SHAKEN_RECOVERY_TICKS,
            }),
        };
        changed = true;
    });
    return changed ? { ...state, unitsById: updatedUnits } : state;
}
function clearShakenStatusesFromUnitIds(state, unitIds) {
    const uniqueUnitIds = [...new Set(unitIds)];
    if (uniqueUnitIds.length <= 0) {
        return { next: state, clearedUnitIds: [] };
    }
    const updatedUnits = { ...state.unitsById };
    const clearedUnitIds = [];
    uniqueUnitIds.forEach((unitId) => {
        const unit = updatedUnits[unitId];
        if (!unit || !unitHasOperationStatus(unit, exports.SHAKEN_STATUS_TYPE)) {
            return;
        }
        const result = filterOperationStatuses(unit, (status) => status.type !== exports.SHAKEN_STATUS_TYPE);
        if (!result.changed) {
            return;
        }
        updatedUnits[unitId] = result.unit;
        clearedUnitIds.push(unitId);
    });
    if (clearedUnitIds.length <= 0) {
        return { next: state, clearedUnitIds };
    }
    return {
        next: {
            ...state,
            unitsById: updatedUnits,
        },
        clearedUnitIds,
    };
}
function expireShakenStatusesForTheater(state, operationId, theaterId, currentTick) {
    const updatedUnits = { ...state.unitsById };
    let changed = false;
    Object.entries(updatedUnits).forEach(([unitId, unit]) => {
        const result = filterOperationStatuses(unit, (status) => !(status.type === exports.SHAKEN_STATUS_TYPE
            && status.operationId === operationId
            && status.theaterId === theaterId
            && isShakenExpired(status, currentTick)));
        if (!result.changed) {
            return;
        }
        updatedUnits[unitId] = result.unit;
        changed = true;
    });
    return changed ? { ...state, unitsById: updatedUnits } : state;
}
function recoverShakenFromTavernMeal(state) {
    const deploymentUnitIds = (state.theaterDeploymentPreset?.squads ?? []).flatMap((squad) => squad.unitIds ?? []);
    return clearShakenStatusesFromUnitIds(state, [
        ...(state.partyUnitIds ?? []),
        ...deploymentUnitIds,
    ]);
}

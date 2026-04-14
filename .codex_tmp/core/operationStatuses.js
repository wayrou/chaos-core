export const SHAKEN_STATUS_TYPE = "shaken";
export const SHAKEN_STARTING_STRAIN = 2;
export const SHAKEN_RECOVERY_TICKS = 5;
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
    if (status.type !== SHAKEN_STATUS_TYPE) {
        return false;
    }
    if (typeof status.expiresAtTick === "number") {
        return currentTick >= status.expiresAtTick;
    }
    if (typeof status.createdAtTick === "number") {
        return currentTick >= status.createdAtTick + SHAKEN_RECOVERY_TICKS;
    }
    return false;
}
export function unitHasOperationStatus(unit, type) {
    return Boolean(unit?.operationStatuses?.some((status) => status.type === type));
}
export function getShakenStartingStrain(unit) {
    return unitHasOperationStatus(unit, SHAKEN_STATUS_TYPE) ? SHAKEN_STARTING_STRAIN : 0;
}
export function applyShakenStatusToUnitIds(state, unitIds, details) {
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
                id: `${details.operationId}_${details.theaterId}_${SHAKEN_STATUS_TYPE}`,
                type: SHAKEN_STATUS_TYPE,
                label: "Shaken",
                placeholder: false,
                operationId: details.operationId,
                theaterId: details.theaterId,
                sourceRoomId: details.sourceRoomId,
                createdAtTick: details.currentTick,
                expiresAtTick: details.currentTick + SHAKEN_RECOVERY_TICKS,
            }),
        };
        changed = true;
    });
    return changed ? { ...state, unitsById: updatedUnits } : state;
}
export function clearShakenStatusesFromUnitIds(state, unitIds) {
    const uniqueUnitIds = [...new Set(unitIds)];
    if (uniqueUnitIds.length <= 0) {
        return { next: state, clearedUnitIds: [] };
    }
    const updatedUnits = { ...state.unitsById };
    const clearedUnitIds = [];
    uniqueUnitIds.forEach((unitId) => {
        const unit = updatedUnits[unitId];
        if (!unit || !unitHasOperationStatus(unit, SHAKEN_STATUS_TYPE)) {
            return;
        }
        const result = filterOperationStatuses(unit, (status) => status.type !== SHAKEN_STATUS_TYPE);
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
export function expireShakenStatusesForTheater(state, operationId, theaterId, currentTick) {
    const updatedUnits = { ...state.unitsById };
    let changed = false;
    Object.entries(updatedUnits).forEach(([unitId, unit]) => {
        const result = filterOperationStatuses(unit, (status) => !(status.type === SHAKEN_STATUS_TYPE
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
export function recoverShakenFromTavernMeal(state) {
    const deploymentUnitIds = (state.theaterDeploymentPreset?.squads ?? []).flatMap((squad) => squad.unitIds ?? []);
    return clearShakenStatusesFromUnitIds(state, [
        ...(state.partyUnitIds ?? []),
        ...deploymentUnitIds,
    ]);
}

import type { GameState, Unit, UnitId } from "./types";

export const SHAKEN_STATUS_TYPE = "shaken";
export const SHAKEN_STARTING_STRAIN = 2;
export const SHAKEN_RECOVERY_TICKS = 5;

type UnitOperationStatus = NonNullable<Unit["operationStatuses"]>[number];

function upsertOperationStatus(
  statuses: UnitOperationStatus[] | undefined,
  nextStatus: UnitOperationStatus,
): UnitOperationStatus[] {
  const current = statuses ?? [];
  return [
    ...current.filter((status) => !(
      status.type === nextStatus.type
      && status.operationId === nextStatus.operationId
      && status.theaterId === nextStatus.theaterId
    )),
    nextStatus,
  ];
}

function filterOperationStatuses(
  unit: Unit,
  predicate: (status: UnitOperationStatus) => boolean,
): { unit: Unit; changed: boolean } {
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

function isShakenExpired(status: UnitOperationStatus, currentTick: number): boolean {
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

export function unitHasOperationStatus(
  unit: Pick<Unit, "operationStatuses"> | null | undefined,
  type: string,
): boolean {
  return Boolean(unit?.operationStatuses?.some((status) => status.type === type));
}

export function getShakenStartingStrain(unit: Pick<Unit, "operationStatuses"> | null | undefined): number {
  return unitHasOperationStatus(unit, SHAKEN_STATUS_TYPE) ? SHAKEN_STARTING_STRAIN : 0;
}

export function applyShakenStatusToUnitIds(
  state: GameState,
  unitIds: Iterable<UnitId>,
  details: {
    operationId: string;
    theaterId: string;
    sourceRoomId?: string;
    currentTick: number;
  },
): GameState {
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

export function clearShakenStatusesFromUnitIds(
  state: GameState,
  unitIds: Iterable<UnitId>,
): { next: GameState; clearedUnitIds: UnitId[] } {
  const uniqueUnitIds = [...new Set(unitIds)];
  if (uniqueUnitIds.length <= 0) {
    return { next: state, clearedUnitIds: [] };
  }

  const updatedUnits = { ...state.unitsById };
  const clearedUnitIds: UnitId[] = [];

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

export function expireShakenStatusesForTheater(
  state: GameState,
  operationId: string,
  theaterId: string,
  currentTick: number,
): GameState {
  const updatedUnits = { ...state.unitsById };
  let changed = false;

  Object.entries(updatedUnits).forEach(([unitId, unit]) => {
    const result = filterOperationStatuses(unit, (status) => !(
      status.type === SHAKEN_STATUS_TYPE
      && status.operationId === operationId
      && status.theaterId === theaterId
      && isShakenExpired(status, currentTick)
    ));

    if (!result.changed) {
      return;
    }

    updatedUnits[unitId] = result.unit;
    changed = true;
  });

  return changed ? { ...state, unitsById: updatedUnits } : state;
}

export function recoverShakenFromTavernMeal(
  state: GameState,
): { next: GameState; clearedUnitIds: UnitId[] } {
  const deploymentUnitIds = (state.theaterDeploymentPreset?.squads ?? []).flatMap((squad) => squad.unitIds ?? []);
  return clearShakenStatusesFromUnitIds(state, [
    ...(state.partyUnitIds ?? []),
    ...deploymentUnitIds,
  ]);
}

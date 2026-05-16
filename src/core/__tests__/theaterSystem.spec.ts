import { describe, expect, it } from "vitest";

import { createNewGameState } from "../initialState";
import { createEmptyTheaterAutomationState } from "../theaterAutomation";
import { TAVERN_MEAL_DEFINITIONS } from "../tavernMeals";
import {
  createTheaterBattleState,
  getTheaterPowerOpeningVolley,
  getPreparedTheaterOperation,
  moveToTheaterRoom,
} from "../theaterSystem";

function createStateWithPassedWattageGate() {
  const baseState = createNewGameState();
  const preparedOperation = getPreparedTheaterOperation(baseState);
  if (!preparedOperation?.theater) {
    throw new Error("Expected a prepared theater operation.");
  }

  const theater = preparedOperation.theater;
  const originRoom = theater.rooms[theater.currentRoomId];
  if (!originRoom) {
    throw new Error("Expected the current theater room to exist.");
  }

  const destinationRoom = originRoom.adjacency
    .map((roomId) => theater.rooms[roomId])
    .find((candidate) => candidate && candidate.requiredKeyType === null);
  if (!destinationRoom) {
    throw new Error("Expected an adjacent theater room for traversal.");
  }

  const nextTheater = {
    ...theater,
    currentRoomId: originRoom.id,
    selectedRoomId: originRoom.id,
    currentNodeId: originRoom.id,
    selectedNodeId: originRoom.id,
    rooms: {
      ...theater.rooms,
      [originRoom.id]: {
        ...originRoom,
        powerFlow: Math.max(originRoom.powerFlow ?? 0, 100),
        powerGateWatts: {
          ...(originRoom.powerGateWatts ?? {}),
          [destinationRoom.id]: 100,
        },
      },
      [destinationRoom.id]: {
        ...destinationRoom,
        commsVisible: true,
        powerFlow: Math.max(destinationRoom.powerFlow ?? 0, 100),
        powerGateWatts: {
          ...(destinationRoom.powerGateWatts ?? {}),
          [originRoom.id]: 100,
        },
      },
    },
  };

  return {
    originRoomId: originRoom.id,
    destinationRoomId: destinationRoom.id,
    state: {
      ...baseState,
      operation: {
        ...preparedOperation,
        currentRoomId: originRoom.id,
        theater: nextTheater,
        theaterFloors: {
          ...(preparedOperation.theaterFloors ?? {}),
          [preparedOperation.currentFloorIndex]: nextTheater,
        },
      },
    },
  };
}

function createBattleReadyTheaterState(options?: {
  roomPowerFlow?: number;
  activeMealId?: string;
  supplyOnline?: boolean;
  commsOnline?: boolean;
}) {
  const baseState = createNewGameState();
  const preparedOperation = getPreparedTheaterOperation(baseState);
  if (!preparedOperation?.theater) {
    throw new Error("Expected a prepared theater operation.");
  }

  const theater = preparedOperation.theater;
  const roomId = theater.currentRoomId;
  const room = theater.rooms[roomId];
  if (!room) {
    throw new Error("Expected the current theater room to exist.");
  }

  const selectedSquadId = theater.selectedSquadId ?? theater.squads[0]?.squadId ?? null;
  if (!selectedSquadId) {
    throw new Error("Expected a selected squad for theater battle tests.");
  }

  const supplyOnline = options?.supplyOnline ?? true;
  const commsOnline = options?.commsOnline ?? true;
  const activeMeal = options?.activeMealId
    ? TAVERN_MEAL_DEFINITIONS.find((meal) => meal.id === options.activeMealId) ?? null
    : null;

  const nextRoom = {
    ...room,
    supplied: supplyOnline,
    supplyFlow: supplyOnline ? Math.max(room.supplyFlow ?? 0, 100) : 0,
    powered: true,
    powerFlow: options?.roomPowerFlow ?? Math.max(room.powerFlow ?? 0, 100),
    commsVisible: true,
    commsLinked: commsOnline,
    commsFlow: commsOnline ? Math.max(room.commsFlow ?? 0, 100) : 0,
  };

  const nextTheater = {
    ...theater,
    selectedSquadId,
    automation: createEmptyTheaterAutomationState(),
    rooms: {
      ...theater.rooms,
      [roomId]: nextRoom,
    },
  };

  return {
    roomId,
    squadId: selectedSquadId,
    state: {
      ...baseState,
      tavern: activeMeal
        ? {
            ...(baseState.tavern ?? {}),
            activeRunMealBuff: activeMeal,
            queuedMealBuff: null,
          }
        : baseState.tavern,
      operation: {
        ...preparedOperation,
        currentRoomId: roomId,
        theater: nextTheater,
        theaterFloors: {
          ...(preparedOperation.theaterFloors ?? {}),
          [preparedOperation.currentFloorIndex]: nextTheater,
        },
      },
    },
  };
}

describe("theaterSystem", () => {
  it("removes wattage gates after the squad crosses them", () => {
    const { state, originRoomId, destinationRoomId } = createStateWithPassedWattageGate();

    const moveResult = moveToTheaterRoom(state, destinationRoomId);
    expect(moveResult.error).toBeUndefined();

    const movedOperation = getPreparedTheaterOperation(moveResult.state);
    const movedTheater = movedOperation?.theater;
    expect(movedTheater).not.toBeNull();
    expect(movedTheater?.rooms[originRoomId]?.powerGateWatts?.[destinationRoomId]).toBeUndefined();
    expect(movedTheater?.rooms[destinationRoomId]?.powerGateWatts?.[originRoomId]).toBeUndefined();

    const returnResult = moveToTheaterRoom(moveResult.state, originRoomId);
    expect(returnResult.error).toBeUndefined();
    expect(returnResult.roomId).toBe(originRoomId);
  });

  it("applies active tavern meal buffs to theater tactical battles", () => {
    const baseline = createBattleReadyTheaterState();
    const buffed = createBattleReadyTheaterState({ activeMealId: "meal_charred_skewers" });

    const baselineBattle = createTheaterBattleState(baseline.state, baseline.roomId, baseline.squadId);
    const buffedBattle = createTheaterBattleState(buffed.state, buffed.roomId, buffed.squadId);

    expect(baselineBattle).not.toBeNull();
    expect(buffedBattle).not.toBeNull();

    const baselineUnit = Object.values(baselineBattle!.units).find((unit) => !unit.isEnemy);
    const buffedUnit = Object.values(buffedBattle!.units).find((unit) => !unit.isEnemy);

    expect(baselineUnit).toBeDefined();
    expect(buffedUnit).toBeDefined();
    expect(buffedUnit!.atk).toBe(baselineUnit!.atk + 1);
    expect(buffedBattle!.theaterBonuses?.activeMealName).toBe("Charred Skewers");
    expect(buffedBattle!.theaterBonuses?.squadModifierSummary).toContain("Mess Hall: Charred Skewers (+1 ATK)");
  });

  it("keeps power relay support to a modest opening volley", () => {
    expect(getTheaterPowerOpeningVolley(100, 0)).toEqual({
      powerRelayVolleyCount: 0,
      powerTurretCount: 0,
      openingVolleyDamage: 0,
    });
    expect(getTheaterPowerOpeningVolley(250, 0)).toEqual({
      powerRelayVolleyCount: 1,
      powerTurretCount: 1,
      openingVolleyDamage: 1,
    });
    expect(getTheaterPowerOpeningVolley(450, 0)).toEqual({
      powerRelayVolleyCount: 2,
      powerTurretCount: 2,
      openingVolleyDamage: 2,
    });
    expect(getTheaterPowerOpeningVolley(450, 1)).toEqual({
      powerRelayVolleyCount: 2,
      powerTurretCount: 3,
      openingVolleyDamage: 4,
    });
  });
});

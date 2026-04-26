import { describe, expect, it } from "vitest";

import { createNewGameState } from "../initialState";
import { getPreparedTheaterOperation, moveToTheaterRoom } from "../theaterSystem";

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
});

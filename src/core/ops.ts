// src/core/ops.ts
import { GameState, Floor, OperationRun, RoomNode } from "./types";
import { getSettings } from "./settings";

export function getCurrentOperation(state: GameState): OperationRun | null {
  return state.operation;
}

export function getCurrentFloor(
  operation: OperationRun | null
): Floor | null {
  if (!operation) return null;
  return operation.floors[operation.currentFloorIndex] ?? null;
}

export function getCurrentRoom(
  operation: OperationRun | null
): RoomNode | null {
  if (!operation) return null;
  const floor = getCurrentFloor(operation);
  if (!floor || !operation.currentRoomId) return null;
  const floorNodes = floor.nodes ?? floor.rooms ?? [];
  return floorNodes.find((n) => n.id === operation.currentRoomId) ?? null;
}

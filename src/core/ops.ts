// src/core/ops.ts
import { GameState, Floor, OperationRun, RoomNode } from "./types";

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
  return floor.nodes.find((n) => n.id === operation.currentRoomId) ?? null;
}

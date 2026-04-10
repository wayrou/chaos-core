import { activeRunToOperationRun, clearNode, getActiveRun } from "../../core/campaignManager";
import { syncCampaignToGameState } from "../../core/campaignSync";
import type { GameState, OperationRun } from "../../core/types";
import {
  ensureOperationHasTheater,
  hasTheaterOperation,
  secureTheaterRoomInState,
} from "../../core/theaterSystem";
import { getGameState, updateGameState } from "../../state/gameStore";
import type { BaseCampReturnTo } from "./baseCampReturn";

export type ActiveOperationSurfaceTarget =
  | {
      kind: "theater";
      operation: OperationRun;
    }
  | {
      kind: "operation-select";
      returnTo: BaseCampReturnTo;
    };

export function resolveActiveOperationSurfaceTarget(
  state: GameState,
  fallbackReturnTo: BaseCampReturnTo = "basecamp",
): ActiveOperationSurfaceTarget {
  const activeRun = getActiveRun();
  if (activeRun) {
    const campaignOperation = ensureOperationHasTheater(activeRunToOperationRun(activeRun));
    if (campaignOperation?.theater) {
      return {
        kind: "theater",
        operation: campaignOperation,
      };
    }
  }

  const operation = ensureOperationHasTheater(state.operation);
  if (operation?.theater) {
    return {
      kind: "theater",
      operation,
    };
  }

  return {
    kind: "operation-select",
    returnTo: fallbackReturnTo,
  };
}

export function renderActiveOperationSurface(
  fallbackReturnTo: BaseCampReturnTo = "basecamp",
): void {
  const target = resolveActiveOperationSurfaceTarget(getGameState(), fallbackReturnTo);
  if (target.kind === "theater") {
    updateGameState((prev) => ({
      ...prev,
      operation: target.operation,
      phase: "operation",
    }));
    import("./TheaterCommandScreen").then(({ renderTheaterCommandScreen }) => {
      renderTheaterCommandScreen();
    });
    return;
  }

  import("./OperationSelectScreen").then(({ renderOperationSelectScreen }) => {
    renderOperationSelectScreen(target.returnTo);
  });
}

export function applyVisitedFlagToOperation(state: GameState, roomId: string): GameState {
  if (!state.operation) {
    return state;
  }

  if (hasTheaterOperation(state.operation)) {
    return secureTheaterRoomInState(state, roomId);
  }

  const operation = state.operation;
  const floor = operation.floors[operation.currentFloorIndex];
  if (!floor) {
    return state;
  }

  const currentNodes = floor.nodes || floor.rooms || [];
  const nextNodes = currentNodes.map((node) => (
    node.id === roomId
      ? { ...node, visited: true }
      : node
  ));
  const nextFloor = Array.isArray(floor.nodes)
    ? { ...floor, nodes: nextNodes }
    : { ...floor, rooms: nextNodes };

  return {
    ...state,
    operation: {
      ...operation,
      floors: operation.floors.map((candidate, index) => (
        index === operation.currentFloorIndex ? nextFloor : candidate
      )),
    } as GameState["operation"],
  };
}

export function markOperationRoomVisited(roomId: string): void {
  const currentState = getGameState();
  const theaterOperationActive = hasTheaterOperation(currentState.operation);
  updateGameState((prev) => applyVisitedFlagToOperation(prev, roomId));

  if (theaterOperationActive) {
    return;
  }

  try {
    clearNode(roomId);
    syncCampaignToGameState();

    import("../../core/keyRoomSystem").then(({ generateKeyRoomResources, applyKeyRoomPassiveEffects, rollKeyRoomAttack }) => {
      generateKeyRoomResources();
      applyKeyRoomPassiveEffects();

      const attackResult = rollKeyRoomAttack();
      if (!attackResult) {
        return;
      }

      import("./DefenseDecisionScreen").then((module) => {
        const activeRun = getActiveRun();
        if (activeRun?.pendingDefenseDecision) {
          module.renderDefenseDecisionScreen(
            activeRun.pendingDefenseDecision.keyRoomId,
            activeRun.pendingDefenseDecision.nodeId,
          );
        }
      });
    });
  } catch (error) {
    console.warn("[OP FLOW] Failed to persist cleared room:", error);
  }
}

export function markCurrentOperationRoomVisited(): void {
  const state = getGameState();
  if (state.operation?.currentRoomId) {
    markOperationRoomVisited(state.operation.currentRoomId);
  }
}

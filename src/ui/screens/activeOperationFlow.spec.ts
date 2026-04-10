import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState, OperationRun } from "../../core/types";
import { applyVisitedFlagToOperation, resolveActiveOperationSurfaceTarget } from "./activeOperationFlow";
import * as campaignManager from "../../core/campaignManager";
import * as theaterSystem from "../../core/theaterSystem";

vi.mock("../../core/campaignManager", () => ({
  activeRunToOperationRun: vi.fn(),
  clearNode: vi.fn(),
  getActiveRun: vi.fn(),
}));

vi.mock("../../core/campaignSync", () => ({
  syncCampaignToGameState: vi.fn(),
}));

vi.mock("../../core/theaterSystem", () => ({
  ensureOperationHasTheater: vi.fn((operation: OperationRun | null | undefined) => operation),
  hasTheaterOperation: vi.fn((operation: OperationRun | null | undefined) => Boolean(operation?.theater)),
  secureTheaterRoomInState: vi.fn((state: GameState) => state),
}));

vi.mock("../../state/gameStore", () => ({
  getGameState: vi.fn(),
  updateGameState: vi.fn(),
}));

const mockedGetActiveRun = vi.mocked(campaignManager.getActiveRun);
const mockedActiveRunToOperationRun = vi.mocked(campaignManager.activeRunToOperationRun);
const mockedEnsureOperationHasTheater = vi.mocked(theaterSystem.ensureOperationHasTheater);
const mockedHasTheaterOperation = vi.mocked(theaterSystem.hasTheaterOperation);
const mockedSecureTheaterRoomInState = vi.mocked(theaterSystem.secureTheaterRoomInState);

function makeState(operation: OperationRun | null = null): GameState {
  return { operation } as GameState;
}

describe("resolveActiveOperationSurfaceTarget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEnsureOperationHasTheater.mockImplementation((operation) => operation);
    mockedHasTheaterOperation.mockImplementation((operation) => Boolean(operation?.theater));
    mockedSecureTheaterRoomInState.mockImplementation((state) => state);
  });

  it("routes an active theater-backed operation to theater", () => {
    const theaterOperation = {
      codename: "THEATER",
      description: "active theater op",
      floors: [],
      currentFloorIndex: 0,
      currentRoomId: null,
      theater: { definition: { name: "T1" } },
    } as unknown as OperationRun;

    mockedGetActiveRun.mockReturnValue(null);

    expect(resolveActiveOperationSurfaceTarget(makeState(theaterOperation))).toEqual({
      kind: "theater",
      operation: theaterOperation,
    });
  });

  it("normalizes an active campaign run into a theater operation", () => {
    const activeRun = { id: "run_1" };
    const legacyOperation = {
      codename: "LEGACY",
      description: "legacy op",
      floors: [],
      currentFloorIndex: 0,
      currentRoomId: null,
    } as unknown as OperationRun;
    const normalizedOperation = {
      ...legacyOperation,
      theater: { definition: { name: "Normalized Theater" } },
    } as unknown as OperationRun;

    mockedGetActiveRun.mockReturnValue(activeRun as never);
    mockedActiveRunToOperationRun.mockReturnValue(legacyOperation);
    mockedEnsureOperationHasTheater.mockImplementation((operation) => (
      operation === legacyOperation ? normalizedOperation : operation
    ));

    expect(resolveActiveOperationSurfaceTarget(makeState(legacyOperation))).toEqual({
      kind: "theater",
      operation: normalizedOperation,
    });
    expect(mockedActiveRunToOperationRun).toHaveBeenCalledWith(activeRun);
  });

  it("falls back to the operation select screen when nothing is active", () => {
    mockedGetActiveRun.mockReturnValue(null);

    expect(resolveActiveOperationSurfaceTarget(makeState(null))).toEqual({
      kind: "operation-select",
      returnTo: "basecamp",
    });
  });
});

describe("applyVisitedFlagToOperation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedHasTheaterOperation.mockReturnValue(false);
  });

  it("marks a legacy room as visited without importing OperationMapScreen", () => {
    const state = makeState({
      codename: "LEGACY",
      description: "legacy op",
      currentFloorIndex: 0,
      currentRoomId: "room_1",
      floors: [{
        name: "Floor 1",
        nodes: [
          { id: "room_1", label: "Room 1", visited: false },
          { id: "room_2", label: "Room 2", visited: false },
        ],
      }],
    } as unknown as OperationRun);

    const nextState = applyVisitedFlagToOperation(state, "room_1");
    const nextNodes = nextState.operation?.floors[0]?.nodes ?? [];
    const previousNodes = state.operation?.floors[0]?.nodes ?? [];

    expect(nextNodes[0]?.visited).toBe(true);
    expect(nextNodes[1]?.visited).toBe(false);
    expect(previousNodes[0]?.visited).toBe(false);
    expect(mockedSecureTheaterRoomInState).not.toHaveBeenCalled();
  });
});

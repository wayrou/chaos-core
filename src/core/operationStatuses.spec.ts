import { describe, expect, it } from "vitest";
import {
  applyShakenStatusToUnitIds,
  expireShakenStatusesForTheater,
  getShakenStartingStrain,
  recoverShakenFromTavernMeal,
  SHAKEN_RECOVERY_TICKS,
} from "./operationStatuses";
import type { GameState, Unit } from "./types";

function makeUnit(id: string, name = id): Unit {
  return {
    id,
    name,
    isEnemy: false,
    hp: 10,
    maxHp: 10,
    agi: 3,
    pos: null,
    hand: [],
    drawPile: [],
    discardPile: [],
    strain: 0,
  };
}

function makeState(): GameState {
  return {
    partyUnitIds: ["u_party"],
    theaterDeploymentPreset: {
      squads: [
        {
          squadId: "sq_1",
          displayName: "Squad 1",
          icon: "◉",
          colorKey: "amber",
          unitIds: ["u_deploy"],
        },
      ],
    },
    unitsById: {
      u_party: makeUnit("u_party", "Party"),
      u_deploy: makeUnit("u_deploy", "Deploy"),
      u_reserve: makeUnit("u_reserve", "Reserve"),
    },
  } as GameState;
}

describe("operationStatuses", () => {
  it("applies shaken as +2 starting strain and stamps expiry", () => {
    const nextState = applyShakenStatusToUnitIds(makeState(), ["u_party"], {
      operationId: "op_1",
      theaterId: "theater_1",
      currentTick: 3,
    });

    const unit = nextState.unitsById.u_party;
    expect(getShakenStartingStrain(unit)).toBe(2);
    expect(unit.operationStatuses?.[0]).toMatchObject({
      type: "shaken",
      createdAtTick: 3,
      expiresAtTick: 3 + SHAKEN_RECOVERY_TICKS,
      placeholder: false,
    });
  });

  it("expires shaken after 5 theater ticks for the matching operation only", () => {
    const state = makeState();
    state.unitsById.u_party.operationStatuses = [
      {
        id: "expired",
        type: "shaken",
        operationId: "op_1",
        theaterId: "theater_1",
        createdAtTick: 2,
        expiresAtTick: 7,
      },
      {
        id: "other_op",
        type: "shaken",
        operationId: "op_2",
        theaterId: "theater_2",
        createdAtTick: 2,
        expiresAtTick: 7,
      },
    ];

    const nextState = expireShakenStatusesForTheater(state, "op_1", "theater_1", 7);
    const remainingStatuses = nextState.unitsById.u_party.operationStatuses ?? [];

    expect(remainingStatuses).toHaveLength(1);
    expect(remainingStatuses[0]?.id).toBe("other_op");
  });

  it("clears shaken from the party and deployment squads when a tavern meal is ordered", () => {
    const shakenState = applyShakenStatusToUnitIds(makeState(), ["u_party", "u_deploy", "u_reserve"], {
      operationId: "op_1",
      theaterId: "theater_1",
      currentTick: 0,
    });

    const recovered = recoverShakenFromTavernMeal(shakenState);

    expect(recovered.clearedUnitIds.sort()).toEqual(["u_deploy", "u_party"]);
    expect(recovered.next.unitsById.u_party.operationStatuses).toBeUndefined();
    expect(recovered.next.unitsById.u_deploy.operationStatuses).toBeUndefined();
    expect(recovered.next.unitsById.u_reserve.operationStatuses?.[0]?.type).toBe("shaken");
  });
});

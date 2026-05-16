import { describe, expect, it } from "vitest";
import type { BattleState, BattleUnitState } from "../battle";
import { deriveBattleFeedback } from "../feedback";

function makeUnit(overrides: Partial<BattleUnitState>): BattleUnitState {
  return {
    id: "unit",
    baseUnitId: "unit",
    name: "Unit",
    classId: "squire",
    isEnemy: false,
    pos: { x: 0, y: 0 },
    facing: "east",
    hp: 10,
    maxHp: 10,
    atk: 4,
    def: 1,
    agi: 1,
    acc: 100,
    strain: 0,
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustedPile: [],
    buffs: [],
    equippedWeaponId: null,
    weaponState: null,
    autoBattleMode: "manual",
    turnCardsPlayed: 0,
    ...overrides,
  };
}

function makeBattle(): BattleState {
  const attacker = makeUnit({ id: "attacker", name: "Attacker", pos: { x: 0, y: 0 } });
  const target = makeUnit({ id: "target", name: "Target", isEnemy: true, pos: { x: 1, y: 0 } });
  return {
    id: "feedback_miss_test",
    floorId: "test_floor",
    roomId: "test_room",
    gridWidth: 2,
    gridHeight: 1,
    tiles: [
      { pos: { x: 0, y: 0 }, terrain: "floor" },
      { pos: { x: 1, y: 0 }, terrain: "floor" },
    ],
    units: { attacker, target },
    turnOrder: ["attacker", "target"],
    activeUnitId: "attacker",
    phase: "player_turn",
    turnCount: 1,
    log: [],
  };
}

describe("battle miss feedback", () => {
  it("emits a missed toast for attack miss log entries", () => {
    const battle = makeBattle();
    const requests = deriveBattleFeedback(
      battle,
      battle,
      ["SLK//MISS  :: Attacker swings at Target but the strike goes wide."],
    );

    expect(requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "miss",
          text: "MISSED",
        }),
      ]),
    );
  });
});

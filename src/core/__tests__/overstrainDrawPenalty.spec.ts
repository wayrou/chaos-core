import { describe, expect, it } from "vitest";
import {
  advanceTurn,
  getStrainThreshold,
  OVERSTRAIN_NEXT_TURN_DRAW_PENALTY,
  type BattleState,
  type BattleUnitState,
} from "../battle";

function makeUnit(overrides: Partial<BattleUnitState>): BattleUnitState {
  return {
    id: "unit",
    baseUnitId: "unit",
    name: "Unit",
    classId: "squire",
    isEnemy: false,
    pos: { x: 0, y: 0 },
    facing: "east",
    hp: 12,
    maxHp: 12,
    atk: 4,
    def: 0,
    agi: 1,
    acc: 90,
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
  const alpha = makeUnit({
    id: "alpha",
    baseUnitId: "alpha",
    name: "Alpha",
    agi: 3,
    strain: getStrainThreshold() + 1,
    drawPile: ["a", "b", "c", "d", "e", "f"],
  });
  const bravo = makeUnit({
    id: "bravo",
    baseUnitId: "bravo",
    name: "Bravo",
    agi: 2,
    pos: { x: 1, y: 0 },
    drawPile: ["g", "h", "i", "j", "k"],
  });
  const enemy = makeUnit({
    id: "enemy",
    baseUnitId: "enemy",
    name: "Enemy",
    isEnemy: true,
    agi: 1,
    pos: { x: 2, y: 0 },
    drawPile: ["enemy_attack"],
  });

  return {
    id: "overstrain_draw_test",
    floorId: "test_floor",
    roomId: "test_room",
    gridWidth: 3,
    gridHeight: 1,
    tiles: [
      { pos: { x: 0, y: 0 }, terrain: "floor" },
      { pos: { x: 1, y: 0 }, terrain: "floor" },
      { pos: { x: 2, y: 0 }, terrain: "floor" },
    ],
    units: { alpha, bravo, enemy },
    turnOrder: ["alpha", "bravo", "enemy"],
    activeUnitId: "alpha",
    phase: "player_turn",
    turnCount: 1,
    log: [],
  };
}

describe("overstrain draw penalty", () => {
  it("makes a player unit draw two fewer cards on their next turn after ending overstrained", () => {
    let battle = makeBattle();

    battle = advanceTurn(battle, { endedUnitPlayedCard: true, endedUnitMoved: true });
    expect(battle.activeUnitId).toBe("bravo");
    expect(battle.units.alpha.nextTurnDrawPenalty).toBe(OVERSTRAIN_NEXT_TURN_DRAW_PENALTY);

    battle = advanceTurn(battle, { endedUnitPlayedCard: false, endedUnitMoved: false });
    expect(battle.activeUnitId).toBe("enemy");

    battle = advanceTurn(battle, { endedUnitPlayedCard: false, endedUnitMoved: false });
    expect(battle.activeUnitId).toBe("alpha");
    expect(battle.units.alpha.hand).toEqual(["a", "b", "c"]);
    expect(battle.units.alpha.drawPile).toEqual(["d", "e", "f"]);
    expect(battle.units.alpha.nextTurnDrawPenalty).toBeUndefined();
    expect(battle.log).toContain("SLK//STRAIN :: Alpha's overstrain cuts this draw by 2.");
  });
});

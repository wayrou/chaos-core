import { describe, expect, it, vi } from "vitest";
import { attackUnit, type BattleState, type BattleUnitState } from "../battle";

function makeUnit(overrides: Partial<BattleUnitState>): BattleUnitState {
  return {
    id: "unit",
    baseUnitId: "unit",
    name: "Unit",
    classId: "squire",
    isEnemy: false,
    pos: { x: 0, y: 0 },
    facing: "east",
    hp: 20,
    maxHp: 20,
    atk: 6,
    def: 0,
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

function makeBattle(attacker: BattleUnitState, defender: BattleUnitState): BattleState {
  return {
    id: "damage_balance_test",
    floorId: "test_floor",
    roomId: "test_room",
    gridWidth: 2,
    gridHeight: 1,
    tiles: [
      { pos: { x: 0, y: 0 }, terrain: "floor" },
      { pos: { x: 1, y: 0 }, terrain: "floor" },
    ],
    units: {
      [attacker.id]: attacker,
      [defender.id]: defender,
    },
    turnOrder: [attacker.id, defender.id],
    activeUnitId: attacker.id,
    phase: attacker.isEnemy ? "enemy_turn" : "player_turn",
    turnCount: 1,
    log: [],
  };
}

describe("battle damage side pressure", () => {
  it("reduces friendly burst damage on basic attacks", () => {
    const hitRoll = vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = makeUnit({ id: "hero", name: "Hero", atk: 10, pos: { x: 0, y: 0 } });
    const defender = makeUnit({ id: "enemy", name: "Enemy", isEnemy: true, pos: { x: 1, y: 0 } });

    try {
      const result = attackUnit(makeBattle(attacker, defender), attacker.id, defender.id);

      expect(result.units.enemy?.hp).toBe(11);
    } finally {
      hitRoll.mockRestore();
    }
  });

  it("keeps enemy hits threatening after defense", () => {
    const hitRoll = vi.spyOn(Math, "random").mockReturnValue(0);
    const attacker = makeUnit({ id: "enemy", name: "Enemy", isEnemy: true, atk: 4, pos: { x: 1, y: 0 } });
    const defender = makeUnit({ id: "hero", name: "Hero", def: 3, pos: { x: 0, y: 0 } });

    try {
      const result = attackUnit(makeBattle(attacker, defender), attacker.id, defender.id);

      expect(result.units.hero?.hp).toBe(18);
    } finally {
      hitRoll.mockRestore();
    }
  });
});

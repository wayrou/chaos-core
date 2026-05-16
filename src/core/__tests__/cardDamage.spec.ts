import { describe, expect, it, vi } from "vitest";
import type { BattleState, BattleUnitState } from "../battle";
import { toCoreCard } from "../cardCatalog";
import { handleCardPlay } from "../cardHandler";
import type { Card } from "../types";

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

function makeBattle(cardId: string): BattleState {
  const attacker = makeUnit({
    id: "attacker",
    baseUnitId: "attacker",
    name: "Attacker",
    hand: [cardId],
  });
  const target = makeUnit({
    id: "target",
    baseUnitId: "target",
    name: "Target",
    isEnemy: true,
    pos: { x: 1, y: 0 },
    hp: 12,
    maxHp: 12,
  });

  return {
    id: "test_battle",
    floorId: "test_floor",
    roomId: "test_room",
    gridWidth: 2,
    gridHeight: 1,
    tiles: [
      { pos: { x: 0, y: 0 }, terrain: "floor" },
      { pos: { x: 1, y: 0 }, terrain: "floor" },
    ],
    units: {
      attacker,
      target,
    },
    turnOrder: ["attacker", "target"],
    activeUnitId: "attacker",
    phase: "player_turn",
    turnCount: 1,
    log: [],
  };
}

describe("card damage resolution", () => {
  it("preserves numeric card damage when converting resolved cards to runtime cards", () => {
    const card = toCoreCard({
      id: "test_warning_shot",
      name: "Warning Shot",
      type: "equipment",
      target: "enemy",
      strainCost: 1,
      range: 4,
      description: "Target suffers -2 ACC for 1 turn.",
      damage: 4,
      effects: [],
    });

    expect(card.damage).toBe(4);
  });

  it("uses normal attack damage for enemy damage cards even when an empty effect flow exists", () => {
    const hitRoll = vi.spyOn(Math, "random").mockReturnValue(0);
    const card: Card = {
      id: "test_warning_shot",
      name: "Warning Shot",
      description: "Target suffers -2 ACC for 1 turn.",
      strainCost: 1,
      targetType: "enemy",
      range: 4,
      damage: 4,
      effects: [],
      effectFlow: {
        version: 1,
        entryNodeId: null,
        nodes: [],
        edges: [],
      },
    };
    const battle = makeBattle(card.id);

    try {
      const result = handleCardPlay(battle, card, battle.units.attacker, { x: 1, y: 0 }, battle.units.target);

      expect(result?.units.target?.hp).toBeLessThan(battle.units.target.hp);
      expect(result?.units.attacker?.discardPile).toContain(card.id);
    } finally {
      hitRoll.mockRestore();
    }
  });
});

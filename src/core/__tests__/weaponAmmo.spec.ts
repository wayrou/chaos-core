import { describe, expect, it, vi } from "vitest";
import type { BattleState, BattleUnitState } from "../battle";
import { createWeaponRuntimeState } from "../weaponSystem";
import { getAllStarterEquipment, type WeaponEquipment } from "../equipment";
import { handleCardPlay } from "../cardHandler";
import type { Card } from "../types";

function getIronwhisperCrossbow(): WeaponEquipment {
  const weapon = getAllStarterEquipment().weapon_ironwhisper_crossbow as WeaponEquipment | undefined;
  if (!weapon) {
    throw new Error("Ironwhisper Crossbow fixture missing");
  }
  return weapon;
}

function getElmRecurveBow(): WeaponEquipment {
  const weapon = getAllStarterEquipment().weapon_elm_recurve_bow as WeaponEquipment | undefined;
  if (!weapon) {
    throw new Error("Elm Recurve Bow fixture missing");
  }
  return weapon;
}

function makeUnit(overrides: Partial<BattleUnitState>): BattleUnitState {
  return {
    id: "unit",
    baseUnitId: "unit",
    name: "Unit",
    classId: "ranger",
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

function makeBattle(cardId: string, ammo = 1, weapon: WeaponEquipment = getIronwhisperCrossbow()): BattleState {
  const weaponState = {
    ...createWeaponRuntimeState(weapon),
    currentAmmo: ammo,
  };
  const attacker = makeUnit({
    id: "attacker",
    baseUnitId: "attacker",
    name: "Attacker",
    hand: [cardId],
    equippedWeaponId: weapon.id,
    weaponState,
    loadout: {
      primaryWeapon: weapon.id,
      secondaryWeapon: null,
      helmet: null,
      chestpiece: null,
      accessory1: null,
      accessory2: null,
    },
  });
  const target = makeUnit({
    id: "target",
    baseUnitId: "target",
    name: "Target",
    isEnemy: true,
    pos: { x: 4, y: 0 },
    hp: 12,
    maxHp: 12,
  });

  return {
    id: "weapon_ammo_test",
    floorId: "test_floor",
    roomId: "test_room",
    gridWidth: 5,
    gridHeight: 1,
    tiles: Array.from({ length: 5 }, (_, x) => ({ pos: { x, y: 0 }, terrain: "floor" as const })),
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

const rangedAttackCard: Card = {
  id: "class_pinning_shot",
  name: "Pinning Shot",
  description: "Immobilize enemy for 1 turn.",
  strainCost: 2,
  targetType: "enemy",
  range: 6,
  damage: 2,
  effects: [],
};

describe("weapon ammo on attack cards", () => {
  it("spends ammo from the equipped ammo weapon when any ranged attack card is played", () => {
    const hitRoll = vi.spyOn(Math, "random").mockReturnValue(0);
    const battle = makeBattle(rangedAttackCard.id, 1);

    try {
      const result = handleCardPlay(
        battle,
        rangedAttackCard,
        battle.units.attacker,
        { x: 4, y: 0 },
        battle.units.target,
      );

      expect(result?.units.attacker?.weaponState?.currentAmmo).toBe(0);
      expect(result?.units.attacker?.weaponState?.currentHeat).toBe(1);
      expect(result?.units.attacker?.discardPile).toContain(rangedAttackCard.id);
      expect(result?.units.target?.hp).toBeLessThan(battle.units.target.hp);
    } finally {
      hitRoll.mockRestore();
    }
  });

  it("blocks ranged attack cards when the equipped ammo weapon is empty", () => {
    const battle = makeBattle(rangedAttackCard.id, 0);

    const result = handleCardPlay(
      battle,
      rangedAttackCard,
      battle.units.attacker,
      { x: 4, y: 0 },
      battle.units.target,
    );

    expect(result?.units.attacker?.weaponState?.currentAmmo).toBe(0);
    expect(result?.units.attacker?.hand).toContain(rangedAttackCard.id);
    expect(result?.units.target?.hp).toBe(battle.units.target.hp);
    expect(result?.log.at(-1)).toContain("Ammo 0/1");
  });

  it("does not apply heat from generic attack rules when the equipped weapon has no heat track", () => {
    const hitRoll = vi.spyOn(Math, "random").mockReturnValue(0);
    const bow = getElmRecurveBow();
    const genericAttackCard: Card = {
      ...rangedAttackCard,
      id: "core_basic_attack",
      name: "Basic Attack",
      weaponRules: {
        sourceWeaponId: "__equipped_weapon__",
        heatDelta: 1,
        ammoCost: 1,
        tags: ["weapon_card", "attack", "direct"],
        clutchCompatible: true,
      },
    };
    const battle = makeBattle(genericAttackCard.id, 6, bow);

    try {
      const result = handleCardPlay(
        battle,
        genericAttackCard,
        battle.units.attacker,
        { x: 4, y: 0 },
        battle.units.target,
      );

      expect(result?.units.attacker?.weaponState?.currentAmmo).toBe(5);
      expect(result?.units.attacker?.weaponState?.currentHeat).toBe(0);
      expect(result?.units.target?.hp).toBeLessThan(battle.units.target.hp);
    } finally {
      hitRoll.mockRestore();
    }
  });
});

// ============================================================================
// BATTLE CARD HANDLER - Processes card plays in the BattleScreen
// This file contains the handleCardPlay function to replace the hardcoded
// card handling in handleTileClick
// ============================================================================

import {
  BattleState,
  BattleUnitState,
  Tile,
  addStatus,
  appendBattleLog,
  applyStrain,
  applyTheaterCombatInstability,
  applyWeaponHitToUnit,
  applyWeaponOverheatEffects,
  advanceTurn,
  computeHitChance,
  evaluateBattleOutcome,
  Vec2,
  getEquippedWeapon,
  getTileAt,
  updateUnitWeaponState,
} from "./battle";
import { Card, EchoFieldPlacement } from "./types";
import { getCoverDamageReduction, damageCover } from "./coverGenerator";
import {
  getEchoAttackBonus,
  getEchoDefenseBonus,
  incrementEchoFieldTriggerCount,
} from "./echoFieldEffects";

import { getAllStarterEquipment } from "./equipment";
import { getResolvedBattleCard, isChaosBattleCardId } from "./cardCatalog";
import { applyEffectFlowToBattle } from "./effectFlow";
import {
  addHeat,
  checkWeaponJam,
  consumeQueuedModifier,
  getEffectiveMaxHeat,
  getExtraStrainCost,
  getWeaponCardAmmoCost,
  getWeaponCardBlockReason,
  getWeaponCardHeatDelta,
  getWeaponCardModifierSnapshot,
  markWeaponCardPlayed,
  removeHeat,
  repairNode,
  triggerWeaponOverheat,
  useAmmo,
} from "./weaponSystem";

function isHostileTarget(user: BattleUnitState, targetUnit: BattleUnitState | null | undefined): boolean {
  return Boolean(targetUnit && targetUnit.isEnemy !== user.isEnemy);
}

function isAlliedTarget(user: BattleUnitState, targetUnit: BattleUnitState | null | undefined): boolean {
  return Boolean(targetUnit && targetUnit.isEnemy === user.isEnemy);
}

function normalizeCardToken(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cardMatches(card: Card, ids: string[], names: string[] = []): boolean {
  const normalizedId = normalizeCardToken(card.id);
  const normalizedName = normalizeCardToken(card.name);
  return ids.some((value) => normalizeCardToken(value) === normalizedId)
    || names.some((value) => normalizeCardToken(value) === normalizedName);
}

function getCardDamageAmount(card: Card): number {
  const explicitDamage = Number((card as any).damage ?? 0);
  if (explicitDamage > 0) {
    return explicitDamage;
  }

  const damageEffect = (card.effects || []).find((effect: any) => effect.type === "damage") as any;
  if (typeof damageEffect?.amount === "number" && damageEffect.amount > 0) {
    return damageEffect.amount;
  }

  const descriptionMatch = card.description.match(/deal\s+(\d+)\s+damage/i);
  return descriptionMatch ? parseInt(descriptionMatch[1], 10) : 0;
}

function addTimedBuff(
  battle: BattleState,
  unitId: string,
  type: string,
  amount: number,
  duration: number
): BattleState {
  const unit = battle.units[unitId];
  if (!unit) return battle;

  return {
    ...battle,
    units: {
      ...battle.units,
      [unitId]: {
        ...unit,
        buffs: [
          ...(unit.buffs || []),
          { id: `${type}_${Date.now()}`, type, amount, duration } as any,
        ],
      },
    },
  };
}

function discardCardFromHand(battle: BattleState, unitId: string, cardOrId: string | Card): BattleState {
  const unit = battle.units[unitId];
  if (!unit) return battle;

  const targetId = typeof cardOrId === "string" ? cardOrId : cardOrId.id;
  const targetName = typeof cardOrId === "string" ? null : normalizeCardToken(cardOrId.name);
  const normalizedTargetId = normalizeCardToken(targetId);
  let cardIndex = unit.hand.indexOf(targetId);
  if (cardIndex < 0) {
    cardIndex = unit.hand.findIndex((handCardId) => normalizeCardToken(handCardId) === normalizedTargetId);
  }
  if (cardIndex < 0 && targetName) {
    cardIndex = unit.hand.findIndex((handCardId) => {
      const resolvedHandCard = getResolvedBattleCard(handCardId);
      if (!resolvedHandCard) {
        return false;
      }
      return normalizeCardToken(resolvedHandCard.name) === targetName;
    });
  }

  const discardedCardId = cardIndex < 0 ? targetId : unit.hand[cardIndex];
  const nextHand =
    cardIndex < 0
      ? unit.hand
      : [...unit.hand.slice(0, cardIndex), ...unit.hand.slice(cardIndex + 1)];

  return {
    ...battle,
    units: {
      ...battle.units,
      [unitId]: {
        ...unit,
        hand: nextHand,
        discardPile: isChaosBattleCardId(discardedCardId) ? unit.discardPile : [...unit.discardPile, discardedCardId],
      },
    },
  };
}

function addCardsToHand(battle: BattleState, unitId: string, cardIds: string[]): BattleState {
  if (cardIds.length === 0) {
    return battle;
  }

  const unit = battle.units[unitId];
  if (!unit) {
    return battle;
  }

  return {
    ...battle,
    units: {
      ...battle.units,
      [unitId]: {
        ...unit,
        hand: [...unit.hand, ...cardIds],
      },
    },
  };
}

const EQUIPPED_WEAPON_SOURCE_ID = "__equipped_weapon__";

type WeaponPlayContext = {
  weapon: NonNullable<ReturnType<typeof getEquippedWeapon>>;
  cardRules: NonNullable<Card["weaponRules"]>;
  modifiers: ReturnType<typeof getWeaponCardModifierSnapshot>;
  ammoCost: number;
  heatDelta: number;
  extraStrain: number;
};

function getWeaponPlayContext(
  user: BattleUnitState,
  card: Card,
): WeaponPlayContext | null {
  if (!card.weaponRules || !user.weaponState) {
    return null;
  }

  const weapon = getEquippedWeapon(user, getAllStarterEquipment());
  if (!weapon) {
    return null;
  }

  if (
    card.weaponRules.sourceWeaponId !== EQUIPPED_WEAPON_SOURCE_ID &&
    card.weaponRules.sourceWeaponId !== weapon.id
  ) {
    return null;
  }

  const modifiers = getWeaponCardModifierSnapshot(user.weaponState, weapon, card.weaponRules);
  const heatlessPowerCouplingStrain =
    !weapon.isMechanical &&
    card.weaponRules.tags.includes("attack") &&
    user.weaponState.nodes[4] === "broken"
      ? 1
      : 0;
  return {
    weapon,
    cardRules: card.weaponRules,
    modifiers,
    ammoCost: getWeaponCardAmmoCost(user.weaponState, weapon, card.weaponRules),
    heatDelta: getWeaponCardHeatDelta(user.weaponState, weapon, card.weaponRules),
    extraStrain:
      getExtraStrainCost(user.weaponState, !user.weaponState.firstWeaponCardPlayedThisTurn) +
      modifiers.strainDelta +
      heatlessPowerCouplingStrain,
  };
}

function getWeaponBlockReasonForCard(user: BattleUnitState, card: Card): string | null {
  const weapon = getEquippedWeapon(user, getAllStarterEquipment());
  if (!user.weaponState || !weapon || !card.weaponRules) {
    return null;
  }
  if (
    card.weaponRules.sourceWeaponId !== EQUIPPED_WEAPON_SOURCE_ID &&
    card.weaponRules.sourceWeaponId !== weapon.id
  ) {
    return null;
  }
  return getWeaponCardBlockReason(user.weaponState, weapon, card.weaponRules);
}

function addStatModifierBuff(
  battle: BattleState,
  unitId: string,
  stat: "atk" | "def" | "agi" | "acc",
  amount: number,
  duration: number,
): BattleState {
  const buffType = `${stat}_${amount >= 0 ? "up" : "down"}`;
  return addTimedBuff(battle, unitId, buffType, amount, duration);
}

function applyWeaponSelfModifiers(
  battle: BattleState,
  userId: string,
  modifiers: ReturnType<typeof getWeaponCardModifierSnapshot>,
): BattleState {
  let next = battle;
  modifiers.selfBuffs.forEach((buff) => {
    next = addStatModifierBuff(next, userId, buff.stat, buff.amount, buff.duration);
  });
  modifiers.selfDebuffs.forEach((buff) => {
    next = addStatModifierBuff(next, userId, buff.stat, -Math.abs(buff.amount), buff.duration);
  });
  return next;
}

function repairGuardNodes(weaponState: BattleUnitState["weaponState"]) {
  if (!weaponState) {
    return weaponState;
  }
  if (weaponState.nodes[1] === "damaged" || weaponState.nodes[1] === "broken") {
    return repairNode(weaponState, 1);
  }
  if (weaponState.nodes[3] === "damaged" || weaponState.nodes[3] === "broken") {
    return repairNode(weaponState, 3);
  }
  return weaponState;
}

function finalizeWeaponCardRuntime(
  battle: BattleState,
  userId: string,
  context: WeaponPlayContext | null,
): BattleState {
  if (!context) {
    return battle;
  }

  const user = battle.units[userId];
  if (!user?.weaponState) {
    return battle;
  }

  let weaponState = user.weaponState;

  if (context.cardRules.tags.includes("attack") && context.ammoCost > 0) {
    weaponState = useAmmo(weaponState, context.weapon, context.ammoCost);
  }

  if (context.heatDelta > 0) {
    weaponState = addHeat(weaponState, context.weapon, context.heatDelta);
  } else if (context.heatDelta < 0) {
    weaponState = removeHeat(weaponState, Math.abs(context.heatDelta), { repairHeatSink: true });
  }

  if (context.cardRules.tags.includes("guard_brace")) {
    weaponState = repairGuardNodes(weaponState) ?? weaponState;
  }

  weaponState = markWeaponCardPlayed(weaponState, context.weapon, context.cardRules);
  weaponState.allowMoveAfterAttack = context.modifiers.freeAttackMove;
  weaponState = consumeQueuedModifier(weaponState);

  let next = updateUnitWeaponState(battle, userId, weaponState);
  next = applyWeaponSelfModifiers(next, userId, context.modifiers);

  const latestUser = next.units[userId];
  if (!latestUser?.weaponState) {
    return next;
  }

  if (
    latestUser.weaponState.currentHeat >= getEffectiveMaxHeat(latestUser.weaponState, context.weapon) ||
    (context.modifiers.forceOverheat && context.heatDelta > 0)
  ) {
    const overheatOutcome = triggerWeaponOverheat(latestUser.weaponState, context.weapon);
    next = updateUnitWeaponState(next, userId, overheatOutcome.state);
    next = appendBattleLog(next, `SLK//HEAT  :: ${latestUser.name}'s ${context.weapon.name} overheats. ${overheatOutcome.summary}`);
    next = applyWeaponOverheatEffects(next, userId, overheatOutcome.effects, context.weapon.name);
  }

  return next;
}

function finalizeCardUsage(
  battle: BattleState,
  userId: string,
  card: Card,
  context: WeaponPlayContext | null,
): BattleState {
  let next = battle;
  const currentUser = next.units[userId];
  if (!currentUser) {
    return next;
  }

  next = applyStrain(next, currentUser, Math.max(0, card.strainCost + (context?.extraStrain ?? 0)));
  next = finalizeWeaponCardRuntime(next, userId, context);
  next = applyTheaterCombatInstability(next, userId);
  if (next.units[userId]) {
    next = discardCardFromHand(next, userId, card);
  }
  if (next.units[userId] && card.chaosCardsToCreate?.length) {
    next = addCardsToHand(next, userId, card.chaosCardsToCreate);
  }
  return next;
}

function tryMoveUnitToward(
  battle: BattleState,
  unitId: string,
  targetId: string,
  tiles: number,
): BattleState {
  if (tiles <= 0) {
    return battle;
  }

  const unit = battle.units[unitId];
  const target = battle.units[targetId];
  if (!unit?.pos || !target?.pos) {
    return battle;
  }

  let next = battle;
  let currentPos = unit.pos;
  for (let step = 0; step < tiles; step += 1) {
    const dx = Math.sign(target.pos.x - currentPos.x);
    const dy = Math.sign(target.pos.y - currentPos.y);
    const candidate =
      Math.abs(target.pos.x - currentPos.x) >= Math.abs(target.pos.y - currentPos.y)
        ? { x: currentPos.x + dx, y: currentPos.y }
        : { x: currentPos.x, y: currentPos.y + dy };

    if (
      candidate.x < 0 ||
      candidate.y < 0 ||
      candidate.x >= battle.gridWidth ||
      candidate.y >= battle.gridHeight
    ) {
      break;
    }
    const tile = getTileAt(next, candidate.x, candidate.y);
    const occupied = Object.values(next.units).some(
      (other) => other.id !== unitId && other.pos?.x === candidate.x && other.pos?.y === candidate.y,
    );
    if (!tile || tile.terrain === "wall" || occupied) {
      break;
    }

    next = {
      ...next,
      units: {
        ...next.units,
        [unitId]: {
          ...next.units[unitId],
          pos: candidate,
        },
      },
    };
    currentPos = candidate;
  }

  return next;
}

function tryMoveUnitAway(
  battle: BattleState,
  unitId: string,
  sourceId: string,
  tiles: number,
): BattleState {
  if (tiles <= 0) {
    return battle;
  }

  const unit = battle.units[unitId];
  const source = battle.units[sourceId];
  if (!unit?.pos || !source?.pos) {
    return battle;
  }

  let next = battle;
  let currentPos = unit.pos;
  for (let step = 0; step < tiles; step += 1) {
    const dx = Math.sign(currentPos.x - source.pos.x);
    const dy = Math.sign(currentPos.y - source.pos.y);
    const candidate =
      Math.abs(currentPos.x - source.pos.x) >= Math.abs(currentPos.y - source.pos.y)
        ? { x: currentPos.x + dx, y: currentPos.y }
        : { x: currentPos.x, y: currentPos.y + dy };

    if (
      candidate.x < 0 ||
      candidate.y < 0 ||
      candidate.x >= battle.gridWidth ||
      candidate.y >= battle.gridHeight
    ) {
      break;
    }
    const tile = getTileAt(next, candidate.x, candidate.y);
    const occupied = Object.values(next.units).some(
      (other) => other.id !== unitId && other.pos?.x === candidate.x && other.pos?.y === candidate.y,
    );
    if (!tile || tile.terrain === "wall" || occupied) {
      break;
    }

    next = {
      ...next,
      units: {
        ...next.units,
        [unitId]: {
          ...next.units[unitId],
          pos: candidate,
        },
      },
    };
    currentPos = candidate;
  }

  return next;
}

function applySplashDamageInRange(
  battle: BattleState,
  userId: string,
  range: number,
  amount: number,
): BattleState {
  if (amount <= 0) {
    return battle;
  }

  const user = battle.units[userId];
  if (!user?.pos) {
    return battle;
  }

  let next = battle;
  Object.values(next.units)
    .filter((unit) => unit.id !== userId && unit.isEnemy !== user.isEnemy && unit.pos)
    .forEach((unit) => {
      const distance = Math.abs(user.pos!.x - unit.pos!.x) + Math.abs(user.pos!.y - unit.pos!.y);
      if (distance > range) {
        return;
      }
      const updated = next.units[unit.id];
      if (!updated) {
        return;
      }
      if (updated.hp - amount <= 0) {
        const nextUnits = { ...next.units };
        delete nextUnits[unit.id];
        next = {
          ...next,
          units: nextUnits,
          turnOrder: next.turnOrder.filter((id) => id !== unit.id),
        };
        return;
      }
      next = {
        ...next,
        units: {
          ...next.units,
          [unit.id]: {
            ...updated,
            hp: updated.hp - amount,
          },
        },
      };
    });

  return next;
}

/**
 * Process playing a card on a target
 * Returns the updated battle state, or null if the play was invalid
 */
export function handleCardPlay(
  battle: BattleState,
  card: Card,
  user: BattleUnitState,
  targetPos: { x: number; y: number },
  targetUnit: BattleUnitState | null
): BattleState | null {

  if (!user.pos) return null;

  const weaponBlockReason = getWeaponBlockReasonForCard(user, card);
  if (weaponBlockReason) {
    return appendBattleLog(battle, `SLK//LOCK  :: ${user.name} cannot use ${card.name}. ${weaponBlockReason}.`);
  }

  const weaponContext = getWeaponPlayContext(user, card);

  // Calculate distance to target
  const distance = Math.abs(user.pos.x - targetPos.x) + Math.abs(user.pos.y - targetPos.y);
  let cardRange = card.range ?? 1;

  // Apply Far Shot ability: Rangers get +1 range on bow attack cards
  // Check both targetType (from core Card type) and target (from BattleScreen Card type) for compatibility
  // Also check card name/ID to catch basic attack and other attack cards
  const isAttackCard =
    card.targetType === "enemy" ||
    (card as any).target === "enemy" ||
    card.id === "core_basic_attack" ||
    card.name.toLowerCase().includes("attack") ||
    card.name.toLowerCase().includes("shot") ||
    card.name.toLowerCase().includes("strike");

  if (user.classId === "ranger" && isAttackCard) {
    const equipmentById = getAllStarterEquipment();
    const weapon = getEquippedWeapon(user, equipmentById);
    if (weapon && weapon.weaponType === "bow") {
      cardRange += 1;
    }
  }

  if (weaponContext) {
    if (weaponContext.modifiers.rangeOverride !== null) {
      cardRange = weaponContext.modifiers.rangeOverride;
    } else {
      cardRange += weaponContext.modifiers.rangeDelta;
    }
    cardRange += weaponContext.modifiers.moveBeforeAttackTiles;
  }

  // Check range
  if (distance > cardRange) return null;

  // ========================================
  // WAIT / END TURN CARDS
  // ========================================
  if (cardMatches(card, ["core_wait"], ["wait"])) {
    let b: BattleState = discardCardFromHand(battle, user.id, card);
    const currentUser = b.units[user.id];
    if (currentUser) {
      b = {
        ...b,
        units: {
          ...b.units,
          [user.id]: {
            ...currentUser,
            strain: Math.max(0, currentUser.strain - 2),
          },
        },
      };
    }

    b = appendBattleLog(b, `SLK//UNIT   :: ${user.name} waits, ending their turn and reducing strain by 2.`);
    b = advanceTurn(b);

    return b;
  }

  if (cardMatches(card, ["core_move_plus"], ["move"])) {
    if (targetPos.x !== user.pos.x || targetPos.y !== user.pos.y) {
      return null;
    }

    let b = addTimedBuff(battle, user.id, "move_up", 2, 1);
    b = finalizeCardUsage(b, user.id, card, weaponContext);
    b = appendBattleLog(b, `SLK//UNIT   :: ${user.name} gains +2 MOV this turn // STRAIN +${card.strainCost}.`);
    return b;
  }

  if (cardMatches(card, ["squire_shield_wall", "class_shield_wall"], ["shield_wall"])) {
    if (targetPos.x !== user.pos.x || targetPos.y !== user.pos.y) {
      return null;
    }

    const alliedUnitIds = Object.values(battle.units)
      .filter((unit) => unit.isEnemy === user.isEnemy)
      .map((unit) => unit.id);

    let b = battle;
    alliedUnitIds.forEach((unitId) => {
      b = addTimedBuff(b, unitId, "def_up", 2, 1);
    });

    b = finalizeCardUsage(b, user.id, card, weaponContext);
    b = appendBattleLog(
      b,
      `SLK//UNIT   :: ${user.name} raises Shield Wall, granting +2 DEF to ${alliedUnitIds.length} allied unit${alliedUnitIds.length === 1 ? "" : "s"} // STRAIN +${card.strainCost}.`,
    );
    return b;
  }

  if (cardMatches(card, ["ranger_volley", "class_volley"], ["volley"])) {
    if (!isHostileTarget(user, targetUnit) || !targetUnit?.pos) {
      return null;
    }

    const userPos = user.pos;
    const targetsInRange = Object.values(battle.units).filter((candidate) => (
      isHostileTarget(user, candidate)
      && candidate.pos
      && getTileAt(battle, candidate.pos.x, candidate.pos.y)
      && Math.abs(userPos.x - candidate.pos.x) + Math.abs(userPos.y - candidate.pos.y) <= cardRange
    ));
    if (targetsInRange.length === 0) {
      return null;
    }

    let b = battle;
    const actingUser = b.units[user.id];
    if (!actingUser?.pos) {
      return null;
    }

    if (weaponContext?.cardRules.tags.includes("attack") && actingUser.weaponState && checkWeaponJam(actingUser.weaponState)) {
      const jammedState = {
        ...actingUser.weaponState,
        isJammed: true,
        jammedTurnsRemaining: 1,
      };
      b = updateUnitWeaponState(b, actingUser.id, jammedState);
      const jammedUser = b.units[actingUser.id];
      if (jammedUser) {
        b = applyStrain(b, jammedUser, card.strainCost + 1);
        b = discardCardFromHand(b, actingUser.id, card);
      }
      b = appendBattleLog(b, `SLK//JAM   :: ${actingUser.name}'s ${weaponContext.weapon.name} jams while using ${card.name}.`);
      return b;
    }

    const logMessages: string[] = [];
    const triggeredPlacements: EchoFieldPlacement[] = [];
    const equippedWeapon = getEquippedWeapon(actingUser);
    const isRangedAttack = Boolean(equippedWeapon && ["gun", "bow", "greatbow", "staff"].includes(equippedWeapon.weaponType));
    const baseDamage = getCardDamageAmount(card);
    const atkBuffs = (actingUser.buffs || [])
      .filter((buff) => buff.type === "atk_up" || buff.type === "atk_down")
      .reduce((sum, buff) => sum + buff.amount, 0);
    const clutchDamageDelta = weaponContext?.modifiers.damageDelta ?? 0;
    const damageMultiplier = weaponContext?.modifiers.damageMultiplier ?? 1;
    const ignoreDef = weaponContext?.modifiers.ignoreDef ?? 0;
    const accuracyDelta = weaponContext?.modifiers.accuracyDelta ?? 0;

    targetsInRange.forEach((listedTarget) => {
      const currentUser = b.units[user.id];
      const currentTarget = b.units[listedTarget.id];
      if (!currentUser?.pos || !currentTarget?.pos) {
        return;
      }

      const echoAttackBonus = getEchoAttackBonus(b, currentUser);
      const echoDefenseBonus = getEchoDefenseBonus(b, currentTarget);
      let totalDamage = Math.max(0, Math.round((baseDamage + atkBuffs + echoAttackBonus.amount + clutchDamageDelta) * damageMultiplier));
      const defBuffs = (currentTarget.buffs || [])
        .filter((buff) => buff.type === "def_up" || buff.type === "def_down")
        .reduce((sum, buff) => sum + buff.amount, 0);
      const totalDef = Math.max(0, currentTarget.def + defBuffs + echoDefenseBonus.amount - ignoreDef);

      let hitChance = computeHitChance(currentUser, currentTarget, isRangedAttack, b) + accuracyDelta;
      hitChance = Math.max(10, Math.min(100, hitChance));

      const didHit = (Math.random() * 100) <= hitChance;
      if (didHit) {
        let finalDamage = Math.max(1, totalDamage - totalDef);
        const targetTile = getTileAt(b, currentTarget.pos.x, currentTarget.pos.y);
        if (targetTile) {
          let coverReduction = getCoverDamageReduction(targetTile);
          const attackerTile = getTileAt(b, currentUser.pos.x, currentUser.pos.y);
          const attackerElevation = attackerTile?.elevation ?? 0;
          const defenderElevation = targetTile.elevation ?? 0;
          if (
            (weaponContext?.modifiers.ignoreCover ?? false)
            || (isRangedAttack && attackerElevation >= defenderElevation + 1 && targetTile.terrain === "light_cover")
          ) {
            coverReduction = 0;
          }
          finalDamage = Math.max(1, finalDamage - coverReduction);
        }

        const newHp = currentTarget.hp - finalDamage;
        if (newHp <= 0) {
          const newUnits = { ...b.units };
          delete newUnits[currentTarget.id];
          b = {
            ...b,
            units: newUnits,
            turnOrder: b.turnOrder.filter((id) => id !== currentTarget.id),
          };
          logMessages.push(`hits ${currentTarget.name} for ${finalDamage} - TARGET OFFLINE`);
        } else {
          b = {
            ...b,
            units: {
              ...b.units,
              [currentTarget.id]: { ...currentTarget, hp: newHp },
            },
          };
          logMessages.push(`hits ${currentTarget.name} for ${finalDamage} (HP ${newHp}/${currentTarget.maxHp})`);
        }
      } else {
        logMessages.push(`misses ${currentTarget.name}`);
      }

      triggeredPlacements.push(...echoAttackBonus.triggeredPlacements, ...echoDefenseBonus.triggeredPlacements);
    });

    b = finalizeCardUsage(b, user.id, card, weaponContext);
    b = appendBattleLog(
      b,
      `SLK//HIT    :: ${actingUser.name} ${logMessages.length > 0 ? logMessages.join("; ") : `fires ${card.name} with no valid targets`}.`,
    );

    if (triggeredPlacements.length > 0) {
      b = incrementEchoFieldTriggerCount(b, triggeredPlacements);
    }

    b = evaluateBattleOutcome(b);
    return b;
  }

  if ((card as any).effectFlow) {
    if (card.targetType === "enemy" && (!isHostileTarget(user, targetUnit) || !targetUnit?.pos)) {
      return null;
    }

    if (card.targetType === "ally" && (!isAlliedTarget(user, targetUnit) || !targetUnit?.pos)) {
      return null;
    }

    if (card.targetType === "self" && (targetPos.x !== user.pos.x || targetPos.y !== user.pos.y)) {
      return null;
    }

    let b = appendBattleLog(battle, `SLK//CARD  :: ${user.name} plays ${card.name}.`);
    b = applyEffectFlowToBattle(b, (card as any).effectFlow, {
      sourceUnitId: user.id,
      selectedTargetUnitId: targetUnit?.id ?? (card.targetType === "self" ? user.id : null),
      selectedTilePos: targetPos,
      hitTargetUnitId: targetUnit?.id ?? null,
      sourceLabel: `${user.name}'s ${card.name}`,
    });

    const currentUser = b.units[user.id];
    if (!currentUser) {
      return b;
    }

    b = finalizeCardUsage(b, user.id, card, weaponContext);

    return b;
  }

  // ========================================
  // ALLY-TARGET CARDS (heals, buffs)
  // ========================================
  if (card.targetType === "ally") {
    if (!isAlliedTarget(user, targetUnit) || !targetUnit?.pos) {
      return null;
    }

    let b = battle;
    const logMessages: string[] = [];

    for (const effect of (card.effects || [])) {
      const eff = effect as any;

      if (eff.type === "heal") {
        const amount = eff.amount ?? 3;
        const currentTarget = b.units[targetUnit.id];
        const newHp = Math.min(currentTarget.maxHp, currentTarget.hp + amount);
        b = {
          ...b,
          units: {
            ...b.units,
            [targetUnit.id]: { ...currentTarget, hp: newHp },
          },
        };
        logMessages.push(`restores ${amount} HP to ${targetUnit.name}`);
      }

      if (eff.type === "def_up") {
        b = addTimedBuff(b, targetUnit.id, "def_up", eff.amount ?? 2, eff.duration ?? 1);
        logMessages.push(`grants ${targetUnit.name} +${eff.amount ?? 2} DEF`);
      }

      if (eff.type === "atk_up") {
        b = addTimedBuff(b, targetUnit.id, "atk_up", eff.amount ?? 2, eff.duration ?? 1);
        logMessages.push(`grants ${targetUnit.name} +${eff.amount ?? 2} ATK`);
      }

      if (eff.type === "agi_up") {
        b = addTimedBuff(b, targetUnit.id, "agi_up", eff.amount ?? 2, eff.duration ?? 1);
        logMessages.push(`grants ${targetUnit.name} +${eff.amount ?? 2} AGI`);
      }

      if (eff.type === "acc_up") {
        b = addTimedBuff(b, targetUnit.id, "acc_up", eff.amount ?? 2, eff.duration ?? 1);
        logMessages.push(`grants ${targetUnit.name} +${eff.amount ?? 2} ACC`);
      }
    }

    if (logMessages.length === 0) {
      const healMatch = card.description.match(/(?:restore|heal|recover)\s*(\d+)\s*hp/i);
      if (healMatch) {
        const amount = parseInt(healMatch[1], 10);
        const currentTarget = b.units[targetUnit.id];
        const newHp = Math.min(currentTarget.maxHp, currentTarget.hp + amount);
        b = {
          ...b,
          units: {
            ...b.units,
            [targetUnit.id]: { ...currentTarget, hp: newHp },
          },
        };
        logMessages.push(`restores ${amount} HP to ${targetUnit.name}`);
      }
    }

    if (logMessages.length === 0) {
      b = addTimedBuff(b, targetUnit.id, "def_up", 2, 1);
      logMessages.push(`grants ${targetUnit.name} +2 DEF`);
    }

    b = finalizeCardUsage(b, user.id, card, weaponContext);
    b = appendBattleLog(b, `SLK//UNIT   :: ${user.name} ${logMessages.join(", ")} • STRAIN +${card.strainCost}.`);

    return b;
  }

  // ========================================
  // SELF-TARGET CARDS (buffs, heals, etc.)
  // ========================================
  if (card.targetType === "self") {
    // Must click on self
    if (targetPos.x !== user.pos.x || targetPos.y !== user.pos.y) {
      return null;
    }

    let b = battle;
    let logMessages: string[] = [];

    // Process effects
    for (const effect of (card.effects || [])) {
      const eff = effect as any;

      // DEF buff
      if (eff.type === "def_up" || (eff.type === "buff" && eff.stat === "def")) {
        const amount = eff.amount ?? 3;
        const duration = eff.duration ?? 1;
        const newBuff = {
          id: `def_up_${Date.now()}`,
          type: "def_up" as const,
          amount,
          duration,
        };

        const currentUser = b.units[user.id];
        b = {
          ...b,
          units: {
            ...b.units,
            [user.id]: {
              ...currentUser,
              buffs: [...(currentUser.buffs || []), newBuff],
            },
          },
        };
        logMessages.push(`gains +${amount} DEF`);
      }

      // ATK buff
      if (eff.type === "atk_up" || (eff.type === "buff" && eff.stat === "atk")) {
        const amount = eff.amount ?? 2;
        const duration = eff.duration ?? 1;
        const newBuff = {
          id: `atk_up_${Date.now()}`,
          type: "atk_up" as const,
          amount,
          duration,
        };

        const currentUser = b.units[user.id];
        b = {
          ...b,
          units: {
            ...b.units,
            [user.id]: {
              ...currentUser,
              buffs: [...(currentUser.buffs || []), newBuff],
            },
          },
        };
        logMessages.push(`gains +${amount} ATK`);
      }

      // AGI buff
      if (eff.type === "agi_up" || (eff.type === "buff" && eff.stat === "agi")) {
        const amount = eff.amount ?? 2;
        const duration = eff.duration ?? 1;
        const newBuff = {
          id: `agi_up_${Date.now()}`,
          type: "agi_up" as const,
          amount,
          duration,
        };

        const currentUser = b.units[user.id];
        b = {
          ...b,
          units: {
            ...b.units,
            [user.id]: {
              ...currentUser,
              buffs: [...(currentUser.buffs || []), newBuff],
            },
          },
        };
        logMessages.push(`gains +${amount} AGI`);
      }

      // ACC buff
      if (eff.type === "acc_up" || (eff.type === "buff" && eff.stat === "acc")) {
        const amount = eff.amount ?? 2;
        const duration = eff.duration ?? 1;
        const newBuff = {
          id: `acc_up_${Date.now()}`,
          type: "acc_up" as const,
          amount,
          duration,
        };

        const currentUser = b.units[user.id];
        b = {
          ...b,
          units: {
            ...b.units,
            [user.id]: {
              ...currentUser,
              buffs: [...(currentUser.buffs || []), newBuff],
            },
          },
        };
        logMessages.push(`gains +${amount} ACC`);
      }

      // Heal self
      if (eff.type === "heal") {
        const amount = eff.amount ?? 3;
        const currentUser = b.units[user.id];
        const newHp = Math.min(currentUser.maxHp, currentUser.hp + amount);

        b = {
          ...b,
          units: {
            ...b.units,
            [user.id]: { ...currentUser, hp: newHp },
          },
        };
        logMessages.push(`recovers ${amount} HP`);
      }
    }

    if (card.chaosCardsToCreate?.length) {
      logMessages.push(`creates ${card.chaosCardsToCreate.length} Chaos Cards`);
    }

    // If no specific effects parsed, apply a generic +3 DEF buff (fallback for "Guard" type cards)
    if (logMessages.length === 0) {
      const desc = card.description.toLowerCase();

      // Check for DEF in description
      const defMatch = desc.match(/\+(\d+)\s*def/i);
      if (defMatch) {
        const amount = parseInt(defMatch[1], 10);
        const newBuff = {
          id: `def_up_${Date.now()}`,
          type: "def_up" as const,
          amount,
          duration: 1,
        };

        const currentUser = b.units[user.id];
        b = {
          ...b,
          units: {
            ...b.units,
            [user.id]: {
              ...currentUser,
              buffs: [...(currentUser.buffs || []), newBuff],
            },
          },
        };
        logMessages.push(`gains +${amount} DEF`);
      }

      // Check for ATK in description
      const atkMatch = desc.match(/\+(\d+)\s*atk/i);
      if (atkMatch) {
        const amount = parseInt(atkMatch[1], 10);
        const newBuff = {
          id: `atk_up_${Date.now()}`,
          type: "atk_up" as const,
          amount,
          duration: 1,
        };

        const currentUser = b.units[user.id];
        b = {
          ...b,
          units: {
            ...b.units,
            [user.id]: {
              ...currentUser,
              buffs: [...(currentUser.buffs || []), newBuff],
            },
          },
        };
        logMessages.push(`gains +${amount} ATK`);
      }

      // Check for AGI in description
      const agiMatch = desc.match(/\+(\d+)\s*agi/i);
      if (agiMatch) {
        const amount = parseInt(agiMatch[1], 10);
        const newBuff = {
          id: `agi_up_${Date.now()}`,
          type: "agi_up" as const,
          amount,
          duration: 1,
        };

        const currentUser = b.units[user.id];
        b = {
          ...b,
          units: {
            ...b.units,
            [user.id]: {
              ...currentUser,
              buffs: [...(currentUser.buffs || []), newBuff],
            },
          },
        };
        logMessages.push(`gains +${amount} AGI`);
      }

      // Check for heal in description
      const healMatch = desc.match(/(?:restore|heal|recover)\s*(\d+)\s*hp/i);
      if (healMatch) {
        const amount = parseInt(healMatch[1], 10);
        const currentUser = b.units[user.id];
        const newHp = Math.min(currentUser.maxHp, currentUser.hp + amount);

        b = {
          ...b,
          units: {
            ...b.units,
            [user.id]: { ...currentUser, hp: newHp },
          },
        };
        logMessages.push(`recovers ${amount} HP`);
      }

      // Default fallback - just a generic buff message
      if (logMessages.length === 0) {
        logMessages.push(`steadies their stance`);
      }
    }

    b = finalizeCardUsage(b, user.id, card, weaponContext);

    // Log
    const logText = logMessages.join(", ");
    b = appendBattleLog(b, `SLK//UNIT   :: ${user.name} ${logText} • STRAIN +${card.strainCost}.`);

    return b;
  }

  // ========================================
  // ENEMY-TARGET CARDS (attacks, debuffs)
  // ========================================
  if (card.targetType === "enemy") {
    if (!isHostileTarget(user, targetUnit) || !targetUnit?.pos) {
      return null;
    }

    let b = battle;
    if (weaponContext?.modifiers.moveBeforeAttackTiles) {
      b = tryMoveUnitToward(b, user.id, targetUnit.id, weaponContext.modifiers.moveBeforeAttackTiles);
    }

    const actingUser = b.units[user.id];
    const actingTarget = b.units[targetUnit.id];
    if (!actingUser?.pos || !actingTarget?.pos) {
      return null;
    }

    const targetDist = Math.abs(actingUser.pos.x - actingTarget.pos.x) + Math.abs(actingUser.pos.y - actingTarget.pos.y);
    if (targetDist > cardRange) {
      return null;
    }

    const logMessages: string[] = [];

    if (weaponContext?.cardRules.tags.includes("attack") && actingUser.weaponState && checkWeaponJam(actingUser.weaponState)) {
      const jammedState = {
        ...actingUser.weaponState,
        isJammed: true,
        jammedTurnsRemaining: 1,
      };
      b = updateUnitWeaponState(b, actingUser.id, jammedState);
      const jammedUser = b.units[actingUser.id];
      if (jammedUser) {
        b = applyStrain(b, jammedUser, card.strainCost + 1);
        b = discardCardFromHand(b, actingUser.id, card);
      }
      b = appendBattleLog(b, `SLK//JAM   :: ${actingUser.name}'s ${weaponContext.weapon.name} jams while using ${card.name}.`);
      return b;
    }

    let totalDamage = (card as any).damage || 0;
    if (totalDamage === 0) {
      const damageEffect = (card.effects || []).find((effect: any) => effect.type === "damage") as any;
      totalDamage = damageEffect?.amount ?? 0;
    }
    if (totalDamage === 0) {
      const damageMatch = card.description.match(/deal\s+(\d+)\s+damage/i);
      totalDamage = damageMatch ? parseInt(damageMatch[1], 10) : 0;
    }

    const atkBuffs = (actingUser.buffs || [])
      .filter((buff) => buff.type === "atk_up" || buff.type === "atk_down")
      .reduce((sum, buff) => sum + buff.amount, 0);
    const echoAttackBonus = getEchoAttackBonus(b, actingUser);
    const echoDefenseBonus = getEchoDefenseBonus(b, actingTarget);
    const clutchDamageDelta = weaponContext?.modifiers.damageDelta ?? 0;
    const damageMultiplier = weaponContext?.modifiers.damageMultiplier ?? 1;
    totalDamage += atkBuffs + echoAttackBonus.amount + clutchDamageDelta;
    totalDamage = Math.max(0, Math.round(totalDamage * damageMultiplier));

    const defBuffs = (actingTarget.buffs || [])
      .filter((buff) => buff.type === "def_up" || buff.type === "def_down")
      .reduce((sum, buff) => sum + buff.amount, 0);
    const ignoreDef = weaponContext?.modifiers.ignoreDef ?? 0;
    const totalDef = Math.max(0, actingTarget.def + defBuffs + echoDefenseBonus.amount - ignoreDef);

    const equippedWeapon = getEquippedWeapon(actingUser);
    const isRangedAttack = Boolean(equippedWeapon && ["gun", "bow", "greatbow", "staff"].includes(equippedWeapon.weaponType));
    let hitChance = computeHitChance(actingUser, actingTarget, isRangedAttack, b);
    hitChance += weaponContext?.modifiers.accuracyDelta ?? 0;
    hitChance = Math.max(10, Math.min(100, hitChance));

    const hitRoll = Math.random() * 100;
    const didHit = hitRoll <= hitChance;

    if (didHit) {
      let finalDamage = Math.max(1, totalDamage - totalDef);
      if (actingTarget.pos) {
        const targetTile = getTileAt(b, actingTarget.pos.x, actingTarget.pos.y);
        if (targetTile) {
          let coverReduction = getCoverDamageReduction(targetTile);
          const attackerTile = getTileAt(b, actingUser.pos.x, actingUser.pos.y);
          const attackerElevation = attackerTile?.elevation ?? 0;
          const defenderElevation = targetTile.elevation ?? 0;
          if (
            (weaponContext?.modifiers.ignoreCover ?? false) ||
            (isRangedAttack && attackerElevation >= defenderElevation + 1 && targetTile.terrain === "light_cover")
          ) {
            coverReduction = 0;
          }
          finalDamage = Math.max(1, finalDamage - coverReduction);
        }
      }

      const newHp = actingTarget.hp - finalDamage;
      if (newHp <= 0) {
        const newUnits = { ...b.units };
        delete newUnits[actingTarget.id];
        b = {
          ...b,
          units: newUnits,
          turnOrder: b.turnOrder.filter((id) => id !== actingTarget.id),
        };
        logMessages.push(`hits ${actingTarget.name} for ${finalDamage} - TARGET OFFLINE`);
      } else {
        b = {
          ...b,
          units: {
            ...b.units,
            [actingTarget.id]: { ...actingTarget, hp: newHp },
          },
        };
        logMessages.push(`hits ${actingTarget.name} for ${finalDamage} (HP ${newHp}/${actingTarget.maxHp})`);
      }

      for (const effect of card.effects || []) {
        const eff = effect as any;
        if (["debuff", "def_down", "atk_down", "agi_down", "acc_down"].includes(eff.type)) {
          const stat = eff.stat || eff.type.replace("_down", "");
          const amount = eff.amount ?? 2;
          b = addTimedBuff(b, actingTarget.id, `${stat}_down`, -amount, eff.duration ?? 1);
          logMessages.push(`${actingTarget.name} suffers -${amount} ${stat.toUpperCase()}`);
        }
        if (eff.type === "push") {
          b = tryMoveUnitAway(b, actingTarget.id, actingUser.id, eff.amount ?? 1);
          if (b.units[actingTarget.id]) {
            logMessages.push(`${actingTarget.name} is pushed back`);
          }
        }
        if (eff.type === "stun") {
          b = addStatus(b, actingTarget.id, "stunned", eff.duration ?? 1);
          logMessages.push(`${actingTarget.name} is STUNNED`);
        }
        if (eff.type === "burn") {
          b = addStatus(b, actingTarget.id, "burning", eff.duration ?? 2);
          logMessages.push(`${actingTarget.name} is BURNING`);
        }
      }

      weaponContext?.modifiers.statusesOnHit.forEach((status) => {
        b = addStatus(b, actingTarget.id, status.status, status.duration);
      });

      if (weaponContext?.modifiers.pullTargetTiles) {
        b = tryMoveUnitToward(b, actingTarget.id, actingUser.id, weaponContext.modifiers.pullTargetTiles);
      }
      if (weaponContext?.modifiers.pullSelfTiles) {
        b = tryMoveUnitToward(b, actingUser.id, actingTarget.id, weaponContext.modifiers.pullSelfTiles);
      }
      if (weaponContext?.modifiers.splashDamageInRange) {
        b = applySplashDamageInRange(b, actingUser.id, cardRange, weaponContext.modifiers.splashDamageInRange);
      }

      const latestTarget = b.units[actingTarget.id];
      if (latestTarget && weaponContext?.cardRules.tags.includes("direct")) {
        b = applyWeaponHitToUnit(b, actingTarget.id, false);
      }
    } else {
      logMessages.push(`misses ${actingTarget.name}`);
    }

    if (didHit) {
      weaponContext?.modifiers.extraAttacks.forEach((extraAttack) => {
        const repeatedTarget = b.units[actingTarget.id];
        if (!repeatedTarget) {
          return;
        }
        const extraDamage = Math.max(1, totalDamage + extraAttack.damageDelta - totalDef);
        const newHp = repeatedTarget.hp - extraDamage;
        if (newHp <= 0) {
          const newUnits = { ...b.units };
          delete newUnits[repeatedTarget.id];
          b = {
            ...b,
            units: newUnits,
            turnOrder: b.turnOrder.filter((id) => id !== repeatedTarget.id),
          };
          logMessages.push(`follows with an extra hit for ${extraDamage} - TARGET OFFLINE`);
        } else {
          b = {
            ...b,
            units: {
              ...b.units,
              [repeatedTarget.id]: {
                ...repeatedTarget,
                hp: newHp,
              },
            },
          };
          logMessages.push(`follows with an extra hit for ${extraDamage}`);
        }
      });
    }

    b = finalizeCardUsage(b, user.id, card, weaponContext);
    b = appendBattleLog(b, `SLK//HIT    :: ${actingUser.name} ${logMessages.join("; ")}.`);

    if (echoAttackBonus.triggeredPlacements.length > 0 || echoDefenseBonus.triggeredPlacements.length > 0) {
      b = incrementEchoFieldTriggerCount(
        b,
        [...echoAttackBonus.triggeredPlacements, ...echoDefenseBonus.triggeredPlacements],
      );
    }

    b = evaluateBattleOutcome(b);
    return b;
  }

  // ========================================
  // TILE-TARGET CARDS (movement abilities)
  // ========================================
  if (card.targetType === "tile") {
    // Movement card - check if tile is valid
    // For now, just apply any movement effects

    let b = battle;
    let logMessages: string[] = [];

    // Check for movement effect
    const moveEffect = (card.effects || []).find((e: any) => e.type === "move") as any;
    if (moveEffect) {
      const tiles = moveEffect.tiles ?? 2;
      // For simplicity, just log the effect - actual movement handled elsewhere
      logMessages.push(`can move ${tiles} extra tiles`);
    }

    b = finalizeCardUsage(b, user.id, card, weaponContext);

    const logText = logMessages.length > 0 ? logMessages.join(", ") : `uses ${card.name}`;
    b = appendBattleLog(b, `SLK//UNIT   :: ${user.name} ${logText} • STRAIN +${card.strainCost}.`);

    return b;
  }

  // Invalid target type
  return null;
}

/**
 * Damage cover tiles in an area (for AoE attacks)
 */
export function damageCoverInArea(
  battle: BattleState,
  center: Vec2,
  radius: number,
  damage: number
): BattleState {
  const updatedTiles: Tile[] = battle.tiles.map((tile) => ({
    ...tile,
    cover: tile.cover ? { ...tile.cover } : tile.cover,
  }));
  let coverDamaged = false;

  updatedTiles.forEach((tile, index) => {
    const dist = Math.abs(tile.pos.x - center.x) + Math.abs(tile.pos.y - center.y);
    if (dist > radius) {
      return;
    }
    if (tile.terrain !== "light_cover" && tile.terrain !== "heavy_cover") {
      return;
    }

    const damagedTile = damageCover(tile, damage);
    updatedTiles[index] = damagedTile;
    if (damagedTile.terrain === "rubble") {
      coverDamaged = true;
    }
  });

  if (coverDamaged) {
    return {
      ...battle,
      tiles: updatedTiles,
      log: [...battle.log, "SLK//COVER  :: Cover destroyed by area damage."],
    };
  }

  return {
    ...battle,
    tiles: updatedTiles,
  };
}

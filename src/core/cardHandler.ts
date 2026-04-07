// ============================================================================
// BATTLE CARD HANDLER - Processes card plays in the BattleScreen
// This file contains the handleCardPlay function to replace the hardcoded
// card handling in handleTileClick
// ============================================================================

import { BattleState, BattleUnitState, Tile, appendBattleLog, applyStrain, advanceTurn, evaluateBattleOutcome, Vec2, getEquippedWeapon, getTileAt } from "./battle";
import { Card } from "./types";
import { getCoverDamageReduction, damageCover } from "./coverGenerator";
import {
  getEchoAttackBonus,
  getEchoDefenseBonus,
  incrementEchoFieldTriggerCount,
} from "./echoFieldEffects";

import { getAllStarterEquipment } from "./equipment";
import { applyEffectFlowToBattle } from "./effectFlow";

function isHostileTarget(user: BattleUnitState, targetUnit: BattleUnitState | null | undefined): boolean {
  return Boolean(targetUnit && targetUnit.isEnemy !== user.isEnemy);
}

function isAlliedTarget(user: BattleUnitState, targetUnit: BattleUnitState | null | undefined): boolean {
  return Boolean(targetUnit && targetUnit.isEnemy === user.isEnemy);
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

function discardCardFromHand(battle: BattleState, unitId: string, cardId: string): BattleState {
  const unit = battle.units[unitId];
  if (!unit) return battle;

  return {
    ...battle,
    units: {
      ...battle.units,
      [unitId]: {
        ...unit,
        hand: unit.hand.filter(id => id !== cardId),
        discardPile: [...unit.discardPile, cardId],
      },
    },
  };
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

  // Check range
  if (distance > cardRange) return null;

  // ========================================
  // WAIT / END TURN CARDS
  // ========================================
  if (card.id === "core_wait" || card.name.toLowerCase() === "wait" ||
    card.effects?.some((e: any) => e.type === "end_turn")) {

    // Discard the card
    const updatedUser: BattleUnitState = {
      ...user,
      hand: user.hand.filter(id => id !== card.id),
      discardPile: [...user.discardPile, card.id],
    };

    let b: BattleState = {
      ...battle,
      units: { ...battle.units, [user.id]: updatedUser },
    };

    b = appendBattleLog(b, `SLK//UNIT   :: ${user.name} waits, ending their turn.`);
    b = advanceTurn(b);

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

    b = applyStrain(b, currentUser, card.strainCost);
    if (b.units[user.id]) {
      b = discardCardFromHand(b, user.id, card.id);
    }

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

    const currentUser = b.units[user.id];
    b = applyStrain(b, currentUser, card.strainCost);
    b = discardCardFromHand(b, user.id, card.id);
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

    // Apply strain
    const currentUser = b.units[user.id];
    b = applyStrain(b, currentUser, card.strainCost);

    // Discard the card
    b = discardCardFromHand(b, user.id, card.id);

    // Log
    const logText = logMessages.join(", ");
    b = appendBattleLog(b, `SLK//UNIT   :: ${user.name} ${logText} • STRAIN +${card.strainCost}.`);

    return b;
  }

  // ========================================
  // ENEMY-TARGET CARDS (attacks, debuffs)
  // ========================================
  if (card.targetType === "enemy") {
    // Must have a valid enemy target
    if (!isHostileTarget(user, targetUnit) || !targetUnit?.pos) {
      return null;
    }

    // Check range to target
    const targetDist = Math.abs(user.pos.x - targetUnit.pos.x) + Math.abs(user.pos.y - targetUnit.pos.y);
    if (targetDist > cardRange) {
      return null;
    }

    let b = battle;
    let logMessages: string[] = [];

    // Calculate damage
    let totalDamage = (card as any).damage || 0;

    // Get damage from effects if not set directly
    if (totalDamage === 0) {
      const damageEffect = (card.effects || []).find((e: any) => e.type === "damage") as any;
      if (damageEffect) {
        totalDamage = damageEffect.amount ?? 0;
      }
    }

    // If no damage effect or property, try to parse from description
    if (totalDamage === 0) {
      const dmgMatch = card.description.match(/deal\s+(\d+)\s+damage/i);
      if (dmgMatch) {
        totalDamage = parseInt(dmgMatch[1], 10);
      }
    }

    // Apply ATK buffs from user
    const atkBuffs = (user.buffs || [])
      .filter(buff => buff.type === "atk_up")
      .reduce((sum, buff) => sum + buff.amount, 0);
    totalDamage += atkBuffs;
    const echoAttackBonus = getEchoAttackBonus(b, user);
    totalDamage += echoAttackBonus.amount;

    // Reduce by target's DEF + DEF buffs
    const defBuffs = (targetUnit.buffs || [])
      .filter(buff => buff.type === "def_up")
      .reduce((sum, buff) => sum + buff.amount, 0);
    const echoDefenseBonus = getEchoDefenseBonus(b, targetUnit);
    const totalDef = targetUnit.def + defBuffs + echoDefenseBonus.amount;

    let finalDamage = Math.max(1, totalDamage - totalDef);

    const equippedWeapon = getEquippedWeapon(user);
    const isRangedAttack = Boolean(equippedWeapon && ["gun", "bow", "greatbow"].includes(equippedWeapon.weaponType));

    // Apply cover damage reduction if target is on cover
    if (targetUnit.pos) {
      const targetTile = getTileAt(battle, targetUnit.pos.x, targetUnit.pos.y);
      if (targetTile) {
        let coverReduction = getCoverDamageReduction(targetTile);
        const attackerTile = getTileAt(battle, user.pos.x, user.pos.y);
        const attackerElevation = attackerTile?.elevation ?? 0;
        const defenderElevation = targetTile.elevation ?? 0;
        if (isRangedAttack && attackerElevation >= defenderElevation + 1 && targetTile.terrain === "light_cover") {
          coverReduction = 0;
        }
        finalDamage = Math.max(1, finalDamage - coverReduction);
      }
    }

    // Apply damage
    const newHp = targetUnit.hp - finalDamage;

    if (newHp <= 0) {
      // Target dies
      const newUnits = { ...b.units };
      delete newUnits[targetUnit.id];

      b = {
        ...b,
        units: newUnits,
        turnOrder: b.turnOrder.filter(id => id !== targetUnit.id),
      };

      logMessages.push(`hits ${targetUnit.name} for ${finalDamage} - TARGET OFFLINE`);
    } else {
      // Target survives
      b = {
        ...b,
        units: {
          ...b.units,
          [targetUnit.id]: { ...targetUnit, hp: newHp },
        },
      };

      logMessages.push(`hits ${targetUnit.name} for ${finalDamage} (HP ${newHp}/${targetUnit.maxHp})`);
    }

    // Process additional effects (debuffs, push, status)
    for (const effect of (card.effects || [])) {
      const eff = effect as any;

      // Debuffs
      if (
        eff.type === "debuff" ||
        eff.type === "def_down" ||
        eff.type === "atk_down" ||
        eff.type === "agi_down" ||
        eff.type === "acc_down"
      ) {
        const stat = eff.stat || eff.type.replace("_down", "");
        const amount = eff.amount ?? 2;
        const duration = eff.duration ?? 1;

        const currentTarget = b.units[targetUnit.id];
        if (currentTarget) {
          const newDebuff = {
            id: `${stat}_down_${Date.now()}`,
            type: `${stat}_down` as any,
            amount: -amount,
            duration,
          };

          b = {
            ...b,
            units: {
              ...b.units,
              [targetUnit.id]: {
                ...currentTarget,
                buffs: [...(currentTarget.buffs || []), newDebuff],
              },
            },
          };
          logMessages.push(`${targetUnit.name} suffers -${amount} ${stat.toUpperCase()}`);
        }
      }

      // Push
      if (eff.type === "push") {
        const pushAmount = eff.amount ?? 1;
        const currentTarget = b.units[targetUnit.id];
        if (currentTarget && currentTarget.pos && user.pos) {
          const dx = Math.sign(currentTarget.pos.x - user.pos.x);
          const dy = Math.sign(currentTarget.pos.y - user.pos.y);

          let newX = currentTarget.pos.x + dx * pushAmount;
          let newY = currentTarget.pos.y + dy * pushAmount;

          // Clamp to bounds
          newX = Math.max(0, Math.min(b.gridWidth - 1, newX));
          newY = Math.max(0, Math.min(b.gridHeight - 1, newY));

          // Check if blocked
          const blocked = Object.values(b.units).some(
            u => u.pos && u.pos.x === newX && u.pos.y === newY && u.id !== targetUnit.id
          );

          if (!blocked) {
            b = {
              ...b,
              units: {
                ...b.units,
                [targetUnit.id]: {
                  ...currentTarget,
                  pos: { x: newX, y: newY },
                },
              },
            };
            logMessages.push(`${targetUnit.name} is pushed back`);
          }
        }
      }

      // Stun
      if (eff.type === "stun") {
        const currentTarget = b.units[targetUnit.id];
        if (currentTarget) {
          const stunBuff = {
            id: `stun_${Date.now()}`,
            type: "stun" as any,
            amount: 0,
            duration: eff.duration ?? 1,
          };

          b = {
            ...b,
            units: {
              ...b.units,
              [targetUnit.id]: {
                ...currentTarget,
                buffs: [...(currentTarget.buffs || []), stunBuff],
              },
            },
          };
          logMessages.push(`${targetUnit.name} is STUNNED`);
        }
      }

      // Burn
      if (eff.type === "burn") {
        const currentTarget = b.units[targetUnit.id];
        if (currentTarget) {
          const burnBuff = {
            id: `burn_${Date.now()}`,
            type: "burn" as any,
            amount: 1,
            duration: eff.duration ?? 2,
          };

          b = {
            ...b,
            units: {
              ...b.units,
              [targetUnit.id]: {
                ...currentTarget,
                buffs: [...(currentTarget.buffs || []), burnBuff],
              },
            },
          };
          logMessages.push(`${targetUnit.name} is BURNING`);
        }
      }
    }

    // Check for additional effects from description parsing
    const desc = card.description.toLowerCase();

    // Push from description
    if (!card.effects?.some((e: any) => e.type === "push")) {
      const pushMatch = desc.match(/push\s+(?:target\s+)?(?:back\s+)?(\d+)\s+tile/i);
      if (pushMatch) {
        const pushAmount = parseInt(pushMatch[1], 10);
        const currentTarget = b.units[targetUnit.id];
        if (currentTarget && currentTarget.pos && user.pos) {
          const dx = Math.sign(currentTarget.pos.x - user.pos.x);
          const dy = Math.sign(currentTarget.pos.y - user.pos.y);

          let newX = currentTarget.pos.x + dx * pushAmount;
          let newY = currentTarget.pos.y + dy * pushAmount;

          newX = Math.max(0, Math.min(b.gridWidth - 1, newX));
          newY = Math.max(0, Math.min(b.gridHeight - 1, newY));

          const blocked = Object.values(b.units).some(
            u => u.pos && u.pos.x === newX && u.pos.y === newY && u.id !== targetUnit.id
          );

          if (!blocked) {
            b = {
              ...b,
              units: {
                ...b.units,
                [targetUnit.id]: {
                  ...currentTarget,
                  pos: { x: newX, y: newY },
                },
              },
            };
            logMessages.push(`${targetUnit.name} is pushed back`);
          }
        }
      }
    }

    // Stun from description
    if (!card.effects?.some((e: any) => e.type === "stun") && desc.includes("stun")) {
      const currentTarget = b.units[targetUnit.id];
      if (currentTarget) {
        const stunBuff = {
          id: `stun_${Date.now()}`,
          type: "stun" as any,
          amount: 0,
          duration: 1,
        };

        b = {
          ...b,
          units: {
            ...b.units,
            [targetUnit.id]: {
              ...currentTarget,
              buffs: [...(currentTarget.buffs || []), stunBuff],
            },
          },
        };
        logMessages.push(`${targetUnit.name} is STUNNED`);
      }
    }

    // Apply strain to user
    const currentUser = b.units[user.id];
    if (currentUser) {
      b = applyStrain(b, currentUser, card.strainCost);
    }

    // Discard the card
    b = discardCardFromHand(b, user.id, card.id);

    // Log
    b = appendBattleLog(b, `SLK//HIT    :: ${user.name} ${logMessages.join("; ")}.`);

    if (echoAttackBonus.triggeredPlacements.length > 0 || echoDefenseBonus.triggeredPlacements.length > 0) {
      b = incrementEchoFieldTriggerCount(
        b,
        [...echoAttackBonus.triggeredPlacements, ...echoDefenseBonus.triggeredPlacements],
      );
    }

    // Check victory/defeat
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

    // Apply strain
    const currentUser = b.units[user.id];
    b = applyStrain(b, currentUser, card.strainCost);

    // Discard
    b = discardCardFromHand(b, user.id, card.id);

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

// ============================================================================
// BATTLE CARD HANDLER - Processes card plays in the BattleScreen
// This file contains the handleCardPlay function to replace the hardcoded
// card handling in handleTileClick
// ============================================================================

import { BattleState, BattleUnitState, appendBattleLog, applyStrain, advanceTurn, evaluateBattleOutcome, Tile, Vec2, getEquippedWeapon } from "./battle";
import { Card, CardEffect } from "./types";
import { getCoverDamageReduction, damageCover } from "./coverGenerator";
import { hasLineOfSight, getFirstCoverInLine } from "./lineOfSight";
import { getAllStarterEquipment } from "./equipment";

import { GameState } from "./types";
import { getSettings } from "./settings";

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
  
  if (user.unitClass === "ranger" && isAttackCard) {
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
        logMessages.push(`uses ${card.name}`);
      }
    }
    
    // Apply strain
    const currentUser = b.units[user.id];
    b = applyStrain(b, currentUser, card.strainCost);
    
    // Discard the card
    const userAfterStrain = b.units[user.id];
    b = {
      ...b,
      units: {
        ...b.units,
        [user.id]: {
          ...userAfterStrain,
          hand: userAfterStrain.hand.filter(id => id !== card.id),
          discardPile: [...userAfterStrain.discardPile, card.id],
        },
      },
    };
    
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
    if (!targetUnit || !targetUnit.isEnemy || !targetUnit.pos) {
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
    let totalDamage = 0;
    
    // Get damage from effects
    const damageEffect = (card.effects || []).find((e: any) => e.type === "damage") as any;
    if (damageEffect) {
      totalDamage = damageEffect.amount ?? 0;
    }
    
    // If no damage effect, try to parse from description
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
    
    // Reduce by target's DEF + DEF buffs
    const defBuffs = (targetUnit.buffs || [])
      .filter(buff => buff.type === "def_up")
      .reduce((sum, buff) => sum + buff.amount, 0);
    const totalDef = targetUnit.def + defBuffs;
    
    let finalDamage = Math.max(1, totalDamage - totalDef);
    
    // Apply cover damage reduction if target is on cover
    if (targetUnit.pos) {
      const targetTile = getTileAt(battle, targetUnit.pos.x, targetUnit.pos.y);
      if (targetTile) {
        const coverReduction = getCoverDamageReduction(targetTile);
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
      if (eff.type === "debuff" || eff.type === "def_down" || eff.type === "atk_down" || eff.type === "acc_down") {
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
    const userAfterStrain = b.units[user.id];
    if (userAfterStrain) {
      b = {
        ...b,
        units: {
          ...b.units,
          [user.id]: {
            ...userAfterStrain,
            hand: userAfterStrain.hand.filter(id => id !== card.id),
            discardPile: [...userAfterStrain.discardPile, card.id],
          },
        },
      };
    }
    
    // Log
    b = appendBattleLog(b, `SLK//HIT    :: ${user.name} ${logMessages.join("; ")}.`);
    
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
    const userAfterStrain = b.units[user.id];
    b = {
      ...b,
      units: {
        ...b.units,
        [user.id]: {
          ...userAfterStrain,
          hand: userAfterStrain.hand.filter(id => id !== card.id),
          discardPile: [...userAfterStrain.discardPile, card.id],
        },
      },
    };
    
    const logText = logMessages.length > 0 ? logMessages.join(", ") : `uses ${card.name}`;
    b = appendBattleLog(b, `SLK//UNIT   :: ${user.name} ${logText} • STRAIN +${card.strainCost}.`);
    
    return b;
  }
  
  // Invalid target type
  return null;
}

/**
 * Helper to get tile at a position
 */
function getTileAt(battle: BattleState, x: number, y: number): Tile | null {
  if (x < 0 || x >= battle.gridWidth || y < 0 || y >= battle.gridHeight) {
    return null;
  }
  const index = y * battle.gridWidth + x;
  return battle.tiles[index] || null;
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
  const updatedTiles = [...battle.tiles];
  let coverDamaged = false;
  
  for (let y = 0; y < battle.gridHeight; y++) {
    for (let x = 0; x < battle.gridWidth; x++) {
      const dist = Math.abs(x - center.x) + Math.abs(y - center.y);
      if (dist <= radius) {
        const tileIndex = y * battle.gridWidth + x;
        const tile = updatedTiles[tileIndex];
        
        if (tile && (tile.terrain === "light_cover" || tile.terrain === "heavy_cover")) {
          const wasCover = tile.terrain === "light_cover" || tile.terrain === "heavy_cover";
          const damagedTile = damageCover(tile, damage);
          updatedTiles[tileIndex] = damagedTile;
          
          // Check if cover was destroyed (was cover, now rubble)
          if (wasCover && damagedTile.terrain === "rubble") {
            coverDamaged = true;
          }
        }
      }
    }
  }
  
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
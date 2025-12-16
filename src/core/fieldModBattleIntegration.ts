// ============================================================================
// FIELD MOD BATTLE INTEGRATION - Wires Field Mods into battle system
// ============================================================================

import { emit, ProcContext, ProcResult } from "./fieldModProcEngine";
import { FieldModTrigger, FieldModInstance, HardpointState } from "./fieldMods";
import { FieldModDef, getAllFieldModDefs } from "./fieldModDefinitions";
import { BattleState, BattleUnitState, UnitId } from "./types";
import { getActiveRun } from "./campaignManager";
import { getGameState } from "../state/gameStore";

// Get Field Mod state from run
function getFieldModState(): {
  unitHardpoints: Record<UnitId, HardpointState>;
  runInventory: FieldModInstance[];
} {
  const activeRun = getActiveRun();
  const state = getGameState();
  
  return {
    unitHardpoints: activeRun?.unitHardpoints || {},
    runInventory: activeRun?.runFieldModInventory || state.runFieldModInventory || [],
  };
}

// Apply proc results to battle state
function applyProcResults(
  battle: BattleState,
  results: ProcResult[],
  eventSequence: number
): BattleState {
  let next = battle;
  const allMods = getAllFieldModDefs();
  
  for (const result of results) {
    const modDef = allMods.find(m => m.id === result.modId);
    if (!modDef) continue;
    
    // Log the proc
    if (result.logMessage) {
      next = {
        ...next,
        log: [...next.log, `SLK//MOD    :: ${result.logMessage}`],
      };
    }
    
    // Apply effects
    switch (result.effect.kind) {
      case "deal_damage":
        for (const targetId of result.targetUnitIds) {
          const target = next.units[targetId];
          if (!target || target.isEnemy === false) continue; // Only damage enemies
          
          const damage = result.effect.amount;
          const newHp = Math.max(0, target.hp - damage);
          
          if (newHp <= 0) {
            // Unit killed
            const newUnits = { ...next.units };
            delete newUnits[targetId];
            const newTurnOrder = next.turnOrder.filter(id => id !== targetId);
            next = {
              ...next,
              units: newUnits,
              turnOrder: newTurnOrder,
              log: [...next.log, `SLK//MOD    :: ${target.name} eliminated by ${result.modName}.`],
            };
          } else {
            next = {
              ...next,
              units: {
                ...next.units,
                [targetId]: { ...target, hp: newHp },
              },
              log: [...next.log, `SLK//MOD    :: ${result.modName} deals ${damage} damage to ${target.name}.`],
            };
          }
        }
        break;
        
      case "gain_shield":
        // Shield system not fully implemented - use temporary HP boost as placeholder
        for (const targetId of result.targetUnitIds) {
          const target = next.units[targetId];
          if (!target) continue;
          
          const shieldAmount = result.effect.amount;
          const newHp = Math.min(target.maxHp, target.hp + shieldAmount);
          
          next = {
            ...next,
            units: {
              ...next.units,
              [targetId]: { ...target, hp: newHp },
            },
            log: [...next.log, `SLK//MOD    :: ${result.modName} grants ${shieldAmount} shield to ${target.name}.`],
          };
        }
        break;
        
      case "draw":
        // Draw cards (placeholder - would need proper card draw logic)
        for (const targetId of result.targetUnitIds) {
          const target = next.units[targetId];
          if (!target) continue;
          
          const drawAmount = result.effect.amount;
          // Placeholder: just log it
          next = {
            ...next,
            log: [...next.log, `SLK//MOD    :: ${result.modName} draws ${drawAmount} card(s) for ${target.name}.`],
          };
        }
        break;
        
      case "apply_status":
        // Status effects placeholder
        for (const targetId of result.targetUnitIds) {
          const target = next.units[targetId];
          if (!target) continue;
          
          next = {
            ...next,
            log: [...next.log, `SLK//MOD    :: ${result.modName} applies ${result.effect.status} (${result.effect.stacks} stacks) to ${target.name}.`],
          };
        }
        break;
        
      case "summon_drone":
        // Drone summoning placeholder
        next = {
          ...next,
          log: [...next.log, `SLK//MOD    :: ${result.modName} deploys ${result.effect.count} combat drone(s).`],
        };
        break;
        
      case "reduce_cost_next_card":
        // Cost reduction placeholder (would need to track per unit)
        for (const targetId of result.targetUnitIds) {
          const target = next.units[targetId];
          if (!target) continue;
          
          next = {
            ...next,
            log: [...next.log, `SLK//MOD    :: ${result.modName} reduces next card cost by ${result.effect.amount} for ${target.name}.`],
          };
        }
        break;
        
      case "gain_resource":
        // Resource gain - handled outside battle
        next = {
          ...next,
          log: [...next.log, `SLK//MOD    :: ${result.modName} grants ${result.effect.amount} ${result.effect.resource}.`],
        };
        break;
        
      case "knockback":
        // Knockback placeholder
        for (const targetId of result.targetUnitIds) {
          const target = next.units[targetId];
          if (!target) continue;
          
          next = {
            ...next,
            log: [...next.log, `SLK//MOD    :: ${result.modName} knocks back ${target.name} ${result.effect.tiles} tiles.`],
          };
        }
        break;
    }
  }
  
  return next;
}

/**
 * Trigger Field Mod procs for a battle event
 */
export function triggerFieldMods(
  trigger: FieldModTrigger,
  battle: BattleState,
  triggeringUnitId: UnitId | null = null,
  context: Partial<ProcContext> = {},
  eventSequence: number = 0
): BattleState {
  const { unitHardpoints, runInventory } = getFieldModState();
  const allMods = getAllFieldModDefs();
  
  const procCtx: ProcContext = {
    battleState: battle,
    triggeringUnitId,
    eventSequence,
    ...context,
  };
  
  const results = emit(trigger, procCtx, allMods, unitHardpoints, runInventory);
  
  if (results.length === 0) {
    return battle;
  }
  
  return applyProcResults(battle, results, eventSequence);
}

/**
 * Trigger on battle start
 */
export function triggerBattleStart(battle: BattleState): BattleState {
  return triggerFieldMods("battle_start", battle, null, {}, 0);
}

/**
 * Trigger on turn start
 */
export function triggerTurnStart(battle: BattleState, unitId: UnitId): BattleState {
  return triggerFieldMods("turn_start", battle, unitId, {}, battle.turnCount);
}

/**
 * Trigger on hit
 */
export function triggerHit(
  battle: BattleState,
  attackerId: UnitId,
  targetId: UnitId,
  damageAmount: number,
  isCrit: boolean = false,
  eventSequence: number = 0
): BattleState {
  let next = triggerFieldMods(
    "hit",
    battle,
    attackerId,
    { targetUnitId: targetId, damageAmount, isCrit },
    eventSequence
  );
  
  if (isCrit) {
    next = triggerFieldMods(
      "crit",
      next,
      attackerId,
      { targetUnitId: targetId, damageAmount, isCrit: true },
      eventSequence + 1
    );
  }
  
  return next;
}

/**
 * Trigger on kill
 */
export function triggerKill(
  battle: BattleState,
  killerId: UnitId,
  killedId: UnitId,
  eventSequence: number = 0
): BattleState {
  return triggerFieldMods(
    "kill",
    battle,
    killerId,
    { targetUnitId: killedId },
    eventSequence
  );
}

/**
 * Trigger on card played
 */
export function triggerCardPlayed(
  battle: BattleState,
  unitId: UnitId,
  cardId: string,
  eventSequence: number = 0
): BattleState {
  return triggerFieldMods(
    "card_played",
    battle,
    unitId,
    { cardId },
    eventSequence
  );
}


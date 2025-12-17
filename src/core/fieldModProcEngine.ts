// ============================================================================
// FIELD MOD PROC ENGINE - Centralized trigger/effect system
// Handles all Field Mod procs deterministically
// ============================================================================

import {
  FieldModTrigger,
  FieldModDef,
  FieldModInstance,
  FieldModEffect,
} from "./fieldMods";
import { BattleState } from "./battle";
import { UnitId } from "./types";

// Context passed to proc engine
export interface ProcContext {
  battleState: BattleState;
  triggeringUnitId: UnitId | null; // null for global triggers like battle_start
  targetUnitId?: UnitId | null;    // for hit/kill/etc
  cardId?: string;                  // for card_played
  damageAmount?: number;            // for hit/damage_taken
  isCrit?: boolean;                 // for crit
  eventSequence?: number;           // for deterministic RNG
}

// Result of a proc execution
export interface ProcResult {
  modId: string;
  modName: string;
  effect: FieldModEffect;
  targetUnitIds: UnitId[];
  logMessage?: string;
}

// Seeded RNG for deterministic procs
function createSeededRNG(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// Get deterministic seed for a proc event
function getProcSeed(
  battleId: string,
  turnNumber: number,
  eventSequence: number
): number {
  // Combine battle ID hash, turn number, and event sequence
  let hash = 0;
  for (let i = 0; i < battleId.length; i++) {
    hash = ((hash << 5) - hash) + battleId.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return (hash + turnNumber * 1000 + eventSequence) & 0x7fffffff;
}

/**
 * Get all applicable Field Mods for a trigger
 */
function gatherApplicableMods(
  trigger: FieldModTrigger,
  ctx: ProcContext,
  allMods: FieldModDef[],
  unitHardpoints: Record<UnitId, (FieldModInstance | null)[]>,
  _runInventory: FieldModInstance[] // Reserved for future run-inventory based procs
): Array<{ def: FieldModDef; instance: FieldModInstance; unitId: UnitId | null }> {
  const applicable: Array<{ def: FieldModDef; instance: FieldModInstance; unitId: UnitId | null }> = [];

  // Unit-scope mods: check triggering unit's hardpoints
  if (ctx.triggeringUnitId) {
    const hardpoints = unitHardpoints[ctx.triggeringUnitId] || [null, null];
    for (const mod of hardpoints) {
      if (!mod) continue;
      const def = allMods.find(m => m.id === mod.defId);
      if (def && def.trigger === trigger && def.scope === "unit") {
        applicable.push({ def, instance: mod, unitId: ctx.triggeringUnitId });
      }
    }
  }

  // Squad-scope mods: check all friendly units' hardpoints
  const friendlyUnits = Object.values(ctx.battleState.units).filter(u => !u.isEnemy);
  for (const unit of friendlyUnits) {
    const hardpoints = unitHardpoints[unit.id] || [null, null];
    for (const mod of hardpoints) {
      if (!mod) continue;
      const def = allMods.find(m => m.id === mod.defId);
      if (def && def.trigger === trigger && def.scope === "squad") {
        // Avoid duplicates
        if (!applicable.find(a => a.instance.instanceId === mod.instanceId)) {
          applicable.push({ def, instance: mod, unitId: unit.id });
        }
      }
    }
  }

  return applicable;
}

/**
 * Scale effect by stacks
 */
function scaleEffectByStacks(
  effect: FieldModEffect,
  stacks: number,
  stackMode: "linear" | "additive"
): FieldModEffect {
  if (stackMode === "additive") {
    // For additive, we might multiply count (e.g., drones)
    if (effect.kind === "summon_drone") {
      return { ...effect, count: effect.count * stacks };
    }
    // For other effects, additive might mean multiple procs (handled by caller)
    return effect;
  } else {
    // Linear scaling: multiply amounts
    switch (effect.kind) {
      case "deal_damage":
        return { ...effect, amount: effect.amount * stacks };
      case "apply_status":
        return { ...effect, stacks: effect.stacks * stacks };
      case "gain_shield":
        return { ...effect, amount: effect.amount * stacks };
      case "draw":
        return { ...effect, amount: effect.amount * stacks };
      case "reduce_cost_next_card":
        return { ...effect, amount: effect.amount * stacks };
      case "gain_resource":
        return { ...effect, amount: effect.amount * stacks };
      case "knockback":
        return { ...effect, tiles: effect.tiles * stacks };
      default:
        return effect;
    }
  }
}

// Dev-only debug logging for Field Mods procs
const DEBUG_FIELD_MODS = true;

// Trigger label mapping for debug output
const TRIGGER_DEBUG_LABELS: Record<FieldModTrigger, string> = {
  battle_start: "On Engagement",
  turn_start: "On Initiative",
  card_played: "On Command Issued",
  draw: "On Resupply",
  move: "On Maneuver",
  hit: "On Contact",
  crit: "On Precision Hit",
  kill: "On Confirmed Kill",
  shield_gained: "On Barrier Raised",
  damage_taken: "On Taking Fire",
  room_cleared: "On Area Secured",
};

/**
 * Main proc engine entry point
 */
export function emit(
  trigger: FieldModTrigger,
  ctx: ProcContext,
  allMods: FieldModDef[],
  unitHardpoints: Record<UnitId, (FieldModInstance | null)[]>,
  runInventory: FieldModInstance[]
): ProcResult[] {
  const results: ProcResult[] = [];

  // Gather applicable mods
  const applicable = gatherApplicableMods(trigger, ctx, allMods, unitHardpoints, runInventory);

  if (applicable.length === 0) {
    return results;
  }

  // Get deterministic RNG seed
  const eventSeq = ctx.eventSequence || 0;
  const seed = getProcSeed(ctx.battleState.id, ctx.battleState.turnCount, eventSeq);
  const rng = createSeededRNG(seed);

  // Process each applicable mod
  for (const { def, instance, unitId } of applicable) {
    // Check proc chance
    const procChance = def.chance ?? 1.0;
    const roll = rng();
    const procPassed = roll < procChance;

    // DEV LOGGING: Log proc attempt
    if (DEBUG_FIELD_MODS) {
      const triggerLabel = TRIGGER_DEBUG_LABELS[trigger] || trigger;
      console.log(
        `[FieldMod] ${triggerLabel} triggered: ${def.name} ` +
        `stacks=${instance.stacks} chance=${(procChance * 100).toFixed(0)}% ` +
        `roll=${(roll * 100).toFixed(1)}% -> ${procPassed ? "PROC!" : "miss"}`
      );
    }

    if (!procPassed) {
      continue; // Failed proc roll
    }

    // Scale effect by stacks
    const scaledEffect = scaleEffectByStacks(def.effect, instance.stacks, def.stackMode);

    // Determine target units based on effect type
    let targetUnitIds: UnitId[] = [];

    // Extract target from effect (not all effects have targets)
    const effectTarget = "target" in scaledEffect ? (scaledEffect as any).target : null;

    switch (effectTarget) {
      case "self":
        if (unitId) targetUnitIds = [unitId];
        break;
      case "all_allies":
      case "team":
        targetUnitIds = Object.values(ctx.battleState.units)
          .filter(u => !u.isEnemy)
          .map(u => u.id);
        break;
      case "random_enemy":
        const enemies = Object.values(ctx.battleState.units)
          .filter(u => u.isEnemy)
          .map(u => u.id);
        if (enemies.length > 0) {
          targetUnitIds = [enemies[Math.floor(rng() * enemies.length)]];
        }
        break;
      case "adjacent_enemies":
        // TODO: Implement adjacency check
        const nearbyEnemies = Object.values(ctx.battleState.units)
          .filter(u => u.isEnemy)
          .map(u => u.id);
        if (nearbyEnemies.length > 0) {
          targetUnitIds = [nearbyEnemies[0]]; // Placeholder
        }
        break;
      case "all_enemies":
        targetUnitIds = Object.values(ctx.battleState.units)
          .filter(u => u.isEnemy)
          .map(u => u.id);
        break;
      case "hit_target":
        if (ctx.targetUnitId) targetUnitIds = [ctx.targetUnitId];
        break;
      default:
        // Effects without targets (e.g., gain_resource, summon_drone) apply globally
        if (unitId) targetUnitIds = [unitId];
        break;
    }

    // Create result
    results.push({
      modId: def.id,
      modName: def.name,
      effect: scaledEffect,
      targetUnitIds,
      logMessage: `${def.name} triggered: ${def.description}`,
    });
  }

  return results;
}


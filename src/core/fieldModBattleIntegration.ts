// ============================================================================
// FIELD MOD BATTLE INTEGRATION - Wires Field Mods into battle system
// ============================================================================

import { appendBattleLog, type BattleState } from "./battle";
import { getActiveEchoRun, getEchoModifierHardpoints } from "./echoRuns";
import { applyEffectFlowToBattle } from "./effectFlow";
import { emit, type ProcContext, type ProcResult } from "./fieldModProcEngine";
import type { FieldModInstance, FieldModTrigger, HardpointState } from "./fieldMods";
import { getAllFieldModDefs } from "./fieldModDefinitions";
import { getActiveRun } from "./campaignManager";
import { getGameState } from "../state/gameStore";
import type { UnitId } from "./types";

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function hashSeed(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createProcRandom(
  battle: BattleState,
  eventSequence: number,
  resultIndex: number,
  executionIndex: number
) {
  const seed = hashSeed(`${battle.id}:${battle.turnCount}:${eventSequence}:${resultIndex}:${executionIndex}`);
  return createSeededRng(seed);
}

// Get Field Mod state from run
function getFieldModState(): {
  unitHardpoints: Record<UnitId, HardpointState>;
  runInventory: FieldModInstance[];
} {
  const echoRun = getActiveEchoRun();
  if (echoRun) {
    const unitIds = echoRun.squadUnitIds.filter((unitId) => echoRun.unitsById[unitId]);
    return {
      unitHardpoints: getEchoModifierHardpoints(unitIds) as Record<UnitId, HardpointState>,
      runInventory: echoRun.tacticalModifiers,
    };
  }

  const activeRun = getActiveRun();
  const state = getGameState();

  return {
    unitHardpoints: activeRun?.unitHardpoints || state.unitHardpoints || {},
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

  results.forEach((result, resultIndex) => {
    if (result.logMessage) {
      next = appendBattleLog(next, `SLK//MOD    :: ${result.logMessage}`);
    }

    const stackCount = Math.max(1, result.stacks || 1);
    const sourceUnitId = result.ownerUnitId ?? next.activeUnitId ?? null;
    const selectedTargetUnitId = result.targetUnitId ?? null;
    const executeFlow = (amountMultiplier: number, executionIndex: number) => {
      next = applyEffectFlowToBattle(next, result.effectFlow, {
        sourceUnitId,
        selectedTargetUnitId,
        hitTargetUnitId: selectedTargetUnitId,
        isCrit: result.isCrit,
        isKill: result.isKill,
        sourceLabel: result.modName,
        amountMultiplier,
        random: createProcRandom(next, eventSequence, resultIndex, executionIndex),
      });
    };

    if (result.stackMode === "linear") {
      executeFlow(stackCount, 0);
      return;
    }

    for (let executionIndex = 0; executionIndex < stackCount; executionIndex += 1) {
      executeFlow(1, executionIndex);
    }
  });

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
  isCrit = false,
  eventSequence = 0
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
  eventSequence = 0
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
  eventSequence = 0
): BattleState {
  return triggerFieldMods(
    "card_played",
    battle,
    unitId,
    { cardId },
    eventSequence
  );
}

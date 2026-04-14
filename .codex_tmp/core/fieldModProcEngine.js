// ============================================================================
// FIELD MOD PROC ENGINE - Centralized trigger / chance / stack handling
// Shared effect-flow execution happens in fieldModBattleIntegration.ts
// ============================================================================
import { createEffectFlowFromLegacyFieldModEffect } from "./effectFlow";
function createSeededRNG(seed) {
    let state = seed;
    return () => {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state / 0x7fffffff;
    };
}
function getProcSeed(battleId, turnNumber, eventSequence) {
    let hash = 0;
    for (let index = 0; index < battleId.length; index += 1) {
        hash = ((hash << 5) - hash) + battleId.charCodeAt(index);
        hash &= hash;
    }
    return (hash + turnNumber * 1000 + eventSequence) & 0x7fffffff;
}
function gatherApplicableMods(trigger, ctx, allMods, unitHardpoints, _runInventory) {
    const applicable = [];
    if (ctx.triggeringUnitId) {
        const hardpoints = unitHardpoints[ctx.triggeringUnitId] || [null, null];
        for (const mod of hardpoints) {
            if (!mod)
                continue;
            const def = allMods.find((entry) => entry.id === mod.defId);
            if (def && def.trigger === trigger && def.scope === "unit") {
                applicable.push({ def, instance: mod, unitId: ctx.triggeringUnitId });
            }
        }
    }
    const friendlyUnits = Object.values(ctx.battleState.units).filter((unit) => !unit.isEnemy);
    for (const unit of friendlyUnits) {
        const hardpoints = unitHardpoints[unit.id] || [null, null];
        for (const mod of hardpoints) {
            if (!mod)
                continue;
            const def = allMods.find((entry) => entry.id === mod.defId);
            if (def && def.trigger === trigger && def.scope === "squad" && !applicable.find((entry) => entry.instance.instanceId === mod.instanceId)) {
                applicable.push({ def, instance: mod, unitId: unit.id });
            }
        }
    }
    return applicable;
}
export function emit(trigger, ctx, allMods, unitHardpoints, runInventory) {
    const applicable = gatherApplicableMods(trigger, ctx, allMods, unitHardpoints, runInventory);
    if (applicable.length === 0) {
        return [];
    }
    const eventSeq = ctx.eventSequence || 0;
    const seed = getProcSeed(ctx.battleState.id, ctx.battleState.turnCount, eventSeq);
    const rng = createSeededRNG(seed);
    const results = [];
    for (const { def, instance, unitId } of applicable) {
        const procChance = def.chance ?? 1;
        if (rng() >= procChance) {
            continue;
        }
        const effectFlow = def.effectFlow ?? (def.effect ? createEffectFlowFromLegacyFieldModEffect(def.effect) : { version: 1, entryNodeId: null, nodes: [], edges: [] });
        results.push({
            modId: def.id,
            modName: def.name,
            ownerUnitId: unitId,
            effectFlow,
            targetUnitId: ctx.targetUnitId,
            cardId: ctx.cardId,
            isCrit: ctx.isCrit,
            isKill: trigger === "kill",
            stackMode: def.stackMode,
            stacks: instance.stacks,
            logMessage: `${def.name} triggered: ${def.description}`,
        });
    }
    return results;
}

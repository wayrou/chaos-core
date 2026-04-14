import { addStatus, appendBattleLog, advanceTurn, evaluateBattleOutcome, hasStatus, } from "./battle";
function toRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function readString(value, fallback = "") {
    return typeof value === "string" ? value : fallback;
}
function readOptionalString(value) {
    return typeof value === "string" && value.trim() ? value : undefined;
}
function readNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function readSelector(value) {
    switch (value) {
        case "chosen_target":
        case "chosen_tile":
        case "all_allies":
        case "all_enemies":
        case "all_units":
        case "adjacent_enemies":
        case "random_ally":
        case "random_enemy":
        case "lowest_hp_ally":
        case "lowest_hp_enemy":
        case "strongest_enemy":
        case "weakest_enemy":
        case "hit_target":
            return value;
        default:
            return "self";
    }
}
function readOptionalSelector(value) {
    return value === undefined || value === null || value === "" ? undefined : readSelector(value);
}
function readCondition(value) {
    switch (value) {
        case "target_hp_below_percent":
        case "source_hp_below_percent":
        case "target_has_status":
        case "target_missing_status":
        case "source_has_status":
        case "source_missing_status":
        case "target_is_damaged":
        case "hand_size_at_least":
        case "turn_count_at_least":
        case "is_crit":
        case "is_kill":
            return value;
        default:
            return "target_exists";
    }
}
function readAction(value) {
    switch (value) {
        case "heal":
        case "grant_shield":
        case "draw_cards":
        case "modify_stat":
        case "apply_status":
        case "move_target":
        case "knockback":
        case "end_turn":
        case "set_flag":
        case "reduce_cost_next_card":
        case "discard_cards":
        case "exhaust_cards":
        case "restore_strain":
        case "cleanse_statuses":
        case "silence_buffs":
        case "draw_until_hand_size":
        case "gain_resource":
        case "summon_drone":
            return value;
        default:
            return "deal_damage";
    }
}
function readEdgeKind(value) {
    return value === "true" || value === "false" ? value : "next";
}
function readStatus(value) {
    switch (value) {
        case "stunned":
        case "burning":
        case "bleeding":
        case "shocked":
        case "slow":
        case "suppressed":
        case "weakened":
        case "vulnerable":
        case "guarded":
        case "marked":
        case "poisoned":
        case "rooted":
        case "immobilized":
        case "dazed":
            return value;
        default:
            return undefined;
    }
}
function readStat(value) {
    return value === "atk" || value === "def" || value === "agi" || value === "acc" ? value : undefined;
}
function readResource(value) {
    return value === "wood" || value === "stone" || value === "chaos_shards" ? value : undefined;
}
export function normalizeEffectFlowDocument(value) {
    const record = toRecord(value);
    if (!record) {
        return { version: 1, entryNodeId: null, nodes: [], edges: [] };
    }
    const nodes = Array.isArray(record.nodes)
        ? record.nodes.reduce((acc, entry) => {
            const node = toRecord(entry);
            if (!node) {
                return acc;
            }
            const id = readString(node.id).trim();
            if (!id) {
                return acc;
            }
            const family = readString(node.family).trim();
            if (family === "selector") {
                acc.push({
                    id,
                    family: "selector",
                    label: readString(node.label, "Selector"),
                    note: readOptionalString(node.note),
                    selector: readSelector(node.selector),
                });
                return acc;
            }
            if (family === "condition") {
                acc.push({
                    id,
                    family: "condition",
                    label: readString(node.label, "Condition"),
                    note: readOptionalString(node.note),
                    condition: readCondition(node.condition),
                    selector: readOptionalSelector(node.selector),
                    hpThresholdPercent: readNumber(node.hpThresholdPercent),
                    status: readStatus(node.status),
                    handCountThreshold: readNumber(node.handCountThreshold),
                    turnCountThreshold: readNumber(node.turnCountThreshold),
                });
                return acc;
            }
            if (family === "action") {
                acc.push({
                    id,
                    family: "action",
                    label: readString(node.label, "Action"),
                    note: readOptionalString(node.note),
                    action: readAction(node.action),
                    selector: readOptionalSelector(node.selector),
                    amount: readNumber(node.amount),
                    duration: readNumber(node.duration),
                    tiles: readNumber(node.tiles),
                    stat: readStat(node.stat),
                    modifierMode: node.modifierMode === "debuff" ? "debuff" : node.modifierMode === "buff" ? "buff" : undefined,
                    status: readStatus(node.status),
                    flagKey: readOptionalString(node.flagKey),
                    flagValue: readOptionalString(node.flagValue),
                    resource: readResource(node.resource),
                    droneTypeId: readOptionalString(node.droneTypeId),
                    count: readNumber(node.count),
                    handCountThreshold: readNumber(node.handCountThreshold),
                });
            }
            return acc;
        }, [])
        : [];
    const nodeIdSet = new Set(nodes.map((node) => node.id));
    const edges = Array.isArray(record.edges)
        ? record.edges
            .map((entry) => {
            const edge = toRecord(entry);
            if (!edge) {
                return null;
            }
            const fromNodeId = readString(edge.fromNodeId).trim();
            const toNodeId = readString(edge.toNodeId).trim();
            if (!fromNodeId || !toNodeId || !nodeIdSet.has(fromNodeId) || !nodeIdSet.has(toNodeId)) {
                return null;
            }
            return {
                id: readString(edge.id, `${fromNodeId}_${toNodeId}_${readEdgeKind(edge.kind)}`),
                fromNodeId,
                toNodeId,
                kind: readEdgeKind(edge.kind),
            };
        })
            .filter((edge) => edge !== null)
        : [];
    const entryNodeId = readOptionalString(record.entryNodeId);
    return {
        version: 1,
        entryNodeId: entryNodeId && nodeIdSet.has(entryNodeId) ? entryNodeId : nodes[0]?.id ?? null,
        nodes,
        edges,
    };
}
function selectorForCardTarget(targetType) {
    switch (targetType) {
        case "enemy":
        case "ally":
            return "chosen_target";
        case "tile":
            return "chosen_tile";
        default:
            return "self";
    }
}
function legacyStatusFromCardEffect(type) {
    switch (type) {
        case "stun":
            return "stunned";
        case "burn":
            return "burning";
        default:
            return undefined;
    }
}
function actionNodeFromCardEffect(effect, targetType, index) {
    const selector = selectorForCardTarget(targetType);
    switch (effect.type) {
        case "damage":
            return { id: `legacy_card_${index + 1}`, family: "action", label: "Deal Damage", action: "deal_damage", selector, amount: effect.amount };
        case "heal":
            return { id: `legacy_card_${index + 1}`, family: "action", label: "Heal", action: "heal", selector, amount: effect.amount };
        case "def_up":
        case "atk_up":
        case "agi_up":
        case "acc_up":
            return {
                id: `legacy_card_${index + 1}`,
                family: "action",
                label: "Buff Stat",
                action: "modify_stat",
                selector,
                amount: effect.amount,
                duration: effect.duration,
                stat: effect.type.replace("_up", ""),
                modifierMode: "buff",
            };
        case "def_down":
        case "atk_down":
        case "agi_down":
        case "acc_down":
            return {
                id: `legacy_card_${index + 1}`,
                family: "action",
                label: "Debuff Stat",
                action: "modify_stat",
                selector,
                amount: effect.amount,
                duration: effect.duration,
                stat: effect.type.replace("_down", ""),
                modifierMode: "debuff",
            };
        case "push":
            return { id: `legacy_card_${index + 1}`, family: "action", label: "Knockback", action: "knockback", selector, tiles: effect.tiles ?? effect.amount };
        case "move":
            return { id: `legacy_card_${index + 1}`, family: "action", label: "Move Target", action: "move_target", selector, tiles: effect.tiles ?? effect.amount };
        case "stun":
        case "burn":
            return {
                id: `legacy_card_${index + 1}`,
                family: "action",
                label: "Apply Status",
                action: "apply_status",
                selector,
                status: legacyStatusFromCardEffect(effect.type),
                duration: effect.duration ?? 1,
            };
        case "end_turn":
            return { id: `legacy_card_${index + 1}`, family: "action", label: "End Turn", action: "end_turn", selector };
        case "set_flag":
            return {
                id: `legacy_card_${index + 1}`,
                family: "action",
                label: "Set Flag",
                action: "set_flag",
                flagKey: effect.stat,
                flagValue: effect.amount !== undefined ? String(effect.amount) : "true",
            };
        default:
            return { id: `legacy_card_${index + 1}`, family: "action", label: "Deal Damage", action: "deal_damage", selector, amount: effect.amount };
    }
}
export function createEffectFlowFromLegacyCardEffects(effects, targetType) {
    if (effects.length === 0) {
        return { version: 1, entryNodeId: null, nodes: [], edges: [] };
    }
    const nodes = effects.map((effect, index) => actionNodeFromCardEffect(effect, targetType, index));
    const edges = nodes.slice(0, -1).map((node, index) => ({
        id: `legacy_card_edge_${index + 1}`,
        fromNodeId: node.id,
        toNodeId: nodes[index + 1].id,
        kind: "next",
    }));
    return {
        version: 1,
        entryNodeId: nodes[0]?.id ?? null,
        nodes,
        edges,
    };
}
export function createEffectFlowFromLegacyFieldModEffect(effect) {
    const node = (() => {
        switch (effect.kind) {
            case "deal_damage":
                return {
                    id: "legacy_fieldmod_1",
                    family: "action",
                    label: "Deal Damage",
                    action: "deal_damage",
                    amount: effect.amount,
                    selector: effect.target === "random_enemy" ? "random_enemy" : effect.target === "adjacent_enemies" ? "adjacent_enemies" : "all_enemies",
                };
            case "apply_status":
                return {
                    id: "legacy_fieldmod_1",
                    family: "action",
                    label: "Apply Status",
                    action: "apply_status",
                    selector: effect.target === "hit_target" ? "hit_target" : "random_enemy",
                    status: effect.status === "burn"
                        ? "burning"
                        : effect.status === "slow"
                            ? "suppressed"
                            : effect.status === "shock"
                                ? "dazed"
                                : "bleeding",
                    amount: effect.stacks,
                    duration: effect.stacks,
                };
            case "gain_shield":
                return {
                    id: "legacy_fieldmod_1",
                    family: "action",
                    label: "Grant Shield",
                    action: "grant_shield",
                    amount: effect.amount,
                    selector: effect.target === "all_allies" ? "all_allies" : "self",
                };
            case "draw":
                return {
                    id: "legacy_fieldmod_1",
                    family: "action",
                    label: "Draw Cards",
                    action: "draw_cards",
                    amount: effect.amount,
                    selector: effect.target === "team" ? "all_allies" : "self",
                };
            case "reduce_cost_next_card":
                return {
                    id: "legacy_fieldmod_1",
                    family: "action",
                    label: "Reduce Next Card Cost",
                    action: "reduce_cost_next_card",
                    amount: effect.amount,
                    selector: "self",
                };
            case "gain_resource":
                return {
                    id: "legacy_fieldmod_1",
                    family: "action",
                    label: "Gain Resource",
                    action: "gain_resource",
                    amount: effect.amount,
                    resource: effect.resource,
                };
            case "summon_drone":
                return {
                    id: "legacy_fieldmod_1",
                    family: "action",
                    label: "Summon Drone",
                    action: "summon_drone",
                    count: effect.count,
                    droneTypeId: effect.droneTypeId,
                };
            case "knockback":
                return {
                    id: "legacy_fieldmod_1",
                    family: "action",
                    label: "Knockback",
                    action: "knockback",
                    tiles: effect.tiles,
                    selector: "hit_target",
                };
        }
    })();
    return {
        version: 1,
        entryNodeId: node.id,
        nodes: [node],
        edges: [],
    };
}
function getNodeById(flow, nodeId) {
    return nodeId ? flow.nodes.find((node) => node.id === nodeId) : undefined;
}
function getOutgoingEdges(flow, nodeId) {
    return flow.edges.filter((edge) => edge.fromNodeId === nodeId);
}
function getSourceUnit(state, context) {
    return context.sourceUnitId ? state.units[context.sourceUnitId] ?? null : null;
}
function selectSingleUnit(units, picker) {
    const picked = picker(units);
    return { unitIds: picked ? [picked.id] : [], tile: picked?.pos ?? null };
}
function pickByLowestHp(units) {
    if (units.length === 0) {
        return null;
    }
    return [...units].sort((left, right) => {
        if (left.hp !== right.hp) {
            return left.hp - right.hp;
        }
        return left.id.localeCompare(right.id);
    })[0];
}
function pickByHighestAtk(units) {
    if (units.length === 0) {
        return null;
    }
    return [...units].sort((left, right) => {
        if (left.atk !== right.atk) {
            return right.atk - left.atk;
        }
        return left.id.localeCompare(right.id);
    })[0];
}
function resolveSelection(state, selector, context) {
    const sourceUnit = getSourceUnit(state, context);
    const sourceIsEnemy = sourceUnit?.isEnemy ?? false;
    const rng = context.random ?? Math.random;
    const allies = Object.values(state.units).filter((unit) => unit.isEnemy === sourceIsEnemy);
    const enemies = Object.values(state.units).filter((unit) => unit.isEnemy !== sourceIsEnemy);
    switch (selector) {
        case "self":
            return { unitIds: sourceUnit ? [sourceUnit.id] : [], tile: sourceUnit?.pos ?? null };
        case "chosen_target":
            return { unitIds: context.selectedTargetUnitId ? [context.selectedTargetUnitId] : [], tile: context.selectedTilePos ?? null };
        case "chosen_tile":
            return { unitIds: [], tile: context.selectedTilePos ?? null };
        case "all_allies":
            return { unitIds: allies.map((unit) => unit.id), tile: null };
        case "all_enemies":
            return { unitIds: enemies.map((unit) => unit.id), tile: null };
        case "all_units":
            return { unitIds: Object.values(state.units).map((unit) => unit.id), tile: null };
        case "adjacent_enemies":
            if (!sourceUnit?.pos) {
                return { unitIds: [], tile: null };
            }
            return {
                unitIds: enemies
                    .filter((unit) => unit.pos)
                    .filter((unit) => Math.abs(unit.pos.x - sourceUnit.pos.x) + Math.abs(unit.pos.y - sourceUnit.pos.y) === 1)
                    .map((unit) => unit.id),
                tile: null,
            };
        case "random_ally": {
            if (allies.length === 0) {
                return { unitIds: [], tile: null };
            }
            const selected = allies[Math.floor(rng() * allies.length)];
            return { unitIds: [selected.id], tile: selected.pos ?? null };
        }
        case "random_enemy": {
            if (enemies.length === 0) {
                return { unitIds: [], tile: null };
            }
            const selected = enemies[Math.floor(rng() * enemies.length)];
            return { unitIds: [selected.id], tile: selected.pos ?? null };
        }
        case "lowest_hp_ally":
            return selectSingleUnit(allies, pickByLowestHp);
        case "lowest_hp_enemy":
        case "weakest_enemy":
            return selectSingleUnit(enemies, pickByLowestHp);
        case "strongest_enemy":
            return selectSingleUnit(enemies, pickByHighestAtk);
        case "hit_target":
            return { unitIds: context.hitTargetUnitId ? [context.hitTargetUnitId] : [], tile: null };
    }
}
function getEffectiveSelection(state, currentSelection, selector, context) {
    if (selector) {
        return resolveSelection(state, selector, context);
    }
    if (currentSelection.unitIds.length > 0 || currentSelection.tile) {
        return currentSelection;
    }
    if (context.selectedTargetUnitId) {
        return { unitIds: [context.selectedTargetUnitId], tile: context.selectedTilePos ?? null };
    }
    return resolveSelection(state, "self", context);
}
function scaleValue(value, multiplier) {
    if (value === undefined) {
        return undefined;
    }
    return Math.max(0, Math.round(value * multiplier));
}
function hasLivingUnitAt(state, pos, ignoreUnitId) {
    return Object.values(state.units).some((unit) => unit.id !== ignoreUnitId && unit.hp > 0 && unit.pos && unit.pos.x === pos.x && unit.pos.y === pos.y);
}
function drawExactCards(state, unitId, count) {
    const unit = state.units[unitId];
    if (!unit || count <= 0) {
        return state;
    }
    let drawPile = [...unit.drawPile];
    let discardPile = [...unit.discardPile];
    const hand = [...unit.hand];
    for (let index = 0; index < count; index += 1) {
        if (drawPile.length === 0 && discardPile.length > 0) {
            drawPile = [...discardPile];
            discardPile = [];
        }
        const nextCard = drawPile.shift();
        if (!nextCard) {
            break;
        }
        hand.push(nextCard);
    }
    return {
        ...state,
        units: {
            ...state.units,
            [unitId]: {
                ...unit,
                drawPile,
                discardPile,
                hand,
            },
        },
    };
}
function discardCardsFromHand(state, unitId, count, exhausted = false) {
    const unit = state.units[unitId];
    if (!unit || count <= 0 || unit.hand.length === 0) {
        return state;
    }
    const movedCards = unit.hand.slice(0, count);
    if (movedCards.length === 0) {
        return state;
    }
    return {
        ...state,
        units: {
            ...state.units,
            [unitId]: {
                ...unit,
                hand: unit.hand.slice(movedCards.length),
                discardPile: exhausted ? unit.discardPile : [...unit.discardPile, ...movedCards],
                exhaustedPile: exhausted ? [...unit.exhaustedPile, ...movedCards] : unit.exhaustedPile,
            },
        },
    };
}
function restoreUnitStrain(state, unitId, amount) {
    const unit = state.units[unitId];
    if (!unit || amount <= 0) {
        return state;
    }
    return {
        ...state,
        units: {
            ...state.units,
            [unitId]: {
                ...unit,
                strain: Math.max(0, unit.strain - amount),
            },
        },
    };
}
function cleanseStatuses(state, unitId, status) {
    const unit = state.units[unitId];
    if (!unit?.statuses?.length) {
        return state;
    }
    const nextStatuses = status ? unit.statuses.filter((entry) => entry.type !== statusToBattleStatus(status)) : [];
    return {
        ...state,
        units: {
            ...state.units,
            [unitId]: {
                ...unit,
                statuses: nextStatuses,
            },
        },
    };
}
function silenceUnitBuffs(state, unitId) {
    const unit = state.units[unitId];
    if (!unit || unit.buffs.length === 0) {
        return state;
    }
    return {
        ...state,
        units: {
            ...state.units,
            [unitId]: {
                ...unit,
                buffs: [],
            },
        },
    };
}
function applyDirectDamage(state, targetId, amount, sourceLabel) {
    const target = state.units[targetId];
    if (!target || amount <= 0) {
        return state;
    }
    const newHp = Math.max(0, target.hp - amount);
    let next;
    if (newHp <= 0) {
        const units = { ...state.units };
        delete units[targetId];
        next = {
            ...state,
            units,
            turnOrder: state.turnOrder.filter((id) => id !== targetId),
        };
        next = appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} defeats ${target.name} for ${amount} damage.`);
    }
    else {
        next = {
            ...state,
            units: {
                ...state.units,
                [targetId]: { ...target, hp: newHp },
            },
        };
        next = appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} deals ${amount} damage to ${target.name}.`);
    }
    return evaluateBattleOutcome(next);
}
function statusToBattleStatus(status) {
    switch (status) {
        case "stunned":
        case "burning":
        case "suppressed":
        case "weakened":
        case "vulnerable":
        case "guarded":
        case "marked":
        case "poisoned":
        case "rooted":
        case "immobilized":
        case "dazed":
            return status;
        default:
            return null;
    }
}
function evaluateCondition(state, node, currentSelection, context) {
    const selection = getEffectiveSelection(state, currentSelection, node.selector, context);
    const sourceUnit = getSourceUnit(state, context);
    switch (node.condition) {
        case "target_exists":
            return selection.unitIds.length > 0 || Boolean(selection.tile);
        case "target_hp_below_percent":
            return selection.unitIds.some((unitId) => {
                const unit = state.units[unitId];
                if (!unit) {
                    return false;
                }
                return (unit.hp / unit.maxHp) * 100 <= (node.hpThresholdPercent ?? 50);
            });
        case "source_hp_below_percent":
            return sourceUnit ? (sourceUnit.hp / sourceUnit.maxHp) * 100 <= (node.hpThresholdPercent ?? 50) : false;
        case "target_has_status": {
            const status = statusToBattleStatus(node.status);
            return status ? selection.unitIds.some((unitId) => state.units[unitId] && hasStatus(state.units[unitId], status)) : false;
        }
        case "target_missing_status": {
            const status = statusToBattleStatus(node.status);
            return status ? selection.unitIds.some((unitId) => state.units[unitId] && !hasStatus(state.units[unitId], status)) : false;
        }
        case "source_has_status": {
            const status = statusToBattleStatus(node.status);
            return sourceUnit && status ? hasStatus(sourceUnit, status) : false;
        }
        case "source_missing_status": {
            const status = statusToBattleStatus(node.status);
            return sourceUnit && status ? !hasStatus(sourceUnit, status) : false;
        }
        case "target_is_damaged":
            return selection.unitIds.some((unitId) => {
                const unit = state.units[unitId];
                return unit ? unit.hp < unit.maxHp : false;
            });
        case "hand_size_at_least":
            return sourceUnit ? sourceUnit.hand.length >= (node.handCountThreshold ?? 1) : false;
        case "turn_count_at_least":
            return state.turnCount >= (node.turnCountThreshold ?? 1);
        case "is_crit":
            return Boolean(context.isCrit);
        case "is_kill":
            return Boolean(context.isKill);
    }
}
function moveUnitTo(state, unitId, destination, sourceLabel) {
    const unit = state.units[unitId];
    if (!unit || !unit.pos) {
        return state;
    }
    const clamped = {
        x: Math.max(0, Math.min(state.gridWidth - 1, destination.x)),
        y: Math.max(0, Math.min(state.gridHeight - 1, destination.y)),
    };
    if (hasLivingUnitAt(state, clamped, unitId)) {
        return appendBattleLog(state, `SLK//FLOW  :: ${sourceLabel} could not move ${unit.name}; destination blocked.`);
    }
    return appendBattleLog({
        ...state,
        units: {
            ...state.units,
            [unitId]: {
                ...unit,
                pos: clamped,
            },
        },
    }, `SLK//FLOW  :: ${sourceLabel} repositions ${unit.name}.`);
}
function applyActionNode(state, node, currentSelection, context) {
    const selection = getEffectiveSelection(state, currentSelection, node.selector, context);
    const multiplier = context.amountMultiplier ?? 1;
    const sourceLabel = context.sourceLabel ?? "Effect Flow";
    let next = state;
    switch (node.action) {
        case "deal_damage": {
            const amount = scaleValue(node.amount, multiplier) ?? 0;
            selection.unitIds.forEach((unitId) => {
                next = applyDirectDamage(next, unitId, amount, sourceLabel);
            });
            return next;
        }
        case "heal":
        case "grant_shield": {
            const amount = scaleValue(node.amount, multiplier) ?? 0;
            selection.unitIds.forEach((unitId) => {
                const unit = next.units[unitId];
                if (!unit) {
                    return;
                }
                const newHp = Math.min(unit.maxHp, unit.hp + amount);
                next = {
                    ...next,
                    units: {
                        ...next.units,
                        [unitId]: { ...unit, hp: newHp },
                    },
                };
                next = appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} ${node.action === "heal" ? "heals" : "grants shield to"} ${unit.name} for ${amount}.`);
            });
            return next;
        }
        case "draw_cards": {
            const amount = scaleValue(node.amount, multiplier) ?? 0;
            selection.unitIds.forEach((unitId) => {
                next = drawExactCards(next, unitId, amount);
                const unit = next.units[unitId];
                if (unit) {
                    next = appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} draws ${amount} card(s) for ${unit.name}.`);
                }
            });
            return next;
        }
        case "draw_until_hand_size": {
            const targetHandSize = scaleValue(node.handCountThreshold ?? node.amount, multiplier) ?? 0;
            selection.unitIds.forEach((unitId) => {
                const unit = next.units[unitId];
                if (!unit) {
                    return;
                }
                const cardsNeeded = Math.max(0, targetHandSize - unit.hand.length);
                next = drawExactCards(next, unitId, cardsNeeded);
                const updatedUnit = next.units[unitId];
                if (updatedUnit && cardsNeeded > 0) {
                    next = appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} draws up to ${targetHandSize} cards for ${updatedUnit.name}.`);
                }
            });
            return next;
        }
        case "modify_stat": {
            const amount = scaleValue(node.amount, multiplier) ?? 0;
            const duration = scaleValue(node.duration, multiplier) ?? node.duration ?? 1;
            const stat = node.stat ?? "def";
            const type = `${stat}_${node.modifierMode === "debuff" ? "down" : "up"}`;
            const signedAmount = node.modifierMode === "debuff" ? -amount : amount;
            selection.unitIds.forEach((unitId) => {
                const unit = next.units[unitId];
                if (!unit) {
                    return;
                }
                next = {
                    ...next,
                    units: {
                        ...next.units,
                        [unitId]: {
                            ...unit,
                            buffs: [
                                ...(unit.buffs ?? []),
                                { id: `${type}_${Date.now()}_${unitId}`, type, amount: signedAmount, duration },
                            ],
                        },
                    },
                };
                next = appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} ${signedAmount < 0 ? "reduces" : "boosts"} ${unit.name}'s ${stat.toUpperCase()} by ${Math.abs(signedAmount)}.`);
            });
            return next;
        }
        case "apply_status": {
            const duration = scaleValue(node.duration, multiplier) ?? node.duration ?? 1;
            const status = statusToBattleStatus(node.status);
            if (!status) {
                return appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} references unsupported status '${node.status ?? "unknown"}'.`);
            }
            selection.unitIds.forEach((unitId) => {
                next = addStatus(next, unitId, status, duration, context.sourceUnitId ?? undefined);
                const unit = next.units[unitId];
                if (unit) {
                    next = appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} applies ${status.toUpperCase()} to ${unit.name}.`);
                }
            });
            return next;
        }
        case "move_target": {
            if (selection.unitIds.length === 0 || !context.selectedTilePos) {
                return appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} had no destination tile for move.`);
            }
            return moveUnitTo(next, selection.unitIds[0], context.selectedTilePos, sourceLabel);
        }
        case "knockback": {
            const tiles = scaleValue(node.tiles ?? node.amount, multiplier) ?? 0;
            const sourceUnit = getSourceUnit(next, context);
            selection.unitIds.forEach((unitId) => {
                const target = next.units[unitId];
                if (!target?.pos || !sourceUnit?.pos) {
                    return;
                }
                const dx = Math.sign(target.pos.x - sourceUnit.pos.x);
                const dy = Math.sign(target.pos.y - sourceUnit.pos.y);
                next = moveUnitTo(next, unitId, { x: target.pos.x + dx * tiles, y: target.pos.y + dy * tiles }, sourceLabel);
            });
            return next;
        }
        case "end_turn": {
            const targetUnitId = selection.unitIds[0] ?? context.sourceUnitId ?? null;
            if (targetUnitId && next.activeUnitId === targetUnitId) {
                return appendBattleLog(advanceTurn(next), `SLK//FLOW  :: ${sourceLabel} ends the turn.`);
            }
            return appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} tried to end a non-active turn.`);
        }
        case "set_flag":
            return appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} sets flag ${node.flagKey ?? "flag"} = ${node.flagValue ?? "true"}.`);
        case "reduce_cost_next_card":
            return appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} reduces the next card cost by ${scaleValue(node.amount, multiplier) ?? 0}.`);
        case "discard_cards": {
            const amount = scaleValue(node.amount, multiplier) ?? 0;
            selection.unitIds.forEach((unitId) => {
                next = discardCardsFromHand(next, unitId, amount, false);
                const unit = next.units[unitId];
                if (unit) {
                    next = appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} discards ${amount} card(s) from ${unit.name}.`);
                }
            });
            return next;
        }
        case "exhaust_cards": {
            const amount = scaleValue(node.amount, multiplier) ?? 0;
            selection.unitIds.forEach((unitId) => {
                next = discardCardsFromHand(next, unitId, amount, true);
                const unit = next.units[unitId];
                if (unit) {
                    next = appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} exhausts ${amount} card(s) from ${unit.name}.`);
                }
            });
            return next;
        }
        case "restore_strain": {
            const amount = scaleValue(node.amount, multiplier) ?? 0;
            selection.unitIds.forEach((unitId) => {
                next = restoreUnitStrain(next, unitId, amount);
                const unit = next.units[unitId];
                if (unit) {
                    next = appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} restores ${amount} strain on ${unit.name}.`);
                }
            });
            return next;
        }
        case "cleanse_statuses": {
            selection.unitIds.forEach((unitId) => {
                next = cleanseStatuses(next, unitId, node.status);
                const unit = next.units[unitId];
                if (unit) {
                    next = appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} ${node.status ? `cleanses ${node.status}` : "cleanses statuses"} from ${unit.name}.`);
                }
            });
            return next;
        }
        case "silence_buffs": {
            selection.unitIds.forEach((unitId) => {
                next = silenceUnitBuffs(next, unitId);
                const unit = next.units[unitId];
                if (unit) {
                    next = appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} silences buffs on ${unit.name}.`);
                }
            });
            return next;
        }
        case "gain_resource":
            return appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} grants ${scaleValue(node.amount, multiplier) ?? 0} ${node.resource ?? "resource"}.`);
        case "summon_drone":
            return appendBattleLog(next, `SLK//FLOW  :: ${sourceLabel} summons ${scaleValue(node.count, multiplier) ?? 0} ${node.droneTypeId ?? "drone"} unit(s).`);
    }
}
export function applyEffectFlowToBattle(state, flowDocument, context) {
    const flow = normalizeEffectFlowDocument(flowDocument);
    if (!flow.entryNodeId) {
        return state;
    }
    let next = state;
    let currentSelection = { unitIds: [], tile: null };
    let currentNodeId = flow.entryNodeId;
    let guard = 0;
    while (currentNodeId && guard < Math.max(32, flow.nodes.length * 4)) {
        guard += 1;
        const node = getNodeById(flow, currentNodeId);
        if (!node) {
            break;
        }
        if (node.family === "selector") {
            currentSelection = resolveSelection(next, node.selector, context);
            currentNodeId = getOutgoingEdges(flow, node.id).find((edge) => edge.kind === "next")?.toNodeId ?? null;
            continue;
        }
        if (node.family === "condition") {
            const passed = evaluateCondition(next, node, currentSelection, context);
            currentNodeId =
                getOutgoingEdges(flow, node.id).find((edge) => edge.kind === (passed ? "true" : "false"))?.toNodeId ?? null;
            continue;
        }
        next = applyActionNode(next, node, currentSelection, context);
        currentNodeId = getOutgoingEdges(flow, node.id).find((edge) => edge.kind === "next")?.toNodeId ?? null;
    }
    return evaluateBattleOutcome(next);
}

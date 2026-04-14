// ============================================================================
// WEAPON SYSTEM - Runtime State, Node Damage, Heat/Ammo/Wear Tracking
// Headline 14b: Weapon Mechanics
// ============================================================================
const EMPTY_QUEUED_MODIFIER_STATE = {
    strainDelta: 0,
    accuracyDelta: 0,
    damageDelta: 0,
};
const EMPTY_MODIFIER_SNAPSHOT = {
    accuracyDelta: 0,
    damageDelta: 0,
    damageMultiplier: 1,
    strainDelta: 0,
    ignoreDef: 0,
    ignoreCover: false,
    rangeDelta: 0,
    rangeOverride: null,
    extraAttacks: [],
    statusesOnHit: [],
    pullTargetTiles: 0,
    pullSelfTiles: 0,
    moveBeforeAttackTiles: 0,
    freeAttackMove: false,
    splashDamageInRange: 0,
    selfBuffs: [],
    selfDebuffs: [],
    unsupportedNotes: [],
    forceOverheat: false,
};
export const WEAPON_NODE_NAMES = {
    1: { primary: "SIGHTS", alt: "STABILIZER" },
    2: { primary: "BARREL", alt: "EMITTER / EDGE" },
    3: { primary: "ACTION", alt: "DRAW / SERVO" },
    4: { primary: "POWER COUPLING", alt: "TENSIONER" },
    5: { primary: "HEAT SINK", alt: "ARRAY" },
    6: { primary: "FEED PATH", alt: "MAG LATCH / QUIVER" },
};
export const NODE_DAMAGE_EFFECTS = {
    1: {
        damaged: "-1 ACC with this weapon; Overwatch -2 ACC",
        broken: "-2 ACC and cannot Overwatch",
    },
    2: {
        damaged: "Range -1; AoE radius -1; melee attacks deal -1 damage",
        broken: "AoE / arc cards are unusable; melee attacks deal -1 damage",
    },
    3: {
        damaged: "Multi-attack cards are unplayable",
        broken: "Weapon cards can jam on use",
    },
    4: {
        damaged: "First weapon card each turn costs +1 Strain",
        broken: "Attacks gain +1 Heat or +1 Strain if heatless",
    },
    5: {
        damaged: "Max Heat -2; heat removal effects are reduced by 1",
        broken: "Cannot remove more than 1 Heat per turn",
    },
    6: {
        damaged: "Ammo cost +1; Quick Reload restores 1 fewer",
        broken: "Quick Reload fails; Full Reload restores half",
    },
};
function cloneState(state) {
    return {
        ...state,
        nodes: { ...state.nodes },
        activeClutchIds: [...state.activeClutchIds],
        queuedModifier: { ...state.queuedModifier },
    };
}
export function getWeaponClutches(weapon) {
    if (weapon.clutches && weapon.clutches.length > 0) {
        return weapon.clutches;
    }
    const clutches = [];
    if (weapon.clutchToggle) {
        clutches.push({
            id: "primary_clutch",
            label: "Clutch",
            description: weapon.clutchToggle,
            effects: [],
        });
    }
    if (weapon.doubleClutch) {
        clutches.push({
            id: "secondary_clutch",
            label: "Double Clutch",
            description: weapon.doubleClutch,
            effects: [],
        });
    }
    return clutches;
}
export function getWeaponHeatProfile(weapon) {
    if (weapon.heatProfile) {
        return weapon.heatProfile;
    }
    if (!weapon.isMechanical || !weapon.heatCapacity) {
        return null;
    }
    return {
        capacity: weapon.heatCapacity,
        passiveDecay: weapon.passiveHeatDecay ?? 1,
        zones: (weapon.heatZones ?? []).map((zone) => ({
            min: zone.min,
            max: zone.max,
            name: zone.name,
            effectText: zone.effect,
        })),
        overheatSummary: "Weapon overheats and must recover before it can be used again.",
        overheatEffects: [{ kind: "jam_turns", turns: 1 }],
    };
}
export function getWeaponAmmoProfile(weapon) {
    if (weapon.ammoProfile) {
        return weapon.ammoProfile;
    }
    if (!weapon.ammoMax) {
        return null;
    }
    return {
        max: weapon.ammoMax,
        quickReloadStrain: weapon.quickReloadStrain ?? 1,
        fullReloadStrain: weapon.fullReloadStrain ?? 0,
        defaultAttackAmmoCost: 1,
    };
}
function syncLegacyClutchFlags(state, weapon) {
    const clutchIds = weapon ? getWeaponClutches(weapon).map((clutch) => clutch.id) : [];
    const primaryId = clutchIds[0];
    const secondaryId = clutchIds[1];
    return {
        ...state,
        clutchActive: primaryId ? state.activeClutchIds.includes(primaryId) : state.activeClutchIds.length > 0,
        doubleClutchActive: secondaryId ? state.activeClutchIds.includes(secondaryId) : state.activeClutchIds.length > 1,
    };
}
export function createWeaponRuntimeState(weapon) {
    const ammoProfile = getWeaponAmmoProfile(weapon);
    return syncLegacyClutchFlags({
        equipmentId: weapon.id,
        currentHeat: 0,
        currentAmmo: ammoProfile?.max ?? 0,
        wear: weapon.wear ?? 0,
        nodes: {
            1: "ok",
            2: "ok",
            3: "ok",
            4: "ok",
            5: "ok",
            6: "ok",
        },
        activeClutchIds: [],
        queuedModifier: { ...EMPTY_QUEUED_MODIFIER_STATE },
        jammedTurnsRemaining: 0,
        disabledTurnsRemaining: 0,
        weaponCardLockTurnsRemaining: 0,
        skipAttackTurnsRemaining: 0,
        maxHeatPenalty: 0,
        totalHeatRemovedThisTurn: 0,
        firstWeaponCardPlayedThisTurn: false,
        allowMoveAfterAttack: false,
        isJammed: false,
        clutchActive: false,
        doubleClutchActive: false,
    }, weapon);
}
export function hasActiveClutch(state) {
    return state.activeClutchIds.length > 0;
}
export function activateClutch(state, weapon) {
    const clutchId = weapon ? getWeaponClutches(weapon)[0]?.id : "primary_clutch";
    if (!clutchId || state.activeClutchIds.includes(clutchId)) {
        return syncLegacyClutchFlags(state, weapon);
    }
    return syncLegacyClutchFlags({
        ...state,
        activeClutchIds: [...state.activeClutchIds, clutchId],
    }, weapon);
}
export function deactivateClutch(state, weapon) {
    const clutchId = weapon ? getWeaponClutches(weapon)[0]?.id : "primary_clutch";
    if (!clutchId) {
        return syncLegacyClutchFlags(state, weapon);
    }
    return syncLegacyClutchFlags({
        ...state,
        activeClutchIds: state.activeClutchIds.filter((id) => id !== clutchId),
    }, weapon);
}
export function activateDoubleClutch(state, weapon) {
    const clutchId = weapon ? getWeaponClutches(weapon)[1]?.id : "secondary_clutch";
    if (!clutchId || state.activeClutchIds.includes(clutchId)) {
        return syncLegacyClutchFlags(state, weapon);
    }
    return syncLegacyClutchFlags({
        ...state,
        activeClutchIds: [...state.activeClutchIds, clutchId],
    }, weapon);
}
export function deactivateDoubleClutch(state, weapon) {
    const clutchId = weapon ? getWeaponClutches(weapon)[1]?.id : "secondary_clutch";
    if (!clutchId) {
        return syncLegacyClutchFlags(state, weapon);
    }
    return syncLegacyClutchFlags({
        ...state,
        activeClutchIds: state.activeClutchIds.filter((id) => id !== clutchId),
    }, weapon);
}
export function toggleWeaponClutch(state, weapon, clutchId) {
    const next = state.activeClutchIds.includes(clutchId)
        ? { ...state, activeClutchIds: state.activeClutchIds.filter((id) => id !== clutchId) }
        : { ...state, activeClutchIds: [...state.activeClutchIds, clutchId] };
    return syncLegacyClutchFlags(next, weapon);
}
export function resetClutches(state, weapon) {
    return syncLegacyClutchFlags({
        ...state,
        activeClutchIds: [],
    }, weapon);
}
export function commitClutchWear(state) {
    return state;
}
export function getWearPenalties(wear) {
    if (wear <= 0) {
        return { accPenalty: 0, dmgPenalty: 0 };
    }
    if (wear === 1) {
        return { accPenalty: 1, dmgPenalty: 0 };
    }
    return { accPenalty: wear, dmgPenalty: wear };
}
export function getEffectiveMaxHeat(state, weapon) {
    const heatProfile = getWeaponHeatProfile(weapon);
    if (!heatProfile) {
        return 0;
    }
    const nodePenalty = state.nodes[5] === "damaged" || state.nodes[5] === "broken" ? 2 : 0;
    return Math.max(1, heatProfile.capacity - nodePenalty - state.maxHeatPenalty);
}
export function getHeatZoneProfile(state, weapon) {
    const heatProfile = getWeaponHeatProfile(weapon);
    if (!heatProfile) {
        return null;
    }
    return (heatProfile.zones.find((zone) => state.currentHeat >= zone.min && state.currentHeat <= zone.max) ??
        heatProfile.zones[heatProfile.zones.length - 1] ??
        null);
}
export function getHeatZone(state, weapon) {
    const profile = getHeatZoneProfile(state, weapon);
    const heatProfile = getWeaponHeatProfile(weapon);
    if (!profile || !heatProfile || heatProfile.zones.length <= 1) {
        return "stable";
    }
    if (profile === heatProfile.zones[0]) {
        return "stable";
    }
    if (profile === heatProfile.zones[heatProfile.zones.length - 1]) {
        return "critical";
    }
    return "warning";
}
export function getHeatZoneColor(zone) {
    switch (zone) {
        case "stable":
            return "#4ade80";
        case "warning":
            return "#fbbf24";
        case "critical":
        default:
            return "#ef4444";
    }
}
export function getAccuracyPenalty(state) {
    let penalty = getWearPenalties(state.wear).accPenalty;
    if (state.nodes[1] === "damaged") {
        penalty += 1;
    }
    else if (state.nodes[1] === "broken" || state.nodes[1] === "destroyed") {
        penalty += 2;
    }
    return penalty;
}
export function getDamagePenalty(state) {
    let penalty = getWearPenalties(state.wear).dmgPenalty;
    if (state.nodes[2] === "damaged" || state.nodes[2] === "broken") {
        penalty += 1;
    }
    return penalty;
}
function applyClutchEffect(snapshot, effect) {
    const next = { ...snapshot };
    switch (effect.kind) {
        case "accuracy":
            next.accuracyDelta += effect.amount;
            return next;
        case "damage":
            next.damageDelta += effect.amount;
            return next;
        case "damage_multiplier":
            next.damageMultiplier *= effect.multiplier;
            return next;
        case "ignore_def":
            next.ignoreDef += effect.amount;
            return next;
        case "ignore_cover":
            next.ignoreCover = true;
            return next;
        case "range_delta":
            next.rangeDelta += effect.amount;
            return next;
        case "range_override":
            next.rangeOverride = effect.amount;
            return next;
        case "extra_attack":
            next.extraAttacks = [
                ...next.extraAttacks,
                { count: effect.count, accuracyDelta: effect.accuracyDelta ?? 0, damageDelta: effect.damageDelta ?? 0 },
            ];
            return next;
        case "apply_status_on_hit":
            next.statusesOnHit = [...next.statusesOnHit, { status: effect.status, duration: effect.duration }];
            return next;
        case "pull_target":
            next.pullTargetTiles = Math.max(next.pullTargetTiles, effect.tiles);
            return next;
        case "pull_self":
            next.pullSelfTiles = Math.max(next.pullSelfTiles, effect.tiles);
            return next;
        case "move_before_attack":
            next.moveBeforeAttackTiles = Math.max(next.moveBeforeAttackTiles, effect.tiles);
            return next;
        case "free_attack_move":
            next.freeAttackMove = true;
            return next;
        case "line_attack":
            return next;
        case "splash_in_range":
            next.splashDamageInRange = Math.max(next.splashDamageInRange, effect.amount);
            return next;
        case "self_buff":
            next.selfBuffs = [...next.selfBuffs, { stat: effect.stat, amount: effect.amount, duration: effect.duration }];
            return next;
        case "self_debuff":
            next.selfDebuffs = [...next.selfDebuffs, { stat: effect.stat, amount: effect.amount, duration: effect.duration }];
            return next;
        case "next_card_modifier":
            next.strainDelta += effect.strainDelta ?? 0;
            next.accuracyDelta += effect.accuracyDelta ?? 0;
            next.damageDelta += effect.damageDelta ?? 0;
            return next;
        case "unsupported":
            next.unsupportedNotes = [...next.unsupportedNotes, effect.note];
            return next;
        default:
            return next;
    }
}
export function getWeaponCardModifierSnapshot(state, weapon, cardRules) {
    const snapshot = cloneState(state);
    const result = {
        ...EMPTY_MODIFIER_SNAPSHOT,
        accuracyDelta: -getAccuracyPenalty(snapshot),
        damageDelta: -getDamagePenalty(snapshot),
    };
    if (snapshot.nodes[2] === "damaged" && (cardRules?.tags.includes("attack") ?? false)) {
        result.rangeDelta -= 1;
    }
    const heatZone = getHeatZoneProfile(snapshot, weapon);
    if (heatZone?.modifiers) {
        result.accuracyDelta += heatZone.modifiers.accuracyDelta ?? 0;
        result.damageDelta += heatZone.modifiers.damageDelta ?? 0;
        result.forceOverheat = Boolean(heatZone.modifiers.nextShotOverheats);
    }
    const clutchMap = new Map(getWeaponClutches(weapon).map((clutch) => [clutch.id, clutch]));
    snapshot.activeClutchIds.forEach((clutchId) => {
        const clutch = clutchMap.get(clutchId);
        if (!clutch) {
            return;
        }
        clutch.effects.forEach((effect) => {
            const updated = applyClutchEffect(result, effect);
            Object.assign(result, updated);
        });
    });
    result.accuracyDelta += snapshot.queuedModifier.accuracyDelta;
    result.damageDelta += snapshot.queuedModifier.damageDelta;
    result.strainDelta += snapshot.queuedModifier.strainDelta;
    return result;
}
export function canUseOverwatch(state) {
    return state.nodes[1] !== "broken" && state.nodes[1] !== "destroyed";
}
export function canUseMultiAttack(state) {
    return state.nodes[3] === "ok";
}
export function checkWeaponJam(state) {
    return state.nodes[3] === "broken" && Math.random() < 0.33;
}
export function getExtraStrainCost(state, isFirstWeaponCardThisTurn) {
    if (isFirstWeaponCardThisTurn &&
        (state.nodes[4] === "damaged" || state.nodes[4] === "broken")) {
        return 1;
    }
    return 0;
}
export function isWeaponDestroyed(state) {
    return Object.values(state.nodes).some((status) => status === "destroyed");
}
export function getWeaponCardAmmoCost(state, weapon, cardRules) {
    const ammoProfile = getWeaponAmmoProfile(weapon);
    if (!ammoProfile) {
        return 0;
    }
    let amount = cardRules?.ammoCost ?? ammoProfile.defaultAttackAmmoCost;
    if (state.nodes[6] === "damaged" || state.nodes[6] === "broken") {
        amount += 1;
    }
    return Math.max(0, amount);
}
export function getWeaponCardHeatDelta(state, weapon, cardRules) {
    const heatProfile = getWeaponHeatProfile(weapon);
    if (!heatProfile) {
        return 0;
    }
    let amount = cardRules?.heatDelta ?? 0;
    if (state.nodes[4] === "broken" && amount > 0) {
        amount += 1;
    }
    return amount;
}
export function getWeaponCardBlockReason(state, weapon, cardRules) {
    if (!cardRules) {
        return null;
    }
    if (isWeaponDestroyed(state)) {
        return "Weapon offline";
    }
    if (state.disabledTurnsRemaining > 0) {
        return `Weapon disabled (${state.disabledTurnsRemaining}T)`;
    }
    if (state.weaponCardLockTurnsRemaining > 0 && cardRules.tags.includes("weapon_card")) {
        return `Weapon cards locked (${state.weaponCardLockTurnsRemaining}T)`;
    }
    if (state.isJammed || state.jammedTurnsRemaining > 0) {
        return "Weapon jammed";
    }
    if (state.skipAttackTurnsRemaining > 0 && cardRules.tags.includes("attack")) {
        return `Attack skipped (${state.skipAttackTurnsRemaining}T)`;
    }
    if (state.nodes[3] === "damaged" && cardRules.tags.includes("multi_attack")) {
        return "Action node damaged";
    }
    if ((state.nodes[2] === "broken" || state.nodes[2] === "destroyed") && cardRules.tags.includes("aoe")) {
        return "Barrel node broken";
    }
    const ammoCost = getWeaponCardAmmoCost(state, weapon, cardRules);
    if (ammoCost > 0 && state.currentAmmo < ammoCost) {
        return `Ammo ${state.currentAmmo}/${ammoCost}`;
    }
    return null;
}
export function getWeaponActionDisabledReason(action, state, weapon) {
    const ammoProfile = getWeaponAmmoProfile(weapon);
    const heatProfile = getWeaponHeatProfile(weapon);
    if (action !== "field_patch" && isWeaponDestroyed(state)) {
        return "Weapon offline";
    }
    if (action === "quick_reload") {
        if (!ammoProfile)
            return "No ammo system";
        if (state.currentAmmo >= ammoProfile.max)
            return "Ammo full";
        if (state.nodes[6] === "broken")
            return "Feed path broken";
        return null;
    }
    if (action === "full_reload") {
        if (!ammoProfile)
            return "No ammo system";
        if (state.currentAmmo >= ammoProfile.max)
            return "Ammo full";
        return null;
    }
    if (action === "vent") {
        if (!heatProfile)
            return "No heat system";
        if (state.currentHeat <= 0)
            return "Weapon cool";
        return null;
    }
    if (action === "field_patch") {
        const patchable = [1, 2, 3, 4, 5, 6].some((nodeId) => state.nodes[nodeId] === "damaged" || state.nodes[nodeId] === "broken");
        return patchable ? null : "No patchable damage";
    }
    return null;
}
export function addHeat(state, weapon, amount) {
    const heatProfile = getWeaponHeatProfile(weapon);
    if (!heatProfile || amount === 0) {
        return state;
    }
    const next = cloneState(state);
    next.currentHeat = Math.max(0, Math.min(getEffectiveMaxHeat(next, weapon), next.currentHeat + amount));
    return next;
}
export function removeHeat(state, amount, options = {}) {
    if (amount <= 0) {
        return state;
    }
    const next = cloneState(state);
    let effective = amount;
    if (next.nodes[5] === "damaged") {
        effective = Math.max(0, effective - 1);
    }
    if (next.nodes[5] === "broken") {
        const remainingRemoval = Math.max(0, 1 - next.totalHeatRemovedThisTurn);
        effective = Math.min(effective, remainingRemoval);
    }
    if (effective <= 0) {
        return next;
    }
    next.currentHeat = Math.max(0, next.currentHeat - effective);
    next.totalHeatRemovedThisTurn += effective;
    if (options.repairHeatSink) {
        return repairNode(next, 5);
    }
    return next;
}
export function passiveCooling(state, weapon) {
    if (!weapon) {
        return removeHeat(state, 1);
    }
    const heatProfile = getWeaponHeatProfile(weapon);
    return removeHeat(state, heatProfile?.passiveDecay ?? 1);
}
export function useAmmo(state, weapon, amount = 1) {
    const ammoProfile = getWeaponAmmoProfile(weapon);
    if (!ammoProfile || amount <= 0) {
        return state;
    }
    const next = cloneState(state);
    next.currentAmmo = Math.max(0, next.currentAmmo - amount);
    return next;
}
export function quickReload(state, weapon) {
    const ammoProfile = getWeaponAmmoProfile(weapon);
    if (!ammoProfile) {
        return { state, strainCost: 0 };
    }
    if (state.nodes[6] === "broken") {
        return { state, strainCost: ammoProfile.quickReloadStrain };
    }
    let reloadAmount = Math.ceil(ammoProfile.max / 2);
    if (state.nodes[6] === "damaged") {
        reloadAmount = Math.max(1, reloadAmount - 1);
    }
    let next = cloneState(state);
    next.currentAmmo = Math.min(ammoProfile.max, next.currentAmmo + reloadAmount);
    next = repairNode(next, 6);
    return { state: next, strainCost: ammoProfile.quickReloadStrain };
}
export function fullReload(state, weapon) {
    const ammoProfile = getWeaponAmmoProfile(weapon);
    if (!ammoProfile) {
        return { state, strainCost: 0 };
    }
    let next = cloneState(state);
    const reloadAmount = state.nodes[6] === "broken" ? Math.ceil(ammoProfile.max / 2) : ammoProfile.max;
    next.currentAmmo = Math.min(ammoProfile.max, reloadAmount);
    next = repairNode(next, 6);
    return { state: next, strainCost: ammoProfile.fullReloadStrain };
}
export function fieldPatch(state) {
    const targetNode = [1, 2, 3, 4, 5, 6].find((nodeId) => state.nodes[nodeId] === "damaged" || state.nodes[nodeId] === "broken");
    if (!targetNode) {
        return { state, strainCost: 0, repairedNodeId: null };
    }
    return {
        state: repairNode(state, targetNode),
        strainCost: 1,
        repairedNodeId: targetNode,
    };
}
export function ventWeapon(state, _weapon) {
    let next = cloneState(state);
    next.currentHeat = 0;
    next.totalHeatRemovedThisTurn = Math.max(next.totalHeatRemovedThisTurn, state.currentHeat);
    next = repairNode(next, 5);
    return {
        state: next,
        hpCostPercent: 0.1,
    };
}
export function rollWeaponHit(wasCrit) {
    if (wasCrit) {
        return true;
    }
    return Math.floor(Math.random() * 6) + 1 === 6;
}
export function rollWeaponNodeHit() {
    return (Math.floor(Math.random() * 6) + 1);
}
export function damageNode(state, nodeId) {
    const next = cloneState(state);
    const currentStatus = next.nodes[nodeId];
    const newStatus = currentStatus === "ok"
        ? "damaged"
        : currentStatus === "damaged"
            ? "broken"
            : currentStatus === "broken"
                ? "destroyed"
                : "destroyed";
    next.nodes[nodeId] = newStatus;
    return next;
}
export function repairNode(state, nodeId) {
    const next = cloneState(state);
    const currentStatus = next.nodes[nodeId];
    const newStatus = currentStatus === "destroyed"
        ? "broken"
        : currentStatus === "broken"
            ? "damaged"
            : currentStatus === "damaged"
                ? "ok"
                : "ok";
    next.nodes[nodeId] = newStatus;
    return next;
}
export function markWeaponCardPlayed(state, weapon, cardRules) {
    const next = cloneState(state);
    next.firstWeaponCardPlayedThisTurn = true;
    if (cardRules?.clutchCompatible && hasActiveClutch(next)) {
        next.wear += 1;
    }
    return syncLegacyClutchFlags(next, weapon);
}
export function consumeQueuedModifier(state) {
    return {
        ...state,
        queuedModifier: { ...EMPTY_QUEUED_MODIFIER_STATE },
    };
}
export function advanceWeaponTurn(state, weapon) {
    let next = cloneState(state);
    next.jammedTurnsRemaining = Math.max(0, next.jammedTurnsRemaining - 1);
    next.disabledTurnsRemaining = Math.max(0, next.disabledTurnsRemaining - 1);
    next.weaponCardLockTurnsRemaining = Math.max(0, next.weaponCardLockTurnsRemaining - 1);
    next.skipAttackTurnsRemaining = Math.max(0, next.skipAttackTurnsRemaining - 1);
    next.isJammed = next.jammedTurnsRemaining > 0;
    next.totalHeatRemovedThisTurn = 0;
    next.firstWeaponCardPlayedThisTurn = false;
    next.allowMoveAfterAttack = false;
    next.queuedModifier = { ...EMPTY_QUEUED_MODIFIER_STATE };
    next = passiveCooling(next, weapon);
    return syncLegacyClutchFlags(next, weapon);
}
export function triggerWeaponOverheat(state, weapon) {
    const heatProfile = getWeaponHeatProfile(weapon);
    if (!heatProfile) {
        return { state, effects: [], summary: "" };
    }
    let next = cloneState(state);
    next.currentHeat = 0;
    heatProfile.overheatEffects.forEach((effect) => {
        switch (effect.kind) {
            case "jam_turns":
                next.jammedTurnsRemaining = Math.max(next.jammedTurnsRemaining, effect.turns);
                next.isJammed = next.jammedTurnsRemaining > 0;
                break;
            case "weapon_card_lock_turns":
                next.weaponCardLockTurnsRemaining = Math.max(next.weaponCardLockTurnsRemaining, effect.turns);
                break;
            case "weapon_disable_turns":
                next.disabledTurnsRemaining = Math.max(next.disabledTurnsRemaining, effect.turns);
                break;
            case "skip_attack_turns":
                next.skipAttackTurnsRemaining = Math.max(next.skipAttackTurnsRemaining, effect.turns);
                break;
            case "waste_ammo":
                next.currentAmmo = Math.max(0, next.currentAmmo - effect.amount);
                break;
            case "reduce_max_heat":
                next.maxHeatPenalty += effect.amount;
                break;
            default:
                break;
        }
    });
    return {
        state: syncLegacyClutchFlags(next, weapon),
        effects: heatProfile.overheatEffects,
        summary: heatProfile.overheatSummary,
    };
}

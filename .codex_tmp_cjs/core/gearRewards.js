"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeGearRewardSpec = describeGearRewardSpec;
exports.resolveGearRewardSpec = resolveGearRewardSpec;
exports.resolveGearRewardSpecs = resolveGearRewardSpecs;
exports.grantResolvedGearRewardToState = grantResolvedGearRewardToState;
exports.grantGearRewardSpecsToState = grantGearRewardSpecsToState;
exports.createBattleGearRewardSpec = createBattleGearRewardSpec;
exports.createOperationGearRewardSpecs = createOperationGearRewardSpecs;
const gearCatalog_1 = require("./gearCatalog");
const equipment_1 = require("./equipment");
const gearWorkbench_1 = require("./gearWorkbench");
const generateEndlessGear_1 = require("./endlessGear/generateEndlessGear");
const rng_1 = require("./rng");
const GENERATED_REWARD_LABEL_BY_SLOT = {
    weapon: "Recovered Weapon",
    helmet: "Recovered Helmet",
    chestpiece: "Recovered Chestpiece",
    accessory: "Recovered Accessory",
};
function normalizeRewardSpec(spec) {
    if (typeof spec === "string") {
        return {
            kind: "authored",
            equipmentId: spec,
            preferUnowned: true,
            fallbackToGenerated: true,
        };
    }
    return spec.kind === "authored"
        ? {
            preferUnowned: true,
            fallbackToGenerated: true,
            ...spec,
        }
        : spec;
}
function getEquipmentSlotType(equipment) {
    if (!equipment) {
        return null;
    }
    if (equipment.slot === "accessory") {
        return "accessory";
    }
    return equipment.slot;
}
function getOwnedEquipmentIds(state) {
    const owned = new Set();
    if (!state) {
        return owned;
    }
    for (const equipmentId of state.equipmentPool ?? []) {
        owned.add(equipmentId);
    }
    for (const unit of Object.values(state.unitsById ?? {})) {
        const loadout = unit?.loadout;
        if (!loadout) {
            continue;
        }
        for (const equipmentId of Object.values(loadout)) {
            if (typeof equipmentId === "string" && equipmentId.trim().length > 0) {
                owned.add(equipmentId);
            }
        }
    }
    for (const item of [...(state.inventory?.baseStorage ?? []), ...(state.inventory?.forwardLocker ?? [])]) {
        if (item.kind === "equipment" && typeof item.id === "string" && item.id.trim().length > 0) {
            owned.add(item.id);
        }
    }
    return owned;
}
function getAuthoredGearCandidates(slotType) {
    return Object.values((0, equipment_1.getAllStarterEquipment)()).filter((equipment) => {
        const equipmentSlotType = getEquipmentSlotType(equipment);
        if (!equipmentSlotType) {
            return false;
        }
        if (slotType && equipmentSlotType !== slotType) {
            return false;
        }
        return true;
    });
}
function pickAuthoredGearCandidate(spec, state) {
    const authoredEquipment = (0, equipment_1.getAllStarterEquipment)();
    const owned = getOwnedEquipmentIds(state);
    const seed = spec.seed ?? (0, rng_1.generateSeed)();
    const rng = (0, rng_1.createSeededRNG)(seed);
    if (spec.equipmentId) {
        const explicit = authoredEquipment[spec.equipmentId];
        if (!explicit) {
            return null;
        }
        if (spec.preferUnowned !== false && owned.has(spec.equipmentId)) {
            return null;
        }
        return explicit;
    }
    const candidates = getAuthoredGearCandidates(spec.slotType);
    if (candidates.length === 0) {
        return null;
    }
    const unownedCandidates = spec.preferUnowned === false
        ? candidates
        : candidates.filter((equipment) => !owned.has(equipment.id));
    const pool = unownedCandidates.length > 0 ? unownedCandidates : candidates;
    return pool[(0, rng_1.randomInt)(rng, 0, pool.length - 1)] ?? null;
}
function summarizeGeneratedReward(gear) {
    const fieldModCount = Array.isArray(gear.fieldMods) ? gear.fieldMods.length : 0;
    const lockedCardCount = Array.isArray(gear.lockedCards) ? gear.lockedCards.length : 0;
    const totalSlots = (0, gearWorkbench_1.getDefaultGearSlots)(gear.id, gear).freeSlots;
    const fragments = [
        `Stability ${gear.stability}`,
        `${totalSlots} open slot${totalSlots === 1 ? "" : "s"}`,
    ];
    if (lockedCardCount > 0) {
        fragments.push(`${lockedCardCount} locked card${lockedCardCount === 1 ? "" : "s"}`);
    }
    if (fieldModCount > 0) {
        fragments.push(`${fieldModCount} field mod${fieldModCount === 1 ? "" : "s"}`);
    }
    return fragments.join(" // ");
}
function clampStatValue(value) {
    return Math.max(0, value);
}
function rollGeneratedGearStats(gear) {
    const chassis = (0, gearCatalog_1.getChassisById)(gear.chassisId);
    const doctrine = (0, gearCatalog_1.getDoctrineById)(gear.doctrineId);
    const seed = (0, rng_1.deriveSeed)(gear.provenance.seed, "gear_reward_stats");
    const rng = (0, rng_1.createSeededRNG)(seed);
    const slotType = chassis?.slotType ?? getEquipmentSlotType(gear) ?? "weapon";
    const doctrineTags = new Set(doctrine?.intentTags ?? []);
    const base = {
        atk: slotType === "weapon" ? 5 : 0,
        def: slotType === "helmet" || slotType === "chestpiece" ? 3 : 0,
        agi: slotType === "accessory" ? 2 : 0,
        acc: 80,
        hp: 0,
    };
    const atkBias = doctrineTags.has("assault") ? 2 : doctrineTags.has("suppression") ? 1 : 0;
    const defBias = doctrineTags.has("sustain") ? 2 : doctrineTags.has("control") ? 1 : 0;
    const agiBias = doctrineTags.has("mobility") || doctrineTags.has("skirmish") ? 2 : 0;
    const accBias = doctrineTags.has("control") ? 6 : doctrineTags.has("skirmish") ? 4 : 0;
    const hpBias = doctrineTags.has("sustain") ? 6 : slotType === "chestpiece" ? 4 : 0;
    return {
        atk: clampStatValue(base.atk + atkBias + (slotType === "weapon" ? (0, rng_1.randomInt)(rng, -1, 4) : (0, rng_1.randomInt)(rng, 0, 2))),
        def: clampStatValue(base.def + defBias + (0, rng_1.randomInt)(rng, -1, 3)),
        agi: clampStatValue(base.agi + agiBias + (0, rng_1.randomInt)(rng, -1, 3)),
        acc: Math.max(62, Math.min(99, base.acc + accBias + (0, rng_1.randomInt)(rng, -8, 10))),
        hp: clampStatValue(base.hp + hpBias + (0, rng_1.randomInt)(rng, 0, slotType === "chestpiece" ? 10 : 6)),
    };
}
function finalizeGeneratedGear(gear, spec) {
    const slotType = getEquipmentSlotType(gear) ?? spec.slotType ?? "weapon";
    const resolvedName = spec.label?.trim().length
        ? spec.label.trim()
        : gear.name?.trim().length
            ? gear.name
            : GENERATED_REWARD_LABEL_BY_SLOT[slotType];
    const rolledStats = rollGeneratedGearStats(gear);
    const resolvedGear = {
        ...gear,
        name: resolvedName,
        stats: rolledStats,
    };
    return resolvedGear;
}
function matchesGeneratedConstraints(gear, spec) {
    if (typeof spec.minStability === "number" && gear.stability < spec.minStability) {
        return false;
    }
    if (typeof spec.maxStability === "number" && gear.stability > spec.maxStability) {
        return false;
    }
    if (spec.preferredDoctrineTags && spec.preferredDoctrineTags.length > 0) {
        const doctrine = (0, gearCatalog_1.getDoctrineById)(gear.doctrineId);
        const doctrineTags = new Set(doctrine?.intentTags ?? []);
        if (!spec.preferredDoctrineTags.some((tag) => doctrineTags.has(tag))) {
            return false;
        }
    }
    return true;
}
function resolveGeneratedGearReward(spec) {
    const baseSeed = spec.seed ?? (0, rng_1.generateSeed)();
    const generationContext = (0, generateEndlessGear_1.createGenerationContext)();
    let resolvedGear = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const seed = attempt === 0 ? baseSeed : (0, rng_1.deriveSeed)(baseSeed, `reroll_${attempt}`);
        const candidate = finalizeGeneratedGear((0, generateEndlessGear_1.generateEndlessLoot)(generationContext, {
            slotType: spec.slotType,
            seed,
        }), {
            ...spec,
            seed,
        });
        if (!resolvedGear) {
            resolvedGear = candidate;
        }
        if (matchesGeneratedConstraints(candidate, spec)) {
            resolvedGear = candidate;
            break;
        }
    }
    const gear = resolvedGear ?? finalizeGeneratedGear((0, generateEndlessGear_1.generateEndlessLoot)(generationContext, {
        slotType: spec.slotType,
        seed: baseSeed,
    }), spec);
    return {
        rewardId: gear.id,
        source: "generated",
        equipmentId: gear.id,
        name: gear.name,
        description: summarizeGeneratedReward(gear),
        equipment: gear,
        gearSlots: (0, gearWorkbench_1.getDefaultGearSlots)(gear.id, gear),
    };
}
function resolveAuthoredGearReward(spec, state) {
    const authoredGear = pickAuthoredGearCandidate(spec, state);
    if (!authoredGear) {
        if (!spec.fallbackToGenerated) {
            return null;
        }
        const generatedSpec = {
            kind: "generated",
            slotType: spec.slotType ?? getEquipmentSlotType(spec.equipmentId ? (0, equipment_1.getAllStarterEquipment)()[spec.equipmentId] : undefined) ?? undefined,
            seed: spec.fallbackSeed ?? (0, rng_1.deriveSeed)(spec.seed ?? (0, rng_1.generateSeed)(), "authored_fallback"),
            label: spec.label,
        };
        return resolveGeneratedGearReward(generatedSpec);
    }
    return {
        rewardId: authoredGear.id,
        source: "authored",
        equipmentId: authoredGear.id,
        templateId: authoredGear.id,
        name: authoredGear.name,
        description: authoredGear.description ?? "Hand-authored field gear recovered intact.",
        equipment: authoredGear,
        gearSlots: (0, gearWorkbench_1.getDefaultGearSlots)(authoredGear.id, authoredGear),
    };
}
function describeGearRewardSpec(spec) {
    const normalized = normalizeRewardSpec(spec);
    if (normalized.kind === "generated") {
        if (normalized.label?.trim().length) {
            return normalized.label.trim();
        }
        return normalized.slotType
            ? GENERATED_REWARD_LABEL_BY_SLOT[normalized.slotType]
            : "Recovered Gear Cache";
    }
    if (normalized.equipmentId) {
        const authoredGear = (0, equipment_1.getAllStarterEquipment)()[normalized.equipmentId];
        if (authoredGear?.name) {
            return authoredGear.name;
        }
    }
    if (normalized.label?.trim().length) {
        return normalized.label.trim();
    }
    return normalized.slotType
        ? `Authored ${normalized.slotType}`
        : "Authored Gear Cache";
}
function resolveGearRewardSpec(spec, state) {
    const normalized = normalizeRewardSpec(spec);
    return normalized.kind === "generated"
        ? resolveGeneratedGearReward(normalized)
        : resolveAuthoredGearReward(normalized, state);
}
function resolveGearRewardSpecs(specs, state) {
    const granted = [];
    let nextState = state;
    for (const spec of specs) {
        const resolved = resolveGearRewardSpec(spec, nextState);
        if (resolved) {
            granted.push(resolved);
            if (nextState) {
                nextState = grantResolvedGearRewardToState(nextState, resolved);
            }
        }
    }
    return granted;
}
function grantResolvedGearRewardToState(state, reward) {
    const equipmentById = { ...(state.equipmentById ?? {}) };
    const gearSlots = { ...(state.gearSlots ?? {}) };
    const equipmentPool = [...(state.equipmentPool ?? [])];
    equipmentById[reward.equipmentId] = reward.equipment;
    gearSlots[reward.equipmentId] = reward.gearSlots;
    if (!equipmentPool.includes(reward.equipmentId)) {
        equipmentPool.push(reward.equipmentId);
    }
    return {
        ...state,
        equipmentById,
        gearSlots,
        equipmentPool,
    };
}
function grantGearRewardSpecsToState(state, specs) {
    let nextState = state;
    for (const spec of specs) {
        const resolved = resolveGearRewardSpec(spec, nextState);
        if (!resolved) {
            continue;
        }
        nextState = grantResolvedGearRewardToState(nextState, resolved);
    }
    return nextState;
}
function createBattleGearRewardSpec(enemyCount, battleId) {
    const rewardChance = Math.min(0.72, 0.18 + (enemyCount * 0.08));
    const seed = (0, rng_1.deriveSeed)((0, rng_1.generateSeed)(), battleId);
    const rng = (0, rng_1.createSeededRNG)(seed);
    if (rng() > rewardChance) {
        return [];
    }
    const prefersGenerated = rng() < 0.72;
    if (prefersGenerated) {
        const slotPool = ["weapon", "helmet", "chestpiece", "accessory"];
        const slotType = slotPool[(0, rng_1.randomInt)(rng, 0, slotPool.length - 1)];
        return [{
                kind: "generated",
                slotType,
                minStability: enemyCount >= 4 ? 60 : 45,
                seed: (0, rng_1.deriveSeed)(seed, "generated_reward"),
            }];
    }
    return [{
            kind: "authored",
            seed: (0, rng_1.deriveSeed)(seed, "authored_reward"),
            fallbackSeed: (0, rng_1.deriveSeed)(seed, "authored_fallback"),
            preferUnowned: true,
            fallbackToGenerated: true,
        }];
}
function createOperationGearRewardSpecs(choiceCount, operationId) {
    const specs = [];
    const baseSeed = (0, rng_1.deriveSeed)((0, rng_1.generateSeed)(), operationId);
    const slotPool = ["weapon", "helmet", "chestpiece", "accessory"];
    for (let index = 0; index < choiceCount; index += 1) {
        const rewardSeed = (0, rng_1.deriveSeed)(baseSeed, `operation_choice_${index}`);
        const slotType = slotPool[index % slotPool.length];
        if (index === 0) {
            specs.push({
                kind: "authored",
                slotType,
                seed: rewardSeed,
                fallbackSeed: (0, rng_1.deriveSeed)(rewardSeed, "authored_fallback"),
                preferUnowned: true,
                fallbackToGenerated: true,
            });
            continue;
        }
        specs.push({
            kind: "generated",
            slotType,
            minStability: 58 + index * 4,
            seed: rewardSeed,
        });
    }
    return specs;
}

import { getChassisById, getDoctrineById } from "./gearCatalog";
import { getAllStarterEquipment } from "./equipment";
import { getDefaultGearSlots } from "./gearWorkbench";
import { createGenerationContext, generateEndlessLoot } from "./endlessGear/generateEndlessGear";
import { createSeededRNG, deriveSeed, generateSeed, randomInt } from "./rng";
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
    return Object.values(getAllStarterEquipment()).filter((equipment) => {
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
    const authoredEquipment = getAllStarterEquipment();
    const owned = getOwnedEquipmentIds(state);
    const seed = spec.seed ?? generateSeed();
    const rng = createSeededRNG(seed);
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
    return pool[randomInt(rng, 0, pool.length - 1)] ?? null;
}
function summarizeGeneratedReward(gear) {
    const fieldModCount = Array.isArray(gear.fieldMods) ? gear.fieldMods.length : 0;
    const lockedCardCount = Array.isArray(gear.lockedCards) ? gear.lockedCards.length : 0;
    const totalSlots = getDefaultGearSlots(gear.id, gear).freeSlots;
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
    const chassis = getChassisById(gear.chassisId);
    const doctrine = getDoctrineById(gear.doctrineId);
    const seed = deriveSeed(gear.provenance.seed, "gear_reward_stats");
    const rng = createSeededRNG(seed);
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
        atk: clampStatValue(base.atk + atkBias + (slotType === "weapon" ? randomInt(rng, -1, 4) : randomInt(rng, 0, 2))),
        def: clampStatValue(base.def + defBias + randomInt(rng, -1, 3)),
        agi: clampStatValue(base.agi + agiBias + randomInt(rng, -1, 3)),
        acc: Math.max(62, Math.min(99, base.acc + accBias + randomInt(rng, -8, 10))),
        hp: clampStatValue(base.hp + hpBias + randomInt(rng, 0, slotType === "chestpiece" ? 10 : 6)),
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
        const doctrine = getDoctrineById(gear.doctrineId);
        const doctrineTags = new Set(doctrine?.intentTags ?? []);
        if (!spec.preferredDoctrineTags.some((tag) => doctrineTags.has(tag))) {
            return false;
        }
    }
    return true;
}
function resolveGeneratedGearReward(spec) {
    const baseSeed = spec.seed ?? generateSeed();
    const generationContext = createGenerationContext();
    let resolvedGear = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const seed = attempt === 0 ? baseSeed : deriveSeed(baseSeed, `reroll_${attempt}`);
        const candidate = finalizeGeneratedGear(generateEndlessLoot(generationContext, {
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
    const gear = resolvedGear ?? finalizeGeneratedGear(generateEndlessLoot(generationContext, {
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
        gearSlots: getDefaultGearSlots(gear.id, gear),
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
            slotType: spec.slotType ?? getEquipmentSlotType(spec.equipmentId ? getAllStarterEquipment()[spec.equipmentId] : undefined) ?? undefined,
            seed: spec.fallbackSeed ?? deriveSeed(spec.seed ?? generateSeed(), "authored_fallback"),
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
        gearSlots: getDefaultGearSlots(authoredGear.id, authoredGear),
    };
}
export function describeGearRewardSpec(spec) {
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
        const authoredGear = getAllStarterEquipment()[normalized.equipmentId];
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
export function resolveGearRewardSpec(spec, state) {
    const normalized = normalizeRewardSpec(spec);
    return normalized.kind === "generated"
        ? resolveGeneratedGearReward(normalized)
        : resolveAuthoredGearReward(normalized, state);
}
export function resolveGearRewardSpecs(specs, state) {
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
export function grantResolvedGearRewardToState(state, reward) {
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
export function grantGearRewardSpecsToState(state, specs) {
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
export function createBattleGearRewardSpec(enemyCount, battleId) {
    const rewardChance = Math.min(0.72, 0.18 + (enemyCount * 0.08));
    const seed = deriveSeed(generateSeed(), battleId);
    const rng = createSeededRNG(seed);
    if (rng() > rewardChance) {
        return [];
    }
    const prefersGenerated = rng() < 0.72;
    if (prefersGenerated) {
        const slotPool = ["weapon", "helmet", "chestpiece", "accessory"];
        const slotType = slotPool[randomInt(rng, 0, slotPool.length - 1)];
        return [{
                kind: "generated",
                slotType,
                minStability: enemyCount >= 4 ? 60 : 45,
                seed: deriveSeed(seed, "generated_reward"),
            }];
    }
    return [{
            kind: "authored",
            seed: deriveSeed(seed, "authored_reward"),
            fallbackSeed: deriveSeed(seed, "authored_fallback"),
            preferUnowned: true,
            fallbackToGenerated: true,
        }];
}
export function createOperationGearRewardSpecs(choiceCount, operationId) {
    const specs = [];
    const baseSeed = deriveSeed(generateSeed(), operationId);
    const slotPool = ["weapon", "helmet", "chestpiece", "accessory"];
    for (let index = 0; index < choiceCount; index += 1) {
        const rewardSeed = deriveSeed(baseSeed, `operation_choice_${index}`);
        const slotType = slotPool[index % slotPool.length];
        if (index === 0) {
            specs.push({
                kind: "authored",
                slotType,
                seed: rewardSeed,
                fallbackSeed: deriveSeed(rewardSeed, "authored_fallback"),
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

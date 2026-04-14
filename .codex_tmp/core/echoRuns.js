import { getGameState, updateGameState } from "../state/gameStore";
import { enableAutosave, triggerAutosave } from "./saveSystem";
import { buildEchoFieldDefinition, getEchoFieldCatalog } from "./echoFieldEffects";
import { getAllStarterEquipment, canEquipWeapon } from "./equipment";
import { getClassDefinition } from "./classes";
import { calculatePWR, getPWRBand } from "./pwr";
import { createDefaultAffinities } from "./affinity";
import { createBattleFromEncounter } from "./battleFromEncounter";
import { getAllFieldModDefs, getFieldModDef } from "./fieldModDefinitions";
const STARTING_SQUAD_SIZE = 3;
const UNIT_DRAFT_CHOICE_COUNT = 3;
const FIELD_DRAFT_CHOICE_COUNT = 3;
const MAX_FIELD_LEVEL = 5;
const DEFAULT_ECHO_PORTRAIT = "/assets/portraits/units/core/Test_Portrait.png";
const ECHO_SQUAD_SCOPE_MODS = getAllFieldModDefs().filter((mod) => mod.scope === "squad");
const CLASS_NAME_POOLS = {
    squire: ["Bram", "Cael", "Dorin", "Iris", "Mira", "Rook", "Tamsin", "Vale"],
    ranger: ["Ash", "Hawke", "Lark", "Mira", "Peregrin", "Quill", "Sable", "Voss"],
    magician: ["Aster", "Cinder", "Edda", "Lyra", "Nyx", "Orin", "Vex", "Zephyr"],
    thief: ["Cipher", "Flint", "Kestrel", "Nix", "Riven", "Shade", "Siv", "Wren"],
    academic: ["Alden", "Cato", "Faye", "Maren", "Orrin", "Quen", "Tallis", "Vela"],
    freelancer: ["Ember", "Galen", "Juno", "Keir", "Pax", "Reeve", "Soren", "Tarin"],
};
const CLASS_TRAIT_POOLS = {
    squire: ["Anchor Stance", "Frontline Poise", "Shield Rhythm"],
    ranger: ["Long Sight", "Wind Runner", "Hunt Focus"],
    magician: ["Arc Surge", "Chaos Intake", "Spell Lattice"],
    thief: ["Ghost Step", "Knife Drift", "Slipstream"],
    academic: ["Signal Analyst", "Directive Memory", "Measured Volley"],
    freelancer: ["Open Manual", "Loose Doctrine", "Adaptive Frame"],
};
const ECHO_RECOVERY_OPTIONS = [
    {
        id: "squad_patch",
        name: "Squad Patch",
        description: "Heal all surviving drafted units for 30% of max HP.",
        healMode: "all_percent",
        allHealPercent: 0.3,
    },
    {
        id: "triage",
        name: "Triage",
        description: "Fully heal the lowest-HP unit, then heal every other survivor for 15% of max HP.",
        healMode: "lowest_full_all_percent",
        otherHealPercent: 0.15,
    },
    {
        id: "field_dressing",
        name: "Field Dressing",
        description: "Heal all surviving drafted units for 20% max HP and gain +1 reroll.",
        healMode: "all_percent",
        allHealPercent: 0.2,
        rerollsGranted: 1,
    },
];
const ECHO_TRAINING_OPTIONS = [
    {
        id: "assault_drill",
        name: "Assault Drill",
        description: "All surviving drafted units gain +1 ATK for the rest of the run.",
        stat: "atk",
        amount: 1,
    },
    {
        id: "guard_drill",
        name: "Guard Drill",
        description: "All surviving drafted units gain +1 DEF for the rest of the run.",
        stat: "def",
        amount: 1,
    },
    {
        id: "mobility_drill",
        name: "Mobility Drill",
        description: "All surviving drafted units gain +1 AGI for the rest of the run.",
        stat: "agi",
        amount: 1,
    },
    {
        id: "precision_drill",
        name: "Precision Drill",
        description: "All surviving drafted units gain +5 ACC for the rest of the run.",
        stat: "acc",
        amount: 5,
    },
];
function hashSeed(seed) {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function createSeededRng(seed) {
    let state = hashSeed(seed) || 1;
    return () => {
        state = Math.imul(state, 1664525) + 1013904223;
        return ((state >>> 0) % 0x100000000) / 0x100000000;
    };
}
function randomInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
}
function pickOne(rng, items) {
    return items[Math.floor(rng() * items.length)] ?? items[0];
}
function pickUnique(rng, items, count) {
    const pool = [...items];
    const picked = [];
    while (pool.length > 0 && picked.length < count) {
        const index = Math.floor(rng() * pool.length);
        picked.push(pool.splice(index, 1)[0]);
    }
    return picked;
}
function pickWeighted(rng, weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
    let roll = rng() * Math.max(total, 0.0001);
    for (const [value, weight] of entries) {
        roll -= Math.max(0, weight);
        if (roll <= 0) {
            return value;
        }
    }
    return entries[entries.length - 1]?.[0] ?? entries[0][0];
}
function uniqueIds(values) {
    return Array.from(new Set(values));
}
function cloneAffinities(affinities) {
    return {
        melee: affinities.melee,
        ranged: affinities.ranged,
        magic: affinities.magic,
        support: affinities.support,
        mobility: affinities.mobility,
        survival: affinities.survival,
    };
}
function cloneEchoUnit(unit) {
    const unitAny = unit;
    return {
        ...unitAny,
        loadout: unitAny.loadout ? { ...unitAny.loadout } : undefined,
        buffs: [...(unitAny.buffs ?? [])],
        affinities: unitAny.affinities ? cloneAffinities(unitAny.affinities) : unitAny.affinities,
        hand: [...unitAny.hand],
        drawPile: [...unitAny.drawPile],
        discardPile: [...unitAny.discardPile],
        stats: unitAny.stats ? { ...unitAny.stats } : unitAny.stats,
        traits: unitAny.traits ? [...unitAny.traits] : unitAny.traits,
    };
}
function createEchoRunId() {
    return `echo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function getDraftClassWeights(run, encounterDepth) {
    const weights = {
        squire: 1.15,
        ranger: 1.15,
        magician: 1.05,
        thief: 1.05,
        academic: 0.5,
        freelancer: encounterDepth >= 5 ? 0.35 : 0.18,
    };
    if (!run) {
        return weights;
    }
    const activeFields = new Set(run.fields.map((field) => field.id));
    if (activeFields.has("ember_zone")) {
        weights.magician += 0.8;
        weights.squire += 0.4;
    }
    if (activeFields.has("bastion_zone")) {
        weights.squire += 0.8;
        weights.academic += 0.35;
    }
    if (activeFields.has("flux_zone")) {
        weights.ranger += 0.7;
        weights.thief += 0.9;
    }
    const affinityTotals = createDefaultAffinities();
    run.squadUnitIds.forEach((unitId) => {
        const unit = run.unitsById[unitId];
        const affinities = unit?.affinities;
        if (!affinities)
            return;
        affinityTotals.melee += affinities.melee;
        affinityTotals.ranged += affinities.ranged;
        affinityTotals.magic += affinities.magic;
        affinityTotals.support += affinities.support;
        affinityTotals.mobility += affinities.mobility;
        affinityTotals.survival += affinities.survival;
    });
    const dominantAffinity = Object.entries(affinityTotals)
        .sort((left, right) => right[1] - left[1])[0]?.[0] ?? "melee";
    switch (dominantAffinity) {
        case "melee":
            weights.squire += 0.8;
            weights.thief += 0.3;
            break;
        case "ranged":
            weights.ranger += 1;
            weights.academic += 0.25;
            break;
        case "magic":
            weights.magician += 1;
            weights.academic += 0.35;
            break;
        case "support":
            weights.academic += 0.9;
            weights.magician += 0.3;
            break;
        case "mobility":
            weights.thief += 1;
            weights.ranger += 0.35;
            break;
        case "survival":
            weights.squire += 0.7;
            weights.academic += 0.15;
            break;
    }
    return weights;
}
function getAllowedDraftClasses(encounterDepth) {
    const base = ["squire", "ranger", "magician", "thief"];
    if (encounterDepth >= 3) {
        base.push("academic");
    }
    if (encounterDepth >= 6) {
        base.push("freelancer");
    }
    return base;
}
function createAffinityBiasForClass(unitClass, encounterDepth, rng) {
    const affinities = createDefaultAffinities();
    const depthBonus = Math.min(40, encounterDepth * 4);
    const apply = (key, amount) => {
        affinities[key] += amount;
    };
    switch (unitClass) {
        case "squire":
            apply("melee", 18 + depthBonus);
            apply("survival", 12 + Math.floor(depthBonus * 0.5));
            apply("support", 4 + Math.floor(depthBonus * 0.25));
            break;
        case "ranger":
            apply("ranged", 18 + depthBonus);
            apply("mobility", 12 + Math.floor(depthBonus * 0.5));
            break;
        case "magician":
            apply("magic", 20 + depthBonus);
            apply("support", 8 + Math.floor(depthBonus * 0.35));
            break;
        case "thief":
            apply("mobility", 18 + depthBonus);
            apply("melee", 9 + Math.floor(depthBonus * 0.35));
            apply("survival", 4 + Math.floor(depthBonus * 0.2));
            break;
        case "academic":
            apply("support", 16 + depthBonus);
            apply("ranged", 10 + Math.floor(depthBonus * 0.4));
            break;
        case "freelancer":
            apply("melee", 8 + Math.floor(depthBonus * 0.35));
            apply("ranged", 8 + Math.floor(depthBonus * 0.35));
            apply("magic", 8 + Math.floor(depthBonus * 0.35));
            apply("support", 8 + Math.floor(depthBonus * 0.2));
            break;
    }
    const keys = Object.keys(affinities);
    keys.forEach((key) => {
        affinities[key] += randomInt(rng, 0, 3);
    });
    return affinities;
}
function getTopAffinityLean(affinities) {
    return Object.entries(affinities)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 2)
        .map(([affinity]) => affinity);
}
function getEquipmentPools() {
    const allEquipment = Object.values(getAllStarterEquipment());
    return {
        weapons: allEquipment.filter((equipment) => equipment.slot === "weapon"),
        helmets: allEquipment.filter((equipment) => equipment.slot === "helmet"),
        chestpieces: allEquipment.filter((equipment) => equipment.slot === "chestpiece"),
        accessories: allEquipment.filter((equipment) => equipment.slot === "accessory"),
    };
}
function rollEchoLoadout(unitClass, encounterDepth, rng) {
    const equipmentPools = getEquipmentPools();
    const allowedWeapons = equipmentPools.weapons.filter((equipment) => (equipment.slot === "weapon" && canEquipWeapon(unitClass, equipment.weaponType)));
    const primaryWeapon = pickOne(rng, allowedWeapons.length > 0 ? allowedWeapons : equipmentPools.weapons)?.id ?? null;
    const includeHelmet = encounterDepth >= 2 || rng() > 0.45;
    const includeChest = encounterDepth >= 3 || rng() > 0.42;
    const accessorySlots = encounterDepth >= 6 ? 2 : encounterDepth >= 3 ? 1 : 0;
    const accessoryPool = [...equipmentPools.accessories];
    const accessory1 = accessorySlots >= 1 && accessoryPool.length > 0
        ? accessoryPool.splice(randomInt(rng, 0, accessoryPool.length - 1), 1)[0]?.id ?? null
        : null;
    const accessory2 = accessorySlots >= 2 && accessoryPool.length > 0
        ? accessoryPool.splice(randomInt(rng, 0, accessoryPool.length - 1), 1)[0]?.id ?? null
        : null;
    return {
        primaryWeapon,
        secondaryWeapon: null,
        helmet: includeHelmet ? pickOne(rng, equipmentPools.helmets)?.id ?? null : null,
        chestpiece: includeChest ? pickOne(rng, equipmentPools.chestpieces)?.id ?? null : null,
        accessory1,
        accessory2,
    };
}
function createEchoStats(unitClass, encounterDepth, rng) {
    const classDef = getClassDefinition(unitClass);
    const base = classDef.baseStats;
    const depthScaling = Math.max(0, encounterDepth - 1);
    return {
        maxHp: Math.max(10, base.maxHp + depthScaling * 2 + randomInt(rng, -1, 3)),
        atk: Math.max(3, base.atk + Math.floor(depthScaling * 0.8) + randomInt(rng, 0, 2)),
        def: Math.max(2, base.def + Math.floor(depthScaling * 0.7) + randomInt(rng, 0, 2)),
        agi: Math.max(2, base.agi + Math.floor(depthScaling * 0.4) + randomInt(rng, 0, 1)),
        acc: Math.max(70, Math.min(100, base.acc + Math.floor(depthScaling * 0.6) + randomInt(rng, 0, 3))),
    };
}
function createEchoUnitDraftOption(run, optionIndex, encounterDepth, seedKey) {
    const rng = createSeededRng(`${seedKey}:${optionIndex}`);
    const allowedClasses = getAllowedDraftClasses(encounterDepth);
    const weightedClassPool = getDraftClassWeights(run, encounterDepth);
    const filteredWeights = Object.fromEntries(allowedClasses.map((unitClass) => [unitClass, weightedClassPool[unitClass]]));
    const unitClass = pickWeighted(rng, filteredWeights);
    const namePool = CLASS_NAME_POOLS[unitClass];
    const stats = createEchoStats(unitClass, encounterDepth, rng);
    const affinities = createAffinityBiasForClass(unitClass, encounterDepth, rng);
    const loadout = rollEchoLoadout(unitClass, encounterDepth, rng);
    const previewEquipment = Object.values(loadout).filter(Boolean);
    const runtimeUnit = {
        id: `echo_preview_${seedKey}_${optionIndex}`,
        name: pickOne(rng, namePool),
        isEnemy: false,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        agi: stats.agi,
        pos: null,
        hand: [],
        drawPile: [],
        discardPile: [],
        strain: 0,
        unitClass,
        loadout,
        affinities: cloneAffinities(affinities),
        stats,
    };
    const pwr = calculatePWR({ unit: runtimeUnit });
    return {
        id: `echo_unit_option_${seedKey}_${optionIndex}`,
        name: runtimeUnit.name,
        baseClass: unitClass,
        portraitPath: DEFAULT_ECHO_PORTRAIT,
        pwr,
        pwrBand: getPWRBand(pwr),
        affinityLean: getTopAffinityLean(affinities),
        affinities,
        traitLabel: pickOne(rng, CLASS_TRAIT_POOLS[unitClass]),
        stats,
        loadout,
        loadoutPreview: previewEquipment,
    };
}
function createRuntimeEchoUnit(run, option) {
    const unitId = `echo_unit_${run.id}_${run.unitsDrafted + 1}`;
    return {
        id: unitId,
        name: option.name,
        isEnemy: false,
        hp: option.stats.maxHp,
        maxHp: option.stats.maxHp,
        agi: option.stats.agi,
        pos: null,
        hand: [],
        drawPile: [],
        discardPile: [],
        strain: 0,
        unitClass: option.baseClass,
        loadout: { ...option.loadout },
        pwr: option.pwr,
        affinities: cloneAffinities(option.affinities),
        stats: { ...option.stats },
        traits: option.traitLabel ? [option.traitLabel] : [],
    };
}
function createFieldChoice(field, choiceId, optionType) {
    const subtitle = optionType === "field_upgrade"
        ? `Upgrade ${field.name} to LV ${Math.min(MAX_FIELD_LEVEL, field.level + 1)}`
        : field.effectLabel;
    return {
        id: choiceId,
        lane: "field",
        optionType,
        title: field.name,
        subtitle,
        description: field.description,
        fieldDefinition: field,
    };
}
function createModifierChoice(modifier, choiceId) {
    return {
        id: choiceId,
        lane: "modifier",
        optionType: "modifier_draft",
        title: modifier.name,
        subtitle: `${modifier.rarity.toUpperCase()} ${modifier.scope.toUpperCase()} MOD`,
        description: modifier.description,
        modifierDefId: modifier.id,
    };
}
function createUnitChoice(choice, choiceId) {
    return {
        id: choiceId,
        lane: "unit",
        optionType: "unit_draft",
        title: choice.name,
        subtitle: `${choice.baseClass.toUpperCase()} // ${choice.pwrBand}`,
        description: choice.traitLabel ?? "Run-generated combatant",
        unitOption: choice,
    };
}
function createRecoveryChoice(choice, choiceId) {
    return {
        id: choiceId,
        lane: "recovery",
        optionType: "recovery_draft",
        title: choice.name,
        subtitle: "RECOVERY PACKAGE",
        description: choice.description,
        recoveryOption: choice,
    };
}
function createTrainingChoice(choice, choiceId) {
    return {
        id: choiceId,
        lane: "training",
        optionType: "training_draft",
        title: choice.name,
        subtitle: "TEAM-WIDE TRAINING",
        description: choice.description,
        trainingOption: choice,
    };
}
function createModifierInstance(defId, runId, index, seedKey) {
    return {
        defId,
        stacks: 1,
        instanceId: `echo_mod_${runId}_${index}_${hashSeed(seedKey).toString(36)}`,
    };
}
function getCurrentDraftDepth(run) {
    if (!run) {
        return 1;
    }
    return Math.max(1, run.currentStratum + Math.floor(Math.max(0, run.encounterNumber - 1) / 2));
}
function getFieldLaneChoice(run, rewardSeed) {
    const rng = createSeededRng(`field_lane:${rewardSeed}`);
    const missingFields = getEchoFieldCatalog().filter((field) => !run.fields.some((owned) => owned.id === field.id));
    if (missingFields.length > 0) {
        const baseChoice = pickOne(rng, missingFields);
        const choiceField = buildEchoFieldDefinition(baseChoice.id, `echo_field_${run.id}_${rewardSeed}`, 1);
        return createFieldChoice(choiceField, `echo_choice_field_${rewardSeed}`, "field_draft");
    }
    const upgradeTarget = [...run.fields].sort((left, right) => left.level - right.level)[0];
    return createFieldChoice(upgradeTarget, `echo_choice_field_${rewardSeed}`, "field_upgrade");
}
function getRecoveryLaneChoice(run, rewardSeed) {
    const rng = createSeededRng(`recovery_lane:${rewardSeed}`);
    const choice = pickOne(rng, ECHO_RECOVERY_OPTIONS);
    return createRecoveryChoice(choice, `echo_choice_recovery_${rewardSeed}`);
}
function getTrainingLaneChoice(run, rewardSeed) {
    const rng = createSeededRng(`training_lane:${rewardSeed}`);
    const choice = pickOne(rng, ECHO_TRAINING_OPTIONS);
    return createTrainingChoice(choice, `echo_choice_training_${rewardSeed}`);
}
function getModifierLaneChoice(run, rewardSeed) {
    const rng = createSeededRng(`modifier_lane:${rewardSeed}`);
    const available = ECHO_SQUAD_SCOPE_MODS.filter((mod) => !run.tacticalModifiers.some((owned) => owned.defId === mod.id));
    const pool = available.length > 0 ? available : ECHO_SQUAD_SCOPE_MODS;
    const modifier = pickOne(rng, pool);
    return createModifierChoice(modifier, `echo_choice_modifier_${rewardSeed}`);
}
function getUnitLaneChoice(run, rewardSeed) {
    const encounterDepth = getCurrentDraftDepth(run) + 1;
    const unitChoice = createEchoUnitDraftOption(run, 0, encounterDepth, `reward_unit:${rewardSeed}`);
    return createUnitChoice(unitChoice, `echo_choice_unit_${rewardSeed}`);
}
function getLaneChoice(run, lane, rewardSeed) {
    switch (lane) {
        case "field":
            return getFieldLaneChoice(run, rewardSeed);
        case "modifier":
            return getModifierLaneChoice(run, rewardSeed);
        case "recovery":
            return getRecoveryLaneChoice(run, rewardSeed);
        case "training":
            return getTrainingLaneChoice(run, rewardSeed);
        case "unit":
        default:
            return getUnitLaneChoice(run, rewardSeed);
    }
}
function sampleRewardLanes(weights, choiceCount, seedKey, forcedLanes = []) {
    const rng = createSeededRng(`reward_lanes:${seedKey}`);
    const weighted = {
        unit: weights.unit ?? 1,
        field: weights.field ?? 1,
        modifier: weights.modifier ?? 1,
        recovery: weights.recovery ?? 1,
        training: weights.training ?? 1,
    };
    const picked = [...forcedLanes].slice(0, choiceCount);
    const available = Object.keys(weighted);
    while (picked.length < choiceCount) {
        const filteredWeights = Object.fromEntries(available
            .filter((lane) => !picked.includes(lane))
            .map((lane) => [lane, weighted[lane]]));
        const fallbackWeights = Object.keys(filteredWeights).length > 0 ? filteredWeights : weighted;
        const lane = pickWeighted(rng, fallbackWeights);
        if (!picked.includes(lane) || Object.keys(filteredWeights).length === 0) {
            picked.push(lane);
        }
    }
    return picked.slice(0, choiceCount);
}
function createRewardChoicesForNode(run, node) {
    const rewardSeed = `${run.seed}:${node.id}:reward:${run.encounterNumber}:${run.unitsDrafted}:${run.fieldsDrafted}:${run.tacticalModifiersDrafted}`;
    const lanes = sampleRewardLanes(node.laneWeights, node.choiceCount, rewardSeed, node.forcedLanes ?? []);
    return lanes.map((lane, index) => getLaneChoice(run, lane, `${rewardSeed}:${lane}:${index}`));
}
function createMilestoneChoices(run, nodeId) {
    const rewardSeed = `${run.seed}:${nodeId}:milestone:${run.currentStratum}:${run.milestonesReached}`;
    return [
        getRecoveryLaneChoice(run, `${rewardSeed}:recovery`),
        getTrainingLaneChoice(run, `${rewardSeed}:training`),
        (run.fields.length < getEchoFieldCatalog().length || run.fields.some((field) => field.level < MAX_FIELD_LEVEL))
            ? getFieldLaneChoice(run, `${rewardSeed}:field`)
            : getModifierLaneChoice(run, `${rewardSeed}:modifier`),
    ];
}
function generateInitialUnitChoices(runId, draftIndex) {
    const seedKey = `${runId}:initial_unit:${draftIndex}`;
    return Array.from({ length: UNIT_DRAFT_CHOICE_COUNT }, (_, index) => (createUnitChoice(createEchoUnitDraftOption(null, index, 1, seedKey), `echo_initial_unit_choice_${draftIndex}_${index}`)));
}
function generateInitialFieldChoices(runId) {
    const rng = createSeededRng(`${runId}:initial_field`);
    return pickUnique(rng, getEchoFieldCatalog(), FIELD_DRAFT_CHOICE_COUNT).map((field, index) => createFieldChoice(buildEchoFieldDefinition(field.id, `echo_field_${runId}_${index}`, 1), `echo_initial_field_choice_${index}`, "field_draft"));
}
function getBaseLaneWeights(nodeType) {
    switch (nodeType) {
        case "elite":
            return { unit: 0.9, field: 1.1, modifier: 1.2, recovery: 0.9, training: 1.05 };
        case "support":
            return { unit: 0.55, field: 1.2, modifier: 1.2, recovery: 1.05, training: 1.15 };
        case "boss":
            return { unit: 0.7, field: 1, modifier: 1.05, recovery: 1.3, training: 1.2 };
        case "boss_chain_a":
            return { unit: 0.65, field: 1, modifier: 1.05, recovery: 1.1, training: 1.3 };
        case "boss_chain_b":
            return { unit: 0.65, field: 1, modifier: 1.1, recovery: 1.35, training: 1.35 };
        case "milestone":
            return { recovery: 1.4, training: 1.25, field: 1.05, modifier: 1.05, unit: 0.45 };
        case "encounter":
        default:
            return { unit: 1.05, field: 0.9, modifier: 1, recovery: 0.65, training: 0.65 };
    }
}
function getNodeChoiceCount(nodeType) {
    switch (nodeType) {
        case "boss":
        case "boss_chain_a":
        case "boss_chain_b":
            return 4;
        case "milestone":
            return 3;
        default:
            return 3;
    }
}
function getForcedLanes(nodeType) {
    switch (nodeType) {
        case "boss":
            return ["recovery"];
        case "boss_chain_a":
            return ["training"];
        case "boss_chain_b":
            return ["recovery", "training"];
        case "milestone":
            return ["recovery", "training"];
        default:
            return [];
    }
}
function getNodeEncounterType(nodeType) {
    switch (nodeType) {
        case "elite":
            return "elite";
        case "boss":
            return "boss";
        case "boss_chain_a":
            return "boss_chain_a";
        case "boss_chain_b":
            return "boss_chain_b";
        case "encounter":
            return "standard";
        default:
            return null;
    }
}
function getNodePresentation(nodeType, stratum, layer, index) {
    const dangerBase = Math.max(1, stratum + Math.floor((layer - 1) / 2));
    switch (nodeType) {
        case "support":
            return {
                title: ["Signal Cache", "Recovery Locker", "Soft Relay"][index % 3],
                subtitle: "SUPPORT NODE",
                description: "Resolve immediately to draft support, recovery, or training rewards without entering a battle.",
                dangerTier: Math.max(1, dangerBase - 1),
                rewardBias: "Support / Recovery",
            };
        case "elite":
            return {
                title: ["Pressure Knot", "Skirmish Core", "Hazard Gate"][index % 3],
                subtitle: "ELITE ENCOUNTER",
                description: "High-pressure contact with stronger reward weighting and heavier enemy density.",
                dangerTier: dangerBase + 1,
                rewardBias: "Field / Modifier",
            };
        case "boss":
            return {
                title: "Anchor Boss",
                subtitle: "BOSS ENGAGEMENT",
                description: "Clear the anchor threat to unlock the stratum milestone.",
                dangerTier: dangerBase + 2,
                rewardBias: "Recovery / Training",
            };
        case "boss_chain_a":
            return {
                title: "Chain Boss I",
                subtitle: "BOSS CHAIN // PHASE 1",
                description: "First link in a chained escalation. Clear it to reveal the second boss.",
                dangerTier: dangerBase + 2,
                rewardBias: "Training / Field",
            };
        case "boss_chain_b":
            return {
                title: "Chain Boss II",
                subtitle: "BOSS CHAIN // PHASE 2",
                description: "Second chained boss. Clear it to reach the milestone layer.",
                dangerTier: dangerBase + 3,
                rewardBias: "Recovery / Training",
            };
        case "milestone":
            return {
                title: `Milestone ${stratum}`,
                subtitle: "ENDLESS MILESTONE",
                description: "Choose one strong support package, then push into the next stratum.",
                dangerTier: dangerBase,
                rewardBias: "Milestone Support",
            };
        case "encounter":
        default:
            return {
                title: ["Echo Breach", "Draft Contact", "Fracture Gate"][index % 3],
                subtitle: "STANDARD ENCOUNTER",
                description: "Fight through a standard proving-ground encounter and draft one reward lane afterward.",
                dangerTier: dangerBase,
                rewardBias: "Balanced",
            };
    }
}
function createStratumNode(run, stratum, layer, branchIndex, nodeType) {
    const presentation = getNodePresentation(nodeType, stratum, layer, branchIndex);
    return {
        id: `echo_node_${run.id}_${stratum}_${layer}_${branchIndex}_${nodeType}`,
        stratum,
        layer,
        branchIndex,
        nodeType,
        encounterType: getNodeEncounterType(nodeType),
        title: presentation.title,
        subtitle: presentation.subtitle,
        description: presentation.description,
        dangerTier: presentation.dangerTier,
        rewardBias: presentation.rewardBias,
        choiceCount: getNodeChoiceCount(nodeType),
        laneWeights: getBaseLaneWeights(nodeType),
        forcedLanes: getForcedLanes(nodeType),
        nextNodeIds: [],
        resolved: false,
        unlocked: false,
    };
}
function connectNodeLayers(nodesById, edges, fromLayer, toLayer, rng) {
    if (fromLayer.length === 0 || toLayer.length === 0) {
        return;
    }
    const addEdge = (fromId, toId) => {
        const fromNode = nodesById[fromId];
        const toNode = nodesById[toId];
        if (!fromNode || !toNode) {
            return;
        }
        if (!fromNode.nextNodeIds.includes(toId)) {
            fromNode.nextNodeIds.push(toId);
            edges.push({ fromNodeId: fromId, toNodeId: toId });
        }
    };
    fromLayer.forEach((fromNode, index) => {
        const anchor = Math.floor((index / Math.max(1, fromLayer.length - 1)) * Math.max(0, toLayer.length - 1));
        addEdge(fromNode.id, toLayer[anchor]?.id ?? toLayer[0].id);
        const neighborIndex = Math.min(toLayer.length - 1, anchor + 1);
        if (neighborIndex !== anchor && rng() > 0.35) {
            addEdge(fromNode.id, toLayer[neighborIndex].id);
        }
        if (anchor > 0 && rng() > 0.75) {
            addEdge(fromNode.id, toLayer[anchor - 1].id);
        }
    });
    toLayer.forEach((toNode, index) => {
        const hasIncoming = edges.some((edge) => edge.toNodeId === toNode.id);
        if (hasIncoming) {
            return;
        }
        const fallbackFrom = fromLayer[Math.min(fromLayer.length - 1, index)] ?? fromLayer[0];
        addEdge(fallbackFrom.id, toNode.id);
    });
}
function ensureStratumGenerated(run, stratum) {
    const existingIds = Object.values(run.nodesById).filter((node) => node.stratum === stratum);
    if (existingIds.length > 0) {
        return run;
    }
    const rng = createSeededRng(`${run.seed}:stratum:${stratum}`);
    const layerSpecs = [
        { count: 3, types: ["encounter", "encounter", "support"] },
        { count: randomInt(rng, 2, 3), types: ["encounter", "encounter", "support"] },
        { count: randomInt(rng, 2, 3), types: ["elite", "support", "elite"] },
        { count: randomInt(rng, 2, 3), types: ["encounter", "support", "encounter"] },
    ];
    if (stratum % 3 === 0) {
        layerSpecs.push({ count: 1, types: ["boss_chain_a"] });
        layerSpecs.push({ count: 1, types: ["boss_chain_b"] });
    }
    else {
        layerSpecs.push({ count: 1, types: ["boss"] });
    }
    layerSpecs.push({ count: 1, types: ["milestone"] });
    const nextNodesById = { ...run.nodesById };
    const nextEdges = [...run.edges];
    const layers = [];
    layerSpecs.forEach((spec, layerIndex) => {
        const layer = layerIndex + 1;
        const nodes = [];
        for (let i = 0; i < spec.count; i += 1) {
            const nodeType = spec.types[i % spec.types.length];
            const node = createStratumNode(run, stratum, layer, i, nodeType);
            nextNodesById[node.id] = node;
            nodes.push(node);
        }
        layers.push(nodes);
    });
    for (let index = 0; index < layers.length - 1; index += 1) {
        connectNodeLayers(nextNodesById, nextEdges, layers[index], layers[index + 1], rng);
    }
    return {
        ...run,
        nodesById: nextNodesById,
        edges: nextEdges,
    };
}
function getStratumNodes(run, stratum) {
    return Object.values(run.nodesById)
        .filter((node) => node.stratum === stratum)
        .sort((left, right) => left.layer - right.layer || left.branchIndex - right.branchIndex);
}
function getEntryNodeIds(run, stratum) {
    return getStratumNodes(run, stratum)
        .filter((node) => node.layer === 1)
        .map((node) => node.id);
}
function getNode(run, nodeId) {
    if (!nodeId) {
        return null;
    }
    return run.nodesById[nodeId] ?? null;
}
function readEchoRun() {
    return getGameState().echoRun ?? null;
}
function persistEchoRun(run, extras) {
    updateGameState((prev) => ({
        ...prev,
        echoRun: run,
        phase: extras?.phase ?? prev.phase,
        currentBattle: extras && "currentBattle" in extras ? extras.currentBattle ?? null : prev.currentBattle,
    }));
    if (extras?.autosave !== false) {
        void triggerAutosave(getGameState());
    }
    return run;
}
function stripBattleRuntime(unit, nextHp = unit.hp) {
    const unitAny = cloneEchoUnit(unit);
    return {
        ...unitAny,
        hp: Math.max(0, Math.min(unitAny.maxHp, nextHp)),
        pos: null,
        hand: [],
        drawPile: [],
        discardPile: [],
        strain: 0,
        buffs: [],
    };
}
function applyRecoveryToRun(run, recovery) {
    const livingUnits = run.squadUnitIds
        .map((unitId) => run.unitsById[unitId])
        .filter((unit) => Boolean(unit));
    let lowestUnitId = null;
    if (recovery.healMode === "lowest_full_all_percent" && livingUnits.length > 0) {
        lowestUnitId = [...livingUnits]
            .sort((left, right) => (left.hp / Math.max(1, left.maxHp)) - (right.hp / Math.max(1, right.maxHp)))[0]?.id ?? null;
    }
    const nextUnitsById = {};
    Object.entries(run.unitsById).forEach(([unitId, unit]) => {
        if (!run.squadUnitIds.includes(unitId)) {
            nextUnitsById[unitId] = unit;
            return;
        }
        const unitAny = cloneEchoUnit(unit);
        const maxHp = unitAny.maxHp;
        let nextHp = unitAny.hp;
        if (recovery.healMode === "all_percent") {
            nextHp = Math.min(maxHp, nextHp + Math.ceil(maxHp * (recovery.allHealPercent ?? 0)));
        }
        else if (recovery.healMode === "lowest_full_all_percent") {
            if (unitId === lowestUnitId) {
                nextHp = maxHp;
            }
            else {
                nextHp = Math.min(maxHp, nextHp + Math.ceil(maxHp * (recovery.otherHealPercent ?? 0)));
            }
        }
        nextUnitsById[unitId] = stripBattleRuntime(unitAny, nextHp);
    });
    return {
        ...run,
        unitsById: nextUnitsById,
        rerolls: run.rerolls + (recovery.rerollsGranted ?? 0),
    };
}
function applyTrainingToRun(run, training) {
    const nextUnitsById = {};
    Object.entries(run.unitsById).forEach(([unitId, unit]) => {
        if (!run.squadUnitIds.includes(unitId)) {
            nextUnitsById[unitId] = unit;
            return;
        }
        const unitAny = cloneEchoUnit(unit);
        const stats = {
            ...(unitAny.stats ?? {
                maxHp: unitAny.maxHp,
                atk: unitAny.atk ?? 0,
                def: unitAny.def ?? 0,
                agi: unitAny.agi,
                acc: unitAny.acc ?? 80,
            }),
        };
        switch (training.stat) {
            case "atk":
                stats.atk += training.amount;
                unitAny.atk = (unitAny.atk ?? stats.atk - training.amount) + training.amount;
                break;
            case "def":
                stats.def += training.amount;
                unitAny.def = (unitAny.def ?? stats.def - training.amount) + training.amount;
                break;
            case "agi":
                stats.agi += training.amount;
                unitAny.agi += training.amount;
                break;
            case "acc":
                stats.acc += training.amount;
                unitAny.acc = (unitAny.acc ?? stats.acc - training.amount) + training.amount;
                break;
        }
        nextUnitsById[unitId] = stripBattleRuntime({
            ...unitAny,
            stats,
        }, unitAny.hp);
    });
    return {
        ...run,
        unitsById: nextUnitsById,
    };
}
function completeNode(run, nodeId) {
    const node = getNode(run, nodeId);
    if (!node) {
        return run;
    }
    const nextNodesById = { ...run.nodesById };
    nextNodesById[node.id] = {
        ...node,
        resolved: true,
        unlocked: true,
    };
    const unlockedNextIds = node.nextNodeIds.filter((nextNodeId) => Boolean(nextNodesById[nextNodeId]));
    unlockedNextIds.forEach((nextNodeId) => {
        nextNodesById[nextNodeId] = {
            ...nextNodesById[nextNodeId],
            unlocked: true,
        };
    });
    return {
        ...run,
        nodesById: nextNodesById,
        completedNodeIds: uniqueIds([...run.completedNodeIds, node.id]),
        availableNodeIds: unlockedNextIds,
        currentNodeId: node.id,
        pendingNodeId: null,
        lastResolvedNodeType: node.nodeType,
    };
}
function enterRewardStage(run, nodeId) {
    const node = getNode(run, nodeId);
    if (!node) {
        return run;
    }
    return {
        ...run,
        stage: "reward",
        draftChoices: createRewardChoicesForNode(run, node),
    };
}
function enterMilestoneStage(run, nodeId) {
    const node = getNode(run, nodeId);
    if (!node) {
        return run;
    }
    return {
        ...run,
        stage: "milestone",
        currentNodeId: node.id,
        pendingNodeId: null,
        draftChoices: createMilestoneChoices(run, node.id),
    };
}
function buildFirstMapState(run) {
    const withStratum = ensureStratumGenerated(run, 1);
    return {
        ...withStratum,
        stage: "map",
        currentStratum: 1,
        availableNodeIds: getEntryNodeIds(withStratum, 1),
        draftChoices: [],
        currentNodeId: null,
        pendingNodeId: null,
        lastResolvedNodeType: null,
    };
}
function advanceToNextStratum(run) {
    const nextStratum = run.currentStratum + 1;
    const withStratum = ensureStratumGenerated(run, nextStratum);
    return {
        ...withStratum,
        stage: "map",
        currentStratum: nextStratum,
        availableNodeIds: getEntryNodeIds(withStratum, nextStratum),
        draftChoices: [],
        pendingNodeId: null,
        resultsSummary: null,
    };
}
function getEncounterTypeScale(encounterType) {
    switch (encounterType) {
        case "elite":
            return 1;
        case "boss":
            return 2;
        case "boss_chain_a":
            return 2;
        case "boss_chain_b":
            return 3;
        case "checkpoint":
            return 1;
        case "standard":
        default:
            return 0;
    }
}
function createEchoChallenge(run, encounterType, node) {
    const rng = createSeededRng(`${run.seed}:challenge:${run.encounterNumber}:${encounterType}:${node?.id ?? "none"}`);
    const challengeType = pickOne(rng, ["no_losses", "turn_limit", "field_triggers"]);
    const nodeBonus = node?.dangerTier ?? 0;
    switch (challengeType) {
        case "no_losses":
            return {
                id: `echo_challenge_${run.encounterNumber}_no_losses`,
                type: "no_losses",
                title: "No Losses",
                description: "Win the encounter without losing a drafted unit.",
                target: 1,
                rewardRerolls: 1,
                scoreBonus: 80 + nodeBonus * 20,
            };
        case "field_triggers":
            return {
                id: `echo_challenge_${run.encounterNumber}_field_triggers`,
                type: "field_triggers",
                title: "Field Sync",
                description: "Trigger Echo Field effects multiple times this battle.",
                target: Math.max(2, 2 + getEncounterTypeScale(encounterType)),
                rewardRerolls: 1,
                scoreBonus: 70 + nodeBonus * 20,
            };
        case "turn_limit":
        default:
            return {
                id: `echo_challenge_${run.encounterNumber}_turn_limit`,
                type: "turn_limit",
                title: "Fast Break",
                description: "Finish the encounter before the turn limit expires.",
                target: Math.max(4, 7 - getEncounterTypeScale(encounterType)),
                rewardRerolls: 1,
                scoreBonus: 90 + nodeBonus * 20,
            };
    }
}
function getEncounterEnemyPool(encounterType) {
    switch (encounterType) {
        case "boss":
        case "boss_chain_b":
            return ["artillery_crew", "basic_infantry", "gate_sentry", "corrupted_scout"];
        case "boss_chain_a":
        case "elite":
            return ["basic_infantry", "gate_sentry", "corrupted_scout", "artillery_crew"];
        case "checkpoint":
            return ["artillery_crew", "basic_infantry", "gate_sentry"];
        case "standard":
        default:
            return ["gate_sentry", "corrupted_scout", "basic_infantry"];
    }
}
function createEchoEncounter(run, node) {
    const encounterType = node.encounterType ?? "standard";
    const rng = createSeededRng(`${run.seed}:encounter:${node.id}:${run.encounterNumber}`);
    const livingUnits = run.squadUnitIds.filter((unitId) => run.unitsById[unitId]);
    const squadSize = livingUnits.length;
    const gridHeight = Math.max(5, Math.min(9, squadSize + 2));
    const gridWidth = Math.max(7, Math.min(12, 7 + run.currentStratum + Math.floor(node.dangerTier / 2)));
    const encounterPressure = run.currentStratum + node.dangerTier + getEncounterTypeScale(encounterType);
    const baseEnemyCount = Math.max(3, squadSize + Math.floor(encounterPressure / 2));
    const enemyCount = encounterType === "boss" || encounterType === "boss_chain_b"
        ? Math.min(11, baseEnemyCount + 3)
        : encounterType === "boss_chain_a" || encounterType === "elite"
            ? Math.min(10, baseEnemyCount + 2)
            : Math.min(8, baseEnemyCount + 1);
    const pool = getEncounterEnemyPool(encounterType);
    const counts = new Map();
    for (let i = 0; i < enemyCount; i += 1) {
        const enemyId = pickOne(rng, pool);
        counts.set(enemyId, (counts.get(enemyId) ?? 0) + 1);
    }
    const eliteSlots = encounterType === "boss_chain_b"
        ? 2
        : encounterType === "boss" || encounterType === "boss_chain_a" || encounterType === "elite"
            ? 1
            : 0;
    const enemyUnits = Array.from(counts.entries()).map(([enemyId, count], index) => ({
        enemyId,
        count,
        levelMod: Math.max(0, run.currentStratum - 1 + Math.floor(node.dangerTier / 2)),
        elite: index < eliteSlots,
    }));
    const introText = encounterType === "boss" || encounterType === "boss_chain_a" || encounterType === "boss_chain_b"
        ? "SLK//ECHO  :: Boss pressure cresting. Command feed locking to strike geometry."
        : encounterType === "elite"
            ? "SLK//ECHO  :: Elite contact detected. Tactical draft proving ground live."
            : "SLK//ECHO  :: Simulation contact established. Draft squad entering engagement.";
    return {
        enemyUnits,
        gridWidth,
        gridHeight,
        introText,
        floorId: `echo_stratum_${run.currentStratum}`,
        roomId: node.id,
    };
}
function buildEchoBattleModeContext(run, node) {
    return {
        kind: "echo",
        echo: {
            runId: run.id,
            nodeId: node.id,
            stratum: run.currentStratum,
            encounterNumber: run.encounterNumber,
            encounterType: node.encounterType ?? "standard",
            placementMode: "units",
            availableFields: run.fields.map((field) => ({ ...field })),
            fieldPlacements: [],
            selectedFieldDraftId: run.fields[0]?.draftId ?? null,
            activeChallenge: createEchoChallenge(run, node.encounterType ?? "standard", node),
            fieldTriggerCount: 0,
            startUnitIds: [...run.squadUnitIds],
        },
    };
}
function buildEchoScoreSummary(run) {
    return {
        totalScore: run.totalScore,
        encountersCleared: Math.max(0, run.encounterNumber - 1),
        unitsDrafted: run.unitsDrafted,
        unitsLost: run.unitsLost,
        fieldsDrafted: run.fieldsDrafted,
        fieldsUpgraded: run.fieldsUpgraded,
        tacticalModifiersDrafted: run.tacticalModifiersDrafted,
        challengesCompleted: run.challengesCompleted,
    };
}
function buildEchoEncounterScore(encounterNumber, encounterType, survivingCount, challengeBonus, nodeDangerTier) {
    const baseScore = 100 + encounterNumber * 45;
    const typeBonus = encounterType === "boss" || encounterType === "boss_chain_b"
        ? 220
        : encounterType === "boss_chain_a"
            ? 140
            : encounterType === "elite"
                ? 90
                : 0;
    return baseScore + typeBonus + survivingCount * 20 + challengeBonus + nodeDangerTier * 15;
}
function summarizeChallengeResult(challenge, battle, lostCount) {
    if (!challenge) {
        return { completed: false, failed: false, rerollsEarned: 0, bonusScore: 0 };
    }
    let completed = false;
    switch (challenge.type) {
        case "no_losses":
            completed = lostCount === 0;
            break;
        case "turn_limit":
            completed = battle.turnCount <= challenge.target;
            break;
        case "field_triggers":
            completed = (battle.modeContext?.echo?.fieldTriggerCount ?? 0) >= challenge.target;
            break;
    }
    return {
        completed,
        failed: !completed,
        rerollsEarned: completed ? challenge.rewardRerolls : 0,
        bonusScore: completed ? challenge.scoreBonus : 0,
    };
}
export function summarizeEchoEncounter(battle) {
    const echoContext = battle.modeContext?.kind === "echo" ? battle.modeContext.echo ?? null : null;
    const run = readEchoRun();
    if (!echoContext || !run) {
        return null;
    }
    const node = getNode(run, echoContext.nodeId ?? run.pendingNodeId ?? null);
    const survivingUnitIds = echoContext.startUnitIds.filter((unitId) => {
        const unit = battle.units[unitId];
        return Boolean(unit && unit.hp > 0);
    });
    const lostUnitIds = echoContext.startUnitIds.filter((unitId) => !survivingUnitIds.includes(unitId));
    const challengeResult = summarizeChallengeResult(echoContext.activeChallenge, battle, lostUnitIds.length);
    return {
        encounterNumber: echoContext.encounterNumber,
        encounterType: echoContext.encounterType,
        challenge: echoContext.activeChallenge ?? null,
        challengeCompleted: challengeResult.completed,
        challengeFailed: challengeResult.failed,
        rerollsEarned: challengeResult.rerollsEarned,
        scoreGained: buildEchoEncounterScore(echoContext.encounterNumber, echoContext.encounterType, survivingUnitIds.length, challengeResult.bonusScore, node?.dangerTier ?? 1),
        survivingUnitIds,
        lostUnitIds,
        fieldTriggerCount: echoContext.fieldTriggerCount ?? 0,
        turnCount: battle.turnCount,
    };
}
export function getActiveEchoRun() {
    return readEchoRun();
}
export function hasActiveEchoRun() {
    return readEchoRun() !== null;
}
export function clearActiveEchoRun() {
    updateGameState((prev) => ({
        ...prev,
        echoRun: null,
    }));
}
export function isEchoBattle(battle) {
    return battle?.modeContext?.kind === "echo";
}
export function getEchoDraftChoices() {
    return readEchoRun()?.draftChoices ?? [];
}
export function startEchoRunSession() {
    enableAutosave(() => getGameState());
    const runId = createEchoRunId();
    const run = {
        id: runId,
        seed: `${runId}_${Math.random().toString(36).slice(2, 8)}`,
        stage: "initial_units",
        currentStratum: 1,
        milestonesReached: 0,
        bossChainsCleared: 0,
        currentNodeId: null,
        nodesById: {},
        edges: [],
        completedNodeIds: [],
        availableNodeIds: [],
        pendingNodeId: null,
        lastResolvedNodeType: null,
        encounterNumber: 1,
        unitsById: {},
        squadUnitIds: [],
        fields: [],
        tacticalModifiers: [],
        rerolls: 0,
        draftChoices: generateInitialUnitChoices(runId, 0),
        currentChallenge: null,
        lastEncounterSummary: null,
        resultsSummary: null,
        unitsDrafted: 0,
        unitsLost: 0,
        fieldsDrafted: 0,
        fieldsUpgraded: 0,
        tacticalModifiersDrafted: 0,
        challengesCompleted: 0,
        totalScore: 0,
    };
    persistEchoRun(run, {
        phase: "echo",
        currentBattle: null,
    });
    return run;
}
export function rerollActiveEchoChoices() {
    const run = readEchoRun();
    if (!run || run.rerolls <= 0 || (run.stage !== "reward" && run.stage !== "milestone")) {
        return run;
    }
    const nextRun = {
        ...run,
        rerolls: run.rerolls - 1,
        draftChoices: run.stage === "milestone"
            ? createMilestoneChoices(run, run.currentNodeId ?? `milestone_${run.currentStratum}`)
            : (() => {
                const sourceNode = getNode(run, run.currentNodeId ?? run.pendingNodeId);
                return sourceNode ? createRewardChoicesForNode(run, sourceNode) : run.draftChoices;
            })(),
    };
    return persistEchoRun(nextRun, { phase: "echo", currentBattle: null });
}
function applyDraftChoiceToRun(run, choice) {
    if (choice.optionType === "unit_draft" && choice.unitOption) {
        const newUnit = createRuntimeEchoUnit(run, choice.unitOption);
        const nextRun = {
            ...run,
            unitsById: {
                ...run.unitsById,
                [newUnit.id]: newUnit,
            },
            squadUnitIds: [...run.squadUnitIds, newUnit.id],
            unitsDrafted: run.unitsDrafted + 1,
        };
        if (run.stage === "initial_units") {
            const picksSoFar = nextRun.squadUnitIds.length;
            return picksSoFar >= STARTING_SQUAD_SIZE
                ? {
                    ...nextRun,
                    stage: "initial_field",
                    draftChoices: generateInitialFieldChoices(nextRun.id),
                }
                : {
                    ...nextRun,
                    draftChoices: generateInitialUnitChoices(nextRun.id, picksSoFar),
                };
        }
        return {
            ...nextRun,
            draftChoices: [],
            stage: run.stage,
        };
    }
    if (choice.optionType === "field_draft" && choice.fieldDefinition) {
        const nextRun = {
            ...run,
            fields: [...run.fields, { ...choice.fieldDefinition, maxLevel: MAX_FIELD_LEVEL }],
            fieldsDrafted: run.fieldsDrafted + 1,
        };
        if (run.stage === "initial_field") {
            return buildFirstMapState(nextRun);
        }
        return nextRun;
    }
    if (choice.optionType === "field_upgrade" && choice.fieldDefinition) {
        return {
            ...run,
            fields: run.fields.map((field) => (field.draftId === choice.fieldDefinition?.draftId
                ? buildEchoFieldDefinition(field.id, field.draftId, Math.min(MAX_FIELD_LEVEL, field.level + 1))
                : field)),
            fieldsUpgraded: run.fieldsUpgraded + 1,
        };
    }
    if (choice.optionType === "modifier_draft" && choice.modifierDefId) {
        const modifierInstance = createModifierInstance(choice.modifierDefId, run.id, run.tacticalModifiersDrafted + 1, choice.id);
        return {
            ...run,
            tacticalModifiers: [...run.tacticalModifiers, modifierInstance],
            tacticalModifiersDrafted: run.tacticalModifiersDrafted + 1,
        };
    }
    if (choice.optionType === "recovery_draft" && choice.recoveryOption) {
        return applyRecoveryToRun(run, choice.recoveryOption);
    }
    if (choice.optionType === "training_draft" && choice.trainingOption) {
        return applyTrainingToRun(run, choice.trainingOption);
    }
    return run;
}
export function applyEchoDraftChoice(choiceId) {
    const run = readEchoRun();
    if (!run) {
        return null;
    }
    const choice = run.draftChoices.find((entry) => entry.id === choiceId);
    if (!choice) {
        return run;
    }
    let nextRun = applyDraftChoiceToRun(run, choice);
    if (run.stage === "reward") {
        nextRun = {
            ...nextRun,
            stage: "map",
            draftChoices: [],
            currentChallenge: null,
            lastEncounterSummary: nextRun.lastEncounterSummary ?? null,
        };
    }
    else if (run.stage === "milestone") {
        const milestoneNodeId = run.currentNodeId;
        const completedMilestone = milestoneNodeId ? completeNode(nextRun, milestoneNodeId) : nextRun;
        nextRun = advanceToNextStratum({
            ...completedMilestone,
            milestonesReached: completedMilestone.milestonesReached + 1,
            draftChoices: [],
        });
    }
    return persistEchoRun(nextRun, {
        phase: "echo",
        currentBattle: null,
    });
}
export function selectEchoMapNode(nodeId) {
    const run = readEchoRun();
    if (!run || run.stage !== "map" || !run.availableNodeIds.includes(nodeId)) {
        return null;
    }
    const node = getNode(run, nodeId);
    if (!node) {
        return null;
    }
    if (node.nodeType === "support") {
        const completed = completeNode(run, node.id);
        const rewardRun = enterRewardStage(completed, node.id);
        persistEchoRun(rewardRun, {
            phase: "echo",
            currentBattle: null,
        });
        return "reward";
    }
    const nextRun = {
        ...run,
        pendingNodeId: node.id,
        currentNodeId: node.id,
        currentChallenge: createEchoChallenge(run, node.encounterType ?? "standard", node),
        lastEncounterSummary: null,
    };
    persistEchoRun(nextRun, {
        phase: "echo",
        currentBattle: null,
    });
    return "battle";
}
export function getEchoModifierHardpoints(unitIds) {
    const run = readEchoRun();
    if (!run) {
        return {};
    }
    const hardpoints = {};
    unitIds.forEach((unitId) => {
        hardpoints[unitId] = [null, null];
    });
    let index = 0;
    run.tacticalModifiers.forEach((modifier) => {
        const unitId = unitIds[Math.floor(index / 2)];
        if (!unitId) {
            return;
        }
        const slot = index % 2;
        hardpoints[unitId][slot] = modifier;
        index += 1;
    });
    return hardpoints;
}
export function launchActiveEchoEncounterBattle() {
    const run = readEchoRun();
    if (!run) {
        return null;
    }
    const node = getNode(run, run.pendingNodeId ?? run.currentNodeId);
    if (!node || !node.encounterType) {
        return null;
    }
    const encounter = createEchoEncounter(run, node);
    const state = getGameState();
    const unitIds = run.squadUnitIds.filter((unitId) => run.unitsById[unitId] && run.unitsById[unitId].hp > 0);
    const unitsById = Object.fromEntries(unitIds.map((unitId) => {
        const unit = stripBattleRuntime(run.unitsById[unitId], run.unitsById[unitId].hp);
        return [unitId, unit];
    }));
    const battle = createBattleFromEncounter(state, encounter, `${run.seed}:battle:${node.id}:${run.encounterNumber}`, {
        partyUnitIds: unitIds,
        unitsById,
        maxUnitsPerSide: unitIds.length,
        modeContext: buildEchoBattleModeContext(run, node),
    });
    const nextRun = {
        ...run,
        currentChallenge: battle.modeContext?.echo?.activeChallenge ?? null,
        lastEncounterSummary: null,
    };
    persistEchoRun(nextRun, {
        phase: "echo",
        currentBattle: null,
    });
    return battle;
}
export function commitEchoEncounterVictory(battle) {
    const run = readEchoRun();
    if (!run) {
        return null;
    }
    const summary = summarizeEchoEncounter(battle);
    if (!summary) {
        return run;
    }
    const nodeId = battle.modeContext?.echo?.nodeId ?? run.pendingNodeId ?? run.currentNodeId;
    const node = getNode(run, nodeId);
    const survivingIds = new Set(summary.survivingUnitIds);
    const nextUnitsById = { ...run.unitsById };
    Object.keys(nextUnitsById).forEach((unitId) => {
        if (!survivingIds.has(unitId)) {
            delete nextUnitsById[unitId];
            return;
        }
        const battleUnit = battle.units[unitId];
        const unit = nextUnitsById[unitId];
        nextUnitsById[unitId] = stripBattleRuntime(unit, battleUnit?.hp ?? unit.hp);
    });
    let nextRun = {
        ...run,
        unitsById: nextUnitsById,
        squadUnitIds: run.squadUnitIds.filter((unitId) => survivingIds.has(unitId)),
        rerolls: run.rerolls + summary.rerollsEarned,
        unitsLost: run.unitsLost + summary.lostUnitIds.length,
        challengesCompleted: run.challengesCompleted + (summary.challengeCompleted ? 1 : 0),
        totalScore: run.totalScore + summary.scoreGained,
        encounterNumber: run.encounterNumber + 1,
        lastEncounterSummary: summary,
        currentChallenge: null,
        pendingNodeId: null,
    };
    if (node) {
        nextRun = completeNode(nextRun, node.id);
        if (node.nodeType === "boss_chain_b") {
            nextRun = {
                ...nextRun,
                bossChainsCleared: nextRun.bossChainsCleared + 1,
            };
        }
        if (node.nodeType === "boss" || node.nodeType === "boss_chain_b") {
            const milestoneNodeId = nextRun.availableNodeIds[0] ?? node.nextNodeIds[0] ?? null;
            nextRun = milestoneNodeId
                ? enterMilestoneStage(nextRun, milestoneNodeId)
                : {
                    ...nextRun,
                    stage: "map",
                    draftChoices: [],
                };
        }
        else {
            nextRun = enterRewardStage(nextRun, node.id);
        }
    }
    else {
        nextRun = {
            ...nextRun,
            stage: "reward",
            draftChoices: [],
        };
    }
    return persistEchoRun(nextRun, {
        phase: "echo",
        currentBattle: null,
    });
}
export function finalizeEchoRunFromBattleDefeat(battle) {
    const run = readEchoRun();
    if (!run) {
        return null;
    }
    const summary = summarizeEchoEncounter(battle) ?? {
        encounterNumber: run.encounterNumber,
        encounterType: battle.modeContext?.echo?.encounterType ?? "standard",
        challenge: run.currentChallenge ?? null,
        challengeCompleted: false,
        challengeFailed: true,
        rerollsEarned: 0,
        scoreGained: 0,
        survivingUnitIds: [],
        lostUnitIds: [...run.squadUnitIds],
        fieldTriggerCount: battle.modeContext?.echo?.fieldTriggerCount ?? 0,
        turnCount: battle.turnCount,
    };
    const defeatedRun = {
        ...run,
        unitsById: {},
        squadUnitIds: [],
        unitsLost: run.unitsLost + summary.lostUnitIds.length,
        lastEncounterSummary: summary,
        currentChallenge: null,
        pendingNodeId: null,
        stage: "results",
        draftChoices: [],
    };
    const resultsRun = {
        ...defeatedRun,
        resultsSummary: buildEchoScoreSummary(defeatedRun),
    };
    return persistEchoRun(resultsRun, {
        phase: "echo",
        currentBattle: null,
    });
}
export function abandonActiveEchoRun() {
    const run = readEchoRun();
    if (!run) {
        return null;
    }
    const nextRun = {
        ...run,
        stage: "results",
        draftChoices: [],
        pendingNodeId: null,
        currentChallenge: null,
        resultsSummary: buildEchoScoreSummary(run),
    };
    return persistEchoRun(nextRun, {
        phase: "echo",
        currentBattle: null,
    });
}
export function getEchoResultsSummary() {
    const run = readEchoRun();
    return run?.resultsSummary ?? (run ? buildEchoScoreSummary(run) : null);
}
export function getEchoModifierDef(modifierId) {
    if (!modifierId) {
        return null;
    }
    return getFieldModDef(modifierId) ?? null;
}

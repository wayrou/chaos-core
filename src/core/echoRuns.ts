import { getGameState } from "../state/gameStore";
import {
  BattleModeContext,
  EchoChallenge,
  EchoEncounterSummary,
  EchoEncounterType,
  EchoFieldDefinition,
  EchoRewardChoice,
  EchoRunState,
  EchoScoreSummary,
  EchoUnitDraftOption,
  Unit,
  UnitAffinities,
} from "./types";
import { disableAutosave } from "./saveSystem";
import { buildEchoFieldDefinition, getEchoFieldCatalog } from "./echoFieldEffects";
import { getAllStarterEquipment, canEquipWeapon, type Equipment, type UnitLoadout } from "./equipment";
import { getClassDefinition, type ClassId } from "./classes";
import { calculatePWR, getPWRBand } from "./pwr";
import { createDefaultAffinities } from "./affinity";
import { createBattleFromEncounter } from "./battleFromEncounter";
import { getAllFieldModDefs, getFieldModDef } from "./fieldModDefinitions";
import type { EncounterDefinition } from "./campaign";
import type { BattleState } from "./battle";
import type { FieldModDef, FieldModInstance } from "./fieldMods";

const STARTING_SQUAD_SIZE = 3;
const UNIT_DRAFT_CHOICE_COUNT = 3;
const FIELD_DRAFT_CHOICE_COUNT = 3;
const MAX_FIELD_LEVEL = 5;
const DEFAULT_ECHO_PORTRAIT = "/assets/portraits/units/core/Test_Portrait.png";
const ECHO_SQUAD_SCOPE_MODS = getAllFieldModDefs().filter((mod) => mod.scope === "squad");

type EchoDraftClass = "squire" | "ranger" | "magician" | "thief" | "academic" | "freelancer";

const CLASS_NAME_POOLS: Record<EchoDraftClass, string[]> = {
  squire: ["Bram", "Cael", "Dorin", "Iris", "Mira", "Rook", "Tamsin", "Vale"],
  ranger: ["Ash", "Hawke", "Lark", "Mira", "Peregrin", "Quill", "Sable", "Voss"],
  magician: ["Aster", "Cinder", "Edda", "Lyra", "Nyx", "Orin", "Vex", "Zephyr"],
  thief: ["Cipher", "Flint", "Kestrel", "Nix", "Riven", "Shade", "Siv", "Wren"],
  academic: ["Alden", "Cato", "Faye", "Maren", "Orrin", "Quen", "Tallis", "Vela"],
  freelancer: ["Ember", "Galen", "Juno", "Keir", "Pax", "Reeve", "Soren", "Tarin"],
};

const CLASS_TRAIT_POOLS: Record<EchoDraftClass, string[]> = {
  squire: ["Anchor Stance", "Frontline Poise", "Shield Rhythm"],
  ranger: ["Long Sight", "Wind Runner", "Hunt Focus"],
  magician: ["Arc Surge", "Chaos Intake", "Spell Lattice"],
  thief: ["Ghost Step", "Knife Drift", "Slipstream"],
  academic: ["Signal Analyst", "Directive Memory", "Measured Volley"],
  freelancer: ["Open Manual", "Loose Doctrine", "Adaptive Frame"],
};

let activeEchoRun: EchoRunState | null = null;

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRng(seed: string): () => number {
  let state = hashSeed(seed) || 1;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    return ((state >>> 0) % 0x100000000) / 0x100000000;
  };
}

function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickOne<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)] ?? items[0];
}

function pickWeighted<T extends string>(rng: () => number, weights: Record<T, number>): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
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

function cloneAffinities(affinities: UnitAffinities): UnitAffinities {
  return {
    melee: affinities.melee,
    ranged: affinities.ranged,
    magic: affinities.magic,
    support: affinities.support,
    mobility: affinities.mobility,
    survival: affinities.survival,
  };
}

function createEchoRunId(): string {
  return `echo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getDraftClassWeights(run: EchoRunState | null, encounterDepth: number): Record<EchoDraftClass, number> {
  const weights: Record<EchoDraftClass, number> = {
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
    if (!affinities) return;
    affinityTotals.melee += affinities.melee;
    affinityTotals.ranged += affinities.ranged;
    affinityTotals.magic += affinities.magic;
    affinityTotals.support += affinities.support;
    affinityTotals.mobility += affinities.mobility;
    affinityTotals.survival += affinities.survival;
  });

  const dominantAffinity = (Object.entries(affinityTotals) as Array<[keyof UnitAffinities, number]>)
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

function getAllowedDraftClasses(encounterDepth: number): EchoDraftClass[] {
  const base: EchoDraftClass[] = ["squire", "ranger", "magician", "thief"];
  if (encounterDepth >= 3) {
    base.push("academic");
  }
  if (encounterDepth >= 6) {
    base.push("freelancer");
  }
  return base;
}

function createAffinityBiasForClass(unitClass: EchoDraftClass, encounterDepth: number, rng: () => number): UnitAffinities {
  const affinities = createDefaultAffinities();
  const depthBonus = Math.min(40, encounterDepth * 4);

  const apply = (key: keyof UnitAffinities, amount: number) => {
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

  const keys = Object.keys(affinities) as Array<keyof UnitAffinities>;
  keys.forEach((key) => {
    affinities[key] += randomInt(rng, 0, 3);
  });

  return affinities;
}

function getTopAffinityLean(affinities: UnitAffinities): Array<keyof UnitAffinities> {
  return (Object.entries(affinities) as Array<[keyof UnitAffinities, number]>)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([affinity]) => affinity);
}

function getEquipmentPools(): {
  weapons: Equipment[];
  helmets: Equipment[];
  chestpieces: Equipment[];
  accessories: Equipment[];
} {
  const allEquipment = Object.values(getAllStarterEquipment());
  return {
    weapons: allEquipment.filter((equipment) => equipment.slot === "weapon"),
    helmets: allEquipment.filter((equipment) => equipment.slot === "helmet"),
    chestpieces: allEquipment.filter((equipment) => equipment.slot === "chestpiece"),
    accessories: allEquipment.filter((equipment) => equipment.slot === "accessory"),
  };
}

function rollEchoLoadout(unitClass: EchoDraftClass, encounterDepth: number, rng: () => number): UnitLoadout {
  const equipmentPools = getEquipmentPools();
  const allowedWeapons = equipmentPools.weapons.filter((equipment) => (
    equipment.slot === "weapon" && canEquipWeapon(unitClass as ClassId, equipment.weaponType)
  ));

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

function createEchoStats(unitClass: EchoDraftClass, encounterDepth: number, rng: () => number) {
  const classDef = getClassDefinition(unitClass as ClassId);
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

function createEchoUnitDraftOption(run: EchoRunState | null, optionIndex: number, encounterDepth: number, seedKey: string): EchoUnitDraftOption {
  const rng = createSeededRng(`${seedKey}:${optionIndex}`);
  const allowedClasses = getAllowedDraftClasses(encounterDepth);
  const weightedClassPool = getDraftClassWeights(run, encounterDepth);
  const filteredWeights = Object.fromEntries(
    allowedClasses.map((unitClass) => [unitClass, weightedClassPool[unitClass]]),
  ) as Record<EchoDraftClass, number>;

  const unitClass = pickWeighted(rng, filteredWeights);
  const namePool = CLASS_NAME_POOLS[unitClass];
  const stats = createEchoStats(unitClass, encounterDepth, rng);
  const affinities = createAffinityBiasForClass(unitClass, encounterDepth, rng);
  const loadout = rollEchoLoadout(unitClass, encounterDepth, rng);
  const previewEquipment = Object.values(loadout).filter(Boolean) as string[];

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
  } as Unit;

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

function createRuntimeEchoUnit(run: EchoRunState, option: EchoUnitDraftOption): Unit {
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
  } as Unit;
}

function createFieldChoice(field: EchoFieldDefinition, choiceId: string, optionType: EchoRewardChoice["optionType"]): EchoRewardChoice {
  const subtitle = optionType === "field_upgrade"
    ? `Upgrade ${field.name} to LV ${field.level + 1}`
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

function createModifierChoice(modifier: FieldModDef, choiceId: string): EchoRewardChoice {
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

function createUnitChoice(choice: EchoUnitDraftOption, choiceId: string): EchoRewardChoice {
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

function getFieldLaneChoice(run: EchoRunState, rewardSeed: string): EchoRewardChoice {
  const rng = createSeededRng(`field_lane:${rewardSeed}`);
  const missingFields = getEchoFieldCatalog().filter((field) => !run.fields.some((owned) => owned.id === field.id));
  if (missingFields.length > 0) {
    const baseChoice = pickOne(rng, missingFields);
    const choiceField = buildEchoFieldDefinition(baseChoice.id, `echo_field_${run.id}_${Date.now()}`, 1);
    return createFieldChoice(choiceField, `echo_choice_field_${rewardSeed}`, "field_draft");
  }

  const upgradeTarget = [...run.fields].sort((left, right) => left.level - right.level)[0];
  return createFieldChoice(upgradeTarget, `echo_choice_field_${rewardSeed}`, "field_upgrade");
}

function createModifierInstance(defId: string, runId: string, index: number): FieldModInstance {
  return {
    defId,
    stacks: 1,
    instanceId: `echo_mod_${runId}_${index}_${Date.now()}`,
  };
}

function generateRewardChoices(run: EchoRunState): EchoRewardChoice[] {
  const rewardSeed = `${run.seed}:reward:${run.encounterNumber}:${run.unitsDrafted}:${run.fieldsDrafted}:${run.tacticalModifiersDrafted}`;
  const modifierRng = createSeededRng(`modifier:${rewardSeed}`);
  const unitChoice = createUnitChoice(
    createEchoUnitDraftOption(run, 0, run.encounterNumber + 1, `reward-unit-${rewardSeed}`),
    `echo_choice_unit_${rewardSeed}`,
  );
  const fieldChoice = getFieldLaneChoice(run, rewardSeed);
  const modifier = pickOne(modifierRng, ECHO_SQUAD_SCOPE_MODS);
  const modifierChoice = createModifierChoice(modifier, `echo_choice_modifier_${rewardSeed}`);

  return [unitChoice, fieldChoice, modifierChoice];
}

function generateInitialUnitChoices(runId: string, draftIndex: number): EchoRewardChoice[] {
  const seedKey = `${runId}:initial_unit:${draftIndex}`;
  return Array.from({ length: UNIT_DRAFT_CHOICE_COUNT }, (_, index) => (
    createUnitChoice(
      createEchoUnitDraftOption(null, index, 1, seedKey),
      `echo_initial_unit_choice_${draftIndex}_${index}`,
    )
  ));
}

function generateInitialFieldChoices(runId: string): EchoRewardChoice[] {
  return getEchoFieldCatalog()
    .slice(0, FIELD_DRAFT_CHOICE_COUNT)
    .map((field, index) => createFieldChoice(
      buildEchoFieldDefinition(field.id, `echo_field_${runId}_${index}`, 1),
      `echo_initial_field_choice_${index}`,
      "field_draft",
    ));
}

function getEncounterType(encounterNumber: number): EchoEncounterType {
  if (encounterNumber % 8 === 0) return "checkpoint";
  if (encounterNumber % 4 === 0) return "elite";
  return "standard";
}

function createEchoChallenge(run: EchoRunState, encounterType: EchoEncounterType): EchoChallenge {
  const rng = createSeededRng(`${run.seed}:challenge:${run.encounterNumber}:${encounterType}`);
  const challengeType = pickOne(rng, ["no_losses", "turn_limit", "field_triggers"] as const);

  switch (challengeType) {
    case "no_losses":
      return {
        id: `echo_challenge_${run.encounterNumber}_no_losses`,
        type: "no_losses",
        title: "No Losses",
        description: "Win the encounter without losing a drafted unit.",
        target: 1,
        rewardRerolls: 1,
        scoreBonus: encounterType === "checkpoint" ? 180 : encounterType === "elite" ? 120 : 80,
      };
    case "field_triggers":
      return {
        id: `echo_challenge_${run.encounterNumber}_field_triggers`,
        type: "field_triggers",
        title: "Field Sync",
        description: "Trigger Echo Field effects multiple times this battle.",
        target: encounterType === "checkpoint" ? 4 : encounterType === "elite" ? 3 : 2,
        rewardRerolls: 1,
        scoreBonus: encounterType === "checkpoint" ? 170 : encounterType === "elite" ? 110 : 70,
      };
    case "turn_limit":
    default:
      return {
        id: `echo_challenge_${run.encounterNumber}_turn_limit`,
        type: "turn_limit",
        title: "Fast Break",
        description: "Finish the encounter before the turn limit expires.",
        target: encounterType === "checkpoint" ? 8 : encounterType === "elite" ? 7 : 6,
        rewardRerolls: 1,
        scoreBonus: encounterType === "checkpoint" ? 190 : encounterType === "elite" ? 130 : 90,
      };
  }
}

function getEncounterEnemyPool(encounterType: EchoEncounterType): string[] {
  if (encounterType === "checkpoint") {
    return ["artillery_crew", "basic_infantry", "gate_sentry", "corrupted_scout"];
  }
  if (encounterType === "elite") {
    return ["basic_infantry", "gate_sentry", "corrupted_scout", "artillery_crew"];
  }
  return ["gate_sentry", "corrupted_scout", "basic_infantry"];
}

function createEchoEncounter(run: EchoRunState): EncounterDefinition {
  const encounterType = getEncounterType(run.encounterNumber);
  const rng = createSeededRng(`${run.seed}:encounter:${run.encounterNumber}`);
  const livingUnits = run.squadUnitIds.filter((unitId) => run.unitsById[unitId]);
  const squadSize = livingUnits.length;
  const gridHeight = Math.max(5, Math.min(9, squadSize + 1));
  const gridWidth = Math.max(7, Math.min(11, 7 + Math.floor(run.encounterNumber / 3)));
  const baseEnemyCount = squadSize + Math.floor(run.encounterNumber / 2);
  const enemyCount = encounterType === "checkpoint"
    ? Math.min(10, baseEnemyCount + 2)
    : encounterType === "elite"
      ? Math.min(9, baseEnemyCount + 1)
      : Math.min(8, Math.max(3, baseEnemyCount));

  const pool = getEncounterEnemyPool(encounterType);
  const counts = new Map<string, number>();
  for (let i = 0; i < enemyCount; i += 1) {
    const enemyId = pickOne(rng, pool);
    counts.set(enemyId, (counts.get(enemyId) ?? 0) + 1);
  }

  const enemyUnits = Array.from(counts.entries()).map(([enemyId, count], index) => ({
    enemyId,
    count,
    levelMod: Math.max(0, Math.floor((run.encounterNumber - 1) / 2)),
    elite: encounterType !== "standard" && index === 0,
  }));

  const introText = encounterType === "checkpoint"
    ? "SLK//ECHO  :: Endurance checkpoint engaged. Signal pressure spiking."
    : encounterType === "elite"
      ? "SLK//ECHO  :: Elite contact detected. Tactical draft proving ground live."
      : "SLK//ECHO  :: Simulation contact established. Draft squad entering engagement.";

  return {
    enemyUnits,
    gridWidth,
    gridHeight,
    introText,
    floorId: `echo_floor_${Math.max(1, Math.ceil(run.encounterNumber / 4))}`,
    roomId: `echo_room_${run.encounterNumber}`,
  };
}

function buildEchoBattleModeContext(run: EchoRunState, encounterType: EchoEncounterType): BattleModeContext {
  return {
    kind: "echo",
    echo: {
      runId: run.id,
      encounterNumber: run.encounterNumber,
      encounterType,
      placementMode: "units",
      availableFields: run.fields.map((field) => ({ ...field })),
      fieldPlacements: [],
      selectedFieldDraftId: run.fields[0]?.draftId ?? null,
      activeChallenge: createEchoChallenge(run, encounterType),
      fieldTriggerCount: 0,
      startUnitIds: [...run.squadUnitIds],
    },
  };
}

function buildEchoScoreSummary(run: EchoRunState): EchoScoreSummary {
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

function buildEchoEncounterScore(
  encounterNumber: number,
  encounterType: EchoEncounterType,
  survivingCount: number,
  challengeBonus: number,
): number {
  const baseScore = 100 + encounterNumber * 45;
  const typeBonus = encounterType === "checkpoint" ? 160 : encounterType === "elite" ? 90 : 0;
  return baseScore + typeBonus + survivingCount * 20 + challengeBonus;
}

function summarizeChallengeResult(
  challenge: EchoChallenge | null | undefined,
  battle: BattleState,
  lostCount: number,
): { completed: boolean; failed: boolean; rerollsEarned: number; bonusScore: number } {
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

export function summarizeEchoEncounter(battle: BattleState): EchoEncounterSummary | null {
  const echoContext = battle.modeContext?.kind === "echo" ? battle.modeContext.echo ?? null : null;
  if (!echoContext || !activeEchoRun) {
    return null;
  }

  const survivingUnitIds = echoContext.startUnitIds.filter((unitId) => {
    const unit = battle.units[unitId];
    return Boolean(unit && unit.hp > 0);
  });
  const lostUnitIds = echoContext.startUnitIds.filter((unitId) => !survivingUnitIds.includes(unitId));
  const challengeResult = summarizeChallengeResult(
    echoContext.activeChallenge,
    battle,
    lostUnitIds.length,
  );

  return {
    encounterNumber: echoContext.encounterNumber,
    encounterType: echoContext.encounterType,
    challenge: echoContext.activeChallenge ?? null,
    challengeCompleted: challengeResult.completed,
    challengeFailed: challengeResult.failed,
    rerollsEarned: challengeResult.rerollsEarned,
    scoreGained: buildEchoEncounterScore(
      echoContext.encounterNumber,
      echoContext.encounterType,
      survivingUnitIds.length,
      challengeResult.bonusScore,
    ),
    survivingUnitIds,
    lostUnitIds,
    fieldTriggerCount: echoContext.fieldTriggerCount ?? 0,
    turnCount: battle.turnCount,
  };
}

export function getActiveEchoRun(): EchoRunState | null {
  return activeEchoRun;
}

export function hasActiveEchoRun(): boolean {
  return activeEchoRun !== null;
}

export function clearActiveEchoRun(): void {
  activeEchoRun = null;
}

export function isEchoBattle(battle: BattleState | null | undefined): boolean {
  return battle?.modeContext?.kind === "echo";
}

export function getEchoDraftChoices(): EchoRewardChoice[] {
  return activeEchoRun?.draftChoices ?? [];
}

export function startEchoRunSession(): EchoRunState {
  disableAutosave();
  const runId = createEchoRunId();
  activeEchoRun = {
    id: runId,
    seed: `${runId}_${Math.random().toString(36).slice(2, 8)}`,
    stage: "initial_units",
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
  return activeEchoRun;
}

export function rerollActiveEchoChoices(): EchoRunState | null {
  if (!activeEchoRun || activeEchoRun.rerolls <= 0 || activeEchoRun.stage !== "reward") {
    return activeEchoRun;
  }

  activeEchoRun = {
    ...activeEchoRun,
    rerolls: activeEchoRun.rerolls - 1,
    draftChoices: generateRewardChoices(activeEchoRun),
  };
  return activeEchoRun;
}

export function applyEchoDraftChoice(choiceId: string): EchoRunState | null {
  if (!activeEchoRun) {
    return null;
  }

  const choice = activeEchoRun.draftChoices.find((entry) => entry.id === choiceId);
  if (!choice) {
    return activeEchoRun;
  }

  if (choice.optionType === "unit_draft" && choice.unitOption) {
    const newUnit = createRuntimeEchoUnit(activeEchoRun, choice.unitOption);
    const nextRun = {
      ...activeEchoRun,
      unitsById: {
        ...activeEchoRun.unitsById,
        [newUnit.id]: newUnit,
      },
      squadUnitIds: [...activeEchoRun.squadUnitIds, newUnit.id],
      unitsDrafted: activeEchoRun.unitsDrafted + 1,
    };

    if (activeEchoRun.stage === "initial_units") {
      const picksSoFar = nextRun.squadUnitIds.length;
      activeEchoRun = picksSoFar >= STARTING_SQUAD_SIZE
        ? {
            ...nextRun,
            stage: "initial_field",
            draftChoices: generateInitialFieldChoices(nextRun.id),
          }
        : {
            ...nextRun,
            draftChoices: generateInitialUnitChoices(nextRun.id, picksSoFar),
          };
    } else {
      activeEchoRun = {
        ...nextRun,
        stage: "reward",
        draftChoices: [],
      };
    }
    return activeEchoRun;
  }

  if (choice.optionType === "field_draft" && choice.fieldDefinition) {
    activeEchoRun = {
      ...activeEchoRun,
      fields: [...activeEchoRun.fields, { ...choice.fieldDefinition, maxLevel: MAX_FIELD_LEVEL }],
      fieldsDrafted: activeEchoRun.fieldsDrafted + 1,
      stage: "reward",
      draftChoices: [],
    };
    return activeEchoRun;
  }

  if (choice.optionType === "field_upgrade" && choice.fieldDefinition) {
    activeEchoRun = {
      ...activeEchoRun,
      fields: activeEchoRun.fields.map((field) => (
        field.draftId === choice.fieldDefinition?.draftId
          ? buildEchoFieldDefinition(field.id, field.draftId, Math.min(MAX_FIELD_LEVEL, field.level + 1))
          : field
      )),
      fieldsUpgraded: activeEchoRun.fieldsUpgraded + 1,
      stage: "reward",
      draftChoices: [],
    };
    return activeEchoRun;
  }

  if (choice.optionType === "modifier_draft" && choice.modifierDefId) {
    const modifierInstance = createModifierInstance(
      choice.modifierDefId,
      activeEchoRun.id,
      activeEchoRun.tacticalModifiersDrafted + 1,
    );
    activeEchoRun = {
      ...activeEchoRun,
      tacticalModifiers: [...activeEchoRun.tacticalModifiers, modifierInstance],
      tacticalModifiersDrafted: activeEchoRun.tacticalModifiersDrafted + 1,
      stage: "reward",
      draftChoices: [],
    };
    return activeEchoRun;
  }

  return activeEchoRun;
}

export function getEchoModifierHardpoints(unitIds: string[]): Record<string, (FieldModInstance | null)[]> {
  if (!activeEchoRun) {
    return {};
  }

  const hardpoints: Record<string, (FieldModInstance | null)[]> = {};
  unitIds.forEach((unitId) => {
    hardpoints[unitId] = [null, null];
  });

  let index = 0;
  activeEchoRun.tacticalModifiers.forEach((modifier) => {
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

export function launchActiveEchoEncounterBattle(): BattleState | null {
  if (!activeEchoRun) {
    return null;
  }

  const encounterType = getEncounterType(activeEchoRun.encounterNumber);
  const encounter = createEchoEncounter(activeEchoRun);
  const state = getGameState();
  const unitIds = activeEchoRun.squadUnitIds.filter((unitId) => activeEchoRun?.unitsById[unitId]);
  const unitsById = Object.fromEntries(
    unitIds.map((unitId) => {
      const unit = activeEchoRun!.unitsById[unitId];
      return [
        unitId,
        {
          ...unit,
          hp: unit.maxHp,
          strain: 0,
          pos: null,
          hand: [],
          drawPile: [],
          discardPile: [],
        } as Unit,
      ];
    }),
  );

  const battle = createBattleFromEncounter(
    state,
    encounter,
    `${activeEchoRun.seed}:battle:${activeEchoRun.encounterNumber}`,
    {
      partyUnitIds: unitIds,
      unitsById,
      maxUnitsPerSide: unitIds.length,
      modeContext: buildEchoBattleModeContext(activeEchoRun, encounterType),
    },
  );

  activeEchoRun = {
    ...activeEchoRun,
    currentChallenge: battle.modeContext?.echo?.activeChallenge ?? null,
    lastEncounterSummary: null,
  };

  return battle;
}

export function commitEchoEncounterVictory(battle: BattleState): EchoRunState | null {
  if (!activeEchoRun) {
    return null;
  }

  const summary = summarizeEchoEncounter(battle);
  if (!summary) {
    return activeEchoRun;
  }

  const survivingIds = new Set(summary.survivingUnitIds);
  const nextUnitsById = { ...activeEchoRun.unitsById };

  Object.keys(nextUnitsById).forEach((unitId) => {
    if (!survivingIds.has(unitId)) {
      delete nextUnitsById[unitId];
      return;
    }

    const unit = nextUnitsById[unitId];
    nextUnitsById[unitId] = {
      ...unit,
      hp: unit.maxHp,
      pos: null,
      strain: 0,
      hand: [],
      drawPile: [],
      discardPile: [],
    } as Unit;
  });

  const interimRun = {
    ...activeEchoRun,
    unitsById: nextUnitsById,
    squadUnitIds: activeEchoRun.squadUnitIds.filter((unitId) => survivingIds.has(unitId)),
    rerolls: activeEchoRun.rerolls + summary.rerollsEarned,
    unitsLost: activeEchoRun.unitsLost + summary.lostUnitIds.length,
    challengesCompleted: activeEchoRun.challengesCompleted + (summary.challengeCompleted ? 1 : 0),
    totalScore: activeEchoRun.totalScore + summary.scoreGained,
    encounterNumber: activeEchoRun.encounterNumber + 1,
    lastEncounterSummary: summary,
    stage: "reward" as const,
    currentChallenge: null,
  };

  activeEchoRun = {
    ...interimRun,
    draftChoices: generateRewardChoices(interimRun),
  };

  return activeEchoRun;
}

export function finalizeEchoRunFromBattleDefeat(battle: BattleState): EchoRunState | null {
  if (!activeEchoRun) {
    return null;
  }

  const summary = summarizeEchoEncounter(battle) ?? {
    encounterNumber: activeEchoRun.encounterNumber,
    encounterType: getEncounterType(activeEchoRun.encounterNumber),
    challenge: activeEchoRun.currentChallenge ?? null,
    challengeCompleted: false,
    challengeFailed: true,
    rerollsEarned: 0,
    scoreGained: 0,
    survivingUnitIds: [],
    lostUnitIds: [...activeEchoRun.squadUnitIds],
    fieldTriggerCount: battle.modeContext?.echo?.fieldTriggerCount ?? 0,
    turnCount: battle.turnCount,
  };

  const defeatedRun = {
    ...activeEchoRun,
    unitsById: {},
    squadUnitIds: [],
    unitsLost: activeEchoRun.unitsLost + summary.lostUnitIds.length,
    lastEncounterSummary: summary,
    currentChallenge: null,
    stage: "results" as const,
    draftChoices: [],
  };

  activeEchoRun = {
    ...defeatedRun,
    resultsSummary: buildEchoScoreSummary(defeatedRun),
  };

  return activeEchoRun;
}

export function abandonActiveEchoRun(): EchoRunState | null {
  if (!activeEchoRun) {
    return null;
  }

  activeEchoRun = {
    ...activeEchoRun,
    stage: "results",
    draftChoices: [],
    resultsSummary: buildEchoScoreSummary(activeEchoRun),
  };

  return activeEchoRun;
}

export function getEchoResultsSummary(): EchoScoreSummary | null {
  return activeEchoRun?.resultsSummary ?? (activeEchoRun ? buildEchoScoreSummary(activeEchoRun) : null);
}

export function getEchoModifierDef(modifierId: string | undefined | null): FieldModDef | null {
  if (!modifierId) {
    return null;
  }
  return getFieldModDef(modifierId) ?? null;
}

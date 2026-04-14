import { type ChassisSlotType } from "../data/gearChassis";
import { type IntentTag } from "../data/gearDoctrines";
import { getChassisById, getDoctrineById } from "./gearCatalog";
import type { Equipment, EquipmentStats } from "./equipment";
import { getAllStarterEquipment } from "./equipment";
import { getDefaultGearSlots, type GearSlotData } from "./gearWorkbench";
import { createGenerationContext, generateEndlessLoot } from "./endlessGear/generateEndlessGear";
import type { GeneratedGear } from "./endlessGear/types";
import { createSeededRNG, deriveSeed, generateSeed, randomInt } from "./rng";
import type { GameState } from "./types";
import {
  clampCraftedAccuracyModifier,
  getCraftedGearBaseStats,
} from "./craftedGear";

export interface AuthoredGearRewardSpec {
  kind: "authored";
  equipmentId?: string;
  slotType?: ChassisSlotType;
  seed?: number;
  preferUnowned?: boolean;
  fallbackToGenerated?: boolean;
  fallbackSeed?: number;
  label?: string;
}

export interface GeneratedGearRewardSpec {
  kind: "generated";
  slotType?: ChassisSlotType;
  minStability?: number;
  maxStability?: number;
  preferredDoctrineTags?: IntentTag[];
  seed?: number;
  label?: string;
}

export type GearRewardSpec = string | AuthoredGearRewardSpec | GeneratedGearRewardSpec;

export interface GrantedGearReward {
  rewardId: string;
  source: "authored" | "generated";
  equipmentId: string;
  templateId?: string;
  name: string;
  description: string;
  equipment: Equipment;
  gearSlots: GearSlotData;
}

const GENERATED_REWARD_LABEL_BY_SLOT: Record<ChassisSlotType, string> = {
  weapon: "Recovered Weapon",
  helmet: "Recovered Helmet",
  chestpiece: "Recovered Chestpiece",
  accessory: "Recovered Accessory",
};

function normalizeRewardSpec(spec: GearRewardSpec): AuthoredGearRewardSpec | GeneratedGearRewardSpec {
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

function getEquipmentSlotType(equipment: Equipment | undefined): ChassisSlotType | null {
  if (!equipment) {
    return null;
  }

  if (equipment.slot === "accessory") {
    return "accessory";
  }

  return equipment.slot;
}

function getOwnedEquipmentIds(state: GameState | undefined): Set<string> {
  const owned = new Set<string>();
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

function getAuthoredGearCandidates(slotType?: ChassisSlotType): Equipment[] {
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

function pickAuthoredGearCandidate(
  spec: AuthoredGearRewardSpec,
  state?: GameState,
): Equipment | null {
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

function summarizeGeneratedReward(gear: GeneratedGear): string {
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

function clampStatValue(value: number): number {
  return Math.max(0, value);
}

function rollGeneratedGearStats(gear: GeneratedGear): EquipmentStats {
  const chassis = getChassisById(gear.chassisId);
  const doctrine = getDoctrineById(gear.doctrineId);
  const seed = deriveSeed(gear.provenance.seed, "gear_reward_stats");
  const rng = createSeededRNG(seed);
  const slotType = chassis?.slotType ?? getEquipmentSlotType(gear) ?? "weapon";
  const doctrineTags = new Set(doctrine?.intentTags ?? []);

  const base = getCraftedGearBaseStats(slotType);

  const atkBias = doctrineTags.has("assault") ? 2 : doctrineTags.has("suppression") ? 1 : 0;
  const defBias = doctrineTags.has("sustain") ? 2 : doctrineTags.has("control") ? 1 : 0;
  const agiBias = doctrineTags.has("mobility") || doctrineTags.has("skirmish") ? 2 : 0;
  const accBias = doctrineTags.has("control") || doctrineTags.has("skirmish") ? 1 : 0;
  const hpBias = doctrineTags.has("sustain") ? 6 : slotType === "chestpiece" ? 4 : 0;

  return {
    atk: clampStatValue(base.atk + atkBias + (slotType === "weapon" ? randomInt(rng, -1, 4) : randomInt(rng, 0, 2))),
    def: clampStatValue(base.def + defBias + randomInt(rng, -1, 3)),
    agi: clampStatValue(base.agi + agiBias + randomInt(rng, -1, 3)),
    acc: clampCraftedAccuracyModifier(base.acc + accBias + randomInt(rng, -1, 1)),
    hp: clampStatValue(base.hp + hpBias + randomInt(rng, 0, slotType === "chestpiece" ? 10 : 6)),
  };
}

function finalizeGeneratedGear(gear: GeneratedGear, spec: GeneratedGearRewardSpec): GeneratedGear {
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
  } as GeneratedGear;

  return resolvedGear;
}

function matchesGeneratedConstraints(gear: GeneratedGear, spec: GeneratedGearRewardSpec): boolean {
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

function resolveGeneratedGearReward(spec: GeneratedGearRewardSpec): GrantedGearReward {
  const baseSeed = spec.seed ?? generateSeed();
  const generationContext = createGenerationContext();
  let resolvedGear: GeneratedGear | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const seed = attempt === 0 ? baseSeed : deriveSeed(baseSeed, `reroll_${attempt}`);
    const candidate = finalizeGeneratedGear(
      generateEndlessLoot(generationContext, {
        slotType: spec.slotType,
        seed,
      }),
      {
        ...spec,
        seed,
      },
    );

    if (!resolvedGear) {
      resolvedGear = candidate;
    }

    if (matchesGeneratedConstraints(candidate, spec)) {
      resolvedGear = candidate;
      break;
    }
  }

  const gear = resolvedGear ?? finalizeGeneratedGear(
    generateEndlessLoot(generationContext, {
      slotType: spec.slotType,
      seed: baseSeed,
    }),
    spec,
  );

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

function resolveAuthoredGearReward(
  spec: AuthoredGearRewardSpec,
  state?: GameState,
): GrantedGearReward | null {
  const authoredGear = pickAuthoredGearCandidate(spec, state);
  if (!authoredGear) {
    if (!spec.fallbackToGenerated) {
      return null;
    }

    const generatedSpec: GeneratedGearRewardSpec = {
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

export function describeGearRewardSpec(spec: GearRewardSpec): string {
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

export function resolveGearRewardSpec(
  spec: GearRewardSpec,
  state?: GameState,
): GrantedGearReward | null {
  const normalized = normalizeRewardSpec(spec);
  return normalized.kind === "generated"
    ? resolveGeneratedGearReward(normalized)
    : resolveAuthoredGearReward(normalized, state);
}

export function resolveGearRewardSpecs(
  specs: GearRewardSpec[],
  state?: GameState,
): GrantedGearReward[] {
  const granted: GrantedGearReward[] = [];
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

export function grantResolvedGearRewardToState(
  state: GameState,
  reward: GrantedGearReward,
): GameState {
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

export function grantGearRewardSpecsToState(
  state: GameState,
  specs: GearRewardSpec[],
): GameState {
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

export function createBattleGearRewardSpec(enemyCount: number, battleId: string): GearRewardSpec[] {
  const rewardChance = Math.min(0.72, 0.18 + (enemyCount * 0.08));
  const seed = deriveSeed(generateSeed(), battleId);
  const rng = createSeededRNG(seed);
  if (rng() > rewardChance) {
    return [];
  }

  const prefersGenerated = rng() < 0.72;
  if (prefersGenerated) {
    const slotPool: ChassisSlotType[] = ["weapon", "helmet", "chestpiece", "accessory"];
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

export function createOperationGearRewardSpecs(choiceCount: number, operationId: string): GearRewardSpec[] {
  const specs: GearRewardSpec[] = [];
  const baseSeed = deriveSeed(generateSeed(), operationId);
  const slotPool: ChassisSlotType[] = ["weapon", "helmet", "chestpiece", "accessory"];

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

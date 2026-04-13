// ============================================================================
// DISPATCH / EXPEDITIONS SYSTEM
// Off-screen missions for reserve units
// ============================================================================

import {
  GameState,
  RecruitmentCandidate,
  Unit,
  UnitAffinities,
  UnitId,
} from "./types";
import {
  addClassXP,
  createDefaultClassProgress,
  getAvailableClasses,
  ClassId,
  UnitClassProgress,
  unlockEligibleClasses,
} from "./classes";
import { calculatePWR } from "./pwr";
import { generateCandidates } from "./recruitment";
import { CODEX_DATABASE } from "./codexSystem";
import { getAllStarterEquipment } from "./equipment";
import { createEmptyResourceWallet, type ResourceWallet } from "./resources";
import { grantSessionResources } from "./session";

export type DispatchMissionType =
  | "scouting_run"
  | "salvage_expedition"
  | "arcane_survey"
  | "escort_detail";

export type DispatchAffinity = keyof UnitAffinities;

export interface DispatchMissionTemplate {
  id: DispatchMissionType;
  name: string;
  summary: string;
  recommendedPwr: number;
  durationTicks: number;
  baseSuccessRate: number;
  minSuccessRate: number;
  maxSuccessRate: number;
  pwrFactor: number;
  favoredAffinities: DispatchAffinity[];
  favoredClasses: string[];
}

export interface DispatchRewardBundle {
  wad: number;
  resources: ResourceWallet;
  squadXp: number;
  classXpPerUnit: number;
  intelDossiers: number;
  gearDropId?: string;
  codexEntryId?: string;
  recruitCandidate?: RecruitmentCandidate;
}

export interface DispatchExpedition {
  id: string;
  missionId: DispatchMissionType;
  missionName: string;
  summary: string;
  assignedUnitIds: UnitId[];
  assignedUnitNames: string[];
  recommendedPwr: number;
  durationTicks: number;
  startedTick: number;
  completesAtTick: number;
  successChance: number;
  averagePwr: number;
  favoredAffinities: DispatchAffinity[];
  favoredClasses: string[];
  outcome: {
    success: boolean;
    summary: string;
    rewards: DispatchRewardBundle;
  };
}

export interface DispatchReport {
  id: string;
  missionId: DispatchMissionType;
  missionName: string;
  summary: string;
  assignedUnitIds: UnitId[];
  assignedUnitNames: string[];
  completedTick: number;
  successChance: number;
  averagePwr: number;
  outcome: {
    success: boolean;
    summary: string;
    rewards: DispatchRewardBundle;
  };
}

export interface DispatchState {
  missionSlots: number;
  dispatchTick: number;
  intelDossiers: number;
  activeIntelBonus: number;
  squadXpBank: number;
  activeExpeditions: DispatchExpedition[];
  completedReports: DispatchReport[];
}

const DISPATCH_MISSION_BOARD: DispatchMissionTemplate[] = [
  {
    id: "scouting_run",
    name: "Scouting Run",
    summary: "Send a fast detachment to chart safe approaches, trace node routes, and return with tactical notes.",
    recommendedPwr: 55,
    durationTicks: 2,
    baseSuccessRate: 58,
    minSuccessRate: 35,
    maxSuccessRate: 92,
    pwrFactor: 0.45,
    favoredAffinities: ["mobility", "survival"],
    favoredClasses: ["ranger", "scout", "trapper", "thief"],
  },
  {
    id: "salvage_expedition",
    name: "Salvage Expedition",
    summary: "Break down abandoned sites for raw stock, recovered chassis, and whatever useful metal survived the rot.",
    recommendedPwr: 75,
    durationTicks: 3,
    baseSuccessRate: 56,
    minSuccessRate: 32,
    maxSuccessRate: 90,
    pwrFactor: 0.35,
    favoredAffinities: ["survival", "mobility"],
    favoredClasses: ["squire", "sentry", "paladin", "ranger"],
  },
  {
    id: "arcane_survey",
    name: "Arcane Survey",
    summary: "Dispatch trained researchers to read corruption signatures, secure shards, and retrieve anomalous data.",
    recommendedPwr: 95,
    durationTicks: 3,
    baseSuccessRate: 52,
    minSuccessRate: 28,
    maxSuccessRate: 88,
    pwrFactor: 0.32,
    favoredAffinities: ["magic", "support"],
    favoredClasses: ["wizard", "chaosmancer", "academic"],
  },
  {
    id: "escort_detail",
    name: "Escort / Protection",
    summary: "Assign a hardened reserve team to guard a convoy, protect civilians, and hold a perimeter under pressure.",
    recommendedPwr: 120,
    durationTicks: 4,
    baseSuccessRate: 50,
    minSuccessRate: 25,
    maxSuccessRate: 86,
    pwrFactor: 0.28,
    favoredAffinities: ["survival", "support"],
    favoredClasses: ["paladin", "sentry", "freelancer"],
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(probability: number): boolean {
  return Math.random() < probability;
}

function normalizeClassToken(value: string | undefined | null): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function resolveUnitClassId(unit: Unit, progress?: UnitClassProgress): ClassId {
  const desired = normalizeClassToken(progress?.currentClass || (unit.unitClass as string) || "squire");
  const match = getAvailableClasses().find((classId) => normalizeClassToken(classId) === desired);
  return match || "squire";
}

function createProgressForUnit(unit: Unit): UnitClassProgress {
  const resolvedClassId = resolveUnitClassId(unit);
  const progress = createDefaultClassProgress(unit.id);
  if (!progress.unlockedClasses.includes(resolvedClassId)) {
    progress.unlockedClasses = [...progress.unlockedClasses, resolvedClassId];
  }
  progress.currentClass = resolvedClassId;
  progress.classRanks[resolvedClassId] = progress.classRanks[resolvedClassId] || 1;
  return progress;
}

function pickLockedCodexEntryId(state: GameState): string | undefined {
  const unlocked = new Set(state.unlockedCodexEntries || []);
  const lockedEntries = CODEX_DATABASE.filter((entry) => !unlocked.has(entry.id));
  if (lockedEntries.length === 0) return undefined;
  return lockedEntries[randomInt(0, lockedEntries.length - 1)].id;
}

function pickSalvageEquipmentId(state: GameState): string | undefined {
  const allEquipment = getAllStarterEquipment();
  const owned = new Set<string>(state.equipmentPool || []);

  for (const unit of Object.values(state.unitsById)) {
    const loadout = (unit as any).loadout || {};
    Object.values(loadout).forEach((equipmentId) => {
      if (typeof equipmentId === "string" && equipmentId) {
        owned.add(equipmentId);
      }
    });
  }

  const candidates = Object.keys(allEquipment).filter((equipmentId) => !owned.has(equipmentId));
  if (candidates.length === 0) return undefined;
  return candidates[randomInt(0, candidates.length - 1)];
}

function generateRecruitLead(state: GameState): RecruitmentCandidate | undefined {
  const rosterSize = Object.values(state.unitsById).filter((unit) => !unit.isEnemy).length;
  const candidates = generateCandidates(
    {
      id: "dispatch_escort_lead",
      name: "Dispatch Lead",
      type: "base_camp",
      candidatePoolSize: 1,
    },
    rosterSize,
  );
  return candidates[0];
}

function buildRewardBundle(
  template: DispatchMissionTemplate,
  success: boolean,
  state: GameState,
): { summary: string; rewards: DispatchRewardBundle } {
  switch (template.id) {
    case "scouting_run": {
      const rewards: DispatchRewardBundle = {
        wad: success ? randomInt(18, 36) : randomInt(6, 14),
        resources: createEmptyResourceWallet({
          metalScrap: success ? randomInt(2, 5) : randomInt(0, 2),
          wood: success ? randomInt(3, 7) : randomInt(1, 3),
          chaosShards: 0,
          steamComponents: success ? randomInt(0, 2) : 0,
        }),
        squadXp: success ? 40 : 18,
        classXpPerUnit: success ? 60 : 25,
        intelDossiers: success ? 1 : 0,
      };

      return {
        summary: success
          ? "Recon packet secured. The team returned with route notes, threat sketches, and a clean extraction window."
          : "The patrol returned under pressure. Charts are incomplete, but the route still produced minor field experience.",
        rewards,
      };
    }

    case "salvage_expedition": {
      const rewards: DispatchRewardBundle = {
        wad: success ? randomInt(24, 48) : randomInt(10, 20),
        resources: createEmptyResourceWallet({
          metalScrap: success ? randomInt(10, 18) : randomInt(4, 8),
          wood: success ? randomInt(6, 12) : randomInt(2, 5),
          chaosShards: success ? randomInt(0, 2) : 0,
          steamComponents: success ? randomInt(3, 6) : randomInt(0, 2),
        }),
        squadXp: success ? 52 : 24,
        classXpPerUnit: success ? 72 : 30,
        intelDossiers: 0,
        gearDropId: success && chance(0.35) ? pickSalvageEquipmentId(state) : undefined,
      };

      return {
        summary: success
          ? rewards.gearDropId
            ? "Recovery crews returned with usable chassis stock and one intact piece of field gear."
            : "Recovery crews returned with heavy material gains and no major losses."
          : "The salvage team had to pull out early. Some stock was saved, but the best pieces stayed buried.",
        rewards,
      };
    }

    case "arcane_survey": {
      const rewards: DispatchRewardBundle = {
        wad: success ? randomInt(20, 38) : randomInt(8, 16),
        resources: createEmptyResourceWallet({
          metalScrap: success ? randomInt(0, 3) : 0,
          wood: 0,
          chaosShards: success ? randomInt(10, 18) : randomInt(3, 7),
          steamComponents: success ? randomInt(2, 5) : randomInt(0, 2),
        }),
        squadXp: success ? 64 : 28,
        classXpPerUnit: success ? 84 : 36,
        intelDossiers: 0,
        codexEntryId: success ? pickLockedCodexEntryId(state) : undefined,
      };

      return {
        summary: success
          ? rewards.codexEntryId
            ? "Surveyors brought back stable readings, shard samples, and one decipherable archive fragment."
            : "Surveyors returned with shard-rich residue and usable anomaly measurements."
          : "The survey was forced to retreat before the anomaly stabilized, but some partial readings survived.",
        rewards,
      };
    }

    case "escort_detail":
    default: {
      const rewards: DispatchRewardBundle = {
        wad: success ? randomInt(42, 78) : randomInt(16, 28),
        resources: createEmptyResourceWallet({
          metalScrap: success ? randomInt(1, 4) : 0,
          wood: success ? randomInt(1, 3) : 0,
          chaosShards: 0,
          steamComponents: success ? randomInt(0, 2) : 0,
        }),
        squadXp: success ? 70 : 30,
        classXpPerUnit: success ? 92 : 42,
        intelDossiers: 0,
        recruitCandidate: success && chance(0.3) ? generateRecruitLead(state) : undefined,
      };

      return {
        summary: success
          ? rewards.recruitCandidate
            ? "The escort returned with payment secured and a grateful survivor willing to hear out a contract."
            : "The escort held the line, delivered the convoy, and collected full payment."
          : "The detail completed only part of the route. Payment was cut, but the team still returned with hard-earned experience.",
        rewards,
      };
    }
  }
}

function getMissionTemplate(missionId: DispatchMissionType): DispatchMissionTemplate {
  const template = DISPATCH_MISSION_BOARD.find((entry) => entry.id === missionId);
  if (!template) {
    throw new Error(`Unknown dispatch mission: ${missionId}`);
  }
  return template;
}

function calculateAveragePwr(units: Unit[]): number {
  if (units.length === 0) return 0;
  const total = units.reduce((sum, unit) => sum + (unit.pwr || 0), 0);
  return Math.round(total / units.length);
}

function calculateAffinityBonus(units: Unit[], favoredAffinities: DispatchAffinity[]): number {
  if (units.length === 0 || favoredAffinities.length === 0) return 0;

  const totalAffinity = units.reduce((sum, unit) => {
    const affinities = unit.affinities || {
      melee: 0,
      ranged: 0,
      magic: 0,
      support: 0,
      mobility: 0,
      survival: 0,
    };
    return sum + favoredAffinities.reduce((affinitySum, affinity) => affinitySum + (affinities[affinity] || 0), 0);
  }, 0);

  const averageAffinity = totalAffinity / (units.length * favoredAffinities.length);
  return Math.round(averageAffinity * 0.18);
}

function calculateClassSynergyBonus(units: Unit[], favoredClasses: string[]): number {
  const favored = new Set(favoredClasses.map((value) => normalizeClassToken(value)));
  const matches = units.filter((unit) => favored.has(normalizeClassToken(unit.unitClass as string))).length;
  return Math.min(18, matches * 6);
}

export function createInitialDispatchState(): DispatchState {
  return {
    missionSlots: 2,
    dispatchTick: 0,
    intelDossiers: 0,
    activeIntelBonus: 0,
    squadXpBank: 0,
    activeExpeditions: [],
    completedReports: [],
  };
}

export function getDispatchState(state: GameState): DispatchState {
  return {
    ...createInitialDispatchState(),
    ...(state.dispatch || {}),
  };
}

export function getDispatchMissionBoard(): DispatchMissionTemplate[] {
  return DISPATCH_MISSION_BOARD;
}

export function getBusyDispatchUnitIds(state: GameState): Set<UnitId> {
  return new Set(getDispatchState(state).activeExpeditions.flatMap((expedition) => expedition.assignedUnitIds));
}

export function getDispatchEligibleUnits(state: GameState): Unit[] {
  const busy = getBusyDispatchUnitIds(state);
  const party = new Set(state.partyUnitIds || []);
  return Object.values(state.unitsById).filter((unit) => !unit.isEnemy && !party.has(unit.id) && !busy.has(unit.id));
}

export function estimateDispatchSuccessChance(
  state: GameState,
  missionId: DispatchMissionType,
  unitIds: UnitId[],
): number {
  const template = getMissionTemplate(missionId);
  const units = unitIds
    .map((unitId) => state.unitsById[unitId])
    .filter((unit): unit is Unit => Boolean(unit) && !unit.isEnemy);

  const averagePwr = calculateAveragePwr(units);
  const pwrBonus = (averagePwr - template.recommendedPwr) * template.pwrFactor;
  const unitCountBonus = Math.min(15, Math.max(0, units.length - 1) * 5);
  const affinityBonus = calculateAffinityBonus(units, template.favoredAffinities);
  const classSynergyBonus = calculateClassSynergyBonus(units, template.favoredClasses);

  return clamp(
    Math.round(template.baseSuccessRate + pwrBonus + unitCountBonus + affinityBonus + classSynergyBonus),
    template.minSuccessRate,
    template.maxSuccessRate,
  );
}

export function launchDispatchExpedition(
  state: GameState,
  missionId: DispatchMissionType,
  unitIds: UnitId[],
): GameState {
  const dispatch = getDispatchState(state);
  const template = getMissionTemplate(missionId);
  const busyUnits = getBusyDispatchUnitIds(state);
  const eligibleUnits = getDispatchEligibleUnits(state);
  const eligibleSet = new Set(eligibleUnits.map((unit) => unit.id));

  if (dispatch.activeExpeditions.length >= dispatch.missionSlots) {
    throw new Error("All dispatch slots are currently occupied.");
  }

  if (unitIds.length === 0) {
    throw new Error("Assign at least one reserve unit before launching an expedition.");
  }

  if (unitIds.some((unitId) => busyUnits.has(unitId))) {
    throw new Error("One or more selected units are already on an active dispatch.");
  }

  if (unitIds.some((unitId) => !eligibleSet.has(unitId))) {
    throw new Error("Dispatch can only assign reserve units that are not already deployed.");
  }

  const units = unitIds
    .map((unitId) => state.unitsById[unitId])
    .filter((unit): unit is Unit => Boolean(unit) && !unit.isEnemy);

  const successChance = estimateDispatchSuccessChance(state, missionId, unitIds);
  const averagePwr = calculateAveragePwr(units);
  const success = Math.random() * 100 < successChance;
  const outcome = buildRewardBundle(template, success, state);

  const expedition: DispatchExpedition = {
    id: `dispatch_${missionId}_${Date.now()}`,
    missionId,
    missionName: template.name,
    summary: template.summary,
    assignedUnitIds: unitIds,
    assignedUnitNames: units.map((unit) => unit.name),
    recommendedPwr: template.recommendedPwr,
    durationTicks: template.durationTicks,
    startedTick: dispatch.dispatchTick,
    completesAtTick: dispatch.dispatchTick + template.durationTicks,
    successChance,
    averagePwr,
    favoredAffinities: [...template.favoredAffinities],
    favoredClasses: [...template.favoredClasses],
    outcome: {
      success,
      summary: outcome.summary,
      rewards: outcome.rewards,
    },
  };

  return {
    ...state,
    dispatch: {
      ...dispatch,
      activeExpeditions: [...dispatch.activeExpeditions, expedition],
    },
  };
}

export function advanceDispatchTime(state: GameState, ticks = 1): GameState {
  if (ticks <= 0) return state;

  const dispatch = getDispatchState(state);
  const nextTick = dispatch.dispatchTick + ticks;
  const activeExpeditions: DispatchExpedition[] = [];
  const completedReports = [...dispatch.completedReports];

  for (const expedition of dispatch.activeExpeditions) {
    if (expedition.completesAtTick <= nextTick) {
      completedReports.unshift({
        id: `${expedition.id}_report`,
        missionId: expedition.missionId,
        missionName: expedition.missionName,
        summary: expedition.summary,
        assignedUnitIds: [...expedition.assignedUnitIds],
        assignedUnitNames: [...expedition.assignedUnitNames],
        completedTick: nextTick,
        successChance: expedition.successChance,
        averagePwr: expedition.averagePwr,
        outcome: expedition.outcome,
      });
      continue;
    }

    activeExpeditions.push(expedition);
  }

  return {
    ...state,
    dispatch: {
      ...dispatch,
      dispatchTick: nextTick,
      activeExpeditions,
      completedReports: completedReports.slice(0, 12),
    },
  };
}

export function consumeDispatchIntelForOperation(state: GameState): GameState {
  const dispatch = getDispatchState(state);
  if (dispatch.intelDossiers <= 0) {
    return {
      ...state,
      dispatch: {
        ...dispatch,
        activeIntelBonus: 0,
      },
    };
  }

  return {
    ...state,
    dispatch: {
      ...dispatch,
      intelDossiers: dispatch.intelDossiers - 1,
      activeIntelBonus: 1,
    },
  };
}

export function clearDispatchIntelBonus(state: GameState): GameState {
  const dispatch = getDispatchState(state);
  if (dispatch.activeIntelBonus === 0) return state;

  return {
    ...state,
    dispatch: {
      ...dispatch,
      activeIntelBonus: 0,
    },
  };
}

export function claimDispatchReport(state: GameState, reportId: string): GameState {
  const dispatch = getDispatchState(state);
  const report = dispatch.completedReports.find((entry) => entry.id === reportId);
  if (!report) return state;

  const rewards = report.outcome.rewards;
  const nextCompletedReports = dispatch.completedReports.filter((entry) => entry.id !== reportId);
  const nextRecruitmentCandidates = [...(state.recruitmentCandidates || [])];
  const nextUnlockedCodexEntries = [...(state.unlockedCodexEntries || [])];
  const nextEquipmentPool = [...(state.equipmentPool || [])];
  const rewardResources = createEmptyResourceWallet(rewards.resources);
  const nextUnitClassProgress = { ...(state.unitClassProgress || {}) };
  const nextUnitsById = { ...state.unitsById };
  const equipmentById = state.equipmentById || getAllStarterEquipment();

  if (rewards.codexEntryId && !nextUnlockedCodexEntries.includes(rewards.codexEntryId)) {
    nextUnlockedCodexEntries.push(rewards.codexEntryId);
  }

  if (rewards.recruitCandidate) {
    nextRecruitmentCandidates.push(rewards.recruitCandidate);
  }

  if (rewards.gearDropId && !nextEquipmentPool.includes(rewards.gearDropId)) {
    nextEquipmentPool.push(rewards.gearDropId);
  } else if (rewards.gearDropId && nextEquipmentPool.includes(rewards.gearDropId)) {
    rewardResources.metalScrap += 3;
    rewardResources.steamComponents += 1;
  }

  for (const unitId of report.assignedUnitIds) {
    const unit = nextUnitsById[unitId];
    if (!unit || unit.isEnemy) continue;

    const existingProgress = nextUnitClassProgress[unitId] || createProgressForUnit(unit);
    const currentClassId = resolveUnitClassId(unit, existingProgress);
    let updatedProgress = {
      ...existingProgress,
      battlesWon: existingProgress.battlesWon + (report.outcome.success ? 1 : 0),
    };

    updatedProgress = addClassXP(updatedProgress, currentClassId, rewards.classXpPerUnit);
    updatedProgress = unlockEligibleClasses(updatedProgress);
    nextUnitClassProgress[unitId] = updatedProgress;

    nextUnitsById[unitId] = {
      ...unit,
      pwr: calculatePWR({
        unit,
        unitClassProgress: updatedProgress,
        equipmentById,
      }),
    };
  }

  const rewardedState = grantSessionResources(state, {
    wad: rewards.wad,
    resources: rewardResources,
  });

  return {
    ...rewardedState,
    recruitmentCandidates: nextRecruitmentCandidates,
    unlockedCodexEntries: nextUnlockedCodexEntries,
    equipmentPool: nextEquipmentPool,
    unitsById: nextUnitsById,
    unitClassProgress: nextUnitClassProgress,
    dispatch: {
      ...dispatch,
      squadXpBank: dispatch.squadXpBank + rewards.squadXp,
      intelDossiers: dispatch.intelDossiers + rewards.intelDossiers,
      completedReports: nextCompletedReports,
    },
  };
}

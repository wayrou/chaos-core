// ============================================================================
// QUEST SYSTEM - QUEST MANAGER
// Theater / atlas aligned quest runtime and endless contract management
// ============================================================================

import type { GameState } from "../core/types";
import { getGameState, updateGameState } from "../state/gameStore";
import { getQuestById, cloneQuest, getAvailableQuests as getAvailableQuestsFromData } from "./questData";
import { generateRandomQuest, generateRandomQuests } from "./questGenerator";
import { syncQuestProgressFromSnapshotState } from "./questRuntime";
import { ObjectiveType, Quest, QuestId, QuestState } from "./types";

const MAX_ACTIVE_QUESTS = 5;
const INITIAL_GENERATED_QUESTS = 3;
const AUTO_REPLENISH = true;

const SNAPSHOT_OBJECTIVE_TYPES = new Set<ObjectiveType>([
  "secure_rooms",
  "complete_sector_objectives",
  "complete_floor",
  "build_core",
  "route_power",
  "establish_comms",
  "deliver_supply",
  "complete_operation",
  "reach_floor",
]);

export function getQuestState(): QuestState {
  const state = getGameState();
  return state.quests || createEmptyQuestState();
}

function createEmptyQuestState(): QuestState {
  return {
    availableQuests: [],
    activeQuests: [],
    completedQuests: [],
    failedQuests: [],
    maxActiveQuests: MAX_ACTIVE_QUESTS,
    totalQuestsCompleted: 0,
    generatedQuestCount: 0,
  };
}

function parseRequiredQuestIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map(String).map((entry) => entry.trim()).filter(Boolean)));
}

function areQuestRequirementsMet(quest: Quest): boolean {
  const requiredQuestIds = parseRequiredQuestIds(quest.metadata?.requiredQuestIds);
  if (requiredQuestIds.length === 0) {
    return true;
  }

  const completedQuestIds = new Set(getQuestState().completedQuests);
  return requiredQuestIds.every((questId) => completedQuestIds.has(questId));
}

function addGeneratedQuestsToState(state: GameState, count: number): GameState {
  const questState = state.quests ?? createEmptyQuestState();
  const availableSlots = Math.max(0, (questState.maxActiveQuests || MAX_ACTIVE_QUESTS) - questState.activeQuests.length);
  const resolvedCount = Math.min(availableSlots, Math.max(0, Math.floor(count)));
  if (resolvedCount <= 0) {
    return state;
  }

  const newQuests = generateRandomQuests(resolvedCount);
  return {
    ...state,
    quests: {
      ...questState,
      activeQuests: [...questState.activeQuests, ...newQuests],
      generatedQuestCount: (questState.generatedQuestCount || 0) + newQuests.length,
    },
  };
}

function settleQuestState(state: GameState, replenishGenerated = false): GameState {
  const syncedState = syncQuestProgressFromSnapshotState(state);
  if (!replenishGenerated || !AUTO_REPLENISH || !syncedState.quests) {
    return syncedState;
  }

  const generatedCount = syncedState.quests.activeQuests.filter((quest) => quest.metadata?.isGenerated).length;
  const needed = INITIAL_GENERATED_QUESTS - generatedCount;
  return needed > 0 ? addGeneratedQuestsToState(syncedState, needed) : syncedState;
}

export function initializeQuestState(): void {
  const state = getGameState();

  if (!state.quests) {
    const seededState = settleQuestState({
      ...state,
      quests: {
        ...createEmptyQuestState(),
        activeQuests: generateRandomQuests(INITIAL_GENERATED_QUESTS),
        generatedQuestCount: INITIAL_GENERATED_QUESTS,
      },
    });

    updateGameState(() => seededState);
    console.log(`[QUEST] Initialized quest state with ${seededState.quests?.activeQuests.length ?? 0} theater-aligned generated quests`);
    return;
  }

  updateGameState((current) => settleQuestState(current, true));
}

export function replenishQuests(): void {
  updateGameState((state) => settleQuestState(state, true));
}

export function syncQuestProgressInStore(): void {
  updateGameState((state) => settleQuestState(state, false));
}

export function acceptQuest(questId: QuestId): boolean {
  const quest = getQuestById(questId);
  if (!quest) {
    console.warn(`[QUEST] Quest not found: ${questId}`);
    return false;
  }

  if (!areQuestRequirementsMet(quest)) {
    console.warn(`[QUEST] Quest requirements not met: ${questId}`);
    return false;
  }

  const questState = getQuestState();
  if (questState.activeQuests.some((activeQuest) => activeQuest.id === questId)) {
    console.warn(`[QUEST] Quest already active: ${questId}`);
    return false;
  }
  if (questState.activeQuests.length >= questState.maxActiveQuests) {
    console.warn(`[QUEST] Max active quests reached (${questState.maxActiveQuests})`);
    return false;
  }

  updateGameState((state) => settleQuestState({
    ...state,
    quests: {
      ...(state.quests ?? createEmptyQuestState()),
      activeQuests: [...(state.quests?.activeQuests ?? []), cloneQuest(quest)],
    },
  }));

  console.log(`[QUEST] Accepted quest: ${quest.title}`);
  return true;
}

export function updateQuestProgress(
  objectiveType: ObjectiveType,
  target: string | number,
  amount = 1,
): void {
  updateGameState((state) => {
    const questState = state.quests ?? createEmptyQuestState();
    let changed = false;

    const nextActiveQuests = questState.activeQuests.map((quest) => {
      let questChanged = false;

      const nextObjectives = quest.objectives.map((objective) => {
        if (SNAPSHOT_OBJECTIVE_TYPES.has(objective.type) || objective.type !== objectiveType) {
          return objective;
        }

        const isGenericKill = objective.type === "kill_enemies" && typeof target === "number";
        const isAnyBattle = objective.type === "complete_battle" && objective.target === "any";
        const matchesTarget = isGenericKill || isAnyBattle || objective.target === target;
        if (!matchesTarget) {
          return objective;
        }

        const nextCurrent = Math.min(objective.required, objective.current + amount);
        if (nextCurrent === objective.current) {
          return objective;
        }

        changed = true;
        questChanged = true;
        return {
          ...objective,
          current: nextCurrent,
        };
      });

      return questChanged
        ? {
            ...quest,
            objectives: nextObjectives,
          }
        : quest;
    });

    if (!changed) {
      return settleQuestState(state, false);
    }

    return settleQuestState({
      ...state,
      quests: {
        ...questState,
        activeQuests: nextActiveQuests,
      },
    }, false);
  });
}

export function failQuest(questId: QuestId): void {
  const questState = getQuestState();
  const quest = questState.activeQuests.find((activeQuest) => activeQuest.id === questId);
  if (!quest) {
    return;
  }

  updateGameState((state) => ({
    ...state,
    quests: {
      ...(state.quests ?? createEmptyQuestState()),
      activeQuests: (state.quests?.activeQuests ?? []).filter((activeQuest) => activeQuest.id !== questId),
      failedQuests: [...(state.quests?.failedQuests ?? []), questId],
    },
  }));

  console.log(`[QUEST] Failed quest: ${quest.title}`);
}

export function getActiveQuests(): Quest[] {
  return getQuestState().activeQuests;
}

export function getAvailableQuests(): Quest[] {
  const questState = getQuestState();
  return getAvailableQuestsFromData().filter(
    (quest) => !questState.completedQuests.includes(quest.id)
      && !questState.activeQuests.some((activeQuest) => activeQuest.id === quest.id),
  ).filter(areQuestRequirementsMet);
}

export function getActiveQuest(questId: QuestId): Quest | null {
  return getQuestState().activeQuests.find((quest) => quest.id === questId) || null;
}

export function isQuestCompleted(questId: QuestId): boolean {
  return getQuestState().completedQuests.includes(questId);
}

export function getTotalQuestsCompleted(): number {
  return getQuestState().totalQuestsCompleted || 0;
}

export function generateNewQuest(): Quest {
  const quest = generateRandomQuest();
  updateGameState((state) => ({
    ...state,
    quests: {
      ...(state.quests ?? createEmptyQuestState()),
      activeQuests: [...(state.quests?.activeQuests ?? []), quest],
      generatedQuestCount: (state.quests?.generatedQuestCount || 0) + 1,
    },
  }));
  console.log(`[QUEST] Generated new quest: ${quest.title}`);
  return quest;
}

export function abandonQuest(questId: QuestId): boolean {
  const questState = getQuestState();
  const quest = questState.activeQuests.find((activeQuest) => activeQuest.id === questId);
  if (!quest) {
    console.warn(`[QUEST] Cannot abandon quest: ${questId} (not found)`);
    return false;
  }

  updateGameState((state) => settleQuestState({
    ...state,
    quests: {
      ...(state.quests ?? createEmptyQuestState()),
      activeQuests: (state.quests?.activeQuests ?? []).filter((activeQuest) => activeQuest.id !== questId),
    },
  }, true));

  console.log(`[QUEST] Abandoned quest: ${quest.title}`);
  return true;
}

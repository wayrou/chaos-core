// ============================================================================
// QUEST SYSTEM - QUEST MANAGER
// ============================================================================

import { Quest, QuestId, QuestState, QuestObjective, ObjectiveType } from "./types";
import { getGameState, updateGameState } from "../state/gameStore";
import { getQuestById, cloneQuest, getAvailableQuests as getAvailableQuestsFromData } from "./questData";
import { grantQuestRewards } from "./questRewards";

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_ACTIVE_QUESTS = 5; // Maximum number of active quests

// ============================================================================
// QUEST STATE MANAGEMENT
// ============================================================================

/**
 * Get current quest state from game state
 */
export function getQuestState(): QuestState {
  const state = getGameState();
  return state.quests || createEmptyQuestState();
}

/**
 * Create empty quest state
 */
function createEmptyQuestState(): QuestState {
  return {
    availableQuests: [],
    activeQuests: [],
    completedQuests: [],
    failedQuests: [],
    maxActiveQuests: MAX_ACTIVE_QUESTS,
  };
}

/**
 * Initialize quest state in game state
 */
export function initializeQuestState(): void {
  const state = getGameState();
  if (!state.quests) {
    updateGameState(s => ({
      ...s,
      quests: createEmptyQuestState(),
    }));
  }
}

// ============================================================================
// QUEST ACCEPTANCE
// ============================================================================

/**
 * Accept a quest (move from available to active)
 */
export function acceptQuest(questId: QuestId): boolean {
  const quest = getQuestById(questId);
  if (!quest) {
    console.warn(`[QUEST] Quest not found: ${questId}`);
    return false;
  }

  const questState = getQuestState();
  
  // Check if already active
  if (questState.activeQuests.some(q => q.id === questId)) {
    console.warn(`[QUEST] Quest already active: ${questId}`);
    return false;
  }

  // Check max active quests
  if (questState.activeQuests.length >= questState.maxActiveQuests) {
    console.warn(`[QUEST] Max active quests reached (${questState.maxActiveQuests})`);
    return false;
  }

  // Clone quest and set to active
  const activeQuest = cloneQuest(quest);

  updateGameState(state => ({
    ...state,
    quests: {
      ...state.quests!,
      activeQuests: [...state.quests!.activeQuests, activeQuest],
    },
  }));

  console.log(`[QUEST] Accepted quest: ${quest.title}`);
  return true;
}

// ============================================================================
// QUEST PROGRESS UPDATES
// ============================================================================

/**
 * Update quest objective progress
 */
export function updateQuestProgress(
  objectiveType: ObjectiveType,
  target: string | number,
  amount: number = 1
): void {
  const questState = getQuestState();
  let updated = false;

  const updatedQuests = questState.activeQuests.map(quest => {
    const updatedObjectives = quest.objectives.map(obj => {
      // Check if this objective matches the event
      if (obj.type !== objectiveType) return obj;
      if (obj.target !== target && obj.type !== "kill_enemies") return obj;

      // Special handling for kill_enemies (any enemy counts)
      if (obj.type === "kill_enemies" && typeof target === "number") {
        // This is a generic kill count, update it
        const newCurrent = Math.min(obj.current + amount, obj.required);
        if (newCurrent !== obj.current) {
          updated = true;
          return { ...obj, current: newCurrent };
        }
      } else if (obj.target === target) {
        // Exact match
        const newCurrent = Math.min(obj.current + amount, obj.required);
        if (newCurrent !== obj.current) {
          updated = true;
          return { ...obj, current: newCurrent };
        }
      }

      return obj;
    });

    // Check if all objectives are complete
    const allComplete = updatedObjectives.every(obj => obj.current >= obj.required);
    if (allComplete && quest.status === "active") {
      // Quest is complete!
      completeQuest(quest.id);
      return quest;
    }

    return {
      ...quest,
      objectives: updatedObjectives,
    };
  });

  if (updated) {
    updateGameState(state => ({
      ...state,
      quests: {
        ...state.quests!,
        activeQuests: updatedQuests,
      },
    }));
  }
}

/**
 * Complete a quest and grant rewards
 */
function completeQuest(questId: QuestId): void {
  const questState = getQuestState();
  const quest = questState.activeQuests.find(q => q.id === questId);
  
  if (!quest) {
    console.warn(`[QUEST] Cannot complete quest: ${questId} (not found in active quests)`);
    return;
  }

  // Grant rewards
  grantQuestRewards(quest);

  // Move to completed
  updateGameState(state => ({
    ...state,
    quests: {
      ...state.quests!,
      activeQuests: state.quests!.activeQuests.filter(q => q.id !== questId),
      completedQuests: [...state.quests!.completedQuests, questId],
    },
  }));

  console.log(`[QUEST] Completed quest: ${quest.title}`);
}

/**
 * Fail a quest (optional - for time-limited or failure conditions)
 */
export function failQuest(questId: QuestId): void {
  const questState = getQuestState();
  const quest = questState.activeQuests.find(q => q.id === questId);
  
  if (!quest) return;

  updateGameState(state => ({
    ...state,
    quests: {
      ...state.quests!,
      activeQuests: state.quests!.activeQuests.filter(q => q.id !== questId),
      failedQuests: [...state.quests!.failedQuests, questId],
    },
  }));

  console.log(`[QUEST] Failed quest: ${quest.title}`);
}

// ============================================================================
// QUEST QUERIES
// ============================================================================

/**
 * Get all active quests
 */
export function getActiveQuests(): Quest[] {
  return getQuestState().activeQuests;
}

/**
 * Get all available quests (from database, filtered by status)
 */
export function getAvailableQuests(): Quest[] {
  const questState = getQuestState();
  
  // Filter out already completed or active quests
  return getAvailableQuestsFromData().filter(
    q => !questState.completedQuests.includes(q.id) &&
         !questState.activeQuests.some(aq => aq.id === q.id)
  );
}

/**
 * Get quest by ID from active quests
 */
export function getActiveQuest(questId: QuestId): Quest | null {
  return getQuestState().activeQuests.find(q => q.id === questId) || null;
}

/**
 * Check if a quest is completed
 */
export function isQuestCompleted(questId: QuestId): boolean {
  return getQuestState().completedQuests.includes(questId);
}


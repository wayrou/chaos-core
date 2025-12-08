// ============================================================================
// QUEST SYSTEM - QUEST MANAGER
// Updated for Headline 15: Endless randomly generated quests
// ============================================================================

import { Quest, QuestId, QuestState, ObjectiveType } from "./types";
import { getGameState, updateGameState } from "../state/gameStore";
import { getQuestById, cloneQuest, getAvailableQuests as getAvailableQuestsFromData } from "./questData";
import { grantQuestRewards } from "./questRewards";
import { generateRandomQuest, generateRandomQuests } from "./questGenerator";

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_ACTIVE_QUESTS = 5; // Maximum number of active quests
const INITIAL_GENERATED_QUESTS = 3; // How many random quests to start with
const AUTO_REPLENISH = true; // Whether to auto-generate new quests when one is completed

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
    totalQuestsCompleted: 0,
    generatedQuestCount: 0,
  };
}

/**
 * Initialize quest state in game state
 * If no quests exist, generates initial random quests
 */
export function initializeQuestState(): void {
  const state = getGameState();
  if (!state.quests) {
    // Create initial state with generated quests
    const initialQuests = generateRandomQuests(INITIAL_GENERATED_QUESTS);
    
    updateGameState(s => ({
      ...s,
      quests: {
        ...createEmptyQuestState(),
        activeQuests: initialQuests,
        generatedQuestCount: initialQuests.length,
      },
    }));
    
    console.log(`[QUEST] Initialized quest state with ${initialQuests.length} generated quests`);
  } else if (state.quests.activeQuests.length === 0 && AUTO_REPLENISH) {
    // If no active quests, generate some
    replenishQuests();
  }
}

/**
 * Replenish quests to maintain INITIAL_GENERATED_QUESTS active
 */
export function replenishQuests(): void {
  const questState = getQuestState();
  const currentCount = questState.activeQuests.length;
  const needed = INITIAL_GENERATED_QUESTS - currentCount;
  
  if (needed <= 0) return;
  
  const newQuests = generateRandomQuests(needed);
  
  updateGameState(s => ({
    ...s,
    quests: {
      ...s.quests!,
      activeQuests: [...s.quests!.activeQuests, ...newQuests],
      generatedQuestCount: (s.quests!.generatedQuestCount || 0) + newQuests.length,
    },
  }));
  
  console.log(`[QUEST] Replenished ${newQuests.length} quest(s). Total active: ${currentCount + newQuests.length}`);
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
 * For endless quest system: auto-generates replacement quest
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

  // Move to completed and increment counter
  updateGameState(state => ({
    ...state,
    quests: {
      ...state.quests!,
      activeQuests: state.quests!.activeQuests.filter(q => q.id !== questId),
      completedQuests: [...state.quests!.completedQuests, questId],
      totalQuestsCompleted: (state.quests!.totalQuestsCompleted || 0) + 1,
    },
  }));

  console.log(`[QUEST] ✓ Completed quest: ${quest.title}`);
  
  // Show notification
  showQuestCompletionNotification(quest);
  
  // Auto-replenish if enabled (for endless quest system)
  if (AUTO_REPLENISH) {
    // Small delay to let the completion feel meaningful
    setTimeout(() => {
      replenishQuests();
    }, 500);
  }
}

/**
 * Show a notification when a quest is completed
 */
function showQuestCompletionNotification(quest: Quest): void {
  // Create notification element
  const notification = document.createElement("div");
  notification.className = "quest-completion-notification";
  notification.innerHTML = `
    <div class="quest-notification-icon">✓</div>
    <div class="quest-notification-content">
      <div class="quest-notification-title">QUEST COMPLETE</div>
      <div class="quest-notification-name">${quest.title}</div>
      <div class="quest-notification-rewards">
        ${quest.rewards.wad ? `<span>💰 ${quest.rewards.wad} WAD</span>` : ''}
        ${quest.rewards.xp ? `<span>⭐ ${quest.rewards.xp} XP</span>` : ''}
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Trigger animation
  requestAnimationFrame(() => {
    notification.classList.add("quest-notification--visible");
  });
  
  // Remove after animation
  setTimeout(() => {
    notification.classList.remove("quest-notification--visible");
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
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

/**
 * Get total quests completed (lifetime)
 */
export function getTotalQuestsCompleted(): number {
  return getQuestState().totalQuestsCompleted || 0;
}

/**
 * Force generate a new quest immediately
 */
export function generateNewQuest(): Quest {
  const newQuest = generateRandomQuest();
  
  updateGameState(s => ({
    ...s,
    quests: {
      ...s.quests!,
      activeQuests: [...s.quests!.activeQuests, newQuest],
      generatedQuestCount: (s.quests!.generatedQuestCount || 0) + 1,
    },
  }));
  
  console.log(`[QUEST] Generated new quest: ${newQuest.title}`);
  return newQuest;
}

/**
 * Abandon a quest (remove without completing)
 */
export function abandonQuest(questId: QuestId): boolean {
  const questState = getQuestState();
  const quest = questState.activeQuests.find(q => q.id === questId);
  
  if (!quest) {
    console.warn(`[QUEST] Cannot abandon quest: ${questId} (not found)`);
    return false;
  }
  
  updateGameState(s => ({
    ...s,
    quests: {
      ...s.quests!,
      activeQuests: s.quests!.activeQuests.filter(q => q.id !== questId),
    },
  }));
  
  console.log(`[QUEST] Abandoned quest: ${quest.title}`);
  
  // Replenish to keep quest count up
  if (AUTO_REPLENISH) {
    setTimeout(() => {
      replenishQuests();
    }, 100);
  }
  
  return true;
}


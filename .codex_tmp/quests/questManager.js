// ============================================================================
// QUEST SYSTEM - QUEST MANAGER
// Theater / atlas aligned quest runtime and endless contract management
// ============================================================================
import { consumeKeyItemFromState, getOwnedKeyItemQuantity } from "../core/keyItems";
import { getGameState, updateGameState } from "../state/gameStore";
import { showSystemPing } from "../ui/components/systemPing";
import { getQuestById, cloneQuest, getAvailableQuests as getAvailableQuestsFromData } from "./questData";
import { applyQuestRewardsToState } from "./questRewards";
import { generateRandomQuest, generateRandomQuests } from "./questGenerator";
import { syncQuestProgressFromSnapshotState } from "./questRuntime";
const MAX_ACTIVE_QUESTS = 5;
const INITIAL_GENERATED_QUESTS = 3;
const AUTO_REPLENISH = true;
const SNAPSHOT_OBJECTIVE_TYPES = new Set([
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
export function getQuestState() {
    const state = getGameState();
    return state.quests || createEmptyQuestState();
}
function createEmptyQuestState() {
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
function parseStringList(value) {
    if (Array.isArray(value)) {
        return Array.from(new Set(value.map(String).map((entry) => entry.trim()).filter(Boolean)));
    }
    if (typeof value === "string") {
        return Array.from(new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean)));
    }
    return [];
}
function parseRequiredQuestIds(value) {
    return parseStringList(value);
}
function parseRequiredKeyItemIds(value) {
    return parseStringList(value);
}
function parseCompletionTurnIn(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const candidate = value;
    const npcId = String(candidate.npcId ?? "").trim();
    const keyItemId = String(candidate.keyItemId ?? "").trim();
    const quantity = Math.max(1, Number(candidate.quantity ?? 1) || 1);
    if (!npcId || !keyItemId) {
        return null;
    }
    return {
        npcId,
        keyItemId,
        quantity,
    };
}
function getQuestRequirementFailure(quest, state = getGameState()) {
    const requiredQuestIds = parseRequiredQuestIds(quest.metadata?.requiredQuestIds);
    const completedQuestIds = new Set((state.quests ?? createEmptyQuestState()).completedQuests);
    const missingRequiredQuestIds = requiredQuestIds.filter((questId) => !completedQuestIds.has(questId));
    const requiredKeyItemIds = parseRequiredKeyItemIds(quest.metadata?.requiredKeyItemIds);
    const missingKeyItemIds = requiredKeyItemIds.filter((keyItemId) => getOwnedKeyItemQuantity(state, keyItemId) <= 0);
    if (missingRequiredQuestIds.length === 0 && missingKeyItemIds.length === 0) {
        return null;
    }
    return {
        code: "missing_requirements",
        missingRequiredQuestIds,
        missingKeyItemIds,
    };
}
function areQuestRequirementsMet(quest, state = getGameState()) {
    return !getQuestRequirementFailure(quest, state);
}
function getQuestAcceptanceFailure(questId, state = getGameState()) {
    const quest = getQuestById(questId);
    if (!quest) {
        return { code: "not_found" };
    }
    const requirementFailure = getQuestRequirementFailure(quest, state);
    if (requirementFailure) {
        return requirementFailure;
    }
    const questState = state.quests ?? createEmptyQuestState();
    if (questState.activeQuests.some((activeQuest) => activeQuest.id === questId)) {
        return { code: "already_active" };
    }
    if (questState.activeQuests.length >= questState.maxActiveQuests) {
        return { code: "max_active_quests", maxActiveQuests: questState.maxActiveQuests };
    }
    return null;
}
function describeQuestAcceptanceFailure(failure) {
    switch (failure.code) {
        case "missing_requirements": {
            const details = [];
            if (failure.missingRequiredQuestIds.length > 0) {
                details.push(`complete quest(s): ${failure.missingRequiredQuestIds.join(", ")}`);
            }
            if (failure.missingKeyItemIds.length > 0) {
                details.push(`obtain key item(s): ${failure.missingKeyItemIds.join(", ")}`);
            }
            return `Quest locked. ${details.join(" // ")}`;
        }
        case "already_active":
            return "Quest is already active.";
        case "max_active_quests":
            return `Failed to accept quest. Maximum active quests reached (${failure.maxActiveQuests}).`;
        case "not_found":
        default:
            return "Failed to accept quest. Quest not found.";
    }
}
function showQuestCompletionNotification(quest) {
    const rewardParts = [];
    if (quest.rewards.wad)
        rewardParts.push(`${quest.rewards.wad} WAD`);
    if (quest.rewards.xp)
        rewardParts.push(`${quest.rewards.xp} XP`);
    showSystemPing({
        title: "QUEST COMPLETE",
        message: quest.title,
        detail: rewardParts.length > 0 ? rewardParts.join(" • ") : undefined,
        type: "success",
        channel: "quest-complete",
    });
}
export function getQuestAcceptanceFailureMessage(questId) {
    const failure = getQuestAcceptanceFailure(questId);
    return failure ? describeQuestAcceptanceFailure(failure) : "";
}
function addGeneratedQuestsToState(state, count) {
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
function settleQuestState(state, replenishGenerated = false) {
    const syncedState = syncQuestProgressFromSnapshotState(state);
    if (!replenishGenerated || !AUTO_REPLENISH || !syncedState.quests) {
        return syncedState;
    }
    const generatedCount = syncedState.quests.activeQuests.filter((quest) => quest.metadata?.isGenerated).length;
    const needed = INITIAL_GENERATED_QUESTS - generatedCount;
    return needed > 0 ? addGeneratedQuestsToState(syncedState, needed) : syncedState;
}
export function initializeQuestState() {
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
export function replenishQuests() {
    updateGameState((state) => settleQuestState(state, true));
}
export function syncQuestProgressInStore() {
    updateGameState((state) => settleQuestState(state, false));
}
export function acceptQuest(questId) {
    const failure = getQuestAcceptanceFailure(questId);
    if (failure) {
        console.warn(`[QUEST] ${describeQuestAcceptanceFailure(failure)} (${questId})`);
        return false;
    }
    const quest = getQuestById(questId);
    if (!quest) {
        console.warn(`[QUEST] Quest not found after validation: ${questId}`);
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
export function updateQuestProgress(objectiveType, target, amount = 1) {
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
export function failQuest(questId) {
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
export function getActiveQuests() {
    return getQuestState().activeQuests;
}
export function getAvailableQuests() {
    const state = getGameState();
    const questState = getQuestState();
    return getAvailableQuestsFromData().filter((quest) => !questState.completedQuests.includes(quest.id)
        && !questState.activeQuests.some((activeQuest) => activeQuest.id === quest.id)).filter((quest) => areQuestRequirementsMet(quest, state));
}
export function getActiveQuest(questId) {
    return getQuestState().activeQuests.find((quest) => quest.id === questId) || null;
}
export function isQuestCompleted(questId) {
    return getQuestState().completedQuests.includes(questId);
}
export function getTotalQuestsCompleted() {
    return getQuestState().totalQuestsCompleted || 0;
}
export function generateNewQuest() {
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
export function abandonQuest(questId) {
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
export function completeNpcTurnInQuests(npcId) {
    const normalizedNpcId = npcId.trim();
    if (!normalizedNpcId) {
        return [];
    }
    const completedQuests = [];
    updateGameState((state) => {
        const questState = state.quests ?? createEmptyQuestState();
        if (questState.activeQuests.length === 0) {
            return state;
        }
        let nextState = state;
        const completedIds = new Set(questState.completedQuests);
        const remainingActiveQuests = [];
        let completedCount = 0;
        questState.activeQuests.forEach((quest) => {
            const turnIn = parseCompletionTurnIn(quest.metadata?.completionTurnIn);
            if (!turnIn || turnIn.npcId !== normalizedNpcId || completedIds.has(quest.id)) {
                remainingActiveQuests.push(quest);
                return;
            }
            if (getOwnedKeyItemQuantity(nextState, turnIn.keyItemId) < turnIn.quantity) {
                remainingActiveQuests.push(quest);
                return;
            }
            const consumedResult = consumeKeyItemFromState(nextState, turnIn.keyItemId, turnIn.quantity);
            if (consumedResult.consumed < turnIn.quantity) {
                remainingActiveQuests.push(quest);
                return;
            }
            console.log(`[QUEST] Completed quest via NPC turn-in: ${quest.title}`);
            completedQuests.push(quest);
            completedIds.add(quest.id);
            completedCount += 1;
            nextState = applyQuestRewardsToState(consumedResult.state, quest);
        });
        if (completedCount === 0) {
            return state;
        }
        const nextQuestState = nextState.quests ?? createEmptyQuestState();
        return settleQuestState({
            ...nextState,
            quests: {
                ...nextQuestState,
                activeQuests: remainingActiveQuests,
                completedQuests: [...completedIds],
                totalQuestsCompleted: (nextQuestState.totalQuestsCompleted ?? 0) + completedCount,
            },
        }, true);
    });
    completedQuests.forEach((quest) => {
        showQuestCompletionNotification(quest);
    });
    return completedQuests;
}

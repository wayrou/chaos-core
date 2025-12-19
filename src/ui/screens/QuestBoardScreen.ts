// ============================================================================
// CHAOS CORE - QUEST BOARD SCREEN
// src/ui/screens/QuestBoardScreen.ts
// ============================================================================

import { getGameState } from "../../state/gameStore";
import { renderAllNodesMenuScreen } from "./AllNodesMenuScreen";
import { renderFieldScreen } from "../../field/FieldScreen";
import { 
  getAvailableQuests, 
  getActiveQuests, 
  acceptQuest,
  initializeQuestState,
  abandonQuest,
  getTotalQuestsCompleted,
} from "../../quests/questManager";
import { Quest } from "../../quests/types";

// ----------------------------------------------------------------------------
// RENDER
// ----------------------------------------------------------------------------

let currentTab: "available" | "active" = "available";

export function renderQuestBoardScreen(returnTo: "basecamp" | "field" = "basecamp"): void {
  const app = document.getElementById("app");
  if (!app) {
    console.error("[QUEST BOARD] App element not found");
    return;
  }

  console.log("[QUEST BOARD] Rendering quest board screen, returnTo:", returnTo);

  // Initialize quest state if needed
  try {
    initializeQuestState();
  } catch (error) {
    console.error("[QUEST BOARD] Error initializing quest state:", error);
    return;
  }

  const state = getGameState();
  const backButtonText = returnTo === "field" ? "FIELD MODE" : "BASE CAMP";
  const totalCompleted = getTotalQuestsCompleted();
  
  let availableQuests: Quest[];
  let activeQuests: Quest[];
  
  try {
    availableQuests = getAvailableQuests();
    activeQuests = getActiveQuests();
    console.log("[QUEST BOARD] Loaded quests - available:", availableQuests.length, "active:", activeQuests.length);
  } catch (error) {
    console.error("[QUEST BOARD] Error loading quests:", error);
    availableQuests = [];
    activeQuests = [];
  }

  app.innerHTML = `
    <div class="quest-board-root ard-noise">
      <!-- Header - Adventure Gothic Panel -->
      <div class="quest-board-header">
        <div class="quest-board-header-left">
          <h1 class="quest-board-title">QUEST BOARD</h1>
          <div class="quest-board-subtitle">SCROLLINK OS // OPERATIONS_TERMINAL</div>
        </div>
        <div class="quest-board-header-right">
          <div class="quest-board-stats-group">
            <div class="quest-board-stats">
              <span class="stats-label">ACTIVE</span>
              <span class="stats-value">${activeQuests.length} / 5</span>
            </div>
            <div class="quest-board-stats quest-board-stats--completed">
              <span class="stats-label">COMPLETED</span>
              <span class="stats-value">${totalCompleted}</span>
            </div>
          </div>
          <button class="quest-board-back-btn" id="backBtn" data-return-to="${returnTo}">
            <span class="btn-icon">←</span>
            <span class="btn-text">${backButtonText}</span>
          </button>
        </div>
      </div>
      
      <!-- Tabs - FFTA Style -->
      <div class="quest-board-tabs">
        <button class="quest-board-tab ${currentTab === 'available' ? 'quest-board-tab--active' : ''}" data-tab="available">
          <span class="tab-icon">📋</span>
          <span class="tab-text">AVAILABLE</span>
          ${availableQuests.length > 0 ? `<span class="tab-badge">${availableQuests.length}</span>` : ''}
        </button>
        <button class="quest-board-tab ${currentTab === 'active' ? 'quest-board-tab--active' : ''}" data-tab="active">
          <span class="tab-icon">⚡</span>
          <span class="tab-text">ACTIVE</span>
          ${activeQuests.length > 0 ? `<span class="tab-badge">${activeQuests.length}</span>` : ''}
        </button>
      </div>
      
      <!-- Content - World Panel -->
      <div class="quest-board-content">
        ${currentTab === "available" 
          ? renderAvailableQuests(availableQuests) 
          : renderActiveQuests(activeQuests)}
      </div>
    </div>
  `;

  attachEventListeners(returnTo);
}

function renderAvailableQuests(quests: Quest[]): string {
  if (quests.length === 0) {
    return `
      <div class="quest-board-empty">
        <div class="empty-icon">📭</div>
        <div class="empty-title">NO AVAILABLE QUESTS</div>
        <div class="empty-text">Check back later for new operations.</div>
      </div>
    `;
  }

  return `
    <div class="quest-list">
      ${quests.map(quest => renderQuestCard(quest, "available")).join("")}
    </div>
  `;
}

function renderActiveQuests(quests: Quest[]): string {
  // Separate generated quests from static quests
  const generatedQuests = quests.filter(q => q.metadata?.isGenerated);
  const staticQuests = quests.filter(q => !q.metadata?.isGenerated);

  return `
    <div class="quest-board-windows">
      ${staticQuests.length > 0 ? `
        <!-- Story Quests Window -->
        <div class="quest-window quest-window--story">
          <div class="quest-window-header">
            <h2 class="quest-window-title">STORY QUESTS</h2>
            <div class="quest-window-subtitle">Main campaign objectives</div>
          </div>
          <div class="quest-window-body">
            <div class="quest-list">
              ${staticQuests.map(quest => renderQuestCard(quest, "active")).join("")}
            </div>
          </div>
        </div>
      ` : `
        <div class="quest-window quest-window--story">
          <div class="quest-window-header">
            <h2 class="quest-window-title">STORY QUESTS</h2>
            <div class="quest-window-subtitle">Main campaign objectives</div>
          </div>
          <div class="quest-window-body">
            <div class="quest-board-empty">
              <div class="empty-icon">📋</div>
              <div class="empty-title">NO STORY QUESTS</div>
              <div class="empty-text">Complete operations to unlock story quests.</div>
            </div>
          </div>
        </div>
      `}
      
      ${generatedQuests.length > 0 ? `
        <!-- Endless Quests Window -->
        <div class="quest-window quest-window--endless">
          <div class="quest-window-header">
            <h2 class="quest-window-title">ENDLESS QUESTS</h2>
            <div class="quest-window-subtitle">Auto-generated · Complete for rewards</div>
          </div>
          <div class="quest-window-body">
            <div class="quest-list">
              ${generatedQuests.map(quest => renderQuestCard(quest, "active")).join("")}
            </div>
          </div>
        </div>
      ` : `
        <div class="quest-window quest-window--endless">
          <div class="quest-window-header">
            <h2 class="quest-window-title">ENDLESS QUESTS</h2>
            <div class="quest-window-subtitle">Auto-generated · Complete for rewards</div>
          </div>
          <div class="quest-window-body">
            <div class="quest-board-empty">
              <div class="empty-icon">⚡</div>
              <div class="empty-title">NO ENDLESS QUESTS</div>
              <div class="empty-text">Quests are automatically generated. Check back soon!</div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
}

function renderQuestCard(quest: Quest, mode: "available" | "active"): string {
  const difficultyStars = "★".repeat(quest.difficultyTier);
  const typeIcon = getQuestTypeIcon(quest.questType);
  const rewardsHtml = renderQuestRewards(quest.rewards);

  const objectivesHtml = quest.objectives.map(obj => {
    const progress = mode === "active" 
      ? `${obj.current} / ${obj.required}`
      : `${obj.required}`;
    const progressClass = mode === "active" && obj.current >= obj.required ? "objective-complete" : "";
    
    return `
      <div class="quest-objective ${progressClass}">
        <span class="objective-check">${obj.current >= obj.required ? "✓" : "○"}</span>
        <span class="objective-text">${obj.description}</span>
        <span class="objective-progress">${progress}</span>
      </div>
    `;
  }).join("");

  return `
    <div class="quest-card quest-card--${quest.difficultyTier}" data-quest-id="${quest.id}">
      <div class="quest-card-header">
        <div class="quest-card-title-row">
          <span class="quest-type-icon">${typeIcon}</span>
          <h3 class="quest-card-title">${quest.title}</h3>
          <span class="quest-difficulty">${difficultyStars}</span>
        </div>
        <div class="quest-card-meta">
          <span class="quest-type-badge quest-type-badge--${quest.questType}">${quest.questType.toUpperCase()}</span>
          <span class="quest-tier">TIER ${quest.difficultyTier}</span>
        </div>
      </div>
      
      <div class="quest-card-body">
        <p class="quest-description">${quest.description}</p>
        
        <div class="quest-objectives">
          <div class="objectives-header">OBJECTIVES</div>
          ${objectivesHtml}
        </div>
        
        <div class="quest-rewards">
          <div class="rewards-header">REWARDS</div>
          ${rewardsHtml}
        </div>
      </div>
      
      <div class="quest-card-footer">
        ${mode === "available" 
          ? `<button class="quest-accept-btn" data-quest-id="${quest.id}">ACCEPT QUEST</button>`
          : `
            <div class="quest-footer-row">
              <div class="quest-status-badge quest-status-badge--active">IN PROGRESS</div>
              ${quest.metadata?.isGenerated ? `
                <button class="quest-abandon-btn" data-quest-id="${quest.id}" title="Abandon this quest">✕</button>
              ` : ''}
            </div>
          `}
      </div>
    </div>
  `;
}

function renderQuestRewards(rewards: Quest["rewards"]): string {
  const parts: string[] = [];

  if (rewards.wad) {
    parts.push(`<span class="reward-item"><span class="reward-icon">💰</span> ${rewards.wad} WAD</span>`);
  }

  if (rewards.xp) {
    parts.push(`<span class="reward-item"><span class="reward-icon">⭐</span> ${rewards.xp} XP</span>`);
  }

  if (rewards.resources) {
    const res = rewards.resources;
    if (res.metalScrap) parts.push(`<span class="reward-item"><span class="reward-icon">🔩</span> ${res.metalScrap} Metal</span>`);
    if (res.wood) parts.push(`<span class="reward-item"><span class="reward-icon">🪵</span> ${res.wood} Wood</span>`);
    if (res.chaosShards) parts.push(`<span class="reward-item"><span class="reward-icon">💎</span> ${res.chaosShards} Shards</span>`);
    if (res.steamComponents) parts.push(`<span class="reward-item"><span class="reward-icon">⚙️</span> ${res.steamComponents} Steam</span>`);
  }

  if (rewards.cards && rewards.cards.length > 0) {
    parts.push(`<span class="reward-item"><span class="reward-icon">🃏</span> ${rewards.cards.length} Card(s)</span>`);
  }

  if (rewards.equipment && rewards.equipment.length > 0) {
    parts.push(`<span class="reward-item"><span class="reward-icon">⚔️</span> Equipment</span>`);
  }

  if (parts.length === 0) {
    return `<div class="rewards-empty">No rewards specified</div>`;
  }

  return `<div class="rewards-list">${parts.join("")}</div>`;
}

function getQuestTypeIcon(type: Quest["questType"]): string {
  const icons: Record<Quest["questType"], string> = {
    hunt: "🎯",
    escort: "🛡️",
    exploration: "🗺️",
    delivery: "📦",
    collection: "📥",
    clear: "✅",
  };
  return icons[type] || "📋";
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------------------

function attachEventListeners(returnTo: "basecamp" | "field"): void {
  // Back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (returnTo === "field") {
        renderFieldScreen("base_camp");
      } else {
        renderAllNodesMenuScreen();
      }
    });
  }

  // Tab switching
  document.querySelectorAll(".quest-board-tab").forEach(tab => {
    tab.addEventListener("click", (e) => {
      const target = e.currentTarget as HTMLElement;
      const tabName = target.getAttribute("data-tab") as "available" | "active";
      currentTab = tabName;
      renderQuestBoardScreen(returnTo);
    });
  });

  // Accept quest buttons
  document.querySelectorAll(".quest-accept-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const target = e.currentTarget as HTMLElement;
      const questId = target.getAttribute("data-quest-id");
      if (questId) {
        const success = acceptQuest(questId);
        if (success) {
          // Refresh the screen
          renderQuestBoardScreen(returnTo);
        } else {
          alert("Failed to accept quest. You may have reached the maximum number of active quests.");
        }
      }
    });
  });

  // Abandon quest buttons (for generated quests only)
  document.querySelectorAll(".quest-abandon-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      const questId = target.getAttribute("data-quest-id");
      if (questId) {
        if (confirm("Abandon this quest? A new quest will be generated to replace it.")) {
          const success = abandonQuest(questId);
          if (success) {
            // Small delay to let replenishment happen
            setTimeout(() => {
              renderQuestBoardScreen(returnTo);
            }, 150);
          }
        }
      }
    });
  });
}


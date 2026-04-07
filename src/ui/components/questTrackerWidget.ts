import type { Quest, QuestObjective } from "../../quests/types";

type QuestTrackerWidgetOptions = {
  className?: string;
  emptyTitle?: string;
  emptyText?: string;
};

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getQuestObjectiveProgressLabel(objective: QuestObjective): string {
  return `${objective.current} / ${objective.required}`;
}

function getQuestSourceLabel(quest: Quest): string {
  return quest.metadata?.isGenerated ? "CONTRACT" : "DIRECTIVE";
}

function renderQuestObjective(objective: QuestObjective): string {
  const isComplete = objective.current >= objective.required;
  return `
    <div class="quest-tracker-widget__objective${isComplete ? " quest-tracker-widget__objective--complete" : ""}">
      <span class="quest-tracker-widget__objective-mark">${isComplete ? "■" : "□"}</span>
      <span class="quest-tracker-widget__objective-text">${escapeHtml(objective.description)}</span>
      <span class="quest-tracker-widget__objective-progress">${escapeHtml(getQuestObjectiveProgressLabel(objective))}</span>
    </div>
  `;
}

function renderQuestCard(quest: Quest): string {
  const difficulty = "★".repeat(Math.max(1, quest.difficultyTier));
  return `
    <article class="quest-tracker-widget__card">
      <header class="quest-tracker-widget__card-header">
        <div class="quest-tracker-widget__card-copy">
          <div class="quest-tracker-widget__card-kicker">${escapeHtml(getQuestSourceLabel(quest))}</div>
          <h3 class="quest-tracker-widget__card-title">${escapeHtml(quest.title)}</h3>
        </div>
        <div class="quest-tracker-widget__card-meta">
          <span class="quest-tracker-widget__badge">${escapeHtml(quest.questType.toUpperCase())}</span>
          <span class="quest-tracker-widget__difficulty">${escapeHtml(difficulty)}</span>
        </div>
      </header>
      <p class="quest-tracker-widget__description">${escapeHtml(quest.description)}</p>
      <div class="quest-tracker-widget__objective-list">
        ${quest.objectives.map(renderQuestObjective).join("")}
      </div>
    </article>
  `;
}

export function renderQuestTrackerWidget(
  quests: Quest[],
  options: QuestTrackerWidgetOptions = {},
): string {
  const className = options.className ? ` ${options.className}` : "";
  const sortedQuests = [...quests].sort((left, right) => {
    const leftWeight = left.metadata?.isGenerated ? 1 : 0;
    const rightWeight = right.metadata?.isGenerated ? 1 : 0;
    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }
    return (right.difficultyTier ?? 0) - (left.difficultyTier ?? 0);
  });

  return `
    <section class="quest-tracker-widget${className}" aria-label="Active quest tracker" data-ez-drag-disable="true">
      <div class="quest-tracker-widget__header">
        <div>
          <div class="quest-tracker-widget__kicker">ACTIVE QUESTS</div>
          <div class="quest-tracker-widget__summary">${sortedQuests.length} tracked</div>
        </div>
      </div>
      <div class="quest-tracker-widget__body">
        ${sortedQuests.length > 0
          ? sortedQuests.map(renderQuestCard).join("")
          : `
            <div class="quest-tracker-widget__empty">
              <div class="quest-tracker-widget__empty-title">${escapeHtml(options.emptyTitle ?? "NO ACTIVE QUESTS")}</div>
              <div class="quest-tracker-widget__empty-text">${escapeHtml(options.emptyText ?? "Pick up a directive or endless contract from the Quest Board.")}</div>
            </div>
          `}
      </div>
    </section>
  `;
}

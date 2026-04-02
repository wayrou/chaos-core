import "../../styles.css";
import {
  CodexCategory,
  CodexEntry,
  getUnlockedCodexEntries,
  CODEX_DATABASE,
  debugUnlockAllCodexEntries,
} from "../../core/codexSystem";
import { renderMainMenu } from "./MainMenuScreen";
import {
  BaseCampReturnTo,
  getBaseCampReturnLabel,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";

let activeCategory: CodexCategory = "Lore";
let activeEntry: CodexEntry | null = null;
let returnDestination: BaseCampReturnTo | "menu" = "basecamp";

const CODEX_CATEGORY_LABELS: Record<CodexCategory, string> = {
  Lore: "Recovered history, campaign notes, and recovered fragments.",
  Faction: "Profiles on powers, banners, and institutions shaping Ardycia.",
  Bestiary: "Threat sketches and field notes from confirmed encounters.",
  Tech: "Terminal systems, relic machinery, and sanctioned speculation.",
};

function getEntriesForCategory(category: CodexCategory): CodexEntry[] {
  return getUnlockedCodexEntries().filter((entry) => entry.category === category);
}

function getCategoryCounts(category: CodexCategory): { unlocked: number; total: number } {
  return {
    unlocked: getEntriesForCategory(category).length,
    total: CODEX_DATABASE.filter((entry) => entry.category === category).length,
  };
}

function ensureActiveEntry(): CodexEntry | null {
  const categoryEntries = getEntriesForCategory(activeCategory);
  if (!activeEntry || activeEntry.category !== activeCategory) {
    activeEntry = categoryEntries[0] ?? null;
  } else {
    activeEntry = categoryEntries.find((entry) => entry.id === activeEntry?.id) ?? categoryEntries[0] ?? null;
  }
  return activeEntry;
}

function renderCategoryTabs(): string {
  return (["Lore", "Faction", "Bestiary", "Tech"] as CodexCategory[])
    .map((category) => {
      const counts = getCategoryCounts(category);
      return `
        <button class="codex-tab ${activeCategory === category ? "codex-tab--active" : ""}" data-tab="${category}">
          <span class="codex-tab__title">${category.toUpperCase()}</span>
          <span class="codex-tab__meta">${counts.unlocked} / ${counts.total}</span>
        </button>
      `;
    })
    .join("");
}

function renderEntryList(entries: CodexEntry[]): string {
  if (entries.length === 0) {
    return `
      <div class="codex-empty-state codex-empty-state--sidebar">
        <div class="codex-empty-state__title">NO VERIFIED FRAGMENTS</div>
        <div class="codex-empty-state__text">
          Recover reports, clear operations, and inspect new threats to populate this archive.
        </div>
      </div>
    `;
  }

  return entries
    .map(
      (entry) => `
        <button class="codex-entry-btn ${activeEntry?.id === entry.id ? "codex-entry-btn--active" : ""}" data-entry-id="${entry.id}">
          <span class="codex-entry-btn__id">${entry.id.replace(/^.*?_/, "").toUpperCase()}</span>
          <span class="codex-entry-btn__title">${entry.title}</span>
        </button>
      `,
    )
    .join("");
}

function renderActiveEntry(entry: CodexEntry | null): string {
  if (!entry) {
    const counts = getCategoryCounts(activeCategory);
    return `
      <div class="codex-empty-state codex-empty-state--detail">
        <div class="codex-empty-state__title">ARCHIVE STANDBY</div>
        <div class="codex-empty-state__text">
          ${counts.unlocked === 0
            ? `No ${activeCategory.toLowerCase()} fragments are available yet. Keep pushing into new rooms and encounters.`
            : "Select an unlocked fragment from the archive list to inspect it here."}
        </div>
      </div>
    `;
  }

  return `
    <div class="codex-detail">
      <div class="codex-detail__meta">
        <span class="codex-detail__category">${entry.category.toUpperCase()}</span>
        <span class="codex-detail__status">ACCESS LEVEL: VERIFIED</span>
      </div>
      <h2 class="codex-detail__title">${entry.title}</h2>
      <div class="codex-detail__content">${entry.content}</div>
    </div>
  `;
}

export function renderCodexScreen(returnTo: BaseCampReturnTo | "menu" = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) return;

  returnDestination = returnTo;
  const entries = getEntriesForCategory(activeCategory);
  ensureActiveEntry();
  const activeCounts = getCategoryCounts(activeCategory);
  const totalUnlocked = getUnlockedCodexEntries().length;

  root.innerHTML = `
    <div class="codex-root town-screen ard-noise">
      <div class="codex-panel town-screen__panel">
        <div class="codex-header town-screen__header">
          <div class="codex-header-left town-screen__titleblock">
            <h1 class="codex-title">CODEX</h1>
            <div class="codex-subtitle">S/COM_OS // FIELD_ARCHIVE</div>
          </div>
          <div class="codex-header-right town-screen__header-right">
            <div class="codex-stats">
              <span class="codex-stats__label">UNLOCKED</span>
              <span class="codex-stats__value">${totalUnlocked} / ${CODEX_DATABASE.length}</span>
            </div>
            <button class="codex-back-btn town-screen__back-btn" id="codexBackBtn">
              <span class="btn-icon">←</span>
              <span class="btn-text">${returnDestination === "menu" ? "MAIN MENU" : getBaseCampReturnLabel(returnDestination)}</span>
            </button>
          </div>
        </div>

        <div class="codex-hero town-screen__hero">
          <div class="codex-hero__copy">
            <div class="codex-hero__eyebrow">ARCHIVE FOCUS</div>
            <div class="codex-hero__title">${activeCategory.toUpperCase()}</div>
            <div class="codex-hero__text">${CODEX_CATEGORY_LABELS[activeCategory]}</div>
          </div>
          <div class="codex-hero__status">
            <div class="codex-hero__status-label">FRAGMENTS VERIFIED</div>
            <div class="codex-hero__status-value">${activeCounts.unlocked} / ${activeCounts.total}</div>
          </div>
        </div>

        <div class="codex-tabs town-screen__subnav">
          ${renderCategoryTabs()}
        </div>

        <div class="codex-content">
          <aside class="codex-sidebar town-screen__content-panel">
            <div class="codex-sidebar__header">
              <div class="codex-sidebar__title">ARCHIVE INDEX</div>
              <div class="codex-sidebar__subtitle">Unlocked entries in ${activeCategory.toUpperCase()}</div>
            </div>
            <div class="codex-sidebar__list">
              ${renderEntryList(entries)}
            </div>
          </aside>

          <section class="codex-reader town-screen__content-panel">
            <div class="codex-reader__header">
              <div class="codex-reader__title">DATASTREAM</div>
              <div class="codex-reader__subtitle">${activeEntry ? activeEntry.id.toUpperCase() : "NO ENTRY SELECTED"}</div>
            </div>
            <div class="codex-reader__body">
              ${renderActiveEntry(activeEntry)}
            </div>
          </section>
        </div>

        <div class="codex-footer town-screen__footer">
          <div class="codex-footer__hint">Recovered intelligence is permanent once verified.</div>
          <button class="codex-debug-btn" id="codexDebugUnlockBtn">[DEV] UNLOCK ALL ENTRIES</button>
        </div>
      </div>
    </div>
  `;

  attachListeners();
}

function attachListeners(): void {
  const root = document.getElementById("app");
  if (!root) return;

  root.querySelectorAll<HTMLButtonElement>("button[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.tab as CodexCategory;
      activeEntry = null;
      renderCodexScreen(returnDestination);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("button[data-entry-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const entryId = button.dataset.entryId;
      const entry = getUnlockedCodexEntries().find((candidate) => candidate.id === entryId) ?? null;
      if (!entry) return;
      activeEntry = entry;
      renderCodexScreen(returnDestination);
    });
  });

  root.querySelector("#codexDebugUnlockBtn")?.addEventListener("click", () => {
    debugUnlockAllCodexEntries();
    renderCodexScreen(returnDestination);
  });

  root.querySelector("#codexBackBtn")?.addEventListener("click", () => {
    unregisterBaseCampReturnHotkey("codex-screen");
    if (returnDestination === "menu") {
      renderMainMenu();
      return;
    }
    returnFromBaseCampScreen(returnDestination);
  });

  if (returnDestination !== "menu") {
    registerBaseCampReturnHotkey("codex-screen", returnDestination, {
      activeSelector: ".codex-root",
      allowFieldEKey: true,
    });
  } else {
    unregisterBaseCampReturnHotkey("codex-screen");
  }
}

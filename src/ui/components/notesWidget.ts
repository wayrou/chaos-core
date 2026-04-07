import {
  addNotesTab,
  cycleNotesTabStickyColor,
  getActiveNotesTab,
  getNotesState,
  getStuckNotesForSurface,
  moveNotesTabStickyAnchor,
  removeNotesTab,
  setActiveNotesTab,
  stickNotesTab,
  STICKY_NOTE_COLOR_KEYS,
  unstickNotesTab,
  updateNotesTab,
} from "../../core/notesSystem";
import type { PlayerNoteStickySurface, PlayerNoteTab } from "../../core/types";
import { getGameState, updateGameState } from "../../state/gameStore";

type NotesStickyTarget = {
  surfaceType: PlayerNoteStickySurface;
  surfaceId: string;
  x: number;
  y: number;
};

type RenderNotesWidgetOptions = {
  className?: string;
  placeholder?: string;
  statusLabel?: string;
  titleLabel?: string;
  stickyTarget?: NotesStickyTarget;
};

export const NOTES_LAYOUT_ID = "operator-notes";
const NOTES_INPUT_SAVE_DELAY_MS = 240;
const widgetSaveTimers = new WeakMap<HTMLElement, number>();
const STICKY_NOTE_THEME_MAP = new Map<string, Record<string, string>>([
  ["steel", {
    "--notes-sticky-bg": "rgba(40, 47, 53, 0.94)",
    "--notes-sticky-border": "rgba(154, 170, 181, 0.38)",
    "--notes-sticky-accent": "#d5e0e8",
    "--notes-sticky-muted": "#96a2ab",
    "--notes-sticky-body": "rgba(12, 15, 18, 0.66)",
    "--notes-sticky-shadow": "rgba(0, 0, 0, 0.34)",
  }],
  ["teal", {
    "--notes-sticky-bg": "rgba(29, 43, 48, 0.94)",
    "--notes-sticky-border": "rgba(115, 181, 191, 0.38)",
    "--notes-sticky-accent": "#9ed8de",
    "--notes-sticky-muted": "#86999d",
    "--notes-sticky-body": "rgba(8, 18, 22, 0.62)",
    "--notes-sticky-shadow": "rgba(4, 16, 19, 0.34)",
  }],
  ["oxide", {
    "--notes-sticky-bg": "rgba(43, 32, 29, 0.94)",
    "--notes-sticky-border": "rgba(214, 141, 107, 0.38)",
    "--notes-sticky-accent": "#ffc0a4",
    "--notes-sticky-muted": "#a28a7e",
    "--notes-sticky-body": "rgba(18, 10, 8, 0.62)",
    "--notes-sticky-shadow": "rgba(16, 7, 5, 0.34)",
  }],
  ["moss", {
    "--notes-sticky-bg": "rgba(37, 42, 32, 0.94)",
    "--notes-sticky-border": "rgba(166, 186, 133, 0.38)",
    "--notes-sticky-accent": "#d2e3ad",
    "--notes-sticky-muted": "#949880",
    "--notes-sticky-body": "rgba(14, 18, 11, 0.62)",
    "--notes-sticky-shadow": "rgba(8, 11, 6, 0.34)",
  }],
  ["violet", {
    "--notes-sticky-bg": "rgba(38, 34, 45, 0.94)",
    "--notes-sticky-border": "rgba(192, 179, 255, 0.38)",
    "--notes-sticky-accent": "#cdbfff",
    "--notes-sticky-muted": "#9a8eb2",
    "--notes-sticky-body": "rgba(13, 10, 18, 0.62)",
    "--notes-sticky-shadow": "rgba(11, 7, 16, 0.34)",
  }],
  ["verdant", {
    "--notes-sticky-bg": "rgba(31, 44, 38, 0.94)",
    "--notes-sticky-border": "rgba(132, 197, 155, 0.38)",
    "--notes-sticky-accent": "#a8e0b4",
    "--notes-sticky-muted": "#8a9d91",
    "--notes-sticky-body": "rgba(10, 18, 13, 0.62)",
    "--notes-sticky-shadow": "rgba(6, 13, 8, 0.34)",
  }],
]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getTabDisplayTitle(tab: PlayerNoteTab, index: number): string {
  const trimmed = tab.title.trim();
  return trimmed.length > 0 ? trimmed : `NOTE ${String(index + 1).padStart(2, "0")}`;
}

function getStickyNoteThemeStyle(colorKey: string | undefined): string {
  const theme = STICKY_NOTE_THEME_MAP.get(colorKey ?? STICKY_NOTE_COLOR_KEYS[0]) ?? STICKY_NOTE_THEME_MAP.get(STICKY_NOTE_COLOR_KEYS[0])!;
  return Object.entries(theme)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

function renderNotesWidgetInner(options: RenderNotesWidgetOptions = {}): string {
  const notesState = getNotesState(getGameState());
  const activeTab = getActiveNotesTab(notesState);
  const placeholder = options.placeholder ?? "Write plain text notes here. Changes auto-save.";
  const statusLabel = options.statusLabel ?? "AUTO-SAVE ACTIVE // PLAIN TEXT";
  const titleLabel = options.titleLabel ?? "Tab Name";
  const stickyTarget = options.stickyTarget;

  return `
    <div class="notes-widget__tabs" role="tablist" aria-label="Notes tabs">
      ${notesState.tabs.map((tab, index) => `
        <button
          class="notes-widget__tab ${tab.id === activeTab.id ? "notes-widget__tab--active" : ""}"
          type="button"
          role="tab"
          aria-selected="${tab.id === activeTab.id ? "true" : "false"}"
          data-notes-tab="${tab.id}"
        >
          <span class="notes-widget__tab-label" data-notes-tab-label="${tab.id}">${escapeHtml(getTabDisplayTitle(tab, index))}</span>
        </button>
      `).join("")}
      <button class="notes-widget__tab notes-widget__tab--add" type="button" data-notes-add-tab="true" aria-label="Add notes tab">+</button>
    </div>
    <div class="notes-widget__editor">
      <div class="notes-widget__editor-header">
        <label class="notes-widget__field">
          <span class="notes-widget__field-label">${escapeHtml(titleLabel)}</span>
          <input
            class="notes-widget__title-input"
            type="text"
            maxlength="40"
            spellcheck="false"
            autocomplete="off"
            data-notes-title-input="true"
            value="${escapeHtml(activeTab.title)}"
          />
        </label>
        <div class="notes-widget__editor-actions">
          ${stickyTarget ? `
            <button
              class="notes-widget__stick-tab"
              type="button"
              data-notes-stick-tab="${activeTab.id}"
            >
              STICK TAB
            </button>
          ` : ""}
          <button
            class="notes-widget__close-tab"
            type="button"
            data-notes-close-tab="${activeTab.id}"
            aria-label="Close tab"
            ${notesState.tabs.length <= 1 ? "disabled" : ""}
          >
            X
          </button>
        </div>
      </div>
      <label class="notes-widget__field notes-widget__field--body">
        <span class="notes-widget__field-label">Plain Text Notes</span>
        <textarea
          class="notes-widget__body-input"
          data-notes-body-input="true"
          spellcheck="false"
          placeholder="${escapeHtml(placeholder)}"
        >${escapeHtml(activeTab.body)}</textarea>
      </label>
      <div class="notes-widget__status">${escapeHtml(statusLabel)}</div>
    </div>
  `;
}

export function renderNotesWidget(scopeId: string, options: RenderNotesWidgetOptions = {}): string {
  const className = options.className ? ` ${options.className}` : "";
  return `
    <div
      class="notes-widget${className}"
      data-notes-widget="${escapeHtml(scopeId)}"
      data-notes-placeholder="${escapeHtml(options.placeholder ?? "")}"
      data-notes-status-label="${escapeHtml(options.statusLabel ?? "")}"
      data-notes-title-label="${escapeHtml(options.titleLabel ?? "")}"
      data-notes-stick-surface-type="${escapeHtml(options.stickyTarget?.surfaceType ?? "")}"
      data-notes-stick-surface-id="${escapeHtml(options.stickyTarget?.surfaceId ?? "")}"
      data-notes-stick-x="${Number.isFinite(options.stickyTarget?.x) ? String(options.stickyTarget?.x ?? "") : ""}"
      data-notes-stick-y="${Number.isFinite(options.stickyTarget?.y) ? String(options.stickyTarget?.y ?? "") : ""}"
    >
      ${renderNotesWidgetInner(options)}
    </div>
  `;
}

function getWidgetOptions(widget: HTMLElement): RenderNotesWidgetOptions {
  return {
    placeholder: widget.dataset.notesPlaceholder || undefined,
    statusLabel: widget.dataset.notesStatusLabel || undefined,
    titleLabel: widget.dataset.notesTitleLabel || undefined,
    stickyTarget: (
      widget.dataset.notesStickSurfaceType === "field"
      || widget.dataset.notesStickSurfaceType === "theater"
      || widget.dataset.notesStickSurfaceType === "atlas"
    ) && widget.dataset.notesStickSurfaceId
      ? {
          surfaceType: widget.dataset.notesStickSurfaceType as PlayerNoteStickySurface,
          surfaceId: widget.dataset.notesStickSurfaceId,
          x: Number(widget.dataset.notesStickX ?? 0),
          y: Number(widget.dataset.notesStickY ?? 0),
        }
      : undefined,
  };
}

function clearScheduledSave(widget: HTMLElement): void {
  const timerId = widgetSaveTimers.get(widget);
  if (typeof timerId === "number") {
    window.clearTimeout(timerId);
    widgetSaveTimers.delete(widget);
  }
}

function flushNotesDraft(widget: HTMLElement): void {
  clearScheduledSave(widget);

  const notesState = getNotesState(getGameState());
  const activeTab = getActiveNotesTab(notesState);
  const titleInput = widget.querySelector<HTMLInputElement>("[data-notes-title-input]");
  const bodyInput = widget.querySelector<HTMLTextAreaElement>("[data-notes-body-input]");
  if (!titleInput || !bodyInput) {
    return;
  }

  const nextTitle = titleInput.value.slice(0, 40);
  const nextBody = bodyInput.value;
  if (activeTab.title === nextTitle && activeTab.body === nextBody) {
    return;
  }

  updateGameState((state) => updateNotesTab(state, activeTab.id, {
    title: nextTitle,
    body: nextBody,
  }));
}

function scheduleNotesDraftSave(widget: HTMLElement): void {
  clearScheduledSave(widget);
  const timerId = window.setTimeout(() => {
    widgetSaveTimers.delete(widget);
    flushNotesDraft(widget);
  }, NOTES_INPUT_SAVE_DELAY_MS);
  widgetSaveTimers.set(widget, timerId);
}

function updateActiveTabLabelPreview(widget: HTMLElement): void {
  const notesState = getNotesState(getGameState());
  const activeTab = getActiveNotesTab(notesState);
  const titleInput = widget.querySelector<HTMLInputElement>("[data-notes-title-input]");
  const labelNode = widget.querySelector<HTMLElement>(`[data-notes-tab-label="${activeTab.id}"]`);
  if (!titleInput || !labelNode) {
    return;
  }

  const tabIndex = Math.max(0, notesState.tabs.findIndex((tab) => tab.id === activeTab.id));
  const previewTitle = titleInput.value.trim().length > 0
    ? titleInput.value.trim()
    : `NOTE ${String(tabIndex + 1).padStart(2, "0")}`;
  labelNode.textContent = previewTitle;
}

function rerenderNotesWidget(widget: HTMLElement): void {
  widget.innerHTML = renderNotesWidgetInner(getWidgetOptions(widget));
}

type AttachNotesWidgetHandlersOptions = {
  onStateChange?: () => void;
  getStickyZoom?: () => number;
  onStickyDragStart?: () => void;
  onStickyDragEnd?: () => void;
};

type StuckNoteDragSession = {
  root: ParentNode;
  tabId: string;
  noteCard: HTMLElement;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  scale: number;
  moved: boolean;
};

const initializedStuckNoteRoots = new WeakSet<EventTarget>();
const stuckNoteHandlerOptions = new WeakMap<EventTarget, AttachNotesWidgetHandlersOptions>();
let activeStuckNoteDragSession: StuckNoteDragSession | null = null;

export function renderStuckNotesLayer(
  surfaceType: PlayerNoteStickySurface,
  surfaceId: string,
  className = "",
): string {
  const notesState = getNotesState(getGameState());
  const stuckTabs = getStuckNotesForSurface(notesState, surfaceType, surfaceId);
  if (stuckTabs.length <= 0) {
    return "";
  }

  return stuckTabs.map((tab, index) => {
    const anchor = tab.stickyAnchor;
    if (!anchor) {
      return "";
    }

    const title = getTabDisplayTitle(tab, index);
    const body = tab.body.trim().length > 0 ? escapeHtml(tab.body) : "No note text recorded.";
    return `
      <article
        class="notes-stuck-note${className ? ` ${className}` : ""}"
        data-stuck-note-root="${tab.id}"
        data-stuck-note-x="${anchor.x}"
        data-stuck-note-y="${anchor.y}"
        style="left:${anchor.x}px;top:${anchor.y}px;${getStickyNoteThemeStyle(anchor.colorKey)}"
      >
        <header class="notes-stuck-note__header" data-ez-drag-disable="true">
          <div class="notes-stuck-note__title-block">
            <div class="notes-stuck-note__kicker">FIELD MEMO</div>
            <div class="notes-stuck-note__title">${escapeHtml(title)}</div>
          </div>
          <div class="notes-stuck-note__actions">
            <button class="notes-stuck-note__action" type="button" data-stuck-note-color="${tab.id}" aria-label="Cycle note color">C</button>
            <button class="notes-stuck-note__action" type="button" data-stuck-note-unstick="${tab.id}">UNSTICK</button>
          </div>
        </header>
        <div class="notes-stuck-note__body">${body}</div>
      </article>
    `;
  }).join("");
}

export function attachStuckNoteHandlers(root: ParentNode = document, options: AttachNotesWidgetHandlersOptions = {}): void {
  stuckNoteHandlerOptions.set(root, options);
  if (initializedStuckNoteRoots.has(root)) {
    return;
  }
  initializedStuckNoteRoots.add(root);

  root.addEventListener("mousedown", (event) => {
    const mouseEvent = event as MouseEvent;
    if (mouseEvent.button !== 0) {
      return;
    }

    const target = mouseEvent.target as HTMLElement | null;
    if (!target) {
      return;
    }

    const colorButton = target.closest<HTMLElement>("[data-stuck-note-color]");
    if (colorButton) {
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      const tabId = colorButton.getAttribute("data-stuck-note-color");
      if (!tabId) {
        return;
      }
      updateGameState((state) => cycleNotesTabStickyColor(state, tabId));
      stuckNoteHandlerOptions.get(root)?.onStateChange?.();
      return;
    }

    const unstickButton = target.closest<HTMLElement>("[data-stuck-note-unstick]");
    if (unstickButton) {
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      const tabId = unstickButton.getAttribute("data-stuck-note-unstick");
      if (!tabId) {
        return;
      }
      updateGameState((state) => unstickNotesTab(state, tabId));
      stuckNoteHandlerOptions.get(root)?.onStateChange?.();
      return;
    }

    if (target.closest("button, input, textarea, select, a")) {
      return;
    }

    const noteCard = target.closest<HTMLElement>("[data-stuck-note-root]");
    if (!noteCard) {
      return;
    }

    const tabId = noteCard.getAttribute("data-stuck-note-root");
    if (!tabId) {
      return;
    }

    const originX = Number(noteCard.dataset.stuckNoteX ?? "0");
    const originY = Number(noteCard.dataset.stuckNoteY ?? "0");
    const scale = Math.max(0.001, stuckNoteHandlerOptions.get(root)?.getStickyZoom?.() ?? 1);

    mouseEvent.preventDefault();
    mouseEvent.stopPropagation();

    activeStuckNoteDragSession = {
      root,
      tabId,
      noteCard,
      startClientX: mouseEvent.clientX,
      startClientY: mouseEvent.clientY,
      originX,
      originY,
      scale,
      moved: false,
    };
    noteCard.classList.add("notes-stuck-note--dragging");
    stuckNoteHandlerOptions.get(root)?.onStickyDragStart?.();
  }, true);
}

function clearActiveStuckNoteDragSession(commitMove: boolean): void {
  if (!activeStuckNoteDragSession) {
    return;
  }

  const session = activeStuckNoteDragSession;
  const options = stuckNoteHandlerOptions.get(session.root);
  session.noteCard.classList.remove("notes-stuck-note--dragging");

  if (commitMove && session.moved) {
    const nextX = Number(session.noteCard.dataset.stuckNoteX ?? session.originX);
    const nextY = Number(session.noteCard.dataset.stuckNoteY ?? session.originY);
    updateGameState((state) => moveNotesTabStickyAnchor(state, session.tabId, nextX, nextY));
    options?.onStateChange?.();
  }

  options?.onStickyDragEnd?.();
  activeStuckNoteDragSession = null;
}

function handleGlobalStuckNoteMouseMove(event: MouseEvent): void {
  if (!activeStuckNoteDragSession) {
    return;
  }

  const session = activeStuckNoteDragSession;
  const deltaX = (event.clientX - session.startClientX) / session.scale;
  const deltaY = (event.clientY - session.startClientY) / session.scale;
  if (!session.moved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
    session.moved = true;
  }

  const nextX = Math.round(session.originX + deltaX);
  const nextY = Math.round(session.originY + deltaY);
  session.noteCard.style.left = `${nextX}px`;
  session.noteCard.style.top = `${nextY}px`;
  session.noteCard.dataset.stuckNoteX = String(nextX);
  session.noteCard.dataset.stuckNoteY = String(nextY);
}

function handleGlobalStuckNoteMouseUp(): void {
  clearActiveStuckNoteDragSession(true);
}

document.addEventListener("mousemove", handleGlobalStuckNoteMouseMove);
document.addEventListener("mouseup", handleGlobalStuckNoteMouseUp);

export function attachNotesWidgetHandlers(root: ParentNode = document, options: AttachNotesWidgetHandlersOptions = {}): void {
  root.querySelectorAll<HTMLElement>("[data-notes-widget]").forEach((widget) => {
    if (widget.dataset.notesInitialized === "true") {
      return;
    }

    widget.dataset.notesInitialized = "true";

    widget.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const addButton = target.closest<HTMLElement>("[data-notes-add-tab]");
      if (addButton) {
        event.preventDefault();
        flushNotesDraft(widget);
        updateGameState((state) => addNotesTab(state));
        rerenderNotesWidget(widget);
        widget.querySelector<HTMLTextAreaElement>("[data-notes-body-input]")?.focus();
        return;
      }

      const stickButton = target.closest<HTMLElement>("[data-notes-stick-tab]");
      if (stickButton) {
        event.preventDefault();
        flushNotesDraft(widget);
        const tabId = stickButton.getAttribute("data-notes-stick-tab");
        const stickyTarget = getWidgetOptions(widget).stickyTarget;
        if (!tabId || !stickyTarget) {
          return;
        }
        updateGameState((state) => stickNotesTab(state, tabId, stickyTarget));
        rerenderNotesWidget(widget);
        options.onStateChange?.();
        return;
      }

      const closeButton = target.closest<HTMLElement>("[data-notes-close-tab]");
      if (closeButton) {
        event.preventDefault();
        flushNotesDraft(widget);
        const tabId = closeButton.getAttribute("data-notes-close-tab");
        if (!tabId) {
          return;
        }
        updateGameState((state) => removeNotesTab(state, tabId));
        rerenderNotesWidget(widget);
        return;
      }

      const tabButton = target.closest<HTMLElement>("[data-notes-tab]");
      if (tabButton) {
        event.preventDefault();
        const tabId = tabButton.getAttribute("data-notes-tab");
        if (!tabId) {
          return;
        }
        flushNotesDraft(widget);
        updateGameState((state) => setActiveNotesTab(state, tabId));
        rerenderNotesWidget(widget);
      }
    });

    widget.addEventListener("input", (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      if (target.matches("[data-notes-title-input]")) {
        updateActiveTabLabelPreview(widget);
        scheduleNotesDraftSave(widget);
        return;
      }

      if (target.matches("[data-notes-body-input]")) {
        scheduleNotesDraftSave(widget);
      }
    });

    widget.addEventListener("focusout", (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      if (target.matches("[data-notes-title-input], [data-notes-body-input]")) {
        flushNotesDraft(widget);
      }
    });
  });
}

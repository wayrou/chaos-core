const DEFAULT_NOTES_TITLE_PREFIX = "NOTE";
export const STICKY_NOTE_COLOR_KEYS = ["steel", "teal", "oxide", "moss", "violet", "verdant"];
const DEFAULT_STICKY_NOTE_COLOR_KEY = STICKY_NOTE_COLOR_KEYS[0];
function createNoteId(ordinal) {
    const entropy = Math.random().toString(36).slice(2, 8);
    return `note_${Date.now().toString(36)}_${ordinal}_${entropy}`;
}
function createNoteTab(ordinal) {
    return {
        id: createNoteId(ordinal),
        title: `${DEFAULT_NOTES_TITLE_PREFIX} ${String(ordinal).padStart(2, "0")}`,
        body: "",
        updatedAt: Date.now(),
        stickyAnchor: null,
    };
}
function normalizeStickyAnchor(anchor) {
    if (!anchor || (anchor.surfaceType !== "field" && anchor.surfaceType !== "theater" && anchor.surfaceType !== "atlas")) {
        return null;
    }
    const surfaceId = typeof anchor.surfaceId === "string" ? anchor.surfaceId.trim() : "";
    if (!surfaceId) {
        return null;
    }
    return {
        surfaceType: anchor.surfaceType,
        surfaceId,
        x: Number.isFinite(anchor.x) ? Number(anchor.x) : 0,
        y: Number.isFinite(anchor.y) ? Number(anchor.y) : 0,
        colorKey: typeof anchor.colorKey === "string" && anchor.colorKey.trim().length > 0
            ? anchor.colorKey.trim()
            : DEFAULT_STICKY_NOTE_COLOR_KEY,
    };
}
export function createDefaultNotesState() {
    const firstTab = createNoteTab(1);
    return {
        tabs: [firstTab],
        activeTabId: firstTab.id,
        nextTabOrdinal: 2,
    };
}
export function normalizeNotesState(notesState) {
    const fallback = createDefaultNotesState();
    const tabs = (notesState?.tabs ?? [])
        .filter((tab) => Boolean(tab?.id))
        .map((tab, index) => ({
        id: tab.id,
        title: typeof tab.title === "string" ? tab.title : `${DEFAULT_NOTES_TITLE_PREFIX} ${String(index + 1).padStart(2, "0")}`,
        body: typeof tab.body === "string" ? tab.body : "",
        updatedAt: Number.isFinite(tab.updatedAt) ? tab.updatedAt : Date.now(),
        stickyAnchor: normalizeStickyAnchor(tab.stickyAnchor),
    }));
    if (tabs.length <= 0) {
        return fallback;
    }
    const activeTabId = tabs.some((tab) => tab.id === notesState?.activeTabId)
        ? (notesState?.activeTabId ?? tabs[0].id)
        : tabs[0].id;
    const nextTabOrdinal = Math.max(Number.isFinite(notesState?.nextTabOrdinal) ? Number(notesState?.nextTabOrdinal) : 0, tabs.length + 1);
    return {
        tabs,
        activeTabId,
        nextTabOrdinal,
    };
}
export function getNotesState(state) {
    return normalizeNotesState(state.uiLayout?.notesState);
}
export function getActiveNotesTab(notesState) {
    return notesState.tabs.find((tab) => tab.id === notesState.activeTabId) ?? notesState.tabs[0];
}
export function setNotesState(state, notesState) {
    return {
        ...state,
        uiLayout: {
            ...(state.uiLayout ?? {}),
            notesState,
        },
    };
}
function notesStatesMatch(left, right) {
    if (!left) {
        return false;
    }
    if (left.activeTabId !== right.activeTabId || left.nextTabOrdinal !== right.nextTabOrdinal || left.tabs.length !== right.tabs.length) {
        return false;
    }
    return left.tabs.every((tab, index) => {
        const other = right.tabs[index];
        const stickyMatches = ((!tab.stickyAnchor && !other?.stickyAnchor)
            || (Boolean(tab.stickyAnchor)
                && Boolean(other?.stickyAnchor)
                && other.stickyAnchor.surfaceType === tab.stickyAnchor.surfaceType
                && other.stickyAnchor.surfaceId === tab.stickyAnchor.surfaceId
                && other.stickyAnchor.x === tab.stickyAnchor.x
                && other.stickyAnchor.y === tab.stickyAnchor.y
                && other.stickyAnchor.colorKey === tab.stickyAnchor.colorKey));
        return Boolean(other)
            && other.id === tab.id
            && other.title === tab.title
            && other.body === tab.body
            && other.updatedAt === tab.updatedAt
            && stickyMatches;
    });
}
export function withNormalizedNotesState(state) {
    const normalized = normalizeNotesState(state.uiLayout?.notesState);
    if (notesStatesMatch(state.uiLayout?.notesState, normalized)) {
        return state;
    }
    return setNotesState(state, normalized);
}
export function setActiveNotesTab(state, tabId) {
    const notesState = getNotesState(state);
    if (!notesState.tabs.some((tab) => tab.id === tabId)) {
        return state;
    }
    return setNotesState(state, {
        ...notesState,
        activeTabId: tabId,
    });
}
export function addNotesTab(state) {
    const notesState = getNotesState(state);
    const newTab = createNoteTab(notesState.nextTabOrdinal);
    return setNotesState(state, {
        tabs: [...notesState.tabs, newTab],
        activeTabId: newTab.id,
        nextTabOrdinal: notesState.nextTabOrdinal + 1,
    });
}
export function removeNotesTab(state, tabId) {
    const notesState = getNotesState(state);
    const remainingTabs = notesState.tabs.filter((tab) => tab.id !== tabId);
    if (remainingTabs.length <= 0) {
        const resetState = createDefaultNotesState();
        return setNotesState(state, resetState);
    }
    const activeTabId = notesState.activeTabId === tabId
        ? remainingTabs[Math.max(0, notesState.tabs.findIndex((tab) => tab.id === tabId) - 1)]?.id ?? remainingTabs[0].id
        : notesState.activeTabId;
    return setNotesState(state, {
        ...notesState,
        tabs: remainingTabs,
        activeTabId,
    });
}
export function updateNotesTab(state, tabId, patch) {
    const notesState = getNotesState(state);
    const nextTabs = notesState.tabs.map((tab) => {
        if (tab.id !== tabId) {
            return tab;
        }
        return {
            ...tab,
            title: typeof patch.title === "string" ? patch.title : tab.title,
            body: typeof patch.body === "string" ? patch.body : tab.body,
            updatedAt: Date.now(),
        };
    });
    return setNotesState(state, {
        ...notesState,
        tabs: nextTabs,
    });
}
export function getStuckNotesForSurface(notesState, surfaceType, surfaceId) {
    return notesState.tabs.filter((tab) => (tab.stickyAnchor?.surfaceType === surfaceType
        && tab.stickyAnchor?.surfaceId === surfaceId));
}
export function stickNotesTab(state, tabId, anchor) {
    const notesState = getNotesState(state);
    const currentTab = notesState.tabs.find((tab) => tab.id === tabId);
    if (!currentTab) {
        return state;
    }
    const stackedCount = notesState.tabs.filter((tab) => (tab.id !== tabId
        && tab.stickyAnchor?.surfaceType === anchor.surfaceType
        && tab.stickyAnchor?.surfaceId === anchor.surfaceId)).length;
    const stackOffsetX = Math.min(4, stackedCount) * 26;
    const stackOffsetY = Math.min(4, stackedCount) * 18;
    const nextTabs = notesState.tabs.map((tab) => {
        if (tab.id !== tabId) {
            return tab;
        }
        return {
            ...tab,
            stickyAnchor: {
                surfaceType: anchor.surfaceType,
                surfaceId: anchor.surfaceId,
                x: Math.round(anchor.x + stackOffsetX),
                y: Math.round(anchor.y + stackOffsetY),
                colorKey: anchor.colorKey ?? tab.stickyAnchor?.colorKey ?? DEFAULT_STICKY_NOTE_COLOR_KEY,
            },
            updatedAt: Date.now(),
        };
    });
    return setNotesState(state, {
        ...notesState,
        tabs: nextTabs,
    });
}
export function unstickNotesTab(state, tabId) {
    const notesState = getNotesState(state);
    const nextTabs = notesState.tabs.map((tab) => (tab.id === tabId
        ? {
            ...tab,
            stickyAnchor: null,
            updatedAt: Date.now(),
        }
        : tab));
    return setNotesState(state, {
        ...notesState,
        tabs: nextTabs,
    });
}
export function cycleNotesTabStickyColor(state, tabId) {
    const notesState = getNotesState(state);
    const nextTabs = notesState.tabs.map((tab) => {
        if (tab.id !== tabId || !tab.stickyAnchor) {
            return tab;
        }
        const currentKey = tab.stickyAnchor.colorKey ?? DEFAULT_STICKY_NOTE_COLOR_KEY;
        const currentIndex = STICKY_NOTE_COLOR_KEYS.indexOf(currentKey);
        const nextKey = STICKY_NOTE_COLOR_KEYS[(currentIndex + 1 + STICKY_NOTE_COLOR_KEYS.length) % STICKY_NOTE_COLOR_KEYS.length];
        return {
            ...tab,
            stickyAnchor: {
                ...tab.stickyAnchor,
                colorKey: nextKey,
            },
            updatedAt: Date.now(),
        };
    });
    return setNotesState(state, {
        ...notesState,
        tabs: nextTabs,
    });
}
export function moveNotesTabStickyAnchor(state, tabId, x, y) {
    const notesState = getNotesState(state);
    const nextTabs = notesState.tabs.map((tab) => {
        if (tab.id !== tabId || !tab.stickyAnchor) {
            return tab;
        }
        return {
            ...tab,
            stickyAnchor: {
                ...tab.stickyAnchor,
                x: Math.round(x),
                y: Math.round(y),
            },
            updatedAt: Date.now(),
        };
    });
    return setNotesState(state, {
        ...notesState,
        tabs: nextTabs,
    });
}

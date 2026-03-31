// ============================================================================
// ALL NODES MENU SCREEN - Standalone menu for quick node access
// An independent screen (not an overlay) containing all base camp nodes
// ============================================================================

import "../../field/field.css";
import { getGameState, updateGameState } from "../../state/gameStore";
import { renderFieldScreen } from "../../field/FieldScreen";

let lastFieldMap: string = "base_camp";
let quacLastFeedback = 'Type a node name, then press ENTER. Example: "unit roster" or "inventory".';
let suppressNodeClickUntil = 0;

type NodeDefinition = {
  action: string;
  icon: string;
  label: string;
  desc: string;
  variant?: string;
};

const QUAC_LAYOUT_ID = "quac-terminal";
const DRAG_THRESHOLD_PX = 8;
const MIN_ITEM_HEIGHT = 104;

const DEFAULT_NODE_LAYOUT: NodeDefinition[] = [
  { action: "ops-terminal", icon: "OPS", label: "OPS TERMINAL", desc: "Deploy on operations", variant: "all-nodes-node-btn--primary" },
  { action: "roster", icon: "RST", label: "UNIT ROSTER", desc: "Manage your units" },
  { action: "loadout", icon: "LDT", label: "LOADOUT", desc: "Equipment & inventory" },
  { action: "inventory", icon: "INV", label: "INVENTORY", desc: "View all owned items" },
  { action: "gear-workbench", icon: "WKS", label: "WORKSHOP", desc: "Craft, upgrade & tinker" },
  { action: "shop", icon: "SHP", label: "SHOP", desc: "Buy items & PAKs" },
  { action: "tavern", icon: "TAV", label: "TAVERN", desc: "Recruit new units" },
  { action: "quest-board", icon: "QST", label: "QUEST BOARD", desc: "View active quests" },
  { action: "port", icon: "PRT", label: "PORT", desc: "Trade resources" },
  { action: "quarters", icon: "QTR", label: "QUARTERS", desc: "Rest & heal units" },
  { action: "stable", icon: "STB", label: "STABLE", desc: "Manage mounts", variant: "all-nodes-node-btn--stable" },
  { action: "codex", icon: "CDX", label: "CODEX", desc: "Archives & bestiary", variant: "all-nodes-node-btn--utility" },
  { action: "settings", icon: "CFG", label: "SETTINGS", desc: "Game options", variant: "all-nodes-node-btn--utility" },
  { action: "comms-array", icon: "COM", label: "COMMS ARRAY", desc: "Training & multiplayer", variant: "all-nodes-node-btn--utility" },
];

const DEFAULT_LAYOUT_ORDER = [...DEFAULT_NODE_LAYOUT.map((node) => node.action), QUAC_LAYOUT_ID];

const QUAC_COMMAND_ALIASES: Array<{ action: string; aliases: string[] }> = [
  { action: "ops-terminal", aliases: ["ops", "ops terminal", "operation", "operations", "deploy", "mission", "missions"] },
  { action: "roster", aliases: ["roster", "unit roster", "units", "party", "manage units"] },
  { action: "loadout", aliases: ["loadout", "gear", "equipment", "equip", "locker"] },
  { action: "inventory", aliases: ["inventory", "items", "assets", "storage", "owned items"] },
  { action: "gear-workbench", aliases: ["workshop", "workbench", "gear workbench", "craft", "crafting", "upgrade gear"] },
  { action: "shop", aliases: ["shop", "store", "quartermaster", "buy", "market"] },
  { action: "tavern", aliases: ["tavern", "recruit", "recruitment", "hire"] },
  { action: "quest-board", aliases: ["quest", "quests", "quest board", "board", "jobs"] },
  { action: "port", aliases: ["port", "trade", "trading", "manifest", "supply"] },
  { action: "quarters", aliases: ["quarters", "rest", "barracks", "heal"] },
  { action: "stable", aliases: ["stable", "mounts", "mount", "mounted units"] },
  { action: "codex", aliases: ["codex", "archive", "archives", "bestiary"] },
  { action: "settings", aliases: ["settings", "config", "configuration", "options"] },
  { action: "comms-array", aliases: ["comms", "comms array", "multiplayer", "training"] },
  { action: "endless-field-nodes", aliases: ["endless rooms", "debug endless rooms"] },
  { action: "endless-battles", aliases: ["endless battles", "debug endless battles"] },
  { action: "debug-wad", aliases: ["debug wad", "money", "give wad", "add wad"] },
];

function normalizeQuacCommand(value: string): string {
  return value.toLowerCase().trim().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ");
}

function resolveQuacCommand(input: string): string | null {
  const normalized = normalizeQuacCommand(input);
  if (!normalized) return null;

  for (const entry of QUAC_COMMAND_ALIASES) {
    for (const alias of entry.aliases) {
      const normalizedAlias = normalizeQuacCommand(alias);
      if (normalized === normalizedAlias || normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized)) {
        return entry.action;
      }
    }
  }

  return null;
}

function readNodeLayout(): NodeDefinition[] {
  const state = getGameState();
  const savedOrder = state.uiLayout?.baseCampNodeOrder;
  if (!savedOrder || savedOrder.length === 0) {
    return [...DEFAULT_NODE_LAYOUT];
  }

  const nodeMap = new Map(DEFAULT_NODE_LAYOUT.map((node) => [node.action, node]));
  const ordered = savedOrder.map((action) => nodeMap.get(action)).filter((node): node is NodeDefinition => Boolean(node));
  const missing = DEFAULT_NODE_LAYOUT.filter((node) => !savedOrder.includes(node.action));
  return [...ordered, ...missing];
}

function readLayoutOrder(): string[] {
  const state = getGameState();
  const savedOrder = state.uiLayout?.baseCampItemOrder;
  const validIds = new Set(DEFAULT_LAYOUT_ORDER);

  if (!savedOrder || savedOrder.length === 0) {
    return [...readNodeLayout().map((node) => node.action), QUAC_LAYOUT_ID];
  }

  const ordered = savedOrder.filter((id) => validIds.has(id));
  const missing = DEFAULT_LAYOUT_ORDER.filter((id) => !ordered.includes(id));
  return [...ordered, ...missing];
}

function persistLayoutOrder(order: string[]): void {
  updateGameState((state) => ({
    ...state,
    uiLayout: {
      ...(state.uiLayout ?? {}),
      baseCampItemOrder: order,
      baseCampNodeOrder: order.filter((id) => id !== QUAC_LAYOUT_ID),
    },
  }));
}

function readMinimizedItems(): string[] {
  const state = getGameState();
  return state.uiLayout?.baseCampMinimizedItems ?? [];
}

function persistMinimizedItems(ids: string[]): void {
  updateGameState((state) => ({
    ...state,
    uiLayout: {
      ...(state.uiLayout ?? {}),
      baseCampMinimizedItems: ids,
    },
  }));
}

function readItemSizes(): Record<string, { colSpan: number; minHeight: number }> {
  return getGameState().uiLayout?.baseCampItemSizes ?? {};
}

function persistItemSizes(sizes: Record<string, { colSpan: number; minHeight: number }>): void {
  updateGameState((state) => ({
    ...state,
    uiLayout: {
      ...(state.uiLayout ?? {}),
      baseCampItemSizes: sizes,
    },
  }));
}

function resetBaseCampView(): void {
  updateGameState((state) => ({
    ...state,
    uiLayout: {
      ...(state.uiLayout ?? {}),
      baseCampItemOrder: [...DEFAULT_LAYOUT_ORDER],
      baseCampNodeOrder: DEFAULT_NODE_LAYOUT.map((node) => node.action),
      baseCampMinimizedItems: [],
      baseCampItemSizes: {},
    },
  }));
}

function mergeLayoutOrder(activeOrder: string[], fullOrder: string[], minimized: Set<string>): string[] {
  const nextActive = [...activeOrder];
  return fullOrder.map((id) => (minimized.has(id) ? id : nextActive.shift() ?? id));
}

function getItemStyle(itemId: string, sizes: Record<string, { colSpan: number; minHeight: number }>): string {
  const size = sizes[itemId];
  if (!size) {
    return "";
  }

  return `style="grid-column: span ${size.colSpan}; min-height: ${size.minHeight}px;"`;
}

function renderNodeContent(node: NodeDefinition): string {
  const variantClass = node.variant ? ` ${node.variant}` : "";
  return `
    <div class="all-nodes-item-shell">
      <div class="all-nodes-item-toolbar">
        <span class="all-nodes-item-grip" aria-hidden="true">::</span>
        <button class="all-nodes-item-minimize" type="button" data-minimize-id="${node.action}" aria-label="Minimize ${node.label}">_</button>
      </div>
      <button class="all-nodes-node-btn${variantClass}" data-action="${node.action}">
        <span class="node-icon">${node.icon}</span>
        <span class="node-label">${node.label}</span>
        <span class="node-desc">${node.desc}</span>
      </button>
      <button class="all-nodes-item-resize" type="button" data-resize-id="${node.action}" aria-label="Resize ${node.label}"></button>
    </div>
  `;
}

function renderQuacContent(): string {
  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--quac">
      <div class="all-nodes-item-toolbar all-nodes-item-toolbar--quac">
        <span class="all-nodes-item-grip" aria-hidden="true">::</span>
        <button class="all-nodes-item-minimize" type="button" data-minimize-id="${QUAC_LAYOUT_ID}" aria-label="Minimize QUAC terminal">_</button>
      </div>
      <section class="all-nodes-cli-panel" aria-label="Quick User Access Console" data-ez-drag-disable="true">
        <div class="all-nodes-cli-header">
          <div class="all-nodes-cli-title">Q.U.A.C. TERMINAL</div>
        </div>
        <form class="all-nodes-cli-form" id="quacForm">
          <label class="all-nodes-cli-prompt" for="quacInput">S/COM://QUAC&gt;</label>
          <input
            class="all-nodes-cli-input"
            id="quacInput"
            name="quacInput"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder='Enter command: "unit roster", "loadout", "inventory"...'
          />
          <button class="all-nodes-cli-submit" type="submit">EXECUTE</button>
        </form>
        <div class="all-nodes-cli-status" id="quacStatus">${quacLastFeedback}</div>
      </section>
    </div>
  `;
}

function renderDockItem(itemId: string, nodeMap: Map<string, NodeDefinition>): string {
  if (itemId === QUAC_LAYOUT_ID) {
    return `
      <button class="all-nodes-dock-item all-nodes-dock-item--quac" type="button" data-restore-id="${itemId}" aria-label="Restore QUAC terminal">
        <span class="dock-icon">Q</span>
        <span class="dock-label">QUAC</span>
      </button>
    `;
  }

  const node = nodeMap.get(itemId);
  if (!node) return "";

  return `
    <button class="all-nodes-dock-item" type="button" data-restore-id="${itemId}" aria-label="Restore ${node.label}">
      <span class="dock-icon">${node.icon}</span>
      <span class="dock-label">${node.label}</span>
    </button>
  `;
}

export function renderAllNodesMenuScreen(fromFieldMap?: string): void {
  const root = document.getElementById("app");
  if (!root) return;

  if (fromFieldMap) {
    lastFieldMap = fromFieldMap;
  }

  const state = getGameState();
  const wad = state.wad ?? 0;
  const res = state.resources ?? {
    metalScrap: 0,
    wood: 0,
    chaosShards: 0,
    steamComponents: 0,
  };

  const nodeLayout = readNodeLayout();
  const nodeMap = new Map(nodeLayout.map((node) => [node.action, node]));
  const fullOrder = readLayoutOrder();
  const minimized = new Set(readMinimizedItems());
  const itemSizes = readItemSizes();
  const activeOrder = fullOrder.filter((id) => !minimized.has(id));
  const dockOrder = fullOrder.filter((id) => minimized.has(id));

  root.innerHTML = `
    <div class="all-nodes-menu-screen town-screen town-screen--hub ard-noise">
      <header class="all-nodes-menu-header town-screen__hero">
        <div class="all-nodes-header-copy">
          <div class="all-nodes-terminal-bar">
            <span class="terminal-indicator"></span>
            <span class="terminal-text">S/COM_OS // BASE_CAMP.SYS</span>
          </div>
          <h1 class="all-nodes-menu-title">BASE CAMP</h1>
          <p class="all-nodes-menu-subtitle">AERISS // PROFILE</p>
        </div>
        <div class="all-nodes-header-actions">
          <button class="all-nodes-reset-btn" type="button" id="allNodesResetViewBtn">RESET VIEW</button>
        </div>
      </header>

      <nav class="all-nodes-menu-mode-toggle">
        <button class="all-nodes-mode-tab all-nodes-mode-tab--active" data-mode="menu">
          <span class="mode-icon">[CMD]</span>
          <span class="mode-label">COMMAND</span>
        </button>
      </nav>

      <div class="all-nodes-menu-resources town-screen__resource-strip ard-panel--inset">
        <div class="all-nodes-resource">
          <span class="resource-icon">W</span>
          <span class="resource-value">${wad.toLocaleString()}</span>
          <span class="resource-label">WAD</span>
        </div>
        <div class="all-nodes-resource">
          <span class="resource-icon">M</span>
          <span class="resource-value">${res.metalScrap}</span>
          <span class="resource-label">METAL</span>
        </div>
        <div class="all-nodes-resource">
          <span class="resource-icon">T</span>
          <span class="resource-value">${res.wood}</span>
          <span class="resource-label">TIMBER</span>
        </div>
        <div class="all-nodes-resource">
          <span class="resource-icon">C</span>
          <span class="resource-value">${res.chaosShards}</span>
          <span class="resource-label">CHAOS</span>
        </div>
        <div class="all-nodes-resource">
          <span class="resource-icon">S</span>
          <span class="resource-value">${res.steamComponents}</span>
          <span class="resource-label">STEAM</span>
        </div>
      </div>

      <div class="all-nodes-menu-grid town-screen__grid" id="allNodesMenuGrid">
        ${activeOrder.map((itemId) => {
          if (itemId === QUAC_LAYOUT_ID) {
            return `
              <div class="all-nodes-grid-item all-nodes-grid-item--quac" data-layout-id="${itemId}" ${getItemStyle(itemId, itemSizes)}>
                ${renderQuacContent()}
              </div>
            `;
          }

          const node = nodeMap.get(itemId);
          if (!node) return "";

          return `
            <div class="all-nodes-grid-item" data-layout-id="${itemId}" ${getItemStyle(itemId, itemSizes)}>
              ${renderNodeContent(node)}
            </div>
          `;
        }).join("")}
      </div>

      <div class="all-nodes-minimized-dock" id="allNodesMinimizedDock">
        ${dockOrder.map((itemId) => renderDockItem(itemId, nodeMap)).join("")}
      </div>

      <footer class="all-nodes-menu-footer town-screen__footer">
        <div class="all-nodes-debug-section">
          <span class="debug-label">[DEV]</span>
          <button class="all-nodes-debug-btn" data-action="endless-field-nodes">
            <span class="debug-icon">INF</span>
            <span class="debug-text">ENDLESS ROOMS</span>
          </button>
          <button class="all-nodes-debug-btn" data-action="endless-battles">
            <span class="debug-icon">BTL</span>
            <span class="debug-text">ENDLESS BATTLES</span>
          </button>
          <button class="all-nodes-debug-btn" data-action="debug-wad">
            <span class="debug-icon">WAD</span>
            <span class="debug-text">+999999 WAD</span>
          </button>
        </div>
        <div class="all-nodes-escape-hint">
          <span class="hint-key">[ESC]</span>
          <span class="hint-text">Return to Field</span>
        </div>
      </footer>

      <div class="ard-ghost-text all-nodes-ghost">CHAOS_CORE.v0.12</div>
    </div>
  `;

  attachAllNodesMenuListeners();
}

function attachAllNodesMenuListeners(): void {
  const root = document.getElementById("app");
  if (!root) return;

  root.querySelectorAll(".all-nodes-mode-tab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const mode = (btn as HTMLElement).dataset.mode;
      handleModeSwitch(mode);
    });
  });

  root.querySelectorAll(".all-nodes-node-btn[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (Date.now() < suppressNodeClickUntil) {
        e.preventDefault();
        return;
      }
      const action = (btn as HTMLElement).dataset.action;
      if (action) {
        handleNodeAction(action);
      }
    });
  });

  root.querySelector<HTMLButtonElement>("#allNodesResetViewBtn")?.addEventListener("click", () => {
    resetBaseCampView();
    renderAllNodesMenuScreen();
  });

  root.querySelectorAll<HTMLElement>(".all-nodes-item-minimize[data-minimize-id]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const itemId = btn.dataset.minimizeId;
      if (!itemId) return;

      const minimized = new Set(readMinimizedItems());
      minimized.add(itemId);
      persistMinimizedItems(Array.from(minimized));
      renderAllNodesMenuScreen();
    });
  });

  root.querySelectorAll<HTMLElement>(".all-nodes-dock-item[data-restore-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = btn.dataset.restoreId;
      if (!itemId) return;

      const minimized = new Set(readMinimizedItems());
      minimized.delete(itemId);
      persistMinimizedItems(Array.from(minimized));
      renderAllNodesMenuScreen();
    });
  });

  attachPointerGridDrag(root);
  attachPointerResize(root);

  root.querySelectorAll(".all-nodes-debug-btn[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const action = (btn as HTMLElement).dataset.action;
      if (action) {
        handleNodeAction(action);
      }
    });
  });

  const quacForm = root.querySelector<HTMLFormElement>("#quacForm");
  const quacInput = root.querySelector<HTMLInputElement>("#quacInput");
  const quacStatus = root.querySelector<HTMLElement>("#quacStatus");
  if (quacForm && quacInput && quacStatus) {
    quacForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const rawCommand = quacInput.value;
      const resolvedAction = resolveQuacCommand(rawCommand);

      if (!resolvedAction) {
        quacLastFeedback = `Unknown command: "${rawCommand.trim() || "blank"}". Try "unit roster", "loadout", "inventory", "shop", or "port".`;
        quacStatus.textContent = quacLastFeedback;
        quacStatus.classList.add("all-nodes-cli-status--error");
        quacInput.select();
        return;
      }

      quacLastFeedback = `Executing ${resolvedAction.toUpperCase()}...`;
      quacStatus.textContent = quacLastFeedback;
      quacStatus.classList.remove("all-nodes-cli-status--error");
      quacInput.value = "";
      handleNodeAction(resolvedAction);
    });

    quacInput.addEventListener("input", () => {
      if (quacStatus.classList.contains("all-nodes-cli-status--error")) {
        quacStatus.classList.remove("all-nodes-cli-status--error");
        quacStatus.textContent = 'Type a node name, then press ENTER. Example: "unit roster" or "inventory".';
      }
    });

    setTimeout(() => quacInput.focus(), 0);
  }

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleModeSwitch("field");
      window.removeEventListener("keydown", escHandler);
    }
  };
  window.addEventListener("keydown", escHandler);
}

function attachPointerGridDrag(root: HTMLElement): void {
  const grid = root.querySelector<HTMLElement>("#allNodesMenuGrid");
  if (!grid) return;

  const wrappers = Array.from(grid.querySelectorAll<HTMLElement>(".all-nodes-grid-item"));
  wrappers.forEach((wrapper) => {
    wrapper.addEventListener("pointerdown", (event: PointerEvent) => {
      if (event.button !== 0) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest(".all-nodes-item-minimize, .all-nodes-item-resize, .all-nodes-cli-form, .all-nodes-cli-input, .all-nodes-cli-submit, .all-nodes-cli-prompt")) {
        return;
      }

      const pressedAction = target.closest<HTMLElement>(".all-nodes-node-btn[data-action]")?.dataset.action ?? null;
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      const draggedItem = wrapper;
      const draggedId = draggedItem.dataset.layoutId;
      if (!draggedId) return;

      const initialOrder = readLayoutOrder();
      const minimized = new Set(readMinimizedItems());
      let started = false;
      let ghost: HTMLElement | null = null;
      let offsetX = 0;
      let offsetY = 0;

      const cleanup = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        try {
          if (draggedItem.hasPointerCapture(pointerId)) {
            draggedItem.releasePointerCapture(pointerId);
          }
        } catch {
          // Ignore release failures.
        }

        if (ghost) {
          ghost.remove();
        }

        draggedItem.classList.remove("all-nodes-grid-item--dragging", "all-nodes-grid-item--placeholder");
        clearLayoutDropTargets(grid);
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;

        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (!started) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
            return;
          }

          started = true;
          suppressNodeClickUntil = Date.now() + 250;

          const rect = draggedItem.getBoundingClientRect();
          offsetX = startX - rect.left;
          offsetY = startY - rect.top;

          ghost = draggedItem.cloneNode(true) as HTMLElement;
          ghost.classList.add("all-nodes-grid-item--ghost");
          ghost.style.width = `${rect.width}px`;
          ghost.style.height = `${rect.height}px`;
          ghost.style.left = `${rect.left}px`;
          ghost.style.top = `${rect.top}px`;
          document.body.appendChild(ghost);

          try {
            draggedItem.setPointerCapture(pointerId);
          } catch {
            // Ignore capture failures and keep dragging with window listeners.
          }

          draggedItem.classList.add("all-nodes-grid-item--dragging", "all-nodes-grid-item--placeholder");
        }

        if (ghost) {
          ghost.style.left = `${moveEvent.clientX - offsetX}px`;
          ghost.style.top = `${moveEvent.clientY - offsetY}px`;
        }

        const hovered = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest(".all-nodes-grid-item") as HTMLElement | null;
        clearLayoutDropTargets(grid);

        if (hovered && hovered !== draggedItem) {
          hovered.classList.add("all-nodes-grid-item--drop-target");
          const rect = hovered.getBoundingClientRect();
          const insertBefore = moveEvent.clientY < rect.top + rect.height / 2 ||
            (Math.abs(moveEvent.clientY - (rect.top + rect.height / 2)) < rect.height * 0.2 &&
              moveEvent.clientX < rect.left + rect.width / 2);

          if (insertBefore) {
            grid.insertBefore(draggedItem, hovered);
          } else if (hovered.nextSibling !== draggedItem) {
            grid.insertBefore(draggedItem, hovered.nextSibling);
          }
        } else if (!hovered && isPointInsideRect(grid.getBoundingClientRect(), moveEvent.clientX, moveEvent.clientY)) {
          grid.appendChild(draggedItem);
        }
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;

        if (started) {
          const activeOrder = Array.from(grid.querySelectorAll<HTMLElement>(".all-nodes-grid-item")).map((item) => item.dataset.layoutId ?? "").filter(Boolean);
          const nextOrder = mergeLayoutOrder(activeOrder, initialOrder, minimized);
          persistLayoutOrder(nextOrder);
          cleanup();
          renderAllNodesMenuScreen();
          return;
        }

        cleanup();

        if (
          pressedAction &&
          Date.now() >= suppressNodeClickUntil &&
          isPointInsideRect(draggedItem.getBoundingClientRect(), upEvent.clientX, upEvent.clientY)
        ) {
          suppressNodeClickUntil = Date.now() + 250;
          handleNodeAction(pressedAction);
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    });
  });
}

function attachPointerResize(root: HTMLElement): void {
  const grid = root.querySelector<HTMLElement>("#allNodesMenuGrid");
  if (!grid) return;

  const handles = root.querySelectorAll<HTMLElement>(".all-nodes-item-resize[data-resize-id]");
  handles.forEach((handle) => {
    handle.addEventListener("pointerdown", (event: PointerEvent) => {
      if (event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      const itemId = handle.dataset.resizeId;
      const wrapper = handle.closest<HTMLElement>(".all-nodes-grid-item");
      if (!itemId || !wrapper) return;

      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      const startRect = wrapper.getBoundingClientRect();
      const metrics = getGridMetrics(grid);
      const sizes = { ...readItemSizes() };
      const existingSize = sizes[itemId];
      const initialSpan = existingSize?.colSpan ?? (wrapper.classList.contains("all-nodes-grid-item--quac") ? 2 : 1);
      const initialHeight = existingSize?.minHeight ?? Math.max(MIN_ITEM_HEIGHT, Math.round(startRect.height));
      let resizing = false;

      const cleanup = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        try {
          handle.releasePointerCapture(pointerId);
        } catch {
          // Ignore release failures.
        }
        wrapper.classList.remove("all-nodes-grid-item--resizing");
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;

        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (!resizing && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
          return;
        }

        resizing = true;
        suppressNodeClickUntil = Date.now() + 250;
        wrapper.classList.add("all-nodes-grid-item--resizing");

        const nextWidth = Math.max(metrics.trackWidth, startRect.width + dx);
        const nextHeight = Math.max(MIN_ITEM_HEIGHT, startRect.height + dy);
        const nextSpan = clamp(Math.round((nextWidth + metrics.gap) / (metrics.trackWidth + metrics.gap)), 1, metrics.columnCount);

        wrapper.style.gridColumn = `span ${nextSpan}`;
        wrapper.style.minHeight = `${Math.round(nextHeight)}px`;
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;

        if (resizing) {
          const finalRect = wrapper.getBoundingClientRect();
          const finalSpan = clamp(Math.round((finalRect.width + metrics.gap) / (metrics.trackWidth + metrics.gap)), 1, metrics.columnCount);
          sizes[itemId] = {
            colSpan: finalSpan || initialSpan,
            minHeight: Math.max(MIN_ITEM_HEIGHT, Math.round(finalRect.height || initialHeight)),
          };
          persistItemSizes(sizes);
        }

        cleanup();
        if (resizing) {
          renderAllNodesMenuScreen();
        }
      };

      handle.setPointerCapture(pointerId);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    });
  });
}

function clearLayoutDropTargets(grid: HTMLElement): void {
  grid.querySelectorAll(".all-nodes-grid-item--drop-target").forEach((element) => {
    element.classList.remove("all-nodes-grid-item--drop-target");
  });
}

function getGridMetrics(grid: HTMLElement): { columnCount: number; trackWidth: number; gap: number } {
  const computed = window.getComputedStyle(grid);
  const gap = parseFloat(computed.columnGap || "0") || 0;
  const trackWidths = computed.gridTemplateColumns
    .split(" ")
    .map((token) => parseFloat(token))
    .filter((value) => Number.isFinite(value) && value > 0);

  const columnCount = Math.max(trackWidths.length, 1);
  const trackWidth = trackWidths[0] ?? 180;
  return { columnCount, trackWidth, gap };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isPointInsideRect(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function handleModeSwitch(mode: string | undefined): void {
  switch (mode) {
    case "field":
      renderFieldScreen(lastFieldMap as any);
      break;
    case "classic":
      break;
    case "menu":
      break;
  }
}

function handleNodeAction(action: string): void {
  switch (action) {
    case "shop":
      import("./ShopScreen").then(({ renderShopScreen }) => {
        renderShopScreen("basecamp");
      });
      break;
    case "workshop":
      import("./GearWorkbenchScreen").then(({ renderGearWorkbenchScreen }) => {
        renderGearWorkbenchScreen(undefined, undefined, "basecamp");
      });
      break;
    case "roster":
      import("./RosterScreen").then(({ renderRosterScreen }) => {
        renderRosterScreen("basecamp");
      });
      break;
    case "loadout":
      import("./InventoryScreen").then(({ renderInventoryScreen }) => {
        renderInventoryScreen("basecamp");
      });
      break;
    case "inventory":
      import("./InventoryViewScreen").then(({ renderInventoryViewScreen }) => {
        renderInventoryViewScreen("basecamp");
      });
      break;
    case "quest-board":
      import("./QuestBoardScreen").then(({ renderQuestBoardScreen }) => {
        renderQuestBoardScreen("basecamp");
      });
      break;
    case "tavern":
      import("./TavernDialogueScreen").then(({ renderTavernDialogueScreen }) => {
        renderTavernDialogueScreen("base_camp_tavern", "Tavern", "basecamp");
      });
      break;
    case "ops-terminal":
      import("./OperationSelectScreen").then(({ renderOperationSelectScreen }) => {
        renderOperationSelectScreen("basecamp");
      });
      break;
    case "gear-workbench":
      import("./GearWorkbenchScreen").then(({ renderGearWorkbenchScreen }) => {
        const state = getGameState();
        const firstUnitId = state.partyUnitIds?.[0] ?? null;
        if (firstUnitId) {
          const unit = state.unitsById[firstUnitId];
          const weaponId = (unit as any)?.loadout?.primaryWeapon ?? null;
          renderGearWorkbenchScreen(firstUnitId, weaponId, "basecamp");
        } else {
          renderGearWorkbenchScreen(undefined, undefined, "basecamp");
        }
      });
      break;
    case "port":
      import("./PortScreen").then(({ renderPortScreen }) => {
        renderPortScreen("basecamp");
      });
      break;
    case "quarters":
      renderFieldScreen("quarters");
      break;
    case "stable":
      import("./StableScreen").then(({ renderStableScreen }) => {
        renderStableScreen("basecamp");
      });
      break;
    case "codex":
      import("./CodexScreen").then(({ renderCodexScreen }) => {
        renderCodexScreen("basecamp");
      });
      break;
    case "settings":
      import("./SettingsScreen").then(({ renderSettingsScreen }) => {
        renderSettingsScreen("basecamp");
      });
      break;
    case "comms-array":
      import("./CommsArrayScreen").then(({ renderCommsArrayScreen }) => {
        renderCommsArrayScreen("basecamp");
      });
      break;
    case "endless-field-nodes":
      import("./FieldNodeRoomScreen").then(({ renderFieldNodeRoomScreen }) => {
        const initialSeed = Math.floor(Math.random() * 1000000);
        renderFieldNodeRoomScreen("endless_room_0", initialSeed, true);
      });
      break;
    case "endless-battles":
      import("./BattleScreen").then(({ startEndlessBattleMode }) => {
        startEndlessBattleMode();
      });
      break;
    case "debug-wad":
      updateGameState((state) => ({
        ...state,
        wad: 999999,
        resources: {
          metalScrap: 99999,
          wood: 99999,
          chaosShards: 99999,
          steamComponents: 99999,
        },
      }));
      renderAllNodesMenuScreen();
      break;
  }
}

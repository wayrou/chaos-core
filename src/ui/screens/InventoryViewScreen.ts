import { getGameState, updateGameState } from "../../state/gameStore";
import {
  buildInventoryVM,
  InventoryCategory,
  InventoryEntryVM,
} from "../../core/inventoryViewModel";
import {
  DEFAULT_INVENTORY_FOLDER_COLORS,
  getDeployableInventoryIdFromEntryKey,
  readInventoryFolders,
} from "../../core/inventoryFolders";
import { buildOwnedBaseStorageItems } from "../../core/loadoutInventory";
import {
  BaseCampItemSize,
  InventoryFolder,
  InventoryItem,
} from "../../core/types";
import {
  BaseCampReturnTo,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";
import { clearControllerContext } from "../../core/controllerSupport";

let selectedCategory: InventoryCategory | "all" = "all";
let searchQuery = "";

type WorkspaceLayout = {
  colSpan: number;
  rowSpan: number;
  gridX: number;
  gridY: number;
};

type FolderDisplayState = {
  folder: InventoryFolder;
  members: InventoryEntryVM[];
  matchedMembers: InventoryEntryVM[];
  totalMassKg: number;
  totalBulkBu: number;
  totalPowerW: number;
  deployableItemCount: number;
};

type WorkspaceNode =
  | { key: string; kind: "entry"; entry: InventoryEntryVM }
  | { key: string; kind: "folder"; folderState: FolderDisplayState };

const WORKSPACE_COLUMNS = 12;
const WORKSPACE_ROW_HEIGHT_PX = 24;
const WORKSPACE_DRAG_THRESHOLD_PX = 8;
const WORKSPACE_MIN_ROWS = 18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function generateFolderId(existingFolders: Record<string, InventoryFolder>): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    let candidate = `folder:${crypto.randomUUID()}`;
    while (existingFolders[candidate]) {
      candidate = `folder:${crypto.randomUUID()}`;
    }
    return candidate;
  }

  let attempt = 0;
  let candidate = `folder:${Date.now()}`;
  while (existingFolders[candidate]) {
    attempt += 1;
    candidate = `folder:${Date.now()}-${attempt}`;
  }
  return candidate;
}

function getNodeShape(node: WorkspaceNode): Pick<WorkspaceLayout, "colSpan" | "rowSpan"> {
  if (node.kind === "folder") {
    return { colSpan: 4, rowSpan: 5 };
  }

  switch (node.entry.category) {
    case "equipment":
      return { colSpan: 3, rowSpan: 4 };
    case "keyItem":
      return { colSpan: 2, rowSpan: 2 };
    case "recipe":
      return { colSpan: 1, rowSpan: 2 };
    case "resource":
      return { colSpan: 1, rowSpan: 2 };
    case "weaponPart":
      return { colSpan: 1, rowSpan: 2 };
    case "consumable":
    default:
      return { colSpan: 1, rowSpan: 2 };
  }
}

function normalizeLayout(node: WorkspaceNode, layout: BaseCampItemSize | undefined): WorkspaceLayout {
  const shape = getNodeShape(node);
  const colSpan = clamp(layout?.colSpan ?? shape.colSpan, 1, WORKSPACE_COLUMNS);
  return {
    colSpan,
    rowSpan: Math.max(layout?.rowSpan ?? shape.rowSpan, shape.rowSpan),
    gridX: clamp(layout?.gridX ?? 1, 1, Math.max(WORKSPACE_COLUMNS - colSpan + 1, 1)),
    gridY: Math.max(layout?.gridY ?? 1, 1),
  };
}

function serializeLayout(layout: WorkspaceLayout): BaseCampItemSize {
  return {
    colSpan: layout.colSpan,
    rowSpan: layout.rowSpan,
    gridX: layout.gridX,
    gridY: layout.gridY,
  };
}

function layoutsOverlap(a: WorkspaceLayout, b: WorkspaceLayout): boolean {
  return (
    a.gridX < b.gridX + b.colSpan &&
    a.gridX + a.colSpan > b.gridX &&
    a.gridY < b.gridY + b.rowSpan &&
    a.gridY + a.rowSpan > b.gridY
  );
}

function isAreaFree(candidate: WorkspaceLayout, occupied: Iterable<WorkspaceLayout>): boolean {
  for (const layout of occupied) {
    if (layoutsOverlap(candidate, layout)) {
      return false;
    }
  }
  return true;
}

function placeLayoutWithoutOverlap(requested: WorkspaceLayout, occupied: Iterable<WorkspaceLayout>): WorkspaceLayout {
  const candidate: WorkspaceLayout = {
    colSpan: clamp(requested.colSpan, 1, WORKSPACE_COLUMNS),
    rowSpan: Math.max(requested.rowSpan, 1),
    gridX: clamp(requested.gridX, 1, Math.max(WORKSPACE_COLUMNS - requested.colSpan + 1, 1)),
    gridY: Math.max(requested.gridY, 1),
  };

  let guard = 0;
  while (!isAreaFree(candidate, occupied) && guard < 3000) {
    candidate.gridY += 1;
    guard += 1;
  }
  return candidate;
}

function buildOwnedDeployableLookup(): Map<string, InventoryItem> {
  const state = getGameState();
  const combined = new Map<string, InventoryItem>();
  const allItems = [
    ...buildOwnedBaseStorageItems(state),
    ...(state.inventory?.forwardLocker ?? []),
  ];

  allItems.forEach((item) => {
    const existing = combined.get(item.id);
    if (!existing) {
      combined.set(item.id, { ...item });
      return;
    }

    if (item.stackable) {
      existing.quantity += item.quantity;
    }
  });

  return combined;
}

function filterEntries(
  entries: InventoryEntryVM[],
  category: InventoryCategory | "all",
  query: string,
): InventoryEntryVM[] {
  let filtered = entries;

  if (category !== "all") {
    filtered = filtered.filter((entry) => entry.category === category);
  }

  if (query.trim()) {
    const lower = query.trim().toLowerCase();
    filtered = filtered.filter((entry) =>
      entry.name.toLowerCase().includes(lower) ||
      (entry.description?.toLowerCase().includes(lower) ?? false),
    );
  }

  return filtered;
}

function buildFolderDisplayState(
  folder: InventoryFolder,
  entryMap: Map<string, InventoryEntryVM>,
  filteredEntryKeys: Set<string>,
  ownedLookup: Map<string, InventoryItem>,
): FolderDisplayState {
  const members = folder.entryKeys
    .map((entryKey) => entryMap.get(entryKey))
    .filter((entry): entry is InventoryEntryVM => Boolean(entry));
  const matchedMembers = members.filter((entry) => filteredEntryKeys.has(entry.key));

  const deployableIds = Array.from(
    new Set(folder.entryKeys.map((entryKey) => getDeployableInventoryIdFromEntryKey(entryKey)).filter(Boolean)),
  ) as string[];

  const deployableItems = deployableIds
    .map((itemId) => ownedLookup.get(itemId))
    .filter((item): item is InventoryItem => Boolean(item));

  return {
    folder,
    members,
    matchedMembers,
    totalMassKg: sumInventoryMetric(deployableItems, "massKg"),
    totalBulkBu: sumInventoryMetric(deployableItems, "bulkBu"),
    totalPowerW: sumInventoryMetric(deployableItems, "powerW"),
    deployableItemCount: deployableItems.length,
  };
}

function buildWorkspaceNodes(
  entries: InventoryEntryVM[],
  folders: Record<string, InventoryFolder>,
): {
  nodes: WorkspaceNode[];
  visibleFolders: FolderDisplayState[];
} {
  const filteredEntries = filterEntries(entries, selectedCategory, searchQuery);
  const filteredEntryKeys = new Set(filteredEntries.map((entry) => entry.key));
  const entryMap = new Map(entries.map((entry) => [entry.key, entry] as const));
  const ownedLookup = buildOwnedDeployableLookup();

  const visibleFolders = Object.values(folders)
    .map((folder) => buildFolderDisplayState(folder, entryMap, filteredEntryKeys, ownedLookup))
    .filter((folderState) => folderState.matchedMembers.length > 0);

  const hiddenEntryKeys = new Set(
    visibleFolders.flatMap((folderState) => folderState.matchedMembers.map((entry) => entry.key)),
  );

  const topLevelEntries = filteredEntries.filter((entry) => !hiddenEntryKeys.has(entry.key));
  const nodes: WorkspaceNode[] = [
    ...visibleFolders.map((folderState) => ({ key: folderState.folder.id, kind: "folder" as const, folderState })),
    ...topLevelEntries.map((entry) => ({ key: entry.key, kind: "entry" as const, entry })),
  ];

  return { nodes, visibleFolders };
}

function buildWorkspaceLayouts(nodes: WorkspaceNode[], savedLayouts: Record<string, BaseCampItemSize>): Map<string, WorkspaceLayout> {
  const layouts = new Map<string, WorkspaceLayout>();
  const occupied: WorkspaceLayout[] = [];

  nodes.forEach((node) => {
    const placed = placeLayoutWithoutOverlap(normalizeLayout(node, savedLayouts[node.key]), occupied);
    occupied.push(placed);
    layouts.set(node.key, placed);
  });

  return layouts;
}

function sumInventoryMetric(items: InventoryItem[], key: "massKg" | "bulkBu" | "powerW"): number {
  return items.reduce((sum, item) => sum + (item[key] * Math.max(item.quantity || 1, 1)), 0);
}

function readSavedLayouts(): Record<string, BaseCampItemSize> {
  return { ...(getGameState().uiLayout?.inventoryViewNodeLayouts ?? {}) };
}

function getCategoryLabel(category: InventoryCategory): string {
  const labels: Record<InventoryCategory, string> = {
    equipment: "GEAR",
    consumable: "CONS",
    keyItem: "KEY",
    weaponPart: "PART",
    recipe: "RECIPE",
    resource: "RESOURCE",
  };
  return labels[category] ?? category.toUpperCase();
}

function renderInventoryEntryNode(entry: InventoryEntryVM, layout: WorkspaceLayout): string {
  const categoryClass = `inventory-workspace-node--${entry.category}`;
  const nodeClass = entry.category === "equipment"
    ? `inventory-workspace-node inventory-workspace-node--gear ${categoryClass}`
    : `inventory-workspace-node inventory-workspace-node--item ${categoryClass}`;

  return `
    <article
      class="${nodeClass} inventory-workspace-draggable"
      data-node-kind="entry"
      data-node-key="${entry.key}"
      style="grid-column:${layout.gridX} / span ${layout.colSpan};grid-row:${layout.gridY} / span ${layout.rowSpan};"
    >
      <div class="inventory-workspace-node-toolbar">
        <div class="inventory-workspace-node-grip">:::</div>
        <div class="inventory-workspace-node-chip">${getCategoryLabel(entry.category)}</div>
      </div>
      <div class="inventory-workspace-node-body">
        <h2 class="inventory-workspace-node-name">${entry.name}</h2>
        ${entry.description ? `<div class="inventory-workspace-node-description">${entry.description}</div>` : ""}
        ${entry.sortGroup ? `<div class="inventory-workspace-node-meta">${entry.sortGroup.toUpperCase()}</div>` : ""}
      </div>
      <div class="inventory-workspace-node-footer">
        ${entry.equipped ? `<span class="inventory-workspace-node-badge inventory-workspace-node-badge--equipped">EQUIPPED</span>` : ""}
        <span class="inventory-workspace-node-badge">x${entry.owned}</span>
      </div>
    </article>
  `;
}

function renderFolderNode(folderState: FolderDisplayState, layout: WorkspaceLayout): string {
  const visibleMembers = folderState.members.slice(0, 6);
  const hiddenCount = Math.max(folderState.members.length - visibleMembers.length, 0);
  const loadText = folderState.deployableItemCount > 0
    ? `${folderState.totalMassKg}kg / ${folderState.totalBulkBu}bu / ${folderState.totalPowerW}w`
    : "NO DEPLOY LOAD";

  return `
    <article
      class="inventory-workspace-folder inventory-workspace-draggable"
      data-node-kind="folder"
      data-node-key="${folderState.folder.id}"
      style="grid-column:${layout.gridX} / span ${layout.colSpan};grid-row:${layout.gridY} / span ${layout.rowSpan};--inventory-folder-color:${folderState.folder.color};"
    >
      <div class="inventory-workspace-folder-toolbar">
        <div class="inventory-workspace-node-grip">:::</div>
        <div class="inventory-workspace-folder-actions">
          <input
            class="inventory-workspace-folder-color"
            type="color"
            value="${folderState.folder.color}"
            aria-label="Folder color"
            data-folder-color="${folderState.folder.id}"
          />
          <button
            type="button"
            class="inventory-workspace-folder-unpack"
            data-folder-unpack="${folderState.folder.id}"
          >
            UNPACK
          </button>
        </div>
      </div>
      <input
        class="inventory-workspace-folder-name"
        type="text"
        value="${folderState.folder.name}"
        aria-label="Folder name"
        data-folder-name="${folderState.folder.id}"
      />
      <div class="inventory-workspace-folder-summary">
        <span>${folderState.members.length} ASSETS</span>
        <span>${loadText}</span>
      </div>
      <div class="inventory-workspace-folder-members">
        ${visibleMembers.map((member) => `
          <button
            type="button"
            class="inventory-workspace-folder-member"
            data-folder-member-remove="${folderState.folder.id}"
            data-entry-key="${member.key}"
          >
            <span class="inventory-workspace-folder-member-label">${member.name}</span>
            <span class="inventory-workspace-folder-member-remove">x</span>
          </button>
        `).join("")}
        ${hiddenCount > 0 ? `<div class="inventory-workspace-folder-member inventory-workspace-folder-member--more">+${hiddenCount} MORE</div>` : ""}
      </div>
    </article>
  `;
}

function getNextFolderColor(existingFolders: Record<string, InventoryFolder>): string {
  const usedCount = Object.keys(existingFolders).length;
  return DEFAULT_INVENTORY_FOLDER_COLORS[usedCount % DEFAULT_INVENTORY_FOLDER_COLORS.length];
}

function removeEntryKeysFromFolders(
  folders: Record<string, InventoryFolder>,
  entryKeys: string[],
): Record<string, InventoryFolder> {
  const entryKeySet = new Set(entryKeys);
  const nextFolders: Record<string, InventoryFolder> = {};

  Object.values(folders).forEach((folder) => {
    const filteredKeys = folder.entryKeys.filter((entryKey) => !entryKeySet.has(entryKey));
    if (filteredKeys.length === 0) {
      return;
    }
    nextFolders[folder.id] = {
      ...folder,
      entryKeys: filteredKeys,
    };
  });

  return nextFolders;
}

function setFolderState(
  updater: (folders: Record<string, InventoryFolder>, layouts: Record<string, BaseCampItemSize>) => {
    folders: Record<string, InventoryFolder>;
    layouts?: Record<string, BaseCampItemSize>;
  },
): void {
  updateGameState((prev) => {
    const currentFolders = readInventoryFolders(prev);
    const currentLayouts = { ...(prev.uiLayout?.inventoryViewNodeLayouts ?? {}) };
    const next = updater(currentFolders, currentLayouts);
    return {
      ...prev,
      uiLayout: {
        ...prev.uiLayout,
        inventoryFolders: next.folders,
        inventoryViewNodeLayouts: next.layouts ?? currentLayouts,
      },
    };
  });
}

function combineNodesIntoFolder(
  draggedNode: WorkspaceNode,
  targetNode: WorkspaceNode,
  draggedLayout: WorkspaceLayout,
  targetLayout: WorkspaceLayout,
): void {
  setFolderState((folders, layouts) => {
    const nextLayouts = { ...layouts };
    let nextFolders = { ...folders };

    if (draggedNode.kind === "entry" && targetNode.kind === "entry") {
      nextFolders = removeEntryKeysFromFolders(nextFolders, [draggedNode.entry.key, targetNode.entry.key]);
      const folderId = generateFolderId(nextFolders);
      nextFolders[folderId] = {
        id: folderId,
        name: "New Folder",
        color: getNextFolderColor(nextFolders),
        entryKeys: [targetNode.entry.key, draggedNode.entry.key],
      };
      nextLayouts[folderId] = serializeLayout(targetLayout);
      return { folders: nextFolders, layouts: nextLayouts };
    }

    if (draggedNode.kind === "entry" && targetNode.kind === "folder") {
      nextFolders = removeEntryKeysFromFolders(nextFolders, [draggedNode.entry.key]);
      const targetFolder = nextFolders[targetNode.folderState.folder.id] ?? targetNode.folderState.folder;
      nextFolders[targetFolder.id] = {
        ...targetFolder,
        entryKeys: Array.from(new Set([...targetFolder.entryKeys, draggedNode.entry.key])),
      };
      nextLayouts[targetFolder.id] = serializeLayout(targetLayout);
      return { folders: nextFolders, layouts: nextLayouts };
    }

    if (draggedNode.kind === "folder" && targetNode.kind === "entry") {
      nextFolders = removeEntryKeysFromFolders(nextFolders, [targetNode.entry.key]);
      const draggedFolder = nextFolders[draggedNode.folderState.folder.id] ?? draggedNode.folderState.folder;
      nextFolders[draggedFolder.id] = {
        ...draggedFolder,
        entryKeys: Array.from(new Set([...draggedFolder.entryKeys, targetNode.entry.key])),
      };
      nextLayouts[draggedFolder.id] = serializeLayout(draggedLayout);
      return { folders: nextFolders, layouts: nextLayouts };
    }

    if (draggedNode.kind === "folder" && targetNode.kind === "folder") {
      const draggedFolder = nextFolders[draggedNode.folderState.folder.id] ?? draggedNode.folderState.folder;
      const targetFolder = nextFolders[targetNode.folderState.folder.id] ?? targetNode.folderState.folder;
      if (draggedFolder.id !== targetFolder.id) {
        nextFolders[targetFolder.id] = {
          ...targetFolder,
          entryKeys: Array.from(new Set([...targetFolder.entryKeys, ...draggedFolder.entryKeys])),
        };
        delete nextFolders[draggedFolder.id];
        delete nextLayouts[draggedFolder.id];
      }
      nextLayouts[targetFolder.id] = serializeLayout(targetLayout);
      return { folders: nextFolders, layouts: nextLayouts };
    }

    return { folders: nextFolders, layouts: nextLayouts };
  });
}

function attachWorkspaceDragging(root: HTMLElement, returnTo: BaseCampReturnTo): void {
  const grid = root.querySelector<HTMLElement>("#inventoryWorkspaceGrid");
  if (!grid) return;

  const wrappers = Array.from(grid.querySelectorAll<HTMLElement>(".inventory-workspace-draggable"));
  wrappers.forEach((wrapper) => {
    wrapper.addEventListener("pointerdown", (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (!target || target.closest("button, input, select, textarea, label")) {
        return;
      }

      const nodeKind = wrapper.dataset.nodeKind as "entry" | "folder" | undefined;
      const nodeKey = wrapper.dataset.nodeKey;
      if (!nodeKind || !nodeKey) return;

      const state = getGameState();
      const vm = buildInventoryVM(state);
      const folders = readInventoryFolders(state);
      const { nodes } = buildWorkspaceNodes(vm.entries, folders);
      const savedLayouts = readSavedLayouts();
      const workspaceLayouts = buildWorkspaceLayouts(nodes, savedLayouts);
      const draggedNode = nodes.find((node) => node.kind === nodeKind && node.key === nodeKey);
      const initialLayout = workspaceLayouts.get(nodeKey);
      if (!draggedNode || !initialLayout) {
        return;
      }

      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      const occupied = nodes
        .filter((node) => node.key !== nodeKey)
        .map((node) => workspaceLayouts.get(node.key))
        .filter((layout): layout is WorkspaceLayout => Boolean(layout));
      let started = false;
      let ghost: HTMLElement | null = null;
      let offsetX = 0;
      let offsetY = 0;
      let previewLayout = { ...initialLayout };

      const cleanup = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        try {
          if (wrapper.hasPointerCapture(pointerId)) {
            wrapper.releasePointerCapture(pointerId);
          }
        } catch {
          // Ignore release failures.
        }
        wrapper.classList.remove("inventory-workspace-node--dragging");
        if (ghost?.parentElement) {
          ghost.parentElement.removeChild(ghost);
        }
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;

        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (!started) {
          if (Math.hypot(dx, dy) < WORKSPACE_DRAG_THRESHOLD_PX) {
            return;
          }
          started = true;
          const rect = wrapper.getBoundingClientRect();
          offsetX = startX - rect.left;
          offsetY = startY - rect.top;

          ghost = wrapper.cloneNode(true) as HTMLElement;
          ghost.classList.add("inventory-workspace-node--ghost");
          ghost.style.width = `${rect.width}px`;
          ghost.style.height = `${rect.height}px`;
          ghost.style.left = `${rect.left}px`;
          ghost.style.top = `${rect.top}px`;
          document.body.appendChild(ghost);

          try {
            wrapper.setPointerCapture(pointerId);
          } catch {
            // Ignore capture failures.
          }

          wrapper.classList.add("inventory-workspace-node--dragging");
        }

        if (ghost) {
          ghost.style.left = `${moveEvent.clientX - offsetX}px`;
          ghost.style.top = `${moveEvent.clientY - offsetY}px`;
        }

        const rect = grid.getBoundingClientRect();
        const styles = window.getComputedStyle(grid);
        const columnGap = Number.parseFloat(styles.columnGap || styles.gap || "12") || 12;
        const rowGap = Number.parseFloat(styles.rowGap || styles.gap || "12") || 12;
        const trackWidth = Math.max(
          (rect.width - columnGap * Math.max(WORKSPACE_COLUMNS - 1, 0)) / WORKSPACE_COLUMNS,
          1,
        );
        const columnStep = Math.max(trackWidth + columnGap, 1);
        const rowStep = Math.max(WORKSPACE_ROW_HEIGHT_PX + rowGap, 1);
        const localX = Math.max(moveEvent.clientX - offsetX - rect.left, 0);
        const localY = Math.max(moveEvent.clientY - offsetY - rect.top + grid.scrollTop, 0);
        const maxGridX = Math.max(WORKSPACE_COLUMNS - initialLayout.colSpan + 1, 1);

        previewLayout = placeLayoutWithoutOverlap({
          colSpan: initialLayout.colSpan,
          rowSpan: initialLayout.rowSpan,
          gridX: clamp(Math.floor(localX / columnStep) + 1, 1, maxGridX),
          gridY: Math.max(Math.floor(localY / rowStep) + 1, 1),
        }, occupied);

        wrapper.style.gridColumn = `${previewLayout.gridX} / span ${previewLayout.colSpan}`;
        wrapper.style.gridRow = `${previewLayout.gridY} / span ${previewLayout.rowSpan}`;
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;

        if (started) {
          const combineTarget = nodes.find((candidate) => {
            if (candidate.key === nodeKey) return false;
            const candidateElement = grid.querySelector<HTMLElement>(`.inventory-workspace-draggable[data-node-key="${candidate.key}"]`);
            if (!candidateElement) return false;
            const rect = candidateElement.getBoundingClientRect();
            return upEvent.clientX >= rect.left &&
              upEvent.clientX <= rect.right &&
              upEvent.clientY >= rect.top &&
              upEvent.clientY <= rect.bottom;
          });

          if (combineTarget) {
            const targetLayout = workspaceLayouts.get(combineTarget.key) ?? previewLayout;
            combineNodesIntoFolder(draggedNode, combineTarget, previewLayout, targetLayout);
            cleanup();
            renderInventoryViewScreen(returnTo);
            return;
          }

          setFolderState((folders, layouts) => ({
            folders,
            layouts: {
              ...layouts,
              [nodeKey]: serializeLayout(previewLayout),
            },
          }));
          cleanup();
          renderInventoryViewScreen(returnTo);
          return;
        }

        cleanup();
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    });
  });
}

function attachInventoryViewListeners(returnTo: BaseCampReturnTo): void {
  const root = document.getElementById("app");
  if (!root) return;

  const backBtn = root.querySelector<HTMLButtonElement>("#backBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      unregisterBaseCampReturnHotkey("inventory-view-screen");
      const returnDestination = (backBtn.getAttribute("data-return-to") as BaseCampReturnTo | null) || returnTo;
      returnFromBaseCampScreen(returnDestination);
    });
  }

  registerBaseCampReturnHotkey("inventory-view-screen", returnTo, {
    allowFieldEKey: true,
    activeSelector: ".inventory-view-root",
  });

  root.querySelectorAll<HTMLButtonElement>(".inventory-workspace-filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.category as InventoryCategory | "all" | undefined;
      if (!category) return;
      selectedCategory = category;
      renderInventoryViewScreen(returnTo);
    });
  });

  const searchInput = root.querySelector<HTMLInputElement>("#searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      searchQuery = target.value;
      const cursorPosition = target.selectionStart ?? target.value.length;
      renderInventoryViewScreen(returnTo);
      requestAnimationFrame(() => {
        const nextInput = document.querySelector<HTMLInputElement>("#searchInput");
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(cursorPosition, cursorPosition);
        }
      });
    });
  }

  const clearBtn = root.querySelector<HTMLButtonElement>("#clearSearchBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      searchQuery = "";
      renderInventoryViewScreen(returnTo);
    });
  }

  root.querySelectorAll<HTMLInputElement>("[data-folder-name]").forEach((input) => {
    input.addEventListener("change", () => {
      const folderId = input.dataset.folderName;
      if (!folderId) return;
      const nextName = input.value.trim() || "Folder";
      setFolderState((folders, layouts) => {
        const folder = folders[folderId];
        if (!folder) {
          return { folders, layouts };
        }
        return {
          folders: {
            ...folders,
            [folderId]: {
              ...folder,
              name: nextName,
            },
          },
          layouts,
        };
      });
      renderInventoryViewScreen(returnTo);
    });
  });

  root.querySelectorAll<HTMLInputElement>("[data-folder-color]").forEach((input) => {
    input.addEventListener("change", () => {
      const folderId = input.dataset.folderColor;
      if (!folderId) return;
      const nextColor = input.value || DEFAULT_INVENTORY_FOLDER_COLORS[0];
      setFolderState((folders, layouts) => {
        const folder = folders[folderId];
        if (!folder) {
          return { folders, layouts };
        }
        return {
          folders: {
            ...folders,
            [folderId]: {
              ...folder,
              color: nextColor,
            },
          },
          layouts,
        };
      });
      renderInventoryViewScreen(returnTo);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-folder-unpack]").forEach((button) => {
    button.addEventListener("click", () => {
      const folderId = button.dataset.folderUnpack;
      if (!folderId) return;
      setFolderState((folders, layouts) => {
        const nextFolders = { ...folders };
        delete nextFolders[folderId];
        const nextLayouts = { ...layouts };
        delete nextLayouts[folderId];
        return { folders: nextFolders, layouts: nextLayouts };
      });
      renderInventoryViewScreen(returnTo);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-folder-member-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const folderId = button.dataset.folderMemberRemove;
      const entryKey = button.dataset.entryKey;
      if (!folderId || !entryKey) return;
      setFolderState((folders, layouts) => {
        const folder = folders[folderId];
        if (!folder) {
          return { folders, layouts };
        }
        const nextFolders = { ...folders };
        const nextEntryKeys = folder.entryKeys.filter((candidate) => candidate !== entryKey);
        if (nextEntryKeys.length === 0) {
          delete nextFolders[folderId];
          const nextLayouts = { ...layouts };
          delete nextLayouts[folderId];
          return { folders: nextFolders, layouts: nextLayouts };
        }
        nextFolders[folderId] = {
          ...folder,
          entryKeys: nextEntryKeys,
        };
        return { folders: nextFolders, layouts };
      });
      renderInventoryViewScreen(returnTo);
    });
  });

  attachWorkspaceDragging(root, returnTo);
}

export function renderInventoryViewScreen(returnTo: BaseCampReturnTo = "basecamp"): void {
  const root = document.getElementById("app");
  if (!root) return;
  clearControllerContext();

  const state = getGameState();
  const vm = buildInventoryVM(state);
  const folders = readInventoryFolders(state);
  const { nodes } = buildWorkspaceNodes(vm.entries, folders);
  const backButtonText = returnTo === "field" ? "FIELD MODE" : "BASE CAMP";
  const savedLayouts = readSavedLayouts();
  const workspaceLayouts = buildWorkspaceLayouts(nodes, savedLayouts);
  const workspaceRows = Math.max(
    WORKSPACE_MIN_ROWS,
    ...Array.from(workspaceLayouts.values()).map((layout) => layout.gridY + layout.rowSpan + 1),
  );

  root.innerHTML = `
    <div class="inventory-view-root inventory-workspace-root town-screen">
      <div class="inventory-view-header town-screen__header">
        <div class="inventory-view-header-left town-screen__titleblock">
          <h1 class="inventory-view-title">INVENTORY WORKSPACE</h1>
          <div class="inventory-view-subtitle">S/COM_OS // ASSETS_REGISTRY // OPEN_TRAY</div>
        </div>
        <div class="inventory-view-header-right town-screen__header-right">
          <div class="inventory-view-wad">
            <span class="wad-label">WAD</span>
            <span class="wad-value">${vm.wad.toLocaleString()}</span>
          </div>
          <button class="inventory-view-back-btn town-screen__back-btn" id="backBtn" data-return-to="${returnTo}">
            <span class="btn-icon">&larr;</span>
            <span class="btn-text">${backButtonText}</span>
          </button>
        </div>
      </div>

      <div class="inventory-workspace-body town-screen__content-panel">
        <aside class="inventory-workspace-sidebar">
          <section class="inventory-workspace-panel">
            <div class="inventory-workspace-panel-title">CATEGORIES</div>
            <div class="inventory-workspace-filters">
              <button class="inventory-workspace-filter-btn ${selectedCategory === "all" ? "inventory-workspace-filter-btn--active" : ""}" data-category="all">
                <span>ALL</span><span>${vm.entries.length}</span>
              </button>
              <button class="inventory-workspace-filter-btn ${selectedCategory === "equipment" ? "inventory-workspace-filter-btn--active" : ""}" data-category="equipment">
                <span>EQUIPMENT</span><span>${vm.countsByCategory.equipment}</span>
              </button>
              <button class="inventory-workspace-filter-btn ${selectedCategory === "consumable" ? "inventory-workspace-filter-btn--active" : ""}" data-category="consumable">
                <span>CONSUMABLES</span><span>${vm.countsByCategory.consumable}</span>
              </button>
              <button class="inventory-workspace-filter-btn ${selectedCategory === "keyItem" ? "inventory-workspace-filter-btn--active" : ""}" data-category="keyItem">
                <span>KEY ITEMS</span><span>${vm.countsByCategory.keyItem}</span>
              </button>
              <button class="inventory-workspace-filter-btn ${selectedCategory === "weaponPart" ? "inventory-workspace-filter-btn--active" : ""}" data-category="weaponPart">
                <span>WEAPON PARTS</span><span>${vm.countsByCategory.weaponPart}</span>
              </button>
              <button class="inventory-workspace-filter-btn ${selectedCategory === "recipe" ? "inventory-workspace-filter-btn--active" : ""}" data-category="recipe">
                <span>RECIPES</span><span>${vm.countsByCategory.recipe}</span>
              </button>
              <button class="inventory-workspace-filter-btn ${selectedCategory === "resource" ? "inventory-workspace-filter-btn--active" : ""}" data-category="resource">
                <span>RESOURCES</span><span>${vm.countsByCategory.resource}</span>
              </button>
            </div>
          </section>

          <section class="inventory-workspace-panel">
            <div class="inventory-workspace-panel-title">SEARCH</div>
            <div class="inventory-workspace-search">
              <input
                type="text"
                class="inventory-workspace-search-input"
                id="searchInput"
                placeholder="Search nodes..."
                value="${searchQuery}"
              />
              ${searchQuery ? `<button class="inventory-workspace-search-clear" id="clearSearchBtn" type="button">CLEAR</button>` : ""}
            </div>
          </section>

          <section class="inventory-workspace-panel inventory-workspace-panel--guide">
            <div class="inventory-workspace-panel-title">WORKSPACE</div>
            <p class="inventory-workspace-guide">Each owned asset can be moved and organized into folders that can be easily brought on operations.</p>
          </section>
        </aside>

        <section class="inventory-workspace-main">
          <div class="inventory-workspace-main-header">
            <div>
              <div class="inventory-workspace-main-title">ASSET NODE TRAY</div>
              <div class="inventory-workspace-main-subtitle">Drag nodes together to create reusable folders for operation prep.</div>
            </div>
            <div class="inventory-workspace-main-count">${nodes.length} NODES</div>
          </div>

          <div class="inventory-workspace-board">
            <div class="inventory-workspace-grid" id="inventoryWorkspaceGrid" style="--inventory-workspace-rows:${workspaceRows};">
              ${
                nodes.length === 0
                  ? `<div class="inventory-workspace-empty">No matching inventory nodes.</div>`
                  : nodes.map((node) => {
                    const layout = workspaceLayouts.get(node.key) ?? normalizeLayout(node, undefined);
                    return node.kind === "folder"
                      ? renderFolderNode(node.folderState, layout)
                      : renderInventoryEntryNode(node.entry, layout);
                  }).join("")
              }
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  attachInventoryViewListeners(returnTo);

  const normalizedVisibleLayouts = Object.fromEntries(
    Array.from(workspaceLayouts.entries()).map(([nodeKey, layout]) => [nodeKey, serializeLayout(layout)]),
  );
  const validKeys = new Set([
    ...vm.entries.map((entry) => entry.key),
    ...Object.keys(folders),
  ]);
  const nextLayouts: Record<string, BaseCampItemSize> = {};

  Object.entries({
    ...savedLayouts,
    ...normalizedVisibleLayouts,
  }).forEach(([key, layout]) => {
    if (validKeys.has(key)) {
      nextLayouts[key] = layout;
    }
  });

  const savedKeys = Object.keys(savedLayouts);
  const nextKeys = Object.keys(nextLayouts);
  const changed =
    savedKeys.length !== nextKeys.length ||
    nextKeys.some((key) => {
      const previous = savedLayouts[key];
      const next = nextLayouts[key];
      return !previous ||
        previous.colSpan !== next.colSpan ||
        previous.rowSpan !== next.rowSpan ||
        previous.gridX !== next.gridX ||
        previous.gridY !== next.gridY;
    });

  if (changed) {
    setFolderState((folderState) => ({
      folders: folderState,
      layouts: nextLayouts,
    }));
  }
}

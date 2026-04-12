// ============================================================================
// ALL NODES MENU SCREEN - Standalone menu for quick node access
// An independent screen (not an overlay) containing all base camp nodes
// ============================================================================

import "../../field/field.css";
import type { BaseCampItemSize, BaseCampLayoutLoadout, BaseCampPinnedItemFrame, MountId, UnitId } from "../../core/types";
import { getDispatchState } from "../../core/dispatchSystem";
import { getStatBank, STAT_SHORT_LABEL } from "../../core/statTokens";
import { getGameState, resetToNewGame, setGameState, subscribe, updateGameState } from "../../state/gameStore";
import { getActiveQuests, initializeQuestState } from "../../quests/questManager";
import { getCurrentFieldRuntimeMap, getCurrentFieldRuntimeState, renderFieldScreen, setNextFieldSpawnOverrideTile } from "../../field/FieldScreen";
import { buildFieldMinimapModel, drawFieldMinimapCanvas, MINIMAP_LAYOUT_ID } from "../../field/fieldMinimap";
import { getBaseCampFieldReturnMap, setBaseCampFieldReturnMap } from "./baseCampReturn";
import {
  BLACK_MARKET_UNLOCK_FLOOR_ORDINAL,
  FOUNDRY_ANNEX_UNLOCK_FLOOR_ORDINAL,
  HAVEN_BUILD_MODE_UNLOCK_FLOOR_ORDINAL,
  OPERATION_DEFINITIONS,
  PORT_UNLOCK_FLOOR_ORDINAL,
  SCHEMA_UNLOCK_FLOOR_ORDINAL,
  STABLE_UNLOCK_FLOOR_ORDINAL,
  isBlackMarketNodeUnlocked,
  isFoundryAnnexUnlocked,
  isHavenBuildModeUnlocked,
  isPortNodeUnlocked,
  isSchemaNodeUnlocked,
  isStableNodeUnlocked,
  loadCampaignProgress,
  saveCampaignProgress,
} from "../../core/campaign";
import type { OperationId } from "../../core/campaign";
import {
  getCurrentOpsTerminalAtlasFloor,
  getOpsTerminalAtlasWarmEconomySummaries,
  holdPositionInOpsTerminalAtlas,
  setCurrentOpsTerminalAtlasFloorOrdinal,
} from "../../core/opsTerminalAtlas";
import { BASIC_RESOURCE_KEYS, RESOURCE_SHORT_LABELS, createEmptyResourceWallet, getResourceEntries, type ResourceWallet } from "../../core/resources";
import { getLocalSessionPlayerSlot, getSessionResourcePool } from "../../core/session";
import { showAlertDialog } from "../components/confirmDialog";
import {
  canCraftMaterialRefineryRecipe,
  countAdvancedMaterialOwned,
  craftMaterialRefineryRecipe,
  getMaterialRefineryEffectiveOutputQuantity,
  getMaterialRefineryRecipes,
  getMaterialRefineryShortage,
  type AdvancedMaterialId,
  type MaterialRefineryContext,
} from "../../core/materialRefinery";
import { attachNotesWidgetHandlers, NOTES_LAYOUT_ID, renderNotesWidget } from "../components/notesWidget";
import { renderQuestTrackerWidget } from "../components/questTrackerWidget";
import { setMusicCue } from "../../core/audioSystem";
import {
  clearControllerContext,
  type ControllerMode,
  registerControllerContext,
  setControllerMode,
  updateFocusableElements,
} from "../../core/controllerSupport";
import { showSystemPing } from "../components/systemPing";
import {
  OUTER_DECK_HAVEN_EXIT_SPAWN_TILE,
  abortOuterDeckExpedition,
  getOuterDeckFieldContext,
} from "../../core/outerDecks";
import {
  getEscActionAvailability,
  getEscExpeditionRestrictionMessage,
  isEscActionEnabled,
  type EscNodeAction,
} from "../../core/escAvailability";

let lastFieldMap: string = "base_camp";
let quacLastFeedback = 'Type a node name, then press ENTER. Example: "unit roster" or "inventory".';
let suppressNodeClickUntil = 0;
let allNodesEscHandler: ((e: KeyboardEvent) => void) | null = null;
let allNodesResizeHandler: (() => void) | null = null;
let pinnedFrameSyncHandle: number | null = null;
let cleanupAllNodesControllerContext: (() => void) | null = null;
let cleanupTheaterAutoTickStateSubscription: (() => void) | null = null;
let escControllerPreferredMode: ControllerMode = "focus";
let escControllerActiveItemId = "resource-tracker";
let theaterAutoTickIntervalId: number | null = null;

type NodeDefinition = {
  action: string;
  icon: string;
  label: string;
  desc: string;
  variant?: string;
};

type WorkspaceItemLayout = {
  colSpan: number;
  rowSpan: number;
  gridX: number;
  gridY: number;
};

type GridMetrics = {
  columnCount: number;
  trackWidth: number;
  columnGap: number;
  rowGap: number;
  rowHeight: number;
};

type WorkspaceLayoutPreset = {
  name: string;
  layouts: Record<string, WorkspaceItemLayout>;
  minimizedItems?: string[];
  itemColors?: Record<string, string>;
};

type BaseCampColorTheme = {
  key: string;
  label: string;
  vars: Record<string, string>;
};

const QUAC_LAYOUT_ID = "quac-terminal";
const RESOURCE_LAYOUT_ID = "resource-tracker";
const QUEST_TRACKER_LAYOUT_ID = "quest-tracker";
const DRAG_THRESHOLD_PX = 8;
const WORKSPACE_ROW_HEIGHT_PX = 24;
const MIN_ITEM_ROW_SPAN = 4;
const AUTO_SCROLL_MARGIN_PX = 72;
const AUTO_SCROLL_STEP_PX = 24;
const BASE_CAMP_LAYOUT_VERSION = 12;
const BASE_CAMP_LOADOUT_COUNT = 2;
const DEFAULT_LOADOUT_PRESET_INDEXES = [0, 2] as const;
const DEFAULT_NODE_ROW_SPAN = 5;
const DEFAULT_RESOURCE_COL_SPAN = 3;
const DEFAULT_RESOURCE_ROW_SPAN = 9;
const DEFAULT_QUAC_COL_SPAN = 5;
const DEFAULT_QUAC_ROW_SPAN = 10;
const DEFAULT_MINIMAP_COL_SPAN = 5;
const DEFAULT_MINIMAP_ROW_SPAN = 8;
const MATERIALS_REFINERY_MIN_COL_SPAN = 3;
const MATERIALS_REFINERY_MIN_ROW_SPAN = 10;
const MATERIALS_REFINERY_LAYOUT_ID = "materials-refinery";
const THEATER_AUTO_TICK_LAYOUT_ID = "theater-auto-tick";
const THEATER_AUTO_TICK_INTERVAL_MS = 10_000;
const THEATER_AUTO_TICK_PING_CHANNEL = "esc-theater-auto-tick";
const MATERIALS_REFINERY_RESOURCE_SHORT_LABELS: Record<string, string> = {
  metalScrap: "M",
  wood: "T",
  chaosShards: "C",
  steamComponents: "S",
};

const DEFAULT_NODE_LAYOUT: NodeDefinition[] = [
  { action: "ops-terminal", icon: "OPS", label: "OPS TERMINAL", desc: "Deploy on operations", variant: "all-nodes-node-btn--primary" },
  { action: "roster", icon: "RST", label: "UNIT ROSTER", desc: "Manage your units" },
  { action: "loadout", icon: "LDT", label: "LOADOUT", desc: "Equipment & inventory" },
  { action: "inventory", icon: "INV", label: "INVENTORY", desc: "View all owned items" },
  { action: "gear-workbench", icon: "WKS", label: "WORKSHOP", desc: "Craft, upgrade & tinker" },
  { action: "materials-refinery", icon: "CRF", label: "LIGHT CRAFTING", desc: "Refine advanced field materials" },
  { action: "shop", icon: "SHP", label: "SHOP", desc: "Buy items & PAKs" },
  { action: "tavern", icon: "TAV", label: "TAVERN", desc: "Recruit new units" },
  { action: "quest-board", icon: "QST", label: "QUEST BOARD", desc: "View active quests" },
  { action: "port", icon: "PRT", label: "PORT", desc: "Trade resources" },
  { action: "quarters", icon: "QTR", label: "QUARTERS", desc: "Rest & heal units" },
  { action: "stable", icon: "STB", label: "STABLE", desc: "Manage mounts", variant: "all-nodes-node-btn--stable" },
  { action: "black-market", icon: "BLK", label: "BLACK MARKET", desc: "Acquire illicit field mods" },
  { action: "schema", icon: "SCH", label: "S.C.H.E.M.A.", desc: "Authorize future C.O.R.E. build types", variant: "all-nodes-node-btn--utility" },
  { action: "foundry-annex", icon: "FND", label: "FOUNDRY + ANNEX", desc: "Unlock module logic and partition authorizations", variant: "all-nodes-node-btn--utility" },
  { action: THEATER_AUTO_TICK_LAYOUT_ID, icon: "TCK", label: "THEATER CLOCK", desc: "Advance active theaters in the background", variant: "all-nodes-node-btn--utility" },
  { action: "codex", icon: "CDX", label: "CODEX", desc: "Archives & bestiary", variant: "all-nodes-node-btn--utility" },
  { action: "settings", icon: "CFG", label: "SETTINGS", desc: "Game options", variant: "all-nodes-node-btn--utility" },
  { action: "comms-array", icon: "COM", label: "COMMS ARRAY", desc: "Training & multiplayer", variant: "all-nodes-node-btn--utility" },
];

const DEFAULT_LAYOUT_ORDER = [RESOURCE_LAYOUT_ID, ...DEFAULT_NODE_LAYOUT.map((node) => node.action), QUAC_LAYOUT_ID, MINIMAP_LAYOUT_ID, NOTES_LAYOUT_ID, QUEST_TRACKER_LAYOUT_ID];
const ESC_DEBUG_PORT_STABLE_ACTIONS = new Set(["port", "stable"]);
const SCHEMA_LOCK_MESSAGE = `S.C.H.E.M.A. comes online after Floor ${String(SCHEMA_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`;
const PORT_LOCK_MESSAGE = `PORT unlocks after Floor ${String(PORT_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`;
const STABLE_LOCK_MESSAGE = `STABLE unlocks after Floor ${String(STABLE_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`;
const BLACK_MARKET_LOCK_MESSAGE = `BLACK MARKET unlocks after Floor ${String(BLACK_MARKET_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`;
const FOUNDRY_ANNEX_LOCK_MESSAGE = `FOUNDRY + ANNEX comes online after Floor ${String(FOUNDRY_ANNEX_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} is reached through live progression or atlas floor transit.`;

const DEFAULT_ITEM_LAYOUTS: Record<string, WorkspaceItemLayout> = {
  [RESOURCE_LAYOUT_ID]: { gridX: 1, gridY: 1, colSpan: DEFAULT_RESOURCE_COL_SPAN, rowSpan: DEFAULT_RESOURCE_ROW_SPAN },
  "ops-terminal": { gridX: 4, gridY: 1, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  roster: { gridX: 5, gridY: 1, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  loadout: { gridX: 6, gridY: 1, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  inventory: { gridX: 7, gridY: 1, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  "gear-workbench": { gridX: 4, gridY: 6, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  "materials-refinery": { gridX: 4, gridY: 16, colSpan: 4, rowSpan: 11 },
  shop: { gridX: 5, gridY: 6, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  tavern: { gridX: 6, gridY: 6, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  "quest-board": { gridX: 7, gridY: 6, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  port: { gridX: 1, gridY: 10, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  quarters: { gridX: 2, gridY: 10, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  stable: { gridX: 3, gridY: 10, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  "black-market": { gridX: 2, gridY: 15, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  schema: { gridX: 1, gridY: 15, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  "foundry-annex": { gridX: 3, gridY: 15, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  [THEATER_AUTO_TICK_LAYOUT_ID]: { gridX: 7, gridY: 11, colSpan: 1, rowSpan: 6 },
  codex: { gridX: 4, gridY: 11, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  settings: { gridX: 5, gridY: 11, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  "comms-array": { gridX: 6, gridY: 11, colSpan: 1, rowSpan: DEFAULT_NODE_ROW_SPAN },
  [QUAC_LAYOUT_ID]: { gridX: 8, gridY: 1, colSpan: DEFAULT_QUAC_COL_SPAN, rowSpan: DEFAULT_QUAC_ROW_SPAN },
  [MINIMAP_LAYOUT_ID]: { gridX: 8, gridY: 11, colSpan: DEFAULT_MINIMAP_COL_SPAN, rowSpan: DEFAULT_MINIMAP_ROW_SPAN },
  [NOTES_LAYOUT_ID]: { gridX: 8, gridY: 19, colSpan: 5, rowSpan: 9 },
  [QUEST_TRACKER_LAYOUT_ID]: { gridX: 8, gridY: 28, colSpan: 5, rowSpan: 9 },
};

function cloneLayoutMap(layouts: Record<string, WorkspaceItemLayout>): Record<string, WorkspaceItemLayout> {
  return Object.fromEntries(
    Object.entries(layouts).map(([itemId, layout]) => [itemId, { ...layout }]),
  ) as Record<string, WorkspaceItemLayout>;
}

function createLayoutPreset(
  name: string,
  overrides: Partial<Record<string, WorkspaceItemLayout>>,
  options?: {
    minimizedItems?: string[];
    itemColors?: Record<string, string>;
  },
): WorkspaceLayoutPreset {
  const layouts = cloneLayoutMap(DEFAULT_ITEM_LAYOUTS);
  Object.entries(overrides).forEach(([itemId, layout]) => {
    if (!layout) return;
    layouts[itemId] = { ...(layouts[itemId] ?? DEFAULT_ITEM_LAYOUTS[itemId] ?? { gridX: 1, gridY: 1, colSpan: 1, rowSpan: MIN_ITEM_ROW_SPAN }), ...layout };
  });

  return {
    name,
    layouts,
    minimizedItems: [...(options?.minimizedItems ?? [])],
    itemColors: { ...(options?.itemColors ?? {}) },
  };
}

const BASE_CAMP_LAYOUT_PRESETS: WorkspaceLayoutPreset[] = [
  createLayoutPreset("COMMAND", {
    [RESOURCE_LAYOUT_ID]: { gridX: 1, gridY: 1, colSpan: 3, rowSpan: 6 },
    inventory: { gridX: 4, gridY: 1, colSpan: 2, rowSpan: 7 },
    [QUEST_TRACKER_LAYOUT_ID]: { gridX: 6, gridY: 1, colSpan: 2, rowSpan: 13 },
    "ops-terminal": { gridX: 8, gridY: 1, colSpan: 2, rowSpan: 6 },
    roster: { gridX: 8, gridY: 7, colSpan: 2, rowSpan: 6 },
    [MINIMAP_LAYOUT_ID]: { gridX: 10, gridY: 1, colSpan: 3, rowSpan: 11 },
    quarters: { gridX: 2, gridY: 8, colSpan: 1, rowSpan: 4 },
    tavern: { gridX: 3, gridY: 8, colSpan: 1, rowSpan: 4 },
    shop: { gridX: 4, gridY: 8, colSpan: 1, rowSpan: 4 },
    "quest-board": { gridX: 2, gridY: 12, colSpan: 1, rowSpan: 4 },
    "gear-workbench": { gridX: 3, gridY: 12, colSpan: 1, rowSpan: 4 },
    loadout: { gridX: 4, gridY: 12, colSpan: 1, rowSpan: 4 },
    "comms-array": { gridX: 8, gridY: 13, colSpan: 1, rowSpan: 3 },
    codex: { gridX: 9, gridY: 13, colSpan: 1, rowSpan: 3 },
    settings: { gridX: 10, gridY: 13, colSpan: 1, rowSpan: 3 },
    [THEATER_AUTO_TICK_LAYOUT_ID]: { gridX: 11, gridY: 15, colSpan: 2, rowSpan: 4 },
  }, {
    minimizedItems: [NOTES_LAYOUT_ID, QUAC_LAYOUT_ID, MATERIALS_REFINERY_LAYOUT_ID, "port", "stable", "black-market", "schema", "foundry-annex"],
    itemColors: {
      [RESOURCE_LAYOUT_ID]: "violet",
      inventory: "steel",
      [QUEST_TRACKER_LAYOUT_ID]: "steel",
      "ops-terminal": "oxide",
      roster: "oxide",
      [QUAC_LAYOUT_ID]: "verdant",
      [MINIMAP_LAYOUT_ID]: "steel",
      [NOTES_LAYOUT_ID]: "steel",
      "comms-array": "teal",
      "black-market": "oxide",
      "foundry-annex": "steel",
      codex: "steel",
      settings: "steel",
    },
  }),
  createLayoutPreset("BROADCAST", {
    [RESOURCE_LAYOUT_ID]: { gridX: 1, gridY: 1, colSpan: 4, rowSpan: 7 },
    [QUAC_LAYOUT_ID]: { gridX: 5, gridY: 1, colSpan: 8, rowSpan: 8 },
    "ops-terminal": { gridX: 1, gridY: 8, colSpan: 2, rowSpan: 5 },
    roster: { gridX: 3, gridY: 8, colSpan: 2, rowSpan: 5 },
    loadout: { gridX: 1, gridY: 13, colSpan: 2, rowSpan: 5 },
    inventory: { gridX: 3, gridY: 13, colSpan: 2, rowSpan: 5 },
    "gear-workbench": { gridX: 5, gridY: 9, colSpan: 3, rowSpan: 5 },
    shop: { gridX: 8, gridY: 9, colSpan: 2, rowSpan: 5 },
    tavern: { gridX: 10, gridY: 9, colSpan: 3, rowSpan: 5 },
    "quest-board": { gridX: 5, gridY: 14, colSpan: 2, rowSpan: 5 },
    port: { gridX: 7, gridY: 14, colSpan: 2, rowSpan: 5 },
    quarters: { gridX: 9, gridY: 14, colSpan: 2, rowSpan: 5 },
    stable: { gridX: 11, gridY: 14, colSpan: 2, rowSpan: 5 },
    schema: { gridX: 7, gridY: 19, colSpan: 2, rowSpan: 4 },
    codex: { gridX: 1, gridY: 18, colSpan: 2, rowSpan: 4 },
    settings: { gridX: 3, gridY: 18, colSpan: 2, rowSpan: 4 },
    "comms-array": { gridX: 5, gridY: 19, colSpan: 3, rowSpan: 4 },
    [THEATER_AUTO_TICK_LAYOUT_ID]: { gridX: 1, gridY: 22, colSpan: 3, rowSpan: 4 },
    [NOTES_LAYOUT_ID]: { gridX: 9, gridY: 14, colSpan: 4, rowSpan: 9 },
    [QUEST_TRACKER_LAYOUT_ID]: { gridX: 9, gridY: 23, colSpan: 4, rowSpan: 7 },
  }),
  createLayoutPreset("TACTICAL", {
    [NOTES_LAYOUT_ID]: { gridX: 7, gridY: 1, colSpan: 2, rowSpan: 11 },
    [QUEST_TRACKER_LAYOUT_ID]: { gridX: 9, gridY: 1, colSpan: 2, rowSpan: 11 },
    [RESOURCE_LAYOUT_ID]: { gridX: 11, gridY: 1, colSpan: 2, rowSpan: 6 },
    inventory: { gridX: 11, gridY: 7, colSpan: 2, rowSpan: 4 },
    [MINIMAP_LAYOUT_ID]: { gridX: 7, gridY: 12, colSpan: 4, rowSpan: 8 },
    loadout: { gridX: 11, gridY: 11, colSpan: 1, rowSpan: 5 },
    codex: { gridX: 12, gridY: 11, colSpan: 1, rowSpan: 4 },
    settings: { gridX: 12, gridY: 15, colSpan: 1, rowSpan: 4 },
    [THEATER_AUTO_TICK_LAYOUT_ID]: { gridX: 11, gridY: 19, colSpan: 2, rowSpan: 4 },
  }, {
    minimizedItems: [
      MATERIALS_REFINERY_LAYOUT_ID,
      "ops-terminal",
      "roster",
      "gear-workbench",
      "shop",
      "tavern",
      "quest-board",
      "quarters",
      "port",
      "stable",
      "black-market",
      "schema",
      "foundry-annex",
      "comms-array",
      QUAC_LAYOUT_ID,
    ],
    itemColors: {
      [NOTES_LAYOUT_ID]: "steel",
      [QUEST_TRACKER_LAYOUT_ID]: "steel",
      [RESOURCE_LAYOUT_ID]: "violet",
      [MINIMAP_LAYOUT_ID]: "steel",
      inventory: "verdant",
      loadout: "amber",
      "black-market": "oxide",
      "foundry-annex": "steel",
      codex: "steel",
      settings: "steel",
    },
  }),
  createLayoutPreset("CATALOG", {
    [RESOURCE_LAYOUT_ID]: { gridX: 1, gridY: 1, colSpan: 3, rowSpan: 8 },
    "ops-terminal": { gridX: 4, gridY: 1, colSpan: 2, rowSpan: 5 },
    roster: { gridX: 6, gridY: 1, colSpan: 2, rowSpan: 5 },
    loadout: { gridX: 8, gridY: 1, colSpan: 2, rowSpan: 5 },
    inventory: { gridX: 10, gridY: 1, colSpan: 2, rowSpan: 5 },
    "gear-workbench": { gridX: 4, gridY: 6, colSpan: 2, rowSpan: 5 },
    shop: { gridX: 6, gridY: 6, colSpan: 2, rowSpan: 5 },
    tavern: { gridX: 8, gridY: 6, colSpan: 2, rowSpan: 5 },
    "quest-board": { gridX: 10, gridY: 6, colSpan: 2, rowSpan: 5 },
    port: { gridX: 1, gridY: 9, colSpan: 2, rowSpan: 5 },
    quarters: { gridX: 3, gridY: 9, colSpan: 2, rowSpan: 5 },
    stable: { gridX: 5, gridY: 9, colSpan: 2, rowSpan: 5 },
    schema: { gridX: 1, gridY: 22, colSpan: 2, rowSpan: 4 },
    codex: { gridX: 7, gridY: 9, colSpan: 2, rowSpan: 5 },
    settings: { gridX: 9, gridY: 9, colSpan: 2, rowSpan: 5 },
    "comms-array": { gridX: 11, gridY: 9, colSpan: 2, rowSpan: 5 },
    [QUAC_LAYOUT_ID]: { gridX: 1, gridY: 14, colSpan: 12, rowSpan: 8 },
    [NOTES_LAYOUT_ID]: { gridX: 9, gridY: 22, colSpan: 4, rowSpan: 6 },
    [QUEST_TRACKER_LAYOUT_ID]: { gridX: 1, gridY: 22, colSpan: 8, rowSpan: 6 },
  }),
];

const BASE_CAMP_COLOR_THEMES: BaseCampColorTheme[] = [
  {
    key: "amber",
    label: "Amber",
    vars: {
      "--all-nodes-panel-bg": "#4d3f34",
      "--all-nodes-panel-hover-bg": "#6b5d4f",
      "--all-nodes-border": "#7a5a32",
      "--all-nodes-border-hover": "#a87c45",
      "--all-nodes-surface-bg": "#2d2c2a",
      "--all-nodes-surface-border": "rgba(168, 124, 69, 0.28)",
      "--all-nodes-accent": "#ffcc6e",
      "--all-nodes-accent-soft": "rgba(255, 204, 110, 0.14)",
      "--all-nodes-text": "#e8e4dc",
      "--all-nodes-muted": "#8d7a67",
      "--all-nodes-glow": "rgba(168, 124, 69, 0.28)",
      "--all-nodes-focus": "#ffcc6e",
    },
  },
  {
    key: "violet",
    label: "Violet",
    vars: {
      "--all-nodes-panel-bg": "#463a4f",
      "--all-nodes-panel-hover-bg": "#5e4d69",
      "--all-nodes-border": "#8967ff",
      "--all-nodes-border-hover": "#c0b3ff",
      "--all-nodes-surface-bg": "#26222d",
      "--all-nodes-surface-border": "rgba(192, 179, 255, 0.32)",
      "--all-nodes-accent": "#cdbfff",
      "--all-nodes-accent-soft": "rgba(192, 179, 255, 0.16)",
      "--all-nodes-text": "#eee8f7",
      "--all-nodes-muted": "#9a8eb2",
      "--all-nodes-glow": "rgba(192, 179, 255, 0.26)",
      "--all-nodes-focus": "#d8cfff",
    },
  },
  {
    key: "verdant",
    label: "Verdant",
    vars: {
      "--all-nodes-panel-bg": "#34463d",
      "--all-nodes-panel-hover-bg": "#466050",
      "--all-nodes-border": "#5f9b7a",
      "--all-nodes-border-hover": "#84c59b",
      "--all-nodes-surface-bg": "#1f2c26",
      "--all-nodes-surface-border": "rgba(132, 197, 155, 0.3)",
      "--all-nodes-accent": "#a8e0b4",
      "--all-nodes-accent-soft": "rgba(132, 197, 155, 0.16)",
      "--all-nodes-text": "#edf4ef",
      "--all-nodes-muted": "#8a9d91",
      "--all-nodes-glow": "rgba(132, 197, 155, 0.24)",
      "--all-nodes-focus": "#b7efc3",
    },
  },
  {
    key: "teal",
    label: "Teal",
    vars: {
      "--all-nodes-panel-bg": "#2f4650",
      "--all-nodes-panel-hover-bg": "#3f6170",
      "--all-nodes-border": "#4f8b93",
      "--all-nodes-border-hover": "#73b5bf",
      "--all-nodes-surface-bg": "#1d2b30",
      "--all-nodes-surface-border": "rgba(115, 181, 191, 0.28)",
      "--all-nodes-accent": "#9ed8de",
      "--all-nodes-accent-soft": "rgba(115, 181, 191, 0.16)",
      "--all-nodes-text": "#e5f0f2",
      "--all-nodes-muted": "#86999d",
      "--all-nodes-glow": "rgba(115, 181, 191, 0.24)",
      "--all-nodes-focus": "#b2e4e8",
    },
  },
  {
    key: "oxide",
    label: "Oxide",
    vars: {
      "--all-nodes-panel-bg": "#4e362f",
      "--all-nodes-panel-hover-bg": "#67463d",
      "--all-nodes-border": "#b0684c",
      "--all-nodes-border-hover": "#d68d6b",
      "--all-nodes-surface-bg": "#2b201d",
      "--all-nodes-surface-border": "rgba(214, 141, 107, 0.28)",
      "--all-nodes-accent": "#ffc0a4",
      "--all-nodes-accent-soft": "rgba(214, 141, 107, 0.18)",
      "--all-nodes-text": "#f0e5e0",
      "--all-nodes-muted": "#a28a7e",
      "--all-nodes-glow": "rgba(214, 141, 107, 0.24)",
      "--all-nodes-focus": "#ffd0b8",
    },
  },
  {
    key: "moss",
    label: "Moss",
    vars: {
      "--all-nodes-panel-bg": "#404733",
      "--all-nodes-panel-hover-bg": "#575f45",
      "--all-nodes-border": "#7f9161",
      "--all-nodes-border-hover": "#a6ba85",
      "--all-nodes-surface-bg": "#252a20",
      "--all-nodes-surface-border": "rgba(166, 186, 133, 0.28)",
      "--all-nodes-accent": "#d2e3ad",
      "--all-nodes-accent-soft": "rgba(166, 186, 133, 0.17)",
      "--all-nodes-text": "#eef0e5",
      "--all-nodes-muted": "#949880",
      "--all-nodes-glow": "rgba(166, 186, 133, 0.22)",
      "--all-nodes-focus": "#e1efbf",
    },
  },
  {
    key: "steel",
    label: "Steel",
    vars: {
      "--all-nodes-panel-bg": "#384047",
      "--all-nodes-panel-hover-bg": "#4a555e",
      "--all-nodes-border": "#70818d",
      "--all-nodes-border-hover": "#9aaab5",
      "--all-nodes-surface-bg": "#20262b",
      "--all-nodes-surface-border": "rgba(154, 170, 181, 0.28)",
      "--all-nodes-accent": "#d5e0e8",
      "--all-nodes-accent-soft": "rgba(154, 170, 181, 0.16)",
      "--all-nodes-text": "#edf1f4",
      "--all-nodes-muted": "#96a2ab",
      "--all-nodes-glow": "rgba(154, 170, 181, 0.22)",
      "--all-nodes-focus": "#e4edf3",
    },
  },
];

const BASE_CAMP_COLOR_THEME_KEYS = BASE_CAMP_COLOR_THEMES.map((theme) => theme.key);
const BASE_CAMP_COLOR_THEME_MAP = new Map(BASE_CAMP_COLOR_THEMES.map((theme) => [theme.key, theme]));
const ESC_NODE_ACTION_SET = new Set(DEFAULT_NODE_LAYOUT.map((node) => node.action));

function isEscNodeAction(action: string): action is EscNodeAction {
  return ESC_NODE_ACTION_SET.has(action);
}

function getEscAvailabilityContext() {
  return {
    expeditionActive: getOuterDeckFieldContext(lastFieldMap) === "outerDeckBranch",
  };
}

const QUAC_COMMAND_ALIASES: Array<{ action: string; aliases: string[] }> = [
  { action: "ops-terminal", aliases: ["ops", "ops terminal", "operation", "operations", "deploy", "mission", "missions"] },
  { action: "roster", aliases: ["roster", "unit roster", "units", "party", "manage units"] },
  { action: "loadout", aliases: ["loadout", "gear", "equipment", "equip", "locker"] },
  { action: "inventory", aliases: ["inventory", "items", "assets", "storage", "owned items"] },
  { action: "gear-workbench", aliases: ["workshop", "workbench", "gear workbench", "upgrade gear"] },
  { action: "materials-refinery", aliases: ["crafting", "materials", "refinery", "alloy", "drawcord", "fittings", "resin", "charge cells"] },
  { action: "shop", aliases: ["shop", "store", "quartermaster", "buy", "market"] },
  { action: "tavern", aliases: ["tavern", "recruit", "recruitment", "hire"] },
  { action: "quest-board", aliases: ["quest", "quests", "quest board", "board", "jobs"] },
  { action: "port", aliases: ["port", "trade", "trading", "manifest", "supply"] },
  { action: "quarters", aliases: ["quarters", "rest", "barracks", "heal"] },
  { action: "stable", aliases: ["stable", "mounts", "mount", "mounted units"] },
  { action: "black-market", aliases: ["black market", "black-market", "mods", "field mods", "contraband"] },
  { action: "schema", aliases: ["schema", "s c h e m a", "core housing", "core engineering", "core authorization", "core unlocks"] },
  { action: "foundry-annex", aliases: ["foundry", "annex", "foundry annex", "foundry + annex"] },
  { action: THEATER_AUTO_TICK_LAYOUT_ID, aliases: ["theater clock", "theater tick", "theater timer", "auto tick", "advance theaters", "background theater"] },
  { action: "codex", aliases: ["codex", "archive", "archives", "bestiary"] },
  { action: "settings", aliases: ["settings", "config", "configuration", "options"] },
  { action: "comms-array", aliases: ["comms", "comms array", "multiplayer", "training"] },
  { action: "debug-wad", aliases: ["debug wad", "money", "give wad", "add wad", "give everything", "unlock all"] },
  { action: "debug-atlas-floor-bypass", aliases: ["atlas floor bypass", "floor bypass", "debug atlas next floor", "atlas unlock next floor"] },
  { action: "debug-floor-12-status", aliases: ["floor 12", "floor 12 unlock", "floor 12 status", "unlock floor 12", "final completion unlock"] },
];

async function grantEverythingToPlayer(): Promise<void> {
  const [
    { getCodexDatabase },
    { ALL_CHASSIS },
    { ALL_DOCTRINES },
    { RECIPE_DATABASE },
    { getAllModules, getAllStarterEquipment },
    { getOrderedFoundryModuleTypes, getOrderedFoundryPartitionTypes },
    { createOwnedMount, getAllMounts },
    { getOrderedSchemaCoreTypes, getOrderedSchemaFieldAssetTypes, getOrderedSchemaFortificationTypes },
    { createDefaultClassProgress, getAvailableClasses },
  ] = await Promise.all([
    import("../../core/codexSystem"),
    import("../../data/gearChassis"),
    import("../../data/gearDoctrines"),
    import("../../core/crafting"),
    import("../../core/equipment"),
    import("../../core/foundrySystem"),
    import("../../core/mounts"),
    import("../../core/schemaSystem"),
    import("../../core/classes"),
  ]);

  const allEquipment = getAllStarterEquipment();
  const allEquipmentIds = Object.keys(allEquipment);
  const allModules = getAllModules();
  const allRecipeIds = Object.keys(RECIPE_DATABASE);
  const allChassisIds = ALL_CHASSIS.map((chassis) => chassis.id);
  const allDoctrineIds = ALL_DOCTRINES.map((doctrine) => doctrine.id);
  const allCodexEntryIds = getCodexDatabase().map((entry) => entry.id);
  const allMountIds = Object.keys(getAllMounts()) as MountId[];
  const availableClasses = getAvailableClasses();

  updateGameState((state) => {
    const nextUnitClassProgress = { ...(state.unitClassProgress ?? {}) };

    Object.keys(state.unitsById).forEach((unitId) => {
      const resolvedUnitId = unitId as UnitId;
      const currentProgress = nextUnitClassProgress[resolvedUnitId] ?? createDefaultClassProgress(resolvedUnitId);
      nextUnitClassProgress[resolvedUnitId] = {
        ...currentProgress,
        unlockedClasses: [...availableClasses],
        classRanks: { ...currentProgress.classRanks },
      };
    });

    const stable = state.stable;
    const existingOwnedMounts = stable?.ownedMounts ?? [];
    const ownedMountIds = new Set(existingOwnedMounts.map((mount) => mount.mountId));
    const mergedOwnedMounts = [
      ...existingOwnedMounts,
      ...allMountIds
        .filter((mountId) => !ownedMountIds.has(mountId))
        .map((mountId) => createOwnedMount(mountId)),
    ];

    return {
      ...state,
      wad: 999999,
      resources: createEmptyResourceWallet({
        metalScrap: 99999,
        wood: 99999,
        chaosShards: 99999,
        steamComponents: 99999,
        alloy: 99999,
        drawcord: 99999,
        fittings: 99999,
        resin: 99999,
        chargeCells: 99999,
      }),
      equipmentById: {
        ...allEquipment,
        ...(state.equipmentById ?? {}),
      },
      modulesById: {
        ...allModules,
        ...(state.modulesById ?? {}),
      },
      equipmentPool: Array.from(new Set([...(state.equipmentPool ?? []), ...allEquipmentIds])),
      knownRecipeIds: allRecipeIds,
      unlockedChassisIds: allChassisIds,
      unlockedDoctrineIds: allDoctrineIds,
      unlockedCodexEntries: allCodexEntryIds,
      schema: {
        unlockedCoreTypes: getOrderedSchemaCoreTypes(),
        unlockedFortificationPips: getOrderedSchemaFortificationTypes(),
        unlockedFieldAssetTypes: getOrderedSchemaFieldAssetTypes(),
      },
      foundry: {
        unlockedModuleTypes: getOrderedFoundryModuleTypes(),
        unlockedPartitionTypes: getOrderedFoundryPartitionTypes(),
      },
      stable: {
        ...(stable ?? {}),
        unlockedMountIds: allMountIds,
        ownedMounts: mergedOwnedMounts,
      },
      unitClassProgress: nextUnitClassProgress,
    };
  });

  const campaignProgress = loadCampaignProgress();
  saveCampaignProgress({
    ...campaignProgress,
    unlockedOperations: Object.keys(OPERATION_DEFINITIONS) as OperationId[],
    schemaNodeUnlocked: true,
    highestReachedFloorOrdinal: 99,
  });

  showSystemPing({
    type: "success",
    title: "DEBUG // GIVE EVERYTHING",
    message: "Inventory, unlocks, and campaign progression maxed.",
    detail: "All gear, recipes, codex entries, operations, node gates, and builder unlocks granted.",
    channel: "esc-dev-debug",
  });
}

function syncFloor12UnlockStatus(): void {
  const campaignProgress = loadCampaignProgress();
  const targetFloorOrdinal = Math.max(12, Number(campaignProgress.opsTerminalAtlas?.currentFloorOrdinal ?? 1));
  let nextProgress = campaignProgress;

  try {
    setCurrentOpsTerminalAtlasFloorOrdinal(targetFloorOrdinal, campaignProgress, true);
    nextProgress = loadCampaignProgress();
  } catch (error) {
    console.warn("[ESC] Failed to sync atlas floor during Floor 12 debug unlock:", error);
    nextProgress = campaignProgress;
  }

  saveCampaignProgress({
    ...nextProgress,
    highestReachedFloorOrdinal: Math.max(12, Number(nextProgress.highestReachedFloorOrdinal ?? 1)),
    schemaNodeUnlocked: true,
  });

  showSystemPing({
    type: "success",
    title: "DEBUG // FLOOR 12 STATUS",
    message: `Campaign progression synced to Floor ${String(Math.max(12, Number(nextProgress.highestReachedFloorOrdinal ?? targetFloorOrdinal))).padStart(2, "0")}.`,
    detail: "Floor-gated ESC nodes, atlas final reset access, and related milestone unlocks are now available.",
    channel: "esc-dev-debug",
  });
}

function normalizeQuacCommand(value: string): string {
  return value.toLowerCase().trim().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ");
}

function isLockedHavenAnnexAction(action: string): boolean {
  if (ESC_DEBUG_PORT_STABLE_ACTIONS.has(action) && Boolean(getGameState().uiLayout?.escDebugPortStableUnlock)) {
    return false;
  }
  if (action === "port") {
    return !isPortNodeUnlocked();
  }
  if (action === "stable") {
    return !isStableNodeUnlocked();
  }
  return false;
}

function isLockedSchemaAction(action: string): boolean {
  return action === "schema" && !isSchemaNodeUnlocked();
}

function isLockedBlackMarketAction(action: string): boolean {
  return action === "black-market" && !isBlackMarketNodeUnlocked();
}

function isLockedFoundryAnnexAction(action: string): boolean {
  return action === "foundry-annex" && !isFoundryAnnexUnlocked();
}

function getLockedActionMessage(action: string): string | null {
  switch (action) {
    case "schema":
      return SCHEMA_LOCK_MESSAGE;
    case "port":
      return PORT_LOCK_MESSAGE;
    case "stable":
      return STABLE_LOCK_MESSAGE;
    case "black-market":
      return BLACK_MARKET_LOCK_MESSAGE;
    case "foundry-annex":
      return FOUNDRY_ANNEX_LOCK_MESSAGE;
    default:
      return null;
  }
}

function getAvailableNodeLayout(): NodeDefinition[] {
  if (getEscAvailabilityContext().expeditionActive) {
    return [...DEFAULT_NODE_LAYOUT];
  }

  return DEFAULT_NODE_LAYOUT.filter((node) => {
    if (isLockedHavenAnnexAction(node.action)) {
      return false;
    }
    if (isLockedSchemaAction(node.action)) {
      return false;
    }
    if (isLockedBlackMarketAction(node.action)) {
      return false;
    }
    if (isLockedFoundryAnnexAction(node.action)) {
      return false;
    }
    return true;
  });
}

function getAvailableLayoutOrder(): string[] {
  return [RESOURCE_LAYOUT_ID, ...getAvailableNodeLayout().map((node) => node.action), QUAC_LAYOUT_ID, MINIMAP_LAYOUT_ID, NOTES_LAYOUT_ID, QUEST_TRACKER_LAYOUT_ID];
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
  const availableNodes = getAvailableNodeLayout();
  if (!savedOrder || savedOrder.length === 0) {
    return availableNodes;
  }

  const nodeMap = new Map(availableNodes.map((node) => [node.action, node]));
  const ordered = savedOrder.map((action) => nodeMap.get(action)).filter((node): node is NodeDefinition => Boolean(node));
  const missing = availableNodes.filter((node) => !savedOrder.includes(node.action));
  return [...ordered, ...missing];
}

function readLayoutOrder(): string[] {
  const state = getGameState();
  const savedOrder = state.uiLayout?.baseCampItemOrder;
  const availableLayoutOrder = getAvailableLayoutOrder();
  const validIds = new Set(availableLayoutOrder);

  if (!savedOrder || savedOrder.length === 0) {
    return availableLayoutOrder;
  }

  const ordered = savedOrder.filter((id) => validIds.has(id));
  const missing = availableLayoutOrder.filter((id) => !ordered.includes(id));
  return [...ordered, ...missing];
}

type ResolvedBaseCampLoadout = {
  minimizedItems: string[];
  itemSizes: Record<string, BaseCampItemSize>;
  pinnedItems: string[];
  itemColors: Record<string, string>;
  pinnedItemFrames: Record<string, BaseCampPinnedItemFrame>;
};

function getLoadoutStorageKey(index: number): string {
  return `${index}`;
}

function getDefaultLoadout(index: number): ResolvedBaseCampLoadout {
  const presetIndex = DEFAULT_LOADOUT_PRESET_INDEXES[clamp(index, 0, BASE_CAMP_LOADOUT_COUNT - 1)] ?? DEFAULT_LOADOUT_PRESET_INDEXES[0];
  const preset = BASE_CAMP_LAYOUT_PRESETS[presetIndex] ?? BASE_CAMP_LAYOUT_PRESETS[0];
  return {
    minimizedItems: [...(preset.minimizedItems ?? [])],
    itemSizes: serializeLayoutRecord(preset.layouts),
    pinnedItems: [],
    itemColors: { ...(preset.itemColors ?? {}) },
    pinnedItemFrames: {},
  };
}

function normalizeLoadoutState(loadout: BaseCampLayoutLoadout | undefined, index: number): ResolvedBaseCampLoadout {
  const fallback = getDefaultLoadout(index);
  const validIds = new Set(DEFAULT_LAYOUT_ORDER);
  const minimizedItems = Array.from(new Set((loadout?.minimizedItems ?? fallback.minimizedItems).filter((id) => validIds.has(id))));
  const pinnedItems = Array.from(new Set((loadout?.pinnedItems ?? fallback.pinnedItems).filter((id) => validIds.has(id))));
  const pinnedSet = new Set(pinnedItems);
  const pinnedItemFrames = Object.fromEntries(
    Object.entries(loadout?.pinnedItemFrames ?? fallback.pinnedItemFrames).filter(([itemId]) => pinnedSet.has(itemId)),
  ) as Record<string, BaseCampPinnedItemFrame>;

  return {
    minimizedItems,
    itemSizes: {
      ...fallback.itemSizes,
      ...(loadout?.itemSizes ?? {}),
    },
    pinnedItems,
    itemColors: {
      ...fallback.itemColors,
      ...(loadout?.itemColors ?? {}),
    },
    pinnedItemFrames,
  };
}

function readActiveLoadoutIndex(state = getGameState()): number {
  const legacyIndex = state.uiLayout?.baseCampResetPresetIndex ?? 0;
  const savedIndex = state.uiLayout?.baseCampActiveLoadoutIndex ?? legacyIndex;
  return clamp(savedIndex, 0, BASE_CAMP_LOADOUT_COUNT - 1);
}

function readStoredLoadouts(state = getGameState()): Record<string, ResolvedBaseCampLoadout> {
  const activeIndex = readActiveLoadoutIndex(state);
  const savedLoadouts = state.uiLayout?.baseCampLayoutLoadouts ?? {};
  const loadouts = Object.fromEntries(
    Array.from({ length: BASE_CAMP_LOADOUT_COUNT }, (_, index) => {
      const key = getLoadoutStorageKey(index);
      return [key, normalizeLoadoutState(savedLoadouts[key], index)];
    }),
  ) as Record<string, ResolvedBaseCampLoadout>;

  if (!state.uiLayout?.baseCampLayoutLoadouts) {
    const hasLegacyLayoutState = Boolean(
      (state.uiLayout?.baseCampMinimizedItems?.length ?? 0) > 0
      || (state.uiLayout?.baseCampPinnedItems?.length ?? 0) > 0
      || Object.keys(state.uiLayout?.baseCampItemSizes ?? {}).length > 0
      || Object.keys(state.uiLayout?.baseCampItemColors ?? {}).length > 0
      || Object.keys(state.uiLayout?.baseCampPinnedItemFrames ?? {}).length > 0,
    );

    if (hasLegacyLayoutState) {
      loadouts[getLoadoutStorageKey(activeIndex)] = normalizeLoadoutState({
        minimizedItems: state.uiLayout?.baseCampMinimizedItems,
        itemSizes: state.uiLayout?.baseCampItemSizes,
        pinnedItems: state.uiLayout?.baseCampPinnedItems,
        itemColors: state.uiLayout?.baseCampItemColors,
        pinnedItemFrames: state.uiLayout?.baseCampPinnedItemFrames,
      }, activeIndex);
    }
  }

  return loadouts;
}

function serializeStoredLoadouts(loadouts: Record<string, ResolvedBaseCampLoadout>): Record<string, BaseCampLayoutLoadout> {
  return Object.fromEntries(
    Object.entries(loadouts).map(([key, loadout]) => [
      key,
      {
        minimizedItems: [...loadout.minimizedItems],
        itemSizes: { ...loadout.itemSizes },
        pinnedItems: [...loadout.pinnedItems],
        itemColors: { ...loadout.itemColors },
        pinnedItemFrames: { ...loadout.pinnedItemFrames },
      },
    ]),
  ) as Record<string, BaseCampLayoutLoadout>;
}

function getLegacyDefaultLoadoutV11(index: number): ResolvedBaseCampLoadout | null {
  if (index === 0) {
    return {
      minimizedItems: [NOTES_LAYOUT_ID, QUEST_TRACKER_LAYOUT_ID, MATERIALS_REFINERY_LAYOUT_ID, "port", "stable", "black-market", "schema", "foundry-annex"],
      itemSizes: serializeLayoutRecord({
        ...DEFAULT_ITEM_LAYOUTS,
        [RESOURCE_LAYOUT_ID]: { gridX: 1, gridY: 1, colSpan: 3, rowSpan: 7 },
        inventory: { gridX: 4, gridY: 1, colSpan: 2, rowSpan: 8 },
        "ops-terminal": { gridX: 6, gridY: 1, colSpan: 2, rowSpan: 8 },
        roster: { gridX: 6, gridY: 8, colSpan: 2, rowSpan: 4 },
        [QUAC_LAYOUT_ID]: { gridX: 8, gridY: 1, colSpan: 5, rowSpan: 8 },
        [MINIMAP_LAYOUT_ID]: { gridX: 8, gridY: 9, colSpan: 5, rowSpan: 8 },
        quarters: { gridX: 2, gridY: 11, colSpan: 1, rowSpan: 4 },
        tavern: { gridX: 3, gridY: 11, colSpan: 1, rowSpan: 4 },
        shop: { gridX: 4, gridY: 11, colSpan: 1, rowSpan: 4 },
        "quest-board": { gridX: 2, gridY: 15, colSpan: 1, rowSpan: 4 },
        "gear-workbench": { gridX: 3, gridY: 15, colSpan: 1, rowSpan: 4 },
        loadout: { gridX: 4, gridY: 15, colSpan: 1, rowSpan: 4 },
        "comms-array": { gridX: 8, gridY: 15, colSpan: 1, rowSpan: 4 },
        codex: { gridX: 9, gridY: 15, colSpan: 1, rowSpan: 4 },
        settings: { gridX: 10, gridY: 15, colSpan: 1, rowSpan: 4 },
        [THEATER_AUTO_TICK_LAYOUT_ID]: { gridX: 11, gridY: 15, colSpan: 2, rowSpan: 4 },
      }),
      pinnedItems: [],
      itemColors: {
        [RESOURCE_LAYOUT_ID]: "violet",
        inventory: "steel",
        "ops-terminal": "oxide",
        roster: "oxide",
        [QUAC_LAYOUT_ID]: "verdant",
        [MINIMAP_LAYOUT_ID]: "steel",
        [NOTES_LAYOUT_ID]: "violet",
        [QUEST_TRACKER_LAYOUT_ID]: "violet",
        "comms-array": "teal",
        "black-market": "oxide",
        "foundry-annex": "steel",
        codex: "steel",
        settings: "steel",
      },
      pinnedItemFrames: {},
    };
  }

  if (index === 1) {
    return {
      minimizedItems: [
        MATERIALS_REFINERY_LAYOUT_ID,
        "ops-terminal",
        "roster",
        "gear-workbench",
        "shop",
        "tavern",
        "quest-board",
        "quarters",
        "port",
        "stable",
        "black-market",
        "schema",
        "foundry-annex",
        "comms-array",
        QUAC_LAYOUT_ID,
      ],
      itemSizes: serializeLayoutRecord({
        ...DEFAULT_ITEM_LAYOUTS,
        [NOTES_LAYOUT_ID]: { gridX: 7, gridY: 1, colSpan: 2, rowSpan: 11 },
        [QUEST_TRACKER_LAYOUT_ID]: { gridX: 9, gridY: 1, colSpan: 2, rowSpan: 11 },
        [RESOURCE_LAYOUT_ID]: { gridX: 11, gridY: 1, colSpan: 2, rowSpan: 6 },
        inventory: { gridX: 11, gridY: 7, colSpan: 2, rowSpan: 4 },
        [MINIMAP_LAYOUT_ID]: { gridX: 7, gridY: 12, colSpan: 4, rowSpan: 8 },
        loadout: { gridX: 11, gridY: 11, colSpan: 1, rowSpan: 5 },
        codex: { gridX: 12, gridY: 11, colSpan: 1, rowSpan: 4 },
        settings: { gridX: 12, gridY: 15, colSpan: 1, rowSpan: 4 },
        [THEATER_AUTO_TICK_LAYOUT_ID]: { gridX: 11, gridY: 19, colSpan: 2, rowSpan: 4 },
      }),
      pinnedItems: [],
      itemColors: {
        [NOTES_LAYOUT_ID]: "steel",
        [QUEST_TRACKER_LAYOUT_ID]: "steel",
        [RESOURCE_LAYOUT_ID]: "violet",
        [MINIMAP_LAYOUT_ID]: "steel",
        inventory: "verdant",
        loadout: "amber",
        "black-market": "oxide",
        "foundry-annex": "steel",
        codex: "steel",
        settings: "steel",
      },
      pinnedItemFrames: {},
    };
  }

  return null;
}

function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
}

function areItemSizeRecordsEqual(a: Record<string, BaseCampItemSize>, b: Record<string, BaseCampItemSize>): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (!areStringArraysEqual(aKeys, bKeys)) {
    return false;
  }

  for (const key of aKeys) {
    const aLayout = a[key];
    const bLayout = b[key];
    if (
      aLayout.colSpan !== bLayout.colSpan
      || aLayout.rowSpan !== bLayout.rowSpan
      || aLayout.gridX !== bLayout.gridX
      || aLayout.gridY !== bLayout.gridY
    ) {
      return false;
    }
  }

  return true;
}

function areStringRecordEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (!areStringArraysEqual(aKeys, bKeys)) {
    return false;
  }

  for (const key of aKeys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}

function areLoadoutsEquivalent(a: ResolvedBaseCampLoadout, b: ResolvedBaseCampLoadout): boolean {
  return areStringArraysEqual(a.minimizedItems, b.minimizedItems)
    && areItemSizeRecordsEqual(a.itemSizes, b.itemSizes)
    && areStringArraysEqual(a.pinnedItems, b.pinnedItems)
    && areStringRecordEqual(a.itemColors, b.itemColors)
    && arePinnedFramesEqual(a.pinnedItemFrames, b.pinnedItemFrames);
}

function readActiveLoadout(): ResolvedBaseCampLoadout {
  const state = getGameState();
  const loadouts = readStoredLoadouts(state);
  return loadouts[getLoadoutStorageKey(readActiveLoadoutIndex(state))];
}

function updateActiveLoadout(
  updater: (loadout: ResolvedBaseCampLoadout) => ResolvedBaseCampLoadout,
): void {
  updateGameState((state) => {
    const activeIndex = readActiveLoadoutIndex(state);
    const loadouts = readStoredLoadouts(state);
    const loadoutKey = getLoadoutStorageKey(activeIndex);
    const nextActiveLoadout = updater(loadouts[loadoutKey]);
    loadouts[loadoutKey] = {
      minimizedItems: [...nextActiveLoadout.minimizedItems],
      itemSizes: { ...nextActiveLoadout.itemSizes },
      pinnedItems: [...nextActiveLoadout.pinnedItems],
      itemColors: { ...nextActiveLoadout.itemColors },
      pinnedItemFrames: { ...nextActiveLoadout.pinnedItemFrames },
    };

    return {
      ...state,
      uiLayout: {
        ...(state.uiLayout ?? {}),
        baseCampLayoutVersion: BASE_CAMP_LAYOUT_VERSION,
        baseCampActiveLoadoutIndex: activeIndex,
        baseCampLayoutLoadouts: serializeStoredLoadouts(loadouts),
        baseCampMinimizedItems: [...loadouts[loadoutKey].minimizedItems],
        baseCampItemSizes: { ...loadouts[loadoutKey].itemSizes },
        baseCampPinnedItems: [...loadouts[loadoutKey].pinnedItems],
        baseCampItemColors: { ...loadouts[loadoutKey].itemColors },
        baseCampPinnedItemFrames: { ...loadouts[loadoutKey].pinnedItemFrames },
      },
    };
  });
}

function switchBaseCampLoadout(nextIndex: number): void {
  updateGameState((state) => {
    const loadouts = readStoredLoadouts(state);
    const activeIndex = clamp(nextIndex, 0, BASE_CAMP_LOADOUT_COUNT - 1);
    const activeLoadout = loadouts[getLoadoutStorageKey(activeIndex)];

    return {
      ...state,
      uiLayout: {
        ...(state.uiLayout ?? {}),
        baseCampLayoutVersion: BASE_CAMP_LAYOUT_VERSION,
        baseCampActiveLoadoutIndex: activeIndex,
        baseCampLayoutLoadouts: serializeStoredLoadouts(loadouts),
        baseCampMinimizedItems: [...activeLoadout.minimizedItems],
        baseCampItemSizes: { ...activeLoadout.itemSizes },
        baseCampPinnedItems: [...activeLoadout.pinnedItems],
        baseCampItemColors: { ...activeLoadout.itemColors },
        baseCampPinnedItemFrames: { ...activeLoadout.pinnedItemFrames },
      },
    };
  });
}

function readMinimizedItems(): string[] {
  return [...readActiveLoadout().minimizedItems];
}

function readPinnedItems(): string[] {
  return [...readActiveLoadout().pinnedItems];
}

function readItemColorKeys(): Record<string, string> {
  return { ...readActiveLoadout().itemColors };
}

function readPinnedItemFrames(): Record<string, BaseCampPinnedItemFrame> {
  return { ...readActiveLoadout().pinnedItemFrames };
}

function persistMinimizedItems(ids: string[]): void {
  const validIds = new Set(DEFAULT_LAYOUT_ORDER);
  updateActiveLoadout((loadout) => ({
    ...loadout,
    minimizedItems: Array.from(new Set(ids.filter((id) => validIds.has(id)))),
  }));
}

function persistPinnedItems(ids: string[]): void {
  const validIds = new Set(DEFAULT_LAYOUT_ORDER);
  updateActiveLoadout((loadout) => {
    const pinnedItems = Array.from(new Set(ids.filter((id) => validIds.has(id))));
    const nextPinned = new Set(pinnedItems);
    const nextFrames = Object.fromEntries(
      Object.entries(loadout.pinnedItemFrames).filter(([itemId]) => nextPinned.has(itemId)),
    ) as Record<string, BaseCampPinnedItemFrame>;

    return {
      ...loadout,
      pinnedItems,
      pinnedItemFrames: nextFrames,
    };
  });
}

function persistItemColorKeys(colors: Record<string, string>): void {
  updateActiveLoadout((loadout) => ({
    ...loadout,
    itemColors: { ...colors },
  }));
}

function persistPinnedItemFrames(frames: Record<string, BaseCampPinnedItemFrame>): void {
  const pinnedSet = new Set(readPinnedItems());
  updateActiveLoadout((loadout) => ({
    ...loadout,
    pinnedItemFrames: Object.fromEntries(
      Object.entries(frames).filter(([itemId]) => pinnedSet.has(itemId)),
    ) as Record<string, BaseCampPinnedItemFrame>,
  }));
}

function readItemSizes(): Record<string, BaseCampItemSize> {
  return { ...readActiveLoadout().itemSizes };
}

function persistItemSizes(sizes: Record<string, BaseCampItemSize>): void {
  updateActiveLoadout((loadout) => ({
    ...loadout,
    itemSizes: { ...sizes },
  }));
}

function serializeLayoutRecord(layouts: Record<string, WorkspaceItemLayout>): Record<string, BaseCampItemSize> {
  return Object.fromEntries(
    Object.entries(layouts).map(([itemId, layout]) => [itemId, serializeItemLayout(layout)]),
  ) as Record<string, BaseCampItemSize>;
}

function getDefaultItemColorKey(itemId: string): string {
  switch (itemId) {
    case QUAC_LAYOUT_ID:
      return "verdant";
    case RESOURCE_LAYOUT_ID:
      return "violet";
    case MINIMAP_LAYOUT_ID:
      return "steel";
    case NOTES_LAYOUT_ID:
      return "steel";
    case QUEST_TRACKER_LAYOUT_ID:
      return "teal";
    case "port":
    case "comms-array":
      return "teal";
    case "tavern":
    case "quarters":
      return "oxide";
    case "stable":
      return "moss";
    case "black-market":
      return "oxide";
    case "foundry-annex":
      return "steel";
    case "codex":
    case "settings":
    case "inventory":
      return "steel";
    default:
      return "amber";
  }
}

function getResolvedItemColorKey(itemId: string, savedColors: Record<string, string>): string {
  const colorKey = savedColors[itemId] ?? getDefaultItemColorKey(itemId);
  return BASE_CAMP_COLOR_THEME_MAP.has(colorKey) ? colorKey : "amber";
}

function renderItemThemeAttributes(itemId: string, savedColors: Record<string, string>): string {
  const colorKey = getResolvedItemColorKey(itemId, savedColors);
  const theme = BASE_CAMP_COLOR_THEME_MAP.get(colorKey) ?? BASE_CAMP_COLOR_THEMES[0];
  const style = Object.entries(theme.vars)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");

  return `data-color-key="${theme.key}" style="${style}"`;
}

function getDefaultItemLayout(itemId: string): WorkspaceItemLayout {
  return DEFAULT_ITEM_LAYOUTS[itemId] ?? { gridX: 1, gridY: 1, colSpan: 1, rowSpan: MIN_ITEM_ROW_SPAN };
}

function minHeightToRowSpan(minHeight: number | undefined): number {
  if (!minHeight || !Number.isFinite(minHeight)) {
    return MIN_ITEM_ROW_SPAN;
  }
  return Math.max(MIN_ITEM_ROW_SPAN, Math.round(minHeight / WORKSPACE_ROW_HEIGHT_PX));
}

function ensureBaseCampLayoutVersion(): void {
  const state = getGameState();
  const currentVersion = state.uiLayout?.baseCampLayoutVersion ?? 0;
  if (currentVersion >= BASE_CAMP_LAYOUT_VERSION) {
    return;
  }

  const activeLoadoutIndex = readActiveLoadoutIndex(state);
  const existingLoadouts = readStoredLoadouts(state);
  const migratedLoadouts = Object.fromEntries(
    Array.from({ length: BASE_CAMP_LOADOUT_COUNT }, (_, index) => {
      const key = getLoadoutStorageKey(index);
      const existingLoadout = existingLoadouts[key] ?? getDefaultLoadout(index);
      const legacyDefaultLoadout = currentVersion === 11 ? getLegacyDefaultLoadoutV11(index) : null;
      const nextLoadout = legacyDefaultLoadout && areLoadoutsEquivalent(existingLoadout, legacyDefaultLoadout)
        ? getDefaultLoadout(index)
        : existingLoadout;
      return [
        key,
        {
          minimizedItems: [...nextLoadout.minimizedItems],
          itemSizes: { ...nextLoadout.itemSizes },
          pinnedItems: [...nextLoadout.pinnedItems],
          itemColors: { ...nextLoadout.itemColors },
          pinnedItemFrames: { ...nextLoadout.pinnedItemFrames },
        },
      ];
    }),
  ) as Record<string, BaseCampLayoutLoadout>;
  const activeLoadout = normalizeLoadoutState(migratedLoadouts[getLoadoutStorageKey(activeLoadoutIndex)], activeLoadoutIndex);

  updateGameState((currentState) => ({
    ...currentState,
    uiLayout: {
      ...(currentState.uiLayout ?? {}),
      baseCampLayoutVersion: BASE_CAMP_LAYOUT_VERSION,
      baseCampActiveLoadoutIndex: activeLoadoutIndex,
      baseCampItemSizes: activeLoadout.itemSizes,
      baseCampMinimizedItems: activeLoadout.minimizedItems,
      baseCampItemColors: activeLoadout.itemColors,
      baseCampPinnedItemFrames: activeLoadout.pinnedItemFrames,
      baseCampPinnedItems: activeLoadout.pinnedItems,
      baseCampLayoutLoadouts: migratedLoadouts,
    },
  }));
}

function normalizeItemLayout(itemId: string, layout: BaseCampItemSize | undefined, columnCount: number): WorkspaceItemLayout {
  const fallback = getDefaultItemLayout(itemId);
  const safeColumns = Math.max(columnCount, 1);
  const requestedColSpan = clamp(layout?.colSpan ?? fallback.colSpan, 1, safeColumns);
  const requestedRowSpan = Math.max(
    MIN_ITEM_ROW_SPAN,
    layout?.rowSpan ?? (layout?.minHeight ? minHeightToRowSpan(layout.minHeight) : fallback.rowSpan),
  );
  const colSpan = itemId === MATERIALS_REFINERY_LAYOUT_ID
    ? clamp(Math.max(requestedColSpan, MATERIALS_REFINERY_MIN_COL_SPAN), 1, safeColumns)
    : requestedColSpan;
  const rowSpan = itemId === MATERIALS_REFINERY_LAYOUT_ID
    ? Math.max(requestedRowSpan, MATERIALS_REFINERY_MIN_ROW_SPAN)
    : requestedRowSpan;
  const maxGridX = Math.max(safeColumns - colSpan + 1, 1);
  return {
    colSpan,
    rowSpan,
    gridX: clamp(layout?.gridX ?? fallback.gridX, 1, maxGridX),
    gridY: Math.max(layout?.gridY ?? fallback.gridY, 1),
  };
}

function serializeItemLayout(layout: WorkspaceItemLayout): BaseCampItemSize {
  return {
    colSpan: layout.colSpan,
    rowSpan: layout.rowSpan,
    gridX: layout.gridX,
    gridY: layout.gridY,
  };
}

function layoutsOverlap(a: WorkspaceItemLayout, b: WorkspaceItemLayout): boolean {
  return (
    a.gridX < b.gridX + b.colSpan &&
    a.gridX + a.colSpan > b.gridX &&
    a.gridY < b.gridY + b.rowSpan &&
    a.gridY + a.rowSpan > b.gridY
  );
}

function isLayoutAreaFree(candidate: WorkspaceItemLayout, occupied: Iterable<WorkspaceItemLayout>): boolean {
  for (const other of occupied) {
    if (layoutsOverlap(candidate, other)) {
      return false;
    }
  }
  return true;
}

function findOpenLayoutSlot(
  requested: WorkspaceItemLayout,
  occupied: Iterable<WorkspaceItemLayout>,
  columnCount: number,
): WorkspaceItemLayout {
  const safeColumns = Math.max(columnCount, 1);
  const colSpan = clamp(requested.colSpan, 1, safeColumns);
  const maxGridX = Math.max(safeColumns - colSpan + 1, 1);
  const candidate: WorkspaceItemLayout = {
    colSpan,
    rowSpan: Math.max(MIN_ITEM_ROW_SPAN, requested.rowSpan),
    gridX: clamp(requested.gridX, 1, maxGridX),
    gridY: Math.max(requested.gridY, 1),
  };

  let guard = 0;
  while (!isLayoutAreaFree(candidate, occupied) && guard < 2000) {
    candidate.gridY += 1;
    guard += 1;
  }

  return candidate;
}

type WorkspaceResolutionOptions = {
  priorityItemId?: string;
  priorityLayout?: WorkspaceItemLayout;
};

function buildResolvedWorkspaceLayouts(
  order: string[],
  sizes: Record<string, BaseCampItemSize>,
  columnCount: number,
  options: WorkspaceResolutionOptions = {},
): Map<string, WorkspaceItemLayout> {
  const entries = order.map((itemId, index) => {
    const requested =
      itemId === options.priorityItemId && options.priorityLayout
        ? findOpenLayoutSlot(options.priorityLayout, [], columnCount)
        : normalizeItemLayout(itemId, sizes[itemId], columnCount);

    return {
      itemId,
      index,
      requested,
      area: requested.colSpan * requested.rowSpan,
      isPriority: itemId === options.priorityItemId,
    };
  });

  entries.sort((a, b) => {
    if (a.isPriority !== b.isPriority) {
      return a.isPriority ? -1 : 1;
    }
    if (a.requested.gridY !== b.requested.gridY) {
      return a.requested.gridY - b.requested.gridY;
    }
    if (a.requested.gridX !== b.requested.gridX) {
      return a.requested.gridX - b.requested.gridX;
    }
    if (a.area !== b.area) {
      return b.area - a.area;
    }
    return a.index - b.index;
  });

  const resolved = new Map<string, WorkspaceItemLayout>();

  for (const entry of entries) {
    const placed = findOpenLayoutSlot(entry.requested, resolved.values(), columnCount);
    resolved.set(entry.itemId, placed);
  }

  return resolved;
}

function applyGridItemStyle(item: HTMLElement, layout: WorkspaceItemLayout): void {
  item.style.gridColumn = `${layout.gridX} / span ${layout.colSpan}`;
  item.style.gridRow = `${layout.gridY} / span ${layout.rowSpan}`;
}

function applyResolvedWorkspaceLayouts(grid: HTMLElement, resolved: Map<string, WorkspaceItemLayout>): void {
  grid.querySelectorAll<HTMLElement>(".all-nodes-grid-item").forEach((item) => {
    const itemId = item.dataset.layoutId;
    if (!itemId) return;

    const layout = resolved.get(itemId);
    if (!layout) return;
    applyGridItemStyle(item, layout);
  });
}

function applyWorkspaceLayoutStyles(root: HTMLElement): void {
  const grid = root.querySelector<HTMLElement>("#allNodesMenuGrid");
  if (!grid) return;

  const order = Array.from(grid.querySelectorAll<HTMLElement>(".all-nodes-grid-item"))
    .map((item) => item.dataset.layoutId ?? "")
    .filter(Boolean);
  const sizes = readItemSizes();
  const metrics = getGridMetrics(grid);
  const resolved = buildResolvedWorkspaceLayouts(order, sizes, metrics.columnCount);
  applyResolvedWorkspaceLayouts(grid, resolved);
}

function getRenderedWorkspaceLayouts(grid: HTMLElement): Map<string, WorkspaceItemLayout> {
  const order = Array.from(grid.querySelectorAll<HTMLElement>(".all-nodes-grid-item"))
    .map((item) => item.dataset.layoutId ?? "")
    .filter(Boolean);
  return buildResolvedWorkspaceLayouts(order, readItemSizes(), getGridMetrics(grid).columnCount);
}
void getRenderedWorkspaceLayouts;

function getPointerGridPosition(grid: HTMLElement, clientX: number, clientY: number, colSpan: number, rowSpan: number): WorkspaceItemLayout {
  const metrics = getGridMetrics(grid);
  const rect = grid.getBoundingClientRect();
  const localX = Math.max(clientX - rect.left, 0);
  const localY = Math.max(clientY - rect.top + grid.scrollTop, 0);
  const columnStep = Math.max(metrics.trackWidth + metrics.columnGap, 1);
  const rowStep = Math.max(metrics.rowHeight + metrics.rowGap, 1);
  const maxGridX = Math.max(metrics.columnCount - colSpan + 1, 1);

  return {
    colSpan: clamp(colSpan, 1, metrics.columnCount),
    rowSpan: Math.max(MIN_ITEM_ROW_SPAN, rowSpan),
    gridX: clamp(Math.floor(localX / columnStep) + 1, 1, maxGridX),
    gridY: Math.max(Math.floor(localY / rowStep) + 1, 1),
  };
}

function autoScrollGrid(grid: HTMLElement, clientY: number): void {
  const rect = grid.getBoundingClientRect();
  if (clientY > rect.bottom - AUTO_SCROLL_MARGIN_PX) {
    grid.scrollTop += AUTO_SCROLL_STEP_PX;
  } else if (clientY < rect.top + AUTO_SCROLL_MARGIN_PX) {
    grid.scrollTop -= AUTO_SCROLL_STEP_PX;
  }
}

function cleanupAllNodesWindowListeners(): void {
  if (cleanupAllNodesControllerContext) {
    cleanupAllNodesControllerContext();
    cleanupAllNodesControllerContext = null;
  }

  if (allNodesEscHandler) {
    window.removeEventListener("keydown", allNodesEscHandler);
    allNodesEscHandler = null;
  }

  if (allNodesResizeHandler) {
    window.removeEventListener("resize", allNodesResizeHandler);
    allNodesResizeHandler = null;
  }

  if (pinnedFrameSyncHandle !== null) {
    cancelAnimationFrame(pinnedFrameSyncHandle);
    pinnedFrameSyncHandle = null;
  }
}

function arePinnedFramesEqual(
  a: Record<string, BaseCampPinnedItemFrame>,
  b: Record<string, BaseCampPinnedItemFrame>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every((key) => {
    const aFrame = a[key];
    const bFrame = b[key];
    return Boolean(bFrame)
      && aFrame.left === bFrame.left
      && aFrame.top === bFrame.top
      && aFrame.width === bFrame.width
      && aFrame.height === bFrame.height;
  });
}

function syncPinnedItemFrames(root: ParentNode): void {
  const pinned = new Set(readPinnedItems());
  if (pinned.size === 0) {
    const existing = readPinnedItemFrames();
    if (Object.keys(existing).length > 0) {
      persistPinnedItemFrames({});
    }
    return;
  }

  const nextFrames = { ...readPinnedItemFrames() };
  let updated = false;

  root.querySelectorAll<HTMLElement>(".all-nodes-grid-item[data-layout-id]").forEach((item) => {
    const itemId = item.dataset.layoutId;
    if (!itemId || !pinned.has(itemId)) return;

    const rect = item.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const nextFrame: BaseCampPinnedItemFrame = {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
    const currentFrame = nextFrames[itemId];

    if (
      !currentFrame
      || currentFrame.left !== nextFrame.left
      || currentFrame.top !== nextFrame.top
      || currentFrame.width !== nextFrame.width
      || currentFrame.height !== nextFrame.height
    ) {
      nextFrames[itemId] = nextFrame;
      updated = true;
    }
  });

  if (updated && !arePinnedFramesEqual(readPinnedItemFrames(), nextFrames)) {
    persistPinnedItemFrames(nextFrames);
  }
}

function queuePinnedItemFrameSync(root: ParentNode): void {
  if (pinnedFrameSyncHandle !== null) {
    cancelAnimationFrame(pinnedFrameSyncHandle);
  }

  pinnedFrameSyncHandle = requestAnimationFrame(() => {
    pinnedFrameSyncHandle = null;
    syncPinnedItemFrames(root);
  });
}

type ItemToolbarOptions = {
  extraClass?: string;
  isPinned?: boolean;
  showColor?: boolean;
  showMinimize?: boolean;
  showPin?: boolean;
};

function renderItemToolbar(itemId: string, label: string, options: ItemToolbarOptions = {}): string {
  const {
    extraClass = "",
    isPinned = false,
    showColor = true,
    showMinimize = true,
    showPin = true,
  } = options;

  return `
    <div class="all-nodes-item-toolbar${extraClass}">
      <span class="all-nodes-item-grip" aria-hidden="true">::</span>
      <div class="all-nodes-item-toolbar-actions">
        ${showColor ? `
          <button class="all-nodes-item-color" type="button" data-color-id="${itemId}" aria-label="Change color for ${label}">
            <span class="all-nodes-item-color-dot" aria-hidden="true"></span>
          </button>
        ` : ""}
        ${showPin ? `
          <button class="all-nodes-item-pin${isPinned ? " all-nodes-item-pin--active" : ""}" type="button" data-pin-id="${itemId}" aria-label="${isPinned ? "Unpin" : "Pin"} ${label}">P</button>
        ` : ""}
        ${showMinimize ? `
          <button class="all-nodes-item-minimize" type="button" data-minimize-id="${itemId}" aria-label="Minimize ${label}">_</button>
        ` : ""}
      </div>
    </div>
  `;
}

function renderDispatchNodePip(): string {
  const dispatch = getDispatchState(getGameState());
  if (dispatch.activeExpeditions.length === 0) {
    return `
      <span class="node-pip node-pip--idle">
        <span class="node-pip-label">Routes</span>
        <span class="node-pip-value">Idle</span>
      </span>
    `;
  }

  const routeSummary = dispatch.activeExpeditions
    .slice(0, 2)
    .map((expedition) => {
      const remaining = Math.max(0, expedition.completesAtTick - dispatch.dispatchTick);
      return `${expedition.missionName} ${remaining}t`;
    })
    .join(" • ");
  const extraCount = Math.max(0, dispatch.activeExpeditions.length - 2);
  const compactSummary = extraCount > 0 ? `${routeSummary} +${extraCount}` : routeSummary;

  return `
    <span class="node-pip">
      <span class="node-pip-label">Routes</span>
      <span class="node-pip-value">${compactSummary}</span>
    </span>
  `;
}

function renderRosterNodePip(): string {
  const state = getGameState();
  const friendlyUnits = Object.values(state.unitsById).filter((unit) => !unit.isEnemy);
  const partyCount = (state.partyUnitIds ?? []).length;
  const reserveCount = Math.max(0, friendlyUnits.length - partyCount);
  const statBank = getStatBank(state);

  return `
    <span class="node-pip">
      <span class="node-pip-label">Roster</span>
      <span class="node-pip-value">${partyCount} party / ${reserveCount} reserve • ${statBank} ${STAT_SHORT_LABEL}</span>
    </span>
  `;
}

function renderSchemaNodePip(): string {
  return `
    <span class="node-pip node-pip--idle">
      <span class="node-pip-label">Status</span>
      <span class="node-pip-value">Placeholder terminal online</span>
    </span>
  `;
}

function getMaterialRefineryContext(): MaterialRefineryContext {
  return getOuterDeckFieldContext(lastFieldMap) === "outerDeckBranch" ? "expedition" : "haven";
}

function formatMaterialRefineryCost(recipeId: AdvancedMaterialId): string {
  const recipe = getMaterialRefineryRecipes().find((entry) => entry.id === recipeId);
  if (!recipe) {
    return "";
  }

  return Object.entries(recipe.cost)
    .map(([resourceKey, amount]) => `${amount}${MATERIALS_REFINERY_RESOURCE_SHORT_LABELS[resourceKey] ?? resourceKey}`)
    .join(" + ");
}

function formatMaterialRefineryShortage(recipeId: AdvancedMaterialId): string {
  const shortage = getMaterialRefineryShortage(getGameState(), recipeId);
  if (shortage.length === 0) {
    return "READY";
  }

  return shortage
    .map((entry) => `${MATERIALS_REFINERY_RESOURCE_SHORT_LABELS[entry.resourceKey] ?? entry.resourceKey} ${entry.available}/${entry.required}`)
    .join(" · ");
}

function shouldShowExpandedResourceTracker(): boolean {
  return getGameState().uiLayout?.baseCampResourceTrackerShowAdvanced ?? true;
}

function setExpandedResourceTrackerVisible(showAdvanced: boolean): void {
  updateGameState((state) => ({
    ...state,
    uiLayout: {
      ...(state.uiLayout ?? {}),
      baseCampResourceTrackerShowAdvanced: showAdvanced,
    },
  }));
}

function formatAtlasFloorLabel(floorOrdinal: number): string {
  return `FLOOR ${String(Math.max(1, Math.floor(floorOrdinal || 1))).padStart(2, "0")}`;
}

function isBaseCampTheaterAutoTickEnabled(state = getGameState()): boolean {
  return Boolean(state.uiLayout?.baseCampTheaterAutoTickEnabled);
}

function getCurrentAtlasFloorOrdinalSafe(): number {
  try {
    return getCurrentOpsTerminalAtlasFloor().floorOrdinal;
  } catch {
    return Math.max(1, Math.floor(loadCampaignProgress().opsTerminalAtlas?.currentFloorOrdinal ?? 1));
  }
}

function describeTheaterAutoTickCoverage(
  summaries: ReturnType<typeof getOpsTerminalAtlasWarmEconomySummaries>,
): string {
  if (summaries.length <= 0) {
    return "No operational theaters are online on this floor.";
  }

  const labels = summaries.slice(0, 2).map((summary) => `${summary.sectorLabel} ${summary.zoneName}`);
  const extraCount = Math.max(0, summaries.length - labels.length);
  return extraCount > 0 ? `${labels.join(" · ")} · +${extraCount} more` : labels.join(" · ");
}

function describeTheaterAutoTickEconomyDelta(
  beforeState: ReturnType<typeof getSessionResourcePool>,
  afterState: ReturnType<typeof getSessionResourcePool>,
): string {
  const parts: string[] = [];
  const wadDelta = Math.round((afterState.wad ?? 0) - (beforeState.wad ?? 0));
  if (wadDelta !== 0) {
    parts.push(`WAD ${wadDelta > 0 ? "+" : ""}${wadDelta}`);
  }

  for (const { key: resourceKey } of getResourceEntries(afterState.resources)) {
    const nextValue = Number(afterState.resources?.[resourceKey] ?? 0);
    const previousValue = Number(beforeState.resources?.[resourceKey] ?? 0);
    const delta = Math.round(nextValue - previousValue);
    if (delta !== 0) {
      parts.push(`${RESOURCE_SHORT_LABELS[resourceKey] ?? resourceKey.toUpperCase()} ${delta > 0 ? "+" : ""}${delta}`);
    }
  }

  return parts.join(" · ");
}

function performTheaterAutoTick(): void {
  const currentState = getGameState();
  if (!isBaseCampTheaterAutoTickEnabled(currentState)) {
    return;
  }

  const floorOrdinal = getCurrentAtlasFloorOrdinalSafe();
  const beforeSummaries = getOpsTerminalAtlasWarmEconomySummaries(floorOrdinal);
  const localPlayerSlot = getLocalSessionPlayerSlot(currentState);
  const beforePool = getSessionResourcePool(currentState, localPlayerSlot);
  const nextState = holdPositionInOpsTerminalAtlas(currentState, floorOrdinal, 1);
  if (nextState === currentState) {
    return;
  }

  setGameState(nextState);

  const afterSummaries = getOpsTerminalAtlasWarmEconomySummaries(floorOrdinal);
  const afterPool = getSessionResourcePool(nextState, localPlayerSlot);
  const coverage = describeTheaterAutoTickCoverage(afterSummaries.length > 0 ? afterSummaries : beforeSummaries);
  const economyDelta = describeTheaterAutoTickEconomyDelta(beforePool, afterPool);
  const message = `${Math.max(afterSummaries.length, beforeSummaries.length, 1)} theater${Math.max(afterSummaries.length, beforeSummaries.length, 1) === 1 ? "" : "s"} advanced on ${formatAtlasFloorLabel(floorOrdinal)}.`;

  quacLastFeedback = `THEATER CLOCK :: ${message}`;
  showSystemPing({
    type: economyDelta ? "success" : "info",
    title: "THEATER TICK +1",
    message,
    detail: [coverage, economyDelta].filter(Boolean).join(" // "),
    channel: THEATER_AUTO_TICK_PING_CHANNEL,
    replaceChannel: true,
    durationMs: 4200,
  });
}

function syncTheaterAutoTickInterval(): void {
  const shouldRun = isBaseCampTheaterAutoTickEnabled();
  if (!shouldRun) {
    if (theaterAutoTickIntervalId !== null) {
      window.clearInterval(theaterAutoTickIntervalId);
      theaterAutoTickIntervalId = null;
    }
    return;
  }

  if (theaterAutoTickIntervalId !== null) {
    return;
  }

  theaterAutoTickIntervalId = window.setInterval(() => {
    performTheaterAutoTick();
    if (!isBaseCampTheaterAutoTickEnabled()) {
      syncTheaterAutoTickInterval();
    }
  }, THEATER_AUTO_TICK_INTERVAL_MS);
}

export function ensureTheaterAutoTickStateSync(): void {
  if (cleanupTheaterAutoTickStateSubscription) {
    return;
  }
  cleanupTheaterAutoTickStateSubscription = subscribe(() => {
    syncTheaterAutoTickInterval();
  });
  syncTheaterAutoTickInterval();
}

function setBaseCampTheaterAutoTickEnabled(enabled: boolean): void {
  updateGameState((state) => ({
    ...state,
    uiLayout: {
      ...(state.uiLayout ?? {}),
      baseCampTheaterAutoTickEnabled: enabled,
    },
  }));

  quacLastFeedback = enabled
    ? "THEATER CLOCK :: Background theater ticks engaged."
    : "THEATER CLOCK :: Background theater ticks halted.";
  showSystemPing({
    type: enabled ? "success" : "info",
    title: enabled ? "THEATER CLOCK ONLINE" : "THEATER CLOCK OFFLINE",
    message: enabled
      ? "Operational theaters will advance by 1 tick every 10 seconds."
      : "Background theater advancement has been paused.",
    detail: `${formatAtlasFloorLabel(getCurrentAtlasFloorOrdinalSafe())} :: ${enabled ? "Live auto-tick engaged." : "Tick loop disengaged."}`,
    channel: THEATER_AUTO_TICK_PING_CHANNEL,
    replaceChannel: true,
    durationMs: 3600,
  });
  renderAllNodesMenuScreen(lastFieldMap);
  requestAnimationFrame(() => focusWorkspaceItem(THEATER_AUTO_TICK_LAYOUT_ID));
}

function renderMaterialRefineryNodeContent(isPinned: boolean): string {
  const state = getGameState();
  const context = getMaterialRefineryContext();
  const destinationLabel = context === "expedition" ? "FORWARD LOCKER" : "BASE STORAGE";

  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--materials-refinery">
      ${renderItemToolbar(MATERIALS_REFINERY_LAYOUT_ID, "light crafting", { isPinned })}
      <section class="all-nodes-refinery-panel" aria-label="Light crafting">
        <div class="all-nodes-refinery-heading">
          <div class="all-nodes-refinery-title">LIGHT CRAFTING</div>
          <span class="all-nodes-refinery-destination">${destinationLabel}</span>
        </div>
        <div class="all-nodes-refinery-resource-strip">
          ${BASIC_RESOURCE_KEYS.map((resourceKey) => `
            <div class="all-nodes-refinery-resource-item">
              <span>${MATERIALS_REFINERY_RESOURCE_SHORT_LABELS[resourceKey] ?? resourceKey}</span>
              <strong>${Number(state.resources?.[resourceKey] ?? 0)}</strong>
            </div>
          `).join("")}
        </div>
        <div class="all-nodes-refinery-grid">
          ${getMaterialRefineryRecipes().map((recipe) => {
            const owned = countAdvancedMaterialOwned(state, recipe.id);
            const canCraft = canCraftMaterialRefineryRecipe(state, recipe.id);
            const outputQuantity = getMaterialRefineryEffectiveOutputQuantity(state, recipe.id);
            return `
              <article class="all-nodes-refinery-card${canCraft ? "" : " all-nodes-refinery-card--locked"}">
                <div class="all-nodes-refinery-card-header">
                  <div class="all-nodes-refinery-card-name">${recipe.name}</div>
                  <span class="all-nodes-refinery-card-owned">x${owned}</span>
                </div>
                <div class="all-nodes-refinery-card-meta">
                  <span class="all-nodes-refinery-card-cost">${formatMaterialRefineryCost(recipe.id)}</span>
                  <span class="all-nodes-refinery-card-status${canCraft ? "" : " all-nodes-refinery-card-status--short"}">${formatMaterialRefineryShortage(recipe.id)}</span>
                </div>
                <button
                  class="all-nodes-refinery-craft-btn"
                  type="button"
                  data-refinery-craft-id="${recipe.id}"
                  ${canCraft ? "" : "disabled"}
                >
                  MAKE x${outputQuantity}
                </button>
              </article>
            `;
          }).join("")}
        </div>
      </section>
      <button class="all-nodes-item-resize" type="button" data-resize-id="${MATERIALS_REFINERY_LAYOUT_ID}" aria-label="Resize light crafting"></button>
    </div>
  `;
}

function renderTheaterAutoTickNodeContent(isPinned: boolean): string {
  const enabled = isBaseCampTheaterAutoTickEnabled();
  const floorOrdinal = getCurrentAtlasFloorOrdinalSafe();
  const summaries = getOpsTerminalAtlasWarmEconomySummaries(floorOrdinal);
  const totalWadUpkeep = summaries.reduce((total, summary) => total + Math.max(0, summary.wadUpkeepPerTick ?? 0), 0);
  const totalIncome = createEmptyResourceWallet(
    summaries.reduce((acc, summary) => {
      for (const { key: resourceKey, amount } of getResourceEntries(summary.incomePerTick)) {
        acc[resourceKey] = Number(acc[resourceKey] ?? 0) + Number(amount ?? 0);
      }
      return acc;
    }, createEmptyResourceWallet()),
  );
  const incomeSummary = getResourceEntries(totalIncome)
    .filter(({ amount }) => Number(amount ?? 0) > 0)
    .slice(0, 3)
    .map(({ key: resourceKey, amount }) => `${RESOURCE_SHORT_LABELS[resourceKey] ?? resourceKey.toUpperCase()} +${Math.round(Number(amount ?? 0))}`)
    .join(" Â· ");

  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--theater-clock">
      ${renderItemToolbar(THEATER_AUTO_TICK_LAYOUT_ID, "theater clock", { isPinned })}
      <section class="all-nodes-theater-clock-panel" aria-label="Theater clock">
        <div class="all-nodes-theater-clock-heading">
          <span class="all-nodes-theater-clock-kicker">BACKGROUND THEATER TICKS</span>
          <span class="all-nodes-theater-clock-rate">+1 TICK / 10 SEC</span>
        </div>
        <div class="all-nodes-theater-clock-meta">
          <span>${formatAtlasFloorLabel(floorOrdinal)}</span>
          <span>${summaries.length} ONLINE</span>
          <span>WAD ${totalWadUpkeep > 0 ? `-${totalWadUpkeep}` : "0"}</span>
        </div>
        <button
          class="all-nodes-theater-clock-toggle${enabled ? " is-active" : ""}"
          type="button"
          data-theater-autotick-toggle="${enabled ? "off" : "on"}"
          aria-pressed="${enabled ? "true" : "false"}"
        >
          <span class="all-nodes-theater-clock-toggle-track">
            <span class="all-nodes-theater-clock-toggle-thumb"></span>
          </span>
          <span class="all-nodes-theater-clock-toggle-copy">
            <span class="all-nodes-theater-clock-toggle-state">${enabled ? "ONLINE" : "OFFLINE"}</span>
            <span class="all-nodes-theater-clock-toggle-desc">${enabled ? "The current atlas floor advances automatically until switched off." : "Flip the switch to push all online sectors forward in the background."}</span>
          </span>
        </button>
        <div class="all-nodes-theater-clock-status">
          <div class="all-nodes-theater-clock-line">${describeTheaterAutoTickCoverage(summaries)}</div>
          <div class="all-nodes-theater-clock-line all-nodes-theater-clock-line--muted">${incomeSummary || "No active income streams are registered on this floor yet."}</div>
        </div>
      </section>
      <button class="all-nodes-item-resize" type="button" data-resize-id="${THEATER_AUTO_TICK_LAYOUT_ID}" aria-label="Resize theater clock"></button>
    </div>
  `;
}

function renderNodeContent(node: NodeDefinition, isPinned: boolean): string {
  if (node.action === MATERIALS_REFINERY_LAYOUT_ID) {
    return renderMaterialRefineryNodeContent(isPinned);
  }
  if (node.action === THEATER_AUTO_TICK_LAYOUT_ID) {
    return renderTheaterAutoTickNodeContent(isPinned);
  }

  const availability = isEscNodeAction(node.action)
    ? getEscActionAvailability(node.action, getEscAvailabilityContext())
    : "active";
  const variantClass = node.variant ? ` ${node.variant}` : "";
  const disabledClass = availability === "disabled" ? " all-nodes-node-btn--disabled" : "";
  const pip = node.action === "roster"
    ? renderRosterNodePip()
    : node.action === "schema"
      ? renderSchemaNodePip()
      : "";
  return `
    <div class="all-nodes-item-shell">
      ${renderItemToolbar(node.action, node.label, { isPinned })}
      <button class="all-nodes-node-btn${variantClass}${disabledClass}" data-action="${node.action}" ${availability === "disabled" ? "disabled aria-disabled=\"true\"" : ""}>
        <span class="node-icon">${node.icon}</span>
        <span class="node-label">${node.label}</span>
        <span class="node-desc">${node.desc}</span>
        ${pip}
      </button>
      <button class="all-nodes-item-resize" type="button" data-resize-id="${node.action}" aria-label="Resize ${node.label}"></button>
    </div>
  `;
}

function renderResourceTrackerContent(
  wad: number,
  resources: ResourceWallet,
  isPinned: boolean,
): string {
  const state = getGameState();
  const showAdvanced = shouldShowExpandedResourceTracker();
  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--resource">
      ${renderItemToolbar(RESOURCE_LAYOUT_ID, "resource tracker", { isPinned })}
      <section class="all-nodes-balance-panel" aria-label="Resource balances">
        <div class="all-nodes-balance-heading">
          <span class="all-nodes-balance-kicker">RESOURCE BALANCE</span>
          <button
            class="all-nodes-balance-toggle"
            type="button"
            data-resource-tracker-toggle="${showAdvanced ? "core-only" : "advanced"}"
            aria-pressed="${showAdvanced ? "true" : "false"}"
          >
            ${showAdvanced ? "CORE ONLY" : "SHOW ADVANCED"}
          </button>
        </div>
        <div class="all-nodes-balance-grid">
          <div class="all-nodes-balance-item">
            <span class="all-nodes-balance-icon">W</span>
            <span class="all-nodes-balance-label">WAD</span>
            <span class="all-nodes-balance-value">${wad.toLocaleString()}</span>
          </div>
          ${getResourceEntries(resources, { includeZero: true, keys: BASIC_RESOURCE_KEYS }).map((entry) => `
            <div class="all-nodes-balance-item">
              <span class="all-nodes-balance-icon">${entry.abbreviation}</span>
              <span class="all-nodes-balance-label">${entry.shortLabel}</span>
              <span class="all-nodes-balance-value">${entry.amount}</span>
            </div>
          `).join("")}
        </div>
        ${showAdvanced ? `
          <div class="all-nodes-balance-advanced">
            <div class="all-nodes-balance-section-title">Advanced Materials</div>
            <div class="all-nodes-balance-grid all-nodes-balance-grid--advanced">
              ${getMaterialRefineryRecipes().map((recipe) => `
                <div class="all-nodes-balance-item">
                  <span class="all-nodes-balance-icon">${recipe.name.slice(0, 2)}</span>
                  <span class="all-nodes-balance-label">${recipe.name}</span>
                  <span class="all-nodes-balance-value">${countAdvancedMaterialOwned(state, recipe.id)}</span>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}
      </section>
      <button class="all-nodes-item-resize" type="button" data-resize-id="${RESOURCE_LAYOUT_ID}" aria-label="Resize resource tracker"></button>
    </div>
  `;
}

function renderQuacContent(isPinned: boolean): string {
  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--quac">
      ${renderItemToolbar(QUAC_LAYOUT_ID, "QUAC terminal", { extraClass: " all-nodes-item-toolbar--quac", isPinned })}
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
      <button class="all-nodes-item-resize" type="button" data-resize-id="${QUAC_LAYOUT_ID}" aria-label="Resize QUAC terminal"></button>
    </div>
  `;
}

function renderNotesContent(isPinned: boolean): string {
  const state = getGameState();
  const anchorX = Math.round((state.players?.P1?.avatar?.x ?? 640) + 56);
  const anchorY = Math.round((state.players?.P1?.avatar?.y ?? 360) - 28);
  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--notes">
      ${renderItemToolbar(NOTES_LAYOUT_ID, "field memos", { isPinned })}
      <section class="all-nodes-notes-panel" aria-label="Field memos" data-ez-drag-disable="true">
        <div class="all-nodes-notes-panel__title">FIELD MEMOS</div>
        ${renderNotesWidget("esc-notes", {
          className: "notes-widget--esc",
          placeholder: "Record reminders, squad plans, build routes, or anything else you want to keep pinned to E.S.C.",
          statusLabel: "AUTO-SAVE ACTIVE // AVAILABLE IN ATLAS + THEATER",
          titleLabel: "Tab Name",
          stickyTarget: {
            surfaceType: "field",
            surfaceId: lastFieldMap,
            x: anchorX,
            y: anchorY,
          },
        })}
      </section>
      <button class="all-nodes-item-resize" type="button" data-resize-id="${NOTES_LAYOUT_ID}" aria-label="Resize field memos"></button>
    </div>
  `;
}

function renderQuestTrackerContent(isPinned: boolean): string {
  const quests = getActiveQuests();
  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--quest-tracker">
      ${renderItemToolbar(QUEST_TRACKER_LAYOUT_ID, "quest tracker", { isPinned })}
      ${renderQuestTrackerWidget(quests, {
        className: "quest-tracker-widget--esc",
        emptyTitle: "NO ACTIVE QUESTS",
        emptyText: "Accept directives and endless contracts from the Quest Board to track them here.",
      })}
      <button class="all-nodes-item-resize" type="button" data-resize-id="${QUEST_TRACKER_LAYOUT_ID}" aria-label="Resize quest tracker"></button>
    </div>
  `;
}

function resolveEscMinimapModel() {
  const runtimeMap = getCurrentFieldRuntimeMap();
  const runtimeFieldState = getCurrentFieldRuntimeState();
  const resolvedMapId = lastFieldMap || getBaseCampFieldReturnMap() || runtimeFieldState?.currentMap || runtimeMap?.id || null;
  return buildFieldMinimapModel(resolvedMapId, {
    runtimeMap,
    runtimeFieldState,
  });
}

function focusWorkspaceItem(itemId: string): void {
  const root = document.getElementById("app");
  const item = root?.querySelector<HTMLElement>(`.all-nodes-grid-item[data-layout-id="${itemId}"]`);
  if (!item) {
    return;
  }

  item.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "nearest",
  });
  requestAnimationFrame(() => {
    const focusTarget = itemId === MATERIALS_REFINERY_LAYOUT_ID
      ? item.querySelector<HTMLElement>("[data-refinery-craft-id]:not([disabled]), [data-refinery-craft-id]")
      : item.querySelector<HTMLElement>("button, input, textarea, [tabindex]");
    focusTarget?.focus();
  });
}

function revealWorkspaceItem(itemId: string): void {
  const minimized = new Set(readMinimizedItems());
  if (minimized.has(itemId)) {
    minimized.delete(itemId);
    persistMinimizedItems(Array.from(minimized));
    renderAllNodesMenuScreen(lastFieldMap);
    requestAnimationFrame(() => focusWorkspaceItem(itemId));
    return;
  }

  focusWorkspaceItem(itemId);
}

function getEscControllerItemOrder(): string[] {
  return readLayoutOrder();
}

function getEscControllerActiveItem(): string {
  const order = getEscControllerItemOrder();
  if (order.length <= 0) {
    escControllerActiveItemId = RESOURCE_LAYOUT_ID;
    return escControllerActiveItemId;
  }

  if (!order.includes(escControllerActiveItemId)) {
    const minimized = new Set(readMinimizedItems());
    escControllerActiveItemId = order.find((itemId) => !minimized.has(itemId)) ?? order[0] ?? RESOURCE_LAYOUT_ID;
  }

  return escControllerActiveItemId;
}

function focusEscControllerItem(itemId: string): void {
  escControllerActiveItemId = itemId;
  const minimized = new Set(readMinimizedItems());
  requestAnimationFrame(() => {
    if (minimized.has(itemId)) {
      document.querySelector<HTMLElement>(`[data-restore-id="${itemId}"]`)?.focus();
      updateFocusableElements();
      return;
    }
    focusWorkspaceItem(itemId);
    updateFocusableElements();
  });
}

function cycleEscControllerItem(step: 1 | -1): void {
  const order = getEscControllerItemOrder();
  if (order.length <= 0) {
    return;
  }

  const currentIndex = Math.max(0, order.indexOf(getEscControllerActiveItem()));
  escControllerActiveItemId = order[(currentIndex + step + order.length) % order.length] ?? order[0] ?? RESOURCE_LAYOUT_ID;
  focusEscControllerItem(escControllerActiveItemId);
}

function toggleEscControllerItemMinimized(itemId: string): void {
  const minimized = new Set(readMinimizedItems());
  if (minimized.has(itemId)) {
    minimized.delete(itemId);
  } else {
    minimized.add(itemId);
  }
  persistMinimizedItems(Array.from(minimized));
  renderAllNodesMenuScreen(lastFieldMap);
  focusEscControllerItem(itemId);
}

function cycleEscControllerItemColor(itemId: string): void {
  const colors = { ...readItemColorKeys() };
  const currentKey = getResolvedItemColorKey(itemId, colors);
  const currentIndex = BASE_CAMP_COLOR_THEME_KEYS.indexOf(currentKey);
  const nextKey = BASE_CAMP_COLOR_THEME_KEYS[(currentIndex + 1 + BASE_CAMP_COLOR_THEME_KEYS.length) % BASE_CAMP_COLOR_THEME_KEYS.length];
  colors[itemId] = nextKey;
  persistItemColorKeys(colors);
  renderAllNodesMenuScreen(lastFieldMap);
  focusEscControllerItem(itemId);
}

function moveEscControllerItemLayout(
  itemId: string,
  delta: { gridX?: number; gridY?: number; colSpan?: number; rowSpan?: number },
): void {
  const minimized = new Set(readMinimizedItems());
  if (minimized.has(itemId)) {
    return;
  }

  const root = document.getElementById("app");
  const grid = root?.querySelector<HTMLElement>("#allNodesMenuGrid");
  if (!grid) {
    return;
  }

  const order = Array.from(grid.querySelectorAll<HTMLElement>(".all-nodes-grid-item"))
    .map((item) => item.dataset.layoutId ?? "")
    .filter(Boolean);
  const metrics = getGridMetrics(grid);
  const sizes = readItemSizes();
  const resolved = buildResolvedWorkspaceLayouts(order, sizes, metrics.columnCount);
  const currentLayout = resolved.get(itemId) ?? normalizeItemLayout(itemId, sizes[itemId], metrics.columnCount);

  const requestedLayout = normalizeItemLayout(itemId, {
    ...(sizes[itemId] ?? serializeItemLayout(currentLayout)),
    gridX: currentLayout.gridX + (delta.gridX ?? 0),
    gridY: currentLayout.gridY + (delta.gridY ?? 0),
    colSpan: currentLayout.colSpan + (delta.colSpan ?? 0),
    rowSpan: currentLayout.rowSpan + (delta.rowSpan ?? 0),
  }, metrics.columnCount);

  sizes[itemId] = serializeItemLayout(requestedLayout);
  persistItemSizes(sizes);
  renderAllNodesMenuScreen(lastFieldMap);
  focusEscControllerItem(itemId);
}

function activateEscControllerItem(itemId: string): void {
  const minimized = new Set(readMinimizedItems());
  if (minimized.has(itemId)) {
    minimized.delete(itemId);
    persistMinimizedItems(Array.from(minimized));
    renderAllNodesMenuScreen(lastFieldMap);
  }

  escControllerPreferredMode = "focus";
  setControllerMode("focus");
  focusEscControllerItem(itemId);
}

function handleEscControllerLayoutAction(action: string): boolean {
  const itemId = getEscControllerActiveItem();
  switch (action) {
    case "tabPrev":
    case "prevUnit":
      cycleEscControllerItem(-1);
      return true;
    case "tabNext":
    case "nextUnit":
      cycleEscControllerItem(1);
      return true;
    case "moveUp":
      moveEscControllerItemLayout(itemId, { gridY: -1 });
      return true;
    case "moveDown":
      moveEscControllerItemLayout(itemId, { gridY: 1 });
      return true;
    case "moveLeft":
      moveEscControllerItemLayout(itemId, { gridX: -1 });
      return true;
    case "moveRight":
      moveEscControllerItemLayout(itemId, { gridX: 1 });
      return true;
    case "zoomIn":
      moveEscControllerItemLayout(itemId, { colSpan: 1, rowSpan: 1 });
      return true;
    case "zoomOut":
      moveEscControllerItemLayout(itemId, { colSpan: -1, rowSpan: -1 });
      return true;
    case "confirm":
      activateEscControllerItem(itemId);
      return true;
    case "windowPrimary":
      toggleEscControllerItemMinimized(itemId);
      return true;
    case "windowSecondary":
      cycleEscControllerItemColor(itemId);
      return true;
    default:
      return false;
  }
}

function renderMinimapContent(isPinned: boolean): string {
  const model = resolveEscMinimapModel();
  const subtitle = model ? `${model.mapName} // ${model.width}x${model.height}` : "NO FIELD DATA AVAILABLE";
  return `
    <div class="all-nodes-item-shell all-nodes-item-shell--minimap">
      ${renderItemToolbar(MINIMAP_LAYOUT_ID, "minimap", { isPinned })}
      <section class="all-nodes-minimap-panel" aria-label="Field minimap">
        <div class="all-nodes-minimap-header">
          <div class="all-nodes-minimap-heading">
            <span class="all-nodes-minimap-kicker">MINIMAP</span>
            <span class="all-nodes-minimap-subtitle">${subtitle}</span>
          </div>
          ${model ? `<span class="all-nodes-minimap-readout">${model.discoveredCount} scan cells</span>` : ""}
        </div>
        <div class="all-nodes-minimap-frame">
          ${model
            ? `<canvas class="all-nodes-minimap-canvas" data-esc-minimap-canvas aria-label="Minimap canvas for ${model.mapName}"></canvas>`
            : `
              <div class="all-nodes-minimap-empty">
                <span class="all-nodes-minimap-empty-title">SCAN CACHE EMPTY</span>
                <span class="all-nodes-minimap-empty-text">Enter a field zone to initialize cartography data for this node.</span>
              </div>
            `}
        </div>
      </section>
      <button class="all-nodes-item-resize" type="button" data-resize-id="${MINIMAP_LAYOUT_ID}" aria-label="Resize minimap"></button>
    </div>
  `;
}

function drawEscMinimap(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>("[data-esc-minimap-canvas]");
  if (!canvas) {
    return;
  }
  drawFieldMinimapCanvas(canvas, resolveEscMinimapModel(), { transparent: false });
}

function renderDockItem(itemId: string, nodeMap: Map<string, NodeDefinition>): string {
  if (itemId === RESOURCE_LAYOUT_ID) {
    return `
      <button class="all-nodes-dock-item" type="button" data-restore-id="${itemId}" aria-label="Restore resource tracker">
        <span class="dock-icon">R</span>
        <span class="dock-label">BAL</span>
      </button>
    `;
  }

  if (itemId === QUAC_LAYOUT_ID) {
    return `
      <button class="all-nodes-dock-item all-nodes-dock-item--quac" type="button" data-restore-id="${itemId}" aria-label="Restore QUAC terminal">
        <span class="dock-icon">Q</span>
        <span class="dock-label">QUAC</span>
      </button>
    `;
  }

  if (itemId === NOTES_LAYOUT_ID) {
    return `
      <button class="all-nodes-dock-item" type="button" data-restore-id="${itemId}" aria-label="Restore operator notes">
        <span class="dock-icon">N</span>
        <span class="dock-label">NOTES</span>
      </button>
    `;
  }

  if (itemId === QUEST_TRACKER_LAYOUT_ID) {
    return `
      <button class="all-nodes-dock-item" type="button" data-restore-id="${itemId}" aria-label="Restore quest tracker">
        <span class="dock-icon">Q</span>
        <span class="dock-label">TRACK</span>
      </button>
    `;
  }

  if (itemId === MINIMAP_LAYOUT_ID) {
    return `
      <button class="all-nodes-dock-item" type="button" data-restore-id="${itemId}" aria-label="Restore minimap">
        <span class="dock-icon">M</span>
        <span class="dock-label">MAP</span>
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
  setMusicCue("haven-esc");
  const root = document.getElementById("app");
  if (!root) return;
  document.body.setAttribute("data-screen", "esc-all-nodes");
  clearControllerContext();

  cleanupAllNodesWindowListeners();
  ensureBaseCampLayoutVersion();
  ensureTheaterAutoTickStateSync();
  initializeQuestState();

  if (fromFieldMap) {
    lastFieldMap = fromFieldMap;
    setBaseCampFieldReturnMap(fromFieldMap);
  } else {
    lastFieldMap = lastFieldMap || getBaseCampFieldReturnMap();
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
  const pinned = new Set(readPinnedItems());
  const itemColors = readItemColorKeys();
  const activeLoadoutIndex = readActiveLoadoutIndex();
  const atlasFloorBypassEnabled = Boolean(state.uiLayout?.opsTerminalAtlasDebugFloorBypass);
  const campaignProgress = loadCampaignProgress();
  const outerDeckFieldContext = getOuterDeckFieldContext(lastFieldMap);
  const expeditionActive = outerDeckFieldContext === "outerDeckBranch";
  const returnToHavenAvailable = outerDeckFieldContext !== "haven";
  const buildModeUnlocked = lastFieldMap === "base_camp" && isHavenBuildModeUnlocked(campaignProgress);
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
          <h1 class="all-nodes-menu-title">External Signal Controller (E.S.C.)</h1>
          <p class="all-nodes-menu-subtitle">AERISS // PROFILE</p>
        </div>
        <div class="all-nodes-header-actions">
          <div class="all-nodes-view-switcher" aria-label="E.S.C. layout view switcher">
            <span class="all-nodes-view-switcher-label">VIEW</span>
            <button class="all-nodes-view-switcher-btn${activeLoadoutIndex === 0 ? " all-nodes-view-switcher-btn--active" : ""}" type="button" data-loadout-index="0">1</button>
            <span class="all-nodes-view-switcher-separator">|</span>
            <button class="all-nodes-view-switcher-btn${activeLoadoutIndex === 1 ? " all-nodes-view-switcher-btn--active" : ""}" type="button" data-loadout-index="1">2</button>
          </div>
        </div>
      </header>

      <div class="all-nodes-menu-grid town-screen__grid" id="allNodesMenuGrid">
        ${activeOrder.map((itemId) => {
          if (itemId === RESOURCE_LAYOUT_ID) {
            return `
              <div class="all-nodes-grid-item all-nodes-grid-item--resource" data-layout-id="${itemId}" ${renderItemThemeAttributes(itemId, itemColors)}>
                ${renderResourceTrackerContent(wad, res, pinned.has(itemId))}
              </div>
            `;
          }

          if (itemId === QUAC_LAYOUT_ID) {
            return `
              <div class="all-nodes-grid-item all-nodes-grid-item--quac" data-layout-id="${itemId}" ${renderItemThemeAttributes(itemId, itemColors)}>
                ${renderQuacContent(pinned.has(itemId))}
              </div>
            `;
          }

          if (itemId === NOTES_LAYOUT_ID) {
            return `
              <div class="all-nodes-grid-item all-nodes-grid-item--notes" data-layout-id="${itemId}" ${renderItemThemeAttributes(itemId, itemColors)}>
                ${renderNotesContent(pinned.has(itemId))}
              </div>
            `;
          }

          if (itemId === QUEST_TRACKER_LAYOUT_ID) {
            return `
              <div class="all-nodes-grid-item all-nodes-grid-item--quest-tracker" data-layout-id="${itemId}" ${renderItemThemeAttributes(itemId, itemColors)}>
                ${renderQuestTrackerContent(pinned.has(itemId))}
              </div>
            `;
          }

          if (itemId === MINIMAP_LAYOUT_ID) {
            return `
              <div class="all-nodes-grid-item all-nodes-grid-item--minimap" data-layout-id="${itemId}" ${renderItemThemeAttributes(itemId, itemColors)}>
                ${renderMinimapContent(pinned.has(itemId))}
              </div>
            `;
          }

          const node = nodeMap.get(itemId);
          if (!node) return "";

          return `
            <div class="all-nodes-grid-item" data-layout-id="${itemId}" ${renderItemThemeAttributes(itemId, itemColors)}>
              ${renderNodeContent(node, pinned.has(itemId))}
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
          <button class="all-nodes-debug-btn" data-action="debug-wad">
            <span class="debug-icon">ALL</span>
            <span class="debug-text">GIVE EVERYTHING</span>
          </button>
          <button class="all-nodes-debug-btn" data-action="debug-floor-12-status">
            <span class="debug-icon">F12</span>
            <span class="debug-text">SYNC FLOOR 12 STATUS</span>
          </button>
          <button class="all-nodes-debug-btn" data-action="debug-atlas-floor-bypass">
            <span class="debug-icon">FLR</span>
            <span class="debug-text">ATLAS NEXT FLOOR ${atlasFloorBypassEnabled ? "FREE" : "LOCKED"}</span>
          </button>
        </div>
        <div class="all-nodes-footer-actions">
          <div class="all-nodes-escape-hint">
            <span class="hint-key">[ESC]</span>
            <span class="hint-text">${expeditionActive ? "Return to Expedition" : "Return to Field"}</span>
          </div>
          ${returnToHavenAvailable ? `
            <button class="all-nodes-build-mode-btn" id="allNodesReturnHavenBtn" type="button">
              RETURN TO HAVEN
            </button>
          ` : ""}
          ${buildModeUnlocked ? `
            <button
              class="all-nodes-build-mode-btn"
              id="allNodesBuildModeBtn"
              type="button"
            >
              HAVEN BUILD MODE
            </button>
          ` : ""}
          <button class="all-nodes-quit-title-btn" id="allNodesQuitTitleBtn" type="button">
            QUIT TO TITLE SCREEN
          </button>
        </div>
      </footer>

      <div class="ard-ghost-text all-nodes-ghost">CHAOS_CORE.v0.12</div>
    </div>
  `;

  applyWorkspaceLayoutStyles(root);
  requestAnimationFrame(() => drawEscMinimap(root));
  queuePinnedItemFrameSync(root);
  attachAllNodesMenuListeners();
  attachNotesWidgetHandlers(root, {
    onStateChange: () => renderAllNodesMenuScreen(lastFieldMap),
  });
  updateFocusableElements();
  cleanupAllNodesControllerContext = registerControllerContext({
    id: "esc-all-nodes",
    defaultMode: escControllerPreferredMode,
    focusRoot: () => document.querySelector(".all-nodes-menu-screen"),
    defaultFocusSelector: 'button[data-action="ops-terminal"], .all-nodes-dock-item, #allNodesReturnHavenBtn, #allNodesQuitTitleBtn',
    onLayoutAction: handleEscControllerLayoutAction,
    onFocusAction: (action) => {
      if (action === "cancel") {
        const activeElement = document.activeElement as HTMLElement | null;
        if (
          activeElement instanceof HTMLInputElement
          || activeElement instanceof HTMLTextAreaElement
          || activeElement instanceof HTMLSelectElement
          || activeElement?.isContentEditable
        ) {
          activeElement.blur();
          return true;
        }

        handleModeSwitch("field");
        return true;
      }
      return false;
    },
    onModeChange: (mode) => {
      escControllerPreferredMode = mode;
      if (mode === "focus") {
        focusEscControllerItem(getEscControllerActiveItem());
      }
    },
    getDebugState: () => ({
      hovered: getEscControllerActiveItem(),
      window: getEscControllerActiveItem(),
      focus: getEscControllerActiveItem(),
    }),
  });
}

function attachAllNodesMenuListeners(): void {
  const root = document.getElementById("app");
  if (!root) return;

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
  root.querySelectorAll<HTMLElement>(".all-nodes-view-switcher-btn[data-loadout-index]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      const nextIndex = Number.parseInt(btn.dataset.loadoutIndex ?? "", 10);
      if (!Number.isFinite(nextIndex) || nextIndex === readActiveLoadoutIndex()) {
        return;
      }

      switchBaseCampLoadout(nextIndex);
      renderAllNodesMenuScreen();
    });
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

  root.querySelectorAll<HTMLElement>(".all-nodes-item-color[data-color-id]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const itemId = btn.dataset.colorId;
      if (!itemId) return;

      const colors = { ...readItemColorKeys() };
      const currentKey = getResolvedItemColorKey(itemId, colors);
      const currentIndex = BASE_CAMP_COLOR_THEME_KEYS.indexOf(currentKey);
      const nextKey = BASE_CAMP_COLOR_THEME_KEYS[(currentIndex + 1 + BASE_CAMP_COLOR_THEME_KEYS.length) % BASE_CAMP_COLOR_THEME_KEYS.length];
      colors[itemId] = nextKey;
      persistItemColorKeys(colors);
      renderAllNodesMenuScreen();
    });
  });

  root.querySelectorAll<HTMLElement>(".all-nodes-item-pin[data-pin-id]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const itemId = btn.dataset.pinId;
      if (!itemId) return;

      const pinned = new Set(readPinnedItems());
      if (pinned.has(itemId)) {
        pinned.delete(itemId);
      } else {
        pinned.add(itemId);
      }

      persistPinnedItems(Array.from(pinned));
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

  root.querySelectorAll<HTMLElement>("[data-refinery-craft-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const recipeId = button.dataset.refineryCraftId as AdvancedMaterialId | undefined;
      if (!recipeId) {
        return;
      }

      updateGameState((prev) => craftMaterialRefineryRecipe(prev, recipeId, getMaterialRefineryContext()));
      renderAllNodesMenuScreen(lastFieldMap);
      requestAnimationFrame(() => focusWorkspaceItem(MATERIALS_REFINERY_LAYOUT_ID));
    });
  });

  root.querySelectorAll<HTMLElement>("[data-resource-tracker-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      setExpandedResourceTrackerVisible(button.dataset.resourceTrackerToggle === "advanced");
      renderAllNodesMenuScreen(lastFieldMap);
      requestAnimationFrame(() => focusWorkspaceItem(RESOURCE_LAYOUT_ID));
    });
  });

  root.querySelectorAll<HTMLElement>("[data-theater-autotick-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setBaseCampTheaterAutoTickEnabled(button.dataset.theaterAutotickToggle === "on");
    });
  });

  attachPointerGridDrag(root);
  attachPointerResize(root);

  if (allNodesResizeHandler) {
    window.removeEventListener("resize", allNodesResizeHandler);
  }
  allNodesResizeHandler = () => {
    const appRoot = document.getElementById("app");
    if (!appRoot?.querySelector(".all-nodes-menu-screen")) {
      if (allNodesResizeHandler) {
        window.removeEventListener("resize", allNodesResizeHandler);
        allNodesResizeHandler = null;
      }
      return;
    }
    applyWorkspaceLayoutStyles(appRoot);
    queuePinnedItemFrameSync(appRoot);
  };
  window.addEventListener("resize", allNodesResizeHandler);

  root.querySelector<HTMLElement>("#allNodesMenuGrid")?.addEventListener("scroll", () => {
    queuePinnedItemFrameSync(root);
  }, { passive: true });

  root.querySelectorAll(".all-nodes-debug-btn[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const action = (btn as HTMLElement).dataset.action;
      if (action) {
        handleNodeAction(action);
      }
    });
  });

  root.querySelector<HTMLElement>("#allNodesBuildModeBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    if (!isHavenBuildModeUnlocked(loadCampaignProgress())) {
      showSystemPing({
        type: "info",
        title: "BUILD MODE LOCKED",
        message: `Discover Floor ${String(HAVEN_BUILD_MODE_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} to unlock HAVEN build mode.`,
        channel: "esc-build-mode",
      });
      return;
    }

    syncPinnedItemFrames(document);
    cleanupAllNodesWindowListeners();
    renderFieldScreen("base_camp", { openBuildMode: true });
  });

  root.querySelector<HTMLElement>("#allNodesReturnHavenBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    if (getOuterDeckFieldContext(lastFieldMap) === "outerDeckBranch") {
      const nextState = abortOuterDeckExpedition(getGameState());
      updateGameState(() => nextState);
    }
    setNextFieldSpawnOverrideTile("base_camp", OUTER_DECK_HAVEN_EXIT_SPAWN_TILE);
    cleanupAllNodesWindowListeners();
    renderFieldScreen("base_camp");
  });

  root.querySelector<HTMLElement>("#allNodesQuitTitleBtn")?.addEventListener("click", async (event) => {
    event.preventDefault();
    cleanupAllNodesWindowListeners();
    resetToNewGame();
    const { renderMainMenu } = await import("./MainMenuScreen");
    await renderMainMenu();
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

      if (isEscNodeAction(resolvedAction) && !isEscActionEnabled(resolvedAction, getEscAvailabilityContext())) {
        quacLastFeedback = getEscExpeditionRestrictionMessage(resolvedAction);
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

  if (allNodesEscHandler) {
    window.removeEventListener("keydown", allNodesEscHandler);
  }

  allNodesEscHandler = (e: KeyboardEvent) => {
    if (!document.querySelector(".all-nodes-menu-screen")) {
      if (allNodesEscHandler) {
        window.removeEventListener("keydown", allNodesEscHandler);
        allNodesEscHandler = null;
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      handleModeSwitch("field");
      if (allNodesEscHandler) {
        window.removeEventListener("keydown", allNodesEscHandler);
        allNodesEscHandler = null;
      }
    }
  };
  window.addEventListener("keydown", allNodesEscHandler);
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

      if (target.closest(".all-nodes-item-minimize, .all-nodes-item-color, .all-nodes-item-pin, .all-nodes-item-resize, .all-nodes-cli-form, .all-nodes-cli-input, .all-nodes-cli-submit, .all-nodes-cli-prompt, .notes-widget, .notes-widget button, .notes-widget input, .notes-widget textarea, .notes-widget label, .all-nodes-refinery-craft-btn, .all-nodes-theater-clock-toggle")) {
        return;
      }

      const pressedButton = target.closest<HTMLElement>(".all-nodes-node-btn[data-action]");
      const pressedAction = pressedButton?.dataset.action ?? null;
      const pressedDisabled = pressedButton?.hasAttribute("disabled") ?? false;
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      const draggedItem = wrapper;
      const draggedId = draggedItem.dataset.layoutId;
      if (!draggedId) return;

      const layoutOrder = Array.from(grid.querySelectorAll<HTMLElement>(".all-nodes-grid-item"))
        .map((item) => item.dataset.layoutId ?? "")
        .filter(Boolean);
      const sizes = { ...readItemSizes() };
      const initialLayouts = buildResolvedWorkspaceLayouts(layoutOrder, sizes, getGridMetrics(grid).columnCount);
      const initialLayout = initialLayouts.get(draggedId) ?? normalizeItemLayout(draggedId, sizes[draggedId], getGridMetrics(grid).columnCount);
      let started = false;
      let ghost: HTMLElement | null = null;
      let offsetX = 0;
      let offsetY = 0;
      let previewLayout = initialLayout;

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

        autoScrollGrid(grid, moveEvent.clientY);

        if (ghost) {
          ghost.style.left = `${moveEvent.clientX - offsetX}px`;
          ghost.style.top = `${moveEvent.clientY - offsetY}px`;
        }

        const proposed = getPointerGridPosition(
          grid,
          moveEvent.clientX - offsetX,
          moveEvent.clientY - offsetY,
          initialLayout.colSpan,
          initialLayout.rowSpan,
        );
        const resolvedPreview = buildResolvedWorkspaceLayouts(layoutOrder, sizes, getGridMetrics(grid).columnCount, {
          priorityItemId: draggedId,
          priorityLayout: proposed,
        });
        previewLayout = resolvedPreview.get(draggedId) ?? proposed;
        applyResolvedWorkspaceLayouts(grid, resolvedPreview);
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;

        if (started) {
          sizes[draggedId] = serializeItemLayout(previewLayout);
          persistItemSizes(sizes);
          cleanup();
          renderAllNodesMenuScreen();
          return;
        }

        cleanup();

        if (
          pressedAction &&
          !pressedDisabled &&
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
      const metrics = getGridMetrics(grid);
      const sizes = { ...readItemSizes() };
      const layoutOrder = Array.from(grid.querySelectorAll<HTMLElement>(".all-nodes-grid-item"))
        .map((item) => item.dataset.layoutId ?? "")
        .filter(Boolean);
      const initialLayouts = buildResolvedWorkspaceLayouts(layoutOrder, sizes, metrics.columnCount);
      const initialLayout = initialLayouts.get(itemId) ?? normalizeItemLayout(itemId, sizes[itemId], metrics.columnCount);
      let resizing = false;
      let previewLayout = initialLayout;

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

        const liveMetrics = getGridMetrics(grid);
        const spanDelta = Math.round(dx / Math.max(liveMetrics.trackWidth + liveMetrics.columnGap, 1));
        const rowDelta = Math.round(dy / Math.max(liveMetrics.rowHeight + liveMetrics.rowGap, 1));
        const proposed: WorkspaceItemLayout = {
          ...initialLayout,
          colSpan: clamp(initialLayout.colSpan + spanDelta, 1, liveMetrics.columnCount),
          rowSpan: Math.max(MIN_ITEM_ROW_SPAN, initialLayout.rowSpan + rowDelta),
        };

        const resolvedPreview = buildResolvedWorkspaceLayouts(layoutOrder, sizes, liveMetrics.columnCount, {
          priorityItemId: itemId,
          priorityLayout: proposed,
        });
        previewLayout = resolvedPreview.get(itemId) ?? proposed;
        applyResolvedWorkspaceLayouts(grid, resolvedPreview);
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;

        if (resizing) {
          sizes[itemId] = serializeItemLayout(previewLayout);
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

function getGridMetrics(grid: HTMLElement): GridMetrics {
  const computed = window.getComputedStyle(grid);
  const columnGap = parseFloat(computed.columnGap || "0") || 0;
  const rowGap = parseFloat(computed.rowGap || "0") || 0;
  const trackWidths = computed.gridTemplateColumns
    .split(" ")
    .map((token) => parseFloat(token))
    .filter((value) => Number.isFinite(value) && value > 0);

  const columnCount = Math.max(trackWidths.length, 1);
  const trackWidth = trackWidths[0] ?? 180;
  const rowHeight = parseFloat(computed.gridAutoRows || `${WORKSPACE_ROW_HEIGHT_PX}`) || WORKSPACE_ROW_HEIGHT_PX;
  return { columnCount, trackWidth, columnGap, rowGap, rowHeight };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isPointInsideRect(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function handleModeSwitch(mode: string | undefined): void {
  if (mode === "field") {
    syncPinnedItemFrames(document);
  }

  cleanupAllNodesWindowListeners();

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

async function handleNodeAction(action: string): Promise<void> {
  if (isEscNodeAction(action) && !isEscActionEnabled(action, getEscAvailabilityContext())) {
    showSystemPing({
      type: "info",
      title: "OUTER DECK EXPEDITION",
      message: getEscExpeditionRestrictionMessage(action),
      channel: "outer-deck-esc-lock",
      replaceChannel: true,
    });
    return;
  }

  if (
    isLockedHavenAnnexAction(action)
    || isLockedSchemaAction(action)
    || isLockedBlackMarketAction(action)
    || isLockedFoundryAnnexAction(action)
  ) {
    await showAlertDialog({
      title: "NODE LOCKED",
      message: getLockedActionMessage(action) ?? "This node is not unlocked yet.",
      mount: () => document.querySelector(".all-nodes-root"),
    });
    return;
  }

  if (action === MATERIALS_REFINERY_LAYOUT_ID) {
    revealWorkspaceItem(MATERIALS_REFINERY_LAYOUT_ID);
    showSystemPing({
      type: "info",
      title: "LIGHT CRAFTING",
      message: "Use the light crafting controls directly from E.S.C.",
      channel: "materials-refinery-inline",
      replaceChannel: true,
    });
    return;
  }

  if (action === THEATER_AUTO_TICK_LAYOUT_ID) {
    setBaseCampTheaterAutoTickEnabled(!isBaseCampTheaterAutoTickEnabled());
    return;
  }

  syncPinnedItemFrames(document);
  cleanupAllNodesWindowListeners();

  switch (action) {
    case "shop":
      import("./ShopScreen").then(({ renderShopScreen }) => {
        renderShopScreen("esc");
      });
      break;
    case "workshop":
      import("./GearWorkbenchScreen").then(({ renderGearWorkbenchScreen }) => {
        renderGearWorkbenchScreen(undefined, undefined, "esc");
      });
      break;
    case "roster":
      import("./RosterScreen").then(({ renderRosterScreen }) => {
        renderRosterScreen("esc");
      });
      break;
    case "loadout":
      import("./InventoryScreen").then(({ renderInventoryScreen }) => {
        renderInventoryScreen("esc");
      });
      break;
    case "inventory":
      import("./InventoryViewScreen").then(({ renderInventoryViewScreen }) => {
        renderInventoryViewScreen("esc");
      });
      break;
    case "quest-board":
      import("./QuestBoardScreen").then(({ renderQuestBoardScreen }) => {
        renderQuestBoardScreen("esc");
      });
      break;
    case "tavern":
      import("./TavernDialogueScreen").then(({ renderTavernDialogueScreen }) => {
        renderTavernDialogueScreen("base_camp_tavern", "Tavern", "esc");
      });
      break;
    case "ops-terminal":
      import("./OperationSelectScreen").then(({ renderOperationSelectScreen }) => {
        renderOperationSelectScreen("esc");
      });
      break;
    case "gear-workbench":
      import("./GearWorkbenchScreen").then(({ renderGearWorkbenchScreen }) => {
        const state = getGameState();
        const firstUnitId = state.partyUnitIds?.[0] ?? null;
        if (firstUnitId) {
          const unit = state.unitsById[firstUnitId];
          const weaponId = (unit as any)?.loadout?.primaryWeapon ?? null;
          renderGearWorkbenchScreen(firstUnitId, weaponId, "esc");
        } else {
          renderGearWorkbenchScreen(undefined, undefined, "esc");
        }
      });
      break;
    case "port":
      import("./PortScreen").then(({ renderPortScreen }) => {
        renderPortScreen("esc");
      });
      break;
    case "quarters":
      renderFieldScreen("quarters");
      break;
    case "stable":
      import("./StableScreen").then(({ renderStableScreen }) => {
        renderStableScreen("esc");
      });
      break;
    case "black-market":
      import("./BlackMarketScreen").then(({ renderBlackMarketScreen }) => {
        renderBlackMarketScreen("esc");
      });
      break;
    case "schema":
      import("./SchemaScreen").then(({ renderSchemaScreen }) => {
        renderSchemaScreen("esc");
      });
      break;
    case "foundry-annex":
      import("./FoundryAnnexScreen").then(({ renderFoundryAnnexScreen }) => {
        renderFoundryAnnexScreen("esc");
      });
      break;
    case "codex":
      import("./CodexScreen").then(({ renderCodexScreen }) => {
        renderCodexScreen("esc");
      });
      break;
    case "settings":
      import("./SettingsScreen").then(({ renderSettingsScreen }) => {
        renderSettingsScreen("esc");
      });
      break;
    case "comms-array":
      import("./CommsArrayScreen").then(({ renderCommsArrayScreen }) => {
        renderCommsArrayScreen("esc");
      });
      break;
    case "debug-wad":
      void grantEverythingToPlayer()
        .then(() => {
          renderAllNodesMenuScreen();
        })
        .catch((error) => {
          console.error("[ESC] Failed to grant debug inventory:", error);
          showSystemPing({
            type: "error",
            title: "DEBUG // GIVE EVERYTHING",
            message: "Grant failed.",
            detail: error instanceof Error ? error.message : "Unknown error.",
            channel: "esc-dev-debug",
          });
        });
      break;
    case "debug-atlas-floor-bypass":
      updateGameState((state) => ({
        ...state,
        uiLayout: {
          ...(state.uiLayout ?? {}),
          opsTerminalAtlasDebugFloorBypass: !Boolean(state.uiLayout?.opsTerminalAtlasDebugFloorBypass),
        },
      }));
      renderAllNodesMenuScreen();
      break;
    case "debug-floor-12-status":
      syncFloor12UnlockStatus();
      renderAllNodesMenuScreen();
      break;
  }
}

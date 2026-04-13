import {
  THEATER_CORE_BLUEPRINTS,
  ensureOperationHasTheater,
  formatTheaterKeyLabel,
  getTheaterCoreOfflineReason,
  getTheaterStarterResources,
  isTheaterCoreOperational,
} from "../../core/theaterSystem";
import {
  createOpsTerminalSectorOperation,
  getCurrentOpsTerminalAtlasFloor,
  getOpsTerminalAtlasCoreSummaries,
  getHighestGeneratedOpsTerminalAtlasFloorOrdinal,
  holdPositionInOpsTerminalAtlas,
  OpsTerminalAtlasCoreSummary,
  getOpsTerminalAtlasWarmEconomySummaries,
  loadOpsTerminalAtlasProgress,
  OpsTerminalAtlasEconomySummary,
  OPS_ATLAS_HAVEN_ANCHOR,
  OPS_ATLAS_MAP_HEIGHT,
  OPS_ATLAS_MAP_WIDTH,
  OpsTerminalAtlasFloorState,
  OpsTerminalAtlasSectorState,
  regenerateOpsTerminalAtlasFloor,
  restartOpsTerminalAtlas,
  setCurrentOpsTerminalAtlasFloorOrdinal,
} from "../../core/opsTerminalAtlas";
import {
  CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL,
  isFinalResetUnlocked,
  loadCampaignProgress,
  saveCampaignProgress,
  type CampaignProgress,
} from "../../core/campaign";
import {
  getActiveRegionPresentation,
  type ResolvedCampaignRegionPresentation,
} from "../../core/campaignRegions";
import { getNotesState, getStuckNotesForSurface } from "../../core/notesSystem";
import { CoreType, TheaterMapMode, TheaterRoom, TheaterSprawlDirection } from "../../core/types";
import { getGameState, updateGameState } from "../../state/gameStore";
import { showSystemPing } from "../components/systemPing";
import { setMusicCue } from "../../core/audioSystem";
import { attachNotesWidgetHandlers, attachStuckNoteHandlers, renderNotesWidget, renderStuckNotesLayer } from "../components/notesWidget";
import {
  enhanceTerminalUiButtons,
  startTerminalTypingByIds,
} from "../components/terminalFeedback";
import { showTutorialCallout } from "../components/tutorialCallout";
import { renderLoadoutScreen } from "./LoadoutScreen";
import {
  clearControllerContext,
  type ControllerMode,
  registerControllerContext,
  setControllerMode,
  updateFocusableElements,
} from "../../core/controllerSupport";
import {
  BaseCampReturnTo,
  getBaseCampReturnLabel,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";
import {
  createEmptyResourceWallet,
  getResourceEntries,
  RESOURCE_KEYS,
  type ResourceWallet,
} from "../../core/resources";
type AtlasViewportState = {
  panX: number;
  panY: number;
  zoom: number;
};

type AtlasWindowFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type AtlasDragSession = {
  mode: "drag" | "resize" | "map-pan";
  startX: number;
  startY: number;
  startFrame?: AtlasWindowFrame;
  windowKey?: AtlasFloatingWindowKey;
  startPanX?: number;
  startPanY?: number;
  moved?: boolean;
} | null;

type AtlasRoomView = {
  room: TheaterRoom;
  x: number;
  y: number;
  width: number;
  height: number;
};

type AtlasSectorView = {
  sector: OpsTerminalAtlasSectorState;
  color: string;
  glow: string;
  rooms: AtlasRoomView[];
  roomById: Map<string, AtlasRoomView>;
  roomCount: number;
  knownRoomCount: number;
  securedRooms: number;
  activeCores: number;
  currentState: "active" | "warm" | "cold" | "undiscovered";
  isSelected: boolean;
};

type FloorTravelDirection = "next" | "prev";
type AtlasFloatingWindowKey = "operations" | "economy" | "cores" | "notes";
type AtlasConfirmState =
  | {
    kind: "regen-floor";
    floorOrdinal: number;
  }
  | {
    kind: "reset-atlas";
  };

const ATLAS_HOTKEY_ID = "ops-terminal-atlas-screen";
const MAP_MIN_ZOOM = 0.36;
const MAP_MAX_ZOOM = 1.28;
const MAP_ZOOM_STEP = 0.12;
const MAP_KEY_PAN_SPEED = 16;
const MAP_FAST_PAN_MULTIPLIER = 2.4;
const MAP_STICK_PAN_SPEED = 18;
const MAP_STICK_DEADZONE = 0.18;
const DEFAULT_MAP_ZOOM = 0.56;
const WINDOW_MARGIN = 18;
const WINDOW_TOP_SAFE = 88;
const WINDOW_BOTTOM_SAFE = 24;
const WINDOW_MIN_WIDTH = 332;
const WINDOW_MIN_HEIGHT = 360;
const ECONOMY_WINDOW_MIN_WIDTH = 340;
const ECONOMY_WINDOW_MIN_HEIGHT = 240;
const CORE_WINDOW_MIN_WIDTH = 360;
const CORE_WINDOW_MIN_HEIGHT = 260;
const NOTES_WINDOW_MIN_WIDTH = 340;
const NOTES_WINDOW_MIN_HEIGHT = 250;
const HOLD_POSITION_TICK_MS = 5000;
const HAVEN_WIDTH = 320;
const HAVEN_HEIGHT = 196;
const HAVEN_TO_INGRESS_DISTANCE = 384;
const THEATER_DEPTH_STEP = 330;
const THEATER_LATERAL_STEP = 236;
const MAP_PAN_PADDING_X = 360;
const MAP_PAN_PADDING_Y = 320;
const FLOOR_TRANSITION_DURATION_MS = 420;
const MAP_DRAG_THRESHOLD_PX = 6;
const ATLAS_STICKY_NOTE_WIDTH = 248;
const ATLAS_STICKY_NOTE_HEIGHT = 220;
const OPS_TERMINAL_ATLAS_LAYOUT_VERSION = 2;
const SECTOR_COLORS = [
  { color: "#ffbf63", glow: "rgba(255, 191, 99, 0.24)" },
  { color: "#d5c0ff", glow: "rgba(213, 192, 255, 0.22)" },
  { color: "#79c7d8", glow: "rgba(121, 199, 216, 0.2)" },
  { color: "#9fe2b4", glow: "rgba(159, 226, 180, 0.2)" },
  { color: "#f4d48f", glow: "rgba(244, 212, 143, 0.22)" },
  { color: "#c1d88e", glow: "rgba(193, 216, 142, 0.2)" },
  { color: "#f2ae96", glow: "rgba(242, 174, 150, 0.22)" },
  { color: "#9cb7d9", glow: "rgba(156, 183, 217, 0.2)" },
];

const DIRECTION_ANGLE_MAP: Record<TheaterSprawlDirection, number> = {
  north: 270,
  northeast: 315,
  east: 0,
  southeast: 45,
  south: 90,
  southwest: 135,
  west: 180,
  northwest: 225,
};

const ATLAS_NOTES_WINDOW_COLOR_THEMES = [
  {
    key: "amber",
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
] as const;

const ATLAS_NOTES_WINDOW_COLOR_KEYS = ATLAS_NOTES_WINDOW_COLOR_THEMES.map((theme) => theme.key);
const ATLAS_NOTES_WINDOW_COLOR_THEME_MAP = new Map(
  ATLAS_NOTES_WINDOW_COLOR_THEMES.map((theme) => [theme.key, theme]),
);
type AtlasNotesWindowColorKey = typeof ATLAS_NOTES_WINDOW_COLOR_THEMES[number]["key"];

let atlasViewport: AtlasViewportState = {
  panX: 0,
  panY: 0,
  zoom: DEFAULT_MAP_ZOOM,
};
let atlasMapMode: TheaterMapMode = "comms";
let atlasWindowFrame: AtlasWindowFrame = {
  x: WINDOW_MARGIN,
  y: WINDOW_TOP_SAFE + 12,
  width: 396,
  height: 720,
};
let atlasEconomyWindowFrame: AtlasWindowFrame = {
  x: 0,
  y: 0,
  width: 380,
  height: 340,
};
let atlasCoreWindowFrame: AtlasWindowFrame = {
  x: 0,
  y: 0,
  width: 420,
  height: 360,
};
let atlasNotesWindowFrame: AtlasWindowFrame = {
  x: 0,
  y: 0,
  width: 380,
  height: 300,
};
let atlasNotesWindowMinimized = true;
let atlasNotesWindowColor: AtlasNotesWindowColorKey = "steel";
let selectedTheaterId: string | null = null;
let currentReturnTo: BaseCampReturnTo = "basecamp";
let cleanupOperationSelectScreen: ((options?: { preserveHoldWait?: boolean }) => void) | null = null;
let cleanupOperationSelectControllerContext: (() => void) | null = null;
let activeDragSession: AtlasDragSession = null;
let dragMoveHandler: ((event: MouseEvent) => void) | null = null;
let dragUpHandler: (() => void) | null = null;
let rootClickHandler: ((event: MouseEvent) => void) | null = null;
let rootMouseDownHandler: ((event: MouseEvent) => void) | null = null;
let surfaceWheelHandler: ((event: WheelEvent) => void) | null = null;
let resizeHandler: (() => void) | null = null;
let mapKeyHandler: ((event: KeyboardEvent) => void) | null = null;
let mapKeyUpHandler: ((event: KeyboardEvent) => void) | null = null;
let mapPanFrameId: number | null = null;
let floorTransitionTimerId: number | null = null;
let floorTransitionInFlight = false;
let pendingFloorArrivalDirection: FloorTravelDirection | null = null;
let suppressNextAtlasClick = false;
const mapPanKeys = new Set<string>();
let atlasHoldTimerId: number | null = null;
let atlasHoldActive = false;
let currentAtlasContentBounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
let currentAtlasNotesStickyTarget: { surfaceType: "atlas"; surfaceId: string; x: number; y: number } | undefined;
let atlasControllerPreferredMode: ControllerMode = "cursor";
let atlasControllerActiveWindowKey: AtlasFloatingWindowKey = "operations";
let atlasConfirmState: AtlasConfirmState | null = null;

type AtlasRenderPayload = {
  floor: OpsTerminalAtlasFloorState;
  highestGeneratedFloorOrdinal: number;
  warmEconomySummaries: OpsTerminalAtlasEconomySummary[];
  coreSummaries: OpsTerminalAtlasCoreSummary[];
};

function isAtlasDebugFloorBypassEnabled(): boolean {
  return Boolean(getGameState().uiLayout?.opsTerminalAtlasDebugFloorBypass);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAtlasRegionThemeStyle(regionPresentation: ResolvedCampaignRegionPresentation): string {
  const { theme } = regionPresentation;
  return [
    `--opsatlas-region-root-glow:${theme.rootGlow}`,
    `--opsatlas-region-root-top:${theme.rootTop}`,
    `--opsatlas-region-root-bottom:${theme.rootBottom}`,
    `--opsatlas-region-surface-glow:${theme.surfaceGlow}`,
    `--opsatlas-region-surface-top:${theme.surfaceTop}`,
    `--opsatlas-region-surface-bottom:${theme.surfaceBottom}`,
    `--opsatlas-region-accent:${theme.accent}`,
    `--opsatlas-region-accent-soft:${theme.accentSoft}`,
    `--opsatlas-region-accent-strong:${theme.accentStrong}`,
    `--opsatlas-region-panel-border:${theme.panelBorder}`,
    `--opsatlas-region-panel-top:${theme.panelTop}`,
    `--opsatlas-region-panel-bottom:${theme.panelBottom}`,
    `--opsatlas-region-banner-top:${theme.bannerTop}`,
    `--opsatlas-region-banner-bottom:${theme.bannerBottom}`,
    `--opsatlas-region-banner-border:${theme.bannerBorder}`,
    `--opsatlas-region-text-strong:${theme.textStrong}`,
    `--opsatlas-region-text-muted:${theme.textMuted}`,
  ].join(";");
}

function renderRegionActiveBanner(regionPresentation: ResolvedCampaignRegionPresentation): string {
  return `
    <section class="opsatlas-region-banner" aria-label="Active campaign region">
      <div class="opsatlas-region-banner__kicker">REGION ACTIVE // ${escapeHtml(regionPresentation.regionName.toUpperCase())}</div>
      <div class="opsatlas-region-banner__header">
        <div>
          <h2>${escapeHtml(regionPresentation.regionName)} Region</h2>
          <div class="opsatlas-region-banner__meta">
            <span>Floor ${String(regionPresentation.floorOrdinal).padStart(2, "0")}</span>
            <span>${escapeHtml(regionPresentation.variantLabel)}</span>
            <span>${escapeHtml(regionPresentation.factionTag)}</span>
          </div>
        </div>
        <div class="opsatlas-region-banner__badge">${escapeHtml(regionPresentation.mechanicLabel)}</div>
      </div>
      <p class="opsatlas-region-banner__copy">${escapeHtml(regionPresentation.ruleSummary)}</p>
      <div class="opsatlas-region-banner__rewards">
        <span>Region Drops</span>
        <strong>${escapeHtml(regionPresentation.rewardPreview.join(" / "))}</strong>
      </div>
    </section>
  `;
}

function mergeTheaterStarterReserve(
  currentResources: ResourceWallet,
): ResourceWallet {
  const reserve = getTheaterStarterResources();
  const merged = createEmptyResourceWallet();
  RESOURCE_KEYS.forEach((key) => {
    merged[key] = Math.max(currentResources[key], reserve[key]);
  });
  return merged;
}

function formatSectorState(state: AtlasSectorView["currentState"]): string {
  switch (state) {
    case "warm":
      return "WARM";
    case "cold":
      return "COLD";
    case "undiscovered":
      return "UNDISCOVERED";
    case "active":
    default:
      return "ACTIVE";
  }
}

function buildAtlasRenderPayload(progress: CampaignProgress = loadOpsTerminalAtlasProgress()): AtlasRenderPayload {
  const floor = getCurrentOpsTerminalAtlasFloor(progress);
  return {
    floor,
    highestGeneratedFloorOrdinal: getHighestGeneratedOpsTerminalAtlasFloorOrdinal(progress),
    warmEconomySummaries: getOpsTerminalAtlasWarmEconomySummaries(floor.floorOrdinal, progress),
    coreSummaries: getOpsTerminalAtlasCoreSummaries(floor.floorOrdinal, progress),
  };
}

function loadAtlasRenderPayload(): AtlasRenderPayload {
  try {
    return buildAtlasRenderPayload();
  } catch (error) {
    console.error("[OPS ATLAS] initial load failed, resetting atlas state", error);
    const progress = loadCampaignProgress();
    saveCampaignProgress({
      ...progress,
      opsTerminalAtlas: undefined,
    });
    const recovered = loadOpsTerminalAtlasProgress();
    return buildAtlasRenderPayload(recovered);
  }
}

function getMapModeLabel(mode: TheaterMapMode): string {
  switch (mode) {
    case "command":
      return "Command";
    case "supply":
      return "Supply";
    case "power":
      return "Power";
    case "comms":
    default:
      return "Comms";
  }
}

function formatCoreTypeLabel(coreType: CoreType): string {
  return THEATER_CORE_BLUEPRINTS[coreType]?.displayName
    ?? String(coreType).replace(/_/g, " ").toUpperCase();
}

function formatCoreOfflineReason(reason: OpsTerminalAtlasCoreSummary["offlineReason"]): string {
  switch (reason) {
    case "low_power":
      return "Low Wattage";
    case "low_comms":
      return "Low Comms";
    case "low_supply":
      return "Low Supply";
    case "damaged":
      return "Damaged";
    default:
      return "Online";
  }
}

function getAtlasCoreFieldSeed(theaterId: string, roomId: string): number {
  const token = `${theaterId}:${roomId}:atlas-core-field`;
  return token.split("").reduce((seed, char, index) => (
    ((seed * 31) + char.charCodeAt(0) + index) >>> 0
  ), 2903);
}

function isRoomVisible(sector: OpsTerminalAtlasSectorState, room: TheaterRoom): boolean {
  return room.secured || room.intelLevel > 0 || room.id === sector.theater.currentRoomId;
}

function hasDetailedRoomIntel(room: TheaterRoom): boolean {
  return room.secured || room.intelLevel >= 2;
}

function hasAtlasFloorKey(sector: OpsTerminalAtlasSectorState, keyType: TheaterRoom["requiredKeyType"]): boolean {
  if (!keyType) {
    return true;
  }
  return Boolean(sector.theater.definition.floorKeyInventory?.[keyType]);
}

function formatRoomStatus(sector: OpsTerminalAtlasSectorState, room: TheaterRoom): string {
  if (!hasDetailedRoomIntel(room)) {
    return room.commsLinked ? "TRACKED" : "SIGNAL ECHO";
  }
  if (room.requiredKeyType && !hasAtlasFloorKey(sector, room.requiredKeyType)) {
    return "LOCKED";
  }
  if (room.secured) {
    return "SECURED";
  }
  if (room.status === "mapped") {
    return "MAPPED";
  }
  return "UNKNOWN";
}

function getRoomDisplayName(sector: OpsTerminalAtlasSectorState, room: TheaterRoom): string {
  if (!hasDetailedRoomIntel(room)) {
    return room.commsLinked ? "TRACKED CONTACT" : "UNKNOWN CONTACT";
  }
  return room.isUplinkRoom ? sector.zoneName : room.label;
}

function getLinkModeStateForMode(
  mode: Exclude<TheaterMapMode, "command">,
  fromRoom: TheaterRoom,
  toRoom: TheaterRoom,
): { className: string; online: boolean; cut: boolean } {
  switch (mode) {
    case "supply": {
      const online = fromRoom.supplyFlow >= 50 && toRoom.supplyFlow >= 50;
      return {
        className: "opsatlas-link--supply",
        online,
        cut: !online,
      };
    }
    case "power": {
      const online = fromRoom.powerFlow > 0 && toRoom.powerFlow > 0;
      return {
        className: "opsatlas-link--power",
        online,
        cut: !online,
      };
    }
    case "comms":
    default: {
      const online = fromRoom.commsLinked && toRoom.commsLinked;
      return {
        className: "opsatlas-link--comms",
        online,
        cut: !online,
      };
    }
  }
}

function getLinkRenderStates(
  fromRoom: TheaterRoom,
  toRoom: TheaterRoom,
): Array<{ className: string; online: boolean; cut: boolean; offset: number }> {
  if (atlasMapMode === "command") {
    return [
      { ...getLinkModeStateForMode("supply", fromRoom, toRoom), offset: -8 },
      { ...getLinkModeStateForMode("power", fromRoom, toRoom), offset: 0 },
      { ...getLinkModeStateForMode("comms", fromRoom, toRoom), offset: 8 },
    ];
  }

  return [{ ...getLinkModeStateForMode(atlasMapMode, fromRoom, toRoom), offset: 0 }];
}

function getOffsetLineCoordinates(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offset: number,
): { x1: number; y1: number; x2: number; y2: number } {
  if (offset === 0) {
    return { x1, y1, x2, y2 };
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / length;
  const ny = dx / length;

  return {
    x1: x1 + (nx * offset),
    y1: y1 + (ny * offset),
    x2: x2 + (nx * offset),
    y2: y2 + (ny * offset),
  };
}

function getRoomFootprint(room: TheaterRoom): { width: number; height: number } {
  if (room.isUplinkRoom) {
    return { width: 196, height: 86 };
  }
  if (room.tags.includes("objective")) {
    return { width: 174, height: 82 };
  }
  if (room.tags.includes("elite")) {
    return { width: 164, height: 80 };
  }
  return { width: 150, height: 74 };
}

function getDirectionVectors(direction: TheaterSprawlDirection): {
  forward: { x: number; y: number };
  lateral: { x: number; y: number };
} {
  const radians = (DIRECTION_ANGLE_MAP[direction] * Math.PI) / 180;
  const forward = {
    x: Math.cos(radians),
    y: Math.sin(radians),
  };
  return {
    forward,
    lateral: {
      x: -forward.y,
      y: forward.x,
    },
  };
}

function projectRoomToAtlas(
  sector: OpsTerminalAtlasSectorState,
  room: TheaterRoom,
): { x: number; y: number } {
  const { forward, lateral } = getDirectionVectors(sector.sprawlDirection);
  const depth = Math.max(0, room.localPosition.x);
  const widening = 0.92 + (depth * 0.24);
  const forwardDistance = HAVEN_TO_INGRESS_DISTANCE + (depth * THEATER_DEPTH_STEP);
  const lateralDistance = room.localPosition.y * THEATER_LATERAL_STEP * widening;

  return {
    x: Math.round(
      OPS_ATLAS_HAVEN_ANCHOR.x
      + (forward.x * forwardDistance)
      + (lateral.x * lateralDistance),
    ),
    y: Math.round(
      OPS_ATLAS_HAVEN_ANCHOR.y
      + (forward.y * forwardDistance)
      + (lateral.y * lateralDistance),
    ),
  };
}

function buildSectorView(sector: OpsTerminalAtlasSectorState, isSelected: boolean, index: number): AtlasSectorView {
  const palette = SECTOR_COLORS[index % SECTOR_COLORS.length] ?? SECTOR_COLORS[0];
  const rooms = Object.values(sector.theater.rooms)
    .map((room) => {
      const position = projectRoomToAtlas(sector, room);
      const footprint = getRoomFootprint(room);
      return {
        room,
        x: position.x,
        y: position.y,
        width: footprint.width,
        height: footprint.height,
      };
    })
    .sort((left, right) => left.room.depthFromUplink - right.room.depthFromUplink);

  const roomById = new Map(rooms.map((room) => [room.room.id, room]));
  const knownRoomCount = rooms.filter((room) => isRoomVisible(sector, room.room)).length;
  const securedRooms = rooms.filter((room) => room.room.secured).length;
  const activeCores = rooms.filter((room) => isTheaterCoreOperational(room.room)).length;
  const currentState = sector.theater.definition.currentState;

  return {
    sector,
    color: palette.color,
    glow: palette.glow,
    rooms,
    roomById,
    roomCount: rooms.length,
    knownRoomCount,
    securedRooms,
    activeCores,
    currentState,
    isSelected,
  };
}

function resolveSelectedTheaterId(floor: OpsTerminalAtlasFloorState): string {
  const activeSector = floor.sectors.find((sector) => sector.theater.definition.currentState === "active");
  if (activeSector) {
    return activeSector.theaterId;
  }

  const saved = getGameState().uiLayout?.atlasSelectedTheaterId;
  if (saved && floor.sectors.some((sector) => sector.theaterId === saved)) {
    return saved;
  }

  const firstIncomplete = floor.sectors.find((sector) => !sector.theater.objectiveComplete);
  return firstIncomplete?.theaterId ?? floor.sectors[0]?.theaterId ?? "";
}

function getDefaultWindowFrame(): AtlasWindowFrame {
  const width = Math.min(420, Math.max(WINDOW_MIN_WIDTH, Math.round(window.innerWidth * 0.28)));
  const maxHeight = Math.max(WINDOW_MIN_HEIGHT, window.innerHeight - WINDOW_TOP_SAFE);
  const height = clampNumber(
    Math.round(window.innerHeight * 0.5),
    WINDOW_MIN_HEIGHT,
    maxHeight,
  );

  return {
    x: 0,
    y: Math.max(WINDOW_TOP_SAFE, window.innerHeight - height),
    width,
    height,
  };
}

function getDefaultEconomyWindowFrame(): AtlasWindowFrame {
  const width = Math.min(400, Math.max(ECONOMY_WINDOW_MIN_WIDTH, Math.round(window.innerWidth * 0.24)));
  const height = Math.min(
    Math.max(ECONOMY_WINDOW_MIN_HEIGHT, Math.round(window.innerHeight * 0.26)),
    Math.round(window.innerHeight * 0.42),
  );

  return {
    x: Math.max(WINDOW_MARGIN, window.innerWidth - width - WINDOW_MARGIN),
    y: WINDOW_TOP_SAFE + 128,
    width,
    height,
  };
}

function getDefaultCoreWindowFrame(): AtlasWindowFrame {
  const width = Math.min(440, Math.max(CORE_WINDOW_MIN_WIDTH, Math.round(window.innerWidth * 0.26)));
  const height = Math.min(
    Math.max(CORE_WINDOW_MIN_HEIGHT, Math.round(window.innerHeight * 0.3)),
    Math.round(window.innerHeight * 0.46),
  );

  return {
    x: Math.max(WINDOW_MARGIN, window.innerWidth - width - WINDOW_MARGIN),
    y: WINDOW_TOP_SAFE + 128 + atlasEconomyWindowFrame.height + 18,
    width,
    height,
  };
}

function getDefaultNotesWindowFrame(): AtlasWindowFrame {
  const width = Math.min(420, Math.max(NOTES_WINDOW_MIN_WIDTH, Math.round(window.innerWidth * 0.24)));
  const height = Math.min(
    Math.max(NOTES_WINDOW_MIN_HEIGHT, Math.round(window.innerHeight * 0.28)),
    Math.round(window.innerHeight * 0.4),
  );

  return {
    x: Math.max(WINDOW_MARGIN, window.innerWidth - width - WINDOW_MARGIN),
    y: Math.max(WINDOW_TOP_SAFE, window.innerHeight - height - WINDOW_BOTTOM_SAFE - 110),
    width,
    height,
  };
}

function getAtlasWindowElement(key: AtlasFloatingWindowKey): HTMLElement | null {
  if (key === "economy") {
    return document.getElementById("opsAtlasEconomyWindow") as HTMLElement | null;
  }
  if (key === "cores") {
    return document.getElementById("opsAtlasCoreWindow") as HTMLElement | null;
  }
  if (key === "notes") {
    return document.getElementById("opsAtlasNotesWindow") as HTMLElement | null;
  }
  return document.getElementById("opsAtlasWindow") as HTMLElement | null;
}

function applyAtlasViewportToDom(): void {
  const surface = document.getElementById("opsAtlasSurface") as HTMLElement | null;
  const world = document.getElementById("opsAtlasWorld") as HTMLElement | null;
  if (!surface || !world) {
    return;
  }
  applyMapTransform(surface, world);
  const root = document.getElementById("app");
  if (root) {
    updateZoomDisplay(root);
  }
}

function setAtlasZoom(nextZoom: number): void {
  atlasViewport.zoom = clampNumber(nextZoom, MAP_MIN_ZOOM, MAP_MAX_ZOOM);
  applyAtlasViewportToDom();
  persistUiLayout();
}

function cycleAtlasMapMode(step: 1 | -1): void {
  const modes: TheaterMapMode[] = ["command", "supply", "power", "comms"];
  const currentIndex = Math.max(0, modes.indexOf(atlasMapMode));
  atlasMapMode = modes[(currentIndex + step + modes.length) % modes.length] ?? "comms";
  persistUiLayout();
  renderOperationSelectScreen(currentReturnTo);
}

function getAtlasSectorAnchor(view: AtlasSectorView): { x: number; y: number } {
  const anchorRoom = view.rooms.find((room) => room.room.id === view.sector.theater.currentRoomId)
    ?? view.rooms.find((room) => room.room.isUplinkRoom)
    ?? view.rooms[0];

  return {
    x: anchorRoom?.x ?? OPS_ATLAS_HAVEN_ANCHOR.x,
    y: anchorRoom?.y ?? OPS_ATLAS_HAVEN_ANCHOR.y,
  };
}

function moveAtlasSectorSelectionByDirection(
  direction: "up" | "down" | "left" | "right",
  sectorViews: AtlasSectorView[],
): void {
  if (sectorViews.length <= 0) {
    return;
  }

  const currentView = sectorViews.find((view) => view.sector.theaterId === selectedTheaterId) ?? sectorViews[0];
  if (!currentView) {
    return;
  }

  const anchor = getAtlasSectorAnchor(currentView);
  let bestView: AtlasSectorView | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  sectorViews.forEach((candidate) => {
    if (candidate.sector.theaterId === currentView.sector.theaterId) {
      return;
    }

    const candidateAnchor = getAtlasSectorAnchor(candidate);
    const dx = candidateAnchor.x - anchor.x;
    const dy = candidateAnchor.y - anchor.y;

    if (direction === "up" && dy >= -4) return;
    if (direction === "down" && dy <= 4) return;
    if (direction === "left" && dx >= -4) return;
    if (direction === "right" && dx <= 4) return;

    const primary = direction === "left" || direction === "right" ? Math.abs(dx) : Math.abs(dy);
    const secondary = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = primary + (secondary * 0.35);

    if (score < bestScore) {
      bestScore = score;
      bestView = candidate;
    }
  });

  const nextView = bestView
    ?? sectorViews
      .filter((candidate) => candidate.sector.theaterId !== currentView.sector.theaterId)
      .sort((left, right) => {
        const leftAnchor = getAtlasSectorAnchor(left);
        const rightAnchor = getAtlasSectorAnchor(right);
        const leftDistance = Math.abs(leftAnchor.x - anchor.x) + Math.abs(leftAnchor.y - anchor.y);
        const rightDistance = Math.abs(rightAnchor.x - anchor.x) + Math.abs(rightAnchor.y - anchor.y);
        return leftDistance - rightDistance;
      })[0];

  if (!nextView || nextView.sector.theaterId === selectedTheaterId) {
    return;
  }

  selectedTheaterId = nextView.sector.theaterId;
  persistUiLayout();
  renderOperationSelectScreen(currentReturnTo);
}

function focusAtlasControllerWindow(key: AtlasFloatingWindowKey): void {
  atlasControllerActiveWindowKey = key;
  requestAnimationFrame(() => {
    if (key === "notes" && atlasNotesWindowMinimized) {
      document.querySelector<HTMLElement>("[data-atlas-notes-restore]")?.focus();
      updateFocusableElements();
      return;
    }

    const windowEl = getAtlasWindowElement(key);
    const focusTarget = windowEl?.querySelector<HTMLElement>("button, input, textarea, [tabindex]");
    focusTarget?.focus();
    updateFocusableElements();
  });
}

function cycleAtlasControllerWindow(step: 1 | -1): void {
  const order: AtlasFloatingWindowKey[] = ["operations", "economy", "cores", "notes"];
  const currentIndex = Math.max(0, order.indexOf(atlasControllerActiveWindowKey));
  atlasControllerActiveWindowKey = order[(currentIndex + step + order.length) % order.length] ?? "operations";
  focusAtlasControllerWindow(atlasControllerActiveWindowKey);
}

function moveAtlasWindowFrameByController(
  key: AtlasFloatingWindowKey,
  delta: { x?: number; y?: number; width?: number; height?: number },
): void {
  if (key === "notes" && atlasNotesWindowMinimized) {
    return;
  }

  const current = getWindowFrame(key);
  const next = clampWindowFrame({
    x: current.x + (delta.x ?? 0),
    y: current.y + (delta.y ?? 0),
    width: current.width + (delta.width ?? 0),
    height: current.height + (delta.height ?? 0),
  }, key);

  setWindowFrame(key, next);
  const windowEl = getAtlasWindowElement(key);
  if (windowEl) {
    applyWindowFrame(windowEl, key);
  }
  persistUiLayout();
}

function openAtlasConfirm(state: AtlasConfirmState): void {
  atlasConfirmState = state;
  renderOperationSelectScreen(currentReturnTo);
}

function dismissAtlasConfirm(): void {
  atlasConfirmState = null;
  renderOperationSelectScreen(currentReturnTo);
}

function resolveAtlasConfirm(): void {
  const confirmation = atlasConfirmState;
  atlasConfirmState = null;
  if (!confirmation) {
    return;
  }

  if (confirmation.kind === "regen-floor") {
    stopAtlasHoldWait();
    persistUiLayout();
    regenerateOpsTerminalAtlasFloor(confirmation.floorOrdinal);
    showSystemPing({
      type: "success",
      title: "A.T.L.A.S. FLOOR REGENERATED",
      message: `Floor ${String(confirmation.floorOrdinal).padStart(2, "0")} has been rerolled from a new survey seed.`,
      channel: "ops-terminal-atlas",
    });
    renderOperationSelectScreen(currentReturnTo);
    return;
  }

  stopAtlasHoldWait();
  persistUiLayout();
  restartOpsTerminalAtlas();
  showSystemPing({
    type: "success",
    title: "A.T.L.A.S. RESTARTED",
    message: "The active dungeon survey has been fully regenerated from Floor 01. Master unlock progression remains intact.",
    channel: "ops-terminal-atlas",
  });
  renderOperationSelectScreen(currentReturnTo);
}

function renderAtlasConfirmModal(): string {
  if (!atlasConfirmState) {
    return "";
  }

  const title = atlasConfirmState.kind === "regen-floor" ? "REGENERATE FLOOR" : "RESET A.T.L.A.S.";
  const message = atlasConfirmState.kind === "regen-floor"
    ? `Regenerate Floor ${String(atlasConfirmState.floorOrdinal).padStart(2, "0")} with a new survey seed?`
    : "Completely regenerate the atlas and restart from Floor 01? Permanent floor unlocks will be preserved.";
  const confirmLabel = atlasConfirmState.kind === "regen-floor" ? "REGENERATE" : "RESET";

  return `
    <div class="opsatlas-modal-backdrop" id="opsAtlasConfirmModal">
      <div class="opsatlas-modal" role="dialog" aria-modal="true" aria-labelledby="opsAtlasConfirmTitle">
        <div class="opsatlas-modal__header">
          <div class="opsatlas-modal__kicker">A.T.L.A.S. // CONFIRM ACTION</div>
          <h2 id="opsAtlasConfirmTitle">${escapeHtml(title)}</h2>
        </div>
        <p class="opsatlas-modal__copy">${escapeHtml(message)}</p>
        <div class="opsatlas-modal__actions">
          <button
            class="opsatlas-modal__btn opsatlas-modal__btn--primary"
            type="button"
            id="opsAtlasConfirmAcceptBtn"
            data-atlas-confirm-action="accept"
            data-controller-default-focus="true"
          >
            ${escapeHtml(confirmLabel)}
          </button>
          <button
            class="opsatlas-modal__btn"
            type="button"
            id="opsAtlasConfirmCancelBtn"
            data-atlas-confirm-action="cancel"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  `;
}

function handleAtlasControllerAction(
  action: string,
  sectorViews: AtlasSectorView[],
  mode: ControllerMode,
): boolean {
  if (mode === "layout") {
    switch (action) {
      case "tabPrev":
      case "prevUnit":
        cycleAtlasControllerWindow(-1);
        return true;
      case "tabNext":
      case "nextUnit":
        cycleAtlasControllerWindow(1);
        return true;
      case "moveUp":
        moveAtlasWindowFrameByController(atlasControllerActiveWindowKey, { y: -28 });
        return true;
      case "moveDown":
        moveAtlasWindowFrameByController(atlasControllerActiveWindowKey, { y: 28 });
        return true;
      case "moveLeft":
        moveAtlasWindowFrameByController(atlasControllerActiveWindowKey, { x: -28 });
        return true;
      case "moveRight":
        moveAtlasWindowFrameByController(atlasControllerActiveWindowKey, { x: 28 });
        return true;
      case "zoomIn":
        moveAtlasWindowFrameByController(atlasControllerActiveWindowKey, { width: 28, height: 22 });
        return true;
      case "zoomOut":
        moveAtlasWindowFrameByController(atlasControllerActiveWindowKey, { width: -28, height: -22 });
        return true;
      case "confirm":
        setControllerMode("focus");
        focusAtlasControllerWindow(atlasControllerActiveWindowKey);
        return true;
      case "windowPrimary":
        if (atlasControllerActiveWindowKey === "notes") {
          atlasNotesWindowMinimized = !atlasNotesWindowMinimized;
          persistUiLayout();
          renderOperationSelectScreen(currentReturnTo);
          return true;
        }
        setControllerMode("focus");
        focusAtlasControllerWindow(atlasControllerActiveWindowKey);
        return true;
      case "windowSecondary":
        if (atlasControllerActiveWindowKey === "notes") {
          cycleAtlasNotesWindowColor();
          persistUiLayout();
          renderOperationSelectScreen(currentReturnTo);
          return true;
        }
        return false;
      default:
        return false;
    }
  }

  if (mode === "cursor") {
    switch (action) {
      case "moveUp":
        moveAtlasSectorSelectionByDirection("up", sectorViews);
        return true;
      case "moveDown":
        moveAtlasSectorSelectionByDirection("down", sectorViews);
        return true;
      case "moveLeft":
        moveAtlasSectorSelectionByDirection("left", sectorViews);
        return true;
      case "moveRight":
        moveAtlasSectorSelectionByDirection("right", sectorViews);
        return true;
      case "confirm": {
        const deployButton = selectedTheaterId
          ? document.querySelector<HTMLElement>(`[data-atlas-deploy="${selectedTheaterId}"]:not([disabled])`)
          : null;
        if (deployButton) {
          deployButton.click();
          return true;
        }
        const selectionTarget = selectedTheaterId
          ? document.querySelector<HTMLElement>(`[data-atlas-select-sector="${selectedTheaterId}"]`)
          : null;
        selectionTarget?.click();
        return true;
      }
      case "tabPrev":
      case "prevUnit":
        cycleAtlasMapMode(-1);
        return true;
      case "tabNext":
      case "nextUnit":
        cycleAtlasMapMode(1);
        return true;
      case "zoomIn":
        setAtlasZoom(atlasViewport.zoom + MAP_ZOOM_STEP);
        return true;
      case "zoomOut":
        setAtlasZoom(atlasViewport.zoom - MAP_ZOOM_STEP);
        return true;
      case "cancel":
        setControllerMode("focus");
        updateFocusableElements();
        return true;
      default:
        return false;
    }
  }

  return false;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampWindowFrame(
  frame: AtlasWindowFrame,
  key: AtlasFloatingWindowKey = "operations",
): AtlasWindowFrame {
  const minWidth = key === "economy"
    ? ECONOMY_WINDOW_MIN_WIDTH
    : key === "cores"
      ? CORE_WINDOW_MIN_WIDTH
      : key === "notes"
        ? NOTES_WINDOW_MIN_WIDTH
      : WINDOW_MIN_WIDTH;
  const minHeight = key === "economy"
    ? ECONOMY_WINDOW_MIN_HEIGHT
    : key === "cores"
      ? CORE_WINDOW_MIN_HEIGHT
      : key === "notes"
        ? NOTES_WINDOW_MIN_HEIGHT
      : WINDOW_MIN_HEIGHT;
  const horizontalMargin = key === "operations" ? 0 : WINDOW_MARGIN;
  const bottomSafe = key === "operations" ? 0 : WINDOW_BOTTOM_SAFE;
  const maxWidth = Math.max(minWidth, window.innerWidth - (horizontalMargin * 2));
  const maxHeight = Math.max(minHeight, window.innerHeight - WINDOW_TOP_SAFE - bottomSafe);
  const width = clampNumber(frame.width, minWidth, maxWidth);
  const height = clampNumber(frame.height, minHeight, maxHeight);
  const x = clampNumber(frame.x, horizontalMargin, Math.max(horizontalMargin, window.innerWidth - width - horizontalMargin));
  const y = clampNumber(frame.y, WINDOW_TOP_SAFE, Math.max(WINDOW_TOP_SAFE, window.innerHeight - height - bottomSafe));
  return { x, y, width, height };
}

function getWindowFrame(key: AtlasFloatingWindowKey): AtlasWindowFrame {
  if (key === "economy") {
    return atlasEconomyWindowFrame;
  }
  if (key === "cores") {
    return atlasCoreWindowFrame;
  }
  if (key === "notes") {
    return atlasNotesWindowFrame;
  }
  return atlasWindowFrame;
}

function setWindowFrame(key: AtlasFloatingWindowKey, frame: AtlasWindowFrame): void {
  if (key === "economy") {
    atlasEconomyWindowFrame = frame;
    return;
  }
  if (key === "cores") {
    atlasCoreWindowFrame = frame;
    return;
  }
  if (key === "notes") {
    atlasNotesWindowFrame = frame;
    return;
  }
  atlasWindowFrame = frame;
}

function getAtlasNotesWindowColorKey(): AtlasNotesWindowColorKey {
  return ATLAS_NOTES_WINDOW_COLOR_THEME_MAP.has(atlasNotesWindowColor)
    ? atlasNotesWindowColor
    : "steel";
}

function getAtlasNotesWindowThemeStyle(): string {
  const colorKey = getAtlasNotesWindowColorKey();
  const theme = ATLAS_NOTES_WINDOW_COLOR_THEME_MAP.get(colorKey) ?? ATLAS_NOTES_WINDOW_COLOR_THEMES[0];
  return Object.entries(theme.vars)
    .map(([cssVar, value]) => `${cssVar}: ${value}`)
    .join("; ");
}

function cycleAtlasNotesWindowColor(): void {
  const currentKey = getAtlasNotesWindowColorKey();
  const currentIndex = ATLAS_NOTES_WINDOW_COLOR_KEYS.indexOf(currentKey);
  atlasNotesWindowColor = ATLAS_NOTES_WINDOW_COLOR_KEYS[
    (currentIndex + 1 + ATLAS_NOTES_WINDOW_COLOR_KEYS.length) % ATLAS_NOTES_WINDOW_COLOR_KEYS.length
  ];
}

function hydrateUiLayout(floor: OpsTerminalAtlasFloorState): void {
  const layout = getGameState().uiLayout;
  const viewport = layout?.opsTerminalAtlasViewport;
  const atlasLayoutVersion = Number(layout?.opsTerminalAtlasLayoutVersion ?? 0);
  atlasViewport = {
    panX: viewport?.panX ?? 0,
    panY: viewport?.panY ?? 0,
    zoom: clampNumber(viewport?.zoom ?? DEFAULT_MAP_ZOOM, MAP_MIN_ZOOM, MAP_MAX_ZOOM),
  };
  atlasMapMode = layout?.opsTerminalAtlasMapMode ?? "comms";
  atlasWindowFrame = clampWindowFrame(
    atlasLayoutVersion < OPS_TERMINAL_ATLAS_LAYOUT_VERSION
      ? getDefaultWindowFrame()
      : (layout?.opsTerminalAtlasWindowFrame ?? getDefaultWindowFrame()),
    "operations",
  );
  atlasEconomyWindowFrame = clampWindowFrame(layout?.opsTerminalAtlasEconomyWindowFrame ?? getDefaultEconomyWindowFrame(), "economy");
  atlasCoreWindowFrame = clampWindowFrame(layout?.opsTerminalAtlasCoreWindowFrame ?? getDefaultCoreWindowFrame(), "cores");
  atlasNotesWindowFrame = clampWindowFrame(layout?.opsTerminalAtlasNotesWindowFrame ?? getDefaultNotesWindowFrame(), "notes");
  atlasNotesWindowMinimized = layout?.opsTerminalAtlasNotesWindowFrame?.minimized ?? true;
  const savedNotesColor = layout?.opsTerminalAtlasNotesWindowColor as AtlasNotesWindowColorKey | undefined;
  atlasNotesWindowColor = savedNotesColor && ATLAS_NOTES_WINDOW_COLOR_THEME_MAP.has(savedNotesColor)
    ? savedNotesColor
    : "steel";
  selectedTheaterId = resolveSelectedTheaterId(floor);
}

function persistUiLayout(): void {
  updateGameState((prev) => ({
    ...prev,
    uiLayout: {
      ...(prev.uiLayout ?? {}),
      atlasSelectedTheaterId: selectedTheaterId ?? prev.uiLayout?.atlasSelectedTheaterId,
      opsTerminalAtlasViewport: {
        panX: atlasViewport.panX,
        panY: atlasViewport.panY,
        zoom: atlasViewport.zoom,
      },
      opsTerminalAtlasMapMode: atlasMapMode,
      opsTerminalAtlasLayoutVersion: OPS_TERMINAL_ATLAS_LAYOUT_VERSION,
      opsTerminalAtlasWindowFrame: {
        x: atlasWindowFrame.x,
        y: atlasWindowFrame.y,
        width: atlasWindowFrame.width,
        height: atlasWindowFrame.height,
      },
      opsTerminalAtlasEconomyWindowFrame: {
        x: atlasEconomyWindowFrame.x,
        y: atlasEconomyWindowFrame.y,
        width: atlasEconomyWindowFrame.width,
        height: atlasEconomyWindowFrame.height,
      },
      opsTerminalAtlasCoreWindowFrame: {
        x: atlasCoreWindowFrame.x,
        y: atlasCoreWindowFrame.y,
        width: atlasCoreWindowFrame.width,
        height: atlasCoreWindowFrame.height,
      },
      opsTerminalAtlasNotesWindowFrame: {
        x: atlasNotesWindowFrame.x,
        y: atlasNotesWindowFrame.y,
        width: atlasNotesWindowFrame.width,
        height: atlasNotesWindowFrame.height,
        minimized: atlasNotesWindowMinimized,
      },
      opsTerminalAtlasNotesWindowColor: atlasNotesWindowColor,
    },
  }));
}

function triggerFloorTransition(direction: FloorTravelDirection, currentFloorOrdinal: number): void {
  if (floorTransitionInFlight) {
    return;
  }

  const targetFloorOrdinal = direction === "next"
    ? currentFloorOrdinal + 1
    : Math.max(1, currentFloorOrdinal - 1);

  if (targetFloorOrdinal === currentFloorOrdinal) {
    return;
  }

  const root = document.querySelector<HTMLElement>(".opsatlas-root");
  const world = document.getElementById("opsAtlasWorld");
  if (!root || !world) {
    return;
  }

  floorTransitionInFlight = true;
  mapPanKeys.clear();
  persistUiLayout();
  root.classList.add("opsatlas-root--transitioning");
  world.classList.add(direction === "next" ? "opsatlas-world--depart-next" : "opsatlas-world--depart-prev");

  if (floorTransitionTimerId !== null) {
    window.clearTimeout(floorTransitionTimerId);
  }

  floorTransitionTimerId = window.setTimeout(() => {
    floorTransitionTimerId = null;
    pendingFloorArrivalDirection = direction;

    try {
      setCurrentOpsTerminalAtlasFloorOrdinal(
        targetFloorOrdinal,
        loadOpsTerminalAtlasProgress(),
        isAtlasDebugFloorBypassEnabled(),
      );
      floorTransitionInFlight = false;
      renderOperationSelectScreen(currentReturnTo);
    } catch (error) {
      floorTransitionInFlight = false;
      pendingFloorArrivalDirection = null;
      root.classList.remove("opsatlas-root--transitioning");
      world.classList.remove("opsatlas-world--depart-next", "opsatlas-world--depart-prev");
      console.error("[OPS ATLAS] floor transition failed", error);
      alert(error instanceof Error ? error.message : "Floor transit failed. Please try again.");
    }
  }, FLOOR_TRANSITION_DURATION_MS);
}

function teardownOperationSelectScreen(options?: { preserveHoldWait?: boolean }): void {
  if (cleanupOperationSelectScreen) {
    cleanupOperationSelectScreen(options);
    cleanupOperationSelectScreen = null;
  }
}

function getMapPanBounds(surface: HTMLElement): { minX: number; maxX: number; minY: number; maxY: number } {
  const width = surface.clientWidth || window.innerWidth;
  const height = surface.clientHeight || window.innerHeight;
  const marginX = 72;
  const marginY = 72;
  const bounds = currentAtlasContentBounds;
  if (!bounds) {
    const fallbackMaxX = Math.max(MAP_PAN_PADDING_X, ((OPS_ATLAS_MAP_WIDTH * atlasViewport.zoom) - width) / 2 + MAP_PAN_PADDING_X);
    const fallbackMaxY = Math.max(MAP_PAN_PADDING_Y, ((OPS_ATLAS_MAP_HEIGHT * atlasViewport.zoom) - height) / 2 + MAP_PAN_PADDING_Y);
    return {
      minX: -fallbackMaxX,
      maxX: fallbackMaxX,
      minY: -fallbackMaxY,
      maxY: fallbackMaxY,
    };
  }

  const centerX = OPS_ATLAS_MAP_WIDTH / 2;
  const centerY = OPS_ATLAS_MAP_HEIGHT / 2;
  const minPanX = (width - marginX) - (width / 2) - ((bounds.maxX - centerX) * atlasViewport.zoom);
  const maxPanX = marginX - (width / 2) - ((bounds.minX - centerX) * atlasViewport.zoom);
  const minPanY = (height - marginY) - (height / 2) - ((bounds.maxY - centerY) * atlasViewport.zoom);
  const maxPanY = marginY - (height / 2) - ((bounds.minY - centerY) * atlasViewport.zoom);

  if (minPanX > maxPanX || minPanY > maxPanY) {
    const centeredPanX = (centerX - ((bounds.minX + bounds.maxX) / 2)) * atlasViewport.zoom;
    const centeredPanY = (centerY - ((bounds.minY + bounds.maxY) / 2)) * atlasViewport.zoom;
    return {
      minX: centeredPanX,
      maxX: centeredPanX,
      minY: centeredPanY,
      maxY: centeredPanY,
    };
  }

  return {
    minX: minPanX,
    maxX: maxPanX,
    minY: minPanY,
    maxY: maxPanY,
  };
}

function applyMapTransform(surface: HTMLElement, world: HTMLElement): void {
  const bounds = getMapPanBounds(surface);
  atlasViewport.panX = clampNumber(atlasViewport.panX, Math.min(bounds.minX, bounds.maxX), Math.max(bounds.minX, bounds.maxX));
  atlasViewport.panY = clampNumber(atlasViewport.panY, Math.min(bounds.minY, bounds.maxY), Math.max(bounds.minY, bounds.maxY));
  world.style.transform = `translate(calc(-50% + ${atlasViewport.panX}px), calc(-50% + ${atlasViewport.panY}px)) scale(${atlasViewport.zoom})`;
}

function applyWindowFrame(windowEl: HTMLElement, key: AtlasFloatingWindowKey): void {
  const nextFrame = clampWindowFrame(getWindowFrame(key), key);
  setWindowFrame(key, nextFrame);
  windowEl.style.left = `${nextFrame.x}px`;
  windowEl.style.top = `${nextFrame.y}px`;
  windowEl.style.width = `${nextFrame.width}px`;
  windowEl.style.height = `${nextFrame.height}px`;
}

function updateZoomDisplay(root: HTMLElement): void {
  const label = root.querySelector<HTMLElement>("#opsAtlasZoomValue");
  if (label) {
    label.textContent = `${Math.round(atlasViewport.zoom * 100)}%`;
  }
}

function readGamepadPanDelta(): { dx: number; dy: number } {
  if (typeof navigator.getGamepads !== "function") {
    return { dx: 0, dy: 0 };
  }

  const pad = Array.from(navigator.getGamepads()).find((candidate) => candidate && candidate.connected);
  if (!pad) {
    return { dx: 0, dy: 0 };
  }

  const axisX = Math.abs(pad.axes[2] ?? 0) >= MAP_STICK_DEADZONE ? (pad.axes[2] ?? 0) : 0;
  const axisY = Math.abs(pad.axes[3] ?? 0) >= MAP_STICK_DEADZONE ? (pad.axes[3] ?? 0) : 0;

  return {
    dx: -axisX * MAP_STICK_PAN_SPEED,
    dy: -axisY * MAP_STICK_PAN_SPEED,
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }

  return (
    element instanceof HTMLInputElement
    || element instanceof HTMLTextAreaElement
    || element instanceof HTMLSelectElement
    || element.isContentEditable
  );
}

function startAtlasSectorOperation(theaterId: string): void {
  const operation = ensureOperationHasTheater(createOpsTerminalSectorOperation(theaterId));
  if (!operation) {
    alert("Sector operation could not be prepared.");
    return;
  }

  persistUiLayout();
  updateGameState((prev) => ({
    ...prev,
    operation,
    phase: "loadout",
    resources: mergeTheaterStarterReserve(prev.resources),
  }));

  teardownOperationSelectScreen();
  renderLoadoutScreen();
}

function renderSectorCard(view: AtlasSectorView): string {
  const { sector } = view;
  const regionPresentation = getActiveRegionPresentation(sector.floorOrdinal);
  const stateLabel = formatSectorState(view.currentState);
  const deployLabel = sector.theater.objectiveComplete
    ? "REDEPLOY"
    : view.securedRooms > 1
      ? "RESUME DEPLOY"
      : "DEPLOY";

  return `
    <article
      class="opsatlas-sector-card ${view.isSelected ? "opsatlas-sector-card--selected" : ""}"
      data-atlas-select-sector="${escapeHtml(sector.theaterId)}"
      style="--ops-sector-color:${view.color};--ops-sector-glow:${view.glow};"
    >
      <div class="opsatlas-sector-card__header">
        <div class="opsatlas-sector-card__header-copy">
          <div class="opsatlas-sector-card__kicker">${escapeHtml(sector.sectorLabel)} // FLOOR ${String(sector.floorOrdinal).padStart(2, "0")}</div>
          <h3>${escapeHtml(sector.zoneName)}</h3>
          <div class="opsatlas-sector-card__region">${escapeHtml(regionPresentation.regionName.toUpperCase())} // ${escapeHtml(regionPresentation.variantLabel.toUpperCase())}</div>
        </div>
        <span class="opsatlas-sector-card__state opsatlas-sector-card__state--${view.currentState}">
          ${stateLabel}
        </span>
      </div>

      <div class="opsatlas-sector-card__stats">
        <div class="opsatlas-sector-card__stat">
          <span>Recommended PWR</span>
          <strong>${sector.theater.definition.recommendedPWR}</strong>
        </div>
        <div class="opsatlas-sector-card__stat">
          <span>Secured Rooms</span>
          <strong>${view.securedRooms} / ${view.roomCount}</strong>
        </div>
        <div class="opsatlas-sector-card__stat">
          <span>Known Nodes</span>
          <strong>${view.knownRoomCount} / ${view.roomCount}</strong>
        </div>
        <div class="opsatlas-sector-card__stat">
          <span>Active C.O.R.E.s</span>
          <strong>${view.activeCores}</strong>
        </div>
        <div class="opsatlas-sector-card__stat">
          <span>Threat Level</span>
          <strong>${escapeHtml(sector.threatLevel.toUpperCase())}</strong>
        </div>
        <div class="opsatlas-sector-card__stat">
          <span>Operation Status</span>
          <strong>${sector.theater.definition.operationAvailable ? "AVAILABLE" : "OFFLINE"}</strong>
        </div>
      </div>

      <p class="opsatlas-sector-card__passive">${escapeHtml(sector.passiveEffectText)}</p>

      <div class="opsatlas-sector-card__footer">
        <button
          class="opsatlas-sector-card__deploy"
          type="button"
          data-atlas-deploy="${escapeHtml(sector.theaterId)}"
          ${sector.theater.definition.operationAvailable ? "" : "disabled"}
        >
          ${deployLabel} ->
        </button>
      </div>
    </article>
  `;
}

function formatEconomyIncome(summary: OpsTerminalAtlasEconomySummary): string {
  const parts = getResourceEntries(summary.incomePerTick).map((entry) => `${entry.abbreviation} +${entry.amount}`);

  return parts.length > 0 ? parts.join(" / ") : "No passive income";
}

function renderEconomyWindowRows(summaries: OpsTerminalAtlasEconomySummary[]): string {
  if (summaries.length === 0) {
    return `
      <div class="opsatlas-economy-empty">
        No active or warm theaters with upkeep or passive income are online on this floor yet. Deploy into another sector to establish parallel theater economy.
      </div>
    `;
  }

  return summaries.map((summary) => `
    <button
      class="opsatlas-economy-row"
      type="button"
      data-atlas-select-sector="${escapeHtml(summary.theaterId)}"
    >
      <div class="opsatlas-economy-row__header">
        <div>
          <div class="opsatlas-economy-row__title">${escapeHtml(summary.zoneName)}</div>
          <div class="opsatlas-economy-row__meta">${escapeHtml(summary.sectorLabel)} // ${escapeHtml(formatSectorState(summary.currentState))} // TICKS ${summary.tickCount}</div>
        </div>
        <div class="opsatlas-economy-row__wad">${summary.wadUpkeepPerTick} WAD/TICK</div>
      </div>
      <div class="opsatlas-economy-row__income">${escapeHtml(formatEconomyIncome(summary))}</div>
    </button>
  `).join("");
}

function renderCoreWindowRows(summaries: OpsTerminalAtlasCoreSummary[]): string {
  if (summaries.length === 0) {
    return `
      <div class="opsatlas-economy-empty">
        No built C.O.R.E.s are recorded on this floor yet. Secure a room and assign a facility to bring it into the atlas ledger.
      </div>
    `;
  }

  return summaries.map((summary) => {
    const blueprint = THEATER_CORE_BLUEPRINTS[summary.coreType];
    const incomeSummary = formatEconomyIncome({
      theaterId: summary.theaterId,
      floorId: summary.floorId,
      floorOrdinal: summary.floorOrdinal,
      sectorLabel: summary.sectorLabel,
      zoneName: summary.zoneName,
      currentState: summary.currentState,
      tickCount: 0,
      wadUpkeepPerTick: summary.wadUpkeepPerTick,
      incomePerTick: summary.incomePerTick,
    });
    return `
      <article class="opsatlas-core-row">
        <div class="opsatlas-core-row__header">
          <div>
            <div class="opsatlas-core-row__title">${escapeHtml(summary.roomLabel)}</div>
            <div class="opsatlas-core-row__meta">${escapeHtml(summary.zoneName)} // ${escapeHtml(summary.sectorLabel)} // ${escapeHtml(formatCoreTypeLabel(summary.coreType))}</div>
          </div>
          <div class="opsatlas-core-row__state opsatlas-core-row__state--${summary.operational ? "online" : "offline"}">
            ${summary.operational ? "ONLINE" : escapeHtml(formatCoreOfflineReason(summary.offlineReason))}
          </div>
        </div>
        <div class="opsatlas-core-row__copy">${escapeHtml(blueprint?.description ?? "No description available.")}</div>
        <div class="opsatlas-core-row__stats">
          <span>${summary.supplyFlow} CR</span>
          <span>${summary.powerFlow} W</span>
          <span>${summary.commsFlow} BW</span>
          <span>${summary.wadUpkeepPerTick} WAD/TICK</span>
        </div>
        <div class="opsatlas-core-row__income">${escapeHtml(incomeSummary)}</div>
        <div class="opsatlas-core-row__actions">
          <button
            class="opsatlas-core-row__inspect"
            type="button"
            data-atlas-core-field="${escapeHtml(summary.theaterId)}::${escapeHtml(summary.roomId)}"
          >
            Enter Field Map
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function getAtlasContentBounds(
  sectorViews: AtlasSectorView[],
  floorId?: string,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const initial = {
    minX: OPS_ATLAS_HAVEN_ANCHOR.x - HAVEN_WIDTH / 2,
    maxX: OPS_ATLAS_HAVEN_ANCHOR.x + HAVEN_WIDTH / 2,
    minY: OPS_ATLAS_HAVEN_ANCHOR.y - HAVEN_HEIGHT / 2,
    maxY: OPS_ATLAS_HAVEN_ANCHOR.y + HAVEN_HEIGHT / 2,
  };
  const rawBounds = sectorViews.reduce((bounds, sector) => {
    sector.rooms.forEach((room) => {
      if (!isRoomVisible(sector.sector, room.room)) {
        return;
      }
      bounds.minX = Math.min(bounds.minX, room.x - room.width / 2);
      bounds.maxX = Math.max(bounds.maxX, room.x + room.width / 2);
      bounds.minY = Math.min(bounds.minY, room.y - room.height / 2);
      bounds.maxY = Math.max(bounds.maxY, room.y + room.height / 2);
    });
    return bounds;
  }, initial);

  if (floorId) {
    const notesState = getNotesState(getGameState());
    getStuckNotesForSurface(notesState, "atlas", floorId).forEach((tab) => {
      const anchor = tab.stickyAnchor;
      if (!anchor) {
        return;
      }

      rawBounds.minX = Math.min(rawBounds.minX, anchor.x);
      rawBounds.maxX = Math.max(rawBounds.maxX, anchor.x + ATLAS_STICKY_NOTE_WIDTH);
      rawBounds.minY = Math.min(rawBounds.minY, anchor.y);
      rawBounds.maxY = Math.max(rawBounds.maxY, anchor.y + ATLAS_STICKY_NOTE_HEIGHT);
    });
  }

  return {
    minX: rawBounds.minX - MAP_PAN_PADDING_X,
    maxX: rawBounds.maxX + MAP_PAN_PADDING_X,
    minY: rawBounds.minY - MAP_PAN_PADDING_Y,
    maxY: rawBounds.maxY + MAP_PAN_PADDING_Y,
  };
}

function clearAtlasHoldTimer(): void {
  if (atlasHoldTimerId !== null) {
    window.clearTimeout(atlasHoldTimerId);
    atlasHoldTimerId = null;
  }
}

function stopAtlasHoldWait(): void {
  clearAtlasHoldTimer();
  atlasHoldActive = false;
}

function renderSectorLinks(view: AtlasSectorView): string {
  const links = new Set<string>();
  return view.rooms.flatMap((roomView) => (
    roomView.room.adjacency
      .map((targetId) => {
        const target = view.roomById.get(targetId);
        if (!target) {
          return "";
        }
        if (!isRoomVisible(view.sector, roomView.room) || !isRoomVisible(view.sector, target.room)) {
          return "";
        }

        const linkKey = [roomView.room.id, targetId].sort().join("::");
        if (links.has(linkKey)) {
          return "";
        }
        links.add(linkKey);

        const modeStates = getLinkRenderStates(roomView.room, target.room);
        const fogged = !hasDetailedRoomIntel(roomView.room) || !hasDetailedRoomIntel(target.room);

        return modeStates.map((modeState) => {
          const coordinates = getOffsetLineCoordinates(
            roomView.x,
            roomView.y,
            target.x,
            target.y,
            modeState.offset,
          );
          return `
            <line
              class="opsatlas-link ${modeState.className} ${modeState.online ? "opsatlas-link--online" : "opsatlas-link--cut"} ${fogged ? "opsatlas-link--fogged" : ""} ${view.isSelected ? "opsatlas-link--selected" : ""} ${atlasMapMode === "command" ? "opsatlas-link--command" : ""}"
              x1="${coordinates.x1}"
              y1="${coordinates.y1}"
              x2="${coordinates.x2}"
              y2="${coordinates.y2}"
              pathLength="1"
              style="--ops-depth:${Math.max(roomView.room.depthFromUplink, target.room.depthFromUplink)};--ops-sector-color:${view.color};"
            ></line>
          `;
        }).join("");
      })
  )).join("");
}

function renderRoomNode(view: AtlasSectorView, roomView: AtlasRoomView): string {
  const room = roomView.room;
  if (!isRoomVisible(view.sector, room)) {
    return "";
  }

  const detailedIntel = hasDetailedRoomIntel(room);
  const displayName = getRoomDisplayName(view.sector, room);
  const status = formatRoomStatus(view.sector, room);
  const classes = [
    "opsatlas-room",
    `opsatlas-room--${room.secured ? "secured" : (detailedIntel ? room.status : "unknown")}`,
    view.isSelected ? "opsatlas-room--selected-sector" : "opsatlas-room--dimmed",
    room.id === view.sector.theater.currentRoomId ? "opsatlas-room--current" : "",
    detailedIntel && room.tags.includes("objective") ? "opsatlas-room--objective" : "",
    detailedIntel && room.tags.includes("elite") ? "opsatlas-room--elite" : "",
    detailedIntel && room.isUplinkRoom ? "opsatlas-room--uplink" : "",
    detailedIntel && room.requiredKeyType && !hasAtlasFloorKey(view.sector, room.requiredKeyType) ? "opsatlas-room--locked" : "",
    !detailedIntel ? "opsatlas-room--intel-low" : "",
  ].filter(Boolean).join(" ");
  const metaLabel = detailedIntel ? room.sectorTag : "UNK";
  const roomBadges = detailedIntel
    ? [
      room.requiredKeyType
        ? `<span class="opsatlas-room__badge opsatlas-room__badge--lock">${escapeHtml(formatTheaterKeyLabel(room.requiredKeyType))} ${hasAtlasFloorKey(view.sector, room.requiredKeyType) ? "OPEN" : "LOCK"}</span>`
        : "",
      room.grantsKeyType
        ? `<span class="opsatlas-room__badge opsatlas-room__badge--key">${escapeHtml(formatTheaterKeyLabel(room.grantsKeyType))} ${room.keyCollected ? "RECOVERED" : "CACHE"}</span>`
        : "",
    ].filter(Boolean).join("")
    : "";
  const fortificationMarkers = detailedIntel
    ? [
        ...Array.from({ length: room.fortificationPips.barricade }, (_, index) => `
      <span class="opsatlas-room-fort-marker opsatlas-room-fort-marker--barricade" title="Barricade ${index + 1}"></span>
      `),
      ...Array.from({ length: room.fortificationPips.powerRail }, (_, index) => `
      <span class="opsatlas-room-fort-marker opsatlas-room-fort-marker--power" title="Power Rail ${index + 1}"></span>
      `),
      ].join("")
    : "";
  const lowPowerWarning = detailedIntel
    && room.coreAssignment
    && !isTheaterCoreOperational(room)
    && getTheaterCoreOfflineReason(room) === "low_power"
    ? `
      <span class="opsatlas-room-warning ${roomView.x > OPS_ATLAS_HAVEN_ANCHOR.x ? "opsatlas-room-warning--left" : "opsatlas-room-warning--right"}">
        LOW WATTAGE
      </span>
    `
    : "";

  return `
    <button
      type="button"
      class="${classes}"
      data-atlas-select-sector="${escapeHtml(view.sector.theaterId)}"
      title="${escapeHtml(view.sector.zoneName)} // ${escapeHtml(displayName)} // ${status}"
      style="
        left:${roomView.x - (roomView.width / 2)}px;
        top:${roomView.y - (roomView.height / 2)}px;
        width:${roomView.width}px;
        height:${roomView.height}px;
        --ops-sector-color:${view.color};
        --ops-sector-glow:${view.glow};
        --ops-depth:${room.depthFromUplink};
      "
    >
      <span class="opsatlas-room__title">${escapeHtml(displayName)}</span>
      <span class="opsatlas-room__meta">${escapeHtml(metaLabel)} // ${status}</span>
      ${roomBadges ? `
        <span class="opsatlas-room__badges">
          ${roomBadges}
        </span>
      ` : ""}
      ${fortificationMarkers ? `
        <span class="opsatlas-room-fort-markers" aria-hidden="true">
          ${fortificationMarkers}
        </span>
      ` : ""}
      ${lowPowerWarning}
    </button>
  `;
}

function getAtlasNotesStickyTarget(
  floor: OpsTerminalAtlasFloorState,
  sectorViews: AtlasSectorView[],
): { surfaceType: "atlas"; surfaceId: string; x: number; y: number } {
  const selectedView = sectorViews.find((view) => view.sector.theaterId === selectedTheaterId) ?? sectorViews[0];
  const anchorRoom = selectedView?.rooms.find((room) => room.room.id === selectedView.sector.theater.currentRoomId)
    ?? selectedView?.rooms.find((room) => room.room.isUplinkRoom)
    ?? selectedView?.rooms[0];

  if (!anchorRoom) {
    return {
      surfaceType: "atlas",
      surfaceId: floor.floorId,
      x: OPS_ATLAS_HAVEN_ANCHOR.x + 190,
      y: OPS_ATLAS_HAVEN_ANCHOR.y - 96,
    };
  }

  return {
    surfaceType: "atlas",
    surfaceId: floor.floorId,
    x: anchorRoom.x + Math.max(34, anchorRoom.width * 0.42),
    y: anchorRoom.y - Math.max(78, anchorRoom.height * 0.88),
  };
}

function renderAtlasNotesWindow(): string {
  if (atlasNotesWindowMinimized) {
    return "";
  }

  return `
    <section
      class="opsatlas-window opsatlas-window--notes"
      id="opsAtlasNotesWindow"
      data-opsatlas-window-root="notes"
      data-color-key="${escapeHtml(getAtlasNotesWindowColorKey())}"
      style="${getAtlasNotesWindowThemeStyle()}"
    >
      <header class="opsatlas-window__header opsatlas-window__header--notes" data-opsatlas-drag-handle="true" data-opsatlas-window-key="notes">
        <div class="opsatlas-window__hint">Drag to move // Resize from corner</div>
        <div class="opsatlas-window__actions">
          <div class="opsatlas-window__grip" aria-hidden="true">::</div>
          <button class="opsatlas-window__color" type="button" data-atlas-notes-color="true" aria-label="Change notes window color">
            <span class="opsatlas-window__color-dot" aria-hidden="true"></span>
          </button>
          <button class="opsatlas-window__minimize" type="button" data-atlas-notes-minimize="true" aria-label="Minimize field memos">_</button>
        </div>
      </header>

      <div class="opsatlas-window__body opsatlas-window__body--notes">
        <section class="all-nodes-notes-panel" aria-label="Field memos" data-ez-drag-disable="true">
          <div class="all-nodes-notes-panel__title">FIELD MEMOS</div>
          ${renderNotesWidget("atlas-notes", {
            className: "notes-widget--esc",
            placeholder: "Record reminders, squad plans, build routes, or anything else you want to keep pinned to E.S.C.",
            statusLabel: "AUTO-SAVE ACTIVE // AVAILABLE IN ATLAS + THEATER",
            titleLabel: "Tab Name",
            stickyTarget: currentAtlasNotesStickyTarget,
          })}
        </section>
      </div>

      <div class="opsatlas-window__resize" data-opsatlas-resize="true" data-opsatlas-window-key="notes" aria-hidden="true"></div>
    </section>
  `;
}

function renderAtlasNotesDockButton(): string {
  if (!atlasNotesWindowMinimized) {
    return "";
  }

  return `
    <button
      class="opsatlas-notes-dock"
      type="button"
      data-atlas-notes-restore="true"
      style="${getAtlasNotesWindowThemeStyle()}"
      aria-label="Restore field memos"
    >
      <span class="opsatlas-notes-dock__kicker">NOTES</span>
      <span class="opsatlas-notes-dock__label">Field Memos</span>
    </button>
  `;
}

export function renderOperationSelectScreen(returnTo: BaseCampReturnTo = "basecamp"): void {
  teardownOperationSelectScreen({ preserveHoldWait: atlasHoldActive });
  setMusicCue("atlas");

  const root = document.getElementById("app");
  if (!root) {
    return;
  }
  document.body.setAttribute("data-screen", "ops-atlas");
  clearControllerContext();

  currentReturnTo = returnTo;
  let atlasData: AtlasRenderPayload;
  try {
    atlasData = loadAtlasRenderPayload();
  } catch (error) {
    console.error("[OPS ATLAS] render failed after recovery attempt", error);
    root.innerHTML = `
      <div class="opsatlas-root ard-noise">
        <div class="opsatlas-surface opsatlas-surface--error">
          <div class="opsatlas-hud">
            <div class="opsatlas-hud__title">
              <div class="opsatlas-hud__kicker">A.T.L.A.S. // ADAPTIVE THEATER LOGISTICS AND SURVEY</div>
              <div class="opsatlas-floor-switcher__status">Atlas bootstrap failed. Retry terminal access.</div>
            </div>
            <div class="opsatlas-hud__controls">
              <button class="opsatlas-back-btn" type="button" id="opsAtlasBackBtn">
                <span>&lt;-</span>
                <span>${escapeHtml(getBaseCampReturnLabel(returnTo))}</span>
              </button>
            </div>
          </div>
          <div class="opsatlas-economy-empty" style="margin: auto; max-width: 520px;">
            Ops terminal atlas state could not be initialized from the current save. The atlas was reset and can be retried safely.
          </div>
        </div>
      </div>
    `;
    const errorRoot = root.querySelector<HTMLElement>(".opsatlas-root");
    if (errorRoot) {
      enhanceTerminalUiButtons(errorRoot);
    }
    document.getElementById("opsAtlasBackBtn")?.addEventListener("click", () => {
      returnFromBaseCampScreen(returnTo);
    });
    showSystemPing({
      type: "error",
      title: "OPS TERMINAL RESET",
      message: "Ops terminal atlas reset. Try opening the terminal again.",
      channel: "ops-terminal-atlas",
    });
    return;
  }

  const { floor, highestGeneratedFloorOrdinal, warmEconomySummaries, coreSummaries } = atlasData;
  const regionPresentation = getActiveRegionPresentation(floor.floorOrdinal);
  const arrivalTransitionDirection = pendingFloorArrivalDirection;
  pendingFloorArrivalDirection = null;
  hydrateUiLayout(floor);
  const atlasDebugFloorBypassEnabled = isAtlasDebugFloorBypassEnabled();
  const floorComplete = floor.sectors.every((sector) => sector.theater.objectiveComplete);
  const nextFloorAlreadyGenerated = highestGeneratedFloorOrdinal > floor.floorOrdinal;
  const finalFloorReached = floor.floorOrdinal >= CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL;
  const canMoveToNextFloor = !finalFloorReached && (floorComplete || nextFloorAlreadyGenerated || atlasDebugFloorBypassEnabled);
  const floorTransitStatus = finalFloorReached
    ? floorComplete
      ? `Campaign Complete // Floor ${String(CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL).padStart(2, "0")} cleared, postgame redeploy available`
      : `Final Floor // Clear every sector objective on Floor ${String(CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL).padStart(2, "0")} to finish the campaign`
    : nextFloorAlreadyGenerated
    ? `Archive Transit // Floor ${String(floor.floorOrdinal + 1).padStart(2, "0")} already charted`
    : floorComplete
      ? `Descent Cleared // Generate Floor ${String(floor.floorOrdinal + 1).padStart(2, "0")}`
      : atlasDebugFloorBypassEnabled
        ? `Debug Override // Generate Floor ${String(floor.floorOrdinal + 1).padStart(2, "0")} without clearing sectors`
        : "Descent Locked // Clear every sector objective on this floor";
  const finalResetUnlocked = isFinalResetUnlocked();
  const floorResetStatus = finalResetUnlocked
    ? "Postgame protocol online // regenerate cleared floors or restart the full atlas at will"
    : `Postgame protocol locked // clear Floor ${String(CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL).padStart(2, "0")} to unlock manual floor regeneration`;

  const sectorViews = floor.sectors.map((sector, index) => (
    buildSectorView(sector, sector.theaterId === selectedTheaterId, index)
  ));
  currentAtlasNotesStickyTarget = getAtlasNotesStickyTarget(floor, sectorViews);
  currentAtlasContentBounds = getAtlasContentBounds(sectorViews, floor.floorId);

  root.innerHTML = `
    <div class="opsatlas-root ard-noise" style="${getAtlasRegionThemeStyle(regionPresentation)}">
      <div class="opsatlas-surface" id="opsAtlasSurface">
        <div class="opsatlas-hud">
          <div class="opsatlas-hud__title">
            <div class="opsatlas-hud__kicker">A.T.L.A.S. // ADAPTIVE THEATER LOGISTICS AND SURVEY</div>
            ${renderRegionActiveBanner(regionPresentation)}
            <div class="opsatlas-floor-switcher opsatlas-floor-switcher--title" aria-label="Floor transit controls">
              <div class="opsatlas-floor-switcher__label">Floor Transit</div>
              <div class="opsatlas-floor-switcher__controls">
                <button
                  class="opsatlas-floor-switcher__btn"
                  type="button"
                  data-atlas-floor-nav="prev"
                  ${floor.floorOrdinal > 1 ? "" : "disabled"}
                >
                  PREV
                </button>
                <div class="opsatlas-floor-switcher__value">FLOOR ${String(floor.floorOrdinal).padStart(2, "0")}</div>
                <button
                  class="opsatlas-floor-switcher__btn"
                  type="button"
                  data-atlas-floor-nav="next"
                  ${canMoveToNextFloor ? "" : "disabled"}
                >
                  NEXT
                </button>
              </div>
              <div class="opsatlas-floor-switcher__status" id="opsAtlasTransitStatusBody">
                <div id="opsAtlasTransitStatusOutput"></div>
              </div>
              <div class="opsatlas-floor-switcher__reset-controls">
                <button
                  class="opsatlas-floor-switcher__btn opsatlas-floor-switcher__btn--danger"
                  type="button"
                  data-atlas-floor-regen="current"
                  ${finalResetUnlocked ? "" : "disabled"}
                >
                  REGEN FLOOR
                </button>
                <button
                  class="opsatlas-floor-switcher__btn opsatlas-floor-switcher__btn--danger"
                  type="button"
                  data-atlas-reset-all="all"
                  ${finalResetUnlocked ? "" : "disabled"}
                >
                  RESET ATLAS
                </button>
              </div>
              <div class="opsatlas-floor-switcher__status opsatlas-floor-switcher__status--secondary" id="opsAtlasResetStatusBody">
                <div id="opsAtlasResetStatusOutput"></div>
              </div>
            </div>
          </div>

          <div class="opsatlas-hud__controls">
            <div class="opsatlas-mode-toggle" role="tablist" aria-label="Atlas network view">
              ${(["command", "supply", "power", "comms"] as TheaterMapMode[]).map((mode) => `
                <button
                  class="opsatlas-mode-toggle__btn ${atlasMapMode === mode ? "opsatlas-mode-toggle__btn--active" : ""}"
                  type="button"
                  data-atlas-map-mode="${mode}"
                >
                  ${getMapModeLabel(mode)}
                </button>
              `).join("")}
            </div>

            <div class="opsatlas-zoom">
              <button class="opsatlas-zoom__btn" type="button" id="opsAtlasZoomOutBtn">-</button>
              <div class="opsatlas-zoom__value" id="opsAtlasZoomValue">${Math.round(atlasViewport.zoom * 100)}%</div>
              <button class="opsatlas-zoom__btn" type="button" id="opsAtlasZoomInBtn">+</button>
            </div>

            <button class="opsatlas-hold-btn ${atlasHoldActive ? "opsatlas-hold-btn--active" : ""}" type="button" id="opsAtlasHoldBtn">
              ${atlasHoldActive ? "STOP WAITING" : "HOLD POSITION"}
            </button>

            <button class="opsatlas-back-btn" type="button" id="opsAtlasBackBtn">
              <span>&lt;-</span>
              <span>${escapeHtml(getBaseCampReturnLabel(returnTo))}</span>
            </button>
          </div>
        </div>

        <div
          class="opsatlas-world ${arrivalTransitionDirection ? `opsatlas-world--arrive opsatlas-world--arrive-${arrivalTransitionDirection}` : ""}"
          id="opsAtlasWorld"
          style="width:${OPS_ATLAS_MAP_WIDTH}px;height:${OPS_ATLAS_MAP_HEIGHT}px;"
        >
          <svg class="opsatlas-svg" viewBox="0 0 ${OPS_ATLAS_MAP_WIDTH} ${OPS_ATLAS_MAP_HEIGHT}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            ${sectorViews.map((view) => {
              const uplink = view.rooms.find((room) => room.room.isUplinkRoom);
              if (!uplink) {
                return "";
              }

              const ingressRoom = view.sector.theater.rooms[view.sector.theater.definition.ingressRoomId] ?? uplink.room;
              return getLinkRenderStates(ingressRoom, uplink.room).map((modeState) => {
                const coordinates = getOffsetLineCoordinates(
                  OPS_ATLAS_HAVEN_ANCHOR.x,
                  OPS_ATLAS_HAVEN_ANCHOR.y,
                  uplink.x,
                  uplink.y,
                  modeState.offset,
                );

                return `
                  <line
                    class="opsatlas-tether ${modeState.className.replace("opsatlas-link", "opsatlas-tether")} ${modeState.online ? "opsatlas-tether--online" : "opsatlas-tether--cut"} ${view.isSelected ? "opsatlas-tether--selected" : ""} ${atlasMapMode === "command" ? "opsatlas-tether--command" : ""}"
                    x1="${coordinates.x1}"
                    y1="${coordinates.y1}"
                    x2="${coordinates.x2}"
                    y2="${coordinates.y2}"
                    pathLength="1"
                    style="--ops-depth:0;--ops-sector-color:${view.color};"
                  ></line>
                `;
              }).join("");
            }).join("")}
            ${sectorViews.map(renderSectorLinks).join("")}
          </svg>

          <div
            class="opsatlas-haven"
            aria-label="H.A.V.E.N."
            style="
              left:${OPS_ATLAS_HAVEN_ANCHOR.x - (HAVEN_WIDTH / 2)}px;
              top:${OPS_ATLAS_HAVEN_ANCHOR.y - (HAVEN_HEIGHT / 2)}px;
              width:${HAVEN_WIDTH}px;
              height:${HAVEN_HEIGHT}px;
            "
          >
            <img
              src="/assets/ui/Haven_Logo.png"
              alt="H.A.V.E.N."
              class="opsatlas-haven-logo"
              draggable="false"
            />
          </div>

          <div class="opsatlas-room-layer">
            ${sectorViews.map((view) => view.rooms.map((room) => renderRoomNode(view, room)).join("")).join("")}
          </div>

          <div class="opsatlas-sticky-layer">
            ${renderStuckNotesLayer("atlas", floor.floorId, "opsatlas-stuck-note")}
          </div>
        </div>

        <section class="opsatlas-window" id="opsAtlasWindow" data-opsatlas-window-root="operations">
          <header class="opsatlas-window__header" data-opsatlas-drag-handle="true" data-opsatlas-window-key="operations">
            <div class="opsatlas-window__title-block">
              <div class="opsatlas-window__kicker">OPS TERMINAL // REGION ACTIVE OPERATIONS</div>
              <h2>${escapeHtml(regionPresentation.regionName)} Sector Operations</h2>
            </div>
            <div class="opsatlas-window__hint">Drag to move // Resize from corner</div>
          </header>

          <div class="opsatlas-window__body">
            ${sectorViews.map(renderSectorCard).join("")}
          </div>

          <div class="opsatlas-window__resize" data-opsatlas-resize="true" data-opsatlas-window-key="operations" aria-hidden="true"></div>
        </section>

        <section class="opsatlas-window opsatlas-window--economy" id="opsAtlasEconomyWindow" data-opsatlas-window-root="economy">
          <header class="opsatlas-window__header" data-opsatlas-drag-handle="true" data-opsatlas-window-key="economy">
            <div class="opsatlas-window__title-block">
              <div class="opsatlas-window__kicker">THEATER ECONOMY // ACTIVE + WARM SECTORS</div>
              <h2>Upkeep and Income</h2>
            </div>
            <div class="opsatlas-window__hint">Drag to move // Resize from corner</div>
          </header>

          <div class="opsatlas-window__body opsatlas-window__body--economy">
            ${renderEconomyWindowRows(warmEconomySummaries)}
          </div>

          <div class="opsatlas-window__resize" data-opsatlas-resize="true" data-opsatlas-window-key="economy" aria-hidden="true"></div>
        </section>

        <section class="opsatlas-window opsatlas-window--cores" id="opsAtlasCoreWindow" data-opsatlas-window-root="cores">
          <header class="opsatlas-window__header" data-opsatlas-drag-handle="true" data-opsatlas-window-key="cores">
            <div class="opsatlas-window__title-block">
              <div class="opsatlas-window__kicker">FLOOR FACILITIES // ALL C.O.R.E.S</div>
              <h2>Built C.O.R.E.s</h2>
            </div>
            <div class="opsatlas-window__hint">Drag to move // Resize from corner</div>
          </header>

          <div class="opsatlas-window__body opsatlas-window__body--cores">
            ${renderCoreWindowRows(coreSummaries)}
          </div>

          <div class="opsatlas-window__resize" data-opsatlas-resize="true" data-opsatlas-window-key="cores" aria-hidden="true"></div>
        </section>

        ${renderAtlasNotesWindow()}

        <div class="opsatlas-pan-hint" aria-hidden="true">
          <div class="opsatlas-pan-hint__title">WASD or arrow keys to pan</div>
          <div class="opsatlas-pan-hint__subtitle">${atlasHoldActive ? "Atlas waiting // 1 tick every 5 seconds" : "Hold SHIFT to pan faster"}</div>
        </div>

        ${renderAtlasNotesDockButton()}
      </div>
      ${renderAtlasConfirmModal()}
    </div>
  `;
  const opsRoot = root.querySelector<HTMLElement>(".opsatlas-root");
  if (opsRoot) {
    enhanceTerminalUiButtons(opsRoot);
  }
  startTerminalTypingByIds("opsAtlasTransitStatusBody", "opsAtlasTransitStatusOutput", [floorTransitStatus], {
    showCursor: false,
    loop: false,
    baseCharDelayMs: 16,
    minCharDelayMs: 6,
    accelerationPerCharMs: 0.7,
    pauseAfterLineMs: 90,
    maxLines: 1,
    scrollBehavior: "auto",
    lineClassName: "opsatlas-status-line",
    promptClassName: "opsatlas-status-prompt",
    textClassName: "opsatlas-status-text",
    promptParser: (line) => ({
      prompt: "ATLAS>",
      text: ` ${line}`,
    }),
  });
  startTerminalTypingByIds("opsAtlasResetStatusBody", "opsAtlasResetStatusOutput", [floorResetStatus], {
    showCursor: false,
    loop: false,
    baseCharDelayMs: 16,
    minCharDelayMs: 6,
    accelerationPerCharMs: 0.7,
    pauseAfterLineMs: 90,
    maxLines: 1,
    scrollBehavior: "auto",
    lineClassName: "opsatlas-status-line",
    promptClassName: "opsatlas-status-prompt",
    textClassName: "opsatlas-status-text",
    promptParser: (line) => ({
      prompt: "RESET>",
      text: ` ${line}`,
    }),
  });

  const surface = document.getElementById("opsAtlasSurface") as HTMLElement | null;
  const world = document.getElementById("opsAtlasWorld") as HTMLElement | null;
  const windowEl = document.getElementById("opsAtlasWindow") as HTMLElement | null;
  const economyWindowEl = document.getElementById("opsAtlasEconomyWindow") as HTMLElement | null;
  const coreWindowEl = document.getElementById("opsAtlasCoreWindow") as HTMLElement | null;
  const notesWindowEl = document.getElementById("opsAtlasNotesWindow") as HTMLElement | null;
  if (!surface || !world || !windowEl || !economyWindowEl || !coreWindowEl) {
    return;
  }

  applyWindowFrame(windowEl, "operations");
  applyWindowFrame(economyWindowEl, "economy");
  applyWindowFrame(coreWindowEl, "cores");
  if (notesWindowEl) {
    applyWindowFrame(notesWindowEl, "notes");
  }
  applyMapTransform(surface, world);
  updateZoomDisplay(root);

  requestAnimationFrame(() => {
    root.querySelector<HTMLElement>(`.opsatlas-sector-card[data-atlas-select-sector="${selectedTheaterId}"]`)?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  });

  const setZoom = (nextZoom: number) => {
    atlasViewport.zoom = clampNumber(nextZoom, MAP_MIN_ZOOM, MAP_MAX_ZOOM);
    applyMapTransform(surface, world);
    updateZoomDisplay(root);
  };

  const panBy = (dx: number, dy: number) => {
    atlasViewport.panX += dx;
    atlasViewport.panY += dy;
    applyMapTransform(surface, world);
  };

  const scheduleAtlasHoldTick = () => {
    clearAtlasHoldTimer();
    if (!atlasHoldActive) {
      return;
    }

    atlasHoldTimerId = window.setTimeout(() => {
      atlasHoldTimerId = null;
      if (!atlasHoldActive || floorTransitionInFlight || !document.querySelector(".opsatlas-root")) {
        stopAtlasHoldWait();
        renderOperationSelectScreen(currentReturnTo);
        return;
      }

      const nextState = holdPositionInOpsTerminalAtlas(getGameState(), floor.floorOrdinal, 1);
      updateGameState(() => nextState);
      renderOperationSelectScreen(currentReturnTo);
      if (atlasHoldActive) {
        scheduleAtlasHoldTick();
      }
    }, HOLD_POSITION_TICK_MS);
  };

  const startPanLoop = () => {
    if (mapPanFrameId !== null) {
      return;
    }

    const tick = () => {
      const activeSurface = document.getElementById("opsAtlasSurface") as HTMLElement | null;
      const activeWorld = document.getElementById("opsAtlasWorld") as HTMLElement | null;
      if (!activeSurface || !activeWorld) {
        mapPanFrameId = null;
        return;
      }

      if (floorTransitionInFlight) {
        mapPanFrameId = window.requestAnimationFrame(tick);
        return;
      }

      let dx = 0;
      let dy = 0;
      const panSpeed = mapPanKeys.has("shift") ? MAP_KEY_PAN_SPEED * MAP_FAST_PAN_MULTIPLIER : MAP_KEY_PAN_SPEED;

      if (mapPanKeys.has("w") || mapPanKeys.has("arrowup")) dy += panSpeed;
      if (mapPanKeys.has("s") || mapPanKeys.has("arrowdown")) dy -= panSpeed;
      if (mapPanKeys.has("a") || mapPanKeys.has("arrowleft")) dx += panSpeed;
      if (mapPanKeys.has("d") || mapPanKeys.has("arrowright")) dx -= panSpeed;

      const stick = readGamepadPanDelta();
      dx += stick.dx;
      dy += stick.dy;

      if (dx !== 0 || dy !== 0) {
        panBy(dx, dy);
      }

      mapPanFrameId = window.requestAnimationFrame(tick);
    };

    mapPanFrameId = window.requestAnimationFrame(tick);
  };

  rootClickHandler = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (suppressNextAtlasClick) {
      suppressNextAtlasClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (floorTransitionInFlight) {
      event.preventDefault();
      return;
    }

    const notesRestoreButton = target.closest<HTMLElement>("[data-atlas-notes-restore]");
    if (notesRestoreButton) {
      event.preventDefault();
      event.stopPropagation();
      atlasNotesWindowMinimized = false;
      persistUiLayout();
      renderOperationSelectScreen(currentReturnTo);
      return;
    }

    const notesMinimizeButton = target.closest<HTMLElement>("[data-atlas-notes-minimize]");
    if (notesMinimizeButton) {
      event.preventDefault();
      event.stopPropagation();
      atlasNotesWindowMinimized = true;
      persistUiLayout();
      renderOperationSelectScreen(currentReturnTo);
      return;
    }

    const notesColorButton = target.closest<HTMLElement>("[data-atlas-notes-color]");
    if (notesColorButton) {
      event.preventDefault();
      event.stopPropagation();
      cycleAtlasNotesWindowColor();
      persistUiLayout();
      renderOperationSelectScreen(currentReturnTo);
      return;
    }

    const floorNavButton = target.closest<HTMLElement>("[data-atlas-floor-nav]");
    if (floorNavButton) {
      event.preventDefault();
      event.stopPropagation();
      stopAtlasHoldWait();
      const direction = floorNavButton.getAttribute("data-atlas-floor-nav");
      if (direction === "next" || direction === "prev") {
        triggerFloorTransition(direction, floor.floorOrdinal);
      }
      return;
    }

    const regenFloorButton = target.closest<HTMLElement>("[data-atlas-floor-regen]");
    if (regenFloorButton) {
      event.preventDefault();
      event.stopPropagation();
      if (!isFinalResetUnlocked()) {
        return;
      }
      openAtlasConfirm({
        kind: "regen-floor",
        floorOrdinal: floor.floorOrdinal,
      });
      return;
    }

    const resetAtlasButton = target.closest<HTMLElement>("[data-atlas-reset-all]");
    if (resetAtlasButton) {
      event.preventDefault();
      event.stopPropagation();
      if (!isFinalResetUnlocked()) {
        return;
      }
      openAtlasConfirm({
        kind: "reset-atlas",
      });
      return;
    }

    const atlasConfirmButton = target.closest<HTMLElement>("[data-atlas-confirm-action]");
    if (atlasConfirmButton) {
      event.preventDefault();
      event.stopPropagation();
      const action = atlasConfirmButton.getAttribute("data-atlas-confirm-action");
      if (action === "accept") {
        resolveAtlasConfirm();
      } else {
        dismissAtlasConfirm();
      }
      return;
    }

    const deployButton = target.closest<HTMLElement>("[data-atlas-deploy]");
    if (deployButton) {
      event.preventDefault();
      event.stopPropagation();
      stopAtlasHoldWait();
      const theaterId = deployButton.getAttribute("data-atlas-deploy");
      if (theaterId) {
        startAtlasSectorOperation(theaterId);
      }
      return;
    }

    if (target.closest("#opsAtlasBackBtn")) {
      event.preventDefault();
      stopAtlasHoldWait();
      teardownOperationSelectScreen();
      returnFromBaseCampScreen(currentReturnTo);
      return;
    }

    if (target.closest("#opsAtlasZoomInBtn")) {
      event.preventDefault();
      setZoom(atlasViewport.zoom + MAP_ZOOM_STEP);
      return;
    }

    if (target.closest("#opsAtlasZoomOutBtn")) {
      event.preventDefault();
      setZoom(atlasViewport.zoom - MAP_ZOOM_STEP);
      return;
    }

    if (target.closest("#opsAtlasHoldBtn")) {
      event.preventDefault();
      event.stopPropagation();
      atlasHoldActive = !atlasHoldActive;
      if (atlasHoldActive) {
        scheduleAtlasHoldTick();
      } else {
        stopAtlasHoldWait();
      }
      renderOperationSelectScreen(currentReturnTo);
      return;
    }

    const mapModeButton = target.closest<HTMLElement>("[data-atlas-map-mode]");
    if (mapModeButton) {
      event.preventDefault();
      event.stopPropagation();
      const mode = mapModeButton.getAttribute("data-atlas-map-mode");
      if (mode === "command" || mode === "supply" || mode === "power" || mode === "comms") {
        atlasMapMode = mode;
        persistUiLayout();
        renderOperationSelectScreen(currentReturnTo);
      }
      return;
    }

    const selectionTarget = target.closest<HTMLElement>("[data-atlas-select-sector]");
    if (selectionTarget) {
      event.preventDefault();
      const theaterId = selectionTarget.getAttribute("data-atlas-select-sector");
      if (theaterId && theaterId !== selectedTheaterId) {
        selectedTheaterId = theaterId;
        persistUiLayout();
        renderOperationSelectScreen(currentReturnTo);
      }
      return;
    }

    const coreFieldButton = target.closest<HTMLElement>("[data-atlas-core-field]");
    if (coreFieldButton) {
      event.preventDefault();
      event.stopPropagation();
      stopAtlasHoldWait();
      const payload = coreFieldButton.getAttribute("data-atlas-core-field");
      const [theaterId, roomId] = payload?.split("::") ?? [];
      if (!theaterId || !roomId) {
        return;
      }
      selectedTheaterId = theaterId;
      persistUiLayout();
      teardownOperationSelectScreen();
      import("./FieldNodeRoomScreen").then(({ renderFieldNodeRoomScreen }) => {
        renderFieldNodeRoomScreen(
          roomId,
          getAtlasCoreFieldSeed(theaterId, roomId),
          false,
          "atlas",
        );
      });
    }
  };

  root.addEventListener("click", rootClickHandler);

  rootMouseDownHandler = (event: MouseEvent) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (floorTransitionInFlight) {
      event.preventDefault();
      return;
    }

    const resizeHandle = target.closest<HTMLElement>("[data-opsatlas-resize]");
    const dragHandle = target.closest<HTMLElement>("[data-opsatlas-drag-handle]");
    const targetWindowKey =
      (resizeHandle?.getAttribute("data-opsatlas-window-key")
      ?? dragHandle?.getAttribute("data-opsatlas-window-key")) as AtlasFloatingWindowKey | null;
    const windowContent = target.closest<HTMLElement>(".opsatlas-window");
    const hudContent = target.closest<HTMLElement>(".opsatlas-hud");
    const notesDock = target.closest<HTMLElement>(".opsatlas-notes-dock");
    if (!resizeHandle && !dragHandle && windowContent) {
      return;
    }
    if (notesDock) {
      return;
    }
    if (hudContent && !resizeHandle && !dragHandle) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (resizeHandle || dragHandle) {
      const resolvedWindowKey = targetWindowKey === "economy"
        ? "economy"
        : targetWindowKey === "cores"
          ? "cores"
          : targetWindowKey === "notes"
            ? "notes"
          : "operations";
      activeDragSession = {
        mode: resizeHandle ? "resize" : "drag",
        startX: event.clientX,
        startY: event.clientY,
        windowKey: resolvedWindowKey,
        startFrame: { ...getWindowFrame(resolvedWindowKey) },
      };
    } else {
      activeDragSession = {
        mode: "map-pan",
        startX: event.clientX,
        startY: event.clientY,
        startPanX: atlasViewport.panX,
        startPanY: atlasViewport.panY,
        moved: false,
      };
      root.classList.add("opsatlas-root--map-panning");
    }

    document.body.style.userSelect = "none";

    dragMoveHandler = (moveEvent: MouseEvent) => {
      if (!activeDragSession) {
        return;
      }

      const deltaX = moveEvent.clientX - activeDragSession.startX;
      const deltaY = moveEvent.clientY - activeDragSession.startY;

      if (activeDragSession.mode === "drag" && activeDragSession.startFrame && activeDragSession.windowKey) {
        const nextFrame = clampWindowFrame({
          ...activeDragSession.startFrame,
          x: activeDragSession.startFrame.x + deltaX,
          y: activeDragSession.startFrame.y + deltaY,
        }, activeDragSession.windowKey);
        setWindowFrame(activeDragSession.windowKey, nextFrame);
        const targetWindow = document.querySelector<HTMLElement>(`[data-opsatlas-window-root="${activeDragSession.windowKey}"]`) ??
          (activeDragSession.windowKey === "economy"
            ? economyWindowEl
            : activeDragSession.windowKey === "cores"
              ? coreWindowEl
              : activeDragSession.windowKey === "notes"
                ? notesWindowEl
              : windowEl);
        if (targetWindow) {
          applyWindowFrame(targetWindow, activeDragSession.windowKey);
        }
      } else if (activeDragSession.mode === "resize" && activeDragSession.startFrame && activeDragSession.windowKey) {
        const nextFrame = clampWindowFrame({
          ...activeDragSession.startFrame,
          width: activeDragSession.startFrame.width + deltaX,
          height: activeDragSession.startFrame.height + deltaY,
        }, activeDragSession.windowKey);
        setWindowFrame(activeDragSession.windowKey, nextFrame);
        const targetWindow = document.querySelector<HTMLElement>(`[data-opsatlas-window-root="${activeDragSession.windowKey}"]`) ??
          (activeDragSession.windowKey === "economy"
            ? economyWindowEl
            : activeDragSession.windowKey === "cores"
              ? coreWindowEl
              : activeDragSession.windowKey === "notes"
                ? notesWindowEl
              : windowEl);
        if (targetWindow) {
          applyWindowFrame(targetWindow, activeDragSession.windowKey);
        }
      } else if (
        activeDragSession.mode === "map-pan"
        && typeof activeDragSession.startPanX === "number"
        && typeof activeDragSession.startPanY === "number"
      ) {
        if (!activeDragSession.moved && Math.hypot(deltaX, deltaY) >= MAP_DRAG_THRESHOLD_PX) {
          activeDragSession.moved = true;
        }

        atlasViewport.panX = activeDragSession.startPanX + deltaX;
        atlasViewport.panY = activeDragSession.startPanY + deltaY;
        applyMapTransform(surface, world);
      }
    };

    dragUpHandler = () => {
      document.body.style.userSelect = "";
      root.classList.remove("opsatlas-root--map-panning");
      if (dragMoveHandler) {
        window.removeEventListener("mousemove", dragMoveHandler);
      }
      if (dragUpHandler) {
        window.removeEventListener("mouseup", dragUpHandler);
      }
      if (activeDragSession?.mode === "map-pan" && activeDragSession.moved) {
        suppressNextAtlasClick = true;
      }
      dragMoveHandler = null;
      dragUpHandler = null;
      activeDragSession = null;
      persistUiLayout();
    };

    window.addEventListener("mousemove", dragMoveHandler);
    window.addEventListener("mouseup", dragUpHandler);
  };

  root.addEventListener("mousedown", rootMouseDownHandler);

  surfaceWheelHandler = (event: WheelEvent) => {
    if (floorTransitionInFlight) {
      event.preventDefault();
      return;
    }
    if ((event.target as HTMLElement | null)?.closest("#opsAtlasWindow")) {
      return;
    }
    if ((event.target as HTMLElement | null)?.closest("#opsAtlasEconomyWindow")) {
      return;
    }
    if ((event.target as HTMLElement | null)?.closest("#opsAtlasCoreWindow")) {
      return;
    }
    if ((event.target as HTMLElement | null)?.closest("#opsAtlasNotesWindow")) {
      return;
    }
    event.preventDefault();
    setZoom(atlasViewport.zoom + (event.deltaY > 0 ? -MAP_ZOOM_STEP : MAP_ZOOM_STEP));
  };
  surface.addEventListener("wheel", surfaceWheelHandler, { passive: false });

  mapKeyHandler = (event: KeyboardEvent) => {
    if (floorTransitionInFlight || !document.querySelector(".opsatlas-root") || isEditableTarget(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();
    if (!["w", "a", "s", "d", "shift", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      return;
    }

    event.preventDefault();
    mapPanKeys.add(key);
    startPanLoop();
  };

  mapKeyUpHandler = (event: KeyboardEvent) => {
    mapPanKeys.delete(event.key.toLowerCase());
  };

  window.addEventListener("keydown", mapKeyHandler);
  window.addEventListener("keyup", mapKeyUpHandler);
  startPanLoop();

  resizeHandler = () => {
    atlasWindowFrame = clampWindowFrame(atlasWindowFrame, "operations");
    atlasEconomyWindowFrame = clampWindowFrame(atlasEconomyWindowFrame, "economy");
    atlasCoreWindowFrame = clampWindowFrame(atlasCoreWindowFrame, "cores");
    atlasNotesWindowFrame = clampWindowFrame(atlasNotesWindowFrame, "notes");
    applyWindowFrame(windowEl, "operations");
    applyWindowFrame(economyWindowEl, "economy");
    applyWindowFrame(coreWindowEl, "cores");
    if (notesWindowEl) {
      applyWindowFrame(notesWindowEl, "notes");
    }
    applyMapTransform(surface, world);
    persistUiLayout();
  };
  window.addEventListener("resize", resizeHandler);
  attachNotesWidgetHandlers(root, {
    onStateChange: () => renderOperationSelectScreen(currentReturnTo),
  });
  attachStuckNoteHandlers(root, {
    onStateChange: () => renderOperationSelectScreen(currentReturnTo),
    getStickyZoom: () => atlasViewport.zoom,
  });
  updateFocusableElements();
  cleanupOperationSelectControllerContext = registerControllerContext({
    id: "ops-atlas",
    defaultMode: atlasConfirmState ? "focus" : atlasControllerPreferredMode,
    focusRoot: () => document.querySelector(".opsatlas-root"),
    focusSelector: atlasConfirmState
      ? "#opsAtlasConfirmModal button:not([disabled])"
      : undefined,
    defaultFocusSelector: atlasConfirmState
      ? "#opsAtlasConfirmAcceptBtn"
      : "#opsAtlasBackBtn",
    onCursorAction: atlasConfirmState
      ? undefined
      : (action) => handleAtlasControllerAction(action, sectorViews, "cursor"),
    onLayoutAction: atlasConfirmState
      ? undefined
      : (action) => handleAtlasControllerAction(action, sectorViews, "layout"),
    onFocusAction: (action) => {
      if (action === "cancel") {
        if (atlasConfirmState) {
          dismissAtlasConfirm();
          return true;
        }
        setControllerMode("cursor");
        updateFocusableElements();
        return true;
      }
      return false;
    },
    onModeChange: (mode) => {
      if (!atlasConfirmState) {
        atlasControllerPreferredMode = mode;
      }
    },
    getDebugState: () => ({
      hovered: selectedTheaterId ?? "none",
      window: atlasControllerActiveWindowKey,
      focus: selectedTheaterId ?? "none",
    }),
  });

  registerBaseCampReturnHotkey(ATLAS_HOTKEY_ID, returnTo, {
    allowFieldEKey: true,
    activeSelector: ".opsatlas-root",
    onReturn: () => {
      teardownOperationSelectScreen();
    },
  });

  cleanupOperationSelectScreen = (options) => {
    if (!options?.preserveHoldWait) {
      stopAtlasHoldWait();
    }
    persistUiLayout();
    if (cleanupOperationSelectControllerContext) {
      cleanupOperationSelectControllerContext();
      cleanupOperationSelectControllerContext = null;
    }
    unregisterBaseCampReturnHotkey(ATLAS_HOTKEY_ID);

    if (rootClickHandler) {
      root.removeEventListener("click", rootClickHandler);
      rootClickHandler = null;
    }
    if (rootMouseDownHandler) {
      root.removeEventListener("mousedown", rootMouseDownHandler);
      rootMouseDownHandler = null;
    }
    if (surfaceWheelHandler) {
      surface.removeEventListener("wheel", surfaceWheelHandler);
      surfaceWheelHandler = null;
    }
    if (mapKeyHandler) {
      window.removeEventListener("keydown", mapKeyHandler);
      mapKeyHandler = null;
    }
    if (mapKeyUpHandler) {
      window.removeEventListener("keyup", mapKeyUpHandler);
      mapKeyUpHandler = null;
    }
    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
      resizeHandler = null;
    }
    if (dragMoveHandler) {
      window.removeEventListener("mousemove", dragMoveHandler);
      dragMoveHandler = null;
    }
    if (dragUpHandler) {
      window.removeEventListener("mouseup", dragUpHandler);
      dragUpHandler = null;
    }
    if (mapPanFrameId !== null) {
      window.cancelAnimationFrame(mapPanFrameId);
      mapPanFrameId = null;
    }
    if (floorTransitionTimerId !== null) {
      window.clearTimeout(floorTransitionTimerId);
      floorTransitionTimerId = null;
    }

    mapPanKeys.clear();
    activeDragSession = null;
    floorTransitionInFlight = false;
    suppressNextAtlasClick = false;
    currentAtlasContentBounds = null;
    root.classList.remove("opsatlas-root--map-panning");
    document.body.style.userSelect = "";
  };

  showTutorialCallout({
    id: "tutorial_atlas_regions_and_floors",
    title: "Regions And Floors",
    message: "A.T.L.A.S. is the theater survey layer for the region/floor campaign structure.",
    detail: `Choose a sector operation on the current floor, complete its objective, then descend. Floor ${String(CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL).padStart(2, "0")} completes the current campaign and unlocks postgame floor regeneration.`,
    durationMs: 9000,
    channel: "tutorial-atlas",
  });
}

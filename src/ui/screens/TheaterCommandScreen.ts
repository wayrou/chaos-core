import { getGameState, updateGameState } from "../../state/gameStore";
import {
  advanceToNextFloor as advanceCampaignToNextFloor,
  completeOperationRun,
} from "../../core/campaignManager";
import {
  THEATER_CORE_BLUEPRINTS,
  buildCoreInTheaterRoom,
  createTheaterBattleState,
  ensureOperationHasTheater,
  formatResourceCost,
  fortifyTheaterRoom,
  getFortificationCost,
  getMoveTickCost,
  getTheaterUpkeepPerTick,
  hasCompletedTheaterObjective,
  moveToTheaterRoom,
  setTheaterSelectedRoom,
} from "../../core/theaterSystem";
import {
  CoreType,
  GameState,
  TheaterNetworkState,
  TheaterObjectiveCompletion,
  TheaterRoom,
} from "../../core/types";
import { showSystemPing } from "../components/systemPing";

type TheaterWindowKey =
  | "ops"
  | "room"
  | "fortify"
  | "core"
  | "feed"
  | "resources"
  | "upkeep";

type TheaterWindowFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  zIndex: number;
};

type TheaterDragSession = {
  key: TheaterWindowKey;
  mode: "drag" | "resize";
  startX: number;
  startY: number;
  startFrame: TheaterWindowFrame;
} | null;

type TravelAnimationState = {
  fromRoomId: string;
  toRoomId: string;
  durationMs: number;
};

type TheaterWindowDefinition = {
  title: string;
  kicker: string;
  minWidth: number;
  minHeight: number;
  restoreLabel: string;
};

type TheaterWindowColorTheme = {
  key: string;
  vars: Record<string, string>;
};

type TheaterCorePanelTab = "core" | "fortifications";

const MAP_WIDTH = 3200;
const MAP_HEIGHT = 2200;
const MIN_MAP_ZOOM = 0.32;
const MAX_MAP_ZOOM = 2.2;
const MAP_ZOOM_STEP = 0.12;
const MAP_PAN_STEP = 44;
const MAP_STICK_PAN_SPEED = 22;
const MAP_STICK_DEADZONE = 0.18;
const THEATER_MARGIN_X = 14;
const THEATER_TOP_SAFE = 36;
const THEATER_BOTTOM_SAFE = 20;

const THEATER_WINDOW_ORDER: TheaterWindowKey[] = [
  "ops",
  "feed",
  "room",
  "fortify",
  "core",
  "upkeep",
  "resources",
];

const THEATER_WINDOW_DEFS: Record<TheaterWindowKey, TheaterWindowDefinition> = {
  ops: { title: "THEATER COMMAND", kicker: "S/COM_OS // OPS TERMINAL", minWidth: 280, minHeight: 220, restoreLabel: "OPS" },
  feed: { title: "ACTIVE THEATER FEED", kicker: "LIVE LOGISTICS AND THREAT UPDATES", minWidth: 320, minHeight: 140, restoreLabel: "FEED" },
  room: { title: "SELECTED ROOM", kicker: "ROOM STATUS", minWidth: 320, minHeight: 210, restoreLabel: "ROOM" },
  fortify: { title: "FORTIFICATIONS", kicker: "ROOM HARDENING", minWidth: 320, minHeight: 220, restoreLabel: "FORT" },
  core: { title: "BUILD C.O.R.E.", kicker: "CONTROLLED OPERATIONS AND RELAY EXCHANGE", minWidth: 360, minHeight: 260, restoreLabel: "CORE" },
  resources: { title: "CURRENT RESOURCES", kicker: "BASE CAMP SUPPLY LEDGER", minWidth: 280, minHeight: 180, restoreLabel: "SUPPLY" },
  upkeep: { title: "CURRENT UPKEEP COSTS", kicker: "PER-TICK FACILITY MAINTENANCE", minWidth: 320, minHeight: 220, restoreLabel: "UPKEEP" },
};

const THEATER_WINDOW_COLOR_THEMES: TheaterWindowColorTheme[] = [
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
];

const THEATER_WINDOW_COLOR_KEYS = THEATER_WINDOW_COLOR_THEMES.map((theme) => theme.key);
const THEATER_WINDOW_COLOR_THEME_MAP = new Map(
  THEATER_WINDOW_COLOR_THEMES.map((theme) => [theme.key, theme]),
);

let lastMountedTheaterSignature: string | null = null;
let mapZoom = 1;
let mapPanX = 0;
let mapPanY = 0;
let travelAnimation: TravelAnimationState | null = null;
let travelTimerId: number | null = null;
let activeDragSession: TheaterDragSession = null;
let dragMoveHandler: ((event: MouseEvent) => void) | null = null;
let dragUpHandler: (() => void) | null = null;
let theaterZCounter = 30;
let theaterWindowFrames: Record<TheaterWindowKey, TheaterWindowFrame> | null = null;
let theaterWindowColors: Record<TheaterWindowKey, string> | null = null;
let corePanelTab: TheaterCorePanelTab = "core";
let hydratedTheaterLayoutSignature: string | null = null;
let coreWindowUnlockedThisSession = false;
let mapKeyHandler: ((event: KeyboardEvent) => void) | null = null;
let mapKeyUpHandler: ((event: KeyboardEvent) => void) | null = null;
let mapPanFrameId: number | null = null;
let mapPanKeys = new Set<string>();
let seenThreatIds = new Set<string>();

function formatCoreType(coreType: CoreType | null): string {
  if (!coreType) {
    return "Unassigned";
  }
  return THEATER_CORE_BLUEPRINTS[coreType]?.label ?? coreType.replace(/_/g, " ");
}

function getCoreIconText(coreType: CoreType | null): string {
  switch (coreType) {
    case "supply_depot":
      return "SD";
    case "command_center":
      return "CC";
    case "medical_ward":
      return "MW";
    case "armory":
      return "AR";
    case "mine":
      return "MN";
    default:
      return "";
  }
}

function formatRoomStatus(room: TheaterRoom): string {
  if (room.status === "unknown" && !room.commsVisible) {
    return "Unknown";
  }
  if (room.underThreat) {
    return "Under Threat";
  }
  if (room.damaged) {
    return "Damaged";
  }
  if (room.status === "secured") {
    return "Secured";
  }
  return "Mapped";
}

function getRoomDisplayLabel(room: TheaterRoom): string {
  if (room.status === "unknown" && !room.commsVisible) {
    return "Unknown Contact";
  }
  return room.label;
}

function formatLayoutStyleLabel(layoutStyle: TheaterNetworkState["definition"]["layoutStyle"]): string {
  switch (layoutStyle) {
    case "vector_lance":
      return "Vector Lance";
    case "split_fan":
      return "Split Fan";
    case "central_bloom":
      return "Central Bloom";
    case "offset_arc":
      return "Offset Arc";
    default:
      return "Adaptive Layout";
  }
}

function getTheaterOriginPoint(theater: TheaterNetworkState): { x: number; y: number } {
  const ingressRoom =
    theater.rooms[theater.definition.ingressRoomId]
    ?? theater.rooms[theater.definition.uplinkRoomId]
    ?? theater.rooms[theater.currentRoomId]
    ?? Object.values(theater.rooms)[0];

  return theater.definition.mapAnchor ?? ingressRoom?.position ?? { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
}

function getRoomContextLabel(room: TheaterRoom, theater: TheaterNetworkState): string {
  if (room.tags.includes("objective")) {
    return room.label.includes("FINAL") ? "Final Objective" : "Descent Point";
  }
  if (room.isUplinkRoom || room.tags.includes("uplink")) {
    return theater.definition.originLabel
      ? `${theater.definition.originLabel} Uplink`
      : "Uplink Root";
  }
  if (room.tags.includes("power_source")) {
    return "Power Relay";
  }
  return "";
}

function getSelectedRoom(theater: TheaterNetworkState): TheaterRoom {
  return (
    theater.rooms[theater.selectedRoomId] ??
    theater.rooms[theater.currentRoomId] ??
    Object.values(theater.rooms)[0]
  );
}

function getDisplayCurrentRoomId(theater: TheaterNetworkState): string {
  if (travelAnimation?.toRoomId === theater.currentRoomId) {
    return travelAnimation.fromRoomId;
  }
  return theater.currentRoomId;
}


function getInstalledFortificationCount(room: TheaterRoom): number {
  return room.fortificationPips.barricade + room.fortificationPips.powerRail;
}

function findDisplayRoute(theater: TheaterNetworkState, roomId: string): string[] | null {
  const originId = theater.currentRoomId;
  if (originId === roomId) {
    return [originId];
  }

  const destination = theater.rooms[roomId];
  if (!destination || (destination.status === "unknown" && !destination.commsVisible)) {
    return null;
  }

  const bestCost = new Map<string, number>([[originId, 0]]);
  const previous = new Map<string, string | null>([[originId, null]]);
  const queue: Array<{ roomId: string; cost: number }> = [{ roomId: originId, cost: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    if (current.cost > (bestCost.get(current.roomId) ?? Number.POSITIVE_INFINITY)) {
      continue;
    }

    const currentRoom = theater.rooms[current.roomId];
    if (!currentRoom) {
      continue;
    }

    currentRoom.adjacency.forEach((adjacentId) => {
      const adjacentRoom = theater.rooms[adjacentId];
      if (!adjacentRoom) {
        return;
      }
      if (adjacentId !== roomId && !adjacentRoom.secured) {
        return;
      }
      if (adjacentRoom.status === "unknown" && !adjacentRoom.commsVisible) {
        return;
      }

      const nextCost = current.cost + getMoveTickCost(theater, adjacentId);
      if (nextCost >= (bestCost.get(adjacentId) ?? Number.POSITIVE_INFINITY)) {
        return;
      }

      bestCost.set(adjacentId, nextCost);
      previous.set(adjacentId, current.roomId);
      queue.push({ roomId: adjacentId, cost: nextCost });
    });
  }

  if (!previous.has(roomId)) {
    return null;
  }

  const route: string[] = [];
  let cursor: string | null = roomId;
  while (cursor) {
    route.push(cursor);
    cursor = previous.get(cursor) ?? null;
  }
  return route.reverse();
}

function getRoomNodeClass(room: TheaterRoom, theater: TheaterNetworkState): string {
  const classes = ["theater-room-node", `theater-room-node--${room.status}`];
  if (room.id === getDisplayCurrentRoomId(theater)) classes.push("theater-room-node--current");
  if (room.id === theater.selectedRoomId) classes.push("theater-room-node--selected");
  if (room.underThreat) classes.push("theater-room-node--threat");
  if (room.damaged) classes.push("theater-room-node--damaged");
  if (!room.supplied && room.secured) classes.push("theater-room-node--cut");
  if (room.status === "unknown" && !room.commsVisible) classes.push("theater-room-node--fogged");
  if (room.isUplinkRoom || room.tags.includes("uplink")) classes.push("theater-room-node--uplink");
  if (room.tags.includes("objective")) classes.push("theater-room-node--objective");
  if (room.tags.includes("power_source")) classes.push("theater-room-node--power");
  if (room.tags.includes("elite")) classes.push("theater-room-node--elite");
  if (room.clearMode === "field") classes.push("theater-room-node--field");
  if (room.tags.includes("core_candidate")) classes.push("theater-room-node--core-candidate");
  return classes.join(" ");
}

function getMoveButtonState(theater: TheaterNetworkState, room: TheaterRoom): {
  disabled: boolean;
  label: string;
  detail: string;
} {
  const route = findDisplayRoute(theater, room.id);
  const travelTicks = route
    ? route.slice(1).reduce((sum, routeRoomId) => sum + getMoveTickCost(theater, routeRoomId), 0)
    : 0;
  const blockedByFog = room.status === "unknown" && !room.commsVisible;
  const needsDefense = room.secured && (room.underThreat || room.damaged);
  const disabled =
    travelAnimation !== null ||
    !route ||
    blockedByFog ||
    (room.id === theater.currentRoomId && room.secured && !needsDefense);

  let label = "Move + Assault";
  if (needsDefense && room.id === theater.currentRoomId) {
    label = "Defend Room";
  } else if (needsDefense) {
    label = "Move + Defend";
  } else if (room.id === theater.currentRoomId && !room.secured && room.clearMode === "battle") {
    label = "Assault Room";
  } else if (!room.secured && room.clearMode !== "battle") {
    label = room.clearMode === "field" ? "Move + Field Sweep" : "Move + Secure";
  } else if (room.secured && room.id !== theater.currentRoomId) {
    label = "Move To Room";
  } else if (room.secured && room.id === theater.currentRoomId) {
    label = "Hold Position";
  }

  const detail =
    room.id === theater.currentRoomId
      ? "Current Location"
      : !route
        ? "No Secured Route"
      : `Travel ${travelTicks} Tick${travelTicks === 1 ? "" : "s"} / ${Math.max(0, (route?.length ?? 1) - 1)} Room${(route?.length ?? 1) === 2 ? "" : "s"}`;

  return { disabled, label, detail };
}

function createDefaultTheaterWindowFrames(): Record<TheaterWindowKey, TheaterWindowFrame> {
  const viewportWidth = window.innerWidth || 1920;
  const viewportHeight = window.innerHeight || 1080;
  return {
    ops: {
      x: THEATER_MARGIN_X,
      y: 38,
      width: clampNumber(Math.round(viewportWidth * 0.135), 260, 360),
      height: clampNumber(Math.round(viewportHeight * 0.23), 240, 320),
      minimized: false,
      zIndex: 20,
    },
    feed: {
      x: clampNumber(Math.round(viewportWidth * 0.14), 280, viewportWidth - 440),
      y: 38,
      width: clampNumber(Math.round(viewportWidth * 0.2), 380, 520),
      height: clampNumber(Math.round(viewportHeight * 0.12), 120, 220),
      minimized: false,
      zIndex: 21,
    },
    room: {
      x: 6,
      y: clampNumber(Math.round(viewportHeight * 0.54), THEATER_TOP_SAFE, viewportHeight - 280),
      width: clampNumber(Math.round(viewportWidth * 0.2), 360, 520),
      height: clampNumber(Math.round(viewportHeight * 0.24), 220, 320),
      minimized: false,
      zIndex: 22,
    },
    core: {
      x: clampNumber(Math.round(viewportWidth * 0.47), 620, viewportWidth - 760),
      y: clampNumber(Math.round(viewportHeight * 0.42), THEATER_TOP_SAFE, viewportHeight - 340),
      width: clampNumber(Math.round(viewportWidth * 0.21), 390, 520),
      height: clampNumber(Math.round(viewportHeight * 0.28), 280, 420),
      minimized: false,
      zIndex: 24,
    },
    fortify: {
      x: clampNumber(Math.round(viewportWidth * 0.66), 800, viewportWidth - 420),
      y: clampNumber(Math.round(viewportHeight * 0.42), THEATER_TOP_SAFE, viewportHeight - 300),
      width: clampNumber(Math.round(viewportWidth * 0.17), 340, 460),
      height: clampNumber(Math.round(viewportHeight * 0.26), 240, 360),
      minimized: false,
      zIndex: 23,
    },
    upkeep: {
      x: clampNumber(Math.round(viewportWidth * 0.76), 980, viewportWidth - 420),
      y: 6,
      width: clampNumber(Math.round(viewportWidth * 0.2), 360, 480),
      height: clampNumber(Math.round(viewportHeight * 0.36), 280, 460),
      minimized: false,
      zIndex: 26,
    },
    resources: {
      x: clampNumber(Math.round(viewportWidth * 0.82), 1040, viewportWidth - 330),
      y: clampNumber(Math.round(viewportHeight * 0.39), THEATER_TOP_SAFE, viewportHeight - 240),
      width: clampNumber(Math.round(viewportWidth * 0.13), 240, 340),
      height: clampNumber(Math.round(viewportHeight * 0.2), 180, 300),
      minimized: false,
      zIndex: 25,
    },
  };
}

function normalizeTheaterWindowFrame(key: TheaterWindowKey, frame: TheaterWindowFrame, fallback: TheaterWindowFrame): TheaterWindowFrame {
  const viewportWidth = window.innerWidth || 1920;
  const viewportHeight = window.innerHeight || 1080;
  const minWidth = Math.min(THEATER_WINDOW_DEFS[key].minWidth, viewportWidth - (THEATER_MARGIN_X * 2));
  const minHeight = Math.min(
    THEATER_WINDOW_DEFS[key].minHeight,
    viewportHeight - THEATER_TOP_SAFE - THEATER_BOTTOM_SAFE,
  );
  const maxWidth = Math.max(minWidth, viewportWidth - (THEATER_MARGIN_X * 2));
  const maxHeight = Math.max(minHeight, viewportHeight - THEATER_TOP_SAFE - THEATER_BOTTOM_SAFE);
  const width = clampNumber(Math.round(frame.width || fallback.width), minWidth, maxWidth);
  const height = clampNumber(Math.round(frame.height || fallback.height), minHeight, maxHeight);
  const x = clampNumber(
    Math.round(frame.x ?? fallback.x),
    THEATER_MARGIN_X,
    Math.max(THEATER_MARGIN_X, viewportWidth - width - THEATER_MARGIN_X),
  );
  const y = clampNumber(
    Math.round(frame.y ?? fallback.y),
    THEATER_TOP_SAFE,
    Math.max(THEATER_TOP_SAFE, viewportHeight - height - THEATER_BOTTOM_SAFE),
  );

  return {
    x,
    y,
    width,
    height,
    minimized: Boolean(frame.minimized),
    zIndex: frame.zIndex || fallback.zIndex,
  };
}

function ensureTheaterWindowFrames(): Record<TheaterWindowKey, TheaterWindowFrame> {
  if (!theaterWindowFrames) {
    const defaults = createDefaultTheaterWindowFrames();
    theaterWindowFrames = {
      ops: normalizeTheaterWindowFrame("ops", defaults.ops, defaults.ops),
      feed: normalizeTheaterWindowFrame("feed", defaults.feed, defaults.feed),
      room: normalizeTheaterWindowFrame("room", defaults.room, defaults.room),
      fortify: normalizeTheaterWindowFrame("fortify", defaults.fortify, defaults.fortify),
      core: normalizeTheaterWindowFrame("core", defaults.core, defaults.core),
      resources: normalizeTheaterWindowFrame("resources", defaults.resources, defaults.resources),
      upkeep: normalizeTheaterWindowFrame("upkeep", defaults.upkeep, defaults.upkeep),
    };
    theaterZCounter = Math.max(...Object.values(defaults).map((frame) => frame.zIndex));
  }
  return theaterWindowFrames;
}

function normalizeAllTheaterWindowFrames(): Record<TheaterWindowKey, TheaterWindowFrame> {
  const frames = ensureTheaterWindowFrames();
  const defaults = createDefaultTheaterWindowFrames();

  THEATER_WINDOW_ORDER.forEach((key) => {
    frames[key] = normalizeTheaterWindowFrame(key, frames[key] ?? defaults[key], defaults[key]);
  });

  theaterZCounter = Math.max(...Object.values(frames).map((frame) => frame.zIndex), theaterZCounter);
  return frames;
}

function getDefaultTheaterWindowColorKey(key: TheaterWindowKey): string {
  switch (key) {
    case "ops":
    case "room":
      return "steel";
    case "feed":
      return "teal";
    case "fortify":
      return "moss";
    case "core":
      return "verdant";
    case "resources":
      return "violet";
    case "upkeep":
      return "amber";
    default:
      return "steel";
  }
}

function ensureTheaterWindowColors(): Record<TheaterWindowKey, string> {
  if (!theaterWindowColors) {
    theaterWindowColors = {
      ops: getDefaultTheaterWindowColorKey("ops"),
      feed: getDefaultTheaterWindowColorKey("feed"),
      room: getDefaultTheaterWindowColorKey("room"),
      fortify: getDefaultTheaterWindowColorKey("fortify"),
      core: getDefaultTheaterWindowColorKey("core"),
      resources: getDefaultTheaterWindowColorKey("resources"),
      upkeep: getDefaultTheaterWindowColorKey("upkeep"),
    };
  }

  THEATER_WINDOW_ORDER.forEach((key) => {
    const colorKey = theaterWindowColors?.[key];
    if (!colorKey || !THEATER_WINDOW_COLOR_THEME_MAP.has(colorKey)) {
      theaterWindowColors![key] = getDefaultTheaterWindowColorKey(key);
    }
  });

  return theaterWindowColors;
}

function hydrateTheaterUiLayoutFromState(signature: string): void {
  if (hydratedTheaterLayoutSignature === signature) {
    return;
  }

  const layout = getGameState().uiLayout;
  if (!layout) {
    hydratedTheaterLayoutSignature = signature;
    return;
  }

  if (layout.theaterCommandWindowFrames) {
    const savedFrames = layout.theaterCommandWindowFrames;
    const defaults = createDefaultTheaterWindowFrames();
    theaterWindowFrames = {
      ops: normalizeTheaterWindowFrame("ops", savedFrames.ops ?? defaults.ops, defaults.ops),
      feed: normalizeTheaterWindowFrame("feed", savedFrames.feed ?? defaults.feed, defaults.feed),
      room: normalizeTheaterWindowFrame("room", savedFrames.room ?? defaults.room, defaults.room),
      fortify: normalizeTheaterWindowFrame("fortify", savedFrames.fortify ?? defaults.fortify, defaults.fortify),
      core: normalizeTheaterWindowFrame("core", savedFrames.core ?? defaults.core, defaults.core),
      resources: normalizeTheaterWindowFrame("resources", savedFrames.resources ?? defaults.resources, defaults.resources),
      upkeep: normalizeTheaterWindowFrame("upkeep", savedFrames.upkeep ?? defaults.upkeep, defaults.upkeep),
    };
    theaterZCounter = Math.max(...Object.values(theaterWindowFrames).map((frame) => frame.zIndex), theaterZCounter);
  }

  if (layout.theaterCommandWindowColors) {
    theaterWindowColors = {
      ops: layout.theaterCommandWindowColors.ops ?? getDefaultTheaterWindowColorKey("ops"),
      feed: layout.theaterCommandWindowColors.feed ?? getDefaultTheaterWindowColorKey("feed"),
      room: layout.theaterCommandWindowColors.room ?? getDefaultTheaterWindowColorKey("room"),
      fortify: layout.theaterCommandWindowColors.fortify ?? getDefaultTheaterWindowColorKey("fortify"),
      core: layout.theaterCommandWindowColors.core ?? getDefaultTheaterWindowColorKey("core"),
      resources: layout.theaterCommandWindowColors.resources ?? getDefaultTheaterWindowColorKey("resources"),
      upkeep: layout.theaterCommandWindowColors.upkeep ?? getDefaultTheaterWindowColorKey("upkeep"),
    };
  }

  if (layout.theaterCommandViewport) {
    mapPanX = layout.theaterCommandViewport.panX ?? 0;
    mapPanY = layout.theaterCommandViewport.panY ?? 0;
    mapZoom = clampNumber(layout.theaterCommandViewport.zoom ?? 1, MIN_MAP_ZOOM, MAX_MAP_ZOOM);
    clampMapPanToBounds();
  }

  if (layout.theaterCommandCoreTab === "core" || layout.theaterCommandCoreTab === "fortifications") {
    corePanelTab = layout.theaterCommandCoreTab;
  }

  hydratedTheaterLayoutSignature = signature;
}

function persistTheaterUiLayoutToState(): void {
  if (!activeDragSession) {
    captureWindowFramesFromDom();
  }
  const frames = ensureTheaterWindowFrames();
  const colors = ensureTheaterWindowColors();
  updateGameState((state) => ({
    ...state,
    uiLayout: {
      ...(state.uiLayout ?? {}),
      theaterCommandWindowFrames: Object.fromEntries(
        THEATER_WINDOW_ORDER.map((key) => [key, { ...frames[key] }]),
      ),
      theaterCommandWindowColors: { ...colors },
      theaterCommandViewport: {
        panX: mapPanX,
        panY: mapPanY,
        zoom: mapZoom,
      },
      theaterCommandCoreTab: corePanelTab,
    },
  }));
}

function getTheaterWindowThemeStyle(key: TheaterWindowKey): string {
  const colorKey = ensureTheaterWindowColors()[key];
  const theme = THEATER_WINDOW_COLOR_THEME_MAP.get(colorKey) ?? THEATER_WINDOW_COLOR_THEMES[0];
  return Object.entries(theme.vars)
    .map(([cssVar, value]) => `${cssVar}: ${value}`)
    .join("; ");
}

function cycleTheaterWindowColor(key: TheaterWindowKey): void {
  const colors = ensureTheaterWindowColors();
  const currentKey = colors[key] ?? getDefaultTheaterWindowColorKey(key);
  const currentIndex = THEATER_WINDOW_COLOR_KEYS.indexOf(currentKey);
  colors[key] = THEATER_WINDOW_COLOR_KEYS[(currentIndex + 1 + THEATER_WINDOW_COLOR_KEYS.length) % THEATER_WINDOW_COLOR_KEYS.length];
}

function focusWindow(key: TheaterWindowKey): void {
  const frames = ensureTheaterWindowFrames();
  theaterZCounter += 1;
  frames[key].zIndex = theaterZCounter;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getTheaterContentBounds(theater: TheaterNetworkState): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
} {
  const origin = getTheaterOriginPoint(theater);
  const bounds = Object.values(theater.rooms).reduce((acc, room) => ({
    minX: Math.min(acc.minX, room.position.x - room.size.width / 2),
    maxX: Math.max(acc.maxX, room.position.x + room.size.width / 2),
    minY: Math.min(acc.minY, room.position.y - room.size.height / 2),
    maxY: Math.max(acc.maxY, room.position.y + room.size.height / 2),
  }), {
    minX: origin.x,
    maxX: origin.x,
    minY: origin.y,
    maxY: origin.y,
  });

  const padding = 180;
  const minX = bounds.minX - padding;
  const maxX = bounds.maxX + padding;
  const minY = bounds.minY - padding;
  const maxY = bounds.maxY + padding;

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function getMapPanBounds(): { maxPanX: number; maxPanY: number } {
  const viewportWidth = window.innerWidth || 1920;
  const viewportHeight = window.innerHeight || 1080;
  return {
    maxPanX: Math.max(220, (MAP_WIDTH * mapZoom - viewportWidth) / 2 + 220),
    maxPanY: Math.max(160, (MAP_HEIGHT * mapZoom - viewportHeight) / 2 + 160),
  };
}

function clampMapPanToBounds(): void {
  const { maxPanX, maxPanY } = getMapPanBounds();
  mapPanX = clampNumber(mapPanX, -maxPanX, maxPanX);
  mapPanY = clampNumber(mapPanY, -maxPanY, maxPanY);
}

function getDefaultMapZoom(theater: TheaterNetworkState): number {
  const bounds = getTheaterContentBounds(theater);
  const viewportWidth = window.innerWidth || 1920;
  const viewportHeight = window.innerHeight || 1080;
  const availableWidth = Math.max(580, viewportWidth - 320);
  const availableHeight = Math.max(420, viewportHeight - 220);
  return clampNumber(
    Math.min(availableWidth / bounds.width, availableHeight / bounds.height, 1.08),
    MIN_MAP_ZOOM,
    1.08,
  );
}

function focusMapOnTheater(theater: TheaterNetworkState, resetZoom = false): void {
  if (resetZoom) {
    mapZoom = clampNumber(getDefaultMapZoom(theater), MIN_MAP_ZOOM, MAX_MAP_ZOOM);
  }

  const bounds = getTheaterContentBounds(theater);
  mapPanX = Math.round((MAP_WIDTH / 2) - bounds.centerX);
  mapPanY = Math.round((MAP_HEIGHT / 2) - bounds.centerY);
  clampMapPanToBounds();
}

function frameStyle(key: TheaterWindowKey): string {
  const frame = ensureTheaterWindowFrames()[key];
  return `left:${frame.x}px;top:${frame.y}px;width:${frame.width}px;height:${frame.height}px;z-index:${frame.zIndex};${getTheaterWindowThemeStyle(key)}`;
}

function setTheaterWindowMinimized(key: TheaterWindowKey, minimized: boolean): void {
  const frames = ensureTheaterWindowFrames();
  frames[key] = {
    ...frames[key],
    minimized,
    zIndex: minimized ? frames[key].zIndex : ++theaterZCounter,
  };
}

function shouldRenderTheaterWindow(key: TheaterWindowKey, theater: TheaterNetworkState): boolean {
  const frames = ensureTheaterWindowFrames();
  if (key === "fortify") {
    return false;
  }
  if (frames[key].minimized) {
    return false;
  }
  if (key === "core" && !coreWindowUnlockedThisSession) {
    return false;
  }
  return true;
}

function renderWindowShell(key: TheaterWindowKey, title: string, subtitle: string, body: string, theater: TheaterNetworkState): string {
  if (!shouldRenderTheaterWindow(key, theater)) {
    return "";
  }

  const colorKey = ensureTheaterWindowColors()[key];
  return `
    <section class="theater-window" data-theater-window="${key}" data-color-key="${colorKey}" style="${frameStyle(key)}">
      <div class="theater-window-header" data-theater-window-drag="${key}">
        <div class="theater-window-meta">
          <div class="theater-window-kicker">${subtitle}</div>
          <h2 class="theater-window-title">${title}</h2>
        </div>
        <div class="theater-window-actions">
          <div class="theater-window-grip" aria-hidden="true">::</div>
          <button class="theater-window-color" type="button" data-theater-window-color="${key}" aria-label="Change color for ${title}">
            <span class="theater-window-color-dot" aria-hidden="true"></span>
          </button>
          <button class="theater-window-minimize" type="button" data-theater-window-minimize="${key}" aria-label="Minimize ${title}">_</button>
        </div>
      </div>
      <div class="theater-window-body">${body}</div>
      <div class="theater-window-resize" data-theater-window-resize="${key}"></div>
    </section>
  `;
}

function clearTravelTimer(): void {
  if (travelTimerId !== null) {
    window.clearTimeout(travelTimerId);
    travelTimerId = null;
  }
}

function applyMapViewportToDom(shouldPersist = true): void {
  const mapWorld = document.querySelector<HTMLElement>(".theater-map-world");
  if (mapWorld) {
    mapWorld.style.transform = `translate(calc(-50% + ${mapPanX}px), calc(-50% + ${mapPanY}px)) scale(${mapZoom})`;
  }

  const zoomValue = document.getElementById("theaterZoomValue");
  if (zoomValue) {
    zoomValue.textContent = `${Math.round(mapZoom * 100)}%`;
  }

  if (shouldPersist) {
    persistTheaterUiLayoutToState();
  }
}

function setMapZoom(nextZoom: number): void {
  mapZoom = clampNumber(nextZoom, MIN_MAP_ZOOM, MAX_MAP_ZOOM);
  clampMapPanToBounds();
  applyMapViewportToDom();
}

function panMapBy(dx: number, dy: number): void {
  mapPanX += dx;
  mapPanY += dy;
  clampMapPanToBounds();
  applyMapViewportToDom();
}

function buildTheaterLinkPath(
  theater: TheaterNetworkState,
  fromRoom: TheaterRoom,
  toRoom: TheaterRoom,
): string {
  const midpoint = {
    x: (fromRoom.position.x + toRoom.position.x) / 2,
    y: (fromRoom.position.y + toRoom.position.y) / 2,
  };
  const dx = toRoom.position.x - fromRoom.position.x;
  const dy = toRoom.position.y - fromRoom.position.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normal = { x: -dy / length, y: dx / length };
  const origin = getTheaterOriginPoint(theater);
  const outwardDx = midpoint.x - origin.x;
  const outwardDy = midpoint.y - origin.y;
  const outwardLength = Math.max(1, Math.hypot(outwardDx, outwardDy));
  const outward = { x: outwardDx / outwardLength, y: outwardDy / outwardLength };
  const curveAmount = clampNumber(length * 0.16, 20, 82);
  const control = {
    x: midpoint.x + (normal.x * curveAmount * 0.55) + (outward.x * curveAmount * 0.7),
    y: midpoint.y + (normal.y * curveAmount * 0.55) + (outward.y * curveAmount * 0.7),
  };

  return `M ${fromRoom.position.x} ${fromRoom.position.y} Q ${Math.round(control.x)} ${Math.round(control.y)} ${toRoom.position.x} ${toRoom.position.y}`;
}

function renderConnectionSvg(theater: TheaterNetworkState): string {
  const seenEdges = new Set<string>();
  const lines: string[] = [];

  Object.values(theater.rooms).forEach((room) => {
    room.adjacency.forEach((adjacentId) => {
      const edgeKey = [room.id, adjacentId].sort().join("__");
      if (seenEdges.has(edgeKey)) {
        return;
      }
      seenEdges.add(edgeKey);

      const adjacent = theater.rooms[adjacentId];
      if (!adjacent) {
        return;
      }

      const online = room.secured && adjacent.secured && room.supplied && adjacent.supplied;
      const pressure = room.underThreat || adjacent.underThreat || room.damaged || adjacent.damaged;
      const fogged =
        (room.status === "unknown" && !room.commsVisible) ||
        (adjacent.status === "unknown" && !adjacent.commsVisible);

      lines.push(`
        <path
          d="${buildTheaterLinkPath(theater, room, adjacent)}"
          class="theater-link ${online ? "theater-link--online" : ""} ${pressure ? "theater-link--pressure" : ""} ${fogged ? "theater-link--fogged" : ""}"
        />
      `);
    });
  });

  return `
    <svg class="theater-links" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}">
      ${lines.join("")}
    </svg>
  `;
}

function renderSquadMarker(theater: TheaterNetworkState): string {
  const travelTarget =
    travelAnimation && theater.rooms[travelAnimation.fromRoomId] && theater.rooms[travelAnimation.toRoomId]
      ? {
          fromRoom: theater.rooms[travelAnimation.fromRoomId],
          toRoom: theater.rooms[travelAnimation.toRoomId],
        }
      : null;

  const anchorRoom = travelTarget?.fromRoom ?? theater.rooms[theater.currentRoomId];
  if (!anchorRoom) {
    return "";
  }

  const dx = travelTarget ? travelTarget.toRoom.position.x - anchorRoom.position.x : 0;
  const dy = travelTarget ? travelTarget.toRoom.position.y - anchorRoom.position.y : 0;
  const duration = travelTarget ? travelAnimation!.durationMs : 0;
  const animationStyle = travelTarget
    ? `--travel-dx:${dx}px;--travel-dy:${dy}px;--travel-duration:${duration}ms;`
    : "";

  return `
    <div
      class="theater-squad-marker ${travelTarget ? "theater-squad-marker--moving" : ""}"
      style="left:${anchorRoom.position.x}px;top:${anchorRoom.position.y}px;${animationStyle}"
      title="Squad Position"
    >
      SQUAD
    </div>
  `;
}

function renderRoomNode(theater: TheaterNetworkState, room: TheaterRoom): string {
  const moveState = getMoveButtonState(theater, room);
  const showMoveButton = room.id === theater.selectedRoomId;
  const isCurrent = room.id === getDisplayCurrentRoomId(theater);
  const coreIcon = getCoreIconText(room.coreAssignment?.type ?? null);

  return `
    <div
      class="${getRoomNodeClass(room, theater)}"
      data-theater-room-id="${room.id}"
      style="
        left:${room.position.x - room.size.width / 2}px;
        top:${room.position.y - room.size.height / 2}px;
        width:${room.size.width}px;
        height:${room.size.height}px;
      "
      role="button"
      tabindex="0"
      aria-label="${room.label}"
    >
      <div class="theater-room-sector">${room.sectorTag}</div>
      ${coreIcon ? `<div class="theater-room-core-icon" title="${formatCoreType(room.coreAssignment?.type ?? null)}">${coreIcon}</div>` : ""}
      <div class="theater-room-label">${getRoomDisplayLabel(room)}</div>
      <div class="theater-room-flags">
        <span class="theater-chip ${room.supplied ? "theater-chip--good" : "theater-chip--bad"}">${room.supplied ? "Supply Online" : "Supply Cut"}</span>
        <span class="theater-chip ${room.powered ? "theater-chip--power" : ""}">${room.powered ? "Power Online" : "Power Offline"}</span>
        <span class="theater-chip ${room.commsVisible ? "theater-chip--comms" : ""}">${room.commsVisible ? "Comms Linked" : "Comms Dark"}</span>
      </div>
      ${isCurrent ? `<div class="theater-current-room-badge">Current Room</div>` : ""}
      ${showMoveButton ? `
        <button
          class="theater-room-move-btn"
          type="button"
          data-theater-move-button="${room.id}"
          ${moveState.disabled ? "disabled" : ""}
        >
          ${moveState.label}
          <small>${moveState.detail}</small>
        </button>
      ` : ""}
    </div>
  `;
}

function renderTheaterMap(theater: TheaterNetworkState): string {
  return `
    <section class="theater-map-wrap" id="theaterMapWrap">
      <div class="theater-map-zoom-controls">
        <button class="theater-zoom-btn" type="button" id="theaterZoomOutBtn">Zoom Out</button>
        <div class="theater-zoom-value" id="theaterZoomValue">${Math.round(mapZoom * 100)}%</div>
        <button class="theater-zoom-btn" type="button" id="theaterZoomInBtn">Zoom In</button>
      </div>
      <div class="theater-map-world" style="transform: translate(calc(-50% + ${mapPanX}px), calc(-50% + ${mapPanY}px)) scale(${mapZoom});">
        ${renderConnectionSvg(theater)}
        ${Object.values(theater.rooms).map((room) => renderRoomNode(theater, room)).join("")}
        ${renderSquadMarker(theater)}
      </div>
    </section>
  `;
}

function renderOpsWindow(theater: TheaterNetworkState, totalFloors: number): string {
  const body = `
    <div class="theater-copy"><strong>Objective:</strong> ${theater.definition.objective}</div>
    <div class="theater-info-grid theater-info-grid--two">
      <div class="theater-stat-card"><span>Operation</span><strong>${theater.definition.operationId.toUpperCase()}</strong></div>
      <div class="theater-stat-card"><span>Theater</span><strong>${theater.definition.name}</strong></div>
      <div class="theater-stat-card"><span>Floor</span><strong>${theater.definition.floorOrdinal}/${Math.max(1, totalFloors)}</strong></div>
      <div class="theater-stat-card"><span>Sector</span><strong>${theater.definition.sectorLabel}</strong></div>
      <div class="theater-stat-card"><span>Layout</span><strong>${formatLayoutStyleLabel(theater.definition.layoutStyle)}</strong></div>
      <div class="theater-stat-card"><span>Vector</span><strong>${Math.round(theater.definition.angleDeg)} DEG</strong></div>
      <div class="theater-stat-card"><span>Recommended Power</span><strong>${theater.definition.recommendedPWR}</strong></div>
      <div class="theater-stat-card"><span>Elapsed Ticks</span><strong>${theater.tickCount}</strong></div>
    </div>
    <div class="theater-inline-actions">
      <button class="theater-secondary-btn" type="button" id="theaterManageUnitsBtn">Manage Units</button>
      <button class="theater-secondary-btn" type="button" id="theaterReturnToBaseBtn">Return To Base Camp</button>
    </div>
  `;
  return renderWindowShell("ops", THEATER_WINDOW_DEFS.ops.title, THEATER_WINDOW_DEFS.ops.kicker, body, theater);
}

function renderSelectedRoomWindow(theater: TheaterNetworkState): string {
  const room = getSelectedRoom(theater);
  const moveState = getMoveButtonState(theater, room);
  const status = formatRoomStatus(room);
  const contextLabel = getRoomContextLabel(room, theater);
  const route = findDisplayRoute(theater, room.id);
  const routeLabel = route && route.length > 1
    ? route.map((routeRoomId) => theater.rooms[routeRoomId]?.label ?? routeRoomId).join(" -> ")
    : route
      ? "Current Room"
      : "No Secured Route";
  const fortificationCapacity = room.fortificationCapacity ?? 3;
  const fortificationCount = getInstalledFortificationCount(room);
  const isTravelingToRoom = travelAnimation?.toRoomId === room.id;
  const travelLabel =
    isTravelingToRoom
      ? "Travel In Progress"
      : moveState.detail;

  const body = `
    <div class="theater-room-head">
      <div>
        <div class="theater-room-title">${getRoomDisplayLabel(room)}</div>
        <div class="theater-room-subtitle">${room.id} // ${room.sectorTag}${contextLabel ? ` // ${contextLabel}` : ""}</div>
      </div>
      <div class="theater-status-pill">${status}</div>
    </div>
    <div class="theater-info-grid">
      <div class="theater-stat-card"><span>Travel Cost</span><strong>${isTravelingToRoom ? travelLabel : (room.id === theater.currentRoomId ? "0 Ticks" : travelLabel)}</strong></div>
      <div class="theater-stat-card"><span>C.O.R.E. Assignment</span><strong>${formatCoreType(room.coreAssignment?.type ?? null)}</strong></div>
      <div class="theater-stat-card"><span>Fortification Slots</span><strong>${fortificationCount} / ${fortificationCapacity}</strong></div>
      <div class="theater-stat-card"><span>Barricades / Power Rails</span><strong>${room.fortificationPips.barricade} / ${room.fortificationPips.powerRail}</strong></div>
      <div class="theater-stat-card"><span>Supply Status</span><strong>${room.supplied ? "Supplied" : "Unsupplied"}</strong></div>
      <div class="theater-stat-card"><span>Power Status</span><strong>${room.powered ? "Powered" : "Unpowered"}</strong></div>
    </div>
    <div class="theater-copy theater-copy--muted">
      Route: ${routeLabel}. The action button for this room is pinned directly onto the selected node on the map.
    </div>
  `;

  return renderWindowShell(
    "room",
    THEATER_WINDOW_DEFS.room.title,
    `${THEATER_WINDOW_DEFS.room.kicker} // ${status.toUpperCase()}`,
    body,
    theater,
  );
}

function renderCoreWindow(theater: TheaterNetworkState): string {
  const room = getSelectedRoom(theater);
  const isRoomSecured = room.secured;
  const tabControls = `
    <div class="theater-core-tabs">
      <button class="theater-core-tab ${corePanelTab === "core" ? "theater-core-tab--active" : ""}" type="button" data-theater-core-tab="core">Build C.O.R.E.</button>
      <button class="theater-core-tab ${corePanelTab === "fortifications" ? "theater-core-tab--active" : ""}" type="button" data-theater-core-tab="fortifications">Fortifications</button>
    </div>
  `;

  const coreButtons = (Object.keys(THEATER_CORE_BLUEPRINTS) as CoreType[])
    .map((coreType) => {
      const blueprint = THEATER_CORE_BLUEPRINTS[coreType];
      const incomeLabel = formatResourceCost(blueprint.incomePerTick ?? {});
      return `
        <button
          class="theater-action-btn"
          type="button"
          data-theater-core="${coreType}"
          ${travelAnimation || !isRoomSecured || room.coreAssignment ? "disabled" : ""}
        >
          Build ${blueprint.label}
          <small>Build Cost: ${formatResourceCost(blueprint.buildCost)} // Wad Upkeep Per Tick: ${blueprint.wadUpkeepPerTick} Wad${incomeLabel !== "0" ? ` // Income Per Tick: ${incomeLabel}` : ""}</small>
        </button>
      `;
    })
    .join("");

  const fortificationCapacity = room.fortificationCapacity ?? 3;
  const fortificationCount = getInstalledFortificationCount(room);
  const barricadeCost = formatResourceCost(getFortificationCost("barricade"));
  const powerRailCost = formatResourceCost(getFortificationCost("powerRail"));

  const lockedBody = `
    <div class="theater-copy">
      Secure the selected room before issuing C.O.R.E. construction or fortification orders here.
    </div>
    <div class="theater-copy theater-copy--muted">
      ${room.label} is not secured yet. Move in, clear the room, then return here to build facilities or add Barricades and Power Rails.
    </div>
  `;

  const body = !isRoomSecured
    ? `
      ${tabControls}
      ${lockedBody}
    `
    : corePanelTab === "core"
    ? `
      ${tabControls}
      <div class="theater-copy">
        Convert this secured room into a C.O.R.E. facility. Fortifications are managed in the adjacent tab.
      </div>
      <div class="theater-copy theater-copy--muted">
        Current Assignment: ${formatCoreType(room.coreAssignment?.type ?? null)}
      </div>
      <div class="theater-core-list">
        ${coreButtons}
      </div>
    `
    : `
      ${tabControls}
      <div class="theater-copy">
        Install Barricades and Power Rails after a room is secured. Any combination is allowed until the room's Fortification Slots are full.
      </div>
      <div class="theater-info-grid theater-info-grid--two">
        <div class="theater-stat-card"><span>Fortification Slots</span><strong>${fortificationCount} / ${fortificationCapacity}</strong></div>
        <div class="theater-stat-card"><span>Barricades / Power Rails</span><strong>${room.fortificationPips.barricade} / ${room.fortificationPips.powerRail}</strong></div>
      </div>
      <button class="theater-action-btn" type="button" data-theater-fortify="barricade" ${travelAnimation || !room.secured || fortificationCount >= fortificationCapacity ? "disabled" : ""}>
        Add Barricade
        <small>Build Cost: ${barricadeCost}</small>
      </button>
      <button class="theater-action-btn" type="button" data-theater-fortify="powerRail" ${travelAnimation || !room.secured || fortificationCount >= fortificationCapacity ? "disabled" : ""}>
        Add Power Rail
        <small>Build Cost: ${powerRailCost}</small>
      </button>
    `;

  return renderWindowShell("core", THEATER_WINDOW_DEFS.core.title, THEATER_WINDOW_DEFS.core.kicker, body, theater);
}

function renderFeedWindow(theater: TheaterNetworkState): string {
  const body = `
    <div class="theater-feed-panel">
      <div class="theater-feed-log">
        ${theater.recentEvents
          .map((entry) => `<div class="theater-feed-line">${entry}</div>`)
          .join("")}
      </div>
      <div class="theater-feed-cli" aria-label="QUAC command line placeholder">
        <span class="theater-feed-cli-prompt">Q.U.A.C.&gt;</span>
        <span class="theater-feed-cli-text">theater command line placeholder // future routing and ops macros</span>
        <span class="theater-feed-cli-caret">_</span>
      </div>
    </div>
  `;
  return renderWindowShell("feed", THEATER_WINDOW_DEFS.feed.title, THEATER_WINDOW_DEFS.feed.kicker, body, theater);
}

function renderResourcesWindow(state: GameState, theater: TheaterNetworkState): string {
  const body = `
    <div class="theater-resource-grid">
      <div class="theater-resource-card"><span>Wad</span><strong>${state.wad ?? 0}</strong></div>
      <div class="theater-resource-card"><span>Metal Scrap</span><strong>${state.resources.metalScrap}</strong></div>
      <div class="theater-resource-card"><span>Wood</span><strong>${state.resources.wood}</strong></div>
      <div class="theater-resource-card"><span>Chaos Shards</span><strong>${state.resources.chaosShards}</strong></div>
      <div class="theater-resource-card"><span>Steam Components</span><strong>${state.resources.steamComponents}</strong></div>
    </div>
  `;
  return renderWindowShell("resources", THEATER_WINDOW_DEFS.resources.title, THEATER_WINDOW_DEFS.resources.kicker, body, theater);
}

function renderUpkeepWindow(theater: TheaterNetworkState): string {
  const economy = getTheaterUpkeepPerTick(theater);
  const body = `
    <div class="theater-copy">
      C.O.R.E.s consume Wad for maintenance and can generate passive materials each travel tick inside the active theater.
    </div>
    <div class="theater-resource-grid theater-resource-grid--upkeep">
      <div class="theater-resource-card"><span>Wad Upkeep Per Tick</span><strong>${economy.wadUpkeep}</strong></div>
      <div class="theater-resource-card"><span>Metal Scrap Income Per Tick</span><strong>+${economy.incomePerTick.metalScrap}</strong></div>
      <div class="theater-resource-card"><span>Wood Income Per Tick</span><strong>+${economy.incomePerTick.wood}</strong></div>
      <div class="theater-resource-card"><span>Chaos Shards Income Per Tick</span><strong>+${economy.incomePerTick.chaosShards}</strong></div>
      <div class="theater-resource-card"><span>Steam Components Income Per Tick</span><strong>+${economy.incomePerTick.steamComponents}</strong></div>
    </div>
  `;
  return renderWindowShell("upkeep", THEATER_WINDOW_DEFS.upkeep.title, THEATER_WINDOW_DEFS.upkeep.kicker, body, theater);
}

function renderTheaterWindowDock(theater: TheaterNetworkState): string {
  const frames = ensureTheaterWindowFrames();
  const dockItems = THEATER_WINDOW_ORDER.filter((key) => {
    if (key === "fortify") {
      return false;
    }
    if (key === "core" && !coreWindowUnlockedThisSession) {
      return false;
    }
    return frames[key].minimized;
  });

  if (dockItems.length === 0) {
    return "";
  }

  return `
    <div class="theater-window-dock">
      ${dockItems.map((key) => `
        <button
          class="theater-window-dock-item"
          type="button"
          data-theater-window-restore="${key}"
          aria-label="Restore ${THEATER_WINDOW_DEFS[key].title}"
          style="${getTheaterWindowThemeStyle(key)}"
        >
          <span class="theater-window-dock-kicker">${THEATER_WINDOW_DEFS[key].restoreLabel}</span>
          <span class="theater-window-dock-label">${THEATER_WINDOW_DEFS[key].title}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderCompletionOverlay(
  theater: TheaterNetworkState,
  completion: TheaterObjectiveCompletion,
  canDescend: boolean,
): string {
  return `
    <div class="battle-result-overlay">
      <div class="battle-result-card theater-operation-complete-card">
        <div class="battle-result-title">${theater.definition.name} SECURED</div>
        <div class="battle-result-message">
          ${canDescend
            ? "Floor objective complete. Review the recap, then descend into the next generated theater floor."
            : "Operation objective complete. Review the recap and return to Base Camp."}
        </div>
        <div class="theater-completion-recap">
          ${completion.recapLines.map((line) => `<div class="theater-completion-line">${line}</div>`).join("")}
        </div>
        <div class="battle-reward-grid">
          <div class="battle-reward-item"><div class="reward-label">Wad</div><div class="reward-value">+${completion.reward.wad}</div></div>
          <div class="battle-reward-item"><div class="reward-label">Metal Scrap</div><div class="reward-value">+${completion.reward.metalScrap}</div></div>
          <div class="battle-reward-item"><div class="reward-label">Wood</div><div class="reward-value">+${completion.reward.wood}</div></div>
          <div class="battle-reward-item"><div class="reward-label">Chaos Shards</div><div class="reward-value">+${completion.reward.chaosShards}</div></div>
          <div class="battle-reward-item"><div class="reward-label">Steam Components</div><div class="reward-value">+${completion.reward.steamComponents}</div></div>
        </div>
        <div class="battle-result-footer">
          ${canDescend
            ? `
              <button class="battle-result-btn" type="button" id="theaterCompletionAdvanceBtn">
                Descend To Next Floor
              </button>
            `
            : `
              <button class="battle-result-btn" type="button" id="theaterCompletionReturnBtn">
                Return To Base Camp
              </button>
            `}
        </div>
      </div>
    </div>
  `;
}

function renderTheaterStyles(): string {
  return `
    <style>
      .theater-root {
        position: relative;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        background:
          radial-gradient(circle at 22% 20%, rgba(140, 219, 158, 0.1), transparent 0 20%),
          radial-gradient(circle at 78% 40%, rgba(92, 180, 220, 0.1), transparent 0 24%),
          linear-gradient(180deg, #091013 0%, #101920 48%, #0b0f13 100%);
        color: #eaf3f4;
        font-family: inherit;
      }

      .theater-map-wrap {
        position: absolute;
        inset: 0;
        overflow: hidden;
        background:
          linear-gradient(rgba(132, 197, 155, 0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(132, 197, 155, 0.06) 1px, transparent 1px),
          radial-gradient(circle at 50% 50%, rgba(92, 180, 220, 0.08), transparent 0 55%),
          linear-gradient(180deg, rgba(7, 13, 17, 0.34), rgba(7, 13, 17, 0.18));
        background-size: 72px 72px, 72px 72px, 100% 100%, 100% 100%;
        box-shadow: inset 0 0 64px rgba(0, 0, 0, 0.34);
      }

      .theater-map-world {
        position: absolute;
        left: 50%;
        top: 50%;
        width: ${MAP_WIDTH}px;
        height: ${MAP_HEIGHT}px;
        transform-origin: center center;
        overflow: visible;
      }

      .theater-links {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        pointer-events: none;
      }

      .theater-link {
        stroke: rgba(130, 144, 148, 0.5);
        stroke-width: 6;
        stroke-linecap: round;
        fill: none;
      }

      .theater-link--online {
        stroke: rgba(140, 219, 158, 0.7);
      }

      .theater-link--pressure {
        stroke: rgba(240, 107, 88, 0.9);
      }

      .theater-link--fogged {
        stroke-dasharray: 12 14;
        opacity: 0.4;
      }

      .theater-room-node {
        position: absolute;
        border-radius: 14px;
        border: 1px solid rgba(112, 129, 141, 0.55);
        background:
          linear-gradient(180deg, rgba(154, 170, 181, 0.08), rgba(11, 14, 28, 0)),
          linear-gradient(160deg, rgba(32, 38, 43, 0.96), rgba(56, 64, 71, 0.94));
        color: #ecf5f7;
        cursor: pointer;
        padding: 14px 16px 16px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 6px;
        box-shadow:
          0 16px 32px rgba(0, 0, 0, 0.28),
          inset 0 1px 0 rgba(255, 255, 255, 0.06);
        transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
        user-select: none;
      }

      .theater-room-node:hover {
        transform: scale(1.04);
      }

      .theater-room-node--secured {
        border-color: rgba(132, 197, 155, 0.82);
        background:
          linear-gradient(180deg, rgba(132, 197, 155, 0.16), rgba(11, 14, 28, 0)),
          linear-gradient(160deg, rgba(31, 44, 38, 0.96), rgba(52, 70, 61, 0.94));
      }

      .theater-room-node--mapped {
        border-color: rgba(115, 181, 191, 0.66);
        background:
          linear-gradient(180deg, rgba(115, 181, 191, 0.14), rgba(11, 14, 28, 0)),
          linear-gradient(160deg, rgba(29, 43, 48, 0.96), rgba(47, 70, 80, 0.94));
      }

      .theater-room-node--unknown {
        border-color: rgba(104, 112, 118, 0.42);
        background:
          linear-gradient(180deg, rgba(154, 170, 181, 0.05), rgba(11, 14, 28, 0)),
          linear-gradient(160deg, rgba(16, 20, 24, 0.96), rgba(28, 31, 34, 0.92));
      }

      .theater-room-node--current {
        box-shadow: 0 0 0 4px rgba(255, 204, 110, 0.18), 0 18px 36px rgba(0, 0, 0, 0.4);
      }

      .theater-room-node--selected {
        border-color: rgba(255, 204, 110, 0.9);
      }

      .theater-room-node--threat {
        border-color: rgba(240, 107, 88, 0.95);
        animation: theaterThreatPulse 0.85s ease-in-out infinite;
      }

      .theater-room-node--damaged {
        border-style: dashed;
      }

      .theater-room-node--cut {
        filter: saturate(0.84) brightness(0.86);
      }

      .theater-room-node--fogged .theater-room-label,
      .theater-room-node--fogged .theater-room-role {
        color: rgba(196, 203, 207, 0.45);
      }

      .theater-room-node--uplink {
        box-shadow: 0 0 0 1px rgba(255, 204, 110, 0.26), 0 18px 34px rgba(0, 0, 0, 0.34);
      }

      .theater-room-node--objective {
        border-color: rgba(255, 204, 110, 0.95);
        background:
          linear-gradient(180deg, rgba(255, 204, 110, 0.18), rgba(11, 14, 28, 0)),
          linear-gradient(160deg, rgba(58, 46, 27, 0.96), rgba(77, 63, 52, 0.94));
      }

      .theater-room-node--power {
        border-color: rgba(115, 181, 191, 0.9);
      }

      .theater-room-node--elite {
        box-shadow: 0 0 0 1px rgba(240, 107, 88, 0.2), 0 18px 32px rgba(0, 0, 0, 0.32);
      }

      .theater-room-node--field {
        border-style: dashed;
      }

      .theater-room-node--core-candidate .theater-room-sector {
        color: rgba(168, 224, 180, 0.92);
      }

      @keyframes theaterThreatPulse {
        0%, 100% {
          box-shadow:
            0 0 0 1px rgba(240, 107, 88, 0.28),
            0 16px 32px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }
        50% {
          box-shadow:
            0 0 0 5px rgba(240, 107, 88, 0.34),
            0 18px 42px rgba(240, 107, 88, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
        }
      }

      .theater-room-sector {
        font-size: 0.68rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: rgba(189, 203, 210, 0.72);
      }

      .theater-room-core-icon {
        position: absolute;
        right: 10px;
        top: 10px;
        min-width: 28px;
        border-radius: 10px;
        border: 1px solid rgba(255, 204, 110, 0.45);
        background: rgba(30, 24, 16, 0.92);
        color: #ffcc6e;
        padding: 6px 8px;
        font-size: 0.58rem;
        font-weight: 900;
        letter-spacing: 0.14em;
        text-align: center;
      }

      .theater-room-label {
        font-size: 0.98rem;
        font-weight: 900;
        line-height: 1.05;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .theater-room-role {
        font-size: 0.66rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(255, 204, 110, 0.9);
      }

      .theater-room-flags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 16px;
      }

      .theater-chip {
        border-radius: 6px;
        border: 1px solid rgba(154, 170, 181, 0.18);
        background: rgba(0, 0, 0, 0.18);
        padding: 3px 8px;
        font-size: 0.5rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(234, 239, 241, 0.72);
      }

      .theater-chip--good {
        color: #8cdb9e;
      }

      .theater-chip--power {
        color: #9ed8de;
      }

      .theater-chip--comms {
        color: #ffcc6e;
      }

      .theater-chip--bad {
        color: #f06b58;
      }

      .theater-current-room-badge {
        position: absolute;
        left: 14px;
        top: -12px;
        border-radius: 999px;
        border: 1px solid rgba(255, 204, 110, 0.45);
        background: rgba(47, 34, 16, 0.98);
        padding: 4px 10px;
        font-size: 0.56rem;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #ffcc6e;
      }

      .theater-room-move-btn {
        position: absolute;
        left: 14px;
        right: 14px;
        bottom: -24px;
        border-radius: 16px;
        border: 1px solid rgba(255, 204, 110, 0.55);
        background: rgba(60, 43, 18, 0.98);
        color: #fff4dd;
        padding: 10px 14px;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        cursor: pointer;
        box-shadow: 0 12px 26px rgba(0, 0, 0, 0.3);
      }

      .theater-room-move-btn small {
        display: block;
        margin-top: 4px;
        font-size: 0.58rem;
        font-weight: 500;
        color: rgba(255, 239, 212, 0.72);
      }

      .theater-room-move-btn:disabled {
        opacity: 0.45;
        cursor: default;
      }

      .theater-squad-marker {
        position: absolute;
        width: 60px;
        height: 60px;
        margin-left: -30px;
        margin-top: -30px;
        border-radius: 50%;
        border: 2px solid rgba(255, 204, 110, 0.95);
        background: radial-gradient(circle, rgba(255, 204, 110, 0.45), rgba(255, 204, 110, 0.12));
        color: #fff7e7;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.62rem;
        font-weight: 900;
        letter-spacing: 0.12em;
        pointer-events: none;
        z-index: 4;
      }

      .theater-squad-marker--moving {
        animation: theaterTravel var(--travel-duration) ease-in-out forwards;
      }

      @keyframes theaterTravel {
        from { transform: translate(0, 0) scale(1); }
        50% { transform: translate(calc(var(--travel-dx) * 0.5), calc(var(--travel-dy) * 0.5)) scale(1.2); }
        to { transform: translate(var(--travel-dx), var(--travel-dy)) scale(1); }
      }

      .theater-map-zoom-controls {
        position: absolute;
        left: 50%;
        bottom: 28px;
        transform: translateX(-50%);
        z-index: 20;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(8, 12, 15, 0.9);
      }

      .theater-zoom-btn {
        border-radius: 999px;
        border: 1px solid rgba(132, 197, 155, 0.26);
        background: rgba(18, 28, 24, 0.94);
        color: #edf4ef;
        padding: 10px 16px;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        cursor: pointer;
      }

      .theater-zoom-value {
        min-width: 64px;
        text-align: center;
        font-size: 0.68rem;
        letter-spacing: 0.16em;
        color: #ffcc6e;
      }

      .theater-window {
        position: absolute;
        display: flex;
        flex-direction: column;
        border-radius: 14px;
        border: 1px solid var(--all-nodes-border, rgba(122, 92, 214, 0.46));
        background:
          linear-gradient(180deg, var(--all-nodes-accent-soft, rgba(192, 179, 255, 0.12)), rgba(11, 14, 28, 0)),
          linear-gradient(160deg, var(--all-nodes-surface-bg, rgba(10, 14, 28, 0.96)), var(--all-nodes-panel-bg, rgba(20, 18, 40, 0.94)));
        box-shadow:
          0 18px 42px rgba(0, 0, 0, 0.42),
          inset 0 1px 0 rgba(255, 255, 255, 0.08),
          0 0 0 1px var(--all-nodes-surface-border, rgba(192, 179, 255, 0.12));
        overflow: hidden;
        backdrop-filter: blur(10px);
      }

      .theater-window::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(135deg, var(--all-nodes-accent-soft, rgba(149, 118, 255, 0.08)), transparent 40%),
          linear-gradient(0deg, rgba(255, 255, 255, 0.02), transparent 55%);
        pointer-events: none;
      }

      .theater-window-header {
        position: relative;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 10px 12px 9px;
        background:
          linear-gradient(180deg, var(--all-nodes-panel-hover-bg, rgba(28, 20, 56, 0.92)), var(--all-nodes-surface-bg, rgba(18, 16, 38, 0.84)));
        border-bottom: 1px solid var(--all-nodes-surface-border, rgba(122, 92, 214, 0.22));
        cursor: grab;
        user-select: none;
        touch-action: none;
      }

      .theater-window-header:active {
        cursor: grabbing;
      }

      .theater-window-meta {
        min-width: 0;
      }

      .theater-window-kicker {
        font-size: 9px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--all-nodes-muted, rgba(191, 172, 255, 0.64));
      }

      .theater-window-title {
        margin: 2px 0 0;
        font-size: 12px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--all-nodes-text, #f1edff);
      }

      .theater-window-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .theater-window-grip {
        font-family: var(--font-terminal, 'JetBrains Mono', monospace);
        font-size: 0.74rem;
        letter-spacing: 0.18em;
        color: var(--all-nodes-accent, #ffcc6e);
      }

      .theater-window-color,
      .theater-window-minimize {
        width: 26px;
        height: 26px;
        padding: 0;
        border: 1px solid var(--all-nodes-surface-border, rgba(168, 124, 69, 0.25));
        border-radius: 4px;
        background: var(--all-nodes-accent-soft, rgba(255, 204, 110, 0.12));
        color: var(--all-nodes-accent, #ffcc6e);
        font-family: var(--font-terminal, 'JetBrains Mono', monospace);
        font-size: 0.75rem;
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
      }

      .theater-window-color {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .theater-window-color-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--all-nodes-accent, #ffcc6e);
        box-shadow: 0 0 8px var(--all-nodes-glow, rgba(168, 124, 69, 0.2));
      }

      .theater-window-minimize {
        font-weight: 700;
      }

      .theater-window-color:hover,
      .theater-window-minimize:hover {
        background: var(--all-nodes-accent-soft, rgba(255, 204, 110, 0.18));
        border-color: var(--all-nodes-border-hover, #a87c45);
        box-shadow: 0 0 10px var(--all-nodes-glow, rgba(168, 124, 69, 0.18));
      }

      .theater-window-body {
        position: relative;
        z-index: 1;
        flex: 1;
        min-width: 0;
        min-height: 0;
        padding: 14px;
        overflow: auto;
      }

      .theater-window-resize {
        position: absolute;
        right: 0.2rem;
        bottom: 0.2rem;
        z-index: 4;
        width: 22px;
        height: 22px;
        border: 0;
        background:
          linear-gradient(135deg, transparent 34%, rgba(206, 212, 218, 0.82) 34%, rgba(206, 212, 218, 0.82) 48%, transparent 48%),
          linear-gradient(135deg, transparent 52%, rgba(176, 183, 191, 0.76) 52%, rgba(176, 183, 191, 0.76) 66%, transparent 66%),
          linear-gradient(135deg, transparent 70%, rgba(138, 146, 155, 0.72) 70%, rgba(138, 146, 155, 0.72) 82%, transparent 82%);
        opacity: 0.9;
        filter: drop-shadow(0 0 6px rgba(102, 108, 116, 0.22));
        cursor: nwse-resize;
        touch-action: none;
      }

      .theater-window-resize:hover {
        opacity: 1;
      }

      .theater-copy {
        font-size: 0.82rem;
        line-height: 1.45;
        color: #d6e0e7;
      }

      .theater-copy--muted {
        margin-top: 10px;
        color: #9aaab5;
      }

      .theater-info-grid,
      .theater-resource-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 12px;
      }

      .theater-info-grid--two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .theater-stat-card,
      .theater-resource-card {
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        background: rgba(255, 255, 255, 0.03);
        padding: 10px 12px;
      }

      .theater-stat-card span,
      .theater-resource-card span {
        display: block;
        font-size: 0.58rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #96a2ab;
      }

      .theater-stat-card strong,
      .theater-resource-card strong {
        display: block;
        margin-top: 6px;
        font-size: 0.78rem;
        color: #ecf5f7;
      }

      .theater-inline-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 12px;
      }

      .theater-action-btn,
      .theater-secondary-btn,
      .theater-completion-btn {
        width: 100%;
        border-radius: 14px;
        border: 1px solid var(--all-nodes-surface-border, rgba(132, 197, 155, 0.26));
        background: var(--all-nodes-accent-soft, rgba(20, 30, 27, 0.9));
        color: var(--all-nodes-text, #edf4ef);
        padding: 12px 14px;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        text-align: left;
        cursor: pointer;
      }

      .theater-action-btn {
        margin-top: 10px;
      }

      .theater-action-btn small {
        display: block;
        margin-top: 6px;
        font-size: 0.62rem;
        font-weight: 500;
        letter-spacing: 0.08em;
        color: var(--all-nodes-muted, #9aaab5);
        text-transform: none;
      }

      .theater-secondary-btn,
      .theater-completion-btn {
        text-align: center;
      }

      .theater-action-btn:disabled,
      .theater-secondary-btn:disabled {
        opacity: 0.45;
        cursor: default;
      }

      .theater-room-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }

      .theater-room-title {
        font-size: 1.1rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .theater-room-subtitle {
        margin-top: 6px;
        font-size: 0.68rem;
        letter-spacing: 0.12em;
        color: var(--all-nodes-muted, #9aaab5);
      }

      .theater-status-pill {
        border-radius: 999px;
        border: 1px solid var(--all-nodes-border, rgba(255, 204, 110, 0.4));
        color: var(--all-nodes-accent, #ffcc6e);
        padding: 8px 12px;
        font-size: 0.62rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .theater-core-list,
      .theater-feed-log {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }

      .theater-core-tabs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 12px;
      }

      .theater-core-tab {
        border-radius: 10px;
        border: 1px solid var(--all-nodes-surface-border, rgba(255, 255, 255, 0.08));
        background: rgba(255, 255, 255, 0.03);
        color: var(--all-nodes-muted, #9aaab5);
        padding: 10px 12px;
        font-size: 0.64rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
      }

      .theater-core-tab--active {
        border-color: var(--all-nodes-border-hover, rgba(255, 204, 110, 0.45));
        background: var(--all-nodes-accent-soft, rgba(255, 204, 110, 0.12));
        color: var(--all-nodes-accent, #ffcc6e);
      }

      .theater-feed-panel {
        display: flex;
        flex-direction: column;
        min-height: 100%;
      }

      .theater-feed-line {
        border-radius: 12px;
        border: 1px solid var(--all-nodes-surface-border, rgba(255, 255, 255, 0.08));
        background: rgba(255, 255, 255, 0.03);
        padding: 10px 12px;
        font-size: 0.74rem;
        line-height: 1.45;
        color: var(--all-nodes-text, #d5e0e8);
      }

      .theater-feed-cli {
        margin-top: auto;
        border-radius: 12px;
        border: 1px solid var(--all-nodes-surface-border, rgba(255, 255, 255, 0.08));
        background: rgba(0, 0, 0, 0.22);
        padding: 10px 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: var(--font-terminal, 'JetBrains Mono', monospace);
        font-size: 0.72rem;
        letter-spacing: 0.08em;
      }

      .theater-feed-cli-prompt {
        color: #8cdb9e;
        font-weight: 800;
      }

      .theater-feed-cli-text {
        flex: 1;
        min-width: 0;
        color: rgba(229, 240, 242, 0.76);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .theater-feed-cli-caret {
        color: #ffcc6e;
      }

      .theater-resource-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .theater-resource-grid--upkeep {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .theater-window-dock {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 800;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .theater-window-dock-item {
        min-width: 160px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 10px 12px;
        border: 1px solid var(--all-nodes-border, rgba(122, 92, 214, 0.42));
        border-radius: 10px;
        background: var(--all-nodes-surface-bg, rgba(13, 14, 28, 0.94));
        color: var(--all-nodes-text, #f1edff);
        cursor: pointer;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.32);
        transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
      }

      .theater-window-dock-item:hover {
        transform: translateY(-1px);
        background: var(--all-nodes-panel-hover-bg, rgba(25, 20, 46, 0.98));
        border-color: var(--all-nodes-border-hover, rgba(166, 138, 255, 0.62));
      }

      .theater-window-dock-kicker {
        font-size: 9px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--all-nodes-muted, rgba(191, 172, 255, 0.66));
      }

      .theater-window-dock-label {
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .theater-operation-complete-card {
        width: min(760px, calc(100vw - 40px));
      }

      .theater-root .battle-result-overlay {
        z-index: 10000;
      }

      .theater-completion-recap {
        margin-top: 18px;
        display: grid;
        gap: 8px;
      }

      .theater-completion-line {
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(0, 0, 0, 0.22);
        padding: 12px 14px;
        font-size: 0.8rem;
        color: #d5e0e8;
      }
    </style>
  `;
}

function focusWindowElement(key: TheaterWindowKey): void {
  focusWindow(key);
  const node = document.querySelector<HTMLElement>(`[data-theater-window="${key}"]`);
  if (node) {
    node.style.zIndex = String(ensureTheaterWindowFrames()[key].zIndex);
  }
  persistTheaterUiLayoutToState();
}

function startDragSession(key: TheaterWindowKey, mode: "drag" | "resize", event: MouseEvent): void {
  focusWindowElement(key);
  activeDragSession = {
    key,
    mode,
    startX: event.clientX,
    startY: event.clientY,
    startFrame: { ...ensureTheaterWindowFrames()[key] },
  };
  document.body.style.userSelect = "none";
}

function clampFrame(key: TheaterWindowKey, frame: TheaterWindowFrame): TheaterWindowFrame {
  const defaults = createDefaultTheaterWindowFrames();
  return normalizeTheaterWindowFrame(key, frame, defaults[key]);
}


function applyWindowFrameToDom(key: TheaterWindowKey): void {
  const node = document.querySelector<HTMLElement>(`[data-theater-window="${key}"]`);
  if (!node) {
    return;
  }

  const frame = ensureTheaterWindowFrames()[key];
  node.style.left = `${frame.x}px`;
  node.style.top = `${frame.y}px`;
  node.style.width = `${frame.width}px`;
  node.style.height = `${frame.height}px`;
  node.style.zIndex = `${frame.zIndex}`;
}

function captureWindowFramesFromDom(): void {
  const frames = ensureTheaterWindowFrames();

  document.querySelectorAll<HTMLElement>("[data-theater-window]").forEach((node) => {
    const key = node.getAttribute("data-theater-window") as TheaterWindowKey | null;
    if (!key) {
      return;
    }

    const left = Number.parseFloat(node.style.left);
    const top = Number.parseFloat(node.style.top);
    const width = Number.parseFloat(node.style.width);
    const height = Number.parseFloat(node.style.height);
    const zIndex = Number.parseInt(node.style.zIndex, 10);

    frames[key] = clampFrame(key, {
      ...frames[key],
      x: Number.isFinite(left) ? left : frames[key].x,
      y: Number.isFinite(top) ? top : frames[key].y,
      width: Number.isFinite(width) ? width : frames[key].width,
      height: Number.isFinite(height) ? height : frames[key].height,
      zIndex: Number.isFinite(zIndex) ? zIndex : frames[key].zIndex,
    });
  });
}

function ensureDragDocumentListeners(): void {
  if (dragMoveHandler && dragUpHandler) {
    return;
  }

  dragMoveHandler = (event: MouseEvent) => {
    if (!activeDragSession) {
      return;
    }

    const dx = event.clientX - activeDragSession.startX;
    const dy = event.clientY - activeDragSession.startY;
    const nextFrame =
      activeDragSession.mode === "drag"
        ? clampFrame(activeDragSession.key, {
            ...activeDragSession.startFrame,
            x: activeDragSession.startFrame.x + dx,
            y: activeDragSession.startFrame.y + dy,
          })
        : clampFrame(activeDragSession.key, {
            ...activeDragSession.startFrame,
            width: activeDragSession.startFrame.width + dx,
            height: activeDragSession.startFrame.height + dy,
          });

    ensureTheaterWindowFrames()[activeDragSession.key] = nextFrame;
    applyWindowFrameToDom(activeDragSession.key);
    persistTheaterUiLayoutToState();
  };

  dragUpHandler = () => {
    activeDragSession = null;
    document.body.style.userSelect = "";
    persistTheaterUiLayoutToState();
  };

  document.addEventListener("mousemove", dragMoveHandler);
  document.addEventListener("mouseup", dragUpHandler);
}

function syncThreatPings(theater: TheaterNetworkState, mountSignature: string): void {
  const activeThreats = theater.activeThreats.filter((threat) => threat.active);
  if (lastMountedTheaterSignature !== mountSignature) {
    seenThreatIds = new Set(activeThreats.map((threat) => threat.id));
    return;
  }

  activeThreats.forEach((threat) => {
    if (seenThreatIds.has(threat.id)) {
      return;
    }

    const room = theater.rooms[threat.roomId];
    showSystemPing({
      type: "error",
      title: "Room Destabilized",
      message: room ? `${room.label} is under threat.` : `Room ${threat.roomId} is under threat.`,
      detail: "Travel back to the room and launch a defense battle.",
      channel: "theater-threat",
      replaceChannel: true,
      durationMs: 4200,
    });
    seenThreatIds.add(threat.id);
  });

  const nextThreatIds = new Set(activeThreats.map((threat) => threat.id));
  seenThreatIds = new Set([...seenThreatIds].filter((id) => nextThreatIds.has(id)));
}

function cleanupTheaterMapControls(): void {
  if (mapKeyHandler) {
    window.removeEventListener("keydown", mapKeyHandler);
    mapKeyHandler = null;
  }

  if (mapKeyUpHandler) {
    window.removeEventListener("keyup", mapKeyUpHandler);
    mapKeyUpHandler = null;
  }

  if (mapPanFrameId !== null) {
    window.cancelAnimationFrame(mapPanFrameId);
    mapPanFrameId = null;
  }

  mapPanKeys.clear();
}

function readGamepadPanDelta(): { dx: number; dy: number } {
  if (typeof navigator.getGamepads !== "function") {
    return { dx: 0, dy: 0 };
  }

  const gamepads = navigator.getGamepads();
  const pad = gamepads.find((candidate) => candidate && candidate.connected);
  if (!pad) {
    return { dx: 0, dy: 0 };
  }

  const axisX = pad.axes[2] ?? 0;
  const axisY = pad.axes[3] ?? 0;
  if (Math.abs(axisX) < MAP_STICK_DEADZONE && Math.abs(axisY) < MAP_STICK_DEADZONE) {
    return { dx: 0, dy: 0 };
  }

  return {
    dx: -axisX * MAP_STICK_PAN_SPEED,
    dy: -axisY * MAP_STICK_PAN_SPEED,
  };
}

function startMapPanLoop(): void {
  if (mapPanFrameId !== null) {
    return;
  }

  const tick = () => {
    if (!document.querySelector(".theater-root")) {
      cleanupTheaterMapControls();
      return;
    }

    let dx = 0;
    let dy = 0;
    if (!activeDragSession && !travelAnimation) {
      if (mapPanKeys.has("w") || mapPanKeys.has("arrowup")) dy += MAP_PAN_STEP * 0.24;
      if (mapPanKeys.has("s") || mapPanKeys.has("arrowdown")) dy -= MAP_PAN_STEP * 0.24;
      if (mapPanKeys.has("a") || mapPanKeys.has("arrowleft")) dx += MAP_PAN_STEP * 0.24;
      if (mapPanKeys.has("d") || mapPanKeys.has("arrowright")) dx -= MAP_PAN_STEP * 0.24;

      const stickDelta = readGamepadPanDelta();
      dx += stickDelta.dx;
      dy += stickDelta.dy;
    }

    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      panMapBy(dx, dy);
    }

    mapPanFrameId = window.requestAnimationFrame(tick);
  };

  mapPanFrameId = window.requestAnimationFrame(tick);
}

function ensureTheaterMapControls(): void {
  if (!mapKeyHandler) {
    mapKeyHandler = (event: KeyboardEvent) => {
      if (!document.querySelector(".theater-root") || activeDragSession || travelAnimation) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, [contenteditable='true']")) {
        return;
      }

      const key = event.key?.toLowerCase();
      if (key === "w" || key === "s" || key === "a" || key === "d" || key === "arrowup" || key === "arrowdown" || key === "arrowleft" || key === "arrowright") {
        event.preventDefault();
        mapPanKeys.add(key);
        startMapPanLoop();
      }
    };
    window.addEventListener("keydown", mapKeyHandler);
  }

  if (!mapKeyUpHandler) {
    mapKeyUpHandler = (event: KeyboardEvent) => {
      mapPanKeys.delete(event.key?.toLowerCase() ?? "");
    };
    window.addEventListener("keyup", mapKeyUpHandler);
  }

  startMapPanLoop();
}

function returnToBaseCamp(clearOperation: boolean): void {
  clearTravelTimer();
  cleanupTheaterMapControls();
  travelAnimation = null;
  lastMountedTheaterSignature = null;
  hydratedTheaterLayoutSignature = null;
  coreWindowUnlockedThisSession = false;
  seenThreatIds = new Set();

  if (clearOperation) {
    updateGameState((state) => ({
      ...state,
      phase: "field",
      operation: null,
      currentBattle: null,
    }));
  }

  import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
    renderFieldScreen("base_camp");
  });
}

function launchTheaterBattle(roomId: string): void {
  cleanupTheaterMapControls();
  const battle = createTheaterBattleState(getGameState(), roomId);
  if (!battle) {
    alert("Unable to initialize theater battle for this room.");
    renderTheaterCommandScreen();
    return;
  }

  updateGameState((state) => ({
    ...state,
    phase: "battle",
    currentBattle: { ...battle, turnIndex: 0 } as any,
  }));

  import("./BattleScreen").then(({ renderBattleScreen }) => renderBattleScreen());
}

function getFieldSeedForTheaterRoom(roomId: string): number {
  return roomId.split("").reduce((seed, char, index) => (
    ((seed * 31) + char.charCodeAt(0) + index) >>> 0
  ), 1701);
}

function launchTheaterFieldRoom(roomId: string): void {
  clearTravelTimer();
  cleanupTheaterMapControls();
  travelAnimation = null;
  import("./FieldNodeRoomScreen").then(({ renderFieldNodeRoomScreen }) => {
    renderFieldNodeRoomScreen(roomId, getFieldSeedForTheaterRoom(roomId));
  });
}

function queueTravelRouteAnimation(route: string[], segmentDurationMs: number, onComplete: () => void): void {
  if (route.length < 2) {
    onComplete();
    return;
  }

  const [fromRoomId, toRoomId, ...rest] = route;
  clearTravelTimer();
  travelAnimation = { fromRoomId, toRoomId, durationMs: segmentDurationMs };
  renderTheaterCommandScreen();

  travelTimerId = window.setTimeout(() => {
    travelTimerId = null;
    travelAnimation = null;
    if (rest.length > 0) {
      queueTravelRouteAnimation([toRoomId, ...rest], segmentDurationMs, onComplete);
      return;
    }
    onComplete();
  }, segmentDurationMs);
}

function handleMoveToSelectedRoom(theater: TheaterNetworkState): void {
  const selectedRoom = getSelectedRoom(theater);
  const fromRoomId = theater.currentRoomId;
  const moveOutcome = moveToTheaterRoom(getGameState(), selectedRoom.id);
  updateGameState(() => moveOutcome.state);

  if (moveOutcome.error) {
    alert(moveOutcome.error);
    renderTheaterCommandScreen();
    return;
  }

  const completeMove = () => {
    if (moveOutcome.requiresBattle) {
      launchTheaterBattle(moveOutcome.roomId);
      return;
    }
    if (moveOutcome.requiresField) {
      launchTheaterFieldRoom(moveOutcome.roomId);
      return;
    }
    renderTheaterCommandScreen();
  };

  if (fromRoomId !== selectedRoom.id && moveOutcome.tickCost > 0 && moveOutcome.path.length > 1) {
    const segmentDurationMs = Math.max(220, Math.round((420 + moveOutcome.tickCost * 220) / (moveOutcome.path.length - 1)));
    queueTravelRouteAnimation(moveOutcome.path, segmentDurationMs, completeMove);
    return;
  }

  completeMove();
}

function descendToNextTheaterFloor(): void {
  clearTravelTimer();
  cleanupTheaterMapControls();
  travelAnimation = null;

  const currentState = getGameState();
  const operation = ensureOperationHasTheater(currentState.operation);
  if (!operation) {
    return;
  }

  try {
    advanceCampaignToNextFloor({ bypassExitRequirement: true });
  } catch (error) {
    console.warn("[THEATER] local floor advance without campaign sync", error);
  }

  const nextFloorIndex = Math.min(operation.currentFloorIndex + 1, Math.max(0, operation.floors.length - 1));
  updateGameState((state) => {
    const activeOperation = ensureOperationHasTheater(state.operation);
    if (!activeOperation) {
      return state;
    }

    return {
      ...state,
      phase: "operation",
      currentBattle: null,
      operation: ensureOperationHasTheater({
        ...activeOperation,
        currentFloorIndex: nextFloorIndex,
        currentRoomId: null,
        theater: null,
      }),
    };
  });

  renderTheaterCommandScreen();
}

function completeTheaterOperationAndReturn(): void {
  try {
    completeOperationRun();
  } catch (error) {
    console.warn("[THEATER] complete run without campaign record", error);
  }
  returnToBaseCamp(true);
}

function attachCompletionHandlers(canDescend: boolean): void {
  if (canDescend) {
    document.getElementById("theaterCompletionAdvanceBtn")?.addEventListener("click", () => {
      descendToNextTheaterFloor();
    });
    return;
  }

  document.getElementById("theaterCompletionReturnBtn")?.addEventListener("click", () => {
    completeTheaterOperationAndReturn();
  });
}

function attachWindowHandlers(): void {
  ensureDragDocumentListeners();

  document.querySelectorAll<HTMLElement>("[data-theater-window-minimize]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const key = button.getAttribute("data-theater-window-minimize") as TheaterWindowKey | null;
      if (!key) return;
      setTheaterWindowMinimized(key, true);
      persistTheaterUiLayoutToState();
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-window-color]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const key = button.getAttribute("data-theater-window-color") as TheaterWindowKey | null;
      if (!key) return;
      cycleTheaterWindowColor(key);
      persistTheaterUiLayoutToState();
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-window-restore]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const key = button.getAttribute("data-theater-window-restore") as TheaterWindowKey | null;
      if (!key) return;
      setTheaterWindowMinimized(key, false);
      persistTheaterUiLayoutToState();
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-window-drag]").forEach((header) => {
    header.addEventListener("mousedown", (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-theater-window-minimize], [data-theater-window-color]")) {
        return;
      }
      const key = header.getAttribute("data-theater-window-drag") as TheaterWindowKey | null;
      if (!key) return;
      event.preventDefault();
      startDragSession(key, "drag", event);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-window-resize]").forEach((handle) => {
    handle.addEventListener("mousedown", (event) => {
      const key = handle.getAttribute("data-theater-window-resize") as TheaterWindowKey | null;
      if (!key) return;
      event.preventDefault();
      event.stopPropagation();
      startDragSession(key, "resize", event);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-window]").forEach((windowNode) => {
    windowNode.addEventListener("mousedown", () => {
      const key = windowNode.getAttribute("data-theater-window") as TheaterWindowKey | null;
      if (!key) return;
      focusWindowElement(key);
    });
  });
}

function attachTheaterHandlers(theater: TheaterNetworkState): void {
  attachWindowHandlers();
  ensureTheaterMapControls();

  document.querySelectorAll<HTMLElement>("[data-theater-room-id]").forEach((node) => {
    node.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("[data-theater-move-button]")) {
        return;
      }
      const roomId = node.getAttribute("data-theater-room-id");
      if (!roomId) {
        return;
      }
      persistTheaterUiLayoutToState();
      updateGameState((state) => setTheaterSelectedRoom(state, roomId));
      renderTheaterCommandScreen();
    });
  });

  document.querySelector("[data-theater-move-button]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handleMoveToSelectedRoom(theater);
  });

  document.getElementById("theaterZoomInBtn")?.addEventListener("click", () => {
    setMapZoom(mapZoom + MAP_ZOOM_STEP);
  });

  document.getElementById("theaterZoomOutBtn")?.addEventListener("click", () => {
    setMapZoom(mapZoom - MAP_ZOOM_STEP);
  });

  document.getElementById("theaterMapWrap")?.addEventListener("wheel", (event) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -MAP_ZOOM_STEP : MAP_ZOOM_STEP;
    setMapZoom(mapZoom + direction);
  }, { passive: false });

  document.getElementById("theaterManageUnitsBtn")?.addEventListener("click", () => {
    clearTravelTimer();
    cleanupTheaterMapControls();
    travelAnimation = null;
    import("./RosterScreen").then(({ renderRosterScreen }) => renderRosterScreen("operation"));
  });

  document.getElementById("theaterReturnToBaseBtn")?.addEventListener("click", () => {
    returnToBaseCamp(false);
  });

  document.querySelectorAll<HTMLElement>("[data-theater-fortify]").forEach((button) => {
    button.addEventListener("click", () => {
      const fortification = button.getAttribute("data-theater-fortify");
      if (fortification !== "barricade" && fortification !== "powerRail") {
        return;
      }

      const outcome = fortifyTheaterRoom(getGameState(), theater.selectedRoomId, fortification);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-core]").forEach((button) => {
    button.addEventListener("click", () => {
      const coreType = button.getAttribute("data-theater-core") as CoreType | null;
      if (!coreType) {
        return;
      }

      const outcome = buildCoreInTheaterRoom(getGameState(), theater.selectedRoomId, coreType);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-core-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = button.getAttribute("data-theater-core-tab");
      if (nextTab !== "core" && nextTab !== "fortifications") {
        return;
      }
      corePanelTab = nextTab;
      persistTheaterUiLayoutToState();
      renderTheaterCommandScreen();
    });
  });
}

export function renderTheaterCommandScreen(): void {
  const root = document.getElementById("app");
  if (!root) {
    return;
  }

  captureWindowFramesFromDom();
  const currentState = getGameState();
  const hadCompletedBeforeSync =
    currentState.operation?.theater
      ? hasCompletedTheaterObjective(currentState.operation.theater)
      : false;
  const ensuredOperation = ensureOperationHasTheater(currentState.operation);
  if (!ensuredOperation?.theater) {
    root.innerHTML = `<div style="padding:24px;color:#fff;">No active theater operation.</div>`;
    return;
  }

  const mountSignature = `${ensuredOperation.id ?? ensuredOperation.codename}:${ensuredOperation.theater.definition.id}`;
  if (lastMountedTheaterSignature !== mountSignature) {
    coreWindowUnlockedThisSession = false;
  }
  hydrateTheaterUiLayoutFromState(mountSignature);
  normalizeAllTheaterWindowFrames();
  if (lastMountedTheaterSignature !== mountSignature) {
    focusMapOnTheater(ensuredOperation.theater, true);
  }

  const syncedCompletion = ensuredOperation.theater.completion;
  const shouldGrantCompletionReward =
    Boolean(syncedCompletion) &&
    hasCompletedTheaterObjective(ensuredOperation.theater) &&
    !hadCompletedBeforeSync;

  updateGameState((state) => ({
    ...state,
    phase: "operation",
    wad: shouldGrantCompletionReward ? state.wad + (syncedCompletion?.reward.wad ?? 0) : state.wad,
    resources: shouldGrantCompletionReward && syncedCompletion
      ? {
          metalScrap: state.resources.metalScrap + syncedCompletion.reward.metalScrap,
          wood: state.resources.wood + syncedCompletion.reward.wood,
          chaosShards: state.resources.chaosShards + syncedCompletion.reward.chaosShards,
          steamComponents: state.resources.steamComponents + syncedCompletion.reward.steamComponents,
        }
      : state.resources,
    operation: ensuredOperation,
  }));

  const state = getGameState();
  const theater = ensuredOperation.theater;
  if (getSelectedRoom(theater).secured) {
    coreWindowUnlockedThisSession = true;
  }
  syncThreatPings(theater, mountSignature);
  if (lastMountedTheaterSignature !== mountSignature) {
    console.log("[THEATER] screen mounted", theater.definition.id, theater.definition.name);
    lastMountedTheaterSignature = mountSignature;
  }

  const completion = theater.completion;
  const canDescend = ensuredOperation.currentFloorIndex < ensuredOperation.floors.length - 1;
  const completionOverlay =
    hasCompletedTheaterObjective(theater) && completion
      ? renderCompletionOverlay(theater, completion, canDescend)
      : "";

  root.innerHTML = `
    ${renderTheaterStyles()}
    <div class="theater-root">
      ${renderTheaterMap(theater)}
      ${renderOpsWindow(theater, ensuredOperation.floors.length)}
      ${renderSelectedRoomWindow(theater)}
      ${renderCoreWindow(theater)}
      ${renderFeedWindow(theater)}
      ${renderResourcesWindow(state, theater)}
      ${renderUpkeepWindow(theater)}
      ${renderTheaterWindowDock(theater)}
      ${completionOverlay}
    </div>
  `;

  attachTheaterHandlers(theater);
  if (completionOverlay) {
    attachCompletionHandlers(canDescend);
  }
}

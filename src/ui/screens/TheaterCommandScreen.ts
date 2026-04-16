import { getGameState, updateGameState } from "../../state/gameStore";
import { getActiveQuests, initializeQuestState } from "../../quests/questManager";
import {
  advanceToNextFloor as advanceCampaignToNextFloor,
  completeOperationRun,
} from "../../core/campaignManager";
import {
  CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL,
  hasSeenEndingCutscene,
  markEndingCutsceneSeen,
  unlockCampaignPostgame,
} from "../../core/campaign";
import {
  applyWarmTheaterEconomyToState,
  getOpsTerminalAtlasOtherWarmEconomySummaries,
  isOpsTerminalAtlasOperation,
  OpsTerminalAtlasEconomySummary,
  syncOpsTerminalOperationState,
} from "../../core/opsTerminalAtlas";
import {
  ANNEX_FRAME_DEFINITIONS,
  FOUNDRY_MODULE_DEFINITIONS,
  FOUNDRY_PARTITION_DEFINITIONS,
  getOrderedFoundryModuleTypes,
  isModuleTypeUnlocked,
  isPartitionTypeUnlocked,
} from "../../core/foundrySystem";
import {
  THEATER_SQUAD_COLOR_CHOICES,
  THEATER_SQUAD_ICON_CHOICES,
  THEATER_CORE_BLUEPRINTS,
  buildTheaterAnnex,
  buildCoreInTheaterRoom,
  canManuallyControlTheaterSquad,
  configureTheaterModule,
  createScopedTheaterStateForSessionSlot,
  createTheaterBattleState,
  destroyTheaterAnnex,
  destroyTheaterCore,
  destroyTheaterFortification,
  ensureOperationHasTheater,
  fabricateFieldAssetInTheaterRoom,
  getFieldAssetPlacementError,
  formatTheaterKeyLabel,
  formatResourceCost,
  fortifyTheaterRoom,
  clearCurrentTheaterOperationInjuries,
  getTheaterRoomBattleMapId,
  getPreparedTheaterOperation,
  getFortificationCost,
  getTheaterRoomTacticalMap,
  getTheaterCoreRepairCost,
  getTheaterSelectedNode,
  getSelectedTheaterSquad,
  getTheaterPassagePowerRequirement,
  getTheaterObjectiveDefinition,
  getPendingTheaterBattleConfirmationForSessionSlot,
  getPreparedTheaterOperationForSessionSlot,
  getTheaterRoomModuleSlotUpgradeCost,
  getMoveTickCost,
  getTheaterCoreOfflineReason,
  getTheaterCoreOperationalRequirements,
  getTheaterRoomCoreAssignments,
  getTheaterRoomOpenCoreSlots,
  getTheaterUpkeepPerTick,
  hasCompletedTheaterObjective,
  holdPositionInTheater,
  hasTheaterKey,
  issueTheaterRoomCommandForSessionSlot,
  isTheaterCoreOperational,
  isTheaterPassagePowered,
  isTheaterRoomLocked,
  installTheaterModule,
  installTheaterPartition,
  mergeTheaterSquads,
  moveToTheaterNode,
  mergeScopedTheaterStateForSessionSlot,
  renameTheaterSquad,
  removeFieldAssetFromTheaterRoom,
  removeTheaterModule,
  refuseTheaterDefense,
  repairTheaterCore,
  resetTheaterModuleState,
  selectTheaterSquadForSessionSlot,
  selectTheaterSquad,
  setTheaterSquadColor,
  setTheaterSquadAutomationMode,
  setTheaterSquadIcon,
  setTheaterCurrentRoom,
  setTheaterRoomContainmentMode,
  setTheaterRoomSignalPosture,
  setTheaterSelectedNode,
  setTheaterSelectedRoom,
  splitUnitToNewSquad,
  toggleTheaterPartitionState,
  triggerTheaterEmergencyDump,
  transferUnitBetweenSquads,
  upgradeTheaterRoomModuleSlots,
  useTheaterConsumable,
} from "../../core/theaterSystem";
import { THEATER_SQUAD_UNIT_LIMIT } from "../../core/theaterDeploymentPreset";
import {
  clearControllerContext,
  type ControllerMode,
  registerControllerContext,
  setControllerMode,
  updateFocusableElements,
} from "../../core/controllerSupport";
import { getAllStarterEquipment } from "../../core/equipment";
import { getBattleUnitPortraitPath } from "../../core/portraits";
import {
  AnnexAttachmentEdge,
  AnnexFrameType,
  AutomationModuleType,
  CoopTheaterCommand,
  CoreType,
  FieldAssetType,
  FortificationType,
  GameState,
  ModuleInstance,
  PendingTheaterBattleConfirmationState,
  PartitionType,
  PlayerSlot,
  SESSION_PLAYER_SLOTS,
  SessionPlayerSlot,
  TheaterMapMode,
  TheaterContainmentMode,
  TheaterNetworkState,
  TheaterObjectiveCompletion,
  TheaterRoom,
  TheaterSignalPosture,
  TheaterSquadAutomationMode,
  TheaterSquadState,
  Unit,
} from "../../core/types";
import {
  canAutomationReachTarget,
  findTheaterNodeRoute,
  getTheaterEdgeId,
  getTheaterNodeAdjacency,
  getTheaterNodeMoveTickCost,
  getTheaterRootRoomIdForNode,
  isTheaterNodeSecured,
  resolveTheaterNode,
} from "../../core/theaterAutomation";
import {
  getResourceEntries,
} from "../../core/resources";
import {
  assignLocalPlayerToTheaterSquad,
  canSessionAffordCost,
  getLocalSessionPlayerSlot,
  getPlayerControllerLabel,
  getSessionResourcePool,
  grantSessionResources,
  getTheaterAssignedPlayerSlots,
  isLocalCoopActive,
} from "../../core/session";
import {
  formatResourceWalletInline,
  formatRoomTagLabel,
  getCoreIncomeForRoom,
  getFieldAssetBuildCost,
  getInstalledFortificationCount as getSchemaInstalledFortificationCount,
  getInstalledFortificationSummary,
  getOrderedSchemaCoreTypes,
  getOrderedSchemaFieldAssetTypes,
  getOrderedSchemaFortificationTypes,
  isCoreTypeUnlocked,
  isFieldAssetUnlocked,
  isFortificationUnlocked,
  SCHEMA_FIELD_ASSET_DEFINITIONS,
  SCHEMA_FORTIFICATION_DEFINITIONS,
} from "../../core/schemaSystem";
import {
  getOwnedConsumableEntries,
  getTheaterConsumableTargetIds,
  isConsumableUsableInTheater,
} from "../../core/consumableActions";
import type { TacticalMapDefinition, TacticalMapObjectType } from "../../core/tacticalMaps";
import { showSystemPing } from "../components/systemPing";
import { showTutorialCallout } from "../components/tutorialCallout";
import {
  attachNotesWidgetHandlers,
  attachStuckNoteHandlers,
  renderNotesWidget,
  renderStuckNotesLayer,
} from "../components/notesWidget";
import { renderQuestTrackerWidget } from "../components/questTrackerWidget";
import { playPlaceholderSfx, setMusicCue } from "../../core/audioSystem";
import {
  isTauriSquadTransportAvailable,
  sendSquadTransportMessage,
} from "../../core/squadOnlineTransport";

type TheaterWindowKey =
  | "ops"
  | "squads"
  | "manage"
  | "quests"
  | "room"
  | "automation"
  | "fortify"
  | "core"
  | "feed"
  | "resources"
  | "consumables"
  | "upkeep"
  | "notes";

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

type TheaterSquadUnitDragSession = {
  fromSquadId: string;
  unitId: string;
  label: string;
  startX: number;
  startY: number;
  hoveredSquadId: string | null;
  hoveredIsValid: boolean;
  activated: boolean;
  sourceElement: HTMLElement;
  previewElement: HTMLDivElement | null;
} | null;

type TheaterMapPanSession = {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  activated: boolean;
} | null;

type TravelAnimationState = {
  fromNodeId: string;
  toNodeId: string;
  durationMs: number;
};

type PendingBattleConfirmationState = {
  roomId: string;
  previousRoomId: string;
  roomLabel: string;
  squadId: string | null;
};

type TheaterExitConfirmState = "return-atlas" | null;

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

type TheaterManageUnitEntry = {
  unit: Unit;
  squad: TheaterSquadState;
  room: TheaterRoom | null;
  isSelectedSquad: boolean;
  isIncapacitated: boolean;
};

type TheaterCorePanelTab = "room" | "annexes" | "modules" | "partitions" | "core" | "fortifications" | "tactical";

const THEATER_SELECTED_ROOM_PRIMARY_TABS: TheaterCorePanelTab[] = ["room", "core", "fortifications"];
const THEATER_SELECTED_ROOM_ADVANCED_TABS: TheaterCorePanelTab[] = [
  "tactical",
  "annexes",
  "modules",
  "partitions",
];
const THEATER_SELECTED_ROOM_TAB_LABELS: Record<TheaterCorePanelTab, string> = {
  room: "Room Info",
  core: "C.O.R.E.",
  fortifications: "Fortifications",
  tactical: "Tactical Map",
  annexes: "Annexes",
  modules: "Modules",
  partitions: "Partitions",
};

function isTheaterSelectedRoomAdvancedTab(tab: TheaterCorePanelTab): boolean {
  return THEATER_SELECTED_ROOM_ADVANCED_TABS.includes(tab);
}

const MAP_WIDTH = 4400;
const MAP_HEIGHT = 3200;
const MIN_MAP_ZOOM = 0.24;
const MAX_MAP_ZOOM = 2.2;
const MAP_ZOOM_STEP = 0.12;
const MAP_PAN_STEP = 44;
const MAP_STICK_PAN_SPEED = 22;
const MAP_STICK_DEADZONE = 0.18;
const MAP_SHIFT_PAN_MULTIPLIER = 2.4;
const HOLD_POSITION_TICK_MS = 5000;
const THEATER_MARGIN_X = 14;
const THEATER_TOP_SAFE = 36;
const THEATER_BOTTOM_SAFE = 20;
const THEATER_COMMAND_LAYOUT_VERSION = 7;
const THEATER_MAP_PAN_MARGIN_X = 140;
const THEATER_MAP_PAN_MARGIN_Y = 120;
const THEATER_MAP_OVERSCROLL_X = 2400;
const THEATER_MAP_OVERSCROLL_Y = 2200;
const THEATER_CORE_POWER_DISPLAY_THRESHOLD = 50;
const THEATER_ROUTE_GOOD_THRESHOLD = 25;
const THEATER_ROUTE_STRONG_THRESHOLD = 100;

const THEATER_WINDOW_ORDER: TheaterWindowKey[] = [
  "ops",
  "squads",
  "manage",
  "quests",
  "feed",
  "room",
  "automation",
  "fortify",
  "core",
  "upkeep",
  "resources",
  "consumables",
  "notes",
];

const THEATER_WINDOW_DEFS: Record<TheaterWindowKey, TheaterWindowDefinition> = {
  ops: { title: "THEATER COMMAND", kicker: "S/COM_OS // OPS TERMINAL", minWidth: 280, minHeight: 220, restoreLabel: "OPS" },
  squads: { title: "SQUADS", kicker: "SQUAD COMMAND // LOGISTICS ACTIVE", minWidth: 340, minHeight: 260, restoreLabel: "SQUADS" },
  manage: { title: "UNIT STATUS", kicker: "TACTICAL ROSTER // FIELD TELEMETRY", minWidth: 520, minHeight: 320, restoreLabel: "STATUS" },
  quests: { title: "QUEST TRACKER", kicker: "ACTIVE DIRECTIVES // CONTRACTS", minWidth: 340, minHeight: 240, restoreLabel: "QUESTS" },
  feed: { title: "ACTIVE THEATER FEED", kicker: "LIVE LOGISTICS AND THREAT UPDATES", minWidth: 320, minHeight: 140, restoreLabel: "FEED" },
  room: { title: "SELECTED ROOM", kicker: "ROOM STATUS", minWidth: 320, minHeight: 210, restoreLabel: "ROOM" },
  automation: { title: "MODULE LOGIC", kicker: "AUTOMATION CONTROL // LIVE CONFIG", minWidth: 420, minHeight: 300, restoreLabel: "LOGIC" },
  fortify: { title: "FORTIFICATIONS", kicker: "ROOM HARDENING", minWidth: 320, minHeight: 220, restoreLabel: "FORT" },
  core: { title: "ALL C.O.R.E.S", kicker: "FACILITY LEDGER // THEATER SUPPORT", minWidth: 360, minHeight: 260, restoreLabel: "CORES" },
  resources: { title: "CURRENT RESOURCES", kicker: "BASE CAMP SUPPLY LEDGER", minWidth: 280, minHeight: 180, restoreLabel: "SUPPLY" },
  consumables: { title: "CONSUMABLES", kicker: "FIELD STOCK // FREE USE", minWidth: 320, minHeight: 220, restoreLabel: "ITEMS" },
  upkeep: { title: "CURRENT UPKEEP COSTS", kicker: "PER-TICK FACILITY MAINTENANCE", minWidth: 320, minHeight: 220, restoreLabel: "UPKEEP" },
  notes: { title: "OPERATOR NOTES", kicker: "FIELD MEMOS // AUTO-SAVE", minWidth: 340, minHeight: 260, restoreLabel: "NOTES" },
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
let activeSquadUnitDragSession: TheaterSquadUnitDragSession = null;
let activeMapPanSession: TheaterMapPanSession = null;
let dragMoveHandler: ((event: MouseEvent) => void) | null = null;
let dragUpHandler: ((event: MouseEvent) => void) | null = null;
let theaterZCounter = 30;
let theaterWindowFrames: Record<TheaterWindowKey, TheaterWindowFrame> | null = null;
let theaterWindowColors: Record<TheaterWindowKey, string> | null = null;
let corePanelTab: TheaterCorePanelTab = "room";
let selectedRoomAdvancedOpen = false;
let theaterMapMode: TheaterMapMode = "command";
let hydratedTheaterLayoutSignature: string | null = null;
let mapKeyHandler: ((event: KeyboardEvent) => void) | null = null;
let mapKeyUpHandler: ((event: KeyboardEvent) => void) | null = null;
let mapPanFrameId: number | null = null;
let theaterMoveButtonClickHandler: ((event: MouseEvent) => void) | null = null;
let mapPanKeys = new Set<string>();
let suppressTheaterMapClickUntil = 0;
let seenThreatIds = new Set<string>();
let sandboxEventSnapshot: string[] = [];
let cleanupTheaterControllerContext: (() => void) | null = null;
let theaterControllerActiveWindowKey: TheaterWindowKey = "ops";
let pendingBattleConfirmation: PendingBattleConfirmationState | null = null;
let theaterExitConfirmState: TheaterExitConfirmState = null;
let holdPositionTimerId: number | null = null;
let holdPositionActiveRoomId: string | null = null;
let theaterTacticalPreviewZoom = 1;
let theaterSelectedTacticalTileKey: string | null = null;
let theaterSelectedFieldAssetType: FieldAssetType = "barricade_wall";
let theaterPendingRoomBodyScrollRestore: { top: number; left: number } | null = null;
let theaterTacticalFullscreenActive = false;
let theaterRoomFrameBeforeTacticalFullscreen: TheaterWindowFrame | null = null;
let skipNextTheaterWindowFrameCapture = false;
let theaterManageSelectedUnitId: string | null = null;

function clonePendingBattleConfirmation(
  pending: PendingTheaterBattleConfirmationState | PendingBattleConfirmationState | null | undefined,
): PendingBattleConfirmationState | null {
  return pending
    ? {
        roomId: pending.roomId,
        previousRoomId: pending.previousRoomId,
        roomLabel: pending.roomLabel,
        squadId: pending.squadId ?? null,
      }
    : null;
}

function withPendingBattleConfirmationInState(
  state: GameState,
  pending: PendingBattleConfirmationState | null,
): GameState {
  const nextPending = clonePendingBattleConfirmation(pending);
  const currentPending = clonePendingBattleConfirmation(state.session.pendingTheaterBattleConfirmation);
  if (JSON.stringify(currentPending) === JSON.stringify(nextPending)) {
    return state;
  }
  return {
    ...state,
    session: {
      ...state.session,
      pendingTheaterBattleConfirmation: nextPending,
    },
  };
}

function syncPendingBattleConfirmationFromSession(state: GameState = getGameState()): void {
  pendingBattleConfirmation = clonePendingBattleConfirmation(state.session.pendingTheaterBattleConfirmation);
}

function isRemoteCoopOperationsClient(): boolean {
  const state = getGameState();
  return (
    state.session.mode === "coop_operations"
    && state.session.authorityRole === "client"
    && isTauriSquadTransportAvailable()
  );
}

async function sendRemoteCoopTheaterCommand(command: CoopTheaterCommand): Promise<boolean> {
  if (!isRemoteCoopOperationsClient()) {
    return false;
  }
  await sendSquadTransportMessage(
    "lobby_command",
    JSON.stringify({
      type: "coop_theater_command",
      command,
    }),
  );
  return true;
}

function formatCoreType(coreType: CoreType | null): string {
  if (!coreType) {
    return "Unassigned";
  }
  return THEATER_CORE_BLUEPRINTS[coreType]?.displayName ?? coreType.replace(/_/g, " ");
}

function getCoreDescription(coreType: CoreType | null): string {
  if (!coreType) {
    return "No facility assigned to this room.";
  }
  return THEATER_CORE_BLUEPRINTS[coreType]?.description ?? "No facility description available.";
}

function formatCoreOfflineReason(reason: ReturnType<typeof getTheaterCoreOfflineReason>): string {
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

function getCoreIconText(coreType: CoreType | null): string {
  return coreType ? (THEATER_CORE_BLUEPRINTS[coreType]?.shortCode ?? "") : "";
}

function isRoomVisible(room: TheaterRoom): boolean {
  return room.intelLevel > 0 || room.secured;
}

function hasDetailedRoomIntel(room: TheaterRoom): boolean {
  return room.secured || room.intelLevel >= 2;
}

function formatRoomStatus(theater: TheaterNetworkState, room: TheaterRoom): string {
  if (!isRoomVisible(room)) {
    return "Unknown";
  }
  if (!hasDetailedRoomIntel(room)) {
    return room.commsLinked ? "Tracked" : "Signal Echo";
  }
  if (isTheaterRoomLocked(theater, room)) {
    return "Locked";
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
  if (!isRoomVisible(room)) {
    return "Unknown Contact";
  }
  if (!hasDetailedRoomIntel(room)) {
    return room.commsLinked ? "Tracked Contact" : "Unknown Contact";
  }
  return room.label;
}

function getSignalPostureLabel(posture: TheaterSignalPosture): string {
  switch (posture) {
    case "masked":
      return "Masked";
    case "bait":
      return "Bait";
    default:
      return "Normal";
  }
}

function getContainmentModeLabel(mode: TheaterContainmentMode): string {
  switch (mode) {
    case "venting":
      return "Venting";
    case "lockdown":
      return "Lockdown";
    default:
      return "Normal";
  }
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

function getDefaultFocusRoomId(theater: TheaterNetworkState): string | null {
  return theater.definition.ingressRoomId
    ?? theater.definition.uplinkRoomId
    ?? theater.selectedRoomId
    ?? theater.currentRoomId
    ?? Object.keys(theater.rooms)[0]
    ?? null;
}

function getRoomContextLabel(room: TheaterRoom, theater: TheaterNetworkState): string {
  if (theater.objectiveDefinition?.targetRoomId === room.id) {
    return "Objective";
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
  const selectedRoom = theater.rooms[theater.selectedRoomId];
  if (selectedRoom && isRoomVisible(selectedRoom)) {
    return selectedRoom;
  }

  return (
    theater.rooms[theater.currentRoomId] ??
    Object.values(theater.rooms)[0]
  );
}

function getSelectedNode(theater: TheaterNetworkState) {
  return getTheaterSelectedNode(theater) ?? resolveTheaterNode(theater, theater.selectedRoomId);
}

function getDisplayCurrentRoomId(theater: TheaterNetworkState): string {
  if (travelAnimation) {
    const travelTargetRoomId = getTheaterRootRoomIdForNode(theater, travelAnimation.toNodeId);
    const travelOriginRoomId = getTheaterRootRoomIdForNode(theater, travelAnimation.fromNodeId);
    if (travelTargetRoomId === theater.currentRoomId && travelOriginRoomId) {
      return travelOriginRoomId;
    }
  }
  return theater.currentRoomId;
}

function getDisplayCurrentNodeId(theater: TheaterNetworkState): string {
  if (travelAnimation?.toNodeId === (theater.currentNodeId ?? theater.currentRoomId)) {
    return travelAnimation.fromNodeId;
  }
  return theater.currentNodeId ?? theater.currentRoomId;
}


function getInstalledFortificationCount(room: TheaterRoom): number {
  return getSchemaInstalledFortificationCount(room.fortificationPips);
}

function getRoomTagLabels(room: TheaterRoom): string[] {
  return room.tags.map((tag) => formatRoomTagLabel(tag));
}

function formatFortificationStateLabel(room: TheaterRoom): string {
  const summary = getInstalledFortificationSummary(room.fortificationPips);
  return summary.length > 0 ? summary.join(" // ") : "No fortifications installed";
}

function formatCorePreviewIncome(room: TheaterRoom, coreType: CoreType): string {
  const income = formatResourceWalletInline(getCoreIncomeForRoom(coreType, room));
  return income || "No resource output";
}

function getCoreRequirementsForType(coreType: CoreType): { powerWatts: number; commsBw: number; supplyCrates: number } {
  const blueprint = THEATER_CORE_BLUEPRINTS[coreType];
  return {
    powerWatts: blueprint?.operationalRequirements?.powerWatts ?? 50,
    commsBw: blueprint?.operationalRequirements?.commsBw ?? 0,
    supplyCrates: blueprint?.operationalRequirements?.supplyCrates ?? 50,
  };
}

function renderCoreRequirementPreview(coreType: CoreType): string {
  const requirements = getCoreRequirementsForType(coreType);
  return `<small>Requirements: ${requirements.powerWatts} Watts / ${requirements.commsBw} Comms / ${requirements.supplyCrates} Crates</small>`;
}

function getRoomLockStatusLabel(theater: TheaterNetworkState, room: TheaterRoom, hasDetailedIntel: boolean): string {
  if (!hasDetailedIntel || !room.requiredKeyType) {
    return "Open";
  }
  return hasTheaterKey(theater, room.requiredKeyType)
    ? `${formatTheaterKeyLabel(room.requiredKeyType)} Ready`
    : `${formatTheaterKeyLabel(room.requiredKeyType)} Required`;
}

function getRoomKeyCacheLabel(room: TheaterRoom, hasDetailedIntel: boolean): string {
  if (!hasDetailedIntel || !room.grantsKeyType) {
    return "None";
  }
  return `${formatTheaterKeyLabel(room.grantsKeyType)} ${room.keyCollected ? "Recovered" : "Cached"}`;
}

function getSquadDisplayName(squad: TheaterSquadState | null | undefined): string {
  if (!squad) {
    return "NONE";
  }
  return squad.displayName?.trim() || squad.squadId.toUpperCase();
}

function getSquadDisplayIcon(squad: TheaterSquadState | null | undefined): string {
  return squad?.icon || "◉";
}

function getNextSquadInOrder(theater: TheaterNetworkState): TheaterSquadState | null {
  if (theater.squads.length <= 1) {
    return null;
  }
  const currentIndex = Math.max(
    0,
    theater.squads.findIndex((squad) => squad.squadId === theater.selectedSquadId),
  );
  return theater.squads[(currentIndex + 1) % theater.squads.length] ?? theater.squads[0] ?? null;
}

function getSquadColorKey(squad: TheaterSquadState | null | undefined): string {
  const colorKey = squad?.colorKey;
  return colorKey && THEATER_WINDOW_COLOR_THEME_MAP.has(colorKey)
    ? colorKey
    : (THEATER_SQUAD_COLOR_CHOICES[0] ?? "amber");
}

function getNextSquadColorKey(colorKey: string): string {
  const currentIndex = THEATER_SQUAD_COLOR_CHOICES.indexOf(colorKey as typeof THEATER_SQUAD_COLOR_CHOICES[number]);
  return THEATER_SQUAD_COLOR_CHOICES[
    (currentIndex + 1 + THEATER_SQUAD_COLOR_CHOICES.length) % THEATER_SQUAD_COLOR_CHOICES.length
  ] ?? (THEATER_SQUAD_COLOR_CHOICES[0] ?? "amber");
}

function getTheaterThemeVars(colorKey: string): TheaterWindowColorTheme["vars"] {
  return (THEATER_WINDOW_COLOR_THEME_MAP.get(colorKey) ?? THEATER_WINDOW_COLOR_THEMES[0]).vars;
}

function getSquadColorButtonStyle(squad: TheaterSquadState | null | undefined): string {
  const vars = getTheaterThemeVars(getSquadColorKey(squad));
  return [
    `--all-nodes-border:${vars["--all-nodes-border"]}`,
    `--all-nodes-border-hover:${vars["--all-nodes-border-hover"]}`,
    `--all-nodes-accent:${vars["--all-nodes-accent"]}`,
    `--all-nodes-accent-soft:${vars["--all-nodes-accent-soft"]}`,
    `--all-nodes-glow:${vars["--all-nodes-glow"]}`,
    `--all-nodes-text:${vars["--all-nodes-text"]}`,
  ].join(";");
}

function getSquadMarkerStyle(squad: TheaterSquadState): string {
  const vars = getTheaterThemeVars(getSquadColorKey(squad));
  return [
    `--theater-squad-marker-border:${vars["--all-nodes-border-hover"]}`,
    `--theater-squad-marker-accent:${vars["--all-nodes-accent"]}`,
    `--theater-squad-marker-accent-soft:${vars["--all-nodes-accent-soft"]}`,
    `--theater-squad-marker-text:${vars["--all-nodes-text"]}`,
    `--theater-squad-marker-glow:${vars["--all-nodes-glow"]}`,
  ].join(";");
}

function canTransferUnitBetweenRenderedSquads(
  fromSquad: TheaterSquadState | null | undefined,
  toSquad: TheaterSquadState | null | undefined,
  unitId?: string | null,
): boolean {
  if (!fromSquad || !toSquad || fromSquad.squadId === toSquad.squadId) {
    return false;
  }
  if (fromSquad.currentRoomId !== toSquad.currentRoomId) {
    return false;
  }
  if (fromSquad.unitIds.length <= 1 || toSquad.unitIds.length >= THEATER_SQUAD_UNIT_LIMIT) {
    return false;
  }
  if (unitId && !fromSquad.unitIds.includes(unitId)) {
    return false;
  }
  return true;
}

function setTheaterSquadDropState(target: HTMLElement, state: "idle" | "valid" | "invalid"): void {
  target.classList.toggle("theater-squad-card--drop-valid", state === "valid");
  target.classList.toggle("theater-squad-card--drop-invalid", state === "invalid");
}

function clearTheaterSquadDropStates(): void {
  document.querySelectorAll<HTMLElement>("[data-theater-squad-dropzone]").forEach((element) => {
    setTheaterSquadDropState(element, "idle");
  });
}

function removeTheaterSquadDragPreview(): void {
  activeSquadUnitDragSession?.previewElement?.remove();
  if (activeSquadUnitDragSession) {
    activeSquadUnitDragSession.previewElement = null;
  }
}

function clearTheaterSquadUnitDragSession(): void {
  activeSquadUnitDragSession?.sourceElement.classList.remove("theater-squad-card__unit--dragging");
  removeTheaterSquadDragPreview();
  clearTheaterSquadDropStates();
  activeSquadUnitDragSession = null;
  if (!activeDragSession) {
    document.body.style.userSelect = "";
  }
}

function ensureTheaterSquadDragPreview(session: Exclude<TheaterSquadUnitDragSession, null>): HTMLDivElement {
  if (session.previewElement) {
    return session.previewElement;
  }
  const preview = document.createElement("div");
  preview.className = "theater-squad-drag-preview";
  preview.textContent = session.label;
  document.body.appendChild(preview);
  session.previewElement = preview;
  return preview;
}

function updateTheaterSquadDragPreviewPosition(clientX: number, clientY: number): void {
  if (!activeSquadUnitDragSession?.activated) {
    return;
  }
  const preview = ensureTheaterSquadDragPreview(activeSquadUnitDragSession);
  preview.style.left = `${clientX + 18}px`;
  preview.style.top = `${clientY + 18}px`;
}

function updateTheaterSquadDropTarget(clientX: number, clientY: number): void {
  const session = activeSquadUnitDragSession;
  if (!session) {
    return;
  }

  clearTheaterSquadDropStates();
  session.hoveredSquadId = null;
  session.hoveredIsValid = false;

  const hovered = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-theater-squad-dropzone]");
  const targetSquadId = hovered?.getAttribute("data-theater-squad-dropzone");
  const theaterState = getGameState().operation?.theater ?? null;
  if (!hovered || !targetSquadId || !theaterState) {
    return;
  }

  const fromSquad = theaterState.squads.find((squad) => squad.squadId === session.fromSquadId) ?? null;
  const targetSquad = theaterState.squads.find((squad) => squad.squadId === targetSquadId) ?? null;
  const isValid = canTransferUnitBetweenRenderedSquads(fromSquad, targetSquad, session.unitId);
  if (session.fromSquadId === targetSquadId) {
    return;
  }

  session.hoveredSquadId = targetSquadId;
  session.hoveredIsValid = isValid;
  setTheaterSquadDropState(hovered, isValid ? "valid" : "invalid");
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getNextSquadIcon(icon: string): string {
  const currentIndex = THEATER_SQUAD_ICON_CHOICES.indexOf(icon as typeof THEATER_SQUAD_ICON_CHOICES[number]);
  return THEATER_SQUAD_ICON_CHOICES[(currentIndex + 1 + THEATER_SQUAD_ICON_CHOICES.length) % THEATER_SQUAD_ICON_CHOICES.length] ?? "◉";
}

function findDisplayRoute(theater: TheaterNetworkState, roomId: string): string[] | null {
  const originId = theater.currentRoomId;
  if (originId === roomId) {
    return [originId];
  }

  const destination = theater.rooms[roomId];
  if (
    !destination
    || (destination.status === "unknown" && !destination.commsVisible)
    || isTheaterRoomLocked(theater, destination)
  ) {
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
      if (!isTheaterPassagePowered(theater, current.roomId, adjacentId)) {
        return;
      }
      if (isTheaterRoomLocked(theater, adjacentRoom)) {
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

function getVisiblePassagePowerRequirement(theater: TheaterNetworkState, room: TheaterRoom): number | null {
  let lowestRequirement: number | null = null;
  room.adjacency.forEach((adjacentId) => {
    const adjacentRoom = theater.rooms[adjacentId];
    if (!adjacentRoom) {
      return;
    }
    if (adjacentId !== theater.currentRoomId && !adjacentRoom.secured) {
      return;
    }
    const requirement = Math.max(
      getTheaterPassagePowerRequirement(room, adjacentId),
      getTheaterPassagePowerRequirement(adjacentRoom, room.id),
    );
    if (requirement <= 0) {
      return;
    }
    if (lowestRequirement === null || requirement < lowestRequirement) {
      lowestRequirement = requirement;
    }
  });
  return lowestRequirement;
}

function getRoomNodeClass(room: TheaterRoom, theater: TheaterNetworkState): string {
  const classes = ["theater-room-node", `theater-room-node--${room.status}`];
  const detailedIntel = hasDetailedRoomIntel(room);
  const selectedNode = getSelectedNode(theater);
  if (room.id === getDisplayCurrentRoomId(theater)) classes.push("theater-room-node--current");
  if (selectedNode?.id === room.id) classes.push("theater-room-node--selected");
  if (room.underThreat) classes.push("theater-room-node--threat");
  if (room.damaged) classes.push("theater-room-node--damaged");
  if (!room.supplied && room.secured) classes.push("theater-room-node--cut");
  if (room.status === "unknown" && !room.commsVisible) classes.push("theater-room-node--fogged");
  if (isRoomVisible(room) && !detailedIntel) classes.push("theater-room-node--intel-low");
  if (detailedIntel && isTheaterRoomLocked(theater, room)) classes.push("theater-room-node--locked");
  if ((room.isUplinkRoom || room.tags.includes("uplink")) && detailedIntel) classes.push("theater-room-node--uplink");
  if (theater.objectiveDefinition?.targetRoomId === room.id && detailedIntel) classes.push("theater-room-node--objective");
  if (room.tags.includes("power_source") && detailedIntel) classes.push("theater-room-node--power");
  if (room.tags.includes("elite") && detailedIntel) classes.push("theater-room-node--elite");
  if (room.clearMode === "field" && detailedIntel) classes.push("theater-room-node--field");
  if ((room.fortificationPips?.barricade ?? 0) > 0 && detailedIntel) {
    classes.push("theater-room-node--barricaded");
    if ((room.fortificationPips?.barricade ?? 0) >= 2) {
      classes.push("theater-room-node--barricaded-heavy");
    }
  }
  if (room.tags.includes("core_candidate") && detailedIntel) classes.push("theater-room-node--core-candidate");
  return classes.join(" ");
}

function getMoveButtonState(theater: TheaterNetworkState, room: TheaterRoom): {
  disabled: boolean;
  label: string;
  detail: string;
} {
  const selectedSquad = getSelectedTheaterSquad(theater);
  const canIssueOrders = canManuallyControlTheaterSquad(theater, selectedSquad);
  const isAutomatedSquad = Boolean(selectedSquad && selectedSquad.automationMode !== "manual");
  const route = findDisplayRoute(theater, room.id);
  const travelTicks = route
    ? route.slice(1).reduce((sum, routeRoomId) => sum + getMoveTickCost(theater, routeRoomId), 0)
    : 0;
  const blockedByFog = room.status === "unknown" && !room.commsVisible;
  const blockedByLock = isTheaterRoomLocked(theater, room);
  const blockedByPowerGate = !route && !blockedByLock && !blockedByFog && getVisiblePassagePowerRequirement(theater, room) !== null;
  const powerGateRequirement = getVisiblePassagePowerRequirement(theater, room);
  const needsDefense = room.secured && (room.underThreat || room.damaged);
  const isCurrentHoldingRoom = room.id === theater.currentRoomId && room.secured && !needsDefense;
  const isWaiting = isHoldPositionActiveForRoom(room.id);
  const disabled =
    travelAnimation !== null ||
    !route ||
    blockedByLock ||
    blockedByFog ||
    Boolean(selectedSquad && !canIssueOrders);

  let label = blockedByLock ? "Locked Route" : "Move + Assault";
  if (selectedSquad && !canIssueOrders) {
    label = isAutomatedSquad ? "Automation Active" : "Comms Offline";
  } else if (needsDefense && room.id === theater.currentRoomId) {
    label = "Defend Room";
  } else if (needsDefense) {
    label = "Move + Defend";
  } else if (blockedByLock) {
    label = "Locked Route";
  } else if (blockedByPowerGate) {
    label = "Power Gate";
  } else if (isCurrentHoldingRoom) {
    label = isWaiting ? "Stop Waiting" : "Hold Position";
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
      ? (isCurrentHoldingRoom ? (isWaiting ? "Ticks Passing // Click To Stop" : "1 Tick / 5 Seconds") : "Current Location")
      : selectedSquad && !canIssueOrders
        ? (
          isAutomatedSquad
            ? `${selectedSquad.autoStatus.toUpperCase()}${selectedSquad.autoTargetRoomId ? ` // ${theater.rooms[selectedSquad.autoTargetRoomId]?.label ?? selectedSquad.autoTargetRoomId}` : ""}`
            : `${selectedSquad.bwAvailable} / ${selectedSquad.bwRequired} BW`
        )
      : blockedByLock
        ? `${formatTheaterKeyLabel(room.requiredKeyType)} Required`
      : blockedByPowerGate
        ? `${powerGateRequirement ?? 0} Watts Required`
      : !route
        ? "No Secured Route"
      : `Travel ${travelTicks} Tick${travelTicks === 1 ? "" : "s"} / ${Math.max(0, (route?.length ?? 1) - 1)} Room${(route?.length ?? 1) === 2 ? "" : "s"}`;

  return { disabled, label, detail };
}

function createDefaultTheaterWindowFrames(): Record<TheaterWindowKey, TheaterWindowFrame> {
  const viewportWidth = window.innerWidth || 1920;
  const viewportHeight = window.innerHeight || 1080;
  const topY = THEATER_TOP_SAFE;
  const opsWidth = clampNumber(Math.round(viewportWidth * 0.132), 280, 440);
  const opsHeight = clampNumber(Math.round(viewportHeight * 0.285), 250, 360);
  const manageWidth = clampNumber(Math.round(viewportWidth * 0.325), 620, 860);
  const manageHeight = clampNumber(Math.round(viewportHeight * 0.41), 360, 560);
  const feedWidth = clampNumber(Math.round(viewportWidth * 0.165), 420, 580);
  const feedHeight = clampNumber(Math.round(viewportHeight * 0.126), 150, 190);
  const roomWidth = clampNumber(Math.round(viewportWidth * 0.238), 420, 820);
  const roomHeight = clampNumber(Math.round(viewportHeight * 0.375), 360, 520);
  const automationWidth = clampNumber(Math.round(viewportWidth * 0.275), 460, 860);
  const automationHeight = clampNumber(Math.round(viewportHeight * 0.45), 340, 620);
  const upkeepWidth = clampNumber(Math.round(viewportWidth * 0.145), 360, 500);
  const upkeepHeight = clampNumber(Math.round(viewportHeight * 0.264), 280, 390);
  const resourcesWidth = clampNumber(Math.round(viewportWidth * 0.116), 320, 410);
  const resourcesHeight = clampNumber(Math.round(viewportHeight * 0.258), 250, 360);
  const coreWidth = clampNumber(Math.round(viewportWidth * 0.169), 420, 590);
  const coreHeight = clampNumber(Math.round(viewportHeight * 0.188), 240, 290);
  const opsX = 0;
  const feedX = clampNumber(
    opsX + opsWidth + 14,
    THEATER_MARGIN_X,
    Math.max(THEATER_MARGIN_X, viewportWidth - feedWidth - THEATER_MARGIN_X),
  );
  const upkeepX = clampNumber(
    viewportWidth - upkeepWidth - THEATER_MARGIN_X,
    THEATER_MARGIN_X,
    Math.max(THEATER_MARGIN_X, viewportWidth - upkeepWidth - THEATER_MARGIN_X),
  );
  const resourcesX = clampNumber(
    viewportWidth - resourcesWidth - THEATER_MARGIN_X,
    THEATER_MARGIN_X,
    Math.max(THEATER_MARGIN_X, viewportWidth - resourcesWidth - THEATER_MARGIN_X),
  );
  const roomY = clampNumber(
    viewportHeight - roomHeight - THEATER_BOTTOM_SAFE,
    THEATER_TOP_SAFE,
    Math.max(THEATER_TOP_SAFE, viewportHeight - roomHeight - THEATER_BOTTOM_SAFE),
  );
  const opsY = Math.max(THEATER_TOP_SAFE, viewportHeight - opsHeight);
  const resourcesY = clampNumber(
    topY + upkeepHeight + 12,
    THEATER_TOP_SAFE,
    Math.max(THEATER_TOP_SAFE, viewportHeight - resourcesHeight - THEATER_BOTTOM_SAFE),
  );
  const coreX = clampNumber(
    viewportWidth - coreWidth - Math.max(200, Math.round(viewportWidth * 0.15)),
    THEATER_MARGIN_X,
    Math.max(THEATER_MARGIN_X, viewportWidth - coreWidth - THEATER_MARGIN_X),
  );
  const coreY = clampNumber(
    viewportHeight - coreHeight - 64,
    THEATER_TOP_SAFE,
    Math.max(THEATER_TOP_SAFE, viewportHeight - coreHeight - THEATER_BOTTOM_SAFE),
  );
  const manageX = clampNumber(
    Math.round((viewportWidth - manageWidth) * 0.53),
    THEATER_MARGIN_X,
    Math.max(THEATER_MARGIN_X, viewportWidth - manageWidth - THEATER_MARGIN_X),
  );
  const manageY = clampNumber(
    Math.round(viewportHeight * 0.2),
    THEATER_TOP_SAFE,
    Math.max(THEATER_TOP_SAFE, viewportHeight - manageHeight - THEATER_BOTTOM_SAFE),
  );
  return {
    ops: {
      x: opsX,
      y: opsY,
      width: opsWidth,
      height: opsHeight,
      minimized: false,
      zIndex: 20,
    },
    squads: {
      x: THEATER_MARGIN_X,
      y: clampNumber(Math.round(viewportHeight * 0.2), 180, Math.max(180, viewportHeight - 420)),
      width: clampNumber(Math.round(viewportWidth * 0.185), 340, 460),
      height: clampNumber(Math.round(viewportHeight * 0.34), 260, 430),
      minimized: true,
      zIndex: 21,
    },
    manage: {
      x: manageX,
      y: manageY,
      width: manageWidth,
      height: manageHeight,
      minimized: true,
      zIndex: 22,
    },
    quests: {
      x: clampNumber(Math.round(viewportWidth * 0.17), 320, Math.max(320, viewportWidth - 520)),
      y: clampNumber(Math.round(viewportHeight * 0.14), THEATER_TOP_SAFE, Math.max(THEATER_TOP_SAFE, viewportHeight - 420)),
      width: clampNumber(Math.round(viewportWidth * 0.22), 360, 480),
      height: clampNumber(Math.round(viewportHeight * 0.28), 240, 380),
      minimized: true,
      zIndex: 22,
    },
    feed: {
      x: feedX,
      y: topY,
      width: feedWidth,
      height: feedHeight,
      minimized: false,
      zIndex: 23,
    },
    room: {
      x: THEATER_MARGIN_X,
      y: roomY,
      width: roomWidth,
      height: roomHeight,
      minimized: false,
      zIndex: 24,
    },
    automation: {
      x: clampNumber(Math.round(viewportWidth * 0.22), THEATER_MARGIN_X, Math.max(THEATER_MARGIN_X, viewportWidth - automationWidth - THEATER_MARGIN_X)),
      y: clampNumber(Math.round(viewportHeight * 0.28), THEATER_TOP_SAFE, Math.max(THEATER_TOP_SAFE, viewportHeight - automationHeight - THEATER_BOTTOM_SAFE)),
      width: automationWidth,
      height: automationHeight,
      minimized: false,
      zIndex: 25,
    },
    core: {
      x: coreX,
      y: coreY,
      width: coreWidth,
      height: coreHeight,
      minimized: false,
      zIndex: 26,
    },
    fortify: {
      x: clampNumber(Math.round(viewportWidth * 0.66), 800, viewportWidth - 420),
      y: clampNumber(Math.round(viewportHeight * 0.42), THEATER_TOP_SAFE, viewportHeight - 300),
      width: clampNumber(Math.round(viewportWidth * 0.17), 340, 460),
      height: clampNumber(Math.round(viewportHeight * 0.26), 240, 360),
      minimized: false,
      zIndex: 25,
    },
    upkeep: {
      x: upkeepX,
      y: topY,
      width: upkeepWidth,
      height: upkeepHeight,
      minimized: false,
      zIndex: 28,
    },
    resources: {
      x: resourcesX,
      y: resourcesY,
      width: resourcesWidth,
      height: resourcesHeight,
      minimized: false,
      zIndex: 27,
    },
    consumables: {
      x: clampNumber(Math.round(viewportWidth * 0.78), 980, viewportWidth - 420),
      y: clampNumber(Math.round(viewportHeight * 0.58), THEATER_TOP_SAFE, viewportHeight - 340),
      width: clampNumber(Math.round(viewportWidth * 0.18), 320, 420),
      height: clampNumber(Math.round(viewportHeight * 0.24), 220, 340),
      minimized: true,
      zIndex: 28,
    },
    notes: {
      x: clampNumber(Math.round(viewportWidth * 0.78), 980, viewportWidth - 380),
      y: clampNumber(Math.round(viewportHeight * 0.65), THEATER_TOP_SAFE, viewportHeight - 320),
      width: clampNumber(Math.round(viewportWidth * 0.18), 340, 420),
      height: clampNumber(Math.round(viewportHeight * 0.24), 260, 360),
      minimized: true,
      zIndex: 29,
    },
  };
}

function createDefaultTheaterWindowColors(): Record<TheaterWindowKey, string> {
  return {
    ops: getDefaultTheaterWindowColorKey("ops"),
    squads: getDefaultTheaterWindowColorKey("squads"),
    manage: getDefaultTheaterWindowColorKey("manage"),
    quests: getDefaultTheaterWindowColorKey("quests"),
    feed: getDefaultTheaterWindowColorKey("feed"),
    room: getDefaultTheaterWindowColorKey("room"),
    automation: getDefaultTheaterWindowColorKey("automation"),
    fortify: getDefaultTheaterWindowColorKey("fortify"),
    core: getDefaultTheaterWindowColorKey("core"),
    resources: getDefaultTheaterWindowColorKey("resources"),
    consumables: getDefaultTheaterWindowColorKey("consumables"),
    upkeep: getDefaultTheaterWindowColorKey("upkeep"),
    notes: getDefaultTheaterWindowColorKey("notes"),
  };
}

function resetTheaterUiLayoutToDefaults(): void {
  const defaults = createDefaultTheaterWindowFrames();
  theaterWindowFrames = {
    ops: normalizeTheaterWindowFrame("ops", defaults.ops, defaults.ops),
    squads: normalizeTheaterWindowFrame("squads", defaults.squads, defaults.squads),
    manage: normalizeTheaterWindowFrame("manage", defaults.manage, defaults.manage),
    quests: normalizeTheaterWindowFrame("quests", defaults.quests, defaults.quests),
    feed: normalizeTheaterWindowFrame("feed", defaults.feed, defaults.feed),
    room: normalizeTheaterWindowFrame("room", defaults.room, defaults.room),
    automation: normalizeTheaterWindowFrame("automation", defaults.automation, defaults.automation),
    fortify: normalizeTheaterWindowFrame("fortify", defaults.fortify, defaults.fortify),
    core: normalizeTheaterWindowFrame("core", defaults.core, defaults.core),
    resources: normalizeTheaterWindowFrame("resources", defaults.resources, defaults.resources),
    consumables: normalizeTheaterWindowFrame("consumables", defaults.consumables, defaults.consumables),
    upkeep: normalizeTheaterWindowFrame("upkeep", defaults.upkeep, defaults.upkeep),
    notes: normalizeTheaterWindowFrame("notes", defaults.notes, defaults.notes),
  };
  theaterWindowColors = createDefaultTheaterWindowColors();
  theaterZCounter = Math.max(...Object.values(theaterWindowFrames).map((frame) => frame.zIndex), theaterZCounter);
  corePanelTab = "room";
  selectedRoomAdvancedOpen = false;
  theaterTacticalFullscreenActive = false;
  theaterRoomFrameBeforeTacticalFullscreen = null;
  theaterMapMode = "command";
  mapPanX = 0;
  mapPanY = 0;
  mapZoom = 1;
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
      squads: normalizeTheaterWindowFrame("squads", defaults.squads, defaults.squads),
      manage: normalizeTheaterWindowFrame("manage", defaults.manage, defaults.manage),
      quests: normalizeTheaterWindowFrame("quests", defaults.quests, defaults.quests),
      feed: normalizeTheaterWindowFrame("feed", defaults.feed, defaults.feed),
      room: normalizeTheaterWindowFrame("room", defaults.room, defaults.room),
      automation: normalizeTheaterWindowFrame("automation", defaults.automation, defaults.automation),
      fortify: normalizeTheaterWindowFrame("fortify", defaults.fortify, defaults.fortify),
      core: normalizeTheaterWindowFrame("core", defaults.core, defaults.core),
      resources: normalizeTheaterWindowFrame("resources", defaults.resources, defaults.resources),
      consumables: normalizeTheaterWindowFrame("consumables", defaults.consumables, defaults.consumables),
      upkeep: normalizeTheaterWindowFrame("upkeep", defaults.upkeep, defaults.upkeep),
      notes: normalizeTheaterWindowFrame("notes", defaults.notes, defaults.notes),
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
    case "automation":
      return "steel";
    case "squads":
      return "amber";
    case "manage":
      return "steel";
    case "quests":
      return "teal";
    case "feed":
      return "teal";
    case "fortify":
      return "moss";
    case "core":
      return "verdant";
    case "resources":
      return "violet";
    case "consumables":
      return "verdant";
    case "upkeep":
      return "amber";
    case "notes":
      return "steel";
    default:
      return "steel";
  }
}

function ensureTheaterWindowColors(): Record<TheaterWindowKey, string> {
  if (!theaterWindowColors) {
    theaterWindowColors = createDefaultTheaterWindowColors();
  }

  THEATER_WINDOW_ORDER.forEach((key) => {
    const colorKey = theaterWindowColors?.[key];
    if (!colorKey || !THEATER_WINDOW_COLOR_THEME_MAP.has(colorKey)) {
      theaterWindowColors![key] = getDefaultTheaterWindowColorKey(key);
    }
  });

  return theaterWindowColors;
}

function isAutomationWindowOpen(): boolean {
  return Boolean(getGameState().uiLayout?.theaterCommandAutomationWindowOpen);
}

function setAutomationWindowOpen(open: boolean): void {
  updateGameState((state) => ({
    ...state,
    uiLayout: {
      ...(state.uiLayout ?? {}),
      theaterCommandAutomationWindowOpen: open,
    },
  }));
}

function hydrateTheaterUiLayoutFromState(signature: string): void {
  if (hydratedTheaterLayoutSignature === signature) {
    return;
  }

  const layout = getGameState().uiLayout;
  if (!layout) {
    resetTheaterUiLayoutToDefaults();
    hydratedTheaterLayoutSignature = signature;
    return;
  }

  const layoutVersion = Number(layout.theaterCommandLayoutVersion ?? 0);
  if (layoutVersion > THEATER_COMMAND_LAYOUT_VERSION) {
    resetTheaterUiLayoutToDefaults();
    hydratedTheaterLayoutSignature = signature;
    return;
  }

  const defaults = createDefaultTheaterWindowFrames();
  if (layout.theaterCommandWindowFrames) {
    const savedFrames = layout.theaterCommandWindowFrames;
    theaterWindowFrames = {
      ops: normalizeTheaterWindowFrame(
        "ops",
        layoutVersion < THEATER_COMMAND_LAYOUT_VERSION ? defaults.ops : (savedFrames.ops ?? defaults.ops),
        defaults.ops,
      ),
      squads: normalizeTheaterWindowFrame("squads", savedFrames.squads ?? defaults.squads, defaults.squads),
      manage: normalizeTheaterWindowFrame("manage", savedFrames.manage ?? defaults.manage, defaults.manage),
      quests: normalizeTheaterWindowFrame("quests", savedFrames.quests ?? defaults.quests, defaults.quests),
      feed: normalizeTheaterWindowFrame("feed", savedFrames.feed ?? defaults.feed, defaults.feed),
      room: normalizeTheaterWindowFrame("room", savedFrames.room ?? defaults.room, defaults.room),
      automation: normalizeTheaterWindowFrame("automation", savedFrames.automation ?? defaults.automation, defaults.automation),
      fortify: normalizeTheaterWindowFrame("fortify", savedFrames.fortify ?? defaults.fortify, defaults.fortify),
      core: normalizeTheaterWindowFrame("core", savedFrames.core ?? defaults.core, defaults.core),
      resources: normalizeTheaterWindowFrame("resources", savedFrames.resources ?? defaults.resources, defaults.resources),
      consumables: normalizeTheaterWindowFrame("consumables", savedFrames.consumables ?? defaults.consumables, defaults.consumables),
      upkeep: normalizeTheaterWindowFrame("upkeep", savedFrames.upkeep ?? defaults.upkeep, defaults.upkeep),
      notes: normalizeTheaterWindowFrame("notes", savedFrames.notes ?? defaults.notes, defaults.notes),
    };
    theaterZCounter = Math.max(...Object.values(theaterWindowFrames).map((frame) => frame.zIndex), theaterZCounter);
  } else {
    theaterWindowFrames = {
      ops: normalizeTheaterWindowFrame("ops", defaults.ops, defaults.ops),
      squads: normalizeTheaterWindowFrame("squads", defaults.squads, defaults.squads),
      manage: normalizeTheaterWindowFrame("manage", defaults.manage, defaults.manage),
      quests: normalizeTheaterWindowFrame("quests", defaults.quests, defaults.quests),
      feed: normalizeTheaterWindowFrame("feed", defaults.feed, defaults.feed),
      room: normalizeTheaterWindowFrame("room", defaults.room, defaults.room),
      automation: normalizeTheaterWindowFrame("automation", defaults.automation, defaults.automation),
      fortify: normalizeTheaterWindowFrame("fortify", defaults.fortify, defaults.fortify),
      core: normalizeTheaterWindowFrame("core", defaults.core, defaults.core),
      resources: normalizeTheaterWindowFrame("resources", defaults.resources, defaults.resources),
      consumables: normalizeTheaterWindowFrame("consumables", defaults.consumables, defaults.consumables),
      upkeep: normalizeTheaterWindowFrame("upkeep", defaults.upkeep, defaults.upkeep),
      notes: normalizeTheaterWindowFrame("notes", defaults.notes, defaults.notes),
    };
    theaterZCounter = Math.max(...Object.values(theaterWindowFrames).map((frame) => frame.zIndex), theaterZCounter);
  }

  if (layout.theaterCommandWindowColors) {
    theaterWindowColors = {
      ops: layout.theaterCommandWindowColors.ops ?? getDefaultTheaterWindowColorKey("ops"),
      squads: layout.theaterCommandWindowColors.squads ?? getDefaultTheaterWindowColorKey("squads"),
      manage: layout.theaterCommandWindowColors.manage ?? getDefaultTheaterWindowColorKey("manage"),
      quests: layout.theaterCommandWindowColors.quests ?? getDefaultTheaterWindowColorKey("quests"),
      feed: layout.theaterCommandWindowColors.feed ?? getDefaultTheaterWindowColorKey("feed"),
      room: layout.theaterCommandWindowColors.room ?? getDefaultTheaterWindowColorKey("room"),
      automation: layout.theaterCommandWindowColors.automation ?? getDefaultTheaterWindowColorKey("automation"),
      fortify: layout.theaterCommandWindowColors.fortify ?? getDefaultTheaterWindowColorKey("fortify"),
      core: layout.theaterCommandWindowColors.core ?? getDefaultTheaterWindowColorKey("core"),
      resources: layout.theaterCommandWindowColors.resources ?? getDefaultTheaterWindowColorKey("resources"),
      consumables: layout.theaterCommandWindowColors.consumables ?? getDefaultTheaterWindowColorKey("consumables"),
      upkeep: layout.theaterCommandWindowColors.upkeep ?? getDefaultTheaterWindowColorKey("upkeep"),
      notes: layout.theaterCommandWindowColors.notes ?? getDefaultTheaterWindowColorKey("notes"),
    };
  }

  if (layout.theaterCommandViewport) {
    mapPanX = layout.theaterCommandViewport.panX ?? 0;
    mapPanY = layout.theaterCommandViewport.panY ?? 0;
    mapZoom = clampNumber(layout.theaterCommandViewport.zoom ?? 1, MIN_MAP_ZOOM, MAX_MAP_ZOOM);
    clampMapPanToBounds();
  }

  if (
    layout.theaterCommandNodeTab === "room"
    || layout.theaterCommandNodeTab === "annexes"
    || layout.theaterCommandNodeTab === "modules"
    || layout.theaterCommandNodeTab === "partitions"
    || layout.theaterCommandNodeTab === "core"
    || layout.theaterCommandNodeTab === "fortifications"
    || layout.theaterCommandNodeTab === "tactical"
  ) {
    corePanelTab = layout.theaterCommandNodeTab;
  } else if (
    layout.theaterCommandCoreTab === "room"
    || layout.theaterCommandCoreTab === "core"
    || layout.theaterCommandCoreTab === "fortifications"
    || layout.theaterCommandCoreTab === "tactical"
  ) {
    corePanelTab = layout.theaterCommandCoreTab;
  }
  selectedRoomAdvancedOpen = isTheaterSelectedRoomAdvancedTab(corePanelTab);

  if (
    layout.theaterCommandMapMode === "supply"
    || layout.theaterCommandMapMode === "power"
    || layout.theaterCommandMapMode === "command"
    || layout.theaterCommandMapMode === "comms"
  ) {
    theaterMapMode = layout.theaterCommandMapMode;
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
      theaterCommandLayoutVersion: THEATER_COMMAND_LAYOUT_VERSION,
      theaterCommandWindowFrames: Object.fromEntries(
        THEATER_WINDOW_ORDER.map((key) => [key, { ...frames[key] }]),
      ),
      theaterCommandWindowColors: { ...colors },
      theaterCommandViewport: {
        panX: mapPanX,
        panY: mapPanY,
        zoom: mapZoom,
      },
      theaterCommandCoreTab: corePanelTab === "core" || corePanelTab === "fortifications" ? corePanelTab : "room",
      theaterCommandNodeTab: corePanelTab,
      theaterCommandMapMode: theaterMapMode,
      theaterCommandAutomationWindowOpen: isAutomationWindowOpen(),
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

function getTheaterControllerRoomCandidates(theater: TheaterNetworkState): TheaterRoom[] {
  return Object.values(theater.rooms).filter((room) => room.commsVisible || room.id === theater.currentRoomId || room.id === theater.selectedRoomId);
}

function moveTheaterRoomSelectionByDirection(theater: TheaterNetworkState, direction: "up" | "down" | "left" | "right"): void {
  const roomList = Object.values(theater.rooms);
  const currentRoom = roomList.find((room) => room.id === theater.selectedRoomId)
    ?? roomList.find((room) => room.id === theater.currentRoomId)
    ?? roomList[0];
  if (!currentRoom) {
    return;
  }

  const candidates = getTheaterControllerRoomCandidates(theater).filter((room) => room.id !== currentRoom.id);
  const originX = currentRoom.position.x;
  const originY = currentRoom.position.y;
  let bestRoom: TheaterRoom | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((room) => {
    const dx = room.position.x - originX;
    const dy = room.position.y - originY;
    if (direction === "up" && dy >= -4) return;
    if (direction === "down" && dy <= 4) return;
    if (direction === "left" && dx >= -4) return;
    if (direction === "right" && dx <= 4) return;

    const primary = direction === "left" || direction === "right" ? Math.abs(dx) : Math.abs(dy);
    const secondary = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = primary + (secondary * 0.35);
    if (score < bestScore) {
      bestScore = score;
      bestRoom = room;
    }
  });

  const nextRoom = bestRoom
    ?? candidates.sort((left, right) => (
      Math.abs(left.position.x - originX) + Math.abs(left.position.y - originY)
      - (Math.abs(right.position.x - originX) + Math.abs(right.position.y - originY))
    ))[0];

  if (!nextRoom) {
    return;
  }

  updateGameState((state) => setTheaterSelectedRoom(state, nextRoom.id));
  focusMapOnRoom(theater, nextRoom.id);
  renderTheaterCommandScreen();
}

function moveTheaterWindowFrameByController(
  key: TheaterWindowKey,
  delta: { x?: number; y?: number; width?: number; height?: number },
): void {
  const frames = ensureTheaterWindowFrames();
  const defaults = createDefaultTheaterWindowFrames();
  frames[key] = normalizeTheaterWindowFrame(
    key,
    {
      ...frames[key],
      x: frames[key].x + (delta.x ?? 0),
      y: frames[key].y + (delta.y ?? 0),
      width: frames[key].width + (delta.width ?? 0),
      height: frames[key].height + (delta.height ?? 0),
      minimized: false,
      zIndex: ++theaterZCounter,
    },
    defaults[key],
  );
  theaterControllerActiveWindowKey = key;
  applyWindowFrameToDom(key);
  persistTheaterUiLayoutToState();
}

function cycleTheaterControllerWindow(step: 1 | -1, theater: TheaterNetworkState): void {
  const availableWindows = THEATER_WINDOW_ORDER.filter((key) => (
    isTheaterWindowAvailable(key, theater)
    && (shouldRenderTheaterWindow(key, theater) || ensureTheaterWindowFrames()[key].minimized)
  ));
  if (availableWindows.length <= 0) {
    return;
  }

  const currentIndex = Math.max(0, availableWindows.indexOf(theaterControllerActiveWindowKey));
  const nextIndex = (currentIndex + step + availableWindows.length) % availableWindows.length;
  theaterControllerActiveWindowKey = availableWindows[nextIndex];
  focusWindow(theaterControllerActiveWindowKey);
  applyWindowFrameToDom(theaterControllerActiveWindowKey);
  persistTheaterUiLayoutToState();
  updateFocusableElements();
}

function handleTheaterControllerAction(action: string, theater: TheaterNetworkState, mode: ControllerMode): boolean {
  if (mode === "layout") {
    switch (action) {
      case "tabPrev":
      case "prevUnit":
        cycleTheaterControllerWindow(-1, theater);
        return true;
      case "tabNext":
      case "nextUnit":
        cycleTheaterControllerWindow(1, theater);
        return true;
      case "moveUp":
        moveTheaterWindowFrameByController(theaterControllerActiveWindowKey, { y: -28 });
        return true;
      case "moveDown":
        moveTheaterWindowFrameByController(theaterControllerActiveWindowKey, { y: 28 });
        return true;
      case "moveLeft":
        moveTheaterWindowFrameByController(theaterControllerActiveWindowKey, { x: -28 });
        return true;
      case "moveRight":
        moveTheaterWindowFrameByController(theaterControllerActiveWindowKey, { x: 28 });
        return true;
      case "zoomIn":
        moveTheaterWindowFrameByController(theaterControllerActiveWindowKey, { width: 28, height: 22 });
        return true;
      case "zoomOut":
        moveTheaterWindowFrameByController(theaterControllerActiveWindowKey, { width: -28, height: -22 });
        return true;
      case "windowPrimary":
        setTheaterWindowMinimized(theaterControllerActiveWindowKey, !ensureTheaterWindowFrames()[theaterControllerActiveWindowKey].minimized);
        persistTheaterUiLayoutToState();
        renderTheaterCommandScreen();
        return true;
      case "windowSecondary":
        cycleTheaterWindowColor(theaterControllerActiveWindowKey);
        persistTheaterUiLayoutToState();
        renderTheaterCommandScreen();
        return true;
      default:
        return false;
    }
  }

  if (mode === "cursor") {
    switch (action) {
      case "moveUp":
        moveTheaterRoomSelectionByDirection(theater, "up");
        return true;
      case "moveDown":
        moveTheaterRoomSelectionByDirection(theater, "down");
        return true;
      case "moveLeft":
        moveTheaterRoomSelectionByDirection(theater, "left");
        return true;
      case "moveRight":
        moveTheaterRoomSelectionByDirection(theater, "right");
        return true;
      case "confirm": {
        const roomButton = document.querySelector<HTMLElement>(`.theater-room-node[data-theater-room-id="${theater.selectedRoomId}"] .theater-room-move-btn`);
        roomButton?.click();
        return true;
      }
      case "zoomIn":
        setMapZoom(mapZoom + MAP_ZOOM_STEP);
        return true;
      case "zoomOut":
        setMapZoom(mapZoom - MAP_ZOOM_STEP);
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

function getMapPanBounds(): {
  minPanX: number;
  maxPanX: number;
  minPanY: number;
  maxPanY: number;
} {
  const viewportWidth = window.innerWidth || 1920;
  const viewportHeight = window.innerHeight || 1080;
  const centerX = MAP_WIDTH / 2;
  const centerY = MAP_HEIGHT / 2;
  const halfMapWidthPx = centerX * mapZoom;
  const halfMapHeightPx = centerY * mapZoom;

  const minPanX = (viewportWidth / 2) - halfMapWidthPx - THEATER_MAP_PAN_MARGIN_X - THEATER_MAP_OVERSCROLL_X;
  const maxPanX = halfMapWidthPx - (viewportWidth / 2) + THEATER_MAP_PAN_MARGIN_X + THEATER_MAP_OVERSCROLL_X;
  const minPanY = (viewportHeight / 2) - halfMapHeightPx - THEATER_MAP_PAN_MARGIN_Y - THEATER_MAP_OVERSCROLL_Y;
  const maxPanY = halfMapHeightPx - (viewportHeight / 2) + THEATER_MAP_PAN_MARGIN_Y + THEATER_MAP_OVERSCROLL_Y;

  return {
    minPanX: Math.min(minPanX, maxPanX),
    maxPanX: Math.max(minPanX, maxPanX),
    minPanY: Math.min(minPanY, maxPanY),
    maxPanY: Math.max(minPanY, maxPanY),
  };
}

function clampMapPanToBounds(theater?: TheaterNetworkState): void {
  const activeTheater = theater ?? getPreparedTheaterOperation(getGameState())?.theater;
  if (!activeTheater) {
    return;
  }

  const {
    minPanX,
    maxPanX,
    minPanY,
    maxPanY,
  } = getMapPanBounds();
  mapPanX = clampNumber(mapPanX, minPanX, maxPanX);
  mapPanY = clampNumber(mapPanY, minPanY, maxPanY);
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
  clampMapPanToBounds(theater);
}

function focusMapOnRoom(theater: TheaterNetworkState, roomId: string): void {
  const room = theater.rooms[roomId];
  if (!room) {
    return;
  }

  mapPanX = Math.round((MAP_WIDTH / 2) - room.position.x);
  mapPanY = Math.round((MAP_HEIGHT / 2) - room.position.y);
  clampMapPanToBounds(theater);
}

function focusMapOnTheaterNode(theater: TheaterNetworkState, nodeId: string): boolean {
  const node = resolveTheaterNode(theater, nodeId);
  if (!node) {
    return false;
  }

  mapPanX = Math.round((MAP_WIDTH / 2) - node.position.x);
  mapPanY = Math.round((MAP_HEIGHT / 2) - node.position.y);
  clampMapPanToBounds(theater);
  return true;
}

function getTheaterSquadFocusNodeId(theater: TheaterNetworkState): string | null {
  const selectedSquad = getSelectedTheaterSquad(theater);
  const candidateSquads = [
    selectedSquad,
    ...theater.squads.filter((squad) => squad.squadId !== selectedSquad?.squadId),
  ].filter((squad): squad is TheaterSquadState => Boolean(squad));

  for (const squad of candidateSquads) {
    if (squad.unitIds.length <= 0) {
      continue;
    }
    const nodeIds = [squad.currentNodeId, squad.currentRoomId].filter((nodeId): nodeId is string => Boolean(nodeId));
    const locatedNodeId = nodeIds.find((nodeId) => Boolean(resolveTheaterNode(theater, nodeId)));
    if (locatedNodeId) {
      return locatedNodeId;
    }
  }

  return null;
}

function isAnyTheaterRoomVisibleOnScreen(theater: TheaterNetworkState): boolean {
  const viewportWidth = window.innerWidth || 1920;
  const viewportHeight = window.innerHeight || 1080;
  const mapCenterX = MAP_WIDTH / 2;
  const mapCenterY = MAP_HEIGHT / 2;

  return Object.values(theater.rooms).some((room) => {
    const left = (viewportWidth / 2) + (((room.position.x - (room.size.width / 2)) - mapCenterX + mapPanX) * mapZoom);
    const right = (viewportWidth / 2) + (((room.position.x + (room.size.width / 2)) - mapCenterX + mapPanX) * mapZoom);
    const top = (viewportHeight / 2) + (((room.position.y - (room.size.height / 2)) - mapCenterY + mapPanY) * mapZoom);
    const bottom = (viewportHeight / 2) + (((room.position.y + (room.size.height / 2)) - mapCenterY + mapPanY) * mapZoom);

    return right >= 0 && left <= viewportWidth && bottom >= 0 && top <= viewportHeight;
  });
}

function resetMapViewportForTheaterEntry(theater: TheaterNetworkState): void {
  mapZoom = clampNumber(getDefaultMapZoom(theater), MIN_MAP_ZOOM, MAX_MAP_ZOOM);
  const squadFocusNodeId = getTheaterSquadFocusNodeId(theater);
  if (squadFocusNodeId && focusMapOnTheaterNode(theater, squadFocusNodeId)) {
    return;
  }
  const defaultFocusRoomId = getDefaultFocusRoomId(theater);
  if (defaultFocusRoomId) {
    focusMapOnRoom(theater, defaultFocusRoomId);
  } else {
    focusMapOnTheater(theater);
  }
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

function isTheaterWindowAvailable(key: TheaterWindowKey, _theater: TheaterNetworkState): boolean {
  if (key === "fortify") {
    return false;
  }
  if (key === "automation" && !isAutomationWindowOpen()) {
    return false;
  }
  return true;
}

function shouldRenderTheaterWindow(key: TheaterWindowKey, theater: TheaterNetworkState): boolean {
  const frames = ensureTheaterWindowFrames();
  if (!isTheaterWindowAvailable(key, theater)) {
    return false;
  }
  if (frames[key].minimized) {
    return false;
  }
  return true;
}

function renderWindowShell(
  key: TheaterWindowKey,
  title: string,
  subtitle: string,
  body: string,
  theater: TheaterNetworkState,
  options: { closable?: boolean; className?: string; bodyClassName?: string } = {},
): string {
  if (!shouldRenderTheaterWindow(key, theater)) {
    return "";
  }

  const colorKey = ensureTheaterWindowColors()[key];
  const nextSquad = key === "squads" ? getNextSquadInOrder(theater) : null;
  const windowClassName = ["theater-window", options.className ?? ""].filter(Boolean).join(" ");
  const bodyClassName = ["theater-window-body", options.bodyClassName ?? ""].filter(Boolean).join(" ");
  return `
    <section class="${windowClassName}" data-theater-window="${key}" data-color-key="${colorKey}" style="${frameStyle(key)}">
      ${nextSquad ? `
        <button
          class="theater-window-side-switch"
          type="button"
          data-theater-squad-quick-switch="${nextSquad.squadId}"
          aria-label="Quick switch to ${getSquadDisplayName(nextSquad)}"
        >
          <span class="theater-window-side-switch__label">QUICK SWITCH</span>
          <span class="theater-window-side-switch__value">${getSquadDisplayIcon(nextSquad)} ${getSquadDisplayName(nextSquad)}</span>
        </button>
      ` : ""}
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
          ${options.closable ? `<button class="theater-window-close" type="button" data-theater-window-close="${key}" aria-label="Close ${title}">X</button>` : ""}
          <button class="theater-window-minimize" type="button" data-theater-window-minimize="${key}" aria-label="Minimize ${title}">_</button>
        </div>
      </div>
      <div class="${bodyClassName}">${body}</div>
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

function clearHoldPositionTimer(): void {
  if (holdPositionTimerId !== null) {
    window.clearTimeout(holdPositionTimerId);
    holdPositionTimerId = null;
  }
}

function stopHoldPositionWait(): void {
  clearHoldPositionTimer();
  holdPositionActiveRoomId = null;
}

function isHoldPositionActiveForRoom(roomId: string): boolean {
  return holdPositionActiveRoomId === roomId;
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
  fromRoom: { position: { x: number; y: number } },
  toRoom: { position: { x: number; y: number } },
  offset = 0,
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
  const offsetFrom = {
    x: fromRoom.position.x + (normal.x * offset),
    y: fromRoom.position.y + (normal.y * offset),
  };
  const offsetTo = {
    x: toRoom.position.x + (normal.x * offset),
    y: toRoom.position.y + (normal.y * offset),
  };
  const control = {
    x: midpoint.x + (normal.x * ((curveAmount * 0.55) + offset)) + (outward.x * curveAmount * 0.7),
    y: midpoint.y + (normal.y * ((curveAmount * 0.55) + offset)) + (outward.y * curveAmount * 0.7),
  };

  return `M ${Math.round(offsetFrom.x)} ${Math.round(offsetFrom.y)} Q ${Math.round(control.x)} ${Math.round(control.y)} ${Math.round(offsetTo.x)} ${Math.round(offsetTo.y)}`;
}

function getLinkModeStateForMode(
  mode: Exclude<TheaterMapMode, "command">,
  fromRoom: TheaterRoom,
  toRoom: TheaterRoom,
): { online: boolean; cut: boolean; className: string; strengthClass: string; routeValue: number } {
  const resolveStrengthClass = (routeValue: number): string => {
    if (routeValue >= THEATER_ROUTE_STRONG_THRESHOLD) {
      return "theater-link--strong";
    }
    if (routeValue >= THEATER_ROUTE_GOOD_THRESHOLD) {
      return "theater-link--good";
    }
    return "theater-link--weak";
  };

  switch (mode) {
    case "supply": {
      const routeValue = Math.min(fromRoom.supplyFlow, toRoom.supplyFlow);
      const online = routeValue > 0;
      return {
        online,
        cut: !online,
        className: "theater-link--supply",
        strengthClass: online ? resolveStrengthClass(routeValue) : "",
        routeValue,
      };
    }
    case "power": {
      const routeValue = Math.min(fromRoom.powerFlow, toRoom.powerFlow);
      const online = routeValue > 0;
      return {
        online,
        cut: !online,
        className: "theater-link--power",
        strengthClass: online ? resolveStrengthClass(routeValue) : "",
        routeValue,
      };
    }
    case "comms":
    default: {
      const routeValue = fromRoom.commsLinked && toRoom.commsLinked
        ? Math.min(fromRoom.commsFlow, toRoom.commsFlow)
        : 0;
      const online = routeValue > 0;
      return {
        online,
        cut: !online,
        className: "theater-link--comms",
        strengthClass: online ? resolveStrengthClass(routeValue) : "",
        routeValue,
      };
    }
  }
}

function getLinkRenderStates(
  fromRoom: TheaterRoom,
  toRoom: TheaterRoom,
): Array<{ online: boolean; cut: boolean; className: string; strengthClass: string; routeValue: number; offset: number }> {
  if (theaterMapMode === "command") {
    return [
      { ...getLinkModeStateForMode("supply", fromRoom, toRoom), offset: -8 },
      { ...getLinkModeStateForMode("power", fromRoom, toRoom), offset: 0 },
      { ...getLinkModeStateForMode("comms", fromRoom, toRoom), offset: 8 },
    ];
  }

  return [{ ...getLinkModeStateForMode(theaterMapMode, fromRoom, toRoom), offset: 0 }];
}

function renderConnectionSvg(theater: TheaterNetworkState): string {
  const seenEdges = new Set<string>();
  const lines: string[] = [];
  const labels: string[] = [];
  const partitionBadges: string[] = [];
  const threatRouteLines: string[] = [];
  const phantomRouteLines: string[] = [];
  const seenPhantomRouteKeys = new Set<string>();
  const selectedEdgeId = getGameState().uiLayout?.theaterCommandSelectedEdgeId ?? null;

  Object.values(theater.rooms).forEach((room) => {
    if (!isRoomVisible(room)) {
      return;
    }

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
      if (!isRoomVisible(adjacent)) {
        return;
      }

      const modeStates = getLinkRenderStates(room, adjacent);
      const pressure = room.underThreat || adjacent.underThreat || room.damaged || adjacent.damaged;
      const fogged =
        !hasDetailedRoomIntel(room) ||
        !hasDetailedRoomIntel(adjacent);
      const powerGateRequirement = Math.max(
        getTheaterPassagePowerRequirement(room, adjacent.id),
        getTheaterPassagePowerRequirement(adjacent, room.id),
      );
      const gateOnline = powerGateRequirement <= 0 || isTheaterPassagePowered(theater, room.id, adjacent.id);

      modeStates.forEach((modeState) => {
        lines.push(`
          <path
            d="${buildTheaterLinkPath(theater, room, adjacent, modeState.offset)}"
            class="theater-link ${modeState.className} ${modeState.strengthClass} ${modeState.online ? "theater-link--online" : "theater-link--cut"} ${pressure && theaterMapMode !== "command" ? "theater-link--pressure" : ""} ${fogged ? "theater-link--fogged" : ""} ${theaterMapMode === "command" ? "theater-link--command" : ""} ${powerGateRequirement > 0 ? "theater-link--gated" : ""} ${powerGateRequirement > 0 && !gateOnline ? "theater-link--gate-offline" : ""} ${selectedEdgeId === edgeKey ? "theater-link--selected" : ""}"
          />
        `);
      });

      if (powerGateRequirement > 0) {
        labels.push(`
          <text
            class="theater-link-gate-label ${gateOnline ? "theater-link-gate-label--online" : "theater-link-gate-label--offline"}"
            x="${Math.round((room.position.x + adjacent.position.x) / 2)}"
            y="${Math.round((room.position.y + adjacent.position.y) / 2) - 8}"
          >
            ${powerGateRequirement}W
          </text>
        `);
      }

      const partition = theater.partitionsByEdgeId?.[edgeKey];
      if (partition) {
        partitionBadges.push(`
          <g class="theater-link-door ${selectedEdgeId === edgeKey ? "theater-link-door--selected" : ""}">
            <circle
              class="theater-link-door__badge theater-link-door__badge--${partition.state}"
              cx="${Math.round((room.position.x + adjacent.position.x) / 2)}"
              cy="${Math.round((room.position.y + adjacent.position.y) / 2) + 10}"
              r="14"
            />
            <text
              class="theater-link-door__label"
              x="${Math.round((room.position.x + adjacent.position.x) / 2)}"
              y="${Math.round((room.position.y + adjacent.position.y) / 2) + 15}"
            >
              ${partition.state === "closed" ? "BD" : "OP"}
            </text>
          </g>
        `);
      }
    });
  });

  Object.values(theater.annexesById ?? {}).forEach((annex) => {
    const parentNode = resolveTheaterNode(theater, annex.parentNodeId);
    const annexNode = resolveTheaterNode(theater, annex.annexId);
    const rootRoom = theater.rooms[annex.parentRoomId];
    if (!parentNode || !annexNode || !rootRoom) {
      return;
    }

    const edgeKey = getTheaterEdgeId(annex.parentNodeId, annex.annexId);
    if (seenEdges.has(edgeKey)) {
      return;
    }
    seenEdges.add(edgeKey);

    const modeStates = getLinkRenderStates(rootRoom, rootRoom);
    const pressure = rootRoom.underThreat || rootRoom.damaged;
    const fogged = !hasDetailedRoomIntel(rootRoom);

    modeStates.forEach((modeState) => {
      lines.push(`
        <path
          d="${buildTheaterLinkPath(theater, parentNode, annexNode, modeState.offset * 0.45)}"
          class="theater-link theater-link--annex ${modeState.className} ${modeState.strengthClass} ${modeState.online ? "theater-link--online" : "theater-link--cut"} ${pressure && theaterMapMode !== "command" ? "theater-link--pressure" : ""} ${fogged ? "theater-link--fogged" : ""} ${theaterMapMode === "command" ? "theater-link--command" : ""} ${selectedEdgeId === edgeKey ? "theater-link--selected" : ""}"
        />
      `);
    });

    const partition = theater.partitionsByEdgeId?.[edgeKey];
    if (partition) {
      partitionBadges.push(`
        <g class="theater-link-door ${selectedEdgeId === edgeKey ? "theater-link-door--selected" : ""}">
          <circle
            class="theater-link-door__badge theater-link-door__badge--${partition.state}"
            cx="${Math.round((parentNode.position.x + annexNode.position.x) / 2)}"
            cy="${Math.round((parentNode.position.y + annexNode.position.y) / 2) + 10}"
            r="14"
          />
          <text
            class="theater-link-door__label"
            x="${Math.round((parentNode.position.x + annexNode.position.x) / 2)}"
            y="${Math.round((parentNode.position.y + annexNode.position.y) / 2) + 15}"
          >
            ${partition.state === "closed" ? "BD" : "OP"}
          </text>
        </g>
      `);
    }
  });

  theater.activeThreats
    .filter((threat) => threat.active)
    .forEach((threat) => {
      for (let index = threat.routeIndex; index < threat.route.length - 1; index += 1) {
        const fromRoom = theater.rooms[threat.route[index]];
        const toRoom = theater.rooms[threat.route[index + 1]];
        if (!fromRoom || !toRoom || !isRoomVisible(fromRoom) || !isRoomVisible(toRoom)) {
          continue;
        }
        threatRouteLines.push(`
          <path
            d="${buildTheaterLinkPath(theater, fromRoom, toRoom, 14)}"
            class="theater-link theater-link--threat-route ${threat.currentRoomId === toRoom.id ? "theater-link--pressure" : ""}"
          />
        `);
      }
    });

  Object.values(theater.rooms).forEach((room) => {
    if (!isRoomVisible(room)) {
      return;
    }

    (room.sandboxPhantomRouteRoomIds ?? []).forEach((targetRoomId, index) => {
      const targetRoom = theater.rooms[targetRoomId];
      if (!targetRoom || !isRoomVisible(targetRoom)) {
        return;
      }
      const phantomKey = [room.id, targetRoom.id].sort().join("__");
      if (seenPhantomRouteKeys.has(phantomKey)) {
        return;
      }
      seenPhantomRouteKeys.add(phantomKey);
      phantomRouteLines.push(`
        <path
          d="${buildTheaterLinkPath(theater, room, targetRoom, 22 + (index * 6))}"
          class="theater-link theater-link--phantom-route"
        />
      `);
    });
  });

  return `
    <svg class="theater-links" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}">
      ${lines.join("")}
      ${threatRouteLines.join("")}
      ${phantomRouteLines.join("")}
      ${labels.join("")}
      ${partitionBadges.join("")}
    </svg>
  `;
}

function renderSquadMarker(theater: TheaterNetworkState): string {
  return theater.squads.map((squad, index) => {
    const node = resolveTheaterNode(theater, squad.currentNodeId ?? squad.currentRoomId);
    if (!node) {
      return "";
    }

    const isSelected = squad.squadId === theater.selectedSquadId;
    const isTraveling =
      isSelected &&
      Boolean(travelAnimation && resolveTheaterNode(theater, travelAnimation.fromNodeId) && resolveTheaterNode(theater, travelAnimation.toNodeId));
    const anchorNode = isTraveling ? resolveTheaterNode(theater, travelAnimation!.fromNodeId) : node;
    if (!anchorNode) {
      return "";
    }

    const travelTargetNode = isTraveling ? resolveTheaterNode(theater, travelAnimation!.toNodeId) : null;
    const dx = isTraveling && travelTargetNode ? travelTargetNode.position.x - anchorNode.position.x : 0;
    const dy = isTraveling && travelTargetNode ? travelTargetNode.position.y - anchorNode.position.y : 0;
    const duration = isTraveling ? travelAnimation!.durationMs : 0;
    const offsetX = (index % 3) * 18 - 18;
    const offsetY = Math.floor(index / 3) * 18 - 10;
    const animationStyle = isTraveling
      ? `--travel-dx:${dx}px;--travel-dy:${dy}px;--travel-duration:${duration}ms;`
      : "";
    const markerThemeStyle = getSquadMarkerStyle(squad);

    return `
      <div
        class="theater-squad-marker ${isTraveling ? "theater-squad-marker--moving" : ""} ${isSelected ? "theater-squad-marker--selected" : ""} ${squad.isInContact ? "" : "theater-squad-marker--offline"}"
        style="left:${anchorNode.position.x + offsetX}px;top:${anchorNode.position.y + offsetY}px;${animationStyle}${markerThemeStyle}"
        title="${getSquadDisplayName(squad)} // ${squad.unitIds.length} UNIT(S) // ${squad.bwAvailable}/${squad.bwRequired} BW"
      >
        ${getSquadDisplayIcon(squad)}
      </div>
    `;
  }).join("");
}

function renderTheaterFortificationMarkers(room: TheaterRoom, hasDetailedIntel: boolean): string {
  if (!hasDetailedIntel) {
    return "";
  }

  const markers = getOrderedSchemaFortificationTypes()
    .filter((fortificationType) => fortificationType !== "barricade")
    .flatMap((fortificationType) => Array.from({ length: room.fortificationPips[fortificationType] }, (_, index) => {
      const definition = SCHEMA_FORTIFICATION_DEFINITIONS[fortificationType];
      const className =
        fortificationType === "powerRail"
            ? "theater-room-fort-marker--power"
            : "theater-room-fort-marker--aux";
      return `
        <span class="theater-room-fort-marker ${className}" title="${definition.displayName} ${index + 1}"></span>
      `;
    }))
    .join("");

  if (!markers) {
    return "";
  }

  return `
    <div class="theater-room-fort-markers" aria-hidden="true">
      ${markers}
    </div>
  `;
}

function orderItemsUnlockedFirst<T>(items: T[], isUnlocked: (item: T) => boolean): T[] {
  return items
    .map((item, index) => ({ item, index, unlocked: isUnlocked(item) }))
    .sort((left, right) => {
      if (left.unlocked !== right.unlocked) {
        return Number(right.unlocked) - Number(left.unlocked);
      }
      return left.index - right.index;
    })
    .map(({ item }) => item);
}

function getNodeMoveButtonState(theater: TheaterNetworkState, nodeId: string): {
  disabled: boolean;
  label: string;
  detail: string;
} {
  const node = resolveTheaterNode(theater, nodeId);
  if (!node) {
    return { disabled: true, label: "Unavailable", detail: "No valid node target" };
  }
  if (node.kind === "room") {
    return getMoveButtonState(theater, node.room!);
  }

  const selectedSquad = getSelectedTheaterSquad(theater);
  const canIssueOrders = canManuallyControlTheaterSquad(theater, selectedSquad);
  const isAutomatedSquad = Boolean(selectedSquad && selectedSquad.automationMode !== "manual");
  const currentNodeId = getDisplayCurrentNodeId(theater);
  const route = currentNodeId
    ? findTheaterNodeRoute(theater, currentNodeId, nodeId)
    : null;
  const travelTicks = route
    ? route.slice(1).reduce((sum, routeNodeId) => sum + getTheaterNodeMoveTickCost(theater, routeNodeId), 0)
    : 0;
  const disabled = travelAnimation !== null || !selectedSquad || !canIssueOrders || !node.annex!.inheritedControl || !route;
  if (currentNodeId === nodeId) {
    return {
      disabled,
      label: "Hold Annex",
      detail: "Current Annex Position",
    };
  }

  if (selectedSquad && !canIssueOrders) {
    return {
      disabled,
      label: isAutomatedSquad ? "Automation Active" : "Comms Offline",
      detail: isAutomatedSquad
        ? `${selectedSquad.autoStatus.toUpperCase()} // ${selectedSquad.bwAvailable}/${selectedSquad.bwRequired} BW`
        : `${selectedSquad.bwAvailable}/${selectedSquad.bwRequired} BW // No manual orders`,
    };
  }

  return {
    disabled,
    label: "Move To Annex",
    detail: route
      ? `Travel ${travelTicks} Tick${travelTicks === 1 ? "" : "s"} / ${Math.max(0, route.length - 1)} Node${route.length === 2 ? "" : "s"}`
      : "No Secured Route",
  };
}

function renderAnnexNode(theater: TheaterNetworkState, annexId: string): string {
  const annexNode = resolveTheaterNode(theater, annexId);
  if (!annexNode || annexNode.kind !== "annex") {
    return "";
  }
  const annex = annexNode.annex;
  if (!annex) {
    return "";
  }

  const rootRoom = annexNode.rootRoom;
  const isSelected = getSelectedNode(theater)?.id === annexId;
  const isCurrent = getDisplayCurrentNodeId(theater) === annexId;
  const moveState = getNodeMoveButtonState(theater, annexId);
  const edgeId = getTheaterEdgeId(annexId, annex.parentNodeId);
  const partition = theater.partitionsByEdgeId?.[edgeId];

  return `
    <div
      class="theater-annex-node ${isSelected ? "theater-annex-node--selected" : ""} ${isCurrent ? "theater-annex-node--current" : ""} ${annex.inheritedControl ? "" : "theater-annex-node--offline"}"
      data-theater-node-id="${annexId}"
      style="
        left:${annexNode.position.x - annexNode.size.width / 2}px;
        top:${annexNode.position.y - annexNode.size.height / 2}px;
        width:${annexNode.size.width}px;
        height:${annexNode.size.height}px;
      "
      role="button"
      tabindex="0"
      aria-label="${annexNode.label}"
    >
      <div class="theater-annex-node__kicker">${ANNEX_FRAME_DEFINITIONS[annex.frameType].frameCategory.toUpperCase()}</div>
      <div class="theater-annex-node__title">${annexNode.label}</div>
      <div class="theater-annex-node__meta">
        <span>${annex.moduleSlots.filter((slot) => slot !== null).length}/${annex.moduleSlotCapacity} MOD</span>
        <span>${annex.integrity} INT</span>
        <span>${annex.inheritedComms} BW</span>
      </div>
      ${partition ? `<div class="theater-annex-node__door theater-annex-node__door--${partition.state}">${partition.state === "closed" ? "BLAST DOOR" : "DOOR OPEN"}</div>` : ""}
      ${isSelected ? `
        <button
          class="theater-room-move-btn theater-room-move-btn--annex"
          type="button"
          data-theater-move-button="${annexId}"
          ${moveState.disabled ? "disabled" : ""}
        >
          ${moveState.label}
          <small>${moveState.detail}</small>
        </button>
      ` : ""}
      ${isCurrent ? `<div class="theater-current-room-badge">Current Node</div>` : ""}
      ${rootRoom ? `<div class="theater-annex-node__parent">${rootRoom.label}</div>` : ""}
    </div>
  `;
}

function renderRoomNode(theater: TheaterNetworkState, room: TheaterRoom, canDescend: boolean): string {
  if (!isRoomVisible(room)) {
    return "";
  }

  const moveState = getMoveButtonState(theater, room);
  const isCurrent = room.id === getDisplayCurrentRoomId(theater);
  const hasDetailedIntel = hasDetailedRoomIntel(room);
  const roomStatus = formatRoomStatus(theater, room);
  const roomCoreAssignments = getTheaterRoomCoreAssignments(room);
  const primaryCoreAssignment = roomCoreAssignments[0] ?? null;
  const coreIcon = getCoreIconText(primaryCoreAssignment?.type ?? null);
  const coreOnline = Boolean(primaryCoreAssignment && isTheaterCoreOperational(room));
  const patrolHere = theater.activeThreats.some((threat) => threat.active && threat.currentRoomId === room.id && room.commsVisible);
  const showPendingBattleConfirmation = pendingBattleConfirmation?.roomId === room.id;
  const showMoveButton = getSelectedNode(theater)?.id === room.id && !showPendingBattleConfirmation;
  const keyFlags = hasDetailedIntel
    ? `
      ${room.requiredKeyType ? `<span class="theater-chip theater-chip--lock">${formatTheaterKeyLabel(room.requiredKeyType)} ${hasTheaterKey(theater, room.requiredKeyType) ? "Open" : "Lock"}</span>` : ""}
      ${room.grantsKeyType ? `<span class="theater-chip theater-chip--key">${formatTheaterKeyLabel(room.grantsKeyType)} ${room.keyCollected ? "Recovered" : "Cache"}</span>` : ""}
    `
    : "";
  const roomFlags = hasDetailedIntel
    ? `
      <div class="theater-room-flags">
        <span class="theater-chip ${room.supplied ? "theater-chip--good" : "theater-chip--bad"}">${room.supplyFlow} CRATES</span>
        <span class="theater-chip ${room.powerFlow >= THEATER_CORE_POWER_DISPLAY_THRESHOLD ? "theater-chip--power" : ""}">${room.powerFlow} WATTS</span>
        <span class="theater-chip ${room.commsLinked ? "theater-chip--comms" : ""}">${room.commsFlow} BW</span>
        <span class="theater-chip">${roomCoreAssignments.length}/${Math.max(1, room.coreSlotCapacity ?? 1)} C.O.R.E.</span>
        ${(room.sandboxBurning ?? false) ? `<span class="theater-chip theater-chip--bad">BURN L${room.sandboxBurnSeverity ?? 1}</span>` : ""}
        ${room.sandboxOverheating ? `<span class="theater-chip theater-chip--bad">OVERHEAT L${room.sandboxOverheatSeverity ?? 1}</span>` : ""}
        ${(room.sandboxSmokeValue ?? 0) > 0 ? `<span class="theater-chip theater-chip--power">SMOKE L${room.sandboxSmokeValue}</span>` : ""}
        ${room.sandboxRouteNoise ? `<span class="theater-chip theater-chip--power">ROUTE NOISE</span>` : ""}
        ${(room.sandboxCommsAttraction ?? 0) > 0 ? `<span class="theater-chip theater-chip--comms">ATTRACT +${room.sandboxCommsAttraction}</span>` : ""}
        ${(room.sandboxSignalBloom ?? false) ? `<span class="theater-chip theater-chip--power">BLOOM</span>` : ""}
        ${(room.sandboxScavengerActivity ?? "quiet") === "raiding" ? `<span class="theater-chip theater-chip--bad">SCAV RAID</span>` : (room.sandboxScavengerActivity ?? "quiet") === "probing" ? `<span class="theater-chip">SCAVENGERS</span>` : ""}
        ${(room.sandboxContainmentMode ?? "normal") === "venting" ? `<span class="theater-chip theater-chip--power">VENT</span>` : (room.sandboxContainmentMode ?? "normal") === "lockdown" ? `<span class="theater-chip">LOCKDOWN</span>` : ""}
        ${(room.sandboxEmergencyDumpTicks ?? 0) > 0 ? `<span class="theater-chip theater-chip--bad">DUMP ${room.sandboxEmergencyDumpTicks}</span>` : ""}
        ${room.sandboxSignalPosture === "masked" ? `<span class="theater-chip">MASKED</span>` : room.sandboxSignalPosture === "bait" ? `<span class="theater-chip theater-chip--bad">BAIT SIG</span>` : ""}
        ${(room.sandboxSupplyFireRisk ?? false) ? `<span class="theater-chip theater-chip--bad">FIRE RISK</span>` : ""}
        ${room.roomClass === "mega" ? `<span class="theater-chip theater-chip--power">MEGA ROOM</span>` : ""}
        ${room.enemySite && room.commsVisible && !room.secured ? `<span class="theater-chip theater-chip--bad">STAGING</span>` : ""}
        ${patrolHere ? `<span class="theater-chip theater-chip--bad">PATROL</span>` : ""}
        ${getVisiblePassagePowerRequirement(theater, room) ? `<span class="theater-chip theater-chip--power">GATE ${getVisiblePassagePowerRequirement(theater, room)}W</span>` : ""}
        ${keyFlags}
      </div>
    `
    : `
      <div class="theater-room-flags theater-room-flags--lowintel">
        <span class="theater-chip ${room.commsLinked ? "theater-chip--comms" : ""}">${room.commsLinked ? "Comms Trace" : "Low Intel"}</span>
      </div>
    `;
  const lowPowerWarning = hasDetailedIntel
    && primaryCoreAssignment
    && !isTheaterCoreOperational(room)
    && getTheaterCoreOfflineReason(room) === "low_power"
    ? `
      <div class="theater-room-warning ${room.position.x > (MAP_WIDTH / 2) ? "theater-room-warning--left" : "theater-room-warning--right"}">
        <div class="theater-room-warning__title">C.O.R.E. Offline</div>
        <div class="theater-room-warning__copy">Low Wattage</div>
      </div>
    `
    : "";

  return `
    <div
      class="${getRoomNodeClass(room, theater)}"
      data-theater-room-id="${room.id}"
      data-theater-node-id="${room.id}"
      style="
        left:${room.position.x - room.size.width / 2}px;
        top:${room.position.y - room.size.height / 2}px;
        width:${room.size.width}px;
        height:${room.size.height}px;
      "
      role="button"
      tabindex="0"
      aria-label="${roomStatus} // ${room.label}"
    >
      <div class="theater-room-sector">${hasDetailedIntel ? room.sectorTag : "UNK"}</div>
      ${hasDetailedIntel && coreIcon ? `<div class="theater-room-core-icon ${coreOnline ? "theater-room-core-icon--online" : ""}" title="${formatCoreType(primaryCoreAssignment?.type ?? null)}">${coreIcon}${roomCoreAssignments.length > 1 ? `<span class="theater-room-core-icon__count">${roomCoreAssignments.length}</span>` : ""}</div>` : ""}
      ${renderTheaterFortificationMarkers(room, hasDetailedIntel)}
      <div class="theater-room-label">${getRoomDisplayLabel(room)}</div>
      ${roomFlags}
      ${lowPowerWarning}
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
      ${showPendingBattleConfirmation ? renderPendingBattleConfirmation(theater, room) : ""}
      ${renderCompletionPopupForRoom(theater, room, canDescend)}
      ${isCurrent ? `<div class="theater-current-room-badge">Current Room</div>` : ""}
    </div>
  `;
}

function renderTheaterMap(theater: TheaterNetworkState): string {
  const operation = getPreparedTheaterOperation(getGameState());
  const canDescend = Boolean(
    operation
    && operation.currentFloorIndex < operation.floors.length - 1
    && theater.definition.floorOrdinal < CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL,
  );
  return `
    <section class="theater-map-wrap" id="theaterMapWrap">
      <div class="theater-map-zoom-controls">
        <div class="theater-map-mode-toggle" role="tablist" aria-label="Theater network view">
          ${(["command", "supply", "power", "comms"] as TheaterMapMode[]).map((mode) => `
            <button
              class="theater-map-mode-btn ${theaterMapMode === mode ? "theater-map-mode-btn--active" : ""}"
              type="button"
              data-theater-map-mode="${mode}"
            >
              ${getMapModeLabel(mode)}
            </button>
          `).join("")}
        </div>
        <button class="theater-zoom-btn" type="button" id="theaterZoomOutBtn">Zoom Out</button>
        <div class="theater-zoom-value" id="theaterZoomValue">${Math.round(mapZoom * 100)}%</div>
        <button class="theater-zoom-btn" type="button" id="theaterZoomInBtn">Zoom In</button>
      </div>
      <div class="theater-map-world" style="transform: translate(calc(-50% + ${mapPanX}px), calc(-50% + ${mapPanY}px)) scale(${mapZoom});">
        ${renderConnectionSvg(theater)}
        ${Object.values(theater.rooms).map((room) => renderRoomNode(theater, room, canDescend)).join("")}
        ${Object.values(theater.annexesById ?? {}).map((annex) => renderAnnexNode(theater, annex.annexId)).join("")}
        ${renderStuckNotesLayer("theater", theater.definition.id, "theater-stuck-note")}
        ${renderSquadMarker(theater)}
      </div>
    </section>
  `;
}

function formatObjectiveTypeLabel(objectiveType: NonNullable<ReturnType<typeof getTheaterObjectiveDefinition>>["objectiveType"]): string {
  switch (objectiveType) {
    case "build_core":
      return "C.O.R.E.";
    case "route_power":
      return "Route Power";
    case "establish_comms":
      return "Establish Comms";
    case "deliver_supply":
      return "Deliver Supply";
    case "sustain_occupation":
      return "Sustain Occupation";
    case "multi_resource":
      return "Multi-Resource";
    default:
      return "Objective";
  }
}

function renderObjectiveSummary(theater: TheaterNetworkState): string {
  const objective = getTheaterObjectiveDefinition(theater);
  if (!objective) {
    return "";
  }

  const progress = objective.progress;
  const progressLines = [
    objective.cratesRequired ? `Crates ${progress.cratesDelivered}/${objective.cratesRequired}` : null,
    objective.powerRequired ? `Power ${progress.powerRouted}/${objective.powerRequired}` : null,
    objective.bwRequired ? `Comms ${progress.bwEstablished}/${objective.bwRequired}` : null,
    objective.ticksRequired ? `Hold ${progress.ticksHeld}/${objective.ticksRequired}` : null,
    objective.requiredCoreType ? `C.O.R.E. ${progress.builtCoreType === objective.requiredCoreType ? "READY" : "PENDING"}` : null,
    objective.multiResource?.crates ? `MR Crates ${progress.cratesDelivered}/${objective.multiResource.crates}` : null,
    objective.multiResource?.power ? `MR Power ${progress.powerRouted}/${objective.multiResource.power}` : null,
    objective.multiResource?.bw ? `MR Comms ${progress.bwEstablished}/${objective.multiResource.bw}` : null,
  ].filter(Boolean);

  return `
    <div class="theater-objective-panel">
      <div class="theater-objective-panel__header">
        <span>Objective Type</span>
        <strong>${formatObjectiveTypeLabel(objective.objectiveType)}</strong>
      </div>
      <div class="theater-objective-panel__copy">${objective.label}</div>
      <div class="theater-objective-panel__progress">
        ${progressLines.map((line) => `<span>${line}</span>`).join("")}
      </div>
      <div class="theater-objective-panel__state ${progress.completed ? "theater-objective-panel__state--complete" : ""}">
        ${progress.completed ? "OBJECTIVE READY TO COMPLETE" : "OBJECTIVE IN PROGRESS"}
      </div>
    </div>
  `;
}

function formatSquadStatusLabel(_theater: TheaterNetworkState, squad: TheaterSquadState): string {
  if (!squad.isInContact) {
    return "COMMS OFFLINE";
  }
  switch (squad.status) {
    case "threatened":
      return "THREATENED";
    case "pinned":
      return "PINNED";
    case "moving":
      return "MOVING";
    case "idle":
    default:
      return "IDLE";
  }
}

function isTheaterUnitIncapacitated(unitId: string, theater: TheaterNetworkState): boolean {
  const state = getGameState();
  const operationId = state.operation?.id;
  const unit = state.unitsById[unitId];
  return Boolean(
    operationId
    && unit?.operationInjury
    && unit.operationInjury.operationId === operationId
    && unit.operationInjury.theaterId === theater.definition.id
  );
}

function getSquadAutomationLabel(squad: TheaterSquadState): string {
  switch (squad.automationMode) {
    case "undaring":
      return "UNDARING";
    case "daring":
      return "DARING";
    case "manual":
    default:
      return "MANUAL";
  }
}

function getActiveLocalTheaterSlots(state: GameState): PlayerSlot[] {
  return isLocalCoopActive(state) ? ["P1", "P2"] : ["P1"];
}

function getTheaterSquadOwnerSummary(state: GameState, squad: TheaterSquadState): string {
  const controllerCounts = squad.unitIds.reduce((acc, unitId) => {
    const controller = state.unitsById[unitId]?.controller ?? "P1";
    acc[controller] = (acc[controller] ?? 0) + 1;
    return acc;
  }, {} as Partial<Record<SessionPlayerSlot, number>>);

  const ownerLabels = SESSION_PLAYER_SLOTS
    .filter((slot) => (controllerCounts[slot] ?? 0) > 0)
    .map((slot) => `${getPlayerControllerLabel(slot)} ${controllerCounts[slot] ?? 0}`);

  return ownerLabels.length > 0 ? ownerLabels.join(" // ") : "UNASSIGNED";
}

function getTheaterSquadLinkSummary(state: GameState, squadId: string): string {
  const assignedSlots = getTheaterAssignedPlayerSlots(state, squadId);
  if (assignedSlots.length <= 0) {
    return "COMMAND LINK OPEN";
  }
  return assignedSlots.map((slot) => getPlayerControllerLabel(slot)).join(" + ");
}

function getTheaterManageLoadout(unit: Unit): {
  primaryWeapon: string | null;
  secondaryWeapon: string | null;
  helmet: string | null;
  chestpiece: string | null;
  accessory1: string | null;
  accessory2: string | null;
} {
  const rawLoadout = (unit.loadout ?? {}) as Record<string, string | null | undefined>;
  return {
    primaryWeapon: rawLoadout.primaryWeapon ?? rawLoadout.weapon ?? null,
    secondaryWeapon: rawLoadout.secondaryWeapon ?? null,
    helmet: rawLoadout.helmet ?? null,
    chestpiece: rawLoadout.chestpiece ?? null,
    accessory1: rawLoadout.accessory1 ?? null,
    accessory2: rawLoadout.accessory2 ?? null,
  };
}

function formatTheaterManageEquipmentName(
  equipmentId: string | null | undefined,
  equipmentById: Record<string, { name?: string }>,
): string {
  if (!equipmentId) {
    return "None";
  }
  return equipmentById[equipmentId]?.name ?? equipmentId.replace(/_/g, " ").toUpperCase();
}

function formatTheaterManageStatValue(value: number | string | null | undefined): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return "--";
}

function getTheaterManageStatusLabels(entry: TheaterManageUnitEntry): string[] {
  const labels: string[] = [];
  if (entry.isIncapacitated) {
    labels.push("INCAPACITATED");
  }
  (entry.unit.operationStatuses ?? [])
    .filter((status) => !status.placeholder)
    .forEach((status) => {
      const baseLabel = (status.label ?? status.type ?? "").trim();
      if (baseLabel.length <= 0) {
        return;
      }
      const upperLabel = baseLabel.toUpperCase();
      if (!labels.includes(upperLabel)) {
        labels.push(upperLabel);
      }
    });
  return labels;
}

function getTheaterManageUnitEntries(
  theater: TheaterNetworkState,
  state: GameState = getGameState(),
): TheaterManageUnitEntry[] {
  const selectedSquadId = theater.selectedSquadId;
  const orderedSquads = [...theater.squads].sort((left, right) => {
    if (left.squadId === selectedSquadId && right.squadId !== selectedSquadId) {
      return -1;
    }
    if (right.squadId === selectedSquadId && left.squadId !== selectedSquadId) {
      return 1;
    }
    return 0;
  });

  return orderedSquads.flatMap((squad) => {
    const room = theater.rooms[squad.currentRoomId] ?? null;
    return squad.unitIds.flatMap((unitId) => {
      const unit = state.unitsById[unitId];
      if (!unit) {
        return [];
      }
      return [{
        unit,
        squad,
        room,
        isSelectedSquad: squad.squadId === selectedSquadId,
        isIncapacitated: isTheaterUnitIncapacitated(unitId, theater),
      }];
    });
  });
}

function getPreferredTheaterManageUnitId(theater: TheaterNetworkState): string | null {
  const entries = getTheaterManageUnitEntries(theater);
  if (entries.length <= 0) {
    theaterManageSelectedUnitId = null;
    return null;
  }

  const selectedSquadEntries = entries.filter((entry) => entry.isSelectedSquad);
  if (
    theaterManageSelectedUnitId
    && selectedSquadEntries.some((entry) => entry.unit.id === theaterManageSelectedUnitId)
  ) {
    return theaterManageSelectedUnitId;
  }
  return selectedSquadEntries[0]?.unit.id ?? entries[0]?.unit.id ?? null;
}

function getSelectedTheaterManageUnit(theater: TheaterNetworkState): TheaterManageUnitEntry | null {
  const entries = getTheaterManageUnitEntries(theater);
  if (entries.length <= 0) {
    theaterManageSelectedUnitId = null;
    return null;
  }

  const selectedEntry = theaterManageSelectedUnitId
    ? entries.find((entry) => entry.unit.id === theaterManageSelectedUnitId) ?? null
    : null;
  if (selectedEntry) {
    return selectedEntry;
  }

  const fallbackEntry = entries.find((entry) => entry.isSelectedSquad) ?? entries[0] ?? null;
  theaterManageSelectedUnitId = fallbackEntry?.unit.id ?? null;
  return fallbackEntry;
}

function renderManageUnitsWindow(theater: TheaterNetworkState): string {
  const state = getGameState();
  const units = getTheaterManageUnitEntries(theater, state);
  const selectedEntry = getSelectedTheaterManageUnit(theater);
  const equipmentById = (state.equipmentById ?? getAllStarterEquipment()) as Record<string, { name?: string }>;

  if (!selectedEntry) {
    return renderWindowShell(
      "manage",
      THEATER_WINDOW_DEFS.manage.title,
      THEATER_WINDOW_DEFS.manage.kicker,
      `
        <div class="battle-manage-node battle-manage-node--empty">
          <div class="battle-manage-node__intro">Roster telemetry becomes available here as soon as the theater has deployable units.</div>
          <div class="battle-manage-empty">No units are currently assigned to this theater.</div>
        </div>
      `,
      theater,
      { bodyClassName: "battle-node__body--manage" },
    );
  }

  const selectedUnit = selectedEntry.unit;
  const selectedSquadLabel = getSquadDisplayName(selectedEntry.squad);
  const selectedRoomLabel = selectedEntry.room?.label ?? selectedEntry.squad.currentRoomId;
  const selectedController = getPlayerControllerLabel((selectedUnit.controller ?? "P1") as PlayerSlot);
  const selectedStatuses = getTheaterManageStatusLabels(selectedEntry);
  const selectedLoadout = getTheaterManageLoadout(selectedUnit);
  const classLabel = ((selectedUnit.unitClass ?? "unit") as string).replace(/_/g, " ").toUpperCase();
  const attackValue = formatTheaterManageStatValue((selectedUnit as any).atk);
  const defenseValue = formatTheaterManageStatValue((selectedUnit as any).def);
  const agilityValue = formatTheaterManageStatValue(selectedUnit.agi);
  const powerValue = formatTheaterManageStatValue(selectedUnit.pwr);
  const detailNote = selectedEntry.isIncapacitated
    ? "Incapacitated in this operation. Recover the unit before using it in direct assaults."
    : `${selectedController} assigned to ${getSquadDisplayIcon(selectedEntry.squad)} ${selectedSquadLabel} inside ${selectedRoomLabel}.`;

  const body = `
    <div class="battle-manage-node">
      <div class="battle-manage-node__intro">Live squad, loadout, and readiness telemetry. Use Manage Units to open the full roster and change equipment during the operation.</div>
      <div class="battle-manage-body">
        <div class="battle-manage-list">
          ${units.map((entry) => {
            const unit = entry.unit;
            const roomLabel = entry.room?.label ?? entry.squad.currentRoomId;
            const controllerLabel = getPlayerControllerLabel((unit.controller ?? "P1") as PlayerSlot);
            const statusLabels = getTheaterManageStatusLabels(entry);
            const isSelected = unit.id === selectedUnit.id;
            const rowPowerValue = formatTheaterManageStatValue(unit.pwr);
            const rowAttackValue = formatTheaterManageStatValue((unit as any).atk);
            const rowDefenseValue = formatTheaterManageStatValue((unit as any).def);
            const rowAgilityValue = formatTheaterManageStatValue(unit.agi);
            const badgeLabel = entry.isIncapacitated
              ? "INCAPACITATED"
              : entry.isSelectedSquad
                ? "SELECTED SQUAD"
                : "";

            return `
              <button
                class="battle-manage-unit-row ${isSelected ? "battle-manage-unit-row--selected" : ""}"
                data-theater-manage-unit-id="${escapeHtmlAttribute(unit.id)}"
                type="button"
              >
                <div class="battle-manage-unit-portrait">
                  <img src="${getBattleUnitPortraitPath(unit.id, unit.id)}" alt="${escapeHtmlAttribute(unit.name)}" onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';" />
                </div>
                <div class="battle-manage-unit-summary">
                  <div class="battle-manage-unit-row-top">
                    <span class="battle-manage-unit-name">${escapeHtml(unit.name)}</span>
                    ${badgeLabel ? `<span class="battle-manage-unit-badge">${escapeHtml(badgeLabel)}</span>` : ""}
                  </div>
                  <div class="battle-manage-unit-row-meta">
                    <span>HP ${unit.hp}/${unit.maxHp}</span>
                    <span>STRAIN ${unit.strain}</span>
                    <span>PWR ${rowPowerValue}</span>
                    <span>ROOM ${escapeHtml(roomLabel.toUpperCase())}</span>
                  </div>
                  <div class="battle-manage-unit-row-meta battle-manage-unit-row-meta--minor">
                    <span>${escapeHtml(getSquadDisplayIcon(entry.squad))} ${escapeHtml(getSquadDisplayName(entry.squad))}</span>
                    <span>CTRL ${escapeHtml(controllerLabel)}</span>
                    <span>ATK ${rowAttackValue}</span>
                    <span>DEF ${rowDefenseValue}</span>
                    <span>AGI ${rowAgilityValue}</span>
                  </div>
                  <div class="battle-manage-unit-statusline">
                    ${statusLabels.length > 0
                      ? statusLabels.map((label) => `<span class="battle-manage-status-chip">${escapeHtml(label)}</span>`).join("")
                      : `<span class="battle-manage-status-chip battle-manage-status-chip--muted">NO ACTIVE STATUS FLAGS</span>`}
                  </div>
                </div>
              </button>
            `;
          }).join("")}
        </div>
        <div class="battle-manage-detail">
          <div class="battle-manage-detail-hero">
            <div class="battle-manage-detail-portrait">
              <img
                src="${getBattleUnitPortraitPath(selectedUnit.id, selectedUnit.id)}"
                alt="${escapeHtmlAttribute(selectedUnit.name)}"
                onerror="this.src='/assets/portraits/units/core/Test_Portrait.png';"
              />
            </div>
            <div class="battle-manage-detail-copy">
              <div class="battle-manage-detail-name">${escapeHtml(selectedUnit.name)}</div>
              <div class="battle-manage-detail-class">${escapeHtml(classLabel)}</div>
              <div class="battle-manage-detail-note">${escapeHtml(detailNote)}</div>
            </div>
          </div>
          <div class="battle-manage-stat-grid">
            <div class="battle-manage-stat-card">
              <div class="battle-manage-stat-label">Hit Points</div>
              <div class="battle-manage-stat-value">${selectedUnit.hp} / ${selectedUnit.maxHp}</div>
            </div>
            <div class="battle-manage-stat-card">
              <div class="battle-manage-stat-label">Strain</div>
              <div class="battle-manage-stat-value">${selectedUnit.strain}</div>
            </div>
            <div class="battle-manage-stat-card">
              <div class="battle-manage-stat-label">PWR</div>
              <div class="battle-manage-stat-value">${powerValue}</div>
            </div>
            <div class="battle-manage-stat-card">
              <div class="battle-manage-stat-label">Controller</div>
              <div class="battle-manage-stat-value">${escapeHtml(selectedController)}</div>
            </div>
            <div class="battle-manage-stat-card">
              <div class="battle-manage-stat-label">Room</div>
              <div class="battle-manage-stat-value">${escapeHtml(selectedRoomLabel)}</div>
            </div>
            <div class="battle-manage-stat-card">
              <div class="battle-manage-stat-label">Attack / Defense</div>
              <div class="battle-manage-stat-value">${attackValue} / ${defenseValue}</div>
            </div>
            <div class="battle-manage-stat-card">
              <div class="battle-manage-stat-label">Agility</div>
              <div class="battle-manage-stat-value">${agilityValue}</div>
            </div>
            <div class="battle-manage-stat-card">
              <div class="battle-manage-stat-label">Squad</div>
              <div class="battle-manage-stat-value">${escapeHtml(getSquadDisplayIcon(selectedEntry.squad))} ${escapeHtml(selectedSquadLabel)}</div>
            </div>
          </div>
          <div class="battle-manage-detail-section">
            <div class="battle-manage-detail-section-title">Assigned Loadout</div>
            <div class="battle-manage-loadout-grid">
              <div class="battle-manage-loadout-row"><span>Primary Weapon</span><span>${escapeHtml(formatTheaterManageEquipmentName(selectedLoadout.primaryWeapon, equipmentById))}</span></div>
              <div class="battle-manage-loadout-row"><span>Secondary Weapon</span><span>${escapeHtml(formatTheaterManageEquipmentName(selectedLoadout.secondaryWeapon, equipmentById))}</span></div>
              <div class="battle-manage-loadout-row"><span>Helmet</span><span>${escapeHtml(formatTheaterManageEquipmentName(selectedLoadout.helmet, equipmentById))}</span></div>
              <div class="battle-manage-loadout-row"><span>Chestpiece</span><span>${escapeHtml(formatTheaterManageEquipmentName(selectedLoadout.chestpiece, equipmentById))}</span></div>
              <div class="battle-manage-loadout-row"><span>Accessory 1</span><span>${escapeHtml(formatTheaterManageEquipmentName(selectedLoadout.accessory1, equipmentById))}</span></div>
              <div class="battle-manage-loadout-row"><span>Accessory 2</span><span>${escapeHtml(formatTheaterManageEquipmentName(selectedLoadout.accessory2, equipmentById))}</span></div>
            </div>
          </div>
          <div class="battle-manage-detail-section">
            <div class="battle-manage-detail-section-title">Theater Readout</div>
            <div class="battle-manage-loadout-grid">
              <div class="battle-manage-loadout-row"><span>Squad</span><span>${escapeHtml(getSquadDisplayIcon(selectedEntry.squad))} ${escapeHtml(selectedSquadLabel)}</span></div>
              <div class="battle-manage-loadout-row"><span>Room</span><span>${escapeHtml(selectedRoomLabel)}</span></div>
              <div class="battle-manage-loadout-row"><span>Automation</span><span>${escapeHtml(getSquadAutomationLabel(selectedEntry.squad))}</span></div>
              <div class="battle-manage-loadout-row"><span>Command Link</span><span>${escapeHtml(getTheaterSquadLinkSummary(state, selectedEntry.squad.squadId))}</span></div>
              <div class="battle-manage-loadout-row"><span>Status Effects</span><span>${escapeHtml(selectedStatuses.length > 0 ? selectedStatuses.join(", ") : "None")}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  return renderWindowShell(
    "manage",
    THEATER_WINDOW_DEFS.manage.title,
    THEATER_WINDOW_DEFS.manage.kicker,
    body,
    theater,
    { bodyClassName: "battle-node__body--manage" },
  );
}

function renderSquadsWindow(theater: TheaterNetworkState): string {
  const state = getGameState();
  const selectedSquad = getSelectedTheaterSquad(theater);
  const selectedSquadLabel = getSquadDisplayName(selectedSquad);
  const activeLocalSlots = getActiveLocalTheaterSlots(state);
  const body = `
    <div class="theater-copy">
      Split, recombine, and reassign units between squads. Assign Manual, Undaring, or Daring automation for local theater actions when you do not want to command every contact directly.
    </div>
    <div class="theater-inline-actions theater-inline-actions--tight">
      ${activeLocalSlots.map((slot) => {
        const assignment = state.session.theaterAssignments?.[slot];
        const assignedSquad = assignment?.squadId
          ? theater.squads.find((squad) => squad.squadId === assignment.squadId) ?? null
          : null;
        const isFocused = Boolean(assignedSquad && theater.selectedSquadId === assignedSquad.squadId);
        return `
          <button
            class="theater-chip-button ${isFocused ? "theater-chip-button--active" : ""}"
            type="button"
            data-theater-player-focus="${slot}"
            ${assignedSquad ? "" : "disabled"}
          >
            ${getPlayerControllerLabel(slot)} :: ${assignedSquad ? `${getSquadDisplayIcon(assignedSquad)} ${getSquadDisplayName(assignedSquad)}` : "UNASSIGNED"}
          </button>
        `;
      }).join("")}
    </div>
    <div class="theater-squad-ledger">
      ${theater.squads.map((squad) => {
        const room = theater.rooms[squad.currentRoomId];
        const isSelected = squad.squadId === theater.selectedSquadId;
        const canIssueOrders = canManuallyControlTheaterSquad(theater, squad);
        const isEmergencyControl = canIssueOrders && !squad.isInContact;
        const canAcceptDraggedUnit = theater.squads.some((other) => canTransferUnitBetweenRenderedSquads(other, squad));
        const canMergeIntoSelected =
          selectedSquad
          && selectedSquad.squadId !== squad.squadId
          && selectedSquad.currentRoomId === squad.currentRoomId
          && (selectedSquad.unitIds.length + squad.unitIds.length) <= THEATER_SQUAD_UNIT_LIMIT;
        const canTransferToSelected =
          selectedSquad
          && selectedSquad.squadId !== squad.squadId
          && selectedSquad.currentRoomId === squad.currentRoomId
          && selectedSquad.unitIds.length < THEATER_SQUAD_UNIT_LIMIT;
        const assignedSlots = getTheaterAssignedPlayerSlots(state, squad.squadId);
        const incapacitatedCount = squad.unitIds.filter((unitId) => isTheaterUnitIncapacitated(unitId, theater)).length;
        const squadCardClasses = [
          "theater-squad-card",
          isSelected ? "theater-squad-card--selected" : "",
          squad.isInContact ? "" : "theater-squad-card--offline",
          isEmergencyControl ? "theater-squad-card--emergency-control" : "",
          canAcceptDraggedUnit ? "theater-squad-card--dropzone" : "",
        ].filter(Boolean).join(" ");

        return `
          <article
            class="${squadCardClasses}"
            data-theater-squad-dropzone="${squad.squadId}"
          >
            <div class="theater-squad-card__header">
              <div class="theater-squad-card__identity">
                <div class="theater-squad-card__identity-actions">
                  <button
                    class="theater-squad-card__icon"
                    type="button"
                    data-theater-squad-icon="${squad.squadId}"
                    data-theater-squad-icon-next="${getNextSquadIcon(getSquadDisplayIcon(squad))}"
                    aria-label="Change icon for ${getSquadDisplayName(squad)}"
                  >
                    ${getSquadDisplayIcon(squad)}
                  </button>
                  <button
                    class="theater-window-color theater-squad-card__color"
                    type="button"
                    data-theater-squad-color="${squad.squadId}"
                    data-theater-squad-color-next="${getNextSquadColorKey(getSquadColorKey(squad))}"
                    aria-label="Change color for ${getSquadDisplayName(squad)}"
                    style="${getSquadColorButtonStyle(squad)}"
                  >
                    <span class="theater-window-color-dot" aria-hidden="true"></span>
                  </button>
                </div>
                <div class="theater-squad-card__identity-copy">
                  <input
                    class="theater-squad-card__name-input"
                    type="text"
                    value="${escapeHtmlAttribute(getSquadDisplayName(squad))}"
                    maxlength="24"
                    data-theater-squad-rename="${squad.squadId}"
                    aria-label="Rename ${getSquadDisplayName(squad)}"
                  />
                </div>
              </div>
              <div>
                <div class="theater-squad-card__meta">${room?.label ?? squad.currentRoomId} // ${squad.unitIds.length} UNIT(S)${incapacitatedCount > 0 ? ` // ${incapacitatedCount} INCAPACITATED` : ""}</div>
                <div class="theater-squad-card__meta">MODE ${getSquadAutomationLabel(squad)} // ${squad.autoStatus.toUpperCase()}</div>
                <div class="theater-squad-card__meta">OWNERS ${getTheaterSquadOwnerSummary(state, squad)}</div>
                <div class="theater-squad-card__meta">COMMAND LINK ${getTheaterSquadLinkSummary(state, squad.squadId)}</div>
              </div>
              <div class="theater-squad-card__status">${formatSquadStatusLabel(theater, squad)}</div>
            </div>
            <div class="theater-squad-card__bandwidth">
              <span>BW REQUIRED ${squad.bwRequired}</span>
              <span>BW AVAILABLE ${squad.bwAvailable}</span>
            </div>
            <div class="theater-squad-card__bandwidth">
              <span>AUTOMATION</span>
              <span>${getSquadAutomationLabel(squad)}</span>
            </div>
            <div class="theater-inline-actions theater-inline-actions--tight">
              ${(["manual", "undaring", "daring"] as const).map((mode) => `
                <button
                  class="theater-chip-button ${squad.automationMode === mode ? "theater-chip-button--active" : ""}"
                  type="button"
                  data-theater-squad-automation="${squad.squadId}"
                  data-theater-squad-automation-mode="${mode}"
                >
                  ${mode === "manual" ? "Manual" : mode === "undaring" ? "Undaring" : "Daring"}
                </button>
              `).join("")}
            </div>
            ${activeLocalSlots.length > 0 ? `
              <div class="theater-inline-actions theater-inline-actions--tight">
                ${activeLocalSlots.map((slot) => {
                  const isAssignedToSlot = assignedSlots.includes(slot);
                  return `
                    <button
                      class="theater-chip-button ${isAssignedToSlot ? "theater-chip-button--active" : ""}"
                      type="button"
                      data-theater-squad-assign="${squad.squadId}"
                      data-theater-squad-assign-player="${slot}"
                    >
                      ${isAssignedToSlot ? `Release ${getPlayerControllerLabel(slot)}` : `Assign ${getPlayerControllerLabel(slot)}`}
                    </button>
                  `;
                }).join("")}
              </div>
            ` : ""}
            ${!squad.isInContact ? `
              <div class="theater-squad-card__offline-note">
                COMMS OFFLINE${isEmergencyControl ? " // EMERGENCY CONTROL ACTIVE" : ""}
              </div>
            ` : ""}
            <div class="theater-squad-card__actions">
              <button class="theater-secondary-btn" type="button" data-theater-squad-select="${squad.squadId}">
                ${isSelected ? "Selected" : "Switch To Squad"}
              </button>
              ${canMergeIntoSelected ? `
                <button class="theater-secondary-btn" type="button" data-theater-squad-merge="${squad.squadId}">
                  Merge Into ${selectedSquadLabel}
                </button>
              ` : ""}
            </div>
            <div class="theater-squad-card__units">
              ${squad.unitIds.map((unitId) => {
                const canDragUnit = theater.squads.some((other) => canTransferUnitBetweenRenderedSquads(squad, other, unitId));
                return `
                <div
                  class="theater-squad-card__unit ${canDragUnit ? "theater-squad-card__unit--draggable" : ""}"
                  ${canDragUnit ? `data-theater-squad-drag-source="${squad.squadId}" data-theater-squad-drag-unit="${unitId}" data-theater-squad-drag-label="${escapeHtmlAttribute(state.unitsById[unitId]?.name ?? unitId)}"` : ""}
                >
                  <span>${state.unitsById[unitId]?.name ?? unitId}${isTheaterUnitIncapacitated(unitId, theater) ? " // INCAPACITATED" : ""}</span>
                  <div class="theater-squad-card__unit-actions">
                    ${isSelected && squad.unitIds.length > 1 ? `
                      <button class="theater-chip-button" type="button" data-theater-squad-split="${squad.squadId}" data-theater-squad-unit="${unitId}">
                        Split
                      </button>
                    ` : ""}
                    ${canTransferToSelected && squad.unitIds.length > 1 ? `
                      <button class="theater-chip-button" type="button" data-theater-squad-transfer="${squad.squadId}" data-theater-squad-target="${selectedSquad?.squadId}" data-theater-squad-unit="${unitId}">
                        To ${selectedSquadLabel}
                      </button>
                    ` : ""}
                  </div>
                </div>
              `;
              }).join("")}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;

  return renderWindowShell("squads", THEATER_WINDOW_DEFS.squads.title, THEATER_WINDOW_DEFS.squads.kicker, body, theater);
}

function renderOpsWindow(theater: TheaterNetworkState, totalFloors: number): string {
  const campaignScopeCopy = theater.definition.floorOrdinal < CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL
    ? `Campaign progression active // Final floor is ${String(CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL).padStart(2, "0")}.`
    : theater.objectiveComplete
      ? "Final floor complete // postgame floor regeneration is available when you return to A.T.L.A.S."
      : `Final floor reached // clear this sector objective to finish the campaign on Floor ${String(CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL).padStart(2, "0")}.`;
  const actionBlock = theater.objectiveComplete
    ? `
      <div class="theater-copy theater-copy--muted">
        Objective secured. Exit transit and rewards are pinned to the final room so you can remain in theater until you are ready.
      </div>
      <div class="theater-inline-actions">
        <button class="theater-secondary-btn" type="button" id="theaterManageUnitsBtn">Manage Units</button>
        <button class="theater-secondary-btn" type="button" disabled>Exit At Objective Room</button>
      </div>
    `
    : `
      <div class="theater-inline-actions">
        <button class="theater-secondary-btn" type="button" id="theaterManageUnitsBtn">Manage Units</button>
        <button class="theater-secondary-btn" type="button" id="theaterReturnToBaseBtn">Return To A.T.L.A.S.</button>
      </div>
    `;

  const body = `
    <div class="theater-copy"><strong>Objective:</strong> ${theater.definition.objective}</div>
    <div class="theater-beta-scope">${campaignScopeCopy}</div>
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
    ${renderObjectiveSummary(theater)}
    ${actionBlock}
  `;
  return renderWindowShell("ops", THEATER_WINDOW_DEFS.ops.title, THEATER_WINDOW_DEFS.ops.kicker, body, theater);
}

function getNodeTargetOptions(theater: TheaterNetworkState, sourceNodeId: string, requiredBw = 0): Array<{ value: string; label: string; disabled: boolean }> {
  return [
    ...Object.values(theater.rooms)
      .filter((room) => room.commsVisible || room.id === theater.currentRoomId || room.id === theater.selectedRoomId)
      .map((room) => ({
        value: room.id,
        label: `${room.label} // ROOM`,
        disabled: requiredBw > 0 && room.id !== sourceNodeId && !getTheaterNodeAdjacency(theater, sourceNodeId).includes(room.id) && !canAutomationReachTarget(theater, sourceNodeId, room.id, requiredBw),
      })),
    ...Object.values(theater.annexesById ?? {})
      .filter((annex) => annex.inheritedControl)
      .map((annex) => ({
        value: annex.annexId,
        label: `${ANNEX_FRAME_DEFINITIONS[annex.frameType].displayName} // ANNEX`,
        disabled: requiredBw > 0 && annex.annexId !== sourceNodeId && !getTheaterNodeAdjacency(theater, sourceNodeId).includes(annex.annexId) && !canAutomationReachTarget(theater, sourceNodeId, annex.annexId, requiredBw),
      })),
  ];
}

function getEdgeTargetOptions(theater: TheaterNetworkState, sourceNodeId: string): Array<{ value: string; label: string; disabled: boolean }> {
  return Object.entries(theater.partitionsByEdgeId ?? {}).map(([edgeId, partition]) => {
    const [fromNodeId, toNodeId] = edgeId.split("__");
    const fromLabel = resolveTheaterNode(theater, fromNodeId)?.label ?? fromNodeId;
    const toLabel = resolveTheaterNode(theater, toNodeId)?.label ?? toNodeId;
    const disabled =
      sourceNodeId !== fromNodeId
      && sourceNodeId !== toNodeId
      && !canAutomationReachTarget(theater, sourceNodeId, fromNodeId, 100);
    return {
      value: edgeId,
      label: `${fromLabel} <-> ${toLabel} // ${partition.state.toUpperCase()}`,
      disabled,
    };
  });
}

function renderSelectOptions(
  options: Array<{ value: string; label: string; disabled?: boolean }>,
  selectedValue: string | null | undefined,
  emptyLabel: string,
): string {
  return `
    <option value="">${emptyLabel}</option>
    ${options.map((option) => `
      <option value="${option.value}" ${selectedValue === option.value ? "selected" : ""} ${option.disabled ? "disabled" : ""}>
        ${option.label}
      </option>
    `).join("")}
  `;
}

function renderModuleConfigCard(theater: TheaterNetworkState, moduleInstance: ModuleInstance): string {
  const definition = FOUNDRY_MODULE_DEFINITIONS[moduleInstance.moduleType];
  const runtime = theater.automation?.moduleRuntimeById?.[moduleInstance.instanceId];
  const signalSnapshot = theater.automation?.activeSignalSnapshots?.find((snapshot) => snapshot.moduleId === moduleInstance.instanceId);
  const upstreamOptions = Object.values(theater.automation?.moduleInstancesById ?? {})
    .filter((candidate) => candidate.instanceId !== moduleInstance.instanceId)
    .map((candidate) => ({
      value: candidate.instanceId,
      label: `${FOUNDRY_MODULE_DEFINITIONS[candidate.moduleType]?.displayName ?? candidate.moduleType} // ${candidate.installedNodeId}`,
    }));
  const targetNodeOptions = getNodeTargetOptions(theater, moduleInstance.installedNodeId, definition.remoteTargetMinBw ?? 0);
  const edgeTargetOptions = getEdgeTargetOptions(theater, moduleInstance.installedNodeId);
  const selectedInputs = moduleInstance.configuration.inputModuleIds ?? [];
  const selectedTargetNode = moduleInstance.configuration.target?.nodeId ?? moduleInstance.configuration.monitorTarget?.nodeId ?? "";
  const signalLabel = signalSnapshot
    ? `${signalSnapshot.output.kind === "empty" ? "0" : signalSnapshot.output.value} // ${signalSnapshot.active ? "ACTIVE" : "IDLE"}`
    : runtime
      ? `${runtime.lastOutput.kind === "empty" ? "0" : runtime.lastOutput.value} // ${runtime.active ? "ACTIVE" : "IDLE"}`
      : "No signal";

  return `
    <article class="theater-module-card">
      <div class="theater-module-card__header">
        <div>
          <div class="theater-module-card__kicker">${definition.category.toUpperCase()}</div>
          <h4 class="theater-module-card__title">${definition.displayName}</h4>
        </div>
        <div class="theater-module-card__signal">${signalLabel}</div>
      </div>
      <div class="theater-module-card__copy">${definition.description}</div>
      <div class="theater-module-card__meta">
        <span>Host: ${moduleInstance.installedNodeId}</span>
        ${runtime ? `<span>Stored: ${Math.round(runtime.storedAmount)}</span>` : ""}
      </div>
      <div class="theater-module-card__form">
        ${(definition.category === "sensor" || moduleInstance.moduleType === "cache_release" || moduleInstance.moduleType === "power_router" || moduleInstance.moduleType === "bandwidth_router" || moduleInstance.moduleType === "signal_relay") ? `
          <label class="theater-module-card__field">
            <span>${definition.category === "sensor" ? "Monitor Target" : "Target Node"}</span>
            <select id="theaterModuleTarget_${moduleInstance.instanceId}">
              ${renderSelectOptions(targetNodeOptions, selectedTargetNode, "Select target")}
            </select>
          </label>
        ` : ""}
        ${moduleInstance.moduleType === "door_controller" ? `
          <label class="theater-module-card__field">
            <span>Blast Door Edge</span>
            <select id="theaterModuleEdge_${moduleInstance.instanceId}">
              ${renderSelectOptions(edgeTargetOptions, moduleInstance.configuration.target?.edgeId, "Select blast door")}
            </select>
          </label>
          <label class="theater-module-card__field">
            <span>When Triggered</span>
            <select id="theaterModuleDoorState_${moduleInstance.instanceId}">
              <option value="closed" ${moduleInstance.configuration.desiredDoorState !== "open" ? "selected" : ""}>Close Door</option>
              <option value="open" ${moduleInstance.configuration.desiredDoorState === "open" ? "selected" : ""}>Open Door</option>
            </select>
          </label>
        ` : ""}
        ${(definition.category === "logic" || definition.category === "actuator" || definition.category === "router" || moduleInstance.moduleType === "latch" || moduleInstance.moduleType === "delay_buffer") ? `
          <label class="theater-module-card__field">
            <span>Upstream A</span>
            <select id="theaterModuleInputA_${moduleInstance.instanceId}">
              ${renderSelectOptions(upstreamOptions, selectedInputs[0], "No upstream")}
            </select>
          </label>
        ` : ""}
        ${(moduleInstance.moduleType === "and_gate" || moduleInstance.moduleType === "or_gate") ? `
          <label class="theater-module-card__field">
            <span>Upstream B</span>
            <select id="theaterModuleInputB_${moduleInstance.instanceId}">
              ${renderSelectOptions(upstreamOptions, selectedInputs[1], "No upstream")}
            </select>
          </label>
        ` : ""}
        ${moduleInstance.moduleType === "threshold_switch" ? `
          <label class="theater-module-card__field">
            <span>Comparison</span>
            <select id="theaterModuleComparison_${moduleInstance.instanceId}">
              <option value=">=" ${(moduleInstance.configuration.comparison ?? ">=") === ">=" ? "selected" : ""}>Greater Or Equal</option>
              <option value="<=" ${(moduleInstance.configuration.comparison ?? ">=") === "<=" ? "selected" : ""}>Less Or Equal</option>
            </select>
          </label>
          <label class="theater-module-card__field">
            <span>Threshold</span>
            <input id="theaterModuleThreshold_${moduleInstance.instanceId}" type="number" min="0" value="${moduleInstance.configuration.threshold ?? 1}" />
          </label>
        ` : ""}
        ${(moduleInstance.moduleType === "delay_timer" || moduleInstance.moduleType === "delay_buffer") ? `
          <label class="theater-module-card__field">
            <span>Delay Ticks</span>
            <input id="theaterModuleDelay_${moduleInstance.instanceId}" type="number" min="1" value="${moduleInstance.configuration.delayTicks ?? 2}" />
          </label>
        ` : ""}
        ${(moduleInstance.moduleType === "cache_release" || moduleInstance.moduleType === "power_router" || moduleInstance.moduleType === "bandwidth_router") ? `
          <label class="theater-module-card__field">
            <span>Transfer Amount</span>
            <input id="theaterModuleTransfer_${moduleInstance.instanceId}" type="number" min="1" value="${moduleInstance.configuration.transferAmount ?? 25}" />
          </label>
        ` : ""}
        ${(moduleInstance.moduleType === "power_stabilizer" || moduleInstance.moduleType === "comms_stabilizer") ? `
          <label class="theater-module-card__field">
            <span>Floor Amount</span>
            <input id="theaterModuleFloor_${moduleInstance.instanceId}" type="number" min="1" value="${moduleInstance.configuration.floorAmount ?? (moduleInstance.moduleType === "power_stabilizer" ? 50 : 25)}" />
          </label>
        ` : ""}
      </div>
      <div class="theater-inline-actions">
        <button class="theater-secondary-btn" type="button" data-theater-module-apply="${moduleInstance.instanceId}">Apply Config</button>
        <button class="theater-secondary-btn" type="button" data-theater-module-reset="${moduleInstance.instanceId}">Reset State</button>
        <button class="theater-secondary-btn theater-secondary-btn--danger" type="button" data-theater-module-remove="${moduleInstance.instanceId}">Remove</button>
      </div>
    </article>
  `;
}

function renderSelectedNodeTabControls(): string {
  const renderTab = (tab: TheaterCorePanelTab): string => `
    <button class="theater-core-tab ${corePanelTab === tab ? "theater-core-tab--active" : ""}" type="button" data-theater-core-tab="${tab}">
      ${THEATER_SELECTED_ROOM_TAB_LABELS[tab]}
    </button>
  `;
  const advancedActive = isTheaterSelectedRoomAdvancedTab(corePanelTab);
  const advancedOpen = selectedRoomAdvancedOpen || advancedActive;
  return `
    <div class="theater-core-tabs theater-core-tabs--primary">
      ${THEATER_SELECTED_ROOM_PRIMARY_TABS.map(renderTab).join("")}
    </div>
    <section class="theater-selected-room-advanced ${advancedOpen ? "theater-selected-room-advanced--open" : "theater-selected-room-advanced--collapsed"} ${advancedActive ? "theater-selected-room-advanced--active" : ""}">
      <button class="theater-selected-room-advanced__toggle" type="button" data-theater-advanced-toggle="${advancedOpen ? "close" : "open"}" aria-expanded="${advancedOpen ? "true" : "false"}">
        <span>Advanced</span>
        <small>${advancedOpen ? "Hide tactical map, annexes, modules and partitions" : "Show tactical map, annexes, modules and partitions"}</small>
      </button>
      ${advancedOpen ? `
        <div class="theater-core-tabs theater-core-tabs--advanced">
          ${THEATER_SELECTED_ROOM_ADVANCED_TABS.map(renderTab).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function getTacticalObjectLabel(type: TacticalMapObjectType | FieldAssetType): string {
  switch (type) {
    case "med_station":
      return "MED";
    case "ammo_crate":
      return "AMM";
    case "proximity_mine":
      return "MINE";
    case "smoke_emitter":
      return "SMK";
    case "portable_ladder":
      return "LDR";
    case "light_tower":
      return "LGT";
    case "extraction_anchor":
      return "EXT";
    case "destructible_cover":
      return "CVR";
    case "destructible_wall":
      return "DWL";
    case "barricade_wall":
      return "BAR";
    default:
      return "OBJ";
  }
}

function parseTheaterTacticalTileKey(key: string | null): { x: number; y: number } | null {
  if (!key) {
    return null;
  }
  const [xValue, yValue] = key.split(",");
  const x = Number.parseInt(xValue ?? "", 10);
  const y = Number.parseInt(yValue ?? "", 10);
  return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null;
}

function getSelectedTheaterTacticalTile(tacticalMap: TacticalMapDefinition | null): { x: number; y: number } | null {
  if (!tacticalMap || tacticalMap.tiles.length <= 0) {
    theaterSelectedTacticalTileKey = null;
    return null;
  }
  const selected = parseTheaterTacticalTileKey(theaterSelectedTacticalTileKey);
  const selectedTile = selected
    ? tacticalMap.tiles.find((tile) => tile.x === selected.x && tile.y === selected.y) ?? null
    : null;
  if (selectedTile) {
    return { x: selectedTile.x, y: selectedTile.y };
  }
  const fallbackTile = tacticalMap.tiles[0] ?? null;
  theaterSelectedTacticalTileKey = fallbackTile ? `${fallbackTile.x},${fallbackTile.y}` : null;
  return fallbackTile ? { x: fallbackTile.x, y: fallbackTile.y } : null;
}

function getTheaterSessionResourceSummary(state: GameState) {
  return getSessionResourcePool(state, getLocalSessionPlayerSlot(state));
}

function canAffordTheaterCost(state: GameState, cost: Partial<GameState["resources"]>): boolean {
  return canSessionAffordCost(state, { resources: cost });
}

function captureTheaterWindowBodyScroll(key: TheaterWindowKey): { top: number; left: number } | null {
  const body = document.querySelector<HTMLElement>(`[data-theater-window="${key}"] .theater-window-body`);
  if (!body) {
    return null;
  }
  return {
    top: body.scrollTop,
    left: body.scrollLeft,
  };
}

function queueTheaterRoomBodyScrollRestore(): void {
  theaterPendingRoomBodyScrollRestore = captureTheaterWindowBodyScroll("room");
}

function restoreQueuedTheaterRoomBodyScroll(): void {
  if (!theaterPendingRoomBodyScrollRestore) {
    return;
  }

  const body = document.querySelector<HTMLElement>(`[data-theater-window="room"] .theater-window-body`);
  if (body) {
    body.scrollTop = theaterPendingRoomBodyScrollRestore.top;
    body.scrollLeft = theaterPendingRoomBodyScrollRestore.left;
  }
  theaterPendingRoomBodyScrollRestore = null;
}

function rerenderTheaterCommandScreenWithRoomState(options: { preserveRoomScroll?: boolean; skipWindowFrameCapture?: boolean } = {}): void {
  if (options.preserveRoomScroll) {
    queueTheaterRoomBodyScrollRestore();
  }
  if (options.skipWindowFrameCapture) {
    skipNextTheaterWindowFrameCapture = true;
  }
  renderTheaterCommandScreen();
}

function setTheaterTacticalFullscreen(enabled: boolean): void {
  const frames = ensureTheaterWindowFrames();
  if (enabled) {
    if (!theaterTacticalFullscreenActive) {
      theaterRoomFrameBeforeTacticalFullscreen = { ...frames.room };
    }
    theaterTacticalFullscreenActive = true;
    frames.room = clampFrame("room", {
      ...frames.room,
      x: THEATER_MARGIN_X,
      y: THEATER_TOP_SAFE,
      width: Math.max(THEATER_WINDOW_DEFS.room.minWidth, (window.innerWidth || 1920) - (THEATER_MARGIN_X * 2)),
      height: Math.max(
        THEATER_WINDOW_DEFS.room.minHeight,
        (window.innerHeight || 1080) - THEATER_TOP_SAFE - THEATER_BOTTOM_SAFE,
      ),
      minimized: false,
      zIndex: ++theaterZCounter,
    });
    return;
  }

  theaterTacticalFullscreenActive = false;
  if (!theaterRoomFrameBeforeTacticalFullscreen) {
    return;
  }

  frames.room = clampFrame("room", {
    ...theaterRoomFrameBeforeTacticalFullscreen,
    minimized: false,
    zIndex: ++theaterZCounter,
  });
  theaterRoomFrameBeforeTacticalFullscreen = null;
}

function renderTheaterTacticalMapGrid(
  tacticalMap: TacticalMapDefinition,
  installedFieldAssets: TheaterRoom["placedFieldAssets"] = [],
): string {
  const tileMap = new Map(tacticalMap.tiles.map((tile) => [`${tile.x},${tile.y}`, tile]));
  const objectMap = new Map(tacticalMap.objects.map((objectDef) => [`${objectDef.x},${objectDef.y}`, objectDef]));
  const fieldAssetMap = new Map((installedFieldAssets ?? []).map((asset) => [`${asset.x},${asset.y}`, asset]));
  const selectedTile = getSelectedTheaterTacticalTile(tacticalMap);

  let html = "";
  for (let y = 0; y < tacticalMap.height; y += 1) {
    for (let x = 0; x < tacticalMap.width; x += 1) {
      const key = `${x},${y}`;
      const tile = tileMap.get(key);
      const objectDef = objectMap.get(key);
      const fieldAsset = fieldAssetMap.get(key);
      const classes = [
        "map-builder-cell",
        tile ? "map-builder-cell--playable" : "map-builder-cell--void",
        tile ? `map-builder-cell--surface-${tile.surface}` : "",
        tile && tile.elevation !== 0 ? `map-builder-cell--elevation-${tile.elevation}` : "",
        tacticalMap.zones.friendlySpawn.some((point) => point.x === x && point.y === y) ? "map-builder-cell--friendly-spawn" : "",
        tacticalMap.zones.enemySpawn.some((point) => point.x === x && point.y === y) ? "map-builder-cell--enemy-spawn" : "",
        tacticalMap.zones.relay.some((point) => point.x === x && point.y === y) ? "map-builder-cell--relay" : "",
        tacticalMap.zones.friendlyBreach.some((point) => point.x === x && point.y === y) ? "map-builder-cell--friendly-breach" : "",
        tacticalMap.zones.enemyBreach.some((point) => point.x === x && point.y === y) ? "map-builder-cell--enemy-breach" : "",
        tacticalMap.zones.extraction.some((point) => point.x === x && point.y === y) ? "map-builder-cell--extraction" : "",
        selectedTile?.x === x && selectedTile?.y === y ? "map-builder-cell--traversal-source" : "",
      ].filter(Boolean).join(" ");

      html += `
        <button
          type="button"
          class="${classes}"
          data-theater-tactical-tile="${key}"
        >
          <span class="map-builder-cell__coord">${x},${y}</span>
          ${tile ? `<span class="map-builder-cell__elevation">${tile.elevation}</span>` : ""}
          ${fieldAsset
            ? `<span class="map-builder-cell__object">${getTacticalObjectLabel(fieldAsset.type)}</span>`
            : objectDef
              ? `<span class="map-builder-cell__object">${getTacticalObjectLabel(objectDef.type)}</span>`
              : ""}
        </button>
      `;
    }
  }

  return `
    <div class="map-builder-canvas ${theaterTacticalFullscreenActive ? "map-builder-canvas--theater-fullscreen" : ""}" style="--map-builder-zoom: ${theaterTacticalPreviewZoom.toFixed(2)};">
      <div style="display:grid; grid-template-columns: repeat(${tacticalMap.width}, minmax(84px, 1fr)); gap:6px;">
        ${html}
      </div>
    </div>
  `;
}

function renderModuleLogicBody(
  theater: TheaterNetworkState,
  options: {
    includeTabControls?: boolean;
    includePopoutButton?: boolean;
    includeInstallControls?: boolean;
  } = {},
): string {
  const state = getGameState();
  const selectedNode = getSelectedNode(theater);
  const room = selectedNode?.rootRoom ?? getSelectedRoom(theater);
  const roomModuleCost = getTheaterRoomModuleSlotUpgradeCost(room);
  const selectedNodeModuleIds = selectedNode
    ? (selectedNode.kind === "room" ? (selectedNode.room?.moduleSlots ?? []) : (selectedNode.annex?.moduleSlots ?? []))
        .filter((moduleId): moduleId is string => Boolean(moduleId))
    : [];
  const selectedNodeModules = selectedNodeModuleIds
    .map((moduleId) => theater.automation?.moduleInstancesById?.[moduleId] ?? null)
    .filter((module): module is ModuleInstance => Boolean(module));
  const selectedNodeOpenSlots = selectedNode
    ? (selectedNode.kind === "room" ? (selectedNode.room?.moduleSlots ?? []) : (selectedNode.annex?.moduleSlots ?? []))
      .filter((slot) => slot === null)
      .length
    : 0;
  const installableModules = orderItemsUnlockedFirst(
    getOrderedFoundryModuleTypes().filter((moduleType) => !FOUNDRY_MODULE_DEFINITIONS[moduleType].placeholder),
    (moduleType) => isModuleTypeUnlocked(state, moduleType),
  );
  const popoutButtonLabel = isAutomationWindowOpen() ? "Focus Module Logic Window" : "Pop Out Module Logic";
  const includeInstallControls = options.includeInstallControls ?? true;

  return `
    ${options.includeTabControls ? renderSelectedNodeTabControls() : ""}
    <div class="theater-copy">
      ${includeInstallControls
        ? "Install automation hardware into this node's module slots. Rooms can buy extra slots; annexes inherit their slot count from the selected frame."
        : "Adjust logic, thresholds, and automation behavior for modules already installed on the selected room or annex."}
    </div>
    ${options.includePopoutButton ? `
      <div class="theater-inline-actions">
        <button class="theater-secondary-btn" type="button" data-theater-open-automation-window="true">${popoutButtonLabel}</button>
      </div>
    ` : `
      <div class="theater-copy theater-copy--muted">
        Live mirror of the selected room or annex module controls. Change map selection at any time to retarget this window.
      </div>
    `}
    <div class="theater-info-grid theater-info-grid--two">
      <div class="theater-stat-card"><span>Node</span><strong>${selectedNode?.label ?? room.label}</strong></div>
      <div class="theater-stat-card"><span>Open Slots</span><strong>${selectedNodeOpenSlots}</strong></div>
      <div class="theater-stat-card"><span>Installed Modules</span><strong>${selectedNodeModules.length}</strong></div>
      <div class="theater-stat-card"><span>Signal Snapshots</span><strong>${theater.automation?.activeSignalSnapshots?.length ?? 0}</strong></div>
    </div>
    ${includeInstallControls
      ? `${selectedNode?.kind === "room" ? `
      <button
        class="theater-action-btn"
        type="button"
        data-theater-upgrade-module-slots="${room.id}"
        ${roomModuleCost ? "" : "disabled"}
      >
        ${roomModuleCost ? `Add Room Module Slot // ${formatResourceCost(roomModuleCost)}` : "Room Module Slots Maxed"}
        <small>${room.moduleSlotCapacity ?? 0} / 4 slots currently authorized in this room.</small>
      </button>
    ` : `
      <div class="theater-copy theater-copy--muted">
        Annex slots come from the frame itself. Select a larger annex frame if you need more hardware capacity here.
      </div>
    `}
    <div class="theater-core-list">
      ${installableModules.map((moduleType) => {
        const definition = FOUNDRY_MODULE_DEFINITIONS[moduleType];
        const locked = !isModuleTypeUnlocked(state, moduleType);
        return `
          <button
            class="theater-action-btn ${locked ? "theater-action-btn--locked" : ""}"
            type="button"
            data-theater-install-module="${selectedNode?.id ?? room.id}"
            data-theater-module-type="${moduleType}"
            ${locked || selectedNodeOpenSlots <= 0 ? "disabled" : ""}
          >
            ${locked ? "Locked" : "Install"} ${definition.displayName}
            <small>${definition.description}</small>
            <small>Build Cost: ${formatResourceCost(definition.buildCost)}</small>
          </button>
        `;
      }).join("")}
    </div>`
      : `
    <div class="theater-copy theater-copy--muted">
      Hardware purchasing and module installation stay on the Modules tab in Theater Command. This window is for live logic only.
    </div>`}
    <div class="theater-module-grid">
      ${selectedNodeModules.length > 0
        ? selectedNodeModules.map((moduleInstance) => renderModuleConfigCard(theater, moduleInstance)).join("")
        : `<div class="theater-feed-line">${includeInstallControls
          ? "No modules are installed on this node yet."
          : "No modules are installed on this node yet. Open the Modules tab to add hardware first."}</div>`}
    </div>
  `;
}

function renderSelectedRoomWindow(theater: TheaterNetworkState): string {
  const state = getGameState();
  const selectedNode = getSelectedNode(theater);
  const room = selectedNode?.rootRoom ?? getSelectedRoom(theater);
  const selectedSquad = getSelectedTheaterSquad(theater);
  const selectedSquadLabel = getSquadDisplayName(selectedSquad);
  const moveState = getNodeMoveButtonState(theater, selectedNode?.id ?? room.id);
  const status = selectedNode?.kind === "annex"
    ? (selectedNode.annex?.inheritedControl ? "ANNEX ONLINE" : "ANNEX LOST")
    : formatRoomStatus(theater, room);
  const contextLabel = getRoomContextLabel(room, theater);
  const hasDetailedIntel = hasDetailedRoomIntel(room);
  const route = findDisplayRoute(theater, room.id);
  const selectedNodeRoute = selectedNode
    ? findTheaterNodeRoute(
      theater,
      getDisplayCurrentNodeId(theater),
      selectedNode.id,
      { allowUnsecuredDestination: selectedNode.kind === "room" },
    )
    : null;
  const passagePowerRequirement = getVisiblePassagePowerRequirement(theater, room);
  const lockStatusLabel = getRoomLockStatusLabel(theater, room, hasDetailedIntel);
  const keyCacheLabel = getRoomKeyCacheLabel(room, hasDetailedIntel);
  const routeLabel = selectedNode?.kind === "annex"
    ? selectedNodeRoute && selectedNodeRoute.length > 1
      ? selectedNodeRoute.map((routeNodeId) => resolveTheaterNode(theater, routeNodeId)?.label ?? routeNodeId).join(" -> ")
      : selectedNodeRoute
        ? "Current Annex"
        : "No Secured Route"
    : route && route.length > 1
      ? hasDetailedIntel
        ? route.map((routeRoomId) => theater.rooms[routeRoomId]?.label ?? routeRoomId).join(" -> ")
        : `${Math.max(1, route.length - 1)} hop approach`
      : route
        ? "Current Room"
        : room.requiredKeyType && hasDetailedIntel
          ? `${formatTheaterKeyLabel(room.requiredKeyType)} Lock`
          : passagePowerRequirement
            ? `${passagePowerRequirement}W Gate`
            : "No Secured Route";
  const fortificationCapacity = room.fortificationCapacity ?? 3;
  const fortificationCount = getInstalledFortificationCount(room);
  const isTravelingToRoom = travelAnimation
    ? getTheaterRootRoomIdForNode(theater, travelAnimation.toNodeId) === room.id
    : false;
  const roomCoreAssignments = getTheaterRoomCoreAssignments(room);
  const primaryCoreAssignment = roomCoreAssignments[0] ?? null;
  const openCoreSlots = getTheaterRoomOpenCoreSlots(room);
  const coreStatusLabel = primaryCoreAssignment
    ? hasDetailedIntel
      ? `${formatCoreType(primaryCoreAssignment.type)}${roomCoreAssignments.length > 1 ? ` +${roomCoreAssignments.length - 1}` : ""}${isTheaterCoreOperational(room) ? " // Online" : " // Offline"}`
      : "Unresolved Signal"
    : hasDetailedIntel
      ? "Unassigned"
      : "Unknown";
  const coreOfflineReason = primaryCoreAssignment ? getTheaterCoreOfflineReason(room) : null;
  const coreSupportLabel = primaryCoreAssignment
    ? (isTheaterCoreOperational(room)
      ? "Facility online"
      : formatCoreOfflineReason(coreOfflineReason))
    : "No active facility";
  const travelLabel =
    isTravelingToRoom
      ? "Travel In Progress"
      : moveState.detail;
  const contextDetail = hasDetailedIntel ? contextLabel : (room.commsLinked ? "Tracked Contact" : "");
  const roomTagLabels = hasDetailedIntel ? getRoomTagLabels(room) : [];
  const fortificationLabel = hasDetailedIntel
    ? `${fortificationCount} / ${fortificationCapacity}`
    : "Unknown";
  const fortificationPipsLabel = hasDetailedIntel
    ? formatFortificationStateLabel(room)
    : "Unknown";
  const selectedSquadCommandLink = selectedSquad
    ? getTheaterSquadLinkSummary(state, selectedSquad.squadId)
    : "COMMAND LINK OPEN";
  const selectedSquadOwners = selectedSquad
    ? getTheaterSquadOwnerSummary(state, selectedSquad)
    : "UNASSIGNED";
  const supplyFlowLabel = hasDetailedIntel
    ? `${room.supplyFlow} Crates / Tick`
    : room.commsLinked ? "Trace Detected" : "No Read";
  const powerFlowLabel = hasDetailedIntel
    ? `${room.powerFlow} Watts / Tick`
    : room.commsLinked ? "Intermittent" : "No Read";
  const commsFlowLabel = hasDetailedIntel
    ? `${room.commsFlow} Bandwidth / Tick`
    : room.commsLinked ? "Linked" : "Unlinked";
  const thermalStateLabel = hasDetailedIntel
    ? ((room.sandboxBurning ?? false)
      ? `BURNING L${room.sandboxBurnSeverity ?? 1}`
      : room.sandboxOverheating
      ? `OVERHEATING L${room.sandboxOverheatSeverity ?? 1}`
      : (room.sandboxHeatValue ?? 0) > 0
        ? `HOT L${room.sandboxHeatValue}`
        : "Stable")
    : room.commsLinked ? "Intermittent" : "No Read";
  const routeTelemetryLabel = hasDetailedIntel
    ? (room.sandboxRouteNoise
      ? ((room.sandboxSignalBloom ?? false) ? "ROUTE INFO UNCERTAIN // BLOOM" : "ROUTE INFO UNCERTAIN")
      : "Stable")
    : room.commsLinked ? "Telemetry Partial" : "No Read";
  const commsAttractionLabel = hasDetailedIntel
    ? ((room.sandboxCommsAttraction ?? 0) > 0 ? `+${room.sandboxCommsAttraction} PRESSURE` : "Nominal")
    : room.commsLinked ? "Tracked" : "No Read";
  const migrationAnchorLabel = hasDetailedIntel
    ? (room.sandboxMigrationAnchorRoomId ? (theater.rooms[room.sandboxMigrationAnchorRoomId]?.label ?? room.sandboxMigrationAnchorRoomId) : "None")
    : room.commsLinked ? "Trace Only" : "No Read";
  const airQualityLabel = hasDetailedIntel
    ? ((room.sandboxBurning ?? false)
      ? `FIRE // SMOKE L${room.sandboxSmokeValue ?? room.sandboxBurnSeverity ?? 1}`
      : (room.sandboxSmokeValue ?? 0) > 0
        ? `SMOKE L${room.sandboxSmokeValue}`
        : "Clear")
    : room.commsLinked ? "Trace Only" : "No Read";
  const scavengerActivityLabel = hasDetailedIntel
    ? ((room.sandboxScavengerActivity ?? "quiet") === "raiding"
      ? "Raiding"
      : (room.sandboxScavengerActivity ?? "quiet") === "probing"
        ? "Probing"
        : "Quiet")
    : room.commsLinked ? "Trace Only" : "No Read";
  const signalPostureLabel = selectedNode?.kind === "annex"
    ? "Inherited"
    : getSignalPostureLabel(room.sandboxSignalPosture ?? "normal");
  const containmentLabel = selectedNode?.kind === "annex"
    ? "Inherited"
    : hasDetailedIntel
      ? `${getContainmentModeLabel(room.sandboxContainmentMode ?? "normal")}${(room.sandboxEmergencyDumpTicks ?? 0) > 0 ? ` // Dump ${room.sandboxEmergencyDumpTicks}` : ""}`
      : room.commsLinked ? "Trace Only" : "No Read";
  const structuralStressLabel = hasDetailedIntel
    ? ((room.sandboxStructuralStress ?? 0) > 0 ? `L${room.sandboxStructuralStress}` : "Stable")
    : room.commsLinked ? "Trace Only" : "No Read";
  const selectedNodeModuleIds = selectedNode
    ? (selectedNode.kind === "room" ? (selectedNode.room?.moduleSlots ?? []) : (selectedNode.annex?.moduleSlots ?? []))
        .filter((moduleId): moduleId is string => Boolean(moduleId))
    : [];
  const selectedNodeModules = selectedNodeModuleIds
    .map((moduleId) => theater.automation?.moduleInstancesById?.[moduleId] ?? null)
    .filter((module): module is ModuleInstance => Boolean(module));
  const childAnnexes = selectedNode
    ? Object.values(theater.annexesById ?? {}).filter((annex) => annex.parentNodeId === selectedNode.id)
    : [];
  const annexUnlocked = (theater.definition.floorOrdinal ?? 0) >= 9;
  const adjacentNodeIds = selectedNode ? getTheaterNodeAdjacency(theater, selectedNode.id) : [];
  const partitionRows = selectedNode
    ? adjacentNodeIds.map((adjacentNodeId) => {
        const adjacentNode = resolveTheaterNode(theater, adjacentNodeId);
        const edgeId = getTheaterEdgeId(selectedNode.id, adjacentNodeId);
        return {
          adjacentNode,
          edgeId,
          partition: theater.partitionsByEdgeId?.[edgeId] ?? null,
        };
      }).filter((entry) => entry.adjacentNode)
    : [];
  const tabControls = renderSelectedNodeTabControls();

  const orderedCoreTypes = orderItemsUnlockedFirst(
    getOrderedSchemaCoreTypes(),
    (coreType) => isCoreTypeUnlocked(state, coreType),
  );
  const orderedFortificationTypes = orderItemsUnlockedFirst(
    getOrderedSchemaFortificationTypes(),
    (fortificationType) => isFortificationUnlocked(state, fortificationType),
  );

  const coreButtons = orderedCoreTypes
    .map((coreType) => {
      const blueprint = THEATER_CORE_BLUEPRINTS[coreType];
      const locked = !isCoreTypeUnlocked(state, coreType);
      const incomeLabel = formatCorePreviewIncome(room, coreType);
      const unlockCost = [
        blueprint.unlockWadCost ? `${blueprint.unlockWadCost} Wad` : null,
        formatResourceCost(blueprint.unlockCost ?? {}) !== "0" ? formatResourceCost(blueprint.unlockCost ?? {}) : null,
      ].filter(Boolean).join(" // ");
      return `
        <button
          class="theater-action-btn ${locked ? "theater-action-btn--locked" : ""}"
          type="button"
          data-theater-core="${coreType}"
          ${travelAnimation || !room.secured || openCoreSlots <= 0 || locked || selectedNode?.kind === "annex" ? "disabled" : ""}
        >
          ${locked ? "Locked" : "Build"} ${blueprint.displayName}
          <small>${blueprint.description}</small>
          <small>Build Cost: ${formatResourceCost(blueprint.buildCost)} // Wad Upkeep Per Tick: ${blueprint.wadUpkeepPerTick} Wad${incomeLabel !== "No resource output" ? ` // Income Per Tick: ${incomeLabel}` : ""}</small>
          ${renderCoreRequirementPreview(coreType)}
          ${locked ? `<small>Unlock In S.C.H.E.M.A.: ${unlockCost || "Authorization required"}</small>` : blueprint.placeholder ? `<small>Placeholder facility effect // buildable runtime stub</small>` : ""}
        </button>
      `;
    })
    .join("");
  const fortificationButtons = orderedFortificationTypes
    .map((fortificationType) => {
      const definition = SCHEMA_FORTIFICATION_DEFINITIONS[fortificationType];
      const locked = !isFortificationUnlocked(state, fortificationType);
      const installedCount = room.fortificationPips[fortificationType];
      const unlockCost = [
        definition.unlockWadCost ? `${definition.unlockWadCost} Wad` : null,
        formatResourceCost(definition.unlockCost ?? {}) !== "0" ? formatResourceCost(definition.unlockCost ?? {}) : null,
      ].filter(Boolean).join(" // ");

      return `
        <button class="theater-action-btn ${locked ? "theater-action-btn--locked" : ""}" type="button" data-theater-fortify="${fortificationType}" ${travelAnimation || !room.secured || fortificationCount >= fortificationCapacity || locked || selectedNode?.kind === "annex" ? "disabled" : ""}>
          ${locked ? "Locked" : "Install"} ${definition.displayName}${installedCount > 0 ? ` x${installedCount}` : ""}
          <small>Build Cost: ${formatResourceCost(getFortificationCost(fortificationType))}</small>
          <small>${definition.description}</small>
          ${locked ? `<small>Unlock In S.C.H.E.M.A.: ${unlockCost || "Authorization required"}</small>` : definition.placeholder ? `<small>Placeholder fortification effect // occupies one slot</small>` : ""}
        </button>
      `;
    })
    .join("");
  const tacticalMap = getTheaterRoomTacticalMap(room);
  const selectedTacticalTile = getSelectedTheaterTacticalTile(tacticalMap);
  const selectedTacticalObject = selectedTacticalTile && tacticalMap
    ? tacticalMap.objects.find((objectDef) => objectDef.x === selectedTacticalTile.x && objectDef.y === selectedTacticalTile.y) ?? null
    : null;
  const installedFieldAssets = room.placedFieldAssets ?? [];
  const selectedInstalledFieldAsset = selectedTacticalTile
    ? installedFieldAssets.find((asset) => asset.x === selectedTacticalTile.x && asset.y === selectedTacticalTile.y) ?? null
    : null;
  const orderedFieldAssetTypes = orderItemsUnlockedFirst(
    getOrderedSchemaFieldAssetTypes(),
    (fieldAssetType) => isFieldAssetUnlocked(state, fieldAssetType),
  );
  const fieldAssetButtons = orderedFieldAssetTypes
    .map((fieldAssetType) => {
      const definition = SCHEMA_FIELD_ASSET_DEFINITIONS[fieldAssetType];
      if (!definition) {
        return "";
      }
      const unlocked = isFieldAssetUnlocked(state, fieldAssetType);
      return `
        <button
          class="theater-chip-button ${theaterSelectedFieldAssetType === fieldAssetType ? "theater-chip-button--active" : ""} ${unlocked ? "" : "theater-chip-button--locked"}"
          type="button"
          data-theater-field-asset-select="${fieldAssetType}"
        >
          ${definition.displayName}
          <small>${formatResourceCost(getFieldAssetBuildCost(fieldAssetType))}</small>
          <small>${unlocked ? definition.tacticalRole : "Authorize in S.C.H.E.M.A."}</small>
        </button>
      `;
    })
    .join("");
  const activeFieldAssetDefinition = SCHEMA_FIELD_ASSET_DEFINITIONS[theaterSelectedFieldAssetType] ?? null;
  const activeFieldAssetUnlocked = activeFieldAssetDefinition ? isFieldAssetUnlocked(state, theaterSelectedFieldAssetType) : false;
  const activeFieldAssetCost = activeFieldAssetDefinition ? getFieldAssetBuildCost(theaterSelectedFieldAssetType) : {};
  const activeFieldAssetPlacementError = activeFieldAssetDefinition && selectedTacticalTile
    ? getFieldAssetPlacementError(room, theaterSelectedFieldAssetType, selectedTacticalTile.x, selectedTacticalTile.y)
    : null;
  const canAffordActiveFieldAsset = activeFieldAssetDefinition
    ? canAffordTheaterCost(state, activeFieldAssetCost)
    : false;
  const isTacticalFullscreenMode = theaterTacticalFullscreenActive && corePanelTab === "tactical";
  const fabricateBlockedReason = selectedNode?.kind === "annex"
    ? `Select ${room.label} itself to fabricate field assets.`
    : !room.secured
      ? "Secure the room before fabricating field assets."
      : !activeFieldAssetDefinition
        ? "Select a field asset first."
        : !selectedTacticalTile
          ? "Select a playable tile first."
          : !activeFieldAssetUnlocked
            ? `${activeFieldAssetDefinition.displayName} is still locked in S.C.H.E.M.A.`
            : !canAffordActiveFieldAsset
              ? `Insufficient resources. Required: ${formatResourceCost(activeFieldAssetCost)}.`
              : activeFieldAssetPlacementError;
  const canFabricateFieldAssets = !fabricateBlockedReason;
  const tacticalBody = `
    <div class="theater-tactical-panel ${isTacticalFullscreenMode ? "theater-tactical-panel--fullscreen" : ""}">
    ${tabControls}
    <div class="theater-copy">
      Inspect the persistent battle layout assigned to this room and fabricate field assets directly onto legal tiles before combat begins.
    </div>
    <div class="theater-info-grid theater-info-grid--two">
      <div class="theater-stat-card"><span>Assigned Map</span><strong>${tacticalMap?.name ?? getTheaterRoomBattleMapId(room)}</strong></div>
      <div class="theater-stat-card"><span>Theme</span><strong>${tacticalMap ? tacticalMap.theme.replace(/_/g, " ").toUpperCase() : "UNASSIGNED"}</strong></div>
      <div class="theater-stat-card"><span>Footprint</span><strong>${tacticalMap ? `${tacticalMap.tiles.length} tiles` : "0"}</strong></div>
      <div class="theater-stat-card"><span>Field Assets</span><strong>${installedFieldAssets.length}</strong></div>
      <div class="theater-stat-card"><span>Preview Zoom</span><strong>${Math.round(theaterTacticalPreviewZoom * 100)}%</strong></div>
      <div class="theater-stat-card"><span>Selected Tile</span><strong>${selectedTacticalTile ? `${selectedTacticalTile.x},${selectedTacticalTile.y}` : "NONE"}</strong></div>
    </div>
    ${selectedNode?.kind === "annex" ? `
      <div class="theater-copy theater-copy--muted">
        Tactical fabrication is managed from the parent room. Select ${room.label} itself to place or remove field assets.
      </div>
    ` : !room.secured ? `
      <div class="theater-copy theater-copy--muted">
        This room can be inspected now, but fabrication stays offline until the room is secured.
      </div>
    ` : ""}
    <div class="theater-inline-actions">
      <button class="theater-secondary-btn" type="button" data-theater-tactical-zoom="-1">Zoom Out</button>
      <button class="theater-secondary-btn" type="button" data-theater-tactical-zoom="1">Zoom In</button>
      <button class="theater-secondary-btn" type="button" data-theater-tactical-fullscreen="${theaterTacticalFullscreenActive ? "off" : "on"}">${theaterTacticalFullscreenActive ? "Exit Full Screen" : "Full Screen"}</button>
    </div>
    <div class="theater-tactical-map-region">
      ${tacticalMap ? renderTheaterTacticalMapGrid(tacticalMap, installedFieldAssets) : `<div class="theater-feed-line">No tactical map catalog entry is assigned to this room yet.</div>`}
    </div>
    <div class="theater-copy theater-copy--muted">
      ${selectedTacticalObject
        ? `Tile Occupant: ${selectedTacticalObject.id} // ${getTacticalObjectLabel(selectedTacticalObject.type)}`
        : selectedInstalledFieldAsset
          ? `Field Asset: ${selectedInstalledFieldAsset.id} // ${SCHEMA_FIELD_ASSET_DEFINITIONS[selectedInstalledFieldAsset.type]?.displayName ?? selectedInstalledFieldAsset.type}`
        : selectedTacticalTile
          ? "Open tile selected."
          : "Select a playable tile to inspect or place assets."}
    </div>
    <div class="theater-annex-build-grid">
      ${fieldAssetButtons}
    </div>
    ${activeFieldAssetDefinition ? `
      <div class="theater-copy theater-copy--muted">
        Selected Asset: ${activeFieldAssetDefinition.displayName} // ${activeFieldAssetDefinition.description}
      </div>
    ` : ""}
    <div class="theater-copy theater-copy--muted">
      ${fabricateBlockedReason ?? (selectedTacticalTile
        ? `Ready to fabricate on tile ${selectedTacticalTile.x},${selectedTacticalTile.y}.`
        : "Select a playable tile to prepare this room.")}
    </div>
    <div class="theater-inline-actions">
      <button
        class="theater-action-btn ${!canFabricateFieldAssets && activeFieldAssetDefinition && !activeFieldAssetUnlocked ? "theater-action-btn--locked" : ""}"
        type="button"
        data-theater-place-field-asset="${room.id}"
        ${canFabricateFieldAssets ? "" : "disabled"}
      >
        Fabricate ${activeFieldAssetDefinition?.displayName ?? "Field Asset"}
        <small>${fabricateBlockedReason ?? (activeFieldAssetDefinition ? formatResourceCost(activeFieldAssetCost) : "No asset selected")}</small>
      </button>
      ${selectedInstalledFieldAsset ? `
        <button
          class="theater-action-btn theater-action-btn--danger"
          type="button"
          data-theater-remove-field-asset="${selectedInstalledFieldAsset.id}"
          data-theater-remove-field-asset-room="${room.id}"
        >
          Remove Asset
          <small>Clear the placed field asset from this room. No materials are returned.</small>
        </button>
      ` : ""}
    </div>
    <div class="theater-core-list">
      ${installedFieldAssets.length > 0 ? installedFieldAssets.map((asset) => {
        const definition = SCHEMA_FIELD_ASSET_DEFINITIONS[asset.type];
        return `
          <button
            class="theater-action-btn theater-action-btn--danger"
            type="button"
            data-theater-remove-field-asset="${asset.id}"
            data-theater-remove-field-asset-room="${room.id}"
          >
            ${definition?.displayName ?? asset.type} // ${asset.x},${asset.y}
            <small>${definition?.tacticalRole ?? "Prepared field asset"}.</small>
          </button>
        `;
      }).join("") : `<div class="theater-feed-line">No field assets are currently fabricated in this room.</div>`}
    </div>
    </div>
  `;

  const roomInfoBody = `
    ${tabControls}
    <div class="theater-room-head">
      <div>
        <div class="theater-room-title">${selectedNode?.kind === "annex" ? selectedNode.label : getRoomDisplayLabel(room)}</div>
        <div class="theater-room-subtitle">${selectedNode?.id ?? room.id} // ${selectedNode?.kind === "annex" ? `${room.label} SUPPORT NODE` : (hasDetailedIntel ? room.sectorTag : "UNK")}${contextDetail ? ` // ${contextDetail}` : ""}</div>
      </div>
      <div class="theater-status-pill">${status}</div>
    </div>
    <div class="theater-info-grid">
      <div class="theater-stat-card"><span>Travel State</span><strong>${isTravelingToRoom ? travelLabel : moveState.detail}</strong></div>
      <div class="theater-stat-card"><span>Node Type</span><strong>${selectedNode?.kind === "annex" ? "ANNEX" : "ROOM"}</strong></div>
      <div class="theater-stat-card"><span>Parent Room</span><strong>${room.label}</strong></div>
      <div class="theater-stat-card"><span>C.O.R.E. Assignment</span><strong>${selectedNode?.kind === "annex" ? "Unavailable" : coreStatusLabel}</strong></div>
      <div class="theater-stat-card"><span>C.O.R.E. Slots</span><strong>${selectedNode?.kind === "annex" ? "Unavailable" : `${roomCoreAssignments.length} / ${Math.max(1, room.coreSlotCapacity ?? 1)}`}</strong></div>
      <div class="theater-stat-card"><span>Fortification Slots</span><strong>${selectedNode?.kind === "annex" ? "Unavailable" : fortificationLabel}</strong></div>
      <div class="theater-stat-card"><span>Fortification State</span><strong>${selectedNode?.kind === "annex" ? "Unavailable" : fortificationPipsLabel}</strong></div>
      <div class="theater-stat-card"><span>Lock Status</span><strong>${lockStatusLabel}</strong></div>
      <div class="theater-stat-card"><span>Key Cache</span><strong>${keyCacheLabel}</strong></div>
      <div class="theater-stat-card"><span>Facility State</span><strong>${selectedNode?.kind === "annex" ? "Inherited support only" : coreSupportLabel}</strong></div>
      <div class="theater-stat-card"><span>Supply Flow</span><strong>${selectedNode?.kind === "annex" ? `${selectedNode.annex?.inheritedSupply ?? 0} Crates` : supplyFlowLabel}</strong></div>
      <div class="theater-stat-card"><span>Power Flow</span><strong>${selectedNode?.kind === "annex" ? `${selectedNode.annex?.inheritedPower ?? 0} Watts` : powerFlowLabel}</strong></div>
      <div class="theater-stat-card"><span>Comms Flow</span><strong>${selectedNode?.kind === "annex" ? `${selectedNode.annex?.inheritedComms ?? 0} BW` : commsFlowLabel}</strong></div>
      <div class="theater-stat-card"><span>Thermal State</span><strong>${thermalStateLabel}</strong></div>
      <div class="theater-stat-card"><span>Air Quality</span><strong>${airQualityLabel}</strong></div>
      <div class="theater-stat-card"><span>Route Telemetry</span><strong>${routeTelemetryLabel}</strong></div>
      <div class="theater-stat-card"><span>Enemy Attraction</span><strong>${commsAttractionLabel}</strong></div>
      <div class="theater-stat-card"><span>Scavenger Activity</span><strong>${scavengerActivityLabel}</strong></div>
      <div class="theater-stat-card"><span>Signal Posture</span><strong>${signalPostureLabel}</strong></div>
      <div class="theater-stat-card"><span>Containment</span><strong>${containmentLabel}</strong></div>
      <div class="theater-stat-card"><span>Structural Stress</span><strong>${structuralStressLabel}</strong></div>
      <div class="theater-stat-card"><span>Collapse Anchor</span><strong>${migrationAnchorLabel}</strong></div>
      <div class="theater-stat-card"><span>Intel</span><strong>${hasDetailedIntel ? "Detailed" : room.intelLevel > 0 ? "Partial" : "Dark"}</strong></div>
      <div class="theater-stat-card"><span>Module Slots</span><strong>${selectedNode?.kind === "annex" ? `${selectedNode.annex?.moduleSlots.filter((slot) => slot !== null).length ?? 0} / ${selectedNode.annex?.moduleSlotCapacity ?? 0}` : `${selectedNodeModules.length} / ${room.moduleSlotCapacity ?? 0}`}</strong></div>
      <div class="theater-stat-card"><span>Selected Squad</span><strong>${selectedSquadLabel} // ${selectedSquad?.unitIds.length ?? 0} UNIT(S)</strong></div>
      <div class="theater-stat-card"><span>Squad Contact</span><strong>${selectedSquad ? `${selectedSquad.bwAvailable}/${selectedSquad.bwRequired} BW // ${selectedSquad.isInContact ? "IN CONTACT" : "COMMS OFFLINE"}` : "NO ACTIVE SQUAD"}</strong></div>
      <div class="theater-stat-card"><span>Command Link</span><strong>${selectedSquadCommandLink}</strong></div>
      <div class="theater-stat-card"><span>Unit Ownership</span><strong>${selectedSquadOwners}</strong></div>
      ${selectedNode?.kind === "annex" ? `<div class="theater-stat-card"><span>Integrity</span><strong>${selectedNode.annex?.integrity ?? 0}</strong></div>` : ""}
      ${selectedNode?.kind === "annex" ? `<div class="theater-stat-card"><span>Frame</span><strong>${ANNEX_FRAME_DEFINITIONS[selectedNode.annex!.frameType].displayName}</strong></div>` : ""}
    </div>
    <div class="theater-copy theater-copy--muted">
      Route: ${routeLabel}. ${selectedNode?.kind === "annex"
        ? "Annexes inherit room logistics and can host automation hardware, but they cannot host C.O.R.E. facilities or fortification pips."
        : room.requiredKeyType && !hasTheaterKey(theater, room.requiredKeyType) && hasDetailedIntel
          ? `Recover the ${formatTheaterKeyLabel(room.requiredKeyType)} elsewhere on this floor before forcing this branch.`
          : hasDetailedIntel
            ? "Select a room or annex on the map and use the room command button to advance."
            : "Advance closer or maintain comms to resolve full room telemetry."}
    </div>
    ${selectedNode?.kind === "annex" ? `
      <button class="theater-action-btn theater-action-btn--danger" type="button" data-theater-annex-destroy="${selectedNode.id}">
        Destroy Annex
        <small>Dismantle this annex and any child annexes. No materials are returned.</small>
      </button>
    ` : ""}
    ${hasDetailedIntel && selectedNode?.kind !== "annex" ? `
      <div class="theater-copy theater-copy--muted">
        Room Tags: ${roomTagLabels.length > 0 ? roomTagLabels.join(" // ") : "No notable environmental tags"}.
      </div>
    ` : ""}
    ${primaryCoreAssignment && (coreOfflineReason === "low_power" || coreOfflineReason === "low_comms") && hasDetailedIntel && selectedNode?.kind !== "annex" ? `
      <div class="theater-copy theater-copy--muted">
        Warning: ${formatCoreType(primaryCoreAssignment.type)} is offline in ${room.label} because the room is not meeting its operational requirements.
      </div>
    ` : ""}
    ${room.sandboxRouteNoise && hasDetailedIntel ? `
      <div class="theater-copy theater-copy--muted">
        Route telemetry is uncertain here because excess power or signal bloom is corrupting local telemetry. Phantom path markers may appear on the theater map.
      </div>
    ` : ""}
    ${(room.sandboxCommsAttraction ?? 0) > 0 && hasDetailedIntel ? `
      <div class="theater-copy theater-copy--muted">
        Comms output in ${room.label} is above 500 BW and is increasing hostile attraction pressure.
      </div>
    ` : ""}
    ${(room.sandboxSmokeValue ?? 0) > 0 && hasDetailedIntel ? `
      <div class="theater-copy theater-copy--muted">
        Smoke is pooling in ${room.label}. Open passages vent it, while closed Blast Doors contain it. Tactical battles here begin with reduced movement and suppressed ranged fire.
      </div>
    ` : ""}
    ${(room.sandboxSupplyFireRisk ?? false) && hasDetailedIntel ? `
      <div class="theater-copy theater-copy--muted">
        Heat and dense supply load are pushing ${room.label} toward ignition. Smoke and combat instability will intensify if the room stays hot.
      </div>
    ` : ""}
    ${(room.sandboxBurning ?? false) && hasDetailedIntel ? `
      <div class="theater-copy theater-copy--muted">
        ${room.label} is actively burning. Every turn spent fighting here exposes units to ambient thermal damage, and nearby annexes will start taking integrity loss if the fire keeps building.
      </div>
    ` : ""}
    ${selectedNode?.kind !== "annex" && hasDetailedIntel && ((room.sandboxContainmentMode ?? "normal") !== "normal" || (room.sandboxEmergencyDumpTicks ?? 0) > 0) ? `
      <div class="theater-copy theater-copy--muted">
        ${(room.sandboxContainmentMode ?? "normal") === "venting"
          ? `${room.label} is venting heat through open passages.`
          : (room.sandboxContainmentMode ?? "normal") === "lockdown"
            ? `${room.label} is sealed under lockdown. Blast doors are closing to contain the branch.`
            : `${room.label} is holding normal containment flow.`}
        ${(room.sandboxEmergencyDumpTicks ?? 0) > 0 ? ` Emergency dump remains active for ${room.sandboxEmergencyDumpTicks} more tick(s), temporarily reducing volatile supply load.` : ""}
      </div>
    ` : ""}
    ${(room.sandboxStructuralStress ?? 0) >= 3 && hasDetailedIntel ? `
      <div class="theater-copy theater-copy--muted">
        Structural stress is building in ${room.label}. Repeated fires will damage the room shell and start stripping integrity from attached annexes.
      </div>
    ` : ""}
    ${(room.sandboxScavengerActivity ?? "quiet") !== "quiet" && hasDetailedIntel ? `
      <div class="theater-copy theater-copy--muted">
        Scavenger bands are ${room.sandboxScavengerActivity === "raiding" ? "actively raiding" : "probing"} ${room.label}. Unguarded rooms with rich supply flow are easier for them to skim.
      </div>
    ` : ""}
    ${selectedNode?.kind !== "annex" && room.secured && (room.sandboxSignalPosture ?? "normal") !== "normal" ? `
      <div class="theater-copy theater-copy--muted">
        ${room.sandboxSignalPosture === "masked"
          ? `${room.label} is running masked signature discipline. Hostile attraction falls, but enemy telemetry quality also drops.`
          : `${room.label} is broadcasting bait signatures. Hostile attraction rises and false route confidence bleeds across the theater.`}
      </div>
    ` : ""}
    ${selectedNode?.kind !== "annex" && room.secured ? `
      <div class="theater-inline-actions">
        ${(["normal", "masked", "bait"] as TheaterSignalPosture[]).map((posture) => `
          <button
            class="theater-chip-button ${(room.sandboxSignalPosture ?? "normal") === posture ? "theater-chip-button--active" : ""}"
            type="button"
            data-theater-room-posture="${room.id}"
            data-theater-room-posture-mode="${posture}"
          >
            ${posture === "normal" ? "Normal Signal" : posture === "masked" ? "Mask Signal" : "Bait Signal"}
            <small>${posture === "normal" ? "Balanced routing and telemetry." : posture === "masked" ? "Lower signature, weaker enemy dossiers." : "Higher lure, more false intel bleed."}</small>
          </button>
        `).join("")}
      </div>
    ` : ""}
    ${selectedNode?.kind !== "annex" && room.secured ? `
      <div class="theater-inline-actions">
        ${(["normal", "venting", "lockdown"] as TheaterContainmentMode[]).map((mode) => `
          <button
            class="theater-chip-button ${(room.sandboxContainmentMode ?? "normal") === mode ? "theater-chip-button--active" : ""}"
            type="button"
            data-theater-room-containment="${room.id}"
            data-theater-room-containment-mode="${mode}"
          >
            ${mode === "normal" ? "Normal Flow" : mode === "venting" ? "Vent Room" : "Lock Down"}
            <small>${mode === "normal" ? "No forced airflow or seal state." : mode === "venting" ? "Bleed heat and smoke faster. Adjacent blast doors open." : "Seal blast doors and contain spread."}</small>
          </button>
        `).join("")}
      </div>
      <div class="theater-inline-actions">
        <button class="theater-action-btn ${((room.sandboxEmergencyDumpTicks ?? 0) > 0 || !room.secured) ? "theater-action-btn--locked" : ""}" type="button" data-theater-room-dump="${room.id}" ${((room.sandboxEmergencyDumpTicks ?? 0) > 0 || !room.secured) ? "disabled" : ""}>
          Emergency Dump
          <small>${(room.sandboxEmergencyDumpTicks ?? 0) > 0 ? `Dump active for ${room.sandboxEmergencyDumpTicks} more tick(s).` : "Dump volatile stores to suppress fire risk for a short window."}</small>
        </button>
      </div>
    ` : ""}
    ${selectedNode?.kind !== "annex" && room.secured && (room.underThreat || room.damaged) ? `
      <button class="theater-action-btn theater-action-btn--danger" type="button" data-theater-refuse-defense="${room.id}">
        Refuse Defense
        <small>Accept territorial loss. Barricades are destroyed first; continued neglect can cost the room and its facilities.</small>
      </button>
    ` : ""}
  `;

  const annexesBody = `
    ${tabControls}
    <div class="theater-copy">
      Build support annexes directly off secured rooms or existing annexes. Annexes inherit power, supply, comms, and control from their parent chain.
    </div>
    ${annexUnlocked ? "" : `
      <div class="theater-copy theater-copy--muted">
        Annex construction unlocks on Floor 09. This floor cannot authorize new annex frames yet.
      </div>
    `}
    <div class="theater-info-grid theater-info-grid--two">
      <div class="theater-stat-card"><span>Selected Node</span><strong>${selectedNode?.label ?? room.label}</strong></div>
      <div class="theater-stat-card"><span>Child Annexes</span><strong>${childAnnexes.length}</strong></div>
    </div>
    <div class="theater-annex-build-grid">
      ${(["north", "east", "south", "west"] as AnnexAttachmentEdge[]).map((edge) => `
        <div class="theater-annex-build-row">
          <div class="theater-annex-build-row__edge">${edge.toUpperCase()}</div>
          ${(["lightweight_annex", "standard_annex", "heavy_annex"] as AnnexFrameType[]).map((frameType) => `
            <button
              class="theater-chip-button"
              type="button"
              data-theater-annex-build="${selectedNode?.id ?? room.id}"
              data-theater-annex-frame="${frameType}"
              data-theater-annex-edge="${edge}"
              ${!annexUnlocked || !selectedNode || !isTheaterNodeSecured(theater, selectedNode.id) ? "disabled" : ""}
            >
              ${ANNEX_FRAME_DEFINITIONS[frameType].displayName}
              <small>${formatResourceCost(ANNEX_FRAME_DEFINITIONS[frameType].buildCost)}</small>
            </button>
          `).join("")}
        </div>
      `).join("")}
    </div>
    <div class="theater-core-list">
      ${childAnnexes.length > 0 ? childAnnexes.map((annex) => `
        <div class="theater-inline-actions">
          <button class="theater-action-btn" type="button" data-theater-select-node="${annex.annexId}">
            ${ANNEX_FRAME_DEFINITIONS[annex.frameType].displayName}
            <small>${annex.annexId} // ${annex.moduleSlots.filter((slot) => slot !== null).length}/${annex.moduleSlotCapacity} modules // ${annex.integrity} integrity</small>
          </button>
          <button class="theater-secondary-btn theater-secondary-btn--danger" type="button" data-theater-annex-destroy="${annex.annexId}">
            Destroy
          </button>
        </div>
      `).join("") : `<div class="theater-feed-line">No child annexes are attached to this node yet.</div>`}
    </div>
  `;

  const modulesBody = renderModuleLogicBody(theater, {
    includeTabControls: true,
    includePopoutButton: true,
    includeInstallControls: true,
  });

  const partitionsBody = `
    ${tabControls}
    <div class="theater-copy">
      Install Blast Doors on node connections, then open, close, or automate them through Door Controller modules.
    </div>
    <div class="theater-partition-list">
      ${partitionRows.length > 0 ? partitionRows.map(({ adjacentNode, edgeId, partition }) => `
        <article class="theater-module-card">
          <div class="theater-module-card__header">
            <div>
              <div class="theater-module-card__kicker">EDGE</div>
              <h4 class="theater-module-card__title">${selectedNode?.label ?? room.label} <-> ${adjacentNode?.label ?? edgeId}</h4>
            </div>
            <div class="theater-module-card__signal">${partition ? partition.state.toUpperCase() : "OPEN"}</div>
          </div>
          <div class="theater-module-card__meta">
            <span>${edgeId}</span>
          </div>
          <div class="theater-inline-actions">
            <button class="theater-secondary-btn" type="button" data-theater-select-edge="${edgeId}">Select Edge</button>
            ${partition ? `
              <button class="theater-secondary-btn" type="button" data-theater-toggle-partition="${edgeId}">
                ${partition.state === "open" ? "Close Blast Door" : "Open Blast Door"}
              </button>
            ` : `
              <button
                class="theater-secondary-btn"
                type="button"
                data-theater-install-partition-node-a="${selectedNode?.id ?? room.id}"
                data-theater-install-partition-node-b="${adjacentNode?.id ?? ""}"
                data-theater-partition-type="blast_door"
                ${isPartitionTypeUnlocked(state, "blast_door") ? "" : "disabled"}
              >
                Install Blast Door // ${formatResourceCost(FOUNDRY_PARTITION_DEFINITIONS.blast_door.buildCost)}
              </button>
            `}
          </div>
        </article>
      `).join("") : `<div class="theater-feed-line">No traversable connections are available from this node.</div>`}
    </div>
  `;

  const facilityLockedBody = `
    ${tabControls}
    <div class="theater-copy">
      Secure the selected room before issuing C.O.R.E. construction or fortification orders here.
    </div>
    <div class="theater-copy theater-copy--muted">
      ${selectedNode?.kind === "annex" ? `${selectedNode.label} is a support node and cannot host C.O.R.E.s or fortification pips.` : `${getRoomDisplayLabel(room)} is not secured yet. Move in, clear the room, then return here to build facilities or install fortifications.`}
    </div>
  `;

  const coreBody = `
    ${tabControls}
    <div class="theater-copy">
      Convert this secured room into a C.O.R.E. facility. Fortifications are available in the adjacent tab.
    </div>
    <div class="theater-copy theater-copy--muted">
      Current Assignment: ${roomCoreAssignments.length > 0 ? roomCoreAssignments.map((assignment, index) => `Slot ${index + 1}: ${formatCoreType(assignment.type)}`).join(" // ") : "Unassigned"} // ${roomCoreAssignments.length}/${Math.max(1, room.coreSlotCapacity ?? 1)} slots occupied
    </div>
    ${roomCoreAssignments.length > 0 ? `
      <div class="theater-core-list">
        ${roomCoreAssignments.map((assignment, index) => `
          <button class="theater-action-btn theater-action-btn--danger" type="button" data-theater-core-destroy="${room.id}" data-theater-core-slot="${index}">
            Destroy ${formatCoreType(assignment.type)}
            <small>Remove this C.O.R.E. slot assignment. No materials are returned.</small>
          </button>
        `).join("")}
      </div>
    ` : ""}
    <div class="theater-core-list">
      ${coreButtons}
    </div>
  `;

  const fortificationBody = `
    ${tabControls}
    <div class="theater-copy">
      Install fortifications after a room is secured. Any combination is allowed until the room's Fortification Slots are full.
    </div>
    <div class="theater-info-grid theater-info-grid--two">
      <div class="theater-stat-card"><span>Fortification Slots</span><strong>${fortificationCount} / ${fortificationCapacity}</strong></div>
      <div class="theater-stat-card"><span>Installed</span><strong>${fortificationPipsLabel}</strong></div>
    </div>
    ${getOrderedSchemaFortificationTypes()
      .filter((fortificationType) => room.fortificationPips[fortificationType] > 0)
      .map((fortificationType) => `
        <button
          class="theater-action-btn theater-action-btn--danger"
          type="button"
          data-theater-fortification-destroy="${room.id}"
          data-theater-fortification-type="${fortificationType}"
        >
          Destroy ${SCHEMA_FORTIFICATION_DEFINITIONS[fortificationType].displayName}
          <small>Remove one installed ${SCHEMA_FORTIFICATION_DEFINITIONS[fortificationType].displayName.toLowerCase()}. No materials are returned.</small>
        </button>
      `).join("")}
    ${fortificationButtons}
  `;

  const body = corePanelTab === "annexes"
    ? annexesBody
    : corePanelTab === "modules"
      ? modulesBody
      : corePanelTab === "partitions"
        ? partitionsBody
        : selectedNode?.kind === "annex"
          ? (corePanelTab === "tactical" ? tacticalBody : (corePanelTab === "room" ? roomInfoBody : facilityLockedBody))
          : !room.secured
            ? (corePanelTab === "tactical" ? tacticalBody : (corePanelTab === "room" ? roomInfoBody : facilityLockedBody))
            : corePanelTab === "core"
              ? coreBody
              : corePanelTab === "fortifications"
                ? fortificationBody
                : corePanelTab === "tactical"
                  ? tacticalBody
                  : roomInfoBody;

  return renderWindowShell(
    "room",
    selectedNode?.kind === "annex" ? "SELECTED ANNEX" : THEATER_WINDOW_DEFS.room.title,
    `${THEATER_WINDOW_DEFS.room.kicker} // ${status.toUpperCase()}`,
    body,
    theater,
    isTacticalFullscreenMode
      ? {
          className: "theater-window--tactical-fullscreen",
          bodyClassName: "theater-window-body--tactical-fullscreen",
        }
      : {},
  );
}

function renderAutomationWindow(theater: TheaterNetworkState): string {
  const selectedNode = getSelectedNode(theater);
  const room = selectedNode?.rootRoom ?? getSelectedRoom(theater);
  const subtitle = `${THEATER_WINDOW_DEFS.automation.kicker} // ${(selectedNode?.label ?? room.label).toUpperCase()}`;
  return renderWindowShell(
    "automation",
    THEATER_WINDOW_DEFS.automation.title,
    subtitle,
    renderModuleLogicBody(theater, {
      includeTabControls: false,
      includePopoutButton: false,
      includeInstallControls: false,
    }),
    theater,
    { closable: true },
  );
}

function renderCoreLedgerRows(theater: TheaterNetworkState): string {
  const gameState = getGameState();
  const coreRows = Object.values(theater.rooms)
    .flatMap((room) => getTheaterRoomCoreAssignments(room).map((coreAssignment, slotIndex) => ({ room, coreAssignment, slotIndex })))
    .sort((left, right) => (
      left.room.sectorTag.localeCompare(right.room.sectorTag)
      || left.room.label.localeCompare(right.room.label)
      || left.slotIndex - right.slotIndex
    ));

  if (coreRows.length === 0) {
    return `
      <div class="theater-feed-line">
        No C.O.R.E.s are built in this theater yet. Secure a room, open its C.O.R.E. tab, and assign a facility to bring it online.
      </div>
    `;
  }

  return coreRows.map(({ room, coreAssignment, slotIndex }) => {
    const operational = isTheaterCoreOperational(room);
    const requirements = getTheaterCoreOperationalRequirements(room);
    const incomeLabel = formatResourceCost(coreAssignment.incomePerTick ?? {});
    const repairCost = room.damaged ? getTheaterCoreRepairCost(room) : null;
    const repairCostLabel = repairCost ? formatResourceCost(repairCost) : "";
    const canAffordRepair = repairCost ? canAffordTheaterCost(gameState, repairCost) : false;
    return `
        <article class="theater-core-ledger-row">
        <div class="theater-core-ledger-row__header">
          <div>
            <div class="theater-core-ledger-row__title">${formatCoreType(coreAssignment.type)}</div>
            <div class="theater-core-ledger-row__meta">${room.label} // SLOT ${slotIndex + 1}</div>
          </div>
          <div class="theater-core-ledger-row__tags">
            <span class="theater-core-ledger-row__tag theater-core-ledger-row__tag--core">C.O.R.E.</span>
            <span class="theater-core-ledger-row__tag theater-core-ledger-row__tag--${operational ? "online" : "offline"}">
              ${operational ? "ONLINE" : "OFFLINE"}
            </span>
            ${room.damaged ? `<span class="theater-core-ledger-row__tag theater-core-ledger-row__tag--damaged">DAMAGED</span>` : ""}
            ${room.damaged ? `
              <button
                class="theater-core-ledger-row__repair"
                type="button"
                data-theater-core-repair="${room.id}"
                ${canAffordRepair ? "" : "disabled"}
              >
                Repair // ${repairCostLabel}
              </button>
            ` : ""}
          </div>
        </div>
        <div class="theater-core-ledger-row__copy">${getCoreDescription(coreAssignment.type)}</div>
        <div class="theater-core-ledger-row__requirements">
          Requirements: ${requirements.powerWatts} Watts / ${requirements.commsBw} Comms / ${requirements.supplyCrates} Crates
        </div>
        <div class="theater-core-ledger-row__stats">
          <span>${room.supplyFlow} CR</span>
          <span>${room.powerFlow} W</span>
          <span>${room.commsFlow} BW</span>
          <span>${coreAssignment.wadUpkeepPerTick ?? 0} WAD/TICK</span>
        </div>
        <div class="theater-core-ledger-row__income">
          ${incomeLabel === "0" ? "No passive income" : `Income Per Tick: ${incomeLabel}`}
        </div>
        <div class="theater-core-ledger-row__actions">
          <button
            class="theater-core-ledger-row__inspect"
            type="button"
            data-theater-core-field-room="${room.id}"
          >
            Enter Field Map
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function renderCoreWindow(theater: TheaterNetworkState): string {
  const annexes = Object.values(theater.annexesById ?? {});
  const activeSignals = (theater.automation?.activeSignalSnapshots ?? [])
    .filter((snapshot) => snapshot.active)
    .slice(0, 4);
  const body = `
    <div class="theater-copy">
      <strong>ANNEX & AUTOMATION</strong>
    </div>
    <div class="theater-core-ledger">
      ${annexes.length > 0
        ? annexes.slice(0, 4).map((annex) => `
          <article class="theater-core-ledger-row">
            <div class="theater-core-ledger-row__header">
              <div>
                <div class="theater-core-ledger-row__title">${ANNEX_FRAME_DEFINITIONS[annex.frameType].displayName}</div>
                <div class="theater-core-ledger-row__meta">${annex.annexId} // parent ${resolveTheaterNode(theater, annex.parentNodeId)?.label ?? annex.parentNodeId}</div>
              </div>
              <div class="theater-core-ledger-row__tags">
                <span class="theater-core-ledger-row__tag theater-core-ledger-row__tag--${annex.inheritedControl ? "online" : "offline"}">
                  ${annex.inheritedControl ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
            </div>
            <div class="theater-core-ledger-row__requirements">
              Slots ${annex.moduleSlots.filter((slot) => slot !== null).length}/${annex.moduleSlotCapacity} // Integrity ${annex.integrity} // ${annex.inheritedSupply} CR / ${annex.inheritedPower} W / ${annex.inheritedComms} BW
            </div>
          </article>
        `).join("")
        : `<div class="theater-feed-line">No annex frames are built in this theater yet.</div>`}
      ${activeSignals.length > 0 ? activeSignals.map((snapshot) => `
        <article class="theater-core-ledger-row">
          <div class="theater-core-ledger-row__header">
            <div>
              <div class="theater-core-ledger-row__title">${snapshot.label}</div>
              <div class="theater-core-ledger-row__meta">${snapshot.moduleId}</div>
            </div>
            <div class="theater-core-ledger-row__tags">
              <span class="theater-core-ledger-row__tag theater-core-ledger-row__tag--online">ACTIVE</span>
            </div>
          </div>
          <div class="theater-core-ledger-row__requirements">
            Signal Output: ${snapshot.output.kind === "empty" ? "0" : snapshot.output.value}
          </div>
        </article>
      `).join("") : `<div class="theater-feed-line">No automation chains are firing on this tick.</div>`}
    </div>
    <div class="theater-copy">
      <strong>C.O.R.E.s</strong>
    </div>
    <div class="theater-copy">
      Built facilities continue affecting the theater as supply, power, and comms flow through the secured network. Inspect any C.O.R.E. here or enter its linked field map directly.
    </div>
    <div class="theater-core-ledger">
      ${renderCoreLedgerRows(theater)}
    </div>
  `;
  return renderWindowShell("core", THEATER_WINDOW_DEFS.core.title, THEATER_WINDOW_DEFS.core.kicker, body, theater);
}

function renderFeedWindow(theater: TheaterNetworkState): string {
  const latestFeedEntry = theater.recentEvents[0] ?? "Awaiting fresh theater activity.";
  const body = `
    <div class="theater-feed-panel">
      <div class="theater-feed-log" id="theaterFeedLog" data-theater-feed-log="true">
        ${theater.recentEvents
          .map((entry) => `<div class="theater-feed-line">${escapeHtmlAttribute(entry)}</div>`)
          .join("")}
      </div>
      <div class="theater-feed-cli" aria-label="Latest theater activity">
        <span class="theater-feed-cli-prompt">Q.U.A.C.&gt;</span>
        <span class="theater-feed-cli-text">${escapeHtmlAttribute(latestFeedEntry)}</span>
        <span class="theater-feed-cli-caret">_</span>
      </div>
    </div>
  `;
  return renderWindowShell("feed", THEATER_WINDOW_DEFS.feed.title, THEATER_WINDOW_DEFS.feed.kicker, body, theater);
}

function syncTheaterFeedWindowToLatest(): void {
  const feedLog = document.getElementById("theaterFeedLog");
  if (feedLog) {
    feedLog.scrollTop = 0;
  }
}

function formatAtlasEconomyIncome(summary: OpsTerminalAtlasEconomySummary): string {
  const parts = getResourceEntries(summary.incomePerTick).map((entry) => `${entry.abbreviation} +${entry.amount}`);

  return parts.length > 0 ? parts.join(" / ") : "No passive income";
}

function renderResourcesWindow(state: GameState, theater: TheaterNetworkState): string {
  const resourcePool = getTheaterSessionResourceSummary(state);
  const body = `
    <div class="theater-resource-grid">
      <div class="theater-resource-card"><span>Wad</span><strong>${resourcePool.wad ?? 0}</strong></div>
      ${getResourceEntries(resourcePool.resources, { includeZero: true }).map((entry) => `
        <div class="theater-resource-card"><span>${entry.label}</span><strong>${entry.amount}</strong></div>
      `).join("")}
    </div>
  `;
  return renderWindowShell("resources", THEATER_WINDOW_DEFS.resources.title, THEATER_WINDOW_DEFS.resources.kicker, body, theater);
}

function renderConsumablesWindow(state: GameState, theater: TheaterNetworkState): string {
  const entries = getOwnedConsumableEntries(state.consumables);
  const body = entries.length <= 0
    ? `
        <div class="theater-copy">
          Consumables can be deployed here without spending movement or theater ticks. Tactical-only items stay listed for reference.
        </div>
        <div class="theater-consumables-empty">No consumables are currently stocked for this operation.</div>
      `
    : `
        <div class="theater-copy">
          Heal or prime operators from the theater layer before the next assault. Tactical-only items stay listed here so you can audit what is available.
        </div>
        <div class="theater-consumables-list">
          ${entries.map((entry) => {
            const usableInTheater = isConsumableUsableInTheater(entry.id);
            const targets = getTheaterConsumableTargetIds(state, theater, entry.id)
              .map((unitId) => state.unitsById[unitId])
              .filter((unit): unit is GameState["unitsById"][string] => Boolean(unit))
              .sort((left, right) => left.name.localeCompare(right.name));
            return `
              <article class="theater-consumable-card">
                <div class="theater-consumable-card__top">
                  <div>
                    <div class="theater-consumable-card__name">${entry.definition.name}</div>
                    <div class="theater-consumable-card__desc">${entry.definition.description}</div>
                  </div>
                  <div class="theater-consumable-card__qty">x${entry.quantity}</div>
                </div>
                <div class="theater-consumable-card__targets">
                  ${usableInTheater && targets.length > 0
                    ? targets.map((unit) => `
                        <button
                          class="theater-consumable-target"
                          type="button"
                          data-theater-consumable-use="${entry.id}"
                          data-theater-consumable-target="${unit.id}"
                        >
                          <span class="theater-consumable-target__name">${unit.name}</span>
                          <span class="theater-consumable-target__meta">HP ${unit.hp}/${unit.maxHp}</span>
                        </button>
                      `).join("")
                    : `<div class="theater-consumable-card__empty">${usableInTheater ? "No valid operator target is available right now." : "Use during tactical battles."}</div>`}
                </div>
              </article>
            `;
          }).join("")}
        </div>
      `;
  return renderWindowShell("consumables", THEATER_WINDOW_DEFS.consumables.title, THEATER_WINDOW_DEFS.consumables.kicker, body, theater);
}

function renderUpkeepWindow(theater: TheaterNetworkState): string {
  const economy = getTheaterUpkeepPerTick(theater);
  const resourceIncomeSummary = getResourceEntries(economy.incomePerTick)
    .map((entry) => `${entry.abbreviation} +${entry.amount} per tick`)
    .join(" / ") || "No passive income";
  const body = `
    <div class="theater-copy">
      C.O.R.E.s consume Wad for maintenance and can generate passive materials each travel tick inside the active theater.
    </div>
    <div class="theater-resource-grid theater-resource-grid--upkeep">
      <div class="theater-resource-card"><span>Wad Upkeep Per Tick</span><strong>${economy.wadUpkeep}</strong></div>
      <div class="theater-resource-card theater-resource-card--wide"><span>Resource Income Per Tick</span><strong>${resourceIncomeSummary}</strong></div>
    </div>
    ${isOpsTerminalAtlasOperation(getGameState().operation)
      ? `
        <div class="theater-copy">
          Other warm theaters on this floor continue processing passive upkeep and income while this sector remains active.
        </div>
        <div class="theater-feed-log">
          ${getOpsTerminalAtlasOtherWarmEconomySummaries(theater.definition.id).length === 0
            ? `<div class="theater-feed-line">No other warm theaters are online on this floor yet.</div>`
            : getOpsTerminalAtlasOtherWarmEconomySummaries(theater.definition.id)
                .map((summary) => `
                  <div class="theater-feed-line">
                    ${summary.zoneName} // ${summary.sectorLabel} // ${summary.wadUpkeepPerTick} Wad/tick // ${formatAtlasEconomyIncome(summary)}
                  </div>
                `).join("")}
        </div>
      `
      : ""}
  `;
  return renderWindowShell("upkeep", THEATER_WINDOW_DEFS.upkeep.title, THEATER_WINDOW_DEFS.upkeep.kicker, body, theater);
}

function renderQuestTrackerWindow(theater: TheaterNetworkState): string {
  const body = renderQuestTrackerWidget(getActiveQuests(), {
    className: "theater-quest-tracker-window",
    emptyTitle: "NO ACTIVE QUESTS",
    emptyText: "Accept directives and contracts from the Quest Board to track them during operations.",
  });

  return renderWindowShell("quests", THEATER_WINDOW_DEFS.quests.title, THEATER_WINDOW_DEFS.quests.kicker, body, theater);
}

function renderNotesWindow(theater: TheaterNetworkState): string {
  const anchorRoom = getSelectedRoom(theater) ?? theater.rooms[theater.currentRoomId];
  const stickyTarget = anchorRoom
    ? {
        surfaceType: "theater" as const,
        surfaceId: theater.definition.id,
        x: Math.max(24, Math.min(MAP_WIDTH - 276, Math.round(anchorRoom.position.x + (anchorRoom.size.width / 2) + 28))),
        y: Math.max(24, Math.min(MAP_HEIGHT - 214, Math.round(anchorRoom.position.y - (anchorRoom.size.height / 2) - 14))),
      }
    : undefined;
  const body = `
    <section class="all-nodes-notes-panel theater-notes-panel" aria-label="Field memos" data-ez-drag-disable="true">
      <div class="all-nodes-notes-panel__title">FIELD MEMOS</div>
      ${renderNotesWidget("theater-notes", {
        className: "notes-widget--esc",
        placeholder: "Record reminders, squad plans, build routes, or anything else you want to keep pinned to E.S.C.",
        statusLabel: "AUTO-SAVE ACTIVE // AVAILABLE IN ATLAS + THEATER",
        titleLabel: "Tab Name",
        stickyTarget,
      })}
    </section>
  `;

  return renderWindowShell("notes", THEATER_WINDOW_DEFS.notes.title, THEATER_WINDOW_DEFS.notes.kicker, body, theater);
}

function renderTheaterWindowDock(_theater: TheaterNetworkState): string {
  const frames = ensureTheaterWindowFrames();
  const dockItems = THEATER_WINDOW_ORDER.filter((key) => {
    if (!isTheaterWindowAvailable(key, _theater)) {
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

function renderPendingBattleConfirmation(theater: TheaterNetworkState, destinationRoom: TheaterRoom): string {
  if (!pendingBattleConfirmation || pendingBattleConfirmation.roomId !== destinationRoom.id) {
    return "";
  }
  const pendingConfirmation = pendingBattleConfirmation;

  const state = getGameState();
  const previousRoom = theater.rooms[pendingConfirmation.previousRoomId];
  const canFallback = Boolean(previousRoom && previousRoom.id !== destinationRoom.id);
  const positionClass = destinationRoom.position.x > (MAP_WIDTH * 0.68)
    ? "theater-room-assault-confirm--left"
    : "theater-room-assault-confirm--right";
  const pendingSquad = pendingConfirmation.squadId
    ? theater.squads.find((squad) => squad.squadId === pendingConfirmation.squadId) ?? null
    : getSelectedTheaterSquad(theater);
  const selectedSquadLabel = getSquadDisplayName(pendingSquad);
  const detailedEnemyIntel = destinationRoom.commsLinked && destinationRoom.commsFlow >= 100;
  const commandLinkLabel = pendingSquad
    ? getTheaterSquadLinkSummary(state, pendingSquad.squadId)
    : "COMMAND LINK OPEN";

  return `
    <div class="theater-room-assault-confirm ${positionClass}">
      <div class="theater-room-assault-title">Hostile Contact</div>
      <div class="theater-room-assault-copy">
        Confirm the assault on ${destinationRoom.label}.
      </div>
      <div class="theater-room-assault-route">
        ${previousRoom ? `${previousRoom.label} -&gt; ${destinationRoom.label}` : `${destinationRoom.label} // Direct Engagement`}
      </div>
      <div class="theater-room-assault-briefing">
        <div>${getSquadDisplayIcon(pendingSquad)} ${selectedSquadLabel} // ${pendingSquad?.bwAvailable ?? 0}/${pendingSquad?.bwRequired ?? 0} BW</div>
        <div>Command Link // ${commandLinkLabel}</div>
        ${pendingSquad ? `<div>Unit Ownership // ${getTheaterSquadOwnerSummary(state, pendingSquad)}</div>` : ""}
        ${detailedEnemyIntel ? `<div>Enemy Intel uplink stable // detailed telemetry available in battle.</div>` : ""}
      </div>
      <div class="theater-room-assault-actions">
        <button class="theater-room-assault-btn theater-room-assault-btn--primary" type="button" id="theaterConfirmBattleBtn">
          Start Battle
        </button>
        <button class="theater-room-assault-btn" type="button" id="theaterFallbackBtn" ${canFallback ? "" : "disabled"}>
          Go Back
        </button>
        ${destinationRoom.secured && (destinationRoom.underThreat || destinationRoom.damaged) ? `
          <button class="theater-room-assault-btn" type="button" id="theaterRefuseDefenseBtn">
            Refuse Defense
          </button>
        ` : ""}
      </div>
    </div>
  `;
}

function renderTheaterExitConfirmModal(): string {
  if (!theaterExitConfirmState) {
    return "";
  }

  const operation = getGameState().operation;
  const message = isOpsTerminalAtlasOperation(operation)
    ? "Return to A.T.L.A.S.? Sector layout and room status will be preserved in the ops terminal view."
    : "Return to A.T.L.A.S.? Your current operation will remain active so you can resume it later from the atlas terminal.";

  return `
    <div class="game-confirm-modal-backdrop" id="theaterExitConfirmModal">
      <div class="game-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="theaterExitConfirmTitle">
        <div class="game-confirm-modal__header">
          <div class="game-confirm-modal__kicker">THEATER COMMAND // CONFIRM EXIT</div>
          <h2 class="game-confirm-modal__title" id="theaterExitConfirmTitle">RETURN TO A.T.L.A.S.</h2>
        </div>
        <div class="game-confirm-modal__copy">${message}</div>
        <div class="game-confirm-modal__actions">
          <button
            class="game-confirm-modal__btn game-confirm-modal__btn--primary"
            type="button"
            id="theaterExitConfirmAcceptBtn"
            data-theater-exit-confirm-action="accept"
            data-controller-default-focus="true"
          >
            RETURN
          </button>
          <button
            class="game-confirm-modal__btn"
            type="button"
            data-theater-exit-confirm-action="cancel"
          >
            STAY IN THEATER
          </button>
        </div>
      </div>
    </div>
  `;
}

function openTheaterExitConfirm(): void {
  theaterExitConfirmState = "return-atlas";
  renderTheaterCommandScreen();
}

function closeTheaterExitConfirm(): void {
  if (!theaterExitConfirmState) {
    return;
  }
  theaterExitConfirmState = null;
  renderTheaterCommandScreen();
}

function resolveTheaterExitConfirm(): void {
  if (!theaterExitConfirmState) {
    return;
  }
  theaterExitConfirmState = null;
  returnToAtlasScreen();
}

function renderCompletionCallout(
  theater: TheaterNetworkState,
  completion: TheaterObjectiveCompletion,
  canDescend: boolean,
): string {
  const completionRoom = theater.rooms[completion.roomId];
  if (!completionRoom || !isRoomVisible(completionRoom)) {
    return "";
  }

  const positionClass = completionRoom.position.x > (MAP_WIDTH * 0.68)
    ? "theater-room-completion-popup--left"
    : "theater-room-completion-popup--right";
  const atlasBackedOperation = isOpsTerminalAtlasOperation(getGameState().operation);
  const finalFloorReached = theater.definition.floorOrdinal >= CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL;

  return `
    <div
      class="theater-room-completion-popup ${positionClass}"
      data-theater-room-completion-popup="true"
    >
      <div class="theater-room-completion-title">Objective Secured</div>
      <div class="theater-room-completion-room">${completionRoom.label}</div>
      <div class="theater-room-completion-copy">
        ${canDescend
          ? "Floor objective complete. Rewards are already secured. Remain in theater as long as you want, then descend when ready."
          : finalFloorReached && atlasBackedOperation
            ? "Campaign complete. Rewards are already secured. Remain in theater as long as you want, then proceed to the ending and postgame when you are ready."
          : atlasBackedOperation
            ? "Operation objective complete. Rewards are already secured. Remain in theater as long as you want, then return to A.T.L.A.S. when ready."
            : "Operation objective complete. Rewards are already secured. Remain in theater as long as you want, then return to Base Camp when ready."}
      </div>
      <div class="theater-completion-recap">
        ${completion.recapLines.map((line) => `<div class="theater-completion-line">${line}</div>`).join("")}
      </div>
      <div class="theater-completion-reward-grid">
        <div class="theater-completion-reward-item"><span>Wad</span><strong>+${completion.reward.wad}</strong></div>
        ${getResourceEntries(completion.reward, { includeZero: true }).map((entry) => `
          <div class="theater-completion-reward-item"><span>${entry.label}</span><strong>+${entry.amount}</strong></div>
        `).join("")}
      </div>
      <div class="theater-room-completion-actions">
        ${canDescend
          ? `
            <button class="theater-room-assault-btn theater-room-assault-btn--primary" type="button" id="theaterCompletionAdvanceBtn">
              Descend To Next Floor
            </button>
          `
          : `
            <button class="theater-room-assault-btn theater-room-assault-btn--primary" type="button" id="theaterCompletionReturnBtn">
              ${finalFloorReached && atlasBackedOperation ? "Proceed To Ending" : atlasBackedOperation ? "Return To A.T.L.A.S." : "Return To Base Camp"}
            </button>
          `}
      </div>
      <div class="theater-room-completion-note">
        Leave this window alone if you want to keep operating before exit.
      </div>
    </div>
  `;
}

function renderCompletionPopupForRoom(
  theater: TheaterNetworkState,
  room: TheaterRoom,
  canDescend: boolean,
): string {
  const completion = theater.completion;
  if (!theater.objectiveComplete || !completion || completion.roomId !== room.id) {
    return "";
  }

  return renderCompletionCallout(theater, completion, canDescend);
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
        overflow: visible;
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
        stroke: rgba(130, 144, 148, 0.28);
        stroke-width: 6;
        stroke-linecap: round;
        fill: none;
        transition: opacity 120ms ease, stroke 120ms ease, filter 120ms ease, stroke-dashoffset 120ms ease;
      }

      .theater-link--command {
        stroke-width: 4px;
      }

      .theater-link--supply {
        stroke: rgba(140, 219, 158, 0.9);
      }

      .theater-link--power {
        stroke: rgba(92, 180, 220, 0.92);
      }

      .theater-link--comms {
        stroke: rgba(255, 204, 110, 0.92);
      }

      .theater-link--online {
        opacity: 0.92;
      }

      .theater-link--cut {
        opacity: 0.18;
        stroke-dasharray: none;
        animation: none;
        filter: none;
      }

      .theater-link--weak {
        stroke-dasharray: 1 16;
      }

      .theater-link--good {
        stroke-dasharray: none;
      }

      .theater-link--strong {
        stroke-dasharray: 20 12;
        animation: theater-link-flow 1.2s linear infinite;
        filter: drop-shadow(0 0 6px rgba(255, 248, 218, 0.22));
      }

      .theater-link--pressure {
        stroke: rgba(240, 107, 88, 0.9);
        opacity: 0.94;
      }

      .theater-link--threat-route {
        stroke: rgba(240, 107, 88, 0.92);
        stroke-width: 3px;
        stroke-dasharray: 10 10;
        opacity: 0.85;
        animation: theater-link-flow 0.9s linear infinite;
      }

      .theater-link--phantom-route {
        stroke: rgba(255, 204, 110, 0.68);
        stroke-width: 2.5px;
        stroke-dasharray: 4 10;
        opacity: 0.74;
        animation: theater-link-false-flow 1.4s linear infinite;
      }

      .theater-link--fogged {
        opacity: 0.28;
      }

      .theater-link--gated {
        stroke-width: 7px;
      }

      .theater-link--command.theater-link--gated {
        stroke-width: 5px;
      }

      @keyframes theater-link-flow {
        from {
          stroke-dashoffset: 0;
        }

        to {
          stroke-dashoffset: -64;
        }
      }

      @keyframes theater-link-false-flow {
        from {
          stroke-dashoffset: 0;
        }

        to {
          stroke-dashoffset: -28;
        }
      }

      .theater-room-node {
        appearance: none;
        -webkit-appearance: none;
        position: absolute;
        z-index: 2;
        border-radius: 14px;
        border: 1px solid rgba(112, 129, 141, 0.55);
        background:
          linear-gradient(180deg, rgba(154, 170, 181, 0.08), rgba(11, 14, 28, 0)),
          linear-gradient(160deg, rgba(32, 38, 43, 0.96), rgba(56, 64, 71, 0.94));
        color: #ecf5f7;
        cursor: pointer;
        padding: 14px 42px 16px 16px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 6px;
        box-shadow:
          0 16px 32px rgba(0, 0, 0, 0.28),
          inset 0 1px 0 rgba(255, 255, 255, 0.06);
        transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
        user-select: none;
        text-align: left;
        font: inherit;
        overflow: visible;
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

      .theater-room-node--intel-low {
        border-style: dashed;
        backdrop-filter: blur(3px);
      }

      .theater-room-node--locked {
        border-color: rgba(164, 201, 255, 0.82);
        box-shadow:
          0 0 0 1px rgba(164, 201, 255, 0.18),
          0 18px 34px rgba(0, 0, 0, 0.34);
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

      .theater-room-node--barricaded::after {
        content: "";
        position: absolute;
        inset: -8px;
        border: 3px solid rgba(232, 216, 161, 0.86);
        border-radius: 18px;
        pointer-events: none;
        box-shadow:
          0 0 0 1px rgba(92, 61, 28, 0.75),
          0 0 18px rgba(255, 204, 110, 0.24),
          inset 0 0 0 1px rgba(255, 255, 255, 0.12);
      }

      .theater-room-node--barricaded-heavy::after {
        inset: -10px;
        border-width: 4px;
        box-shadow:
          0 0 0 2px rgba(92, 61, 28, 0.82),
          0 0 24px rgba(255, 204, 110, 0.32),
          inset 0 0 0 1px rgba(255, 255, 255, 0.14);
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
        overflow: hidden;
        border-radius: 10px;
        border: 1px solid rgba(255, 204, 110, 0.45);
        background: rgba(30, 24, 16, 0.92);
        color: #ffcc6e;
        padding: 6px 8px;
        font-size: 0.58rem;
        font-weight: 900;
        letter-spacing: 0.14em;
        text-align: center;
        isolation: isolate;
      }

      .theater-room-core-icon--online {
        box-shadow:
          0 0 0 1px rgba(255, 204, 110, 0.14),
          0 0 14px rgba(255, 204, 110, 0.18);
        animation: theaterCoreIconPulse 1.7s ease-in-out infinite;
      }

      .theater-room-core-icon--online::after {
        content: "";
        position: absolute;
        top: -30%;
        left: -68%;
        width: 52%;
        height: 170%;
        background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 241, 196, 0.72), rgba(255, 255, 255, 0));
        transform: rotate(18deg);
        opacity: 0.9;
        pointer-events: none;
        mix-blend-mode: screen;
        animation: theaterCoreIconSweep 1.5s linear infinite;
      }

      @keyframes theaterCoreIconPulse {
        0%,
        100% {
          transform: translateY(0) scale(1);
          border-color: rgba(255, 204, 110, 0.45);
          box-shadow:
            0 0 0 1px rgba(255, 204, 110, 0.1),
            0 0 12px rgba(255, 204, 110, 0.14);
        }

        50% {
          transform: translateY(-1px) scale(1.03);
          border-color: rgba(255, 224, 154, 0.9);
          box-shadow:
            0 0 0 1px rgba(255, 224, 154, 0.18),
            0 0 20px rgba(255, 204, 110, 0.32);
        }
      }

      @keyframes theaterCoreIconSweep {
        from {
          left: -68%;
        }

        to {
          left: 132%;
        }
      }

      .theater-room-fort-markers {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 3px;
        pointer-events: none;
      }

      .theater-room-fort-marker {
        display: block;
        position: relative;
        width: 14px;
        height: 8px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18) inset;
      }

      .theater-room-fort-marker--barricade {
        width: 16px;
        height: 18px;
        border-radius: 0;
        border-color: rgba(224, 236, 255, 0.42);
        background:
          linear-gradient(180deg, rgba(235, 243, 255, 0.3), rgba(235, 243, 255, 0) 35%),
          linear-gradient(180deg, rgba(161, 176, 193, 0.98), rgba(91, 104, 119, 0.98));
        clip-path: polygon(50% 2%, 92% 14%, 92% 55%, 50% 98%, 8% 55%, 8% 14%);
        box-shadow:
          0 5px 12px rgba(0, 0, 0, 0.24),
          0 0 0 1px rgba(0, 0, 0, 0.28) inset;
      }

      .theater-room-fort-marker--barricade::after {
        content: "";
        position: absolute;
        inset: 3px 4px 6px;
        border-radius: 999px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0));
        opacity: 0.85;
        pointer-events: none;
      }

      .theater-room-fort-marker--barricade + .theater-room-fort-marker--barricade {
        margin-top: -9px;
        margin-right: -4px;
      }

      .theater-room-fort-marker--power {
        background: linear-gradient(180deg, rgba(119, 190, 255, 0.96), rgba(57, 108, 198, 0.96));
      }

      .theater-room-fort-marker--aux {
        background: linear-gradient(180deg, rgba(186, 153, 255, 0.96), rgba(101, 76, 168, 0.96));
      }

      .theater-room-warning {
        position: absolute;
        top: 50%;
        min-width: 142px;
        border-radius: 14px;
        border: 1px solid rgba(255, 204, 110, 0.42);
        background:
          linear-gradient(180deg, rgba(255, 204, 110, 0.16), rgba(255, 204, 110, 0)),
          linear-gradient(180deg, rgba(53, 38, 15, 0.98), rgba(22, 15, 8, 0.98));
        box-shadow:
          0 16px 34px rgba(0, 0, 0, 0.34),
          inset 0 1px 0 rgba(255, 244, 220, 0.12);
        padding: 9px 10px;
        pointer-events: none;
        transform: translateY(-50%);
        z-index: 7;
      }

      .theater-room-warning--right {
        left: calc(100% + 14px);
      }

      .theater-room-warning--left {
        right: calc(100% + 14px);
      }

      .theater-room-warning__title {
        font-size: 0.54rem;
        font-weight: 900;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #ffdc9c;
      }

      .theater-room-warning__copy {
        margin-top: 5px;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: #fff3de;
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

      .theater-room-flags--lowintel {
        margin-bottom: 10px;
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

      .theater-chip--lock {
        color: #bfd8ff;
        border-color: rgba(121, 161, 255, 0.28);
        background: rgba(18, 28, 46, 0.42);
      }

      .theater-chip--key {
        color: #ffe1a6;
        border-color: rgba(255, 204, 110, 0.24);
        background: rgba(54, 39, 12, 0.32);
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
        left: 50%;
        bottom: -30px;
        transform: translateX(-50%);
        width: max-content;
        min-width: 170px;
        max-width: calc(100% - 28px);
        border-radius: 18px;
        border: 1px solid rgba(255, 204, 110, 0.62);
        background:
          linear-gradient(180deg, rgba(255, 204, 110, 0.2), rgba(255, 204, 110, 0)),
          linear-gradient(180deg, rgba(87, 62, 24, 0.98), rgba(54, 38, 16, 0.98));
        color: #fff4dd;
        padding: 9px 14px 10px;
        font-size: 0.7rem;
        font-weight: 900;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        cursor: pointer;
        box-shadow:
          0 14px 28px rgba(0, 0, 0, 0.34),
          0 0 0 1px rgba(255, 204, 110, 0.12),
          inset 0 1px 0 rgba(255, 246, 226, 0.18);
        white-space: nowrap;
        z-index: 5;
      }

      .theater-room-move-btn small {
        display: block;
        margin-top: 5px;
        font-size: 0.58rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        color: rgba(255, 239, 212, 0.8);
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
        border: 2px solid var(--theater-squad-marker-border, rgba(255, 204, 110, 0.95));
        background:
          radial-gradient(circle, var(--theater-squad-marker-accent-soft, rgba(255, 204, 110, 0.18)), rgba(0, 0, 0, 0.06));
        color: var(--theater-squad-marker-text, #fff7e7);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.62rem;
        font-weight: 900;
        letter-spacing: 0.12em;
        pointer-events: none;
        z-index: 4;
      }

      .theater-squad-marker--selected {
        box-shadow:
          0 0 0 4px var(--theater-squad-marker-accent-soft, rgba(255, 204, 110, 0.22)),
          0 0 22px var(--theater-squad-marker-glow, rgba(255, 204, 110, 0.28));
      }

      .theater-squad-marker--offline {
        opacity: 0.68;
        border-style: dashed;
        filter: saturate(0.72) brightness(0.92);
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

      .theater-map-mode-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding-right: 6px;
        margin-right: 2px;
        border-right: 1px solid rgba(255, 255, 255, 0.08);
      }

      .theater-map-mode-btn {
        border-radius: 999px;
        border: 1px solid rgba(154, 170, 181, 0.18);
        background: rgba(18, 20, 24, 0.88);
        color: rgba(229, 240, 242, 0.68);
        padding: 9px 12px;
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        cursor: pointer;
      }

      .theater-map-mode-btn--active {
        border-color: rgba(255, 204, 110, 0.52);
        background: rgba(58, 46, 27, 0.92);
        color: #ffcc6e;
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
        overflow: visible;
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

      .theater-window-side-switch {
        position: absolute;
        top: 12px;
        left: calc(100% + 12px);
        z-index: 2;
        min-width: 148px;
        border-radius: 12px;
        border: 1px solid var(--all-nodes-surface-border, rgba(122, 92, 214, 0.24));
        background:
          linear-gradient(180deg, var(--all-nodes-accent-soft, rgba(192, 179, 255, 0.14)), rgba(11, 14, 28, 0)),
          linear-gradient(160deg, var(--all-nodes-surface-bg, rgba(10, 14, 28, 0.96)), var(--all-nodes-panel-bg, rgba(20, 18, 40, 0.94)));
        color: var(--all-nodes-text, #edf1f4);
        padding: 10px 12px;
        box-shadow: 0 14px 30px rgba(0, 0, 0, 0.34);
        display: grid;
        gap: 4px;
        text-align: left;
        cursor: pointer;
      }

      .theater-window-side-switch__label,
      .theater-window-side-switch__value {
        font-family: var(--font-terminal, 'JetBrains Mono', monospace);
        text-transform: uppercase;
      }

      .theater-window-side-switch__label {
        font-size: 0.56rem;
        letter-spacing: 0.16em;
        color: var(--all-nodes-muted, #9aaab5);
      }

      .theater-window-side-switch__value {
        font-size: 0.66rem;
        font-weight: 800;
        letter-spacing: 0.1em;
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
      .theater-window-minimize,
      .theater-window-close {
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

      .theater-window-close {
        font-size: 1rem;
        font-weight: 700;
        line-height: 1;
      }

      .theater-window-color:hover,
      .theater-window-minimize:hover,
      .theater-window-close:hover {
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

      .theater-window[data-theater-window="notes"] .theater-window-body {
        display: flex;
        padding: 0;
        overflow: hidden;
      }

      .theater-window[data-theater-window="notes"] .theater-notes-panel {
        flex: 1 1 auto;
        min-height: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
      }

      .theater-window[data-theater-window="notes"] .notes-widget {
        flex: 1 1 auto;
        min-height: 0;
      }

      .theater-window[data-theater-window="quests"] .theater-window-body {
        padding: 0;
        overflow: hidden;
      }

      .theater-window[data-theater-window="quests"] .theater-quest-tracker-window {
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
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

      .theater-resource-card--wide {
        grid-column: 1 / -1;
      }

      .theater-resource-card--wide strong {
        line-height: 1.45;
      }

      .theater-consumables-list {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }

      .theater-consumables-empty {
        margin-top: 12px;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        background: rgba(255, 255, 255, 0.03);
        color: #9aaab5;
        font-size: 0.74rem;
      }

      .theater-consumable-card {
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        background: rgba(255, 255, 255, 0.03);
        padding: 12px;
        display: grid;
        gap: 10px;
      }

      .theater-consumable-card__top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }

      .theater-consumable-card__name {
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #ecf5f7;
      }

      .theater-consumable-card__desc {
        margin-top: 5px;
        color: #9aaab5;
        font-size: 0.68rem;
        line-height: 1.45;
      }

      .theater-consumable-card__qty {
        flex-shrink: 0;
        min-width: 44px;
        padding: 5px 8px;
        border-radius: 999px;
        border: 1px solid var(--all-nodes-surface-border, rgba(132, 197, 155, 0.26));
        background: var(--all-nodes-accent-soft, rgba(20, 30, 27, 0.9));
        text-align: center;
        font-size: 0.64rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        color: var(--all-nodes-accent, #a8e0b4);
      }

      .theater-consumable-card__targets {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(138px, 1fr));
        gap: 8px;
      }

      .theater-consumable-target {
        width: 100%;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        background: rgba(10, 15, 24, 0.7);
        color: #edf4ef;
        padding: 10px 11px;
        display: grid;
        gap: 4px;
        text-align: left;
        cursor: pointer;
      }

      .theater-consumable-target:hover {
        border-color: var(--all-nodes-border-hover, #84c59b);
        background: rgba(14, 22, 31, 0.92);
      }

      .theater-consumable-target__name {
        font-size: 0.66rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .theater-consumable-target__meta,
      .theater-consumable-card__empty {
        color: #9aaab5;
        font-size: 0.62rem;
        line-height: 1.45;
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

      .theater-action-btn--danger {
        border-color: rgba(240, 107, 88, 0.4);
        background: rgba(70, 30, 24, 0.9);
      }

      .theater-action-btn--locked {
        border-color: rgba(152, 168, 180, 0.2);
        background: rgba(24, 30, 36, 0.92);
        color: rgba(188, 198, 206, 0.84);
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

      .theater-chip-button {
        border-radius: 999px;
        border: 1px solid rgba(255, 204, 110, 0.22);
        background: rgba(47, 34, 16, 0.9);
        color: #ffcc6e;
        padding: 5px 9px;
        font-size: 0.56rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        cursor: pointer;
      }

      .theater-chip-button--locked {
        border-color: rgba(152, 168, 180, 0.22);
        background: rgba(24, 30, 36, 0.94);
        color: rgba(188, 198, 206, 0.86);
      }

      .theater-root--tactical-fullscreen [data-theater-window]:not([data-theater-window="room"]),
      .theater-root--tactical-fullscreen .theater-window-dock {
        display: none !important;
      }

      .theater-window--tactical-fullscreen {
        position: fixed !important;
        left: 16px !important;
        right: 16px !important;
        top: 16px !important;
        bottom: 16px !important;
        width: auto !important;
        height: auto !important;
        z-index: 999 !important;
      }

      .theater-window--tactical-fullscreen .theater-window-side-switch,
      .theater-window--tactical-fullscreen .theater-window-resize,
      .theater-window--tactical-fullscreen .theater-window-grip {
        display: none;
      }

      .theater-window--tactical-fullscreen .theater-window-header {
        cursor: default;
      }

      .theater-window-body--tactical-fullscreen {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .theater-tactical-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .theater-tactical-panel--fullscreen {
        flex: 1 1 auto;
        min-height: 0;
      }

      .theater-tactical-map-region {
        min-height: 0;
      }

      .theater-tactical-panel--fullscreen .theater-tactical-map-region {
        flex: 1 1 auto;
        display: flex;
        min-height: 0;
        overflow: hidden;
      }

      .map-builder-canvas--theater-fullscreen {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        padding-right: 6px;
      }

      .theater-tactical-panel--fullscreen .theater-annex-build-grid,
      .theater-tactical-panel--fullscreen .theater-core-list {
        max-height: 172px;
        overflow: auto;
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
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        align-content: start;
      }

      .theater-core-ledger {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }

      .theater-core-ledger-row {
        display: grid;
        gap: 10px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.03);
        padding: 12px;
      }

      .theater-core-ledger-row__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }

      .theater-core-ledger-row__title {
        font-size: 0.82rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--all-nodes-text, #edf1f4);
      }

      .theater-core-ledger-row__meta,
      .theater-core-ledger-row__copy,
      .theater-core-ledger-row__requirements,
      .theater-core-ledger-row__stats,
      .theater-core-ledger-row__income,
      .theater-core-ledger-row__inspect,
      .theater-core-ledger-row__tag,
      .theater-core-ledger-row__repair {
        font-family: var(--font-terminal, 'JetBrains Mono', monospace);
      }

      .theater-core-ledger-row__meta {
        margin-top: 5px;
        font-size: 0.58rem;
        letter-spacing: 0.1em;
        color: var(--all-nodes-muted, #9aaab5);
      }

      .theater-core-ledger-row__tags {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 6px;
      }

      .theater-core-ledger-row__tag,
      .theater-core-ledger-row__repair {
        flex-shrink: 0;
        padding: 6px 9px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        font-size: 0.58rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .theater-core-ledger-row__tag--core {
        background: rgba(84, 96, 112, 0.2);
        color: #dbe7f0;
      }

      .theater-core-ledger-row__tag--online {
        background: rgba(52, 95, 62, 0.26);
        color: #bee7c7;
      }

      .theater-core-ledger-row__tag--offline {
        background: rgba(96, 58, 32, 0.26);
        color: #ffd6a0;
      }

      .theater-core-ledger-row__tag--damaged {
        background: rgba(114, 54, 54, 0.32);
        color: #ffd0d0;
      }

      .theater-core-ledger-row__copy {
        font-size: 0.72rem;
        line-height: 1.45;
        color: #d5e0e8;
      }

      .theater-core-ledger-row__requirements {
        font-size: 0.64rem;
        line-height: 1.45;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--all-nodes-accent, #d0c1ff);
      }

      .theater-core-ledger-row__stats {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .theater-core-ledger-row__stats span {
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(0, 0, 0, 0.18);
        padding: 5px 8px;
        font-size: 0.6rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #e6edf2;
      }

      .theater-core-ledger-row__income {
        font-size: 0.66rem;
        line-height: 1.45;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #d7e4dc;
      }

      .theater-core-ledger-row__actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: wrap;
      }

      .theater-core-ledger-row__inspect,
      .theater-core-ledger-row__repair {
        min-width: 154px;
        border-radius: 10px;
        border: 1px solid var(--all-nodes-surface-border, rgba(132, 197, 155, 0.26));
        background: rgba(16, 30, 25, 0.92);
        color: var(--all-nodes-text, #edf4ef);
        padding: 10px 12px;
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        cursor: pointer;
      }

      .theater-core-ledger-row__repair {
        min-width: 0;
        background: rgba(40, 28, 15, 0.92);
      }

      .theater-core-ledger-row__inspect:hover,
      .theater-core-ledger-row__repair:hover {
        border-color: var(--all-nodes-border-hover, rgba(255, 204, 110, 0.45));
      }

      .theater-core-ledger-row__repair:disabled {
        opacity: 0.45;
        cursor: default;
      }

      .theater-core-tabs {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 12px;
      }

      .theater-core-tabs--primary {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .theater-core-tabs--advanced {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        margin: 8px 0 0;
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

      .theater-selected-room-advanced {
        border: 1px solid var(--all-nodes-surface-border, rgba(255, 255, 255, 0.08));
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.025);
        margin-bottom: 12px;
        padding: 8px;
      }

      .theater-selected-room-advanced--collapsed {
        background: rgba(0, 0, 0, 0.12);
      }

      .theater-selected-room-advanced--active {
        border-color: var(--all-nodes-border-hover, rgba(255, 204, 110, 0.45));
        box-shadow: inset 0 0 0 1px rgba(255, 204, 110, 0.08);
      }

      .theater-selected-room-advanced__toggle {
        width: 100%;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.18);
        color: var(--all-nodes-text, #d5e0e8);
        cursor: pointer;
        padding: 9px 11px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        text-align: left;
        text-transform: uppercase;
        letter-spacing: 0.14em;
      }

      .theater-selected-room-advanced__toggle span {
        color: var(--all-nodes-accent, #ffcc6e);
        font-size: 0.68rem;
        font-weight: 900;
      }

      .theater-selected-room-advanced__toggle small {
        color: var(--all-nodes-muted, #9aaab5);
        font-size: 0.54rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-align: right;
      }

      .theater-feed-panel {
        display: flex;
        flex-direction: column;
        min-height: 100%;
        gap: 12px;
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

      .theater-objective-panel {
        margin-top: 12px;
        display: grid;
        gap: 10px;
        border-radius: 14px;
        border: 1px solid rgba(255, 204, 110, 0.18);
        background: rgba(255, 204, 110, 0.06);
        padding: 12px;
      }

      .theater-objective-panel__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        font-size: 0.62rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #96a2ab;
      }

      .theater-objective-panel__header strong {
        color: #ffcc6e;
      }

      .theater-objective-panel__copy {
        font-size: 0.78rem;
        line-height: 1.45;
        color: #edf4ef;
      }

      .theater-objective-panel__progress {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .theater-objective-panel__progress span {
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(0, 0, 0, 0.18);
        padding: 5px 9px;
        font-size: 0.6rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #dfe8ec;
      }

      .theater-objective-panel__state {
        font-size: 0.62rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #9aaab5;
      }

      .theater-objective-panel__state--complete {
        color: #8cdb9e;
      }

      .theater-squad-ledger {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }

      .theater-squad-card {
        display: grid;
        gap: 10px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.03);
        padding: 12px;
      }

      .theater-squad-card--dropzone {
        transition:
          border-color 140ms ease,
          box-shadow 140ms ease,
          background 140ms ease,
          transform 140ms ease;
      }

      .theater-squad-card--selected {
        border-color: rgba(255, 204, 110, 0.34);
        box-shadow: 0 0 0 1px rgba(255, 204, 110, 0.12);
      }

      .theater-squad-card--offline {
        border-style: dashed;
        border-color: rgba(152, 162, 170, 0.18);
        background: rgba(72, 78, 84, 0.12);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
        opacity: 0.72;
      }

      .theater-squad-card--emergency-control {
        opacity: 0.88;
        border-color: rgba(255, 204, 110, 0.24);
      }

      .theater-squad-card--drop-valid {
        border-color: rgba(114, 255, 185, 0.42);
        box-shadow: 0 0 0 1px rgba(114, 255, 185, 0.18);
        background: rgba(27, 74, 59, 0.2);
      }

      .theater-squad-card--drop-invalid {
        border-color: rgba(255, 126, 126, 0.34);
        background: rgba(96, 34, 34, 0.18);
      }

      .theater-squad-card__header,
      .theater-squad-card__bandwidth,
      .theater-squad-card__actions,
      .theater-squad-card__unit {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .theater-squad-card__identity,
      .theater-squad-card__identity-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .theater-squad-card__identity-copy {
        min-width: 0;
      }

      .theater-squad-card__icon {
        width: 32px;
        height: 32px;
        padding: 0;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(0, 0, 0, 0.22);
        color: #edf4ef;
        font-size: 0.95rem;
        line-height: 1;
        cursor: pointer;
      }

      .theater-squad-card__color {
        flex: 0 0 auto;
      }

      .theater-squad-card__title {
        font-size: 0.82rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #edf4ef;
      }

      .theater-squad-card__meta,
      .theater-squad-card__status,
      .theater-squad-card__bandwidth {
        font-family: var(--font-terminal, 'JetBrains Mono', monospace);
        font-size: 0.62rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #9aaab5;
      }

      .theater-squad-card__status {
        color: #ffcc6e;
      }

      .theater-squad-card--offline .theater-squad-card__status,
      .theater-squad-card--offline .theater-squad-card__meta,
      .theater-squad-card--offline .theater-squad-card__bandwidth {
        color: #b4bec6;
      }

      .theater-squad-card__offline-note {
        border-radius: 10px;
        border: 1px dashed rgba(176, 186, 194, 0.24);
        background: rgba(16, 20, 24, 0.26);
        padding: 8px 10px;
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #c1cad1;
      }

      .theater-squad-card__units {
        display: grid;
        gap: 6px;
      }

      .theater-squad-card__unit {
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.18);
        padding: 8px 10px;
        font-size: 0.68rem;
        color: #edf4ef;
      }

      .theater-squad-card__unit--draggable {
        cursor: grab;
      }

      .theater-squad-card__unit--draggable:hover {
        background: rgba(0, 0, 0, 0.28);
      }

      .theater-squad-card__unit--dragging {
        opacity: 0.44;
        transform: scale(0.985);
        cursor: grabbing;
      }

      .theater-squad-drag-preview {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 9999;
        pointer-events: none;
        border-radius: 10px;
        border: 1px solid rgba(114, 255, 185, 0.38);
        background: rgba(11, 18, 24, 0.92);
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.36);
        padding: 8px 12px;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #edf4ef;
        transform: translate3d(0, 0, 0);
      }

      .theater-squad-card__unit-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .theater-travel-popup {
        position: absolute;
        z-index: 12;
        width: min(372px, calc(100vw - 36px));
        pointer-events: none;
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

      .theater-travel-popup--left::after,
      .theater-travel-popup--right::after {
        content: "";
        position: absolute;
        top: 50%;
        width: 16px;
        height: 16px;
        margin-top: -8px;
        background: inherit;
      }

      .theater-travel-popup--right::after {
        left: -7px;
        border-left: 1px solid var(--all-nodes-border, rgba(122, 92, 214, 0.46));
        border-bottom: 1px solid var(--all-nodes-border, rgba(122, 92, 214, 0.46));
        transform: rotate(45deg);
      }

      .theater-travel-popup--left::after {
        right: -7px;
        border-right: 1px solid var(--all-nodes-border, rgba(122, 92, 214, 0.46));
        border-top: 1px solid var(--all-nodes-border, rgba(122, 92, 214, 0.46));
        transform: rotate(45deg);
      }

      .theater-travel-popup-header {
        padding: 10px 12px 9px;
        background:
          linear-gradient(180deg, var(--all-nodes-panel-hover-bg, rgba(28, 20, 56, 0.92)), var(--all-nodes-surface-bg, rgba(18, 16, 38, 0.84)));
        border-bottom: 1px solid var(--all-nodes-surface-border, rgba(122, 92, 214, 0.22));
      }

      .theater-travel-popup-kicker {
        font-size: 9px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--all-nodes-muted, rgba(191, 172, 255, 0.64));
      }

      .theater-travel-popup-title {
        margin-top: 2px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--all-nodes-text, #f1edff);
      }

      .theater-travel-popup-media-frame {
        margin: 12px 12px 0;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid var(--all-nodes-surface-border, rgba(255, 255, 255, 0.08));
        background: rgba(0, 0, 0, 0.22);
        aspect-ratio: 16 / 10;
        min-height: 200px;
        max-height: 36vh;
        padding: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .theater-travel-popup-video {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #05080b;
      }

      .theater-room-assault-confirm {
        position: absolute;
        top: 50%;
        width: 248px;
        border-radius: 16px;
        border: 1px solid rgba(255, 204, 110, 0.52);
        background:
          linear-gradient(180deg, rgba(255, 204, 110, 0.14), rgba(255, 204, 110, 0)),
          linear-gradient(180deg, rgba(39, 28, 14, 0.98), rgba(17, 12, 7, 0.98));
        box-shadow:
          0 18px 38px rgba(0, 0, 0, 0.42),
          inset 0 1px 0 rgba(255, 244, 220, 0.12);
        padding: 12px 12px 14px;
        z-index: 7;
      }

      .theater-room-assault-confirm--right {
        left: calc(100% + 18px);
        transform: translateY(-50%);
      }

      .theater-room-assault-confirm--left {
        right: calc(100% + 18px);
        transform: translateY(-50%);
      }

      .theater-room-assault-title {
        font-size: 0.62rem;
        font-weight: 900;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #ffcc6e;
      }

      .theater-room-assault-copy {
        margin-top: 7px;
        color: #f2eadb;
        font-size: 0.76rem;
        line-height: 1.45;
      }

      .theater-room-assault-route {
        margin-top: 10px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        padding: 8px 10px;
        color: rgba(237, 241, 244, 0.88);
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .theater-room-assault-briefing {
        margin-top: 10px;
        display: grid;
        gap: 6px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        padding: 8px 10px;
        font-size: 0.6rem;
        line-height: 1.45;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(237, 241, 244, 0.88);
      }

      .theater-room-assault-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .theater-room-assault-btn {
        flex: 1 1 0;
        border-radius: 10px;
        border: 1px solid rgba(168, 176, 182, 0.28);
        background: rgba(24, 24, 24, 0.55);
        color: #edf1f4;
        padding: 8px 10px;
        font-size: 0.6rem;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        cursor: pointer;
      }

      .theater-room-assault-btn--primary {
        border-color: rgba(255, 204, 110, 0.55);
        background:
          linear-gradient(180deg, rgba(255, 204, 110, 0.18), rgba(255, 204, 110, 0)),
          rgba(73, 52, 19, 0.92);
        color: #fff6e1;
      }

      .theater-room-assault-btn:disabled {
        opacity: 0.48;
        cursor: default;
      }

      .theater-travel-popup-copy {
        padding: 12px 12px 0;
        font-size: 0.74rem;
        line-height: 1.45;
        color: var(--all-nodes-text, #d5e0e8);
      }

      .theater-travel-popup-route {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin: 12px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--all-nodes-surface-border, rgba(255, 255, 255, 0.08));
        background: rgba(255, 255, 255, 0.03);
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--all-nodes-text, #edf1f4);
      }

      .theater-travel-popup-route-arrow {
        color: var(--all-nodes-accent, #ffcc6e);
        font-size: 0.9rem;
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

      .theater-room-completion-popup {
        position: absolute;
        top: 50%;
        width: 334px;
        border-radius: 16px;
        border: 1px solid rgba(132, 197, 155, 0.48);
        background:
          linear-gradient(180deg, rgba(132, 197, 155, 0.12), rgba(132, 197, 155, 0)),
          linear-gradient(180deg, rgba(22, 33, 27, 0.98), rgba(11, 17, 14, 0.98));
        box-shadow:
          0 18px 40px rgba(0, 0, 0, 0.44),
          inset 0 1px 0 rgba(233, 249, 238, 0.08);
        padding: 12px 12px 14px;
        z-index: 7;
      }

      .theater-room-completion-popup--right {
        left: calc(100% + 18px);
        transform: translateY(-50%);
      }

      .theater-room-completion-popup--left {
        right: calc(100% + 18px);
        transform: translateY(-50%);
      }

      .theater-room-completion-title {
        font-size: 0.62rem;
        font-weight: 900;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #8cdb9e;
      }

      .theater-room-completion-room {
        margin-top: 4px;
        font-size: 0.92rem;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #edf7f0;
      }

      .theater-room-completion-copy {
        margin-top: 8px;
        color: #d7e7dc;
        font-size: 0.74rem;
        line-height: 1.45;
      }

      .theater-completion-recap {
        margin-top: 12px;
        display: grid;
        gap: 8px;
      }

      .theater-completion-line {
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        padding: 10px 12px;
        font-size: 0.68rem;
        line-height: 1.42;
        color: #d5e0d8;
      }

      .theater-completion-reward-grid {
        margin-top: 12px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .theater-completion-reward-item {
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(0, 0, 0, 0.18);
        padding: 10px 12px;
      }

      .theater-completion-reward-item span {
        display: block;
        font-size: 0.58rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(201, 223, 208, 0.7);
      }

      .theater-completion-reward-item strong {
        display: block;
        margin-top: 5px;
        font-size: 0.82rem;
        color: #f0f6f1;
      }

      .theater-room-completion-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .theater-room-completion-actions .theater-room-assault-btn {
        flex: 1 1 auto;
      }

      .theater-room-completion-note {
        margin-top: 10px;
        font-size: 0.62rem;
        letter-spacing: 0.08em;
        line-height: 1.4;
        color: rgba(196, 212, 200, 0.7);
      }

      .theater-link--selected {
        filter: drop-shadow(0 0 8px rgba(255, 214, 120, 0.7));
        stroke-width: 4px;
      }

      .theater-link--annex {
        stroke-dasharray: none;
        opacity: 0.8;
      }

      .theater-link-door__badge {
        fill: rgba(35, 42, 49, 0.92);
        stroke: rgba(255, 214, 120, 0.72);
        stroke-width: 1.5px;
      }

      .theater-link-door__badge--closed {
        fill: rgba(108, 42, 36, 0.94);
        stroke: rgba(255, 130, 110, 0.9);
      }

      .theater-link-door__badge--open {
        fill: rgba(42, 88, 66, 0.94);
        stroke: rgba(153, 233, 188, 0.8);
      }

      .theater-link-door__label {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-anchor: middle;
        fill: #f8f3e9;
        pointer-events: none;
      }

      .theater-annex-node {
        position: absolute;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        gap: 6px;
        border-radius: 16px;
        border: 1px solid rgba(154, 170, 181, 0.42);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0)),
          linear-gradient(180deg, rgba(31, 39, 43, 0.97), rgba(18, 24, 28, 0.97));
        box-shadow:
          0 16px 36px rgba(0, 0, 0, 0.34),
          inset 0 1px 0 rgba(255, 255, 255, 0.08);
        padding: 10px 12px 12px;
        color: #ecf2f6;
        z-index: 4;
      }

      .theater-annex-node--selected {
        border-color: rgba(255, 214, 120, 0.92);
        box-shadow:
          0 18px 38px rgba(0, 0, 0, 0.42),
          0 0 0 1px rgba(255, 214, 120, 0.34);
      }

      .theater-annex-node--current {
        border-color: rgba(155, 244, 188, 0.92);
      }

      .theater-annex-node--offline {
        opacity: 0.58;
      }

      .theater-annex-node__kicker,
      .theater-annex-node__parent,
      .theater-annex-node__door {
        font-size: 0.58rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .theater-annex-node__kicker {
        color: rgba(209, 223, 233, 0.72);
      }

      .theater-annex-node__title {
        font-size: 0.82rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .theater-annex-node__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        font-size: 0.62rem;
        color: rgba(219, 230, 237, 0.78);
      }

      .theater-annex-node__door--closed {
        color: #ffb3a2;
      }

      .theater-annex-node__door--open {
        color: #a9e7ba;
      }

      .theater-annex-build-grid,
      .theater-module-grid,
      .theater-partition-list {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }

      .theater-annex-build-row {
        display: grid;
        grid-template-columns: 84px repeat(3, minmax(0, 1fr));
        gap: 8px;
        align-items: start;
      }

      .theater-annex-build-row__edge {
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--all-nodes-muted, rgba(223, 211, 242, 0.68));
        padding-top: 9px;
      }

      .theater-module-card {
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(0, 0, 0, 0.18);
        padding: 12px;
        display: grid;
        gap: 10px;
      }

      .theater-module-card__header,
      .theater-module-card__meta,
      .theater-module-card__form {
        display: grid;
        gap: 8px;
      }

      .theater-module-card__header {
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: start;
      }

      .theater-module-card__kicker {
        font-size: 0.58rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--all-nodes-muted, rgba(223, 211, 242, 0.68));
      }

      .theater-module-card__title {
        margin: 3px 0 0;
        font-size: 0.84rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .theater-module-card__signal {
        font-size: 0.62rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #ffcf7d;
      }

      .theater-module-card__copy,
      .theater-module-card__meta {
        font-size: 0.68rem;
        line-height: 1.45;
        color: rgba(228, 233, 239, 0.8);
      }

      .theater-module-card__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .theater-module-card__form {
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      }

      .theater-module-card__field {
        display: grid;
        gap: 5px;
        font-size: 0.62rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(214, 224, 231, 0.7);
      }

      .theater-module-card__field select,
      .theater-module-card__field input {
        width: 100%;
        min-height: 34px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(14, 18, 22, 0.72);
        color: #eef4f7;
        padding: 8px 10px;
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

function isTextEntryElement(target: HTMLElement | null): boolean {
  if (!target) {
    return false;
  }

  return Boolean(target.closest(
    "textarea, select, [contenteditable='true'], input:not([type='button']):not([type='submit']):not([type='reset']):not([type='checkbox']):not([type='radio'])",
  ));
}

function ensureDragDocumentListeners(): void {
  if (dragMoveHandler && dragUpHandler) {
    return;
  }

  dragMoveHandler = (event: MouseEvent) => {
    if (activeDragSession) {
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
      return;
    }

    if (activeMapPanSession) {
      const dxFromStart = event.clientX - activeMapPanSession.startX;
      const dyFromStart = event.clientY - activeMapPanSession.startY;
      if (!activeMapPanSession.activated && Math.hypot(dxFromStart, dyFromStart) < 6) {
        return;
      }

      if (!activeMapPanSession.activated) {
        activeMapPanSession.activated = true;
        document.body.style.userSelect = "none";
      }

      const dx = event.clientX - activeMapPanSession.lastX;
      const dy = event.clientY - activeMapPanSession.lastY;
      activeMapPanSession.lastX = event.clientX;
      activeMapPanSession.lastY = event.clientY;
      panMapBy(dx, dy);
      return;
    }

    if (!activeSquadUnitDragSession) {
      return;
    }

    const dx = event.clientX - activeSquadUnitDragSession.startX;
    const dy = event.clientY - activeSquadUnitDragSession.startY;
    if (!activeSquadUnitDragSession.activated && Math.hypot(dx, dy) < 6) {
      return;
    }

    if (!activeSquadUnitDragSession.activated) {
      activeSquadUnitDragSession.activated = true;
      activeSquadUnitDragSession.sourceElement.classList.add("theater-squad-card__unit--dragging");
      document.body.style.userSelect = "none";
    }

    updateTheaterSquadDragPreviewPosition(event.clientX, event.clientY);
    updateTheaterSquadDropTarget(event.clientX, event.clientY);
  };

  dragUpHandler = (_event: MouseEvent) => {
    if (activeDragSession) {
      activeDragSession = null;
      document.body.style.userSelect = "";
      persistTheaterUiLayoutToState();
      return;
    }

    if (activeMapPanSession) {
      if (activeMapPanSession.activated) {
        suppressTheaterMapClickUntil = performance.now() + 160;
      }
      activeMapPanSession = null;
      document.body.style.userSelect = "";
      return;
    }

    if (!activeSquadUnitDragSession) {
      return;
    }

    const completedDrag = activeSquadUnitDragSession.activated
      && activeSquadUnitDragSession.hoveredIsValid
      && Boolean(activeSquadUnitDragSession.hoveredSquadId);
    const fromSquadId = activeSquadUnitDragSession.fromSquadId;
    const unitId = activeSquadUnitDragSession.unitId;
    const targetSquadId = activeSquadUnitDragSession.hoveredSquadId;

    clearTheaterSquadUnitDragSession();

    if (!completedDrag || !targetSquadId) {
      return;
    }

    const outcome = transferUnitBetweenSquads(getGameState(), fromSquadId, targetSquadId, unitId);
    updateGameState(() => outcome.state);
    if (!outcome.success) {
      alert(outcome.message);
    }
    renderTheaterCommandScreen();
  };

  document.addEventListener("mousemove", dragMoveHandler);
  document.addEventListener("mouseup", dragUpHandler);
}

function syncThreatPings(theater: TheaterNetworkState, mountSignature: string): void {
  const activeThreats = theater.activeThreats.filter((threat) => threat.active);
  if (lastMountedTheaterSignature !== mountSignature) {
    seenThreatIds = new Set(
      activeThreats
        .filter((threat) => theater.rooms[threat.currentRoomId]?.commsVisible)
        .map((threat) => threat.id),
    );
    return;
  }

  activeThreats.forEach((threat) => {
    if (seenThreatIds.has(threat.id)) {
      return;
    }

    const room = theater.rooms[threat.currentRoomId] ?? theater.rooms[threat.roomId];
    if (!room?.commsVisible) {
      return;
    }

    const hasReachedControlledRoom = room.secured || room.underThreat;
    showSystemPing({
      type: hasReachedControlledRoom ? "error" : "info",
      title: hasReachedControlledRoom ? "Room Under Siege" : "Enemy Patrol Sighted",
      message: hasReachedControlledRoom
        ? `${room.label} is under threat.`
        : `${room.label} contains a visible hostile patrol.`,
      detail: hasReachedControlledRoom
        ? "Travel back to the room and launch a defense battle."
        : "Track the patrol route and intercept before it reaches a secured position.",
      channel: "theater-threat",
      replaceChannel: true,
      durationMs: 4200,
    });
    seenThreatIds.add(threat.id);
  });

  const nextThreatIds = new Set(activeThreats.map((threat) => threat.id));
  seenThreatIds = new Set([...seenThreatIds].filter((id) => nextThreatIds.has(id)));
}

function isSandboxEventEntry(entry: string): boolean {
  return (
    entry.includes("Overheat detected in room(")
    || entry.includes("overheating severity increased")
    || entry.includes("Route telemetry in room(")
    || entry.includes("High comms signature in room(")
    || entry.includes("Signal bloom in room(")
    || entry.includes("Smoke buildup detected in room(")
    || entry.includes("Supply fire risk rising in room(")
    || entry.includes("Ignition in room(")
    || entry.includes("fire intensity increased")
    || entry.includes("Structural stress compromised room(")
    || entry.includes("Structural stress rising in room(")
    || entry.includes("Annex(") && (entry.includes("lost integrity under room fire") || entry.includes("collapsed from thermal stress"))
    || entry.includes("Scavenger activity rising in room(")
    || entry.includes("Scavenger raiders reached room(")
    || entry.includes("Scavengers skimmed ")
    || entry.includes("Scavenger bands shifted from room(")
    || entry.includes("Supply starvation triggered enemy migration")
    || entry.includes("Enemy presence collapsed inward from room(")
  );
}

function getNewRecentEvents(current: string[], previous: string[]): string[] {
  for (let offset = 0; offset <= current.length; offset += 1) {
    let matches = true;
    const comparableLength = Math.min(previous.length, current.length - offset);
    for (let index = 0; index < comparableLength; index += 1) {
      if (current[offset + index] !== previous[index]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return current.slice(0, offset);
    }
  }
  return current.slice(0, Math.max(0, current.length - previous.length));
}

function syncSandboxPings(theater: TheaterNetworkState, mountSignature: string): void {
  const sandboxEvents = theater.recentEvents.filter(isSandboxEventEntry);
  if (lastMountedTheaterSignature !== mountSignature) {
    sandboxEventSnapshot = [...sandboxEvents];
    return;
  }

  const newEvents = getNewRecentEvents(sandboxEvents, sandboxEventSnapshot);
  newEvents
    .slice()
    .reverse()
    .forEach((entry) => {
      let title = "System Alert";
      let type: "info" | "error" = "info";
      let detail = "Theater conditions have shifted.";

      if (entry.includes("Overheat detected")) {
        title = "Overheat Detected";
        type = "error";
        detail = "Power has pushed the room into an unstable thermal state.";
      } else if (entry.includes("overheating severity increased")) {
        title = "Overheat Escalating";
        type = "error";
        detail = "Combined power and supply load are intensifying room instability.";
      } else if (entry.includes("Route telemetry in room(")) {
        title = "Route Noise";
        detail = "High power is corrupting route telemetry with phantom pathing.";
      } else if (entry.includes("High comms signature")) {
        title = "Enemy Attraction Rising";
        detail = "High-bandwidth output is drawing more hostile attention.";
      } else if (entry.includes("Signal bloom in room(")) {
        title = "Signal Bloom";
        detail = "False telemetry is leaking out of this room's signature bloom.";
      } else if (entry.includes("Smoke buildup detected")) {
        title = "Smoke Buildup";
        type = "error";
        detail = "Environmental smoke is spreading through open passages.";
      } else if (entry.includes("Supply fire risk rising")) {
        title = "Fire Risk Rising";
        type = "error";
        detail = "Heat and dense supply are making the room volatile.";
      } else if (entry.includes("Ignition in room(")) {
        title = "Room Fire";
        type = "error";
        detail = "The room has ignited. Containment and emergency dumping may limit the spread.";
      } else if (entry.includes("fire intensity increased")) {
        title = "Fire Intensifying";
        type = "error";
        detail = "Thermal conditions in the room are worsening.";
      } else if (entry.includes("Structural stress rising")) {
        title = "Structural Stress";
        type = "error";
        detail = "Heat and annex load are starting to compromise the room shell.";
      } else if (entry.includes("Structural stress compromised room(")) {
        title = "Room Shell Damaged";
        type = "error";
        detail = "The room has taken structural damage from sustained thermal stress.";
      } else if (entry.includes("lost integrity under room fire")) {
        title = "Annex Integrity Lost";
        type = "error";
        detail = "A child annex is taking heat damage from the burning room.";
      } else if (entry.includes("collapsed from thermal stress")) {
        title = "Annex Collapse";
        type = "error";
        detail = "A heated annex branch has failed structurally.";
      } else if (entry.includes("Scavenger activity rising")) {
        title = "Scavengers Sighted";
        detail = "Loose bands are moving toward a rich room.";
      } else if (entry.includes("Scavenger raiders reached")) {
        title = "Scavenger Raid";
        type = "error";
        detail = "Scavengers are now actively stripping the room.";
      } else if (entry.includes("Scavengers skimmed")) {
        title = "Resources Skimmed";
        type = "error";
        detail = "Ungarded supply flow is being stolen out of the network.";
      } else if (entry.includes("Scavenger bands shifted")) {
        title = "Scavenger Migration";
        detail = "Scavenger bands have relocated toward a richer room.";
      } else if (entry.includes("Supply starvation triggered enemy migration")) {
        title = "Enemy Migration";
        detail = "Starved hostile presence is collapsing inward toward better support.";
      } else if (entry.includes("Enemy presence collapsed inward")) {
        title = "Enemy Relocation";
        detail = "Hostile pressure has been reassigned to a better-supported room.";
      }

      showSystemPing({
        type,
        title,
        message: entry,
        detail,
        channel: "theater-sandbox",
        replaceChannel: true,
        durationMs: 4600,
      });
    });

  sandboxEventSnapshot = [...sandboxEvents];
}

function cleanupTheaterMapControls(): void {
  clearTheaterSquadUnitDragSession();
  activeMapPanSession = null;
  suppressTheaterMapClickUntil = 0;

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

  if (theaterMoveButtonClickHandler) {
    document.removeEventListener("click", theaterMoveButtonClickHandler, true);
    theaterMoveButtonClickHandler = null;
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
      const panSpeedMultiplier = mapPanKeys.has("shift") ? MAP_SHIFT_PAN_MULTIPLIER : 1;
      const stepSize = MAP_PAN_STEP * 0.24 * panSpeedMultiplier;
      if (mapPanKeys.has("w") || mapPanKeys.has("arrowup")) dy += stepSize;
      if (mapPanKeys.has("s") || mapPanKeys.has("arrowdown")) dy -= stepSize;
      if (mapPanKeys.has("a") || mapPanKeys.has("arrowleft")) dx += stepSize;
      if (mapPanKeys.has("d") || mapPanKeys.has("arrowright")) dx -= stepSize;

      const stickDelta = readGamepadPanDelta();
      dx += stickDelta.dx * panSpeedMultiplier;
      dy += stickDelta.dy * panSpeedMultiplier;
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
      if (isTextEntryElement(target)) {
        return;
      }

      const key = event.key?.toLowerCase();
      if (
        key === "shift"
        || key === "w"
        || key === "s"
        || key === "a"
        || key === "d"
        || key === "arrowup"
        || key === "arrowdown"
        || key === "arrowleft"
        || key === "arrowright"
      ) {
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
  stopHoldPositionWait();
  cleanupTheaterMapControls();
  travelAnimation = null;
  pendingBattleConfirmation = null;
  theaterExitConfirmState = null;
  lastMountedTheaterSignature = null;
  hydratedTheaterLayoutSignature = null;
  seenThreatIds = new Set();

  const activeOperation = getGameState().operation;
  const isOpsAtlasSector = isOpsTerminalAtlasOperation(activeOperation);
  if (isOpsAtlasSector) {
    syncOpsTerminalOperationState(activeOperation);
  }

  if (clearOperation || isOpsAtlasSector) {
    updateGameState((state) => withPendingBattleConfirmationInState({
      ...clearCurrentTheaterOperationInjuries(state),
      phase: "field",
      operation: null,
      currentBattle: null,
    }, null));
  } else {
    updateGameState((state) => withPendingBattleConfirmationInState(state, null));
  }

  import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
    renderFieldScreen("base_camp");
  });
}

function teardownTheaterSurfaceState(): void {
  clearTravelTimer();
  stopHoldPositionWait();
  cleanupTheaterMapControls();
  travelAnimation = null;
  pendingBattleConfirmation = null;
  theaterExitConfirmState = null;
  lastMountedTheaterSignature = null;
  hydratedTheaterLayoutSignature = null;
  seenThreatIds = new Set();
}

function isFinalAtlasFloorCompletion(operation: GameState["operation"]): boolean {
  if (!isOpsTerminalAtlasOperation(operation)) {
    return false;
  }

  const preparedOperation = ensureOperationHasTheater(operation);
  const theater = preparedOperation?.theater;
  return Boolean(
    theater
    && theater.objectiveComplete
    && theater.completion
    && theater.definition.floorOrdinal >= CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL,
  );
}

function maybeShowEndingPlaceholderBeforePostgame(
  operation: GameState["operation"],
  onContinue: () => void,
): void {
  if (!isFinalAtlasFloorCompletion(operation)) {
    onContinue();
    return;
  }

  if (operation) {
    syncOpsTerminalOperationState(operation);
  }
  unlockCampaignPostgame();
  if (hasSeenEndingCutscene()) {
    onContinue();
    return;
  }

  teardownTheaterSurfaceState();
  import("./StoryPlaceholderScreen").then(({ renderStoryPlaceholderScreen }) => {
    renderStoryPlaceholderScreen({
      kind: "ending",
      onContinue: () => {
        markEndingCutsceneSeen();
        onContinue();
      },
    });
  });
}

function finalizeReturnToAtlasScreen(): void {
  teardownTheaterSurfaceState();

  const activeOperation = getGameState().operation;
  const isOpsAtlasSector = isOpsTerminalAtlasOperation(activeOperation);
  if (isOpsAtlasSector && activeOperation) {
    syncOpsTerminalOperationState(activeOperation);
  }

  updateGameState((state) => withPendingBattleConfirmationInState({
    ...state,
    phase: "field",
    currentBattle: null,
    operation: isOpsTerminalAtlasOperation(state.operation) ? null : state.operation,
  }, null));

  import("./OperationSelectScreen").then(({ renderOperationSelectScreen }) => {
    renderOperationSelectScreen("basecamp");
  });
}

function returnToAtlasScreen(): void {
  maybeShowEndingPlaceholderBeforePostgame(getGameState().operation, () => {
    finalizeReturnToAtlasScreen();
  });
}

function finalizeCompletedAtlasOperationReturn(): void {
  teardownTheaterSurfaceState();
  const operation = getGameState().operation;
  if (operation) {
    syncOpsTerminalOperationState(operation);
  }
  updateGameState((state) => withPendingBattleConfirmationInState({
    ...clearCurrentTheaterOperationInjuries(state),
    phase: "field",
    operation: null,
    currentBattle: null,
  }, null));
  import("./OperationSelectScreen").then(({ renderOperationSelectScreen }) => {
    renderOperationSelectScreen("basecamp");
  });
}

function openTheaterManageUnits(): void {
  clearTravelTimer();
  stopHoldPositionWait();
  cleanupTheaterMapControls();
  travelAnimation = null;
  import("./RosterScreen").then(({ renderRosterScreen }) => renderRosterScreen("operation"));
}

function getAssignedCoopTheaterSquadId(sourceSlot: SessionPlayerSlot | null | undefined): string | null {
  if (!sourceSlot) {
    return null;
  }
  const state = getGameState();
  return state.session.theaterAssignments?.[sourceSlot]?.squadId
    ?? state.session.players?.[sourceSlot]?.assignedSquadId
    ?? null;
}

function getPreparedActiveTheater(state: GameState): TheaterNetworkState | null {
  return getPreparedTheaterOperation(state)?.theater ?? state.operation?.theater ?? null;
}

function getPendingBattleConfirmationForSourceSlot(
  sourceSlot: SessionPlayerSlot | null | undefined,
): PendingBattleConfirmationState | null {
  if (!sourceSlot) {
    return pendingBattleConfirmation
      ?? clonePendingBattleConfirmation(getGameState().session.pendingTheaterBattleConfirmation);
  }
  return clonePendingBattleConfirmation(
    getPendingTheaterBattleConfirmationForSessionSlot(getGameState(), sourceSlot),
  );
}

function canSourceSlotResolvePendingBattle(
  sourceSlot: SessionPlayerSlot | null | undefined,
  pendingOverride?: PendingBattleConfirmationState | null,
): boolean {
  if (!sourceSlot) {
    return true;
  }
  const assignedSquadId = getAssignedCoopTheaterSquadId(sourceSlot);
  const activePending = pendingOverride ?? getPendingBattleConfirmationForSourceSlot(sourceSlot);
  return !activePending?.squadId || !assignedSquadId || activePending.squadId === assignedSquadId;
}

function launchTheaterBattle(roomId: string): void {
  const pending = pendingBattleConfirmation
    ?? clonePendingBattleConfirmation(getGameState().session.pendingTheaterBattleConfirmation);
  pendingBattleConfirmation = null;
  const state = updateGameState((current) => withPendingBattleConfirmationInState(current, null));
  stopHoldPositionWait();
  cleanupTheaterMapControls();
  const battle = createTheaterBattleState(state, roomId, pending?.squadId ?? null);
  if (!battle) {
    const theater = getPreparedActiveTheater(state);
    const initiatingSquad = theater
      ? (
        pending?.squadId
          ? theater.squads.find((squad) => squad.squadId === pending.squadId) ?? null
          : getSelectedTheaterSquad(theater)
      )
      : null;
    const readyCount = initiatingSquad
      ? initiatingSquad.unitIds.filter((unitId) => !isTheaterUnitIncapacitated(unitId, theater!)).length
      : 0;
    alert(readyCount <= 0
      ? "This squad has no combat-capable units. Move it to an operational Medical Ward to recover incapacitated operators."
      : "Unable to initialize theater battle for this room.");
    renderTheaterCommandScreen();
    return;
  }

  updateGameState((state) => {
    const activeTheater = getPreparedActiveTheater(state);
    const squadId = battle.theaterBonuses?.squadId ?? activeTheater?.selectedSquadId ?? null;
    const squad = squadId
      ? activeTheater?.squads.find((entry) => entry.squadId === squadId) ?? null
      : null;
    const nextUnitsById = { ...state.unitsById };
    squad?.unitIds.forEach((unitId) => {
      const unit = nextUnitsById[unitId];
      if (!unit || !unit.buffs || unit.buffs.length <= 0) {
        return;
      }
      nextUnitsById[unitId] = {
        ...unit,
        buffs: [],
      };
    });

    return {
      ...state,
      phase: "battle",
      unitsById: nextUnitsById,
      currentBattle: battle,
      session: {
        ...state.session,
        pendingTheaterBattleConfirmation: null,
      },
    };
  });

  import("./BattleScreen").then(({ renderBattleScreen }) => renderBattleScreen());
}

function getFieldSeedForTheaterRoom(roomId: string): number {
  return roomId.split("").reduce((seed, char, index) => (
    ((seed * 31) + char.charCodeAt(0) + index) >>> 0
  ), 1701);
}

function launchTheaterFieldRoom(roomId: string): void {
  clearTravelTimer();
  stopHoldPositionWait();
  cleanupTheaterMapControls();
  travelAnimation = null;
  pendingBattleConfirmation = null;
  updateGameState((state) => withPendingBattleConfirmationInState(state, null));
  import("./FieldNodeRoomScreen").then(({ renderFieldNodeRoomScreen }) => {
    renderFieldNodeRoomScreen(roomId, getFieldSeedForTheaterRoom(roomId), false, "theater");
  });
}

function queueTravelRouteAnimation(route: string[], segmentDurationMs: number, onComplete: () => void): void {
  if (route.length < 2) {
    onComplete();
    return;
  }

  const [fromNodeId, toNodeId, ...rest] = route;
  clearTravelTimer();
  travelAnimation = { fromNodeId, toNodeId, durationMs: segmentDurationMs };
  renderTheaterCommandScreen();

  travelTimerId = window.setTimeout(() => {
    travelTimerId = null;
    travelAnimation = null;
    if (rest.length > 0) {
      queueTravelRouteAnimation([toNodeId, ...rest], segmentDurationMs, onComplete);
      return;
    }
    onComplete();
  }, segmentDurationMs);
}

function scheduleHoldPositionTick(): void {
  clearHoldPositionTimer();
  if (!holdPositionActiveRoomId) {
    return;
  }

  holdPositionTimerId = window.setTimeout(() => {
    holdPositionTimerId = null;

    const activeOperation = getPreparedTheaterOperation(getGameState());
    const activeTheater = activeOperation?.theater;
    if (
      !activeTheater
      || !holdPositionActiveRoomId
      || activeTheater.currentRoomId !== holdPositionActiveRoomId
      || travelAnimation
      || pendingBattleConfirmation
    ) {
      stopHoldPositionWait();
      renderTheaterCommandScreen();
      return;
    }

    const holdOutcome = holdPositionInTheater(getGameState(), 1);
    const nextState =
      holdOutcome.tickCost > 0 && isOpsTerminalAtlasOperation(holdOutcome.state.operation)
        ? applyWarmTheaterEconomyToState(
            holdOutcome.state,
            activeTheater.definition.id,
            holdOutcome.tickCost,
          )
        : holdOutcome.state;
    updateGameState(() => withPendingBattleConfirmationInState(nextState, null));

    if (holdOutcome.error) {
      stopHoldPositionWait();
      alert(holdOutcome.error);
      renderTheaterCommandScreen();
      return;
    }

    if (holdOutcome.requiresBattle) {
      stopHoldPositionWait();
      pendingBattleConfirmation = {
        roomId: holdOutcome.roomId,
        previousRoomId: holdOutcome.roomId,
        roomLabel: getGameState().operation?.theater?.rooms[holdOutcome.roomId]?.label ?? holdOutcome.roomId,
        squadId: holdOutcome.squadId,
      };
      updateGameState((state) => withPendingBattleConfirmationInState(state, pendingBattleConfirmation));
      renderTheaterCommandScreen();
      return;
    }

    renderTheaterCommandScreen();
    if (holdPositionActiveRoomId) {
      scheduleHoldPositionTick();
    }
  }, HOLD_POSITION_TICK_MS);
}

function startHoldPositionWait(roomId: string): void {
  holdPositionActiveRoomId = roomId;
  scheduleHoldPositionTick();
}

function handleMoveToNode(nodeId: string): void {
  if (isRemoteCoopOperationsClient()) {
    playPlaceholderSfx("ui-move");
    void sendRemoteCoopTheaterCommand({ type: "move_to_room", roomId: nodeId });
    return;
  }
  const activeOperation = getPreparedTheaterOperation(getGameState());
  const activeTheater = activeOperation?.theater;
  if (!activeTheater) {
    renderTheaterCommandScreen();
    return;
  }

  const selectedNode = resolveTheaterNode(activeTheater, nodeId);
  const selectedRoom = selectedNode?.rootRoom ?? activeTheater.rooms[nodeId];
  const currentRoom = activeTheater.rooms[activeTheater.currentRoomId];
  const currentNodeId = activeTheater.currentNodeId ?? activeTheater.currentRoomId;
  const canHoldPosition = Boolean(
    currentRoom
    && selectedRoom
    && nodeId === currentNodeId
    && selectedRoom.secured
    && !selectedRoom.underThreat
    && !selectedRoom.damaged,
  );
  if (canHoldPosition) {
    if (isHoldPositionActiveForRoom(selectedRoom.id)) {
      stopHoldPositionWait();
      playPlaceholderSfx("ui-back");
    } else {
      startHoldPositionWait(selectedRoom.id);
      playPlaceholderSfx("ui-move");
    }
    renderTheaterCommandScreen();
    return;
  }

  stopHoldPositionWait();
  const fromRoomId = activeTheater.currentRoomId;
  const moveOutcome = moveToTheaterNode(getGameState(), nodeId);
  const nextState =
    moveOutcome.tickCost > 0 && isOpsTerminalAtlasOperation(moveOutcome.state.operation)
      ? applyWarmTheaterEconomyToState(
          moveOutcome.state,
          activeTheater.definition.id,
          moveOutcome.tickCost,
        )
      : moveOutcome.state;
  updateGameState(() => withPendingBattleConfirmationInState(nextState, null));

  if (moveOutcome.error) {
    alert(moveOutcome.error);
    renderTheaterCommandScreen();
    return;
  }

  if (fromRoomId !== moveOutcome.roomId || nodeId !== currentNodeId) {
    playPlaceholderSfx("ui-move");
  }

  const completeMove = () => {
    if (moveOutcome.requiresBattle) {
      pendingBattleConfirmation = {
        roomId: moveOutcome.roomId,
        previousRoomId: fromRoomId,
        roomLabel: getGameState().operation?.theater?.rooms[moveOutcome.roomId]?.label ?? moveOutcome.roomId,
        squadId: moveOutcome.squadId,
      };
      updateGameState((state) => withPendingBattleConfirmationInState(state, pendingBattleConfirmation));
      renderTheaterCommandScreen();
      return;
    }
    if (moveOutcome.requiresField) {
      launchTheaterFieldRoom(moveOutcome.roomId);
      return;
    }
    renderTheaterCommandScreen();
  };

  const travelNodePath = moveOutcome.nodePath ?? moveOutcome.path;
  if (nodeId !== currentNodeId && moveOutcome.tickCost > 0 && travelNodePath.length > 1) {
    const segmentDurationMs = Math.max(220, Math.round((420 + moveOutcome.tickCost * 220) / (travelNodePath.length - 1)));
    queueTravelRouteAnimation(travelNodePath, segmentDurationMs, completeMove);
    return;
  }

  completeMove();
}

function handleMoveToRoom(roomId: string): void {
  handleMoveToNode(roomId);
}

function descendToNextTheaterFloor(): void {
  clearTravelTimer();
  stopHoldPositionWait();
  cleanupTheaterMapControls();
  travelAnimation = null;
  pendingBattleConfirmation = null;

  const currentState = getGameState();
  const operation = getPreparedTheaterOperation(currentState);
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
    const activeOperation = getPreparedTheaterOperation(state);
    if (!activeOperation) {
      return state;
    }

    return withPendingBattleConfirmationInState({
      ...state,
      phase: "operation",
      currentBattle: null,
      operation: ensureOperationHasTheater({
        ...activeOperation,
        currentFloorIndex: nextFloorIndex,
        currentRoomId: null,
        theater: undefined,
      }),
    }, null);
  });

  renderTheaterCommandScreen();
}

function completeTheaterOperationAndReturn(): void {
  pendingBattleConfirmation = null;
  const operation = getGameState().operation;
  if (isOpsTerminalAtlasOperation(operation)) {
    maybeShowEndingPlaceholderBeforePostgame(operation, () => {
      finalizeCompletedAtlasOperationReturn();
    });
    return;
  }

  if (!isOpsTerminalAtlasOperation(operation)) {
    try {
      completeOperationRun();
    } catch (error) {
      console.warn("[THEATER] complete run without campaign record", error);
    }
  }
  returnToBaseCamp(true);
}

function attachCompletionHandlers(canDescend: boolean): void {
  if (canDescend) {
    document.getElementById("theaterCompletionAdvanceBtn")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      playPlaceholderSfx("ui-confirm");
      descendToNextTheaterFloor();
    });
    return;
  }

  document.getElementById("theaterCompletionReturnBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    playPlaceholderSfx("ui-confirm");
    completeTheaterOperationAndReturn();
  });
}

function attachPendingBattleHandlers(): void {
  document.getElementById("theaterConfirmBattleBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const pending = pendingBattleConfirmation;
    if (!pending) {
      return;
    }
    playPlaceholderSfx("ui-confirm");
    if (isRemoteCoopOperationsClient()) {
      void sendRemoteCoopTheaterCommand({ type: "confirm_pending_battle" });
      return;
    }
    launchTheaterBattle(pending.roomId);
  });

  document.getElementById("theaterFallbackBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const pending = pendingBattleConfirmation;
    if (!pending) {
      return;
    }
    playPlaceholderSfx("ui-back");
    if (isRemoteCoopOperationsClient()) {
      void sendRemoteCoopTheaterCommand({ type: "fallback_pending_battle" });
      return;
    }
    pendingBattleConfirmation = null;
    updateGameState((state) => withPendingBattleConfirmationInState(
      setTheaterCurrentRoom(state, pending.previousRoomId),
      null,
    ));
    renderTheaterCommandScreen();
  });

  document.getElementById("theaterRefuseDefenseBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const pending = pendingBattleConfirmation;
    if (!pending) {
      return;
    }
    playPlaceholderSfx("ui-back");
    if (isRemoteCoopOperationsClient()) {
      void sendRemoteCoopTheaterCommand({ type: "refuse_defense", roomId: pending.roomId });
      return;
    }
    pendingBattleConfirmation = null;
    const outcome = refuseTheaterDefense(getGameState(), pending.roomId);
    updateGameState(() => withPendingBattleConfirmationInState(outcome.state, null));
    if (!outcome.success) {
      alert(outcome.message);
    }
    renderTheaterCommandScreen();
  });
}

export function applyRemoteCoopTheaterCommand(
  command: CoopTheaterCommand,
  sourceSlot: SessionPlayerSlot | null,
): void {
  const state = getGameState();
  if (state.session.mode !== "coop_operations" || state.session.authorityRole !== "host") {
    return;
  }

  syncPendingBattleConfirmationFromSession(state);

  switch (command.type) {
    case "move_to_room": {
      if (!sourceSlot) {
        return;
      }
      const assignedSquadId = getAssignedCoopTheaterSquadId(sourceSlot);
      const stateWithAssignedSquad = assignedSquadId
        ? selectTheaterSquadForSessionSlot(state, sourceSlot, assignedSquadId).state
        : state;
      const sourceTheater = getPreparedTheaterOperationForSessionSlot(stateWithAssignedSquad, sourceSlot)?.theater ?? null;
      const fromRoomId = sourceTheater?.currentRoomId ?? command.roomId;
      const moveOutcome = issueTheaterRoomCommandForSessionSlot(stateWithAssignedSquad, sourceSlot, command.roomId);
      const scopedTheaterId =
        getPreparedTheaterOperationForSessionSlot(moveOutcome.state, sourceSlot)?.theater?.definition.id
        ?? sourceTheater?.definition.id
        ?? null;
      let nextState =
        scopedTheaterId && moveOutcome.tickCost > 0 && isOpsTerminalAtlasOperation(moveOutcome.state.operation)
          ? applyWarmTheaterEconomyToState(
              moveOutcome.state,
              scopedTheaterId,
              moveOutcome.tickCost,
            )
          : moveOutcome.state;

      if (moveOutcome.requiresBattle) {
        const pending: PendingBattleConfirmationState = {
          roomId: moveOutcome.roomId,
          previousRoomId: fromRoomId,
          roomLabel:
            getPreparedTheaterOperationForSessionSlot(nextState, sourceSlot)?.theater?.rooms[moveOutcome.roomId]?.label
            ?? moveOutcome.roomId,
          squadId: moveOutcome.squadId,
        };
        const scopedState = createScopedTheaterStateForSessionSlot(nextState, sourceSlot);
        if (scopedState) {
          nextState = mergeScopedTheaterStateForSessionSlot(
            nextState,
            withPendingBattleConfirmationInState(scopedState, pending),
            sourceSlot,
          );
        }
      }

      updateGameState(() => nextState);
      syncPendingBattleConfirmationFromSession(getGameState());
      if (document.body.getAttribute("data-screen") === "theater-command") {
        renderTheaterCommandScreen();
      }
      return;
    }
    case "confirm_pending_battle": {
      const pending = getPendingBattleConfirmationForSourceSlot(sourceSlot);
      if (!pending || !canSourceSlotResolvePendingBattle(sourceSlot)) {
        return;
      }
      if (!sourceSlot) {
        launchTheaterBattle(pending.roomId);
        return;
      }
      const scopedState = createScopedTheaterStateForSessionSlot(getGameState(), sourceSlot);
      if (!scopedState) {
        return;
      }
      const clearedScopedState = withPendingBattleConfirmationInState(scopedState, null);
      const battle = createTheaterBattleState(clearedScopedState, pending.roomId, pending.squadId ?? null);
      if (!battle) {
        const restoredState = mergeScopedTheaterStateForSessionSlot(getGameState(), clearedScopedState, sourceSlot);
        updateGameState(() => restoredState);
        syncPendingBattleConfirmationFromSession(getGameState());
        if (document.body.getAttribute("data-screen") === "theater-command") {
          renderTheaterCommandScreen();
        }
        return;
      }

      const activeTheater = getPreparedTheaterOperationForSessionSlot(clearedScopedState, sourceSlot)?.theater ?? null;
      const squadId = battle.theaterBonuses?.squadId ?? activeTheater?.selectedSquadId ?? null;
      const squad = squadId
        ? activeTheater?.squads.find((entry) => entry.squadId === squadId) ?? null
        : null;
      const nextUnitsById = { ...clearedScopedState.unitsById };
      squad?.unitIds.forEach((unitId) => {
        const unit = nextUnitsById[unitId];
        if (!unit?.buffs?.length) {
          return;
        }
        nextUnitsById[unitId] = {
          ...unit,
          buffs: [],
        };
      });

      const launchedScopedState: GameState = {
        ...clearedScopedState,
        phase: "battle",
        unitsById: nextUnitsById,
        currentBattle: battle,
        session: {
          ...clearedScopedState.session,
          pendingTheaterBattleConfirmation: null,
        },
      };
      const mergedState = mergeScopedTheaterStateForSessionSlot(getGameState(), launchedScopedState, sourceSlot);
      updateGameState(() => mergedState);
      syncPendingBattleConfirmationFromSession(getGameState());
      if (mergedState.currentBattle?.id === battle.id) {
        import("./BattleScreen").then(({ renderBattleScreen }) => renderBattleScreen());
      } else if (document.body.getAttribute("data-screen") === "theater-command") {
        renderTheaterCommandScreen();
      }
      return;
    }
    case "fallback_pending_battle": {
      const pending = getPendingBattleConfirmationForSourceSlot(sourceSlot);
      if (!pending || !canSourceSlotResolvePendingBattle(sourceSlot)) {
        return;
      }
      if (!sourceSlot) {
        pendingBattleConfirmation = null;
        updateGameState((current) => withPendingBattleConfirmationInState(
          setTheaterCurrentRoom(current, pending.previousRoomId),
          null,
        ));
      } else {
        const scopedState = createScopedTheaterStateForSessionSlot(getGameState(), sourceSlot);
        if (!scopedState) {
          return;
        }
        const nextScopedState = withPendingBattleConfirmationInState(
          setTheaterCurrentRoom(scopedState, pending.previousRoomId),
          null,
        );
        const mergedState = mergeScopedTheaterStateForSessionSlot(getGameState(), nextScopedState, sourceSlot);
        updateGameState(() => mergedState);
      }
      syncPendingBattleConfirmationFromSession(getGameState());
      if (document.body.getAttribute("data-screen") === "theater-command") {
        renderTheaterCommandScreen();
      }
      return;
    }
    case "refuse_defense": {
      const pending = getPendingBattleConfirmationForSourceSlot(sourceSlot);
      if (pending && !canSourceSlotResolvePendingBattle(sourceSlot)) {
        return;
      }
      const targetRoomId = command.roomId ?? pending?.roomId ?? null;
      if (!targetRoomId) {
        return;
      }
      if (!sourceSlot) {
        const outcome = refuseTheaterDefense(getGameState(), targetRoomId);
        pendingBattleConfirmation = pending?.roomId === targetRoomId ? null : pendingBattleConfirmation;
        updateGameState(() => withPendingBattleConfirmationInState(
          outcome.state,
          pendingBattleConfirmation,
        ));
      } else {
        const scopedState = createScopedTheaterStateForSessionSlot(getGameState(), sourceSlot);
        if (!scopedState) {
          return;
        }
        const outcome = refuseTheaterDefense(scopedState, targetRoomId);
        const nextScopedState = pending?.roomId === targetRoomId
          ? withPendingBattleConfirmationInState(outcome.state, null)
          : outcome.state;
        const mergedState = mergeScopedTheaterStateForSessionSlot(getGameState(), nextScopedState, sourceSlot);
        updateGameState(() => mergedState);
      }
      syncPendingBattleConfirmationFromSession(getGameState());
      if (document.body.getAttribute("data-screen") === "theater-command") {
        renderTheaterCommandScreen();
      }
      return;
    }
    default:
      return;
  }
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

  document.querySelectorAll<HTMLElement>("[data-theater-window-close]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const key = button.getAttribute("data-theater-window-close") as TheaterWindowKey | null;
      if (key !== "automation") return;
      theaterControllerActiveWindowKey = "room";
      setAutomationWindowOpen(false);
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
      if (target?.closest("[data-theater-window-minimize], [data-theater-window-color], [data-theater-window-close]")) {
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

  document.querySelectorAll<HTMLElement>("[data-theater-map-mode]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const mode = button.getAttribute("data-theater-map-mode");
      if (mode !== "command" && mode !== "supply" && mode !== "power" && mode !== "comms") {
        return;
      }
      theaterMapMode = mode;
      persistTheaterUiLayoutToState();
      renderTheaterCommandScreen();
    });
  });

  document.getElementById("theaterMapWrap")?.addEventListener("click", (event) => {
    if (performance.now() < suppressTheaterMapClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (pendingBattleConfirmation) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const nodeElement = target.closest<HTMLElement>("[data-theater-node-id]");
    if (!nodeElement) {
      return;
    }

    const nodeId = nodeElement.getAttribute("data-theater-node-id");
    if (!nodeId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const currentOperation = getPreparedTheaterOperation(getGameState());
    const currentTheater = currentOperation?.theater;
    const selectedNode = currentTheater ? getSelectedNode(currentTheater) : null;
    if (selectedNode?.id === nodeId && currentTheater) {
      const moveState = getNodeMoveButtonState(currentTheater, nodeId);
        if (!moveState.disabled) {
          console.log("[THEATER] node move requested", nodeId);
          handleMoveToNode(nodeId);
          return;
        }
    }

    if (theaterTacticalFullscreenActive) {
      setTheaterTacticalFullscreen(false);
      skipNextTheaterWindowFrameCapture = true;
    }
    corePanelTab = "room";
    selectedRoomAdvancedOpen = false;
    persistTheaterUiLayoutToState();
    updateGameState((state) => setTheaterSelectedNode(state, nodeId));
    console.log("[THEATER] node selected", nodeId);
    renderTheaterCommandScreen();
  });

  document.getElementById("theaterMapWrap")?.addEventListener("mousedown", (event) => {
    if (event.button !== 0 || activeDragSession || activeSquadUnitDragSession || travelAnimation) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest("button, input, textarea, select, a, [contenteditable='true'], .theater-map-zoom-controls")) {
      return;
    }

    activeMapPanSession = {
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      activated: false,
    };
    event.preventDefault();
  });

  if (theaterMoveButtonClickHandler) {
    document.removeEventListener("click", theaterMoveButtonClickHandler, true);
  }
  theaterMoveButtonClickHandler = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const moveButton = target.closest<HTMLElement>("[data-theater-move-button]");
    if (!moveButton) {
      return;
    }

    const nodeId = moveButton.getAttribute("data-theater-move-button");
    if (!nodeId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    console.log("[THEATER] move requested", nodeId);
    handleMoveToNode(nodeId);
  };
  document.addEventListener("click", theaterMoveButtonClickHandler, true);

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
    openTheaterManageUnits();
  });

  document.querySelectorAll<HTMLElement>("[data-theater-manage-unit-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const unitId = button.getAttribute("data-theater-manage-unit-id");
      if (!unitId) {
        return;
      }
      theaterManageSelectedUnitId = unitId;
      renderTheaterCommandScreen();
    });
  });

  document.getElementById("theaterReturnToBaseBtn")?.addEventListener("click", () => {
    openTheaterExitConfirm();
  });

  document.querySelectorAll<HTMLElement>("[data-theater-exit-confirm-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const action = button.getAttribute("data-theater-exit-confirm-action");
      if (action === "accept") {
        resolveTheaterExitConfirm();
      } else {
        closeTheaterExitConfirm();
      }
    });
  });

  document.getElementById("theaterExitConfirmModal")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      closeTheaterExitConfirm();
    }
  });

  document.querySelectorAll<HTMLElement>("[data-theater-consumable-use]").forEach((button) => {
    button.addEventListener("click", () => {
      const consumableId = button.getAttribute("data-theater-consumable-use");
      const targetUnitId = button.getAttribute("data-theater-consumable-target");
      if (!consumableId || !targetUnitId) {
        return;
      }

      const outcome = useTheaterConsumable(getGameState(), targetUnitId, consumableId);
      updateGameState(() => outcome.state);
      showSystemPing({
        type: outcome.success ? "info" : "error",
        title: outcome.success ? "Consumable Used" : "Consumable Unavailable",
        message: outcome.message,
        channel: "theater-consumables",
      });
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-fortify]").forEach((button) => {
    button.addEventListener("click", () => {
      const fortification = button.getAttribute("data-theater-fortify") as FortificationType | null;
      if (!fortification || !getOrderedSchemaFortificationTypes().includes(fortification)) {
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

  document.querySelectorAll<HTMLElement>("[data-theater-core-field-room]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const roomId = button.getAttribute("data-theater-core-field-room");
      if (!roomId) {
        return;
      }
      launchTheaterFieldRoom(roomId);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-core-repair]").forEach((button) => {
    button.addEventListener("click", () => {
      const roomId = button.getAttribute("data-theater-core-repair");
      if (!roomId) {
        return;
      }

      const outcome = repairTheaterCore(getGameState(), roomId);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-core-destroy]").forEach((button) => {
    button.addEventListener("click", () => {
      const roomId = button.getAttribute("data-theater-core-destroy");
      const slotIndex = Number(button.getAttribute("data-theater-core-slot") ?? "-1");
      if (!roomId || Number.isNaN(slotIndex) || slotIndex < 0) {
        return;
      }

      const outcome = destroyTheaterCore(getGameState(), roomId, slotIndex);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-fortification-destroy]").forEach((button) => {
    button.addEventListener("click", () => {
      const roomId = button.getAttribute("data-theater-fortification-destroy");
      const fortificationType = button.getAttribute("data-theater-fortification-type") as FortificationType | null;
      if (!roomId || !fortificationType) {
        return;
      }

      const outcome = destroyTheaterFortification(getGameState(), roomId, fortificationType);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-annex-destroy]").forEach((button) => {
    button.addEventListener("click", () => {
      const annexId = button.getAttribute("data-theater-annex-destroy");
      if (!annexId) {
        return;
      }

      const outcome = destroyTheaterAnnex(getGameState(), annexId);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-select-node]").forEach((button) => {
    button.addEventListener("click", () => {
      const nodeId = button.getAttribute("data-theater-select-node");
      if (!nodeId) {
        return;
      }
      if (theaterTacticalFullscreenActive) {
        setTheaterTacticalFullscreen(false);
        skipNextTheaterWindowFrameCapture = true;
      }
      corePanelTab = "room";
      selectedRoomAdvancedOpen = false;
      persistTheaterUiLayoutToState();
      updateGameState((state) => {
        const nextState = setTheaterSelectedNode(state, nodeId);
        return {
          ...nextState,
          uiLayout: {
            ...(nextState.uiLayout ?? state.uiLayout ?? {}),
            theaterCommandSelectedAnnexId: resolveTheaterNode(theater, nodeId)?.kind === "annex" ? nodeId : null,
          },
        };
      });
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-annex-build]").forEach((button) => {
    button.addEventListener("click", () => {
      const parentNodeId = button.getAttribute("data-theater-annex-build");
      const frameType = button.getAttribute("data-theater-annex-frame") as AnnexFrameType | null;
      const edge = button.getAttribute("data-theater-annex-edge") as AnnexAttachmentEdge | null;
      if (!parentNodeId || !frameType || !edge) {
        return;
      }
      const outcome = buildTheaterAnnex(getGameState(), parentNodeId, frameType, edge);
      updateGameState((state) => ({
        ...outcome.state,
        uiLayout: {
          ...(outcome.state.uiLayout ?? state.uiLayout ?? {}),
          theaterCommandSelectedAnnexId: outcome.success ? outcome.state.operation?.theater?.selectedNodeId ?? null : state.uiLayout?.theaterCommandSelectedAnnexId ?? null,
        },
      }));
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-open-automation-window]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setTheaterWindowMinimized("automation", false);
      focusWindow("automation");
      setAutomationWindowOpen(true);
      persistTheaterUiLayoutToState();
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-upgrade-module-slots]").forEach((button) => {
    button.addEventListener("click", () => {
      const roomId = button.getAttribute("data-theater-upgrade-module-slots");
      if (!roomId) {
        return;
      }
      const outcome = upgradeTheaterRoomModuleSlots(getGameState(), roomId);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-install-module]").forEach((button) => {
    button.addEventListener("click", () => {
      const nodeId = button.getAttribute("data-theater-install-module");
      const moduleType = button.getAttribute("data-theater-module-type") as AutomationModuleType | null;
      if (!nodeId || !moduleType) {
        return;
      }
      const outcome = installTheaterModule(getGameState(), nodeId, moduleType);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-module-apply]").forEach((button) => {
    button.addEventListener("click", () => {
      const moduleId = button.getAttribute("data-theater-module-apply");
      if (!moduleId) {
        return;
      }
      const config = {
        monitorTarget: (() => {
          const value = (document.getElementById(`theaterModuleTarget_${moduleId}`) as HTMLSelectElement | null)?.value ?? "";
          return value ? { kind: "node" as const, nodeId: value } : undefined;
        })(),
        target: (() => {
          const nodeValue = (document.getElementById(`theaterModuleTarget_${moduleId}`) as HTMLSelectElement | null)?.value ?? "";
          const edgeValue = (document.getElementById(`theaterModuleEdge_${moduleId}`) as HTMLSelectElement | null)?.value ?? "";
          if (edgeValue) {
            return { kind: "edge" as const, edgeId: edgeValue };
          }
          if (nodeValue) {
            return { kind: "node" as const, nodeId: nodeValue };
          }
          return undefined;
        })(),
        inputModuleIds: [
          (document.getElementById(`theaterModuleInputA_${moduleId}`) as HTMLSelectElement | null)?.value ?? "",
          (document.getElementById(`theaterModuleInputB_${moduleId}`) as HTMLSelectElement | null)?.value ?? "",
        ].filter(Boolean),
        comparison: ((document.getElementById(`theaterModuleComparison_${moduleId}`) as HTMLSelectElement | null)?.value as ">=" | "<=" | "") || undefined,
        threshold: (() => {
          const value = (document.getElementById(`theaterModuleThreshold_${moduleId}`) as HTMLInputElement | null)?.value;
          return value ? Number(value) : undefined;
        })(),
        delayTicks: (() => {
          const value = (document.getElementById(`theaterModuleDelay_${moduleId}`) as HTMLInputElement | null)?.value;
          return value ? Number(value) : undefined;
        })(),
        transferAmount: (() => {
          const value = (document.getElementById(`theaterModuleTransfer_${moduleId}`) as HTMLInputElement | null)?.value;
          return value ? Number(value) : undefined;
        })(),
        floorAmount: (() => {
          const value = (document.getElementById(`theaterModuleFloor_${moduleId}`) as HTMLInputElement | null)?.value;
          return value ? Number(value) : undefined;
        })(),
        desiredDoorState: (((document.getElementById(`theaterModuleDoorState_${moduleId}`) as HTMLSelectElement | null)?.value ?? "") as "open" | "closed" | "") || undefined,
      };
      const outcome = configureTheaterModule(getGameState(), moduleId, config);
      updateGameState((state) => ({
        ...outcome.state,
        uiLayout: {
          ...(outcome.state.uiLayout ?? state.uiLayout ?? {}),
          theaterCommandSelectedModuleId: moduleId,
        },
      }));
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-module-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      const moduleId = button.getAttribute("data-theater-module-reset");
      if (!moduleId) {
        return;
      }
      const outcome = resetTheaterModuleState(getGameState(), moduleId);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-module-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const moduleId = button.getAttribute("data-theater-module-remove");
      if (!moduleId) {
        return;
      }
      const outcome = removeTheaterModule(getGameState(), moduleId);
      updateGameState((state) => ({
        ...outcome.state,
        uiLayout: {
          ...(outcome.state.uiLayout ?? state.uiLayout ?? {}),
          theaterCommandSelectedModuleId: state.uiLayout?.theaterCommandSelectedModuleId === moduleId ? null : state.uiLayout?.theaterCommandSelectedModuleId ?? null,
        },
      }));
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-install-partition-node-a]").forEach((button) => {
    button.addEventListener("click", () => {
      const nodeAId = button.getAttribute("data-theater-install-partition-node-a");
      const nodeBId = button.getAttribute("data-theater-install-partition-node-b");
      const partitionType = button.getAttribute("data-theater-partition-type") as PartitionType | null;
      if (!nodeAId || !nodeBId || !partitionType) {
        return;
      }
      const outcome = installTheaterPartition(getGameState(), nodeAId, nodeBId, partitionType);
      updateGameState((state) => ({
        ...outcome.state,
        uiLayout: {
          ...(outcome.state.uiLayout ?? state.uiLayout ?? {}),
          theaterCommandSelectedEdgeId: outcome.success ? getTheaterEdgeId(nodeAId, nodeBId) : state.uiLayout?.theaterCommandSelectedEdgeId ?? null,
        },
      }));
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-toggle-partition]").forEach((button) => {
    button.addEventListener("click", () => {
      const edgeId = button.getAttribute("data-theater-toggle-partition");
      if (!edgeId) {
        return;
      }
      const outcome = toggleTheaterPartitionState(getGameState(), edgeId);
      updateGameState((state) => ({
        ...outcome.state,
        uiLayout: {
          ...(outcome.state.uiLayout ?? state.uiLayout ?? {}),
          theaterCommandSelectedEdgeId: edgeId,
        },
      }));
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-select-edge]").forEach((button) => {
    button.addEventListener("click", () => {
      const edgeId = button.getAttribute("data-theater-select-edge");
      if (!edgeId) {
        return;
      }
      updateGameState((state) => ({
        ...state,
        uiLayout: {
          ...(state.uiLayout ?? {}),
          theaterCommandSelectedEdgeId: edgeId,
        },
      }));
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-room-posture]").forEach((button) => {
    button.addEventListener("click", () => {
      const roomId = button.getAttribute("data-theater-room-posture");
      const posture = button.getAttribute("data-theater-room-posture-mode") as TheaterSignalPosture | null;
      if (!roomId || (posture !== "normal" && posture !== "masked" && posture !== "bait")) {
        return;
      }
      const outcome = setTheaterRoomSignalPosture(getGameState(), roomId, posture);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-room-containment]").forEach((button) => {
    button.addEventListener("click", () => {
      const roomId = button.getAttribute("data-theater-room-containment");
      const mode = button.getAttribute("data-theater-room-containment-mode") as TheaterContainmentMode | null;
      if (!roomId || (mode !== "normal" && mode !== "venting" && mode !== "lockdown")) {
        return;
      }
      const outcome = setTheaterRoomContainmentMode(getGameState(), roomId, mode);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-room-dump]").forEach((button) => {
    button.addEventListener("click", () => {
      const roomId = button.getAttribute("data-theater-room-dump");
      if (!roomId) {
        return;
      }
      const outcome = triggerTheaterEmergencyDump(getGameState(), roomId);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-advanced-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const shouldOpen = button.getAttribute("data-theater-advanced-toggle") !== "close";
      selectedRoomAdvancedOpen = shouldOpen;
      if (!shouldOpen && isTheaterSelectedRoomAdvancedTab(corePanelTab)) {
        corePanelTab = "room";
        if (theaterTacticalFullscreenActive) {
          setTheaterTacticalFullscreen(false);
          skipNextTheaterWindowFrameCapture = true;
        }
      }
      persistTheaterUiLayoutToState();
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-core-tab]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const nextTab = button.getAttribute("data-theater-core-tab");
      if (
        nextTab !== "room"
        && nextTab !== "annexes"
        && nextTab !== "modules"
        && nextTab !== "partitions"
        && nextTab !== "core"
        && nextTab !== "fortifications"
        && nextTab !== "tactical"
      ) {
        return;
      }
      if (nextTab !== "tactical" && theaterTacticalFullscreenActive) {
        setTheaterTacticalFullscreen(false);
        skipNextTheaterWindowFrameCapture = true;
      }
      corePanelTab = nextTab;
      if (isTheaterSelectedRoomAdvancedTab(corePanelTab)) {
        selectedRoomAdvancedOpen = true;
      }
      persistTheaterUiLayoutToState();
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-field-asset-select]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const fieldAssetType = button.getAttribute("data-theater-field-asset-select") as FieldAssetType | null;
      if (!fieldAssetType) {
        return;
      }
      theaterSelectedFieldAssetType = fieldAssetType;
      rerenderTheaterCommandScreenWithRoomState({ preserveRoomScroll: true });
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-tactical-tile]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const tileKey = button.getAttribute("data-theater-tactical-tile");
      if (!tileKey) {
        return;
      }
      theaterSelectedTacticalTileKey = tileKey;
      rerenderTheaterCommandScreenWithRoomState({ preserveRoomScroll: true });
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-tactical-zoom]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const direction = Number.parseInt(button.getAttribute("data-theater-tactical-zoom") ?? "0", 10);
      if (!Number.isInteger(direction) || direction === 0) {
        return;
      }
      theaterTacticalPreviewZoom = Math.max(0.7, Math.min(1.8, theaterTacticalPreviewZoom + direction * 0.15));
      rerenderTheaterCommandScreenWithRoomState({ preserveRoomScroll: true });
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-tactical-fullscreen]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const mode = button.getAttribute("data-theater-tactical-fullscreen");
      if (mode !== "on" && mode !== "off") {
        return;
      }
      setTheaterTacticalFullscreen(mode === "on");
      persistTheaterUiLayoutToState();
      rerenderTheaterCommandScreenWithRoomState({ preserveRoomScroll: true, skipWindowFrameCapture: true });
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-place-field-asset]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const roomId = button.getAttribute("data-theater-place-field-asset");
      const selectedTile = parseTheaterTacticalTileKey(theaterSelectedTacticalTileKey);
      if (!roomId || !selectedTile) {
        return;
      }
      if (isRemoteCoopOperationsClient()) {
        showSystemPing({
          type: "info",
          title: "Host Action Required",
          message: "Room tactical fabrication is currently host-only in co-op sessions.",
          channel: "theater-tactical-fabrication",
          replaceChannel: true,
        });
        return;
      }
      const outcome = fabricateFieldAssetInTheaterRoom(
        getGameState(),
        roomId,
        theaterSelectedFieldAssetType,
        selectedTile.x,
        selectedTile.y,
      );
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      rerenderTheaterCommandScreenWithRoomState({ preserveRoomScroll: true });
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-remove-field-asset]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const assetId = button.getAttribute("data-theater-remove-field-asset");
      const roomId = button.getAttribute("data-theater-remove-field-asset-room");
      if (!assetId || !roomId) {
        return;
      }
      if (isRemoteCoopOperationsClient()) {
        showSystemPing({
          type: "info",
          title: "Host Action Required",
          message: "Room tactical fabrication is currently host-only in co-op sessions.",
          channel: "theater-tactical-fabrication",
          replaceChannel: true,
        });
        return;
      }
      const outcome = removeFieldAssetFromTheaterRoom(getGameState(), roomId, assetId);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      rerenderTheaterCommandScreenWithRoomState({ preserveRoomScroll: true });
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-refuse-defense]").forEach((button) => {
    button.addEventListener("click", () => {
      const roomId = button.getAttribute("data-theater-refuse-defense");
      if (!roomId) {
        return;
      }

      if (isRemoteCoopOperationsClient()) {
        playPlaceholderSfx("ui-back");
        void sendRemoteCoopTheaterCommand({ type: "refuse_defense", roomId });
        return;
      }

      const outcome = refuseTheaterDefense(getGameState(), roomId);
      updateGameState(() => withPendingBattleConfirmationInState(
        outcome.state,
        pendingBattleConfirmation?.roomId === roomId ? null : pendingBattleConfirmation,
      ));
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-squad-select]").forEach((button) => {
    button.addEventListener("click", () => {
      const squadId = button.getAttribute("data-theater-squad-select");
      if (!squadId) {
        return;
      }

      const outcome = selectTheaterSquad(getGameState(), squadId);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-squad-quick-switch]").forEach((button) => {
    button.addEventListener("click", () => {
      const squadId = button.getAttribute("data-theater-squad-quick-switch");
      if (!squadId) {
        return;
      }

      const outcome = selectTheaterSquad(getGameState(), squadId);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-player-focus]").forEach((button) => {
    button.addEventListener("click", () => {
      const playerId = button.getAttribute("data-theater-player-focus");
      if (playerId !== "P1" && playerId !== "P2") {
        return;
      }

      const assignment = getGameState().session.theaterAssignments?.[playerId];
      if (!assignment?.squadId) {
        showSystemPing({
          type: "error",
          title: "No Squad Assigned",
          message: `${getPlayerControllerLabel(playerId)} does not have an active theater squad yet.`,
          channel: "theater-player-focus",
          replaceChannel: true,
        });
        return;
      }

      const outcome = selectTheaterSquad(getGameState(), assignment.squadId);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-squad-icon]").forEach((button) => {
    button.addEventListener("click", () => {
      const squadId = button.getAttribute("data-theater-squad-icon");
      const nextIcon = button.getAttribute("data-theater-squad-icon-next");
      if (!squadId || !nextIcon) {
        return;
      }

      const outcome = setTheaterSquadIcon(getGameState(), squadId, nextIcon);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-squad-color]").forEach((button) => {
    button.addEventListener("click", () => {
      const squadId = button.getAttribute("data-theater-squad-color");
      const nextColorKey = button.getAttribute("data-theater-squad-color-next");
      if (!squadId || !nextColorKey) {
        return;
      }

      const outcome = setTheaterSquadColor(getGameState(), squadId, nextColorKey);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-squad-assign]").forEach((button) => {
    button.addEventListener("click", () => {
      const squadId = button.getAttribute("data-theater-squad-assign");
      const playerId = button.getAttribute("data-theater-squad-assign-player");
      if (!squadId || (playerId !== "P1" && playerId !== "P2")) {
        return;
      }

      const currentAssignment = getGameState().session.theaterAssignments?.[playerId]?.squadId ?? null;
      const shouldClear = currentAssignment === squadId;
      updateGameState((state) => {
        let nextState = assignLocalPlayerToTheaterSquad(state, playerId, shouldClear ? null : squadId);
        if (!shouldClear) {
          nextState = selectTheaterSquad(nextState, squadId).state;
        }
        return nextState;
      });

      showSystemPing({
        type: "info",
        title: shouldClear ? "Command Link Released" : "Command Link Updated",
        message: shouldClear
          ? `${getPlayerControllerLabel(playerId)} released ${squadId.toUpperCase()}.`
          : `${getPlayerControllerLabel(playerId)} linked to ${squadId.toUpperCase()}.`,
        channel: "theater-player-assignment",
        replaceChannel: true,
      });
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-squad-automation]").forEach((button) => {
    button.addEventListener("click", () => {
      const squadId = button.getAttribute("data-theater-squad-automation");
      const mode = button.getAttribute("data-theater-squad-automation-mode") as TheaterSquadAutomationMode | null;
      if (!squadId || (mode !== "manual" && mode !== "undaring" && mode !== "daring")) {
        return;
      }

      const outcome = setTheaterSquadAutomationMode(getGameState(), squadId, mode);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLInputElement>("[data-theater-squad-rename]").forEach((input) => {
    const commitRename = () => {
      const squadId = input.getAttribute("data-theater-squad-rename");
      if (!squadId) {
        return;
      }

      const outcome = renameTheaterSquad(getGameState(), squadId, input.value);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    };

    input.addEventListener("blur", commitRename);
    input.addEventListener("change", commitRename);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      input.blur();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-squad-split]").forEach((button) => {
    button.addEventListener("click", () => {
      const squadId = button.getAttribute("data-theater-squad-split");
      const unitId = button.getAttribute("data-theater-squad-unit");
      if (!squadId || !unitId) {
        return;
      }

      const outcome = splitUnitToNewSquad(getGameState(), squadId, unitId);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-squad-drag-unit]").forEach((unitRow) => {
    unitRow.addEventListener("mousedown", (event) => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest("button, input, textarea, select, a")) {
        return;
      }
      const fromSquadId = unitRow.getAttribute("data-theater-squad-drag-source");
      const unitId = unitRow.getAttribute("data-theater-squad-drag-unit");
      const label = unitRow.getAttribute("data-theater-squad-drag-label") ?? unitRow.textContent?.trim() ?? unitId ?? "Unit";
      if (!fromSquadId || !unitId) {
        return;
      }

      event.preventDefault();
      clearTheaterSquadUnitDragSession();
      activeSquadUnitDragSession = {
        fromSquadId,
        unitId,
        label,
        startX: event.clientX,
        startY: event.clientY,
        hoveredSquadId: null,
        hoveredIsValid: false,
        activated: false,
        sourceElement: unitRow,
        previewElement: null,
      };
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-squad-transfer]").forEach((button) => {
    button.addEventListener("click", () => {
      const squadId = button.getAttribute("data-theater-squad-transfer");
      const targetSquadId = button.getAttribute("data-theater-squad-target");
      const unitId = button.getAttribute("data-theater-squad-unit");
      if (!squadId || !targetSquadId || !unitId) {
        return;
      }

      const outcome = transferUnitBetweenSquads(getGameState(), squadId, targetSquadId, unitId);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });

  document.querySelectorAll<HTMLElement>("[data-theater-squad-merge]").forEach((button) => {
    button.addEventListener("click", () => {
      const squadId = button.getAttribute("data-theater-squad-merge");
      const targetSquadId = theater.selectedSquadId;
      if (!squadId || !targetSquadId) {
        return;
      }

      const outcome = mergeTheaterSquads(getGameState(), squadId, targetSquadId);
      updateGameState(() => outcome.state);
      if (!outcome.success) {
        alert(outcome.message);
      }
      renderTheaterCommandScreen();
    });
  });
}

export function renderTheaterCommandScreen(): void {
  initializeQuestState();
  setMusicCue("theater");
  const root = document.getElementById("app");
  if (!root) {
    return;
  }
  const previousScreen = document.body.getAttribute("data-screen");
  document.body.setAttribute("data-screen", "theater-command");
  cleanupTheaterControllerContext?.();
  cleanupTheaterControllerContext = null;

  if (!skipNextTheaterWindowFrameCapture) {
    captureWindowFramesFromDom();
  }
  skipNextTheaterWindowFrameCapture = false;
  const currentState = getGameState();
  syncPendingBattleConfirmationFromSession(currentState);
  const preparedCurrentTheater = getPreparedActiveTheater(currentState);
  const hadCompletedBeforeSync =
    preparedCurrentTheater
      ? hasCompletedTheaterObjective(preparedCurrentTheater)
      : false;
  const ensuredOperation = getPreparedTheaterOperation(currentState);
  if (!ensuredOperation?.theater) {
    clearControllerContext();
    root.innerHTML = `<div style="padding:24px;color:#fff;">No active theater operation.</div>`;
    return;
  }

  const mountSignature = `${ensuredOperation.id ?? ensuredOperation.codename}:${ensuredOperation.theater.definition.id}`;
  if (lastMountedTheaterSignature !== mountSignature) {
  }
  hydrateTheaterUiLayoutFromState(mountSignature);
  normalizeAllTheaterWindowFrames();
  const isFreshTheaterEntry = previousScreen !== "theater-command" || lastMountedTheaterSignature !== mountSignature;
  if (isFreshTheaterEntry || !isAnyTheaterRoomVisibleOnScreen(ensuredOperation.theater)) {
    resetMapViewportForTheaterEntry(ensuredOperation.theater);
  }

  const syncedCompletion = ensuredOperation.theater.completion;
  const shouldGrantCompletionReward =
    Boolean(syncedCompletion) &&
    hasCompletedTheaterObjective(ensuredOperation.theater) &&
    !hadCompletedBeforeSync;

  updateGameState((state) => {
    const nextState = shouldGrantCompletionReward && syncedCompletion
      ? grantSessionResources(state, {
          wad: syncedCompletion.reward.wad ?? 0,
          resources: syncedCompletion.reward,
        })
      : state;
    return {
      ...nextState,
      phase: "operation",
      operation: ensuredOperation,
    };
  });

  const state = getGameState();
  const theater = ensuredOperation.theater;
  syncThreatPings(theater, mountSignature);
  syncSandboxPings(theater, mountSignature);
  if (lastMountedTheaterSignature !== mountSignature) {
    console.log("[THEATER] screen mounted", theater.definition.id, theater.definition.name);
    lastMountedTheaterSignature = mountSignature;
  }

  const completion = theater.completion;
  const canDescend =
    ensuredOperation.currentFloorIndex < ensuredOperation.floors.length - 1
    && theater.definition.floorOrdinal < CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL;
  const hasCompletionPopup = Boolean(hasCompletedTheaterObjective(theater) && completion);
  const isTacticalFullscreenMode = theaterTacticalFullscreenActive && corePanelTab === "tactical";

  root.innerHTML = `
    ${renderTheaterStyles()}
    <div class="theater-root ${isTacticalFullscreenMode ? "theater-root--tactical-fullscreen" : ""}">
      ${renderTheaterMap(theater)}
      ${renderOpsWindow(theater, ensuredOperation.floors.length)}
      ${renderSquadsWindow(theater)}
      ${renderManageUnitsWindow(theater)}
      ${renderQuestTrackerWindow(theater)}
      ${renderSelectedRoomWindow(theater)}
      ${renderAutomationWindow(theater)}
      ${renderCoreWindow(theater)}
      ${renderFeedWindow(theater)}
      ${renderResourcesWindow(state, theater)}
      ${renderConsumablesWindow(state, theater)}
      ${renderUpkeepWindow(theater)}
      ${renderNotesWindow(theater)}
      ${renderTheaterWindowDock(theater)}
      ${renderTheaterExitConfirmModal()}
    </div>
  `;

  attachTheaterHandlers(theater);
  syncTheaterFeedWindowToLatest();
  attachNotesWidgetHandlers(root, {
    onStateChange: () => renderTheaterCommandScreen(),
  });
  attachStuckNoteHandlers(root, {
    onStateChange: () => renderTheaterCommandScreen(),
    getStickyZoom: () => mapZoom,
  });
  showTutorialCallout({
    id: "tutorial_theater_command",
    title: "Theater Command",
    message: "Each theater is one live operation space inside the current floor of the campaign.",
    detail: `Secure the objective, stabilize your routes and squads, then descend. Floor ${String(CURRENT_CAMPAIGN_FINAL_FLOOR_ORDINAL).padStart(2, "0")} is the current campaign ending point and unlocks postgame regeneration.`,
    durationMs: 9000,
    channel: "tutorial-theater",
  });
  if (pendingBattleConfirmation) {
    attachPendingBattleHandlers();
  }
  if (hasCompletionPopup) {
    attachCompletionHandlers(canDescend);
  }
  restoreQueuedTheaterRoomBodyScroll();
  cleanupTheaterControllerContext = registerControllerContext({
    id: "theater-command",
    defaultMode: theaterExitConfirmState ? "focus" : "cursor",
    focusRoot: () => document.querySelector(".theater-root"),
    focusSelector: theaterExitConfirmState ? "#theaterExitConfirmModal button:not([disabled])" : undefined,
    defaultFocusSelector: theaterExitConfirmState
      ? "#theaterExitConfirmAcceptBtn"
      : "[data-theater-window='ops'] button, [data-theater-window-restore]",
    onCursorAction: theaterExitConfirmState ? undefined : (action) => handleTheaterControllerAction(action, theater, "cursor"),
    onLayoutAction: theaterExitConfirmState ? undefined : (action) => handleTheaterControllerAction(action, theater, "layout"),
    onFocusAction: (action) => {
      if (theaterExitConfirmState && action === "cancel") {
        closeTheaterExitConfirm();
        return true;
      }
      if (action === "cancel") {
        setControllerMode("cursor");
        updateFocusableElements();
        return true;
      }
      return false;
    },
    getDebugState: () => {
      const selectedRoom = theater.rooms[theater.selectedRoomId];
      return {
        hovered: selectedRoom?.id ?? "none",
        focus: selectedRoom?.label ?? "none",
        window: theaterControllerActiveWindowKey,
        x: selectedRoom?.position.x,
        y: selectedRoom?.position.y,
      };
    },
  });
  updateFocusableElements();
}

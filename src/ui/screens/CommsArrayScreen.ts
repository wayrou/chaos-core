// ============================================================================
// CHAOS CORE - COMMS ARRAY SCREEN
// Training battles and future multiplayer features
// ============================================================================

import { getGameState, subscribe, updateGameState } from "../../state/gameStore";
import { createTrainingEncounter, TrainingConfig } from "../../core/trainingEncounter";
import { createBattleFromEncounter } from "../../core/battleFromEncounter";
import { applyExternalBattleState, applyRemoteSquadBattleCommand, renderBattleScreen } from "./BattleScreen";
import type { BattleState as RuntimeBattleState } from "../../core/battle";
import { abandonRun, startOperationRun, syncCampaignToGameState } from "../../core/campaignManager";
import { Difficulty, EnemyDensity } from "../../core/campaign";
import {
  type CoopTheaterCommand,
  NETWORK_PLAYER_SLOTS,
  type OperationRun,
  SESSION_PLAYER_SLOTS,
  TheaterSprawlDirection,
  type LobbyState,
  type LobbyReturnContext,
  type LobbySkirmishIntermissionDecision,
  type NetworkPlayerSlot,
  type SessionPlayerSlot,
  type SkirmishPlaylist,
  type SkirmishRoundSpec,
} from "../../core/types";
import { ensureOperationHasTheater } from "../../core/theaterSystem";
import { renderLoadoutScreen } from "./LoadoutScreen";
import {
  applySquadMatchCommand,
  clearSquadMatchState,
  getConnectedSquadMembers,
  getNextOpenSquadSlot,
  getSquadLobbySummary,
  getSquadWinConditionLabel,
  loadSquadMatchState,
  markSquadMemberDisconnected,
  type MatchCommand,
  parseSquadMatchSnapshot,
  rehydrateSquadMatchState,
  saveSquadMatchState,
  serializeSquadMatchSnapshot,
  type SquadMatchState,
  type SquadWinCondition,
} from "../../core/squadOnline";
import {
  advanceLobbySkirmishRound,
  chooseLobbySkirmishNextRoundDecision,
  clearLobbyActivity,
  clearLobbyState,
  clearPendingChallenge,
  createHostedMultiplayerLobby,
  createJoiningMultiplayerLobby,
  createLobbySkirmishActivity,
  createPendingSkirmishChallenge,
  createSkirmishMatchFromPlaylist,
  findNextOpenLobbySlot,
  findReconnectableLobbySlot,
  getActiveLobbyPlaylistRound,
  getLobbyLocalSkirmishMatch,
  launchCoopOperationsActivity,
  loadLobbyState,
  markLobbyMemberDisconnected,
  removeLobbyMember,
  saveLobbyState,
  setLobbyLocalSlot,
  startCoopOperationsActivity,
  syncCoopOperationsRuntime,
  updateChallengeStatus,
  updateCoopOperationsSelection,
  updateLobbyAvatar,
  updateLobbySkirmishBattlePayload,
  updateLobbySkirmishSnapshot,
  upsertLobbyMember,
} from "../../core/multiplayerLobby";
import {
  clearCoopOperationsSession,
  launchCoopOperationsSessionFromLobby,
} from "../../core/session";
import {
  applySquadBattleToGameState,
  createSquadBattlePayload,
  createSquadBattleState,
  parseSquadBattlePayload,
} from "../../core/squadBattle";
import {
  getSquadTransportStatus,
  isTauriSquadTransportAvailable,
  sendSquadTransportMessage,
  startSquadTransportHost,
  startSquadTransportJoin,
  stopSquadTransport,
  subscribeToSquadTransportEvents,
  type SquadTransportEvent,
  type SquadTransportStatus,
} from "../../core/squadOnlineTransport";
import {
  BaseCampReturnTo,
  getBaseCampFieldReturnMap,
  getBaseCampReturnLabel,
  registerBaseCampReturnHotkey,
  returnFromBaseCampScreen,
  unregisterBaseCampReturnHotkey,
} from "./baseCampReturn";
import { showSystemPing } from "../components/systemPing";

type CommsReturnTo = BaseCampReturnTo | "operation" | "menu";

// Training config state
let trainingConfig: TrainingConfig = {
  gridW: 6,
  gridH: 4,
  difficulty: "normal",
  rules: {
    noRewards: true,
  },
};

// Store last training config for rematch
let lastTrainingConfig: TrainingConfig | null = null;

type CustomOperationConfig = {
  difficulty: Difficulty;
  floors: number;
  enemyDensity: EnemyDensity;
  sprawlDirection: TheaterSprawlDirection;
};

let customOperationConfig: CustomOperationConfig = {
  difficulty: "normal",
  floors: 3,
  enemyDensity: "normal",
  sprawlDirection: "east",
};

type MultiplayerLobbyPreviewConfig = {
  operatorCallsign: string;
  joinAddress: string;
};

type SkirmishSurface = "comms" | "staging";

let multiplayerLobbyPreviewConfig: MultiplayerLobbyPreviewConfig = {
  operatorCallsign: "",
  joinAddress: "",
};

const DEFAULT_SQUAD_TRANSPORT_STATUS: SquadTransportStatus = {
  active: false,
  role: "idle",
  port: null,
  joinAddress: null,
  hostAddress: null,
  peerId: null,
  connectedPeerIds: [],
};

let squadTransportStatus: SquadTransportStatus = { ...DEFAULT_SQUAD_TRANSPORT_STATUS };
let squadTransportSubscribed = false;
let squadTransportStatusHydrated = false;
let activeCommsReturnTo: CommsReturnTo = "basecamp";
let activeSkirmishSurface: SkirmishSurface = "comms";
let squadClientAssignedSlot: SessionPlayerSlot = "P2";
let lobbyClientAssignedSlot: NetworkPlayerSlot = "P2";
const squadRemotePeerSlots = new Map<string, SessionPlayerSlot>();
const lobbyRemotePeerSlots = new Map<string, NetworkPlayerSlot>();
let pendingRemoteSkirmishBattlePayload: string | null = null;
let shouldAutoResumeRemoteSkirmishBattle = false;
let cleanupCoopOperationsStateSync: (() => void) | null = null;
let lastCoopOperationsSyncSignature = "";

const SKIRMISH_UNIT_LABELS = [
  "Vanguard Core",
  "Ranger Line",
  "Shock Squire",
  "Hex Analyst",
  "Breacher",
  "Harrier",
  "Ward Marshal",
  "Signal Raider",
] as const;

const SKIRMISH_EQUIPMENT_LABELS = [
  "Arc Spear",
  "Heavy Carbine",
  "Scout Harness",
  "Mirror Plate",
  "Recoil Gloves",
  "Flux Buckler",
  "Hazard Lens",
  "Anchor Boots",
] as const;

const SKIRMISH_TACTICAL_LABELS = [
  "Priority Intercept",
  "Emergency Med Drop",
  "Ambush Window",
  "Fog Screen",
  "Rapid Advance",
  "Counter-Breach",
  "False Retreat",
  "Kill Box",
] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSquadMatchState(): SquadMatchState | null {
  return loadSquadMatchState();
}

function parseLobbySnapshot(payload: string): LobbyState | null {
  try {
    const parsed = JSON.parse(payload) as LobbyState;
    if (!parsed?.protocolVersion || !parsed?.lobbyId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function serializeLobbySnapshot(lobby: LobbyState): string {
  return JSON.stringify(lobby, null, 2);
}

function parseCoopOperationSnapshot(payload: string | null | undefined): OperationRun | null {
  if (!payload) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as OperationRun;
    return parsed?.floors ? parsed : null;
  } catch {
    return null;
  }
}

function parseCoopBattleSnapshot(payload: string | null | undefined): RuntimeBattleState | null {
  if (!payload) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as RuntimeBattleState;
    return parsed?.id && parsed?.units ? parsed : null;
  } catch {
    return null;
  }
}

export function getActiveLobbyState(): LobbyState | null {
  const stateLobby = getGameState().lobby;
  if (stateLobby) {
    return stateLobby;
  }
  return loadLobbyState();
}

function getResolvedLobbyState(): LobbyState | null {
  const lobby = getActiveLobbyState();
  if (!lobby) {
    return null;
  }
  if (!getGameState().lobby) {
    updateGameState((state) => ({
      ...state,
      lobby,
    }));
  }
  return lobby;
}

function syncLobbySkirmishMatchStorage(lobby: LobbyState | null): void {
  const localMatch = getLobbyLocalSkirmishMatch(lobby);
  if (!localMatch) {
    clearSquadMatchState();
    return;
  }
  saveSquadMatchState(getTransportAwareMatchState(localMatch, localMatch.localSlot));
}

function commitLobbyState(
  lobby: LobbyState | null,
  message?: string,
  messageType: "success" | "error" | "info" = "info",
  rerenderField = true,
): void {
  saveLobbyState(lobby);
  updateGameState((state) => {
    const nextState = {
      ...state,
      lobby,
    };
    const localParticipant = lobby?.activity.kind === "coop_operations" && lobby.localSlot
      ? lobby.activity.coopOperations.participants[lobby.localSlot]
      : null;
    if (
      lobby?.activity.kind === "coop_operations"
      && lobby.activity.coopOperations.status === "active"
      && localParticipant?.selected
    ) {
      const hydratedState = launchCoopOperationsSessionFromLobby(nextState, lobby);
      const parsedOperation = parseCoopOperationSnapshot(lobby.activity.coopOperations.operationSnapshot);
      const parsedBattle = parseCoopBattleSnapshot(lobby.activity.coopOperations.battleSnapshot);
      if (parsedBattle) {
        return {
          ...hydratedState,
          operation: parsedOperation ?? hydratedState.operation,
          currentBattle: parsedBattle,
          phase: "battle",
        };
      }
      return {
        ...hydratedState,
        operation: parsedOperation ?? hydratedState.operation,
        currentBattle: null,
        phase: lobby.activity.coopOperations.operationPhase ?? hydratedState.phase,
      };
    }
    return nextState;
  });
  syncLobbySkirmishMatchStorage(lobby);
  if (message) {
    showNotification(message, messageType);
  }
  if (rerenderField && document.querySelector(".field-root")) {
    import("../../field/FieldScreen").then(({ renderFieldScreen }) => {
      renderFieldScreen(
        lobby?.activity.kind === "coop_operations" && lobby.activity.coopOperations.status === "active"
          ? "base_camp"
          : "network_lobby",
      );
    });
  }
}

function getLocalLobbySlot(lobby: LobbyState | null | undefined): NetworkPlayerSlot | null {
  return lobby?.localSlot ?? lobbyClientAssignedSlot ?? null;
}

function getLocalLobbyCallsign(lobby: LobbyState | null | undefined): string {
  const localSlot = getLocalLobbySlot(lobby);
  return (localSlot && lobby?.members[localSlot]?.callsign) || getGameState().profile.callsign || "OPERATOR";
}

function isLocalLobbySkirmishFighter(lobby: LobbyState | null | undefined): boolean {
  if (!lobby || lobby.activity.kind !== "skirmish") {
    return false;
  }
  const localSlot = getLocalLobbySlot(lobby);
  return Boolean(
    localSlot
    && (lobby.activity.skirmish.challengerSlot === localSlot || lobby.activity.skirmish.challengeeSlot === localSlot),
  );
}

function syncActiveSkirmishPeerMaps(lobby: LobbyState | null): void {
  squadRemotePeerSlots.clear();
  if (!lobby || lobby.activity.kind !== "skirmish") {
    return;
  }
  for (const [peerId, networkSlot] of lobbyRemotePeerSlots.entries()) {
    if (networkSlot === lobby.activity.skirmish.challengeeSlot) {
      squadRemotePeerSlots.set(peerId, "P2");
    } else if (networkSlot === lobby.activity.skirmish.challengerSlot && lobby.hostSlot !== networkSlot) {
      squadRemotePeerSlots.set(peerId, "P1");
    }
  }
}

async function broadcastLobbySnapshot(
  lobby: LobbyState | null,
  targetPeerId?: string | null,
): Promise<void> {
  if (!lobby || !isTauriSquadTransportAvailable() || squadTransportStatus.role !== "host") {
    return;
  }
  await sendSquadTransportMessage("lobby_snapshot", serializeLobbySnapshot(lobby), targetPeerId ?? null);
}

function maybeEnterLocalLobbySkirmish(lobby: LobbyState | null): void {
  if (!lobby || lobby.activity.kind !== "skirmish" || !isLocalLobbySkirmishFighter(lobby)) {
    return;
  }
  const localMatch = getLobbyLocalSkirmishMatch(lobby);
  if (!localMatch) {
    return;
  }
  const syncedMatch = getTransportAwareMatchState(localMatch, localMatch.localSlot);
  saveSquadMatchState(syncedMatch);
  activeSkirmishSurface = "staging";
  if (lobby.activity.skirmish.status === "battle" && lobby.activity.skirmish.activeBattlePayload) {
    enterSquadBattle(syncedMatch, lobby.activity.skirmish.activeBattlePayload, "always");
    return;
  }
  renderActiveSkirmishScreen(activeCommsReturnTo);
}

async function openNetworkLobbyField(): Promise<void> {
  const { renderFieldScreen } = await import("../../field/FieldScreen");
  renderFieldScreen("network_lobby");
}

function isCommsArrayMounted(): boolean {
  return Boolean(document.querySelector(".comms-array-root, .skirmish-staging-root"));
}

function shouldRenderSkirmishStaging(match: SquadMatchState | null): boolean {
  return Boolean(match && match.phase !== "lobby" && activeSkirmishSurface === "staging");
}

function getSkirmishCategoryClass(category: string): string {
  if (category === "unit") {
    return "unit";
  }
  if (category === "equipment") {
    return "field";
  }
  return "modifier";
}

function getSkirmishPickLabel(category: string, optionId: string): string {
  const [, indexToken] = optionId.split("_");
  const optionIndex = Number.parseInt(indexToken ?? "", 10);
  if (category === "unit") {
    return SKIRMISH_UNIT_LABELS[optionIndex] ?? optionId;
  }
  if (category === "equipment") {
    return SKIRMISH_EQUIPMENT_LABELS[optionIndex] ?? optionId;
  }
  return SKIRMISH_TACTICAL_LABELS[optionIndex] ?? optionId;
}

function getSkirmishStageTitle(match: SquadMatchState): string {
  if (match.phase === "draft") {
    return "Skirmish Draft";
  }
  if (match.phase === "confirmation") {
    return "Loadout Confirmation";
  }
  if (match.phase === "battle") {
    return "Battle Handoff";
  }
  if (match.phase === "result") {
    return "Match Resolution";
  }
  return "Skirmish Lobby";
}

function getSkirmishWinConditionCopy(winCondition: SquadWinCondition): string {
  if (winCondition === "control_relay") {
    return "Control the relay footprint at the end of each round. First side to the target score wins.";
  }
  if (winCondition === "breakthrough") {
    return "Reach the enemy breach lane and extract the scoring unit. First side to two breaches wins.";
  }
  return "Eliminate every opposing unit to win the match.";
}

function getSkirmishObjectivePreviewCells(round: Pick<SkirmishRoundSpec, "gridWidth" | "gridHeight" | "objectiveType">): Array<{
  x: number;
  y: number;
  kind: "relay" | "friendly_breach" | "enemy_breach";
}> {
  const width = Math.max(4, round.gridWidth);
  const height = Math.max(3, round.gridHeight);
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  if (round.objectiveType === "control_relay") {
    if (Math.abs(width - height) <= 1) {
      return [
        { x: centerX, y: centerY, kind: "relay" as const },
        { x: Math.max(1, centerX - 1), y: centerY, kind: "relay" as const },
        { x: centerX, y: Math.max(1, centerY - 1), kind: "relay" as const },
        { x: Math.max(1, centerX - 1), y: Math.max(1, centerY - 1), kind: "relay" as const },
      ].filter((cell, index, all) =>
        cell.x > 0
        && cell.x < width - 1
        && cell.y > 0
        && cell.y < height - 1
        && all.findIndex((candidate) => candidate.x === cell.x && candidate.y === cell.y) === index,
      );
    }

    if (width > height) {
      const startX = Math.max(1, centerX - 1);
      const endX = Math.min(width - 2, centerX + 1);
      return Array.from({ length: endX - startX + 1 }, (_, index) => ({
        x: startX + index,
        y: centerY,
        kind: "relay" as const,
      }));
    }

    const startY = Math.max(1, centerY - 1);
    const endY = Math.min(height - 2, centerY + 1);
    return Array.from({ length: endY - startY + 1 }, (_, index) => ({
      x: centerX,
      y: startY + index,
      kind: "relay" as const,
    }));
  }

  if (round.objectiveType === "breakthrough") {
    const breachCount = width >= 9 ? 3 : width >= 7 ? 2 : 1;
    const offsets = breachCount === 1 ? [0] : breachCount === 2 ? [-1, 1] : [-1, 0, 1];
    const rows = offsets
      .map((offset) => Math.min(height - 2, Math.max(1, centerY + offset)))
      .filter((row, index, list) => list.indexOf(row) === index);
    return [
      ...rows.map((row) => ({ x: width - 2, y: row, kind: "friendly_breach" as const })),
      ...rows.map((row) => ({ x: 1, y: row, kind: "enemy_breach" as const })),
    ];
  }

  return [];
}

function renderSkirmishObjectivePreview(round: Pick<SkirmishRoundSpec, "gridWidth" | "gridHeight" | "objectiveType">): string {
  const previewCells = getSkirmishObjectivePreviewCells(round);
  const cellMarkup = Array.from({ length: round.gridHeight }, (_, y) =>
    Array.from({ length: round.gridWidth }, (_, x) => {
      const isFriendlyDeploy = x === 0;
      const isEnemyDeploy = x === round.gridWidth - 1;
      const previewCell = previewCells.find((cell) => cell.x === x && cell.y === y);
      const classes = [
        "skirmish-objective-preview__cell",
        isFriendlyDeploy ? "skirmish-objective-preview__cell--friendly-deploy" : "",
        isEnemyDeploy ? "skirmish-objective-preview__cell--enemy-deploy" : "",
        previewCell ? `skirmish-objective-preview__cell--${previewCell.kind}` : "",
      ].filter(Boolean).join(" ");
      const label = previewCell?.kind === "relay"
        ? "R"
        : previewCell?.kind === "friendly_breach"
          ? "H"
          : previewCell?.kind === "enemy_breach"
            ? "O"
            : "";
      return `<div class="${classes}">${label}</div>`;
    }).join(""),
  ).join("");

  return `
    <div class="skirmish-objective-preview">
      <div class="skirmish-objective-preview__grid" style="grid-template-columns: repeat(${round.gridWidth}, 1fr);">
        ${cellMarkup}
      </div>
      <div class="skirmish-objective-preview__legend">
        <span>GRID ${round.gridWidth}×${round.gridHeight}</span>
        <span>${escapeHtml(getSquadWinConditionLabel(round.objectiveType))}</span>
      </div>
    </div>
  `;
}

function canLocalHostLobby(lobby: LobbyState | null | undefined): boolean {
  if (!lobby) {
    return false;
  }
  return lobby.localSlot === lobby.hostSlot && squadTransportStatus.role !== "client";
}

function getCoopOperationsSignature(lobby: LobbyState | null | undefined): string {
  if (!lobby || lobby.activity.kind !== "coop_operations") {
    return "";
  }
  const activity = lobby.activity.coopOperations;
  return JSON.stringify({
    activityId: activity.activityId,
    status: activity.status,
    selectedSlots: activity.selectedSlots,
    operationPhase: activity.operationPhase,
    operationSnapshot: activity.operationSnapshot,
    battleSnapshot: activity.battleSnapshot,
    pendingTheaterBattleConfirmation: activity.pendingTheaterBattleConfirmation,
    participants: activity.participants,
  });
}

function ensureCoopOperationsStateSync(): void {
  if (cleanupCoopOperationsStateSync) {
    return;
  }
  cleanupCoopOperationsStateSync = subscribe((state) => {
    const lobby = state.lobby;
    if (
      !lobby
      || lobby.activity.kind !== "coop_operations"
      || !canLocalHostLobby(lobby)
      || lobby.activity.coopOperations.status !== "active"
    ) {
      lastCoopOperationsSyncSignature = "";
      return;
    }

    const nextLobby = syncCoopOperationsRuntime(lobby, state);
    const nextSignature = getCoopOperationsSignature(nextLobby);
    if (!nextSignature || nextSignature === lastCoopOperationsSyncSignature) {
      return;
    }
    lastCoopOperationsSyncSignature = nextSignature;
    commitLobbyState(nextLobby, undefined, "info", false);
    if (isTauriSquadTransportAvailable() && squadTransportStatus.role === "host") {
      void broadcastLobbySnapshot(nextLobby);
    }
  });
}

function getLobbyTransportSummary(lobby: LobbyState | null): string {
  if (!isTauriSquadTransportAvailable()) {
    return "Desktop transport is unavailable here. Host and join from the desktop build.";
  }
  if (squadTransportStatus.role === "host") {
    return `Lobby live at ${squadTransportStatus.joinAddress ?? "address pending"} with ${squadTransportStatus.connectedPeerIds.length} remote link(s).`;
  }
  if (squadTransportStatus.role === "client") {
    return `Linked to ${squadTransportStatus.hostAddress ?? (multiplayerLobbyPreviewConfig.joinAddress || "awaiting host")}.`;
  }
  if (lobby) {
    return "Lobby state is staged locally. Enter the lobby field to continue.";
  }
  return "Host a multiplayer lobby or join a remote lobby from here.";
}

function getSkirmishStageCopy(match: SquadMatchState): string {
  if (match.phase === "draft") {
    return "Draft units, equipment, and tactical options from one shared pool. Each pick is contested and locks immediately.";
  }
  if (match.phase === "confirmation") {
    return `The draft is locked. Review every combatant package and confirm before the host deploys the match. ${getSkirmishWinConditionCopy(match.rules.winCondition)}`;
  }
  if (match.phase === "battle") {
    return `Draft and confirmation are complete. Launch the live Skirmish battle or re-enter the active engagement feed. ${getSkirmishWinConditionCopy(match.rules.winCondition)}`;
  }
  if (match.phase === "result") {
    return "The skirmish is settled. Review the winning side, then either reset the session or move back to Comms.";
  }
  return "Configure the networked skirmish lobby, then move into the draft board when everyone is ready.";
}

function getTransportAwareMatchState(
  match: SquadMatchState,
  localSlotOverride?: SessionPlayerSlot,
): SquadMatchState {
  const transportState =
    squadTransportStatus.role === "host"
      ? "hosting"
      : squadTransportStatus.role === "client"
        ? "connected"
        : match.transportState === "local_preview"
          ? "local_preview"
          : "closed";

  return {
    ...match,
    localSlot: localSlotOverride ?? (squadTransportStatus.role === "client" ? squadClientAssignedSlot : match.localSlot),
    transportState,
  };
}

function syncStoredSquadMatchTransportState(): void {
  const currentMatch = getSquadMatchState();
  if (!currentMatch) {
    return;
  }

  const nextMatch = getTransportAwareMatchState(currentMatch);
  if (JSON.stringify(currentMatch) === JSON.stringify(nextMatch)) {
    return;
  }

  saveSquadMatchState(nextMatch);
}

function consumePendingRemoteSkirmishBattle(
  match: SquadMatchState,
  fallbackRenderMode: "always" | "if_mounted" = "if_mounted",
): boolean {
  if (!pendingRemoteSkirmishBattlePayload || match.phase !== "battle") {
    return false;
  }

  const payload = pendingRemoteSkirmishBattlePayload;
  pendingRemoteSkirmishBattlePayload = null;
  const renderMode = shouldAutoResumeRemoteSkirmishBattle ? "always" : fallbackRenderMode;
  shouldAutoResumeRemoteSkirmishBattle = false;
  enterSquadBattle(match, payload, renderMode);
  return true;
}

async function broadcastSquadSnapshot(
  match: SquadMatchState | null,
  targetPeerId?: string | null,
): Promise<void> {
  if (!match || !isTauriSquadTransportAvailable() || squadTransportStatus.role !== "host") {
    return;
  }

  await sendSquadTransportMessage(
    "snapshot",
    serializeSquadMatchSnapshot(match),
    targetPeerId ?? null,
  );
}

function getSquadBattleAuthorityRole(): "local" | "host" | "client" {
  if (squadTransportStatus.role === "host") {
    return "host";
  }
  if (squadTransportStatus.role === "client") {
    return "client";
  }
  return "local";
}

function enterSquadBattle(match: SquadMatchState, battlePayload: string, renderMode: "always" | "if_mounted" = "always"): void {
  const parsedPayload = parseSquadBattlePayload(battlePayload);
  if (!parsedPayload) {
    showNotification("Skirmish battle payload was invalid.", "error");
    return;
  }

  activeSkirmishSurface = "staging";
  updateGameState((state) =>
    applySquadBattleToGameState(state, match, parsedPayload.battle, getSquadBattleAuthorityRole()),
  );
  applyExternalBattleState(parsedPayload.battle, renderMode);
}

async function startSquadBattle(match: SquadMatchState): Promise<void> {
  const battle = createSquadBattleState(match, getGameState());
  const payload = createSquadBattlePayload(match, battle);

  enterSquadBattle(match, payload, "always");
  const currentLobby = getResolvedLobbyState();
  if (currentLobby?.activity.kind === "skirmish") {
    const nextLobby = updateLobbySkirmishBattlePayload(currentLobby, payload);
    commitLobbyState(nextLobby, undefined, "info", false);
    await broadcastLobbySnapshot(nextLobby);
  }

  if (isTauriSquadTransportAvailable() && squadTransportStatus.role === "host") {
    await sendSquadTransportMessage("battle_start", payload, null);
  }
}

function getClientControlSlot(match: SquadMatchState | null): SessionPlayerSlot {
  return match?.localSlot ?? squadClientAssignedSlot;
}

function parseRemoteMatchCommand(payload: string): MatchCommand | null {
  try {
    return JSON.parse(payload) as MatchCommand;
  } catch {
    return null;
  }
}

function getAssignedRemoteSlot(
  previousMatch: SquadMatchState | null,
  nextMatch: SquadMatchState,
  callsign: string,
): SessionPlayerSlot | null {
  const previousSlots = new Set(
    previousMatch
      ? getConnectedSquadMembers(previousMatch).map((member) => member.slot)
      : [],
  );
  const newlyOccupied = getConnectedSquadMembers(nextMatch)
    .map((member) => member.slot)
    .find((slot) => !previousSlots.has(slot));
  if (newlyOccupied) {
    return newlyOccupied;
  }

  return getConnectedSquadMembers(nextMatch).find((member) => member.callsign === callsign)?.slot ?? null;
}

function findReconnectableSquadSlot(match: SquadMatchState, callsign: string): SessionPlayerSlot | null {
  const normalizedCallsign = callsign.trim().toLowerCase();
  return SESSION_PLAYER_SLOTS.find((slot) => {
    const member = match.members[slot];
    return Boolean(member && !member.connected && member.callsign.trim().toLowerCase() === normalizedCallsign);
  }) ?? null;
}

function normalizeRemoteMatchCommand(
  command: MatchCommand,
  assignedSlot: SessionPlayerSlot | null,
): MatchCommand | null {
  switch (command.type) {
    case "join_lobby":
      return command;
    case "leave_lobby":
      return assignedSlot ? { type: "leave_lobby", slot: assignedSlot } : null;
    case "set_ready":
      return assignedSlot ? { ...command, slot: assignedSlot } : null;
    case "make_pick":
      return assignedSlot ? { ...command, slot: assignedSlot } : null;
    case "confirm_loadout":
      return assignedSlot ? { ...command, slot: assignedSlot } : null;
    case "request_reconnect":
      return assignedSlot ? { ...command, slot: assignedSlot } : null;
    case "complete_match":
      return assignedSlot ? command : null;
    case "create_lobby":
    case "start_draft":
    default:
      return null;
  }
}

async function handleRemoteSquadCommand(sourcePeerId: string, payload: string): Promise<void> {
  const remoteCommand = parseRemoteMatchCommand(payload);
  const currentMatch = getSquadMatchState();
  if (!remoteCommand || !currentMatch) {
    return;
  }

  let nextMatch: SquadMatchState | null = currentMatch;
  let assignedSlot = squadRemotePeerSlots.get(sourcePeerId) ?? null;

  if (remoteCommand.type === "join_lobby") {
    const reconnectSlot = assignedSlot ?? findReconnectableSquadSlot(currentMatch, remoteCommand.callsign);
    if (reconnectSlot) {
      nextMatch = applySquadMatchCommand(currentMatch, {
        type: "request_reconnect",
        slot: reconnectSlot,
      });
      assignedSlot = reconnectSlot;
    } else {
      const requestedSlot = remoteCommand.slot ?? getNextOpenSquadSlot(currentMatch) ?? undefined;
      nextMatch = applySquadMatchCommand(currentMatch, {
        ...remoteCommand,
        slot: requestedSlot,
      });
      assignedSlot = requestedSlot ?? (nextMatch ? getAssignedRemoteSlot(currentMatch, nextMatch, remoteCommand.callsign) : null);
    }
    if (assignedSlot) {
      squadRemotePeerSlots.set(sourcePeerId, assignedSlot);
      await sendSquadTransportMessage(
        "slot_assignment",
        JSON.stringify({ slot: assignedSlot }),
        sourcePeerId,
      );
    }
    commitSquadMatchUpdate(
      nextMatch ? getTransportAwareMatchState(nextMatch, "P1") : null,
      activeCommsReturnTo,
      assignedSlot
        ? reconnectSlot
          ? `${remoteCommand.callsign} rejoined ${assignedSlot}.`
          : `${remoteCommand.callsign} linked to ${assignedSlot}.`
        : `${remoteCommand.callsign} requested a host link.`,
      "success",
    );
    return;
  }

  const normalizedCommand = normalizeRemoteMatchCommand(remoteCommand, assignedSlot);
  if (!normalizedCommand) {
    return;
  }

  nextMatch = applySquadMatchCommand(currentMatch, normalizedCommand);
  if (normalizedCommand.type === "leave_lobby" && assignedSlot) {
    squadRemotePeerSlots.delete(sourcePeerId);
  }

  commitSquadMatchUpdate(
    nextMatch ? getTransportAwareMatchState(nextMatch, "P1") : null,
    activeCommsReturnTo,
  );
}

type LobbyCommand =
  | { type: "lobby_join"; callsign: string }
  | { type: "leave_lobby" }
  | { type: "avatar_update"; mapId: string; x: number; y: number; facing: "north" | "south" | "east" | "west" }
  | { type: "challenge_request"; challengeeSlot: NetworkPlayerSlot; playlist: SkirmishPlaylist }
  | { type: "challenge_response"; accepted: boolean }
  | { type: "challenge_cancel" }
  | { type: "launch_coop_operations"; selectedSlots?: NetworkPlayerSlot[] }
  | { type: "begin_coop_operations" }
  | { type: "update_coop_selection"; selectedSlots: NetworkPlayerSlot[] }
  | { type: "skirmish_next_round"; decision: LobbySkirmishIntermissionDecision }
  | { type: "coop_theater_command"; command: CoopTheaterCommand }
  | { type: "request_lobby_snapshot" };

function parseLobbyCommand(payload: string): LobbyCommand | null {
  try {
    return JSON.parse(payload) as LobbyCommand;
  } catch {
    return null;
  }
}

function createDraftReadySkirmishMatch(lobby: LobbyState, playlist: SkirmishPlaylist): SquadMatchState {
  const firstRound = playlist.rounds[0] ?? {
    id: `round_${Date.now().toString(36)}`,
    gridWidth: 8,
    gridHeight: 5,
    objectiveType: "elimination" as const,
  };
  const challengerCallsign = lobby.pendingChallenge?.challengerCallsign ?? getLocalLobbyCallsign(lobby);
  const challengeeCallsign = lobby.pendingChallenge?.challengeeCallsign ?? "CHALLENGER";
  let match = createSkirmishMatchFromPlaylist(challengerCallsign, challengeeCallsign, firstRound);
  match = {
    ...match,
    members: {
      ...match.members,
      P1: match.members.P1 ? { ...match.members.P1, ready: true } : match.members.P1,
      P2: match.members.P2 ? { ...match.members.P2, ready: true } : match.members.P2,
    },
  };
  return applySquadMatchCommand(match, { type: "start_draft" }) ?? match;
}

function createNextPlaylistMatch(
  currentLobby: LobbyState,
  previousMatch: SquadMatchState,
  decision: LobbySkirmishIntermissionDecision,
): SquadMatchState | null {
  if (currentLobby.activity.kind !== "skirmish") {
    return null;
  }
  const nextRound = currentLobby.activity.skirmish.playlist.rounds[currentLobby.activity.skirmish.currentRoundIndex + 1];
  if (!nextRound) {
    return null;
  }
  let nextMatch = createSkirmishMatchFromPlaylist(
    currentLobby.activity.skirmish.challengerCallsign,
    currentLobby.activity.skirmish.challengeeCallsign,
    nextRound,
  );
  if (decision === "reuse" && previousMatch.draft) {
    nextMatch = {
      ...nextMatch,
      draft: {
        ...previousMatch.draft,
      },
      phase: "confirmation",
      confirmation: {
        confirmedSlots: [],
      },
      members: {
        ...nextMatch.members,
        P1: nextMatch.members.P1 ? { ...nextMatch.members.P1, ready: true } : nextMatch.members.P1,
        P2: nextMatch.members.P2 ? { ...nextMatch.members.P2, ready: true } : nextMatch.members.P2,
      },
    };
    return nextMatch;
  }
  nextMatch = {
    ...nextMatch,
    members: {
      ...nextMatch.members,
      P1: nextMatch.members.P1 ? { ...nextMatch.members.P1, ready: true } : nextMatch.members.P1,
      P2: nextMatch.members.P2 ? { ...nextMatch.members.P2, ready: true } : nextMatch.members.P2,
    },
  };
  return applySquadMatchCommand(nextMatch, { type: "start_draft" }) ?? nextMatch;
}

function getPreferredLobbyOperatorCallsign(): string {
  return multiplayerLobbyPreviewConfig.operatorCallsign.trim() || getGameState().profile.callsign || "OPERATOR";
}

function captureLobbyReturnContext(): LobbyReturnContext {
  if (activeCommsReturnTo === "menu") {
    return { kind: "menu" };
  }
  if (activeCommsReturnTo === "operation") {
    return { kind: "operation" };
  }
  const avatar = getGameState().players.P1.avatar;
  return {
    kind: "field",
    mapId: getBaseCampFieldReturnMap(),
    x: avatar?.x,
    y: avatar?.y,
    facing: avatar?.facing,
  };
}

async function restoreLobbyReturnContext(lobby: LobbyState | null): Promise<void> {
  const fallbackContext: LobbyReturnContext = captureLobbyReturnContext();
  const returnContext = lobby?.returnContext ?? fallbackContext;
  const normalizedReturnContext: LobbyReturnContext =
    returnContext.kind === "esc" && fallbackContext.kind === "field"
      ? fallbackContext
      : !lobby?.returnContext && returnContext.kind === "field" && returnContext.mapId === "network_lobby"
        ? { kind: "field", mapId: "base_camp" }
        : returnContext;

  if (normalizedReturnContext.kind === "menu") {
    if (document.querySelector(".field-root")) {
      const { teardownFieldMode } = await import("../../field/FieldScreen");
      teardownFieldMode();
    }
    const { renderMainMenu } = await import("./MainMenuScreen");
    await renderMainMenu();
    return;
  }

  if (normalizedReturnContext.kind === "operation") {
    const { renderOperationMapScreen } = await import("./OperationMapScreen");
    renderOperationMapScreen();
    return;
  }

  if (normalizedReturnContext.kind === "field") {
    const { renderFieldScreen, setNextFieldSpawnOverride } = await import("../../field/FieldScreen");
    if (typeof normalizedReturnContext.x === "number" && typeof normalizedReturnContext.y === "number") {
      setNextFieldSpawnOverride(normalizedReturnContext.mapId as any, {
        x: normalizedReturnContext.x,
        y: normalizedReturnContext.y,
        facing: normalizedReturnContext.facing,
      });
    }
    renderFieldScreen(normalizedReturnContext.mapId as any);
    return;
  }

  const { renderAllNodesMenuScreen } = await import("./AllNodesMenuScreen");
  renderAllNodesMenuScreen();
}

async function hostRespondToLobbyChallenge(currentLobby: LobbyState, accepted: boolean): Promise<void> {
  if (!currentLobby.pendingChallenge) {
    return;
  }

  let nextLobby = updateChallengeStatus(currentLobby, accepted ? "accepted" : "declined");
  if (accepted) {
    const startedMatch = createDraftReadySkirmishMatch(nextLobby, nextLobby.pendingChallenge!.playlist);
    nextLobby = createLobbySkirmishActivity(nextLobby, nextLobby.pendingChallenge!.playlist, startedMatch);
    const skirmishActivity = nextLobby.activity.kind === "skirmish" ? nextLobby.activity.skirmish : null;
    syncActiveSkirmishPeerMaps(nextLobby);
    commitLobbyState(
      nextLobby,
      `${skirmishActivity?.challengerCallsign ?? "Host"} vs ${skirmishActivity?.challengeeCallsign ?? "Challengee"} // draft online.`,
      "success",
      false,
    );
    commitSquadMatchUpdate(getTransportAwareMatchState(startedMatch, "P1"), activeCommsReturnTo);
    await broadcastLobbySnapshot(nextLobby);
    await broadcastSquadSnapshot(getTransportAwareMatchState(startedMatch, "P1"));
    maybeEnterLocalLobbySkirmish(nextLobby);
    return;
  }

  nextLobby = clearPendingChallenge(nextLobby);
  commitLobbyState(nextLobby, "Skirmish challenge declined.", "info", false);
  await broadcastLobbySnapshot(nextLobby);
}

async function hostAdvanceLobbySkirmishPlaylist(
  currentLobby: LobbyState,
  decision: LobbySkirmishIntermissionDecision,
): Promise<void> {
  if (currentLobby.activity.kind !== "skirmish") {
    return;
  }
  const previousMatch = getLobbyLocalSkirmishMatch(currentLobby);
  if (!previousMatch) {
    return;
  }
  const nextMatch = createNextPlaylistMatch(currentLobby, previousMatch, decision);
  if (!nextMatch) {
    const clearedLobby = clearLobbyActivity(currentLobby);
    commitLobbyState(clearedLobby, "Skirmish playlist complete. Returning fighters to the lobby.", "success", false);
    await broadcastLobbySnapshot(clearedLobby);
    clearSquadMatchState();
    activeSkirmishSurface = "comms";
    return;
  }

  let nextLobby = chooseLobbySkirmishNextRoundDecision(currentLobby, decision);
  nextLobby = advanceLobbySkirmishRound(nextLobby, nextMatch);
  syncActiveSkirmishPeerMaps(nextLobby);
  commitLobbyState(
    nextLobby,
    `Playlist round ${nextLobby.activity.kind === "skirmish" ? nextLobby.activity.skirmish.currentRoundIndex + 1 : 1} ready.`,
    "success",
    false,
  );
  commitSquadMatchUpdate(getTransportAwareMatchState(nextMatch, "P1"), activeCommsReturnTo);
  await broadcastLobbySnapshot(nextLobby);
  await broadcastSquadSnapshot(getTransportAwareMatchState(nextMatch, "P1"));
  maybeEnterLocalLobbySkirmish(nextLobby);
}

async function hostLaunchLobbyCoopOperations(currentLobby: LobbyState, selectedSlots?: NetworkPlayerSlot[]): Promise<void> {
  const normalizedSlots = (selectedSlots?.length
    ? selectedSlots
    : NETWORK_PLAYER_SLOTS.filter((slot) => Boolean(currentLobby.members[slot]?.connected))) as NetworkPlayerSlot[];
  const nextLobby = currentLobby.activity.kind === "coop_operations"
    ? updateCoopOperationsSelection(currentLobby, normalizedSlots)
    : startCoopOperationsActivity(currentLobby, normalizedSlots);
  commitLobbyState(
    nextLobby,
    currentLobby.activity.kind === "coop_operations"
      ? "Co-Op Operations staging updated."
      : "Co-Op Operations staging opened in the lobby.",
    "success",
    false,
  );
  await broadcastLobbySnapshot(nextLobby);
}

function hydrateCoopOperationFromLobby(lobby: LobbyState): OperationRun | null {
  if (lobby.activity.kind !== "coop_operations") {
    return null;
  }
  const parsedOperation = parseCoopOperationSnapshot(lobby.activity.coopOperations.operationSnapshot);
  const parsedBattle = parseCoopBattleSnapshot(lobby.activity.coopOperations.battleSnapshot);
  updateGameState((state) => {
    const nextState = launchCoopOperationsSessionFromLobby(state, lobby);
    if (parsedBattle) {
      return {
        ...nextState,
        operation: parsedOperation ?? nextState.operation,
        currentBattle: parsedBattle,
        phase: "battle",
      };
    }
    return {
      ...nextState,
      operation: parsedOperation ?? nextState.operation,
      currentBattle: null,
      phase: lobby.activity.coopOperations.operationPhase ?? nextState.phase,
    };
  });
  return parsedOperation;
}

function hydrateCoopBattleFromLobby(lobby: LobbyState): RuntimeBattleState | null {
  if (lobby.activity.kind !== "coop_operations") {
    return null;
  }
  return parseCoopBattleSnapshot(lobby.activity.coopOperations.battleSnapshot);
}

async function enterActiveCoopOperations(lobby: LobbyState): Promise<void> {
  if (lobby.activity.kind !== "coop_operations" || lobby.activity.coopOperations.status !== "active") {
    return;
  }
  const localParticipant = lobby.localSlot ? lobby.activity.coopOperations.participants[lobby.localSlot] : null;
  if (!localParticipant?.selected) {
    return;
  }
  const parsedOperation = hydrateCoopOperationFromLobby(lobby);
  const parsedBattle = hydrateCoopBattleFromLobby(lobby);
  const targetMapId = localParticipant?.lastSafeMapId ?? "base_camp";
  const operationPhase = lobby.activity.coopOperations.operationPhase ?? null;
  if (parsedBattle && operationPhase === "battle") {
    applyExternalBattleState(parsedBattle, "always");
    return;
  }
  if (parsedOperation && (operationPhase === "loadout" || operationPhase === "operation")) {
    if (operationPhase === "loadout") {
      renderLoadoutScreen();
      return;
    }
    const { renderOperationMapScreen } = await import("./OperationMapScreen");
    renderOperationMapScreen();
    return;
  }
  if (document.querySelector(".network-lobby-overlay") || isCommsArrayMounted() || document.querySelector(".field-root")) {
    const { renderFieldScreen } = await import("../../field/FieldScreen");
    renderFieldScreen(targetMapId as any);
  }
}

async function hostBeginLobbyCoopOperations(currentLobby: LobbyState): Promise<void> {
  if (currentLobby.activity.kind !== "coop_operations") {
    await hostLaunchLobbyCoopOperations(currentLobby);
    return;
  }
  const nextLobby = launchCoopOperationsActivity(currentLobby);
  commitLobbyState(nextLobby, "Co-Op Operations linked into shared H.A.V.E.N.", "success", false);
  await broadcastLobbySnapshot(nextLobby);
  await enterActiveCoopOperations(nextLobby);
}

async function sendLobbyCommandToHost(command: LobbyCommand): Promise<void> {
  if (!isTauriSquadTransportAvailable() || squadTransportStatus.role !== "client") {
    return;
  }
  await sendSquadTransportMessage("lobby_command", JSON.stringify(command));
}

let lastLobbyAvatarBroadcastAt = 0;
let lastLobbyAvatarSignature = "";

export async function hostOrPreviewMultiplayerLobby(callsign = getPreferredLobbyOperatorCallsign()): Promise<LobbyState | null> {
  ensureCoopOperationsStateSync();
  if (isTauriSquadTransportAvailable()) {
    squadTransportStatus = await startSquadTransportHost();
  }
  lobbyClientAssignedSlot = "P1";
  activeSkirmishSurface = "comms";
  clearSquadMatchState();
  const lobby = createHostedMultiplayerLobby(callsign, captureLobbyReturnContext());
  commitLobbyState(
    lobby,
    isTauriSquadTransportAvailable() && squadTransportStatus.role === "host"
      ? `Lobby initialized at ${squadTransportStatus.joinAddress ?? "host transport"}.`
      : "Lobby initialized.",
    "success",
    false,
  );
  await broadcastLobbySnapshot(lobby);
  await openNetworkLobbyField();
  return lobby;
}

export async function joinMultiplayerLobby(hostAddress: string, callsign = getPreferredLobbyOperatorCallsign()): Promise<LobbyState | null> {
  ensureCoopOperationsStateSync();
  if (!isTauriSquadTransportAvailable()) {
    throw new Error("Remote lobby join is only available in the desktop build.");
  }
  const normalizedAddress = hostAddress.trim();
  if (!normalizedAddress) {
    throw new Error("Enter a host address before joining.");
  }

  squadTransportStatus = await startSquadTransportJoin(normalizedAddress);
  lobbyClientAssignedSlot = "P2";
  activeSkirmishSurface = "comms";
  pendingRemoteSkirmishBattlePayload = null;
  shouldAutoResumeRemoteSkirmishBattle = true;
  clearSquadMatchState();
  const joiningLobby = createJoiningMultiplayerLobby(callsign, captureLobbyReturnContext());
  commitLobbyState(joiningLobby, undefined, "info", false);
  await sendLobbyCommandToHost({ type: "lobby_join", callsign });
  await openNetworkLobbyField();
  return joiningLobby;
}

export async function disconnectMultiplayerLobby(renderAfterDisconnect = true): Promise<void> {
  if (isTauriSquadTransportAvailable() && squadTransportStatus.role !== "idle") {
    squadTransportStatus = await stopSquadTransport();
  }
  activeSkirmishSurface = "comms";
  pendingRemoteSkirmishBattlePayload = null;
  shouldAutoResumeRemoteSkirmishBattle = false;
  clearSquadMatchState();
  clearLobbyState();
  updateGameState((state) => {
    const clearedState = clearCoopOperationsSession(state);
    const shouldClearSquadBattle = state.currentBattle?.modeContext?.kind === "squad";
    return {
      ...clearedState,
      currentBattle: shouldClearSquadBattle ? null : clearedState.currentBattle,
      phase: shouldClearSquadBattle && state.session.mode !== "coop_operations" ? "shell" : clearedState.phase,
      lobby: null,
    };
  });
  applyExternalBattleState(null, "if_mounted");
  if (renderAfterDisconnect) {
    renderCommsArrayScreen(activeCommsReturnTo);
  }
}

export async function leaveCurrentMultiplayerLobby(): Promise<void> {
  const lobby = getResolvedLobbyState();
  if (squadTransportStatus.role === "client" && lobby) {
    await sendLobbyCommandToHost({ type: "leave_lobby" });
  }
  await disconnectMultiplayerLobby(false);
  await restoreLobbyReturnContext(lobby);
}

export async function syncLocalLobbyAvatarFromField(
  mapId: string,
  x: number,
  y: number,
  facing: "north" | "south" | "east" | "west",
): Promise<void> {
  const lobby = getResolvedLobbyState();
  const localSlot = getLocalLobbySlot(lobby);
  if (!lobby || !localSlot) {
    return;
  }
  if (
    lobby.activity.kind === "coop_operations"
    && lobby.activity.coopOperations.status === "active"
    && !lobby.activity.coopOperations.participants[localSlot]?.selected
  ) {
    return;
  }
  const roundedX = Math.round(x);
  const roundedY = Math.round(y);
  const signature = `${localSlot}:${mapId}:${roundedX}:${roundedY}:${facing}`;
  const now = performance.now();
  if (signature === lastLobbyAvatarSignature && now - lastLobbyAvatarBroadcastAt < 100) {
    return;
  }
  lastLobbyAvatarSignature = signature;
  lastLobbyAvatarBroadcastAt = now;

  const nextLobby = updateLobbyAvatar(lobby, localSlot, {
    x: roundedX,
    y: roundedY,
    facing,
    mapId,
    updatedAt: Date.now(),
  });
  commitLobbyState(nextLobby, undefined, "info", false);
  if (squadTransportStatus.role === "host") {
    await broadcastLobbySnapshot(nextLobby);
    return;
  }
  if (squadTransportStatus.role === "client") {
    await sendLobbyCommandToHost({
      type: "avatar_update",
      mapId,
      x: roundedX,
      y: roundedY,
      facing,
    });
  }
}

export async function requestLobbySkirmishChallenge(
  challengeeSlot: NetworkPlayerSlot,
  playlist: SkirmishPlaylist,
): Promise<void> {
  const lobby = getResolvedLobbyState();
  const localSlot = getLocalLobbySlot(lobby);
  if (!lobby || !localSlot || lobby.activity.kind !== "idle") {
    return;
  }
  if (squadTransportStatus.role === "client") {
    await sendLobbyCommandToHost({ type: "challenge_request", challengeeSlot, playlist });
    return;
  }
  const nextLobby = createPendingSkirmishChallenge(lobby, localSlot, challengeeSlot, playlist);
  commitLobbyState(
    nextLobby,
    `${nextLobby.pendingChallenge?.challengerCallsign ?? "Operator"} challenged ${nextLobby.pendingChallenge?.challengeeCallsign ?? challengeeSlot}.`,
    "info",
    false,
  );
  await broadcastLobbySnapshot(nextLobby);
}

export async function respondToLobbyChallenge(accepted: boolean): Promise<void> {
  const lobby = getResolvedLobbyState();
  if (!lobby?.pendingChallenge) {
    return;
  }
  if (squadTransportStatus.role === "client") {
    await sendLobbyCommandToHost({ type: "challenge_response", accepted });
    return;
  }
  await hostRespondToLobbyChallenge(lobby, accepted);
}

export async function cancelLobbyChallenge(): Promise<void> {
  const lobby = getResolvedLobbyState();
  if (!lobby?.pendingChallenge) {
    return;
  }
  if (squadTransportStatus.role === "client") {
    await sendLobbyCommandToHost({ type: "challenge_cancel" });
    return;
  }
  const nextLobby = clearPendingChallenge(lobby);
  commitLobbyState(nextLobby, "Pending skirmish challenge cancelled.", "info", false);
  await broadcastLobbySnapshot(nextLobby);
}

export async function chooseLobbySkirmishNextRound(decision: LobbySkirmishIntermissionDecision): Promise<void> {
  const lobby = getResolvedLobbyState();
  if (!lobby || lobby.activity.kind !== "skirmish") {
    return;
  }
  if (squadTransportStatus.role === "client") {
    await sendLobbyCommandToHost({ type: "skirmish_next_round", decision });
    return;
  }
  await hostAdvanceLobbySkirmishPlaylist(lobby, decision);
}

export async function launchLobbyCoopOperations(selectedSlots: NetworkPlayerSlot[]): Promise<void> {
  const lobby = getResolvedLobbyState();
  if (!lobby || !canLocalHostLobby(lobby)) {
    return;
  }
  await hostLaunchLobbyCoopOperations(lobby, selectedSlots);
}

export async function beginLobbyCoopOperations(): Promise<void> {
  const lobby = getResolvedLobbyState();
  if (!lobby || !canLocalHostLobby(lobby)) {
    return;
  }
  await hostBeginLobbyCoopOperations(lobby);
}

export async function openSharedCoopOperationsEntry(): Promise<boolean> {
  ensureCoopOperationsStateSync();
  const lobby = getResolvedLobbyState();
  if (!lobby || lobby.activity.kind !== "coop_operations" || lobby.activity.coopOperations.status !== "active") {
    return false;
  }
  const localSlot = getLocalLobbySlot(lobby);
  const localParticipant = localSlot ? lobby.activity.coopOperations.participants[localSlot] : null;
  if (!localParticipant?.selected) {
    showNotification("This operator is not assigned to the active Co-Op Operations run.", "info");
    return true;
  }
  if (!lobby.activity.coopOperations.operationSnapshot) {
    if (canLocalHostLobby(lobby)) {
      const { renderOperationSelectScreen } = await import("./OperationSelectScreen");
      renderOperationSelectScreen("field");
    } else {
      showNotification("Awaiting host operation deployment from H.A.V.E.N.", "info");
    }
    return true;
  }
  await enterActiveCoopOperations(lobby);
  return true;
}

export async function updateLobbyCoopSelectionFromField(selectedSlots: NetworkPlayerSlot[]): Promise<void> {
  const lobby = getResolvedLobbyState();
  if (!lobby || lobby.activity.kind !== "coop_operations") {
    return;
  }
  if (squadTransportStatus.role === "client") {
    await sendLobbyCommandToHost({ type: "update_coop_selection", selectedSlots });
    return;
  }
  const nextLobby = updateCoopOperationsSelection(lobby, selectedSlots);
  commitLobbyState(nextLobby, undefined, "info", false);
  await broadcastLobbySnapshot(nextLobby);
}

export function openCurrentLobbySkirmish(): void {
  const lobby = getResolvedLobbyState();
  maybeEnterLocalLobbySkirmish(lobby);
}

async function handleRemoteLobbyCommand(sourcePeerId: string, payload: string): Promise<void> {
  const command = parseLobbyCommand(payload);
  const currentLobby = getResolvedLobbyState();
  if (!command || (!currentLobby && command.type !== "lobby_join")) {
    return;
  }

  let nextLobby = currentLobby!;

  switch (command.type) {
    case "lobby_join": {
      const reconnectSlot = currentLobby ? findReconnectableLobbySlot(currentLobby, command.callsign) : null;
      const assignedSlot = reconnectSlot ?? (currentLobby ? findNextOpenLobbySlot(currentLobby) : null);
      if (!currentLobby || !assignedSlot) {
        return;
      }
      nextLobby = upsertLobbyMember(
        currentLobby,
        assignedSlot,
        command.callsign,
        "client",
        "remote",
      );
      lobbyRemotePeerSlots.set(sourcePeerId, assignedSlot);
      await sendSquadTransportMessage(
        "slot_assignment",
        JSON.stringify({ slot: assignedSlot }),
        sourcePeerId,
      );
      commitLobbyState(nextLobby, `${command.callsign} linked to ${assignedSlot}.`, "success", false);
      await broadcastLobbySnapshot(nextLobby);
      return;
    }
    case "leave_lobby": {
      const assignedSlot = lobbyRemotePeerSlots.get(sourcePeerId);
      if (!assignedSlot || !currentLobby) {
        return;
      }
      lobbyRemotePeerSlots.delete(sourcePeerId);
      nextLobby = removeLobbyMember(currentLobby, assignedSlot);
      commitLobbyState(nextLobby, `${assignedSlot} left the lobby.`, "info", false);
      await broadcastLobbySnapshot(nextLobby);
      return;
    }
    case "avatar_update": {
      const assignedSlot = lobbyRemotePeerSlots.get(sourcePeerId);
      if (!assignedSlot || !currentLobby) {
        return;
      }
      nextLobby = updateLobbyAvatar(currentLobby, assignedSlot, {
        mapId: command.mapId,
        x: command.x,
        y: command.y,
        facing: command.facing,
        updatedAt: Date.now(),
      });
      commitLobbyState(nextLobby, undefined, "info", false);
      await broadcastLobbySnapshot(nextLobby);
      return;
    }
    case "challenge_request": {
      const challengerSlot = lobbyRemotePeerSlots.get(sourcePeerId);
      if (!challengerSlot || !currentLobby || currentLobby.activity.kind !== "idle") {
        return;
      }
      nextLobby = createPendingSkirmishChallenge(currentLobby, challengerSlot, command.challengeeSlot, command.playlist);
      commitLobbyState(nextLobby, `${nextLobby.pendingChallenge?.challengerCallsign ?? "Operator"} challenged ${nextLobby.pendingChallenge?.challengeeCallsign ?? command.challengeeSlot}.`, "info", false);
      await broadcastLobbySnapshot(nextLobby);
      return;
    }
    case "challenge_response": {
      if (!currentLobby) {
        return;
      }
      await hostRespondToLobbyChallenge(currentLobby, command.accepted);
      return;
    }
    case "challenge_cancel": {
      if (!currentLobby) {
        return;
      }
      nextLobby = clearPendingChallenge(currentLobby);
      commitLobbyState(nextLobby, "Pending skirmish challenge cancelled.", "info", false);
      await broadcastLobbySnapshot(nextLobby);
      return;
    }
    case "launch_coop_operations": {
      const sourceSlot = lobbyRemotePeerSlots.get(sourcePeerId) ?? null;
      if (!currentLobby || currentLobby.hostSlot !== sourceSlot) {
        return;
      }
      await hostLaunchLobbyCoopOperations(currentLobby, command.selectedSlots);
      return;
    }
    case "begin_coop_operations": {
      const sourceSlot = lobbyRemotePeerSlots.get(sourcePeerId) ?? null;
      if (!currentLobby || currentLobby.hostSlot !== sourceSlot) {
        return;
      }
      await hostBeginLobbyCoopOperations(currentLobby);
      return;
    }
    case "update_coop_selection": {
      if (!currentLobby || currentLobby.activity.kind !== "coop_operations") {
        return;
      }
      nextLobby = updateCoopOperationsSelection(currentLobby, command.selectedSlots);
      commitLobbyState(nextLobby, undefined, "info", false);
      await broadcastLobbySnapshot(nextLobby);
      return;
    }
    case "skirmish_next_round": {
      if (!currentLobby) {
        return;
      }
      await hostAdvanceLobbySkirmishPlaylist(currentLobby, command.decision);
      return;
    }
    case "coop_theater_command": {
      const sourceSlot = lobbyRemotePeerSlots.get(sourcePeerId) ?? null;
      if (
        !currentLobby
        || currentLobby.activity.kind !== "coop_operations"
        || currentLobby.activity.coopOperations.status !== "active"
        || !sourceSlot
      ) {
        return;
      }
      const participant = currentLobby.activity.coopOperations.participants[sourceSlot];
      if (!participant?.selected || !participant.sessionSlot) {
        return;
      }
      const { applyRemoteCoopTheaterCommand } = await import("./TheaterCommandScreen");
      applyRemoteCoopTheaterCommand(command.command, participant.sessionSlot);
      return;
    }
    case "request_lobby_snapshot": {
      await broadcastLobbySnapshot(currentLobby, sourcePeerId);
      return;
    }
    default:
      return;
  }
}

async function handleSquadTransportMessage(event: SquadTransportEvent): Promise<void> {
  switch (event.messageKind) {
    case "lobby_snapshot": {
      const parsedLobby = parseLobbySnapshot(event.payload ?? "");
      if (!parsedLobby) {
        return;
      }
      const nextLobby: LobbyState = {
        ...parsedLobby,
        localSlot: squadTransportStatus.role === "client" ? lobbyClientAssignedSlot : parsedLobby.localSlot,
        transportState: squadTransportStatus.role === "host"
          ? "hosting"
          : squadTransportStatus.role === "client"
            ? "connected"
            : parsedLobby.transportState,
      };
      syncActiveSkirmishPeerMaps(nextLobby);
      commitLobbyState(nextLobby, undefined, "info", false);
      maybeEnterLocalLobbySkirmish(nextLobby);
      if (nextLobby.activity.kind === "coop_operations" && nextLobby.activity.coopOperations.status === "active") {
        await enterActiveCoopOperations(nextLobby);
        return;
      }
      if (document.querySelector(".field-root")) {
        const { renderFieldScreen } = await import("../../field/FieldScreen");
        renderFieldScreen("network_lobby");
      }
      return;
    }
    case "snapshot": {
      const parsedSnapshot = parseSquadMatchSnapshot(event.payload ?? "");
      if (!parsedSnapshot) {
        return;
      }
      const nextMatch = getTransportAwareMatchState(
        rehydrateSquadMatchState(
          parsedSnapshot,
          squadTransportStatus.role === "client" ? squadClientAssignedSlot : "P1",
        ),
      );
      activeSkirmishSurface = nextMatch.phase === "lobby" ? "comms" : "staging";
      saveSquadMatchState(nextMatch);
      if (consumePendingRemoteSkirmishBattle(nextMatch, "always")) {
        return;
      }
      if (isCommsArrayMounted()) {
        renderActiveSkirmishScreen(activeCommsReturnTo);
      }
      return;
    }
    case "session_reset": {
      pendingRemoteSkirmishBattlePayload = null;
      shouldAutoResumeRemoteSkirmishBattle = false;
      clearSquadMatchState();
      activeSkirmishSurface = "comms";
      if (getGameState().currentBattle?.modeContext?.kind === "squad") {
        updateGameState((prev) => ({
          ...prev,
          currentBattle: null,
          phase: "shell",
        }));
        applyExternalBattleState(null, "if_mounted");
      }
      if (isCommsArrayMounted() || document.querySelector(".battle-root")) {
        renderCommsArrayScreen(activeCommsReturnTo);
      }
      return;
    }
    case "slot_assignment": {
      try {
        const parsed = JSON.parse(event.payload ?? "{}") as { slot?: string };
        if (parsed.slot && NETWORK_PLAYER_SLOTS.includes(parsed.slot as NetworkPlayerSlot)) {
          lobbyClientAssignedSlot = parsed.slot as NetworkPlayerSlot;
          const currentLobby = getResolvedLobbyState();
          if (currentLobby) {
            commitLobbyState(setLobbyLocalSlot(currentLobby, lobbyClientAssignedSlot), undefined, "info", false);
          }
        }
        if (parsed.slot && SESSION_PLAYER_SLOTS.includes(parsed.slot as SessionPlayerSlot)) {
          squadClientAssignedSlot = parsed.slot as SessionPlayerSlot;
          syncStoredSquadMatchTransportState();
          if (isCommsArrayMounted()) {
            renderActiveSkirmishScreen(activeCommsReturnTo);
          }
        }
      } catch {
        // Ignore malformed slot assignment payloads.
      }
      return;
    }
    case "request_snapshot": {
      const currentMatch = getSquadMatchState();
      const currentLobby = getResolvedLobbyState();
      await broadcastLobbySnapshot(currentLobby, event.sourcePeerId);
      await broadcastSquadSnapshot(currentMatch ? getTransportAwareMatchState(currentMatch, "P1") : null, event.sourcePeerId);
      const currentBattle = getGameState().currentBattle;
      if (currentMatch && currentBattle?.modeContext?.kind === "squad") {
        await sendSquadTransportMessage(
          "battle_snapshot",
          createSquadBattlePayload(currentMatch, currentBattle),
          event.sourcePeerId,
        );
      }
      return;
    }
    case "battle_start": {
      const currentMatch = getSquadMatchState();
      if (!event.payload) {
        return;
      }
      const lobby = getResolvedLobbyState();
      if (lobby?.activity.kind === "skirmish") {
        commitLobbyState(updateLobbySkirmishBattlePayload(lobby, event.payload), undefined, "info", false);
      }
      if (!currentMatch) {
        pendingRemoteSkirmishBattlePayload = event.payload;
        shouldAutoResumeRemoteSkirmishBattle = true;
        return;
      }
      pendingRemoteSkirmishBattlePayload = null;
      shouldAutoResumeRemoteSkirmishBattle = false;
      enterSquadBattle(currentMatch, event.payload, "always");
      return;
    }
    case "battle_snapshot": {
      const currentMatch = getSquadMatchState();
      if (!event.payload) {
        return;
      }
      const lobby = getResolvedLobbyState();
      if (lobby?.activity.kind === "skirmish") {
        commitLobbyState(updateLobbySkirmishBattlePayload(lobby, event.payload), undefined, "info", false);
      }
      if (!currentMatch) {
        pendingRemoteSkirmishBattlePayload = event.payload;
        return;
      }
      pendingRemoteSkirmishBattlePayload = null;
      const renderMode = shouldAutoResumeRemoteSkirmishBattle ? "always" : "if_mounted";
      shouldAutoResumeRemoteSkirmishBattle = false;
      enterSquadBattle(currentMatch, event.payload, renderMode);
      return;
    }
    case "battle_command": {
      if (squadTransportStatus.role === "host" && event.sourcePeerId && event.payload) {
        const sourceSlot = squadRemotePeerSlots.get(event.sourcePeerId);
        if (sourceSlot) {
          applyRemoteSquadBattleCommand(sourceSlot, event.payload);
        }
      }
      return;
    }
    case "command": {
      if (squadTransportStatus.role === "host" && event.sourcePeerId) {
        await handleRemoteSquadCommand(event.sourcePeerId, event.payload ?? "");
      }
      return;
    }
    case "lobby_command": {
      if (squadTransportStatus.role === "host" && event.sourcePeerId) {
        await handleRemoteLobbyCommand(event.sourcePeerId, event.payload ?? "");
      }
      return;
    }
    default:
      return;
  }
}

async function handleSquadTransportEvent(event: SquadTransportEvent): Promise<void> {
  squadTransportStatus = event.status;

  switch (event.type) {
    case "peer_connected": {
      const currentLobby = getResolvedLobbyState();
      if (currentLobby) {
        await broadcastLobbySnapshot(currentLobby, event.sourcePeerId);
      }
      const currentMatch = getSquadMatchState();
      if (currentMatch) {
        await broadcastSquadSnapshot(getTransportAwareMatchState(currentMatch, "P1"), event.sourcePeerId);
        const currentBattle = getGameState().currentBattle;
        if (currentBattle?.modeContext?.kind === "squad") {
          await sendSquadTransportMessage(
            "battle_snapshot",
            createSquadBattlePayload(currentMatch, currentBattle),
            event.sourcePeerId,
          );
        }
      }
      if (event.detail) {
        showNotification(event.detail, "info");
      }
      break;
    }
    case "client_connected": {
      if (squadTransportStatus.role === "client") {
        shouldAutoResumeRemoteSkirmishBattle = true;
        try {
          await sendSquadTransportMessage("request_lobby_snapshot", "");
          await sendSquadTransportMessage("request_snapshot", "");
        } catch {
          // The host request can fail transiently during reconnect attempts; keep the transport alive.
        }
      }
      if (event.detail) {
        showNotification(event.detail, "info");
      }
      break;
    }
    case "peer_disconnected": {
      if (event.sourcePeerId) {
        const remoteLobbySlot = lobbyRemotePeerSlots.get(event.sourcePeerId) ?? null;
        if (remoteLobbySlot) {
          lobbyRemotePeerSlots.delete(event.sourcePeerId);
          const currentLobby = getResolvedLobbyState();
          if (currentLobby) {
            const nextLobby = markLobbyMemberDisconnected(currentLobby, remoteLobbySlot);
            commitLobbyState(nextLobby, `${remoteLobbySlot} lost link to the multiplayer lobby.`, "info", false);
            void broadcastLobbySnapshot(nextLobby);
          }
        }
        const remoteSlot = squadRemotePeerSlots.get(event.sourcePeerId) ?? null;
        if (remoteSlot) {
          squadRemotePeerSlots.delete(event.sourcePeerId);
          const currentMatch = getSquadMatchState();
          if (currentMatch) {
            const nextMatch = markSquadMemberDisconnected(currentMatch, remoteSlot);
            const rerender = getGameState().currentBattle?.modeContext?.kind !== "squad";
            commitSquadMatchUpdate(
              nextMatch ? getTransportAwareMatchState(nextMatch, "P1") : null,
              activeCommsReturnTo,
              `${remoteSlot} lost link to the skirmish transport.`,
              "info",
              rerender,
            );
            return;
          }
        }
      }
      break;
    }
    case "message":
      await handleSquadTransportMessage(event);
      return;
    case "error":
      if (event.detail) {
        showNotification(event.detail, "error");
      }
      break;
    case "host_started":
    case "stopped":
    default:
      if (event.detail) {
        showNotification(event.detail, "info");
      }
      break;
  }

  syncStoredSquadMatchTransportState();
  if (isCommsArrayMounted()) {
    renderActiveSkirmishScreen(activeCommsReturnTo);
  }
}

function ensureSquadTransportIntegration(returnTo: CommsReturnTo): void {
  activeCommsReturnTo = returnTo;
  ensureCoopOperationsStateSync();
  if (!isTauriSquadTransportAvailable()) {
    return;
  }
  if (!squadTransportSubscribed) {
    squadTransportSubscribed = true;
    void subscribeToSquadTransportEvents((event) => handleSquadTransportEvent(event));
  }
  if (squadTransportStatusHydrated) {
    return;
  }
  squadTransportStatusHydrated = true;
  void getSquadTransportStatus().then((status) => {
    squadTransportStatus = status;
    syncStoredSquadMatchTransportState();
    if (status.role === "client") {
      const storedMatch = getSquadMatchState();
      shouldAutoResumeRemoteSkirmishBattle = storedMatch?.phase === "battle";
      void sendSquadTransportMessage("request_lobby_snapshot", "").catch(() => {
        // Lobby hydration can race host availability; the live event stream will retry on reconnect.
      });
      void sendSquadTransportMessage("request_snapshot", "").catch(() => {
        // Transport hydration can race host availability; the live event stream will retry on reconnect.
      });
    }
    if (isCommsArrayMounted()) {
      renderActiveSkirmishScreen(activeCommsReturnTo);
    }
  });
}

function renderSkirmishMemberSummaryCard(match: SquadMatchState, slot: SessionPlayerSlot): string {
  const member = match.members[slot];
  if (!member) {
    return `
      <div class="echo-run-summary-card">
        <div class="echo-run-summary-card__title">${slot}</div>
        <div class="echo-run-summary-card__meta">OPEN SLOT</div>
        <div class="echo-run-empty">Awaiting remote link.</div>
      </div>
    `;
  }

  const picks = (match.draft?.picks ?? []).filter((pick) => pick.slot === slot);
  const pickLabels = picks.map((pick) => getSkirmishPickLabel(pick.category, pick.optionId));
  const confirmationLabel = match.phase === "confirmation"
    ? (match.confirmation.confirmedSlots.includes(slot) ? "CONFIRMED" : "AWAITING CONFIRM")
    : match.phase === "battle"
      ? "DEPLOYMENT READY"
      : match.phase === "result"
        ? "RESULT ARCHIVED"
        : member.ready
          ? "READY"
          : "STAGING";

  return `
    <div class="echo-run-summary-card">
      <div class="echo-run-summary-card__title">${escapeHtml(member.callsign)}</div>
      <div class="echo-run-summary-card__meta">${slot} | ${member.authorityRole.toUpperCase()} | ${member.presence.toUpperCase()}</div>
      <div class="echo-run-tag-row">
        <span class="echo-run-tag">${confirmationLabel}</span>
        ${pickLabels.slice(0, 2).map((label) => `<span class="echo-run-tag">${escapeHtml(label)}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderSkirmishLedger(match: SquadMatchState): string {
  if (!match.draft || match.draft.picks.length === 0) {
    return `<div class="echo-run-empty">No draft picks locked yet.</div>`;
  }

  return match.draft.pickOrder.map((slot) => {
    const member = match.members[slot];
    const picks = match.draft?.picks.filter((pick) => pick.slot === slot) ?? [];
    return `
      <div class="echo-run-summary-card">
        <div class="echo-run-summary-card__title">${escapeHtml(member?.callsign ?? slot)}</div>
        <div class="echo-run-summary-card__meta">${slot} | PICKS ${picks.length}/${match.rules.targetSquadSize}</div>
        <div class="echo-run-tag-row">
          ${picks.length > 0
            ? picks.map((pick) => `<span class="echo-run-tag">${escapeHtml(getSkirmishPickLabel(pick.category, pick.optionId))}</span>`).join("")
            : `<span class="echo-run-tag">WAITING</span>`}
        </div>
      </div>
    `;
  }).join("");
}

function renderSkirmishNetworkPanel(match: SquadMatchState): string {
  const transportSummary = isTauriSquadTransportAvailable()
    ? squadTransportStatus.role === "host"
      ? `Host live at ${squadTransportStatus.joinAddress ?? "address pending"} with ${squadTransportStatus.connectedPeerIds.length} remote link(s).`
      : squadTransportStatus.role === "client"
        ? `Client linked to ${(squadTransportStatus.hostAddress ?? multiplayerLobbyPreviewConfig.joinAddress) || "awaiting host"}.`
        : "Desktop transport is ready for hosting or joining."
    : "Browser preview mode is active. Run inside the desktop app for live host-client transport.";

  return `
    <div class="echo-run-summary-card">
      <div class="echo-run-summary-card__title">Join Code</div>
      <div class="echo-run-summary-card__meta echo-run-summary-card__meta--join-code">${escapeHtml(match.joinCode)}</div>
      <div class="echo-run-summary-card__copy">${escapeHtml(getSquadLobbySummary(match))}</div>
    </div>
    <div class="echo-run-summary-card">
      <div class="echo-run-summary-card__title">Win Condition</div>
      <div class="echo-run-summary-card__meta">${escapeHtml(getSquadWinConditionLabel(match.rules.winCondition))}</div>
      <div class="echo-run-summary-card__copy">${escapeHtml(getSkirmishWinConditionCopy(match.rules.winCondition))}</div>
      ${renderSkirmishObjectivePreview({
        gridWidth: match.rules.gridWidth,
        gridHeight: match.rules.gridHeight,
        objectiveType: match.rules.winCondition,
      })}
    </div>
    <div class="echo-run-summary-card">
      <div class="echo-run-summary-card__title">Network State</div>
      <div class="echo-run-summary-card__meta">${squadTransportStatus.role.toUpperCase()}</div>
      <div class="echo-run-summary-card__copy">${escapeHtml(transportSummary)}</div>
    </div>
  `;
}

function renderSkirmishDraftChoiceCard(match: SquadMatchState, optionId: string, label: string, category: string, summary: string): string {
  const currentPickSlot = match.draft?.currentPickSlot ?? null;
  const canPick = Boolean(
    currentPickSlot
    && (
      squadTransportStatus.role !== "client"
      || currentPickSlot === getClientControlSlot(match)
    ),
  );

  return `
    <article class="echo-run-choice-card echo-run-choice-card--${getSkirmishCategoryClass(category)}">
      <div class="echo-run-choice-card__lane">${category.toUpperCase()}</div>
      <div class="echo-run-choice-card__title">${escapeHtml(label)}</div>
      <div class="echo-run-choice-card__subtitle">${currentPickSlot ? `Pick for ${currentPickSlot}` : "Draft locked"}</div>
      <div class="echo-run-choice-card__copy">${escapeHtml(summary)}</div>
      <div class="echo-run-choice-card__detail">
        <div class="echo-run-choice-card__line">Shared pool item</div>
        <div class="echo-run-choice-card__line">Contested pick</div>
        <div class="echo-run-choice-card__line">Instantly removed after selection</div>
      </div>
      <button class="echo-run-choice-card__button" type="button" data-squad-pick="${optionId}" ${canPick ? "" : "disabled"}>
        ${currentPickSlot ? `LOCK FOR ${currentPickSlot}` : "LOCKED"}
      </button>
    </article>
  `;
}

function renderSkirmishConfirmationStage(match: SquadMatchState): string {
  return `
    <section class="echo-run-choice-stage">
      <div class="echo-run-choice-stage__header">
        <div class="echo-run-choice-stage__title">Loadout Confirmation</div>
        <div class="echo-run-choice-stage__actions">
          <button class="echo-run-secondary-btn" type="button" id="backToCommsBtn">BACK TO COMMS</button>
          <button class="echo-run-secondary-btn" type="button" id="resetSquadMatchBtn">RESET SESSION</button>
        </div>
      </div>
      <div class="echo-run-choice-grid">
        ${SESSION_PLAYER_SLOTS.map((slot) => {
          const member = match.members[slot];
          if (!member) {
            return "";
          }
          const picks = (match.draft?.picks ?? []).filter((pick) => pick.slot === slot);
          const isConfirmed = match.confirmation.confirmedSlots.includes(slot);
          const canControlMember = squadTransportStatus.role !== "client" || slot === getClientControlSlot(match);
          return `
            <article class="echo-run-choice-card echo-run-choice-card--unit">
              <div class="echo-run-choice-card__lane">${slot}</div>
              <div class="echo-run-choice-card__title">${escapeHtml(member.callsign)}</div>
              <div class="echo-run-choice-card__subtitle">${isConfirmed ? "Confirmed" : "Awaiting confirmation"}</div>
              <div class="echo-run-choice-card__copy">Review this drafted package and confirm handoff before the host launches the skirmish.</div>
              <div class="echo-run-choice-card__detail">
                ${picks.map((pick) => `<div class="echo-run-choice-card__line">${escapeHtml(getSkirmishPickLabel(pick.category, pick.optionId))}</div>`).join("")}
              </div>
              ${!isConfirmed
                ? `<button class="echo-run-choice-card__button" type="button" data-squad-confirm="${slot}" ${canControlMember ? "" : "disabled"}>CONFIRM LOADOUT</button>`
                : `<button class="echo-run-secondary-btn" type="button" disabled>CONFIRMED</button>`}
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderSkirmishBattleStage(match: SquadMatchState): string {
  const connectedMembers = getConnectedSquadMembers(match);
  const activeSkirmishBattle = getGameState().currentBattle?.modeContext?.kind === "squad" ? getGameState().currentBattle : null;
  const battleReadyForLaunch = connectedMembers.length >= 2;

  return `
    <section class="echo-run-choice-stage">
        <div class="echo-run-choice-stage__header">
          <div class="echo-run-choice-stage__title">Battle Handoff</div>
          <div class="echo-run-choice-stage__actions">
            <button class="echo-run-secondary-btn" type="button" id="backToCommsBtn">BACK TO COMMS</button>
          </div>
        </div>
      <div class="echo-run-results__hero">
        <div class="echo-run-results__kicker">SCROLLLINK // SKIRMISH READY</div>
        <h1 class="echo-run-results__title">DEPLOY OR RE-ENTER</h1>
        <p class="echo-run-results__copy">Drafting and confirmation are complete. The host can launch the live battle feed, and both clients can re-enter the active match at any time. ${escapeHtml(getSquadWinConditionLabel(match.rules.winCondition))} // ${escapeHtml(getSkirmishWinConditionCopy(match.rules.winCondition))}</p>
      </div>
      <div class="echo-run-results__actions">
        <button class="echo-run-primary-btn" type="button" id="startSquadBattleBtn" ${battleReadyForLaunch && squadTransportStatus.role !== "client" ? "" : "disabled"}>
          ${activeSkirmishBattle ? "RESTART LIVE SKIRMISH" : "BEGIN SKIRMISH BATTLE"}
        </button>
        ${activeSkirmishBattle ? `<button class="echo-run-secondary-btn" type="button" id="resumeSquadBattleBtn">ENTER ACTIVE BATTLE</button>` : ""}
        <button class="echo-run-secondary-btn" type="button" id="resetSquadMatchBtn">RESET SESSION</button>
      </div>
    </section>
  `;
}

function renderSkirmishResultStage(match: SquadMatchState): string {
  const winnerLabel = (match.result?.winnerSlots ?? [])
    .map((slot) => match.members[slot]?.callsign ?? slot)
    .join(", ");
  const lobby = getResolvedLobbyState();
  const isLobbyIntermission = lobby?.activity.kind === "skirmish" && lobby.activity.skirmish.status === "intermission";
  const currentRoundIndex = lobby?.activity.kind === "skirmish" ? lobby.activity.skirmish.currentRoundIndex : 0;
  const hasAnotherRound = Boolean(
    lobby?.activity.kind === "skirmish"
    && lobby.activity.skirmish.playlist.rounds[currentRoundIndex + 1],
  );
  const localSlot = getLocalLobbySlot(lobby);
  const localOwnsIntermissionDecision = Boolean(
    isLobbyIntermission
    && lobby?.activity.kind === "skirmish"
    && localSlot
    && lobby.activity.skirmish.challengerSlot === localSlot,
  );

  return `
    <section class="echo-run-results">
      <div class="echo-run-results__hero">
        <div class="echo-run-results__kicker">SCROLLLINK // SKIRMISH SUMMARY</div>
        <h1 class="echo-run-results__title">MATCH RESOLVED</h1>
        <p class="echo-run-results__copy">${escapeHtml(match.result?.reason ?? "The skirmish has concluded.")}</p>
      </div>
      <div class="echo-run-results__grid">
        <div class="echo-run-results__item"><span>Winning Side</span><strong>${escapeHtml(winnerLabel || "Undeclared")}</strong></div>
        <div class="echo-run-results__item"><span>Links</span><strong>${getConnectedSquadMembers(match).length}</strong></div>
        <div class="echo-run-results__item"><span>Phase</span><strong>${match.phase.toUpperCase()}</strong></div>
        <div class="echo-run-results__item"><span>Join Code</span><strong>${escapeHtml(match.joinCode)}</strong></div>
      </div>
      ${isLobbyIntermission ? `
        <div class="echo-run-summary-card" style="margin-top: 1rem;">
          <div class="echo-run-summary-card__title">Playlist Intermission</div>
          <div class="echo-run-summary-card__copy">
            ${hasAnotherRound
              ? localOwnsIntermissionDecision
                ? "Choose whether the next round should redraft or reuse the current loadouts."
                : "Waiting for the challenger to choose the next playlist round."
              : "Playlist complete. Returning to the multiplayer lobby."}
          </div>
        </div>
      ` : ""}
      <div class="echo-run-results__actions">
        <button class="echo-run-secondary-btn" type="button" id="backToCommsBtn">BACK TO COMMS</button>
        ${localOwnsIntermissionDecision && hasAnotherRound ? `
          <button class="echo-run-secondary-btn" type="button" id="skirmishReuseLoadoutsBtn">REUSE LOADOUTS</button>
          <button class="echo-run-primary-btn" type="button" id="skirmishRedraftBtn">REDRAFT NEXT ROUND</button>
        ` : `<button class="echo-run-primary-btn" type="button" id="resetSquadMatchBtn">RESET SESSION</button>`}
      </div>
    </section>
  `;
}

function renderSkirmishStagingMain(match: SquadMatchState): string {
  if (match.phase === "draft" && match.draft) {
    return `
      <section class="echo-run-choice-stage">
        <div class="echo-run-choice-stage__header">
          <div class="echo-run-choice-stage__title">Shared Draft Pool</div>
          <div class="echo-run-choice-stage__actions">
            <button class="echo-run-secondary-btn" type="button" id="backToCommsBtn">BACK TO COMMS</button>
            <button class="echo-run-secondary-btn" type="button" id="resetSquadMatchBtn">RESET SESSION</button>
          </div>
        </div>
        <div class="echo-run-choice-grid">
          ${match.draft.pool.map((option) => renderSkirmishDraftChoiceCard(match, option.id, option.label, option.category, option.summary)).join("")}
        </div>
      </section>
    `;
  }

  if (match.phase === "confirmation") {
    return renderSkirmishConfirmationStage(match);
  }

  if (match.phase === "battle") {
    return renderSkirmishBattleStage(match);
  }

  return renderSkirmishResultStage(match);
}

function renderSkirmishStagingScreen(returnTo: CommsReturnTo = activeCommsReturnTo): void {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  ensureSquadTransportIntegration(returnTo);
  const match = getSquadMatchState();
  if (!match || match.phase === "lobby") {
    activeSkirmishSurface = "comms";
    renderCommsArrayScreen(returnTo);
    return;
  }

  activeSkirmishSurface = "staging";
  const currentPick = match.draft?.currentPickSlot ?? "LOCKED";

  app.innerHTML = `
    <div class="echo-run-root skirmish-staging-root">
      <div class="echo-run-shell">
        <header class="echo-run-header">
          <div>
            <div class="echo-run-header__kicker">S/COM_OS // SKIRMISH</div>
            <h1 class="echo-run-header__title">${getSkirmishStageTitle(match)}</h1>
            <p class="echo-run-header__copy">${getSkirmishStageCopy(match)}</p>
          </div>
          <div class="echo-run-header__meta">
            <div class="echo-run-meta-chip"><span>Phase</span><strong>${match.phase.toUpperCase()}</strong></div>
            <div class="echo-run-meta-chip"><span>Current Pick</span><strong>${currentPick}</strong></div>
            <div class="echo-run-meta-chip"><span>Links</span><strong>${getConnectedSquadMembers(match).length}</strong></div>
            <div class="echo-run-meta-chip echo-run-meta-chip--join-code"><span>Join Code</span><strong>${escapeHtml(match.joinCode)}</strong></div>
          </div>
        </header>

        <div class="echo-run-body">
          <aside class="echo-run-sidebar">
            <section class="echo-run-panel">
              <div class="echo-run-panel__title">Combatants</div>
              ${SESSION_PLAYER_SLOTS.map((slot) => renderSkirmishMemberSummaryCard(match, slot)).join("")}
            </section>
            <section class="echo-run-panel">
              <div class="echo-run-panel__title">Draft Ledger</div>
              ${renderSkirmishLedger(match)}
            </section>
            <section class="echo-run-panel">
              <div class="echo-run-panel__title">Network</div>
              ${renderSkirmishNetworkPanel(match)}
            </section>
          </aside>

          <main class="echo-run-main">
            ${renderSkirmishStagingMain(match)}
          </main>
        </div>
      </div>
    </div>
  `;

  attachCommsArrayListeners(returnTo);
}

function renderSquadOnlineSection(): string {
  const state = getGameState();
  const lobby = getResolvedLobbyState();
  const match = getLobbyLocalSkirmishMatch(lobby) ?? getSquadMatchState();
  const operatorCallsign = multiplayerLobbyPreviewConfig.operatorCallsign || state.profile.callsign || "OPERATOR";
  const transportAvailable = isTauriSquadTransportAvailable();
  const transportRole = squadTransportStatus.role;
  const sectionStatus = lobby
    ? lobby.activity.kind === "idle"
      ? `LOBBY // ${transportRole.toUpperCase()}`
      : lobby.activity.kind === "skirmish"
        ? `SKIRMISH // ${lobby.activity.skirmish.status.toUpperCase()}`
        : "CO-OP OPS // STAGING"
    : transportRole === "client"
      ? "CLIENT READY"
      : transportRole === "host"
        ? "HOST READY"
        : "MULTIPLAYER READY";
  const lobbyMembers = lobby ? NETWORK_PLAYER_SLOTS.map((slot) => lobby.members[slot]).filter(Boolean) : [];
  const currentRound = lobby ? getActiveLobbyPlaylistRound(lobby) : null;
  const pendingChallenge = lobby?.pendingChallenge ?? null;
  const lobbySummary = lobby
    ? `${lobbyMembers.length}/8 operators linked // host ${lobby.members[lobby.hostSlot]?.callsign ?? lobby.hostSlot} // join ${lobby.joinCode}`
    : "Create or join a shared multiplayer lobby. The lobby field becomes the shared staging space for both Skirmish and Co-Op Operations.";
  const canEnterSkirmish = Boolean(lobby && isLocalLobbySkirmishFighter(lobby) && match && match.phase !== "lobby");
  const canEnterLobbyField = Boolean(lobby);
  const coopSelectionSummary = lobby?.activity.kind === "coop_operations"
    ? lobby.activity.coopOperations.selectedSlots.join(", ") || "None selected"
    : "";
  const coopActivityStatus = lobby?.activity.kind === "coop_operations"
    ? lobby.activity.coopOperations.status === "active"
      ? "ACTIVE"
      : "STAGING"
    : "IDLE";
  const canLaunchCoopOperations = Boolean(
    lobby
    && canLocalHostLobby(lobby)
    && lobby.activity.kind === "coop_operations"
    && lobby.activity.coopOperations.selectedSlots.length > 0,
  );
  const canEnterCoopOperations = Boolean(
    lobby
    && lobby.activity.kind === "coop_operations"
    && lobby.activity.coopOperations.status === "active",
  ) && Boolean(
    lobby?.localSlot
    && lobby.activity.kind === "coop_operations"
    && lobby.activity.coopOperations.participants[lobby.localSlot]?.selected,
  );
  const manualJoinAddress = multiplayerLobbyPreviewConfig.joinAddress.trim();
  const joinCodeCard = lobby ? `
    <div class="comms-array-join-code-card">
      <div class="comms-array-join-code-card__label">Join Code</div>
      <div class="comms-array-join-code-card__value">${escapeHtml(lobby.joinCode)}</div>
      <div class="comms-array-join-code-card__copy">Share this code with the lobby. Manual direct-connect is still available below when you need the host address.</div>
    </div>
  ` : "";

  return `
    <div class="comms-array-section">
      <div class="comms-array-section-header">
        <h2 class="section-title">MULTIPLAYER LOBBY</h2>
        <div class="section-status section-status--active">${sectionStatus}</div>
      </div>
      <div class="comms-array-section-body">
        <p class="section-description">
          Host or join a shared lobby, then move into the network field staging space. Skirmish challenges and Co-Op Operations both launch from that shared lobby.
        </p>

        <div class="training-config">
          ${joinCodeCard}

          <div class="config-row">
            <label class="config-label">Operator Callsign:</label>
            <input class="config-select" id="multiplayerOperatorCallsignInput" value="${escapeHtml(operatorCallsign)}" />
          </div>

          ${transportAvailable ? `
            <details class="comms-array-manual-join" ${manualJoinAddress ? "open" : ""}>
              <summary>Manual Direct Join</summary>
              <div class="config-row">
                <label class="config-label">Host Address:</label>
                <input class="config-select" id="multiplayerJoinAddressInput" value="${escapeHtml(multiplayerLobbyPreviewConfig.joinAddress)}" placeholder="192.168.x.x:PORT" />
              </div>
              <div class="config-note">
                <span class="note-icon">NET</span>
                <span>The join code is the player-facing lobby identifier. Direct connect still needs the host address in the current build.</span>
              </div>
            </details>
          ` : ""}

          <div class="config-note">
            <span class="note-icon">L</span>
            <span>${escapeHtml(lobbySummary)}</span>
          </div>

          <div class="config-note">
            <span class="note-icon">NET</span>
            <span>${escapeHtml(getLobbyTransportSummary(lobby))}</span>
          </div>

          ${currentRound ? `
            <div class="config-note config-note--stacked">
              <span class="note-icon">S</span>
              <span>Current Skirmish Round // ${escapeHtml(getSquadWinConditionLabel(currentRound.objectiveType))} // GRID ${currentRound.gridWidth}x${currentRound.gridHeight}</span>
              ${renderSkirmishObjectivePreview(currentRound)}
            </div>
          ` : ""}

          ${pendingChallenge ? `
            <div class="config-note config-note--stacked">
              <span class="note-icon">C</span>
              <span>Pending Challenge // ${escapeHtml(pendingChallenge.challengerCallsign)} vs ${escapeHtml(pendingChallenge.challengeeCallsign)}</span>
              ${renderSkirmishObjectivePreview(pendingChallenge.playlist.rounds[0] ?? { id: "preview", gridWidth: 8, gridHeight: 5, objectiveType: "elimination" })}
            </div>
          ` : ""}

          ${lobby?.activity.kind === "coop_operations" ? `
            <div class="config-note">
              <span class="note-icon">O</span>
              <span>Co-Op Operations ${escapeHtml(coopActivityStatus.toLowerCase())} // ${escapeHtml(coopSelectionSummary)}</span>
            </div>
          ` : ""}
        </div>

        <div class="comms-array-button-group">
          ${!lobby && (!transportAvailable || transportRole === "idle") ? `
            <button class="comms-array-btn comms-array-btn--primary" id="hostSessionBtn">
              HOST LOBBY
            </button>
          ` : ""}
          ${!lobby && transportAvailable && transportRole === "idle" ? `
            <button class="comms-array-btn" id="joinRemoteHostBtn" ${manualJoinAddress ? "" : "disabled"}>
              JOIN VIA ADDRESS
            </button>
          ` : ""}
          ${canEnterLobbyField ? `
            <button class="comms-array-btn comms-array-btn--primary" id="enterLobbyFieldBtn">
              ENTER LOBBY FIELD
            </button>
          ` : ""}
          ${canLaunchCoopOperations ? `
            <button class="comms-array-btn comms-array-btn--primary" id="launchCoopOperationsBtn">
              LAUNCH CO-OP OPS
            </button>
          ` : ""}
          ${canEnterCoopOperations ? `
            <button class="comms-array-btn" id="enterCoopOperationsBtn">
              ENTER H.A.V.E.N.
            </button>
          ` : ""}
          ${canEnterSkirmish ? `
            <button class="comms-array-btn comms-array-btn--primary" id="openSkirmishStageBtn">
              OPEN SKIRMISH
            </button>
          ` : ""}
          ${lobby ? `
            <button class="comms-array-btn" id="leaveLobbyBtn">
              LEAVE LOBBY
            </button>
          ` : ""}
          ${transportAvailable && transportRole !== "idle" ? `
            <button class="comms-array-btn" id="disconnectSquadTransportBtn">
              DISCONNECT NETWORK
            </button>
          ` : ""}
        </div>

        ${lobby ? `
          <div class="settings-category" style="margin-top: 1rem;">
            <div class="settings-category-header">LOBBY ROSTER</div>
            <div class="bindings-list">
              ${NETWORK_PLAYER_SLOTS.map((slot) => {
                const member = lobby.members[slot];
                const isSelectedForOps = lobby.activity.kind === "coop_operations" && lobby.activity.coopOperations.selectedSlots.includes(slot);
                return `
                  <div class="binding-item">
                    <span class="binding-action">${slot}${member ? ` // ${escapeHtml(member.callsign)}` : " // OPEN"}</span>
                    <span class="binding-keys">${member ? `${member.authorityRole.toUpperCase()} // ${member.presence.toUpperCase()}${isSelectedForOps ? " // OPS" : ""}` : "Awaiting link"}</span>
                  </div>
                `;
              }).join("")}
            </div>
          </div>

          ${lobby.activity.kind === "skirmish" && currentRound ? `
            <div class="settings-category" style="margin-top: 1rem;">
              <div class="settings-category-header">ACTIVE SKIRMISH</div>
              <div class="config-note">
                <span class="note-icon">></span>
                <span>${escapeHtml(lobby.activity.skirmish.challengerCallsign)} vs ${escapeHtml(lobby.activity.skirmish.challengeeCallsign)} // ${escapeHtml(getSquadWinConditionLabel(currentRound.objectiveType))} // GRID ${currentRound.gridWidth}x${currentRound.gridHeight}</span>
              </div>
              ${renderSkirmishObjectivePreview(currentRound)}
            </div>
          ` : ""}
        ` : ""}
      </div>
    </div>
  `;
}

function commitSquadMatchUpdate(
  match: SquadMatchState | null,
  returnTo: CommsReturnTo,
  message?: string,
  messageType: "success" | "error" | "info" = "info",
  rerender = true,
): void {
  const nextMatch = match ? getTransportAwareMatchState(match) : null;

  if (nextMatch) {
    saveSquadMatchState(nextMatch);
  } else {
    clearSquadMatchState();
  }

  const currentLobby = getResolvedLobbyState();
  if (currentLobby?.activity.kind === "skirmish") {
    const nextLobby = nextMatch
      ? updateLobbySkirmishSnapshot(currentLobby, nextMatch)
      : clearLobbyActivity(currentLobby);
    commitLobbyState(nextLobby, undefined, "info", false);
    if (isTauriSquadTransportAvailable() && squadTransportStatus.role === "host") {
      void broadcastLobbySnapshot(nextLobby);
    }
  }

  if (isTauriSquadTransportAvailable() && squadTransportStatus.role === "host") {
    if (nextMatch) {
      void broadcastSquadSnapshot(nextMatch);
    } else {
      void sendSquadTransportMessage("session_reset", "", null);
    }
  }

  if (message) {
    showNotification(message, messageType);
  }
  if (rerender) {
    renderActiveSkirmishScreen(returnTo);
  }
}

export function renderActiveSkirmishScreen(returnTo: CommsReturnTo = activeCommsReturnTo): void {
  const match = getSquadMatchState();
  if (shouldRenderSkirmishStaging(match)) {
    renderSkirmishStagingScreen(returnTo);
    return;
  }
  renderCommsArrayScreen(returnTo);
}

export function renderCommsArrayScreen(returnTo: CommsReturnTo = "basecamp"): void {
  const app = document.getElementById("app");
  if (!app) return;
  
  ensureSquadTransportIntegration(returnTo);
  activeSkirmishSurface = "comms";
  const backButtonText = returnTo === "operation"
    ? "DUNGEON MAP"
    : returnTo === "menu"
      ? "MAIN MENU"
      : getBaseCampReturnLabel(returnTo);
  const showSaveBoundSections = returnTo !== "menu";
  
  app.innerHTML = `
    <div class="comms-array-root">
      <!-- Header -->
      <div class="comms-array-header">
        <div class="comms-array-header-left">
          <h1 class="comms-array-title">COMMS ARRAY</h1>
          <div class="comms-array-subtitle">TACTICAL SIMULATION TERMINAL</div>
        </div>
        <div class="comms-array-header-right">
          <button class="comms-array-back-btn" id="backBtn" data-return-to="${returnTo}">
            <span class="btn-icon">←</span>
            <span class="btn-text">${backButtonText}</span>
          </button>
        </div>
      </div>
      <!-- Content -->
      <div class="comms-array-content">
        ${renderSquadOnlineSection()}
        
        <!-- Section 2: Training Battles (Bots) -->
        <div class="comms-array-section">
          <div class="comms-array-section-header">
            <h2 class="section-title">TRAINING BATTLES</h2>
            <div class="section-status section-status--active">ACTIVE</div>
          </div>
          <div class="comms-array-section-body">
            <p class="section-description">
              Practice against AI opponents. No rewards, unlimited retries.
            </p>
            
            <!-- Training Configuration -->
            <div class="training-config">
              <div class="config-row">
                <label class="config-label">Grid Width:</label>
                <select class="config-select" id="gridWidthSelect">
                  ${[4, 5, 6, 7, 8].map(w => 
                    `<option value="${w}" ${trainingConfig.gridW === w ? 'selected' : ''}>${w}</option>`
                  ).join('')}
                </select>
              </div>
              
              <div class="config-row">
                <label class="config-label">Grid Height:</label>
                <select class="config-select" id="gridHeightSelect">
                  ${[3, 4, 5, 6].map(h => 
                    `<option value="${h}" ${trainingConfig.gridH === h ? 'selected' : ''}>${h}</option>`
                  ).join('')}
                </select>
              </div>
              
              <div class="config-row">
                <label class="config-label">Bot Difficulty:</label>
                <select class="config-select" id="difficultySelect">
                  <option value="easy" ${trainingConfig.difficulty === "easy" ? 'selected' : ''}>Easy</option>
                  <option value="normal" ${trainingConfig.difficulty === "normal" ? 'selected' : ''}>Normal</option>
                  <option value="hard" ${trainingConfig.difficulty === "hard" ? 'selected' : ''}>Hard</option>
                </select>
              </div>
              
              <div class="config-note">
                <span class="note-icon">ℹ</span>
                <span>No Rewards: Always enabled (training mode)</span>
              </div>
            </div>
            
            <div class="comms-array-button-group">
              <button class="comms-array-btn comms-array-btn--primary" id="startTrainingBtn">
                START TRAINING
              </button>
            </div>
          </div>
        </div>

        ${showSaveBoundSections ? `
        <div class="comms-array-section">
          <div class="comms-array-section-header">
            <h2 class="section-title">CUSTOM OPERATIONS</h2>
            <div class="section-status section-status--active">DEPLOYABLE</div>
          </div>
          <div class="comms-array-section-body">
            <p class="section-description">
              Spin up a bespoke procedural theater run and deploy through loadout. Configure floor count, threat pressure, and sprawl direction here.
            </p>

            <div class="training-config">
              <div class="config-row">
                <label class="config-label">Difficulty:</label>
                <select class="config-select" id="customDifficultySelect">
                  <option value="easy" ${customOperationConfig.difficulty === "easy" ? "selected" : ""}>Easy</option>
                  <option value="normal" ${customOperationConfig.difficulty === "normal" ? "selected" : ""}>Normal</option>
                  <option value="hard" ${customOperationConfig.difficulty === "hard" ? "selected" : ""}>Hard</option>
                </select>
              </div>

              <div class="config-row">
                <label class="config-label">Floors:</label>
                <select class="config-select" id="customFloorsSelect">
                  ${[1, 2, 3, 4, 5, 6, 7, 8].map((floors) => (
                    `<option value="${floors}" ${customOperationConfig.floors === floors ? "selected" : ""}>${floors}</option>`
                  )).join("")}
                </select>
              </div>

              <div class="config-row">
                <label class="config-label">Enemy Density:</label>
                <select class="config-select" id="customDensitySelect">
                  <option value="low" ${customOperationConfig.enemyDensity === "low" ? "selected" : ""}>Low</option>
                  <option value="normal" ${customOperationConfig.enemyDensity === "normal" ? "selected" : ""}>Normal</option>
                  <option value="high" ${customOperationConfig.enemyDensity === "high" ? "selected" : ""}>High</option>
                </select>
              </div>

              <div class="config-row">
                <label class="config-label">Sprawl Direction:</label>
                <select class="config-select" id="customSprawlSelect">
                  ${[
                    ["north", "North"],
                    ["northeast", "Northeast"],
                    ["east", "East"],
                    ["southeast", "Southeast"],
                    ["south", "South"],
                    ["southwest", "Southwest"],
                    ["west", "West"],
                    ["northwest", "Northwest"],
                  ].map(([value, label]) => (
                    `<option value="${value}" ${customOperationConfig.sprawlDirection === value ? "selected" : ""}>${label}</option>`
                  )).join("")}
                </select>
              </div>
            </div>

            <div class="comms-array-button-group">
              <button class="comms-array-btn comms-array-btn--primary" id="startCustomOperationBtn">
                DEPLOY CUSTOM OPERATION
              </button>
            </div>
          </div>
        </div>
        ` : ""}
      </div>
    </div>
  `;
  
  attachCommsArrayListeners(returnTo);
}

function attachCommsArrayListeners(returnTo: CommsReturnTo): void {
  // Back button
  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    backBtn.onclick = () => {
      unregisterBaseCampReturnHotkey("comms-array-screen");
      if (returnTo === "operation") {
        // Return to operation map if needed
        import("./OperationMapScreen").then(({ renderOperationMapScreen }) => {
          renderOperationMapScreen();
        });
      } else if (returnTo === "menu") {
        import("./MainMenuScreen").then(({ renderMainMenu }) => {
          void renderMainMenu();
        });
      } else {
        returnFromBaseCampScreen(returnTo);
      }
    };
  }

  document.querySelectorAll<HTMLElement>("#backToCommsBtn").forEach((button) => {
    button.onclick = () => {
      activeSkirmishSurface = "comms";
      renderCommsArrayScreen(returnTo);
    };
  });

  if (returnTo !== "operation" && returnTo !== "menu") {
    const activeSurfaceSelector = activeSkirmishSurface === "staging" ? ".skirmish-staging-root" : ".comms-array-root";
    registerBaseCampReturnHotkey("comms-array-screen", returnTo, { allowFieldEKey: true, activeSelector: activeSurfaceSelector });
  } else {
    unregisterBaseCampReturnHotkey("comms-array-screen");
  }
  
  const multiplayerOperatorCallsignInput = document.getElementById("multiplayerOperatorCallsignInput") as HTMLInputElement | null;
  const multiplayerJoinAddressInput = document.getElementById("multiplayerJoinAddressInput") as HTMLInputElement | null;

  if (multiplayerOperatorCallsignInput) {
    multiplayerOperatorCallsignInput.addEventListener("input", () => {
      multiplayerLobbyPreviewConfig.operatorCallsign = multiplayerOperatorCallsignInput.value;
    });
  }

  if (multiplayerJoinAddressInput) {
    multiplayerJoinAddressInput.addEventListener("input", () => {
      multiplayerLobbyPreviewConfig.joinAddress = multiplayerJoinAddressInput.value;
      const joinButton = document.getElementById("joinRemoteHostBtn") as HTMLButtonElement | null;
      if (joinButton) {
        joinButton.disabled = multiplayerJoinAddressInput.value.trim().length <= 0;
      }
    });
  }

  const hostBtn = document.getElementById("hostSessionBtn");
  if (hostBtn) {
    hostBtn.onclick = async () => {
      try {
        await hostOrPreviewMultiplayerLobby();
      } catch (error) {
        showNotification(
          error instanceof Error ? error.message : "Failed to start the multiplayer lobby.",
          "error",
        );
      }
    };
  }

  const joinRemoteHostBtn = document.getElementById("joinRemoteHostBtn");
  if (joinRemoteHostBtn) {
    joinRemoteHostBtn.onclick = async () => {
      try {
        await joinMultiplayerLobby(multiplayerLobbyPreviewConfig.joinAddress, getPreferredLobbyOperatorCallsign());
        showNotification(`Joined remote lobby ${multiplayerLobbyPreviewConfig.joinAddress.trim()}.`, "success");
      } catch (error) {
        showNotification(
          error instanceof Error ? error.message : "Failed to join the multiplayer lobby.",
          "error",
        );
      }
    };
  }

  const enterLobbyFieldBtn = document.getElementById("enterLobbyFieldBtn");
  if (enterLobbyFieldBtn) {
    enterLobbyFieldBtn.onclick = async () => {
      await openNetworkLobbyField();
    };
  }

  const launchCoopOperationsBtn = document.getElementById("launchCoopOperationsBtn");
  if (launchCoopOperationsBtn) {
    launchCoopOperationsBtn.onclick = async () => {
      try {
        await beginLobbyCoopOperations();
      } catch (error) {
        showNotification(
          error instanceof Error ? error.message : "Failed to launch Co-Op Operations.",
          "error",
        );
      }
    };
  }

  const enterCoopOperationsBtn = document.getElementById("enterCoopOperationsBtn");
  if (enterCoopOperationsBtn) {
    enterCoopOperationsBtn.onclick = async () => {
      const lobby = getResolvedLobbyState();
      if (lobby?.activity.kind !== "coop_operations" || lobby.activity.coopOperations.status !== "active") {
        return;
      }
      await enterActiveCoopOperations(lobby);
    };
  }

  const leaveLobbyBtn = document.getElementById("leaveLobbyBtn");
  if (leaveLobbyBtn) {
    leaveLobbyBtn.onclick = async () => {
      try {
        await leaveCurrentMultiplayerLobby();
        showNotification("Left the multiplayer lobby.", "info");
      } catch (error) {
        showNotification(
          error instanceof Error ? error.message : "Failed to leave the multiplayer lobby.",
          "error",
        );
      }
    };
  }

  const disconnectSquadTransportBtn = document.getElementById("disconnectSquadTransportBtn");
  if (disconnectSquadTransportBtn) {
    disconnectSquadTransportBtn.onclick = async () => {
      try {
        await disconnectMultiplayerLobby(false);
        showNotification("Multiplayer network disconnected.", "info");
        renderCommsArrayScreen(returnTo);
      } catch (error) {
        showNotification(
          error instanceof Error ? error.message : "Failed to stop multiplayer transport.",
          "error",
        );
      }
    };
  }

  document.querySelectorAll<HTMLElement>("#resetSquadMatchBtn").forEach((button) => {
    button.onclick = async () => {
      activeSkirmishSurface = "comms";
      pendingRemoteSkirmishBattlePayload = null;
      shouldAutoResumeRemoteSkirmishBattle = false;
      const currentLobby = getResolvedLobbyState();
      if (currentLobby?.activity.kind === "skirmish" && squadTransportStatus.role !== "client") {
        const nextLobby = clearLobbyActivity(currentLobby);
        commitLobbyState(nextLobby, "Skirmish session cleared.", "info", false);
        await broadcastLobbySnapshot(nextLobby);
      }
      commitSquadMatchUpdate(null, returnTo, "Skirmish session cleared.", "info");
    };
  });

  const skirmishReuseLoadoutsBtn = document.getElementById("skirmishReuseLoadoutsBtn");
  if (skirmishReuseLoadoutsBtn) {
    skirmishReuseLoadoutsBtn.onclick = async () => {
      await chooseLobbySkirmishNextRound("reuse");
    };
  }

  const skirmishRedraftBtn = document.getElementById("skirmishRedraftBtn");
  if (skirmishRedraftBtn) {
    skirmishRedraftBtn.onclick = async () => {
      await chooseLobbySkirmishNextRound("redraft");
    };
  }

  document.querySelectorAll<HTMLElement>("#openSkirmishStageBtn").forEach((button) => {
    button.onclick = () => {
      openCurrentLobbySkirmish();
      const currentMatch = getSquadMatchState();
      if (!currentMatch || currentMatch.phase === "lobby") {
        return;
      }
      activeSkirmishSurface = "staging";
      renderActiveSkirmishScreen(returnTo);
    };
  });

  const startSquadBattleBtn = document.getElementById("startSquadBattleBtn");
  if (startSquadBattleBtn) {
    startSquadBattleBtn.onclick = async () => {
      const currentMatch = getSquadMatchState();
      if (!currentMatch || currentMatch.phase !== "battle") {
        return;
      }

      const connectedMembers = getConnectedSquadMembers(currentMatch);
      if (connectedMembers.length < 2) {
        showNotification("At least two linked combatants are required before launch.", "error");
        return;
      }

      try {
        activeSkirmishSurface = "staging";
        await startSquadBattle(currentMatch);
        showNotification("Skirmish battle launched into the live engagement feed.", "success");
      } catch (error) {
        showNotification(
          error instanceof Error ? error.message : "Failed to launch the Skirmish battle.",
          "error",
        );
      }
    };
  }

  const resumeSquadBattleBtn = document.getElementById("resumeSquadBattleBtn");
  if (resumeSquadBattleBtn) {
    resumeSquadBattleBtn.onclick = () => {
      if (getGameState().currentBattle?.modeContext?.kind !== "squad") {
        showNotification("No active Skirmish battle is loaded yet.", "info");
        return;
      }
      activeSkirmishSurface = "staging";
      renderBattleScreen();
    };
  }

  document.querySelectorAll<HTMLElement>("[data-squad-ready-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      const slot = button.getAttribute("data-squad-ready-toggle") as SessionPlayerSlot | null;
      const currentMatch = getSquadMatchState();
      if (!slot || !currentMatch) {
        return;
      }
      if (squadTransportStatus.role === "client") {
        if (slot !== getClientControlSlot(currentMatch)) {
          return;
        }
        await sendSquadTransportMessage("command", JSON.stringify({
          type: "set_ready",
          slot,
        } satisfies MatchCommand));
        return;
      }
      const nextMatch = applySquadMatchCommand(currentMatch, { type: "set_ready", slot });
      commitSquadMatchUpdate(nextMatch, returnTo);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-squad-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = button.getAttribute("data-squad-remove") as SessionPlayerSlot | null;
      const currentMatch = getSquadMatchState();
      if (!slot || !currentMatch) {
        return;
      }
      const nextMatch = applySquadMatchCommand(currentMatch, { type: "leave_lobby", slot });
      commitSquadMatchUpdate(nextMatch, returnTo, `${slot} dropped from the lobby.`, "info");
    });
  });

  document.querySelectorAll<HTMLElement>("[data-squad-pick]").forEach((button) => {
    button.addEventListener("click", async () => {
      const optionId = button.getAttribute("data-squad-pick");
      const currentMatch = getSquadMatchState();
      const currentSlot = currentMatch?.draft?.currentPickSlot ?? null;
      if (!optionId || !currentMatch || !currentSlot) {
        return;
      }
      if (squadTransportStatus.role === "client") {
        if (currentSlot !== getClientControlSlot(currentMatch)) {
          return;
        }
        await sendSquadTransportMessage("command", JSON.stringify({
          type: "make_pick",
          slot: currentSlot,
          optionId,
        } satisfies MatchCommand));
        return;
      }
      const nextMatch = applySquadMatchCommand(currentMatch, {
        type: "make_pick",
        slot: currentSlot,
        optionId,
      });
      commitSquadMatchUpdate(nextMatch, returnTo);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-squad-confirm]").forEach((button) => {
    button.addEventListener("click", async () => {
      const slot = button.getAttribute("data-squad-confirm") as SessionPlayerSlot | null;
      const currentMatch = getSquadMatchState();
      if (!slot || !currentMatch) {
        return;
      }
      if (squadTransportStatus.role === "client") {
        if (slot !== getClientControlSlot(currentMatch)) {
          return;
        }
        await sendSquadTransportMessage("command", JSON.stringify({
          type: "confirm_loadout",
          slot,
        } satisfies MatchCommand));
        return;
      }
      const nextMatch = applySquadMatchCommand(currentMatch, {
        type: "confirm_loadout",
        slot,
      });
      commitSquadMatchUpdate(nextMatch, returnTo, `${slot} confirmed loadout handoff.`, "success");
    });
  });

  document.querySelectorAll<HTMLElement>("[data-squad-complete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const slot = button.getAttribute("data-squad-complete") as SessionPlayerSlot | null;
      const currentMatch = getSquadMatchState();
      if (!slot || !currentMatch) {
        return;
      }
      if (squadTransportStatus.role === "client") {
        return;
      }
      const nextMatch = applySquadMatchCommand(currentMatch, {
        type: "complete_match",
        winnerSlots: [slot],
        reason: "Preview battle result recorded from Comms Array.",
      });
      commitSquadMatchUpdate(nextMatch, returnTo, `${slot} recorded as the winner.`, "success");
    });
  });
  
  // Training config controls
  const gridWidthSelect = document.getElementById("gridWidthSelect") as HTMLSelectElement;
  const gridHeightSelect = document.getElementById("gridHeightSelect") as HTMLSelectElement;
  const difficultySelect = document.getElementById("difficultySelect") as HTMLSelectElement;
  const customDifficultySelect = document.getElementById("customDifficultySelect") as HTMLSelectElement | null;
  const customFloorsSelect = document.getElementById("customFloorsSelect") as HTMLSelectElement | null;
  const customDensitySelect = document.getElementById("customDensitySelect") as HTMLSelectElement | null;
  const customSprawlSelect = document.getElementById("customSprawlSelect") as HTMLSelectElement | null;
  
  if (gridWidthSelect) {
    gridWidthSelect.addEventListener("change", () => {
      trainingConfig.gridW = parseInt(gridWidthSelect.value);
    });
  }
  
  if (gridHeightSelect) {
    gridHeightSelect.addEventListener("change", () => {
      trainingConfig.gridH = parseInt(gridHeightSelect.value);
    });
  }
  
  if (difficultySelect) {
    difficultySelect.addEventListener("change", () => {
      trainingConfig.difficulty = difficultySelect.value as "easy" | "normal" | "hard";
    });
  }

  if (customDifficultySelect) {
    customDifficultySelect.addEventListener("change", () => {
      customOperationConfig.difficulty = customDifficultySelect.value as Difficulty;
    });
  }

  if (customFloorsSelect) {
    customFloorsSelect.addEventListener("change", () => {
      customOperationConfig.floors = Math.max(1, parseInt(customFloorsSelect.value, 10) || 1);
    });
  }

  if (customDensitySelect) {
    customDensitySelect.addEventListener("change", () => {
      customOperationConfig.enemyDensity = customDensitySelect.value as EnemyDensity;
    });
  }

  if (customSprawlSelect) {
    customSprawlSelect.addEventListener("change", () => {
      customOperationConfig.sprawlDirection = customSprawlSelect.value as TheaterSprawlDirection;
    });
  }
  
  // Start Training button
  const startTrainingBtn = document.getElementById("startTrainingBtn");
  if (startTrainingBtn) {
    startTrainingBtn.onclick = () => {
      startTrainingBattle(returnTo);
    };
  }

  const startCustomOperationBtn = document.getElementById("startCustomOperationBtn");
  if (startCustomOperationBtn) {
    startCustomOperationBtn.onclick = () => {
      startCustomOperation();
    };
  }
}

function startTrainingBattle(returnTo: CommsReturnTo): void {
  const state = getGameState();
  
  // Validate grid bounds
  if (trainingConfig.gridW < 4 || trainingConfig.gridW > 8) {
    showNotification("Grid width must be between 4 and 8", "error");
    return;
  }
  if (trainingConfig.gridH < 3 || trainingConfig.gridH > 6) {
    showNotification("Grid height must be between 3 and 6", "error");
    return;
  }
  
  // Create training encounter
  const encounter = createTrainingEncounter(state, trainingConfig);
  
  if (!encounter) {
    showNotification("Failed to create training encounter", "error");
    return;
  }
  
  // Store config for rematch
  lastTrainingConfig = { ...trainingConfig };
  
  // Create battle from encounter
  const battle = createBattleFromEncounter(state, encounter, `training_${Date.now()}`);
  
  if (!battle) {
    showNotification("Failed to create battle", "error");
    return;
  }
  
  // Mark as training battle
  (battle as any).isTraining = true;
  (battle as any).trainingConfig = trainingConfig;
  (battle as any).returnTo = returnTo;
  
  // Store battle in state
  updateGameState(prev => ({
    ...prev,
    currentBattle: battle,
    phase: "battle",
  }));
  
  // Render battle screen
  renderBattleScreen();
}

function startCustomOperation(): void {
  try {
    abandonRun();
  } catch {
    // No active run to clear.
  }

  startOperationRun(
    "op_custom",
    customOperationConfig.difficulty,
    customOperationConfig.floors,
    customOperationConfig.enemyDensity,
    customOperationConfig.sprawlDirection,
  );
  syncCampaignToGameState();

  const operation = ensureOperationHasTheater(getGameState().operation);
  if (!operation) {
    showNotification("Failed to initialize custom operation", "error");
    return;
  }

  updateGameState((state) => ({
    ...state,
    phase: "loadout",
    operation: {
      ...operation,
      launchSource: "comms",
    },
  }));

  unregisterBaseCampReturnHotkey("comms-array-screen");
  renderLoadoutScreen();
  showNotification(
    `Custom operation ready // ${customOperationConfig.floors} floor${customOperationConfig.floors === 1 ? "" : "s"} // ${customOperationConfig.enemyDensity.toUpperCase()} density`,
    "success",
  );
}

export function getLastTrainingConfig(): TrainingConfig | null {
  return lastTrainingConfig;
}

export function clearLastTrainingConfig(): void {
  lastTrainingConfig = null;
}

function showNotification(message: string, type: "success" | "error" | "info"): void {
  showSystemPing({
    title: type === "error" ? "COMMS ERROR" : type === "success" ? "COMMS READY" : "COMMS NOTICE",
    message,
    type,
    channel: "comms-array",
  });
  return;

  // Simple notification - reuse existing pattern if available
  const notification = document.createElement("div");
  notification.className = `notification notification--${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    background: ${type === "error" ? "#8b0000" : type === "success" ? "#006400" : "#1a4d7a"};
    color: white;
    border-radius: 4px;
    z-index: 10000;
    font-family: monospace;
    font-size: 0.9rem;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

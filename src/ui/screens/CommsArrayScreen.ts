// ============================================================================
// CHAOS CORE - COMMS ARRAY SCREEN
// Training battles and future multiplayer features
// ============================================================================

import { getGameState, setGameState, subscribe, updateGameState } from "../../state/gameStore";
import { createTrainingEncounter, TrainingConfig } from "../../core/trainingEncounter";
import { createBattleFromEncounter } from "../../core/battleFromEncounter";
import { applyExternalBattleState, applyRemoteCoopBattleCommand, applyRemoteSquadBattleCommand, renderBattleScreen } from "./BattleScreen";
import type { BattleState as RuntimeBattleState } from "../../core/battle";
import { mountBattleContextById, mountBattleState } from "../../core/session";
import { abandonRun, startOperationRun, syncCampaignToGameState } from "../../core/campaignManager";
import { createDefaultCampaignProgress, Difficulty, EnemyDensity, saveCampaignProgress } from "../../core/campaign";
import {
  type CoopTheaterCommand,
  type EconomyPreset,
  type LobbyCoopParticipantState,
  NETWORK_PLAYER_SLOTS,
  type OperationRun,
  type ResourceKey,
  type ResourceLedger,
  SESSION_PLAYER_SLOTS,
  TheaterSprawlDirection,
  type LobbyState,
  type LobbyReturnContext,
  type LobbySkirmishIntermissionDecision,
  type NetworkPlayerSlot,
  type SessionPlayerSlot,
  type SkirmishPlaylist,
  type SkirmishRoundSpec,
  type TheaterNetworkState,
  type TradeTransfer,
} from "../../core/types";
import { ensureOperationHasTheater } from "../../core/theaterSystem";
import { renderLoadoutScreen } from "./LoadoutScreen";
import { renderActiveOperationSurface } from "./activeOperationFlow";
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
  createResumableCoopOperationsLobby,
  createSkirmishMatchFromPlaylist,
  findNextOpenLobbySlot,
  findReconnectableLobbySlot,
  getActiveLobbyPlaylistRound,
  getDefaultLobbyPlaylist,
  getLobbyLocalSkirmishMatch,
  launchCoopOperationsActivity,
  loadLobbyState,
  markLobbyMemberDisconnected,
  removeLobbyMember,
  saveLobbyState,
  setCoopOperationsEconomyState,
  setCoopOperationsSharedCampaign,
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
import { getTacticalMapById, getTacticalMapCatalog } from "../../core/tacticalMaps";
import {
  approveSessionTradeTransfer,
  cancelSessionTradeTransfer,
  clearCoopOperationsSession,
  launchCoopOperationsSessionFromLobby,
  requestSessionTradeTransfer,
  setSharedEconomyPreset,
} from "../../core/session";
import {
  applySquadBattleToGameState,
  createSquadBattlePayload,
  createSquadBattleState,
  parseSquadBattlePayload,
  type SquadBattleCommand,
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
import {
  formatSaveTimestamp,
  getSharedCampaignSlotName,
  isSharedCampaignSlot,
  listSharedCampaignSaves,
  loadSharedCampaign,
  saveSharedCampaign,
  triggerSharedCampaignAutosave,
  enableSharedCampaignAutosave,
  SHARED_CAMPAIGN_SLOTS,
  type SharedCampaignSlot,
  type SaveInfo as SharedCampaignSaveInfo,
} from "../../core/saveSystem";
import { createNewGameState } from "../../core/initialState";
import { formatResourceShortLabel, getResourceEntries, RESOURCE_KEYS } from "../../core/resources";

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
let skirmishPlaylistDraft: SkirmishPlaylist = getDefaultLobbyPlaylist();
let selectedChallengeTargetSlot: NetworkPlayerSlot | null = null;

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
let shouldAutoResumeRemoteCoopOperations = false;
let cleanupCoopOperationsStateSync: (() => void) | null = null;
let lastCoopOperationsSyncSignature = "";
let selectedSharedCampaignSlot: SharedCampaignSlot = SHARED_CAMPAIGN_SLOTS.CAMPAIGN_1;
let sharedCampaignSaveInfos: SharedCampaignSaveInfo[] = [];
let sharedCampaignSavesHydrated = false;
let sharedCampaignSavesLoading = false;
let coopTransferDraft: {
  targetPlayerId: SessionPlayerSlot | null;
  kind: "wad" | "resource";
  resourceKey: ResourceKey;
  amount: number;
} = {
  targetPlayerId: "P2",
  kind: "wad",
  resourceKey: RESOURCE_KEYS[0],
  amount: 10,
};

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

function parseCoopTheaterSnapshot(payload: string | null | undefined): TheaterNetworkState | null {
  if (!payload) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as TheaterNetworkState;
    return parsed?.definition?.id && parsed?.rooms ? parsed : null;
  } catch {
    return null;
  }
}

function getLocalCoopParticipant(lobby: LobbyState | null | undefined): LobbyCoopParticipantState | null {
  if (!lobby || lobby.activity.kind !== "coop_operations" || !lobby.localSlot) {
    return null;
  }
  return lobby.activity.coopOperations.participants[lobby.localSlot] ?? null;
}

function getParticipantTheaterSnapshotPayload(
  lobby: LobbyState | null | undefined,
  participant: LobbyCoopParticipantState | null | undefined,
): string | null {
  if (participant?.theaterSnapshot) {
    return participant.theaterSnapshot;
  }
  if (!lobby || lobby.activity.kind !== "coop_operations" || !participant?.currentTheaterId) {
    return null;
  }
  return lobby.activity.coopOperations.theaterContexts[participant.currentTheaterId]?.snapshot ?? null;
}

function getParticipantBattleSnapshotPayload(
  lobby: LobbyState | null | undefined,
  participant: LobbyCoopParticipantState | null | undefined,
): string | null {
  if (
    lobby?.activity.kind === "coop_operations"
    && participant?.activeBattleId
    && lobby.activity.coopOperations.battleContexts[participant.activeBattleId]
  ) {
    return lobby.activity.coopOperations.battleContexts[participant.activeBattleId]?.snapshot ?? null;
  }
  if (participant?.battleSnapshot) {
    return participant.battleSnapshot;
  }
  if (!lobby || lobby.activity.kind !== "coop_operations" || !participant?.currentTheaterId) {
    return null;
  }
  return lobby.activity.coopOperations.theaterContexts[participant.currentTheaterId]?.battleSnapshot ?? null;
}

function getCoopResourceLedger(
  lobby: LobbyState | null | undefined,
): ResourceLedger {
  if (lobby?.activity.kind === "coop_operations") {
    return lobby.activity.coopOperations.resourceLedger;
  }
  return getGameState().session.resourceLedger;
}

function getCoopPendingTransfers(
  lobby: LobbyState | null | undefined,
): TradeTransfer[] {
  if (lobby?.activity.kind === "coop_operations") {
    return lobby.activity.coopOperations.pendingTransfers;
  }
  return getGameState().session.pendingTransfers;
}

function getSelectedCoopParticipants(
  lobby: LobbyState | null | undefined,
): Array<LobbyCoopParticipantState & { networkSlot: NetworkPlayerSlot }> {
  if (!lobby || lobby.activity.kind !== "coop_operations") {
    return [];
  }
  return lobby.activity.coopOperations.selectedSlots
    .map((slot) => {
      const activity = lobby.activity;
      if (activity.kind !== "coop_operations") {
        return null;
      }
      const participant = activity.coopOperations.participants[slot];
      return participant ? { ...participant, networkSlot: slot } : null;
    })
    .filter((participant): participant is LobbyCoopParticipantState & { networkSlot: NetworkPlayerSlot } => Boolean(participant?.selected));
}

function getActiveCoopOperators(
  lobby: LobbyState | null | undefined,
): Array<LobbyCoopParticipantState & { networkSlot: NetworkPlayerSlot }> {
  return getSelectedCoopParticipants(lobby).filter((participant) => Boolean(participant.sessionSlot && !participant.standby));
}

function getStandbyCoopParticipants(
  lobby: LobbyState | null | undefined,
): Array<LobbyCoopParticipantState & { networkSlot: NetworkPlayerSlot }> {
  return getSelectedCoopParticipants(lobby).filter((participant) => participant.standby);
}

function getSessionSlotCallsignMap(lobby: LobbyState | null | undefined): Record<SessionPlayerSlot, string> {
  const fallback = SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
    acc[slot] = slot;
    return acc;
  }, {} as Record<SessionPlayerSlot, string>);
  for (const participant of getActiveCoopOperators(lobby)) {
    if (participant.sessionSlot) {
      fallback[participant.sessionSlot] = participant.callsign || participant.sessionSlot;
    }
  }
  return fallback;
}

function formatResourcePoolSummary(pool: ResourceLedger["shared"] | null | undefined): string {
  if (!pool) {
    return "0 WAD";
  }
  const resourceEntries = getResourceEntries(pool.resources, { includeZero: false })
    .map((entry) => `${formatResourceShortLabel(entry.key)} ${entry.amount}`)
    .join(" // ");
  return `${Math.max(0, Math.floor(pool.wad ?? 0))} WAD${resourceEntries ? ` // ${resourceEntries}` : ""}`;
}

function getActiveLocalCoopSessionSlot(lobby: LobbyState | null | undefined): SessionPlayerSlot | null {
  return getLocalCoopParticipant(lobby)?.sessionSlot ?? null;
}

function syncCoopTransferDraft(lobby: LobbyState | null | undefined): void {
  const localSessionSlot = getActiveLocalCoopSessionSlot(lobby);
  const targetSlots = getActiveCoopOperators(lobby)
    .map((participant) => participant.sessionSlot)
    .filter((slot): slot is SessionPlayerSlot => Boolean(slot && slot !== localSessionSlot));
  if (!coopTransferDraft.targetPlayerId || !targetSlots.includes(coopTransferDraft.targetPlayerId)) {
    coopTransferDraft.targetPlayerId = targetSlots[0] ?? null;
  }
  if (!RESOURCE_KEYS.includes(coopTransferDraft.resourceKey)) {
    coopTransferDraft.resourceKey = RESOURCE_KEYS[0];
  }
  if (!Number.isFinite(coopTransferDraft.amount) || coopTransferDraft.amount <= 0) {
    coopTransferDraft.amount = 10;
  }
}

function applyParticipantTheaterSnapshot(
  lobby: LobbyState | null | undefined,
  operation: OperationRun | null,
  participant: LobbyCoopParticipantState | null | undefined,
): OperationRun | null {
  if (!operation) {
    return null;
  }
  const theater = parseCoopTheaterSnapshot(getParticipantTheaterSnapshotPayload(lobby, participant));
  if (!theater) {
    return operation;
  }
  return {
    ...operation,
    theater,
    theaterFloors: {
      ...(operation.theaterFloors ?? {}),
      [operation.currentFloorIndex]: theater,
    },
  };
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
    const localParticipant = getLocalCoopParticipant(lobby);
    if (
      lobby?.activity.kind === "coop_operations"
      && lobby.activity.coopOperations.status === "active"
      && localParticipant?.selected
    ) {
      const hydratedState = launchCoopOperationsSessionFromLobby(nextState, lobby);
      const parsedOperation = applyParticipantTheaterSnapshot(
        lobby,
        parseCoopOperationSnapshot(lobby.activity.coopOperations.operationSnapshot),
        localParticipant,
      );
      const parsedBattle = parseCoopBattleSnapshot(
        getParticipantBattleSnapshotPayload(lobby, localParticipant) ?? lobby.activity.coopOperations.battleSnapshot,
      );
      const operationPhase = localParticipant.operationPhase ?? lobby.activity.coopOperations.operationPhase;
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
        phase: operationPhase ?? hydratedState.phase,
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

function clonePlaylist(playlist: SkirmishPlaylist): SkirmishPlaylist {
  return {
    rounds: playlist.rounds.map((round) => ({ ...round })),
  };
}

function normalizeRoundForSelectedMap(round: SkirmishRoundSpec): SkirmishRoundSpec {
  const tacticalMap = getTacticalMapById(round.mapId ?? null);
  if (!tacticalMap) {
    return round;
  }
  return {
    ...round,
    gridWidth: tacticalMap.width,
    gridHeight: tacticalMap.height,
  };
}

function getPlaylistValidation(playlist: SkirmishPlaylist): { valid: boolean; messages: string[] } {
  const messages: string[] = [];
  playlist.rounds.forEach((round, index) => {
    const tacticalMap = getTacticalMapById(round.mapId ?? null);
    if (tacticalMap && !tacticalMap.supportedModes.includes(round.objectiveType)) {
      messages.push(`Round ${index + 1}: ${tacticalMap.name} does not support ${getSquadWinConditionLabel(round.objectiveType)}.`);
    }
  });
  return {
    valid: messages.length === 0,
    messages,
  };
}

function renderSkirmishObjectivePreview(round: Pick<SkirmishRoundSpec, "gridWidth" | "gridHeight" | "objectiveType" | "mapId">): string {
  const tacticalMap = getTacticalMapById(round.mapId ?? null);
  const width = tacticalMap?.width ?? round.gridWidth;
  const height = tacticalMap?.height ?? round.gridHeight;
  const previewCells = tacticalMap ? [] : getSkirmishObjectivePreviewCells(round);
  const cellMarkup = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const hasTile = tacticalMap ? tacticalMap.tiles.some((tile) => tile.x === x && tile.y === y) : true;
      const isFriendlyDeploy = tacticalMap
        ? tacticalMap.zones.friendlySpawn.some((point) => point.x === x && point.y === y)
        : x === 0;
      const isEnemyDeploy = tacticalMap
        ? tacticalMap.zones.enemySpawn.some((point) => point.x === x && point.y === y)
        : x === width - 1;
      const previewCell = tacticalMap
        ? tacticalMap.zones.relay.some((point) => point.x === x && point.y === y)
          ? { kind: "relay" as const }
          : tacticalMap.zones.friendlyBreach.some((point) => point.x === x && point.y === y)
            ? { kind: "friendly_breach" as const }
            : tacticalMap.zones.enemyBreach.some((point) => point.x === x && point.y === y)
              ? { kind: "enemy_breach" as const }
              : null
        : previewCells.find((cell) => cell.x === x && cell.y === y) ?? null;
      const classes = [
        "skirmish-objective-preview__cell",
        !hasTile ? "skirmish-objective-preview__cell--void" : "",
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
      <div class="skirmish-objective-preview__grid" style="grid-template-columns: repeat(${width}, 1fr);">
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

function renderCoopEconomyPanel(lobby: LobbyState | null | undefined): string {
  if (!lobby || lobby.activity.kind !== "coop_operations") {
    return "";
  }
  syncCoopTransferDraft(lobby);
  const activity = lobby.activity.coopOperations;
  const ledger = getCoopResourceLedger(lobby);
  const pendingTransfers = getCoopPendingTransfers(lobby);
  const participants = getSelectedCoopParticipants(lobby);
  const activeOperators = getActiveCoopOperators(lobby);
  const standbyParticipants = getStandbyCoopParticipants(lobby);
  const localParticipant = getLocalCoopParticipant(lobby);
  const localSessionSlot = localParticipant?.standby ? null : (localParticipant?.sessionSlot ?? null);
  const sessionCallsigns = getSessionSlotCallsignMap(lobby);
  const transferTargets = activeOperators.filter((participant) => participant.sessionSlot && participant.sessionSlot !== localSessionSlot);
  const canSubmitTransfer = Boolean(
    activity.status === "active"
    && ledger.preset === "partitioned"
    && localSessionSlot
    && coopTransferDraft.targetPlayerId
    && coopTransferDraft.amount > 0,
  );

  return `
    <div class="settings-category" style="margin-top: 1rem;">
      <div class="settings-category-header">CO-OP ECONOMY</div>
      <div class="config-note">
        <span class="note-icon">E</span>
        <span>${ledger.preset === "shared" ? "Shared command pool active." : "Partitioned operator ledgers active."}</span>
      </div>
      <div class="config-note">
        <span class="note-icon">W</span>
        <span>Campaign Total // ${escapeHtml(formatResourcePoolSummary(ledger.shared))}</span>
      </div>
      ${standbyParticipants.length > 0 ? `
        <div class="config-note">
          <span class="note-icon">S</span>
          <span>${standbyParticipants.length} selected member${standbyParticipants.length === 1 ? "" : "s"} currently standing by outside the active operator runtime.</span>
        </div>
      ` : ""}
      ${canLocalHostLobby(lobby) ? `
        <div class="comms-array-button-group" style="margin-top: 0.75rem;">
          <button class="comms-array-btn ${ledger.preset === "shared" ? "comms-array-btn--primary" : ""}" id="setCoopEconomySharedBtn">
            SHARED ECONOMY
          </button>
          <button class="comms-array-btn ${ledger.preset === "partitioned" ? "comms-array-btn--primary" : ""}" id="setCoopEconomyPartitionedBtn">
            PARTITIONED ECONOMY
          </button>
        </div>
      ` : ""}
      ${ledger.preset === "partitioned" ? `
        <div class="bindings-list" style="margin-top: 0.75rem;">
          ${participants.map((participant) => {
            const pool = participant.sessionSlot ? ledger.perPlayer[participant.sessionSlot] : null;
            const label = participant.standby
              ? `STANDBY // ${participant.slot}`
              : (participant.sessionSlot ?? participant.slot);
            const summary = participant.standby
              ? "Awaiting open operator slot."
              : formatResourcePoolSummary(pool);
            return `
              <div class="binding-item">
                <span class="binding-action">${escapeHtml(label)} // ${escapeHtml(participant.callsign)}</span>
                <span class="binding-keys">${escapeHtml(summary)}</span>
              </div>
            `;
          }).join("")}
        </div>
      ` : ""}
      ${activity.status === "active" && ledger.preset === "partitioned" && localSessionSlot ? `
        <div class="training-config" style="margin-top: 0.9rem;">
          <div class="config-row">
            <label class="config-label">From:</label>
            <div class="config-select" style="display:flex;align-items:center;">${escapeHtml(localSessionSlot)} // ${escapeHtml(sessionCallsigns[localSessionSlot] ?? localSessionSlot)}</div>
          </div>
          <div class="config-row">
            <label class="config-label">To:</label>
            <select class="config-select" id="coopTransferTargetSelect">
              ${transferTargets.length > 0
                ? transferTargets.map((participant) => `
                    <option value="${participant.sessionSlot}" ${coopTransferDraft.targetPlayerId === participant.sessionSlot ? "selected" : ""}>
                      ${participant.sessionSlot} // ${escapeHtml(participant.callsign)}
                    </option>
                  `).join("")
                : `<option value="">No other operator allocations</option>`}
            </select>
          </div>
          <div class="config-row">
            <label class="config-label">Transfer:</label>
            <select class="config-select" id="coopTransferKindSelect">
              <option value="wad" ${coopTransferDraft.kind === "wad" ? "selected" : ""}>WAD</option>
              <option value="resource" ${coopTransferDraft.kind === "resource" ? "selected" : ""}>RESOURCE</option>
            </select>
          </div>
          ${coopTransferDraft.kind === "resource" ? `
            <div class="config-row">
              <label class="config-label">Resource:</label>
              <select class="config-select" id="coopTransferResourceKeySelect">
                ${RESOURCE_KEYS.map((resourceKey) => `
                  <option value="${resourceKey}" ${coopTransferDraft.resourceKey === resourceKey ? "selected" : ""}>
                    ${escapeHtml(formatResourceShortLabel(resourceKey))}
                  </option>
                `).join("")}
              </select>
            </div>
          ` : ""}
          <div class="config-row">
            <label class="config-label">Amount:</label>
            <input class="config-select" id="coopTransferAmountInput" type="number" min="1" step="1" value="${Math.max(1, Math.floor(coopTransferDraft.amount))}" />
          </div>
          <div class="comms-array-button-group" style="margin-top: 0.75rem;">
            <button class="comms-array-btn ${canLocalHostLobby(lobby) ? "comms-array-btn--primary" : ""}" id="submitCoopTransferBtn" ${canSubmitTransfer ? "" : "disabled"}>
              ${canLocalHostLobby(lobby) ? "SEND TRANSFER" : "REQUEST TRANSFER"}
            </button>
          </div>
        </div>
      ` : ""}
      ${pendingTransfers.length > 0 ? `
        <div class="bindings-list" style="margin-top: 0.85rem;">
          ${pendingTransfers.slice().reverse().map((transfer) => {
            const transferAmountLabel = transfer.kind === "wad"
              ? `${Math.max(0, Math.floor(transfer.wadAmount ?? 0))} WAD`
              : `${Math.max(0, Math.floor(transfer.resourceAmount ?? 0))} ${formatResourceShortLabel(transfer.resourceKey ?? RESOURCE_KEYS[0])}`;
            const transferStatusLabel = transfer.status.toUpperCase();
            return `
              <div class="binding-item">
                <span class="binding-action">${escapeHtml(`${transfer.fromPlayerId} // ${sessionCallsigns[transfer.fromPlayerId] ?? transfer.fromPlayerId} -> ${transfer.toPlayerId} // ${sessionCallsigns[transfer.toPlayerId] ?? transfer.toPlayerId} // ${transferAmountLabel} // ${transferStatusLabel}`)}</span>
                <span class="binding-keys">
                  ${escapeHtml(transfer.note ?? "No note")}
                  ${canLocalHostLobby(lobby) && transfer.status === "pending" ? `
                    <button class="comms-array-btn" type="button" data-coop-transfer-approve="${transfer.id}">APPROVE</button>
                    <button class="comms-array-btn" type="button" data-coop-transfer-cancel="${transfer.id}">CANCEL</button>
                  ` : ""}
                </span>
              </div>
            `;
          }).join("")}
        </div>
      ` : ""}
    </div>
  `;
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
    economyPreset: activity.economyPreset,
    resourceLedger: activity.resourceLedger,
    pendingTransfers: activity.pendingTransfers,
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

function getActiveSharedCampaignSlot(): SharedCampaignSlot | null {
  const lobby = getResolvedLobbyState();
  const lobbySlot =
    lobby?.activity.kind === "coop_operations"
      ? lobby.activity.coopOperations.sharedCampaignSlot
      : null;
  if (lobbySlot && isSharedCampaignSlot(lobbySlot)) {
    return lobbySlot;
  }

  const sessionSlot = getGameState().session.sharedCampaignSlot;
  return sessionSlot && isSharedCampaignSlot(sessionSlot) ? sessionSlot : null;
}

function getActiveSharedCampaignLabel(): string | null {
  const lobby = getResolvedLobbyState();
  if (lobby?.activity.kind === "coop_operations" && lobby.activity.coopOperations.sharedCampaignLabel) {
    return lobby.activity.coopOperations.sharedCampaignLabel;
  }
  return getGameState().session.sharedCampaignLabel ?? null;
}

function syncSelectedSharedCampaignSlotFromState(): void {
  const activeSlot = getActiveSharedCampaignSlot();
  if (activeSlot) {
    selectedSharedCampaignSlot = activeSlot;
  }
}

function getSharedCampaignInfo(slot: SharedCampaignSlot): SharedCampaignSaveInfo | null {
  return sharedCampaignSaveInfos.find((save) => save.slot === slot) ?? null;
}

function ensureSharedCampaignAutosaveSync(): void {
  enableSharedCampaignAutosave(
    () => getGameState(),
    () => {
      const slot = getGameState().session.sharedCampaignSlot;
      return slot && isSharedCampaignSlot(slot) ? slot : null;
    },
    ({ slot, timestamp }) => {
      const label = getGameState().session.sharedCampaignLabel ?? getSharedCampaignSlotName(slot);
      stampSharedCampaignSaveTimestamp(slot, label, timestamp, {
        rerender: false,
        refreshBrowser: false,
        broadcast: true,
      });
    },
  );
}

async function refreshSharedCampaignBrowser(returnTo: CommsReturnTo = activeCommsReturnTo): Promise<void> {
  if (sharedCampaignSavesLoading) {
    return;
  }

  sharedCampaignSavesLoading = true;
  try {
    sharedCampaignSaveInfos = await listSharedCampaignSaves();
    sharedCampaignSavesHydrated = true;
    syncSelectedSharedCampaignSlotFromState();
  } finally {
    sharedCampaignSavesLoading = false;
  }

  if (isCommsArrayMounted()) {
    renderCommsArrayScreen(returnTo);
  }
}

function ensureSharedCampaignBrowserHydrated(returnTo: CommsReturnTo = activeCommsReturnTo): void {
  if (sharedCampaignSavesHydrated || sharedCampaignSavesLoading) {
    return;
  }
  void refreshSharedCampaignBrowser(returnTo);
}

function stampSharedCampaignState(
  state: ReturnType<typeof getGameState>,
  slot: SharedCampaignSlot,
  label: string,
  timestamp: number | null,
) {
  return {
    ...state,
    session: {
      ...state.session,
      sharedCampaignSlot: slot,
      sharedCampaignLabel: label,
      sharedCampaignLastSavedAt: timestamp,
    },
  };
}

function syncSharedCampaignMetadataToLobby(
  lobby: LobbyState | null,
  slot: SharedCampaignSlot,
  label: string,
  timestamp: number | null,
): LobbyState | null {
  if (!lobby || lobby.activity.kind !== "coop_operations") {
    return lobby;
  }
  const nextLobby = setCoopOperationsSharedCampaign(lobby, slot, label, timestamp);
  return setCoopOperationsEconomyState(nextLobby, {
    economyPreset: getGameState().session.resourceLedger.preset,
    resourceLedger: getGameState().session.resourceLedger,
    pendingTransfers: getGameState().session.pendingTransfers,
  });
}

function updateSharedCampaignSaveInfoCache(
  slot: SharedCampaignSlot,
  timestamp: number,
  state: ReturnType<typeof getGameState>,
): void {
  const preview = {
    callsign: state.profile?.callsign ?? "Unknown",
    squadName: state.profile?.squadName ?? "Unknown Squad",
    operationName: state.operation?.codename ?? state.operation?.id ?? "No Active Operation",
    wad: Math.max(0, Math.floor(state.wad ?? 0)),
    partyCount: state.partyUnitIds?.length ?? 0,
  };
  const nextInfo = { slot, timestamp, preview };
  const existingIndex = sharedCampaignSaveInfos.findIndex((save) => save.slot === slot);
  if (existingIndex >= 0) {
    sharedCampaignSaveInfos = [
      ...sharedCampaignSaveInfos.slice(0, existingIndex),
      nextInfo,
      ...sharedCampaignSaveInfos.slice(existingIndex + 1),
    ];
  } else {
    sharedCampaignSaveInfos = [...sharedCampaignSaveInfos, nextInfo];
  }
  sharedCampaignSaveInfos = [...sharedCampaignSaveInfos].sort((left, right) => right.timestamp - left.timestamp);
}

function stampSharedCampaignSaveTimestamp(
  slot: SharedCampaignSlot,
  label: string,
  timestamp: number,
  options: {
    rerender?: boolean;
    refreshBrowser?: boolean;
    broadcast?: boolean;
  } = {},
): void {
  updateGameState((state) => stampSharedCampaignState(state, slot, label, timestamp));
  updateSharedCampaignSaveInfoCache(slot, timestamp, getGameState());
  const currentLobby = getResolvedLobbyState();
  const nextLobby = syncSharedCampaignMetadataToLobby(currentLobby, slot, label, timestamp);
  if (nextLobby && nextLobby !== currentLobby) {
    commitLobbyState(nextLobby, undefined, "info", options.rerender ?? false);
    if (options.broadcast && isTauriSquadTransportAvailable() && squadTransportStatus.role === "host") {
      void broadcastLobbySnapshot(nextLobby);
    }
  }
  if (options.refreshBrowser) {
    void refreshSharedCampaignBrowser(activeCommsReturnTo);
  } else if (isCommsArrayMounted()) {
    renderCommsArrayScreen(activeCommsReturnTo);
  }
}

function createResumedLobbyFromLoadedSharedCampaign(
  loadedState: ReturnType<typeof getGameState>,
  existingLobby: LobbyState | null,
  returnContext: LobbyReturnContext,
): LobbyState | null {
  if (loadedState.session.mode !== "coop_operations") {
    return existingLobby;
  }

  if (
    existingLobby
    && existingLobby.activity.kind === "coop_operations"
    && squadTransportStatus.role !== "idle"
  ) {
    const stampedLobby = setCoopOperationsSharedCampaign(
      existingLobby,
      loadedState.session.sharedCampaignSlot ?? null,
      loadedState.session.sharedCampaignLabel ?? null,
      loadedState.session.sharedCampaignLastSavedAt ?? null,
    );
    return syncCoopOperationsRuntime(stampedLobby, loadedState);
  }

  return createResumableCoopOperationsLobby(
    loadedState,
    existingLobby?.returnContext ?? returnContext,
  );
}

async function prepareSelectedSharedCampaign(returnTo: CommsReturnTo = activeCommsReturnTo): Promise<void> {
  const slot = selectedSharedCampaignSlot;
  const slotInfo = getSharedCampaignInfo(slot);
  if (slotInfo && !window.confirm(`${getSharedCampaignSlotName(slot)} already has a shared campaign. Overwrite it with the current state?`)) {
    return;
  }

  const currentState = getGameState();
  const sourceState = returnTo === "menu"
    ? createNewGameState()
    : currentState;
  const label = getActiveSharedCampaignLabel() ?? getSharedCampaignSlotName(slot);
  const savedAt = Date.now();
  const saveTargetState = stampSharedCampaignState(sourceState, slot, label, savedAt);
  const saveResult = await saveSharedCampaign(slot, saveTargetState, { label });
  if (!saveResult.success) {
    throw new Error(saveResult.error ?? "Failed to prepare the shared campaign slot.");
  }

  if (returnTo === "menu") {
    setGameState(stampSharedCampaignState(
      {
        ...sourceState,
        lobby: currentState.lobby,
      },
      slot,
      label,
      savedAt,
    ));
  } else {
    updateGameState((state) => stampSharedCampaignState(state, slot, label, savedAt));
  }
  const currentLobby = getResolvedLobbyState();
  const nextLobby = syncSharedCampaignMetadataToLobby(currentLobby, slot, label, savedAt);
  if (nextLobby && nextLobby !== currentLobby) {
    commitLobbyState(nextLobby, "Shared campaign slot prepared.", "success", false);
    if (isTauriSquadTransportAvailable() && squadTransportStatus.role === "host") {
      await broadcastLobbySnapshot(nextLobby);
    }
  }

  await refreshSharedCampaignBrowser(returnTo);
}

async function loadSelectedSharedCampaignIntoState(returnTo: CommsReturnTo = activeCommsReturnTo): Promise<void> {
  const slot = selectedSharedCampaignSlot;
  const result = await loadSharedCampaign(slot);
  if (!result.success || !result.state) {
    throw new Error(result.error ?? "Failed to load the shared campaign.");
  }

  const label = result.sharedCampaignMetadata?.label ?? getSharedCampaignSlotName(slot);
  const timestamp = result.sharedCampaignMetadata?.timestamp ?? Date.now();
  const currentState = getGameState();
  const returnContext = currentState.lobby?.returnContext ?? captureLobbyReturnContext();
  const nextState = stampSharedCampaignState(
    {
      ...result.state,
      lobby: null,
    },
    slot,
    label,
    timestamp,
  );
  const resumedLobby = createResumedLobbyFromLoadedSharedCampaign(nextState, currentState.lobby, returnContext);
  saveCampaignProgress(result.campaignProgress ?? createDefaultCampaignProgress());
  setGameState({
    ...nextState,
    lobby: resumedLobby,
  });
  saveLobbyState(resumedLobby);
  updateSharedCampaignSaveInfoCache(slot, timestamp, getGameState());
  if (resumedLobby && isTauriSquadTransportAvailable() && squadTransportStatus.role === "host") {
    await broadcastLobbySnapshot(resumedLobby);
  }

  await refreshSharedCampaignBrowser(returnTo);
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
  | { type: "lobby_join"; callsign: string; preferredSlot?: NetworkPlayerSlot | null }
  | { type: "leave_lobby" }
  | { type: "avatar_update"; mapId: string; x: number; y: number; facing: "north" | "south" | "east" | "west" }
  | { type: "challenge_request"; challengeeSlot: NetworkPlayerSlot; playlist: SkirmishPlaylist }
  | { type: "challenge_response"; accepted: boolean }
  | { type: "challenge_cancel" }
  | { type: "launch_coop_operations"; selectedSlots?: NetworkPlayerSlot[] }
  | { type: "begin_coop_operations" }
  | { type: "update_coop_selection"; selectedSlots: NetworkPlayerSlot[] }
  | { type: "update_coop_economy_preset"; preset: EconomyPreset }
  | {
      type: "request_coop_transfer";
      toPlayerId: SessionPlayerSlot;
      transferKind: "wad" | "resource";
      wadAmount?: number;
      resourceKey?: ResourceKey;
      resourceAmount?: number;
    }
  | { type: "approve_coop_transfer"; transferId: string }
  | { type: "cancel_coop_transfer"; transferId: string }
  | { type: "skirmish_next_round"; decision: LobbySkirmishIntermissionDecision }
  | { type: "coop_theater_command"; command: CoopTheaterCommand }
  | { type: "coop_battle_command"; payload: string }
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

function getPreferredLobbyReconnectCallsign(): string {
  const lobby = getActiveLobbyState();
  const localSlot = lobby?.localSlot ?? lobbyClientAssignedSlot ?? null;
  return (localSlot && lobby?.members[localSlot]?.callsign?.trim())
    || multiplayerLobbyPreviewConfig.operatorCallsign.trim()
    || getGameState().profile.callsign
    || "OPERATOR";
}

function getPreferredLobbyReconnectSlot(): NetworkPlayerSlot | null {
  const lobby = getActiveLobbyState();
  const localSlot = lobby?.localSlot ?? lobbyClientAssignedSlot ?? null;
  return localSlot && NETWORK_PLAYER_SLOTS.includes(localSlot) ? localSlot : null;
}

function shouldAttemptRemoteCoopResume(lobby: LobbyState | null | undefined): boolean {
  return Boolean(
    lobby
    && lobby.activity.kind === "coop_operations"
    && lobby.activity.coopOperations.status === "active",
  );
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
    renderActiveOperationSurface();
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
  if (currentLobby.activity.kind === "skirmish") {
    throw new Error("Finish the active Skirmish before staging Co-Op Operations.");
  }
  const normalizedSlots = (selectedSlots?.length
    ? selectedSlots
    : NETWORK_PLAYER_SLOTS.filter((slot) => Boolean(currentLobby.members[slot]?.connected))) as NetworkPlayerSlot[];
  const sharedCampaignSlot = getActiveSharedCampaignSlot();
  const sharedCampaignLabel = getActiveSharedCampaignLabel()
    ?? (sharedCampaignSlot ? getSharedCampaignSlotName(sharedCampaignSlot) : null);
  let nextLobby = currentLobby.activity.kind === "coop_operations"
    ? updateCoopOperationsSelection(currentLobby, normalizedSlots)
    : startCoopOperationsActivity(currentLobby, normalizedSlots);
  if (sharedCampaignSlot) {
    nextLobby = setCoopOperationsSharedCampaign(
      nextLobby,
      sharedCampaignSlot,
      sharedCampaignLabel,
      getGameState().session.sharedCampaignLastSavedAt ?? null,
    );
  }
  if (nextLobby.activity.kind === "coop_operations") {
    nextLobby = setCoopOperationsEconomyState(nextLobby, {
      economyPreset: nextLobby.activity.coopOperations.economyPreset,
      resourceLedger: getGameState().session.resourceLedger,
      pendingTransfers: getGameState().session.pendingTransfers,
    });
  }
  commitLobbyState(
    nextLobby,
    (() => {
      const baseMessage = currentLobby.activity.kind === "coop_operations"
        ? "Co-Op Operations staging updated."
        : "Co-Op Operations staging opened in the lobby.";
      if (nextLobby.activity.kind !== "coop_operations") {
        return baseMessage;
      }
      const standbyCount = nextLobby.activity.coopOperations.standbySlots.length;
      return standbyCount > 0
        ? `${baseMessage} ${standbyCount} member${standbyCount === 1 ? "" : "s"} currently on standby outside the active operator runtime.`
        : baseMessage;
    })(),
    "success",
    false,
  );
  await broadcastLobbySnapshot(nextLobby);
}

function hydrateCoopOperationFromLobby(lobby: LobbyState): OperationRun | null {
  if (lobby.activity.kind !== "coop_operations") {
    return null;
  }
  const coopActivity = lobby.activity.coopOperations;
  const localParticipant = getLocalCoopParticipant(lobby);
  const parsedOperation = applyParticipantTheaterSnapshot(
    lobby,
    parseCoopOperationSnapshot(coopActivity.operationSnapshot),
    localParticipant,
  );
  const parsedBattle = parseCoopBattleSnapshot(
    getParticipantBattleSnapshotPayload(lobby, localParticipant) ?? coopActivity.battleSnapshot,
  );
  const operationPhase = localParticipant?.operationPhase ?? coopActivity.operationPhase;
  updateGameState((state) => {
    const nextState = launchCoopOperationsSessionFromLobby(state, lobby);
    const nextOperationState = {
      ...nextState,
      operation: parsedOperation ?? nextState.operation,
    };
    if (parsedBattle) {
      const mountedBattleState = localParticipant?.activeBattleId
        ? mountBattleContextById(nextOperationState, localParticipant.activeBattleId)
        : mountBattleState(nextOperationState, parsedBattle);
      return mountedBattleState.currentBattle
        ? mountedBattleState
        : mountBattleState(nextOperationState, parsedBattle);
    }
    return {
      ...nextOperationState,
      currentBattle: null,
      phase: operationPhase ?? nextState.phase,
    };
  });
  return parsedOperation;
}

function hydrateCoopBattleFromLobby(lobby: LobbyState): RuntimeBattleState | null {
  if (lobby.activity.kind !== "coop_operations") {
    return null;
  }
  const localParticipant = getLocalCoopParticipant(lobby);
  return parseCoopBattleSnapshot(
    getParticipantBattleSnapshotPayload(lobby, localParticipant) ?? lobby.activity.coopOperations.battleSnapshot,
  );
}

async function enterActiveCoopOperations(lobby: LobbyState): Promise<void> {
  if (lobby.activity.kind !== "coop_operations" || lobby.activity.coopOperations.status !== "active") {
    return;
  }
  const localParticipant = getLocalCoopParticipant(lobby);
  if (!localParticipant?.selected) {
    return;
  }
  if (localParticipant.standby || !localParticipant.sessionSlot) {
    const { renderFieldScreen } = await import("../../field/FieldScreen");
    renderFieldScreen(localParticipant.lastSafeMapId ?? "base_camp");
    return;
  }
  const parsedOperation = hydrateCoopOperationFromLobby(lobby);
  const parsedBattle = hydrateCoopBattleFromLobby(lobby);
  const targetMapId = localParticipant?.lastSafeMapId ?? "base_camp";
  const operationPhase = localParticipant.operationPhase ?? lobby.activity.coopOperations.operationPhase ?? null;
  if (parsedBattle && operationPhase === "battle") {
    updateGameState((state) => (
      localParticipant.activeBattleId
        ? mountBattleContextById(state, localParticipant.activeBattleId)
        : mountBattleState(state, parsedBattle)
    ));
    applyExternalBattleState(parsedBattle, "always");
    return;
  }
  if (parsedOperation && (operationPhase === "loadout" || operationPhase === "operation")) {
    if (operationPhase === "loadout") {
      renderLoadoutScreen();
      return;
    }
    if (localParticipant.stagingState === "theater" && parsedOperation.theater) {
      const { renderTheaterCommandScreen } = await import("./TheaterCommandScreen");
      renderTheaterCommandScreen();
      return;
    }
    renderActiveOperationSurface();
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
  const sharedCampaignSlot = getActiveSharedCampaignSlot();
  if (!sharedCampaignSlot) {
    throw new Error("Prepare or load a shared campaign slot before launching Co-Op Operations.");
  }
  const sharedCampaignLabel = getActiveSharedCampaignLabel() ?? getSharedCampaignSlotName(sharedCampaignSlot);
  const stagedLobby = setCoopOperationsSharedCampaign(
    currentLobby,
    sharedCampaignSlot,
    sharedCampaignLabel,
    getGameState().session.sharedCampaignLastSavedAt ?? null,
  );
  const launchedState = launchCoopOperationsSessionFromLobby(getGameState(), stagedLobby);
  const nextLobby = syncCoopOperationsRuntime(
    launchCoopOperationsActivity(stagedLobby),
    launchedState,
  );
  commitLobbyState(nextLobby, "Co-Op Operations linked into shared H.A.V.E.N.", "success", false);
  await broadcastLobbySnapshot(nextLobby);
  await enterActiveCoopOperations(nextLobby);
}

async function hostSetCoopEconomyPreset(
  currentLobby: LobbyState,
  preset: EconomyPreset,
): Promise<void> {
  if (currentLobby.activity.kind !== "coop_operations") {
    return;
  }
  if (currentLobby.activity.coopOperations.status === "active") {
    updateGameState((state) => setSharedEconomyPreset(state, preset));
    const nextLobby = syncCoopOperationsRuntime(
      setCoopOperationsEconomyState(currentLobby, { economyPreset: preset }),
      getGameState(),
    );
    commitLobbyState(
      nextLobby,
      preset === "shared"
        ? "Co-Op Operations economy returned to shared command."
        : "Co-Op Operations economy partitioned by operator.",
      "success",
      false,
    );
    await broadcastLobbySnapshot(nextLobby);
    return;
  }
  const previewState = setSharedEconomyPreset(getGameState(), preset);
  const nextLobby = setCoopOperationsEconomyState(currentLobby, {
    economyPreset: preset,
    resourceLedger: previewState.session.resourceLedger,
    pendingTransfers: preset === "shared"
      ? []
      : previewState.session.pendingTransfers,
  });
  commitLobbyState(
    nextLobby,
    preset === "shared"
      ? "Co-Op Operations will launch with a shared command pool."
      : "Co-Op Operations will launch with partitioned operator allocations.",
    "success",
    false,
  );
  await broadcastLobbySnapshot(nextLobby);
}

async function hostRequestCoopTransfer(
  currentLobby: LobbyState,
  request: {
    fromPlayerId: SessionPlayerSlot;
    toPlayerId: SessionPlayerSlot;
    kind: "wad" | "resource";
    wadAmount?: number;
    resourceKey?: ResourceKey;
    resourceAmount?: number;
  },
  autoApprove = false,
): Promise<void> {
  if (
    currentLobby.activity.kind !== "coop_operations"
    || currentLobby.activity.coopOperations.status !== "active"
  ) {
    return;
  }
  updateGameState((state) => requestSessionTradeTransfer(state, request));
  let nextState = getGameState();
  if (autoApprove) {
    const pendingTransfer = [...nextState.session.pendingTransfers]
      .reverse()
      .find((transfer) => transfer.status === "pending" && transfer.fromPlayerId === request.fromPlayerId && transfer.toPlayerId === request.toPlayerId);
    if (pendingTransfer) {
      updateGameState((state) => approveSessionTradeTransfer(state, pendingTransfer.id));
      nextState = getGameState();
    }
  }
  const nextLobby = syncCoopOperationsRuntime(currentLobby, nextState);
  commitLobbyState(
    nextLobby,
    autoApprove
      ? "Transfer applied to the Co-Op Operations ledger."
      : "Transfer request queued for host review.",
    "success",
    false,
  );
  await broadcastLobbySnapshot(nextLobby);
}

async function hostApproveCoopTransfer(
  currentLobby: LobbyState,
  transferId: string,
): Promise<void> {
  if (currentLobby.activity.kind !== "coop_operations") {
    return;
  }
  updateGameState((state) => approveSessionTradeTransfer(state, transferId));
  const nextLobby = syncCoopOperationsRuntime(currentLobby, getGameState());
  commitLobbyState(nextLobby, "Transfer resolution updated.", "success", false);
  await broadcastLobbySnapshot(nextLobby);
}

async function hostCancelCoopTransfer(
  currentLobby: LobbyState,
  transferId: string,
): Promise<void> {
  if (currentLobby.activity.kind !== "coop_operations") {
    return;
  }
  updateGameState((state) => cancelSessionTradeTransfer(state, transferId));
  const nextLobby = syncCoopOperationsRuntime(currentLobby, getGameState());
  commitLobbyState(nextLobby, "Transfer request cancelled.", "info", false);
  await broadcastLobbySnapshot(nextLobby);
}

async function sendLobbyCommandToHost(command: LobbyCommand): Promise<void> {
  if (!isTauriSquadTransportAvailable() || squadTransportStatus.role !== "client") {
    return;
  }
  await sendSquadTransportMessage("lobby_command", JSON.stringify(command));
}

async function requestRemoteLobbyReconnectHandshake(): Promise<void> {
  if (!isTauriSquadTransportAvailable() || squadTransportStatus.role !== "client") {
    return;
  }
  await sendLobbyCommandToHost({
    type: "lobby_join",
    callsign: getPreferredLobbyReconnectCallsign(),
    preferredSlot: getPreferredLobbyReconnectSlot(),
  });
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

async function resumeExistingMultiplayerLobbyHosting(currentLobby: LobbyState): Promise<LobbyState> {
  ensureCoopOperationsStateSync();
  if (isTauriSquadTransportAvailable()) {
    squadTransportStatus = await startSquadTransportHost();
  }
  lobbyClientAssignedSlot = "P1";
  activeSkirmishSurface = "comms";
  let nextLobby = setLobbyLocalSlot(currentLobby, "P1");
  nextLobby = upsertLobbyMember(
    nextLobby,
    "P1",
    nextLobby.members.P1?.callsign ?? getPreferredLobbyOperatorCallsign(),
    "host",
    "local",
  );
  nextLobby = {
    ...nextLobby,
    transportState: isTauriSquadTransportAvailable() && squadTransportStatus.role === "host"
      ? "hosting"
      : nextLobby.transportState,
    updatedAt: Date.now(),
  };
  syncActiveSkirmishPeerMaps(nextLobby);
  commitLobbyState(
    nextLobby,
    isTauriSquadTransportAvailable() && squadTransportStatus.role === "host"
      ? `Lobby resumed at ${squadTransportStatus.joinAddress ?? "host transport"}.`
      : "Lobby resumed.",
    "success",
    false,
  );
  await broadcastLobbySnapshot(nextLobby);
  return nextLobby;
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
  shouldAutoResumeRemoteCoopOperations = false;
  clearSquadMatchState();
  const joiningLobby = createJoiningMultiplayerLobby(callsign, captureLobbyReturnContext());
  commitLobbyState(joiningLobby, undefined, "info", false);
  await sendLobbyCommandToHost({ type: "lobby_join", callsign, preferredSlot: getPreferredLobbyReconnectSlot() });
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
  shouldAutoResumeRemoteCoopOperations = false;
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
  if (localParticipant.standby || !localParticipant.sessionSlot) {
    showNotification(
      `This operator is currently on standby. The live Co-Op runtime supports ${SESSION_PLAYER_SLOTS.length} active operator slots at once.`,
      "info",
    );
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
      const preferredReconnectSlot =
        currentLobby
        && command.preferredSlot
        && NETWORK_PLAYER_SLOTS.includes(command.preferredSlot)
        && currentLobby.members[command.preferredSlot]
        && !currentLobby.members[command.preferredSlot]?.connected
        && currentLobby.members[command.preferredSlot]?.callsign.trim().toLowerCase() === command.callsign.trim().toLowerCase()
          ? command.preferredSlot
          : null;
      const reconnectSlot = preferredReconnectSlot ?? (currentLobby ? findReconnectableLobbySlot(currentLobby, command.callsign) : null);
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
      commitLobbyState(
        nextLobby,
        reconnectSlot
          ? `${command.callsign} rejoined ${assignedSlot}.`
          : `${command.callsign} linked to ${assignedSlot}.`,
        "success",
        false,
      );
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
    case "update_coop_economy_preset": {
      const sourceSlot = lobbyRemotePeerSlots.get(sourcePeerId) ?? null;
      if (!currentLobby || currentLobby.hostSlot !== sourceSlot) {
        return;
      }
      await hostSetCoopEconomyPreset(currentLobby, command.preset);
      return;
    }
    case "request_coop_transfer": {
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
      await hostRequestCoopTransfer(
        currentLobby,
        {
          fromPlayerId: participant.sessionSlot,
          toPlayerId: command.toPlayerId,
          kind: command.transferKind,
          wadAmount: command.wadAmount,
          resourceKey: command.resourceKey,
          resourceAmount: command.resourceAmount,
        },
        false,
      );
      return;
    }
    case "approve_coop_transfer": {
      const sourceSlot = lobbyRemotePeerSlots.get(sourcePeerId) ?? null;
      if (!currentLobby || currentLobby.hostSlot !== sourceSlot) {
        return;
      }
      await hostApproveCoopTransfer(currentLobby, command.transferId);
      return;
    }
    case "cancel_coop_transfer": {
      const sourceSlot = lobbyRemotePeerSlots.get(sourcePeerId) ?? null;
      if (!currentLobby || currentLobby.hostSlot !== sourceSlot) {
        return;
      }
      await hostCancelCoopTransfer(currentLobby, command.transferId);
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
    case "coop_battle_command": {
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
      applyRemoteCoopBattleCommand(participant.sessionSlot, command.payload);
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
        const localParticipant = getLocalCoopParticipant(nextLobby);
        if (localParticipant?.selected) {
          shouldAutoResumeRemoteCoopOperations = false;
          await enterActiveCoopOperations(nextLobby);
        } else if (squadTransportStatus.role === "client") {
          shouldAutoResumeRemoteCoopOperations = true;
        }
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
      shouldAutoResumeRemoteCoopOperations = false;
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
            const nextLobby = setLobbyLocalSlot(currentLobby, lobbyClientAssignedSlot);
            commitLobbyState(nextLobby, undefined, "info", false);
            if (
              shouldAutoResumeRemoteCoopOperations
              && nextLobby.activity.kind === "coop_operations"
              && nextLobby.activity.coopOperations.status === "active"
              && getLocalCoopParticipant(nextLobby)?.selected
            ) {
              shouldAutoResumeRemoteCoopOperations = false;
              await enterActiveCoopOperations(nextLobby);
            }
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
        shouldAutoResumeRemoteCoopOperations = shouldAttemptRemoteCoopResume(getActiveLobbyState());
        try {
          await requestRemoteLobbyReconnectHandshake();
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
      shouldAutoResumeRemoteCoopOperations = shouldAttemptRemoteCoopResume(getActiveLobbyState());
      void requestRemoteLobbyReconnectHandshake().catch(() => {
        // Reclaiming the prior lobby slot can race host availability; the live event stream will retry on reconnect.
      });
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

function getChallengeableLobbySlots(lobby: LobbyState | null | undefined): NetworkPlayerSlot[] {
  if (!lobby || lobby.activity.kind !== "idle" || !lobby.localSlot) {
    return [];
  }
  return NETWORK_PLAYER_SLOTS.filter((slot) => slot !== lobby.localSlot && Boolean(lobby.members[slot]?.connected));
}

function renderSkirmishPlaylistEditor(lobby: LobbyState | null | undefined): string {
  const mapCatalog = getTacticalMapCatalog();
  const allMaps = [...mapCatalog.builtInMaps, ...mapCatalog.customMaps];
  const challengeableSlots = getChallengeableLobbySlots(lobby);
  const selectedTarget = selectedChallengeTargetSlot && challengeableSlots.includes(selectedChallengeTargetSlot)
    ? selectedChallengeTargetSlot
    : challengeableSlots[0] ?? null;
  const validation = getPlaylistValidation(skirmishPlaylistDraft);
  const canIssueChallenge = Boolean(
    lobby
    && selectedTarget
    && lobby.activity.kind === "idle"
    && validation.valid,
  );

  return `
    <div class="settings-category" style="margin-top: 1rem;">
      <div class="settings-category-header">SKIRMISH PLAYLIST EDITOR</div>
      <div class="config-note">
        <span class="note-icon">M</span>
        <span>Build a custom round list, pick an authored map for each round, and launch the playlist directly into the lobby challenge flow.</span>
      </div>
      <div class="comms-array-playlist-editor">
        ${skirmishPlaylistDraft.rounds.map((round, index) => {
          const normalizedRound = normalizeRoundForSelectedMap(round);
          const selectedMap = getTacticalMapById(normalizedRound.mapId ?? null);
          return `
            <div class="comms-array-playlist-round">
              <div class="comms-array-playlist-round__header">
                <strong>ROUND ${index + 1}</strong>
                ${skirmishPlaylistDraft.rounds.length > 1 ? `<button class="comms-array-btn" type="button" data-skirmish-remove-round="${round.id}">REMOVE</button>` : ""}
              </div>
              <div class="config-row">
                <label class="config-label">Objective:</label>
                <select class="config-select" data-skirmish-round-objective="${round.id}">
                  ${(["elimination", "control_relay", "breakthrough"] as const).map((objectiveType) => `
                    <option value="${objectiveType}" ${normalizedRound.objectiveType === objectiveType ? "selected" : ""}>${getSquadWinConditionLabel(objectiveType)}</option>
                  `).join("")}
                </select>
              </div>
              <div class="config-row">
                <label class="config-label">Map:</label>
                <select class="config-select" data-skirmish-round-map="${round.id}">
                  <option value="" ${normalizedRound.mapId ? "" : "selected"}>Legacy Generated Arena</option>
                  ${allMaps.map((map) => `<option value="${map.id}" ${normalizedRound.mapId === map.id ? "selected" : ""}>${escapeHtml(map.name)} // ${escapeHtml(map.theme.replace(/_/g, " "))}</option>`).join("")}
                </select>
              </div>
              <div class="config-note">
                <span class="note-icon">></span>
                <span>${selectedMap ? `${escapeHtml(selectedMap.metadata.author)} // ${escapeHtml(selectedMap.metadata.tags.join(", "))}` : `GRID ${normalizedRound.gridWidth}x${normalizedRound.gridHeight} // generated cover`}</span>
              </div>
              ${renderSkirmishObjectivePreview(normalizedRound)}
            </div>
          `;
        }).join("")}
      </div>
      <div class="comms-array-button-group" style="margin-top: 1rem;">
        <button class="comms-array-btn" type="button" id="addSkirmishRoundBtn">ADD ROUND</button>
        <select class="config-select" id="skirmishChallengeTargetSelect" ${challengeableSlots.length > 0 ? "" : "disabled"}>
          ${challengeableSlots.length > 0
            ? challengeableSlots.map((slot) => `<option value="${slot}" ${selectedTarget === slot ? "selected" : ""}>CHALLENGE ${slot} // ${escapeHtml(lobby?.members[slot]?.callsign ?? slot)}</option>`).join("")
            : `<option value="">No remote fighter linked</option>`}
        </select>
        <button class="comms-array-btn comms-array-btn--primary" type="button" id="issueSkirmishChallengeBtn" ${canIssueChallenge ? "" : "disabled"}>
          ISSUE SKIRMISH CHALLENGE
        </button>
      </div>
      ${validation.messages.length > 0 ? `
        <div class="config-note config-note--stacked">
          <span class="note-icon">!</span>
          ${validation.messages.map((message) => `<span>${escapeHtml(message)}</span>`).join("")}
        </div>
      ` : ""}
    </div>
  `;
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
  const coopSelectedParticipants = getSelectedCoopParticipants(lobby);
  const coopActiveOperators = getActiveCoopOperators(lobby);
  const coopStandbyParticipants = getStandbyCoopParticipants(lobby);
  const coopSelectionSummary = lobby?.activity.kind === "coop_operations"
    ? `${coopActiveOperators.length} active${coopStandbyParticipants.length > 0 ? ` // ${coopStandbyParticipants.length} standby` : ""}${coopSelectedParticipants.length > 0 ? ` // ${coopSelectedParticipants.map((participant) => participant.callsign).join(", ")}` : " // None selected"}`
    : "";
  const coopActivityStatus = lobby?.activity.kind === "coop_operations"
    ? lobby.activity.coopOperations.status === "active"
      ? "ACTIVE"
      : "STAGING"
    : "IDLE";
  const activeSharedCampaignSlot = getActiveSharedCampaignSlot();
  const activeSharedCampaignLabel = getActiveSharedCampaignLabel();
  const showSharedCampaignControls = Boolean(lobby && canLocalHostLobby(lobby));
  const selectedSharedCampaignInfo = getSharedCampaignInfo(selectedSharedCampaignSlot);
  const selectedSharedCampaignTimestamp = selectedSharedCampaignInfo?.timestamp
    ? formatSaveTimestamp(selectedSharedCampaignInfo.timestamp)
    : "Empty";
  const activeSharedCampaignLastSavedAt = getGameState().session.sharedCampaignLastSavedAt;
  const sharedCampaignSummary = activeSharedCampaignSlot
    ? `${activeSharedCampaignLabel ?? getSharedCampaignSlotName(activeSharedCampaignSlot)} // ${activeSharedCampaignSlot}${activeSharedCampaignLastSavedAt ? ` // ${formatSaveTimestamp(activeSharedCampaignLastSavedAt)}` : ""}`
    : "No shared campaign is staged for this lobby yet.";
  const canLaunchCoopOperations = Boolean(
    lobby
    && canLocalHostLobby(lobby)
    && lobby.activity.kind === "coop_operations"
    && activeSharedCampaignSlot
    && lobby.activity.coopOperations.selectedSlots.length > 0,
  );
  const canEnterCoopOperations = Boolean(
    lobby
    && lobby.activity.kind === "coop_operations"
    && lobby.activity.coopOperations.status === "active",
  ) && Boolean(
    lobby?.localSlot
    && lobby.activity.kind === "coop_operations"
    && lobby.activity.coopOperations.participants[lobby.localSlot]?.selected
    && !lobby.activity.coopOperations.participants[lobby.localSlot]?.standby
    && lobby.activity.coopOperations.participants[lobby.localSlot]?.sessionSlot,
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

          ${renderSkirmishPlaylistEditor(lobby)}

          ${lobby?.activity.kind === "coop_operations" ? `
            <div class="config-note">
              <span class="note-icon">O</span>
              <span>Co-Op Operations ${escapeHtml(coopActivityStatus.toLowerCase())} // ${escapeHtml(coopSelectionSummary)}${lobby.activity.coopOperations.sharedCampaignLabel ? ` // ${escapeHtml(lobby.activity.coopOperations.sharedCampaignLabel)}` : ""}</span>
            </div>
            ${coopStandbyParticipants.length > 0 ? `
              <div class="config-note">
                <span class="note-icon">!</span>
                <span>${escapeHtml(coopStandbyParticipants.map((participant) => participant.callsign).join(", "))} currently standing by outside the ${SESSION_PLAYER_SLOTS.length}-operator live runtime.</span>
              </div>
            ` : ""}
          ` : ""}

          ${showSharedCampaignControls ? `
            <div class="settings-category" style="margin-top: 1rem;">
              <div class="settings-category-header">SHARED CAMPAIGN</div>
              <div class="config-note">
                <span class="note-icon">S</span>
                <span>${escapeHtml(sharedCampaignSummary)}</span>
              </div>
              <div class="bindings-list">
                ${Object.values(SHARED_CAMPAIGN_SLOTS).map((slot) => {
                  const info = getSharedCampaignInfo(slot);
                  const isSelected = slot === selectedSharedCampaignSlot;
                  const isActive = slot === activeSharedCampaignSlot;
                  return `
                    <button class="binding-item ${isSelected ? "binding-item--selected" : ""}" type="button" data-shared-campaign-slot="${slot}">
                      <span class="binding-action">${escapeHtml(getSharedCampaignSlotName(slot))}${isActive ? " // ACTIVE" : ""}</span>
                      <span class="binding-keys">${info?.preview ? `${escapeHtml(info.preview.callsign)} // ${escapeHtml(info.preview.operationName)} // ${formatSaveTimestamp(info.timestamp)}` : "Empty slot"}</span>
                    </button>
                  `;
                }).join("")}
              </div>
              <div class="config-note">
                <span class="note-icon">></span>
                <span>${selectedSharedCampaignInfo?.preview
                  ? `${escapeHtml(selectedSharedCampaignInfo.preview.callsign)} // ${escapeHtml(selectedSharedCampaignInfo.preview.squadName)} // ${escapeHtml(selectedSharedCampaignInfo.preview.operationName)} // ${selectedSharedCampaignTimestamp}`
                  : `${escapeHtml(getSharedCampaignSlotName(selectedSharedCampaignSlot))} is empty. Prepare it from the current state or from a fresh title-screen seed.`}</span>
              </div>
              <div class="comms-array-button-group" style="margin-top: 0.75rem;">
                <button class="comms-array-btn" id="prepareSharedCampaignBtn">
                  PREPARE SELECTED SLOT
                </button>
                <button class="comms-array-btn" id="loadSharedCampaignBtn" ${selectedSharedCampaignInfo ? "" : "disabled"}>
                  LOAD SELECTED SLOT
                </button>
                <button class="comms-array-btn" id="saveSharedCampaignNowBtn" ${activeSharedCampaignSlot ? "" : "disabled"}>
                  SAVE SHARED CAMPAIGN NOW
                </button>
              </div>
            </div>
          ` : ""}

          ${renderCoopEconomyPanel(lobby)}
        </div>

        <div class="comms-array-button-group">
          ${!lobby && (!transportAvailable || transportRole === "idle") ? `
            <button class="comms-array-btn comms-array-btn--primary" id="hostSessionBtn">
              HOST LOBBY
            </button>
          ` : ""}
          ${lobby && canLocalHostLobby(lobby) && transportAvailable && transportRole === "idle" ? `
            <button class="comms-array-btn comms-array-btn--primary" id="resumeHostingBtn">
              RESUME HOSTING
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
          ${lobby && canLocalHostLobby(lobby) && lobby.activity.kind === "idle" ? `
            <button class="comms-array-btn" id="stageCoopOperationsBtn">
              STAGE CO-OP OPS
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
                const coopParticipant = lobby.activity.kind === "coop_operations"
                  ? lobby.activity.coopOperations.participants[slot]
                  : null;
                const opsStatus = coopParticipant?.selected
                  ? coopParticipant.standby
                    ? " // OPS STANDBY"
                    : ` // OPS ${coopParticipant.sessionSlot ?? "ACTIVE"}`
                  : "";
                return `
                  <div class="binding-item">
                    <span class="binding-action">${slot}${member ? ` // ${escapeHtml(member.callsign)}` : " // OPEN"}</span>
                    <span class="binding-keys">${member ? `${member.authorityRole.toUpperCase()} // ${member.presence.toUpperCase()}${opsStatus}` : "Awaiting link"}</span>
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
  ensureSharedCampaignAutosaveSync();
  ensureSharedCampaignBrowserHydrated(returnTo);
  syncSelectedSharedCampaignSlotFromState();
  activeSkirmishSurface = "comms";
  const backButtonText = returnTo === "operation"
    ? "ACTIVE OPERATION"
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
        renderActiveOperationSurface();
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

  const resumeHostingBtn = document.getElementById("resumeHostingBtn");
  if (resumeHostingBtn) {
    resumeHostingBtn.onclick = async () => {
      try {
        const currentLobby = getResolvedLobbyState();
        if (!currentLobby) {
          throw new Error("No lobby is available to resume.");
        }
        await resumeExistingMultiplayerLobbyHosting(currentLobby);
      } catch (error) {
        showNotification(
          error instanceof Error ? error.message : "Failed to resume the multiplayer lobby.",
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

  const stageCoopOperationsBtn = document.getElementById("stageCoopOperationsBtn");
  if (stageCoopOperationsBtn) {
    stageCoopOperationsBtn.addEventListener("click", async () => {
      const lobby = getResolvedLobbyState();
      if (!lobby || !canLocalHostLobby(lobby)) {
        return;
      }
      try {
        await hostLaunchLobbyCoopOperations(lobby);
        showNotification("Co-Op Operations staging opened in the lobby.", "success");
      } catch (error) {
        showNotification(
          error instanceof Error ? error.message : "Failed to stage Co-Op Operations.",
          "error",
        );
      }
    });
  }

  document.querySelectorAll<HTMLButtonElement>("[data-shared-campaign-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      const slot = button.dataset.sharedCampaignSlot ?? "";
      if (!isSharedCampaignSlot(slot)) {
        return;
      }
      selectedSharedCampaignSlot = slot;
      renderCommsArrayScreen(returnTo);
    });
  });

  const prepareSharedCampaignBtn = document.getElementById("prepareSharedCampaignBtn");
  if (prepareSharedCampaignBtn) {
    prepareSharedCampaignBtn.addEventListener("click", async () => {
      try {
        await prepareSelectedSharedCampaign(returnTo);
        showNotification(`${getSharedCampaignSlotName(selectedSharedCampaignSlot)} prepared for Co-Op Operations.`, "success");
      } catch (error) {
        showNotification(
          error instanceof Error ? error.message : "Failed to prepare the shared campaign slot.",
          "error",
        );
      }
    });
  }

  const loadSharedCampaignBtn = document.getElementById("loadSharedCampaignBtn");
  if (loadSharedCampaignBtn) {
    loadSharedCampaignBtn.addEventListener("click", async () => {
      try {
        await loadSelectedSharedCampaignIntoState(returnTo);
        showNotification(`${getSharedCampaignSlotName(selectedSharedCampaignSlot)} loaded into the active lobby.`, "success");
      } catch (error) {
        showNotification(
          error instanceof Error ? error.message : "Failed to load the shared campaign slot.",
          "error",
        );
      }
    });
  }

  const saveSharedCampaignNowBtn = document.getElementById("saveSharedCampaignNowBtn");
  if (saveSharedCampaignNowBtn) {
    saveSharedCampaignNowBtn.addEventListener("click", async () => {
      try {
        const result = await triggerSharedCampaignAutosave(getGameState());
        if (!result.success) {
          throw new Error(result.error ?? "Shared campaign save failed.");
        }
        const savedAt = Date.now();
        const activeSlot = getActiveSharedCampaignSlot();
        const activeLabel = getActiveSharedCampaignLabel();
        if (activeSlot) {
          stampSharedCampaignSaveTimestamp(
            activeSlot,
            activeLabel ?? getSharedCampaignSlotName(activeSlot),
            savedAt,
            {
              rerender: false,
              refreshBrowser: true,
              broadcast: true,
            },
          );
        }
        showNotification("Shared campaign saved.", "success");
      } catch (error) {
        showNotification(
          error instanceof Error ? error.message : "Failed to save the shared campaign.",
          "error",
        );
      }
    });
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

  const setCoopEconomySharedBtn = document.getElementById("setCoopEconomySharedBtn");
  if (setCoopEconomySharedBtn) {
    setCoopEconomySharedBtn.addEventListener("click", async () => {
      const lobby = getResolvedLobbyState();
      if (!lobby || !canLocalHostLobby(lobby) || lobby.activity.kind !== "coop_operations") {
        return;
      }
      try {
        await hostSetCoopEconomyPreset(lobby, "shared");
        showNotification("Co-Op economy set to shared.", "success");
      } catch (error) {
        showNotification(error instanceof Error ? error.message : "Failed to update the Co-Op economy preset.", "error");
      }
    });
  }

  const setCoopEconomyPartitionedBtn = document.getElementById("setCoopEconomyPartitionedBtn");
  if (setCoopEconomyPartitionedBtn) {
    setCoopEconomyPartitionedBtn.addEventListener("click", async () => {
      const lobby = getResolvedLobbyState();
      if (!lobby || !canLocalHostLobby(lobby) || lobby.activity.kind !== "coop_operations") {
        return;
      }
      try {
        await hostSetCoopEconomyPreset(lobby, "partitioned");
        showNotification("Co-Op economy set to partitioned.", "success");
      } catch (error) {
        showNotification(error instanceof Error ? error.message : "Failed to update the Co-Op economy preset.", "error");
      }
    });
  }

  const coopTransferTargetSelect = document.getElementById("coopTransferTargetSelect") as HTMLSelectElement | null;
  if (coopTransferTargetSelect) {
    coopTransferTargetSelect.addEventListener("change", () => {
      const nextValue = coopTransferTargetSelect.value;
      coopTransferDraft.targetPlayerId = SESSION_PLAYER_SLOTS.includes(nextValue as SessionPlayerSlot)
        ? nextValue as SessionPlayerSlot
        : null;
    });
  }

  const coopTransferKindSelect = document.getElementById("coopTransferKindSelect") as HTMLSelectElement | null;
  if (coopTransferKindSelect) {
    coopTransferKindSelect.addEventListener("change", () => {
      coopTransferDraft.kind = coopTransferKindSelect.value === "resource" ? "resource" : "wad";
      renderCommsArrayScreen(returnTo);
    });
  }

  const coopTransferResourceKeySelect = document.getElementById("coopTransferResourceKeySelect") as HTMLSelectElement | null;
  if (coopTransferResourceKeySelect) {
    coopTransferResourceKeySelect.addEventListener("change", () => {
      const nextValue = coopTransferResourceKeySelect.value;
      if (RESOURCE_KEYS.includes(nextValue as ResourceKey)) {
        coopTransferDraft.resourceKey = nextValue as ResourceKey;
      }
    });
  }

  const coopTransferAmountInput = document.getElementById("coopTransferAmountInput") as HTMLInputElement | null;
  if (coopTransferAmountInput) {
    coopTransferAmountInput.addEventListener("input", () => {
      const parsed = Number.parseInt(coopTransferAmountInput.value, 10);
      coopTransferDraft.amount = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    });
  }

  const submitCoopTransferBtn = document.getElementById("submitCoopTransferBtn");
  if (submitCoopTransferBtn) {
    submitCoopTransferBtn.addEventListener("click", async () => {
      const lobby = getResolvedLobbyState();
      const localParticipant = getLocalCoopParticipant(lobby);
      if (
        !lobby
        || lobby.activity.kind !== "coop_operations"
        || lobby.activity.coopOperations.status !== "active"
        || !localParticipant?.sessionSlot
        || !coopTransferDraft.targetPlayerId
        || coopTransferDraft.amount <= 0
      ) {
        return;
      }
      try {
        if (canLocalHostLobby(lobby)) {
          await hostRequestCoopTransfer(
            lobby,
            {
              fromPlayerId: localParticipant.sessionSlot,
              toPlayerId: coopTransferDraft.targetPlayerId,
              kind: coopTransferDraft.kind,
              wadAmount: coopTransferDraft.kind === "wad" ? coopTransferDraft.amount : undefined,
              resourceKey: coopTransferDraft.kind === "resource" ? coopTransferDraft.resourceKey : undefined,
              resourceAmount: coopTransferDraft.kind === "resource" ? coopTransferDraft.amount : undefined,
            },
            true,
          );
          showNotification("Transfer applied.", "success");
          return;
        }
        await sendLobbyCommandToHost({
          type: "request_coop_transfer",
          toPlayerId: coopTransferDraft.targetPlayerId,
          transferKind: coopTransferDraft.kind,
          wadAmount: coopTransferDraft.kind === "wad" ? coopTransferDraft.amount : undefined,
          resourceKey: coopTransferDraft.kind === "resource" ? coopTransferDraft.resourceKey : undefined,
          resourceAmount: coopTransferDraft.kind === "resource" ? coopTransferDraft.amount : undefined,
        });
        showNotification("Transfer request sent to the host.", "success");
      } catch (error) {
        showNotification(error instanceof Error ? error.message : "Failed to submit the transfer.", "error");
      }
    });
  }

  document.querySelectorAll<HTMLButtonElement>("[data-coop-transfer-approve]").forEach((button) => {
    button.addEventListener("click", async () => {
      const transferId = button.dataset.coopTransferApprove ?? "";
      const lobby = getResolvedLobbyState();
      if (!transferId || !lobby || !canLocalHostLobby(lobby) || lobby.activity.kind !== "coop_operations") {
        return;
      }
      try {
        await hostApproveCoopTransfer(lobby, transferId);
        showNotification("Transfer approved.", "success");
      } catch (error) {
        showNotification(error instanceof Error ? error.message : "Failed to approve the transfer.", "error");
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-coop-transfer-cancel]").forEach((button) => {
    button.addEventListener("click", async () => {
      const transferId = button.dataset.coopTransferCancel ?? "";
      const lobby = getResolvedLobbyState();
      if (!transferId || !lobby || !canLocalHostLobby(lobby) || lobby.activity.kind !== "coop_operations") {
        return;
      }
      try {
        await hostCancelCoopTransfer(lobby, transferId);
        showNotification("Transfer cancelled.", "info");
      } catch (error) {
        showNotification(error instanceof Error ? error.message : "Failed to cancel the transfer.", "error");
      }
    });
  });

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

  const addSkirmishRoundBtn = document.getElementById("addSkirmishRoundBtn");
  if (addSkirmishRoundBtn) {
    addSkirmishRoundBtn.addEventListener("click", () => {
      const lastRound = skirmishPlaylistDraft.rounds[skirmishPlaylistDraft.rounds.length - 1];
      const nextRound = normalizeRoundForSelectedMap({
        id: `round_${Date.now().toString(36)}`,
        gridWidth: lastRound?.gridWidth ?? 8,
        gridHeight: lastRound?.gridHeight ?? 5,
        objectiveType: lastRound?.objectiveType ?? "elimination",
        mapId: lastRound?.mapId ?? null,
      });
      skirmishPlaylistDraft = {
        rounds: [...skirmishPlaylistDraft.rounds, nextRound],
      };
      renderCommsArrayScreen(returnTo);
    });
  }

  document.querySelectorAll<HTMLButtonElement>("[data-skirmish-remove-round]").forEach((button) => {
    button.addEventListener("click", () => {
      const roundId = button.dataset.skirmishRemoveRound;
      if (!roundId) {
        return;
      }
      skirmishPlaylistDraft = {
        rounds: skirmishPlaylistDraft.rounds.filter((round) => round.id !== roundId),
      };
      if (skirmishPlaylistDraft.rounds.length <= 0) {
        skirmishPlaylistDraft = getDefaultLobbyPlaylist();
      }
      renderCommsArrayScreen(returnTo);
    });
  });

  document.querySelectorAll<HTMLSelectElement>("[data-skirmish-round-objective]").forEach((select) => {
    select.addEventListener("change", () => {
      const roundId = select.dataset.skirmishRoundObjective;
      if (!roundId) {
        return;
      }
      skirmishPlaylistDraft = {
        rounds: skirmishPlaylistDraft.rounds.map((round) => {
          if (round.id !== roundId) {
            return round;
          }
          return {
            ...round,
            objectiveType: select.value as SquadWinCondition,
          };
        }),
      };
      renderCommsArrayScreen(returnTo);
    });
  });

  document.querySelectorAll<HTMLSelectElement>("[data-skirmish-round-map]").forEach((select) => {
    select.addEventListener("change", () => {
      const roundId = select.dataset.skirmishRoundMap;
      if (!roundId) {
        return;
      }
      skirmishPlaylistDraft = {
        rounds: skirmishPlaylistDraft.rounds.map((round) => {
          if (round.id !== roundId) {
            return round;
          }
          return normalizeRoundForSelectedMap({
            ...round,
            mapId: select.value || null,
          });
        }),
      };
      renderCommsArrayScreen(returnTo);
    });
  });

  const skirmishChallengeTargetSelect = document.getElementById("skirmishChallengeTargetSelect") as HTMLSelectElement | null;
  if (skirmishChallengeTargetSelect) {
    skirmishChallengeTargetSelect.addEventListener("change", () => {
      selectedChallengeTargetSlot = (skirmishChallengeTargetSelect.value || null) as NetworkPlayerSlot | null;
    });
  }

  const issueSkirmishChallengeBtn = document.getElementById("issueSkirmishChallengeBtn");
  if (issueSkirmishChallengeBtn) {
    issueSkirmishChallengeBtn.addEventListener("click", async () => {
      const validation = getPlaylistValidation(skirmishPlaylistDraft);
      if (!validation.valid) {
        showNotification(validation.messages[0] ?? "Skirmish playlist is not valid.", "error");
        return;
      }
      const targetSlot = (skirmishChallengeTargetSelect?.value || selectedChallengeTargetSlot) as NetworkPlayerSlot | "";
      if (!targetSlot) {
        showNotification("No remote fighter is selected for the challenge.", "error");
        return;
      }
      await requestLobbySkirmishChallenge(targetSlot as NetworkPlayerSlot, clonePlaylist(skirmishPlaylistDraft));
      renderCommsArrayScreen(returnTo);
    });
  }
  
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

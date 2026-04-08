import {
  LOCAL_PLAYER_IDS,
  NETWORK_PLAYER_SLOTS,
  SESSION_PLAYER_SLOTS,
  type AuthorityRole,
  type CampaignState,
  type EconomyPreset,
  type GameState,
  type LobbyState,
  type NetworkPlayerSlot,
  type PlayerInputSource,
  type PlayerPresence,
  type PlayerSlot,
  type PendingTheaterBattleConfirmationState,
  type ResourcePool,
  type ResourceWallet,
  type ReconnectStagingState,
  type SessionPlayerSlot,
  type SessionPlayerState,
  type SessionState,
  type TheaterAssignment,
  type TheaterRuntimeContext,
  type UnitOwnership,
} from "./types";
import { createEmptyResourceWallet } from "./resources";

const EMPTY_RESOURCE_WALLET: ResourceWallet = createEmptyResourceWallet();

const LOCAL_COOP_RESTRICTED_FIELD_ACTIONS = new Set<string>([
  "shop",
  "ops_terminal",
  "tavern",
  "port",
  "dispatch",
  "quarters",
  "black_market",
  "stable",
  "schema",
]);

function isLocalPlayerSlot(slot: SessionPlayerSlot): slot is PlayerSlot {
  return slot === "P1" || slot === "P2";
}

function cloneResourceWallet(wallet?: Partial<ResourceWallet> | null): ResourceWallet {
  return createEmptyResourceWallet(wallet);
}

function createResourcePool(wad = 0, resources?: Partial<ResourceWallet> | null): ResourcePool {
  return {
    wad,
    resources: cloneResourceWallet(resources),
  };
}

function createCampaignStateSeed(operationId: string | null = null): CampaignState {
  return {
    sharedWorldState: {
      discoveredTheaterIds: [],
      unlockedFloorIds: [],
      atlasProgressToken: operationId,
      schemaUnlockIds: [],
    },
  };
}

function clonePendingTheaterBattleConfirmation(
  pending: PendingTheaterBattleConfirmationState | null | undefined,
): PendingTheaterBattleConfirmationState | null {
  return pending
    ? {
        roomId: pending.roomId,
        previousRoomId: pending.previousRoomId,
        roomLabel: pending.roomLabel,
        squadId: pending.squadId ?? null,
      }
    : null;
}

function cloneTheaterRuntimeContext(
  context: TheaterRuntimeContext | null | undefined,
): TheaterRuntimeContext | null {
  return context
    ? {
        theaterId: context.theaterId,
        operationId: context.operationId ?? null,
        snapshot: context.snapshot,
        phase: context.phase ?? null,
        battleSnapshot: context.battleSnapshot ?? null,
        pendingTheaterBattleConfirmation: clonePendingTheaterBattleConfirmation(
          context.pendingTheaterBattleConfirmation,
        ),
        updatedAt: context.updatedAt ?? Date.now(),
      }
    : null;
}

function cloneTheaterRuntimeContexts(
  contexts?: Record<string, TheaterRuntimeContext> | null,
): Record<string, TheaterRuntimeContext> {
  if (!contexts) {
    return {};
  }
  return Object.entries(contexts).reduce((acc, [theaterId, context]) => {
    const cloned = cloneTheaterRuntimeContext(context);
    if (cloned) {
      acc[theaterId] = cloned;
    }
    return acc;
  }, {} as Record<string, TheaterRuntimeContext>);
}

function getDefaultPlayerPresence(active: boolean): PlayerPresence {
  return active ? "local" : "inactive";
}

function getDefaultPlayerAuthorityRole(active: boolean): AuthorityRole {
  return active ? "local" : "local";
}

function getDefaultPlayerStagingState(active: boolean): ReconnectStagingState {
  return active ? "haven" : "disconnected";
}

function createSessionPlayerState(
  slot: SessionPlayerSlot,
  inputSource: PlayerInputSource,
  active: boolean,
  controlledUnitIds: string[] = [],
): SessionPlayerState {
  return {
    slot,
    presence: getDefaultPlayerPresence(active),
    authorityRole: getDefaultPlayerAuthorityRole(active),
    connected: active,
    inputSource,
    controlledUnitIds: [...controlledUnitIds],
    stagingState: getDefaultPlayerStagingState(active),
    currentTheaterId: null,
    assignedSquadId: null,
    lastSafeRoomId: null,
    lastSafeMapId: active ? "base_camp" : null,
  };
}

function createTheaterAssignment(slot: SessionPlayerSlot): TheaterAssignment {
  return {
    playerId: slot,
    theaterId: null,
    squadId: null,
    roomId: null,
    stagingState: "haven",
  };
}

function getCoopParticipantNetworkSlot(
  lobby: LobbyState,
  sessionSlot: SessionPlayerSlot,
): NetworkPlayerSlot | null {
  const coopOperations = lobby.activity.kind === "coop_operations" ? lobby.activity.coopOperations : null;
  if (!coopOperations) {
    return null;
  }
  const match = NETWORK_PLAYER_SLOTS.find((slot) =>
    coopOperations.participants[slot]?.selected
    && coopOperations.participants[slot]?.sessionSlot === sessionSlot,
  );
  return match ?? null;
}

export function createDefaultSessionState(
  seed?: Partial<Pick<GameState, "wad" | "resources" | "operation" | "players">>,
): SessionState {
  const p1 = seed?.players?.P1;
  const p2 = seed?.players?.P2;
  const sharedPool = createResourcePool(seed?.wad ?? 0, seed?.resources ?? EMPTY_RESOURCE_WALLET);
  const perPlayerDefault = () => createResourcePool(0, EMPTY_RESOURCE_WALLET);
  const mode = p2?.active ? "local_coop" : "singleplayer";

  return {
    mode,
    authorityRole: "local",
    ownerSlot: "P1",
    maxPlayers: 2,
    resourceLedger: {
      preset: "shared",
      shared: sharedPool,
      perPlayer: SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
        acc[slot] = slot === "P1" ? perPlayerDefault() : createResourcePool(0, EMPTY_RESOURCE_WALLET);
        return acc;
      }, {} as SessionState["resourceLedger"]["perPlayer"]),
    },
    pendingTransfers: [],
    players: SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
      if (slot === "P1") {
        acc[slot] = createSessionPlayerState(
          slot,
          p1?.inputSource ?? "keyboard1",
          p1?.active ?? true,
          p1?.controlledUnitIds ?? [],
        );
      } else if (slot === "P2") {
        acc[slot] = createSessionPlayerState(
          slot,
          p2?.inputSource ?? "none",
          p2?.active ?? false,
          p2?.controlledUnitIds ?? [],
        );
      } else {
        acc[slot] = createSessionPlayerState(slot, "remote", false, []);
      }
      return acc;
    }, {} as SessionState["players"]),
    theaterAssignments: SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
      acc[slot] = createTheaterAssignment(slot);
      return acc;
    }, {} as SessionState["theaterAssignments"]),
    activeTheaterContexts: {},
    pendingTheaterBattleConfirmation: null,
    activeBattleId: null,
    campaign: createCampaignStateSeed(seed?.operation?.id ?? null),
  };
}

function normalizeMode(currentMode: SessionState["mode"], isP2Active: boolean): SessionState["mode"] {
  if (currentMode === "squad" || currentMode === "coop_operations") {
    return currentMode;
  }
  return isP2Active ? "local_coop" : "singleplayer";
}

function normalizePresence(
  existingPresence: PlayerPresence,
  active: boolean,
): PlayerPresence {
  if (!active) {
    return "inactive";
  }
  if (existingPresence === "remote" || existingPresence === "disconnected") {
    return existingPresence;
  }
  return "local";
}

function normalizeStagingState(
  existingState: ReconnectStagingState,
  active: boolean,
  phase: GameState["phase"],
  hasControlledBattleUnit: boolean,
): ReconnectStagingState {
  if (!active) {
    return "disconnected";
  }
  if (hasControlledBattleUnit || phase === "battle") {
    return "battle";
  }
  if (phase === "field" || phase === "shell") {
    return "haven";
  }
  if (phase === "operation" || phase === "atlas") {
    return existingState === "theater" ? existingState : "staging";
  }
  return existingState === "disconnected" ? "haven" : existingState;
}

function normalizeSessionPlayer(
  state: GameState,
  slot: SessionPlayerSlot,
  existing: SessionPlayerState | undefined,
): SessionPlayerState {
  const player = slot === "P1" || slot === "P2" ? state.players[slot] : null;
  const controlledBattleUnits = Object.values(state.currentBattle?.units ?? {}).filter(
    (unit) => !unit.isEnemy && (unit.controller ?? "P1") === slot,
  );
  const fallback = createSessionPlayerState(
    slot,
    player?.inputSource ?? "remote",
    player?.active ?? false,
    player?.controlledUnitIds ?? [],
  );
  const previous = existing ?? fallback;
  if (state.session?.mode === "coop_operations") {
    const isLocalParticipant = previous.presence === "local";
    const nextStagingState = previous.connected
      ? normalizeStagingState(previous.stagingState, true, state.phase, controlledBattleUnits.length > 0)
      : previous.stagingState === "rejoining"
        ? "rejoining"
        : "disconnected";
    return {
      ...previous,
      slot,
      inputSource: isLocalParticipant ? state.players.P1.inputSource : "remote",
      controlledUnitIds: isLocalParticipant ? [...state.players.P1.controlledUnitIds] : [...previous.controlledUnitIds],
      stagingState: nextStagingState,
      lastSafeMapId: isLocalParticipant && state.players.P1.avatar
        ? previous.lastSafeMapId ?? "base_camp"
        : previous.lastSafeMapId,
    };
  }
  if (!player) {
    return {
      ...previous,
      slot,
      connected: previous.connected && previous.presence !== "inactive",
      presence: previous.presence ?? "inactive",
      stagingState: previous.connected ? previous.stagingState : "disconnected",
    };
  }

  return {
    ...previous,
    slot,
    presence: normalizePresence(previous.presence, player.active),
    authorityRole: player.active ? previous.authorityRole : "local",
    connected: player.active,
    inputSource: player.inputSource,
    controlledUnitIds: [...player.controlledUnitIds],
    stagingState: normalizeStagingState(
      previous.stagingState,
      player.active,
      state.phase,
      controlledBattleUnits.length > 0,
    ),
    lastSafeMapId: player.avatar ? (previous.lastSafeMapId ?? "base_camp") : previous.lastSafeMapId,
  };
}

function getPlayerPreferredTheaterSquadId(state: GameState, slot: PlayerSlot): string | null {
  const theater = state.operation?.theater;
  if (!theater || theater.squads.length <= 0) {
    return null;
  }

  const controlledUnitIds = new Set(state.players[slot].controlledUnitIds);
  const rankedSquads = theater.squads
    .map((squad) => ({
      squadId: squad.squadId,
      matchCount: squad.unitIds.filter((unitId) => controlledUnitIds.has(unitId)).length,
      selected: squad.squadId === theater.selectedSquadId,
    }))
    .sort((left, right) => {
      if (right.matchCount !== left.matchCount) {
        return right.matchCount - left.matchCount;
      }
      if (left.selected !== right.selected) {
        return left.selected ? -1 : 1;
      }
      return left.squadId.localeCompare(right.squadId);
    });

  const bestMatch = rankedSquads[0] ?? null;
  if (bestMatch && bestMatch.matchCount > 0) {
    return bestMatch.squadId;
  }

  return slot === "P1"
    ? theater.selectedSquadId ?? theater.squads[0]?.squadId ?? null
    : theater.squads.length === 1
      ? theater.squads[0]?.squadId ?? null
      : null;
}

function normalizeTheaterAssignment(
  state: GameState,
  slot: SessionPlayerSlot,
  existing: TheaterAssignment | undefined,
): TheaterAssignment {
  const previous = existing ?? createTheaterAssignment(slot);
  const activeTheater = state.operation?.theater;
  if (state.session?.mode === "coop_operations") {
    const sessionPlayer = state.session.players?.[slot] ?? null;
    if (!activeTheater) {
      return {
        ...previous,
        playerId: slot,
        theaterId: null,
        roomId: null,
        stagingState: sessionPlayer?.connected
          ? previous.stagingState === "battle"
            ? "staging"
            : previous.stagingState
          : previous.stagingState === "rejoining"
            ? "rejoining"
            : "disconnected",
      };
    }

    const squadIdIsValid = previous.squadId
      ? activeTheater.squads.some((squad) => squad.squadId === previous.squadId)
      : false;
    const fallbackSquadId = squadIdIsValid
      ? previous.squadId
      : activeTheater.squads.length === 1
        ? activeTheater.squads[0]?.squadId ?? null
        : previous.squadId;
    const assignedSquad = fallbackSquadId
      ? activeTheater.squads.find((squad) => squad.squadId === fallbackSquadId) ?? null
      : null;

    return {
      ...previous,
      playerId: slot,
      theaterId: activeTheater.definition.id,
      squadId: assignedSquad?.squadId ?? previous.squadId ?? null,
      roomId: assignedSquad?.currentRoomId ?? previous.roomId ?? activeTheater.currentRoomId,
      stagingState: !sessionPlayer?.connected
        ? previous.stagingState === "rejoining"
          ? "rejoining"
          : "disconnected"
        : state.phase === "battle"
          ? "battle"
          : "theater",
    };
  }
  const isLocalSlot = isLocalPlayerSlot(slot);
  const isActiveLocalPlayer = isLocalSlot && state.players[slot].active;
  if (!activeTheater) {
    return {
      ...previous,
      playerId: slot,
      theaterId: null,
      squadId: null,
      roomId: null,
      stagingState: isActiveLocalPlayer ? "haven" : "disconnected",
    };
  }
  if (isLocalSlot && !state.players[slot].active) {
    return {
      ...previous,
      playerId: slot,
      theaterId: null,
      squadId: null,
      roomId: null,
      stagingState: "disconnected",
    };
  }

  const squadIdIsValid = previous.squadId
    ? activeTheater.squads.some((squad) => squad.squadId === previous.squadId)
    : false;
  const preferredSquadId =
    squadIdIsValid
      ? previous.squadId
      : isLocalPlayerSlot(slot) && state.players[slot].active
        ? getPlayerPreferredTheaterSquadId(state, slot)
        : previous.squadId;
  const assignedSquad = preferredSquadId
    ? activeTheater.squads.find((squad) => squad.squadId === preferredSquadId) ?? null
    : null;

  return {
    ...previous,
    playerId: slot,
    theaterId: activeTheater.definition.id,
    squadId: isActiveLocalPlayer ? assignedSquad?.squadId ?? null : previous.squadId,
    roomId: isActiveLocalPlayer ? assignedSquad?.currentRoomId ?? null : previous.roomId,
    stagingState: state.phase === "battle"
      ? "battle"
      : isActiveLocalPlayer
        ? "theater"
        : state.session?.players?.[slot]?.connected
          ? previous.stagingState
          : "disconnected",
  };
}

export function withNormalizedSessionState(state: GameState): GameState {
  const currentSession = state.session ?? createDefaultSessionState(state);
  const sharedPool = createResourcePool(state.wad, state.resources);
  const nextAssignments = SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
    acc[slot] = normalizeTheaterAssignment(state, slot, currentSession.theaterAssignments?.[slot]);
    return acc;
  }, {} as SessionState["theaterAssignments"]);
  const nextPlayers = SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
    const normalizedPlayer = normalizeSessionPlayer(state, slot, currentSession.players?.[slot]);
    const assignment = nextAssignments[slot];
    acc[slot] = {
      ...normalizedPlayer,
      currentTheaterId: assignment.theaterId,
      assignedSquadId: assignment.squadId,
      lastSafeRoomId: assignment.roomId ?? normalizedPlayer.lastSafeRoomId,
    };
    return acc;
  }, {} as SessionState["players"]);
  const nextActiveTheaterContexts = cloneTheaterRuntimeContexts(currentSession.activeTheaterContexts);
  const activeTheater = state.operation?.theater;
  const activeBattleTheaterId = state.currentBattle?.theaterMeta?.theaterId ?? null;
  const activeBattleSnapshot = state.currentBattle ? JSON.stringify(state.currentBattle) : null;
  if (currentSession.mode === "coop_operations" && activeTheater) {
    nextActiveTheaterContexts[activeTheater.definition.id] = {
      theaterId: activeTheater.definition.id,
      operationId: state.operation?.id ?? null,
      snapshot: JSON.stringify(activeTheater),
      phase: state.phase,
      battleSnapshot: activeBattleTheaterId === activeTheater.definition.id ? activeBattleSnapshot : null,
      pendingTheaterBattleConfirmation: clonePendingTheaterBattleConfirmation(
        currentSession.pendingTheaterBattleConfirmation,
      ),
      updatedAt: Date.now(),
    };
  } else if (
    currentSession.mode === "coop_operations"
    && activeBattleTheaterId
    && activeBattleSnapshot
    && nextActiveTheaterContexts[activeBattleTheaterId]
  ) {
    nextActiveTheaterContexts[activeBattleTheaterId] = {
      ...nextActiveTheaterContexts[activeBattleTheaterId],
      battleSnapshot: activeBattleSnapshot,
      phase: state.phase,
      updatedAt: Date.now(),
    };
  }
  const nextSession: SessionState = {
    ...currentSession,
    mode: normalizeMode(currentSession.mode, state.players.P2.active),
    authorityRole: currentSession.authorityRole ?? "local",
    ownerSlot: currentSession.ownerSlot ?? "P1",
    maxPlayers: currentSession.maxPlayers ?? 2,
    activeBattleId: state.currentBattle?.id ?? null,
    resourceLedger: {
      ...currentSession.resourceLedger,
      preset: currentSession.resourceLedger?.preset ?? "shared",
      shared: sharedPool,
      perPlayer: SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
        acc[slot] = currentSession.resourceLedger?.perPlayer?.[slot] ?? createResourcePool(0, EMPTY_RESOURCE_WALLET);
        return acc;
      }, {} as SessionState["resourceLedger"]["perPlayer"]),
    },
    players: nextPlayers,
    theaterAssignments: nextAssignments,
    activeTheaterContexts: nextActiveTheaterContexts,
    pendingTheaterBattleConfirmation: clonePendingTheaterBattleConfirmation(
      currentSession.pendingTheaterBattleConfirmation,
    ),
    campaign: currentSession.campaign ?? createCampaignStateSeed(state.operation?.id ?? null),
  };

  const sessionChanged =
    !state.session
    || JSON.stringify(state.session) !== JSON.stringify(nextSession);

  if (!sessionChanged) {
    return state;
  }

  return {
    ...state,
    session: nextSession,
  };
}

export function getPlayerControllerLabel(playerId: SessionPlayerSlot): string {
  return `PLAYER ${playerId.replace("P", "")}`;
}

export function getUnitOwnerLabel(controller: UnitOwnership | undefined): string {
  return getPlayerControllerLabel(controller ?? "P1");
}

export function getPlayerColor(state: GameState, playerId: PlayerSlot): string {
  return state.players[playerId]?.color ?? (playerId === "P1" ? "#ff8a00" : "#6849c2");
}

export function isLocalCoopActive(state: GameState): boolean {
  return state.session.mode === "local_coop" || state.players.P2.active;
}

export function canPlayerUseFieldAction(
  state: GameState,
  playerId: PlayerSlot,
  action: string,
): boolean {
  if (playerId === "P1") {
    return true;
  }
  if (!isLocalCoopActive(state)) {
    return true;
  }
  return !LOCAL_COOP_RESTRICTED_FIELD_ACTIONS.has(action);
}

export function getFieldActionRestrictionMessage(actionLabel: string): string {
  return `Player 1 must authorize ${actionLabel}.`;
}

export function setPlayerJoinState(
  state: GameState,
  playerId: PlayerSlot,
  active: boolean,
): GameState {
  if (playerId !== "P2") {
    return state;
  }

  const nextMode: SessionState["mode"] = active ? "local_coop" : "singleplayer";
  return withNormalizedSessionState({
    ...state,
    session: {
      ...(state.session ?? createDefaultSessionState(state)),
      mode: nextMode,
      players: {
        ...(state.session?.players ?? createDefaultSessionState(state).players),
        P2: {
          ...(state.session?.players?.P2 ?? createSessionPlayerState("P2", state.players.P2.inputSource, active)),
          presence: active ? "local" : "inactive",
          connected: active,
          stagingState: active ? "haven" : "disconnected",
          inputSource: state.players.P2.inputSource,
          controlledUnitIds: [...state.players.P2.controlledUnitIds],
        },
      },
    },
  });
}

export function getTheaterAssignedPlayerSlots(state: GameState, squadId: string | null): PlayerSlot[] {
  if (!squadId) {
    return [];
  }
  return LOCAL_PLAYER_IDS.filter((slot) =>
    state.players[slot].active && state.session.theaterAssignments?.[slot]?.squadId === squadId,
  );
}

export function assignLocalPlayerToTheaterSquad(
  state: GameState,
  playerId: PlayerSlot,
  squadId: string | null,
): GameState {
  if (!state.players[playerId].active) {
    return state;
  }

  const activeTheater = state.operation?.theater;
  if (!activeTheater) {
    return state;
  }

  const assignedSquad = squadId
    ? activeTheater.squads.find((squad) => squad.squadId === squadId) ?? null
    : null;
  if (squadId && !assignedSquad) {
    return state;
  }

  const currentSession = state.session ?? createDefaultSessionState(state);
  const currentAssignment = currentSession.theaterAssignments?.[playerId] ?? createTheaterAssignment(playerId);

  return withNormalizedSessionState({
    ...state,
    session: {
      ...currentSession,
      theaterAssignments: {
        ...currentSession.theaterAssignments,
        [playerId]: {
          ...currentAssignment,
          playerId,
          theaterId: activeTheater.definition.id,
          squadId: assignedSquad?.squadId ?? null,
          roomId: assignedSquad?.currentRoomId ?? null,
          stagingState: assignedSquad ? "theater" : "staging",
        },
      },
    },
  });
}

export function launchCoopOperationsSessionFromLobby(
  state: GameState,
  lobby: LobbyState,
): GameState {
  if (lobby.activity.kind !== "coop_operations") {
    return state;
  }

  const activity = lobby.activity.coopOperations;
  const currentSession = state.session ?? createDefaultSessionState(state);
  const localNetworkSlot = lobby.localSlot;
  const nextPlayers = SESSION_PLAYER_SLOTS.reduce((acc, sessionSlot) => {
    const networkSlot = getCoopParticipantNetworkSlot(lobby, sessionSlot);
    const participant = networkSlot ? activity.participants[networkSlot] : null;
    const isLocalParticipant = Boolean(networkSlot && networkSlot === localNetworkSlot);
    const previous = currentSession.players?.[sessionSlot] ?? createSessionPlayerState(sessionSlot, "remote", false, []);

    acc[sessionSlot] = participant
      ? {
          ...previous,
          slot: sessionSlot,
          presence: isLocalParticipant ? "local" : participant.connected ? "remote" : "disconnected",
          authorityRole: participant.authorityRole,
          connected: participant.connected,
          inputSource: isLocalParticipant ? state.players.P1.inputSource : "remote",
          controlledUnitIds: isLocalParticipant ? [...state.players.P1.controlledUnitIds] : [],
          stagingState: participant.connected ? participant.stagingState : "rejoining",
          currentTheaterId: participant.currentTheaterId,
          assignedSquadId: participant.assignedSquadId,
          lastSafeRoomId: participant.currentRoomId,
          lastSafeMapId: participant.lastSafeMapId ?? "base_camp",
        }
      : {
          ...previous,
          slot: sessionSlot,
          presence: "inactive",
          authorityRole: "client",
          connected: false,
          inputSource: "remote",
          controlledUnitIds: [],
          stagingState: "disconnected",
          currentTheaterId: null,
          assignedSquadId: null,
          lastSafeRoomId: null,
          lastSafeMapId: null,
        };
    return acc;
  }, {} as SessionState["players"]);

  const nextAssignments = SESSION_PLAYER_SLOTS.reduce((acc, sessionSlot) => {
    const participant = (() => {
      const networkSlot = getCoopParticipantNetworkSlot(lobby, sessionSlot);
      return networkSlot ? activity.participants[networkSlot] : null;
    })();
    acc[sessionSlot] = {
      playerId: sessionSlot,
      theaterId: participant?.currentTheaterId ?? null,
      squadId: participant?.assignedSquadId ?? null,
      roomId: participant?.currentRoomId ?? null,
      stagingState: participant?.connected ? participant.stagingState : participant ? "rejoining" : "disconnected",
    };
    return acc;
  }, {} as SessionState["theaterAssignments"]);

  return withNormalizedSessionState({
    ...state,
    currentBattle: state.currentBattle?.modeContext?.kind === "squad" ? null : state.currentBattle,
    phase: "field",
    session: {
      ...currentSession,
      mode: "coop_operations",
      authorityRole: localNetworkSlot === lobby.hostSlot ? "host" : "client",
      ownerSlot: "P1",
      maxPlayers: Math.max(2, Math.min(SESSION_PLAYER_SLOTS.length, activity.selectedSlots.length || 1)),
      activeBattleId: null,
      pendingTheaterBattleConfirmation: clonePendingTheaterBattleConfirmation(
        localNetworkSlot
          ? activity.participants[localNetworkSlot]?.pendingTheaterBattleConfirmation
            ?? activity.pendingTheaterBattleConfirmation
          : activity.pendingTheaterBattleConfirmation,
      ),
      resourceLedger: {
        ...currentSession.resourceLedger,
        preset: activity.economyPreset,
      },
      players: nextPlayers,
      theaterAssignments: nextAssignments,
      activeTheaterContexts: cloneTheaterRuntimeContexts(activity.theaterContexts),
      campaign: currentSession.campaign ?? createCampaignStateSeed(state.operation?.id ?? null),
    },
  });
}

export function clearCoopOperationsSession(state: GameState): GameState {
  if (state.session.mode !== "coop_operations") {
    return state;
  }
  const resetSession = createDefaultSessionState(state);
  return withNormalizedSessionState({
    ...state,
    operation: null,
    currentBattle: null,
    phase: "field",
    session: {
      ...resetSession,
      resourceLedger: {
        ...resetSession.resourceLedger,
        shared: createResourcePool(state.wad, state.resources),
      },
      pendingTheaterBattleConfirmation: null,
      activeTheaterContexts: {},
    },
  });
}

export function getSharedEconomyPreset(state: GameState): EconomyPreset {
  return state.session.resourceLedger.preset;
}

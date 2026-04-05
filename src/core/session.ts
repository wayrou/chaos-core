import {
  SESSION_PLAYER_SLOTS,
  type AuthorityRole,
  type CampaignState,
  type EconomyPreset,
  type GameState,
  type PlayerInputSource,
  type PlayerPresence,
  type PlayerSlot,
  type ResourcePool,
  type ResourceWallet,
  type ReconnectStagingState,
  type SessionPlayerSlot,
  type SessionPlayerState,
  type SessionState,
  type TheaterAssignment,
  type UnitOwnership,
} from "./types";

const EMPTY_RESOURCE_WALLET: ResourceWallet = {
  metalScrap: 0,
  wood: 0,
  chaosShards: 0,
  steamComponents: 0,
};

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

function cloneResourceWallet(wallet?: Partial<ResourceWallet> | null): ResourceWallet {
  return {
    metalScrap: wallet?.metalScrap ?? 0,
    wood: wallet?.wood ?? 0,
    chaosShards: wallet?.chaosShards ?? 0,
    steamComponents: wallet?.steamComponents ?? 0,
  };
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

function normalizeTheaterAssignment(
  state: GameState,
  slot: SessionPlayerSlot,
  existing: TheaterAssignment | undefined,
): TheaterAssignment {
  const previous = existing ?? createTheaterAssignment(slot);
  const activeTheater = state.operation?.theater;
  const selectedSquadId = activeTheater?.selectedSquadId ?? null;
  const selectedRoomId = activeTheater?.selectedRoomId ?? activeTheater?.currentRoomId ?? null;
  const ownsSelectedSquad = Boolean(
    slot === "P1" || state.players.P2.active
      ? selectedSquadId
      : null,
  );

  return {
    ...previous,
    playerId: slot,
    theaterId: activeTheater?.definition.id ?? previous.theaterId ?? null,
    squadId: ownsSelectedSquad ? selectedSquadId : previous.squadId,
    roomId: ownsSelectedSquad ? selectedRoomId : previous.roomId,
    stagingState: state.phase === "battle"
      ? "battle"
      : activeTheater
        ? "theater"
        : (slot === "P1" || slot === "P2") && state.players[slot].active
          ? "haven"
          : "disconnected",
  };
}

export function withNormalizedSessionState(state: GameState): GameState {
  const currentSession = state.session ?? createDefaultSessionState(state);
  const sharedPool = createResourcePool(state.wad, state.resources);
  const nextPlayers = SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
    acc[slot] = normalizeSessionPlayer(state, slot, currentSession.players?.[slot]);
    return acc;
  }, {} as SessionState["players"]);
  const nextAssignments = SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
    acc[slot] = normalizeTheaterAssignment(state, slot, currentSession.theaterAssignments?.[slot]);
    return acc;
  }, {} as SessionState["theaterAssignments"]);
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

export function getSharedEconomyPreset(state: GameState): EconomyPreset {
  return state.session.resourceLedger.preset;
}

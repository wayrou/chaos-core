import {
  SESSION_PLAYER_SLOTS,
  type SkirmishObjectiveType,
  type AuthorityRole,
  type PlayerPresence,
  type SessionPlayerSlot,
} from "./types";

export const SQUAD_ONLINE_PROTOCOL_VERSION = 1;
export const SQUAD_ONLINE_STORAGE_KEY = "chaos_core_squad_online_match";
export const SQUAD_ONLINE_MIN_PLAYERS = 2;
export const SQUAD_ONLINE_MAX_PLAYERS = 2;
export const DEFAULT_SKIRMISH_GRID_WIDTH = 8;
export const DEFAULT_SKIRMISH_GRID_HEIGHT = 5;

export type SquadMatchPhase = "lobby" | "draft" | "confirmation" | "battle" | "result";
export type SquadTransportState = "local_preview" | "hosting" | "joining" | "connected" | "reconnecting" | "closed";
export type SquadDraftOptionCategory = "unit" | "equipment" | "tactical";
export type SquadWinCondition = SkirmishObjectiveType;

export interface SquadLobbyMember {
  slot: SessionPlayerSlot;
  callsign: string;
  presence: PlayerPresence;
  authorityRole: AuthorityRole;
  connected: boolean;
  ready: boolean;
  joinedAt: number;
  lastHeartbeatAt: number | null;
}

export interface SquadDraftOption {
  id: string;
  category: SquadDraftOptionCategory;
  label: string;
  summary: string;
}

export interface SquadDraftPick {
  slot: SessionPlayerSlot;
  optionId: string;
  category: SquadDraftOptionCategory;
  round: number;
  pickedAt: number;
}

export interface SquadDraftState {
  seed: number;
  round: number;
  pickOrder: SessionPlayerSlot[];
  currentPickSlot: SessionPlayerSlot | null;
  pool: SquadDraftOption[];
  picks: SquadDraftPick[];
}

export interface SquadConfirmationState {
  confirmedSlots: SessionPlayerSlot[];
}

export interface SquadMatchRules {
  maxPlayers: number;
  targetSquadSize: number;
  mapSeed: number;
  gridWidth: number;
  gridHeight: number;
  mapId?: string | null;
  winCondition: SquadWinCondition;
}

export interface SquadMatchResult {
  winnerSlots: SessionPlayerSlot[];
  reason: string;
  finishedAt: number;
}

export interface MatchSnapshot {
  protocolVersion: number;
  matchId: string;
  mode: "squad";
  phase: SquadMatchPhase;
  hostSlot: SessionPlayerSlot;
  maxPlayers: number;
  rules: SquadMatchRules;
  members: Record<SessionPlayerSlot, SquadLobbyMember | null>;
  draft: SquadDraftState | null;
  confirmation: SquadConfirmationState;
  battleStateId: string | null;
  result: SquadMatchResult | null;
  updatedAt: number;
}

export interface SquadMatchState extends MatchSnapshot {
  joinCode: string;
  localSlot: SessionPlayerSlot;
  transportState: SquadTransportState;
}

export type MatchCommand =
  | { type: "create_lobby"; callsign: string; maxPlayers?: number; winCondition?: SquadWinCondition; gridWidth?: number; gridHeight?: number }
  | { type: "join_lobby"; callsign: string; slot?: SessionPlayerSlot }
  | { type: "leave_lobby"; slot: SessionPlayerSlot }
  | { type: "set_ready"; slot: SessionPlayerSlot; ready?: boolean }
  | { type: "start_draft"; seed?: number }
  | { type: "make_pick"; slot: SessionPlayerSlot; optionId: string }
  | { type: "confirm_loadout"; slot: SessionPlayerSlot }
  | { type: "request_reconnect"; slot: SessionPlayerSlot }
  | { type: "complete_match"; winnerSlots: SessionPlayerSlot[]; reason: string };

const UNIT_OPTIONS = [
  "Vanguard Core",
  "Ranger Line",
  "Shock Squire",
  "Hex Analyst",
  "Breacher",
  "Harrier",
  "Ward Marshal",
  "Signal Raider",
];

const EQUIPMENT_OPTIONS = [
  "Arc Spear",
  "Heavy Carbine",
  "Scout Harness",
  "Mirror Plate",
  "Recoil Gloves",
  "Flux Buckler",
  "Hazard Lens",
  "Anchor Boots",
];

const TACTICAL_OPTIONS = [
  "Priority Intercept",
  "Emergency Med Drop",
  "Ambush Window",
  "Fog Screen",
  "Rapid Advance",
  "Counter-Breach",
  "False Retreat",
  "Kill Box",
];

function clampMaxPlayers(maxPlayers = SQUAD_ONLINE_MIN_PLAYERS): number {
  return Math.max(SQUAD_ONLINE_MIN_PLAYERS, Math.min(SQUAD_ONLINE_MAX_PLAYERS, Math.floor(maxPlayers)));
}

function clampGridWidth(gridWidth = DEFAULT_SKIRMISH_GRID_WIDTH): number {
  return Math.max(4, Math.min(10, Math.floor(gridWidth)));
}

function clampGridHeight(gridHeight = DEFAULT_SKIRMISH_GRID_HEIGHT): number {
  return Math.max(3, Math.min(8, Math.floor(gridHeight)));
}

function normalizeSquadWinCondition(winCondition?: SquadWinCondition | "objective"): SquadWinCondition {
  if (winCondition === "control_relay" || winCondition === "breakthrough") {
    return winCondition;
  }
  return winCondition === "objective" ? "control_relay" : "elimination";
}

export function getSquadWinConditionLabel(winCondition: SquadWinCondition): string {
  if (winCondition === "control_relay") {
    return "Control Relay";
  }
  if (winCondition === "breakthrough") {
    return "Breakthrough";
  }
  return "Elimination";
}

function createEmptyMemberSlots(): Record<SessionPlayerSlot, SquadLobbyMember | null> {
  return SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
    acc[slot] = null;
    return acc;
  }, {} as Record<SessionPlayerSlot, SquadLobbyMember | null>);
}

function createJoinCode(matchId: string): string {
  return matchId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
}

function createLobbyMember(
  slot: SessionPlayerSlot,
  callsign: string,
  authorityRole: AuthorityRole,
  presence: PlayerPresence,
): SquadLobbyMember {
  const now = Date.now();
  return {
    slot,
    callsign,
    presence,
    authorityRole,
    connected: true,
    ready: authorityRole === "host",
    joinedAt: now,
    lastHeartbeatAt: now,
  };
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const rng = createSeededRng(seed);
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const swapIndex = Math.floor(rng() * (i + 1));
    [next[i], next[swapIndex]] = [next[swapIndex], next[i]];
  }
  return next;
}

function createDraftPool(seed: number, size: number): SquadDraftOption[] {
  const combined = [
    ...UNIT_OPTIONS.map((label, index) => ({
      id: `unit_${index}_${hashSeed(`${seed}:${label}`)}`,
      category: "unit" as const,
      label,
      summary: "Combat-ready operator draft option.",
    })),
    ...EQUIPMENT_OPTIONS.map((label, index) => ({
      id: `equipment_${index}_${hashSeed(`${seed}:${label}`)}`,
      category: "equipment" as const,
      label,
      summary: "Loadout upgrade option.",
    })),
    ...TACTICAL_OPTIONS.map((label, index) => ({
      id: `tactical_${index}_${hashSeed(`${seed}:${label}`)}`,
      category: "tactical" as const,
      label,
      summary: "One-shot tactical modifier.",
    })),
  ];
  return shuffleWithSeed(combined, seed).slice(0, Math.max(size, 6));
}

function getEligibleSlots(match: SquadMatchState): SessionPlayerSlot[] {
  return SESSION_PLAYER_SLOTS.slice(0, clampMaxPlayers(match.maxPlayers));
}

function getOccupiedSlots(match: SquadMatchState): SessionPlayerSlot[] {
  return getEligibleSlots(match).filter((slot) => {
    const member = match.members[slot];
    return Boolean(member && member.connected);
  });
}

export function getNextOpenSquadSlot(match: SquadMatchState): SessionPlayerSlot | null {
  const occupied = getOccupiedSlots(match).length;
  if (occupied >= match.maxPlayers) {
    return null;
  }
  return getEligibleSlots(match).find((slot) => !match.members[slot]) ?? null;
}

export function createSquadOnlineMatch(
  hostCallsign: string,
  maxPlayers = 2,
  winCondition: SquadWinCondition = "elimination",
  gridWidth = DEFAULT_SKIRMISH_GRID_WIDTH,
  gridHeight = DEFAULT_SKIRMISH_GRID_HEIGHT,
  mapId: string | null = null,
): SquadMatchState {
  const now = Date.now();
  const matchId = `squad_${now.toString(36)}`;
  const members = createEmptyMemberSlots();
  members.P1 = createLobbyMember("P1", hostCallsign.trim() || "HOST", "host", "local");
  const normalizedWinCondition = normalizeSquadWinCondition(winCondition);

  return {
    protocolVersion: SQUAD_ONLINE_PROTOCOL_VERSION,
    matchId,
    mode: "squad",
    phase: "lobby",
    hostSlot: "P1",
    maxPlayers: clampMaxPlayers(maxPlayers),
    rules: {
      maxPlayers: clampMaxPlayers(maxPlayers),
      targetSquadSize: 3,
      mapSeed: hashSeed(`${matchId}:map`),
      gridWidth: clampGridWidth(gridWidth),
      gridHeight: clampGridHeight(gridHeight),
      mapId,
      winCondition: normalizedWinCondition,
    },
    members,
    draft: null,
    confirmation: {
      confirmedSlots: [],
    },
    battleStateId: null,
    result: null,
    updatedAt: now,
    joinCode: createJoinCode(matchId),
    localSlot: "P1",
    transportState: "local_preview",
  };
}

export function getConnectedSquadMembers(match: SquadMatchState): SquadLobbyMember[] {
  return getOccupiedSlots(match)
    .map((slot) => match.members[slot])
    .filter((member): member is SquadLobbyMember => Boolean(member));
}

export function addPreviewPeerToSquadMatch(
  match: SquadMatchState,
  callsign: string,
  preferredSlot?: SessionPlayerSlot,
): SquadMatchState {
  const targetSlot = preferredSlot && !match.members[preferredSlot]
    ? preferredSlot
    : getNextOpenSquadSlot(match);
  if (!targetSlot) {
    return match;
  }

  return {
    ...match,
    members: {
      ...match.members,
      [targetSlot]: createLobbyMember(targetSlot, callsign.trim() || targetSlot, "client", "remote"),
    },
    updatedAt: Date.now(),
  };
}

export function removeSquadLobbyMember(match: SquadMatchState, slot: SessionPlayerSlot): SquadMatchState {
  if (slot === match.hostSlot) {
    return match;
  }

  return {
    ...match,
    members: {
      ...match.members,
      [slot]: null,
    },
    updatedAt: Date.now(),
  };
}

export function markSquadMemberDisconnected(match: SquadMatchState, slot: SessionPlayerSlot): SquadMatchState {
  const member = match.members[slot];
  if (!member || slot === match.hostSlot) {
    return match;
  }

  return {
    ...match,
    members: {
      ...match.members,
      [slot]: {
        ...member,
        connected: false,
        presence: "disconnected",
        lastHeartbeatAt: Date.now(),
      },
    },
    updatedAt: Date.now(),
  };
}

export function setSquadLobbyReady(
  match: SquadMatchState,
  slot: SessionPlayerSlot,
  ready?: boolean,
): SquadMatchState {
  const member = match.members[slot];
  if (!member) {
    return match;
  }

  return {
    ...match,
    members: {
      ...match.members,
      [slot]: {
        ...member,
        ready: ready ?? !member.ready,
        lastHeartbeatAt: Date.now(),
      },
    },
    updatedAt: Date.now(),
  };
}

export function canStartSquadDraft(match: SquadMatchState): boolean {
  if (match.phase !== "lobby") {
    return false;
  }
  const members = getConnectedSquadMembers(match);
  return members.length >= SQUAD_ONLINE_MIN_PLAYERS && members.every((member) => member.ready);
}

function getNextDraftSlot(
  draft: SquadDraftState,
  targetSquadSize: number,
  afterSlot: SessionPlayerSlot,
): SessionPlayerSlot | null {
  const pickCounts = draft.pickOrder.reduce((acc, slot) => {
    acc[slot] = draft.picks.filter((pick) => pick.slot === slot).length;
    return acc;
  }, {} as Record<SessionPlayerSlot, number>);

  const currentIndex = Math.max(0, draft.pickOrder.indexOf(afterSlot));
  for (let offset = 1; offset <= draft.pickOrder.length; offset++) {
    const candidate = draft.pickOrder[(currentIndex + offset) % draft.pickOrder.length];
    if ((pickCounts[candidate] ?? 0) < targetSquadSize) {
      return candidate;
    }
  }
  return null;
}

export function startSquadDraft(match: SquadMatchState, seed = hashSeed(match.matchId)): SquadMatchState {
  if (!canStartSquadDraft(match)) {
    return match;
  }

  const pickOrder = getConnectedSquadMembers(match).map((member) => member.slot);
  const totalOptions = Math.max(match.rules.targetSquadSize * pickOrder.length * 2, 10);

  return {
    ...match,
    phase: "draft",
    draft: {
      seed,
      round: 1,
      pickOrder,
      currentPickSlot: pickOrder[0] ?? null,
      pool: createDraftPool(seed, totalOptions),
      picks: [],
    },
    confirmation: {
      confirmedSlots: [],
    },
    updatedAt: Date.now(),
  };
}

export function makeSquadDraftPick(
  match: SquadMatchState,
  slot: SessionPlayerSlot,
  optionId: string,
): SquadMatchState {
  if (match.phase !== "draft" || !match.draft || match.draft.currentPickSlot !== slot) {
    return match;
  }

  const option = match.draft.pool.find((entry) => entry.id === optionId);
  if (!option) {
    return match;
  }

  const nextDraft: SquadDraftState = {
    ...match.draft,
    picks: [
      ...match.draft.picks,
      {
        slot,
        optionId,
        category: option.category,
        round: match.draft.round,
        pickedAt: Date.now(),
      },
    ],
    pool: match.draft.pool.filter((entry) => entry.id !== optionId),
  };

  const nextSlot = getNextDraftSlot(nextDraft, match.rules.targetSquadSize, slot);
  const totalPickCapacity = nextDraft.pickOrder.length * match.rules.targetSquadSize;
  const picksComplete = nextDraft.picks.length >= totalPickCapacity;

  if (picksComplete || !nextSlot) {
    return {
      ...match,
      phase: "confirmation",
      draft: {
        ...nextDraft,
        currentPickSlot: null,
      },
      confirmation: {
        confirmedSlots: [],
      },
      updatedAt: Date.now(),
    };
  }

  const currentIndex = nextDraft.pickOrder.indexOf(slot);
  const nextIndex = nextSlot ? nextDraft.pickOrder.indexOf(nextSlot) : -1;
  const nextRound = nextIndex !== -1 && nextIndex <= currentIndex
    ? nextDraft.round + 1
    : nextDraft.round;

  return {
    ...match,
    draft: {
      ...nextDraft,
      currentPickSlot: nextSlot,
      round: nextRound,
    },
    updatedAt: Date.now(),
  };
}

export function confirmSquadLoadout(match: SquadMatchState, slot: SessionPlayerSlot): SquadMatchState {
  if (match.phase !== "confirmation") {
    return match;
  }
  if (!match.members[slot]) {
    return match;
  }
  if (match.confirmation.confirmedSlots.includes(slot)) {
    return match;
  }

  const confirmedSlots = [...match.confirmation.confirmedSlots, slot];
  const connectedSlots = getConnectedSquadMembers(match).map((member) => member.slot);
  const allConfirmed = connectedSlots.every((connectedSlot) => confirmedSlots.includes(connectedSlot));

  return {
    ...match,
    phase: allConfirmed ? "battle" : match.phase,
    confirmation: {
      confirmedSlots,
    },
    battleStateId: allConfirmed ? `battle_${match.matchId}` : match.battleStateId,
    updatedAt: Date.now(),
  };
}

export function markSquadMemberReconnected(match: SquadMatchState, slot: SessionPlayerSlot): SquadMatchState {
  const member = match.members[slot];
  if (!member) {
    return match;
  }

  return {
    ...match,
    members: {
      ...match.members,
      [slot]: {
        ...member,
        connected: true,
        presence: slot === match.localSlot ? "local" : "remote",
        lastHeartbeatAt: Date.now(),
      },
    },
    transportState: "connected",
    updatedAt: Date.now(),
  };
}

export function completeSquadMatch(
  match: SquadMatchState,
  winnerSlots: SessionPlayerSlot[],
  reason: string,
): SquadMatchState {
  return {
    ...match,
    phase: "result",
    result: {
      winnerSlots,
      reason,
      finishedAt: Date.now(),
    },
    updatedAt: Date.now(),
  };
}

export function createSquadMatchSnapshot(match: SquadMatchState): MatchSnapshot {
  const {
    joinCode: _joinCode,
    localSlot: _localSlot,
    transportState: _transportState,
    ...snapshot
  } = match;
  return snapshot;
}

export function serializeSquadMatchSnapshot(match: SquadMatchState): string {
  return JSON.stringify(createSquadMatchSnapshot(match), null, 2);
}

export function parseSquadMatchSnapshot(serialized: string): MatchSnapshot | null {
  try {
    const parsed = JSON.parse(serialized) as MatchSnapshot;
    if (parsed?.mode !== "squad" || parsed?.protocolVersion !== SQUAD_ONLINE_PROTOCOL_VERSION) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function rehydrateSquadMatchState(
  snapshot: MatchSnapshot,
  localSlot: SessionPlayerSlot = snapshot.hostSlot,
): SquadMatchState {
  return {
    ...snapshot,
    rules: {
      ...snapshot.rules,
      gridWidth: clampGridWidth(snapshot.rules?.gridWidth ?? DEFAULT_SKIRMISH_GRID_WIDTH),
      gridHeight: clampGridHeight(snapshot.rules?.gridHeight ?? DEFAULT_SKIRMISH_GRID_HEIGHT),
      mapId: snapshot.rules?.mapId ?? null,
      winCondition: normalizeSquadWinCondition(snapshot.rules?.winCondition),
    },
    joinCode: createJoinCode(snapshot.matchId),
    localSlot,
    transportState: "local_preview",
  };
}

export function applySquadMatchCommand(
  match: SquadMatchState | null,
  command: MatchCommand,
): SquadMatchState | null {
  if (!match && command.type !== "create_lobby") {
    return match;
  }

  switch (command.type) {
    case "create_lobby":
      return createSquadOnlineMatch(
        command.callsign,
        command.maxPlayers,
        command.winCondition,
        command.gridWidth,
        command.gridHeight,
        null,
      );
    case "join_lobby":
      return addPreviewPeerToSquadMatch(match!, command.callsign, command.slot);
    case "leave_lobby":
      return removeSquadLobbyMember(match!, command.slot);
    case "set_ready":
      return setSquadLobbyReady(match!, command.slot, command.ready);
    case "start_draft":
      return startSquadDraft(match!, command.seed);
    case "make_pick":
      return makeSquadDraftPick(match!, command.slot, command.optionId);
    case "confirm_loadout":
      return confirmSquadLoadout(match!, command.slot);
    case "request_reconnect":
      return markSquadMemberReconnected(match!, command.slot);
    case "complete_match":
      return completeSquadMatch(match!, command.winnerSlots, command.reason);
    default:
      return match;
  }
}

export function saveSquadMatchState(match: SquadMatchState | null): void {
  try {
    if (!match) {
      localStorage.removeItem(SQUAD_ONLINE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(SQUAD_ONLINE_STORAGE_KEY, JSON.stringify(match));
  } catch {
    // Ignore storage failures in desktop preview mode.
  }
}

export function loadSquadMatchState(): SquadMatchState | null {
  try {
    const raw = localStorage.getItem(SQUAD_ONLINE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as SquadMatchState;
    if (parsed?.mode !== "squad") {
      return null;
    }
    return {
      ...parsed,
      rules: {
        ...parsed.rules,
        gridWidth: clampGridWidth(parsed.rules?.gridWidth ?? DEFAULT_SKIRMISH_GRID_WIDTH),
        gridHeight: clampGridHeight(parsed.rules?.gridHeight ?? DEFAULT_SKIRMISH_GRID_HEIGHT),
        mapId: parsed.rules?.mapId ?? null,
        winCondition: normalizeSquadWinCondition(parsed.rules?.winCondition),
      },
    };
  } catch {
    return null;
  }
}

export function clearSquadMatchState(): void {
  saveSquadMatchState(null);
}

export function getSquadLobbySummary(match: SquadMatchState | null): string {
  if (!match) {
    return "No active Skirmish online session.";
  }
  const members = getConnectedSquadMembers(match);
  return `${members.length}/${match.maxPlayers} operators linked // ${getSquadWinConditionLabel(match.rules.winCondition).toUpperCase()} // GRID ${match.rules.gridWidth}x${match.rules.gridHeight} // phase ${match.phase.toUpperCase()} // join code ${match.joinCode}`;
}

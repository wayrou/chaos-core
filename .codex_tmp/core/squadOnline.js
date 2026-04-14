import { SESSION_PLAYER_SLOTS, } from "./types";
export const SQUAD_ONLINE_PROTOCOL_VERSION = 1;
export const SQUAD_ONLINE_STORAGE_KEY = "chaos_core_squad_online_match";
export const SQUAD_ONLINE_MIN_PLAYERS = 2;
export const SQUAD_ONLINE_MAX_PLAYERS = 2;
export const DEFAULT_SKIRMISH_GRID_WIDTH = 8;
export const DEFAULT_SKIRMISH_GRID_HEIGHT = 5;
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
function clampMaxPlayers(maxPlayers = SQUAD_ONLINE_MIN_PLAYERS) {
    return Math.max(SQUAD_ONLINE_MIN_PLAYERS, Math.min(SQUAD_ONLINE_MAX_PLAYERS, Math.floor(maxPlayers)));
}
function clampGridWidth(gridWidth = DEFAULT_SKIRMISH_GRID_WIDTH) {
    return Math.max(4, Math.min(10, Math.floor(gridWidth)));
}
function clampGridHeight(gridHeight = DEFAULT_SKIRMISH_GRID_HEIGHT) {
    return Math.max(3, Math.min(8, Math.floor(gridHeight)));
}
function normalizeSquadWinCondition(winCondition) {
    if (winCondition === "control_relay" || winCondition === "breakthrough" || winCondition === "extraction") {
        return winCondition;
    }
    return winCondition === "objective" ? "control_relay" : "elimination";
}
export function getSquadWinConditionLabel(winCondition) {
    if (winCondition === "control_relay") {
        return "Control Relay";
    }
    if (winCondition === "breakthrough") {
        return "Breakthrough";
    }
    if (winCondition === "extraction") {
        return "Extraction";
    }
    return "Elimination";
}
function createEmptyMemberSlots() {
    return SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
        acc[slot] = null;
        return acc;
    }, {});
}
function createJoinCode(matchId) {
    return matchId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
}
function createLobbyMember(slot, callsign, authorityRole, presence) {
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
function hashSeed(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function createSeededRng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function shuffleWithSeed(items, seed) {
    const rng = createSeededRng(seed);
    const next = [...items];
    for (let i = next.length - 1; i > 0; i--) {
        const swapIndex = Math.floor(rng() * (i + 1));
        [next[i], next[swapIndex]] = [next[swapIndex], next[i]];
    }
    return next;
}
function createDraftPool(seed, size) {
    const combined = [
        ...UNIT_OPTIONS.map((label, index) => ({
            id: `unit_${index}_${hashSeed(`${seed}:${label}`)}`,
            category: "unit",
            label,
            summary: "Combat-ready operator draft option.",
        })),
        ...EQUIPMENT_OPTIONS.map((label, index) => ({
            id: `equipment_${index}_${hashSeed(`${seed}:${label}`)}`,
            category: "equipment",
            label,
            summary: "Loadout upgrade option.",
        })),
        ...TACTICAL_OPTIONS.map((label, index) => ({
            id: `tactical_${index}_${hashSeed(`${seed}:${label}`)}`,
            category: "tactical",
            label,
            summary: "One-shot tactical modifier.",
        })),
    ];
    return shuffleWithSeed(combined, seed).slice(0, Math.max(size, 6));
}
function getEligibleSlots(match) {
    return SESSION_PLAYER_SLOTS.slice(0, clampMaxPlayers(match.maxPlayers));
}
function getOccupiedSlots(match) {
    return getEligibleSlots(match).filter((slot) => {
        const member = match.members[slot];
        return Boolean(member && member.connected);
    });
}
export function getNextOpenSquadSlot(match) {
    const occupied = getOccupiedSlots(match).length;
    if (occupied >= match.maxPlayers) {
        return null;
    }
    return getEligibleSlots(match).find((slot) => !match.members[slot]) ?? null;
}
export function createSquadOnlineMatch(hostCallsign, maxPlayers = 2, winCondition = "elimination", gridWidth = DEFAULT_SKIRMISH_GRID_WIDTH, gridHeight = DEFAULT_SKIRMISH_GRID_HEIGHT, mapId = null) {
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
export function getConnectedSquadMembers(match) {
    return getOccupiedSlots(match)
        .map((slot) => match.members[slot])
        .filter((member) => Boolean(member));
}
export function addPreviewPeerToSquadMatch(match, callsign, preferredSlot) {
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
export function removeSquadLobbyMember(match, slot) {
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
export function markSquadMemberDisconnected(match, slot) {
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
export function setSquadLobbyReady(match, slot, ready) {
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
export function canStartSquadDraft(match) {
    if (match.phase !== "lobby") {
        return false;
    }
    const members = getConnectedSquadMembers(match);
    return members.length >= SQUAD_ONLINE_MIN_PLAYERS && members.every((member) => member.ready);
}
function getNextDraftSlot(draft, targetSquadSize, afterSlot) {
    const pickCounts = draft.pickOrder.reduce((acc, slot) => {
        acc[slot] = draft.picks.filter((pick) => pick.slot === slot).length;
        return acc;
    }, {});
    const currentIndex = Math.max(0, draft.pickOrder.indexOf(afterSlot));
    for (let offset = 1; offset <= draft.pickOrder.length; offset++) {
        const candidate = draft.pickOrder[(currentIndex + offset) % draft.pickOrder.length];
        if ((pickCounts[candidate] ?? 0) < targetSquadSize) {
            return candidate;
        }
    }
    return null;
}
export function startSquadDraft(match, seed = hashSeed(match.matchId)) {
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
export function makeSquadDraftPick(match, slot, optionId) {
    if (match.phase !== "draft" || !match.draft || match.draft.currentPickSlot !== slot) {
        return match;
    }
    const option = match.draft.pool.find((entry) => entry.id === optionId);
    if (!option) {
        return match;
    }
    const nextDraft = {
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
export function confirmSquadLoadout(match, slot) {
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
export function markSquadMemberReconnected(match, slot) {
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
export function completeSquadMatch(match, winnerSlots, reason) {
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
export function createSquadMatchSnapshot(match) {
    const { joinCode: _joinCode, localSlot: _localSlot, transportState: _transportState, ...snapshot } = match;
    return snapshot;
}
export function serializeSquadMatchSnapshot(match) {
    return JSON.stringify(createSquadMatchSnapshot(match), null, 2);
}
export function parseSquadMatchSnapshot(serialized) {
    try {
        const parsed = JSON.parse(serialized);
        if (parsed?.mode !== "squad" || parsed?.protocolVersion !== SQUAD_ONLINE_PROTOCOL_VERSION) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
export function rehydrateSquadMatchState(snapshot, localSlot = snapshot.hostSlot) {
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
export function applySquadMatchCommand(match, command) {
    if (!match && command.type !== "create_lobby") {
        return match;
    }
    switch (command.type) {
        case "create_lobby":
            return createSquadOnlineMatch(command.callsign, command.maxPlayers, command.winCondition, command.gridWidth, command.gridHeight, null);
        case "join_lobby":
            return addPreviewPeerToSquadMatch(match, command.callsign, command.slot);
        case "leave_lobby":
            return removeSquadLobbyMember(match, command.slot);
        case "set_ready":
            return setSquadLobbyReady(match, command.slot, command.ready);
        case "start_draft":
            return startSquadDraft(match, command.seed);
        case "make_pick":
            return makeSquadDraftPick(match, command.slot, command.optionId);
        case "confirm_loadout":
            return confirmSquadLoadout(match, command.slot);
        case "request_reconnect":
            return markSquadMemberReconnected(match, command.slot);
        case "complete_match":
            return completeSquadMatch(match, command.winnerSlots, command.reason);
        default:
            return match;
    }
}
export function saveSquadMatchState(match) {
    try {
        if (!match) {
            localStorage.removeItem(SQUAD_ONLINE_STORAGE_KEY);
            return;
        }
        localStorage.setItem(SQUAD_ONLINE_STORAGE_KEY, JSON.stringify(match));
    }
    catch {
        // Ignore storage failures in desktop preview mode.
    }
}
export function loadSquadMatchState() {
    try {
        const raw = localStorage.getItem(SQUAD_ONLINE_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
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
    }
    catch {
        return null;
    }
}
export function clearSquadMatchState() {
    saveSquadMatchState(null);
}
export function getSquadLobbySummary(match) {
    if (!match) {
        return "No active Skirmish online session.";
    }
    const members = getConnectedSquadMembers(match);
    return `${members.length}/${match.maxPlayers} operators linked // ${getSquadWinConditionLabel(match.rules.winCondition).toUpperCase()} // GRID ${match.rules.gridWidth}x${match.rules.gridHeight} // phase ${match.phase.toUpperCase()} // join code ${match.joinCode}`;
}

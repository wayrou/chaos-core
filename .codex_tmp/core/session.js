import { LOCAL_PLAYER_IDS, NETWORK_PLAYER_SLOTS, SESSION_PLAYER_SLOTS, } from "./types";
import { addResourceWallet, createEmptyResourceWallet, hasEnoughResources, RESOURCE_KEYS, subtractResourceWallet, } from "./resources";
const EMPTY_RESOURCE_WALLET = createEmptyResourceWallet();
const LOCAL_COOP_RESTRICTED_FIELD_ACTIONS = new Set([
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
function isLocalPlayerSlot(slot) {
    return slot === "P1" || slot === "P2";
}
function cloneResourceWallet(wallet) {
    return createEmptyResourceWallet(wallet);
}
function createResourcePool(wad = 0, resources) {
    return {
        wad,
        resources: cloneResourceWallet(resources),
    };
}
function cloneResourcePool(pool) {
    return createResourcePool(Number(pool?.wad ?? 0), pool?.resources);
}
function cloneTradeTransfer(transfer) {
    return {
        ...transfer,
        note: transfer.note ?? undefined,
    };
}
function clonePendingTransfers(transfers) {
    return Array.isArray(transfers) ? transfers.map(cloneTradeTransfer) : [];
}
function cloneResourceLedger(ledger) {
    return {
        preset: ledger?.preset ?? "shared",
        shared: cloneResourcePool(ledger?.shared),
        perPlayer: SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
            acc[slot] = cloneResourcePool(ledger?.perPlayer?.[slot]);
            return acc;
        }, {}),
    };
}
function sumResourcePools(pools) {
    let wad = 0;
    let resources = createEmptyResourceWallet();
    for (const pool of pools) {
        wad += Number(pool?.wad ?? 0);
        resources = addResourceWallet(resources, pool?.resources);
    }
    return createResourcePool(wad, resources);
}
function getEconomyParticipantSlotsFromSession(session) {
    const activeSlots = SESSION_PLAYER_SLOTS.filter((slot) => {
        const player = session.players?.[slot];
        return Boolean(player
            && (player.connected
                || player.presence === "local"
                || player.presence === "remote"
                || player.stagingState !== "disconnected"));
    });
    return activeSlots.length > 0 ? activeSlots : ["P1"];
}
function getLocalSessionPlayerSlotFromSession(session) {
    const localSlot = SESSION_PLAYER_SLOTS.find((slot) => {
        const player = session.players?.[slot];
        return Boolean(player?.presence === "local" && player.connected);
    });
    return localSlot ?? session.ownerSlot ?? "P1";
}
function distributeIntegerEvenly(amount, slots) {
    const next = SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
        acc[slot] = 0;
        return acc;
    }, {});
    if (slots.length <= 0 || amount <= 0) {
        return next;
    }
    const base = Math.floor(amount / slots.length);
    let remainder = amount % slots.length;
    for (const slot of slots) {
        next[slot] = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) {
            remainder -= 1;
        }
    }
    return next;
}
function distributeResourcePoolEvenly(pool, slots) {
    const next = SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
        acc[slot] = createResourcePool(0, EMPTY_RESOURCE_WALLET);
        return acc;
    }, {});
    const targetSlots = slots.length > 0 ? slots : ["P1"];
    const wadShares = distributeIntegerEvenly(Math.max(0, Math.floor(pool.wad)), targetSlots);
    for (const slot of targetSlots) {
        next[slot].wad = wadShares[slot];
    }
    for (const key of RESOURCE_KEYS) {
        const resourceAmount = Math.max(0, Math.floor(pool.resources[key] ?? 0));
        const shares = distributeIntegerEvenly(resourceAmount, targetSlots);
        for (const slot of targetSlots) {
            next[slot].resources[key] = shares[slot];
        }
    }
    return next;
}
function hasAnyPartitionedAllocations(perPlayer, slots) {
    return slots.some((slot) => {
        const pool = perPlayer[slot];
        return pool.wad > 0 || RESOURCE_KEYS.some((key) => Number(pool.resources[key] ?? 0) > 0);
    });
}
function createSessionTradeTransferId() {
    return `transfer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function getTransferAmountLabel(transfer) {
    if (transfer.kind === "wad") {
        return `${Math.max(0, Math.floor(transfer.wadAmount ?? 0))} WAD`;
    }
    if (transfer.kind === "resource" && transfer.resourceKey) {
        return `${Math.max(0, Math.floor(transfer.resourceAmount ?? 0))} ${transfer.resourceKey}`;
    }
    return transfer.kind.toUpperCase();
}
function createCampaignStateSeed(operationId = null) {
    return {
        sharedWorldState: {
            discoveredTheaterIds: [],
            unlockedFloorIds: [],
            atlasProgressToken: operationId,
            schemaUnlockIds: [],
        },
    };
}
function clonePendingTheaterBattleConfirmation(pending) {
    return pending
        ? {
            roomId: pending.roomId,
            previousRoomId: pending.previousRoomId,
            roomLabel: pending.roomLabel,
            squadId: pending.squadId ?? null,
        }
        : null;
}
function cloneTheaterRuntimeContext(context) {
    return context
        ? {
            theaterId: context.theaterId,
            operationId: context.operationId ?? null,
            snapshot: context.snapshot,
            phase: context.phase ?? null,
            battleSnapshot: context.battleSnapshot ?? null,
            pendingTheaterBattleConfirmation: clonePendingTheaterBattleConfirmation(context.pendingTheaterBattleConfirmation),
            updatedAt: context.updatedAt ?? Date.now(),
        }
        : null;
}
function cloneBattleRuntimeContext(context) {
    return context
        ? {
            battleId: context.battleId,
            theaterId: context.theaterId ?? null,
            roomId: context.roomId ?? null,
            squadId: context.squadId ?? null,
            snapshot: context.snapshot,
            phase: context.phase ?? null,
            updatedAt: context.updatedAt ?? Date.now(),
        }
        : null;
}
function cloneTheaterRuntimeContexts(contexts) {
    if (!contexts) {
        return {};
    }
    return Object.entries(contexts).reduce((acc, [theaterId, context]) => {
        const cloned = cloneTheaterRuntimeContext(context);
        if (cloned) {
            acc[theaterId] = cloned;
        }
        return acc;
    }, {});
}
function cloneBattleRuntimeContexts(contexts) {
    if (!contexts) {
        return {};
    }
    return Object.entries(contexts).reduce((acc, [battleId, context]) => {
        const cloned = cloneBattleRuntimeContext(context);
        if (cloned) {
            acc[battleId] = cloned;
        }
        return acc;
    }, {});
}
function parseBattleRuntimeSnapshot(snapshot) {
    if (!snapshot) {
        return null;
    }
    try {
        const parsed = JSON.parse(snapshot);
        return parsed?.id && parsed?.units ? parsed : null;
    }
    catch {
        return null;
    }
}
export function getBattleRuntimeContext(state, battleId) {
    if (!battleId) {
        return null;
    }
    return state.session.activeBattleContexts?.[battleId] ?? null;
}
export function getBattleStateById(state, battleId) {
    if (!battleId) {
        return null;
    }
    if (state.currentBattle?.id === battleId) {
        return state.currentBattle;
    }
    return parseBattleRuntimeSnapshot(getBattleRuntimeContext(state, battleId)?.snapshot);
}
export function getMountedOrActiveBattleState(state) {
    return state.currentBattle
        ?? getBattleStateById(state, state.session.activeBattleId ?? null);
}
export function mountBattleState(state, battle) {
    if (!battle) {
        return {
            ...state,
            currentBattle: null,
            session: {
                ...state.session,
                activeBattleId: null,
            },
        };
    }
    if (state.currentBattle?.id === battle.id
        && state.session.activeBattleId === battle.id) {
        return state;
    }
    return {
        ...state,
        currentBattle: battle,
        phase: "battle",
        session: {
            ...state.session,
            activeBattleId: battle.id,
        },
    };
}
export function mountBattleContextById(state, battleId) {
    const battle = getBattleStateById(state, battleId);
    return battle ? mountBattleState(state, battle) : state;
}
export function replaceBattleStateById(state, battleId, battle) {
    const nextActiveBattleContexts = { ...state.session.activeBattleContexts };
    if (battle) {
        nextActiveBattleContexts[battleId] = {
            battleId,
            theaterId: battle.theaterMeta?.theaterId ?? null,
            roomId: battle.theaterMeta?.roomId ?? battle.roomId ?? null,
            squadId: battle.theaterBonuses?.squadId
                ?? battle.theaterMeta?.squadId
                ?? null,
            snapshot: JSON.stringify(battle),
            phase: battle.phase ?? null,
            updatedAt: Date.now(),
        };
    }
    else {
        delete nextActiveBattleContexts[battleId];
    }
    const shouldMount = state.currentBattle?.id === battleId
        || state.session.activeBattleId === battleId;
    return {
        ...state,
        currentBattle: shouldMount ? battle : state.currentBattle,
        phase: shouldMount && battle ? "battle" : state.phase,
        session: {
            ...state.session,
            activeBattleContexts: nextActiveBattleContexts,
            activeBattleId: state.session.activeBattleId === battleId
                ? (battle?.id ?? null)
                : state.session.activeBattleId,
        },
    };
}
function getDefaultPlayerPresence(active) {
    return active ? "local" : "inactive";
}
function getDefaultPlayerAuthorityRole(active) {
    return active ? "local" : "local";
}
function getDefaultPlayerStagingState(active) {
    return active ? "haven" : "disconnected";
}
function createSessionPlayerState(slot, inputSource, active, controlledUnitIds = [], callsign = null) {
    return {
        slot,
        callsign: callsign?.trim() || null,
        presence: getDefaultPlayerPresence(active),
        authorityRole: getDefaultPlayerAuthorityRole(active),
        connected: active,
        inputSource,
        controlledUnitIds: [...controlledUnitIds],
        stagingState: getDefaultPlayerStagingState(active),
        currentTheaterId: null,
        assignedSquadId: null,
        activeBattleId: null,
        lastSafeRoomId: null,
        lastSafeMapId: active ? "base_camp" : null,
    };
}
function createTheaterAssignment(slot) {
    return {
        playerId: slot,
        theaterId: null,
        squadId: null,
        roomId: null,
        stagingState: "haven",
    };
}
function getCoopParticipantNetworkSlot(lobby, sessionSlot) {
    const coopOperations = lobby.activity.kind === "coop_operations" ? lobby.activity.coopOperations : null;
    if (!coopOperations) {
        return null;
    }
    const match = NETWORK_PLAYER_SLOTS.find((slot) => coopOperations.participants[slot]?.selected
        && coopOperations.participants[slot]?.sessionSlot === sessionSlot);
    return match ?? null;
}
export function createDefaultSessionState(seed) {
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
        sharedCampaignSlot: null,
        sharedCampaignLabel: null,
        sharedCampaignLastSavedAt: null,
        resourceLedger: {
            preset: "shared",
            shared: sharedPool,
            perPlayer: SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
                acc[slot] = slot === "P1" ? perPlayerDefault() : createResourcePool(0, EMPTY_RESOURCE_WALLET);
                return acc;
            }, {}),
        },
        pendingTransfers: [],
        players: SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
            if (slot === "P1") {
                acc[slot] = createSessionPlayerState(slot, p1?.inputSource ?? "keyboard1", p1?.active ?? true, p1?.controlledUnitIds ?? []);
            }
            else if (slot === "P2") {
                acc[slot] = createSessionPlayerState(slot, p2?.inputSource ?? "none", p2?.active ?? false, p2?.controlledUnitIds ?? []);
            }
            else {
                acc[slot] = createSessionPlayerState(slot, "remote", false, []);
            }
            return acc;
        }, {}),
        theaterAssignments: SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
            acc[slot] = createTheaterAssignment(slot);
            return acc;
        }, {}),
        activeTheaterContexts: {},
        activeBattleContexts: {},
        pendingTheaterBattleConfirmation: null,
        activeBattleId: null,
        campaign: createCampaignStateSeed(seed?.operation?.id ?? null),
    };
}
function normalizeMode(currentMode, isP2Active) {
    if (currentMode === "squad" || currentMode === "coop_operations") {
        return currentMode;
    }
    return isP2Active ? "local_coop" : "singleplayer";
}
function normalizePresence(existingPresence, active) {
    if (!active) {
        return "inactive";
    }
    if (existingPresence === "remote" || existingPresence === "disconnected") {
        return existingPresence;
    }
    return "local";
}
function normalizeStagingState(existingState, active, phase, hasControlledBattleUnit) {
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
function normalizeSessionPlayer(state, slot, existing) {
    const player = slot === "P1" || slot === "P2" ? state.players[slot] : null;
    const controlledBattleUnits = Object.values(state.currentBattle?.units ?? {}).filter((unit) => !unit.isEnemy && (unit.controller ?? "P1") === slot);
    const fallback = createSessionPlayerState(slot, player?.inputSource ?? "remote", player?.active ?? false, player?.controlledUnitIds ?? [], existing?.callsign ?? (slot === "P1" ? state.profile?.callsign ?? null : null));
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
            callsign: isLocalParticipant
                ? state.profile?.callsign ?? previous.callsign ?? null
                : previous.callsign ?? null,
            inputSource: isLocalParticipant ? state.players.P1.inputSource : "remote",
            controlledUnitIds: isLocalParticipant ? [...state.players.P1.controlledUnitIds] : [...previous.controlledUnitIds],
            stagingState: nextStagingState,
            lastSafeMapId: isLocalParticipant && state.players.P1.avatar
                ? previous.lastSafeMapId ?? "base_camp"
                : previous.lastSafeMapId,
            activeBattleId: previous.activeBattleId ?? null,
        };
    }
    if (!player) {
        return {
            ...previous,
            slot,
            callsign: previous.callsign ?? null,
            connected: previous.connected && previous.presence !== "inactive",
            presence: previous.presence ?? "inactive",
            stagingState: previous.connected ? previous.stagingState : "disconnected",
        };
    }
    return {
        ...previous,
        slot,
        callsign: slot === "P1"
            ? state.profile?.callsign ?? previous.callsign ?? null
            : previous.callsign ?? null,
        presence: normalizePresence(previous.presence, player.active),
        authorityRole: player.active ? previous.authorityRole : "local",
        connected: player.active,
        inputSource: player.inputSource,
        controlledUnitIds: [...player.controlledUnitIds],
        stagingState: normalizeStagingState(previous.stagingState, player.active, state.phase, controlledBattleUnits.length > 0),
        activeBattleId: previous.activeBattleId ?? null,
        lastSafeMapId: player.avatar ? (previous.lastSafeMapId ?? "base_camp") : previous.lastSafeMapId,
    };
}
function getPlayerPreferredTheaterSquadId(state, slot) {
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
function normalizeTheaterAssignment(state, slot, existing) {
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
    const preferredSquadId = squadIdIsValid
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
export function withNormalizedSessionState(state) {
    const currentSession = state.session ?? createDefaultSessionState(state);
    const sharedPool = createResourcePool(state.wad, state.resources);
    const nextAssignments = SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
        acc[slot] = normalizeTheaterAssignment(state, slot, currentSession.theaterAssignments?.[slot]);
        return acc;
    }, {});
    const nextPlayers = SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
        const normalizedPlayer = normalizeSessionPlayer(state, slot, currentSession.players?.[slot]);
        const assignment = nextAssignments[slot];
        const assignmentSquadId = assignment.squadId ?? normalizedPlayer.assignedSquadId ?? null;
        const activeBattleSquadId = state.currentBattle?.theaterBonuses?.squadId
            ?? state.currentBattle?.theaterMeta?.squadId
            ?? null;
        const controlsActiveBattleUnit = Object.values(state.currentBattle?.units ?? {}).some((unit) => !unit.isEnemy && (unit.controller ?? "P1") === slot);
        const resolvedActiveBattleId = state.currentBattle?.id
            ? (controlsActiveBattleUnit
                || (assignmentSquadId !== null && activeBattleSquadId === assignmentSquadId))
                ? state.currentBattle.id
                : normalizedPlayer.activeBattleId
            : normalizedPlayer.stagingState === "battle"
                ? normalizedPlayer.activeBattleId
                : null;
        acc[slot] = {
            ...normalizedPlayer,
            currentTheaterId: assignment.theaterId,
            assignedSquadId: assignment.squadId,
            activeBattleId: resolvedActiveBattleId,
            lastSafeRoomId: assignment.roomId ?? normalizedPlayer.lastSafeRoomId,
        };
        return acc;
    }, {});
    const nextActiveTheaterContexts = cloneTheaterRuntimeContexts(currentSession.activeTheaterContexts);
    const nextActiveBattleContexts = cloneBattleRuntimeContexts(currentSession.activeBattleContexts);
    const activeTheater = state.operation?.theater;
    const activeBattleTheaterId = state.currentBattle?.theaterMeta?.theaterId ?? null;
    const activeBattleSnapshot = state.currentBattle ? JSON.stringify(state.currentBattle) : null;
    const activeBattleId = state.currentBattle?.id ?? currentSession.activeBattleId ?? null;
    if (activeBattleId && activeBattleSnapshot) {
        nextActiveBattleContexts[activeBattleId] = {
            battleId: activeBattleId,
            theaterId: activeBattleTheaterId,
            roomId: state.currentBattle?.theaterMeta?.roomId ?? state.currentBattle?.roomId ?? null,
            squadId: state.currentBattle?.theaterBonuses?.squadId
                ?? state.currentBattle?.theaterMeta?.squadId
                ?? null,
            snapshot: activeBattleSnapshot,
            phase: state.currentBattle?.phase ?? null,
            updatedAt: Date.now(),
        };
    }
    if (currentSession.mode === "coop_operations" && activeTheater) {
        nextActiveTheaterContexts[activeTheater.definition.id] = {
            theaterId: activeTheater.definition.id,
            operationId: state.operation?.id ?? null,
            snapshot: JSON.stringify(activeTheater),
            phase: state.phase,
            battleSnapshot: activeBattleTheaterId === activeTheater.definition.id ? activeBattleSnapshot : null,
            pendingTheaterBattleConfirmation: clonePendingTheaterBattleConfirmation(currentSession.pendingTheaterBattleConfirmation),
            updatedAt: Date.now(),
        };
    }
    else if (currentSession.mode === "coop_operations"
        && activeBattleTheaterId
        && activeBattleSnapshot
        && nextActiveTheaterContexts[activeBattleTheaterId]) {
        nextActiveTheaterContexts[activeBattleTheaterId] = {
            ...nextActiveTheaterContexts[activeBattleTheaterId],
            battleSnapshot: activeBattleSnapshot,
            phase: state.phase,
            updatedAt: Date.now(),
        };
    }
    const normalizedResourceLedger = cloneResourceLedger(currentSession.resourceLedger);
    const normalizedPendingTransfers = clonePendingTransfers(currentSession.pendingTransfers);
    const normalizedEconomySlots = getEconomyParticipantSlotsFromSession(currentSession);
    const normalizedSharedPool = normalizedResourceLedger.preset === "partitioned"
        ? sumResourcePools(normalizedEconomySlots.map((slot) => normalizedResourceLedger.perPlayer[slot]))
        : sharedPool;
    const nextSession = {
        ...currentSession,
        mode: normalizeMode(currentSession.mode, state.players.P2.active),
        authorityRole: currentSession.authorityRole ?? "local",
        ownerSlot: currentSession.ownerSlot ?? "P1",
        maxPlayers: currentSession.maxPlayers ?? 2,
        activeBattleId: state.currentBattle?.id ?? currentSession.activeBattleId ?? null,
        sharedCampaignSlot: currentSession.sharedCampaignSlot ?? null,
        sharedCampaignLabel: currentSession.sharedCampaignLabel ?? null,
        sharedCampaignLastSavedAt: currentSession.sharedCampaignLastSavedAt ?? null,
        resourceLedger: {
            ...normalizedResourceLedger,
            preset: normalizedResourceLedger.preset ?? "shared",
            shared: normalizedSharedPool,
            perPlayer: SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
                acc[slot] = normalizedResourceLedger.perPlayer[slot] ?? createResourcePool(0, EMPTY_RESOURCE_WALLET);
                return acc;
            }, {}),
        },
        pendingTransfers: normalizedPendingTransfers,
        players: nextPlayers,
        theaterAssignments: nextAssignments,
        activeTheaterContexts: nextActiveTheaterContexts,
        activeBattleContexts: nextActiveBattleContexts,
        pendingTheaterBattleConfirmation: clonePendingTheaterBattleConfirmation(currentSession.pendingTheaterBattleConfirmation),
        campaign: currentSession.campaign ?? createCampaignStateSeed(state.operation?.id ?? null),
    };
    const sessionChanged = !state.session
        || JSON.stringify(state.session) !== JSON.stringify(nextSession);
    if (!sessionChanged) {
        return state;
    }
    return {
        ...state,
        session: nextSession,
    };
}
export function getPlayerControllerLabel(playerId) {
    return `PLAYER ${playerId.replace("P", "")}`;
}
export function getUnitOwnerLabel(controller) {
    return getPlayerControllerLabel(controller ?? "P1");
}
export function getPlayerColor(state, playerId) {
    return state.players[playerId]?.color ?? (playerId === "P1" ? "#ff8a00" : "#6849c2");
}
export function isLocalCoopActive(state) {
    return state.session.mode === "local_coop" || state.players.P2.active;
}
export function canPlayerUseFieldAction(state, playerId, action) {
    if (playerId === "P1") {
        return true;
    }
    if (!isLocalCoopActive(state)) {
        return true;
    }
    return !LOCAL_COOP_RESTRICTED_FIELD_ACTIONS.has(action);
}
export function getFieldActionRestrictionMessage(actionLabel) {
    return `Player 1 must authorize ${actionLabel}.`;
}
export function setPlayerJoinState(state, playerId, active) {
    if (playerId !== "P2") {
        return state;
    }
    const nextMode = active ? "local_coop" : "singleplayer";
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
export function getTheaterAssignedPlayerSlots(state, squadId) {
    if (!squadId) {
        return [];
    }
    return LOCAL_PLAYER_IDS.filter((slot) => state.players[slot].active && state.session.theaterAssignments?.[slot]?.squadId === squadId);
}
export function assignLocalPlayerToTheaterSquad(state, playerId, squadId) {
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
export function launchCoopOperationsSessionFromLobby(state, lobby) {
    if (lobby.activity.kind !== "coop_operations") {
        return state;
    }
    const activity = lobby.activity.coopOperations;
    const currentSession = state.session ?? createDefaultSessionState(state);
    const selectedSessionSlots = activity.selectedSlots
        .map((slot) => activity.participants[slot]?.sessionSlot)
        .filter((slot) => Boolean(slot));
    const seededSharedPool = createResourcePool(state.wad, state.resources);
    const currentLedger = cloneResourceLedger(currentSession.resourceLedger);
    const activityLedger = cloneResourceLedger(activity.resourceLedger);
    const seededPartitionedPerPlayer = activity.economyPreset === "partitioned"
        ? hasAnyPartitionedAllocations(activityLedger.perPlayer, selectedSessionSlots)
            ? activityLedger.perPlayer
            : currentLedger.preset === "partitioned" && hasAnyPartitionedAllocations(currentLedger.perPlayer, selectedSessionSlots)
                ? currentLedger.perPlayer
                : distributeResourcePoolEvenly(seededSharedPool, selectedSessionSlots)
        : currentLedger.perPlayer;
    const launchedResourceLedger = {
        preset: activity.economyPreset,
        shared: activity.economyPreset === "partitioned"
            ? sumResourcePools(selectedSessionSlots.map((slot) => seededPartitionedPerPlayer[slot]))
            : seededSharedPool,
        perPlayer: activity.economyPreset === "partitioned"
            ? seededPartitionedPerPlayer
            : currentLedger.perPlayer,
    };
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
                callsign: participant.callsign ?? previous.callsign ?? (isLocalParticipant ? state.profile?.callsign ?? null : null),
                presence: isLocalParticipant ? "local" : participant.connected ? "remote" : "disconnected",
                authorityRole: participant.authorityRole,
                connected: participant.connected,
                inputSource: isLocalParticipant ? state.players.P1.inputSource : "remote",
                controlledUnitIds: isLocalParticipant ? [...state.players.P1.controlledUnitIds] : [],
                stagingState: participant.connected ? participant.stagingState : "rejoining",
                currentTheaterId: participant.currentTheaterId,
                assignedSquadId: participant.assignedSquadId,
                activeBattleId: participant.activeBattleId,
                lastSafeRoomId: participant.currentRoomId,
                lastSafeMapId: participant.lastSafeMapId ?? "base_camp",
            }
            : {
                ...previous,
                slot: sessionSlot,
                callsign: previous.callsign ?? null,
                presence: "inactive",
                authorityRole: "client",
                connected: false,
                inputSource: "remote",
                controlledUnitIds: [],
                stagingState: "disconnected",
                currentTheaterId: null,
                assignedSquadId: null,
                activeBattleId: null,
                lastSafeRoomId: null,
                lastSafeMapId: null,
            };
        return acc;
    }, {});
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
    }, {});
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
            sharedCampaignSlot: activity.sharedCampaignSlot ?? currentSession.sharedCampaignSlot ?? null,
            sharedCampaignLabel: activity.sharedCampaignLabel ?? currentSession.sharedCampaignLabel ?? null,
            sharedCampaignLastSavedAt: activity.sharedCampaignLastSavedAt ?? currentSession.sharedCampaignLastSavedAt ?? null,
            activeBattleId: localNetworkSlot
                ? activity.participants[localNetworkSlot]?.activeBattleId ?? null
                : null,
            pendingTheaterBattleConfirmation: clonePendingTheaterBattleConfirmation(localNetworkSlot
                ? activity.participants[localNetworkSlot]?.pendingTheaterBattleConfirmation
                    ?? activity.pendingTheaterBattleConfirmation
                : activity.pendingTheaterBattleConfirmation),
            resourceLedger: launchedResourceLedger,
            pendingTransfers: clonePendingTransfers(activity.pendingTransfers),
            players: nextPlayers,
            theaterAssignments: nextAssignments,
            activeTheaterContexts: cloneTheaterRuntimeContexts(activity.theaterContexts),
            activeBattleContexts: cloneBattleRuntimeContexts(activity.battleContexts),
            campaign: currentSession.campaign ?? createCampaignStateSeed(state.operation?.id ?? null),
        },
    });
}
export function clearCoopOperationsSession(state) {
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
            sharedCampaignSlot: state.session.sharedCampaignSlot ?? null,
            sharedCampaignLabel: state.session.sharedCampaignLabel ?? null,
            sharedCampaignLastSavedAt: state.session.sharedCampaignLastSavedAt ?? null,
            resourceLedger: {
                ...resetSession.resourceLedger,
                shared: createResourcePool(state.wad, state.resources),
            },
            pendingTheaterBattleConfirmation: null,
            activeTheaterContexts: {},
            activeBattleContexts: {},
        },
    });
}
export function getSharedEconomyPreset(state) {
    return state.session.resourceLedger.preset;
}
export function getSessionEconomyParticipantSlots(state) {
    return getEconomyParticipantSlotsFromSession(state.session ?? createDefaultSessionState(state));
}
export function getLocalSessionPlayerSlot(state) {
    return getLocalSessionPlayerSlotFromSession(state.session ?? createDefaultSessionState(state));
}
export function getSessionResourcePool(state, playerId) {
    const session = state.session ?? createDefaultSessionState(state);
    const ledger = cloneResourceLedger(session.resourceLedger);
    return ledger.preset === "shared"
        ? cloneResourcePool(ledger.shared)
        : cloneResourcePool(ledger.perPlayer[playerId]);
}
function resolveSessionEconomyPool(state, playerId) {
    const resolvedPlayerId = playerId ?? getLocalSessionPlayerSlot(state);
    return {
        playerId: resolvedPlayerId,
        pool: getSessionResourcePool(state, resolvedPlayerId),
    };
}
export function canSessionAffordCost(state, cost, playerId) {
    const { pool } = resolveSessionEconomyPool(state, playerId);
    const wadCost = Math.max(0, Math.floor(cost.wad ?? 0));
    return pool.wad >= wadCost && hasEnoughResources(pool.resources, cost.resources);
}
export function spendSessionCost(state, cost, playerId) {
    const currentSession = state.session ?? createDefaultSessionState(state);
    const ledger = cloneResourceLedger(currentSession.resourceLedger);
    const resolvedPlayerId = playerId ?? getLocalSessionPlayerSlotFromSession(currentSession);
    const wadCost = Math.max(0, Math.floor(cost.wad ?? 0));
    const normalizedResourceCost = createEmptyResourceWallet(cost.resources);
    const targetPool = ledger.preset === "shared"
        ? cloneResourcePool(ledger.shared)
        : cloneResourcePool(ledger.perPlayer[resolvedPlayerId]);
    if (targetPool.wad < wadCost || !hasEnoughResources(targetPool.resources, normalizedResourceCost)) {
        return {
            success: false,
            state,
            playerId: resolvedPlayerId,
            pool: targetPool,
            error: "Insufficient funds.",
        };
    }
    const nextTargetPool = {
        wad: Math.max(0, targetPool.wad - wadCost),
        resources: subtractResourceWallet(targetPool.resources, normalizedResourceCost, true),
    };
    if (ledger.preset === "shared") {
        ledger.shared = nextTargetPool;
    }
    else {
        ledger.perPlayer[resolvedPlayerId] = nextTargetPool;
        ledger.shared = sumResourcePools(getEconomyParticipantSlotsFromSession(currentSession).map((slot) => ledger.perPlayer[slot]));
    }
    const nextState = withNormalizedSessionState({
        ...state,
        wad: ledger.shared.wad,
        resources: cloneResourceWallet(ledger.shared.resources),
        session: {
            ...currentSession,
            resourceLedger: ledger,
        },
    });
    return {
        success: true,
        state: nextState,
        playerId: resolvedPlayerId,
        pool: nextTargetPool,
    };
}
export function grantSessionResources(state, reward, playerId) {
    const currentSession = state.session ?? createDefaultSessionState(state);
    const ledger = cloneResourceLedger(currentSession.resourceLedger);
    const resolvedPlayerId = playerId ?? getLocalSessionPlayerSlotFromSession(currentSession);
    const wadGain = Math.max(0, Math.floor(reward.wad ?? 0));
    const normalizedResourceGain = createEmptyResourceWallet(reward.resources);
    if (ledger.preset === "shared") {
        ledger.shared = {
            wad: ledger.shared.wad + wadGain,
            resources: addResourceWallet(ledger.shared.resources, normalizedResourceGain),
        };
    }
    else {
        ledger.perPlayer[resolvedPlayerId] = {
            wad: ledger.perPlayer[resolvedPlayerId].wad + wadGain,
            resources: addResourceWallet(ledger.perPlayer[resolvedPlayerId].resources, normalizedResourceGain),
        };
        ledger.shared = sumResourcePools(getEconomyParticipantSlotsFromSession(currentSession).map((slot) => ledger.perPlayer[slot]));
    }
    return withNormalizedSessionState({
        ...state,
        wad: ledger.shared.wad,
        resources: cloneResourceWallet(ledger.shared.resources),
        session: {
            ...currentSession,
            resourceLedger: ledger,
        },
    });
}
export function setSharedEconomyPreset(state, preset) {
    const currentSession = state.session ?? createDefaultSessionState(state);
    if (currentSession.resourceLedger.preset === preset) {
        return state;
    }
    const currentLedger = cloneResourceLedger(currentSession.resourceLedger);
    const economySlots = getEconomyParticipantSlotsFromSession(currentSession);
    const totalPool = currentLedger.preset === "partitioned"
        ? sumResourcePools(economySlots.map((slot) => currentLedger.perPlayer[slot]))
        : createResourcePool(state.wad, state.resources);
    const nextPendingTransfers = clonePendingTransfers(currentSession.pendingTransfers).map((transfer) => (preset === "shared" && transfer.status === "pending"
        ? {
            ...transfer,
            status: "cancelled",
            note: transfer.note
                ? `${transfer.note} // cancelled when lobby returned to shared economy`
                : "Cancelled when lobby returned to shared economy.",
        }
        : transfer));
    const nextLedger = {
        preset,
        shared: totalPool,
        perPlayer: preset === "partitioned"
            ? distributeResourcePoolEvenly(totalPool, economySlots)
            : currentLedger.perPlayer,
    };
    return withNormalizedSessionState({
        ...state,
        wad: totalPool.wad,
        resources: cloneResourceWallet(totalPool.resources),
        session: {
            ...currentSession,
            resourceLedger: nextLedger,
            pendingTransfers: nextPendingTransfers,
        },
    });
}
export function requestSessionTradeTransfer(state, request) {
    if (request.fromPlayerId === request.toPlayerId) {
        return state;
    }
    const currentSession = state.session ?? createDefaultSessionState(state);
    if (currentSession.resourceLedger.preset !== "partitioned") {
        return state;
    }
    const normalizedWadAmount = Math.max(0, Math.floor(request.wadAmount ?? 0));
    const normalizedResourceAmount = Math.max(0, Math.floor(request.resourceAmount ?? 0));
    if ((request.kind === "wad" && normalizedWadAmount <= 0)
        || (request.kind === "resource" && (!request.resourceKey || normalizedResourceAmount <= 0))) {
        return state;
    }
    const nextTransfers = [
        ...clonePendingTransfers(currentSession.pendingTransfers),
        {
            id: createSessionTradeTransferId(),
            fromPlayerId: request.fromPlayerId,
            toPlayerId: request.toPlayerId,
            kind: request.kind,
            status: "pending",
            createdAt: Date.now(),
            wadAmount: request.kind === "wad" ? normalizedWadAmount : undefined,
            resourceKey: request.kind === "resource" ? request.resourceKey : undefined,
            resourceAmount: request.kind === "resource" ? normalizedResourceAmount : undefined,
            note: request.note?.trim() || undefined,
        },
    ];
    return withNormalizedSessionState({
        ...state,
        session: {
            ...currentSession,
            pendingTransfers: nextTransfers,
        },
    });
}
export function approveSessionTradeTransfer(state, transferId) {
    const currentSession = state.session ?? createDefaultSessionState(state);
    if (currentSession.resourceLedger.preset !== "partitioned") {
        return state;
    }
    const currentTransfer = currentSession.pendingTransfers.find((transfer) => transfer.id === transferId) ?? null;
    if (!currentTransfer || currentTransfer.status !== "pending") {
        return state;
    }
    const nextLedger = cloneResourceLedger(currentSession.resourceLedger);
    const fromPool = cloneResourcePool(nextLedger.perPlayer[currentTransfer.fromPlayerId]);
    const toPool = cloneResourcePool(nextLedger.perPlayer[currentTransfer.toPlayerId]);
    let canComplete = false;
    if (currentTransfer.kind === "wad") {
        const wadAmount = Math.max(0, Math.floor(currentTransfer.wadAmount ?? 0));
        canComplete = wadAmount > 0 && fromPool.wad >= wadAmount;
        if (canComplete) {
            fromPool.wad -= wadAmount;
            toPool.wad += wadAmount;
        }
    }
    else if (currentTransfer.kind === "resource" && currentTransfer.resourceKey) {
        const resourceAmount = Math.max(0, Math.floor(currentTransfer.resourceAmount ?? 0));
        canComplete = resourceAmount > 0 && hasEnoughResources(fromPool.resources, {
            [currentTransfer.resourceKey]: resourceAmount,
        });
        if (canComplete) {
            fromPool.resources = subtractResourceWallet(fromPool.resources, {
                [currentTransfer.resourceKey]: resourceAmount,
            }, true);
            toPool.resources = addResourceWallet(toPool.resources, {
                [currentTransfer.resourceKey]: resourceAmount,
            });
        }
    }
    const nextTransfers = clonePendingTransfers(currentSession.pendingTransfers).map((transfer) => {
        if (transfer.id !== transferId) {
            return transfer;
        }
        const nextStatus = canComplete ? "completed" : "cancelled";
        return {
            ...transfer,
            status: nextStatus,
            note: canComplete
                ? transfer.note
                : transfer.note
                    ? `${transfer.note} // cancelled, insufficient allocation`
                    : "Cancelled, insufficient allocation.",
        };
    });
    if (!canComplete) {
        return withNormalizedSessionState({
            ...state,
            session: {
                ...currentSession,
                pendingTransfers: nextTransfers,
            },
        });
    }
    nextLedger.perPlayer[currentTransfer.fromPlayerId] = fromPool;
    nextLedger.perPlayer[currentTransfer.toPlayerId] = toPool;
    nextLedger.shared = sumResourcePools(getEconomyParticipantSlotsFromSession(currentSession).map((slot) => nextLedger.perPlayer[slot]));
    return withNormalizedSessionState({
        ...state,
        wad: nextLedger.shared.wad,
        resources: cloneResourceWallet(nextLedger.shared.resources),
        session: {
            ...currentSession,
            resourceLedger: nextLedger,
            pendingTransfers: nextTransfers,
        },
    });
}
export function cancelSessionTradeTransfer(state, transferId) {
    const currentSession = state.session ?? createDefaultSessionState(state);
    const nextTransfers = clonePendingTransfers(currentSession.pendingTransfers).map((transfer) => (transfer.id === transferId && transfer.status === "pending"
        ? { ...transfer, status: "cancelled" }
        : transfer));
    return withNormalizedSessionState({
        ...state,
        session: {
            ...currentSession,
            pendingTransfers: nextTransfers,
        },
    });
}
export function describeSessionTradeTransfer(transfer) {
    return `${transfer.fromPlayerId} -> ${transfer.toPlayerId} // ${getTransferAmountLabel(transfer)} // ${transfer.status.toUpperCase()}`;
}

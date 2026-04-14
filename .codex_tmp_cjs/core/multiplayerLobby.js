"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MULTIPLAYER_LOBBY_STORAGE_KEY = exports.MULTIPLAYER_LOBBY_PROTOCOL_VERSION = void 0;
exports.createHostedMultiplayerLobby = createHostedMultiplayerLobby;
exports.createJoiningMultiplayerLobby = createJoiningMultiplayerLobby;
exports.getLobbyMembers = getLobbyMembers;
exports.isLobbyFighterSlot = isLobbyFighterSlot;
exports.shouldRenderLobbyAvatar = shouldRenderLobbyAvatar;
exports.findNextOpenLobbySlot = findNextOpenLobbySlot;
exports.findReconnectableLobbySlot = findReconnectableLobbySlot;
exports.setLobbyLocalSlot = setLobbyLocalSlot;
exports.upsertLobbyMember = upsertLobbyMember;
exports.removeLobbyMember = removeLobbyMember;
exports.markLobbyMemberDisconnected = markLobbyMemberDisconnected;
exports.updateLobbyAvatar = updateLobbyAvatar;
exports.createPendingSkirmishChallenge = createPendingSkirmishChallenge;
exports.updateChallengeStatus = updateChallengeStatus;
exports.clearPendingChallenge = clearPendingChallenge;
exports.createLobbySkirmishActivity = createLobbySkirmishActivity;
exports.updateLobbySkirmishSnapshot = updateLobbySkirmishSnapshot;
exports.updateLobbySkirmishBattlePayload = updateLobbySkirmishBattlePayload;
exports.setLobbySkirmishIntermission = setLobbySkirmishIntermission;
exports.chooseLobbySkirmishNextRoundDecision = chooseLobbySkirmishNextRoundDecision;
exports.advanceLobbySkirmishRound = advanceLobbySkirmishRound;
exports.clearLobbyActivity = clearLobbyActivity;
exports.startCoopOperationsActivity = startCoopOperationsActivity;
exports.updateCoopOperationsSelection = updateCoopOperationsSelection;
exports.setCoopOperationsSharedCampaign = setCoopOperationsSharedCampaign;
exports.setCoopOperationsEconomyState = setCoopOperationsEconomyState;
exports.launchCoopOperationsActivity = launchCoopOperationsActivity;
exports.syncCoopOperationsRuntime = syncCoopOperationsRuntime;
exports.getLobbyLocalSkirmishMatch = getLobbyLocalSkirmishMatch;
exports.createLobbyPlaylist = createLobbyPlaylist;
exports.saveLobbyState = saveLobbyState;
exports.loadLobbyState = loadLobbyState;
exports.clearLobbyState = clearLobbyState;
exports.createResumableCoopOperationsLobby = createResumableCoopOperationsLobby;
exports.withNormalizedLobbyState = withNormalizedLobbyState;
exports.createSkirmishMatchFromPlaylist = createSkirmishMatchFromPlaylist;
exports.getActiveLobbyPlaylistRound = getActiveLobbyPlaylistRound;
exports.getDefaultLobbyPlaylist = getDefaultLobbyPlaylist;
const types_1 = require("./types");
const resources_1 = require("./resources");
const squadOnline_1 = require("./squadOnline");
exports.MULTIPLAYER_LOBBY_PROTOCOL_VERSION = 1;
exports.MULTIPLAYER_LOBBY_STORAGE_KEY = "chaos_core_multiplayer_lobby";
function createNetworkSlotRecord(factory) {
    return types_1.NETWORK_PLAYER_SLOTS.reduce((acc, slot) => {
        acc[slot] = factory(slot);
        return acc;
    }, {});
}
function createResourcePool(wad = 0, resources = (0, resources_1.createEmptyResourceWallet)()) {
    return {
        wad,
        resources: (0, resources_1.createEmptyResourceWallet)(resources),
    };
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
        shared: createResourcePool(ledger?.shared?.wad ?? 0, ledger?.shared?.resources),
        perPlayer: types_1.SESSION_PLAYER_SLOTS.reduce((acc, slot) => {
            acc[slot] = createResourcePool(ledger?.perPlayer?.[slot]?.wad ?? 0, ledger?.perPlayer?.[slot]?.resources);
            return acc;
        }, {}),
    };
}
function createLobbyMember(slot, callsign, authorityRole, presence) {
    const now = Date.now();
    return {
        slot,
        callsign: callsign.trim() || slot,
        presence,
        authorityRole,
        connected: presence !== "disconnected" && presence !== "inactive",
        joinedAt: now,
        lastHeartbeatAt: now,
    };
}
function createJoinCode(lobbyId) {
    return lobbyId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
}
function createLobbyId(prefix) {
    return `${prefix}_${Date.now().toString(36)}`;
}
function normalizeTransportState(value) {
    return value ?? "closed";
}
function cloneRound(round) {
    return {
        id: round.id,
        gridWidth: round.gridWidth,
        gridHeight: round.gridHeight,
        objectiveType: round.objectiveType,
    };
}
function clonePlaylist(playlist) {
    return {
        rounds: playlist.rounds.map(cloneRound),
    };
}
function cloneChallenge(challenge) {
    if (!challenge) {
        return null;
    }
    return {
        ...challenge,
        playlist: clonePlaylist(challenge.playlist),
    };
}
function cloneReturnContext(returnContext) {
    if (!returnContext) {
        return null;
    }
    if (returnContext.kind === "field") {
        return { ...returnContext };
    }
    return { kind: returnContext.kind };
}
function getCoopParticipantSessionSlot(selectedSlots, slot) {
    const index = selectedSlots.indexOf(slot);
    if (index < 0) {
        return null;
    }
    return types_1.SESSION_PLAYER_SLOTS[index] ?? null;
}
function cloneCoopParticipant(participant, slot) {
    return {
        slot,
        callsign: participant?.callsign ?? slot,
        authorityRole: participant?.authorityRole ?? "client",
        selected: participant?.selected ?? false,
        standby: participant?.standby ?? false,
        connected: participant?.connected ?? false,
        presence: participant?.presence ?? "inactive",
        sessionSlot: participant?.sessionSlot ?? null,
        stagingState: participant?.stagingState ?? "disconnected",
        lastSafeMapId: participant?.lastSafeMapId ?? null,
        currentTheaterId: participant?.currentTheaterId ?? null,
        assignedSquadId: participant?.assignedSquadId ?? null,
        activeBattleId: participant?.activeBattleId ?? null,
        currentRoomId: participant?.currentRoomId ?? null,
        operationPhase: participant?.operationPhase ?? null,
        theaterSnapshot: participant?.theaterSnapshot ?? null,
        battleSnapshot: participant?.battleSnapshot ?? null,
        pendingTheaterBattleConfirmation: clonePendingTheaterBattleConfirmation(participant?.pendingTheaterBattleConfirmation),
    };
}
function cloneSeatPreference(value) {
    return value === "ready" || value === "lounge" ? value : null;
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
function buildCoopParticipants(members, hostSlot, selectedSlots, operatorSlots, standbySlots, status, existing) {
    const normalizedSelectedSlots = selectedSlots.filter((slot, index, all) => Boolean(members[slot]) && all.indexOf(slot) === index);
    const normalizedOperatorSlots = operatorSlots.filter((slot, index, all) => normalizedSelectedSlots.includes(slot) && all.indexOf(slot) === index);
    const normalizedStandbySlots = standbySlots.filter((slot, index, all) => normalizedSelectedSlots.includes(slot) && !normalizedOperatorSlots.includes(slot) && all.indexOf(slot) === index);
    return createNetworkSlotRecord((slot) => {
        const member = members[slot];
        const previous = existing?.[slot];
        const selected = normalizedSelectedSlots.includes(slot);
        const standby = normalizedStandbySlots.includes(slot);
        const sessionSlot = selected && !standby ? getCoopParticipantSessionSlot(normalizedOperatorSlots, slot) : null;
        let stagingState = previous?.stagingState ?? (member?.connected ? "haven" : "disconnected");
        if (selected) {
            if (!member?.connected) {
                stagingState = status === "active" || previous?.stagingState === "battle" ? "rejoining" : "disconnected";
            }
            else if (standby) {
                stagingState = status === "active" ? "haven" : "staging";
            }
            else if (status === "active") {
                stagingState = previous?.stagingState === "battle" || previous?.stagingState === "theater"
                    ? previous.stagingState
                    : "haven";
            }
            else {
                stagingState = "staging";
            }
        }
        const lastSafeMapId = selected && status === "active"
            ? previous?.lastSafeMapId && previous.lastSafeMapId !== "network_lobby"
                ? previous.lastSafeMapId
                : "base_camp"
            : previous?.lastSafeMapId ?? (status === "active" ? "base_camp" : "network_lobby");
        return {
            slot,
            callsign: member?.callsign ?? previous?.callsign ?? slot,
            authorityRole: member?.authorityRole ?? previous?.authorityRole ?? (slot === hostSlot ? "host" : "client"),
            selected,
            standby,
            connected: member?.connected ?? false,
            presence: member?.presence ?? previous?.presence ?? "inactive",
            sessionSlot,
            stagingState,
            lastSafeMapId,
            currentTheaterId: previous?.currentTheaterId ?? null,
            assignedSquadId: previous?.assignedSquadId ?? null,
            activeBattleId: previous?.activeBattleId ?? null,
            currentRoomId: previous?.currentRoomId ?? null,
            operationPhase: previous?.operationPhase ?? null,
            theaterSnapshot: previous?.theaterSnapshot ?? null,
            battleSnapshot: previous?.battleSnapshot ?? null,
            pendingTheaterBattleConfirmation: clonePendingTheaterBattleConfirmation(previous?.pendingTheaterBattleConfirmation),
        };
    });
}
function normalizeCoopSelection(members, hostSlot, selectedSlots) {
    const normalizedSelectedSlots = [hostSlot, ...selectedSlots].filter((slot, index, all) => Boolean(members[slot]) && all.indexOf(slot) === index);
    return {
        selectedSlots: normalizedSelectedSlots,
        operatorSlots: normalizedSelectedSlots.slice(0, types_1.SESSION_PLAYER_SLOTS.length),
        standbySlots: normalizedSelectedSlots.slice(types_1.SESSION_PLAYER_SLOTS.length),
    };
}
function normalizeCoopOperationsActivity(activity, members, hostSlot) {
    const selection = normalizeCoopSelection(members, hostSlot, activity.selectedSlots);
    return {
        ...activity,
        selectedSlots: selection.selectedSlots,
        standbySlots: selection.standbySlots,
        sharedCampaignSlot: activity.sharedCampaignSlot ?? null,
        sharedCampaignLabel: activity.sharedCampaignLabel ?? null,
        sharedCampaignLastSavedAt: activity.sharedCampaignLastSavedAt ?? null,
        economyPreset: activity.economyPreset ?? "shared",
        resourceLedger: cloneResourceLedger(activity.resourceLedger),
        pendingTransfers: clonePendingTransfers(activity.pendingTransfers),
        sessionId: activity.sessionId ?? null,
        theaterContexts: cloneTheaterRuntimeContexts(activity.theaterContexts),
        battleContexts: cloneBattleRuntimeContexts(activity.battleContexts),
        operationSnapshot: activity.operationSnapshot ?? null,
        battleSnapshot: activity.battleSnapshot ?? null,
        operationPhase: activity.operationPhase ?? null,
        pendingTheaterBattleConfirmation: clonePendingTheaterBattleConfirmation(activity.pendingTheaterBattleConfirmation),
        launchedAt: activity.launchedAt ?? null,
        participants: buildCoopParticipants(members, hostSlot, selection.selectedSlots, selection.operatorSlots, selection.standbySlots, activity.status, activity.participants),
    };
}
function cloneSkirmishActivity(activity) {
    return {
        ...activity,
        playlist: clonePlaylist(activity.playlist),
    };
}
function normalizeSkirmishStatus(match) {
    return match.phase === "lobby" ? "draft" : match.phase;
}
function cloneActivity(activity) {
    if (!activity || activity.kind === "idle") {
        return { kind: "idle" };
    }
    if (activity.kind === "skirmish") {
        return {
            kind: "skirmish",
            skirmish: cloneSkirmishActivity(activity.skirmish),
        };
    }
    return {
        kind: "coop_operations",
        coopOperations: {
            ...activity.coopOperations,
            selectedSlots: [...activity.coopOperations.selectedSlots],
            standbySlots: [...(activity.coopOperations.standbySlots ?? [])],
            sessionId: activity.coopOperations.sessionId ?? null,
            economyPreset: activity.coopOperations.economyPreset ?? "shared",
            resourceLedger: cloneResourceLedger(activity.coopOperations.resourceLedger),
            pendingTransfers: clonePendingTransfers(activity.coopOperations.pendingTransfers),
            participants: createNetworkSlotRecord((slot) => cloneCoopParticipant(activity.coopOperations.participants?.[slot], slot)),
            theaterContexts: cloneTheaterRuntimeContexts(activity.coopOperations.theaterContexts),
            battleContexts: cloneBattleRuntimeContexts(activity.coopOperations.battleContexts),
            operationSnapshot: activity.coopOperations.operationSnapshot ?? null,
            battleSnapshot: activity.coopOperations.battleSnapshot ?? null,
            operationPhase: activity.coopOperations.operationPhase ?? null,
            pendingTheaterBattleConfirmation: clonePendingTheaterBattleConfirmation(activity.coopOperations.pendingTheaterBattleConfirmation),
            launchedAt: activity.coopOperations.launchedAt ?? null,
        },
    };
}
function normalizeObjectiveType(objectiveType) {
    if (objectiveType === "control_relay" || objectiveType === "breakthrough") {
        return objectiveType;
    }
    if (objectiveType === "objective") {
        return "control_relay";
    }
    return "elimination";
}
function createDefaultPlaylist() {
    return {
        rounds: [
            {
                id: `round_${Date.now().toString(36)}`,
                gridWidth: 8,
                gridHeight: 5,
                objectiveType: "elimination",
                mapId: "builtin_bunker_breach",
            },
        ],
    };
}
function createHostedMultiplayerLobby(callsign, returnContext = null) {
    const lobbyId = createLobbyId("lobby");
    const hostSlot = "P1";
    return {
        protocolVersion: exports.MULTIPLAYER_LOBBY_PROTOCOL_VERSION,
        lobbyId,
        joinCode: createJoinCode(lobbyId),
        hostSlot,
        localSlot: hostSlot,
        returnContext: cloneReturnContext(returnContext),
        transportState: "hosting",
        members: createNetworkSlotRecord((slot) => slot === hostSlot ? createLobbyMember(hostSlot, callsign, "host", "local") : null),
        avatars: createNetworkSlotRecord(() => null),
        pendingChallenge: null,
        activity: { kind: "idle" },
        updatedAt: Date.now(),
    };
}
function createJoiningMultiplayerLobby(callsign, returnContext = null) {
    const lobbyId = createLobbyId("joining");
    const localSlot = "P2";
    return {
        protocolVersion: exports.MULTIPLAYER_LOBBY_PROTOCOL_VERSION,
        lobbyId,
        joinCode: createJoinCode(lobbyId),
        hostSlot: "P1",
        localSlot,
        returnContext: cloneReturnContext(returnContext),
        transportState: "joining",
        members: createNetworkSlotRecord((slot) => slot === localSlot ? createLobbyMember(slot, callsign, "client", "local") : null),
        avatars: createNetworkSlotRecord(() => null),
        pendingChallenge: null,
        activity: { kind: "idle" },
        updatedAt: Date.now(),
    };
}
function getLobbyMembers(lobby) {
    if (!lobby) {
        return [];
    }
    return types_1.NETWORK_PLAYER_SLOTS.map((slot) => lobby.members[slot]).filter((member) => Boolean(member));
}
function isLobbyFighterSlot(lobby, slot) {
    if (!lobby || !slot || lobby.activity.kind !== "skirmish") {
        return false;
    }
    return lobby.activity.skirmish.challengerSlot === slot || lobby.activity.skirmish.challengeeSlot === slot;
}
function shouldRenderLobbyAvatar(lobby, slot) {
    const member = lobby?.members[slot];
    if (!member || !member.connected || member.presence === "disconnected") {
        return false;
    }
    if (lobby?.activity.kind === "skirmish" && isLobbyFighterSlot(lobby, slot)) {
        return false;
    }
    return true;
}
function findNextOpenLobbySlot(lobby) {
    return types_1.NETWORK_PLAYER_SLOTS.find((slot) => !lobby.members[slot]) ?? null;
}
function findReconnectableLobbySlot(lobby, callsign) {
    const normalized = callsign.trim().toLowerCase();
    return types_1.NETWORK_PLAYER_SLOTS.find((slot) => {
        const member = lobby.members[slot];
        return Boolean(member && !member.connected && member.callsign.trim().toLowerCase() === normalized);
    }) ?? null;
}
function setLobbyLocalSlot(lobby, slot) {
    return {
        ...lobby,
        localSlot: slot,
        updatedAt: Date.now(),
    };
}
function upsertLobbyMember(lobby, slot, callsign, authorityRole, presence) {
    const now = Date.now();
    const existing = lobby.members[slot];
    const nextMembers = {
        ...lobby.members,
        [slot]: {
            ...(existing ?? createLobbyMember(slot, callsign, authorityRole, presence)),
            slot,
            callsign: callsign.trim() || existing?.callsign || slot,
            authorityRole,
            presence,
            connected: presence !== "disconnected" && presence !== "inactive",
            lastHeartbeatAt: now,
        },
    };
    return {
        ...lobby,
        members: nextMembers,
        activity: lobby.activity.kind === "coop_operations"
            ? {
                kind: "coop_operations",
                coopOperations: normalizeCoopOperationsActivity(lobby.activity.coopOperations, nextMembers, lobby.hostSlot),
            }
            : lobby.activity,
        updatedAt: now,
    };
}
function removeLobbyMember(lobby, slot) {
    if (slot === lobby.hostSlot) {
        return lobby;
    }
    const nextMembers = {
        ...lobby.members,
        [slot]: null,
    };
    const nextAvatars = {
        ...lobby.avatars,
        [slot]: null,
    };
    return {
        ...lobby,
        members: nextMembers,
        avatars: nextAvatars,
        activity: lobby.activity.kind === "coop_operations"
            ? {
                kind: "coop_operations",
                coopOperations: normalizeCoopOperationsActivity(lobby.activity.coopOperations, nextMembers, lobby.hostSlot),
            }
            : lobby.activity,
        updatedAt: Date.now(),
    };
}
function markLobbyMemberDisconnected(lobby, slot) {
    const member = lobby.members[slot];
    if (!member) {
        return lobby;
    }
    const nextMembers = {
        ...lobby.members,
        [slot]: {
            ...member,
            connected: false,
            presence: "disconnected",
            lastHeartbeatAt: Date.now(),
        },
    };
    return {
        ...lobby,
        members: nextMembers,
        activity: lobby.activity.kind === "coop_operations"
            ? {
                kind: "coop_operations",
                coopOperations: normalizeCoopOperationsActivity(lobby.activity.coopOperations, nextMembers, lobby.hostSlot),
            }
            : lobby.activity,
        updatedAt: Date.now(),
    };
}
function updateLobbyAvatar(lobby, slot, avatar) {
    const coopOperations = lobby.activity.kind === "coop_operations" ? lobby.activity.coopOperations : null;
    const nextActivity = coopOperations
        ? {
            kind: "coop_operations",
            coopOperations: {
                ...coopOperations,
                participants: createNetworkSlotRecord((playerSlot) => {
                    const participant = cloneCoopParticipant(coopOperations.participants?.[playerSlot], playerSlot);
                    if (playerSlot !== slot || !avatar || !participant.selected) {
                        return participant;
                    }
                    return {
                        ...participant,
                        lastSafeMapId: avatar.mapId ?? participant.lastSafeMapId,
                    };
                }),
            },
        }
        : lobby.activity;
    return {
        ...lobby,
        avatars: {
            ...lobby.avatars,
            [slot]: avatar
                ? {
                    ...avatar,
                    mapId: avatar.mapId ?? null,
                    seatPreference: cloneSeatPreference(avatar.seatPreference),
                }
                : null,
        },
        activity: nextActivity,
        updatedAt: Date.now(),
    };
}
function createPendingSkirmishChallenge(lobby, challengerSlot, challengeeSlot, playlist) {
    const challengerCallsign = lobby.members[challengerSlot]?.callsign ?? challengerSlot;
    const challengeeCallsign = lobby.members[challengeeSlot]?.callsign ?? challengeeSlot;
    const now = Date.now();
    return {
        ...lobby,
        pendingChallenge: {
            challengeId: createLobbyId("challenge"),
            challengerSlot,
            challengeeSlot,
            challengerCallsign,
            challengeeCallsign,
            playlist: clonePlaylist(playlist),
            status: "pending",
            createdAt: now,
            updatedAt: now,
        },
        updatedAt: now,
    };
}
function updateChallengeStatus(lobby, status) {
    if (!lobby.pendingChallenge) {
        return lobby;
    }
    return {
        ...lobby,
        pendingChallenge: {
            ...lobby.pendingChallenge,
            status,
            updatedAt: Date.now(),
        },
        updatedAt: Date.now(),
    };
}
function clearPendingChallenge(lobby) {
    if (!lobby.pendingChallenge) {
        return lobby;
    }
    return {
        ...lobby,
        pendingChallenge: null,
        updatedAt: Date.now(),
    };
}
function createLobbySkirmishActivity(lobby, playlist, match) {
    const now = Date.now();
    const challengerSlot = lobby.pendingChallenge?.challengerSlot ?? lobby.localSlot ?? "P1";
    const challengeeSlot = lobby.pendingChallenge?.challengeeSlot ?? "P2";
    const challengerCallsign = lobby.members[challengerSlot]?.callsign ?? challengerSlot;
    const challengeeCallsign = lobby.members[challengeeSlot]?.callsign ?? challengeeSlot;
    return {
        ...lobby,
        pendingChallenge: null,
        activity: {
            kind: "skirmish",
            skirmish: {
                activityId: createLobbyId("skirmish"),
                challengerSlot,
                challengeeSlot,
                challengerCallsign,
                challengeeCallsign,
                playlist: clonePlaylist(playlist),
                currentRoundIndex: 0,
                status: normalizeSkirmishStatus(match),
                matchSnapshot: (0, squadOnline_1.serializeSquadMatchSnapshot)(match),
                activeBattlePayload: null,
                nextRoundDecision: null,
                createdAt: now,
                updatedAt: now,
            },
        },
        updatedAt: now,
    };
}
function updateLobbySkirmishSnapshot(lobby, match) {
    if (lobby.activity.kind !== "skirmish") {
        return lobby;
    }
    return {
        ...lobby,
        activity: {
            kind: "skirmish",
            skirmish: {
                ...lobby.activity.skirmish,
                status: normalizeSkirmishStatus(match),
                matchSnapshot: (0, squadOnline_1.serializeSquadMatchSnapshot)(match),
                updatedAt: Date.now(),
            },
        },
        updatedAt: Date.now(),
    };
}
function updateLobbySkirmishBattlePayload(lobby, battlePayload) {
    if (lobby.activity.kind !== "skirmish") {
        return lobby;
    }
    return {
        ...lobby,
        activity: {
            kind: "skirmish",
            skirmish: {
                ...lobby.activity.skirmish,
                activeBattlePayload: battlePayload,
                status: battlePayload ? "battle" : lobby.activity.skirmish.status,
                updatedAt: Date.now(),
            },
        },
        updatedAt: Date.now(),
    };
}
function setLobbySkirmishIntermission(lobby, match) {
    if (lobby.activity.kind !== "skirmish") {
        return lobby;
    }
    return {
        ...lobby,
        activity: {
            kind: "skirmish",
            skirmish: {
                ...lobby.activity.skirmish,
                status: "intermission",
                matchSnapshot: (0, squadOnline_1.serializeSquadMatchSnapshot)(match),
                activeBattlePayload: null,
                nextRoundDecision: null,
                updatedAt: Date.now(),
            },
        },
        updatedAt: Date.now(),
    };
}
function chooseLobbySkirmishNextRoundDecision(lobby, decision) {
    if (lobby.activity.kind !== "skirmish") {
        return lobby;
    }
    return {
        ...lobby,
        activity: {
            kind: "skirmish",
            skirmish: {
                ...lobby.activity.skirmish,
                nextRoundDecision: decision,
                updatedAt: Date.now(),
            },
        },
        updatedAt: Date.now(),
    };
}
function advanceLobbySkirmishRound(lobby, match) {
    if (lobby.activity.kind !== "skirmish") {
        return lobby;
    }
    const nextRoundIndex = lobby.activity.skirmish.currentRoundIndex + 1;
    return {
        ...lobby,
        activity: {
            kind: "skirmish",
            skirmish: {
                ...lobby.activity.skirmish,
                currentRoundIndex: nextRoundIndex,
                status: normalizeSkirmishStatus(match),
                matchSnapshot: (0, squadOnline_1.serializeSquadMatchSnapshot)(match),
                activeBattlePayload: null,
                nextRoundDecision: null,
                updatedAt: Date.now(),
            },
        },
        updatedAt: Date.now(),
    };
}
function clearLobbyActivity(lobby) {
    if (lobby.activity.kind === "idle" && !lobby.pendingChallenge) {
        return lobby;
    }
    return {
        ...lobby,
        pendingChallenge: null,
        activity: { kind: "idle" },
        updatedAt: Date.now(),
    };
}
function startCoopOperationsActivity(lobby, selectedSlots) {
    const now = Date.now();
    const normalizedSlots = [
        lobby.hostSlot,
        ...selectedSlots,
    ].filter((slot, index, all) => Boolean(lobby.members[slot]?.connected) && all.indexOf(slot) === index);
    const selection = normalizeCoopSelection(lobby.members, lobby.hostSlot, normalizedSlots);
    return {
        ...lobby,
        pendingChallenge: null,
        activity: {
            kind: "coop_operations",
            coopOperations: {
                activityId: createLobbyId("coop"),
                sessionId: null,
                status: "staging",
                selectedSlots: selection.selectedSlots,
                standbySlots: selection.standbySlots,
                sharedCampaignSlot: null,
                sharedCampaignLabel: null,
                sharedCampaignLastSavedAt: null,
                economyPreset: "shared",
                resourceLedger: cloneResourceLedger(null),
                pendingTransfers: [],
                participants: buildCoopParticipants(lobby.members, lobby.hostSlot, selection.selectedSlots, selection.operatorSlots, selection.standbySlots, "staging"),
                theaterContexts: {},
                battleContexts: {},
                operationSnapshot: null,
                battleSnapshot: null,
                operationPhase: null,
                pendingTheaterBattleConfirmation: null,
                createdAt: now,
                launchedAt: null,
                updatedAt: now,
            },
        },
        updatedAt: now,
    };
}
function updateCoopOperationsSelection(lobby, selectedSlots) {
    if (lobby.activity.kind !== "coop_operations") {
        return lobby;
    }
    const normalizedSlots = [
        lobby.hostSlot,
        ...selectedSlots,
    ].filter((slot, index, all) => Boolean(lobby.members[slot]?.connected) && all.indexOf(slot) === index);
    const selection = normalizeCoopSelection(lobby.members, lobby.hostSlot, normalizedSlots);
    return {
        ...lobby,
        activity: {
            kind: "coop_operations",
            coopOperations: {
                ...lobby.activity.coopOperations,
                selectedSlots: selection.selectedSlots,
                standbySlots: selection.standbySlots,
                resourceLedger: cloneResourceLedger(lobby.activity.coopOperations.resourceLedger),
                pendingTransfers: clonePendingTransfers(lobby.activity.coopOperations.pendingTransfers),
                participants: buildCoopParticipants(lobby.members, lobby.hostSlot, selection.selectedSlots, selection.operatorSlots, selection.standbySlots, lobby.activity.coopOperations.status, lobby.activity.coopOperations.participants),
                theaterContexts: cloneTheaterRuntimeContexts(lobby.activity.coopOperations.theaterContexts),
                battleContexts: cloneBattleRuntimeContexts(lobby.activity.coopOperations.battleContexts),
                operationSnapshot: lobby.activity.coopOperations.operationSnapshot ?? null,
                battleSnapshot: lobby.activity.coopOperations.battleSnapshot ?? null,
                operationPhase: lobby.activity.coopOperations.operationPhase ?? null,
                pendingTheaterBattleConfirmation: clonePendingTheaterBattleConfirmation(lobby.activity.coopOperations.pendingTheaterBattleConfirmation),
                updatedAt: Date.now(),
            },
        },
        updatedAt: Date.now(),
    };
}
function setCoopOperationsSharedCampaign(lobby, sharedCampaignSlot, sharedCampaignLabel, sharedCampaignLastSavedAt = null) {
    if (lobby.activity.kind !== "coop_operations") {
        return lobby;
    }
    return {
        ...lobby,
        activity: {
            kind: "coop_operations",
            coopOperations: {
                ...lobby.activity.coopOperations,
                sharedCampaignSlot,
                sharedCampaignLabel,
                sharedCampaignLastSavedAt,
                updatedAt: Date.now(),
            },
        },
        updatedAt: Date.now(),
    };
}
function setCoopOperationsEconomyState(lobby, options) {
    if (lobby.activity.kind !== "coop_operations") {
        return lobby;
    }
    return {
        ...lobby,
        activity: {
            kind: "coop_operations",
            coopOperations: {
                ...lobby.activity.coopOperations,
                economyPreset: options.economyPreset ?? lobby.activity.coopOperations.economyPreset,
                resourceLedger: options.resourceLedger
                    ? cloneResourceLedger(options.resourceLedger)
                    : cloneResourceLedger(lobby.activity.coopOperations.resourceLedger),
                pendingTransfers: options.pendingTransfers
                    ? clonePendingTransfers(options.pendingTransfers)
                    : clonePendingTransfers(lobby.activity.coopOperations.pendingTransfers),
                updatedAt: Date.now(),
            },
        },
        updatedAt: Date.now(),
    };
}
function launchCoopOperationsActivity(lobby, options = {}) {
    if (lobby.activity.kind !== "coop_operations") {
        return lobby;
    }
    const now = Date.now();
    return {
        ...lobby,
        activity: {
            kind: "coop_operations",
            coopOperations: normalizeCoopOperationsActivity({
                ...lobby.activity.coopOperations,
                sessionId: options.sessionId ?? lobby.activity.coopOperations.sessionId ?? createLobbyId("coop_session"),
                sharedCampaignSlot: lobby.activity.coopOperations.sharedCampaignSlot ?? null,
                sharedCampaignLabel: lobby.activity.coopOperations.sharedCampaignLabel ?? null,
                sharedCampaignLastSavedAt: lobby.activity.coopOperations.sharedCampaignLastSavedAt ?? null,
                economyPreset: options.economyPreset ?? lobby.activity.coopOperations.economyPreset ?? "shared",
                resourceLedger: cloneResourceLedger(lobby.activity.coopOperations.resourceLedger),
                pendingTransfers: clonePendingTransfers(lobby.activity.coopOperations.pendingTransfers),
                status: "active",
                theaterContexts: cloneTheaterRuntimeContexts(lobby.activity.coopOperations.theaterContexts),
                battleContexts: cloneBattleRuntimeContexts(lobby.activity.coopOperations.battleContexts),
                operationSnapshot: lobby.activity.coopOperations.operationSnapshot ?? null,
                battleSnapshot: lobby.activity.coopOperations.battleSnapshot ?? null,
                operationPhase: lobby.activity.coopOperations.operationPhase ?? null,
                pendingTheaterBattleConfirmation: clonePendingTheaterBattleConfirmation(lobby.activity.coopOperations.pendingTheaterBattleConfirmation),
                launchedAt: lobby.activity.coopOperations.launchedAt ?? now,
                updatedAt: now,
            }, lobby.members, lobby.hostSlot),
        },
        updatedAt: now,
    };
}
function syncCoopOperationsRuntime(lobby, state) {
    if (lobby.activity.kind !== "coop_operations") {
        return lobby;
    }
    const activity = lobby.activity.coopOperations;
    const nextOperationSnapshot = state.session.mode === "coop_operations" && state.operation
        ? JSON.stringify(state.operation)
        : null;
    const nextBattleSnapshot = state.session.mode === "coop_operations" && state.currentBattle
        ? JSON.stringify(state.currentBattle)
        : null;
    const nextBattleContexts = cloneBattleRuntimeContexts(state.session.mode === "coop_operations"
        ? state.session.activeBattleContexts
        : activity.battleContexts);
    const nextOperationPhase = state.session.mode === "coop_operations" && (state.operation || state.currentBattle)
        ? state.phase
        : null;
    const nextPendingTheaterBattleConfirmation = state.session.mode === "coop_operations"
        ? clonePendingTheaterBattleConfirmation(state.session.pendingTheaterBattleConfirmation)
        : null;
    const nextTheaterContexts = cloneTheaterRuntimeContexts(state.session.mode === "coop_operations"
        ? state.session.activeTheaterContexts
        : activity.theaterContexts);
    const activeTheater = state.session.mode === "coop_operations" ? state.operation?.theater ?? null : null;
    const activeBattle = state.session.mode === "coop_operations" ? state.currentBattle ?? null : null;
    if (activeBattle?.id && nextBattleSnapshot) {
        nextBattleContexts[activeBattle.id] = {
            battleId: activeBattle.id,
            theaterId: activeBattle.theaterMeta?.theaterId ?? null,
            roomId: activeBattle.theaterMeta?.roomId ?? activeBattle.roomId ?? null,
            squadId: activeBattle.theaterBonuses?.squadId
                ?? activeBattle.theaterMeta?.squadId
                ?? null,
            snapshot: nextBattleSnapshot,
            phase: activeBattle.phase ?? null,
            updatedAt: Date.now(),
        };
    }
    const activeBattleSquadId = activeBattle?.theaterBonuses?.squadId
        ?? activeBattle?.theaterMeta?.squadId
        ?? nextPendingTheaterBattleConfirmation?.squadId
        ?? null;
    const nextParticipants = createNetworkSlotRecord((slot) => {
        const participant = cloneCoopParticipant(activity.participants?.[slot], slot);
        if (!participant.selected || !participant.sessionSlot) {
            return participant;
        }
        const sessionPlayer = state.session.players?.[participant.sessionSlot];
        if (!sessionPlayer) {
            return participant;
        }
        const assignment = state.session.theaterAssignments?.[participant.sessionSlot] ?? null;
        const theaterContext = assignment?.theaterId ? nextTheaterContexts[assignment.theaterId] ?? null : null;
        const battleContext = sessionPlayer.activeBattleId
            ? nextBattleContexts[sessionPlayer.activeBattleId] ?? null
            : null;
        const assignmentRoomId = assignment?.roomId
            ?? sessionPlayer.lastSafeRoomId
            ?? activeTheater?.currentRoomId
            ?? null;
        const assignmentSquadId = assignment?.squadId ?? sessionPlayer.assignedSquadId ?? null;
        const participantTheaterSnapshot = theaterContext?.snapshot ?? (activeTheater
            ? JSON.stringify({
                ...activeTheater,
                currentRoomId: assignmentRoomId ?? activeTheater.currentRoomId,
                selectedRoomId: assignmentRoomId ?? activeTheater.selectedRoomId,
                currentNodeId: assignmentRoomId ?? activeTheater.currentNodeId ?? activeTheater.currentRoomId,
                selectedNodeId: assignmentRoomId ?? activeTheater.selectedNodeId ?? activeTheater.selectedRoomId,
                selectedSquadId: assignmentSquadId ?? activeTheater.selectedSquadId,
            })
            : null);
        const participantBattleSnapshot = battleContext?.snapshot
            ?? theaterContext?.battleSnapshot
            ?? (activeBattle && assignmentSquadId && activeBattleSquadId === assignmentSquadId
                ? JSON.stringify(activeBattle)
                : null);
        const participantActiveBattleId = sessionPlayer.activeBattleId
            ?? battleContext?.battleId
            ?? (activeBattle && assignmentSquadId && activeBattleSquadId === assignmentSquadId
                ? activeBattle.id
                : null);
        const participantPendingTheaterBattleConfirmation = clonePendingTheaterBattleConfirmation(theaterContext?.pendingTheaterBattleConfirmation)
            ?? (nextPendingTheaterBattleConfirmation
                && (!nextPendingTheaterBattleConfirmation.squadId || nextPendingTheaterBattleConfirmation.squadId === assignmentSquadId)
                ? clonePendingTheaterBattleConfirmation(nextPendingTheaterBattleConfirmation)
                : null);
        const participantOperationPhase = participantBattleSnapshot
            ? "battle"
            : sessionPlayer.stagingState === "theater"
                ? "operation"
                : theaterContext?.phase ?? nextOperationPhase;
        return {
            ...participant,
            connected: sessionPlayer.connected,
            presence: sessionPlayer.presence,
            authorityRole: sessionPlayer.authorityRole,
            stagingState: sessionPlayer.stagingState,
            lastSafeMapId: sessionPlayer.lastSafeMapId ?? participant.lastSafeMapId,
            currentTheaterId: assignment?.theaterId ?? sessionPlayer.currentTheaterId ?? participant.currentTheaterId,
            assignedSquadId: assignmentSquadId,
            activeBattleId: participantActiveBattleId,
            currentRoomId: assignmentRoomId,
            operationPhase: participantOperationPhase,
            theaterSnapshot: participantTheaterSnapshot,
            battleSnapshot: participantBattleSnapshot,
            pendingTheaterBattleConfirmation: participantPendingTheaterBattleConfirmation,
        };
    });
    const nextLobby = {
        ...lobby,
        activity: {
            kind: "coop_operations",
            coopOperations: {
                ...activity,
                sharedCampaignSlot: state.session.sharedCampaignSlot ?? activity.sharedCampaignSlot ?? null,
                sharedCampaignLabel: state.session.sharedCampaignLabel ?? activity.sharedCampaignLabel ?? null,
                sharedCampaignLastSavedAt: state.session.sharedCampaignLastSavedAt ?? activity.sharedCampaignLastSavedAt ?? null,
                economyPreset: state.session.resourceLedger?.preset ?? activity.economyPreset ?? "shared",
                resourceLedger: state.session.mode === "coop_operations"
                    ? cloneResourceLedger(state.session.resourceLedger)
                    : cloneResourceLedger(activity.resourceLedger),
                pendingTransfers: state.session.mode === "coop_operations"
                    ? clonePendingTransfers(state.session.pendingTransfers)
                    : clonePendingTransfers(activity.pendingTransfers),
                theaterContexts: nextTheaterContexts,
                battleContexts: nextBattleContexts,
                operationSnapshot: nextOperationSnapshot,
                battleSnapshot: nextBattleSnapshot,
                operationPhase: nextOperationPhase,
                pendingTheaterBattleConfirmation: nextPendingTheaterBattleConfirmation,
                participants: nextParticipants,
                updatedAt: Date.now(),
            },
        },
        updatedAt: Date.now(),
    };
    return nextLobby;
}
function getLobbyLocalSkirmishMatch(lobby) {
    if (!lobby || lobby.activity.kind !== "skirmish") {
        return null;
    }
    const snapshot = (0, squadOnline_1.parseSquadMatchSnapshot)(lobby.activity.skirmish.matchSnapshot);
    if (!snapshot) {
        return null;
    }
    const localNetworkSlot = lobby.localSlot;
    const localSessionSlot = localNetworkSlot === lobby.activity.skirmish.challengeeSlot ? "P2" : "P1";
    return (0, squadOnline_1.rehydrateSquadMatchState)(snapshot, localSessionSlot);
}
function createLobbyPlaylist(rounds) {
    return {
        rounds: rounds.map((round, index) => ({
            id: `round_${index}_${Date.now().toString(36)}`,
            gridWidth: round.gridWidth,
            gridHeight: round.gridHeight,
            objectiveType: normalizeObjectiveType(round.objectiveType),
        })),
    };
}
function convertLegacySquadMatch() {
    const legacyMatch = (0, squadOnline_1.loadSquadMatchState)();
    if (!legacyMatch) {
        return null;
    }
    const hostedLobby = createHostedMultiplayerLobby(legacyMatch.members.P1?.callsign ?? "HOST");
    const normalizedLobby = types_1.NETWORK_PLAYER_SLOTS.reduce((acc, slot) => {
        if (slot === "P1") {
            return upsertLobbyMember(acc, slot, legacyMatch.members.P1?.callsign ?? "HOST", "host", "local");
        }
        if (slot === "P2" || slot === "P3" || slot === "P4") {
            const legacyMember = legacyMatch.members[slot];
            if (legacyMember) {
                return upsertLobbyMember(acc, slot, legacyMember.callsign, legacyMember.authorityRole, legacyMember.connected ? legacyMember.presence : "disconnected");
            }
        }
        return acc;
    }, hostedLobby);
    const objectiveType = normalizeObjectiveType(legacyMatch.rules.winCondition ?? "elimination");
    const playlist = createLobbyPlaylist([
        {
            gridWidth: legacyMatch.rules.gridWidth ?? 8,
            gridHeight: legacyMatch.rules.gridHeight ?? 5,
            objectiveType,
        },
    ]);
    if (legacyMatch.phase === "lobby") {
        return {
            ...normalizedLobby,
            updatedAt: Date.now(),
        };
    }
    return {
        ...createLobbySkirmishActivity(normalizedLobby, playlist, legacyMatch),
        localSlot: legacyMatch.localSlot,
        transportState: legacyMatch.transportState,
        updatedAt: Date.now(),
    };
}
function saveLobbyState(lobby) {
    try {
        if (!lobby) {
            localStorage.removeItem(exports.MULTIPLAYER_LOBBY_STORAGE_KEY);
            return;
        }
        localStorage.setItem(exports.MULTIPLAYER_LOBBY_STORAGE_KEY, JSON.stringify(lobby));
    }
    catch {
        // Ignore persistence failures in preview mode.
    }
}
function loadLobbyState() {
    try {
        const raw = localStorage.getItem(exports.MULTIPLAYER_LOBBY_STORAGE_KEY);
        if (!raw) {
            return convertLegacySquadMatch();
        }
        const parsed = JSON.parse(raw);
        if (parsed?.protocolVersion !== exports.MULTIPLAYER_LOBBY_PROTOCOL_VERSION) {
            return convertLegacySquadMatch();
        }
        const members = createNetworkSlotRecord((slot) => parsed.members?.[slot] ?? null);
        const activity = cloneActivity(parsed.activity);
        return {
            ...parsed,
            returnContext: cloneReturnContext(parsed.returnContext),
            transportState: normalizeTransportState(parsed.transportState),
            pendingChallenge: cloneChallenge(parsed.pendingChallenge),
            activity: activity.kind === "coop_operations"
                ? {
                    kind: "coop_operations",
                    coopOperations: normalizeCoopOperationsActivity(activity.coopOperations, members, parsed.hostSlot),
                }
                : activity,
            members,
            avatars: createNetworkSlotRecord((slot) => {
                const avatar = parsed.avatars?.[slot];
                return avatar
                    ? {
                        ...avatar,
                        mapId: avatar.mapId ?? null,
                        seatPreference: cloneSeatPreference(avatar.seatPreference),
                    }
                    : null;
            }),
        };
    }
    catch {
        return convertLegacySquadMatch();
    }
}
function clearLobbyState() {
    saveLobbyState(null);
}
function shouldResumeCoopSessionSlot(state, slot) {
    const player = state.session.players?.[slot];
    const assignment = state.session.theaterAssignments?.[slot];
    if (!player) {
        return false;
    }
    return Boolean(slot === "P1"
        || player.callsign
        || player.connected
        || player.presence === "remote"
        || player.presence === "local"
        || player.stagingState !== "disconnected"
        || assignment?.theaterId
        || player.currentTheaterId
        || player.activeBattleId);
}
function createResumableCoopOperationsLobby(state, returnContext = null) {
    if (state.session.mode !== "coop_operations") {
        return null;
    }
    const hostCallsign = state.session.players.P1?.callsign ?? state.profile.callsign ?? "HOST";
    let lobby = createHostedMultiplayerLobby(hostCallsign, returnContext);
    const selectedSlots = types_1.SESSION_PLAYER_SLOTS.filter((slot) => shouldResumeCoopSessionSlot(state, slot));
    const normalizedSelectedSlots = selectedSlots.includes("P1")
        ? selectedSlots
        : ["P1", ...selectedSlots];
    for (const slot of normalizedSelectedSlots) {
        const sessionPlayer = state.session.players[slot];
        const presence = slot === "P1"
            ? "local"
            : sessionPlayer?.connected
                ? "disconnected"
                : sessionPlayer?.presence === "inactive"
                    ? "disconnected"
                    : sessionPlayer?.presence ?? "disconnected";
        lobby = upsertLobbyMember(lobby, slot, sessionPlayer?.callsign ?? slot, slot === "P1" ? "host" : sessionPlayer?.authorityRole ?? "client", presence);
    }
    lobby = startCoopOperationsActivity(lobby, normalizedSelectedSlots);
    if (lobby.activity.kind !== "coop_operations") {
        return lobby;
    }
    lobby = setCoopOperationsSharedCampaign(lobby, state.session.sharedCampaignSlot ?? null, state.session.sharedCampaignLabel ?? null, state.session.sharedCampaignLastSavedAt ?? null);
    lobby = launchCoopOperationsActivity(lobby, {
        sessionId: state.session.sharedCampaignSlot ? `shared_${state.session.sharedCampaignSlot}` : null,
        economyPreset: state.session.resourceLedger.preset,
    });
    return syncCoopOperationsRuntime(lobby, state);
}
function withNormalizedLobbyState(state) {
    if (state.lobby) {
        const members = createNetworkSlotRecord((slot) => state.lobby?.members?.[slot] ?? null);
        const activity = cloneActivity(state.lobby.activity);
        return {
            ...state,
            lobby: {
                ...state.lobby,
                returnContext: cloneReturnContext(state.lobby.returnContext),
                transportState: normalizeTransportState(state.lobby.transportState),
                pendingChallenge: cloneChallenge(state.lobby.pendingChallenge),
                activity: activity.kind === "coop_operations"
                    ? {
                        kind: "coop_operations",
                        coopOperations: normalizeCoopOperationsActivity(activity.coopOperations, members, state.lobby.hostSlot),
                    }
                    : activity,
                members,
                avatars: createNetworkSlotRecord((slot) => {
                    const avatar = state.lobby?.avatars?.[slot];
                    return avatar ? { ...avatar, mapId: avatar.mapId ?? null } : null;
                }),
            },
        };
    }
    const legacyLobby = loadLobbyState();
    if (!legacyLobby) {
        return {
            ...state,
            lobby: null,
        };
    }
    return {
        ...state,
        lobby: legacyLobby,
    };
}
function createSkirmishMatchFromPlaylist(challengerCallsign, challengeeCallsign, round) {
    let match = (0, squadOnline_1.createSquadOnlineMatch)(challengerCallsign, 2, round.objectiveType, round.gridWidth, round.gridHeight, round.mapId ?? null);
    match = {
        ...match,
        transportState: "local_preview",
    };
    const challengeeMatch = (0, squadOnline_1.rehydrateSquadMatchState)((0, squadOnline_1.parseSquadMatchSnapshot)((0, squadOnline_1.serializeSquadMatchSnapshot)(match)), "P1");
    challengeeMatch.members.P2 = {
        slot: "P2",
        callsign: challengeeCallsign,
        presence: "remote",
        authorityRole: "client",
        connected: true,
        ready: false,
        joinedAt: Date.now(),
        lastHeartbeatAt: Date.now(),
    };
    challengeeMatch.updatedAt = Date.now();
    return challengeeMatch;
}
function getActiveLobbyPlaylistRound(lobby) {
    if (!lobby || lobby.activity.kind !== "skirmish") {
        return null;
    }
    return lobby.activity.skirmish.playlist.rounds[lobby.activity.skirmish.currentRoundIndex] ?? null;
}
function getDefaultLobbyPlaylist() {
    return createDefaultPlaylist();
}

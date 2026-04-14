"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE = exports.OUTER_DECK_OVERWORLD_HAVEN_GATE_ZONE_ID = exports.OUTER_DECK_OVERWORLD_ENTRY_SPAWN_TILE = exports.OUTER_DECK_HAVEN_EXIT_SPAWN_TILE = exports.OUTER_DECK_HAVEN_EXIT_OBJECT_TILE = exports.OUTER_DECK_HAVEN_EXIT_ZONE_ID = exports.OUTER_DECK_HAVEN_EXIT_OBJECT_ID = exports.OUTER_DECK_OVERWORLD_MAP_ID = void 0;
exports.createDefaultOuterDecksState = createDefaultOuterDecksState;
exports.getAllOuterDeckZoneDefinitions = getAllOuterDeckZoneDefinitions;
exports.getOuterDeckZoneDefinition = getOuterDeckZoneDefinition;
exports.getOuterDeckNpcEncounterDefinition = getOuterDeckNpcEncounterDefinition;
exports.getOuterDeckCompletionReward = getOuterDeckCompletionReward;
exports.getOuterDeckZoneLockedMessage = getOuterDeckZoneLockedMessage;
exports.getOuterDeckOverworldGateTile = getOuterDeckOverworldGateTile;
exports.getOuterDeckOverworldReturnSpawn = getOuterDeckOverworldReturnSpawn;
exports.getOuterDeckZoneGateLabel = getOuterDeckZoneGateLabel;
exports.getOuterDeckBranchEntrySubarea = getOuterDeckBranchEntrySubarea;
exports.getUnlockedOuterDeckZoneIds = getUnlockedOuterDeckZoneIds;
exports.isOuterDeckZoneUnlocked = isOuterDeckZoneUnlocked;
exports.isOuterDeckOverworldMap = isOuterDeckOverworldMap;
exports.isOuterDeckBranchMap = isOuterDeckBranchMap;
exports.isOuterDeckAccessibleMap = isOuterDeckAccessibleMap;
exports.getOuterDeckFieldContext = getOuterDeckFieldContext;
exports.isOuterDeckExpeditionActive = isOuterDeckExpeditionActive;
exports.getCurrentOuterDeckSubarea = getCurrentOuterDeckSubarea;
exports.getOuterDeckSubareaById = getOuterDeckSubareaById;
exports.getOuterDeckSubareaByMapId = getOuterDeckSubareaByMapId;
exports.getOuterDeckZoneIdByMapId = getOuterDeckZoneIdByMapId;
exports.isOuterDeckSubareaCleared = isOuterDeckSubareaCleared;
exports.isOuterDeckMechanicResolved = isOuterDeckMechanicResolved;
exports.hasOuterDeckCacheBeenClaimed = hasOuterDeckCacheBeenClaimed;
exports.hasSeenOuterDeckNpcEncounter = hasSeenOuterDeckNpcEncounter;
exports.hasOuterDeckZoneBeenReclaimed = hasOuterDeckZoneBeenReclaimed;
exports.beginOuterDeckExpedition = beginOuterDeckExpedition;
exports.setOuterDeckCurrentSubarea = setOuterDeckCurrentSubarea;
exports.markOuterDeckSubareaCleared = markOuterDeckSubareaCleared;
exports.resolveOuterDeckMechanic = resolveOuterDeckMechanic;
exports.markOuterDeckCacheClaimed = markOuterDeckCacheClaimed;
exports.markOuterDeckNpcEncounterSeen = markOuterDeckNpcEncounterSeen;
exports.claimOuterDeckCompletion = claimOuterDeckCompletion;
exports.abortOuterDeckExpedition = abortOuterDeckExpedition;
exports.OUTER_DECK_OVERWORLD_MAP_ID = "outer_deck_overworld";
exports.OUTER_DECK_HAVEN_EXIT_OBJECT_ID = "haven_outer_deck_south_gate";
exports.OUTER_DECK_HAVEN_EXIT_ZONE_ID = "interact_haven_outer_deck_south_gate";
exports.OUTER_DECK_HAVEN_EXIT_OBJECT_TILE = { x: 23, y: 21 };
exports.OUTER_DECK_HAVEN_EXIT_SPAWN_TILE = { x: 24, y: 21, facing: "south" };
exports.OUTER_DECK_OVERWORLD_ENTRY_SPAWN_TILE = { x: 70, y: 60, facing: "south" };
exports.OUTER_DECK_OVERWORLD_HAVEN_GATE_ZONE_ID = "outer_deck_overworld_return_haven";
exports.OUTER_DECK_OVERWORLD_HAVEN_GATE_TILE = { x: 69, y: 57 };
const OUTER_DECK_ZONE_ORDER = [
    "counterweight_shaft",
    "outer_scaffold",
    "drop_bay",
    "supply_intake_port",
];
const OUTER_DECK_OVERWORLD_BRANCH_SPAWNS = {
    counterweight_shaft: {
        gateTile: { x: 69, y: 3 },
        returnSpawn: { x: 70, y: 7, facing: "south" },
    },
    outer_scaffold: {
        gateTile: { x: 133, y: 44 },
        returnSpawn: { x: 129, y: 45, facing: "west" },
    },
    drop_bay: {
        gateTile: { x: 69, y: 84 },
        returnSpawn: { x: 70, y: 80, facing: "north" },
    },
    supply_intake_port: {
        gateTile: { x: 5, y: 44 },
        returnSpawn: { x: 10, y: 45, facing: "east" },
    },
};
const OUTER_DECK_NPC_ENCOUNTERS = {
    shaft_mechanist: {
        id: "shaft_mechanist",
        name: "Mechanist Reva",
        lines: [
            "You got the lift cage moving? Good. Means the bones of this thing still listen.",
            "Keep the power lines breathing and the shaft will stop trying to kill you every third rung.",
        ],
    },
    scaffold_spotter: {
        id: "scaffold_spotter",
        name: "Lookout Hesh",
        lines: [
            "Wind still carries signal out here. Not much else, but signal enough.",
            "If you want the long lanes clear, take the high catwalk before the crews do.",
        ],
    },
    dropbay_loader: {
        id: "dropbay_loader",
        name: "Loader Gant",
        lines: [
            "The clamps still answer in pairs. Move one stack wrong and the whole lane deadlocks.",
            "Plenty of salvage down here if you can keep the raiders off the rails.",
        ],
    },
    intake_quartermaster: {
        id: "intake_quartermaster",
        name: "Quartermaster Vale",
        lines: [
            "Intake still wants to sort everything. Cargo, bodies, bad decisions.",
            "Clear the jams and the port starts paying you back in real supplies.",
        ],
    },
};
function createZoneCompletionCounts() {
    return {
        counterweight_shaft: 0,
        outer_scaffold: 0,
        drop_bay: 0,
        supply_intake_port: 0,
    };
}
function createSubareas(zoneId, specs) {
    return specs.map((spec, index) => ({
        id: `${zoneId}:${spec.slug}`,
        zoneId,
        mapId: `outerdeck_${zoneId}_${spec.slug}`,
        kind: spec.kind,
        title: spec.title,
        gateVerb: spec.gateVerb,
        enemyCount: spec.enemyCount,
        enemyKinds: [...spec.enemyKinds],
        advanceToSubareaId: specs[index + 1] ? `${zoneId}:${specs[index + 1].slug}` : null,
        returnToSubareaId: index > 0 ? `${zoneId}:${specs[index - 1].slug}` : null,
        requiredMechanicId: spec.requiredMechanicId ?? null,
        requiredMechanicLabel: spec.requiredMechanicLabel ?? null,
        requiredMechanicHint: spec.requiredMechanicHint ?? null,
        cacheId: spec.cacheId ?? null,
        npcEncounterId: spec.npcEncounterId ?? null,
    }));
}
const OUTER_DECK_ZONE_DEFINITIONS = {
    counterweight_shaft: {
        id: "counterweight_shaft",
        name: "Counterweight Shaft",
        description: "A vertical service spine of maintenance lifts, offset ledges, and unstable machinery.",
        unlockFloorOrdinal: 3,
        gateLabel: "COUNTERWEIGHT SHAFT",
        lockedMessage: "Counterweight Shaft unlocks after Floor 03.",
        cacheReward: {
            wad: 28,
            resources: { metalScrap: 2, steamComponents: 1 },
        },
        completionReward: {
            wad: 52,
            resources: { metalScrap: 3, steamComponents: 2 },
        },
        firstClearRecipeId: "recipe_steam_valve_wristguard",
        subareas: createSubareas("counterweight_shaft", [
            {
                slug: "lower_access",
                kind: "entry",
                title: "Counterweight Shaft // Lower Access",
                gateVerb: "POWER LIFT",
                enemyCount: 2,
                enemyKinds: ["maintenance_drone", "climbing_scavenger"],
                requiredMechanicId: "counterweight_shaft_restore_lift_power",
                requiredMechanicLabel: "RESTORE LIFT POWER",
                requiredMechanicHint: "Route emergency power through the maintenance lift controls first.",
            },
            {
                slug: "lift_spine",
                kind: "mid",
                title: "Counterweight Shaft // Lift Spine",
                gateVerb: "ALIGN PLATFORM",
                enemyCount: 3,
                enemyKinds: ["perched_ranged", "climbing_scavenger", "maintenance_drone"],
                cacheId: "counterweight_shaft_cache_a",
                npcEncounterId: "shaft_mechanist",
            },
            {
                slug: "counterweight_cap",
                kind: "reward",
                title: "Counterweight Shaft // Counterweight Cap",
                gateVerb: "SECURE NODE",
                enemyCount: 2,
                enemyKinds: ["nest_creature", "perched_ranged"],
            },
        ]),
    },
    outer_scaffold: {
        id: "outer_scaffold",
        name: "Outer Scaffold",
        description: "Exposed catwalk rings and scaffold arms wrapped around HAVEN's outer shell.",
        unlockFloorOrdinal: 6,
        gateLabel: "OUTER SCAFFOLD",
        lockedMessage: "Outer Scaffold unlocks after Floor 06.",
        cacheReward: {
            wad: 30,
            resources: { wood: 2, steamComponents: 1 },
        },
        completionReward: {
            wad: 58,
            resources: { wood: 3, steamComponents: 2 },
        },
        firstClearRecipeId: "recipe_fleetfoot_anklet",
        subareas: createSubareas("outer_scaffold", [
            {
                slug: "ringwalk",
                kind: "entry",
                title: "Outer Scaffold // Ringwalk",
                gateVerb: "EXTEND BRIDGE",
                enemyCount: 2,
                enemyKinds: ["scaffold_sniper", "fast_flanker"],
                requiredMechanicId: "outer_scaffold_extend_bridge",
                requiredMechanicLabel: "RESTART WINCH",
                requiredMechanicHint: "Kick the scaffold winch back online before the bridge can extend.",
            },
            {
                slug: "signal_span",
                kind: "mid",
                title: "Outer Scaffold // Signal Span",
                gateVerb: "RESTART WINCH",
                enemyCount: 3,
                enemyKinds: ["scaffold_sniper", "shielded_defender", "fast_flanker"],
                cacheId: "outer_scaffold_cache_a",
                npcEncounterId: "scaffold_spotter",
            },
            {
                slug: "relay_roost",
                kind: "reward",
                title: "Outer Scaffold // Relay Roost",
                gateVerb: "SECURE NODE",
                enemyCount: 2,
                enemyKinds: ["sentry_construct", "scaffold_sniper"],
            },
        ]),
    },
    drop_bay: {
        id: "drop_bay",
        name: "Drop Bay",
        description: "A broken freight deployment lane full of clamp rails, cargo stacks, and release machinery.",
        unlockFloorOrdinal: 9,
        gateLabel: "DROP BAY",
        lockedMessage: "Drop Bay unlocks after Floor 09.",
        cacheReward: {
            wad: 34,
            resources: { metalScrap: 2, wood: 2 },
        },
        completionReward: {
            wad: 64,
            resources: { metalScrap: 3, wood: 2, steamComponents: 1 },
        },
        firstClearRecipeId: "recipe_repair_kit",
        subareas: createSubareas("drop_bay", [
            {
                slug: "clamp_lane",
                kind: "entry",
                title: "Drop Bay // Clamp Lane",
                gateVerb: "RELEASE CLAMPS",
                enemyCount: 2,
                enemyKinds: ["cargo_looter", "cargo_ambusher"],
                requiredMechanicId: "drop_bay_route_crane",
                requiredMechanicLabel: "ROUTE CRANE",
                requiredMechanicHint: "Route the cargo crane before the clamp lane will open.",
            },
            {
                slug: "cargo_field",
                kind: "mid",
                title: "Drop Bay // Cargo Field",
                gateVerb: "ROUTE CRANE",
                enemyCount: 3,
                enemyKinds: ["heavy_defender", "cargo_ambusher", "industrial_construct"],
                cacheId: "drop_bay_cache_a",
                npcEncounterId: "dropbay_loader",
            },
            {
                slug: "dispatch_cradle",
                kind: "reward",
                title: "Drop Bay // Dispatch Cradle",
                gateVerb: "SECURE NODE",
                enemyCount: 2,
                enemyKinds: ["industrial_construct", "containment_beast"],
            },
        ]),
    },
    supply_intake_port: {
        id: "supply_intake_port",
        name: "Supply Intake Port",
        description: "An intake and sorting lattice where cargo routes, gates, and conveyors still grind against each other.",
        unlockFloorOrdinal: 12,
        gateLabel: "SUPPLY INTAKE PORT",
        lockedMessage: "Supply Intake Port unlocks after Floor 12.",
        cacheReward: {
            wad: 36,
            resources: { chaosShards: 2, steamComponents: 1 },
        },
        completionReward: {
            wad: 68,
            resources: { chaosShards: 2, steamComponents: 2, wood: 1 },
        },
        firstClearRecipeId: "recipe_coolant_flask",
        subareas: createSubareas("supply_intake_port", [
            {
                slug: "intake_gate",
                kind: "entry",
                title: "Supply Intake Port // Intake Gate",
                gateVerb: "POWER INTAKE",
                enemyCount: 2,
                enemyKinds: ["swarm_cluster", "sort_bot"],
                requiredMechanicId: "supply_intake_port_clear_sorter_jam",
                requiredMechanicLabel: "CLEAR SORTER JAM",
                requiredMechanicHint: "Clear the sorter jam before the intake gate can cycle open.",
            },
            {
                slug: "sorting_channel",
                kind: "mid",
                title: "Supply Intake Port // Sorting Channel",
                gateVerb: "CLEAR JAM",
                enemyCount: 3,
                enemyKinds: ["swarm_cluster", "smuggler_raider", "sort_bot"],
                cacheId: "supply_intake_port_cache_a",
                npcEncounterId: "intake_quartermaster",
            },
            {
                slug: "quarantine_lock",
                kind: "reward",
                title: "Supply Intake Port // Quarantine Lock",
                gateVerb: "SECURE NODE",
                enemyCount: 2,
                enemyKinds: ["contamination_creature", "automated_defense"],
            },
        ]),
    },
};
function cloneSubareas(subareas) {
    return subareas.map((subarea) => ({
        ...subarea,
        enemyKinds: [...subarea.enemyKinds],
    }));
}
function cloneActiveExpedition(expedition) {
    if (!expedition) {
        return null;
    }
    return {
        ...expedition,
        subareas: cloneSubareas(expedition.subareas),
        clearedSubareaIds: [...expedition.clearedSubareaIds],
        resolvedMechanicIds: [...expedition.resolvedMechanicIds],
        rewardCacheClaimedIds: [...expedition.rewardCacheClaimedIds],
        npcEncounterIds: [...expedition.npcEncounterIds],
    };
}
function withOuterDecksState(state, outerDecks) {
    return {
        ...state,
        outerDecks,
    };
}
function getSafeOuterDecksState(state) {
    return state.outerDecks ?? createDefaultOuterDecksState();
}
function createDefaultOuterDecksState() {
    return {
        isExpeditionActive: false,
        activeExpedition: null,
        zoneCompletionCounts: createZoneCompletionCounts(),
        zoneFirstClearRecipeClaimed: {},
        seenNpcEncounterIds: [],
        runHistory: [],
    };
}
function getAllOuterDeckZoneDefinitions() {
    return OUTER_DECK_ZONE_ORDER.map((zoneId) => OUTER_DECK_ZONE_DEFINITIONS[zoneId]);
}
function getOuterDeckZoneDefinition(zoneId) {
    return OUTER_DECK_ZONE_DEFINITIONS[zoneId];
}
function getOuterDeckNpcEncounterDefinition(encounterId) {
    return OUTER_DECK_NPC_ENCOUNTERS[encounterId];
}
function getOuterDeckCompletionReward(zoneId) {
    return getOuterDeckZoneDefinition(zoneId).completionReward;
}
function getOuterDeckZoneLockedMessage(zoneId) {
    return getOuterDeckZoneDefinition(zoneId).lockedMessage;
}
function getOuterDeckOverworldGateTile(zoneId) {
    return OUTER_DECK_OVERWORLD_BRANCH_SPAWNS[zoneId].gateTile;
}
function getOuterDeckOverworldReturnSpawn(zoneId) {
    return OUTER_DECK_OVERWORLD_BRANCH_SPAWNS[zoneId].returnSpawn;
}
function getOuterDeckZoneGateLabel(zoneId) {
    return getOuterDeckZoneDefinition(zoneId).gateLabel;
}
function getOuterDeckBranchEntrySubarea(zoneId) {
    return getOuterDeckZoneDefinition(zoneId).subareas[0];
}
function getUnlockedOuterDeckZoneIds(progress) {
    const highestReachedFloorOrdinal = Math.max(0, Number(progress?.highestReachedFloorOrdinal ?? 0));
    return OUTER_DECK_ZONE_ORDER.filter((zoneId) => highestReachedFloorOrdinal >= getOuterDeckZoneDefinition(zoneId).unlockFloorOrdinal);
}
function isOuterDeckZoneUnlocked(zoneId, progress) {
    const highestReachedFloorOrdinal = Math.max(0, Number(progress?.highestReachedFloorOrdinal ?? 0));
    return highestReachedFloorOrdinal >= getOuterDeckZoneDefinition(zoneId).unlockFloorOrdinal;
}
function isOuterDeckOverworldMap(mapId) {
    return String(mapId ?? "") === exports.OUTER_DECK_OVERWORLD_MAP_ID;
}
function isOuterDeckBranchMap(mapId) {
    const normalized = String(mapId ?? "");
    return getAllOuterDeckZoneDefinitions().some((zone) => zone.subareas.some((subarea) => subarea.mapId === normalized));
}
function isOuterDeckAccessibleMap(mapId) {
    return isOuterDeckOverworldMap(mapId) || isOuterDeckBranchMap(mapId);
}
function getOuterDeckFieldContext(mapId) {
    if (isOuterDeckBranchMap(mapId)) {
        return "outerDeckBranch";
    }
    if (isOuterDeckOverworldMap(mapId)) {
        return "outerDeckOverworld";
    }
    return "haven";
}
function isOuterDeckExpeditionActive(state) {
    const outerDecks = getSafeOuterDecksState(state);
    return Boolean(outerDecks.isExpeditionActive && outerDecks.activeExpedition);
}
function getCurrentOuterDeckSubarea(state) {
    const expedition = getSafeOuterDecksState(state).activeExpedition;
    if (!expedition) {
        return null;
    }
    return expedition.subareas.find((subarea) => subarea.id === expedition.currentSubareaId) ?? null;
}
function getOuterDeckSubareaById(state, subareaId) {
    const expeditionSubarea = getSafeOuterDecksState(state).activeExpedition?.subareas.find((subarea) => subarea.id === subareaId);
    if (expeditionSubarea) {
        return expeditionSubarea;
    }
    return getAllOuterDeckZoneDefinitions()
        .flatMap((zone) => zone.subareas)
        .find((subarea) => subarea.id === subareaId) ?? null;
}
function getOuterDeckSubareaByMapId(state, mapId) {
    const expeditionSubarea = getSafeOuterDecksState(state).activeExpedition?.subareas.find((subarea) => subarea.mapId === mapId);
    if (expeditionSubarea) {
        return expeditionSubarea;
    }
    return getAllOuterDeckZoneDefinitions()
        .flatMap((zone) => zone.subareas)
        .find((subarea) => subarea.mapId === mapId) ?? null;
}
function getOuterDeckZoneIdByMapId(mapId) {
    return getAllOuterDeckZoneDefinitions()
        .flatMap((zone) => zone.subareas)
        .find((subarea) => subarea.mapId === mapId)?.zoneId ?? null;
}
function isOuterDeckSubareaCleared(state, subareaId) {
    return Boolean(getSafeOuterDecksState(state).activeExpedition?.clearedSubareaIds.includes(subareaId));
}
function isOuterDeckMechanicResolved(state, mechanicId) {
    return Boolean(getSafeOuterDecksState(state).activeExpedition?.resolvedMechanicIds.includes(mechanicId));
}
function hasOuterDeckCacheBeenClaimed(state, cacheId) {
    return Boolean(getSafeOuterDecksState(state).activeExpedition?.rewardCacheClaimedIds.includes(cacheId));
}
function hasSeenOuterDeckNpcEncounter(state, encounterId) {
    return getSafeOuterDecksState(state).seenNpcEncounterIds.includes(encounterId);
}
function hasOuterDeckZoneBeenReclaimed(state, zoneId) {
    return Math.max(0, Number(getSafeOuterDecksState(state).zoneCompletionCounts[zoneId] ?? 0)) > 0;
}
function beginOuterDeckExpedition(state, zoneId, startedAt = Date.now()) {
    const zone = getOuterDeckZoneDefinition(zoneId);
    const expedition = {
        expeditionId: `outerdeck_${zoneId}_${startedAt}`,
        zoneId,
        startedAt,
        currentSubareaId: zone.subareas[0].id,
        subareas: cloneSubareas(zone.subareas),
        clearedSubareaIds: [],
        resolvedMechanicIds: [],
        rewardCacheClaimedIds: [],
        npcEncounterIds: [],
        completionRewardClaimed: false,
    };
    return withOuterDecksState(state, {
        ...getSafeOuterDecksState(state),
        isExpeditionActive: true,
        activeExpedition: expedition,
    });
}
function setOuterDeckCurrentSubarea(state, targetSubareaId) {
    const outerDecks = getSafeOuterDecksState(state);
    const expedition = cloneActiveExpedition(outerDecks.activeExpedition);
    if (!expedition || !expedition.subareas.some((subarea) => subarea.id === targetSubareaId)) {
        return state;
    }
    expedition.currentSubareaId = targetSubareaId;
    return withOuterDecksState(state, {
        ...outerDecks,
        activeExpedition: expedition,
    });
}
function markOuterDeckSubareaCleared(state, subareaId) {
    const outerDecks = getSafeOuterDecksState(state);
    const expedition = cloneActiveExpedition(outerDecks.activeExpedition);
    if (!expedition || expedition.clearedSubareaIds.includes(subareaId)) {
        return state;
    }
    expedition.clearedSubareaIds.push(subareaId);
    return withOuterDecksState(state, {
        ...outerDecks,
        activeExpedition: expedition,
    });
}
function resolveOuterDeckMechanic(state, mechanicId) {
    const outerDecks = getSafeOuterDecksState(state);
    const expedition = cloneActiveExpedition(outerDecks.activeExpedition);
    if (!expedition || expedition.resolvedMechanicIds.includes(mechanicId)) {
        return state;
    }
    expedition.resolvedMechanicIds.push(mechanicId);
    return withOuterDecksState(state, {
        ...outerDecks,
        activeExpedition: expedition,
    });
}
function markOuterDeckCacheClaimed(state, cacheId) {
    const outerDecks = getSafeOuterDecksState(state);
    const expedition = cloneActiveExpedition(outerDecks.activeExpedition);
    if (!expedition || expedition.rewardCacheClaimedIds.includes(cacheId)) {
        return state;
    }
    expedition.rewardCacheClaimedIds.push(cacheId);
    return withOuterDecksState(state, {
        ...outerDecks,
        activeExpedition: expedition,
    });
}
function markOuterDeckNpcEncounterSeen(state, encounterId) {
    const outerDecks = getSafeOuterDecksState(state);
    const expedition = cloneActiveExpedition(outerDecks.activeExpedition);
    const seenNpcEncounterIds = outerDecks.seenNpcEncounterIds.includes(encounterId)
        ? [...outerDecks.seenNpcEncounterIds]
        : [...outerDecks.seenNpcEncounterIds, encounterId];
    if (!expedition) {
        return withOuterDecksState(state, {
            ...outerDecks,
            seenNpcEncounterIds,
        });
    }
    if (!expedition.npcEncounterIds.includes(encounterId)) {
        expedition.npcEncounterIds.push(encounterId);
    }
    return withOuterDecksState(state, {
        ...outerDecks,
        seenNpcEncounterIds,
        activeExpedition: expedition,
    });
}
function finalizeOuterDeckExpedition(state, outcome, endedAt, awardedRecipeId) {
    const outerDecks = getSafeOuterDecksState(state);
    const expedition = outerDecks.activeExpedition;
    if (!expedition) {
        return { state, awardedRecipeId };
    }
    const nextRunHistory = [
        ...outerDecks.runHistory,
        {
            expeditionId: expedition.expeditionId,
            zoneId: expedition.zoneId,
            startedAt: expedition.startedAt,
            endedAt,
            outcome,
            clearedSubareaIds: [...expedition.clearedSubareaIds],
        },
    ].slice(-20);
    const nextOuterDecks = {
        ...outerDecks,
        isExpeditionActive: false,
        activeExpedition: null,
        runHistory: nextRunHistory,
    };
    const nextKnownRecipeIds = awardedRecipeId && !state.knownRecipeIds.includes(awardedRecipeId)
        ? [...state.knownRecipeIds, awardedRecipeId]
        : state.knownRecipeIds;
    return {
        awardedRecipeId,
        state: {
            ...state,
            knownRecipeIds: nextKnownRecipeIds,
            outerDecks: nextOuterDecks,
        },
    };
}
function claimOuterDeckCompletion(state, completedAt = Date.now()) {
    const outerDecks = getSafeOuterDecksState(state);
    const expedition = outerDecks.activeExpedition;
    if (!expedition) {
        return { state, awardedRecipeId: null };
    }
    const zoneId = expedition.zoneId;
    const definition = getOuterDeckZoneDefinition(zoneId);
    const firstClearAlreadyClaimed = Boolean(outerDecks.zoneFirstClearRecipeClaimed[zoneId]);
    const awardedRecipeId = !firstClearAlreadyClaimed ? definition.firstClearRecipeId : null;
    const nextOuterDecks = {
        ...outerDecks,
        zoneCompletionCounts: {
            ...outerDecks.zoneCompletionCounts,
            [zoneId]: Math.max(0, Number(outerDecks.zoneCompletionCounts[zoneId] ?? 0)) + 1,
        },
        zoneFirstClearRecipeClaimed: awardedRecipeId
            ? {
                ...outerDecks.zoneFirstClearRecipeClaimed,
                [zoneId]: true,
            }
            : { ...outerDecks.zoneFirstClearRecipeClaimed },
    };
    return finalizeOuterDeckExpedition({
        ...state,
        outerDecks: nextOuterDecks,
    }, "completed", completedAt, awardedRecipeId);
}
function abortOuterDeckExpedition(state, endedAt = Date.now()) {
    return finalizeOuterDeckExpedition(state, "aborted", endedAt, null).state;
}

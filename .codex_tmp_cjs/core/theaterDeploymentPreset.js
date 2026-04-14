"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.THEATER_SQUAD_ICON_CHOICES = exports.THEATER_SQUAD_COLOR_CHOICES = exports.THEATER_SQUAD_UNIT_LIMIT = void 0;
exports.formatDefaultSquadName = formatDefaultSquadName;
exports.clampSquadName = clampSquadName;
exports.normalizeSquadIcon = normalizeSquadIcon;
exports.normalizeSquadColorKey = normalizeSquadColorKey;
exports.createDefaultTheaterDeploymentPreset = createDefaultTheaterDeploymentPreset;
exports.normalizeTheaterDeploymentPreset = normalizeTheaterDeploymentPreset;
exports.withNormalizedTheaterDeploymentPresetState = withNormalizedTheaterDeploymentPresetState;
exports.buildTheaterDeploymentLaunchPreview = buildTheaterDeploymentLaunchPreview;
exports.getTheaterDeploymentUnitIds = getTheaterDeploymentUnitIds;
const dispatchSystem_1 = require("./dispatchSystem");
exports.THEATER_SQUAD_UNIT_LIMIT = 6;
exports.THEATER_SQUAD_COLOR_CHOICES = ["amber", "teal", "verdant", "violet", "oxide", "moss", "steel"];
exports.THEATER_SQUAD_ICON_CHOICES = ["◉", "▲", "◆", "■", "✦", "⬢", "✚", "⬣"];
function normalizeSquadId(squadId, orderIndex, usedIds) {
    const trimmed = typeof squadId === "string" ? squadId.trim() : "";
    let nextId = trimmed || `tp_${orderIndex + 1}`;
    let suffix = 1;
    while (usedIds.has(nextId)) {
        nextId = `${trimmed || `tp_${orderIndex + 1}`}_${suffix}`;
        suffix += 1;
    }
    usedIds.add(nextId);
    return nextId;
}
function formatDefaultSquadName(index) {
    return `Squad ${index + 1}`;
}
function clampSquadName(name, fallback) {
    const sanitized = (name ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 24);
    return sanitized || fallback;
}
function normalizeSquadIcon(icon, index = 0) {
    if (icon && exports.THEATER_SQUAD_ICON_CHOICES.includes(icon)) {
        return icon;
    }
    return exports.THEATER_SQUAD_ICON_CHOICES[index % exports.THEATER_SQUAD_ICON_CHOICES.length] ?? "◉";
}
function normalizeSquadColorKey(colorKey, index = 0) {
    if (colorKey && exports.THEATER_SQUAD_COLOR_CHOICES.includes(colorKey)) {
        return colorKey;
    }
    return exports.THEATER_SQUAD_COLOR_CHOICES[index % exports.THEATER_SQUAD_COLOR_CHOICES.length] ?? "amber";
}
function createDefaultTheaterDeploymentPreset(unitIds) {
    if (unitIds.length <= 0) {
        return { squads: [] };
    }
    return {
        squads: unitIds.reduce((acc, unitId, index) => {
            const squadIndex = Math.floor(index / exports.THEATER_SQUAD_UNIT_LIMIT);
            if (!acc[squadIndex]) {
                acc[squadIndex] = {
                    squadId: `tp_${squadIndex + 1}`,
                    displayName: formatDefaultSquadName(squadIndex),
                    icon: normalizeSquadIcon(undefined, squadIndex),
                    colorKey: normalizeSquadColorKey(undefined, squadIndex),
                    unitIds: [],
                };
            }
            acc[squadIndex].unitIds.push(unitId);
            return acc;
        }, []),
    };
}
function normalizeTheaterDeploymentPreset(preset, fallbackUnitIds) {
    if (!preset || !Array.isArray(preset.squads)) {
        return createDefaultTheaterDeploymentPreset(fallbackUnitIds);
    }
    const seenUnitIds = new Set();
    const usedSquadIds = new Set();
    const squads = preset.squads
        .map((rawSquad, index) => {
        const rawUnitIds = Array.isArray(rawSquad?.unitIds) ? rawSquad.unitIds : [];
        const unitIds = [];
        rawUnitIds.forEach((unitId) => {
            if (typeof unitId !== "string" || seenUnitIds.has(unitId)) {
                return;
            }
            seenUnitIds.add(unitId);
            if (unitIds.length >= exports.THEATER_SQUAD_UNIT_LIMIT) {
                return;
            }
            unitIds.push(unitId);
        });
        return {
            squadId: normalizeSquadId(rawSquad?.squadId, index, usedSquadIds),
            displayName: clampSquadName(rawSquad?.displayName, formatDefaultSquadName(index)),
            icon: normalizeSquadIcon(rawSquad?.icon, index),
            colorKey: normalizeSquadColorKey(rawSquad?.colorKey, index),
            unitIds,
        };
    });
    return { squads };
}
function withNormalizedTheaterDeploymentPresetState(state) {
    const normalizedPreset = normalizeTheaterDeploymentPreset(state.theaterDeploymentPreset, state.partyUnitIds ?? []);
    if (JSON.stringify(state.theaterDeploymentPreset ?? null) === JSON.stringify(normalizedPreset)) {
        return state.theaterDeploymentPreset ? state : { ...state, theaterDeploymentPreset: normalizedPreset };
    }
    return {
        ...state,
        theaterDeploymentPreset: normalizedPreset,
    };
}
function buildTheaterDeploymentLaunchPreview(state) {
    const normalizedPreset = normalizeTheaterDeploymentPreset(state.theaterDeploymentPreset, state.partyUnitIds ?? []);
    const rawSquads = normalizedPreset.squads;
    const busyDispatchUnitIds = (0, dispatchSystem_1.getBusyDispatchUnitIds)(state);
    const seenUnitIds = new Set();
    const deployUnitIds = [];
    const skippedUnits = [];
    const squads = [];
    rawSquads.forEach((squad, squadIndex) => {
        const squadUnitIds = [];
        squad.unitIds.forEach((unitId, unitIndex) => {
            const unit = state.unitsById[unitId];
            const unitName = unit?.name ?? null;
            if (seenUnitIds.has(unitId)) {
                skippedUnits.push({
                    unitId,
                    squadId: squad.squadId,
                    squadName: squad.displayName,
                    unitName,
                    reason: "duplicate",
                });
                return;
            }
            seenUnitIds.add(unitId);
            if (unitIndex >= exports.THEATER_SQUAD_UNIT_LIMIT) {
                skippedUnits.push({
                    unitId,
                    squadId: squad.squadId,
                    squadName: squad.displayName,
                    unitName,
                    reason: "over_cap",
                });
                return;
            }
            if (!unit || unit.isEnemy) {
                skippedUnits.push({
                    unitId,
                    squadId: squad.squadId,
                    squadName: squad.displayName,
                    unitName,
                    reason: "missing",
                });
                return;
            }
            if (busyDispatchUnitIds.has(unitId)) {
                skippedUnits.push({
                    unitId,
                    squadId: squad.squadId,
                    squadName: squad.displayName,
                    unitName,
                    reason: "dispatched",
                });
                return;
            }
            squadUnitIds.push(unitId);
            deployUnitIds.push(unitId);
        });
        if (squadUnitIds.length <= 0) {
            return;
        }
        squads.push({
            squadId: squad.squadId,
            displayName: clampSquadName(squad.displayName, formatDefaultSquadName(squadIndex)),
            icon: normalizeSquadIcon(squad.icon, squadIndex),
            colorKey: normalizeSquadColorKey(squad.colorKey, squadIndex),
            unitIds: squadUnitIds,
        });
    });
    return {
        squads,
        deployUnitIds,
        skippedUnits,
    };
}
function getTheaterDeploymentUnitIds(state) {
    return buildTheaterDeploymentLaunchPreview(state).deployUnitIds;
}

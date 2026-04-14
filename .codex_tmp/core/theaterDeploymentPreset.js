import { getBusyDispatchUnitIds } from "./dispatchSystem";
export const THEATER_SQUAD_UNIT_LIMIT = 6;
export const THEATER_SQUAD_COLOR_CHOICES = ["amber", "teal", "verdant", "violet", "oxide", "moss", "steel"];
export const THEATER_SQUAD_ICON_CHOICES = ["◉", "▲", "◆", "■", "✦", "⬢", "✚", "⬣"];
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
export function formatDefaultSquadName(index) {
    return `Squad ${index + 1}`;
}
export function clampSquadName(name, fallback) {
    const sanitized = (name ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 24);
    return sanitized || fallback;
}
export function normalizeSquadIcon(icon, index = 0) {
    if (icon && THEATER_SQUAD_ICON_CHOICES.includes(icon)) {
        return icon;
    }
    return THEATER_SQUAD_ICON_CHOICES[index % THEATER_SQUAD_ICON_CHOICES.length] ?? "◉";
}
export function normalizeSquadColorKey(colorKey, index = 0) {
    if (colorKey && THEATER_SQUAD_COLOR_CHOICES.includes(colorKey)) {
        return colorKey;
    }
    return THEATER_SQUAD_COLOR_CHOICES[index % THEATER_SQUAD_COLOR_CHOICES.length] ?? "amber";
}
export function createDefaultTheaterDeploymentPreset(unitIds) {
    if (unitIds.length <= 0) {
        return { squads: [] };
    }
    return {
        squads: unitIds.reduce((acc, unitId, index) => {
            const squadIndex = Math.floor(index / THEATER_SQUAD_UNIT_LIMIT);
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
export function normalizeTheaterDeploymentPreset(preset, fallbackUnitIds) {
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
            if (unitIds.length >= THEATER_SQUAD_UNIT_LIMIT) {
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
export function withNormalizedTheaterDeploymentPresetState(state) {
    const normalizedPreset = normalizeTheaterDeploymentPreset(state.theaterDeploymentPreset, state.partyUnitIds ?? []);
    if (JSON.stringify(state.theaterDeploymentPreset ?? null) === JSON.stringify(normalizedPreset)) {
        return state.theaterDeploymentPreset ? state : { ...state, theaterDeploymentPreset: normalizedPreset };
    }
    return {
        ...state,
        theaterDeploymentPreset: normalizedPreset,
    };
}
export function buildTheaterDeploymentLaunchPreview(state) {
    const normalizedPreset = normalizeTheaterDeploymentPreset(state.theaterDeploymentPreset, state.partyUnitIds ?? []);
    const rawSquads = normalizedPreset.squads;
    const busyDispatchUnitIds = getBusyDispatchUnitIds(state);
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
            if (unitIndex >= THEATER_SQUAD_UNIT_LIMIT) {
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
export function getTheaterDeploymentUnitIds(state) {
    return buildTheaterDeploymentLaunchPreview(state).deployUnitIds;
}

const ECHO_FIELD_CONFIG = {
    ember_zone: {
        color: "#ff8a48",
        name: "Ember Zone",
        description: "Occupants strike harder while inside the zone.",
        effectLabel: "+DMG",
    },
    bastion_zone: {
        color: "#86b2ff",
        name: "Bastion Zone",
        description: "Occupants gain defense but lose some movement inside the zone.",
        effectLabel: "+DEF / -MOV",
    },
    flux_zone: {
        color: "#76f1d5",
        name: "Flux Zone",
        description: "Occupants gain extra movement while inside the zone.",
        effectLabel: "+MOV",
    },
    static_zone: {
        color: "#f7c56e",
        name: "Static Zone",
        description: "Occupants gain accuracy while inside the zone.",
        effectLabel: "+ACC",
    },
    mender_zone: {
        color: "#7ef0a5",
        name: "Mender Zone",
        description: "Occupants heal at the start of their turn.",
        effectLabel: "TURN HEAL",
    },
    vent_zone: {
        color: "#71d4f4",
        name: "Vent Zone",
        description: "Occupants reduce strain at the start of their turn.",
        effectLabel: "-STRAIN",
    },
    ward_zone: {
        color: "#d7b3ff",
        name: "Ward Zone",
        description: "Occupants gain Guarded at the start of their turn.",
        effectLabel: "GUARDED",
    },
    hex_zone: {
        color: "#f37cae",
        name: "Hex Zone",
        description: "Attacks made from inside the zone apply Vulnerable on hit.",
        effectLabel: "ON-HIT VULN",
    },
    snare_zone: {
        color: "#8ca3c2",
        name: "Snare Zone",
        description: "Enemy occupants lose movement while inside the zone.",
        effectLabel: "ENEMY -MOV",
    },
    shroud_zone: {
        color: "#5f6a7b",
        name: "Shroud Zone",
        description: "Attacks targeting occupants suffer an accuracy penalty.",
        effectLabel: "INCOMING -ACC",
    },
    relay_zone: {
        color: "#7ce3ff",
        name: "Relay Zone",
        description: "Occupants draw additional cards at the start of their turn.",
        effectLabel: "+DRAW",
    },
    null_zone: {
        color: "#d4dce7",
        name: "Null Zone",
        description: "Occupants clear Burning and Poisoned at turn start.",
        effectLabel: "CLEANSE",
    },
    overdrive_zone: {
        color: "#ffb870",
        name: "Overdrive Zone",
        description: "The first card played each turn from inside the zone costs less strain.",
        effectLabel: "FIRST CARD -1 STRAIN",
    },
};
function getFieldRadiusFromLevel(level) {
    if (level >= 5)
        return 3;
    if (level >= 3)
        return 2;
    return 1;
}
function getScaledLevelBonus(level, low = 1, mid = 2, high = 3) {
    if (level >= 5)
        return high;
    if (level >= 3)
        return mid;
    return low;
}
export function buildEchoFieldDefinition(fieldId, draftId, level = 1) {
    const config = ECHO_FIELD_CONFIG[fieldId];
    return {
        draftId,
        id: fieldId,
        name: config.name,
        description: config.description,
        effectLabel: config.effectLabel,
        color: config.color,
        level,
        maxLevel: 5,
        radius: getFieldRadiusFromLevel(level),
    };
}
export function getEchoFieldCatalog() {
    return Object.keys(ECHO_FIELD_CONFIG).map((fieldId) => (buildEchoFieldDefinition(fieldId, `catalog_${fieldId}`, 1)));
}
export function isEchoBattle(battle) {
    return battle?.modeContext?.kind === "echo";
}
export function getEchoBattleContext(battle) {
    return battle?.modeContext?.kind === "echo" ? battle.modeContext.echo ?? null : null;
}
export function getEchoFieldPlacements(battle) {
    return getEchoBattleContext(battle)?.fieldPlacements ?? [];
}
export function isPositionInsideEchoField(pos, placement) {
    if (!pos)
        return false;
    const distance = Math.abs(pos.x - placement.x) + Math.abs(pos.y - placement.y);
    return distance <= placement.radius;
}
export function getEchoFieldsAffectingUnit(battle, unit, fieldId) {
    if (!unit?.pos)
        return [];
    return getEchoFieldPlacements(battle).filter((placement) => {
        if (fieldId && placement.fieldId !== fieldId) {
            return false;
        }
        return isPositionInsideEchoField(unit.pos, placement);
    });
}
export function getEchoAttackBonus(battle, unit) {
    const placements = getEchoFieldsAffectingUnit(battle, unit, "ember_zone");
    const amount = placements.reduce((maxBonus, placement) => (Math.max(maxBonus, getScaledLevelBonus(placement.level))), 0);
    return { amount, triggeredPlacements: placements };
}
export function getEchoDefenseBonus(battle, unit) {
    const placements = getEchoFieldsAffectingUnit(battle, unit, "bastion_zone");
    const amount = placements.reduce((maxBonus, placement) => (Math.max(maxBonus, getScaledLevelBonus(placement.level))), 0);
    return { amount, triggeredPlacements: placements };
}
export function getEchoMovementAdjustment(battle, unit) {
    const fluxPlacements = getEchoFieldsAffectingUnit(battle, unit, "flux_zone");
    const bastionPlacements = getEchoFieldsAffectingUnit(battle, unit, "bastion_zone");
    const snarePlacements = unit?.isEnemy ? getEchoFieldsAffectingUnit(battle, unit, "snare_zone") : [];
    const fluxBonus = fluxPlacements.reduce((maxBonus, placement) => (Math.max(maxBonus, getScaledLevelBonus(placement.level))), 0);
    const bastionPenalty = bastionPlacements.reduce((maxPenalty, placement) => (Math.max(maxPenalty, placement.level >= 5 ? 2 : 1)), 0);
    const snarePenalty = snarePlacements.reduce((maxPenalty, placement) => (Math.max(maxPenalty, placement.level >= 5 ? 2 : 1)), 0);
    return {
        amount: fluxBonus - bastionPenalty - snarePenalty,
        triggeredPlacements: [...fluxPlacements, ...bastionPlacements, ...snarePlacements],
    };
}
export function getEchoAccuracyBonus(battle, unit) {
    const placements = getEchoFieldsAffectingUnit(battle, unit, "static_zone");
    const amount = placements.reduce((maxBonus, placement) => (Math.max(maxBonus, getScaledLevelBonus(placement.level, 5, 10, 15))), 0);
    return { amount, triggeredPlacements: placements };
}
export function getEchoIncomingAccuracyPenalty(battle, unit) {
    const placements = getEchoFieldsAffectingUnit(battle, unit, "shroud_zone");
    const amount = placements.reduce((maxPenalty, placement) => (Math.max(maxPenalty, getScaledLevelBonus(placement.level, 5, 10, 15))), 0);
    return { amount, triggeredPlacements: placements };
}
export function getEchoTurnStartHealing(battle, unit) {
    const placements = getEchoFieldsAffectingUnit(battle, unit, "mender_zone");
    const amount = placements.reduce((maxHeal, placement) => (Math.max(maxHeal, getScaledLevelBonus(placement.level, 1, 2, 3))), 0);
    return { amount, triggeredPlacements: placements };
}
export function getEchoTurnStartStrainRelief(battle, unit) {
    const placements = getEchoFieldsAffectingUnit(battle, unit, "vent_zone");
    const amount = placements.reduce((maxRelief, placement) => (Math.max(maxRelief, getScaledLevelBonus(placement.level, 1, 1, 2))), 0);
    return { amount, triggeredPlacements: placements };
}
export function getEchoTurnStartGuarded(battle, unit) {
    const placements = getEchoFieldsAffectingUnit(battle, unit, "ward_zone");
    return { active: placements.length > 0, triggeredPlacements: placements };
}
export function getEchoTurnStartCleanse(battle, unit) {
    const placements = getEchoFieldsAffectingUnit(battle, unit, "null_zone");
    return {
        clearsBurning: placements.length > 0,
        clearsPoisoned: placements.length > 0,
        triggeredPlacements: placements,
    };
}
export function getEchoTurnStartDrawBonus(battle, unit) {
    const placements = getEchoFieldsAffectingUnit(battle, unit, "relay_zone");
    const amount = placements.reduce((maxDraw, placement) => (Math.max(maxDraw, placement.level >= 5 ? 2 : 1)), 0);
    return { amount, triggeredPlacements: placements };
}
export function getEchoFirstCardStrainDiscount(battle, unit) {
    const placements = getEchoFieldsAffectingUnit(battle, unit, "overdrive_zone");
    return {
        amount: placements.length > 0 ? 1 : 0,
        triggeredPlacements: placements,
    };
}
export function getEchoOnHitVulnerable(battle, unit) {
    const placements = getEchoFieldsAffectingUnit(battle, unit, "hex_zone");
    const duration = placements.reduce((maxDuration, placement) => (Math.max(maxDuration, placement.level >= 5 ? 2 : 1)), 0);
    return { duration, triggeredPlacements: placements };
}
export function incrementEchoFieldTriggerCount(battle, placements, logLine) {
    const echoContext = getEchoBattleContext(battle);
    if (!echoContext || placements.length === 0) {
        return battle;
    }
    const uniqueKeys = new Set(placements.map((placement) => `${placement.draftId}:${placement.x}:${placement.y}`));
    const increment = uniqueKeys.size;
    const nextLog = logLine && Array.isArray(battle.log)
        ? [...battle.log, logLine]
        : battle.log;
    return {
        ...battle,
        log: nextLog,
        modeContext: {
            ...battle.modeContext,
            kind: "echo",
            echo: {
                ...echoContext,
                fieldTriggerCount: (echoContext.fieldTriggerCount ?? 0) + increment,
            },
        },
    };
}

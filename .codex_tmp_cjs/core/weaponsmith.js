"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEAPONSMITH_UPGRADES = exports.BOWBLADE_BASE_MAX_ENERGY_CELLS = exports.BOWBLADE_MIN_ATTACK_CYCLE_MS = exports.BOWBLADE_BASE_ATTACK_CYCLE_MS = exports.BOWBLADE_BASE_PROJECTILE_SPEED = exports.BOWBLADE_BASE_RANGED_RANGE = exports.BOWBLADE_BASE_RANGED_DAMAGE = exports.BOWBLADE_BASE_MELEE_KNOCKBACK_FORCE = exports.BOWBLADE_BASE_MELEE_CHARGE_GAIN = exports.BOWBLADE_BASE_MELEE_DAMAGE = exports.COUNTERWEIGHT_WORKSHOP_MAP_ID = exports.COUNTERWEIGHT_WEAPONSMITH_ENCOUNTER_ID = void 0;
exports.createDefaultWeaponsmithState = createDefaultWeaponsmithState;
exports.withNormalizedWeaponsmithState = withNormalizedWeaponsmithState;
exports.isWeaponsmithUnlocked = isWeaponsmithUnlocked;
exports.getWeaponsmithInstalledUpgradeIds = getWeaponsmithInstalledUpgradeIds;
exports.getBowbladeFieldProfile = getBowbladeFieldProfile;
exports.getBowbladeWorkshopReadout = getBowbladeWorkshopReadout;
exports.getWeaponsmithUpgradeDefinitions = getWeaponsmithUpgradeDefinitions;
exports.isWeaponsmithUpgradeUnlocked = isWeaponsmithUpgradeUnlocked;
exports.getWeaponsmithCatalog = getWeaponsmithCatalog;
exports.installWeaponsmithUpgrade = installWeaponsmithUpgrade;
const session_1 = require("./session");
exports.COUNTERWEIGHT_WEAPONSMITH_ENCOUNTER_ID = "shaft_mechanist";
exports.COUNTERWEIGHT_WORKSHOP_MAP_ID = "counterweight_workshop";
const LEGACY_AERISS_BOWBLADE_ID = "weapon_aeriss_bowblade";
const LEGACY_BOWBLADE_CARD_IDS = new Set([
    "card_bowblade_reaping_cut",
    "card_bowblade_splitshot",
    "card_bowblade_shift_latch",
    "card_bowblade_ripcord",
    "card_bowblade_charge_release",
    "card_bowblade_powered_sunder",
]);
exports.BOWBLADE_BASE_MELEE_DAMAGE = 2;
exports.BOWBLADE_BASE_MELEE_CHARGE_GAIN = 2;
exports.BOWBLADE_BASE_MELEE_KNOCKBACK_FORCE = 600;
exports.BOWBLADE_BASE_RANGED_DAMAGE = 5;
exports.BOWBLADE_BASE_RANGED_RANGE = 400;
exports.BOWBLADE_BASE_PROJECTILE_SPEED = 500;
exports.BOWBLADE_BASE_ATTACK_CYCLE_MS = 400;
exports.BOWBLADE_MIN_ATTACK_CYCLE_MS = 160;
exports.BOWBLADE_BASE_MAX_ENERGY_CELLS = 5;
const EMPTY_FIELD_PROFILE = {
    meleeDamageBonus: 0,
    meleeKnockbackBonus: 0,
    meleeEnergyGainBonus: 0,
    rangedDamageBonus: 0,
    rangedRangeBonus: 0,
    rangedProjectileSpeedBonus: 0,
    attackCooldownDelta: 0,
    maxEnergyCellsBonus: 0,
};
exports.WEAPONSMITH_UPGRADES = {
    quickdraw_limbs: {
        id: "quickdraw_limbs",
        name: "Quickdraw Limbs",
        category: "ranged",
        summary: "Lightens draw timing for faster ranged follow-through.",
        detail: "Rebalances the bowblade arms for quicker release cycles and cleaner projectile travel.",
        cost: {
            wad: 120,
            resources: {
                drawcord: 2,
                fittings: 1,
            },
        },
        fieldProfile: {
            attackCooldownDelta: -40,
            rangedProjectileSpeedBonus: 120,
        },
    },
    stabilized_sightline: {
        id: "stabilized_sightline",
        name: "Stabilized Sightline",
        category: "ranged",
        summary: "Trues the upper rail for steadier long-range fire.",
        detail: "Adds a resin-sealed sightline assembly that keeps ranged shots stable deeper into the shaft lanes.",
        cost: {
            wad: 130,
            resources: {
                drawcord: 2,
                resin: 1,
            },
        },
        fieldProfile: {
            rangedRangeBonus: 100,
        },
    },
    reinforced_edge: {
        id: "reinforced_edge",
        name: "Reinforced Edge",
        category: "melee",
        summary: "Hardens the blade spine for stronger close-quarters cuts.",
        detail: "Alloy lamination gives the bowblade a heavier bite without compromising its hybrid frame.",
        cost: {
            wad: 130,
            resources: {
                alloy: 2,
                resin: 1,
            },
        },
        fieldProfile: {
            meleeDamageBonus: 1,
        },
    },
    tempered_spine: {
        id: "tempered_spine",
        name: "Tempered Spine",
        category: "melee",
        summary: "Improves impact transfer and charge gain on melee contact.",
        detail: "The internal spine is rebalanced with alloy ribs and fittings, letting each hit land harder and feed more power back into the frame.",
        cost: {
            wad: 145,
            resources: {
                alloy: 2,
                fittings: 1,
            },
        },
        fieldProfile: {
            meleeKnockbackBonus: 250,
            meleeEnergyGainBonus: 1,
        },
    },
    transition_latch: {
        id: "transition_latch",
        name: "Transition Latch",
        category: "handling",
        summary: "Tightens the bowblade's recovery between actions.",
        detail: "A rebuilt latch assembly smooths field handling and keeps Aeriss responsive when chaining blade and bow pressure together.",
        cost: {
            wad: 140,
            resources: {
                fittings: 2,
                drawcord: 1,
            },
        },
        fieldProfile: {
            attackCooldownDelta: -70,
            maxEnergyCellsBonus: 1,
        },
    },
    charge_assisted_release: {
        id: "charge_assisted_release",
        name: "Charge-Assisted Release",
        category: "powered",
        summary: "Routes stored charge into harder, faster powered shots.",
        detail: "Adds a powered release loop that amplifies ranged attacks when Aeriss spends stored energy cells in the field.",
        cost: {
            wad: 230,
            resources: {
                chargeCells: 2,
                fittings: 2,
            },
        },
        fieldProfile: {
            rangedDamageBonus: 2,
            rangedProjectileSpeedBonus: 60,
        },
    },
    powered_counterstroke: {
        id: "powered_counterstroke",
        name: "Powered Counterstroke",
        category: "powered",
        summary: "Feeds stored charge back into close-range strikes.",
        detail: "Routes charge through the hilt and recoil frame, letting committed melee returns hit harder and keep the bowblade running hot.",
        cost: {
            wad: 240,
            resources: {
                chargeCells: 1,
                alloy: 2,
                resin: 1,
            },
        },
        fieldProfile: {
            meleeDamageBonus: 1,
            maxEnergyCellsBonus: 1,
            attackCooldownDelta: -30,
        },
    },
};
const WEAPONSMITH_UPGRADE_ORDER = [
    "quickdraw_limbs",
    "stabilized_sightline",
    "reinforced_edge",
    "tempered_spine",
    "transition_latch",
    "charge_assisted_release",
    "powered_counterstroke",
];
function mergeFieldProfile(base, delta) {
    return {
        meleeDamageBonus: base.meleeDamageBonus + Number(delta?.meleeDamageBonus ?? 0),
        meleeKnockbackBonus: base.meleeKnockbackBonus + Number(delta?.meleeKnockbackBonus ?? 0),
        meleeEnergyGainBonus: base.meleeEnergyGainBonus + Number(delta?.meleeEnergyGainBonus ?? 0),
        rangedDamageBonus: base.rangedDamageBonus + Number(delta?.rangedDamageBonus ?? 0),
        rangedRangeBonus: base.rangedRangeBonus + Number(delta?.rangedRangeBonus ?? 0),
        rangedProjectileSpeedBonus: base.rangedProjectileSpeedBonus + Number(delta?.rangedProjectileSpeedBonus ?? 0),
        attackCooldownDelta: base.attackCooldownDelta + Number(delta?.attackCooldownDelta ?? 0),
        maxEnergyCellsBonus: base.maxEnergyCellsBonus + Number(delta?.maxEnergyCellsBonus ?? 0),
    };
}
function getInstalledUpgradeDefinitions(installedUpgradeIds) {
    return installedUpgradeIds
        .map((upgradeId) => exports.WEAPONSMITH_UPGRADES[upgradeId])
        .filter((definition) => Boolean(definition));
}
function hasZoneBeenCleared(state, zoneId) {
    return Number(state.outerDecks?.zoneCompletionCounts?.[zoneId] ?? 0) > 0;
}
function hasAdvancedMaterial(state, resourceKey) {
    return Number((0, session_1.getSessionResourcePool)(state, (0, session_1.getLocalSessionPlayerSlot)(state)).resources?.[resourceKey] ?? 0) > 0;
}
function getUpgradeUnlockLabel(state, upgradeId) {
    if (!isWeaponsmithUnlocked(state)) {
        return "Unlock the Counterweight workshop.";
    }
    switch (upgradeId) {
        case "stabilized_sightline":
            return hasZoneBeenCleared(state, "outer_scaffold") || hasAdvancedMaterial(state, "resin")
                ? "Recovered sightline notes."
                : "Requires resin exposure or Outer Scaffold notes.";
        case "tempered_spine":
            return hasZoneBeenCleared(state, "counterweight_shaft") || hasAdvancedMaterial(state, "alloy")
                ? "Counterweight frame data recovered."
                : "Requires alloy exposure or a secured Counterweight run.";
        case "charge_assisted_release":
            return hasZoneBeenCleared(state, "drop_bay")
                ? "Schema Authorization // Drop Bay power routing."
                : "Requires Drop Bay schema authorization.";
        case "powered_counterstroke":
            return hasZoneBeenCleared(state, "supply_intake_port")
                ? "Schema Authorization // Intake drive lattice."
                : "Requires Supply Intake schema authorization.";
        default:
            return "Workshop bench is ready.";
    }
}
function stripLegacyBowbladeCards(cardIds) {
    if (!cardIds?.some((cardId) => LEGACY_BOWBLADE_CARD_IDS.has(cardId))) {
        return cardIds;
    }
    return cardIds.filter((cardId) => !LEGACY_BOWBLADE_CARD_IDS.has(cardId));
}
function sanitizeLegacyBowbladeBattleState(battle) {
    if (!battle) {
        return battle;
    }
    let changed = false;
    const nextUnits = Object.fromEntries(Object.entries(battle.units).map(([unitId, unit]) => {
        const battleUnit = unit;
        const loadoutNeedsCleanup = Boolean(battleUnit.loadout
            && (battleUnit.loadout.primaryWeapon === LEGACY_AERISS_BOWBLADE_ID
                || battleUnit.loadout.secondaryWeapon === LEGACY_AERISS_BOWBLADE_ID
                || battleUnit.loadout.weapon === LEGACY_AERISS_BOWBLADE_ID));
        const nextLoadout = loadoutNeedsCleanup && battleUnit.loadout
            ? {
                ...battleUnit.loadout,
                primaryWeapon: battleUnit.loadout.primaryWeapon === LEGACY_AERISS_BOWBLADE_ID
                    ? null
                    : battleUnit.loadout.primaryWeapon,
                secondaryWeapon: battleUnit.loadout.secondaryWeapon === LEGACY_AERISS_BOWBLADE_ID
                    ? null
                    : battleUnit.loadout.secondaryWeapon,
                weapon: battleUnit.loadout.weapon === LEGACY_AERISS_BOWBLADE_ID
                    ? null
                    : battleUnit.loadout.weapon,
            }
            : battleUnit.loadout;
        const nextHand = stripLegacyBowbladeCards(battleUnit.hand);
        const nextDrawPile = stripLegacyBowbladeCards(battleUnit.drawPile);
        const nextDiscardPile = stripLegacyBowbladeCards(battleUnit.discardPile);
        const nextExhaustedPile = stripLegacyBowbladeCards(battleUnit.exhaustedPile);
        const hadLegacyWeapon = battleUnit.equippedWeaponId === LEGACY_AERISS_BOWBLADE_ID;
        const cardsChanged = (nextHand !== battleUnit.hand
            || nextDrawPile !== battleUnit.drawPile
            || nextDiscardPile !== battleUnit.discardPile
            || nextExhaustedPile !== battleUnit.exhaustedPile);
        if (!hadLegacyWeapon && !loadoutNeedsCleanup && !cardsChanged) {
            return [unitId, unit];
        }
        changed = true;
        return [unitId, {
                ...battleUnit,
                loadout: nextLoadout,
                hand: nextHand ?? battleUnit.hand,
                drawPile: nextDrawPile ?? battleUnit.drawPile,
                discardPile: nextDiscardPile ?? battleUnit.discardPile,
                exhaustedPile: nextExhaustedPile ?? battleUnit.exhaustedPile,
                equippedWeaponId: hadLegacyWeapon ? null : battleUnit.equippedWeaponId,
                weaponState: hadLegacyWeapon ? null : battleUnit.weaponState,
                weaponWear: hadLegacyWeapon ? 0 : battleUnit.weaponWear,
            }];
    }));
    if (!changed) {
        return battle;
    }
    return {
        ...battle,
        units: nextUnits,
    };
}
function createDefaultWeaponsmithState() {
    return {
        installedUpgradeIds: [],
    };
}
function withNormalizedWeaponsmithState(state) {
    const nextWeaponsmith = state.weaponsmith ?? createDefaultWeaponsmithState();
    const hadLegacyBowblade = Boolean(state.equipmentById?.[LEGACY_AERISS_BOWBLADE_ID]);
    const { [LEGACY_AERISS_BOWBLADE_ID]: legacyBowblade, ...remainingEquipmentById } = state.equipmentById ?? {};
    void legacyBowblade;
    const nextCurrentBattle = sanitizeLegacyBowbladeBattleState(state.currentBattle);
    const battleNeedsCleanup = nextCurrentBattle !== state.currentBattle;
    const aeriss = state.unitsById?.unit_aeriss;
    const aerissLoadout = aeriss?.loadout;
    const aerissNeedsCleanup = Boolean(aerissLoadout
        && (aerissLoadout.primaryWeapon === LEGACY_AERISS_BOWBLADE_ID
            || aerissLoadout.secondaryWeapon === LEGACY_AERISS_BOWBLADE_ID));
    if (!state.weaponsmith && !hadLegacyBowblade && !aerissNeedsCleanup && !battleNeedsCleanup) {
        return {
            ...state,
            weaponsmith: nextWeaponsmith,
        };
    }
    if (state.weaponsmith && !hadLegacyBowblade && !aerissNeedsCleanup && !battleNeedsCleanup) {
        return state;
    }
    return {
        ...state,
        weaponsmith: nextWeaponsmith,
        currentBattle: nextCurrentBattle,
        equipmentById: hadLegacyBowblade ? remainingEquipmentById : state.equipmentById,
        unitsById: aerissNeedsCleanup && aeriss && aerissLoadout
            ? {
                ...state.unitsById,
                unit_aeriss: {
                    ...aeriss,
                    loadout: {
                        ...aerissLoadout,
                        primaryWeapon: aerissLoadout.primaryWeapon === LEGACY_AERISS_BOWBLADE_ID
                            ? null
                            : aerissLoadout.primaryWeapon,
                        secondaryWeapon: aerissLoadout.secondaryWeapon === LEGACY_AERISS_BOWBLADE_ID
                            ? null
                            : aerissLoadout.secondaryWeapon,
                    },
                },
            }
            : state.unitsById,
    };
}
function isWeaponsmithUnlocked(state) {
    return Boolean(state.outerDecks?.seenNpcEncounterIds?.includes(exports.COUNTERWEIGHT_WEAPONSMITH_ENCOUNTER_ID));
}
function getWeaponsmithInstalledUpgradeIds(state) {
    return [...(state.weaponsmith?.installedUpgradeIds ?? [])];
}
function getBowbladeFieldProfile(state) {
    return getInstalledUpgradeDefinitions(getWeaponsmithInstalledUpgradeIds(state))
        .reduce((profile, definition) => mergeFieldProfile(profile, definition.fieldProfile), { ...EMPTY_FIELD_PROFILE });
}
function getBowbladeWorkshopReadout(state) {
    const profile = getBowbladeFieldProfile(state);
    return {
        name: "Aeriss Bowblade",
        meleeDamage: exports.BOWBLADE_BASE_MELEE_DAMAGE + profile.meleeDamageBonus,
        meleeChargeGain: exports.BOWBLADE_BASE_MELEE_CHARGE_GAIN + profile.meleeEnergyGainBonus,
        meleeImpact: exports.BOWBLADE_BASE_MELEE_KNOCKBACK_FORCE + profile.meleeKnockbackBonus,
        rangedDamage: exports.BOWBLADE_BASE_RANGED_DAMAGE + profile.rangedDamageBonus,
        rangedRange: exports.BOWBLADE_BASE_RANGED_RANGE + profile.rangedRangeBonus,
        projectileSpeed: exports.BOWBLADE_BASE_PROJECTILE_SPEED + profile.rangedProjectileSpeedBonus,
        attackCycleMs: Math.max(exports.BOWBLADE_MIN_ATTACK_CYCLE_MS, exports.BOWBLADE_BASE_ATTACK_CYCLE_MS + profile.attackCooldownDelta),
        maxEnergyCells: Math.max(1, exports.BOWBLADE_BASE_MAX_ENERGY_CELLS + profile.maxEnergyCellsBonus),
    };
}
function getWeaponsmithUpgradeDefinitions() {
    return WEAPONSMITH_UPGRADE_ORDER.map((upgradeId) => exports.WEAPONSMITH_UPGRADES[upgradeId]);
}
function isWeaponsmithUpgradeUnlocked(state, upgradeId) {
    if (!isWeaponsmithUnlocked(state)) {
        return false;
    }
    switch (upgradeId) {
        case "stabilized_sightline":
            return hasZoneBeenCleared(state, "outer_scaffold") || hasAdvancedMaterial(state, "resin");
        case "tempered_spine":
            return hasZoneBeenCleared(state, "counterweight_shaft") || hasAdvancedMaterial(state, "alloy");
        case "charge_assisted_release":
            return hasZoneBeenCleared(state, "drop_bay");
        case "powered_counterstroke":
            return hasZoneBeenCleared(state, "supply_intake_port");
        default:
            return true;
    }
}
function getWeaponsmithCatalog(state) {
    const installedUpgradeIds = new Set(getWeaponsmithInstalledUpgradeIds(state));
    return getWeaponsmithUpgradeDefinitions().map((definition) => ({
        definition,
        installed: installedUpgradeIds.has(definition.id),
        unlocked: isWeaponsmithUpgradeUnlocked(state, definition.id),
        unlockLabel: getUpgradeUnlockLabel(state, definition.id),
    }));
}
function installWeaponsmithUpgrade(state, upgradeId) {
    const definition = exports.WEAPONSMITH_UPGRADES[upgradeId];
    if (!definition) {
        return {
            ok: false,
            state,
            error: "Upgrade definition was not found.",
        };
    }
    if (!isWeaponsmithUnlocked(state)) {
        return {
            ok: false,
            state,
            error: "The Counterweight workshop is not online yet.",
        };
    }
    if (!isWeaponsmithUpgradeUnlocked(state, upgradeId)) {
        return {
            ok: false,
            state,
            error: getUpgradeUnlockLabel(state, upgradeId),
        };
    }
    if (getWeaponsmithInstalledUpgradeIds(state).includes(upgradeId)) {
        return {
            ok: false,
            state,
            error: "That upgrade is already installed.",
        };
    }
    if (!(0, session_1.canSessionAffordCost)(state, {
        wad: definition.cost.wad,
        resources: definition.cost.resources,
    })) {
        return {
            ok: false,
            state,
            error: "Required workshop funding or advanced materials are missing.",
        };
    }
    const spendResult = (0, session_1.spendSessionCost)(state, {
        wad: definition.cost.wad,
        resources: definition.cost.resources,
    });
    if (!spendResult.success) {
        return {
            ok: false,
            state,
            error: "Required workshop funding or advanced materials are missing.",
        };
    }
    return {
        ok: true,
        state: withNormalizedWeaponsmithState({
            ...spendResult.state,
            weaponsmith: {
                ...(state.weaponsmith ?? createDefaultWeaponsmithState()),
                installedUpgradeIds: [
                    ...getWeaponsmithInstalledUpgradeIds(state),
                    upgradeId,
                ],
            },
        }),
    };
}

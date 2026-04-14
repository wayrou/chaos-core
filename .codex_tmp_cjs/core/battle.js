"use strict";
// ============================================================================
// BATTLE SYSTEM - Updated with Equipment-Based Decks (11b/11c integration)
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_STRAIN_THRESHOLD = void 0;
exports.getLoadPenalties = getLoadPenalties;
exports.hasStatus = hasStatus;
exports.addStatus = addStatus;
exports.removeStatus = removeStatus;
exports.removeAllStatusesFromSource = removeAllStatusesFromSource;
exports.createGrid = createGrid;
exports.createBattleUnitState = createBattleUnitState;
exports.computeTurnOrder = computeTurnOrder;
exports.getStrainThreshold = getStrainThreshold;
exports.isOverStrainThreshold = isOverStrainThreshold;
exports.applyStrain = applyStrain;
exports.advanceTurn = advanceTurn;
exports.appendBattleLog = appendBattleLog;
exports.getSquadObjectiveControlSide = getSquadObjectiveControlSide;
exports.getActiveUnit = getActiveUnit;
exports.getBattleUnitEquippedWeaponId = getBattleUnitEquippedWeaponId;
exports.getEquippedWeapon = getEquippedWeapon;
exports.updateUnitWeaponState = updateUnitWeaponState;
exports.applyWeaponOverheatEffects = applyWeaponOverheatEffects;
exports.applyWeaponHitToUnit = applyWeaponHitToUnit;
exports.applyTheaterCombatInstability = applyTheaterCombatInstability;
exports.unitHasMountPassive = unitHasMountPassive;
exports.isUnitMounted = isUnitMounted;
exports.getMountMovementBonus = getMountMovementBonus;
exports.getUnitMovementRange = getUnitMovementRange;
exports.getChargeDamageBonus = getChargeDamageBonus;
exports.getArmoredDamageReduction = getArmoredDamageReduction;
exports.getIntimidateAccuracyPenalty = getIntimidateAccuracyPenalty;
exports.arePositionsAdjacent = arePositionsAdjacent;
exports.isInsideBounds = isInsideBounds;
exports.getTileAt = getTileAt;
exports.getTraversalDestinations = getTraversalDestinations;
exports.getMapObjectAt = getMapObjectAt;
exports.getMapObjectsAt = getMapObjectsAt;
exports.hasTraversalBetween = hasTraversalBetween;
exports.canTraverseElevationStep = canTraverseElevationStep;
exports.isWalkableTile = isWalkableTile;
exports.canUnitMoveTo = canUnitMoveTo;
exports.getReachableMovementTiles = getReachableMovementTiles;
exports.getMovePath = getMovePath;
exports.getUnitInteractionObject = getUnitInteractionObject;
exports.canUnitInteract = canUnitInteract;
exports.interactWithMapObject = interactWithMapObject;
exports.moveUnit = moveUnit;
exports.canUnitAttackTarget = canUnitAttackTarget;
exports.computeHitChance = computeHitChance;
exports.attackUnit = attackUnit;
exports.performEnemyTurn = performEnemyTurn;
exports.performAutoBattleTurn = performAutoBattleTurn;
exports.evaluateBattleOutcome = evaluateBattleOutcome;
exports.drawCardsForTurn = drawCardsForTurn;
exports.calculateMaxUnitsPerSide = calculateMaxUnitsPerSide;
exports.createTestBattleForCurrentParty = createTestBattleForCurrentParty;
exports.playCard = playCard;
exports.drawCards = drawCards;
exports.getPlacementTilesForUnit = getPlacementTilesForUnit;
exports.getEffectivePlacedUnitIds = getEffectivePlacedUnitIds;
exports.placeUnit = placeUnit;
exports.quickPlaceUnits = quickPlaceUnits;
exports.removePlacedUnit = removePlacedUnit;
exports.setPlacementSelectedUnit = setPlacementSelectedUnit;
exports.confirmPlacement = confirmPlacement;
// Debug flag for battle system (15a-15e)
const DEBUG_BATTLE = false;
const inventory_1 = require("./inventory");
const terrainGeneration_1 = require("./terrainGeneration");
const operationStatuses_1 = require("./operationStatuses");
const equipment_1 = require("./equipment");
const weaponSystem_1 = require("./weaponSystem");
const cardCatalog_1 = require("./cardCatalog");
// STEP 6 & 7: Import gear workbench functions
const gearWorkbench_1 = require("./gearWorkbench");
const gearRewards_1 = require("./gearRewards");
// Mount system imports
const mounts_1 = require("./mounts");
// Import affinity tracking
const affinityBattle_1 = require("./affinityBattle");
const fieldModBattleIntegration_1 = require("./fieldModBattleIntegration");
const coverGenerator_1 = require("./coverGenerator");
const echoFieldEffects_1 = require("./echoFieldEffects");
// Import unlockable system (for battle rewards)
const unlockables_1 = require("./unlockables");
const unlockableOwnership_1 = require("./unlockableOwnership");
const enemies_1 = require("./enemies");
// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------
function normalizeBattleLoadout(loadoutLike) {
    const normalizeEquipmentId = (value) => {
        if (typeof value !== "string") {
            return value ?? null;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    };
    return {
        primaryWeapon: normalizeEquipmentId(loadoutLike?.primaryWeapon) ?? normalizeEquipmentId(loadoutLike?.weapon) ?? null,
        secondaryWeapon: normalizeEquipmentId(loadoutLike?.secondaryWeapon) ?? null,
        helmet: normalizeEquipmentId(loadoutLike?.helmet) ?? null,
        chestpiece: normalizeEquipmentId(loadoutLike?.chestpiece) ?? null,
        accessory1: normalizeEquipmentId(loadoutLike?.accessory1) ?? null,
        accessory2: normalizeEquipmentId(loadoutLike?.accessory2) ?? null,
    };
}
function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
    }
    return copy;
}
function getLoadPenalties(state) {
    return state.loadPenalties ?? null;
}
// ----------------------------------------------------------------------------
// STATUS EFFECTS
// ----------------------------------------------------------------------------
function hasStatus(unit, type) {
    if (!unit.statuses)
        return false;
    return unit.statuses.some(s => s.type === type);
}
function addStatus(state, unitId, type, duration = 1, sourceId) {
    const unit = state.units[unitId];
    if (!unit)
        return state;
    const currentStatuses = unit.statuses || [];
    // Rule: same status doesn't stack unless stated; reapplying refreshes duration.
    const existingIndex = currentStatuses.findIndex(s => s.type === type);
    let newStatuses = [...currentStatuses];
    if (existingIndex >= 0) {
        newStatuses[existingIndex] = { ...newStatuses[existingIndex], duration: Math.max(newStatuses[existingIndex].duration, duration) };
    }
    else {
        newStatuses.push({ type, duration, sourceId });
    }
    return {
        ...state,
        units: {
            ...state.units,
            [unitId]: { ...unit, statuses: newStatuses }
        }
    };
}
function removeStatus(state, unitId, type) {
    const unit = state.units[unitId];
    if (!unit || !unit.statuses)
        return state;
    return {
        ...state,
        units: {
            ...state.units,
            [unitId]: { ...unit, statuses: unit.statuses.filter(s => s.type !== type) }
        }
    };
}
function removeAllStatusesFromSource(state, sourceId) {
    let nextState = { ...state };
    for (const unitId of Object.keys(nextState.units)) {
        const unit = nextState.units[unitId];
        if (unit.statuses && unit.statuses.some(s => s.sourceId === sourceId)) {
            nextState.units[unitId] = {
                ...unit,
                statuses: unit.statuses.filter(s => s.sourceId !== sourceId)
            };
        }
    }
    return nextState;
}
function applyEchoTurnStartEffects(state, unitId) {
    const unit = state.units[unitId];
    if (!unit) {
        return state;
    }
    let next = state;
    const healing = (0, echoFieldEffects_1.getEchoTurnStartHealing)(next, unit);
    if (healing.amount > 0) {
        const updatedUnit = next.units[unitId];
        const healedHp = Math.min(updatedUnit.maxHp, updatedUnit.hp + healing.amount);
        const actualHeal = healedHp - updatedUnit.hp;
        if (actualHeal > 0) {
            next = {
                ...next,
                units: {
                    ...next.units,
                    [unitId]: {
                        ...updatedUnit,
                        hp: healedHp,
                    },
                },
            };
            next = (0, echoFieldEffects_1.incrementEchoFieldTriggerCount)(next, healing.triggeredPlacements, `SLK//ECHO  :: ${unit.name} restores ${actualHeal} HP from Mender Zone.`);
        }
    }
    const strainRelief = (0, echoFieldEffects_1.getEchoTurnStartStrainRelief)(next, unit);
    if (strainRelief.amount > 0) {
        const updatedUnit = next.units[unitId];
        next = {
            ...next,
            units: {
                ...next.units,
                [unitId]: {
                    ...updatedUnit,
                    strain: Math.max(0, updatedUnit.strain - strainRelief.amount),
                },
            },
        };
        next = (0, echoFieldEffects_1.incrementEchoFieldTriggerCount)(next, strainRelief.triggeredPlacements, `SLK//ECHO  :: ${unit.name} vents ${strainRelief.amount} Strain.`);
    }
    const cleanse = (0, echoFieldEffects_1.getEchoTurnStartCleanse)(next, unit);
    if (cleanse.triggeredPlacements.length > 0) {
        const hadBurning = hasStatus(next.units[unitId], "burning");
        const hadPoisoned = hasStatus(next.units[unitId], "poisoned");
        if (cleanse.clearsBurning) {
            next = removeStatus(next, unitId, "burning");
        }
        if (cleanse.clearsPoisoned) {
            next = removeStatus(next, unitId, "poisoned");
        }
        if (hadBurning || hadPoisoned) {
            next = (0, echoFieldEffects_1.incrementEchoFieldTriggerCount)(next, cleanse.triggeredPlacements, `SLK//ECHO  :: ${unit.name} is cleansed by Null Zone.`);
        }
    }
    const guarded = (0, echoFieldEffects_1.getEchoTurnStartGuarded)(next, unit);
    if (guarded.active) {
        next = addStatus(next, unitId, "guarded", 1);
        next = (0, echoFieldEffects_1.incrementEchoFieldTriggerCount)(next, guarded.triggeredPlacements, `SLK//ECHO  :: ${unit.name} enters Guarded stance in Ward Zone.`);
    }
    return next;
}
// ----------------------------------------------------------------------------
// GRID CREATION
// ----------------------------------------------------------------------------
function createGrid(width, height, elevationMap) {
    const tiles = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const terrain = "floor";
            const elevation = elevationMap ? (elevationMap[x]?.[y] ?? 0) : 0;
            tiles.push({
                pos: { x, y },
                terrain,
                elevation,
                surface: "industrial",
            });
        }
    }
    return tiles;
}
// ----------------------------------------------------------------------------
// BATTLE UNIT STATE CREATION - NOW WITH EQUIPMENT-BASED DECKS
// ----------------------------------------------------------------------------
/**
 * Build a BattleUnitState from a global Unit and placement info.
 * NOW: Builds deck from equipment loadout instead of using base.deck
 * MOUNT SYSTEM: Also applies mount modifiers if unit has a mount assigned
 */
function createBattleUnitState(base, opts, equipmentById) {
    // Get equipment data
    const equipment = equipmentById || (0, equipment_1.getAllStarterEquipment)();
    // Get unit's class and loadout (with fallbacks)
    const unitClass = base.unitClass || "squire";
    const loadout = normalizeBattleLoadout(base.loadout);
    const usesLoadoutRules = !opts.isEnemy ||
        Boolean(loadout.primaryWeapon ||
            loadout.secondaryWeapon ||
            loadout.helmet ||
            loadout.chestpiece ||
            loadout.accessory1 ||
            loadout.accessory2);
    // BUILD DECK FROM EQUIPMENT (the key change!)
    let deckCards;
    if (!usesLoadoutRules) {
        // Enemies use their drawPile (or a simple default)
        deckCards = base.drawPile && base.drawPile.length > 0
            ? [...base.drawPile]
            : ["core_basic_attack", "core_basic_attack", "core_guard", "core_wait"];
    }
    else {
        deckCards = (0, equipment_1.buildDeckFromLoadout)(unitClass, loadout, equipment, opts.gearSlots);
    }
    // Calculate equipment stat bonuses
    const equipStats = (0, equipment_1.calculateEquipmentStats)(loadout, equipment);
    // Base stats + equipment bonuses
    const baseAtk = base.atk ?? base.stats?.atk ?? 10;
    const baseDef = base.def ?? base.stats?.def ?? 5;
    const baseAgi = base.agi ?? base.stats?.agi ?? 3;
    const baseAcc = base.acc ?? base.stats?.acc ?? 80;
    const baseMaxHp = base.maxHp ?? base.stats?.maxHp ?? 12;
    const baseCurrentHp = Math.max(0, Math.min(baseMaxHp, base.hp ?? baseMaxHp));
    let finalAtk = baseAtk + (usesLoadoutRules ? equipStats.atk : 0);
    let finalDef = baseDef + (usesLoadoutRules ? equipStats.def : 0);
    let finalAgi = baseAgi + (usesLoadoutRules ? equipStats.agi : 0);
    let finalAcc = baseAcc + (usesLoadoutRules ? equipStats.acc : 0);
    let finalMaxHp = baseMaxHp + (usesLoadoutRules ? equipStats.hp : 0);
    // MOUNT SYSTEM: Apply mount modifiers if unit has a mount
    let mountId;
    let mountPassiveTraits;
    let baseStatsBeforeMount;
    if (usesLoadoutRules && !opts.isEnemy && base.mountInstanceId && opts.stable) {
        const mountInstance = (0, mounts_1.findOwnedMount)(opts.stable, base.mountInstanceId);
        if (mountInstance) {
            const mount = (0, mounts_1.getMountById)(mountInstance.mountId);
            if (mount) {
                // Store base stats before mount for potential rollback
                baseStatsBeforeMount = {
                    hp: finalMaxHp,
                    maxHp: finalMaxHp,
                    atk: finalAtk,
                    def: finalDef,
                    agi: finalAgi,
                    acc: finalAcc,
                };
                // Apply mount stat modifiers
                const mountStats = mount.statModifiers;
                finalMaxHp += mountStats.hp ?? 0;
                finalAtk += mountStats.atk ?? 0;
                finalDef += mountStats.def ?? 0;
                finalAgi += mountStats.agi ?? 0;
                finalAcc += mountStats.acc ?? 0;
                // Note: movement bonus is handled separately in movement logic
                // Get mount cards and validate them
                const validCards = (0, mounts_1.validateMountCards)(mount.grantedCards);
                if (validCards.length > 0) {
                    deckCards = [...deckCards, ...validCards];
                }
                // Store mount info for battle reference
                mountId = mount.id;
                mountPassiveTraits = mount.passiveTraits;
                console.log(`[BATTLE] Unit ${base.name} mounted on ${mount.name}: +${mountStats.hp ?? 0} HP, +${mountStats.atk ?? 0} ATK, +${mountStats.def ?? 0} DEF, +${mountStats.agi ?? 0} AGI`);
            }
            else {
                // Mount definition not found - fail safe, continue without mount
                console.warn(`[BATTLE] Mount definition not found for ${mountInstance.mountId}, continuing as infantry`);
            }
        }
        else {
            // Mount instance not found - fail safe, continue without mount
            console.warn(`[BATTLE] Mount instance not found: ${base.mountInstanceId}, continuing as infantry`);
        }
    }
    // Shuffle the deck (after potentially adding mount cards)
    const deck = shuffleArray(deckCards);
    const hand = [];
    const discardPile = [];
    const exhaustedPile = [];
    // Initialize weapon state (14b)
    let equippedWeaponId = null;
    let weaponState = null;
    if (usesLoadoutRules && loadout.primaryWeapon) {
        const weapon = equipment[loadout.primaryWeapon];
        if (weapon && weapon.slot === "weapon") {
            equippedWeaponId = loadout.primaryWeapon;
            weaponState = (0, weaponSystem_1.createWeaponRuntimeState)(weapon);
        }
    }
    const hpBonusFromLoadout = finalMaxHp - baseMaxHp;
    const startingHp = Math.max(0, Math.min(finalMaxHp, baseCurrentHp + hpBonusFromLoadout));
    return {
        id: base.id,
        baseUnitId: base.id,
        name: base.name,
        classId: base.unitClass ?? "squire",
        loadout: { ...loadout, weapon: loadout.primaryWeapon ?? null },
        isEnemy: opts.isEnemy,
        pos: opts.pos,
        facing: opts.isEnemy ? "west" : "east", // Enemies face left, allies face right
        hp: startingHp,
        maxHp: finalMaxHp,
        atk: finalAtk,
        def: finalDef,
        agi: finalAgi,
        acc: finalAcc,
        strain: (0, operationStatuses_1.getShakenStartingStrain)(base),
        drawPile: deck,
        hand,
        discardPile,
        exhaustedPile,
        buffs: [...(base.buffs ?? [])],
        equippedWeaponId,
        weaponState,
        clutchActive: false,
        weaponHeat: 0,
        weaponWear: weaponState?.wear ?? 0,
        controller: base.controller ?? (opts.isEnemy ? undefined : "P1"),
        autoBattleMode: "manual",
        turnCardsPlayed: 0,
        // Mount fields
        mountId,
        mountPassiveTraits,
        baseStatsBeforeMount,
    };
}
// ----------------------------------------------------------------------------
// TURN ORDER
// ----------------------------------------------------------------------------
function computeTurnOrder(units) {
    // Only units with a position and HP > 0 can be in the turn order
    const entries = Object.values(units).filter(u => u.pos != null && u.hp > 0);
    entries.sort((a, b) => {
        const aAgiDelta = (a.buffs || [])
            .filter((buff) => buff.type === "agi_up" || buff.type === "agi_down")
            .reduce((sum, buff) => sum + buff.amount, 0);
        const bAgiDelta = (b.buffs || [])
            .filter((buff) => buff.type === "agi_up" || buff.type === "agi_down")
            .reduce((sum, buff) => sum + buff.amount, 0);
        const aInitiative = a.agi + aAgiDelta;
        const bInitiative = b.agi + bAgiDelta;
        if (bInitiative !== aInitiative) {
            return bInitiative - aInitiative;
        }
        if (a.id < b.id)
            return -1;
        if (a.id > b.id)
            return 1;
        return 0;
    });
    return entries.map((u) => u.id);
}
// ----------------------------------------------------------------------------
// STRAIN SYSTEM
// ----------------------------------------------------------------------------
exports.BASE_STRAIN_THRESHOLD = 6;
function getStrainThreshold() {
    return exports.BASE_STRAIN_THRESHOLD;
}
function isOverStrainThreshold(unit) {
    return unit.strain >= getStrainThreshold();
}
function applyStrain(state, unit, amount) {
    const oldStrain = unit.strain;
    const effectiveAmount = state.theaterBonuses?.overheating && amount > 0 ? amount * 2 : amount;
    const newStrain = Math.max(0, oldStrain + effectiveAmount);
    const updated = {
        ...unit,
        strain: newStrain,
    };
    let next = {
        ...state,
        units: {
            ...state.units,
            [unit.id]: updated,
        },
    };
    const wasOver = oldStrain >= getStrainThreshold();
    const nowOver = newStrain >= getStrainThreshold();
    if (!wasOver && nowOver) {
        next = appendBattleLog(next, `SLK//ALERT :: ${unit.name}'s vitals spike - STRAIN threshold exceeded.`);
    }
    return next;
}
// ----------------------------------------------------------------------------
// TURN ADVANCEMENT
// ----------------------------------------------------------------------------
function advanceTurn(state) {
    if (state.turnOrder.length === 0) {
        return state;
    }
    // --- DISCARD CURRENT UNIT'S HAND (if player unit) ---
    let newState = resolveSquadObjectiveEndTurn(state, state.activeUnitId);
    newState = evaluateBattleOutcome(newState);
    if (newState.phase === "victory" || newState.phase === "defeat") {
        return newState;
    }
    if (newState.activeUnitId && newState.units[newState.activeUnitId]) {
        const currentUnit = newState.units[newState.activeUnitId];
        // If unit is stunned, they don't discard hand because they skip turn logic usually, but here they just get 1 action. 
        // Wait, GDD: "Stunned: You can take only 1 action on your turn". We'll handle action limits in the UI/Card Handler.
        // For now, normal discard.
        if (!currentUnit.isEnemy && currentUnit.hand.length > 0) {
            const discardableHandCards = currentUnit.hand.filter((cardId) => !(0, cardCatalog_1.getResolvedBattleCard)(cardId)?.isChaosCard);
            // Move all cards from hand to discard pile
            const newUnits = { ...newState.units };
            newUnits[newState.activeUnitId] = {
                ...currentUnit,
                discardPile: [...currentUnit.discardPile, ...discardableHandCards],
                hand: [], // Clear hand
            };
            newState = {
                ...newState,
                units: newUnits,
            };
        }
    }
    const recomputedTurnOrder = computeTurnOrder(newState.units);
    newState = {
        ...newState,
        turnOrder: recomputedTurnOrder,
    };
    const currentIndex = newState.activeUnitId
        ? newState.turnOrder.indexOf(newState.activeUnitId)
        : -1;
    const nextIndex = currentIndex === -1 || currentIndex === newState.turnOrder.length - 1
        ? 0
        : currentIndex + 1;
    const nextActiveId = newState.turnOrder[nextIndex];
    // Check if we're starting a new round (turn wrapped to beginning)
    const isNewRound = nextIndex === 0 && currentIndex !== -1;
    newState = {
        ...newState,
        activeUnitId: nextActiveId,
        turnCount: currentIndex === -1
            ? 1
            : newState.turnCount + (isNewRound ? 1 : 0),
    };
    // DEFENSE OBJECTIVE: Decrement turns remaining at end of each round
    if (isNewRound && newState.defenseObjective?.type === "survive_turns") {
        const newTurnsRemaining = Math.max(0, newState.defenseObjective.turnsRemaining - 1);
        newState = {
            ...newState,
            defenseObjective: {
                ...newState.defenseObjective,
                turnsRemaining: newTurnsRemaining,
            },
            log: [
                ...newState.log,
                `SLK//DEFEND :: ${newTurnsRemaining} turns remaining to secure facility.`,
            ],
        };
        // Check if defense objective is now complete
        if (newTurnsRemaining <= 0) {
            newState = evaluateBattleOutcome(newState);
            if (newState.phase === "victory" || newState.phase === "defeat") {
                return newState;
            }
        }
    }
    if (isNewRound && getSquadObjectiveState(newState)) {
        newState = advanceSquadObjectiveRound(newState);
        newState = evaluateBattleOutcome(newState);
        if (newState.phase === "victory" || newState.phase === "defeat") {
            return newState;
        }
    }
    // --- STRAIN COOLDOWN ON NEW ACTIVE UNIT ---
    if (nextActiveId && newState.units[nextActiveId]) {
        const u = newState.units[nextActiveId];
        const oldStrain = u.strain;
        const cooledStrain = Math.max(0, oldStrain - 1);
        let cooledUnit = {
            ...u,
            strain: cooledStrain,
        };
        const wasOver = oldStrain >= getStrainThreshold();
        const nowOver = cooledStrain >= getStrainThreshold();
        let cooledState = {
            ...newState,
            units: {
                ...newState.units,
                [nextActiveId]: cooledUnit,
            },
        };
        if (wasOver && !nowOver) {
            cooledState = appendBattleLog(cooledState, `${u.name}'s vitals normalize - strain cooling.`);
        }
        newState = cooledState;
    }
    // --- BUFF TICK / DESPAWN ON NEW ACTIVE UNIT ---
    if (nextActiveId && newState.units[nextActiveId]) {
        const u = newState.units[nextActiveId];
        const updatedBuffs = (u.buffs ?? [])
            .map((b) => ({ ...b, duration: b.duration - 1 }))
            .filter((b) => b.duration > 0);
        newState = {
            ...newState,
            units: {
                ...newState.units,
                [nextActiveId]: {
                    ...u,
                    buffs: updatedBuffs,
                    turnCardsPlayed: 0,
                },
            },
        };
    }
    if (nextActiveId) {
        newState = applyEchoTurnStartEffects(newState, nextActiveId);
    }
    // Trigger Field Mod: turn_start (for new active unit)
    if (nextActiveId) {
        newState = (0, fieldModBattleIntegration_1.triggerTurnStart)(newState, nextActiveId);
    }
    // --- WEAPON PASSIVE COOLING (14b) ---
    if (nextActiveId && newState.units[nextActiveId]) {
        const u = newState.units[nextActiveId];
        if (u.weaponState && !u.isEnemy) {
            const equippedWeapon = getEquippedWeapon(u);
            const nextWeaponState = equippedWeapon
                ? (0, weaponSystem_1.advanceWeaponTurn)(u.weaponState, equippedWeapon)
                : u.weaponState;
            newState = {
                ...newState,
                units: {
                    ...newState.units,
                    [nextActiveId]: {
                        ...newState.units[nextActiveId],
                        weaponState: nextWeaponState,
                        weaponHeat: nextWeaponState.currentHeat,
                    },
                },
            };
        }
    }
    // --- POWER SURGE CHECK (10za POWER overload) ---
    const loadPenalties = getLoadPenalties(newState);
    if (loadPenalties && loadPenalties.powerOver) {
        if (Math.random() < 0.15) {
            let units = { ...newState.units };
            const allies = Object.values(units).filter((u) => !u.isEnemy);
            for (const ally of allies) {
                const cur = units[ally.id];
                units[ally.id] = {
                    ...cur,
                    hp: Math.max(0, cur.hp - 1),
                };
            }
            newState = {
                ...newState,
                units,
                log: [
                    ...newState.log,
                    "SLK//SURGE :: Power overload shocks your squad (-1 HP).",
                ],
            };
        }
    }
    // --- DRAW CARDS FOR NEXT UNIT (player or enemy) ---
    const nextUnit = nextActiveId ? newState.units[nextActiveId] : null;
    if (nextUnit && !nextUnit.isEnemy) {
        // Clear hand first, then draw new hand
        const clearedUnit = {
            ...nextUnit,
            hand: [],
        };
        newState = {
            ...newState,
            units: {
                ...newState.units,
                [nextActiveId]: clearedUnit,
            },
        };
        // Now draw fresh hand
        newState = drawCardsForTurn(newState, newState.units[nextActiveId]);
    }
    // CRITICAL: Final check for battle outcome at the end of every turn advancement
    newState = evaluateBattleOutcome(newState);
    // --- UPDATE PHASE BASED ON NEXT UNIT ---
    if (newState.phase !== "victory" && newState.phase !== "defeat") {
        const nextUnitState = nextActiveId ? newState.units[nextActiveId] : null;
        newState = {
            ...newState,
            phase: nextUnitState?.isEnemy ? "enemy_turn" : "player_turn",
        };
    }
    // --- STATUS EFFECT END-OF-ROUND TICK (POISON) ---
    if (isNewRound) {
        for (const unitId of newState.turnOrder) {
            const u = newState.units[unitId];
            if (hasStatus(u, "poisoned")) {
                // Poison: At end of round, suffer 1 damage and gain 1 Strain.
                const newHp = Math.max(0, u.hp - 1);
                newState = {
                    ...newState,
                    units: {
                        ...newState.units,
                        [unitId]: { ...newState.units[unitId], hp: newHp }
                    }
                };
                newState = applyStrain(newState, newState.units[unitId], 1);
                newState = appendBattleLog(newState, `SLK//STATUS :: ${u.name} suffers 1 structural damage from POISON.`);
                if (newHp <= 0) {
                    newState = evaluateBattleOutcome(newState);
                }
            }
            // Clear specific end-of-round statuses: Dazed, Vulnerable, Guarded
            if (u.statuses) {
                let nextStatuses = u.statuses.map(s => {
                    if (["dazed", "vulnerable", "guarded"].includes(s.type)) {
                        return { ...s, duration: s.duration - 1 };
                    }
                    return s;
                }).filter(s => s.duration > 0);
                newState = {
                    ...newState,
                    units: {
                        ...newState.units,
                        [unitId]: { ...newState.units[unitId], statuses: nextStatuses }
                    }
                };
            }
        }
    }
    // --- STATUS EFFECT START/END-OF-TURN TICK (BURNING) ---
    if (newState.activeUnitId) {
        const activeUnit = newState.units[newState.activeUnitId];
        if (hasStatus(activeUnit, "burning")) {
            // Burning: Take 1 damage at end of your turn (we do it implicitly on rotation, or when it becomes active if that's easier. GDD says "end of your turn")
            // Actually we're processing end-of-turn for the PREVIOUS unit, so let's check currentIndex
            if (currentIndex !== -1) {
                const prevUnitId = state.turnOrder[currentIndex];
                const prevUnit = state.units[prevUnitId];
                if (prevUnit && prevUnit.hp > 0 && hasStatus(prevUnit, "burning")) {
                    const bHp = Math.max(0, prevUnit.hp - 1);
                    newState = {
                        ...newState,
                        units: {
                            ...newState.units,
                            [prevUnitId]: { ...newState.units[prevUnitId], hp: bHp }
                        }
                    };
                    newState = appendBattleLog(newState, `SLK//STATUS :: ${prevUnit.name} suffers 1 thermal damage from BURNING.`);
                    if (bHp <= 0) {
                        newState = evaluateBattleOutcome(newState);
                    }
                }
            }
        }
        if (currentIndex !== -1) {
            const prevUnitId = state.turnOrder[currentIndex];
            newState = applyTheaterRoomFireHazard(newState, prevUnitId);
        }
        // Clear Stunned at end of NEXT turn - if they are stunned, decrement it now
        if (currentIndex !== -1) {
            const prevUnitId = state.turnOrder[currentIndex];
            const prevUnit = state.units[prevUnitId];
            if (prevUnit && prevUnit.statuses) {
                const nextStatuses = prevUnit.statuses.map(s => {
                    if (s.type === "stunned" || s.type === "suppressed") {
                        return { ...s, duration: s.duration - 1 };
                    }
                    return s;
                }).filter(s => s.duration > 0);
                newState = {
                    ...newState,
                    units: {
                        ...newState.units,
                        [prevUnitId]: { ...newState.units[prevUnitId], statuses: nextStatuses }
                    }
                };
            }
        }
    }
    return newState;
}
// ----------------------------------------------------------------------------
// LOGGING
// ----------------------------------------------------------------------------
function appendBattleLog(state, message) {
    return {
        ...state,
        log: [...state.log, message],
    };
}
function getSquadObjectiveState(state) {
    return state.modeContext?.kind === "squad" ? state.modeContext.squad?.objective ?? null : null;
}
function setSquadObjectiveState(state, objective) {
    if (state.modeContext?.kind !== "squad" || !state.modeContext.squad) {
        return state;
    }
    return {
        ...state,
        modeContext: {
            kind: "squad",
            squad: {
                ...state.modeContext.squad,
                objective,
            },
        },
    };
}
function isObjectiveTileOccupiedBySide(state, objective, side) {
    if (objective.kind !== "control_relay") {
        return false;
    }
    return Object.values(state.units).some((unit) => unit.hp > 0
        && unit.pos != null
        && (side === "friendly" ? !unit.isEnemy : unit.isEnemy)
        && objective.controlTiles.some((tile) => tile.x === unit.pos.x && tile.y === unit.pos.y));
}
function getSquadObjectiveControlSide(state) {
    const objective = getSquadObjectiveState(state);
    if (!objective || objective.kind !== "control_relay") {
        return null;
    }
    const friendlyControls = isObjectiveTileOccupiedBySide(state, objective, "friendly");
    const enemyControls = isObjectiveTileOccupiedBySide(state, objective, "enemy");
    if (friendlyControls === enemyControls) {
        return null;
    }
    return friendlyControls ? "friendly" : "enemy";
}
function advanceSquadObjectiveRound(state) {
    const objective = getSquadObjectiveState(state);
    if (!objective || objective.winnerSide || objective.kind !== "control_relay") {
        return state;
    }
    const controllingSide = getSquadObjectiveControlSide(state);
    let nextObjective = {
        ...objective,
        controllingSide,
    };
    let nextState = setSquadObjectiveState(state, nextObjective);
    if (!controllingSide) {
        if (objective.controllingSide) {
            nextState = appendBattleLog(nextState, "SLK//OBJECTIVE :: Relay control is contested. No side scores this round.");
        }
        return nextState;
    }
    nextObjective = {
        ...nextObjective,
        score: {
            ...nextObjective.score,
            [controllingSide]: nextObjective.score[controllingSide] + 1,
        },
    };
    nextState = setSquadObjectiveState(nextState, nextObjective);
    nextState = appendBattleLog(nextState, `SLK//OBJECTIVE :: ${controllingSide === "friendly" ? "Host" : "Opposing"} line secured relay control ${nextObjective.score[controllingSide]}/${nextObjective.targetScore}.`);
    return nextState;
}
function isBreakthroughTileForSide(objective, side, x, y) {
    if (objective.kind !== "breakthrough") {
        return false;
    }
    return (objective.breachTiles?.[side] ?? []).some((tile) => tile.x === x && tile.y === y);
}
function isExtractionTile(state, objective, x, y) {
    const objectiveTiles = objective.extractionTiles ?? [];
    if (objectiveTiles.some((tile) => tile.x === x && tile.y === y)) {
        return true;
    }
    return Boolean(state.objectiveZones?.extraction?.some((tile) => tile.x === x && tile.y === y));
}
function resolveSquadObjectiveEndTurn(state, endingUnitId) {
    if (!endingUnitId) {
        return state;
    }
    const objective = getSquadObjectiveState(state);
    const endingUnit = state.units[endingUnitId];
    if (!objective || !endingUnit || endingUnit.hp <= 0 || !endingUnit.pos || objective.winnerSide) {
        return state;
    }
    if (objective.kind !== "breakthrough" && objective.kind !== "extraction") {
        return state;
    }
    const scoringSide = endingUnit.isEnemy ? "enemy" : "friendly";
    const canExtract = objective.kind === "breakthrough"
        ? isBreakthroughTileForSide(objective, scoringSide, endingUnit.pos.x, endingUnit.pos.y)
        : isExtractionTile(state, objective, endingUnit.pos.x, endingUnit.pos.y);
    if (!canExtract) {
        return state;
    }
    const nextObjective = {
        ...objective,
        score: {
            ...objective.score,
            [scoringSide]: objective.score[scoringSide] + 1,
        },
        controllingSide: scoringSide,
        extractedUnitIds: [...(objective.extractedUnitIds ?? []), endingUnit.id],
    };
    const nextUnits = {
        ...state.units,
        [endingUnit.id]: {
            ...endingUnit,
            pos: null,
        },
    };
    let nextState = {
        ...state,
        units: nextUnits,
        turnOrder: computeTurnOrder(nextUnits),
    };
    nextState = setSquadObjectiveState(nextState, nextObjective);
    return appendBattleLog(nextState, objective.kind === "breakthrough"
        ? `SLK//OBJECTIVE :: ${endingUnit.name} breached the far lane and extracted. ${scoringSide === "friendly" ? "Host" : "Opposing"} score ${nextObjective.score[scoringSide]}/${nextObjective.targetScore}.`
        : `SLK//OBJECTIVE :: ${endingUnit.name} reached the extraction zone and was pulled out. ${scoringSide === "friendly" ? "Host" : "Opposing"} score ${nextObjective.score[scoringSide]}/${nextObjective.targetScore}.`);
}
// ----------------------------------------------------------------------------
// ACTIVE UNIT
// ----------------------------------------------------------------------------
function getActiveUnit(state) {
    if (!state.activeUnitId)
        return null;
    return state.units[state.activeUnitId] ?? null;
}
// ----------------------------------------------------------------------------
// WEAPON HELPERS (14b)
// ----------------------------------------------------------------------------
/**
 * Resolve a battle unit's equipped weapon id from the primary runtime field,
 * then fall back to runtime weapon state or legacy loadout data.
 */
function getBattleUnitEquippedWeaponId(unit) {
    if (!unit) {
        return null;
    }
    if (typeof unit.equippedWeaponId === "string" && unit.equippedWeaponId) {
        return unit.equippedWeaponId;
    }
    if (typeof unit.weaponState?.equipmentId === "string" && unit.weaponState.equipmentId) {
        return unit.weaponState.equipmentId;
    }
    return normalizeBattleLoadout(unit.loadout).primaryWeapon;
}
/**
 * Get the equipped weapon for a battle unit
 */
function getEquippedWeapon(unit, equipmentById) {
    const equippedWeaponId = getBattleUnitEquippedWeaponId(unit);
    if (!equippedWeaponId)
        return null;
    const equipment = equipmentById || (0, equipment_1.getAllStarterEquipment)();
    const weapon = equipment[equippedWeaponId];
    if (weapon && weapon.slot === "weapon") {
        return weapon;
    }
    return null;
}
/**
 * Update weapon state for a unit in battle
 */
function updateUnitWeaponState(state, unitId, newWeaponState) {
    const unit = state.units[unitId];
    if (!unit)
        return state;
    return {
        ...state,
        units: {
            ...state.units,
            [unitId]: {
                ...unit,
                weaponState: newWeaponState,
                weaponHeat: newWeaponState.currentHeat,
                weaponWear: newWeaponState.wear,
                clutchActive: newWeaponState.clutchActive,
            },
        },
    };
}
function removeBattleUnit(state, unitId) {
    const nextUnits = { ...state.units };
    delete nextUnits[unitId];
    return {
        ...state,
        units: nextUnits,
        turnOrder: state.turnOrder.filter((id) => id !== unitId),
        activeUnitId: state.activeUnitId === unitId ? null : state.activeUnitId,
    };
}
function setBattleUnitHp(state, unitId, hp) {
    const unit = state.units[unitId];
    if (!unit) {
        return state;
    }
    if (hp <= 0) {
        return removeBattleUnit(state, unitId);
    }
    return {
        ...state,
        units: {
            ...state.units,
            [unitId]: {
                ...unit,
                hp,
            },
        },
    };
}
function moveUnitByDeltaIfClear(state, unitId, dx, dy, tiles) {
    const unit = state.units[unitId];
    if (!unit?.pos || tiles <= 0) {
        return state;
    }
    let next = state;
    let currentPos = unit.pos;
    for (let step = 0; step < tiles; step += 1) {
        const candidate = { x: currentPos.x + dx, y: currentPos.y + dy };
        if (candidate.x < 0 ||
            candidate.y < 0 ||
            candidate.x >= state.gridWidth ||
            candidate.y >= state.gridHeight) {
            break;
        }
        const tile = getTileAt(state, candidate.x, candidate.y);
        const occupied = Object.values(next.units).some((other) => other.id !== unitId && other.pos?.x === candidate.x && other.pos?.y === candidate.y);
        if (!tile || tile.terrain === "wall" || occupied) {
            break;
        }
        next = {
            ...next,
            units: {
                ...next.units,
                [unitId]: {
                    ...next.units[unitId],
                    pos: candidate,
                },
            },
        };
        currentPos = candidate;
    }
    return next;
}
function removeRandomWeaponCardFromBattleUnit(unit) {
    const equippedWeaponId = getBattleUnitEquippedWeaponId(unit);
    const weaponCards = [
        ...unit.hand,
        ...unit.drawPile,
        ...unit.discardPile,
        ...unit.exhaustedPile,
    ].filter((cardId) => (0, cardCatalog_1.getResolvedBattleCard)(cardId)?.sourceEquipmentId === equippedWeaponId);
    if (weaponCards.length === 0) {
        return unit;
    }
    const removedCardId = weaponCards[Math.floor(Math.random() * weaponCards.length)];
    const removeFromPile = (pile) => {
        const index = pile.indexOf(removedCardId);
        if (index < 0)
            return pile;
        return [...pile.slice(0, index), ...pile.slice(index + 1)];
    };
    return {
        ...unit,
        hand: removeFromPile(unit.hand),
        drawPile: removeFromPile(unit.drawPile),
        discardPile: removeFromPile(unit.discardPile),
        exhaustedPile: removeFromPile(unit.exhaustedPile),
    };
}
function applyWeaponOverheatEffects(state, unitId, effects, sourceLabel) {
    let next = state;
    let unit = next.units[unitId];
    if (!unit) {
        return state;
    }
    effects.forEach((effect) => {
        unit = next.units[unitId];
        if (!unit) {
            return;
        }
        switch (effect.kind) {
            case "self_damage_percent": {
                const amount = Math.max(1, Math.ceil(unit.maxHp * effect.percent));
                next = appendBattleLog(next, `SLK//HEAT  :: ${unit.name} suffers ${amount} self-damage from ${sourceLabel}.`);
                next = setBattleUnitHp(next, unitId, unit.hp - amount);
                break;
            }
            case "self_damage_flat":
                next = appendBattleLog(next, `SLK//HEAT  :: ${unit.name} suffers ${effect.amount} self-damage from ${sourceLabel}.`);
                next = setBattleUnitHp(next, unitId, unit.hp - effect.amount);
                break;
            case "self_strain":
                next = appendBattleLog(next, `SLK//HEAT  :: ${unit.name} takes ${effect.amount} Strain from ${sourceLabel}.`);
                next = applyStrain(next, unit, effect.amount);
                break;
            case "apply_status_self":
                next = addStatus(next, unitId, effect.status, effect.duration);
                next = appendBattleLog(next, `SLK//HEAT  :: ${unit.name} is ${effect.status.toUpperCase()} from ${sourceLabel}.`);
                break;
            case "push_self": {
                const facing = unit.facing ?? "east";
                const [dx, dy] = facing === "east" ? [-1, 0] :
                    facing === "west" ? [1, 0] :
                        facing === "south" ? [0, -1] :
                            [0, 1];
                next = moveUnitByDeltaIfClear(next, unitId, dx, dy, effect.tiles);
                break;
            }
            case "remove_random_weapon_card": {
                const updatedUnit = removeRandomWeaponCardFromBattleUnit(unit);
                next = {
                    ...next,
                    units: {
                        ...next.units,
                        [unitId]: updatedUnit,
                    },
                };
                next = appendBattleLog(next, `SLK//HEAT  :: ${unit.name} loses a random weapon card from ${sourceLabel}.`);
                break;
            }
            default:
                break;
        }
    });
    return next;
}
function applyWeaponHitToUnit(state, defenderId, isCrit = false) {
    const defender = state.units[defenderId];
    if (!defender?.weaponState || (0, weaponSystem_1.rollWeaponHit)(isCrit) === false) {
        return state;
    }
    const hitNode = (0, weaponSystem_1.rollWeaponNodeHit)();
    const damagedState = (0, weaponSystem_1.damageNode)(defender.weaponState, hitNode);
    let next = updateUnitWeaponState(state, defenderId, damagedState);
    const nodeName = weaponSystem_1.WEAPON_NODE_NAMES[hitNode].primary;
    const severity = damagedState.nodes[hitNode].toUpperCase();
    next = appendBattleLog(next, `SLK//DMG   :: [${defender.name}] ${nodeName} struck. [${severity}]`);
    return next;
}
function getLegacyTheaterCombatInstabilityHeatGain(state) {
    const severity = state.theaterBonuses?.overheatSeverity ?? 0;
    if (!state.theaterBonuses?.combatInstability || severity <= 0) {
        return 0;
    }
    return severity >= 2 ? 2 : 1;
}
function getTheaterCombatInstabilityHeatGain(state, trigger) {
    const legacyHeatGain = getLegacyTheaterCombatInstabilityHeatGain(state);
    const directHeatGain = trigger === "miss"
        ? state.theaterBonuses?.heatOnMiss
        : state.theaterBonuses?.heatOnAttack;
    if (typeof directHeatGain === "number") {
        return Math.max(directHeatGain, legacyHeatGain);
    }
    return legacyHeatGain;
}
function applyTheaterCombatInstability(state, unitId, trigger = "attack") {
    const heatGain = getTheaterCombatInstabilityHeatGain(state, trigger);
    if (heatGain <= 0) {
        return state;
    }
    const unit = state.units[unitId];
    if (!unit || !unit.weaponState) {
        return state;
    }
    const weapon = getEquippedWeapon(unit);
    if (!weapon?.isMechanical) {
        return state;
    }
    const nextWeaponState = (0, weaponSystem_1.addHeat)(unit.weaponState, weapon, heatGain);
    if (nextWeaponState === unit.weaponState) {
        return state;
    }
    let next = updateUnitWeaponState(state, unitId, nextWeaponState);
    if (nextWeaponState.currentHeat >= (0, weaponSystem_1.getEffectiveMaxHeat)(nextWeaponState, weapon)) {
        const overheatOutcome = (0, weaponSystem_1.triggerWeaponOverheat)(nextWeaponState, weapon);
        next = updateUnitWeaponState(next, unitId, overheatOutcome.state);
        next = appendBattleLog(next, `SLK//ALERT :: ${unit.name}'s weapon destabilizes under room overheat. ${overheatOutcome.summary}`);
        next = applyWeaponOverheatEffects(next, unitId, overheatOutcome.effects, "room overheat");
    }
    return next;
}
function applyTheaterRoomFireHazard(state, unitId) {
    const burnSeverity = state.theaterBonuses?.burnSeverity ?? 0;
    if (!state.theaterBonuses?.burningRoom || burnSeverity <= 0) {
        return state;
    }
    const unit = state.units[unitId];
    if (!unit || unit.hp <= 0) {
        return state;
    }
    const fireDamage = burnSeverity >= 3 ? 2 : 1;
    const nextHp = Math.max(0, unit.hp - fireDamage);
    let next = {
        ...state,
        units: {
            ...state.units,
            [unitId]: {
                ...unit,
                hp: nextHp,
            },
        },
    };
    next = appendBattleLog(next, `SLK//HAZARD :: ${unit.name} is scorched by room fire (${fireDamage}).`);
    if (burnSeverity >= 2) {
        next = addStatus(next, unitId, "burning", 1, "theater_room_fire");
    }
    if (nextHp <= 0) {
        next = evaluateBattleOutcome(next);
    }
    return next;
}
// ----------------------------------------------------------------------------
// MOUNT HELPERS
// ----------------------------------------------------------------------------
/**
 * Check if a battle unit has a specific mount passive trait
 */
function unitHasMountPassive(unit, trait) {
    return unit.mountPassiveTraits?.includes(trait) ?? false;
}
/**
 * Check if a unit is mounted
 */
function isUnitMounted(unit) {
    return !!unit.mountId;
}
/**
 * Get the movement bonus from a unit's mount (if any)
 */
function getMountMovementBonus(unit) {
    if (!unit.mountId)
        return 0;
    const mount = (0, mounts_1.getMountById)(unit.mountId);
    if (!mount)
        return 0;
    return mount.statModifiers.movement ?? 0;
}
/**
 * Calculate total movement range for a unit (AGI + mount bonus)
 */
function getUnitMovementRange(unit, battle) {
    const baseMovement = unit.agi;
    const mountBonus = getMountMovementBonus(unit);
    const echoAdjustment = battle ? (0, echoFieldEffects_1.getEchoMovementAdjustment)(battle, unit).amount : 0;
    const movementBuffs = (unit.buffs || [])
        .filter((buff) => buff.type === "move_up" || buff.type === "move_down")
        .reduce((sum, buff) => sum + buff.amount, 0);
    // Swift trait: +1 movement on first turn (turn 1)
    // This would need turn count context, so we skip it here
    return Math.max(1, baseMovement + mountBonus + echoAdjustment + movementBuffs);
}
/**
 * Apply charge damage bonus if unit has charge trait and moved 3+ tiles
 * Returns the bonus damage amount
 */
function getChargeDamageBonus(unit, tilesMoved) {
    if (!unitHasMountPassive(unit, "charge") || tilesMoved < 3) {
        return 0;
    }
    return 2; // +2 damage for charge
}
/**
 * Get armored damage reduction from mount
 */
function getArmoredDamageReduction(unit) {
    if (!unitHasMountPassive(unit, "armored")) {
        return 0;
    }
    return 1; // -1 incoming damage
}
/**
 * Get intimidate accuracy penalty for adjacent enemies
 */
function getIntimidateAccuracyPenalty(attacker, defender) {
    if (!unitHasMountPassive(defender, "intimidate")) {
        return 0;
    }
    // Check if attacker is adjacent to defender
    if (!attacker.pos || !defender.pos)
        return 0;
    const dx = Math.abs(attacker.pos.x - defender.pos.x);
    const dy = Math.abs(attacker.pos.y - defender.pos.y);
    if (dx + dy === 1) {
        return -10; // -10 ACC penalty
    }
    return 0;
}
// ----------------------------------------------------------------------------
// POSITION / MOVEMENT HELPERS
// ----------------------------------------------------------------------------
function arePositionsAdjacent(a, b) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return dx + dy === 1;
}
function isInsideBounds(state, pos) {
    return (pos.x >= 0 &&
        pos.y >= 0 &&
        pos.x < state.gridWidth &&
        pos.y < state.gridHeight);
}
/**
 * Get tile at position
 */
function getTileAt(state, x, y) {
    return state.tiles.find(t => t.pos.x === x && t.pos.y === y) || null;
}
function getTraversalDestinations(state, from) {
    return (state.traversalLinks ?? [])
        .flatMap((link) => {
        if (link.from.x === from.x && link.from.y === from.y) {
            return [{ ...link.to }];
        }
        if (link.bidirectional && link.to.x === from.x && link.to.y === from.y) {
            return [{ ...link.from }];
        }
        return [];
    });
}
function getMapObjectAt(state, x, y) {
    return state.mapObjects?.find((objectDef) => objectDef.x === x && objectDef.y === y && objectDef.active !== false) ?? null;
}
function getMapObjectsAt(state, x, y) {
    return (state.mapObjects ?? []).filter((objectDef) => objectDef.x === x && objectDef.y === y && objectDef.active !== false);
}
function blocksMovementForState(objectDef) {
    return objectDef.blocksMovement === true || objectDef.type === "barricade_wall" || objectDef.type === "destructible_wall";
}
function hasTraversalBetween(state, from, to) {
    return getTraversalDestinations(state, from).some((point) => point.x === to.x && point.y === to.y);
}
function canTraverseElevationStep(state, from, to) {
    const fromTile = getTileAt(state, from.x, from.y);
    const toTile = getTileAt(state, to.x, to.y);
    if (!fromTile || !toTile) {
        return false;
    }
    const delta = Math.abs((fromTile.elevation ?? 0) - (toTile.elevation ?? 0));
    return delta <= 1 || hasTraversalBetween(state, from, to) || hasTraversalBetween(state, to, from);
}
function isWalkableTile(state, pos) {
    if (!isInsideBounds(state, pos))
        return false;
    const tile = getTileAt(state, pos.x, pos.y);
    const blockingObject = getMapObjectsAt(state, pos.x, pos.y).some(blocksMovementForState);
    return Boolean(tile && tile.terrain !== "wall" && !blockingObject);
}
function getLivingUnitAt(state, pos) {
    return (Object.values(state.units).find((u) => u.hp > 0 && u.pos && u.pos.x === pos.x && u.pos.y === pos.y) ?? null);
}
function canTraverseOccupiedTile(movingUnit, occupant, isDestination) {
    if (!occupant)
        return true;
    if (!movingUnit)
        return false;
    if (occupant.id === movingUnit.id)
        return true;
    if (isDestination)
        return false;
    return occupant.isEnemy === movingUnit.isEnemy;
}
function canUnitMoveTo(state, unit, dest) {
    if (!unit.pos)
        return false;
    // Status Check: Immobilized units cannot move
    if (hasStatus(unit, "immobilized"))
        return false;
    const dx = Math.abs(unit.pos.x - dest.x);
    const dy = Math.abs(unit.pos.y - dest.y);
    const distance = dx + dy;
    const movementRange = getUnitMovementRange(unit, state);
    if (distance === 0 || distance > movementRange)
        return false;
    // Status Check: Rooted units cannot move vertically (climb)
    if (hasStatus(unit, "rooted")) {
        const startTile = getTileAt(state, unit.pos.x, unit.pos.y);
        const endTile = getTileAt(state, dest.x, dest.y);
        if (startTile && endTile && (startTile.elevation ?? 0) !== (endTile.elevation ?? 0)) {
            return false;
        }
    }
    const occupant = getLivingUnitAt(state, dest);
    if (occupant && occupant.id !== unit.id)
        return false;
    if (!isWalkableTile(state, dest))
        return false;
    return canTraverseElevationStep(state, unit.pos, dest);
}
function getReachableMovementTiles(state, unit, origin = unit.pos ?? { x: 0, y: 0 }) {
    if (!unit.pos)
        return new Set();
    if (hasStatus(unit, "immobilized"))
        return new Set();
    const movement = getUnitMovementRange(unit, state);
    const reachable = new Set();
    const visited = new Map();
    const queue = [{ x: origin.x, y: origin.y, cost: 0 }];
    visited.set(`${origin.x},${origin.y}`, 0);
    const dirs = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
    while (queue.length > 0) {
        const current = queue.shift();
        for (const d of dirs) {
            const nx = current.x + d.x;
            const ny = current.y + d.y;
            const newCost = current.cost + 1;
            const key = `${nx},${ny}`;
            if (nx < 0 || nx >= state.gridWidth || ny < 0 || ny >= state.gridHeight)
                continue;
            if (newCost > movement)
                continue;
            if (visited.has(key) && visited.get(key) <= newCost)
                continue;
            if (hasStatus(unit, "rooted")) {
                const startTile = getTileAt(state, current.x, current.y);
                const endTile = getTileAt(state, nx, ny);
                if (startTile && endTile && (startTile.elevation ?? 0) !== (endTile.elevation ?? 0)) {
                    continue;
                }
            }
            const nextPos = { x: nx, y: ny };
            if (!isWalkableTile(state, nextPos))
                continue;
            if (!canTraverseElevationStep(state, { x: current.x, y: current.y }, nextPos))
                continue;
            const occupant = getLivingUnitAt(state, nextPos);
            const occupiedByOther = occupant && occupant.id !== unit.id;
            if (!canTraverseOccupiedTile(unit, occupant, false))
                continue;
            visited.set(key, newCost);
            if (!occupiedByOther) {
                reachable.add(key);
            }
            queue.push({ x: nx, y: ny, cost: newCost });
        }
        for (const travelPoint of getTraversalDestinations(state, { x: current.x, y: current.y })) {
            const key = `${travelPoint.x},${travelPoint.y}`;
            const newCost = current.cost + 1;
            if (newCost > movement)
                continue;
            if (visited.has(key) && visited.get(key) <= newCost)
                continue;
            if (!isWalkableTile(state, travelPoint))
                continue;
            const occupant = getLivingUnitAt(state, travelPoint);
            const occupiedByOther = occupant && occupant.id !== unit.id;
            if (!canTraverseOccupiedTile(unit, occupant, false))
                continue;
            visited.set(key, newCost);
            if (!occupiedByOther) {
                reachable.add(key);
            }
            queue.push({ x: travelPoint.x, y: travelPoint.y, cost: newCost });
        }
    }
    return reachable;
}
/**
 * Compute a step-by-step path from start to destination using BFS
 * Returns an array of grid positions including start and end
 */
function getMovePath(state, start, dest, maxCost) {
    // If start equals dest, return single-tile path
    if (start.x === dest.x && start.y === dest.y) {
        return [{ x: start.x, y: start.y }];
    }
    // BFS to find shortest path
    const visited = new Map();
    const queue = [
        { x: start.x, y: start.y, cost: 0, parent: null }
    ];
    visited.set(`${start.x},${start.y}`, queue[0]);
    const dirs = [
        { x: 0, y: -1 }, // north
        { x: 0, y: 1 }, // south
        { x: -1, y: 0 }, // west
        { x: 1, y: 0 } // east
    ];
    const movingUnit = getLivingUnitAt(state, start) ??
        (state.activeUnitId ? state.units[state.activeUnitId] ?? null : null);
    while (queue.length > 0) {
        const current = queue.shift();
        // Check if we reached destination
        if (current.x === dest.x && current.y === dest.y) {
            // Reconstruct path
            const path = [];
            let node = current;
            while (node) {
                path.unshift({ x: node.x, y: node.y });
                if (node.parent) {
                    node = visited.get(node.parent);
                }
                else {
                    node = undefined;
                }
            }
            return path;
        }
        // Explore neighbors
        for (const d of dirs) {
            const nx = current.x + d.x;
            const ny = current.y + d.y;
            const newCost = current.cost + 1;
            const key = `${nx},${ny}`;
            // Check bounds
            if (nx < 0 || nx >= state.gridWidth || ny < 0 || ny >= state.gridHeight)
                continue;
            // Check cost limit
            if (newCost > maxCost)
                continue;
            // Check if already visited with lower cost
            const existing = visited.get(key);
            if (existing && existing.cost <= newCost)
                continue;
            // Status Check: Rooted units cannot climb
            if (hasStatus(state.units[state.activeUnitId], "rooted")) {
                const startTile = getTileAt(state, current.x, current.y);
                const endTile = getTileAt(state, nx, ny);
                if (startTile && endTile && (startTile.elevation ?? 0) !== (endTile.elevation ?? 0)) {
                    continue;
                }
            }
            // Check if tile is walkable
            if (!isWalkableTile(state, { x: nx, y: ny }))
                continue;
            if (!canTraverseElevationStep(state, { x: current.x, y: current.y }, { x: nx, y: ny }))
                continue;
            const occupant = getLivingUnitAt(state, { x: nx, y: ny });
            const isDestination = nx === dest.x && ny === dest.y;
            if (!canTraverseOccupiedTile(movingUnit, occupant, isDestination))
                continue;
            // Add to queue
            const newNode = { x: nx, y: ny, cost: newCost, parent: `${current.x},${current.y}` };
            visited.set(key, newNode);
            queue.push(newNode);
        }
        for (const travelPoint of getTraversalDestinations(state, { x: current.x, y: current.y })) {
            const key = `${travelPoint.x},${travelPoint.y}`;
            const newCost = current.cost + 1;
            if (newCost > maxCost)
                continue;
            const existing = visited.get(key);
            if (existing && existing.cost <= newCost)
                continue;
            if (!isWalkableTile(state, travelPoint))
                continue;
            const occupant = getLivingUnitAt(state, travelPoint);
            const isDestination = travelPoint.x === dest.x && travelPoint.y === dest.y;
            if (!canTraverseOccupiedTile(movingUnit, occupant, isDestination))
                continue;
            const newNode = { x: travelPoint.x, y: travelPoint.y, cost: newCost, parent: `${current.x},${current.y}` };
            visited.set(key, newNode);
            queue.push(newNode);
        }
    }
    // No path found - return direct path (fallback)
    return [{ x: start.x, y: start.y }, { x: dest.x, y: dest.y }];
}
function updateMapObjectState(state, objectId, updater) {
    const nextObjects = (state.mapObjects ?? []).flatMap((objectDef) => {
        if (objectDef.id !== objectId) {
            return [objectDef];
        }
        const updated = updater(objectDef);
        return updated ? [updated] : [];
    });
    return {
        ...state,
        mapObjects: nextObjects,
    };
}
function getUnitInteractionObject(state, unit) {
    if (!unit?.pos) {
        return null;
    }
    return getMapObjectsAt(state, unit.pos.x, unit.pos.y).find((objectDef) => (objectDef.type === "med_station" || objectDef.type === "ammo_crate")
        && (objectDef.charges ?? 1) > 0) ?? null;
}
function canUnitInteract(state, unit) {
    return Boolean(getUnitInteractionObject(state, unit));
}
function interactWithMapObject(state, unitId) {
    const unit = state.units[unitId];
    if (!unit) {
        return state;
    }
    const objectDef = getUnitInteractionObject(state, unit);
    if (!objectDef) {
        return appendBattleLog(state, `SLK//ACT    :: ${unit.name} has nothing usable on this tile.`);
    }
    if (objectDef.type === "med_station") {
        const healAmount = Math.min(5, unit.maxHp - unit.hp);
        const nextState = updateMapObjectState(state, objectDef.id, (current) => ({
            ...current,
            charges: Math.max(0, (current.charges ?? 1) - 1),
            active: (current.charges ?? 1) - 1 > 0,
        }));
        return appendBattleLog({
            ...nextState,
            units: {
                ...nextState.units,
                [unitId]: {
                    ...unit,
                    hp: Math.min(unit.maxHp, unit.hp + 5),
                },
            },
        }, `SLK//ACT    :: ${unit.name} uses a Med Station and restores ${healAmount} HP.`);
    }
    if (objectDef.type === "ammo_crate") {
        const equippedWeapon = getEquippedWeapon(unit);
        const nextWeaponState = unit.weaponState && equippedWeapon?.ammoMax
            ? {
                ...unit.weaponState,
                currentAmmo: equippedWeapon.ammoMax,
                isJammed: false,
            }
            : unit.weaponState;
        const nextState = updateMapObjectState(state, objectDef.id, (current) => ({
            ...current,
            charges: Math.max(0, (current.charges ?? 1) - 1),
            active: (current.charges ?? 1) - 1 > 0,
        }));
        return appendBattleLog({
            ...nextState,
            units: {
                ...nextState.units,
                [unitId]: {
                    ...unit,
                    weaponState: nextWeaponState,
                },
            },
        }, `SLK//ACT    :: ${unit.name} reloads from an Ammo Crate.`);
    }
    return state;
}
function triggerPassiveTileObject(state, unitId, destination) {
    const unit = state.units[unitId];
    if (!unit) {
        return state;
    }
    const mine = getMapObjectsAt(state, destination.x, destination.y).find((objectDef) => objectDef.type === "proximity_mine");
    if (!mine) {
        return state;
    }
    const damage = 3;
    const nextHp = Math.max(0, unit.hp - damage);
    const updatedState = updateMapObjectState(state, mine.id, (current) => ({
        ...current,
        active: false,
        hidden: false,
        charges: 0,
    }));
    const resolved = {
        ...updatedState,
        units: {
            ...updatedState.units,
            [unitId]: {
                ...unit,
                hp: nextHp,
            },
        },
    };
    return evaluateBattleOutcome(appendBattleLog(resolved, `SLK//TRAP   :: ${unit.name} triggers a Proximity Mine for ${damage} damage.`));
}
function moveUnit(state, unitId, dest) {
    const unit = state.units[unitId];
    if (!unit)
        return state;
    const updatedUnit = {
        ...unit,
        pos: { ...dest },
    };
    const units = {
        ...state.units,
        [unitId]: updatedUnit,
    };
    let next = {
        ...state,
        units,
    };
    next = appendBattleLog(next, `SLK//MOVE   :: ${unit.name} repositions to (${dest.x}, ${dest.y}).`);
    const movementAdjustment = (0, echoFieldEffects_1.getEchoMovementAdjustment)(state, unit);
    if (movementAdjustment.triggeredPlacements.length > 0) {
        next = (0, echoFieldEffects_1.incrementEchoFieldTriggerCount)(next, movementAdjustment.triggeredPlacements);
    }
    // Suppressed status clears if unit moves
    if (hasStatus(unit, "suppressed")) {
        next = removeStatus(next, unitId, "suppressed");
    }
    return triggerPassiveTileObject(next, unitId, dest);
}
// ----------------------------------------------------------------------------
// ATTACK HELPERS
// ----------------------------------------------------------------------------
function canUnitAttackTarget(attacker, target) {
    if (!attacker.pos || !target.pos)
        return false;
    return arePositionsAdjacent(attacker.pos, target.pos);
}
function getUnitElevation(state, unit) {
    if (!state || !unit?.pos) {
        return 0;
    }
    return getTileAt(state, unit.pos.x, unit.pos.y)?.elevation ?? 0;
}
function canIgnoreCoverFromElevation(state, attacker, defender) {
    if (!state || !attacker?.pos || !defender?.pos) {
        return false;
    }
    const attackerElevation = getUnitElevation(state, attacker);
    const defenderElevation = getUnitElevation(state, defender);
    if (attackerElevation < defenderElevation + 1) {
        return false;
    }
    const defenderTile = getTileAt(state, defender.pos.x, defender.pos.y);
    return defenderTile?.terrain === "light_cover";
}
function computeHitChance(attacker, defender, isRanged = false, battle) {
    let baseChance = attacker.acc;
    const accuracyBuffDelta = (attacker.buffs || [])
        .filter((buff) => buff.type === "acc_up" || buff.type === "acc_down")
        .reduce((sum, buff) => sum + buff.amount, 0);
    baseChance += accuracyBuffDelta;
    if (isOverStrainThreshold(attacker)) {
        baseChance -= 20;
    }
    // Status Effects
    if (hasStatus(attacker, "dazed")) {
        baseChance -= 10; // -1 die equivalent
    }
    if (isRanged && hasStatus(attacker, "suppressed")) {
        baseChance -= 10; // -1 die equivalent for ranged
    }
    if (defender && defender.statuses && defender.statuses.some(s => s.type === "marked" && s.sourceId === attacker.id)) {
        baseChance += 10; // +1 die equivalent vs marked
    }
    if (isRanged && battle && defender) {
        const attackerElevation = getUnitElevation(battle, attacker);
        const defenderElevation = getUnitElevation(battle, defender);
        if (attackerElevation > defenderElevation) {
            baseChance += 10;
        }
        else if (attackerElevation < defenderElevation) {
            baseChance -= 10;
        }
    }
    if (battle) {
        const echoAccuracyBonus = (0, echoFieldEffects_1.getEchoAccuracyBonus)(battle, attacker);
        const echoIncomingPenalty = defender ? (0, echoFieldEffects_1.getEchoIncomingAccuracyPenalty)(battle, defender) : { amount: 0 };
        baseChance += echoAccuracyBonus.amount;
        baseChance -= echoIncomingPenalty.amount;
    }
    return Math.max(10, Math.min(100, baseChance));
}
function isPlayerUnit(u) {
    return !u.isEnemy;
}
function isEnemyUnit(u) {
    return u.isEnemy;
}
// ----------------------------------------------------------------------------
// ATTACK
// ----------------------------------------------------------------------------
function attackUnit(state, attackerId, defenderId) {
    const attacker = state.units[attackerId];
    const defender = state.units[defenderId];
    if (!attacker || !defender)
        return state;
    // --- BULK overload: JAM chance for *player* attacks ---
    const loadPenalties = getLoadPenalties(state);
    if (loadPenalties && loadPenalties.bulkOver && !attacker.isEnemy) {
        const over = Math.max(0, loadPenalties.bulkPct - 1);
        const jamChance = Math.min(over, 0.5);
        if (Math.random() < jamChance) {
            return appendBattleLog(state, `SLK//JAM   :: ${attacker.name}'s weapon jams under BULK overload.`);
        }
    }
    // Accuracy check - apply mount intimidate penalty if defender has intimidate
    // Note: we'll assume basic attacks are melee for now regarding suppression logic unless we peek at their weapon.
    // We'll pass isRanged=false as default. 
    const equipWpn = getEquippedWeapon(attacker);
    const isRanged = equipWpn ? ["gun", "bow", "greatbow"].includes(equipWpn.weaponType) : false;
    const echoAccuracyBonus = (0, echoFieldEffects_1.getEchoAccuracyBonus)(state, attacker);
    const echoIncomingPenalty = (0, echoFieldEffects_1.getEchoIncomingAccuracyPenalty)(state, defender);
    let hitChance = computeHitChance(attacker, defender, isRanged, state);
    const intimidatePenalty = getIntimidateAccuracyPenalty(attacker, defender);
    if (intimidatePenalty !== 0) {
        hitChance = Math.max(10, hitChance + intimidatePenalty);
    }
    const roll = Math.random() * 100;
    if (roll > hitChance) {
        const missReason = intimidatePenalty !== 0
            ? "(mount intimidation)"
            : "(strain interference)";
        const unstableMissState = applyTheaterCombatInstability(state, attackerId, "miss");
        const echoedMissState = (echoAccuracyBonus.triggeredPlacements.length > 0 || echoIncomingPenalty.triggeredPlacements.length > 0)
            ? (0, echoFieldEffects_1.incrementEchoFieldTriggerCount)(unstableMissState, [...echoAccuracyBonus.triggeredPlacements, ...echoIncomingPenalty.triggeredPlacements])
            : unstableMissState;
        return appendBattleLog(echoedMissState, `SLK//MISS  :: ${attacker.name} swings at ${defender.name} but the strike goes wide ${missReason}.`);
    }
    const totalAtkBuff = attacker.buffs?.length
        ? attacker.buffs
            .filter((b) => b.type === "atk_up" || b.type === "atk_down")
            .reduce((sum, b) => sum + b.amount, 0)
        : 0;
    const echoAttackBonus = (0, echoFieldEffects_1.getEchoAttackBonus)(state, attacker);
    // DEF buffs
    const totalDefBuff = defender.buffs?.length
        ? defender.buffs
            .filter((b) => b.type === "def_up" || b.type === "def_down")
            .reduce((sum, b) => sum + b.amount, 0)
        : 0;
    const echoDefenseBonus = (0, echoFieldEffects_1.getEchoDefenseBonus)(state, defender);
    // Cover damage reduction (if defender is on cover tile)
    let coverReduction = 0;
    if (defender.pos) {
        const defenderTile = getTileAt(state, defender.pos.x, defender.pos.y);
        coverReduction = (0, coverGenerator_1.getCoverDamageReduction)(defenderTile);
        if (isRanged && canIgnoreCoverFromElevation(state, attacker, defender) && defenderTile?.terrain === "light_cover") {
            coverReduction = 0;
        }
    }
    // Mount armored damage reduction
    const armoredReduction = getArmoredDamageReduction(defender);
    let rawDamage = (attacker.atk + totalAtkBuff + echoAttackBonus.amount)
        - (defender.def + totalDefBuff + echoDefenseBonus.amount + coverReduction + armoredReduction);
    // Apply Status Effects (Weakened / Vulnerable / Guarded)
    if (hasStatus(attacker, "weakened")) {
        rawDamage -= 1;
    }
    if (hasStatus(defender, "guarded")) {
        rawDamage -= 1; // +1 Defense equivalent
    }
    if (hasStatus(defender, "vulnerable")) {
        rawDamage += 1;
    }
    // Let's use standard calculation but ensure it plays nice with the new statuses
    const finalDamage = Math.max((rawDamage <= 0 && !hasStatus(attacker, "weakened") ? 1 : rawDamage), 0);
    const newHp = defender.hp - finalDamage;
    const isKill = newHp <= 0;
    const isCrit = false; // TODO: Add crit detection
    let units = { ...state.units };
    let turnOrder = [...state.turnOrder];
    let next = { ...state };
    if (newHp <= 0) {
        delete units[defenderId];
        turnOrder = turnOrder.filter((id) => id !== defenderId);
        next = {
            ...next,
            units,
            turnOrder,
        };
        next = appendBattleLog(next, `SLK//HIT   :: ${attacker.name} hits ${defender.name} for ${finalDamage} - TARGET OFFLINE.`);
    }
    else {
        const updatedDefender = {
            ...defender,
            hp: newHp,
        };
        units = {
            ...state.units,
            [defenderId]: updatedDefender,
        };
        next = {
            ...next,
            units,
        };
        next = appendBattleLog(next, `SLK//HIT   :: ${attacker.name} hits ${defender.name} for ${finalDamage} (HP ${newHp}/${defender.maxHp}).`);
    }
    // Vulnerable ends after suffering damage once
    if (finalDamage > 0 && hasStatus(defender, "vulnerable")) {
        next = removeStatus(next, defenderId, "vulnerable");
    }
    // Guarded is consumed when used vs an attack
    if (hasStatus(defender, "guarded")) {
        next = removeStatus(next, defenderId, "guarded");
    }
    if (echoAttackBonus.triggeredPlacements.length > 0
        || echoDefenseBonus.triggeredPlacements.length > 0
        || echoAccuracyBonus.triggeredPlacements.length > 0
        || echoIncomingPenalty.triggeredPlacements.length > 0) {
        next = (0, echoFieldEffects_1.incrementEchoFieldTriggerCount)(next, [
            ...echoAttackBonus.triggeredPlacements,
            ...echoDefenseBonus.triggeredPlacements,
            ...echoAccuracyBonus.triggeredPlacements,
            ...echoIncomingPenalty.triggeredPlacements,
        ]);
    }
    const echoHex = (0, echoFieldEffects_1.getEchoOnHitVulnerable)(next, attacker);
    if (finalDamage > 0 && echoHex.duration > 0 && !isKill) {
        next = addStatus(next, defenderId, "vulnerable", echoHex.duration, attackerId);
        next = (0, echoFieldEffects_1.incrementEchoFieldTriggerCount)(next, echoHex.triggeredPlacements, `SLK//ECHO  :: ${defender.name} is exposed by Hex Zone.`);
    }
    // Trigger Field Mod: hit (and crit if applicable)
    next = (0, fieldModBattleIntegration_1.triggerHit)(next, attackerId, defenderId, finalDamage, isCrit, 0);
    // --- WEAPON DEGRADATION (Node Damage on Hit) ---
    const currentDefender = next.units[defenderId];
    if (currentDefender && currentDefender.weaponState && !isKill) {
        next = applyWeaponHitToUnit(next, defenderId, isCrit);
    }
    // Trigger Field Mod: kill (if target died)
    if (isKill) {
        next = (0, fieldModBattleIntegration_1.triggerKill)(next, attackerId, defenderId, 1);
    }
    // Track affinity for melee attack (if attacker is player unit)
    if (!attacker.isEnemy) {
        (0, affinityBattle_1.trackMeleeAttackInBattle)(attackerId, next);
    }
    next = applyTheaterCombatInstability(next, attackerId, "attack");
    next = evaluateBattleOutcome(next);
    return next;
}
// ----------------------------------------------------------------------------
// ENEMY AI
// ----------------------------------------------------------------------------
function performEnemyTurn(state) {
    const active = getActiveUnit(state);
    if (!active || !active.isEnemy || !active.pos) {
        return advanceTurn(state);
    }
    const players = Object.values(state.units).filter(isPlayerUnit);
    if (players.length === 0) {
        return advanceTurn(state);
    }
    let target = players[0];
    let bestDist = Infinity;
    for (const u of players) {
        if (!u.pos)
            continue;
        const d = Math.abs(active.pos.x - u.pos.x) +
            Math.abs(active.pos.y - u.pos.y);
        if (d < bestDist) {
            bestDist = d;
            target = u;
        }
    }
    let next = { ...state };
    // Helper to update facing
    const updateFacing = (s, unitId, targetPos) => {
        const unit = s.units[unitId];
        if (!unit || !unit.pos)
            return s;
        const dx = targetPos.x - unit.pos.x;
        const dy = targetPos.y - unit.pos.y;
        let newFacing = unit.facing;
        if (Math.abs(dx) >= Math.abs(dy)) {
            newFacing = dx > 0 ? "east" : "west";
        }
        else {
            newFacing = dy > 0 ? "south" : "north";
        }
        if (newFacing !== unit.facing) {
            const newUnits = { ...s.units };
            newUnits[unitId] = { ...unit, facing: newFacing };
            return { ...s, units: newUnits };
        }
        return s;
    };
    if (canUnitAttackTarget(active, target)) {
        // Face the target before attacking
        if (target.pos) {
            next = updateFacing(next, active.id, target.pos);
        }
        next = attackUnit(next, active.id, target.id);
        next = advanceTurn(next);
        return next;
    }
    const dx = Math.sign(target.pos.x - active.pos.x);
    const dy = Math.sign(target.pos.y - active.pos.y);
    const candidate1 = { x: active.pos.x + dx, y: active.pos.y };
    const candidate2 = { x: active.pos.x, y: active.pos.y + dy };
    let movedState = next;
    if (dx !== 0 && canUnitMoveTo(next, active, candidate1)) {
        movedState = moveUnit(next, active.id, candidate1);
        // Update facing based on movement direction
        movedState = updateFacing(movedState, active.id, candidate1);
    }
    else if (dy !== 0 && canUnitMoveTo(next, active, candidate2)) {
        movedState = moveUnit(next, active.id, candidate2);
        // Update facing based on movement direction
        movedState = updateFacing(movedState, active.id, candidate2);
    }
    movedState = advanceTurn(movedState);
    return movedState;
}
// ----------------------------------------------------------------------------
// AUTO-BATTLE LOGIC (15a)
// ----------------------------------------------------------------------------
/**
 * Perform auto-battle turn for a friendly unit (15a)
 * Deterministic policy: play best card targeting best enemy, or move toward nearest enemy, or wait
 */
function performAutoBattleTurn(state, unitId, policy = "daring") {
    const unit = state.units[unitId];
    if (!unit || unit.isEnemy || !unit.pos) {
        return state;
    }
    if (DEBUG_BATTLE) {
        console.log(`[AUTO_BATTLE] Starting auto turn for ${unit.name}`);
    }
    // Get all enemies
    const enemies = Object.values(state.units).filter(u => u.isEnemy && u.hp > 0 && u.pos);
    if (enemies.length === 0) {
        // No enemies, end turn
        return advanceTurn(state);
    }
    // Find nearest enemy
    let nearestEnemy = enemies[0];
    let nearestDist = Infinity;
    for (const enemy of enemies) {
        if (!enemy.pos)
            continue;
        const dist = Math.abs(unit.pos.x - enemy.pos.x) + Math.abs(unit.pos.y - enemy.pos.y);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearestEnemy = enemy;
        }
    }
    // Score and find best playable card
    // Use card resolution from BattleScreen (we'll need to import or duplicate logic)
    const playableCards = [];
    for (let i = 0; i < unit.hand.length; i++) {
        const cardId = unit.hand[i];
        // Simple scoring: prefer attack cards, avoid wait cards
        let score = 0;
        const cardName = cardId.toLowerCase();
        // Check if it's a wait/end turn card
        if (cardName.includes("wait") || cardName === "core_wait") {
            score = -100;
        }
        else {
            // Base score for playable cards
            score = 50;
            // Check if it targets enemies
            if (cardName.includes("attack") || cardName.includes("strike") || cardName.includes("shot")) {
                score += policy === "daring" ? 55 : 35;
                // Estimate damage (simplified)
                if (cardName.includes("power") || cardName.includes("execute")) {
                    score += policy === "daring" ? 18 : 8;
                }
                else {
                    score += policy === "daring" ? 8 : 4;
                }
            }
            // Check for debuffs
            if (cardName.includes("debuff") || cardName.includes("stun")) {
                score += policy === "undaring" ? 18 : 10;
            }
            if (cardName.includes("guard") || cardName.includes("form")) {
                score += policy === "undaring" ? 26 : 8;
            }
            if (cardName.includes("heal") || cardName.includes("aid") || cardName.includes("restore")) {
                score += policy === "undaring" ? 24 : 12;
            }
        }
        playableCards.push({ cardId, index: i, score, cardName });
    }
    // Sort by score (highest first)
    playableCards.sort((a, b) => b.score - a.score);
    // Try to play the best card
    for (const { index, cardName } of playableCards) {
        if (playableCards[0].score <= 0)
            break; // Don't play negative score cards
        // Find best target for this card
        // For enemy-targeting cards, use nearest enemy
        if (nearestEnemy.pos) {
            const distance = Math.abs(unit.pos.x - nearestEnemy.pos.x) + Math.abs(unit.pos.y - nearestEnemy.pos.y);
            // Try to play card on nearest enemy
            // Use playCard function which handles card resolution
            if (cardName.includes("wait") || cardName === "core_wait") {
                // Wait card - play on self
                return playCard(state, unitId, index, unitId);
            }
            else if (cardName.includes("attack") || cardName.includes("strike") || cardName.includes("shot") ||
                cardName.includes("headbutt") || cardName.includes("charge")) {
                // Attack card - check range and play
                // Assume range 1-6 for most attack cards
                if (distance <= 6) {
                    return playCard(state, unitId, index, nearestEnemy.id);
                }
            }
            else if (cardName.includes("guard") || cardName.includes("form") || cardName.includes("draw")) {
                // Self-target card
                return playCard(state, unitId, index, unitId);
            }
        }
    }
    // If no playable card or all cards scored poorly, try to move toward nearest enemy
    if (playableCards.length === 0 || playableCards[0].score <= 0) {
        if (nearestEnemy.pos && getUnitMovementRange(unit, state) > 0) {
            const dx = Math.sign(nearestEnemy.pos.x - unit.pos.x);
            const dy = Math.sign(nearestEnemy.pos.y - unit.pos.y);
            const candidate1 = { x: unit.pos.x + dx, y: unit.pos.y };
            const candidate2 = { x: unit.pos.x, y: unit.pos.y + dy };
            if (dx !== 0 && canUnitMoveTo(state, unit, candidate1)) {
                return moveUnit(state, unitId, candidate1);
            }
            else if (dy !== 0 && canUnitMoveTo(state, unit, candidate2)) {
                return moveUnit(state, unitId, candidate2);
            }
        }
        // Can't move, end turn
        return advanceTurn(state);
    }
    // If we have a good card but couldn't play it (range/other issues), move toward target
    if (nearestEnemy.pos) {
        const distance = Math.abs(unit.pos.x - nearestEnemy.pos.x) + Math.abs(unit.pos.y - nearestEnemy.pos.y);
        if (distance > (policy === "undaring" ? 2 : 1) && getUnitMovementRange(unit, state) > 0) {
            const dx = Math.sign(nearestEnemy.pos.x - unit.pos.x);
            const dy = Math.sign(nearestEnemy.pos.y - unit.pos.y);
            const candidate1 = { x: unit.pos.x + dx, y: unit.pos.y };
            const candidate2 = { x: unit.pos.x, y: unit.pos.y + dy };
            if (dx !== 0 && canUnitMoveTo(state, unit, candidate1)) {
                return moveUnit(state, unitId, candidate1);
            }
            else if (dy !== 0 && canUnitMoveTo(state, unit, candidate2)) {
                return moveUnit(state, unitId, candidate2);
            }
        }
    }
    // Default: end turn
    return advanceTurn(state);
}
// ----------------------------------------------------------------------------
function evaluateBattleOutcome(state) {
    if (state.phase === "victory" || state.phase === "defeat") {
        return state;
    }
    const units = Object.values(state.units);
    // Only count units with hp > 0 AND a valid position (alive and present on grid)
    const anyPlayers = units.some(u => isPlayerUnit(u) && u.hp > 0 && u.pos != null);
    const anyEnemies = units.some(u => isEnemyUnit(u) && u.hp > 0 && u.pos != null);
    // DEFEAT: All player units dead
    if (!anyPlayers) {
        return {
            ...state,
            phase: "defeat",
            activeUnitId: null,
            log: [
                ...state.log,
                (0, echoFieldEffects_1.isEchoBattle)(state)
                    ? "SLK//ECHO  :: Draft squad collapsed. Simulation terminates."
                    : "SLK//ENGAGE :: Player squad offline. Link severed.",
            ],
        };
    }
    const squadObjective = getSquadObjectiveState(state);
    if (squadObjective) {
        const winningSide = squadObjective.score.friendly >= squadObjective.targetScore
            ? "friendly"
            : squadObjective.score.enemy >= squadObjective.targetScore
                ? "enemy"
                : null;
        if (winningSide) {
            const resolvedObjective = squadObjective.winnerSide === winningSide
                ? squadObjective
                : {
                    ...squadObjective,
                    controllingSide: winningSide,
                    winnerSide: winningSide,
                };
            const resolvedState = setSquadObjectiveState(state, resolvedObjective);
            const winnerLabel = winningSide === "friendly" ? "Host line" : "Opposing line";
            return {
                ...resolvedState,
                phase: winningSide === "friendly" ? "victory" : "defeat",
                activeUnitId: null,
                log: [
                    ...resolvedState.log,
                    squadObjective.kind === "breakthrough"
                        ? `SLK//OBJECTIVE :: ${winnerLabel} completed the breakthrough ${resolvedObjective.score[winningSide]}/${resolvedObjective.targetScore}.`
                        : squadObjective.kind === "extraction"
                            ? `SLK//OBJECTIVE :: ${winnerLabel} completed the extraction ${resolvedObjective.score[winningSide]}/${resolvedObjective.targetScore}.`
                            : `SLK//OBJECTIVE :: ${winnerLabel} captured the relay ${resolvedObjective.score[winningSide]}/${resolvedObjective.targetScore}.`,
                ],
            };
        }
    }
    // DEFENSE OBJECTIVE: Check if survived required turns
    if (state.defenseObjective?.type === "survive_turns") {
        if (state.defenseObjective.turnsRemaining <= 0) {
            // VICTORY - survived required turns
            const rewards = generateDefenseRewards(state);
            return {
                ...state,
                phase: "victory",
                activeUnitId: null,
                rewards,
                log: [
                    ...state.log,
                    "SLK//DEFEND :: Defense successful! Facility secured.",
                    `SLK//REWARD :: +${rewards.wad} WAD, +${rewards.metalScrap} Metal Scrap, +${rewards.wood} Wood.`,
                ],
            };
        }
        // Defense battle continues even if all enemies are dead
        // (they may respawn, or we just survive the timer)
        // For now, if enemies are dead and turns remain, still continue
        // This could be adjusted based on design preference
    }
    // STANDARD VICTORY: All enemy units dead (for non-defense battles)
    if (!anyEnemies && !state.defenseObjective) {
        if ((0, echoFieldEffects_1.isEchoBattle)(state)) {
            return {
                ...state,
                phase: "victory",
                activeUnitId: null,
                rewards: {
                    wad: 0,
                    metalScrap: 0,
                    wood: 0,
                    chaosShards: 0,
                    steamComponents: 0,
                    squadXp: 0,
                    cards: [],
                    recipe: null,
                    unlockable: null,
                    gearRewards: [],
                },
                log: [
                    ...state.log,
                    "SLK//ECHO  :: Encounter cleared. Draft reward relay unlocked.",
                ],
            };
        }
        // Block rewards for training battles
        const isTraining = state.isTraining === true;
        const rewards = isTraining ? {
            wad: 0,
            metalScrap: 0,
            wood: 0,
            chaosShards: 0,
            steamComponents: 0,
            cards: [],
            recipe: null,
            unlockable: null,
            gearRewards: [],
        } : generateBattleRewards(state);
        if (isTraining) {
            console.warn("[TRAINING_NO_REWARDS] blocked reward generation");
        }
        // STEP 7: Build card reward log
        const cardNames = (rewards.cards ?? [])
            .map(id => (0, gearWorkbench_1.getLibraryCard)(id)?.name ?? id)
            .join(", ");
        const cardLog = rewards.cards && rewards.cards.length > 0
            ? `SLK//CARDS :: Acquired: ${cardNames}`
            : "";
        const logMessages = isTraining
            ? [
                ...state.log,
                "SLK//TRAIN :: Training simulation complete. No rewards granted.",
            ]
            : [
                ...state.log,
                "SLK//ENGAGE :: All hostiles cleared. Engagement complete.",
                `SLK//REWARD :: +${rewards.wad} WAD, +${rewards.metalScrap} Metal Scrap, +${rewards.wood} Wood, +${rewards.chaosShards} Chaos Shards, +${rewards.steamComponents} Steam Components, +${("squadXp" in rewards ? rewards.squadXp ?? 0 : 0)} S.T.A.T.`,
                ...(cardLog ? [cardLog] : []),
            ];
        return {
            ...state,
            phase: "victory",
            activeUnitId: null,
            rewards,
            log: logMessages,
        };
    }
    // For defense battles, check if enemies are all dead but time remains
    // In this case, also grant victory (optional design: could instead spawn more enemies)
    if (!anyEnemies && state.defenseObjective) {
        const rewards = generateDefenseRewards(state);
        return {
            ...state,
            phase: "victory",
            activeUnitId: null,
            rewards,
            log: [
                ...state.log,
                "SLK//DEFEND :: All attackers eliminated! Facility secured.",
                `SLK//REWARD :: +${rewards.wad} WAD, +${rewards.metalScrap} Metal Scrap, +${rewards.wood} Wood.`,
            ],
        };
    }
    return state;
}
/**
 * Generate rewards for defense battles (smaller than standard battles)
 */
function generateDefenseRewards(_state) {
    return {
        wad: 25,
        metalScrap: 5,
        wood: 3,
        chaosShards: 1,
        steamComponents: 1,
        cards: [],
        gearRewards: [],
    };
}
function generateBattleRewards(state) {
    const enemies = Object.values(state.units).filter(isEnemyUnit);
    const enemyCount = enemies.length || 1;
    const gearRewards = (0, gearRewards_1.createBattleGearRewardSpec)(enemyCount, state.id ?? state.roomId);
    // STEP 7: Generate card rewards
    const cardRewards = (0, gearWorkbench_1.generateBattleRewardCards)(enemyCount);
    // Generate recipe reward (5% base chance, +2% per enemy, capped at 20%)
    const recipeChance = Math.min(0.20, 0.05 + (enemyCount * 0.02));
    let recipeReward = null;
    if (Math.random() < recipeChance) {
        // Import recipe database - use dynamic import to avoid circular dependencies
        try {
            // Use a lazy import pattern - we'll handle this in the reward claiming code
            // For now, we'll generate the recipe ID here but grant it later
            recipeReward = "pending"; // Placeholder, will be resolved when claiming
        }
        catch (e) {
            // If import fails, no recipe reward
            console.warn("[BATTLE] Could not generate recipe reward:", e);
        }
    }
    // Generate unlockable reward (5% base chance, +1% per enemy, capped at 15%)
    const unlockableChance = Math.min(0.15, 0.05 + (enemyCount * 0.01));
    let unlockableReward = null;
    if (Math.random() < unlockableChance) {
        try {
            const unowned = (0, unlockables_1.getUnownedUnlockables)((0, unlockableOwnership_1.getAllOwnedUnlockableIdList)());
            if (unowned.length === 0) {
                unlockableReward = null;
            }
            else {
                // Weight by rarity (common: 60%, uncommon: 30%, rare: 10%)
                const common = unowned.filter(u => u.rarity === "common");
                const uncommon = unowned.filter(u => u.rarity === "uncommon");
                const rare = unowned.filter(u => u.rarity === "rare" || u.rarity === "epic");
                const roll = Math.random();
                let pool;
                if (roll < 0.6 && common.length > 0) {
                    pool = common;
                }
                else if (roll < 0.9 && uncommon.length > 0) {
                    pool = uncommon;
                }
                else if (rare.length > 0) {
                    pool = rare;
                }
                else {
                    pool = unowned;
                }
                const selected = pool[Math.floor(Math.random() * pool.length)];
                unlockableReward = selected ? selected.id : null;
            }
        }
        catch (e) {
            console.warn("[BATTLE] Could not generate unlockable reward:", e);
        }
    }
    return {
        wad: 10 * enemyCount,
        metalScrap: 2 * enemyCount,
        wood: 1 * enemyCount,
        chaosShards: enemyCount >= 2 ? 1 : 0,
        steamComponents: enemyCount >= 2 ? 1 : 0,
        squadXp: 18 + enemyCount * 10,
        cards: cardRewards,
        recipe: recipeReward,
        unlockable: unlockableReward,
        gearRewards,
    };
}
// ----------------------------------------------------------------------------
// CARD DRAW
// ----------------------------------------------------------------------------
/**
 * Draw cards for turn with automatic reshuffle (15c)
 * Reshuffles discard into deck if deck.length < handSize before drawing
 */
function drawCardsForTurn(state, unit, handSize = 5) {
    const drawBonus = (0, echoFieldEffects_1.getEchoTurnStartDrawBonus)(state, unit);
    const targetHandSize = handSize + drawBonus.amount;
    let u = unit;
    // 15c: Reshuffle if deck has fewer than handSize cards remaining
    if (u.drawPile.length < targetHandSize && u.discardPile.length > 0) {
        const reshuffled = shuffleArray([...u.discardPile]);
        u = {
            ...u,
            drawPile: [...u.drawPile, ...reshuffled],
            discardPile: [],
        };
        if (DEBUG_BATTLE) {
            console.log(`[BATTLE] RESHUFFLE discard->deck (${reshuffled.length} cards) for ${u.name}`);
        }
    }
    const newHand = [...u.hand];
    const newDraw = [...u.drawPile];
    while (newHand.length < targetHandSize && newDraw.length > 0) {
        newHand.push(newDraw.shift());
    }
    const updatedUnit = {
        ...u,
        hand: newHand,
        drawPile: newDraw,
    };
    let nextState = {
        ...state,
        units: {
            ...state.units,
            [updatedUnit.id]: updatedUnit,
        },
    };
    if (drawBonus.amount > 0) {
        nextState = (0, echoFieldEffects_1.incrementEchoFieldTriggerCount)(nextState, drawBonus.triggeredPlacements, `SLK//ECHO  :: ${unit.name} draws +${drawBonus.amount} from Relay Zone.`);
    }
    return nextState;
}
// ----------------------------------------------------------------------------
// TEST BATTLE CREATION - WITH EQUIPMENT INTEGRATION
// ----------------------------------------------------------------------------
/**
 * Calculate maximum units allowed per side based on grid area
 */
/**
 * Calculate maximum units allowed per side based on grid area (15b)
 * Formula: clamp(floor(gridArea * 0.25), 3, 10)
 */
function calculateMaxUnitsPerSide(gridWidth, gridHeight) {
    const gridArea = gridWidth * gridHeight;
    const rawMax = Math.floor(gridArea * 0.25);
    return Math.max(3, Math.min(rawMax, 10));
}
function createTestBattleForCurrentParty(state, gridOverride) {
    const partyIds = state.partyUnitIds;
    if (partyIds.length === 0)
        return null;
    // Grid size selection (15b): Random within bounds 4x3 to 8x6
    // Width: 4-8, Height: 3-6
    const gridWidth = Math.max(4, Math.floor(gridOverride?.width ?? (Math.floor(Math.random() * (8 - 4 + 1)) + 4)));
    const gridHeight = Math.max(3, Math.floor(gridOverride?.height ?? (Math.floor(Math.random() * (6 - 3 + 1)) + 3)));
    // Generate random elevation map
    const maxElevation = 3;
    const elevationMap = (0, terrainGeneration_1.generateElevationMap)(gridWidth, gridHeight, maxElevation);
    const tiles = createGrid(gridWidth, gridHeight, elevationMap);
    const maxUnitsPerSide = calculateMaxUnitsPerSide(gridWidth, gridHeight);
    // Get equipment data from state (or use defaults)
    const equipmentById = state.equipmentById || (0, equipment_1.getAllStarterEquipment)();
    const units = {};
    // Create player units WITHOUT positions initially (placement phase)
    partyIds.forEach((id) => {
        const base = state.unitsById[id];
        if (!base)
            return;
        // Create unit without position - will be placed during placement phase
        units[id] = createBattleUnitState(base, {
            isEnemy: false,
            pos: null, // Start with no position - placement phase
            gearSlots: state.gearSlots ?? {},
            stable: state.stable, // Pass stable state for mount system
        }, equipmentById);
    });
    // Don't compute turn order yet - wait until placement is confirmed
    // Enemies will be placed automatically on the right edge
    const turnOrder = [];
    const activeUnitId = null;
    let battle = {
        id: "battle_test_1",
        floorId: state.operation?.floors[state.operation.currentFloorIndex]?.id ??
            "unknown_floor",
        roomId: state.operation?.currentRoomId ?? "unknown_room",
        gridWidth,
        gridHeight,
        tiles,
        units,
        turnOrder,
        activeUnitId,
        phase: "placement", // Start in placement phase
        turnCount: 0,
        log: [
            `SLK//ENGAGE :: Engagement feed online.`,
            `SLK//ROOM   :: Linked to node ${state.operation?.currentRoomId}.`,
            `SLK//PLACE  :: Unit placement phase - position your squad on the left edge.`,
        ],
        placementState: {
            placedUnitIds: [], // Array instead of Set
            selectedUnitId: null,
            maxUnitsPerSide,
        },
    };
    // Attach 10za load penalties based on current inventory
    if (state.inventory) {
        const loadPenalties = (0, inventory_1.computeLoadPenaltyFlags)(state.inventory);
        battle.loadPenalties = loadPenalties;
        // MASS overload -> AGI down for all allies at start
        if (loadPenalties.massOver) {
            const newUnits = { ...battle.units };
            const allies = Object.values(newUnits).filter((u) => !u.isEnemy);
            for (const ally of allies) {
                const cur = newUnits[ally.id];
                newUnits[ally.id] = {
                    ...cur,
                    agi: Math.max(1, cur.agi - 1),
                };
            }
            battle = {
                ...battle,
                units: newUnits,
                log: [
                    ...battle.log,
                    "SLK//LOAD  :: MASS overload - squad AGI reduced.",
                ],
            };
        }
    }
    // Place enemies automatically on the right edge
    const activeFloorOrdinal = Math.max(1, state.operation?.theater?.definition.floorOrdinal
        ?? ((state.operation?.currentFloorIndex ?? 0) + 1));
    const enemyCount = Math.min(3, maxUnitsPerSide);
    const selectedEnemyIds = (0, enemies_1.pickEnemyIdsForCampaignFloor)(activeFloorOrdinal, enemyCount);
    const fallbackEnemyIds = selectedEnemyIds.length > 0 ? selectedEnemyIds : ["gate_sentry"];
    fallbackEnemyIds.forEach((enemyDefinitionId, index) => {
        const enemyDef = (0, enemies_1.getEnemyDefinition)(enemyDefinitionId);
        if (!enemyDef) {
            return;
        }
        const accuracy = enemyDef.role === "ranged" || enemyDef.role === "artillery" ? 80 : 75;
        const enemyId = `enemy_${enemyDef.id}_${index + 1}`;
        const pos = {
            x: gridWidth - 1,
            y: Math.min(gridHeight - 1, Math.floor((gridHeight / fallbackEnemyIds.length) * index + 1)),
        };
        const enemyBase = {
            id: enemyId,
            name: enemyDef.name,
            isEnemy: true,
            hp: enemyDef.baseStats.hp,
            maxHp: enemyDef.baseStats.hp,
            agi: enemyDef.baseStats.agi,
            pos,
            hand: [],
            drawPile: [...(enemyDef.deck ?? ["card_strike", "card_guard"])],
            discardPile: [],
            strain: 0,
            atk: enemyDef.baseStats.atk,
            def: enemyDef.baseStats.def,
            acc: accuracy,
            move: enemyDef.baseStats.move,
            stats: {
                maxHp: enemyDef.baseStats.hp,
                atk: enemyDef.baseStats.atk,
                def: enemyDef.baseStats.def,
                agi: enemyDef.baseStats.agi,
                acc: accuracy,
            },
        };
        units[enemyId] = createBattleUnitState(enemyBase, {
            isEnemy: true,
            pos,
        }, equipmentById);
    });
    // Update battle with enemy units
    battle.units = units;
    if (fallbackEnemyIds.length > 0) {
        battle.log = [
            ...battle.log,
            `SLK//HOSTILE:: ${fallbackEnemyIds
                .map((enemyId) => (0, enemies_1.getEnemyDefinition)(enemyId)?.name ?? enemyId)
                .join(", ")}`,
        ];
    }
    // Trigger Field Mod: battle_start
    battle = (0, fieldModBattleIntegration_1.triggerBattleStart)(battle);
    return battle;
}
// ==========================================
// PLAY CARD FUNCTION
// ==========================================
/**
 * Play a card from a unit's hand onto a target
 */
function playCard(state, unitId, cardIndex, targetId) {
    // Get units from Record (not array!)
    const unit = state.units[unitId];
    const target = state.units[targetId];
    if (!unit || !target) {
        return appendBattleLog(state, "SLK//ERROR :: Invalid unit or target for card play.");
    }
    const cardId = unit.hand[cardIndex];
    if (!cardId) {
        return appendBattleLog(state, "SLK//ERROR :: No card at index " + cardIndex);
    }
    // Get card info (cards are always string IDs in hand)
    const cardName = cardId.replace(/^(core_|class_|card_|equip_)/, "").replace(/_/g, " ");
    const cardDesc = "";
    const overdriveDiscount = (unit.turnCardsPlayed ?? 0) === 0
        ? (0, echoFieldEffects_1.getEchoFirstCardStrainDiscount)(state, unit)
        : { amount: 0, triggeredPlacements: [] };
    const strainCost = Math.max(0, 1 - overdriveDiscount.amount);
    // Create new hand without the played card
    const newHand = [...unit.hand];
    newHand.splice(cardIndex, 1);
    // Create new discard with the played card
    const newDiscard = [...unit.discardPile, cardId];
    // Apply strain
    const newStrain = unit.strain + strainCost;
    // Start building the new unit
    let updatedUnit = {
        ...unit,
        hand: newHand,
        discardPile: newDiscard,
        strain: newStrain,
        turnCardsPlayed: (unit.turnCardsPlayed ?? 0) + 1,
    };
    // Start building updated target (may be same as unit for self-target)
    let updatedTarget = targetId === unitId ? updatedUnit : { ...target };
    // Log the card play
    let newLog = [...state.log, `SLK//CARD :: ${unit.name} plays ${cardName} on ${target.name}.`];
    // Process card effects based on description parsing
    // Damage effects
    const dmgMatch = cardDesc.match(/deal\s+(\d+)\s+damage/i);
    if (dmgMatch && targetId !== unitId) {
        const baseDamage = parseInt(dmgMatch[1], 10);
        const finalDamage = Math.max(1, baseDamage + unit.atk - target.def);
        const newHp = Math.max(0, target.hp - finalDamage);
        updatedTarget = { ...updatedTarget, hp: newHp };
        newLog.push(`SLK//DMG :: ${target.name} takes ${finalDamage} damage. (HP: ${newHp}/${target.maxHp})`);
        // Check if target died
        if (newHp <= 0) {
            newLog.push(`SLK//KILL :: ${target.name} has been eliminated!`);
        }
    }
    // Basic attack (no damage in description) - use weapon damage
    if (cardName.toLowerCase().includes("basic attack") && targetId !== unitId) {
        const finalDamage = Math.max(1, unit.atk - target.def);
        const newHp = Math.max(0, target.hp - finalDamage);
        updatedTarget = { ...updatedTarget, hp: newHp };
        newLog.push(`SLK//DMG :: ${target.name} takes ${finalDamage} damage. (HP: ${newHp}/${target.maxHp})`);
        if (newHp <= 0) {
            newLog.push(`SLK//KILL :: ${target.name} has been eliminated!`);
        }
    }
    // Healing effects
    const healMatch = cardDesc.match(/restore\s+(\d+)\s+hp/i) || cardDesc.match(/heal\s+(\d+)/i);
    if (healMatch) {
        const healAmount = parseInt(healMatch[1], 10);
        const oldHp = updatedTarget.hp;
        const newHp = Math.min(updatedTarget.maxHp, oldHp + healAmount);
        const actualHeal = newHp - oldHp;
        if (actualHeal > 0) {
            updatedTarget = { ...updatedTarget, hp: newHp };
            newLog.push(`SLK//HEAL :: ${target.name} restores ${actualHeal} HP. (HP: ${newHp}/${target.maxHp})`);
        }
    }
    // Buff effects (DEF)
    const defBuffMatch = cardDesc.match(/\+(\d+)\s+def/i) || cardDesc.match(/gain\s+(\d+)\s+def/i);
    if (defBuffMatch) {
        const buffAmount = parseInt(defBuffMatch[1], 10);
        const newBuffs = [...(updatedTarget.buffs || []), { id: "def_buff", type: "def_up", amount: buffAmount, duration: 1 }];
        updatedTarget = { ...updatedTarget, buffs: newBuffs };
        newLog.push(`SLK//BUFF :: ${target.name} gains +${buffAmount} DEF for 1 turn.`);
    }
    // ATK buff
    const atkBuffMatch = cardDesc.match(/\+(\d+)\s+atk/i) || cardDesc.match(/gain\s+(\d+)\s+atk/i);
    if (atkBuffMatch) {
        const buffAmount = parseInt(atkBuffMatch[1], 10);
        const newBuffs = [...(updatedTarget.buffs || []), { id: "atk_buff", type: "atk_up", amount: buffAmount, duration: 1 }];
        updatedTarget = { ...updatedTarget, buffs: newBuffs };
        newLog.push(`SLK//BUFF :: ${target.name} gains +${buffAmount} ATK for 1 turn.`);
    }
    // Build new units Record
    const newUnits = { ...state.units };
    newUnits[unitId] = updatedUnit;
    if (targetId !== unitId) {
        // If target died, remove it from units Record (like attackUnit does)
        if (updatedTarget.hp <= 0) {
            delete newUnits[targetId];
        }
        else {
            newUnits[targetId] = updatedTarget;
        }
    }
    else {
        // Self-target: updatedUnit already has the changes
        // If unit died from self-target, remove it
        if (updatedTarget.hp <= 0) {
            delete newUnits[unitId];
        }
        else {
            newUnits[unitId] = updatedTarget;
        }
    }
    // Remove dead units from turn order
    let newTurnOrder = [...state.turnOrder];
    if (updatedTarget.hp <= 0) {
        newTurnOrder = newTurnOrder.filter(id => id !== targetId);
    }
    // Build new state
    let newState = {
        ...state,
        units: newUnits,
        turnOrder: newTurnOrder,
        log: newLog,
    };
    if (overdriveDiscount.amount > 0) {
        newState = (0, echoFieldEffects_1.incrementEchoFieldTriggerCount)(newState, overdriveDiscount.triggeredPlacements, `SLK//ECHO  :: ${unit.name} overdrives the first card for -${overdriveDiscount.amount} Strain.`);
    }
    // Trigger Field Mod: card_played
    newState = (0, fieldModBattleIntegration_1.triggerCardPlayed)(newState, unitId, cardId, 0);
    // Check for battle outcome
    newState = evaluateBattleOutcome(newState);
    return newState;
}
/**
 * Alias for drawCardsForTurn for backwards compatibility
 */
function drawCards(state, unit, _count = 5) {
    return drawCardsForTurn(state, unit);
}
function getPlacementTilesForUnit(state, unit) {
    const zoneTiles = unit.isEnemy
        ? state.spawnZones?.enemySpawn ?? []
        : state.spawnZones?.friendlySpawn ?? [];
    if (zoneTiles.length > 0) {
        return zoneTiles
            .filter((point) => Boolean(getTileAt(state, point.x, point.y)))
            .map((point) => ({ x: point.x, y: point.y }));
    }
    const edgeX = unit.isEnemy ? state.gridWidth - 1 : 0;
    return state.tiles
        .filter((tile) => tile.pos.x === edgeX)
        .sort((a, b) => a.pos.y - b.pos.y)
        .map((tile) => ({ x: tile.pos.x, y: tile.pos.y }));
}
function getEffectivePlacedUnitIds(state) {
    const placementState = state.placementState;
    if (!placementState) {
        return [];
    }
    const placedUnitIds = new Set(placementState.placedUnitIds);
    Object.values(state.units).forEach((unit) => {
        if (!unit.pos || unit.hp <= 0 || placedUnitIds.has(unit.id)) {
            return;
        }
        const isOnLegalPlacementTile = getPlacementTilesForUnit(state, unit).some((tile) => tile.x === unit.pos.x && tile.y === unit.pos.y);
        if (isOnLegalPlacementTile) {
            placedUnitIds.add(unit.id);
        }
    });
    return Array.from(placedUnitIds);
}
// ----------------------------------------------------------------------------
// PLACEMENT PHASE FUNCTIONS
// ----------------------------------------------------------------------------
/**
 * Place a unit at a specific position during placement phase
 */
function placeUnit(state, unitId, pos) {
    if (state.phase !== "placement")
        return state;
    const unit = state.units[unitId];
    if (!unit)
        return state;
    const validPlacementTiles = getPlacementTilesForUnit(state, unit);
    if (!validPlacementTiles.some((tile) => tile.x === pos.x && tile.y === pos.y)) {
        return appendBattleLog(state, `SLK//PLACE  :: Invalid placement position for ${unit.name}.`);
    }
    // Check if tile is already occupied
    const occupied = Object.values(state.units).some(u => u.pos && u.pos.x === pos.x && u.pos.y === pos.y && u.hp > 0);
    if (occupied) {
        return appendBattleLog(state, `SLK//PLACE  :: Tile (${pos.x}, ${pos.y}) is already occupied.`);
    }
    // Check max units limit
    const placementState = state.placementState;
    if (!placementState)
        return state;
    const placedCountForSide = placementState.placedUnitIds.reduce((count, placedUnitId) => {
        const placedUnit = state.units[placedUnitId];
        return placedUnit && placedUnit.isEnemy === unit.isEnemy ? count + 1 : count;
    }, 0);
    if (placedCountForSide >= placementState.maxUnitsPerSide) {
        return appendBattleLog(state, `SLK//PLACE  :: Maximum units per side (${placementState.maxUnitsPerSide}) reached.`);
    }
    // Check if already placed
    if (placementState.placedUnitIds.includes(unitId)) {
        return appendBattleLog(state, `SLK//PLACE  :: ${unit.name} is already placed.`);
    }
    // Place the unit
    const newUnits = { ...state.units };
    newUnits[unitId] = { ...unit, pos };
    const newPlacedIds = [...placementState.placedUnitIds, unitId];
    return {
        ...state,
        units: newUnits,
        placementState: {
            ...placementState,
            placedUnitIds: newPlacedIds,
        },
        log: [...state.log, `SLK//PLACE  :: ${unit.name} placed at (${pos.x}, ${pos.y}).`],
    };
}
/**
 * Quick place all unplaced units for the active placement side automatically
 */
function quickPlaceUnits(state, controller) {
    if (state.phase !== "placement")
        return state;
    const placementState = state.placementState;
    if (!placementState)
        return state;
    const effectivePlacedUnitIds = new Set(getEffectivePlacedUnitIds(state));
    const placementUnits = Object.values(state.units).filter((unit) => {
        if (state.modeContext?.kind === "squad" && controller) {
            return (unit.controller ?? "P1") === controller;
        }
        return !unit.isEnemy && (!controller || (unit.controller ?? "P1") === controller);
    });
    const unplacedUnits = placementUnits.filter((unit) => !effectivePlacedUnitIds.has(unit.id));
    let newState = state;
    // Place units centered around their side's deployment edge.
    for (let i = 0; i < unplacedUnits.length; i++) {
        const unit = unplacedUnits[i];
        const placedCountForSide = newState.placementState?.placedUnitIds.reduce((count, placedUnitId) => {
            const placedUnit = newState.units[placedUnitId];
            return placedUnit && placedUnit.isEnemy === unit.isEnemy ? count + 1 : count;
        }, 0) ?? 0;
        if (placedCountForSide >= placementState.maxUnitsPerSide) {
            continue;
        }
        const candidateTiles = getPlacementTilesForUnit(newState, unit).filter((tile) => !Object.values(newState.units).some((otherUnit) => otherUnit.hp > 0 && otherUnit.pos && otherUnit.pos.x === tile.x && otherUnit.pos.y === tile.y));
        const targetTile = candidateTiles[i % Math.max(1, candidateTiles.length)] ?? candidateTiles[0];
        if (!targetTile) {
            continue;
        }
        newState = placeUnit(newState, unit.id, targetTile);
    }
    const placedDelta = newState.placementState.placedUnitIds.length - state.placementState.placedUnitIds.length;
    const ownerLabel = controller ? ` for ${controller}` : "";
    return appendBattleLog(newState, `SLK//PLACE  :: Quick placed ${placedDelta} units${ownerLabel}.`);
}
/**
 * Remove a placed unit (15b) - allows unplacing units
 */
function removePlacedUnit(state, unitId) {
    if (state.phase !== "placement")
        return state;
    const unit = state.units[unitId];
    if (!unit)
        return state;
    const placementState = state.placementState;
    if (!placementState)
        return state;
    if (!placementState.placedUnitIds.includes(unitId))
        return state;
    // Remove position and from placed list
    const newUnits = { ...state.units };
    newUnits[unitId] = { ...unit, pos: null };
    const newPlacedIds = placementState.placedUnitIds.filter(id => id !== unitId);
    return {
        ...state,
        units: newUnits,
        placementState: {
            ...placementState,
            placedUnitIds: newPlacedIds,
            selectedUnitId: placementState.selectedUnitId === unitId ? null : placementState.selectedUnitId,
        },
    };
}
/**
 * Set selected unit for placement (15b)
 */
function setPlacementSelectedUnit(state, unitId) {
    if (state.phase !== "placement")
        return state;
    const placementState = state.placementState;
    if (!placementState)
        return state;
    return {
        ...state,
        placementState: {
            ...placementState,
            selectedUnitId: unitId,
        },
    };
}
/**
 * Confirm placement and start battle
 */
function confirmPlacement(state) {
    if (state.phase !== "placement")
        return state;
    const placementState = state.placementState;
    if (!placementState)
        return state;
    const effectivePlacedUnitIds = getEffectivePlacedUnitIds(state);
    const placedCount = effectivePlacedUnitIds.length;
    let friendlyPlaced = 0;
    let enemyPlaced = 0;
    effectivePlacedUnitIds.forEach((unitId) => {
        const placedUnit = state.units[unitId];
        if (!placedUnit) {
            return;
        }
        if (placedUnit.isEnemy) {
            enemyPlaced += 1;
        }
        else {
            friendlyPlaced += 1;
        }
    });
    if (placedCount === 0 || friendlyPlaced === 0) {
        return appendBattleLog(state, `SLK//PLACE  :: Please place at least one unit before confirming.`);
    }
    if (state.modeContext?.kind === "squad") {
        const hasEnemyRoster = Object.values(state.units).some((unit) => unit.isEnemy);
        if (friendlyPlaced === 0 || (hasEnemyRoster && enemyPlaced === 0)) {
            return appendBattleLog(state, "SLK//PLACE  :: Both skirmish lines must deploy before the host can confirm placement.");
        }
    }
    // Filter out any player units that weren't placed
    const filteredUnits = {};
    // Keep all enemies
    Object.entries(state.units).forEach(([id, u]) => {
        if (u.isEnemy) {
            filteredUnits[id] = u;
        }
    });
    // Keep ONLY placed player units
    effectivePlacedUnitIds.forEach(id => {
        if (state.units[id]) {
            filteredUnits[id] = state.units[id];
        }
    });
    // Compute turn order now that all units are placed
    const turnOrder = computeTurnOrder(filteredUnits);
    const activeUnitId = turnOrder[0] ?? null;
    // Switch to inProgress phase
    let newState = {
        ...state,
        units: filteredUnits, // PRUNE unplaced units so they don't get turns or interfere with outcome
        phase: activeUnitId && filteredUnits[activeUnitId]?.isEnemy ? "enemy_turn" : "player_turn",
        turnOrder,
        activeUnitId,
        turnCount: 1,
        placementState: undefined, // Clear placement state
        log: [
            ...state.log,
            `SLK//ENGAGE :: Placement confirmed. Battle begins.`,
        ],
    };
    // Draw hand for first active unit if it's a player unit
    if (activeUnitId) {
        const firstActive = newState.units[activeUnitId];
        if (firstActive && !firstActive.isEnemy) {
            newState = drawCardsForTurn(newState, firstActive);
            newState = appendBattleLog(newState, `SLK//UNIT   :: ${firstActive.name} draws opening hand.`);
        }
    }
    return newState;
}

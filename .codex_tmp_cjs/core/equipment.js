"use strict";
// ============================================================================
// EQUIPMENT SYSTEM - Core Types and Data
// Headline 11b & 11c: Equipment, Cards, Deck Building
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.STARTER_ACCESSORIES = exports.STARTER_CHESTPIECES = exports.STARTER_HELMETS = exports.STARTER_WEAPONS = exports.EQUIPMENT_CARDS = exports.CLASS_CARDS = exports.CHAOS_CARDS = exports.CORE_CARDS = exports.CLASS_WEAPON_RESTRICTIONS = void 0;
exports.canEquipWeapon = canEquipWeapon;
exports.getAllStarterEquipment = getAllStarterEquipment;
exports.getAllEquipmentCards = getAllEquipmentCards;
exports.buildDeckFromLoadout = buildDeckFromLoadout;
exports.calculateEquipmentStats = calculateEquipmentStats;
const technica_1 = require("../content/technica");
const gearWorkbench_1 = require("./gearWorkbench");
// ----------------------------------------------------------------------------
// CLASS WEAPON RESTRICTIONS
// ----------------------------------------------------------------------------
exports.CLASS_WEAPON_RESTRICTIONS = {
    // Squire tree
    squire: ["sword", "shield"],
    sentry: ["sword", "greatsword", "shield"],
    paladin: ["sword", "greatsword", "shield"],
    watchGuard: ["sword", "bow", "shield"],
    // Ranger tree
    ranger: ["bow"],
    hunter: ["bow", "gun"],
    bowmaster: ["bow", "greatbow"],
    trapper: ["bow", "gun"],
    // Magician tree
    magician: ["staff"],
    cleric: ["staff"],
    wizard: ["staff", "greatstaff"],
    chaosmancer: ["staff", "sword"],
    // Thief tree
    thief: ["shortsword"],
    scout: ["bow"],
    shadow: ["shortsword", "bow"],
    trickster: ["sword"],
    // Academic (unique)
    academic: ["bow", "shortsword"],
    // Freelancer (all weapons, but with penalty)
    freelancer: [
        "sword",
        "greatsword",
        "shortsword",
        "shield",
        "bow",
        "greatbow",
        "gun",
        "staff",
        "greatstaff",
        "dagger",
    ],
};
// ----------------------------------------------------------------------------
// DATA RE-EXPORTS (Data moved to separate files to maintain manageable file size)
// ----------------------------------------------------------------------------
var coreCards_1 = require("../data/cards/coreCards");
Object.defineProperty(exports, "CORE_CARDS", { enumerable: true, get: function () { return coreCards_1.CORE_CARDS; } });
var chaosCards_1 = require("../data/cards/chaosCards");
Object.defineProperty(exports, "CHAOS_CARDS", { enumerable: true, get: function () { return chaosCards_1.CHAOS_CARDS; } });
var classCards_1 = require("../data/cards/classCards");
Object.defineProperty(exports, "CLASS_CARDS", { enumerable: true, get: function () { return classCards_1.CLASS_CARDS; } });
var equipmentCards_1 = require("../data/cards/equipmentCards");
Object.defineProperty(exports, "EQUIPMENT_CARDS", { enumerable: true, get: function () { return equipmentCards_1.EQUIPMENT_CARDS; } });
var weapons_1 = require("../data/weapons");
Object.defineProperty(exports, "STARTER_WEAPONS", { enumerable: true, get: function () { return weapons_1.STARTER_WEAPONS; } });
var armor_1 = require("../data/armor");
Object.defineProperty(exports, "STARTER_HELMETS", { enumerable: true, get: function () { return armor_1.STARTER_HELMETS; } });
Object.defineProperty(exports, "STARTER_CHESTPIECES", { enumerable: true, get: function () { return armor_1.STARTER_CHESTPIECES; } });
Object.defineProperty(exports, "STARTER_ACCESSORIES", { enumerable: true, get: function () { return armor_1.STARTER_ACCESSORIES; } });
// Import them locally as well so the helper functions below can still use them
const coreCards_2 = require("../data/cards/coreCards");
const chaosCards_2 = require("../data/cards/chaosCards");
const classCards_2 = require("../data/cards/classCards");
const equipmentCards_2 = require("../data/cards/equipmentCards");
const weapons_2 = require("../data/weapons");
const armor_2 = require("../data/armor");
// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------
function canEquipWeapon(unitClass, weaponType) {
    const allowed = exports.CLASS_WEAPON_RESTRICTIONS[unitClass];
    if (allowed) {
        return allowed.includes(weaponType);
    }
    const importedClass = (0, technica_1.getImportedClass)(unitClass);
    if (importedClass) {
        return importedClass.weaponTypes.includes(weaponType);
    }
    return false;
}
function toEquipmentCardRange(range) {
    if (range === undefined) {
        return undefined;
    }
    return range <= 0 ? "R(Self)" : `R(${range})`;
}
function toImportedEquipmentCard(card) {
    return {
        id: card.id,
        name: card.name,
        type: card.type,
        strainCost: card.strainCost,
        description: card.description,
        range: toEquipmentCardRange(card.range),
        damage: card.damage,
        effects: card.effects.map((effect) => effect.type),
        sourceEquipmentId: card.sourceEquipmentId,
        sourceClassId: card.sourceClassId,
        artPath: card.artPath
    };
}
function toLibraryEquipmentCard(card) {
    return {
        id: card.id,
        name: card.name,
        type: card.category === "chaos" ? "gambit" : "equipment",
        strainCost: card.strainCost,
        description: card.description,
        artPath: card.artPath,
    };
}
function toRuntimeEquipment(gear) {
    if (gear.slot === "weapon") {
        const runtimeGear = { ...gear };
        delete runtimeGear.moduleSlots;
        delete runtimeGear.attachedModules;
        return {
            ...runtimeGear,
            slot: "weapon",
            weaponType: gear.weaponType ?? "sword",
            isMechanical: gear.isMechanical ?? false,
            cardsGranted: gear.cardsGranted ?? [],
            wear: gear.wear ?? 0
        };
    }
    return {
        ...gear,
        cardsGranted: gear.cardsGranted ?? [],
        slot: gear.slot
    };
}
function getAllStarterEquipment() {
    const all = {};
    for (const w of weapons_2.STARTER_WEAPONS) {
        if (!(0, technica_1.isTechnicaContentDisabled)("gear", w.id))
            all[w.id] = w;
    }
    for (const h of armor_2.STARTER_HELMETS) {
        if (!(0, technica_1.isTechnicaContentDisabled)("gear", h.id))
            all[h.id] = h;
    }
    for (const c of armor_2.STARTER_CHESTPIECES) {
        if (!(0, technica_1.isTechnicaContentDisabled)("gear", c.id))
            all[c.id] = c;
    }
    for (const a of armor_2.STARTER_ACCESSORIES) {
        if (!(0, technica_1.isTechnicaContentDisabled)("gear", a.id))
            all[a.id] = a;
    }
    for (const gear of (0, technica_1.getAllImportedGear)()) {
        all[gear.id] = toRuntimeEquipment(gear);
    }
    return all;
}
function getAllEquipmentCards() {
    const all = {};
    for (const c of coreCards_2.CORE_CARDS) {
        if (!(0, technica_1.isTechnicaContentDisabled)("card", c.id))
            all[c.id] = c;
    }
    for (const c of chaosCards_2.CHAOS_CARDS) {
        if (!(0, technica_1.isTechnicaContentDisabled)("card", c.id))
            all[c.id] = c;
    }
    for (const c of equipmentCards_2.EQUIPMENT_CARDS) {
        if (!(0, technica_1.isTechnicaContentDisabled)("card", c.id))
            all[c.id] = c;
    }
    for (const unitClass of Object.keys(classCards_2.CLASS_CARDS)) {
        for (const c of classCards_2.CLASS_CARDS[unitClass]) {
            if (!(0, technica_1.isTechnicaContentDisabled)("card", c.id))
                all[c.id] = c;
        }
    }
    for (const card of Object.values((0, gearWorkbench_1.getLibraryCardDatabase)())) {
        if ((0, technica_1.isTechnicaContentDisabled)("card", card.id))
            continue;
        if (!all[card.id]) {
            all[card.id] = toLibraryEquipmentCard(card);
        }
    }
    for (const card of (0, technica_1.getAllImportedCards)()) {
        all[card.id] = toImportedEquipmentCard(card);
    }
    return all;
}
function getClassCardsForUnitClass(unitClass) {
    const builtInCards = classCards_2.CLASS_CARDS[unitClass] || [];
    const importedCards = (0, technica_1.getAllImportedCards)()
        .filter((card) => card.type === "class" && card.sourceClassId === unitClass)
        .map((card) => toImportedEquipmentCard(card));
    return [...builtInCards, ...importedCards];
}
function getEquipmentDeckCards(equipment, gearSlots) {
    const baseCards = Array.isArray(equipment.cardsGranted) ? equipment.cardsGranted : [];
    if (!gearSlots) {
        return [...baseCards];
    }
    const slottedCards = Array.isArray(gearSlots.slottedCards) ? gearSlots.slottedCards : [];
    if (baseCards.length > 0) {
        return [...baseCards, ...slottedCards];
    }
    const lockedCards = Array.isArray(gearSlots.lockedCards) ? gearSlots.lockedCards : [];
    return [...lockedCards, ...slottedCards];
}
function buildDeckFromLoadout(unitClass, loadout, equipmentById, gearSlotsById) {
    const deck = [];
    // 1. Add core cards (always available)
    for (const card of coreCards_2.CORE_CARDS) {
        if ((0, technica_1.isTechnicaContentDisabled)("card", card.id))
            continue;
        deck.push(card.id);
        deck.push(card.id); // Add 2 copies of each core card
    }
    // 2. Add class cards
    const classCards = getClassCardsForUnitClass(unitClass);
    for (const card of classCards) {
        if ((0, technica_1.isTechnicaContentDisabled)("card", card.id))
            continue;
        deck.push(card.id);
    }
    // 3. Add equipment cards from all equipped gear
    const slots = [
        "primaryWeapon",
        "secondaryWeapon",
        "helmet",
        "chestpiece",
        "accessory1",
        "accessory2",
    ];
    for (const slot of slots) {
        const equipId = loadout[slot];
        if (!equipId)
            continue;
        const equip = equipmentById[equipId];
        if (!equip)
            continue;
        for (const cardId of getEquipmentDeckCards(equip, gearSlotsById?.[equipId])) {
            if ((0, technica_1.isTechnicaContentDisabled)("card", cardId))
                continue;
            deck.push(cardId);
        }
    }
    return deck;
}
function calculateEquipmentStats(loadout, equipmentById) {
    const total = { atk: 0, def: 0, agi: 0, acc: 0, hp: 0 };
    const slots = [
        "primaryWeapon",
        "secondaryWeapon",
        "helmet",
        "chestpiece",
        "accessory1",
        "accessory2",
    ];
    for (const slot of slots) {
        const equipId = loadout[slot];
        if (!equipId)
            continue;
        const equip = equipmentById[equipId];
        if (!equip)
            continue;
        total.atk += equip.stats.atk;
        total.def += equip.stats.def;
        total.agi += equip.stats.agi;
        total.acc += equip.stats.acc;
        total.hp += equip.stats.hp;
    }
    return total;
}

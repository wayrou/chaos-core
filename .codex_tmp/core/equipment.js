// ============================================================================
// EQUIPMENT SYSTEM - Core Types and Data
// Headline 11b & 11c: Equipment, Cards, Deck Building
// ============================================================================
import { getAllImportedCards, getAllImportedGear, getImportedClass, isTechnicaContentDisabled, } from "../content/technica";
import { getLibraryCardDatabase } from "./gearWorkbench";
// ----------------------------------------------------------------------------
// CLASS WEAPON RESTRICTIONS
// ----------------------------------------------------------------------------
export const CLASS_WEAPON_RESTRICTIONS = {
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
export { CORE_CARDS } from "../data/cards/coreCards";
export { CHAOS_CARDS } from "../data/cards/chaosCards";
export { CLASS_CARDS } from "../data/cards/classCards";
export { EQUIPMENT_CARDS } from "../data/cards/equipmentCards";
export { STARTER_WEAPONS } from "../data/weapons";
export { STARTER_HELMETS, STARTER_CHESTPIECES, STARTER_ACCESSORIES } from "../data/armor";
// Import them locally as well so the helper functions below can still use them
import { CORE_CARDS } from "../data/cards/coreCards";
import { CHAOS_CARDS } from "../data/cards/chaosCards";
import { CLASS_CARDS } from "../data/cards/classCards";
import { EQUIPMENT_CARDS } from "../data/cards/equipmentCards";
import { STARTER_WEAPONS } from "../data/weapons";
import { STARTER_HELMETS, STARTER_CHESTPIECES, STARTER_ACCESSORIES } from "../data/armor";
// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------
export function canEquipWeapon(unitClass, weaponType) {
    const allowed = CLASS_WEAPON_RESTRICTIONS[unitClass];
    if (allowed) {
        return allowed.includes(weaponType);
    }
    const importedClass = getImportedClass(unitClass);
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
export function getAllStarterEquipment() {
    const all = {};
    for (const w of STARTER_WEAPONS) {
        if (!isTechnicaContentDisabled("gear", w.id))
            all[w.id] = w;
    }
    for (const h of STARTER_HELMETS) {
        if (!isTechnicaContentDisabled("gear", h.id))
            all[h.id] = h;
    }
    for (const c of STARTER_CHESTPIECES) {
        if (!isTechnicaContentDisabled("gear", c.id))
            all[c.id] = c;
    }
    for (const a of STARTER_ACCESSORIES) {
        if (!isTechnicaContentDisabled("gear", a.id))
            all[a.id] = a;
    }
    for (const gear of getAllImportedGear()) {
        all[gear.id] = toRuntimeEquipment(gear);
    }
    return all;
}
export function getAllEquipmentCards() {
    const all = {};
    for (const c of CORE_CARDS) {
        if (!isTechnicaContentDisabled("card", c.id))
            all[c.id] = c;
    }
    for (const c of CHAOS_CARDS) {
        if (!isTechnicaContentDisabled("card", c.id))
            all[c.id] = c;
    }
    for (const c of EQUIPMENT_CARDS) {
        if (!isTechnicaContentDisabled("card", c.id))
            all[c.id] = c;
    }
    for (const unitClass of Object.keys(CLASS_CARDS)) {
        for (const c of CLASS_CARDS[unitClass]) {
            if (!isTechnicaContentDisabled("card", c.id))
                all[c.id] = c;
        }
    }
    for (const card of Object.values(getLibraryCardDatabase())) {
        if (isTechnicaContentDisabled("card", card.id))
            continue;
        if (!all[card.id]) {
            all[card.id] = toLibraryEquipmentCard(card);
        }
    }
    for (const card of getAllImportedCards()) {
        all[card.id] = toImportedEquipmentCard(card);
    }
    return all;
}
function getClassCardsForUnitClass(unitClass) {
    const builtInCards = CLASS_CARDS[unitClass] || [];
    const importedCards = getAllImportedCards()
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
export function buildDeckFromLoadout(unitClass, loadout, equipmentById, gearSlotsById) {
    const deck = [];
    // 1. Add core cards (always available)
    for (const card of CORE_CARDS) {
        if (isTechnicaContentDisabled("card", card.id))
            continue;
        deck.push(card.id);
        deck.push(card.id); // Add 2 copies of each core card
    }
    // 2. Add class cards
    const classCards = getClassCardsForUnitClass(unitClass);
    for (const card of classCards) {
        if (isTechnicaContentDisabled("card", card.id))
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
            if (isTechnicaContentDisabled("card", cardId))
                continue;
            deck.push(cardId);
        }
    }
    return deck;
}
export function calculateEquipmentStats(loadout, equipmentById) {
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

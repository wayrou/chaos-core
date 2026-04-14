"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readGeneratedTechnicaVersionMarker = readGeneratedTechnicaVersionMarker;
exports.registerImportedFieldMap = registerImportedFieldMap;
exports.getImportedFieldMap = getImportedFieldMap;
exports.getImportedFieldMapIds = getImportedFieldMapIds;
exports.getAllImportedFieldMaps = getAllImportedFieldMaps;
exports.registerImportedQuest = registerImportedQuest;
exports.getImportedQuest = getImportedQuest;
exports.getAllImportedQuests = getAllImportedQuests;
exports.registerImportedFieldEnemyDefinition = registerImportedFieldEnemyDefinition;
exports.getImportedFieldEnemyDefinition = getImportedFieldEnemyDefinition;
exports.getAllImportedFieldEnemyDefinitions = getAllImportedFieldEnemyDefinitions;
exports.registerImportedDialogue = registerImportedDialogue;
exports.getImportedDialogue = getImportedDialogue;
exports.getAllImportedDialogues = getAllImportedDialogues;
exports.hasImportedDialogue = hasImportedDialogue;
exports.registerImportedMailEntry = registerImportedMailEntry;
exports.getImportedMailEntry = getImportedMailEntry;
exports.getAllImportedMailEntries = getAllImportedMailEntries;
exports.registerImportedChatterEntry = registerImportedChatterEntry;
exports.getImportedChatterEntry = getImportedChatterEntry;
exports.getAllImportedChatterEntries = getAllImportedChatterEntries;
exports.registerImportedKeyItem = registerImportedKeyItem;
exports.getImportedKeyItem = getImportedKeyItem;
exports.getAllImportedKeyItems = getAllImportedKeyItems;
exports.registerImportedFaction = registerImportedFaction;
exports.getImportedFaction = getImportedFaction;
exports.getAllImportedFactions = getAllImportedFactions;
exports.registerImportedChassis = registerImportedChassis;
exports.getImportedChassis = getImportedChassis;
exports.getAllImportedChassis = getAllImportedChassis;
exports.registerImportedDoctrine = registerImportedDoctrine;
exports.getImportedDoctrine = getImportedDoctrine;
exports.getAllImportedDoctrines = getAllImportedDoctrines;
exports.registerImportedItem = registerImportedItem;
exports.getImportedItem = getImportedItem;
exports.getAllImportedItems = getAllImportedItems;
exports.getImportedStarterItems = getImportedStarterItems;
exports.registerImportedNpc = registerImportedNpc;
exports.getImportedNpc = getImportedNpc;
exports.getAllImportedNpcs = getAllImportedNpcs;
exports.registerImportedGear = registerImportedGear;
exports.getImportedGear = getImportedGear;
exports.getAllImportedGear = getAllImportedGear;
exports.getImportedStarterGear = getImportedStarterGear;
exports.registerImportedCard = registerImportedCard;
exports.registerImportedFieldMod = registerImportedFieldMod;
exports.getImportedFieldMod = getImportedFieldMod;
exports.getAllImportedFieldMods = getAllImportedFieldMods;
exports.registerImportedBattleCard = registerImportedBattleCard;
exports.getImportedCard = getImportedCard;
exports.getImportedBattleCard = getImportedBattleCard;
exports.getAllImportedCards = getAllImportedCards;
exports.getAllImportedBattleCards = getAllImportedBattleCards;
exports.getImportedStarterBattleCards = getImportedStarterBattleCards;
exports.registerImportedClass = registerImportedClass;
exports.registerImportedClassDefinition = registerImportedClassDefinition;
exports.getImportedClass = getImportedClass;
exports.getImportedClassDefinition = getImportedClassDefinition;
exports.getAllImportedClasses = getAllImportedClasses;
exports.getAllImportedClassDefinitions = getAllImportedClassDefinitions;
exports.registerImportedUnit = registerImportedUnit;
exports.registerImportedUnitTemplate = registerImportedUnitTemplate;
exports.getImportedUnit = getImportedUnit;
exports.getImportedUnitTemplate = getImportedUnitTemplate;
exports.getAllImportedUnits = getAllImportedUnits;
exports.getAllImportedUnitTemplates = getAllImportedUnitTemplates;
exports.getImportedRosterUnits = getImportedRosterUnits;
exports.getImportedEncounterUnitsForFloorOrdinal = getImportedEncounterUnitsForFloorOrdinal;
exports.registerImportedOperation = registerImportedOperation;
exports.getImportedOperation = getImportedOperation;
exports.getAllImportedOperations = getAllImportedOperations;
exports.registerImportedCodexEntry = registerImportedCodexEntry;
exports.getImportedCodexEntry = getImportedCodexEntry;
exports.getAllImportedCodexEntries = getAllImportedCodexEntries;
exports.hasTechnicaRegistryEntry = hasTechnicaRegistryEntry;
exports.isTechnicaContentDisabled = isTechnicaContentDisabled;
exports.getTechnicaRegistryFingerprint = getTechnicaRegistryFingerprint;
exports.hydrateGeneratedTechnicaRegistry = hydrateGeneratedTechnicaRegistry;
exports.reloadGeneratedTechnicaEntry = reloadGeneratedTechnicaEntry;
const core_1 = require("@tauri-apps/api/core");
const gearWorkbench_1 = require("../../core/gearWorkbench");
const defaultFactions_1 = require("./defaultFactions");
const importedMaps = new Map();
const importedQuests = new Map();
const importedDialogues = new Map();
const importedMailEntries = new Map();
const importedChatterEntries = new Map();
const importedKeyItems = new Map();
const importedFactions = new Map();
const importedChassis = new Map();
const importedDoctrines = new Map();
const importedItems = new Map();
const importedFieldEnemies = new Map();
const importedNpcs = new Map();
const importedGear = new Map();
const importedCards = new Map();
const importedFieldMods = new Map();
const importedClasses = new Map();
const importedUnits = new Map();
const importedOperations = new Map();
const importedCodexEntries = new Map();
const technicaRegistrySnapshots = new Map();
let technicaRegistryFingerprintCache = "";
const disabledContentIds = new Map([
    ["dialogue", new Set()],
    ["mail", new Set()],
    ["chatter", new Set()],
    ["quest", new Set()],
    ["key_item", new Set()],
    ["faction", new Set()],
    ["chassis", new Set()],
    ["doctrine", new Set()],
    ["map", new Set()],
    ["field_enemy", new Set()],
    ["npc", new Set()],
    ["item", new Set()],
    ["gear", new Set()],
    ["card", new Set()],
    ["fieldmod", new Set()],
    ["unit", new Set()],
    ["operation", new Set()],
    ["class", new Set()],
    ["codex", new Set()],
]);
const GENERATED_RUNTIME_FILE_EXTENSIONS = {
    dialogue: ".dialogue.json",
    mail: ".mail.json",
    chatter: ".chatter.json",
    quest: ".quest.json",
    key_item: ".key_item.json",
    faction: ".faction.json",
    chassis: ".chassis.json",
    doctrine: ".doctrine.json",
    map: ".fieldmap.json",
    field_enemy: ".field_enemy.json",
    npc: ".npc.json",
    item: ".item.json",
    gear: ".gear.json",
    card: ".card.json",
    fieldmod: ".fieldmod.json",
    unit: ".unit.json",
    operation: ".operation.json",
    class: ".class.json",
    codex: ".codex.json",
};
const HYDRATABLE_GENERATED_CONTENT_TYPES = [
    "dialogue",
    "mail",
    "chatter",
    "quest",
    "key_item",
    "faction",
    "chassis",
    "doctrine",
    "map",
    "field_enemy",
    "npc",
    "item",
    "gear",
    "card",
    "fieldmod",
    "unit",
    "operation",
    "class",
    "codex",
];
let generatedRegistryHydrationPromise = null;
let generatedRegistryHydrated = false;
function getImportedUnitSpawnRole(unit) {
    return unit.spawnRole === "enemy" ? "enemy" : "player";
}
function loadGeneratedRegistry(modules, register) {
    Object.values(modules).forEach((module) => {
        register(module.default);
    });
}
function buildGeneratedRuntimePath(contentType, contentId) {
    return `/src/content/technica/generated/${contentType}/${encodeURIComponent(contentId)}${GENERATED_RUNTIME_FILE_EXTENSIONS[contentType]}`;
}
function recordTechnicaRegistrySnapshot(contentType, contentId, value) {
    technicaRegistrySnapshots.set(`${contentType}:${contentId}`, JSON.stringify(value));
    technicaRegistryFingerprintCache = "";
}
function recordDisabledTechnicaContentSnapshot(entry) {
    technicaRegistrySnapshots.set(`disabled:${entry.contentType}:${entry.id}`, JSON.stringify(entry));
    technicaRegistryFingerprintCache = "";
}
function getTauriInvoke() {
    if (typeof window === "undefined") {
        return null;
    }
    const anyWindow = window;
    if (typeof anyWindow.__TAURI__?.invoke === "function") {
        return anyWindow.__TAURI__.invoke;
    }
    return anyWindow.__TAURI__ || anyWindow.__TAURI_INTERNALS__ ? core_1.invoke : null;
}
function isTauriAvailable() {
    return getTauriInvoke() !== null;
}
async function readGeneratedJsonThroughTauri(command, args) {
    const invoke = getTauriInvoke();
    if (!invoke) {
        return null;
    }
    try {
        const raw = await invoke(command, args);
        if (typeof raw !== "string" || !raw.trim()) {
            return null;
        }
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
async function fetchGeneratedRuntimeEntry(contentType, contentId) {
    if (!contentId.trim()) {
        return null;
    }
    const tauriEntry = await readGeneratedJsonThroughTauri("read_generated_technica_entry", {
        contentType,
        contentId
    });
    if (tauriEntry) {
        return tauriEntry;
    }
    if (typeof window === "undefined" || !import.meta.env.DEV) {
        return null;
    }
    try {
        const response = await fetch(`${buildGeneratedRuntimePath(contentType, contentId)}?t=${Date.now()}`, {
            cache: "no-store",
            headers: {
                Accept: "application/json"
            }
        });
        if (!response.ok) {
            return null;
        }
        return (await response.json());
    }
    catch {
        return null;
    }
}
async function fetchGeneratedRuntimeRegistry() {
    const tauriRegistry = await readGeneratedJsonThroughTauri("read_generated_technica_registry");
    if (tauriRegistry) {
        return tauriRegistry;
    }
    if (typeof window === "undefined" || !import.meta.env.DEV) {
        return null;
    }
    try {
        const response = await fetch(`/src/content/technica/generated/registry.json?t=${Date.now()}`, {
            cache: "no-store",
            headers: {
                Accept: "application/json"
            }
        });
        if (!response.ok) {
            return null;
        }
        return (await response.json());
    }
    catch {
        return null;
    }
}
async function readGeneratedTechnicaVersionMarker() {
    const tauriVersion = await readGeneratedJsonThroughTauri("read_generated_technica_version");
    if (tauriVersion) {
        return tauriVersion;
    }
    if (typeof window === "undefined" || !import.meta.env.DEV) {
        return null;
    }
    try {
        const response = await fetch(`/src/content/technica/generated/version.json?t=${Date.now()}`, {
            cache: "no-store",
            headers: {
                Accept: "application/json"
            }
        });
        if (!response.ok) {
            return null;
        }
        return (await response.json());
    }
    catch {
        return null;
    }
}
function normalizeGeneratedRegistryIds(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return Array.from(new Set(value.map((entry) => String(entry).trim()).filter(Boolean)));
}
if (typeof import.meta.glob === "function") {
    loadGeneratedRegistry(import.meta.glob("./disabled/*/*.disabled.json", { eager: true }), (entry) => {
        if (entry.origin === "game") {
            disabledContentIds.get(entry.contentType)?.add(entry.id);
            recordDisabledTechnicaContentSnapshot(entry);
        }
    });
    defaultFactions_1.DEFAULT_FACTIONS.forEach((entry) => {
        registerImportedFaction(entry);
    });
    loadGeneratedRegistry(import.meta.glob("./generated/map/*.fieldmap.json", { eager: true }), registerImportedFieldMap);
    loadGeneratedRegistry(import.meta.glob("./generated/quest/*.quest.json", { eager: true }), registerImportedQuest);
    loadGeneratedRegistry(import.meta.glob("./generated/field_enemy/*.field_enemy.json", {
        eager: true,
    }), registerImportedFieldEnemyDefinition);
    loadGeneratedRegistry(import.meta.glob("./generated/dialogue/*.dialogue.json", { eager: true }), registerImportedDialogue);
    loadGeneratedRegistry(import.meta.glob("./generated/mail/*.mail.json", { eager: true }), registerImportedMailEntry);
    loadGeneratedRegistry(import.meta.glob("./generated/chatter/*.chatter.json", { eager: true }), registerImportedChatterEntry);
    loadGeneratedRegistry(import.meta.glob("./generated/faction/*.faction.json", { eager: true }), registerImportedFaction);
    loadGeneratedRegistry(import.meta.glob("./generated/chassis/*.chassis.json", { eager: true }), registerImportedChassis);
    loadGeneratedRegistry(import.meta.glob("./generated/doctrine/*.doctrine.json", { eager: true }), registerImportedDoctrine);
    loadGeneratedRegistry(import.meta.glob("./generated/key_item/*.key_item.json", { eager: true }), registerImportedKeyItem);
    loadGeneratedRegistry(import.meta.glob("./generated/item/*.item.json", { eager: true }), registerImportedItem);
    loadGeneratedRegistry(import.meta.glob("./generated/npc/*.npc.json", { eager: true }), registerImportedNpc);
    loadGeneratedRegistry(import.meta.glob("./generated/gear/*.gear.json", { eager: true }), registerImportedGear);
    loadGeneratedRegistry(import.meta.glob("./generated/card/*.card.json", { eager: true }), registerImportedCard);
    loadGeneratedRegistry(import.meta.glob("./generated/fieldmod/*.fieldmod.json", { eager: true }), registerImportedFieldMod);
    loadGeneratedRegistry(import.meta.glob("./generated/class/*.class.json", { eager: true }), registerImportedClass);
    loadGeneratedRegistry(import.meta.glob("./generated/unit/*.unit.json", { eager: true }), registerImportedUnit);
    loadGeneratedRegistry(import.meta.glob("./generated/operation/*.operation.json", {
        eager: true,
    }), registerImportedOperation);
    loadGeneratedRegistry(import.meta.glob("./generated/codex/*.codex.json", { eager: true }), registerImportedCodexEntry);
}
function registerImportedFieldMap(map) {
    importedMaps.set(map.id, map);
    recordTechnicaRegistrySnapshot("map", map.id, map);
}
function getImportedFieldMap(mapId) {
    return importedMaps.get(mapId) || null;
}
function getImportedFieldMapIds() {
    return Array.from(importedMaps.keys());
}
function getAllImportedFieldMaps() {
    return Array.from(importedMaps.values());
}
function registerImportedQuest(quest) {
    importedQuests.set(quest.id, quest);
    recordTechnicaRegistrySnapshot("quest", quest.id, quest);
}
function getImportedQuest(questId) {
    return importedQuests.get(questId) || null;
}
function getAllImportedQuests() {
    return Array.from(importedQuests.values());
}
function registerImportedFieldEnemyDefinition(definition) {
    importedFieldEnemies.set(definition.id, definition);
    recordTechnicaRegistrySnapshot("field_enemy", definition.id, definition);
}
function getImportedFieldEnemyDefinition(definitionId) {
    return importedFieldEnemies.get(definitionId) || null;
}
function getAllImportedFieldEnemyDefinitions() {
    return Array.from(importedFieldEnemies.values());
}
function registerImportedDialogue(dialogue) {
    importedDialogues.set(dialogue.id, dialogue);
    recordTechnicaRegistrySnapshot("dialogue", dialogue.id, dialogue);
}
function getImportedDialogue(dialogueId) {
    return importedDialogues.get(dialogueId) || null;
}
function getAllImportedDialogues() {
    return Array.from(importedDialogues.values());
}
function hasImportedDialogue(dialogueId) {
    return importedDialogues.has(dialogueId);
}
function registerImportedMailEntry(entry) {
    importedMailEntries.set(entry.id, entry);
    recordTechnicaRegistrySnapshot("mail", entry.id, entry);
}
function getImportedMailEntry(entryId) {
    return importedMailEntries.get(entryId) || null;
}
function getAllImportedMailEntries() {
    return Array.from(importedMailEntries.values());
}
function registerImportedChatterEntry(entry) {
    importedChatterEntries.set(entry.id, entry);
    recordTechnicaRegistrySnapshot("chatter", entry.id, entry);
}
function getImportedChatterEntry(entryId) {
    return importedChatterEntries.get(entryId) || null;
}
function getAllImportedChatterEntries() {
    return Array.from(importedChatterEntries.values());
}
function registerImportedKeyItem(item) {
    importedKeyItems.set(item.id, item);
    recordTechnicaRegistrySnapshot("key_item", item.id, item);
}
function getImportedKeyItem(itemId) {
    return importedKeyItems.get(itemId) || null;
}
function getAllImportedKeyItems() {
    return Array.from(importedKeyItems.values());
}
function registerImportedFaction(faction) {
    importedFactions.set(faction.id, faction);
    recordTechnicaRegistrySnapshot("faction", faction.id, faction);
}
function getImportedFaction(factionId) {
    return importedFactions.get(factionId) || null;
}
function getAllImportedFactions() {
    return Array.from(importedFactions.values());
}
function registerImportedChassis(chassis) {
    importedChassis.set(chassis.id, chassis);
    recordTechnicaRegistrySnapshot("chassis", chassis.id, chassis);
}
function getImportedChassis(chassisId) {
    return importedChassis.get(chassisId) || null;
}
function getAllImportedChassis() {
    return Array.from(importedChassis.values()).filter((entry) => !isTechnicaContentDisabled("chassis", entry.id));
}
function registerImportedDoctrine(doctrine) {
    importedDoctrines.set(doctrine.id, doctrine);
    recordTechnicaRegistrySnapshot("doctrine", doctrine.id, doctrine);
}
function getImportedDoctrine(doctrineId) {
    return importedDoctrines.get(doctrineId) || null;
}
function getAllImportedDoctrines() {
    return Array.from(importedDoctrines.values()).filter((entry) => !isTechnicaContentDisabled("doctrine", entry.id));
}
function registerImportedItem(item) {
    importedItems.set(item.id, item);
    recordTechnicaRegistrySnapshot("item", item.id, item);
}
function getImportedItem(itemId) {
    return importedItems.get(itemId) || null;
}
function getAllImportedItems() {
    return Array.from(importedItems.values());
}
function getImportedStarterItems() {
    return getAllImportedItems().filter((entry) => entry.acquisition?.startsWithPlayer !== false);
}
function registerImportedNpc(npc) {
    importedNpcs.set(npc.id, npc);
    recordTechnicaRegistrySnapshot("npc", npc.id, npc);
}
function getImportedNpc(npcId) {
    return importedNpcs.get(npcId) || null;
}
function getAllImportedNpcs() {
    return Array.from(importedNpcs.values());
}
function registerImportedGear(gear) {
    importedGear.set(gear.id, gear);
    recordTechnicaRegistrySnapshot("gear", gear.id, gear);
}
function getImportedGear(gearId) {
    return importedGear.get(gearId) || null;
}
function getAllImportedGear() {
    return Array.from(importedGear.values());
}
function getImportedStarterGear() {
    return getAllImportedGear().filter((entry) => entry.inventory?.startingOwned !== false);
}
function registerImportedCard(card) {
    importedCards.set(card.id, card);
    recordTechnicaRegistrySnapshot("card", card.id, card);
    (0, gearWorkbench_1.upsertLibraryCard)({
        id: card.id,
        name: card.name,
        rarity: card.rarity ?? "common",
        category: card.category ?? "utility",
        description: card.description,
        strainCost: card.strainCost,
        artPath: card.artPath,
    });
}
function registerImportedFieldMod(fieldMod) {
    importedFieldMods.set(fieldMod.id, fieldMod);
    recordTechnicaRegistrySnapshot("fieldmod", fieldMod.id, fieldMod);
}
function getImportedFieldMod(fieldModId) {
    return importedFieldMods.get(fieldModId) || null;
}
function getAllImportedFieldMods() {
    return Array.from(importedFieldMods.values());
}
function registerImportedBattleCard(card) {
    registerImportedCard(card);
}
function getImportedCard(cardId) {
    return importedCards.get(cardId) || null;
}
function getImportedBattleCard(cardId) {
    return getImportedCard(cardId);
}
function getAllImportedCards() {
    return Array.from(importedCards.values());
}
function getAllImportedBattleCards() {
    return getAllImportedCards();
}
function getImportedStarterBattleCards() {
    return getAllImportedCards();
}
function registerImportedClass(classDefinition) {
    importedClasses.set(classDefinition.id, classDefinition);
    recordTechnicaRegistrySnapshot("class", classDefinition.id, classDefinition);
}
function registerImportedClassDefinition(classDefinition) {
    registerImportedClass(classDefinition);
}
function getImportedClass(classId) {
    return importedClasses.get(classId) || null;
}
function getImportedClassDefinition(classId) {
    return getImportedClass(classId);
}
function getAllImportedClasses() {
    return Array.from(importedClasses.values());
}
function getAllImportedClassDefinitions() {
    return getAllImportedClasses();
}
function registerImportedUnit(unit) {
    importedUnits.set(unit.id, unit);
    recordTechnicaRegistrySnapshot("unit", unit.id, unit);
}
function registerImportedUnitTemplate(unit) {
    registerImportedUnit(unit);
}
function getImportedUnit(unitId) {
    if (isTechnicaContentDisabled("unit", unitId)) {
        return null;
    }
    return importedUnits.get(unitId) || null;
}
function getImportedUnitTemplate(unitId) {
    return getImportedUnit(unitId);
}
function getAllImportedUnits() {
    return Array.from(importedUnits.values()).filter((entry) => !isTechnicaContentDisabled("unit", entry.id));
}
function getAllImportedUnitTemplates() {
    return getAllImportedUnits();
}
function getImportedRosterUnits() {
    return getAllImportedUnits().filter((entry) => getImportedUnitSpawnRole(entry) !== "enemy" && entry.startingInRoster !== false);
}
function getImportedEncounterUnitsForFloorOrdinal(floorOrdinal) {
    return getAllImportedUnits().filter((entry) => {
        if (getImportedUnitSpawnRole(entry) !== "enemy") {
            return false;
        }
        return (entry.enemySpawnFloorOrdinals ?? []).includes(floorOrdinal);
    });
}
function registerImportedOperation(operation) {
    importedOperations.set(operation.id, operation);
    recordTechnicaRegistrySnapshot("operation", operation.id, operation);
}
function getImportedOperation(operationId) {
    return importedOperations.get(operationId) || null;
}
function getAllImportedOperations() {
    return Array.from(importedOperations.values());
}
function registerImportedCodexEntry(entry) {
    importedCodexEntries.set(entry.id, entry);
    recordTechnicaRegistrySnapshot("codex", entry.id, entry);
}
function getImportedCodexEntry(entryId) {
    return importedCodexEntries.get(entryId) || null;
}
function getAllImportedCodexEntries() {
    return Array.from(importedCodexEntries.values());
}
function getTechnicaRegistry(contentType) {
    switch (contentType) {
        case "map":
            return importedMaps;
        case "quest":
            return importedQuests;
        case "dialogue":
            return importedDialogues;
        case "mail":
            return importedMailEntries;
        case "chatter":
            return importedChatterEntries;
        case "key_item":
            return importedKeyItems;
        case "faction":
            return importedFactions;
        case "chassis":
            return importedChassis;
        case "doctrine":
            return importedDoctrines;
        case "field_enemy":
            return importedFieldEnemies;
        case "npc":
            return importedNpcs;
        case "item":
            return importedItems;
        case "gear":
            return importedGear;
        case "card":
            return importedCards;
        case "fieldmod":
            return importedFieldMods;
        case "unit":
            return importedUnits;
        case "operation":
            return importedOperations;
        case "class":
            return importedClasses;
        case "codex":
            return importedCodexEntries;
    }
}
function hasTechnicaRegistryEntry(contentType, contentId) {
    const normalizedContentId = contentId.trim();
    if (!normalizedContentId) {
        return false;
    }
    return getTechnicaRegistry(contentType).has(normalizedContentId);
}
function isTechnicaContentDisabled(contentType, contentId) {
    return disabledContentIds.get(contentType)?.has(contentId) ?? false;
}
function getTechnicaRegistryFingerprint() {
    if (!technicaRegistryFingerprintCache) {
        technicaRegistryFingerprintCache = Array.from(technicaRegistrySnapshots.entries())
            .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
            .map(([key, snapshot]) => `${key}:${snapshot}`)
            .join("|");
    }
    return technicaRegistryFingerprintCache;
}
async function hydrateGeneratedTechnicaRegistry() {
    if (generatedRegistryHydrated) {
        return;
    }
    if (generatedRegistryHydrationPromise) {
        return generatedRegistryHydrationPromise;
    }
    generatedRegistryHydrationPromise = (async () => {
        const registry = await fetchGeneratedRuntimeRegistry();
        if (!registry?.entriesByType) {
            generatedRegistryHydrated = true;
            return;
        }
        const { importTechnicaRuntimeEntry } = await Promise.resolve().then(() => require("./importer"));
        let importedAnyEntries = false;
        for (const contentType of HYDRATABLE_GENERATED_CONTENT_TYPES) {
            const contentIds = normalizeGeneratedRegistryIds(registry.entriesByType[contentType]);
            for (const contentId of contentIds) {
                const entry = await fetchGeneratedRuntimeEntry(contentType, contentId);
                if (!entry) {
                    continue;
                }
                try {
                    importTechnicaRuntimeEntry(contentType, entry, { syncToGameState: false });
                    importedAnyEntries = true;
                }
                catch (error) {
                    console.warn(`[TECHNICA] Skipping generated ${contentType} '${contentId}' during startup hydration.`, error);
                }
            }
        }
        if (importedAnyEntries) {
            const [{ hasGameState, updateGameState }, { syncPublishedTechnicaContentState }] = await Promise.all([
                Promise.resolve().then(() => require("../../state/gameStore")),
                Promise.resolve().then(() => require("./stateSync")),
            ]);
            if (hasGameState()) {
                const registryFingerprint = getTechnicaRegistryFingerprint();
                updateGameState((prev) => syncPublishedTechnicaContentState(prev, registryFingerprint));
            }
        }
        generatedRegistryHydrated = true;
    })().finally(() => {
        generatedRegistryHydrationPromise = null;
    });
    return generatedRegistryHydrationPromise;
}
async function reloadGeneratedTechnicaEntry(contentType, contentId) {
    const entry = await fetchGeneratedRuntimeEntry(contentType, contentId);
    if (!entry) {
        return false;
    }
    const { importTechnicaRuntimeEntry } = await Promise.resolve().then(() => require("./importer"));
    try {
        importTechnicaRuntimeEntry(contentType, entry, { syncToGameState: true });
        return true;
    }
    catch (error) {
        console.warn(`[TECHNICA] Failed to reload generated ${contentType} '${contentId}'.`, error);
        return false;
    }
}

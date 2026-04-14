import { invoke } from "@tauri-apps/api/core";
import { upsertLibraryCard } from "../../core/gearWorkbench";
import { DEFAULT_FACTIONS } from "./defaultFactions";
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
    return anyWindow.__TAURI__ || anyWindow.__TAURI_INTERNALS__ ? invoke : null;
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
export async function readGeneratedTechnicaVersionMarker() {
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
    DEFAULT_FACTIONS.forEach((entry) => {
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
export function registerImportedFieldMap(map) {
    importedMaps.set(map.id, map);
    recordTechnicaRegistrySnapshot("map", map.id, map);
}
export function getImportedFieldMap(mapId) {
    return importedMaps.get(mapId) || null;
}
export function getImportedFieldMapIds() {
    return Array.from(importedMaps.keys());
}
export function getAllImportedFieldMaps() {
    return Array.from(importedMaps.values());
}
export function registerImportedQuest(quest) {
    importedQuests.set(quest.id, quest);
    recordTechnicaRegistrySnapshot("quest", quest.id, quest);
}
export function getImportedQuest(questId) {
    return importedQuests.get(questId) || null;
}
export function getAllImportedQuests() {
    return Array.from(importedQuests.values());
}
export function registerImportedFieldEnemyDefinition(definition) {
    importedFieldEnemies.set(definition.id, definition);
    recordTechnicaRegistrySnapshot("field_enemy", definition.id, definition);
}
export function getImportedFieldEnemyDefinition(definitionId) {
    return importedFieldEnemies.get(definitionId) || null;
}
export function getAllImportedFieldEnemyDefinitions() {
    return Array.from(importedFieldEnemies.values());
}
export function registerImportedDialogue(dialogue) {
    importedDialogues.set(dialogue.id, dialogue);
    recordTechnicaRegistrySnapshot("dialogue", dialogue.id, dialogue);
}
export function getImportedDialogue(dialogueId) {
    return importedDialogues.get(dialogueId) || null;
}
export function getAllImportedDialogues() {
    return Array.from(importedDialogues.values());
}
export function hasImportedDialogue(dialogueId) {
    return importedDialogues.has(dialogueId);
}
export function registerImportedMailEntry(entry) {
    importedMailEntries.set(entry.id, entry);
    recordTechnicaRegistrySnapshot("mail", entry.id, entry);
}
export function getImportedMailEntry(entryId) {
    return importedMailEntries.get(entryId) || null;
}
export function getAllImportedMailEntries() {
    return Array.from(importedMailEntries.values());
}
export function registerImportedChatterEntry(entry) {
    importedChatterEntries.set(entry.id, entry);
    recordTechnicaRegistrySnapshot("chatter", entry.id, entry);
}
export function getImportedChatterEntry(entryId) {
    return importedChatterEntries.get(entryId) || null;
}
export function getAllImportedChatterEntries() {
    return Array.from(importedChatterEntries.values());
}
export function registerImportedKeyItem(item) {
    importedKeyItems.set(item.id, item);
    recordTechnicaRegistrySnapshot("key_item", item.id, item);
}
export function getImportedKeyItem(itemId) {
    return importedKeyItems.get(itemId) || null;
}
export function getAllImportedKeyItems() {
    return Array.from(importedKeyItems.values());
}
export function registerImportedFaction(faction) {
    importedFactions.set(faction.id, faction);
    recordTechnicaRegistrySnapshot("faction", faction.id, faction);
}
export function getImportedFaction(factionId) {
    return importedFactions.get(factionId) || null;
}
export function getAllImportedFactions() {
    return Array.from(importedFactions.values());
}
export function registerImportedChassis(chassis) {
    importedChassis.set(chassis.id, chassis);
    recordTechnicaRegistrySnapshot("chassis", chassis.id, chassis);
}
export function getImportedChassis(chassisId) {
    return importedChassis.get(chassisId) || null;
}
export function getAllImportedChassis() {
    return Array.from(importedChassis.values()).filter((entry) => !isTechnicaContentDisabled("chassis", entry.id));
}
export function registerImportedDoctrine(doctrine) {
    importedDoctrines.set(doctrine.id, doctrine);
    recordTechnicaRegistrySnapshot("doctrine", doctrine.id, doctrine);
}
export function getImportedDoctrine(doctrineId) {
    return importedDoctrines.get(doctrineId) || null;
}
export function getAllImportedDoctrines() {
    return Array.from(importedDoctrines.values()).filter((entry) => !isTechnicaContentDisabled("doctrine", entry.id));
}
export function registerImportedItem(item) {
    importedItems.set(item.id, item);
    recordTechnicaRegistrySnapshot("item", item.id, item);
}
export function getImportedItem(itemId) {
    return importedItems.get(itemId) || null;
}
export function getAllImportedItems() {
    return Array.from(importedItems.values());
}
export function getImportedStarterItems() {
    return getAllImportedItems().filter((entry) => entry.acquisition?.startsWithPlayer !== false);
}
export function registerImportedNpc(npc) {
    importedNpcs.set(npc.id, npc);
    recordTechnicaRegistrySnapshot("npc", npc.id, npc);
}
export function getImportedNpc(npcId) {
    return importedNpcs.get(npcId) || null;
}
export function getAllImportedNpcs() {
    return Array.from(importedNpcs.values());
}
export function registerImportedGear(gear) {
    importedGear.set(gear.id, gear);
    recordTechnicaRegistrySnapshot("gear", gear.id, gear);
}
export function getImportedGear(gearId) {
    return importedGear.get(gearId) || null;
}
export function getAllImportedGear() {
    return Array.from(importedGear.values());
}
export function getImportedStarterGear() {
    return getAllImportedGear().filter((entry) => entry.inventory?.startingOwned !== false);
}
export function registerImportedCard(card) {
    importedCards.set(card.id, card);
    recordTechnicaRegistrySnapshot("card", card.id, card);
    upsertLibraryCard({
        id: card.id,
        name: card.name,
        rarity: card.rarity ?? "common",
        category: card.category ?? "utility",
        description: card.description,
        strainCost: card.strainCost,
        artPath: card.artPath,
    });
}
export function registerImportedFieldMod(fieldMod) {
    importedFieldMods.set(fieldMod.id, fieldMod);
    recordTechnicaRegistrySnapshot("fieldmod", fieldMod.id, fieldMod);
}
export function getImportedFieldMod(fieldModId) {
    return importedFieldMods.get(fieldModId) || null;
}
export function getAllImportedFieldMods() {
    return Array.from(importedFieldMods.values());
}
export function registerImportedBattleCard(card) {
    registerImportedCard(card);
}
export function getImportedCard(cardId) {
    return importedCards.get(cardId) || null;
}
export function getImportedBattleCard(cardId) {
    return getImportedCard(cardId);
}
export function getAllImportedCards() {
    return Array.from(importedCards.values());
}
export function getAllImportedBattleCards() {
    return getAllImportedCards();
}
export function getImportedStarterBattleCards() {
    return getAllImportedCards();
}
export function registerImportedClass(classDefinition) {
    importedClasses.set(classDefinition.id, classDefinition);
    recordTechnicaRegistrySnapshot("class", classDefinition.id, classDefinition);
}
export function registerImportedClassDefinition(classDefinition) {
    registerImportedClass(classDefinition);
}
export function getImportedClass(classId) {
    return importedClasses.get(classId) || null;
}
export function getImportedClassDefinition(classId) {
    return getImportedClass(classId);
}
export function getAllImportedClasses() {
    return Array.from(importedClasses.values());
}
export function getAllImportedClassDefinitions() {
    return getAllImportedClasses();
}
export function registerImportedUnit(unit) {
    importedUnits.set(unit.id, unit);
    recordTechnicaRegistrySnapshot("unit", unit.id, unit);
}
export function registerImportedUnitTemplate(unit) {
    registerImportedUnit(unit);
}
export function getImportedUnit(unitId) {
    if (isTechnicaContentDisabled("unit", unitId)) {
        return null;
    }
    return importedUnits.get(unitId) || null;
}
export function getImportedUnitTemplate(unitId) {
    return getImportedUnit(unitId);
}
export function getAllImportedUnits() {
    return Array.from(importedUnits.values()).filter((entry) => !isTechnicaContentDisabled("unit", entry.id));
}
export function getAllImportedUnitTemplates() {
    return getAllImportedUnits();
}
export function getImportedRosterUnits() {
    return getAllImportedUnits().filter((entry) => getImportedUnitSpawnRole(entry) !== "enemy" && entry.startingInRoster !== false);
}
export function getImportedEncounterUnitsForFloorOrdinal(floorOrdinal) {
    return getAllImportedUnits().filter((entry) => {
        if (getImportedUnitSpawnRole(entry) !== "enemy") {
            return false;
        }
        return (entry.enemySpawnFloorOrdinals ?? []).includes(floorOrdinal);
    });
}
export function registerImportedOperation(operation) {
    importedOperations.set(operation.id, operation);
    recordTechnicaRegistrySnapshot("operation", operation.id, operation);
}
export function getImportedOperation(operationId) {
    return importedOperations.get(operationId) || null;
}
export function getAllImportedOperations() {
    return Array.from(importedOperations.values());
}
export function registerImportedCodexEntry(entry) {
    importedCodexEntries.set(entry.id, entry);
    recordTechnicaRegistrySnapshot("codex", entry.id, entry);
}
export function getImportedCodexEntry(entryId) {
    return importedCodexEntries.get(entryId) || null;
}
export function getAllImportedCodexEntries() {
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
export function hasTechnicaRegistryEntry(contentType, contentId) {
    const normalizedContentId = contentId.trim();
    if (!normalizedContentId) {
        return false;
    }
    return getTechnicaRegistry(contentType).has(normalizedContentId);
}
export function isTechnicaContentDisabled(contentType, contentId) {
    return disabledContentIds.get(contentType)?.has(contentId) ?? false;
}
export function getTechnicaRegistryFingerprint() {
    if (!technicaRegistryFingerprintCache) {
        technicaRegistryFingerprintCache = Array.from(technicaRegistrySnapshots.entries())
            .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
            .map(([key, snapshot]) => `${key}:${snapshot}`)
            .join("|");
    }
    return technicaRegistryFingerprintCache;
}
export async function hydrateGeneratedTechnicaRegistry() {
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
        const { importTechnicaRuntimeEntry } = await import("./importer");
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
                import("../../state/gameStore"),
                import("./stateSync"),
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
export async function reloadGeneratedTechnicaEntry(contentType, contentId) {
    const entry = await fetchGeneratedRuntimeEntry(contentType, contentId);
    if (!entry) {
        return false;
    }
    const { importTechnicaRuntimeEntry } = await import("./importer");
    try {
        importTechnicaRuntimeEntry(contentType, entry, { syncToGameState: true });
        return true;
    }
    catch (error) {
        console.warn(`[TECHNICA] Failed to reload generated ${contentType} '${contentId}'.`, error);
        return false;
    }
}

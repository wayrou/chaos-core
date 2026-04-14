import { hasGameState, updateGameState } from "../../state/gameStore";
import { getTechnicaRegistryFingerprint, registerImportedCard, registerImportedChassis, registerImportedChatterEntry, registerImportedClass, registerImportedCodexEntry, registerImportedDoctrine, registerImportedDialogue, registerImportedFieldEnemyDefinition, registerImportedFieldMod, registerImportedFaction, registerImportedFieldMap, registerImportedGear, registerImportedItem, registerImportedKeyItem, registerImportedMailEntry, registerImportedNpc, registerImportedOperation, registerImportedQuest, registerImportedUnit, } from "./index";
import { syncImportedCodexUnlocks } from "../../core/codexSystem";
import { syncImportedMailUnlocks } from "../../core/mailSystem";
import { syncPublishedTechnicaContentState } from "./stateSync";
function isFieldMap(value) {
    return Boolean(value &&
        typeof value === "object" &&
        "id" in value &&
        "tiles" in value &&
        "interactionZones" in value &&
        "objects" in value);
}
function isQuest(value) {
    return Boolean(value &&
        typeof value === "object" &&
        "id" in value &&
        "questType" in value &&
        "objectives" in value &&
        "rewards" in value);
}
function isDialogue(value) {
    return Boolean(value && typeof value === "object" && "id" in value && "entryNodeId" in value && "nodes" in value);
}
function isMailEntry(value) {
    return Boolean(value &&
        typeof value === "object" &&
        "id" in value &&
        "from" in value &&
        "subject" in value &&
        "bodyPages" in value);
}
function isChatterEntry(value) {
    return Boolean(value &&
        typeof value === "object" &&
        "id" in value &&
        "location" in value &&
        "content" in value &&
        "aerissResponse" in value);
}
function isFieldEnemyDefinition(value) {
    return Boolean(value &&
        typeof value === "object" &&
        "id" in value &&
        "name" in value &&
        "stats" in value &&
        "spawn" in value);
}
function isItem(value) {
    return Boolean(value && typeof value === "object" && "id" in value && "kind" in value && "quantity" in value);
}
function isKeyItem(value) {
    return Boolean(value &&
        typeof value === "object" &&
        "id" in value &&
        "kind" in value &&
        "quantity" in value &&
        value.kind === "key_item");
}
function isFaction(value) {
    return Boolean(value && typeof value === "object" && "id" in value && "name" in value);
}
function isChassis(value) {
    return Boolean(value &&
        typeof value === "object" &&
        "id" in value &&
        "name" in value &&
        "slotType" in value &&
        "maxCardSlots" in value);
}
function isDoctrine(value) {
    return Boolean(value &&
        typeof value === "object" &&
        "id" in value &&
        "name" in value &&
        "intentTags" in value &&
        "buildCostModifier" in value);
}
function isNpcTemplate(value) {
    return Boolean(value && typeof value === "object" && "id" in value && "name" in value && "mapId" in value);
}
function isGear(value) {
    return Boolean(value && typeof value === "object" && "id" in value && "slot" in value && "stats" in value);
}
function isCard(value) {
    return Boolean(value &&
        typeof value === "object" &&
        "id" in value &&
        "name" in value &&
        "description" in value &&
        "type" in value &&
        "targetType" in value &&
        "strainCost" in value &&
        "range" in value &&
        (("effects" in value && Array.isArray(value.effects)) || "effectFlow" in value));
}
function normalizeImportedCard(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    if (!isCard(value)) {
        return null;
    }
    const card = value;
    return {
        ...card,
        effects: Array.isArray(card.effects) ? [...card.effects] : [],
    };
}
function isFieldMod(value) {
    return Boolean(value &&
        typeof value === "object" &&
        "id" in value &&
        "name" in value &&
        "trigger" in value &&
        ("effectFlow" in value || "effects" in value));
}
function isClassDefinition(value) {
    return Boolean(value &&
        typeof value === "object" &&
        "id" in value &&
        "tier" in value &&
        "baseStats" in value &&
        "weaponTypes" in value &&
        "unlockConditions" in value);
}
function isUnitTemplate(value) {
    return Boolean(value &&
        typeof value === "object" &&
        "id" in value &&
        "currentClassId" in value &&
        "stats" in value &&
        "loadout" in value);
}
function isOperationDefinition(value) {
    return Boolean(value && typeof value === "object" && "id" in value && "codename" in value && "floors" in value);
}
function isCodexEntry(value) {
    return Boolean(value &&
        typeof value === "object" &&
        "id" in value &&
        "title" in value &&
        "entryType" in value &&
        "content" in value);
}
function resolveAssetPath(path, options) {
    if (!path) {
        return undefined;
    }
    return options?.resolveAssetPath ? options.resolveAssetPath(path) : path;
}
function withResolvedItemAssets(item, options) {
    return { ...item, iconPath: resolveAssetPath(item.iconPath, options) };
}
function withResolvedKeyItemAssets(item, options) {
    return { ...item, iconPath: resolveAssetPath(item.iconPath, options) };
}
function withResolvedGearAssets(gear, options) {
    return { ...gear, iconPath: resolveAssetPath(gear.iconPath, options) };
}
function withResolvedCardAssets(card, options) {
    return { ...card, artPath: resolveAssetPath(card.artPath, options) };
}
function withResolvedNpcAssets(npc, options) {
    return {
        ...npc,
        portraitPath: resolveAssetPath(npc.portraitPath, options),
        spritePath: resolveAssetPath(npc.spritePath, options),
    };
}
function withResolvedFieldEnemyAssets(definition, options) {
    return {
        ...definition,
        spritePath: resolveAssetPath(definition.spritePath, options),
    };
}
export function validateTechnicaManifest(manifest) {
    if (manifest.sourceApp !== "Technica") {
        throw new Error("Unsupported source app in import manifest.");
    }
    if (manifest.targetGame !== "chaos-core") {
        throw new Error(`Unsupported target game '${manifest.targetGame}'.`);
    }
    if (!manifest.entryFile) {
        throw new Error("Import manifest is missing an entry file.");
    }
}
function syncPublishedTechnicaGameState() {
    if (!hasGameState()) {
        return;
    }
    updateGameState((prev) => syncPublishedTechnicaContentState(prev, getTechnicaRegistryFingerprint()));
}
export function importTechnicaRuntimeEntry(contentType, entryData, options) {
    switch (contentType) {
        case "map":
            if (!isFieldMap(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core field map shape.");
            }
            registerImportedFieldMap(entryData);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return entryData.id;
        case "quest":
            if (!isQuest(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core quest shape.");
            }
            registerImportedQuest(entryData);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return entryData.id;
        case "key_item": {
            if (!isKeyItem(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core key item shape.");
            }
            const resolvedItem = withResolvedKeyItemAssets(entryData, options);
            registerImportedKeyItem(resolvedItem);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return resolvedItem.id;
        }
        case "faction":
            if (!isFaction(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core faction shape.");
            }
            registerImportedFaction(entryData);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return entryData.id;
        case "chassis":
            if (!isChassis(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core chassis shape.");
            }
            registerImportedChassis(entryData);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return entryData.id;
        case "doctrine":
            if (!isDoctrine(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core doctrine shape.");
            }
            registerImportedDoctrine(entryData);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return entryData.id;
        case "dialogue":
            if (!isDialogue(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core dialogue shape.");
            }
            registerImportedDialogue(entryData);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return entryData.id;
        case "mail":
            if (!isMailEntry(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core mail shape.");
            }
            registerImportedMailEntry(entryData);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
                syncImportedMailUnlocks();
            }
            return entryData.id;
        case "chatter":
            if (!isChatterEntry(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core chatter shape.");
            }
            registerImportedChatterEntry(entryData);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return entryData.id;
        case "field_enemy": {
            if (!isFieldEnemyDefinition(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core field enemy shape.");
            }
            const resolvedDefinition = withResolvedFieldEnemyAssets(entryData, options);
            registerImportedFieldEnemyDefinition(resolvedDefinition);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return resolvedDefinition.id;
        }
        case "item": {
            if (!isItem(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core inventory item shape.");
            }
            const resolvedItem = withResolvedItemAssets(entryData, options);
            registerImportedItem(resolvedItem);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return resolvedItem.id;
        }
        case "npc": {
            if (!isNpcTemplate(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core NPC shape.");
            }
            const resolvedNpc = withResolvedNpcAssets(entryData, options);
            registerImportedNpc(resolvedNpc);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return resolvedNpc.id;
        }
        case "gear": {
            if (!isGear(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core gear shape.");
            }
            const resolvedGear = withResolvedGearAssets(entryData, options);
            registerImportedGear(resolvedGear);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return resolvedGear.id;
        }
        case "card": {
            const normalizedCard = normalizeImportedCard(entryData);
            if (!normalizedCard) {
                throw new Error("Entry data does not match the expected Chaos Core card shape.");
            }
            const resolvedCard = withResolvedCardAssets(normalizedCard, options);
            registerImportedCard(resolvedCard);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return resolvedCard.id;
        }
        case "fieldmod":
            if (!isFieldMod(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core field mod shape.");
            }
            registerImportedFieldMod(entryData);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return entryData.id;
        case "class":
            if (!isClassDefinition(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core class definition shape.");
            }
            registerImportedClass(entryData);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return entryData.id;
        case "unit":
            if (!isUnitTemplate(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core unit template shape.");
            }
            registerImportedUnit(entryData);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return entryData.id;
        case "operation":
            if (!isOperationDefinition(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core operation shape.");
            }
            registerImportedOperation(entryData);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
            }
            return entryData.id;
        case "codex":
            if (!isCodexEntry(entryData)) {
                throw new Error("Entry data does not match the expected Chaos Core codex entry shape.");
            }
            registerImportedCodexEntry(entryData);
            if (options?.syncToGameState) {
                syncPublishedTechnicaGameState();
                syncImportedCodexUnlocks();
            }
            return entryData.id;
        default:
            throw new Error(`Unsupported Technica content type '${contentType}'.`);
    }
}
export function importTechnicaEntry(manifest, entryData, options) {
    validateTechnicaManifest(manifest);
    return importTechnicaRuntimeEntry(manifest.contentType, entryData, options);
}

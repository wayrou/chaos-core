"use strict";
// ============================================================================
// CHAOS CORE - UNLOCKABLE REGISTRY
// Unified system for tracking unlockable chassis, doctrines, and field mods
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnlockableById = getUnlockableById;
exports.getUnlockablesByType = getUnlockablesByType;
exports.getShopEligibleUnlockables = getShopEligibleUnlockables;
exports.getRewardEligibleUnlockables = getRewardEligibleUnlockables;
exports.filterUnlockablesByRarity = filterUnlockablesByRarity;
exports.getUnownedUnlockables = getUnownedUnlockables;
const gearCatalog_1 = require("./gearCatalog");
const fieldModDefinitions_1 = require("./fieldModDefinitions");
const decorSystem_1 = require("./decorSystem");
const campaign_1 = require("./campaign");
// ----------------------------------------------------------------------------
// UNLOCKABLE REGISTRY
// ----------------------------------------------------------------------------
/**
 * Build the unified unlockable registry from chassis, doctrines, and field mods
 */
function buildUnlockableRegistry() {
    const registry = {};
    // Add all chassis
    for (const chassis of (0, gearCatalog_1.getAllChassis)()) {
        registry[chassis.id] = {
            id: chassis.id,
            type: "chassis",
            displayName: chassis.name,
            description: chassis.description,
            rarity: determineChassisRarity(chassis),
            tags: [chassis.slotType],
            cost: chassis.buildCost,
            unlockAfterFloor: Number(chassis.unlockAfterFloor ?? 0),
            requiredQuestIds: chassis.requiredQuestIds ?? [],
            sourceRules: {
                shopEligible: true,
                rewardEligible: true,
            },
        };
    }
    // Add all doctrines
    for (const doctrine of (0, gearCatalog_1.getAllDoctrines)()) {
        registry[doctrine.id] = {
            id: doctrine.id,
            type: "doctrine",
            displayName: doctrine.name,
            description: doctrine.description,
            rarity: determineDoctrineRarity(doctrine),
            tags: doctrine.intentTags,
            cost: doctrine.buildCostModifier,
            unlockAfterFloor: Number(doctrine.unlockAfterFloor ?? 0),
            requiredQuestIds: doctrine.requiredQuestIds ?? [],
            sourceRules: {
                shopEligible: true,
                rewardEligible: true,
            },
        };
    }
    // Add all field mods
    const allFieldMods = (0, fieldModDefinitions_1.getAllFieldModDefs)();
    for (const mod of allFieldMods) {
        registry[mod.id] = {
            id: mod.id,
            type: "field_mod",
            displayName: mod.name,
            description: mod.description,
            rarity: mod.rarity,
            tags: mod.tags,
            cost: mod.cost ? { wad: mod.cost } : undefined,
            sourceRules: {
                shopEligible: true,
                rewardEligible: true,
            },
        };
    }
    // Add all decor unlocks
    for (const decor of (0, decorSystem_1.getAllDecorItems)()) {
        registry[decor.id] = {
            id: decor.id,
            type: "decor",
            displayName: decor.name,
            description: decor.description,
            rarity: decor.rarityTag ?? "common",
            tags: [`decor:${decor.tileWidth}x${decor.tileHeight}`],
            cost: decor.shopCostWad ? { wad: decor.shopCostWad } : undefined,
            sourceRules: {
                shopEligible: decor.sourceRules?.shopEligible !== false,
                rewardEligible: decor.sourceRules?.rewardEligible !== false,
            },
        };
    }
    return registry;
}
/**
 * Determine rarity for a chassis based on its stats
 */
function determineChassisRarity(chassis) {
    // Simple heuristic: more slots + higher cost = rarer
    const totalCost = Object.values(chassis.buildCost).reduce((sum, amount) => sum + Number(amount ?? 0), 0);
    if (totalCost >= 40 || chassis.maxCardSlots >= 5)
        return "rare";
    if (totalCost >= 25 || chassis.maxCardSlots >= 4)
        return "uncommon";
    return "common";
}
/**
 * Determine rarity for a doctrine based on its modifiers
 */
function determineDoctrineRarity(doctrine) {
    const totalCost = Object.values(doctrine.buildCostModifier).reduce((sum, amount) => sum + Number(amount ?? 0), 0);
    if (totalCost >= 8)
        return "rare";
    if (totalCost >= 4)
        return "uncommon";
    return "common";
}
function getUnlockableRegistry() {
    return buildUnlockableRegistry();
}
function meetsUnlockRequirements(unlockable, state) {
    const floorGate = Number(unlockable.unlockAfterFloor ?? 0);
    if (floorGate > 0) {
        const highestReachedFloorOrdinal = (0, campaign_1.getHighestReachedFloorOrdinal)((0, campaign_1.loadCampaignProgress)());
        if (highestReachedFloorOrdinal < floorGate) {
            return false;
        }
    }
    const requiredQuestIds = unlockable.requiredQuestIds ?? [];
    if (requiredQuestIds.length > 0) {
        const completedQuestIds = new Set(state?.quests?.completedQuests ?? []);
        if (requiredQuestIds.some((questId) => !completedQuestIds.has(questId))) {
            return false;
        }
    }
    return true;
}
// ----------------------------------------------------------------------------
// UTILITIES
// ----------------------------------------------------------------------------
/**
 * Get unlockable definition by ID
 */
function getUnlockableById(id) {
    return getUnlockableRegistry()[id];
}
/**
 * Get all unlockables of a specific type
 */
function getUnlockablesByType(type) {
    return Object.values(getUnlockableRegistry()).filter(u => u.type === type);
}
/**
 * Get all unlockables eligible for shops
 */
function getShopEligibleUnlockables(state) {
    return Object.values(getUnlockableRegistry()).filter((u) => u.sourceRules?.shopEligible !== false && meetsUnlockRequirements(u, state));
}
/**
 * Get all unlockables eligible for rewards
 */
function getRewardEligibleUnlockables() {
    return Object.values(getUnlockableRegistry()).filter(u => u.sourceRules?.rewardEligible !== false);
}
/**
 * Filter unlockables by rarity
 */
function filterUnlockablesByRarity(unlockables, rarities) {
    return unlockables.filter(u => rarities.includes(u.rarity));
}
/**
 * Get unlockables not owned by player
 */
function getUnownedUnlockables(ownedIds, type, state) {
    const ownedSet = new Set(ownedIds);
    const candidates = type
        ? getUnlockablesByType(type)
        : Object.values(getUnlockableRegistry());
    return candidates.filter(u => !ownedSet.has(u.id) && meetsUnlockRequirements(u, state));
}

// ============================================================================
// CHAOS CORE - ENEMY DEFINITIONS
// Data-driven enemy unit archetypes for encounter generation
// ============================================================================
import { getActiveRegionPresentation, } from "./campaignRegions";
const REGION_ENEMY_FACTIONS = {
    industrial: ["rivet", "scrap", "black_banner", "chaos_predators"],
    overgrowth: ["maw", "scrap", "lantern_guild", "chaos_predators"],
    flooded: ["anchor", "silt", "lantern_guild", "chaos_predators"],
    chaos: ["null", "reliquary", "black_banner", "chaos_predators"],
};
const FACTION_REGION_MAP = {
    maw: ["overgrowth"],
    rivet: ["industrial"],
    anchor: ["flooded"],
    null: ["chaos"],
    scrap: ["industrial", "overgrowth"],
    black_banner: ["industrial", "chaos"],
    chaos_predators: ["industrial", "overgrowth", "flooded", "chaos"],
    reliquary: ["chaos"],
    silt: ["flooded"],
    lantern_guild: ["overgrowth", "flooded"],
};
const PLACEHOLDER_ENEMY_ROSTERS = {
    maw: [
        { name: "Rootmaw Stalker", role: "melee", rarity: "common" },
        { name: "Sporecaster", role: "support", rarity: "uncommon" },
        { name: "Bramble Hulk", role: "tank", rarity: "rare" },
        { name: "Bloom Vessel", role: "artillery", rarity: "uncommon" },
        { name: "Vine Skitter", role: "scout", rarity: "common" },
        { name: "Spore Mite", role: "scout", rarity: "common" },
    ],
    rivet: [
        { name: "Rivet Trooper", role: "melee", rarity: "common" },
        { name: "Weld Priest", role: "support", rarity: "uncommon" },
        { name: "Boiler Brute", role: "tank", rarity: "rare" },
        { name: "Railgunner", role: "ranged", rarity: "uncommon" },
        { name: "Sparkskitter", role: "scout", rarity: "common" },
        { name: "Steam Leaper", role: "scout", rarity: "common" },
    ],
    anchor: [
        { name: "Anchor Lancer", role: "melee", rarity: "common" },
        { name: "Bilge Caster", role: "support", rarity: "uncommon" },
        { name: "Dredge Brute", role: "tank", rarity: "rare" },
        { name: "Lamp Diver", role: "ranged", rarity: "uncommon" },
        { name: "Eel Hound", role: "scout", rarity: "common" },
        { name: "Barnacle Crawler", role: "scout", rarity: "common" },
    ],
    null: [
        { name: "Null Flicker", role: "scout", rarity: "common" },
        { name: "Rift Seeder", role: "support", rarity: "uncommon" },
        { name: "Shard Hulk", role: "tank", rarity: "rare" },
        { name: "Echo Saint", role: "support", rarity: "elite" },
        { name: "Glitchling", role: "scout", rarity: "common" },
        { name: "Void Wisp", role: "scout", rarity: "common" },
    ],
    scrap: [
        { name: "Scrap Raider", role: "melee", rarity: "common" },
        { name: "Magneteer", role: "support", rarity: "uncommon" },
        { name: "Hoard Knight", role: "tank", rarity: "rare" },
        { name: "Trapwright", role: "artillery", rarity: "uncommon" },
        { name: "Tin Rat", role: "scout", rarity: "common" },
        { name: "Clamp Gremlin", role: "scout", rarity: "common" },
    ],
    black_banner: [
        { name: "Black Banner Rifleman", role: "ranged", rarity: "common" },
        { name: "Breach Trooper", role: "melee", rarity: "common" },
        { name: "Field Officer", role: "support", rarity: "rare" },
        { name: "Combat Medic", role: "support", rarity: "uncommon" },
        { name: "Recon Runner", role: "scout", rarity: "common" },
        { name: "Banner Drone", role: "support", rarity: "common" },
    ],
    chaos_predators: [
        { name: "Fang Stalker", role: "melee", rarity: "common" },
        { name: "Boneback Mauler", role: "tank", rarity: "uncommon" },
        { name: "Shriek Bat", role: "ranged", rarity: "common" },
        { name: "Den Mother", role: "support", rarity: "rare" },
        { name: "Tunnel Skulk", role: "scout", rarity: "common" },
        { name: "Carrion Mite", role: "scout", rarity: "common" },
    ],
    reliquary: [
        { name: "Reliquary Guard", role: "melee", rarity: "common" },
        { name: "Censer Adept", role: "support", rarity: "uncommon" },
        { name: "Archive Knight", role: "tank", rarity: "rare" },
        { name: "Sealbearer", role: "support", rarity: "uncommon" },
        { name: "Chapel Drone", role: "ranged", rarity: "common" },
        { name: "Ember Acolyte", role: "ranged", rarity: "common" },
    ],
    silt: [
        { name: "Silt Lurker", role: "melee", rarity: "common" },
        { name: "Runoff Spitter", role: "ranged", rarity: "uncommon" },
        { name: "Mire Hulk", role: "tank", rarity: "rare" },
        { name: "Leech Mother", role: "support", rarity: "rare" },
        { name: "Sludge Rat", role: "scout", rarity: "common" },
        { name: "Mire Leech", role: "scout", rarity: "common" },
    ],
    lantern_guild: [
        { name: "Lantern Scout", role: "scout", rarity: "common" },
        { name: "Hookfighter", role: "melee", rarity: "common" },
        { name: "Salvage Engineer", role: "support", rarity: "uncommon" },
        { name: "Guild Captain", role: "support", rarity: "rare" },
        { name: "Pack Mule Drone", role: "tank", rarity: "uncommon" },
        { name: "Flare Runner", role: "scout", rarity: "common" },
    ],
};
const ROLE_BASE_STATS = {
    melee: { hp: 18, atk: 5, def: 2, agi: 4, move: 3 },
    ranged: { hp: 15, atk: 6, def: 1, agi: 4, move: 3 },
    support: { hp: 16, atk: 4, def: 2, agi: 3, move: 3 },
    tank: { hp: 26, atk: 5, def: 4, agi: 2, move: 2 },
    artillery: { hp: 17, atk: 7, def: 1, agi: 2, move: 2 },
    scout: { hp: 13, atk: 4, def: 1, agi: 5, move: 4 },
};
const RARITY_STAT_MODIFIERS = {
    common: { hp: 0, atk: 0, def: 0, agi: 0, move: 0 },
    uncommon: { hp: 2, atk: 1, def: 1, agi: 0, move: 0 },
    rare: { hp: 5, atk: 2, def: 1, agi: 0, move: 0 },
    elite: { hp: 8, atk: 2, def: 2, agi: 1, move: 0 },
};
const RARITY_DEFAULT_WEIGHTS = {
    common: 10,
    uncommon: 7,
    rare: 4,
    elite: 2,
};
function toEnemyId(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}
function getPlaceholderDeck(role) {
    switch (role) {
        case "tank":
            return ["card_strike", "card_guard", "card_guard"];
        case "support":
            return ["card_guard", "card_strike", "card_guard"];
        case "artillery":
            return ["card_strike", "card_strike", "card_guard"];
        case "scout":
            return ["card_strike", "card_strike", "card_strike"];
        case "ranged":
            return ["card_strike", "card_strike", "card_guard"];
        case "melee":
        default:
            return ["card_strike", "card_strike", "card_guard"];
    }
}
function buildPlaceholderBaseStats(role, rarity) {
    const base = ROLE_BASE_STATS[role];
    const modifier = RARITY_STAT_MODIFIERS[rarity];
    return {
        hp: base.hp + (modifier.hp ?? 0),
        atk: base.atk + (modifier.atk ?? 0),
        def: base.def + (modifier.def ?? 0),
        agi: base.agi + (modifier.agi ?? 0),
        move: base.move + (modifier.move ?? 0),
    };
}
function getDefaultMinFloorInRegion(rarity) {
    if (rarity === "common") {
        return 1;
    }
    if (rarity === "uncommon") {
        return 2;
    }
    return 3;
}
function buildPlaceholderEnemyDefinition(factionId, spec) {
    const id = toEnemyId(spec.name);
    return {
        id,
        name: spec.name,
        role: spec.role,
        baseStats: buildPlaceholderBaseStats(spec.role, spec.rarity),
        deck: getPlaceholderDeck(spec.role),
        tags: [factionId, spec.role, spec.rarity, "placeholder_enemy"],
        rarity: spec.rarity,
        weight: spec.weight ?? RARITY_DEFAULT_WEIGHTS[spec.rarity],
        factionId,
        spawnRegions: FACTION_REGION_MAP[factionId],
        placeholder: true,
    };
}
function buildPlaceholderEnemyDatabase() {
    const database = {};
    Object.keys(PLACEHOLDER_ENEMY_ROSTERS).forEach((factionId) => {
        PLACEHOLDER_ENEMY_ROSTERS[factionId].forEach((spec) => {
            const definition = buildPlaceholderEnemyDefinition(factionId, spec);
            database[definition.id] = definition;
        });
    });
    return database;
}
const PLACEHOLDER_ENEMY_DATABASE = buildPlaceholderEnemyDatabase();
function buildRegionEnemyEntries(regionId, floorInRegion) {
    const factionIds = REGION_ENEMY_FACTIONS[regionId];
    const entries = [];
    factionIds.forEach((factionId) => {
        PLACEHOLDER_ENEMY_ROSTERS[factionId].forEach((spec) => {
            const minFloor = spec.minFloorInRegion ?? getDefaultMinFloorInRegion(spec.rarity);
            if (floorInRegion < minFloor) {
                return;
            }
            entries.push({
                enemyId: toEnemyId(spec.name),
                weight: spec.weight ?? RARITY_DEFAULT_WEIGHTS[spec.rarity],
                minFloor,
            });
        });
    });
    return entries;
}
function parseOpsAtlasFloorOrdinal(operationId) {
    const match = /^op_ops_atlas_(\d{2})_\d{2}$/i.exec(operationId);
    if (!match) {
        return null;
    }
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
}
// ----------------------------------------------------------------------------
// ENEMY DEFINITIONS
// ----------------------------------------------------------------------------
export const ENEMY_DATABASE = {
    // ==================== IRON GATE ENEMIES ====================
    gate_sentry: {
        id: "gate_sentry",
        name: "Gate Sentry",
        role: "melee",
        baseStats: { hp: 15, atk: 4, def: 2, agi: 3, move: 3 },
        tags: ["gate_sentry", "basic"],
        rarity: "common",
        weight: 10,
    },
    corrupted_scout: {
        id: "corrupted_scout",
        name: "Corrupted Scout",
        role: "scout",
        baseStats: { hp: 12, atk: 3, def: 1, agi: 5, move: 4 },
        tags: ["scout", "fast"],
        rarity: "common",
        weight: 8,
    },
    basic_infantry: {
        id: "basic_infantry",
        name: "Basic Infantry",
        role: "melee",
        baseStats: { hp: 18, atk: 5, def: 3, agi: 3, move: 3 },
        tags: ["infantry", "basic"],
        rarity: "common",
        weight: 10,
    },
    // ==================== BLACK SPIRE ENEMIES ====================
    artillery_crew: {
        id: "artillery_crew",
        name: "Artillery Crew",
        role: "artillery",
        baseStats: { hp: 20, atk: 7, def: 2, agi: 2, move: 2 },
        tags: ["artillery", "ranged"],
        rarity: "uncommon",
        weight: 6,
    },
    guard_tower: {
        id: "guard_tower",
        name: "Guard Tower",
        role: "tank",
        baseStats: { hp: 30, atk: 4, def: 5, agi: 1, move: 1 },
        tags: ["tower", "defensive"],
        rarity: "uncommon",
        weight: 4,
    },
    sniper: {
        id: "sniper",
        name: "Sniper",
        role: "ranged",
        baseStats: { hp: 14, atk: 8, def: 1, agi: 4, move: 3 },
        tags: ["ranged", "precision"],
        rarity: "uncommon",
        weight: 5,
    },
    // ==================== GHOST RUN ENEMIES ====================
    skirmisher: {
        id: "skirmisher",
        name: "Skirmisher",
        role: "scout",
        baseStats: { hp: 13, atk: 4, def: 1, agi: 6, move: 5 },
        tags: ["fast", "mobile"],
        rarity: "uncommon",
        weight: 7,
    },
    disruptor: {
        id: "disruptor",
        name: "Disruptor",
        role: "support",
        baseStats: { hp: 16, atk: 3, def: 2, agi: 4, move: 4 },
        tags: ["support", "debuff"],
        rarity: "uncommon",
        weight: 6,
    },
    raider: {
        id: "raider",
        name: "Raider",
        role: "melee",
        baseStats: { hp: 20, atk: 6, def: 2, agi: 5, move: 4 },
        tags: ["aggressive", "mobile"],
        rarity: "uncommon",
        weight: 7,
    },
    // ==================== EMBER SIEGE ENEMIES ====================
    fortification_unit: {
        id: "fortification_unit",
        name: "Fortification Unit",
        role: "tank",
        baseStats: { hp: 35, atk: 5, def: 6, agi: 2, move: 2 },
        tags: ["tank", "defensive"],
        rarity: "rare",
        weight: 4,
    },
    siege_engine: {
        id: "siege_engine",
        name: "Siege Engine",
        role: "artillery",
        baseStats: { hp: 25, atk: 9, def: 3, agi: 1, move: 1 },
        tags: ["artillery", "heavy"],
        rarity: "rare",
        weight: 3,
    },
    elite_guard: {
        id: "elite_guard",
        name: "Elite Guard",
        role: "tank",
        baseStats: { hp: 28, atk: 6, def: 5, agi: 3, move: 3 },
        tags: ["elite", "defensive"],
        rarity: "rare",
        weight: 5,
    },
    // ==================== FINAL DAWN ENEMIES ====================
    command_elite: {
        id: "command_elite",
        name: "Command Elite",
        role: "melee",
        baseStats: { hp: 32, atk: 8, def: 4, agi: 4, move: 4 },
        tags: ["elite", "command"],
        rarity: "rare",
        weight: 4,
    },
    elite_sniper: {
        id: "elite_sniper",
        name: "Elite Sniper",
        role: "ranged",
        baseStats: { hp: 18, atk: 10, def: 2, agi: 5, move: 3 },
        tags: ["elite", "ranged", "precision"],
        rarity: "rare",
        weight: 3,
    },
    battle_commander: {
        id: "battle_commander",
        name: "Battle Commander",
        role: "support",
        baseStats: { hp: 40, atk: 7, def: 5, agi: 3, move: 3 },
        tags: ["elite", "command", "support"],
        rarity: "elite",
        weight: 2,
    },
    ...PLACEHOLDER_ENEMY_DATABASE,
};
// ----------------------------------------------------------------------------
// ENEMY POOLS BY OPERATION
// ----------------------------------------------------------------------------
export const ENEMY_POOLS = {
    op_iron_gate: {
        operationId: "op_iron_gate",
        enemies: [
            { enemyId: "gate_sentry", weight: 10 },
            { enemyId: "corrupted_scout", weight: 8 },
            { enemyId: "basic_infantry", weight: 10 },
        ],
    },
    op_black_spire: {
        operationId: "op_black_spire",
        enemies: [
            { enemyId: "artillery_crew", weight: 8 },
            { enemyId: "guard_tower", weight: 5 },
            { enemyId: "sniper", weight: 7 },
            { enemyId: "basic_infantry", weight: 6 }, // Still appear
        ],
    },
    op_ghost_run: {
        operationId: "op_ghost_run",
        enemies: [
            { enemyId: "skirmisher", weight: 9 },
            { enemyId: "disruptor", weight: 7 },
            { enemyId: "raider", weight: 8 },
            { enemyId: "corrupted_scout", weight: 5 },
        ],
    },
    op_ember_siege: {
        operationId: "op_ember_siege",
        enemies: [
            { enemyId: "fortification_unit", weight: 6 },
            { enemyId: "siege_engine", weight: 4 },
            { enemyId: "elite_guard", weight: 7 },
            { enemyId: "artillery_crew", weight: 5 },
        ],
    },
    op_final_dawn: {
        operationId: "op_final_dawn",
        enemies: [
            { enemyId: "command_elite", weight: 6 },
            { enemyId: "elite_sniper", weight: 5 },
            { enemyId: "battle_commander", weight: 3 },
            { enemyId: "elite_guard", weight: 6 },
            { enemyId: "fortification_unit", weight: 4 },
        ],
    },
    op_custom: {
        operationId: "op_custom",
        enemies: [
            // Mix of all enemies, weighted by rarity
            { enemyId: "gate_sentry", weight: 5 },
            { enemyId: "basic_infantry", weight: 5 },
            { enemyId: "artillery_crew", weight: 4 },
            { enemyId: "skirmisher", weight: 4 },
            { enemyId: "elite_guard", weight: 3 },
            { enemyId: "command_elite", weight: 2 },
        ],
    },
};
export function getCampaignRegionEnemyPool(floorOrdinal) {
    const presentation = getActiveRegionPresentation(floorOrdinal);
    return {
        operationId: `campaign_region_${presentation.regionId}_${String(floorOrdinal).padStart(2, "0")}`,
        enemies: buildRegionEnemyEntries(presentation.regionId, presentation.floorInRegion),
    };
}
export function pickEnemyIdsForCampaignFloor(floorOrdinal, count, random = Math.random) {
    const pool = getCampaignRegionEnemyPool(floorOrdinal).enemies;
    if (pool.length === 0 || count <= 0) {
        return [];
    }
    const picks = [];
    const available = [...pool];
    while (picks.length < count && available.length > 0) {
        const totalWeight = available.reduce((sum, entry) => sum + Math.max(1, entry.weight), 0);
        let roll = random() * totalWeight;
        let selectedIndex = 0;
        for (let index = 0; index < available.length; index += 1) {
            roll -= Math.max(1, available[index].weight);
            if (roll <= 0) {
                selectedIndex = index;
                break;
            }
        }
        const [selected] = available.splice(selectedIndex, 1);
        if (selected) {
            picks.push(selected.enemyId);
        }
    }
    return picks;
}
/**
 * Get enemy definition by ID
 */
export function getEnemyDefinition(enemyId) {
    return ENEMY_DATABASE[enemyId] || null;
}
/**
 * Get enemy pool for an operation
 */
export function getEnemyPool(operationId) {
    const opsAtlasFloorOrdinal = parseOpsAtlasFloorOrdinal(operationId);
    if (opsAtlasFloorOrdinal !== null) {
        return getCampaignRegionEnemyPool(opsAtlasFloorOrdinal);
    }
    return ENEMY_POOLS[operationId] || ENEMY_POOLS.op_custom;
}

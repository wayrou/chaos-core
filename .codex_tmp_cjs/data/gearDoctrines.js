"use strict";
// ============================================================================
// CHAOS CORE - GEAR DOCTRINE REGISTRY
// Behavior/intent layer for gear builder system
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_DOCTRINES = void 0;
exports.getDoctrineById = getDoctrineById;
exports.getAllDoctrineIds = getAllDoctrineIds;
exports.getDoctrinesByIntent = getDoctrinesByIntent;
const resources_1 = require("../core/resources");
// ============================================================================
// DOCTRINE DEFINITIONS
// ============================================================================
exports.ALL_DOCTRINES = [
    {
        id: "doctrine_assault",
        name: "Assault Doctrine",
        shortDescription: "Aggressive forward combat focus",
        intentTags: ["assault"],
        stabilityModifier: -10,
        strainBias: 0.2,
        buildCostModifier: (0, resources_1.createEmptyResourceWallet)({
            metalScrap: 5,
            wood: 2,
            chaosShards: 0,
            steamComponents: 1,
        }),
        doctrineRules: "Assault Doctrine: Cards cost 20% more strain. Gain bonus damage on first attack each turn.",
        description: "Optimized for aggressive engagements. Higher strain costs but increased offensive output.",
    },
    {
        id: "doctrine_suppression",
        name: "Suppression Doctrine",
        shortDescription: "Area control and battlefield denial",
        intentTags: ["suppression", "control"],
        stabilityModifier: -5,
        procBias: 0.1,
        buildCostModifier: (0, resources_1.createEmptyResourceWallet)({
            metalScrap: 3,
            wood: 1,
            chaosShards: 1,
            steamComponents: 2,
        }),
        doctrineRules: "Suppression Doctrine: Area effect cards gain +10% proc chance. Reduced movement penalties.",
        description: "Designed for area control. Enhanced proc rates on suppression abilities.",
    },
    {
        id: "doctrine_skirmish",
        name: "Skirmish Doctrine",
        shortDescription: "Mobility and hit-and-run tactics",
        intentTags: ["skirmish", "mobility"],
        stabilityModifier: 5,
        strainBias: -0.1,
        buildCostModifier: (0, resources_1.createEmptyResourceWallet)({
            metalScrap: 2,
            wood: 3,
            chaosShards: 0,
            steamComponents: 1,
        }),
        doctrineRules: "Skirmish Doctrine: Movement cards cost 10% less strain. +1 move range on first move each turn.",
        description: "Emphasizes mobility and efficiency. Lower strain costs, improved movement capabilities.",
    },
    {
        id: "doctrine_sustain",
        name: "Sustain Doctrine",
        shortDescription: "Endurance and resource efficiency",
        intentTags: ["sustain"],
        stabilityModifier: 15,
        strainBias: -0.15,
        buildCostModifier: (0, resources_1.createEmptyResourceWallet)({
            metalScrap: 4,
            wood: 2,
            chaosShards: 0,
            steamComponents: 1,
        }),
        doctrineRules: "Sustain Doctrine: All cards cost 15% less strain. Gain +5 stability. Reduced wear on equipment.",
        description: "Built for long engagements. Lower strain costs and higher stability for sustained operations.",
    },
    {
        id: "doctrine_control",
        name: "Control Doctrine",
        shortDescription: "Debuffs and battlefield manipulation",
        intentTags: ["control"],
        stabilityModifier: 0,
        procBias: 0.15,
        buildCostModifier: (0, resources_1.createEmptyResourceWallet)({
            metalScrap: 3,
            wood: 1,
            chaosShards: 2,
            steamComponents: 3,
        }),
        doctrineRules: "Control Doctrine: Debuff cards gain +15% proc chance. Status effects last 1 turn longer.",
        description: "Focused on battlefield control. Enhanced effectiveness of debuff and status effects.",
    },
    {
        id: "doctrine_balanced",
        name: "Balanced Doctrine",
        shortDescription: "No specialization, reliable baseline",
        intentTags: ["assault", "sustain"],
        stabilityModifier: 5,
        buildCostModifier: (0, resources_1.createEmptyResourceWallet)({
            metalScrap: 0,
            wood: 0,
            chaosShards: 0,
            steamComponents: 0,
        }),
        doctrineRules: "Balanced Doctrine: No special bonuses or penalties. Reliable performance across all situations.",
        description: "No specialization. Solid baseline performance without tradeoffs.",
    },
];
// ============================================================================
// UTILITIES
// ============================================================================
function getDoctrineById(id) {
    return exports.ALL_DOCTRINES.find(d => d.id === id);
}
function getAllDoctrineIds() {
    return exports.ALL_DOCTRINES.map(d => d.id);
}
function getDoctrinesByIntent(intent) {
    return exports.ALL_DOCTRINES.filter(d => d.intentTags.includes(intent));
}

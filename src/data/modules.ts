import { Module, EquipmentCard } from "../core/equipment";

export const STARTER_MODULES: Module[] = [
    {
        id: "module_sharpened_edge",
        name: "Sharpened Edge",
        description: "A honed blade attachment that adds a critical strike card.",
        cardsGranted: ["card_critical_edge"],
        statBonus: { atk: 1 },
    },
    {
        id: "module_extended_barrel",
        name: "Extended Barrel",
        description: "Longer barrel for improved range and accuracy.",
        cardsGranted: ["card_long_shot"],
        statBonus: { acc: 2, agi: -1 },
    },
    {
        id: "module_heat_sink",
        name: "Heat Sink",
        description: "Improved cooling for mechanical weapons.",
        cardsGranted: ["card_emergency_vent"],
        statBonus: {},
    },
];

export const MODULE_CARDS: EquipmentCard[] = [
    {
        id: "card_critical_edge",
        name: "Critical Edge",
        type: "equipment",
        strainCost: 2,
        description: "Deal 5 damage. Crit on 18+.",
        range: "R(1)",
        damage: 5,
        sourceEquipmentId: "module_sharpened_edge",
    },
    {
        id: "card_long_shot",
        name: "Long Shot",
        type: "equipment",
        strainCost: 2,
        description: "Deal 3 damage at extended range.",
        range: "R(5-8)",
        damage: 3,
        sourceEquipmentId: "module_extended_barrel",
    },
    {
        id: "card_emergency_vent",
        name: "Emergency Vent",
        type: "equipment",
        strainCost: 2,
        description: "Remove all heat. Take 1 self-damage.",
        range: "R(Self)",
        sourceEquipmentId: "module_heat_sink",
    },
];

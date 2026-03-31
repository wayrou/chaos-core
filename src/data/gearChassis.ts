// ============================================================================
// CHAOS CORE - GEAR CHASSIS REGISTRY
// Foundation layer for gear builder system
// ============================================================================

export type ChassisSlotType = "weapon" | "helmet" | "chestpiece" | "accessory";

export interface GearChassis {
  id: string;
  name: string;
  slotType: ChassisSlotType;
  
  // Logistics footprint
  baseMassKg: number;
  baseBulkBu: number;
  basePowerW: number;
  
  // Stability
  baseStability: number; // 0-100
  
  // Card system
  maxCardSlots: number; // Number of customizable slots
  allowedCardTags?: string[]; // Optional: restrict which cards can be slotted (future use)
  allowedCardFamilies?: string[]; // Optional: restrict by card family (future use)
  
  // Description/flavor
  description: string;
  
  // Build cost (base cost, doctrine adds modifier)
  buildCost: {
    metalScrap: number;
    wood: number;
    chaosShards: number;
    steamComponents: number;
  };
}

// ============================================================================
// CHASSIS DEFINITIONS
// ============================================================================

export const ALL_CHASSIS: GearChassis[] = [
  // WEAPON CHASSIS
  {
    id: "chassis_standard_rifle",
    name: "Standard Rifle Chassis",
    slotType: "weapon",
    baseMassKg: 8,
    baseBulkBu: 12,
    basePowerW: 5,
    baseStability: 70,
    maxCardSlots: 4,
    description: "Reliable baseline weapon platform. Balanced performance and stability.",
    buildCost: {
      metalScrap: 15,
      wood: 5,
      chaosShards: 0,
      steamComponents: 2,
    },
  },
  {
    id: "chassis_heavy_cannon",
    name: "Heavy Cannon Chassis",
    slotType: "weapon",
    baseMassKg: 18,
    baseBulkBu: 25,
    basePowerW: 12,
    baseStability: 50,
    maxCardSlots: 5,
    description: "High-power weapon system. More slots, lower stability, heavy logistics footprint.",
    buildCost: {
      metalScrap: 25,
      wood: 8,
      chaosShards: 1,
      steamComponents: 5,
    },
  },
  {
    id: "chassis_precision_rifle",
    name: "Precision Rifle Chassis",
    slotType: "weapon",
    baseMassKg: 6,
    baseBulkBu: 10,
    basePowerW: 4,
    baseStability: 85,
    maxCardSlots: 3,
    description: "Lightweight, stable platform. Fewer slots but exceptional reliability.",
    buildCost: {
      metalScrap: 20,
      wood: 3,
      chaosShards: 0,
      steamComponents: 3,
    },
  },
  
  // ARMOR CHASSIS (HELMET)
  {
    id: "chassis_standard_helmet",
    name: "Standard Helmet Chassis",
    slotType: "helmet",
    baseMassKg: 3,
    baseBulkBu: 5,
    basePowerW: 2,
    baseStability: 75,
    maxCardSlots: 3,
    description: "Standard protective headgear. Balanced protection and flexibility.",
    buildCost: {
      metalScrap: 10,
      wood: 3,
      chaosShards: 0,
      steamComponents: 1,
    },
  },
  {
    id: "chassis_heavy_helmet",
    name: "Heavy Helmet Chassis",
    slotType: "helmet",
    baseMassKg: 5,
    baseBulkBu: 8,
    basePowerW: 3,
    baseStability: 60,
    maxCardSlots: 4,
    description: "Reinforced helmet with more card capacity. Heavier but more versatile.",
    buildCost: {
      metalScrap: 18,
      wood: 5,
      chaosShards: 0,
      steamComponents: 2,
    },
  },
  
  // ARMOR CHASSIS (CHESTPIECE)
  {
    id: "chassis_standard_chest",
    name: "Standard Chestplate Chassis",
    slotType: "chestpiece",
    baseMassKg: 12,
    baseBulkBu: 18,
    basePowerW: 6,
    baseStability: 70,
    maxCardSlots: 4,
    description: "Reliable torso protection. Good balance of defense and utility slots.",
    buildCost: {
      metalScrap: 20,
      wood: 6,
      chaosShards: 0,
      steamComponents: 3,
    },
  },
  {
    id: "chassis_mobile_chest",
    name: "Mobile Chestplate Chassis",
    slotType: "chestpiece",
    baseMassKg: 8,
    baseBulkBu: 12,
    basePowerW: 4,
    baseStability: 80,
    maxCardSlots: 3,
    description: "Lightweight torso armor. Higher stability, fewer slots.",
    buildCost: {
      metalScrap: 15,
      wood: 4,
      chaosShards: 0,
      steamComponents: 2,
    },
  },
  
  // ACCESSORY CHASSIS
  {
    id: "chassis_utility_module",
    name: "Utility Module Chassis",
    slotType: "accessory",
    baseMassKg: 2,
    baseBulkBu: 3,
    basePowerW: 8,
    baseStability: 75,
    maxCardSlots: 3,
    description: "Versatile accessory platform. High power draw, moderate slots.",
    buildCost: {
      metalScrap: 8,
      wood: 2,
      chaosShards: 1,
      steamComponents: 4,
    },
  },
  {
    id: "chassis_power_cell",
    name: "Power Cell Chassis",
    slotType: "accessory",
    baseMassKg: 1,
    baseBulkBu: 2,
    basePowerW: 15,
    baseStability: 65,
    maxCardSlots: 4,
    description: "High-capacity power system. Excellent power output, lower stability.",
    buildCost: {
      metalScrap: 12,
      wood: 1,
      chaosShards: 2,
      steamComponents: 6,
    },
  },
];

// ============================================================================
// UTILITIES
// ============================================================================

export function getChassisById(id: string): GearChassis | undefined {
  return ALL_CHASSIS.find(c => c.id === id);
}

export function getChassisBySlotType(slotType: ChassisSlotType): GearChassis[] {
  return ALL_CHASSIS.filter(c => c.slotType === slotType);
}

export function getAllChassisIds(): string[] {
  return ALL_CHASSIS.map(c => c.id);
}

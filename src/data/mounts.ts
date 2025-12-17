// ============================================================================
// MOUNT SYSTEM - Mount Definitions and Registry
// ============================================================================

export type MountClass = "light" | "heavy" | "support";

export type MountId = string;

/**
 * Mount definition (template)
 */
export interface MountDef {
  id: MountId;
  class: MountClass;
  name: string;
  movementBonus: number; // Movement range bonus when mounted
  cardPackageId: string; // ID of card package to inject when mounted
  gearSlots: number; // 1-2 gear slots
}

/**
 * Mount instance (owned mount with condition)
 */
export interface MountInstance {
  id: MountId; // References MountDef.id
  condition: number; // 0-100
  gear: string[]; // Mount gear item IDs (length <= gearSlots from def)
}

/**
 * Mount card package (cards injected when mounted)
 */
export interface MountCardPackage {
  id: string;
  cardIds: string[]; // Card IDs to inject into unit deck
}

// ============================================================================
// MOUNT DEFINITIONS
// ============================================================================

export const MOUNT_DEFINITIONS: Record<MountId, MountDef> = {
  // Light Mounts
  mount_light_steed: {
    id: "mount_light_steed",
    class: "light",
    name: "Light Steed",
    movementBonus: 1,
    cardPackageId: "mount_light_cards",
    gearSlots: 1,
  },
  mount_light_runner: {
    id: "mount_light_runner",
    class: "light",
    name: "Light Runner",
    movementBonus: 2,
    cardPackageId: "mount_light_cards",
    gearSlots: 1,
  },
  
  // Heavy Mounts
  mount_heavy_charger: {
    id: "mount_heavy_charger",
    class: "heavy",
    name: "Heavy Charger",
    movementBonus: 1,
    cardPackageId: "mount_heavy_cards",
    gearSlots: 2,
  },
  mount_heavy_warhorse: {
    id: "mount_heavy_warhorse",
    class: "heavy",
    name: "Warhorse",
    movementBonus: 0,
    cardPackageId: "mount_heavy_cards",
    gearSlots: 2,
  },
  
  // Support Mounts
  mount_support_pack: {
    id: "mount_support_pack",
    class: "support",
    name: "Support Pack",
    movementBonus: 1,
    cardPackageId: "mount_support_cards",
    gearSlots: 2,
  },
  mount_support_medic: {
    id: "mount_support_medic",
    class: "support",
    name: "Medic Mount",
    movementBonus: 0,
    cardPackageId: "mount_support_cards",
    gearSlots: 2,
  },
};

// ============================================================================
// MOUNT CARD PACKAGES
// ============================================================================

export const MOUNT_CARD_PACKAGES: Record<string, MountCardPackage> = {
  mount_light_cards: {
    id: "mount_light_cards",
    cardIds: [
      "mount_light_charge", // Move 2 tiles and attack
      "mount_light_retreat", // Move 2 tiles away
    ],
  },
  mount_heavy_cards: {
    id: "mount_heavy_cards",
    cardIds: [
      "mount_heavy_trample", // Deal damage to all adjacent enemies
      "mount_heavy_charge", // Move 3 tiles and deal heavy damage
    ],
  },
  mount_support_cards: {
    id: "mount_support_cards",
    cardIds: [
      "mount_support_aid", // Heal nearby ally
      "mount_support_supply", // Restore strain to nearby ally
    ],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getMountDef(mountId: MountId): MountDef | undefined {
  return MOUNT_DEFINITIONS[mountId];
}

export function getMountCardPackage(packageId: string): MountCardPackage | undefined {
  return MOUNT_CARD_PACKAGES[packageId];
}

export function getAllMountsByClass(mountClass: MountClass): MountDef[] {
  return Object.values(MOUNT_DEFINITIONS).filter(m => m.class === mountClass);
}

// ============================================================================
// MOUNT GEAR DEFINITIONS
// ============================================================================

export interface MountGearDef {
  id: string;
  name: string;
  description: string;
  conditionLossReduction: number; // Percentage reduction (0-100)
  dismountResistance: number; // Percentage reduction in forced dismount chance (0-100)
}

export const MOUNT_GEAR_DEFINITIONS: Record<string, MountGearDef> = {
  mount_gear_saddle: {
    id: "mount_gear_saddle",
    name: "Reinforced Saddle",
    description: "Reduces condition loss by 20%",
    conditionLossReduction: 20,
    dismountResistance: 0,
  },
  mount_gear_stirrups: {
    id: "mount_gear_stirrups",
    name: "Sturdy Stirrups",
    description: "Reduces forced dismount chance by 15%",
    conditionLossReduction: 0,
    dismountResistance: 15,
  },
  mount_gear_barding: {
    id: "mount_gear_barding",
    name: "Light Barding",
    description: "Reduces condition loss by 10%, reduces dismount chance by 10%",
    conditionLossReduction: 10,
    dismountResistance: 10,
  },
  mount_gear_medical_pack: {
    id: "mount_gear_medical_pack",
    name: "Medical Pack",
    description: "Reduces condition loss by 15% (Support mounts only)",
    conditionLossReduction: 15,
    dismountResistance: 0,
  },
};

export function getMountGearDef(gearId: string): MountGearDef | undefined {
  return MOUNT_GEAR_DEFINITIONS[gearId];
}


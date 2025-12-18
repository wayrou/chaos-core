// ============================================================================
// MOUNT SYSTEM - Stable & Mounted Units
// Data definitions, registry, and helper functions
// ============================================================================

import {
  Mount,
  MountId,
  MountStatModifiers,
  MountPassiveTrait,
  OwnedMount,
  StableState,
  Unit,
  UnitId,
} from "./types";
import { UnitClass } from "./equipment";

// ----------------------------------------------------------------------------
// MOUNT CARDS - Cards granted by mounts
// ----------------------------------------------------------------------------

export interface MountCard {
  id: string;
  name: string;
  description: string;
  strainCost: number;
  mountId: string;  // Source mount
}

export const MOUNT_CARDS: MountCard[] = [
  // Horse cards
  {
    id: "mount_gallop",
    name: "Gallop",
    description: "Move up to 4 additional tiles this turn.",
    strainCost: 1,
    mountId: "mount_horse",
  },
  {
    id: "mount_trample_strike",
    name: "Trample Strike",
    description: "Deal 2 damage to an enemy and push them 1 tile.",
    strainCost: 2,
    mountId: "mount_horse",
  },
  // Warhorse cards
  {
    id: "mount_cavalry_charge",
    name: "Cavalry Charge",
    description: "Move in a straight line and deal 4 damage to the first enemy hit. +2 damage if moved 3+ tiles.",
    strainCost: 3,
    mountId: "mount_warhorse",
  },
  {
    id: "mount_armored_stance",
    name: "Armored Stance",
    description: "Gain +3 DEF until your next turn. Cannot move.",
    strainCost: 2,
    mountId: "mount_warhorse",
  },
  // Lizard cards
  {
    id: "mount_scale_shield",
    name: "Scale Shield",
    description: "Reduce damage from the next attack by 3.",
    strainCost: 1,
    mountId: "mount_lizard",
  },
  {
    id: "mount_tail_sweep",
    name: "Tail Sweep",
    description: "Deal 2 damage to all adjacent enemies.",
    strainCost: 2,
    mountId: "mount_lizard",
  },
  // Mechanical mount cards
  {
    id: "mount_steam_burst",
    name: "Steam Burst",
    description: "Move 3 tiles instantly. Gain +2 heat.",
    strainCost: 1,
    mountId: "mount_steamrunner",
  },
  {
    id: "mount_piston_kick",
    name: "Piston Kick",
    description: "Deal 5 damage to adjacent enemy. Push them 2 tiles.",
    strainCost: 3,
    mountId: "mount_steamrunner",
  },
  // Beast mount cards
  {
    id: "mount_feral_leap",
    name: "Feral Leap",
    description: "Jump to a tile within 3 range. Ignores terrain.",
    strainCost: 2,
    mountId: "mount_shadowbeast",
  },
  {
    id: "mount_savage_bite",
    name: "Savage Bite",
    description: "Deal 4 damage. If target HP < 50%, deal +2 damage.",
    strainCost: 2,
    mountId: "mount_shadowbeast",
  },
];

// ----------------------------------------------------------------------------
// MOUNT REGISTRY - All available mount definitions
// ----------------------------------------------------------------------------

export const MOUNT_REGISTRY: Mount[] = [
  // STARTER MOUNTS
  {
    id: "mount_horse",
    name: "Field Horse",
    description: "A reliable horse bred for tactical operations. Provides balanced mobility bonuses.",
    mountType: "horse",
    statModifiers: {
      agi: 2,
      movement: 2,
    },
    terrainModifiers: [
      { terrain: "plains", effect: "bonus_movement", value: 1 },
    ],
    passiveTraits: [],
    grantedCards: ["mount_gallop", "mount_trample_strike"],
    restrictions: [],
    isStarterMount: true,
    unlockCost: 0,
  },
  {
    id: "mount_warhorse",
    name: "Armored Warhorse",
    description: "A heavily armored destrier. Slower but extremely durable in combat.",
    mountType: "warhorse",
    statModifiers: {
      hp: 10,
      def: 2,
      agi: -1,
      movement: 1,
    },
    terrainModifiers: [],
    passiveTraits: ["surefooted", "armored"],
    grantedCards: ["mount_cavalry_charge", "mount_armored_stance"],
    restrictions: [
      {
        type: "unit_class",
        disallowed: ["thief", "scout", "shadow", "trickster"],
      },
    ],
    unlockCost: 150,
  },
  {
    id: "mount_lizard",
    name: "Desert Lizard",
    description: "A swift reptilian mount from the Ardycian wastes. Excellent in rough terrain.",
    mountType: "lizard",
    statModifiers: {
      agi: 1,
      def: 1,
      movement: 1,
    },
    terrainModifiers: [
      { terrain: "mud", effect: "ignore_penalty" },
      { terrain: "sand", effect: "bonus_movement", value: 2 },
      { terrain: "rubble", effect: "ignore_penalty" },
    ],
    passiveTraits: ["heat_resistant"],
    grantedCards: ["mount_scale_shield", "mount_tail_sweep"],
    restrictions: [],
    unlockCost: 100,
  },
  {
    id: "mount_steamrunner",
    name: "Steamrunner MK-II",
    description: "A mechanical mount powered by pressurized steam. High performance but requires maintenance.",
    mountType: "mechanical",
    statModifiers: {
      atk: 1,
      agi: 3,
      acc: 5,
      movement: 3,
    },
    terrainModifiers: [
      { terrain: "water", effect: "damage_reduction", value: 2 }, // Water damages it
    ],
    passiveTraits: ["swift"],
    grantedCards: ["mount_steam_burst", "mount_piston_kick"],
    restrictions: [
      {
        type: "unit_class",
        allowed: ["academic", "freelancer", "hunter", "trapper"],
      },
    ],
    unlockCost: 250,
  },
  {
    id: "mount_shadowbeast",
    name: "Shadowbeast",
    description: "A mysterious creature from the chaos rifts. Agile and ferocious.",
    mountType: "beast",
    statModifiers: {
      atk: 2,
      agi: 2,
      def: -1,
      movement: 2,
    },
    terrainModifiers: [
      { terrain: "forest", effect: "bonus_movement", value: 1 },
    ],
    passiveTraits: ["trample", "intimidate"],
    grantedCards: ["mount_feral_leap", "mount_savage_bite"],
    restrictions: [
      {
        type: "unit_class",
        disallowed: ["cleric", "paladin"],
      },
    ],
    unlockCost: 200,
  },
];

// ----------------------------------------------------------------------------
// MOUNT REGISTRY HELPERS
// ----------------------------------------------------------------------------

/**
 * Get a mount by ID from the registry
 */
export function getMountById(mountId: MountId): Mount | null {
  const mount = MOUNT_REGISTRY.find(m => m.id === mountId);
  if (!mount) {
    console.warn(`[MOUNTS] Mount not found: ${mountId}`);
    return null;
  }
  return mount;
}

/**
 * Get all mounts as a record for quick lookup
 */
export function getAllMounts(): Record<MountId, Mount> {
  const result: Record<MountId, Mount> = {};
  for (const mount of MOUNT_REGISTRY) {
    result[mount.id] = mount;
  }
  return result;
}

/**
 * Get all starter mounts
 */
export function getStarterMounts(): Mount[] {
  return MOUNT_REGISTRY.filter(m => m.isStarterMount);
}

/**
 * Get mounts available for purchase (not starter, not already unlocked)
 */
export function getPurchasableMounts(stable: StableState): Mount[] {
  return MOUNT_REGISTRY.filter(
    m => !m.isStarterMount && !stable.unlockedMountIds.includes(m.id)
  );
}

// ----------------------------------------------------------------------------
// MOUNT RESTRICTION CHECKING
// ----------------------------------------------------------------------------

/**
 * Check if a unit can use a specific mount
 */
export function canUnitUseMount(unit: Unit, mount: Mount): { canUse: boolean; reason?: string } {
  const unitClass = (unit.unitClass || "freelancer") as UnitClass;

  for (const restriction of mount.restrictions) {
    if (restriction.type === "unit_class") {
      // Check whitelist
      if (restriction.allowed && !restriction.allowed.includes(unitClass)) {
        return {
          canUse: false,
          reason: `${mount.name} can only be used by: ${restriction.allowed.join(", ")}`,
        };
      }
      // Check blacklist
      if (restriction.disallowed && restriction.disallowed.includes(unitClass)) {
        return {
          canUse: false,
          reason: `${mount.name} cannot be used by ${unitClass} class`,
        };
      }
    }
    // Additional restriction types can be added here (armor_weight, unit_size, etc.)
  }

  return { canUse: true };
}

/**
 * Get all mounts compatible with a specific unit
 */
export function getCompatibleMounts(unit: Unit, stable: StableState): Mount[] {
  const availableMounts = stable.unlockedMountIds
    .map(id => getMountById(id))
    .filter((m): m is Mount => m !== null);

  return availableMounts.filter(mount => canUnitUseMount(unit, mount).canUse);
}

// ----------------------------------------------------------------------------
// OWNED MOUNT MANAGEMENT
// ----------------------------------------------------------------------------

/**
 * Generate a unique instance ID for a new mount
 */
function generateMountInstanceId(): string {
  return `mount_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new owned mount instance
 */
export function createOwnedMount(mountId: MountId): OwnedMount {
  const mount = getMountById(mountId);
  return {
    mountId,
    instanceId: generateMountInstanceId(),
    assignedToUnitId: null,
    condition: mount?.mountType === "mechanical" ? 100 : undefined,
  };
}

/**
 * Find an owned mount by its instance ID
 */
export function findOwnedMount(stable: StableState, instanceId: string): OwnedMount | null {
  return stable.ownedMounts.find(m => m.instanceId === instanceId) || null;
}

/**
 * Find the mount assigned to a specific unit
 */
export function findMountForUnit(stable: StableState, unitId: UnitId): OwnedMount | null {
  return stable.ownedMounts.find(m => m.assignedToUnitId === unitId) || null;
}

/**
 * Get all unassigned mounts
 */
export function getUnassignedMounts(stable: StableState): OwnedMount[] {
  return stable.ownedMounts.filter(m => m.assignedToUnitId === null);
}

// ----------------------------------------------------------------------------
// STABLE STATE MANAGEMENT
// ----------------------------------------------------------------------------

/**
 * Create initial stable state with starter mounts
 */
export function createInitialStableState(): StableState {
  const starterMounts = getStarterMounts();
  return {
    unlockedMountIds: starterMounts.map(m => m.id),
    ownedMounts: starterMounts.map(m => createOwnedMount(m.id)),
  };
}

/**
 * Unlock a new mount type and add one instance to owned mounts
 */
export function unlockMount(stable: StableState, mountId: MountId): StableState {
  if (stable.unlockedMountIds.includes(mountId)) {
    return stable; // Already unlocked
  }

  return {
    ...stable,
    unlockedMountIds: [...stable.unlockedMountIds, mountId],
    ownedMounts: [...stable.ownedMounts, createOwnedMount(mountId)],
  };
}

/**
 * Assign a mount to a unit
 * Returns updated stable state or null if assignment failed
 */
export function assignMountToUnit(
  stable: StableState,
  mountInstanceId: string,
  unitId: UnitId,
  unit: Unit
): { stable: StableState; error?: string } {
  const mountInstance = findOwnedMount(stable, mountInstanceId);
  if (!mountInstance) {
    return { stable, error: "Mount instance not found" };
  }

  if (mountInstance.assignedToUnitId !== null) {
    return { stable, error: "Mount is already assigned to another unit" };
  }

  const mount = getMountById(mountInstance.mountId);
  if (!mount) {
    return { stable, error: "Mount definition not found" };
  }

  // Check compatibility
  const compatibility = canUnitUseMount(unit, mount);
  if (!compatibility.canUse) {
    return { stable, error: compatibility.reason };
  }

  // Unassign any existing mount from this unit
  let updatedMounts = stable.ownedMounts.map(m => {
    if (m.assignedToUnitId === unitId) {
      return { ...m, assignedToUnitId: null };
    }
    return m;
  });

  // Assign the new mount
  updatedMounts = updatedMounts.map(m => {
    if (m.instanceId === mountInstanceId) {
      return { ...m, assignedToUnitId: unitId };
    }
    return m;
  });

  return {
    stable: {
      ...stable,
      ownedMounts: updatedMounts,
    },
  };
}

/**
 * Unassign a mount from a unit
 */
export function unassignMountFromUnit(stable: StableState, unitId: UnitId): StableState {
  return {
    ...stable,
    ownedMounts: stable.ownedMounts.map(m => {
      if (m.assignedToUnitId === unitId) {
        return { ...m, assignedToUnitId: null };
      }
      return m;
    }),
  };
}

/**
 * Unassign a specific mount instance
 */
export function unassignMount(stable: StableState, mountInstanceId: string): StableState {
  return {
    ...stable,
    ownedMounts: stable.ownedMounts.map(m => {
      if (m.instanceId === mountInstanceId) {
        return { ...m, assignedToUnitId: null };
      }
      return m;
    }),
  };
}

// ----------------------------------------------------------------------------
// STAT MODIFIER APPLICATION
// ----------------------------------------------------------------------------

/**
 * Calculate combined stat modifiers from a mount
 * Used when creating BattleUnitState
 */
export function getMountStatModifiers(mountId: MountId): MountStatModifiers {
  const mount = getMountById(mountId);
  if (!mount) {
    return {};
  }
  return mount.statModifiers;
}

/**
 * Get cards granted by a mount
 * Returns empty array if mount not found (fail-safe)
 */
export function getMountGrantedCards(mountId: MountId): string[] {
  const mount = getMountById(mountId);
  if (!mount) {
    console.warn(`[MOUNTS] Cannot get cards - mount not found: ${mountId}`);
    return [];
  }
  return mount.grantedCards;
}

/**
 * Get passive traits from a mount
 */
export function getMountPassiveTraits(mountId: MountId): MountPassiveTrait[] {
  const mount = getMountById(mountId);
  if (!mount) {
    return [];
  }
  return mount.passiveTraits;
}

/**
 * Check if a unit has a specific mount trait
 */
export function unitHasMountTrait(
  unit: Unit,
  stable: StableState | null,
  trait: MountPassiveTrait
): boolean {
  if (!stable || !unit.mountInstanceId) {
    return false;
  }

  const mountInstance = findOwnedMount(stable, unit.mountInstanceId);
  if (!mountInstance) {
    return false;
  }

  const traits = getMountPassiveTraits(mountInstance.mountId);
  return traits.includes(trait);
}

// ----------------------------------------------------------------------------
// MOUNT CARD HELPERS
// ----------------------------------------------------------------------------

/**
 * Get mount card by ID
 */
export function getMountCardById(cardId: string): MountCard | null {
  return MOUNT_CARDS.find(c => c.id === cardId) || null;
}

/**
 * Check if a card ID is a mount card
 */
export function isMountCard(cardId: string): boolean {
  return cardId.startsWith("mount_");
}

/**
 * Validate mount cards before adding to deck
 * Filters out invalid cards and logs warnings
 */
export function validateMountCards(cardIds: string[]): string[] {
  return cardIds.filter(id => {
    const card = getMountCardById(id);
    if (!card) {
      console.warn(`[MOUNTS] Invalid mount card skipped: ${id}`);
      return false;
    }
    return true;
  });
}

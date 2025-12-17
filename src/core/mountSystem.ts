// ============================================================================
// MOUNT SYSTEM - Core Logic
// ============================================================================

import { CampaignProgress, loadCampaignProgress, saveCampaignProgress } from "./campaign";
import { getGameState, updateGameState } from "../state/gameStore";
import { MOUNT_DEFINITIONS, type MountId, type MountInstance, getMountGearDef } from "../data/mounts";
import { ControlledRoomState } from "./campaign";

/**
 * Check if Stable is unlocked
 */
export function isStableUnlocked(): boolean {
  const progress = loadCampaignProgress();
  const state = getGameState();
  
  // Check campaign progress first
  if (progress.mountUnlocks?.stableUnlocked) {
    return true;
  }
  
  // Check game state (fallback)
  if (state.mountUnlocks?.stableUnlocked) {
    return true;
  }
  
  // Default unlock: after completing Operation 2 (op_black_spire)
  // For now, use a simple debug flag or operation completion check
  const completedOps = progress.completedOperations || [];
  if (completedOps.includes("op_black_spire")) {
    unlockStable();
    return true;
  }
  
  // Debug flag: allow enabling in dev mode
  const DEBUG_STABLE_UNLOCK = false; // Set to true for testing
  if (DEBUG_STABLE_UNLOCK) {
    unlockStable();
    return true;
  }
  
  return false;
}

/**
 * Unlock Stable
 */
export function unlockStable(): void {
  const progress = loadCampaignProgress();
  const updated: CampaignProgress = {
    ...progress,
    mountUnlocks: {
      ...(progress.mountUnlocks || { stableUnlocked: false, heavyUnlocked: false, supportUnlocked: false }),
      stableUnlocked: true,
    },
  };
  saveCampaignProgress(updated);
  
  // Also update game state
  updateGameState(s => ({
    ...s,
    mountUnlocks: {
      ...(s.mountUnlocks || { stableUnlocked: false, heavyUnlocked: false, supportUnlocked: false }),
      stableUnlocked: true,
    },
  }));
  
  console.log("[MOUNT] Stable unlocked");
}

/**
 * Check if Heavy mounts are unlocked
 */
export function isHeavyMountUnlocked(): boolean {
  const progress = loadCampaignProgress();
  const state = getGameState();
  
  if (progress.mountUnlocks?.heavyUnlocked || state.mountUnlocks?.heavyUnlocked) {
    return true;
  }
  
  // Default unlock: after completing Operation 3 (op_ghost_run)
  const completedOps = progress.completedOperations || [];
  if (completedOps.includes("op_ghost_run")) {
    unlockHeavyMounts();
    return true;
  }
  
  return false;
}

/**
 * Unlock Heavy mounts
 */
export function unlockHeavyMounts(): void {
  const progress = loadCampaignProgress();
  const updated: CampaignProgress = {
    ...progress,
    mountUnlocks: {
      ...(progress.mountUnlocks || { stableUnlocked: false, heavyUnlocked: false, supportUnlocked: false }),
      heavyUnlocked: true,
    },
  };
  saveCampaignProgress(updated);
  
  updateGameState(s => ({
    ...s,
    mountUnlocks: {
      ...(s.mountUnlocks || { stableUnlocked: false, heavyUnlocked: false, supportUnlocked: false }),
      heavyUnlocked: true,
    },
  }));
  
  console.log("[MOUNT] Heavy mounts unlocked");
}

/**
 * Check if Support mounts are unlocked
 * Requires Medical Ward controlled room capture
 */
export function isSupportMountUnlocked(): boolean {
  const progress = loadCampaignProgress();
  const state = getGameState();
  
  if (progress.mountUnlocks?.supportUnlocked || state.mountUnlocks?.supportUnlocked) {
    return true;
  }
  
  // Check for Medical Ward controlled room
  const activeRun = progress.activeRun;
  if (activeRun?.controlledRooms) {
    const hasMedicalWard = Object.values(activeRun.controlledRooms).some(
      (room: ControlledRoomState) => room.roomType === "medical_ward"
    );
    
    if (hasMedicalWard) {
      unlockSupportMounts();
      return true;
    }
  }
  
  return false;
}

/**
 * Unlock Support mounts
 */
export function unlockSupportMounts(): void {
  const progress = loadCampaignProgress();
  const updated: CampaignProgress = {
    ...progress,
    mountUnlocks: {
      ...(progress.mountUnlocks || { stableUnlocked: false, heavyUnlocked: false, supportUnlocked: false }),
      supportUnlocked: true,
    },
  };
  saveCampaignProgress(updated);
  
  updateGameState(s => ({
    ...s,
    mountUnlocks: {
      ...(s.mountUnlocks || { stableUnlocked: false, heavyUnlocked: false, supportUnlocked: false }),
      supportUnlocked: true,
    },
  }));
  
  console.log("[MOUNT] Support mounts unlocked (Medical Ward captured)");
}

/**
 * Check if a grid size allows mounts
 */
export function isGridSizeAllowedForMounts(gridWidth: number, gridHeight: number): boolean {
  // Allowed: 6×4, 6×5, 8×6 (and any grid flagged "Open")
  // Forbidden: 4×3, 5×4 (and grids flagged "Confined/Interior")
  
  const area = gridWidth * gridHeight;
  
  // Explicitly allowed sizes
  if ((gridWidth === 6 && gridHeight === 4) ||
      (gridWidth === 6 && gridHeight === 5) ||
      (gridWidth === 8 && gridHeight === 6)) {
    return true;
  }
  
  // Explicitly forbidden sizes
  if ((gridWidth === 4 && gridHeight === 3) ||
      (gridWidth === 5 && gridHeight === 4)) {
    return false;
  }
  
  // Default: allow if area >= 24 (6×4 = 24)
  return area >= 24;
}

/**
 * Add a mount to inventory (when purchased/unlocked)
 */
export function addMountToInventory(mountId: MountId, condition: number = 100): void {
  const mountDef = MOUNT_DEFINITIONS[mountId];
  if (!mountDef) {
    console.warn(`[MOUNT] Unknown mount ID: ${mountId}`);
    return;
  }
  
  updateGameState(s => {
    const inventory = s.mountInventory || [];
    const newMount: MountInstance = {
      id: mountId,
      condition,
      gear: [],
    };
    
    return {
      ...s,
      mountInventory: [...inventory, newMount],
    };
  });
  
  console.log(`[MOUNT] Added ${mountDef.name} to inventory`);
}

/**
 * Get mount instance from inventory
 */
export function getMountInstance(mountId: MountId): MountInstance | undefined {
  const state = getGameState();
  const inventory = state.mountInventory || [];
  return inventory.find(m => m.id === mountId);
}

/**
 * Update mount condition
 */
export function updateMountCondition(mountId: MountId, newCondition: number): void {
  updateGameState(s => {
    const inventory = s.mountInventory || [];
    const updated = inventory.map(m => 
      m.id === mountId ? { ...m, condition: Math.max(0, Math.min(100, newCondition)) } : m
    );
    
    return {
      ...s,
      mountInventory: updated,
    };
  });
}

/**
 * Check if Forward Stable is active (provides mount benefits)
 */
function hasForwardStable(): boolean {
  const progress = loadCampaignProgress();
  const activeRun = progress.activeRun;
  if (!activeRun?.controlledRooms) return false;
  
  return Object.values(activeRun.controlledRooms).some(
    (room: ControlledRoomState) => room.roomType === "forward_stable" && room.status === "controlled"
  );
}

/**
 * Apply condition loss from damage (called when mounted unit takes damage)
 * Returns the new condition value
 */
export function applyMountConditionLossFromDamage(
  mountId: MountId,
  damageAmount: number
): number {
  const mountInstance = getMountInstance(mountId);
  if (!mountInstance) return 0;
  
  // Calculate total condition loss reduction from gear
  let totalReduction = 0;
  for (const gearId of mountInstance.gear) {
    const gearDef = getMountGearDef(gearId);
    if (gearDef) {
      totalReduction += gearDef.conditionLossReduction;
    }
  }
  
  // Forward Stable provides additional 25% reduction
  if (hasForwardStable()) {
    totalReduction += 25;
  }
  
  totalReduction = Math.min(100, totalReduction); // Cap at 100%
  
  // Condition loss: 1 point per 5 damage (minimum 1 point for any damage)
  let conditionLoss = Math.max(1, Math.floor(damageAmount / 5));
  
  // Apply gear + Forward Stable reduction
  if (totalReduction > 0) {
    conditionLoss = Math.max(1, Math.floor(conditionLoss * (1 - totalReduction / 100)));
  }
  
  const newCondition = Math.max(0, mountInstance.condition - conditionLoss);
  
  updateMountCondition(mountId, newCondition);
  
  const reductionSources: string[] = [];
  if (mountInstance.gear.length > 0) reductionSources.push("gear");
  if (hasForwardStable()) reductionSources.push("Forward Stable");
  
  console.log(`[MOUNT] Condition -${conditionLoss} due to damage (${mountInstance.condition}% -> ${newCondition}%)${reductionSources.length > 0 ? ` [reduction: ${totalReduction}% from ${reductionSources.join(", ")}]` : ""}`);
  
  return newCondition;
}

/**
 * Apply condition loss from forced dismount
 * Returns the new condition value
 */
export function applyMountConditionLossFromDismount(mountId: MountId): number {
  const mountInstance = getMountInstance(mountId);
  if (!mountInstance) return 0;
  
  // Forced dismount: lose 5 condition points
  const conditionLoss = 5;
  const newCondition = Math.max(0, mountInstance.condition - conditionLoss);
  
  updateMountCondition(mountId, newCondition);
  
  console.log(`[MOUNT] Condition -${conditionLoss} due to forced dismount (${mountInstance.condition}% -> ${newCondition}%)`);
  
  return newCondition;
}

/**
 * Check if forced dismount should occur (based on condition and random roll)
 * Returns true if dismount occurs
 */
export function rollForcedDismount(mountId: MountId, mountCondition: number): boolean {
  // Base chance: 0% at 100%, increases as condition decreases
  // At 50% condition: 10% chance
  // At 25% condition: 25% chance
  // At 0% condition: 100% chance (but mount shouldn't be usable at 0)
  
  if (mountCondition <= 0) return true;
  if (mountCondition >= 75) return false;
  
  const baseChance = (100 - mountCondition) / 4; // 0-25% range
  
  // Apply gear dismount resistance
  const mountInstance = getMountInstance(mountId);
  let totalResistance = 0;
  if (mountInstance) {
    for (const gearId of mountInstance.gear) {
      const gearDef = getMountGearDef(gearId);
      if (gearDef) {
        totalResistance += gearDef.dismountResistance;
      }
    }
    totalResistance = Math.min(100, totalResistance); // Cap at 100%
  }
  
  const finalChance = baseChance * (1 - totalResistance / 100);
  const roll = Math.random() * 100;
  
  const dismounted = roll < finalChance;
  if (dismounted) {
    console.log(`[MOUNT] Forced dismount roll: chance=${finalChance.toFixed(1)}% roll=${roll.toFixed(1)}% -> DISMOUNTED${totalResistance > 0 ? ` [gear resistance: ${totalResistance}%]` : ""}`);
  } else {
    console.log(`[MOUNT] Forced dismount roll: chance=${finalChance.toFixed(1)}% roll=${roll.toFixed(1)}% -> STAY MOUNTED${totalResistance > 0 ? ` [gear resistance: ${totalResistance}%]` : ""}`);
  }
  
  return dismounted;
}


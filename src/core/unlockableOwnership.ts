// ============================================================================
// CHAOS CORE - UNLOCKABLE OWNERSHIP TRACKING
// Manages player ownership of chassis, doctrines, and field mods
// ============================================================================

import { getGameState, updateGameState } from "../state/gameStore";
import { UnlockableDefinition, UnlockableType, getUnlockableById, getUnlockablesByType } from "./unlockables";

// ----------------------------------------------------------------------------
// OWNERSHIP API
// ----------------------------------------------------------------------------

/**
 * Check if player owns an unlockable
 */
export function hasUnlock(unlockableId: string): boolean {
  const state = getGameState();
  const unlockable = getUnlockableById(unlockableId);
  
  if (!unlockable) {
    console.warn(`[UNLOCKABLES] Unknown unlockable ID: ${unlockableId}`);
    return false;
  }

  switch (unlockable.type) {
    case "chassis":
      return (state.unlockedChassisIds || []).includes(unlockableId);
    case "doctrine":
      return (state.unlockedDoctrineIds || []).includes(unlockableId);
    case "field_mod":
      // Field mods are always available (they're not permanently unlocked)
      // But we can track them if needed in the future
      return true; // For now, field mods are always available
    default:
      return false;
  }
}

/**
 * Grant an unlockable to the player
 */
export function grantUnlock(unlockableId: string, reason?: string): void {
  const unlockable = getUnlockableById(unlockableId);
  
  if (!unlockable) {
    console.warn(`[UNLOCKABLES] Cannot grant unknown unlockable: ${unlockableId}`);
    return;
  }

  // Check if already owned
  if (hasUnlock(unlockableId)) {
    console.log(`[UNLOCKABLES] Already owned: ${unlockableId}`);
    return;
  }

  // Grant based on type
  switch (unlockable.type) {
    case "chassis":
      updateGameState(state => ({
        ...state,
        unlockedChassisIds: [...(state.unlockedChassisIds || []), unlockableId],
      }));
      console.log(`[UNLOCKABLES] ✓ Granted chassis: ${unlockable.displayName}${reason ? ` (${reason})` : ""}`);
      break;
      
    case "doctrine":
      updateGameState(state => ({
        ...state,
        unlockedDoctrineIds: [...(state.unlockedDoctrineIds || []), unlockableId],
      }));
      console.log(`[UNLOCKABLES] ✓ Granted doctrine: ${unlockable.displayName}${reason ? ` (${reason})` : ""}`);
      break;
      
    case "field_mod":
      // Field mods are not permanently unlocked, they're run-scoped
      // But we can track them for future use
      console.log(`[UNLOCKABLES] Field mod unlocked: ${unlockable.displayName}${reason ? ` (${reason})` : ""}`);
      break;
      
    default:
      console.warn(`[UNLOCKABLES] Unknown unlockable type: ${(unlockable as any).type}`);
  }
}

/**
 * Get all owned unlockables of a specific type
 */
export function listUnlocksByType(type: UnlockableType): UnlockableDefinition[] {
  const state = getGameState();
  const allOfType = getUnlockablesByType(type);
  
  switch (type) {
    case "chassis":
      const ownedChassisIds = state.unlockedChassisIds || [];
      return allOfType.filter(u => ownedChassisIds.includes(u.id));
      
    case "doctrine":
      const ownedDoctrineIds = state.unlockedDoctrineIds || [];
      return allOfType.filter(u => ownedDoctrineIds.includes(u.id));
      
    case "field_mod":
      // Field mods are always available (not permanently unlocked)
      return allOfType;
      
    default:
      return [];
  }
}

/**
 * Get all owned unlockable IDs (for persistence/save)
 */
export function getAllOwnedUnlockableIds(): {
  chassis: string[];
  doctrines: string[];
} {
  const state = getGameState();
  return {
    chassis: state.unlockedChassisIds || [],
    doctrines: state.unlockedDoctrineIds || [],
  };
}

/**
 * Initialize ownership from save data
 */
export function initializeOwnership(chassisIds: string[], doctrineIds: string[]): void {
  updateGameState(state => ({
    ...state,
    unlockedChassisIds: chassisIds,
    unlockedDoctrineIds: doctrineIds,
  }));
}


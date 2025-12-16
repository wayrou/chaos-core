// ============================================================================
// LOCAL CO-OP SYSTEM - Drop-in/Drop-out and Unit Redistribution
// ============================================================================

import { GameState, PlayerId, UnitId } from "./types";
import { getGameState, updateGameState } from "../state/gameStore";
import { FieldAvatar } from "./types";

const MAX_TETHER_DISTANCE = 6 * 64; // 6 tiles in pixels (assuming 64px tiles)

/**
 * Redistribute units between P1 and P2 when P2 joins or leaves
 */
export function redistributeUnitsForCoop(state: GameState): GameState {
  const p1 = state.players.P1;
  const p2 = state.players.P2;
  
  // Collect all player-controlled unit IDs
  const playerUnitIds = state.partyUnitIds.filter(unitId => {
    const unit = state.unitsById[unitId];
    return unit && !unit.isEnemy;
  });
  
  if (p2.active && playerUnitIds.length > 0) {
    // Distribute units evenly between P1 and P2
    p1.controlledUnitIds = [];
    p2.controlledUnitIds = [];
    
    playerUnitIds.forEach((unitId, index) => {
      const controller: PlayerId = index % 2 === 0 ? "P1" : "P2";
      const unit = state.unitsById[unitId];
      if (unit) {
        unit.controller = controller;
        if (controller === "P1") {
          p1.controlledUnitIds.push(unitId);
        } else {
          p2.controlledUnitIds.push(unitId);
        }
      }
    });
  } else {
    // P2 not active - assign all units to P1
    p1.controlledUnitIds = [...playerUnitIds];
    p2.controlledUnitIds = [];
    
    playerUnitIds.forEach(unitId => {
      const unit = state.unitsById[unitId];
      if (unit) {
        unit.controller = "P1";
      }
    });
  }
  
  return state;
}

/**
 * Try to join as Player 2 (drop-in)
 * Returns true if successful, false if not allowed (e.g., in battle)
 */
export function tryJoinAsP2(): boolean {
  const state = getGameState();
  const p2 = state.players.P2;
  const p1 = state.players.P1;
  
  // Don't allow join during battle
  if (state.phase === "battle" || state.currentBattle !== null) {
    console.log("[COOP] Cannot join during battle");
    return false;
  }
  
  if (p2.active) {
    console.log("[COOP] P2 is already active");
    return false;
  }
  
  updateGameState(s => {
    const newP2 = { ...s.players.P2 };
    newP2.active = true;
    newP2.inputSource = "keyboard2";
    newP2.color = "#6849c2";
    
    // Spawn P2 avatar near P1
    if (s.players.P1.avatar) {
      newP2.avatar = {
        x: s.players.P1.avatar.x + 64, // 1 tile offset
        y: s.players.P1.avatar.y,
        facing: s.players.P1.avatar.facing,
      };
    } else {
      // If P1 has no avatar, create one at default position
      const tileSize = 64;
      const defaultX = 10 * tileSize;
      const defaultY = 8 * tileSize;
      
      s.players.P1.avatar = {
        x: defaultX,
        y: defaultY,
        facing: "south",
      };

      newP2.avatar = {
        x: defaultX + 64,
        y: defaultY,
        facing: "south",
      };
    }
    
    const newState = {
      ...s,
      players: {
        ...s.players,
        P2: newP2,
      },
    };
    
    return redistributeUnitsForCoop(newState);
  });
  
  showCoopMessage("Player 2 joined the expedition", "#6849c2");
  console.log("[COOP] P2 joined");
  return true;
}

/**
 * Drop out Player 2 (drop-out)
 * Returns true if successful, false if not allowed
 */
export function dropOutP2(): boolean {
  const state = getGameState();
  const p2 = state.players.P2;
  const p1 = state.players.P1;
  
  if (!p2.active) {
    return false;
  }
  
  // Don't allow drop-out during battle
  if (state.phase === "battle" || state.currentBattle !== null) {
    console.log("[COOP] Cannot drop out during battle");
    return false;
  }
  
  updateGameState(s => {
    // Reassign units back to P1
    const newUnitsById = { ...s.unitsById };
    for (const unitId of p2.controlledUnitIds) {
      const unit = newUnitsById[unitId];
      if (unit) {
        unit.controller = "P1";
        p1.controlledUnitIds.push(unitId);
      }
    }
    
    const newP2 = {
      ...s.players.P2,
      active: false,
      avatar: null,
      inputSource: "none" as const,
      controlledUnitIds: [],
    };
    
    return {
      ...s,
      unitsById: newUnitsById,
      players: {
        ...s.players,
        P2: newP2,
      },
    };
  });
  
  showCoopMessage("Player 2 left. Aeriss now controls all units.", "#ff8a00");
  console.log("[COOP] P2 dropped out");
  return true;
}

/**
 * Show a transient co-op message
 */
function showCoopMessage(message: string, color: string): void {
  // Create a temporary message overlay
  const root = document.getElementById("app");
  if (!root) return;
  
  const messageEl = document.createElement("div");
  messageEl.className = "coop-message";
  messageEl.textContent = message;
  messageEl.style.color = color;
  messageEl.style.position = "fixed";
  messageEl.style.top = "20px";
  messageEl.style.left = "50%";
  messageEl.style.transform = "translateX(-50%)";
  messageEl.style.background = "rgba(0, 0, 0, 0.8)";
  messageEl.style.padding = "12px 24px";
  messageEl.style.borderRadius = "8px";
  messageEl.style.border = `2px solid ${color}`;
  messageEl.style.zIndex = "10000";
  messageEl.style.fontFamily = "var(--font-display)";
  messageEl.style.fontSize = "14px";
  messageEl.style.fontWeight = "600";
  messageEl.style.letterSpacing = "0.1em";
  messageEl.style.textTransform = "uppercase";
  messageEl.style.animation = "coopMessageFadeIn 0.3s ease";
  
  root.appendChild(messageEl);
  
  // Remove after 3 seconds
  setTimeout(() => {
    messageEl.style.animation = "coopMessageFadeOut 0.3s ease";
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 300);
  }, 3000);
}

/**
 * Check if two avatars exceed max tether distance
 * Returns the distance and whether it exceeds threshold
 */
export function checkTetherDistance(
  avatar1: FieldAvatar,
  avatar2: FieldAvatar
): { distance: number; exceeds: boolean } {
  const dx = avatar1.x - avatar2.x;
  const dy = avatar1.y - avatar2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return {
    distance,
    exceeds: distance > MAX_TETHER_DISTANCE,
  };
}

/**
 * Apply tether constraint to movement
 * If movement would exceed max distance, prevent it
 */
export function applyTetherConstraint(
  currentPos: { x: number; y: number },
  desiredPos: { x: number; y: number },
  otherAvatar: FieldAvatar
): { x: number; y: number } {
  const dx = desiredPos.x - otherAvatar.x;
  const dy = desiredPos.y - otherAvatar.y;
  const newDistance = Math.sqrt(dx * dx + dy * dy);
  
  if (newDistance <= MAX_TETHER_DISTANCE) {
    return desiredPos; // Movement is allowed
  }
  
  // Movement would exceed tether - clamp to max distance
  const angle = Math.atan2(dy, dx);
  const clampedX = otherAvatar.x + Math.cos(angle) * MAX_TETHER_DISTANCE;
  const clampedY = otherAvatar.y + Math.sin(angle) * MAX_TETHER_DISTANCE;
  
  return { x: clampedX, y: clampedY };
}








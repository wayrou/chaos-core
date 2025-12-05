// ============================================================================
// WEAPON SYSTEM - Runtime State, Node Damage, Heat/Ammo/Wear Tracking
// Headline 14b: Weapon Mechanics
// ============================================================================

import { WeaponEquipment } from "./equipment";
import { GameState } from "./types";
import { getSettings } from "./settings";

// ----------------------------------------------------------------------------
// WEAPON NODE SYSTEM
// Each mechanical weapon has 6 nodes that can be damaged
// ----------------------------------------------------------------------------

export type WeaponNodeId = 1 | 2 | 3 | 4 | 5 | 6;

export type NodeDamageLevel = "ok" | "damaged" | "broken" | "destroyed";

export interface WeaponNode {
  id: WeaponNodeId;
  name: string;
  altName: string; // Different name for different weapon types
  status: NodeDamageLevel;
}

export const WEAPON_NODE_NAMES: Record<WeaponNodeId, { primary: string; alt: string }> = {
  1: { primary: "SIGHTS", alt: "STABILIZER" },
  2: { primary: "BARREL", alt: "EDGE" },
  3: { primary: "ACTION", alt: "SERVO" },
  4: { primary: "POWER COUPLING", alt: "TENSIONER" },
  5: { primary: "HEAT SINK", alt: "ARRAY" },
  6: { primary: "FEED PATH", alt: "MAG LATCH" },
};

export const NODE_DAMAGE_EFFECTS: Record<WeaponNodeId, { damaged: string; broken: string }> = {
  1: {
    damaged: "-1 ACC with this weapon; Overwatch -2 ACC",
    broken: "-2 ACC and cannot Overwatch",
  },
  2: {
    damaged: "Range -1; AoE radius -1; Melee: -1 damage",
    broken: "Cannot use Arc/AoE cards; Melee: -1 damage",
  },
  3: {
    damaged: "Multi-attack cards are unplayable",
    broken: "Weapon cards have 33% chance to jam (no effect, +1 Strain)",
  },
  4: {
    damaged: "First weapon card each turn costs +1 Strain",
    broken: "+1 Heat per attack (or +1 Strain if heatless)",
  },
  5: {
    damaged: "Max Heat -2; Heat removal effects reduced by 1",
    broken: "Cannot remove more than 1 Heat/turn",
  },
  6: {
    damaged: "Ammo cost +1; Quick Reload restores 1 fewer",
    broken: "Quick Reload fails; Full Reload only half",
  },
};

// ----------------------------------------------------------------------------
// WEAPON RUNTIME STATE
// Tracks current heat, ammo, wear, and node damage for a weapon in battle
// ----------------------------------------------------------------------------

export interface WeaponRuntimeState {
  equipmentId: string;
  currentHeat: number;
  currentAmmo: number;
  wear: number;
  nodes: Record<WeaponNodeId, NodeDamageLevel>;
  isJammed: boolean;
  clutchActive: boolean;
  doubleClutchActive: boolean;
}

export function createWeaponRuntimeState(weapon: WeaponEquipment): WeaponRuntimeState {
  return {
    equipmentId: weapon.id,
    currentHeat: 0,
    currentAmmo: weapon.ammoMax ?? 0,
    wear: weapon.wear ?? 0,
    nodes: {
      1: "ok",
      2: "ok",
      3: "ok",
      4: "ok",
      5: "ok",
      6: "ok",
    },
    isJammed: false,
    clutchActive: false,
    doubleClutchActive: false,
  };
}

// ----------------------------------------------------------------------------
// HEAT MECHANICS
// ----------------------------------------------------------------------------

export function addHeat(state: WeaponRuntimeState, weapon: WeaponEquipment, amount: number): WeaponRuntimeState {
  if (!weapon.isMechanical || !weapon.heatCapacity) {
    return state;
  }

  // Check for damaged heat sink (reduces max capacity by 2)
  let maxHeat = weapon.heatCapacity;
  if (state.nodes[5] === "damaged" || state.nodes[5] === "broken") {
    maxHeat = Math.max(1, maxHeat - 2);
  }

  // Check for broken power coupling (+1 heat per attack)
  if (state.nodes[4] === "broken") {
    amount += 1;
  }

  const newHeat = Math.min(maxHeat, state.currentHeat + amount);

  // Check for overheat
  if (newHeat >= maxHeat) {
    return {
      ...state,
      currentHeat: 0,
      isJammed: true,
    };
  }

  return {
    ...state,
    currentHeat: newHeat,
  };
}

export function removeHeat(state: WeaponRuntimeState, amount: number): WeaponRuntimeState {
  // Check for damaged heat sink (reduces cooling by 1)
  if (state.nodes[5] === "damaged") {
    amount = Math.max(0, amount - 1);
  }

  // Check for broken heat sink (max 1 per turn)
  if (state.nodes[5] === "broken") {
    amount = Math.min(1, amount);
  }

  return {
    ...state,
    currentHeat: Math.max(0, state.currentHeat - amount),
  };
}

export function passiveCooling(state: WeaponRuntimeState): WeaponRuntimeState {
  // At start of turn, reduce heat by 1
  return removeHeat(state, 1);
}

// ----------------------------------------------------------------------------
// AMMO MECHANICS
// ----------------------------------------------------------------------------

export function useAmmo(state: WeaponRuntimeState, weapon: WeaponEquipment, amount: number = 1): WeaponRuntimeState {
  if (!weapon.ammoMax) {
    return state;
  }

  // Check for damaged feed path (+1 ammo cost)
  if (state.nodes[6] === "damaged" || state.nodes[6] === "broken") {
    amount += 1;
  }

  return {
    ...state,
    currentAmmo: Math.max(0, state.currentAmmo - amount),
  };
}

export function quickReload(state: WeaponRuntimeState, weapon: WeaponEquipment): { state: WeaponRuntimeState; strainCost: number } {
  if (!weapon.ammoMax) {
    return { state, strainCost: 0 };
  }

  // Check for broken feed path (quick reload fails)
  if (state.nodes[6] === "broken") {
    return { state, strainCost: weapon.quickReloadStrain ?? 1 };
  }

  // Quick reload restores half (rounded up)
  let reloadAmount = Math.ceil(weapon.ammoMax / 2);

  // Check for damaged feed path (restores 1 fewer)
  if (state.nodes[6] === "damaged") {
    reloadAmount = Math.max(1, reloadAmount - 1);
  }

  return {
    state: {
      ...state,
      currentAmmo: Math.min(weapon.ammoMax, state.currentAmmo + reloadAmount),
    },
    strainCost: weapon.quickReloadStrain ?? 1,
  };
}

export function fullReload(state: WeaponRuntimeState, weapon: WeaponEquipment): { state: WeaponRuntimeState; strainCost: number } {
  if (!weapon.ammoMax) {
    return { state, strainCost: 0 };
  }

  let reloadAmount = weapon.ammoMax;

  // Check for broken feed path (only restores half)
  if (state.nodes[6] === "broken") {
    reloadAmount = Math.ceil(weapon.ammoMax / 2);
  }

  return {
    state: {
      ...state,
      currentAmmo: Math.min(weapon.ammoMax, reloadAmount),
    },
    strainCost: weapon.fullReloadStrain ?? 0,
  };
}

// ----------------------------------------------------------------------------
// CLUTCH & WEAR MECHANICS
// Clutch toggles can be activated before an attack. When activated, they add +1 wear.
// If toggled OFF before the attack is made, the wear is refunded.
// Once an attack is made with clutch active, the wear is permanent.
// ----------------------------------------------------------------------------

export function activateClutch(state: WeaponRuntimeState): WeaponRuntimeState {
  // Only add wear if not already active
  if (state.clutchActive) return state;
  
  return {
    ...state,
    clutchActive: true,
    wear: state.wear + 1,
  };
}

export function deactivateClutch(state: WeaponRuntimeState): WeaponRuntimeState {
  // Only refund wear if currently active
  if (!state.clutchActive) return state;
  
  return {
    ...state,
    clutchActive: false,
    wear: Math.max(0, state.wear - 1), // Refund the wear
  };
}

export function activateDoubleClutch(state: WeaponRuntimeState): WeaponRuntimeState {
  // Only add wear if not already active
  if (state.doubleClutchActive) return state;
  
  return {
    ...state,
    doubleClutchActive: true,
    wear: state.wear + 1,
  };
}

export function deactivateDoubleClutch(state: WeaponRuntimeState): WeaponRuntimeState {
  // Only refund wear if currently active
  if (!state.doubleClutchActive) return state;
  
  return {
    ...state,
    doubleClutchActive: false,
    wear: Math.max(0, state.wear - 1), // Refund the wear
  };
}

export function resetClutches(state: WeaponRuntimeState): WeaponRuntimeState {
  // Refund wear for any active clutches
  let wearRefund = 0;
  if (state.clutchActive) wearRefund++;
  if (state.doubleClutchActive) wearRefund++;
  
  return {
    ...state,
    clutchActive: false,
    doubleClutchActive: false,
    wear: Math.max(0, state.wear - wearRefund),
  };
}

// Call this after an attack is made with clutch active - locks in the wear (no longer refundable)
export function commitClutchWear(state: WeaponRuntimeState): WeaponRuntimeState {
  // Just reset the active flags, wear stays
  return {
    ...state,
    clutchActive: false,
    doubleClutchActive: false,
  };
}

export function getWearPenalties(wear: number): { accPenalty: number; dmgPenalty: number } {
  if (wear === 0) {
    return { accPenalty: 0, dmgPenalty: 0 };
  } else if (wear === 1) {
    return { accPenalty: 1, dmgPenalty: 0 };
  } else {
    return { accPenalty: wear, dmgPenalty: wear };
  }
}

// ----------------------------------------------------------------------------
// WEAPON HIT MECHANICS
// ----------------------------------------------------------------------------

export function rollWeaponHit(wasCrit: boolean): boolean {
  if (wasCrit) {
    return true; // Auto weapon hit on crit
  }
  // Roll d6, weapon hit on 6
  return Math.floor(Math.random() * 6) + 1 === 6;
}

export function rollWeaponNodeHit(): WeaponNodeId {
  return (Math.floor(Math.random() * 6) + 1) as WeaponNodeId;
}

export function damageNode(state: WeaponRuntimeState, nodeId: WeaponNodeId): WeaponRuntimeState {
  const currentStatus = state.nodes[nodeId];
  let newStatus: NodeDamageLevel;

  switch (currentStatus) {
    case "ok":
      newStatus = "damaged";
      break;
    case "damaged":
      newStatus = "broken";
      break;
    case "broken":
      newStatus = "destroyed";
      break;
    case "destroyed":
      newStatus = "destroyed";
      break;
  }

  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId]: newStatus,
    },
  };
}

export function repairNode(state: WeaponRuntimeState, nodeId: WeaponNodeId): WeaponRuntimeState {
  const currentStatus = state.nodes[nodeId];
  let newStatus: NodeDamageLevel;

  switch (currentStatus) {
    case "destroyed":
      newStatus = "broken";
      break;
    case "broken":
      newStatus = "damaged";
      break;
    case "damaged":
      newStatus = "ok";
      break;
    case "ok":
      newStatus = "ok";
      break;
  }

  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId]: newStatus,
    },
  };
}

export function isWeaponDestroyed(state: WeaponRuntimeState): boolean {
  // Weapon is offline if any node is destroyed
  return Object.values(state.nodes).some(status => status === "destroyed");
}

// ----------------------------------------------------------------------------
// NODE EFFECT CHECKS
// ----------------------------------------------------------------------------

export function getAccuracyPenalty(state: WeaponRuntimeState, wear: number): number {
  let penalty = 0;

  // Wear penalties
  const wearPenalties = getWearPenalties(wear);
  penalty += wearPenalties.accPenalty;

  // Node 1 (Sights) damage
  if (state.nodes[1] === "damaged") {
    penalty += 1;
  } else if (state.nodes[1] === "broken" || state.nodes[1] === "destroyed") {
    penalty += 2;
  }

  return penalty;
}

export function getDamagePenalty(state: WeaponRuntimeState, wear: number): number {
  let penalty = 0;

  // Wear penalties
  const wearPenalties = getWearPenalties(wear);
  penalty += wearPenalties.dmgPenalty;

  // Node 2 (Barrel/Edge) damage
  if (state.nodes[2] === "damaged" || state.nodes[2] === "broken") {
    penalty += 1;
  }

  return penalty;
}

export function canUseOverwatch(state: WeaponRuntimeState): boolean {
  return state.nodes[1] !== "broken" && state.nodes[1] !== "destroyed";
}

export function canUseMultiAttack(state: WeaponRuntimeState): boolean {
  return state.nodes[3] !== "damaged" && state.nodes[3] !== "broken" && state.nodes[3] !== "destroyed";
}

export function checkWeaponJam(state: WeaponRuntimeState): boolean {
  // Check for broken action node (33% jam chance)
  if (state.nodes[3] === "broken") {
    return Math.random() < 0.33;
  }
  return false;
}

export function getExtraStrainCost(state: WeaponRuntimeState, isFirstCardThisTurn: boolean): number {
  let extra = 0;

  // Damaged power coupling: first card costs +1 strain
  if (isFirstCardThisTurn && (state.nodes[4] === "damaged" || state.nodes[4] === "broken")) {
    extra += 1;
  }

  return extra;
}

// ----------------------------------------------------------------------------
// HEAT ZONE HELPERS
// ----------------------------------------------------------------------------

export type HeatZone = "stable" | "warning" | "critical";

export function getHeatZone(state: WeaponRuntimeState, weapon: WeaponEquipment): HeatZone {
  if (!weapon.isMechanical || !weapon.heatCapacity) {
    return "stable";
  }

  const maxHeat = weapon.heatCapacity;
  const pct = state.currentHeat / maxHeat;

  if (pct < 0.5) {
    return "stable";
  } else if (pct < 0.8) {
    return "warning";
  } else {
    return "critical";
  }
}

export function getHeatZoneColor(zone: HeatZone): string {
  switch (zone) {
    case "stable":
      return "#4ade80"; // green
    case "warning":
      return "#fbbf24"; // yellow
    case "critical":
      return "#ef4444"; // red
  }
}
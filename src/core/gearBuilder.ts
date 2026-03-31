// ============================================================================
// CHAOS CORE - GEAR BUILDER SYSTEM
// Logic for building new gear from chassis + doctrine
// ============================================================================

import { Equipment, WeaponEquipment, ArmorEquipment, AccessoryEquipment } from "./equipment";
import { GearChassis, getChassisById } from "../data/gearChassis";
import { GearDoctrine, getDoctrineById } from "../data/gearDoctrines";
import { GameState } from "./types";

export interface BuildGearResult {
  success: boolean;
  error?: string;
  equipment?: Equipment;
}

/**
 * Build a new piece of gear from chassis and doctrine
 */
export function buildGear(
  chassisId: string,
  doctrineId: string,
  state: GameState
): BuildGearResult {
  const chassis = getChassisById(chassisId);
  const doctrine = getDoctrineById(doctrineId);
  
  if (!chassis) {
    return { success: false, error: "Invalid chassis ID" };
  }
  
  if (!doctrine) {
    return { success: false, error: "Invalid doctrine ID" };
  }
  
  // Check if player has required materials
  const totalCost = {
    metalScrap: chassis.buildCost.metalScrap + doctrine.buildCostModifier.metalScrap,
    wood: chassis.buildCost.wood + doctrine.buildCostModifier.wood,
    chaosShards: chassis.buildCost.chaosShards + doctrine.buildCostModifier.chaosShards,
    steamComponents: chassis.buildCost.steamComponents + doctrine.buildCostModifier.steamComponents,
  };
  
  const resources = state.resources;
  if (resources.metalScrap < totalCost.metalScrap ||
      resources.wood < totalCost.wood ||
      resources.chaosShards < totalCost.chaosShards ||
      resources.steamComponents < totalCost.steamComponents) {
    return { success: false, error: "Insufficient materials" };
  }
  
  // Calculate final stability (clamped to 0-100)
  const finalStability = Math.max(0, Math.min(100, chassis.baseStability + doctrine.stabilityModifier));
  
  // Generate equipment ID
  const equipmentId = `built_${chassis.slotType}_${chassisId}_${doctrineId}_${Date.now()}`;
  
  // Generate procedural name: [Doctrine adjective] [Chassis name]
  const equipmentName = `${doctrine.name} ${chassis.name}`;
  
  // Create base equipment stats (v1: minimal stats, can be enhanced later)
  const baseStats = {
    atk: chassis.slotType === "weapon" ? 5 : 0,
    def: (chassis.slotType === "helmet" || chassis.slotType === "chestpiece") ? 3 : 0,
    agi: chassis.slotType === "accessory" ? 2 : 0,
    acc: 80,
    hp: 0,
  };
  
  // Create equipment based on slot type
  let equipment: Equipment;
  
  if (chassis.slotType === "weapon") {
    equipment = {
      id: equipmentId,
      name: equipmentName,
      slot: "weapon",
      weaponType: "sword", // Default - can be enhanced later
      isMechanical: true,
      stats: baseStats,
      cardsGranted: [], // Empty - will be filled by slotting in Customize Gear
      moduleSlots: 0,
      attachedModules: [],
      wear: 100,
      chassisId: chassisId,
      doctrineId: doctrineId,
      stability: finalStability,
      builderVersion: 1,
    } as WeaponEquipment;
  } else if (chassis.slotType === "helmet" || chassis.slotType === "chestpiece") {
    equipment = {
      id: equipmentId,
      name: equipmentName,
      slot: chassis.slotType,
      stats: baseStats,
      cardsGranted: [],
      chassisId: chassisId,
      doctrineId: doctrineId,
      stability: finalStability,
      builderVersion: 1,
    } as ArmorEquipment;
  } else {
    // accessory
    equipment = {
      id: equipmentId,
      name: equipmentName,
      slot: "accessory",
      stats: baseStats,
      cardsGranted: [],
      chassisId: chassisId,
      doctrineId: doctrineId,
      stability: finalStability,
      builderVersion: 1,
    } as AccessoryEquipment;
  }
  
  return { success: true, equipment };
}

/**
 * Get build cost for chassis + doctrine combination
 */
export function getBuildCost(chassisId: string, doctrineId: string): {
  metalScrap: number;
  wood: number;
  chaosShards: number;
  steamComponents: number;
} | null {
  const chassis = getChassisById(chassisId);
  const doctrine = getDoctrineById(doctrineId);
  
  if (!chassis || !doctrine) {
    return null;
  }
  
  return {
    metalScrap: chassis.buildCost.metalScrap + doctrine.buildCostModifier.metalScrap,
    wood: chassis.buildCost.wood + doctrine.buildCostModifier.wood,
    chaosShards: chassis.buildCost.chaosShards + doctrine.buildCostModifier.chaosShards,
    steamComponents: chassis.buildCost.steamComponents + doctrine.buildCostModifier.steamComponents,
  };
}

/**
 * Check if player has required materials
 */
export function canAffordBuild(chassisId: string, doctrineId: string, state: GameState): boolean {
  const cost = getBuildCost(chassisId, doctrineId);
  if (!cost) return false;
  
  const resources = state.resources;
  return resources.metalScrap >= cost.metalScrap &&
         resources.wood >= cost.wood &&
         resources.chaosShards >= cost.chaosShards &&
         resources.steamComponents >= cost.steamComponents;
}

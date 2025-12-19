// ============================================================================
// CHAOS CORE - ENDLESS GEAR TYPES
// Type definitions for procedural gear generation
// ============================================================================

import { Equipment } from "../equipment";
import { IntentTag } from "../../data/gearDoctrines";

/**
 * Crafting material IDs
 */
export type CraftingMaterialId = 
  | "metal_scrap"
  | "chaos_shard"
  | "steam_component"
  | "wood"
  | "crystal"
  | "medic_herb";

/**
 * Endless crafting recipe
 */
export interface EndlessRecipe {
  chassisId: string;
  materials: CraftingMaterialId[];
  seed?: number;
}

/**
 * Bias report - tracks how materials influenced generation
 */
export interface BiasReport {
  doctrineWeights: Record<string, number>; // doctrineId -> weight
  modTagWeights: Record<string, number>; // tag -> weight
  stabilityRange: { min: number; max: number };
  stabilityModifier: number; // Applied modifier from materials
  chosenDoctrine?: string;
  chosenMods: string[]; // Field mod IDs
  chosenStability: number;
  lockedCardCount: number;
  lockedCards: string[]; // Card IDs
  slotLockChance: number;
  slotsLocked: number;
}

/**
 * Provenance metadata for generated gear
 */
export interface EndlessGearProvenance {
  kind: "endless_crafted" | "endless_loot";
  recipe?: EndlessRecipe;
  seed: number;
  bias: BiasReport;
}

/**
 * Generated gear extends Equipment with provenance
 */
export interface GeneratedGear extends Equipment {
  provenance: EndlessGearProvenance;
  // Ensure these fields exist (from gear builder)
  chassisId: string;
  doctrineId: string;
  stability: number;
  builderVersion?: number;
  // Field mods stored as metadata (if system supports it)
  fieldMods?: string[]; // Field mod IDs
  // Locked cards
  lockedCards?: string[]; // Card IDs that are locked in slots
}

/**
 * Generation context - provides access to game data
 */
export interface GenerationContext {
  chassisRegistry: import("../../data/gearChassis").GearChassis[];
  doctrineRegistry: import("../../data/gearDoctrines").GearDoctrine[];
  fieldModRegistry: import("../fieldModDefinitions").FieldModDef[];
  cardCatalog: string[]; // All available card IDs
}

/**
 * Endless loot generation parameters
 */
export interface EndlessLootParams {
  slotType?: "weapon" | "helmet" | "chestpiece" | "accessory";
  minStability?: number;
  maxStability?: number;
  preferredDoctrineTags?: IntentTag[];
  seed?: number;
}


// src/core/types.ts

// ---------------------------------------------------------
//  CORE BATTLE TYPES
// ---------------------------------------------------------

import { GameState } from "./types";
import { getSettings } from "./settings";

export type UnitId = string;
export type CardId = string;
export type RoomId = string;

export type WeaponType =
  | "sword"
  | "greatsword"
  | "shortsword"
  | "bow"
  | "greatbow"
  | "gun"
  | "staff"
  | "greatstaff"
  | "dagger"
  | "knife"
  | "fist"
  | "rod"
  | "katana"
  | "shuriken"
  | "spear"
  | "instrument";

import { getStarterRecipeIds } from "../core/crafting";

export interface CardEffect {
  type: "damage" | "heal" | "move" | "buff";
  amount?: number;
}

export interface Card {
  id: CardId;
  name: string;
  description: string;
  strainCost: number;
  targetType: "enemy" | "self" | "tile";
  range?: number;
  effects: CardEffect[];
}

export interface Unit {
  id: UnitId;
  name: string;
  isEnemy: boolean;
  hp: number;
  maxHp: number;
  agi: number;
  pos: { x: number; y: number } | null;
  hand: CardId[];
  drawPile: CardId[];
  discardPile: CardId[];
  strain: number;
  unitClass?: string;
loadout?: {
  weapon: string | null;
  helmet: string | null;
  chestpiece: string | null;
  accessory1: string | null;
  accessory2: string | null;
};
  buffs?: Array<{
    id: string;
    type: "def_up" | "atk_up" | "agi_up" | string;
    amount: number;
    duration: number;
  }>;
}

export interface BattleTile {
  pos: { x: number; y: number };
  terrain: string;
}

export interface BattleState {
  roomId: RoomId;
  gridWidth: number;
  gridHeight: number;
  units: Record<UnitId, Unit>;
  turnOrder: UnitId[];
  turnIndex: number;
  turnCount: number;
  tiles: BattleTile[];
  log: string[];
  phase: "active" | "victory" | "defeat";
  rewards?: {
    wad: number;
    metalScrap: number;
    wood: number;
    chaosShards: number;
    steamComponents: number;
  };

  // 10za addition:
  loadPenalties?: LoadPenaltyFlags;
}

// ---------------------------------------------------------
//  OPERATION / WORLD
// ---------------------------------------------------------

export type RoomType = "tavern" | "battle" | "event" | "shop" | "rest" | "boss";

export interface RoomNode {
  id: RoomId;
  label: string;
  type?: RoomType;
  position?: { x: number; y: number };
  connections?: RoomId[];
  battleTemplate?: string; // ID of battle template from procedural.ts
  eventTemplate?: string;  // ID of event template from procedural.ts
  shopInventory?: string[]; // Equipment IDs available in shop
  visited?: boolean;
}

export interface Floor {
  id?: string;
  name: string;
  nodes?: RoomNode[];  // New name for rooms
  rooms?: RoomNode[];  // Keep for backwards compatibility
}

export interface OperationRun {
  id?: string;
  codename: string;
  description: string;
  floors: Floor[];
  currentFloorIndex: number;
  currentRoomId: RoomId | null;
}

export interface PlayerProfile {
  callsign: string;
  squadName: string;
  rosterUnitIds: UnitId[];
}

// ---------------------------------------------------------
//  INVENTORY
// ---------------------------------------------------------

export type MuleWeightClass = "E" | "D" | "C" | "B" | "A" | "S";

export interface InventoryItem {
  id: string;
  name: string;
  kind: "resource" | "equipment" | "consumable";
  stackable: boolean;
  quantity: number;
  massKg: number;
  bulkBu: number;
  powerW: number;
}

export interface InventoryState {
  muleClass: MuleWeightClass;
  capacityMassKg: number;
  capacityBulkBu: number;
  capacityPowerW: number;

  forwardLocker: InventoryItem[];
  baseStorage: InventoryItem[];
}

// 10za load penalty flags

export interface LoadPenaltyFlags {
  massOver: boolean;
  bulkOver: boolean;
  powerOver: boolean;
  massPct: number;
  bulkPct: number;
  powerPct: number;
}

// ---------------------------------------------------------
//  GAME STATE
// ---------------------------------------------------------

export interface GameState {
  phase: "shell" | "battle" | "map";
  profile: PlayerProfile;
  operation: OperationRun;
  unitsById: Record<UnitId, Unit>;
  cardsById: Record<CardId, Card>;
  partyUnitIds: UnitId[];
  
   // Card Library - all cards the player owns (Headline 11da)
  cardLibrary: Record<string, number>;  // cardId -> count owned
  
  // Gear Slots - card configurations for each piece of equipment
  gearSlots: Record<string, GearSlotData>;  // equipmentId -> slot config
  
  equipmentById?: Record<string, any>;
modulesById?: Record<string, any>;
equipmentPool?: string[];

  wad: number;

 knownRecipeIds: string[];           // Recipe IDs the player knows
  consumables: Record<string, number>; // Consumable ID -> quantity

  // Legacy numeric counters (kept for compatibility but not used in UI)
  resources: {
    metalScrap: number;
    wood: number;
    chaosShards: number;
    steamComponents: number;
  };

  inventory: InventoryState;

  currentBattle: BattleState | null;
}

interface GearSlotData {
  lockedCards: string[];    // Permanent cards that come with gear
  freeSlots: number;        // Number of customizable slots
  slottedCards: string[];   // Player-chosen cards in free slots
}

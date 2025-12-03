// src/core/types.ts

// ---------------------------------------------------------
//  CORE BATTLE TYPES
// ---------------------------------------------------------

export type UnitId = string;
export type CardId = string;
export type RoomId = string;

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

export interface RoomNode {
  id: RoomId;
  label: string;
}

export interface Floor {
  name: string;
  rooms: RoomNode[];
}

export interface OperationRun {
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

  wad: number;

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

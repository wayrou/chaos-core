// src/core/types.ts

// ---------------------------------------------------------
//  CORE BATTLE TYPES
// ---------------------------------------------------------

export type UnitId = string;
export type CardId = string;
export type RoomId = string;
export type PlayerId = "P1" | "P2";

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
  stats?: {
    maxHp: number;
    atk: number;
    def: number;
    agi: number;
    acc: number;
  };
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
  // Unit Performance System (Headline 14a)
  pwr?: number; // Personnel Warfare Rating
  affinities?: UnitAffinities; // Long-term affinity tracking
  // Local Co-op: Which player controls this unit
  controller?: "P1" | "P2";
  // Field Mods System - Hardpoints (run-scoped, stored in ActiveRunState)
  // Mount System
  mountInstanceId?: string;  // ID of the OwnedMount instance assigned to this unit
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

export type RoomType = "tavern" | "battle" | "event" | "shop" | "rest" | "boss" | "field_node" | "key_room" | "elite" | "treasure";

export interface RoomNode {
  id: RoomId;
  label: string;
  type?: RoomType;
  position?: { x: number; y: number };
  connections?: RoomId[];
  battleTemplate?: string; // ID of battle template from procedural.ts
  eventTemplate?: string;  // ID of event template from procedural.ts
  shopInventory?: string[]; // Equipment IDs available in shop
  fieldNodeSeed?: number;  // Seed for field_node room generation (Headline 14d)
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
  connections?: Record<string, string[]>; // nodeId -> connected nodeIds (for branching UI)
}

export interface PlayerProfile {
  callsign: string;
  squadName: string;
  rosterUnitIds: UnitId[];
}

export interface FieldAvatar {
  x: number;
  y: number;
  facing: "north" | "south" | "east" | "west";
}

export interface Player {
  id: PlayerId;
  active: boolean;
  color: string;
  inputSource: "keyboard1" | "keyboard2" | "gamepad1" | "gamepad2" | "none";
  avatar: FieldAvatar | null;
  controlledUnitIds: UnitId[];
}

// ============================================================================
// UNIT RECRUITMENT & PERFORMANCE SYSTEM (Headline 14a/14az)
// ============================================================================

/**
 * Affinity values for a unit (0-100 scale)
 * Tracks long-term combat preferences and specializations
 */
export interface UnitAffinities {
  melee: number;      // Melee attacks performed
  ranged: number;     // Ranged skills used
  magic: number;      // Spells cast
  support: number;    // Buffs/heals/shields applied
  mobility: number;   // Movement/mobility skills used
  survival: number;   // Damage taken and survived / operations completed
}

/**
 * Recruitment candidate unit (before hiring)
 */
export interface RecruitmentCandidate {
  id: string; // Temporary candidate ID
  name: string;
  portraitSeed?: string; // For appearance generation
  baseClass: string;
  currentClass: string;
  pwr: number;
  affinities: UnitAffinities;
  contractCost: number; // WAD cost for Standard Contract
  traits?: string[]; // 1-2 trait tags for display
  stats: {
    maxHp: number;
    atk: number;
    def: number;
    agi: number;
    acc: number;
  };
}

/**
 * Guild roster limits
 */
export const GUILD_ROSTER_LIMITS = {
  MAX_ACTIVE_PARTY: 10,
  MAX_TOTAL_MEMBERS: 30,
} as const;

// ---------------------------------------------------------
//  MOUNT SYSTEM
// ---------------------------------------------------------

export type MountId = string;

export type MountType =
  | "horse"      // Standard cavalry - balanced stats
  | "warhorse"   // Heavy cavalry - high HP, low AGI
  | "lizard"     // Reptilian mount - terrain flexibility
  | "mechanical" // Steam-powered - high stats, maintenance cost
  | "beast"      // Magical creature - special abilities
  | "bird";      // Flying mount - terrain ignore

export interface MountTerrainModifier {
  terrain: string;  // e.g. "mud", "plains", "forest", "water"
  effect: "ignore_penalty" | "bonus_movement" | "damage_reduction";
  value?: number;   // Amount for bonus_movement or damage_reduction
}

export interface MountStatModifiers {
  hp?: number;
  atk?: number;
  def?: number;
  agi?: number;
  acc?: number;
  movement?: number;  // Flat movement bonus
}

export type MountPassiveTrait =
  | "trample"        // Deal damage when moving through enemy tiles
  | "charge"         // Bonus damage when attacking after moving 3+ tiles
  | "surefooted"     // Immune to knockback/push effects
  | "swift"          // +1 movement on first turn
  | "armored"        // Reduce incoming damage by 1
  | "intimidate"     // Adjacent enemies have -10 ACC
  | "loyal"          // Mount cannot be removed by enemy effects
  | "heat_resistant" // Immune to burn status
  | "cold_resistant" // Immune to freeze status
  | "aquatic";       // Can traverse water tiles

export interface MountRestriction {
  type: "unit_class" | "armor_weight" | "unit_size";
  allowed?: string[];   // Allowed values (whitelist)
  disallowed?: string[]; // Disallowed values (blacklist)
}

/**
 * Mount definition - the template/data for a mount type
 */
export interface Mount {
  id: MountId;
  name: string;
  description: string;
  mountType: MountType;

  // Stat modifications applied when mounted
  statModifiers: MountStatModifiers;

  // Terrain-specific bonuses
  terrainModifiers: MountTerrainModifier[];

  // Passive traits/abilities
  passiveTraits: MountPassiveTrait[];

  // Cards added to unit's deck when mounted
  grantedCards: string[];

  // Restrictions on which units can use this mount
  restrictions: MountRestriction[];

  // Visual/flavor
  spriteId?: string;

  // Unlock/acquisition
  unlockCost?: number;         // WAD cost to unlock
  isStarterMount?: boolean;    // Available from game start
}

/**
 * Instance of a mount owned by the player
 * Tracks ownership and assignment state
 */
export interface OwnedMount {
  mountId: MountId;           // Reference to Mount definition
  instanceId: string;         // Unique instance ID
  assignedToUnitId: UnitId | null;  // Currently assigned unit
  condition?: number;         // 0-100, for wear/maintenance (mechanical mounts)
}

/**
 * Stable state - tracks unlocked mounts and assignments
 */
export interface StableState {
  unlockedMountIds: MountId[];        // Which mount types are unlocked
  ownedMounts: OwnedMount[];          // Mount instances the player owns
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
  phase: "shell" | "battle" | "map" | "field" | "loadout" | "operation";
  profile: PlayerProfile;
  operation: OperationRun | null;
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

  // Quest System
  quests?: import("../quests/types").QuestState;

  // Unit Recruitment System (Headline 14az)
  recruitmentCandidates?: RecruitmentCandidate[]; // Current pool of candidates at active recruitment hub

  // Local Co-op System
  players: {
    P1: Player;
    P2: Player;
  };

  // Port System - Base Camp Visit Tracking
  baseCampVisitIndex?: number; // Increments each time player enters base camp
  portManifest?: import("./portTrades").PortManifest; // Current port manifest
  portTradesRemaining?: number; // Tracks remaining normal trades this visit (max 2)

  // Quarters System
  quarters?: {
    mail?: import("./mailSystem").MailState;
    buffs?: import("./quartersBuffs").QuartersBuffsState;
    decor?: import("./decorSystem").DecorState;
    pinboard?: {
      completedOperations?: string[];
      failedOperations?: string[];
      log?: Array<{ timestamp: number; message: string }>;
    };
  };
  // Field Mods System - Run inventory (synced from ActiveRunState)
  runFieldModInventory?: import("./fieldMods").FieldModInstance[];
  
  // Gear Builder System - Unlock flags
  unlockedChassisIds?: string[];
  unlockedDoctrineIds?: string[];

  // Mount/Stable System
  stable?: StableState;
}

interface GearSlotData {
  lockedCards: string[];    // Permanent cards that come with gear
  freeSlots: number;        // Number of customizable slots
  slottedCards: string[];   // Player-chosen cards in free slots
}

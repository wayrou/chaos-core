import type { EquipmentCardType, EquipmentStats, WeaponType } from "../../core/equipment";
import type { EffectFlowDocument } from "../../core/effectFlow";
import type { FieldModScope, FieldModRarity, FieldModTrigger, FieldModStackMode } from "../../core/fieldMods";
import type { ResourceWallet } from "../../core/resources";
import type { CardEffect, InventoryItem } from "../../core/types";
import type { FieldMap } from "../../field/types";
import type { Quest } from "../../quests/types";

export type DialogueEffect = {
  type: "set_flag";
  key: string;
  value: string | number | boolean;
};

export type DialogueChoice = {
  id: string;
  text: string;
  targetNodeId: string;
  condition?: string;
  tags?: string[];
  effects?: DialogueEffect[];
  metadata?: Record<string, unknown>;
};

export type DialogueNode =
  | {
      id: string;
      type: "line";
      speaker: string;
      text: string;
      mood?: string;
      portraitKey?: string;
      sceneId?: string;
      condition?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
      nextNodeId?: string;
    }
  | {
      id: string;
      type: "choice_set";
      choices: DialogueChoice[];
    }
  | {
      id: string;
      type: "effect";
      effects: DialogueEffect[];
      nextNodeId?: string;
      condition?: string;
    }
  | {
      id: string;
      type: "jump";
      targetNodeId: string;
      condition?: string;
    }
  | {
      id: string;
      type: "end";
    };

export interface ImportedDialogue {
  id: string;
  title: string;
  sceneId: string;
  entryNodeId: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  nodes: DialogueNode[];
  source?: {
    rawSource: string;
  };
}

export interface ImportedItem extends InventoryItem {
  description?: string;
  iconPath?: string;
  archetype?: "standard" | "weapon_chassis";
  acquisition?: {
    startsWithPlayer?: boolean;
    havenShop?: {
      unlockFloor?: number;
      notes?: string;
    };
    fieldMapResource?: {
      mapId?: string;
      resourceNodeId?: string;
      notes?: string;
    };
    enemyDrop?: {
      enemyUnitIds?: string[];
      notes?: string;
    };
    otherSourcesNotes?: string;
  };
  weaponChassis?: {
    stability?: number;
    cardSlots?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface ImportedKeyItem extends InventoryItem {
  description?: string;
  iconPath?: string;
  questOnly?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ImportedFaction {
  id: string;
  name: string;
  description?: string;
}

export interface ImportedChassis {
  id: string;
  name: string;
  slotType: "weapon" | "helmet" | "chestpiece" | "accessory";
  baseMassKg: number;
  baseBulkBu: number;
  basePowerW: number;
  baseStability: number;
  maxCardSlots: number;
  allowedCardTags?: string[];
  allowedCardFamilies?: string[];
  description?: string;
  buildCost?: Partial<ResourceWallet>;
  unlockAfterFloor?: number;
  requiredQuestIds?: string[];
}

export interface ImportedDoctrine {
  id: string;
  name: string;
  shortDescription?: string;
  intentTags?: Array<"assault" | "skirmish" | "suppression" | "sustain" | "control" | "mobility">;
  stabilityModifier?: number;
  strainBias?: number;
  procBias?: number;
  buildCostModifier?: Partial<ResourceWallet>;
  doctrineRules?: string;
  description?: string;
  unlockAfterFloor?: number;
  requiredQuestIds?: string[];
}

export interface ImportedGear {
  id: string;
  name: string;
  description?: string;
  slot: "weapon" | "helmet" | "chestpiece" | "accessory";
  weaponType?: WeaponType;
  isMechanical?: boolean;
  stats: EquipmentStats;
  cardsGranted: string[];
  wear?: number;
  inventory?: {
    massKg: number;
    bulkBu: number;
    powerW: number;
    startingOwned?: boolean;
  };
  iconPath?: string;
  metadata?: Record<string, unknown>;
}

export interface ImportedCard {
  id: string;
  name: string;
  description: string;
  type: EquipmentCardType;
  rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
  category?: "attack" | "defense" | "utility" | "mobility" | "buff" | "debuff" | "steam" | "chaos";
  strainCost: number;
  targetType: "enemy" | "ally" | "self" | "tile";
  range: number;
  damage?: number;
  effects: CardEffect[];
  effectFlow?: EffectFlowDocument;
  sourceClassId?: string;
  sourceEquipmentId?: string;
  artPath?: string;
  metadata?: Record<string, unknown>;
}

export interface ImportedFieldMod {
  id: string;
  name: string;
  description: string;
  effects?: string;
  trigger: FieldModTrigger;
  chance?: number;
  stackMode: FieldModStackMode;
  maxStacks?: number;
  effectFlow?: EffectFlowDocument;
  scope: FieldModScope;
  cost?: number;
  rarity: FieldModRarity;
  unlockAfterOperationFloor?: number;
  requiredQuestIds?: string[];
}

export interface ImportedCodexEntry {
  id: string;
  title: string;
  entryType: "lore" | "faction" | "bestiary" | "tech";
  content: string;
  unlockAfterFloor?: number;
  requiredDialogueIds?: string[];
  requiredQuestIds?: string[];
  requiredGearIds?: string[];
  requiredItemIds?: string[];
  requiredSchemaIds?: string[];
  requiredFieldModIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportedMailEntry {
  id: string;
  category: "personal" | "official" | "system";
  from: string;
  subject: string;
  bodyPages: string[];
  unlockAfterFloor?: number;
  requiredDialogueIds?: string[];
  requiredGearIds?: string[];
  requiredItemIds?: string[];
  requiredSchemaIds?: string[];
  requiredFieldModIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportedChatterEntry {
  id: string;
  location: "black_market" | "tavern" | "port";
  content: string;
  aerissResponse: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ImportedClassDefinition {
  id: string;
  name: string;
  description: string;
  tier: 0 | 1 | 2 | 3;
  baseStats: {
    maxHp: number;
    atk: number;
    def: number;
    agi: number;
    acc: number;
  };
  weaponTypes: WeaponType[];
  unlockConditions: Array<{
    type: "always_unlocked" | "class_rank" | "quest_completed" | "milestone" | "special";
    requiredClassId?: string;
    requiredQuestId?: string;
    requiredRank?: number;
    description?: string;
  }>;
  innateAbility?: string;
  trainingGrid?: Array<{
    id: string;
    name: string;
    description: string;
    cost: number;
    row: number;
    col: number;
    requires?: string[];
    benefit?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface ImportedUnitTemplate {
  id: string;
  name: string;
  description?: string;
  faction?: string;
  currentClassId: string;
  spawnRole?: "player" | "enemy";
  enemySpawnFloorOrdinals?: number[];
  requiredQuestIds?: string[];
  stats: {
    maxHp: number;
    atk: number;
    def: number;
    agi: number;
    acc: number;
  };
  loadout: {
    primaryWeapon?: string;
    secondaryWeapon?: string;
    helmet?: string;
    chestpiece?: string;
    accessory1?: string;
    accessory2?: string;
  };
  traits?: string[];
  pwr?: number;
  recruitCost?: number;
  startingInRoster?: boolean;
  deployInParty?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ImportedOperationFloor {
  id: string;
  name: string;
  startingRoomId: string;
  rooms: Array<{
    id: string;
    label: string;
    type?: "tavern" | "battle" | "event" | "shop" | "rest" | "boss" | "field_node" | "key_room" | "elite" | "treasure";
    position: { x: number; y: number };
    connections?: string[];
    battleTemplate?: string;
    eventTemplate?: string;
    shopInventory?: string[];
    metadata?: Record<string, unknown>;
  }>;
}

export interface ImportedOperationDefinition {
  id: string;
  codename: string;
  description: string;
  recommendedPower?: number;
  floors: ImportedOperationFloor[];
  metadata?: Record<string, unknown>;
}

export interface ImportedNpcTemplate {
  id: string;
  name: string;
  faction?: string;
  mapId: string;
  x: number;
  y: number;
  routeMode: "fixed" | "random" | "none";
  routePoints?: Array<{
    id: string;
    x: number;
    y: number;
  }>;
  dialogueId?: string;
  portraitKey?: string;
  spriteKey?: string;
  portraitPath?: string;
  spritePath?: string;
  metadata?: Record<string, unknown>;
}

export interface ImportedFieldEnemyDefinition {
  id: string;
  name: string;
  description?: string;
  faction?: string;
  kind?: string;
  spriteKey?: string;
  spritePath?: string;
  stats: {
    maxHp: number;
    speed: number;
    aggroRange: number;
    width: number;
    height: number;
  };
  spawn: {
    mapIds?: string[];
    floorOrdinals?: number[];
    count?: number;
  };
  drops?: {
    wad?: number;
    resources?: Partial<ResourceWallet>;
    items?: Array<{
      id: string;
      quantity?: number;
      chance?: number;
    }>;
  };
  metadata?: Record<string, unknown>;
}

export type ImportedFieldMap = FieldMap;
export type ImportedQuest = Quest;

export type TechnicaContentType =
  | "dialogue"
  | "mail"
  | "chatter"
  | "quest"
  | "key_item"
  | "faction"
  | "chassis"
  | "doctrine"
  | "map"
  | "field_enemy"
  | "npc"
  | "item"
  | "gear"
  | "card"
  | "fieldmod"
  | "unit"
  | "operation"
  | "class"
  | "codex";

export interface DisabledTechnicaContent {
  id: string;
  contentType: TechnicaContentType;
  origin: "game";
  disabledAt: string;
}

export type ImportedBattleCard = ImportedCard;
export type ImportedOperation = ImportedOperationDefinition;

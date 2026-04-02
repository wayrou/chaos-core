import type { Equipment } from "../../core/equipment";
import type { ClassDefinition } from "../../core/classes";
import type { Card, CardEffect, InventoryItem, OperationRun, RoomNode, Floor, Unit } from "../../core/types";
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

export type ImportedFieldMap = FieldMap;
export type ImportedQuest = Quest;

export interface ImportedGearInventoryProfile {
  massKg: number;
  bulkBu: number;
  powerW: number;
  startingOwned: boolean;
}

export interface ImportedGear extends Equipment {
  description?: string;
  inventory?: ImportedGearInventoryProfile;
  metadata?: Record<string, unknown>;
}

export interface ImportedItem extends InventoryItem {
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ImportedBattleCard extends Card {
  type: "core" | "class" | "equipment" | "gambit";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  category: "attack" | "defense" | "utility" | "mobility" | "buff" | "debuff" | "steam" | "chaos";
  damage?: number;
  sourceClassId?: string;
  sourceEquipmentId?: string;
  metadata?: Record<string, unknown>;
}

export interface ImportedUnitTemplate {
  id: string;
  name: string;
  description?: string;
  currentClassId: string;
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

export interface ImportedOperationRoom extends RoomNode {
  metadata?: Record<string, unknown>;
}

export interface ImportedOperationFloor extends Floor {
  startingRoomId?: string;
  rooms?: ImportedOperationRoom[];
  nodes?: ImportedOperationRoom[];
}

export interface ImportedOperation extends OperationRun {
  recommendedPower?: number;
  floors: ImportedOperationFloor[];
  metadata?: Record<string, unknown>;
}

export interface ImportedClassUnlockCondition {
  type: "always_unlocked" | "class_rank" | "milestone" | "special";
  requiredClassId?: string;
  requiredRank?: number;
  description?: string;
}

export interface ImportedClassDefinition extends Omit<ClassDefinition, "id" | "unlockConditions"> {
  id: string;
  unlockConditions: ImportedClassUnlockCondition[];
  metadata?: Record<string, unknown>;
}

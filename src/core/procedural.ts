// ============================================================================
// PROCEDURAL GENERATION - Headline 13
// Random room variants, battle templates, events, and floor generation
// ============================================================================

import { Floor, RoomNode, RoomId, UnitId } from "./types";
import { getAllStarterEquipment } from "./equipment";

// ============================================================================
// TYPES
// ============================================================================

export type RoomType = "tavern" | "battle" | "event" | "shop" | "rest" | "boss" | "field_node";

export interface BattleTemplate {
  id: string;
  name: string;
  description: string;
  enemies: Array<{
    unitClass: string;
    count: number;
  }>;
  gridSize: { width: number; height: number };
  rewards: {
    wadMin: number;
    wadMax: number;
    equipmentChance: number; // 0-1
    resourcesMin: number;
    resourcesMax: number;
  };
}

export interface EventChoice {
  id: string;
  label: string;
  description: string;
  outcome: {
    type: "hp_trade" | "wad_trade" | "equipment" | "buff" | "debuff" | "resource";
    hpCost?: number;
    wadCost?: number;
    wadGain?: number;
    equipmentGain?: string;
    buff?: { stat: string; amount: number; duration: number };
    resourceGain?: { metalScrap?: number; wood?: number; chaosShards?: number; steamComponents?: number };
  };
}

export interface EventRoom {
  id: string;
  title: string;
  description: string;
  flavorText: string;
  choices: EventChoice[];
}

// ============================================================================
// BATTLE TEMPLATES
// ============================================================================

export const BATTLE_TEMPLATES: BattleTemplate[] = [
  {
    id: "skirmish_small",
    name: "Small Skirmish",
    description: "A handful of weak enemies",
    enemies: [
      { unitClass: "bandit", count: 2 },
      { unitClass: "scout", count: 1 },
    ],
    gridSize: { width: 8, height: 6 },
    rewards: {
      wadMin: 50,
      wadMax: 100,
      equipmentChance: 0.2,
      resourcesMin: 2,
      resourcesMax: 5,
    },
  },
  {
    id: "ambush_medium",
    name: "Ambush",
    description: "Enemy forces closing in from multiple sides",
    enemies: [
      { unitClass: "bandit", count: 3 },
      { unitClass: "archer", count: 2 },
    ],
    gridSize: { width: 10, height: 8 },
    rewards: {
      wadMin: 100,
      wadMax: 200,
      equipmentChance: 0.35,
      resourcesMin: 4,
      resourcesMax: 8,
    },
  },
  {
    id: "fortified_position",
    name: "Fortified Position",
    description: "Enemies dug in with defensive advantage",
    enemies: [
      { unitClass: "soldier", count: 2 },
      { unitClass: "archer", count: 2 },
      { unitClass: "bandit", count: 1 },
    ],
    gridSize: { width: 12, height: 8 },
    rewards: {
      wadMin: 150,
      wadMax: 250,
      equipmentChance: 0.5,
      resourcesMin: 6,
      resourcesMax: 12,
    },
  },
  {
    id: "elite_squad",
    name: "Elite Squad",
    description: "Well-trained enemy operatives",
    enemies: [
      { unitClass: "soldier", count: 3 },
      { unitClass: "mage", count: 1 },
    ],
    gridSize: { width: 10, height: 10 },
    rewards: {
      wadMin: 200,
      wadMax: 350,
      equipmentChance: 0.65,
      resourcesMin: 8,
      resourcesMax: 15,
    },
  },
  {
    id: "chaos_rift",
    name: "Chaos Rift Breach",
    description: "Enemies pouring through dimensional tear",
    enemies: [
      { unitClass: "bandit", count: 4 },
      { unitClass: "mage", count: 2 },
    ],
    gridSize: { width: 12, height: 10 },
    rewards: {
      wadMin: 250,
      wadMax: 400,
      equipmentChance: 0.75,
      resourcesMin: 10,
      resourcesMax: 20,
    },
  },
];

// ============================================================================
// EVENT ROOMS
// ============================================================================

export const EVENT_TEMPLATES: EventRoom[] = [
  {
    id: "event_mysterious_shrine",
    title: "Mysterious Shrine",
    description: "An ancient shrine pulses with chaotic energy",
    flavorText: "The shrine's inscription reads: 'Sacrifice to gain power.'",
    choices: [
      {
        id: "sacrifice_hp",
        label: "Sacrifice vitality (All units -10 HP)",
        description: "Offer life force for a powerful relic",
        outcome: {
          type: "hp_trade",
          hpCost: 10,
          equipmentGain: "random",
        },
      },
      {
        id: "leave_shrine",
        label: "Leave the shrine alone",
        description: "Walk away with your health intact",
        outcome: {
          type: "resource",
          resourceGain: { chaosShards: 2 },
        },
      },
    ],
  },
  {
    id: "event_wandering_merchant",
    title: "Wandering Merchant",
    description: "A mysterious trader offers a deal",
    flavorText: "'I have rare goods, but they don't come cheap...'",
    choices: [
      {
        id: "buy_equipment",
        label: "Buy equipment (150 WAD)",
        description: "Purchase a random piece of equipment",
        outcome: {
          type: "wad_trade",
          wadCost: 150,
          equipmentGain: "random",
        },
      },
      {
        id: "buy_resources",
        label: "Buy resources (100 WAD)",
        description: "Purchase crafting materials",
        outcome: {
          type: "wad_trade",
          wadCost: 100,
          resourceGain: { metalScrap: 5, wood: 5, chaosShards: 3 },
        },
      },
      {
        id: "decline_merchant",
        label: "Decline and move on",
        description: "Save your money",
        outcome: {
          type: "resource",
        },
      },
    ],
  },
  {
    id: "event_training_dummy",
    title: "Training Ground",
    description: "An abandoned training facility",
    flavorText: "The dummies are still intact. Practice could prove beneficial.",
    choices: [
      {
        id: "train_attack",
        label: "Practice offensive maneuvers",
        description: "All units gain +1 ATK for next 3 battles",
        outcome: {
          type: "buff",
          buff: { stat: "atk", amount: 1, duration: 3 },
        },
      },
      {
        id: "train_defense",
        label: "Practice defensive stance",
        description: "All units gain +1 DEF for next 3 battles",
        outcome: {
          type: "buff",
          buff: { stat: "def", amount: 1, duration: 3 },
        },
      },
      {
        id: "skip_training",
        label: "Skip training",
        description: "Conserve energy",
        outcome: {
          type: "resource",
        },
      },
    ],
  },
  {
    id: "event_supply_cache",
    title: "Hidden Supply Cache",
    description: "A stash of resources left behind",
    flavorText: "Looks like someone made camp here. They left in a hurry.",
    choices: [
      {
        id: "take_supplies",
        label: "Take everything",
        description: "Gather all available resources",
        outcome: {
          type: "resource",
          resourceGain: { metalScrap: 8, wood: 8, steamComponents: 3 },
        },
      },
      {
        id: "take_half",
        label: "Take half, leave the rest",
        description: "Be conservative",
        outcome: {
          type: "resource",
          resourceGain: { metalScrap: 4, wood: 4, steamComponents: 1 },
        },
      },
    ],
  },
];

// ============================================================================
// SHOP NODE INVENTORY
// ============================================================================

export function generateShopInventory(): string[] {
  const allEquipment = Object.values(getAllStarterEquipment());

  // Randomly select 6-10 items for the shop
  const shopSize = 6 + Math.floor(Math.random() * 5);
  const shuffled = [...allEquipment].sort(() => Math.random() - 0.5);

  return shuffled.slice(0, shopSize).map(eq => eq.id);
}

// ============================================================================
// EQUIPMENT REWARDS
// ============================================================================

export function rollEquipmentReward(): string | null {
  const allEquipment = Object.values(getAllStarterEquipment());
  const randomEquip = allEquipment[Math.floor(Math.random() * allEquipment.length)];
  return randomEquip.id;
}

export function calculateBattleRewards(template: BattleTemplate): {
  wad: number;
  equipment: string | null;
  resources: {
    metalScrap: number;
    wood: number;
    chaosShards: number;
    steamComponents: number;
  };
  unlockable?: string; // unlockable_id if awarded
} {
  const wad = template.rewards.wadMin + Math.floor(Math.random() * (template.rewards.wadMax - template.rewards.wadMin + 1));

  const equipment = Math.random() < template.rewards.equipmentChance
    ? rollEquipmentReward()
    : null;

  const resourceCount = template.rewards.resourcesMin + Math.floor(Math.random() * (template.rewards.resourcesMax - template.rewards.resourcesMin + 1));

  // Distribute resources randomly
  const resources = {
    metalScrap: Math.floor(Math.random() * resourceCount),
    wood: Math.floor(Math.random() * (resourceCount / 2)),
    chaosShards: Math.floor(Math.random() * (resourceCount / 3)),
    steamComponents: Math.floor(Math.random() * (resourceCount / 4)),
  };

  // Roll for unlockable reward (5% chance per battle)
  // Note: This function is not used in battle rewards (handled in battle.ts)
  // Keeping for potential future use
  let unlockable: string | undefined;

  return { wad, equipment, resources, unlockable };
}

/**
 * Roll a random unlockable reward (chassis, doctrine, or field mod)
 */
export async function rollUnlockableReward(): Promise<string | null> {
  const { getRewardEligibleUnlockables, getUnownedUnlockables } = await import("./unlockables");
  const { getAllOwnedUnlockableIds } = await import("./unlockableOwnership");
  
  const owned = getAllOwnedUnlockableIds();
  const allOwnedIds = [...owned.chassis, ...owned.doctrines];
  
  const eligible = getRewardEligibleUnlockables();
  const unowned = getUnownedUnlockables(allOwnedIds);
  
  if (unowned.length === 0) {
    return null; // Player owns everything
  }
  
  // Weight by rarity (common: 60%, uncommon: 30%, rare: 10%)
  const common = unowned.filter(u => u.rarity === "common");
  const uncommon = unowned.filter(u => u.rarity === "uncommon");
  const rare = unowned.filter(u => u.rarity === "rare" || u.rarity === "epic");
  
  const roll = Math.random();
  let pool: typeof unowned;
  
  if (roll < 0.6 && common.length > 0) {
    pool = common;
  } else if (roll < 0.9 && uncommon.length > 0) {
    pool = uncommon;
  } else if (rare.length > 0) {
    pool = rare;
  } else {
    pool = unowned; // Fallback to any available
  }
  
  const selected = pool[Math.floor(Math.random() * pool.length)];
  return selected ? selected.id : null;
}

// ============================================================================
// FLOOR GENERATION
// ============================================================================

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function generateFloor(
  floorNumber: number,
  floorCount: number
): Floor {
  const nodes: RoomNode[] = [];
  let nodeIdCounter = 0;

  // Starting room (tavern/safe room)
  nodes.push({
    id: `floor${floorNumber}_start` as RoomId,
    type: "tavern",
    label: floorNumber === 0 ? "Forward Outpost" : `Floor ${floorNumber + 1} Entrance`,
    position: { x: 0, y: 0 },
    connections: [],
  });

  // Generate 3-5 rooms per floor
  const roomCount = 3 + Math.floor(Math.random() * 3);

  for (let i = 0; i < roomCount; i++) {
    const isLastRoom = i === roomCount - 1;
    const isBossFloor = floorNumber === floorCount - 1;

    let roomType: RoomType;
    let label: string;
    let battleTemplate: string | undefined;
    let eventTemplate: string | undefined;

    // Last room of last floor is always boss
    if (isLastRoom && isBossFloor) {
      roomType = "boss";
      label = "Chaos Rift Core";
      battleTemplate = "elite_squad"; // Placeholder for boss
    }
    // Otherwise, random room type
    else {
      const roll = Math.random();

      if (roll < 0.35) {
        // 35% battle
        roomType = "battle";
        battleTemplate = randomChoice(BATTLE_TEMPLATES).id;
        label = randomChoice([
          "Hostile Territory",
          "Enemy Encampment",
          "Contested Zone",
          "Ambush Point",
          "Defensive Line",
        ]);
      } else if (roll < 0.55) {
        // 20% field_node (Mystery Dungeon rooms - Headline 14d)
        roomType = "field_node";
        label = randomChoice([
          "Exploration Zone",
          "Abandoned Sector",
          "Resource Cache",
          "Scavenger Grounds",
          "Hidden Passage",
        ]);
      } else if (roll < 0.70) {
        // 15% event
        roomType = "event";
        eventTemplate = randomChoice(EVENT_TEMPLATES).id;
        label = "???";
      } else if (roll < 0.85) {
        // 15% shop
        roomType = "shop";
        label = "Field Merchant";
      } else {
        // 15% rest
        roomType = "rest";
        label = "Safe Haven";
      }
    }

    const roomId = `floor${floorNumber}_room${i}` as RoomId;
    
    // Generate seed for field_node rooms
    const fieldNodeSeed = roomType === "field_node" 
      ? Math.floor(Math.random() * 1000000) 
      : undefined;

    nodes.push({
      id: roomId,
      type: roomType,
      label,
      position: { x: i + 1, y: 0 },
      connections: [],
      battleTemplate,
      eventTemplate,
      fieldNodeSeed,
    });

    // Connect to previous room
    if (i === 0) {
      nodes[0].connections!.push(roomId);
    } else {
      nodes[i].connections!.push(roomId);
    }
  }

  return {
    id: `floor_${floorNumber}`,
    name: `Floor ${floorNumber + 1}`,
    nodes,
  };
}

export function generateOperation(
  codename: string,
  description: string,
  floorCount: number = 3
): {
  id: string;
  codename: string;
  description: string;
  floors: Floor[];
  currentFloorIndex: number;
  currentRoomId: RoomId | null;
} {
  const floors: Floor[] = [];

  for (let i = 0; i < floorCount; i++) {
    floors.push(generateFloor(i, floorCount));
  }

  return {
    id: `op_${codename.toLowerCase().replace(/\s+/g, '_')}`,
    codename,
    description,
    floors,
    currentFloorIndex: 0,
    currentRoomId: floors[0].nodes[0].id,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getBattleTemplate(templateId: string): BattleTemplate | null {
  return BATTLE_TEMPLATES.find(t => t.id === templateId) || null;
}

export function getEventTemplate(templateId: string): EventRoom | null {
  return EVENT_TEMPLATES.find(e => e.id === templateId) || null;
}

export function canAdvanceToNextFloor(operation: {
  floors: Floor[];
  currentFloorIndex: number;
  currentRoomId: RoomId | null;
}): boolean {
  const currentFloor = operation.floors[operation.currentFloorIndex];
  if (!currentFloor) return false;

  const lastNode = currentFloor.nodes[currentFloor.nodes.length - 1];
  return operation.currentRoomId === lastNode.id;
}

export function advanceToNextFloor(operation: {
  floors: Floor[];
  currentFloorIndex: number;
  currentRoomId: RoomId | null;
}): {
  currentFloorIndex: number;
  currentRoomId: RoomId | null;
} {
  const nextFloorIndex = operation.currentFloorIndex + 1;

  if (nextFloorIndex >= operation.floors.length) {
    // Operation complete
    return {
      currentFloorIndex: operation.currentFloorIndex,
      currentRoomId: operation.currentRoomId,
    };
  }

  const nextFloor = operation.floors[nextFloorIndex];
  return {
    currentFloorIndex: nextFloorIndex,
    currentRoomId: nextFloor.nodes[0].id,
  };
}

// ============================================================================
// QUEST SYSTEM - QUEST DATA DEFINITIONS
// ============================================================================

import { Quest, QuestType, QuestDifficultyTier } from "./types";

/**
 * Quest database - all available quest definitions
 * TODO: Move to JSON file or external data source for easier editing
 */
export const QUEST_DATABASE: Record<string, Quest> = {
  // Tier 1 - Beginner Quests
  quest_hunt_scouts: {
    id: "quest_hunt_scouts",
    title: "Scout Patrol",
    description: "Eliminate 3 enemy scouts in the field. Standard engagement protocol.",
    questType: "hunt",
    difficultyTier: 1,
    objectives: [
      {
        id: "obj_kill_enemies",
        type: "kill_enemies",
        target: 3,
        current: 0,
        required: 3,
        description: "Defeat 3 enemies in battle",
      },
    ],
    rewards: {
      wad: 50,
      xp: 100,
      resources: {
        metalScrap: 5,
      },
    },
    status: "available",
  },

  quest_collect_metal: {
    id: "quest_collect_metal",
    title: "Scrap Collection",
    description: "Gather 10 Metal Scrap from field operations or battles.",
    questType: "collection",
    difficultyTier: 1,
    objectives: [
      {
        id: "obj_collect_metal",
        type: "collect_resource",
        target: "metalScrap",
        current: 0,
        required: 10,
        description: "Collect 10 Metal Scrap",
      },
    ],
    rewards: {
      wad: 30,
      resources: {
        metalScrap: 5, // Bonus on top of collected
      },
    },
    status: "available",
  },

  quest_clear_first_floor: {
    id: "quest_clear_first_floor",
    title: "Floor Clearance",
    description: "Complete all nodes on the first floor of an operation.",
    questType: "clear",
    difficultyTier: 1,
    objectives: [
      {
        id: "obj_clear_floor",
        type: "clear_node",
        target: "floor_1",
        current: 0,
        required: 1,
        description: "Clear all nodes on Floor 1",
      },
    ],
    rewards: {
      wad: 100,
      xp: 200,
      resources: {
        metalScrap: 10,
        wood: 5,
      },
    },
    status: "available",
  },

  // Tier 2 - Intermediate Quests
  quest_hunt_elite: {
    id: "quest_hunt_elite",
    title: "Elite Elimination",
    description: "Defeat 5 enemies in tactical battles. Focus on quality engagements.",
    questType: "hunt",
    difficultyTier: 2,
    objectives: [
      {
        id: "obj_kill_enemies",
        type: "kill_enemies",
        target: 5,
        current: 0,
        required: 5,
        description: "Defeat 5 enemies in battle",
      },
    ],
    rewards: {
      wad: 150,
      xp: 300,
      resources: {
        metalScrap: 10,
        wood: 5,
        chaosShards: 2,
      },
      cards: ["core_basic_attack"], // Example card reward
    },
    status: "available",
  },

  quest_delivery_equipment: {
    id: "quest_delivery_equipment",
    title: "Equipment Delivery",
    description: "Craft or acquire 1 piece of equipment and add it to your inventory.",
    questType: "delivery",
    difficultyTier: 2,
    objectives: [
      {
        id: "obj_acquire_equipment",
        type: "collect_item",
        target: "equipment",
        current: 0,
        required: 1,
        description: "Acquire 1 piece of equipment",
      },
    ],
    rewards: {
      wad: 200,
      resources: {
        steamComponents: 3,
      },
    },
    status: "available",
  },

  // Tier 3 - Advanced Quests
  quest_boss_hunt: {
    id: "quest_boss_hunt",
    title: "Boss Elimination",
    description: "Defeat a boss enemy in an operation. High risk, high reward.",
    questType: "hunt",
    difficultyTier: 3,
    objectives: [
      {
        id: "obj_kill_boss",
        type: "kill_specific_enemy",
        target: "boss",
        current: 0,
        required: 1,
        description: "Defeat 1 boss enemy",
      },
    ],
    rewards: {
      wad: 500,
      xp: 500,
      resources: {
        metalScrap: 20,
        wood: 10,
        chaosShards: 5,
        steamComponents: 5,
      },
      equipment: [], // Will be populated with random equipment
    },
    status: "available",
  },
};

/**
 * Get all available quests (not yet accepted)
 */
export function getAvailableQuests(): Quest[] {
  return Object.values(QUEST_DATABASE).filter(q => q.status === "available");
}

/**
 * Get quest by ID
 */
export function getQuestById(questId: QuestId): Quest | null {
  return QUEST_DATABASE[questId] || null;
}

/**
 * Generate a fresh copy of a quest (for accepting)
 */
export function cloneQuest(quest: Quest): Quest {
  return {
    ...quest,
    status: "active",
    acceptedAt: Date.now(),
    objectives: quest.objectives.map(obj => ({
      ...obj,
      current: 0, // Reset progress
    })),
  };
}




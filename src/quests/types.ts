// ============================================================================
// QUEST SYSTEM - TYPES
// ============================================================================

export type QuestId = string;
export type QuestStatus = "available" | "active" | "completed" | "failed";
export type QuestType = "hunt" | "escort" | "exploration" | "delivery" | "collection" | "clear";
export type QuestDifficultyTier = 1 | 2 | 3 | 4 | 5;

export type ObjectiveType = 
  | "kill_enemies" 
  | "kill_specific_enemy" 
  | "clear_node" 
  | "collect_item" 
  | "collect_resource"
  | "reach_location"
  | "talk_to_npc"
  | "complete_battle"
  | "spend_wad"
  | "craft_item";

export interface QuestObjective {
  id: string;
  type: ObjectiveType;
  target: string | number; // Enemy ID, item ID, resource type, count, etc.
  current: number;
  required: number;
  description: string;
}

export interface QuestReward {
  wad?: number;
  xp?: number; // Unit XP (distributed to party)
  resources?: {
    metalScrap?: number;
    wood?: number;
    chaosShards?: number;
    steamComponents?: number;
  };
  items?: Array<{
    id: string;
    quantity: number;
  }>;
  cards?: string[]; // Card IDs
  equipment?: string[]; // Equipment IDs
  unitRecruit?: string; // Unit ID to recruit
}

export interface Quest {
  id: QuestId;
  title: string;
  description: string;
  questType: QuestType;
  difficultyTier: QuestDifficultyTier;
  objectives: QuestObjective[];
  rewards: QuestReward;
  status: QuestStatus;
  acceptedAt?: number; // Timestamp when accepted
  completedAt?: number; // Timestamp when completed
  metadata?: Record<string, any>; // Additional quest data
}

export interface QuestState {
  availableQuests: Quest[];
  activeQuests: Quest[];
  completedQuests: QuestId[];
  failedQuests: QuestId[];
  maxActiveQuests: number;
}


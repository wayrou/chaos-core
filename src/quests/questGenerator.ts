// ============================================================================
// QUEST SYSTEM - RANDOM QUEST GENERATOR (Headline 15)
// Generates endless, randomly parameterized quests from templates
// ============================================================================

import { Quest, QuestObjective, QuestReward, QuestType, QuestDifficultyTier } from "./types";

// ============================================================================
// CONFIGURATION
// ============================================================================

const GENERATED_QUEST_PREFIX = "gen_quest_";
let questIdCounter = 0;

// Resource types for collection quests
const RESOURCE_TYPES = ["metalScrap", "wood", "chaosShards", "steamComponents"] as const;
type ResourceType = typeof RESOURCE_TYPES[number];

const RESOURCE_NAMES: Record<ResourceType, string> = {
  metalScrap: "Metal Scrap",
  wood: "Wood",
  chaosShards: "Chaos Shards",
  steamComponents: "Steam Components",
};

const RESOURCE_ICONS: Record<ResourceType, string> = {
  metalScrap: "🔩",
  wood: "🪵",
  chaosShards: "💎",
  steamComponents: "⚙️",
};

// ============================================================================
// QUEST TEMPLATES
// ============================================================================

interface QuestTemplate {
  id: string;
  questType: QuestType;
  titleTemplates: string[];
  descriptionTemplates: string[];
  objectiveType: QuestObjective["type"];
  // Ranges for random values
  minTarget: number;
  maxTarget: number;
  // Reward scaling (multiplied by target count)
  baseWad: number;
  wadPerTarget: number;
  baseXp: number;
  xpPerTarget: number;
  // Optional resource rewards
  resourceRewardChance: number;
  resourceRewardMin: number;
  resourceRewardMax: number;
  // Difficulty tier range
  minTier: QuestDifficultyTier;
  maxTier: QuestDifficultyTier;
}

const QUEST_TEMPLATES: QuestTemplate[] = [
  // Kill enemies quests
  {
    id: "kill_enemies",
    questType: "hunt",
    titleTemplates: [
      "Combat Patrol",
      "Enemy Sweep",
      "Hostiles Elimination",
      "Field Engagement",
      "Tactical Strike",
    ],
    descriptionTemplates: [
      "Defeat {target} enemies in tactical battles or field operations.",
      "Eliminate {target} hostile units. Any engagement counts.",
      "Engage and destroy {target} enemies. Standard combat protocols.",
      "Clear {target} hostiles from the operational area.",
    ],
    objectiveType: "kill_enemies",
    minTarget: 3,
    maxTarget: 15,
    baseWad: 20,
    wadPerTarget: 8,
    baseXp: 50,
    xpPerTarget: 15,
    resourceRewardChance: 0.6,
    resourceRewardMin: 2,
    resourceRewardMax: 8,
    minTier: 1,
    maxTier: 3,
  },
  
  // Complete battles quests
  {
    id: "complete_battles",
    questType: "hunt",
    titleTemplates: [
      "Battle Ready",
      "Combat Veteran",
      "Engagement Protocol",
      "Tactical Operations",
      "Front Line Duty",
    ],
    descriptionTemplates: [
      "Complete {target} tactical battles successfully.",
      "Win {target} combat engagements. Victory is required.",
      "Finish {target} battles with your squad intact.",
      "Demonstrate combat prowess in {target} separate battles.",
    ],
    objectiveType: "complete_battle",
    minTarget: 1,
    maxTarget: 5,
    baseWad: 40,
    wadPerTarget: 25,
    baseXp: 80,
    xpPerTarget: 40,
    resourceRewardChance: 0.7,
    resourceRewardMin: 3,
    resourceRewardMax: 12,
    minTier: 1,
    maxTier: 4,
  },
  
  // Collect resources quests (will be specialized per resource type)
  {
    id: "collect_metal",
    questType: "collection",
    titleTemplates: [
      "Scrap Salvage",
      "Metal Recovery",
      "Industrial Harvest",
      "Salvage Run",
      "Resource Extraction",
    ],
    descriptionTemplates: [
      "Gather {target} Metal Scrap from operations or field exploration.",
      "Collect {target} Metal Scrap. Battles and exploration both count.",
      "Secure {target} units of Metal Scrap for base operations.",
    ],
    objectiveType: "collect_resource",
    minTarget: 5,
    maxTarget: 30,
    baseWad: 15,
    wadPerTarget: 3,
    baseXp: 30,
    xpPerTarget: 5,
    resourceRewardChance: 0.4,
    resourceRewardMin: 2,
    resourceRewardMax: 6,
    minTier: 1,
    maxTier: 2,
  },
  
  {
    id: "collect_wood",
    questType: "collection",
    titleTemplates: [
      "Timber Harvest",
      "Wood Gathering",
      "Forest Salvage",
      "Material Collection",
    ],
    descriptionTemplates: [
      "Gather {target} Wood from field exploration or battles.",
      "Collect {target} Wood for base construction needs.",
      "Secure {target} units of Wood from the field.",
    ],
    objectiveType: "collect_resource",
    minTarget: 5,
    maxTarget: 25,
    baseWad: 15,
    wadPerTarget: 3,
    baseXp: 30,
    xpPerTarget: 5,
    resourceRewardChance: 0.4,
    resourceRewardMin: 2,
    resourceRewardMax: 6,
    minTier: 1,
    maxTier: 2,
  },
  
  {
    id: "collect_shards",
    questType: "collection",
    titleTemplates: [
      "Chaos Extraction",
      "Shard Hunt",
      "Arcane Harvest",
      "Power Collection",
    ],
    descriptionTemplates: [
      "Acquire {target} Chaos Shards from any source.",
      "Collect {target} Chaos Shards. These rare materials are in high demand.",
      "Gather {target} Chaos Shards for research purposes.",
    ],
    objectiveType: "collect_resource",
    minTarget: 3,
    maxTarget: 15,
    baseWad: 25,
    wadPerTarget: 6,
    baseXp: 50,
    xpPerTarget: 10,
    resourceRewardChance: 0.3,
    resourceRewardMin: 1,
    resourceRewardMax: 4,
    minTier: 2,
    maxTier: 3,
  },
  
  {
    id: "collect_steam",
    questType: "collection",
    titleTemplates: [
      "Component Salvage",
      "Tech Recovery",
      "Steam Harvest",
      "Mechanical Collection",
    ],
    descriptionTemplates: [
      "Gather {target} Steam Components from operations.",
      "Collect {target} Steam Components for workshop projects.",
      "Secure {target} Steam Components from the field.",
    ],
    objectiveType: "collect_resource",
    minTarget: 3,
    maxTarget: 12,
    baseWad: 25,
    wadPerTarget: 6,
    baseXp: 50,
    xpPerTarget: 10,
    resourceRewardChance: 0.3,
    resourceRewardMin: 1,
    resourceRewardMax: 4,
    minTier: 2,
    maxTier: 3,
  },
  
  // Clear floors quest
  {
    id: "clear_floors",
    questType: "clear",
    titleTemplates: [
      "Deep Dive",
      "Floor Clearance",
      "Dungeon Sweep",
      "Operation Complete",
      "Full Clear",
    ],
    descriptionTemplates: [
      "Clear {target} dungeon floor(s) completely.",
      "Complete all rooms on {target} floor(s) of any operation.",
      "Achieve full clearance on {target} operation floor(s).",
    ],
    objectiveType: "clear_node",
    minTarget: 1,
    maxTarget: 3,
    baseWad: 75,
    wadPerTarget: 50,
    baseXp: 150,
    xpPerTarget: 100,
    resourceRewardChance: 0.8,
    resourceRewardMin: 5,
    resourceRewardMax: 15,
    minTier: 2,
    maxTier: 4,
  },
  
  // Exploration quest (field nodes)
  {
    id: "explore_nodes",
    questType: "exploration",
    titleTemplates: [
      "Field Recon",
      "Exploration Mission",
      "Unknown Territory",
      "Scouting Run",
      "Discovery Protocol",
    ],
    descriptionTemplates: [
      "Explore {target} field node room(s) in operations.",
      "Complete exploration of {target} mystery dungeon room(s).",
      "Clear {target} field exploration zone(s).",
    ],
    objectiveType: "clear_node",
    minTarget: 1,
    maxTarget: 4,
    baseWad: 30,
    wadPerTarget: 20,
    baseXp: 60,
    xpPerTarget: 30,
    resourceRewardChance: 0.7,
    resourceRewardMin: 3,
    resourceRewardMax: 10,
    minTier: 1,
    maxTier: 3,
  },
];

// ============================================================================
// GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate a unique quest ID
 */
function generateQuestId(): string {
  questIdCounter++;
  return `${GENERATED_QUEST_PREFIX}${Date.now()}_${questIdCounter}`;
}

/**
 * Pick a random element from an array
 */
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Determine difficulty tier based on target value and template ranges
 */
function calculateTier(
  targetValue: number,
  minTarget: number,
  maxTarget: number,
  minTier: QuestDifficultyTier,
  maxTier: QuestDifficultyTier
): QuestDifficultyTier {
  const range = maxTarget - minTarget;
  const position = (targetValue - minTarget) / range;
  const tierRange = maxTier - minTier;
  const tier = Math.round(minTier + position * tierRange) as QuestDifficultyTier;
  return Math.max(minTier, Math.min(maxTier, tier)) as QuestDifficultyTier;
}

/**
 * Generate a random resource reward
 */
function generateResourceReward(
  template: QuestTemplate,
  targetValue: number
): QuestReward["resources"] | undefined {
  if (Math.random() > template.resourceRewardChance) {
    return undefined;
  }

  const resourceType = randomChoice(RESOURCE_TYPES);
  const baseAmount = randomInt(template.resourceRewardMin, template.resourceRewardMax);
  const scaledAmount = Math.ceil(baseAmount * (1 + targetValue * 0.1));

  return {
    [resourceType]: scaledAmount,
  } as QuestReward["resources"];
}

/**
 * Get the resource target type for collection quests
 */
function getResourceTarget(templateId: string): ResourceType | null {
  switch (templateId) {
    case "collect_metal": return "metalScrap";
    case "collect_wood": return "wood";
    case "collect_shards": return "chaosShards";
    case "collect_steam": return "steamComponents";
    default: return null;
  }
}

/**
 * Generate a single random quest
 */
export function generateRandomQuest(): Quest {
  // Pick a random template
  const template = randomChoice(QUEST_TEMPLATES);
  
  // Generate target value
  const targetValue = randomInt(template.minTarget, template.maxTarget);
  
  // Calculate tier
  const tier = calculateTier(
    targetValue,
    template.minTarget,
    template.maxTarget,
    template.minTier,
    template.maxTier
  );
  
  // Generate title and description
  const title = randomChoice(template.titleTemplates);
  const descriptionTemplate = randomChoice(template.descriptionTemplates);
  const description = descriptionTemplate.replace("{target}", targetValue.toString());
  
  // Calculate rewards
  const wad = Math.ceil(template.baseWad + template.wadPerTarget * targetValue);
  const xp = Math.ceil(template.baseXp + template.xpPerTarget * targetValue);
  
  // Generate resource reward
  const resourceReward = generateResourceReward(template, targetValue);
  
  // Build objective
  const resourceTarget = getResourceTarget(template.id);
  const objective: QuestObjective = {
    id: `obj_${template.id}`,
    type: template.objectiveType,
    target: resourceTarget || targetValue,
    current: 0,
    required: targetValue,
    description: description,
  };
  
  // Build rewards
  const rewards: QuestReward = {
    wad,
    xp,
  };
  
  if (resourceReward) {
    rewards.resources = resourceReward;
  }
  
  // Create quest
  const quest: Quest = {
    id: generateQuestId(),
    title,
    description,
    questType: template.questType,
    difficultyTier: tier,
    objectives: [objective],
    rewards,
    status: "active",
    acceptedAt: Date.now(),
    metadata: {
      isGenerated: true,
      templateId: template.id,
    },
  };
  
  return quest;
}

/**
 * Generate multiple random quests
 */
export function generateRandomQuests(count: number): Quest[] {
  const quests: Quest[] = [];
  const usedTemplates = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    // Try to use different templates for variety
    let attempts = 0;
    let quest: Quest;
    
    do {
      quest = generateRandomQuest();
      attempts++;
    } while (
      usedTemplates.has(quest.metadata?.templateId) && 
      attempts < 10 &&
      usedTemplates.size < QUEST_TEMPLATES.length
    );
    
    if (quest.metadata?.templateId) {
      usedTemplates.add(quest.metadata.templateId);
    }
    
    quests.push(quest);
  }
  
  return quests;
}

/**
 * Check if a quest is a generated quest (vs static database quest)
 */
export function isGeneratedQuest(quest: Quest): boolean {
  return quest.id.startsWith(GENERATED_QUEST_PREFIX) || quest.metadata?.isGenerated === true;
}









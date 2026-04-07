// ============================================================================
// QUEST SYSTEM - RANDOM QUEST GENERATOR
// Generates endless theater-aligned contracts from the current A.T.L.A.S. floor
// ============================================================================

import type { CoreType } from "../core/types";
import { loadOpsTerminalAtlasProgress } from "../core/opsTerminalAtlas";
import type { OpsTerminalAtlasSectorState } from "../core/opsTerminalAtlas";
import { Quest, QuestDifficultyTier, QuestObjective, QuestReward } from "./types";

const GENERATED_QUEST_PREFIX = "gen_quest_";
let questIdCounter = 0;

const CORE_OPTIONS: Array<{ coreType: CoreType; label: string }> = [
  { coreType: "command_center", label: "Command Center" },
  { coreType: "generator", label: "Generator" },
  { coreType: "supply_depot", label: "Supply Depot" },
  { coreType: "mine", label: "Mine" },
];

interface GenerationContext {
  floorOrdinal: number;
  floorLabel: string;
  sectors: OpsTerminalAtlasSectorState[];
}

interface GeneratedQuestTemplate {
  id: string;
  weight: number;
  factory: (context: GenerationContext) => Quest;
}

function generateQuestId(): string {
  questIdCounter += 1;
  return `${GENERATED_QUEST_PREFIX}${Date.now()}_${questIdCounter}`;
}

function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

function randomInt(min: number, max: number): number {
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return lower + Math.floor(Math.random() * (upper - lower + 1));
}

function pickWeightedTemplate(templates: GeneratedQuestTemplate[]): GeneratedQuestTemplate {
  const totalWeight = templates.reduce((sum, template) => sum + template.weight, 0);
  const roll = Math.random() * totalWeight;
  let cursor = 0;
  for (const template of templates) {
    cursor += template.weight;
    if (roll <= cursor) {
      return template;
    }
  }
  return templates[templates.length - 1];
}

function createReward(
  tier: QuestDifficultyTier,
  wadBase: number,
  wadBonus: number,
  resourceScale = 1,
): QuestReward {
  return {
    wad: wadBase + (tier * wadBonus),
    xp: 45 + (tier * 35),
    resources: {
      metalScrap: Math.max(2, Math.round((tier + 1) * resourceScale)),
      wood: Math.max(1, Math.round(tier * resourceScale)),
      chaosShards: tier >= 3 ? Math.max(1, Math.round(resourceScale)) : 0,
      steamComponents: tier >= 2 ? Math.max(1, Math.round(resourceScale)) : 0,
    },
  };
}

function getGenerationContext(): GenerationContext {
  const progress = loadOpsTerminalAtlasProgress();
  const atlas = progress.opsTerminalAtlas;
  const floors = Object.values(atlas?.floorsById ?? {});
  const floor =
    floors.find((entry) => entry.floorOrdinal === atlas?.currentFloorOrdinal)
    ?? floors[0]
    ?? {
      floorOrdinal: 1,
      floorLabel: "Floor 1",
      sectors: [],
    };

  return {
    floorOrdinal: floor.floorOrdinal,
    floorLabel: floor.floorLabel,
    sectors: floor.sectors ?? [],
  };
}

function formatSector(sector: OpsTerminalAtlasSectorState | undefined): string {
  if (!sector) {
    return "the current floor";
  }
  return `${sector.sectorLabel} // ${sector.zoneName}`;
}

function createSecureRoomsQuest(context: GenerationContext): Quest {
  const target = randomInt(5, 10);
  const tier = target >= 9 ? 3 : target >= 7 ? 2 : 1;
  const objective: QuestObjective = {
    id: "obj_secure_rooms_floor",
    type: "secure_rooms",
    target: `floor_${context.floorOrdinal}`,
    current: 0,
    required: target,
    description: `Secure ${target} rooms on ${context.floorLabel}`,
    criteria: {
      floorOrdinal: context.floorOrdinal,
    },
  };

  return {
    id: generateQuestId(),
    title: "Floor Sweep Contract",
    description: `H.A.V.E.N. wants more of ${context.floorLabel} under direct control before the next push.`,
    questType: "clear",
    difficultyTier: tier,
    objectives: [objective],
    rewards: createReward(tier, 70, 20, 2.25),
    status: "active",
    acceptedAt: Date.now(),
    metadata: {
      isGenerated: true,
      templateId: "secure_rooms_floor",
    },
  };
}

function createSectorBreachQuest(context: GenerationContext): Quest {
  const sector = randomChoice(context.sectors);
  const target = randomInt(3, 6);
  const tier = target >= 6 ? 3 : target >= 5 ? 2 : 1;
  const objective: QuestObjective = {
    id: "obj_secure_rooms_sector",
    type: "secure_rooms",
    target: sector?.sectorLabel ?? `floor_${context.floorOrdinal}`,
    current: 0,
    required: target,
    description: `Secure ${target} rooms in ${formatSector(sector)}`,
    criteria: {
      floorOrdinal: context.floorOrdinal,
      sectorLabel: sector?.sectorLabel,
    },
  };

  return {
    id: generateQuestId(),
    title: sector ? `${sector.zoneName} Breach` : "Sector Breach",
    description: `Push a controlled route into ${formatSector(sector)} and keep the aperture-side branch stable.`,
    questType: "exploration",
    difficultyTier: tier,
    objectives: [objective],
    rewards: createReward(tier, 80, 18, 2),
    status: "active",
    acceptedAt: Date.now(),
    metadata: {
      isGenerated: true,
      templateId: "secure_rooms_sector",
    },
  };
}

function createBuildCoreQuest(context: GenerationContext): Quest {
  const core = randomChoice(CORE_OPTIONS);
  const required = randomInt(1, 2);
  const tier = required === 2 ? 3 : core.coreType === "mine" || core.coreType === "generator" ? 2 : 1;
  const objective: QuestObjective = {
    id: "obj_build_core",
    type: "build_core",
    target: core.coreType,
    current: 0,
    required,
    description: `Build ${required} ${core.label} C.O.R.E.${required > 1 ? "s" : ""} on ${context.floorLabel}`,
    criteria: {
      floorOrdinal: context.floorOrdinal,
      coreType: core.coreType,
    },
  };

  return {
    id: generateQuestId(),
    title: `${core.label} Requisition`,
    description: `Logistics command is authorizing new ${core.label.toLowerCase()} builds on ${context.floorLabel}.`,
    questType: "delivery",
    difficultyTier: tier,
    objectives: [objective],
    rewards: createReward(tier, 90, 22, 2.5),
    status: "active",
    acceptedAt: Date.now(),
    metadata: {
      isGenerated: true,
      templateId: "build_core",
    },
  };
}

function createRoutePowerQuest(context: GenerationContext): Quest {
  const sector = randomChoice(context.sectors);
  const required = randomInt(35, 70);
  const tier = required >= 60 ? 4 : required >= 50 ? 3 : 2;
  const objective: QuestObjective = {
    id: "obj_route_power",
    type: "route_power",
    target: required,
    current: 0,
    required,
    description: `Route ${required} W to an objective room in ${formatSector(sector)}`,
    criteria: {
      floorOrdinal: context.floorOrdinal,
      sectorLabel: sector?.sectorLabel,
      roomTag: "objective",
    },
  };

  return {
    id: generateQuestId(),
    title: "Power Lane Contract",
    description: `Run a stable wattage lane into ${formatSector(sector)} so H.A.V.E.N. can sustain the branch.`,
    questType: "delivery",
    difficultyTier: tier,
    objectives: [objective],
    rewards: createReward(tier, 110, 24, 2.75),
    status: "active",
    acceptedAt: Date.now(),
    metadata: {
      isGenerated: true,
      templateId: "route_power",
    },
  };
}

function createCommsQuest(context: GenerationContext): Quest {
  const sector = randomChoice(context.sectors);
  const required = randomInt(24, 60);
  const tier = required >= 50 ? 4 : required >= 40 ? 3 : 2;
  const objective: QuestObjective = {
    id: "obj_establish_comms",
    type: "establish_comms",
    target: required,
    current: 0,
    required,
    description: `Establish ${required} BW in an objective room in ${formatSector(sector)}`,
    criteria: {
      floorOrdinal: context.floorOrdinal,
      sectorLabel: sector?.sectorLabel,
      roomTag: "objective",
    },
  };

  return {
    id: generateQuestId(),
    title: "Signal Spine Contract",
    description: `Extend manual-control bandwidth into ${formatSector(sector)} and hold the link.`,
    questType: "exploration",
    difficultyTier: tier,
    objectives: [objective],
    rewards: createReward(tier, 110, 26, 2.75),
    status: "active",
    acceptedAt: Date.now(),
    metadata: {
      isGenerated: true,
      templateId: "establish_comms",
    },
  };
}

function createSupplyQuest(context: GenerationContext): Quest {
  const sector = randomChoice(context.sectors);
  const required = randomInt(20, 50);
  const tier = required >= 40 ? 3 : required >= 30 ? 2 : 1;
  const objective: QuestObjective = {
    id: "obj_deliver_supply",
    type: "deliver_supply",
    target: required,
    current: 0,
    required,
    description: `Route ${required} crates/tick to an objective room in ${formatSector(sector)}`,
    criteria: {
      floorOrdinal: context.floorOrdinal,
      sectorLabel: sector?.sectorLabel,
      roomTag: "objective",
    },
  };

  return {
    id: generateQuestId(),
    title: "Supply Feed Contract",
    description: `Feed a working supply line into ${formatSector(sector)} before the theater goes cold.`,
    questType: "collection",
    difficultyTier: tier,
    objectives: [objective],
    rewards: createReward(tier, 90, 20, 2.5),
    status: "active",
    acceptedAt: Date.now(),
    metadata: {
      isGenerated: true,
      templateId: "deliver_supply",
    },
  };
}

function createSectorObjectiveQuest(context: GenerationContext): Quest {
  const required = randomInt(1, 3);
  const tier = required >= 3 ? 4 : required === 2 ? 3 : 2;
  const objective: QuestObjective = {
    id: "obj_complete_sector_objectives",
    type: "complete_sector_objectives",
    target: `floor_${context.floorOrdinal}`,
    current: 0,
    required,
    description: `Complete ${required} sector objective${required > 1 ? "s" : ""} on ${context.floorLabel}`,
    criteria: {
      floorOrdinal: context.floorOrdinal,
    },
  };

  return {
    id: generateQuestId(),
    title: "Ring Stabilization",
    description: `Bring more of ${context.floorLabel} online by completing additional sector objectives.`,
    questType: "clear",
    difficultyTier: tier,
    objectives: [objective],
    rewards: createReward(tier, 120, 28, 3),
    status: "active",
    acceptedAt: Date.now(),
    metadata: {
      isGenerated: true,
      templateId: "complete_sector_objectives",
    },
  };
}

const QUEST_TEMPLATES: GeneratedQuestTemplate[] = [
  { id: "secure_rooms_floor", weight: 3, factory: createSecureRoomsQuest },
  { id: "secure_rooms_sector", weight: 2, factory: createSectorBreachQuest },
  { id: "build_core", weight: 2, factory: createBuildCoreQuest },
  { id: "route_power", weight: 2, factory: createRoutePowerQuest },
  { id: "establish_comms", weight: 2, factory: createCommsQuest },
  { id: "deliver_supply", weight: 2, factory: createSupplyQuest },
  { id: "complete_sector_objectives", weight: 1, factory: createSectorObjectiveQuest },
];

export function generateRandomQuest(): Quest {
  const context = getGenerationContext();
  const template = pickWeightedTemplate(QUEST_TEMPLATES);
  return template.factory(context);
}

export function generateRandomQuests(count: number): Quest[] {
  const context = getGenerationContext();
  const quests: Quest[] = [];
  const usedTemplateIds = new Set<string>();

  for (let index = 0; index < count; index += 1) {
    let template = pickWeightedTemplate(QUEST_TEMPLATES);
    let attempts = 0;

    while (usedTemplateIds.has(template.id) && attempts < 10 && usedTemplateIds.size < QUEST_TEMPLATES.length) {
      template = pickWeightedTemplate(QUEST_TEMPLATES);
      attempts += 1;
    }

    usedTemplateIds.add(template.id);
    quests.push(template.factory(context));
  }

  return quests;
}

export function isGeneratedQuest(quest: Quest): boolean {
  return quest.id.startsWith(GENERATED_QUEST_PREFIX) || quest.metadata?.isGenerated === true;
}

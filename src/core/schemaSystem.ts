import {
  CoreBuildDefinition,
  CoreType,
  FortificationDefinition,
  FortificationPips,
  FortificationType,
  GameState,
  SchemaUnlockState,
  TheaterRoom,
  TheaterRoomTag,
} from "./types";

type ResourceWallet = GameState["resources"];

export const SCHEMA_STARTER_CORE_TYPES: CoreType[] = [
  "supply_depot",
  "command_center",
  "medical_ward",
  "armory",
  "mine",
  "generator",
  "refinery",
];

export const SCHEMA_STARTER_FORTIFICATION_TYPES: FortificationType[] = [
  "barricade",
  "powerRail",
  "waystation",
];

export const SCHEMA_CORE_BUILD_ORDER: CoreType[] = [
  "supply_depot",
  "command_center",
  "medical_ward",
  "armory",
  "mine",
  "generator",
  "logistics_hub",
  "prototype_systems_lab",
  "forward_maintenance_bay",
  "emergency_supply_cache",
  "forward_fire_support_post",
  "operations_planning_cell",
  "tactics_school",
  "quartermaster_cell",
  "stable",
  "fabrication_bay",
  "survey_array",
  "recovery_yard",
  "transit_hub",
  "tavern",
  "refinery",
];

export const SCHEMA_FORTIFICATION_ORDER: FortificationType[] = [
  "barricade",
  "powerRail",
  "bulkhead",
  "turret",
  "substation",
  "capacitor",
  "switchgear",
  "overcharger",
  "repeater",
  "sensorArray",
  "signalBooster",
  "waystation",
  "bridgeRig",
  "repairBench",
  "securityTerminal",
];

export const ROOM_TAG_LABELS: Record<string, string> = {
  ingress: "Ingress",
  uplink: "Base Camp Uplink",
  frontier: "Frontier",
  objective: "Objective",
  power_source: "Power Source",
  elite: "Elite Pressure",
  side_branch: "Side Branch",
  junction: "Junction",
  core_candidate: "C.O.R.E. Candidate",
  relay: "Relay Link",
  metal_rich: "Metal-Rich",
  timber_rich: "Timber-Rich",
  steam_vent: "Steam Vent",
  survey_highground: "Survey Highground",
  transit_junction: "Transit Junction",
  command_suitable: "Command Suitable",
  salvage_rich: "Salvage-Rich",
  medical_supplies: "Medical Supplies",
  stable_suitable: "Stable Suitable",
  tavern_suitable: "Tavern Suitable",
};

function withZeroIncome(incomePerTick?: Partial<ResourceWallet>): ResourceWallet {
  return {
    metalScrap: incomePerTick?.metalScrap ?? 0,
    wood: incomePerTick?.wood ?? 0,
    chaosShards: incomePerTick?.chaosShards ?? 0,
    steamComponents: incomePerTick?.steamComponents ?? 0,
  };
}

function addResourceWallet(base: ResourceWallet, delta: Partial<ResourceWallet>): ResourceWallet {
  return {
    metalScrap: base.metalScrap + (delta.metalScrap ?? 0),
    wood: base.wood + (delta.wood ?? 0),
    chaosShards: base.chaosShards + (delta.chaosShards ?? 0),
    steamComponents: base.steamComponents + (delta.steamComponents ?? 0),
  };
}

export const SCHEMA_CORE_DEFINITIONS: Record<CoreType, CoreBuildDefinition> = {
  supply_depot: {
    id: "supply_depot",
    displayName: "Supply Depot",
    shortCode: "SD",
    category: "logistics",
    description: "Logistics anchor that converts a live 100-watt power feed into a 100-crate supply relay for connected rooms.",
    operationalRequirements: {
      powerWatts: 100,
      commsBw: 0,
      supplyCrates: 0,
    },
    supplyOutputCrates: 100,
    buildCost: { metalScrap: 4, wood: 2 },
    upkeep: {},
    wadUpkeepPerTick: 6,
    incomePerTick: {},
    supportRadius: 1,
    unlockSource: "starter",
    preferredRoomTags: ["transit_junction"],
  },
  command_center: {
    id: "command_center",
    displayName: "Command Center",
    shortCode: "CC",
    category: "command",
    description: "Local control hub that relays a live uplink into a 100 BW comms lattice for connected rooms.",
    operationalRequirements: {
      powerWatts: 100,
      commsBw: 1,
      supplyCrates: 50,
    },
    commsOutputBw: 100,
    buildCost: { metalScrap: 2, chaosShards: 1, steamComponents: 1 },
    upkeep: {},
    wadUpkeepPerTick: 8,
    incomePerTick: {},
    supportRadius: 2,
    unlockSource: "starter",
    preferredRoomTags: ["command_suitable"],
  },
  medical_ward: {
    id: "medical_ward",
    displayName: "Medical Ward",
    shortCode: "MW",
    category: "support",
    description: "Casualty control and stabilization wing that keeps sustained pushes from collapsing.",
    operationalRequirements: {
      powerWatts: 50,
      commsBw: 0,
      supplyCrates: 50,
    },
    buildCost: { wood: 3, chaosShards: 1 },
    upkeep: {},
    wadUpkeepPerTick: 5,
    incomePerTick: {},
    supportRadius: 1,
    unlockSource: "starter",
    preferredRoomTags: ["medical_supplies"],
  },
  armory: {
    id: "armory",
    displayName: "Armory",
    shortCode: "AR",
    category: "combat",
    description: "Munitions support core that keeps connected squads battle-ready and aggressive.",
    operationalRequirements: {
      powerWatts: 25,
      commsBw: 0,
      supplyCrates: 100,
    },
    buildCost: { metalScrap: 3, steamComponents: 1 },
    upkeep: {},
    wadUpkeepPerTick: 7,
    incomePerTick: {},
    supportRadius: 1,
    unlockSource: "starter",
  },
  mine: {
    id: "mine",
    displayName: "Mine",
    shortCode: "MN",
    category: "industry",
    description: "Extraction core that turns secured sectors into a steady Metal Scrap and Timber stream.",
    operationalRequirements: {
      powerWatts: 50,
      commsBw: 0,
      supplyCrates: 50,
    },
    buildCost: { metalScrap: 3, wood: 2, steamComponents: 1 },
    upkeep: {},
    wadUpkeepPerTick: 4,
    incomePerTick: { metalScrap: 1, wood: 1 },
    supportRadius: 0,
    unlockSource: "starter",
    preferredRoomTags: ["metal_rich", "timber_rich"],
    tagOutputModifiers: [
      { tag: "metal_rich", output: { metalScrap: 2 }, note: "Mine +2 Metal Scrap/tick" },
      { tag: "timber_rich", output: { wood: 2 }, note: "Mine +2 Wood/tick" },
    ],
  },
  generator: {
    id: "generator",
    displayName: "Generator",
    shortCode: "GN",
    category: "command",
    description: "Strategic power relay that passes through incoming room power and adds +100 watts on top for connected rooms.",
    operationalRequirements: {
      powerWatts: 1,
      commsBw: 0,
      supplyCrates: 50,
    },
    powerOutputWatts: 100,
    powerOutputMode: "add_input",
    buildCost: { metalScrap: 3, steamComponents: 2 },
    upkeep: {},
    wadUpkeepPerTick: 6,
    incomePerTick: {},
    supportRadius: 0,
    unlockSource: "starter",
    preferredRoomTags: ["steam_vent"],
  },
  logistics_hub: {
    id: "logistics_hub",
    displayName: "Logistics Hub",
    shortCode: "LH",
    category: "logistics",
    description: "Placeholder logistics escalation facility for future supply-routing bonuses.",
    buildCost: { metalScrap: 5, wood: 3, steamComponents: 1 },
    upkeep: {},
    wadUpkeepPerTick: 10,
    incomePerTick: {},
    supportRadius: 2,
    unlockSource: "schema",
    unlockCost: { metalScrap: 6, wood: 4 },
    unlockWadCost: 40,
    preferredRoomTags: ["transit_junction"],
    placeholder: true,
  },
  prototype_systems_lab: {
    id: "prototype_systems_lab",
    displayName: "Prototype Systems Lab",
    shortCode: "PL",
    category: "research",
    description: "Placeholder research wing reserved for future experimental support systems.",
    buildCost: { metalScrap: 4, chaosShards: 3, steamComponents: 2 },
    upkeep: {},
    wadUpkeepPerTick: 11,
    incomePerTick: {},
    supportRadius: 1,
    unlockSource: "schema",
    unlockCost: { chaosShards: 3, steamComponents: 2 },
    unlockWadCost: 55,
    placeholder: true,
  },
  forward_maintenance_bay: {
    id: "forward_maintenance_bay",
    displayName: "Forward Maintenance Bay",
    shortCode: "MB",
    category: "support",
    description: "Placeholder repair-and-refit node for future equipment sustain.",
    buildCost: { metalScrap: 4, wood: 2, steamComponents: 2 },
    upkeep: {},
    wadUpkeepPerTick: 8,
    incomePerTick: {},
    supportRadius: 1,
    unlockSource: "schema",
    unlockCost: { metalScrap: 4, steamComponents: 2 },
    unlockWadCost: 36,
    placeholder: true,
  },
  emergency_supply_cache: {
    id: "emergency_supply_cache",
    displayName: "Emergency Supply Cache",
    shortCode: "EC",
    category: "logistics",
    description: "Placeholder reserve stockpile for future emergency resupply bursts.",
    buildCost: { wood: 4, metalScrap: 2 },
    upkeep: {},
    wadUpkeepPerTick: 5,
    incomePerTick: {},
    supportRadius: 1,
    unlockSource: "schema",
    unlockCost: { wood: 5, metalScrap: 2 },
    unlockWadCost: 28,
    placeholder: true,
  },
  forward_fire_support_post: {
    id: "forward_fire_support_post",
    displayName: "Forward Fire Support Post",
    shortCode: "FP",
    category: "combat",
    description: "Placeholder fire-support site for future bombardment and defense pressure tools.",
    buildCost: { metalScrap: 5, steamComponents: 2 },
    upkeep: {},
    wadUpkeepPerTick: 10,
    incomePerTick: {},
    supportRadius: 1,
    unlockSource: "schema",
    unlockCost: { metalScrap: 5, steamComponents: 2 },
    unlockWadCost: 48,
    placeholder: true,
  },
  operations_planning_cell: {
    id: "operations_planning_cell",
    displayName: "Operations Planning Cell",
    shortCode: "OP",
    category: "command",
    description: "Placeholder planning room for future route, threat, and support forecasting.",
    buildCost: { metalScrap: 3, chaosShards: 2 },
    upkeep: {},
    wadUpkeepPerTick: 8,
    incomePerTick: {},
    supportRadius: 2,
    unlockSource: "schema",
    unlockCost: { chaosShards: 2, metalScrap: 3 },
    unlockWadCost: 38,
    preferredRoomTags: ["command_suitable"],
    placeholder: true,
  },
  tactics_school: {
    id: "tactics_school",
    displayName: "Tactics School",
    shortCode: "TS",
    category: "support",
    description: "Placeholder doctrine-training facility for future unit progression support.",
    buildCost: { wood: 4, chaosShards: 1 },
    upkeep: {},
    wadUpkeepPerTick: 7,
    incomePerTick: {},
    supportRadius: 1,
    unlockSource: "schema",
    unlockCost: { wood: 4, chaosShards: 1 },
    unlockWadCost: 30,
    placeholder: true,
  },
  quartermaster_cell: {
    id: "quartermaster_cell",
    displayName: "Quartermaster Cell",
    shortCode: "QM",
    category: "logistics",
    description: "Placeholder procurement office for future supply efficiency bonuses.",
    buildCost: { metalScrap: 3, wood: 3 },
    upkeep: {},
    wadUpkeepPerTick: 7,
    incomePerTick: {},
    supportRadius: 1,
    unlockSource: "schema",
    unlockCost: { metalScrap: 3, wood: 3 },
    unlockWadCost: 32,
    placeholder: true,
  },
  stable: {
    id: "stable",
    displayName: "Stable",
    shortCode: "ST",
    category: "mobility",
    description: "Placeholder mount staging yard for future movement and convoy bonuses.",
    buildCost: { wood: 5, metalScrap: 2 },
    upkeep: {},
    wadUpkeepPerTick: 6,
    incomePerTick: {},
    supportRadius: 1,
    unlockSource: "schema",
    unlockCost: { wood: 5, metalScrap: 2 },
    unlockWadCost: 26,
    preferredRoomTags: ["stable_suitable", "transit_junction"],
    placeholder: true,
  },
  fabrication_bay: {
    id: "fabrication_bay",
    displayName: "Fabrication Bay",
    shortCode: "FB",
    category: "industry",
    description: "Placeholder fabrication shop for future on-site production effects.",
    buildCost: { metalScrap: 5, steamComponents: 2, wood: 1 },
    upkeep: {},
    wadUpkeepPerTick: 9,
    incomePerTick: {},
    supportRadius: 1,
    unlockSource: "schema",
    unlockCost: { metalScrap: 6, steamComponents: 2 },
    unlockWadCost: 44,
    placeholder: true,
  },
  survey_array: {
    id: "survey_array",
    displayName: "Survey Array",
    shortCode: "SV",
    category: "command",
    description: "Placeholder recon node for future theater scouting and reveal bonuses.",
    buildCost: { metalScrap: 2, chaosShards: 2, steamComponents: 1 },
    upkeep: {},
    wadUpkeepPerTick: 8,
    incomePerTick: {},
    supportRadius: 2,
    unlockSource: "schema",
    unlockCost: { chaosShards: 2, steamComponents: 1 },
    unlockWadCost: 34,
    preferredRoomTags: ["survey_highground"],
    placeholder: true,
  },
  recovery_yard: {
    id: "recovery_yard",
    displayName: "Recovery Yard",
    shortCode: "RY",
    category: "industry",
    description: "Placeholder salvage-processing yard for future post-battle recovery bonuses.",
    buildCost: { metalScrap: 3, wood: 2 },
    upkeep: {},
    wadUpkeepPerTick: 7,
    incomePerTick: {},
    supportRadius: 0,
    unlockSource: "schema",
    unlockCost: { metalScrap: 4, wood: 2 },
    unlockWadCost: 28,
    preferredRoomTags: ["salvage_rich"],
    placeholder: true,
  },
  transit_hub: {
    id: "transit_hub",
    displayName: "Transit Hub",
    shortCode: "TH",
    category: "mobility",
    description: "Placeholder movement hub for future travel-time smoothing and routing bonuses.",
    buildCost: { metalScrap: 4, wood: 3, steamComponents: 1 },
    upkeep: {},
    wadUpkeepPerTick: 9,
    incomePerTick: {},
    supportRadius: 2,
    unlockSource: "schema",
    unlockCost: { metalScrap: 4, wood: 3 },
    unlockWadCost: 36,
    preferredRoomTags: ["transit_junction"],
    placeholder: true,
  },
  tavern: {
    id: "tavern",
    displayName: "Tavern",
    shortCode: "TV",
    category: "civic",
    description: "Placeholder morale node for future recovery and contract-generation systems.",
    buildCost: { wood: 4, chaosShards: 1 },
    upkeep: {},
    wadUpkeepPerTick: 6,
    incomePerTick: {},
    supportRadius: 1,
    unlockSource: "schema",
    unlockCost: { wood: 4, chaosShards: 1 },
    unlockWadCost: 24,
    preferredRoomTags: ["tavern_suitable"],
    placeholder: true,
  },
  refinery: {
    id: "refinery",
    displayName: "Refinery",
    shortCode: "RF",
    category: "industry",
    description: "Processing core that distills theater throughput into a steady Steam Components stream.",
    operationalRequirements: {
      powerWatts: 50,
      commsBw: 0,
      supplyCrates: 50,
    },
    buildCost: { metalScrap: 4, steamComponents: 1, wood: 1 },
    upkeep: {},
    wadUpkeepPerTick: 7,
    incomePerTick: { steamComponents: 1 },
    supportRadius: 0,
    unlockSource: "starter",
    preferredRoomTags: ["steam_vent"],
    tagOutputModifiers: [
      { tag: "steam_vent", output: { steamComponents: 3 }, note: "Refinery +3 Steam Components/tick" },
    ],
    placeholder: false,
  },
};

export const SCHEMA_FORTIFICATION_DEFINITIONS: Record<FortificationType, FortificationDefinition> = {
  barricade: {
    id: "barricade",
    displayName: "Barricade",
    description: "Reduces frontier damage and is consumed first when a secured room is overwhelmed.",
    buildCost: { metalScrap: 2, wood: 2 },
    unlockSource: "starter",
    preferredRoomTags: ["frontier"],
  },
  powerRail: {
    id: "powerRail",
    displayName: "Power Rail",
    description: "Required for routing power through secured rooms.",
    buildCost: { metalScrap: 2, steamComponents: 1 },
    unlockSource: "starter",
    preferredRoomTags: ["power_source", "transit_junction"],
  },
  bulkhead: {
    id: "bulkhead",
    displayName: "Bulkhead",
    description: "Placeholder hard-seal fortification for future structural defense bonuses.",
    buildCost: { metalScrap: 3, wood: 1 },
    unlockSource: "schema",
    unlockCost: { metalScrap: 3, wood: 1 },
    unlockWadCost: 16,
    placeholder: true,
  },
  turret: {
    id: "turret",
    displayName: "Turret",
    description: "Placeholder defensive emplacement for future theater attack responses.",
    buildCost: { metalScrap: 3, steamComponents: 1 },
    unlockSource: "schema",
    unlockCost: { metalScrap: 4, steamComponents: 1 },
    unlockWadCost: 20,
    placeholder: true,
  },
  substation: {
    id: "substation",
    displayName: "Substation",
    description: "Placeholder power-routing node for future grid smoothing.",
    buildCost: { metalScrap: 2, steamComponents: 2 },
    unlockSource: "schema",
    unlockCost: { metalScrap: 2, steamComponents: 2 },
    unlockWadCost: 18,
    preferredRoomTags: ["steam_vent"],
    placeholder: true,
  },
  capacitor: {
    id: "capacitor",
    displayName: "Capacitor",
    description: "Placeholder charge reservoir for future burst power support.",
    buildCost: { metalScrap: 2, chaosShards: 1, steamComponents: 1 },
    unlockSource: "schema",
    unlockCost: { metalScrap: 2, chaosShards: 1 },
    unlockWadCost: 18,
    placeholder: true,
  },
  switchgear: {
    id: "switchgear",
    displayName: "Switchgear",
    description: "Placeholder routing control package for future dynamic network switching.",
    buildCost: { metalScrap: 2, steamComponents: 1 },
    unlockSource: "schema",
    unlockCost: { metalScrap: 2, steamComponents: 1 },
    unlockWadCost: 14,
    placeholder: true,
  },
  overcharger: {
    id: "overcharger",
    displayName: "Overcharger",
    description: "Placeholder power booster for future high-demand facility spikes.",
    buildCost: { metalScrap: 2, chaosShards: 1, steamComponents: 2 },
    unlockSource: "schema",
    unlockCost: { chaosShards: 1, steamComponents: 2 },
    unlockWadCost: 22,
    placeholder: true,
  },
  repeater: {
    id: "repeater",
    displayName: "Repeater",
    description: "Placeholder comms repeater for future visibility and warning coverage.",
    buildCost: { metalScrap: 1, steamComponents: 1 },
    unlockSource: "schema",
    unlockCost: { metalScrap: 1, steamComponents: 1 },
    unlockWadCost: 12,
    preferredRoomTags: ["survey_highground"],
    placeholder: true,
  },
  sensorArray: {
    id: "sensorArray",
    displayName: "Sensor Array",
    description: "Placeholder sensor package for future recon and threat detection.",
    buildCost: { metalScrap: 1, chaosShards: 1, steamComponents: 1 },
    unlockSource: "schema",
    unlockCost: { chaosShards: 1, steamComponents: 1 },
    unlockWadCost: 16,
    preferredRoomTags: ["survey_highground"],
    placeholder: true,
  },
  signalBooster: {
    id: "signalBooster",
    displayName: "Signal Booster",
    description: "Placeholder signal booster for future comms bandwidth bonuses.",
    buildCost: { metalScrap: 1, steamComponents: 1, wood: 1 },
    unlockSource: "schema",
    unlockCost: { steamComponents: 1, wood: 1 },
    unlockWadCost: 12,
    placeholder: true,
  },
  waystation: {
    id: "waystation",
    displayName: "Way Station",
    description: "Eliminates supply decay into and out of this room, preserving the logistics line through the route.",
    buildCost: { wood: 2, metalScrap: 2 },
    unlockSource: "starter",
    preferredRoomTags: ["transit_junction"],
    placeholder: false,
  },
  bridgeRig: {
    id: "bridgeRig",
    displayName: "Bridge Rig",
    description: "Placeholder structural kit for future route repair and reconnect effects.",
    buildCost: { metalScrap: 2, wood: 2 },
    unlockSource: "schema",
    unlockCost: { metalScrap: 2, wood: 2 },
    unlockWadCost: 14,
    preferredRoomTags: ["transit_junction"],
    placeholder: true,
  },
  repairBench: {
    id: "repairBench",
    displayName: "Repair Bench",
    description: "Placeholder maintenance fixture for future damage recovery.",
    buildCost: { metalScrap: 2, wood: 1, steamComponents: 1 },
    unlockSource: "schema",
    unlockCost: { metalScrap: 2, steamComponents: 1 },
    unlockWadCost: 16,
    placeholder: true,
  },
  securityTerminal: {
    id: "securityTerminal",
    displayName: "Security Terminal",
    description: "Placeholder command-security node for future defense responses and access control.",
    buildCost: { metalScrap: 1, chaosShards: 1, steamComponents: 1 },
    unlockSource: "schema",
    unlockCost: { chaosShards: 1, steamComponents: 1 },
    unlockWadCost: 18,
    preferredRoomTags: ["command_suitable"],
    placeholder: true,
  },
};

export function formatRoomTagLabel(tag: TheaterRoomTag): string {
  return ROOM_TAG_LABELS[tag] ?? String(tag).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getOrderedSchemaCoreTypes(): CoreType[] {
  return [...SCHEMA_CORE_BUILD_ORDER];
}

export function getOrderedSchemaFortificationTypes(): FortificationType[] {
  return [...SCHEMA_FORTIFICATION_ORDER];
}

export function createDefaultSchemaUnlockState(): SchemaUnlockState {
  return {
    unlockedCoreTypes: [...SCHEMA_STARTER_CORE_TYPES],
    unlockedFortificationPips: [...SCHEMA_STARTER_FORTIFICATION_TYPES],
    unlockedFieldAssetTypes: [],
  };
}

export function normalizeSchemaUnlockState(schema?: Partial<SchemaUnlockState> | null): SchemaUnlockState {
  const coreSet = new Set<CoreType>(SCHEMA_STARTER_CORE_TYPES);
  (schema?.unlockedCoreTypes ?? []).forEach((coreType) => {
    if (SCHEMA_CORE_BUILD_ORDER.includes(coreType)) {
      coreSet.add(coreType);
    }
  });

  const fortificationSet = new Set<FortificationType>(SCHEMA_STARTER_FORTIFICATION_TYPES);
  (schema?.unlockedFortificationPips ?? []).forEach((fortificationType) => {
    if (SCHEMA_FORTIFICATION_ORDER.includes(fortificationType)) {
      fortificationSet.add(fortificationType);
    }
  });

  return {
    unlockedCoreTypes: SCHEMA_CORE_BUILD_ORDER.filter((coreType) => coreSet.has(coreType)),
    unlockedFortificationPips: SCHEMA_FORTIFICATION_ORDER.filter((fortificationType) => fortificationSet.has(fortificationType)),
    unlockedFieldAssetTypes: [...new Set(schema?.unlockedFieldAssetTypes ?? [])],
  };
}

export function withNormalizedSchemaState<T extends GameState>(state: T): T {
  const normalized = normalizeSchemaUnlockState(state.schema);
  const current = state.schema;
  if (
    current
    && current.unlockedCoreTypes.length === normalized.unlockedCoreTypes.length
    && current.unlockedFortificationPips.length === normalized.unlockedFortificationPips.length
    && current.unlockedFieldAssetTypes.length === normalized.unlockedFieldAssetTypes.length
    && current.unlockedCoreTypes.every((coreType, index) => normalized.unlockedCoreTypes[index] === coreType)
    && current.unlockedFortificationPips.every((fortificationType, index) => normalized.unlockedFortificationPips[index] === fortificationType)
    && current.unlockedFieldAssetTypes.every((fieldAssetType, index) => normalized.unlockedFieldAssetTypes[index] === fieldAssetType)
  ) {
    return state;
  }

  return {
    ...state,
    schema: normalized,
  } as T;
}

export function getSchemaUnlockState(state: GameState): SchemaUnlockState {
  return normalizeSchemaUnlockState(state.schema);
}

export function isCoreTypeUnlocked(state: GameState, coreType: CoreType): boolean {
  return getSchemaUnlockState(state).unlockedCoreTypes.includes(coreType);
}

export function isFortificationUnlocked(state: GameState, fortificationType: FortificationType): boolean {
  return getSchemaUnlockState(state).unlockedFortificationPips.includes(fortificationType);
}

export function createEmptyFortificationPips(): FortificationPips {
  return Object.fromEntries(
    SCHEMA_FORTIFICATION_ORDER.map((fortificationType) => [fortificationType, 0]),
  ) as FortificationPips;
}

export function normalizeFortificationPips(
  pips?: Partial<FortificationPips> | null,
): FortificationPips {
  const normalized = createEmptyFortificationPips();
  SCHEMA_FORTIFICATION_ORDER.forEach((fortificationType) => {
    normalized[fortificationType] = Math.max(0, Number(pips?.[fortificationType] ?? 0));
  });
  return normalized;
}

export function getInstalledFortificationCount(pips: FortificationPips | Partial<FortificationPips> | null | undefined): number {
  return SCHEMA_FORTIFICATION_ORDER.reduce(
    (total, fortificationType) => total + Math.max(0, Number(pips?.[fortificationType] ?? 0)),
    0,
  );
}

export function getInstalledFortificationSummary(
  pips: FortificationPips | Partial<FortificationPips> | null | undefined,
): string[] {
  return SCHEMA_FORTIFICATION_ORDER
    .filter((fortificationType) => Number(pips?.[fortificationType] ?? 0) > 0)
    .map((fortificationType) => `${SCHEMA_FORTIFICATION_DEFINITIONS[fortificationType].displayName} x${Number(pips?.[fortificationType] ?? 0)}`);
}

export function getRoomTags(roomOrTags: TheaterRoom | TheaterRoomTag[] | null | undefined): TheaterRoomTag[] {
  const tags = Array.isArray(roomOrTags)
    ? roomOrTags
    : roomOrTags?.tags ?? [];
  return Array.from(new Set(tags));
}

export function roomHasTag(roomOrTags: TheaterRoom | TheaterRoomTag[] | null | undefined, tag: TheaterRoomTag): boolean {
  return getRoomTags(roomOrTags).includes(tag);
}

export function getCoreIncomeForRoom(coreType: CoreType, roomOrTags: TheaterRoom | TheaterRoomTag[] | null | undefined): ResourceWallet {
  const definition = SCHEMA_CORE_DEFINITIONS[coreType];
  let income = withZeroIncome(definition.incomePerTick);
  const tags = getRoomTags(roomOrTags);

  definition.tagOutputModifiers?.forEach((modifier) => {
    if (tags.includes(modifier.tag)) {
      income = addResourceWallet(income, modifier.output);
    }
  });

  return income;
}

export function getCoreSynergyLinesForRoom(coreType: CoreType, roomOrTags: TheaterRoom | TheaterRoomTag[] | null | undefined): string[] {
  const definition = SCHEMA_CORE_DEFINITIONS[coreType];
  const tags = getRoomTags(roomOrTags);

  return (definition.tagOutputModifiers ?? [])
    .filter((modifier) => tags.includes(modifier.tag))
    .map((modifier) => {
      const note = modifier.note ?? formatResourceWalletInline(modifier.output);
      return `${formatRoomTagLabel(modifier.tag)}: ${note}`;
    });
}

export function formatResourceWalletInline(delta: Partial<ResourceWallet>): string {
  const parts = [
    delta.metalScrap ? `+${delta.metalScrap} Metal Scrap/tick` : null,
    delta.wood ? `+${delta.wood} Wood/tick` : null,
    delta.chaosShards ? `+${delta.chaosShards} Chaos Shards/tick` : null,
    delta.steamComponents ? `+${delta.steamComponents} Steam Components/tick` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" / ") : "No resource output";
}

function hasEnoughResources(resources: ResourceWallet, cost?: Partial<ResourceWallet>): boolean {
  return (resources.metalScrap ?? 0) >= (cost?.metalScrap ?? 0)
    && (resources.wood ?? 0) >= (cost?.wood ?? 0)
    && (resources.chaosShards ?? 0) >= (cost?.chaosShards ?? 0)
    && (resources.steamComponents ?? 0) >= (cost?.steamComponents ?? 0);
}

function subtractResources(resources: ResourceWallet, cost?: Partial<ResourceWallet>): ResourceWallet {
  return {
    metalScrap: Math.max(0, resources.metalScrap - (cost?.metalScrap ?? 0)),
    wood: Math.max(0, resources.wood - (cost?.wood ?? 0)),
    chaosShards: Math.max(0, resources.chaosShards - (cost?.chaosShards ?? 0)),
    steamComponents: Math.max(0, resources.steamComponents - (cost?.steamComponents ?? 0)),
  };
}

type SchemaUnlockResult = {
  state: GameState;
  success: boolean;
  message: string;
};

export function unlockSchemaCoreTypeInState(state: GameState, coreType: CoreType): SchemaUnlockResult {
  const normalizedState = withNormalizedSchemaState(state);
  const definition = SCHEMA_CORE_DEFINITIONS[coreType];
  if (!definition) {
    return { state: normalizedState, success: false, message: "Unknown C.O.R.E. authorization." };
  }
  if (definition.unlockSource === "starter") {
    return { state: normalizedState, success: false, message: `${definition.displayName} is already authorized.` };
  }
  if (isCoreTypeUnlocked(normalizedState, coreType)) {
    return { state: normalizedState, success: false, message: `${definition.displayName} is already unlocked.` };
  }
  if ((normalizedState.wad ?? 0) < (definition.unlockWadCost ?? 0) || !hasEnoughResources(normalizedState.resources, definition.unlockCost)) {
    return { state: normalizedState, success: false, message: `Insufficient resources to authorize ${definition.displayName}.` };
  }

  const schema = getSchemaUnlockState(normalizedState);
  return {
    success: true,
    message: `${definition.displayName} authorized in S.C.H.E.M.A.`,
    state: {
      ...normalizedState,
      wad: Math.max(0, (normalizedState.wad ?? 0) - (definition.unlockWadCost ?? 0)),
      resources: subtractResources(normalizedState.resources, definition.unlockCost),
      schema: {
        ...schema,
        unlockedCoreTypes: [...schema.unlockedCoreTypes, coreType],
      },
    },
  };
}

export function unlockSchemaFortificationInState(state: GameState, fortificationType: FortificationType): SchemaUnlockResult {
  const normalizedState = withNormalizedSchemaState(state);
  const definition = SCHEMA_FORTIFICATION_DEFINITIONS[fortificationType];
  if (!definition) {
    return { state: normalizedState, success: false, message: "Unknown fortification authorization." };
  }
  if (definition.unlockSource === "starter") {
    return { state: normalizedState, success: false, message: `${definition.displayName} is already authorized.` };
  }
  if (isFortificationUnlocked(normalizedState, fortificationType)) {
    return { state: normalizedState, success: false, message: `${definition.displayName} is already unlocked.` };
  }
  if ((normalizedState.wad ?? 0) < (definition.unlockWadCost ?? 0) || !hasEnoughResources(normalizedState.resources, definition.unlockCost)) {
    return { state: normalizedState, success: false, message: `Insufficient resources to authorize ${definition.displayName}.` };
  }

  const schema = getSchemaUnlockState(normalizedState);
  return {
    success: true,
    message: `${definition.displayName} authorized in S.C.H.E.M.A.`,
    state: {
      ...normalizedState,
      wad: Math.max(0, (normalizedState.wad ?? 0) - (definition.unlockWadCost ?? 0)),
      resources: subtractResources(normalizedState.resources, definition.unlockCost),
      schema: {
        ...schema,
        unlockedFortificationPips: [...schema.unlockedFortificationPips, fortificationType],
      },
    },
  };
}

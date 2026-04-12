// ============================================================================
// INITIAL STATE - Updated with Equipment System (11b/11c)
// ============================================================================

import { getStarterRecipeIds } from "./crafting";
import { getImportedStarterItems } from "../content/technica";
import { createDefaultSchemaUnlockState } from "./schemaSystem";
import { createDefaultFoundryState } from "./foundrySystem";

import {
  getStarterCardLibrary,
} from "./gearWorkbench";

import {
  Card,
  CardEffect,
  CardId,
  Floor,
  GameState,
  OperationRun,
  PlayerProfile,
  RoomNode,
  Unit,
  UnitId,
} from "./types";

import {
  Equipment,
  UnitLoadout,
  UnitClass,
  Module,
  getAllStarterEquipment,
  getAllModules,
  getAllEquipmentCards,
  EquipmentCard,
} from "./equipment";
import {
  getAllImportedGear,
  getAllImportedOperations,
  getAllImportedUnits,
  getImportedOperation,
  isTechnicaContentDisabled,
} from "../content/technica";
import type { ImportedOperationDefinition, ImportedUnitTemplate } from "../content/technica/types";
import { calculatePWR } from "./pwr";
import { createDefaultAffinities } from "./affinity";
import { createEmptyResourceWallet } from "./resources";
import { createDefaultSessionState } from "./session";
import { createDefaultTheaterDeploymentPreset } from "./theaterDeploymentPreset";
import { createDefaultOuterDecksState } from "./outerDecks";
import { createDefaultWeaponsmithState } from "./weaponsmith";

/**
 * Convert EquipmentCard to the game's Card format for battle compatibility
 */
function equipmentCardToGameCard(eqCard: EquipmentCard): Card {
  const desc = eqCard.description.toLowerCase();

  // Determine target type based on card properties
  let targetType: "enemy" | "self" | "tile" | "ally" = "self";

  // Check for enemy-targeting indicators
  const isOffensive =
    (eqCard.damage && eqCard.damage > 0) ||
    desc.includes("deal") && desc.includes("damage") ||
    desc.includes("attack") ||
    desc.includes("hit") ||
    desc.includes("strike") ||
    desc.includes("shot") ||
    desc.includes("slash") ||
    desc.includes("stab") ||
    desc.includes("push target") ||
    desc.includes("pull target");

  // Check for ally-targeting
  const isAllyTarget =
    desc.includes("ally") ||
    desc.includes("restore") && desc.includes("ally") ||
    desc.includes("heal ally");

  // Check for movement/tile targeting
  const isTileTarget =
    desc.includes("move") && desc.includes("tile") ||
    desc.includes("reposition");

  if (isOffensive) {
    targetType = "enemy";
  } else if (isAllyTarget) {
    targetType = "ally";
  } else if (isTileTarget) {
    targetType = "tile";
  }

  // Parse range from string like "R(1-2)" or "R(1)" or "R(Self)"
  let range = 1;
  if (eqCard.range) {
    if (eqCard.range.toLowerCase().includes("self")) {
      range = 0;
      targetType = "self";
    } else {
      const match = eqCard.range.match(/R\((\d+)(?:-(\d+))?\)/);
      if (match) {
        range = parseInt(match[2] || match[1], 10);
      }
    }
  }

  // Build effects array with all detected effects
  const effects: CardEffect[] = [];

  // Damage
  if (eqCard.damage && eqCard.damage > 0) {
    effects.push({ type: "damage", amount: eqCard.damage });
  } else {
    const dmgMatch = desc.match(/deal\s+(\d+)\s+damage/i);
    if (dmgMatch) {
      effects.push({ type: "damage", amount: parseInt(dmgMatch[1], 10) });
    }
  }

  // Healing
  const healMatch = desc.match(/(?:restore|heal|recover)\s+(\d+)\s+hp/i);
  if (healMatch) {
    effects.push({ type: "heal", amount: parseInt(healMatch[1], 10) });
  }

  // DEF buff
  const defMatch = desc.match(/\+(\d+)\s+def/i) || desc.match(/gain\s+\+?(\d+)\s+def/i);
  if (defMatch) {
    effects.push({ type: "def_up", amount: parseInt(defMatch[1], 10), duration: 1 });
  }

  // ATK buff  
  const atkMatch = desc.match(/\+(\d+)\s+atk/i) || desc.match(/gain\s+\+?(\d+)\s+atk/i);
  if (atkMatch) {
    effects.push({ type: "atk_up", amount: parseInt(atkMatch[1], 10), duration: 1 });
  }

  // AGI buff
  const agiMatch = desc.match(/\+(\d+)\s+agi/i) || desc.match(/gain\s+\+?(\d+)\s+agi/i);
  if (agiMatch) {
    effects.push({ type: "agi_up", amount: parseInt(agiMatch[1], 10), duration: 1 });
  }

  // AGI debuff
  const agiDownMatch = desc.match(/-(\d+)\s+agi/i) || desc.match(/inflict\s+-?(\d+)\s+agi/i);
  if (agiDownMatch) {
    effects.push({ type: "agi_down", amount: parseInt(agiDownMatch[1], 10), duration: 1, stat: "agi" });
  }

  // ACC buff
  const accMatch = desc.match(/\+(\d+)\s+acc/i) || desc.match(/gain\s+\+?(\d+)\s+acc/i);
  if (accMatch) {
    effects.push({ type: "acc_up", amount: parseInt(accMatch[1], 10), duration: 1 });
  }

  // Stun
  if (desc.includes("stun")) {
    effects.push({ type: "stun", duration: 1 });
  }

  // Burn
  if (desc.includes("burn") || desc.includes("inflict burn")) {
    effects.push({ type: "burn", duration: 2 });
  }

  // Push
  const pushMatch = desc.match(/push\s+(?:target\s+)?(?:back\s+)?(\d+)\s+tile/i);
  if (pushMatch) {
    effects.push({ type: "push", amount: parseInt(pushMatch[1], 10) });
  }

  // End turn (for Wait card)
  if (eqCard.id === "core_wait" || eqCard.name.toLowerCase() === "wait") {
    effects.push({ type: "end_turn" });
  }

  return {
    id: eqCard.id,
    name: eqCard.name,
    description: eqCard.description,
    strainCost: eqCard.strainCost,
    targetType,
    range,
    effects,
  };
}

/**
 * Create all cards for the game - combines legacy cards with equipment cards
 */
function createAllCards(): Record<CardId, Card> {
  const cards: Record<CardId, Card> = {};

  // Add legacy cards for backwards compatibility
  const legacyCards: Card[] = [
    {
      id: "strike",
      name: "Strike",
      description: "Deal 5 damage to an adjacent enemy.",
      strainCost: 2,
      targetType: "enemy",
      range: 1,
      effects: [{ type: "damage", amount: 5 } as CardEffect],
    },
    {
      id: "lunge",
      name: "Lunge",
      description: "Deal 4 damage to an enemy up to 2 tiles away.",
      strainCost: 2,
      targetType: "enemy",
      range: 2,
      effects: [{ type: "damage", amount: 4 } as CardEffect],
    },
    {
      id: "brace",
      name: "Brace",
      description: "Gain strain to steel your nerves.",
      strainCost: 2,
      targetType: "self",
      range: 0,
      effects: [],
    },
  ];

  for (const card of legacyCards) {
    cards[card.id] = card;
  }

  // Add all equipment-based cards
  const equipmentCards = getAllEquipmentCards();
  for (const [id, eqCard] of Object.entries(equipmentCards)) {
    cards[id] = equipmentCardToGameCard(eqCard);
  }

  return cards;
}

/**
 * Extended Unit type with equipment loadout
 */
interface UnitWithEquipment extends Unit {
  classId?: UnitClass;
  unitClass: UnitClass;
  loadout: UnitLoadout;
  deck?: CardId[];
  description?: string;
  recruitCost?: number;
  startingInRoster?: boolean;
  deployInParty?: boolean;
  stats?: {
    maxHp: number;
    atk: number;
    def: number;
    agi: number;
    acc: number;
  };
  traits?: string[];
}

function createEmptyLoadout(): UnitLoadout {
  return {
    primaryWeapon: null,
    secondaryWeapon: null,
    helmet: null,
    chestpiece: null,
    accessory1: null,
    accessory2: null,
  };
}

function importedUnitToRuntimeUnit(unit: ImportedUnitTemplate): UnitWithEquipment | null {
  if (unit.spawnRole === "enemy" || (unit.startingInRoster === false && !unit.deployInParty)) {
    return null;
  }

  return {
    id: unit.id,
    name: unit.name,
    isEnemy: false,
    hp: unit.stats.maxHp,
    maxHp: unit.stats.maxHp,
    agi: unit.stats.agi,
    pos: null,
    hand: [],
    drawPile: [],
    discardPile: [],
    strain: 0,
    description: unit.description,
    classId: unit.currentClassId,
    unitClass: unit.currentClassId,
    stats: {
      maxHp: unit.stats.maxHp,
      atk: unit.stats.atk,
      def: unit.stats.def,
      agi: unit.stats.agi,
      acc: unit.stats.acc,
    },
    deck: [],
    // Fresh saves currently start with no equipped gear regardless of template defaults.
    loadout: createEmptyLoadout(),
    affinities: createDefaultAffinities(),
    pwr: unit.pwr,
    recruitCost: unit.recruitCost,
    startingInRoster: unit.startingInRoster ?? true,
    deployInParty: unit.deployInParty ?? false,
    traits: [...(unit.traits ?? [])],
  } as UnitWithEquipment;
}

/**
 * Starter units with equipment loadouts
 */
function createStarterUnits(): Record<UnitId, UnitWithEquipment> {
  // Legacy deck no longer used - decks are built from equipment
  const baseDeck: CardId[] = [];

  const equipmentById = getAllStarterEquipment();
  const modulesById = getAllModules();

  const units: UnitWithEquipment[] = [
    ...(isTechnicaContentDisabled("unit", "unit_aeriss") ? [] : [{
      "id": "unit_aeriss",
      "name": "Aeriss",
      "isEnemy": false,
      "hp": 9,
      "maxHp": 9,
      "agi": 3,
      "pos": null,
      "hand": [],
      "drawPile": [],
      "discardPile": [],
      "strain": 0,
      "classId": "squire",
      "unitClass": "squire",
      "stats": {
        "maxHp": 9,
        "atk": 7,
        "def": 3,
        "agi": 3,
        "acc": 90,
      },
      "deck": baseDeck,
      "loadout": {
        "primaryWeapon": "gear_quill_sword",
        "secondaryWeapon": null,
        "helmet": null,
        "chestpiece": null,
        "accessory1": null,
        "accessory2": null,
      },
      "affinities": createDefaultAffinities(),
      "startingInRoster": true,
      "deployInParty": true,
      "pwr": 14,
      "recruitCost": 0,
      "traits": [],
    }]),
  ];

  getAllImportedUnits().forEach((unit) => {
    const runtimeUnit = importedUnitToRuntimeUnit(unit);
    if (!runtimeUnit) {
      return;
    }

    const existingIndex = units.findIndex((candidate) => candidate.id === runtimeUnit.id);
    if (existingIndex >= 0) {
      units[existingIndex] = runtimeUnit;
    } else {
      units.push(runtimeUnit);
    }
  });

  // Calculate PWR for each unit
  const unitsWithPWR = units.map((u) => {
    const pwr = typeof u.pwr === "number"
      ? u.pwr
      : calculatePWR({
          unit: u,
          equipmentById,
          modulesById,
        });
    return { ...u, pwr, controller: "P1" as const }; // Default all units to P1
  });

  return Object.fromEntries(unitsWithPWR.map((u) => [u.id, u])) as Record<
    UnitId,
    UnitWithEquipment
  >;
}

function importedOperationToRuntimeOperation(operation: ImportedOperationDefinition): OperationRun {
  return {
    id: operation.id,
    codename: operation.codename,
    description: operation.description,
    currentFloorIndex: 0,
    currentRoomId: operation.floors[0]?.startingRoomId ?? operation.floors[0]?.rooms[0]?.id ?? null,
    floors: operation.floors.map((floor) => ({
      id: floor.id,
      name: floor.name,
      nodes: floor.rooms.map((room) => ({
        id: room.id,
        type: room.type,
        label: room.label,
        position: { x: room.position.x, y: room.position.y },
        connections: [...(room.connections ?? [])],
        battleTemplate: room.battleTemplate,
        eventTemplate: room.eventTemplate,
        shopInventory: [...(room.shopInventory ?? [])],
      })),
    })),
  };
}

function createOperationIronGate(): OperationRun {
  const importedOperation = getImportedOperation("op_iron_gate");
  if (importedOperation) {
    return importedOperationToRuntimeOperation(importedOperation);
  }

  if (isTechnicaContentDisabled("operation", "op_iron_gate")) {
    const firstImportedOperation = getAllImportedOperations()[0];
    if (firstImportedOperation) {
      return importedOperationToRuntimeOperation(firstImportedOperation);
    }
  }

  const nodes: RoomNode[] = [
    {
      id: "room_start",
      type: "tavern",
      label: "Forward Outpost",
      position: { x: 0, y: 0 },
      connections: ["room_battle_1"],
    },
    {
      id: "room_battle_1",
      type: "battle",
      label: "Collapsed Entrance",
      position: { x: 1, y: 0 },
      connections: ["room_battle_2"],
    },
    {
      id: "room_battle_2",
      type: "battle",
      label: "Inner Courtyard",
      position: { x: 2, y: 0 },
      connections: ["room_boss"],
    },
    {
      id: "room_boss",
      type: "boss",
      label: "Gateheart Core",
      position: { x: 3, y: 0 },
      connections: [],
    },
  ];

  const floor: Floor = {
    id: "floor_iron_gate_1",
    name: "Iron Gate - Approach",
    nodes,
    startingNodeId: "room_start",
  };

  const operation: OperationRun = {
    id: "op_iron_gate",
    codename: "IRON GATE",
    description: "Secure the Chaos Rift entrance.",
    currentFloorIndex: 0,
    floors: [floor],
    currentRoomId: "room_start",
  };

  return operation;
}

function createDefaultProfile(rosterUnitIds: UnitId[]): PlayerProfile {
  return {
    callsign: "AERISS",
    squadName: "Company of Quills",
    rosterUnitIds,
  };
}

/**
 * Create the equipment pool (all available equipment IDs)
 */
function createEquipmentPool(): string[] {
  return [];
}

function createImportedGearState(): {
  equipmentById: Record<string, Equipment>;
  equipmentPool: string[];
} {
  const runtimeEquipment = getAllStarterEquipment();
  const equipmentById: Record<string, Equipment> = {};
  const equipmentPool = new Set<string>();

  getAllImportedGear().forEach((gear) => {
    const runtimeGear = runtimeEquipment[gear.id];
    if (!runtimeGear) {
      return;
    }

    equipmentById[gear.id] = runtimeGear;
    if (gear.inventory?.startingOwned !== false) {
      equipmentPool.add(gear.id);
    }
  });

  return {
    equipmentById,
    equipmentPool: Array.from(equipmentPool),
  };
}

/**
 * Extended GameState with equipment system
 */
export interface GameStateWithEquipment extends GameState {
  equipmentById: Record<string, Equipment>;
  modulesById: Record<string, Module>;
  equipmentPool: string[];
}

const STARTING_WAD = 300;

/** Factory: create a brand new game state for a new run */
export function createNewGameState(): GameStateWithEquipment {
  const cardsById = createAllCards();
  const unitsById = createStarterUnits();

  const rosterUnitIds = Object.values(unitsById)
    .filter((unit) => (unit as UnitWithEquipment).startingInRoster !== false)
    .map((unit) => unit.id);
  const profile = createDefaultProfile(rosterUnitIds);
  const operation = createOperationIronGate();
  const importedStarterItems = getImportedStarterItems().map((item) => ({ ...item }));
  const partyUnitIds = Object.values(unitsById)
    .filter((unit) => (unit as UnitWithEquipment).deployInParty === true)
    .map((unit) => unit.id);

  // Equipment system data
  const importedGearState = createImportedGearState();
  const equipmentById: Record<string, Equipment> = { ...importedGearState.equipmentById };
  const modulesById = getAllModules();
  const equipmentPool = Array.from(new Set([
    ...createEquipmentPool(),
    ...importedGearState.equipmentPool,
  ]));





  const state: GameStateWithEquipment = {
    phase: "shell",
    profile,
    operation,
    session: createDefaultSessionState({
      wad: STARTING_WAD,
      resources: createEmptyResourceWallet(),
      operation,
      players: {
        P1: {
          id: "P1",
          slot: "P1",
          active: true,
          color: "#ff8a00",
          inputSource: "keyboard1",
          presence: "local",
          authorityRole: "local",
          avatar: null,
          controlledUnitIds: [],
        },
        P2: {
          id: "P2",
          slot: "P2",
          active: false,
          color: "#6849c2",
          inputSource: "none",
          presence: "inactive",
          authorityRole: "local",
          avatar: null,
          controlledUnitIds: [],
        },
      },
    }),
    lobby: null,
    unitsById: unitsById as unknown as Record<UnitId, Unit>,
    cardsById,
    partyUnitIds,
    theaterDeploymentPreset: createDefaultTheaterDeploymentPreset(partyUnitIds),

    wad: STARTING_WAD,
    resources: createEmptyResourceWallet(),
    schema: createDefaultSchemaUnlockState(),
    foundry: createDefaultFoundryState(),

    // Starter card library
    cardLibrary: Object.fromEntries(
      Object.entries(getStarterCardLibrary()).filter(
        ([cardId]) => !isTechnicaContentDisabled("card", cardId)
      )
    ),

    // Gear slots - will be populated as equipment is acquired
    gearSlots: {},

    // Crafting - starter recipes are known by default
    knownRecipeIds: getStarterRecipeIds(),

    // Consumables pouch - starts empty
    consumables: {},

    currentBattle: null,
    echoRun: null,

    inventory: {
      muleClass: "E",
      capacityMassKg: 50,
      capacityBulkBu: 35,
      capacityPowerW: 150,
      forwardLocker: [],
      baseStorage: importedStarterItems as any,
    },
    outerDecks: createDefaultOuterDecksState(),
    weaponsmith: createDefaultWeaponsmithState(),

    // 11b/11c Equipment system additions
    equipmentById,
    modulesById,
    equipmentPool,

    // Quest System
    quests: {
      availableQuests: [],
      activeQuests: [],
      completedQuests: [],
      failedQuests: [],
      maxActiveQuests: 5,
    },

    // Unit Recruitment System (Headline 14az)
    recruitmentCandidates: undefined, // Will be generated when Tavern is opened
    unitClassProgress: {},
    runFieldModInventory: [],
    unitHardpoints: {},

    // Local Co-op System - Initialize players
    players: {
      P1: {
        id: "P1",
        slot: "P1",
        active: true,
        color: "#ff8a00", // Orange for P1
        inputSource: "keyboard1",
        presence: "local",
        authorityRole: "local",
        avatar: null, // Will be set when entering field mode
        controlledUnitIds: [], // Will be populated when entering battle
      },
      P2: {
        id: "P2",
        slot: "P2",
        active: false,
        color: "#6849c2", // Purple for P2
        inputSource: "none",
        presence: "inactive",
        authorityRole: "local",
        avatar: null,
        controlledUnitIds: [],
      },
    },

    // Port System
    baseCampVisitIndex: 0,
    portManifest: undefined,
    portTradesRemaining: 2,

    // Dispatch / Expeditions
    dispatch: {
      missionSlots: 2,
      dispatchTick: 0,
      intelDossiers: 0,
      activeIntelBonus: 0,
      squadXpBank: 0,
      activeExpeditions: [],
      completedReports: [],
    },

    // Gear Builder System - Starter unlocks
    unlockedChassisIds: [
      "chassis_standard_rifle",
      "chassis_standard_helmet",
      "chassis_standard_chest",
      "chassis_utility_module",
    ],
    unlockedDoctrineIds: [
      "doctrine_balanced",
      "doctrine_skirmish",
      "doctrine_sustain",
    ],

    unlockedCodexEntries: [],
    completedDialogueIds: [],
  };

  // Initialize unit controllers to P1 by default
  for (const unitId of state.partyUnitIds) {
    const unit = state.unitsById[unitId];
    if (unit && !unit.isEnemy) {
      unit.controller = "P1";
      state.players.P1.controlledUnitIds.push(unitId);
    }
  }

  return state;
}

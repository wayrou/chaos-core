// ============================================================================
// INITIAL STATE - Updated with Equipment System (11b/11c)
// ============================================================================

import { getStarterRecipeIds } from "./crafting";

import { GameState } from "./types";
import { getSettings } from "./settings";

import { 
  getStarterCardLibrary, 
  getDefaultGearSlots,
  GearSlotData 
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
  UnitClassId,
  UnitId,
  InventoryState,
  MuleWeightClass,
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
  STARTER_WEAPONS,
  STARTER_HELMETS,
  STARTER_CHESTPIECES,
  STARTER_ACCESSORIES,
} from "./equipment";
import { calculatePWR } from "./pwr";
import { createDefaultAffinities } from "./affinity";

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
  unitClass: UnitClass;
  loadout: UnitLoadout;
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
    {
      id: "unit_aeriss",
      name: "Aeriss",
      classId: "vanguard" as UnitClassId,
      unitClass: "squire",
      stats: {
        maxHp: 30,
        atk: 7,
        def: 3,
        agi: 5,
        acc: 90,
      },
      deck: baseDeck,
      loadout: {
        weapon: "weapon_emberclaw_repeater", // Mechanical weapon for testing
        helmet: "armor_ironguard_helm",
        chestpiece: "armor_steelplate_cuirass",
        accessory1: "accessory_steel_signet_ring",
        accessory2: null,
      },
      affinities: createDefaultAffinities(),
    },
    {
      id: "unit_marksman_1",
      name: "Mistguard Marksman",
      classId: "marksman" as UnitClassId,
      unitClass: "ranger",
      stats: {
        maxHp: 22,
        atk: 6,
        def: 2,
        agi: 6,
        acc: 95,
      },
      deck: baseDeck,
      loadout: {
        weapon: "weapon_elm_recurve_bow",
        helmet: "armor_rangers_hood",
        chestpiece: "armor_leather_jerkin",
        accessory1: "accessory_eagle_eye_lens",
        accessory2: null,
      },
      affinities: createDefaultAffinities(),
    },
  ];

  // Calculate PWR for each unit
  const unitsWithPWR = units.map((u) => {
    const pwr = calculatePWR({
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

function createOperationIronGate(): OperationRun {
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

function createInitialInventory(): InventoryState {
  const muleClass: MuleWeightClass = "E";
  const capacityMassKg = 100;
  const capacityBulkBu = 70;
  const capacityPowerW = 300;

  return {
    muleClass,
    capacityMassKg,
    capacityBulkBu,
    capacityPowerW,
    forwardLocker: [],
    baseStorage: [],
  };
}

/**
 * Create the equipment pool (all available equipment IDs)
 */
function createEquipmentPool(): string[] {
  const pool: string[] = [];

  for (const w of STARTER_WEAPONS) {
    pool.push(w.id);
  }
  for (const h of STARTER_HELMETS) {
    pool.push(h.id);
  }
  for (const c of STARTER_CHESTPIECES) {
    pool.push(c.id);
  }
  for (const a of STARTER_ACCESSORIES) {
    pool.push(a.id);
  }

  return pool;
}

/**
 * Extended GameState with equipment system
 */
export interface GameStateWithEquipment extends GameState {
  equipmentById: Record<string, Equipment>;
  modulesById: Record<string, Module>;
  equipmentPool: string[];
}

/** Factory: create a brand new game state for a new run */
export function createNewGameState(): GameStateWithEquipment {
  const cardsById = createAllCards();
  const unitsById = createStarterUnits();

  const rosterUnitIds = Object.keys(unitsById);
  const profile = createDefaultProfile(rosterUnitIds);
  const operation = createOperationIronGate();

  // Equipment system data
  const equipmentById = getAllStarterEquipment();
  const modulesById = getAllModules();
  const equipmentPool = createEquipmentPool();
  
 
  


  const state: GameStateWithEquipment = {
    phase: "shell",
    profile,
    operation,
    unitsById: unitsById as unknown as Record<UnitId, Unit>,
    cardsById,
    partyUnitIds: ["unit_aeriss", "unit_marksman_1"],

    wad: 0,
    resources: {
      metalScrap: 0,
      wood: 0,
      chaosShards: 0,
      steamComponents: 0,
    },
	
	 // Starter card library
  cardLibrary: getStarterCardLibrary(),
  
  // Gear slots - will be populated as equipment is acquired
  gearSlots: {},
	
	   // Crafting - starter recipes are known by default
  knownRecipeIds: getStarterRecipeIds(),
  
  // Consumables pouch - starts empty
consumables: {},

    currentBattle: null,

    inventory: {
      muleClass: "E",
      capacityMassKg: 100,
      capacityBulkBu: 70,
      capacityPowerW: 300,
      forwardLocker: [],
      baseStorage: [],
    },

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

    // Local Co-op System - Initialize players
    players: {
      P1: {
        id: "P1",
        active: true,
        color: "#ff8a00", // Orange for P1
        inputSource: "keyboard1",
        avatar: null, // Will be set when entering field mode
        controlledUnitIds: [], // Will be populated when entering battle
      },
      P2: {
        id: "P2",
        active: false,
        color: "#6849c2", // Purple for P2
        inputSource: "none",
        avatar: null,
        controlledUnitIds: [],
      },
    },

    // Port System
    baseCampVisitIndex: 0,
    portManifest: undefined,
    portTradesRemaining: 2,
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
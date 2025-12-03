// src/core/initialState.ts
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


/**
 * Starter card pool for the prototype.
 */
function createStarterCards(): Record<CardId, Card> {
  const cards: Card[] = [
    {
      id: "strike",
      name: "Strike",
      description: "Deal 5 damage to an adjacent enemy.",
      strainCost: 2,
      targetType: "enemy",
      range: 1,
      effects: [
        { type: "damage", amount: 5 } as CardEffect,
      ],
    },
    {
      id: "lunge",
      name: "Lunge",
      description: "Deal 4 damage to an enemy up to 2 tiles away.",
      strainCost: 2,
      targetType: "enemy",
      range: 2,
      effects: [
        { type: "damage", amount: 4 } as CardEffect,
      ],
    },
    {
      id: "brace",
      name: "Brace",
      description: "Gain strain to steel your nerves.",
      strainCost: 2,
      targetType: "self",
      range: 0,
      effects: [], // we'll add real buffs later if you want
    },
  ];

  return Object.fromEntries(cards.map((c) => [c.id, c]));
}


/**
 * Starter units (Aeriss + a marksman) that use the starter cards.
 */
function createStarterUnits(
  cardsById: Record<CardId, Card>
): Record<UnitId, Unit> {
  // Simple shared deck; filter to make sure the IDs exist
const baseDeck: CardId[] = ["strike", "strike", "lunge", "brace"].filter(
  (id) => !!cardsById[id]
);


  const units: Unit[] = [
    {
      id: "unit_aeriss",
      name: "Aeriss",
      classId: "vanguard" as UnitClassId,
      stats: {
        maxHp: 30,
        atk: 7,
        def: 3,
        agi: 5,
        acc: 90,
      },
      deck: baseDeck,
    },
    {
      id: "unit_marksman_1",
      name: "Mistguard Marksman",
      classId: "marksman" as UnitClassId,
      stats: {
        maxHp: 22,
        atk: 6,
        def: 2,
        agi: 6,
        acc: 95,
      },
      deck: baseDeck,
    },
  ];

  return Object.fromEntries(units.map((u) => [u.id, u]));
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
    name: "Iron Gate – Approach",
    nodes,
    startingNodeId: "room_start",
  };

  const operation: OperationRun = {
    id: "op_iron_gate",
    codename: "IRON GATE",
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
    resources: {
      credits: 100,
      intel: 0,
    },
    rosterUnitIds,
  };
}

function createInitialInventory(): InventoryState {
  const muleClass: MuleWeightClass = "E";

  // Base caps for class E; tweak later as needed.
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


/** Factory: create a brand new game state for a new run */
export function createNewGameState(): GameState {
  const cardsById = createStarterCards();
  const unitsById = createStarterUnits(cardsById);

  const rosterUnitIds = Object.keys(unitsById);
  const profile = createDefaultProfile(rosterUnitIds);
  const operation = createOperationIronGate();

  const state: GameState = {
    phase: "shell",
    profile,
    operation,
    unitsById,
    cardsById,
    partyUnitIds: ["unit_aeriss", "unit_marksman_1"],

    // your meta-resources
    wad: 0,
    resources: {
      metalScrap: 0,
      wood: 0,
      chaosShards: 0,
      steamComponents: 0,
    },

    currentBattle: null,
	
inventory: {
  muleClass: "E",
  capacityMassKg: 100,
  capacityBulkBu: 70,
  capacityPowerW: 300,
  forwardLocker: [],
  baseStorage: [],
},


	
  };

  return state;
}
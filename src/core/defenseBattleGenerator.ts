// ============================================================================
// CHAOS CORE - DEFENSE BATTLE GENERATOR
// Creates defense battle encounters for Key Room attacks
// ============================================================================

import { GameState } from "./types";
import { BattleState, BattleUnitState, createGrid, createBattleUnitState, calculateMaxUnitsPerSide } from "./battle";
import { getAllStarterEquipment, getAllModules } from "./equipment";
import { generateElevationMap } from "./isometric";
import { computeLoadPenaltyFlags } from "./inventory";
import { triggerBattleStart } from "./fieldModBattleIntegration";
import { EncounterDefinition } from "./campaign";

// ----------------------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------------------

const DEFENSE_BATTLE_CONFIG = {
  minEnemies: 3,
  maxEnemies: 5,
  gridWidthMin: 5,
  gridWidthMax: 7,
  gridHeightMin: 4,
  gridHeightMax: 6,
};

// Enemy templates for defense battles (stronger than normal)
const DEFENSE_ENEMY_TEMPLATES = [
  {
    id: "defense_raider",
    name: "Raider",
    stats: { maxHp: 20, atk: 5, def: 2, agi: 4, acc: 75 },
    deck: ["core_basic_attack", "core_basic_attack", "core_guard"],
  },
  {
    id: "defense_enforcer",
    name: "Enforcer",
    stats: { maxHp: 30, atk: 6, def: 4, agi: 3, acc: 70 },
    deck: ["core_basic_attack", "core_basic_attack", "core_basic_attack", "core_guard"],
  },
  {
    id: "defense_berserker",
    name: "Berserker",
    stats: { maxHp: 25, atk: 8, def: 1, agi: 5, acc: 80 },
    deck: ["core_basic_attack", "core_basic_attack", "core_basic_attack"],
  },
];

// ----------------------------------------------------------------------------
// SEEDED RNG (same as in other generators)
// ----------------------------------------------------------------------------

interface SeededRNG {
  nextInt(min: number, max: number): number;
  nextFloat(): number;
}

function createSeededRNG(seed: string): SeededRNG {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  let state = Math.abs(hash) || 1;

  return {
    nextInt(min: number, max: number): number {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      const normalized = state / 0x7fffffff;
      return Math.floor(min + normalized * (max - min + 1));
    },
    nextFloat(): number {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    },
  };
}

// ----------------------------------------------------------------------------
// DEFENSE ENCOUNTER GENERATION
// ----------------------------------------------------------------------------

/**
 * Generate a defense encounter definition
 */
export function generateDefenseEncounter(
  floorIndex: number,
  encounterSeed: string
): EncounterDefinition {
  const rng = createSeededRNG(encounterSeed);

  // Scale enemy count by floor
  const baseEnemies = DEFENSE_BATTLE_CONFIG.minEnemies + Math.floor(floorIndex * 0.5);
  const enemyCount = Math.min(
    DEFENSE_BATTLE_CONFIG.maxEnemies,
    baseEnemies + rng.nextInt(0, 1)
  );

  // Select enemy types
  const enemyUnits: EncounterDefinition["enemyUnits"] = [];

  for (let i = 0; i < enemyCount; i++) {
    const templateIndex = rng.nextInt(0, DEFENSE_ENEMY_TEMPLATES.length - 1);
    const template = DEFENSE_ENEMY_TEMPLATES[templateIndex];

    // Check if we already have this enemy type
    const existing = enemyUnits.find(e => e.enemyId === template.id);
    if (existing) {
      existing.count++;
    } else {
      enemyUnits.push({
        enemyId: template.id,
        count: 1,
        levelMod: floorIndex,
        elite: floorIndex >= 2 && rng.nextFloat() < 0.3,
      });
    }
  }

  // Grid size
  const gridWidth = rng.nextInt(DEFENSE_BATTLE_CONFIG.gridWidthMin, DEFENSE_BATTLE_CONFIG.gridWidthMax);
  const gridHeight = rng.nextInt(DEFENSE_BATTLE_CONFIG.gridHeightMin, DEFENSE_BATTLE_CONFIG.gridHeightMax);

  return {
    enemyUnits,
    gridWidth,
    gridHeight,
    introText: "SLK//ALERT :: Hostiles detected! Defend the facility!",
  };
}

// ----------------------------------------------------------------------------
// DEFENSE BATTLE CREATION
// ----------------------------------------------------------------------------

/**
 * Create a defense battle from game state
 */
export function createDefenseBattle(
  gameState: GameState,
  keyRoomId: string,
  turnsToSurvive: number,
  encounterSeed: string
): BattleState | null {
  const partyIds = gameState.partyUnitIds;
  if (partyIds.length === 0) return null;

  // Generate encounter
  const activeRun = getActiveRunFromState();
  const floorIndex = activeRun?.floorIndex ?? 0;
  const encounter = generateDefenseEncounter(floorIndex, encounterSeed);

  // Grid setup
  const { gridWidth, gridHeight } = encounter;
  const maxElevation = 2;
  const elevationMap = generateElevationMap(gridWidth, gridHeight, maxElevation);
  const tiles = createGrid(gridWidth, gridHeight, elevationMap);
  const maxUnitsPerSide = calculateMaxUnitsPerSide(gridWidth, gridHeight);

  // Equipment data
  const equipmentById = (gameState as any).equipmentById || getAllStarterEquipment();
  const modulesById = (gameState as any).modulesById || getAllModules();

  const units: Record<string, BattleUnitState> = {};

  // Create player units without positions (placement phase)
  partyIds.forEach((id) => {
    const base = gameState.unitsById[id];
    if (!base) return;

    units[id] = createBattleUnitState(
      base,
      {
        isEnemy: false,
        pos: null,
        gearSlots: (gameState as any).gearSlots ?? {},
        gridWidth,
        gridHeight,
      },
      equipmentById,
      modulesById
    );
  });

  // Create defense enemies
  let enemyCounter = 0;
  for (const enemyDef of encounter.enemyUnits) {
    const template = DEFENSE_ENEMY_TEMPLATES.find(t => t.id === enemyDef.enemyId);
    if (!template) continue;

    for (let i = 0; i < enemyDef.count; i++) {
      const enemyId = `defense_enemy_${enemyCounter++}`;

      // Scale stats by floor
      const levelMod = enemyDef.levelMod ?? 0;
      const isElite = enemyDef.elite ?? false;
      const statMultiplier = isElite ? 1.5 : 1.0;

      const enemyBase: any = {
        id: enemyId,
        name: isElite ? `Elite ${template.name}` : template.name,
        isEnemy: true,
        hp: Math.floor((template.stats.maxHp + levelMod * 3) * statMultiplier),
        maxHp: Math.floor((template.stats.maxHp + levelMod * 3) * statMultiplier),
        agi: template.stats.agi,
        drawPile: [...template.deck],
        hand: [],
        discardPile: [],
        strain: 0,
        pos: null,
        stats: {
          atk: Math.floor((template.stats.atk + levelMod) * statMultiplier),
          def: Math.floor((template.stats.def + levelMod * 0.5) * statMultiplier),
          agi: template.stats.agi,
          acc: template.stats.acc,
        },
      };

      // Place enemy on right side of grid
      const yPos = Math.floor((gridHeight / Math.max(encounter.enemyUnits.reduce((sum, e) => sum + e.count, 0), 1)) * enemyCounter);

      units[enemyId] = createBattleUnitState(
        enemyBase,
        {
          isEnemy: true,
          pos: { x: gridWidth - 1, y: Math.min(yPos, gridHeight - 1) },
          gridWidth,
          gridHeight,
        },
        equipmentById,
        modulesById
      );
    }
  }

  // Create battle state with defense objective
  let battle: BattleState = {
    id: `defense_${keyRoomId}_${Date.now()}`,
    floorId: `floor_${floorIndex}`,
    roomId: keyRoomId,
    gridWidth,
    gridHeight,
    tiles,
    units,
    turnOrder: [],
    activeUnitId: null,
    phase: "placement",
    turnCount: 0,
    log: [
      "SLK//ENGAGE :: Defense engagement initialized.",
      `SLK//DEFEND :: Hostiles approaching! Defend the facility!`,
      `SLK//OBJECTIVE :: Survive ${turnsToSurvive} turns to secure the facility.`,
      "SLK//PLACE  :: Position your units on the left edge.",
    ],
    defenseObjective: {
      type: "survive_turns",
      turnsRequired: turnsToSurvive,
      turnsRemaining: turnsToSurvive,
      keyRoomId,
    },
    placementState: {
      placedUnitIds: [],
      selectedUnitId: null,
      maxUnitsPerSide,
    },
  };

  // Apply load penalties
  if ((gameState as any).inventory) {
    const loadPenalties = computeLoadPenaltyFlags((gameState as any).inventory);
    battle.loadPenalties = loadPenalties;

    if (loadPenalties.massOver) {
      const newUnits: Record<string, BattleUnitState> = { ...battle.units };
      const allies = Object.values(newUnits).filter((u) => !u.isEnemy);
      for (const ally of allies) {
        newUnits[ally.id] = {
          ...newUnits[ally.id],
          agi: Math.max(1, ally.agi - 1),
        };
      }
      battle = {
        ...battle,
        units: newUnits,
        log: [
          ...battle.log,
          "SLK//LOAD  :: MASS overload - squad AGI reduced.",
        ],
      };
    }
  }

  // Trigger Field Mod: battle_start
  battle = triggerBattleStart(battle);

  return battle;
}

/**
 * Get active run from localStorage (helper)
 */
function getActiveRunFromState() {
  try {
    const stored = localStorage.getItem("chaoscore_campaign_progress");
    if (stored) {
      const progress = JSON.parse(stored);
      return progress.activeRun;
    }
  } catch (e) {
    console.warn("[DEFENSE] Could not get active run");
  }
  return null;
}

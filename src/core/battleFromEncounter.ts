// ============================================================================
// CHAOS CORE - BATTLE CREATION FROM ENCOUNTERS
// Creates battle state from encounter definitions
// ============================================================================

import { BattleState, BattleUnitState } from "./battle";
import { GameState } from "./types";
import { EncounterDefinition } from "./campaign";
import { getEnemyDefinition } from "./enemies";
import { createBattleUnitState } from "./battle";

/**
 * Create a battle state from an encounter definition
 */
export function createBattleFromEncounter(
  gameState: GameState,
  encounter: EncounterDefinition
): BattleState {
  // Get party units
  const partyUnitIds = gameState.partyUnitIds || [];
  const units: Record<string, BattleUnitState> = {};
  
  // Create player units (without positions initially - placement phase)
  partyUnitIds.forEach(unitId => {
    const baseUnit = gameState.unitsById[unitId];
    if (baseUnit) {
      units[unitId] = createBattleUnitState(
        baseUnit,
        {
          isEnemy: false,
          pos: null, // Will be placed in placement phase
          gearSlots: (gameState as any).gearSlots ?? {},
        },
        (gameState as any).equipmentById,
        (gameState as any).modulesById
      );
    }
  });
  
  // Create enemy units from encounter
  let enemyInstanceCounter = 0;
  const enemyPositions: Array<{ x: number; y: number }> = [];
  
  // Generate enemy positions on right edge (x = gridWidth - 1)
  const rightEdgeX = encounter.gridWidth - 1;
  for (let y = 0; y < encounter.gridHeight; y++) {
    enemyPositions.push({ x: rightEdgeX, y });
  }
  
  let positionIndex = 0;
  
  encounter.enemyUnits.forEach(({ enemyId, count, levelMod = 0, elite = false }) => {
    const enemyDef = getEnemyDefinition(enemyId);
    if (!enemyDef) {
      console.warn(`[BATTLE] Unknown enemy: ${enemyId}`);
      return;
    }
    
    // Create count instances of this enemy
    for (let i = 0; i < count; i++) {
      const instanceId = `enemy_${enemyId}_${enemyInstanceCounter++}`;
      
      // Apply level mod and elite bonuses
      const hpMod = levelMod * 2 + (elite ? 5 : 0);
      const statMod = levelMod + (elite ? 1 : 0);
      
      // Get position (distribute along right edge)
      const pos = enemyPositions[positionIndex % enemyPositions.length];
      positionIndex++;
      
      // Create base unit from enemy definition
      const baseUnit = {
        id: instanceId,
        name: elite ? `Elite ${enemyDef.name}` : enemyDef.name,
        isEnemy: true,
        hp: enemyDef.baseStats.hp + hpMod,
        maxHp: enemyDef.baseStats.hp + hpMod,
        agi: enemyDef.baseStats.agi + statMod,
        pos: pos,
        hand: [],
        drawPile: enemyDef.deck || ["card_strike", "card_guard"], // Default cards
        discardPile: [],
        strain: 0,
        atk: enemyDef.baseStats.atk + statMod,
        def: enemyDef.baseStats.def + statMod,
        acc: 80, // Default accuracy
        move: enemyDef.baseStats.move,
      };
      
      units[instanceId] = createBattleUnitState(
        baseUnit as any,
        {
          isEnemy: true,
          pos: pos,
        },
        (gameState as any).equipmentById,
        (gameState as any).modulesById
      );
    }
  });
  
  // Create tiles
  const tiles: import("./battle").Tile[] = [];
  for (let y = 0; y < encounter.gridHeight; y++) {
    for (let x = 0; x < encounter.gridWidth; x++) {
      tiles.push({
        pos: { x, y },
        terrain: "floor" as const,
        elevation: 0,
      });
    }
  }
  
  // Create battle state (will start in placement phase)
  const battle: BattleState = {
    id: `battle_${Date.now()}`,
    floorId: "current_floor",
    roomId: "current_room",
    gridWidth: encounter.gridWidth,
    gridHeight: encounter.gridHeight,
    tiles,
    units,
    turnOrder: [], // Will be computed after placement
    activeUnitId: null,
    phase: "placement",
    turnCount: 0,
    log: [
      `SLK//ENGAGE :: Engagement feed online.`,
      `SLK//ROOM   :: Linked to node.`,
      encounter.introText || `SLK//PLACE  :: Unit placement phase - position your squad.`,
    ],
    placementState: {
      placedUnitIds: [],
      selectedUnitId: null,
      maxUnitsPerSide: Math.max(3, Math.min(10, Math.floor(encounter.gridWidth * encounter.gridHeight * 0.25))),
    },
  };
  
  return battle;
}


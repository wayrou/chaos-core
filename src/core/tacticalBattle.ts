import type { BattleState, BattleUnitState, Tile } from "./battle";
import type { GameState, SkirmishObjectiveType, SquadBattleObjectiveState, SquadBattleSide } from "./types";
import { createBattleFromEncounter } from "./battleFromEncounter";
import { createTrainingEncounter, type TrainingConfig } from "./trainingEncounter";
import {
  cloneTacticalMapDefinition,
  createPointKey,
  type TacticalMapDefinition,
  type TacticalMapPoint,
} from "./tacticalMaps";

function createTileFromMapPoint(map: TacticalMapDefinition, point: TacticalMapPoint): Tile {
  const baseTile = map.tiles.find((tile) => tile.x === point.x && tile.y === point.y);
  if (!baseTile) {
    return {
      pos: { x: point.x, y: point.y },
      terrain: "floor",
      elevation: 0,
      surface: "industrial",
    };
  }

  const structuralObject = map.objects.find((objectDef) => objectDef.x === point.x && objectDef.y === point.y);
  if (structuralObject?.type === "destructible_cover") {
    return {
      pos: { x: point.x, y: point.y },
      terrain: "light_cover",
      elevation: baseTile.elevation,
      surface: baseTile.surface,
      cover: {
        type: "light_cover",
        hp: 4,
        maxHp: 4,
      },
    };
  }

  if (structuralObject?.type === "barricade_wall" || structuralObject?.type === "destructible_wall") {
    return {
      pos: { x: point.x, y: point.y },
      terrain: "wall",
      elevation: baseTile.elevation,
      surface: baseTile.surface,
    };
  }

  return {
    pos: { x: point.x, y: point.y },
    terrain: "floor",
    elevation: baseTile.elevation,
    surface: baseTile.surface,
  };
}

export function createBattleTilesFromTacticalMap(map: TacticalMapDefinition): Tile[] {
  return map.tiles.map((tile) => createTileFromMapPoint(map, tile));
}

export function applyTacticalMapToBattleState(battle: BattleState, sourceMap: TacticalMapDefinition): BattleState {
  const map = cloneTacticalMapDefinition(sourceMap);
  const tiles = createBattleTilesFromTacticalMap(map);
  return {
    ...battle,
    gridWidth: map.width,
    gridHeight: map.height,
    mapId: map.id,
    tiles,
    mapObjects: map.objects.map((objectDef) => ({ ...objectDef })),
    spawnZones: {
      friendlySpawn: map.zones.friendlySpawn.map((point) => ({ ...point })),
      enemySpawn: map.zones.enemySpawn.map((point) => ({ ...point })),
    },
    objectiveZones: {
      relay: map.zones.relay.map((point) => ({ ...point })),
      friendlyBreach: map.zones.friendlyBreach.map((point) => ({ ...point })),
      enemyBreach: map.zones.enemyBreach.map((point) => ({ ...point })),
      extraction: map.zones.extraction.map((point) => ({ ...point })),
    },
    traversalLinks: map.traversalLinks.map((link) => ({
      ...link,
      from: { ...link.from },
      to: { ...link.to },
    })),
  };
}

function createControlRelayObjective(map: TacticalMapDefinition): SquadBattleObjectiveState {
  return {
    kind: "control_relay",
    label: "Control Relay",
    description: "Hold the authored relay tiles uncontested at round end.",
    controlTiles: map.zones.relay.map((point) => ({ ...point })),
    targetScore: 3,
    score: {
      friendly: 0,
      enemy: 0,
    },
    controllingSide: null,
    winnerSide: null,
  };
}

function createBreakthroughObjective(map: TacticalMapDefinition): SquadBattleObjectiveState {
  return {
    kind: "breakthrough",
    label: "Breakthrough",
    description: "Score by reaching the authored breach lanes.",
    controlTiles: [],
    breachTiles: {
      friendly: map.zones.friendlyBreach.map((point) => ({ ...point })),
      enemy: map.zones.enemyBreach.map((point) => ({ ...point })),
    },
    targetScore: 2,
    score: {
      friendly: 0,
      enemy: 0,
    },
    controllingSide: null,
    winnerSide: null,
    extractedUnitIds: [],
  };
}

function createExtractionObjective(map: TacticalMapDefinition): SquadBattleObjectiveState {
  return {
    kind: "extraction",
    label: "Extraction",
    description: "Reach the authored extraction zone and end your turn there to pull the operator out.",
    controlTiles: [],
    extractionTiles: map.zones.extraction.map((point) => ({ ...point })),
    targetScore: 2,
    score: {
      friendly: 0,
      enemy: 0,
    },
    controllingSide: null,
    winnerSide: null,
    extractedUnitIds: [],
  };
}

export function createSquadObjectiveStateFromTacticalMap(
  map: TacticalMapDefinition,
  objectiveType: SkirmishObjectiveType,
): SquadBattleObjectiveState | null {
  if (objectiveType === "control_relay" && map.zones.relay.length > 0) {
    return createControlRelayObjective(map);
  }
  if (
    objectiveType === "breakthrough"
    && map.zones.friendlyBreach.length > 0
    && map.zones.enemyBreach.length > 0
  ) {
    return createBreakthroughObjective(map);
  }
  if (
    objectiveType === "extraction"
    && map.zones.extraction.length > 0
    && map.objects.some((objectDef) => objectDef.type === "extraction_anchor")
  ) {
    return createExtractionObjective(map);
  }
  return null;
}

export function assignBattleUnitsToSpawnPoints(
  battle: BattleState,
  side: SquadBattleSide,
  points: TacticalMapPoint[],
): BattleState {
  if (points.length <= 0) {
    return battle;
  }

  const sideUnits = Object.values(battle.units).filter((unit) => unit.hp > 0 && unit.isEnemy === (side === "enemy"));
  const nextUnits: Record<string, BattleUnitState> = { ...battle.units };
  sideUnits.forEach((unit, index) => {
    const point = points[index % points.length];
    nextUnits[unit.id] = {
      ...unit,
      pos: { x: point.x, y: point.y },
    };
  });

  return {
    ...battle,
    units: nextUnits,
  };
}

export function createBuilderQuickTestBattle(
  state: GameState,
  sourceMap: TacticalMapDefinition,
  objectiveType: SkirmishObjectiveType | null = null,
): BattleState | null {
  const map = cloneTacticalMapDefinition(sourceMap);
  const trainingConfig: TrainingConfig = {
    gridW: map.width,
    gridH: map.height,
    mapId: map.id,
    difficulty: "normal",
    rules: {
      noRewards: true,
    },
  };
  const encounter = createTrainingEncounter(state, trainingConfig);
  if (!encounter) {
    return null;
  }

  let battle = createBattleFromEncounter(state, encounter, `builder_${map.id}`);
  battle = applyTacticalMapToBattleState(battle, map);
  battle = assignBattleUnitsToSpawnPoints(battle, "enemy", map.zones.enemySpawn);
  battle.returnTo = "map_builder";
  (battle as any).isTraining = true;
  (battle as any).trainingConfig = trainingConfig;
  battle.log = [
    ...battle.log,
    `SLK//MAP    :: Quick test loaded for ${map.name}.`,
  ];

  if (objectiveType === "control_relay" || objectiveType === "breakthrough" || objectiveType === "extraction") {
    battle.objectiveZones = {
      relay: map.zones.relay.map((point) => ({ ...point })),
      friendlyBreach: map.zones.friendlyBreach.map((point) => ({ ...point })),
      enemyBreach: map.zones.enemyBreach.map((point) => ({ ...point })),
      extraction: map.zones.extraction.map((point) => ({ ...point })),
    };
  }

  return battle;
}

export function getTacticalMapSpawnCapacity(map: TacticalMapDefinition): { friendly: number; enemy: number } {
  const uniqueFriendly = new Set(map.zones.friendlySpawn.map(createPointKey)).size;
  const uniqueEnemy = new Set(map.zones.enemySpawn.map(createPointKey)).size;
  return {
    friendly: uniqueFriendly,
    enemy: uniqueEnemy,
  };
}

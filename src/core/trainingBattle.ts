import type { BattleState } from "./battle";
import { createBattleFromEncounter } from "./battleFromEncounter";
import { getTacticalMapById, type TacticalMapDefinition } from "./tacticalMaps";
import { applyTacticalMapToBattleState, assignBattleUnitsToSpawnPoints } from "./tacticalBattle";
import { createTrainingEncounter, type TrainingConfig } from "./trainingEncounter";
import type { GameState } from "./types";

function resolveTrainingMap(config: TrainingConfig): TacticalMapDefinition | null {
  return getTacticalMapById(config.mapId ?? null);
}

export function normalizeTrainingConfig(config: TrainingConfig): TrainingConfig {
  const tacticalMap = resolveTrainingMap(config);
  if (!tacticalMap) {
    return {
      ...config,
      mapId: config.mapId ?? null,
    };
  }

  return {
    ...config,
    mapId: tacticalMap.id,
    gridW: tacticalMap.width,
    gridH: tacticalMap.height,
  };
}

export function createTrainingBattle(
  state: GameState,
  config: TrainingConfig,
  battleId = `training_${Date.now()}`,
): BattleState | null {
  const normalizedConfig = normalizeTrainingConfig(config);
  const encounter = createTrainingEncounter(state, normalizedConfig);
  if (!encounter) {
    return null;
  }

  let battle = createBattleFromEncounter(state, encounter, battleId);
  const tacticalMap = resolveTrainingMap(normalizedConfig);
  if (tacticalMap) {
    battle = applyTacticalMapToBattleState(battle, tacticalMap);
    battle = assignBattleUnitsToSpawnPoints(battle, "enemy", tacticalMap.zones.enemySpawn);
    battle.log = [
      ...battle.log,
      `SLK//MAP    :: Training simulation loaded on ${tacticalMap.name}.`,
    ];
  }

  (battle as any).isTraining = true;
  (battle as any).trainingConfig = normalizedConfig;
  return battle;
}

import type { GameState, ResourceWallet } from "../../core/types";
import { getAllStarterEquipment, type Equipment } from "../../core/equipment";
import {
  ECHO_STARTER_CHASSIS_IDS,
  ECHO_STARTER_DOCTRINE_IDS,
  getEchoRunEquipmentById,
  getEchoRunEquipmentPool,
} from "../../core/echoRuns";
import { createEmptyResourceWallet } from "../../core/resources";
import { createDefaultSessionState } from "../../core/session";

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)));
}

function normalizeConsumables(consumables: Record<string, number> | null | undefined): Record<string, number> {
  return Object.fromEntries(
    Object.entries(consumables ?? {})
      .map(([itemId, quantity]): [string, number] => [itemId, Math.max(0, Math.floor(Number(quantity) || 0))])
      .filter(([, quantity]) => quantity > 0),
  );
}

function normalizeResources(resources: Partial<ResourceWallet> | null | undefined): ResourceWallet {
  return createEmptyResourceWallet(resources);
}

function getEquippedEquipmentIds(unitsById: GameState["unitsById"]): string[] {
  return Object.values(unitsById ?? {}).flatMap((unit) => Object.values(unit.loadout ?? {}))
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

export function createEchoServiceGameState(baseState: GameState): GameState {
  const run = baseState.echoRun;
  if (!run) {
    return baseState;
  }

  const resources = normalizeResources(run.resources);
  const equipmentById = getEchoRunEquipmentById(run);
  const equipmentPool = getEchoRunEquipmentPool(run);

  return {
    ...baseState,
    phase: "echo",
    unitsById: { ...(run.unitsById ?? {}) },
    partyUnitIds: [...(run.squadUnitIds ?? [])],
    cardLibrary: { ...(run.cardLibrary ?? {}) },
    gearSlots: { ...(run.gearSlots ?? {}) },
    equipmentById,
    equipmentPool,
    wad: Math.max(0, Math.floor(Number(run.wad ?? 0))),
    resources,
    knownRecipeIds: uniqueIds(run.knownRecipeIds ?? []),
    consumables: normalizeConsumables(run.consumables),
    unlockedChassisIds: uniqueIds(run.unlockedChassisIds ?? ECHO_STARTER_CHASSIS_IDS),
    unlockedDoctrineIds: uniqueIds(run.unlockedDoctrineIds ?? ECHO_STARTER_DOCTRINE_IDS),
    uiLayout: {
      ...baseState.uiLayout,
      inventoryFolders: { ...(run.inventoryFolders ?? {}) },
      inventoryViewNodeLayouts: { ...(run.inventoryViewNodeLayouts ?? {}) },
    },
    session: createDefaultSessionState({
      wad: Math.max(0, Math.floor(Number(run.wad ?? 0))),
      resources,
      players: baseState.players,
    }),
  };
}

export function applyEchoServiceGameState(baseState: GameState, sourceState: GameState): GameState {
  const run = baseState.echoRun;
  if (!run) {
    return baseState;
  }

  const allStarterEquipment = getAllStarterEquipment();
  const nextEquipmentPool = uniqueIds([
    ...(sourceState.equipmentPool ?? []),
    ...getEquippedEquipmentIds(sourceState.unitsById),
  ]);
  const sourceEquipmentById = (sourceState.equipmentById ?? {}) as Record<string, Equipment>;
  const nextRunEquipmentById: Record<string, Equipment> = {};

  nextEquipmentPool.forEach((equipmentId) => {
    const equipment = sourceEquipmentById[equipmentId];
    if (equipment && !allStarterEquipment[equipmentId]) {
      nextRunEquipmentById[equipmentId] = equipment;
    }
  });

  return {
    ...baseState,
    echoRun: {
      ...run,
      unitsById: { ...(sourceState.unitsById as typeof run.unitsById) },
      squadUnitIds: [...(sourceState.partyUnitIds ?? run.squadUnitIds)],
      cardLibrary: { ...(sourceState.cardLibrary ?? {}) },
      gearSlots: { ...(sourceState.gearSlots ?? {}) },
      equipmentById: nextRunEquipmentById,
      equipmentPool: nextEquipmentPool,
      wad: Math.max(0, Math.floor(Number(sourceState.wad ?? 0))),
      resources: normalizeResources(sourceState.resources),
      knownRecipeIds: uniqueIds(sourceState.knownRecipeIds ?? []),
      consumables: normalizeConsumables(sourceState.consumables),
      unlockedChassisIds: uniqueIds(sourceState.unlockedChassisIds ?? ECHO_STARTER_CHASSIS_IDS),
      unlockedDoctrineIds: uniqueIds(sourceState.unlockedDoctrineIds ?? ECHO_STARTER_DOCTRINE_IDS),
      inventoryFolders: { ...(sourceState.uiLayout?.inventoryFolders ?? {}) },
      inventoryViewNodeLayouts: { ...(sourceState.uiLayout?.inventoryViewNodeLayouts ?? {}) },
    },
  };
}

export function updateEchoServiceGameState(
  baseState: GameState,
  updater: (sourceState: GameState) => GameState,
): GameState {
  const sourceState = createEchoServiceGameState(baseState);
  return applyEchoServiceGameState(baseState, updater(sourceState));
}

import type { BattleUnitState } from "./battle";
import type { PlayerId } from "./types";

export interface BattleAuthorityPlacementSummary {
  playerId: PlayerId;
  totalUnits: number;
  placedUnits: number;
  remainingUnits: number;
  blockedByCapacity: boolean;
  ready: boolean;
}

export function normalizeBattleAuthorityPlayerId(value: string | null | undefined): PlayerId | null {
  if (value === "P1" || value === "P2") {
    return value;
  }
  return null;
}

export function doesBattleUnitMatchAuthorityPlayer(
  unit: Pick<BattleUnitState, "controller"> | null | undefined,
  playerId?: string | null,
): boolean {
  const normalizedPlayerId = normalizeBattleAuthorityPlayerId(playerId);
  if (!normalizedPlayerId) {
    return true;
  }
  return (unit?.controller ?? "P1") === normalizedPlayerId;
}

export function filterBattleUnitsByAuthorityPlayer<T extends { controller?: string | null }>(
  units: readonly T[],
  playerId?: string | null,
): T[] {
  const normalizedPlayerId = normalizeBattleAuthorityPlayerId(playerId);
  if (!normalizedPlayerId) {
    return [...units];
  }
  return units.filter((unit) => (unit.controller ?? "P1") === normalizedPlayerId);
}

export function getNextUnplacedBattleUnitForAuthorityPlayer<
  T extends { id: string; controller?: string | null; pos?: unknown | null },
>(
  units: readonly T[],
  placedUnitIds: readonly string[],
  playerId?: string | null,
): T | null {
  const placementUnits = filterBattleUnitsByAuthorityPlayer(units, playerId);
  return placementUnits.find((unit) => !placedUnitIds.includes(unit.id) && !unit.pos) ?? null;
}

export function hasBattlePlacementUnitForAuthorityPlayer<
  T extends { id: string; controller?: string | null; pos?: unknown | null },
>(
  units: readonly T[],
  placedUnitIds: readonly string[],
  playerId?: string | null,
): boolean {
  return getNextUnplacedBattleUnitForAuthorityPlayer(units, placedUnitIds, playerId) !== null;
}

export function summarizeBattleAuthorityPlacements<
  T extends { id: string; controller?: string | null },
>(
  units: readonly T[],
  placedUnitIds: readonly string[],
  placementCapacity: number,
  activePlayers: readonly (PlayerId | string | null | undefined)[],
): BattleAuthorityPlacementSummary[] {
  const placedUnitIdSet = new Set(placedUnitIds);
  const placedCount = units.reduce((count, unit) => count + (placedUnitIdSet.has(unit.id) ? 1 : 0), 0);
  const normalizedPlayers = Array.from(new Set(
    activePlayers
      .map((playerId) => normalizeBattleAuthorityPlayerId(playerId))
      .filter((playerId): playerId is PlayerId => Boolean(playerId)),
  ));

  return normalizedPlayers
    .map((playerId) => {
      const playerUnits = filterBattleUnitsByAuthorityPlayer(units, playerId);
      const totalUnits = playerUnits.length;
      const placedUnits = playerUnits.reduce((count, unit) => count + (placedUnitIdSet.has(unit.id) ? 1 : 0), 0);
      const remainingUnits = Math.max(0, totalUnits - placedUnits);
      const blockedByCapacity = remainingUnits > 0 && placedCount >= placementCapacity;
      return {
        playerId,
        totalUnits,
        placedUnits,
        remainingUnits,
        blockedByCapacity,
        ready: totalUnits === 0 || placedUnits > 0 || blockedByCapacity,
      };
    })
    .filter((summary) => summary.totalUnits > 0);
}

export function areBattleAuthorityPlacementsReady(
  summaries: readonly BattleAuthorityPlacementSummary[],
): boolean {
  return summaries.every((summary) => summary.ready);
}

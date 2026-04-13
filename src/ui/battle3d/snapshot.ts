import type { BattleState, BattleUnitState } from "../../core/battle";
import { getBattleUnitPortraitPath } from "../../core/portraits";
import type { EchoFieldPlacement } from "../../core/types";
import type { TacticalMapDefinition } from "../../core/tacticalMaps";
import type {
  BattleBoardPoint,
  BattleBoardSnapshot,
  BattleBoardTileVisual,
} from "./types";

export interface BattleBoardSyncOptions {
  moveTiles?: Set<string>;
  attackTiles?: Set<string>;
  placementTiles?: Set<string>;
  facingTiles?: Set<string>;
  hoveredTile?: BattleBoardPoint | null;
  hiddenUnitIds?: Set<string>;
  echoFieldPlacements?: EchoFieldPlacement[];
  selectedEchoFieldDraftId?: string | null;
  focusTile?: BattleBoardPoint | null;
}

function getUnitElevation(battle: BattleState, unit: BattleUnitState): number {
  if (!unit.pos) {
    return 0;
  }
  return battle.tiles.find((tile) => tile.pos.x === unit.pos?.x && tile.pos.y === unit.pos?.y)?.elevation ?? 0;
}

export function createBattleBoardSnapshot(
  battle: BattleState,
  options: BattleBoardSyncOptions = {},
): BattleBoardSnapshot {
  const moveTiles = options.moveTiles ?? new Set<string>();
  const attackTiles = options.attackTiles ?? new Set<string>();
  const placementTiles = options.placementTiles ?? new Set<string>();
  const facingTiles = options.facingTiles ?? new Set<string>();
  const hiddenUnitIds = options.hiddenUnitIds ?? new Set<string>();
  const echoFieldPlacements = options.echoFieldPlacements ?? [];

  const boardKey = JSON.stringify({
    id: battle.id,
    width: battle.gridWidth,
    height: battle.gridHeight,
    tiles: battle.tiles.map((tile) => ({
      x: tile.pos.x,
      y: tile.pos.y,
      terrain: tile.terrain,
      elevation: tile.elevation ?? 0,
      surface: tile.surface ?? "industrial",
    })),
    objects: battle.mapObjects ?? [],
    traversalLinks: battle.traversalLinks ?? [],
  });

  const tiles: BattleBoardTileVisual[] = battle.tiles.map((tile) => {
    const x = tile.pos.x;
    const y = tile.pos.y;
    const key = `${x},${y}`;
    const affectingEchoFields = echoFieldPlacements.filter((placement) => {
      const distance = Math.abs(placement.x - x) + Math.abs(placement.y - y);
      return distance <= placement.radius;
    });
    const centerEchoField = echoFieldPlacements.find((placement) => placement.x === x && placement.y === y);
    const squadObjective = battle.modeContext?.kind === "squad" ? battle.modeContext.squad?.objective ?? null : null;
    const isFriendlyBreach = Boolean(
      squadObjective?.breachTiles?.friendly?.some((point) => point.x === x && point.y === y)
      || battle.objectiveZones?.friendlyBreach?.some((point) => point.x === x && point.y === y),
    );
    const isEnemyBreach = Boolean(
      squadObjective?.breachTiles?.enemy?.some((point) => point.x === x && point.y === y)
      || battle.objectiveZones?.enemyBreach?.some((point) => point.x === x && point.y === y),
    );
    const isRelay = Boolean(
      squadObjective?.controlTiles.some((point) => point.x === x && point.y === y)
      || battle.objectiveZones?.relay?.some((point) => point.x === x && point.y === y),
    );
    const isExtraction = Boolean(
      battle.objectiveZones?.extraction?.some((point) => point.x === x && point.y === y),
    );

    return {
      key,
      x,
      y,
      elevation: tile.elevation ?? 0,
      terrain: tile.terrain,
      surface: tile.surface ?? "industrial",
      moveOption: moveTiles.has(key),
      attackOption: attackTiles.has(key),
      placementOption: placementTiles.has(key),
      facingOption: facingTiles.has(key),
      hovered: Boolean(options.hoveredTile && options.hoveredTile.x === x && options.hoveredTile.y === y),
      relayZone: isRelay,
      extractionZone: isExtraction,
      friendlyBreach: isFriendlyBreach,
      enemyBreach: isEnemyBreach,
      squadObjective: isRelay || isFriendlyBreach || isEnemyBreach,
      echoField: affectingEchoFields.length > 0,
      echoFieldCenter: Boolean(centerEchoField),
      selectedEchoField: Boolean(centerEchoField && options.selectedEchoFieldDraftId && centerEchoField.draftId === options.selectedEchoFieldDraftId),
      echoFieldIds: affectingEchoFields.map((placement) => placement.fieldId),
    };
  });

  const units = Object.values(battle.units)
    .filter((unit) => unit.hp > 0 && unit.pos)
    .map((unit) => ({
      id: unit.id,
      baseUnitId: unit.baseUnitId,
      classId: unit.classId,
      name: unit.name,
      x: unit.pos!.x,
      y: unit.pos!.y,
      portraitPath: getBattleUnitPortraitPath(unit.id, unit.baseUnitId),
      isEnemy: unit.isEnemy,
      active: unit.id === battle.activeUnitId,
      hidden: hiddenUnitIds.has(unit.id),
      hp: unit.hp,
      maxHp: unit.maxHp,
      facing: unit.facing,
      controller: unit.controller?.toString(),
      elevation: getUnitElevation(battle, unit),
    }));

  return {
    id: battle.id,
    width: battle.gridWidth,
    height: battle.gridHeight,
    boardKey,
    tiles,
    objects: (battle.mapObjects ?? []).map((objectDef) => ({
      id: objectDef.id,
      type: objectDef.type,
      x: objectDef.x,
      y: objectDef.y,
      elevation: battle.tiles.find((tile) => tile.pos.x === objectDef.x && tile.pos.y === objectDef.y)?.elevation ?? 0,
      active: objectDef.active !== false,
      hidden: objectDef.hidden,
      radius: objectDef.radius,
    })),
    traversalLinks: (battle.traversalLinks ?? []).map((link) => ({
      id: link.id,
      kind: link.kind,
      from: { ...link.from },
      to: { ...link.to },
      bidirectional: link.bidirectional,
    })),
    units,
    focusTile: options.focusTile ?? null,
    hoveredTile: options.hoveredTile ?? null,
  };
}

export function createMapPreviewBoardSnapshot(
  map: TacticalMapDefinition,
  options: {
    selectedTile?: BattleBoardPoint | null;
    traversalSource?: BattleBoardPoint | null;
  } = {},
): BattleBoardSnapshot {
  const boardKey = JSON.stringify({
    id: map.id,
    width: map.width,
    height: map.height,
    tiles: map.tiles,
    objects: map.objects,
    traversalLinks: map.traversalLinks,
  });

  return {
    id: map.id,
    width: map.width,
    height: map.height,
    boardKey,
    tiles: map.tiles.map((tile): BattleBoardTileVisual => ({
      key: `${tile.x},${tile.y}`,
      x: tile.x,
      y: tile.y,
      elevation: tile.elevation,
      terrain: map.objects.some((objectDef) =>
        objectDef.x === tile.x
        && objectDef.y === tile.y
        && (objectDef.type === "barricade_wall" || objectDef.type === "destructible_wall")
      )
        ? "wall"
        : map.objects.some((objectDef) =>
            objectDef.x === tile.x
            && objectDef.y === tile.y
            && objectDef.type === "destructible_cover"
          )
          ? "light_cover"
          : "floor",
      surface: tile.surface,
      hovered: Boolean(options.selectedTile && options.selectedTile.x === tile.x && options.selectedTile.y === tile.y),
      placementOption: Boolean(options.traversalSource && options.traversalSource.x === tile.x && options.traversalSource.y === tile.y),
      relayZone: map.zones.relay.some((point) => point.x === tile.x && point.y === tile.y),
      extractionZone: map.zones.extraction.some((point) => point.x === tile.x && point.y === tile.y),
      friendlyBreach: map.zones.friendlyBreach.some((point) => point.x === tile.x && point.y === tile.y),
      enemyBreach: map.zones.enemyBreach.some((point) => point.x === tile.x && point.y === tile.y),
      squadObjective: map.zones.relay.some((point) => point.x === tile.x && point.y === tile.y),
      moveOption: map.zones.friendlySpawn.some((point) => point.x === tile.x && point.y === tile.y),
      attackOption: map.zones.enemySpawn.some((point) => point.x === tile.x && point.y === tile.y),
    })),
    objects: map.objects.map((objectDef) => ({
      id: objectDef.id,
      type: objectDef.type,
      x: objectDef.x,
      y: objectDef.y,
      elevation: map.tiles.find((tile) => tile.x === objectDef.x && tile.y === objectDef.y)?.elevation ?? 0,
      active: objectDef.active !== false,
      hidden: objectDef.hidden,
      radius: objectDef.radius,
    })),
    traversalLinks: map.traversalLinks.map((link) => ({
      id: link.id,
      kind: link.kind,
      from: { ...link.from },
      to: { ...link.to },
      bidirectional: link.bidirectional,
    })),
    units: [],
    focusTile: options.selectedTile ?? null,
    hoveredTile: options.selectedTile ?? null,
  };
}

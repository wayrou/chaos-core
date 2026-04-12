import type { TerrainType } from "../../core/battle";
import type {
  TacticalMapObjectType,
  TacticalMapSurface,
  TacticalTraversalKind,
} from "../../core/tacticalMaps";

export interface BattleBoardPoint {
  x: number;
  y: number;
}

export interface BattleBoardPick extends BattleBoardPoint {
  unitId?: string | null;
  objectId?: string | null;
}

export interface BattleBoardTileVisual extends BattleBoardPoint {
  key: string;
  elevation: number;
  terrain: TerrainType;
  surface: TacticalMapSurface;
  moveOption?: boolean;
  attackOption?: boolean;
  placementOption?: boolean;
  facingOption?: boolean;
  hovered?: boolean;
  relayZone?: boolean;
  extractionZone?: boolean;
  friendlyBreach?: boolean;
  enemyBreach?: boolean;
  squadObjective?: boolean;
  echoField?: boolean;
  echoFieldCenter?: boolean;
  selectedEchoField?: boolean;
  echoFieldIds?: string[];
}

export interface BattleBoardObjectVisual extends BattleBoardPoint {
  id: string;
  type: TacticalMapObjectType;
  elevation: number;
  active: boolean;
  hidden?: boolean;
  radius?: number;
}

export interface BattleBoardTraversalVisual {
  id: string;
  kind: TacticalTraversalKind;
  from: BattleBoardPoint;
  to: BattleBoardPoint;
  bidirectional: boolean;
}

export interface BattleBoardUnitVisual extends BattleBoardPoint {
  id: string;
  name: string;
  portraitPath: string;
  isEnemy: boolean;
  active: boolean;
  hidden?: boolean;
  hp: number;
  maxHp: number;
  facing?: "north" | "south" | "east" | "west";
  controller?: string;
  elevation: number;
}

export interface BattleBoardSnapshot {
  id: string;
  width: number;
  height: number;
  boardKey: string;
  tiles: BattleBoardTileVisual[];
  objects: BattleBoardObjectVisual[];
  traversalLinks: BattleBoardTraversalVisual[];
  units: BattleBoardUnitVisual[];
  focusTile?: BattleBoardPoint | null;
  hoveredTile?: BattleBoardPoint | null;
}

export interface BattleSceneInteractionHandlers {
  onPrimaryPick?: (pick: BattleBoardPick) => void;
  onHoverTile?: (tile: BattleBoardPoint | null) => void;
}

import type { SkirmishObjectiveType } from "./types";

export const TACTICAL_MAP_LIBRARY_VERSION = 1;
export const TACTICAL_MAP_LIBRARY_STORAGE_KEY = "chaoscore_tactical_map_library_v1";

export type TacticalMapTheme =
  | "breach"
  | "lane_control"
  | "vertical_assault"
  | "collapse"
  | "sandbox";

export type TacticalMapSurface =
  | "stone"
  | "metal"
  | "dirt"
  | "grate"
  | "industrial"
  | "ruin";

export type TacticalTraversalKind =
  | "ladder"
  | "portable_ladder"
  | "stairs"
  | "ramp"
  | "bridge"
  | "grapple";

export type TacticalMapObjectType =
  | "barricade_wall"
  | "destructible_wall"
  | "destructible_cover"
  | "med_station"
  | "ammo_crate"
  | "proximity_mine"
  | "smoke_emitter"
  | "portable_ladder"
  | "light_tower"
  | "extraction_anchor";

export type TacticalMapTag =
  | "small"
  | "medium"
  | "large"
  | "indoor"
  | "outdoor"
  | "vertical"
  | "chokepoint-heavy"
  | "open"
  | "asymmetrical"
  | "symmetrical"
  | "destruction-heavy"
  | "skirmish"
  | "extraction-compatible";

export interface TacticalMapPoint {
  x: number;
  y: number;
}

export interface TacticalMapTileDefinition extends TacticalMapPoint {
  elevation: number;
  surface: TacticalMapSurface;
}

export interface TacticalTraversalLinkDefinition {
  id: string;
  kind: TacticalTraversalKind;
  from: TacticalMapPoint;
  to: TacticalMapPoint;
  bidirectional: boolean;
}

export interface TacticalMapObjectDefinition extends TacticalMapPoint {
  id: string;
  type: TacticalMapObjectType;
  active?: boolean;
  hidden?: boolean;
  blocksMovement?: boolean;
  blocksLineOfSight?: boolean;
  charges?: number;
  radius?: number;
}

export interface TacticalMapZoneSet {
  friendlySpawn: TacticalMapPoint[];
  enemySpawn: TacticalMapPoint[];
  relay: TacticalMapPoint[];
  friendlyBreach: TacticalMapPoint[];
  enemyBreach: TacticalMapPoint[];
  extraction: TacticalMapPoint[];
}

export interface TacticalMapMetadata {
  author: string;
  sizeEstimate: "small" | "medium" | "large";
  indoorOutdoor: "indoor" | "outdoor";
  verticality: number;
  destructibility: number;
  tags: TacticalMapTag[];
}

export interface TacticalMapDefinition {
  version: 1;
  id: string;
  name: string;
  theme: TacticalMapTheme;
  width: number;
  height: number;
  tiles: TacticalMapTileDefinition[];
  traversalLinks: TacticalTraversalLinkDefinition[];
  objects: TacticalMapObjectDefinition[];
  zones: TacticalMapZoneSet;
  supportedModes: SkirmishObjectiveType[];
  metadata: TacticalMapMetadata;
  isBuiltIn?: boolean;
  isTemplate?: boolean;
}

export interface TacticalMapLibraryPayload {
  version: number;
  maps: TacticalMapDefinition[];
}

export interface TacticalMapValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TacticalMapCatalog {
  builtInMaps: TacticalMapDefinition[];
  templates: TacticalMapDefinition[];
  customMaps: TacticalMapDefinition[];
}

const DEFAULT_SURFACE: TacticalMapSurface = "industrial";
const DEFAULT_AUTHOR = "AERISS";
const MIN_CUSTOM_WIDTH = 4;
const MAX_CUSTOM_WIDTH = 10;
const MIN_CUSTOM_HEIGHT = 3;
const MAX_CUSTOM_HEIGHT = 8;
const DEFAULT_SUPPORTED_MODES: SkirmishObjectiveType[] = ["elimination"];
const DEFAULT_TAGS: TacticalMapTag[] = ["skirmish", "medium", "asymmetrical"];

export function createPointKey(point: TacticalMapPoint): string {
  return `${point.x},${point.y}`;
}

function clonePoint<T extends TacticalMapPoint>(point: T): T {
  return { ...point };
}

function cloneZoneSet(zones: TacticalMapZoneSet): TacticalMapZoneSet {
  return {
    friendlySpawn: zones.friendlySpawn.map(clonePoint),
    enemySpawn: zones.enemySpawn.map(clonePoint),
    relay: zones.relay.map(clonePoint),
    friendlyBreach: zones.friendlyBreach.map(clonePoint),
    enemyBreach: zones.enemyBreach.map(clonePoint),
    extraction: zones.extraction.map(clonePoint),
  };
}

export function cloneTacticalMapDefinition(map: TacticalMapDefinition): TacticalMapDefinition {
  return {
    ...map,
    tiles: map.tiles.map((tile) => ({ ...tile })),
    traversalLinks: map.traversalLinks.map((link) => ({
      ...link,
      from: clonePoint(link.from),
      to: clonePoint(link.to),
    })),
    objects: map.objects.map((objectDef) => ({ ...objectDef })),
    zones: cloneZoneSet(map.zones),
    supportedModes: [...map.supportedModes],
    metadata: {
      ...map.metadata,
      tags: [...map.metadata.tags],
    },
  };
}

function buildTileMap(map: TacticalMapDefinition): Map<string, TacticalMapTileDefinition> {
  return new Map(map.tiles.map((tile) => [createPointKey(tile), tile]));
}

function normalizeTags(tags: TacticalMapTag[]): TacticalMapTag[] {
  return tags.filter((tag, index, list) => list.indexOf(tag) === index);
}

function getSizeEstimate(tileCount: number): TacticalMapMetadata["sizeEstimate"] {
  if (tileCount >= 50) {
    return "large";
  }
  if (tileCount <= 28) {
    return "small";
  }
  return "medium";
}

function clampRating(value: number): number {
  return Math.max(0, Math.min(5, Math.round(value)));
}

function createTile(
  x: number,
  y: number,
  elevation = 0,
  surface: TacticalMapSurface = DEFAULT_SURFACE,
): TacticalMapTileDefinition {
  return { x, y, elevation, surface };
}

function createRectTiles(
  width: number,
  height: number,
  opts: {
    omit?: TacticalMapPoint[];
    elevations?: Record<string, number>;
    surface?: TacticalMapSurface;
  } = {},
): TacticalMapTileDefinition[] {
  const omit = new Set((opts.omit ?? []).map(createPointKey));
  const tiles: TacticalMapTileDefinition[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      if (omit.has(key)) {
        continue;
      }
      tiles.push(createTile(x, y, opts.elevations?.[key] ?? 0, opts.surface ?? DEFAULT_SURFACE));
    }
  }
  return tiles;
}

function createMapMetadata(
  author: string,
  tags: TacticalMapTag[],
  tileCount: number,
  verticality = 1,
  destructibility = 1,
  indoorOutdoor: TacticalMapMetadata["indoorOutdoor"] = "indoor",
): TacticalMapMetadata {
  return {
    author: author.trim() || DEFAULT_AUTHOR,
    sizeEstimate: getSizeEstimate(tileCount),
    indoorOutdoor,
    verticality: clampRating(verticality),
    destructibility: clampRating(destructibility),
    tags: normalizeTags(tags),
  };
}

function isMovementBlockingObject(type: TacticalMapObjectType): boolean {
  return type === "barricade_wall" || type === "destructible_wall";
}

function isLineOfSightBlockingObject(type: TacticalMapObjectType): boolean {
  return type === "barricade_wall" || type === "destructible_wall" || type === "smoke_emitter";
}

function getDefaultObjectCharges(type: TacticalMapObjectType): number | undefined {
  if (type === "med_station" || type === "ammo_crate") {
    return 1;
  }
  return undefined;
}

function getDefaultObjectRadius(type: TacticalMapObjectType): number | undefined {
  if (type === "smoke_emitter" || type === "light_tower") {
    return 1;
  }
  return undefined;
}

function clampWidth(width: number): number {
  return Math.max(MIN_CUSTOM_WIDTH, Math.min(MAX_CUSTOM_WIDTH, Math.floor(width)));
}

function clampHeight(height: number): number {
  return Math.max(MIN_CUSTOM_HEIGHT, Math.min(MAX_CUSTOM_HEIGHT, Math.floor(height)));
}

function clampElevation(elevation: number): number {
  return Math.max(-1, Math.min(2, Math.round(elevation)));
}

function isPointInsideMap(map: Pick<TacticalMapDefinition, "width" | "height">, point: TacticalMapPoint): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}

function isPointOnPlayableTile(tileMap: Map<string, TacticalMapTileDefinition>, point: TacticalMapPoint): boolean {
  return tileMap.has(createPointKey(point));
}

function uniquePoints(points: TacticalMapPoint[]): TacticalMapPoint[] {
  const seen = new Set<string>();
  const unique: TacticalMapPoint[] = [];
  points.forEach((point) => {
    const key = createPointKey(point);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(clonePoint(point));
  });
  return unique;
}

function normalizeZonePoints(
  map: Pick<TacticalMapDefinition, "width" | "height" | "tiles">,
  points: TacticalMapPoint[] | undefined,
): TacticalMapPoint[] {
  const tileMap = buildTileMap(map as TacticalMapDefinition);
  return uniquePoints(points ?? []).filter(
    (point) => isPointInsideMap(map, point) && isPointOnPlayableTile(tileMap, point),
  );
}

function normalizeTraversalLinks(
  map: Pick<TacticalMapDefinition, "width" | "height" | "tiles">,
  links: TacticalTraversalLinkDefinition[] | undefined,
): TacticalTraversalLinkDefinition[] {
  const tileMap = buildTileMap(map as TacticalMapDefinition);
  const normalized: TacticalTraversalLinkDefinition[] = [];
  const seen = new Set<string>();

  (links ?? []).forEach((link, index) => {
    if (!isPointInsideMap(map, link.from) || !isPointInsideMap(map, link.to)) {
      return;
    }
    if (!tileMap.has(createPointKey(link.from)) || !tileMap.has(createPointKey(link.to))) {
      return;
    }
    const left = createPointKey(link.from);
    const right = createPointKey(link.to);
    const pairKey = `${left}|${right}|${link.kind}|${link.bidirectional ? "2" : "1"}`;
    if (seen.has(pairKey)) {
      return;
    }
    seen.add(pairKey);
    normalized.push({
      id: link.id?.trim() || `trav_${index}_${Date.now().toString(36)}`,
      kind: link.kind,
      from: clonePoint(link.from),
      to: clonePoint(link.to),
      bidirectional: link.bidirectional !== false,
    });
  });

  return normalized;
}

function normalizeObjects(
  map: Pick<TacticalMapDefinition, "width" | "height" | "tiles">,
  objects: TacticalMapObjectDefinition[] | undefined,
): TacticalMapObjectDefinition[] {
  const tileMap = buildTileMap(map as TacticalMapDefinition);
  const normalized: TacticalMapObjectDefinition[] = [];

  (objects ?? []).forEach((objectDef, index) => {
    if (!isPointInsideMap(map, objectDef)) {
      return;
    }
    if (!tileMap.has(createPointKey(objectDef))) {
      return;
    }
    normalized.push({
      id: objectDef.id?.trim() || `obj_${objectDef.type}_${index}_${Date.now().toString(36)}`,
      type: objectDef.type,
      x: objectDef.x,
      y: objectDef.y,
      active: objectDef.active ?? true,
      hidden: objectDef.hidden ?? false,
      blocksMovement: objectDef.blocksMovement ?? isMovementBlockingObject(objectDef.type),
      blocksLineOfSight: objectDef.blocksLineOfSight ?? isLineOfSightBlockingObject(objectDef.type),
      charges: objectDef.charges ?? getDefaultObjectCharges(objectDef.type),
      radius: objectDef.radius ?? getDefaultObjectRadius(objectDef.type),
    });
  });

  return normalized;
}

function normalizeTiles(
  width: number,
  height: number,
  tiles: TacticalMapTileDefinition[] | undefined,
): TacticalMapTileDefinition[] {
  const normalized = new Map<string, TacticalMapTileDefinition>();
  (tiles ?? []).forEach((tile) => {
    if (tile.x < 0 || tile.y < 0 || tile.x >= width || tile.y >= height) {
      return;
    }
    normalized.set(createPointKey(tile), {
      x: tile.x,
      y: tile.y,
      elevation: clampElevation(tile.elevation ?? 0),
      surface: tile.surface ?? DEFAULT_SURFACE,
    });
  });
  return Array.from(normalized.values()).sort((a, b) => a.y - b.y || a.x - b.x);
}

function normalizeSupportedModes(supportedModes: SkirmishObjectiveType[] | undefined): SkirmishObjectiveType[] {
  const modes = (supportedModes ?? DEFAULT_SUPPORTED_MODES).filter(
    (mode): mode is SkirmishObjectiveType =>
      mode === "elimination" || mode === "control_relay" || mode === "breakthrough",
  );
  return modes.filter((mode, index, list) => list.indexOf(mode) === index);
}

export function createTacticalMapId(prefix = "custom"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createBlankTacticalMap(options?: {
  name?: string;
  author?: string;
  width?: number;
  height?: number;
  theme?: TacticalMapTheme;
}): TacticalMapDefinition {
  const width = clampWidth(options?.width ?? 8);
  const height = clampHeight(options?.height ?? 5);
  const tiles = createRectTiles(width, height);
  return {
    version: 1,
    id: createTacticalMapId("custom"),
    name: options?.name?.trim() || "Untitled Tactical Map",
    theme: options?.theme ?? "sandbox",
    width,
    height,
    tiles,
    traversalLinks: [],
    objects: [],
    zones: {
      friendlySpawn: [{ x: 0, y: Math.max(0, Math.floor(height / 2) - 1) }, { x: 0, y: Math.floor(height / 2) }],
      enemySpawn: [{ x: width - 1, y: Math.max(0, Math.floor(height / 2) - 1) }, { x: width - 1, y: Math.floor(height / 2) }],
      relay: [{ x: Math.floor(width / 2), y: Math.floor(height / 2) }],
      friendlyBreach: [{ x: 1, y: Math.floor(height / 2) }],
      enemyBreach: [{ x: Math.max(0, width - 2), y: Math.floor(height / 2) }],
      extraction: [],
    },
    supportedModes: [...DEFAULT_SUPPORTED_MODES],
    metadata: createMapMetadata(options?.author ?? DEFAULT_AUTHOR, DEFAULT_TAGS, tiles.length, 1, 1, "indoor"),
  };
}

export function normalizeTacticalMapDefinition(
  input: TacticalMapDefinition,
  authorFallback = DEFAULT_AUTHOR,
): TacticalMapDefinition {
  const width = clampWidth(input.width);
  const height = clampHeight(input.height);
  const tiles = normalizeTiles(width, height, input.tiles);
  const baseMap: TacticalMapDefinition = {
    version: 1,
    id: input.id?.trim() || createTacticalMapId(input.isBuiltIn ? "builtin" : input.isTemplate ? "template" : "custom"),
    name: input.name?.trim() || "Untitled Tactical Map",
    theme: input.theme ?? "sandbox",
    width,
    height,
    tiles,
    traversalLinks: [],
    objects: [],
    zones: {
      friendlySpawn: [],
      enemySpawn: [],
      relay: [],
      friendlyBreach: [],
      enemyBreach: [],
      extraction: [],
    },
    supportedModes: normalizeSupportedModes(input.supportedModes),
    metadata: createMapMetadata(
      input.metadata?.author ?? authorFallback,
      input.metadata?.tags ?? DEFAULT_TAGS,
      tiles.length,
      input.metadata?.verticality ?? 1,
      input.metadata?.destructibility ?? 1,
      input.metadata?.indoorOutdoor ?? "indoor",
    ),
    isBuiltIn: input.isBuiltIn ?? false,
    isTemplate: input.isTemplate ?? false,
  };

  baseMap.traversalLinks = normalizeTraversalLinks(baseMap, input.traversalLinks);
  baseMap.objects = normalizeObjects(baseMap, input.objects);
  baseMap.zones = {
    friendlySpawn: normalizeZonePoints(baseMap, input.zones?.friendlySpawn),
    enemySpawn: normalizeZonePoints(baseMap, input.zones?.enemySpawn),
    relay: normalizeZonePoints(baseMap, input.zones?.relay),
    friendlyBreach: normalizeZonePoints(baseMap, input.zones?.friendlyBreach),
    enemyBreach: normalizeZonePoints(baseMap, input.zones?.enemyBreach),
    extraction: normalizeZonePoints(baseMap, input.zones?.extraction),
  };
  baseMap.metadata.tags = normalizeTags([
    ...baseMap.metadata.tags,
    baseMap.metadata.sizeEstimate,
    baseMap.metadata.indoorOutdoor,
  ]);

  return baseMap;
}

function getAdjacentPoints(point: TacticalMapPoint): TacticalMapPoint[] {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ];
}

function getTraversalAdjacency(map: TacticalMapDefinition): Map<string, TacticalMapPoint[]> {
  const adjacency = new Map<string, TacticalMapPoint[]>();

  const addEdge = (from: TacticalMapPoint, to: TacticalMapPoint) => {
    const key = createPointKey(from);
    const list = adjacency.get(key) ?? [];
    list.push(clonePoint(to));
    adjacency.set(key, list);
  };

  map.traversalLinks.forEach((link) => {
    addEdge(link.from, link.to);
    if (link.bidirectional) {
      addEdge(link.to, link.from);
    }
  });

  return adjacency;
}

function hasTraversalBetween(
  adjacency: Map<string, TacticalMapPoint[]>,
  from: TacticalMapPoint,
  to: TacticalMapPoint,
): boolean {
  return (adjacency.get(createPointKey(from)) ?? []).some((point) => point.x === to.x && point.y === to.y);
}

function isTraversableStep(
  tileMap: Map<string, TacticalMapTileDefinition>,
  traversalAdjacency: Map<string, TacticalMapPoint[]>,
  from: TacticalMapPoint,
  to: TacticalMapPoint,
): boolean {
  const fromTile = tileMap.get(createPointKey(from));
  const toTile = tileMap.get(createPointKey(to));
  if (!fromTile || !toTile) {
    return false;
  }
  const delta = Math.abs((fromTile.elevation ?? 0) - (toTile.elevation ?? 0));
  return delta <= 1 || hasTraversalBetween(traversalAdjacency, from, to);
}

function buildConnectivity(tileMap: Map<string, TacticalMapTileDefinition>, map: TacticalMapDefinition): Set<string> {
  const traversalAdjacency = getTraversalAdjacency(map);
  const firstTile = map.tiles[0];
  if (!firstTile) {
    return new Set<string>();
  }

  const visited = new Set<string>();
  const queue: TacticalMapPoint[] = [firstTile];
  visited.add(createPointKey(firstTile));

  while (queue.length > 0) {
    const current = queue.shift()!;
    getAdjacentPoints(current).forEach((nextPoint) => {
      const key = createPointKey(nextPoint);
      if (visited.has(key) || !tileMap.has(key)) {
        return;
      }
      if (!isTraversableStep(tileMap, traversalAdjacency, current, nextPoint)) {
        return;
      }
      visited.add(key);
      queue.push(nextPoint);
    });

    (traversalAdjacency.get(createPointKey(current)) ?? []).forEach((nextPoint) => {
      const key = createPointKey(nextPoint);
      if (visited.has(key) || !tileMap.has(key)) {
        return;
      }
      visited.add(key);
      queue.push(nextPoint);
    });
  }

  return visited;
}

function createBuiltInMapDefinitions(): TacticalMapDefinition[] {
  const bunkerBreach = normalizeTacticalMapDefinition({
    version: 1,
    id: "builtin_bunker_breach",
    name: "Bunker Breach",
    theme: "breach",
    width: 8,
    height: 5,
    tiles: createRectTiles(8, 5, {
      omit: [{ x: 0, y: 0 }, { x: 0, y: 4 }, { x: 7, y: 0 }, { x: 7, y: 4 }],
      surface: "metal",
    }),
    traversalLinks: [],
    objects: [
      { id: "obj_bunker_cover_1", type: "destructible_cover", x: 3, y: 1 },
      { id: "obj_bunker_cover_2", type: "destructible_cover", x: 4, y: 3 },
      { id: "obj_bunker_wall_1", type: "destructible_wall", x: 2, y: 2 },
    ],
    zones: {
      friendlySpawn: [{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
      enemySpawn: [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }],
      relay: [{ x: 4, y: 2 }],
      friendlyBreach: [{ x: 1, y: 2 }],
      enemyBreach: [{ x: 6, y: 2 }],
      extraction: [],
    },
    supportedModes: ["elimination", "control_relay", "breakthrough"],
    metadata: createMapMetadata("Chaos Core", ["skirmish", "indoor", "chokepoint-heavy", "medium"], 36, 1, 3, "indoor"),
    isBuiltIn: true,
  });

  const relaySpine = normalizeTacticalMapDefinition({
    version: 1,
    id: "builtin_relay_spine",
    name: "Relay Spine",
    theme: "lane_control",
    width: 9,
    height: 6,
    tiles: createRectTiles(9, 6, {
      omit: [{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 8, y: 0 }, { x: 8, y: 5 }, { x: 4, y: 0 }, { x: 4, y: 5 }],
      surface: "stone",
    }),
    traversalLinks: [],
    objects: [
      { id: "obj_relay_cover_1", type: "barricade_wall", x: 2, y: 2 },
      { id: "obj_relay_cover_2", type: "barricade_wall", x: 6, y: 3 },
      { id: "obj_relay_ammo", type: "ammo_crate", x: 1, y: 2 },
      { id: "obj_relay_mine", type: "proximity_mine", x: 5, y: 2, hidden: true },
    ],
    zones: {
      friendlySpawn: [{ x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }],
      enemySpawn: [{ x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }],
      relay: [{ x: 4, y: 2 }, { x: 4, y: 3 }],
      friendlyBreach: [{ x: 1, y: 2 }],
      enemyBreach: [{ x: 7, y: 3 }],
      extraction: [],
    },
    supportedModes: ["elimination", "control_relay", "breakthrough"],
    metadata: createMapMetadata("Chaos Core", ["skirmish", "medium", "open", "asymmetrical"], 48, 1, 2, "outdoor"),
    isBuiltIn: true,
  });

  const quarrySteps = normalizeTacticalMapDefinition({
    version: 1,
    id: "builtin_quarry_steps",
    name: "Quarry Steps",
    theme: "vertical_assault",
    width: 10,
    height: 7,
    tiles: createRectTiles(10, 7, {
      omit: [{ x: 0, y: 0 }, { x: 0, y: 6 }, { x: 9, y: 0 }, { x: 9, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }],
      elevations: {
        "3,1": 1,
        "4,1": 1,
        "5,1": 1,
        "6,1": 2,
        "6,2": 2,
        "6,3": 2,
        "3,4": -1,
        "4,4": -1,
        "5,4": 1,
        "5,5": 1,
      },
      surface: "dirt",
    }),
    traversalLinks: [
      { id: "trav_quarry_ramp", kind: "ramp", from: { x: 5, y: 3 }, to: { x: 6, y: 3 }, bidirectional: true },
      { id: "trav_quarry_stairs", kind: "stairs", from: { x: 4, y: 4 }, to: { x: 5, y: 4 }, bidirectional: true },
    ],
    objects: [
      { id: "obj_quarry_light", type: "light_tower", x: 2, y: 2, radius: 2 },
      { id: "obj_quarry_med", type: "med_station", x: 4, y: 5 },
      { id: "obj_quarry_ladder", type: "portable_ladder", x: 6, y: 2 },
    ],
    zones: {
      friendlySpawn: [{ x: 0, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 3 }],
      enemySpawn: [{ x: 9, y: 2 }, { x: 9, y: 3 }, { x: 8, y: 3 }],
      relay: [{ x: 5, y: 3 }],
      friendlyBreach: [{ x: 1, y: 3 }],
      enemyBreach: [{ x: 8, y: 3 }],
      extraction: [],
    },
    supportedModes: ["elimination", "control_relay", "breakthrough"],
    metadata: createMapMetadata("Chaos Core", ["skirmish", "outdoor", "vertical", "large"], 64, 4, 2, "outdoor"),
    isBuiltIn: true,
  });

  return [bunkerBreach, relaySpine, quarrySteps];
}

function createTemplateDefinitions(): TacticalMapDefinition[] {
  const makeTemplate = (
    id: string,
    name: string,
    theme: TacticalMapTheme,
    source: TacticalMapDefinition,
  ): TacticalMapDefinition =>
    normalizeTacticalMapDefinition({
      ...cloneTacticalMapDefinition(source),
      id,
      name,
      theme,
      isBuiltIn: false,
      isTemplate: true,
      metadata: {
        ...source.metadata,
        author: "Chaos Core",
      },
      objects: source.objects.filter((objectDef) => objectDef.type !== "extraction_anchor"),
    });

  const [breach, lane, vertical] = createBuiltInMapDefinitions();
  const collapse = normalizeTacticalMapDefinition({
    version: 1,
    id: "template_collapse",
    name: "Collapse Template",
    theme: "collapse",
    width: 8,
    height: 6,
    tiles: createRectTiles(8, 6, {
      omit: [{ x: 0, y: 0 }, { x: 7, y: 5 }],
      surface: "metal",
      elevations: { "2,2": 1, "3,2": 1, "4,2": 1, "5,2": 1 },
    }),
    traversalLinks: [{ id: "trav_collapse_bridge", kind: "bridge", from: { x: 3, y: 2 }, to: { x: 4, y: 2 }, bidirectional: true }],
    objects: [
      { id: "obj_collapse_wall_1", type: "destructible_wall", x: 3, y: 3 },
      { id: "obj_collapse_wall_2", type: "destructible_wall", x: 4, y: 3 },
    ],
    zones: {
      friendlySpawn: [{ x: 0, y: 2 }, { x: 0, y: 3 }],
      enemySpawn: [{ x: 7, y: 2 }, { x: 7, y: 3 }],
      relay: [{ x: 4, y: 2 }],
      friendlyBreach: [{ x: 1, y: 2 }],
      enemyBreach: [{ x: 6, y: 3 }],
      extraction: [],
    },
    supportedModes: ["elimination", "control_relay", "breakthrough"],
    metadata: createMapMetadata("Chaos Core", ["skirmish", "indoor", "destruction-heavy", "medium"], 46, 2, 4, "indoor"),
    isTemplate: true,
  });

  return [
    makeTemplate("template_breach", "Breach Template", "breach", breach),
    makeTemplate("template_lane_control", "Lane-Control Template", "lane_control", lane),
    makeTemplate("template_vertical", "Vertical Assault Template", "vertical_assault", vertical),
    collapse,
    makeTemplate("template_sandbox", "Sandbox Skirmish Template", "sandbox", lane),
  ];
}

const BUILT_IN_MAPS = createBuiltInMapDefinitions();
const TEMPLATE_MAPS = createTemplateDefinitions();

export function getBuiltInTacticalMaps(): TacticalMapDefinition[] {
  return BUILT_IN_MAPS.map(cloneTacticalMapDefinition);
}

export function getTacticalMapTemplates(): TacticalMapDefinition[] {
  return TEMPLATE_MAPS.map(cloneTacticalMapDefinition);
}

export function instantiateTemplateMap(
  templateId: string,
  author = DEFAULT_AUTHOR,
  name?: string,
): TacticalMapDefinition | null {
  const template = TEMPLATE_MAPS.find((entry) => entry.id === templateId);
  if (!template) {
    return null;
  }
  const draft = cloneTacticalMapDefinition(template);
  draft.id = createTacticalMapId("custom");
  draft.isTemplate = false;
  draft.isBuiltIn = false;
  draft.name = name?.trim() || `${template.name} Copy`;
  draft.metadata.author = author.trim() || DEFAULT_AUTHOR;
  return normalizeTacticalMapDefinition(draft, author);
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadCustomTacticalMaps(): TacticalMapDefinition[] {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(TACTICAL_MAP_LIBRARY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as TacticalMapLibraryPayload;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.maps)) {
      return [];
    }
    return parsed.maps.map((map) => normalizeTacticalMapDefinition(map, map.metadata?.author ?? DEFAULT_AUTHOR));
  } catch (error) {
    console.warn("[TACTICAL_MAPS] Failed to load custom map library", error);
    return [];
  }
}

export function saveCustomTacticalMaps(maps: TacticalMapDefinition[]): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    const payload: TacticalMapLibraryPayload = {
      version: TACTICAL_MAP_LIBRARY_VERSION,
      maps: maps.map((map) => normalizeTacticalMapDefinition(map, map.metadata?.author ?? DEFAULT_AUTHOR)),
    };
    window.localStorage.setItem(TACTICAL_MAP_LIBRARY_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("[TACTICAL_MAPS] Failed to save custom map library", error);
  }
}

export function upsertCustomTacticalMap(map: TacticalMapDefinition, authorFallback = DEFAULT_AUTHOR): TacticalMapDefinition {
  const normalized = normalizeTacticalMapDefinition({ ...map, isBuiltIn: false, isTemplate: false }, authorFallback);
  const existing = loadCustomTacticalMaps().filter((entry) => entry.id !== normalized.id);
  saveCustomTacticalMaps([...existing, normalized]);
  return normalized;
}

export function deleteCustomTacticalMap(mapId: string): void {
  saveCustomTacticalMaps(loadCustomTacticalMaps().filter((map) => map.id !== mapId));
}

export function duplicateCustomTacticalMap(
  mapId: string,
  authorFallback = DEFAULT_AUTHOR,
): TacticalMapDefinition | null {
  const source = loadCustomTacticalMaps().find((map) => map.id === mapId) ?? BUILT_IN_MAPS.find((map) => map.id === mapId);
  if (!source) {
    return null;
  }
  const duplicate = cloneTacticalMapDefinition(source);
  duplicate.id = createTacticalMapId("custom");
  duplicate.name = `${source.name} Copy`;
  duplicate.isBuiltIn = false;
  duplicate.isTemplate = false;
  duplicate.metadata.author = authorFallback.trim() || DEFAULT_AUTHOR;
  return upsertCustomTacticalMap(duplicate, authorFallback);
}

export function getTacticalMapCatalog(): TacticalMapCatalog {
  return {
    builtInMaps: getBuiltInTacticalMaps(),
    templates: getTacticalMapTemplates(),
    customMaps: loadCustomTacticalMaps(),
  };
}

export function getAllTacticalMaps(): TacticalMapDefinition[] {
  const catalog = getTacticalMapCatalog();
  return [...catalog.builtInMaps, ...catalog.customMaps];
}

export function getTacticalMapById(mapId: string | null | undefined): TacticalMapDefinition | null {
  if (!mapId) {
    return null;
  }
  return getAllTacticalMaps().find((map) => map.id === mapId) ?? null;
}

export function mapSupportsObjectiveType(map: TacticalMapDefinition, objectiveType: SkirmishObjectiveType): boolean {
  return map.supportedModes.includes(objectiveType);
}

export function validateTacticalMapDefinition(mapInput: TacticalMapDefinition): TacticalMapValidationResult {
  const map = normalizeTacticalMapDefinition(mapInput, mapInput.metadata?.author ?? DEFAULT_AUTHOR);
  const errors: string[] = [];
  const warnings: string[] = [];
  const tileMap = buildTileMap(map);
  const traversalAdjacency = getTraversalAdjacency(map);

  if (map.tiles.length <= 0) {
    errors.push("Map footprint cannot be empty.");
  }

  if (map.width < MIN_CUSTOM_WIDTH || map.width > MAX_CUSTOM_WIDTH) {
    errors.push(`Map width must stay between ${MIN_CUSTOM_WIDTH} and ${MAX_CUSTOM_WIDTH}.`);
  }
  if (map.height < MIN_CUSTOM_HEIGHT || map.height > MAX_CUSTOM_HEIGHT) {
    errors.push(`Map height must stay between ${MIN_CUSTOM_HEIGHT} and ${MAX_CUSTOM_HEIGHT}.`);
  }

  const connected = buildConnectivity(tileMap, map);
  if (map.tiles.length > 0 && connected.size !== map.tiles.length) {
    errors.push("Playable footprint must remain contiguous.");
  }

  const objectKeys = new Set<string>();
  map.objects.forEach((objectDef) => {
    const key = createPointKey(objectDef);
    if (objectKeys.has(key)) {
      errors.push(`Multiple objects overlap at (${objectDef.x}, ${objectDef.y}).`);
      return;
    }
    objectKeys.add(key);
    if (!tileMap.has(key)) {
      errors.push(`Object ${objectDef.type} is placed on a non-playable tile at (${objectDef.x}, ${objectDef.y}).`);
    }
  });

  const liveModes: SkirmishObjectiveType[] = ["elimination", "control_relay", "breakthrough"];
  map.supportedModes.forEach((mode) => {
    if (!liveModes.includes(mode)) {
      errors.push(`Unsupported skirmish mode assigned: ${mode}.`);
    }
  });

  if (map.zones.friendlySpawn.length < 2) {
    errors.push("At least two friendly spawn tiles are required.");
  }
  if (map.zones.enemySpawn.length < 2) {
    errors.push("At least two enemy spawn tiles are required.");
  }

  if (map.supportedModes.includes("control_relay") && map.zones.relay.length <= 0) {
    errors.push("Control Relay maps need at least one relay zone.");
  }
  if (map.supportedModes.includes("breakthrough")) {
    if (map.zones.friendlyBreach.length <= 0 || map.zones.enemyBreach.length <= 0) {
      errors.push("Breakthrough maps need both friendly and enemy breach zones.");
    }
  }

  map.tiles.forEach((tile) => {
    getAdjacentPoints(tile).forEach((neighborPoint) => {
      const neighbor = tileMap.get(createPointKey(neighborPoint));
      if (!neighbor) {
        return;
      }
      const delta = Math.abs((tile.elevation ?? 0) - (neighbor.elevation ?? 0));
      if (delta > 1 && !hasTraversalBetween(traversalAdjacency, tile, neighborPoint) && !hasTraversalBetween(traversalAdjacency, neighborPoint, tile)) {
        errors.push(`Illegal elevation gap between (${tile.x}, ${tile.y}) and (${neighborPoint.x}, ${neighborPoint.y}).`);
      }
    });
  });

  if (map.zones.friendlySpawn.length > 0 && map.zones.enemySpawn.length > 0) {
    const queue = [...map.zones.friendlySpawn];
    const visited = new Set<string>(queue.map(createPointKey));
    let canReachEnemy = false;

    while (queue.length > 0 && !canReachEnemy) {
      const current = queue.shift()!;
      if (map.zones.enemySpawn.some((point) => point.x === current.x && point.y === current.y)) {
        canReachEnemy = true;
        break;
      }

      getAdjacentPoints(current).forEach((neighborPoint) => {
        const key = createPointKey(neighborPoint);
        if (visited.has(key) || !tileMap.has(key)) {
          return;
        }
        if (!isTraversableStep(tileMap, traversalAdjacency, current, neighborPoint)) {
          return;
        }
        visited.add(key);
        queue.push(neighborPoint);
      });

      (traversalAdjacency.get(createPointKey(current)) ?? []).forEach((neighborPoint) => {
        const key = createPointKey(neighborPoint);
        if (visited.has(key) || !tileMap.has(key)) {
          return;
        }
        visited.add(key);
        queue.push(neighborPoint);
      });
    }

    if (!canReachEnemy) {
      errors.push("Friendly spawns cannot reach enemy spawns across the current footprint.");
    }
  }

  const extractionAnchors = map.objects.filter((objectDef) => objectDef.type === "extraction_anchor");
  extractionAnchors.forEach((anchor) => {
    if (!tileMap.has(createPointKey(anchor))) {
      errors.push(`Extraction anchor at (${anchor.x}, ${anchor.y}) is not on a playable tile.`);
    }
  });

  if (map.metadata.tags.includes("extraction-compatible") && extractionAnchors.length <= 0) {
    warnings.push("Extraction-compatible tag is set, but no extraction anchor is placed.");
  }

  return {
    valid: errors.length === 0,
    errors: errors.filter((error, index, list) => list.indexOf(error) === index),
    warnings: warnings.filter((warning, index, list) => list.indexOf(warning) === index),
  };
}

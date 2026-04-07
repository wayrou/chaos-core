import { getGameState, updateGameState } from "../state/gameStore";
import { getFieldMap } from "./maps";
import { getFieldNpcsForMap } from "./npcs";
import type { FieldMap, FieldNpc, FieldState } from "./types";

export const MINIMAP_LAYOUT_ID = "minimap";
export const FIELD_MINIMAP_TILE_SIZE = 64;
export const FIELD_MINIMAP_REVEAL_RADIUS = 4;

type FieldMinimapPointMarker = {
  id: string;
  x: number;
  y: number;
};

type FieldMinimapRectMarker = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  action: string;
};

type FieldMinimapWallEdge = {
  x: number;
  y: number;
  side: "north" | "south" | "east" | "west";
};

export type FieldMinimapModel = {
  mapId: FieldMap["id"];
  mapName: string;
  width: number;
  height: number;
  discoveredCount: number;
  walkableCells: Array<{ x: number; y: number }>;
  wallEdges: FieldMinimapWallEdge[];
  player: FieldMinimapPointMarker | null;
  npcs: FieldMinimapPointMarker[];
  enemies: FieldMinimapPointMarker[];
  zones: FieldMinimapRectMarker[];
};

type BuildFieldMinimapModelOptions = {
  runtimeMap?: FieldMap | null;
  runtimeFieldState?: FieldState | null;
  state?: ReturnType<typeof getGameState>;
};

type DrawFieldMinimapOptions = {
  transparent?: boolean;
};

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function parseTileKey(key: string): { x: number; y: number } | null {
  const [rawX, rawY] = key.split(",");
  const x = Number.parseInt(rawX ?? "", 10);
  const y = Number.parseInt(rawY ?? "", 10);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x, y };
}

function safeGetFieldMap(mapId: FieldMap["id"]): FieldMap | null {
  try {
    return getFieldMap(mapId);
  } catch {
    return null;
  }
}

function getAvatarTilePosition(avatar: { x: number; y: number } | null | undefined): { x: number; y: number } | null {
  if (!avatar) {
    return null;
  }
  return {
    x: Math.floor(avatar.x / FIELD_MINIMAP_TILE_SIZE),
    y: Math.floor(avatar.y / FIELD_MINIMAP_TILE_SIZE),
  };
}

function getMarkerTileCenter(position: { x: number; y: number } | null | undefined): { x: number; y: number } | null {
  if (!position) {
    return null;
  }
  return {
    x: position.x / FIELD_MINIMAP_TILE_SIZE,
    y: position.y / FIELD_MINIMAP_TILE_SIZE,
  };
}

function doesAreaOverlapDiscovered(
  left: number,
  top: number,
  width: number,
  height: number,
  discovered: Set<string>,
): boolean {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      if (discovered.has(tileKey(x, y))) {
        return true;
      }
    }
  }
  return false;
}

function getExploredTileSet(mapId: string, state = getGameState()): Set<string> {
  return new Set(state.uiLayout?.minimapExploredByMap?.[mapId] ?? []);
}

export function getMinimapExploredByMap(state = getGameState()): Record<string, string[]> {
  return { ...(state.uiLayout?.minimapExploredByMap ?? {}) };
}

export function revealFieldMinimapArea(
  mapId: string,
  centerTileX: number,
  centerTileY: number,
  radius = FIELD_MINIMAP_REVEAL_RADIUS,
  bounds?: { width: number; height: number },
): boolean {
  if (!mapId || !Number.isFinite(centerTileX) || !Number.isFinite(centerTileY)) {
    return false;
  }

  const state = getGameState();
  const currentEntries = state.uiLayout?.minimapExploredByMap?.[mapId] ?? [];
  const nextEntries = new Set(currentEntries);

  for (let y = centerTileY - radius; y <= centerTileY + radius; y += 1) {
    if (bounds && (y < 0 || y >= bounds.height)) {
      continue;
    }
    for (let x = centerTileX - radius; x <= centerTileX + radius; x += 1) {
      if (bounds && (x < 0 || x >= bounds.width)) {
        continue;
      }
      nextEntries.add(tileKey(x, y));
    }
  }

  if (nextEntries.size === currentEntries.length) {
    return false;
  }

  updateGameState((currentState) => ({
    ...currentState,
    uiLayout: {
      ...(currentState.uiLayout ?? {}),
      minimapExploredByMap: {
        ...(currentState.uiLayout?.minimapExploredByMap ?? {}),
        [mapId]: Array.from(nextEntries),
      },
    },
  }));

  return true;
}

function resolveRuntimeNpcs(mapId: FieldMap["id"], runtimeFieldState?: FieldState | null): FieldNpc[] {
  if (runtimeFieldState?.currentMap === mapId && (runtimeFieldState.npcs?.length ?? 0) > 0) {
    return runtimeFieldState.npcs ?? [];
  }
  return getFieldNpcsForMap(String(mapId));
}

export function buildFieldMinimapModel(
  mapId: FieldMap["id"] | null | undefined,
  options: BuildFieldMinimapModelOptions = {},
): FieldMinimapModel | null {
  if (!mapId) {
    return null;
  }

  const runtimeMap = options.runtimeMap?.id === mapId ? options.runtimeMap : null;
  const map = runtimeMap ?? safeGetFieldMap(mapId);
  if (!map) {
    return null;
  }

  const state = options.state ?? getGameState();
  const runtimeFieldState = options.runtimeFieldState?.currentMap === map.id ? options.runtimeFieldState : null;
  const discovered = getExploredTileSet(String(map.id), state);
  const walkableCells: Array<{ x: number; y: number }> = [];
  const wallEdges: FieldMinimapWallEdge[] = [];

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const key = tileKey(x, y);
      const tile = map.tiles[y]?.[x];
      if (!tile || !discovered.has(key) || !tile.walkable) {
        continue;
      }

      walkableCells.push({ x, y });

      const north = map.tiles[y - 1]?.[x];
      const south = map.tiles[y + 1]?.[x];
      const west = map.tiles[y]?.[x - 1];
      const east = map.tiles[y]?.[x + 1];

      if (!north?.walkable) wallEdges.push({ x, y, side: "north" });
      if (!south?.walkable) wallEdges.push({ x, y, side: "south" });
      if (!west?.walkable) wallEdges.push({ x, y, side: "west" });
      if (!east?.walkable) wallEdges.push({ x, y, side: "east" });
    }
  }

  const playerSource = runtimeFieldState?.player ?? state.players?.P1?.avatar ?? null;
  const playerCenter = getMarkerTileCenter(playerSource);
  const playerTile = getAvatarTilePosition(playerSource);

  const npcs = resolveRuntimeNpcs(map.id, runtimeFieldState)
    .map((npc) => {
      const markerTile = getAvatarTilePosition(npc);
      const center = getMarkerTileCenter(npc);
      if (!markerTile || !center || !discovered.has(tileKey(markerTile.x, markerTile.y))) {
        return null;
      }
      return {
        id: npc.id,
        x: center.x,
        y: center.y,
      };
    })
    .filter((marker): marker is FieldMinimapPointMarker => Boolean(marker));

  const enemies = (runtimeFieldState?.fieldEnemies ?? [])
    .filter((enemy) => enemy.hp > 0 && (enemy.kind ?? "light") === "light")
    .map((enemy) => {
      const markerTile = getAvatarTilePosition(enemy);
      const center = getMarkerTileCenter(enemy);
      if (!markerTile || !center || !discovered.has(tileKey(markerTile.x, markerTile.y))) {
        return null;
      }
      return {
        id: enemy.id,
        x: center.x,
        y: center.y,
      };
    })
    .filter((marker): marker is FieldMinimapPointMarker => Boolean(marker));

  const zones = map.interactionZones
    .filter((zone) => doesAreaOverlapDiscovered(zone.x, zone.y, zone.width, zone.height, discovered))
    .map((zone) => ({
      id: zone.id,
      x: zone.x,
      y: zone.y,
      width: zone.width,
      height: zone.height,
      action: zone.action,
    }));

  return {
    mapId: map.id,
    mapName: map.name,
    width: map.width,
    height: map.height,
    discoveredCount: Array.from(discovered)
      .map(parseTileKey)
      .filter((entry): entry is { x: number; y: number } => Boolean(entry))
      .filter((entry) => entry.x >= 0 && entry.x < map.width && entry.y >= 0 && entry.y < map.height)
      .length,
    walkableCells,
    wallEdges,
    player: playerCenter
      ? {
          id: "player",
          x: playerCenter.x,
          y: playerCenter.y,
        }
      : playerTile
        ? {
            id: "player",
            x: playerTile.x + 0.5,
            y: playerTile.y + 0.5,
          }
        : null,
    npcs,
    enemies,
    zones,
  };
}

function drawMinimapRect(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  scale: number,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.strokeRect(
    originX + (x * scale),
    originY + (y * scale),
    width * scale,
    height * scale,
  );
}

export function drawFieldMinimapCanvas(
  canvas: HTMLCanvasElement | null,
  model: FieldMinimapModel | null,
  options: DrawFieldMinimapOptions = {},
): void {
  if (!canvas) {
    return;
  }

  const transparent = Boolean(options.transparent);
  const cssWidth = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
  const cssHeight = canvas.clientHeight || canvas.parentElement?.clientHeight || 0;
  if (cssWidth <= 0 || cssHeight <= 0) {
    return;
  }

  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(cssWidth * pixelRatio));
  canvas.height = Math.max(1, Math.round(cssHeight * pixelRatio));

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  if (!model) {
    return;
  }

  const padding = Math.max(10, Math.min(cssWidth, cssHeight) * 0.06);
  const scale = Math.max(
    1,
    Math.min((cssWidth - padding * 2) / Math.max(model.width, 1), (cssHeight - padding * 2) / Math.max(model.height, 1)),
  );
  const mapWidthPx = model.width * scale;
  const mapHeightPx = model.height * scale;
  const originX = Math.floor((cssWidth - mapWidthPx) / 2);
  const originY = Math.floor((cssHeight - mapHeightPx) / 2);

  context.save();
  context.translate(0.5, 0.5);

  if (!transparent) {
    context.fillStyle = "rgba(6, 7, 9, 0.16)";
    context.fillRect(originX - 2, originY - 2, mapWidthPx + 4, mapHeightPx + 4);
  }

  context.fillStyle = transparent ? "rgba(46, 44, 40, 0.26)" : "rgba(52, 49, 44, 0.68)";
  model.walkableCells.forEach((cell) => {
    context.fillRect(
      originX + (cell.x * scale),
      originY + (cell.y * scale),
      Math.max(1, scale),
      Math.max(1, scale),
    );
  });

  context.strokeStyle = transparent ? "rgba(7, 7, 8, 0.82)" : "rgba(0, 0, 0, 0.92)";
  context.lineWidth = Math.max(1.8, scale * 0.14);
  context.lineCap = "square";
  model.wallEdges.forEach((edge) => {
    const left = originX + (edge.x * scale);
    const top = originY + (edge.y * scale);
    const right = left + scale;
    const bottom = top + scale;
    context.beginPath();
    switch (edge.side) {
      case "north":
        context.moveTo(left, top);
        context.lineTo(right, top);
        break;
      case "south":
        context.moveTo(left, bottom);
        context.lineTo(right, bottom);
        break;
      case "east":
        context.moveTo(right, top);
        context.lineTo(right, bottom);
        break;
      case "west":
        context.moveTo(left, top);
        context.lineTo(left, bottom);
        break;
    }
    context.stroke();
  });

  context.strokeStyle = transparent ? "rgba(240, 198, 126, 0.52)" : "rgba(233, 196, 132, 0.78)";
  context.lineWidth = Math.max(1.1, scale * 0.1);
  model.zones.forEach((zone) => {
    drawMinimapRect(context, originX, originY, scale, zone.x, zone.y, zone.width, zone.height);
  });

  context.fillStyle = transparent ? "rgba(169, 123, 61, 0.72)" : "rgba(186, 132, 70, 0.9)";
  model.npcs.forEach((marker) => {
    const radius = Math.max(2, scale * 0.18);
    context.beginPath();
    context.arc(
      originX + (marker.x * scale),
      originY + (marker.y * scale),
      radius,
      0,
      Math.PI * 2,
    );
    context.fill();
  });

  context.fillStyle = transparent ? "rgba(224, 106, 67, 0.86)" : "rgba(236, 118, 72, 0.96)";
  model.enemies.forEach((marker) => {
    const radius = Math.max(1.8, scale * 0.15);
    context.beginPath();
    context.arc(
      originX + (marker.x * scale),
      originY + (marker.y * scale),
      radius,
      0,
      Math.PI * 2,
    );
    context.fill();
  });

  if (model.player) {
    const size = Math.max(4, scale * 0.34);
    context.fillStyle = "rgba(255, 179, 64, 0.98)";
    context.fillRect(
      originX + (model.player.x * scale) - (size / 2),
      originY + (model.player.y * scale) - (size / 2),
      size,
      size,
    );
  }

  context.restore();
}

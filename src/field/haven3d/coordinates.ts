import type { FieldMap, InteractionZone, PlayerAvatar } from "../types";

export const HAVEN3D_FIELD_TILE_SIZE = 64;
export const HAVEN3D_WORLD_TILE_SIZE = 1.8;

export type Haven3DGearbladeMode = "blade" | "launcher" | "grapple";

export interface Haven3DModeController {
  readonly activeMode: Haven3DGearbladeMode | null;
  readonly enabledModes: ReadonlySet<Haven3DGearbladeMode>;
}

export interface Haven3DWorldPoint {
  x: number;
  y: number;
  z: number;
}

export interface Haven3DFieldPoint {
  x: number;
  y: number;
}

export interface Haven3DSceneObjectPlacement {
  id: string;
  type: FieldMap["objects"][number]["type"];
  label: string;
  fieldOrigin: Haven3DFieldPoint;
  fieldCenter: Haven3DFieldPoint;
  fieldSize: { width: number; height: number };
  worldCenter: Haven3DWorldPoint;
  worldSize: { width: number; depth: number; height: number };
}

export interface Haven3DSceneZonePlacement {
  id: string;
  label: string;
  fieldOrigin: Haven3DFieldPoint;
  fieldCenter: Haven3DFieldPoint;
  fieldSize: { width: number; height: number };
  worldCenter: Haven3DWorldPoint;
  worldSize: { width: number; depth: number };
}

export interface Haven3DSceneLayout {
  objects: Haven3DSceneObjectPlacement[];
  zones: Haven3DSceneZonePlacement[];
}

export function fieldToHavenWorld(
  map: Pick<FieldMap, "width" | "height">,
  point: Haven3DFieldPoint,
  elevation = 0,
): Haven3DWorldPoint {
  return {
    x: ((point.x / HAVEN3D_FIELD_TILE_SIZE) - (map.width / 2)) * HAVEN3D_WORLD_TILE_SIZE,
    y: elevation,
    z: ((point.y / HAVEN3D_FIELD_TILE_SIZE) - (map.height / 2)) * HAVEN3D_WORLD_TILE_SIZE,
  };
}

export function havenWorldToField(
  map: Pick<FieldMap, "width" | "height">,
  point: Pick<Haven3DWorldPoint, "x" | "z">,
): Haven3DFieldPoint {
  return {
    x: ((point.x / HAVEN3D_WORLD_TILE_SIZE) + (map.width / 2)) * HAVEN3D_FIELD_TILE_SIZE,
    y: ((point.z / HAVEN3D_WORLD_TILE_SIZE) + (map.height / 2)) * HAVEN3D_FIELD_TILE_SIZE,
  };
}

export function getInteractionZoneCenterPixels(zone: InteractionZone): Haven3DFieldPoint {
  return {
    x: (zone.x + (zone.width / 2)) * HAVEN3D_FIELD_TILE_SIZE,
    y: (zone.y + (zone.height / 2)) * HAVEN3D_FIELD_TILE_SIZE,
  };
}

export function getFieldObjectCenterPixels(object: FieldMap["objects"][number]): Haven3DFieldPoint {
  return {
    x: (object.x + (object.width / 2)) * HAVEN3D_FIELD_TILE_SIZE,
    y: (object.y + (object.height / 2)) * HAVEN3D_FIELD_TILE_SIZE,
  };
}

export function getFieldTileElevation(map: FieldMap, tileX: number, tileY: number): number {
  const elevation = Number(map.tiles[tileY]?.[tileX]?.elevation ?? 0);
  return Number.isFinite(elevation) ? Math.max(0, elevation) : 0;
}

export function getFieldPointElevation(map: FieldMap, point: Haven3DFieldPoint): number {
  return getFieldTileElevation(
    map,
    Math.floor(point.x / HAVEN3D_FIELD_TILE_SIZE),
    Math.floor(point.y / HAVEN3D_FIELD_TILE_SIZE),
  );
}

export function getFieldPointElevationWorld(map: FieldMap, point: Haven3DFieldPoint): number {
  return getFieldPointElevation(map, point) * 0.42;
}

function getFieldObjectHeight(object: FieldMap["objects"][number]): number {
  if (object.metadata?.grappleAnchor === true) {
    return 0.32;
  }
  if (object.metadata?.havenCargoElevatorExterior === true) {
    const visualHeight = Number(object.metadata.visualHeightWorld);
    return Number.isFinite(visualHeight) && visualHeight > 0 ? visualHeight : 10.8;
  }

  switch (object.type) {
    case "station":
      if (object.metadata?.havenBuilding) {
        if (object.sprite === "doorway") {
          return 2.65;
        }
        return object.sprite === "bulkhead" ? 3.35 : 3.55;
      }
      return 2.75;
    case "decoration":
      return 1.12;
    case "door":
      return 1.65;
    case "resource":
      return 1.22;
    default:
      return 0.7;
  }
}

function getFieldObjectWorldCenterElevation(
  map: FieldMap,
  object: FieldMap["objects"][number],
  fieldCenter: Haven3DFieldPoint,
): number {
  const baseElevation = Number(object.metadata?.objectBaseElevationWorld);
  if (Number.isFinite(baseElevation)) {
    return baseElevation;
  }
  return getFieldPointElevationWorld(map, fieldCenter);
}

export function createHaven3DSceneLayout(map: FieldMap): Haven3DSceneLayout {
  return {
    objects: map.objects
      .filter((object) => object.type !== "enemy")
      .map((object) => {
        const fieldCenter = getFieldObjectCenterPixels(object);
        const footprintScale = object.metadata?.useFull3DFootprint === true ? 1 : 0.78;
        const worldCenterElevation = getFieldObjectWorldCenterElevation(map, object, fieldCenter);
        return {
          id: object.id,
          type: object.type,
          label: String(object.metadata?.name ?? object.id ?? "").trim(),
          fieldOrigin: {
            x: object.x,
            y: object.y,
          },
          fieldCenter,
          fieldSize: {
            width: object.width,
            height: object.height,
          },
          worldCenter: fieldToHavenWorld(map, fieldCenter, worldCenterElevation + 0.08),
          worldSize: {
            width: Math.max(0.7, object.width * HAVEN3D_WORLD_TILE_SIZE * footprintScale),
            depth: Math.max(0.7, object.height * HAVEN3D_WORLD_TILE_SIZE * footprintScale),
            height: getFieldObjectHeight(object),
          },
        };
      }),
    zones: map.interactionZones.map((zone) => {
      const fieldCenter = getInteractionZoneCenterPixels(zone);
      return {
        id: zone.id,
        label: zone.label,
        fieldOrigin: {
          x: zone.x,
          y: zone.y,
        },
        fieldCenter,
        fieldSize: {
          width: zone.width,
          height: zone.height,
        },
        worldCenter: fieldToHavenWorld(map, fieldCenter, getFieldPointElevationWorld(map, fieldCenter) + 0.012),
        worldSize: {
          width: zone.width * HAVEN3D_WORLD_TILE_SIZE * 0.84,
          depth: zone.height * HAVEN3D_WORLD_TILE_SIZE * 0.84,
        },
      };
    }),
  };
}

export function getInteractionZoneForAvatar(
  map: FieldMap,
  avatar: Pick<PlayerAvatar, "x" | "y">,
): InteractionZone | null {
  const tileX = Math.floor(avatar.x / HAVEN3D_FIELD_TILE_SIZE);
  const tileY = Math.floor(avatar.y / HAVEN3D_FIELD_TILE_SIZE);

  return map.interactionZones.find((zone) => (
    tileX >= zone.x
    && tileX < zone.x + zone.width
    && tileY >= zone.y
    && tileY < zone.y + zone.height
  )) ?? null;
}

export function canAvatarMoveTo(
  map: FieldMap,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const halfW = width / 2;
  const halfH = height / 2;
  const corners = [
    { x: x - halfW, y: y - halfH },
    { x: x + halfW, y: y - halfH },
    { x: x - halfW, y: y + halfH },
    { x: x + halfW, y: y + halfH },
  ];

  for (const corner of corners) {
    const tileX = Math.floor(corner.x / HAVEN3D_FIELD_TILE_SIZE);
    const tileY = Math.floor(corner.y / HAVEN3D_FIELD_TILE_SIZE);
    if (tileY < 0 || tileY >= map.height || tileX < 0 || tileX >= map.width) {
      return false;
    }
    if (!map.tiles[tileY]?.[tileX]?.walkable) {
      return false;
    }
  }

  return true;
}

export function fieldFacingFromDelta(
  dx: number,
  dy: number,
  fallback: PlayerAvatar["facing"] = "south",
): PlayerAvatar["facing"] {
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return fallback;
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "east" : "west";
  }

  return dy >= 0 ? "south" : "north";
}

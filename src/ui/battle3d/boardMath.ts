import * as THREE from "three";

export const BOARD_TILE_SIZE = 1;
export const BOARD_TILE_TOP_THICKNESS = 0.12;
export const BOARD_TILE_BASE_BOTTOM = -0.55;
export const BOARD_ELEVATION_STEP = 0.55;

export function getBoardOffsets(width: number, height: number): { x: number; z: number } {
  return {
    x: -(width / 2) + 0.5,
    z: -(height / 2) + 0.5,
  };
}

export function getTileTopY(elevation: number): number {
  return elevation * BOARD_ELEVATION_STEP;
}

export function tileToWorld(
  x: number,
  y: number,
  elevation: number,
  width: number,
  height: number,
): THREE.Vector3 {
  const offsets = getBoardOffsets(width, height);
  return new THREE.Vector3(
    offsets.x + x * BOARD_TILE_SIZE,
    getTileTopY(elevation),
    offsets.z + y * BOARD_TILE_SIZE,
  );
}

export function tileColumnHeight(elevation: number): number {
  return getTileTopY(elevation) - BOARD_TILE_BASE_BOTTOM;
}

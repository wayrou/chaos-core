import { COUNTERWEIGHT_WORKSHOP_MAP_ID } from "../core/weaponsmith";
import type { FieldMap, FieldObject, InteractionZone } from "./types";

const WORKSHOP_WIDTH = 20;
const WORKSHOP_HEIGHT = 13;

function createBaseTiles(): FieldMap["tiles"] {
  const tiles: FieldMap["tiles"] = [];

  for (let y = 0; y < WORKSHOP_HEIGHT; y += 1) {
    tiles[y] = [];
    for (let x = 0; x < WORKSHOP_WIDTH; x += 1) {
      const boundary = x === 0 || y === 0 || x === WORKSHOP_WIDTH - 1 || y === WORKSHOP_HEIGHT - 1;
      tiles[y][x] = {
        x,
        y,
        walkable: !boundary,
        type: boundary ? "wall" : "stone",
      };
    }
  }

  for (let y = 2; y <= 10; y += 1) {
    for (let x = 2; x <= 17; x += 1) {
      tiles[y][x] = {
        ...tiles[y][x],
        walkable: true,
        type: "floor",
      };
    }
  }

  const blockedRects = [
    { left: 3, top: 2, width: 3, height: 2 },
    { left: 14, top: 2, width: 3, height: 2 },
    { left: 14, top: 8, width: 3, height: 2 },
  ];

  blockedRects.forEach(({ left, top, width, height }) => {
    for (let y = top; y < top + height; y += 1) {
      for (let x = left; x < left + width; x += 1) {
        tiles[y][x] = {
          ...tiles[y][x],
          walkable: false,
          type: "wall",
        };
      }
    }
  });

  return tiles;
}

function createObjects(): FieldObject[] {
  return [
    {
      id: "counterweight_workshop_lift",
      x: 1,
      y: 5,
      width: 2,
      height: 3,
      type: "station",
      sprite: "lift_gate",
      metadata: {
        name: "Maintenance Lift",
      },
    },
    {
      id: "counterweight_workshop_bench",
      x: 8,
      y: 4,
      width: 4,
      height: 2,
      type: "station",
      sprite: "repair_bench",
      metadata: {
        name: "Weaponsmith Bench",
      },
    },
    {
      id: "counterweight_workshop_lathe",
      x: 3,
      y: 2,
      width: 3,
      height: 2,
      type: "decoration",
      sprite: "lathe_rig",
      metadata: {
        name: "Lathe Rig",
      },
    },
    {
      id: "counterweight_workshop_cable_spool",
      x: 14,
      y: 2,
      width: 3,
      height: 2,
      type: "decoration",
      sprite: "cable_spool",
      metadata: {
        name: "Drawcord Rack",
      },
    },
    {
      id: "counterweight_workshop_charge_rack",
      x: 14,
      y: 8,
      width: 3,
      height: 2,
      type: "decoration",
      sprite: "charge_rack",
      metadata: {
        name: "Charge Cell Rack",
      },
    },
  ];
}

function createInteractionZones(): InteractionZone[] {
  return [
    {
      id: "counterweight_workshop_service_zone",
      x: 8,
      y: 6,
      width: 4,
      height: 1,
      action: "custom",
      label: "WEAPONSMITH BENCH",
      metadata: {
        handlerId: "weaponsmith_workshop",
      },
    },
    {
      id: "counterweight_workshop_exit_zone",
      x: 2,
      y: 8,
      width: 2,
      height: 1,
      action: "base_camp_entry",
      label: "RETURN LIFT",
      metadata: {
        targetMap: "base_camp",
      },
    },
  ];
}

export function createWeaponsmithWorkshopFieldMap(): FieldMap {
  return {
    id: COUNTERWEIGHT_WORKSHOP_MAP_ID,
    name: "Counterweight Workshop",
    width: WORKSHOP_WIDTH,
    height: WORKSHOP_HEIGHT,
    tiles: createBaseTiles(),
    objects: createObjects(),
    interactionZones: createInteractionZones(),
  };
}

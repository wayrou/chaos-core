// @ts-nocheck

import { describe, expect, it } from "vitest";
import { createNewGameState } from "../initialState";
import {
  OUTER_DECK_OPEN_WORLD_CHUNK_SIZE,
  OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE,
  OUTER_DECK_OPEN_WORLD_DOME_RADIUS_TILES,
  OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE,
  OUTER_DECK_OPEN_WORLD_STREAM_RADIUS,
  OUTER_DECK_OPEN_WORLD_TILE_SIZE,
  OUTER_DECK_OVERWORLD_MAP_ID,
  OUTER_DECK_OVERWORLD_TRAVELING_MERCHANT_ZONE_ID,
  beginOuterDeckExpedition,
  buildOuterDeckInteriorMapId,
  getOuterDeckInteriorLootKey,
  getOuterDeckInteriorRoomKey,
  getOuterDeckInteriorSpec,
  markOuterDeckInteriorLootClaimed,
  markOuterDeckInteriorRoomCleared,
  parseOuterDeckInteriorMapId,
  placeOuterDeckOpenWorldLantern,
  resolveOuterDeckMechanic,
} from "../outerDecks";
import { createOuterDeckFieldMap } from "../../field/outerDeckMaps";
import { createHaven3DSceneLayout } from "../../field/haven3d/coordinates";
import { getFieldMap } from "../../field/maps";
import { setGameState } from "../../state/gameStore";

function createSeededState(seed) {
  const state = createNewGameState();
  return {
    ...state,
    outerDecks: {
      ...state.outerDecks,
      openWorld: {
        ...state.outerDecks.openWorld,
        seed,
        playerWorldX: (OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE.x + 0.5) * OUTER_DECK_OPEN_WORLD_TILE_SIZE,
        playerWorldY: (OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE.y + 0.5) * OUTER_DECK_OPEN_WORLD_TILE_SIZE,
      },
    },
  };
}

function tileSignature(map) {
  const originX = Number(map.metadata?.worldOriginTileX ?? 0);
  const originY = Number(map.metadata?.worldOriginTileY ?? 0);
  const domeCenterX = Number(map.metadata?.domeCenterWorldTileX ?? 0);
  const domeCenterY = Number(map.metadata?.domeCenterWorldTileY ?? 0);
  const startX = Math.max(0, Math.min(map.width - 18, Math.floor(domeCenterX - originX + 18)));
  const startY = Math.max(0, Math.min(map.height - 12, Math.floor(domeCenterY - originY + 18)));
  return map.tiles
    .slice(startY, startY + 12)
    .flatMap((row) => row.slice(startX, startX + 18).map((tile) => `${tile.type}:${tile.walkable ? 1 : 0}:${tile.elevation ?? 0}`))
    .join("|");
}

function hasElevationRun(map, minimumElevation, minimumLength) {
  const isMountainTile = (tile) => tile.render3d !== false && Number(tile.elevation ?? 0) >= minimumElevation;
  const hasRun = (tiles) => {
    let run = 0;
    for (const tile of tiles) {
      run = isMountainTile(tile) ? run + 1 : 0;
      if (run >= minimumLength) {
        return true;
      }
    }
    return false;
  };

  if (map.tiles.some((row) => hasRun(row))) {
    return true;
  }

  for (let x = 0; x < map.width; x += 1) {
    if (hasRun(map.tiles.map((row) => row[x]))) {
      return true;
    }
  }

  return false;
}

function findSeededApronWithInteriorEntrance() {
  for (let seed = 1000; seed < 1300; seed += 1) {
    const state = createSeededState(seed);
    const map = createOuterDeckFieldMap(OUTER_DECK_OVERWORLD_MAP_ID, state);
    const entrances = map.objects.filter((object) => object.metadata?.outerDeckInteriorEntrance === true);
    if (entrances.length > 0) {
      return { seed, state, map, entrances };
    }
  }
  throw new Error("Expected to find a deterministic Apron interior entrance seed");
}

function walkableRatio(map) {
  const tiles = map.tiles.flat();
  return tiles.filter((tile) => tile.walkable).length / tiles.length;
}

describe("outerDeckMaps", () => {
  it("renders unresolved branch mechanics until the route is restored", () => {
    const started = beginOuterDeckExpedition(createNewGameState(), "counterweight_shaft", 1);
    const entryMap = createOuterDeckFieldMap("outerdeck_counterweight_shaft_lower_access", started);

    expect(entryMap?.interactionZones.some((zone) => zone.metadata?.handlerId === "outer_deck_mechanic")).toBe(true);

    const resolved = resolveOuterDeckMechanic(started, "counterweight_shaft_restore_lift_power");
    const resolvedMap = createOuterDeckFieldMap("outerdeck_counterweight_shaft_lower_access", resolved);
    expect(resolvedMap?.interactionZones.some((zone) => zone.metadata?.handlerId === "outer_deck_mechanic")).toBe(false);
  });

  it("adds elite defenders to reward rooms", () => {
    const started = beginOuterDeckExpedition(createNewGameState(), "drop_bay", 1);
    const rewardMap = createOuterDeckFieldMap("outerdeck_drop_bay_dispatch_cradle", started);
    const elite = rewardMap?.objects.find((object) => object.id.includes("_elite"));

    expect(elite).toBeTruthy();
    expect(Number(elite?.metadata?.hp ?? 0)).toBeGreaterThan(5);
  });

  it("builds the streamed open-world window instead of branch gates", () => {
    const overworld = createOuterDeckFieldMap(OUTER_DECK_OVERWORLD_MAP_ID, createSeededState(12345));
    const expectedSize = OUTER_DECK_OPEN_WORLD_CHUNK_SIZE * ((OUTER_DECK_OPEN_WORLD_STREAM_RADIUS * 2) + 1);

    expect(overworld?.width).toBe(expectedSize);
    expect(overworld?.height).toBe(expectedSize);
    expect(overworld?.metadata?.kind).toBe("outerDeckOpenWorld");
    expect(overworld?.metadata?.finiteDome).toBe(true);
    expect(overworld?.metadata?.domeRadiusTiles).toBe(OUTER_DECK_OPEN_WORLD_DOME_RADIUS_TILES);
    expect(overworld?.interactionZones.some((zone) => zone.metadata?.handlerId === "outer_deck_return_to_haven")).toBe(true);
    const merchantZone = overworld?.interactionZones.find((zone) => zone.id === OUTER_DECK_OVERWORLD_TRAVELING_MERCHANT_ZONE_ID);
    expect(merchantZone?.metadata?.handlerId).toBe("outer_deck_traveling_merchant");
    expect(merchantZone?.metadata?.floorOrdinal).toBe(1);
    expect(overworld?.interactionZones.some((zone) => zone.metadata?.handlerId === "outer_deck_branch_gate")).toBe(false);
    const havenElevator = overworld.objects.find((object) => object.id === "outer_deck_world_haven_cargo_elevator");
    expect(havenElevator?.metadata?.havenCargoElevatorExterior).toBe(true);
    expect(havenElevator?.width).toBe(84);
    expect(havenElevator?.height).toBe(52);
    expect(havenElevator?.metadata?.cornerTrackCount).toBe(4);
    expect(Number(havenElevator?.metadata?.skylineTrackHeightWorld ?? 0)).toBeGreaterThanOrEqual(180);
    const travelingMerchant = overworld.objects.find((object) => object.id === "outer_deck_world_traveling_merchant");
    expect(travelingMerchant?.sprite).toBe("traveling_merchant_cart");
    expect(travelingMerchant?.metadata?.travelingMerchant).toBe(true);
    const tileAtWorld = (worldX, worldY) => {
      const metadata = overworld.metadata;
      return overworld.tiles[worldY - metadata.worldOriginTileY]?.[worldX - metadata.worldOriginTileX];
    };
    expect(tileAtWorld(0, 0)?.walkable).toBe(false);
    expect(tileAtWorld(0, 0)?.standable3d).toBe(true);
    expect(Number(tileAtWorld(0, 0)?.elevation ?? 0)).toBeGreaterThanOrEqual(26);
    expect(tileAtWorld(-8, 3)?.walkable).toBe(false);
    expect(tileAtWorld(5, 3)?.walkable).toBe(false);
    expect(tileAtWorld(0, 3)?.walkable).toBe(true);
    expect(tileAtWorld(0, 3)?.standable3d).toBe(false);
    expect(tileAtWorld(0, 4)?.walkable).toBe(true);
    expect(tileAtWorld(8, 8)?.walkable).toBe(false);
    expect(tileAtWorld(7, 8)?.walkable).toBe(true);
    expect(tileAtWorld(
      OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.x + OUTER_DECK_OPEN_WORLD_DOME_RADIUS_TILES,
      OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.y,
    )).toBeUndefined();
    expect(overworld?.objects.some((object) => object.type === "resource")).toBe(true);
    overworld.objects.filter((object) => object.type === "resource").forEach((object) => {
      const tile = overworld.tiles[object.y]?.[object.x];
      expect(tile?.walkable).toBe(true);
      expect(object.metadata?.requiresSable).not.toBe(true);
    });
    expect(overworld?.objects.some((object) => object.type === "enemy")).toBe(true);
    const roamingEnemy = overworld.objects.find((object) => object.type === "enemy" && !object.metadata?.worldBoss);
    expect(Number(roamingEnemy?.metadata?.roamRadiusTiles ?? 0)).toBeGreaterThanOrEqual(4);
    expect(Math.min(...overworld.objects
      .filter((object) => object.type === "enemy" && !object.metadata?.worldBoss)
      .map((object) => Number(object.metadata?.hp ?? 0)))).toBeGreaterThanOrEqual(72);
    const walkableElevations = overworld.tiles.flat().filter((tile) => tile.walkable).map((tile) => tile.elevation ?? 0);
    expect(new Set(walkableElevations).size).toBeGreaterThan(3);
    expect(Math.max(...walkableElevations) - Math.min(...walkableElevations)).toBeGreaterThanOrEqual(28);
    const visibleElevations = overworld.tiles.flat().filter((tile) => tile.render3d !== false).map((tile) => Number(tile.elevation ?? 0));
    expect(Math.max(...visibleElevations)).toBeGreaterThanOrEqual(96);
    expect(visibleElevations.filter((elevation) => elevation >= 76).length).toBeGreaterThanOrEqual(120);
    expect(hasElevationRun(overworld, 76, 8)).toBe(true);
  });

  it("places sparse deterministic generated Apron interior entrances away from HAVEN", () => {
    const { seed, state, map, entrances } = findSeededApronWithInteriorEntrance();
    const repeated = createOuterDeckFieldMap(OUTER_DECK_OVERWORLD_MAP_ID, state);
    const repeatedEntrances = repeated.objects.filter((object) => object.metadata?.outerDeckInteriorEntrance === true);
    const zones = map.interactionZones.filter((zone) => zone.metadata?.handlerId === "outer_deck_interior_entry");

    expect(entrances.length).toBeGreaterThan(0);
    expect(entrances.length).toBeLessThanOrEqual(4);
    expect(entrances.map((object) => object.id).sort()).toEqual(repeatedEntrances.map((object) => object.id).sort());
    expect(zones.length).toBe(entrances.length);
    entrances.forEach((entrance) => {
      expect(Math.floor(Math.hypot(Number(entrance.metadata?.chunkX), Number(entrance.metadata?.chunkY)))).toBeGreaterThanOrEqual(2);
      expect(String(entrance.metadata?.targetMapId)).toMatch(/^outerdeck_interior_f\d+_cx-?\d+_cy-?\d+_d0$/);
    });

    const different = createOuterDeckFieldMap(OUTER_DECK_OVERWORLD_MAP_ID, createSeededState(seed + 1));
    expect(different.objects.map((object) => object.id).sort()).not.toEqual(map.objects.map((object) => object.id).sort());
  });

  it("generates tight corridor mini-chain interiors with clear-gated enemies and final caches", () => {
    const baseState = createSeededState(424242);
    const spec = getOuterDeckInteriorSpec(424242, 1, 2, -2);
    const entryMapId = buildOuterDeckInteriorMapId(1, 2, -2, 0);
    const finalMapId = buildOuterDeckInteriorMapId(1, 2, -2, spec.chainLength - 1);
    const entry = createOuterDeckFieldMap(entryMapId, baseState);
    const final = createOuterDeckFieldMap(finalMapId, baseState);
    const finalRef = parseOuterDeckInteriorMapId(finalMapId);
    const finalRoomKey = getOuterDeckInteriorRoomKey(finalRef);
    const finalLootKey = getOuterDeckInteriorLootKey(finalRef);
    const clearedFinal = createOuterDeckFieldMap(
      finalMapId,
      markOuterDeckInteriorRoomCleared(baseState, finalRoomKey),
    );
    const claimedFinal = createOuterDeckFieldMap(
      finalMapId,
      markOuterDeckInteriorLootClaimed(baseState, finalLootKey),
    );

    expect(entry?.metadata?.kind).toBe("outerDeckInterior");
    expect(entry?.interactionZones.some((zone) => zone.label === "SURFACE")).toBe(true);
    expect(entry?.interactionZones.some((zone) => zone.label === "DEEPER")).toBe(true);
    expect(walkableRatio(entry)).toBeGreaterThan(0.15);
    expect(walkableRatio(entry)).toBeLessThan(0.5);
    expect(entry?.objects.some((object) => object.type === "enemy")).toBe(true);
    expect(final?.interactionZones.some((zone) => zone.metadata?.handlerId === "outer_deck_interior_cache")).toBe(true);
    expect(final?.objects.some((object) => object.id.endsWith("_cache"))).toBe(true);
    expect(clearedFinal?.objects.some((object) => object.type === "enemy")).toBe(false);
    expect(claimedFinal?.interactionZones.some((zone) => zone.metadata?.handlerId === "outer_deck_interior_cache")).toBe(false);
    expect(claimedFinal?.objects.some((object) => object.id.endsWith("_cache"))).toBe(false);
  });

  it("keeps Apron ziplines sparse and tied to real traversal problems", () => {
    const overworld = createOuterDeckFieldMap(OUTER_DECK_OVERWORLD_MAP_ID, createSeededState(6666));
    const ziplineTracks = overworld.objects.filter((object) => object.metadata?.ziplineTrack === true);
    const routeAnchors = overworld.objects.filter((object) => object.metadata?.grappleAnchor && object.metadata?.routeId);
    const routeIds = new Set(ziplineTracks.map((object) => object.metadata?.routeId));

    expect(ziplineTracks.length).toBeGreaterThan(0);
    expect(routeIds.size).toBeLessThanOrEqual(6);
    expect(ziplineTracks.length).toBeLessThanOrEqual(6);
    expect(routeAnchors.length).toBeGreaterThanOrEqual(ziplineTracks.length);
    expect(ziplineTracks.every((object) => object.sprite === "zipline_track")).toBe(true);
    expect(ziplineTracks.every((object) => object.metadata?.startAnchorId && object.metadata?.endAnchorId)).toBe(true);
    ziplineTracks.forEach((object) => {
      const need = object.metadata?.traversalNeed;
      expect(["chasm", "elevation"]).toContain(need);
      if (need === "chasm") {
        expect(Number(object.metadata?.traversalSpanTiles ?? 0)).toBeGreaterThanOrEqual(8);
        expect(Number(object.metadata?.traversalBlockedTiles ?? 0)).toBeGreaterThanOrEqual(3);
        expect(Number(object.metadata?.traversalMaxBlockedRunTiles ?? 0)).toBeGreaterThanOrEqual(2);
      } else {
        expect(Number(object.metadata?.traversalElevationDelta ?? 0)).toBeGreaterThanOrEqual(18);
      }
    });
  });

  it("keeps the HAVEN exterior footprint blocked after generic map cleanup", () => {
    setGameState(createSeededState(12345));
    const overworld = getFieldMap(OUTER_DECK_OVERWORLD_MAP_ID);
    const metadata = overworld.metadata;
    const tileAtWorld = (worldX, worldY) => (
      overworld.tiles[worldY - metadata.worldOriginTileY]?.[worldX - metadata.worldOriginTileX]
    );

    expect(tileAtWorld(0, 0)?.walkable).toBe(false);
    expect(tileAtWorld(0, 0)?.standable3d).toBe(true);
    expect(tileAtWorld(0, 3)?.walkable).toBe(true);
  });

  it("links HAVEN zipline grapple nodes into usable route tracks", () => {
    setGameState(createNewGameState());
    const haven = getFieldMap("base_camp");
    const routeAnchors = haven.objects.filter((object) => (
      object.metadata?.grappleAnchor === true
      && object.metadata?.routeId === "haven_campus_zipline"
    ));
    const ziplineTracks = haven.objects.filter((object) => (
      object.metadata?.ziplineTrack === true
      && object.metadata?.routeId === "haven_campus_zipline"
    ));
    const anchorIds = new Set(routeAnchors.map((object) => object.id));

    expect(routeAnchors).toHaveLength(5);
    expect(routeAnchors.every((object) => object.sprite === "grapple_anchor")).toBe(true);
    expect(routeAnchors.every((object) => Number(object.metadata?.anchorHeight ?? 0) > 4)).toBe(true);
    expect(ziplineTracks).toHaveLength(4);
    expect(ziplineTracks.every((object) => object.sprite === "zipline_track")).toBe(true);
    expect(ziplineTracks.every((object) => (
      anchorIds.has(object.metadata?.startAnchorId)
      && anchorIds.has(object.metadata?.endAnchorId)
    ))).toBe(true);
  });

  it("streams a window through the enlarged finite Apron dome", () => {
    const nearHaven = createOuterDeckFieldMap(OUTER_DECK_OVERWORLD_MAP_ID, createSeededState(2222));
    const farState = createSeededState(2222);
    farState.outerDecks.openWorld.playerWorldX = (
      OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.x + OUTER_DECK_OPEN_WORLD_DOME_RADIUS_TILES - 6
    ) * OUTER_DECK_OPEN_WORLD_TILE_SIZE;
    farState.outerDecks.openWorld.playerWorldY = OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.y * OUTER_DECK_OPEN_WORLD_TILE_SIZE;
    const nearWall = createOuterDeckFieldMap(OUTER_DECK_OVERWORLD_MAP_ID, farState);
    const tileAtWorld = (map, worldX, worldY) => (
      map.tiles[worldY - map.metadata.worldOriginTileY]?.[worldX - map.metadata.worldOriginTileX]
    );
    const eastDomeWall = tileAtWorld(
      nearWall,
      OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.x + OUTER_DECK_OPEN_WORLD_DOME_RADIUS_TILES,
      OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.y,
    );
    const hiddenBeyondDome = tileAtWorld(
      nearWall,
      OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.x + OUTER_DECK_OPEN_WORLD_DOME_RADIUS_TILES + 2,
      OUTER_DECK_OPEN_WORLD_DOME_CENTER_TILE.y,
    );

    expect(nearWall?.metadata?.worldOriginTileX).not.toBe(nearHaven?.metadata?.worldOriginTileX);
    expect(nearWall?.metadata?.worldOriginTileY).toBe(nearHaven?.metadata?.worldOriginTileY);
    expect(eastDomeWall?.walkable).toBe(false);
    expect(eastDomeWall?.render3d).not.toBe(false);
    expect(hiddenBeyondDome?.walkable).toBe(false);
    expect(hiddenBeyondDome?.render3d).toBe(false);
  });

  it("renders placed Apron lanterns as visible elevated light objects", () => {
    const baseState = createSeededState(6666);
    const baseMap = createOuterDeckFieldMap(OUTER_DECK_OVERWORLD_MAP_ID, baseState);
    const metadata = baseMap.metadata;
    const hasBlockingObject = (tile) => baseMap.objects.some((object) => {
      if (object.type === "enemy" || object.metadata?.ziplineTrack === true || object.metadata?.havenCargoElevatorExterior === true) {
        return false;
      }
      return tile.x >= object.x
        && tile.x < object.x + object.width
        && tile.y >= object.y
        && tile.y < object.y + object.height;
    });
    const elevatedTile = baseMap.tiles
      .flat()
      .find((tile) => tile.walkable && tile.render3d !== false && (tile.elevation ?? 0) >= 6 && !hasBlockingObject(tile));

    expect(elevatedTile).toBeTruthy();

    const worldTileX = metadata.worldOriginTileX + elevatedTile.x;
    const worldTileY = metadata.worldOriginTileY + elevatedTile.y;
    const mapWithLantern = createOuterDeckFieldMap(
      OUTER_DECK_OVERWORLD_MAP_ID,
      placeOuterDeckOpenWorldLantern(baseState, {
        id: "test_elevated_lantern",
        worldTileX,
        worldTileY,
        placedAt: 123,
      }),
    );
    const lantern = mapWithLantern.objects.find((object) => object.id === "test_elevated_lantern");
    const lanternPlacement = createHaven3DSceneLayout(mapWithLantern)
      .objects
      .find((object) => object.id === "test_elevated_lantern");

    expect(lantern?.sprite).toBe("apron_lantern");
    expect(lantern?.metadata?.apronLightSource).toBe(true);
    expect(lantern?.metadata?.elevation).toBe(elevatedTile.elevation);
    expect(lanternPlacement?.worldCenter.y).toBeGreaterThan(0.08);
  });

  it("generates deterministic streamed windows by seed", () => {
    const first = createOuterDeckFieldMap(OUTER_DECK_OVERWORLD_MAP_ID, createSeededState(2222));
    const second = createOuterDeckFieldMap(OUTER_DECK_OVERWORLD_MAP_ID, createSeededState(2222));
    const different = createOuterDeckFieldMap(OUTER_DECK_OVERWORLD_MAP_ID, createSeededState(3333));

    expect(tileSignature(first)).toBe(tileSignature(second));
    expect(first.objects.map((object) => object.id).sort()).toEqual(second.objects.map((object) => object.id).sort());
    expect(tileSignature(first)).not.toBe(tileSignature(different));
  });

  it("keeps adjacent generated chunks connected at seams", () => {
    const overworld = createOuterDeckFieldMap(OUTER_DECK_OVERWORLD_MAP_ID, createSeededState(4444));
    const seamX = OUTER_DECK_OPEN_WORLD_CHUNK_SIZE;
    const sampleRows = [60, 72, 96, 112];

    sampleRows.forEach((y) => {
      expect(overworld.tiles[y][seamX - 1].walkable).toBe(true);
      expect(overworld.tiles[y][seamX].walkable).toBe(true);
    });

    const seamTiles = overworld.tiles.map((row) => row[seamX]);
    const seamElevations = seamTiles.map((tile) => tile.elevation ?? 0);
    const floorTileRatio = seamTiles.filter((tile) => tile.type === "floor").length / seamTiles.length;
    expect(new Set(seamElevations).size).toBeGreaterThan(2);
    expect(floorTileRatio).toBeLessThan(0.85);
  });

  it("filters collected resources and defeated bosses from regenerated windows", () => {
    const state = createSeededState(5555);
    const overworld = createOuterDeckFieldMap(OUTER_DECK_OVERWORLD_MAP_ID, state);
    const resource = overworld.objects.find((object) => object.type === "resource");
    const boss = overworld.objects.find((object) => object.metadata?.worldBoss);
    const mutated = {
      ...state,
      outerDecks: {
        ...state.outerDecks,
        openWorld: {
          ...state.outerDecks.openWorld,
          collectedResourceKeys: [resource.metadata.persistentKey],
          defeatedBossKeys: [boss.metadata.bossKey],
        },
      },
    };
    const regenerated = createOuterDeckFieldMap(OUTER_DECK_OVERWORLD_MAP_ID, mutated);

    expect(regenerated.objects.some((object) => object.id === resource.id)).toBe(false);
    expect(regenerated.objects.some((object) => object.id === boss.id)).toBe(false);
  });
});

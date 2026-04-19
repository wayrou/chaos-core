// @ts-nocheck

import { describe, expect, it } from "vitest";
import { createNewGameState } from "../initialState";
import {
  OUTER_DECK_OPEN_WORLD_CHUNK_SIZE,
  OUTER_DECK_OPEN_WORLD_ENTRY_WORLD_TILE,
  OUTER_DECK_OPEN_WORLD_STREAM_RADIUS,
  OUTER_DECK_OPEN_WORLD_TILE_SIZE,
  OUTER_DECK_OVERWORLD_MAP_ID,
  beginOuterDeckExpedition,
  resolveOuterDeckMechanic,
} from "../outerDecks";
import { createOuterDeckFieldMap } from "../../field/outerDeckMaps";

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
  return map.tiles
    .slice(0, 12)
    .flatMap((row) => row.slice(0, 18).map((tile) => `${tile.type}:${tile.walkable ? 1 : 0}:${tile.elevation ?? 0}`))
    .join("|");
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
    expect(overworld?.interactionZones.some((zone) => zone.metadata?.handlerId === "outer_deck_return_to_haven")).toBe(true);
    expect(overworld?.interactionZones.some((zone) => zone.metadata?.handlerId === "outer_deck_branch_gate")).toBe(false);
    expect(overworld?.objects.some((object) => object.metadata?.grappleAnchor)).toBe(true);
    expect(overworld?.objects.some((object) => object.type === "resource")).toBe(true);
    expect(overworld?.objects.some((object) => object.type === "enemy")).toBe(true);
    expect(Math.min(...overworld.objects
      .filter((object) => object.type === "enemy" && !object.metadata?.worldBoss)
      .map((object) => Number(object.metadata?.hp ?? 0)))).toBeGreaterThanOrEqual(72);
    expect(new Set(overworld?.tiles.flat().map((tile) => tile.elevation ?? 0)).size).toBeGreaterThan(1);
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
    const sampleRows = [4, 12, 23, 36, 48, 72, 96, 112];

    sampleRows.forEach((y) => {
      expect(overworld.tiles[y][seamX - 1].walkable).toBe(true);
      expect(overworld.tiles[y][seamX].walkable).toBe(true);
    });
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

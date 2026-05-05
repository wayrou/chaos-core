import { describe, expect, it } from "vitest";
import {
  areBattleAuthorityPlacementsReady,
  doesBattleUnitMatchAuthorityPlayer,
  filterBattleUnitsByAuthorityPlayer,
  getNextUnplacedBattleUnitForAuthorityPlayer,
  hasBattlePlacementUnitForAuthorityPlayer,
  normalizeBattleAuthorityPlayerId,
  summarizeBattleAuthorityPlacements,
} from "../battleAuthority";

const sampleUnits = [
  { id: "aeriss", controller: "P1", pos: null },
  { id: "sable", controller: "P2", pos: null },
  { id: "warden", controller: "P1", pos: { x: 1, y: 1 } },
  { id: "magician", controller: "P2", pos: { x: 3, y: 0 } },
] as const;

describe("battleAuthority", () => {
  it("normalizes supported local battle authority players", () => {
    expect(normalizeBattleAuthorityPlayerId("P1")).toBe("P1");
    expect(normalizeBattleAuthorityPlayerId("P2")).toBe("P2");
    expect(normalizeBattleAuthorityPlayerId("remote")).toBeNull();
    expect(normalizeBattleAuthorityPlayerId(null)).toBeNull();
  });

  it("matches unit ownership against the acting local player", () => {
    expect(doesBattleUnitMatchAuthorityPlayer({ controller: "P1" }, "P1")).toBe(true);
    expect(doesBattleUnitMatchAuthorityPlayer({ controller: "P2" }, "P1")).toBe(false);
    expect(doesBattleUnitMatchAuthorityPlayer({ controller: undefined }, "P1")).toBe(true);
    expect(doesBattleUnitMatchAuthorityPlayer({ controller: "P2" }, undefined)).toBe(true);
  });

  it("filters battle units down to the owning local player", () => {
    expect(filterBattleUnitsByAuthorityPlayer(sampleUnits, "P1").map((unit) => unit.id)).toEqual([
      "aeriss",
      "warden",
    ]);
    expect(filterBattleUnitsByAuthorityPlayer(sampleUnits, "P2").map((unit) => unit.id)).toEqual([
      "sable",
      "magician",
    ]);
  });

  it("selects the next unplaced unit for the acting local player", () => {
    expect(
      getNextUnplacedBattleUnitForAuthorityPlayer(sampleUnits, ["aeriss"], "P1"),
    ).toBeNull();
    expect(
      getNextUnplacedBattleUnitForAuthorityPlayer(sampleUnits, ["aeriss"], "P2")?.id,
    ).toBe("sable");
    expect(
      getNextUnplacedBattleUnitForAuthorityPlayer(sampleUnits, [], "P1")?.id,
    ).toBe("aeriss");
  });

  it("reports whether a player still has placement authority available", () => {
    expect(hasBattlePlacementUnitForAuthorityPlayer(sampleUnits, ["aeriss"], "P1")).toBe(false);
    expect(hasBattlePlacementUnitForAuthorityPlayer(sampleUnits, ["aeriss"], "P2")).toBe(true);
    expect(hasBattlePlacementUnitForAuthorityPlayer(sampleUnits, ["aeriss", "sable"], "P2")).toBe(false);
  });

  it("summarizes local battle placement readiness per player", () => {
    const summaries = summarizeBattleAuthorityPlacements(sampleUnits, ["aeriss"], 3, ["P1", "P2"]);
    expect(summaries).toEqual([
      {
        playerId: "P1",
        totalUnits: 2,
        placedUnits: 1,
        remainingUnits: 1,
        blockedByCapacity: false,
        ready: true,
      },
      {
        playerId: "P2",
        totalUnits: 2,
        placedUnits: 0,
        remainingUnits: 2,
        blockedByCapacity: false,
        ready: false,
      },
    ]);
    expect(areBattleAuthorityPlacementsReady(summaries)).toBe(false);
  });

  it("treats a player as ready when placement capacity is already full", () => {
    const summaries = summarizeBattleAuthorityPlacements(sampleUnits, ["aeriss", "warden"], 2, ["P1", "P2"]);
    expect(summaries[1]).toMatchObject({
      playerId: "P2",
      blockedByCapacity: true,
      ready: true,
    });
    expect(areBattleAuthorityPlacementsReady(summaries)).toBe(true);
  });
});

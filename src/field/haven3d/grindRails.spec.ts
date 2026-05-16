import { describe, expect, it } from "vitest";
import {
  projectPointOntoGrindRailSegment,
  resolveGrindRailDirectionFromVector,
  resolveLinkedGrindRailSegment,
} from "./Haven3DFieldController";

describe("grind rail helpers", () => {
  it("projects field points onto a rail segment and interpolates height", () => {
    const segment = {
      start: {
        fieldPoint: { x: 100, y: 120 },
        height: 1.8,
      },
      end: {
        fieldPoint: { x: 260, y: 120 },
        height: 3.4,
      },
      length: 160,
    };

    const projection = projectPointOntoGrindRailSegment({ x: 180, y: 148 }, segment);

    expect(projection.t).toBeCloseTo(0.5, 2);
    expect(projection.point.x).toBeCloseTo(180, 4);
    expect(projection.point.y).toBeCloseTo(120, 4);
    expect(projection.distancePx).toBeCloseTo(28, 4);
    expect(projection.height).toBeCloseTo(2.6, 4);
  });

  it("picks the correct grind direction from incoming motion or facing fallback", () => {
    const segment = {
      directionX: 1,
      directionY: 0,
    };

    expect(resolveGrindRailDirectionFromVector(segment, { x: 0.8, y: 0 }, "west")).toBe(1);
    expect(resolveGrindRailDirectionFromVector(segment, { x: -0.6, y: 0 }, "east")).toBe(-1);
    expect(resolveGrindRailDirectionFromVector(segment, null, "east")).toBe(1);
    expect(resolveGrindRailDirectionFromVector(segment, null, "west")).toBe(-1);
  });

  it("finds linked rail continuation in both forward and reverse traversal", () => {
    const segments = new Map([
      ["rail:a", {
        id: "rail_a",
        key: "rail:a",
        routeId: "haven_combo",
        segmentIndex: 0,
        nextSegmentIndex: 1,
        launchAtEnd: true,
        start: { fieldPoint: { x: 0, y: 0 }, height: 1.2 },
        end: { fieldPoint: { x: 100, y: 0 }, height: 1.8 },
        length: 100,
        directionX: 1,
        directionY: 0,
      }],
      ["rail:b", {
        id: "rail_b",
        key: "rail:b",
        routeId: "haven_combo",
        segmentIndex: 1,
        launchAtEnd: true,
        start: { fieldPoint: { x: 100, y: 0 }, height: 1.8 },
        end: { fieldPoint: { x: 180, y: 40 }, height: 2.3 },
        length: 89.44,
        directionX: 0.8944,
        directionY: 0.4472,
      }],
    ]);

    const forward = resolveLinkedGrindRailSegment(segments.get("rail:a")!, 1, segments);
    const reverse = resolveLinkedGrindRailSegment(segments.get("rail:b")!, -1, segments);

    expect(forward).toEqual({ segmentKey: "rail:b", direction: 1 });
    expect(reverse).toEqual({ segmentKey: "rail:a", direction: -1 });
  });
});

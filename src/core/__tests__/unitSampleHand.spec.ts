import { describe, expect, it } from "vitest";
import {
  drawNextUnitSampleHand,
  playUnitSampleHandCard,
  resetUnitSampleHandState,
  SAMPLE_HAND_TURN_STRAIN_RELIEF,
} from "../unitSampleHand";

const keepOrder = <T>(items: T[]): T[] => [...items];

describe("unitSampleHand", () => {
  it("plays sample cards, advances hands, and cools strain on redraw", () => {
    const deck = ["a", "b", "c", "d", "e", "f", "g"];

    const resetState = resetUnitSampleHandState("unit_1", deck, keepOrder);
    expect(resetState?.strain).toBe(0);
    expect(resetState?.hand).toEqual([]);

    const firstDraw = drawNextUnitSampleHand(resetState ?? null, "unit_1", deck, keepOrder);
    expect(firstDraw?.hand).toEqual(["a", "b", "c", "d", "e"]);
    expect(firstDraw?.drawPile).toEqual(["f", "g"]);
    expect(firstDraw?.strain).toBe(0);

    const afterPlay = playUnitSampleHandCard(firstDraw ?? null, 1, 3);
    expect(afterPlay?.hand).toEqual(["a", "c", "d", "e"]);
    expect(afterPlay?.discardPile).toEqual(["b"]);
    expect(afterPlay?.strain).toBe(3);

    const secondDraw = drawNextUnitSampleHand(afterPlay ?? null, "unit_1", deck, keepOrder);
    expect(secondDraw?.strain).toBe(3 - SAMPLE_HAND_TURN_STRAIN_RELIEF);
    expect(secondDraw?.hand).toEqual(["f", "g", "b", "a", "c"]);
    expect(secondDraw?.discardPile).toEqual([]);
  });

  it("resets sample state back to zero strain", () => {
    const deck = ["a", "b", "c"];
    const firstDraw = drawNextUnitSampleHand(null, "unit_2", deck, keepOrder);
    const afterPlay = playUnitSampleHandCard(firstDraw ?? null, 0, 2);

    expect(afterPlay?.strain).toBe(2);

    const resetState = resetUnitSampleHandState("unit_2", deck, keepOrder);
    expect(resetState?.strain).toBe(0);
    expect(resetState?.hand).toEqual([]);
    expect(resetState?.discardPile).toEqual([]);
  });
});

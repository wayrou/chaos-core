import { describe, expect, it } from "vitest";
import { CORE_CARDS, getAllEquipmentCards } from "../equipment";

describe("equipment card data", () => {
  it("keeps Move+ at its intended strain cost", () => {
    expect(CORE_CARDS.find((card) => card.id === "core_move_plus")?.strainCost).toBe(1);
    expect(getAllEquipmentCards().core_move_plus?.strainCost).toBe(1);
  });
});

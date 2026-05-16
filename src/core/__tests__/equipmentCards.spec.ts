import { describe, expect, it } from "vitest";
import { CORE_CARDS, buildDeckFromLoadout, getAllEquipmentCards, getAllStarterEquipment } from "../equipment";

describe("equipment card data", () => {
  it("keeps Move+ at its intended strain cost", () => {
    expect(CORE_CARDS.find((card) => card.id === "core_move_plus")?.strainCost).toBe(3);
    expect(getAllEquipmentCards().core_move_plus?.strainCost).toBe(3);
  });

  it("keeps Chaos Call exclusive to the magician class line core package", () => {
    const emptyLoadout = {
      primaryWeapon: null,
      secondaryWeapon: null,
      helmet: null,
      chestpiece: null,
      accessory1: null,
      accessory2: null,
    };
    const equipmentById = getAllStarterEquipment();

    expect(buildDeckFromLoadout("squire", emptyLoadout, equipmentById)).not.toContain("core_chaos_call");
    expect(buildDeckFromLoadout("ranger", emptyLoadout, equipmentById)).not.toContain("core_chaos_call");
    expect(buildDeckFromLoadout("magician", emptyLoadout, equipmentById)).toContain("core_chaos_call");
    expect(buildDeckFromLoadout("cleric", emptyLoadout, equipmentById)).toContain("core_chaos_call");
    expect(buildDeckFromLoadout("wizard", emptyLoadout, equipmentById)).toContain("core_chaos_call");
    expect(buildDeckFromLoadout("chaosmancer", emptyLoadout, equipmentById)).toContain("core_chaos_call");
  });
});

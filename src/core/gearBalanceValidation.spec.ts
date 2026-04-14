import { describe, expect, it } from "vitest";
import { validateGearBalance } from "./gearBalanceValidation";

describe("gear balance validation", () => {
  it("passes a starter-style weapon entry", () => {
    const report = validateGearBalance({
      id: "test_iron_longsword",
      name: "Iron Longsword",
      slot: "weapon",
      weaponType: "sword",
      isMechanical: false,
      stats: {
        atk: 2,
        def: 1,
        agi: 0,
        acc: 1,
        hp: 0,
      },
      cardsGranted: ["card_a", "card_b", "card_c"],
    });

    expect(report.status).toBe("pass");
    expect(report.findings).toHaveLength(0);
  });

  it("fails a wildly overtuned weapon entry", () => {
    const report = validateGearBalance({
      id: "test_broken_weapon",
      name: "Broken Weapon",
      slot: "weapon",
      weaponType: "gun",
      isMechanical: true,
      stats: {
        atk: 90,
        def: 1,
        agi: 0,
        acc: 1,
        hp: 2,
      },
      cardsGranted: [],
    });

    expect(report.status).toBe("fail");
    expect(report.findings.some((finding) => finding.code === "atk_high")).toBe(true);
    expect(report.findings.some((finding) => finding.code === "score_high")).toBe(true);
  });

  it("fails a weapon that omits its weapon type", () => {
    const report = validateGearBalance({
      id: "test_missing_type",
      name: "Missing Type",
      slot: "weapon",
      stats: {
        atk: 2,
        def: 1,
        agi: 0,
        acc: 1,
        hp: 0,
      },
      cardsGranted: ["card_a", "card_b", "card_c"],
    });

    expect(report.status).toBe("fail");
    expect(report.findings.some((finding) => finding.code === "missing_weapon_type")).toBe(true);
  });
});

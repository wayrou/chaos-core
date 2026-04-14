import { describe, expect, it } from "vitest";
import { getCraftedGearDescription } from "./craftedGear";
import { canEquipWeapon } from "./equipment";
import { previewBuildGear } from "./gearBuilder";

describe("gear builder", () => {
  it("keeps crafted weapon accuracy on the additive modifier scale", () => {
    const preview = previewBuildGear("chassis_precision_rifle", "doctrine_sustain", "Test Build", "gun");
    expect(preview).not.toBeNull();
    expect(preview?.slot).toBe("weapon");
    if (!preview || preview.slot !== "weapon") {
      return;
    }

    expect(preview.weaponType).toBe("gun");
    expect(preview.stats.acc).toBeGreaterThanOrEqual(0);
    expect(preview.stats.acc).toBeLessThanOrEqual(3);
  });

  it("maps new weapon shapes onto existing class restriction lanes", () => {
    expect(canEquipWeapon("squire", "spear")).toBe(true);
    expect(canEquipWeapon("sentry", "greatspear")).toBe(true);
    expect(canEquipWeapon("sentry", "hammer")).toBe(true);
    expect(canEquipWeapon("ranger", "hammer")).toBe(false);
  });

  it("formats built gear descriptions without duplicated doctrine wording", () => {
    const description = getCraftedGearDescription("Rivetspine Frame", "Sustain Doctrine");
    expect(description).toContain("Rivetspine Frame");
    expect(description).toContain("Sustain Doctrine pattern");
    expect(description).not.toContain("Doctrine doctrine");
  });
});

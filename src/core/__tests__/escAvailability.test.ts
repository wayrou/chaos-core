// @ts-nocheck

import {
  getEscActionAvailability,
  getEscExpeditionRestrictionMessage,
  isEscActionEnabled,
} from "../escAvailability";

describe("escAvailability", () => {
  it("keeps the requested expedition subset active and disables the rest", () => {
    const expedition = { expeditionActive: true };

    expect(getEscActionAvailability("inventory", expedition)).toBe("active");
    expect(getEscActionAvailability("roster", expedition)).toBe("active");
    expect(getEscActionAvailability("materials-refinery", expedition)).toBe("active");
    expect(getEscActionAvailability("codex", expedition)).toBe("active");
    expect(getEscActionAvailability("settings", expedition)).toBe("active");

    expect(getEscActionAvailability("ops-terminal", expedition)).toBe("disabled");
    expect(getEscActionAvailability("gear-workbench", expedition)).toBe("disabled");
    expect(getEscActionAvailability("shop", expedition)).toBe("disabled");
    expect(getEscActionAvailability("dispatch", expedition)).toBe("disabled");
    expect(getEscActionAvailability("comms-array", expedition)).toBe("disabled");
  });

  it("leaves actions active outside expeditions", () => {
    expect(isEscActionEnabled("ops-terminal", { expeditionActive: false })).toBe(true);
    expect(isEscActionEnabled("materials-refinery", { expeditionActive: false })).toBe(true);
  });

  it("returns the expedition restriction message", () => {
    expect(getEscExpeditionRestrictionMessage("ops-terminal")).toMatch(/Unavailable during Outer Deck expedition/i);
  });
});

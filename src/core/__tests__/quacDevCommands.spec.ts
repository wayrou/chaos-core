import { describe, expect, it } from "vitest";

import { createTestBattleForCurrentParty } from "../battle";
import { createNewGameState } from "../initialState";
import {
  forceBattleVictory,
  isQuacDebugAutoWinBattlesEnabled,
  runQuacDebugCommand,
} from "../quacDevCommands";

describe("quacDevCommands", () => {
  it("toggles battle auto win on", () => {
    const state = createNewGameState();

    const result = runQuacDebugCommand(state, "/auto win battles on");
    if (!result.handled) {
      throw new Error("Expected /auto win battles on to be handled.");
    }

    expect(result.success).toBe(true);
    expect(isQuacDebugAutoWinBattlesEnabled(result.state)).toBe(true);
  });

  it("resolves an active battle when auto win is enabled", () => {
    const baseState = createNewGameState();
    const battle = createTestBattleForCurrentParty(baseState);
    expect(battle).not.toBeNull();

    const state = {
      ...baseState,
      phase: "battle" as const,
      currentBattle: battle,
      session: {
        ...baseState.session,
        activeBattleId: battle?.id ?? null,
      },
    };

    const result = runQuacDebugCommand(state, "/auto win battles on");
    if (!result.handled) {
      throw new Error("Expected /auto win battles on to be handled.");
    }

    expect(result.success).toBe(true);
    expect(result.shouldRenderBattle).toBe(true);
    expect(result.state.currentBattle?.phase).toBe("victory");
  });

  it("grants consumables by name", () => {
    const state = createNewGameState();

    const result = runQuacDebugCommand(state, "/give 5 healing kit");
    if (!result.handled) {
      throw new Error("Expected /give 5 healing kit to be handled.");
    }

    expect(result.success).toBe(true);
    expect(result.state.consumables.consumable_healing_kit).toBe(5);
  });

  it("grants authored equipment by display name", () => {
    const state = createNewGameState();

    const result = runQuacDebugCommand(state, "/give 1 ironguard helm");
    if (!result.handled) {
      throw new Error("Expected /give 1 ironguard helm to be handled.");
    }

    expect(result.success).toBe(true);
    expect(result.state.equipmentPool).toContain("armor_ironguard_helm");
    expect(result.state.equipmentById?.armor_ironguard_helm?.name).toBe("Ironguard Helm");
  });

  it("grants WAD through the shared session economy", () => {
    const state = createNewGameState();

    const result = runQuacDebugCommand(state, "/give 120 wad");
    if (!result.handled) {
      throw new Error("Expected /give 120 wad to be handled.");
    }

    expect(result.success).toBe(true);
    expect(result.state.wad).toBe(state.wad + 120);
  });

  it("forces a placement battle straight to victory", () => {
    const state = createNewGameState();
    const battle = createTestBattleForCurrentParty(state);
    expect(battle).not.toBeNull();
    expect(battle?.phase).toBe("placement");

    const resolvedBattle = forceBattleVictory(battle!);

    expect(resolvedBattle.phase).toBe("victory");
    expect(Object.values(resolvedBattle.units).every((unit) => !unit.isEnemy || unit.hp <= 0 || unit.pos === null)).toBe(true);
  });
});

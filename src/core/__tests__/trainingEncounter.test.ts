// ============================================================================
// CHAOS CORE - TRAINING ENCOUNTER TESTS
// ============================================================================

import { describe, it, expect, beforeEach } from "@jest/globals";
import { createTrainingEncounter, TrainingConfig } from "../trainingEncounter";
import { createNewGameState } from "../initialState";
import { GameState } from "../types";

describe("Training Encounter System", () => {
  let baseState: GameState;
  
  beforeEach(() => {
    baseState = createNewGameState();
  });
  
  describe("createTrainingEncounter", () => {
    it("should respect grid bounds (4-8 width, 3-6 height)", () => {
      const validConfig: TrainingConfig = {
        gridW: 6,
        gridH: 4,
        difficulty: "normal",
        rules: { noRewards: true },
      };
      
      const encounter = createTrainingEncounter(baseState, validConfig);
      expect(encounter).toBeDefined();
      expect(encounter?.gridWidth).toBe(6);
      expect(encounter?.gridHeight).toBe(4);
    });
    
    it("should reject invalid grid width (too small)", () => {
      const invalidConfig: TrainingConfig = {
        gridW: 3, // Too small
        gridH: 4,
        difficulty: "normal",
        rules: { noRewards: true },
      };
      
      const encounter = createTrainingEncounter(baseState, invalidConfig);
      expect(encounter).toBeNull();
    });
    
    it("should reject invalid grid width (too large)", () => {
      const invalidConfig: TrainingConfig = {
        gridW: 9, // Too large
        gridH: 4,
        difficulty: "normal",
        rules: { noRewards: true },
      };
      
      const encounter = createTrainingEncounter(baseState, invalidConfig);
      expect(encounter).toBeNull();
    });
    
    it("should reject invalid grid height (too small)", () => {
      const invalidConfig: TrainingConfig = {
        gridW: 6,
        gridH: 2, // Too small
        difficulty: "normal",
        rules: { noRewards: true },
      };
      
      const encounter = createTrainingEncounter(baseState, invalidConfig);
      expect(encounter).toBeNull();
    });
    
    it("should reject invalid grid height (too large)", () => {
      const invalidConfig: TrainingConfig = {
        gridW: 6,
        gridH: 7, // Too large
        difficulty: "normal",
        rules: { noRewards: true },
      };
      
      const encounter = createTrainingEncounter(baseState, invalidConfig);
      expect(encounter).toBeNull();
    });
    
    it("should set training flag on encounter", () => {
      const config: TrainingConfig = {
        gridW: 6,
        gridH: 4,
        difficulty: "normal",
        rules: { noRewards: true },
      };
      
      const encounter = createTrainingEncounter(baseState, config);
      expect(encounter).toBeDefined();
      expect((encounter as any).isTraining).toBe(true);
      expect((encounter as any).trainingConfig).toEqual(config);
    });
    
    it("should generate enemy units based on difficulty", () => {
      const easyConfig: TrainingConfig = {
        gridW: 6,
        gridH: 4,
        difficulty: "easy",
        rules: { noRewards: true },
      };
      
      const hardConfig: TrainingConfig = {
        gridW: 6,
        gridH: 4,
        difficulty: "hard",
        rules: { noRewards: true },
      };
      
      const easyEncounter = createTrainingEncounter(baseState, easyConfig);
      const hardEncounter = createTrainingEncounter(baseState, hardConfig);
      
      expect(easyEncounter).toBeDefined();
      expect(hardEncounter).toBeDefined();
      
      // Hard should generally have more enemies (or at least different composition)
      const easyEnemyCount = easyEncounter!.enemyUnits.reduce((sum, u) => sum + u.count, 0);
      const hardEnemyCount = hardEncounter!.enemyUnits.reduce((sum, u) => sum + u.count, 0);
      
      // Hard mode should have at least as many enemies as easy (or more)
      expect(hardEnemyCount).toBeGreaterThanOrEqual(easyEnemyCount);
    });
  });
  
  describe("Training Flag Validation", () => {
    it("should mark encounter with isTraining flag", () => {
      const config: TrainingConfig = {
        gridW: 5,
        gridH: 4,
        difficulty: "normal",
        rules: { noRewards: true },
      };
      
      const encounter = createTrainingEncounter(baseState, config);
      expect(encounter).toBeDefined();
      expect((encounter as any).isTraining).toBe(true);
    });
  });
});


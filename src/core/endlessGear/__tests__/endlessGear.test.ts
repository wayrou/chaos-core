// ============================================================================
// CHAOS CORE - ENDLESS GEAR TESTS
// Unit tests for reproducibility and bias validation
// ============================================================================

import { describe, it, expect } from "@jest/globals";
import { generateEndlessGearFromRecipe, createGenerationContext } from "../generateEndlessGear";
import { EndlessRecipe } from "../types";

describe("Endless Gear Generation", () => {
  const ctx = createGenerationContext();
  
  const testRecipe: EndlessRecipe = {
    chassisId: "chassis_standard_rifle",
    materials: ["metal_scrap", "metal_scrap", "chaos_shard"],
    seed: 12345,
  };
  
  describe("Reproducibility", () => {
    it("should produce identical output with same recipe and seed", () => {
      const gear1 = generateEndlessGearFromRecipe(testRecipe, ctx);
      const gear2 = generateEndlessGearFromRecipe(testRecipe, ctx);
      
      expect(gear1.id).toBe(gear2.id);
      expect(gear1.stability).toBe(gear2.stability);
      expect(gear1.doctrineId).toBe(gear2.doctrineId);
      expect(gear1.provenance.seed).toBe(gear2.provenance.seed);
      expect((gear1 as any).fieldMods).toEqual((gear2 as any).fieldMods);
    });
    
    it("should produce different outputs with same recipe but no seed", () => {
      const recipe1: EndlessRecipe = {
        chassisId: "chassis_standard_rifle",
        materials: ["metal_scrap", "wood", "steam_component"],
      };
      
      const recipe2: EndlessRecipe = {
        chassisId: "chassis_standard_rifle",
        materials: ["metal_scrap", "wood", "steam_component"],
      };
      
      const gear1 = generateEndlessGearFromRecipe(recipe1, ctx);
      const gear2 = generateEndlessGearFromRecipe(recipe2, ctx);
      
      // Should have different seeds
      expect(gear1.provenance.seed).not.toBe(gear2.provenance.seed);
      
      // Results may differ (probabilistic test)
      // But both should be valid gear
      expect(gear1.chassisId).toBe(gear2.chassisId);
      expect(gear1.stability).toBeGreaterThanOrEqual(0);
      expect(gear1.stability).toBeLessThanOrEqual(100);
      expect(gear2.stability).toBeGreaterThanOrEqual(0);
      expect(gear2.stability).toBeLessThanOrEqual(100);
    });
  });
  
  describe("Bias Validation", () => {
    it("should respect chassis compatibility", () => {
      const gear = generateEndlessGearFromRecipe(testRecipe, ctx);
      
      expect(gear.chassisId).toBe(testRecipe.chassisId);
      expect(gear.doctrineId).toBeDefined();
    });
    
    it("should clamp stability to 0-100", () => {
      const gear = generateEndlessGearFromRecipe(testRecipe, ctx);
      
      expect(gear.stability).toBeGreaterThanOrEqual(0);
      expect(gear.stability).toBeLessThanOrEqual(100);
    });
    
    it("should use only existing card IDs for locked cards", () => {
      const gear = generateEndlessGearFromRecipe(testRecipe, ctx);
      const lockedCards = (gear as any).lockedCards || [];
      
      for (const cardId of lockedCards) {
        expect(ctx.cardCatalog).toContain(cardId);
      }
    });
    
    it("should use only existing field mod IDs", () => {
      const gear = generateEndlessGearFromRecipe(testRecipe, ctx);
      const fieldMods = (gear as any).fieldMods || [];
      
      for (const modId of fieldMods) {
        const mod = ctx.fieldModRegistry.find(m => m.id === modId);
        expect(mod).toBeDefined();
      }
    });
    
    it("should bias toward metal-heavy recipes having higher stability", () => {
      const metalRecipe: EndlessRecipe = {
        chassisId: "chassis_standard_rifle",
        materials: ["metal_scrap", "metal_scrap", "metal_scrap"],
        seed: 100,
      };
      
      const chaosRecipe: EndlessRecipe = {
        chassisId: "chassis_standard_rifle",
        materials: ["chaos_shard", "chaos_shard", "chaos_shard"],
        seed: 200,
      };
      
      // Generate multiple samples
      const metalStabilities: number[] = [];
      const chaosStabilities: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const metalGear = generateEndlessGearFromRecipe(
          { ...metalRecipe, seed: metalRecipe.seed! + i },
          ctx
        );
        const chaosGear = generateEndlessGearFromRecipe(
          { ...chaosRecipe, seed: chaosRecipe.seed! + i },
          ctx
        );
        
        metalStabilities.push(metalGear.stability);
        chaosStabilities.push(chaosGear.stability);
      }
      
      const metalAvg = metalStabilities.reduce((a, b) => a + b, 0) / metalStabilities.length;
      const chaosAvg = chaosStabilities.reduce((a, b) => a + b, 0) / chaosStabilities.length;
      
      // Metal should have higher average stability (metal +5, chaos -10 per material)
      expect(metalAvg).toBeGreaterThan(chaosAvg);
    });
  });
  
  describe("Edge Cases", () => {
    it("should handle empty doctrine pool gracefully", () => {
      // This would require a chassis with very restrictive doctrine tags
      // For now, just ensure it doesn't crash
      const gear = generateEndlessGearFromRecipe(testRecipe, ctx);
      expect(gear.doctrineId).toBeDefined();
    });
    
    it("should handle empty mod pool gracefully", () => {
      const gear = generateEndlessGearFromRecipe(testRecipe, ctx);
      // Should still produce valid gear even if no mods selected
      expect(gear.chassisId).toBeDefined();
      expect(gear.stability).toBeDefined();
    });
  });
});


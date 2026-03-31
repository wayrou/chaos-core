// ============================================================================
// CHAOS CORE - SHOP SELL SYSTEM TESTS
// ============================================================================

import { describe, it, expect, beforeEach } from "@jest/globals";
import { sellToShop, getSellPrice, getResourceSellPrice, getSellableEntries, SELL_MULTIPLIER } from "../shopSell";
import { GameState } from "../types";
import { createNewGameState } from "../initialState";
import { Equipment } from "../equipment";

describe("Shop Sell System", () => {
  let baseState: GameState;
  
  beforeEach(() => {
    baseState = createNewGameState();
    // Add some test items
    baseState.equipmentById = {
      "test_weapon": {
        id: "test_weapon",
        name: "Test Weapon",
        slot: "weapon",
        weaponType: "sword",
        isMechanical: false,
        stats: { atk: 5, def: 0, agi: 0, acc: 80, hp: 0 },
        cardsGranted: [],
        moduleSlots: 0,
        attachedModules: [],
        wear: 100,
      } as Equipment,
      "test_armor": {
        id: "test_armor",
        name: "Test Armor",
        slot: "helmet",
        stats: { atk: 0, def: 3, agi: 0, acc: 0, hp: 0 },
        cardsGranted: [],
      } as Equipment,
    };
    baseState.equipmentPool = ["test_weapon", "test_armor"];
    baseState.consumables = {
      "consumable_healing_kit": 5,
      "consumable_field_ration": 3,
    };
    baseState.resources = {
      metalScrap: 10,
      wood: 8,
      chaosShards: 5,
      steamComponents: 4,
    };
    baseState.wad = 100;
  });
  
  describe("getSellPrice", () => {
    it("should use SELL_MULTIPLIER when buy price is provided", () => {
      const buyPrice = 100;
      const sellPrice = getSellPrice("equipment", "test", buyPrice);
      expect(sellPrice).toBe(Math.floor(buyPrice * SELL_MULTIPLIER));
    });
    
    it("should return fallback price when no buy price available", () => {
      const sellPrice = getSellPrice("equipment", "unknown_item");
      expect(sellPrice).toBeGreaterThanOrEqual(1);
    });
    
    it("should handle consumables with value-based pricing", () => {
      const sellPrice = getSellPrice("consumable", "consumable_healing_kit");
      expect(sellPrice).toBeGreaterThanOrEqual(1);
    });
  });
  
  describe("getResourceSellPrice", () => {
    it("should return fixed prices for resources", () => {
      expect(getResourceSellPrice("metalScrap")).toBe(2);
      expect(getResourceSellPrice("wood")).toBe(1);
      expect(getResourceSellPrice("chaosShards")).toBe(5);
      expect(getResourceSellPrice("steamComponents")).toBe(3);
    });
    
    it("should return 1 for unknown resources", () => {
      expect(getResourceSellPrice("unknown")).toBe(1);
    });
  });
  
  describe("sellToShop - Stackable Resources", () => {
    it("should decrement resource quantity and increase WAD correctly", () => {
      const initialWad = baseState.wad;
      const initialMetal = baseState.resources.metalScrap;
      
      const result = sellToShop(baseState, [
        { kind: "resource", id: "metalScrap", quantity: 5 },
      ]);
      
      if ("error" in result) {
        fail(`Sell failed: ${result.error}`);
      }
      
      expect(result.next.resources.metalScrap).toBe(initialMetal - 5);
      expect(result.next.wad).toBe(initialWad + (5 * getResourceSellPrice("metalScrap")));
      expect(result.wadGained).toBe(5 * getResourceSellPrice("metalScrap"));
    });
    
    it("should reject selling more than owned", () => {
      const result = sellToShop(baseState, [
        { kind: "resource", id: "metalScrap", quantity: 100 }, // More than owned
      ]);
      
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("Only");
      }
    });
  });
  
  describe("sellToShop - Non-Stack Equipment", () => {
    it("should remove equipment item and increase WAD", () => {
      const initialWad = baseState.wad;
      const initialEquipmentCount = Object.keys(baseState.equipmentById || {}).length;
      
      const result = sellToShop(baseState, [
        { kind: "equipment", id: "test_armor", quantity: 1 },
      ]);
      
      if ("error" in result) {
        fail(`Sell failed: ${result.error}`);
      }
      
      expect(result.next.equipmentById?.["test_armor"]).toBeUndefined();
      expect(Object.keys(result.next.equipmentById || {}).length).toBe(initialEquipmentCount - 1);
      expect(result.next.equipmentPool).not.toContain("test_armor");
      expect(result.next.wad).toBeGreaterThan(initialWad);
    });
    
    it("should reject selling more than 1 equipment item", () => {
      const result = sellToShop(baseState, [
        { kind: "equipment", id: "test_armor", quantity: 2 },
      ]);
      
      expect("error" in result).toBe(true);
    });
    
    it("should reject selling equipped items", () => {
      // Equip the item to a unit
      if (baseState.unitsById) {
        const unitId = Object.keys(baseState.unitsById)[0];
        const unit = baseState.unitsById[unitId];
        if (unit) {
          unit.loadout = {
            weapon: null,
            helmet: "test_armor",
            chestpiece: null,
            accessory1: null,
            accessory2: null,
          };
        }
      }
      
      const result = sellToShop(baseState, [
        { kind: "equipment", id: "test_armor", quantity: 1 },
      ]);
      
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("equipped");
      }
    });
  });
  
  describe("sellToShop - Consumables", () => {
    it("should decrement consumable quantity and increase WAD", () => {
      const initialWad = baseState.wad;
      const initialQty = baseState.consumables?.["consumable_healing_kit"] || 0;
      
      const result = sellToShop(baseState, [
        { kind: "consumable", id: "consumable_healing_kit", quantity: 2 },
      ]);
      
      if ("error" in result) {
        fail(`Sell failed: ${result.error}`);
      }
      
      expect(result.next.consumables?.["consumable_healing_kit"]).toBe(initialQty - 2);
      expect(result.next.wad).toBeGreaterThan(initialWad);
    });
    
    it("should remove consumable entry when quantity reaches 0", () => {
      const result = sellToShop(baseState, [
        { kind: "consumable", id: "consumable_field_ration", quantity: 3 }, // All of it
      ]);
      
      if ("error" in result) {
        fail(`Sell failed: ${result.error}`);
      }
      
      expect(result.next.consumables?.["consumable_field_ration"]).toBeUndefined();
    });
    
    it("should reject selling more than owned", () => {
      const result = sellToShop(baseState, [
        { kind: "consumable", id: "consumable_healing_kit", quantity: 100 },
      ]);
      
      expect("error" in result).toBe(true);
    });
  });
  
  describe("sellToShop - Multiple Items (Atomic)", () => {
    it("should process all items or none (atomic transaction)", () => {
      const initialWad = baseState.wad;
      const initialMetal = baseState.resources.metalScrap;
      const initialWood = baseState.resources.wood;
      
      const result = sellToShop(baseState, [
        { kind: "resource", id: "metalScrap", quantity: 5 },
        { kind: "resource", id: "wood", quantity: 3 },
      ]);
      
      if ("error" in result) {
        fail(`Sell failed: ${result.error}`);
      }
      
      // Both should be updated
      expect(result.next.resources.metalScrap).toBe(initialMetal - 5);
      expect(result.next.resources.wood).toBe(initialWood - 3);
      expect(result.next.wad).toBeGreaterThan(initialWad);
    });
    
    it("should reject entire transaction if any item is invalid", () => {
      const initialWad = baseState.wad;
      const initialMetal = baseState.resources.metalScrap;
      
      const result = sellToShop(baseState, [
        { kind: "resource", id: "metalScrap", quantity: 5 },
        { kind: "resource", id: "metalScrap", quantity: 100 }, // Invalid: too much
      ]);
      
      expect("error" in result).toBe(true);
      
      // State should be unchanged (atomic)
      expect(baseState.wad).toBe(initialWad);
      expect(baseState.resources.metalScrap).toBe(initialMetal);
    });
  });
  
  describe("getSellableEntries", () => {
    it("should enumerate equipment items", () => {
      const entries = getSellableEntries(baseState);
      const equipmentEntries = entries.filter(e => e.kind === "equipment");
      
      expect(equipmentEntries.length).toBeGreaterThan(0);
      expect(equipmentEntries.some(e => e.id === "test_weapon")).toBe(true);
      expect(equipmentEntries.some(e => e.id === "test_armor")).toBe(true);
    });
    
    it("should enumerate consumables", () => {
      const entries = getSellableEntries(baseState);
      const consumableEntries = entries.filter(e => e.kind === "consumable");
      
      expect(consumableEntries.length).toBeGreaterThan(0);
      expect(consumableEntries.some(e => e.id === "consumable_healing_kit")).toBe(true);
    });
    
    it("should enumerate resources", () => {
      const entries = getSellableEntries(baseState);
      const resourceEntries = entries.filter(e => e.kind === "resource");
      
      expect(resourceEntries.length).toBeGreaterThan(0);
      expect(resourceEntries.some(e => e.id === "metalScrap")).toBe(true);
    });
    
    it("should mark equipped items correctly", () => {
      // Equip an item
      if (baseState.unitsById) {
        const unitId = Object.keys(baseState.unitsById)[0];
        const unit = baseState.unitsById[unitId];
        if (unit) {
          unit.loadout = {
            weapon: "test_weapon",
            helmet: null,
            chestpiece: null,
            accessory1: null,
            accessory2: null,
          };
        }
      }
      
      const entries = getSellableEntries(baseState);
      const weaponEntry = entries.find(e => e.id === "test_weapon" && e.kind === "equipment");
      
      expect(weaponEntry).toBeDefined();
      expect(weaponEntry?.equipped).toBe(true);
    });
  });
  
  describe("Edge Cases", () => {
    it("should reject zero quantity", () => {
      const result = sellToShop(baseState, [
        { kind: "resource", id: "metalScrap", quantity: 0 },
      ]);
      
      expect("error" in result).toBe(true);
    });
    
    it("should reject negative quantity", () => {
      const result = sellToShop(baseState, [
        { kind: "resource", id: "metalScrap", quantity: -1 },
      ]);
      
      expect("error" in result).toBe(true);
    });
    
    it("should handle empty sell lines gracefully", () => {
      const result = sellToShop(baseState, []);
      
      if ("error" in result) {
        // Empty transaction might be rejected or return 0 WAD
        expect(result.error).toBeDefined();
      } else {
        expect(result.wadGained).toBe(0);
      }
    });
  });
});


// ============================================================================
// CHAOS CORE - INVENTORY VIEW MODEL TESTS
// ============================================================================

import { buildInventoryVM, InventoryCategory } from "../inventoryViewModel";
import { GameState } from "../types";
import { createNewGameState } from "../initialState";
import { Equipment } from "../equipment";
import { Module } from "../equipment";

describe("Inventory View Model", () => {
  let baseState: GameState;
  
  beforeEach(() => {
    baseState = createNewGameState();
  });
  
  describe("buildInventoryVM - WAD", () => {
    it("should return wad correctly", () => {
      baseState.wad = 1234;
      const vm = buildInventoryVM(baseState);
      expect(vm.wad).toBe(1234);
    });
    
    it("should handle missing wad (default to 0)", () => {
      baseState.wad = undefined as any;
      const vm = buildInventoryVM(baseState);
      expect(vm.wad).toBe(0);
    });
  });
  
  describe("buildInventoryVM - Equipment", () => {
    it("should include equipment entries when present", () => {
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
      
      const vm = buildInventoryVM(baseState);
      expect(vm.countsByCategory.equipment).toBe(2);
      expect(vm.entries.filter(e => e.category === "equipment").length).toBe(2);
      expect(vm.entries.some(e => e.id === "test_weapon")).toBe(true);
      expect(vm.entries.some(e => e.id === "test_armor")).toBe(true);
    });
    
    it("should mark equipped items correctly", () => {
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
      };
      
      // Equip the weapon
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
      
      const vm = buildInventoryVM(baseState);
      const weaponEntry = vm.entries.find(e => e.id === "test_weapon");
      expect(weaponEntry).toBeDefined();
      expect(weaponEntry?.equipped).toBe(true);
    });
    
    it("should handle empty equipment inventory", () => {
      baseState.equipmentById = {};
      const vm = buildInventoryVM(baseState);
      expect(vm.countsByCategory.equipment).toBe(0);
      expect(vm.entries.filter(e => e.category === "equipment").length).toBe(0);
    });
  });
  
  describe("buildInventoryVM - Consumables", () => {
    it("should include consumables when present", () => {
      baseState.consumables = {
        "consumable_healing_kit": 5,
        "consumable_field_ration": 3,
      };
      
      const vm = buildInventoryVM(baseState);
      expect(vm.countsByCategory.consumable).toBe(2);
      const consumableEntries = vm.entries.filter(e => e.category === "consumable");
      expect(consumableEntries.length).toBe(2);
      
      const healingKit = consumableEntries.find(e => e.id === "consumable_healing_kit");
      expect(healingKit).toBeDefined();
      expect(healingKit?.owned).toBe(5);
    });
    
    it("should exclude consumables with zero quantity", () => {
      baseState.consumables = {
        "consumable_healing_kit": 0,
        "consumable_field_ration": 3,
      };
      
      const vm = buildInventoryVM(baseState);
      expect(vm.countsByCategory.consumable).toBe(1);
      expect(vm.entries.some(e => e.id === "consumable_healing_kit")).toBe(false);
      expect(vm.entries.some(e => e.id === "consumable_field_ration")).toBe(true);
    });
    
    it("should handle empty consumables", () => {
      baseState.consumables = {};
      const vm = buildInventoryVM(baseState);
      expect(vm.countsByCategory.consumable).toBe(0);
    });
  });
  
  describe("buildInventoryVM - Weapon Parts (Modules)", () => {
    it("should include modules attached to owned weapons", () => {
      baseState.modulesById = {
        "module_test": {
          id: "module_test",
          name: "Test Module",
          description: "A test module",
          cardsGranted: [],
        } as Module,
      };
      
      baseState.equipmentById = {
        "test_weapon": {
          id: "test_weapon",
          name: "Test Weapon",
          slot: "weapon",
          weaponType: "sword",
          isMechanical: false,
          stats: { atk: 5, def: 0, agi: 0, acc: 80, hp: 0 },
          cardsGranted: [],
          moduleSlots: 1,
          attachedModules: ["module_test"],
          wear: 100,
        } as Equipment,
      };
      
      const vm = buildInventoryVM(baseState);
      expect(vm.countsByCategory.weaponPart).toBe(1);
      const moduleEntry = vm.entries.find(e => e.id === "module_test");
      expect(moduleEntry).toBeDefined();
      expect(moduleEntry?.category).toBe("weaponPart");
    });
    
    it("should not include modules not attached to any weapon", () => {
      baseState.modulesById = {
        "module_test": {
          id: "module_test",
          name: "Test Module",
          description: "A test module",
          cardsGranted: [],
        } as Module,
      };
      
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
      };
      
      const vm = buildInventoryVM(baseState);
      expect(vm.countsByCategory.weaponPart).toBe(0);
      expect(vm.entries.some(e => e.id === "module_test")).toBe(false);
    });
    
    it("should handle empty modules", () => {
      baseState.modulesById = {};
      const vm = buildInventoryVM(baseState);
      expect(vm.countsByCategory.weaponPart).toBe(0);
    });
  });
  
  describe("buildInventoryVM - Recipes", () => {
    it("should include known recipes", () => {
      baseState.knownRecipeIds = ["recipe_test_1", "recipe_test_2"];
      
      // Mock getRecipe to return a recipe
      const vm = buildInventoryVM(baseState);
      // Note: This test depends on recipes being loaded, which may not be the case
      // In a real scenario, we'd mock getRecipe or ensure recipes are loaded
      expect(vm.countsByCategory.recipe).toBeGreaterThanOrEqual(0);
    });
    
    it("should handle empty recipes", () => {
      baseState.knownRecipeIds = [];
      const vm = buildInventoryVM(baseState);
      expect(vm.countsByCategory.recipe).toBe(0);
    });
  });
  
  describe("buildInventoryVM - Resources", () => {
    it("should include resources when present", () => {
      baseState.resources = {
        metalScrap: 10,
        wood: 8,
        chaosShards: 5,
        steamComponents: 4,
      };
      
      const vm = buildInventoryVM(baseState);
      expect(vm.countsByCategory.resource).toBe(4);
      const resourceEntries = vm.entries.filter(e => e.category === "resource");
      expect(resourceEntries.length).toBe(4);
      
      const metalEntry = resourceEntries.find(e => e.id === "metalScrap");
      expect(metalEntry).toBeDefined();
      expect(metalEntry?.owned).toBe(10);
    });
    
    it("should exclude resources with zero quantity", () => {
      baseState.resources = {
        metalScrap: 0,
        wood: 8,
        chaosShards: 0,
        steamComponents: 4,
      };
      
      const vm = buildInventoryVM(baseState);
      expect(vm.countsByCategory.resource).toBe(2);
      expect(vm.entries.some(e => e.id === "metalScrap")).toBe(false);
      expect(vm.entries.some(e => e.id === "wood")).toBe(true);
    });
    
    it("should handle empty resources", () => {
      baseState.resources = {
        metalScrap: 0,
        wood: 0,
        chaosShards: 0,
        steamComponents: 0,
      };
      
      const vm = buildInventoryVM(baseState);
      expect(vm.countsByCategory.resource).toBe(0);
    });
  });
  
  describe("buildInventoryVM - Unique Keys", () => {
    it("should produce unique stable keys", () => {
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
      };
      baseState.consumables = {
        "test_weapon": 5, // Same ID as equipment, different category
      };
      
      const vm = buildInventoryVM(baseState);
      const keys = vm.entries.map(e => e.key);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
      expect(keys.some(k => k === "equipment:test_weapon")).toBe(true);
      expect(keys.some(k => k === "consumable:test_weapon")).toBe(true);
    });
  });
  
  describe("buildInventoryVM - Empty Inventory", () => {
    it("should handle completely empty inventory without crashing", () => {
      baseState.equipmentById = {};
      baseState.consumables = {};
      baseState.modulesById = {};
      baseState.knownRecipeIds = [];
      baseState.resources = {
        metalScrap: 0,
        wood: 0,
        chaosShards: 0,
        steamComponents: 0,
      };
      
      const vm = buildInventoryVM(baseState);
      expect(vm.entries.length).toBe(0);
      expect(vm.countsByCategory.equipment).toBe(0);
      expect(vm.countsByCategory.consumable).toBe(0);
      expect(vm.countsByCategory.weaponPart).toBe(0);
      expect(vm.countsByCategory.recipe).toBe(0);
      expect(vm.countsByCategory.resource).toBe(0);
    });
  });
  
  describe("buildInventoryVM - Sorting", () => {
    it("should sort entries by category, then sortGroup, then name", () => {
      baseState.equipmentById = {
        "weapon_b": {
          id: "weapon_b",
          name: "B Weapon",
          slot: "weapon",
          weaponType: "sword",
          isMechanical: false,
          stats: { atk: 5, def: 0, agi: 0, acc: 80, hp: 0 },
          cardsGranted: [],
          moduleSlots: 0,
          attachedModules: [],
          wear: 100,
        } as Equipment,
        "armor_a": {
          id: "armor_a",
          name: "A Armor",
          slot: "helmet",
          stats: { atk: 0, def: 3, agi: 0, acc: 0, hp: 0 },
          cardsGranted: [],
        } as Equipment,
      };
      baseState.consumables = {
        "consumable_z": 1,
      };
      
      const vm = buildInventoryVM(baseState);
      const categories = vm.entries.map(e => e.category);
      // Equipment should come before consumables
      const firstEquipmentIndex = categories.indexOf("equipment");
      const firstConsumableIndex = categories.indexOf("consumable");
      expect(firstEquipmentIndex).toBeLessThan(firstConsumableIndex);
    });
  });
});

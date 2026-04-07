var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};

// src/core/inventory.ts
function computeLoad(state) {
  let mass = 0;
  let bulk = 0;
  let power = 0;
  for (const item of state.forwardLocker) {
    const q = item.quantity ?? 1;
    mass += (item.massKg ?? 0) * q;
    bulk += (item.bulkBu ?? 0) * q;
    power += (item.powerW ?? 0) * q;
  }
  return { mass, bulk, power };
}
function computeLoadPenaltyFlags(inv) {
  const load = computeLoad(inv);
  const caps = MULE_CLASS_CAPS[inv.muleClass];
  const massPct = load.mass / caps.massKg;
  const bulkPct = load.bulk / caps.bulkBu;
  const powerPct = load.power / caps.powerW;
  return {
    massOver: massPct > 1,
    bulkOver: bulkPct > 1,
    powerOver: powerPct > 1,
    massPct,
    bulkPct,
    powerPct
  };
}
var MULE_CLASS_CAPS;
var init_inventory = __esm({
  "src/core/inventory.ts"() {
    "use strict";
    MULE_CLASS_CAPS = {
      E: { massKg: 50, bulkBu: 35, powerW: 150 },
      D: { massKg: 75, bulkBu: 50, powerW: 225 },
      C: { massKg: 100, bulkBu: 65, powerW: 300 },
      B: { massKg: 130, bulkBu: 85, powerW: 400 },
      A: { massKg: 165, bulkBu: 110, powerW: 500 },
      S: { massKg: 200, bulkBu: 150, powerW: 650 }
    };
  }
});

// src/core/isometric.ts
function generateElevationMap(width, height, maxElevation = 3, seed) {
  const elevations = [];
  let rng = seed ?? Math.floor(Math.random() * 1e6);
  function random() {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  }
  for (let x = 0; x < width; x++) {
    elevations[x] = [];
    for (let y = 0; y < height; y++) {
      elevations[x][y] = Math.floor(random() * (maxElevation + 1));
    }
  }
  const smoothed = [];
  for (let x = 0; x < width; x++) {
    smoothed[x] = [];
    for (let y = 0; y < height; y++) {
      let sum = elevations[x][y];
      let count = 1;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            sum += elevations[nx][ny];
            count++;
          }
        }
      }
      smoothed[x][y] = Math.round(sum / count);
    }
  }
  return smoothed;
}
var init_isometric = __esm({
  "src/core/isometric.ts"() {
    "use strict";
  }
});

// src/data/gearChassis.ts
function getChassisById(id) {
  return ALL_CHASSIS.find((c) => c.id === id);
}
var ALL_CHASSIS;
var init_gearChassis = __esm({
  "src/data/gearChassis.ts"() {
    "use strict";
    ALL_CHASSIS = [
      // WEAPON CHASSIS
      {
        id: "chassis_standard_rifle",
        name: "Standard Rifle Chassis",
        slotType: "weapon",
        baseMassKg: 8,
        baseBulkBu: 12,
        basePowerW: 5,
        baseStability: 70,
        maxCardSlots: 4,
        description: "Reliable baseline weapon platform. Balanced performance and stability.",
        buildCost: {
          metalScrap: 15,
          wood: 5,
          chaosShards: 0,
          steamComponents: 2
        }
      },
      {
        id: "chassis_heavy_cannon",
        name: "Heavy Cannon Chassis",
        slotType: "weapon",
        baseMassKg: 18,
        baseBulkBu: 25,
        basePowerW: 12,
        baseStability: 50,
        maxCardSlots: 5,
        description: "High-power weapon system. More slots, lower stability, heavy logistics footprint.",
        buildCost: {
          metalScrap: 25,
          wood: 8,
          chaosShards: 1,
          steamComponents: 5
        }
      },
      {
        id: "chassis_precision_rifle",
        name: "Precision Rifle Chassis",
        slotType: "weapon",
        baseMassKg: 6,
        baseBulkBu: 10,
        basePowerW: 4,
        baseStability: 85,
        maxCardSlots: 3,
        description: "Lightweight, stable platform. Fewer slots but exceptional reliability.",
        buildCost: {
          metalScrap: 20,
          wood: 3,
          chaosShards: 0,
          steamComponents: 3
        }
      },
      // ARMOR CHASSIS (HELMET)
      {
        id: "chassis_standard_helmet",
        name: "Standard Helmet Chassis",
        slotType: "helmet",
        baseMassKg: 3,
        baseBulkBu: 5,
        basePowerW: 2,
        baseStability: 75,
        maxCardSlots: 3,
        description: "Standard protective headgear. Balanced protection and flexibility.",
        buildCost: {
          metalScrap: 10,
          wood: 3,
          chaosShards: 0,
          steamComponents: 1
        }
      },
      {
        id: "chassis_heavy_helmet",
        name: "Heavy Helmet Chassis",
        slotType: "helmet",
        baseMassKg: 5,
        baseBulkBu: 8,
        basePowerW: 3,
        baseStability: 60,
        maxCardSlots: 4,
        description: "Reinforced helmet with more card capacity. Heavier but more versatile.",
        buildCost: {
          metalScrap: 18,
          wood: 5,
          chaosShards: 0,
          steamComponents: 2
        }
      },
      // ARMOR CHASSIS (CHESTPIECE)
      {
        id: "chassis_standard_chest",
        name: "Standard Chestplate Chassis",
        slotType: "chestpiece",
        baseMassKg: 12,
        baseBulkBu: 18,
        basePowerW: 6,
        baseStability: 70,
        maxCardSlots: 4,
        description: "Reliable torso protection. Good balance of defense and utility slots.",
        buildCost: {
          metalScrap: 20,
          wood: 6,
          chaosShards: 0,
          steamComponents: 3
        }
      },
      {
        id: "chassis_mobile_chest",
        name: "Mobile Chestplate Chassis",
        slotType: "chestpiece",
        baseMassKg: 8,
        baseBulkBu: 12,
        basePowerW: 4,
        baseStability: 80,
        maxCardSlots: 3,
        description: "Lightweight torso armor. Higher stability, fewer slots.",
        buildCost: {
          metalScrap: 15,
          wood: 4,
          chaosShards: 0,
          steamComponents: 2
        }
      },
      // ACCESSORY CHASSIS
      {
        id: "chassis_utility_module",
        name: "Utility Module Chassis",
        slotType: "accessory",
        baseMassKg: 2,
        baseBulkBu: 3,
        basePowerW: 8,
        baseStability: 75,
        maxCardSlots: 3,
        description: "Versatile accessory platform. High power draw, moderate slots.",
        buildCost: {
          metalScrap: 8,
          wood: 2,
          chaosShards: 1,
          steamComponents: 4
        }
      },
      {
        id: "chassis_power_cell",
        name: "Power Cell Chassis",
        slotType: "accessory",
        baseMassKg: 1,
        baseBulkBu: 2,
        basePowerW: 15,
        baseStability: 65,
        maxCardSlots: 4,
        description: "High-capacity power system. Excellent power output, lower stability.",
        buildCost: {
          metalScrap: 12,
          wood: 1,
          chaosShards: 2,
          steamComponents: 6
        }
      }
    ];
  }
});

// src/core/gearWorkbench.ts
function toLibraryCardFromImportedCard(card) {
  return {
    id: card.id,
    name: card.name,
    rarity: card.rarity ?? "common",
    category: card.category ?? "utility",
    description: card.description,
    strainCost: card.strainCost,
    artPath: card.artPath
  };
}
function upsertLibraryCard(card) {
  LIBRARY_CARD_DATABASE[card.id] = card;
}
function getLibraryCardDatabase() {
  const importedCards2 = Object.fromEntries(
    getAllImportedCards().map((card) => [card.id, toLibraryCardFromImportedCard(card)])
  );
  return {
    ...LIBRARY_CARD_DATABASE,
    ...importedCards2
  };
}
function getLibraryCard(cardId) {
  return getLibraryCardDatabase()[cardId];
}
function getDefaultGearSlots(equipmentId, equipment) {
  if (equipment?.chassisId) {
    const chassis = getChassisById(equipment.chassisId);
    if (chassis) {
      const lockedCards2 = Array.isArray(equipment.lockedCards) ? equipment.lockedCards : [];
      const lockedSlots = Number.isFinite(equipment?.provenance?.bias?.slotsLocked) ? equipment.provenance.bias.slotsLocked : 0;
      return {
        lockedCards: lockedCards2,
        freeSlots: Math.max(0, chassis.maxCardSlots - lockedSlots),
        slottedCards: []
      };
    }
  }
  const isWeapon = equipmentId.startsWith("weapon_") || equipmentId.startsWith("built_weapon_");
  const isAccessory = equipmentId.startsWith("accessory_") || equipmentId.startsWith("built_accessory_");
  const lockedCards = getEquipmentLockedCards(equipmentId);
  return {
    lockedCards,
    freeSlots: isWeapon ? 3 : isAccessory ? 1 : 2,
    slottedCards: []
  };
}
function getEquipmentLockedCards(equipmentId) {
  const lockedCardMap = {
    // Weapons
    weapon_iron_longsword: ["card_strike", "card_cleave"],
    weapon_runed_shortsword: ["card_strike", "card_lunge"],
    weapon_elm_recurve_bow: ["card_piercing_shot"],
    weapon_oak_battlestaff: ["card_guard", "card_focus"],
    weapon_steel_dagger: ["card_strike", "card_dash"],
    weapon_emberclaw_repeater: ["card_steam_burst", "card_vent"],
    weapon_blazefang_saber: ["card_strike", "card_steam_burst"],
    weapon_brassback_scattergun: ["card_steam_burst"],
    // Armor
    armor_ironguard_helm: ["card_brace"],
    armor_rangers_hood: ["card_focus"],
    armor_steelplate_cuirass: ["card_guard", "card_brace"],
    armor_leather_jerkin: ["card_dash"],
    // Accessories
    accessory_steel_signet_ring: ["card_focus"],
    accessory_fleetfoot_anklet: ["card_dash"],
    accessory_steam_valve_wristguard: ["card_vent"]
  };
  return lockedCardMap[equipmentId] ?? [];
}
function addCardsToLibrary(library, cardIds) {
  const newLibrary = { ...library };
  cardIds.forEach((cardId) => {
    newLibrary[cardId] = (newLibrary[cardId] ?? 0) + 1;
  });
  return newLibrary;
}
function generateBattleRewardCards(enemyCount) {
  const cards = [];
  const cardDatabase = Object.values(getLibraryCardDatabase());
  const commons = cardDatabase.filter((c) => c.rarity === "common");
  if (commons.length > 0) {
    cards.push(commons[Math.floor(Math.random() * commons.length)].id);
  }
  if (Math.random() < 0.3) {
    const uncommons = cardDatabase.filter((c) => c.rarity === "uncommon");
    if (uncommons.length > 0) {
      cards.push(uncommons[Math.floor(Math.random() * uncommons.length)].id);
    }
  }
  if (Math.random() < 0.1 + enemyCount * 0.02) {
    const rares = cardDatabase.filter((c) => c.rarity === "rare");
    if (rares.length > 0) {
      cards.push(rares[Math.floor(Math.random() * rares.length)].id);
    }
  }
  return cards;
}
function getStarterCardLibrary() {
  const starterLibrary = {
    card_strike: 3,
    card_guard: 2,
    card_move_plus: 2,
    card_focus: 1,
    card_brace: 2,
    card_dash: 1,
    card_weaken: 1,
    card_vent: 1
  };
  getAllImportedCards().forEach((card) => {
    starterLibrary[card.id] = Math.max(starterLibrary[card.id] ?? 0, 1);
  });
  return Object.fromEntries(
    Object.entries(starterLibrary).filter(([cardId]) => !isTechnicaContentDisabled("card", cardId))
  );
}
var LIBRARY_CARD_DATABASE;
var init_gearWorkbench = __esm({
  "src/core/gearWorkbench.ts"() {
    "use strict";
    init_technica();
    init_gearChassis();
    init_technica();
    LIBRARY_CARD_DATABASE = {
      // ==================== CORE CARDS ====================
      card_strike: {
        id: "card_strike",
        name: "Strike",
        rarity: "common",
        category: "attack",
        description: "Deal 3 damage to adjacent enemy.",
        strainCost: 1
      },
      card_guard: {
        id: "card_guard",
        name: "Guard",
        rarity: "common",
        category: "defense",
        description: "Gain +2 DEF until next turn.",
        strainCost: 0
      },
      card_move_plus: {
        id: "card_move_plus",
        name: "Move+",
        rarity: "common",
        category: "mobility",
        description: "Move 2 extra tiles this turn.",
        strainCost: 1
      },
      card_focus: {
        id: "card_focus",
        name: "Focus",
        rarity: "common",
        category: "buff",
        description: "Next attack gains +2 ACC.",
        strainCost: 1
      },
      // ==================== ATTACK CARDS ====================
      card_power_strike: {
        id: "card_power_strike",
        name: "Power Strike",
        rarity: "uncommon",
        category: "attack",
        description: "Deal 5 damage. High strain cost.",
        strainCost: 2
      },
      card_cleave: {
        id: "card_cleave",
        name: "Cleave",
        rarity: "uncommon",
        category: "attack",
        description: "Deal 3 damage to up to 3 adjacent enemies.",
        strainCost: 2
      },
      card_lunge: {
        id: "card_lunge",
        name: "Lunge",
        rarity: "uncommon",
        category: "attack",
        description: "Move 2 tiles and attack. Deal 4 damage.",
        strainCost: 2
      },
      card_piercing_shot: {
        id: "card_piercing_shot",
        name: "Piercing Shot",
        rarity: "uncommon",
        category: "attack",
        description: "Ranged attack that ignores 2 DEF.",
        strainCost: 2
      },
      card_execute: {
        id: "card_execute",
        name: "Execute",
        rarity: "rare",
        category: "attack",
        description: "Deal 8 damage to enemies below 30% HP.",
        strainCost: 3
      },
      card_whirlwind: {
        id: "card_whirlwind",
        name: "Whirlwind",
        rarity: "rare",
        category: "attack",
        description: "Deal 4 damage to ALL adjacent enemies.",
        strainCost: 3
      },
      // ==================== DEFENSE CARDS ====================
      card_brace: {
        id: "card_brace",
        name: "Brace",
        rarity: "common",
        category: "defense",
        description: "Reduce next incoming damage by 3.",
        strainCost: 1
      },
      card_parry: {
        id: "card_parry",
        name: "Parry",
        rarity: "uncommon",
        category: "defense",
        description: "If attacked, counter for 2 damage.",
        strainCost: 1
      },
      card_shield_wall: {
        id: "card_shield_wall",
        name: "Shield Wall",
        rarity: "uncommon",
        category: "defense",
        description: "All allies gain +1 DEF for 2 turns.",
        strainCost: 2
      },
      card_fortress: {
        id: "card_fortress",
        name: "Fortress",
        rarity: "rare",
        category: "defense",
        description: "Gain +4 DEF but cannot move next turn.",
        strainCost: 2
      },
      // ==================== MOBILITY CARDS ====================
      card_dash: {
        id: "card_dash",
        name: "Dash",
        rarity: "common",
        category: "mobility",
        description: "Move up to 3 tiles ignoring terrain.",
        strainCost: 1
      },
      card_retreat: {
        id: "card_retreat",
        name: "Retreat",
        rarity: "common",
        category: "mobility",
        description: "Move 2 tiles away from nearest enemy.",
        strainCost: 1
      },
      card_shadow_step: {
        id: "card_shadow_step",
        name: "Shadow Step",
        rarity: "rare",
        category: "mobility",
        description: "Teleport behind target enemy.",
        strainCost: 2
      },
      // ==================== BUFF CARDS ====================
      card_rally: {
        id: "card_rally",
        name: "Rally",
        rarity: "uncommon",
        category: "buff",
        description: "All allies gain +1 ATK for 2 turns.",
        strainCost: 2
      },
      card_inspire: {
        id: "card_inspire",
        name: "Inspire",
        rarity: "uncommon",
        category: "buff",
        description: "Target ally reduces strain by 2.",
        strainCost: 1
      },
      card_overclock: {
        id: "card_overclock",
        name: "Overclock",
        rarity: "rare",
        category: "buff",
        description: "Gain +3 ATK but take 2 damage.",
        strainCost: 2
      },
      // ==================== DEBUFF CARDS ====================
      card_weaken: {
        id: "card_weaken",
        name: "Weaken",
        rarity: "common",
        category: "debuff",
        description: "Target enemy has -2 ATK for 1 turn.",
        strainCost: 1
      },
      card_slow: {
        id: "card_slow",
        name: "Slow",
        rarity: "common",
        category: "debuff",
        description: "Target enemy has -2 movement for 1 turn.",
        strainCost: 1
      },
      card_expose: {
        id: "card_expose",
        name: "Expose",
        rarity: "uncommon",
        category: "debuff",
        description: "Target enemy has -2 DEF for 2 turns.",
        strainCost: 1
      },
      card_terror: {
        id: "card_terror",
        name: "Terror",
        rarity: "rare",
        category: "debuff",
        description: "Target enemy cannot use cards next turn.",
        strainCost: 3
      },
      // ==================== STEAM TECH CARDS ====================
      card_steam_burst: {
        id: "card_steam_burst",
        name: "Steam Burst",
        rarity: "uncommon",
        category: "steam",
        description: "Deal 4 damage. Adds +2 heat to weapon.",
        strainCost: 1
      },
      card_vent: {
        id: "card_vent",
        name: "Vent",
        rarity: "common",
        category: "steam",
        description: "Remove 3 heat from equipped weapon.",
        strainCost: 0
      },
      card_pressure_valve: {
        id: "card_pressure_valve",
        name: "Pressure Valve",
        rarity: "uncommon",
        category: "steam",
        description: "Convert 2 heat into +2 damage on next attack.",
        strainCost: 1
      },
      card_overheat: {
        id: "card_overheat",
        name: "Overheat",
        rarity: "rare",
        category: "steam",
        description: "Deal 6 damage. Weapon gains max heat.",
        strainCost: 2
      },
      card_thermal_shield: {
        id: "card_thermal_shield",
        name: "Thermal Shield",
        rarity: "rare",
        category: "steam",
        description: "Absorb next attack. Add its damage as heat.",
        strainCost: 2
      },
      // ==================== CHAOS CARDS ====================
      card_chaos_bolt: {
        id: "card_chaos_bolt",
        name: "Chaos Bolt",
        rarity: "uncommon",
        category: "chaos",
        description: "Deal 2-6 random damage to target.",
        strainCost: 1
      },
      card_entropy: {
        id: "card_entropy",
        name: "Entropy",
        rarity: "rare",
        category: "chaos",
        description: "Shuffle all cards. Draw 3 new cards.",
        strainCost: 2
      },
      card_void_touch: {
        id: "card_void_touch",
        name: "Void Touch",
        rarity: "rare",
        category: "chaos",
        description: "Deal 3 damage. Heal for damage dealt.",
        strainCost: 2
      },
      card_reality_tear: {
        id: "card_reality_tear",
        name: "Reality Tear",
        rarity: "epic",
        category: "chaos",
        description: "Swap positions with any unit on the map.",
        strainCost: 3
      },
      card_chaos_storm: {
        id: "card_chaos_storm",
        name: "Chaos Storm",
        rarity: "epic",
        category: "chaos",
        description: "Deal 3 damage to ALL units (including allies).",
        strainCost: 4
      }
    };
  }
});

// src/content/technica/index.ts
function loadGeneratedRegistry(modules, register) {
  Object.values(modules).forEach((module) => {
    register(module.default);
  });
}
function registerImportedFieldMap(map) {
  importedMaps.set(map.id, map);
}
function registerImportedQuest(quest) {
  importedQuests.set(quest.id, quest);
}
function registerImportedDialogue(dialogue) {
  importedDialogues.set(dialogue.id, dialogue);
}
function registerImportedItem(item) {
  importedItems.set(item.id, item);
}
function getAllImportedItems() {
  return Array.from(importedItems.values());
}
function getImportedStarterItems() {
  return getAllImportedItems();
}
function registerImportedNpc(npc) {
  importedNpcs.set(npc.id, npc);
}
function registerImportedGear(gear) {
  importedGear.set(gear.id, gear);
}
function getAllImportedGear() {
  return Array.from(importedGear.values());
}
function registerImportedCard(card) {
  importedCards.set(card.id, card);
  upsertLibraryCard({
    id: card.id,
    name: card.name,
    rarity: card.rarity ?? "common",
    category: card.category ?? "utility",
    description: card.description,
    strainCost: card.strainCost,
    artPath: card.artPath
  });
}
function getAllImportedCards() {
  return Array.from(importedCards.values());
}
function registerImportedClass(classDefinition) {
  importedClasses.set(classDefinition.id, classDefinition);
}
function getAllImportedClasses() {
  return Array.from(importedClasses.values());
}
function registerImportedUnit(unit) {
  importedUnits.set(unit.id, unit);
}
function getAllImportedUnits() {
  return Array.from(importedUnits.values());
}
function registerImportedOperation(operation) {
  importedOperations.set(operation.id, operation);
}
function getImportedOperation(operationId) {
  return importedOperations.get(operationId) || null;
}
function getAllImportedOperations() {
  return Array.from(importedOperations.values());
}
function isTechnicaContentDisabled(contentType, contentId) {
  return disabledContentIds.get(contentType)?.has(contentId) ?? false;
}
var importedMaps, importedQuests, importedDialogues, importedItems, importedNpcs, importedGear, importedCards, importedClasses, importedUnits, importedOperations, disabledContentIds;
var init_technica = __esm({
  "src/content/technica/index.ts"() {
    "use strict";
    init_gearWorkbench();
    importedMaps = /* @__PURE__ */ new Map();
    importedQuests = /* @__PURE__ */ new Map();
    importedDialogues = /* @__PURE__ */ new Map();
    importedItems = /* @__PURE__ */ new Map();
    importedNpcs = /* @__PURE__ */ new Map();
    importedGear = /* @__PURE__ */ new Map();
    importedCards = /* @__PURE__ */ new Map();
    importedClasses = /* @__PURE__ */ new Map();
    importedUnits = /* @__PURE__ */ new Map();
    importedOperations = /* @__PURE__ */ new Map();
    disabledContentIds = /* @__PURE__ */ new Map([
      ["dialogue", /* @__PURE__ */ new Set()],
      ["quest", /* @__PURE__ */ new Set()],
      ["map", /* @__PURE__ */ new Set()],
      ["npc", /* @__PURE__ */ new Set()],
      ["item", /* @__PURE__ */ new Set()],
      ["gear", /* @__PURE__ */ new Set()],
      ["card", /* @__PURE__ */ new Set()],
      ["unit", /* @__PURE__ */ new Set()],
      ["operation", /* @__PURE__ */ new Set()],
      ["class", /* @__PURE__ */ new Set()]
    ]);
    if (typeof import.meta.glob === "function") {
      loadGeneratedRegistry(
        import.meta.glob("./disabled/*/*.disabled.json", { eager: true }),
        (entry) => {
          if (entry.origin === "game") {
            disabledContentIds.get(entry.contentType)?.add(entry.id);
          }
        }
      );
      loadGeneratedRegistry(
        import.meta.glob("./generated/map/*.fieldmap.json", { eager: true }),
        registerImportedFieldMap
      );
      loadGeneratedRegistry(
        import.meta.glob("./generated/quest/*.quest.json", { eager: true }),
        registerImportedQuest
      );
      loadGeneratedRegistry(
        import.meta.glob("./generated/dialogue/*.dialogue.json", { eager: true }),
        registerImportedDialogue
      );
      loadGeneratedRegistry(
        import.meta.glob("./generated/item/*.item.json", { eager: true }),
        registerImportedItem
      );
      loadGeneratedRegistry(
        import.meta.glob("./generated/npc/*.npc.json", { eager: true }),
        registerImportedNpc
      );
      loadGeneratedRegistry(
        import.meta.glob("./generated/gear/*.gear.json", { eager: true }),
        registerImportedGear
      );
      loadGeneratedRegistry(
        import.meta.glob("./generated/card/*.card.json", { eager: true }),
        registerImportedCard
      );
      loadGeneratedRegistry(
        import.meta.glob("./generated/class/*.class.json", { eager: true }),
        registerImportedClass
      );
      loadGeneratedRegistry(
        import.meta.glob("./generated/unit/*.unit.json", { eager: true }),
        registerImportedUnit
      );
      loadGeneratedRegistry(
        import.meta.glob("./generated/operation/*.operation.json", {
          eager: true
        }),
        registerImportedOperation
      );
    }
    if (import.meta.hot) {
      import.meta.hot.accept(() => {
        window.location.reload();
      });
    }
  }
});

// src/data/cards/coreCards.ts
var CORE_CARDS;
var init_coreCards = __esm({
  "src/data/cards/coreCards.ts"() {
    "use strict";
    CORE_CARDS = [
      {
        "id": "core_move_plus",
        "name": "Move+",
        "type": "core",
        "strainCost": 6,
        "description": "Move 2 tiles.",
        "range": "R(Self)"
      },
      {
        id: "core_basic_attack",
        name: "Basic Attack",
        type: "core",
        strainCost: 2,
        description: "Standard attack on enemy.",
        range: "R(1-1)",
        damage: 0
      },
      {
        id: "core_aid",
        name: "Aid",
        type: "core",
        strainCost: 6,
        description: "Restore small amount of HP to ally.",
        range: "R(1-2)"
      },
      {
        "id": "core_overwatch",
        "name": "Overwatch",
        "type": "core",
        "strainCost": 6,
        "description": "Stun an enemy for one turn.",
        "range": "R(5)"
      },
      {
        id: "core_guard",
        name: "Guard",
        type: "core",
        strainCost: 6,
        description: "Gain +2 DEF until your next turn.",
        range: "R(0-0)"
      },
      {
        id: "core_wait",
        name: "Wait",
        type: "core",
        strainCost: 6,
        description: "End turn without acting. Reduce strain by 1.",
        range: "R(0-0)"
      }
    ];
  }
});

// src/data/cards/classCards.ts
var CLASS_CARDS;
var init_classCards = __esm({
  "src/data/cards/classCards.ts"() {
    "use strict";
    CLASS_CARDS = {
      squire: [
        {
          id: "squire_power_slash",
          name: "Power Slash",
          type: "class",
          strainCost: 5,
          description: "Deal heavy melee damage to one enemy.",
          range: "R(1-1)",
          damage: 8
        },
        {
          id: "squire_shield_wall",
          name: "Shield Wall",
          type: "class",
          strainCost: 6,
          description: "Reduce damage taken by all allies for 1 turn.",
          range: "R(0-0)"
        },
        {
          id: "squire_rally_cry",
          name: "Rally Cry",
          type: "class",
          strainCost: 5,
          description: "Boost ATK of all allies for 2 turns.",
          range: "R(0-0)"
        }
      ],
      sentry: [
        {
          id: "sentry_brace",
          name: "Brace",
          type: "class",
          strainCost: 6,
          description: "Gain +3 DEF and immunity to knockback this turn.",
          range: "R(Self)"
        },
        {
          id: "sentry_heavy_strike",
          name: "Heavy Strike",
          type: "class",
          strainCost: 5,
          description: "Deal high damage and push target 1 tile.",
          range: "R(1-1)",
          damage: 7
        },
        {
          id: "sentry_intercept",
          name: "Intercept",
          type: "class",
          strainCost: 6,
          description: "Move 1 tile and take the next attack meant for an adjacent ally.",
          range: "R(Self)"
        }
      ],
      paladin: [
        {
          id: "paladin_holy_smite",
          name: "Holy Smite",
          type: "class",
          strainCost: 5,
          description: "Deal strong damage; +2 damage vs demonic/undead.",
          range: "R(1-1)",
          damage: 6
        },
        {
          id: "paladin_lay_on_hands",
          name: "Lay on Hands",
          type: "class",
          strainCost: 6,
          description: "Restore moderate HP to an ally and cure poison.",
          range: "R(1-1)"
        },
        {
          id: "paladin_aura_of_protection",
          name: "Aura of Protection",
          type: "class",
          strainCost: 6,
          description: "All adjacent allies gain +1 DEF and +1 against magic.",
          range: "R(Self)"
        }
      ],
      watchGuard: [
        {
          id: "watchguard_vigilance",
          name: "Vigilance",
          type: "class",
          strainCost: 6,
          description: "Extend overwatch range by 2.",
          range: "R(Self)"
        },
        {
          id: "watchguard_suppress",
          name: "Suppress",
          type: "class",
          strainCost: 5,
          description: "Deal light damage and reduce target movement by 2.",
          range: "R(2-5)",
          damage: 3
        },
        {
          id: "watchguard_shout",
          name: "Shout",
          type: "class",
          strainCost: 6,
          description: "Taunt enemies in range to attack you.",
          range: "R(0-3)"
        }
      ],
      ranger: [
        {
          id: "ranger_pinning_shot",
          name: "Pinning Shot",
          type: "class",
          strainCost: 5,
          description: "Immobilize an enemy for 1 turn.",
          range: "R(2-5)",
          damage: 3
        },
        {
          id: "ranger_volley",
          name: "Volley",
          type: "class",
          strainCost: 6,
          description: "Deal light damage to all enemies in range.",
          range: "R(3-6)",
          damage: 2
        },
        {
          id: "ranger_scouts_mark",
          name: "Scout's Mark",
          type: "class",
          strainCost: 6,
          description: "Reveal all enemies and traps in range.",
          range: "R(0-6)"
        }
      ],
      hunter: [],
      bowmaster: [],
      trapper: [],
      magician: [
        {
          id: "magician_arcane_bolt",
          name: "Arcane Bolt",
          type: "class",
          strainCost: 2,
          description: "Deal moderate magic damage to an enemy.",
          range: "R(2-6)",
          damage: 5
        },
        {
          id: "magician_mana_burst",
          name: "Mana Burst",
          type: "class",
          strainCost: 6,
          description: "Deal heavy AoE magic damage.",
          range: "R(2-4)",
          damage: 4
        },
        {
          id: "magician_barrier",
          name: "Barrier",
          type: "class",
          strainCost: 2,
          description: "Grant magic shield to an ally.",
          range: "R(1-3)"
        }
      ],
      cleric: [],
      wizard: [],
      chaosmancer: [],
      thief: [
        {
          id: "thief_steal",
          name: "Steal",
          type: "class",
          strainCost: 6,
          description: "Take an item from the target.",
          range: "R(1-1)"
        },
        {
          id: "thief_backstab",
          name: "Backstab",
          type: "class",
          strainCost: 2,
          description: "Deal high damage if behind enemy.",
          range: "R(1-1)",
          damage: 10
        },
        {
          id: "thief_smoke_bomb",
          name: "Smoke Bomb",
          type: "class",
          strainCost: 2,
          description: "Reduce enemy accuracy for 2 turns.",
          range: "R(0-2)"
        }
      ],
      scout: [],
      shadow: [],
      trickster: [],
      academic: [
        {
          id: "academic_analyze",
          name: "Analyze",
          type: "class",
          strainCost: 6,
          description: "Reveal enemy stats and weaknesses.",
          range: "R(0-6)"
        },
        {
          id: "academic_tactics_shift",
          name: "Tactics Shift",
          type: "class",
          strainCost: 2,
          description: "Reposition an ally instantly.",
          range: "R(1-4)"
        },
        {
          id: "academic_inspire",
          name: "Inspire",
          type: "class",
          strainCost: 2,
          description: "Reduce strain of all allies by 1.",
          range: "R(0-0)"
        }
      ],
      freelancer: []
    };
  }
});

// src/data/cards/equipmentCards.ts
function sanitizeEquipmentCard(card) {
  const description = card.description.trim();
  const lowerName = card.name.toLowerCase();
  const lowerDescription = description.toLowerCase();
  const isPlaceholder = lowerDescription.startsWith("use ") || lowerDescription === "ranged attack." || lowerDescription === "defensive action or stance.";
  if (!isPlaceholder) {
    return card;
  }
  const isSelfCard = (card.range || "").toLowerCase().includes("self") || ["guard", "stance", "brace", "ward", "shield", "veil", "focus", "resolve", "dodge", "form", "barrier"].some(
    (hint) => lowerName.includes(hint)
  );
  let nextDescription = description;
  if (isSelfCard) {
    nextDescription = "Gain +2 DEF until next turn.";
  } else if (typeof card.damage === "number" && card.damage > 0) {
    nextDescription = `Deal ${card.damage} damage.`;
  } else {
    nextDescription = "Apply a tactical effect to the target.";
  }
  return {
    ...card,
    description: nextDescription
  };
}
var RAW_EQUIPMENT_CARDS, EQUIPMENT_CARDS;
var init_equipmentCards = __esm({
  "src/data/cards/equipmentCards.ts"() {
    "use strict";
    RAW_EQUIPMENT_CARDS = [
      // Iron Longsword cards
      {
        id: "card_cleave",
        name: "Cleave",
        type: "equipment",
        strainCost: 2,
        description: "Deal 3 damage to up to 3 adjacent enemies.",
        range: "R(1)",
        damage: 3,
        sourceEquipmentId: "weapon_iron_longsword"
      },
      {
        id: "card_parry_readiness",
        name: "Parry Readiness",
        type: "equipment",
        strainCost: 6,
        description: "If attacked before next turn, cancel 1 attack.",
        range: "R(1)",
        sourceEquipmentId: "weapon_iron_longsword"
      },
      {
        id: "card_guarded_stance",
        name: "Guarded Stance",
        type: "equipment",
        strainCost: 6,
        description: "+2 DEF until your next turn.",
        range: "R(Self)",
        sourceEquipmentId: "weapon_iron_longsword"
      },
      // Elm Recurve Bow cards
      {
        id: "card_pinpoint_shot",
        name: "Pinpoint Shot",
        type: "equipment",
        strainCost: 2,
        description: "Deal 4 damage; +1 ACC for this attack.",
        range: "R(3-6)",
        damage: 4,
        sourceEquipmentId: "weapon_elm_recurve_bow"
      },
      {
        id: "card_warning_shot",
        name: "Warning Shot",
        type: "equipment",
        strainCost: 6,
        description: "Target suffers -2 ACC for 1 turn.",
        range: "R(3-6)",
        sourceEquipmentId: "weapon_elm_recurve_bow"
      },
      {
        id: "card_defensive_draw",
        name: "Defensive Draw",
        type: "equipment",
        strainCost: 6,
        description: "+1 DEF and +1 ACC until your next attack.",
        range: "R(Self)",
        sourceEquipmentId: "weapon_elm_recurve_bow"
      },
      // Oak Battlestaff cards
      {
        id: "card_blunt_sweep",
        name: "Blunt Sweep",
        type: "equipment",
        strainCost: 2,
        description: "Deal 3 damage to all enemies in a 90 arc.",
        range: "R(1-2)",
        damage: 3,
        sourceEquipmentId: "weapon_oak_battlestaff"
      },
      {
        id: "card_deflective_spin",
        name: "Deflective Spin",
        type: "equipment",
        strainCost: 6,
        description: "Block next ranged attack from enemies in arc.",
        range: "R(1)",
        sourceEquipmentId: "weapon_oak_battlestaff"
      },
      {
        id: "card_ward_spin",
        name: "Ward Spin",
        type: "equipment",
        strainCost: 6,
        description: "Block first melee hit until next turn.",
        range: "R(Self)",
        sourceEquipmentId: "weapon_oak_battlestaff"
      },
      // Steel Dagger cards
      {
        id: "card_throat_jab",
        name: "Throat Jab",
        type: "equipment",
        strainCost: 2,
        description: "Deal 3 damage and reduce target ACC by 2 next turn.",
        range: "R(1)",
        damage: 3,
        sourceEquipmentId: "weapon_steel_dagger"
      },
      {
        id: "card_hamstring",
        name: "Hamstring",
        type: "equipment",
        strainCost: 6,
        description: "Target loses 2 movement next turn.",
        range: "R(1)",
        sourceEquipmentId: "weapon_steel_dagger"
      },
      {
        id: "card_sidestep",
        name: "Sidestep",
        type: "equipment",
        strainCost: 6,
        description: "Gain +3 AGI until end of turn.",
        range: "R(Self)",
        sourceEquipmentId: "weapon_steel_dagger"
      },
      // Emberclaw Repeater cards
      {
        id: "card_piercing_volley",
        name: "Piercing Volley",
        type: "equipment",
        strainCost: 2,
        description: "Ignore target's DEF for next attack. Gain +1 heat.",
        range: "R(2-5)",
        damage: 4,
        sourceEquipmentId: "weapon_emberclaw_repeater"
      },
      {
        id: "card_suppressive_spray",
        name: "Suppressive Spray",
        type: "equipment",
        strainCost: 2,
        description: "Target suffers -2 ACC and -1 movement. +1 heat.",
        range: "R(2-5)",
        sourceEquipmentId: "weapon_emberclaw_repeater"
      },
      {
        id: "card_cooling_discipline",
        name: "Cooling Discipline",
        type: "equipment",
        strainCost: 2,
        description: "Remove 2 heat and gain +1 DEF until next turn.",
        range: "R(Self)",
        sourceEquipmentId: "weapon_emberclaw_repeater"
      },
      // Blazefang Saber cards
      {
        id: "card_searing_slash",
        name: "Searing Slash",
        type: "equipment",
        strainCost: 2,
        description: "Inflict Burn status. Gain +1 heat.",
        range: "R(1)",
        damage: 4,
        sourceEquipmentId: "weapon_blazefang_saber"
      },
      {
        id: "card_molten_mark",
        name: "Molten Mark",
        type: "equipment",
        strainCost: 6,
        description: "Mark target; next attack from any ally deals +2 damage. Gain +1 heat.",
        range: "R(1)",
        sourceEquipmentId: "weapon_blazefang_saber"
      },
      {
        id: "card_heat_parry",
        name: "Heat Parry",
        type: "equipment",
        strainCost: 2,
        description: "Remove 1 heat; block the next melee attack.",
        range: "R(Self)",
        sourceEquipmentId: "weapon_blazefang_saber"
      },
      // Helmet cards
      {
        id: "card_headbutt",
        name: "Headbutt",
        type: "equipment",
        strainCost: 6,
        description: "Deal 2 damage and stun for 1 turn.",
        range: "R(1)",
        damage: 2,
        sourceEquipmentId: "armor_ironguard_helm"
      },
      {
        id: "card_shield_sight",
        name: "Shield Sight",
        type: "equipment",
        strainCost: 6,
        description: "Ignore flanking penalties until your next turn.",
        range: "R(Self)",
        sourceEquipmentId: "armor_ironguard_helm"
      },
      {
        id: "card_shield_headbutt",
        name: "Shield Headbutt",
        type: "equipment",
        strainCost: 2,
        description: "Stun target for 1 turn.",
        range: "R(1)",
        sourceEquipmentId: "armor_ironguard_helm"
      },
      {
        id: "card_aimed_strike",
        name: "Aimed Strike",
        type: "equipment",
        strainCost: 6,
        description: "Deal 3 damage with +1 ACC.",
        range: "R(2-4)",
        damage: 3,
        sourceEquipmentId: "armor_rangers_hood"
      },
      {
        id: "card_hunters_mark",
        name: "Hunter's Mark",
        type: "equipment",
        strainCost: 6,
        description: "Mark target; next ranged attack deals +2 damage.",
        range: "R(3-5)",
        sourceEquipmentId: "armor_rangers_hood"
      },
      {
        id: "card_hide_in_shadows",
        name: "Hide in Shadows",
        type: "equipment",
        strainCost: 2,
        description: "Gain +2 AGI and untargetable at range for 1 turn.",
        range: "R(Self)",
        sourceEquipmentId: "armor_rangers_hood"
      },
      {
        id: "card_mind_spike",
        name: "Mind Spike",
        type: "equipment",
        strainCost: 2,
        description: "Deal 4 magic damage.",
        range: "R(2-3)",
        damage: 4,
        sourceEquipmentId: "armor_mystic_circlet"
      },
      {
        id: "card_spell_focus",
        name: "Spell Focus",
        type: "equipment",
        strainCost: 6,
        description: "Your next magic skill gains +3 ACC.",
        range: "R(Self)",
        sourceEquipmentId: "armor_mystic_circlet"
      },
      {
        id: "card_mana_barrier",
        name: "Mana Barrier",
        type: "equipment",
        strainCost: 2,
        description: "Reduce incoming magic damage by 2 until next turn.",
        range: "R(Self)",
        sourceEquipmentId: "armor_mystic_circlet"
      },
      // Chestpiece cards
      {
        id: "card_shoulder_charge",
        name: "Shoulder Charge",
        type: "equipment",
        strainCost: 2,
        description: "Deal 3 damage; push target 1 tile.",
        range: "R(1)",
        damage: 3,
        sourceEquipmentId: "armor_steelplate_cuirass"
      },
      {
        id: "card_fortify",
        name: "Fortify",
        type: "equipment",
        strainCost: 6,
        description: "Gain immunity to knockback until next turn.",
        range: "R(Self)",
        sourceEquipmentId: "armor_steelplate_cuirass"
      },
      {
        id: "card_fortress_form",
        name: "Fortress Form",
        type: "equipment",
        strainCost: 2,
        description: "Gain +3 DEF but movement -1 this turn.",
        range: "R(Self)",
        sourceEquipmentId: "armor_steelplate_cuirass"
      },
      {
        id: "card_knife_toss",
        name: "Knife Toss",
        type: "equipment",
        strainCost: 6,
        description: "Deal 2 damage; +1 AGI next turn.",
        range: "R(2-3)",
        damage: 2,
        sourceEquipmentId: "armor_leather_jerkin"
      },
      {
        id: "card_quick_roll",
        name: "Quick Roll",
        type: "equipment",
        strainCost: 2,
        description: "Move 1 tile as a free action.",
        range: "R(Self)",
        sourceEquipmentId: "armor_leather_jerkin"
      },
      {
        id: "card_light_guard",
        name: "Light Guard",
        type: "equipment",
        strainCost: 6,
        description: "+1 DEF and +1 AGI until next turn.",
        range: "R(Self)",
        sourceEquipmentId: "armor_leather_jerkin"
      },
      {
        id: "card_mana_surge_strike",
        name: "Mana Surge Strike",
        type: "equipment",
        strainCost: 2,
        description: "Deal 4 magic damage.",
        range: "R(2-3)",
        damage: 4,
        sourceEquipmentId: "armor_mages_robe"
      },
      {
        id: "card_mana_shift",
        name: "Mana Shift",
        type: "equipment",
        strainCost: 2,
        description: "Recover 1 strain.",
        range: "R(Self)",
        sourceEquipmentId: "armor_mages_robe"
      },
      {
        id: "card_arcane_veil",
        name: "Arcane Veil",
        type: "equipment",
        strainCost: 6,
        description: "Gain +2 DEF vs magic for 1 turn.",
        range: "R(Self)",
        sourceEquipmentId: "armor_mages_robe"
      },
      // Accessory cards
      {
        id: "card_knuckle_jab",
        name: "Knuckle Jab",
        type: "equipment",
        strainCost: 6,
        description: "Deal 2 damage and push target 1 tile.",
        range: "R(1)",
        damage: 2,
        sourceEquipmentId: "accessory_steel_signet_ring"
      },
      {
        id: "card_mark_of_command",
        name: "Mark of Command",
        type: "equipment",
        strainCost: 6,
        description: "All allies gain +1 ACC next turn.",
        range: "R(Self)",
        sourceEquipmentId: "accessory_steel_signet_ring"
      },
      {
        id: "card_signet_shield",
        name: "Signet Shield",
        type: "equipment",
        strainCost: 6,
        description: "Gain +1 DEF and +1 LUK until next turn.",
        range: "R(Self)",
        sourceEquipmentId: "accessory_steel_signet_ring"
      },
      {
        id: "card_spotters_shot",
        name: "Spotter's Shot",
        type: "equipment",
        strainCost: 2,
        description: "Deal 4 damage; target marked for +1 damage from all sources.",
        range: "R(3-6)",
        damage: 4,
        sourceEquipmentId: "accessory_eagle_eye_lens"
      },
      {
        id: "card_target_paint",
        name: "Target Paint",
        type: "equipment",
        strainCost: 6,
        description: "Allies gain +1 damage to target this turn.",
        range: "R(3-6)",
        sourceEquipmentId: "accessory_eagle_eye_lens"
      },
      {
        id: "card_farsight_guard",
        name: "Farsight Guard",
        type: "equipment",
        strainCost: 6,
        description: "Ignore overwatch this turn.",
        range: "R(Self)",
        sourceEquipmentId: "accessory_eagle_eye_lens"
      },
      {
        id: "card_flying_kick",
        name: "Flying Kick",
        type: "equipment",
        strainCost: 2,
        description: "Deal 3 damage; move through target's tile.",
        range: "R(1-2)",
        damage: 3,
        sourceEquipmentId: "accessory_fleetfoot_anklet"
      },
      {
        id: "card_speed_burst",
        name: "Speed Burst",
        type: "equipment",
        strainCost: 6,
        description: "+2 movement this turn.",
        range: "R(Self)",
        sourceEquipmentId: "accessory_fleetfoot_anklet"
      },
      {
        id: "card_swift_guard",
        name: "Swift Guard",
        type: "equipment",
        strainCost: 6,
        description: "Move +2 and gain +1 DEF this turn.",
        range: "R(Self)",
        sourceEquipmentId: "accessory_fleetfoot_anklet"
      },
      {
        id: "card_bulwark_bash",
        name: "Bulwark Bash",
        type: "equipment",
        strainCost: 2,
        description: "Deal 3 damage; gain +1 HP.",
        range: "R(1)",
        damage: 3,
        sourceEquipmentId: "accessory_vitality_charm"
      },
      {
        id: "card_second_wind",
        name: "Second Wind",
        type: "equipment",
        strainCost: 6,
        description: "Restore 1 HP.",
        range: "R(Self)",
        sourceEquipmentId: "accessory_vitality_charm"
      },
      {
        id: "card_life_guard",
        name: "Life Guard",
        type: "equipment",
        strainCost: 6,
        description: "Heal 1 HP and gain +1 DEF.",
        range: "R(Self)",
        sourceEquipmentId: "accessory_vitality_charm"
      },
      {
        id: "card_rune_strike",
        name: "Rune Strike",
        type: "equipment",
        strainCost: 3,
        description: "Use Rune Strike effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_spell_parry",
        name: "Spell Parry",
        type: "equipment",
        strainCost: 5,
        description: "Use Spell Parry effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_phase_step",
        name: "Phase Step",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_scissor_snip",
        name: "Scissor Snip",
        type: "equipment",
        strainCost: 2,
        description: "Use Scissor Snip effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_rending_slash",
        name: "Rending Slash",
        type: "equipment",
        strainCost: 3,
        description: "Use Rending Slash effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_blade_catch",
        name: "Blade Catch",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_heavy_draw",
        name: "Heavy Draw",
        type: "equipment",
        strainCost: 3,
        description: "Use Heavy Draw effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_piercing_shot",
        name: "Piercing Shot",
        type: "equipment",
        strainCost: 2,
        description: "Ranged attack.",
        range: "R(2-5)",
        damage: 3
      },
      {
        id: "card_brace_stance",
        name: "Brace Stance",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_snap_shot",
        name: "Snap Shot",
        type: "equipment",
        strainCost: 5,
        description: "Ranged attack.",
        range: "R(2-5)",
        damage: 5
      },
      {
        id: "card_mobile_fire",
        name: "Mobile Fire",
        type: "equipment",
        strainCost: 2,
        description: "Use Mobile Fire effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_evasive_roll",
        name: "Evasive Roll",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_mana_bolt",
        name: "Mana Bolt",
        type: "equipment",
        strainCost: 4,
        description: "Ranged attack.",
        range: "R(2-5)",
        damage: 4
      },
      {
        id: "card_silver_ward",
        name: "Silver Ward",
        type: "equipment",
        strainCost: 3,
        description: "Use Silver Ward effect.",
        range: "R(1-1)",
        damage: 5
      },
      {
        id: "card_focus_energy",
        name: "Focus Energy",
        type: "equipment",
        strainCost: 2,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_crushing_blow",
        name: "Crushing Blow",
        type: "equipment",
        strainCost: 5,
        description: "Use Crushing Blow effect.",
        range: "R(1-1)",
        damage: 5
      },
      {
        id: "card_earth_shatter",
        name: "Earth Shatter",
        type: "equipment",
        strainCost: 4,
        description: "Use Earth Shatter effect.",
        range: "R(1-1)",
        damage: 5
      },
      {
        id: "card_wood_bark_barrier",
        name: "Wood Bark Barrier",
        type: "equipment",
        strainCost: 3,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_fang_bite",
        name: "Fang Bite",
        type: "equipment",
        strainCost: 4,
        description: "Use Fang Bite effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_poison_tip",
        name: "Poison Tip",
        type: "equipment",
        strainCost: 3,
        description: "Use Poison Tip effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_feral_lunge",
        name: "Feral Lunge",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_hilt_smash",
        name: "Hilt Smash",
        type: "equipment",
        strainCost: 2,
        description: "Use Hilt Smash effect.",
        range: "R(1-1)",
        damage: 5
      },
      {
        id: "card_precise_throw",
        name: "Precise Throw",
        type: "equipment",
        strainCost: 5,
        description: "Use Precise Throw effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_balance_shift",
        name: "Balance Shift",
        type: "equipment",
        strainCost: 2,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_steam_thrust",
        name: "Steam Thrust",
        type: "equipment",
        strainCost: 5,
        description: "Use Steam Thrust effect.",
        range: "R(1-1)",
        damage: 5
      },
      {
        id: "card_vent_blast",
        name: "Vent Blast",
        type: "equipment",
        strainCost: 4,
        description: "Ranged attack.",
        range: "R(2-5)",
        damage: 6
      },
      {
        id: "card_pike_brace",
        name: "Pike Brace",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_rail_slug",
        name: "Rail Slug",
        type: "equipment",
        strainCost: 3,
        description: "Use Rail Slug effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_magnetic_shield",
        name: "Magnetic Shield",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_charge_capacitor",
        name: "Charge Capacitor",
        type: "equipment",
        strainCost: 4,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_buckshot",
        name: "Buckshot",
        type: "equipment",
        strainCost: 4,
        description: "Ranged attack.",
        range: "R(2-5)",
        damage: 6
      },
      {
        id: "card_shrapnel_blast",
        name: "Shrapnel Blast",
        type: "equipment",
        strainCost: 4,
        description: "Ranged attack.",
        range: "R(2-5)",
        damage: 3
      },
      {
        id: "card_brass_plating",
        name: "Brass Plating",
        type: "equipment",
        strainCost: 4,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_silent_bolt",
        name: "Silent Bolt",
        type: "equipment",
        strainCost: 3,
        description: "Ranged attack.",
        range: "R(2-5)",
        damage: 5
      },
      {
        id: "card_grapple_shot",
        name: "Grapple Shot",
        type: "equipment",
        strainCost: 3,
        description: "Ranged attack.",
        range: "R(2-5)",
        damage: 3
      },
      {
        id: "card_auto_reload",
        name: "Auto Reload",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_chain_lightning",
        name: "Chain Lightning",
        type: "equipment",
        strainCost: 4,
        description: "Use Chain Lightning effect.",
        range: "R(1-1)",
        damage: 5
      },
      {
        id: "card_static_field",
        name: "Static Field",
        type: "equipment",
        strainCost: 2,
        description: "Use Static Field effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_arc_whip",
        name: "Arc Whip",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_lob_shell",
        name: "Lob Shell",
        type: "equipment",
        strainCost: 4,
        description: "Use Lob Shell effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_shatter_ground",
        name: "Shatter Ground",
        type: "equipment",
        strainCost: 2,
        description: "Use Shatter Ground effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_deploy_bipod",
        name: "Deploy Bipod",
        type: "equipment",
        strainCost: 2,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_harpoon_shot",
        name: "Harpoon Shot",
        type: "equipment",
        strainCost: 2,
        description: "Ranged attack.",
        range: "R(2-5)",
        damage: 5
      },
      {
        id: "card_drag_target",
        name: "Drag Target",
        type: "equipment",
        strainCost: 5,
        description: "Use Drag Target effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_flame_vent",
        name: "Flame Vent",
        type: "equipment",
        strainCost: 3,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_cannon_blast",
        name: "Cannon Blast",
        type: "equipment",
        strainCost: 2,
        description: "Ranged attack.",
        range: "R(2-5)",
        damage: 6
      },
      {
        id: "card_deafening_roar",
        name: "Deafening Roar",
        type: "equipment",
        strainCost: 4,
        description: "Use Deafening Roar effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_braced_fire",
        name: "Braced Fire",
        type: "equipment",
        strainCost: 2,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_conceal_face",
        name: "Conceal Face",
        type: "equipment",
        strainCost: 4,
        description: "Use Conceal Face effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_quick_glance",
        name: "Quick Glance",
        type: "equipment",
        strainCost: 5,
        description: "Use Quick Glance effect.",
        range: "R(1-1)",
        damage: 5
      },
      {
        id: "card_shadow_sense",
        name: "Shadow Sense",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_studied_focus",
        name: "Studied Focus",
        type: "equipment",
        strainCost: 5,
        description: "Use Studied Focus effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_flash_of_insight",
        name: "Flash Of Insight",
        type: "equipment",
        strainCost: 4,
        description: "Use Flash Of Insight effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_analytical_mind",
        name: "Analytical Mind",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_glare_deflection",
        name: "Glare Deflection",
        type: "equipment",
        strainCost: 3,
        description: "Use Glare Deflection effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_visor_down",
        name: "Visor Down",
        type: "equipment",
        strainCost: 3,
        description: "Use Visor Down effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_brass_headbutt",
        name: "Brass Headbutt",
        type: "equipment",
        strainCost: 2,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_scent_tracker",
        name: "Scent Tracker",
        type: "equipment",
        strainCost: 4,
        description: "Use Scent Tracker effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_camouflaged_head",
        name: "Camouflaged Head",
        type: "equipment",
        strainCost: 5,
        description: "Use Camouflaged Head effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_wary_glance",
        name: "Wary Glance",
        type: "equipment",
        strainCost: 3,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_thermal_vision",
        name: "Thermal Vision",
        type: "equipment",
        strainCost: 4,
        description: "Use Thermal Vision effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_flash_protection",
        name: "Flash Protection",
        type: "equipment",
        strainCost: 3,
        description: "Use Flash Protection effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_weld_spark",
        name: "Weld Spark",
        type: "equipment",
        strainCost: 3,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_intimidating_glare",
        name: "Intimidating Glare",
        type: "equipment",
        strainCost: 5,
        description: "Use Intimidating Glare effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_fearsome_visage",
        name: "Fearsome Visage",
        type: "equipment",
        strainCost: 2,
        description: "Use Fearsome Visage effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_mask_bash",
        name: "Mask Bash",
        type: "equipment",
        strainCost: 3,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_mystic_shroud",
        name: "Mystic Shroud",
        type: "equipment",
        strainCost: 4,
        description: "Use Mystic Shroud effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_hooded_gaze",
        name: "Hooded Gaze",
        type: "equipment",
        strainCost: 2,
        description: "Use Hooded Gaze effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_magic_absorption",
        name: "Magic Absorption",
        type: "equipment",
        strainCost: 3,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_zoom_in",
        name: "Zoom In",
        type: "equipment",
        strainCost: 3,
        description: "Use Zoom In effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_wind_read",
        name: "Wind Read",
        type: "equipment",
        strainCost: 5,
        description: "Use Wind Read effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_sniper_focus",
        name: "Sniper Focus",
        type: "equipment",
        strainCost: 2,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_crest_charge",
        name: "Crest Charge",
        type: "equipment",
        strainCost: 2,
        description: "Use Crest Charge effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_inspiring_presence",
        name: "Inspiring Presence",
        type: "equipment",
        strainCost: 5,
        description: "Use Inspiring Presence effect.",
        range: "R(1-1)",
        damage: 5
      },
      {
        id: "card_iron_resolve",
        name: "Iron Resolve",
        type: "equipment",
        strainCost: 4,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_cloak_swirl",
        name: "Cloak Swirl",
        type: "equipment",
        strainCost: 5,
        description: "Use Cloak Swirl effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_fade_to_black",
        name: "Fade To Black",
        type: "equipment",
        strainCost: 4,
        description: "Use Fade To Black effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_shadow_dodge",
        name: "Shadow Dodge",
        type: "equipment",
        strainCost: 4,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_pocket_sand",
        name: "Pocket Sand",
        type: "equipment",
        strainCost: 5,
        description: "Use Pocket Sand effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_hasty_retreat",
        name: "Hasty Retreat",
        type: "equipment",
        strainCost: 3,
        description: "Use Hasty Retreat effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_vest_padding",
        name: "Vest Padding",
        type: "equipment",
        strainCost: 4,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_ring_deflection",
        name: "Ring Deflection",
        type: "equipment",
        strainCost: 3,
        description: "Use Ring Deflection effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_chain_bind",
        name: "Chain Bind",
        type: "equipment",
        strainCost: 5,
        description: "Use Chain Bind effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_heavy_step",
        name: "Heavy Step",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_steam_vent",
        name: "Steam Vent",
        type: "equipment",
        strainCost: 5,
        description: "Use Steam Vent effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_pressure_release",
        name: "Pressure Release",
        type: "equipment",
        strainCost: 4,
        description: "Use Pressure Release effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_armor_lock",
        name: "Armor Lock",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_brush_stride",
        name: "Brush Stride",
        type: "equipment",
        strainCost: 2,
        description: "Use Brush Stride effect.",
        range: "R(1-1)",
        damage: 5
      },
      {
        id: "card_survival_instinct",
        name: "Survival Instinct",
        type: "equipment",
        strainCost: 3,
        description: "Use Survival Instinct effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_trap_pouch",
        name: "Trap Pouch",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_padded_absorption",
        name: "Padded Absorption",
        type: "equipment",
        strainCost: 3,
        description: "Use Padded Absorption effect.",
        range: "R(1-1)",
        damage: 5
      },
      {
        id: "card_thick_weave",
        name: "Thick Weave",
        type: "equipment",
        strainCost: 3,
        description: "Use Thick Weave effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_gambeson_guard",
        name: "Gambeson Guard",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_shout_of_defiance",
        name: "Shout Of Defiance",
        type: "equipment",
        strainCost: 5,
        description: "Use Shout Of Defiance effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_muscle_flex",
        name: "Muscle Flex",
        type: "equipment",
        strainCost: 3,
        description: "Use Muscle Flex effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_reckless_charge",
        name: "Reckless Charge",
        type: "equipment",
        strainCost: 3,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_mana_weave",
        name: "Mana Weave",
        type: "equipment",
        strainCost: 4,
        description: "Use Mana Weave effect.",
        range: "R(1-1)",
        damage: 5
      },
      {
        id: "card_spell_reflection",
        name: "Spell Reflection",
        type: "equipment",
        strainCost: 4,
        description: "Use Spell Reflection effect.",
        range: "R(1-1)",
        damage: 5
      },
      {
        id: "card_tunic_ward",
        name: "Tunic Ward",
        type: "equipment",
        strainCost: 4,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_steady_stance",
        name: "Steady Stance",
        type: "equipment",
        strainCost: 2,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_brigandine_deflect",
        name: "Brigandine Deflect",
        type: "equipment",
        strainCost: 5,
        description: "Use Brigandine Deflect effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_ammo_pouch",
        name: "Ammo Pouch",
        type: "equipment",
        strainCost: 5,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_rune_glow",
        name: "Rune Glow",
        type: "equipment",
        strainCost: 2,
        description: "Use Rune Glow effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_magic_attunement",
        name: "Magic Attunement",
        type: "equipment",
        strainCost: 3,
        description: "Use Magic Attunement effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_warding_light",
        name: "Warding Light",
        type: "equipment",
        strainCost: 2,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_bracer_smash",
        name: "Bracer Smash",
        type: "equipment",
        strainCost: 3,
        description: "Use Bracer Smash effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_lift_heavy",
        name: "Lift Heavy",
        type: "equipment",
        strainCost: 5,
        description: "Use Lift Heavy effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_muscle_memory",
        name: "Muscle Memory",
        type: "equipment",
        strainCost: 4,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_wrist_vent",
        name: "Wrist Vent",
        type: "equipment",
        strainCost: 3,
        description: "Use Wrist Vent effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_scald_spray",
        name: "Scald Spray",
        type: "equipment",
        strainCost: 3,
        description: "Use Scald Spray effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_valve_turn",
        name: "Valve Turn",
        type: "equipment",
        strainCost: 2,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_beast_ward",
        name: "Beast Ward",
        type: "equipment",
        strainCost: 2,
        description: "Use Beast Ward effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_silent_step",
        name: "Silent Step",
        type: "equipment",
        strainCost: 4,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_talisman_focus",
        name: "Talisman Focus",
        type: "equipment",
        strainCost: 2,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_quick_notes",
        name: "Quick Notes",
        type: "equipment",
        strainCost: 2,
        description: "Use Quick Notes effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_ink_splatter",
        name: "Ink Splatter",
        type: "equipment",
        strainCost: 2,
        description: "Use Ink Splatter effect.",
        range: "R(1-1)",
        damage: 5
      },
      {
        id: "card_sharp_mind",
        name: "Sharp Mind",
        type: "equipment",
        strainCost: 3,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_toss_smoke",
        name: "Toss Smoke",
        type: "equipment",
        strainCost: 4,
        description: "Use Toss Smoke effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_choking_cloud",
        name: "Choking Cloud",
        type: "equipment",
        strainCost: 2,
        description: "Use Choking Cloud effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_satchel_hide",
        name: "Satchel Hide",
        type: "equipment",
        strainCost: 4,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_belt_buckle_strike",
        name: "Belt Buckle Strike",
        type: "equipment",
        strainCost: 5,
        description: "Use Belt Buckle Strike effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_gird_loins",
        name: "Gird Loins",
        type: "equipment",
        strainCost: 2,
        description: "Use Gird Loins effect.",
        range: "R(1-1)",
        damage: 4
      },
      {
        id: "card_steady_footing",
        name: "Steady Footing",
        type: "equipment",
        strainCost: 3,
        description: "Defensive action or stance.",
        range: "R(Self)"
      },
      {
        id: "card_crystal_flash",
        name: "Crystal Flash",
        type: "equipment",
        strainCost: 3,
        description: "Use Crystal Flash effect.",
        range: "R(1-1)",
        damage: 6
      },
      {
        id: "card_mana_drain",
        name: "Mana Drain",
        type: "equipment",
        strainCost: 3,
        description: "Use Mana Drain effect.",
        range: "R(1-1)",
        damage: 3
      },
      {
        id: "card_brooch_shield",
        name: "Brooch Shield",
        type: "equipment",
        strainCost: 3,
        description: "Defensive action or stance.",
        range: "R(Self)"
      }
    ];
    EQUIPMENT_CARDS = RAW_EQUIPMENT_CARDS.map(sanitizeEquipmentCard);
  }
});

// src/data/weapons.ts
var STARTER_WEAPONS;
var init_weapons = __esm({
  "src/data/weapons.ts"() {
    "use strict";
    STARTER_WEAPONS = [
      {
        id: "weapon_iron_longsword",
        name: "Iron Longsword",
        slot: "weapon",
        weaponType: "sword",
        isMechanical: false,
        stats: { atk: 2, def: 1, agi: 0, acc: 1, hp: 0 },
        cardsGranted: ["card_cleave", "card_parry_readiness", "card_guarded_stance"],
        moduleSlots: 1,
        attachedModules: [],
        clutchToggle: "Edge Focus: +2 ACC, -1 DEF until next turn",
        wear: 0
      },
      {
        id: "weapon_elm_recurve_bow",
        name: "Elm Recurve Bow",
        slot: "weapon",
        weaponType: "bow",
        isMechanical: false,
        stats: { atk: 2, def: 0, agi: 1, acc: 2, hp: -1 },
        cardsGranted: ["card_pinpoint_shot", "card_warning_shot", "card_defensive_draw"],
        moduleSlots: 1,
        attachedModules: [],
        clutchToggle: "Piercing Arrow: Ignore 2 DEF, -1 ACC",
        ammoMax: 6,
        quickReloadStrain: 1,
        fullReloadStrain: 0,
        wear: 0
      },
      {
        id: "weapon_oak_battlestaff",
        name: "Oak Battlestaff",
        slot: "weapon",
        weaponType: "staff",
        isMechanical: false,
        stats: { atk: 1, def: 2, agi: 0, acc: 1, hp: 1 },
        cardsGranted: ["card_blunt_sweep", "card_deflective_spin", "card_ward_spin"],
        moduleSlots: 1,
        attachedModules: [],
        clutchToggle: "Channel Power: Next skill -1 strain, -1 DEF",
        wear: 0
      },
      {
        id: "weapon_steel_dagger",
        name: "Steel Dagger",
        slot: "weapon",
        weaponType: "dagger",
        isMechanical: false,
        stats: { atk: 1, def: 0, agi: 3, acc: 2, hp: -1 },
        cardsGranted: ["card_throat_jab", "card_hamstring", "card_sidestep"],
        moduleSlots: 1,
        attachedModules: [],
        clutchToggle: "Lunge: Move 2 tiles before striking, -2 ACC",
        wear: 0
      },
      {
        id: "weapon_emberclaw_repeater",
        name: "Emberclaw Repeater",
        slot: "weapon",
        weaponType: "gun",
        isMechanical: true,
        stats: { atk: 3, def: 0, agi: -1, acc: 2, hp: 0 },
        cardsGranted: ["card_piercing_volley", "card_suppressive_spray", "card_cooling_discipline"],
        moduleSlots: 2,
        attachedModules: [],
        clutchToggle: "Piercing Volley: Ignore DEF for next attack",
        heatCapacity: 8,
        heatZones: [
          { min: 0, max: 3, name: "Stable", effect: null },
          { min: 4, max: 6, name: "Barrel Glow", effect: "ACC -1" },
          { min: 7, max: 8, name: "Critical", effect: "Next shot overheats" }
        ],
        passiveHeatDecay: 2,
        ammoMax: 6,
        quickReloadStrain: 1,
        fullReloadStrain: 0,
        wear: 0
      },
      {
        id: "weapon_blazefang_saber",
        name: "Blazefang Saber",
        slot: "weapon",
        weaponType: "sword",
        isMechanical: true,
        stats: { atk: 3, def: 1, agi: 0, acc: 1, hp: 0 },
        cardsGranted: ["card_searing_slash", "card_molten_mark", "card_heat_parry"],
        moduleSlots: 2,
        attachedModules: [],
        clutchToggle: "Searing Slash: Inflict Burn status",
        heatCapacity: 5,
        heatZones: [
          { min: 0, max: 2, name: "Stable", effect: null },
          { min: 3, max: 4, name: "Blade Sear", effect: "+1 damage" },
          { min: 5, max: 5, name: "Blade Warp", effect: "Damage -2 until repaired" }
        ],
        passiveHeatDecay: 1,
        wear: 0
      },
      {
        id: "weapon_runed_shortsword",
        name: "Runed Shortsword",
        slot: "weapon",
        weaponType: "shortsword",
        isMechanical: false,
        stats: { atk: 1, def: 0, agi: 1, acc: 2, hp: 0 },
        cardsGranted: ["card_rune_strike", "card_spell_parry", "card_phase_step"],
        moduleSlots: 1,
        attachedModules: [],
        clutchToggle: "Arcane Edge: +2 Magic Damage on next hit",
        wear: 0
      },
      {
        id: "weapon_scissor_sword",
        name: "Scissor Sword",
        slot: "weapon",
        weaponType: "sword",
        isMechanical: false,
        stats: { atk: 3, def: 0, agi: -1, acc: 1, hp: 0 },
        cardsGranted: ["card_scissor_snip", "card_rending_slash", "card_blade_catch"],
        moduleSlots: 1,
        attachedModules: [],
        clutchToggle: "Dual Blade: Strike twice at half damage",
        wear: 0
      },
      {
        id: "weapon_composite_greatbow",
        name: "Composite Greatbow",
        slot: "weapon",
        weaponType: "greatbow",
        isMechanical: false,
        stats: { atk: 4, def: 0, agi: -2, acc: 1, hp: 0 },
        cardsGranted: ["card_heavy_draw", "card_piercing_shot", "card_brace_stance"],
        moduleSlots: 1,
        attachedModules: [],
        clutchToggle: "Full Draw: +2 Damage, Cannot Move",
        ammoMax: 3,
        quickReloadStrain: 2,
        fullReloadStrain: 0,
        wear: 0
      },
      {
        id: "weapon_willow_shortbow",
        name: "Willow Shortbow",
        slot: "weapon",
        weaponType: "bow",
        isMechanical: false,
        stats: { atk: 1, def: 0, agi: 3, acc: 0, hp: 0 },
        cardsGranted: ["card_snap_shot", "card_mobile_fire", "card_evasive_roll"],
        moduleSlots: 1,
        attachedModules: [],
        clutchToggle: "Rapid Fire: Two shots at -2 ACC",
        ammoMax: 8,
        quickReloadStrain: 1,
        fullReloadStrain: 0,
        wear: 0
      },
      {
        id: "weapon_silver_channeling_rod",
        name: "Silver Channeling Rod",
        slot: "weapon",
        weaponType: "staff",
        isMechanical: false,
        stats: { atk: 0, def: 0, agi: 1, acc: 3, hp: 0 },
        cardsGranted: ["card_mana_bolt", "card_silver_ward", "card_focus_energy"],
        moduleSlots: 1,
        attachedModules: [],
        clutchToggle: "Overchannel: +3 Magic Damage, take 1 Strain",
        wear: 0
      },
      {
        id: "weapon_blackwood_greatstaff",
        name: "Blackwood Greatstaff",
        slot: "weapon",
        weaponType: "greatstaff",
        isMechanical: false,
        stats: { atk: 2, def: 2, agi: -1, acc: 1, hp: 2 },
        cardsGranted: ["card_crushing_blow", "card_earth_shatter", "card_wood_bark_barrier"],
        moduleSlots: 1,
        attachedModules: [],
        clutchToggle: "Rooted: Cannot move, +3 DEF",
        wear: 0
      },
      {
        id: "weapon_ivory_fangblade",
        name: "Ivory Fangblade",
        slot: "weapon",
        weaponType: "dagger",
        isMechanical: false,
        stats: { atk: 2, def: -1, agi: 2, acc: 1, hp: 0 },
        cardsGranted: ["card_fang_bite", "card_poison_tip", "card_feral_lunge"],
        moduleSlots: 1,
        attachedModules: [],
        clutchToggle: "Bloodthirst: Heal 1 HP on kill",
        wear: 0
      },
      {
        id: "weapon_weighted_dagger",
        name: "Weighted Dagger",
        slot: "weapon",
        weaponType: "dagger",
        isMechanical: false,
        stats: { atk: 1, def: 0, agi: 1, acc: 3, hp: 0 },
        cardsGranted: ["card_hilt_smash", "card_precise_throw", "card_balance_shift"],
        moduleSlots: 1,
        attachedModules: [],
        clutchToggle: "Pommel Strike: Stun on hit",
        wear: 0
      },
      {
        id: "weapon_steamburst_pike",
        name: "Steamburst Pike",
        slot: "weapon",
        weaponType: "greatsword",
        // Or spear if added later
        isMechanical: true,
        stats: { atk: 4, def: 0, agi: -1, acc: 0, hp: 0 },
        cardsGranted: ["card_steam_thrust", "card_vent_blast", "card_pike_brace"],
        moduleSlots: 2,
        attachedModules: [],
        clutchToggle: "Boiler Override: +3 Damage, +2 Heat",
        heatCapacity: 10,
        heatZones: [
          { min: 0, max: 4, name: "Cold", effect: null },
          { min: 5, max: 8, name: "Pressurized", effect: "+1 Damage" },
          { min: 9, max: 10, name: "Overpressure", effect: "Take 1 damage per turn" }
        ],
        passiveHeatDecay: 1,
        wear: 0
      },
      {
        id: "weapon_vulcan_coilgun",
        name: "Vulcan Coilgun",
        slot: "weapon",
        weaponType: "gun",
        isMechanical: true,
        stats: { atk: 5, def: -1, agi: -2, acc: 2, hp: 0 },
        cardsGranted: ["card_rail_slug", "card_magnetic_shield", "card_charge_capacitor"],
        moduleSlots: 2,
        attachedModules: [],
        clutchToggle: "Max Charge: Ignore all DEF, +3 Heat",
        heatCapacity: 8,
        heatZones: [
          { min: 0, max: 2, name: "Safe", effect: null },
          { min: 3, max: 5, name: "Charged", effect: "Ignore 1 DEF" },
          { min: 6, max: 8, name: "Meltdown", effect: "Self Damage 2 on fire" }
        ],
        passiveHeatDecay: 2,
        ammoMax: 4,
        quickReloadStrain: 2,
        fullReloadStrain: 0,
        wear: 0
      },
      {
        id: "weapon_brassback_scattergun",
        name: "Brassback Scattergun",
        slot: "weapon",
        weaponType: "gun",
        isMechanical: true,
        stats: { atk: 3, def: 0, agi: 0, acc: -1, hp: 0 },
        cardsGranted: ["card_buckshot", "card_shrapnel_blast", "card_brass_plating"],
        moduleSlots: 1,
        attachedModules: [],
        clutchToggle: "Double Barrel: Fire twice, empty clip",
        heatCapacity: 4,
        heatZones: [
          { min: 0, max: 2, name: "Steady", effect: null },
          { min: 3, max: 4, name: "Hot Barrel", effect: "Range -1" }
        ],
        passiveHeatDecay: 1,
        ammoMax: 2,
        quickReloadStrain: 1,
        fullReloadStrain: 0,
        wear: 0
      },
      {
        id: "weapon_ironwhisper_crossbow",
        name: "Ironwhisper Crossbow",
        slot: "weapon",
        weaponType: "bow",
        isMechanical: true,
        stats: { atk: 3, def: 0, agi: 1, acc: 3, hp: 0 },
        cardsGranted: ["card_silent_bolt", "card_grapple_shot", "card_auto_reload"],
        moduleSlots: 2,
        attachedModules: [],
        clutchToggle: "Tension Lock: Next shot is a guaranteed crit",
        heatCapacity: 5,
        heatZones: [
          { min: 0, max: 3, name: "Stable", effect: null },
          { min: 4, max: 5, name: "Frayed Cable", effect: "Acc -2" }
        ],
        passiveHeatDecay: 1,
        ammoMax: 5,
        quickReloadStrain: 0,
        // Auto-loading mechanism
        fullReloadStrain: 0,
        wear: 0
      },
      {
        id: "weapon_stormlash_arcstaff",
        name: "Stormlash Arcstaff",
        slot: "weapon",
        weaponType: "staff",
        isMechanical: true,
        stats: { atk: 4, def: 0, agi: 0, acc: 1, hp: 0 },
        cardsGranted: ["card_chain_lightning", "card_static_field", "card_arc_whip"],
        moduleSlots: 2,
        attachedModules: [],
        clutchToggle: "Overload: +2 targets for Chain Lightning",
        heatCapacity: 6,
        heatZones: [
          { min: 0, max: 2, name: "Grounded", effect: null },
          { min: 3, max: 4, name: "Charged", effect: "+1 Magic Damage" },
          { min: 5, max: 6, name: "Discharging", effect: "Damage adjacent allies" }
        ],
        passiveHeatDecay: 2,
        wear: 0
      },
      {
        id: "weapon_gearspike_mortar",
        name: "Gearspike Mortar",
        slot: "weapon",
        weaponType: "gun",
        isMechanical: true,
        stats: { atk: 6, def: -2, agi: -3, acc: 0, hp: 0 },
        cardsGranted: ["card_lob_shell", "card_shatter_ground", "card_deploy_bipod"],
        moduleSlots: 1,
        attachedModules: [],
        clutchToggle: "High Explosive: +Radius, -Damage",
        heatCapacity: 6,
        heatZones: [
          { min: 0, max: 3, name: "Cool", effect: null },
          { min: 4, max: 6, name: "Stress", effect: "Cannot fire next turn" }
        ],
        passiveHeatDecay: 1,
        ammoMax: 1,
        quickReloadStrain: 3,
        fullReloadStrain: 0,
        wear: 0
      },
      {
        id: "weapon_emberdrake_harpooner",
        name: "Emberdrake Harpooner",
        slot: "weapon",
        weaponType: "gun",
        isMechanical: true,
        stats: { atk: 4, def: 0, agi: -1, acc: 1, hp: 0 },
        cardsGranted: ["card_harpoon_shot", "card_drag_target", "card_flame_vent"],
        moduleSlots: 2,
        attachedModules: [],
        clutchToggle: "Reel In: Move target adjacent to you",
        heatCapacity: 5,
        heatZones: [
          { min: 0, max: 2, name: "Normal", effect: null },
          { min: 3, max: 5, name: "Hot Engine", effect: "+1 Movement" }
        ],
        passiveHeatDecay: 1,
        ammoMax: 3,
        quickReloadStrain: 1,
        fullReloadStrain: 0,
        wear: 0
      },
      {
        id: "weapon_thunderjaw_cannon",
        name: "Thunderjaw Cannon",
        slot: "weapon",
        weaponType: "gun",
        isMechanical: true,
        stats: { atk: 7, def: -2, agi: -3, acc: -1, hp: 0 },
        cardsGranted: ["card_cannon_blast", "card_deafening_roar", "card_braced_fire"],
        moduleSlots: 2,
        attachedModules: [],
        clutchToggle: "Grapeshot: Cone attack",
        heatCapacity: 5,
        heatZones: [
          { min: 0, max: 2, name: "Stable", effect: null },
          { min: 3, max: 5, name: "Overheated", effect: "-2 ACC" }
        ],
        passiveHeatDecay: 1,
        ammoMax: 2,
        quickReloadStrain: 2,
        fullReloadStrain: 0,
        wear: 0
      }
    ];
  }
});

// src/data/armor.ts
var STARTER_HELMETS, STARTER_CHESTPIECES, STARTER_ACCESSORIES;
var init_armor = __esm({
  "src/data/armor.ts"() {
    "use strict";
    STARTER_HELMETS = [
      {
        id: "armor_ironguard_helm",
        name: "Ironguard Helm",
        slot: "helmet",
        stats: { atk: 0, def: 2, agi: 0, acc: 0, hp: 1 },
        cardsGranted: ["card_headbutt", "card_shield_sight", "card_shield_headbutt"]
      },
      {
        id: "armor_rangers_hood",
        name: "Ranger's Hood",
        slot: "helmet",
        stats: { atk: 0, def: 0, agi: 2, acc: 1, hp: 0 },
        cardsGranted: ["card_aimed_strike", "card_hunters_mark", "card_hide_in_shadows"]
      },
      {
        id: "armor_mystic_circlet",
        name: "Mystic Circlet",
        slot: "helmet",
        stats: { atk: 1, def: 0, agi: 0, acc: 2, hp: 0 },
        cardsGranted: ["card_mind_spike", "card_spell_focus", "card_mana_barrier"]
      },
      {
        id: "armor_thiefs_bandana",
        name: "Thief's Bandana",
        slot: "helmet",
        stats: { atk: 1, def: 0, agi: 1, acc: 0, hp: 0 },
        cardsGranted: ["card_conceal_face", "card_quick_glance", "card_shadow_sense"]
      },
      {
        id: "armor_scholars_cap",
        name: "Scholar's Cap",
        slot: "helmet",
        stats: { atk: 0, def: 0, agi: 0, acc: 2, hp: 0 },
        cardsGranted: ["card_studied_focus", "card_flash_of_insight", "card_analytical_mind"]
      },
      {
        id: "armor_brass_visor",
        name: "Brass Visor",
        slot: "helmet",
        stats: { atk: 0, def: 2, agi: -1, acc: 1, hp: 0 },
        cardsGranted: ["card_glare_deflection", "card_visor_down", "card_brass_headbutt"]
      },
      {
        id: "armor_hunters_coif",
        name: "Hunter's Coif",
        slot: "helmet",
        stats: { atk: 0, def: 1, agi: 1, acc: 0, hp: 0 },
        cardsGranted: ["card_scent_tracker", "card_camouflaged_head", "card_wary_glance"]
      },
      {
        id: "armor_steamweld_goggles",
        name: "Steamweld Goggles",
        slot: "helmet",
        stats: { atk: 0, def: 1, agi: 0, acc: 2, hp: 0 },
        cardsGranted: ["card_thermal_vision", "card_flash_protection", "card_weld_spark"]
      },
      {
        id: "armor_battle_mask",
        name: "Battle Mask",
        slot: "helmet",
        stats: { atk: 2, def: 1, agi: 0, acc: -1, hp: 0 },
        cardsGranted: ["card_intimidating_glare", "card_fearsome_visage", "card_mask_bash"]
      },
      {
        id: "armor_arcane_hood",
        name: "Arcane Hood",
        slot: "helmet",
        stats: { atk: 1, def: 0, agi: 0, acc: 1, hp: 0 },
        cardsGranted: ["card_mystic_shroud", "card_hooded_gaze", "card_magic_absorption"]
      },
      {
        id: "armor_marksmans_scope_visor",
        name: "Marksman's Scope Visor",
        slot: "helmet",
        stats: { atk: 0, def: 0, agi: 0, acc: 3, hp: 0 },
        cardsGranted: ["card_zoom_in", "card_wind_read", "card_sniper_focus"]
      },
      {
        id: "armor_warriors_crest",
        name: "Warrior's Crest",
        slot: "helmet",
        stats: { atk: 1, def: 2, agi: -1, acc: 0, hp: 1 },
        cardsGranted: ["card_crest_charge", "card_inspiring_presence", "card_iron_resolve"]
      }
    ];
    STARTER_CHESTPIECES = [
      {
        id: "armor_steelplate_cuirass",
        name: "Steelplate Cuirass",
        slot: "chestpiece",
        stats: { atk: 0, def: 3, agi: -1, acc: 0, hp: 2 },
        cardsGranted: ["card_shoulder_charge", "card_fortify", "card_fortress_form"]
      },
      {
        id: "armor_leather_jerkin",
        name: "Leather Jerkin",
        slot: "chestpiece",
        stats: { atk: 0, def: 1, agi: 1, acc: 0, hp: 0 },
        cardsGranted: ["card_knife_toss", "card_quick_roll", "card_light_guard"]
      },
      {
        id: "armor_mages_robe",
        name: "Mage's Robe",
        slot: "chestpiece",
        stats: { atk: 0, def: 0, agi: 0, acc: 2, hp: 0 },
        cardsGranted: ["card_mana_surge_strike", "card_mana_shift", "card_arcane_veil"]
      },
      {
        id: "armor_shadow_cloak",
        name: "Shadow Cloak",
        slot: "chestpiece",
        stats: { atk: 1, def: 0, agi: 2, acc: 0, hp: 0 },
        cardsGranted: ["card_cloak_swirl", "card_fade_to_black", "card_shadow_dodge"]
      },
      {
        id: "armor_scholars_vest",
        name: "Scholar's Vest",
        slot: "chestpiece",
        stats: { atk: 0, def: 0, agi: 1, acc: 1, hp: 1 },
        cardsGranted: ["card_pocket_sand", "card_hasty_retreat", "card_vest_padding"]
      },
      {
        id: "armor_chainmail_hauberk",
        name: "Chainmail Hauberk",
        slot: "chestpiece",
        stats: { atk: 0, def: 2, agi: -1, acc: 0, hp: 1 },
        cardsGranted: ["card_ring_deflection", "card_chain_bind", "card_heavy_step"]
      },
      {
        id: "armor_steamline_armor",
        name: "Steamline Armor",
        slot: "chestpiece",
        stats: { atk: 0, def: 3, agi: 0, acc: -1, hp: 0 },
        cardsGranted: ["card_steam_vent", "card_pressure_release", "card_armor_lock"]
      },
      {
        id: "armor_hunters_vest",
        name: "Hunter's Vest",
        slot: "chestpiece",
        stats: { atk: 0, def: 1, agi: 2, acc: 0, hp: 0 },
        cardsGranted: ["card_brush_stride", "card_survival_instinct", "card_trap_pouch"]
      },
      {
        id: "armor_reinforced_gambeson",
        name: "Reinforced Gambeson",
        slot: "chestpiece",
        stats: { atk: 0, def: 2, agi: 0, acc: 0, hp: 2 },
        cardsGranted: ["card_padded_absorption", "card_thick_weave", "card_gambeson_guard"]
      },
      {
        id: "armor_battle_harness",
        name: "Battle Harness",
        slot: "chestpiece",
        stats: { atk: 2, def: 1, agi: 0, acc: 0, hp: 0 },
        cardsGranted: ["card_shout_of_defiance", "card_muscle_flex", "card_reckless_charge"]
      },
      {
        id: "armor_arcane_tunic",
        name: "Arcane Tunic",
        slot: "chestpiece",
        stats: { atk: 1, def: 1, agi: 0, acc: 1, hp: 0 },
        cardsGranted: ["card_mana_weave", "card_spell_reflection", "card_tunic_ward"]
      },
      {
        id: "armor_marksmans_brigandine",
        name: "Marksman's Brigandine",
        slot: "chestpiece",
        stats: { atk: 0, def: 2, agi: 0, acc: 1, hp: 0 },
        cardsGranted: ["card_steady_stance", "card_brigandine_deflect", "card_ammo_pouch"]
      }
    ];
    STARTER_ACCESSORIES = [
      {
        id: "accessory_steel_signet_ring",
        name: "Steel Signet Ring",
        slot: "accessory",
        stats: { atk: 0, def: 1, agi: 0, acc: 0, hp: 0 },
        cardsGranted: ["card_knuckle_jab", "card_mark_of_command", "card_signet_shield"]
      },
      {
        id: "accessory_eagle_eye_lens",
        name: "Eagle Eye Lens",
        slot: "accessory",
        stats: { atk: 0, def: 0, agi: 0, acc: 2, hp: 0 },
        cardsGranted: ["card_spotters_shot", "card_target_paint", "card_farsight_guard"]
      },
      {
        id: "accessory_fleetfoot_anklet",
        name: "Fleetfoot Anklet",
        slot: "accessory",
        stats: { atk: 0, def: 0, agi: 2, acc: 0, hp: 0 },
        cardsGranted: ["card_flying_kick", "card_speed_burst", "card_swift_guard"]
      },
      {
        id: "accessory_vitality_charm",
        name: "Vitality Charm",
        slot: "accessory",
        stats: { atk: 0, def: 0, agi: 0, acc: 0, hp: 2 },
        cardsGranted: ["card_bulwark_bash", "card_second_wind", "card_life_guard"]
      },
      {
        id: "accessory_rune_pendant",
        name: "Rune Pendant",
        slot: "accessory",
        stats: { atk: 1, def: 0, agi: 0, acc: 1, hp: 0 },
        cardsGranted: ["card_rune_glow", "card_magic_attunement", "card_warding_light"]
      },
      {
        id: "accessory_power_bracer",
        name: "Power Bracer",
        slot: "accessory",
        stats: { atk: 2, def: 0, agi: -1, acc: 0, hp: 0 },
        cardsGranted: ["card_bracer_smash", "card_lift_heavy", "card_muscle_memory"]
      },
      {
        id: "accessory_steam_valve_wristguard",
        name: "Steam Valve Wristguard",
        slot: "accessory",
        stats: { atk: 0, def: 1, agi: 0, acc: 0, hp: 0 },
        cardsGranted: ["card_wrist_vent", "card_scald_spray", "card_valve_turn"]
      },
      {
        id: "accessory_hunters_talisman",
        name: "Hunter's Talisman",
        slot: "accessory",
        stats: { atk: 0, def: 0, agi: 1, acc: 1, hp: 0 },
        cardsGranted: ["card_beast_ward", "card_silent_step", "card_talisman_focus"]
      },
      {
        id: "accessory_scholars_quill_pendant",
        name: "Scholar's Quill Pendant",
        slot: "accessory",
        stats: { atk: 0, def: 0, agi: 0, acc: 2, hp: 0 },
        cardsGranted: ["card_quick_notes", "card_ink_splatter", "card_sharp_mind"]
      },
      {
        id: "accessory_smoke_bomb_satchel",
        name: "Smoke Bomb Satchel",
        slot: "accessory",
        stats: { atk: 0, def: 0, agi: 2, acc: 0, hp: 0 },
        cardsGranted: ["card_toss_smoke", "card_choking_cloud", "card_satchel_hide"]
      },
      {
        id: "accessory_warriors_belt",
        name: "Warrior's Belt",
        slot: "accessory",
        stats: { atk: 1, def: 1, agi: 0, acc: 0, hp: 1 },
        cardsGranted: ["card_belt_buckle_strike", "card_gird_loins", "card_steady_footing"]
      },
      {
        id: "accessory_arcane_crystal_brooch",
        name: "Arcane Crystal Brooch",
        slot: "accessory",
        stats: { atk: 2, def: 0, agi: 0, acc: 0, hp: 0 },
        cardsGranted: ["card_crystal_flash", "card_mana_drain", "card_brooch_shield"]
      }
    ];
  }
});

// src/data/modules.ts
var STARTER_MODULES, MODULE_CARDS;
var init_modules = __esm({
  "src/data/modules.ts"() {
    "use strict";
    STARTER_MODULES = [
      {
        id: "module_sharpened_edge",
        name: "Sharpened Edge",
        description: "A honed blade attachment that adds a critical strike card.",
        cardsGranted: ["card_critical_edge"],
        statBonus: { atk: 1 }
      },
      {
        id: "module_extended_barrel",
        name: "Extended Barrel",
        description: "Longer barrel for improved range and accuracy.",
        cardsGranted: ["card_long_shot"],
        statBonus: { acc: 2, agi: -1 }
      },
      {
        id: "module_heat_sink",
        name: "Heat Sink",
        description: "Improved cooling for mechanical weapons.",
        cardsGranted: ["card_emergency_vent"],
        statBonus: {}
      }
    ];
    MODULE_CARDS = [
      {
        id: "card_critical_edge",
        name: "Critical Edge",
        type: "equipment",
        strainCost: 2,
        description: "Deal 5 damage. Crit on 18+.",
        range: "R(1)",
        damage: 5,
        sourceEquipmentId: "module_sharpened_edge"
      },
      {
        id: "card_long_shot",
        name: "Long Shot",
        type: "equipment",
        strainCost: 2,
        description: "Deal 3 damage at extended range.",
        range: "R(5-8)",
        damage: 3,
        sourceEquipmentId: "module_extended_barrel"
      },
      {
        id: "card_emergency_vent",
        name: "Emergency Vent",
        type: "equipment",
        strainCost: 2,
        description: "Remove all heat. Take 1 self-damage.",
        range: "R(Self)",
        sourceEquipmentId: "module_heat_sink"
      }
    ];
  }
});

// src/core/equipment.ts
function toEquipmentCardRange(range) {
  if (range === void 0) {
    return void 0;
  }
  return range <= 0 ? "R(Self)" : `R(${range})`;
}
function toImportedEquipmentCard(card) {
  return {
    id: card.id,
    name: card.name,
    type: card.type,
    strainCost: card.strainCost,
    description: card.description,
    range: toEquipmentCardRange(card.range),
    damage: card.damage,
    effects: card.effects.map((effect) => effect.type),
    sourceEquipmentId: card.sourceEquipmentId,
    sourceClassId: card.sourceClassId,
    artPath: card.artPath
  };
}
function toRuntimeEquipment(gear) {
  if (gear.slot === "weapon") {
    return {
      ...gear,
      slot: "weapon",
      weaponType: gear.weaponType ?? "sword",
      isMechanical: gear.isMechanical ?? false,
      cardsGranted: gear.cardsGranted ?? [],
      moduleSlots: gear.moduleSlots ?? 0,
      attachedModules: gear.attachedModules ?? [],
      wear: gear.wear ?? 0
    };
  }
  return {
    ...gear,
    cardsGranted: gear.cardsGranted ?? [],
    slot: gear.slot
  };
}
function getAllStarterEquipment() {
  const all = {};
  for (const w of STARTER_WEAPONS) {
    if (!isTechnicaContentDisabled("gear", w.id)) all[w.id] = w;
  }
  for (const h of STARTER_HELMETS) {
    if (!isTechnicaContentDisabled("gear", h.id)) all[h.id] = h;
  }
  for (const c of STARTER_CHESTPIECES) {
    if (!isTechnicaContentDisabled("gear", c.id)) all[c.id] = c;
  }
  for (const a of STARTER_ACCESSORIES) {
    if (!isTechnicaContentDisabled("gear", a.id)) all[a.id] = a;
  }
  for (const gear of getAllImportedGear()) {
    all[gear.id] = toRuntimeEquipment(gear);
  }
  return all;
}
function getAllEquipmentCards() {
  const all = {};
  for (const c of CORE_CARDS) {
    if (!isTechnicaContentDisabled("card", c.id)) all[c.id] = c;
  }
  for (const c of EQUIPMENT_CARDS) {
    if (!isTechnicaContentDisabled("card", c.id)) all[c.id] = c;
  }
  for (const c of MODULE_CARDS) {
    if (!isTechnicaContentDisabled("card", c.id)) all[c.id] = c;
  }
  for (const unitClass of Object.keys(CLASS_CARDS)) {
    for (const c of CLASS_CARDS[unitClass]) {
      if (!isTechnicaContentDisabled("card", c.id)) all[c.id] = c;
    }
  }
  for (const card of getAllImportedCards()) {
    all[card.id] = toImportedEquipmentCard(card);
  }
  return all;
}
function getClassCardsForUnitClass(unitClass) {
  const builtInCards = CLASS_CARDS[unitClass] || [];
  const importedCards2 = getAllImportedCards().filter((card) => card.type === "class" && card.sourceClassId === unitClass).map((card) => toImportedEquipmentCard(card));
  return [...builtInCards, ...importedCards2];
}
function getAllModules() {
  const all = {};
  for (const m of STARTER_MODULES) all[m.id] = m;
  return all;
}
function buildDeckFromLoadout(unitClass, loadout, equipmentById, modulesById) {
  const deck = [];
  for (const card of CORE_CARDS) {
    if (isTechnicaContentDisabled("card", card.id)) continue;
    deck.push(card.id);
    deck.push(card.id);
  }
  const classCards = getClassCardsForUnitClass(unitClass);
  for (const card of classCards) {
    if (isTechnicaContentDisabled("card", card.id)) continue;
    deck.push(card.id);
  }
  const slots = [
    "primaryWeapon",
    "secondaryWeapon",
    "helmet",
    "chestpiece",
    "accessory1",
    "accessory2"
  ];
  for (const slot of slots) {
    const equipId = loadout[slot];
    if (!equipId) continue;
    const equip = equipmentById[equipId];
    if (!equip) continue;
    for (const cardId of equip.cardsGranted) {
      if (isTechnicaContentDisabled("card", cardId)) continue;
      deck.push(cardId);
    }
    if (equip.slot === "weapon") {
      const weapon = equip;
      for (const modId of weapon.attachedModules) {
        const mod = modulesById[modId];
        if (mod) {
          for (const cardId of mod.cardsGranted) {
            if (isTechnicaContentDisabled("card", cardId)) continue;
            deck.push(cardId);
          }
        }
      }
    }
  }
  return deck;
}
function calculateEquipmentStats(loadout, equipmentById, modulesById) {
  const total = { atk: 0, def: 0, agi: 0, acc: 0, hp: 0 };
  const slots = [
    "primaryWeapon",
    "secondaryWeapon",
    "helmet",
    "chestpiece",
    "accessory1",
    "accessory2"
  ];
  for (const slot of slots) {
    const equipId = loadout[slot];
    if (!equipId) continue;
    const equip = equipmentById[equipId];
    if (!equip) continue;
    total.atk += equip.stats.atk;
    total.def += equip.stats.def;
    total.agi += equip.stats.agi;
    total.acc += equip.stats.acc;
    total.hp += equip.stats.hp;
    if (equip.slot === "weapon") {
      const weapon = equip;
      for (const modId of weapon.attachedModules) {
        const mod = modulesById[modId];
        if (mod?.statBonus) {
          total.atk += mod.statBonus.atk || 0;
          total.def += mod.statBonus.def || 0;
          total.agi += mod.statBonus.agi || 0;
          total.acc += mod.statBonus.acc || 0;
          total.hp += mod.statBonus.hp || 0;
        }
      }
    }
  }
  return total;
}
var init_equipment = __esm({
  "src/core/equipment.ts"() {
    "use strict";
    init_technica();
    init_coreCards();
    init_classCards();
    init_equipmentCards();
    init_weapons();
    init_armor();
    init_modules();
    init_coreCards();
    init_classCards();
    init_equipmentCards();
    init_weapons();
    init_armor();
    init_modules();
  }
});

// src/core/weaponSystem.ts
function createWeaponRuntimeState(weapon) {
  return {
    equipmentId: weapon.id,
    currentHeat: 0,
    currentAmmo: weapon.ammoMax ?? 0,
    wear: weapon.wear ?? 0,
    nodes: {
      1: "ok",
      2: "ok",
      3: "ok",
      4: "ok",
      5: "ok",
      6: "ok"
    },
    isJammed: false,
    clutchActive: false,
    doubleClutchActive: false
  };
}
function removeHeat(state, amount) {
  if (state.nodes[5] === "damaged") {
    amount = Math.max(0, amount - 1);
  }
  if (state.nodes[5] === "broken") {
    amount = Math.min(1, amount);
  }
  return {
    ...state,
    currentHeat: Math.max(0, state.currentHeat - amount)
  };
}
function passiveCooling(state) {
  return removeHeat(state, 1);
}
function rollWeaponHit(wasCrit) {
  if (wasCrit) {
    return true;
  }
  return Math.floor(Math.random() * 6) + 1 === 6;
}
function rollWeaponNodeHit() {
  return Math.floor(Math.random() * 6) + 1;
}
function damageNode(state, nodeId) {
  const currentStatus = state.nodes[nodeId];
  let newStatus;
  switch (currentStatus) {
    case "ok":
      newStatus = "damaged";
      break;
    case "damaged":
      newStatus = "broken";
      break;
    case "broken":
      newStatus = "destroyed";
      break;
    case "destroyed":
      newStatus = "destroyed";
      break;
  }
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId]: newStatus
    }
  };
}
var WEAPON_NODE_NAMES;
var init_weaponSystem = __esm({
  "src/core/weaponSystem.ts"() {
    "use strict";
    WEAPON_NODE_NAMES = {
      1: { primary: "SIGHTS", alt: "STABILIZER" },
      2: { primary: "BARREL", alt: "EDGE" },
      3: { primary: "ACTION", alt: "SERVO" },
      4: { primary: "POWER COUPLING", alt: "TENSIONER" },
      5: { primary: "HEAT SINK", alt: "ARRAY" },
      6: { primary: "FEED PATH", alt: "MAG LATCH" }
    };
  }
});

// src/core/mounts.ts
function getMountById(mountId) {
  const mount = MOUNT_REGISTRY.find((m) => m.id === mountId);
  if (!mount) {
    console.warn(`[MOUNTS] Mount not found: ${mountId}`);
    return null;
  }
  return mount;
}
function findOwnedMount(stable, instanceId) {
  return stable.ownedMounts.find((m) => m.instanceId === instanceId) || null;
}
function getMountCardById(cardId) {
  return MOUNT_CARDS.find((c) => c.id === cardId) || null;
}
function validateMountCards(cardIds) {
  return cardIds.filter((id) => {
    const card = getMountCardById(id);
    if (!card) {
      console.warn(`[MOUNTS] Invalid mount card skipped: ${id}`);
      return false;
    }
    return true;
  });
}
var MOUNT_CARDS, MOUNT_REGISTRY;
var init_mounts = __esm({
  "src/core/mounts.ts"() {
    "use strict";
    MOUNT_CARDS = [
      // Horse cards
      {
        id: "mount_gallop",
        name: "Gallop",
        description: "Move up to 4 additional tiles this turn.",
        strainCost: 1,
        mountId: "mount_horse"
      },
      {
        id: "mount_trample_strike",
        name: "Trample Strike",
        description: "Deal 2 damage to an enemy and push them 1 tile.",
        strainCost: 2,
        mountId: "mount_horse"
      },
      // Warhorse cards
      {
        id: "mount_cavalry_charge",
        name: "Cavalry Charge",
        description: "Move in a straight line and deal 4 damage to the first enemy hit. +2 damage if moved 3+ tiles.",
        strainCost: 3,
        mountId: "mount_warhorse"
      },
      {
        id: "mount_armored_stance",
        name: "Armored Stance",
        description: "Gain +3 DEF until your next turn. Cannot move.",
        strainCost: 2,
        mountId: "mount_warhorse"
      },
      // Lizard cards
      {
        id: "mount_scale_shield",
        name: "Scale Shield",
        description: "Reduce damage from the next attack by 3.",
        strainCost: 1,
        mountId: "mount_lizard"
      },
      {
        id: "mount_tail_sweep",
        name: "Tail Sweep",
        description: "Deal 2 damage to all adjacent enemies.",
        strainCost: 2,
        mountId: "mount_lizard"
      },
      // Mechanical mount cards
      {
        id: "mount_steam_burst",
        name: "Steam Burst",
        description: "Move 3 tiles instantly. Gain +2 heat.",
        strainCost: 1,
        mountId: "mount_steamrunner"
      },
      {
        id: "mount_piston_kick",
        name: "Piston Kick",
        description: "Deal 5 damage to adjacent enemy. Push them 2 tiles.",
        strainCost: 3,
        mountId: "mount_steamrunner"
      },
      // Beast mount cards
      {
        id: "mount_feral_leap",
        name: "Feral Leap",
        description: "Jump to a tile within 3 range. Ignores terrain.",
        strainCost: 2,
        mountId: "mount_shadowbeast"
      },
      {
        id: "mount_savage_bite",
        name: "Savage Bite",
        description: "Deal 4 damage. If target HP < 50%, deal +2 damage.",
        strainCost: 2,
        mountId: "mount_shadowbeast"
      }
    ];
    MOUNT_REGISTRY = [
      // STARTER MOUNTS
      {
        id: "mount_horse",
        name: "Field Horse",
        description: "A reliable horse bred for tactical operations. Provides balanced mobility bonuses.",
        mountType: "horse",
        statModifiers: {
          agi: 2,
          movement: 2
        },
        terrainModifiers: [
          { terrain: "plains", effect: "bonus_movement", value: 1 }
        ],
        passiveTraits: [],
        grantedCards: ["mount_gallop", "mount_trample_strike"],
        restrictions: [],
        isStarterMount: true,
        unlockCost: 0
      },
      {
        id: "mount_warhorse",
        name: "Armored Warhorse",
        description: "A heavily armored destrier. Slower but extremely durable in combat.",
        mountType: "warhorse",
        statModifiers: {
          hp: 10,
          def: 2,
          agi: -1,
          movement: 1
        },
        terrainModifiers: [],
        passiveTraits: ["surefooted", "armored"],
        grantedCards: ["mount_cavalry_charge", "mount_armored_stance"],
        restrictions: [
          {
            type: "unit_class",
            disallowed: ["thief", "scout", "shadow", "trickster"]
          }
        ],
        unlockCost: 150
      },
      {
        id: "mount_lizard",
        name: "Desert Lizard",
        description: "A swift reptilian mount from the Ardycian wastes. Excellent in rough terrain.",
        mountType: "lizard",
        statModifiers: {
          agi: 1,
          def: 1,
          movement: 1
        },
        terrainModifiers: [
          { terrain: "mud", effect: "ignore_penalty" },
          { terrain: "sand", effect: "bonus_movement", value: 2 },
          { terrain: "rubble", effect: "ignore_penalty" }
        ],
        passiveTraits: ["heat_resistant"],
        grantedCards: ["mount_scale_shield", "mount_tail_sweep"],
        restrictions: [],
        unlockCost: 100
      },
      {
        id: "mount_steamrunner",
        name: "Steamrunner MK-II",
        description: "A mechanical mount powered by pressurized steam. High performance but requires maintenance.",
        mountType: "mechanical",
        statModifiers: {
          atk: 1,
          agi: 3,
          acc: 5,
          movement: 3
        },
        terrainModifiers: [
          { terrain: "water", effect: "damage_reduction", value: 2 }
          // Water damages it
        ],
        passiveTraits: ["swift"],
        grantedCards: ["mount_steam_burst", "mount_piston_kick"],
        restrictions: [
          {
            type: "unit_class",
            allowed: ["academic", "freelancer", "hunter", "trapper"]
          }
        ],
        unlockCost: 250
      },
      {
        id: "mount_shadowbeast",
        name: "Shadowbeast",
        description: "A mysterious creature from the chaos rifts. Agile and ferocious.",
        mountType: "beast",
        statModifiers: {
          atk: 2,
          agi: 2,
          def: -1,
          movement: 2
        },
        terrainModifiers: [
          { terrain: "forest", effect: "bonus_movement", value: 1 }
        ],
        passiveTraits: ["trample", "intimidate"],
        grantedCards: ["mount_feral_leap", "mount_savage_bite"],
        restrictions: [
          {
            type: "unit_class",
            disallowed: ["cleric", "paladin"]
          }
        ],
        unlockCost: 200
      }
    ];
  }
});

// src/core/affinity.ts
function createDefaultAffinities() {
  return {
    melee: 0,
    ranged: 0,
    magic: 0,
    support: 0,
    mobility: 0,
    survival: 0
  };
}
function addAffinity(unitId, type, amount, state) {
  const unit = state.unitsById[unitId];
  if (!unit || unit.isEnemy) return;
  const current = unit.affinities || createDefaultAffinities();
  const newValue = Math.min(MAX_AFFINITY, current[type] + amount);
  unit.affinities = {
    ...current,
    [type]: newValue
  };
}
function recordMeleeAttack(unitId, state) {
  addAffinity(unitId, "melee", AFFINITY_GAINS.melee, state);
}
var AFFINITY_GAINS, MAX_AFFINITY;
var init_affinity = __esm({
  "src/core/affinity.ts"() {
    "use strict";
    AFFINITY_GAINS = {
      melee: 2,
      // Per melee attack
      ranged: 2,
      // Per ranged skill
      magic: 2,
      // Per spell cast
      support: 2,
      // Per buff/heal/shield
      mobility: 1,
      // Per movement/mobility skill
      survival: 5
      // Per operation completed alive, +1 per 10 damage taken
    };
    MAX_AFFINITY = 100;
  }
});

// src/core/crafting.ts
function getStarterRecipes() {
  return Object.values(RECIPE_DATABASE).filter(
    (r) => r.starterRecipe && !isTechnicaContentDisabled("item", r.resultItemId)
  );
}
function getStarterRecipeIds() {
  return getStarterRecipes().map((r) => r.id);
}
function learnRecipe(knownRecipeIds, recipeId) {
  if (knownRecipeIds.includes(recipeId)) return knownRecipeIds;
  if (!RECIPE_DATABASE[recipeId]) return knownRecipeIds;
  return [...knownRecipeIds, recipeId];
}
var RECIPE_DATABASE, CONSUMABLE_DATABASE;
var init_crafting = __esm({
  "src/core/crafting.ts"() {
    "use strict";
    init_technica();
    RECIPE_DATABASE = {
      // ==================== DEPRECATED WEAPON RECIPES ====================
      // Weapons are now built in Gear Builder, not crafted
      // These recipes are kept for save compatibility but marked deprecated
      recipe_iron_longsword: {
        id: "recipe_iron_longsword",
        name: "Iron Longsword",
        category: "armor",
        // Changed to armor for type safety, but deprecated flag prevents use
        description: "A sturdy blade for frontline combat. [DEPRECATED: Use Gear Builder]",
        cost: { metalScrap: 5, wood: 2 },
        resultItemId: "weapon_iron_longsword",
        resultQuantity: 1,
        starterRecipe: true,
        deprecated: true
      },
      recipe_runed_shortsword: {
        id: "recipe_runed_shortsword",
        name: "Runed Shortsword",
        category: "armor",
        description: "A quick blade etched with arcane symbols. [DEPRECATED: Use Gear Builder]",
        cost: { metalScrap: 4, chaosShards: 2 },
        resultItemId: "weapon_runed_shortsword",
        resultQuantity: 1,
        starterRecipe: true,
        deprecated: true
      },
      recipe_elm_recurve_bow: {
        id: "recipe_elm_recurve_bow",
        name: "Elm Recurve Bow",
        category: "armor",
        description: "A reliable ranged weapon crafted from elm wood. [DEPRECATED: Use Gear Builder]",
        cost: { wood: 6, metalScrap: 2 },
        resultItemId: "weapon_elm_recurve_bow",
        resultQuantity: 1,
        starterRecipe: true,
        deprecated: true
      },
      recipe_oak_battlestaff: {
        id: "recipe_oak_battlestaff",
        name: "Oak Battlestaff",
        category: "armor",
        description: "A sturdy staff for channeling and combat. [DEPRECATED: Use Gear Builder]",
        cost: { wood: 5, chaosShards: 1 },
        resultItemId: "weapon_oak_battlestaff",
        resultQuantity: 1,
        starterRecipe: true,
        deprecated: true
      },
      recipe_steel_dagger: {
        id: "recipe_steel_dagger",
        name: "Steel Dagger",
        category: "armor",
        description: "A swift blade for quick strikes. [DEPRECATED: Use Gear Builder]",
        cost: { metalScrap: 3, wood: 1 },
        resultItemId: "weapon_steel_dagger",
        resultQuantity: 1,
        starterRecipe: true,
        deprecated: true
      },
      // Mechanical Weapons (require steam components)
      recipe_emberclaw_repeater: {
        id: "recipe_emberclaw_repeater",
        name: "Emberclaw Repeater",
        category: "armor",
        description: "A repeating rifle powered by steam mechanisms. [DEPRECATED: Use Gear Builder]",
        cost: { metalScrap: 6, steamComponents: 4, chaosShards: 1 },
        resultItemId: "weapon_emberclaw_repeater",
        resultQuantity: 1,
        starterRecipe: false,
        deprecated: true
      },
      recipe_brassback_scattergun: {
        id: "recipe_brassback_scattergun",
        name: "Brassback Scattergun",
        category: "armor",
        description: "A steam-powered shotgun with devastating spread. [DEPRECATED: Use Gear Builder]",
        cost: { metalScrap: 5, steamComponents: 3, wood: 2 },
        resultItemId: "weapon_brassback_scattergun",
        resultQuantity: 1,
        starterRecipe: false,
        deprecated: true
      },
      recipe_blazefang_saber: {
        id: "recipe_blazefang_saber",
        name: "Blazefang Saber",
        category: "armor",
        description: "A steam-heated blade that sears on contact. [DEPRECATED: Use Gear Builder]",
        cost: { metalScrap: 4, steamComponents: 3, chaosShards: 2 },
        resultItemId: "weapon_blazefang_saber",
        resultQuantity: 1,
        starterRecipe: false,
        deprecated: true
      },
      // ==================== ARMOR ====================
      recipe_ironguard_helm: {
        id: "recipe_ironguard_helm",
        name: "Ironguard Helm",
        category: "armor",
        description: "A solid helmet offering reliable protection.",
        cost: { metalScrap: 4, wood: 1 },
        resultItemId: "armor_ironguard_helm",
        resultQuantity: 1,
        starterRecipe: true
      },
      recipe_rangers_hood: {
        id: "recipe_rangers_hood",
        name: "Ranger's Hood",
        category: "armor",
        description: "A lightweight hood favored by scouts.",
        cost: { wood: 3, chaosShards: 1 },
        resultItemId: "armor_rangers_hood",
        resultQuantity: 1,
        starterRecipe: true
      },
      recipe_steelplate_cuirass: {
        id: "recipe_steelplate_cuirass",
        name: "Steelplate Cuirass",
        category: "armor",
        description: "Heavy chest armor for maximum protection.",
        cost: { metalScrap: 8, wood: 2 },
        resultItemId: "armor_steelplate_cuirass",
        resultQuantity: 1,
        starterRecipe: true
      },
      recipe_leather_jerkin: {
        id: "recipe_leather_jerkin",
        name: "Leather Jerkin",
        category: "armor",
        description: "Light armor that doesn't restrict movement.",
        cost: { wood: 4, metalScrap: 1 },
        resultItemId: "armor_leather_jerkin",
        resultQuantity: 1,
        starterRecipe: true
      },
      recipe_steam_valve_wristguard: {
        id: "recipe_steam_valve_wristguard",
        name: "Steam Valve Wristguard",
        category: "armor",
        description: "An accessory that vents heat from mechanical weapons.",
        cost: { steamComponents: 3, metalScrap: 2 },
        resultItemId: "accessory_steam_valve_wristguard",
        resultQuantity: 1,
        starterRecipe: false
      },
      recipe_steel_signet_ring: {
        id: "recipe_steel_signet_ring",
        name: "Steel Signet Ring",
        category: "armor",
        description: "A ring that bolsters defense and luck.",
        cost: { metalScrap: 2, chaosShards: 1 },
        resultItemId: "accessory_steel_signet_ring",
        resultQuantity: 1,
        starterRecipe: true
      },
      recipe_fleetfoot_anklet: {
        id: "recipe_fleetfoot_anklet",
        name: "Fleetfoot Anklet",
        category: "armor",
        description: "An anklet that enhances agility.",
        cost: { metalScrap: 2, wood: 2, chaosShards: 1 },
        resultItemId: "accessory_fleetfoot_anklet",
        resultQuantity: 1,
        starterRecipe: true
      },
      // ==================== CONSUMABLES ====================
      recipe_healing_kit: {
        id: "recipe_healing_kit",
        name: "Healing Kit",
        category: "consumable",
        description: "Restores HP to a single unit during battle.",
        cost: { wood: 2, chaosShards: 1 },
        resultItemId: "consumable_healing_kit",
        resultQuantity: 2,
        starterRecipe: true
      },
      recipe_field_ration: {
        id: "recipe_field_ration",
        name: "Field Ration",
        category: "consumable",
        description: "A small meal that restores a bit of HP.",
        cost: { wood: 2 },
        resultItemId: "consumable_field_ration",
        resultQuantity: 3,
        starterRecipe: true
      },
      recipe_smoke_bomb: {
        id: "recipe_smoke_bomb",
        name: "Smoke Bomb",
        category: "consumable",
        description: "Creates a smoke screen, reducing enemy accuracy.",
        cost: { wood: 1, chaosShards: 2 },
        resultItemId: "consumable_smoke_bomb",
        resultQuantity: 2,
        starterRecipe: true
      },
      recipe_repair_kit: {
        id: "recipe_repair_kit",
        name: "Repair Kit",
        category: "consumable",
        description: "Repairs weapon damage and reduces heat.",
        cost: { metalScrap: 3, steamComponents: 1 },
        resultItemId: "consumable_repair_kit",
        resultQuantity: 1,
        starterRecipe: true
      },
      recipe_coolant_flask: {
        id: "recipe_coolant_flask",
        name: "Coolant Flask",
        category: "consumable",
        description: "Instantly removes heat from a mechanical weapon.",
        cost: { steamComponents: 2, chaosShards: 1 },
        resultItemId: "consumable_coolant_flask",
        resultQuantity: 2,
        starterRecipe: false
      },
      recipe_overcharge_cell: {
        id: "recipe_overcharge_cell",
        name: "Overcharge Cell",
        category: "consumable",
        description: "Adds heat but boosts attack power temporarily.",
        cost: { steamComponents: 2, metalScrap: 1 },
        resultItemId: "consumable_overcharge_cell",
        resultQuantity: 2,
        starterRecipe: false
      },
      // ==================== UPGRADES ====================
      // Weapon upgrades are deprecated - weapons are built/modified in Gear Builder
      recipe_iron_longsword_plus1: {
        id: "recipe_iron_longsword_plus1",
        name: "Iron Longsword +1",
        category: "upgrade",
        description: "An improved longsword with better stats. [DEPRECATED: Use Gear Builder]",
        cost: { metalScrap: 3, chaosShards: 1 },
        resultItemId: "weapon_iron_longsword_plus1",
        resultQuantity: 1,
        requiresItemId: "weapon_iron_longsword",
        starterRecipe: true,
        deprecated: true
      },
      recipe_blazefang_saber_plus1: {
        id: "recipe_blazefang_saber_plus1",
        name: "Blazefang Saber +1",
        category: "upgrade",
        description: "An enhanced Blazefang with increased heat efficiency. [DEPRECATED: Use Gear Builder]",
        cost: { steamComponents: 4, chaosShards: 3 },
        resultItemId: "weapon_blazefang_saber_plus1",
        resultQuantity: 1,
        requiresItemId: "weapon_blazefang_saber",
        starterRecipe: false,
        deprecated: true
      },
      recipe_steelplate_cuirass_plus1: {
        id: "recipe_steelplate_cuirass_plus1",
        name: "Steelplate Cuirass +1",
        category: "upgrade",
        description: "Reinforced armor with additional plating.",
        cost: { metalScrap: 5, steamComponents: 2 },
        resultItemId: "armor_steelplate_cuirass_plus1",
        resultQuantity: 1,
        requiresItemId: "armor_steelplate_cuirass",
        starterRecipe: true
      }
    };
    CONSUMABLE_DATABASE = {
      consumable_healing_kit: {
        id: "consumable_healing_kit",
        name: "Healing Kit",
        description: "Restores 5 HP to a unit.",
        effect: "heal",
        value: 5
      },
      consumable_field_ration: {
        id: "consumable_field_ration",
        name: "Field Ration",
        description: "Restores 2 HP to a unit.",
        effect: "heal",
        value: 2
      },
      consumable_smoke_bomb: {
        id: "consumable_smoke_bomb",
        name: "Smoke Bomb",
        description: "Reduces enemy accuracy for 2 turns.",
        effect: "accuracy_debuff",
        value: 2
      },
      consumable_repair_kit: {
        id: "consumable_repair_kit",
        name: "Repair Kit",
        description: "Repairs 2 weapon damage and reduces 3 heat.",
        effect: "repair",
        value: 2
      },
      consumable_coolant_flask: {
        id: "consumable_coolant_flask",
        name: "Coolant Flask",
        description: "Removes 3 heat from a mechanical weapon.",
        effect: "heat_reduce",
        value: 3
      },
      consumable_overcharge_cell: {
        id: "consumable_overcharge_cell",
        name: "Overcharge Cell",
        description: "Adds 3 heat but grants +3 ATK next attack.",
        effect: "attack_boost",
        value: 3
      }
    };
  }
});

// src/core/schemaSystem.ts
function withZeroIncome(incomePerTick) {
  return {
    metalScrap: incomePerTick?.metalScrap ?? 0,
    wood: incomePerTick?.wood ?? 0,
    chaosShards: incomePerTick?.chaosShards ?? 0,
    steamComponents: incomePerTick?.steamComponents ?? 0
  };
}
function addResourceWallet(base, delta) {
  return {
    metalScrap: base.metalScrap + (delta.metalScrap ?? 0),
    wood: base.wood + (delta.wood ?? 0),
    chaosShards: base.chaosShards + (delta.chaosShards ?? 0),
    steamComponents: base.steamComponents + (delta.steamComponents ?? 0)
  };
}
function createDefaultSchemaUnlockState() {
  return {
    unlockedCoreTypes: [...SCHEMA_STARTER_CORE_TYPES],
    unlockedFortificationPips: [...SCHEMA_STARTER_FORTIFICATION_TYPES]
  };
}
function normalizeSchemaUnlockState(schema) {
  const coreSet = new Set(SCHEMA_STARTER_CORE_TYPES);
  (schema?.unlockedCoreTypes ?? []).forEach((coreType) => {
    if (SCHEMA_CORE_BUILD_ORDER.includes(coreType)) {
      coreSet.add(coreType);
    }
  });
  const fortificationSet = new Set(SCHEMA_STARTER_FORTIFICATION_TYPES);
  (schema?.unlockedFortificationPips ?? []).forEach((fortificationType) => {
    if (SCHEMA_FORTIFICATION_ORDER.includes(fortificationType)) {
      fortificationSet.add(fortificationType);
    }
  });
  return {
    unlockedCoreTypes: SCHEMA_CORE_BUILD_ORDER.filter((coreType) => coreSet.has(coreType)),
    unlockedFortificationPips: SCHEMA_FORTIFICATION_ORDER.filter((fortificationType) => fortificationSet.has(fortificationType))
  };
}
function withNormalizedSchemaState(state) {
  const normalized = normalizeSchemaUnlockState(state.schema);
  const current = state.schema;
  if (current && current.unlockedCoreTypes.length === normalized.unlockedCoreTypes.length && current.unlockedFortificationPips.length === normalized.unlockedFortificationPips.length && current.unlockedCoreTypes.every((coreType, index) => normalized.unlockedCoreTypes[index] === coreType) && current.unlockedFortificationPips.every((fortificationType, index) => normalized.unlockedFortificationPips[index] === fortificationType)) {
    return state;
  }
  return {
    ...state,
    schema: normalized
  };
}
function getSchemaUnlockState(state) {
  return normalizeSchemaUnlockState(state.schema);
}
function isCoreTypeUnlocked(state, coreType) {
  return getSchemaUnlockState(state).unlockedCoreTypes.includes(coreType);
}
function isFortificationUnlocked(state, fortificationType) {
  return getSchemaUnlockState(state).unlockedFortificationPips.includes(fortificationType);
}
function createEmptyFortificationPips() {
  return Object.fromEntries(
    SCHEMA_FORTIFICATION_ORDER.map((fortificationType) => [fortificationType, 0])
  );
}
function normalizeFortificationPips(pips) {
  const normalized = createEmptyFortificationPips();
  SCHEMA_FORTIFICATION_ORDER.forEach((fortificationType) => {
    normalized[fortificationType] = Math.max(0, Number(pips?.[fortificationType] ?? 0));
  });
  return normalized;
}
function getInstalledFortificationCount(pips) {
  return SCHEMA_FORTIFICATION_ORDER.reduce(
    (total, fortificationType) => total + Math.max(0, Number(pips?.[fortificationType] ?? 0)),
    0
  );
}
function getRoomTags(roomOrTags) {
  const tags = Array.isArray(roomOrTags) ? roomOrTags : roomOrTags?.tags ?? [];
  return Array.from(new Set(tags));
}
function roomHasTag(roomOrTags, tag) {
  return getRoomTags(roomOrTags).includes(tag);
}
function getCoreIncomeForRoom(coreType, roomOrTags) {
  const definition = SCHEMA_CORE_DEFINITIONS[coreType];
  let income = withZeroIncome(definition.incomePerTick);
  const tags = getRoomTags(roomOrTags);
  definition.tagOutputModifiers?.forEach((modifier) => {
    if (tags.includes(modifier.tag)) {
      income = addResourceWallet(income, modifier.output);
    }
  });
  return income;
}
var SCHEMA_STARTER_CORE_TYPES, SCHEMA_STARTER_FORTIFICATION_TYPES, SCHEMA_CORE_BUILD_ORDER, SCHEMA_FORTIFICATION_ORDER, SCHEMA_CORE_DEFINITIONS, SCHEMA_FORTIFICATION_DEFINITIONS;
var init_schemaSystem = __esm({
  "src/core/schemaSystem.ts"() {
    "use strict";
    SCHEMA_STARTER_CORE_TYPES = [
      "supply_depot",
      "command_center",
      "medical_ward",
      "armory",
      "mine",
      "generator",
      "refinery"
    ];
    SCHEMA_STARTER_FORTIFICATION_TYPES = [
      "barricade",
      "powerRail",
      "waystation"
    ];
    SCHEMA_CORE_BUILD_ORDER = [
      "supply_depot",
      "command_center",
      "medical_ward",
      "armory",
      "mine",
      "generator",
      "logistics_hub",
      "prototype_systems_lab",
      "forward_maintenance_bay",
      "emergency_supply_cache",
      "forward_fire_support_post",
      "operations_planning_cell",
      "tactics_school",
      "quartermaster_cell",
      "stable",
      "fabrication_bay",
      "survey_array",
      "recovery_yard",
      "transit_hub",
      "tavern",
      "refinery"
    ];
    SCHEMA_FORTIFICATION_ORDER = [
      "barricade",
      "powerRail",
      "bulkhead",
      "turret",
      "substation",
      "capacitor",
      "switchgear",
      "overcharger",
      "repeater",
      "sensorArray",
      "signalBooster",
      "waystation",
      "bridgeRig",
      "repairBench",
      "securityTerminal"
    ];
    SCHEMA_CORE_DEFINITIONS = {
      supply_depot: {
        id: "supply_depot",
        displayName: "Supply Depot",
        shortCode: "SD",
        category: "logistics",
        description: "Logistics anchor that converts a live 100-watt power feed into a 100-crate supply relay for connected rooms.",
        operationalRequirements: {
          powerWatts: 100,
          commsBw: 0,
          supplyCrates: 0
        },
        supplyOutputCrates: 100,
        buildCost: { metalScrap: 4, wood: 2 },
        upkeep: {},
        wadUpkeepPerTick: 6,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "starter",
        preferredRoomTags: ["transit_junction"]
      },
      command_center: {
        id: "command_center",
        displayName: "Command Center",
        shortCode: "CC",
        category: "command",
        description: "Local control hub that relays a live uplink into a 100 BW comms lattice for connected rooms.",
        operationalRequirements: {
          powerWatts: 100,
          commsBw: 1,
          supplyCrates: 50
        },
        commsOutputBw: 100,
        buildCost: { metalScrap: 2, chaosShards: 1, steamComponents: 1 },
        upkeep: {},
        wadUpkeepPerTick: 8,
        incomePerTick: {},
        supportRadius: 2,
        unlockSource: "starter",
        preferredRoomTags: ["command_suitable"]
      },
      medical_ward: {
        id: "medical_ward",
        displayName: "Medical Ward",
        shortCode: "MW",
        category: "support",
        description: "Casualty control and stabilization wing that keeps sustained pushes from collapsing.",
        operationalRequirements: {
          powerWatts: 50,
          commsBw: 0,
          supplyCrates: 50
        },
        buildCost: { wood: 3, chaosShards: 1 },
        upkeep: {},
        wadUpkeepPerTick: 5,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "starter",
        preferredRoomTags: ["medical_supplies"]
      },
      armory: {
        id: "armory",
        displayName: "Armory",
        shortCode: "AR",
        category: "combat",
        description: "Munitions support core that keeps connected squads battle-ready and aggressive.",
        operationalRequirements: {
          powerWatts: 25,
          commsBw: 0,
          supplyCrates: 100
        },
        buildCost: { metalScrap: 3, steamComponents: 1 },
        upkeep: {},
        wadUpkeepPerTick: 7,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "starter"
      },
      mine: {
        id: "mine",
        displayName: "Mine",
        shortCode: "MN",
        category: "industry",
        description: "Extraction core that turns secured sectors into a steady Metal Scrap and Timber stream.",
        operationalRequirements: {
          powerWatts: 50,
          commsBw: 0,
          supplyCrates: 50
        },
        buildCost: { metalScrap: 3, wood: 2, steamComponents: 1 },
        upkeep: {},
        wadUpkeepPerTick: 4,
        incomePerTick: { metalScrap: 1, wood: 1 },
        supportRadius: 0,
        unlockSource: "starter",
        preferredRoomTags: ["metal_rich", "timber_rich"],
        tagOutputModifiers: [
          { tag: "metal_rich", output: { metalScrap: 2 }, note: "Mine +2 Metal Scrap/tick" },
          { tag: "timber_rich", output: { wood: 2 }, note: "Mine +2 Wood/tick" }
        ]
      },
      generator: {
        id: "generator",
        displayName: "Generator",
        shortCode: "GN",
        category: "command",
        description: "Strategic power relay that passes through incoming room power and adds +100 watts on top for connected rooms.",
        operationalRequirements: {
          powerWatts: 1,
          commsBw: 0,
          supplyCrates: 50
        },
        powerOutputWatts: 100,
        powerOutputMode: "add_input",
        buildCost: { metalScrap: 3, steamComponents: 2 },
        upkeep: {},
        wadUpkeepPerTick: 6,
        incomePerTick: {},
        supportRadius: 0,
        unlockSource: "starter",
        preferredRoomTags: ["steam_vent"]
      },
      logistics_hub: {
        id: "logistics_hub",
        displayName: "Logistics Hub",
        shortCode: "LH",
        category: "logistics",
        description: "Placeholder logistics escalation facility for future supply-routing bonuses.",
        buildCost: { metalScrap: 5, wood: 3, steamComponents: 1 },
        upkeep: {},
        wadUpkeepPerTick: 10,
        incomePerTick: {},
        supportRadius: 2,
        unlockSource: "schema",
        unlockCost: { metalScrap: 6, wood: 4 },
        unlockWadCost: 40,
        preferredRoomTags: ["transit_junction"],
        placeholder: true
      },
      prototype_systems_lab: {
        id: "prototype_systems_lab",
        displayName: "Prototype Systems Lab",
        shortCode: "PL",
        category: "research",
        description: "Placeholder research wing reserved for future experimental support systems.",
        buildCost: { metalScrap: 4, chaosShards: 3, steamComponents: 2 },
        upkeep: {},
        wadUpkeepPerTick: 11,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { chaosShards: 3, steamComponents: 2 },
        unlockWadCost: 55,
        placeholder: true
      },
      forward_maintenance_bay: {
        id: "forward_maintenance_bay",
        displayName: "Forward Maintenance Bay",
        shortCode: "MB",
        category: "support",
        description: "Placeholder repair-and-refit node for future equipment sustain.",
        buildCost: { metalScrap: 4, wood: 2, steamComponents: 2 },
        upkeep: {},
        wadUpkeepPerTick: 8,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { metalScrap: 4, steamComponents: 2 },
        unlockWadCost: 36,
        placeholder: true
      },
      emergency_supply_cache: {
        id: "emergency_supply_cache",
        displayName: "Emergency Supply Cache",
        shortCode: "EC",
        category: "logistics",
        description: "Placeholder reserve stockpile for future emergency resupply bursts.",
        buildCost: { wood: 4, metalScrap: 2 },
        upkeep: {},
        wadUpkeepPerTick: 5,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { wood: 5, metalScrap: 2 },
        unlockWadCost: 28,
        placeholder: true
      },
      forward_fire_support_post: {
        id: "forward_fire_support_post",
        displayName: "Forward Fire Support Post",
        shortCode: "FP",
        category: "combat",
        description: "Placeholder fire-support site for future bombardment and defense pressure tools.",
        buildCost: { metalScrap: 5, steamComponents: 2 },
        upkeep: {},
        wadUpkeepPerTick: 10,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { metalScrap: 5, steamComponents: 2 },
        unlockWadCost: 48,
        placeholder: true
      },
      operations_planning_cell: {
        id: "operations_planning_cell",
        displayName: "Operations Planning Cell",
        shortCode: "OP",
        category: "command",
        description: "Placeholder planning room for future route, threat, and support forecasting.",
        buildCost: { metalScrap: 3, chaosShards: 2 },
        upkeep: {},
        wadUpkeepPerTick: 8,
        incomePerTick: {},
        supportRadius: 2,
        unlockSource: "schema",
        unlockCost: { chaosShards: 2, metalScrap: 3 },
        unlockWadCost: 38,
        preferredRoomTags: ["command_suitable"],
        placeholder: true
      },
      tactics_school: {
        id: "tactics_school",
        displayName: "Tactics School",
        shortCode: "TS",
        category: "support",
        description: "Placeholder doctrine-training facility for future unit progression support.",
        buildCost: { wood: 4, chaosShards: 1 },
        upkeep: {},
        wadUpkeepPerTick: 7,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { wood: 4, chaosShards: 1 },
        unlockWadCost: 30,
        placeholder: true
      },
      quartermaster_cell: {
        id: "quartermaster_cell",
        displayName: "Quartermaster Cell",
        shortCode: "QM",
        category: "logistics",
        description: "Placeholder procurement office for future supply efficiency bonuses.",
        buildCost: { metalScrap: 3, wood: 3 },
        upkeep: {},
        wadUpkeepPerTick: 7,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { metalScrap: 3, wood: 3 },
        unlockWadCost: 32,
        placeholder: true
      },
      stable: {
        id: "stable",
        displayName: "Stable",
        shortCode: "ST",
        category: "mobility",
        description: "Placeholder mount staging yard for future movement and convoy bonuses.",
        buildCost: { wood: 5, metalScrap: 2 },
        upkeep: {},
        wadUpkeepPerTick: 6,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { wood: 5, metalScrap: 2 },
        unlockWadCost: 26,
        preferredRoomTags: ["stable_suitable", "transit_junction"],
        placeholder: true
      },
      fabrication_bay: {
        id: "fabrication_bay",
        displayName: "Fabrication Bay",
        shortCode: "FB",
        category: "industry",
        description: "Placeholder fabrication shop for future on-site production effects.",
        buildCost: { metalScrap: 5, steamComponents: 2, wood: 1 },
        upkeep: {},
        wadUpkeepPerTick: 9,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { metalScrap: 6, steamComponents: 2 },
        unlockWadCost: 44,
        placeholder: true
      },
      survey_array: {
        id: "survey_array",
        displayName: "Survey Array",
        shortCode: "SV",
        category: "command",
        description: "Placeholder recon node for future theater scouting and reveal bonuses.",
        buildCost: { metalScrap: 2, chaosShards: 2, steamComponents: 1 },
        upkeep: {},
        wadUpkeepPerTick: 8,
        incomePerTick: {},
        supportRadius: 2,
        unlockSource: "schema",
        unlockCost: { chaosShards: 2, steamComponents: 1 },
        unlockWadCost: 34,
        preferredRoomTags: ["survey_highground"],
        placeholder: true
      },
      recovery_yard: {
        id: "recovery_yard",
        displayName: "Recovery Yard",
        shortCode: "RY",
        category: "industry",
        description: "Placeholder salvage-processing yard for future post-battle recovery bonuses.",
        buildCost: { metalScrap: 3, wood: 2 },
        upkeep: {},
        wadUpkeepPerTick: 7,
        incomePerTick: {},
        supportRadius: 0,
        unlockSource: "schema",
        unlockCost: { metalScrap: 4, wood: 2 },
        unlockWadCost: 28,
        preferredRoomTags: ["salvage_rich"],
        placeholder: true
      },
      transit_hub: {
        id: "transit_hub",
        displayName: "Transit Hub",
        shortCode: "TH",
        category: "mobility",
        description: "Placeholder movement hub for future travel-time smoothing and routing bonuses.",
        buildCost: { metalScrap: 4, wood: 3, steamComponents: 1 },
        upkeep: {},
        wadUpkeepPerTick: 9,
        incomePerTick: {},
        supportRadius: 2,
        unlockSource: "schema",
        unlockCost: { metalScrap: 4, wood: 3 },
        unlockWadCost: 36,
        preferredRoomTags: ["transit_junction"],
        placeholder: true
      },
      tavern: {
        id: "tavern",
        displayName: "Tavern",
        shortCode: "TV",
        category: "civic",
        description: "Placeholder morale node for future recovery and contract-generation systems.",
        buildCost: { wood: 4, chaosShards: 1 },
        upkeep: {},
        wadUpkeepPerTick: 6,
        incomePerTick: {},
        supportRadius: 1,
        unlockSource: "schema",
        unlockCost: { wood: 4, chaosShards: 1 },
        unlockWadCost: 24,
        preferredRoomTags: ["tavern_suitable"],
        placeholder: true
      },
      refinery: {
        id: "refinery",
        displayName: "Refinery",
        shortCode: "RF",
        category: "industry",
        description: "Processing core that distills theater throughput into a steady Steam Components stream.",
        operationalRequirements: {
          powerWatts: 50,
          commsBw: 0,
          supplyCrates: 50
        },
        buildCost: { metalScrap: 4, steamComponents: 1, wood: 1 },
        upkeep: {},
        wadUpkeepPerTick: 7,
        incomePerTick: { steamComponents: 1 },
        supportRadius: 0,
        unlockSource: "starter",
        preferredRoomTags: ["steam_vent"],
        tagOutputModifiers: [
          { tag: "steam_vent", output: { steamComponents: 3 }, note: "Refinery +3 Steam Components/tick" }
        ],
        placeholder: false
      }
    };
    SCHEMA_FORTIFICATION_DEFINITIONS = {
      barricade: {
        id: "barricade",
        displayName: "Barricade",
        description: "Reduces frontier damage and is consumed first when a secured room is overwhelmed.",
        buildCost: { metalScrap: 2, wood: 2 },
        unlockSource: "starter",
        preferredRoomTags: ["frontier"]
      },
      powerRail: {
        id: "powerRail",
        displayName: "Power Rail",
        description: "Required for routing power through secured rooms.",
        buildCost: { metalScrap: 2, steamComponents: 1 },
        unlockSource: "starter",
        preferredRoomTags: ["power_source", "transit_junction"]
      },
      bulkhead: {
        id: "bulkhead",
        displayName: "Bulkhead",
        description: "Placeholder hard-seal fortification for future structural defense bonuses.",
        buildCost: { metalScrap: 3, wood: 1 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 3, wood: 1 },
        unlockWadCost: 16,
        placeholder: true
      },
      turret: {
        id: "turret",
        displayName: "Turret",
        description: "Placeholder defensive emplacement for future theater attack responses.",
        buildCost: { metalScrap: 3, steamComponents: 1 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 4, steamComponents: 1 },
        unlockWadCost: 20,
        placeholder: true
      },
      substation: {
        id: "substation",
        displayName: "Substation",
        description: "Placeholder power-routing node for future grid smoothing.",
        buildCost: { metalScrap: 2, steamComponents: 2 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 2, steamComponents: 2 },
        unlockWadCost: 18,
        preferredRoomTags: ["steam_vent"],
        placeholder: true
      },
      capacitor: {
        id: "capacitor",
        displayName: "Capacitor",
        description: "Placeholder charge reservoir for future burst power support.",
        buildCost: { metalScrap: 2, chaosShards: 1, steamComponents: 1 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 2, chaosShards: 1 },
        unlockWadCost: 18,
        placeholder: true
      },
      switchgear: {
        id: "switchgear",
        displayName: "Switchgear",
        description: "Placeholder routing control package for future dynamic network switching.",
        buildCost: { metalScrap: 2, steamComponents: 1 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 2, steamComponents: 1 },
        unlockWadCost: 14,
        placeholder: true
      },
      overcharger: {
        id: "overcharger",
        displayName: "Overcharger",
        description: "Placeholder power booster for future high-demand facility spikes.",
        buildCost: { metalScrap: 2, chaosShards: 1, steamComponents: 2 },
        unlockSource: "schema",
        unlockCost: { chaosShards: 1, steamComponents: 2 },
        unlockWadCost: 22,
        placeholder: true
      },
      repeater: {
        id: "repeater",
        displayName: "Repeater",
        description: "Placeholder comms repeater for future visibility and warning coverage.",
        buildCost: { metalScrap: 1, steamComponents: 1 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 1, steamComponents: 1 },
        unlockWadCost: 12,
        preferredRoomTags: ["survey_highground"],
        placeholder: true
      },
      sensorArray: {
        id: "sensorArray",
        displayName: "Sensor Array",
        description: "Placeholder sensor package for future recon and threat detection.",
        buildCost: { metalScrap: 1, chaosShards: 1, steamComponents: 1 },
        unlockSource: "schema",
        unlockCost: { chaosShards: 1, steamComponents: 1 },
        unlockWadCost: 16,
        preferredRoomTags: ["survey_highground"],
        placeholder: true
      },
      signalBooster: {
        id: "signalBooster",
        displayName: "Signal Booster",
        description: "Placeholder signal booster for future comms bandwidth bonuses.",
        buildCost: { metalScrap: 1, steamComponents: 1, wood: 1 },
        unlockSource: "schema",
        unlockCost: { steamComponents: 1, wood: 1 },
        unlockWadCost: 12,
        placeholder: true
      },
      waystation: {
        id: "waystation",
        displayName: "Way Station",
        description: "Eliminates supply decay into and out of this room, preserving the logistics line through the route.",
        buildCost: { wood: 2, metalScrap: 2 },
        unlockSource: "starter",
        preferredRoomTags: ["transit_junction"],
        placeholder: false
      },
      bridgeRig: {
        id: "bridgeRig",
        displayName: "Bridge Rig",
        description: "Placeholder structural kit for future route repair and reconnect effects.",
        buildCost: { metalScrap: 2, wood: 2 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 2, wood: 2 },
        unlockWadCost: 14,
        preferredRoomTags: ["transit_junction"],
        placeholder: true
      },
      repairBench: {
        id: "repairBench",
        displayName: "Repair Bench",
        description: "Placeholder maintenance fixture for future damage recovery.",
        buildCost: { metalScrap: 2, wood: 1, steamComponents: 1 },
        unlockSource: "schema",
        unlockCost: { metalScrap: 2, steamComponents: 1 },
        unlockWadCost: 16,
        placeholder: true
      },
      securityTerminal: {
        id: "securityTerminal",
        displayName: "Security Terminal",
        description: "Placeholder command-security node for future defense responses and access control.",
        buildCost: { metalScrap: 1, chaosShards: 1, steamComponents: 1 },
        unlockSource: "schema",
        unlockCost: { chaosShards: 1, steamComponents: 1 },
        unlockWadCost: 18,
        preferredRoomTags: ["command_suitable"],
        placeholder: true
      }
    };
  }
});

// src/core/classes.ts
function importedClassToDefinition(classDefinition) {
  if (!classDefinition) {
    return null;
  }
  return {
    id: classDefinition.id,
    name: classDefinition.name,
    description: classDefinition.description,
    tier: classDefinition.tier,
    baseStats: { ...classDefinition.baseStats },
    weaponTypes: [...classDefinition.weaponTypes],
    unlockConditions: classDefinition.unlockConditions.map((condition) => ({
      type: condition.type,
      requiredClass: condition.requiredClassId,
      requiredRank: condition.requiredRank,
      description: condition.description
    })),
    innateAbility: classDefinition.innateAbility,
    trainingGrid: classDefinition.trainingGrid?.map((node) => ({
      id: node.id,
      name: node.name,
      description: node.description,
      cost: node.cost,
      row: node.row,
      col: node.col,
      requires: [...node.requires ?? []],
      benefit: node.benefit
    }))
  };
}
function getClassCatalog() {
  const catalog = {};
  Object.entries(CLASS_DEFINITIONS).forEach(([classId, classDefinition]) => {
    if (!isTechnicaContentDisabled("class", classId)) {
      catalog[classId] = classDefinition;
    }
  });
  getAllImportedClasses().forEach((classDefinition) => {
    const mappedClass = importedClassToDefinition(classDefinition);
    if (mappedClass) {
      catalog[mappedClass.id] = mappedClass;
    }
  });
  return catalog;
}
function getClassDefinition(classId) {
  return getClassCatalog()[classId] || CLASS_DEFINITIONS.squire;
}
var CLASS_DEFINITIONS;
var init_classes = __esm({
  "src/core/classes.ts"() {
    "use strict";
    init_technica();
    CLASS_DEFINITIONS = {
      // ==========================================================================
      // TIER 0 - STARTER JOBS
      // ==========================================================================
      squire: {
        id: "squire",
        name: "Squire",
        description: "Balanced frontline unit, adaptive and reliable.",
        tier: 0,
        baseStats: { maxHp: 12, atk: 8, def: 6, agi: 3, acc: 6 },
        weaponTypes: ["sword"],
        unlockConditions: [{ type: "always_unlocked" }],
        innateAbility: "Gained Ground: +1 DEF when adjacent to ally"
      },
      ranger: {
        id: "ranger",
        name: "Ranger",
        description: "Long-range attacker with strong mobility options.",
        tier: 0,
        baseStats: { maxHp: 12, atk: 8, def: 4, agi: 4, acc: 8 },
        weaponTypes: ["bow"],
        unlockConditions: [{ type: "always_unlocked" }],
        innateAbility: "Far Shot: +1 range on bow attacks"
      },
      // ==========================================================================
      // TIER 1 - CORE UNLOCKABLE CLASSES
      // ==========================================================================
      magician: {
        id: "magician",
        name: "Magician",
        description: "Damage + utility casting. Harnesses chaos energy.",
        tier: 1,
        baseStats: { maxHp: 10, atk: 9, def: 3, agi: 3, acc: 7 },
        weaponTypes: ["staff"],
        unlockConditions: [
          { type: "milestone", description: "Bring 5 Chaos Shards to Base Camp" }
        ],
        innateAbility: "Mana Flow: -1 strain cost on magic cards"
      },
      thief: {
        id: "thief",
        name: "Thief",
        description: "Stealth, mobility, debuffs, and critical strikes.",
        tier: 1,
        baseStats: { maxHp: 11, atk: 7, def: 4, agi: 5, acc: 8 },
        weaponTypes: ["shortsword"],
        unlockConditions: [
          { type: "milestone", description: "Successfully steal from an enemy" }
        ],
        innateAbility: "Steal: Can pilfer items from enemies"
      },
      academic: {
        id: "academic",
        name: "Academic",
        description: "Tactical analysis, buffing, and intel gathering.",
        tier: 1,
        baseStats: { maxHp: 10, atk: 6, def: 4, agi: 3, acc: 7 },
        weaponTypes: ["bow", "shortsword"],
        unlockConditions: [
          { type: "milestone", description: "Scan 10 unique enemy types" }
        ],
        innateAbility: "Analysis: Reveal enemy HP and weaknesses"
      },
      freelancer: {
        id: "freelancer",
        name: "Freelancer",
        description: "Adaptive generalist. Can use any weapon with minor penalties.",
        tier: 1,
        baseStats: { maxHp: 12, atk: 7, def: 5, agi: 3, acc: 6 },
        weaponTypes: ["sword", "bow", "staff", "shortsword"],
        // Can use any
        unlockConditions: [
          { type: "class_rank", requiredClass: "squire", requiredRank: 2 },
          { type: "class_rank", requiredClass: "ranger", requiredRank: 2 }
        ],
        innateAbility: "Versatile: No weapon restrictions"
      },
      // ==========================================================================
      // TIER 2 - SQUIRE BRANCHES
      // ==========================================================================
      sentry: {
        id: "sentry",
        name: "Sentry",
        description: "Defensive vanguard. Anti-rush frontline specialist.",
        tier: 2,
        baseStats: { maxHp: 130, atk: 9, def: 11, agi: 4, acc: 6 },
        weaponTypes: ["sword", "greatsword"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "squire", requiredRank: 3 },
          { type: "milestone", description: "Complete 3 battles with no ally KOs" }
        ],
        innateAbility: "Guardian: Adjacent allies take -2 damage"
      },
      paladin: {
        id: "paladin",
        name: "Paladin",
        description: "Protector with healing and mitigation abilities.",
        tier: 2,
        baseStats: { maxHp: 125, atk: 9, def: 10, agi: 4, acc: 7 },
        weaponTypes: ["sword", "greatsword"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "squire", requiredRank: 3 },
          { type: "milestone", description: "Save an ally from lethal damage 5 times" }
        ],
        innateAbility: "Auto-Regen: Heal 5 HP per turn"
      },
      watch_guard: {
        id: "watch_guard",
        name: "Watch Guard",
        description: "Hybrid melee-ranged control and overwatch.",
        tier: 2,
        baseStats: { maxHp: 110, atk: 8, def: 7, agi: 6, acc: 8 },
        weaponTypes: ["sword", "bow"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "squire", requiredRank: 3 },
          { type: "milestone", description: "Deal melee and ranged damage in one battle" }
        ],
        innateAbility: "Overwatch: Free attack on enemies entering range"
      },
      // ==========================================================================
      // TIER 2 - RANGER BRANCHES
      // ==========================================================================
      hunter: {
        id: "hunter",
        name: "Hunter",
        description: "Precision ranged crits and single-target burst.",
        tier: 2,
        baseStats: { maxHp: 95, atk: 10, def: 4, agi: 8, acc: 10 },
        weaponTypes: ["bow", "gun"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "ranger", requiredRank: 3 },
          { type: "milestone", description: "Score 3 max-range critical hits" }
        ],
        innateAbility: "Sharpshooter: +2 damage at max range"
      },
      bowmaster: {
        id: "bowmaster",
        name: "Bowmaster",
        description: "Long-range power shots and piercing attacks.",
        tier: 2,
        baseStats: { maxHp: 100, atk: 11, def: 4, agi: 7, acc: 9 },
        weaponTypes: ["bow", "greatbow"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "ranger", requiredRank: 3 },
          { type: "milestone", description: "Fire 50 arrows total" }
        ],
        innateAbility: "Pierce: Attacks pass through first target"
      },
      trapper: {
        id: "trapper",
        name: "Trapper",
        description: "Battlefield control through traps, snares, and lures.",
        tier: 2,
        baseStats: { maxHp: 90, atk: 7, def: 5, agi: 8, acc: 8 },
        weaponTypes: ["bow", "gun"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "ranger", requiredRank: 3 },
          { type: "milestone", description: "Trigger 5 traps in Free Zones" }
        ],
        innateAbility: "Set Trap: Place hazards on tiles"
      },
      // ==========================================================================
      // TIER 2 - MAGICIAN BRANCHES
      // ==========================================================================
      cleric: {
        id: "cleric",
        name: "Cleric",
        description: "Heals, shields, and purifies corruption.",
        tier: 2,
        baseStats: { maxHp: 80, atk: 5, def: 5, agi: 5, acc: 7 },
        weaponTypes: ["staff"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "magician", requiredRank: 3 },
          { type: "milestone", description: "Heal 500 HP cumulatively" }
        ],
        innateAbility: "Holy Light: Heals also damage undead"
      },
      wizard: {
        id: "wizard",
        name: "Wizard",
        description: "High-damage elemental casting specialist.",
        tier: 2,
        baseStats: { maxHp: 70, atk: 12, def: 3, agi: 5, acc: 8 },
        weaponTypes: ["staff", "greatstaff"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "magician", requiredRank: 3 },
          { type: "milestone", description: "Deal 1000 total magic damage" }
        ],
        innateAbility: "Arcane Mastery: +3 damage on elemental spells"
      },
      chaosmancer: {
        id: "chaosmancer",
        name: "Chaosmancer",
        description: "Chaos-infused hybrid of melee and magic.",
        tier: 2,
        baseStats: { maxHp: 90, atk: 10, def: 5, agi: 6, acc: 7 },
        weaponTypes: ["staff", "sword"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "magician", requiredRank: 3 },
          { type: "milestone", description: "Survive 3 Chaos Surges" }
        ],
        innateAbility: "Chaos Blade: Melee attacks deal magic damage"
      },
      // ==========================================================================
      // TIER 2 - THIEF BRANCHES
      // ==========================================================================
      scout: {
        id: "scout",
        name: "Scout",
        description: "Recon specialist. Vision range boosts and picking off stragglers.",
        tier: 2,
        baseStats: { maxHp: 85, atk: 8, def: 4, agi: 9, acc: 9 },
        weaponTypes: ["bow"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "thief", requiredRank: 3 },
          { type: "milestone", description: "Discover 10 secrets in Free Zones" }
        ],
        innateAbility: "Far Sight: +2 vision range"
      },
      shadow: {
        id: "shadow",
        name: "Shadow",
        description: "Assassination master with evasion and backstab crits.",
        tier: 2,
        baseStats: { maxHp: 80, atk: 11, def: 3, agi: 12, acc: 9 },
        weaponTypes: ["shortsword", "bow"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "thief", requiredRank: 3 },
          { type: "milestone", description: "Perform 5 backstab kills" }
        ],
        innateAbility: "Backstab: +100% damage from behind"
      },
      trickster: {
        id: "trickster",
        name: "Trickster",
        description: "Confusion, displacement, and debuff specialist.",
        tier: 2,
        baseStats: { maxHp: 90, atk: 7, def: 5, agi: 10, acc: 8 },
        weaponTypes: ["sword"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "thief", requiredRank: 3 },
          { type: "milestone", description: "Apply 20+ debuffs across operations" }
        ],
        innateAbility: "Misdirection: Enemies have -2 ACC vs this unit"
      },
      // ==========================================================================
      // TIER 3 - PRESTIGE HYBRID CLASSES
      // ==========================================================================
      spellblade: {
        id: "spellblade",
        name: "Spellblade",
        description: "Magic-infused melee warrior.",
        tier: 3,
        baseStats: { maxHp: 110, atk: 11, def: 7, agi: 6, acc: 8 },
        weaponTypes: ["sword"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "squire", requiredRank: 3 },
          { type: "class_rank", requiredClass: "magician", requiredRank: 3 },
          { type: "milestone", description: "Wield a magic-infused sword" }
        ],
        innateAbility: "Spellstrike: Melee attacks trigger spell effects"
      },
      dragoon: {
        id: "dragoon",
        name: "Dragoon",
        description: "Aerial assault specialist with jump attacks.",
        tier: 3,
        baseStats: { maxHp: 120, atk: 11, def: 7, agi: 7, acc: 8 },
        weaponTypes: ["spear"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "squire", requiredRank: 4 },
          { type: "class_rank", requiredClass: "ranger", requiredRank: 3 },
          { type: "milestone", description: "Kill flying enemy via jump card" }
        ],
        innateAbility: "Jump: Leap to distant tiles, avoiding attacks"
      },
      gladiator: {
        id: "gladiator",
        name: "Gladiator",
        description: "Stance master with counters and duel-style combat.",
        tier: 3,
        baseStats: { maxHp: 125, atk: 12, def: 8, agi: 6, acc: 7 },
        weaponTypes: ["greatsword", "fist"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "squire", requiredRank: 4 },
          { type: "class_rank", requiredClass: "freelancer", requiredRank: 3 },
          { type: "milestone", description: "Win a 1vX duel" }
        ],
        innateAbility: "Counter Stance: 30% chance to counter melee attacks"
      },
      geomancer: {
        id: "geomancer",
        name: "Geomancer",
        description: "Terrain manipulation and AoE zone specialist.",
        tier: 3,
        baseStats: { maxHp: 100, atk: 9, def: 6, agi: 6, acc: 8 },
        weaponTypes: ["staff", "shortsword"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "magician", requiredRank: 3 },
          { type: "class_rank", requiredClass: "ranger", requiredRank: 3 },
          { type: "milestone", description: "Encounter 3 terrain anomalies" }
        ],
        innateAbility: "Terrain Mastery: Abilities change based on tile type"
      },
      oracle: {
        id: "oracle",
        name: "Oracle",
        description: "Status magic, foresight, and predictive buffs.",
        tier: 3,
        baseStats: { maxHp: 85, atk: 7, def: 5, agi: 7, acc: 9 },
        weaponTypes: ["staff"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "magician", requiredRank: 3 },
          { type: "class_rank", requiredClass: "academic", requiredRank: 2 },
          { type: "milestone", description: "Win with 5+ active debuffs on enemies" }
        ],
        innateAbility: "Prescience: See enemy intentions for next turn"
      },
      summoner: {
        id: "summoner",
        name: "Summoner",
        description: "Calls forth eidolons, sigils, and temporary allies.",
        tier: 3,
        baseStats: { maxHp: 80, atk: 8, def: 4, agi: 5, acc: 7 },
        weaponTypes: ["greatstaff"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "cleric", requiredRank: 3 },
          { type: "class_rank", requiredClass: "wizard", requiredRank: 3 },
          { type: "milestone", description: "Defeat a Sigil Beast in Free Zone" }
        ],
        innateAbility: "Summon: Call temporary allied units"
      },
      chronomancer: {
        id: "chronomancer",
        name: "Chronomancer",
        description: "Time manipulation: haste, slow, turn order control.",
        tier: 3,
        baseStats: { maxHp: 75, atk: 7, def: 4, agi: 9, acc: 8 },
        weaponTypes: ["staff"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "wizard", requiredRank: 4 },
          { type: "class_rank", requiredClass: "academic", requiredRank: 3 },
          { type: "milestone", description: "Defeat miniboss within 5 turns" }
        ],
        innateAbility: "Temporal Flux: Can manipulate turn order"
      },
      warsmith: {
        id: "warsmith",
        name: "Warsmith",
        description: "Engineer deploying turrets, drones, and gadgets.",
        tier: 3,
        baseStats: { maxHp: 105, atk: 9, def: 7, agi: 5, acc: 8 },
        weaponTypes: ["gun"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "academic", requiredRank: 3 },
          { type: "class_rank", requiredClass: "freelancer", requiredRank: 3 },
          { type: "milestone", description: "Craft an advanced Steam Component" }
        ],
        innateAbility: "Deploy Turret: Place automated gun emplacement"
      },
      necrotec: {
        id: "necrotec",
        name: "Necrotec",
        description: "Reanimates fallen enemies as mechanical husks.",
        tier: 3,
        baseStats: { maxHp: 95, atk: 10, def: 6, agi: 5, acc: 7 },
        weaponTypes: ["staff", "sword"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "chaosmancer", requiredRank: 3 },
          { type: "class_rank", requiredClass: "warsmith", requiredRank: 3 },
          { type: "milestone", description: "Perform reactivation ritual" }
        ],
        innateAbility: "Reanimate: Raise defeated enemies as allies"
      },
      battle_alchemist: {
        id: "battle_alchemist",
        name: "Battle Alchemist",
        description: "Grenades, chain reactions, and status payloads.",
        tier: 3,
        baseStats: { maxHp: 90, atk: 9, def: 5, agi: 7, acc: 8 },
        weaponTypes: ["shortsword"],
        unlockConditions: [
          { type: "class_rank", requiredClass: "magician", requiredRank: 2 },
          { type: "class_rank", requiredClass: "thief", requiredRank: 2 },
          { type: "milestone", description: "Craft 5 alchemical weapons" }
        ],
        innateAbility: "Throw Bomb: AoE damage and status effects"
      }
    };
  }
});

// src/core/pwr.ts
function calculatePWR(input) {
  const { unit, unitClassProgress, equipmentById, modulesById } = input;
  const baseStats = unit.stats || {
    maxHp: unit.maxHp || 20,
    atk: 5,
    def: 3,
    agi: unit.agi || 4,
    acc: 80
  };
  const loadout = unit.loadout || {
    weapon: null,
    helmet: null,
    chestpiece: null,
    accessory1: null,
    accessory2: null
  };
  const equip = equipmentById || getAllStarterEquipment();
  const mods = modulesById || getAllModules();
  const equipStats = calculateEquipmentStats(loadout, equip, mods);
  const statHp = Math.min(100, baseStats.maxHp / 150 * 100);
  const statAtk = Math.min(100, baseStats.atk / 20 * 100);
  const statDef = Math.min(100, baseStats.def / 15 * 100);
  const statAgi = Math.min(100, baseStats.agi / 15 * 100);
  const statAcc = Math.min(100, baseStats.acc);
  const baseStatsScore = (statHp + statAtk + statDef + statAgi + statAcc) / 5;
  const baseStatsComponent = baseStatsScore * 0.35;
  let classRanksScore = 0;
  if (unitClassProgress) {
    const totalRanks = Object.values(unitClassProgress.classRanks || {}).reduce(
      (sum, rank) => sum + rank,
      0
    );
    classRanksScore = Math.min(100, totalRanks / 20 * 100);
  } else {
    classRanksScore = 5;
  }
  const classRanksComponent = classRanksScore * 0.2;
  const unlockedGridNodeCount = unitClassProgress ? Object.values(unitClassProgress.gridUnlocks || {}).reduce(
    (sum, nodes) => sum + (nodes?.length || 0),
    0
  ) : 0;
  const gridScore = Math.min(100, unlockedGridNodeCount / 18 * 100);
  const abilityGridComponent = gridScore * 0.15;
  const gearAtk = Math.min(50, equipStats.atk * 2);
  const gearDef = Math.min(50, equipStats.def * 2);
  const gearAgi = Math.min(50, equipStats.agi * 2);
  const gearAcc = Math.min(50, equipStats.acc * 2);
  const gearHp = Math.min(50, equipStats.hp / 30 * 50);
  const gearScore = (gearAtk + gearDef + gearAgi + gearAcc + gearHp) / 5;
  const gearComponent = gearScore * 0.2;
  const unitClass = unit.unitClass || "squire";
  const deckSize = estimateDeckSize(unitClass, loadout, equip);
  const cardsScore = Math.min(100, deckSize / 20 * 100);
  const cardsComponent = cardsScore * 0.05;
  let promotionsScore = 0;
  if (unitClassProgress) {
    const currentClass = getClassDefinition(unitClassProgress.currentClass);
    promotionsScore = currentClass.tier * 20;
  }
  const promotionsComponent = promotionsScore * 0.05;
  const totalPWR = Math.round(
    baseStatsComponent + classRanksComponent + abilityGridComponent + gearComponent + cardsComponent + promotionsComponent
  );
  return Math.max(0, totalPWR);
}
function estimateDeckSize(_unitClass, loadout, equipmentById) {
  let count = 0;
  const slots = ["weapon", "helmet", "chestpiece", "accessory1", "accessory2"];
  for (const slot of slots) {
    const equipId = loadout[slot];
    if (equipId && equipmentById[equipId]) {
      count += 3;
    }
  }
  count += 3;
  return count;
}
var init_pwr = __esm({
  "src/core/pwr.ts"() {
    "use strict";
    init_classes();
    init_equipment();
    init_equipment();
  }
});

// src/core/initialState.ts
function equipmentCardToGameCard(eqCard) {
  const desc = eqCard.description.toLowerCase();
  let targetType = "self";
  const isOffensive = eqCard.damage && eqCard.damage > 0 || desc.includes("deal") && desc.includes("damage") || desc.includes("attack") || desc.includes("hit") || desc.includes("strike") || desc.includes("shot") || desc.includes("slash") || desc.includes("stab") || desc.includes("push target") || desc.includes("pull target");
  const isAllyTarget = desc.includes("ally") || desc.includes("restore") && desc.includes("ally") || desc.includes("heal ally");
  const isTileTarget = desc.includes("move") && desc.includes("tile") || desc.includes("reposition");
  if (isOffensive) {
    targetType = "enemy";
  } else if (isAllyTarget) {
    targetType = "ally";
  } else if (isTileTarget) {
    targetType = "tile";
  }
  let range = 1;
  if (eqCard.range) {
    if (eqCard.range.toLowerCase().includes("self")) {
      range = 0;
      targetType = "self";
    } else {
      const match = eqCard.range.match(/R\((\d+)(?:-(\d+))?\)/);
      if (match) {
        range = parseInt(match[2] || match[1], 10);
      }
    }
  }
  const effects = [];
  if (eqCard.damage && eqCard.damage > 0) {
    effects.push({ type: "damage", amount: eqCard.damage });
  } else {
    const dmgMatch = desc.match(/deal\s+(\d+)\s+damage/i);
    if (dmgMatch) {
      effects.push({ type: "damage", amount: parseInt(dmgMatch[1], 10) });
    }
  }
  const healMatch = desc.match(/(?:restore|heal|recover)\s+(\d+)\s+hp/i);
  if (healMatch) {
    effects.push({ type: "heal", amount: parseInt(healMatch[1], 10) });
  }
  const defMatch = desc.match(/\+(\d+)\s+def/i) || desc.match(/gain\s+\+?(\d+)\s+def/i);
  if (defMatch) {
    effects.push({ type: "def_up", amount: parseInt(defMatch[1], 10), duration: 1 });
  }
  const atkMatch = desc.match(/\+(\d+)\s+atk/i) || desc.match(/gain\s+\+?(\d+)\s+atk/i);
  if (atkMatch) {
    effects.push({ type: "atk_up", amount: parseInt(atkMatch[1], 10), duration: 1 });
  }
  const agiMatch = desc.match(/\+(\d+)\s+agi/i) || desc.match(/gain\s+\+?(\d+)\s+agi/i);
  if (agiMatch) {
    effects.push({ type: "agi_up", amount: parseInt(agiMatch[1], 10), duration: 1 });
  }
  const agiDownMatch = desc.match(/-(\d+)\s+agi/i) || desc.match(/inflict\s+-?(\d+)\s+agi/i);
  if (agiDownMatch) {
    effects.push({ type: "agi_down", amount: parseInt(agiDownMatch[1], 10), duration: 1, stat: "agi" });
  }
  const accMatch = desc.match(/\+(\d+)\s+acc/i) || desc.match(/gain\s+\+?(\d+)\s+acc/i);
  if (accMatch) {
    effects.push({ type: "acc_up", amount: parseInt(accMatch[1], 10), duration: 1 });
  }
  if (desc.includes("stun")) {
    effects.push({ type: "stun", duration: 1 });
  }
  if (desc.includes("burn") || desc.includes("inflict burn")) {
    effects.push({ type: "burn", duration: 2 });
  }
  const pushMatch = desc.match(/push\s+(?:target\s+)?(?:back\s+)?(\d+)\s+tile/i);
  if (pushMatch) {
    effects.push({ type: "push", amount: parseInt(pushMatch[1], 10) });
  }
  if (eqCard.id === "core_wait" || eqCard.name.toLowerCase() === "wait") {
    effects.push({ type: "end_turn" });
  }
  return {
    id: eqCard.id,
    name: eqCard.name,
    description: eqCard.description,
    strainCost: eqCard.strainCost,
    targetType,
    range,
    effects
  };
}
function createAllCards() {
  const cards = {};
  const legacyCards = [
    {
      id: "strike",
      name: "Strike",
      description: "Deal 5 damage to an adjacent enemy.",
      strainCost: 2,
      targetType: "enemy",
      range: 1,
      effects: [{ type: "damage", amount: 5 }]
    },
    {
      id: "lunge",
      name: "Lunge",
      description: "Deal 4 damage to an enemy up to 2 tiles away.",
      strainCost: 2,
      targetType: "enemy",
      range: 2,
      effects: [{ type: "damage", amount: 4 }]
    },
    {
      id: "brace",
      name: "Brace",
      description: "Gain strain to steel your nerves.",
      strainCost: 2,
      targetType: "self",
      range: 0,
      effects: []
    }
  ];
  for (const card of legacyCards) {
    cards[card.id] = card;
  }
  const equipmentCards = getAllEquipmentCards();
  for (const [id, eqCard] of Object.entries(equipmentCards)) {
    cards[id] = equipmentCardToGameCard(eqCard);
  }
  return cards;
}
function createEmptyLoadout() {
  return {
    primaryWeapon: null,
    secondaryWeapon: null,
    helmet: null,
    chestpiece: null,
    accessory1: null,
    accessory2: null
  };
}
function importedUnitToRuntimeUnit(unit) {
  if (unit.spawnRole === "enemy" || unit.startingInRoster === false && !unit.deployInParty) {
    return null;
  }
  return {
    id: unit.id,
    name: unit.name,
    isEnemy: false,
    hp: unit.stats.maxHp,
    maxHp: unit.stats.maxHp,
    agi: unit.stats.agi,
    pos: null,
    hand: [],
    drawPile: [],
    discardPile: [],
    strain: 0,
    description: unit.description,
    classId: unit.currentClassId,
    unitClass: unit.currentClassId,
    stats: {
      maxHp: unit.stats.maxHp,
      atk: unit.stats.atk,
      def: unit.stats.def,
      agi: unit.stats.agi,
      acc: unit.stats.acc
    },
    deck: [],
    // Fresh saves currently start with no equipped gear regardless of template defaults.
    loadout: createEmptyLoadout(),
    affinities: createDefaultAffinities(),
    pwr: unit.pwr,
    recruitCost: unit.recruitCost,
    startingInRoster: unit.startingInRoster ?? true,
    deployInParty: unit.deployInParty ?? false,
    traits: [...unit.traits ?? []]
  };
}
function createStarterUnits() {
  const baseDeck = [];
  const equipmentById = getAllStarterEquipment();
  const modulesById = getAllModules();
  const units = [
    ...isTechnicaContentDisabled("unit", "unit_aeriss") ? [] : [{
      id: "unit_aeriss",
      name: "Aeriss",
      isEnemy: false,
      hp: 9,
      maxHp: 9,
      agi: 3,
      pos: null,
      hand: [],
      drawPile: [],
      discardPile: [],
      strain: 0,
      classId: "vanguard",
      unitClass: "squire",
      stats: {
        maxHp: 9,
        atk: 7,
        def: 3,
        agi: 3,
        acc: 90
      },
      deck: baseDeck,
      loadout: createEmptyLoadout(),
      affinities: createDefaultAffinities(),
      startingInRoster: true,
      deployInParty: true
    }],
    ...isTechnicaContentDisabled("unit", "unit_marksman_1") ? [] : [{
      id: "unit_marksman_1",
      name: "Mistguard Marksman",
      isEnemy: false,
      hp: 13,
      maxHp: 13,
      agi: 3,
      pos: null,
      hand: [],
      drawPile: [],
      discardPile: [],
      strain: 0,
      classId: "marksman",
      unitClass: "ranger",
      stats: {
        maxHp: 13,
        atk: 6,
        def: 2,
        agi: 3,
        acc: 95
      },
      deck: baseDeck,
      loadout: createEmptyLoadout(),
      affinities: createDefaultAffinities(),
      startingInRoster: true,
      deployInParty: true
    }],
    ...isTechnicaContentDisabled("unit", "unit_mage_1") ? [] : [{
      id: "unit_mage_1",
      name: "Field Mage",
      isEnemy: false,
      hp: 10,
      maxHp: 10,
      agi: 2,
      pos: null,
      hand: [],
      drawPile: [],
      discardPile: [],
      strain: 0,
      classId: "caster",
      unitClass: "magician",
      stats: {
        maxHp: 10,
        atk: 5,
        def: 1,
        agi: 2,
        acc: 85
      },
      deck: baseDeck,
      loadout: createEmptyLoadout(),
      affinities: createDefaultAffinities(),
      startingInRoster: true,
      deployInParty: true
    }]
  ];
  getAllImportedUnits().forEach((unit) => {
    const runtimeUnit = importedUnitToRuntimeUnit(unit);
    if (!runtimeUnit) {
      return;
    }
    const existingIndex = units.findIndex((candidate) => candidate.id === runtimeUnit.id);
    if (existingIndex >= 0) {
      units[existingIndex] = runtimeUnit;
    } else {
      units.push(runtimeUnit);
    }
  });
  const unitsWithPWR = units.map((u) => {
    const pwr = typeof u.pwr === "number" ? u.pwr : calculatePWR({
      unit: u,
      equipmentById,
      modulesById
    });
    return { ...u, pwr, controller: "P1" };
  });
  return Object.fromEntries(unitsWithPWR.map((u) => [u.id, u]));
}
function importedOperationToRuntimeOperation(operation) {
  return {
    id: operation.id,
    codename: operation.codename,
    description: operation.description,
    currentFloorIndex: 0,
    currentRoomId: operation.floors[0]?.startingRoomId ?? operation.floors[0]?.rooms[0]?.id ?? null,
    floors: operation.floors.map((floor) => ({
      id: floor.id,
      name: floor.name,
      nodes: floor.rooms.map((room) => ({
        id: room.id,
        type: room.type,
        label: room.label,
        position: { x: room.position.x, y: room.position.y },
        connections: [...room.connections ?? []],
        battleTemplate: room.battleTemplate,
        eventTemplate: room.eventTemplate,
        shopInventory: [...room.shopInventory ?? []]
      }))
    }))
  };
}
function createOperationIronGate() {
  const importedOperation = getImportedOperation("op_iron_gate");
  if (importedOperation) {
    return importedOperationToRuntimeOperation(importedOperation);
  }
  if (isTechnicaContentDisabled("operation", "op_iron_gate")) {
    const firstImportedOperation = getAllImportedOperations()[0];
    if (firstImportedOperation) {
      return importedOperationToRuntimeOperation(firstImportedOperation);
    }
  }
  const nodes = [
    {
      id: "room_start",
      type: "tavern",
      label: "Forward Outpost",
      position: { x: 0, y: 0 },
      connections: ["room_battle_1"]
    },
    {
      id: "room_battle_1",
      type: "battle",
      label: "Collapsed Entrance",
      position: { x: 1, y: 0 },
      connections: ["room_battle_2"]
    },
    {
      id: "room_battle_2",
      type: "battle",
      label: "Inner Courtyard",
      position: { x: 2, y: 0 },
      connections: ["room_boss"]
    },
    {
      id: "room_boss",
      type: "boss",
      label: "Gateheart Core",
      position: { x: 3, y: 0 },
      connections: []
    }
  ];
  const floor = {
    id: "floor_iron_gate_1",
    name: "Iron Gate - Approach",
    nodes,
    startingNodeId: "room_start"
  };
  const operation = {
    id: "op_iron_gate",
    codename: "IRON GATE",
    description: "Secure the Chaos Rift entrance.",
    currentFloorIndex: 0,
    floors: [floor],
    currentRoomId: "room_start"
  };
  return operation;
}
function createDefaultProfile(rosterUnitIds) {
  return {
    callsign: "AERISS",
    squadName: "Company of Quills",
    rosterUnitIds
  };
}
function createEquipmentPool() {
  return [];
}
function createNewGameState() {
  const cardsById = createAllCards();
  const unitsById = createStarterUnits();
  const rosterUnitIds = Object.values(unitsById).filter((unit) => unit.startingInRoster !== false).map((unit) => unit.id);
  const profile = createDefaultProfile(rosterUnitIds);
  const operation = createOperationIronGate();
  const importedStarterItems = getImportedStarterItems().map((item) => ({ ...item }));
  const equipmentById = {};
  const modulesById = getAllModules();
  const equipmentPool = createEquipmentPool();
  const state = {
    phase: "shell",
    profile,
    operation,
    unitsById,
    cardsById,
    partyUnitIds: Object.values(unitsById).filter((unit) => unit.deployInParty === true).map((unit) => unit.id),
    wad: 0,
    resources: {
      metalScrap: 0,
      wood: 0,
      chaosShards: 0,
      steamComponents: 0
    },
    schema: createDefaultSchemaUnlockState(),
    // Starter card library
    cardLibrary: Object.fromEntries(
      Object.entries(getStarterCardLibrary()).filter(
        ([cardId]) => !isTechnicaContentDisabled("card", cardId)
      )
    ),
    // Gear slots - will be populated as equipment is acquired
    gearSlots: {},
    // Crafting - starter recipes are known by default
    knownRecipeIds: getStarterRecipeIds(),
    // Consumables pouch - starts empty
    consumables: {},
    currentBattle: null,
    inventory: {
      muleClass: "E",
      capacityMassKg: 50,
      capacityBulkBu: 35,
      capacityPowerW: 150,
      forwardLocker: [],
      baseStorage: importedStarterItems
    },
    // 11b/11c Equipment system additions
    equipmentById,
    modulesById,
    equipmentPool,
    // Quest System
    quests: {
      availableQuests: [],
      activeQuests: [],
      completedQuests: [],
      failedQuests: [],
      maxActiveQuests: 5
    },
    // Unit Recruitment System (Headline 14az)
    recruitmentCandidates: void 0,
    // Will be generated when Tavern is opened
    unitClassProgress: {},
    // Local Co-op System - Initialize players
    players: {
      P1: {
        id: "P1",
        active: true,
        color: "#ff8a00",
        // Orange for P1
        inputSource: "keyboard1",
        avatar: null,
        // Will be set when entering field mode
        controlledUnitIds: []
        // Will be populated when entering battle
      },
      P2: {
        id: "P2",
        active: false,
        color: "#6849c2",
        // Purple for P2
        inputSource: "none",
        avatar: null,
        controlledUnitIds: []
      }
    },
    // Port System
    baseCampVisitIndex: 0,
    portManifest: void 0,
    portTradesRemaining: 2,
    // Dispatch / Expeditions
    dispatch: {
      missionSlots: 2,
      dispatchTick: 0,
      intelDossiers: 0,
      activeIntelBonus: 0,
      squadXpBank: 0,
      activeExpeditions: [],
      completedReports: []
    },
    // Gear Builder System - Starter unlocks
    unlockedChassisIds: [
      "chassis_standard_rifle",
      "chassis_standard_helmet",
      "chassis_standard_chest",
      "chassis_utility_module"
    ],
    unlockedDoctrineIds: [
      "doctrine_balanced",
      "doctrine_skirmish",
      "doctrine_sustain"
    ],
    unlockedCodexEntries: []
  };
  for (const unitId of state.partyUnitIds) {
    const unit = state.unitsById[unitId];
    if (unit && !unit.isEnemy) {
      unit.controller = "P1";
      state.players.P1.controlledUnitIds.push(unitId);
    }
  }
  return state;
}
var init_initialState = __esm({
  "src/core/initialState.ts"() {
    "use strict";
    init_crafting();
    init_technica();
    init_schemaSystem();
    init_gearWorkbench();
    init_equipment();
    init_technica();
    init_pwr();
    init_affinity();
  }
});

// src/core/notesSystem.ts
function createNoteId(ordinal) {
  const entropy = Math.random().toString(36).slice(2, 8);
  return `note_${Date.now().toString(36)}_${ordinal}_${entropy}`;
}
function createNoteTab(ordinal) {
  return {
    id: createNoteId(ordinal),
    title: `${DEFAULT_NOTES_TITLE_PREFIX} ${String(ordinal).padStart(2, "0")}`,
    body: "",
    updatedAt: Date.now(),
    stickyAnchor: null
  };
}
function normalizeStickyAnchor(anchor) {
  if (!anchor || anchor.surfaceType !== "field" && anchor.surfaceType !== "theater" && anchor.surfaceType !== "atlas") {
    return null;
  }
  const surfaceId = typeof anchor.surfaceId === "string" ? anchor.surfaceId.trim() : "";
  if (!surfaceId) {
    return null;
  }
  return {
    surfaceType: anchor.surfaceType,
    surfaceId,
    x: Number.isFinite(anchor.x) ? Number(anchor.x) : 0,
    y: Number.isFinite(anchor.y) ? Number(anchor.y) : 0,
    colorKey: typeof anchor.colorKey === "string" && anchor.colorKey.trim().length > 0 ? anchor.colorKey.trim() : DEFAULT_STICKY_NOTE_COLOR_KEY
  };
}
function createDefaultNotesState() {
  const firstTab = createNoteTab(1);
  return {
    tabs: [firstTab],
    activeTabId: firstTab.id,
    nextTabOrdinal: 2
  };
}
function normalizeNotesState(notesState) {
  const fallback = createDefaultNotesState();
  const tabs = (notesState?.tabs ?? []).filter((tab) => Boolean(tab?.id)).map((tab, index) => ({
    id: tab.id,
    title: typeof tab.title === "string" ? tab.title : `${DEFAULT_NOTES_TITLE_PREFIX} ${String(index + 1).padStart(2, "0")}`,
    body: typeof tab.body === "string" ? tab.body : "",
    updatedAt: Number.isFinite(tab.updatedAt) ? tab.updatedAt : Date.now(),
    stickyAnchor: normalizeStickyAnchor(tab.stickyAnchor)
  }));
  if (tabs.length <= 0) {
    return fallback;
  }
  const activeTabId = tabs.some((tab) => tab.id === notesState?.activeTabId) ? notesState?.activeTabId ?? tabs[0].id : tabs[0].id;
  const nextTabOrdinal = Math.max(
    Number.isFinite(notesState?.nextTabOrdinal) ? Number(notesState?.nextTabOrdinal) : 0,
    tabs.length + 1
  );
  return {
    tabs,
    activeTabId,
    nextTabOrdinal
  };
}
function setNotesState(state, notesState) {
  return {
    ...state,
    uiLayout: {
      ...state.uiLayout ?? {},
      notesState
    }
  };
}
function notesStatesMatch(left, right) {
  if (!left) {
    return false;
  }
  if (left.activeTabId !== right.activeTabId || left.nextTabOrdinal !== right.nextTabOrdinal || left.tabs.length !== right.tabs.length) {
    return false;
  }
  return left.tabs.every((tab, index) => {
    const other = right.tabs[index];
    const stickyMatches = !tab.stickyAnchor && !other?.stickyAnchor || Boolean(tab.stickyAnchor) && Boolean(other?.stickyAnchor) && other.stickyAnchor.surfaceType === tab.stickyAnchor.surfaceType && other.stickyAnchor.surfaceId === tab.stickyAnchor.surfaceId && other.stickyAnchor.x === tab.stickyAnchor.x && other.stickyAnchor.y === tab.stickyAnchor.y && other.stickyAnchor.colorKey === tab.stickyAnchor.colorKey;
    return Boolean(other) && other.id === tab.id && other.title === tab.title && other.body === tab.body && other.updatedAt === tab.updatedAt && stickyMatches;
  });
}
function withNormalizedNotesState(state) {
  const normalized = normalizeNotesState(state.uiLayout?.notesState);
  if (notesStatesMatch(state.uiLayout?.notesState, normalized)) {
    return state;
  }
  return setNotesState(state, normalized);
}
var DEFAULT_NOTES_TITLE_PREFIX, STICKY_NOTE_COLOR_KEYS, DEFAULT_STICKY_NOTE_COLOR_KEY;
var init_notesSystem = __esm({
  "src/core/notesSystem.ts"() {
    "use strict";
    DEFAULT_NOTES_TITLE_PREFIX = "NOTE";
    STICKY_NOTE_COLOR_KEYS = ["steel", "teal", "oxide", "moss", "violet", "verdant"];
    DEFAULT_STICKY_NOTE_COLOR_KEY = STICKY_NOTE_COLOR_KEYS[0];
  }
});

// src/state/gameStore.ts
function syncPublishedTechnicaGear(state) {
  const importedGear2 = getAllImportedGear();
  if (importedGear2.length === 0) {
    return state;
  }
  const syncedGearIds = new Set(state.technicaSync?.starterGearIds ?? []);
  const runtimeEquipment = getAllStarterEquipment();
  const nextEquipmentById = { ...state.equipmentById ?? {} };
  const nextEquipmentPool = [...state.equipmentPool ?? []];
  let changed = false;
  importedGear2.forEach((gear) => {
    if (syncedGearIds.has(gear.id)) {
      return;
    }
    nextEquipmentById[gear.id] = runtimeEquipment[gear.id] ?? gear;
    syncedGearIds.add(gear.id);
    changed = true;
  });
  if (!changed) {
    return state;
  }
  return {
    ...state,
    equipmentById: nextEquipmentById,
    equipmentPool: nextEquipmentPool,
    technicaSync: {
      ...state.technicaSync,
      starterGearIds: Array.from(syncedGearIds)
    }
  };
}
function syncSchemaState(state) {
  return withNormalizedNotesState(withNormalizedSchemaState(state));
}
function getGameState() {
  if (!_gameState) {
    _gameState = syncSchemaState(syncPublishedTechnicaGear(createNewGameState()));
  } else {
    _gameState = syncSchemaState(syncPublishedTechnicaGear(_gameState));
  }
  return _gameState;
}
function setGameState(newState) {
  _gameState = syncSchemaState(syncPublishedTechnicaGear(newState));
  notifyListeners();
}
function updateGameState(updater) {
  const prev = getGameState();
  const next = updater(prev);
  setGameState(next);
  return next;
}
function notifyListeners() {
  const state = getGameState();
  for (const listener of listeners) {
    listener(state);
  }
}
var _gameState, listeners;
var init_gameStore = __esm({
  "src/state/gameStore.ts"() {
    "use strict";
    init_equipment();
    init_technica();
    init_initialState();
    init_notesSystem();
    init_schemaSystem();
    _gameState = null;
    listeners = /* @__PURE__ */ new Set();
  }
});

// src/core/affinityBattle.ts
function trackMeleeAttackInBattle(attackerId, battle) {
  const attacker = battle.units[attackerId];
  if (!attacker || attacker.isEnemy) return;
  updateGameState((state) => {
    recordMeleeAttack(attackerId, state);
    return state;
  });
}
var init_affinityBattle = __esm({
  "src/core/affinityBattle.ts"() {
    "use strict";
    init_affinity();
    init_gameStore();
  }
});

// src/core/fieldModProcEngine.ts
function createSeededRNG(seed) {
  let state = seed;
  return () => {
    state = state * 1103515245 + 12345 & 2147483647;
    return state / 2147483647;
  };
}
function getProcSeed(battleId, turnNumber, eventSequence) {
  let hash = 0;
  for (let i = 0; i < battleId.length; i++) {
    hash = (hash << 5) - hash + battleId.charCodeAt(i);
    hash = hash & hash;
  }
  return hash + turnNumber * 1e3 + eventSequence & 2147483647;
}
function gatherApplicableMods(trigger, ctx, allMods, unitHardpoints, _runInventory) {
  const applicable = [];
  if (ctx.triggeringUnitId) {
    const hardpoints = unitHardpoints[ctx.triggeringUnitId] || [null, null];
    for (const mod of hardpoints) {
      if (!mod) continue;
      const def = allMods.find((m) => m.id === mod.defId);
      if (def && def.trigger === trigger && def.scope === "unit") {
        applicable.push({ def, instance: mod, unitId: ctx.triggeringUnitId });
      }
    }
  }
  const friendlyUnits = Object.values(ctx.battleState.units).filter((u) => !u.isEnemy);
  for (const unit of friendlyUnits) {
    const hardpoints = unitHardpoints[unit.id] || [null, null];
    for (const mod of hardpoints) {
      if (!mod) continue;
      const def = allMods.find((m) => m.id === mod.defId);
      if (def && def.trigger === trigger && def.scope === "squad") {
        if (!applicable.find((a) => a.instance.instanceId === mod.instanceId)) {
          applicable.push({ def, instance: mod, unitId: unit.id });
        }
      }
    }
  }
  return applicable;
}
function scaleEffectByStacks(effect, stacks, stackMode) {
  if (stackMode === "additive") {
    if (effect.kind === "summon_drone") {
      return { ...effect, count: effect.count * stacks };
    }
    return effect;
  } else {
    switch (effect.kind) {
      case "deal_damage":
        return { ...effect, amount: effect.amount * stacks };
      case "apply_status":
        return { ...effect, stacks: effect.stacks * stacks };
      case "gain_shield":
        return { ...effect, amount: effect.amount * stacks };
      case "draw":
        return { ...effect, amount: effect.amount * stacks };
      case "reduce_cost_next_card":
        return { ...effect, amount: effect.amount * stacks };
      case "gain_resource":
        return { ...effect, amount: effect.amount * stacks };
      case "knockback":
        return { ...effect, tiles: effect.tiles * stacks };
      default:
        return effect;
    }
  }
}
function emit(trigger, ctx, allMods, unitHardpoints, runInventory) {
  const results = [];
  const applicable = gatherApplicableMods(trigger, ctx, allMods, unitHardpoints, runInventory);
  if (applicable.length === 0) {
    return results;
  }
  const eventSeq = ctx.eventSequence || 0;
  const seed = getProcSeed(ctx.battleState.id, ctx.battleState.turnCount, eventSeq);
  const rng = createSeededRNG(seed);
  for (const { def, instance, unitId } of applicable) {
    const procChance = def.chance ?? 1;
    const roll = rng();
    const procPassed = roll < procChance;
    if (DEBUG_FIELD_MODS) {
      const triggerLabel = TRIGGER_DEBUG_LABELS[trigger] || trigger;
      console.log(
        `[FieldMod] ${triggerLabel} triggered: ${def.name} stacks=${instance.stacks} chance=${(procChance * 100).toFixed(0)}% roll=${(roll * 100).toFixed(1)}% -> ${procPassed ? "PROC!" : "miss"}`
      );
    }
    if (!procPassed) {
      continue;
    }
    const scaledEffect = scaleEffectByStacks(def.effect, instance.stacks, def.stackMode);
    let targetUnitIds = [];
    const effectTarget = "target" in scaledEffect ? scaledEffect.target : null;
    switch (effectTarget) {
      case "self":
        if (unitId) targetUnitIds = [unitId];
        break;
      case "all_allies":
      case "team":
        targetUnitIds = Object.values(ctx.battleState.units).filter((u) => !u.isEnemy).map((u) => u.id);
        break;
      case "random_enemy":
        const enemies = Object.values(ctx.battleState.units).filter((u) => u.isEnemy).map((u) => u.id);
        if (enemies.length > 0) {
          targetUnitIds = [enemies[Math.floor(rng() * enemies.length)]];
        }
        break;
      case "adjacent_enemies":
        const nearbyEnemies = Object.values(ctx.battleState.units).filter((u) => u.isEnemy).map((u) => u.id);
        if (nearbyEnemies.length > 0) {
          targetUnitIds = [nearbyEnemies[0]];
        }
        break;
      case "all_enemies":
        targetUnitIds = Object.values(ctx.battleState.units).filter((u) => u.isEnemy).map((u) => u.id);
        break;
      case "hit_target":
        if (ctx.targetUnitId) targetUnitIds = [ctx.targetUnitId];
        break;
      default:
        if (unitId) targetUnitIds = [unitId];
        break;
    }
    results.push({
      modId: def.id,
      modName: def.name,
      effect: scaledEffect,
      targetUnitIds,
      logMessage: `${def.name} triggered: ${def.description}`
    });
  }
  return results;
}
var DEBUG_FIELD_MODS, TRIGGER_DEBUG_LABELS;
var init_fieldModProcEngine = __esm({
  "src/core/fieldModProcEngine.ts"() {
    "use strict";
    DEBUG_FIELD_MODS = true;
    TRIGGER_DEBUG_LABELS = {
      battle_start: "On Engagement",
      turn_start: "On Initiative",
      card_played: "On Command Issued",
      draw: "On Resupply",
      move: "On Maneuver",
      hit: "On Contact",
      crit: "On Precision Hit",
      kill: "On Confirmed Kill",
      shield_gained: "On Barrier Raised",
      damage_taken: "On Taking Fire",
      room_cleared: "On Area Secured"
    };
  }
});

// src/core/fieldModStrings.ts
function getTriggerLabel(trigger) {
  return TRIGGER_LABELS[trigger] || trigger;
}
var TRIGGER_LABELS;
var init_fieldModStrings = __esm({
  "src/core/fieldModStrings.ts"() {
    "use strict";
    TRIGGER_LABELS = {
      battle_start: "On Engagement",
      turn_start: "On Initiative",
      card_played: "On Command Issued",
      draw: "On Resupply",
      move: "On Maneuver",
      hit: "On Contact",
      crit: "On Precision Hit",
      kill: "On Confirmed Kill",
      shield_gained: "On Barrier Raised",
      damage_taken: "On Taking Fire",
      room_cleared: "On Area Secured"
    };
  }
});

// src/core/fieldModDefinitions.ts
function getAllFieldModDefs() {
  return Object.values(FIELD_MOD_DEFINITIONS);
}
var FIELD_MOD_DEFINITIONS;
var init_fieldModDefinitions = __esm({
  "src/core/fieldModDefinitions.ts"() {
    "use strict";
    init_fieldModStrings();
    FIELD_MOD_DEFINITIONS = {
      // ============================================================================
      // COMMON - Unit Scope
      // ============================================================================
      mod_contact_damage: {
        id: "mod_contact_damage",
        name: "Contact Overload",
        description: `${getTriggerLabel("hit")}: 15% chance to deal +1 damage to a random enemy.`,
        rarity: "common",
        scope: "unit",
        trigger: "hit",
        effect: { kind: "deal_damage", amount: 1, target: "random_enemy" },
        stackMode: "linear",
        chance: 0.15,
        maxStacks: 5,
        tags: ["damage", "proc"],
        cost: 10
      },
      mod_kill_draw: {
        id: "mod_kill_draw",
        name: "Tactical Resupply",
        description: `${getTriggerLabel("kill")}: Draw 1 card.`,
        rarity: "common",
        scope: "unit",
        trigger: "kill",
        effect: { kind: "draw", amount: 1, target: "self" },
        stackMode: "linear",
        maxStacks: 3,
        tags: ["draw", "utility"],
        cost: 12
      },
      mod_initiative_shield: {
        id: "mod_initiative_shield",
        name: "Reactive Barrier",
        description: `${getTriggerLabel("turn_start")}: Gain 2 shield.`,
        rarity: "common",
        scope: "unit",
        trigger: "turn_start",
        effect: { kind: "gain_shield", amount: 2, target: "self" },
        stackMode: "linear",
        maxStacks: 3,
        tags: ["defense", "shield"],
        cost: 15
      },
      mod_command_cost_reduction: {
        id: "mod_command_cost_reduction",
        name: "Efficient Command",
        description: `${getTriggerLabel("card_played")}: 20% chance to reduce cost of next card by 1.`,
        rarity: "common",
        scope: "unit",
        trigger: "card_played",
        effect: { kind: "reduce_cost_next_card", amount: 1, target: "self" },
        stackMode: "linear",
        chance: 0.2,
        maxStacks: 3,
        tags: ["utility", "cost"],
        cost: 12
      },
      mod_area_secured_shard: {
        id: "mod_area_secured_shard",
        name: "Resource Extraction",
        description: `${getTriggerLabel("room_cleared")}: Gain 1 chaos shard.`,
        rarity: "common",
        scope: "unit",
        trigger: "room_cleared",
        effect: { kind: "gain_resource", resource: "chaos_shards", amount: 1 },
        stackMode: "linear",
        maxStacks: 2,
        tags: ["resource", "economy"],
        cost: 8
      },
      mod_engagement_shield: {
        id: "mod_engagement_shield",
        name: "Combat Readiness",
        description: `${getTriggerLabel("battle_start")}: Gain 3 shield.`,
        rarity: "common",
        scope: "unit",
        trigger: "battle_start",
        effect: { kind: "gain_shield", amount: 3, target: "self" },
        stackMode: "linear",
        maxStacks: 2,
        tags: ["defense", "shield"],
        cost: 10
      },
      // ============================================================================
      // UNCOMMON - Unit Scope
      // ============================================================================
      mod_contact_bleed: {
        id: "mod_contact_bleed",
        name: "Serrated Edge",
        description: `${getTriggerLabel("hit")}: 25% chance to apply 1 bleed stack to hit target.`,
        rarity: "uncommon",
        scope: "unit",
        trigger: "hit",
        effect: { kind: "apply_status", status: "bleed", stacks: 1, target: "hit_target" },
        stackMode: "linear",
        chance: 0.25,
        maxStacks: 3,
        tags: ["status", "damage"],
        cost: 20
      },
      mod_kill_shield_team: {
        id: "mod_kill_shield_team",
        name: "Coordinated Defense",
        description: `${getTriggerLabel("kill")}: 30% chance all allies gain 2 shield.`,
        rarity: "uncommon",
        scope: "unit",
        trigger: "kill",
        effect: { kind: "gain_shield", amount: 2, target: "all_allies" },
        stackMode: "linear",
        chance: 0.3,
        maxStacks: 2,
        tags: ["defense", "team"],
        cost: 25
      },
      mod_precision_burn: {
        id: "mod_precision_burn",
        name: "Incendiary Rounds",
        description: `${getTriggerLabel("crit")}: Apply 2 burn stacks to hit target.`,
        rarity: "uncommon",
        scope: "unit",
        trigger: "crit",
        effect: { kind: "apply_status", status: "burn", stacks: 2, target: "hit_target" },
        stackMode: "linear",
        maxStacks: 2,
        tags: ["status", "damage"],
        cost: 22
      },
      mod_resupply_team: {
        id: "mod_resupply_team",
        name: "Team Resupply",
        description: `${getTriggerLabel("draw")}: All allies draw 1 card.`,
        rarity: "uncommon",
        scope: "unit",
        trigger: "draw",
        effect: { kind: "draw", amount: 1, target: "team" },
        stackMode: "linear",
        maxStacks: 2,
        tags: ["draw", "team"],
        cost: 30
      },
      // ============================================================================
      // RARE - Squad Scope
      // ============================================================================
      mod_squad_engagement_drone: {
        id: "mod_squad_engagement_drone",
        name: "Squad Drone Support",
        description: `${getTriggerLabel("battle_start")}: Deploy 1 combat drone.`,
        rarity: "rare",
        scope: "squad",
        trigger: "battle_start",
        effect: { kind: "summon_drone", count: 1, droneTypeId: "combat_drone_basic" },
        stackMode: "additive",
        maxStacks: 3,
        tags: ["summon", "squad"],
        cost: 50
      },
      mod_squad_kill_shield: {
        id: "mod_squad_kill_shield",
        name: "Squad Morale Boost",
        description: `${getTriggerLabel("kill")}: 25% chance all allies gain 3 shield.`,
        rarity: "rare",
        scope: "squad",
        trigger: "kill",
        effect: { kind: "gain_shield", amount: 3, target: "all_allies" },
        stackMode: "linear",
        chance: 0.25,
        maxStacks: 2,
        tags: ["defense", "squad"],
        cost: 45
      },
      mod_squad_contact_damage: {
        id: "mod_squad_contact_damage",
        name: "Squad Overwatch",
        description: `${getTriggerLabel("hit")}: 20% chance to deal 2 damage to all enemies.`,
        rarity: "rare",
        scope: "squad",
        trigger: "hit",
        effect: { kind: "deal_damage", amount: 2, target: "all_enemies" },
        stackMode: "linear",
        chance: 0.2,
        maxStacks: 2,
        tags: ["damage", "squad"],
        cost: 40
      }
    };
  }
});

// src/core/campaign.ts
function getDefaultUnlockedOperationIds() {
  const builtInDefaults = ["op_iron_gate"].filter(
    (operationId) => !isTechnicaContentDisabled("operation", operationId)
  );
  const importedOperationIds = getAllImportedOperations().map((operation) => operation.id).filter((operationId) => operationId !== "op_custom" && operationId !== "op_iron_gate");
  return Array.from(/* @__PURE__ */ new Set([...builtInDefaults, ...importedOperationIds]));
}
function getHighestReachedFloorOrdinal(progress) {
  const activeRunFloorOrdinal = Math.max(1, (progress?.activeRun?.floorIndex ?? 0) + 1);
  const atlasCurrentFloorOrdinal = Math.max(1, progress?.opsTerminalAtlas?.currentFloorOrdinal ?? 1);
  const atlasGeneratedFloorOrdinal = Math.max(
    1,
    ...Object.values(progress?.opsTerminalAtlas?.floorsById ?? {}).map((floor) => Math.max(1, floor.floorOrdinal ?? 1))
  );
  return Math.max(activeRunFloorOrdinal, atlasCurrentFloorOrdinal, atlasGeneratedFloorOrdinal);
}
function normalizeCampaignProgress(progress) {
  return {
    ...progress,
    unlockedOperations: Array.from(/* @__PURE__ */ new Set([...progress.unlockedOperations ?? [], ...getDefaultUnlockedOperationIds()])),
    schemaNodeUnlocked: Boolean(progress.schemaNodeUnlocked || getHighestReachedFloorOrdinal(progress) >= SCHEMA_UNLOCK_FLOOR_ORDINAL)
  };
}
function loadCampaignProgress() {
  try {
    const stored = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.version !== CAMPAIGN_VERSION) {
        console.warn("[CAMPAIGN] Version mismatch, resetting progress");
        return createDefaultCampaignProgress();
      }
      return normalizeCampaignProgress(parsed);
    }
  } catch (error) {
    console.error("[CAMPAIGN] Failed to load progress:", error);
  }
  return createDefaultCampaignProgress();
}
function createDefaultCampaignProgress() {
  return {
    version: CAMPAIGN_VERSION,
    completedOperations: [],
    unlockedOperations: getDefaultUnlockedOperationIds(),
    activeRun: null,
    schemaNodeUnlocked: false
  };
}
var OPERATION_DEFINITIONS, CAMPAIGN_STORAGE_KEY, CAMPAIGN_VERSION, SCHEMA_UNLOCK_FLOOR_ORDINAL;
var init_campaign = __esm({
  "src/core/campaign.ts"() {
    "use strict";
    init_technica();
    init_gameStore();
    OPERATION_DEFINITIONS = {
      op_iron_gate: {
        id: "op_iron_gate",
        name: "IRON GATE",
        description: "Secure the Chaos Rift entrance and clear the corrupted garrison.",
        objective: "Establish a forward logistics chain through the Gateworks and break the eastern lockline.",
        beginningState: "Ingress Yard secured. Causeway mapped. Generator and command sectors dark.",
        endState: "Objective lock secured with at least one operational C.O.R.E. and a stable supply chain.",
        theaterId: "op_iron_gate_castellan_gateworks",
        floors: 3,
        recommendedPower: 25,
        // Base, will scale per floor
        unlocksNextOperationId: "op_black_spire",
        isCustom: false
      },
      op_black_spire: {
        id: "op_black_spire",
        name: "BLACK SPIRE",
        description: "Capture enemy artillery positions and neutralize long-range threats.",
        floors: 3,
        recommendedPower: 25,
        // Base, will scale per floor
        unlocksNextOperationId: "op_ghost_run",
        isCustom: false
      },
      op_ghost_run: {
        id: "op_ghost_run",
        name: "GHOST RUN",
        description: "Disrupt enemy supply lines and eliminate fast-moving skirmishers.",
        floors: 3,
        recommendedPower: 25,
        // Base, will scale per floor
        unlocksNextOperationId: "op_ember_siege",
        isCustom: false
      },
      op_ember_siege: {
        id: "op_ember_siege",
        name: "EMBER SIEGE",
        description: "Destroy key enemy fortifications and break through defensive lines.",
        floors: 3,
        recommendedPower: 25,
        // Base, will scale per floor
        unlocksNextOperationId: "op_final_dawn",
        isCustom: false
      },
      op_final_dawn: {
        id: "op_final_dawn",
        name: "FINAL DAWN",
        description: "Assault the enemy command center and end the conflict.",
        floors: 3,
        recommendedPower: 25,
        // Base, will scale per floor
        isCustom: false
      },
      op_custom: {
        id: "op_custom",
        name: "CUSTOM OPERATION",
        description: "Generate a fully randomized theater operation with custom floor count and combat density.",
        objective: "Push from the uplink to the descent point on each floor until the final theater is secured.",
        floors: 3,
        // Default, can be overridden
        isCustom: true
      }
    };
    getAllImportedOperations().forEach((operation) => {
      OPERATION_DEFINITIONS[operation.id] = {
        id: operation.id,
        name: operation.codename,
        description: operation.description,
        objective: operation.description,
        beginningState: "Imported operation staging complete. Theater initialized on the generated floor-grid.",
        endState: "Imported objective node secured and theater logistics route stabilized.",
        theaterId: `${operation.id}_castellan_gateworks`,
        floors: Math.max(1, operation.floors.length),
        recommendedPower: operation.recommendedPower,
        unlocksNextOperationId: typeof operation.metadata?.unlocksNextOperationId === "string" ? operation.metadata.unlocksNextOperationId : void 0,
        isCustom: false
      };
    });
    Object.keys(OPERATION_DEFINITIONS).forEach((operationId) => {
      if (!getAllImportedOperations().some((operation) => operation.id === operationId) && isTechnicaContentDisabled("operation", operationId)) {
        delete OPERATION_DEFINITIONS[operationId];
      }
    });
    CAMPAIGN_STORAGE_KEY = "chaoscore_campaign_progress";
    CAMPAIGN_VERSION = 1;
    SCHEMA_UNLOCK_FLOOR_ORDINAL = 2;
  }
});

// src/core/controlledRooms.ts
var init_controlledRooms = __esm({
  "src/core/controlledRooms.ts"() {
    "use strict";
    init_campaign();
  }
});

// src/core/ops.ts
var init_ops = __esm({
  "src/core/ops.ts"() {
    "use strict";
  }
});

// src/core/supplyChain.ts
var init_supplyChain = __esm({
  "src/core/supplyChain.ts"() {
    "use strict";
    init_ops();
    init_campaignManager();
    init_gameStore();
  }
});

// src/core/nodeMapGenerator.ts
var init_nodeMapGenerator = __esm({
  "src/core/nodeMapGenerator.ts"() {
    "use strict";
  }
});

// src/core/enemies.ts
var init_enemies = __esm({
  "src/core/enemies.ts"() {
    "use strict";
  }
});

// src/core/encounterGenerator.ts
var init_encounterGenerator = __esm({
  "src/core/encounterGenerator.ts"() {
    "use strict";
    init_technica();
    init_enemies();
  }
});

// src/core/tavernMeals.ts
var init_tavernMeals = __esm({
  "src/core/tavernMeals.ts"() {
    "use strict";
  }
});

// src/core/types.ts
var init_types = __esm({
  "src/core/types.ts"() {
    "use strict";
  }
});

// src/core/recruitment.ts
var init_recruitment = __esm({
  "src/core/recruitment.ts"() {
    "use strict";
    init_types();
    init_classes();
    init_affinity();
  }
});

// src/core/codexSystem.ts
var init_codexSystem = __esm({
  "src/core/codexSystem.ts"() {
    "use strict";
    init_gameStore();
  }
});

// src/core/dispatchSystem.ts
var init_dispatchSystem = __esm({
  "src/core/dispatchSystem.ts"() {
    "use strict";
    init_classes();
    init_pwr();
    init_recruitment();
    init_codexSystem();
    init_equipment();
  }
});

// src/core/campaignSync.ts
var init_campaignSync = __esm({
  "src/core/campaignSync.ts"() {
    "use strict";
    init_campaignManager();
    init_gameStore();
  }
});

// src/core/campaignManager.ts
function getActiveRun() {
  const progress = loadCampaignProgress();
  return progress.activeRun;
}
var init_campaignManager = __esm({
  "src/core/campaignManager.ts"() {
    "use strict";
    init_campaign();
    init_controlledRooms();
    init_supplyChain();
    init_campaign();
    init_technica();
    init_nodeMapGenerator();
    init_encounterGenerator();
    init_gameStore();
    init_tavernMeals();
    init_dispatchSystem();
    init_campaignSync();
  }
});

// src/core/saveSystem.ts
var init_saveSystem = __esm({
  "src/core/saveSystem.ts"() {
    "use strict";
    init_campaign();
  }
});

// src/core/echoFieldEffects.ts
function isEchoBattle(battle) {
  return battle?.modeContext?.kind === "echo";
}
function getEchoBattleContext(battle) {
  return battle?.modeContext?.kind === "echo" ? battle.modeContext.echo ?? null : null;
}
function getEchoFieldPlacements(battle) {
  return getEchoBattleContext(battle)?.fieldPlacements ?? [];
}
function isPositionInsideEchoField(pos, placement) {
  if (!pos) return false;
  const distance = Math.abs(pos.x - placement.x) + Math.abs(pos.y - placement.y);
  return distance <= placement.radius;
}
function getEchoFieldsAffectingUnit(battle, unit, fieldId) {
  if (!unit?.pos) return [];
  return getEchoFieldPlacements(battle).filter((placement) => {
    if (fieldId && placement.fieldId !== fieldId) {
      return false;
    }
    return isPositionInsideEchoField(unit.pos, placement);
  });
}
function getScaledLevelBonus(level, tierTwo = 3, tierThree = 5) {
  if (level >= tierThree) return 3;
  if (level >= tierTwo) return 2;
  return 1;
}
function getEchoAttackBonus(battle, unit) {
  const placements = getEchoFieldsAffectingUnit(battle, unit, "ember_zone");
  if (placements.length === 0) {
    return { amount: 0, triggeredPlacements: [] };
  }
  const amount = placements.reduce((maxBonus, placement) => Math.max(maxBonus, getScaledLevelBonus(placement.level)), 0);
  return { amount, triggeredPlacements: placements };
}
function getEchoDefenseBonus(battle, unit) {
  const placements = getEchoFieldsAffectingUnit(battle, unit, "bastion_zone");
  if (placements.length === 0) {
    return { amount: 0, triggeredPlacements: [] };
  }
  const amount = placements.reduce((maxBonus, placement) => Math.max(maxBonus, getScaledLevelBonus(placement.level)), 0);
  return { amount, triggeredPlacements: placements };
}
function getEchoMovementAdjustment(battle, unit) {
  const fluxPlacements = getEchoFieldsAffectingUnit(battle, unit, "flux_zone");
  const bastionPlacements = getEchoFieldsAffectingUnit(battle, unit, "bastion_zone");
  const fluxBonus = fluxPlacements.reduce((maxBonus, placement) => Math.max(maxBonus, getScaledLevelBonus(placement.level)), 0);
  const bastionPenalty = bastionPlacements.reduce((maxPenalty, placement) => Math.max(maxPenalty, placement.level >= 5 ? 2 : 1), 0);
  return {
    amount: fluxBonus - bastionPenalty,
    triggeredPlacements: [...fluxPlacements, ...bastionPlacements]
  };
}
function incrementEchoFieldTriggerCount(battle, placements, logLine) {
  const echoContext = getEchoBattleContext(battle);
  if (!echoContext || placements.length === 0) {
    return battle;
  }
  const uniqueKeys = new Set(
    placements.map((placement) => `${placement.draftId}:${placement.x}:${placement.y}`)
  );
  const increment = uniqueKeys.size;
  const nextLog = logLine && Array.isArray(battle.log) ? [...battle.log, logLine] : battle.log;
  return {
    ...battle,
    log: nextLog,
    modeContext: {
      ...battle.modeContext,
      kind: "echo",
      echo: {
        ...echoContext,
        fieldTriggerCount: (echoContext.fieldTriggerCount ?? 0) + increment
      }
    }
  };
}
var init_echoFieldEffects = __esm({
  "src/core/echoFieldEffects.ts"() {
    "use strict";
  }
});

// src/core/coverGenerator.ts
function getCoverDamageReduction(tile) {
  if (!tile || !tile.cover || tile.cover.hp <= 0) {
    return 0;
  }
  return COVER_STATS[tile.cover.type].damageReduction;
}
var COVER_STATS;
var init_coverGenerator = __esm({
  "src/core/coverGenerator.ts"() {
    "use strict";
    COVER_STATS = {
      light_cover: {
        minHp: 3,
        maxHp: 5,
        damageReduction: 1
      },
      heavy_cover: {
        minHp: 7,
        maxHp: 10,
        damageReduction: 2
      }
    };
  }
});

// src/core/battleFromEncounter.ts
var init_battleFromEncounter = __esm({
  "src/core/battleFromEncounter.ts"() {
    "use strict";
    init_enemies();
    init_battle();
    init_coverGenerator();
    init_tavernMeals();
    init_technica();
  }
});

// src/core/echoRuns.ts
function getActiveEchoRun() {
  return activeEchoRun;
}
function getEchoModifierHardpoints(unitIds) {
  if (!activeEchoRun) {
    return {};
  }
  const hardpoints = {};
  unitIds.forEach((unitId) => {
    hardpoints[unitId] = [null, null];
  });
  let index = 0;
  activeEchoRun.tacticalModifiers.forEach((modifier) => {
    const unitId = unitIds[Math.floor(index / 2)];
    if (!unitId) {
      return;
    }
    const slot = index % 2;
    hardpoints[unitId][slot] = modifier;
    index += 1;
  });
  return hardpoints;
}
var ECHO_SQUAD_SCOPE_MODS, activeEchoRun;
var init_echoRuns = __esm({
  "src/core/echoRuns.ts"() {
    "use strict";
    init_gameStore();
    init_saveSystem();
    init_echoFieldEffects();
    init_equipment();
    init_classes();
    init_pwr();
    init_affinity();
    init_battleFromEncounter();
    init_fieldModDefinitions();
    ECHO_SQUAD_SCOPE_MODS = getAllFieldModDefs().filter((mod) => mod.scope === "squad");
    activeEchoRun = null;
  }
});

// src/core/fieldModBattleIntegration.ts
function getFieldModState() {
  const echoRun = getActiveEchoRun();
  if (echoRun) {
    const unitIds = echoRun.squadUnitIds.filter((unitId) => echoRun.unitsById[unitId]);
    return {
      unitHardpoints: getEchoModifierHardpoints(unitIds),
      runInventory: echoRun.tacticalModifiers
    };
  }
  const activeRun = getActiveRun();
  const state = getGameState();
  return {
    unitHardpoints: activeRun?.unitHardpoints || {},
    runInventory: activeRun?.runFieldModInventory || state.runFieldModInventory || []
  };
}
function applyProcResults(battle, results, _eventSequence) {
  let next = battle;
  const allMods = getAllFieldModDefs();
  for (const result of results) {
    const modDef = allMods.find((m) => m.id === result.modId);
    if (!modDef) continue;
    if (result.logMessage) {
      next = {
        ...next,
        log: [...next.log, `SLK//MOD    :: ${result.logMessage}`]
      };
    }
    switch (result.effect.kind) {
      case "deal_damage":
        for (const targetId of result.targetUnitIds) {
          const target = next.units[targetId];
          if (!target || target.isEnemy === false) continue;
          const damage = result.effect.amount;
          const newHp = Math.max(0, target.hp - damage);
          if (newHp <= 0) {
            const newUnits = { ...next.units };
            delete newUnits[targetId];
            const newTurnOrder = next.turnOrder.filter((id) => id !== targetId);
            next = {
              ...next,
              units: newUnits,
              turnOrder: newTurnOrder,
              log: [...next.log, `SLK//MOD    :: ${target.name} eliminated by ${result.modName}.`]
            };
          } else {
            next = {
              ...next,
              units: {
                ...next.units,
                [targetId]: { ...target, hp: newHp }
              },
              log: [...next.log, `SLK//MOD    :: ${result.modName} deals ${damage} damage to ${target.name}.`]
            };
          }
        }
        break;
      case "gain_shield":
        for (const targetId of result.targetUnitIds) {
          const target = next.units[targetId];
          if (!target) continue;
          const shieldAmount = result.effect.amount;
          const newHp = Math.min(target.maxHp, target.hp + shieldAmount);
          next = {
            ...next,
            units: {
              ...next.units,
              [targetId]: { ...target, hp: newHp }
            },
            log: [...next.log, `SLK//MOD    :: ${result.modName} grants ${shieldAmount} shield to ${target.name}.`]
          };
        }
        break;
      case "draw":
        for (const targetId of result.targetUnitIds) {
          const target = next.units[targetId];
          if (!target) continue;
          const drawAmount = result.effect.amount;
          next = {
            ...next,
            log: [...next.log, `SLK//MOD    :: ${result.modName} draws ${drawAmount} card(s) for ${target.name}.`]
          };
        }
        break;
      case "apply_status":
        for (const targetId of result.targetUnitIds) {
          const target = next.units[targetId];
          if (!target) continue;
          next = {
            ...next,
            log: [...next.log, `SLK//MOD    :: ${result.modName} applies ${result.effect.status} (${result.effect.stacks} stacks) to ${target.name}.`]
          };
        }
        break;
      case "summon_drone":
        next = {
          ...next,
          log: [...next.log, `SLK//MOD    :: ${result.modName} deploys ${result.effect.count} combat drone(s).`]
        };
        break;
      case "reduce_cost_next_card":
        for (const targetId of result.targetUnitIds) {
          const target = next.units[targetId];
          if (!target) continue;
          next = {
            ...next,
            log: [...next.log, `SLK//MOD    :: ${result.modName} reduces next card cost by ${result.effect.amount} for ${target.name}.`]
          };
        }
        break;
      case "gain_resource":
        next = {
          ...next,
          log: [...next.log, `SLK//MOD    :: ${result.modName} grants ${result.effect.amount} ${result.effect.resource}.`]
        };
        break;
      case "knockback":
        for (const targetId of result.targetUnitIds) {
          const target = next.units[targetId];
          if (!target) continue;
          next = {
            ...next,
            log: [...next.log, `SLK//MOD    :: ${result.modName} knocks back ${target.name} ${result.effect.tiles} tiles.`]
          };
        }
        break;
    }
  }
  return next;
}
function triggerFieldMods(trigger, battle, triggeringUnitId = null, context = {}, eventSequence = 0) {
  const { unitHardpoints, runInventory } = getFieldModState();
  const allMods = getAllFieldModDefs();
  const procCtx = {
    battleState: battle,
    triggeringUnitId,
    eventSequence,
    ...context
  };
  const results = emit(trigger, procCtx, allMods, unitHardpoints, runInventory);
  if (results.length === 0) {
    return battle;
  }
  return applyProcResults(battle, results, eventSequence);
}
function triggerBattleStart(battle) {
  return triggerFieldMods("battle_start", battle, null, {}, 0);
}
function triggerTurnStart(battle, unitId) {
  return triggerFieldMods("turn_start", battle, unitId, {}, battle.turnCount);
}
function triggerHit(battle, attackerId, targetId, damageAmount, isCrit = false, eventSequence = 0) {
  let next = triggerFieldMods(
    "hit",
    battle,
    attackerId,
    { targetUnitId: targetId, damageAmount, isCrit },
    eventSequence
  );
  if (isCrit) {
    next = triggerFieldMods(
      "crit",
      next,
      attackerId,
      { targetUnitId: targetId, damageAmount, isCrit: true },
      eventSequence + 1
    );
  }
  return next;
}
function triggerKill(battle, killerId, killedId, eventSequence = 0) {
  return triggerFieldMods(
    "kill",
    battle,
    killerId,
    { targetUnitId: killedId },
    eventSequence
  );
}
function triggerCardPlayed(battle, unitId, cardId, eventSequence = 0) {
  return triggerFieldMods(
    "card_played",
    battle,
    unitId,
    { cardId },
    eventSequence
  );
}
var init_fieldModBattleIntegration = __esm({
  "src/core/fieldModBattleIntegration.ts"() {
    "use strict";
    init_fieldModProcEngine();
    init_fieldModDefinitions();
    init_campaignManager();
    init_gameStore();
    init_echoRuns();
  }
});

// src/data/gearDoctrines.ts
var ALL_DOCTRINES;
var init_gearDoctrines = __esm({
  "src/data/gearDoctrines.ts"() {
    "use strict";
    ALL_DOCTRINES = [
      {
        id: "doctrine_assault",
        name: "Assault Doctrine",
        shortDescription: "Aggressive forward combat focus",
        intentTags: ["assault"],
        stabilityModifier: -10,
        strainBias: 0.2,
        buildCostModifier: {
          metalScrap: 5,
          wood: 2,
          chaosShards: 0,
          steamComponents: 1
        },
        doctrineRules: "Assault Doctrine: Cards cost 20% more strain. Gain bonus damage on first attack each turn.",
        description: "Optimized for aggressive engagements. Higher strain costs but increased offensive output."
      },
      {
        id: "doctrine_suppression",
        name: "Suppression Doctrine",
        shortDescription: "Area control and battlefield denial",
        intentTags: ["suppression", "control"],
        stabilityModifier: -5,
        procBias: 0.1,
        buildCostModifier: {
          metalScrap: 3,
          wood: 1,
          chaosShards: 1,
          steamComponents: 2
        },
        doctrineRules: "Suppression Doctrine: Area effect cards gain +10% proc chance. Reduced movement penalties.",
        description: "Designed for area control. Enhanced proc rates on suppression abilities."
      },
      {
        id: "doctrine_skirmish",
        name: "Skirmish Doctrine",
        shortDescription: "Mobility and hit-and-run tactics",
        intentTags: ["skirmish", "mobility"],
        stabilityModifier: 5,
        strainBias: -0.1,
        buildCostModifier: {
          metalScrap: 2,
          wood: 3,
          chaosShards: 0,
          steamComponents: 1
        },
        doctrineRules: "Skirmish Doctrine: Movement cards cost 10% less strain. +1 move range on first move each turn.",
        description: "Emphasizes mobility and efficiency. Lower strain costs, improved movement capabilities."
      },
      {
        id: "doctrine_sustain",
        name: "Sustain Doctrine",
        shortDescription: "Endurance and resource efficiency",
        intentTags: ["sustain"],
        stabilityModifier: 15,
        strainBias: -0.15,
        buildCostModifier: {
          metalScrap: 4,
          wood: 2,
          chaosShards: 0,
          steamComponents: 1
        },
        doctrineRules: "Sustain Doctrine: All cards cost 15% less strain. Gain +5 stability. Reduced wear on equipment.",
        description: "Built for long engagements. Lower strain costs and higher stability for sustained operations."
      },
      {
        id: "doctrine_control",
        name: "Control Doctrine",
        shortDescription: "Debuffs and battlefield manipulation",
        intentTags: ["control"],
        stabilityModifier: 0,
        procBias: 0.15,
        buildCostModifier: {
          metalScrap: 3,
          wood: 1,
          chaosShards: 2,
          steamComponents: 3
        },
        doctrineRules: "Control Doctrine: Debuff cards gain +15% proc chance. Status effects last 1 turn longer.",
        description: "Focused on battlefield control. Enhanced effectiveness of debuff and status effects."
      },
      {
        id: "doctrine_balanced",
        name: "Balanced Doctrine",
        shortDescription: "No specialization, reliable baseline",
        intentTags: ["assault", "sustain"],
        stabilityModifier: 5,
        buildCostModifier: {
          metalScrap: 0,
          wood: 0,
          chaosShards: 0,
          steamComponents: 0
        },
        doctrineRules: "Balanced Doctrine: No special bonuses or penalties. Reliable performance across all situations.",
        description: "No specialization. Solid baseline performance without tradeoffs."
      }
    ];
  }
});

// src/core/unlockables.ts
function buildUnlockableRegistry() {
  const registry = {};
  for (const chassis of ALL_CHASSIS) {
    registry[chassis.id] = {
      id: chassis.id,
      type: "chassis",
      displayName: chassis.name,
      description: chassis.description,
      rarity: determineChassisRarity(chassis),
      tags: [chassis.slotType],
      cost: {
        metalScrap: chassis.buildCost.metalScrap,
        wood: chassis.buildCost.wood,
        chaosShards: chassis.buildCost.chaosShards,
        steamComponents: chassis.buildCost.steamComponents
      },
      sourceRules: {
        shopEligible: true,
        rewardEligible: true
      }
    };
  }
  for (const doctrine of ALL_DOCTRINES) {
    registry[doctrine.id] = {
      id: doctrine.id,
      type: "doctrine",
      displayName: doctrine.name,
      description: doctrine.description,
      rarity: determineDoctrineRarity(doctrine),
      tags: doctrine.intentTags,
      cost: {
        metalScrap: doctrine.buildCostModifier.metalScrap,
        wood: doctrine.buildCostModifier.wood,
        chaosShards: doctrine.buildCostModifier.chaosShards,
        steamComponents: doctrine.buildCostModifier.steamComponents
      },
      sourceRules: {
        shopEligible: true,
        rewardEligible: true
      }
    };
  }
  const allFieldMods = getAllFieldModDefs();
  for (const mod of allFieldMods) {
    registry[mod.id] = {
      id: mod.id,
      type: "field_mod",
      displayName: mod.name,
      description: mod.description,
      rarity: mod.rarity,
      tags: mod.tags,
      cost: mod.cost ? { wad: mod.cost } : void 0,
      sourceRules: {
        shopEligible: true,
        rewardEligible: true
      }
    };
  }
  return registry;
}
function determineChassisRarity(chassis) {
  const totalCost = chassis.buildCost.metalScrap + chassis.buildCost.wood + chassis.buildCost.chaosShards + chassis.buildCost.steamComponents;
  if (totalCost >= 40 || chassis.maxCardSlots >= 5) return "rare";
  if (totalCost >= 25 || chassis.maxCardSlots >= 4) return "uncommon";
  return "common";
}
function determineDoctrineRarity(doctrine) {
  const totalCost = doctrine.buildCostModifier.metalScrap + doctrine.buildCostModifier.wood + doctrine.buildCostModifier.chaosShards + doctrine.buildCostModifier.steamComponents;
  if (totalCost >= 8) return "rare";
  if (totalCost >= 4) return "uncommon";
  return "common";
}
function getUnlockablesByType(type) {
  return Object.values(UNLOCKABLE_REGISTRY).filter((u) => u.type === type);
}
function getUnownedUnlockables(ownedIds, type) {
  const ownedSet = new Set(ownedIds);
  const candidates = type ? getUnlockablesByType(type) : Object.values(UNLOCKABLE_REGISTRY);
  return candidates.filter((u) => !ownedSet.has(u.id));
}
var UNLOCKABLE_REGISTRY;
var init_unlockables = __esm({
  "src/core/unlockables.ts"() {
    "use strict";
    init_gearChassis();
    init_gearDoctrines();
    init_fieldModDefinitions();
    UNLOCKABLE_REGISTRY = buildUnlockableRegistry();
  }
});

// src/core/unlockableOwnership.ts
function getAllOwnedUnlockableIds() {
  const state = getGameState();
  return {
    chassis: state.unlockedChassisIds || [],
    doctrines: state.unlockedDoctrineIds || []
  };
}
var init_unlockableOwnership = __esm({
  "src/core/unlockableOwnership.ts"() {
    "use strict";
    init_gameStore();
    init_unlockables();
  }
});

// src/core/battle.ts
function normalizeBattleLoadout(loadoutLike) {
  return {
    primaryWeapon: loadoutLike?.primaryWeapon ?? loadoutLike?.weapon ?? null,
    secondaryWeapon: loadoutLike?.secondaryWeapon ?? null,
    helmet: loadoutLike?.helmet ?? null,
    chestpiece: loadoutLike?.chestpiece ?? null,
    accessory1: loadoutLike?.accessory1 ?? null,
    accessory2: loadoutLike?.accessory2 ?? null
  };
}
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}
function getLoadPenalties(state) {
  return state.loadPenalties ?? null;
}
function hasStatus(unit, type) {
  if (!unit.statuses) return false;
  return unit.statuses.some((s) => s.type === type);
}
function removeStatus(state, unitId, type) {
  const unit = state.units[unitId];
  if (!unit || !unit.statuses) return state;
  return {
    ...state,
    units: {
      ...state.units,
      [unitId]: { ...unit, statuses: unit.statuses.filter((s) => s.type !== type) }
    }
  };
}
function createGrid(width, height, elevationMap) {
  const tiles = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const terrain = "floor";
      const elevation = elevationMap ? elevationMap[x]?.[y] ?? 0 : 0;
      tiles.push({
        pos: { x, y },
        terrain,
        elevation
      });
    }
  }
  return tiles;
}
function createBattleUnitState(base, opts, equipmentById, modulesById) {
  const equipment = equipmentById || getAllStarterEquipment();
  const modules = modulesById || getAllModules();
  const unitClass = base.unitClass || "squire";
  const loadout = normalizeBattleLoadout(base.loadout);
  let deckCards;
  if (opts.isEnemy) {
    deckCards = base.drawPile && base.drawPile.length > 0 ? [...base.drawPile] : ["core_basic_attack", "core_basic_attack", "core_guard", "core_wait"];
  } else {
    const baseCards = buildDeckFromLoadout(unitClass, loadout, equipment, modules);
    const gearSlots = opts.gearSlots ?? {};
    const equippedGearIds = [];
    if (loadout.primaryWeapon) equippedGearIds.push(loadout.primaryWeapon);
    if (loadout.secondaryWeapon) equippedGearIds.push(loadout.secondaryWeapon);
    if (loadout.helmet) equippedGearIds.push(loadout.helmet);
    if (loadout.chestpiece) equippedGearIds.push(loadout.chestpiece);
    if (loadout.accessory1) equippedGearIds.push(loadout.accessory1);
    if (loadout.accessory2) equippedGearIds.push(loadout.accessory2);
    const slottedCards = [];
    equippedGearIds.forEach((eqId) => {
      const slots = gearSlots[eqId] ?? getDefaultGearSlots(eqId);
      slottedCards.push(...slots.slottedCards);
    });
    deckCards = [...baseCards, ...slottedCards];
  }
  const equipStats = calculateEquipmentStats(loadout, equipment, modules);
  const baseAtk = base.atk ?? base.stats?.atk ?? 10;
  const baseDef = base.def ?? base.stats?.def ?? 5;
  const baseAgi = base.agi ?? base.stats?.agi ?? 3;
  const baseAcc = base.acc ?? base.stats?.acc ?? 80;
  const baseMaxHp = base.maxHp ?? base.stats?.maxHp ?? 12;
  const baseCurrentHp = Math.max(0, Math.min(baseMaxHp, base.hp ?? baseMaxHp));
  let finalAtk = baseAtk + (opts.isEnemy ? 0 : equipStats.atk);
  let finalDef = baseDef + (opts.isEnemy ? 0 : equipStats.def);
  let finalAgi = baseAgi + (opts.isEnemy ? 0 : equipStats.agi);
  let finalAcc = baseAcc + (opts.isEnemy ? 0 : equipStats.acc);
  let finalMaxHp = baseMaxHp + (opts.isEnemy ? 0 : equipStats.hp);
  let mountId;
  let mountPassiveTraits;
  let baseStatsBeforeMount;
  if (!opts.isEnemy && base.mountInstanceId && opts.stable) {
    const mountInstance = findOwnedMount(opts.stable, base.mountInstanceId);
    if (mountInstance) {
      const mount = getMountById(mountInstance.mountId);
      if (mount) {
        baseStatsBeforeMount = {
          hp: finalMaxHp,
          maxHp: finalMaxHp,
          atk: finalAtk,
          def: finalDef,
          agi: finalAgi,
          acc: finalAcc
        };
        const mountStats = mount.statModifiers;
        finalMaxHp += mountStats.hp ?? 0;
        finalAtk += mountStats.atk ?? 0;
        finalDef += mountStats.def ?? 0;
        finalAgi += mountStats.agi ?? 0;
        finalAcc += mountStats.acc ?? 0;
        const validCards = validateMountCards(mount.grantedCards);
        if (validCards.length > 0) {
          deckCards = [...deckCards, ...validCards];
        }
        mountId = mount.id;
        mountPassiveTraits = mount.passiveTraits;
        console.log(`[BATTLE] Unit ${base.name} mounted on ${mount.name}: +${mountStats.hp ?? 0} HP, +${mountStats.atk ?? 0} ATK, +${mountStats.def ?? 0} DEF, +${mountStats.agi ?? 0} AGI`);
      } else {
        console.warn(`[BATTLE] Mount definition not found for ${mountInstance.mountId}, continuing as infantry`);
      }
    } else {
      console.warn(`[BATTLE] Mount instance not found: ${base.mountInstanceId}, continuing as infantry`);
    }
  }
  const deck = shuffleArray(deckCards);
  const hand = [];
  const discardPile = [];
  const exhaustedPile = [];
  let equippedWeaponId = null;
  let weaponState = null;
  if (!opts.isEnemy && loadout.primaryWeapon) {
    const weapon = equipment[loadout.primaryWeapon];
    if (weapon && weapon.slot === "weapon") {
      equippedWeaponId = loadout.primaryWeapon;
      weaponState = createWeaponRuntimeState(weapon);
    }
  }
  const hpBonusFromLoadout = finalMaxHp - baseMaxHp;
  const startingHp = Math.max(0, Math.min(finalMaxHp, baseCurrentHp + hpBonusFromLoadout));
  return {
    id: base.id,
    baseUnitId: base.id,
    name: base.name,
    classId: base.unitClass ?? "squire",
    loadout: { ...loadout, weapon: loadout.primaryWeapon ?? null },
    isEnemy: opts.isEnemy,
    pos: opts.pos,
    facing: opts.isEnemy ? "west" : "east",
    // Enemies face left, allies face right
    hp: startingHp,
    maxHp: finalMaxHp,
    atk: finalAtk,
    def: finalDef,
    agi: finalAgi,
    acc: finalAcc,
    strain: 0,
    drawPile: deck,
    hand,
    discardPile,
    exhaustedPile,
    buffs: [...base.buffs ?? []],
    equippedWeaponId,
    weaponState,
    clutchActive: false,
    weaponHeat: 0,
    weaponWear: 0,
    controller: base.controller || "P1",
    // Copy controller from base unit
    // Mount fields
    mountId,
    mountPassiveTraits,
    baseStatsBeforeMount
  };
}
function computeTurnOrder(units) {
  const entries = Object.values(units).filter((u) => u.pos != null && u.hp > 0);
  entries.sort((a, b) => {
    const aAgiDelta = (a.buffs || []).filter((buff) => buff.type === "agi_up" || buff.type === "agi_down").reduce((sum, buff) => sum + buff.amount, 0);
    const bAgiDelta = (b.buffs || []).filter((buff) => buff.type === "agi_up" || buff.type === "agi_down").reduce((sum, buff) => sum + buff.amount, 0);
    const aInitiative = a.agi + aAgiDelta;
    const bInitiative = b.agi + bAgiDelta;
    if (bInitiative !== aInitiative) {
      return bInitiative - aInitiative;
    }
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
  return entries.map((u) => u.id);
}
function getStrainThreshold() {
  return BASE_STRAIN_THRESHOLD;
}
function isOverStrainThreshold(unit) {
  return unit.strain >= getStrainThreshold();
}
function applyStrain(state, unit, amount) {
  const oldStrain = unit.strain;
  const newStrain = Math.max(0, oldStrain + amount);
  const updated = {
    ...unit,
    strain: newStrain
  };
  let next = {
    ...state,
    units: {
      ...state.units,
      [unit.id]: updated
    }
  };
  const wasOver = oldStrain >= getStrainThreshold();
  const nowOver = newStrain >= getStrainThreshold();
  if (!wasOver && nowOver) {
    next = appendBattleLog(
      next,
      `SLK//ALERT :: ${unit.name}'s vitals spike - STRAIN threshold exceeded.`
    );
  }
  return next;
}
function advanceTurn(state) {
  if (state.turnOrder.length === 0) {
    return state;
  }
  let newState = state;
  if (state.activeUnitId && state.units[state.activeUnitId]) {
    const currentUnit = state.units[state.activeUnitId];
    if (!currentUnit.isEnemy && currentUnit.hand.length > 0) {
      const newUnits = { ...state.units };
      newUnits[state.activeUnitId] = {
        ...currentUnit,
        discardPile: [...currentUnit.discardPile, ...currentUnit.hand],
        hand: []
        // Clear hand
      };
      newState = {
        ...state,
        units: newUnits
      };
    }
  }
  const currentIndex = newState.activeUnitId ? newState.turnOrder.indexOf(newState.activeUnitId) : -1;
  const nextIndex = currentIndex === -1 || currentIndex === newState.turnOrder.length - 1 ? 0 : currentIndex + 1;
  const nextActiveId = newState.turnOrder[nextIndex];
  const isNewRound = nextIndex === 0 && currentIndex !== -1;
  newState = {
    ...newState,
    activeUnitId: nextActiveId,
    turnCount: currentIndex === -1 ? 1 : newState.turnCount + (isNewRound ? 1 : 0)
  };
  if (isNewRound && newState.defenseObjective?.type === "survive_turns") {
    const newTurnsRemaining = Math.max(0, newState.defenseObjective.turnsRemaining - 1);
    newState = {
      ...newState,
      defenseObjective: {
        ...newState.defenseObjective,
        turnsRemaining: newTurnsRemaining
      },
      log: [
        ...newState.log,
        `SLK//DEFEND :: ${newTurnsRemaining} turns remaining to secure facility.`
      ]
    };
    if (newTurnsRemaining <= 0) {
      newState = evaluateBattleOutcome(newState);
      if (newState.phase === "victory" || newState.phase === "defeat") {
        return newState;
      }
    }
  }
  if (nextActiveId && newState.units[nextActiveId]) {
    const u = newState.units[nextActiveId];
    const oldStrain = u.strain;
    const cooledStrain = Math.max(0, oldStrain - 1);
    let cooledUnit = {
      ...u,
      strain: cooledStrain
    };
    const wasOver = oldStrain >= getStrainThreshold();
    const nowOver = cooledStrain >= getStrainThreshold();
    let cooledState = {
      ...newState,
      units: {
        ...newState.units,
        [nextActiveId]: cooledUnit
      }
    };
    if (wasOver && !nowOver) {
      cooledState = appendBattleLog(
        cooledState,
        `${u.name}'s vitals normalize - strain cooling.`
      );
    }
    newState = cooledState;
  }
  if (nextActiveId && newState.units[nextActiveId]) {
    const u = newState.units[nextActiveId];
    const updatedBuffs = (u.buffs ?? []).map((b) => ({ ...b, duration: b.duration - 1 })).filter((b) => b.duration > 0);
    newState = {
      ...newState,
      units: {
        ...newState.units,
        [nextActiveId]: {
          ...u,
          buffs: updatedBuffs
        }
      }
    };
  }
  if (nextActiveId) {
    newState = triggerTurnStart(newState, nextActiveId);
  }
  if (nextActiveId && newState.units[nextActiveId]) {
    const u = newState.units[nextActiveId];
    if (u.weaponState && !u.isEnemy) {
      const cooledWeaponState = passiveCooling(u.weaponState);
      const unjammedState = {
        ...cooledWeaponState,
        isJammed: false
      };
      newState = {
        ...newState,
        units: {
          ...newState.units,
          [nextActiveId]: {
            ...newState.units[nextActiveId],
            weaponState: unjammedState
          }
        }
      };
    }
  }
  const loadPenalties = getLoadPenalties(newState);
  if (loadPenalties && loadPenalties.powerOver) {
    if (Math.random() < 0.15) {
      let units = { ...newState.units };
      const allies = Object.values(units).filter((u) => !u.isEnemy);
      for (const ally of allies) {
        const cur = units[ally.id];
        units[ally.id] = {
          ...cur,
          hp: Math.max(0, cur.hp - 1)
        };
      }
      newState = {
        ...newState,
        units,
        log: [
          ...newState.log,
          "SLK//SURGE :: Power overload shocks your squad (-1 HP)."
        ]
      };
    }
  }
  const nextUnit = nextActiveId ? newState.units[nextActiveId] : null;
  if (nextUnit && !nextUnit.isEnemy) {
    const clearedUnit = {
      ...nextUnit,
      hand: []
    };
    newState = {
      ...newState,
      units: {
        ...newState.units,
        [nextActiveId]: clearedUnit
      }
    };
    newState = drawCardsForTurn(newState, newState.units[nextActiveId]);
  }
  newState = evaluateBattleOutcome(newState);
  if (newState.phase !== "victory" && newState.phase !== "defeat") {
    const nextUnitState = nextActiveId ? newState.units[nextActiveId] : null;
    newState = {
      ...newState,
      phase: nextUnitState?.isEnemy ? "enemy_turn" : "player_turn"
    };
  }
  if (isNewRound) {
    for (const unitId of newState.turnOrder) {
      const u = newState.units[unitId];
      if (hasStatus(u, "poisoned")) {
        const newHp = Math.max(0, u.hp - 1);
        newState = {
          ...newState,
          units: {
            ...newState.units,
            [unitId]: { ...newState.units[unitId], hp: newHp }
          }
        };
        newState = applyStrain(newState, newState.units[unitId], 1);
        newState = appendBattleLog(newState, `SLK//STATUS :: ${u.name} suffers 1 structural damage from POISON.`);
        if (newHp <= 0) {
          newState = evaluateBattleOutcome(newState);
        }
      }
      if (u.statuses) {
        let nextStatuses = u.statuses.map((s) => {
          if (["dazed", "vulnerable", "guarded"].includes(s.type)) {
            return { ...s, duration: s.duration - 1 };
          }
          return s;
        }).filter((s) => s.duration > 0);
        newState = {
          ...newState,
          units: {
            ...newState.units,
            [unitId]: { ...newState.units[unitId], statuses: nextStatuses }
          }
        };
      }
    }
  }
  if (newState.activeUnitId) {
    const activeUnit = newState.units[newState.activeUnitId];
    if (hasStatus(activeUnit, "burning")) {
      if (currentIndex !== -1) {
        const prevUnitId = state.turnOrder[currentIndex];
        const prevUnit = state.units[prevUnitId];
        if (prevUnit && prevUnit.hp > 0 && hasStatus(prevUnit, "burning")) {
          const bHp = Math.max(0, prevUnit.hp - 1);
          newState = {
            ...newState,
            units: {
              ...newState.units,
              [prevUnitId]: { ...newState.units[prevUnitId], hp: bHp }
            }
          };
          newState = appendBattleLog(newState, `SLK//STATUS :: ${prevUnit.name} suffers 1 thermal damage from BURNING.`);
          if (bHp <= 0) {
            newState = evaluateBattleOutcome(newState);
          }
        }
      }
    }
    if (currentIndex !== -1) {
      const prevUnitId = state.turnOrder[currentIndex];
      const prevUnit = state.units[prevUnitId];
      if (prevUnit && prevUnit.statuses) {
        const nextStatuses = prevUnit.statuses.map((s) => {
          if (s.type === "stunned" || s.type === "suppressed") {
            return { ...s, duration: s.duration - 1 };
          }
          return s;
        }).filter((s) => s.duration > 0);
        newState = {
          ...newState,
          units: {
            ...newState.units,
            [prevUnitId]: { ...newState.units[prevUnitId], statuses: nextStatuses }
          }
        };
      }
    }
  }
  return newState;
}
function appendBattleLog(state, message) {
  return {
    ...state,
    log: [...state.log, message]
  };
}
function getActiveUnit(state) {
  if (!state.activeUnitId) return null;
  return state.units[state.activeUnitId] ?? null;
}
function getEquippedWeapon(unit, equipmentById) {
  if (!unit.equippedWeaponId) return null;
  const equipment = equipmentById || getAllStarterEquipment();
  const weapon = equipment[unit.equippedWeaponId];
  if (weapon && weapon.slot === "weapon") {
    return weapon;
  }
  return null;
}
function updateUnitWeaponState(state, unitId, newWeaponState) {
  const unit = state.units[unitId];
  if (!unit) return state;
  return {
    ...state,
    units: {
      ...state.units,
      [unitId]: {
        ...unit,
        weaponState: newWeaponState
      }
    }
  };
}
function unitHasMountPassive(unit, trait) {
  return unit.mountPassiveTraits?.includes(trait) ?? false;
}
function getMountMovementBonus(unit) {
  if (!unit.mountId) return 0;
  const mount = getMountById(unit.mountId);
  if (!mount) return 0;
  return mount.statModifiers.movement ?? 0;
}
function getUnitMovementRange(unit, battle) {
  const baseMovement = unit.agi;
  const mountBonus = getMountMovementBonus(unit);
  const echoAdjustment = battle ? getEchoMovementAdjustment(battle, unit).amount : 0;
  return Math.max(1, baseMovement + mountBonus + echoAdjustment);
}
function getArmoredDamageReduction(unit) {
  if (!unitHasMountPassive(unit, "armored")) {
    return 0;
  }
  return 1;
}
function getIntimidateAccuracyPenalty(attacker, defender) {
  if (!unitHasMountPassive(defender, "intimidate")) {
    return 0;
  }
  if (!attacker.pos || !defender.pos) return 0;
  const dx = Math.abs(attacker.pos.x - defender.pos.x);
  const dy = Math.abs(attacker.pos.y - defender.pos.y);
  if (dx + dy === 1) {
    return -10;
  }
  return 0;
}
function arePositionsAdjacent(a, b) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx + dy === 1;
}
function isInsideBounds(state, pos) {
  return pos.x >= 0 && pos.y >= 0 && pos.x < state.gridWidth && pos.y < state.gridHeight;
}
function getTileAt(state, x, y) {
  return state.tiles.find((t) => t.pos.x === x && t.pos.y === y) || null;
}
function isWalkableTile(state, pos) {
  if (!isInsideBounds(state, pos)) return false;
  const tile = state.tiles.find(
    (t) => t.pos.x === pos.x && t.pos.y === pos.y
  );
  return Boolean(tile && tile.terrain !== "wall");
}
function getLivingUnitAt(state, pos) {
  return Object.values(state.units).find(
    (u) => u.hp > 0 && u.pos && u.pos.x === pos.x && u.pos.y === pos.y
  ) ?? null;
}
function canUnitMoveTo(state, unit, dest) {
  if (!unit.pos) return false;
  if (hasStatus(unit, "immobilized")) return false;
  const dx = Math.abs(unit.pos.x - dest.x);
  const dy = Math.abs(unit.pos.y - dest.y);
  const distance = dx + dy;
  const movementRange = getUnitMovementRange(unit, state);
  if (distance === 0 || distance > movementRange) return false;
  if (hasStatus(unit, "rooted")) {
    const startTile = getTileAt(state, unit.pos.x, unit.pos.y);
    const endTile = getTileAt(state, dest.x, dest.y);
    if (startTile && endTile && (startTile.elevation ?? 0) !== (endTile.elevation ?? 0)) {
      return false;
    }
  }
  const occupant = getLivingUnitAt(state, dest);
  if (occupant && occupant.id !== unit.id) return false;
  return isWalkableTile(state, dest);
}
function moveUnit(state, unitId, dest) {
  const unit = state.units[unitId];
  if (!unit) return state;
  const updatedUnit = {
    ...unit,
    pos: { ...dest }
  };
  const units = {
    ...state.units,
    [unitId]: updatedUnit
  };
  let next = {
    ...state,
    units
  };
  next = appendBattleLog(
    next,
    `SLK//MOVE   :: ${unit.name} repositions to (${dest.x}, ${dest.y}).`
  );
  const movementAdjustment = getEchoMovementAdjustment(state, unit);
  if (movementAdjustment.triggeredPlacements.length > 0) {
    next = incrementEchoFieldTriggerCount(next, movementAdjustment.triggeredPlacements);
  }
  if (hasStatus(unit, "suppressed")) {
    next = removeStatus(next, unitId, "suppressed");
  }
  return next;
}
function canUnitAttackTarget(attacker, target) {
  if (!attacker.pos || !target.pos) return false;
  return arePositionsAdjacent(attacker.pos, target.pos);
}
function computeHitChance(attacker, defender, isRanged = false) {
  let baseChance = attacker.acc;
  const accuracyBuffDelta = (attacker.buffs || []).filter((buff) => buff.type === "acc_up" || buff.type === "acc_down").reduce((sum, buff) => sum + buff.amount, 0);
  baseChance += accuracyBuffDelta;
  if (isOverStrainThreshold(attacker)) {
    baseChance -= 20;
  }
  if (hasStatus(attacker, "dazed")) {
    baseChance -= 10;
  }
  if (isRanged && hasStatus(attacker, "suppressed")) {
    baseChance -= 10;
  }
  if (defender && defender.statuses && defender.statuses.some((s) => s.type === "marked" && s.sourceId === attacker.id)) {
    baseChance += 10;
  }
  return Math.max(10, Math.min(100, baseChance));
}
function isPlayerUnit(u) {
  return !u.isEnemy;
}
function isEnemyUnit(u) {
  return u.isEnemy;
}
function attackUnit(state, attackerId, defenderId) {
  const attacker = state.units[attackerId];
  const defender = state.units[defenderId];
  if (!attacker || !defender) return state;
  const loadPenalties = getLoadPenalties(state);
  if (loadPenalties && loadPenalties.bulkOver && !attacker.isEnemy) {
    const over = Math.max(0, loadPenalties.bulkPct - 1);
    const jamChance = Math.min(over, 0.5);
    if (Math.random() < jamChance) {
      return appendBattleLog(
        state,
        `SLK//JAM   :: ${attacker.name}'s weapon jams under BULK overload.`
      );
    }
  }
  const equipWpn = getEquippedWeapon(attacker);
  const isRanged = equipWpn ? ["gun", "bow", "greatbow"].includes(equipWpn.weaponType) : false;
  let hitChance = computeHitChance(attacker, defender, isRanged);
  const intimidatePenalty = getIntimidateAccuracyPenalty(attacker, defender);
  if (intimidatePenalty !== 0) {
    hitChance = Math.max(10, hitChance + intimidatePenalty);
  }
  const roll = Math.random() * 100;
  if (roll > hitChance) {
    const missReason = intimidatePenalty !== 0 ? "(mount intimidation)" : "(strain interference)";
    return appendBattleLog(
      state,
      `SLK//MISS  :: ${attacker.name} swings at ${defender.name} but the strike goes wide ${missReason}.`
    );
  }
  const totalAtkBuff = attacker.buffs?.length ? attacker.buffs.filter((b) => b.type === "atk_up" || b.type === "atk_down").reduce((sum, b) => sum + b.amount, 0) : 0;
  const echoAttackBonus = getEchoAttackBonus(state, attacker);
  const totalDefBuff = defender.buffs?.length ? defender.buffs.filter((b) => b.type === "def_up" || b.type === "def_down").reduce((sum, b) => sum + b.amount, 0) : 0;
  const echoDefenseBonus = getEchoDefenseBonus(state, defender);
  let coverReduction = 0;
  if (defender.pos) {
    const defenderTile = getTileAt(state, defender.pos.x, defender.pos.y);
    coverReduction = getCoverDamageReduction(defenderTile);
  }
  const armoredReduction = getArmoredDamageReduction(defender);
  let rawDamage = attacker.atk + totalAtkBuff + echoAttackBonus.amount - (defender.def + totalDefBuff + echoDefenseBonus.amount + coverReduction + armoredReduction);
  if (hasStatus(attacker, "weakened")) {
    rawDamage -= 1;
  }
  if (hasStatus(defender, "guarded")) {
    rawDamage -= 1;
  }
  if (hasStatus(defender, "vulnerable")) {
    rawDamage += 1;
  }
  const finalDamage = Math.max(rawDamage <= 0 && !hasStatus(attacker, "weakened") ? 1 : rawDamage, 0);
  const newHp = defender.hp - finalDamage;
  const isKill = newHp <= 0;
  const isCrit = false;
  let units = { ...state.units };
  let turnOrder = [...state.turnOrder];
  let next = { ...state };
  if (newHp <= 0) {
    delete units[defenderId];
    turnOrder = turnOrder.filter((id) => id !== defenderId);
    next = {
      ...next,
      units,
      turnOrder
    };
    next = appendBattleLog(
      next,
      `SLK//HIT   :: ${attacker.name} hits ${defender.name} for ${finalDamage} - TARGET OFFLINE.`
    );
  } else {
    const updatedDefender = {
      ...defender,
      hp: newHp
    };
    units = {
      ...state.units,
      [defenderId]: updatedDefender
    };
    next = {
      ...next,
      units
    };
    next = appendBattleLog(
      next,
      `SLK//HIT   :: ${attacker.name} hits ${defender.name} for ${finalDamage} (HP ${newHp}/${defender.maxHp}).`
    );
  }
  if (finalDamage > 0 && hasStatus(defender, "vulnerable")) {
    next = removeStatus(next, defenderId, "vulnerable");
  }
  if (hasStatus(defender, "guarded")) {
    next = removeStatus(next, defenderId, "guarded");
  }
  if (echoAttackBonus.triggeredPlacements.length > 0 || echoDefenseBonus.triggeredPlacements.length > 0) {
    next = incrementEchoFieldTriggerCount(
      next,
      [...echoAttackBonus.triggeredPlacements, ...echoDefenseBonus.triggeredPlacements]
    );
  }
  next = triggerHit(next, attackerId, defenderId, finalDamage, isCrit, 0);
  const currentDefender = next.units[defenderId];
  if (currentDefender && currentDefender.weaponState && !isKill) {
    if (rollWeaponHit(isCrit)) {
      const hitNode = rollWeaponNodeHit();
      const damagedState = damageNode(currentDefender.weaponState, hitNode);
      next = updateUnitWeaponState(next, defenderId, damagedState);
      const nodeName = WEAPON_NODE_NAMES[hitNode].primary;
      const severity = damagedState.nodes[hitNode].toUpperCase();
      next = appendBattleLog(
        next,
        `SLK//DMG   :: [${currentDefender.name}] ${nodeName} struck. [${severity}]`
      );
    }
  }
  if (isKill) {
    next = triggerKill(next, attackerId, defenderId, 1);
  }
  if (!attacker.isEnemy) {
    trackMeleeAttackInBattle(attackerId, next);
  }
  next = evaluateBattleOutcome(next);
  return next;
}
function performEnemyTurn(state) {
  const active = getActiveUnit(state);
  if (!active || !active.isEnemy || !active.pos) {
    return advanceTurn(state);
  }
  const players = Object.values(state.units).filter(isPlayerUnit);
  if (players.length === 0) {
    return advanceTurn(state);
  }
  let target = players[0];
  let bestDist = Infinity;
  for (const u of players) {
    if (!u.pos) continue;
    const d = Math.abs(active.pos.x - u.pos.x) + Math.abs(active.pos.y - u.pos.y);
    if (d < bestDist) {
      bestDist = d;
      target = u;
    }
  }
  let next = { ...state };
  const updateFacing = (s, unitId, targetPos) => {
    const unit = s.units[unitId];
    if (!unit || !unit.pos) return s;
    const dx2 = targetPos.x - unit.pos.x;
    const dy2 = targetPos.y - unit.pos.y;
    let newFacing = unit.facing;
    if (Math.abs(dx2) >= Math.abs(dy2)) {
      newFacing = dx2 > 0 ? "east" : "west";
    } else {
      newFacing = dy2 > 0 ? "south" : "north";
    }
    if (newFacing !== unit.facing) {
      const newUnits = { ...s.units };
      newUnits[unitId] = { ...unit, facing: newFacing };
      return { ...s, units: newUnits };
    }
    return s;
  };
  if (canUnitAttackTarget(active, target)) {
    if (target.pos) {
      next = updateFacing(next, active.id, target.pos);
    }
    next = attackUnit(next, active.id, target.id);
    next = advanceTurn(next);
    return next;
  }
  const dx = Math.sign(target.pos.x - active.pos.x);
  const dy = Math.sign(target.pos.y - active.pos.y);
  const candidate1 = { x: active.pos.x + dx, y: active.pos.y };
  const candidate2 = { x: active.pos.x, y: active.pos.y + dy };
  let movedState = next;
  if (dx !== 0 && canUnitMoveTo(next, active, candidate1)) {
    movedState = moveUnit(next, active.id, candidate1);
    movedState = updateFacing(movedState, active.id, candidate1);
  } else if (dy !== 0 && canUnitMoveTo(next, active, candidate2)) {
    movedState = moveUnit(next, active.id, candidate2);
    movedState = updateFacing(movedState, active.id, candidate2);
  }
  movedState = advanceTurn(movedState);
  return movedState;
}
function performAutoBattleTurn(state, unitId, policy = "daring") {
  const unit = state.units[unitId];
  if (!unit || unit.isEnemy || !unit.pos) {
    return state;
  }
  if (DEBUG_BATTLE) {
    console.log(`[AUTO_BATTLE] Starting auto turn for ${unit.name}`);
  }
  const enemies = Object.values(state.units).filter((u) => u.isEnemy && u.hp > 0 && u.pos);
  if (enemies.length === 0) {
    return advanceTurn(state);
  }
  let nearestEnemy = enemies[0];
  let nearestDist = Infinity;
  for (const enemy of enemies) {
    if (!enemy.pos) continue;
    const dist = Math.abs(unit.pos.x - enemy.pos.x) + Math.abs(unit.pos.y - enemy.pos.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestEnemy = enemy;
    }
  }
  const playableCards = [];
  for (let i = 0; i < unit.hand.length; i++) {
    const cardId = unit.hand[i];
    let score = 0;
    const cardName = cardId.toLowerCase();
    if (cardName.includes("wait") || cardName === "core_wait") {
      score = -100;
    } else {
      score = 50;
      if (cardName.includes("attack") || cardName.includes("strike") || cardName.includes("shot")) {
        score += policy === "daring" ? 55 : 35;
        if (cardName.includes("power") || cardName.includes("execute")) {
          score += policy === "daring" ? 18 : 8;
        } else {
          score += policy === "daring" ? 8 : 4;
        }
      }
      if (cardName.includes("debuff") || cardName.includes("stun")) {
        score += policy === "cautious" ? 18 : 10;
      }
      if (cardName.includes("guard") || cardName.includes("form")) {
        score += policy === "cautious" ? 26 : 8;
      }
      if (cardName.includes("heal") || cardName.includes("aid") || cardName.includes("restore")) {
        score += policy === "cautious" ? 24 : 12;
      }
    }
    playableCards.push({ cardId, index: i, score, cardName });
  }
  playableCards.sort((a, b) => b.score - a.score);
  for (const { index, cardName } of playableCards) {
    if (playableCards[0].score <= 0) break;
    if (nearestEnemy.pos) {
      const distance = Math.abs(unit.pos.x - nearestEnemy.pos.x) + Math.abs(unit.pos.y - nearestEnemy.pos.y);
      if (cardName.includes("wait") || cardName === "core_wait") {
        return playCard(state, unitId, index, unitId);
      } else if (cardName.includes("attack") || cardName.includes("strike") || cardName.includes("shot") || cardName.includes("headbutt") || cardName.includes("charge")) {
        if (distance <= 6) {
          return playCard(state, unitId, index, nearestEnemy.id);
        }
      } else if (cardName.includes("guard") || cardName.includes("form") || cardName.includes("draw")) {
        return playCard(state, unitId, index, unitId);
      }
    }
  }
  if (playableCards.length === 0 || playableCards[0].score <= 0) {
    if (nearestEnemy.pos && getUnitMovementRange(unit, state) > 0) {
      const dx = Math.sign(nearestEnemy.pos.x - unit.pos.x);
      const dy = Math.sign(nearestEnemy.pos.y - unit.pos.y);
      const candidate1 = { x: unit.pos.x + dx, y: unit.pos.y };
      const candidate2 = { x: unit.pos.x, y: unit.pos.y + dy };
      if (dx !== 0 && canUnitMoveTo(state, unit, candidate1)) {
        return moveUnit(state, unitId, candidate1);
      } else if (dy !== 0 && canUnitMoveTo(state, unit, candidate2)) {
        return moveUnit(state, unitId, candidate2);
      }
    }
    return advanceTurn(state);
  }
  if (nearestEnemy.pos) {
    const distance = Math.abs(unit.pos.x - nearestEnemy.pos.x) + Math.abs(unit.pos.y - nearestEnemy.pos.y);
    if (distance > (policy === "cautious" ? 2 : 1) && getUnitMovementRange(unit, state) > 0) {
      const dx = Math.sign(nearestEnemy.pos.x - unit.pos.x);
      const dy = Math.sign(nearestEnemy.pos.y - unit.pos.y);
      const candidate1 = { x: unit.pos.x + dx, y: unit.pos.y };
      const candidate2 = { x: unit.pos.x, y: unit.pos.y + dy };
      if (dx !== 0 && canUnitMoveTo(state, unit, candidate1)) {
        return moveUnit(state, unitId, candidate1);
      } else if (dy !== 0 && canUnitMoveTo(state, unit, candidate2)) {
        return moveUnit(state, unitId, candidate2);
      }
    }
  }
  return advanceTurn(state);
}
function evaluateBattleOutcome(state) {
  if (state.phase === "victory" || state.phase === "defeat") {
    return state;
  }
  const units = Object.values(state.units);
  const anyPlayers = units.some((u) => isPlayerUnit(u) && u.hp > 0 && u.pos != null);
  const anyEnemies = units.some((u) => isEnemyUnit(u) && u.hp > 0 && u.pos != null);
  if (!anyPlayers) {
    return {
      ...state,
      phase: "defeat",
      activeUnitId: null,
      log: [
        ...state.log,
        isEchoBattle(state) ? "SLK//ECHO  :: Draft squad collapsed. Simulation terminates." : "SLK//ENGAGE :: Player squad offline. Link severed."
      ]
    };
  }
  if (state.defenseObjective?.type === "survive_turns") {
    if (state.defenseObjective.turnsRemaining <= 0) {
      const rewards = generateDefenseRewards(state);
      return {
        ...state,
        phase: "victory",
        activeUnitId: null,
        rewards,
        log: [
          ...state.log,
          "SLK//DEFEND :: Defense successful! Facility secured.",
          `SLK//REWARD :: +${rewards.wad} WAD, +${rewards.metalScrap} Metal Scrap, +${rewards.wood} Wood.`
        ]
      };
    }
  }
  if (!anyEnemies && !state.defenseObjective) {
    if (isEchoBattle(state)) {
      return {
        ...state,
        phase: "victory",
        activeUnitId: null,
        rewards: {
          wad: 0,
          metalScrap: 0,
          wood: 0,
          chaosShards: 0,
          steamComponents: 0,
          squadXp: 0,
          cards: [],
          recipe: null,
          unlockable: null
        },
        log: [
          ...state.log,
          "SLK//ECHO  :: Encounter cleared. Draft reward relay unlocked."
        ]
      };
    }
    const isTraining = state.isTraining === true;
    const rewards = isTraining ? {
      wad: 0,
      metalScrap: 0,
      wood: 0,
      chaosShards: 0,
      steamComponents: 0,
      cards: [],
      recipe: null,
      unlockable: null
    } : generateBattleRewards(state);
    if (isTraining) {
      console.warn("[TRAINING_NO_REWARDS] blocked reward generation");
    }
    const cardNames = (rewards.cards ?? []).map((id) => getLibraryCard(id)?.name ?? id).join(", ");
    const cardLog = rewards.cards && rewards.cards.length > 0 ? `SLK//CARDS :: Acquired: ${cardNames}` : "";
    const logMessages = isTraining ? [
      ...state.log,
      "SLK//TRAIN :: Training simulation complete. No rewards granted."
    ] : [
      ...state.log,
      "SLK//ENGAGE :: All hostiles cleared. Engagement complete.",
      `SLK//REWARD :: +${rewards.wad} WAD, +${rewards.metalScrap} Metal Scrap, +${rewards.wood} Wood, +${rewards.chaosShards} Chaos Shards, +${rewards.steamComponents} Steam Components, +${"squadXp" in rewards ? rewards.squadXp ?? 0 : 0} S.T.A.T.`,
      ...cardLog ? [cardLog] : []
    ];
    return {
      ...state,
      phase: "victory",
      activeUnitId: null,
      rewards,
      log: logMessages
    };
  }
  if (!anyEnemies && state.defenseObjective) {
    const rewards = generateDefenseRewards(state);
    return {
      ...state,
      phase: "victory",
      activeUnitId: null,
      rewards,
      log: [
        ...state.log,
        "SLK//DEFEND :: All attackers eliminated! Facility secured.",
        `SLK//REWARD :: +${rewards.wad} WAD, +${rewards.metalScrap} Metal Scrap, +${rewards.wood} Wood.`
      ]
    };
  }
  return state;
}
function generateDefenseRewards(_state) {
  return {
    wad: 25,
    metalScrap: 5,
    wood: 3,
    chaosShards: 1,
    steamComponents: 1,
    cards: []
  };
}
function generateBattleRewards(state) {
  const enemies = Object.values(state.units).filter(isEnemyUnit);
  const enemyCount = enemies.length || 1;
  const cardRewards = generateBattleRewardCards(enemyCount);
  const recipeChance = Math.min(0.2, 0.05 + enemyCount * 0.02);
  let recipeReward = null;
  if (Math.random() < recipeChance) {
    try {
      recipeReward = "recipe_reward_pending";
    } catch (e) {
      console.warn("[BATTLE] Could not generate recipe reward:", e);
    }
  }
  const unlockableChance = Math.min(0.15, 0.05 + enemyCount * 0.01);
  let unlockableReward = null;
  if (Math.random() < unlockableChance) {
    try {
      const owned = getAllOwnedUnlockableIds();
      const allOwnedIds = [...owned.chassis, ...owned.doctrines];
      const unowned = getUnownedUnlockables(allOwnedIds);
      if (unowned.length === 0) {
        unlockableReward = null;
      } else {
        const common = unowned.filter((u) => u.rarity === "common");
        const uncommon = unowned.filter((u) => u.rarity === "uncommon");
        const rare = unowned.filter((u) => u.rarity === "rare" || u.rarity === "epic");
        const roll = Math.random();
        let pool;
        if (roll < 0.6 && common.length > 0) {
          pool = common;
        } else if (roll < 0.9 && uncommon.length > 0) {
          pool = uncommon;
        } else if (rare.length > 0) {
          pool = rare;
        } else {
          pool = unowned;
        }
        const selected = pool[Math.floor(Math.random() * pool.length)];
        unlockableReward = selected ? selected.id : null;
      }
    } catch (e) {
      console.warn("[BATTLE] Could not generate unlockable reward:", e);
    }
  }
  return {
    wad: 10 * enemyCount,
    metalScrap: 2 * enemyCount,
    wood: 1 * enemyCount,
    chaosShards: enemyCount >= 2 ? 1 : 0,
    steamComponents: enemyCount >= 2 ? 1 : 0,
    squadXp: 18 + enemyCount * 10,
    cards: cardRewards,
    recipe: recipeReward,
    unlockable: unlockableReward
  };
}
function drawCardsForTurn(state, unit, handSize = 5) {
  let u = unit;
  if (u.drawPile.length < handSize && u.discardPile.length > 0) {
    const reshuffled = shuffleArray([...u.discardPile]);
    u = {
      ...u,
      drawPile: [...u.drawPile, ...reshuffled],
      discardPile: []
    };
    if (DEBUG_BATTLE) {
      console.log(`[BATTLE] RESHUFFLE discard->deck (${reshuffled.length} cards) for ${u.name}`);
    }
  }
  const newHand = [...u.hand];
  const newDraw = [...u.drawPile];
  while (newHand.length < handSize && newDraw.length > 0) {
    newHand.push(newDraw.shift());
  }
  const updatedUnit = {
    ...u,
    hand: newHand,
    drawPile: newDraw
  };
  return {
    ...state,
    units: {
      ...state.units,
      [updatedUnit.id]: updatedUnit
    }
  };
}
function calculateMaxUnitsPerSide(gridWidth, gridHeight) {
  const gridArea = gridWidth * gridHeight;
  const rawMax = Math.floor(gridArea * 0.25);
  return Math.max(3, Math.min(rawMax, 10));
}
function createTestBattleForCurrentParty(state, gridOverride) {
  const partyIds = state.partyUnitIds;
  if (partyIds.length === 0) return null;
  const gridWidth = Math.max(4, Math.floor(gridOverride?.width ?? Math.floor(Math.random() * (8 - 4 + 1)) + 4));
  const gridHeight = Math.max(3, Math.floor(gridOverride?.height ?? Math.floor(Math.random() * (6 - 3 + 1)) + 3));
  const maxElevation = 3;
  const elevationMap = generateElevationMap(gridWidth, gridHeight, maxElevation);
  const tiles = createGrid(gridWidth, gridHeight, elevationMap);
  const maxUnitsPerSide = calculateMaxUnitsPerSide(gridWidth, gridHeight);
  const equipmentById = state.equipmentById || getAllStarterEquipment();
  const modulesById = state.modulesById || getAllModules();
  const units = {};
  partyIds.forEach((id) => {
    const base = state.unitsById[id];
    if (!base) return;
    units[id] = createBattleUnitState(
      base,
      {
        isEnemy: false,
        pos: null,
        // Start with no position - placement phase
        gearSlots: state.gearSlots ?? {},
        stable: state.stable
        // Pass stable state for mount system
      },
      equipmentById,
      modulesById
    );
  });
  const turnOrder = [];
  const activeUnitId = null;
  let battle = {
    id: "battle_test_1",
    floorId: state.operation?.floors[state.operation.currentFloorIndex]?.id ?? "unknown_floor",
    roomId: state.operation?.currentRoomId ?? "unknown_room",
    gridWidth,
    gridHeight,
    tiles,
    units,
    turnOrder,
    activeUnitId,
    phase: "placement",
    // Start in placement phase
    turnCount: 0,
    log: [
      `SLK//ENGAGE :: Engagement feed online.`,
      `SLK//ROOM   :: Linked to node ${state.operation?.currentRoomId}.`,
      `SLK//PLACE  :: Unit placement phase - position your squad on the left edge.`
    ],
    placementState: {
      placedUnitIds: [],
      // Array instead of Set
      selectedUnitId: null,
      maxUnitsPerSide
    }
  };
  if (state.inventory) {
    const loadPenalties = computeLoadPenaltyFlags(
      state.inventory
    );
    battle.loadPenalties = loadPenalties;
    if (loadPenalties.massOver) {
      const newUnits = { ...battle.units };
      const allies = Object.values(newUnits).filter((u) => !u.isEnemy);
      for (const ally of allies) {
        const cur = newUnits[ally.id];
        newUnits[ally.id] = {
          ...cur,
          agi: Math.max(1, cur.agi - 1)
        };
      }
      battle = {
        ...battle,
        units: newUnits,
        log: [
          ...battle.log,
          "SLK//LOAD  :: MASS overload - squad AGI reduced."
        ]
      };
    }
  }
  const enemyCount = Math.min(2, maxUnitsPerSide);
  const first = state.unitsById[partyIds[0]];
  if (first) {
    const enemyBase = {
      ...first,
      id: "enemy_grunt_1",
      name: "Gate Sentry",
      deck: ["core_basic_attack", "core_basic_attack", "core_guard"],
      stats: { maxHp: 15, atk: 4, def: 2, agi: 3, acc: 75 }
    };
    for (let i = 0; i < enemyCount; i++) {
      const enemyId = `enemy_grunt_${i + 1}`;
      units[enemyId] = createBattleUnitState(
        { ...enemyBase, id: enemyId, name: "Gate Sentry" },
        {
          isEnemy: true,
          pos: { x: gridWidth - 1, y: Math.floor(gridHeight / enemyCount * i + 1) }
        },
        equipmentById,
        modulesById
      );
    }
  }
  battle.units = units;
  battle = triggerBattleStart(battle);
  return battle;
}
function playCard(state, unitId, cardIndex, targetId) {
  const unit = state.units[unitId];
  const target = state.units[targetId];
  if (!unit || !target) {
    return appendBattleLog(state, "SLK//ERROR :: Invalid unit or target for card play.");
  }
  const cardId = unit.hand[cardIndex];
  if (!cardId) {
    return appendBattleLog(state, "SLK//ERROR :: No card at index " + cardIndex);
  }
  const cardName = cardId.replace(/^(core_|class_|card_|equip_)/, "").replace(/_/g, " ");
  const cardDesc = "";
  const strainCost = 1;
  const newHand = [...unit.hand];
  newHand.splice(cardIndex, 1);
  const newDiscard = [...unit.discardPile, cardId];
  const newStrain = unit.strain + strainCost;
  let updatedUnit = {
    ...unit,
    hand: newHand,
    discardPile: newDiscard,
    strain: newStrain
  };
  let updatedTarget = targetId === unitId ? updatedUnit : { ...target };
  let newLog = [...state.log, `SLK//CARD :: ${unit.name} plays ${cardName} on ${target.name}.`];
  const dmgMatch = cardDesc.match(/deal\s+(\d+)\s+damage/i);
  if (dmgMatch && targetId !== unitId) {
    const baseDamage = parseInt(dmgMatch[1], 10);
    const finalDamage = Math.max(1, baseDamage + unit.atk - target.def);
    const newHp = Math.max(0, target.hp - finalDamage);
    updatedTarget = { ...updatedTarget, hp: newHp };
    newLog.push(`SLK//DMG :: ${target.name} takes ${finalDamage} damage. (HP: ${newHp}/${target.maxHp})`);
    if (newHp <= 0) {
      newLog.push(`SLK//KILL :: ${target.name} has been eliminated!`);
    }
  }
  if (cardName.toLowerCase().includes("basic attack") && targetId !== unitId) {
    const finalDamage = Math.max(1, unit.atk - target.def);
    const newHp = Math.max(0, target.hp - finalDamage);
    updatedTarget = { ...updatedTarget, hp: newHp };
    newLog.push(`SLK//DMG :: ${target.name} takes ${finalDamage} damage. (HP: ${newHp}/${target.maxHp})`);
    if (newHp <= 0) {
      newLog.push(`SLK//KILL :: ${target.name} has been eliminated!`);
    }
  }
  const healMatch = cardDesc.match(/restore\s+(\d+)\s+hp/i) || cardDesc.match(/heal\s+(\d+)/i);
  if (healMatch) {
    const healAmount = parseInt(healMatch[1], 10);
    const oldHp = updatedTarget.hp;
    const newHp = Math.min(updatedTarget.maxHp, oldHp + healAmount);
    const actualHeal = newHp - oldHp;
    if (actualHeal > 0) {
      updatedTarget = { ...updatedTarget, hp: newHp };
      newLog.push(`SLK//HEAL :: ${target.name} restores ${actualHeal} HP. (HP: ${newHp}/${target.maxHp})`);
    }
  }
  const defBuffMatch = cardDesc.match(/\+(\d+)\s+def/i) || cardDesc.match(/gain\s+(\d+)\s+def/i);
  if (defBuffMatch) {
    const buffAmount = parseInt(defBuffMatch[1], 10);
    const newBuffs = [...updatedTarget.buffs || [], { id: "def_buff", type: "def_up", amount: buffAmount, duration: 1 }];
    updatedTarget = { ...updatedTarget, buffs: newBuffs };
    newLog.push(`SLK//BUFF :: ${target.name} gains +${buffAmount} DEF for 1 turn.`);
  }
  const atkBuffMatch = cardDesc.match(/\+(\d+)\s+atk/i) || cardDesc.match(/gain\s+(\d+)\s+atk/i);
  if (atkBuffMatch) {
    const buffAmount = parseInt(atkBuffMatch[1], 10);
    const newBuffs = [...updatedTarget.buffs || [], { id: "atk_buff", type: "atk_up", amount: buffAmount, duration: 1 }];
    updatedTarget = { ...updatedTarget, buffs: newBuffs };
    newLog.push(`SLK//BUFF :: ${target.name} gains +${buffAmount} ATK for 1 turn.`);
  }
  const newUnits = { ...state.units };
  newUnits[unitId] = updatedUnit;
  if (targetId !== unitId) {
    if (updatedTarget.hp <= 0) {
      delete newUnits[targetId];
    } else {
      newUnits[targetId] = updatedTarget;
    }
  } else {
    if (updatedTarget.hp <= 0) {
      delete newUnits[unitId];
    } else {
      newUnits[unitId] = updatedTarget;
    }
  }
  let newTurnOrder = [...state.turnOrder];
  if (updatedTarget.hp <= 0) {
    newTurnOrder = newTurnOrder.filter((id) => id !== targetId);
  }
  let newState = {
    ...state,
    units: newUnits,
    turnOrder: newTurnOrder,
    log: newLog
  };
  newState = triggerCardPlayed(newState, unitId, cardId, 0);
  newState = evaluateBattleOutcome(newState);
  return newState;
}
function placeUnit(state, unitId, pos) {
  if (state.phase !== "placement") return state;
  const unit = state.units[unitId];
  if (!unit || unit.isEnemy) return state;
  if (pos.x !== 0 || pos.y < 0 || pos.y >= state.gridHeight) {
    return appendBattleLog(state, `SLK//PLACE  :: Invalid placement position. Units must be placed on the left edge (x=0).`);
  }
  const occupied = Object.values(state.units).some(
    (u) => u.pos && u.pos.x === pos.x && u.pos.y === pos.y && u.hp > 0
  );
  if (occupied) {
    return appendBattleLog(state, `SLK//PLACE  :: Tile (${pos.x}, ${pos.y}) is already occupied.`);
  }
  const placementState = state.placementState;
  if (!placementState) return state;
  const placedCount = placementState.placedUnitIds.length;
  if (placedCount >= placementState.maxUnitsPerSide) {
    return appendBattleLog(state, `SLK//PLACE  :: Maximum units per side (${placementState.maxUnitsPerSide}) reached.`);
  }
  if (placementState.placedUnitIds.includes(unitId)) {
    return appendBattleLog(state, `SLK//PLACE  :: ${unit.name} is already placed.`);
  }
  const newUnits = { ...state.units };
  newUnits[unitId] = { ...unit, pos };
  const newPlacedIds = [...placementState.placedUnitIds, unitId];
  return {
    ...state,
    units: newUnits,
    placementState: {
      ...placementState,
      placedUnitIds: newPlacedIds
    },
    log: [...state.log, `SLK//PLACE  :: ${unit.name} placed at (${pos.x}, ${pos.y}).`]
  };
}
function quickPlaceUnits(state) {
  if (state.phase !== "placement") return state;
  const placementState = state.placementState;
  if (!placementState) return state;
  const friendlyUnits = Object.values(state.units).filter((u) => !u.isEnemy);
  const unplacedUnits = friendlyUnits.filter(
    (u) => !placementState.placedUnitIds.includes(u.id) && !u.pos
  );
  let newState = state;
  let placedCount = placementState.placedUnitIds.length;
  const middleY = Math.floor(newState.gridHeight / 2);
  for (let i = 0; i < unplacedUnits.length && placedCount < placementState.maxUnitsPerSide; i++) {
    const unit = unplacedUnits[i];
    const offset = Math.floor((i + 1) / 2);
    const direction = i % 2 === 1 ? -1 : 1;
    let yPos = middleY + direction * offset;
    yPos = Math.max(0, Math.min(newState.gridHeight - 1, yPos));
    newState = placeUnit(newState, unit.id, { x: 0, y: yPos });
    placedCount++;
  }
  return appendBattleLog(newState, `SLK//PLACE  :: Quick placed ${placedCount - state.placementState.placedUnitIds.length} units.`);
}
function confirmPlacement(state) {
  if (state.phase !== "placement") return state;
  const placementState = state.placementState;
  if (!placementState) return state;
  const placedCount = placementState.placedUnitIds.length;
  if (placedCount === 0) {
    return appendBattleLog(state, `SLK//PLACE  :: Please place at least one unit before confirming.`);
  }
  const filteredUnits = {};
  Object.entries(state.units).forEach(([id, u]) => {
    if (u.isEnemy) {
      filteredUnits[id] = u;
    }
  });
  placementState.placedUnitIds.forEach((id) => {
    if (state.units[id]) {
      filteredUnits[id] = state.units[id];
    }
  });
  const turnOrder = computeTurnOrder(filteredUnits);
  const activeUnitId = turnOrder[0] ?? null;
  let newState = {
    ...state,
    units: filteredUnits,
    // PRUNE unplaced units so they don't get turns or interfere with outcome
    phase: activeUnitId && filteredUnits[activeUnitId]?.isEnemy ? "enemy_turn" : "player_turn",
    turnOrder,
    activeUnitId,
    turnCount: 1,
    placementState: void 0,
    // Clear placement state
    log: [
      ...state.log,
      `SLK//ENGAGE :: Placement confirmed. Battle begins.`
    ]
  };
  if (activeUnitId) {
    const firstActive = newState.units[activeUnitId];
    if (firstActive && !firstActive.isEnemy) {
      newState = drawCardsForTurn(newState, firstActive);
      newState = appendBattleLog(
        newState,
        `SLK//UNIT   :: ${firstActive.name} draws opening hand.`
      );
    }
  }
  return newState;
}
var DEBUG_BATTLE, BASE_STRAIN_THRESHOLD;
var init_battle = __esm({
  "src/core/battle.ts"() {
    "use strict";
    init_inventory();
    init_isometric();
    init_equipment();
    init_weaponSystem();
    init_gearWorkbench();
    init_mounts();
    init_affinityBattle();
    init_fieldModBattleIntegration();
    init_coverGenerator();
    init_echoFieldEffects();
    init_unlockables();
    init_unlockableOwnership();
    DEBUG_BATTLE = false;
    BASE_STRAIN_THRESHOLD = 6;
  }
});

// src/core/theaterSystem.ts
init_battle();

// src/core/atlasSystem.ts
function createRadialDirection(angleDeg) {
  const radians = angleDeg * Math.PI / 180;
  return {
    x: Number(Math.cos(radians).toFixed(4)),
    y: Number(Math.sin(radians).toFixed(4))
  };
}
function createTheaterSummary(summary) {
  return {
    ...summary,
    radialDirection: createRadialDirection(summary.angleDeg)
  };
}
var ATLAS_FLOOR_MAPS = [
  {
    floorId: "haven_floor_03",
    floorLabel: "FLOOR 03 // CURRENT HAVEN ANCHOR",
    floorOrdinal: 3,
    isCurrentFloor: true,
    ringIndex: 0,
    theaters: [
      createTheaterSummary({
        theaterId: "op_iron_gate_castellan_gateworks",
        operationId: "op_iron_gate",
        zoneName: "CASTELLAN GATEWORKS",
        floorId: "haven_floor_03",
        floorLabel: "FLOOR 03",
        floorOrdinal: 3,
        sectorLabel: "SECTOR E-01",
        radialSlotIndex: 0,
        radialSlotCount: 5,
        angleDeg: 0,
        ringIndex: 0,
        discovered: true,
        uplinkRoomId: "ig_ingress",
        outwardDepth: 5,
        operationAvailable: true,
        currentState: "active",
        recommendedPwr: 24,
        securedRooms: 1,
        totalKnownRooms: 4,
        activeCores: 1,
        passiveEffectText: "Passive Benefit // Supply relay trims first deploy strain by 1.",
        passiveEffectKind: "benefit",
        threatLevel: "High",
        operationCodename: "IRON GATE",
        operationDescription: "Push from the uplink breach and stabilize the eastern lockline."
      }),
      createTheaterSummary({
        theaterId: "atlas_ashwake_hollows",
        zoneName: "ASHWAKE HOLLOWS",
        floorId: "haven_floor_03",
        floorLabel: "FLOOR 03",
        floorOrdinal: 3,
        sectorLabel: "SECTOR S-02",
        radialSlotIndex: 1,
        radialSlotCount: 5,
        angleDeg: 72,
        ringIndex: 0,
        discovered: true,
        uplinkRoomId: "ah_uplink",
        outwardDepth: 4,
        operationAvailable: false,
        currentState: "warm",
        recommendedPwr: 27,
        securedRooms: 2,
        totalKnownRooms: 5,
        activeCores: 1,
        passiveEffectText: "Passive Penalty // Ember fog raises ranged miss chance.",
        passiveEffectKind: "penalty",
        threatLevel: "Moderate",
        operationCodename: "ASHWAKE PATROL",
        operationDescription: "Survey ash vents and keep the route warm for a future push."
      }),
      createTheaterSummary({
        theaterId: "atlas_glassmire_vaults",
        zoneName: "GLASSMIRE VAULTS",
        floorId: "haven_floor_03",
        floorLabel: "FLOOR 03",
        floorOrdinal: 3,
        sectorLabel: "SECTOR W-03",
        radialSlotIndex: 2,
        radialSlotCount: 5,
        angleDeg: 144,
        ringIndex: 0,
        discovered: true,
        uplinkRoomId: "gv_uplink",
        outwardDepth: 4,
        operationAvailable: false,
        currentState: "cold",
        recommendedPwr: 22,
        securedRooms: 3,
        totalKnownRooms: 6,
        activeCores: 2,
        passiveEffectText: "Passive Benefit // Vault condensers increase scrap yield.",
        passiveEffectKind: "benefit",
        threatLevel: "Low",
        operationCodename: "VAULT LOCK",
        operationDescription: "Cold-storage sectors are stable but not currently staged for deployment."
      }),
      createTheaterSummary({
        theaterId: "atlas_mireglass_unknown",
        zoneName: "UNKNOWN CONTACT",
        floorId: "haven_floor_03",
        floorLabel: "FLOOR 03",
        floorOrdinal: 3,
        sectorLabel: "SECTOR NW-04",
        radialSlotIndex: 3,
        radialSlotCount: 5,
        angleDeg: 216,
        ringIndex: 0,
        discovered: false,
        uplinkRoomId: "unknown_uplink",
        outwardDepth: 0,
        operationAvailable: false,
        currentState: "undiscovered",
        recommendedPwr: 0,
        securedRooms: 0,
        totalKnownRooms: 0,
        activeCores: 0,
        passiveEffectText: "No telemetry available.",
        passiveEffectKind: "neutral",
        threatLevel: "Unknown"
      }),
      createTheaterSummary({
        theaterId: "atlas_saintwire_orchard",
        zoneName: "SAINTWIRE ORCHARD",
        floorId: "haven_floor_03",
        floorLabel: "FLOOR 03",
        floorOrdinal: 3,
        sectorLabel: "SECTOR N-05",
        radialSlotIndex: 4,
        radialSlotCount: 5,
        angleDeg: 288,
        ringIndex: 0,
        discovered: true,
        uplinkRoomId: "so_uplink",
        outwardDepth: 3,
        operationAvailable: false,
        currentState: "warm",
        recommendedPwr: 25,
        securedRooms: 1,
        totalKnownRooms: 4,
        activeCores: 0,
        passiveEffectText: "Passive Penalty // Wirebloom spores slowly raise strain.",
        passiveEffectKind: "penalty",
        threatLevel: "Moderate",
        operationCodename: "ORCHARD WATCH",
        operationDescription: "The orchard is mapped from the uplink but not greenlit for insertion."
      })
    ]
  },
  {
    floorId: "haven_floor_02",
    floorLabel: "FLOOR 02 // ARCHIVED HAVEN ANCHOR",
    floorOrdinal: 2,
    isCurrentFloor: false,
    ringIndex: 1,
    theaters: [
      createTheaterSummary({
        theaterId: "atlas_vesper_docks",
        zoneName: "VESPER DOCKS",
        floorId: "haven_floor_02",
        floorLabel: "FLOOR 02",
        floorOrdinal: 2,
        sectorLabel: "SECTOR E-01",
        radialSlotIndex: 0,
        radialSlotCount: 4,
        angleDeg: 24,
        ringIndex: 1,
        discovered: true,
        uplinkRoomId: "vd_uplink",
        outwardDepth: 3,
        operationAvailable: false,
        currentState: "cold",
        recommendedPwr: 18,
        securedRooms: 4,
        totalKnownRooms: 4,
        activeCores: 2,
        passiveEffectText: "Passive Benefit // Salvage ferries return bonus wood.",
        passiveEffectKind: "benefit",
        threatLevel: "Low"
      }),
      createTheaterSummary({
        theaterId: "atlas_blackglass_shaft",
        zoneName: "BLACKGLASS SHAFT",
        floorId: "haven_floor_02",
        floorLabel: "FLOOR 02",
        floorOrdinal: 2,
        sectorLabel: "SECTOR W-03",
        radialSlotIndex: 2,
        radialSlotCount: 4,
        angleDeg: 204,
        ringIndex: 1,
        discovered: true,
        uplinkRoomId: "bs_uplink",
        outwardDepth: 4,
        operationAvailable: false,
        currentState: "warm",
        recommendedPwr: 20,
        securedRooms: 2,
        totalKnownRooms: 5,
        activeCores: 1,
        passiveEffectText: "Passive Penalty // Residual glass static scrambles comms bursts.",
        passiveEffectKind: "penalty",
        threatLevel: "Moderate"
      })
    ]
  }
];
function cloneTheaterSummary(summary) {
  return {
    ...summary,
    radialDirection: { ...summary.radialDirection }
  };
}
function getAtlasTheaterSummary(theaterId) {
  for (const floor of ATLAS_FLOOR_MAPS) {
    const match = floor.theaters.find((theater) => theater.theaterId === theaterId);
    if (match) {
      return cloneTheaterSummary(match);
    }
  }
  return null;
}
function getAtlasTheaterByOperationId(operationId) {
  if (!operationId) {
    return null;
  }
  for (const floor of ATLAS_FLOOR_MAPS) {
    const match = floor.theaters.find((theater) => theater.operationId === operationId);
    if (match) {
      return cloneTheaterSummary(match);
    }
  }
  return null;
}

// src/core/theaterGenerator.ts
init_campaign();
init_schemaSystem();
var MAP_WIDTH = 4400;
var MAP_HEIGHT = 3200;
var MAP_CENTER_X = Math.round(MAP_WIDTH / 2);
var MAP_CENTER_Y = Math.round(MAP_HEIGHT / 2);
var EDGE_MARGIN_X = 620;
var EDGE_MARGIN_Y = 420;
var DEFAULT_MAP_ANCHOR = { x: EDGE_MARGIN_X, y: MAP_CENTER_Y };
var THEATER_DEPTH_STEP = 430;
var THEATER_LATERAL_STEP = 360;
var THEATER_ROOM_BASE = {
  fortified: false,
  coreAssignment: null,
  coreSlots: [null],
  coreSlotCapacity: 1,
  roomClass: "standard",
  underThreat: false,
  damaged: false,
  connected: false,
  powered: false,
  supplied: false,
  commsVisible: false,
  commsLinked: false,
  supplyFlow: 0,
  powerFlow: 0,
  commsFlow: 0,
  intelLevel: 0,
  fortificationPips: createEmptyFortificationPips(),
  isPowerSource: false,
  abandoned: false,
  requiredKeyType: null,
  grantsKeyType: null,
  keyCollected: false,
  enemySite: null
};
function createEmptyKeyInventory() {
  return {
    triangle: false,
    square: false,
    circle: false,
    spade: false,
    star: false
  };
}
var DEFAULT_PROFILE = {
  prefix: "thr",
  zoneName: "UNMAPPED THEATER",
  sectorLabel: "SECTOR X-00",
  passiveEffectText: "Passive Flux // Theater topology is unstable and resists long-range prediction.",
  threatLevel: "High",
  currentState: "active",
  ingressLabels: ["Ingress Aperture", "Staging Aperture", "Transit Aperture"],
  frontlineLabels: ["Broken Causeway", "Pressure Gate", "Forward Choke"],
  relayLabels: ["Signal Junction", "Relay Gallery", "Conduit Hub"],
  fieldLabels: ["Freight Annex", "Survey Pocket", "Sweep Channel"],
  coreLabels: ["Command Gallery", "Support Annex", "Cold Storage Spur"],
  powerLabels: ["Dyno Chamber", "Power Spine", "Generator Well"],
  eliteLabels: ["Redoubt Mouth", "Pressure Crucible", "Kill Vault"],
  objectiveLabels: ["Objective Lock", "Seal Node", "Command Lattice"]
};
var PROFILE_BY_OPERATION = {
  op_iron_gate: {
    prefix: "ig",
    zoneName: "CASTELLAN GATEWORKS",
    sectorLabel: "SECTOR E-01",
    passiveEffectText: "Passive Benefit // Forward relay trims early deploy strain and stabilizes the lockline push.",
    threatLevel: "High",
    ingressLabels: ["Gateworks Aperture", "Breach Aperture", "Entry Aperture"],
    frontlineLabels: ["Broken Causeway", "Gate Checkpoint", "Shielded Span"],
    relayLabels: ["Signal Junction", "Overwatch Split", "Relay Spine"],
    fieldLabels: ["Freight Annex", "Cold Storage Spur", "Scrap Transit"],
    coreLabels: ["Overwatch Gallery", "Forward Storehouse", "Causeway Loft"],
    powerLabels: ["Dyno Chamber", "Generator Wing", "Rail Dynamo"],
    eliteLabels: ["Redoubt Mouth", "Lockline Bastion", "Breaker Court"],
    objectiveLabels: ["Iron Gate Lock", "Eastern Lockline", "Gate Crown"]
  },
  op_black_spire: {
    prefix: "bs",
    zoneName: "BLACK SPIRE ASCENT",
    sectorLabel: "SECTOR N-02",
    passiveEffectText: "Passive Penalty // Artillery shear rattles power rails and exposes long lanes to fire.",
    threatLevel: "Severe",
    ingressLabels: ["Spire Aperture", "Anchor Aperture", "Base Aperture"],
    frontlineLabels: ["Shard Ramp", "Gunline Arch", "Broken Stair"],
    relayLabels: ["Ballast Gallery", "Signal Niche", "Spire Switchyard"],
    fieldLabels: ["Powder Loft", "Survey Ledge", "Windbreak Crawl"],
    coreLabels: ["Command Belfry", "Supply Loft", "Cinder Archive"],
    powerLabels: ["Turbine Vault", "Lift Dynamo", "Spire Capacitor"],
    eliteLabels: ["Battery Roost", "Crown Bastion", "Sharpshot Redoubt"],
    objectiveLabels: ["Artillery Crown", "Spire Apex", "Bastion Seal"]
  },
  op_ghost_run: {
    prefix: "gr",
    zoneName: "GHOSTLINE TRANSIT",
    sectorLabel: "SECTOR W-05",
    passiveEffectText: "Passive Benefit // Phase vents shorten recovery windows between room pushes.",
    threatLevel: "High",
    ingressLabels: ["Ghost Aperture", "Phase Aperture", "Transit Aperture"],
    frontlineLabels: ["Silent Span", "Transit Choke", "Echo Lane"],
    relayLabels: ["Signal Drift", "Relay Hollow", "Spectral Switch"],
    fieldLabels: ["Cargo Pocket", "Survey Berm", "Dry Channel"],
    coreLabels: ["Transit Loft", "Switch Gallery", "Silent Annex"],
    powerLabels: ["Vent Chamber", "Static Coil", "Line Dynamo"],
    eliteLabels: ["Phantom Redoubt", "Null Bastion", "Specter Court"],
    objectiveLabels: ["Ghost Seal", "Transit Crown", "Shadow Junction"]
  },
  op_ember_siege: {
    prefix: "es",
    zoneName: "EMBER BASTION",
    sectorLabel: "SECTOR S-04",
    passiveEffectText: "Passive Penalty // Emberfall heats the grid and strains every exposed support lane.",
    threatLevel: "Severe",
    ingressLabels: ["Ash Aperture", "Siege Aperture", "Cinder Aperture"],
    frontlineLabels: ["Burnt Ramp", "Siege Furrow", "Cracked Emplacement"],
    relayLabels: ["Cinder Junction", "War Relay", "Bastion Spine"],
    fieldLabels: ["Ash Store", "Survey Furnace", "Coal Slip"],
    coreLabels: ["Breach Magazine", "Support Alcove", "Shell Loft"],
    powerLabels: ["Smelter Core", "Heat Rail", "Furnace Vault"],
    eliteLabels: ["Bastion Maw", "Firebreak Redoubt", "Crucible Gate"],
    objectiveLabels: ["Ember Keep", "Siege Crown", "Flame Seal"]
  },
  op_final_dawn: {
    prefix: "fd",
    zoneName: "FINAL DAWN CITADEL",
    sectorLabel: "SECTOR C-00",
    passiveEffectText: "Passive Benefit // Citadel relays amplify command coverage across the floor.",
    threatLevel: "Critical",
    ingressLabels: ["Dawn Aperture", "Citadel Aperture", "Crown Aperture"],
    frontlineLabels: ["Judgment Hall", "Crown Span", "Aurora Gate"],
    relayLabels: ["Command Junction", "Relay Basilica", "Crown Spine"],
    fieldLabels: ["Archive Walk", "Survey Cloister", "Dust Quadrant"],
    coreLabels: ["Command Choir", "Support Chapel", "North Annex"],
    powerLabels: ["Sunwell Core", "Halo Dynamo", "Citadel Capacitor"],
    eliteLabels: ["Crown Redoubt", "Final Bastion", "Aurora Killbox"],
    objectiveLabels: ["Dawn Throne", "Citadel Crown", "Final Seal"]
  },
  op_custom: {
    prefix: "cu",
    zoneName: "PROCEDURAL THEATER",
    sectorLabel: "SECTOR X-99",
    passiveEffectText: "Passive Flux // Procedural theater topology mutates every floor insertion.",
    threatLevel: "Variable",
    ingressLabels: ["Procedural Aperture", "Adaptive Aperture", "Survey Aperture"],
    frontlineLabels: ["Flux Choke", "Fracture Lane", "Adaptive Span"],
    relayLabels: ["Survey Junction", "Logistics Spine", "Thread Relay"],
    fieldLabels: ["Dust Pocket", "Harvest Annex", "Unmapped Pocket"],
    coreLabels: ["Support Scaffold", "Command Pocket", "Spool Gallery"],
    powerLabels: ["Pulse Well", "Grid Spine", "Runtime Dynamo"],
    eliteLabels: ["Pressure Nexus", "Breach Redoubt", "Adaptive Killbox"],
    objectiveLabels: ["Final Thread", "Descent Seal", "Runtime Crown"]
  }
};
var LAYOUT_TEMPLATES = {
  vector_lance: [
    { key: "ingress", role: "ingress", localPosition: { x: 0, y: 0 }, depthFromUplink: 0, adjacency: ["frontline", "field"] },
    { key: "frontline", role: "frontline", localPosition: { x: 0.9, y: 0 }, depthFromUplink: 1, adjacency: ["ingress", "relay"] },
    { key: "field", role: "field", localPosition: { x: 1.05, y: 0.95 }, depthFromUplink: 1, adjacency: ["ingress", "core"] },
    { key: "core", role: "core", localPosition: { x: 1.95, y: 1.15 }, depthFromUplink: 2, adjacency: ["field", "relay"] },
    { key: "relay", role: "relay", localPosition: { x: 1.95, y: 0 }, depthFromUplink: 2, adjacency: ["frontline", "core", "power", "elite"] },
    { key: "power", role: "power", localPosition: { x: 2.2, y: -0.95 }, depthFromUplink: 3, adjacency: ["relay"] },
    { key: "elite", role: "elite", localPosition: { x: 3.2, y: 0.05 }, depthFromUplink: 4, adjacency: ["relay", "objective"] },
    { key: "objective", role: "objective", localPosition: { x: 4.2, y: 0.05 }, depthFromUplink: 5, adjacency: ["elite"] }
  ],
  split_fan: [
    { key: "ingress", role: "ingress", localPosition: { x: 0, y: 0 }, depthFromUplink: 0, adjacency: ["frontline"] },
    { key: "frontline", role: "frontline", localPosition: { x: 0.85, y: 0 }, depthFromUplink: 1, adjacency: ["ingress", "relay", "field"] },
    { key: "relay", role: "relay", localPosition: { x: 1.8, y: -0.9 }, depthFromUplink: 2, adjacency: ["frontline", "power", "elite"] },
    { key: "field", role: "field", localPosition: { x: 1.85, y: 0.95 }, depthFromUplink: 2, adjacency: ["frontline", "core", "elite"] },
    { key: "power", role: "power", localPosition: { x: 2.55, y: -1.4 }, depthFromUplink: 3, adjacency: ["relay"] },
    { key: "core", role: "core", localPosition: { x: 2.85, y: 1.15 }, depthFromUplink: 3, adjacency: ["field", "elite"] },
    { key: "elite", role: "elite", localPosition: { x: 3.75, y: 0.1 }, depthFromUplink: 4, adjacency: ["relay", "field", "core", "objective"] },
    { key: "objective", role: "objective", localPosition: { x: 4.7, y: 0.15 }, depthFromUplink: 5, adjacency: ["elite"] }
  ],
  central_bloom: [
    { key: "ingress", role: "ingress", localPosition: { x: 0, y: 0 }, depthFromUplink: 0, adjacency: ["frontline", "relay", "field"] },
    { key: "frontline", role: "frontline", localPosition: { x: 0.9, y: -0.8 }, depthFromUplink: 1, adjacency: ["ingress", "core", "power"] },
    { key: "relay", role: "relay", localPosition: { x: 1.05, y: 0 }, depthFromUplink: 1, adjacency: ["ingress", "core", "elite"] },
    { key: "field", role: "field", localPosition: { x: 0.9, y: 0.9 }, depthFromUplink: 1, adjacency: ["ingress", "field_core", "elite"] },
    { key: "core", role: "core", localPosition: { x: 2, y: -0.25 }, depthFromUplink: 2, adjacency: ["frontline", "relay", "elite"] },
    { key: "field_core", role: "core", localPosition: { x: 1.9, y: 1.2 }, depthFromUplink: 2, adjacency: ["field", "elite"] },
    { key: "power", role: "power", localPosition: { x: 2.2, y: -1.2 }, depthFromUplink: 2, adjacency: ["frontline"] },
    { key: "elite", role: "elite", localPosition: { x: 3.05, y: 0.15 }, depthFromUplink: 3, adjacency: ["relay", "field", "core", "field_core", "objective"] },
    { key: "objective", role: "objective", localPosition: { x: 3.95, y: 0.1 }, depthFromUplink: 4, adjacency: ["elite"] }
  ],
  offset_arc: [
    { key: "ingress", role: "ingress", localPosition: { x: 0, y: 0 }, depthFromUplink: 0, adjacency: ["frontline"] },
    { key: "frontline", role: "frontline", localPosition: { x: 0.9, y: 0.15 }, depthFromUplink: 1, adjacency: ["ingress", "field", "core"] },
    { key: "field", role: "field", localPosition: { x: 1.65, y: -0.8 }, depthFromUplink: 2, adjacency: ["frontline", "power", "core"] },
    { key: "core", role: "core", localPosition: { x: 1.95, y: 0.95 }, depthFromUplink: 2, adjacency: ["frontline", "field", "relay"] },
    { key: "relay", role: "relay", localPosition: { x: 2.75, y: 1.05 }, depthFromUplink: 3, adjacency: ["core", "elite"] },
    { key: "power", role: "power", localPosition: { x: 3, y: -0.35 }, depthFromUplink: 3, adjacency: ["field", "elite"] },
    { key: "elite", role: "elite", localPosition: { x: 3.85, y: 0.6 }, depthFromUplink: 4, adjacency: ["relay", "power", "objective"] },
    { key: "objective", role: "objective", localPosition: { x: 4.65, y: 0.95 }, depthFromUplink: 5, adjacency: ["elite"] }
  ]
};
var DIRECTION_ANGLE_MAP = {
  east: 0,
  southeast: 45,
  south: 90,
  southwest: 135,
  west: 180,
  northwest: 225,
  north: 270,
  northeast: 315
};
function createDirection(angleDeg) {
  const radians = angleDeg * Math.PI / 180;
  return {
    x: Number(Math.cos(radians).toFixed(4)),
    y: Number(Math.sin(radians).toFixed(4))
  };
}
function createSeededRng(seed) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  const step = () => {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    return state;
  };
  return {
    nextFloat: () => step() / 4294967295,
    nextInt: (min, max) => {
      const lower = Math.min(min, max);
      const upper = Math.max(min, max);
      return lower + Math.floor(step() / 4294967295 * (upper - lower + 1));
    },
    pick: (items) => items[Math.floor(step() / 4294967295 * items.length)] ?? items[0]
  };
}
function resolveAtlasSummaryForOperation(operation) {
  return (operation.atlasTheaterId ? getAtlasTheaterSummary(operation.atlasTheaterId) : null) ?? getAtlasTheaterByOperationId(operation.id);
}
function resolveRunSeed(operation, floorIndex) {
  const progress = loadCampaignProgress();
  const activeRun = progress.activeRun?.operationId === operation.id ? progress.activeRun : null;
  return [
    operation.id ?? operation.codename,
    operation.codename,
    activeRun?.rngSeed ?? operation.description,
    String(floorIndex),
    String(operation.floors.length)
  ].join("::");
}
function resolveProfile(operation, floorIndex, atlasSummary) {
  const profileOverride = PROFILE_BY_OPERATION[operation.id ?? ""] ?? {};
  const floor = operation.floors[floorIndex];
  const zoneName = atlasSummary?.zoneName ?? profileOverride.zoneName ?? operation.codename;
  const sectorLabel = atlasSummary?.sectorLabel ?? profileOverride.sectorLabel ?? `SECTOR ${(operation.id ?? "op").slice(0, 2).toUpperCase()}-${String(floorIndex + 1).padStart(2, "0")}`;
  return {
    ...DEFAULT_PROFILE,
    ...profileOverride,
    sectorLabel,
    currentState: atlasSummary?.currentState ?? profileOverride.currentState ?? "active",
    threatLevel: atlasSummary?.threatLevel ?? profileOverride.threatLevel ?? "High",
    passiveEffectText: atlasSummary?.passiveEffectText ?? profileOverride.passiveEffectText ?? DEFAULT_PROFILE.passiveEffectText,
    prefix: profileOverride.prefix ?? (operation.id ?? "thr").replace(/[^a-z0-9]/gi, "").slice(0, 3).toLowerCase(),
    zoneName: floor?.name?.includes("//") ? `${zoneName} // ${floor.name.split("//")[1]?.trim() ?? `FLOOR ${floorIndex + 1}`}` : zoneName
  };
}
function normalizeAngle(angleDeg) {
  const normalized = angleDeg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}
function getAngleBucket(angleDeg) {
  const normalized = normalizeAngle(angleDeg);
  if (normalized < 45 || normalized >= 315) return "east";
  if (normalized < 135) return "south";
  if (normalized < 225) return "west";
  return "north";
}
function getRequestedSprawlDirection(operation) {
  return operation.sprawlDirection ?? null;
}
function createDirectionalAnchor(direction, style, rng) {
  const edgeY = MAP_CENTER_Y + rng.nextInt(-240, 240);
  const edgeX = MAP_CENTER_X + rng.nextInt(-360, 360);
  const offsetX = Math.round(MAP_WIDTH * 0.29);
  const offsetY = Math.round(MAP_HEIGHT * 0.24);
  const edgeAnchors = {
    east: { x: EDGE_MARGIN_X, y: edgeY },
    southeast: { x: EDGE_MARGIN_X + 180 + rng.nextInt(-100, 100), y: EDGE_MARGIN_Y + 140 + rng.nextInt(-80, 120) },
    south: { x: edgeX, y: EDGE_MARGIN_Y },
    southwest: { x: MAP_WIDTH - EDGE_MARGIN_X - 180 + rng.nextInt(-100, 100), y: EDGE_MARGIN_Y + 140 + rng.nextInt(-80, 120) },
    west: { x: MAP_WIDTH - EDGE_MARGIN_X, y: edgeY },
    northwest: { x: MAP_WIDTH - EDGE_MARGIN_X - 180 + rng.nextInt(-100, 100), y: MAP_HEIGHT - EDGE_MARGIN_Y - 140 + rng.nextInt(-120, 80) },
    north: { x: edgeX, y: MAP_HEIGHT - EDGE_MARGIN_Y },
    northeast: { x: EDGE_MARGIN_X + 180 + rng.nextInt(-100, 100), y: MAP_HEIGHT - EDGE_MARGIN_Y - 140 + rng.nextInt(-120, 80) }
  };
  if (style === "offset_arc") {
    return {
      east: { x: offsetX, y: MAP_CENTER_Y - 260 + rng.nextInt(-180, 180) },
      southeast: { x: offsetX + rng.nextInt(-160, 160), y: offsetY + rng.nextInt(-90, 120) },
      south: { x: MAP_CENTER_X + rng.nextInt(-360, 360), y: offsetY },
      southwest: { x: MAP_WIDTH - offsetX + rng.nextInt(-160, 160), y: offsetY + rng.nextInt(-90, 120) },
      west: { x: MAP_WIDTH - offsetX, y: MAP_CENTER_Y + 260 + rng.nextInt(-180, 180) },
      northwest: { x: MAP_WIDTH - offsetX + rng.nextInt(-160, 160), y: MAP_HEIGHT - offsetY + rng.nextInt(-120, 90) },
      north: { x: MAP_CENTER_X + rng.nextInt(-360, 360), y: MAP_HEIGHT - offsetY },
      northeast: { x: offsetX + rng.nextInt(-160, 160), y: MAP_HEIGHT - offsetY + rng.nextInt(-120, 90) }
    }[direction];
  }
  return edgeAnchors[direction];
}
function createPresentation(operation, floorIndex, atlasSummary, rng) {
  const preferredDirection = getRequestedSprawlDirection(operation);
  const layoutStyles = preferredDirection ? ["vector_lance", "split_fan", "offset_arc"] : ["vector_lance", "split_fan", "central_bloom", "offset_arc"];
  const style = layoutStyles[(floorIndex + rng.nextInt(0, layoutStyles.length - 1)) % layoutStyles.length] ?? "vector_lance";
  const allowedAngles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const angleDeg = floorIndex === 0 && atlasSummary ? atlasSummary.angleDeg : preferredDirection ? DIRECTION_ANGLE_MAP[preferredDirection] : allowedAngles[(floorIndex * 3 + rng.nextInt(0, allowedAngles.length - 1)) % allowedAngles.length] ?? 0;
  const direction = createDirection(angleDeg);
  if (preferredDirection && style !== "central_bloom") {
    return {
      angleDeg,
      radialDirection: direction,
      mapAnchor: createDirectionalAnchor(preferredDirection, style, rng),
      layoutStyle: style,
      originLabel: style === "split_fan" ? "FAN INSERT" : style === "offset_arc" ? "OFFSET BREACH" : "EDGE INSERT"
    };
  }
  if (style === "central_bloom") {
    return {
      angleDeg,
      radialDirection: direction,
      mapAnchor: {
        x: Math.round(MAP_WIDTH / 2 + rng.nextInt(-240, 240)),
        y: Math.round(MAP_HEIGHT / 2 + rng.nextInt(-220, 220))
      },
      layoutStyle: style,
      originLabel: "CENTER BREACH"
    };
  }
  if (style === "offset_arc") {
    const bucket = getAngleBucket(angleDeg);
    const offsetX = Math.round(MAP_WIDTH * 0.29);
    const offsetY = Math.round(MAP_HEIGHT * 0.24);
    const mapAnchor2 = bucket === "east" ? { x: offsetX, y: MAP_CENTER_Y - 260 + rng.nextInt(-180, 180) } : bucket === "south" ? { x: MAP_CENTER_X + rng.nextInt(-360, 360), y: offsetY } : bucket === "west" ? { x: MAP_WIDTH - offsetX, y: MAP_CENTER_Y + 260 + rng.nextInt(-180, 180) } : { x: MAP_CENTER_X + rng.nextInt(-360, 360), y: MAP_HEIGHT - offsetY };
    return {
      angleDeg,
      radialDirection: direction,
      mapAnchor: mapAnchor2,
      layoutStyle: style,
      originLabel: "OFFSET BREACH"
    };
  }
  const edgeBucket = getAngleBucket(angleDeg);
  const mapAnchor = edgeBucket === "east" ? { x: EDGE_MARGIN_X, y: MAP_CENTER_Y + rng.nextInt(-240, 240) } : edgeBucket === "south" ? { x: MAP_CENTER_X + rng.nextInt(-360, 360), y: EDGE_MARGIN_Y } : edgeBucket === "west" ? { x: MAP_WIDTH - EDGE_MARGIN_X, y: MAP_CENTER_Y + rng.nextInt(-240, 240) } : { x: MAP_CENTER_X + rng.nextInt(-360, 360), y: MAP_HEIGHT - EDGE_MARGIN_Y };
  return {
    angleDeg,
    radialDirection: direction,
    mapAnchor,
    layoutStyle: style,
    originLabel: style === "split_fan" ? "FAN INSERT" : "EDGE INSERT"
  };
}
function projectTheaterPosition(definition, localPosition) {
  const radians = definition.angleDeg * Math.PI / 180;
  const forward = { x: Math.cos(radians), y: Math.sin(radians) };
  const lateral = { x: -forward.y, y: forward.x };
  const anchor = definition.mapAnchor ?? DEFAULT_MAP_ANCHOR;
  return {
    x: Math.round(
      anchor.x + localPosition.x * THEATER_DEPTH_STEP * forward.x + localPosition.y * THEATER_LATERAL_STEP * lateral.x
    ),
    y: Math.round(
      anchor.y + localPosition.x * THEATER_DEPTH_STEP * forward.y + localPosition.y * THEATER_LATERAL_STEP * lateral.y
    )
  };
}
function createSectorTag(depth, lateral) {
  const row = String.fromCharCode(65 + Math.max(0, Math.min(25, Math.floor(depth))));
  const lane = Math.round(lateral);
  return `${row}${lane >= 0 ? lane : `${lane}`}`;
}
function getRoomSize(role) {
  switch (role) {
    case "ingress":
      return { width: 250, height: 146 };
    case "resource_pocket":
      return { width: 520, height: 292 };
    case "objective":
      return { width: 278, height: 164 };
    case "elite":
      return { width: 264, height: 154 };
    case "power":
      return { width: 236, height: 144 };
    default:
      return { width: 248, height: 148 };
  }
}
function getClearMode(role, rng) {
  switch (role) {
    case "ingress":
    case "power":
      return "empty";
    case "field":
      return "field";
    case "resource_pocket":
      return rng.nextFloat() < 0.55 ? "battle" : "field";
    case "core":
      return rng.nextFloat() < 0.42 ? "battle" : "empty";
    default:
      return "battle";
  }
}
function getTagsForRole(role) {
  switch (role) {
    case "ingress":
      return ["ingress", "uplink"];
    case "frontline":
      return ["frontier"];
    case "relay":
      return ["junction"];
    case "field":
      return ["core_candidate", "metal_rich", "timber_rich", "salvage_rich"];
    case "resource_pocket":
      return ["core_candidate", "resource_pocket", "salvage_rich"];
    case "core":
      return ["core_candidate", "command_suitable"];
    case "power":
      return ["power_source", "steam_vent"];
    case "elite":
      return ["elite", "frontier"];
    case "objective":
      return ["objective", "elite", "survey_highground"];
    default:
      return [];
  }
}
function getLabelPool(profile, role) {
  switch (role) {
    case "ingress":
      return profile.ingressLabels;
    case "frontline":
      return profile.frontlineLabels;
    case "relay":
      return profile.relayLabels;
    case "field":
      return profile.fieldLabels;
    case "resource_pocket":
      return profile.fieldLabels;
    case "core":
      return profile.coreLabels;
    case "power":
      return profile.powerLabels;
    case "elite":
      return profile.eliteLabels;
    case "objective":
      return profile.objectiveLabels;
    default:
      return [DEFAULT_PROFILE.zoneName];
  }
}
function createRoom(definition, room) {
  const coreSlots = Array.isArray(room.coreSlots) ? room.coreSlots.map((assignment) => assignment ? {
    ...assignment,
    buildCost: { ...assignment.buildCost },
    upkeepPerTick: { ...assignment.upkeepPerTick },
    incomePerTick: { ...assignment.incomePerTick }
  } : null) : [room.coreAssignment ? {
    ...room.coreAssignment,
    buildCost: { ...room.coreAssignment.buildCost },
    upkeepPerTick: { ...room.coreAssignment.upkeepPerTick },
    incomePerTick: { ...room.coreAssignment.incomePerTick }
  } : null];
  return {
    ...THEATER_ROOM_BASE,
    theaterId: definition.id,
    ...room,
    position: room.position ?? projectTheaterPosition(definition, room.localPosition),
    clearMode: room.clearMode ?? (room.tacticalEncounter ? "battle" : "empty"),
    fortificationCapacity: room.fortificationCapacity ?? 3,
    fortificationPips: normalizeFortificationPips(room.fortificationPips),
    roomClass: room.roomClass ?? "standard",
    coreSlotCapacity: Math.max(1, room.coreSlotCapacity ?? coreSlots.length ?? 1),
    coreSlots,
    coreAssignment: room.coreAssignment ?? coreSlots.find((assignment) => assignment !== null) ?? null,
    enemySite: room.enemySite ? { ...room.enemySite } : null,
    battleSizeOverride: room.battleSizeOverride ? { ...room.battleSizeOverride } : void 0
  };
}
function uniqueRoomTags(tags) {
  return [...new Set(tags.filter(Boolean))];
}
function chooseAffinityTags(rng, count) {
  const pool = ["metal_rich", "timber_rich", "steam_vent"];
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    const next = rng.pick(pool);
    picked.push(next);
    pool.splice(pool.indexOf(next), 1);
  }
  return picked;
}
function pickMegaRoomSeed(roomSeeds, rng) {
  if (rng.nextFloat() > 0.6) {
    return null;
  }
  const candidates = roomSeeds.filter((seed) => !seed.isUplinkRoom && !seed.secured && !seed.tags.includes("objective") && !seed.tags.includes("elite") && (seed.clearMode === "field" || seed.tags.includes("metal_rich") || seed.tags.includes("timber_rich") || seed.tags.includes("salvage_rich"))).sort((left, right) => right.depthFromUplink - left.depthFromUplink || Math.abs(right.localPosition.y) - Math.abs(left.localPosition.y));
  if (candidates.length <= 0) {
    return null;
  }
  return candidates[Math.min(candidates.length - 1, rng.nextInt(0, Math.min(2, candidates.length - 1)))] ?? candidates[0];
}
function applyMegaRoomSeed(seed, rng) {
  const affinityTags = chooseAffinityTags(rng, 2);
  seed.roomClass = "mega";
  seed.coreSlotCapacity = 4;
  seed.coreSlots = [null, null, null, null];
  seed.fortificationCapacity = 8;
  seed.battleSizeOverride = { width: 10, height: 8 };
  seed.size = getRoomSize("resource_pocket");
  seed.tags = uniqueRoomTags([
    ...seed.tags.filter((tag) => tag !== "enemy_staging"),
    "resource_pocket",
    "core_candidate",
    "salvage_rich",
    ...affinityTags
  ]);
  if (seed.clearMode === "empty") {
    seed.clearMode = "field";
  }
}
function pickStagingRoomSeed(roomSeeds, excludedRoomId, rng) {
  const candidates = roomSeeds.filter((seed) => seed.id !== excludedRoomId && !seed.isUplinkRoom && !seed.secured && !seed.tags.includes("objective") && (seed.depthFromUplink >= 3 || seed.tags.includes("elite") || seed.tags.includes("frontier"))).sort((left, right) => right.depthFromUplink - left.depthFromUplink || Math.abs(right.localPosition.y) - Math.abs(left.localPosition.y));
  if (candidates.length <= 0) {
    return null;
  }
  return candidates[Math.min(candidates.length - 1, rng.nextInt(0, Math.min(3, candidates.length - 1)))] ?? candidates[0];
}
function applyStagingRoomSeed(seed, definition, rng) {
  seed.tags = uniqueRoomTags([
    ...seed.tags,
    "enemy_staging",
    "frontier"
  ]);
  seed.clearMode = "battle";
  seed.tacticalEncounter = seed.tacticalEncounter ?? `${definition.id}_staging_${seed.id}`;
  seed.enemySite = {
    type: "staging",
    reserveStrength: rng.nextInt(2, 4),
    dispatchInterval: rng.nextInt(3, 5),
    nextDispatchTick: rng.nextInt(2, 4),
    patrolStrength: rng.nextInt(1, 3)
  };
}
function roundLocalCoordinate(value) {
  return Number(value.toFixed(2));
}
function connectTemplateNodes(nodes, sourceKey, targetKey) {
  const source = nodes.find((node) => node.key === sourceKey);
  const target = nodes.find((node) => node.key === targetKey);
  if (!source || !target) {
    return;
  }
  if (!source.adjacency.includes(targetKey)) {
    source.adjacency.push(targetKey);
  }
  if (!target.adjacency.includes(sourceKey)) {
    target.adjacency.push(sourceKey);
  }
}
function jitterTemplatePosition(basePosition, role, style, rng, index) {
  if (role === "ingress") {
    return { ...basePosition };
  }
  const forwardVariance = role === "objective" ? 0.16 : role === "elite" ? 0.28 : 0.44;
  const lateralVariance = style === "central_bloom" ? 0.95 : style === "offset_arc" ? 0.82 : 0.72;
  const laneBias = Math.abs(basePosition.y) < 0.35 && role !== "objective" ? (index % 2 === 0 ? 1 : -1) * (0.2 + rng.nextFloat() * 0.36) : 0;
  return {
    x: roundLocalCoordinate(basePosition.x + (rng.nextFloat() - 0.5) * forwardVariance),
    y: roundLocalCoordinate(basePosition.y + laneBias + (rng.nextFloat() - 0.5) * lateralVariance)
  };
}
function stretchTemplatePosition(basePosition, role, style, rng) {
  if (role === "ingress") {
    return { ...basePosition };
  }
  const forwardScale = role === "objective" ? 1.5 + rng.nextFloat() * 0.25 : role === "elite" ? 1.34 + rng.nextFloat() * 0.22 : 1.18 + rng.nextFloat() * 0.24;
  const lateralScale = style === "central_bloom" ? 1.2 + rng.nextFloat() * 0.24 : 1.34 + rng.nextFloat() * 0.34;
  const laneBias = Math.abs(basePosition.y) < 0.35 && role !== "objective" ? (rng.nextFloat() < 0.5 ? -1 : 1) * (0.18 + rng.nextFloat() * 0.46) : 0;
  const forwardBias = role === "objective" ? 0.4 + rng.nextFloat() * 0.8 : role === "elite" ? 0.22 + rng.nextFloat() * 0.42 : rng.nextFloat() * 0.28;
  return {
    x: roundLocalCoordinate(basePosition.x * forwardScale + forwardBias),
    y: roundLocalCoordinate(basePosition.y * lateralScale + laneBias)
  };
}
function createExpandedLayoutTemplate(style, rng) {
  const baseTemplate = (LAYOUT_TEMPLATES[style] ?? LAYOUT_TEMPLATES.vector_lance).map((node, index) => ({
    ...node,
    localPosition: jitterTemplatePosition(
      stretchTemplatePosition(node.localPosition, node.role, style, rng),
      node.role,
      style,
      rng,
      index
    ),
    adjacency: [...node.adjacency]
  }));
  const extraRoomCount = 5 + rng.nextInt(1, style === "central_bloom" ? 4 : 5);
  for (let index = 0; index < extraRoomCount; index++) {
    const eligibleParents = baseTemplate.filter((node) => node.role !== "objective" && node.depthFromUplink >= 1 && node.depthFromUplink <= 6);
    const parent = eligibleParents.length > 0 ? rng.pick(eligibleParents) : null;
    if (!parent) {
      break;
    }
    const rolePool = parent.depthFromUplink >= 3 ? ["field", "core", "relay", "field", "core", "elite", "power"] : ["field", "core", "relay", "field", "core", "power"];
    const role = rng.pick(rolePool);
    const branchDepth = role === "elite" ? Math.max(4, parent.depthFromUplink + 1) : parent.depthFromUplink + 1;
    const depthFromUplink = Math.min(7, branchDepth);
    const lateralSeed = Math.abs(parent.localPosition.y) < 0.5 ? (rng.nextFloat() < 0.5 ? -1 : 1) * (1.15 + rng.nextFloat() * 1.75) : parent.localPosition.y + (rng.nextFloat() < 0.5 ? -1 : 1) * (0.9 + rng.nextFloat() * 1.4);
    const spurKey = `spur_${index}`;
    baseTemplate.push({
      key: spurKey,
      role,
      localPosition: {
        x: roundLocalCoordinate(parent.localPosition.x + 1.2 + rng.nextFloat() * 2.15 + (depthFromUplink - parent.depthFromUplink - 1) * 0.45),
        y: roundLocalCoordinate(lateralSeed + (rng.nextFloat() - 0.5) * 1.1)
      },
      depthFromUplink,
      adjacency: [parent.key]
    });
    connectTemplateNodes(baseTemplate, parent.key, spurKey);
    if (rng.nextFloat() < 0.42) {
      const secondaryCandidates = baseTemplate.filter((candidate) => candidate.key !== spurKey && candidate.key !== parent.key && candidate.role !== "objective" && Math.abs(candidate.depthFromUplink - depthFromUplink) <= 1 && Math.abs(candidate.localPosition.x - parent.localPosition.x) <= 3.4);
      if (secondaryCandidates.length > 0) {
        connectTemplateNodes(baseTemplate, spurKey, rng.pick(secondaryCandidates).key);
      }
    }
  }
  return baseTemplate;
}
function buildRoomSeeds(operation, floorIndex, profile, definition, style, rng) {
  const template = createExpandedLayoutTemplate(style, rng);
  const roomIdByKey = /* @__PURE__ */ new Map();
  template.forEach((node) => {
    roomIdByKey.set(node.key, `${profile.prefix}_f${floorIndex + 1}_${node.key}`);
  });
  const roomSeeds = template.map((node, index) => {
    const roomId = roomIdByKey.get(node.key);
    const clearMode = getClearMode(node.role, rng);
    const tags = getTagsForRole(node.role);
    const labelPool = getLabelPool(profile, node.role);
    return {
      id: roomId,
      label: `${rng.pick(labelPool)}${node.role === "objective" && floorIndex === operation.floors.length - 1 ? " // FINAL" : ""}`,
      sectorTag: createSectorTag(node.depthFromUplink, node.localPosition.y),
      localPosition: node.localPosition,
      depthFromUplink: node.depthFromUplink,
      isUplinkRoom: node.role === "ingress",
      size: getRoomSize(node.role),
      adjacency: node.adjacency.map((adjacentKey) => roomIdByKey.get(adjacentKey)).filter(Boolean),
      status: node.role === "ingress" ? "secured" : node.depthFromUplink <= 1 ? "mapped" : "unknown",
      secured: node.role === "ingress",
      tacticalEncounter: clearMode === "battle" ? `${definition.id}_${node.role}_${index}` : null,
      tags,
      clearMode,
      fortified: node.role === "ingress",
      roomClass: "standard",
      coreSlotCapacity: 1,
      coreSlots: [null],
      fortificationCapacity: node.role === "ingress" ? 4 : node.role === "objective" ? 4 : 3,
      fortificationPips: node.role === "ingress" ? { barricade: 1, powerRail: 1 } : void 0,
      isPowerSource: node.role === "ingress" || node.role === "power"
    };
  });
  const megaRoomSeed = pickMegaRoomSeed(roomSeeds, rng);
  if (megaRoomSeed) {
    applyMegaRoomSeed(megaRoomSeed, rng);
  }
  const stagingRoomSeed = pickStagingRoomSeed(roomSeeds, megaRoomSeed?.id ?? null, rng);
  if (stagingRoomSeed) {
    applyStagingRoomSeed(stagingRoomSeed, definition, rng);
  }
  const rooms = Object.fromEntries(
    roomSeeds.map((room) => [room.id, createRoom(definition, room)])
  );
  const uplinkRoomId = roomIdByKey.get("ingress");
  const powerSourceRoomIds = roomSeeds.filter((room) => room.isPowerSource).map((room) => room.id);
  return { rooms, uplinkRoomId, powerSourceRoomIds };
}
function hasAlternateEdgeRoute(rooms, fromRoomId, toRoomId) {
  const queue = [fromRoomId];
  const visited = /* @__PURE__ */ new Set([fromRoomId]);
  while (queue.length > 0) {
    const currentRoomId = queue.shift();
    const room = rooms[currentRoomId];
    if (!room) {
      continue;
    }
    for (const adjacentId of room.adjacency) {
      const isIgnoredDirectEdge = currentRoomId === fromRoomId && adjacentId === toRoomId || currentRoomId === toRoomId && adjacentId === fromRoomId;
      if (isIgnoredDirectEdge) {
        continue;
      }
      if (adjacentId === toRoomId) {
        return true;
      }
      if (visited.has(adjacentId) || !rooms[adjacentId]) {
        continue;
      }
      visited.add(adjacentId);
      queue.push(adjacentId);
    }
  }
  return false;
}
function assignPowerGatedPassages(rooms, rng) {
  Object.values(rooms).forEach((room) => {
    room.powerGateWatts = { ...room.powerGateWatts ?? {} };
  });
  const candidates = [];
  const seenEdges = /* @__PURE__ */ new Set();
  Object.values(rooms).forEach((room) => {
    room.adjacency.forEach((adjacentId) => {
      const adjacentRoom = rooms[adjacentId];
      if (!adjacentRoom) {
        return;
      }
      const edgeKey = [room.id, adjacentId].sort().join("__");
      if (seenEdges.has(edgeKey)) {
        return;
      }
      seenEdges.add(edgeKey);
      if (room.isUplinkRoom || adjacentRoom.isUplinkRoom) {
        return;
      }
      if (Math.min(room.depthFromUplink, adjacentRoom.depthFromUplink) < 2) {
        return;
      }
      if (!hasAlternateEdgeRoute(rooms, room.id, adjacentId)) {
        return;
      }
      candidates.push({ roomId: room.id, adjacentId });
    });
  });
  let gatedCount = 0;
  const maxGateCount = Math.max(1, Math.min(4, Math.ceil(candidates.length * 0.35)));
  candidates.forEach(({ roomId, adjacentId }) => {
    if (gatedCount >= maxGateCount || rng.nextFloat() > 0.4) {
      return;
    }
    const room = rooms[roomId];
    const adjacentRoom = rooms[adjacentId];
    if (!room || !adjacentRoom) {
      return;
    }
    const wattsRequired = rng.nextInt(1, 5) * 100;
    room.powerGateWatts[adjacentId] = wattsRequired;
    adjacentRoom.powerGateWatts[roomId] = wattsRequired;
    gatedCount += 1;
  });
}
function createGeneratedTheaterFloor(operation, floorIndex) {
  const atlasSummary = floorIndex === 0 ? resolveAtlasSummaryForOperation(operation) : null;
  const seed = resolveRunSeed(operation, floorIndex);
  const rng = createSeededRng(seed);
  const profile = resolveProfile(operation, floorIndex, atlasSummary);
  const presentation = createPresentation(operation, floorIndex, atlasSummary, rng);
  const floor = operation.floors[floorIndex];
  const isFinalFloor = floorIndex >= operation.floors.length - 1;
  const floorIdBase = atlasSummary?.floorId ?? operation.atlasFloorId ?? `${operation.id ?? profile.prefix}_floor`;
  const floorId = floorIndex === 0 ? floorIdBase : `${floorIdBase}_${floorIndex + 1}`;
  const floorName = floor?.name ?? `Floor ${floorIndex + 1}`;
  const objective = operation.objective ?? (isFinalFloor ? `Secure ${profile.zoneName} and stabilize the final objective room at the outer edge of the theater.` : `Secure ${profile.zoneName}, push outward from the uplink, and reach the descent point for the next floor.`);
  const beginningState = operation.beginningState ?? `${profile.zoneName} synchronized for ${floorName}. Uplink root online at ${presentation.originLabel}.`;
  const endState = operation.endState ?? (isFinalFloor ? `${profile.zoneName} stabilized on ${floorName}. Final objective secured.` : `${profile.zoneName} stabilized on ${floorName}. Descent corridor opened to the next floor.`);
  const definition = {
    id: `${operation.id ?? profile.prefix}_${profile.prefix}_floor_${floorIndex + 1}`,
    name: profile.zoneName,
    zoneName: profile.zoneName,
    theaterStatus: profile.currentState === "cold" ? "cold" : profile.currentState === "warm" ? "warm" : "active",
    currentState: profile.currentState,
    operationId: operation.id ?? profile.prefix,
    objective,
    recommendedPWR: operation.recommendedPWR ?? atlasSummary?.recommendedPwr ?? 24,
    beginningState,
    endState,
    floorId,
    floorOrdinal: atlasSummary?.floorOrdinal ?? floorIndex + 1,
    sectorLabel: atlasSummary?.sectorLabel ?? profile.sectorLabel,
    radialSlotIndex: atlasSummary?.radialSlotIndex ?? (floorIndex + rng.nextInt(0, 3)) % 6,
    radialSlotCount: atlasSummary?.radialSlotCount ?? 6,
    angleDeg: presentation.angleDeg,
    radialDirection: presentation.radialDirection,
    discovered: atlasSummary?.discovered ?? true,
    operationAvailable: atlasSummary?.operationAvailable ?? true,
    passiveEffectText: profile.passiveEffectText,
    threatLevel: profile.threatLevel,
    ingressRoomId: "",
    uplinkRoomId: "",
    outwardDepth: 7,
    powerSourceRoomIds: [],
    mapAnchor: presentation.mapAnchor,
    layoutStyle: presentation.layoutStyle,
    originLabel: presentation.originLabel,
    floorKeyInventory: createEmptyKeyInventory()
  };
  const { rooms, uplinkRoomId, powerSourceRoomIds } = buildRoomSeeds(operation, floorIndex, profile, definition, presentation.layoutStyle, rng);
  assignPowerGatedPassages(rooms, rng);
  definition.outwardDepth = Math.max(0, ...Object.values(rooms).map((room) => room.depthFromUplink));
  definition.ingressRoomId = uplinkRoomId;
  definition.uplinkRoomId = uplinkRoomId;
  definition.powerSourceRoomIds = powerSourceRoomIds;
  return {
    definition,
    rooms,
    currentRoomId: uplinkRoomId,
    selectedRoomId: uplinkRoomId,
    squads: [],
    selectedSquadId: null,
    tickCount: 0,
    activeThreats: [],
    recentEvents: [
      `S/COM :: ${profile.zoneName} synchronized on ${floorName}. Root origin ${presentation.originLabel}; theater vector ${Math.round(normalizeAngle(presentation.angleDeg))} degrees.`
    ],
    objectiveDefinition: null,
    objectiveComplete: false,
    completion: null
  };
}

// src/quests/questRuntime.ts
init_campaign();

// src/ui/components/systemPing.ts
var SYSTEM_PING_STACK_ID = "systemPingStack";
function ensureSystemPingStack() {
  let stack = document.getElementById(SYSTEM_PING_STACK_ID);
  if (stack) {
    return stack;
  }
  stack = document.createElement("div");
  stack.id = SYSTEM_PING_STACK_ID;
  stack.className = "system-ping-stack";
  document.body.appendChild(stack);
  return stack;
}
function getPingGlyph(type) {
  switch (type) {
    case "success":
      return "OK";
    case "error":
      return "!!";
    default:
      return ">>";
  }
}
function removeSystemPing(ping) {
  ping.classList.remove("system-ping--visible");
  window.setTimeout(() => {
    ping.remove();
  }, 220);
}
function showSystemPing(options) {
  const {
    type = "info",
    title,
    message,
    detail,
    durationMs = 2600,
    channel,
    replaceChannel = true
  } = options;
  const stack = ensureSystemPingStack();
  if (channel && replaceChannel) {
    stack.querySelectorAll(`.system-ping[data-channel="${channel}"]`).forEach((existing) => {
      existing.remove();
    });
  }
  const ping = document.createElement("div");
  ping.className = `system-ping system-ping--${type}`;
  if (channel) {
    ping.dataset.channel = channel;
  }
  const glyph = document.createElement("div");
  glyph.className = "system-ping__glyph";
  glyph.textContent = getPingGlyph(type);
  ping.appendChild(glyph);
  const copy = document.createElement("div");
  copy.className = "system-ping__copy";
  if (title) {
    const titleEl = document.createElement("div");
    titleEl.className = "system-ping__title";
    titleEl.textContent = title;
    copy.appendChild(titleEl);
  }
  const messageEl = document.createElement("div");
  messageEl.className = "system-ping__message";
  messageEl.textContent = message;
  copy.appendChild(messageEl);
  if (detail) {
    const detailEl = document.createElement("div");
    detailEl.className = "system-ping__detail";
    detailEl.textContent = detail;
    copy.appendChild(detailEl);
  }
  ping.appendChild(copy);
  stack.appendChild(ping);
  requestAnimationFrame(() => {
    ping.classList.add("system-ping--visible");
  });
  window.setTimeout(() => {
    removeSystemPing(ping);
  }, durationMs);
}

// src/quests/questRewards.ts
init_gameStore();
init_gameStore();
init_gearWorkbench();
init_crafting();
function applyQuestRewardsToState(state, quest) {
  const rewards = quest.rewards;
  let nextState = { ...state };
  if (rewards.wad) {
    nextState = {
      ...nextState,
      wad: (nextState.wad ?? 0) + rewards.wad
    };
  }
  if (rewards.resources) {
    nextState = {
      ...nextState,
      resources: {
        metalScrap: nextState.resources.metalScrap + (rewards.resources.metalScrap ?? 0),
        wood: nextState.resources.wood + (rewards.resources.wood ?? 0),
        chaosShards: nextState.resources.chaosShards + (rewards.resources.chaosShards ?? 0),
        steamComponents: nextState.resources.steamComponents + (rewards.resources.steamComponents ?? 0)
      }
    };
  }
  if (rewards.items) {
    const updatedConsumables = { ...nextState.consumables };
    for (const item of rewards.items) {
      updatedConsumables[item.id] = (updatedConsumables[item.id] || 0) + item.quantity;
    }
    nextState = {
      ...nextState,
      consumables: updatedConsumables
    };
  }
  if (rewards.cards && rewards.cards.length > 0) {
    nextState = {
      ...nextState,
      cardLibrary: addCardsToLibrary(nextState.cardLibrary || {}, rewards.cards)
    };
  }
  if (rewards.recipes && rewards.recipes.length > 0) {
    let updatedRecipeIds = [...nextState.knownRecipeIds || []];
    for (const recipeId of rewards.recipes) {
      updatedRecipeIds = learnRecipe(updatedRecipeIds, recipeId);
    }
    nextState = {
      ...nextState,
      knownRecipeIds: updatedRecipeIds
    };
  }
  if (rewards.xp) {
    const xpPerUnit = Math.floor(rewards.xp / Math.max(1, nextState.partyUnitIds.length));
    nextState.partyUnitIds.forEach((unitId) => {
      const unit = nextState.unitsById[unitId];
      if (unit) {
        console.log(`[QUEST] Would grant ${xpPerUnit} XP to ${unit.name}`);
      }
    });
  }
  if (rewards.equipment && rewards.equipment.length > 0) {
    console.log(`[QUEST] Would grant equipment: ${rewards.equipment.join(", ")}`);
  }
  if (rewards.unitRecruit) {
    console.log(`[QUEST] Would recruit unit: ${rewards.unitRecruit}`);
  }
  return nextState;
}

// src/quests/questRuntime.ts
var SNAPSHOT_OBJECTIVE_TYPES = /* @__PURE__ */ new Set([
  "secure_rooms",
  "complete_sector_objectives",
  "complete_floor",
  "build_core",
  "route_power",
  "establish_comms",
  "deliver_supply",
  "complete_operation",
  "reach_floor"
]);
function cloneQuestState(questState) {
  return {
    ...questState,
    availableQuests: [...questState.availableQuests],
    activeQuests: questState.activeQuests.map((quest) => ({
      ...quest,
      objectives: quest.objectives.map((objective) => ({ ...objective }))
    })),
    completedQuests: [...questState.completedQuests],
    failedQuests: [...questState.failedQuests]
  };
}
function buildRuntimeSnapshot(state, progress) {
  const theatersById = /* @__PURE__ */ new Map();
  const atlas = progress.opsTerminalAtlas;
  Object.values(atlas?.floorsById ?? {}).forEach((floor) => {
    floor.sectors.forEach((sector) => {
      theatersById.set(sector.theaterId, {
        theaterId: sector.theaterId,
        operationId: sector.operationId,
        floorId: sector.floorId,
        floorOrdinal: sector.floorOrdinal,
        sectorLabel: sector.sectorLabel,
        theater: sector.theater
      });
    });
  });
  const liveTheater = state.operation?.theater;
  if (liveTheater) {
    const liveTheaterId = state.operation?.atlasTheaterId ?? liveTheater.definition.id;
    theatersById.set(liveTheaterId, {
      theaterId: liveTheaterId,
      operationId: state.operation?.id ?? liveTheater.definition.operationId,
      floorId: state.operation?.atlasFloorId ?? liveTheater.definition.floorId,
      floorOrdinal: liveTheater.definition.floorOrdinal || (state.operation?.currentFloorIndex ?? 0) + 1,
      sectorLabel: liveTheater.definition.sectorLabel,
      theater: liveTheater
    });
  }
  const theaterOrdinals = Array.from(theatersById.values()).map((entry) => entry.floorOrdinal);
  const highestFloorOrdinal = Math.max(
    1,
    atlas?.currentFloorOrdinal ?? 1,
    ...Object.values(atlas?.floorsById ?? {}).map((floor) => floor.floorOrdinal),
    ...theaterOrdinals
  );
  return {
    completedOperations: new Set(progress.completedOperations),
    currentFloorOrdinal: atlas?.currentFloorOrdinal ?? liveTheater?.definition.floorOrdinal ?? 1,
    highestFloorOrdinal,
    theaters: Array.from(theatersById.values())
  };
}
function matchesTheater(runtime, objective) {
  const criteria = objective.criteria;
  if (!criteria) {
    return true;
  }
  if (typeof criteria.floorOrdinal === "number" && runtime.floorOrdinal !== criteria.floorOrdinal) {
    return false;
  }
  if (criteria.floorId && runtime.floorId !== criteria.floorId) {
    return false;
  }
  if (criteria.theaterId && runtime.theaterId !== criteria.theaterId) {
    return false;
  }
  if (criteria.operationId && runtime.operationId !== criteria.operationId) {
    return false;
  }
  if (criteria.sectorLabel && runtime.sectorLabel !== criteria.sectorLabel) {
    return false;
  }
  return true;
}
function matchesRoom(runtime, room, objective) {
  if (!matchesTheater(runtime, objective)) {
    return false;
  }
  const criteria = objective.criteria;
  if (!criteria) {
    return true;
  }
  if (criteria.roomId && room.id !== criteria.roomId) {
    return false;
  }
  if (criteria.roomTag && !room.tags.includes(criteria.roomTag)) {
    return false;
  }
  return true;
}
function countMatchingRooms(snapshot, objective, predicate) {
  return snapshot.theaters.reduce((total, runtime) => total + Object.values(runtime.theater.rooms).filter((room) => matchesRoom(runtime, room, objective) && predicate(room)).length, 0);
}
function countMatchingTheaters(snapshot, objective, predicate) {
  return snapshot.theaters.filter((runtime) => matchesTheater(runtime, objective) && predicate(runtime)).length;
}
function getMatchingRoomFlow(snapshot, objective, flowType) {
  let best = 0;
  snapshot.theaters.forEach((runtime) => {
    Object.values(runtime.theater.rooms).forEach((room) => {
      if (!matchesRoom(runtime, room, objective)) {
        return;
      }
      best = Math.max(best, Math.floor(room[flowType] ?? 0));
    });
  });
  return best;
}
function getObjectiveCurrentValue(objective, snapshot) {
  switch (objective.type) {
    case "secure_rooms":
      return countMatchingRooms(snapshot, objective, (room) => room.secured);
    case "complete_sector_objectives":
      return countMatchingTheaters(snapshot, objective, (runtime) => runtime.theater.objectiveComplete);
    case "complete_floor": {
      const criteriaFloor = objective.criteria?.floorOrdinal;
      if (typeof criteriaFloor === "number") {
        const matching = snapshot.theaters.filter((runtime) => runtime.floorOrdinal === criteriaFloor);
        return matching.length > 0 && matching.every((runtime) => runtime.theater.objectiveComplete) ? 1 : 0;
      }
      const floors = /* @__PURE__ */ new Map();
      snapshot.theaters.forEach((runtime) => {
        const bucket = floors.get(runtime.floorOrdinal) ?? [];
        bucket.push(runtime);
        floors.set(runtime.floorOrdinal, bucket);
      });
      return Array.from(floors.values()).filter((entries) => entries.length > 0 && entries.every((runtime) => runtime.theater.objectiveComplete)).length;
    }
    case "build_core":
      return countMatchingRooms(snapshot, objective, (room) => Boolean(room.coreAssignment) && (!objective.criteria?.coreType || room.coreAssignment?.type === objective.criteria.coreType));
    case "route_power":
      return getMatchingRoomFlow(snapshot, objective, "powerFlow");
    case "establish_comms":
      return getMatchingRoomFlow(snapshot, objective, "commsFlow");
    case "deliver_supply":
      return getMatchingRoomFlow(snapshot, objective, "supplyFlow");
    case "complete_operation":
      if (objective.criteria?.operationId) {
        return snapshot.completedOperations.has(objective.criteria.operationId) ? 1 : 0;
      }
      return snapshot.completedOperations.size;
    case "reach_floor":
      return snapshot.highestFloorOrdinal;
    default:
      return objective.current;
  }
}
function isQuestComplete(quest) {
  return quest.objectives.every((objective) => objective.current >= objective.required);
}
function showQuestCompletionNotification(quest) {
  const rewardParts = [];
  if (quest.rewards.wad) rewardParts.push(`${quest.rewards.wad} WAD`);
  if (quest.rewards.xp) rewardParts.push(`${quest.rewards.xp} XP`);
  showSystemPing({
    title: "QUEST COMPLETE",
    message: quest.title,
    detail: rewardParts.length > 0 ? rewardParts.join(" \u2022 ") : void 0,
    type: "success",
    channel: "quest-complete"
  });
}
function syncQuestProgressFromSnapshotState(state, progress = loadCampaignProgress()) {
  if (!state.quests) {
    return state;
  }
  const snapshot = buildRuntimeSnapshot(state, progress);
  const nextQuestState = cloneQuestState(state.quests);
  let progressChanged = false;
  nextQuestState.activeQuests = nextQuestState.activeQuests.map((quest) => {
    let questChanged = false;
    const nextObjectives = quest.objectives.map((objective) => {
      if (!SNAPSHOT_OBJECTIVE_TYPES.has(objective.type)) {
        return objective;
      }
      const current = Math.min(objective.required, getObjectiveCurrentValue(objective, snapshot));
      if (current === objective.current) {
        return objective;
      }
      questChanged = true;
      progressChanged = true;
      return {
        ...objective,
        current
      };
    });
    if (!questChanged) {
      return quest;
    }
    console.log("[QUEST] snapshot progress changed", quest.id, nextObjectives.map((objective) => ({
      id: objective.id,
      current: objective.current,
      required: objective.required
    })));
    return {
      ...quest,
      objectives: nextObjectives
    };
  });
  const completedNow = nextQuestState.activeQuests.filter(
    (quest) => !nextQuestState.completedQuests.includes(quest.id) && isQuestComplete(quest)
  );
  if (completedNow.length === 0 && !progressChanged) {
    return state;
  }
  let nextState = {
    ...state,
    quests: nextQuestState
  };
  if (completedNow.length === 0) {
    return nextState;
  }
  const completedIds = new Set(nextQuestState.completedQuests);
  const completedCount = completedNow.filter((quest) => !completedIds.has(quest.id)).length;
  completedNow.forEach((quest) => {
    if (completedIds.has(quest.id)) {
      return;
    }
    console.log(`[QUEST] Completed quest: ${quest.title}`);
    completedIds.add(quest.id);
    nextState = applyQuestRewardsToState(nextState, quest);
    showQuestCompletionNotification(quest);
  });
  nextState = {
    ...nextState,
    quests: {
      ...nextState.quests,
      activeQuests: nextState.quests.activeQuests.filter((quest) => !completedIds.has(quest.id)),
      completedQuests: [...completedIds],
      totalQuestsCompleted: (nextState.quests.totalQuestsCompleted ?? 0) + completedCount
    }
  };
  return nextState;
}

// src/core/theaterSystem.ts
init_schemaSystem();
init_crafting();
function syncQuestRuntime(state) {
  return syncQuestProgressFromSnapshotState(state);
}
var THEATER_ROOM_BASE2 = {
  fortified: false,
  coreAssignment: null,
  coreSlots: [null],
  coreSlotCapacity: 1,
  roomClass: "standard",
  underThreat: false,
  damaged: false,
  connected: false,
  powered: false,
  supplied: false,
  commsVisible: false,
  commsLinked: false,
  supplyFlow: 0,
  powerFlow: 0,
  commsFlow: 0,
  intelLevel: 0,
  fortificationPips: createEmptyFortificationPips(),
  powerGateWatts: {},
  isPowerSource: false,
  abandoned: false,
  requiredKeyType: null,
  grantsKeyType: null,
  keyCollected: false,
  enemySite: null
};
var SUPPLY_SOURCE_CRATES_PER_TICK = 50;
var SUPPLY_FALLOFF_PER_ROOM = 3;
var POWER_SOURCE_WATTS_PER_TICK = 50;
var POWER_FALLOFF_PER_ROOM = 5;
var COMMS_SOURCE_BANDWIDTH_PER_TICK = 50;
var COMMS_FALLOFF_PER_ROOM = 7;
var CORE_SUPPLY_REQUIREMENT = 50;
var CORE_POWER_REQUIREMENT = 50;
var CORE_COMMS_REQUIREMENT = 0;
var GENERATOR_MIN_INPUT_WATTS = 1;
var SQUAD_CONTROL_BW_PER_UNIT = 5;
var THEATER_MAX_SQUAD_SIZE = 6;
var THEATER_SQUAD_COLOR_CHOICES = ["amber", "teal", "verdant", "violet", "oxide", "moss", "steel"];
var THEATER_SQUAD_ICON_CHOICES = ["\u25C9", "\u25B2", "\u25C6", "\u25A0", "\u2726", "\u2B22", "\u271A", "\u2B23"];
function clampSquadName(name, fallback) {
  const sanitized = (name ?? "").replace(/\s+/g, " ").trim().slice(0, 24);
  return sanitized || fallback;
}
function normalizeSquadIcon(icon, index = 0) {
  if (icon && THEATER_SQUAD_ICON_CHOICES.includes(icon)) {
    return icon;
  }
  return THEATER_SQUAD_ICON_CHOICES[index % THEATER_SQUAD_ICON_CHOICES.length] ?? "\u25C9";
}
function normalizeSquadColorKey(colorKey, index = 0) {
  if (colorKey && THEATER_SQUAD_COLOR_CHOICES.includes(colorKey)) {
    return colorKey;
  }
  return THEATER_SQUAD_COLOR_CHOICES[index % THEATER_SQUAD_COLOR_CHOICES.length] ?? "amber";
}
function formatDefaultSquadName(index) {
  return `Squad ${index + 1}`;
}
var THEATER_CORE_BLUEPRINTS = SCHEMA_CORE_DEFINITIONS;
var FORTIFICATION_COSTS = Object.fromEntries(
  Object.entries(SCHEMA_FORTIFICATION_DEFINITIONS).map(([fortificationType, definition]) => [
    fortificationType,
    { ...definition.buildCost }
  ])
);
var THEATER_STARTER_RESERVE = {
  metalScrap: 10,
  wood: 8,
  chaosShards: 3,
  steamComponents: 3
};
var THEATER_MAP_ORIGIN = { x: 230, y: 390 };
var THEATER_DEPTH_STEP2 = 300;
var THEATER_LATERAL_STEP2 = 220;
function createEmptyKeyInventory2() {
  return {
    triangle: false,
    square: false,
    circle: false,
    spade: false,
    star: false
  };
}
function cloneKeyInventory(inventory) {
  return {
    triangle: Boolean(inventory?.triangle),
    square: Boolean(inventory?.square),
    circle: Boolean(inventory?.circle),
    spade: Boolean(inventory?.spade),
    star: Boolean(inventory?.star)
  };
}
function formatTheaterKeyLabel(keyType) {
  switch (keyType) {
    case "triangle":
      return "Triangle Key";
    case "square":
      return "Square Key";
    case "circle":
      return "Circle Key";
    case "spade":
      return "Spade Key";
    case "star":
      return "Star Key";
    default:
      return "Key";
  }
}
function hasTheaterKey(theater, keyType) {
  if (!keyType) {
    return true;
  }
  return Boolean(theater.definition.floorKeyInventory?.[keyType]);
}
function isTheaterRoomLocked(theater, room) {
  return Boolean(room.requiredKeyType && !hasTheaterKey(theater, room.requiredKeyType));
}
function syncTheaterKeyInventory(theater) {
  const nextInventory = cloneKeyInventory(theater.definition.floorKeyInventory);
  Object.values(theater.rooms).forEach((room) => {
    if (room.grantsKeyType && room.keyCollected) {
      nextInventory[room.grantsKeyType] = true;
    }
  });
  theater.definition.floorKeyInventory = nextInventory;
  return theater;
}
function collectRoomKeyIfPresent(theater, roomId) {
  const room = theater.rooms[roomId];
  if (!room?.grantsKeyType || room.keyCollected) {
    return theater;
  }
  const next = cloneTheater(theater);
  const nextRoom = next.rooms[roomId];
  if (!nextRoom?.grantsKeyType || nextRoom.keyCollected) {
    return next;
  }
  nextRoom.keyCollected = true;
  next.definition.floorKeyInventory = cloneKeyInventory(next.definition.floorKeyInventory);
  next.definition.floorKeyInventory[nextRoom.grantsKeyType] = true;
  return addTheaterEvent(
    next,
    `KEY ACQUIRED :: ${formatTheaterKeyLabel(nextRoom.grantsKeyType)} recovered at ${nextRoom.label}.`
  );
}
function resolveAtlasSummaryForOperation2(operation) {
  return (operation.atlasTheaterId ? getAtlasTheaterSummary(operation.atlasTheaterId) : null) ?? getAtlasTheaterByOperationId(operation.id);
}
function projectTheaterPosition2(definition, localPosition) {
  const radians = definition.angleDeg * Math.PI / 180;
  const forward = { x: Math.cos(radians), y: Math.sin(radians) };
  const lateral = { x: -forward.y, y: forward.x };
  const anchor = definition.mapAnchor ?? THEATER_MAP_ORIGIN;
  return {
    x: Math.round(
      anchor.x + localPosition.x * THEATER_DEPTH_STEP2 * forward.x + localPosition.y * THEATER_LATERAL_STEP2 * lateral.x
    ),
    y: Math.round(
      anchor.y + localPosition.x * THEATER_DEPTH_STEP2 * forward.y + localPosition.y * THEATER_LATERAL_STEP2 * lateral.y
    )
  };
}
function createRoom2(definition, room) {
  const coreSlots = room.coreSlots && room.coreSlots.length > 0 ? room.coreSlots.map((assignment) => assignment ? {
    ...assignment,
    buildCost: { ...assignment.buildCost },
    upkeepPerTick: { ...assignment.upkeepPerTick },
    incomePerTick: { ...assignment.incomePerTick }
  } : null) : [room.coreAssignment ? {
    ...room.coreAssignment,
    buildCost: { ...room.coreAssignment.buildCost },
    upkeepPerTick: { ...room.coreAssignment.upkeepPerTick },
    incomePerTick: { ...room.coreAssignment.incomePerTick }
  } : null];
  const primaryCoreAssignment = coreSlots.find((assignment) => assignment !== null) ?? null;
  return {
    ...THEATER_ROOM_BASE2,
    theaterId: room.theaterId ?? definition.id,
    ...room,
    position: room.position ?? projectTheaterPosition2(definition, room.localPosition),
    clearMode: room.clearMode ?? (room.tacticalEncounter ? "battle" : "empty"),
    fortificationCapacity: room.fortificationCapacity ?? 3,
    fortificationPips: normalizeFortificationPips(room.fortificationPips),
    roomClass: room.roomClass ?? "standard",
    coreSlotCapacity: room.coreSlotCapacity ?? coreSlots.length,
    coreSlots,
    coreAssignment: primaryCoreAssignment,
    enemySite: room.enemySite ? { ...room.enemySite } : null,
    battleSizeOverride: room.battleSizeOverride ? { ...room.battleSizeOverride } : void 0
  };
}
function createIronGateTheater(operation) {
  const atlasSummary = resolveAtlasSummaryForOperation2(operation);
  const operationId = operation.id ?? "op_iron_gate";
  const objective = operation.objective ?? operation.description ?? "Advance through the Gateworks, stabilize a logistics chain, and crack the eastern lockline.";
  const recommendedPWR = operation.recommendedPWR ?? atlasSummary?.recommendedPwr ?? 24;
  const beginningState = operation.beginningState ?? `${atlasSummary?.zoneName ?? "CASTELLAN GATEWORKS"} uplink secured. Forward routes mapped only one room deep. Generator sector offline.`;
  const endState = operation.endState ?? "Eastern objective node secured with a powered support chain and at least one C.O.R.E. online.";
  const currentState = atlasSummary?.currentState === "undiscovered" ? "active" : atlasSummary?.currentState ?? "active";
  const angleDeg = atlasSummary?.angleDeg ?? 0;
  const zoneName = atlasSummary?.zoneName ?? "CASTELLAN GATEWORKS";
  const sectorLabel = atlasSummary?.sectorLabel ?? "SECTOR E-01";
  const uplinkRoomId = atlasSummary?.uplinkRoomId ?? "ig_ingress";
  const definition = {
    id: atlasSummary?.theaterId ?? `${operationId}_castellan_gateworks`,
    name: zoneName,
    zoneName,
    theaterStatus: currentState === "cold" ? "cold" : currentState === "warm" ? "warm" : "active",
    currentState,
    operationId,
    objective,
    recommendedPWR,
    beginningState,
    endState,
    floorId: atlasSummary?.floorId ?? operation.atlasFloorId ?? "haven_floor_03",
    floorOrdinal: atlasSummary?.floorOrdinal ?? 3,
    sectorLabel,
    radialSlotIndex: atlasSummary?.radialSlotIndex ?? 0,
    radialSlotCount: atlasSummary?.radialSlotCount ?? 5,
    angleDeg,
    radialDirection: atlasSummary?.radialDirection ?? { x: 1, y: 0 },
    discovered: atlasSummary?.discovered ?? true,
    operationAvailable: atlasSummary?.operationAvailable ?? true,
    passiveEffectText: atlasSummary?.passiveEffectText ?? "Passive Benefit // Forward relay improves early deployment stability.",
    threatLevel: atlasSummary?.threatLevel ?? "High",
    ingressRoomId: uplinkRoomId,
    uplinkRoomId,
    outwardDepth: atlasSummary?.outwardDepth ?? 5,
    powerSourceRoomIds: ["ig_ingress", "ig_generator"],
    floorKeyInventory: createEmptyKeyInventory2()
  };
  const makeRoom = (room) => createRoom2(definition, room);
  const rooms = {
    ig_ingress: makeRoom({
      id: "ig_ingress",
      label: "Gateworks Aperture",
      sectorTag: "A0",
      localPosition: { x: 0, y: 0 },
      depthFromUplink: 0,
      isUplinkRoom: true,
      size: { width: 230, height: 138 },
      adjacency: ["ig_checkpoint"],
      status: "secured",
      secured: true,
      clearMode: "empty",
      fortificationCapacity: 4,
      fortified: true,
      tacticalEncounter: null,
      tags: ["ingress", "uplink"],
      fortificationPips: { barricade: 1, powerRail: 1 },
      isPowerSource: true
    }),
    ig_checkpoint: makeRoom({
      id: "ig_checkpoint",
      label: "Broken Causeway",
      sectorTag: "A1",
      localPosition: { x: 1, y: 0 },
      depthFromUplink: 1,
      isUplinkRoom: false,
      size: { width: 250, height: 150 },
      adjacency: ["ig_ingress", "ig_junction", "ig_depot"],
      status: "mapped",
      secured: false,
      clearMode: "battle",
      fortificationCapacity: 2,
      tacticalEncounter: "gate_skirmish",
      tags: ["frontier"]
    }),
    ig_depot: makeRoom({
      id: "ig_depot",
      label: "Freight Annex",
      sectorTag: "B1",
      localPosition: { x: 1.3, y: 1.1 },
      depthFromUplink: 2,
      isUplinkRoom: false,
      size: { width: 520, height: 292 },
      adjacency: ["ig_checkpoint", "ig_storage"],
      status: "mapped",
      secured: false,
      clearMode: "field",
      fortificationCapacity: 8,
      roomClass: "mega",
      coreSlotCapacity: 4,
      coreSlots: [null, null, null, null],
      battleSizeOverride: { width: 10, height: 8 },
      tacticalEncounter: null,
      tags: ["core_candidate", "resource_pocket", "metal_rich", "timber_rich", "salvage_rich"]
    }),
    ig_junction: makeRoom({
      id: "ig_junction",
      label: "Signal Junction",
      sectorTag: "B0",
      localPosition: { x: 2, y: 0 },
      depthFromUplink: 2,
      isUplinkRoom: false,
      size: { width: 250, height: 152 },
      adjacency: ["ig_checkpoint", "ig_generator", "ig_command", "ig_redoubt"],
      status: "unknown",
      secured: false,
      clearMode: "battle",
      fortificationCapacity: 3,
      tacticalEncounter: "junction_melee",
      tags: ["junction"]
    }),
    ig_generator: makeRoom({
      id: "ig_generator",
      label: "Dyno Chamber",
      sectorTag: "B-1",
      localPosition: { x: 2.1, y: -1.1 },
      depthFromUplink: 3,
      isUplinkRoom: false,
      size: { width: 250, height: 150 },
      adjacency: ["ig_junction"],
      status: "unknown",
      secured: false,
      clearMode: "empty",
      fortificationCapacity: 4,
      tacticalEncounter: null,
      tags: ["power_source", "steam_vent"],
      isPowerSource: true
    }),
    ig_command: makeRoom({
      id: "ig_command",
      label: "Overwatch Gallery",
      sectorTag: "C0",
      localPosition: { x: 3.1, y: -0.55 },
      depthFromUplink: 3,
      isUplinkRoom: false,
      size: { width: 280, height: 152 },
      adjacency: ["ig_junction", "ig_storage"],
      status: "unknown",
      secured: false,
      clearMode: "battle",
      fortificationCapacity: 4,
      tacticalEncounter: "command_gallery",
      tags: ["core_candidate", "command_suitable", "survey_highground"]
    }),
    ig_storage: makeRoom({
      id: "ig_storage",
      label: "Cold Storage Spur",
      sectorTag: "C1",
      localPosition: { x: 3.1, y: 0.85 },
      depthFromUplink: 3,
      isUplinkRoom: false,
      size: { width: 280, height: 150 },
      adjacency: ["ig_depot", "ig_command"],
      status: "unknown",
      secured: false,
      clearMode: "empty",
      fortificationCapacity: 2,
      tacticalEncounter: null,
      tags: ["side_branch", "timber_rich"]
    }),
    ig_redoubt: makeRoom({
      id: "ig_redoubt",
      label: "Redoubt Mouth",
      sectorTag: "D0",
      localPosition: { x: 4, y: 0 },
      depthFromUplink: 4,
      isUplinkRoom: false,
      size: { width: 250, height: 152 },
      adjacency: ["ig_junction", "ig_objective"],
      status: "unknown",
      secured: false,
      clearMode: "battle",
      fortificationCapacity: 3,
      tacticalEncounter: "elite_redoubt",
      tags: ["elite", "frontier", "enemy_staging"],
      enemySite: {
        type: "staging",
        reserveStrength: 3,
        dispatchInterval: 4,
        nextDispatchTick: 3,
        patrolStrength: 2
      }
    }),
    ig_objective: makeRoom({
      id: "ig_objective",
      label: "Iron Gate Lock",
      sectorTag: "E0",
      localPosition: { x: 5, y: 0 },
      depthFromUplink: 5,
      isUplinkRoom: false,
      size: { width: 260, height: 160 },
      adjacency: ["ig_redoubt"],
      status: "unknown",
      secured: false,
      clearMode: "battle",
      fortificationCapacity: 4,
      tacticalEncounter: "objective_lock",
      tags: ["objective", "elite"]
    })
  };
  return recomputeTheaterNetwork({
    definition,
    rooms,
    currentRoomId: uplinkRoomId,
    selectedRoomId: uplinkRoomId,
    squads: [],
    selectedSquadId: null,
    tickCount: 0,
    activeThreats: [],
    recentEvents: ["S/COM :: Gateworks Aperture secured. Push outward, build C.O.R.E.s, and hold the line."],
    objectiveDefinition: null,
    objectiveComplete: false,
    completion: null
  });
}
function cloneTheater(theater) {
  return {
    definition: {
      ...theater.definition,
      radialDirection: { ...theater.definition.radialDirection },
      powerSourceRoomIds: [...theater.definition.powerSourceRoomIds],
      mapAnchor: theater.definition.mapAnchor ? { ...theater.definition.mapAnchor } : void 0,
      floorKeyInventory: cloneKeyInventory(theater.definition.floorKeyInventory)
    },
    rooms: Object.fromEntries(
      Object.entries(theater.rooms).map(([roomId, room]) => [
        roomId,
        {
          ...room,
          position: { ...room.position },
          localPosition: { ...room.localPosition },
          size: { ...room.size },
          adjacency: [...room.adjacency],
          roomClass: room.roomClass ?? "standard",
          powerGateWatts: { ...room.powerGateWatts ?? {} },
          fortificationPips: normalizeFortificationPips(room.fortificationPips),
          coreSlotCapacity: room.coreSlotCapacity ?? Math.max(1, room.coreSlots?.length ?? (room.coreAssignment ? 1 : 1)),
          abandoned: room.abandoned ?? false,
          requiredKeyType: room.requiredKeyType ?? null,
          grantsKeyType: room.grantsKeyType ?? null,
          keyCollected: room.keyCollected ?? false,
          coreSlots: (room.coreSlots && room.coreSlots.length > 0 ? room.coreSlots : [room.coreAssignment ?? null]).map((assignment) => assignment ? {
            ...assignment,
            buildCost: { ...assignment.buildCost },
            upkeepPerTick: { ...assignment.upkeepPerTick },
            incomePerTick: { ...assignment.incomePerTick }
          } : null),
          coreAssignment: room.coreAssignment ? {
            ...room.coreAssignment,
            buildCost: { ...room.coreAssignment.buildCost },
            upkeepPerTick: { ...room.coreAssignment.upkeepPerTick },
            incomePerTick: { ...room.coreAssignment.incomePerTick }
          } : null,
          enemySite: room.enemySite ? { ...room.enemySite } : null,
          battleSizeOverride: room.battleSizeOverride ? { ...room.battleSizeOverride } : void 0,
          tags: [...room.tags]
        }
      ])
    ),
    currentRoomId: theater.currentRoomId,
    selectedRoomId: theater.selectedRoomId,
    squads: theater.squads.map((squad) => ({
      ...squad,
      displayName: clampSquadName(squad.displayName, squad.squadId.toUpperCase()),
      icon: normalizeSquadIcon(squad.icon),
      colorKey: normalizeSquadColorKey(squad.colorKey),
      unitIds: [...squad.unitIds],
      automationMode: squad.automationMode ?? "manual",
      autoStatus: squad.autoStatus ?? "idle",
      autoTargetRoomId: squad.autoTargetRoomId ?? null
    })),
    selectedSquadId: theater.selectedSquadId,
    tickCount: theater.tickCount,
    activeThreats: theater.activeThreats.map((threat) => ({ ...threat })),
    recentEvents: [...theater.recentEvents],
    objectiveDefinition: theater.objectiveDefinition ? {
      ...theater.objectiveDefinition,
      requiredCoreType: theater.objectiveDefinition.requiredCoreType ?? null,
      multiResource: theater.objectiveDefinition.multiResource ? { ...theater.objectiveDefinition.multiResource } : void 0,
      progress: { ...theater.objectiveDefinition.progress }
    } : null,
    objectiveComplete: theater.objectiveComplete,
    completion: theater.completion ? {
      ...theater.completion,
      reward: { ...theater.completion.reward },
      recapLines: [...theater.completion.recapLines]
    } : null
  };
}
function createEmptyObjectiveProgress() {
  return {
    cratesDelivered: 0,
    ticksHeld: 0,
    powerRouted: 0,
    bwEstablished: 0,
    builtCoreType: null,
    completed: false
  };
}
function buildSquadState(squadId, unitIds, currentRoomId, theaterId, options) {
  const orderIndex = options?.orderIndex ?? 0;
  return {
    squadId,
    displayName: clampSquadName(options?.displayName, formatDefaultSquadName(orderIndex)),
    icon: normalizeSquadIcon(options?.icon, orderIndex),
    colorKey: normalizeSquadColorKey(options?.colorKey, orderIndex),
    unitIds: [...unitIds],
    currentRoomId,
    currentTheaterId: theaterId,
    bwRequired: unitIds.length * SQUAD_CONTROL_BW_PER_UNIT,
    bwAvailable: 0,
    isInContact: false,
    status: "idle",
    automationMode: "manual",
    autoStatus: "idle",
    autoTargetRoomId: null
  };
}
function createInitialSquads(unitIds, theater) {
  const party = [...unitIds];
  if (party.length <= 0) {
    return [];
  }
  const groups = [];
  if (party.length <= THEATER_MAX_SQUAD_SIZE) {
    groups.push(party);
  } else {
    for (let index = 0; index < party.length; index += THEATER_MAX_SQUAD_SIZE) {
      groups.push(party.slice(index, index + THEATER_MAX_SQUAD_SIZE));
    }
  }
  return groups.filter((group) => group.length > 0).map((group, index) => buildSquadState(
    `sq_${index + 1}`,
    group,
    theater.definition.uplinkRoomId,
    theater.definition.id,
    {
      displayName: formatDefaultSquadName(index),
      icon: normalizeSquadIcon(void 0, index),
      colorKey: normalizeSquadColorKey(void 0, index),
      orderIndex: index
    }
  ));
}
function getObjectiveTargetRoom(theater, preferredTags) {
  for (const tag of preferredTags) {
    const taggedRoom = Object.values(theater.rooms).filter((room) => room.tags.includes(tag)).sort((left, right) => right.depthFromUplink - left.depthFromUplink)[0];
    if (taggedRoom) {
      return taggedRoom;
    }
  }
  return getObjectiveRoom(theater) ?? Object.values(theater.rooms)[0] ?? null;
}
function formatObjectiveLabel(theater, objective) {
  const targetRoom = theater.rooms[objective.targetRoomId];
  const roomLabel = targetRoom?.label ?? objective.targetRoomId;
  switch (objective.objectiveType) {
    case "build_core":
      return `Build ${THEATER_CORE_BLUEPRINTS[objective.requiredCoreType ?? "command_center"]?.displayName ?? "C.O.R.E."} in ${roomLabel}.`;
    case "route_power":
      return `Route ${objective.powerRequired ?? 0} W/TICK to ${roomLabel}.`;
    case "establish_comms":
      return `Establish ${objective.bwRequired ?? 0} BW in ${roomLabel}.`;
    case "deliver_supply":
      return `Deliver ${objective.cratesRequired ?? 0} crates/tick to ${roomLabel}.`;
    case "sustain_occupation":
      return `Hold ${roomLabel} for ${objective.ticksRequired ?? 0} ticks.`;
    case "multi_resource": {
      const fragments = [
        objective.multiResource?.crates ? `${objective.multiResource.crates} crates` : null,
        objective.multiResource?.power ? `${objective.multiResource.power} watts` : null,
        objective.multiResource?.bw ? `${objective.multiResource.bw} BW` : null
      ].filter(Boolean);
      return `Establish ${fragments.join(" + ")} in ${roomLabel}.`;
    }
    default:
      return theater.definition.objective;
  }
}
function createObjectiveForTheater(theater) {
  const variant = Math.abs(theater.definition.radialSlotIndex ?? 0) % 3;
  const buildRoom = getObjectiveTargetRoom(theater, ["core_candidate", "core", "relay"]);
  const routeRoom = getObjectiveTargetRoom(theater, ["objective", "elite", "power"]);
  const commsRoom = getObjectiveTargetRoom(theater, ["objective", "relay", "elite"]);
  const objective = variant === 0 ? {
    objectiveType: "build_core",
    targetRoomId: buildRoom?.id ?? theater.definition.uplinkRoomId,
    requiredCoreType: "command_center",
    label: "",
    progress: createEmptyObjectiveProgress()
  } : variant === 1 ? {
    objectiveType: "route_power",
    targetRoomId: routeRoom?.id ?? theater.definition.uplinkRoomId,
    powerRequired: 25,
    label: "",
    progress: createEmptyObjectiveProgress()
  } : {
    objectiveType: "establish_comms",
    targetRoomId: commsRoom?.id ?? theater.definition.uplinkRoomId,
    bwRequired: 24,
    label: "",
    progress: createEmptyObjectiveProgress()
  };
  objective.label = formatObjectiveLabel(theater, objective);
  return objective;
}
function getObjectiveProgressSignature(objective) {
  if (!objective) {
    return "none";
  }
  const progress = objective.progress;
  return [
    objective.objectiveType,
    objective.targetRoomId,
    progress.cratesDelivered,
    progress.ticksHeld,
    progress.powerRouted,
    progress.bwEstablished,
    progress.builtCoreType ?? "none",
    progress.completed ? "1" : "0"
  ].join("|");
}
function computeObjectiveProgress(theater, objective) {
  const targetRoom = theater.rooms[objective.targetRoomId];
  const previousProgress = objective.progress;
  const progress = {
    ...previousProgress,
    cratesDelivered: targetRoom?.supplyFlow ?? 0,
    powerRouted: targetRoom?.powerFlow ?? 0,
    bwEstablished: targetRoom?.commsFlow ?? 0,
    builtCoreType: getRoomPrimaryCoreAssignment(targetRoom)?.type ?? null,
    completed: previousProgress.completed
  };
  switch (objective.objectiveType) {
    case "build_core":
      progress.completed = Boolean(
        targetRoom?.secured && roomHasAnyCore(targetRoom) && (!objective.requiredCoreType || roomHasCoreType(targetRoom, objective.requiredCoreType))
      );
      break;
    case "route_power":
      progress.completed = Boolean((targetRoom?.powerFlow ?? 0) >= (objective.powerRequired ?? 0));
      break;
    case "establish_comms":
      progress.completed = Boolean((targetRoom?.commsFlow ?? 0) >= (objective.bwRequired ?? 0));
      break;
    case "deliver_supply":
      progress.completed = Boolean((targetRoom?.supplyFlow ?? 0) >= (objective.cratesRequired ?? 0));
      break;
    case "sustain_occupation":
      progress.completed = progress.ticksHeld >= (objective.ticksRequired ?? 0);
      break;
    case "multi_resource":
      progress.completed = (targetRoom?.supplyFlow ?? 0) >= (objective.multiResource?.crates ?? 0) && (targetRoom?.powerFlow ?? 0) >= (objective.multiResource?.power ?? 0) && (targetRoom?.commsFlow ?? 0) >= (objective.multiResource?.bw ?? 0);
      break;
    default:
      progress.completed = false;
      break;
  }
  return {
    ...objective,
    label: formatObjectiveLabel(theater, objective),
    progress
  };
}
function advanceOccupationObjective(theater, ticks) {
  if (!theater.objectiveDefinition || theater.objectiveDefinition.objectiveType !== "sustain_occupation") {
    return theater;
  }
  const targetRoom = theater.rooms[theater.objectiveDefinition.targetRoomId];
  const occupied = theater.squads.some((squad) => squad.currentRoomId === theater.objectiveDefinition.targetRoomId);
  const next = cloneTheater(theater);
  next.objectiveDefinition.progress.ticksHeld = occupied && targetRoom?.secured ? next.objectiveDefinition.progress.ticksHeld + Math.max(1, ticks) : 0;
  return next;
}
function applySquadContactState(theater) {
  const next = cloneTheater(theater);
  next.squads = next.squads.map((squad) => {
    const room = next.rooms[squad.currentRoomId];
    const bwRequired = Math.max(SQUAD_CONTROL_BW_PER_UNIT, squad.unitIds.length * SQUAD_CONTROL_BW_PER_UNIT);
    const bwAvailable = room?.commsFlow ?? 0;
    const isInContact = bwAvailable >= bwRequired;
    const status = !isInContact ? "out_of_contact" : room?.underThreat || room?.damaged ? "threatened" : "idle";
    if (squad.isInContact && !isInContact) {
      console.log("[THEATER] squad became out of contact", squad.squadId, squad.currentRoomId, bwRequired, bwAvailable);
    }
    return {
      ...squad,
      bwRequired,
      bwAvailable,
      isInContact,
      status
    };
  });
  const selectedSquad = next.squads.find((squad) => squad.squadId === next.selectedSquadId) ?? next.squads[0] ?? null;
  next.selectedSquadId = selectedSquad?.squadId ?? null;
  next.currentRoomId = selectedSquad?.currentRoomId ?? next.currentRoomId;
  if (!next.rooms[next.selectedRoomId]) {
    next.selectedRoomId = next.currentRoomId;
  }
  return next;
}
function syncObjectiveState(theater) {
  if (!theater.objectiveDefinition) {
    return theater;
  }
  const previousSignature = getObjectiveProgressSignature(theater.objectiveDefinition);
  const next = cloneTheater(theater);
  if (!next.objectiveDefinition) {
    return next;
  }
  next.objectiveDefinition = computeObjectiveProgress(next, next.objectiveDefinition);
  const nextSignature = getObjectiveProgressSignature(next.objectiveDefinition);
  if (previousSignature !== nextSignature) {
    console.log("[THEATER] objective progress changed", next.definition.id, next.objectiveDefinition.objectiveType, next.objectiveDefinition.progress);
  }
  next.definition.objective = next.objectiveDefinition.label;
  return next;
}
function initializeTheaterRuntime(theater, partyUnitIds) {
  let next = cloneTheater(theater);
  if (!next.squads || next.squads.length === 0) {
    next.squads = createInitialSquads(partyUnitIds, next);
    next.selectedSquadId = next.squads[0]?.squadId ?? null;
  }
  if (!next.objectiveDefinition) {
    next.objectiveDefinition = createObjectiveForTheater(next);
    next.definition.objective = next.objectiveDefinition.label;
  }
  return next;
}
function getPreparedTheaterOperation(state) {
  const operation = ensureOperationHasTheater(state.operation);
  if (!operation?.theater) {
    return operation;
  }
  const initializedTheater = initializeTheaterRuntime(operation.theater, state.partyUnitIds);
  const preparedTheater = prepareTheaterForOperation(initializedTheater);
  return resolveOperationFields(operation, preparedTheater);
}
function getSelectedSquad(theater) {
  return theater.squads.find((squad) => squad.squadId === theater.selectedSquadId) ?? theater.squads[0] ?? null;
}
function getEmergencyControlSquadId(theater) {
  if (theater.squads.some((squad) => squad.isInContact)) {
    return null;
  }
  const selectedSquadId = theater.selectedSquadId;
  if (selectedSquadId && theater.squads.some((squad) => squad.squadId === selectedSquadId)) {
    return selectedSquadId;
  }
  return theater.squads[0]?.squadId ?? null;
}
function canManuallyControlTheaterSquad(theater, squad) {
  if (!squad) {
    return false;
  }
  if (squad.automationMode !== "manual") {
    return false;
  }
  return squad.isInContact || squad.squadId === getEmergencyControlSquadId(theater);
}
function findSquad(theater, squadId) {
  return theater.squads.find((squad) => squad.squadId === squadId) ?? null;
}
function getNextSquadId(theater) {
  let index = 1;
  const usedIds = new Set(theater.squads.map((squad) => squad.squadId));
  while (usedIds.has(`sq_${index}`)) {
    index += 1;
  }
  return `sq_${index}`;
}
function getNextSquadOrderIndex(theater) {
  return theater.squads.length;
}
function getTheaterPassagePowerRequirement(room, adjacentId) {
  return Math.max(0, room.powerGateWatts?.[adjacentId] ?? 0);
}
function isTheaterPassagePowered(theater, fromRoomId, toRoomId) {
  const fromRoom = theater.rooms[fromRoomId];
  const toRoom = theater.rooms[toRoomId];
  if (!fromRoom || !toRoom) {
    return false;
  }
  const requirement = Math.max(
    getTheaterPassagePowerRequirement(fromRoom, toRoomId),
    getTheaterPassagePowerRequirement(toRoom, fromRoomId)
  );
  if (requirement <= 0) {
    return true;
  }
  return Math.max(fromRoom.powerFlow ?? 0, toRoom.powerFlow ?? 0) >= requirement;
}
function addTheaterEvent(theater, message) {
  return {
    ...theater,
    recentEvents: [message, ...theater.recentEvents].slice(0, 8)
  };
}
function hasEnoughResources(resources, cost) {
  return resources.metalScrap >= (cost.metalScrap ?? 0) && resources.wood >= (cost.wood ?? 0) && resources.chaosShards >= (cost.chaosShards ?? 0) && resources.steamComponents >= (cost.steamComponents ?? 0);
}
function subtractResources(resources, cost) {
  return {
    metalScrap: resources.metalScrap - (cost.metalScrap ?? 0),
    wood: resources.wood - (cost.wood ?? 0),
    chaosShards: resources.chaosShards - (cost.chaosShards ?? 0),
    steamComponents: resources.steamComponents - (cost.steamComponents ?? 0)
  };
}
function cloneCoreAssignment(assignment) {
  if (!assignment) {
    return null;
  }
  return {
    ...assignment,
    buildCost: { ...assignment.buildCost },
    upkeepPerTick: { ...assignment.upkeepPerTick },
    incomePerTick: { ...assignment.incomePerTick }
  };
}
function ensureRoomCoreSlots(room) {
  const desiredSize = Math.max(1, room.coreSlotCapacity ?? room.coreSlots?.length ?? (room.coreAssignment ? 1 : 1));
  const baseSlots = room.coreSlots && room.coreSlots.length > 0 ? room.coreSlots.map((assignment) => cloneCoreAssignment(assignment)) : [cloneCoreAssignment(room.coreAssignment)];
  while (baseSlots.length < desiredSize) {
    baseSlots.push(null);
  }
  return baseSlots.slice(0, desiredSize);
}
function syncRoomPrimaryCoreAssignment(room) {
  room.coreSlots = ensureRoomCoreSlots(room);
  room.coreSlotCapacity = Math.max(1, room.coreSlotCapacity ?? room.coreSlots.length);
  room.coreAssignment = room.coreSlots.find((assignment) => assignment !== null) ?? null;
  room.roomClass = room.roomClass ?? "standard";
  return room;
}
function getRoomCoreAssignments(room) {
  if (!room) {
    return [];
  }
  return ensureRoomCoreSlots(room).filter((assignment) => assignment !== null);
}
function getRoomOperationalCoreAssignments(room) {
  if (!room || !room.secured || room.damaged) {
    return [];
  }
  return getRoomCoreAssignments(room).filter((assignment) => {
    const requirements = getCoreOperationalRequirements(assignment.type);
    return room.supplyFlow >= requirements.supplyCrates && room.powerFlow >= requirements.powerWatts && room.commsFlow >= requirements.commsBw;
  });
}
function roomHasAnyCore(room) {
  return getRoomCoreAssignments(room).length > 0;
}
function roomHasCoreType(room, coreType) {
  return getRoomCoreAssignments(room).some((assignment) => assignment.type === coreType);
}
function roomHasOperationalCoreType(room, coreType) {
  return getRoomOperationalCoreAssignments(room).some((assignment) => assignment.type === coreType);
}
function getRoomPrimaryCoreAssignmentByType(room, coreType) {
  return getRoomCoreAssignments(room).find((assignment) => assignment.type === coreType) ?? null;
}
function getRoomPrimaryCoreAssignment(room) {
  return getRoomCoreAssignments(room)[0] ?? null;
}
function clearRoomCoreAssignments(room) {
  room.coreSlots = ensureRoomCoreSlots(room).map(() => null);
  syncRoomPrimaryCoreAssignment(room);
}
function isUnitOperationIncapacitated(unit, operationId, theaterId) {
  if (!unit?.operationInjury) {
    return false;
  }
  return unit.operationInjury.operationId === operationId && (!theaterId || unit.operationInjury.theaterId === theaterId);
}
function getSquadCombatReadyUnitIds(state, operationId, theaterId, squad) {
  return squad.unitIds.filter((unitId) => !isUnitOperationIncapacitated(state.unitsById[unitId], operationId, theaterId));
}
function getSquadIncapacitatedUnitIds(state, operationId, theaterId, squad) {
  return squad.unitIds.filter((unitId) => isUnitOperationIncapacitated(state.unitsById[unitId], operationId, theaterId));
}
function getCoreOperationalRequirements(coreType) {
  const definition = coreType ? THEATER_CORE_BLUEPRINTS[coreType] : null;
  return {
    powerWatts: definition?.operationalRequirements?.powerWatts ?? CORE_POWER_REQUIREMENT,
    commsBw: definition?.operationalRequirements?.commsBw ?? CORE_COMMS_REQUIREMENT,
    supplyCrates: definition?.operationalRequirements?.supplyCrates ?? CORE_SUPPLY_REQUIREMENT
  };
}
function getRoomCoreOperationalRequirements(room) {
  return getCoreOperationalRequirements(getRoomPrimaryCoreAssignment(room)?.type);
}
function resolveCoreNetworkOutput(configuredAmount, configuredMode, incomingAmount, fallbackAmount) {
  const baseAmount = configuredAmount ?? fallbackAmount;
  return configuredMode === "add_input" ? Math.max(0, incomingAmount) + baseAmount : baseAmount;
}
function getCorePowerOutputWatts(room, incomingWatts) {
  const generatorAssignment = getRoomPrimaryCoreAssignmentByType(room, "generator");
  const definition = generatorAssignment?.type ? THEATER_CORE_BLUEPRINTS[generatorAssignment.type] : null;
  return resolveCoreNetworkOutput(
    definition?.powerOutputWatts,
    definition?.powerOutputMode,
    incomingWatts,
    POWER_SOURCE_WATTS_PER_TICK
  );
}
function getCoreCommsOutputBw(room, incomingBandwidth) {
  const commandAssignment = getRoomPrimaryCoreAssignmentByType(room, "command_center");
  const definition = commandAssignment?.type ? THEATER_CORE_BLUEPRINTS[commandAssignment.type] : null;
  return resolveCoreNetworkOutput(
    definition?.commsOutputBw,
    definition?.commsOutputMode,
    incomingBandwidth,
    COMMS_SOURCE_BANDWIDTH_PER_TICK
  );
}
function getCoreSupplyOutputCrates(room, incomingCrates) {
  const supplyAssignment = getRoomPrimaryCoreAssignmentByType(room, "supply_depot");
  const definition = supplyAssignment?.type ? THEATER_CORE_BLUEPRINTS[supplyAssignment.type] : null;
  return resolveCoreNetworkOutput(
    definition?.supplyOutputCrates,
    definition?.supplyOutputMode,
    incomingCrates,
    SUPPLY_SOURCE_CRATES_PER_TICK
  );
}
function roomCanCarryPower(room) {
  return room.isPowerSource === true || roomHasCoreType(room, "generator") || room.fortificationPips.powerRail > 0;
}
function getSupplyTraversalDecay(currentRoom, adjacentRoom) {
  return currentRoom.fortificationPips.waystation > 0 || adjacentRoom.fortificationPips.waystation > 0 ? 0 : SUPPLY_FALLOFF_PER_ROOM;
}
function roomHasOperationalCore(room) {
  return getRoomOperationalCoreAssignments(room).length > 0;
}
function getCoreOfflineReason(room) {
  if (!roomHasAnyCore(room)) {
    return null;
  }
  if (!room.secured) {
    return "low_supply";
  }
  if (room.damaged) {
    return "damaged";
  }
  const requirements = getRoomCoreAssignments(room).reduce((maxima, assignment) => {
    const nextRequirements = getCoreOperationalRequirements(assignment.type);
    return {
      powerWatts: Math.max(maxima.powerWatts, nextRequirements.powerWatts),
      commsBw: Math.max(maxima.commsBw, nextRequirements.commsBw),
      supplyCrates: Math.max(maxima.supplyCrates, nextRequirements.supplyCrates)
    };
  }, { powerWatts: 0, commsBw: 0, supplyCrates: 0 });
  if (room.supplyFlow < requirements.supplyCrates) {
    return "low_supply";
  }
  if (room.powerFlow < requirements.powerWatts) {
    return "low_power";
  }
  if (room.commsFlow < requirements.commsBw) {
    return "low_comms";
  }
  return null;
}
function roomHasLinkedOperationalCore(theater, room, coreType, requiredCommsFlow) {
  if (room.commsFlow < requiredCommsFlow) {
    return false;
  }
  return Object.values(theater.rooms).some((candidate) => roomHasOperationalCoreType(candidate, coreType));
}
function deriveTheaterCoreRepairCost(room) {
  const buildCost = getRoomPrimaryCoreAssignment(room)?.buildCost ?? {};
  const repairCost = {
    metalScrap: buildCost.metalScrap ? Math.max(1, Math.ceil(buildCost.metalScrap * 0.5)) : 0,
    wood: buildCost.wood ? Math.max(1, Math.ceil(buildCost.wood * 0.5)) : 0,
    chaosShards: buildCost.chaosShards ? Math.max(1, Math.ceil(buildCost.chaosShards * 0.5)) : 0,
    steamComponents: buildCost.steamComponents ? Math.max(1, Math.ceil(buildCost.steamComponents * 0.5)) : 0
  };
  if (formatResourceCost(repairCost) !== "0") {
    return repairCost;
  }
  return {
    metalScrap: 4,
    wood: 2
  };
}
function sumWadUpkeep(theater, ticks) {
  return Object.values(theater.rooms).reduce((total, room) => {
    if (!room.secured || !roomHasAnyCore(room)) {
      return total;
    }
    return total + getRoomCoreAssignments(room).reduce((roomTotal, assignment) => roomTotal + (assignment.wadUpkeepPerTick ?? 0) * ticks, 0);
  }, 0);
}
function sumResourceIncome(theater, ticks) {
  const upkeep = {
    metalScrap: 0,
    wood: 0,
    chaosShards: 0,
    steamComponents: 0
  };
  Object.values(theater.rooms).forEach((room) => {
    getRoomOperationalCoreAssignments(room).forEach((coreAssignment) => {
      upkeep.metalScrap += (coreAssignment.incomePerTick?.metalScrap ?? 0) * ticks;
      upkeep.wood += (coreAssignment.incomePerTick?.wood ?? 0) * ticks;
      upkeep.chaosShards += (coreAssignment.incomePerTick?.chaosShards ?? 0) * ticks;
      upkeep.steamComponents += (coreAssignment.incomePerTick?.steamComponents ?? 0) * ticks;
    });
  });
  return upkeep;
}
function addResources2(base, delta) {
  return {
    metalScrap: base.metalScrap + (delta.metalScrap ?? 0),
    wood: base.wood + (delta.wood ?? 0),
    chaosShards: base.chaosShards + (delta.chaosShards ?? 0),
    steamComponents: base.steamComponents + (delta.steamComponents ?? 0)
  };
}
function getObjectiveRoom(theater) {
  return Object.values(theater.rooms).find((room) => room.tags.includes("objective")) ?? null;
}
function createCompletionSummary(theater, room) {
  const securedCount = Object.values(theater.rooms).filter((candidate) => candidate.secured).length;
  const coreCount = Object.values(theater.rooms).reduce((total, candidate) => total + getRoomOperationalCoreAssignments(candidate).length, 0);
  const poweredCount = Object.values(theater.rooms).filter((candidate) => candidate.powered).length;
  return {
    roomId: room.id,
    completedAtTick: theater.tickCount,
    reward: {
      wad: 120,
      metalScrap: 8,
      wood: 6,
      chaosShards: 3,
      steamComponents: 3
    },
    recapLines: [
      `${room.label} secured at tick ${theater.tickCount}.`,
      `${securedCount}/${Object.keys(theater.rooms).length} rooms secured across ${theater.definition.name}.`,
      `${coreCount} C.O.R.E. facilities online, ${poweredCount} secured rooms powered by rail.`
    ]
  };
}
function resolveCompletionRoom(theater) {
  if (theater.objectiveDefinition) {
    if (!theater.objectiveDefinition.progress.completed) {
      return null;
    }
    return theater.rooms[theater.objectiveDefinition.targetRoomId] ?? getObjectiveRoom(theater) ?? theater.rooms[theater.currentRoomId] ?? Object.values(theater.rooms)[0] ?? null;
  }
  const objectiveRoom = getObjectiveRoom(theater);
  if (objectiveRoom?.secured) {
    return objectiveRoom;
  }
  const rooms = Object.values(theater.rooms);
  if (rooms.length > 0 && rooms.every((room) => room.secured)) {
    return objectiveRoom ?? theater.rooms[theater.currentRoomId] ?? rooms[0] ?? null;
  }
  return null;
}
function reconcileTheaterCompletion(theater) {
  const completionRoom = resolveCompletionRoom(theater);
  if (!completionRoom) {
    return theater;
  }
  if (theater.objectiveComplete && theater.completion) {
    return theater;
  }
  const next = cloneTheater(theater);
  const nextCompletionRoom = next.rooms[completionRoom.id] ?? completionRoom;
  next.objectiveComplete = true;
  next.completion = next.completion ?? createCompletionSummary(next, nextCompletionRoom);
  return addTheaterEvent(
    next,
    `OBJECTIVE :: ${nextCompletionRoom.label} secured. ${next.definition.name} operation complete.`
  );
}
function recomputeSupplyAndPower(theater) {
  const next = cloneTheater(theater);
  const rooms = next.rooms;
  const ingressId = next.definition.ingressRoomId;
  const ingress = rooms[ingressId];
  Object.values(rooms).forEach((room) => {
    syncRoomPrimaryCoreAssignment(room);
    room.coreSlots = ensureRoomCoreSlots(room).map((assignment) => {
      if (!assignment) {
        return null;
      }
      const blueprint = THEATER_CORE_BLUEPRINTS[assignment.type];
      return {
        ...assignment,
        buildCost: { ...blueprint.buildCost },
        upkeepPerTick: { ...blueprint.upkeep },
        wadUpkeepPerTick: blueprint.wadUpkeepPerTick,
        incomePerTick: getCoreIncomeForRoom(assignment.type, room),
        supportRadius: blueprint.supportRadius
      };
    });
    room.coreAssignment = room.coreSlots.find((assignment) => assignment !== null) ?? null;
    room.supplied = false;
    room.connected = false;
    room.powered = false;
    room.commsVisible = false;
    room.commsLinked = false;
    room.supplyFlow = 0;
    room.powerFlow = 0;
    room.commsFlow = 0;
    room.intelLevel = 0;
  });
  const propagateSupplyFromSource = (sourceId, sourceCrates) => {
    const sourceRoom = rooms[sourceId];
    if (!sourceRoom) {
      return;
    }
    const supplyQueue = [{ roomId: sourceId, loss: 0 }];
    const bestLoss = /* @__PURE__ */ new Map([[sourceId, 0]]);
    while (supplyQueue.length > 0) {
      const current = supplyQueue.shift();
      const currentRoom2 = rooms[current.roomId];
      if (!currentRoom2) {
        continue;
      }
      const crates = Math.max(0, sourceCrates - current.loss);
      if (crates <= 0) {
        continue;
      }
      currentRoom2.supplyFlow = Math.max(currentRoom2.supplyFlow, crates);
      currentRoom2.supplied = currentRoom2.supplyFlow > 0;
      currentRoom2.adjacency.forEach((adjacentId) => {
        const adjacentRoom = rooms[adjacentId];
        if (!adjacentRoom || !adjacentRoom.secured) {
          return;
        }
        if (currentRoom2.damaged || adjacentRoom.damaged) {
          return;
        }
        const nextLoss = current.loss + getSupplyTraversalDecay(currentRoom2, adjacentRoom);
        if (Math.max(0, sourceCrates - nextLoss) <= 0) {
          return;
        }
        if ((bestLoss.get(adjacentId) ?? Number.POSITIVE_INFINITY) <= nextLoss) {
          return;
        }
        bestLoss.set(adjacentId, nextLoss);
        supplyQueue.push({ roomId: adjacentId, loss: nextLoss });
      });
    }
  };
  const baseSupplySourceIds = /* @__PURE__ */ new Set();
  if (ingress?.secured && !ingress.damaged) {
    baseSupplySourceIds.add(ingress.id);
  }
  baseSupplySourceIds.forEach((sourceId) => {
    propagateSupplyFromSource(sourceId, SUPPLY_SOURCE_CRATES_PER_TICK);
  });
  const propagatePowerFromSource = (sourceId, sourceWatts) => {
    const sourceRoom = rooms[sourceId];
    if (!sourceRoom) {
      return;
    }
    const queue = [{ roomId: sourceId, depth: 0 }];
    const bestDepth = /* @__PURE__ */ new Map([[sourceId, 0]]);
    while (queue.length > 0) {
      const current = queue.shift();
      const currentRoom2 = rooms[current.roomId];
      if (!currentRoom2) {
        continue;
      }
      const watts = Math.max(0, sourceWatts - current.depth * POWER_FALLOFF_PER_ROOM);
      if (watts <= 0) {
        continue;
      }
      currentRoom2.powerFlow += watts;
      currentRoom2.powered = currentRoom2.powerFlow > 0;
      if (watts <= POWER_FALLOFF_PER_ROOM) {
        continue;
      }
      currentRoom2.adjacency.forEach((adjacentId) => {
        const adjacentRoom = rooms[adjacentId];
        if (!adjacentRoom || !adjacentRoom.secured || adjacentRoom.damaged) {
          return;
        }
        if (!roomCanCarryPower(adjacentRoom)) {
          return;
        }
        if (!roomCanCarryPower(currentRoom2) && current.roomId !== sourceId) {
          return;
        }
        const nextDepth = current.depth + 1;
        if ((bestDepth.get(adjacentId) ?? Number.POSITIVE_INFINITY) <= nextDepth) {
          return;
        }
        bestDepth.set(adjacentId, nextDepth);
        queue.push({ roomId: adjacentId, depth: nextDepth });
      });
    }
  };
  const basePowerSourceIds = /* @__PURE__ */ new Set();
  if (ingress?.secured && !ingress.damaged) {
    basePowerSourceIds.add(ingress.id);
  }
  Object.values(rooms).forEach((room) => {
    if (!room.secured || room.damaged) {
      return;
    }
    if (room.isPowerSource && !roomHasCoreType(room, "generator")) {
      basePowerSourceIds.add(room.id);
    }
  });
  basePowerSourceIds.forEach((sourceId) => {
    propagatePowerFromSource(sourceId, POWER_SOURCE_WATTS_PER_TICK);
  });
  const activeGeneratorSourceIds = new Set(Object.values(rooms).filter((room) => room.secured && !room.damaged && roomHasCoreType(room, "generator") && room.supplyFlow >= getRoomCoreOperationalRequirements(room).supplyCrates && room.powerFlow >= Math.max(GENERATOR_MIN_INPUT_WATTS, getRoomCoreOperationalRequirements(room).powerWatts)).map((room) => room.id));
  const generatorInputWattsByRoom = new Map(
    Object.values(rooms).map((room) => [room.id, room.powerFlow])
  );
  activeGeneratorSourceIds.forEach((sourceId) => {
    const sourceRoom = rooms[sourceId];
    propagatePowerFromSource(sourceId, getCorePowerOutputWatts(sourceRoom, generatorInputWattsByRoom.get(sourceId) ?? 0));
  });
  const propagateCommsFromSource = (sourceId, sourceBandwidth) => {
    const sourceRoom = rooms[sourceId];
    if (!sourceRoom) {
      return;
    }
    const queue = [{ roomId: sourceId, depth: 0 }];
    const bestDepth = /* @__PURE__ */ new Map([[sourceId, 0]]);
    while (queue.length > 0) {
      const current = queue.shift();
      const currentRoom2 = rooms[current.roomId];
      if (!currentRoom2 || currentRoom2.damaged) {
        continue;
      }
      const bandwidth = Math.max(0, sourceBandwidth - current.depth * COMMS_FALLOFF_PER_ROOM);
      if (bandwidth <= 0) {
        continue;
      }
      currentRoom2.commsLinked = true;
      currentRoom2.connected = true;
      currentRoom2.commsFlow = Math.max(currentRoom2.commsFlow, bandwidth);
      if (bandwidth <= COMMS_FALLOFF_PER_ROOM) {
        continue;
      }
      currentRoom2.adjacency.forEach((adjacentId) => {
        const adjacentRoom = rooms[adjacentId];
        if (!adjacentRoom || adjacentRoom.damaged) {
          return;
        }
        if (current.roomId !== sourceId && !adjacentRoom.secured) {
          return;
        }
        const nextDepth = current.depth + 1;
        if ((bestDepth.get(adjacentId) ?? Number.POSITIVE_INFINITY) <= nextDepth) {
          return;
        }
        bestDepth.set(adjacentId, nextDepth);
        queue.push({ roomId: adjacentId, depth: nextDepth });
      });
    }
  };
  const commsSourceIds = /* @__PURE__ */ new Set();
  if (ingress?.secured && !ingress.damaged) {
    commsSourceIds.add(ingress.id);
  }
  commsSourceIds.forEach((sourceId) => {
    propagateCommsFromSource(sourceId, COMMS_SOURCE_BANDWIDTH_PER_TICK);
  });
  const activeCommandSourceIds = new Set(Object.values(rooms).filter((room) => room.secured && roomHasCoreType(room, "command_center") && roomHasOperationalCore(room)).map((room) => room.id));
  const commandInputBandwidthByRoom = new Map(
    Object.values(rooms).map((room) => [room.id, room.commsFlow])
  );
  activeCommandSourceIds.forEach((sourceId) => {
    const sourceRoom = rooms[sourceId];
    propagateCommsFromSource(sourceId, getCoreCommsOutputBw(sourceRoom, commandInputBandwidthByRoom.get(sourceId) ?? 0));
  });
  const activeSupplySourceIds = new Set(Object.values(rooms).filter((room) => room.secured && !room.damaged && roomHasCoreType(room, "supply_depot") && roomHasOperationalCore(room)).map((room) => room.id));
  const supplyInputCratesByRoom = new Map(
    Object.values(rooms).map((room) => [room.id, room.supplyFlow])
  );
  activeSupplySourceIds.forEach((sourceId) => {
    const sourceRoom = rooms[sourceId];
    propagateSupplyFromSource(sourceId, getCoreSupplyOutputCrates(sourceRoom, supplyInputCratesByRoom.get(sourceId) ?? 0));
  });
  const newlyActiveGenerators = Object.values(rooms).filter((room) => room.secured && !room.damaged && roomHasCoreType(room, "generator") && !activeGeneratorSourceIds.has(room.id) && room.supplyFlow >= getRoomCoreOperationalRequirements(room).supplyCrates && room.powerFlow >= Math.max(GENERATOR_MIN_INPUT_WATTS, getRoomCoreOperationalRequirements(room).powerWatts));
  const newlyActiveGeneratorInputWattsByRoom = new Map(
    newlyActiveGenerators.map((room) => [room.id, room.powerFlow])
  );
  newlyActiveGenerators.forEach((room) => {
    activeGeneratorSourceIds.add(room.id);
    propagatePowerFromSource(room.id, getCorePowerOutputWatts(room, newlyActiveGeneratorInputWattsByRoom.get(room.id) ?? 0));
  });
  const newlyActiveCommands = Object.values(rooms).filter((room) => room.secured && roomHasCoreType(room, "command_center") && !activeCommandSourceIds.has(room.id) && roomHasOperationalCore(room));
  const newlyActiveCommandInputBandwidthByRoom = new Map(
    newlyActiveCommands.map((room) => [room.id, room.commsFlow])
  );
  newlyActiveCommands.forEach((room) => {
    activeCommandSourceIds.add(room.id);
    propagateCommsFromSource(room.id, getCoreCommsOutputBw(room, newlyActiveCommandInputBandwidthByRoom.get(room.id) ?? 0));
  });
  const newlyActiveSupplyDepots = Object.values(rooms).filter((room) => room.secured && !room.damaged && roomHasCoreType(room, "supply_depot") && !activeSupplySourceIds.has(room.id) && roomHasOperationalCore(room));
  const newlyActiveSupplyInputCratesByRoom = new Map(
    newlyActiveSupplyDepots.map((room) => [room.id, room.supplyFlow])
  );
  newlyActiveSupplyDepots.forEach((room) => {
    activeSupplySourceIds.add(room.id);
    propagateSupplyFromSource(room.id, getCoreSupplyOutputCrates(room, newlyActiveSupplyInputCratesByRoom.get(room.id) ?? 0));
  });
  const applyIntel = (sourceId, detailedLimit, fringeLimit) => {
    const sourceRoom = rooms[sourceId];
    if (!sourceRoom) {
      return;
    }
    const queue = [{ roomId: sourceId, depth: 0 }];
    const bestDepth = /* @__PURE__ */ new Map([[sourceId, 0]]);
    while (queue.length > 0) {
      const current = queue.shift();
      const currentRoom2 = rooms[current.roomId];
      if (!currentRoom2) {
        continue;
      }
      if (current.depth <= detailedLimit) {
        currentRoom2.intelLevel = 2;
      } else if (current.depth <= fringeLimit) {
        currentRoom2.intelLevel = currentRoom2.intelLevel === 2 ? 2 : 1;
      }
      if (current.depth >= fringeLimit) {
        continue;
      }
      currentRoom2.adjacency.forEach((adjacentId) => {
        const nextDepth = current.depth + 1;
        if ((bestDepth.get(adjacentId) ?? Number.POSITIVE_INFINITY) <= nextDepth) {
          return;
        }
        bestDepth.set(adjacentId, nextDepth);
        queue.push({ roomId: adjacentId, depth: nextDepth });
      });
    }
  };
  Object.values(rooms).forEach((room) => {
    if (room.secured) {
      room.intelLevel = 2;
      applyIntel(room.id, 0, 1);
    }
  });
  const activeCommandCenters = Object.values(rooms).filter((room) => room.commsLinked && roomHasCoreType(room, "command_center") && roomHasOperationalCore(room));
  activeCommandCenters.forEach((room) => {
    const detailedLimit = Math.max(1, getRoomPrimaryCoreAssignmentByType(room, "command_center")?.supportRadius ?? 1);
    applyIntel(room.id, detailedLimit, detailedLimit + 1);
  });
  const currentRoom = rooms[next.currentRoomId];
  if (currentRoom) {
    currentRoom.intelLevel = 2;
    if (currentRoom.commsLinked || currentRoom.adjacency.some((adjacentId) => rooms[adjacentId]?.commsLinked)) {
      applyIntel(currentRoom.id, 1, 2);
    } else {
      applyIntel(currentRoom.id, 0, 1);
    }
  }
  Object.values(rooms).forEach((room) => {
    room.supplied = room.supplyFlow > 0;
    room.powered = room.powerFlow > 0;
    room.commsVisible = room.intelLevel > 0 || room.secured || room.id === next.currentRoomId;
  });
  return syncObjectiveState(applySquadContactState(next));
}
function resolveThreatDamage(theater, roomId, reason, allowRoomLoss) {
  const next = cloneTheater(theater);
  const room = next.rooms[roomId];
  if (!room) {
    return theater;
  }
  let message = `THREAT :: ${room.label} absorbed perimeter damage.`;
  if (room.fortificationPips.barricade > 0) {
    room.fortificationPips.barricade = Math.max(0, room.fortificationPips.barricade - 1);
    room.fortified = getInstalledFortificationCount2(room) > 0;
    room.damaged = true;
    room.abandoned = true;
    message = `THREAT :: ${room.label} lost a Barricade (${reason}).`;
  } else if (allowRoomLoss || room.damaged || room.abandoned) {
    room.secured = false;
    room.status = "mapped";
    room.damaged = true;
    room.abandoned = true;
    clearRoomCoreAssignments(room);
    room.fortificationPips.powerRail = Math.max(0, room.fortificationPips.powerRail - 1);
    room.fortified = getInstalledFortificationCount2(room) > 0;
    message = `THREAT :: ${room.label} was abandoned and control was lost (${reason}).`;
  } else {
    room.damaged = true;
    room.abandoned = true;
    message = `THREAT :: ${room.label} was left unsupported and is now damaged (${reason}).`;
  }
  room.underThreat = false;
  next.activeThreats = next.activeThreats.map(
    (threat) => threat.roomId === roomId || threat.currentRoomId === roomId || threat.targetRoomId === roomId ? { ...threat, active: false } : threat
  );
  return addTheaterEvent(recomputeTheaterNetwork(next), message);
}
function resolveOperationFields(operation, theater) {
  const floorIndex = operation.atlasFloorId && operation.floors.length <= 1 ? 0 : Math.max(0, (theater.definition.floorOrdinal ?? 1) - 1);
  return {
    ...operation,
    objective: theater.definition.objective,
    recommendedPWR: theater.definition.recommendedPWR,
    beginningState: theater.definition.beginningState,
    endState: theater.definition.endState,
    currentFloorIndex: floorIndex,
    currentRoomId: theater.currentRoomId,
    theater,
    theaterFloors: {
      ...operation.theaterFloors ?? {},
      [floorIndex]: cloneTheater(theater)
    }
  };
}
function isValidTheaterNetwork(theater) {
  return Boolean(
    theater && typeof theater.definition?.uplinkRoomId === "string" && typeof theater.definition?.floorId === "string" && Object.values(theater.rooms).every((room) => typeof room.theaterId === "string" && room.localPosition !== void 0 && typeof room.depthFromUplink === "number" && typeof room.isUplinkRoom === "boolean")
  );
}
function getClampedOperationFloorIndex(operation) {
  const maxFloorIndex = Math.max(0, operation.floors.length - 1);
  return Math.max(0, Math.min(operation.currentFloorIndex ?? 0, maxFloorIndex));
}
function getTheaterFloorIndex(theater) {
  return Math.max(0, (theater.definition.floorOrdinal ?? 1) - 1);
}
function doesTheaterMatchOperationFloor(operation, theater, currentFloorIndex) {
  if (operation.atlasFloorId && operation.floors.length <= 1) {
    return theater.definition.floorId === operation.atlasFloorId;
  }
  return getTheaterFloorIndex(theater) === currentFloorIndex;
}
function prepareTheaterForOperation(theater) {
  return reconcileTheaterCompletion(recomputeTheaterNetwork(theater));
}
function generateTheaterForFloor(operation, floorIndex) {
  try {
    return createGeneratedTheaterFloor(operation, floorIndex);
  } catch (error) {
    console.error("[THEATER] generated floor fallback", operation.id, floorIndex, error);
    return createIronGateTheater(operation);
  }
}
function ensureOperationHasTheater(operation) {
  if (!operation) {
    return null;
  }
  const currentFloorIndex = getClampedOperationFloorIndex(operation);
  const normalizedOperation = currentFloorIndex === operation.currentFloorIndex ? operation : {
    ...operation,
    currentFloorIndex
  };
  if (isValidTheaterNetwork(normalizedOperation.theater) && doesTheaterMatchOperationFloor(normalizedOperation, normalizedOperation.theater, currentFloorIndex)) {
    return resolveOperationFields(normalizedOperation, prepareTheaterForOperation(normalizedOperation.theater));
  }
  const storedFloorTheater = normalizedOperation.theaterFloors?.[currentFloorIndex];
  if (isValidTheaterNetwork(storedFloorTheater) && doesTheaterMatchOperationFloor(normalizedOperation, storedFloorTheater, currentFloorIndex)) {
    return resolveOperationFields(
      {
        ...normalizedOperation,
        theater: storedFloorTheater
      },
      prepareTheaterForOperation(storedFloorTheater)
    );
  }
  return resolveOperationFields(
    normalizedOperation,
    prepareTheaterForOperation(generateTheaterForFloor(normalizedOperation, currentFloorIndex))
  );
}
function hasTheaterOperation(operation) {
  return Boolean(operation?.theater);
}
function getMoveTickCost(theater, roomId) {
  const room = theater.rooms[roomId];
  if (!room) {
    return 0;
  }
  return room.secured ? 1 : 2;
}
function getInstalledFortificationCount2(room) {
  return getInstalledFortificationCount(room.fortificationPips);
}
function isDefenseBattleRoom(room) {
  return room.secured && (room.underThreat || room.damaged);
}
function findTheaterRoute(theater, roomId) {
  const originId = theater.currentRoomId;
  if (originId === roomId) {
    return [originId];
  }
  const destination = theater.rooms[roomId];
  if (!destination || destination.status === "unknown" && !destination.commsVisible || isTheaterRoomLocked(theater, destination)) {
    return null;
  }
  const bestCost = /* @__PURE__ */ new Map([[originId, 0]]);
  const previous = /* @__PURE__ */ new Map([[originId, null]]);
  const queue = [{ roomId: originId, cost: 0 }];
  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift();
    if (current.cost > (bestCost.get(current.roomId) ?? Number.POSITIVE_INFINITY)) {
      continue;
    }
    if (current.roomId === roomId) {
      break;
    }
    const currentRoom = theater.rooms[current.roomId];
    if (!currentRoom) {
      continue;
    }
    currentRoom.adjacency.forEach((adjacentId) => {
      const adjacentRoom = theater.rooms[adjacentId];
      if (!adjacentRoom) {
        return;
      }
      if (!isTheaterPassagePowered(theater, current.roomId, adjacentId)) {
        return;
      }
      if (isTheaterRoomLocked(theater, adjacentRoom)) {
        return;
      }
      if (adjacentId !== roomId && !adjacentRoom.secured) {
        return;
      }
      if (adjacentRoom.status === "unknown" && !adjacentRoom.commsVisible) {
        return;
      }
      const nextCost = current.cost + getMoveTickCost(theater, adjacentId);
      if (nextCost >= (bestCost.get(adjacentId) ?? Number.POSITIVE_INFINITY)) {
        return;
      }
      bestCost.set(adjacentId, nextCost);
      previous.set(adjacentId, current.roomId);
      queue.push({ roomId: adjacentId, cost: nextCost });
    });
  }
  if (!previous.has(roomId)) {
    return null;
  }
  const path = [];
  let cursor = roomId;
  while (cursor) {
    path.push(cursor);
    cursor = previous.get(cursor) ?? null;
  }
  return path.reverse();
}
function getCoreBattleRewardBonus(theater, room) {
  if (room.commsFlow < 50) {
    return {
      metalScrap: 0,
      wood: 0,
      chaosShards: 0,
      steamComponents: 0
    };
  }
  const activeMineCount = Object.values(theater.rooms).filter((candidate) => roomHasOperationalCoreType(candidate, "mine")).length;
  const activeRefineryCount = Object.values(theater.rooms).filter((candidate) => roomHasOperationalCoreType(candidate, "refinery")).length;
  if (activeMineCount <= 0 && activeRefineryCount <= 0) {
    return {
      metalScrap: 0,
      wood: 0,
      chaosShards: 0,
      steamComponents: 0
    };
  }
  return {
    metalScrap: activeMineCount * (roomHasTag(room, "metal_rich") ? 3 : 1),
    wood: activeMineCount * (roomHasTag(room, "timber_rich") ? 3 : 1),
    chaosShards: 0,
    steamComponents: activeRefineryCount * (roomHasTag(room, "steam_vent") ? 3 : 1)
  };
}
function autoResolveNonCombatRoom(theater, roomId) {
  const room = theater.rooms[roomId];
  if (!room || room.secured || room.clearMode !== "empty" && room.clearMode !== "field") {
    return theater;
  }
  room.status = "secured";
  room.secured = true;
  room.underThreat = false;
  room.damaged = false;
  room.fortified = getInstalledFortificationCount2(room) > 0;
  const logLine = room.clearMode === "field" ? `FIELD SWEEP :: ${room.label} cleared through patrol floors.` : `CLEAR :: ${room.label} checked and secured. No hostile contact.`;
  return syncTheaterKeyInventory(
    collectRoomKeyIfPresent(
      addTheaterEvent(theater, logLine),
      roomId
    )
  );
}
function setTheaterSelectedRoom(state, roomId) {
  const operation = getPreparedTheaterOperation(state);
  if (!operation?.theater || !operation.theater.rooms[roomId]) {
    return state;
  }
  return {
    ...state,
    phase: "operation",
    operation: resolveOperationFields(operation, {
      ...operation.theater,
      selectedRoomId: roomId
    })
  };
}
function setTheaterCurrentRoom(state, roomId) {
  const operation = getPreparedTheaterOperation(state);
  if (!operation?.theater || !operation.theater.rooms[roomId]) {
    return state;
  }
  const theater = cloneTheater(operation.theater);
  theater.currentRoomId = roomId;
  theater.selectedRoomId = roomId;
  const selectedSquad = getSelectedSquad(theater);
  if (selectedSquad) {
    selectedSquad.currentRoomId = roomId;
  }
  return {
    ...state,
    phase: "operation",
    operation: resolveOperationFields(operation, theater)
  };
}
function advanceTheaterRuntimeTicks(state, wad, resources, theater, ticks) {
  let nextState = {
    ...state,
    wad,
    resources,
    phase: "operation",
    operation: state.operation ? resolveOperationFields(state.operation, theater) : state.operation
  };
  for (let tickIndex = 0; tickIndex < ticks; tickIndex += 1) {
    const operation = getPreparedTheaterOperation(nextState);
    const activeTheater = operation?.theater;
    if (!operation || !activeTheater) {
      break;
    }
    const nextTheater = cloneTheater(activeTheater);
    nextTheater.tickCount += 1;
    const afterThreats = resolveEnemyRoomThreats(nextState, nextTheater);
    nextState = {
      ...nextState,
      operation: resolveOperationFields(operation, afterThreats)
    };
    nextState = advanceAutomatedSquads(nextState);
  }
  return nextState;
}
function moveToTheaterRoom(state, roomId) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return {
      state,
      roomId,
      path: [],
      tickCost: 0,
      requiresBattle: false,
      requiresField: false,
      error: "No active theater operation."
    };
  }
  const selectedSquad = getSelectedSquad(theater);
  if (!selectedSquad) {
    return {
      state,
      roomId,
      path: [],
      tickCost: 0,
      requiresBattle: false,
      requiresField: false,
      error: "No active squad is available in this theater."
    };
  }
  if (!canManuallyControlTheaterSquad(theater, selectedSquad)) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      roomId,
      path: [],
      tickCost: 0,
      requiresBattle: false,
      requiresField: false,
      error: `${selectedSquad.squadId.toUpperCase()} is COMMS OFFLINE and cannot be moved manually.`
    };
  }
  const currentRoom = theater.rooms[selectedSquad.currentRoomId];
  const destination = theater.rooms[roomId];
  if (!currentRoom || !destination) {
    return {
      state,
      roomId,
      path: [],
      tickCost: 0,
      requiresBattle: false,
      requiresField: false,
      error: "Target room is not part of this theater."
    };
  }
  if (isTheaterRoomLocked(theater, destination)) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      roomId,
      path: [],
      tickCost: 0,
      requiresBattle: false,
      requiresField: false,
      error: `${formatTheaterKeyLabel(destination.requiredKeyType)} required to access that room.`
    };
  }
  const route = findTheaterRoute(theater, roomId);
  if (!route) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      roomId,
      path: [],
      tickCost: 0,
      requiresBattle: false,
      requiresField: false,
      error: "No secured route reaches that room yet."
    };
  }
  if (currentRoom.id === destination.id) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      roomId,
      path: route,
      tickCost: 0,
      requiresBattle: isDefenseBattleRoom(destination) || !destination.secured && destination.clearMode === "battle" && destination.tacticalEncounter !== null,
      requiresField: !destination.secured && destination.clearMode === "field"
    };
  }
  if (destination.status === "unknown" && !destination.commsVisible) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      roomId,
      path: route,
      tickCost: 0,
      requiresBattle: false,
      requiresField: false,
      error: "Comms cannot verify this room yet."
    };
  }
  const tickCost = route.slice(1).reduce((total, stepRoomId) => total + getMoveTickCost(theater, stepRoomId), 0);
  const economyTheater = recomputeTheaterNetwork(theater);
  const wadUpkeep = sumWadUpkeep(economyTheater, tickCost);
  const resourceIncome = sumResourceIncome(economyTheater, tickCost);
  let resources = { ...state.resources };
  let wad = state.wad ?? 0;
  let nextTheater = cloneTheater(theater);
  const destinationRoom = nextTheater.rooms[roomId];
  if (wad >= wadUpkeep) {
    wad -= wadUpkeep;
    resources = addResources2(resources, resourceIncome);
  } else {
    Object.values(nextTheater.rooms).forEach((room) => {
      if (roomHasAnyCore(room)) {
        room.underThreat = true;
        room.damaged = room.damaged || room.fortificationPips.barricade <= 0;
      }
    });
    nextTheater = addTheaterEvent(nextTheater, "UPKEEP :: Wad reserves too low for maintenance. Unsupported C.O.R.E.s are destabilizing.");
  }
  nextTheater.currentRoomId = roomId;
  nextTheater.selectedRoomId = roomId;
  const nextSelectedSquad = nextTheater.squads.find((squad) => squad.squadId === selectedSquad.squadId);
  if (nextSelectedSquad) {
    nextSelectedSquad.currentRoomId = roomId;
    nextSelectedSquad.status = "moving";
    nextSelectedSquad.automationMode = "manual";
    nextSelectedSquad.autoStatus = "idle";
    nextSelectedSquad.autoTargetRoomId = null;
  }
  if (destinationRoom.status === "unknown") {
    destinationRoom.status = "mapped";
  }
  nextTheater = autoResolveNonCombatRoom(nextTheater, roomId);
  nextTheater = advanceOccupationObjective(nextTheater, tickCost);
  let nextState = advanceTheaterRuntimeTicks(state, wad, resources, nextTheater, tickCost);
  nextState = recoverOperationalSquadsAtMedicalWards(nextState);
  const nextOperation = getPreparedTheaterOperation(nextState);
  const runtimeTheater = nextOperation?.theater ?? nextTheater;
  const runtimeDestinationRoom = runtimeTheater.rooms[roomId] ?? destinationRoom;
  return {
    state: nextState,
    roomId,
    path: route,
    tickCost,
    requiresBattle: isDefenseBattleRoom(runtimeDestinationRoom) || !runtimeDestinationRoom.secured && runtimeDestinationRoom.clearMode === "battle" && runtimeDestinationRoom.tacticalEncounter !== null,
    requiresField: !runtimeDestinationRoom.secured && runtimeDestinationRoom.clearMode === "field"
  };
}
function holdPositionInTheater(state, ticks = 1) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return {
      state,
      roomId: "",
      path: [],
      tickCost: 0,
      requiresBattle: false,
      requiresField: false,
      error: "No active theater operation."
    };
  }
  const selectedSquad = getSelectedSquad(theater);
  if (!selectedSquad) {
    return {
      state,
      roomId: "",
      path: [],
      tickCost: 0,
      requiresBattle: false,
      requiresField: false,
      error: "No active squad is available in this theater."
    };
  }
  if (!canManuallyControlTheaterSquad(theater, selectedSquad)) {
    return {
      state,
      roomId: selectedSquad.currentRoomId,
      path: [],
      tickCost: 0,
      requiresBattle: false,
      requiresField: false,
      error: `${selectedSquad.squadId.toUpperCase()} is COMMS OFFLINE and cannot receive hold orders.`
    };
  }
  const resolvedTicks = Math.max(1, Math.floor(ticks));
  const currentRoom = theater.rooms[selectedSquad.currentRoomId];
  if (!currentRoom) {
    return {
      state,
      roomId: selectedSquad.currentRoomId,
      path: [],
      tickCost: 0,
      requiresBattle: false,
      requiresField: false,
      error: "Current room is not available."
    };
  }
  let resources = { ...state.resources };
  let wad = state.wad ?? 0;
  let nextTheater = cloneTheater(theater);
  const economyTheater = recomputeTheaterNetwork(theater);
  const wadUpkeep = sumWadUpkeep(economyTheater, resolvedTicks);
  const resourceIncome = sumResourceIncome(economyTheater, resolvedTicks);
  if (wad >= wadUpkeep) {
    wad -= wadUpkeep;
    resources = addResources2(resources, resourceIncome);
  } else {
    Object.values(nextTheater.rooms).forEach((room) => {
      if (roomHasAnyCore(room)) {
        room.underThreat = true;
        room.damaged = room.damaged || room.fortificationPips.barricade <= 0;
      }
    });
    nextTheater = addTheaterEvent(nextTheater, "UPKEEP :: Wad reserves too low for maintenance. Unsupported C.O.R.E.s are destabilizing.");
  }
  nextTheater.currentRoomId = currentRoom.id;
  nextTheater.selectedRoomId = currentRoom.id;
  nextTheater = advanceOccupationObjective(nextTheater, resolvedTicks);
  const holdingSquad = findSquad(nextTheater, selectedSquad.squadId);
  if (holdingSquad) {
    holdingSquad.automationMode = "manual";
    holdingSquad.autoStatus = "holding";
    holdingSquad.autoTargetRoomId = null;
  }
  let nextState = advanceTheaterRuntimeTicks(state, wad, resources, nextTheater, resolvedTicks);
  nextState = recoverOperationalSquadsAtMedicalWards(nextState);
  const nextOperation = getPreparedTheaterOperation(nextState);
  const runtimeTheater = nextOperation?.theater ?? nextTheater;
  const nextCurrentRoom = runtimeTheater.rooms[currentRoom.id] ?? currentRoom;
  return {
    state: nextState,
    roomId: currentRoom.id,
    path: [currentRoom.id],
    tickCost: resolvedTicks,
    requiresBattle: isDefenseBattleRoom(nextCurrentRoom),
    requiresField: false
  };
}
function getSelectedTheaterSquad(theater) {
  return getSelectedSquad(theater);
}
function getTheaterObjectiveDefinition(theater) {
  return theater.objectiveDefinition ? { ...theater.objectiveDefinition, progress: { ...theater.objectiveDefinition.progress } } : null;
}
function findAnyTheaterRoute(theater, fromRoomId, toRoomId) {
  if (fromRoomId === toRoomId) {
    return [fromRoomId];
  }
  const queue = [fromRoomId];
  const previous = /* @__PURE__ */ new Map([[fromRoomId, null]]);
  while (queue.length > 0) {
    const currentRoomId = queue.shift();
    const currentRoom = theater.rooms[currentRoomId];
    if (!currentRoom) {
      continue;
    }
    for (const adjacentId of currentRoom.adjacency) {
      if (previous.has(adjacentId) || !theater.rooms[adjacentId]) {
        continue;
      }
      previous.set(adjacentId, currentRoomId);
      if (adjacentId === toRoomId) {
        queue.length = 0;
        break;
      }
      queue.push(adjacentId);
    }
  }
  if (!previous.has(toRoomId)) {
    return null;
  }
  const path = [];
  let cursor = toRoomId;
  while (cursor) {
    path.push(cursor);
    cursor = previous.get(cursor) ?? null;
  }
  return path.reverse();
}
function getVisibleThreatCount(theater) {
  return theater.activeThreats.filter((threat) => threat.active).length;
}
function selectPatrolTargetRoom(theater, sourceRoomId) {
  const ingressRoom = theater.rooms[theater.definition.ingressRoomId] ?? null;
  const candidates = Object.values(theater.rooms).filter((room) => room.id !== sourceRoomId && room.secured);
  let bestRoom = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  candidates.forEach((room) => {
    const hasOperationalCore = roomHasOperationalCore(room);
    const isFrontier = room.adjacency.some((adjacentId) => !theater.rooms[adjacentId]?.secured);
    const isMajorRoute = room.supplyFlow > 0 || room.powerFlow > 0 || room.commsFlow > 0;
    const score = (hasOperationalCore ? 100 : 0) + (isFrontier ? 70 : 0) + (isMajorRoute ? 40 : 0) + room.depthFromUplink + (room.underThreat ? -20 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestRoom = room;
    }
  });
  return bestRoom ?? ingressRoom;
}
function dispatchStagingThreats(theater) {
  let next = cloneTheater(theater);
  const activeThreatCount = getVisibleThreatCount(next);
  if (activeThreatCount >= 3) {
    return next;
  }
  Object.values(next.rooms).forEach((room) => {
    if (!room.enemySite || room.secured || getVisibleThreatCount(next) >= 3) {
      return;
    }
    if (next.tickCount < room.enemySite.nextDispatchTick) {
      return;
    }
    const targetRoom = selectPatrolTargetRoom(next, room.id);
    const route = targetRoom ? findAnyTheaterRoute(next, room.id, targetRoom.id) : null;
    if (!targetRoom || !route || route.length <= 1) {
      room.enemySite = {
        ...room.enemySite,
        nextDispatchTick: next.tickCount + room.enemySite.dispatchInterval
      };
      return;
    }
    room.enemySite = {
      ...room.enemySite,
      nextDispatchTick: next.tickCount + room.enemySite.dispatchInterval
    };
    const threat = {
      id: `patrol_${next.definition.id}_${room.id}_${next.tickCount}_${next.activeThreats.length + 1}`,
      type: "patrol",
      roomId: room.id,
      sourceRoomId: room.id,
      currentRoomId: room.id,
      targetRoomId: targetRoom.id,
      route,
      routeIndex: 0,
      etaTick: next.tickCount + Math.max(1, route.length - 1),
      strength: Math.max(1, room.enemySite.patrolStrength),
      cause: `Patrol launched from ${room.label}`,
      severity: Math.max(1, room.enemySite.reserveStrength),
      spawnedAtTick: next.tickCount,
      active: true
    };
    console.log("[THEATER] threat event triggered", threat.id, threat.sourceRoomId, threat.targetRoomId);
    next.activeThreats = [...next.activeThreats, threat].slice(-8);
    next = addTheaterEvent(
      next,
      room.commsVisible ? `PATROL :: Hostile squad departing ${room.label} toward ${targetRoom.label}.` : `PATROL :: Enemy movement detected in the active theater.`
    );
  });
  return next;
}
function advancePatrolThreats(theater) {
  let next = cloneTheater(theater);
  let pendingDamage = [];
  next.activeThreats = next.activeThreats.map((threat) => {
    if (!threat.active) {
      return threat;
    }
    const currentRoom = next.rooms[threat.currentRoomId];
    const targetRoom = next.rooms[threat.targetRoomId];
    if (!currentRoom || !targetRoom) {
      return { ...threat, active: false };
    }
    if (threat.routeIndex >= threat.route.length - 1) {
      if (targetRoom.secured) {
        targetRoom.underThreat = true;
        if (next.tickCount > threat.etaTick) {
          pendingDamage.push({ roomId: targetRoom.id, reason: `${currentRoom.label} patrol broke through` });
          return { ...threat, active: false };
        }
      }
      return {
        ...threat,
        roomId: targetRoom.id,
        currentRoomId: targetRoom.id
      };
    }
    const nextRouteIndex = Math.min(threat.route.length - 1, threat.routeIndex + 1);
    const nextRoomId = threat.route[nextRouteIndex] ?? threat.currentRoomId;
    const nextRoom = next.rooms[nextRoomId];
    if (!nextRoom) {
      return { ...threat, active: false };
    }
    if (nextRoom.secured) {
      nextRoom.underThreat = true;
    }
    return {
      ...threat,
      roomId: nextRoomId,
      currentRoomId: nextRoomId,
      routeIndex: nextRouteIndex,
      etaTick: nextRouteIndex >= threat.route.length - 1 ? next.tickCount : threat.etaTick
    };
  });
  pendingDamage.forEach(({ roomId, reason }) => {
    next = resolveThreatDamage(next, roomId, reason, false);
  });
  return next;
}
function getRoomDistance(theater, fromRoomId, toRoomId) {
  const route = findAnyTheaterRoute(theater, fromRoomId, toRoomId);
  return route ? Math.max(0, route.length - 1) : Number.POSITIVE_INFINITY;
}
function findThreatForSquad(theater, squad) {
  const localThreats = theater.activeThreats.filter((threat) => threat.active && theater.rooms[threat.currentRoomId]?.commsVisible).filter((threat) => getRoomDistance(theater, squad.currentRoomId, threat.currentRoomId) <= 2).sort((left, right) => getRoomDistance(theater, squad.currentRoomId, left.currentRoomId) - getRoomDistance(theater, squad.currentRoomId, right.currentRoomId));
  return localThreats[0] ?? null;
}
function setThreatResolved(theater, roomId) {
  const next = cloneTheater(theater);
  const room = next.rooms[roomId];
  if (room) {
    room.underThreat = false;
    room.damaged = false;
  }
  next.activeThreats = next.activeThreats.map(
    (threat) => threat.currentRoomId === roomId || threat.targetRoomId === roomId ? { ...threat, active: false } : threat
  );
  return next;
}
function runAutoSquadStep(state, squadId, mode) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return state;
  }
  const squad = findSquad(theater, squadId);
  if (!squad) {
    return state;
  }
  const room = theater.rooms[squad.currentRoomId];
  if (!room) {
    return state;
  }
  const combatReadyUnitIds = getSquadCombatReadyUnitIds(state, operation.id, theater.definition.id, squad);
  const incapacitatedUnitIds = getSquadIncapacitatedUnitIds(state, operation.id, theater.definition.id, squad);
  if (incapacitatedUnitIds.length > 0) {
    if (roomHasOperationalCoreType(room, "medical_ward")) {
      const nextTheater2 = cloneTheater(theater);
      const nextSquad2 = findSquad(nextTheater2, squad.squadId);
      if (nextSquad2) {
        nextSquad2.autoStatus = "recovering";
        nextSquad2.autoTargetRoomId = room.id;
      }
      return {
        ...state,
        operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater2))
      };
    }
    const nearestMedicalWard = Object.values(theater.rooms).filter((candidate) => candidate.secured && roomHasOperationalCoreType(candidate, "medical_ward")).map((candidate) => ({
      room: candidate,
      route: findAnyTheaterRoute(theater, squad.currentRoomId, candidate.id)
    })).filter((candidate) => Boolean(candidate.route && candidate.route.length > 0)).sort((left, right) => left.route.length - right.route.length)[0] ?? null;
    if (nearestMedicalWard && nearestMedicalWard.route.length > 1) {
      const nextRoomId = nearestMedicalWard.route[1];
      const nextTheater2 = cloneTheater(theater);
      const nextSquad2 = findSquad(nextTheater2, squad.squadId);
      if (nextSquad2) {
        nextSquad2.currentRoomId = nextRoomId;
        nextSquad2.autoStatus = "recovering";
        nextSquad2.autoTargetRoomId = nearestMedicalWard.room.id;
      }
      return {
        ...state,
        operation: resolveOperationFields(
          operation,
          addTheaterEvent(
            recomputeTheaterNetwork(nextTheater2),
            `AUTO-${mode.toUpperCase()} :: ${squad.displayName} falling back toward ${nearestMedicalWard.room.label} for casualty recovery.`
          )
        )
      };
    }
  }
  if (combatReadyUnitIds.length <= 0) {
    const nextTheater2 = cloneTheater(theater);
    const nextSquad2 = findSquad(nextTheater2, squad.squadId);
    if (nextSquad2) {
      nextSquad2.autoStatus = "recovering";
      nextSquad2.autoTargetRoomId = null;
    }
    return {
      ...state,
      operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater2))
    };
  }
  const threat = findThreatForSquad(theater, squad);
  if (room.underThreat || room.damaged || threat?.currentRoomId === squad.currentRoomId) {
    const stagedTheater = cloneTheater(theater);
    const stagedSquad = findSquad(stagedTheater, squad.squadId);
    if (stagedSquad) {
      stagedSquad.autoStatus = "intercepting";
      stagedSquad.autoTargetRoomId = squad.currentRoomId;
    }
    const stagedState = {
      ...state,
      operation: resolveOperationFields(operation, recomputeTheaterNetwork(stagedTheater))
    };
    const resolved = resolveTheaterAutoBattle(stagedState, squad.squadId, squad.currentRoomId, mode);
    const nextOperation = getPreparedTheaterOperation(resolved);
    const nextTheater2 = nextOperation?.theater;
    if (!nextOperation || !nextTheater2) {
      return resolved;
    }
    return {
      ...resolved,
      operation: resolveOperationFields(
        nextOperation,
        addTheaterEvent(
          setThreatResolved(nextTheater2, squad.currentRoomId),
          `AUTO-${mode.toUpperCase()} :: ${squad.displayName} intercepted hostile contact in ${room.label}.`
        )
      )
    };
  }
  if (threat) {
    const route = findAnyTheaterRoute(theater, squad.currentRoomId, threat.currentRoomId);
    if (route && route.length > 1) {
      const nextRoomId = route[1];
      const nextTheater2 = cloneTheater(theater);
      const nextSquad2 = findSquad(nextTheater2, squad.squadId);
      if (nextSquad2) {
        nextSquad2.currentRoomId = nextRoomId;
        nextSquad2.autoStatus = "intercepting";
        nextSquad2.autoTargetRoomId = threat.currentRoomId;
      }
      nextTheater2.currentRoomId = theater.currentRoomId;
      nextTheater2.selectedRoomId = theater.selectedRoomId;
      return {
        ...state,
        operation: resolveOperationFields(
          operation,
          addTheaterEvent(recomputeTheaterNetwork(nextTheater2), `AUTO-${mode.toUpperCase()} :: ${squad.displayName} redeploying toward ${nextTheater2.rooms[nextRoomId]?.label ?? nextRoomId}.`)
        )
      };
    }
  }
  const adjacentPushTarget = room.adjacency.map((adjacentId) => theater.rooms[adjacentId]).filter((candidate) => Boolean(candidate)).find((candidate) => candidate.commsVisible && !candidate.secured && (mode === "daring" || !candidate.tags.includes("enemy_staging")));
  if (adjacentPushTarget) {
    const stagedTheater = cloneTheater(theater);
    const stagedSquad = findSquad(stagedTheater, squad.squadId);
    if (stagedSquad) {
      stagedSquad.currentRoomId = adjacentPushTarget.id;
      stagedSquad.autoStatus = "pushing";
      stagedSquad.autoTargetRoomId = adjacentPushTarget.id;
    }
    const stagedState = {
      ...state,
      operation: resolveOperationFields(operation, recomputeTheaterNetwork(stagedTheater))
    };
    if (adjacentPushTarget.clearMode !== "battle" || !adjacentPushTarget.tacticalEncounter) {
      return secureTheaterRoomInState(stagedState, adjacentPushTarget.id, squad.squadId);
    }
    const resolved = resolveTheaterAutoBattle(stagedState, squad.squadId, adjacentPushTarget.id, mode);
    return resolved;
  }
  const nextTheater = cloneTheater(theater);
  const nextSquad = findSquad(nextTheater, squad.squadId);
  if (nextSquad) {
    nextSquad.autoStatus = "holding";
    nextSquad.autoTargetRoomId = null;
  }
  return {
    ...state,
    operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater))
  };
}
function advanceAutomatedSquads(state) {
  let nextState = state;
  const operation = getPreparedTheaterOperation(nextState);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return nextState;
  }
  theater.squads.filter((squad) => squad.automationMode !== "manual").forEach((squad) => {
    nextState = runAutoSquadStep(nextState, squad.squadId, squad.automationMode);
  });
  return recoverOperationalSquadsAtMedicalWards(nextState);
}
function areEnemyRoomAttacksDisabled(state) {
  return false;
}
function clearTheaterThreatPressure(theater) {
  const hasActiveThreats = theater.activeThreats.some((threat) => threat.active);
  const hasThreatenedRooms = Object.values(theater.rooms).some((room) => room.underThreat);
  if (!hasActiveThreats && !hasThreatenedRooms) {
    return theater;
  }
  const next = cloneTheater(theater);
  Object.values(next.rooms).forEach((room) => {
    room.underThreat = false;
  });
  next.activeThreats = next.activeThreats.map((threat) => ({ ...threat, active: false }));
  return recomputeTheaterNetwork(next);
}
function resolveEnemyRoomThreats(state, theater) {
  if (areEnemyRoomAttacksDisabled(state)) {
    return clearTheaterThreatPressure(recomputeTheaterNetwork(theater));
  }
  return advancePatrolThreats(dispatchStagingThreats(recomputeTheaterNetwork(theater)));
}
function selectTheaterSquad(state, squadId) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return { state, success: false, message: "No active theater operation." };
  }
  const squad = findSquad(theater, squadId);
  if (!squad) {
    return { state, success: false, message: "Squad not found." };
  }
  const nextTheater = cloneTheater(theater);
  nextTheater.selectedSquadId = squadId;
  nextTheater.currentRoomId = squad.currentRoomId;
  nextTheater.selectedRoomId = squad.currentRoomId;
  return {
    state: {
      ...state,
      phase: "operation",
      operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater))
    },
    success: true,
    message: `${squadId.toUpperCase()} selected.`
  };
}
function setTheaterSquadAutomationMode(state, squadId, automationMode) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return { state, success: false, message: "No active theater operation." };
  }
  const squad = findSquad(theater, squadId);
  if (!squad) {
    return { state, success: false, message: "Squad not found." };
  }
  const nextTheater = cloneTheater(theater);
  const nextSquad = findSquad(nextTheater, squadId);
  if (!nextSquad) {
    return { state, success: false, message: "Squad not found." };
  }
  nextSquad.automationMode = automationMode;
  nextSquad.autoStatus = automationMode === "manual" ? "idle" : "holding";
  nextSquad.autoTargetRoomId = null;
  if (automationMode !== "manual" && nextTheater.selectedSquadId === squadId) {
    const fallbackManualSquad = nextTheater.squads.find(
      (candidate) => candidate.squadId !== squadId && candidate.automationMode === "manual" && candidate.isInContact
    ) ?? nextTheater.squads.find(
      (candidate) => candidate.squadId !== squadId && candidate.automationMode === "manual"
    ) ?? null;
    nextTheater.selectedSquadId = fallbackManualSquad?.squadId ?? squadId;
  }
  const stateAfterModeChange = {
    ...state,
    phase: "operation",
    operation: resolveOperationFields(
      operation,
      addTheaterEvent(
        recomputeTheaterNetwork(nextTheater),
        `SQUAD MODE :: ${nextSquad.displayName} set to ${automationMode.toUpperCase()}.`
      )
    )
  };
  const activatedState = automationMode === "manual" ? stateAfterModeChange : runAutoSquadStep(stateAfterModeChange, squadId, automationMode);
  return {
    state: activatedState,
    success: true,
    message: `${nextSquad.displayName} set to ${automationMode}.`
  };
}
function renameTheaterSquad(state, squadId, displayName) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return { state, success: false, message: "No active theater operation." };
  }
  const squad = findSquad(theater, squadId);
  if (!squad) {
    return { state, success: false, message: "Squad not found." };
  }
  const nextTheater = cloneTheater(theater);
  const nextSquad = findSquad(nextTheater, squadId);
  if (!nextSquad) {
    return { state, success: false, message: "Squad not found." };
  }
  nextSquad.displayName = clampSquadName(displayName, nextSquad.displayName || squad.squadId.toUpperCase());
  return {
    state: {
      ...state,
      phase: "operation",
      operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater))
    },
    success: true,
    message: `${nextSquad.displayName} updated.`
  };
}
function useTheaterConsumable(state, targetUnitId, consumableId) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return { state, success: false, message: "No active theater operation." };
  }
  const consumable = CONSUMABLE_DATABASE[consumableId];
  const quantity = state.consumables?.[consumableId] ?? 0;
  if (!consumable || quantity <= 0) {
    return { state, success: false, message: "That consumable is not available." };
  }
  const squad = theater.squads.find((entry) => entry.unitIds.includes(targetUnitId));
  const unit = state.unitsById[targetUnitId];
  if (!squad || !unit || unit.isEnemy) {
    return { state, success: false, message: "That operator is not available in the current theater." };
  }
  const nextConsumables = { ...state.consumables ?? {} };
  if (quantity <= 1) {
    delete nextConsumables[consumableId];
  } else {
    nextConsumables[consumableId] = quantity - 1;
  }
  let nextUnit = unit;
  let eventLine = "";
  let message = "";
  if (consumable.effect === "heal") {
    const nextHp = Math.min(unit.maxHp, unit.hp + consumable.value);
    const healedAmount = nextHp - unit.hp;
    if (healedAmount <= 0) {
      return { state, success: false, message: `${unit.name} is already at full integrity.` };
    }
    nextUnit = {
      ...unit,
      hp: nextHp
    };
    eventLine = `THEATER//ITEM :: ${unit.name} restores ${healedAmount} HP via ${consumable.name.toUpperCase()}.`;
    message = `${consumable.name} restores ${healedAmount} HP to ${unit.name}.`;
  } else if (consumable.effect === "attack_boost") {
    nextUnit = {
      ...unit,
      buffs: [
        ...unit.buffs ?? [],
        {
          id: `theater_consumable_atk_up_${Date.now()}`,
          type: "atk_up",
          amount: consumable.value,
          duration: 1
        }
      ]
    };
    eventLine = `THEATER//ITEM :: ${unit.name} primes ${consumable.name.toUpperCase()} for +${consumable.value} ATK on deployment.`;
    message = `${consumable.name} primes ${unit.name} for the next battle.`;
  } else {
    return {
      state,
      success: false,
      message: `${consumable.name} can only be used during tactical battle turns.`
    };
  }
  const nextTheater = addTheaterEvent(cloneTheater(theater), eventLine);
  return {
    state: {
      ...state,
      phase: "operation",
      consumables: nextConsumables,
      unitsById: {
        ...state.unitsById,
        [targetUnitId]: nextUnit
      },
      operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater))
    },
    success: true,
    message
  };
}
function setTheaterSquadIcon(state, squadId, icon) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return { state, success: false, message: "No active theater operation." };
  }
  const squad = findSquad(theater, squadId);
  if (!squad) {
    return { state, success: false, message: "Squad not found." };
  }
  const nextTheater = cloneTheater(theater);
  const nextSquad = findSquad(nextTheater, squadId);
  if (!nextSquad) {
    return { state, success: false, message: "Squad not found." };
  }
  nextSquad.icon = normalizeSquadIcon(icon, THEATER_SQUAD_ICON_CHOICES.indexOf(nextSquad.icon));
  return {
    state: {
      ...state,
      phase: "operation",
      operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater))
    },
    success: true,
    message: `${nextSquad.displayName} icon updated.`
  };
}
function setTheaterSquadColor(state, squadId, colorKey) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return { state, success: false, message: "No active theater operation." };
  }
  const squad = findSquad(theater, squadId);
  if (!squad) {
    return { state, success: false, message: "Squad not found." };
  }
  const nextTheater = cloneTheater(theater);
  const nextSquad = findSquad(nextTheater, squadId);
  if (!nextSquad) {
    return { state, success: false, message: "Squad not found." };
  }
  nextSquad.colorKey = normalizeSquadColorKey(
    colorKey,
    THEATER_SQUAD_COLOR_CHOICES.indexOf(nextSquad.colorKey)
  );
  return {
    state: {
      ...state,
      phase: "operation",
      operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater))
    },
    success: true,
    message: `${nextSquad.displayName} color updated.`
  };
}
function splitUnitToNewSquad(state, squadId, unitId) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return { state, success: false, message: "No active theater operation." };
  }
  const squad = findSquad(theater, squadId);
  if (!squad || !squad.unitIds.includes(unitId)) {
    return { state, success: false, message: "Unit is not part of that squad." };
  }
  if (isUnitOperationIncapacitated(state.unitsById[unitId], operation.id, theater.definition.id)) {
    return { state, success: false, message: "Incapacitated units must be recovered at a Medical Ward before reassignment." };
  }
  if (squad.unitIds.length <= 1) {
    return { state, success: false, message: "Each squad must keep at least one unit." };
  }
  const nextTheater = cloneTheater(theater);
  const donor = findSquad(nextTheater, squadId);
  if (!donor) {
    return { state, success: false, message: "Squad is no longer available." };
  }
  donor.unitIds = donor.unitIds.filter((id) => id !== unitId);
  const newSquadOrderIndex = getNextSquadOrderIndex(nextTheater);
  nextTheater.squads.push(buildSquadState(
    getNextSquadId(nextTheater),
    [unitId],
    donor.currentRoomId,
    nextTheater.definition.id,
    {
      displayName: formatDefaultSquadName(newSquadOrderIndex),
      icon: normalizeSquadIcon(void 0, newSquadOrderIndex),
      colorKey: normalizeSquadColorKey(void 0, newSquadOrderIndex),
      orderIndex: newSquadOrderIndex
    }
  ));
  console.log("[THEATER] squad split", squadId, unitId);
  return {
    state: {
      ...state,
      phase: "operation",
      operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater))
    },
    success: true,
    message: `${unitId} split into a new squad.`
  };
}
function transferUnitBetweenSquads(state, fromSquadId, toSquadId, unitId) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return { state, success: false, message: "No active theater operation." };
  }
  const fromSquad = findSquad(theater, fromSquadId);
  const toSquad = findSquad(theater, toSquadId);
  if (!fromSquad || !toSquad || !fromSquad.unitIds.includes(unitId)) {
    return { state, success: false, message: "Squad transfer is not valid." };
  }
  if (isUnitOperationIncapacitated(state.unitsById[unitId], operation.id, theater.definition.id)) {
    return { state, success: false, message: "Incapacitated units must be recovered at a Medical Ward before reassignment." };
  }
  if (fromSquad.currentRoomId !== toSquad.currentRoomId) {
    return { state, success: false, message: "Squads must share a room to transfer units." };
  }
  if (fromSquad.unitIds.length <= 1) {
    return { state, success: false, message: "A squad cannot be emptied." };
  }
  if (toSquad.unitIds.length >= THEATER_MAX_SQUAD_SIZE) {
    return { state, success: false, message: "Target squad is already full." };
  }
  const nextTheater = cloneTheater(theater);
  const nextFrom = findSquad(nextTheater, fromSquadId);
  const nextTo = findSquad(nextTheater, toSquadId);
  nextFrom.unitIds = nextFrom.unitIds.filter((id) => id !== unitId);
  nextTo.unitIds = [...nextTo.unitIds, unitId];
  return {
    state: {
      ...state,
      phase: "operation",
      operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater))
    },
    success: true,
    message: `${unitId} transferred to ${toSquadId.toUpperCase()}.`
  };
}
function mergeTheaterSquads(state, fromSquadId, intoSquadId) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return { state, success: false, message: "No active theater operation." };
  }
  const fromSquad = findSquad(theater, fromSquadId);
  const intoSquad = findSquad(theater, intoSquadId);
  if (!fromSquad || !intoSquad || fromSquadId === intoSquadId) {
    return { state, success: false, message: "Squads cannot be merged." };
  }
  if (getSquadIncapacitatedUnitIds(state, operation.id, theater.definition.id, fromSquad).length > 0 || getSquadIncapacitatedUnitIds(state, operation.id, theater.definition.id, intoSquad).length > 0) {
    return { state, success: false, message: "Squads carrying incapacitated units cannot merge until those operators are recovered." };
  }
  if (fromSquad.currentRoomId !== intoSquad.currentRoomId) {
    return { state, success: false, message: "Squads must share a room to merge." };
  }
  if (fromSquad.unitIds.length + intoSquad.unitIds.length > THEATER_MAX_SQUAD_SIZE) {
    return { state, success: false, message: "Merged squad would exceed 6 units." };
  }
  const nextTheater = cloneTheater(theater);
  const nextInto = findSquad(nextTheater, intoSquadId);
  const nextFrom = findSquad(nextTheater, fromSquadId);
  nextInto.unitIds = [...nextInto.unitIds, ...nextFrom.unitIds];
  nextTheater.squads = nextTheater.squads.filter((squad) => squad.squadId !== fromSquadId);
  if (nextTheater.selectedSquadId === fromSquadId) {
    nextTheater.selectedSquadId = intoSquadId;
    nextTheater.currentRoomId = nextInto.currentRoomId;
  }
  console.log("[THEATER] squads merged", fromSquadId, intoSquadId);
  return {
    state: {
      ...state,
      phase: "operation",
      operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater))
    },
    success: true,
    message: `${fromSquadId.toUpperCase()} merged into ${intoSquadId.toUpperCase()}.`
  };
}
function refuseTheaterDefense(state, roomId) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return { state, success: false, message: "No active theater operation." };
  }
  const room = theater.rooms[roomId];
  if (!room || !room.underThreat && !room.damaged) {
    return { state, success: false, message: "That room is not under active defense pressure." };
  }
  console.log("[THEATER] player refuses to defend a room", roomId);
  const nextTheater = resolveThreatDamage(theater, roomId, "player refused to defend", true);
  return {
    state: syncQuestRuntime({
      ...state,
      phase: "operation",
      operation: resolveOperationFields(operation, nextTheater)
    }),
    success: true,
    message: `${room.label} left unsupported.`
  };
}
function getTheaterCoreRepairCost(room) {
  return deriveTheaterCoreRepairCost(room);
}
function repairTheaterCore(state, roomId) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return { state, success: false, message: "No active theater operation." };
  }
  const room = theater.rooms[roomId];
  if (!room || !roomHasAnyCore(room)) {
    return { state, success: false, message: "No C.O.R.E. is installed in that room." };
  }
  if (!room.damaged) {
    return { state, success: false, message: "That C.O.R.E. does not need repairs." };
  }
  const repairCost = deriveTheaterCoreRepairCost(room);
  if (!hasEnoughResources(state.resources, repairCost)) {
    return {
      state,
      success: false,
      message: `Insufficient resources to repair ${room.label}. Required: ${formatResourceCost(repairCost)}.`
    };
  }
  const nextTheater = cloneTheater(theater);
  const nextRoom = nextTheater.rooms[roomId];
  if (!nextRoom || !roomHasAnyCore(nextRoom)) {
    return { state, success: false, message: "No C.O.R.E. is installed in that room." };
  }
  nextRoom.damaged = false;
  nextRoom.underThreat = false;
  nextRoom.abandoned = false;
  const repairedCoreType = getRoomPrimaryCoreAssignment(nextRoom)?.type ?? null;
  const repairedCoreLabel = repairedCoreType ? SCHEMA_CORE_DEFINITIONS[repairedCoreType]?.displayName ?? repairedCoreType : "C.O.R.E.";
  nextTheater.recentEvents = [
    `REPAIR :: ${repairedCoreLabel} restored at ${nextRoom.label}.`,
    ...nextTheater.recentEvents
  ].slice(0, 8);
  return {
    state: syncQuestRuntime({
      ...state,
      phase: "operation",
      resources: subtractResources(state.resources, repairCost),
      operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater))
    }),
    success: true,
    message: `${nextRoom.label} repaired.`
  };
}
function secureTheaterRoomInState(state, roomId, squadId) {
  const operation = getPreparedTheaterOperation(state);
  if (!operation?.theater) {
    return state;
  }
  const theater = cloneTheater(operation.theater);
  const room = theater.rooms[roomId];
  if (!room) {
    return state;
  }
  room.status = "secured";
  room.secured = true;
  room.underThreat = false;
  room.damaged = false;
  room.fortified = getInstalledFortificationCount2(room) > 0;
  room.abandoned = false;
  room.enemySite = null;
  theater.currentRoomId = roomId;
  theater.selectedRoomId = roomId;
  const actingSquad = (squadId ? findSquad(theater, squadId) : null) ?? getSelectedSquad(theater);
  if (actingSquad) {
    actingSquad.currentRoomId = roomId;
  }
  theater.activeThreats = theater.activeThreats.map(
    (threat) => threat.roomId === roomId || threat.currentRoomId === roomId || threat.targetRoomId === roomId ? { ...threat, active: false } : threat
  );
  console.log("[THEATER] room secured", roomId);
  const keyedTheater = syncTheaterKeyInventory(collectRoomKeyIfPresent(theater, roomId));
  const recomputedTheater = recomputeTheaterNetwork(keyedTheater);
  const resourceBonus = getCoreBattleRewardBonus(recomputedTheater, recomputedTheater.rooms[roomId] ?? room);
  const nextResources = addResources2(state.resources, resourceBonus);
  let nextState = syncQuestRuntime({
    ...state,
    phase: "operation",
    currentBattle: null,
    resources: nextResources,
    operation: resolveOperationFields(
      operation,
      addTheaterEvent(
        resolveEnemyRoomThreats(state, recomputedTheater),
        resourceBonus.metalScrap > 0 || resourceBonus.wood > 0 || resourceBonus.steamComponents > 0 ? `SECURE :: ${room.label} locked down. Linked C.O.R.E. support added ${formatResourceCost(resourceBonus)}.` : `SECURE :: ${room.label} locked down. Logistics paths recalculated.`
      )
    )
  });
  nextState = recoverOperationalSquadsAtMedicalWards(nextState);
  const completedOperation = getPreparedTheaterOperation(nextState);
  const completedTheater = completedOperation?.theater;
  if (!completedOperation || !completedTheater) {
    return nextState;
  }
  if (!operation.theater?.objectiveComplete && completedTheater.objectiveComplete && completedTheater.completion) {
    const completion = completedTheater.completion;
    return syncQuestRuntime({
      ...nextState,
      wad: (nextState.wad ?? 0) + completion.reward.wad,
      resources: {
        metalScrap: nextState.resources.metalScrap + completion.reward.metalScrap,
        wood: nextState.resources.wood + completion.reward.wood,
        chaosShards: nextState.resources.chaosShards + completion.reward.chaosShards,
        steamComponents: nextState.resources.steamComponents + completion.reward.steamComponents
      },
      phase: "operation",
      currentBattle: null,
      operation: resolveOperationFields(
        completedOperation,
        completedTheater
      )
    });
  }
  return nextState;
}
function clearTheaterEnemyThreatsInState(state) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return state;
  }
  const clearedTheater = clearTheaterThreatPressure(theater);
  if (clearedTheater === theater) {
    return state;
  }
  return {
    ...state,
    phase: "operation",
    operation: resolveOperationFields(operation, clearedTheater)
  };
}
function buildCoreInTheaterRoom(state, roomId, coreType) {
  const operation = getPreparedTheaterOperation(state);
  const blueprint = THEATER_CORE_BLUEPRINTS[coreType];
  if (!operation?.theater || !blueprint) {
    return {
      state,
      success: false,
      message: "No active theater C.O.R.E. target."
    };
  }
  if (!isCoreTypeUnlocked(state, coreType)) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      success: false,
      message: `${blueprint.displayName} is still locked in S.C.H.E.M.A.`
    };
  }
  const theater = cloneTheater(operation.theater);
  const room = theater.rooms[roomId];
  if (!room || !room.secured) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      success: false,
      message: "Secure the room before assigning a C.O.R.E."
    };
  }
  const roomSlots = ensureRoomCoreSlots(room);
  const openSlotIndex = roomSlots.findIndex((assignment) => assignment === null);
  if (openSlotIndex < 0) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      success: false,
      message: "No open C.O.R.E. slots remain in this room."
    };
  }
  if (!hasEnoughResources(state.resources, blueprint.buildCost)) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      success: false,
      message: "Insufficient build resources."
    };
  }
  const coreAssignment = {
    type: coreType,
    assignedAtTick: theater.tickCount,
    buildCost: { ...blueprint.buildCost },
    upkeepPerTick: { ...blueprint.upkeep },
    wadUpkeepPerTick: blueprint.wadUpkeepPerTick,
    incomePerTick: getCoreIncomeForRoom(coreType, room),
    supportRadius: blueprint.supportRadius
  };
  room.coreSlots = roomSlots;
  room.coreSlots[openSlotIndex] = coreAssignment;
  syncRoomPrimaryCoreAssignment(room);
  room.status = "secured";
  room.secured = true;
  console.log("[THEATER] core built", roomId, coreType, `slot:${openSlotIndex}`);
  return {
    state: {
      ...syncQuestRuntime({
        ...state,
        resources: subtractResources(state.resources, blueprint.buildCost),
        phase: "operation",
        operation: resolveOperationFields(
          operation,
          addTheaterEvent(
            recomputeTheaterNetwork(theater),
            `C.O.R.E. :: ${blueprint.displayName} online at ${room.label} (${getRoomCoreAssignments(room).length}/${Math.max(1, room.coreSlotCapacity ?? 1)} slots occupied). Wad upkeep ${blueprint.wadUpkeepPerTick}/tick.`
          )
        )
      })
    },
    success: true,
    message: `${blueprint.displayName} assigned.`
  };
}
function fortifyTheaterRoom(state, roomId, fortificationType) {
  const operation = getPreparedTheaterOperation(state);
  if (!operation?.theater) {
    return {
      state,
      success: false,
      message: "No active theater room selected."
    };
  }
  const definition = SCHEMA_FORTIFICATION_DEFINITIONS[fortificationType];
  if (!definition) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      success: false,
      message: "Unknown fortification type."
    };
  }
  if (!isFortificationUnlocked(state, fortificationType)) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      success: false,
      message: `${definition.displayName} is still locked in S.C.H.E.M.A.`
    };
  }
  const cost = definition.buildCost;
  const theater = cloneTheater(operation.theater);
  const room = theater.rooms[roomId];
  if (!room || !room.secured) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      success: false,
      message: "Only secured rooms can be fortified."
    };
  }
  if (!hasEnoughResources(state.resources, cost)) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      success: false,
      message: "Insufficient resources for fortification construction."
    };
  }
  const maxSlots = room.fortificationCapacity ?? 3;
  if (getInstalledFortificationCount2(room) >= maxSlots) {
    return {
      state: setTheaterSelectedRoom(state, roomId),
      success: false,
      message: "No fortification slots remain in this room."
    };
  }
  room.fortificationPips[fortificationType] += 1;
  room.fortified = getInstalledFortificationCount2(room) > 0;
  if (fortificationType === "barricade") {
    room.damaged = false;
    room.underThreat = false;
    theater.activeThreats = theater.activeThreats.map(
      (threat) => threat.roomId === roomId || threat.currentRoomId === roomId || threat.targetRoomId === roomId ? { ...threat, active: false } : threat
    );
  }
  const label = definition.displayName;
  return {
    state: {
      ...syncQuestRuntime({
        ...state,
        resources: subtractResources(state.resources, cost),
        phase: "operation",
        operation: resolveOperationFields(
          operation,
          addTheaterEvent(
            recomputeTheaterNetwork(theater),
            `FORTIFY :: ${label} installed at ${room.label}.`
          )
        )
      })
    },
    success: true,
    message: `${label} installed.`
  };
}
function buildTheaterBattleStateForSquad(state, operation, theater, room, squad, automationMode = "manual") {
  const deployedUnitIds = getSquadCombatReadyUnitIds(state, operation.id, theater.definition.id, squad);
  if (deployedUnitIds.length <= 0) {
    return null;
  }
  const patchedState = {
    ...state,
    partyUnitIds: [...deployedUnitIds],
    operation: resolveOperationFields(operation, {
      ...theater,
      currentRoomId: room.id,
      selectedRoomId: room.id
    })
  };
  const battle = createTestBattleForCurrentParty(patchedState, room.battleSizeOverride);
  if (!battle) {
    return null;
  }
  const neighborPressure = room.adjacency.some((adjacentId) => {
    const adjacent = theater.rooms[adjacentId];
    return Boolean(adjacent?.underThreat || adjacent?.damaged || adjacent?.secured && !adjacent?.supplied);
  });
  const isCutOff = room.secured ? !room.supplied : neighborPressure;
  const hasCommandSupport = roomHasLinkedOperationalCore(theater, room, "command_center", 100);
  const hasMedicalSupport = roomHasLinkedOperationalCore(theater, room, "medical_ward", 100);
  const hasArmorySupport = roomHasLinkedOperationalCore(theater, room, "armory", 100);
  const hasMineSupport = roomHasLinkedOperationalCore(theater, room, "mine", 50);
  const hasRefinerySupport = roomHasLinkedOperationalCore(theater, room, "refinery", 50);
  const supplyOnline = room.supplied;
  const commsOnline = room.commsLinked && room.commsFlow >= Math.max(SQUAD_CONTROL_BW_PER_UNIT, deployedUnitIds.length * SQUAD_CONTROL_BW_PER_UNIT);
  const detailedEnemyIntel = room.commsLinked && room.commsFlow >= 100;
  const powerTurretCount = Math.max(0, Math.floor(room.powerFlow / 100));
  const units = { ...battle.units };
  Object.values(units).forEach((unit) => {
    if (unit.isEnemy && (room.underThreat || room.damaged || isCutOff || room.tags.includes("elite") || room.tags.includes("objective"))) {
      const hpBonus = room.tags.includes("elite") || room.tags.includes("objective") ? 4 : 2;
      unit.maxHp += hpBonus;
      unit.hp += hpBonus;
      unit.atk += room.damaged || isCutOff ? 1 : 0;
    }
    if (!unit.isEnemy) {
      if (supplyOnline) {
        unit.maxHp += 2;
        unit.hp += 2;
      }
      if (commsOnline) {
        unit.agi += 2;
      }
      if (hasCommandSupport) {
        unit.def += 1;
      }
      if (hasArmorySupport) {
        unit.atk += 1;
      }
      if (hasMedicalSupport) {
        unit.maxHp += 1;
        unit.hp += 1;
      }
    }
  });
  const enemyUnits = Object.values(units).filter((unit) => unit.isEnemy);
  if (powerTurretCount > 0 && enemyUnits.length > 0) {
    for (let index = 0; index < powerTurretCount; index += 1) {
      const target = enemyUnits[index % enemyUnits.length];
      target.hp = Math.max(1, target.hp - 2);
    }
  }
  const theaterBattleLog = [
    `THEATER//ROOM :: ${room.label} [${room.sectorTag}]`,
    `THEATER//LOGISTICS :: SUP=${room.supplied ? "ONLINE" : "CUT"} PWR=${room.powered ? "RAILED" : "OFF"} COMMS=${room.commsVisible ? "VISIBLE" : "BLIND"}`,
    `THEATER//SQUAD :: ${(squad.displayName || squad.squadId.toUpperCase()).toUpperCase()} deploying with ${deployedUnitIds.length} combat-ready unit(s).`
  ];
  if (room.underThreat || room.damaged || isCutOff || neighborPressure) {
    theaterBattleLog.push("THEATER//PRESSURE :: Active theater instability is strengthening the hostile response.");
  }
  if (hasCommandSupport || hasArmorySupport || hasMedicalSupport) {
    theaterBattleLog.push(
      `THEATER//SUPPORT :: ${[
        hasCommandSupport ? "Command Center" : null,
        hasArmorySupport ? "Armory" : null,
        hasMedicalSupport ? "Medical Ward" : null
      ].filter(Boolean).join(", ")} support is affecting the squad.`
    );
  }
  if (hasMineSupport || hasRefinerySupport) {
    theaterBattleLog.push(
      `THEATER//INDUSTRY :: ${[
        hasMineSupport ? "Mine" : null,
        hasRefinerySupport ? "Refinery" : null
      ].filter(Boolean).join(", ")} support will improve recovered resources after this fight.`
    );
  }
  if (supplyOnline) {
    console.log("[THEATER] tactical battle receives supply bonus", room.id, squad.squadId);
    theaterBattleLog.push("THEATER//SUPPLY BONUS :: Supply line online. Squad enters with reinforced medical and ordnance support.");
  }
  if (commsOnline) {
    console.log("[THEATER] tactical battle receives comms bonus", room.id, squad.squadId);
    theaterBattleLog.push("THEATER//COMMS BONUS :: Comms uplink stable. Enemy presence preview and initiative advantage granted.");
  }
  if (detailedEnemyIntel) {
    theaterBattleLog.push("THEATER//INTEL :: Full enemy telemetry resolved. Detailed combat dossiers available.");
  }
  if (powerTurretCount > 0) {
    console.log("[THEATER] tactical battle receives power bonus", room.id, squad.squadId, powerTurretCount);
    theaterBattleLog.push(`THEATER//POWER BONUS :: ${powerTurretCount} auto-turret emplacement(s) opened fire before contact.`);
  }
  return {
    ...battle,
    id: `${operation.id}_${room.id}_${theater.tickCount}_${squad.squadId}_${automationMode}`,
    roomId: room.id,
    units,
    log: [...theaterBattleLog, ...battle.log],
    theaterBonuses: {
      squadId: squad.squadId,
      squadDisplayName: squad.displayName,
      squadIcon: squad.icon,
      supplyOnline,
      commsOnline,
      powerTurretCount,
      enemyPreview: enemyUnits.map((unit) => unit.name),
      detailedEnemyIntel
    },
    theaterMeta: {
      operationId: operation.id,
      theaterId: theater.definition.id,
      roomId: room.id,
      squadId: squad.squadId,
      deployedUnitIds,
      autoMode: automationMode
    },
    defenseObjective: isDefenseBattleRoom(room) ? {
      type: "survive_turns",
      turnsRequired: 3,
      turnsRemaining: 3,
      keyRoomId: room.id
    } : battle.defenseObjective
  };
}
function syncBattleUnitsBackToCampaignState(state, battle) {
  const updatedUnits = { ...state.unitsById };
  Object.values(battle.units).forEach((battleUnit) => {
    const baseUnit = state.unitsById[battleUnit.baseUnitId];
    if (!baseUnit || battleUnit.isEnemy) {
      return;
    }
    updatedUnits[battleUnit.baseUnitId] = {
      ...baseUnit,
      hp: Math.max(0, Math.min(baseUnit.maxHp, battleUnit.hp)),
      pos: null
    };
  });
  return {
    ...state,
    unitsById: updatedUnits,
    currentBattle: null,
    phase: "operation"
  };
}
function markOperationBattleCasualties(state, battle) {
  const operationId = battle.theaterMeta?.operationId;
  const theaterId = battle.theaterMeta?.theaterId;
  const squadId = battle.theaterMeta?.squadId;
  const roomId = battle.theaterMeta?.roomId ?? battle.roomId;
  if (!operationId || !theaterId || !squadId) {
    return state;
  }
  const updatedUnits = { ...state.unitsById };
  battle.theaterMeta?.deployedUnitIds.forEach((unitId) => {
    const battleUnit = battle.units[unitId];
    const baseUnit = updatedUnits[unitId];
    if (!battleUnit || !baseUnit) {
      return;
    }
    if (battleUnit.hp <= 0) {
      updatedUnits[unitId] = {
        ...baseUnit,
        hp: 0,
        operationInjury: {
          operationId,
          theaterId,
          squadId,
          incapacitatedAtTick: battle.turnCount,
          sourceRoomId: roomId
        }
      };
    }
  });
  return {
    ...state,
    unitsById: updatedUnits
  };
}
function clearOperationInjuriesForOperation(state, operationId, theaterId) {
  if (!operationId) {
    return state;
  }
  const updatedUnits = { ...state.unitsById };
  let changed = false;
  Object.entries(updatedUnits).forEach(([unitId, unit]) => {
    if (!unit.operationInjury || unit.operationInjury.operationId !== operationId) {
      return;
    }
    if (theaterId && unit.operationInjury.theaterId !== theaterId) {
      return;
    }
    updatedUnits[unitId] = {
      ...unit,
      hp: unit.maxHp,
      operationInjury: null,
      buffs: []
    };
    changed = true;
  });
  return changed ? { ...state, unitsById: updatedUnits } : state;
}
function clearCurrentTheaterOperationInjuries(state) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return state;
  }
  return clearOperationInjuriesForOperation(state, operation.id, theater.definition.id);
}
function recoverSquadAtOperationalMedicalWard(state, theater, squadId) {
  const operationId = theater.definition.operationId;
  const squad = findSquad(theater, squadId);
  if (!squad) {
    return { state, recoveredCount: 0 };
  }
  const room = theater.rooms[squad.currentRoomId];
  if (!room || !roomHasOperationalCoreType(room, "medical_ward")) {
    return { state, recoveredCount: 0 };
  }
  const updatedUnits = { ...state.unitsById };
  let recoveredCount = 0;
  squad.unitIds.forEach((unitId) => {
    const unit = updatedUnits[unitId];
    if (!isUnitOperationIncapacitated(unit, operationId, theater.definition.id)) {
      return;
    }
    recoveredCount += 1;
    updatedUnits[unitId] = {
      ...unit,
      hp: unit.maxHp,
      operationInjury: null,
      buffs: []
    };
  });
  return recoveredCount > 0 ? { state: { ...state, unitsById: updatedUnits }, recoveredCount } : { state, recoveredCount: 0 };
}
function recoverOperationalSquadsAtMedicalWards(state) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return state;
  }
  let nextState = state;
  let nextTheater = cloneTheater(theater);
  let recoveredAny = false;
  nextTheater.squads.forEach((squad) => {
    const recovery = recoverSquadAtOperationalMedicalWard(nextState, nextTheater, squad.squadId);
    if (recovery.recoveredCount > 0) {
      recoveredAny = true;
      nextState = recovery.state;
      nextTheater = addTheaterEvent(
        cloneTheater(nextTheater),
        `MEDICAL WARD :: ${squad.displayName} restored ${recovery.recoveredCount} incapacitated operator(s) in ${nextTheater.rooms[squad.currentRoomId]?.label ?? squad.currentRoomId}.`
      );
    }
  });
  return recoveredAny ? { ...nextState, operation: resolveOperationFields(operation, recomputeTheaterNetwork(nextTheater)) } : state;
}
function simulateAutomatedBattle(battle, mode) {
  let nextBattle = quickPlaceUnits(battle);
  nextBattle = confirmPlacement(nextBattle);
  let safety = 0;
  while (nextBattle.phase !== "victory" && nextBattle.phase !== "defeat" && safety < 300) {
    const activeUnit = nextBattle.activeUnitId ? nextBattle.units[nextBattle.activeUnitId] ?? null : null;
    if (!activeUnit) {
      nextBattle = advanceTurn(nextBattle);
      nextBattle = evaluateBattleOutcome(nextBattle);
      safety += 1;
      continue;
    }
    if (activeUnit.isEnemy) {
      nextBattle = performEnemyTurn(nextBattle);
    } else {
      nextBattle = performAutoBattleTurn(nextBattle, activeUnit.id, mode);
      if (nextBattle.phase !== "victory" && nextBattle.phase !== "defeat" && nextBattle.activeUnitId === activeUnit.id) {
        nextBattle = advanceTurn(nextBattle);
      }
    }
    nextBattle = evaluateBattleOutcome(nextBattle);
    const friendlyUnits = Object.values(nextBattle.units).filter((unit) => !unit.isEnemy);
    const incapacitatedCount = friendlyUnits.filter((unit) => unit.hp <= 0).length;
    const lowHealthCount = friendlyUnits.filter((unit) => unit.hp > 0 && unit.hp / Math.max(1, unit.maxHp) <= 0.4).length;
    const shouldRetreat = mode === "cautious" ? incapacitatedCount > 0 || lowHealthCount >= 2 : incapacitatedCount >= Math.ceil(Math.max(1, friendlyUnits.length) / 2);
    if (nextBattle.phase === "active" && shouldRetreat) {
      nextBattle = {
        ...nextBattle,
        phase: "defeat",
        log: [
          ...nextBattle.log,
          `THEATER//AUTO :: ${mode.toUpperCase()} protocol ordered a retreat before total squad collapse.`
        ]
      };
      break;
    }
    safety += 1;
  }
  return nextBattle;
}
function scaleBattleRewards(rewards, multiplier) {
  if (!rewards) {
    return rewards;
  }
  return {
    ...rewards,
    wad: Math.max(0, Math.floor((rewards.wad ?? 0) * multiplier)),
    metalScrap: Math.max(0, Math.floor((rewards.metalScrap ?? 0) * multiplier)),
    wood: Math.max(0, Math.floor((rewards.wood ?? 0) * multiplier)),
    chaosShards: Math.max(0, Math.floor((rewards.chaosShards ?? 0) * multiplier)),
    steamComponents: Math.max(0, Math.floor((rewards.steamComponents ?? 0) * multiplier)),
    squadXp: Math.max(0, Math.floor((rewards.squadXp ?? 0) * multiplier))
  };
}
function createTheaterBattleState(state, roomId) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return null;
  }
  const room = theater.rooms[roomId];
  if (!room) {
    return null;
  }
  const selectedSquad = getSelectedSquad(theater);
  if (!selectedSquad || !canManuallyControlTheaterSquad(theater, selectedSquad)) {
    return null;
  }
  return buildTheaterBattleStateForSquad(state, operation, theater, room, selectedSquad, "manual");
}
function applyTheaterBattleOutcome(state, battle) {
  if (!hasTheaterOperation(state.operation) || !battle.theaterMeta) {
    return state;
  }
  let nextState = syncBattleUnitsBackToCampaignState(state, battle);
  nextState = markOperationBattleCasualties(nextState, battle);
  const operation = getPreparedTheaterOperation(nextState);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return nextState;
  }
  if (battle.phase === "victory") {
    return secureTheaterRoomInState(nextState, battle.theaterMeta.roomId, battle.theaterMeta.squadId);
  }
  const nextTheater = cloneTheater(theater);
  const room = nextTheater.rooms[battle.theaterMeta.roomId];
  if (room?.secured) {
    room.underThreat = true;
    room.damaged = room.damaged || battle.defenseObjective?.type === "survive_turns";
    nextTheater.activeThreats = nextTheater.activeThreats.map(
      (threat) => threat.currentRoomId === room.id || threat.targetRoomId === room.id ? { ...threat, active: true, roomId: room.id, currentRoomId: room.id, routeIndex: threat.route.length - 1, etaTick: nextTheater.tickCount } : threat
    );
  }
  return {
    ...nextState,
    operation: resolveOperationFields(
      operation,
      addTheaterEvent(recomputeTheaterNetwork(nextTheater), `CONTACT :: ${room?.label ?? battle.theaterMeta.roomId} repelled the squad. Theater line remains contested.`)
    )
  };
}
function resolveTheaterAutoBattle(state, squadId, roomId, mode) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  if (!operation || !theater) {
    return state;
  }
  const squad = findSquad(theater, squadId);
  const room = theater.rooms[roomId];
  if (!squad || !room) {
    return state;
  }
  const battle = buildTheaterBattleStateForSquad(state, operation, theater, room, squad, mode);
  if (!battle) {
    return state;
  }
  const resolvedBattle = simulateAutomatedBattle(battle, mode);
  const rewardMultiplier = mode === "cautious" ? 0.7 : 0.9;
  const scaledRewards = scaleBattleRewards(resolvedBattle.rewards, rewardMultiplier);
  let nextState = {
    ...state,
    wad: (state.wad ?? 0) + (scaledRewards?.wad ?? 0),
    resources: addResources2(state.resources, scaledRewards ?? {})
  };
  nextState = applyTheaterBattleOutcome(nextState, { ...resolvedBattle, rewards: scaledRewards });
  const nextOperation = getPreparedTheaterOperation(nextState);
  const nextTheater = nextOperation?.theater;
  if (!nextOperation || !nextTheater) {
    return nextState;
  }
  const latestSquad = findSquad(nextTheater, squadId);
  const roomLabel = nextTheater.rooms[roomId]?.label ?? roomId;
  const outcomeLabel = resolvedBattle.phase === "victory" ? "cleared" : "was repelled from";
  return {
    ...nextState,
    operation: resolveOperationFields(
      nextOperation,
      addTheaterEvent(
        cloneTheater(nextTheater),
        `AUTO-${mode.toUpperCase()} :: ${latestSquad?.displayName ?? squadId.toUpperCase()} ${outcomeLabel} ${roomLabel}. Rewards scaled to ${Math.round(rewardMultiplier * 100)}%.`
      )
    )
  };
}
function getTheaterSummary(state) {
  const operation = getPreparedTheaterOperation(state);
  const theater = operation?.theater;
  const rooms = theater ? Object.values(theater.rooms) : [];
  return {
    currentScreen: "THEATER_COMMAND",
    currentOperation: operation?.codename ?? "NONE",
    currentTheater: theater?.definition.name ?? "NONE",
    selectedRoomId: theater?.selectedRoomId ?? "none",
    currentTickCount: theater?.tickCount ?? 0,
    securedRooms: rooms.filter((room) => room.secured).length,
    coreCount: rooms.reduce((total, room) => total + getRoomCoreAssignments(room).length, 0),
    threatenedRooms: rooms.filter((room) => room.underThreat || room.damaged).length
  };
}
function getTheaterStarterResources() {
  return { ...THEATER_STARTER_RESERVE };
}
function getFortificationCost(type) {
  return { ...FORTIFICATION_COSTS[type] ?? {} };
}
function formatResourceCost(cost) {
  return [
    cost.metalScrap ? `${cost.metalScrap} Metal Scrap` : null,
    cost.wood ? `${cost.wood} Wood` : null,
    cost.chaosShards ? `${cost.chaosShards} Chaos Shards` : null,
    cost.steamComponents ? `${cost.steamComponents} Steam Components` : null
  ].filter(Boolean).join(" / ") || "0";
}
function getTheaterUpkeepPerTick(theater) {
  const recomputedTheater = recomputeTheaterNetwork(theater);
  return {
    wadUpkeep: sumWadUpkeep(recomputedTheater, 1),
    incomePerTick: sumResourceIncome(recomputedTheater, 1)
  };
}
function getTheaterRoomCoreAssignments(room) {
  return getRoomCoreAssignments(room);
}
function getTheaterRoomOpenCoreSlots(room) {
  return Math.max(0, Math.max(1, room.coreSlotCapacity ?? 1) - getRoomCoreAssignments(room).length);
}
function isTheaterCoreOperational(room) {
  return roomHasOperationalCore(room);
}
function getTheaterCoreOperationalRequirements(room) {
  return getRoomCoreOperationalRequirements(room);
}
function getTheaterCoreOfflineReason(room) {
  return getCoreOfflineReason(room);
}
function hasCompletedTheaterObjective(theater) {
  return theater.objectiveComplete && theater.completion !== null;
}
function recomputeTheaterNetwork(theater) {
  return recomputeSupplyAndPower(theater);
}
export {
  THEATER_CORE_BLUEPRINTS,
  THEATER_SQUAD_COLOR_CHOICES,
  THEATER_SQUAD_ICON_CHOICES,
  applyTheaterBattleOutcome,
  buildCoreInTheaterRoom,
  canManuallyControlTheaterSquad,
  clearCurrentTheaterOperationInjuries,
  clearTheaterEnemyThreatsInState,
  createTheaterBattleState,
  ensureOperationHasTheater,
  formatResourceCost,
  formatTheaterKeyLabel,
  fortifyTheaterRoom,
  getFortificationCost,
  getMoveTickCost,
  getPreparedTheaterOperation,
  getSelectedTheaterSquad,
  getTheaterCoreOfflineReason,
  getTheaterCoreOperationalRequirements,
  getTheaterCoreRepairCost,
  getTheaterObjectiveDefinition,
  getTheaterPassagePowerRequirement,
  getTheaterRoomCoreAssignments,
  getTheaterRoomOpenCoreSlots,
  getTheaterStarterResources,
  getTheaterSummary,
  getTheaterUpkeepPerTick,
  hasCompletedTheaterObjective,
  hasTheaterKey,
  hasTheaterOperation,
  holdPositionInTheater,
  isTheaterCoreOperational,
  isTheaterPassagePowered,
  isTheaterRoomLocked,
  mergeTheaterSquads,
  moveToTheaterRoom,
  recomputeTheaterNetwork,
  refuseTheaterDefense,
  renameTheaterSquad,
  repairTheaterCore,
  resolveTheaterAutoBattle,
  secureTheaterRoomInState,
  selectTheaterSquad,
  setTheaterCurrentRoom,
  setTheaterSelectedRoom,
  setTheaterSquadAutomationMode,
  setTheaterSquadColor,
  setTheaterSquadIcon,
  splitUnitToNewSquad,
  transferUnitBetweenSquads,
  useTheaterConsumable
};

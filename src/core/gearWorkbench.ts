// ============================================================================
// CHAOS CORE - GEAR WORKBENCH SYSTEM (Headline 11da)
// Card slotting, library management, and deck compilation
// ============================================================================

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export type CardRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type CardCategory = "attack" | "defense" | "utility" | "mobility" | "buff" | "debuff" | "steam" | "chaos";

export interface LibraryCard {
  id: string;
  name: string;
  rarity: CardRarity;
  category: CardCategory;
  description: string;
  strainCost: number;
}

export interface CardLibrary {
  [cardId: string]: number; // Card ID -> count owned (cosmetic, cards are unlimited use)
}

export interface GearSlotData {
  lockedCards: string[];    // Permanent cards that come with gear
  freeSlots: number;        // Number of customizable slots
  slottedCards: string[];   // Player-chosen cards
}

export interface PAKFile {
  id: string;
  name: string;
  type: "CORE" | "STEAM" | "VOID" | "TECH" | "BOSS";
  description: string;
  cardCount: number;        // 3-5 cards typically
  rarityWeights: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
  };
}

// ----------------------------------------------------------------------------
// CARD LIBRARY DATABASE - All cards available in the game
// ----------------------------------------------------------------------------

export const LIBRARY_CARD_DATABASE: Record<string, LibraryCard> = {
  // ==================== CORE CARDS ====================
  card_strike: {
    id: "card_strike",
    name: "Strike",
    rarity: "common",
    category: "attack",
    description: "Deal 3 damage to adjacent enemy.",
    strainCost: 1,
  },
  card_guard: {
    id: "card_guard",
    name: "Guard",
    rarity: "common",
    category: "defense",
    description: "Gain +2 DEF until next turn.",
    strainCost: 0,
  },
  card_move_plus: {
    id: "card_move_plus",
    name: "Move+",
    rarity: "common",
    category: "mobility",
    description: "Move 2 extra tiles this turn.",
    strainCost: 1,
  },
  card_focus: {
    id: "card_focus",
    name: "Focus",
    rarity: "common",
    category: "buff",
    description: "Next attack gains +2 ACC.",
    strainCost: 1,
  },
  
  // ==================== ATTACK CARDS ====================
  card_power_strike: {
    id: "card_power_strike",
    name: "Power Strike",
    rarity: "uncommon",
    category: "attack",
    description: "Deal 5 damage. High strain cost.",
    strainCost: 2,
  },
  card_cleave: {
    id: "card_cleave",
    name: "Cleave",
    rarity: "uncommon",
    category: "attack",
    description: "Deal 3 damage to up to 3 adjacent enemies.",
    strainCost: 2,
  },
  card_lunge: {
    id: "card_lunge",
    name: "Lunge",
    rarity: "uncommon",
    category: "attack",
    description: "Move 2 tiles and attack. Deal 4 damage.",
    strainCost: 2,
  },
  card_piercing_shot: {
    id: "card_piercing_shot",
    name: "Piercing Shot",
    rarity: "uncommon",
    category: "attack",
    description: "Ranged attack that ignores 2 DEF.",
    strainCost: 2,
  },
  card_execute: {
    id: "card_execute",
    name: "Execute",
    rarity: "rare",
    category: "attack",
    description: "Deal 8 damage to enemies below 30% HP.",
    strainCost: 3,
  },
  card_whirlwind: {
    id: "card_whirlwind",
    name: "Whirlwind",
    rarity: "rare",
    category: "attack",
    description: "Deal 4 damage to ALL adjacent enemies.",
    strainCost: 3,
  },
  
  // ==================== DEFENSE CARDS ====================
  card_brace: {
    id: "card_brace",
    name: "Brace",
    rarity: "common",
    category: "defense",
    description: "Reduce next incoming damage by 3.",
    strainCost: 1,
  },
  card_parry: {
    id: "card_parry",
    name: "Parry",
    rarity: "uncommon",
    category: "defense",
    description: "If attacked, counter for 2 damage.",
    strainCost: 1,
  },
  card_shield_wall: {
    id: "card_shield_wall",
    name: "Shield Wall",
    rarity: "uncommon",
    category: "defense",
    description: "All allies gain +1 DEF for 2 turns.",
    strainCost: 2,
  },
  card_fortress: {
    id: "card_fortress",
    name: "Fortress",
    rarity: "rare",
    category: "defense",
    description: "Gain +4 DEF but cannot move next turn.",
    strainCost: 2,
  },
  
  // ==================== MOBILITY CARDS ====================
  card_dash: {
    id: "card_dash",
    name: "Dash",
    rarity: "common",
    category: "mobility",
    description: "Move up to 3 tiles ignoring terrain.",
    strainCost: 1,
  },
  card_retreat: {
    id: "card_retreat",
    name: "Retreat",
    rarity: "common",
    category: "mobility",
    description: "Move 2 tiles away from nearest enemy.",
    strainCost: 1,
  },
  card_shadow_step: {
    id: "card_shadow_step",
    name: "Shadow Step",
    rarity: "rare",
    category: "mobility",
    description: "Teleport behind target enemy.",
    strainCost: 2,
  },
  
  // ==================== BUFF CARDS ====================
  card_rally: {
    id: "card_rally",
    name: "Rally",
    rarity: "uncommon",
    category: "buff",
    description: "All allies gain +1 ATK for 2 turns.",
    strainCost: 2,
  },
  card_inspire: {
    id: "card_inspire",
    name: "Inspire",
    rarity: "uncommon",
    category: "buff",
    description: "Target ally reduces strain by 2.",
    strainCost: 1,
  },
  card_overclock: {
    id: "card_overclock",
    name: "Overclock",
    rarity: "rare",
    category: "buff",
    description: "Gain +3 ATK but take 2 damage.",
    strainCost: 2,
  },
  
  // ==================== DEBUFF CARDS ====================
  card_weaken: {
    id: "card_weaken",
    name: "Weaken",
    rarity: "common",
    category: "debuff",
    description: "Target enemy has -2 ATK for 1 turn.",
    strainCost: 1,
  },
  card_slow: {
    id: "card_slow",
    name: "Slow",
    rarity: "common",
    category: "debuff",
    description: "Target enemy has -2 movement for 1 turn.",
    strainCost: 1,
  },
  card_expose: {
    id: "card_expose",
    name: "Expose",
    rarity: "uncommon",
    category: "debuff",
    description: "Target enemy has -2 DEF for 2 turns.",
    strainCost: 1,
  },
  card_terror: {
    id: "card_terror",
    name: "Terror",
    rarity: "rare",
    category: "debuff",
    description: "Target enemy cannot use cards next turn.",
    strainCost: 3,
  },
  
  // ==================== STEAM TECH CARDS ====================
  card_steam_burst: {
    id: "card_steam_burst",
    name: "Steam Burst",
    rarity: "uncommon",
    category: "steam",
    description: "Deal 4 damage. Adds +2 heat to weapon.",
    strainCost: 1,
  },
  card_vent: {
    id: "card_vent",
    name: "Vent",
    rarity: "common",
    category: "steam",
    description: "Remove 3 heat from equipped weapon.",
    strainCost: 0,
  },
  card_pressure_valve: {
    id: "card_pressure_valve",
    name: "Pressure Valve",
    rarity: "uncommon",
    category: "steam",
    description: "Convert 2 heat into +2 damage on next attack.",
    strainCost: 1,
  },
  card_overheat: {
    id: "card_overheat",
    name: "Overheat",
    rarity: "rare",
    category: "steam",
    description: "Deal 6 damage. Weapon gains max heat.",
    strainCost: 2,
  },
  card_thermal_shield: {
    id: "card_thermal_shield",
    name: "Thermal Shield",
    rarity: "rare",
    category: "steam",
    description: "Absorb next attack. Add its damage as heat.",
    strainCost: 2,
  },
  
  // ==================== CHAOS CARDS ====================
  card_chaos_bolt: {
    id: "card_chaos_bolt",
    name: "Chaos Bolt",
    rarity: "uncommon",
    category: "chaos",
    description: "Deal 2-6 random damage to target.",
    strainCost: 1,
  },
  card_entropy: {
    id: "card_entropy",
    name: "Entropy",
    rarity: "rare",
    category: "chaos",
    description: "Shuffle all cards. Draw 3 new cards.",
    strainCost: 2,
  },
  card_void_touch: {
    id: "card_void_touch",
    name: "Void Touch",
    rarity: "rare",
    category: "chaos",
    description: "Deal 3 damage. Heal for damage dealt.",
    strainCost: 2,
  },
  card_reality_tear: {
    id: "card_reality_tear",
    name: "Reality Tear",
    rarity: "epic",
    category: "chaos",
    description: "Swap positions with any unit on the map.",
    strainCost: 3,
  },
  card_chaos_storm: {
    id: "card_chaos_storm",
    name: "Chaos Storm",
    rarity: "epic",
    category: "chaos",
    description: "Deal 3 damage to ALL units (including allies).",
    strainCost: 4,
  },
};

// ----------------------------------------------------------------------------
// PAK FILE DEFINITIONS
// ----------------------------------------------------------------------------

export const PAK_DATABASE: Record<string, PAKFile> = {
  pak_core: {
    id: "pak_core",
    name: "CORE.PAK",
    type: "CORE",
    description: "Standard issue combat protocols. Contains basic attack and defense cards.",
    cardCount: 4,
    rarityWeights: { common: 60, uncommon: 30, rare: 8, epic: 2, legendary: 0 },
  },
  pak_steam: {
    id: "pak_steam",
    name: "STEAM.PAK",
    type: "STEAM",
    description: "Mechanical warfare subroutines. Steam and mobility focused.",
    cardCount: 4,
    rarityWeights: { common: 40, uncommon: 40, rare: 15, epic: 5, legendary: 0 },
  },
  pak_void: {
    id: "pak_void",
    name: "VOID.PAK",
    type: "VOID",
    description: "Corrupted chaos data. Unpredictable but powerful.",
    cardCount: 3,
    rarityWeights: { common: 20, uncommon: 40, rare: 30, epic: 10, legendary: 0 },
  },
  pak_tech: {
    id: "pak_tech",
    name: "TECH.PAK",
    type: "TECH",
    description: "Advanced combat algorithms. Offense and utility mix.",
    cardCount: 4,
    rarityWeights: { common: 30, uncommon: 45, rare: 20, epic: 5, legendary: 0 },
  },
  pak_boss: {
    id: "pak_boss",
    name: "BOSS.PAK",
    type: "BOSS",
    description: "Elite combat data extracted from commanders. Rare cards only.",
    cardCount: 3,
    rarityWeights: { common: 0, uncommon: 20, rare: 50, epic: 25, legendary: 5 },
  },
};

// ----------------------------------------------------------------------------
// GEAR SLOT DEFAULTS - Default slot configurations for equipment types
// ----------------------------------------------------------------------------

export function getDefaultGearSlots(equipmentId: string): GearSlotData {
  // Weapons get more slots, armor gets fewer
  const isWeapon = equipmentId.startsWith("weapon_");
  const isAccessory = equipmentId.startsWith("accessory_");
  
  // Default locked cards based on equipment
  const lockedCards = getEquipmentLockedCards(equipmentId);
  
  return {
    lockedCards,
    freeSlots: isWeapon ? 3 : isAccessory ? 1 : 2,
    slottedCards: [],
  };
}

function getEquipmentLockedCards(equipmentId: string): string[] {
  // Return default locked cards for each equipment type
  const lockedCardMap: Record<string, string[]> = {
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
    accessory_steam_valve_wristguard: ["card_vent"],
  };
  
  return lockedCardMap[equipmentId] ?? [];
}

// ----------------------------------------------------------------------------
// CARD LIBRARY FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Add cards to the player's library
 */
export function addCardsToLibrary(
  library: CardLibrary,
  cardIds: string[]
): CardLibrary {
  const newLibrary = { ...library };
  cardIds.forEach(cardId => {
    newLibrary[cardId] = (newLibrary[cardId] ?? 0) + 1;
  });
  return newLibrary;
}

/**
 * Check if player owns a card
 */
export function hasCard(library: CardLibrary, cardId: string): boolean {
  return (library[cardId] ?? 0) > 0;
}

/**
 * Get all cards in library as array
 */
export function getLibraryCards(library: CardLibrary): LibraryCard[] {
  return Object.keys(library)
    .filter(id => library[id] > 0)
    .map(id => LIBRARY_CARD_DATABASE[id])
    .filter((card): card is LibraryCard => card !== undefined);
}

/**
 * Filter library cards by criteria
 */
export function filterLibraryCards(
  cards: LibraryCard[],
  filters: {
    rarity?: CardRarity;
    category?: CardCategory;
    search?: string;
  }
): LibraryCard[] {
  return cards.filter(card => {
    if (filters.rarity && card.rarity !== filters.rarity) return false;
    if (filters.category && card.category !== filters.category) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (!card.name.toLowerCase().includes(search) && 
          !card.description.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });
}

// ----------------------------------------------------------------------------
// GEAR SLOT FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Slot a card into gear
 */
export function slotCard(
  gearSlots: GearSlotData,
  cardId: string
): GearSlotData | null {
  if (gearSlots.slottedCards.length >= gearSlots.freeSlots) {
    return null; // No free slots
  }
  
  return {
    ...gearSlots,
    slottedCards: [...gearSlots.slottedCards, cardId],
  };
}

/**
 * Remove a card from a slot
 */
export function unslotCard(
  gearSlots: GearSlotData,
  slotIndex: number
): GearSlotData {
  const newSlotted = [...gearSlots.slottedCards];
  newSlotted.splice(slotIndex, 1);
  
  return {
    ...gearSlots,
    slottedCards: newSlotted,
  };
}

/**
 * Get all cards from gear (locked + slotted)
 */
export function getGearCards(gearSlots: GearSlotData): string[] {
  return [...gearSlots.lockedCards, ...gearSlots.slottedCards];
}

// ----------------------------------------------------------------------------
// DECK COMPILATION
// ----------------------------------------------------------------------------

export interface CompiledDeck {
  cards: string[];
  cardCounts: Record<string, number>;
  totalCards: number;
}

/**
 * Compile a unit's deck from all equipped gear
 */
export function compileDeck(
  equippedGearSlots: GearSlotData[]
): CompiledDeck {
  const allCards: string[] = [];
  
  equippedGearSlots.forEach(gear => {
    allCards.push(...gear.lockedCards);
    allCards.push(...gear.slottedCards);
  });
  
  // Count cards
  const cardCounts: Record<string, number> = {};
  allCards.forEach(cardId => {
    cardCounts[cardId] = (cardCounts[cardId] ?? 0) + 1;
  });
  
  return {
    cards: allCards,
    cardCounts,
    totalCards: allCards.length,
  };
}

/**
 * Get deck preview as formatted strings
 */
export function getDeckPreview(compiled: CompiledDeck): string[] {
  return Object.entries(compiled.cardCounts)
    .map(([cardId, count]) => {
      const card = LIBRARY_CARD_DATABASE[cardId];
      const name = card?.name ?? cardId;
      return `${name} ×${count}`;
    })
    .sort();
}

// ----------------------------------------------------------------------------
// PAK FILE FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Open a PAK file and get random cards
 */
export function openPAK(pakId: string): string[] {
  const pak = PAK_DATABASE[pakId];
  if (!pak) return [];
  
  const cards: string[] = [];
  const availableCards = Object.values(LIBRARY_CARD_DATABASE);
  
  for (let i = 0; i < pak.cardCount; i++) {
    // Determine rarity based on weights
    const rarity = rollRarity(pak.rarityWeights);
    
    // Get cards of that rarity
    const rarityCards = availableCards.filter(c => c.rarity === rarity);
    
    // Also filter by PAK type for themed packs
    let filteredCards = rarityCards;
    if (pak.type === "STEAM") {
      filteredCards = rarityCards.filter(c => c.category === "steam" || c.category === "mobility");
    } else if (pak.type === "VOID") {
      filteredCards = rarityCards.filter(c => c.category === "chaos" || c.category === "debuff");
    } else if (pak.type === "TECH") {
      filteredCards = rarityCards.filter(c => c.category === "attack" || c.category === "utility" || c.category === "buff");
    }
    
    // Fallback to all cards of that rarity if filter is too restrictive
    if (filteredCards.length === 0) {
      filteredCards = rarityCards;
    }
    
    // Pick random card
    if (filteredCards.length > 0) {
      const randomIndex = Math.floor(Math.random() * filteredCards.length);
      cards.push(filteredCards[randomIndex].id);
    }
  }
  
  return cards;
}

function rollRarity(weights: PAKFile["rarityWeights"]): CardRarity {
  const total = weights.common + weights.uncommon + weights.rare + weights.epic + weights.legendary;
  let roll = Math.random() * total;
  
  if (roll < weights.common) return "common";
  roll -= weights.common;
  if (roll < weights.uncommon) return "uncommon";
  roll -= weights.uncommon;
  if (roll < weights.rare) return "rare";
  roll -= weights.rare;
  if (roll < weights.epic) return "epic";
  return "legendary";
}

/**
 * Generate battle reward cards
 */
export function generateBattleRewardCards(enemyCount: number): string[] {
  const cards: string[] = [];
  
  // 1 guaranteed common
  const commons = Object.values(LIBRARY_CARD_DATABASE).filter(c => c.rarity === "common");
  if (commons.length > 0) {
    cards.push(commons[Math.floor(Math.random() * commons.length)].id);
  }
  
  // 30% chance for uncommon
  if (Math.random() < 0.3) {
    const uncommons = Object.values(LIBRARY_CARD_DATABASE).filter(c => c.rarity === "uncommon");
    if (uncommons.length > 0) {
      cards.push(uncommons[Math.floor(Math.random() * uncommons.length)].id);
    }
  }
  
  // 10% chance for rare (increased with more enemies)
  if (Math.random() < 0.1 + (enemyCount * 0.02)) {
    const rares = Object.values(LIBRARY_CARD_DATABASE).filter(c => c.rarity === "rare");
    if (rares.length > 0) {
      cards.push(rares[Math.floor(Math.random() * rares.length)].id);
    }
  }
  
  return cards;
}

// ----------------------------------------------------------------------------
// STARTER LIBRARY
// ----------------------------------------------------------------------------

/**
 * Get the starter card library for new games
 */
export function getStarterCardLibrary(): CardLibrary {
  return {
    card_strike: 3,
    card_guard: 2,
    card_move_plus: 2,
    card_focus: 1,
    card_brace: 2,
    card_dash: 1,
    card_weaken: 1,
    card_vent: 1,
  };
}
// ============================================================================
// EQUIPMENT SYSTEM - Core Types and Data
// Headline 11b & 11c: Equipment, Cards, Modules, Deck Building
// ============================================================================


import { GameState } from "./types";
import { getSettings } from "./settings";

// ----------------------------------------------------------------------------
// ENUMS & CONSTANTS
// ----------------------------------------------------------------------------

export type WeaponType =
  | "sword"
  | "greatsword"
  | "shortsword"
  | "bow"
  | "greatbow"
  | "gun"
  | "staff"
  | "greatstaff"
  | "dagger";

export type ArmorSlot = "helmet" | "chestpiece";
export type EquipSlot = "weapon" | "helmet" | "chestpiece" | "accessory1" | "accessory2";

export type UnitClass =
  | "squire"
  | "sentry"
  | "paladin"
  | "watchGuard"
  | "ranger"
  | "hunter"
  | "bowmaster"
  | "trapper"
  | "magician"
  | "cleric"
  | "wizard"
  | "chaosmancer"
  | "thief"
  | "scout"
  | "shadow"
  | "trickster"
  | "academic"
  | "freelancer";

export type EquipmentCardType = "core" | "class" | "equipment" | "gambit";

// ----------------------------------------------------------------------------
// CLASS WEAPON RESTRICTIONS
// ----------------------------------------------------------------------------

export const CLASS_WEAPON_RESTRICTIONS: Record<UnitClass, WeaponType[]> = {
  // Squire tree
  squire: ["sword"],
  sentry: ["sword", "greatsword"],
  paladin: ["sword", "greatsword"],
  watchGuard: ["sword", "bow"],

  // Ranger tree
  ranger: ["bow"],
  hunter: ["bow", "gun"],
  bowmaster: ["bow", "greatbow"],
  trapper: ["bow", "gun"],

  // Magician tree
  magician: ["staff"],
  cleric: ["staff"],
  wizard: ["staff", "greatstaff"],
  chaosmancer: ["staff", "sword"],

  // Thief tree
  thief: ["shortsword"],
  scout: ["bow"],
  shadow: ["shortsword", "bow"],
  trickster: ["sword"],

  // Academic (unique)
  academic: ["bow", "shortsword"],

  // Freelancer (all weapons, but with penalty)
  freelancer: [
    "sword",
    "greatsword",
    "shortsword",
    "bow",
    "greatbow",
    "gun",
    "staff",
    "greatstaff",
    "dagger",
  ],
};

// ----------------------------------------------------------------------------
// EQUIPMENT CARD DEFINITION
// ----------------------------------------------------------------------------

export interface EquipmentCard {
  id: string;
  name: string;
  type: EquipmentCardType;
  strainCost: number;
  description: string;
  range?: string;
  damage?: number;
  effects?: string[];
  sourceEquipmentId?: string;
}

// ----------------------------------------------------------------------------
// MODULE DEFINITION (Weapon upgrades)
// ----------------------------------------------------------------------------

export interface Module {
  id: string;
  name: string;
  description: string;
  cardsGranted: string[];
  statBonus?: {
    atk?: number;
    def?: number;
    agi?: number;
    acc?: number;
    hp?: number;
  };
}

// ----------------------------------------------------------------------------
// EQUIPMENT DEFINITIONS
// ----------------------------------------------------------------------------

export interface EquipmentStats {
  atk: number;
  def: number;
  agi: number;
  acc: number;
  hp: number;
}

export interface WeaponEquipment {
  id: string;
  name: string;
  slot: "weapon";
  weaponType: WeaponType;
  isMechanical: boolean;
  stats: EquipmentStats;
  heatCapacity?: number;
  ammoMax?: number;
  quickReloadStrain?: number;
  fullReloadStrain?: number;
  cardsGranted: string[];
  moduleSlots: number;
  attachedModules: string[];
  clutchToggle?: string;
  doubleClutch?: string;
  wear: number;
}

export interface ArmorEquipment {
  id: string;
  name: string;
  slot: "helmet" | "chestpiece";
  stats: EquipmentStats;
  cardsGranted: string[];
}

export interface AccessoryEquipment {
  id: string;
  name: string;
  slot: "accessory";
  stats: EquipmentStats;
  cardsGranted: string[];
}

export type Equipment = WeaponEquipment | ArmorEquipment | AccessoryEquipment;

// ----------------------------------------------------------------------------
// UNIT EQUIPMENT LOADOUT
// ----------------------------------------------------------------------------

export interface UnitLoadout {
  weapon: string | null;
  helmet: string | null;
  chestpiece: string | null;
  accessory1: string | null;
  accessory2: string | null;
}

// ----------------------------------------------------------------------------
// CORE CARDS (Always available to all units)
// ----------------------------------------------------------------------------

export const CORE_CARDS: EquipmentCard[] = [
  {
    id: "core_move_plus",
    name: "Move+",
    type: "core",
    strainCost: 1,
    description: "Move 2 extra tiles this turn.",
    range: "R(0-0)",
  },
  {
    id: "core_basic_attack",
    name: "Basic Attack",
    type: "core",
    strainCost: 0,
    description: "Standard attack on enemy.",
    range: "R(1-1)",
    damage: 0,
  },
  {
    id: "core_aid",
    name: "Aid",
    type: "core",
    strainCost: 1,
    description: "Restore small amount of HP to ally.",
    range: "R(1-2)",
  },
  {
    id: "core_overwatch",
    name: "Overwatch",
    type: "core",
    strainCost: 1,
    description: "Attack enemy that enters range.",
    range: "R(2-5)",
  },
  {
    id: "core_guard",
    name: "Guard",
    type: "core",
    strainCost: 1,
    description: "Gain +2 DEF until your next turn.",
    range: "R(0-0)",
  },
  {
    id: "core_wait",
    name: "Wait",
    type: "core",
    strainCost: 0,
    description: "End turn without acting. Reduce strain by 1.",
    range: "R(0-0)",
  },
];

// ----------------------------------------------------------------------------
// CLASS CARDS (Per class - placeholder set)
// ----------------------------------------------------------------------------

export const CLASS_CARDS: Record<UnitClass, EquipmentCard[]> = {
  squire: [
    {
      id: "squire_power_slash",
      name: "Power Slash",
      type: "class",
      strainCost: 2,
      description: "Deal heavy melee damage to one enemy.",
      range: "R(1-1)",
      damage: 8,
    },
    {
      id: "squire_shield_wall",
      name: "Shield Wall",
      type: "class",
      strainCost: 3,
      description: "Reduce damage taken by all allies for 1 turn.",
      range: "R(0-0)",
    },
    {
      id: "squire_rally_cry",
      name: "Rally Cry",
      type: "class",
      strainCost: 2,
      description: "Boost ATK of all allies for 2 turns.",
      range: "R(0-0)",
    },
  ],
  sentry: [],
  paladin: [],
  watchGuard: [],
  ranger: [
    {
      id: "ranger_pinning_shot",
      name: "Pinning Shot",
      type: "class",
      strainCost: 2,
      description: "Immobilize an enemy for 1 turn.",
      range: "R(2-5)",
      damage: 3,
    },
    {
      id: "ranger_volley",
      name: "Volley",
      type: "class",
      strainCost: 3,
      description: "Deal light damage to all enemies in range.",
      range: "R(3-6)",
      damage: 2,
    },
    {
      id: "ranger_scouts_mark",
      name: "Scout's Mark",
      type: "class",
      strainCost: 1,
      description: "Reveal all enemies and traps in range.",
      range: "R(0-6)",
    },
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
      damage: 5,
    },
    {
      id: "magician_mana_burst",
      name: "Mana Burst",
      type: "class",
      strainCost: 3,
      description: "Deal heavy AoE magic damage.",
      range: "R(2-4)",
      damage: 4,
    },
    {
      id: "magician_barrier",
      name: "Barrier",
      type: "class",
      strainCost: 2,
      description: "Grant magic shield to an ally.",
      range: "R(1-3)",
    },
  ],
  cleric: [],
  wizard: [],
  chaosmancer: [],
  thief: [
    {
      id: "thief_steal",
      name: "Steal",
      type: "class",
      strainCost: 1,
      description: "Take an item from the target.",
      range: "R(1-1)",
    },
    {
      id: "thief_backstab",
      name: "Backstab",
      type: "class",
      strainCost: 2,
      description: "Deal high damage if behind enemy.",
      range: "R(1-1)",
      damage: 10,
    },
    {
      id: "thief_smoke_bomb",
      name: "Smoke Bomb",
      type: "class",
      strainCost: 2,
      description: "Reduce enemy accuracy for 2 turns.",
      range: "R(0-2)",
    },
  ],
  scout: [],
  shadow: [],
  trickster: [],
  academic: [
    {
      id: "academic_analyze",
      name: "Analyze",
      type: "class",
      strainCost: 1,
      description: "Reveal enemy stats and weaknesses.",
      range: "R(0-6)",
    },
    {
      id: "academic_tactics_shift",
      name: "Tactics Shift",
      type: "class",
      strainCost: 2,
      description: "Reposition an ally instantly.",
      range: "R(1-4)",
    },
    {
      id: "academic_inspire",
      name: "Inspire",
      type: "class",
      strainCost: 2,
      description: "Reduce strain of all allies by 1.",
      range: "R(0-0)",
    },
  ],
  freelancer: [],
};

// ----------------------------------------------------------------------------
// STARTER EQUIPMENT DATA
// ----------------------------------------------------------------------------

export const STARTER_WEAPONS: WeaponEquipment[] = [
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
    wear: 0,
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
    wear: 0,
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
    wear: 0,
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
    wear: 0,
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
    ammoMax: 6,
    quickReloadStrain: 1,
    fullReloadStrain: 0,
    wear: 0,
  },
];

export const STARTER_HELMETS: ArmorEquipment[] = [
  {
    id: "armor_ironguard_helm",
    name: "Ironguard Helm",
    slot: "helmet",
    stats: { atk: 0, def: 2, agi: 0, acc: 0, hp: 1 },
    cardsGranted: ["card_headbutt", "card_shield_sight", "card_shield_headbutt"],
  },
  {
    id: "armor_rangers_hood",
    name: "Ranger's Hood",
    slot: "helmet",
    stats: { atk: 0, def: 0, agi: 2, acc: 1, hp: 0 },
    cardsGranted: ["card_aimed_strike", "card_hunters_mark", "card_hide_in_shadows"],
  },
  {
    id: "armor_mystic_circlet",
    name: "Mystic Circlet",
    slot: "helmet",
    stats: { atk: 1, def: 0, agi: 0, acc: 2, hp: 0 },
    cardsGranted: ["card_mind_spike", "card_spell_focus", "card_mana_barrier"],
  },
];

export const STARTER_CHESTPIECES: ArmorEquipment[] = [
  {
    id: "armor_steelplate_cuirass",
    name: "Steelplate Cuirass",
    slot: "chestpiece",
    stats: { atk: 0, def: 3, agi: -1, acc: 0, hp: 2 },
    cardsGranted: ["card_shoulder_charge", "card_fortify", "card_fortress_form"],
  },
  {
    id: "armor_leather_jerkin",
    name: "Leather Jerkin",
    slot: "chestpiece",
    stats: { atk: 0, def: 1, agi: 1, acc: 0, hp: 0 },
    cardsGranted: ["card_knife_toss", "card_quick_roll", "card_light_guard"],
  },
  {
    id: "armor_mages_robe",
    name: "Mage's Robe",
    slot: "chestpiece",
    stats: { atk: 0, def: 0, agi: 0, acc: 2, hp: 0 },
    cardsGranted: ["card_mana_surge_strike", "card_mana_shift", "card_arcane_veil"],
  },
];

export const STARTER_ACCESSORIES: AccessoryEquipment[] = [
  {
    id: "accessory_steel_signet_ring",
    name: "Steel Signet Ring",
    slot: "accessory",
    stats: { atk: 0, def: 1, agi: 0, acc: 0, hp: 0 },
    cardsGranted: ["card_knuckle_jab", "card_mark_of_command", "card_signet_shield"],
  },
  {
    id: "accessory_eagle_eye_lens",
    name: "Eagle Eye Lens",
    slot: "accessory",
    stats: { atk: 0, def: 0, agi: 0, acc: 2, hp: 0 },
    cardsGranted: ["card_spotters_shot", "card_target_paint", "card_farsight_guard"],
  },
  {
    id: "accessory_fleetfoot_anklet",
    name: "Fleetfoot Anklet",
    slot: "accessory",
    stats: { atk: 0, def: 0, agi: 2, acc: 0, hp: 0 },
    cardsGranted: ["card_flying_kick", "card_speed_burst", "card_swift_guard"],
  },
  {
    id: "accessory_vitality_charm",
    name: "Vitality Charm",
    slot: "accessory",
    stats: { atk: 0, def: 0, agi: 0, acc: 0, hp: 2 },
    cardsGranted: ["card_bulwark_bash", "card_second_wind", "card_life_guard"],
  },
];

// ----------------------------------------------------------------------------
// EQUIPMENT CARDS DATA
// ----------------------------------------------------------------------------

export const EQUIPMENT_CARDS: EquipmentCard[] = [
  // Iron Longsword cards
  {
    id: "card_cleave",
    name: "Cleave",
    type: "equipment",
    strainCost: 2,
    description: "Deal 3 damage to up to 3 adjacent enemies.",
    range: "R(1)",
    damage: 3,
    sourceEquipmentId: "weapon_iron_longsword",
  },
  {
    id: "card_parry_readiness",
    name: "Parry Readiness",
    type: "equipment",
    strainCost: 1,
    description: "If attacked before next turn, cancel 1 attack.",
    range: "R(1)",
    sourceEquipmentId: "weapon_iron_longsword",
  },
  {
    id: "card_guarded_stance",
    name: "Guarded Stance",
    type: "equipment",
    strainCost: 1,
    description: "+2 DEF until your next turn.",
    range: "R(Self)",
    sourceEquipmentId: "weapon_iron_longsword",
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
    sourceEquipmentId: "weapon_elm_recurve_bow",
  },
  {
    id: "card_warning_shot",
    name: "Warning Shot",
    type: "equipment",
    strainCost: 1,
    description: "Target suffers -2 ACC for 1 turn.",
    range: "R(3-6)",
    sourceEquipmentId: "weapon_elm_recurve_bow",
  },
  {
    id: "card_defensive_draw",
    name: "Defensive Draw",
    type: "equipment",
    strainCost: 1,
    description: "+1 DEF and +1 ACC until your next attack.",
    range: "R(Self)",
    sourceEquipmentId: "weapon_elm_recurve_bow",
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
    sourceEquipmentId: "weapon_oak_battlestaff",
  },
  {
    id: "card_deflective_spin",
    name: "Deflective Spin",
    type: "equipment",
    strainCost: 1,
    description: "Block next ranged attack from enemies in arc.",
    range: "R(1)",
    sourceEquipmentId: "weapon_oak_battlestaff",
  },
  {
    id: "card_ward_spin",
    name: "Ward Spin",
    type: "equipment",
    strainCost: 1,
    description: "Block first melee hit until next turn.",
    range: "R(Self)",
    sourceEquipmentId: "weapon_oak_battlestaff",
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
    sourceEquipmentId: "weapon_steel_dagger",
  },
  {
    id: "card_hamstring",
    name: "Hamstring",
    type: "equipment",
    strainCost: 1,
    description: "Target loses 2 movement next turn.",
    range: "R(1)",
    sourceEquipmentId: "weapon_steel_dagger",
  },
  {
    id: "card_sidestep",
    name: "Sidestep",
    type: "equipment",
    strainCost: 1,
    description: "Gain +3 AGI until end of turn.",
    range: "R(Self)",
    sourceEquipmentId: "weapon_steel_dagger",
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
    sourceEquipmentId: "weapon_emberclaw_repeater",
  },
  {
    id: "card_suppressive_spray",
    name: "Suppressive Spray",
    type: "equipment",
    strainCost: 2,
    description: "Target suffers -2 ACC and -1 movement. +1 heat.",
    range: "R(2-5)",
    sourceEquipmentId: "weapon_emberclaw_repeater",
  },
  {
    id: "card_cooling_discipline",
    name: "Cooling Discipline",
    type: "equipment",
    strainCost: 0,
    description: "Remove 2 heat and gain +1 DEF until next turn.",
    range: "R(Self)",
    sourceEquipmentId: "weapon_emberclaw_repeater",
  },
  // Helmet cards
  {
    id: "card_headbutt",
    name: "Headbutt",
    type: "equipment",
    strainCost: 1,
    description: "Deal 2 damage and stun for 1 turn.",
    range: "R(1)",
    damage: 2,
    sourceEquipmentId: "armor_ironguard_helm",
  },
  {
    id: "card_shield_sight",
    name: "Shield Sight",
    type: "equipment",
    strainCost: 1,
    description: "Ignore flanking penalties until your next turn.",
    range: "R(Self)",
    sourceEquipmentId: "armor_ironguard_helm",
  },
  {
    id: "card_shield_headbutt",
    name: "Shield Headbutt",
    type: "equipment",
    strainCost: 2,
    description: "Stun target for 1 turn.",
    range: "R(1)",
    sourceEquipmentId: "armor_ironguard_helm",
  },
  {
    id: "card_aimed_strike",
    name: "Aimed Strike",
    type: "equipment",
    strainCost: 1,
    description: "Deal 3 damage with +1 ACC.",
    range: "R(2-4)",
    damage: 3,
    sourceEquipmentId: "armor_rangers_hood",
  },
  {
    id: "card_hunters_mark",
    name: "Hunter's Mark",
    type: "equipment",
    strainCost: 1,
    description: "Mark target; next ranged attack deals +2 damage.",
    range: "R(3-5)",
    sourceEquipmentId: "armor_rangers_hood",
  },
  {
    id: "card_hide_in_shadows",
    name: "Hide in Shadows",
    type: "equipment",
    strainCost: 2,
    description: "Gain +2 AGI and untargetable at range for 1 turn.",
    range: "R(Self)",
    sourceEquipmentId: "armor_rangers_hood",
  },
  {
    id: "card_mind_spike",
    name: "Mind Spike",
    type: "equipment",
    strainCost: 2,
    description: "Deal 4 magic damage.",
    range: "R(2-3)",
    damage: 4,
    sourceEquipmentId: "armor_mystic_circlet",
  },
  {
    id: "card_spell_focus",
    name: "Spell Focus",
    type: "equipment",
    strainCost: 1,
    description: "Your next magic skill gains +3 ACC.",
    range: "R(Self)",
    sourceEquipmentId: "armor_mystic_circlet",
  },
  {
    id: "card_mana_barrier",
    name: "Mana Barrier",
    type: "equipment",
    strainCost: 2,
    description: "Reduce incoming magic damage by 2 until next turn.",
    range: "R(Self)",
    sourceEquipmentId: "armor_mystic_circlet",
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
    sourceEquipmentId: "armor_steelplate_cuirass",
  },
  {
    id: "card_fortify",
    name: "Fortify",
    type: "equipment",
    strainCost: 1,
    description: "Gain immunity to knockback until next turn.",
    range: "R(Self)",
    sourceEquipmentId: "armor_steelplate_cuirass",
  },
  {
    id: "card_fortress_form",
    name: "Fortress Form",
    type: "equipment",
    strainCost: 2,
    description: "Gain +3 DEF but movement -1 this turn.",
    range: "R(Self)",
    sourceEquipmentId: "armor_steelplate_cuirass",
  },
  {
    id: "card_knife_toss",
    name: "Knife Toss",
    type: "equipment",
    strainCost: 1,
    description: "Deal 2 damage; +1 AGI next turn.",
    range: "R(2-3)",
    damage: 2,
    sourceEquipmentId: "armor_leather_jerkin",
  },
  {
    id: "card_quick_roll",
    name: "Quick Roll",
    type: "equipment",
    strainCost: 0,
    description: "Move 1 tile as a free action.",
    range: "R(Self)",
    sourceEquipmentId: "armor_leather_jerkin",
  },
  {
    id: "card_light_guard",
    name: "Light Guard",
    type: "equipment",
    strainCost: 1,
    description: "+1 DEF and +1 AGI until next turn.",
    range: "R(Self)",
    sourceEquipmentId: "armor_leather_jerkin",
  },
  {
    id: "card_mana_surge_strike",
    name: "Mana Surge Strike",
    type: "equipment",
    strainCost: 2,
    description: "Deal 4 magic damage.",
    range: "R(2-3)",
    damage: 4,
    sourceEquipmentId: "armor_mages_robe",
  },
  {
    id: "card_mana_shift",
    name: "Mana Shift",
    type: "equipment",
    strainCost: 0,
    description: "Recover 1 strain.",
    range: "R(Self)",
    sourceEquipmentId: "armor_mages_robe",
  },
  {
    id: "card_arcane_veil",
    name: "Arcane Veil",
    type: "equipment",
    strainCost: 1,
    description: "Gain +2 DEF vs magic for 1 turn.",
    range: "R(Self)",
    sourceEquipmentId: "armor_mages_robe",
  },
  // Accessory cards
  {
    id: "card_knuckle_jab",
    name: "Knuckle Jab",
    type: "equipment",
    strainCost: 1,
    description: "Deal 2 damage and push target 1 tile.",
    range: "R(1)",
    damage: 2,
    sourceEquipmentId: "accessory_steel_signet_ring",
  },
  {
    id: "card_mark_of_command",
    name: "Mark of Command",
    type: "equipment",
    strainCost: 1,
    description: "All allies gain +1 ACC next turn.",
    range: "R(Self)",
    sourceEquipmentId: "accessory_steel_signet_ring",
  },
  {
    id: "card_signet_shield",
    name: "Signet Shield",
    type: "equipment",
    strainCost: 1,
    description: "Gain +1 DEF and +1 LUK until next turn.",
    range: "R(Self)",
    sourceEquipmentId: "accessory_steel_signet_ring",
  },
  {
    id: "card_spotters_shot",
    name: "Spotter's Shot",
    type: "equipment",
    strainCost: 2,
    description: "Deal 4 damage; target marked for +1 damage from all sources.",
    range: "R(3-6)",
    damage: 4,
    sourceEquipmentId: "accessory_eagle_eye_lens",
  },
  {
    id: "card_target_paint",
    name: "Target Paint",
    type: "equipment",
    strainCost: 1,
    description: "Allies gain +1 damage to target this turn.",
    range: "R(3-6)",
    sourceEquipmentId: "accessory_eagle_eye_lens",
  },
  {
    id: "card_farsight_guard",
    name: "Farsight Guard",
    type: "equipment",
    strainCost: 1,
    description: "Ignore overwatch this turn.",
    range: "R(Self)",
    sourceEquipmentId: "accessory_eagle_eye_lens",
  },
  {
    id: "card_flying_kick",
    name: "Flying Kick",
    type: "equipment",
    strainCost: 2,
    description: "Deal 3 damage; move through target's tile.",
    range: "R(1-2)",
    damage: 3,
    sourceEquipmentId: "accessory_fleetfoot_anklet",
  },
  {
    id: "card_speed_burst",
    name: "Speed Burst",
    type: "equipment",
    strainCost: 1,
    description: "+2 movement this turn.",
    range: "R(Self)",
    sourceEquipmentId: "accessory_fleetfoot_anklet",
  },
  {
    id: "card_swift_guard",
    name: "Swift Guard",
    type: "equipment",
    strainCost: 1,
    description: "Move +2 and gain +1 DEF this turn.",
    range: "R(Self)",
    sourceEquipmentId: "accessory_fleetfoot_anklet",
  },
  {
    id: "card_bulwark_bash",
    name: "Bulwark Bash",
    type: "equipment",
    strainCost: 2,
    description: "Deal 3 damage; gain +1 HP.",
    range: "R(1)",
    damage: 3,
    sourceEquipmentId: "accessory_vitality_charm",
  },
  {
    id: "card_second_wind",
    name: "Second Wind",
    type: "equipment",
    strainCost: 1,
    description: "Restore 1 HP.",
    range: "R(Self)",
    sourceEquipmentId: "accessory_vitality_charm",
  },
  {
    id: "card_life_guard",
    name: "Life Guard",
    type: "equipment",
    strainCost: 1,
    description: "Heal 1 HP and gain +1 DEF.",
    range: "R(Self)",
    sourceEquipmentId: "accessory_vitality_charm",
  },
];

// ----------------------------------------------------------------------------
// MODULES DATA
// ----------------------------------------------------------------------------

export const STARTER_MODULES: Module[] = [
  {
    id: "module_sharpened_edge",
    name: "Sharpened Edge",
    description: "A honed blade attachment that adds a critical strike card.",
    cardsGranted: ["card_critical_edge"],
    statBonus: { atk: 1 },
  },
  {
    id: "module_extended_barrel",
    name: "Extended Barrel",
    description: "Longer barrel for improved range and accuracy.",
    cardsGranted: ["card_long_shot"],
    statBonus: { acc: 2, agi: -1 },
  },
  {
    id: "module_heat_sink",
    name: "Heat Sink",
    description: "Improved cooling for mechanical weapons.",
    cardsGranted: ["card_emergency_vent"],
    statBonus: {},
  },
];

export const MODULE_CARDS: EquipmentCard[] = [
  {
    id: "card_critical_edge",
    name: "Critical Edge",
    type: "equipment",
    strainCost: 2,
    description: "Deal 5 damage. Crit on 18+.",
    range: "R(1)",
    damage: 5,
    sourceEquipmentId: "module_sharpened_edge",
  },
  {
    id: "card_long_shot",
    name: "Long Shot",
    type: "equipment",
    strainCost: 2,
    description: "Deal 3 damage at extended range.",
    range: "R(5-8)",
    damage: 3,
    sourceEquipmentId: "module_extended_barrel",
  },
  {
    id: "card_emergency_vent",
    name: "Emergency Vent",
    type: "equipment",
    strainCost: 0,
    description: "Remove all heat. Take 1 self-damage.",
    range: "R(Self)",
    sourceEquipmentId: "module_heat_sink",
  },
];

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------

export function canEquipWeapon(unitClass: UnitClass, weaponType: WeaponType): boolean {
  const allowed = CLASS_WEAPON_RESTRICTIONS[unitClass];
  return allowed.includes(weaponType);
}

export function getAllStarterEquipment(): Record<string, Equipment> {
  const all: Record<string, Equipment> = {};
  for (const w of STARTER_WEAPONS) all[w.id] = w;
  for (const h of STARTER_HELMETS) all[h.id] = h;
  for (const c of STARTER_CHESTPIECES) all[c.id] = c;
  for (const a of STARTER_ACCESSORIES) all[a.id] = a;
  return all;
}

export function getAllEquipmentCards(): Record<string, EquipmentCard> {
  const all: Record<string, EquipmentCard> = {};
  for (const c of CORE_CARDS) all[c.id] = c;
  for (const c of EQUIPMENT_CARDS) all[c.id] = c;
  for (const c of MODULE_CARDS) all[c.id] = c;
  for (const unitClass of Object.keys(CLASS_CARDS) as UnitClass[]) {
    for (const c of CLASS_CARDS[unitClass]) all[c.id] = c;
  }
  return all;
}

export function getAllModules(): Record<string, Module> {
  const all: Record<string, Module> = {};
  for (const m of STARTER_MODULES) all[m.id] = m;
  return all;
}

export function buildDeckFromLoadout(
  unitClass: UnitClass,
  loadout: UnitLoadout,
  equipmentById: Record<string, Equipment>,
  modulesById: Record<string, Module>
): string[] {
  const deck: string[] = [];

  // 1. Add core cards (always available)
  for (const card of CORE_CARDS) {
    deck.push(card.id);
    deck.push(card.id); // Add 2 copies of each core card
  }

  // 2. Add class cards
  const classCards = CLASS_CARDS[unitClass] || [];
  for (const card of classCards) {
    deck.push(card.id);
  }

  // 3. Add equipment cards from all equipped gear
  const slots: (keyof UnitLoadout)[] = [
    "weapon",
    "helmet",
    "chestpiece",
    "accessory1",
    "accessory2",
  ];

  for (const slot of slots) {
    const equipId = loadout[slot];
    if (!equipId) continue;

    const equip = equipmentById[equipId];
    if (!equip) continue;

    for (const cardId of equip.cardsGranted) {
      deck.push(cardId);
    }

    if (equip.slot === "weapon") {
      const weapon = equip as WeaponEquipment;
      for (const modId of weapon.attachedModules) {
        const mod = modulesById[modId];
        if (mod) {
          for (const cardId of mod.cardsGranted) {
            deck.push(cardId);
          }
        }
      }
    }
  }

  return deck;
}

export function calculateEquipmentStats(
  loadout: UnitLoadout,
  equipmentById: Record<string, Equipment>,
  modulesById: Record<string, Module>
): EquipmentStats {
  const total: EquipmentStats = { atk: 0, def: 0, agi: 0, acc: 0, hp: 0 };

  const slots: (keyof UnitLoadout)[] = [
    "weapon",
    "helmet",
    "chestpiece",
    "accessory1",
    "accessory2",
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
      const weapon = equip as WeaponEquipment;
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
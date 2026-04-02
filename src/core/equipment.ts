// ============================================================================
// EQUIPMENT SYSTEM - Core Types and Data
// Headline 11b & 11c: Equipment, Cards, Modules, Deck Building
// ============================================================================

<<<<<<< HEAD

import { GameState } from "./types";
import { getSettings } from "./settings";
import { getAllImportedBattleCards, getAllImportedGear, getImportedClassDefinition } from "../content/technica";
=======
import {
  getAllImportedCards,
  getAllImportedGear,
  getImportedClass,
  isTechnicaContentDisabled,
} from "../content/technica";
import type { ImportedCard, ImportedGear } from "../content/technica/types";
>>>>>>> 3307f1b (technica compat)

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
  | "dagger"
  | "knife"
  | "fist"
  | "rod"
  | "katana"
  | "shuriken"
  | "spear"
  | "instrument";

export type ArmorSlot = "helmet" | "chestpiece";
export type EquipSlot = "weapon" | "helmet" | "chestpiece" | "accessory1" | "accessory2";

export type BuiltInUnitClass =
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

<<<<<<< HEAD
export type UnitClass = BuiltInUnitClass | (string & {});
=======
export type UnitClass = BuiltInUnitClass | string;
>>>>>>> 3307f1b (technica compat)

export type EquipmentCardType = "core" | "class" | "equipment" | "gambit";

// ----------------------------------------------------------------------------
// CLASS WEAPON RESTRICTIONS
// ----------------------------------------------------------------------------

export const CLASS_WEAPON_RESTRICTIONS: Record<BuiltInUnitClass, WeaponType[]> = {
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
<<<<<<< HEAD
  sourceClassId?: string;
=======
  artPath?: string;
>>>>>>> 3307f1b (technica compat)
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

export interface HeatZone {
  min: number;
  max: number;
  name: string;
  effect: string | null;
}

export interface WeaponEquipment {
  id: string;
  name: string;
  description?: string;
  slot: "weapon";
  weaponType: WeaponType;
  isMechanical: boolean;
  stats: EquipmentStats;
  heatCapacity?: number;
  heatZones?: HeatZone[];
  passiveHeatDecay?: number;
  ammoMax?: number;
  quickReloadStrain?: number;
  fullReloadStrain?: number;
  cardsGranted: string[];
  moduleSlots: number;
  attachedModules: string[];
  clutchToggle?: string;
  doubleClutch?: string;
  wear: number;
  inventory?: {
    massKg: number;
    bulkBu: number;
    powerW: number;
    startingOwned?: boolean;
  };
  iconPath?: string;
  metadata?: Record<string, unknown>;

  // Gear Builder metadata (v1)
  chassisId?: string;
  doctrineId?: string;
  stability?: number; // 0-100
  builderVersion?: number; // For migration safety
}

export interface ArmorEquipment {
  id: string;
  name: string;
  description?: string;
  slot: "helmet" | "chestpiece";
  stats: EquipmentStats;
  cardsGranted: string[];
  inventory?: {
    massKg: number;
    bulkBu: number;
    powerW: number;
    startingOwned?: boolean;
  };
  iconPath?: string;
  metadata?: Record<string, unknown>;

  // Gear Builder metadata (v1)
  chassisId?: string;
  doctrineId?: string;
  stability?: number; // 0-100
  builderVersion?: number; // For migration safety
}

export interface AccessoryEquipment {
  id: string;
  name: string;
  description?: string;
  slot: "accessory";
  stats: EquipmentStats;
  cardsGranted: string[];
  inventory?: {
    massKg: number;
    bulkBu: number;
    powerW: number;
    startingOwned?: boolean;
  };
  iconPath?: string;
  metadata?: Record<string, unknown>;

  // Gear Builder metadata (v1)
  chassisId?: string;
  doctrineId?: string;
  stability?: number; // 0-100
  builderVersion?: number; // For migration safety
}

export type Equipment = WeaponEquipment | ArmorEquipment | AccessoryEquipment;

// ----------------------------------------------------------------------------
// UNIT EQUIPMENT LOADOUT
// ----------------------------------------------------------------------------

export interface UnitLoadout {
  primaryWeapon: string | null;
  secondaryWeapon: string | null;
  helmet: string | null;
  chestpiece: string | null;
  accessory1: string | null;
  accessory2: string | null;
}

// ----------------------------------------------------------------------------
// DATA RE-EXPORTS (Data moved to separate files to maintain manageable file size)
// ----------------------------------------------------------------------------

export { CORE_CARDS } from "../data/cards/coreCards";
export { CLASS_CARDS } from "../data/cards/classCards";
export { EQUIPMENT_CARDS } from "../data/cards/equipmentCards";
export { STARTER_WEAPONS } from "../data/weapons";
export { STARTER_HELMETS, STARTER_CHESTPIECES, STARTER_ACCESSORIES } from "../data/armor";
export { STARTER_MODULES, MODULE_CARDS } from "../data/modules";

// Import them locally as well so the helper functions below can still use them
import { CORE_CARDS } from "../data/cards/coreCards";
import { CLASS_CARDS } from "../data/cards/classCards";
import { EQUIPMENT_CARDS } from "../data/cards/equipmentCards";
import { STARTER_WEAPONS } from "../data/weapons";
import { STARTER_HELMETS, STARTER_CHESTPIECES, STARTER_ACCESSORIES } from "../data/armor";
import { STARTER_MODULES, MODULE_CARDS } from "../data/modules";

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------

export function canEquipWeapon(unitClass: UnitClass, weaponType: WeaponType): boolean {
<<<<<<< HEAD
  const importedClass = getImportedClassDefinition(unitClass);
  if (importedClass) {
    return importedClass.weaponTypes.includes(weaponType);
  }

  const allowed = CLASS_WEAPON_RESTRICTIONS[unitClass as BuiltInUnitClass] || [];
  return allowed.includes(weaponType);
=======
  const allowed = CLASS_WEAPON_RESTRICTIONS[unitClass];
  if (allowed) {
    return allowed.includes(weaponType);
  }

  const importedClass = getImportedClass(unitClass);
  return importedClass?.weaponTypes.includes(weaponType) ?? false;
}

function toEquipmentCardRange(range: number | undefined): string | undefined {
  if (range === undefined) {
    return undefined;
  }

  return range <= 0 ? "R(Self)" : `R(${range})`;
}

function toImportedEquipmentCard(card: ImportedCard): EquipmentCard {
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
    artPath: card.artPath
  };
}

function toRuntimeEquipment(gear: ImportedGear): Equipment {
  if (gear.slot === "weapon") {
    return {
      ...gear,
      slot: "weapon",
      weaponType: gear.weaponType ?? "sword",
      isMechanical: gear.isMechanical ?? false,
      moduleSlots: gear.moduleSlots ?? 0,
      attachedModules: gear.attachedModules ?? [],
      wear: gear.wear ?? 0
    };
  }

  return {
    ...gear,
    slot: gear.slot
  } as ArmorEquipment | AccessoryEquipment;
>>>>>>> 3307f1b (technica compat)
}

export function getAllStarterEquipment(): Record<string, Equipment> {
  const all: Record<string, Equipment> = {};
<<<<<<< HEAD
  for (const w of STARTER_WEAPONS) all[w.id] = w;
  for (const h of STARTER_HELMETS) all[h.id] = h;
  for (const c of STARTER_CHESTPIECES) all[c.id] = c;
  for (const a of STARTER_ACCESSORIES) all[a.id] = a;
  for (const imported of getAllImportedGear()) all[imported.id] = imported;
=======
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
>>>>>>> 3307f1b (technica compat)
  return all;
}

function formatCardRange(range?: number): string | undefined {
  if (range === undefined) {
    return undefined;
  }
  if (range <= 0) {
    return "Self";
  }
  return `R(${range})`;
}

function toImportedEquipmentCard(card: ReturnType<typeof getAllImportedBattleCards>[number]): EquipmentCard {
  return {
    id: card.id,
    name: card.name,
    type: card.type,
    strainCost: card.strainCost,
    description: card.description,
    range: formatCardRange(card.range),
    damage: card.damage,
    effects: (card.effects || []).map((effect) => effect.type),
    sourceEquipmentId: card.sourceEquipmentId,
    sourceClassId: card.sourceClassId
  };
}

export function getAllEquipmentCards(): Record<string, EquipmentCard> {
  const all: Record<string, EquipmentCard> = {};
<<<<<<< HEAD
  for (const c of CORE_CARDS) all[c.id] = c;
  for (const c of EQUIPMENT_CARDS) all[c.id] = c;
  for (const c of MODULE_CARDS) all[c.id] = c;
  for (const unitClass of Object.keys(CLASS_CARDS) as BuiltInUnitClass[]) {
    for (const c of CLASS_CARDS[unitClass]) all[c.id] = c;
=======
  for (const c of CORE_CARDS) {
    if (!isTechnicaContentDisabled("card", c.id)) all[c.id] = c;
  }
  for (const c of EQUIPMENT_CARDS) {
    if (!isTechnicaContentDisabled("card", c.id)) all[c.id] = c;
  }
  for (const c of MODULE_CARDS) {
    if (!isTechnicaContentDisabled("card", c.id)) all[c.id] = c;
  }
  for (const unitClass of Object.keys(CLASS_CARDS) as UnitClass[]) {
    for (const c of CLASS_CARDS[unitClass]) {
      if (!isTechnicaContentDisabled("card", c.id)) all[c.id] = c;
    }
  }
  for (const card of getAllImportedCards()) {
    all[card.id] = toImportedEquipmentCard(card);
>>>>>>> 3307f1b (technica compat)
  }
  for (const imported of getAllImportedBattleCards()) {
    all[imported.id] = toImportedEquipmentCard(imported);
  }
  return all;
}

function getClassCardsForUnitClass(unitClass: UnitClass): EquipmentCard[] {
  const builtInCards = CLASS_CARDS[unitClass as BuiltInUnitClass] || [];
  const importedCards = getAllImportedBattleCards()
    .filter((card) => card.type === "class" && card.sourceClassId === unitClass)
    .map((card) => toImportedEquipmentCard(card));

  return [...builtInCards, ...importedCards];
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
    if (isTechnicaContentDisabled("card", card.id)) continue;
    deck.push(card.id);
    deck.push(card.id); // Add 2 copies of each core card
  }

  // 2. Add class cards
  const classCards = getClassCardsForUnitClass(unitClass);
  for (const card of classCards) {
    if (isTechnicaContentDisabled("card", card.id)) continue;
    deck.push(card.id);
  }

  // 3. Add equipment cards from all equipped gear
  const slots: (keyof UnitLoadout)[] = [
    "primaryWeapon",
    "secondaryWeapon",
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
      if (isTechnicaContentDisabled("card", cardId)) continue;
      deck.push(cardId);
    }

    if (equip.slot === "weapon") {
      const weapon = equip as WeaponEquipment;
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

export function calculateEquipmentStats(
  loadout: UnitLoadout,
  equipmentById: Record<string, Equipment>,
  modulesById: Record<string, Module>
): EquipmentStats {
  const total: EquipmentStats = { atk: 0, def: 0, agi: 0, acc: 0, hp: 0 };

  const slots: (keyof UnitLoadout)[] = [
    "primaryWeapon",
    "secondaryWeapon",
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

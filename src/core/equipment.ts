// ============================================================================
// EQUIPMENT SYSTEM - Core Types and Data
// Headline 11b & 11c: Equipment, Cards, Deck Building
// ============================================================================

import { GameState } from "./types";
import { getSettings } from "./settings";
import type {
  WeaponAmmoProfile,
  WeaponCardRules,
  WeaponClutchDefinition,
  WeaponHeatProfile,
} from "./weaponData";
import {
  getAllImportedCards,
  getAllImportedGear,
  getImportedClass,
  isTechnicaContentDisabled,
} from "../content/technica";
import type { ImportedCard, ImportedGear } from "../content/technica/types";
import type { MerchantListingSource } from "./merchant";
import { getLibraryCardDatabase, type GearSlotData, type LibraryCard } from "./gearWorkbench";

// ----------------------------------------------------------------------------
// ENUMS & CONSTANTS
// ----------------------------------------------------------------------------

export type WeaponType =
  | "sword"
  | "greatsword"
  | "shortsword"
  | "shield"
  | "bow"
  | "greatbow"
  | "gun"
  | "staff"
  | "greatstaff"
  | "greatspear"
  | "hammer"
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

export type UnitClass = BuiltInUnitClass | (string & {});

export type EquipmentCardType = "core" | "class" | "equipment" | "gambit";

// ----------------------------------------------------------------------------
// CLASS WEAPON RESTRICTIONS
// ----------------------------------------------------------------------------

export const CLASS_WEAPON_RESTRICTIONS: Record<BuiltInUnitClass, WeaponType[]> = {
  // Squire tree
  squire: ["sword", "shield"],
  sentry: ["sword", "greatsword", "shield"],
  paladin: ["sword", "greatsword", "shield"],
  watchGuard: ["sword", "bow", "shield"],

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
    "shield",
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
  sourceClassId?: string;
  artPath?: string;
  weaponRules?: Partial<WeaponCardRules>;
  isChaosCard?: boolean;
  chaosCardsToCreate?: string[];
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

export interface EquipmentShopSource {
  unlockFloor?: number;
  notes?: string;
}

export interface EquipmentEnemyDropSource {
  enemyUnitIds?: string[];
  notes?: string;
}

export interface EquipmentVictoryRewardSource {
  floorOrdinals?: number[];
  regionIds?: string[];
  notes?: string;
}

export interface EquipmentAcquisition {
  shop?: EquipmentShopSource;
  merchant?: MerchantListingSource;
  enemyDrop?: EquipmentEnemyDropSource;
  victoryReward?: EquipmentVictoryRewardSource;
  otherSourcesNotes?: string;
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
  clutches?: WeaponClutchDefinition[];
  heatProfile?: WeaponHeatProfile;
  ammoProfile?: WeaponAmmoProfile;
  cardsGranted: string[];
  clutchToggle?: string;
  doubleClutch?: string;
  wear: number;
  inventory?: {
    massKg: number;
    bulkBu: number;
    powerW: number;
    startingOwned?: boolean;
  };
  acquisition?: EquipmentAcquisition;
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
  acquisition?: EquipmentAcquisition;
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
  acquisition?: EquipmentAcquisition;
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

const EMPTY_UNIT_LOADOUT: UnitLoadout = {
  primaryWeapon: null,
  secondaryWeapon: null,
  helmet: null,
  chestpiece: null,
  accessory1: null,
  accessory2: null,
};

// ----------------------------------------------------------------------------
// DATA RE-EXPORTS (Data moved to separate files to maintain manageable file size)
// ----------------------------------------------------------------------------

export { CORE_CARDS } from "../data/cards/coreCards";
export { CHAOS_CARDS } from "../data/cards/chaosCards";
export { CLASS_CARDS } from "../data/cards/classCards";
export { EQUIPMENT_CARDS } from "../data/cards/equipmentCards";
export { STARTER_WEAPONS } from "../data/weapons";
export { STARTER_HELMETS, STARTER_CHESTPIECES, STARTER_ACCESSORIES } from "../data/armor";

// Import them locally as well so the helper functions below can still use them
import { CORE_CARDS } from "../data/cards/coreCards";
import { CHAOS_CARDS } from "../data/cards/chaosCards";
import { CLASS_CARDS } from "../data/cards/classCards";
import { EQUIPMENT_CARDS } from "../data/cards/equipmentCards";
import { STARTER_WEAPONS } from "../data/weapons";
import { STARTER_HELMETS, STARTER_CHESTPIECES, STARTER_ACCESSORIES } from "../data/armor";
import { normalizeWeaponTypeForRestrictions } from "./craftedGear";

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------

export function canEquipWeapon(unitClass: UnitClass, weaponType: WeaponType): boolean {
  const resolvedWeaponType = normalizeWeaponTypeForRestrictions(weaponType);
  const allowed = CLASS_WEAPON_RESTRICTIONS[unitClass as BuiltInUnitClass];
  if (allowed) {
    return allowed.includes(resolvedWeaponType);
  }

  const importedClass = getImportedClass(unitClass);
  if (importedClass) {
    return importedClass.weaponTypes.includes(resolvedWeaponType);
  }

  return false;
}

function isEquipmentValidForLoadoutSlot(
  unitClass: UnitClass,
  slot: keyof UnitLoadout,
  equipment: Equipment | null | undefined,
): boolean {
  if (!equipment) {
    return false;
  }

  switch (slot) {
    case "primaryWeapon":
    case "secondaryWeapon":
      return equipment.slot === "weapon" && canEquipWeapon(unitClass, equipment.weaponType);
    case "helmet":
      return equipment.slot === "helmet";
    case "chestpiece":
      return equipment.slot === "chestpiece";
    case "accessory1":
    case "accessory2":
      return equipment.slot === "accessory";
    default:
      return false;
  }
}

export function sanitizeLoadoutForUnitClass(
  unitClass: UnitClass,
  loadoutLike: Partial<UnitLoadout> | null | undefined,
  equipmentById: Record<string, Equipment>,
): UnitLoadout {
  const normalizedLoadout: UnitLoadout = {
    ...EMPTY_UNIT_LOADOUT,
    ...(loadoutLike ?? {}),
  };
  const sanitized: UnitLoadout = { ...EMPTY_UNIT_LOADOUT };
  const usedEquipmentIds = new Set<string>();
  const slots: (keyof UnitLoadout)[] = [
    "primaryWeapon",
    "secondaryWeapon",
    "helmet",
    "chestpiece",
    "accessory1",
    "accessory2",
  ];

  for (const slot of slots) {
    const equipmentId = normalizedLoadout[slot];
    if (!equipmentId || usedEquipmentIds.has(equipmentId)) {
      sanitized[slot] = null;
      continue;
    }

    const equipment = equipmentById[equipmentId];
    if (!isEquipmentValidForLoadoutSlot(unitClass, slot, equipment)) {
      sanitized[slot] = null;
      continue;
    }

    sanitized[slot] = equipmentId;
    usedEquipmentIds.add(equipmentId);
  }

  return sanitized;
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
    sourceClassId: card.sourceClassId,
    artPath: card.artPath
  };
}

function toLibraryEquipmentCard(card: LibraryCard): EquipmentCard {
  return {
    id: card.id,
    name: card.name,
    type: card.category === "chaos" ? "gambit" : "equipment",
    strainCost: card.strainCost,
    description: card.description,
    artPath: card.artPath,
  };
}

function toRuntimeEquipment(gear: ImportedGear): Equipment {
  if (gear.slot === "weapon") {
    const runtimeGear = { ...gear } as ImportedGear & Record<string, unknown>;
    delete runtimeGear.moduleSlots;
    delete runtimeGear.attachedModules;
    return {
      ...runtimeGear,
      slot: "weapon",
      weaponType: gear.weaponType ?? "sword",
      isMechanical: gear.isMechanical ?? false,
      cardsGranted: gear.cardsGranted ?? [],
      wear: gear.wear ?? 0
    };
  }

  return {
    ...gear,
    cardsGranted: gear.cardsGranted ?? [],
    slot: gear.slot
  } as ArmorEquipment | AccessoryEquipment;
}

export function getAllStarterEquipment(): Record<string, Equipment> {
  const all: Record<string, Equipment> = {};
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

export function getAllEquipmentCards(): Record<string, EquipmentCard> {
  const all: Record<string, EquipmentCard> = {};
  for (const c of CORE_CARDS) {
    if (!isTechnicaContentDisabled("card", c.id)) all[c.id] = c;
  }
  for (const c of CHAOS_CARDS) {
    if (!isTechnicaContentDisabled("card", c.id)) all[c.id] = c;
  }
  for (const c of EQUIPMENT_CARDS) {
    if (!isTechnicaContentDisabled("card", c.id)) all[c.id] = c;
  }
  for (const unitClass of Object.keys(CLASS_CARDS) as UnitClass[]) {
    for (const c of CLASS_CARDS[unitClass]) {
      if (!isTechnicaContentDisabled("card", c.id)) all[c.id] = c;
    }
  }
  for (const card of Object.values(getLibraryCardDatabase())) {
    if (isTechnicaContentDisabled("card", card.id)) continue;
    if (!all[card.id]) {
      all[card.id] = toLibraryEquipmentCard(card);
    }
  }
  for (const card of getAllImportedCards()) {
    all[card.id] = toImportedEquipmentCard(card);
  }
  return all;
}

function getClassCardsForUnitClass(unitClass: UnitClass): EquipmentCard[] {
  const builtInCards = CLASS_CARDS[unitClass as BuiltInUnitClass] || [];
  const importedCards = getAllImportedCards()
    .filter((card) => card.type === "class" && card.sourceClassId === unitClass)
    .map((card) => toImportedEquipmentCard(card));

  return [...builtInCards, ...importedCards];
}
function getEquipmentDeckCards(
  equipment: Equipment,
  gearSlots?: GearSlotData
): string[] {
  const baseCards = Array.isArray(equipment.cardsGranted) ? equipment.cardsGranted : [];
  if (!gearSlots) {
    return [...baseCards];
  }

  const slottedCards = Array.isArray(gearSlots.slottedCards) ? gearSlots.slottedCards : [];
  if (baseCards.length > 0) {
    return [...baseCards, ...slottedCards];
  }

  const lockedCards = Array.isArray(gearSlots.lockedCards) ? gearSlots.lockedCards : [];
  return [...lockedCards, ...slottedCards];
}

export function buildDeckFromLoadout(
  unitClass: UnitClass,
  loadout: UnitLoadout,
  equipmentById: Record<string, Equipment>,
  gearSlotsById?: Record<string, GearSlotData>
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

    for (const cardId of getEquipmentDeckCards(equip, gearSlotsById?.[equipId])) {
      if (isTechnicaContentDisabled("card", cardId)) continue;
      deck.push(cardId);
    }
  }

  return deck;
}

export function calculateEquipmentStats(
  loadout: UnitLoadout,
  equipmentById: Record<string, Equipment>
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
  }

  return total;
}

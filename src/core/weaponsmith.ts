import { subtractResourceWallet, hasEnoughResources, type ResourceKey, type ResourceWallet } from "./resources";
import type { GameState } from "./types";

export const COUNTERWEIGHT_WEAPONSMITH_ENCOUNTER_ID = "shaft_mechanist";
export const COUNTERWEIGHT_WORKSHOP_MAP_ID = "counterweight_workshop";

const LEGACY_AERISS_BOWBLADE_ID = "weapon_aeriss_bowblade";
const LEGACY_BOWBLADE_CARD_IDS = new Set([
  "card_bowblade_reaping_cut",
  "card_bowblade_splitshot",
  "card_bowblade_shift_latch",
  "card_bowblade_ripcord",
  "card_bowblade_charge_release",
  "card_bowblade_powered_sunder",
]);

export const BOWBLADE_BASE_MELEE_DAMAGE = 2;
export const BOWBLADE_BASE_MELEE_CHARGE_GAIN = 2;
export const BOWBLADE_BASE_MELEE_KNOCKBACK_FORCE = 600;
export const BOWBLADE_BASE_RANGED_DAMAGE = 5;
export const BOWBLADE_BASE_RANGED_RANGE = 400;
export const BOWBLADE_BASE_PROJECTILE_SPEED = 500;
export const BOWBLADE_BASE_ATTACK_CYCLE_MS = 400;
export const BOWBLADE_MIN_ATTACK_CYCLE_MS = 160;
export const BOWBLADE_BASE_MAX_ENERGY_CELLS = 5;

export type WeaponsmithUpgradeCategory = "ranged" | "melee" | "handling" | "powered";
export type WeaponsmithUpgradeId =
  | "quickdraw_limbs"
  | "stabilized_sightline"
  | "reinforced_edge"
  | "tempered_spine"
  | "transition_latch"
  | "charge_assisted_release"
  | "powered_counterstroke";

export interface WeaponsmithState {
  installedUpgradeIds: WeaponsmithUpgradeId[];
}

export interface BowbladeFieldProfile {
  meleeDamageBonus: number;
  meleeKnockbackBonus: number;
  meleeEnergyGainBonus: number;
  rangedDamageBonus: number;
  rangedRangeBonus: number;
  rangedProjectileSpeedBonus: number;
  attackCooldownDelta: number;
  maxEnergyCellsBonus: number;
}

export interface BowbladeWorkshopReadout {
  name: string;
  meleeDamage: number;
  meleeChargeGain: number;
  meleeImpact: number;
  rangedDamage: number;
  rangedRange: number;
  projectileSpeed: number;
  attackCycleMs: number;
  maxEnergyCells: number;
}

export interface WeaponsmithUpgradeDefinition {
  id: WeaponsmithUpgradeId;
  name: string;
  category: WeaponsmithUpgradeCategory;
  summary: string;
  detail: string;
  cost: {
    wad: number;
    resources: Partial<ResourceWallet>;
  };
  fieldProfile?: Partial<BowbladeFieldProfile>;
}

export interface WeaponsmithCatalogEntry {
  definition: WeaponsmithUpgradeDefinition;
  installed: boolean;
  unlocked: boolean;
  unlockLabel: string;
}

export interface InstallWeaponsmithUpgradeResult {
  ok: boolean;
  state: GameState;
  error?: string;
}

const EMPTY_FIELD_PROFILE: BowbladeFieldProfile = {
  meleeDamageBonus: 0,
  meleeKnockbackBonus: 0,
  meleeEnergyGainBonus: 0,
  rangedDamageBonus: 0,
  rangedRangeBonus: 0,
  rangedProjectileSpeedBonus: 0,
  attackCooldownDelta: 0,
  maxEnergyCellsBonus: 0,
};

export const WEAPONSMITH_UPGRADES: Record<WeaponsmithUpgradeId, WeaponsmithUpgradeDefinition> = {
  quickdraw_limbs: {
    id: "quickdraw_limbs",
    name: "Quickdraw Limbs",
    category: "ranged",
    summary: "Lightens draw timing for faster ranged follow-through.",
    detail: "Rebalances the bowblade arms for quicker release cycles and cleaner projectile travel.",
    cost: {
      wad: 120,
      resources: {
        drawcord: 2,
        fittings: 1,
      },
    },
    fieldProfile: {
      attackCooldownDelta: -40,
      rangedProjectileSpeedBonus: 120,
    },
  },
  stabilized_sightline: {
    id: "stabilized_sightline",
    name: "Stabilized Sightline",
    category: "ranged",
    summary: "Trues the upper rail for steadier long-range fire.",
    detail: "Adds a resin-sealed sightline assembly that keeps ranged shots stable deeper into the shaft lanes.",
    cost: {
      wad: 130,
      resources: {
        drawcord: 2,
        resin: 1,
      },
    },
    fieldProfile: {
      rangedRangeBonus: 100,
    },
  },
  reinforced_edge: {
    id: "reinforced_edge",
    name: "Reinforced Edge",
    category: "melee",
    summary: "Hardens the blade spine for stronger close-quarters cuts.",
    detail: "Alloy lamination gives the bowblade a heavier bite without compromising its hybrid frame.",
    cost: {
      wad: 130,
      resources: {
        alloy: 2,
        resin: 1,
      },
    },
    fieldProfile: {
      meleeDamageBonus: 1,
    },
  },
  tempered_spine: {
    id: "tempered_spine",
    name: "Tempered Spine",
    category: "melee",
    summary: "Improves impact transfer and charge gain on melee contact.",
    detail: "The internal spine is rebalanced with alloy ribs and fittings, letting each hit land harder and feed more power back into the frame.",
    cost: {
      wad: 145,
      resources: {
        alloy: 2,
        fittings: 1,
      },
    },
    fieldProfile: {
      meleeKnockbackBonus: 250,
      meleeEnergyGainBonus: 1,
    },
  },
  transition_latch: {
    id: "transition_latch",
    name: "Transition Latch",
    category: "handling",
    summary: "Tightens the bowblade's recovery between actions.",
    detail: "A rebuilt latch assembly smooths field handling and keeps Aeriss responsive when chaining blade and bow pressure together.",
    cost: {
      wad: 140,
      resources: {
        fittings: 2,
        drawcord: 1,
      },
    },
    fieldProfile: {
      attackCooldownDelta: -70,
      maxEnergyCellsBonus: 1,
    },
  },
  charge_assisted_release: {
    id: "charge_assisted_release",
    name: "Charge-Assisted Release",
    category: "powered",
    summary: "Routes stored charge into harder, faster powered shots.",
    detail: "Adds a powered release loop that amplifies ranged attacks when Aeriss spends stored energy cells in the field.",
    cost: {
      wad: 230,
      resources: {
        chargeCells: 2,
        fittings: 2,
      },
    },
    fieldProfile: {
      rangedDamageBonus: 2,
      rangedProjectileSpeedBonus: 60,
    },
  },
  powered_counterstroke: {
    id: "powered_counterstroke",
    name: "Powered Counterstroke",
    category: "powered",
    summary: "Feeds stored charge back into close-range strikes.",
    detail: "Routes charge through the hilt and recoil frame, letting committed melee returns hit harder and keep the bowblade running hot.",
    cost: {
      wad: 240,
      resources: {
        chargeCells: 1,
        alloy: 2,
        resin: 1,
      },
    },
    fieldProfile: {
      meleeDamageBonus: 1,
      maxEnergyCellsBonus: 1,
      attackCooldownDelta: -30,
    },
  },
};

const WEAPONSMITH_UPGRADE_ORDER: WeaponsmithUpgradeId[] = [
  "quickdraw_limbs",
  "stabilized_sightline",
  "reinforced_edge",
  "tempered_spine",
  "transition_latch",
  "charge_assisted_release",
  "powered_counterstroke",
];

function mergeFieldProfile(
  base: BowbladeFieldProfile,
  delta: Partial<BowbladeFieldProfile> | undefined,
): BowbladeFieldProfile {
  return {
    meleeDamageBonus: base.meleeDamageBonus + Number(delta?.meleeDamageBonus ?? 0),
    meleeKnockbackBonus: base.meleeKnockbackBonus + Number(delta?.meleeKnockbackBonus ?? 0),
    meleeEnergyGainBonus: base.meleeEnergyGainBonus + Number(delta?.meleeEnergyGainBonus ?? 0),
    rangedDamageBonus: base.rangedDamageBonus + Number(delta?.rangedDamageBonus ?? 0),
    rangedRangeBonus: base.rangedRangeBonus + Number(delta?.rangedRangeBonus ?? 0),
    rangedProjectileSpeedBonus: base.rangedProjectileSpeedBonus + Number(delta?.rangedProjectileSpeedBonus ?? 0),
    attackCooldownDelta: base.attackCooldownDelta + Number(delta?.attackCooldownDelta ?? 0),
    maxEnergyCellsBonus: base.maxEnergyCellsBonus + Number(delta?.maxEnergyCellsBonus ?? 0),
  };
}

function getInstalledUpgradeDefinitions(
  installedUpgradeIds: WeaponsmithUpgradeId[],
): WeaponsmithUpgradeDefinition[] {
  return installedUpgradeIds
    .map((upgradeId) => WEAPONSMITH_UPGRADES[upgradeId])
    .filter((definition): definition is WeaponsmithUpgradeDefinition => Boolean(definition));
}

function hasZoneBeenCleared(
  state: GameState,
  zoneId: "counterweight_shaft" | "outer_scaffold" | "drop_bay" | "supply_intake_port",
): boolean {
  return Number(state.outerDecks?.zoneCompletionCounts?.[zoneId] ?? 0) > 0;
}

function hasAdvancedMaterial(state: GameState, resourceKey: ResourceKey): boolean {
  return Number(state.resources?.[resourceKey] ?? 0) > 0;
}

function getUpgradeUnlockLabel(state: GameState, upgradeId: WeaponsmithUpgradeId): string {
  if (!isWeaponsmithUnlocked(state)) {
    return "Unlock the Counterweight workshop.";
  }

  switch (upgradeId) {
    case "stabilized_sightline":
      return hasZoneBeenCleared(state, "outer_scaffold") || hasAdvancedMaterial(state, "resin")
        ? "Recovered sightline notes."
        : "Requires resin exposure or Outer Scaffold notes.";
    case "tempered_spine":
      return hasZoneBeenCleared(state, "counterweight_shaft") || hasAdvancedMaterial(state, "alloy")
        ? "Counterweight frame data recovered."
        : "Requires alloy exposure or a secured Counterweight run.";
    case "charge_assisted_release":
      return hasZoneBeenCleared(state, "drop_bay")
        ? "Schema Authorization // Drop Bay power routing."
        : "Requires Drop Bay schema authorization.";
    case "powered_counterstroke":
      return hasZoneBeenCleared(state, "supply_intake_port")
        ? "Schema Authorization // Intake drive lattice."
        : "Requires Supply Intake schema authorization.";
    default:
      return "Workshop bench is ready.";
  }
}

function stripLegacyBowbladeCards(cardIds: string[] | undefined): string[] | undefined {
  if (!cardIds?.some((cardId) => LEGACY_BOWBLADE_CARD_IDS.has(cardId))) {
    return cardIds;
  }

  return cardIds.filter((cardId) => !LEGACY_BOWBLADE_CARD_IDS.has(cardId));
}

function sanitizeLegacyBowbladeBattleState(
  battle: GameState["currentBattle"],
): GameState["currentBattle"] {
  if (!battle) {
    return battle;
  }

  let changed = false;

  const nextUnits = Object.fromEntries(
    Object.entries(battle.units).map(([unitId, unit]) => {
      const battleUnit = unit as typeof unit & {
        equippedWeaponId?: string | null;
        weaponState?: unknown;
        weaponWear?: number;
        exhaustedPile?: string[];
        loadout?: (typeof unit)["loadout"] & { weapon?: string | null };
      };

      const loadoutNeedsCleanup = Boolean(
        battleUnit.loadout
        && (
          battleUnit.loadout.primaryWeapon === LEGACY_AERISS_BOWBLADE_ID
          || battleUnit.loadout.secondaryWeapon === LEGACY_AERISS_BOWBLADE_ID
          || battleUnit.loadout.weapon === LEGACY_AERISS_BOWBLADE_ID
        ),
      );
      const nextLoadout = loadoutNeedsCleanup && battleUnit.loadout
        ? {
            ...battleUnit.loadout,
            primaryWeapon: battleUnit.loadout.primaryWeapon === LEGACY_AERISS_BOWBLADE_ID
              ? null
              : battleUnit.loadout.primaryWeapon,
            secondaryWeapon: battleUnit.loadout.secondaryWeapon === LEGACY_AERISS_BOWBLADE_ID
              ? null
              : battleUnit.loadout.secondaryWeapon,
            weapon: battleUnit.loadout.weapon === LEGACY_AERISS_BOWBLADE_ID
              ? null
              : battleUnit.loadout.weapon,
          }
        : battleUnit.loadout;
      const nextHand = stripLegacyBowbladeCards(battleUnit.hand);
      const nextDrawPile = stripLegacyBowbladeCards(battleUnit.drawPile);
      const nextDiscardPile = stripLegacyBowbladeCards(battleUnit.discardPile);
      const nextExhaustedPile = stripLegacyBowbladeCards(battleUnit.exhaustedPile);
      const hadLegacyWeapon = battleUnit.equippedWeaponId === LEGACY_AERISS_BOWBLADE_ID;
      const cardsChanged = (
        nextHand !== battleUnit.hand
        || nextDrawPile !== battleUnit.drawPile
        || nextDiscardPile !== battleUnit.discardPile
        || nextExhaustedPile !== battleUnit.exhaustedPile
      );

      if (!hadLegacyWeapon && !loadoutNeedsCleanup && !cardsChanged) {
        return [unitId, unit];
      }

      changed = true;
      return [unitId, {
        ...battleUnit,
        loadout: nextLoadout,
        hand: nextHand ?? battleUnit.hand,
        drawPile: nextDrawPile ?? battleUnit.drawPile,
        discardPile: nextDiscardPile ?? battleUnit.discardPile,
        exhaustedPile: nextExhaustedPile ?? battleUnit.exhaustedPile,
        equippedWeaponId: hadLegacyWeapon ? null : battleUnit.equippedWeaponId,
        weaponState: hadLegacyWeapon ? null : battleUnit.weaponState,
        weaponWear: hadLegacyWeapon ? 0 : battleUnit.weaponWear,
      }];
    }),
  ) as typeof battle.units;

  if (!changed) {
    return battle;
  }

  return {
    ...battle,
    units: nextUnits,
  };
}

export function createDefaultWeaponsmithState(): WeaponsmithState {
  return {
    installedUpgradeIds: [],
  };
}

export function withNormalizedWeaponsmithState(state: GameState): GameState {
  const nextWeaponsmith = state.weaponsmith ?? createDefaultWeaponsmithState();
  const hadLegacyBowblade = Boolean(state.equipmentById?.[LEGACY_AERISS_BOWBLADE_ID]);
  const { [LEGACY_AERISS_BOWBLADE_ID]: legacyBowblade, ...remainingEquipmentById } = state.equipmentById ?? {};
  void legacyBowblade;
  const nextCurrentBattle = sanitizeLegacyBowbladeBattleState(state.currentBattle);
  const battleNeedsCleanup = nextCurrentBattle !== state.currentBattle;

  const aeriss = state.unitsById?.unit_aeriss;
  const aerissLoadout = aeriss?.loadout;
  const aerissNeedsCleanup = Boolean(
    aerissLoadout
    && (
      aerissLoadout.primaryWeapon === LEGACY_AERISS_BOWBLADE_ID
      || aerissLoadout.secondaryWeapon === LEGACY_AERISS_BOWBLADE_ID
    ),
  );

  if (!state.weaponsmith && !hadLegacyBowblade && !aerissNeedsCleanup && !battleNeedsCleanup) {
    return {
      ...state,
      weaponsmith: nextWeaponsmith,
    };
  }

  if (state.weaponsmith && !hadLegacyBowblade && !aerissNeedsCleanup && !battleNeedsCleanup) {
    return state;
  }

  return {
    ...state,
    weaponsmith: nextWeaponsmith,
    currentBattle: nextCurrentBattle,
    equipmentById: hadLegacyBowblade ? remainingEquipmentById : state.equipmentById,
    unitsById: aerissNeedsCleanup && aeriss && aerissLoadout
      ? {
          ...state.unitsById,
          unit_aeriss: {
            ...aeriss,
            loadout: {
              ...aerissLoadout,
              primaryWeapon: aerissLoadout.primaryWeapon === LEGACY_AERISS_BOWBLADE_ID
                ? null
                : aerissLoadout.primaryWeapon,
              secondaryWeapon: aerissLoadout.secondaryWeapon === LEGACY_AERISS_BOWBLADE_ID
                ? null
                : aerissLoadout.secondaryWeapon,
            },
          },
        }
      : state.unitsById,
  };
}

export function isWeaponsmithUnlocked(state: Pick<GameState, "outerDecks">): boolean {
  return Boolean(state.outerDecks?.seenNpcEncounterIds?.includes(COUNTERWEIGHT_WEAPONSMITH_ENCOUNTER_ID));
}

export function getWeaponsmithInstalledUpgradeIds(state: Pick<GameState, "weaponsmith">): WeaponsmithUpgradeId[] {
  return [...(state.weaponsmith?.installedUpgradeIds ?? [])];
}

export function getBowbladeFieldProfile(state: Pick<GameState, "weaponsmith">): BowbladeFieldProfile {
  return getInstalledUpgradeDefinitions(getWeaponsmithInstalledUpgradeIds(state))
    .reduce<BowbladeFieldProfile>(
      (profile, definition) => mergeFieldProfile(profile, definition.fieldProfile),
      { ...EMPTY_FIELD_PROFILE },
    );
}

export function getBowbladeWorkshopReadout(state: Pick<GameState, "weaponsmith">): BowbladeWorkshopReadout {
  const profile = getBowbladeFieldProfile(state);
  return {
    name: "Aeriss Bowblade",
    meleeDamage: BOWBLADE_BASE_MELEE_DAMAGE + profile.meleeDamageBonus,
    meleeChargeGain: BOWBLADE_BASE_MELEE_CHARGE_GAIN + profile.meleeEnergyGainBonus,
    meleeImpact: BOWBLADE_BASE_MELEE_KNOCKBACK_FORCE + profile.meleeKnockbackBonus,
    rangedDamage: BOWBLADE_BASE_RANGED_DAMAGE + profile.rangedDamageBonus,
    rangedRange: BOWBLADE_BASE_RANGED_RANGE + profile.rangedRangeBonus,
    projectileSpeed: BOWBLADE_BASE_PROJECTILE_SPEED + profile.rangedProjectileSpeedBonus,
    attackCycleMs: Math.max(BOWBLADE_MIN_ATTACK_CYCLE_MS, BOWBLADE_BASE_ATTACK_CYCLE_MS + profile.attackCooldownDelta),
    maxEnergyCells: Math.max(1, BOWBLADE_BASE_MAX_ENERGY_CELLS + profile.maxEnergyCellsBonus),
  };
}

export function getWeaponsmithUpgradeDefinitions(): WeaponsmithUpgradeDefinition[] {
  return WEAPONSMITH_UPGRADE_ORDER.map((upgradeId) => WEAPONSMITH_UPGRADES[upgradeId]);
}

export function isWeaponsmithUpgradeUnlocked(state: GameState, upgradeId: WeaponsmithUpgradeId): boolean {
  if (!isWeaponsmithUnlocked(state)) {
    return false;
  }

  switch (upgradeId) {
    case "stabilized_sightline":
      return hasZoneBeenCleared(state, "outer_scaffold") || hasAdvancedMaterial(state, "resin");
    case "tempered_spine":
      return hasZoneBeenCleared(state, "counterweight_shaft") || hasAdvancedMaterial(state, "alloy");
    case "charge_assisted_release":
      return hasZoneBeenCleared(state, "drop_bay");
    case "powered_counterstroke":
      return hasZoneBeenCleared(state, "supply_intake_port");
    default:
      return true;
  }
}

export function getWeaponsmithCatalog(state: GameState): WeaponsmithCatalogEntry[] {
  const installedUpgradeIds = new Set(getWeaponsmithInstalledUpgradeIds(state));
  return getWeaponsmithUpgradeDefinitions().map((definition) => ({
    definition,
    installed: installedUpgradeIds.has(definition.id),
    unlocked: isWeaponsmithUpgradeUnlocked(state, definition.id),
    unlockLabel: getUpgradeUnlockLabel(state, definition.id),
  }));
}

export function installWeaponsmithUpgrade(
  state: GameState,
  upgradeId: WeaponsmithUpgradeId,
): InstallWeaponsmithUpgradeResult {
  const definition = WEAPONSMITH_UPGRADES[upgradeId];
  if (!definition) {
    return {
      ok: false,
      state,
      error: "Upgrade definition was not found.",
    };
  }

  if (!isWeaponsmithUnlocked(state)) {
    return {
      ok: false,
      state,
      error: "The Counterweight workshop is not online yet.",
    };
  }

  if (!isWeaponsmithUpgradeUnlocked(state, upgradeId)) {
    return {
      ok: false,
      state,
      error: getUpgradeUnlockLabel(state, upgradeId),
    };
  }

  if (getWeaponsmithInstalledUpgradeIds(state).includes(upgradeId)) {
    return {
      ok: false,
      state,
      error: "That upgrade is already installed.",
    };
  }

  if (Number(state.wad ?? 0) < definition.cost.wad) {
    return {
      ok: false,
      state,
      error: "Not enough Wad.",
    };
  }

  if (!hasEnoughResources(state.resources, definition.cost.resources)) {
    return {
      ok: false,
      state,
      error: "Required advanced materials are missing.",
    };
  }

  return {
    ok: true,
    state: withNormalizedWeaponsmithState({
      ...state,
      wad: Math.max(0, Number(state.wad ?? 0) - definition.cost.wad),
      resources: subtractResourceWallet(state.resources, definition.cost.resources, true),
      weaponsmith: {
        ...(state.weaponsmith ?? createDefaultWeaponsmithState()),
        installedUpgradeIds: [
          ...getWeaponsmithInstalledUpgradeIds(state),
          upgradeId,
        ],
      },
    }),
  };
}

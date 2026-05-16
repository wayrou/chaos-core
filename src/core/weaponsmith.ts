import { type ResourceKey, type ResourceWallet } from "./resources";
import type { GameState } from "./types";
import { canSessionAffordCost, getLocalSessionPlayerSlot, getSessionResourcePool, spendSessionCost } from "./session";

export const COUNTERWEIGHT_WEAPONSMITH_ENCOUNTER_ID = "shaft_mechanist";
export const COUNTERWEIGHT_WORKSHOP_MAP_ID = "counterweight_workshop";
export const WEAPONSMITH_UNLOCK_FLOOR_ORDINAL = 6;
const CAMPAIGN_PROGRESS_STORAGE_KEY = "chaoscore_campaign_progress";

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
export type WeaponsmithUtilityCategory = "apron_utility";
export type WeaponsmithUpgradeId =
  | "quickdraw_limbs"
  | "stabilized_sightline"
  | "reinforced_edge"
  | "tempered_spine"
  | "transition_latch"
  | "charge_assisted_release"
  | "powered_counterstroke";
export type WeaponsmithUtilityItemId =
  | "apron_glider"
  | "anchor_spikes"
  | "counterweight_boots"
  | "wall_kick_spurs"
  | "signal_pennant"
  | "belt_lantern_upgrade"
  | "insulated_mantle"
  | "spark_mine"
  | "panel_key_set"
  | "bridge_crank"
  | "scrap_magnet";

export interface WeaponsmithState {
  installedUpgradeIds: WeaponsmithUpgradeId[];
  ownedUtilityItemIds: WeaponsmithUtilityItemId[];
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

export interface WeaponsmithUtilityItemDefinition {
  id: WeaponsmithUtilityItemId;
  name: string;
  category: WeaponsmithUtilityCategory;
  summary: string;
  detail: string;
  cost: {
    wad: number;
    resources: Partial<ResourceWallet>;
  };
}

export interface WeaponsmithCatalogEntry {
  definition: WeaponsmithUpgradeDefinition;
  installed: boolean;
  unlocked: boolean;
  unlockLabel: string;
}

export interface WeaponsmithUtilityCatalogEntry {
  definition: WeaponsmithUtilityItemDefinition;
  owned: boolean;
  unlocked: boolean;
  unlockLabel: string;
}

export interface InstallWeaponsmithUpgradeResult {
  ok: boolean;
  state: GameState;
  error?: string;
}

export interface PurchaseWeaponsmithUtilityItemResult {
  ok: boolean;
  state: GameState;
  error?: string;
}

type WeaponsmithUnlockProgress = {
  highestReachedFloorOrdinal?: number;
  activeRun?: {
    floorIndex?: number;
  } | null;
  opsTerminalAtlas?: {
    currentFloorOrdinal?: number;
    floorsById?: Record<string, { floorOrdinal?: number }>;
  } | null;
} | null | undefined;

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

export const WEAPONSMITH_UTILITY_ITEMS: Record<WeaponsmithUtilityItemId, WeaponsmithUtilityItemDefinition> = {
  apron_glider: {
    id: "apron_glider",
    name: "Apron Glider",
    category: "apron_utility",
    summary: "Deploys a stitched lift-cloth while airborne for long, controlled descents.",
    detail: "Press jump again while airborne to open the glider. It has no stamina drain and stows automatically on landing.",
    cost: {
      wad: 180,
      resources: {
        drawcord: 1,
        fittings: 1,
      },
    },
  },
  anchor_spikes: {
    id: "anchor_spikes",
    name: "Anchor Spikes",
    category: "apron_utility",
    summary: "Clamps Aeriss into marked ledges and hard deck seams during risky descents.",
    detail: "Future apron ledge points can use this kit for safer catches, climb-outs, and steep-surface landings.",
    cost: {
      wad: 150,
      resources: {
        alloy: 1,
        fittings: 2,
      },
    },
  },
  counterweight_boots: {
    id: "counterweight_boots",
    name: "Counterweight Boots",
    category: "apron_utility",
    summary: "Adds a spring-loaded lift assist to Aeriss's field jump.",
    detail: "Raises 3D apron jump height, opening taller platforms and cleaner glider launches.",
    cost: {
      wad: 210,
      resources: {
        alloy: 1,
        fittings: 2,
        chargeCells: 1,
      },
    },
  },
  wall_kick_spurs: {
    id: "wall_kick_spurs",
    name: "Wall Kick Spurs",
    category: "apron_utility",
    summary: "Hooks into authored wall-kick plates for a single rebound jump.",
    detail: "Future marked wall surfaces can use this kit to support vertical side routes without enabling freeform wall climbing.",
    cost: {
      wad: 185,
      resources: {
        alloy: 1,
        resin: 1,
        fittings: 1,
      },
    },
  },
  signal_pennant: {
    id: "signal_pennant",
    name: "Signal Pennant",
    category: "apron_utility",
    summary: "Packs deployable route markers for keeping orientation inside the dome.",
    detail: "Future marker placement can use this kit for visible navigation flags and player-authored waypoints.",
    cost: {
      wad: 90,
      resources: {
        wood: 2,
        drawcord: 1,
      },
    },
  },
  belt_lantern_upgrade: {
    id: "belt_lantern_upgrade",
    name: "Belt Lantern Upgrade",
    category: "apron_utility",
    summary: "Refits Aeriss's waist lantern with a wider stabilized lens.",
    detail: "Increases the player lantern radius in apron maps for safer fog and darkness exploration.",
    cost: {
      wad: 165,
      resources: {
        resin: 1,
        steamComponents: 2,
      },
    },
  },
  insulated_mantle: {
    id: "insulated_mantle",
    name: "Insulated Mantle",
    category: "apron_utility",
    summary: "Adds heat shielding for the future fire-region hazard set.",
    detail: "Future fire-region heat damage can check this mantle to reduce or ignore thermal apron damage.",
    cost: {
      wad: 190,
      resources: {
        resin: 2,
        alloy: 1,
      },
    },
  },
  spark_mine: {
    id: "spark_mine",
    name: "Spark Mine",
    category: "apron_utility",
    summary: "Unlocks a compact field mine for interrupting apron enemies.",
    detail: "Future deployable combat utility can use this kit for player-placed stagger traps.",
    cost: {
      wad: 175,
      resources: {
        steamComponents: 2,
        chargeCells: 1,
      },
    },
  },
  panel_key_set: {
    id: "panel_key_set",
    name: "Panel Key Set",
    category: "apron_utility",
    summary: "Opens matching service panels and optional maintenance hatches.",
    detail: "Future Technica panel locks can check this kit for optional routes, caches, and shortcut doors.",
    cost: {
      wad: 130,
      resources: {
        fittings: 2,
        metalScrap: 2,
      },
    },
  },
  bridge_crank: {
    id: "bridge_crank",
    name: "Bridge Crank",
    category: "apron_utility",
    summary: "Fits oversized bridge sockets that span chasms too large to glide across.",
    detail: "Future long-chasm bridge mechanisms can require this crank before Aeriss can extend the crossing.",
    cost: {
      wad: 225,
      resources: {
        alloy: 2,
        fittings: 2,
      },
    },
  },
  scrap_magnet: {
    id: "scrap_magnet",
    name: "Scrap Magnet",
    category: "apron_utility",
    summary: "Pulls nearby loose apron salvage into pickup range.",
    detail: "Increases the field pickup radius for basic resource objects so scrap is easier to gather in 3D spaces.",
    cost: {
      wad: 145,
      resources: {
        metalScrap: 3,
        chargeCells: 1,
      },
    },
  },
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

const WEAPONSMITH_UTILITY_ORDER: WeaponsmithUtilityItemId[] = [
  "apron_glider",
  "anchor_spikes",
  "counterweight_boots",
  "wall_kick_spurs",
  "signal_pennant",
  "belt_lantern_upgrade",
  "insulated_mantle",
  "spark_mine",
  "panel_key_set",
  "bridge_crank",
  "scrap_magnet",
];

function getHighestReachedFloorOrdinalFromProgress(progress: WeaponsmithUnlockProgress): number {
  if (!progress) {
    return 1;
  }

  const stored = Math.max(1, Number(progress.highestReachedFloorOrdinal ?? 1));
  const activeRun = Math.max(1, Number(progress.activeRun?.floorIndex ?? 0) + 1);
  const atlasCurrent = Math.max(1, Number(progress.opsTerminalAtlas?.currentFloorOrdinal ?? 1));
  const atlasGenerated = Math.max(
    1,
    ...Object.values(progress.opsTerminalAtlas?.floorsById ?? {})
      .map((floor) => Math.max(1, Number(floor.floorOrdinal ?? 1))),
  );

  return Math.max(stored, activeRun, atlasCurrent, atlasGenerated);
}

function getStoredCampaignHighestReachedFloorOrdinal(): number {
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      return 1;
    }

    const raw = storage.getItem(CAMPAIGN_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return 1;
    }

    return getHighestReachedFloorOrdinalFromProgress(JSON.parse(raw) as WeaponsmithUnlockProgress);
  } catch {
    return 1;
  }
}

function uniqueKnownUpgradeIds(upgradeIds: readonly WeaponsmithUpgradeId[] | undefined): WeaponsmithUpgradeId[] {
  return Array.from(new Set(upgradeIds ?? []))
    .filter((upgradeId): upgradeId is WeaponsmithUpgradeId => Boolean(WEAPONSMITH_UPGRADES[upgradeId]));
}

function uniqueKnownUtilityItemIds(
  utilityItemIds: readonly WeaponsmithUtilityItemId[] | undefined,
): WeaponsmithUtilityItemId[] {
  return Array.from(new Set(utilityItemIds ?? []))
    .filter((itemId): itemId is WeaponsmithUtilityItemId => Boolean(WEAPONSMITH_UTILITY_ITEMS[itemId]));
}

function arraysEqual<T>(left: readonly T[] | undefined, right: readonly T[]): boolean {
  if (!left || left.length !== right.length) {
    return false;
  }
  return left.every((entry, index) => entry === right[index]);
}

function normalizeWeaponsmithState(weaponsmith: WeaponsmithState | undefined): WeaponsmithState {
  return {
    installedUpgradeIds: uniqueKnownUpgradeIds(weaponsmith?.installedUpgradeIds),
    ownedUtilityItemIds: uniqueKnownUtilityItemIds(weaponsmith?.ownedUtilityItemIds),
  };
}

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
  return Number(getSessionResourcePool(state, getLocalSessionPlayerSlot(state)).resources?.[resourceKey] ?? 0) > 0;
}

function getUpgradeUnlockLabel(state: GameState, upgradeId: WeaponsmithUpgradeId): string {
  if (!isWeaponsmithUnlocked(state)) {
    return `Reach Floor ${String(WEAPONSMITH_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} to open the Weaponsmith node.`;
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
    ownedUtilityItemIds: [],
  };
}

export function withNormalizedWeaponsmithState(state: GameState): GameState {
  const nextWeaponsmith = normalizeWeaponsmithState(state.weaponsmith);
  const weaponsmithNeedsNormalization = !state.weaponsmith
    || !arraysEqual(state.weaponsmith.installedUpgradeIds, nextWeaponsmith.installedUpgradeIds)
    || !arraysEqual(state.weaponsmith.ownedUtilityItemIds, nextWeaponsmith.ownedUtilityItemIds);
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

  if (weaponsmithNeedsNormalization && !hadLegacyBowblade && !aerissNeedsCleanup && !battleNeedsCleanup) {
    return {
      ...state,
      weaponsmith: nextWeaponsmith,
    };
  }

  if (!weaponsmithNeedsNormalization && !hadLegacyBowblade && !aerissNeedsCleanup && !battleNeedsCleanup) {
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

export function isWeaponsmithUnlocked(
  state: Pick<GameState, "outerDecks">,
  progress?: WeaponsmithUnlockProgress,
): boolean {
  const reachedFloorOrdinal = progress === undefined
    ? getStoredCampaignHighestReachedFloorOrdinal()
    : getHighestReachedFloorOrdinalFromProgress(progress);
  return Boolean(
    reachedFloorOrdinal >= WEAPONSMITH_UNLOCK_FLOOR_ORDINAL
    || state.outerDecks?.seenNpcEncounterIds?.includes(COUNTERWEIGHT_WEAPONSMITH_ENCOUNTER_ID),
  );
}

export function getWeaponsmithInstalledUpgradeIds(state: Pick<GameState, "weaponsmith">): WeaponsmithUpgradeId[] {
  return [...(state.weaponsmith?.installedUpgradeIds ?? [])];
}

export function getWeaponsmithOwnedUtilityItemIds(state: Pick<GameState, "weaponsmith">): WeaponsmithUtilityItemId[] {
  return [...(state.weaponsmith?.ownedUtilityItemIds ?? [])];
}

export function hasWeaponsmithUtilityItem(
  state: Pick<GameState, "weaponsmith">,
  utilityItemId: WeaponsmithUtilityItemId,
): boolean {
  return getWeaponsmithOwnedUtilityItemIds(state).includes(utilityItemId);
}

export function hasApronGlider(state: Pick<GameState, "weaponsmith">): boolean {
  return hasWeaponsmithUtilityItem(state, "apron_glider");
}

export function hasAnchorSpikes(state: Pick<GameState, "weaponsmith">): boolean {
  return hasWeaponsmithUtilityItem(state, "anchor_spikes");
}

export function hasCounterweightBoots(state: Pick<GameState, "weaponsmith">): boolean {
  return hasWeaponsmithUtilityItem(state, "counterweight_boots");
}

export function hasWallKickSpurs(state: Pick<GameState, "weaponsmith">): boolean {
  return hasWeaponsmithUtilityItem(state, "wall_kick_spurs");
}

export function hasSignalPennant(state: Pick<GameState, "weaponsmith">): boolean {
  return hasWeaponsmithUtilityItem(state, "signal_pennant");
}

export function hasBeltLanternUpgrade(state: Pick<GameState, "weaponsmith">): boolean {
  return hasWeaponsmithUtilityItem(state, "belt_lantern_upgrade");
}

export function hasInsulatedMantle(state: Pick<GameState, "weaponsmith">): boolean {
  return hasWeaponsmithUtilityItem(state, "insulated_mantle");
}

export function hasSparkMine(state: Pick<GameState, "weaponsmith">): boolean {
  return hasWeaponsmithUtilityItem(state, "spark_mine");
}

export function hasPanelKeySet(state: Pick<GameState, "weaponsmith">): boolean {
  return hasWeaponsmithUtilityItem(state, "panel_key_set");
}

export function hasBridgeCrank(state: Pick<GameState, "weaponsmith">): boolean {
  return hasWeaponsmithUtilityItem(state, "bridge_crank");
}

export function hasScrapMagnet(state: Pick<GameState, "weaponsmith">): boolean {
  return hasWeaponsmithUtilityItem(state, "scrap_magnet");
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

export function getWeaponsmithUtilityItemDefinitions(): WeaponsmithUtilityItemDefinition[] {
  return WEAPONSMITH_UTILITY_ORDER.map((itemId) => WEAPONSMITH_UTILITY_ITEMS[itemId]);
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

export function isWeaponsmithUtilityItemUnlocked(state: GameState, utilityItemId: WeaponsmithUtilityItemId): boolean {
  if (!WEAPONSMITH_UTILITY_ITEMS[utilityItemId]) {
    return false;
  }
  return isWeaponsmithUnlocked(state);
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

export function getWeaponsmithUtilityCatalog(state: GameState): WeaponsmithUtilityCatalogEntry[] {
  const ownedUtilityItemIds = new Set(getWeaponsmithOwnedUtilityItemIds(state));
  return getWeaponsmithUtilityItemDefinitions().map((definition) => ({
    definition,
    owned: ownedUtilityItemIds.has(definition.id),
    unlocked: isWeaponsmithUtilityItemUnlocked(state, definition.id),
    unlockLabel: isWeaponsmithUnlocked(state)
      ? "Apron utility stock is available."
      : `Reach Floor ${String(WEAPONSMITH_UNLOCK_FLOOR_ORDINAL).padStart(2, "0")} to open the Weaponsmith node.`,
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

  if (!canSessionAffordCost(state, {
    wad: definition.cost.wad,
    resources: definition.cost.resources,
  })) {
    return {
      ok: false,
      state,
      error: "Required workshop funding or advanced materials are missing.",
    };
  }

  const spendResult = spendSessionCost(state, {
    wad: definition.cost.wad,
    resources: definition.cost.resources,
  });
  if (!spendResult.success) {
    return {
      ok: false,
      state,
      error: "Required workshop funding or advanced materials are missing.",
    };
  }

  return {
    ok: true,
    state: withNormalizedWeaponsmithState({
      ...spendResult.state,
      weaponsmith: {
        ...normalizeWeaponsmithState(state.weaponsmith),
        installedUpgradeIds: [
          ...getWeaponsmithInstalledUpgradeIds(state),
          upgradeId,
        ],
      },
    }),
  };
}

export function purchaseWeaponsmithUtilityItem(
  state: GameState,
  utilityItemId: WeaponsmithUtilityItemId,
): PurchaseWeaponsmithUtilityItemResult {
  const definition = WEAPONSMITH_UTILITY_ITEMS[utilityItemId];
  if (!definition) {
    return {
      ok: false,
      state,
      error: "Utility item definition was not found.",
    };
  }

  if (!isWeaponsmithUnlocked(state)) {
    return {
      ok: false,
      state,
      error: "The Weaponsmith node is not online yet.",
    };
  }

  if (hasWeaponsmithUtilityItem(state, utilityItemId)) {
    return {
      ok: false,
      state,
      error: "That utility item is already owned.",
    };
  }

  if (!canSessionAffordCost(state, {
    wad: definition.cost.wad,
    resources: definition.cost.resources,
  })) {
    return {
      ok: false,
      state,
      error: "Required workshop funding or parts are missing.",
    };
  }

  const spendResult = spendSessionCost(state, {
    wad: definition.cost.wad,
    resources: definition.cost.resources,
  });
  if (!spendResult.success) {
    return {
      ok: false,
      state,
      error: "Required workshop funding or parts are missing.",
    };
  }

  return {
    ok: true,
    state: withNormalizedWeaponsmithState({
      ...spendResult.state,
      weaponsmith: {
        ...normalizeWeaponsmithState(state.weaponsmith),
        ownedUtilityItemIds: [
          ...getWeaponsmithOwnedUtilityItemIds(state),
          utilityItemId,
        ],
      },
    }),
  };
}

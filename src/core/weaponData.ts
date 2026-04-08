export type WeaponCardTag =
  | "weapon_card"
  | "attack"
  | "direct"
  | "multi_attack"
  | "aoe"
  | "reload"
  | "heat_removal"
  | "guard_brace";

export interface WeaponCardRules {
  sourceWeaponId: string;
  heatDelta: number;
  ammoCost: number;
  tags: WeaponCardTag[];
  clutchCompatible: boolean;
}

export interface WeaponHeatZoneModifier {
  accuracyDelta?: number;
  damageDelta?: number;
  movementDelta?: number;
  areaRadiusDelta?: number;
  nextShotOverheats?: boolean;
}

export interface WeaponHeatZoneProfile {
  min: number;
  max: number;
  name: string;
  effectText: string | null;
  modifiers?: WeaponHeatZoneModifier;
}

export type WeaponOverheatEffect =
  | { kind: "jam_turns"; turns: number }
  | { kind: "self_damage_percent"; percent: number }
  | { kind: "self_damage_flat"; amount: number }
  | { kind: "self_strain"; amount: number }
  | { kind: "push_self"; tiles: number }
  | { kind: "weapon_card_lock_turns"; turns: number }
  | { kind: "weapon_disable_turns"; turns: number }
  | { kind: "skip_attack_turns"; turns: number }
  | { kind: "waste_ammo"; amount: number }
  | { kind: "apply_status_self"; status: "stunned" | "rooted" | "immobilized" | "dazed"; duration: number }
  | { kind: "reduce_max_heat"; amount: number }
  | { kind: "remove_random_weapon_card"; count: number };

export interface WeaponHeatProfile {
  capacity: number;
  passiveDecay: number;
  zones: WeaponHeatZoneProfile[];
  overheatSummary: string;
  overheatEffects: WeaponOverheatEffect[];
}

export interface WeaponAmmoProfile {
  max: number;
  quickReloadStrain: number;
  fullReloadStrain: number;
  defaultAttackAmmoCost: number;
}

export type WeaponClutchEffect =
  | { kind: "accuracy"; amount: number }
  | { kind: "damage"; amount: number }
  | { kind: "damage_multiplier"; multiplier: number }
  | { kind: "ignore_def"; amount: number }
  | { kind: "ignore_cover" }
  | { kind: "range_delta"; amount: number }
  | { kind: "range_override"; amount: number }
  | { kind: "extra_attack"; count: number; accuracyDelta?: number; damageDelta?: number }
  | { kind: "apply_status_on_hit"; status: "burning" | "rooted" | "immobilized" | "stunned"; duration: number }
  | { kind: "pull_target"; tiles: number }
  | { kind: "pull_self"; tiles: number }
  | { kind: "move_before_attack"; tiles: number }
  | { kind: "free_attack_move" }
  | { kind: "line_attack" }
  | { kind: "splash_in_range"; amount: number }
  | { kind: "self_buff"; stat: "atk" | "def" | "agi" | "acc"; amount: number; duration: number }
  | { kind: "self_debuff"; stat: "atk" | "def" | "agi" | "acc"; amount: number; duration: number }
  | { kind: "next_card_modifier"; strainDelta?: number; accuracyDelta?: number; damageDelta?: number }
  | { kind: "unsupported"; note: string };

export interface WeaponClutchDefinition {
  id: string;
  label: string;
  description: string;
  effects: WeaponClutchEffect[];
}

export interface WeaponQueuedModifierState {
  strainDelta: number;
  accuracyDelta: number;
  damageDelta: number;
}

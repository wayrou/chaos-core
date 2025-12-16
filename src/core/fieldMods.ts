// ============================================================================
// FIELD MODS SYSTEM - Data Models & Definitions
// Temporary run-scoped augments that provide triggered effects
// ============================================================================

export type FieldModRarity = "common" | "uncommon" | "rare";
export type FieldModScope = "unit" | "squad";

export type FieldModTrigger =
  | "battle_start"
  | "turn_start"
  | "card_played"
  | "draw"
  | "move"
  | "hit"
  | "crit"
  | "kill"
  | "shield_gained"
  | "damage_taken"
  | "room_cleared";

export type FieldModEffect =
  | { kind: "deal_damage"; amount: number; target: "random_enemy" | "adjacent_enemies" | "all_enemies" }
  | { kind: "apply_status"; status: "burn" | "bleed" | "shock" | "slow"; stacks: number; target: "hit_target" | "random_enemy" }
  | { kind: "gain_shield"; amount: number; target: "self" | "all_allies" }
  | { kind: "draw"; amount: number; target: "self" | "team" }
  | { kind: "reduce_cost_next_card"; amount: number; target: "self" }
  | { kind: "gain_resource"; resource: "wood" | "stone" | "chaos_shards"; amount: number }
  | { kind: "summon_drone"; count: number; droneTypeId: string }
  | { kind: "knockback"; tiles: number; target: "hit_target" };

export interface FieldModDef {
  id: string;
  name: string;
  description: string;           // include military trigger phrasing
  rarity: FieldModRarity;
  scope: FieldModScope;          // unit by default, rare can be squad
  trigger: FieldModTrigger;
  effect: FieldModEffect;
  stackMode: "linear" | "additive";
  chance?: number;               // 0..1 for proc chance; omit = always triggers
  maxStacks?: number;
  tags?: string[];
  cost?: number;                 // for Black Market
}

export interface FieldModInstance {
  defId: string;
  stacks: number;
  instanceId: string;
}

// Hardpoints: 2 slots per unit for Field Mods
export type HardpointState = (FieldModInstance | null)[]; // length 2


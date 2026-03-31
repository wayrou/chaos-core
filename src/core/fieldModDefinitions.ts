// ============================================================================
// FIELD MOD DEFINITIONS - Starter Pool (v1)
// Data-driven Field Mod definitions
// ============================================================================

import { FieldModDef } from "./fieldMods";
import { getTriggerLabel } from "./fieldModStrings";

export const FIELD_MOD_DEFINITIONS: Record<string, FieldModDef> = {
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
    cost: 10,
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
    cost: 12,
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
    cost: 15,
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
    chance: 0.20,
    maxStacks: 3,
    tags: ["utility", "cost"],
    cost: 12,
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
    cost: 8,
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
    cost: 10,
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
    cost: 20,
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
    chance: 0.30,
    maxStacks: 2,
    tags: ["defense", "team"],
    cost: 25,
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
    cost: 22,
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
    cost: 30,
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
    cost: 50,
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
    cost: 45,
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
    chance: 0.20,
    maxStacks: 2,
    tags: ["damage", "squad"],
    cost: 40,
  },
};

export function getAllFieldModDefs(): FieldModDef[] {
  return Object.values(FIELD_MOD_DEFINITIONS);
}

export function getFieldModDef(id: string): FieldModDef | undefined {
  return FIELD_MOD_DEFINITIONS[id];
}


// ============================================================================
// FIELD MOD STRINGS - Military-flavored trigger labels
// Single source of truth for player-facing trigger text
// ============================================================================

import { FieldModTrigger } from "./fieldMods";

const TRIGGER_LABELS: Record<FieldModTrigger, string> = {
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
  room_cleared: "On Area Secured",
};

export function getTriggerLabel(trigger: FieldModTrigger): string {
  return TRIGGER_LABELS[trigger] || trigger;
}

import { FieldModDef } from "./fieldMods";

export function formatFieldModTooltip(def: FieldModDef, stacks: number): string {
  const triggerLabel = getTriggerLabel(def.trigger);
  let desc = def.description;
  
  // Replace trigger placeholders if needed
  if (desc.includes("{trigger}")) {
    desc = desc.replace(/{trigger}/g, triggerLabel);
  }
  
  // Add stack info if applicable
  if (stacks > 1 && def.stackMode === "linear") {
    desc += ` (${stacks} stacks)`;
  } else if (stacks > 1 && def.stackMode === "additive") {
    desc += ` (${stacks}x active)`;
  }
  
  return desc;
}


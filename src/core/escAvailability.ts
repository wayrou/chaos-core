export type EscNodeAction =
  | "ops-terminal"
  | "roster"
  | "loadout"
  | "inventory"
  | "gear-workbench"
  | "materials-refinery"
  | "shop"
  | "tavern"
  | "quest-board"
  | "port"
  | "dispatch"
  | "quarters"
  | "stable"
  | "black-market"
  | "schema"
  | "foundry-annex"
  | "theater-auto-tick"
  | "codex"
  | "settings"
  | "comms-array";

export type EscActionAvailability = "active" | "disabled" | "hidden";

export interface EscAvailabilityContext {
  expeditionActive: boolean;
}

const EXPEDITION_ENABLED_ESC_ACTIONS = new Set<EscNodeAction>([
  "inventory",
  "roster",
  "materials-refinery",
  "codex",
  "settings",
]);

export function getEscActionAvailability(
  action: EscNodeAction,
  context: EscAvailabilityContext,
): EscActionAvailability {
  if (!context.expeditionActive) {
    return "active";
  }

  return EXPEDITION_ENABLED_ESC_ACTIONS.has(action) ? "active" : "disabled";
}

export function isEscActionEnabled(
  action: EscNodeAction,
  context: EscAvailabilityContext,
): boolean {
  return getEscActionAvailability(action, context) === "active";
}

export function isEscActionVisible(
  action: EscNodeAction,
  context: EscAvailabilityContext,
): boolean {
  return getEscActionAvailability(action, context) !== "hidden";
}

export function getEscExpeditionRestrictionMessage(action?: string): string {
  if (action === "materials-refinery") {
    return "Light Crafting remains available during Outer Deck expeditions.";
  }

  return "Unavailable during Outer Deck expedition.";
}

export function getExpeditionEnabledEscActions(): EscNodeAction[] {
  return Array.from(EXPEDITION_ENABLED_ESC_ACTIONS);
}

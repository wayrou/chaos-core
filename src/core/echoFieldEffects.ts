import type { BattleModeContext, EchoFieldDefinition, EchoFieldId, EchoFieldPlacement } from "./types";

type BattleLike = {
  modeContext?: BattleModeContext;
  log?: string[];
};

type UnitLike = {
  id: string;
  name?: string;
  pos: { x: number; y: number } | null;
};

const ECHO_FIELD_COLORS: Record<EchoFieldId, string> = {
  ember_zone: "#ff8a48",
  bastion_zone: "#86b2ff",
  flux_zone: "#76f1d5",
};

const ECHO_FIELD_NAMES: Record<EchoFieldId, string> = {
  ember_zone: "Ember Zone",
  bastion_zone: "Bastion Zone",
  flux_zone: "Flux Zone",
};

const ECHO_FIELD_DESCRIPTIONS: Record<EchoFieldId, string> = {
  ember_zone: "Occupants strike harder while inside the zone.",
  bastion_zone: "Occupants gain defense but lose some movement inside the zone.",
  flux_zone: "Occupants gain extra movement while inside the zone.",
};

const ECHO_FIELD_EFFECT_LABELS: Record<EchoFieldId, string> = {
  ember_zone: "+DMG",
  bastion_zone: "+DEF / -MOV",
  flux_zone: "+MOV",
};

function getFieldRadiusFromLevel(level: number): number {
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 1;
}

export function buildEchoFieldDefinition(fieldId: EchoFieldId, draftId: string, level = 1): EchoFieldDefinition {
  return {
    draftId,
    id: fieldId,
    name: ECHO_FIELD_NAMES[fieldId],
    description: ECHO_FIELD_DESCRIPTIONS[fieldId],
    effectLabel: ECHO_FIELD_EFFECT_LABELS[fieldId],
    color: ECHO_FIELD_COLORS[fieldId],
    level,
    maxLevel: 5,
    radius: getFieldRadiusFromLevel(level),
  };
}

export function getEchoFieldCatalog(): EchoFieldDefinition[] {
  return [
    buildEchoFieldDefinition("ember_zone", "catalog_ember_zone", 1),
    buildEchoFieldDefinition("bastion_zone", "catalog_bastion_zone", 1),
    buildEchoFieldDefinition("flux_zone", "catalog_flux_zone", 1),
  ];
}

export function isEchoBattle(battle: BattleLike | null | undefined): boolean {
  return battle?.modeContext?.kind === "echo";
}

export function getEchoBattleContext(battle: BattleLike | null | undefined) {
  return battle?.modeContext?.kind === "echo" ? battle.modeContext.echo ?? null : null;
}

export function getEchoFieldPlacements(battle: BattleLike | null | undefined): EchoFieldPlacement[] {
  return getEchoBattleContext(battle)?.fieldPlacements ?? [];
}

export function isPositionInsideEchoField(
  pos: { x: number; y: number } | null | undefined,
  placement: EchoFieldPlacement,
): boolean {
  if (!pos) return false;
  const distance = Math.abs(pos.x - placement.x) + Math.abs(pos.y - placement.y);
  return distance <= placement.radius;
}

export function getEchoFieldsAffectingUnit(
  battle: BattleLike | null | undefined,
  unit: UnitLike | null | undefined,
  fieldId?: EchoFieldId,
): EchoFieldPlacement[] {
  if (!unit?.pos) return [];
  return getEchoFieldPlacements(battle).filter((placement) => {
    if (fieldId && placement.fieldId !== fieldId) {
      return false;
    }
    return isPositionInsideEchoField(unit.pos, placement);
  });
}

function getScaledLevelBonus(level: number, tierTwo = 3, tierThree = 5): number {
  if (level >= tierThree) return 3;
  if (level >= tierTwo) return 2;
  return 1;
}

export function getEchoAttackBonus(
  battle: BattleLike | null | undefined,
  unit: UnitLike | null | undefined,
): { amount: number; triggeredPlacements: EchoFieldPlacement[] } {
  const placements = getEchoFieldsAffectingUnit(battle, unit, "ember_zone");
  if (placements.length === 0) {
    return { amount: 0, triggeredPlacements: [] };
  }

  const amount = placements.reduce((maxBonus, placement) => (
    Math.max(maxBonus, getScaledLevelBonus(placement.level))
  ), 0);

  return { amount, triggeredPlacements: placements };
}

export function getEchoDefenseBonus(
  battle: BattleLike | null | undefined,
  unit: UnitLike | null | undefined,
): { amount: number; triggeredPlacements: EchoFieldPlacement[] } {
  const placements = getEchoFieldsAffectingUnit(battle, unit, "bastion_zone");
  if (placements.length === 0) {
    return { amount: 0, triggeredPlacements: [] };
  }

  const amount = placements.reduce((maxBonus, placement) => (
    Math.max(maxBonus, getScaledLevelBonus(placement.level))
  ), 0);

  return { amount, triggeredPlacements: placements };
}

export function getEchoMovementAdjustment(
  battle: BattleLike | null | undefined,
  unit: UnitLike | null | undefined,
): { amount: number; triggeredPlacements: EchoFieldPlacement[] } {
  const fluxPlacements = getEchoFieldsAffectingUnit(battle, unit, "flux_zone");
  const bastionPlacements = getEchoFieldsAffectingUnit(battle, unit, "bastion_zone");

  const fluxBonus = fluxPlacements.reduce((maxBonus, placement) => (
    Math.max(maxBonus, getScaledLevelBonus(placement.level))
  ), 0);

  const bastionPenalty = bastionPlacements.reduce((maxPenalty, placement) => (
    Math.max(maxPenalty, placement.level >= 5 ? 2 : 1)
  ), 0);

  return {
    amount: fluxBonus - bastionPenalty,
    triggeredPlacements: [...fluxPlacements, ...bastionPlacements],
  };
}

export function incrementEchoFieldTriggerCount<T extends BattleLike>(
  battle: T,
  placements: EchoFieldPlacement[],
  logLine?: string,
): T {
  const echoContext = getEchoBattleContext(battle);
  if (!echoContext || placements.length === 0) {
    return battle;
  }

  const uniqueKeys = new Set(
    placements.map((placement) => `${placement.draftId}:${placement.x}:${placement.y}`),
  );
  const increment = uniqueKeys.size;
  const nextLog = logLine && Array.isArray(battle.log)
    ? [...battle.log, logLine]
    : battle.log;

  return {
    ...battle,
    log: nextLog,
    modeContext: {
      ...battle.modeContext,
      kind: "echo",
      echo: {
        ...echoContext,
        fieldTriggerCount: (echoContext.fieldTriggerCount ?? 0) + increment,
      },
    },
  };
}

import {
  BASE_STRAIN_THRESHOLD,
  type BattleState,
  type BattleUnitState,
  getEquippedWeapon,
} from "./battle";
import { type NamedAudioHookId, playNamedAudioHook } from "./audioSystem";
import { VIBRATION_PATTERNS } from "./controllerSupport";
import { getAllStarterEquipment } from "./equipment";
import {
  WEAPON_NODE_NAMES,
  type HeatZone,
  type WeaponNodeId,
  getHeatZone,
} from "./weaponSystem";

export type FeedbackType =
  | "hit"
  | "miss"
  | "crit"
  | "heal"
  | "resource"
  | "warning"
  | "weapon_heat"
  | "weapon_node_damage"
  | "weapon_overheat"
  | "strain"
  | "ui_confirm";

export type FeedbackSource = "weapon" | "ui" | "environment" | "battle" | "field";

export type FeedbackPositionSpace = "battle-tile" | "field-world" | "screen";

export interface FeedbackPosition {
  x: number;
  y: number;
  space?: FeedbackPositionSpace;
}

export type FeedbackHapticPattern = keyof typeof VIBRATION_PATTERNS;

export interface FeedbackHapticRequest {
  pattern?: FeedbackHapticPattern;
}

export interface FeedbackRequest {
  type: FeedbackType;
  source: FeedbackSource;
  intensity: 1 | 2 | 3;
  position?: FeedbackPosition;
  targetPosition?: FeedbackPosition;
  text?: string;
  channel?: string;
  audioHook?: NamedAudioHookId | null;
  haptic?: FeedbackHapticRequest | null;
  meta?: Record<string, unknown>;
}

export type FeedbackListener = (request: FeedbackRequest) => void;

const FEEDBACK_EVENT_NAME = "chaoscore:feedback";

function clonePosition(position: FeedbackPosition | undefined): FeedbackPosition | undefined {
  if (!position) {
    return undefined;
  }
  return {
    x: Number(position.x),
    y: Number(position.y),
    space: position.space,
  };
}

function normalizeIntensity(value: number | undefined): 1 | 2 | 3 {
  if (value === 3) {
    return 3;
  }
  if (value === 2) {
    return 2;
  }
  return 1;
}

function getDefaultAudioHook(type: FeedbackType): NamedAudioHookId | null {
  switch (type) {
    case "hit":
      return "attack_hit";
    case "crit":
      return "attack_crit";
    case "resource":
      return "resource_pickup";
    case "weapon_node_damage":
      return "node_damage";
    case "weapon_overheat":
      return "weapon_overheat";
    case "ui_confirm":
      return "ui_click";
    default:
      return null;
  }
}

function getDefaultHapticPattern(type: FeedbackType): FeedbackHapticPattern | null {
  switch (type) {
    case "crit":
      return "criticalHit";
    case "hit":
      return "hit";
    case "weapon_overheat":
    case "warning":
      return "error";
    case "resource":
    case "ui_confirm":
      return "confirm";
    case "strain":
      return "damage";
    default:
      return null;
  }
}

function normalizeFeedbackRequest(request: FeedbackRequest): FeedbackRequest {
  const audioHook = request.audioHook === undefined
    ? getDefaultAudioHook(request.type)
    : request.audioHook;
  const hapticPattern = request.haptic === undefined
    ? getDefaultHapticPattern(request.type)
    : request.haptic?.pattern ?? null;

  return {
    ...request,
    intensity: normalizeIntensity(request.intensity),
    position: clonePosition(request.position),
    targetPosition: clonePosition(request.targetPosition),
    audioHook,
    haptic: hapticPattern ? { pattern: hapticPattern } : null,
  };
}

export function subscribeToFeedback(listener: FeedbackListener): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleEvent = (event: Event) => {
    const customEvent = event as CustomEvent<FeedbackRequest>;
    if (!customEvent.detail) {
      return;
    }
    listener(customEvent.detail);
  };

  window.addEventListener(FEEDBACK_EVENT_NAME, handleEvent as EventListener);
  return () => {
    window.removeEventListener(FEEDBACK_EVENT_NAME, handleEvent as EventListener);
  };
}

export function triggerFeedback(request: FeedbackRequest): FeedbackRequest {
  const normalized = normalizeFeedbackRequest(request);

  if (normalized.audioHook) {
    playNamedAudioHook(normalized.audioHook);
  }

  const hapticPattern = normalized.haptic?.pattern;
  if (hapticPattern) {
    VIBRATION_PATTERNS[hapticPattern]?.();
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<FeedbackRequest>(FEEDBACK_EVENT_NAME, {
      detail: normalized,
    }));
  }

  return normalized;
}

function getBattleUnitAnchor(unit: BattleUnitState | null | undefined): FeedbackPosition | undefined {
  if (!unit?.pos) {
    return undefined;
  }
  return {
    x: unit.pos.x,
    y: unit.pos.y,
    space: "battle-tile",
  };
}

function getHeatZoneLabel(zone: HeatZone): string {
  switch (zone) {
    case "critical":
      return "CRITICAL HEAT";
    case "warning":
      return "HEAT WARNING";
    default:
      return "HEAT STABLE";
  }
}

function getHeatIntensity(zone: HeatZone): 1 | 2 | 3 {
  switch (zone) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}

function getUnitByNameSnapshot(
  battle: BattleState | null | undefined,
  name: string,
): BattleUnitState | null {
  if (!battle) {
    return null;
  }
  return Object.values(battle.units).find((unit) => unit.name === name) ?? null;
}

function getNamedUnitsFromLog(
  line: string,
  previousBattle: BattleState | null | undefined,
  nextBattle: BattleState,
): BattleUnitState[] {
  const pool = [
    ...Object.values(nextBattle.units),
    ...Object.values(previousBattle?.units ?? {}),
  ];
  const byName = new Map<string, BattleUnitState>();
  pool.forEach((unit) => {
    if (!byName.has(unit.name)) {
      byName.set(unit.name, unit);
    }
  });

  return Array.from(byName.values())
    .map((unit) => ({
      unit,
      index: line.indexOf(unit.name),
    }))
    .filter((entry) => entry.index >= 0)
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.unit);
}

function pushFeedback(
  requests: FeedbackRequest[],
  seen: Set<string>,
  request: FeedbackRequest,
): void {
  const key = [
    request.type,
    request.text ?? "",
    request.position?.space ?? "",
    request.position?.x ?? "",
    request.position?.y ?? "",
    request.channel ?? "",
    String(request.meta?.["kind"] ?? ""),
    String(request.meta?.["unitId"] ?? ""),
  ].join("|");

  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  requests.push(request);
}

function deriveWeaponFeedback(
  previousUnit: BattleUnitState,
  nextUnit: BattleUnitState,
  requests: FeedbackRequest[],
  seen: Set<string>,
): void {
  if (!previousUnit.weaponState || !nextUnit.weaponState || previousUnit.equippedWeaponId !== nextUnit.equippedWeaponId) {
    return;
  }

  const weapon = getEquippedWeapon(nextUnit, getAllStarterEquipment()) ?? getEquippedWeapon(previousUnit, getAllStarterEquipment());
  const position = getBattleUnitAnchor(nextUnit) ?? getBattleUnitAnchor(previousUnit);

  if (weapon) {
    const previousZone = getHeatZone(previousUnit.weaponState, weapon);
    const nextZone = getHeatZone(nextUnit.weaponState, weapon);
    if (previousZone !== nextZone) {
      pushFeedback(requests, seen, {
        type: "weapon_heat",
        source: "weapon",
        intensity: getHeatIntensity(nextZone),
        position,
        text: getHeatZoneLabel(nextZone),
        meta: {
          unitId: nextUnit.id,
          zone: nextZone,
          weaponId: weapon.id,
          kind: "heat-zone",
        },
      });
    }
  }

  if (nextUnit.weaponState.currentAmmo < previousUnit.weaponState.currentAmmo) {
    pushFeedback(requests, seen, {
      type: "warning",
      source: "weapon",
      intensity: 1,
      position,
      text: `AMMO -${previousUnit.weaponState.currentAmmo - nextUnit.weaponState.currentAmmo}`,
      audioHook: null,
      haptic: null,
      meta: {
        unitId: nextUnit.id,
        kind: "ammo-tick",
      },
    });
  }

  ([1, 2, 3, 4, 5, 6] as WeaponNodeId[]).forEach((nodeId) => {
    const previousStatus = previousUnit.weaponState?.nodes[nodeId];
    const nextStatus = nextUnit.weaponState?.nodes[nodeId];
    if (!previousStatus || !nextStatus || previousStatus === nextStatus) {
      return;
    }

    pushFeedback(requests, seen, {
      type: "weapon_node_damage",
      source: "weapon",
      intensity: nextStatus === "destroyed" ? 3 : nextStatus === "broken" ? 2 : 1,
      position,
      text: `${WEAPON_NODE_NAMES[nodeId].primary} ${nextStatus.toUpperCase()}`,
      meta: {
        unitId: nextUnit.id,
        nodeId,
        status: nextStatus,
        kind: "node-damage",
      },
    });
  });

  const previousActiveClutches = previousUnit.weaponState.activeClutchIds.join(",");
  const nextActiveClutches = nextUnit.weaponState.activeClutchIds.join(",");
  if (previousActiveClutches !== nextActiveClutches) {
    pushFeedback(requests, seen, {
      type: "ui_confirm",
      source: "weapon",
      intensity: nextUnit.weaponState.activeClutchIds.length > 0 ? 2 : 1,
      position,
      text: nextUnit.weaponState.activeClutchIds.length > 0 ? "CLUTCH ON" : "CLUTCH OFF",
      meta: {
        unitId: nextUnit.id,
        kind: "clutch-toggle",
      },
    });
  }
}

function deriveLogFeedback(
  previousBattle: BattleState | null | undefined,
  nextBattle: BattleState,
  newLogTail: string[],
  requests: FeedbackRequest[],
  seen: Set<string>,
): void {
  newLogTail.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    const namedUnits = getNamedUnitsFromLog(line, previousBattle, nextBattle);
    const actor = namedUnits[0] ?? null;
    const target = namedUnits[1] ?? null;
    const actorPosition = getBattleUnitAnchor(actor);
    const targetPosition = getBattleUnitAnchor(target);

    if (line.includes("SLK//MISS") || /\bmisses\b/i.test(line) || /goes wide/i.test(line)) {
      pushFeedback(requests, seen, {
        type: "miss",
        source: "battle",
        intensity: 1,
        position: targetPosition ?? actorPosition,
        text: "MISS",
        audioHook: null,
        haptic: null,
        meta: {
          actorId: actor?.id,
          targetId: target?.id,
          kind: "miss",
        },
      });
      return;
    }

    if (line.includes("SLK//HEAT") && /overheats/i.test(line)) {
      pushFeedback(requests, seen, {
        type: "weapon_overheat",
        source: "weapon",
        intensity: 3,
        position: actorPosition,
        text: "OVERHEAT",
        meta: {
          actorId: actor?.id,
          kind: "overheat",
        },
      });
      return;
    }

    if (line.includes("SLK//RELOAD")) {
      pushFeedback(requests, seen, {
        type: "ui_confirm",
        source: "weapon",
        intensity: 1,
        position: actorPosition,
        text: "RELOAD",
        meta: {
          actorId: actor?.id,
          kind: "reload",
        },
      });
      return;
    }

    if (line.includes("SLK//PATCH")) {
      pushFeedback(requests, seen, {
        type: "ui_confirm",
        source: "weapon",
        intensity: 1,
        position: actorPosition,
        text: "PATCH",
        meta: {
          actorId: actor?.id,
          kind: "patch",
        },
      });
      return;
    }

    if (line.includes("SLK//CLUTCH")) {
      pushFeedback(requests, seen, {
        type: "ui_confirm",
        source: "weapon",
        intensity: line.includes("engages") ? 2 : 1,
        position: actorPosition,
        text: line.includes("engages") ? "CLUTCH ON" : "CLUTCH OFF",
        meta: {
          actorId: actor?.id,
          kind: "clutch-toggle",
        },
      });
      return;
    }

    if (line.includes("SLK//VENT")) {
      pushFeedback(requests, seen, {
        type: "warning",
        source: "weapon",
        intensity: /destroyed by the backlash/i.test(line) ? 3 : 2,
        position: actorPosition,
        text: "VENT",
        meta: {
          actorId: actor?.id,
          kind: "vent",
        },
      });
      return;
    }

    if (/CRIT|critical/i.test(line)) {
      pushFeedback(requests, seen, {
        type: "crit",
        source: "battle",
        intensity: 3,
        position: targetPosition ?? actorPosition,
        text: "CRIT",
        meta: {
          actorId: actor?.id,
          targetId: target?.id,
          kind: "crit",
        },
      });
    }
  });
}

export function deriveBattleFeedback(
  previousBattle: BattleState | null | undefined,
  nextBattle: BattleState,
  newLogTail: string[],
): FeedbackRequest[] {
  // Derive juice from battle diffs and live log output so combat state stays unchanged.
  const requests: FeedbackRequest[] = [];
  const seen = new Set<string>();
  const unitIds = new Set<string>([
    ...Object.keys(previousBattle?.units ?? {}),
    ...Object.keys(nextBattle.units),
  ]);

  unitIds.forEach((unitId) => {
    const previousUnit = previousBattle?.units[unitId];
    const nextUnit = nextBattle.units[unitId];
    const anchor = getBattleUnitAnchor(nextUnit) ?? getBattleUnitAnchor(previousUnit);

    if (previousUnit && nextUnit) {
      const hpDelta = nextUnit.hp - previousUnit.hp;
      if (hpDelta < 0) {
        pushFeedback(requests, seen, {
          type: "hit",
          source: "battle",
          intensity: Math.abs(hpDelta) >= 12 ? 2 : 1,
          position: anchor,
          text: `-${Math.abs(hpDelta)}`,
          meta: {
            unitId,
            amount: Math.abs(hpDelta),
            kind: "damage",
          },
        });
      } else if (hpDelta > 0) {
        pushFeedback(requests, seen, {
          type: "heal",
          source: "battle",
          intensity: hpDelta >= 10 ? 2 : 1,
          position: anchor,
          text: `+${hpDelta}`,
          meta: {
            unitId,
            amount: hpDelta,
            kind: "heal",
          },
        });
      }

      if (nextUnit.strain > previousUnit.strain) {
        pushFeedback(requests, seen, {
          type: "strain",
          source: "battle",
          intensity: nextUnit.strain >= BASE_STRAIN_THRESHOLD ? 2 : 1,
          position: anchor,
          text: nextUnit.strain >= BASE_STRAIN_THRESHOLD && previousUnit.strain < BASE_STRAIN_THRESHOLD
            ? "STRAIN LIMIT"
            : `STR +${nextUnit.strain - previousUnit.strain}`,
          audioHook: null,
          meta: {
            unitId,
            amount: nextUnit.strain - previousUnit.strain,
            kind: "strain",
          },
        });
      }

      deriveWeaponFeedback(previousUnit, nextUnit, requests, seen);
    }

    if (!nextUnit && previousUnit?.pos) {
      const targetWasMentioned = newLogTail.some((line) => line.includes(previousUnit.name) && /TARGET OFFLINE|destroyed by the backlash/i.test(line));
      if (targetWasMentioned) {
        pushFeedback(requests, seen, {
          type: "warning",
          source: "battle",
          intensity: 2,
          position: getBattleUnitAnchor(previousUnit),
          text: "DOWN",
          audioHook: null,
          haptic: null,
          meta: {
            unitId,
            kind: "offline",
          },
        });
      }
    }
  });

  deriveLogFeedback(previousBattle, nextBattle, newLogTail, requests, seen);
  return requests;
}

export function resolveBattleFeedbackPositionByUnitName(
  previousBattle: BattleState | null | undefined,
  nextBattle: BattleState,
  unitName: string,
): FeedbackPosition | undefined {
  const unit = getUnitByNameSnapshot(nextBattle, unitName) ?? getUnitByNameSnapshot(previousBattle, unitName);
  return getBattleUnitAnchor(unit);
}

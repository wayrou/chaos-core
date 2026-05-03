import type { FieldEnemy, FieldLootOrb, FieldNpc } from "../types";

export type Haven3DTargetKind = "npc" | "enemy" | "loot-orb";

export interface Haven3DTargetRef {
  kind: Haven3DTargetKind;
  id: string;
  key: string;
}

export interface Haven3DTargetCandidate extends Haven3DTargetRef {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  distance: number;
}

export function createHaven3DTargetKey(kind: Haven3DTargetKind, id: string): string {
  return `${kind}:${id}`;
}

function getTargetKindPriority(kind: Haven3DTargetKind): number {
  switch (kind) {
    case "enemy":
      return 0;
    case "loot-orb":
      return 1;
    case "npc":
    default:
      return 2;
  }
}

function compareHaven3DTargets(left: Haven3DTargetCandidate, right: Haven3DTargetCandidate): number {
  if (left.distance !== right.distance) {
    return left.distance - right.distance;
  }

  if (left.kind !== right.kind) {
    return getTargetKindPriority(left.kind) - getTargetKindPriority(right.kind);
  }

  return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
}

export function createHaven3DTargetCandidates(
  origin: { x: number; y: number } | null | undefined,
  npcs: readonly FieldNpc[] = [],
  enemies: readonly FieldEnemy[] = [],
  lootOrbs: readonly FieldLootOrb[] = [],
): Haven3DTargetCandidate[] {
  if (!origin) {
    return [];
  }

  const npcTargets = npcs.map((npc) => ({
    kind: "npc" as const,
    id: npc.id,
    key: createHaven3DTargetKey("npc", npc.id),
    label: npc.name,
    x: npc.x,
    y: npc.y,
    width: npc.width,
    height: npc.height,
    distance: Math.hypot(npc.x - origin.x, npc.y - origin.y),
  }));

  const enemyTargets = enemies
    .filter((enemy) => enemy.hp > 0)
    .map((enemy) => ({
      kind: "enemy" as const,
      id: enemy.id,
      key: createHaven3DTargetKey("enemy", enemy.id),
      label: enemy.name,
      x: enemy.x,
      y: enemy.y,
      width: enemy.width,
      height: enemy.height,
      distance: Math.hypot(enemy.x - origin.x, enemy.y - origin.y),
    }));

  const lootOrbTargets = lootOrbs.map((orb) => {
    const diameter = Math.max(1, orb.radius * 2);
    return {
      kind: "loot-orb" as const,
      id: orb.id,
      key: createHaven3DTargetKey("loot-orb", orb.id),
      label: orb.sourceEnemyName ? `${orb.sourceEnemyName} Orb` : "Loot Orb",
      x: orb.x,
      y: orb.y,
      width: diameter,
      height: diameter,
      distance: Math.hypot(orb.x - origin.x, orb.y - origin.y),
    };
  });

  return [...enemyTargets, ...lootOrbTargets, ...npcTargets].sort(compareHaven3DTargets);
}

export function selectNextHaven3DTarget(
  targets: readonly Haven3DTargetCandidate[],
  currentTarget: Haven3DTargetRef | null,
  reverse = false,
): Haven3DTargetRef | null {
  if (targets.length === 0) {
    return null;
  }

  const currentIndex = currentTarget
    ? targets.findIndex((target) => target.key === currentTarget.key)
    : -1;
  const direction = reverse ? -1 : 1;
  const nextIndex = currentIndex < 0
    ? reverse ? targets.length - 1 : 0
    : (currentIndex + direction + targets.length) % targets.length;
  const target = targets[nextIndex];

  return {
    kind: target.kind,
    id: target.id,
    key: target.key,
  };
}

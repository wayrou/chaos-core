// ============================================================================
// FIELD SYSTEM - TYPES
// ============================================================================

import type { PlayerId } from "../core/types";

export type FieldMapId = "base_camp" | "free_zone_1" | "free_zone_2" | "quarters" | string; // Allow dynamic key room maps

export interface FieldMap {
  id: FieldMapId;
  name: string;
  width: number;
  height: number;
  tiles: FieldTile[][];
  objects: FieldObject[];
  interactionZones: InteractionZone[];
  metadata?: Record<string, any>;
}

export interface FieldTile {
  x: number;
  y: number;
  walkable: boolean;
  type: "floor" | "wall" | "grass" | "dirt" | "stone";
  elevation?: number;
  standable3d?: boolean;
  render3d?: boolean;
}

export interface FieldObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "station" | "resource" | "enemy" | "door" | "decoration";
  sprite?: string; // Placeholder sprite path
  metadata?: Record<string, any>;
}

export interface InteractionZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  action: "shop" | "workshop" | "roster" | "loadout" | "ops_terminal" | "quest_board" | "tavern" | "gear_workbench" | "port" | "dispatch" | "quarters" | "black_market" | "stable" | "schema" | "foundry-annex" | "comms-array" | "mini_core" | "fcp_test" | "free_zone_entry" | "base_camp_entry" | "custom";
  label: string;
  metadata?: Record<string, any>;
}

export interface PlayerAvatar {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  facing: "north" | "south" | "east" | "west";
  hp?: number;
  maxHp?: number;
  invulnerabilityTime?: number;
  vx?: number;
  vy?: number;
}

export interface FieldNpc {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  state: "idle" | "walk";
  direction: "north" | "south" | "east" | "west";
  path?: { x: number; y: number }[]; // Patrol path
  currentPathIndex?: number;
  dialogueId?: string;
  routeMode?: "fixed" | "random" | "none";
  routePoints?: { id?: string; x: number; y: number }[];
  routePointIndex?: number;
  spawnMapId?: string;
  portraitKey?: string;
  spriteKey?: string;
  portraitPath?: string;
  spritePath?: string;
  stateStartTime: number; // When current state (idle/walk) started
  stateDuration: number; // How long to stay in current state
}

export interface FieldEnemy {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  speed: number;
  facing: "north" | "south" | "east" | "west";
  lastMoveTime: number;
  deathAnimTime?: number;
  vx: number;
  vy: number;
  knockbackTime: number;
  aggroRange: number;
  roamHomeX?: number;
  roamHomeY?: number;
  roamRadius?: number;
  roamSpeedMultiplier?: number;
  roamTargetX?: number;
  roamTargetY?: number;
  nextRoamAt?: number;
  gearbladeDefense?: "shield" | "armor" | "none";
  gearbladeDefenseBroken?: boolean;
  attackStyle?: "slash" | "lunge" | "shot" | "shield_bash";
  attackState?: "windup" | "recovery";
  attackStartedAt?: number;
  attackDidStrike?: boolean;
  attackLungeProgress?: number;
  attackOriginX?: number;
  attackOriginY?: number;
  attackTargetX?: number;
  attackTargetY?: number;
  attackDirectionX?: number;
  attackDirectionY?: number;
  lastAttackAt?: number;
  sourceObjectId?: string;
  sourceDefinitionId?: string;
  spawnKey?: string;
  kind?: string;
  spriteKey?: string;
  spritePath?: string;
  drops?: {
    wad?: number;
    resources?: {
      metalScrap?: number;
      wood?: number;
      chaosShards?: number;
      steamComponents?: number;
    };
    items?: Array<{
      id: string;
      quantity: number;
      chance: number;
    }>;
  };
}

export interface FieldProjectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  lifetime: number;
  maxLifetime: number;
  gearbladeMode?: "launcher";
  hostile?: boolean;
  sourceEnemyId?: string;
  radius?: number;
}

export interface FieldLootOrb {
  id: string;
  x: number;
  y: number;
  radius: number;
  drops?: FieldEnemy["drops"];
  sourceEnemyId?: string;
  sourceEnemyName?: string;
  spawnedAt: number;
  vx?: number;
  vy?: number;
}

export interface FieldCombatState {
  isAttacking: boolean;
  attackCooldown: number;
  attackAnimTime: number;
  isRangedMode: boolean;
  gearbladeMode?: "blade" | "launcher" | "grapple";
  energyCells: number;
  maxEnergyCells: number;
  players?: Partial<Record<PlayerId, FieldPlayerCombatState>>;
}

export interface FieldPlayerCombatState {
  isAttacking: boolean;
  attackCooldown: number;
  attackAnimTime: number;
  isRangedMode: boolean;
  gearbladeMode?: "blade" | "launcher" | "grapple";
  energyCells: number;
  maxEnergyCells: number;
}

export interface FieldState {
  currentMap: FieldMapId;
  player: PlayerAvatar;
  isPaused: boolean;
  activeInteraction: string | null; // ID of active interaction zone
  companion?: import("./companion").Companion; // Sable companion (Headline 15a)
  npcs?: FieldNpc[]; // NPCs for Base Camp (Headline 15b)
  fieldEnemies?: FieldEnemy[];
  combat?: FieldCombatState;
  projectiles?: FieldProjectile[];
  lootOrbs?: FieldLootOrb[];
  collectedResourceObjectIds?: string[];
}

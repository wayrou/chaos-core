import * as THREE from "three";
import type { PlayerId } from "../../core/types";
import type { WeaponsmithUtilityItemId } from "../../core/weaponsmith";
import {
  getPlayerInput,
  handleKeyDown as handlePlayerInputKeyDown,
  handleKeyUp as handlePlayerInputKeyUp,
  isPlayerInputActionEvent,
} from "../../core/playerInput";
import type {
  FieldEnemy,
  FieldLootOrb,
  FieldMap,
  FieldNpc,
  FieldObject,
  FieldPlayerCombatState,
  FieldProjectile,
  PlayerAvatar,
} from "../types";
import type { Companion } from "../companion";
import {
  HAVEN3D_FIELD_TILE_SIZE,
  HAVEN3D_WORLD_TILE_SIZE,
  createHaven3DSceneLayout,
  fieldFacingFromDelta,
  fieldToHavenWorld,
  getFieldPointElevationWorld,
  type Haven3DGearbladeMode,
  type Haven3DModeController,
  type Haven3DSceneObjectPlacement,
} from "./coordinates";
import { createHaven3DModeController } from "./modes";
import {
  createHaven3DTargetCandidates,
  selectNextHaven3DTarget,
  type Haven3DTargetCandidate,
  type Haven3DTargetKind,
  type Haven3DTargetRef,
} from "./targeting";
import {
  GEARBLADE_MODE_SELECTOR_DESTINATIONS,
  GEARBLADE_MODE_UI,
  type GearbladeModeSelectorHotspot,
} from "../gearbladeModeUi";
import { getHaven3DEnemyDefense, isHaven3DEnemyDefenseBroken } from "./combatRules";
import { getHaven3DEnemyAttackProfile } from "./enemyMoves";
import {
  ARDYCIA_TOON_OUTLINE_SCALE,
  addInvertedHullOutlines,
  applyArdyciaToonRendererStyle,
  applyArdyciaToonSceneStyle,
  createArdyciaToonMaterial,
  createInvertedHullOutlineMaterial,
} from "../../ui/threeToonStyle";

type FieldAvatarView = {
  x: number;
  y: number;
  facing: PlayerAvatar["facing"];
};

type Actor = {
  group: THREE.Group;
  chibi?: ChibiRig;
  sable?: SableRig;
  motion?: ActorMotionState;
  label?: THREE.Sprite;
  targetRing?: THREE.Object3D;
  blade?: THREE.Group;
  bladeTrail?: THREE.Object3D;
  weaponBladeForm?: THREE.Object3D;
  weaponLauncherForm?: THREE.Object3D;
  telegraph?: THREE.Object3D;
  defenseShield?: THREE.Object3D;
  defenseArmor?: THREE.Object3D;
  hitMaterials?: ReactiveMaterial[];
};

type ChibiRig = {
  root: THREE.Group;
  torso: THREE.Object3D;
  pelvis: THREE.Object3D;
  head: THREE.Object3D;
  leftUpperArm: THREE.Object3D;
  rightShoulderPivot: THREE.Object3D;
  rightUpperArm: THREE.Object3D;
  leftForearm: THREE.Object3D;
  rightForearm: THREE.Object3D;
  rightHandMount: THREE.Object3D;
  rightHand: THREE.Object3D;
  leftThigh: THREE.Object3D;
  rightThigh: THREE.Object3D;
  leftShin: THREE.Object3D;
  rightShin: THREE.Object3D;
  leftFoot: THREE.Object3D;
  rightFoot: THREE.Object3D;
  cape?: THREE.Object3D;
  leftCapePanel?: THREE.Object3D;
  rightCapePanel?: THREE.Object3D;
  glider?: THREE.Object3D;
};

type SableRig = {
  root: THREE.Group;
  body: THREE.Object3D;
  chest: THREE.Object3D;
  head: THREE.Object3D;
  snout: THREE.Object3D;
  tail: THREE.Object3D;
  frontLeftLeg: THREE.Object3D;
  frontRightLeg: THREE.Object3D;
  rearLeftLeg: THREE.Object3D;
  rearRightLeg: THREE.Object3D;
};

type ActorMotionState = {
  lastX: number;
  lastY: number;
  lastTime: number;
  cycle: number;
  visualYaw: number;
  speedPxPerSecond: number;
  moving: boolean;
  dashActive?: boolean;
  dashBurstStartedAt?: number;
  footDustStep?: number;
  footstepSoundStep?: number;
};

type Haven3DBladeStrike = {
  playerId: PlayerId;
  x: number;
  y: number;
  facing: PlayerAvatar["facing"];
  directionX: number;
  directionY: number;
  hiltX: number;
  hiltY: number;
  tipX: number;
  tipY: number;
  bladeHalfWidth: number;
  target: Haven3DTargetRef | null;
  radius: number;
  arcRadians: number;
  damage: number;
  knockback: number;
};

type Haven3DLauncherImpact = {
  playerId: PlayerId;
  x: number;
  y: number;
  target: Haven3DTargetRef | null;
  radius: number;
  damage: number;
  knockback: number;
};

type Haven3DLauncherFire = {
  playerId: PlayerId;
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  target: Haven3DTargetRef | null;
};

type Haven3DGrappleImpact = {
  playerId: PlayerId;
  x: number;
  y: number;
  target: Haven3DTargetRef;
  damage: number;
  knockback: number;
};

type Haven3DGrappleKind = "target" | "anchor" | "zipline";

type Haven3DGrappleFireSwing = {
  durationMs: number;
  arcHeight: number;
};

type Haven3DGrappleFireZipline = {
  segmentKey: string;
  startX: number;
  startY: number;
  startHeight: number;
  attachX: number;
  attachY: number;
  attachHeight: number;
  attachT: number;
  endX: number;
  endY: number;
  endHeight: number;
  endT: 0 | 1;
  attachDurationMs: number;
  rideDurationMs: number;
};

type Haven3DGrappleFire = {
  playerId: PlayerId;
  x: number;
  y: number;
  target: Haven3DTargetRef | null;
  targetX: number;
  targetY: number;
  targetHeight: number;
  grappleKind: Haven3DGrappleKind;
  swing?: Haven3DGrappleFireSwing;
  zipline?: Haven3DGrappleFireZipline;
};

type BladeSwingComboStep = 0 | 1 | 2;

type BladeSwingState = {
  startedAt: number;
  struck: boolean;
  target: Haven3DTargetRef | null;
  direction: { x: number; y: number };
  side: 1 | -1;
  comboStep: BladeSwingComboStep;
  visualOnly?: boolean;
};

type BladeSwingPose = {
  localYaw: number;
  slashPulse: number;
  hiltForwardPx: number;
  hiltSidePx: number;
  bladeDirection: { x: number; y: number };
  hilt: { x: number; y: number };
  tip: { x: number; y: number };
};

type BladeSwingWeaponPose = {
  hiltX: number;
  hiltY: number;
  hiltZ: number;
  bladePitch: number;
  bladeYaw: number;
  bladeRoll: number;
  swingProgress: number;
  slashPulse: number;
  rightEdgeExtension: number;
};

type GearbladeTransformState = {
  from: Haven3DGearbladeMode;
  to: Haven3DGearbladeMode;
  startedAt: number;
  durationMs: number;
};

type GearbladeTransformSnapshot = GearbladeTransformState & {
  t: number;
  eased: number;
  pulse: number;
};

type LauncherProjectile = {
  playerId: PlayerId;
  mesh: THREE.Object3D;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttlMs: number;
  target: Haven3DTargetRef | null;
  radius: number;
  damage: number;
  knockback: number;
  visualOnly?: boolean;
};

type PlayerVerticalState = {
  elevation: number;
  velocity: number;
  grounded: boolean;
  gliding: boolean;
  airborneDashLocked: boolean;
  gliderDeployedAt: number;
  jumpStartedAt: number;
  jumpFlipDirection: 1 | -1;
  groundElevation: number;
  worldElevation: number;
  lastAirborneAt: number;
};

type CompanionVerticalState = {
  elevation: number;
  velocity: number;
  grounded: boolean;
  groundElevation: number;
  worldElevation: number;
  jumpStartedAt: number;
  lastJumpAt: number;
  lastX: number;
  lastY: number;
  lastTime: number;
};

type ZiplineDismountDrift = {
  playerId: PlayerId;
  vx: number;
  vy: number;
  startedAt: number;
  durationMs: number;
};

type FinishGrappleMoveOptions = {
  preserveAirborne?: boolean;
};

type GrappleAnchor = {
  id: string;
  key: string;
  label: string;
  x: number;
  y: number;
  height: number;
  group: THREE.Group;
  phase: number;
  routeId?: string;
  routeIndex?: number;
  connectedAnchorIds: string[];
};

type GrappleSourcePoint = {
  id: string;
  label: string;
  fieldCenter: { x: number; y: number };
  height: number;
  routeId?: string;
  routeIndex?: number;
  connectedAnchorIds?: string[];
};

type ZiplineEndpoint = {
  fieldPoint: { x: number; y: number };
  height: number;
};

type ZiplineTrackEndpoints = {
  start: ZiplineEndpoint;
  end: ZiplineEndpoint;
};

type GrappleZiplineSegment = {
  id: string;
  key: string;
  routeId?: string;
  startAnchorId?: string;
  endAnchorId?: string;
  start: ZiplineEndpoint;
  end: ZiplineEndpoint;
  length: number;
  directionX: number;
  directionY: number;
};

type GrappleZiplineTarget = {
  segment: GrappleZiplineSegment;
  attachPoint: { x: number; y: number };
  attachHeight: number;
  attachT: number;
  endPoint: { x: number; y: number };
  endHeight: number;
  endT: 0 | 1;
};

type GrappleAnchorState = {
  id: string;
  key: string;
  x: number;
  y: number;
  routeId: string | null;
  routeIndex: number | null;
  connectedAnchorIds: string[];
};

type GrappleAnchorTargetRef = {
  kind: "grapple-node";
  id: string;
  key: string;
};

type GrappleZiplineTargetRef = {
  kind: "zipline-track";
  id: string;
  key: string;
};

type GrindRailTargetRef = {
  kind: "grind-rail";
  id: string;
  key: string;
};

type GrappleMoveState = {
  playerId: PlayerId;
  startedAt: number;
  target: Haven3DTargetRef | GrappleAnchorTargetRef | GrappleZiplineTargetRef;
  targetPoint: { x: number; y: number };
  targetHeight: number;
  impacted: boolean;
  line: THREE.Line;
  hook: THREE.Mesh;
  visualOnly?: boolean;
  swing?: {
    startX: number;
    startY: number;
    durationMs: number;
    arcHeight: number;
  };
  zipline?: {
    segmentKey: string;
    startX: number;
    startY: number;
    startHeight: number;
    attachX: number;
    attachY: number;
    attachHeight: number;
    attachT: number;
    endX: number;
    endY: number;
    endHeight: number;
    endT: 0 | 1;
    attachDurationMs: number;
    rideDurationMs: number;
  };
};

type GrindRailSegment = {
  id: string;
  key: string;
  routeId?: string;
  segmentIndex: number;
  nextSegmentIndex?: number;
  launchAtEnd: boolean;
  start: ZiplineEndpoint;
  end: ZiplineEndpoint;
  length: number;
  directionX: number;
  directionY: number;
};

type GrindRailAttachCandidate = {
  segment: GrindRailSegment;
  attachT: number;
  attachPoint: { x: number; y: number };
  attachHeight: number;
  direction: 1 | -1;
  score: number;
};

type RailRideState = {
  playerId: PlayerId;
  startedAt: number;
  segmentKey: string;
  routeId?: string;
  segmentIndex: number;
  direction: 1 | -1;
  t: number;
  speedPxPerSecond: number;
  previousMode: Haven3DGearbladeMode | null;
  lastSparkAt: number;
};

type RailRideSnapshot = {
  playerId: PlayerId;
  segmentKey: string;
  routeId?: string;
  segmentIndex: number;
  direction: 1 | -1;
  t: number;
  speedPxPerSecond: number;
  previousMode: Haven3DGearbladeMode | null;
  lastSparkAt: number;
};

type LinkedGrindRailSegmentResult = {
  segmentKey: string;
  direction: 1 | -1;
};

type ReactiveMaterial = {
  material: THREE.MeshToonMaterial;
  baseEmissive: number;
  baseIntensity: number;
};

type EnemyHitReaction = {
  startedAt: number;
  durationMs: number;
};

type VisualEffect = {
  object: THREE.Object3D;
  startedAt: number;
  durationMs: number;
  velocity: THREE.Vector3;
  spin?: number;
  baseScale?: THREE.Vector3;
  opacity?: number;
  scaleGrowth?: number;
  channel?: string;
};

type CameraYawPan = {
  startedAt: number;
  durationMs: number;
  fromYaw: number;
  toYaw: number;
};

export type Haven3DFieldCameraMode = "shared" | "split";
export type Haven3DFieldCameraBehavior = "shared" | "hybrid";

export type Haven3DFieldCameraViewState = {
  yaw: number;
  pitch: number;
  distance: number;
};

export type Haven3DFieldCameraState = {
  mode: Haven3DFieldCameraMode;
  behavior: Haven3DFieldCameraBehavior;
  shared: Haven3DFieldCameraViewState;
  split: Record<PlayerId, Haven3DFieldCameraViewState>;
};

type Haven3DMapCameraProfile = {
  defaultPitch: number;
  defaultDistance: number;
  minDistance: number;
  maxDistance: number;
  heightOffset: number;
  farMin: number;
  farScale: number;
  lockedBaseDistance: number;
  lockedTargetScale: number;
  lockedTargetAddMax: number;
  lockedMinDistance: number;
  lockedMaxDistance: number;
};

type Haven3DMapSceneProfile = {
  fogColor: number;
  fogDensity: number;
  hemisphereIntensity?: number;
  sunIntensity?: number;
  fillIntensity?: number;
  rimIntensity?: number;
};

type Haven3DMapProfile = {
  camera: Haven3DMapCameraProfile;
  scene: Haven3DMapSceneProfile;
};

export function projectPointOntoGrindRailSegment(
  point: { x: number; y: number },
  segment: Pick<GrindRailSegment, "start" | "end" | "length">,
): { t: number; point: { x: number; y: number }; distancePx: number; height: number } {
  const dx = segment.end.fieldPoint.x - segment.start.fieldPoint.x;
  const dy = segment.end.fieldPoint.y - segment.start.fieldPoint.y;
  const lengthSquared = Math.max(0.001, (dx * dx) + (dy * dy));
  const t = THREE.MathUtils.clamp(
    (((point.x - segment.start.fieldPoint.x) * dx) + ((point.y - segment.start.fieldPoint.y) * dy)) / lengthSquared,
    0,
    1,
  );
  const closestPoint = {
    x: segment.start.fieldPoint.x + (dx * t),
    y: segment.start.fieldPoint.y + (dy * t),
  };
  return {
    t,
    point: closestPoint,
    distancePx: Math.hypot(point.x - closestPoint.x, point.y - closestPoint.y),
    height: THREE.MathUtils.lerp(segment.start.height, segment.end.height, t),
  };
}

export function resolveGrindRailDirectionFromVector(
  segment: Pick<GrindRailSegment, "directionX" | "directionY">,
  vector: { x: number; y: number } | null,
  fallbackFacing: PlayerAvatar["facing"] = "south",
): 1 | -1 {
  const fallbackVector = (() => {
    switch (fallbackFacing) {
      case "north":
        return { x: 0, y: -1 };
      case "south":
        return { x: 0, y: 1 };
      case "east":
        return { x: 1, y: 0 };
      case "west":
        return { x: -1, y: 0 };
      default:
        return { x: 0, y: 1 };
    }
  })();
  const source = vector && Math.hypot(vector.x, vector.y) > 0.001 ? vector : fallbackVector;
  const alignment = (source.x * segment.directionX) + (source.y * segment.directionY);
  return alignment >= 0 ? 1 : -1;
}

export function resolveLinkedGrindRailSegment(
  activeSegment: Pick<GrindRailSegment, "routeId" | "segmentIndex" | "nextSegmentIndex" | "start" | "end">,
  activeDirection: 1 | -1,
  segments: ReadonlyMap<string, GrindRailSegment>,
): LinkedGrindRailSegmentResult | null {
  const activeEndpoint = activeDirection > 0 ? activeSegment.end.fieldPoint : activeSegment.start.fieldPoint;
  const targetIndex = activeDirection > 0
    ? activeSegment.nextSegmentIndex
    : null;
  if (activeDirection > 0 && activeSegment.routeId && Number.isFinite(Number(targetIndex))) {
    for (const [segmentKey, segment] of segments.entries()) {
      if (segment.routeId !== activeSegment.routeId || segment.segmentIndex !== targetIndex) {
        continue;
      }
      const startDistance = Math.hypot(segment.start.fieldPoint.x - activeEndpoint.x, segment.start.fieldPoint.y - activeEndpoint.y);
      if (startDistance <= 6) {
        return { segmentKey, direction: 1 };
      }
      const endDistance = Math.hypot(segment.end.fieldPoint.x - activeEndpoint.x, segment.end.fieldPoint.y - activeEndpoint.y);
      if (endDistance <= 6) {
        return { segmentKey, direction: -1 };
      }
    }
  }

  if (!activeSegment.routeId || activeDirection > 0) {
    return null;
  }

  for (const [segmentKey, segment] of segments.entries()) {
    if (segment.routeId !== activeSegment.routeId || segment.nextSegmentIndex !== activeSegment.segmentIndex) {
      continue;
    }
    const startDistance = Math.hypot(segment.start.fieldPoint.x - activeEndpoint.x, segment.start.fieldPoint.y - activeEndpoint.y);
    if (startDistance <= 6) {
      return { segmentKey, direction: 1 };
    }
    const endDistance = Math.hypot(segment.end.fieldPoint.x - activeEndpoint.x, segment.end.fieldPoint.y - activeEndpoint.y);
    if (endDistance <= 6) {
      return { segmentKey, direction: -1 };
    }
  }

  return null;
}

type HavenBuildingPalette = {
  wall: number;
  roof: number;
  trim: number;
  door: number;
  glow?: number;
};

type Haven3DFieldControllerOptions = {
  host: HTMLElement;
  map: FieldMap;
  initialCameraState?: Haven3DFieldCameraState | null;
  initialPlayerCombatStates?: Partial<Record<PlayerId, FieldPlayerCombatState>>;
  getNpcs: () => FieldNpc[];
  getEnemies: () => FieldEnemy[];
  getFieldProjectiles?: () => FieldProjectile[];
  getLootOrbs?: () => FieldLootOrb[];
  getCompanion?: () => Companion | null | undefined;
  getPlayerAvatar: (playerId: PlayerId) => FieldAvatarView | null;
  isPlayerActive: (playerId: PlayerId) => boolean;
  isPlayerControllable?: (playerId: PlayerId) => boolean;
  isPaused: () => boolean;
  setPlayerAvatar: (playerId: PlayerId, x: number, y: number, facing: PlayerAvatar["facing"]) => void;
  constrainPlayerPosition?: (
    playerId: PlayerId,
    desired: FieldAvatarView,
    previous: FieldAvatarView,
  ) => FieldAvatarView;
  getPrompt: () => string | null;
  getPlayerPrompt?: (playerId: PlayerId) => string | null;
  onInteractPressed: (playerId: PlayerId) => void;
  onOpenMenu: () => void;
  onFrame: (deltaMs: number, currentTime: number) => void;
  isFieldObjectVisible?: (objectId: string, object?: FieldObject) => boolean;
  onPlayerFootstep?: (playerId: PlayerId, side: "left" | "right", speedRatio: number) => void;
  onBladeSwingStart?: (swing: {
    playerId: PlayerId;
    x: number;
    y: number;
    facing: PlayerAvatar["facing"];
    directionX: number;
    directionY: number;
    target: Haven3DTargetRef | null;
    comboStep: BladeSwingComboStep;
  }) => void;
  onBladeStrike?: (strike: Haven3DBladeStrike) => boolean;
  onLauncherFire?: (fire: Haven3DLauncherFire) => boolean;
  onGrappleFire?: (fire: Haven3DGrappleFire) => void;
  onLauncherImpact?: (impact: Haven3DLauncherImpact) => boolean;
  onGrappleImpact?: (impact: Haven3DGrappleImpact) => boolean;
  canUseGlider?: (playerId: PlayerId) => boolean;
  hasApronUtility?: (playerId: PlayerId, utilityItemId: WeaponsmithUtilityItemId) => boolean;
  enableGearbladeModes?: boolean;
  enabledGearbladeModes?: readonly Haven3DGearbladeMode[];
};

const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 32;
const PLAYER_SPEED_PX_PER_SECOND = 347.5;
const DASH_MULTIPLIER = 2.475;
const CAMERA_MIN_PITCH = -0.38;
const CAMERA_MAX_PITCH = 0.62;
const CAMERA_DEFAULT_DISTANCE = 8.8;
const CAMERA_MIN_DISTANCE = 5.4;
const CAMERA_MAX_DISTANCE = 15.5;
const CAMERA_FOLLOW_ELEVATION_LERP_BASE = 0.00005;
const HYBRID_CAMERA_SPLIT_ENTER_DISTANCE_PX = HAVEN3D_FIELD_TILE_SIZE * 4.25;
const HYBRID_CAMERA_SPLIT_EXIT_DISTANCE_PX = HAVEN3D_FIELD_TILE_SIZE * 3.25;
const LAUNCHER_CAMERA_MIN_PITCH = -0.24;
const LAUNCHER_CAMERA_MAX_PITCH = 0.12;
const LAUNCHER_CAMERA_DEFAULT_PITCH = 0;
const LAUNCHER_CAMERA_DISTANCE_MIN = 4.9;
const LAUNCHER_CAMERA_DISTANCE_MAX = 7.2;
const LAUNCHER_CAMERA_FOCUS_AHEAD = 24;
const LAUNCHER_CAMERA_SHOULDER_OFFSET = 1.08;
const LAUNCHER_CAMERA_HEIGHT_OFFSET = 0.92;
const LAUNCHER_CAMERA_ANCHOR_LIFT = 0.16;
const LAUNCHER_CAMERA_LOOK_LIFT = 0.18;
const LAUNCHER_CAMERA_LOCKED_LOOK_LIFT = 0.34;
const HAVEN3D_BASE_MAP_PROFILE: Haven3DMapProfile = {
  camera: {
    defaultPitch: 0.24,
    defaultDistance: 12.6,
    minDistance: CAMERA_MIN_DISTANCE,
    maxDistance: 24,
    heightOffset: 3.45,
    farMin: 420,
    farScale: 1.55,
    lockedBaseDistance: 7.4,
    lockedTargetScale: 0.22,
    lockedTargetAddMax: 4.5,
    lockedMinDistance: CAMERA_MIN_DISTANCE,
    lockedMaxDistance: 13.6,
  },
  scene: {
    fogColor: 0x17211e,
    fogDensity: 0.0125,
  },
};
const HAVEN3D_OUTER_DECK_OVERWORLD_PROFILE: Haven3DMapProfile = {
  camera: {
    defaultPitch: 0.28,
    defaultDistance: 13.2,
    minDistance: 8.2,
    maxDistance: 24,
    heightOffset: 4.35,
    farMin: 1800,
    farScale: 4.2,
    lockedBaseDistance: 9.2,
    lockedTargetScale: 0.18,
    lockedTargetAddMax: 5.5,
    lockedMinDistance: 7.4,
    lockedMaxDistance: 16.2,
  },
  scene: {
    fogColor: 0x020915,
    fogDensity: 0.0155,
    hemisphereIntensity: 0.16,
    sunIntensity: 0.62,
    fillIntensity: 0.22,
    rimIntensity: 1.42,
  },
};
const HAVEN_SKYLINE_TRACKS_GROUP_NAME = "HavenSkylineTracks";
const OUTER_DECK_HAVEN_LANDMARK = {
  worldX: -40,
  worldY: -48,
  width: 84,
  height: 52,
  visualHeightWorld: 10.8,
  skylineTrackHeightWorld: 320,
  maxTrueDistanceWorld: 720,
  minScale: 0.56,
};
const HAVEN3D_OUTER_DECK_BRANCH_PROFILE: Haven3DMapProfile = {
  camera: {
    defaultPitch: 0.22,
    defaultDistance: 9.4,
    minDistance: 5.8,
    maxDistance: 16.5,
    heightOffset: 2.95,
    farMin: 280,
    farScale: 1.5,
    lockedBaseDistance: 7.1,
    lockedTargetScale: 0.2,
    lockedTargetAddMax: 4.2,
    lockedMinDistance: 5.8,
    lockedMaxDistance: 12.4,
  },
  scene: {
    fogColor: 0x030914,
    fogDensity: 0.024,
    hemisphereIntensity: 0.18,
    sunIntensity: 0.66,
    fillIntensity: 0.24,
    rimIntensity: 1.36,
  },
};
const CAMERA_FORWARD_PAN_DURATION_MS = 260;
const BLADE_SWING_WINDUP_MS = 116;
const BLADE_SWING_IMPACT_MS = 195;
const BLADE_SWING_TOTAL_MS = 390;
const BLADE_SWING_ARC_START_MS = 32;
const BLADE_SWING_ARC_END_MS = 346;
const BLADE_COMBO_RESET_MS = 980;
const BLADE_SWING_RANGE_PX = 156;
const BLADE_SWING_ARC_RADIANS = Math.PI * 1.86;
const BLADE_SWING_HIT_WIDTH_PX = 38;
const BLADE_SWING_START_LOCAL_YAW = 1.62;
const BLADE_SWING_END_LOCAL_YAW = -1.52;
const BLADE_SWING_BLADE_LENGTH_PX = 118;
const BLADE_SWING_HILT_FORWARD_PX = 34;
const BLADE_SWING_HILT_SIDE_START_PX = 58;
const BLADE_SWING_HILT_SIDE_END_PX = -52;
const BLADE_DRAW_SMEAR_MS = 92;
const BLADE_SWING_DAMAGE = 38;
const BLADE_SWING_KNOCKBACK = 620;
const BLADE_LUNGE_START_MS = 128;
const BLADE_LUNGE_END_MS = 232;
const BLADE_LUNGE_SPEED_PX_PER_SECOND = 360;
const LAUNCHER_COOLDOWN_MS = 360;
const LAUNCHER_RECOIL_MS = 160;
const LAUNCHER_SPEED_PX_PER_SECOND = 780;
const LAUNCHER_RANGE_PX = 620;
const LAUNCHER_HIT_RADIUS_PX = 42;
const LAUNCHER_DAMAGE = 26;
const LAUNCHER_KNOCKBACK = 440;
const GRAPPLE_COOLDOWN_MS = 520;
const GRAPPLE_RANGE_PX = 430;
const GRAPPLE_STOP_DISTANCE_PX = 54;
const GRAPPLE_PULL_SPEED_PX_PER_SECOND = 670;
const GRAPPLE_MAX_DURATION_MS = 860;
const GRAPPLE_DAMAGE = 14;
const GRAPPLE_KNOCKBACK = 520;
const GRAPPLE_SWING_DURATION_MS = 760;
const GRAPPLE_SWING_ARC_HEIGHT = 2.65;
const GRAPPLE_NODE_HEIGHT = 3.35;
const GRAPPLE_NODE_MAX_COUNT = 24;
const GRAPPLE_ROUTE_HANDOFF_DISTANCE_PX = 152;
const GRAPPLE_ROUTE_DIRECT_RANGE_PX = GRAPPLE_RANGE_PX * 1.72;
const GRAPPLE_ROUTE_LINK_RANGE_PX = HAVEN3D_FIELD_TILE_SIZE * 54;
const GRAPPLE_ROUTE_MIN_TARGET_DISTANCE_PX = 46;
const GRAPPLE_ZIPLINE_ATTACH_RANGE_PX = GRAPPLE_RANGE_PX * 1.16;
const GRAPPLE_ZIPLINE_CLOSE_ATTACH_RADIUS_PX = 132;
const GRAPPLE_ZIPLINE_MAX_AIM_OFFSET_PX = 176;
const GRAPPLE_ZIPLINE_RIDE_SPEED_PX_PER_SECOND = 980;
const GRAPPLE_ZIPLINE_MIN_ATTACH_DURATION_MS = 120;
const GRAPPLE_ZIPLINE_MAX_ATTACH_DURATION_MS = 300;
const GRAPPLE_ZIPLINE_MIN_RIDE_DURATION_MS = 340;
const GRAPPLE_ZIPLINE_MAX_RIDE_DURATION_MS = 2850;
const GRAPPLE_ZIPLINE_RIDER_HAND_OFFSET_WORLD = 1.88;
const GRAPPLE_ZIPLINE_DISMOUNT_SPEED_PX_PER_SECOND = 720;
const GRAPPLE_ZIPLINE_DISMOUNT_DURATION_MS = 620;
const GRAPPLE_ZIPLINE_DISMOUNT_UPWARD_VELOCITY = 0.55;
const GRAPPLE_ZIPLINE_DISMOUNT_MIN_FLIP_VELOCITY = 1.15;
const GRIND_RAIL_ATTACH_RANGE_PX = 44;
const GRIND_RAIL_ATTACH_HEIGHT_TOLERANCE_WORLD = 1.08;
const GRIND_RAIL_APPROACH_TRAVEL_DEADZONE_PX = 8;
const GRIND_RAIL_INPUT_ALIGNMENT_THRESHOLD = 0.68;
const GRIND_RAIL_FACING_ALIGNMENT_THRESHOLD = 0.84;
const GRIND_RAIL_FIXED_SPEED_PX_PER_SECOND = 940;
const GRIND_RAIL_END_LAUNCH_SPEED_PX_PER_SECOND = 780;
const GRIND_RAIL_END_LAUNCH_UPWARD_VELOCITY = 0.96;
const GRIND_RAIL_JUMP_OFF_SPEED_PX_PER_SECOND = 710;
const GRIND_RAIL_JUMP_OFF_UPWARD_VELOCITY = 3.75;
const GRIND_RAIL_ATTACH_COOLDOWN_MS = 220;
const GRIND_RAIL_AIRBORNE_GRACE_MS = 110;
const GRIND_RAIL_SPARK_INTERVAL_MS = 56;
const GRIND_RAIL_CAMERA_YAW_BIAS_STRENGTH = 0.22;
const GRIND_RAIL_CAMERA_FOCUS_AHEAD = 1.28;
const PLAYER_JUMP_HEIGHT_MULTIPLIER = 5;
const PLAYER_JUMP_VELOCITY = 5.1 * Math.sqrt(PLAYER_JUMP_HEIGHT_MULTIPLIER);
const PLAYER_COUNTERWEIGHT_BOOTS_JUMP_VELOCITY_MULTIPLIER = 1.18;
const PLAYER_JUMP_GRAVITY = 15.2;
const PLAYER_JUMP_FRONT_FLIP_DELAY_MS = 40;
const PLAYER_JUMP_FRONT_FLIP_DURATION_MS = 360;
const PLAYER_GLIDER_MIN_DEPLOY_ELEVATION = 0.42;
const PLAYER_GLIDER_DEPLOY_MAX_UPWARD_VELOCITY = 0.72;
const PLAYER_GLIDER_GRAVITY = 2.65;
const PLAYER_GLIDER_DESCENT_VELOCITY = -1.18;
const PLAYER_GLIDER_MOVEMENT_MULTIPLIER = 1.16;
const PLAYER_LEDGE_DROP_WORLD_THRESHOLD = 0.18;
const PLAYER_STANDABLE_SURFACE_ENTRY_WORLD_BUFFER = 0.28;
const PLAYER_GROUNDED_STEP_UP_WORLD_THRESHOLD = 0.36;
const ENEMY_HIT_REACTION_MS = 320;
const ENEMY_TELEGRAPH_RANGE_PX = 118;
const ENEMY_DANGER_RANGE_PX = 58;
const TARGET_LOCK_BREAK_DISTANCE_PX = 540;
const LOOT_ORB_TARGET_RING_NAME = "Haven3DLootOrbTargetRing";
const LOOT_ORB_VISUAL_NAME = "Haven3DLootOrbVisual";
const LOOT_ORB_CORE_NAME = "Haven3DLootOrbCore";
const LOOT_ORB_SHELL_NAME = "Haven3DLootOrbShell";
const LOOT_ORB_RING_NAME = "Haven3DLootOrbRing";
const LOOT_ORB_SPARKLE_NAME = "Haven3DLootOrbSparkle";
const IMPACT_HITSTOP_MS = 64;
const RUN_DUST_MIN_SPEED_RATIO = 1.12;
const RUN_DUST_STEP_OFFSET_PX = 11;
const RUN_DUST_TRAIL_OFFSET_PX = 14;
const DASH_BURST_POSE_MS = 160;
const GEARBLADE_TRANSFORM_MS = 520;
const BLADE_BACK_POSITION = new THREE.Vector3(-0.22, 1.3, -0.26);
const BLADE_BACK_ROTATION = new THREE.Euler(Math.PI / 2, 0.58, -0.48);
const BLADE_GRIP_CENTER_LOCAL_Z = -0.16;
const BLADE_SWING_WRIST_TO_GRIP = 0.065;
const BLADE_SWING_WRIST_DROP_FROM_GRIP = 0.012;
const PLAYER_RIGHT_HAND_LOCAL_X = -1;
const BLADE_TARGET_READY_HILT_X = 0.58 * PLAYER_RIGHT_HAND_LOCAL_X;
const BLADE_TARGET_READY_HILT_Y = 0.84;
const BLADE_TARGET_READY_HILT_Z = 0.14;
const BLADE_TARGET_READY_PITCH = -Math.PI / 2 + 0.05;
const BLADE_TARGET_READY_YAW = 0.22 * PLAYER_RIGHT_HAND_LOCAL_X;
const BLADE_TARGET_READY_ROLL = -0.3 * PLAYER_RIGHT_HAND_LOCAL_X;
const LAUNCHER_READY_GRIP_X = 0.28 * PLAYER_RIGHT_HAND_LOCAL_X;
const LAUNCHER_READY_GRIP_Y = 0.76;
const LAUNCHER_READY_GRIP_Z = 0.28;
const SABLE_SPRINT_SPEED_RATIO_START = 1.1;
const SABLE_SPRINT_SPEED_RATIO_SPAN = 0.42;
const SABLE_JUMP_VELOCITY = 4.65;
const SABLE_STEP_HOP_VELOCITY = 3.35;
const SABLE_JUMP_GRAVITY = 12.8;
const SABLE_LEDGE_DROP_WORLD_THRESHOLD = 0.14;
const SABLE_STEP_HOP_WORLD_THRESHOLD = 0.16;
const SABLE_STEP_HOP_MIN_SPEED_PX = 42;
const SABLE_JUMP_COOLDOWN_MS = 360;
const ENEMY_PING_HEIGHT = 3.36;
const TERRAIN_BASE_Y = -0.34;
const TERRAIN_TILE_OVERLAP = 1.035;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target.isContentEditable
    || Boolean(target.closest(".field-pinned-overlay"))
    || Boolean(target.closest(".network-lobby-overlay"))
    || Boolean(target.closest("#dialoguePanel"))
  );
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }

  material.dispose();
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((node) => {
    if (node instanceof THREE.Mesh || node instanceof THREE.Sprite || node instanceof THREE.InstancedMesh || node instanceof THREE.Line) {
      node.geometry?.dispose();
      if ("material" in node && node.material) {
        disposeMaterial(node.material as THREE.Material | THREE.Material[]);
      }
    }
  });
}

function createLabelSprite(text: string, options: { accent?: string; width?: number } = {}): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = options.width ?? 384;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(13, 16, 15, 0.74)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = options.accent ?? "rgba(234, 190, 116, 0.72)";
    context.lineWidth = 4;
    context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    context.font = "700 28px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#f5ead2";
    context.fillText(text.slice(0, 28), canvas.width / 2, canvas.height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.55, 0.64, 1);
  sprite.renderOrder = 15;
  return sprite;
}

function createCombatPingSprite(
  title: string,
  detail: string | null,
  tone: "info" | "warning" | "success" | "danger",
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 132;
  const context = canvas.getContext("2d");
  const palette = {
    info: { stroke: "rgba(102, 219, 201, 0.72)", glow: "rgba(102, 219, 201, 0.24)", title: "#f5ead2", detail: "#8ad8c6" },
    warning: { stroke: "rgba(242, 176, 77, 0.82)", glow: "rgba(242, 176, 77, 0.28)", title: "#fff2cf", detail: "#f2b04d" },
    success: { stroke: "rgba(130, 230, 157, 0.78)", glow: "rgba(130, 230, 157, 0.24)", title: "#f1ffe8", detail: "#82e69d" },
    danger: { stroke: "rgba(255, 119, 93, 0.82)", glow: "rgba(255, 119, 93, 0.3)", title: "#fff0e8", detail: "#ff9a79" },
  }[tone];

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.shadowColor = palette.glow;
    context.shadowBlur = 18;
    context.fillStyle = "rgba(13, 16, 15, 0.84)";
    context.fillRect(8, 10, canvas.width - 16, canvas.height - 20);
    context.shadowBlur = 0;
    context.strokeStyle = palette.stroke;
    context.lineWidth = 4;
    context.strokeRect(10, 12, canvas.width - 20, canvas.height - 24);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "800 30px sans-serif";
    context.fillStyle = palette.title;
    context.fillText(title.toUpperCase().slice(0, 24), canvas.width / 2, detail ? 48 : 66);
    if (detail) {
      context.font = "700 20px sans-serif";
      context.fillStyle = palette.detail;
      context.fillText(detail.toUpperCase().slice(0, 34), canvas.width / 2, 88);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.96,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.2, 0.82, 1);
  sprite.renderOrder = 25;
  return sprite;
}

function createTargetRing(color: number): THREE.Object3D {
  const group = new THREE.Group();
  const ringMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.035, 8, 42), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.34, 4),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    }),
  );
  marker.position.y = 2.36;
  marker.rotation.y = Math.PI / 4;
  group.add(ring, marker);
  group.visible = false;
  group.renderOrder = 18;
  return group;
}

function smoothstep(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - (2 * t));
}

type LootOrbPalette = {
  core: number;
  shell: number;
  ring: number;
  sparkle: number;
  shellOpacity: number;
  ringOpacity: number;
};

function getLootOrbResourceAmount(orb: FieldLootOrb, key: "metalScrap" | "wood" | "chaosShards" | "steamComponents"): number {
  return Math.max(0, Math.floor(Number(orb.drops?.resources?.[key] ?? 0)));
}

function getLootOrbValueScore(orb: FieldLootOrb): number {
  const drops = orb.drops;
  if (!drops) {
    return 0;
  }

  const itemScore = (drops.items ?? []).reduce((score, item) => {
    const quantity = Math.max(0, Math.floor(Number(item.quantity ?? 0)));
    const chance = THREE.MathUtils.clamp(Number(item.chance ?? 0), 0, 1);
    return score + quantity * (chance < 0.6 ? 6 : 3);
  }, 0);

  return itemScore
    + Math.max(0, Math.floor(Number(drops.wad ?? 0))) / 12
    + getLootOrbResourceAmount(orb, "metalScrap") * 1.2
    + getLootOrbResourceAmount(orb, "wood") * 1
    + getLootOrbResourceAmount(orb, "steamComponents") * 2.1
    + getLootOrbResourceAmount(orb, "chaosShards") * 4;
}

function getLootOrbPalette(orb: FieldLootOrb): LootOrbPalette {
  const hasItemDrop = (orb.drops?.items ?? []).some((item) => item.id && item.quantity > 0 && item.chance > 0);
  const chaos = getLootOrbResourceAmount(orb, "chaosShards");
  const steam = getLootOrbResourceAmount(orb, "steamComponents");
  const metal = getLootOrbResourceAmount(orb, "metalScrap");
  const wood = getLootOrbResourceAmount(orb, "wood");
  const wad = Math.max(0, Math.floor(Number(orb.drops?.wad ?? 0)));
  const qualityBoost = getLootOrbValueScore(orb) >= 7;

  if (hasItemDrop) {
    return {
      core: 0xff70d8,
      shell: 0xffd26c,
      ring: 0xfff0a6,
      sparkle: 0xffffff,
      shellOpacity: 0.42,
      ringOpacity: 0.9,
    };
  }

  if (chaos > 0) {
    return {
      core: 0x42eaff,
      shell: 0x5c56ff,
      ring: 0x8df6ff,
      sparkle: 0xe7ffff,
      shellOpacity: qualityBoost ? 0.42 : 0.32,
      ringOpacity: qualityBoost ? 0.9 : 0.76,
    };
  }

  if (steam > 0) {
    return {
      core: 0xfff2c0,
      shell: 0x7ad7ff,
      ring: 0x8fe7ff,
      sparkle: 0xffffff,
      shellOpacity: qualityBoost ? 0.38 : 0.28,
      ringOpacity: qualityBoost ? 0.86 : 0.72,
    };
  }

  if (metal > 0 && metal >= wood) {
    return {
      core: 0xe7edf4,
      shell: 0x82909f,
      ring: qualityBoost ? 0xf0f6ff : 0xc8d3dd,
      sparkle: 0xffffff,
      shellOpacity: qualityBoost ? 0.36 : 0.26,
      ringOpacity: qualityBoost ? 0.82 : 0.68,
    };
  }

  if (wood > 0) {
    return {
      core: 0xffca82,
      shell: 0x78c06f,
      ring: qualityBoost ? 0xd9f28e : 0xbce28a,
      sparkle: 0xfff0ba,
      shellOpacity: qualityBoost ? 0.38 : 0.28,
      ringOpacity: qualityBoost ? 0.84 : 0.68,
    };
  }

  if (wad > 0) {
    return {
      core: 0xffd36a,
      shell: 0x66dbc9,
      ring: qualityBoost ? 0xffee9b : 0xfff0b8,
      sparkle: 0xfff8df,
      shellOpacity: qualityBoost ? 0.36 : 0.26,
      ringOpacity: qualityBoost ? 0.82 : 0.68,
    };
  }

  return {
    core: 0xffd36a,
    shell: 0x66dbc9,
    ring: 0xfff0b8,
    sparkle: 0xffffff,
    shellOpacity: 0.22,
    ringOpacity: 0.68,
  };
}

function applyLootOrbMaterial(root: THREE.Object3D | undefined, color: number, opacity?: number): void {
  root?.traverse((node) => {
    if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshBasicMaterial) {
      node.material.color.setHex(color);
      if (opacity !== undefined) {
        node.material.opacity = opacity;
      }
    }
  });
}

function getLootOrbSpawnBounce(ageMs: number): { height: number; squash: number; bobFade: number } {
  const launchT = THREE.MathUtils.clamp(ageMs / 540, 0, 1);
  const launchHeight = Math.sin(launchT * Math.PI) * 0.7;
  const bounceAge = Math.max(0, ageMs - 540);
  const bounceT = THREE.MathUtils.clamp(bounceAge / 420, 0, 1);
  const bounceHeight = Math.max(0, Math.sin(bounceT * Math.PI * 3)) * (1 - bounceT) * 0.22;
  const impactPulse = Math.max(
    0,
    1 - Math.abs(ageMs - 540) / 90,
    1 - Math.abs(ageMs - 760) / 80,
  );

  return {
    height: launchHeight + bounceHeight,
    squash: impactPulse * 0.32,
    bobFade: smoothstep((ageMs - 820) / 360),
  };
}

function getFacingVector(facing: PlayerAvatar["facing"]): { x: number; y: number } {
  switch (facing) {
    case "north":
      return { x: 0, y: -1 };
    case "south":
      return { x: 0, y: 1 };
    case "east":
      return { x: 1, y: 0 };
    case "west":
      return { x: -1, y: 0 };
    default:
      return { x: 0, y: 1 };
  }
}

function getYawFromFieldDelta(dx: number, dy: number, fallback = 0): number {
  if (Math.hypot(dx, dy) <= 0.001) {
    return fallback;
  }
  return Math.atan2(dx, dy);
}

function getCameraYawFromFieldDelta(dx: number, dy: number, fallback = 0): number {
  if (Math.hypot(dx, dy) <= 0.001) {
    return fallback;
  }
  return -Math.atan2(dx, -dy);
}

function getCameraYawForFacing(facing: PlayerAvatar["facing"]): number {
  const vector = getFacingVector(facing);
  return -Math.atan2(vector.x, -vector.y);
}

function lerpAngleRadians(from: number, to: number, amount: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * amount;
}

function getHumanoidFootPlantStep(cycle: number): number {
  return Math.floor((cycle - Math.PI * 0.5) / Math.PI);
}

function isFiniteCameraValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeHaven3DCameraViewState(
  state: Haven3DFieldCameraViewState | null | undefined,
  profile: Haven3DMapProfile,
): Haven3DFieldCameraViewState {
  return {
    yaw: isFiniteCameraValue(state?.yaw) ? state.yaw : 0,
    pitch: THREE.MathUtils.clamp(
      isFiniteCameraValue(state?.pitch) ? state.pitch : profile.camera.defaultPitch,
      CAMERA_MIN_PITCH,
      CAMERA_MAX_PITCH,
    ),
    distance: THREE.MathUtils.clamp(
      isFiniteCameraValue(state?.distance) ? state.distance : profile.camera.defaultDistance,
      profile.camera.minDistance,
      profile.camera.maxDistance,
    ),
  };
}

function normalizeHaven3DCameraState(
  state: Haven3DFieldCameraState | null | undefined,
  profile: Haven3DMapProfile,
): Haven3DFieldCameraState | null {
  if (!state) {
    return null;
  }

  return {
    mode: state.mode === "split" ? "split" : "shared",
    behavior: state.behavior === "hybrid"
      ? "hybrid"
      : state.mode === "split"
        ? "hybrid"
        : "shared",
    shared: normalizeHaven3DCameraViewState(state.shared, profile),
    split: {
      P1: normalizeHaven3DCameraViewState(state.split?.P1 ?? state.shared, profile),
      P2: normalizeHaven3DCameraViewState(state.split?.P2 ?? state.shared, profile),
    },
  };
}

function getOuterDeckOpenWorldRuntimeKey(map: FieldMap): string | null {
  const metadata = map.metadata;
  if (metadata?.kind !== "outerDeckOpenWorld") {
    return null;
  }
  return [
    map.id,
    metadata.seed,
    metadata.generationVersion,
    metadata.floorOrdinal,
  ].join(":");
}

function getOuterDeckOpenWorldCameraRebaseDelta(previousMap: FieldMap, nextMap: FieldMap): THREE.Vector3 | null {
  if (getOuterDeckOpenWorldRuntimeKey(previousMap) !== getOuterDeckOpenWorldRuntimeKey(nextMap)) {
    return null;
  }

  const previousMetadata = previousMap.metadata;
  const nextMetadata = nextMap.metadata;
  if (previousMetadata?.kind !== "outerDeckOpenWorld" || nextMetadata?.kind !== "outerDeckOpenWorld") {
    return null;
  }

  const previousOriginTileX = Number(previousMetadata.worldOriginTileX);
  const previousOriginTileY = Number(previousMetadata.worldOriginTileY);
  const nextOriginTileX = Number(nextMetadata.worldOriginTileX);
  const nextOriginTileY = Number(nextMetadata.worldOriginTileY);
  if (
    !Number.isFinite(previousOriginTileX)
    || !Number.isFinite(previousOriginTileY)
    || !Number.isFinite(nextOriginTileX)
    || !Number.isFinite(nextOriginTileY)
  ) {
    return null;
  }

  const deltaTileX = previousOriginTileX - nextOriginTileX;
  const deltaTileY = previousOriginTileY - nextOriginTileY;
  if (Math.abs(deltaTileX) < 0.0001 && Math.abs(deltaTileY) < 0.0001) {
    return null;
  }

  return new THREE.Vector3(
    deltaTileX * HAVEN3D_WORLD_TILE_SIZE,
    0,
    deltaTileY * HAVEN3D_WORLD_TILE_SIZE,
  );
}

function getHaven3DTileColor(type: FieldMap["tiles"][number][number]["type"]): number {
  switch (type) {
    case "grass":
      return 0x4f6f48;
    case "dirt":
      return 0x5f4c3a;
    case "stone":
      return 0x57594f;
    case "floor":
      return 0x55493a;
    case "wall":
    default:
      return 0x3d4144;
  }
}

function getHaven3DMapProfile(map: FieldMap): Haven3DMapProfile {
  const mapId = String(map.id);
  if (mapId === "outer_deck_overworld") {
    return HAVEN3D_OUTER_DECK_OVERWORLD_PROFILE;
  }
  if (mapId.startsWith("outerdeck_")) {
    return HAVEN3D_OUTER_DECK_BRANCH_PROFILE;
  }
  return HAVEN3D_BASE_MAP_PROFILE;
}

function usesOuterDeck3DSetDressing(map: FieldMap): boolean {
  const mapId = String(map.id);
  return mapId === "outer_deck_overworld" || mapId.startsWith("outerdeck_");
}

function createChibiCapsule(
  radius: number,
  length: number,
  material: THREE.Material,
  position: THREE.Vector3Tuple,
  rotation: THREE.Vector3Tuple = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 5, 12), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  return mesh;
}

function createChibiAnatomy(options: {
  bodyMaterial: THREE.MeshToonMaterial;
  headMaterial: THREE.MeshToonMaterial;
  accentMaterial?: THREE.MeshToonMaterial;
}): ChibiRig {
  const group = new THREE.Group();
  const bodyMaterial = options.bodyMaterial;
  const headMaterial = options.headMaterial;
  const accentMaterial = options.accentMaterial ?? options.bodyMaterial;

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.28, 6, 16), bodyMaterial);
  torso.position.y = 0.82;
  torso.scale.set(0.92, 0.9, 0.78);
  torso.castShadow = true;

  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), bodyMaterial);
  pelvis.position.y = 0.45;
  pelvis.scale.set(1.05, 0.46, 0.82);
  pelvis.castShadow = true;

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.18, 12), accentMaterial);
  neck.position.y = 1.17;
  neck.castShadow = true;

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 18), headMaterial);
  head.position.y = 1.56;
  head.scale.set(0.96, 1.05, 0.92);
  head.castShadow = true;

  const leftUpperArm = new THREE.Group();
  leftUpperArm.position.set(0.34, 0.98, 0.03);
  leftUpperArm.rotation.set(0.28, -0.1, 0.24);
  const leftUpperArmMesh = createChibiCapsule(0.085, 0.22, bodyMaterial, [0, -0.14, 0.01]);
  const leftForearm = new THREE.Group();
  leftForearm.position.set(0, -0.3, 0.03);
  leftForearm.rotation.set(-0.48, -0.05, 0.16);
  const leftForearmMesh = createChibiCapsule(0.075, 0.2, bodyMaterial, [0, -0.13, 0.02]);
  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), headMaterial);
  leftHand.position.set(0, -0.28, 0.04);
  leftHand.scale.set(0.9, 0.72, 0.62);
  leftHand.castShadow = true;
  leftForearm.add(leftForearmMesh, leftHand);
  leftUpperArm.add(leftUpperArmMesh, leftForearm);

  const rightShoulderPivot = new THREE.Group();
  rightShoulderPivot.position.set(-0.34, 0.98, 0.03);
  const rightUpperArm = new THREE.Group();
  rightUpperArm.rotation.set(0.26, 0.08, -0.24);
  const rightUpperArmMesh = createChibiCapsule(0.085, 0.22, bodyMaterial, [0, -0.14, 0.01]);
  const rightForearm = new THREE.Group();
  rightForearm.position.set(0, -0.3, 0.03);
  rightForearm.rotation.set(-0.46, 0.05, -0.16);
  const rightForearmMesh = createChibiCapsule(0.075, 0.2, bodyMaterial, [0, -0.13, 0.02]);
  const rightHandMount = new THREE.Group();
  rightHandMount.position.set(0, -0.28, 0.04);
  const rightHand = leftHand.clone();
  rightHand.position.set(0, 0, 0);
  rightHandMount.add(rightHand);
  rightForearm.add(rightForearmMesh, rightHandMount);
  rightUpperArm.add(rightUpperArmMesh, rightForearm);
  rightShoulderPivot.add(rightUpperArm);

  const leftThigh = new THREE.Group();
  leftThigh.position.set(-0.17, 0.48, 0.03);
  leftThigh.rotation.set(0.08, 0, -0.075);
  const leftThighMesh = createChibiCapsule(0.105, 0.26, bodyMaterial, [0, -0.15, 0.01]);
  const leftShin = new THREE.Group();
  leftShin.position.set(0, -0.31, 0.02);
  leftShin.rotation.set(0.16, 0, -0.04);
  const leftShinMesh = createChibiCapsule(0.085, 0.24, bodyMaterial, [0, -0.13, 0.01]);
  const leftFoot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), headMaterial);
  leftFoot.position.set(0, -0.27, 0.14);
  leftFoot.scale.set(0.9, 0.42, 1.35);
  leftFoot.castShadow = true;
  leftShin.add(leftShinMesh, leftFoot);
  leftThigh.add(leftThighMesh, leftShin);

  const rightThigh = new THREE.Group();
  rightThigh.position.set(0.17, 0.48, 0.03);
  rightThigh.rotation.set(0.08, 0, 0.075);
  const rightThighMesh = createChibiCapsule(0.105, 0.26, bodyMaterial, [0, -0.15, 0.01]);
  const rightShin = new THREE.Group();
  rightShin.position.set(0, -0.31, 0.02);
  rightShin.rotation.set(0.16, 0, 0.04);
  const rightShinMesh = createChibiCapsule(0.085, 0.24, bodyMaterial, [0, -0.13, 0.01]);
  const rightFoot = leftFoot.clone();
  rightFoot.position.set(0, -0.27, 0.14);
  rightShin.add(rightShinMesh, rightFoot);
  rightThigh.add(rightThighMesh, rightShin);

  group.add(
    torso,
    pelvis,
    neck,
    head,
    leftUpperArm,
    rightShoulderPivot,
    leftThigh,
    rightThigh,
  );
  group.position.y = 0.18;

  return {
    root: group,
    torso,
    pelvis,
    head,
    leftUpperArm,
    rightShoulderPivot,
    rightUpperArm,
    leftForearm,
    rightForearm,
    rightHandMount,
    rightHand,
    leftThigh,
    rightThigh,
    leftShin,
    rightShin,
    leftFoot,
    rightFoot,
  };
}

function attachApronGlider(anatomy: ChibiRig): void {
  if (anatomy.glider) {
    return;
  }

  const clothMaterial = new THREE.MeshBasicMaterial({
    color: 0xf1cf76,
    side: THREE.DoubleSide,
  });
  const undersideMaterial = new THREE.MeshBasicMaterial({
    color: 0xa56b2f,
    side: THREE.DoubleSide,
  });
  const trimMaterial = new THREE.MeshBasicMaterial({ color: 0x2f2116 });
  const glider = new THREE.Group();
  glider.name = "ApronGlider";
  glider.visible = false;
  glider.position.set(0, 2.06, -0.18);

  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.055, 0.88), clothMaterial);
  leftWing.name = "ApronGliderLeftWing";
  leftWing.position.set(-0.68, 0, -0.08);
  leftWing.rotation.z = 0.055;
  leftWing.castShadow = true;
  leftWing.receiveShadow = true;

  const rightWing = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.055, 0.88), clothMaterial);
  rightWing.name = "ApronGliderRightWing";
  rightWing.position.set(0.68, 0, -0.08);
  rightWing.rotation.z = -0.055;
  rightWing.castShadow = true;
  rightWing.receiveShadow = true;

  const centerPanel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.94), undersideMaterial);
  centerPanel.name = "ApronGliderCenterPanel";
  centerPanel.position.set(0, -0.012, -0.08);
  centerPanel.castShadow = true;
  centerPanel.receiveShadow = true;

  const frontRib = new THREE.Mesh(new THREE.BoxGeometry(2.92, 0.07, 0.07), trimMaterial);
  frontRib.name = "ApronGliderFrontRib";
  frontRib.position.set(0, 0.035, 0.38);
  frontRib.castShadow = true;

  const backRib = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.055, 0.06), trimMaterial);
  backRib.name = "ApronGliderBackRib";
  backRib.position.set(0, 0.03, -0.56);
  backRib.castShadow = true;

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 1.08), trimMaterial);
  spine.name = "ApronGliderSpine";
  spine.position.set(0, 0.048, -0.08);
  spine.castShadow = true;

  const leftHandle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.64, 0.045), trimMaterial);
  leftHandle.name = "ApronGliderLeftHandle";
  leftHandle.position.set(-0.33, -0.34, 0.08);
  leftHandle.rotation.z = -0.2;
  leftHandle.castShadow = true;

  const rightHandle = leftHandle.clone();
  rightHandle.name = "ApronGliderRightHandle";
  rightHandle.position.x = 0.33;
  rightHandle.rotation.z = 0.2;
  rightHandle.castShadow = true;

  glider.add(leftWing, rightWing, centerPanel, frontRib, backRib, spine, leftHandle, rightHandle);
  anatomy.glider = glider;
  anatomy.root.add(glider);
}

function createAerissPlayerDetails(anatomy: ChibiRig, bladeForm: THREE.Group): void {
  const hairMaterial = createArdyciaToonMaterial({ color: 0x3e2d24, side: THREE.DoubleSide });
  const hairShadowMaterial = createArdyciaToonMaterial({ color: 0x1d1511, side: THREE.DoubleSide });
  const hairHighlightMaterial = createArdyciaToonMaterial({ color: 0x5a4635, side: THREE.DoubleSide });
  const hairLineMaterial = createArdyciaToonMaterial({ color: 0x130e0b });
  const maskMaterial = createArdyciaToonMaterial({ color: 0x171a16 });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x060606 });
  const tunicMaterial = createArdyciaToonMaterial({ color: 0x2c7258 });
  const tunicShadowMaterial = createArdyciaToonMaterial({ color: 0x173f36 });
  const scarfMaterial = createArdyciaToonMaterial({ color: 0x7a2018, side: THREE.DoubleSide });
  const capeMaterial = createArdyciaToonMaterial({ color: 0x5f1712, side: THREE.DoubleSide });
  const gliderClothMaterial = createArdyciaToonMaterial({
    color: 0xd8c98f,
    emissive: 0x4c3718,
    emissiveIntensity: 0.42,
    side: THREE.DoubleSide,
  });
  const gliderTrimMaterial = createArdyciaToonMaterial({
    color: 0x4f2d1d,
    emissive: 0x261106,
    emissiveIntensity: 0.24,
  });
  const armorMaterial = createArdyciaToonMaterial({ color: 0x586179 });
  const wrapMaterial = createArdyciaToonMaterial({ color: 0xe7dfcb });
  const leatherMaterial = createArdyciaToonMaterial({ color: 0x3a2118 });
  const bootMaterial = createArdyciaToonMaterial({ color: 0x4b251d });
  const brassMaterial = createArdyciaToonMaterial({ color: 0xb88745 });
  const noseMaterial = createArdyciaToonMaterial({ color: 0xae8060 });
  const bladeDarkMaterial = createArdyciaToonMaterial({ color: 0x141c25 });
  const bladeWrapMaterial = createArdyciaToonMaterial({ color: 0xe6decc });

  if (anatomy.leftFoot instanceof THREE.Mesh) {
    anatomy.leftFoot.material = bootMaterial;
  }
  if (anatomy.rightFoot instanceof THREE.Mesh) {
    anatomy.rightFoot.material = bootMaterial;
  }

  const hairRoot = new THREE.Group();
  hairRoot.name = "AerissSculptedHair";
  anatomy.head.add(hairRoot);

  const attachHair = <T extends THREE.Object3D>(piece: T): T => {
    piece.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
      }
    });
    hairRoot.add(piece);
    return piece;
  };

  const createHairLobe = (
    name: string,
    position: THREE.Vector3Tuple,
    scale: THREE.Vector3Tuple,
    rotation: THREE.Vector3Tuple = [0, 0, 0],
    material: THREE.Material,
  ): THREE.Mesh => {
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), material);
    lobe.name = name;
    lobe.position.set(...position);
    lobe.scale.set(...scale);
    lobe.rotation.set(...rotation);
    lobe.castShadow = true;
    return attachHair(lobe);
  };

  const createHairLock = (
    name: string,
    position: THREE.Vector3Tuple,
    radius: number,
    length: number,
    scale: THREE.Vector3Tuple,
    rotation: THREE.Vector3Tuple,
    material: THREE.Material = hairMaterial,
  ): THREE.Mesh => {
    const lock = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 7, 18), material);
    lock.name = name;
    lock.position.set(...position);
    lock.scale.set(...scale);
    lock.rotation.set(...rotation);
    lock.castShadow = true;
    return attachHair(lock);
  };

  const createHairStrand = (
    name: string,
    points: THREE.Vector3Tuple[],
    material: THREE.Material = hairLineMaterial,
    radius = 0.012,
  ): THREE.Mesh => {
    const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
    const strand = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, radius, 5, false), material);
    strand.name = name;
    strand.castShadow = true;
    return attachHair(strand);
  };

  const hairShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.49, 32, 18, 0, Math.PI * 2, 0, 1.78),
    hairMaterial,
  );
  hairShell.name = "AerissHairHelmetShell";
  hairShell.position.set(0, 0.12, -0.07);
  hairShell.scale.set(1.15, 0.94, 1.1);
  hairShell.rotation.set(0.02, 0, -0.02);
  attachHair(hairShell);

  createHairLobe("AerissBackHairMass", [0, -0.2, -0.43], [1.08, 1.42, 0.54], [-0.05, 0, 0.02], hairShadowMaterial);
  createHairLobe("AerissLowerBackHairMass", [0.02, -0.58, -0.39], [0.86, 1.1, 0.43], [-0.02, 0, -0.02], hairMaterial);
  createHairLobe("AerissLeftBackVolume", [-0.28, -0.28, -0.38], [0.48, 1.26, 0.42], [0.02, -0.12, -0.16], hairMaterial);
  createHairLobe("AerissRightBackVolume", [0.3, -0.26, -0.38], [0.52, 1.22, 0.42], [0.02, 0.12, 0.16], hairMaterial);
  createHairLobe("AerissLeftTempleCover", [-0.43, 0.0, 0.12], [0.38, 0.78, 0.34], [-0.08, 0.18, -0.08], hairMaterial);
  createHairLobe("AerissRightTempleCover", [0.43, 0.0, 0.12], [0.38, 0.78, 0.34], [-0.08, -0.18, 0.08], hairMaterial);
  createHairLobe("AerissForeheadHairline", [-0.02, 0.13, 0.41], [0.9, 0.26, 0.27], [0.1, 0, -0.03], hairShadowMaterial);
  createHairLobe("AerissSweptBangVolume", [0.2, 0.15, 0.45], [0.68, 0.32, 0.25], [0.18, -0.22, -0.28], hairMaterial);
  createHairLobe("AerissLeftBangVolume", [-0.28, 0.1, 0.43], [0.42, 0.34, 0.24], [0.12, 0.18, 0.24], hairMaterial);

  createHairLock("AerissLeftFrontLock", [-0.42, -0.32, 0.2], 0.16, 0.78, [0.82, 1.1, 0.52], [0.02, 0.08, -0.06], hairMaterial);
  createHairLock("AerissRightFrontLock", [0.42, -0.29, 0.2], 0.16, 0.74, [0.82, 1.06, 0.52], [0.02, -0.08, 0.06], hairMaterial);
  createHairLock("AerissLeftNapeLock", [-0.28, -0.64, -0.42], 0.15, 0.6, [0.74, 1.02, 0.46], [0.08, -0.08, -0.22], hairShadowMaterial);
  createHairLock("AerissRightNapeLock", [0.3, -0.62, -0.42], 0.15, 0.58, [0.74, 1.0, 0.46], [0.08, 0.08, 0.22], hairShadowMaterial);
  createHairLock("AerissCenterNapeLock", [0.02, -0.74, -0.42], 0.15, 0.68, [0.72, 1.06, 0.44], [0.08, 0, 0.02], hairShadowMaterial);
  createHairLock("AerissSweptRightBangLock", [0.22, 0.12, 0.52], 0.09, 0.46, [0.9, 0.9, 0.62], [0.18, -0.34, -1.08], hairHighlightMaterial);
  createHairLock("AerissSweptLeftBangLock", [-0.16, 0.18, 0.51], 0.08, 0.36, [0.9, 0.86, 0.58], [0.14, 0.24, 1.0], hairMaterial);

  createHairStrand("AerissHairPartLine", [
    [-0.11, 0.52, -0.04],
    [-0.05, 0.38, 0.18],
    [0.08, 0.2, 0.43],
  ], hairLineMaterial, 0.009);
  createHairStrand("AerissBangFlowA", [
    [-0.18, 0.23, 0.5],
    [0.08, 0.15, 0.56],
    [0.36, 0.0, 0.51],
  ], hairHighlightMaterial, 0.007);
  createHairStrand("AerissBangFlowB", [
    [-0.05, 0.22, 0.5],
    [0.22, 0.12, 0.55],
    [0.44, -0.08, 0.47],
  ], hairLineMaterial, 0.006);
  createHairStrand("AerissLeftSideHairFlow", [
    [-0.48, 0.13, 0.14],
    [-0.5, -0.28, 0.14],
    [-0.43, -0.74, 0.08],
  ], hairShadowMaterial, 0.008);
  createHairStrand("AerissRightSideHairFlow", [
    [0.48, 0.13, 0.14],
    [0.5, -0.26, 0.14],
    [0.44, -0.72, 0.08],
  ], hairShadowMaterial, 0.008);
  createHairStrand("AerissBackHairFlow", [
    [0.18, 0.08, -0.54],
    [0.24, -0.38, -0.58],
    [0.12, -0.9, -0.5],
  ], hairLineMaterial, 0.007);

  const faceShadow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), maskMaterial);
  faceShadow.name = "AerissFaceShadowMask";
  faceShadow.position.set(0, 0.025, 0.49);
  faceShadow.scale.set(1.58, 0.5, 0.18);
  faceShadow.rotation.x = -0.08;
  faceShadow.castShadow = true;
  anatomy.head.add(faceShadow);

  const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.115, 0.025), eyeMaterial);
  leftEye.name = "AerissLeftEye";
  leftEye.position.set(-0.145, 0.02, 0.525);
  const rightEye = leftEye.clone();
  rightEye.name = "AerissRightEye";
  rightEye.position.x = 0.145;
  anatomy.head.add(leftEye, rightEye);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), noseMaterial);
  nose.name = "AerissNose";
  nose.position.set(0, -0.095, 0.52);
  nose.scale.set(1.42, 0.72, 0.62);
  nose.castShadow = true;
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.012), maskMaterial);
  mouth.name = "AerissMouth";
  mouth.position.set(0.105, -0.19, 0.52);
  mouth.rotation.z = -0.22;
  anatomy.head.add(nose, mouth);

  const tunicFront = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.055), tunicMaterial);
  tunicFront.name = "AerissGreenTunicFront";
  tunicFront.position.set(0, -0.01, 0.255);
  tunicFront.rotation.x = 0.08;
  tunicFront.castShadow = true;
  const tunicSide = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.04), tunicShadowMaterial);
  tunicSide.name = "AerissDarkTunicUnderlayer";
  tunicSide.position.set(0.08, -0.04, 0.2);
  tunicSide.rotation.set(0.06, 0.18, -0.08);
  tunicSide.castShadow = true;
  anatomy.torso.add(tunicSide, tunicFront);

  const chestStrap = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.055, 0.07), leatherMaterial);
  chestStrap.name = "AerissChestStrap";
  chestStrap.position.set(-0.02, 0.08, 0.31);
  chestStrap.rotation.set(0.04, 0.02, -0.74);
  chestStrap.castShadow = true;
  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.04), brassMaterial);
  clasp.name = "AerissChestClasp";
  clasp.position.set(0.07, -0.04, 0.35);
  clasp.rotation.z = -0.74;
  clasp.castShadow = true;
  anatomy.torso.add(chestStrap, clasp);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 0.085), leatherMaterial);
  belt.name = "AerissBelt";
  belt.position.set(0, 0.04, 0.2);
  belt.castShadow = true;
  const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.095, 0.04), brassMaterial);
  beltBuckle.name = "AerissBeltBuckle";
  beltBuckle.position.set(0.08, 0.045, 0.255);
  beltBuckle.castShadow = true;
  anatomy.pelvis.add(belt, beltBuckle);

  const scarfShape = new THREE.Shape();
  scarfShape.moveTo(-0.34, 0.1);
  scarfShape.lineTo(0.28, 0.13);
  scarfShape.lineTo(0.1, -0.23);
  scarfShape.lineTo(-0.12, -0.12);
  scarfShape.lineTo(-0.34, 0.1);
  const scarf = new THREE.Mesh(new THREE.ShapeGeometry(scarfShape), scarfMaterial);
  scarf.name = "AerissRedScarf";
  scarf.position.set(0, 1.08, 0.31);
  scarf.rotation.set(-0.12, 0, 0.08);
  scarf.castShadow = true;
  anatomy.root.add(scarf);

  const createCapePanel = (name: string, points: Array<[number, number]>): THREE.Mesh => {
    const shape = new THREE.Shape();
    points.forEach(([x, y], index) => {
      if (index === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    });
    shape.lineTo(points[0][0], points[0][1]);
    const panel = new THREE.Mesh(new THREE.ShapeGeometry(shape), capeMaterial);
    panel.name = name;
    panel.castShadow = true;
    return panel;
  };
  const cape = new THREE.Group();
  cape.name = "AerissCapeRig";
  cape.position.set(0.05, 1.02, -0.31);
  cape.rotation.set(0.12, 0.02, -0.05);
  const centerCapePanel = createCapePanel("AerissCapeCenterPanel", [
    [-0.28, 0.12],
    [-0.34, -0.66],
    [-0.06, -0.52],
    [0.08, -0.72],
    [0.3, -0.5],
    [0.32, 0.1],
  ]);
  const leftCapePanel = createCapePanel("AerissCapeLeftPanel", [
    [-0.42, 0.1],
    [-0.52, -0.58],
    [-0.24, -0.45],
    [-0.08, 0.08],
  ]);
  const rightCapePanel = createCapePanel("AerissCapeRightPanel", [
    [0.1, 0.1],
    [0.24, -0.56],
    [0.5, -0.34],
    [0.44, 0.08],
  ]);
  cape.add(centerCapePanel, leftCapePanel, rightCapePanel);
  anatomy.cape = cape;
  anatomy.leftCapePanel = leftCapePanel;
  anatomy.rightCapePanel = rightCapePanel;
  anatomy.root.add(cape);

  const createGliderClothPanel = (name: string, points: Array<[number, number]>): THREE.Mesh => {
    const shape = new THREE.Shape();
    points.forEach(([x, y], index) => {
      if (index === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    });
    shape.lineTo(points[0][0], points[0][1]);
    const panel = new THREE.Mesh(new THREE.ShapeGeometry(shape), gliderClothMaterial);
    panel.name = name;
    panel.castShadow = true;
    return panel;
  };
  const glider = new THREE.Group();
  glider.name = "AerissApronGlider";
  glider.visible = false;
  glider.position.set(0, 1.74, -0.18);
  glider.rotation.set(0.04, 0, 0);
  const leftGliderPanel = createGliderClothPanel("AerissGliderLeftCloth", [
    [0, -0.02],
    [-1.02, -0.2],
    [-1.2, 0.22],
    [-0.1, 0.46],
  ]);
  const rightGliderPanel = createGliderClothPanel("AerissGliderRightCloth", [
    [0, -0.02],
    [1.02, -0.2],
    [1.2, 0.22],
    [0.1, 0.46],
  ]);
  leftGliderPanel.rotation.x = -Math.PI / 2;
  rightGliderPanel.rotation.x = -Math.PI / 2;
  const gliderRib = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.045, 0.055), gliderTrimMaterial);
  gliderRib.name = "AerissGliderRib";
  gliderRib.position.set(0, 0.012, -0.02);
  gliderRib.rotation.z = 0.02;
  gliderRib.castShadow = true;
  const gliderBackRib = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.035, 0.045), gliderTrimMaterial);
  gliderBackRib.name = "AerissGliderBackRib";
  gliderBackRib.position.set(0, 0.012, -0.42);
  gliderBackRib.rotation.z = -0.015;
  gliderBackRib.castShadow = true;
  const gliderCenterBrace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.045, 0.78), gliderTrimMaterial);
  gliderCenterBrace.name = "AerissGliderCenterBrace";
  gliderCenterBrace.position.set(0, 0.02, -0.18);
  gliderCenterBrace.rotation.z = 0.02;
  gliderCenterBrace.castShadow = true;
  const leftHandle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.72, 0.04), gliderTrimMaterial);
  leftHandle.name = "AerissGliderLeftHandle";
  leftHandle.position.set(-0.46, -0.34, -0.04);
  leftHandle.rotation.z = -0.28;
  leftHandle.castShadow = true;
  const rightHandle = leftHandle.clone();
  rightHandle.name = "AerissGliderRightHandle";
  rightHandle.position.x = 0.46;
  rightHandle.rotation.z = 0.28;
  glider.add(leftGliderPanel, rightGliderPanel, gliderRib, gliderBackRib, gliderCenterBrace, leftHandle, rightHandle);
  addInvertedHullOutlines(glider, ARDYCIA_TOON_OUTLINE_SCALE.prop);
  anatomy.glider = glider;
  anatomy.root.add(glider);

  const addPauldron = (parent: THREE.Object3D, name: string, side: -1 | 1) => {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 8), armorMaterial);
    pauldron.name = name;
    pauldron.position.set(0.02 * side, 0.01, 0.025);
    pauldron.scale.set(1.22, 0.54, 0.82);
    pauldron.rotation.set(0.18, 0.12 * side, 0.24 * side);
    pauldron.castShadow = true;
    parent.add(pauldron);
  };
  addPauldron(anatomy.leftUpperArm, "AerissLeftPauldron", -1);
  addPauldron(anatomy.rightUpperArm, "AerissRightPauldron", 1);

  const addWrapBand = (parent: THREE.Object3D, name: string, y: number, scale: THREE.Vector3Tuple = [1, 0.74, 1]) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 18), wrapMaterial);
    band.name = name;
    band.position.set(0, y, 0.02);
    band.rotation.x = Math.PI / 2;
    band.scale.set(...scale);
    band.castShadow = true;
    parent.add(band);
  };
  addWrapBand(anatomy.leftForearm, "AerissLeftForearmWrapA", -0.09, [0.86, 0.64, 1]);
  addWrapBand(anatomy.leftForearm, "AerissLeftForearmWrapB", -0.17, [0.78, 0.58, 1]);
  addWrapBand(anatomy.rightForearm, "AerissRightForearmWrapA", -0.09, [0.86, 0.64, 1]);
  addWrapBand(anatomy.rightForearm, "AerissRightForearmWrapB", -0.17, [0.78, 0.58, 1]);
  addWrapBand(anatomy.leftShin, "AerissLeftShinWrap", -0.12, [0.94, 0.62, 1]);
  addWrapBand(anatomy.rightShin, "AerissRightShinWrap", -0.12, [0.94, 0.62, 1]);

  bladeForm.traverse((node) => {
    if (node instanceof THREE.Mesh && node.name !== "bladeTrail") {
      node.material = bladeDarkMaterial;
    }
  });
  const bladeHook = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 8, 30, Math.PI * 1.48), bladeDarkMaterial);
  bladeHook.name = "AerissGearbladeBackHook";
  bladeHook.position.set(-0.28, 0, 0.72);
  bladeHook.rotation.set(Math.PI / 2, 0, -0.42);
  bladeHook.scale.set(0.86, 1.18, 1);
  bladeHook.castShadow = true;
  const backSpike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 4), bladeDarkMaterial);
  backSpike.name = "AerissGearbladeHookPoint";
  backSpike.position.set(-0.46, 0, 0.46);
  backSpike.rotation.set(Math.PI / 2, 0.2, 0.18);
  backSpike.castShadow = true;
  const handleWrapA = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.035, 0.18), bladeWrapMaterial);
  handleWrapA.name = "AerissGearbladeHandleWrapA";
  handleWrapA.position.set(0, 0.002, -0.14);
  handleWrapA.rotation.z = 0.52;
  handleWrapA.castShadow = true;
  const handleWrapB = handleWrapA.clone();
  handleWrapB.name = "AerissGearbladeHandleWrapB";
  handleWrapB.position.z = 0.04;
  handleWrapB.rotation.z = -0.48;
  bladeForm.add(bladeHook, backSpike, handleWrapA, handleWrapB);
}

export class Haven3DFieldController implements Haven3DModeController {
  private readonly options: Haven3DFieldControllerOptions;
  private readonly modeController: Haven3DModeController;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 260);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  private readonly worldGroup = new THREE.Group();
  private readonly dynamicGroup = new THREE.Group();
  private readonly playerActors = new Map<PlayerId, Actor>();
  private readonly npcActors = new Map<string, Actor>();
  private readonly enemyActors = new Map<string, Actor>();
  private readonly fieldProjectileActors = new Map<string, THREE.Object3D>();
  private readonly lootOrbActors = new Map<string, THREE.Object3D>();
  private readonly fieldObjectGroups = new Map<string, THREE.Object3D>();
  private readonly fieldObjectsById = new Map<string, FieldObject>();
  private readonly splitCameras = {
    P1: new THREE.PerspectiveCamera(62, 1, 0.1, 260),
    P2: new THREE.PerspectiveCamera(62, 1, 0.1, 260),
  };
  private distantHavenLandmark: THREE.Group | null = null;
  private companionActor: Actor | null = null;
  private companionVerticalState: CompanionVerticalState | null = null;
  private mapProfile: Haven3DMapProfile = HAVEN3D_BASE_MAP_PROFILE;
  private readonly clockForward = new THREE.Vector3(0, 0, -1);
  private readonly clockRight = new THREE.Vector3(1, 0, 0);
  private resizeObserver: ResizeObserver | null = null;
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private cameraBehavior: Haven3DFieldCameraBehavior = "shared";
  private effectiveCameraMode: Haven3DFieldCameraMode = "shared";
  private hybridSplitActive = false;
  private yaw = 0;
  private pitch = 0.2;
  private cameraDistance = CAMERA_DEFAULT_DISTANCE;
  private p2ActiveGearbladeMode: Haven3DGearbladeMode | null = null;
  private p2TargetLock: Haven3DTargetRef | null = null;
  private p2TargetOrbitYawOffset = 0;
  private p2ActionCooldownUntil = 0;
  private p2LauncherRecoilStartedAt = Number.NEGATIVE_INFINITY;
  private p2BladeSwing: BladeSwingState | null = null;
  private p2NextBladeSwingComboStep: BladeSwingComboStep = 0;
  private p2BladeComboExpiresAt = Number.NEGATIVE_INFINITY;
  private p2GearbladeTransform: GearbladeTransformState | null = null;
  private p2GrappleMove: GrappleMoveState | null = null;
  private p2ZiplineDismountDrift: ZiplineDismountDrift | null = null;
  private p2RailRide: RailRideState | null = null;
  private p2RailAttachCooldownUntil = 0;
  private mouseDx = 0;
  private mouseDy = 0;
  private rightMouseDown = false;
  private pointerLocked = false;
  private promptElement: HTMLElement | null = null;
  private reticleElement: HTMLElement | null = null;
  private disposed = false;
  private targetLock: Haven3DTargetRef | null = null;
  private targetOrbitYawOffset = 0;
  private activeGearbladeMode: Haven3DGearbladeMode | null = null;
  private actionCooldownUntil = 0;
  private launcherRecoilStartedAt = Number.NEGATIVE_INFINITY;
  private bladeSwing: BladeSwingState | null = null;
  private nextBladeSwingComboStep: BladeSwingComboStep = 0;
  private bladeComboExpiresAt = Number.NEGATIVE_INFINITY;
  private gearbladeTransform: GearbladeTransformState | null = null;
  private grappleMove: GrappleMoveState | null = null;
  private ziplineDismountDrift: ZiplineDismountDrift | null = null;
  private railRide: RailRideState | null = null;
  private railAttachCooldownUntil = 0;
  private readonly launcherProjectiles: LauncherProjectile[] = [];
  private readonly enemyHpSnapshot = new Map<string, number>();
  private readonly enemyHitReactions = new Map<string, EnemyHitReaction>();
  private readonly visualEffects: VisualEffect[] = [];
  private readonly playerVerticalStates = new Map<PlayerId, PlayerVerticalState>();
  private readonly grappleAnchors = new Map<string, GrappleAnchor>();
  private readonly grappleZiplineSegments = new Map<string, GrappleZiplineSegment>();
  private readonly grindRailSegments = new Map<string, GrindRailSegment>();
  private readonly cameraImpulse = new THREE.Vector3();
  private modeElements: HTMLElement[] = [];
  private currentFrameTime = 0;
  private hitstopRemainingMs = 0;
  private cameraYawPan: CameraYawPan | null = null;
  private cameraFollowWorldY: number | null = null;
  private snapCameraNextFrame = true;
  private splitCameraStates: Record<PlayerId, Haven3DFieldCameraViewState> = {
    P1: { yaw: 0, pitch: 0.2, distance: CAMERA_DEFAULT_DISTANCE },
    P2: { yaw: 0, pitch: 0.2, distance: CAMERA_DEFAULT_DISTANCE },
  };
  private splitCameraYawPans: Record<PlayerId, CameraYawPan | null> = {
    P1: null,
    P2: null,
  };
  private splitCameraFollowWorldY: Record<PlayerId, number | null> = {
    P1: null,
    P2: null,
  };
  private splitCameraSnapNextFrame: Record<PlayerId, boolean> = {
    P1: true,
    P2: true,
  };
  private clearSkyboxBackground: (() => void) | null = null;

  private readonly handleResize = () => this.resize();
  private readonly handlePointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
  };
  private readonly handleMouseMove = (event: MouseEvent) => {
    if (!this.pointerLocked && !this.rightMouseDown) {
      return;
    }
    this.mouseDx += event.movementX;
    this.mouseDy += event.movementY;
  };
  private readonly handleWheel = (event: WheelEvent) => {
    if (!this.isMounted()) {
      return;
    }
    event.preventDefault();
    this.refreshEffectiveCameraMode();
    if (this.getEffectiveCameraMode() === "split") {
      const bounds = this.renderer.domElement.getBoundingClientRect();
      const targetPlayerId: PlayerId = event.clientX >= bounds.left + (bounds.width / 2) ? "P2" : "P1";
      const current = this.splitCameraStates[targetPlayerId];
      this.splitCameraStates[targetPlayerId] = {
        ...current,
        distance: THREE.MathUtils.clamp(
          current.distance + event.deltaY * 0.008,
          this.mapProfile.camera.minDistance,
          this.mapProfile.camera.maxDistance,
        ),
      };
      return;
    }
    this.cameraDistance = THREE.MathUtils.clamp(
      this.cameraDistance + event.deltaY * 0.008,
      this.mapProfile.camera.minDistance,
      this.mapProfile.camera.maxDistance,
    );
  };
  private readonly handleMouseUp = (event: MouseEvent) => {
    if (event.button === 2) {
      this.rightMouseDown = false;
    }
  };
  private readonly handleModeButtonClick = (event: MouseEvent) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const mode = target.dataset.haven3dMode as Haven3DGearbladeMode | undefined;
    if (!mode) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const playerId = target.closest<HTMLElement>("[data-haven3d-player]")?.dataset.haven3dPlayer === "P2"
      ? "P2"
      : "P1";
    this.setGearbladeMode(playerId, mode);
    this.renderer.domElement.focus();
  };
  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (!this.isMounted() || isEditableTarget(event.target) || document.getElementById("dialoguePanel")) {
      return;
    }

    if (event.key === "Escape" || event.code === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.options.onOpenMenu();
      return;
    }

    if (event.key === "Tab" || event.code === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) {
        this.snapCameraToPlayerFacing("P1");
      }
      return;
    }

    if (event.code === "KeyZ" || event.key === "z" || event.key === "Z" || event.code === "NumpadDecimal") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) {
        this.selectNextTarget(event.code === "NumpadDecimal" ? "P2" : "P1", event.shiftKey);
      }
      return;
    }

    if (event.code === "Space" || event.key === " " || event.code === "NumpadEnter") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) {
        this.tryStartPlayerJump(event.code === "NumpadEnter" ? "P2" : "P1");
      }
      return;
    }

    if (event.code === "KeyV" || event.key === "v" || event.key === "V") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) {
        this.toggleCameraMode();
      }
      return;
    }

    const requestedMode = this.getModeForKeyEvent(event);
    if (requestedMode) {
      event.preventDefault();
      event.stopPropagation();
      this.setGearbladeMode(event.code.startsWith("Numpad") ? "P2" : "P1", requestedMode);
      return;
    }

    if (event.code === "KeyQ" || event.key === "q" || event.key === "Q" || event.code === "NumpadAdd") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) {
        this.cycleGearbladeMode(event.code === "NumpadAdd" ? "P2" : "P1");
      }
      return;
    }

    if (
      this.getPlayerActiveMode("P1") !== null
      && !event.repeat
      && isPlayerInputActionEvent(event, "P1", "attack")
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.triggerPrimaryAction("P1");
      return;
    }

    if (
      this.getPlayerActiveMode("P2") !== null
      && !event.repeat
      && isPlayerInputActionEvent(event, "P2", "attack")
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.triggerPrimaryAction("P2");
      return;
    }

    handlePlayerInputKeyDown(event);

    if (this.options.isPaused() || event.repeat) {
      return;
    }

    if (isPlayerInputActionEvent(event, "P1", "interact")) {
      event.preventDefault();
      this.options.onInteractPressed("P1");
      return;
    }

    if (isPlayerInputActionEvent(event, "P2", "interact")) {
      event.preventDefault();
      this.options.onInteractPressed("P2");
    }
  };
  private readonly handleKeyUp = (event: KeyboardEvent) => {
    if (!this.isMounted() || isEditableTarget(event.target)) {
      return;
    }
    handlePlayerInputKeyUp(event);
  };

  constructor(options: Haven3DFieldControllerOptions) {
    this.options = options;
    this.mapProfile = getHaven3DMapProfile(options.map);
    const initialCameraState = normalizeHaven3DCameraState(options.initialCameraState, this.mapProfile);
    const sharedCameraState = initialCameraState?.shared ?? normalizeHaven3DCameraViewState(null, this.mapProfile);
    this.cameraBehavior = initialCameraState?.behavior ?? "shared";
    this.effectiveCameraMode = initialCameraState?.mode ?? "shared";
    this.hybridSplitActive = this.cameraBehavior === "hybrid" && this.effectiveCameraMode === "split";
    this.yaw = sharedCameraState.yaw;
    this.pitch = sharedCameraState.pitch;
    this.cameraDistance = sharedCameraState.distance;
    this.splitCameraStates = {
      P1: initialCameraState?.split.P1 ?? sharedCameraState,
      P2: initialCameraState?.split.P2 ?? sharedCameraState,
    };
    this.modeController = createHaven3DModeController({
      enableGearbladeModes: options.enableGearbladeModes === true,
      enabledModes: options.enabledGearbladeModes,
      initialMode: "blade",
    });
    this.activeGearbladeMode = this.modeController.activeMode;
    this.p2ActiveGearbladeMode = options.initialPlayerCombatStates?.P2?.gearbladeMode
      ?? options.initialPlayerCombatStates?.P1?.gearbladeMode
      ?? this.modeController.activeMode;
    this.activeGearbladeMode = options.initialPlayerCombatStates?.P1?.gearbladeMode ?? this.activeGearbladeMode;
    const p1CombatState = options.initialPlayerCombatStates?.P1;
    const p2CombatState = options.initialPlayerCombatStates?.P2;
    const now = performance.now();
    if (p1CombatState) {
      this.actionCooldownUntil = now + Math.max(0, Number(p1CombatState.attackCooldown ?? 0));
    }
    if (p2CombatState) {
      this.p2ActionCooldownUntil = now + Math.max(0, Number(p2CombatState.attackCooldown ?? 0));
    }
    this.configureCameraForMap();
    applyArdyciaToonRendererStyle(this.renderer);
    this.renderer.shadowMap.enabled = false;
    this.renderer.domElement.className = "haven3d-canvas";
    this.renderer.domElement.tabIndex = 0;
    this.scene.add(this.worldGroup, this.dynamicGroup);
    this.buildScene();
  }

  get activeMode(): Haven3DGearbladeMode | null {
    return this.activeGearbladeMode;
  }

  get enabledModes(): ReadonlySet<Haven3DGearbladeMode> {
    return this.modeController.enabledModes;
  }

  get mapId(): FieldMap["id"] {
    return this.options.map.id;
  }

  setExternalPlayerGearbladeMode(playerId: PlayerId, mode: Haven3DGearbladeMode | null | undefined): void {
    if (!mode || !this.enabledModes.has(mode) || this.getPlayerActiveMode(playerId) === mode) {
      return;
    }
    const previousMode = this.getPlayerActiveMode(playerId);
    this.setPlayerActiveMode(playerId, mode);
    if (previousMode) {
      this.setPlayerGearbladeTransform(playerId, {
        from: previousMode,
        to: mode,
        startedAt: this.currentFrameTime || performance.now(),
        durationMs: GEARBLADE_TRANSFORM_MS,
      });
    }
    this.updateModeHud();
  }

  playExternalBladeSwing(
    playerId: PlayerId,
    options: {
      directionX: number;
      directionY: number;
      target?: Haven3DTargetRef | null;
      comboStep?: BladeSwingComboStep;
    },
  ): void {
    const avatar = this.options.getPlayerAvatar(playerId);
    if (!avatar || this.options.isPaused()) {
      return;
    }
    this.setExternalPlayerGearbladeMode(playerId, "blade");
    const directionLength = Math.max(0.001, Math.hypot(options.directionX, options.directionY));
    const startedAt = this.currentFrameTime || performance.now();
    const comboStep = options.comboStep ?? this.getPlayerNextBladeSwingComboStep(playerId);
    const side = comboStep === 1 ? -1 : 1;
    const swing: BladeSwingState = {
      startedAt,
      struck: false,
      target: options.target ?? null,
      direction: {
        x: options.directionX / directionLength,
        y: options.directionY / directionLength,
      },
      side,
      comboStep,
      visualOnly: true,
    };
    this.setPlayerBladeSwing(playerId, swing);
    this.setPlayerNextBladeSwingComboStep(playerId, ((comboStep + 1) % 3) as BladeSwingComboStep);
    this.spawnBladeDrawSmear(avatar, swing.direction, swing);
    this.options.setPlayerAvatar(
      playerId,
      avatar.x,
      avatar.y,
      fieldFacingFromDelta(swing.direction.x, swing.direction.y, avatar.facing),
    );
  }

  playExternalLauncherFire(
    playerId: PlayerId,
    options: {
      x?: number;
      y?: number;
      directionX: number;
      directionY: number;
      target?: Haven3DTargetRef | null;
    },
  ): void {
    const avatar = this.options.getPlayerAvatar(playerId);
    if (!avatar || this.options.isPaused()) {
      return;
    }
    this.setExternalPlayerGearbladeMode(playerId, "launcher");
    const directionLength = Math.max(0.001, Math.hypot(options.directionX, options.directionY));
    const direction = {
      x: options.directionX / directionLength,
      y: options.directionY / directionLength,
    };
    const originX = Number.isFinite(Number(options.x)) ? Number(options.x) : avatar.x + direction.x * 36;
    const originY = Number.isFinite(Number(options.y)) ? Number(options.y) : avatar.y + direction.y * 36;
    this.spawnLauncherProjectile(playerId, originX, originY, direction, options.target ?? null, true);
    this.setPlayerLauncherRecoilStartedAt(playerId, this.currentFrameTime || performance.now());
    this.options.setPlayerAvatar(playerId, avatar.x, avatar.y, fieldFacingFromDelta(direction.x, direction.y, avatar.facing));
  }

  playExternalGrappleFire(
    playerId: PlayerId,
    options: {
      x?: number;
      y?: number;
      target?: Haven3DTargetRef | null;
      targetX: number;
      targetY: number;
      targetHeight?: number;
      grappleKind?: Haven3DGrappleKind;
      swing?: Haven3DGrappleFireSwing;
      zipline?: Haven3DGrappleFireZipline;
    },
  ): void {
    const avatar = this.options.getPlayerAvatar(playerId);
    if (!avatar || this.options.isPaused()) {
      return;
    }
    const now = this.currentFrameTime || performance.now();
    this.finishGrappleMove(playerId, false);
    this.setExternalPlayerGearbladeMode(playerId, "grapple");
    this.setPlayerZiplineDismountDrift(playerId, null);
    const targetPoint = { x: options.targetX, y: options.targetY };
    const targetHeight = Number.isFinite(Number(options.targetHeight)) && Number(options.targetHeight) > 0
      ? Number(options.targetHeight)
      : this.getGroundElevationAtPoint(targetPoint) + 1.08;
    const grappleKind = options.grappleKind ?? "target";
    const fallbackKey = `remote-${playerId}-${Math.round(options.targetX)}-${Math.round(options.targetY)}`;
    const shouldUseSyntheticAnchor = grappleKind === "anchor" || (!options.target && grappleKind !== "zipline");
    const targetRef: Haven3DTargetRef | GrappleAnchorTargetRef | GrappleZiplineTargetRef = grappleKind === "zipline"
      ? { kind: "zipline-track", id: options.zipline?.segmentKey ?? fallbackKey, key: options.zipline?.segmentKey ?? fallbackKey }
      : shouldUseSyntheticAnchor
      ? { kind: "grapple-node", id: fallbackKey, key: fallbackKey }
      : options.target!;
    const swing = shouldUseSyntheticAnchor
      ? {
        startX: Number.isFinite(Number(options.x)) ? Number(options.x) : avatar.x,
        startY: Number.isFinite(Number(options.y)) ? Number(options.y) : avatar.y,
        durationMs: options.swing?.durationMs ?? GRAPPLE_SWING_DURATION_MS,
        arcHeight: options.swing?.arcHeight ?? GRAPPLE_SWING_ARC_HEIGHT,
      }
      : undefined;
    const zipline = grappleKind === "zipline" && options.zipline ? { ...options.zipline } : undefined;
    const { line, hook } = this.createGrappleLineVisuals();
    this.setPlayerGrappleMove(playerId, {
      playerId,
      startedAt: now,
      target: targetRef,
      targetPoint,
      targetHeight,
      impacted: false,
      line,
      hook,
      visualOnly: true,
      swing,
      zipline,
    });
    this.setPlayerActionCooldownUntil(playerId, now + GRAPPLE_COOLDOWN_MS);
    this.options.setPlayerAvatar(
      playerId,
      avatar.x,
      avatar.y,
      fieldFacingFromDelta(options.targetX - avatar.x, options.targetY - avatar.y, avatar.facing),
    );
    this.updateGrappleLine(playerId);
  }

  private getPlayerActiveMode(playerId: PlayerId): Haven3DGearbladeMode | null {
    return playerId === "P1" ? this.activeGearbladeMode : this.p2ActiveGearbladeMode;
  }

  private setPlayerActiveMode(playerId: PlayerId, mode: Haven3DGearbladeMode | null): void {
    if (playerId === "P1") {
      this.activeGearbladeMode = mode;
      return;
    }
    this.p2ActiveGearbladeMode = mode;
  }

  private getPlayerTargetLock(playerId: PlayerId): Haven3DTargetRef | null {
    return playerId === "P1" ? this.targetLock : this.p2TargetLock;
  }

  private setPlayerTargetLock(playerId: PlayerId, targetLock: Haven3DTargetRef | null): void {
    if (playerId === "P1") {
      this.targetLock = targetLock;
      return;
    }
    this.p2TargetLock = targetLock;
  }

  private getPlayerTargetOrbitYawOffset(playerId: PlayerId): number {
    return playerId === "P1" ? this.targetOrbitYawOffset : this.p2TargetOrbitYawOffset;
  }

  private setPlayerTargetOrbitYawOffset(playerId: PlayerId, offset: number): void {
    if (playerId === "P1") {
      this.targetOrbitYawOffset = offset;
      return;
    }
    this.p2TargetOrbitYawOffset = offset;
  }

  private getPlayerActionCooldownUntil(playerId: PlayerId): number {
    return playerId === "P1" ? this.actionCooldownUntil : this.p2ActionCooldownUntil;
  }

  private setPlayerActionCooldownUntil(playerId: PlayerId, nextCooldownUntil: number): void {
    if (playerId === "P1") {
      this.actionCooldownUntil = nextCooldownUntil;
      return;
    }
    this.p2ActionCooldownUntil = nextCooldownUntil;
  }

  private getPlayerLauncherRecoilStartedAt(playerId: PlayerId): number {
    return playerId === "P1" ? this.launcherRecoilStartedAt : this.p2LauncherRecoilStartedAt;
  }

  private setPlayerLauncherRecoilStartedAt(playerId: PlayerId, startedAt: number): void {
    if (playerId === "P1") {
      this.launcherRecoilStartedAt = startedAt;
      return;
    }
    this.p2LauncherRecoilStartedAt = startedAt;
  }

  private getPlayerBladeSwing(playerId: PlayerId): BladeSwingState | null {
    return playerId === "P1" ? this.bladeSwing : this.p2BladeSwing;
  }

  private setPlayerBladeSwing(playerId: PlayerId, swing: BladeSwingState | null): void {
    if (playerId === "P1") {
      this.bladeSwing = swing;
      return;
    }
    this.p2BladeSwing = swing;
  }

  private getPlayerNextBladeSwingComboStep(playerId: PlayerId): BladeSwingComboStep {
    return playerId === "P1" ? this.nextBladeSwingComboStep : this.p2NextBladeSwingComboStep;
  }

  private setPlayerNextBladeSwingComboStep(playerId: PlayerId, comboStep: BladeSwingComboStep): void {
    if (playerId === "P1") {
      this.nextBladeSwingComboStep = comboStep;
      return;
    }
    this.p2NextBladeSwingComboStep = comboStep;
  }

  private getPlayerBladeComboExpiresAt(playerId: PlayerId): number {
    return playerId === "P1" ? this.bladeComboExpiresAt : this.p2BladeComboExpiresAt;
  }

  private setPlayerBladeComboExpiresAt(playerId: PlayerId, expiresAt: number): void {
    if (playerId === "P1") {
      this.bladeComboExpiresAt = expiresAt;
      return;
    }
    this.p2BladeComboExpiresAt = expiresAt;
  }

  private getPlayerGearbladeTransform(playerId: PlayerId): GearbladeTransformState | null {
    return playerId === "P1" ? this.gearbladeTransform : this.p2GearbladeTransform;
  }

  private setPlayerGearbladeTransform(playerId: PlayerId, transform: GearbladeTransformState | null): void {
    if (playerId === "P1") {
      this.gearbladeTransform = transform;
      return;
    }
    this.p2GearbladeTransform = transform;
  }

  private getPlayerGrappleMove(playerId: PlayerId): GrappleMoveState | null {
    return playerId === "P1" ? this.grappleMove : this.p2GrappleMove;
  }

  private setPlayerGrappleMove(playerId: PlayerId, grappleMove: GrappleMoveState | null): void {
    if (playerId === "P1") {
      this.grappleMove = grappleMove;
      return;
    }
    this.p2GrappleMove = grappleMove;
  }

  private getPlayerZiplineDismountDrift(playerId: PlayerId): ZiplineDismountDrift | null {
    return playerId === "P1" ? this.ziplineDismountDrift : this.p2ZiplineDismountDrift;
  }

  private setPlayerZiplineDismountDrift(playerId: PlayerId, drift: ZiplineDismountDrift | null): void {
    if (playerId === "P1") {
      this.ziplineDismountDrift = drift;
      return;
    }
    this.p2ZiplineDismountDrift = drift;
  }

  private getPlayerRailRide(playerId: PlayerId): RailRideState | null {
    return playerId === "P1" ? this.railRide : this.p2RailRide;
  }

  private setPlayerRailRide(playerId: PlayerId, railRide: RailRideState | null): void {
    if (playerId === "P1") {
      this.railRide = railRide;
      return;
    }
    this.p2RailRide = railRide;
  }

  private getPlayerRailAttachCooldownUntil(playerId: PlayerId): number {
    return playerId === "P1" ? this.railAttachCooldownUntil : this.p2RailAttachCooldownUntil;
  }

  private setPlayerRailAttachCooldownUntil(playerId: PlayerId, cooldownUntil: number): void {
    if (playerId === "P1") {
      this.railAttachCooldownUntil = cooldownUntil;
      return;
    }
    this.p2RailAttachCooldownUntil = cooldownUntil;
  }

  private isPlayerGrinding(playerId: PlayerId): boolean {
    return Boolean(this.getPlayerRailRide(playerId));
  }

  getPlayerCombatStates(): Partial<Record<PlayerId, FieldPlayerCombatState>> {
    const now = this.currentFrameTime || performance.now();
    const buildPlayerCombatState = (playerId: PlayerId): FieldPlayerCombatState => {
      const activeMode = this.getPlayerActiveMode(playerId) ?? "blade";
      const cooldownRemaining = Math.max(0, this.getPlayerActionCooldownUntil(playerId) - now);
      const bladeSwing = this.getPlayerBladeSwing(playerId);
      return {
        isAttacking: Boolean(bladeSwing),
        attackCooldown: cooldownRemaining,
        attackAnimTime: bladeSwing ? Math.max(0, BLADE_SWING_TOTAL_MS - (now - bladeSwing.startedAt)) : 0,
        isRangedMode: activeMode === "launcher",
        gearbladeMode: activeMode,
        energyCells: this.options.initialPlayerCombatStates?.[playerId]?.energyCells ?? 0,
        maxEnergyCells: this.options.initialPlayerCombatStates?.[playerId]?.maxEnergyCells ?? 0,
      };
    };

    return {
      P1: buildPlayerCombatState("P1"),
      P2: buildPlayerCombatState("P2"),
    };
  }

  getCameraState(): Haven3DFieldCameraState {
    this.refreshEffectiveCameraMode();
    const cameraMode = this.getEffectiveCameraMode();
    return {
      mode: cameraMode,
      behavior: this.cameraBehavior,
      shared: {
        yaw: this.getSnapshotYaw(),
        pitch: this.pitch,
        distance: this.cameraDistance,
      },
      split: {
        P1: { ...this.splitCameraStates.P1 },
        P2: { ...this.splitCameraStates.P2 },
      },
    };
  }

  getCameraBehavior(): Haven3DFieldCameraBehavior {
    return this.cameraBehavior;
  }

  setCameraBehavior(behavior: Haven3DFieldCameraBehavior): void {
    const nextBehavior = this.options.isPlayerActive("P2")
      ? behavior
      : "shared";
    const previousMode = this.effectiveCameraMode;
    this.cameraBehavior = nextBehavior;
    this.refreshEffectiveCameraMode(previousMode);
    this.resize();
    this.updateModeHud();
    this.updatePrompt();
  }

  private getEffectiveCameraMode(): Haven3DFieldCameraMode {
    return this.effectiveCameraMode;
  }

  private getPlayerSeparationPx(): number {
    const p1Avatar = this.options.isPlayerActive("P1")
      ? this.options.getPlayerAvatar("P1")
      : null;
    const p2Avatar = this.options.isPlayerActive("P2")
      ? this.options.getPlayerAvatar("P2")
      : null;
    if (!p1Avatar || !p2Avatar) {
      return 0;
    }
    return Math.hypot(p1Avatar.x - p2Avatar.x, p1Avatar.y - p2Avatar.y);
  }

  private transitionToSharedCameraLayout(): void {
    this.yaw = lerpAngleRadians(this.splitCameraStates.P1.yaw, this.splitCameraStates.P2.yaw, 0.5);
    this.pitch = (this.splitCameraStates.P1.pitch + this.splitCameraStates.P2.pitch) / 2;
    this.cameraDistance = Math.max(this.splitCameraStates.P1.distance, this.splitCameraStates.P2.distance);
    this.snapCameraNextFrame = true;
    this.cameraFollowWorldY = null;
  }

  private transitionToSplitCameraLayout(): void {
    this.splitCameraStates.P1 = {
      yaw: this.yaw,
      pitch: this.pitch,
      distance: this.cameraDistance,
    };
    this.splitCameraStates.P2 = {
      yaw: this.yaw,
      pitch: this.pitch,
      distance: this.cameraDistance,
    };
    this.splitCameraSnapNextFrame.P1 = true;
    this.splitCameraSnapNextFrame.P2 = true;
    this.splitCameraFollowWorldY.P1 = null;
    this.splitCameraFollowWorldY.P2 = null;
  }

  private refreshEffectiveCameraMode(previousModeOverride?: Haven3DFieldCameraMode): Haven3DFieldCameraMode {
    const previousMode = previousModeOverride ?? this.effectiveCameraMode;
    let nextMode: Haven3DFieldCameraMode = "shared";
    if (!this.options.isPlayerActive("P2")) {
      this.cameraBehavior = "shared";
      this.hybridSplitActive = false;
    } else if (this.cameraBehavior === "hybrid") {
      const separationPx = this.getPlayerSeparationPx();
      if (this.hybridSplitActive) {
        this.hybridSplitActive = separationPx > HYBRID_CAMERA_SPLIT_EXIT_DISTANCE_PX;
      } else {
        this.hybridSplitActive = separationPx >= HYBRID_CAMERA_SPLIT_ENTER_DISTANCE_PX;
      }
      nextMode = this.hybridSplitActive ? "split" : "shared";
    } else {
      this.hybridSplitActive = false;
    }

    if (nextMode !== previousMode) {
      if (nextMode === "split") {
        this.transitionToSplitCameraLayout();
      } else {
        this.transitionToSharedCameraLayout();
      }
    }

    this.effectiveCameraMode = nextMode;
    return this.effectiveCameraMode;
  }

  private isPlayerControllable(playerId: PlayerId): boolean {
    return this.options.isPlayerControllable?.(playerId) ?? this.options.isPlayerActive(playerId);
  }

  private getCameraYawForPlayerControls(playerId: PlayerId): number {
    if (this.getEffectiveCameraMode() === "split") {
      return this.splitCameraStates[playerId].yaw;
    }
    return this.getSnapshotYaw();
  }

  private getCameraBasis(playerId: PlayerId): {
    forwardX: number;
    forwardY: number;
    rightX: number;
    rightY: number;
  } {
    const yaw = this.getCameraYawForPlayerControls(playerId);
    return {
      forwardX: -Math.sin(yaw),
      forwardY: -Math.cos(yaw),
      rightX: Math.cos(yaw),
      rightY: -Math.sin(yaw),
    };
  }

  private rebaseStreamedOuterDeckCameraPositions(delta: THREE.Vector3): void {
    this.camera.position.add(delta);
    this.splitCameras.P1.position.add(delta);
    this.splitCameras.P2.position.add(delta);
  }

  private isTargetLockedByAnyPlayer(kind: Haven3DTargetKind, id: string): boolean {
    return (["P1", "P2"] as PlayerId[]).some((playerId) => {
      const targetLock = this.getPlayerTargetLock(playerId);
      return targetLock?.kind === kind && targetLock.id === id;
    });
  }

  replaceMap(map: FieldMap): void {
    if (this.disposed) {
      return;
    }

    const previousMap = this.options.map;
    const preserveOuterDeckOpenWorldRuntime = getOuterDeckOpenWorldRuntimeKey(previousMap) !== null
      && getOuterDeckOpenWorldRuntimeKey(previousMap) === getOuterDeckOpenWorldRuntimeKey(map);
    const streamedOuterDeckCameraRebase = preserveOuterDeckOpenWorldRuntime
      ? getOuterDeckOpenWorldCameraRebaseDelta(previousMap, map)
      : null;
    const preserveRailRide = preserveOuterDeckOpenWorldRuntime;
    const preservedRailRideSnapshots = preserveRailRide
      ? this.captureRailRideSnapshots()
      : [];
    this.clearMapBoundTransients({ preserveRailRide });
    this.options.map = map;
    this.mapProfile = getHaven3DMapProfile(map);
    this.cameraDistance = THREE.MathUtils.clamp(
      this.cameraDistance,
      this.mapProfile.camera.minDistance,
      this.mapProfile.camera.maxDistance,
    );
    this.configureCameraForMap();
    this.resetActorMotionSnapshots();
    this.rebuildWorldScene();
    if (streamedOuterDeckCameraRebase) {
      this.rebaseStreamedOuterDeckCameraPositions(streamedOuterDeckCameraRebase);
    }
    if (preserveRailRide) {
      this.restoreRailRideSnapshots(preservedRailRideSnapshots);
    }
    this.syncDynamicActors();
    this.syncFieldProjectiles();
    this.syncLootOrbs();
    this.resize();
    if (preserveOuterDeckOpenWorldRuntime) {
      this.snapCameraNextFrame = false;
      this.splitCameraSnapNextFrame.P1 = false;
      this.splitCameraSnapNextFrame.P2 = false;
    } else {
      this.cameraFollowWorldY = null;
      this.snapCameraNextFrame = true;
      this.splitCameraFollowWorldY.P1 = null;
      this.splitCameraFollowWorldY.P2 = null;
      this.splitCameraSnapNextFrame.P1 = true;
      this.splitCameraSnapNextFrame.P2 = true;
    }
  }

  isFieldObjectVisible(objectId: string): boolean {
    return this.fieldObjectGroups.get(objectId)?.visible === true;
  }

  getGrappleRouteAnchorState(): GrappleAnchorState[] {
    return Array.from(this.grappleAnchors.values())
      .filter((anchor) => Boolean(anchor.routeId))
      .map((anchor) => this.getGrappleAnchorState(anchor));
  }

  getPreferredGrappleAnchorState(rangePx = GRAPPLE_RANGE_PX): GrappleAnchorState | null {
    const anchor = this.findGrappleAnchor("P1", rangePx);
    return anchor ? this.getGrappleAnchorState(anchor) : null;
  }

  isDistantHavenLandmarkVisible(): boolean {
    return this.distantHavenLandmark?.visible === true;
  }

  private getModeForKeyEvent(event: KeyboardEvent): Haven3DGearbladeMode | null {
    switch (event.code) {
      case "Digit1":
      case "Numpad1":
        return "blade";
      case "Digit2":
      case "Numpad2":
        return "launcher";
      case "Digit3":
      case "Numpad3":
        return "grapple";
      default:
        return null;
    }
  }

  private setGearbladeMode(
    playerOrMode: PlayerId | Haven3DGearbladeMode,
    maybeMode?: Haven3DGearbladeMode,
  ): void {
    const playerId: PlayerId = maybeMode ? playerOrMode as PlayerId : "P1";
    const mode = (maybeMode ?? playerOrMode) as Haven3DGearbladeMode;
    const activeMode = this.getPlayerActiveMode(playerId);
    if (
      !this.isPlayerControllable(playerId)
      || this.isPlayerGrinding(playerId)
      || !this.enabledModes.has(mode)
      || activeMode === mode
    ) {
      return;
    }

    const previousMode = activeMode;
    this.setPlayerActiveMode(playerId, mode);
    if (previousMode) {
      this.setPlayerGearbladeTransform(playerId, {
        from: previousMode,
        to: mode,
        startedAt: this.currentFrameTime || performance.now(),
        durationMs: GEARBLADE_TRANSFORM_MS,
      });
      if (playerId === "P1") {
        this.cameraImpulse.y += 0.025;
      }
    }
    if (mode !== "blade") {
      this.setPlayerBladeSwing(playerId, null);
      this.resetBladeCombo(playerId);
    }
    if (mode !== "grapple") {
      this.finishGrappleMove(playerId, false);
    }
    if (playerId === "P1" && mode === "launcher") {
      this.pitch = Math.min(this.pitch, LAUNCHER_CAMERA_DEFAULT_PITCH);
    }
    this.updateModeHud();
  }

  private readGearbladeTransform(
    playerId: PlayerId = "P1",
    now = this.currentFrameTime || performance.now(),
  ): GearbladeTransformSnapshot | null {
    const transform = this.getPlayerGearbladeTransform(playerId);
    if (!transform) {
      return null;
    }

    const t = THREE.MathUtils.clamp((now - transform.startedAt) / transform.durationMs, 0, 1);
    if (t >= 1) {
      this.setPlayerGearbladeTransform(playerId, null);
      return null;
    }

    const eased = smoothstep(t);
    return {
      ...transform,
      t,
      eased,
      pulse: Math.sin(t * Math.PI),
    };
  }

  private cycleGearbladeMode(playerId: PlayerId = "P1"): void {
    const enabledModes = Array.from(this.enabledModes);
    if (!this.isPlayerControllable(playerId) || enabledModes.length === 0) {
      return;
    }

    const activeMode = this.getPlayerActiveMode(playerId);
    const currentIndex = activeMode
      ? enabledModes.indexOf(activeMode)
      : -1;
    this.setGearbladeMode(playerId, enabledModes[(currentIndex + 1 + enabledModes.length) % enabledModes.length]);
  }

  start(): void {
    this.disposed = false;
    this.options.host.innerHTML = "";
    this.options.host.appendChild(this.renderer.domElement);
    this.renderer.domElement.focus({ preventScroll: true });
    this.promptElement = document.querySelector<HTMLElement>("[data-haven3d-prompt]");
    this.reticleElement = document.querySelector<HTMLElement>("[data-haven3d-reticle]");
    this.bindEvents();
    this.resize();
    this.lastFrameTime = performance.now();
    this.refreshEffectiveCameraMode();
    this.updateModeHud();
    this.animationFrameId = requestAnimationFrame((time) => this.loop(time));
  }

  dispose(): void {
    this.disposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.renderer.domElement.removeEventListener("wheel", this.handleWheel);
    this.modeElements.forEach((element) => element.removeEventListener("click", this.handleModeButtonClick));
    this.modeElements = [];
    this.reticleElement = null;
    this.cameraFollowWorldY = null;
    this.clearSkyboxBackground?.();
    this.clearSkyboxBackground = null;
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("mouseup", this.handleMouseUp);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    document.removeEventListener("pointerlockchange", this.handlePointerLockChange);

    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }

    disposeObject(this.scene);
    this.renderer.dispose();
    this.options.host.innerHTML = "";
  }

  private isMounted(): boolean {
    return this.options.host.contains(this.renderer.domElement);
  }

  private getSnapshotYaw(): number {
    if (!this.cameraYawPan) {
      return this.yaw;
    }

    const elapsed = (this.currentFrameTime || performance.now()) - this.cameraYawPan.startedAt;
    const amount = smoothstep(elapsed / this.cameraYawPan.durationMs);
    return amount >= 1
      ? this.cameraYawPan.toYaw
      : lerpAngleRadians(this.cameraYawPan.fromYaw, this.cameraYawPan.toYaw, amount);
  }

  private bindEvents(): void {
    this.renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
    this.renderer.domElement.addEventListener("mousedown", (event) => {
      this.renderer.domElement.focus();
      if (event.button === 0) {
        const lockRequest = this.renderer.domElement.requestPointerLock?.() as Promise<void> | void;
        if (lockRequest && typeof lockRequest.catch === "function") {
          void lockRequest.catch(() => undefined);
        }
        this.triggerPrimaryAction("P1");
      } else if (event.button === 2) {
        this.rightMouseDown = true;
      }
    });
    this.renderer.domElement.addEventListener("wheel", this.handleWheel, { passive: false });

    this.modeElements = Array.from(document.querySelectorAll<HTMLElement>("[data-haven3d-mode]"));
    this.modeElements.forEach((element) => element.addEventListener("click", this.handleModeButtonClick));

    window.addEventListener("resize", this.handleResize);
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("mouseup", this.handleMouseUp);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.options.host);
  }

  private configureCameraForMap(): void {
    const worldWidth = this.options.map.width * HAVEN3D_WORLD_TILE_SIZE;
    const worldDepth = this.options.map.height * HAVEN3D_WORLD_TILE_SIZE;
    const far = Math.max(
      this.mapProfile.camera.farMin,
      Math.hypot(worldWidth, worldDepth) * this.mapProfile.camera.farScale,
    );
    this.camera.far = far;
    this.camera.updateProjectionMatrix();
    this.splitCameras.P1.far = far;
    this.splitCameras.P2.far = far;
    this.splitCameras.P1.updateProjectionMatrix();
    this.splitCameras.P2.updateProjectionMatrix();
  }

  private buildScene(): void {
    this.clearSkyboxBackground = applyArdyciaToonSceneStyle(this.scene, this.mapProfile.scene);

    this.buildWorldScene();
    this.createPlayerActor("P1", 0xd48342);
    this.createPlayerActor("P2", 0x7b66c9);
    this.syncDynamicActors();
    this.syncLootOrbs();
  }

  private buildWorldScene(): void {
    this.buildTerrainUnderlay();
    this.buildTileDeck();
    this.buildInteractionZones();
    this.buildFieldObjects();
    this.buildGrappleAnchors();
    this.buildGrappleZiplineSegments();
    this.buildGrindRailSegments();
    this.buildDistantHavenLandmark();
  }

  private clearWorldScene(): void {
    Array.from(this.worldGroup.children).forEach((child) => {
      this.worldGroup.remove(child);
      disposeObject(child);
    });
    this.fieldObjectGroups.clear();
    this.fieldObjectsById.clear();
    this.grappleAnchors.clear();
    this.grappleZiplineSegments.clear();
    this.grindRailSegments.clear();
    this.distantHavenLandmark = null;
  }

  private rebuildWorldScene(): void {
    this.clearWorldScene();
    this.buildWorldScene();
  }

  private clearMapBoundTransients(options: { preserveRailRide?: boolean } = {}): void {
    this.ziplineDismountDrift = null;
    this.p2ZiplineDismountDrift = null;
    this.companionVerticalState = null;
    this.bladeSwing = null;
    this.p2BladeSwing = null;
    this.resetBladeCombo("P1");
    this.resetBladeCombo("P2");
    this.targetLock = null;
    this.p2TargetLock = null;
    this.targetOrbitYawOffset = 0;
    this.p2TargetOrbitYawOffset = 0;
    this.actionCooldownUntil = 0;
    this.p2ActionCooldownUntil = 0;
    this.gearbladeTransform = null;
    this.p2GearbladeTransform = null;
    this.finishGrappleMove("P1", false);
    this.finishGrappleMove("P2", false);
    if (!options.preserveRailRide) {
      this.finishRailRide("P1", { suppressLaunch: true, keepCooldown: true });
      this.finishRailRide("P2", { suppressLaunch: true, keepCooldown: true });
    }

    for (let index = this.launcherProjectiles.length - 1; index >= 0; index -= 1) {
      this.removeLauncherProjectile(index);
    }

    for (let index = this.visualEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.visualEffects[index];
      if (!effect) {
        continue;
      }
      this.dynamicGroup.remove(effect.object);
      disposeObject(effect.object);
      this.visualEffects.splice(index, 1);
    }

    this.fieldProjectileActors.forEach((object) => {
      this.dynamicGroup.remove(object);
      disposeObject(object);
    });
    this.fieldProjectileActors.clear();

    this.lootOrbActors.forEach((object) => {
      this.dynamicGroup.remove(object);
      disposeObject(object);
    });
    this.lootOrbActors.clear();

    this.enemyHitReactions.clear();
  }

  private resetActorMotionSnapshots(): void {
    this.playerActors.forEach((actor) => {
      actor.motion = undefined;
    });
    this.npcActors.forEach((actor) => {
      actor.motion = undefined;
    });
    this.enemyActors.forEach((actor) => {
      actor.motion = undefined;
    });
    if (this.companionActor) {
      this.companionActor.motion = undefined;
    }
  }

  private createHavenBuildingDoorWallTileMask(): Set<string> {
    const mask = new Set<string>();

    this.options.map.objects.forEach((object) => {
      if (object.metadata?.havenBuilding !== true) {
        return;
      }

      const doorX = Number(object.metadata.doorX);
      const doorY = Number(object.metadata.doorY);
      const doorWidth = Number(object.metadata.doorWidth);
      if (!Number.isFinite(doorX) || !Number.isFinite(doorY) || !Number.isFinite(doorWidth) || doorWidth <= 0) {
        return;
      }

      const wallY = doorY < object.y
        ? object.y
        : doorY >= object.y + object.height
          ? object.y + object.height - 1
          : Math.floor(doorY);
      const left = Math.max(object.x, Math.floor(doorX));
      const right = Math.min(object.x + object.width, Math.ceil(doorX + doorWidth));

      for (let x = left; x < right; x += 1) {
        mask.add(`${x},${wallY}`);
      }
    });

    return mask;
  }

  private getGroundElevationAtPoint(point: { x: number; y: number }): number {
    return getFieldPointElevationWorld(this.options.map, point);
  }

  private canPlayerMoveTo(playerId: PlayerId, x: number, y: number, width: number, height: number): boolean {
    const state = this.getPlayerVerticalState(playerId);
    const halfW = width / 2;
    const halfH = height / 2;
    const corners = [
      { x: x - halfW, y: y - halfH },
      { x: x + halfW, y: y - halfH },
      { x: x - halfW, y: y + halfH },
      { x: x + halfW, y: y + halfH },
    ];

    for (const corner of corners) {
      const tileX = Math.floor(corner.x / HAVEN3D_FIELD_TILE_SIZE);
      const tileY = Math.floor(corner.y / HAVEN3D_FIELD_TILE_SIZE);
      if (tileY < 0 || tileY >= this.options.map.height || tileX < 0 || tileX >= this.options.map.width) {
        return false;
      }

      const tile = this.options.map.tiles[tileY]?.[tileX];
      if (!tile) {
        return false;
      }
      if (tile.walkable) {
        continue;
      }
      if (tile.standable3d !== true) {
        return false;
      }

      const targetGroundElevation = Math.max(0, Number(tile.elevation ?? 0)) * 0.42;
      if (state.grounded) {
        if (targetGroundElevation > state.groundElevation + PLAYER_GROUNDED_STEP_UP_WORLD_THRESHOLD) {
          return false;
        }
        continue;
      }

      if (state.worldElevation + PLAYER_STANDABLE_SURFACE_ENTRY_WORLD_BUFFER < targetGroundElevation) {
        return false;
      }
    }

    return true;
  }

  private buildTerrainUnderlay(): void {
    const width = (this.options.map.width * HAVEN3D_WORLD_TILE_SIZE) + HAVEN3D_WORLD_TILE_SIZE;
    const depth = (this.options.map.height * HAVEN3D_WORLD_TILE_SIZE) + HAVEN3D_WORLD_TILE_SIZE;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.32, depth),
      createArdyciaToonMaterial({ color: 0x121716 }),
    );
    base.name = "Haven3DTerrainUnderdeck";
    base.position.set(0, TERRAIN_BASE_Y - 0.18, 0);
    base.receiveShadow = true;
    this.worldGroup.add(base);
  }

  private buildTileDeck(): void {
    const walkableTiles = this.options.map.tiles.flatMap((row) => row.filter((tile) => tile.walkable && tile.render3d !== false));
    const doorWallTileMask = this.createHavenBuildingDoorWallTileMask();
    const wallTiles = this.options.map.tiles.flatMap((row) => row.filter((tile) => (
      !tile.walkable && tile.render3d !== false && !doorWallTileMask.has(`${tile.x},${tile.y}`)
    )));
    const terrainGeometry = new THREE.BoxGeometry(1, 1, 1);
    const wallGeometry = new THREE.BoxGeometry(1, 1, 1);
    const wallMaterial = createArdyciaToonMaterial({ color: 0x3d4144 });

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const walkableTilesByType = new Map<FieldMap["tiles"][number][number]["type"], typeof walkableTiles>();
    walkableTiles.forEach((tile) => {
      const typedTiles = walkableTilesByType.get(tile.type) ?? [];
      typedTiles.push(tile);
      walkableTilesByType.set(tile.type, typedTiles);
    });

    for (const [tileType, tiles] of walkableTilesByType.entries()) {
      const walkableMesh = new THREE.InstancedMesh(
        terrainGeometry.clone(),
        createArdyciaToonMaterial({ color: getHaven3DTileColor(tileType) }),
        tiles.length,
      );
      tiles.forEach((tile, index) => {
        const fieldPoint = {
          x: (tile.x + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
          y: (tile.y + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
        };
        const top = this.getGroundElevationAtPoint(fieldPoint);
        const height = Math.max(0.18, top - TERRAIN_BASE_Y);
        const world = fieldToHavenWorld(this.options.map, fieldPoint, 0);
        position.set(world.x, TERRAIN_BASE_Y + (height / 2), world.z);
        scale.set(
          HAVEN3D_WORLD_TILE_SIZE * TERRAIN_TILE_OVERLAP,
          height,
          HAVEN3D_WORLD_TILE_SIZE * TERRAIN_TILE_OVERLAP,
        );
        matrix.compose(position, rotation, scale);
        walkableMesh.setMatrixAt(index, matrix);
      });
      walkableMesh.instanceMatrix.needsUpdate = true;
      walkableMesh.receiveShadow = true;
      this.worldGroup.add(walkableMesh);
    }

    const wallMesh = new THREE.InstancedMesh(wallGeometry, wallMaterial, wallTiles.length);
    wallTiles.forEach((tile, index) => {
      const fieldPoint = {
          x: (tile.x + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
          y: (tile.y + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
        };
      const top = this.getGroundElevationAtPoint(fieldPoint) + (tile.standable3d === true ? 0 : 1.15);
      const height = Math.max(0.65, top - TERRAIN_BASE_Y);
      const world = fieldToHavenWorld(this.options.map, fieldPoint, 0);
      position.set(world.x, TERRAIN_BASE_Y + (height / 2), world.z);
      scale.set(
        HAVEN3D_WORLD_TILE_SIZE * TERRAIN_TILE_OVERLAP,
        height,
        HAVEN3D_WORLD_TILE_SIZE * TERRAIN_TILE_OVERLAP,
      );
      matrix.compose(position, rotation, scale);
      wallMesh.setMatrixAt(index, matrix);
    });
    wallMesh.instanceMatrix.needsUpdate = true;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;

    const wallOutlineMesh = new THREE.InstancedMesh(
      wallGeometry,
      createInvertedHullOutlineMaterial(),
      wallTiles.length,
    );
    wallTiles.forEach((tile, index) => {
      const fieldPoint = {
        x: (tile.x + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
        y: (tile.y + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
      };
      const top = this.getGroundElevationAtPoint(fieldPoint) + (tile.standable3d === true ? 0 : 1.15);
      const height = Math.max(0.65, top - TERRAIN_BASE_Y);
      const world = fieldToHavenWorld(this.options.map, fieldPoint, 0);
      position.set(world.x, TERRAIN_BASE_Y + (height / 2), world.z);
      scale.set(
        HAVEN3D_WORLD_TILE_SIZE * TERRAIN_TILE_OVERLAP * ARDYCIA_TOON_OUTLINE_SCALE.architecture,
        height * ARDYCIA_TOON_OUTLINE_SCALE.architecture,
        HAVEN3D_WORLD_TILE_SIZE * TERRAIN_TILE_OVERLAP * ARDYCIA_TOON_OUTLINE_SCALE.architecture,
      );
      matrix.compose(position, rotation, scale);
      wallOutlineMesh.setMatrixAt(index, matrix);
    });
    wallOutlineMesh.instanceMatrix.needsUpdate = true;
    wallOutlineMesh.castShadow = false;
    wallOutlineMesh.receiveShadow = false;
    wallOutlineMesh.renderOrder = 0;
    wallMesh.renderOrder = 1;
    this.worldGroup.add(wallOutlineMesh, wallMesh);
  }

  private buildInteractionZones(): void {
    const layout = createHaven3DSceneLayout(this.options.map);
    const material = new THREE.MeshBasicMaterial({
      color: 0xd9a758,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    layout.zones.forEach((zone) => {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(
          zone.worldSize.width,
          zone.worldSize.depth,
        ),
        material.clone(),
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(zone.worldCenter.x, zone.worldCenter.y, zone.worldCenter.z);
      plane.renderOrder = 2;
      this.worldGroup.add(plane);
    });
  }

  private buildGrappleAnchors(): void {
    const layout = createHaven3DSceneLayout(this.options.map);
    const routeLinksByAnchorId = new Map<string, Set<string>>();
    this.options.map.objects
      .filter((object) => object.metadata?.ziplineTrack === true)
      .forEach((object) => {
        const startAnchorId = typeof object.metadata?.startAnchorId === "string"
          ? object.metadata.startAnchorId
          : null;
        const endAnchorId = typeof object.metadata?.endAnchorId === "string"
          ? object.metadata.endAnchorId
          : null;
        if (!startAnchorId || !endAnchorId) {
          return;
        }
        const startLinks = routeLinksByAnchorId.get(startAnchorId) ?? new Set<string>();
        const endLinks = routeLinksByAnchorId.get(endAnchorId) ?? new Set<string>();
        startLinks.add(endAnchorId);
        endLinks.add(startAnchorId);
        routeLinksByAnchorId.set(startAnchorId, startLinks);
        routeLinksByAnchorId.set(endAnchorId, endLinks);
      });

    const explicitAnchors: GrappleSourcePoint[] = this.options.map.objects
      .filter((object) => object.metadata?.grappleAnchor === true)
      .map((object) => {
        const fieldCenter = {
          x: (object.x + (object.width / 2)) * HAVEN3D_FIELD_TILE_SIZE,
          y: (object.y + (object.height / 2)) * HAVEN3D_FIELD_TILE_SIZE,
        };
        const anchorHeight = Number(object.metadata?.anchorHeight);
        const routeIndex = Number(object.metadata?.routeIndex);
        return {
          id: object.id,
          label: String(object.metadata?.name ?? "Swing Node"),
          fieldCenter,
          height: Number.isFinite(anchorHeight)
            ? anchorHeight
            : this.getGroundElevationAtPoint(fieldCenter) + GRAPPLE_NODE_HEIGHT,
          routeId: typeof object.metadata?.routeId === "string"
            ? object.metadata.routeId
            : undefined,
          routeIndex: Number.isFinite(routeIndex) ? routeIndex : undefined,
          connectedAnchorIds: Array.from(routeLinksByAnchorId.get(object.id) ?? []),
        };
      });
    const sourcePoints: GrappleSourcePoint[] = [
      ...explicitAnchors,
      ...layout.zones.map((zone) => ({
        id: zone.id,
        label: zone.label,
        fieldCenter: zone.fieldCenter,
        height: this.getGroundElevationAtPoint(zone.fieldCenter) + GRAPPLE_NODE_HEIGHT,
      })),
      ...layout.objects
        .filter((object) => object.type === "station" || object.type === "door")
        .map((object) => ({
          id: object.id,
          label: object.label || object.id,
          fieldCenter: object.fieldCenter,
          height: this.getGroundElevationAtPoint(object.fieldCenter) + GRAPPLE_NODE_HEIGHT,
        })),
    ];

    const usedTiles = new Set<string>();
    sourcePoints.slice(0, GRAPPLE_NODE_MAX_COUNT).forEach((source, index) => {
      const tileKey = `${Math.round(source.fieldCenter.x / HAVEN3D_FIELD_TILE_SIZE)},${Math.round(source.fieldCenter.y / HAVEN3D_FIELD_TILE_SIZE)}`;
      if (usedTiles.has(tileKey)) {
        return;
      }
      usedTiles.add(tileKey);

      const group = this.createGrappleAnchorVisual();
      const world = fieldToHavenWorld(this.options.map, source.fieldCenter, source.height);
      group.name = `Haven3DGrappleNode:${source.id}`;
      group.position.set(world.x, world.y, world.z);
      group.visible = false;
      this.worldGroup.add(group);

      const key = `grapple-node:${source.id}`;
      this.grappleAnchors.set(key, {
        id: source.id,
        key,
        label: source.label || "Grapple Node",
        x: source.fieldCenter.x,
        y: source.fieldCenter.y,
        height: source.height,
        group,
        phase: index * 0.77,
        routeId: source.routeId,
        routeIndex: source.routeIndex,
        connectedAnchorIds: source.connectedAnchorIds ?? [],
      });
    });
  }

  private buildGrappleZiplineSegments(): void {
    this.grappleZiplineSegments.clear();
    this.options.map.objects
      .filter((object) => object.metadata?.ziplineTrack === true)
      .forEach((object) => {
        const endpoints = this.getZiplineTrackEndpoints(object.metadata ?? {});
        if (!endpoints) {
          return;
        }

        const dx = endpoints.end.fieldPoint.x - endpoints.start.fieldPoint.x;
        const dy = endpoints.end.fieldPoint.y - endpoints.start.fieldPoint.y;
        const length = Math.hypot(dx, dy);
        if (length < GRAPPLE_ROUTE_MIN_TARGET_DISTANCE_PX) {
          return;
        }

        const key = `zipline-track:${object.id}`;
        this.grappleZiplineSegments.set(key, {
          id: object.id,
          key,
          routeId: typeof object.metadata?.routeId === "string"
            ? object.metadata.routeId
            : undefined,
          startAnchorId: typeof object.metadata?.startAnchorId === "string"
            ? object.metadata.startAnchorId
            : undefined,
          endAnchorId: typeof object.metadata?.endAnchorId === "string"
            ? object.metadata.endAnchorId
            : undefined,
          start: endpoints.start,
          end: endpoints.end,
          length,
          directionX: dx / length,
          directionY: dy / length,
        });
      });
  }

  private buildGrindRailSegments(): void {
    this.grindRailSegments.clear();
    this.options.map.objects
      .filter((object) => object.metadata?.grindRail === true)
      .forEach((object) => {
        const endpoints = this.getGrindRailTrackEndpoints(object.metadata ?? {});
        if (!endpoints) {
          return;
        }

        const dx = endpoints.end.fieldPoint.x - endpoints.start.fieldPoint.x;
        const dy = endpoints.end.fieldPoint.y - endpoints.start.fieldPoint.y;
        const length = Math.hypot(dx, dy);
        if (length < GRAPPLE_ROUTE_MIN_TARGET_DISTANCE_PX) {
          return;
        }

        const segmentIndex = Math.max(0, Number(object.metadata?.segmentIndex ?? 0));
        const nextSegmentIndex = Number(object.metadata?.nextSegmentIndex);
        const key = `grind-rail:${object.id}`;
        this.grindRailSegments.set(key, {
          id: object.id,
          key,
          routeId: typeof object.metadata?.railRouteId === "string"
            ? object.metadata.railRouteId
            : undefined,
          segmentIndex,
          nextSegmentIndex: Number.isFinite(nextSegmentIndex) ? Math.max(0, Math.round(nextSegmentIndex)) : undefined,
          launchAtEnd: object.metadata?.launchAtEnd !== false,
          start: endpoints.start,
          end: endpoints.end,
          length,
          directionX: dx / length,
          directionY: dy / length,
        });
      });
  }

  private getGrappleAnchorState(anchor: GrappleAnchor): GrappleAnchorState {
    return {
      id: anchor.id,
      key: anchor.key,
      x: anchor.x,
      y: anchor.y,
      routeId: anchor.routeId ?? null,
      routeIndex: anchor.routeIndex ?? null,
      connectedAnchorIds: [...anchor.connectedAnchorIds],
    };
  }

  private createGrappleAnchorVisual(): THREE.Group {
    const group = new THREE.Group();
    const nodeMaterial = createArdyciaToonMaterial({
      color: 0x58c1aa,
      emissive: 0x0a4c43,
      emissiveIntensity: 1.15,
    });
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: 0x66dbc9,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), nodeMaterial);
    core.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.028, 8, 28), lineMaterial.clone());
    ring.rotation.x = Math.PI / 2;
    const sideRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.022, 8, 24), lineMaterial.clone());
    sideRing.rotation.y = Math.PI / 2;
    const tether = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.78, 8), lineMaterial.clone());
    tether.position.y = -0.58;
    addInvertedHullOutlines(core, ARDYCIA_TOON_OUTLINE_SCALE.prop);
    group.add(core, ring, sideRing, tether);
    group.renderOrder = 19;
    return group;
  }

  private getZiplineAnchorEndpoint(anchorId: unknown): ZiplineEndpoint | null {
    if (typeof anchorId !== "string") {
      return null;
    }

    const object = this.options.map.objects.find((entry) => (
      entry.id === anchorId
      && entry.metadata?.grappleAnchor === true
    ));
    if (!object) {
      return null;
    }

    const fieldPoint = {
      x: (object.x + (object.width / 2)) * HAVEN3D_FIELD_TILE_SIZE,
      y: (object.y + (object.height / 2)) * HAVEN3D_FIELD_TILE_SIZE,
    };
    const anchorHeight = Number(object.metadata?.anchorHeight);
    return {
      fieldPoint,
      height: Number.isFinite(anchorHeight)
        ? anchorHeight
        : this.getGroundElevationAtPoint(fieldPoint) + GRAPPLE_NODE_HEIGHT,
    };
  }

  private getMapTileFieldPoint(tileX: number, tileY: number): { x: number; y: number } | null {
    if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) {
      return null;
    }
    if (this.isOuterDeckOpenWorldRuntimeMap()) {
      return this.getOuterDeckWorldTileFieldPoint(tileX, tileY);
    }
    return {
      x: tileX * HAVEN3D_FIELD_TILE_SIZE,
      y: tileY * HAVEN3D_FIELD_TILE_SIZE,
    };
  }

  private getZiplineTrackEndpoints(metadata: Record<string, unknown>): ZiplineTrackEndpoints | null {
    const startWorldTileX = Number(metadata.startWorldTileX);
    const startWorldTileY = Number(metadata.startWorldTileY);
    const endWorldTileX = Number(metadata.endWorldTileX);
    const endWorldTileY = Number(metadata.endWorldTileY);
    const startAnchorHeight = Number(metadata.startAnchorHeight);
    const endAnchorHeight = Number(metadata.endAnchorHeight);
    let startEndpoint: ZiplineEndpoint | null = null;
    let endEndpoint: ZiplineEndpoint | null = null;

    if (
      Number.isFinite(startWorldTileX)
      && Number.isFinite(startWorldTileY)
      && Number.isFinite(endWorldTileX)
      && Number.isFinite(endWorldTileY)
    ) {
      const startField = this.getOuterDeckWorldTileFieldPoint(startWorldTileX, startWorldTileY);
      const endField = this.getOuterDeckWorldTileFieldPoint(endWorldTileX, endWorldTileY);
      if (startField && endField) {
        startEndpoint = {
          fieldPoint: startField,
          height: Number.isFinite(startAnchorHeight)
            ? startAnchorHeight
            : this.getGroundElevationAtPoint(startField) + GRAPPLE_NODE_HEIGHT,
        };
        endEndpoint = {
          fieldPoint: endField,
          height: Number.isFinite(endAnchorHeight)
            ? endAnchorHeight
            : this.getGroundElevationAtPoint(endField) + GRAPPLE_NODE_HEIGHT,
        };
      }
    }

    if (!startEndpoint || !endEndpoint) {
      startEndpoint = this.getZiplineAnchorEndpoint(metadata.startAnchorId);
      endEndpoint = this.getZiplineAnchorEndpoint(metadata.endAnchorId);
    }

    return startEndpoint && endEndpoint
      ? { start: startEndpoint, end: endEndpoint }
      : null;
  }

  private getGrindRailTrackEndpoints(metadata: Record<string, unknown>): ZiplineTrackEndpoints | null {
    const startWorldTileX = Number(metadata.startWorldTileX);
    const startWorldTileY = Number(metadata.startWorldTileY);
    const endWorldTileX = Number(metadata.endWorldTileX);
    const endWorldTileY = Number(metadata.endWorldTileY);
    const startHeight = Number(metadata.startHeight);
    const endHeight = Number(metadata.endHeight);
    if (
      !Number.isFinite(startWorldTileX)
      || !Number.isFinite(startWorldTileY)
      || !Number.isFinite(endWorldTileX)
      || !Number.isFinite(endWorldTileY)
    ) {
      return null;
    }

    const startField = this.getMapTileFieldPoint(startWorldTileX, startWorldTileY);
    const endField = this.getMapTileFieldPoint(endWorldTileX, endWorldTileY);
    if (!startField || !endField) {
      return null;
    }

    return {
      start: {
        fieldPoint: startField,
        height: Number.isFinite(startHeight)
          ? startHeight
          : this.getGroundElevationAtPoint(startField) + 0.62,
      },
      end: {
        fieldPoint: endField,
        height: Number.isFinite(endHeight)
          ? endHeight
          : this.getGroundElevationAtPoint(endField) + 0.62,
      },
    };
  }

  private createZiplineTrackVisual(
    placement: Haven3DSceneObjectPlacement,
    sourceObject: FieldObject | undefined,
  ): THREE.Group | null {
    const metadata = sourceObject?.metadata ?? {};
    const endpoints = this.getZiplineTrackEndpoints(metadata);
    if (!endpoints) {
      return null;
    }

    const startWorld = fieldToHavenWorld(
      this.options.map,
      endpoints.start.fieldPoint,
      endpoints.start.height,
    );
    const endWorld = fieldToHavenWorld(
      this.options.map,
      endpoints.end.fieldPoint,
      endpoints.end.height,
    );
    const toLocal = (world: THREE.Vector3) => new THREE.Vector3(
      world.x - placement.worldCenter.x,
      world.y - placement.worldCenter.y,
      world.z - placement.worldCenter.z,
    );
    const start = toLocal(new THREE.Vector3(startWorld.x, startWorld.y, startWorld.z));
    const end = toLocal(new THREE.Vector3(endWorld.x, endWorld.y, endWorld.z));
    const mid = start.clone().lerp(end, 0.5);
    mid.y -= Math.min(0.72, Math.max(0.22, start.distanceTo(end) * 0.035));

    const group = new THREE.Group();
    group.name = `ZiplineTrack:${sourceObject?.id ?? placement.id}`;
    const cableMaterial = new THREE.LineBasicMaterial({
      color: 0x88e6df,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    cableMaterial.fog = false;
    const shadowCableMaterial = cableMaterial.clone();
    shadowCableMaterial.color.setHex(0x154c56);
    shadowCableMaterial.opacity = 0.46;

    const mainCable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, mid, end]), cableMaterial);
    const lowerMid = mid.clone();
    lowerMid.y -= 0.18;
    const lowerCable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      start.clone().add(new THREE.Vector3(0, -0.16, 0)),
      lowerMid,
      end.clone().add(new THREE.Vector3(0, -0.16, 0)),
    ]), shadowCableMaterial);
    mainCable.renderOrder = 7;
    lowerCable.renderOrder = 6;

    const makePylon = (point: THREE.Vector3, height: number, side: -1 | 1) => {
      const pylonHeight = Math.max(1.2, height);
      const saddleHeight = pylonHeight + 0.12;
      return [
        this.createFieldObjectBox([0.16, pylonHeight, 0.16], [point.x, pylonHeight / 2, point.z], 0x334047),
        this.createFieldObjectBox([0.62, 0.14, 0.24], [point.x, saddleHeight, point.z], 0x79d4d0, {
          emissive: 0x14595d,
          emissiveIntensity: 0.46,
          rotation: [0, 0.18 * side, 0],
        }),
        this.createFieldObjectBox([0.08, pylonHeight * 0.72, 0.08], [point.x + (0.22 * side), pylonHeight * 0.42, point.z], 0x5d684f, {
          rotation: [0, 0, 0.18 * side],
        }),
      ];
    };

    group.add(
      ...makePylon(start, start.y, -1),
      ...makePylon(end, end.y, 1),
      mainCable,
      lowerCable,
    );
    group.renderOrder = 6;
    addInvertedHullOutlines(group, ARDYCIA_TOON_OUTLINE_SCALE.prop);
    return group;
  }

  private createGrindRailVisual(
    placement: Haven3DSceneObjectPlacement,
    sourceObject: FieldObject | undefined,
  ): THREE.Group | null {
    const metadata = sourceObject?.metadata ?? {};
    const endpoints = this.getGrindRailTrackEndpoints(metadata);
    if (!endpoints) {
      return null;
    }

    const startWorld = fieldToHavenWorld(
      this.options.map,
      endpoints.start.fieldPoint,
      endpoints.start.height,
    );
    const endWorld = fieldToHavenWorld(
      this.options.map,
      endpoints.end.fieldPoint,
      endpoints.end.height,
    );
    const toLocal = (world: THREE.Vector3) => new THREE.Vector3(
      world.x - placement.worldCenter.x,
      world.y - placement.worldCenter.y,
      world.z - placement.worldCenter.z,
    );
    const start = toLocal(new THREE.Vector3(startWorld.x, startWorld.y, startWorld.z));
    const end = toLocal(new THREE.Vector3(endWorld.x, endWorld.y, endWorld.z));

    const group = new THREE.Group();
    group.name = `GrindRail:${sourceObject?.id ?? placement.id}`;
    const railColor = 0x8ec9d0;
    const railShadow = 0x24454d;
    const braceColor = 0x4b3723;

    const createBeamBetween = (
      from: THREE.Vector3,
      to: THREE.Vector3,
      radius: number,
      color: number,
      emissive?: number,
      emissiveIntensity?: number,
    ): THREE.Mesh => {
      const delta = to.clone().sub(from);
      const length = Math.max(0.001, delta.length());
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, length, 8),
        createArdyciaToonMaterial({
          color,
          emissive,
          emissiveIntensity,
        }),
      );
      mesh.position.copy(from.clone().lerp(to, 0.5));
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    const railBeam = createBeamBetween(start, end, 0.065, railColor, 0x1e5e67, 0.48);
    const undersideBeam = createBeamBetween(
      start.clone().add(new THREE.Vector3(0, -0.08, 0)),
      end.clone().add(new THREE.Vector3(0, -0.08, 0)),
      0.04,
      railShadow,
      0x0f2024,
      0.24,
    );
    const highlightBeam = createBeamBetween(
      start.clone().add(new THREE.Vector3(0, 0.035, 0)),
      end.clone().add(new THREE.Vector3(0, 0.035, 0)),
      0.018,
      0xd7faff,
      0x7eefff,
      0.52,
    );
    group.add(railBeam, undersideBeam, highlightBeam);

    const addSupport = (t: number, side: -1 | 1): void => {
      const fieldPoint = {
        x: THREE.MathUtils.lerp(endpoints.start.fieldPoint.x, endpoints.end.fieldPoint.x, t),
        y: THREE.MathUtils.lerp(endpoints.start.fieldPoint.y, endpoints.end.fieldPoint.y, t),
      };
      const railHeight = THREE.MathUtils.lerp(endpoints.start.height, endpoints.end.height, t);
      const groundHeight = this.getGroundElevationAtPoint(fieldPoint);
      const groundWorld = fieldToHavenWorld(this.options.map, fieldPoint, groundHeight);
      const railWorld = fieldToHavenWorld(this.options.map, fieldPoint, railHeight);
      const localGround = toLocal(new THREE.Vector3(groundWorld.x, groundWorld.y, groundWorld.z));
      const localRail = toLocal(new THREE.Vector3(railWorld.x, railWorld.y, railWorld.z));
      const supportHeight = Math.max(0.24, localRail.y - localGround.y);
      const forward = end.clone().sub(start).normalize();
      const sideVector = new THREE.Vector3(forward.z, 0, -forward.x).normalize().multiplyScalar(0.18 * side);
      group.add(
        this.createFieldObjectBox(
          [0.08, supportHeight, 0.08],
          [localRail.x + sideVector.x, localGround.y + (supportHeight / 2), localRail.z + sideVector.z],
          braceColor,
        ),
        this.createFieldObjectBox(
          [0.34, 0.08, 0.12],
          [localRail.x, localRail.y - 0.08, localRail.z],
          railShadow,
          { rotation: [0, Math.atan2(-(end.z - start.z), end.x - start.x), 0] },
        ),
      );
    };

    addSupport(0, -1);
    addSupport(0.5, 1);
    addSupport(1, -1);
    group.renderOrder = 7;
    addInvertedHullOutlines(group, ARDYCIA_TOON_OUTLINE_SCALE.prop);
    return group;
  }

  private createFieldObjectBox(
    size: THREE.Vector3Tuple,
    position: THREE.Vector3Tuple,
    color: number,
    options: {
      emissive?: number;
      emissiveIntensity?: number;
      rotation?: THREE.Vector3Tuple;
    } = {},
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      createArdyciaToonMaterial({
        color,
        emissive: options.emissive,
        emissiveIntensity: options.emissiveIntensity,
      }),
    );
    mesh.position.set(...position);
    if (options.rotation) {
      mesh.rotation.set(...options.rotation);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private addFieldObjectLabel(group: THREE.Group, placement: Haven3DSceneObjectPlacement): void {
    if (placement.type !== "station" || !placement.label) {
      return;
    }

    const sprite = createLabelSprite(placement.label.toUpperCase());
    sprite.position.set(0, Math.max(placement.worldSize.height, 1.4) + 0.72, 0);
    group.add(sprite);
  }

  private createGenericFieldObjectGroup(placement: Haven3DSceneObjectPlacement): THREE.Group {
    const color = placement.type === "station"
      ? 0x8d6840
      : placement.type === "door"
        ? 0x5d6c73
        : placement.type === "resource"
          ? 0x66a872
          : 0x665c4f;
    const group = new THREE.Group();
    group.add(this.createFieldObjectBox(
      [placement.worldSize.width, placement.worldSize.height, placement.worldSize.depth],
      [0, placement.worldSize.height / 2, 0],
      color,
    ));
    addInvertedHullOutlines(group, ARDYCIA_TOON_OUTLINE_SCALE.prop);
    return group;
  }

  private createRouteFieldObjectGroup(
    placement: Haven3DSceneObjectPlacement,
    sourceObject: FieldObject | undefined,
  ): THREE.Group | null {
    if (sourceObject?.metadata?.grindRail === true || sourceObject?.sprite === "grind_rail") {
      return this.createGrindRailVisual(placement, sourceObject) ?? new THREE.Group();
    }

    if (sourceObject?.metadata?.ziplineTrack === true || sourceObject?.sprite === "zipline_track") {
      return this.createZiplineTrackVisual(placement, sourceObject) ?? new THREE.Group();
    }

    if (sourceObject?.metadata?.grappleAnchor === true || sourceObject?.sprite === "grapple_anchor") {
      return new THREE.Group();
    }

    return null;
  }

  private createSimpleDoorwayGroup(
    placement: Haven3DSceneObjectPlacement,
    sourceObject: FieldObject | undefined,
  ): THREE.Group | null {
    if (sourceObject?.sprite !== "doorway") {
      return null;
    }

    const width = Math.max(1.35, placement.worldSize.width);
    const depth = Math.max(0.62, placement.worldSize.depth);
    const height = Math.max(2.25, Math.min(2.9, placement.worldSize.height));
    const postWidth = Math.max(0.18, Math.min(0.36, width * 0.14));
    const lintelHeight = Math.max(0.24, Math.min(0.38, height * 0.13));
    const openingWidth = Math.max(0.82, width - (postWidth * 2.55));
    const openingHeight = Math.max(1.55, height - lintelHeight - 0.34);
    const frameColor = sourceObject.metadata?.havenBuilding === true ? 0x59645f : 0x465155;
    const trimColor = sourceObject.metadata?.havenBuilding === true ? 0xb88745 : 0x72c8a5;
    const shadowColor = 0x101615;
    const group = new THREE.Group();

    group.add(
      this.createFieldObjectBox(
        [postWidth, height, depth * 0.72],
        [-(openingWidth / 2 + postWidth / 2), height / 2, 0],
        frameColor,
      ),
      this.createFieldObjectBox(
        [postWidth, height, depth * 0.72],
        [openingWidth / 2 + postWidth / 2, height / 2, 0],
        frameColor,
      ),
      this.createFieldObjectBox(
        [openingWidth + (postWidth * 2.35), lintelHeight, depth * 0.78],
        [0, height - (lintelHeight / 2), 0],
        frameColor,
      ),
      this.createFieldObjectBox(
        [openingWidth, openingHeight, 0.08],
        [0, 0.22 + (openingHeight / 2), -depth / 2 - 0.03],
        shadowColor,
        { emissive: 0x07100e, emissiveIntensity: 0.18 },
      ),
      this.createFieldObjectBox(
        [openingWidth + (postWidth * 1.4), 0.12, depth * 0.92],
        [0, 0.06, 0],
        trimColor,
        { emissive: 0x1d1206, emissiveIntensity: 0.1 },
      ),
      this.createFieldObjectBox(
        [openingWidth + (postWidth * 1.3), 0.1, depth * 0.82],
        [0, height - lintelHeight - 0.08, 0.02],
        trimColor,
        { emissive: 0x1d1206, emissiveIntensity: 0.08 },
      ),
    );

    if (sourceObject.metadata?.returnBeacon === true) {
      group.add(this.createHavenReturnBeacon(height));
    }

    addInvertedHullOutlines(group, ARDYCIA_TOON_OUTLINE_SCALE.architecture);
    return group;
  }

  private createHavenReturnBeacon(baseHeight: number): THREE.Group {
    const group = new THREE.Group();
    group.name = "HavenReturnBeacon";

    const beaconMaterial = new THREE.MeshBasicMaterial({
      color: 0x8ee8ff,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xcff8ff,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
    });

    const beamHeight = 72;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 1.08, beamHeight, 24, 1, true),
      beaconMaterial,
    );
    beam.position.set(0, baseHeight + (beamHeight / 2) + 0.52, 0);
    beam.renderOrder = 8;

    const coreBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.16, beamHeight + 8, 16, 1, true),
      coreMaterial.clone(),
    );
    coreBeam.position.set(0, baseHeight + (beamHeight / 2) + 4.5, 0);
    coreBeam.renderOrder = 9;

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 8), coreMaterial);
    core.position.set(0, baseHeight + 0.72, 0);
    core.renderOrder = 9;

    const ringMaterial = beaconMaterial.clone();
    ringMaterial.opacity = 0.58;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.035, 8, 30), ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, baseHeight + 0.68, 0);
    ring.renderOrder = 9;

    const light = new THREE.PointLight(0x8ee8ff, 1.25, 8.5);
    light.position.set(0, baseHeight + 1.45, 0);

    group.add(beam, coreBeam, core, ring, light);
    return group;
  }

  private getHavenBuildingVisualDoorWidth(width: number, sourceObject: FieldObject | undefined): number {
    const metadataDoorWidth = Number(sourceObject?.metadata?.doorWidth);
    const mappedDoorWidth = Number.isFinite(metadataDoorWidth) && metadataDoorWidth > 0
      ? metadataDoorWidth * HAVEN3D_WORLD_TILE_SIZE * 0.74
      : width * 0.36;
    return Math.max(1.45, Math.min(width * 0.46, mappedDoorWidth, 3.35));
  }

  private createHavenBuildingDoorway(
    width: number,
    depth: number,
    height: number,
    colors: HavenBuildingPalette,
    sourceObject: FieldObject | undefined,
  ): THREE.Object3D[] {
    const doorWidth = this.getHavenBuildingVisualDoorWidth(width, sourceObject);
    const doorHeight = Math.max(1.72, Math.min(height * 0.68, 2.28));
    const frontZ = depth / 2;
    const doorCenterY = doorHeight / 2 + 0.04;
    const trimGlow = colors.glow ? 0.48 : 0;
    const doorGlow = colors.glow ? 0.34 : 0;
    const jambWidth = Math.max(0.14, doorWidth * 0.055);

    return [
      this.createFieldObjectBox(
        [doorWidth + 0.56, doorHeight + 0.34, 0.1],
        [0, doorCenterY + 0.04, frontZ + 0.078],
        0x080909,
      ),
      this.createFieldObjectBox(
        [doorWidth, doorHeight, 0.16],
        [0, doorCenterY, frontZ + 0.16],
        colors.door,
        {
          emissive: colors.glow,
          emissiveIntensity: doorGlow,
        },
      ),
      this.createFieldObjectBox(
        [jambWidth, doorHeight + 0.32, 0.22],
        [-doorWidth / 2 - jambWidth, doorCenterY + 0.04, frontZ + 0.19],
        colors.trim,
        {
          emissive: colors.glow,
          emissiveIntensity: trimGlow,
        },
      ),
      this.createFieldObjectBox(
        [jambWidth, doorHeight + 0.32, 0.22],
        [doorWidth / 2 + jambWidth, doorCenterY + 0.04, frontZ + 0.19],
        colors.trim,
        {
          emissive: colors.glow,
          emissiveIntensity: trimGlow,
        },
      ),
      this.createFieldObjectBox(
        [doorWidth + 0.54, 0.18, 0.24],
        [0, doorHeight + 0.22, frontZ + 0.2],
        colors.trim,
        {
          emissive: colors.glow,
          emissiveIntensity: colors.glow ? 0.58 : 0,
        },
      ),
      this.createFieldObjectBox(
        [0.045, doorHeight * 0.84, 0.19],
        [0, doorCenterY - 0.03, frontZ + 0.255],
        0x050606,
      ),
      this.createFieldObjectBox(
        [doorWidth + 0.82, 0.12, 0.56],
        [0, 0.08, frontZ + 0.38],
        colors.roof,
      ),
      this.createFieldObjectBox(
        [doorWidth + 1.18, 0.055, 1.02],
        [0, 0.035, frontZ + 0.88],
        0x3b3a32,
      ),
    ];
  }

  private createHavenBuildingGroup(
    placement: Haven3DSceneObjectPlacement,
    sourceObject: FieldObject | undefined,
  ): THREE.Group | null {
    if (placement.type !== "station" || sourceObject?.metadata?.havenBuilding !== true) {
      return null;
    }

    const width = placement.worldSize.width;
    const depth = placement.worldSize.depth;
    const sprite = sourceObject.sprite ?? "";
    const colorBySprite: Record<string, HavenBuildingPalette> = {
      shop: { wall: 0x8d6840, roof: 0x513526, trim: 0xc0954d, door: 0x221816 },
      quarters: { wall: 0x7d5135, roof: 0x5b1712, trim: 0xa8844f, door: 0x241614 },
      roster: { wall: 0x6c6d62, roof: 0x343a3d, trim: 0xb79b61, door: 0x1c2022 },
      loadout: { wall: 0x4b5d5a, roof: 0x253733, trim: 0x75b7a1, door: 0x172321, glow: 0x0b4a41 },
      ops_terminal: { wall: 0x57594f, roof: 0x30332f, trim: 0xd2a24d, door: 0x1b1f1d, glow: 0x624716 },
      quest_board: { wall: 0x8c7041, roof: 0x48301f, trim: 0xd0aa55, door: 0x241916 },
      tavern: { wall: 0x83523f, roof: 0x601812, trim: 0xba8b43, door: 0x2b1714 },
      gear_workbench: { wall: 0x5c5246, roof: 0x292d31, trim: 0xb88b3d, door: 0x1f1c1a, glow: 0x5a3815 },
      comms_array: { wall: 0x485c60, roof: 0x26363d, trim: 0x72c8a5, door: 0x172321, glow: 0x0c4339 },
      schema: { wall: 0x5e6070, roof: 0x303441, trim: 0x91a1d6, door: 0x191c24, glow: 0x242b65 },
      stable: { wall: 0x586b45, roof: 0x334227, trim: 0xa5b96a, door: 0x253017 },
      dispatch: { wall: 0x56666b, roof: 0x2d3d42, trim: 0x78b2c0, door: 0x182126 },
      foundry_annex: { wall: 0x6d5141, roof: 0x3b2d2a, trim: 0xcc8c42, door: 0x261913, glow: 0x6a2a0e },
      port: { wall: 0x4f666d, roof: 0x283b43, trim: 0x71b6c8, door: 0x172229 },
      black_market: { wall: 0x4e3a53, roof: 0x2a1e30, trim: 0xa979b5, door: 0x1d1420, glow: 0x3d174a },
      repair_bench: { wall: 0x665747, roof: 0x363434, trim: 0xd0a24c, door: 0x241916, glow: 0x5a3815 },
      bulkhead: { wall: 0x48565a, roof: 0x2c3438, trim: 0x72c8a5, door: 0x151d22, glow: 0x0c4339 },
    };
    const colors = colorBySprite[sprite] ?? { wall: 0x74614a, roof: 0x3c342d, trim: 0xb88745, door: 0x211817 };
    const group = new THREE.Group();

    if (sprite === "bulkhead") {
      const postHeight = 3.1;
      const postWidth = Math.max(0.42, Math.min(0.75, width * 0.08));
      const doorWidth = Math.max(2.2, Math.min(width * 0.36, 4.1));
      group.add(
        this.createFieldObjectBox([width, 0.36, depth], [0, 0.18, 0], colors.roof),
        this.createFieldObjectBox([postWidth, postHeight, depth * 0.9], [-doorWidth / 2 - postWidth * 0.62, postHeight / 2, 0], colors.wall),
        this.createFieldObjectBox([postWidth, postHeight, depth * 0.9], [doorWidth / 2 + postWidth * 0.62, postHeight / 2, 0], colors.wall),
        this.createFieldObjectBox([width * 0.72, 0.48, depth * 0.86], [0, postHeight + 0.18, 0], colors.roof),
        this.createFieldObjectBox([doorWidth, 1.82, 0.12], [0, 1.02, -depth / 2 - 0.04], colors.door, {
          emissive: colors.glow,
          emissiveIntensity: colors.glow ? 0.42 : 0,
        }),
        this.createFieldObjectBox([doorWidth * 0.72, 0.09, 0.16], [0, 1.98, -depth / 2 - 0.08], colors.trim, {
          emissive: colors.glow,
          emissiveIntensity: colors.glow ? 0.58 : 0,
        }),
      );
      addInvertedHullOutlines(group, ARDYCIA_TOON_OUTLINE_SCALE.architecture);
      return group;
    }

    const height = Math.max(2.95, Math.min(4.2, placement.worldSize.height));
    const roofHeight = 0.38;
    const windowY = Math.max(1.68, Math.min(height * 0.56, 2.0));
    group.add(
      this.createFieldObjectBox([width, height, depth], [0, height / 2, 0], colors.wall),
      this.createFieldObjectBox([width + 0.52, roofHeight, depth + 0.52], [0, height + roofHeight / 2, 0], colors.roof),
      this.createFieldObjectBox([width + 0.16, 0.16, depth + 0.16], [0, height * 0.72, 0], colors.trim),
      ...this.createHavenBuildingDoorway(width, depth, height, colors, sourceObject),
      this.createFieldObjectBox([0.46, 0.46, 0.1], [-width * 0.32, windowY, depth / 2 + 0.16], colors.trim, {
        emissive: colors.glow,
        emissiveIntensity: colors.glow ? 0.38 : 0,
      }),
      this.createFieldObjectBox([0.46, 0.46, 0.1], [width * 0.32, windowY, depth / 2 + 0.16], colors.trim, {
        emissive: colors.glow,
        emissiveIntensity: colors.glow ? 0.38 : 0,
      }),
    );

    addInvertedHullOutlines(group, ARDYCIA_TOON_OUTLINE_SCALE.architecture);
    return group;
  }

  private createHavenCargoElevatorExteriorGroup(
    placement: Haven3DSceneObjectPlacement,
    sourceObject: FieldObject | undefined,
  ): THREE.Group {
    const width = Math.max(24, placement.worldSize.width);
    const depth = Math.max(18, placement.worldSize.depth);
    const height = Math.max(8.8, Number(sourceObject?.metadata?.visualHeightWorld ?? placement.worldSize.height));
    const frontZ = depth / 2;
    const backZ = -depth / 2;
    const wallThickness = 0.78;
    const doorWidthTiles = Number(sourceObject?.metadata?.doorWidth ?? 6);
    const doorWidth = Math.max(7.2, Math.min(width * 0.22, doorWidthTiles * HAVEN3D_WORLD_TILE_SIZE * 0.95));
    const doorHeight = Math.max(3.25, Math.min(height * 0.44, 4.25));
    const doorCenterY = doorHeight / 2 + 0.12;
    const sideSegmentWidth = Math.max(2.2, (width - doorWidth - 1.6) / 2);
    const sideOffset = (doorWidth / 2) + 0.8 + (sideSegmentWidth / 2);
    const elevatorWall = 0x22303a;
    const elevatorDark = 0x101820;
    const elevatorCap = 0x384b53;
    const brass = 0xb88745;
    const glowBlue = 0x74d7ff;
    const group = new THREE.Group();

    this.addHavenCargoElevatorSkylineTracks(group, width, depth, height, sourceObject);

    group.add(
      this.createFieldObjectBox([width + 1.6, 0.34, depth + 1.2], [0, 0.17, 0], 0x18242b),
      this.createFieldObjectBox([width, height, wallThickness], [0, height / 2, backZ], elevatorWall),
      this.createFieldObjectBox([wallThickness, height, depth], [-width / 2, height / 2, 0], elevatorWall),
      this.createFieldObjectBox([wallThickness, height, depth], [width / 2, height / 2, 0], elevatorWall),
      this.createFieldObjectBox([sideSegmentWidth, height * 0.84, wallThickness], [-sideOffset, height * 0.42, frontZ], elevatorWall),
      this.createFieldObjectBox([sideSegmentWidth, height * 0.84, wallThickness], [sideOffset, height * 0.42, frontZ], elevatorWall),
      this.createFieldObjectBox([doorWidth + 2.2, 1.08, wallThickness + 0.1], [0, doorHeight + 0.78, frontZ], elevatorCap),
      this.createFieldObjectBox([width + 2.1, 0.72, depth + 1.7], [0, height + 0.36, 0], elevatorCap),
      this.createFieldObjectBox([width * 0.86, 0.22, wallThickness + 0.18], [0, height * 0.58, frontZ + 0.06], brass, {
        emissive: 0x2a1706,
        emissiveIntensity: 0.12,
      }),
    );

    const ribCount = 7;
    for (let index = 0; index < ribCount; index += 1) {
      const t = ribCount <= 1 ? 0.5 : index / (ribCount - 1);
      const x = (-width * 0.42) + (width * 0.84 * t);
      if (Math.abs(x) < doorWidth * 0.68) {
        continue;
      }
      group.add(
        this.createFieldObjectBox([0.22, height * 0.76, wallThickness + 0.2], [x, height * 0.4, frontZ + 0.12], 0x53646a),
      );
    }

    const panelWidth = Math.max(5, width * 0.1);
    group.add(
      this.createFieldObjectBox([doorWidth + 0.8, doorHeight + 0.6, 0.16], [0, doorCenterY, frontZ + 0.22], 0x06090d),
      this.createFieldObjectBox([doorWidth, doorHeight, 0.22], [0, doorCenterY, frontZ + 0.34], elevatorDark, {
        emissive: 0x031722,
        emissiveIntensity: 0.38,
      }),
      this.createFieldObjectBox([0.08, doorHeight * 0.88, 0.28], [0, doorCenterY, frontZ + 0.48], 0x020405),
      this.createFieldObjectBox([doorWidth * 0.78, 0.12, 0.32], [0, doorHeight + 0.34, frontZ + 0.5], glowBlue, {
        emissive: glowBlue,
        emissiveIntensity: 1.15,
      }),
      this.createFieldObjectBox([0.14, doorHeight + 0.28, 0.32], [-doorWidth / 2 - 0.28, doorCenterY, frontZ + 0.48], brass, {
        emissive: 0x2a1706,
        emissiveIntensity: 0.18,
      }),
      this.createFieldObjectBox([0.14, doorHeight + 0.28, 0.32], [doorWidth / 2 + 0.28, doorCenterY, frontZ + 0.48], brass, {
        emissive: 0x2a1706,
        emissiveIntensity: 0.18,
      }),
      this.createFieldObjectBox([doorWidth + 5.4, 0.18, 5.6], [0, 0.1, frontZ + 2.65], 0x344047),
      this.createFieldObjectBox([panelWidth, height * 0.22, 0.12], [-width * 0.32, height * 0.58, frontZ + 0.46], 0x162129, {
        emissive: 0x052331,
        emissiveIntensity: 0.42,
      }),
      this.createFieldObjectBox([panelWidth, height * 0.22, 0.12], [width * 0.32, height * 0.58, frontZ + 0.46], 0x162129, {
        emissive: 0x052331,
        emissiveIntensity: 0.42,
      }),
    );

    const leftLamp = this.createFieldObjectBox([0.32, 0.48, 0.22], [-doorWidth / 2 - 1.15, 2.18, frontZ + 0.62], 0xffc067, {
      emissive: 0xffad43,
      emissiveIntensity: 1.5,
    });
    const rightLamp = this.createFieldObjectBox([0.32, 0.48, 0.22], [doorWidth / 2 + 1.15, 2.18, frontZ + 0.62], 0xffc067, {
      emissive: 0xffad43,
      emissiveIntensity: 1.5,
    });
    const warmDoorLight = new THREE.PointLight(0xffc067, 2.85, 18.5, 1.32);
    warmDoorLight.position.set(0, 2.5, frontZ + 2.25);
    const statusLight = new THREE.PointLight(glowBlue, 1.1, 22, 1.55);
    statusLight.position.set(0, height * 0.72, frontZ + 0.9);
    group.add(leftLamp, rightLamp, warmDoorLight, statusLight);

    addInvertedHullOutlines(group, ARDYCIA_TOON_OUTLINE_SCALE.architecture);
    const skylineTracks = group.getObjectByName(HAVEN_SKYLINE_TRACKS_GROUP_NAME);
    if (skylineTracks) {
      this.setObjectFogEnabled(skylineTracks, false);
    }
    return group;
  }

  private addHavenCargoElevatorSkylineTracks(
    group: THREE.Group,
    width: number,
    depth: number,
    elevatorHeight: number,
    sourceObject: FieldObject | undefined,
  ): void {
    const railHeight = Math.max(180, Number(sourceObject?.metadata?.skylineTrackHeightWorld ?? 220));
    const railBaseY = 0.08;
    const railCenterY = railBaseY + (railHeight / 2);
    const cornerInset = 2.65;
    const cornerOutset = 1.05;
    const xEdge = (width / 2) + cornerOutset;
    const zEdge = (depth / 2) + cornerOutset;
    const railColor = 0x465c64;
    const darkRail = 0x111820;
    const braceColor = 0x6e5a37;
    const signalColor = 0x74d7ff;
    const trackGroup = new THREE.Group();
    trackGroup.name = HAVEN_SKYLINE_TRACKS_GROUP_NAME;
    group.add(trackGroup);

    ([
      { sx: -1, sz: -1 },
      { sx: 1, sz: -1 },
      { sx: -1, sz: 1 },
      { sx: 1, sz: 1 },
    ] as const).forEach(({ sx, sz }) => {
      const outerX = sx * xEdge;
      const outerZ = sz * zEdge;
      const innerX = outerX - (sx * cornerInset);
      const innerZ = outerZ - (sz * cornerInset);
      trackGroup.add(
        this.createFieldObjectBox([0.34, railHeight, 0.34], [outerX, railCenterY, outerZ], railColor),
        this.createFieldObjectBox([0.28, railHeight, 0.28], [innerX, railCenterY, outerZ], railColor),
        this.createFieldObjectBox([0.28, railHeight, 0.28], [outerX, railCenterY, innerZ], railColor),
        this.createFieldObjectBox([0.12, railHeight + 42, 0.12], [innerX, railCenterY + 21, innerZ], darkRail),
        this.createFieldObjectBox([0.14, railHeight * 0.96, 0.14], [outerX, railCenterY + 4.4, outerZ], signalColor, {
          emissive: signalColor,
          emissiveIntensity: 0.36,
        }),
        this.createFieldObjectBox([cornerInset + 1.08, 0.5, cornerInset + 1.08], [outerX - (sx * cornerInset * 0.5), elevatorHeight + 0.26, outerZ - (sz * cornerInset * 0.5)], 0x35454d),
      );

      for (let y = elevatorHeight + 10; y < railHeight; y += 56) {
        trackGroup.add(
          this.createFieldObjectBox([cornerInset + 0.48, 0.18, 0.22], [outerX - (sx * cornerInset * 0.5), y, outerZ], braceColor),
          this.createFieldObjectBox([0.22, 0.18, cornerInset + 0.48], [outerX, y + 1.8, outerZ - (sz * cornerInset * 0.5)], braceColor),
        );
      }
    });
  }

  private setObjectFogEnabled(root: THREE.Object3D, enabled: boolean): void {
    root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) {
        return;
      }

      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        const fogMaterial = material as THREE.Material & { fog?: boolean };
        if (fogMaterial.fog === enabled) {
          return;
        }
        fogMaterial.fog = enabled;
        fogMaterial.needsUpdate = true;
      });
    });
  }

  private isOuterDeckOpenWorldRuntimeMap(): boolean {
    return this.options.map.metadata?.kind === "outerDeckOpenWorld";
  }

  private getOuterDeckWorldTileFieldPoint(worldTileX: number, worldTileY: number): { x: number; y: number } | null {
    const metadata = this.options.map.metadata;
    if (metadata?.kind !== "outerDeckOpenWorld") {
      return null;
    }

    const worldOriginTileX = Number(metadata.worldOriginTileX);
    const worldOriginTileY = Number(metadata.worldOriginTileY);
    if (!Number.isFinite(worldOriginTileX) || !Number.isFinite(worldOriginTileY)) {
      return null;
    }

    return {
      x: (worldTileX - worldOriginTileX) * HAVEN3D_FIELD_TILE_SIZE,
      y: (worldTileY - worldOriginTileY) * HAVEN3D_FIELD_TILE_SIZE,
    };
  }

  private createDistantHavenLandmarkGroup(): THREE.Group {
    const group = new THREE.Group();
    group.name = "DistantHavenSkylineLandmark";
    const width = OUTER_DECK_HAVEN_LANDMARK.width * HAVEN3D_WORLD_TILE_SIZE;
    const depth = OUTER_DECK_HAVEN_LANDMARK.height * HAVEN3D_WORLD_TILE_SIZE;
    const height = OUTER_DECK_HAVEN_LANDMARK.visualHeightWorld;
    const fakeSourceObject: FieldObject = {
      id: "distant_haven_skyline",
      x: 0,
      y: 0,
      width: OUTER_DECK_HAVEN_LANDMARK.width,
      height: OUTER_DECK_HAVEN_LANDMARK.height,
      type: "decoration",
      metadata: {
        skylineTrackHeightWorld: OUTER_DECK_HAVEN_LANDMARK.skylineTrackHeightWorld,
      },
    };

    this.addHavenCargoElevatorSkylineTracks(group, width, depth, height, fakeSourceObject);
    group.add(
      this.createFieldObjectBox([width + 4.4, 1.2, depth + 3.2], [0, height * 0.42, 0], 0x101820, {
        emissive: 0x092b3a,
        emissiveIntensity: 0.38,
      }),
      this.createFieldObjectBox([width * 0.24, 0.34, 1.1], [0, height + 1.1, depth / 2 + 1.2], 0x74d7ff, {
        emissive: 0x3bc9ff,
        emissiveIntensity: 1.65,
      }),
    );

    addInvertedHullOutlines(group, ARDYCIA_TOON_OUTLINE_SCALE.architecture);
    this.setObjectFogEnabled(group, false);
    group.visible = false;
    return group;
  }

  private buildDistantHavenLandmark(): void {
    if (!this.isOuterDeckOpenWorldRuntimeMap()) {
      return;
    }

    const hasPhysicalHaven = this.options.map.objects.some((object) => object.metadata?.havenCargoElevatorExterior === true);
    if (hasPhysicalHaven) {
      return;
    }

    this.distantHavenLandmark = this.createDistantHavenLandmarkGroup();
    this.worldGroup.add(this.distantHavenLandmark);
    this.updateDistantHavenLandmark();
  }

  private updateDistantHavenLandmark(): void {
    const group = this.distantHavenLandmark;
    if (!group) {
      return;
    }

    const avatar = this.options.getPlayerAvatar("P1");
    const centerPoint = this.getOuterDeckWorldTileFieldPoint(
      OUTER_DECK_HAVEN_LANDMARK.worldX + (OUTER_DECK_HAVEN_LANDMARK.width / 2),
      OUTER_DECK_HAVEN_LANDMARK.worldY + (OUTER_DECK_HAVEN_LANDMARK.height / 2),
    );
    if (!avatar || !centerPoint) {
      group.visible = false;
      return;
    }

    const playerWorld = fieldToHavenWorld(this.options.map, { x: avatar.x, y: avatar.y }, 0);
    const trueWorld = fieldToHavenWorld(this.options.map, centerPoint, 0);
    const dx = trueWorld.x - playerWorld.x;
    const dz = trueWorld.z - playerWorld.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.001) {
      group.visible = false;
      return;
    }

    const drawDistance = Math.min(distance, OUTER_DECK_HAVEN_LANDMARK.maxTrueDistanceWorld);
    const directionX = dx / distance;
    const directionZ = dz / distance;
    const distanceScale = Math.max(
      OUTER_DECK_HAVEN_LANDMARK.minScale,
      Math.min(1, OUTER_DECK_HAVEN_LANDMARK.maxTrueDistanceWorld / Math.max(distance, 1)),
    );
    group.position.set(
      playerWorld.x + (directionX * drawDistance),
      0,
      playerWorld.z + (directionZ * drawDistance),
    );
    group.scale.setScalar(distanceScale);
    group.visible = true;
  }

  private createOuterDeckFieldObjectGroup(
    placement: Haven3DSceneObjectPlacement,
    sourceObject: FieldObject | undefined,
  ): THREE.Group | null {
    const sprite = sourceObject?.sprite ?? "";
    const width = placement.worldSize.width;
    const depth = placement.worldSize.depth;
    const group = new THREE.Group();

    switch (sprite) {
      case "haven_cargo_elevator_exterior":
        return this.createHavenCargoElevatorExteriorGroup(placement, sourceObject);
      case "resource": {
        group.add(
          this.createFieldObjectBox([0.62, 0.16, 0.62], [0, 0.13, 0], 0x24463a),
          this.createFieldObjectBox([0.44, 0.44, 0.44], [0, 0.58, 0], 0x70c58c, {
            emissive: 0x143d2a,
            emissiveIntensity: 0.72,
            rotation: [0.58, 0.74, 0.18],
          }),
          this.createFieldObjectBox([0.18, 0.12, 0.18], [0, 0.91, 0], 0xc4e9a4, {
            emissive: 0x315f31,
            emissiveIntensity: 0.62,
            rotation: [0.2, 0.74, 0.2],
          }),
        );
        break;
      }
      case "theater_chart": {
        const chartMaterial = createArdyciaToonMaterial({
          color: 0x7cc7d6,
          emissive: 0x103b52,
          emissiveIntensity: 0.62,
          side: THREE.DoubleSide,
        });
        const scroll = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.045, 0.42), chartMaterial);
        scroll.position.set(0, 0.42, 0);
        scroll.rotation.set(-0.18, 0.52, 0.08);
        scroll.castShadow = true;
        group.add(
          this.createFieldObjectBox([0.72, 0.12, 0.48], [0, 0.08, 0], 0x243c4c),
          scroll,
          this.createFieldObjectBox([0.08, 0.16, 0.48], [-0.34, 0.43, 0], 0xc49a52),
          this.createFieldObjectBox([0.08, 0.16, 0.48], [0.34, 0.43, 0], 0xc49a52),
        );
        break;
      }
      case "apron_key": {
        const keyMaterial = createArdyciaToonMaterial({
          color: 0xf2c15a,
          emissive: 0x5b3308,
          emissiveIntensity: 0.72,
        });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 22), keyMaterial);
        ring.position.set(-0.12, 0.58, 0);
        ring.rotation.x = Math.PI / 2;
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.08), keyMaterial);
        shaft.position.set(0.14, 0.58, 0);
        shaft.castShadow = true;
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.08), keyMaterial);
        tooth.position.set(0.34, 0.51, 0);
        tooth.castShadow = true;
        group.add(
          this.createFieldObjectBox([0.56, 0.12, 0.56], [0, 0.1, 0], 0x3e3425),
          ring,
          shaft,
          tooth,
        );
        break;
      }
      case "apron_lantern": {
        const frameMaterial = createArdyciaToonMaterial({ color: 0x5a3a24 });
        const glowMaterial = createArdyciaToonMaterial({
          color: 0xffd483,
          emissive: 0xffba55,
          emissiveIntensity: 2.8,
        });
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.05, 8), frameMaterial);
        post.position.y = 0.55;
        post.castShadow = true;
        const cage = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.28), frameMaterial);
        cage.position.y = 0.31;
        cage.castShadow = true;
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), glowMaterial);
        glow.position.y = 0.31;
        group.add(
          this.createFieldObjectBox([0.52, 0.1, 0.52], [0, 0.05, 0], 0x2b2720),
          post,
          cage,
          glow,
        );
        break;
      }
      case "traveling_merchant_cart": {
        const cartWidth = Math.max(1.7, width * 0.82);
        const cartDepth = Math.max(1.5, depth * 0.78);
        const canopyHeight = 1.55;
        group.add(
          this.createFieldObjectBox([cartWidth, 0.22, cartDepth], [0, 0.18, 0], 0x4b3325),
          this.createFieldObjectBox([cartWidth * 0.82, 0.72, cartDepth * 0.72], [0, 0.62, 0], 0x9b6a36, {
            emissive: 0x2b1306,
            emissiveIntensity: 0.14,
          }),
          this.createFieldObjectBox([cartWidth * 0.98, 0.16, cartDepth * 0.86], [0, canopyHeight, 0], 0x456a56, {
            emissive: 0x0b281d,
            emissiveIntensity: 0.18,
          }),
          this.createFieldObjectBox([cartWidth * 0.84, 0.1, cartDepth * 0.94], [0, canopyHeight + 0.18, 0], 0xdbc27a),
          this.createFieldObjectBox([0.1, 1.34, 0.1], [-cartWidth * 0.43, 0.84, -cartDepth * 0.38], 0x5e4630),
          this.createFieldObjectBox([0.1, 1.34, 0.1], [cartWidth * 0.43, 0.84, -cartDepth * 0.38], 0x5e4630),
          this.createFieldObjectBox([0.1, 1.34, 0.1], [-cartWidth * 0.43, 0.84, cartDepth * 0.38], 0x5e4630),
          this.createFieldObjectBox([0.1, 1.34, 0.1], [cartWidth * 0.43, 0.84, cartDepth * 0.38], 0x5e4630),
          this.createFieldObjectBox([0.38, 0.38, 0.18], [-cartWidth * 0.48, 0.24, cartDepth * 0.42], 0x231b18),
          this.createFieldObjectBox([0.38, 0.38, 0.18], [cartWidth * 0.48, 0.24, cartDepth * 0.42], 0x231b18),
          this.createFieldObjectBox([0.38, 0.38, 0.18], [-cartWidth * 0.48, 0.24, -cartDepth * 0.42], 0x231b18),
          this.createFieldObjectBox([0.38, 0.38, 0.18], [cartWidth * 0.48, 0.24, -cartDepth * 0.42], 0x231b18),
          this.createFieldObjectBox([0.5, 0.34, 0.44], [-cartWidth * 0.18, 1.02, -cartDepth * 0.12], 0x6c4b2f),
          this.createFieldObjectBox([0.42, 0.28, 0.38], [cartWidth * 0.24, 1.0, 0.16], 0x7a5d3b),
        );
        break;
      }
      case "zipline_track": {
        return this.createZiplineTrackVisual(placement, sourceObject);
      }
      case "bulkhead": {
        const postHeight = 2.45;
        const postInset = Math.max(0.22, Math.min(width * 0.32, 0.56));
        group.add(
          this.createFieldObjectBox([0.32, postHeight, Math.max(0.5, depth * 0.82)], [-width / 2 + postInset, postHeight / 2, 0], 0x394449),
          this.createFieldObjectBox([0.32, postHeight, Math.max(0.5, depth * 0.82)], [width / 2 - postInset, postHeight / 2, 0], 0x394449),
          this.createFieldObjectBox([Math.max(0.9, width * 0.9), 0.42, Math.max(0.46, depth * 0.68)], [0, postHeight + 0.18, 0], 0x56666b),
          this.createFieldObjectBox([Math.max(0.45, width * 0.46), 0.18, Math.max(0.42, depth * 0.7)], [0, 1.12, 0], 0xa06936, {
            emissive: 0x321407,
            emissiveIntensity: 0.18,
          }),
        );
        break;
      }
      case "terminal": {
        group.add(
          this.createFieldObjectBox([0.62, 0.78, 0.48], [0, 0.39, 0.04], 0x3b4143),
          this.createFieldObjectBox([0.72, 0.16, 0.52], [0, 0.84, -0.03], 0x545d60, { rotation: [-0.2, 0, 0] }),
          this.createFieldObjectBox([0.52, 0.08, 0.36], [0, 0.94, -0.11], 0x57c2a4, {
            emissive: 0x0c4339,
            emissiveIntensity: 0.86,
            rotation: [-0.2, 0, 0],
          }),
        );
        break;
      }
      case "crate_stack": {
        group.add(
          this.createFieldObjectBox([0.76, 0.58, 0.68], [-0.22, 0.29, 0.12], 0x6c5133),
          this.createFieldObjectBox([0.68, 0.52, 0.58], [0.34, 0.26, -0.16], 0x7a6040),
          this.createFieldObjectBox([0.56, 0.48, 0.54], [0.02, 0.83, -0.04], 0x8a6d45),
          this.createFieldObjectBox([0.08, 0.16, 0.62], [-0.12, 0.91, -0.04], 0xc39c49),
        );
        break;
      }
      case "shaft_column": {
        const columnHeight = Math.max(4.8, Math.min(7.4, depth * 0.48));
        const columnWidth = Math.max(0.64, Math.min(1.15, width * 0.48));
        group.add(
          this.createFieldObjectBox([columnWidth, columnHeight, Math.max(0.58, width * 0.38)], [0, columnHeight / 2, 0], 0x485257),
          this.createFieldObjectBox([columnWidth * 1.18, 0.18, Math.max(0.74, width * 0.52)], [0, 1.22, 0], 0x6c5739),
          this.createFieldObjectBox([columnWidth * 1.18, 0.18, Math.max(0.74, width * 0.52)], [0, 2.55, 0], 0x6c5739),
          this.createFieldObjectBox([columnWidth * 1.18, 0.18, Math.max(0.74, width * 0.52)], [0, 3.88, 0], 0x6c5739),
        );
        break;
      }
      case "catwalk": {
        const deckHeight = 0.72;
        const railZ = Math.max(0.28, depth * 0.48);
        group.add(
          this.createFieldObjectBox([Math.max(1.0, width), 0.16, Math.max(0.5, depth * 0.72)], [0, deckHeight, 0], 0x5f5648),
          this.createFieldObjectBox([Math.max(1.0, width), 0.1, 0.08], [0, deckHeight + 0.48, -railZ], 0x8a7145),
          this.createFieldObjectBox([Math.max(1.0, width), 0.1, 0.08], [0, deckHeight + 0.48, railZ], 0x8a7145),
          this.createFieldObjectBox([0.08, 0.58, 0.08], [-width / 2 + 0.28, deckHeight + 0.24, -railZ], 0x8a7145),
          this.createFieldObjectBox([0.08, 0.58, 0.08], [width / 2 - 0.28, deckHeight + 0.24, railZ], 0x8a7145),
        );
        break;
      }
      case "conveyor": {
        group.add(
          this.createFieldObjectBox([Math.max(1.0, width), 0.28, Math.max(0.48, depth * 0.72)], [0, 0.28, 0], 0x363f42),
          this.createFieldObjectBox([Math.max(0.9, width * 0.92), 0.09, Math.max(0.34, depth * 0.48)], [0, 0.48, 0], 0x22272a),
          this.createFieldObjectBox([0.12, 0.18, Math.max(0.46, depth * 0.68)], [-width * 0.32, 0.58, 0], 0xa46f38),
          this.createFieldObjectBox([0.12, 0.18, Math.max(0.46, depth * 0.68)], [0, 0.58, 0], 0xa46f38),
          this.createFieldObjectBox([0.12, 0.18, Math.max(0.46, depth * 0.68)], [width * 0.32, 0.58, 0], 0xa46f38),
        );
        break;
      }
      case "sorter": {
        group.add(
          this.createFieldObjectBox([Math.max(0.88, width * 0.72), 1.15, Math.max(0.82, depth * 0.72)], [0, 0.58, 0], 0x50565a),
          this.createFieldObjectBox([Math.max(0.56, width * 0.44), 0.34, Math.max(0.42, depth * 0.48)], [0.16, 1.32, -0.12], 0x354044),
          this.createFieldObjectBox([0.16, 0.18, Math.max(0.72, depth * 0.76)], [-0.42, 0.8, 0], 0x72c8a5, {
            emissive: 0x0c4339,
            emissiveIntensity: 0.58,
          }),
        );
        break;
      }
      case "radio": {
        const mastMaterial = createArdyciaToonMaterial({ color: 0x495156 });
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 2.2, 10), mastMaterial);
        mast.position.y = 1.1;
        mast.castShadow = true;
        mast.receiveShadow = true;
        const dish = new THREE.Mesh(
          new THREE.ConeGeometry(0.36, 0.16, 18, 1, true),
          createArdyciaToonMaterial({
            color: 0x72c8a5,
            emissive: 0x0c4339,
            emissiveIntensity: 0.46,
            side: THREE.DoubleSide,
          }),
        );
        dish.position.set(0.22, 1.86, 0.12);
        dish.rotation.set(Math.PI / 2, 0.1, -0.42);
        group.add(
          this.createFieldObjectBox([0.62, 0.18, 0.52], [0, 0.09, 0], 0x4d3a2a),
          mast,
          dish,
        );
        break;
      }
      default:
        return null;
    }

    addInvertedHullOutlines(group, ARDYCIA_TOON_OUTLINE_SCALE.prop);
    return group;
  }

  private createFieldObjectGroup(
    placement: Haven3DSceneObjectPlacement,
    sourceObject: FieldObject | undefined,
  ): THREE.Group {
    const group = this.createRouteFieldObjectGroup(placement, sourceObject)
      ?? this.createSimpleDoorwayGroup(placement, sourceObject)
      ?? this.createHavenBuildingGroup(placement, sourceObject)
      ?? (usesOuterDeck3DSetDressing(this.options.map)
      ? this.createOuterDeckFieldObjectGroup(placement, sourceObject) ?? this.createGenericFieldObjectGroup(placement)
      : this.createGenericFieldObjectGroup(placement));
    this.addFieldObjectLabel(group, placement);
    return group;
  }

  private buildFieldObjects(): void {
    const sourceObjectsById = new Map(this.options.map.objects.map((object) => [object.id, object]));
    createHaven3DSceneLayout(this.options.map).objects
      .forEach((object) => {
        const sourceObject = sourceObjectsById.get(object.id);
        const group = this.createFieldObjectGroup(object, sourceObject);
        group.name = `Haven3DFieldObject:${object.id}`;
        group.position.set(object.worldCenter.x, object.worldCenter.y, object.worldCenter.z);
        this.fieldObjectGroups.set(object.id, group);
        if (sourceObject) {
          this.fieldObjectsById.set(object.id, sourceObject);
        }
        this.worldGroup.add(group);
      });
    this.syncFieldObjectVisibility();
  }

  private syncFieldObjectVisibility(): void {
    for (const [objectId, group] of this.fieldObjectGroups.entries()) {
      const visible = this.options.isFieldObjectVisible?.(objectId, this.fieldObjectsById.get(objectId)) ?? true;
      if (group.visible !== visible) {
        group.visible = visible;
      }
    }
  }

  private createPlayerActor(playerId: PlayerId, color: number): void {
    const group = new THREE.Group();
    group.name = `Haven3DPlayer${playerId}`;

    const coat = createArdyciaToonMaterial({ color });
    const skin = createArdyciaToonMaterial({ color: 0xd8b79c });
    const leather = createArdyciaToonMaterial({ color: 0x231d19 });
    const brass = createArdyciaToonMaterial({ color: 0xb88745 });
    const gearEdge = createArdyciaToonMaterial({
      color: 0xc8b16f,
      emissive: 0x2b1708,
      emissiveIntensity: 0.18,
    });

    const anatomy = createChibiAnatomy({
      bodyMaterial: coat,
      headMaterial: skin,
      accentMaterial: brass,
    });
    const shoulderStrap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.045, 0.12), leather);
    shoulderStrap.position.set(0.12, 1.02, -0.03);
    shoulderStrap.rotation.set(0.08, -0.18, -0.24);
    shoulderStrap.castShadow = true;
    const blade = new THREE.Group();
    blade.position.copy(BLADE_BACK_POSITION);
    blade.rotation.copy(BLADE_BACK_ROTATION);
    blade.scale.setScalar(1);

    const bladeForm = new THREE.Group();
    bladeForm.name = "GearbladeBladeForm";
    const launcherForm = new THREE.Group();
    launcherForm.name = "GearbladeLauncherForm";
    launcherForm.visible = false;

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.42), leather);
    grip.position.z = -0.16;
    grip.castShadow = true;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.08), brass);
    guard.position.z = 0.08;
    guard.castShadow = true;
    const bladeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.08, 1.28),
      gearEdge,
    );
    bladeMesh.position.z = 0.8;
    bladeMesh.castShadow = true;
    const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 4), gearEdge);
    bladeTip.position.z = 1.56;
    bladeTip.rotation.x = Math.PI / 2;
    bladeTip.castShadow = true;
    const bladeTrail = new THREE.Mesh(
      new THREE.PlaneGeometry(2.22, 0.44),
      new THREE.MeshBasicMaterial({
        color: 0xf6d28a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    bladeTrail.name = "bladeTrail";
    bladeTrail.position.set(0.02, 0.006, 0.92);
    bladeTrail.rotation.x = Math.PI / 2;
    bladeTrail.visible = false;
    bladeForm.add(grip, guard, bladeMesh, bladeTip, bladeTrail);

    const launcherCoreMaterial = createArdyciaToonMaterial({
      color: 0x7be3ef,
      emissive: 0x1a6e83,
      emissiveIntensity: 0.8,
    });
    const launcherEmitterMaterial = createArdyciaToonMaterial({
      color: 0xffdd97,
      emissive: 0xa85514,
      emissiveIntensity: 1.2,
    });
    const launcherFrame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.46), brass);
    launcherFrame.position.set(0, 0.04, 0.16);
    launcherFrame.castShadow = true;
    const launcherUpper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.42), gearEdge);
    launcherUpper.position.set(0, 0.12, 0.16);
    launcherUpper.castShadow = true;
    const launcherBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.58), gearEdge);
    launcherBarrel.position.set(0, 0.08, 0.54);
    launcherBarrel.castShadow = true;
    const launcherMuzzle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), launcherEmitterMaterial);
    launcherMuzzle.position.set(0, 0.08, 0.86);
    launcherMuzzle.castShadow = true;
    const launcherGrip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.14), leather);
    launcherGrip.position.set(0, -0.16, -0.02);
    launcherGrip.rotation.x = 0.26;
    launcherGrip.castShadow = true;
    const launcherCell = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.22), launcherCoreMaterial);
    launcherCell.position.set(0.07, -0.02, 0.1);
    launcherCell.rotation.z = -0.08;
    launcherCell.castShadow = true;
    const launcherRearCap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.16), brass);
    launcherRearCap.position.set(0, 0.06, -0.14);
    launcherRearCap.castShadow = true;
    const launcherTriggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 6, 14), brass);
    launcherTriggerGuard.position.set(0, -0.08, 0.02);
    launcherTriggerGuard.rotation.x = Math.PI / 2;
    launcherForm.add(
      launcherFrame,
      launcherUpper,
      launcherBarrel,
      launcherMuzzle,
      launcherGrip,
      launcherCell,
      launcherRearCap,
      launcherTriggerGuard,
    );
    blade.add(bladeForm, launcherForm);

    const waistLantern = new THREE.Group();
    waistLantern.name = "ApronWaistLantern";
    waistLantern.position.set(0.27, 0.04, 0.26);
    waistLantern.rotation.set(0.04, -0.18, -0.08);
    const lanternHook = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.06), brass);
    lanternHook.position.set(0, 0.14, -0.025);
    lanternHook.castShadow = true;
    const lanternFrame = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.21, 0.13), brass);
    lanternFrame.position.y = -0.02;
    lanternFrame.castShadow = true;
    const lanternCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 8),
      createArdyciaToonMaterial({
        color: 0xffd37c,
        emissive: 0xffb64e,
        emissiveIntensity: 1.45,
      }),
    );
    lanternCore.position.y = -0.02;
    const lanternHandle = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.011, 6, 16), brass);
    lanternHandle.position.y = 0.09;
    lanternHandle.rotation.x = Math.PI / 2;
    const lanternLight = new THREE.PointLight(0xffc067, 1.55, 6.8, 1.55);
    lanternLight.position.set(0, -0.02, 0.04);
    waistLantern.add(lanternHook, lanternFrame, lanternCore, lanternHandle, lanternLight);
    anatomy.pelvis.add(waistLantern);

    attachApronGlider(anatomy);
    anatomy.root.add(shoulderStrap, blade);
    addInvertedHullOutlines(anatomy.root, ARDYCIA_TOON_OUTLINE_SCALE.character);
    group.add(anatomy.root);
    this.dynamicGroup.add(group);
    this.playerActors.set(playerId, {
      group,
      chibi: anatomy,
      blade,
      bladeTrail,
      weaponBladeForm: bladeForm,
      weaponLauncherForm: launcherForm,
    });
  }

  private createSableActor(): Actor {
    const group = new THREE.Group();
    group.name = "Haven3DCompanion:Sable";

    const coat = createArdyciaToonMaterial({ color: 0xb46252 });
    const shadowCoat = createArdyciaToonMaterial({ color: 0x73302b });
    const whiteFur = createArdyciaToonMaterial({ color: 0xeadfd2 });
    const warmShadowFur = createArdyciaToonMaterial({ color: 0xa69184 });
    const pawMaterial = createArdyciaToonMaterial({ color: 0x4b3028 });
    const leather = createArdyciaToonMaterial({ color: 0x3f2115 });
    const brass = createArdyciaToonMaterial({ color: 0xb78e43 });
    const collarMaterial = createArdyciaToonMaterial({
      color: 0x245a4f,
      emissive: 0x0b2c27,
      emissiveIntensity: 0.26,
    });
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x050505 });

    const root = new THREE.Group();
    root.name = "SableRigRoot";
    root.position.y = 0.13;

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 14), coat);
    body.name = "SableBody";
    body.position.set(0, 0.62, -0.05);
    body.scale.set(0.96, 0.64, 1.72);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.27, 18, 12), whiteFur);
    belly.name = "SableBellyPatch";
    belly.position.set(0, 0.51, 0.16);
    belly.scale.set(0.86, 0.46, 1.34);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.31, 18, 12), whiteFur);
    chest.name = "SableChest";
    chest.position.set(0, 0.7, 0.48);
    chest.scale.set(0.82, 0.82, 0.92);

    const neck = createChibiCapsule(0.12, 0.26, coat, [0, 0.76, 0.5], [Math.PI / 2, 0, 0]);
    neck.name = "SableNeck";
    neck.scale.set(1.06, 0.94, 0.94);

    const head = new THREE.Group();
    head.name = "SableHead";
    head.position.set(0, 0.96, 0.72);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 14), coat);
    headMesh.name = "SableHeadMesh";
    headMesh.scale.set(0.9, 0.78, 0.95);
    const faceMask = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 10), whiteFur);
    faceMask.name = "SableFaceMask";
    faceMask.position.set(0, -0.02, 0.13);
    faceMask.scale.set(0.82, 0.66, 0.52);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.32), whiteFur);
    snout.name = "SableSnout";
    snout.position.set(0, -0.06, 0.27);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), shadowCoat);
    nose.name = "SableNose";
    nose.position.set(0, -0.04, 0.44);
    nose.scale.set(1.32, 0.74, 0.7);
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.029, 8, 6), eyeMaterial);
    leftEye.name = "SableLeftEye";
    leftEye.position.set(-0.092, 0.055, 0.235);
    const rightEye = leftEye.clone();
    rightEye.name = "SableRightEye";
    rightEye.position.x = 0.092;
    const leftEar = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.36, 4), coat);
    leftEar.name = "SableLeftEar";
    leftEar.position.set(-0.15, 0.21, -0.03);
    leftEar.rotation.set(0.14, 0.18, -0.28);
    const rightEar = leftEar.clone();
    rightEar.name = "SableRightEar";
    rightEar.position.x = 0.15;
    rightEar.rotation.set(0.14, -0.18, 0.28);
    const leftInnerEar = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.26, 4), warmShadowFur);
    leftInnerEar.name = "SableLeftInnerEar";
    leftInnerEar.position.set(-0.15, 0.205, 0.01);
    leftInnerEar.rotation.copy(leftEar.rotation);
    const rightInnerEar = leftInnerEar.clone();
    rightInnerEar.name = "SableRightInnerEar";
    rightInnerEar.position.x = 0.15;
    rightInnerEar.rotation.copy(rightEar.rotation);
    head.add(headMesh, faceMask, snout, nose, leftEye, rightEye, leftEar, rightEar, leftInnerEar, rightInnerEar);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 8, 24), collarMaterial);
    collar.name = "SableCollar";
    collar.position.set(0, 0.77, 0.52);
    collar.scale.set(1.18, 0.78, 1);

    const scarfShape = new THREE.Shape();
    scarfShape.moveTo(-0.31, 0.12);
    scarfShape.lineTo(0.34, 0.1);
    scarfShape.lineTo(0.04, -0.43);
    scarfShape.lineTo(-0.31, 0.12);
    const scarf = new THREE.Mesh(
      new THREE.ShapeGeometry(scarfShape),
      createArdyciaToonMaterial({
        color: 0x245a4f,
        emissive: 0x0b2c27,
        emissiveIntensity: 0.18,
        side: THREE.DoubleSide,
      }),
    );
    scarf.name = "SableKerchief";
    scarf.position.set(0, 0.72, 0.72);
    scarf.rotation.set(-0.1, 0, 0.04);

    const tail = new THREE.Group();
    tail.name = "SableTail";
    tail.position.set(0, 0.71, -0.76);
    tail.rotation.set(-0.46, 0, 0);
    const tailCurlRadius = 0.24;
    const tailCurl = new THREE.Mesh(new THREE.TorusGeometry(tailCurlRadius, 0.065, 10, 28, Math.PI * 1.52), coat);
    tailCurl.name = "SableTailCurl";
    tailCurl.position.set(0, 0.04, -0.1);
    tailCurl.rotation.set(0.24, Math.PI / 2, -0.36);
    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), whiteFur);
    tailTip.name = "SableTailTip";
    tailTip.position.set(tailCurlRadius, 0, 0);
    tailTip.scale.set(0.85, 0.7, 1.1);
    tailCurl.add(tailTip);
    tail.add(tailCurl);

    const saddlebag = new THREE.Group();
    saddlebag.name = "SableSideBag";
    saddlebag.position.set(-0.42, 0.58, -0.16);
    saddlebag.rotation.set(0.02, 0.06, -0.04);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.42), leather);
    bag.name = "SableBag";
    bag.castShadow = true;
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.06, 0.36), shadowCoat);
    flap.name = "SableBagFlap";
    flap.position.set(-0.005, 0.12, 0);
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), brass);
    clasp.name = "SableBagClasp";
    clasp.position.set(-0.095, 0.03, 0.12);
    saddlebag.add(bag, flap, clasp);

    const createLeg = (name: string, x: number, z: number, outward: number): THREE.Group => {
      const leg = new THREE.Group();
      leg.name = name;
      leg.position.set(x, 0.52, z);
      leg.rotation.z = outward;
      const upper = createChibiCapsule(0.065, 0.27, coat, [0, -0.17, 0.005]);
      upper.name = `${name}Upper`;
      upper.scale.set(0.9, 1.02, 0.9);
      const lowerMaterial = name.includes("Front") ? whiteFur : warmShadowFur;
      const lower = createChibiCapsule(0.056, 0.21, lowerMaterial, [0, -0.39, 0.02]);
      lower.name = `${name}Lower`;
      lower.scale.set(0.86, 1.04, 0.86);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), name.includes("Front") ? whiteFur : pawMaterial);
      paw.name = `${name}Paw`;
      paw.position.set(0, -0.54, 0.08);
      paw.scale.set(1.05, 0.44, 1.46);
      leg.add(upper, lower, paw);
      return leg;
    };

    const frontLeftLeg = createLeg("SableFrontLeftLeg", -0.2, 0.43, -0.055);
    const frontRightLeg = createLeg("SableFrontRightLeg", 0.2, 0.43, 0.055);
    const rearLeftLeg = createLeg("SableRearLeftLeg", -0.21, -0.5, -0.045);
    const rearRightLeg = createLeg("SableRearRightLeg", 0.21, -0.5, 0.045);

    root.add(
      body,
      belly,
      chest,
      neck,
      head,
      collar,
      scarf,
      tail,
      saddlebag,
      frontLeftLeg,
      frontRightLeg,
      rearLeftLeg,
      rearRightLeg,
    );
    root.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    addInvertedHullOutlines(root, 1.064);

    group.add(root);
    this.dynamicGroup.add(group);

    return {
      group,
      sable: {
        root,
        body,
        chest,
        head,
        snout,
        tail,
        frontLeftLeg,
        frontRightLeg,
        rearLeftLeg,
        rearRightLeg,
      },
    };
  }

  private createNpcActor(npc: FieldNpc): Actor {
    const group = new THREE.Group();
    group.name = `Haven3DNpc:${npc.id}`;
    const material = createArdyciaToonMaterial({ color: 0x4f7f76 });
    const brass = createArdyciaToonMaterial({ color: 0xb58b4c });
    const skin = createArdyciaToonMaterial({ color: 0xd4b69e });
    const anatomy = createChibiAnatomy({
      bodyMaterial: material,
      headMaterial: skin,
      accentMaterial: brass,
    });
    addInvertedHullOutlines(anatomy.root, ARDYCIA_TOON_OUTLINE_SCALE.character);
    const label = createLabelSprite(npc.name, { accent: "rgba(103, 202, 181, 0.72)", width: 320 });
    label.position.y = 2.48;
    const targetRing = createTargetRing(0x67cab5);
    group.add(anatomy.root, label, targetRing);
    this.dynamicGroup.add(group);
    return { group, chibi: anatomy, label, targetRing };
  }

  private createEnemyActor(enemy: FieldEnemy): Actor {
    const group = new THREE.Group();
    group.name = `Haven3DEnemy:${enemy.id}`;
    const hide = createArdyciaToonMaterial({ color: 0x8a2f36 });
    const core = createArdyciaToonMaterial({
      color: 0xf2a14b,
      emissive: 0x3d1208,
      emissiveIntensity: 0.35,
    });
    const anatomy = createChibiAnatomy({
      bodyMaterial: hide,
      headMaterial: hide,
      accentMaterial: core,
    });
    addInvertedHullOutlines(anatomy.root, ARDYCIA_TOON_OUTLINE_SCALE.enemy);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.2), core);
    crest.position.set(0, 1.34, 0.3);
    crest.castShadow = true;
    addInvertedHullOutlines(crest, ARDYCIA_TOON_OUTLINE_SCALE.prop);
    const label = createLabelSprite(enemy.name, { accent: "rgba(242, 112, 74, 0.76)", width: 340 });
    label.position.y = 2.48;
    const targetRing = createTargetRing(0xf2704a);
    const telegraph = new THREE.Mesh(
      new THREE.PlaneGeometry(1.26, 1.85),
      new THREE.MeshBasicMaterial({
        color: 0xff4c3e,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    telegraph.rotation.x = -Math.PI / 2;
    telegraph.position.set(0, 0.075, 0.88);
    telegraph.visible = false;
    telegraph.renderOrder = 4;
    const defenseShield = new THREE.Group();
    const shieldRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.045, 10, 32),
      new THREE.MeshBasicMaterial({
        color: 0x66dbc9,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    shieldRing.rotation.x = Math.PI / 2;
    shieldRing.position.y = 1.04;
    const shieldBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.025, 8, 28),
      new THREE.MeshBasicMaterial({
        color: 0xa7fff1,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    shieldBand.position.y = 1.04;
    defenseShield.add(shieldRing, shieldBand);
    defenseShield.visible = false;

    const defenseArmor = new THREE.Group();
    const armorMaterial = createArdyciaToonMaterial({
      color: 0xd49b45,
      emissive: 0x3c2206,
      emissiveIntensity: 0.28,
    });
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.42, 0.08), armorMaterial);
    chestPlate.position.set(0, 1.0, -0.3);
    chestPlate.castShadow = true;
    const shoulderPlate = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.12, 0.16), armorMaterial);
    shoulderPlate.position.set(0, 1.18, 0);
    shoulderPlate.castShadow = true;
    defenseArmor.add(chestPlate, shoulderPlate);
    addInvertedHullOutlines(defenseArmor, ARDYCIA_TOON_OUTLINE_SCALE.armor);
    defenseArmor.visible = false;

    group.add(anatomy.root, crest, label, targetRing, telegraph, defenseShield, defenseArmor);
    this.dynamicGroup.add(group);
    return {
      group,
      chibi: anatomy,
      label,
      targetRing,
      telegraph,
      defenseShield,
      defenseArmor,
      hitMaterials: [
        { material: hide, baseEmissive: 0x000000, baseIntensity: 0 },
        { material: core, baseEmissive: 0x3d1208, baseIntensity: 0.35 },
      ],
    };
  }

  private loop(currentTime: number): void {
    if (this.disposed) {
      return;
    }

    this.currentFrameTime = currentTime;
    const deltaMs = Math.min(50, Math.max(1, currentTime - this.lastFrameTime));
    this.lastFrameTime = currentTime;

    const hitstopped = this.hitstopRemainingMs > 0;
    if (hitstopped) {
      this.hitstopRemainingMs = Math.max(0, this.hitstopRemainingMs - deltaMs);
    }

    if (!this.options.isPaused() && !hitstopped) {
      this.updatePlayerVertical(deltaMs);
      this.movePlayers(deltaMs);
      this.updateRailRides(deltaMs, currentTime);
      this.updateBladeSwing(deltaMs, currentTime);
      this.updateGrappleMove(deltaMs, currentTime);
      this.updateZiplineDismountDrift(deltaMs, currentTime);
      this.updateLauncherProjectiles(deltaMs);
      this.updateVisualEffects(deltaMs, currentTime);
    }

    if (!hitstopped) {
      this.options.onFrame(deltaMs, currentTime);
    }
    if (this.disposed) {
      return;
    }

    this.syncFieldObjectVisibility();
    this.refreshEffectiveCameraMode();
    this.updateCamera(deltaMs / 1000);
    this.updateDistantHavenLandmark();
    this.updateGrappleAnchors(currentTime);
    this.syncDynamicActors();
    this.syncFieldProjectiles();
    this.syncLootOrbs();
    this.updatePrompt();
    this.renderScene();
    if (this.disposed) {
      return;
    }

    this.animationFrameId = requestAnimationFrame((time) => this.loop(time));
  }

  private movePlayers(deltaMs: number): void {
    (["P1", "P2"] as PlayerId[]).forEach((playerId) => {
      if (!this.isPlayerControllable(playerId)) {
        return;
      }
      if (this.getPlayerGrappleMove(playerId) || this.getPlayerRailRide(playerId)) {
        return;
      }

      const avatar = this.options.getPlayerAvatar(playerId);
      if (!avatar) {
        return;
      }

      const movement = this.getPlayerMovementInputVector(playerId);
      if (!movement) {
        return;
      }

      const verticalState = this.getPlayerVerticalState(playerId);
      const dashActive = this.isPlayerDashActive(playerId, verticalState);
      const speed = PLAYER_SPEED_PX_PER_SECOND
        * (dashActive ? DASH_MULTIPLIER : 1)
        * (verticalState.gliding ? PLAYER_GLIDER_MOVEMENT_MULTIPLIER : 1)
        * this.getActionMovementMultiplier(playerId);
      const step = speed * (deltaMs / 1000);
      const moveX = movement.x;
      const moveY = movement.y;
      let nextX = avatar.x + moveX * step;
      let nextY = avatar.y + moveY * step;
      const lockedTarget = this.getLockedTargetCandidate(playerId);
      const facing = lockedTarget
        ? fieldFacingFromDelta(lockedTarget.x - avatar.x, lockedTarget.y - avatar.y, avatar.facing)
        : fieldFacingFromDelta(nextX - avatar.x, nextY - avatar.y, avatar.facing);

      if (!this.canPlayerMoveTo(playerId, nextX, avatar.y, PLAYER_WIDTH, PLAYER_HEIGHT)) {
        nextX = avatar.x;
      }
      if (!this.canPlayerMoveTo(playerId, nextX, nextY, PLAYER_WIDTH, PLAYER_HEIGHT)) {
        nextY = avatar.y;
      }

      const constrained = this.options.constrainPlayerPosition?.(
        playerId,
        { x: nextX, y: nextY, facing },
        avatar,
      ) ?? { x: nextX, y: nextY, facing };

      this.options.setPlayerAvatar(playerId, constrained.x, constrained.y, constrained.facing);
    });
  }

  private updateZiplineDismountDrift(deltaMs: number, currentTime: number): void {
    (["P1", "P2"] as PlayerId[]).forEach((playerId) => {
      const drift = this.getPlayerZiplineDismountDrift(playerId);
      if (!drift) {
        return;
      }
      if (this.getPlayerGrappleMove(playerId) || !this.isPlayerControllable(drift.playerId)) {
        this.setPlayerZiplineDismountDrift(playerId, null);
        return;
      }

      const avatar = this.options.getPlayerAvatar(drift.playerId);
      if (!avatar) {
        this.setPlayerZiplineDismountDrift(playerId, null);
        return;
      }

      const vertical = this.getPlayerVerticalState(drift.playerId);
      const elapsed = Math.max(0, currentTime - drift.startedAt);
      if (vertical.grounded || elapsed >= drift.durationMs) {
        this.setPlayerZiplineDismountDrift(playerId, null);
        return;
      }

      const t = THREE.MathUtils.clamp(elapsed / Math.max(1, drift.durationMs), 0, 1);
      const falloff = 1 - smoothstep(t);
      const deltaSeconds = Math.min(0.05, Math.max(0, deltaMs / 1000));
      const moveX = drift.vx * falloff * deltaSeconds;
      const moveY = drift.vy * falloff * deltaSeconds;
      if (Math.hypot(moveX, moveY) < 0.01) {
        this.setPlayerZiplineDismountDrift(playerId, null);
        return;
      }

      let nextX = avatar.x + moveX;
      let nextY = avatar.y + moveY;
      const facing = fieldFacingFromDelta(drift.vx, drift.vy, avatar.facing);
      if (!this.canPlayerMoveTo(drift.playerId, nextX, avatar.y, PLAYER_WIDTH, PLAYER_HEIGHT)) {
        nextX = avatar.x;
      }
      if (!this.canPlayerMoveTo(drift.playerId, nextX, nextY, PLAYER_WIDTH, PLAYER_HEIGHT)) {
        nextY = avatar.y;
      }
      if (nextX === avatar.x && nextY === avatar.y) {
        this.setPlayerZiplineDismountDrift(playerId, null);
        return;
      }

      const constrained = this.options.constrainPlayerPosition?.(
        drift.playerId,
        { x: nextX, y: nextY, facing },
        avatar,
      ) ?? { x: nextX, y: nextY, facing };
      this.options.setPlayerAvatar(drift.playerId, constrained.x, constrained.y, constrained.facing);
    });
  }

  private updateRailRides(deltaMs: number, currentTime: number): void {
    (["P1", "P2"] as PlayerId[]).forEach((playerId) => {
      if (this.getPlayerRailRide(playerId)) {
        this.advanceRailRide(playerId, deltaMs, currentTime);
        return;
      }
      this.tryAutoAttachPlayerToRail(playerId, currentTime);
    });
  }

  private tryAutoAttachPlayerToRail(playerId: PlayerId, currentTime: number): void {
    if (
      !this.isPlayerControllable(playerId)
      || this.options.isPaused()
      || this.getPlayerGrappleMove(playerId)
      || currentTime < this.getPlayerRailAttachCooldownUntil(playerId)
    ) {
      return;
    }
    const candidate = this.findGrindRailAttachCandidate(playerId, currentTime);
    if (!candidate) {
      return;
    }
    this.beginRailRide(playerId, candidate, currentTime);
  }

  private findGrindRailAttachCandidate(playerId: PlayerId, currentTime: number): GrindRailAttachCandidate | null {
    const avatar = this.options.getPlayerAvatar(playerId);
    if (!avatar) {
      return null;
    }

    const vertical = this.getPlayerVerticalState(playerId);
    const withinAirborneGrace = currentTime - vertical.lastAirborneAt <= GRIND_RAIL_AIRBORNE_GRACE_MS;
    if (vertical.grounded && !withinAirborneGrace) {
      return null;
    }

    const avatarPoint = { x: avatar.x, y: avatar.y };
    const playerWorldElevation = this.getPlayerVisualWorldElevation(playerId, avatarPoint);
    const incomingVector = this.getPlayerIncomingRailVector(playerId, avatar);
    const actor = this.playerActors.get(playerId);
    const motion = actor?.motion;
    const facingVector = getFacingVector(avatar.facing);
    let best: GrindRailAttachCandidate | null = null;

    for (const segment of this.grindRailSegments.values()) {
      const projection = projectPointOntoGrindRailSegment(avatarPoint, segment);
      if (projection.distancePx > GRIND_RAIL_ATTACH_RANGE_PX) {
        continue;
      }
      const heightDelta = Math.abs(playerWorldElevation - projection.height);
      if (heightDelta > GRIND_RAIL_ATTACH_HEIGHT_TOLERANCE_WORLD) {
        continue;
      }
      if (vertical.velocity > 0.45 && playerWorldElevation < projection.height - 0.1) {
        continue;
      }

      const projectedTravelPx = motion
        ? (
          (projection.t - projectPointOntoGrindRailSegment(
            { x: motion.lastX, y: motion.lastY },
            segment,
          ).t) * segment.length
        )
        : 0;
      const incomingAlignment = incomingVector
        ? ((incomingVector.x * segment.directionX) + (incomingVector.y * segment.directionY))
        : 0;
      const facingAlignment = (facingVector.x * segment.directionX) + (facingVector.y * segment.directionY);
      let direction: 1 | -1;
      if (Math.abs(projectedTravelPx) >= GRIND_RAIL_APPROACH_TRAVEL_DEADZONE_PX) {
        direction = projectedTravelPx >= 0 ? 1 : -1;
      } else if (Math.abs(incomingAlignment) >= GRIND_RAIL_INPUT_ALIGNMENT_THRESHOLD) {
        direction = incomingAlignment >= 0 ? 1 : -1;
      } else if (Math.abs(facingAlignment) >= GRIND_RAIL_FACING_ALIGNMENT_THRESHOLD) {
        direction = facingAlignment >= 0 ? 1 : -1;
      } else {
        direction = projection.t <= 0.5 ? 1 : -1;
      }
      const alignmentScore = Math.max(
        0,
        Math.abs(projectedTravelPx) >= GRIND_RAIL_APPROACH_TRAVEL_DEADZONE_PX
          ? (projectedTravelPx / Math.max(1, segment.length)) * direction
          : incomingVector
            ? incomingAlignment * direction
            : facingAlignment * direction,
      );
      const rideLengthPx = direction > 0
        ? (1 - projection.t) * segment.length
        : projection.t * segment.length;
      const score = (
        (GRIND_RAIL_ATTACH_RANGE_PX - projection.distancePx) * 2.2
        + ((GRIND_RAIL_ATTACH_HEIGHT_TOLERANCE_WORLD - heightDelta) * 64)
        + (alignmentScore * 18)
        + (rideLengthPx * 0.012)
      );
      if (!best || score > best.score) {
        best = {
          segment,
          attachT: projection.t,
          attachPoint: projection.point,
          attachHeight: projection.height,
          direction,
          score,
        };
      }
    }

    return best;
  }

  private getPlayerIncomingRailVector(playerId: PlayerId, avatar: FieldAvatarView): { x: number; y: number } | null {
    const actor = this.playerActors.get(playerId);
    const motion = actor?.motion;
    if (motion) {
      const deltaX = avatar.x - motion.lastX;
      const deltaY = avatar.y - motion.lastY;
      const deltaLength = Math.hypot(deltaX, deltaY);
      if (deltaLength > 1.5) {
        return { x: deltaX / deltaLength, y: deltaY / deltaLength };
      }
    }

    const inputMovement = this.getPlayerMovementInputVector(playerId);
    if (inputMovement) {
      return inputMovement;
    }

    switch (avatar.facing) {
      case "north":
        return { x: 0, y: -1 };
      case "south":
        return { x: 0, y: 1 };
      case "east":
        return { x: 1, y: 0 };
      case "west":
        return { x: -1, y: 0 };
      default:
        return null;
    }
  }

  private beginRailRide(playerId: PlayerId, candidate: GrindRailAttachCandidate, currentTime: number): void {
    const avatar = this.options.getPlayerAvatar(playerId);
    if (!avatar) {
      return;
    }
    const previousMode = this.getPlayerActiveMode(playerId);
    const facing = fieldFacingFromDelta(
      candidate.segment.directionX * candidate.direction,
      candidate.segment.directionY * candidate.direction,
      avatar.facing,
    );
    this.setPlayerTargetLock(playerId, null);
    this.setPlayerTargetOrbitYawOffset(playerId, 0);
    if (playerId === "P1") {
      this.cameraYawPan = null;
    } else {
      this.splitCameraYawPans[playerId] = null;
    }
    this.setPlayerZiplineDismountDrift(playerId, null);
    this.stowPlayerGlider(playerId);
    this.setPlayerBladeSwing(playerId, null);
    this.resetBladeCombo(playerId);
    this.options.setPlayerAvatar(playerId, candidate.attachPoint.x, candidate.attachPoint.y, facing);
    this.setPlayerRailWorldElevation(playerId, candidate.attachPoint, candidate.attachHeight);
    this.setPlayerRailRide(playerId, {
      playerId,
      startedAt: currentTime,
      segmentKey: candidate.segment.key,
      routeId: candidate.segment.routeId,
      segmentIndex: candidate.segment.segmentIndex,
      direction: candidate.direction,
      t: candidate.attachT,
      speedPxPerSecond: GRIND_RAIL_FIXED_SPEED_PX_PER_SECOND,
      previousMode,
      lastSparkAt: Number.NEGATIVE_INFINITY,
    });
    this.setPlayerRailAttachCooldownUntil(playerId, currentTime + GRIND_RAIL_ATTACH_COOLDOWN_MS);
    this.updateModeHud();
  }

  private advanceRailRide(playerId: PlayerId, deltaMs: number, currentTime: number): void {
    const railRide = this.getPlayerRailRide(playerId);
    if (!railRide) {
      return;
    }

    let segment = this.resolveGrindRailSegment(railRide);
    if (!segment) {
      this.finishRailRide(playerId, { suppressLaunch: true, keepCooldown: true });
      return;
    }

    const avatar = this.options.getPlayerAvatar(playerId);
    if (!avatar) {
      this.finishRailRide(playerId, { suppressLaunch: true, keepCooldown: true });
      return;
    }

    let remainingDistance = railRide.speedPxPerSecond * Math.min(0.05, Math.max(0, deltaMs / 1000));
    while (segment && remainingDistance > 0) {
      const distanceToEnd = railRide.direction > 0
        ? (1 - railRide.t) * segment.length
        : railRide.t * segment.length;
      if (remainingDistance < distanceToEnd) {
        railRide.t += (remainingDistance / Math.max(1, segment.length)) * railRide.direction;
        remainingDistance = 0;
        break;
      }

      railRide.t = railRide.direction > 0 ? 1 : 0;
      remainingDistance -= distanceToEnd;
      const continuation = resolveLinkedGrindRailSegment(segment, railRide.direction, this.grindRailSegments);
      if (!continuation) {
        this.syncRailRideTransform(playerId, railRide, segment, currentTime);
        this.finishRailRide(playerId);
        return;
      }

      const nextSegment = this.grindRailSegments.get(continuation.segmentKey);
      if (!nextSegment) {
        this.syncRailRideTransform(playerId, railRide, segment, currentTime);
        this.finishRailRide(playerId);
        return;
      }

      railRide.segmentKey = continuation.segmentKey;
      railRide.routeId = nextSegment.routeId;
      railRide.segmentIndex = nextSegment.segmentIndex;
      railRide.direction = continuation.direction;
      railRide.t = continuation.direction > 0 ? 0 : 1;
      segment = nextSegment;
    }

    this.syncRailRideTransform(playerId, railRide, segment, currentTime);
  }

  private syncRailRideTransform(
    playerId: PlayerId,
    railRide: RailRideState,
    segment: GrindRailSegment,
    currentTime: number,
  ): void {
    const point = {
      x: THREE.MathUtils.lerp(segment.start.fieldPoint.x, segment.end.fieldPoint.x, railRide.t),
      y: THREE.MathUtils.lerp(segment.start.fieldPoint.y, segment.end.fieldPoint.y, railRide.t),
    };
    const height = THREE.MathUtils.lerp(segment.start.height, segment.end.height, railRide.t);
    const avatar = this.options.getPlayerAvatar(playerId);
    const facing = fieldFacingFromDelta(
      segment.directionX * railRide.direction,
      segment.directionY * railRide.direction,
      avatar?.facing ?? "south",
    );
    this.options.setPlayerAvatar(playerId, point.x, point.y, facing);
    this.setPlayerRailWorldElevation(playerId, point, height);
    if (currentTime - railRide.lastSparkAt >= GRIND_RAIL_SPARK_INTERVAL_MS) {
      railRide.lastSparkAt = currentTime;
      this.spawnGrindRailSparkBurst(point, height, {
        x: segment.directionX * railRide.direction,
        y: segment.directionY * railRide.direction,
      });
    }
  }

  private setPlayerRailWorldElevation(playerId: PlayerId, point: { x: number; y: number }, railHeight: number): void {
    const state = this.getPlayerVerticalState(playerId);
    const groundElevation = this.getGroundElevationAtPoint(point);
    state.grounded = false;
    state.gliding = false;
    state.velocity = 0;
    state.groundElevation = groundElevation;
    state.worldElevation = Math.max(railHeight, groundElevation + 0.05);
    state.elevation = Math.max(0, state.worldElevation - groundElevation);
  }

  private jumpPlayerOffRail(playerId: PlayerId): void {
    this.finishRailRide(playerId, { jumpOff: true });
  }

  private finishRailRide(
    playerId: PlayerId,
    options: { jumpOff?: boolean; suppressLaunch?: boolean; keepCooldown?: boolean } = {},
  ): void {
    const railRide = this.getPlayerRailRide(playerId);
    this.setPlayerRailRide(playerId, null);
    if (!railRide) {
      return;
    }
    this.updateModeHud();

    const now = this.currentFrameTime || performance.now();
    if (!options.keepCooldown) {
      this.setPlayerRailAttachCooldownUntil(playerId, now + GRIND_RAIL_ATTACH_COOLDOWN_MS);
    }
    if (options.suppressLaunch) {
      return;
    }

    const segment = this.resolveGrindRailSegment(railRide);
    const avatar = this.options.getPlayerAvatar(playerId);
    if (!segment || !avatar) {
      return;
    }

    const point = { x: avatar.x, y: avatar.y };
    const direction = {
      x: segment.directionX * railRide.direction,
      y: segment.directionY * railRide.direction,
    };
    const speed = options.jumpOff ? GRIND_RAIL_JUMP_OFF_SPEED_PX_PER_SECOND : GRIND_RAIL_END_LAUNCH_SPEED_PX_PER_SECOND;
    const upwardVelocity = options.jumpOff ? GRIND_RAIL_JUMP_OFF_UPWARD_VELOCITY : GRIND_RAIL_END_LAUNCH_UPWARD_VELOCITY;
    const state = this.getPlayerVerticalState(playerId);
    const groundElevation = this.getGroundElevationAtPoint(point);
    state.grounded = false;
    state.gliding = false;
    state.groundElevation = groundElevation;
    state.worldElevation = Math.max(state.worldElevation, groundElevation + 0.2);
    state.elevation = Math.max(0.2, state.worldElevation - groundElevation);
    state.velocity = upwardVelocity;
    state.jumpStartedAt = now;
    state.jumpFlipDirection = 1;
    state.lastAirborneAt = now;
    this.options.setPlayerAvatar(playerId, point.x, point.y, fieldFacingFromDelta(direction.x, direction.y, avatar.facing));
    this.setPlayerZiplineDismountDrift(playerId, {
      playerId,
      vx: direction.x * speed,
      vy: direction.y * speed,
      startedAt: now,
      durationMs: options.jumpOff ? 340 : 480,
    });
  }

  private resolveGrindRailSegment(railRide: RailRideState): GrindRailSegment | null {
    const direct = this.grindRailSegments.get(railRide.segmentKey);
    if (direct) {
      return direct;
    }
    for (const [segmentKey, segment] of this.grindRailSegments.entries()) {
      if (segment.routeId !== railRide.routeId || segment.segmentIndex !== railRide.segmentIndex) {
        continue;
      }
      railRide.segmentKey = segmentKey;
      return segment;
    }
    return null;
  }

  private captureRailRideSnapshots(): RailRideSnapshot[] {
    const snapshots: RailRideSnapshot[] = [];
    (["P1", "P2"] as PlayerId[]).forEach((playerId) => {
      const railRide = this.getPlayerRailRide(playerId);
      if (!railRide) {
        return;
      }
      snapshots.push({
        playerId,
        segmentKey: railRide.segmentKey,
        routeId: railRide.routeId,
        segmentIndex: railRide.segmentIndex,
        direction: railRide.direction,
        t: railRide.t,
        speedPxPerSecond: railRide.speedPxPerSecond,
        previousMode: railRide.previousMode,
        lastSparkAt: railRide.lastSparkAt,
      });
    });
    return snapshots;
  }

  private restoreRailRideSnapshots(snapshots: RailRideSnapshot[]): void {
    snapshots.forEach((snapshot) => {
      const segment = this.grindRailSegments.get(snapshot.segmentKey)
        ?? Array.from(this.grindRailSegments.entries()).find(([, candidate]) => (
          candidate.routeId === snapshot.routeId
          && candidate.segmentIndex === snapshot.segmentIndex
        ))?.[1]
        ?? null;
      if (!segment) {
        return;
      }
      const segmentKey = this.grindRailSegments.has(snapshot.segmentKey)
        ? snapshot.segmentKey
        : `grind-rail:${segment.id}`;
      this.setPlayerRailRide(snapshot.playerId, {
        playerId: snapshot.playerId,
        startedAt: this.currentFrameTime || performance.now(),
        segmentKey,
        routeId: snapshot.routeId,
        segmentIndex: snapshot.segmentIndex,
        direction: snapshot.direction,
        t: THREE.MathUtils.clamp(snapshot.t, 0, 1),
        speedPxPerSecond: snapshot.speedPxPerSecond,
        previousMode: snapshot.previousMode,
        lastSparkAt: snapshot.lastSparkAt,
      });
    });
    if (snapshots.length > 0) {
      this.updateModeHud();
    }
  }

  private getPlayerMovementInputVector(playerId: PlayerId): { x: number; y: number } | null {
    const input = getPlayerInput(playerId);
    const basis = this.getCameraBasis(playerId);
    let moveX = 0;
    let moveY = 0;
    if (input.up) {
      moveX += basis.forwardX;
      moveY += basis.forwardY;
    }
    if (input.down) {
      moveX -= basis.forwardX;
      moveY -= basis.forwardY;
    }
    if (input.right) {
      moveX += basis.rightX;
      moveY += basis.rightY;
    }
    if (input.left) {
      moveX -= basis.rightX;
      moveY -= basis.rightY;
    }

    const length = Math.hypot(moveX, moveY);
    if (length <= 0) {
      return null;
    }

    return {
      x: moveX / length,
      y: moveY / length,
    };
  }

  private getPlayerVerticalState(playerId: PlayerId): PlayerVerticalState {
    let state = this.playerVerticalStates.get(playerId);
    if (!state) {
      state = {
        elevation: 0,
        velocity: 0,
        grounded: true,
        gliding: false,
        airborneDashLocked: false,
        gliderDeployedAt: Number.NEGATIVE_INFINITY,
        jumpStartedAt: Number.NEGATIVE_INFINITY,
        jumpFlipDirection: 1,
        groundElevation: 0,
        worldElevation: 0,
        lastAirborneAt: Number.NEGATIVE_INFINITY,
      };
      this.playerVerticalStates.set(playerId, state);
    }
    return state;
  }

  private getPlayerVisualWorldElevation(playerId: PlayerId, point: { x: number; y: number }): number {
    const state = this.getPlayerVerticalState(playerId);
    const groundElevation = this.getGroundElevationAtPoint(point);
    if (!Number.isFinite(state.groundElevation)) {
      state.groundElevation = groundElevation;
    }
    if (!Number.isFinite(state.worldElevation)) {
      state.worldElevation = groundElevation + Math.max(0, state.elevation);
    }

    if (state.grounded) {
      if (groundElevation < state.groundElevation - PLAYER_LEDGE_DROP_WORLD_THRESHOLD) {
        this.capturePlayerAirborneDashState(playerId, state);
        state.grounded = false;
        state.gliding = false;
        state.velocity = Math.min(0, state.velocity);
        state.worldElevation = Math.max(state.worldElevation, state.groundElevation);
        state.elevation = Math.max(0, state.worldElevation - groundElevation);
        state.lastAirborneAt = this.currentFrameTime || performance.now();
      } else {
        state.groundElevation = groundElevation;
        state.worldElevation = groundElevation;
        state.elevation = 0;
        state.velocity = 0;
        return groundElevation;
      }
    }

    if (state.worldElevation <= groundElevation) {
      state.groundElevation = groundElevation;
      state.worldElevation = groundElevation;
      state.elevation = 0;
      state.velocity = 0;
      state.grounded = true;
      state.gliding = false;
      return groundElevation;
    }

    state.groundElevation = groundElevation;
    state.elevation = Math.max(0, state.worldElevation - groundElevation);
    return state.worldElevation;
  }

  private capturePlayerAirborneDashState(playerId: PlayerId, state = this.getPlayerVerticalState(playerId)): void {
    state.airborneDashLocked = getPlayerInput(playerId).special1;
  }

  private isPlayerDashActive(playerId: PlayerId, state = this.getPlayerVerticalState(playerId)): boolean {
    if (state.gliding || this.isPlayerGrinding(playerId)) {
      return false;
    }
    if (state.grounded) {
      const groundedDashActive = getPlayerInput(playerId).special1;
      state.airborneDashLocked = groundedDashActive;
      return groundedDashActive;
    }
    return state.airborneDashLocked;
  }

  private playerHasApronUtility(playerId: PlayerId, utilityItemId: WeaponsmithUtilityItemId): boolean {
    return Boolean(
      this.options.hasApronUtility?.(playerId, utilityItemId)
      || (utilityItemId === "apron_glider" && this.options.canUseGlider?.(playerId) === true),
    );
  }

  private tryStartPlayerJump(playerId: PlayerId): void {
    if (this.options.isPaused() || !this.isPlayerControllable(playerId)) {
      return;
    }
    if (this.isPlayerGrinding(playerId)) {
      this.jumpPlayerOffRail(playerId);
      return;
    }
    if (this.getPlayerGrappleMove(playerId)) {
      return;
    }

    const avatar = this.options.getPlayerAvatar(playerId);
    if (!avatar) {
      return;
    }

    const state = this.getPlayerVerticalState(playerId);
    const avatarPoint = { x: avatar.x, y: avatar.y };
    const groundElevation = this.getGroundElevationAtPoint(avatarPoint);
    if (state.grounded) {
      state.groundElevation = groundElevation;
      state.worldElevation = groundElevation;
      state.elevation = 0;
    }
    if (!state.grounded || state.elevation > 0.025) {
      if (state.gliding) {
        this.stowPlayerGlider(playerId);
      } else {
        this.tryDeployPlayerGlider(playerId);
      }
      return;
    }

    state.grounded = false;
    state.gliding = false;
    this.capturePlayerAirborneDashState(playerId, state);
    state.elevation = 0.02;
    state.groundElevation = groundElevation;
    state.worldElevation = groundElevation + state.elevation;
    state.velocity = PLAYER_JUMP_VELOCITY * (
      this.playerHasApronUtility(playerId, "counterweight_boots")
        ? PLAYER_COUNTERWEIGHT_BOOTS_JUMP_VELOCITY_MULTIPLIER
        : 1
    );
    state.jumpStartedAt = this.currentFrameTime || performance.now();
    state.jumpFlipDirection = this.shouldUseBackflipForJump(playerId, avatar) ? -1 : 1;
    state.lastAirborneAt = state.jumpStartedAt;
    this.cameraImpulse.y += playerId === "P1" ? 0.045 : 0;
    if (playerId === "P1") {
      this.tryStartCompanionJump({ nearPoint: avatarPoint, velocity: SABLE_JUMP_VELOCITY });
    }
  }

  private tryDeployPlayerGlider(playerId: PlayerId): boolean {
    if (
      this.options.isPaused()
      || !this.isPlayerControllable(playerId)
      || !this.playerHasApronUtility(playerId, "apron_glider")
    ) {
      return false;
    }
    if (this.getPlayerGrappleMove(playerId) || this.getPlayerRailRide(playerId)) {
      return false;
    }

    const state = this.getPlayerVerticalState(playerId);
    if (state.grounded || state.elevation < PLAYER_GLIDER_MIN_DEPLOY_ELEVATION) {
      return false;
    }

    state.gliding = true;
    state.gliderDeployedAt = this.currentFrameTime || performance.now();
    state.velocity = Math.min(state.velocity, PLAYER_GLIDER_DEPLOY_MAX_UPWARD_VELOCITY);
    this.cameraImpulse.y += playerId === "P1" ? 0.028 : 0;
    return true;
  }

  private stowPlayerGlider(playerId: PlayerId): void {
    const state = this.getPlayerVerticalState(playerId);
    if (!state.gliding) {
      return;
    }

    state.gliding = false;
    state.gliderDeployedAt = Number.NEGATIVE_INFINITY;
    state.velocity = Math.min(state.velocity, -0.35);
    this.cameraImpulse.y += playerId === "P1" ? -0.018 : 0;
  }

  private shouldUseBackflipForJump(playerId: PlayerId, avatar: FieldAvatarView): boolean {
    const lockedTarget = this.getLockedTargetCandidate(playerId);
    if (!lockedTarget) {
      return false;
    }

    const movement = this.getPlayerMovementInputVector(playerId);
    if (!movement) {
      return false;
    }

    const input = getPlayerInput(playerId);
    const targetVector = {
      x: lockedTarget.x - avatar.x,
      y: lockedTarget.y - avatar.y,
    };
    const targetDistance = Math.max(0.001, Math.hypot(targetVector.x, targetVector.y));
    const movementTowardTarget = (
      (movement.x * targetVector.x)
      + (movement.y * targetVector.y)
    ) / targetDistance;

    return (input.down && !input.up) || movementTowardTarget < -0.24;
  }

  private updatePlayerVertical(deltaMs: number): void {
    const deltaSeconds = Math.min(0.05, Math.max(0, deltaMs / 1000));
    (["P1", "P2"] as PlayerId[]).forEach((playerId) => {
      const state = this.getPlayerVerticalState(playerId);
      const grappleMove = this.getPlayerGrappleMove(playerId);
      if (this.getPlayerRailRide(playerId) || grappleMove?.target.kind === "grapple-node" || grappleMove?.target.kind === "zipline-track") {
        return;
      }
      const avatar = this.options.getPlayerAvatar(playerId);
      if (!avatar) {
        return;
      }

      const avatarPoint = { x: avatar.x, y: avatar.y };
      const groundElevation = this.getGroundElevationAtPoint(avatarPoint);
      if (state.grounded) {
        if (groundElevation >= state.groundElevation - PLAYER_LEDGE_DROP_WORLD_THRESHOLD) {
          state.groundElevation = groundElevation;
          state.worldElevation = groundElevation;
          state.elevation = 0;
          state.velocity = 0;
          state.gliding = false;
          return;
        }

        this.capturePlayerAirborneDashState(playerId, state);
        state.grounded = false;
        state.gliding = false;
        state.velocity = Math.min(0, state.velocity);
        state.worldElevation = Math.max(state.worldElevation, state.groundElevation);
        state.elevation = Math.max(0, state.worldElevation - groundElevation);
        state.lastAirborneAt = this.currentFrameTime || performance.now();
      }

      if (state.gliding && !this.playerHasApronUtility(playerId, "apron_glider")) {
        state.gliding = false;
      }

      if (state.gliding) {
        state.velocity = Math.max(
          PLAYER_GLIDER_DESCENT_VELOCITY,
          Math.min(state.velocity, PLAYER_GLIDER_DEPLOY_MAX_UPWARD_VELOCITY) - (PLAYER_GLIDER_GRAVITY * deltaSeconds),
        );
      } else {
        state.velocity -= PLAYER_JUMP_GRAVITY * deltaSeconds;
      }
      state.worldElevation += state.velocity * deltaSeconds;
      if (state.worldElevation <= groundElevation) {
        state.elevation = 0;
        state.velocity = 0;
        state.grounded = true;
        state.gliding = false;
        state.jumpFlipDirection = 1;
        state.groundElevation = groundElevation;
        state.worldElevation = groundElevation;
      } else {
        state.grounded = false;
        state.groundElevation = groundElevation;
        state.elevation = Math.max(0, state.worldElevation - groundElevation);
        state.lastAirborneAt = this.currentFrameTime || performance.now();
      }
    });
  }

  private setPlayerSwingElevation(playerId: PlayerId, elevation: number): void {
    const state = this.getPlayerVerticalState(playerId);
    const avatar = this.options.getPlayerAvatar(playerId);
    const groundElevation = avatar
      ? this.getGroundElevationAtPoint({ x: avatar.x, y: avatar.y })
      : state.groundElevation;
    state.elevation = Math.max(0, elevation);
    state.groundElevation = groundElevation;
    state.worldElevation = groundElevation + state.elevation;
    state.velocity = 0;
    state.grounded = state.elevation <= 0.015;
    if (!state.grounded) {
      this.capturePlayerAirborneDashState(playerId, state);
    }
    if (state.grounded) {
      state.gliding = false;
      state.jumpFlipDirection = 1;
    }
  }

  private releasePlayerFromZipline(
    playerId: PlayerId,
    point: { x: number; y: number },
    riderWorldHeight: number,
    direction: { x: number; y: number },
    verticalVelocity: number,
    currentTime: number,
  ): void {
    const state = this.getPlayerVerticalState(playerId);
    const groundElevation = this.getGroundElevationAtPoint(point);
    const worldElevation = Math.max(riderWorldHeight, groundElevation + 0.18);
    const directionLength = Math.max(0.001, Math.hypot(direction.x, direction.y));
    const exitDirection = {
      x: direction.x / directionLength,
      y: direction.y / directionLength,
    };

    state.grounded = false;
    state.gliding = false;
    this.capturePlayerAirborneDashState(playerId, state);
    state.groundElevation = groundElevation;
    state.worldElevation = worldElevation;
    state.elevation = Math.max(0.18, worldElevation - groundElevation);
    state.velocity = THREE.MathUtils.clamp(
      Math.max(
        GRAPPLE_ZIPLINE_DISMOUNT_MIN_FLIP_VELOCITY,
        verticalVelocity + GRAPPLE_ZIPLINE_DISMOUNT_UPWARD_VELOCITY,
      ),
      GRAPPLE_ZIPLINE_DISMOUNT_MIN_FLIP_VELOCITY,
      2.2,
    );
    state.jumpStartedAt = currentTime;
    state.jumpFlipDirection = 1;

    this.setPlayerZiplineDismountDrift(playerId, {
      playerId,
      vx: exitDirection.x * GRAPPLE_ZIPLINE_DISMOUNT_SPEED_PX_PER_SECOND,
      vy: exitDirection.y * GRAPPLE_ZIPLINE_DISMOUNT_SPEED_PX_PER_SECOND,
      startedAt: currentTime,
      durationMs: GRAPPLE_ZIPLINE_DISMOUNT_DURATION_MS,
    });
  }

  private landPlayerVertical(playerId: PlayerId): void {
    const state = this.getPlayerVerticalState(playerId);
    const avatar = this.options.getPlayerAvatar(playerId);
    const groundElevation = avatar
      ? this.getGroundElevationAtPoint({ x: avatar.x, y: avatar.y })
      : state.groundElevation;
    state.elevation = 0;
    state.velocity = 0;
    state.grounded = true;
    state.gliding = false;
    state.gliderDeployedAt = Number.NEGATIVE_INFINITY;
    state.jumpFlipDirection = 1;
    state.groundElevation = groundElevation;
    state.worldElevation = groundElevation;
  }

  private getCompanionVerticalState(companion: Companion): CompanionVerticalState {
    const currentTime = this.currentFrameTime || performance.now();
    if (!this.companionVerticalState) {
      const groundElevation = this.getGroundElevationAtPoint({ x: companion.x, y: companion.y });
      this.companionVerticalState = {
        elevation: 0,
        velocity: 0,
        grounded: true,
        groundElevation,
        worldElevation: groundElevation,
        jumpStartedAt: Number.NEGATIVE_INFINITY,
        lastJumpAt: Number.NEGATIVE_INFINITY,
        lastX: companion.x,
        lastY: companion.y,
        lastTime: currentTime,
      };
    }

    return this.companionVerticalState;
  }

  private launchCompanionVertical(
    state: CompanionVerticalState,
    groundElevation: number,
    velocity: number,
    currentTime = this.currentFrameTime || performance.now(),
  ): void {
    state.grounded = false;
    state.groundElevation = groundElevation;
    state.worldElevation = Math.max(state.worldElevation, groundElevation + 0.045);
    state.elevation = Math.max(0.045, state.worldElevation - groundElevation);
    state.velocity = velocity;
    state.jumpStartedAt = currentTime;
    state.lastJumpAt = currentTime;
  }

  private tryStartCompanionJump(options: {
    nearPoint?: { x: number; y: number };
    velocity?: number;
  } = {}): boolean {
    const companion = this.options.getCompanion?.() ?? null;
    if (!companion) {
      return false;
    }

    if (options.nearPoint && Math.hypot(companion.x - options.nearPoint.x, companion.y - options.nearPoint.y) > 300) {
      return false;
    }

    const currentTime = this.currentFrameTime || performance.now();
    const state = this.getCompanionVerticalState(companion);
    if (!state.grounded || state.elevation > 0.035 || currentTime - state.lastJumpAt < SABLE_JUMP_COOLDOWN_MS) {
      return false;
    }

    const groundElevation = this.getGroundElevationAtPoint({ x: companion.x, y: companion.y });
    state.groundElevation = groundElevation;
    state.worldElevation = groundElevation;
    state.elevation = 0;
    this.launchCompanionVertical(state, groundElevation, options.velocity ?? SABLE_JUMP_VELOCITY, currentTime);
    return true;
  }

  private updateCompanionVertical(companion: Companion): CompanionVerticalState {
    const state = this.getCompanionVerticalState(companion);
    const currentTime = this.currentFrameTime || performance.now();
    const deltaSeconds = Math.min(0.05, Math.max(0, (currentTime - state.lastTime) / 1000));
    const movedDistance = Math.hypot(companion.x - state.lastX, companion.y - state.lastY);
    const speedPxPerSecond = deltaSeconds > 0 ? movedDistance / deltaSeconds : 0;
    const point = { x: companion.x, y: companion.y };
    const groundElevation = this.getGroundElevationAtPoint(point);

    if (state.grounded) {
      const groundDelta = groundElevation - state.groundElevation;
      const canStepHop = (
        groundDelta > SABLE_STEP_HOP_WORLD_THRESHOLD
        && speedPxPerSecond >= SABLE_STEP_HOP_MIN_SPEED_PX
        && currentTime - state.lastJumpAt >= SABLE_JUMP_COOLDOWN_MS
      );

      if (groundDelta < -SABLE_LEDGE_DROP_WORLD_THRESHOLD) {
        state.grounded = false;
        state.velocity = Math.min(0, state.velocity);
        state.worldElevation = Math.max(state.worldElevation, state.groundElevation);
        state.elevation = Math.max(0, state.worldElevation - groundElevation);
        state.jumpStartedAt = currentTime;
      } else if (canStepHop) {
        this.launchCompanionVertical(
          state,
          groundElevation,
          SABLE_STEP_HOP_VELOCITY + THREE.MathUtils.clamp(groundDelta * 1.25, 0, 0.85),
          currentTime,
        );
      } else {
        state.groundElevation = groundElevation;
        state.worldElevation = groundElevation;
        state.elevation = 0;
        state.velocity = 0;
        state.lastX = companion.x;
        state.lastY = companion.y;
        state.lastTime = currentTime;
        return state;
      }
    }

    if (!state.grounded) {
      state.velocity -= SABLE_JUMP_GRAVITY * deltaSeconds;
      state.worldElevation += state.velocity * deltaSeconds;
      if (state.worldElevation <= groundElevation && state.velocity <= 0) {
        state.elevation = 0;
        state.velocity = 0;
        state.grounded = true;
        state.groundElevation = groundElevation;
        state.worldElevation = groundElevation;
      } else {
        state.grounded = false;
        state.groundElevation = groundElevation;
        state.elevation = Math.max(0, state.worldElevation - groundElevation);
      }
    }

    state.lastX = companion.x;
    state.lastY = companion.y;
    state.lastTime = currentTime;
    return state;
  }

  private getActionMovementMultiplier(playerId: PlayerId): number {
    const bladeSwing = this.getPlayerBladeSwing(playerId);
    if (!bladeSwing) {
      return 1;
    }

    const elapsed = this.currentFrameTime - bladeSwing.startedAt;
    if (elapsed < BLADE_SWING_WINDUP_MS) {
      return 0.36;
    }
    if (elapsed < BLADE_LUNGE_END_MS) {
      return 0.62;
    }
    return 0.42;
  }

  private resetBladeCombo(playerId: PlayerId = "P1"): void {
    this.setPlayerNextBladeSwingComboStep(playerId, 0);
    this.setPlayerBladeComboExpiresAt(playerId, Number.NEGATIVE_INFINITY);
  }

  private isVerticalBladeFinisher(swing: BladeSwingState): boolean {
    return swing.comboStep === 2;
  }

  private getNextBladeSwingPlan(
    playerId: PlayerId,
    currentTime: number,
  ): Pick<BladeSwingState, "comboStep" | "side"> {
    const comboStep = currentTime <= this.getPlayerBladeComboExpiresAt(playerId)
      ? this.getPlayerNextBladeSwingComboStep(playerId)
      : 0;
    this.setPlayerNextBladeSwingComboStep(playerId, ((comboStep + 1) % 3) as BladeSwingComboStep);
    this.setPlayerBladeComboExpiresAt(playerId, currentTime + BLADE_COMBO_RESET_MS);
    return {
      comboStep,
      side: comboStep === 1 ? -1 : 1,
    };
  }

  toggleCameraMode(): void {
    if (!this.options.isPlayerActive("P2")) {
      this.setCameraBehavior("shared");
      return;
    }

    this.setCameraBehavior(this.cameraBehavior === "shared" ? "hybrid" : "shared");
  }

  private triggerPrimaryAction(playerId: PlayerId = "P1"): void {
    const activeMode = this.getPlayerActiveMode(playerId);
    if (
      this.options.isPaused()
      || !this.isPlayerControllable(playerId)
      || this.isPlayerGrinding(playerId)
      || !activeMode
    ) {
      return;
    }

    switch (activeMode) {
      case "blade":
        this.triggerBladeSwing(playerId);
        break;
      case "launcher":
        this.fireLauncher(playerId);
        break;
      case "grapple":
        this.fireGrapple(playerId);
        break;
      default:
        break;
    }
  }

  private getActionDirection(
    playerId: PlayerId,
    avatar: FieldAvatarView,
    target: Pick<Haven3DTargetCandidate, "x" | "y"> | null = null,
  ): { x: number; y: number } {
    const basis = this.getCameraBasis(playerId);
    const rawDirection = target
      ? { x: target.x - avatar.x, y: target.y - avatar.y }
      : { x: basis.forwardX, y: basis.forwardY };
    const length = Math.hypot(rawDirection.x, rawDirection.y);
    if (length > 0.001) {
      return { x: rawDirection.x / length, y: rawDirection.y / length };
    }

    return getFacingVector(avatar.facing);
  }

  private findEnemyActionTarget(
    playerId: PlayerId,
    avatar: FieldAvatarView,
    rangePx: number,
    minForwardDot: number,
  ): Haven3DTargetCandidate | null {
    const lockedTarget = this.getLockedTargetCandidate(playerId);
    if (lockedTarget?.kind === "enemy" && lockedTarget.distance <= rangePx) {
      return lockedTarget;
    }

    const direction = this.getActionDirection(playerId, avatar);
    let best: Haven3DTargetCandidate | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of this.getTargetCandidates(playerId)) {
      if (candidate.kind !== "enemy" || candidate.distance > rangePx) {
        continue;
      }

      const toTarget = { x: candidate.x - avatar.x, y: candidate.y - avatar.y };
      const length = Math.max(0.001, Math.hypot(toTarget.x, toTarget.y));
      const dot = ((toTarget.x / length) * direction.x) + ((toTarget.y / length) * direction.y);
      if (dot < minForwardDot) {
        continue;
      }

      const score = candidate.distance * 0.035 + (1 - dot) * 6;
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    return best;
  }

  private findBladeActionTarget(
    playerId: PlayerId,
    avatar: FieldAvatarView,
    rangePx: number,
    minForwardDot: number,
  ): Haven3DTargetCandidate | null {
    const lockedTarget = this.getLockedTargetCandidate(playerId);
    if (
      lockedTarget
      && (lockedTarget.kind === "enemy" || lockedTarget.kind === "loot-orb")
      && lockedTarget.distance <= rangePx
    ) {
      return lockedTarget;
    }

    const direction = this.getActionDirection(playerId, avatar);
    let best: Haven3DTargetCandidate | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of this.getTargetCandidates(playerId)) {
      if ((candidate.kind !== "enemy" && candidate.kind !== "loot-orb") || candidate.distance > rangePx) {
        continue;
      }

      const toTarget = { x: candidate.x - avatar.x, y: candidate.y - avatar.y };
      const length = Math.max(0.001, Math.hypot(toTarget.x, toTarget.y));
      const dot = ((toTarget.x / length) * direction.x) + ((toTarget.y / length) * direction.y);
      if (dot < minForwardDot) {
        continue;
      }

      const lootOrbBias = candidate.kind === "loot-orb" ? -0.45 : 0;
      const score = candidate.distance * 0.035 + (1 - dot) * 6 + lootOrbBias;
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    return best;
  }

  private findActionTarget(playerId: PlayerId, rangePx: number): Haven3DTargetCandidate | null {
    const avatar = this.options.getPlayerAvatar(playerId);
    if (!avatar) {
      return null;
    }

    const lockedTarget = this.getLockedTargetCandidate(playerId);
    if (lockedTarget && lockedTarget.kind !== "loot-orb" && lockedTarget.distance <= rangePx) {
      return lockedTarget;
    }

    const direction = this.getActionDirection(playerId, avatar);
    let best: Haven3DTargetCandidate | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of this.getTargetCandidates(playerId)) {
      if (candidate.kind === "loot-orb" || candidate.distance > rangePx) {
        continue;
      }

      const toTarget = { x: candidate.x - avatar.x, y: candidate.y - avatar.y };
      const length = Math.max(0.001, Math.hypot(toTarget.x, toTarget.y));
      const dot = ((toTarget.x / length) * direction.x) + ((toTarget.y / length) * direction.y);
      if (dot < 0.14 && candidate.distance > 110) {
        continue;
      }

      const enemyBias = candidate.kind === "enemy" ? -1.2 : 0;
      const score = candidate.distance * 0.035 + (1 - dot) * 5 + enemyBias;
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    return best;
  }

  private getPointOnZiplineSegment(
    segment: GrappleZiplineSegment,
    t: number,
  ): { x: number; y: number; height: number } {
    const clampedT = THREE.MathUtils.clamp(t, 0, 1);
    return {
      x: THREE.MathUtils.lerp(segment.start.fieldPoint.x, segment.end.fieldPoint.x, clampedT),
      y: THREE.MathUtils.lerp(segment.start.fieldPoint.y, segment.end.fieldPoint.y, clampedT),
      height: THREE.MathUtils.lerp(segment.start.height, segment.end.height, clampedT),
    };
  }

  private getNearestZiplineT(segment: GrappleZiplineSegment, point: { x: number; y: number }): number {
    const vx = point.x - segment.start.fieldPoint.x;
    const vy = point.y - segment.start.fieldPoint.y;
    return THREE.MathUtils.clamp(
      ((vx * segment.directionX) + (vy * segment.directionY)) / Math.max(1, segment.length),
      0,
      1,
    );
  }

  private chooseZiplineEndT(
    segment: GrappleZiplineSegment,
    attachT: number,
    direction: { x: number; y: number },
  ): 0 | 1 {
    const directionDot = (direction.x * segment.directionX) + (direction.y * segment.directionY);
    let endT: 0 | 1 = Math.abs(directionDot) < 0.18
      ? attachT <= 0.5 ? 1 : 0
      : directionDot >= 0 ? 1 : 0;
    const rideDistance = Math.abs(endT - attachT) * segment.length;
    if (rideDistance < GRAPPLE_ROUTE_MIN_TARGET_DISTANCE_PX * 1.35) {
      endT = endT === 1 ? 0 : 1;
    }
    return endT;
  }

  private findGrappleZiplineTarget(playerId: PlayerId, rangePx: number): GrappleZiplineTarget | null {
    const avatar = this.options.getPlayerAvatar(playerId);
    if (!avatar || this.grappleZiplineSegments.size === 0) {
      return null;
    }

    const direction = this.getActionDirection(playerId, avatar);
    const maxRange = Math.max(rangePx, GRAPPLE_ZIPLINE_ATTACH_RANGE_PX);
    let best: GrappleZiplineTarget | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const segment of this.grappleZiplineSegments.values()) {
      const attachT = this.getNearestZiplineT(segment, avatar);
      const attach = this.getPointOnZiplineSegment(segment, attachT);
      const toAttach = { x: attach.x - avatar.x, y: attach.y - avatar.y };
      const attachDistance = Math.hypot(toAttach.x, toAttach.y);
      if (attachDistance > maxRange) {
        continue;
      }

      const closeEnoughToGrab = attachDistance <= GRAPPLE_ZIPLINE_CLOSE_ATTACH_RADIUS_PX;
      const attachDirectionLength = Math.max(0.001, attachDistance);
      const aimDot = ((toAttach.x / attachDirectionLength) * direction.x)
        + ((toAttach.y / attachDirectionLength) * direction.y);
      const aimOffset = Math.abs((toAttach.x * direction.y) - (toAttach.y * direction.x));
      if (!closeEnoughToGrab && (aimDot < 0.02 || aimOffset > GRAPPLE_ZIPLINE_MAX_AIM_OFFSET_PX)) {
        continue;
      }

      const endT = this.chooseZiplineEndT(segment, attachT, direction);
      const end = this.getPointOnZiplineSegment(segment, endT);
      const rideDistance = Math.hypot(end.x - attach.x, end.y - attach.y);
      if (rideDistance < GRAPPLE_ROUTE_MIN_TARGET_DISTANCE_PX) {
        continue;
      }

      const score = (attachDistance * 0.015)
        + (aimOffset * 0.03)
        + ((1 - aimDot) * (closeEnoughToGrab ? 0.8 : 2.4))
        - 2.2;
      if (score < bestScore) {
        best = {
          segment,
          attachPoint: { x: attach.x, y: attach.y },
          attachHeight: attach.height,
          attachT,
          endPoint: { x: end.x, y: end.y },
          endHeight: end.height,
          endT,
        };
        bestScore = score;
      }
    }

    return best;
  }

  private findNearestRouteOriginAnchor(avatar: FieldAvatarView): GrappleAnchor | null {
    let nearest: GrappleAnchor | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const anchor of this.grappleAnchors.values()) {
      if (!anchor.routeId || anchor.connectedAnchorIds.length === 0) {
        continue;
      }
      const distance = Math.hypot(anchor.x - avatar.x, anchor.y - avatar.y);
      if (distance > GRAPPLE_ROUTE_HANDOFF_DISTANCE_PX || distance >= nearestDistance) {
        continue;
      }
      nearest = anchor;
      nearestDistance = distance;
    }
    return nearest;
  }

  private findLinkedRouteGrappleAnchor(
    avatar: FieldAvatarView,
    direction: { x: number; y: number },
    rangePx: number,
  ): GrappleAnchor | null {
    const routeOrigin = this.findNearestRouteOriginAnchor(avatar);
    if (!routeOrigin) {
      return null;
    }

    let best: GrappleAnchor | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const connectedAnchorId of routeOrigin.connectedAnchorIds) {
      const anchor = this.grappleAnchors.get(`grapple-node:${connectedAnchorId}`);
      if (!anchor || anchor.id === routeOrigin.id || anchor.routeId !== routeOrigin.routeId) {
        continue;
      }

      const distance = Math.hypot(anchor.x - avatar.x, anchor.y - avatar.y);
      if (
        distance < GRAPPLE_ROUTE_MIN_TARGET_DISTANCE_PX
        || distance > Math.max(rangePx, GRAPPLE_ROUTE_LINK_RANGE_PX)
      ) {
        continue;
      }

      const toAnchor = { x: anchor.x - avatar.x, y: anchor.y - avatar.y };
      const length = Math.max(0.001, Math.hypot(toAnchor.x, toAnchor.y));
      const dot = ((toAnchor.x / length) * direction.x) + ((toAnchor.y / length) * direction.y);
      const forwardBias = routeOrigin.routeIndex !== undefined && anchor.routeIndex !== undefined
        ? Math.max(0, anchor.routeIndex - routeOrigin.routeIndex) * -0.42
        : 0;
      const score = distance * 0.012 + (1 - dot) * 1.8 + forwardBias;
      if (score < bestScore) {
        best = anchor;
        bestScore = score;
      }
    }

    return best;
  }

  private findGrappleAnchor(playerId: PlayerId, rangePx: number): GrappleAnchor | null {
    const avatar = this.options.getPlayerAvatar(playerId);
    if (!avatar || this.grappleAnchors.size === 0) {
      return null;
    }

    const direction = this.getActionDirection(playerId, avatar);
    const linkedRouteAnchor = this.findLinkedRouteGrappleAnchor(avatar, direction, rangePx);
    if (linkedRouteAnchor) {
      return linkedRouteAnchor;
    }

    let best: GrappleAnchor | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const anchor of this.grappleAnchors.values()) {
      const distance = Math.hypot(anchor.x - avatar.x, anchor.y - avatar.y);
      const isRouteAnchor = Boolean(anchor.routeId);
      const anchorRangePx = isRouteAnchor ? Math.max(rangePx, GRAPPLE_ROUTE_DIRECT_RANGE_PX) : rangePx;
      if (distance > anchorRangePx) {
        continue;
      }
      if (isRouteAnchor && anchor.connectedAnchorIds.length > 0 && distance < GRAPPLE_ROUTE_MIN_TARGET_DISTANCE_PX) {
        continue;
      }

      const toAnchor = { x: anchor.x - avatar.x, y: anchor.y - avatar.y };
      const length = Math.max(0.001, Math.hypot(toAnchor.x, toAnchor.y));
      const dot = ((toAnchor.x / length) * direction.x) + ((toAnchor.y / length) * direction.y);
      const minDot = isRouteAnchor ? -0.12 : 0.08;
      if (dot < minDot && distance > 118) {
        continue;
      }

      const routeBias = isRouteAnchor ? -3.25 : 0;
      const linkedBias = anchor.connectedAnchorIds.length > 0 ? -1.15 : 0;
      const routeRangePenalty = isRouteAnchor && distance > rangePx ? (distance - rangePx) * 0.011 : 0;
      const score = distance * (isRouteAnchor ? 0.024 : 0.03)
        + (1 - dot) * (isRouteAnchor ? 3.1 : 4.2)
        + routeBias
        + linkedBias
        + routeRangePenalty;
      if (score < bestScore) {
        best = anchor;
        bestScore = score;
      }
    }

    return best;
  }

  private findTargetForRef(target: Haven3DTargetRef, playerId: PlayerId = "P1"): Haven3DTargetCandidate | null {
    return this.getTargetCandidates(playerId).find((candidate) => candidate.key === target.key) ?? null;
  }

  private triggerBladeSwing(playerId: PlayerId = "P1"): void {
    if (this.getPlayerActiveMode(playerId) !== "blade" || this.options.isPaused() || this.getPlayerBladeSwing(playerId)) {
      return;
    }

    const avatar = this.options.getPlayerAvatar(playerId);
    if (!avatar) {
      return;
    }

    const target = this.findBladeActionTarget(playerId, avatar, BLADE_SWING_RANGE_PX * 1.45, -0.18);
    const direction = this.getActionDirection(playerId, avatar, target);
    const directionLength = Math.max(0.001, Math.hypot(direction.x, direction.y));
    const startedAt = performance.now();
    const { comboStep, side } = this.getNextBladeSwingPlan(playerId, startedAt);
    const swing: BladeSwingState = {
      startedAt,
      struck: false,
      target,
      direction: {
        x: direction.x / directionLength,
        y: direction.y / directionLength,
      },
      side,
      comboStep,
    };
    this.setPlayerBladeSwing(playerId, swing);
    this.spawnBladeDrawSmear(avatar, swing.direction, swing);
    this.options.onBladeSwingStart?.({
      playerId,
      x: avatar.x,
      y: avatar.y,
      facing: avatar.facing,
      directionX: swing.direction.x,
      directionY: swing.direction.y,
      target: swing.target,
      comboStep: swing.comboStep,
    });

    this.options.setPlayerAvatar(
      playerId,
      avatar.x,
      avatar.y,
      fieldFacingFromDelta(direction.x, direction.y, avatar.facing),
    );
  }

  private updateBladeSwing(deltaMs: number, currentTime: number): void {
    (["P1", "P2"] as PlayerId[]).forEach((playerId) => {
      const bladeSwing = this.getPlayerBladeSwing(playerId);
      if (!bladeSwing) {
        return;
      }

      const elapsed = currentTime - bladeSwing.startedAt;
      const avatar = this.options.getPlayerAvatar(playerId);
      if (!avatar) {
        this.setPlayerBladeSwing(playerId, null);
        return;
      }

      if (elapsed >= BLADE_LUNGE_START_MS && elapsed <= BLADE_LUNGE_END_MS) {
        const step = BLADE_LUNGE_SPEED_PX_PER_SECOND * (deltaMs / 1000);
        const nextX = avatar.x + bladeSwing.direction.x * step;
        const nextY = avatar.y + bladeSwing.direction.y * step;
        let lungeX = avatar.x;
        let lungeY = avatar.y;
        if (this.canPlayerMoveTo(playerId, nextX, avatar.y, PLAYER_WIDTH, PLAYER_HEIGHT)) {
          lungeX = nextX;
        }
        if (this.canPlayerMoveTo(playerId, lungeX, nextY, PLAYER_WIDTH, PLAYER_HEIGHT)) {
          lungeY = nextY;
        }
        this.options.setPlayerAvatar(playerId, lungeX, lungeY, avatar.facing);
      }

      if (!bladeSwing.struck && elapsed >= BLADE_SWING_IMPACT_MS) {
        bladeSwing.struck = true;
        const strikeLine = this.getBladeStrikeLine(avatar, bladeSwing);
        const verticalFinisher = this.isVerticalBladeFinisher(bladeSwing);
        const didHit = bladeSwing.visualOnly
          ? false
          : this.options.onBladeStrike?.({
            playerId,
            x: avatar.x,
            y: avatar.y,
            facing: avatar.facing,
            directionX: strikeLine.bladeDirection.x,
            directionY: strikeLine.bladeDirection.y,
            hiltX: strikeLine.hilt.x,
            hiltY: strikeLine.hilt.y,
            tipX: strikeLine.tip.x,
            tipY: strikeLine.tip.y,
            bladeHalfWidth: BLADE_SWING_HIT_WIDTH_PX,
            target: bladeSwing.target,
            radius: Math.max(
              BLADE_SWING_RANGE_PX,
              Math.hypot(strikeLine.hilt.x - avatar.x, strikeLine.hilt.y - avatar.y),
              Math.hypot(strikeLine.tip.x - avatar.x, strikeLine.tip.y - avatar.y),
            ),
            arcRadians: verticalFinisher ? Math.PI * 0.78 : BLADE_SWING_ARC_RADIANS,
            damage: BLADE_SWING_DAMAGE,
            knockback: BLADE_SWING_KNOCKBACK,
          }) ?? false;
        this.spawnBladeSlashEffect(strikeLine, bladeSwing, didHit);
        if (didHit) {
          this.spawnHitSpark(
            {
              x: (strikeLine.hilt.x + strikeLine.tip.x) / 2,
              y: (strikeLine.hilt.y + strikeLine.tip.y) / 2,
            },
            0xf2b04d,
            this.getBladeSlashNormal(strikeLine, bladeSwing.side),
          );
          this.beginImpactFeedback({
            x: (strikeLine.hilt.x + strikeLine.tip.x) / 2,
            y: (strikeLine.hilt.y + strikeLine.tip.y) / 2,
          }, 1);
        }
      }

      if (elapsed >= BLADE_SWING_TOTAL_MS) {
        this.setPlayerBladeSwing(playerId, null);
      }
    });
  }

  private getBladeStrikeLine(
    avatar: FieldAvatarView,
    swing: BladeSwingState,
  ): BladeSwingPose {
    const elapsed = this.currentFrameTime - swing.startedAt;
    return this.getBladeSwingPose(avatar, swing, elapsed);
  }

  private getBladeSwingPose(
    avatar: FieldAvatarView,
    swing: BladeSwingState,
    elapsed: number,
  ): BladeSwingPose {
    const pose = this.getBladeSwingPoseValues(elapsed, swing);
    const forward = swing.direction;
    const right = { x: forward.y, y: -forward.x };
    const bladeDirection = {
      x: (forward.x * Math.cos(pose.localYaw)) + (right.x * Math.sin(pose.localYaw)),
      y: (forward.y * Math.cos(pose.localYaw)) + (right.y * Math.sin(pose.localYaw)),
    };
    const bladeDirectionLength = Math.max(0.001, Math.hypot(bladeDirection.x, bladeDirection.y));
    bladeDirection.x /= bladeDirectionLength;
    bladeDirection.y /= bladeDirectionLength;
    const hilt = {
      x: avatar.x + (forward.x * pose.hiltForwardPx) + (right.x * pose.hiltSidePx),
      y: avatar.y + (forward.y * pose.hiltForwardPx) + (right.y * pose.hiltSidePx),
    };
    const tip = {
      x: hilt.x + (bladeDirection.x * BLADE_SWING_BLADE_LENGTH_PX),
      y: hilt.y + (bladeDirection.y * BLADE_SWING_BLADE_LENGTH_PX),
    };

    return {
      ...pose,
      bladeDirection,
      hilt,
      tip,
    };
  }

  private getBladeSwingPoseValues(
    elapsed: number,
    swing: BladeSwingState,
  ): Omit<BladeSwingPose, "bladeDirection" | "hilt" | "tip"> {
    const side = swing.side;
    const verticalFinisher = this.isVerticalBladeFinisher(swing);
    const handedSide = side * PLAYER_RIGHT_HAND_LOCAL_X;
    const startYaw = BLADE_SWING_START_LOCAL_YAW * handedSide;
    const endYaw = BLADE_SWING_END_LOCAL_YAW * handedSide;
    const swingProgress = this.getBladeSwingArcProgress(elapsed);
    const slashPulse = Math.sin(swingProgress * Math.PI);
    if (verticalFinisher) {
      const dropDrive = smoothstep((swingProgress - 0.14) / 0.56);
      const wobble = Math.sin(swingProgress * Math.PI) * 0.06 * PLAYER_RIGHT_HAND_LOCAL_X;
      return {
        localYaw: THREE.MathUtils.lerp(0.34 * PLAYER_RIGHT_HAND_LOCAL_X, -0.04 * PLAYER_RIGHT_HAND_LOCAL_X, dropDrive) + wobble,
        slashPulse,
        hiltForwardPx: THREE.MathUtils.lerp(26, 70, dropDrive) + (18 * slashPulse),
        hiltSidePx: THREE.MathUtils.lerp(34 * PLAYER_RIGHT_HAND_LOCAL_X, 4 * PLAYER_RIGHT_HAND_LOCAL_X, dropDrive),
      };
    }
    const whip = Math.sin(swingProgress * Math.PI * 2) * 0.16 * (1 - Math.abs(0.5 - swingProgress));
    const localYaw = THREE.MathUtils.lerp(startYaw, endYaw, swingProgress) + (whip * handedSide);
    const hiltSidePx = THREE.MathUtils.lerp(
      BLADE_SWING_HILT_SIDE_START_PX * handedSide,
      BLADE_SWING_HILT_SIDE_END_PX * handedSide,
      swingProgress,
    );

    return {
      localYaw,
      slashPulse,
      hiltForwardPx: BLADE_SWING_HILT_FORWARD_PX + (24 * slashPulse) - (8 * Math.max(0, 0.22 - swingProgress)),
      hiltSidePx: hiltSidePx + (10 * handedSide * slashPulse),
    };
  }

  private getBladeSwingArcProgress(elapsed: number): number {
    const t = THREE.MathUtils.clamp(
      (elapsed - BLADE_SWING_ARC_START_MS) / (BLADE_SWING_ARC_END_MS - BLADE_SWING_ARC_START_MS),
      0,
      1,
    );

    if (t < 0.22) {
      const anticipation = t / 0.22;
      return 0.12 * anticipation * anticipation;
    }

    if (t < 0.58) {
      const cut = (t - 0.22) / 0.36;
      const snap = 1 - Math.pow(1 - THREE.MathUtils.clamp(cut, 0, 1), 3);
      return THREE.MathUtils.lerp(0.12, 0.94, snap);
    }

    const followThrough = smoothstep((t - 0.58) / 0.42);
    return THREE.MathUtils.lerp(0.94, 1, followThrough);
  }

  private fireLauncher(playerId: PlayerId = "P1"): void {
    const now = this.currentFrameTime || performance.now();
    if (this.getPlayerActiveMode(playerId) !== "launcher" || now < this.getPlayerActionCooldownUntil(playerId)) {
      return;
    }

    const avatar = this.options.getPlayerAvatar(playerId);
    if (!avatar) {
      return;
    }

    const target = this.findEnemyActionTarget(playerId, avatar, LAUNCHER_RANGE_PX, 0.12);
    const direction = this.getActionDirection(playerId, avatar, target);
    const originX = avatar.x + direction.x * 36;
    const originY = avatar.y + direction.y * 36;
    const canFire = this.options.onLauncherFire?.({
      playerId,
      x: originX,
      y: originY,
      directionX: direction.x,
      directionY: direction.y,
      target,
    }) ?? true;
    if (!canFire) {
      return;
    }

    this.spawnLauncherProjectile(playerId, originX, originY, direction, target, false);
    this.setPlayerActionCooldownUntil(playerId, now + LAUNCHER_COOLDOWN_MS);
    this.setPlayerLauncherRecoilStartedAt(playerId, now);
    this.options.setPlayerAvatar(playerId, avatar.x, avatar.y, fieldFacingFromDelta(direction.x, direction.y, avatar.facing));
  }

  private spawnLauncherProjectile(
    playerId: PlayerId,
    originX: number,
    originY: number,
    direction: { x: number; y: number },
    target: Haven3DTargetRef | null,
    visualOnly: boolean,
  ): void {
    const originPoint = { x: originX, y: originY };
    const projectileGroup = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 14, 10),
      createArdyciaToonMaterial({
        color: 0xf2b04d,
        emissive: 0x8c3f10,
        emissiveIntensity: 1.8,
      }),
    );
    projectileGroup.add(mesh);
    const world = fieldToHavenWorld(this.options.map, originPoint, this.getGroundElevationAtPoint(originPoint) + 1.12);
    projectileGroup.position.set(world.x, world.y, world.z);
    mesh.castShadow = true;
    this.dynamicGroup.add(projectileGroup);

    this.launcherProjectiles.push({
      playerId,
      mesh: projectileGroup,
      x: originX,
      y: originY,
      vx: direction.x * LAUNCHER_SPEED_PX_PER_SECOND,
      vy: direction.y * LAUNCHER_SPEED_PX_PER_SECOND,
      ttlMs: (LAUNCHER_RANGE_PX / LAUNCHER_SPEED_PX_PER_SECOND) * 1000,
      target,
      radius: LAUNCHER_HIT_RADIUS_PX,
      damage: LAUNCHER_DAMAGE,
      knockback: LAUNCHER_KNOCKBACK,
      visualOnly,
    });
  }

  private getLauncherRecoilAmount(
    playerId: PlayerId = "P1",
    now = this.currentFrameTime || performance.now(),
  ): number {
    const elapsed = now - this.getPlayerLauncherRecoilStartedAt(playerId);
    if (elapsed < 0 || elapsed >= LAUNCHER_RECOIL_MS) {
      return 0;
    }

    const t = THREE.MathUtils.clamp(elapsed / LAUNCHER_RECOIL_MS, 0, 1);
    const kick = 1 - smoothstep(t / 0.34);
    const recovery = 1 - smoothstep((t - 0.18) / 0.82);
    return THREE.MathUtils.clamp((0.72 * kick) + (0.28 * recovery), 0, 1);
  }

  private updateLauncherProjectiles(deltaMs: number): void {
    for (let index = this.launcherProjectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.launcherProjectiles[index];
      projectile.ttlMs -= deltaMs;

      const target = projectile.target ? this.findTargetForRef(projectile.target, projectile.playerId) : null;
      if (target?.kind === "enemy") {
        const toTargetX = target.x - projectile.x;
        const toTargetY = target.y - projectile.y;
        const length = Math.max(0.001, Math.hypot(toTargetX, toTargetY));
        const desiredVx = (toTargetX / length) * LAUNCHER_SPEED_PX_PER_SECOND;
        const desiredVy = (toTargetY / length) * LAUNCHER_SPEED_PX_PER_SECOND;
        projectile.vx = THREE.MathUtils.lerp(projectile.vx, desiredVx, 0.16);
        projectile.vy = THREE.MathUtils.lerp(projectile.vy, desiredVy, 0.16);
      }

      projectile.x += projectile.vx * (deltaMs / 1000);
      projectile.y += projectile.vy * (deltaMs / 1000);
      const projectilePoint = { x: projectile.x, y: projectile.y };
      const world = fieldToHavenWorld(this.options.map, projectilePoint, this.getGroundElevationAtPoint(projectilePoint) + 1.12);
      projectile.mesh.position.set(world.x, world.y, world.z);

      const hitEnemy = this.options.getEnemies()
        .filter((enemy) => enemy.hp > 0)
        .find((enemy) => Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) <= projectile.radius + Math.max(enemy.width, enemy.height) * 0.5);
      if (hitEnemy) {
        if (projectile.visualOnly) {
          this.spawnHitSpark({ x: projectile.x, y: projectile.y }, 0xf2b04d);
          this.removeLauncherProjectile(index);
          continue;
        }
        const didHit = this.options.onLauncherImpact?.({
          playerId: projectile.playerId,
          x: projectile.x,
          y: projectile.y,
          target: {
            kind: "enemy",
            id: hitEnemy.id,
            key: `enemy:${hitEnemy.id}`,
          },
          radius: projectile.radius,
          damage: projectile.damage,
          knockback: projectile.knockback,
        }) ?? false;
        this.spawnHitSpark({ x: projectile.x, y: projectile.y }, didHit ? 0xf2b04d : 0x6f6a5d);
        if (didHit) {
          this.beginImpactFeedback({ x: projectile.x, y: projectile.y }, 0.72);
        }
        this.removeLauncherProjectile(index);
        continue;
      }

      if (projectile.ttlMs <= 0) {
        this.spawnHitSpark({ x: projectile.x, y: projectile.y }, 0x6f6a5d);
        this.removeLauncherProjectile(index);
      }
    }
  }

  private removeLauncherProjectile(index: number): void {
    const projectile = this.launcherProjectiles[index];
    if (!projectile) {
      return;
    }

    this.dynamicGroup.remove(projectile.mesh);
    disposeObject(projectile.mesh);
    this.launcherProjectiles.splice(index, 1);
  }

  private createGrappleLineVisuals(): { line: THREE.Line; hook: THREE.Mesh } {
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x4fb4a4,
      transparent: true,
      opacity: 0.9,
    });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]), lineMaterial);
    line.renderOrder = 20;
    const hook = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.035, 8, 16, Math.PI * 1.35),
      new THREE.MeshBasicMaterial({
        color: 0x66dbc9,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      }),
    );
    hook.rotation.x = Math.PI / 2;
    this.dynamicGroup.add(line, hook);
    return { line, hook };
  }

  private fireGrapple(playerId: PlayerId = "P1"): void {
    const now = this.currentFrameTime || performance.now();
    if (
      this.getPlayerActiveMode(playerId) !== "grapple"
      || now < this.getPlayerActionCooldownUntil(playerId)
      || this.getPlayerGrappleMove(playerId)
    ) {
      return;
    }

    const avatar = this.options.getPlayerAvatar(playerId);
    const lockedTarget = this.getLockedTargetCandidate(playerId);
    const lockedActionTarget = lockedTarget && lockedTarget.kind !== "loot-orb" && lockedTarget.distance <= GRAPPLE_RANGE_PX
      ? lockedTarget
      : null;
    const ziplineTarget = lockedActionTarget ? null : this.findGrappleZiplineTarget(playerId, GRAPPLE_RANGE_PX);
    const anchor = lockedActionTarget || ziplineTarget ? null : this.findGrappleAnchor(playerId, GRAPPLE_RANGE_PX);
    const actionTarget = lockedActionTarget ?? (ziplineTarget || anchor ? null : this.findActionTarget(playerId, GRAPPLE_RANGE_PX));
    if (!avatar || (!ziplineTarget && !anchor && !actionTarget)) {
      this.setPlayerActionCooldownUntil(playerId, now + GRAPPLE_COOLDOWN_MS * 0.45);
      return;
    }

    this.setPlayerZiplineDismountDrift(playerId, null);

    const targetPoint = ziplineTarget
      ? ziplineTarget.attachPoint
      : anchor
      ? { x: anchor.x, y: anchor.y }
      : { x: actionTarget?.x ?? avatar.x, y: actionTarget?.y ?? avatar.y };
    const targetRef: Haven3DTargetRef | GrappleAnchorTargetRef | GrappleZiplineTargetRef = ziplineTarget
      ? { kind: "zipline-track", id: ziplineTarget.segment.id, key: ziplineTarget.segment.key }
      : anchor
      ? { kind: "grapple-node", id: anchor.id, key: anchor.key }
      : {
        kind: actionTarget!.kind,
        id: actionTarget!.id,
        key: actionTarget!.key,
      };
    const direction = this.getActionDirection(playerId, avatar, targetPoint);
    const ziplineRideDistance = ziplineTarget
      ? Math.hypot(ziplineTarget.endPoint.x - ziplineTarget.attachPoint.x, ziplineTarget.endPoint.y - ziplineTarget.attachPoint.y)
      : 0;
    const ziplineAttachDistance = ziplineTarget
      ? Math.hypot(ziplineTarget.attachPoint.x - avatar.x, ziplineTarget.attachPoint.y - avatar.y)
      : 0;
    const ziplineAttachDurationMs = ziplineTarget
      ? THREE.MathUtils.clamp(
        (ziplineAttachDistance / Math.max(1, GRAPPLE_PULL_SPEED_PX_PER_SECOND)) * 1000,
        GRAPPLE_ZIPLINE_MIN_ATTACH_DURATION_MS,
        GRAPPLE_ZIPLINE_MAX_ATTACH_DURATION_MS,
      )
      : 0;
    const ziplineRideDurationMs = ziplineTarget
      ? THREE.MathUtils.clamp(
        (ziplineRideDistance / Math.max(1, GRAPPLE_ZIPLINE_RIDE_SPEED_PX_PER_SECOND)) * 1000,
        GRAPPLE_ZIPLINE_MIN_RIDE_DURATION_MS,
        GRAPPLE_ZIPLINE_MAX_RIDE_DURATION_MS,
      )
      : 0;
    const targetHeight = ziplineTarget?.attachHeight ?? anchor?.height ?? this.getGroundElevationAtPoint(targetPoint) + 1.08;
    const swing = anchor
      ? {
        startX: avatar.x,
        startY: avatar.y,
        durationMs: GRAPPLE_SWING_DURATION_MS,
        arcHeight: GRAPPLE_SWING_ARC_HEIGHT,
      }
      : undefined;
    const zipline = ziplineTarget
      ? {
        segmentKey: ziplineTarget.segment.key,
        startX: avatar.x,
        startY: avatar.y,
        startHeight: this.getPlayerVisualWorldElevation(playerId, { x: avatar.x, y: avatar.y }),
        attachX: ziplineTarget.attachPoint.x,
        attachY: ziplineTarget.attachPoint.y,
        attachHeight: ziplineTarget.attachHeight,
        attachT: ziplineTarget.attachT,
        endX: ziplineTarget.endPoint.x,
        endY: ziplineTarget.endPoint.y,
        endHeight: ziplineTarget.endHeight,
        endT: ziplineTarget.endT,
        attachDurationMs: ziplineAttachDurationMs,
        rideDurationMs: ziplineRideDurationMs,
      }
      : undefined;
    const { line, hook } = this.createGrappleLineVisuals();

    this.setPlayerGrappleMove(playerId, {
      playerId,
      startedAt: now,
      target: targetRef,
      targetPoint,
      targetHeight,
      impacted: false,
      line,
      hook,
      swing,
      zipline,
    });
    this.setPlayerActionCooldownUntil(playerId, now + GRAPPLE_COOLDOWN_MS);
    this.options.setPlayerAvatar(playerId, avatar.x, avatar.y, fieldFacingFromDelta(direction.x, direction.y, avatar.facing));
    this.options.onGrappleFire?.({
      playerId,
      x: avatar.x,
      y: avatar.y,
      target: actionTarget
        ? {
          kind: actionTarget.kind,
          id: actionTarget.id,
          key: actionTarget.key,
        }
        : null,
      targetX: targetPoint.x,
      targetY: targetPoint.y,
      targetHeight,
      grappleKind: ziplineTarget ? "zipline" : anchor ? "anchor" : "target",
      swing: swing
        ? {
          durationMs: swing.durationMs,
          arcHeight: swing.arcHeight,
        }
        : undefined,
      zipline,
    });
    this.updateGrappleLine(playerId);
  }

  private updateGrappleMove(deltaMs: number, currentTime: number): void {
    (["P1", "P2"] as PlayerId[]).forEach((playerId) => {
      const move = this.getPlayerGrappleMove(playerId);
      if (!move) {
        return;
      }

      const avatar = this.options.getPlayerAvatar(playerId);
      if (!avatar) {
        this.finishGrappleMove(playerId, false);
        return;
      }

      if (move.target.kind === "zipline-track") {
        this.updateGrappleZipline(playerId, currentTime, avatar);
        return;
      }

      if (move.target.kind === "grapple-node") {
        this.updateGrappleSwing(playerId, currentTime, avatar);
        return;
      }

      const liveTarget = this.findTargetForRef(move.target, playerId);
      if (liveTarget) {
        move.targetPoint = { x: liveTarget.x, y: liveTarget.y };
      }

      if (!move.impacted && move.target.kind === "enemy") {
        move.impacted = true;
        const didHit = move.visualOnly
          ? false
          : (this.options.onGrappleImpact?.({
            playerId,
            x: avatar.x,
            y: avatar.y,
            target: move.target,
            damage: GRAPPLE_DAMAGE,
            knockback: GRAPPLE_KNOCKBACK,
          }) ?? false);
        if (didHit) {
          this.spawnHitSpark(move.targetPoint, 0x4fb4a4);
          this.beginImpactFeedback(move.targetPoint, 0.72);
        }
      }

      const dx = move.targetPoint.x - avatar.x;
      const dy = move.targetPoint.y - avatar.y;
      const distance = Math.hypot(dx, dy);
      const elapsed = currentTime - move.startedAt;
      if (distance <= GRAPPLE_STOP_DISTANCE_PX || elapsed >= GRAPPLE_MAX_DURATION_MS) {
        this.finishGrappleMove(playerId, true);
        return;
      }

      const step = Math.min(distance - GRAPPLE_STOP_DISTANCE_PX, GRAPPLE_PULL_SPEED_PX_PER_SECOND * (deltaMs / 1000));
      const moveX = (dx / Math.max(0.001, distance)) * step;
      const moveY = (dy / Math.max(0.001, distance)) * step;
      let nextX = avatar.x + moveX;
      let nextY = avatar.y + moveY;
      if (!this.canPlayerMoveTo(playerId, nextX, avatar.y, PLAYER_WIDTH, PLAYER_HEIGHT)) {
        nextX = avatar.x;
      }
      if (!this.canPlayerMoveTo(playerId, nextX, nextY, PLAYER_WIDTH, PLAYER_HEIGHT)) {
        nextY = avatar.y;
      }

      this.options.setPlayerAvatar(playerId, nextX, nextY, fieldFacingFromDelta(dx, dy, avatar.facing));
      this.updateGrappleLine(playerId);
    });
  }

  private updateGrappleSwing(playerId: PlayerId, currentTime: number, avatar: FieldAvatarView): void {
    const move = this.getPlayerGrappleMove(playerId);
    if (!move?.swing) {
      this.finishGrappleMove(playerId, false);
      return;
    }

    const elapsed = currentTime - move.startedAt;
    const progress = THREE.MathUtils.clamp(elapsed / move.swing.durationMs, 0, 1);
    const easedProgress = smoothstep(progress);
    const startX = move.swing.startX;
    const startY = move.swing.startY;
    const targetX = move.targetPoint.x;
    const targetY = move.targetPoint.y;
    const nextX = THREE.MathUtils.lerp(startX, targetX, easedProgress);
    const nextY = THREE.MathUtils.lerp(startY, targetY, easedProgress);
    const lift = Math.sin(progress * Math.PI) * move.swing.arcHeight;
    const facing = fieldFacingFromDelta(targetX - avatar.x, targetY - avatar.y, avatar.facing);

    this.options.setPlayerAvatar(playerId, nextX, nextY, facing);
    this.setPlayerSwingElevation(playerId, lift);
    this.updateGrappleLine(playerId);

    if (progress >= 1) {
      this.finishGrappleMove(playerId, true);
    }
  }

  private updateGrappleZipline(playerId: PlayerId, currentTime: number, avatar: FieldAvatarView): void {
    const move = this.getPlayerGrappleMove(playerId);
    const zipline = move?.zipline;
    if (!move || !zipline) {
      this.finishGrappleMove(playerId, false);
      return;
    }

    const elapsed = Math.max(0, currentTime - move.startedAt);
    const attachDuration = Math.max(1, zipline.attachDurationMs);
    const rideDuration = Math.max(1, zipline.rideDurationMs);
    const rideVector = {
      x: zipline.endX - zipline.attachX,
      y: zipline.endY - zipline.attachY,
    };
    const rideVerticalVelocity = (zipline.endHeight - zipline.attachHeight) / Math.max(0.001, rideDuration / 1000);

    let nextX = zipline.attachX;
    let nextY = zipline.attachY;
    let cableHeight = zipline.attachHeight;
    let riderWorldHeight = Math.max(0, zipline.attachHeight - GRAPPLE_ZIPLINE_RIDER_HAND_OFFSET_WORLD);
    let rideComplete = false;

    if (elapsed < attachDuration) {
      const attachProgress = smoothstep(THREE.MathUtils.clamp(elapsed / attachDuration, 0, 1));
      nextX = THREE.MathUtils.lerp(zipline.startX, zipline.attachX, attachProgress);
      nextY = THREE.MathUtils.lerp(zipline.startY, zipline.attachY, attachProgress);
      riderWorldHeight = THREE.MathUtils.lerp(
        zipline.startHeight,
        Math.max(0, zipline.attachHeight - GRAPPLE_ZIPLINE_RIDER_HAND_OFFSET_WORLD),
        attachProgress,
      );
      move.targetPoint = { x: zipline.attachX, y: zipline.attachY };
      move.targetHeight = zipline.attachHeight;
    } else {
      const rideProgress = THREE.MathUtils.clamp((elapsed - attachDuration) / rideDuration, 0, 1);
      const segment = this.grappleZiplineSegments.get(zipline.segmentKey);
      if (segment) {
        const t = THREE.MathUtils.lerp(zipline.attachT, zipline.endT, rideProgress);
        const cablePoint = this.getPointOnZiplineSegment(segment, t);
        nextX = cablePoint.x;
        nextY = cablePoint.y;
        cableHeight = cablePoint.height;
      } else {
        nextX = THREE.MathUtils.lerp(zipline.attachX, zipline.endX, rideProgress);
        nextY = THREE.MathUtils.lerp(zipline.attachY, zipline.endY, rideProgress);
        cableHeight = THREE.MathUtils.lerp(zipline.attachHeight, zipline.endHeight, rideProgress);
      }
      riderWorldHeight = Math.max(0, cableHeight - GRAPPLE_ZIPLINE_RIDER_HAND_OFFSET_WORLD);
      move.targetPoint = { x: nextX, y: nextY };
      move.targetHeight = cableHeight;
      rideComplete = rideProgress >= 1;
    }

    this.options.setPlayerAvatar(
      playerId,
      nextX,
      nextY,
      fieldFacingFromDelta(rideVector.x, rideVector.y, avatar.facing),
    );
    const groundElevation = this.getGroundElevationAtPoint({ x: nextX, y: nextY });
    this.setPlayerSwingElevation(playerId, Math.max(0, riderWorldHeight - groundElevation));
    this.updateGrappleLine(playerId);

    if (rideComplete) {
      this.releasePlayerFromZipline(
        playerId,
        { x: nextX, y: nextY },
        riderWorldHeight,
        rideVector,
        rideVerticalVelocity,
        currentTime,
      );
      this.finishGrappleMove(playerId, true, { preserveAirborne: true });
    }
  }

  private updateGrappleLine(playerId: PlayerId = "P1"): void {
    const move = this.getPlayerGrappleMove(playerId);
    if (!move) {
      return;
    }

    const avatar = this.options.getPlayerAvatar(playerId);
    if (!avatar) {
      return;
    }

    const avatarPoint = { x: avatar.x, y: avatar.y };
    const playerWorldElevation = this.getPlayerVisualWorldElevation(playerId, avatarPoint);
    const lineStartHeight = move.target.kind === "zipline-track"
      ? playerWorldElevation + GRAPPLE_ZIPLINE_RIDER_HAND_OFFSET_WORLD
      : playerWorldElevation + 1.18;
    const from = fieldToHavenWorld(this.options.map, avatarPoint, lineStartHeight);
    const to = fieldToHavenWorld(this.options.map, move.targetPoint, move.targetHeight);
    move.line.geometry.setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    move.hook.position.set(to.x, to.y, to.z);
    move.hook.rotation.z += 0.18;
  }

  private finishGrappleMove(
    playerId: PlayerId = "P1",
    spawnSpark = false,
    options: FinishGrappleMoveOptions = {},
  ): void {
    const move = this.getPlayerGrappleMove(playerId);
    if (!move) {
      return;
    }

    const wasAirborneGrapple = move.target.kind === "grapple-node"
      || move.target.kind === "zipline-track";
    if (spawnSpark) {
      this.spawnHitSpark(move.targetPoint, 0x4fb4a4);
    }
    this.dynamicGroup.remove(move.line, move.hook);
    disposeObject(move.line);
    disposeObject(move.hook);
    this.setPlayerGrappleMove(playerId, null);
    if (wasAirborneGrapple && !options.preserveAirborne) {
      this.landPlayerVertical(playerId);
    }
  }

  private updateActorMotion(
    actor: Actor,
    fieldX: number,
    fieldY: number,
    intensity = 1,
    fallbackYaw = 0,
    lookDirection: { x: number; y: number } | null = null,
    dashIntent = false,
    airborne = false,
  ): void {
    const currentTime = this.currentFrameTime || performance.now();
    const motion = actor.motion ?? {
      lastX: fieldX,
      lastY: fieldY,
      lastTime: currentTime,
      cycle: (((fieldX * 0.013) + (fieldY * 0.017)) % 1) * Math.PI * 2,
      visualYaw: fallbackYaw,
      speedPxPerSecond: 0,
      moving: false,
      dashActive: false,
      dashBurstStartedAt: Number.NEGATIVE_INFINITY,
    };

    const deltaSeconds = Math.min(0.12, Math.max(0, (currentTime - motion.lastTime) / 1000));
    const deltaX = fieldX - motion.lastX;
    const deltaY = fieldY - motion.lastY;
    const distance = Math.hypot(fieldX - motion.lastX, fieldY - motion.lastY);
    const instantSpeed = deltaSeconds > 0 ? distance / deltaSeconds : 0;
    const smoothing = deltaSeconds > 0 ? 1 - Math.pow(0.015, deltaSeconds) : 1;
    motion.speedPxPerSecond = THREE.MathUtils.lerp(motion.speedPxPerSecond, instantSpeed, smoothing);
    motion.moving = motion.speedPxPerSecond > 12;
    const dashStarted = dashIntent && !motion.dashActive;
    if (dashStarted) {
      motion.dashBurstStartedAt = currentTime;
    }
    motion.dashActive = dashIntent;
    if (motion.moving && !airborne) {
      const speedRatio = motion.speedPxPerSecond / PLAYER_SPEED_PX_PER_SECOND;
      const runBlend = smoothstep((speedRatio - 1.05) / 0.45);
      const walkCycleRate = THREE.MathUtils.clamp(motion.speedPxPerSecond / 44, 3.1, 7.4);
      const runCycleRate = THREE.MathUtils.clamp(motion.speedPxPerSecond / 50, 7.8, 12.8);
      const cycleRate = THREE.MathUtils.lerp(walkCycleRate, runCycleRate, runBlend);
      motion.cycle += deltaSeconds * cycleRate * intensity;
    }

    const lookLength = lookDirection ? Math.hypot(lookDirection.x, lookDirection.y) : 0;
    const targetYaw = lookDirection && lookLength > 0.001
      ? getYawFromFieldDelta(lookDirection.x, lookDirection.y, motion.visualYaw)
      : distance > 0.05
        ? getYawFromFieldDelta(deltaX, deltaY, motion.visualYaw)
        : motion.visualYaw;
    const yawSmoothing = deltaSeconds > 0 ? 1 - Math.pow(0.0004, deltaSeconds) : 1;
    motion.visualYaw = lerpAngleRadians(motion.visualYaw, targetYaw, yawSmoothing);
    actor.group.rotation.y = motion.visualYaw;
    if (dashStarted) {
      this.spawnDashBurstEffect({ x: fieldX, y: fieldY }, motion.visualYaw);
      this.cameraImpulse.y += 0.035 * intensity;
    }

    motion.lastX = fieldX;
    motion.lastY = fieldY;
    motion.lastTime = currentTime;
    actor.motion = motion;

    this.applyChibiMotion(actor.chibi, motion, intensity, airborne);
  }

  private updateSableMotion(
    actor: Actor,
    companion: Companion,
    lookDirection: { x: number; y: number } | null = null,
    airborne = false,
    vertical: CompanionVerticalState | null = null,
  ): void {
    const currentTime = this.currentFrameTime || performance.now();
    const fallbackYaw = this.getRotationForFacing(companion.facing);
    const motion = actor.motion ?? {
      lastX: companion.x,
      lastY: companion.y,
      lastTime: currentTime,
      cycle: (((companion.x * 0.017) + (companion.y * 0.011)) % 1) * Math.PI * 2,
      visualYaw: fallbackYaw,
      speedPxPerSecond: 0,
      moving: false,
    };

    const deltaSeconds = Math.min(0.12, Math.max(0, (currentTime - motion.lastTime) / 1000));
    const deltaX = companion.x - motion.lastX;
    const deltaY = companion.y - motion.lastY;
    const distance = Math.hypot(deltaX, deltaY);
    const instantSpeed = deltaSeconds > 0 ? distance / deltaSeconds : 0;
    const smoothing = deltaSeconds > 0 ? 1 - Math.pow(0.018, deltaSeconds) : 1;
    motion.speedPxPerSecond = THREE.MathUtils.lerp(motion.speedPxPerSecond, instantSpeed, smoothing);
    motion.moving = motion.speedPxPerSecond > 10;
    if (motion.moving && !airborne) {
      const baseSpeed = Math.max(1, companion.speed || 240);
      const speedRatio = THREE.MathUtils.clamp(motion.speedPxPerSecond / baseSpeed, 0, 2.2);
      const sprintBlend = smoothstep((speedRatio - SABLE_SPRINT_SPEED_RATIO_START) / SABLE_SPRINT_SPEED_RATIO_SPAN);
      const stateBoost = companion.state === "attack" ? 1.16 : companion.state === "fetch" ? 1.08 : 1;
      const cycleRate = THREE.MathUtils.clamp(motion.speedPxPerSecond / 36, 4.8, 16.8);
      motion.cycle += deltaSeconds * cycleRate * stateBoost * (1 + (sprintBlend * 0.28));
    } else {
      motion.cycle += deltaSeconds * (companion.state === "idle" ? 0.18 : 0.42);
    }

    const lookLength = lookDirection ? Math.hypot(lookDirection.x, lookDirection.y) : 0;
    const targetYaw = lookDirection && lookLength > 0.001
      ? getYawFromFieldDelta(lookDirection.x, lookDirection.y, motion.visualYaw)
      : distance > 0.05
        ? getYawFromFieldDelta(deltaX, deltaY, motion.visualYaw)
        : fallbackYaw;
    const yawSmoothing = deltaSeconds > 0 ? 1 - Math.pow(0.0007, deltaSeconds) : 1;
    motion.visualYaw = lerpAngleRadians(motion.visualYaw, targetYaw, yawSmoothing);
    actor.group.rotation.y = motion.visualYaw;

    motion.lastX = companion.x;
    motion.lastY = companion.y;
    motion.lastTime = currentTime;
    actor.motion = motion;

    this.applySableMotion(actor.sable, motion, companion, airborne, vertical);
  }

  private applyChibiMotion(
    chibi: ChibiRig | undefined,
    motion: ActorMotionState,
    intensity: number,
    airborne = false,
  ): void {
    if (!chibi) {
      return;
    }
    if (chibi.glider) {
      chibi.glider.visible = false;
    }

    const currentTime = this.currentFrameTime || performance.now();
    const rawSpeedRatio = motion.moving
      ? THREE.MathUtils.clamp((motion.speedPxPerSecond / PLAYER_SPEED_PX_PER_SECOND) * intensity, 0, 1.75)
      : 0;
    const speedRatio = airborne ? 0 : rawSpeedRatio;
    const moveBlend = motion.moving ? smoothstep(speedRatio / 0.22) : 0;
    const runBlend = motion.moving ? smoothstep((speedRatio - 1.05) / 0.45) : 0;
    const walkBlend = moveBlend * (1 - runBlend);
    const cycle = motion.cycle;
    const swing = Math.sin(cycle);
    const counterSwing = Math.sin(cycle + Math.PI);
    const stepBounce = Math.abs(Math.sin(cycle));
    const doubleStep = Math.sin((cycle * 2) + 0.18);
    const idleBreath = Math.sin(currentTime * 0.0026 + cycle * 0.12);
    const idleWeight = 1 - moveBlend;
    const walkAmount = walkBlend * THREE.MathUtils.clamp(speedRatio, 0, 1);
    const runAmount = runBlend * THREE.MathUtils.clamp((speedRatio - 0.72) / 0.88, 0, 1.25);
    const sonicRunPose = THREE.MathUtils.clamp(runAmount, 0, 1);
    const dashBurstAge = (motion.dashBurstStartedAt ?? Number.NEGATIVE_INFINITY) === Number.NEGATIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : currentTime - (motion.dashBurstStartedAt ?? currentTime);
    const dashBurstStart = dashBurstAge <= DASH_BURST_POSE_MS
      ? 1 - smoothstep(dashBurstAge / DASH_BURST_POSE_MS)
      : 0;
    const dashHold = motion.dashActive ? smoothstep((speedRatio - 1.1) / 0.42) * 0.72 : 0;
    const dashBurstPose = moveBlend * Math.max(dashBurstStart, dashHold);
    const streamPoseBlend = THREE.MathUtils.clamp(Math.max(sonicRunPose, dashBurstPose), 0, 1);
    const dashPulse = Math.sin((cycle * 2.35) + 0.7) * dashBurstPose;
    const bob = (idleBreath * 0.014 * idleWeight)
      + (stepBounce * 0.052 * walkAmount)
      + ((0.038 + (Math.abs(doubleStep) * 0.092)) * runAmount)
      + (0.034 * dashBurstPose);
    const rootForwardLean = (0.024 * walkAmount) + (0.16 * runAmount) + (0.3 * dashBurstPose);
    const forwardLean = (0.018 * idleWeight) + (0.05 * walkAmount) + (0.22 * runAmount) + (0.36 * dashBurstPose);
    const torsoTwist = swing * ((0.035 * walkAmount) + (0.12 * runAmount * (1 - (0.32 * dashBurstPose))));
    const sideSway = (doubleStep * ((0.024 * walkAmount) + (0.06 * runAmount * (1 - (0.24 * dashBurstPose)))))
      + (dashPulse * 0.035);
    const legOutwardSplay = 0.075 + (0.018 * walkAmount) + (0.03 * runAmount) + (0.026 * dashBurstPose);

    chibi.root.position.set(0, 0.18 + bob, 0);
    chibi.root.rotation.set(rootForwardLean, 0, 0);
    chibi.torso.rotation.set(forwardLean, torsoTwist, sideSway);
    chibi.pelvis.rotation.set(0.018 + (forwardLean * 0.18), -torsoTwist * 0.42, -sideSway * 0.68);
    chibi.head.rotation.set(0.034 + (forwardLean * 0.05), -torsoTwist * 0.32, -sideSway * 0.36);
    if (chibi.cape) {
      const capeFlutter = Math.sin((cycle * 1.34) + 0.8) * ((0.035 * walkAmount) + (0.095 * runAmount) + (0.16 * dashBurstPose));
      const capeTrail = (0.035 * walkAmount) + (0.16 * runAmount) + (0.3 * dashBurstPose);
      chibi.cape.position.set(
        0.05 + (sideSway * 0.08),
        1.02 - (bob * 0.18),
        -0.31 - (capeTrail * 0.12),
      );
      chibi.cape.rotation.set(
        0.12 + capeTrail + (idleBreath * 0.012 * idleWeight),
        0.02 - (torsoTwist * 0.35) + (capeFlutter * 0.3),
        -0.05 - (sideSway * 0.75) + capeFlutter,
      );
      chibi.leftCapePanel?.rotation.set(0, 0.08 + capeFlutter * 0.8, -0.08 - capeFlutter * 1.15);
      chibi.rightCapePanel?.rotation.set(0, -0.08 + capeFlutter * 0.6, 0.08 - capeFlutter * 0.95);
    }

    const leftWalkArm = swing * 0.4 * walkAmount;
    const rightWalkArm = counterSwing * 0.4 * walkAmount;
    const armStream = Math.sin((cycle * 2) + 0.34) * streamPoseBlend;
    const leftLegSwing = swing;
    const rightLegSwing = counterSwing;
    const leftWalkLeg = leftLegSwing * 0.54 * walkAmount;
    const rightWalkLeg = rightLegSwing * 0.54 * walkAmount;
    const leftRunLeg = leftLegSwing * (1.05 + (0.3 * dashBurstPose)) * runAmount;
    const rightRunLeg = rightLegSwing * (1.05 + (0.3 * dashBurstPose)) * runAmount;
    const leftBackKick = Math.max(0, -leftLegSwing);
    const rightBackKick = Math.max(0, -rightLegSwing);
    const leftForwardReach = Math.max(0, leftLegSwing);
    const rightForwardReach = Math.max(0, rightLegSwing);

    chibi.leftUpperArm.rotation.set(
      THREE.MathUtils.lerp(0.26 + leftWalkArm, 1.16 + (0.08 * runAmount) + (0.46 * dashBurstPose) - (0.035 * armStream), streamPoseBlend),
      THREE.MathUtils.lerp(-0.08, -0.34 - (0.14 * dashBurstPose) + (0.035 * armStream), streamPoseBlend),
      THREE.MathUtils.lerp(0.24 + (0.06 * walkAmount), 0.5 + (0.04 * runAmount) + (0.18 * dashBurstPose), streamPoseBlend),
    );
    chibi.rightUpperArm.rotation.set(
      THREE.MathUtils.lerp(0.28 + rightWalkArm, 1.18 + (0.08 * runAmount) + (0.46 * dashBurstPose) + (0.035 * armStream), streamPoseBlend),
      THREE.MathUtils.lerp(0.1, 0.34 + (0.14 * dashBurstPose) + (0.035 * armStream), streamPoseBlend),
      THREE.MathUtils.lerp(-0.24 - (0.06 * walkAmount), -0.5 - (0.04 * runAmount) - (0.18 * dashBurstPose), streamPoseBlend),
    );
    chibi.leftForearm.rotation.set(
      THREE.MathUtils.lerp(-0.46 - (0.16 * walkAmount), 0.16 + (0.16 * dashBurstPose) - (0.045 * armStream), streamPoseBlend),
      THREE.MathUtils.lerp(-0.05, -0.12 - (0.08 * dashBurstPose), streamPoseBlend),
      THREE.MathUtils.lerp(0.16 + (0.04 * walkAmount), 0.08, streamPoseBlend),
    );
    chibi.rightForearm.rotation.set(
      THREE.MathUtils.lerp(-0.48 - (0.16 * walkAmount), 0.16 + (0.16 * dashBurstPose) + (0.045 * armStream), streamPoseBlend),
      THREE.MathUtils.lerp(0.05, 0.12 + (0.08 * dashBurstPose), streamPoseBlend),
      THREE.MathUtils.lerp(-0.16 - (0.04 * walkAmount), -0.08, streamPoseBlend),
    );

    const leftThighX = 0.08 + leftWalkLeg + leftRunLeg;
    const rightThighX = 0.08 + rightWalkLeg + rightRunLeg;
    const leftShinX = 0.16 + (0.46 * leftBackKick * walkAmount) + ((0.18 + (1.02 * leftBackKick)) * runAmount);
    const rightShinX = 0.16 + (0.46 * rightBackKick * walkAmount) + ((0.18 + (1.02 * rightBackKick)) * runAmount);
    const leftWalkFootPitch = (-0.1 * leftForwardReach * walkAmount) + (0.26 * leftBackKick * walkAmount);
    const rightWalkFootPitch = (-0.1 * rightForwardReach * walkAmount) + (0.26 * rightBackKick * walkAmount);
    const leftRunToeLift = Math.max(0, Math.sin(cycle + 0.3));
    const rightRunToeLift = Math.max(0, Math.sin(cycle + Math.PI + 0.3));
    const leftRunPushOff = Math.max(0, -Math.sin(cycle - 0.48));
    const rightRunPushOff = Math.max(0, -Math.sin(cycle + Math.PI - 0.48));
    const leftRunFootWorldPitch = (-0.34 * leftRunToeLift) + ((0.12 + (0.12 * dashBurstPose)) * leftRunPushOff) - (0.03 * runAmount);
    const rightRunFootWorldPitch = (-0.34 * rightRunToeLift) + ((0.12 + (0.12 * dashBurstPose)) * rightRunPushOff) - (0.03 * runAmount);
    const footLegCounter = 0.46 + (0.18 * sonicRunPose);
    const leftRunFootPitch = THREE.MathUtils.clamp(
      leftRunFootWorldPitch - ((leftThighX + leftShinX) * footLegCounter),
      -0.72,
      0.32,
    );
    const rightRunFootPitch = THREE.MathUtils.clamp(
      rightRunFootWorldPitch - ((rightThighX + rightShinX) * footLegCounter),
      -0.72,
      0.32,
    );

    chibi.leftThigh.rotation.set(
      leftThighX,
      0.02 * runAmount,
      -legOutwardSplay,
    );
    chibi.rightThigh.rotation.set(
      rightThighX,
      -0.02 * runAmount,
      legOutwardSplay,
    );
    chibi.leftShin.rotation.set(
      leftShinX,
      0,
      -0.04 - (0.04 * runAmount),
    );
    chibi.rightShin.rotation.set(
      rightShinX,
      0,
      0.04 + (0.04 * runAmount),
    );
    chibi.leftFoot.position.set(0, -0.27, 0.14);
    chibi.rightFoot.position.set(0, -0.27, 0.14);
    chibi.leftFoot.rotation.set(
      THREE.MathUtils.lerp(leftWalkFootPitch, leftRunFootPitch, sonicRunPose),
      0,
      -0.055 * runAmount,
    );
    chibi.rightFoot.rotation.set(
      THREE.MathUtils.lerp(rightWalkFootPitch, rightRunFootPitch, sonicRunPose),
      0,
      0.055 * runAmount,
    );
    chibi.rightShoulderPivot.rotation.set(0, 0, 0);
    chibi.rightForearm.position.set(0, -0.3, 0.03);
    chibi.rightHandMount.position.set(0, -0.28, 0.04);
    chibi.rightHandMount.rotation.set(0, 0, 0);
    chibi.rightHand.position.set(0, 0, 0);
    chibi.rightHand.scale.set(0.9, 0.72, 0.62);
  }

  private applyChibiJumpPose(chibi: ChibiRig | undefined, vertical: PlayerVerticalState): void {
    if (!chibi || vertical.grounded) {
      return;
    }

    const currentTime = this.currentFrameTime || performance.now();
    if (vertical.gliding) {
      this.applyChibiGliderPose(chibi, vertical, currentTime);
      return;
    }

    const flipElapsedMs = Math.max(0, currentTime - vertical.jumpStartedAt - PLAYER_JUMP_FRONT_FLIP_DELAY_MS);
    const flipWindowActive = Number.isFinite(vertical.jumpStartedAt)
      && currentTime - vertical.jumpStartedAt <= PLAYER_JUMP_FRONT_FLIP_DELAY_MS + PLAYER_JUMP_FRONT_FLIP_DURATION_MS;
    const flipTime = vertical.velocity > 0 || flipWindowActive
      ? THREE.MathUtils.clamp(flipElapsedMs / PLAYER_JUMP_FRONT_FLIP_DURATION_MS, 0, 1)
      : 1;
    const flipProgress = smoothstep(flipTime);
    const flipPoseBlend = smoothstep(flipTime / 0.16) * (1 - smoothstep((flipTime - 0.84) / 0.16));
    const flipTuck = Math.max(Math.sin(flipProgress * Math.PI), flipPoseBlend * 0.92);
    const liftBlend = THREE.MathUtils.clamp(vertical.elevation / 1.4, 0, 1);
    const risingBlend = vertical.velocity > 0
      ? THREE.MathUtils.clamp(vertical.velocity / PLAYER_JUMP_VELOCITY, 0, 1)
      : 0;
    const fallingBlend = vertical.velocity < 0
      ? THREE.MathUtils.clamp(Math.abs(vertical.velocity) / PLAYER_JUMP_VELOCITY, 0, 1)
      : 0;
    const fallPoseBlend = Math.max(fallingBlend, smoothstep((flipTime - 0.86) / 0.14));
    const fallArmSpreadBlend = smoothstep(fallPoseBlend / 0.28);
    const tuck = Math.max(liftBlend * 0.76, 0.42 + fallPoseBlend * 0.28, flipTuck * 1.22);
    const flipDirection = vertical.jumpFlipDirection ?? 1;
    const flipSpin = Math.PI * 2 * flipProgress * flipDirection;
    const pivotY = 0.82;
    const pivotZ = 0.04;
    const pivotCos = Math.cos(flipSpin);
    const pivotSin = Math.sin(flipSpin);
    const rotatedPivotY = (pivotY * pivotCos) - (pivotZ * pivotSin);
    const rotatedPivotZ = (pivotY * pivotSin) + (pivotZ * pivotCos);
    const pivotAmount = smoothstep(flipTime / 0.1);
    const leftArmTargetX = THREE.MathUtils.lerp(-1.18, 0.02, fallArmSpreadBlend);
    const rightArmTargetX = THREE.MathUtils.lerp(-1.18, 0.04, fallArmSpreadBlend);
    const leftForearmTargetX = THREE.MathUtils.lerp(1.48, 0, fallArmSpreadBlend);
    const rightForearmTargetX = THREE.MathUtils.lerp(1.48, -0.08, fallArmSpreadBlend);
    const leftArmTargetY = 0.42 * flipPoseBlend * (1 - fallArmSpreadBlend);
    const rightArmTargetY = -0.42 * flipPoseBlend * (1 - fallArmSpreadBlend);
    const thighTarget = THREE.MathUtils.lerp(-1.58, 0.1, fallPoseBlend);
    const rearThighTarget = THREE.MathUtils.lerp(-1.48, -1.02, fallPoseBlend);
    const shinTarget = THREE.MathUtils.lerp(2.34, 0.08, fallPoseBlend);
    const rearShinTarget = THREE.MathUtils.lerp(2.18, 1.48, fallPoseBlend);
    const leftArmFoldZ = THREE.MathUtils.lerp(1.02, 1.76, fallArmSpreadBlend);
    const rightArmFoldZ = THREE.MathUtils.lerp(-1.02, -1.74, fallArmSpreadBlend);
    const leftForearmFoldZ = THREE.MathUtils.lerp(0.56, 0.02, fallArmSpreadBlend);
    const rightForearmFoldZ = THREE.MathUtils.lerp(-0.56, -0.04, fallArmSpreadBlend);
    const leftKneeFoldZ = THREE.MathUtils.lerp(0.34, 0, fallPoseBlend);
    const rightKneeFoldZ = THREE.MathUtils.lerp(-0.34, 0.28, fallPoseBlend);

    chibi.root.position.y += ((pivotY - rotatedPivotY) * pivotAmount) - (0.12 * flipPoseBlend);
    chibi.root.position.z += (pivotZ - rotatedPivotZ) * pivotAmount;
    chibi.root.rotation.x += flipSpin + (((0.1 * liftBlend) + (0.18 * fallPoseBlend)) * flipDirection);
    chibi.torso.rotation.x += ((1.02 * flipPoseBlend) + (0.36 * flipTuck) - (0.18 * fallPoseBlend)) * flipDirection;
    chibi.torso.rotation.y += 0.22 * fallPoseBlend;
    chibi.torso.rotation.z += -0.16 * fallPoseBlend;
    chibi.pelvis.rotation.x += ((-0.68 * flipPoseBlend) + (0.16 * fallPoseBlend)) * flipDirection;
    chibi.pelvis.rotation.y += -0.16 * fallPoseBlend;
    chibi.head.rotation.x += ((0.5 * flipPoseBlend) + (0.14 * flipTuck) - (0.16 * fallPoseBlend)) * flipDirection;
    chibi.head.rotation.y += -0.12 * fallPoseBlend;
    const armPoseAmount = 0.36 + (risingBlend * 0.16) + (fallArmSpreadBlend * 0.24);
    chibi.leftUpperArm.rotation.x = THREE.MathUtils.lerp(chibi.leftUpperArm.rotation.x, leftArmTargetX, armPoseAmount);
    chibi.rightUpperArm.rotation.x = THREE.MathUtils.lerp(chibi.rightUpperArm.rotation.x, rightArmTargetX, armPoseAmount);
    chibi.leftUpperArm.rotation.y = THREE.MathUtils.lerp(chibi.leftUpperArm.rotation.y, leftArmTargetY, 0.42);
    chibi.rightUpperArm.rotation.y = THREE.MathUtils.lerp(chibi.rightUpperArm.rotation.y, rightArmTargetY, 0.42);
    chibi.leftUpperArm.rotation.z = THREE.MathUtils.lerp(chibi.leftUpperArm.rotation.z, leftArmFoldZ, 0.46 + (fallArmSpreadBlend * 0.24));
    chibi.rightUpperArm.rotation.z = THREE.MathUtils.lerp(chibi.rightUpperArm.rotation.z, rightArmFoldZ, 0.46 + (fallArmSpreadBlend * 0.24));
    chibi.leftForearm.rotation.x = THREE.MathUtils.lerp(chibi.leftForearm.rotation.x, leftForearmTargetX, 0.36 + (fallArmSpreadBlend * 0.2));
    chibi.rightForearm.rotation.x = THREE.MathUtils.lerp(chibi.rightForearm.rotation.x, rightForearmTargetX, 0.36 + (fallArmSpreadBlend * 0.2));
    chibi.leftForearm.rotation.z = THREE.MathUtils.lerp(chibi.leftForearm.rotation.z, leftForearmFoldZ, 0.36 + (fallArmSpreadBlend * 0.2));
    chibi.rightForearm.rotation.z = THREE.MathUtils.lerp(chibi.rightForearm.rotation.z, rightForearmFoldZ, 0.36 + (fallArmSpreadBlend * 0.2));
    chibi.leftThigh.rotation.x = THREE.MathUtils.lerp(chibi.leftThigh.rotation.x, thighTarget, tuck);
    chibi.rightThigh.rotation.x = THREE.MathUtils.lerp(chibi.rightThigh.rotation.x, rearThighTarget, tuck);
    chibi.leftThigh.rotation.z = THREE.MathUtils.lerp(chibi.leftThigh.rotation.z, leftKneeFoldZ, 0.46 * flipPoseBlend);
    chibi.rightThigh.rotation.z = THREE.MathUtils.lerp(chibi.rightThigh.rotation.z, rightKneeFoldZ, 0.46 * flipPoseBlend);
    chibi.leftShin.rotation.x = THREE.MathUtils.lerp(chibi.leftShin.rotation.x, shinTarget, tuck);
    chibi.rightShin.rotation.x = THREE.MathUtils.lerp(chibi.rightShin.rotation.x, rearShinTarget, tuck);
    chibi.leftFoot.rotation.x = THREE.MathUtils.lerp(chibi.leftFoot.rotation.x, -0.42 + (0.46 * fallPoseBlend), tuck);
    chibi.rightFoot.rotation.x = THREE.MathUtils.lerp(chibi.rightFoot.rotation.x, -0.36 + (0.1 * fallPoseBlend), tuck);
  }

  private applyChibiGliderPose(
    chibi: ChibiRig,
    vertical: PlayerVerticalState,
    currentTime: number,
  ): void {
    const glideAgeMs = Math.max(0, currentTime - vertical.gliderDeployedAt);
    const deployBlend = smoothstep(THREE.MathUtils.clamp(glideAgeMs / 180, 0, 1));
    const flutter = Math.sin(currentTime * 0.011) * deployBlend;
    const descentBlend = THREE.MathUtils.clamp(Math.abs(Math.min(0, vertical.velocity)) / Math.abs(PLAYER_GLIDER_DESCENT_VELOCITY), 0, 1);
    const bob = Math.sin(currentTime * 0.0056) * 0.018 * deployBlend;

    chibi.root.position.set(0, 0.18 + bob, 0.015);
    chibi.root.rotation.set(
      THREE.MathUtils.lerp(0, -0.08 - (0.035 * descentBlend), deployBlend),
      0,
      flutter * 0.026,
    );
    chibi.torso.rotation.set(
      THREE.MathUtils.lerp(0.02, -0.09, deployBlend),
      flutter * 0.035,
      flutter * 0.045,
    );
    chibi.pelvis.rotation.set(THREE.MathUtils.lerp(0.04, 0.24, deployBlend), -flutter * 0.02, -flutter * 0.035);
    chibi.head.rotation.set(THREE.MathUtils.lerp(0.02, 0.055, deployBlend), -flutter * 0.03, -flutter * 0.028);

    chibi.leftUpperArm.rotation.set(
      THREE.MathUtils.lerp(0.26, -1.34, deployBlend),
      THREE.MathUtils.lerp(-0.08, -0.18, deployBlend),
      THREE.MathUtils.lerp(0.24, 1.02, deployBlend),
    );
    chibi.rightUpperArm.rotation.set(
      THREE.MathUtils.lerp(0.28, -1.34, deployBlend),
      THREE.MathUtils.lerp(0.1, 0.18, deployBlend),
      THREE.MathUtils.lerp(-0.24, -1.02, deployBlend),
    );
    chibi.leftForearm.rotation.set(
      THREE.MathUtils.lerp(-0.46, -0.24, deployBlend),
      THREE.MathUtils.lerp(-0.05, -0.12, deployBlend),
      THREE.MathUtils.lerp(0.16, 0.32, deployBlend),
    );
    chibi.rightForearm.rotation.set(
      THREE.MathUtils.lerp(-0.48, -0.24, deployBlend),
      THREE.MathUtils.lerp(0.05, 0.12, deployBlend),
      THREE.MathUtils.lerp(-0.16, -0.32, deployBlend),
    );
    chibi.leftThigh.rotation.set(THREE.MathUtils.lerp(0.08, -0.58, deployBlend), 0.04, -0.08);
    chibi.rightThigh.rotation.set(THREE.MathUtils.lerp(0.08, -0.22, deployBlend), -0.04, 0.08);
    chibi.leftShin.rotation.set(THREE.MathUtils.lerp(0.16, 0.92, deployBlend), 0, -0.04);
    chibi.rightShin.rotation.set(THREE.MathUtils.lerp(0.16, 0.58, deployBlend), 0, 0.04);
    chibi.leftFoot.rotation.set(THREE.MathUtils.lerp(0, -0.18, deployBlend), 0, -0.06);
    chibi.rightFoot.rotation.set(THREE.MathUtils.lerp(0, -0.12, deployBlend), 0, 0.06);

    if (chibi.cape) {
      chibi.cape.rotation.x = THREE.MathUtils.lerp(chibi.cape.rotation.x, 0.64 + (flutter * 0.08), 0.6 * deployBlend);
      chibi.cape.position.z = THREE.MathUtils.lerp(chibi.cape.position.z, -0.48, 0.6 * deployBlend);
    }

    if (chibi.glider) {
      chibi.glider.visible = true;
      chibi.glider.position.set(0, 2.06 + (flutter * 0.018), -0.18 - (0.035 * descentBlend));
      chibi.glider.rotation.set(0.04 + (flutter * 0.018), 0, flutter * 0.035);
      chibi.glider.scale.set(
        THREE.MathUtils.lerp(0.68, 1.08, deployBlend),
        THREE.MathUtils.lerp(0.88, 1.04, deployBlend),
        1,
      );
    }
  }

  private applySableMotion(
    sable: SableRig | undefined,
    motion: ActorMotionState,
    companion: Companion,
    airborne = false,
    vertical: CompanionVerticalState | null = null,
  ): void {
    if (!sable) {
      return;
    }

    const currentTime = this.currentFrameTime || performance.now();
    const baseSpeed = Math.max(1, companion.speed || 240);
    const speedRatio = motion.moving
      ? THREE.MathUtils.clamp(motion.speedPxPerSecond / baseSpeed, 0, 1.9)
      : 0;
    const moveBlend = motion.moving ? smoothstep(speedRatio / 0.24) : 0;
    const runBlend = motion.moving ? smoothstep((speedRatio - 0.78) / 0.62) : 0;
    const sprintBlend = motion.moving
      ? smoothstep((speedRatio - SABLE_SPRINT_SPEED_RATIO_START) / SABLE_SPRINT_SPEED_RATIO_SPAN)
      : 0;
    const cycle = motion.cycle;
    const gallopCycle = cycle * (1 + (sprintBlend * 0.18));
    const frontReach = Math.max(0, Math.sin(gallopCycle + 0.5));
    const frontPlant = Math.max(0, -Math.sin(gallopCycle + 0.18));
    const rearGather = Math.max(0, Math.sin(gallopCycle - 0.2));
    const rearPush = Math.max(0, -Math.sin(gallopCycle - 0.56));
    const sprintSuspension = Math.max(0, Math.sin((gallopCycle * 2) + 0.45));
    const attackIntent = companion.state === "attack" ? 1 : 0;
    const fetchIntent = companion.state === "fetch" ? 1 : 0;
    const alertBlend = Math.max(attackIntent, fetchIntent * 0.58);
    const stride = Math.sin(cycle);
    const counterStride = Math.sin(cycle + Math.PI);
    const doubleStep = Math.sin((cycle * 2) + 0.2);
    const stepLift = Math.abs(Math.sin(cycle));
    const idleBreath = Math.sin(currentTime * 0.003 + cycle * 0.12);
    const wagSpeed = companion.state === "idle" ? 0.006 : companion.state === "attack" ? 0.021 : 0.014;
    const wagAmount = 0.18 + (0.18 * moveBlend) + (0.2 * alertBlend);
    const sprintWave = Math.sin((gallopCycle * 2) + 0.24);
    const lean = 0.025 + (0.06 * moveBlend) + (0.1 * runBlend) + (0.055 * sprintBlend) + (0.07 * alertBlend);

    sable.root.position.y = 0.13
      + (idleBreath * 0.01 * (1 - moveBlend))
      + (stepLift * 0.018 * moveBlend)
      + (Math.abs(doubleStep) * 0.018 * runBlend)
      - (0.032 * sprintBlend)
      + (sprintSuspension * 0.016 * sprintBlend);
    sable.root.rotation.set(lean + (sprintWave * 0.01 * sprintBlend), 0, (doubleStep * 0.018 * moveBlend) + (sprintWave * 0.02 * sprintBlend));
    sable.body.position.set(0, 0.62 - (0.012 * sprintBlend) + (sprintSuspension * 0.006 * sprintBlend), -0.05 - (0.024 * sprintBlend));
    sable.body.scale.set(0.96 - (0.035 * sprintBlend), 0.64 - (0.026 * sprintBlend), 1.72 + (0.16 * sprintBlend));
    sable.body.rotation.set(
      0.045 + (0.055 * runBlend) + (0.038 * sprintBlend) + (0.035 * alertBlend),
      (stride * 0.028 * moveBlend) - (sprintWave * 0.018 * sprintBlend),
      (doubleStep * 0.026 * moveBlend) + (sprintWave * 0.035 * sprintBlend),
    );
    sable.chest.position.set(0, 0.7 - (0.008 * sprintBlend), 0.48 + (0.032 * sprintBlend));
    sable.chest.scale.set(0.82 + (0.02 * sprintBlend), 0.82 - (0.026 * sprintBlend), 0.92 + (0.05 * sprintBlend));
    sable.chest.rotation.set(
      -0.02 + (0.06 * runBlend) + (0.055 * sprintBlend) + (0.04 * alertBlend),
      (-stride * 0.018 * moveBlend) + (sprintWave * 0.022 * sprintBlend),
      (-doubleStep * 0.018 * moveBlend) - (sprintWave * 0.03 * sprintBlend),
    );
    sable.head.position.set(0, 0.96 - (0.028 * sprintBlend) + (sprintSuspension * 0.009 * sprintBlend), 0.72 + (0.05 * sprintBlend));
    sable.head.rotation.set(
      -0.045 - (0.035 * runBlend) - (0.07 * sprintBlend) + (0.06 * alertBlend) + (idleBreath * 0.018 * (1 - moveBlend)),
      (-stride * 0.045 * moveBlend) + (sprintWave * 0.038 * sprintBlend),
      (-doubleStep * 0.028 * moveBlend) - (sprintWave * 0.046 * sprintBlend),
    );
    sable.snout.position.z = 0.27 + (0.035 * sprintBlend) + (alertBlend * Math.sin(currentTime * 0.018) * 0.012);
    sable.tail.position.set(0, 0.71 - (0.045 * sprintBlend), -0.76 - (0.12 * sprintBlend));
    sable.tail.rotation.set(
      -0.46 - (0.1 * alertBlend) + (0.07 * runBlend) - (0.24 * sprintBlend),
      (Math.sin((currentTime * wagSpeed) + cycle * 0.22) * wagAmount * (1 - (sprintBlend * 0.42))) + (sprintWave * 0.08 * sprintBlend),
      (Math.cos((currentTime * wagSpeed) + cycle * 0.18) * 0.08 * (0.4 + moveBlend)) - (sprintWave * 0.12 * sprintBlend),
    );

    const strideAmount = ((0.34 * moveBlend) + (0.42 * runBlend)) * (1 + alertBlend * 0.18) * (1 - (0.18 * sprintBlend));
    const legLift = 0.025 * moveBlend + (0.025 * runBlend) + (0.034 * sprintBlend);
    const frontLeftLift = Math.max(0, stride) * legLift;
    const frontRightLift = Math.max(0, counterStride) * legLift;
    const rearLeftLift = Math.max(0, counterStride) * legLift;
    const rearRightLift = Math.max(0, stride) * legLift;
    const sprintFrontLift = (frontReach * 0.07) + (sprintSuspension * 0.03);
    const sprintRearGroundPress = (0.036 + (rearPush * 0.064) + (rearGather * 0.018)) * (1 - (sprintSuspension * 0.22));
    const sprintRearLift = (rearGather * 0.018) + (sprintSuspension * 0.006) - sprintRearGroundPress;
    const sprintFrontLegX = (-0.82 * frontReach) + (0.74 * frontPlant) - (0.18 * sprintSuspension);
    const sprintRearLegX = (-0.28 * rearGather) + (0.48 * rearPush) + (0.04 * sprintSuspension);

    sable.frontLeftLeg.position.set(
      -0.2 - (0.015 * sprintBlend),
      0.52 + THREE.MathUtils.lerp(frontLeftLift, sprintFrontLift, sprintBlend),
      0.43 + (((0.16 * frontReach) - (0.08 * frontPlant)) * sprintBlend),
    );
    sable.frontRightLeg.position.set(
      0.2 + (0.015 * sprintBlend),
      0.52 + THREE.MathUtils.lerp(frontRightLift, sprintFrontLift * 0.94, sprintBlend),
      0.43 + (((0.15 * frontReach) - (0.075 * frontPlant)) * sprintBlend),
    );
    sable.rearLeftLeg.position.set(
      -0.21 - (0.018 * sprintBlend),
      0.52 + THREE.MathUtils.lerp(rearLeftLift, sprintRearLift * 0.94, sprintBlend),
      -0.5 + (((0.13 * rearGather) - (0.12 * rearPush)) * sprintBlend),
    );
    sable.rearRightLeg.position.set(
      0.21 + (0.018 * sprintBlend),
      0.52 + THREE.MathUtils.lerp(rearRightLift, sprintRearLift, sprintBlend),
      -0.5 + (((0.14 * rearGather) - (0.13 * rearPush)) * sprintBlend),
    );
    sable.frontLeftLeg.rotation.set(
      THREE.MathUtils.lerp(0.08 + (stride * strideAmount), sprintFrontLegX - 0.05, sprintBlend),
      0.018 * moveBlend,
      -0.055 - (0.035 * sprintBlend),
    );
    sable.frontRightLeg.rotation.set(
      THREE.MathUtils.lerp(0.08 + (counterStride * strideAmount), sprintFrontLegX + 0.03, sprintBlend),
      -0.018 * moveBlend,
      0.055 + (0.035 * sprintBlend),
    );
    sable.rearLeftLeg.rotation.set(
      THREE.MathUtils.lerp(0.02 + (counterStride * strideAmount * 0.92), sprintRearLegX + 0.04, sprintBlend),
      -0.012 * moveBlend,
      -0.045 - (0.026 * sprintBlend),
    );
    sable.rearRightLeg.rotation.set(
      THREE.MathUtils.lerp(0.02 + (stride * strideAmount * 0.92), sprintRearLegX - 0.04, sprintBlend),
      0.012 * moveBlend,
      0.045 + (0.026 * sprintBlend),
    );

    if (airborne && vertical) {
      const liftBlend = THREE.MathUtils.clamp(vertical.elevation / 0.78, 0, 1);
      const risingBlend = vertical.velocity > 0
        ? THREE.MathUtils.clamp(vertical.velocity / SABLE_JUMP_VELOCITY, 0, 1)
        : 0;
      const fallingBlend = vertical.velocity < 0
        ? THREE.MathUtils.clamp(Math.abs(vertical.velocity) / SABLE_JUMP_VELOCITY, 0, 1)
        : 0;
      const jumpAgeMs = Math.max(0, currentTime - vertical.jumpStartedAt);
      const airWiggle = Math.sin((jumpAgeMs * 0.018) + cycle) * 0.035;
      const tuckBlend = Math.max(0.34, liftBlend, fallingBlend * 0.72);

      sable.root.position.y += 0.05 + (0.055 * liftBlend);
      sable.root.rotation.x += THREE.MathUtils.lerp(-0.18, 0.16, fallingBlend) - (0.08 * risingBlend);
      sable.root.rotation.z += airWiggle;
      sable.body.rotation.x += THREE.MathUtils.lerp(-0.16, 0.18, fallingBlend);
      sable.chest.rotation.x += THREE.MathUtils.lerp(-0.12, 0.12, fallingBlend);
      sable.head.rotation.x += THREE.MathUtils.lerp(0.08, -0.05, fallingBlend);
      sable.tail.rotation.x += 0.34 + (0.2 * fallingBlend);
      sable.tail.rotation.y += airWiggle * 1.8;

      sable.frontLeftLeg.position.y += 0.08 * tuckBlend;
      sable.frontRightLeg.position.y += 0.08 * tuckBlend;
      sable.rearLeftLeg.position.y += 0.06 * tuckBlend;
      sable.rearRightLeg.position.y += 0.06 * tuckBlend;
      sable.frontLeftLeg.rotation.x = THREE.MathUtils.lerp(sable.frontLeftLeg.rotation.x, -0.82, 0.64 * tuckBlend);
      sable.frontRightLeg.rotation.x = THREE.MathUtils.lerp(sable.frontRightLeg.rotation.x, -0.74, 0.64 * tuckBlend);
      sable.rearLeftLeg.rotation.x = THREE.MathUtils.lerp(sable.rearLeftLeg.rotation.x, 0.82, 0.58 * tuckBlend);
      sable.rearRightLeg.rotation.x = THREE.MathUtils.lerp(sable.rearRightLeg.rotation.x, 0.72, 0.58 * tuckBlend);
    }
  }

  private maybeEmitPlayerFootstep(actor: Actor, playerId: PlayerId): void {
    const motion = actor.motion;
    if (!motion?.moving) {
      if (motion) {
        motion.footstepSoundStep = undefined;
      }
      return;
    }

    const speedRatio = motion.speedPxPerSecond / PLAYER_SPEED_PX_PER_SECOND;
    if (speedRatio < 0.18) {
      motion.footstepSoundStep = undefined;
      return;
    }

    const stepIndex = getHumanoidFootPlantStep(motion.cycle);
    if (motion.footstepSoundStep === undefined) {
      motion.footstepSoundStep = stepIndex;
      return;
    }
    if (motion.footstepSoundStep === stepIndex) {
      return;
    }

    motion.footstepSoundStep = stepIndex;
    this.options.onPlayerFootstep?.(playerId, stepIndex % 2 === 0 ? "left" : "right", speedRatio);
  }

  private maybeSpawnRunDust(actor: Actor, fieldX: number, fieldY: number): void {
    const motion = actor.motion;
    if (!motion?.moving) {
      if (motion) {
        motion.footDustStep = undefined;
      }
      return;
    }

    const speedRatio = motion.speedPxPerSecond / PLAYER_SPEED_PX_PER_SECOND;
    if (speedRatio < RUN_DUST_MIN_SPEED_RATIO) {
      motion.footDustStep = undefined;
      return;
    }

    const stepIndex = getHumanoidFootPlantStep(motion.cycle);
    if (motion.footDustStep === undefined) {
      motion.footDustStep = stepIndex;
      return;
    }
    if (motion.footDustStep === stepIndex) {
      return;
    }

    motion.footDustStep = stepIndex;
    const forward = {
      x: Math.sin(motion.visualYaw),
      y: Math.cos(motion.visualYaw),
    };
    const side = stepIndex % 2 === 0 ? 1 : -1;
    const right = { x: forward.y, y: -forward.x };
    this.spawnRunDustPuff(
      {
        x: fieldX - forward.x * RUN_DUST_TRAIL_OFFSET_PX + right.x * RUN_DUST_STEP_OFFSET_PX * side,
        y: fieldY - forward.y * RUN_DUST_TRAIL_OFFSET_PX + right.y * RUN_DUST_STEP_OFFSET_PX * side,
      },
      forward,
      side,
      speedRatio,
    );
  }

  private spawnRunDustPuff(
    point: { x: number; y: number },
    forward: { x: number; y: number },
    side: 1 | -1,
    speedRatio: number,
  ): void {
    const ground = this.getGroundElevationAtPoint(point);
    const trailingPoint = {
      x: point.x - forward.x * 26 + forward.y * side * 4,
      y: point.y - forward.y * 26 - forward.x * side * 4,
    };
    const world = fieldToHavenWorld(this.options.map, point, ground + 0.08);
    const trailingWorld = fieldToHavenWorld(this.options.map, trailingPoint, this.getGroundElevationAtPoint(trailingPoint) + 0.08);
    const velocity = new THREE.Vector3(
      trailingWorld.x - world.x,
      0,
      trailingWorld.z - world.z,
    );
    if (velocity.lengthSq() > 0.0001) {
      velocity.normalize().multiplyScalar(0.38 + THREE.MathUtils.clamp(speedRatio - 1, 0, 0.85) * 0.22);
    }
    velocity.y = 0.26 + THREE.MathUtils.clamp(speedRatio - 1, 0, 0.85) * 0.14;

    const group = new THREE.Group();
    group.name = "run-dust-puff";
    group.position.set(world.x, world.y, world.z);
    const puffCount = speedRatio > 1.45 ? 3 : 2;
    for (let index = 0; index < puffCount; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: index === 0 ? 0xd3b88b : 0x9f8a68,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const puff = new THREE.Mesh(new THREE.CircleGeometry(0.08 + index * 0.025, 8), material);
      puff.name = "run-dust-particle";
      puff.position.set(
        (Math.random() - 0.5) * 0.16,
        index * 0.018,
        (Math.random() - 0.5) * 0.14,
      );
      puff.rotation.set(
        -Math.PI / 2 + (Math.random() - 0.5) * 0.36,
        0,
        Math.random() * Math.PI * 2,
      );
      puff.scale.set(1 + Math.random() * 0.45, 0.58 + Math.random() * 0.32, 1);
      group.add(puff);
    }

    group.renderOrder = 21;
    this.dynamicGroup.add(group);
    this.visualEffects.push({
      object: group,
      startedAt: this.currentFrameTime || performance.now(),
      durationMs: 360,
      velocity,
      spin: 1.4 * side,
      baseScale: group.scale.clone(),
      opacity: 0.38,
      scaleGrowth: 1.75,
    });
  }

  private spawnGrindRailSparkBurst(
    point: { x: number; y: number },
    railHeight: number,
    direction: { x: number; y: number },
  ): void {
    const world = fieldToHavenWorld(this.options.map, point, railHeight + 0.06);
    const group = new THREE.Group();
    group.name = "grind-rail-spark-burst";
    group.position.set(world.x, world.y, world.z);
    group.rotation.y = Math.atan2(-direction.y, direction.x);
    const forward = new THREE.Vector3(direction.x, 0, direction.y).normalize();
    const lateral = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
    for (let index = 0; index < 4; index += 1) {
      const spark = new THREE.Mesh(
        new THREE.PlaneGeometry(0.22 + (index * 0.05), 0.05 + (index * 0.01)),
        new THREE.MeshBasicMaterial({
          color: index < 2 ? 0xffefaa : 0xffa24a,
          transparent: true,
          opacity: 0.8 - (index * 0.1),
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      spark.position.set(
        0.08 + (index * 0.07),
        0.04 + (index * 0.03),
        (index - 1.5) * 0.06,
      );
      spark.rotation.set(
        (Math.random() - 0.5) * 0.26,
        0,
        (Math.random() - 0.5) * 0.52,
      );
      group.add(spark);
    }

    group.renderOrder = 23;
    this.dynamicGroup.add(group);
    const velocity = forward.multiplyScalar(1.04).addScaledVector(lateral, (Math.random() - 0.5) * 0.28);
    velocity.y = 0.84;
    this.visualEffects.push({
      object: group,
      startedAt: this.currentFrameTime || performance.now(),
      durationMs: 210,
      velocity,
      spin: 2.6,
      baseScale: group.scale.clone(),
      opacity: 0.86,
      scaleGrowth: 0.72,
    });
  }

  private spawnDashBurstEffect(point: { x: number; y: number }, yaw: number): void {
    const world = fieldToHavenWorld(this.options.map, point, this.getGroundElevationAtPoint(point) + 0.1);
    const group = new THREE.Group();
    group.name = "dash-burst-ring";
    group.position.set(world.x, world.y, world.z);
    group.rotation.y = yaw;

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xf2d08b,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.018, 8, 42), ringMaterial);
    ring.name = "dash-burst-ground-ring";
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(1.35, 0.58, 1);
    group.add(ring);

    [-0.28, 0, 0.28].forEach((offset, index) => {
      const streak = new THREE.Mesh(
        new THREE.PlaneGeometry(0.48 - index * 0.06, 0.075),
        new THREE.MeshBasicMaterial({
          color: 0x67cab5,
          transparent: true,
          opacity: 0.36,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      streak.name = "dash-burst-speed-mark";
      streak.position.set(offset, 0.012 + index * 0.006, -0.36 - index * 0.12);
      streak.rotation.x = -Math.PI / 2;
      streak.rotation.z = offset * 0.7;
      streak.scale.set(1.15 - index * 0.1, 1, 1);
      group.add(streak);
    });

    group.renderOrder = 22;
    this.dynamicGroup.add(group);
    this.visualEffects.push({
      object: group,
      startedAt: this.currentFrameTime || performance.now(),
      durationMs: 250,
      velocity: new THREE.Vector3(0, 0.025, 0),
      baseScale: group.scale.clone(),
      opacity: 0.52,
      scaleGrowth: 1.2,
    });
  }

  private beginImpactFeedback(point: { x: number; y: number }, intensity: number): void {
    const hitstopMs = IMPACT_HITSTOP_MS * THREE.MathUtils.clamp(intensity, 0.35, 1.35);
    this.hitstopRemainingMs = Math.max(this.hitstopRemainingMs, hitstopMs);

    (["P1", "P2"] as PlayerId[]).forEach((playerId) => {
      const bladeSwing = this.getPlayerBladeSwing(playerId);
      if (bladeSwing) {
        bladeSwing.startedAt += hitstopMs;
      }
      const grappleMove = this.getPlayerGrappleMove(playerId);
      if (grappleMove) {
        grappleMove.startedAt += hitstopMs;
      }
    });

    const avatar = this.options.getPlayerAvatar("P1");
    if (!avatar) {
      this.cameraImpulse.y += 0.08 * intensity;
      return;
    }

    const avatarPoint = { x: avatar.x, y: avatar.y };
    const impactWorld = fieldToHavenWorld(this.options.map, point, this.getGroundElevationAtPoint(point) + 1.1);
    const playerWorld = fieldToHavenWorld(this.options.map, avatarPoint, this.getGroundElevationAtPoint(avatarPoint) + 1.1);
    const direction = new THREE.Vector3(
      impactWorld.x - playerWorld.x,
      0,
      impactWorld.z - playerWorld.z,
    );
    if (direction.lengthSq() <= 0.0001) {
      direction.set(this.clockRight.x, 0, this.clockRight.z);
    }
    direction.normalize();

    this.cameraImpulse.addScaledVector(direction, -0.18 * intensity);
    this.cameraImpulse.y += 0.08 * intensity;
    this.cameraImpulse.clampLength(0, 0.34);
  }

  public showEnemyPing(
    enemyId: string,
    title: string,
    detail: string | null,
    tone: "info" | "warning" | "success" | "danger" = "info",
  ): boolean {
    const actor = this.enemyActors.get(enemyId);
    if (!actor?.group.visible) {
      return false;
    }

    const channel = `enemy-ping:${enemyId}`;
    for (let index = this.visualEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.visualEffects[index];
      if (effect.channel !== channel) {
        continue;
      }
      this.dynamicGroup.remove(effect.object);
      disposeObject(effect.object);
      this.visualEffects.splice(index, 1);
    }

    const sprite = createCombatPingSprite(title, detail, tone);
    sprite.position.copy(actor.group.position);
    sprite.position.y += ENEMY_PING_HEIGHT;
    this.dynamicGroup.add(sprite);
    this.visualEffects.push({
      object: sprite,
      startedAt: this.currentFrameTime || performance.now(),
      durationMs: tone === "danger" ? 1320 : 1180,
      velocity: new THREE.Vector3(0, 0.72, 0),
      baseScale: sprite.scale.clone(),
      channel,
    });
    return true;
  }

  private spawnHitSpark(
    point: { x: number; y: number },
    color: number,
    direction: { x: number; y: number } | null = null,
  ): void {
    const directionLength = direction ? Math.hypot(direction.x, direction.y) : 0;
    const directed = direction && directionLength > 0.001
      ? { x: direction.x / directionLength, y: direction.y / directionLength }
      : null;
    const world = fieldToHavenWorld(this.options.map, point, this.getGroundElevationAtPoint(point) + (directed ? 0.92 : 0.62));
    const group = new THREE.Group();
    group.name = directed ? "blade-directed-hit-spark" : "hit-spark";
    group.position.set(world.x, world.y, world.z);
    if (directed) {
      group.rotation.y = Math.atan2(-directed.y, directed.x);
    }

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 24), material);
    ring.rotation.x = Math.PI / 2;
    ring.renderOrder = 22;
    group.add(ring);

    if (directed) {
      for (let index = 0; index < 6; index += 1) {
        const streak = new THREE.Mesh(
          new THREE.PlaneGeometry(0.32 + index * 0.055, 0.04 + index * 0.005),
          new THREE.MeshBasicMaterial({
            color: index < 2 ? 0xfff0b8 : color,
            transparent: true,
            opacity: 0.8 - index * 0.06,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        streak.name = "blade-impact-spark-streak";
        streak.position.set(
          0.12 + index * 0.08,
          -0.1 + index * 0.05,
          (Math.random() - 0.5) * 0.28,
        );
        streak.rotation.z = (Math.random() - 0.5) * 0.55;
        streak.scale.y = 0.8 + Math.random() * 0.45;
        group.add(streak);
      }
    }

    this.dynamicGroup.add(group);
    this.visualEffects.push({
      object: group,
      startedAt: this.currentFrameTime || performance.now(),
      durationMs: 260,
      velocity: directed
        ? new THREE.Vector3(directed.x * 1.32, 1.08, directed.y * 1.32)
        : new THREE.Vector3(0, 1.15, 0),
      spin: directed ? 2.8 : 8.5,
      baseScale: group.scale.clone(),
      opacity: directed ? 0.86 : 0.82,
      scaleGrowth: directed ? 1.05 : 1.35,
    });
  }

  private getBladeImpactSparkDirection(point: { x: number; y: number }): { x: number; y: number } | null {
    if (!this.bladeSwing) {
      return null;
    }

    const avatar = this.options.getPlayerAvatar("P1");
    if (!avatar) {
      return null;
    }

    const strikeLine = this.getBladeStrikeLine(avatar, this.bladeSwing);
    const segmentX = strikeLine.tip.x - strikeLine.hilt.x;
    const segmentY = strikeLine.tip.y - strikeLine.hilt.y;
    const segmentLengthSquared = (segmentX * segmentX) + (segmentY * segmentY);
    if (segmentLengthSquared <= 0.001) {
      return null;
    }

    const t = THREE.MathUtils.clamp(
      (((point.x - strikeLine.hilt.x) * segmentX) + ((point.y - strikeLine.hilt.y) * segmentY)) / segmentLengthSquared,
      0,
      1,
    );
    const closestX = strikeLine.hilt.x + segmentX * t;
    const closestY = strikeLine.hilt.y + segmentY * t;
    let awayX = point.x - closestX;
    let awayY = point.y - closestY;
    let awayLength = Math.hypot(awayX, awayY);
    if (awayLength <= 0.001) {
      awayX = -strikeLine.bladeDirection.y * this.bladeSwing.side;
      awayY = strikeLine.bladeDirection.x * this.bladeSwing.side;
      awayLength = Math.hypot(awayX, awayY);
    }

    return awayLength > 0.001
      ? { x: awayX / awayLength, y: awayY / awayLength }
      : null;
  }

  private getBladeSlashNormal(strikeLine: BladeSwingPose, side: 1 | -1): { x: number; y: number } {
    return {
      x: -strikeLine.bladeDirection.y * side,
      y: strikeLine.bladeDirection.x * side,
    };
  }

  private spawnBladeDrawSmear(
    avatar: FieldAvatarView,
    direction: { x: number; y: number },
    swing: BladeSwingState,
  ): void {
    const directionLength = Math.hypot(direction.x, direction.y);
    if (directionLength <= 0.001) {
      return;
    }

    const side = swing.side;
    const verticalFinisher = this.isVerticalBladeFinisher(swing);
    const forward = { x: direction.x / directionLength, y: direction.y / directionLength };
    const right = { x: forward.y, y: -forward.x };
    const handedSide = side * PLAYER_RIGHT_HAND_LOCAL_X;
    const start = verticalFinisher
      ? {
        x: avatar.x - forward.x * 6 + right.x * 28 * PLAYER_RIGHT_HAND_LOCAL_X,
        y: avatar.y - forward.y * 6 + right.y * 28 * PLAYER_RIGHT_HAND_LOCAL_X,
      }
      : {
        x: avatar.x - forward.x * 18 + right.x * 46 * handedSide,
        y: avatar.y - forward.y * 18 + right.y * 46 * handedSide,
      };
    const end = verticalFinisher
      ? {
        x: avatar.x + forward.x * 26 + right.x * 6 * PLAYER_RIGHT_HAND_LOCAL_X,
        y: avatar.y + forward.y * 26 + right.y * 6 * PLAYER_RIGHT_HAND_LOCAL_X,
      }
      : {
        x: avatar.x + forward.x * 32 + right.x * 18 * handedSide,
        y: avatar.y + forward.y * 32 + right.y * 18 * handedSide,
      };
    const ground = this.getGroundElevationAtPoint(avatar);
    const startWorld = fieldToHavenWorld(this.options.map, start, ground + 1.02);
    const endWorld = fieldToHavenWorld(this.options.map, end, ground + 1.17);
    const worldDx = endWorld.x - startWorld.x;
    const worldDy = endWorld.y - startWorld.y;
    const worldDz = endWorld.z - startWorld.z;
    const length = Math.max(0.24, Math.hypot(worldDx, worldDz));

    const group = new THREE.Group();
    group.name = "blade-draw-smear";
    group.position.set(
      (startWorld.x + endWorld.x) / 2,
      (startWorld.y + endWorld.y) / 2,
      (startWorld.z + endWorld.z) / 2,
    );
    group.rotation.y = Math.atan2(-worldDz, worldDx);
    group.rotation.z = Math.atan2(worldDy, length) + (verticalFinisher ? 0.04 : 0.22 * side);

    const smearMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe6a6,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const smear = new THREE.Mesh(
      new THREE.PlaneGeometry(length * (verticalFinisher ? 0.94 : 1.12), verticalFinisher ? 0.28 : 0.2),
      smearMaterial,
    );
    smear.name = "blade-draw-main-smear";
    group.add(smear);

    const glintMaterial = new THREE.MeshBasicMaterial({
      color: 0x67cab5,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const glint = new THREE.Mesh(
      new THREE.PlaneGeometry(length * (verticalFinisher ? 0.42 : 0.58), verticalFinisher ? 0.075 : 0.055),
      glintMaterial,
    );
    glint.name = "blade-draw-edge-glint";
    glint.position.set(length * (verticalFinisher ? 0.02 : 0.08), verticalFinisher ? 0.08 : 0.06, 0.006);
    group.add(glint);

    group.renderOrder = 25;
    this.dynamicGroup.add(group);
    this.visualEffects.push({
      object: group,
      startedAt: this.currentFrameTime || performance.now(),
      durationMs: BLADE_DRAW_SMEAR_MS,
      velocity: new THREE.Vector3(0, verticalFinisher ? 0.18 : 0.12, 0),
      baseScale: group.scale.clone(),
      opacity: 0.5,
      scaleGrowth: 0.2,
    });
  }

  private spawnBladeSlashEffect(strikeLine: BladeSwingPose, swing: BladeSwingState, didHit: boolean): void {
    const side = swing.side;
    const verticalFinisher = this.isVerticalBladeFinisher(swing);
    const midpoint = {
      x: (strikeLine.hilt.x + strikeLine.tip.x) / 2,
      y: (strikeLine.hilt.y + strikeLine.tip.y) / 2,
    };
    const ground = this.getGroundElevationAtPoint(midpoint);
    const hiltWorld = fieldToHavenWorld(this.options.map, strikeLine.hilt, ground + 1.08);
    const tipWorld = fieldToHavenWorld(this.options.map, strikeLine.tip, ground + 1.08);
    const midpointWorld = new THREE.Vector3(
      (hiltWorld.x + tipWorld.x) / 2,
      (hiltWorld.y + tipWorld.y) / 2,
      (hiltWorld.z + tipWorld.z) / 2,
    );
    const worldDx = tipWorld.x - hiltWorld.x;
    const worldDz = tipWorld.z - hiltWorld.z;
    const length = Math.max(0.4, Math.hypot(worldDx, worldDz));

    const group = new THREE.Group();
    group.name = didHit ? "blade-slash-impact-flash" : "blade-slash-air-flash";
    group.position.copy(midpointWorld);
    if (verticalFinisher) {
      group.position.y += didHit ? 0.12 : 0.08;
    }
    group.rotation.y = Math.atan2(-worldDz, worldDx);
    group.rotation.z = verticalFinisher ? 0.02 : 0.16 * side;

    const mainMaterial = new THREE.MeshBasicMaterial({
      color: didHit ? 0xfff0b8 : 0xf6d28a,
      transparent: true,
      opacity: didHit ? 0.82 : 0.58,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mainSlash = new THREE.Mesh(
      new THREE.PlaneGeometry(
        length * (verticalFinisher ? 0.88 : 1.05),
        verticalFinisher ? (didHit ? 0.92 : 0.72) : (didHit ? 0.62 : 0.46),
      ),
      mainMaterial,
    );
    mainSlash.name = "blade-slash-main-ribbon";
    group.add(mainSlash);

    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: 0x67cab5,
      transparent: true,
      opacity: didHit ? 0.58 : 0.36,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const edgeSlash = new THREE.Mesh(
      new THREE.PlaneGeometry(length * (verticalFinisher ? 0.44 : 0.76), verticalFinisher ? 0.18 : 0.12),
      edgeMaterial,
    );
    edgeSlash.name = "blade-slash-edge-ribbon";
    edgeSlash.position.y = verticalFinisher
      ? (didHit ? 0.22 : 0.16)
      : (didHit ? 0.15 : 0.11);
    edgeSlash.position.x = verticalFinisher ? 0 : -0.08 * side;
    group.add(edgeSlash);

    const groundMaterial = new THREE.MeshBasicMaterial({
      color: didHit ? 0xffd67a : 0x67cab5,
      transparent: true,
      opacity: didHit ? 0.32 : 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const groundSlash = new THREE.Mesh(
      new THREE.PlaneGeometry(
        length * (verticalFinisher ? 0.72 : 1.12),
        verticalFinisher ? (didHit ? 0.18 : 0.12) : (didHit ? 0.28 : 0.2),
      ),
      groundMaterial,
    );
    groundSlash.name = "blade-slash-ground-streak";
    groundSlash.rotation.x = -Math.PI / 2;
    groundSlash.position.y = -0.96;
    groundSlash.position.x = verticalFinisher ? 0 : -0.06 * side;
    group.add(groundSlash);

    if (didHit) {
      const light = new THREE.PointLight(0xffd98c, 1.6, 3.2, 1.5);
      light.position.y = 0.05;
      group.add(light);
    }

    group.renderOrder = 24;
    this.dynamicGroup.add(group);
    this.visualEffects.push({
      object: group,
      startedAt: this.currentFrameTime || performance.now(),
      durationMs: didHit ? 210 : 165,
      velocity: new THREE.Vector3(0, verticalFinisher ? (didHit ? 0.4 : 0.28) : (didHit ? 0.32 : 0.22), 0),
      spin: verticalFinisher ? 0.42 * side : 1.8 * side,
      baseScale: group.scale.clone(),
      opacity: didHit ? 0.86 : 0.62,
      scaleGrowth: verticalFinisher ? (didHit ? 0.56 : 0.34) : (didHit ? 0.48 : 0.3),
    });
  }

  private spawnFlareBeacon(point: { x: number; y: number }): void {
    const world = fieldToHavenWorld(this.options.map, point, this.getGroundElevationAtPoint(point) + 0.18);
    const group = new THREE.Group();
    group.name = "apron-flare-beacon";
    group.position.set(world.x, world.y, world.z);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x8af0ff,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.028, 8, 32), ringMaterial);
    ring.rotation.x = Math.PI / 2;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 16, 10),
      new THREE.MeshBasicMaterial({
        color: 0xd8fbff,
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
      }),
    );
    core.position.y = 0.34;
    const light = new THREE.PointLight(0x8af0ff, 2.9, 10.8, 1.45);
    light.position.y = 0.62;
    group.add(ring, core, light);
    this.dynamicGroup.add(group);

    this.visualEffects.push({
      object: group,
      startedAt: this.currentFrameTime || performance.now(),
      durationMs: 8500,
      velocity: new THREE.Vector3(0, 0.015, 0),
      spin: 0.45,
      baseScale: group.scale.clone(),
      opacity: 0.72,
      scaleGrowth: 0.38,
    });
  }

  private updateVisualEffects(deltaMs: number, currentTime: number): void {
    for (let index = this.visualEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.visualEffects[index];
      const elapsed = currentTime - effect.startedAt;
      const t = THREE.MathUtils.clamp(elapsed / effect.durationMs, 0, 1);
      effect.object.position.addScaledVector(effect.velocity, deltaMs / 1000);
      if (effect.baseScale) {
        effect.object.scale.copy(effect.baseScale).multiplyScalar(1 + t * (effect.scaleGrowth ?? 0.16));
      } else {
        effect.object.scale.setScalar(1 + t * (effect.scaleGrowth ?? 1.35));
      }
      if (effect.spin) {
        effect.object.rotation.z += effect.spin * (deltaMs / 1000);
      }
      effect.object.traverse((node) => {
        if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshBasicMaterial) {
          node.material.opacity = Math.max(0, (effect.opacity ?? 0.82) * (1 - t));
        }
        if (node instanceof THREE.Sprite && node.material instanceof THREE.SpriteMaterial) {
          node.material.opacity = Math.max(0, (effect.opacity ?? 0.96) * (1 - t));
        }
      });
      if (t >= 1) {
        this.dynamicGroup.remove(effect.object);
        disposeObject(effect.object);
        this.visualEffects.splice(index, 1);
      }
    }
  }

  private updateGrappleAnchors(currentTime: number): void {
    const visible = this.getPlayerActiveMode("P1") === "grapple" || this.getPlayerActiveMode("P2") === "grapple";
    for (const anchor of this.grappleAnchors.values()) {
      anchor.group.visible = visible;
      if (!visible) {
        continue;
      }

      const pulse = (Math.sin(currentTime * 0.004 + anchor.phase) + 1) * 0.5;
      const scale = 0.92 + pulse * 0.18;
      anchor.group.scale.setScalar(scale);
      anchor.group.rotation.y += 0.012 + pulse * 0.006;
      anchor.group.rotation.z = Math.sin(currentTime * 0.0025 + anchor.phase) * 0.08;
      anchor.group.traverse((node) => {
        if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshBasicMaterial) {
          node.material.opacity = 0.32 + pulse * 0.36;
        }
      });
    }
  }

  private updateCamera(dt: number): void {
    const mouseSensitivity = 0.003;
    const yawDelta = -this.mouseDx * mouseSensitivity;
    const pitchDelta = -this.mouseDy * mouseSensitivity;
    this.mouseDx = 0;
    this.mouseDy = 0;

    if (this.getEffectiveCameraMode() === "split") {
      this.camera.fov = 62;
      this.camera.updateProjectionMatrix();
      this.updateSplitCamera("P1", this.splitCameras.P1, dt, yawDelta, pitchDelta, true);
      this.updateSplitCamera("P2", this.splitCameras.P2, dt, 0, 0, false);
      return;
    }

    this.updateSharedCamera(dt, yawDelta, pitchDelta);
  }

  private updateSharedCamera(dt: number, yawDelta: number, pitchDelta: number): void {
    if (Math.abs(yawDelta) > 0.000001) {
      this.cameraYawPan = null;
    }
    this.pitch = THREE.MathUtils.clamp(this.pitch + pitchDelta, CAMERA_MIN_PITCH, CAMERA_MAX_PITCH);

    const activePlayers = (["P1", "P2"] as PlayerId[])
      .filter((playerId) => this.options.isPlayerActive(playerId))
      .map((playerId) => ({
        playerId,
        avatar: this.options.getPlayerAvatar(playerId),
      }))
      .filter((entry): entry is { playerId: PlayerId; avatar: FieldAvatarView } => Boolean(entry.avatar));
    const primaryEntry = activePlayers.find((entry) => entry.playerId === "P1") ?? activePlayers[0] ?? null;
    const sharedControlPlayerId = primaryEntry?.playerId ?? "P1";
    const avatar = primaryEntry?.avatar ?? null;
    const midpoint = activePlayers.length > 0
      ? activePlayers.reduce((sum, entry) => ({
        x: sum.x + entry.avatar.x,
        y: sum.y + entry.avatar.y,
      }), { x: 0, y: 0 })
      : { x: 0, y: 0 };
    const playerPoint = activePlayers.length > 0
      ? { x: midpoint.x / activePlayers.length, y: midpoint.y / activePlayers.length }
      : null;
    const playerWorld = playerPoint
      ? fieldToHavenWorld(this.options.map, playerPoint, activePlayers.reduce((sum, entry) =>
        sum + this.getPlayerVisualWorldElevation(entry.playerId, { x: entry.avatar.x, y: entry.avatar.y }), 0,
      ) / activePlayers.length + 1.15)
      : { x: 0, y: 1.15, z: 0 };
    if (!avatar || this.snapCameraNextFrame || !Number.isFinite(this.cameraFollowWorldY ?? Number.NaN)) {
      this.cameraFollowWorldY = playerWorld.y;
    } else {
      const heightSmoothing = dt > 0 ? 1 - Math.pow(CAMERA_FOLLOW_ELEVATION_LERP_BASE, dt) : 1;
      this.cameraFollowWorldY = THREE.MathUtils.lerp(this.cameraFollowWorldY ?? playerWorld.y, playerWorld.y, heightSmoothing);
    }
    const cameraPlayerWorld = new THREE.Vector3(playerWorld.x, this.cameraFollowWorldY ?? playerWorld.y, playerWorld.z);
    const lockedTarget = this.getLockedTargetCandidate(sharedControlPlayerId);
    const railRide = avatar ? this.getPlayerRailRide(sharedControlPlayerId) : null;
    const launcherAimMode = Boolean(avatar && this.getPlayerActiveMode(sharedControlPlayerId) === "launcher" && !railRide);
    const cameraProfile = this.mapProfile.camera;
    const baseCameraDistance = THREE.MathUtils.clamp(
      this.cameraDistance,
      cameraProfile.minDistance,
      cameraProfile.maxDistance,
    );
    const separationPx = activePlayers.length >= 2
      ? Math.hypot(
        activePlayers[0].avatar.x - activePlayers[1].avatar.x,
        activePlayers[0].avatar.y - activePlayers[1].avatar.y,
      )
      : 0;
    const separationDistanceBoost = THREE.MathUtils.clamp(separationPx * 0.0125, 0, 8.4);
    const separationFovBoost = THREE.MathUtils.clamp(separationPx / 18, 0, 14);

    let cameraYaw = this.yaw + yawDelta;
    let focus = cameraPlayerWorld.clone();
    let cameraAnchor = cameraPlayerWorld.clone();
    let distance = THREE.MathUtils.clamp(baseCameraDistance + separationDistanceBoost, cameraProfile.minDistance, cameraProfile.maxDistance);
    let forwardPanActive = false;
    let lockedTargetWorld: THREE.Vector3 | null = null;

    if (avatar && lockedTarget) {
      this.cameraYawPan = null;
      this.setPlayerTargetOrbitYawOffset(
        sharedControlPlayerId,
        this.getPlayerTargetOrbitYawOffset(sharedControlPlayerId) + yawDelta,
      );
      const targetPoint = { x: lockedTarget.x, y: lockedTarget.y };
      const targetWorld = fieldToHavenWorld(this.options.map, targetPoint, this.getGroundElevationAtPoint(targetPoint) + 1.1);
      lockedTargetWorld = new THREE.Vector3(targetWorld.x, targetWorld.y, targetWorld.z);
      const playerToTargetX = targetWorld.x - playerWorld.x;
      const playerToTargetZ = targetWorld.z - playerWorld.z;
      const targetDistance = Math.hypot(playerToTargetX, playerToTargetZ);
      const lockYaw = targetDistance > 0.001
        ? -Math.atan2(playerToTargetX, -playerToTargetZ)
        : this.yaw;
      const orbitOffset = THREE.MathUtils.clamp(
        this.getPlayerTargetOrbitYawOffset(sharedControlPlayerId),
        -0.72,
        0.72,
      );
      this.setPlayerTargetOrbitYawOffset(sharedControlPlayerId, orbitOffset);
      cameraYaw = lockYaw + orbitOffset;
      const lockPitch = THREE.MathUtils.clamp(this.pitch, -0.12, 0.34);
      this.pitch = THREE.MathUtils.lerp(this.pitch, lockPitch, 1 - Math.pow(0.0005, dt));
      distance = THREE.MathUtils.clamp(
        cameraProfile.lockedBaseDistance
          + Math.min(cameraProfile.lockedTargetAddMax, targetDistance * cameraProfile.lockedTargetScale)
          + separationDistanceBoost,
        cameraProfile.lockedMinDistance,
        cameraProfile.lockedMaxDistance,
      );
      focus = new THREE.Vector3(
        (cameraPlayerWorld.x * 0.68) + (targetWorld.x * 0.32),
        Math.max(cameraPlayerWorld.y, targetWorld.y) + 0.28,
        (cameraPlayerWorld.z * 0.68) + (targetWorld.z * 0.32),
      );
      cameraAnchor = focus.clone();
    } else {
      if (this.cameraYawPan) {
        const elapsed = (this.currentFrameTime || performance.now()) - this.cameraYawPan.startedAt;
        const amount = smoothstep(elapsed / this.cameraYawPan.durationMs);
        cameraYaw = lerpAngleRadians(this.cameraYawPan.fromYaw, this.cameraYawPan.toYaw, amount);
        forwardPanActive = amount < 1;
        if (!forwardPanActive) {
          cameraYaw = this.cameraYawPan.toYaw;
          this.cameraYawPan = null;
        }
      }
      this.setPlayerTargetOrbitYawOffset(sharedControlPlayerId, 0);
      cameraAnchor = focus.clone();
    }

    if (railRide) {
      const railSegment = this.resolveGrindRailSegment(railRide);
      if (railSegment) {
        const railYaw = getCameraYawFromFieldDelta(
          railSegment.directionX * railRide.direction,
          railSegment.directionY * railRide.direction,
          cameraYaw,
        );
        cameraYaw = lerpAngleRadians(cameraYaw, railYaw - (GRIND_RAIL_CAMERA_YAW_BIAS_STRENGTH * railRide.direction), 1 - Math.pow(0.0012, dt));
        const railForward = new THREE.Vector3(-Math.sin(railYaw), 0, -Math.cos(railYaw));
        focus = cameraPlayerWorld.clone();
        focus.y += 0.22;
        focus.addScaledVector(railForward, GRIND_RAIL_CAMERA_FOCUS_AHEAD);
        cameraAnchor = cameraPlayerWorld.clone();
      }
    }

    if (launcherAimMode && avatar) {
      const launcherPitch = THREE.MathUtils.clamp(this.pitch, LAUNCHER_CAMERA_MIN_PITCH, LAUNCHER_CAMERA_MAX_PITCH);
      this.pitch = THREE.MathUtils.lerp(this.pitch, launcherPitch, 1 - Math.pow(0.0007, dt));
      const aimForward = new THREE.Vector3(
        -Math.sin(cameraYaw) * Math.cos(this.pitch),
        -Math.sin(this.pitch),
        -Math.cos(cameraYaw) * Math.cos(this.pitch),
      ).normalize();
      cameraAnchor = cameraPlayerWorld.clone();
      cameraAnchor.y += LAUNCHER_CAMERA_ANCHOR_LIFT;
      if (lockedTargetWorld) {
        focus = lockedTargetWorld.clone();
        focus.y += LAUNCHER_CAMERA_LOCKED_LOOK_LIFT;
        distance = THREE.MathUtils.clamp(
          distance * 0.78,
          LAUNCHER_CAMERA_DISTANCE_MIN,
          LAUNCHER_CAMERA_DISTANCE_MAX,
        );
      } else {
        focus = cameraPlayerWorld.clone();
        focus.y += LAUNCHER_CAMERA_LOOK_LIFT;
        focus.addScaledVector(aimForward, LAUNCHER_CAMERA_FOCUS_AHEAD);
        distance = THREE.MathUtils.clamp(
          baseCameraDistance * 0.7,
          LAUNCHER_CAMERA_DISTANCE_MIN,
          LAUNCHER_CAMERA_DISTANCE_MAX,
        );
      }
    }

    const cosPitch = Math.cos(this.pitch);
    const heightOffset = launcherAimMode ? LAUNCHER_CAMERA_HEIGHT_OFFSET : cameraProfile.heightOffset;
    const offset = new THREE.Vector3(
      Math.sin(cameraYaw) * distance * cosPitch,
      heightOffset + Math.sin(this.pitch) * distance,
      Math.cos(cameraYaw) * distance * cosPitch,
    );
    const shoulderOffset = launcherAimMode
      ? new THREE.Vector3(
        Math.cos(cameraYaw) * LAUNCHER_CAMERA_SHOULDER_OFFSET,
        0.18,
        -Math.sin(cameraYaw) * LAUNCHER_CAMERA_SHOULDER_OFFSET,
      )
      : lockedTarget
        ? new THREE.Vector3(Math.cos(cameraYaw) * 0.62, 0, -Math.sin(cameraYaw) * 0.62)
        : new THREE.Vector3();
    const desired = cameraAnchor.clone().add(offset).add(shoulderOffset);
    const positionLerpBase = forwardPanActive ? 0.00002 : 0.001;
    if (this.snapCameraNextFrame) {
      this.camera.position.copy(desired);
      this.snapCameraNextFrame = false;
    } else {
      this.camera.position.lerp(desired, 1 - Math.pow(positionLerpBase, dt));
    }
    this.camera.lookAt(focus);
    if (this.cameraImpulse.lengthSq() > 0.000001) {
      this.camera.position.add(this.cameraImpulse);
      this.cameraImpulse.multiplyScalar(Math.pow(0.02, dt));
      if (this.cameraImpulse.lengthSq() < 0.00001) {
        this.cameraImpulse.set(0, 0, 0);
      }
    }

    this.camera.fov = 62 + separationFovBoost;
    this.camera.updateProjectionMatrix();
    this.yaw = cameraYaw;
    this.clockForward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw)).normalize();
    this.clockRight.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw)).normalize();
  }

  private updateSplitCamera(
    playerId: PlayerId,
    camera: THREE.PerspectiveCamera,
    dt: number,
    yawDelta: number,
    pitchDelta: number,
    allowManualLook: boolean,
  ): void {
    const avatar = this.options.getPlayerAvatar(playerId);
    const viewState = this.splitCameraStates[playerId];
    let viewYaw = viewState.yaw;
    let viewPitch = viewState.pitch;
    const cameraProfile = this.mapProfile.camera;
    if (!avatar) {
      camera.fov = 62;
      camera.updateProjectionMatrix();
      return;
    }

    const avatarPoint = { x: avatar.x, y: avatar.y };
    const playerWorld = fieldToHavenWorld(this.options.map, avatarPoint, this.getPlayerVisualWorldElevation(playerId, avatarPoint) + 1.15);
    if (this.splitCameraSnapNextFrame[playerId] || !Number.isFinite(this.splitCameraFollowWorldY[playerId] ?? Number.NaN)) {
      this.splitCameraFollowWorldY[playerId] = playerWorld.y;
    } else {
      const heightSmoothing = dt > 0 ? 1 - Math.pow(CAMERA_FOLLOW_ELEVATION_LERP_BASE, dt) : 1;
      this.splitCameraFollowWorldY[playerId] = THREE.MathUtils.lerp(
        this.splitCameraFollowWorldY[playerId] ?? playerWorld.y,
        playerWorld.y,
        heightSmoothing,
      );
    }
    const cameraPlayerWorld = new THREE.Vector3(
      playerWorld.x,
      this.splitCameraFollowWorldY[playerId] ?? playerWorld.y,
      playerWorld.z,
    );
    const lockedTarget = this.getLockedTargetCandidate(playerId);
    const activeMode = this.getPlayerActiveMode(playerId);
    const railRide = this.getPlayerRailRide(playerId);
    let distance = THREE.MathUtils.clamp(viewState.distance, cameraProfile.minDistance, cameraProfile.maxDistance);
    let focus = cameraPlayerWorld.clone();
    let cameraAnchor = cameraPlayerWorld.clone();
    let forwardPanActive = false;
    let lockedTargetWorld: THREE.Vector3 | null = null;

    if (allowManualLook && Math.abs(yawDelta) > 0.000001) {
      this.splitCameraYawPans[playerId] = null;
    }
    if (allowManualLook) {
      viewYaw += yawDelta;
      viewPitch = THREE.MathUtils.clamp(viewPitch + pitchDelta, CAMERA_MIN_PITCH, CAMERA_MAX_PITCH);
    }

    if (lockedTarget) {
      const targetPoint = { x: lockedTarget.x, y: lockedTarget.y };
      const targetWorld = fieldToHavenWorld(this.options.map, targetPoint, this.getGroundElevationAtPoint(targetPoint) + 1.1);
      lockedTargetWorld = new THREE.Vector3(targetWorld.x, targetWorld.y, targetWorld.z);
      const playerToTargetX = targetWorld.x - playerWorld.x;
      const playerToTargetZ = targetWorld.z - playerWorld.z;
      const targetDistance = Math.hypot(playerToTargetX, playerToTargetZ);
      const lockYaw = targetDistance > 0.001
        ? -Math.atan2(playerToTargetX, -playerToTargetZ)
        : viewYaw;
      const orbitOffset = THREE.MathUtils.clamp(
        this.getPlayerTargetOrbitYawOffset(playerId) + (allowManualLook ? yawDelta : 0),
        -0.72,
        0.72,
      );
      this.setPlayerTargetOrbitYawOffset(playerId, orbitOffset);
      viewYaw = lockYaw + orbitOffset;
      const lockPitch = THREE.MathUtils.clamp(viewPitch, -0.12, 0.34);
      viewPitch = THREE.MathUtils.lerp(viewPitch, lockPitch, 1 - Math.pow(0.0005, dt));
      distance = THREE.MathUtils.clamp(
        cameraProfile.lockedBaseDistance + Math.min(cameraProfile.lockedTargetAddMax, targetDistance * cameraProfile.lockedTargetScale),
        cameraProfile.lockedMinDistance,
        cameraProfile.lockedMaxDistance,
      );
      focus = new THREE.Vector3(
        (cameraPlayerWorld.x * 0.64) + (targetWorld.x * 0.36),
        Math.max(cameraPlayerWorld.y, targetWorld.y) + 0.28,
        (cameraPlayerWorld.z * 0.64) + (targetWorld.z * 0.36),
      );
      cameraAnchor = focus.clone();
    } else {
      const pan = this.splitCameraYawPans[playerId];
      if (pan) {
        const elapsed = (this.currentFrameTime || performance.now()) - pan.startedAt;
        const amount = smoothstep(elapsed / pan.durationMs);
        viewYaw = lerpAngleRadians(pan.fromYaw, pan.toYaw, amount);
        forwardPanActive = amount < 1;
        if (!forwardPanActive) {
          viewYaw = pan.toYaw;
          this.splitCameraYawPans[playerId] = null;
        }
      } else if (!allowManualLook) {
        viewYaw = lerpAngleRadians(viewYaw, getCameraYawForFacing(avatar.facing), 1 - Math.pow(0.0015, dt));
      }
      this.setPlayerTargetOrbitYawOffset(playerId, 0);
    }

    if (railRide) {
      const railSegment = this.resolveGrindRailSegment(railRide);
      if (railSegment) {
        const railYaw = getCameraYawFromFieldDelta(
          railSegment.directionX * railRide.direction,
          railSegment.directionY * railRide.direction,
          viewYaw,
        );
        viewYaw = lerpAngleRadians(viewYaw, railYaw - (GRIND_RAIL_CAMERA_YAW_BIAS_STRENGTH * railRide.direction), 1 - Math.pow(0.0012, dt));
        const railForward = new THREE.Vector3(-Math.sin(railYaw), 0, -Math.cos(railYaw));
        focus = cameraPlayerWorld.clone();
        focus.y += 0.22;
        focus.addScaledVector(railForward, GRIND_RAIL_CAMERA_FOCUS_AHEAD);
        cameraAnchor = cameraPlayerWorld.clone();
      }
    }

    const launcherAimMode = activeMode === "launcher" && !railRide;
    if (launcherAimMode) {
      const launcherPitch = THREE.MathUtils.clamp(viewPitch, LAUNCHER_CAMERA_MIN_PITCH, LAUNCHER_CAMERA_MAX_PITCH);
      viewPitch = THREE.MathUtils.lerp(viewPitch, launcherPitch, 1 - Math.pow(0.0007, dt));
      const aimForward = new THREE.Vector3(
        -Math.sin(viewYaw) * Math.cos(viewPitch),
        -Math.sin(viewPitch),
        -Math.cos(viewYaw) * Math.cos(viewPitch),
      ).normalize();
      cameraAnchor = cameraPlayerWorld.clone();
      cameraAnchor.y += LAUNCHER_CAMERA_ANCHOR_LIFT;
      if (lockedTargetWorld) {
        focus = lockedTargetWorld.clone();
        focus.y += LAUNCHER_CAMERA_LOCKED_LOOK_LIFT;
        distance = THREE.MathUtils.clamp(distance * 0.78, LAUNCHER_CAMERA_DISTANCE_MIN, LAUNCHER_CAMERA_DISTANCE_MAX);
      } else {
        focus = cameraPlayerWorld.clone();
        focus.y += LAUNCHER_CAMERA_LOOK_LIFT;
        focus.addScaledVector(aimForward, LAUNCHER_CAMERA_FOCUS_AHEAD);
        distance = THREE.MathUtils.clamp(distance * 0.7, LAUNCHER_CAMERA_DISTANCE_MIN, LAUNCHER_CAMERA_DISTANCE_MAX);
      }
    }

    const cosPitch = Math.cos(viewPitch);
    const heightOffset = launcherAimMode ? LAUNCHER_CAMERA_HEIGHT_OFFSET : cameraProfile.heightOffset;
    const offset = new THREE.Vector3(
      Math.sin(viewYaw) * distance * cosPitch,
      heightOffset + Math.sin(viewPitch) * distance,
      Math.cos(viewYaw) * distance * cosPitch,
    );
    const shoulderOffset = launcherAimMode
      ? new THREE.Vector3(
        Math.cos(viewYaw) * LAUNCHER_CAMERA_SHOULDER_OFFSET,
        0.18,
        -Math.sin(viewYaw) * LAUNCHER_CAMERA_SHOULDER_OFFSET,
      )
      : lockedTarget
        ? new THREE.Vector3(Math.cos(viewYaw) * 0.62, 0, -Math.sin(viewYaw) * 0.62)
        : new THREE.Vector3();
    const desired = cameraAnchor.clone().add(offset).add(shoulderOffset);
    const positionLerpBase = forwardPanActive ? 0.00002 : 0.001;
    if (this.splitCameraSnapNextFrame[playerId]) {
      camera.position.copy(desired);
      this.splitCameraSnapNextFrame[playerId] = false;
    } else {
      camera.position.lerp(desired, 1 - Math.pow(positionLerpBase, dt));
    }
    camera.lookAt(focus);
    if (playerId === "P1" && this.cameraImpulse.lengthSq() > 0.000001) {
      camera.position.add(this.cameraImpulse);
      this.cameraImpulse.multiplyScalar(Math.pow(0.02, dt));
      if (this.cameraImpulse.lengthSq() < 0.00001) {
        this.cameraImpulse.set(0, 0, 0);
      }
    }

    camera.fov = 62;
    camera.updateProjectionMatrix();
    this.splitCameraStates[playerId] = {
      yaw: viewYaw,
      pitch: viewPitch,
      distance,
    };
    if (playerId === "P1") {
      this.clockForward.set(-Math.sin(viewYaw), 0, -Math.cos(viewYaw)).normalize();
      this.clockRight.set(Math.cos(viewYaw), 0, -Math.sin(viewYaw)).normalize();
    }
  }

  private renderScene(): void {
    const width = Math.max(1, this.options.host.clientWidth || window.innerWidth);
    const height = Math.max(1, this.options.host.clientHeight || window.innerHeight);
    if (this.getEffectiveCameraMode() !== "split") {
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, width, height);
      this.renderer.setScissor(0, 0, width, height);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const leftWidth = Math.max(1, Math.floor(width / 2));
    const rightWidth = Math.max(1, width - leftWidth);
    const previousAutoClear = this.renderer.autoClear;
    this.renderer.setScissorTest(true);
    this.renderer.autoClear = true;
    this.renderer.setViewport(0, 0, width, height);
    this.renderer.setScissor(0, 0, width, height);
    this.renderer.clear();
    this.renderer.autoClear = false;
    this.renderer.setViewport(0, 0, leftWidth, height);
    this.renderer.setScissor(0, 0, leftWidth, height);
    this.renderer.render(this.scene, this.splitCameras.P1);
    this.renderer.setViewport(leftWidth, 0, rightWidth, height);
    this.renderer.setScissor(leftWidth, 0, rightWidth, height);
    this.renderer.render(this.scene, this.splitCameras.P2);
    this.renderer.autoClear = previousAutoClear;
    this.renderer.setScissorTest(false);
  }

  private syncDynamicActors(): void {
    this.syncPlayerActor("P1");
    this.syncPlayerActor("P2");
    this.syncCompanionActor();
    this.syncNpcActors();
    this.syncEnemyActors();
  }

  private createFieldProjectileActor(projectile: FieldProjectile): THREE.Object3D {
    const hostile = projectile.hostile === true;
    const group = new THREE.Group();
    group.name = `Haven3DFieldProjectile:${projectile.id}`;
    const coreColor = hostile ? 0xff4e38 : 0xffcc6e;
    const glowColor = hostile ? 0xff9a42 : 0x66dbc9;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(hostile ? 0.16 : 0.12, 12, 8),
      new THREE.MeshBasicMaterial({
        color: coreColor,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    );
    const trail = new THREE.Mesh(
      new THREE.CylinderGeometry(hostile ? 0.035 : 0.028, hostile ? 0.12 : 0.09, hostile ? 0.86 : 0.58, 8),
      new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: hostile ? 0.52 : 0.42,
        depthWrite: false,
      }),
    );
    trail.rotation.x = Math.PI / 2;
    trail.position.z = -0.36;
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(hostile ? 0.2 : 0.16, 0.018, 8, 18),
      new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: hostile ? 0.72 : 0.48,
        depthWrite: false,
      }),
    );
    halo.rotation.x = Math.PI / 2;
    group.add(trail, core, halo);
    group.renderOrder = 22;
    this.dynamicGroup.add(group);
    return group;
  }

  private syncFieldProjectiles(): void {
    const projectiles = this.options.getFieldProjectiles?.() ?? [];
    const projectileIds = new Set(projectiles.map((projectile) => projectile.id));
    Array.from(this.fieldProjectileActors.entries()).forEach(([id, object]) => {
      if (!projectileIds.has(id)) {
        this.dynamicGroup.remove(object);
        disposeObject(object);
        this.fieldProjectileActors.delete(id);
      }
    });

    const now = this.currentFrameTime || performance.now();
    projectiles.forEach((projectile) => {
      let object = this.fieldProjectileActors.get(projectile.id);
      if (!object) {
        object = this.createFieldProjectileActor(projectile);
        this.fieldProjectileActors.set(projectile.id, object);
      }
      const point = { x: projectile.x, y: projectile.y };
      const world = fieldToHavenWorld(this.options.map, point, this.getGroundElevationAtPoint(point) + 0.88);
      const pulse = 1 + Math.sin(now * (projectile.hostile ? 0.022 : 0.018)) * (projectile.hostile ? 0.12 : 0.08);
      const radiusScale = THREE.MathUtils.clamp(Number(projectile.radius ?? 6) / 8, 0.85, 1.65);
      object.position.set(world.x, world.y, world.z);
      object.rotation.y = getYawFromFieldDelta(projectile.vx, projectile.vy, object.rotation.y);
      object.scale.setScalar(radiusScale * pulse);
    });
  }

  private createLootOrbActor(orb: FieldLootOrb): THREE.Object3D {
    const group = new THREE.Group();
    group.name = `Haven3DLootOrb:${orb.id}`;
    const visual = new THREE.Group();
    visual.name = LOOT_ORB_VISUAL_NAME;
    const palette = getLootOrbPalette(orb);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.34, 1),
      new THREE.MeshBasicMaterial({
        color: palette.core,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      }),
    );
    core.name = LOOT_ORB_CORE_NAME;
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.43, 20, 14),
      new THREE.MeshBasicMaterial({
        color: palette.shell,
        transparent: true,
        opacity: palette.shellOpacity,
        depthWrite: false,
      }),
    );
    shell.name = LOOT_ORB_SHELL_NAME;
    const equator = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.032, 8, 40),
      new THREE.MeshBasicMaterial({
        color: palette.ring,
        transparent: true,
        opacity: palette.ringOpacity,
        depthWrite: false,
      }),
    );
    equator.name = LOOT_ORB_RING_NAME;
    const meridian = equator.clone();
    meridian.name = LOOT_ORB_RING_NAME;
    meridian.rotation.x = Math.PI / 2;
    const sparkle = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.13, 0),
      new THREE.MeshBasicMaterial({
        color: palette.sparkle,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    sparkle.name = LOOT_ORB_SPARKLE_NAME;
    sparkle.position.set(0.3, 0.34, 0.22);
    const targetRing = createTargetRing(palette.ring);
    targetRing.name = LOOT_ORB_TARGET_RING_NAME;

    visual.add(shell, core, equator, meridian, sparkle);
    group.add(visual, targetRing);
    group.renderOrder = 24;
    this.dynamicGroup.add(group);
    return group;
  }

  private syncLootOrbs(): void {
    const orbs = this.options.getLootOrbs?.() ?? [];
    const orbIds = new Set(orbs.map((orb) => orb.id));
    Array.from(this.lootOrbActors.entries()).forEach(([id, object]) => {
      if (!orbIds.has(id)) {
        this.dynamicGroup.remove(object);
        disposeObject(object);
        this.lootOrbActors.delete(id);
      }
    });

    const now = this.currentFrameTime || performance.now();
    orbs.forEach((orb) => {
      let object = this.lootOrbActors.get(orb.id);
      if (!object) {
        object = this.createLootOrbActor(orb);
        this.lootOrbActors.set(orb.id, object);
      }

      const ageMs = Math.max(0, now - orb.spawnedAt);
      const point = { x: orb.x, y: orb.y };
      const bounce = getLootOrbSpawnBounce(ageMs);
      const bob = Math.sin((now * 0.006) + orb.id.length) * 0.07 * bounce.bobFade;
      const world = fieldToHavenWorld(this.options.map, point, this.getGroundElevationAtPoint(point) + 0.92 + bob + bounce.height);
      const radiusScale = THREE.MathUtils.clamp(orb.radius / (HAVEN3D_FIELD_TILE_SIZE * 0.43), 0.95, 1.38);
      const pulse = 1 + (Math.sin(now * 0.012) * 0.09);
      const palette = getLootOrbPalette(orb);
      object.position.set(world.x, world.y, world.z);
      const visual = object.getObjectByName(LOOT_ORB_VISUAL_NAME);
      if (visual) {
        visual.rotation.y += 0.032;
        visual.rotation.x = Math.sin(now * 0.004) * 0.12;
        visual.scale.set(1 + bounce.squash * 0.1, 1 - bounce.squash * 0.18, 1 + bounce.squash * 0.1);
      }
      applyLootOrbMaterial(object.getObjectByName(LOOT_ORB_CORE_NAME), palette.core);
      applyLootOrbMaterial(object.getObjectByName(LOOT_ORB_SHELL_NAME), palette.shell, palette.shellOpacity);
      object.getObjectsByProperty("name", LOOT_ORB_RING_NAME).forEach((ring) => {
        applyLootOrbMaterial(ring, palette.ring, palette.ringOpacity);
      });
      applyLootOrbMaterial(object.getObjectByName(LOOT_ORB_SPARKLE_NAME), palette.sparkle);
      const targetRing = object.getObjectByName(LOOT_ORB_TARGET_RING_NAME);
      if (targetRing) {
        targetRing.visible = this.isTargetLockedByAnyPlayer("loot-orb", orb.id);
        applyLootOrbMaterial(targetRing, palette.ring, palette.ringOpacity);
      }
      object.scale.setScalar(radiusScale * pulse);
    });
  }

  private syncPlayerActor(playerId: PlayerId): void {
    const actor = this.playerActors.get(playerId);
    if (!actor) {
      return;
    }

    const avatar = this.options.isPlayerActive(playerId)
      ? this.options.getPlayerAvatar(playerId)
      : null;
    actor.group.visible = Boolean(avatar);
    if (!avatar) {
      return;
    }

    const avatarPoint = { x: avatar.x, y: avatar.y };
    const verticalWorldElevation = this.getPlayerVisualWorldElevation(playerId, avatarPoint);
    const world = fieldToHavenWorld(this.options.map, avatarPoint, verticalWorldElevation + 0.04);
    const vertical = this.getPlayerVerticalState(playerId);
    const lockedTarget = this.getLockedTargetCandidate(playerId);
    const railRide = this.getPlayerRailRide(playerId);
    actor.group.position.set(world.x, world.y, world.z);
    const bladeSwing = this.getPlayerBladeSwing(playerId);
    const activeMode = this.getPlayerActiveMode(playerId);
    const grappleMove = this.getPlayerGrappleMove(playerId);
    const railSegment = railRide ? this.resolveGrindRailSegment(railRide) : null;
    const bladeLookDirection = bladeSwing
      ? bladeSwing.direction
      : null;
    const launcherLookDirection = activeMode === "launcher"
      ? this.getActionDirection(playerId, avatar, lockedTarget)
      : null;
    const railLookDirection = railSegment
      ? {
          x: railSegment.directionX * railRide!.direction,
          y: railSegment.directionY * railRide!.direction,
        }
      : null;
    const lookDirection = railLookDirection ?? (lockedTarget
      ? { x: lockedTarget.x - avatar.x, y: lockedTarget.y - avatar.y }
      : launcherLookDirection ?? bladeLookDirection);
    const dashActive = this.isPlayerDashActive(playerId, vertical);
    this.updateActorMotion(
      actor,
      avatar.x,
      avatar.y,
      playerId === "P1" ? 1.08 : 1,
      this.getRotationForFacing(avatar.facing),
      lookDirection,
      dashActive,
      !vertical.grounded && !railRide,
    );
    if (railRide) {
      if (actor.motion) {
        actor.motion.footstepSoundStep = undefined;
        actor.motion.footDustStep = undefined;
      }
    } else {
      this.applyChibiJumpPose(actor.chibi, vertical);
    }
    if (vertical.grounded && !railRide) {
      this.maybeEmitPlayerFootstep(actor, playerId);
      this.maybeSpawnRunDust(actor, avatar.x, avatar.y);
    } else if (actor.motion) {
      actor.motion.footstepSoundStep = undefined;
      actor.motion.footDustStep = undefined;
    }
    this.updatePlayerBladePose(actor, playerId, lockedTarget);
  }

  private updatePlayerBladePose(
    actor: Actor,
    playerId: PlayerId,
    lockedTarget: Haven3DTargetCandidate | null = null,
  ): void {
    if (!actor.blade) {
      return;
    }

    const activeMode = this.getPlayerActiveMode(playerId);
    const isTargetReady = Boolean(lockedTarget) && activeMode !== null;
    const transform = this.readGearbladeTransform(playerId);
    const vertical = this.getPlayerVerticalState(playerId);
    const grappleMove = this.getPlayerGrappleMove(playerId);
    const bladeSwing = this.getPlayerBladeSwing(playerId);
    const railRide = this.getPlayerRailRide(playerId);
    this.updatePlayerWeaponForm(actor, activeMode, transform);
    if (railRide) {
      this.updatePlayerWeaponForm(actor, null, transform);
      this.applyGrindRailRidePose(actor, railRide);
      this.stowBladeOnBack(actor);
      this.hideBladeTrail(actor);
      return;
    }
    if (activeMode === "launcher") {
      const recoil = this.getLauncherRecoilAmount(playerId);
      const launcherAirborne = !vertical.grounded;
      if (!launcherAirborne) {
        this.applyLauncherReadyBodyPose(actor, recoil, transform);
      }
      this.mountBladeOnChibiRoot(actor);
      this.updateLauncherReadyPose(actor, recoil, transform);
      this.hideBladeTrail(actor);
      return;
    }
    if (activeMode !== "blade") {
      if (activeMode === "grapple" && grappleMove?.target.kind === "zipline-track") {
        this.applyZiplineRidePose(actor);
        this.updateZiplineGrappleGripPose(actor);
      } else if (isTargetReady && activeMode) {
        this.applyTargetReadyBodyPose(actor, activeMode);
      }
      this.stowBladeOnBack(actor);
      this.hideBladeTrail(actor);
      return;
    }

    if (activeMode && transform && !bladeSwing) {
      actor.blade.visible = true;
      this.applyGearbladeTransformBodyPose(actor, transform);
      this.mountBladeOnSwingHand(actor);
      this.updateGearbladeTransformWeaponPose(actor, transform);
      this.hideBladeTrail(actor);
      return;
    }

    const swing = bladeSwing;
    if (!swing) {
      actor.blade.visible = true;
      if (isTargetReady && activeMode) {
        this.applyTargetReadyBodyPose(actor, activeMode);
        this.mountBladeOnChibiRoot(actor);
        this.updateBladeTargetReadyPose(actor);
        this.hideBladeTrail(actor);
        return;
      }

      this.stowBladeOnBack(actor);
      this.hideBladeTrail(actor);
      return;
    }

    actor.blade.visible = true;
    const elapsed = this.currentFrameTime - swing.startedAt;
    const windup = smoothstep(elapsed / BLADE_SWING_WINDUP_MS);
    const strike = smoothstep((elapsed - BLADE_SWING_WINDUP_MS) / (BLADE_LUNGE_END_MS - BLADE_SWING_WINDUP_MS));
    const recovery = smoothstep((elapsed - BLADE_LUNGE_END_MS) / (BLADE_SWING_TOTAL_MS - BLADE_LUNGE_END_MS));
    this.applyBladeSwingArmPose(actor, swing, elapsed, windup, strike, recovery);
    this.mountBladeOnChibiRoot(actor);
    this.updateBladeSwingWeaponPose(actor, swing, elapsed);
    this.updateBladeSwingTrail(actor, swing, elapsed);
  }

  private hideBladeTrail(actor: Actor): void {
    if (!actor.bladeTrail) {
      return;
    }

    actor.bladeTrail.visible = false;
    actor.bladeTrail.scale.set(1, 1, 1);
    const material = actor.bladeTrail instanceof THREE.Mesh ? actor.bladeTrail.material : null;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.opacity = 0;
    }
  }

  private updateBladeSwingTrail(actor: Actor, swing: BladeSwingState, elapsed: number): void {
    if (!actor.bladeTrail) {
      return;
    }

    const verticalFinisher = this.isVerticalBladeFinisher(swing);
    const trailStart = BLADE_SWING_ARC_START_MS;
    const trailEnd = BLADE_SWING_TOTAL_MS - 34;
    const trailT = THREE.MathUtils.clamp((elapsed - trailStart) / Math.max(1, trailEnd - trailStart), 0, 1);
    const pose = this.getBladeSwingWeaponPoseValues(swing, elapsed);
    const slashPulse = Math.sin(trailT * Math.PI);
    const impactFlash = Math.max(0, 1 - Math.abs(elapsed - BLADE_SWING_IMPACT_MS) / 62);
    const active = elapsed >= trailStart && elapsed <= trailEnd && (slashPulse > 0.02 || impactFlash > 0.02);
    actor.bladeTrail.visible = active;

    const material = actor.bladeTrail instanceof THREE.Mesh ? actor.bladeTrail.material : null;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.opacity = active ? Math.min(0.92, 0.18 + (0.55 * slashPulse) + (0.28 * impactFlash)) : 0;
      material.color.setHex(impactFlash > 0.35 ? 0xfff0b8 : 0xf6d28a);
    }

    actor.bladeTrail.position.set(
      verticalFinisher
        ? 0
        : 0.02 - (0.045 * swing.side * PLAYER_RIGHT_HAND_LOCAL_X * pose.slashPulse),
      verticalFinisher ? 0.09 + (0.03 * impactFlash) : 0.006,
      verticalFinisher ? 0.98 + (0.18 * pose.slashPulse) : 0.92 + (0.1 * pose.slashPulse),
    );
    actor.bladeTrail.scale.set(
      verticalFinisher
        ? 0.9 + (0.3 * pose.slashPulse) + (0.16 * impactFlash)
        : 1.12 + (0.5 * pose.slashPulse) + (0.22 * impactFlash),
      verticalFinisher
        ? 1.42 + (1.72 * slashPulse)
        : 1.05 + (1.5 * slashPulse),
      1,
    );
  }

  private applyZiplineRidePose(actor: Actor): void {
    const chibi = actor.chibi;
    if (!chibi) {
      return;
    }

    const frameTime = this.currentFrameTime || performance.now();
    const bob = Math.sin(frameTime * 0.0064) * 0.012;
    const sway = Math.sin(frameTime * 0.0048) * 0.035;
    const handedSide = PLAYER_RIGHT_HAND_LOCAL_X;
    const rootHangY = bob;

    chibi.root.position.set(0, rootHangY, 0.02);
    chibi.root.rotation.set(0.08, 0, sway * 0.32);
    chibi.torso.rotation.set(-0.08, sway * 0.58, -0.05 * handedSide + sway * 0.48);
    chibi.pelvis.rotation.set(0.2, -sway * 0.26, 0.04 * handedSide);
    chibi.head.rotation.set(0.06, -sway * 0.34, -sway * 0.22);

    chibi.leftUpperArm.rotation.set(0.54 + sway * 0.18, -0.18, 0.5);
    chibi.leftForearm.rotation.set(-0.34, -0.08, 0.18);

    chibi.leftThigh.rotation.set(-0.34, 0.1, -0.24);
    chibi.rightThigh.rotation.set(-0.28, -0.08, 0.18);
    chibi.leftShin.rotation.set(0.74, 0.04, -0.08);
    chibi.rightShin.rotation.set(0.62, -0.04, 0.08);
    chibi.leftFoot.rotation.set(-0.22, 0.03, -0.1);
    chibi.rightFoot.rotation.set(-0.18, -0.03, 0.08);

    const shoulder = chibi.rightShoulderPivot.position;
    const wristPoint = new THREE.Vector3(
      0.14 * handedSide,
      GRAPPLE_ZIPLINE_RIDER_HAND_OFFSET_WORLD - rootHangY,
      0.015,
    );
    const shoulderToWrist = wristPoint.clone().sub(shoulder);
    const wristDistance = Math.max(0.001, shoulderToWrist.length());
    const wristDirection = shoulderToWrist.clone().normalize();
    const upperArmLength = 0.43;
    const lowerArmLength = THREE.MathUtils.clamp(
      0.49,
      Math.max(0.3, wristDistance - upperArmLength + 0.012),
      upperArmLength + wristDistance - 0.012,
    );
    const reachDistance = THREE.MathUtils.clamp(
      wristDistance,
      Math.abs(upperArmLength - lowerArmLength) + 0.001,
      upperArmLength + lowerArmLength - 0.001,
    );
    const elbowAlongReach = (
      (upperArmLength * upperArmLength) - (lowerArmLength * lowerArmLength) + (reachDistance * reachDistance)
    ) / (2 * reachDistance);
    const elbowBend = Math.sqrt(Math.max(0, (upperArmLength * upperArmLength) - (elbowAlongReach * elbowAlongReach)));
    const elbowBias = new THREE.Vector3(0.26 * handedSide, -0.08, -0.34 + sway * 0.18);
    const elbowBendDirection = elbowBias
      .addScaledVector(wristDirection, -elbowBias.dot(wristDirection))
      .normalize();
    if (elbowBendDirection.lengthSq() < 0.001) {
      elbowBendDirection.set(0.18 * handedSide, 0, -1).normalize();
    }

    const elbow = shoulder.clone()
      .addScaledVector(wristDirection, elbowAlongReach)
      .addScaledVector(elbowBendDirection, elbowBend);
    const upperDirection = elbow.clone().sub(shoulder).normalize();
    const lowerDirection = wristPoint.clone().sub(elbow).normalize();
    const localDown = new THREE.Vector3(0, -1, 0);
    const shoulderRotation = new THREE.Quaternion().setFromUnitVectors(localDown, upperDirection);
    const localLowerDirection = lowerDirection.clone().applyQuaternion(shoulderRotation.clone().invert()).normalize();

    chibi.rightShoulderPivot.quaternion.copy(shoulderRotation);
    chibi.rightUpperArm.rotation.set(0, 0, 0);
    chibi.rightForearm.position.set(0, -upperArmLength, 0);
    chibi.rightForearm.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(localDown, localLowerDirection));
    chibi.rightHandMount.position.set(0, -lowerArmLength, 0);

    const gripForward = new THREE.Vector3(0, 1, 0);
    const palmUp = lowerDirection.clone().multiplyScalar(-1);
    palmUp.addScaledVector(gripForward, -palmUp.dot(gripForward)).normalize();
    if (palmUp.lengthSq() < 0.001) {
      palmUp.set(0, 0, 1);
    }
    const palmRight = new THREE.Vector3().crossVectors(palmUp, gripForward).normalize();
    const correctedPalmUp = new THREE.Vector3().crossVectors(gripForward, palmRight).normalize();
    const desiredHandRotation = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(palmRight, correctedPalmUp, gripForward),
    );
    const handParentRotation = shoulderRotation.clone().multiply(chibi.rightForearm.quaternion);
    chibi.rightHandMount.quaternion.copy(handParentRotation.invert().multiply(desiredHandRotation));
    chibi.rightHandMount.rotateX(-0.1);
    chibi.rightHandMount.rotateZ(-0.08 * handedSide);
    chibi.rightHand.position.set(0, -0.002, 0.048);
    chibi.rightHand.scale.set(0.9, 0.72, 0.62);
  }

  private applyGrindRailRidePose(actor: Actor, railRide: RailRideState): void {
    const chibi = actor.chibi;
    if (!chibi) {
      return;
    }

    const frameTime = this.currentFrameTime || performance.now();
    const sway = Math.sin(frameTime * 0.0086) * 0.03;
    const bob = Math.sin(frameTime * 0.0124) * 0.014;
    const stanceSide = railRide.direction;
    chibi.root.position.set(0, 0.15 + bob, 0.02);
    chibi.root.rotation.set(0.08, 0.88 * stanceSide, -0.08 * stanceSide);
    chibi.torso.rotation.set(-0.1, -0.26 * stanceSide, -0.18 * stanceSide + sway);
    chibi.pelvis.rotation.set(0.18, 0.16 * stanceSide, 0.12 * stanceSide - (sway * 0.5));
    chibi.head.rotation.set(0.04, 0.22 * stanceSide, 0.1 * stanceSide - (sway * 0.32));

    chibi.leftUpperArm.rotation.set(0.34, -0.22, 0.78 + (0.08 * sway));
    chibi.leftForearm.rotation.set(-0.46, -0.08, 0.44);
    chibi.rightUpperArm.rotation.set(0.28, 0.26, -0.54 + (0.06 * sway));
    chibi.rightForearm.rotation.set(-0.36, 0.06, -0.22);

    chibi.leftThigh.rotation.set(-0.12, -0.08, -0.52);
    chibi.leftShin.rotation.set(0.54, 0.02, -0.08);
    chibi.leftFoot.position.set(-0.06, -0.27, 0.16);
    chibi.leftFoot.rotation.set(-0.14, 0.04, 0.1);

    chibi.rightThigh.rotation.set(0.22, 0.08, 0.12);
    chibi.rightShin.rotation.set(0.28, 0, 0.02);
    chibi.rightFoot.position.set(0.02, -0.27, 0.16);
    chibi.rightFoot.rotation.set(0.02, 0, -0.04);

    chibi.rightShoulderPivot.rotation.set(0, 0, 0);
    chibi.rightForearm.position.set(0, -0.3, 0.03);
    chibi.rightHandMount.position.set(0, -0.28, 0.04);
    chibi.rightHandMount.rotation.set(0, 0, 0);
    chibi.rightHand.position.set(0, 0, 0);
    chibi.rightHand.scale.set(0.9, 0.72, 0.62);
  }

  private updateZiplineGrappleGripPose(actor: Actor): void {
    if (!actor.blade) {
      return;
    }

    const rotation = new THREE.Euler(-Math.PI / 2, 0.02 * PLAYER_RIGHT_HAND_LOCAL_X, 0.04 * PLAYER_RIGHT_HAND_LOCAL_X);
    const scale = new THREE.Vector3(0.58, 0.58, 0.36);
    const gripToBladeRoot = new THREE.Vector3(0, 0, -BLADE_GRIP_CENTER_LOCAL_Z * scale.z).applyEuler(rotation);
    actor.blade.visible = true;
    actor.blade.position.copy(gripToBladeRoot);
    actor.blade.rotation.copy(rotation);
    actor.blade.scale.copy(scale);
  }

  private applyLauncherReadyBodyPose(
    actor: Actor,
    recoil: number,
    transform: GearbladeTransformSnapshot | null = null,
  ): void {
    const chibi = actor.chibi;
    if (!chibi) {
      return;
    }

    const frameTime = this.currentFrameTime || performance.now();
    const drawBlend = transform?.to === "launcher" ? transform.eased : 1;
    const drawPulse = transform?.to === "launcher" ? transform.pulse : 0;
    const idleSway = Math.sin(frameTime * 0.0042) * 0.018;
    const idleBob = Math.sin(frameTime * 0.0061) * 0.01;
    const blendRotation = (node: THREE.Object3D, x: number, y: number, z: number, amount: number): void => {
      node.rotation.set(
        THREE.MathUtils.lerp(node.rotation.x, x, amount),
        THREE.MathUtils.lerp(node.rotation.y, y, amount),
        THREE.MathUtils.lerp(node.rotation.z, z, amount),
      );
    };

    chibi.root.position.x += (0.018 * PLAYER_RIGHT_HAND_LOCAL_X * drawBlend) + (idleSway * 0.35);
    chibi.root.position.y -= 0.018 + (0.014 * drawBlend) - idleBob;
    chibi.root.position.z += 0.026 + (0.04 * drawBlend) - (0.024 * recoil);
    blendRotation(chibi.root, 0.05 + (0.05 * drawBlend) + (0.04 * recoil), -0.028, 0.022 * PLAYER_RIGHT_HAND_LOCAL_X, 0.56);
    blendRotation(chibi.torso, 0.1 + (0.08 * drawBlend) + (0.05 * recoil), -0.16 + (0.03 * idleSway), 0.08 * PLAYER_RIGHT_HAND_LOCAL_X, 0.72);
    blendRotation(chibi.pelvis, 0.06 + (0.04 * drawBlend), -0.07, -0.05 * PLAYER_RIGHT_HAND_LOCAL_X, 0.54);
    blendRotation(chibi.head, 0.015 + (0.03 * recoil), 0.12 + (0.05 * idleSway), -0.04 * PLAYER_RIGHT_HAND_LOCAL_X, 0.62);
    chibi.rightShoulderPivot.rotation.set(0, 0, 0);

    blendRotation(
      chibi.leftUpperArm,
      -0.12 + (0.22 * drawBlend) + (0.06 * recoil),
      -0.24,
      0.42,
      0.62,
    );
    blendRotation(
      chibi.leftForearm,
      -0.68 + (0.06 * drawPulse),
      -0.02,
      0.18,
      0.62,
    );
    chibi.rightHand.scale.set(0.96, 0.74, 0.64);
  }

  private updateLauncherReadyPose(
    actor: Actor,
    recoil: number,
    transform: GearbladeTransformSnapshot | null = null,
  ): void {
    if (!actor.blade || !actor.chibi) {
      return;
    }

    const frameTime = this.currentFrameTime || performance.now();
    const drawBlend = transform?.to === "launcher" ? transform.eased : 1;
    const drawPulse = transform?.to === "launcher" ? transform.pulse : 0;
    const idleLift = Math.sin(frameTime * 0.0056) * 0.01;
    const idleSway = Math.sin(frameTime * 0.0038) * 0.025;
    const holsterGrip = new THREE.Vector3(0.12 * PLAYER_RIGHT_HAND_LOCAL_X, 0.56, -0.06);
    const readyGrip = new THREE.Vector3(
      LAUNCHER_READY_GRIP_X + (idleSway * 0.12),
      LAUNCHER_READY_GRIP_Y + idleLift - (0.018 * recoil),
      LAUNCHER_READY_GRIP_Z - (0.11 * recoil),
    );
    const gripPoint = holsterGrip.lerp(readyGrip, drawBlend);
    const holsterRotation = new THREE.Euler(-0.16, 0.42 * PLAYER_RIGHT_HAND_LOCAL_X, -0.78 * PLAYER_RIGHT_HAND_LOCAL_X);
    const readyRotation = new THREE.Euler(
      -0.08 - (0.18 * recoil),
      (0.08 * PLAYER_RIGHT_HAND_LOCAL_X) + (idleSway * 0.12),
      -0.14 * PLAYER_RIGHT_HAND_LOCAL_X - (0.12 * recoil),
    );
    const weaponRotation = new THREE.Euler(
      THREE.MathUtils.lerp(holsterRotation.x, readyRotation.x, drawBlend),
      THREE.MathUtils.lerp(holsterRotation.y, readyRotation.y, drawBlend),
      THREE.MathUtils.lerp(holsterRotation.z, readyRotation.z, drawBlend),
    );

    actor.blade.position.copy(gripPoint);
    actor.blade.rotation.copy(weaponRotation);
    actor.blade.scale.setScalar(0.98 + (0.04 * drawPulse));
    this.applyLauncherAimArmPose(actor, gripPoint, weaponRotation, recoil);
  }

  private applyLauncherAimArmPose(
    actor: Actor,
    gripPoint: THREE.Vector3,
    weaponRotation: THREE.Euler,
    recoil: number,
  ): void {
    const chibi = actor.chibi;
    if (!chibi) {
      return;
    }

    const shoulder = chibi.rightShoulderPivot.position;
    const weaponForward = new THREE.Vector3(0, 0, 1).applyEuler(weaponRotation).normalize();
    const weaponRight = new THREE.Vector3(1, 0, 0).applyEuler(weaponRotation).normalize();
    const wristPoint = gripPoint.clone()
      .addScaledVector(weaponForward, -0.05)
      .addScaledVector(weaponRight, 0.014 * PLAYER_RIGHT_HAND_LOCAL_X);
    wristPoint.y -= 0.012;

    const shoulderToWrist = wristPoint.clone().sub(shoulder);
    const wristDistance = Math.max(0.001, shoulderToWrist.length());
    const wristDirection = shoulderToWrist.clone().normalize();
    const upperArmLength = 0.308;
    const lowerArmLength = THREE.MathUtils.clamp(
      0.294,
      Math.max(0.23, wristDistance - upperArmLength + 0.012),
      upperArmLength + wristDistance - 0.012,
    );
    const reachDistance = THREE.MathUtils.clamp(
      wristDistance,
      Math.abs(upperArmLength - lowerArmLength) + 0.001,
      upperArmLength + lowerArmLength - 0.001,
    );
    const elbowAlongReach = (
      (upperArmLength * upperArmLength) - (lowerArmLength * lowerArmLength) + (reachDistance * reachDistance)
    ) / (2 * reachDistance);
    const elbowBend = Math.sqrt(Math.max(0, (upperArmLength * upperArmLength) - (elbowAlongReach * elbowAlongReach)));
    const elbowBias = new THREE.Vector3(
      0.18 * PLAYER_RIGHT_HAND_LOCAL_X,
      -0.7 + (0.04 * recoil),
      -0.18 - (0.1 * recoil),
    );
    const elbowBendDirection = elbowBias
      .addScaledVector(wristDirection, -elbowBias.dot(wristDirection))
      .normalize();
    if (elbowBendDirection.lengthSq() < 0.001) {
      elbowBendDirection.set(0, -1, 0);
    }

    const elbow = shoulder.clone()
      .addScaledVector(wristDirection, elbowAlongReach)
      .addScaledVector(elbowBendDirection, elbowBend);
    const upperDirection = elbow.clone().sub(shoulder).normalize();
    const lowerDirection = wristPoint.clone().sub(elbow).normalize();
    const localDown = new THREE.Vector3(0, -1, 0);
    const shoulderRotation = new THREE.Quaternion().setFromUnitVectors(localDown, upperDirection);
    const localLowerDirection = lowerDirection.clone().applyQuaternion(shoulderRotation.clone().invert()).normalize();

    chibi.rightShoulderPivot.quaternion.copy(shoulderRotation);
    chibi.rightUpperArm.rotation.set(0, 0, 0);
    chibi.rightForearm.position.set(0, -upperArmLength, 0);
    chibi.rightForearm.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(localDown, localLowerDirection));
    chibi.rightHandMount.position.set(0, -lowerArmLength, 0);

    const palmForward = weaponForward.clone();
    const palmUp = lowerDirection.clone().multiplyScalar(-1);
    palmUp.addScaledVector(palmForward, -palmUp.dot(palmForward)).normalize();
    if (palmUp.lengthSq() < 0.001) {
      palmUp.set(0, 1, 0);
    }
    const palmRight = new THREE.Vector3().crossVectors(palmUp, palmForward).normalize();
    const correctedPalmUp = new THREE.Vector3().crossVectors(palmForward, palmRight).normalize();
    const desiredHandRotation = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(palmRight, correctedPalmUp, palmForward),
    );
    const handParentRotation = shoulderRotation.clone().multiply(chibi.rightForearm.quaternion);
    chibi.rightHandMount.quaternion.copy(handParentRotation.invert().multiply(desiredHandRotation));
    chibi.rightHandMount.rotateZ(-0.08 * PLAYER_RIGHT_HAND_LOCAL_X);
    chibi.rightHand.position.set(0, -0.004, 0.05);
    chibi.rightHand.scale.set(0.9, 0.72, 0.62);
  }

  private applyTargetReadyBodyPose(actor: Actor, activeMode: Haven3DGearbladeMode): void {
    const chibi = actor.chibi;
    if (!chibi) {
      return;
    }

    const isBlade = activeMode === "blade";
    const isLauncher = activeMode === "launcher";
    const lean = isLauncher ? 0.04 : 0.06;

    chibi.root.position.y -= 0.012;
    chibi.torso.rotation.x = THREE.MathUtils.lerp(chibi.torso.rotation.x, lean, 0.72);
    chibi.torso.rotation.y = THREE.MathUtils.lerp(chibi.torso.rotation.y, -0.08, 0.5);
    chibi.head.rotation.x = THREE.MathUtils.lerp(chibi.head.rotation.x, 0.04, 0.5);
    chibi.head.rotation.y = THREE.MathUtils.lerp(chibi.head.rotation.y, 0.06, 0.5);
    chibi.pelvis.rotation.x = THREE.MathUtils.lerp(chibi.pelvis.rotation.x, 0.04, 0.5);
    chibi.rightShoulderPivot.rotation.set(0, 0, 0);

    chibi.rightUpperArm.rotation.set(
      isBlade ? 0.32 : 0.24,
      isBlade ? 0.12 : 0.1,
      isBlade ? -0.44 : -0.34,
    );
    chibi.rightForearm.rotation.set(
      isBlade ? -0.64 : -0.56,
      isBlade ? 0.06 : 0.02,
      isBlade ? -0.18 : -0.16,
    );

    chibi.leftUpperArm.rotation.set(
      0.3,
      -0.1,
      0.24,
    );
    chibi.leftForearm.rotation.set(
      -0.5,
      -0.05,
      0.16,
    );

    chibi.rightHandMount.position.set(0, -0.3, isBlade ? 0.07 : 0.08);
    chibi.rightHandMount.rotation.set(0.02, -0.06, 0.04);
    chibi.rightHand.scale.set(0.98, 0.74, 0.64);
  }

  private updateTargetReadyWeaponPose(
    actor: Actor,
    activeMode: Haven3DGearbladeMode,
    recoil = 0,
    grapplePulse = 0,
  ): void {
    if (!actor.blade) {
      return;
    }

    const frameTime = this.currentFrameTime || performance.now();
    const idleLift = Math.sin(frameTime * 0.006) * 0.012;
    if (activeMode === "blade") {
      this.applySwordGripPose(actor);
      actor.blade.position.y += idleLift;
      return;
    }

    if (activeMode === "launcher") {
      this.applySwordGripPose(actor, 0.96);
      actor.blade.position.y += idleLift;
      actor.blade.position.z -= recoil * 0.05;
      actor.blade.rotation.x -= recoil * 0.05;
      return;
    }

    this.applySwordGripPose(actor, 0.98);
    actor.blade.position.y += idleLift;
    actor.blade.rotation.x += grapplePulse;
  }

  private updateBladeTargetReadyPose(actor: Actor): void {
    if (!actor.blade || !actor.chibi) {
      return;
    }

    const frameTime = this.currentFrameTime || performance.now();
    const idleLift = Math.sin(frameTime * 0.0048) * 0.012;
    const idleRoll = Math.sin(frameTime * 0.0038) * 0.018;
    const hiltPoint = new THREE.Vector3(
      BLADE_TARGET_READY_HILT_X,
      BLADE_TARGET_READY_HILT_Y + idleLift,
      BLADE_TARGET_READY_HILT_Z,
    );
    const bladeRotation = new THREE.Euler(
      BLADE_TARGET_READY_PITCH,
      BLADE_TARGET_READY_YAW,
      BLADE_TARGET_READY_ROLL + idleRoll,
    );
    const gripToBladeRoot = new THREE.Vector3(0, 0, -BLADE_GRIP_CENTER_LOCAL_Z).applyEuler(bladeRotation);

    actor.blade.position.copy(hiltPoint).add(gripToBladeRoot);
    actor.blade.rotation.copy(bladeRotation);
    actor.blade.scale.setScalar(1);
    this.applyBladeTargetReadyArmPose(actor, hiltPoint, bladeRotation);
  }

  private applyBladeTargetReadyArmPose(
    actor: Actor,
    hiltPoint: THREE.Vector3,
    bladeRotation: THREE.Euler,
  ): void {
    const chibi = actor.chibi;
    if (!chibi) {
      return;
    }

    const shoulder = chibi.rightShoulderPivot.position;
    const bladeForward = new THREE.Vector3(0, 0, 1).applyEuler(bladeRotation).normalize();
    const bladeRight = new THREE.Vector3(1, 0, 0).applyEuler(bladeRotation).normalize();
    const wristPoint = hiltPoint.clone()
      .addScaledVector(bladeForward, -0.072)
      .addScaledVector(bladeRight, 0.016 * PLAYER_RIGHT_HAND_LOCAL_X);
    wristPoint.y -= 0.012;

    const shoulderToWrist = wristPoint.clone().sub(shoulder);
    const hiltDistance = Math.max(0.001, shoulderToWrist.length());
    const hiltDirection = shoulderToWrist.clone().normalize();
    const upperArmLength = 0.31;
    const lowerArmLength = THREE.MathUtils.clamp(
      0.295,
      Math.max(0.23, hiltDistance - upperArmLength + 0.012),
      upperArmLength + hiltDistance - 0.012,
    );
    const reachDistance = THREE.MathUtils.clamp(
      hiltDistance,
      Math.abs(upperArmLength - lowerArmLength) + 0.001,
      upperArmLength + lowerArmLength - 0.001,
    );
    const elbowAlongReach = (
      (upperArmLength * upperArmLength) - (lowerArmLength * lowerArmLength) + (reachDistance * reachDistance)
    ) / (2 * reachDistance);
    const elbowBend = Math.sqrt(Math.max(0, (upperArmLength * upperArmLength) - (elbowAlongReach * elbowAlongReach)));
    const elbowBias = new THREE.Vector3(
      0.24 * PLAYER_RIGHT_HAND_LOCAL_X,
      -0.78,
      -0.34,
    );
    const elbowBendDirection = elbowBias
      .addScaledVector(hiltDirection, -elbowBias.dot(hiltDirection))
      .normalize();
    if (elbowBendDirection.lengthSq() < 0.001) {
      elbowBendDirection.set(0, -1, 0);
    }

    const elbow = shoulder.clone()
      .addScaledVector(hiltDirection, elbowAlongReach)
      .addScaledVector(elbowBendDirection, elbowBend);
    const upperDirection = elbow.clone().sub(shoulder).normalize();
    const lowerDirection = wristPoint.clone().sub(elbow).normalize();
    const localDown = new THREE.Vector3(0, -1, 0);
    const shoulderRotation = new THREE.Quaternion().setFromUnitVectors(localDown, upperDirection);
    const localLowerDirection = lowerDirection.clone().applyQuaternion(shoulderRotation.clone().invert()).normalize();

    chibi.rightShoulderPivot.quaternion.copy(shoulderRotation);
    chibi.rightUpperArm.rotation.set(0, 0, 0);
    chibi.rightForearm.position.set(0, -upperArmLength, 0);
    chibi.rightForearm.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(localDown, localLowerDirection));
    chibi.rightHandMount.position.set(0, -lowerArmLength, 0);

    const palmForward = bladeForward.clone();
    const palmUp = lowerDirection.clone().multiplyScalar(-1);
    palmUp.addScaledVector(palmForward, -palmUp.dot(palmForward)).normalize();
    if (palmUp.lengthSq() < 0.001) {
      palmUp.set(0, 1, 0);
    }
    const palmRight = new THREE.Vector3().crossVectors(palmUp, palmForward).normalize();
    const correctedPalmUp = new THREE.Vector3().crossVectors(palmForward, palmRight).normalize();
    const desiredHandRotation = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(palmRight, correctedPalmUp, palmForward),
    );
    const handParentRotation = shoulderRotation.clone().multiply(chibi.rightForearm.quaternion);
    chibi.rightHandMount.quaternion.copy(handParentRotation.invert().multiply(desiredHandRotation));
    chibi.rightHandMount.rotateZ(-0.06 * PLAYER_RIGHT_HAND_LOCAL_X);
    chibi.rightHand.position.set(0, -0.004, 0.058);
    chibi.rightHand.scale.set(0.92, 0.72, 0.62);
  }

  private applyGearbladeTransformBodyPose(actor: Actor, transform: GearbladeTransformSnapshot): void {
    const chibi = actor.chibi;
    if (!chibi) {
      return;
    }

    const pulse = transform.pulse;
    const settle = transform.eased;
    const side = transform.to === "launcher" ? 1 : transform.to === "grapple" ? -1 : 0.55;
    chibi.root.position.y -= 0.012 + (0.02 * pulse);
    chibi.torso.rotation.x = THREE.MathUtils.lerp(chibi.torso.rotation.x, 0.08 + (0.08 * pulse), 0.68);
    chibi.torso.rotation.y = THREE.MathUtils.lerp(chibi.torso.rotation.y, -0.16 * side * pulse, 0.56);
    chibi.torso.rotation.z = THREE.MathUtils.lerp(chibi.torso.rotation.z, 0.08 * side * pulse, 0.48);
    chibi.head.rotation.x = THREE.MathUtils.lerp(chibi.head.rotation.x, 0.02 + (0.04 * pulse), 0.42);
    chibi.head.rotation.y = THREE.MathUtils.lerp(chibi.head.rotation.y, 0.08 * side, 0.34);
    chibi.pelvis.rotation.x = THREE.MathUtils.lerp(chibi.pelvis.rotation.x, 0.08, 0.46);
    chibi.rightShoulderPivot.rotation.set(0, 0, 0);

    chibi.rightUpperArm.rotation.set(
      THREE.MathUtils.lerp(-0.22, 0.34, settle) - (0.32 * pulse),
      THREE.MathUtils.lerp(0.28, 0.1, settle) + (0.1 * pulse),
      THREE.MathUtils.lerp(-0.76, -0.38, settle) - (0.24 * side * pulse),
    );
    chibi.rightForearm.rotation.set(
      THREE.MathUtils.lerp(-0.78, -0.5, settle) - (0.16 * pulse),
      THREE.MathUtils.lerp(0.22, 0.04, settle),
      THREE.MathUtils.lerp(-0.42, -0.16, settle) - (0.16 * side * pulse),
    );
    chibi.leftUpperArm.rotation.set(
      THREE.MathUtils.lerp(-0.18, 0.22, settle) - (0.12 * pulse),
      -0.18 * side,
      THREE.MathUtils.lerp(0.82 * side, 0.28, settle),
    );
    chibi.leftForearm.rotation.set(
      THREE.MathUtils.lerp(-0.72, -0.46, settle),
      0.18 * side,
      THREE.MathUtils.lerp(0.44 * side, 0.12, settle),
    );
    chibi.rightHandMount.position.set(0, -0.29 + (0.035 * pulse), 0.08 + (0.08 * pulse));
  }

  private updateGearbladeTransformWeaponPose(actor: Actor, transform: GearbladeTransformSnapshot): void {
    if (!actor.blade) {
      return;
    }

    const shudder = Math.sin(transform.t * Math.PI * 4);
    actor.blade.position.set(
      0.018 * shudder * transform.pulse,
      -0.02 + (0.04 * transform.pulse),
      0.015 + (0.04 * transform.pulse),
    );
    actor.blade.rotation.set(
      0.02 - (0.12 * transform.pulse),
      0.08 * transform.eased,
      -0.04 + (0.18 * shudder * transform.pulse),
    );
  }

  private mountBladeOnChibiRoot(actor: Actor): void {
    if (!actor.blade || !actor.chibi || actor.blade.parent === actor.chibi.root) {
      return;
    }

    actor.chibi.root.attach(actor.blade);
  }

  private stowBladeOnBack(actor: Actor): void {
    if (!actor.blade) {
      return;
    }

    this.mountBladeOnChibiRoot(actor);
    actor.blade.position.copy(BLADE_BACK_POSITION);
    actor.blade.rotation.copy(BLADE_BACK_ROTATION);
    actor.blade.scale.setScalar(1);
  }

  private mountBladeOnSwingHand(actor: Actor): void {
    if (!actor.blade || !actor.chibi || actor.blade.parent === actor.chibi.rightHandMount) {
      return;
    }

    actor.chibi.rightHandMount.attach(actor.blade);
  }

  private applySwordGripPose(actor: Actor, scale = 1): void {
    if (!actor.blade) {
      return;
    }

    actor.blade.position.set(0, -0.02, 0);
    actor.blade.rotation.set(-Math.PI / 2, 0, 0);
    actor.blade.scale.setScalar(scale);
  }

  private updateHeldBladeSwingPose(
    actor: Actor,
  ): void {
    if (!actor.blade) {
      return;
    }

    this.applySwordGripPose(actor);
  }

  private updateBladeSwingWeaponPose(
    actor: Actor,
    swing: BladeSwingState,
    elapsed: number,
  ): void {
    if (!actor.blade) {
      return;
    }

    const pose = this.getBladeSwingWeaponPoseValues(swing, elapsed);
    const bladeRotation = new THREE.Euler(pose.bladePitch, pose.bladeYaw, pose.bladeRoll);
    const gripToBladeRoot = new THREE.Vector3(0, 0, -BLADE_GRIP_CENTER_LOCAL_Z).applyEuler(bladeRotation);
    actor.blade.position.set(
      pose.hiltX + gripToBladeRoot.x,
      pose.hiltY + gripToBladeRoot.y,
      pose.hiltZ + gripToBladeRoot.z,
    );
    actor.blade.rotation.copy(bladeRotation);
    actor.blade.scale.setScalar(1);
  }

  private getBladeSwingWeaponPoseValues(
    swing: BladeSwingState,
    elapsed: number,
  ): BladeSwingWeaponPose {
    const side = swing.side;
    const verticalFinisher = this.isVerticalBladeFinisher(swing);
    const swingProgress = this.getBladeSwingArcProgress(elapsed);
    const slashPulse = Math.sin(swingProgress * Math.PI);
    const recoveryProgress = smoothstep((elapsed - BLADE_LUNGE_END_MS) / (BLADE_SWING_TOTAL_MS - BLADE_LUNGE_END_MS));
    const handedSide = side * PLAYER_RIGHT_HAND_LOCAL_X;
    if (verticalFinisher) {
      const overheadLift = 1 - smoothstep(swingProgress / 0.42);
      const dropDrive = smoothstep((swingProgress - 0.14) / 0.56);
      return {
        hiltX: THREE.MathUtils.lerp(0.38 * PLAYER_RIGHT_HAND_LOCAL_X, 0.02 * PLAYER_RIGHT_HAND_LOCAL_X, dropDrive) - (0.02 * PLAYER_RIGHT_HAND_LOCAL_X * slashPulse),
        hiltY: 1.14 + (0.24 * overheadLift) - (0.24 * dropDrive) + (0.06 * slashPulse),
        hiltZ: 0.04 + (0.5 * dropDrive) + (0.1 * slashPulse) - (0.06 * recoveryProgress),
        bladePitch: THREE.MathUtils.lerp(-1.06, 0.46, dropDrive) - (0.08 * recoveryProgress),
        bladeYaw: THREE.MathUtils.lerp(0.52 * PLAYER_RIGHT_HAND_LOCAL_X, 0.04 * PLAYER_RIGHT_HAND_LOCAL_X, dropDrive),
        bladeRoll: THREE.MathUtils.lerp(0.76 * PLAYER_RIGHT_HAND_LOCAL_X, 0.06 * PLAYER_RIGHT_HAND_LOCAL_X, dropDrive) - (0.04 * recoveryProgress),
        swingProgress,
        slashPulse,
        rightEdgeExtension: 0,
      };
    }
    const cutSnap = Math.sin(Math.min(1, swingProgress / 0.82) * Math.PI);
    const hiltStartX = side === 1 ? 0.72 * PLAYER_RIGHT_HAND_LOCAL_X : -0.38 * PLAYER_RIGHT_HAND_LOCAL_X;
    const hiltEndX = side === 1 ? -0.36 * PLAYER_RIGHT_HAND_LOCAL_X : 0.66 * PLAYER_RIGHT_HAND_LOCAL_X;
    const wristFollow = (0.16 * handedSide * slashPulse) - (0.08 * handedSide * recoveryProgress);
    const rightEdgeExtension = side === 1
      ? 1 - smoothstep(swingProgress / 0.34)
      : smoothstep((swingProgress - 0.66) / 0.34);
    const rightEdgeHiltOffsetX = 0.235 * PLAYER_RIGHT_HAND_LOCAL_X * rightEdgeExtension;

    return {
      hiltX: THREE.MathUtils.lerp(hiltStartX, hiltEndX, swingProgress) - (0.045 * handedSide * slashPulse) + rightEdgeHiltOffsetX,
      hiltY: 0.97 + (0.105 * slashPulse) - (0.02 * recoveryProgress),
      hiltZ: 0.28 + (0.25 * cutSnap) - (0.065 * recoveryProgress),
      bladePitch: -0.08 + (0.095 * slashPulse) - (0.025 * recoveryProgress),
      bladeYaw: THREE.MathUtils.lerp(1.28 * handedSide, -1.14 * handedSide, swingProgress) + wristFollow,
      bladeRoll: THREE.MathUtils.lerp(-0.18 * handedSide, 0.18 * handedSide, swingProgress) - (0.06 * handedSide * recoveryProgress),
      swingProgress,
      slashPulse,
      rightEdgeExtension,
    };
  }

  private applyBladeSwingArmPose(
    actor: Actor,
    swing: BladeSwingState,
    elapsed: number,
    windup: number,
    strike: number,
    recovery: number,
  ): void {
    const chibi = actor.chibi;
    if (!chibi) {
      return;
    }

    const side = swing.side;
    const verticalFinisher = this.isVerticalBladeFinisher(swing);
    const handedSide = side * PLAYER_RIGHT_HAND_LOCAL_X;
    const weaponPose = this.getBladeSwingWeaponPoseValues(swing, elapsed);
    const swingProgress = weaponPose.swingProgress;
    const slashPulse = weaponPose.slashPulse;
    const cutCommit = Math.sin(Math.min(1, swingProgress / 0.72) * Math.PI);
    const releaseDrive = smoothstep((swingProgress - 0.18) / 0.54);
    const followThrough = smoothstep((swingProgress - 0.62) / 0.38);
    const overheadLift = verticalFinisher ? 1 - smoothstep(swingProgress / 0.42) : 0;
    const verticalDrop = verticalFinisher ? smoothstep((swingProgress - 0.14) / 0.56) : 0;
    const startupBlend = smoothstep(elapsed / 42);
    const coil = (1 - releaseDrive) * windup;
    const bodyAmount = startupBlend * (1 - (0.32 * recovery));
    const bodyTwist = (
      verticalFinisher
        ? THREE.MathUtils.lerp(-0.18 * PLAYER_RIGHT_HAND_LOCAL_X, 0.1 * PLAYER_RIGHT_HAND_LOCAL_X, verticalDrop)
        : THREE.MathUtils.lerp(-0.62 * handedSide, 0.74 * handedSide, releaseDrive)
    ) * bodyAmount;
    const recoveryEase = THREE.MathUtils.clamp(recovery, 0, 1);
    const strikePulse = Math.sin(THREE.MathUtils.clamp(strike, 0, 1) * Math.PI);
    const extensionDrive = THREE.MathUtils.clamp(
      (0.72 * releaseDrive) + (0.32 * strikePulse) + (0.22 * followThrough) - (0.18 * recoveryEase),
      0,
      1,
    );
    const armExtensionDrive = verticalFinisher
      ? THREE.MathUtils.clamp(0.42 + (0.34 * verticalDrop) + (0.18 * followThrough), 0, 1)
      : Math.max(extensionDrive, weaponPose.rightEdgeExtension);
    const addRotation = (node: THREE.Object3D, x: number, y: number, z: number): void => {
      node.rotation.x += x;
      node.rotation.y += y;
      node.rotation.z += z;
    };
    const blendRotation = (node: THREE.Object3D, x: number, y: number, z: number, amount: number): void => {
      node.rotation.set(
        THREE.MathUtils.lerp(node.rotation.x, x, amount),
        THREE.MathUtils.lerp(node.rotation.y, y, amount),
        THREE.MathUtils.lerp(node.rotation.z, z, amount),
      );
    };

    const sideWeightShift = (
      verticalFinisher
        ? ((-0.014 * handedSide * coil) + (0.018 * handedSide * followThrough))
        : ((-0.038 * handedSide * coil) + (0.064 * handedSide * slashPulse) + (0.02 * handedSide * followThrough))
    ) * bodyAmount;
    const forwardDrive = (
      verticalFinisher
        ? ((0.012 * coil) + (0.094 * cutCommit) - (0.022 * recoveryEase))
        : ((0.018 * coil) + (0.06 * cutCommit) - (0.018 * recoveryEase))
    ) * bodyAmount;
    const compression = (
      verticalFinisher
        ? (0.024 + (0.042 * verticalDrop) + (0.022 * strikePulse))
        : (0.018 + (0.034 * slashPulse) + (0.018 * strikePulse))
    ) * bodyAmount;
    const sideLean = (
      verticalFinisher
        ? ((0.05 * handedSide * coil) - (0.04 * handedSide * verticalDrop) + (0.02 * handedSide * followThrough))
        : ((0.12 * handedSide * coil) - (0.2 * handedSide * slashPulse) + (0.07 * handedSide * followThrough))
    ) * bodyAmount;

    chibi.root.position.x += sideWeightShift;
    chibi.root.position.y -= compression;
    chibi.root.position.z += forwardDrive;
    addRotation(
      chibi.root,
      (
        verticalFinisher
          ? ((0.08 * coil) + (0.13 * cutCommit) - (0.02 * followThrough))
          : ((0.045 * coil) + (0.096 * cutCommit) - (0.03 * followThrough))
      ) * bodyAmount,
      bodyTwist * (verticalFinisher ? 0.12 : 0.22),
      sideLean * 0.34,
    );
    addRotation(
      chibi.torso,
      (
        verticalFinisher
          ? ((0.12 * coil) + (0.26 * cutCommit) - (0.032 * followThrough) - (0.08 * overheadLift))
          : ((0.07 * coil) + (0.16 * cutCommit) - (0.048 * followThrough))
      ) * bodyAmount,
      bodyTwist * (verticalFinisher ? 0.44 : 0.92),
      sideLean,
    );
    addRotation(
      chibi.pelvis,
      (
        verticalFinisher
          ? ((0.036 * coil) + (0.05 * verticalDrop))
          : ((0.042 * coil) + (0.074 * slashPulse))
      ) * bodyAmount,
      bodyTwist * (verticalFinisher ? 0.2 : 0.46),
      -sideLean * 0.62,
    );
    addRotation(
      chibi.head,
      (
        verticalFinisher
          ? ((-0.016 * overheadLift) - (0.08 * verticalDrop) + (0.05 * followThrough))
          : ((0.024 * coil) - (0.062 * slashPulse) + (0.036 * followThrough))
      ) * bodyAmount,
      (-bodyTwist * (verticalFinisher ? 0.16 : 0.42)) + (
        verticalFinisher
          ? 0.018 * PLAYER_RIGHT_HAND_LOCAL_X * bodyAmount
          : 0.06 * handedSide * slashPulse * bodyAmount
      ),
      -sideLean * 0.44,
    );

    const shoulder = chibi.rightShoulderPivot.position;
    const gripPoint = new THREE.Vector3(weaponPose.hiltX, weaponPose.hiltY, weaponPose.hiltZ);
    const bladeRotation = new THREE.Euler(weaponPose.bladePitch, weaponPose.bladeYaw, weaponPose.bladeRoll);
    const bladeForward = new THREE.Vector3(0, 0, 1).applyEuler(bladeRotation).normalize();
    const bladeRight = new THREE.Vector3(1, 0, 0).applyEuler(bladeRotation).normalize();
    const wristPoint = gripPoint.clone()
      .addScaledVector(bladeForward, -BLADE_SWING_WRIST_TO_GRIP)
      .addScaledVector(
        bladeRight,
        verticalFinisher
          ? 0.004 * PLAYER_RIGHT_HAND_LOCAL_X * (1 - verticalDrop)
          : 0.012 * handedSide * (1 - slashPulse),
      );
    wristPoint.y -= BLADE_SWING_WRIST_DROP_FROM_GRIP;
    const shoulderToWrist = wristPoint.clone().sub(shoulder);
    const hiltDistance = Math.max(0.001, shoulderToWrist.length());
    const hiltDirection = shoulderToWrist.clone().normalize();
    const upperArmLength = THREE.MathUtils.lerp(0.31, 0.328, armExtensionDrive * 0.45);
    const armReachSlack = verticalFinisher
      ? THREE.MathUtils.lerp(0.016, 0.006, verticalDrop)
      : THREE.MathUtils.lerp(0.012, 0.003, weaponPose.rightEdgeExtension);
    const baseLowerArmLength = verticalFinisher
      ? THREE.MathUtils.lerp(0.31 + (0.03 * overheadLift), 0.348 + (0.02 * followThrough), verticalDrop)
      : THREE.MathUtils.lerp(
        0.29 + (0.055 * slashPulse) + (0.05 * swingProgress),
        0.325 + (0.035 * slashPulse) + (0.045 * followThrough),
        extensionDrive,
      );
    const straightLowerArmLength = Math.max(0.22, hiltDistance - upperArmLength + (armReachSlack * 1.35));
    const relaxedLowerArmLength = verticalFinisher
      ? THREE.MathUtils.lerp(baseLowerArmLength, straightLowerArmLength, 0.82 + (0.12 * verticalDrop))
      : THREE.MathUtils.lerp(
        baseLowerArmLength,
        straightLowerArmLength,
        weaponPose.rightEdgeExtension * 0.98,
      );
    const lowerArmLength = THREE.MathUtils.clamp(
      relaxedLowerArmLength,
      Math.max(0.22, hiltDistance - upperArmLength + armReachSlack),
      upperArmLength + hiltDistance - armReachSlack,
    );
    const reachDistance = THREE.MathUtils.clamp(
      hiltDistance,
      Math.abs(upperArmLength - lowerArmLength) + 0.001,
      upperArmLength + lowerArmLength - armReachSlack,
    );
    const elbowAlongReach = (
      (upperArmLength * upperArmLength) - (lowerArmLength * lowerArmLength) + (reachDistance * reachDistance)
    ) / (2 * reachDistance);
    const elbowBend = Math.sqrt(Math.max(0, (upperArmLength * upperArmLength) - (elbowAlongReach * elbowAlongReach)));
    const elbowBias = verticalFinisher
      ? new THREE.Vector3(
        THREE.MathUtils.lerp(0.22 * PLAYER_RIGHT_HAND_LOCAL_X, 0.02 * PLAYER_RIGHT_HAND_LOCAL_X, verticalDrop),
        THREE.MathUtils.lerp(0.24, -0.12, verticalDrop),
        THREE.MathUtils.lerp(-0.78, -0.1, verticalDrop),
      )
      : new THREE.Vector3(
        THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(0.24 * handedSide, -0.12 * handedSide, swingProgress) + (0.04 * handedSide * extensionDrive),
          -0.008 * PLAYER_RIGHT_HAND_LOCAL_X,
          weaponPose.rightEdgeExtension,
        ),
        THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(-0.88, -0.5, extensionDrive),
          -0.06,
          weaponPose.rightEdgeExtension,
        ),
        THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(-0.4 - (0.24 * slashPulse), -0.16 - (0.08 * followThrough), extensionDrive),
          -0.012,
          weaponPose.rightEdgeExtension,
        ),
      );
    const elbowBendDirection = elbowBias
      .addScaledVector(hiltDirection, -elbowBias.dot(hiltDirection))
      .normalize();
    if (elbowBendDirection.lengthSq() < 0.001) {
      elbowBendDirection.set(0, -1, 0);
    }
    const elbow = shoulder.clone()
      .addScaledVector(hiltDirection, elbowAlongReach)
      .addScaledVector(elbowBendDirection, elbowBend);
    const upperDirection = elbow.clone().sub(shoulder).normalize();
    const lowerDirection = wristPoint.clone().sub(elbow).normalize();
    const localDown = new THREE.Vector3(0, -1, 0);
    const shoulderRotation = new THREE.Quaternion().setFromUnitVectors(localDown, upperDirection);
    const localLowerDirection = lowerDirection.clone().applyQuaternion(shoulderRotation.clone().invert()).normalize();
    chibi.rightShoulderPivot.quaternion.copy(shoulderRotation);
    chibi.rightUpperArm.rotation.set(0, 0, 0);
    chibi.rightForearm.position.set(0, -upperArmLength, 0);
    chibi.rightForearm.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(localDown, localLowerDirection));
    chibi.rightHandMount.position.set(0, -lowerArmLength, 0);
    const palmForward = bladeForward.clone().normalize();
    const palmUp = lowerDirection.clone().multiplyScalar(-1);
    palmUp.addScaledVector(palmForward, -palmUp.dot(palmForward)).normalize();
    if (palmUp.lengthSq() < 0.001) {
      palmUp.set(0, 1, 0);
    }
    const palmRight = new THREE.Vector3().crossVectors(palmUp, palmForward).normalize();
    const correctedPalmUp = new THREE.Vector3().crossVectors(palmForward, palmRight).normalize();
    const desiredHandRotation = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(palmRight, correctedPalmUp, palmForward),
    );
    const handParentRotation = shoulderRotation.clone().multiply(chibi.rightForearm.quaternion);
    chibi.rightHandMount.quaternion.copy(handParentRotation.invert().multiply(desiredHandRotation));
    chibi.rightHandMount.rotateZ(
      verticalFinisher
        ? (-0.08 * PLAYER_RIGHT_HAND_LOCAL_X * (1 - recoveryEase)) + (0.02 * PLAYER_RIGHT_HAND_LOCAL_X * overheadLift)
        : (-0.12 * handedSide * (1 - recoveryEase)) + (0.04 * handedSide * slashPulse),
    );
    chibi.rightHand.position.set(0, -0.006, BLADE_SWING_WRIST_TO_GRIP * 0.82);
    chibi.rightHand.scale.set(0.92, 0.72, 0.62);

    const counterArmAmount = verticalFinisher
      ? THREE.MathUtils.clamp(0.58 + (0.2 * overheadLift) + (0.16 * followThrough), 0.58, 0.88)
      : THREE.MathUtils.clamp(0.5 + (0.3 * slashPulse) + (0.2 * coil), 0.5, 0.9);
    if (verticalFinisher) {
      blendRotation(
        chibi.leftUpperArm,
        chibi.leftUpperArm.rotation.x + ((0.18 * overheadLift) + (0.32 * verticalDrop) + (0.12 * followThrough)) * bodyAmount,
        chibi.leftUpperArm.rotation.y + ((-0.08 * PLAYER_RIGHT_HAND_LOCAL_X * overheadLift) + (0.05 * PLAYER_RIGHT_HAND_LOCAL_X * followThrough)) * bodyAmount,
        chibi.leftUpperArm.rotation.z + ((0.1 * PLAYER_RIGHT_HAND_LOCAL_X * overheadLift) - (0.16 * PLAYER_RIGHT_HAND_LOCAL_X * verticalDrop)) * bodyAmount,
        counterArmAmount,
      );
      blendRotation(
        chibi.leftForearm,
        chibi.leftForearm.rotation.x + ((-0.08 * overheadLift) - (0.22 * verticalDrop) + (0.12 * followThrough)) * bodyAmount,
        chibi.leftForearm.rotation.y + (0.04 * PLAYER_RIGHT_HAND_LOCAL_X * verticalDrop * bodyAmount),
        chibi.leftForearm.rotation.z + ((0.06 * PLAYER_RIGHT_HAND_LOCAL_X * overheadLift) - (0.12 * PLAYER_RIGHT_HAND_LOCAL_X * verticalDrop)) * bodyAmount,
        counterArmAmount,
      );
    } else {
      blendRotation(
        chibi.leftUpperArm,
        chibi.leftUpperArm.rotation.x + ((-0.3 * coil) + (0.62 * slashPulse) + (0.22 * followThrough)) * bodyAmount,
        chibi.leftUpperArm.rotation.y + ((-0.34 * handedSide * coil) + (0.18 * handedSide * slashPulse)) * bodyAmount,
        chibi.leftUpperArm.rotation.z + ((0.52 * handedSide * coil) - (0.68 * handedSide * slashPulse)) * bodyAmount,
        counterArmAmount,
      );
      blendRotation(
        chibi.leftForearm,
        chibi.leftForearm.rotation.x + ((-0.24 * coil) - (0.36 * slashPulse) + (0.18 * followThrough)) * bodyAmount,
        chibi.leftForearm.rotation.y + (0.12 * handedSide * slashPulse * bodyAmount),
        chibi.leftForearm.rotation.z + ((0.28 * handedSide * coil) - (0.34 * handedSide * slashPulse)) * bodyAmount,
        counterArmAmount,
      );
    }

    const leftLeads = handedSide === 1;
    const stance = bodyAmount * (0.68 + (0.38 * slashPulse) + (0.2 * coil));
    const applyLegDrive = (
      thigh: THREE.Object3D,
      shin: THREE.Object3D,
      foot: THREE.Object3D,
      outwardSign: number,
      isLead: boolean,
    ): void => {
      if (isLead) {
        addRotation(
          thigh,
          (0.26 + (0.12 * slashPulse) + (0.08 * coil)) * stance,
          (0.12 * handedSide + (0.06 * handedSide * slashPulse)) * stance,
          outwardSign * (0.22 + (0.08 * slashPulse)) * stance,
        );
        addRotation(shin, (0.26 + (0.12 * strikePulse)) * stance, 0, outwardSign * -0.07 * stance);
        addRotation(foot, (-0.16 - (0.07 * strikePulse)) * stance, 0, outwardSign * 0.1 * stance);
        return;
      }

      addRotation(
        thigh,
        (-0.2 - (0.11 * slashPulse) + (0.04 * coil)) * stance,
        (-0.1 * handedSide + (0.05 * handedSide * followThrough)) * stance,
        outwardSign * (0.08 + (0.06 * coil)) * stance,
      );
      addRotation(shin, (0.44 + (0.18 * slashPulse)) * stance, 0, outwardSign * 0.04 * stance);
      addRotation(foot, (0.18 + (0.07 * slashPulse)) * stance, 0, outwardSign * -0.07 * stance);
    };

    applyLegDrive(chibi.leftThigh, chibi.leftShin, chibi.leftFoot, -1, leftLeads);
    applyLegDrive(chibi.rightThigh, chibi.rightShin, chibi.rightFoot, 1, !leftLeads);
  }

  private updatePlayerWeaponForm(
    actor: Actor,
    activeMode: Haven3DGearbladeMode | null,
    transform: GearbladeTransformSnapshot | null = null,
  ): void {
    if (actor.blade) {
      actor.blade.visible = Boolean(activeMode);
      actor.blade.scale.setScalar(1 + ((transform?.pulse ?? 0) * 0.05));
    }
    if (actor.weaponBladeForm) {
      actor.weaponBladeForm.visible = Boolean(activeMode) && activeMode !== "launcher";
    }
    if (actor.weaponLauncherForm) {
      actor.weaponLauncherForm.visible = activeMode === "launcher";
    }
  }

  private syncCompanionActor(): void {
    const companion = this.options.getCompanion?.() ?? null;
    if (!companion) {
      if (this.companionActor) {
        this.dynamicGroup.remove(this.companionActor.group);
        disposeObject(this.companionActor.group);
        this.companionActor = null;
      }
      this.companionVerticalState = null;
      return;
    }

    if (!this.companionActor) {
      this.companionActor = this.createSableActor();
    }

    const actor = this.companionActor;
    actor.group.visible = true;
    const companionPoint = { x: companion.x, y: companion.y };
    const vertical = this.updateCompanionVertical(companion);
    const world = fieldToHavenWorld(this.options.map, companionPoint, vertical.worldElevation + 0.035);
    actor.group.position.set(world.x, world.y, world.z);
    const lookDirection = companion.target
      ? { x: companion.target.x - companion.x, y: companion.target.y - companion.y }
      : null;
    this.updateSableMotion(actor, companion, lookDirection, !vertical.grounded, vertical);
  }

  private syncNpcActors(): void {
    const npcs = this.options.getNpcs();
    const npcIds = new Set(npcs.map((npc) => npc.id));
    Array.from(this.npcActors.entries()).forEach(([id, actor]) => {
      if (!npcIds.has(id)) {
        this.dynamicGroup.remove(actor.group);
        disposeObject(actor.group);
        this.npcActors.delete(id);
      }
    });

    npcs.forEach((npc) => {
      let actor = this.npcActors.get(npc.id);
      if (!actor) {
        actor = this.createNpcActor(npc);
        this.npcActors.set(npc.id, actor);
      }

      const npcPoint = { x: npc.x, y: npc.y };
      const world = fieldToHavenWorld(this.options.map, npcPoint, this.getGroundElevationAtPoint(npcPoint) + 0.04);
      actor.group.position.set(world.x, world.y, world.z);
      this.updateActorMotion(actor, npc.x, npc.y, 0.9, this.getRotationForFacing(npc.direction));
      this.updateActorTargetRing(actor, "npc", npc.id);
    });
  }

  private syncEnemyActors(): void {
    const enemies = this.options.getEnemies().filter((enemy) => enemy.hp > 0);
    const enemyIds = new Set(enemies.map((enemy) => enemy.id));
    Array.from(this.enemyActors.entries()).forEach(([id, actor]) => {
      if (!enemyIds.has(id)) {
        this.dynamicGroup.remove(actor.group);
        disposeObject(actor.group);
        this.enemyActors.delete(id);
        this.enemyHpSnapshot.delete(id);
        this.enemyHitReactions.delete(id);
      }
    });

    enemies.forEach((enemy) => {
      let actor = this.enemyActors.get(enemy.id);
      if (!actor) {
        actor = this.createEnemyActor(enemy);
        this.enemyActors.set(enemy.id, actor);
      }

      const enemyPoint = { x: enemy.x, y: enemy.y };
      const world = fieldToHavenWorld(this.options.map, enemyPoint, this.getGroundElevationAtPoint(enemyPoint) + 0.04);
      const widthScale = Math.max(0.85, enemy.width / 36);
      const heightScale = Math.max(0.85, enemy.height / 36);
      const previousHp = this.enemyHpSnapshot.get(enemy.id);
      if (previousHp !== undefined && enemy.hp < previousHp) {
        this.enemyHitReactions.set(enemy.id, {
          startedAt: this.currentFrameTime || performance.now(),
          durationMs: ENEMY_HIT_REACTION_MS,
        });
        this.spawnHitSpark(
          { x: enemy.x, y: enemy.y },
          0xf2b04d,
          this.getBladeImpactSparkDirection(enemyPoint),
        );
      }
      this.enemyHpSnapshot.set(enemy.id, enemy.hp);
      actor.group.position.set(world.x, world.y, world.z);
      const attackDirection = enemy.attackDirectionX !== undefined && enemy.attackDirectionY !== undefined
        ? { x: enemy.attackDirectionX, y: enemy.attackDirectionY }
        : null;
      this.updateActorMotion(
        actor,
        enemy.x,
        enemy.y,
        enemy.attackState ? 1.22 : 0.96,
        this.getRotationForFacing(enemy.facing),
        enemy.attackState ? attackDirection : null,
      );
      this.applyEnemyAttackPose(actor, enemy);
      this.updateEnemyHitReaction(actor, enemy.id, widthScale, heightScale);
      this.updateEnemyDefenseVisuals(actor, enemy);
      this.updateEnemyTelegraph(actor, enemy);
      this.updateActorTargetRing(actor, "enemy", enemy.id);
    });
  }

  private applyEnemyAttackPose(actor: Actor, enemy: FieldEnemy): void {
    const chibi = actor.chibi;
    if (!chibi || (enemy.attackState !== "windup" && enemy.attackState !== "recovery")) {
      return;
    }

    const currentTime = this.currentFrameTime || performance.now();
    const profile = getHaven3DEnemyAttackProfile(enemy);
    const elapsed = Math.max(0, currentTime - Number(enemy.attackStartedAt ?? currentTime));
    const windup = enemy.attackState === "windup"
      ? smoothstep(THREE.MathUtils.clamp(elapsed / Math.max(1, profile.windupMs), 0, 1))
      : 0;
    const recovery = enemy.attackState === "recovery"
      ? 1 - smoothstep(THREE.MathUtils.clamp(elapsed / Math.max(1, profile.recoveryMs), 0, 1))
      : 0;
    const releasePulse = enemy.attackState === "recovery" ? Math.sin(recovery * Math.PI) : 0;
    const lumberSway = Math.sin(currentTime * 0.007 + enemy.x * 0.025 + enemy.y * 0.014);
    const isShot = profile.style === "shot";
    const isShield = profile.style === "shield_bash";
    const heavy = isShield ? 1.35 : profile.style === "lunge" ? 1.16 : 1;

    chibi.root.position.y += (-0.055 * windup * heavy) + (0.075 * releasePulse);
    chibi.root.rotation.x += isShot
      ? (-0.08 * windup) + (0.12 * releasePulse)
      : (-0.2 * windup * heavy) + (0.38 * releasePulse * heavy);
    chibi.root.rotation.z += lumberSway * 0.08 * windup * heavy;
    chibi.torso.rotation.x += isShot
      ? (-0.04 * windup) + (0.1 * releasePulse)
      : (-0.18 * windup * heavy) + (0.44 * releasePulse * heavy);
    chibi.torso.rotation.z += lumberSway * 0.12 * windup;
    chibi.head.rotation.x += isShot
      ? -0.08 * windup
      : -0.13 * windup + 0.08 * releasePulse;

    if (isShot) {
      const aim = Math.max(windup, recovery * 0.72);
      chibi.leftUpperArm.rotation.set(
        THREE.MathUtils.lerp(chibi.leftUpperArm.rotation.x, 1.28, aim),
        THREE.MathUtils.lerp(chibi.leftUpperArm.rotation.y, 0.42, aim),
        THREE.MathUtils.lerp(chibi.leftUpperArm.rotation.z, -0.36, aim),
      );
      chibi.rightUpperArm.rotation.set(
        THREE.MathUtils.lerp(chibi.rightUpperArm.rotation.x, 1.34, aim),
        THREE.MathUtils.lerp(chibi.rightUpperArm.rotation.y, -0.4, aim),
        THREE.MathUtils.lerp(chibi.rightUpperArm.rotation.z, 0.36, aim),
      );
      chibi.leftForearm.rotation.set(
        THREE.MathUtils.lerp(chibi.leftForearm.rotation.x, -0.24, aim),
        THREE.MathUtils.lerp(chibi.leftForearm.rotation.y, 0.18, aim),
        THREE.MathUtils.lerp(chibi.leftForearm.rotation.z, -0.06, aim),
      );
      chibi.rightForearm.rotation.set(
        THREE.MathUtils.lerp(chibi.rightForearm.rotation.x, -0.18, aim),
        THREE.MathUtils.lerp(chibi.rightForearm.rotation.y, -0.18, aim),
        THREE.MathUtils.lerp(chibi.rightForearm.rotation.z, 0.06, aim),
      );
      chibi.rightHandMount.position.z += 0.12 * aim;
      chibi.rightHand.scale.setScalar(0.9 + (0.28 * windup) + (0.46 * releasePulse));
      return;
    }

    const windupReach = windup * heavy;
    const strikeReach = Math.max(recovery, releasePulse) * heavy;
    chibi.leftUpperArm.rotation.x += (-0.72 * windupReach) + (0.92 * strikeReach);
    chibi.rightUpperArm.rotation.x += (-0.82 * windupReach) + (1.04 * strikeReach);
    chibi.leftUpperArm.rotation.z += -0.48 * windupReach;
    chibi.rightUpperArm.rotation.z += 0.48 * windupReach;
    chibi.leftForearm.rotation.x += (-0.32 * windupReach) + (0.34 * strikeReach);
    chibi.rightForearm.rotation.x += (-0.36 * windupReach) + (0.38 * strikeReach);
    chibi.leftThigh.rotation.x += 0.16 * windupReach;
    chibi.rightThigh.rotation.x += 0.22 * windupReach;
    chibi.leftShin.rotation.x += 0.18 * windupReach;
    chibi.rightShin.rotation.x += 0.2 * windupReach;
  }

  private updateEnemyDefenseVisuals(actor: Actor, enemy: FieldEnemy): void {
    const defense = getHaven3DEnemyDefense(enemy);
    const broken = isHaven3DEnemyDefenseBroken(enemy);
    if (actor.defenseShield) {
      actor.defenseShield.visible = defense === "shield" && !broken;
      actor.defenseShield.rotation.y += 0.012;
    }
    if (actor.defenseArmor) {
      actor.defenseArmor.visible = defense === "armor" && !broken;
    }
  }

  private updateEnemyHitReaction(actor: Actor, enemyId: string, widthScale: number, heightScale: number): void {
    const reaction = this.enemyHitReactions.get(enemyId);
    const elapsed = reaction ? (this.currentFrameTime || performance.now()) - reaction.startedAt : Number.POSITIVE_INFINITY;
    const t = reaction ? THREE.MathUtils.clamp(elapsed / reaction.durationMs, 0, 1) : 1;
    const pulse = reaction ? Math.sin((1 - t) * Math.PI) : 0;

    actor.group.scale.set(
      widthScale * (1 + pulse * 0.18),
      heightScale * (1 - pulse * 0.08),
      widthScale * (1 + pulse * 0.18),
    );

    for (const entry of actor.hitMaterials ?? []) {
      if (reaction && t < 1) {
        entry.material.emissive.setHex(0xffc38a);
        entry.material.emissiveIntensity = entry.baseIntensity + (1 - t) * 1.6;
      } else {
        entry.material.emissive.setHex(entry.baseEmissive);
        entry.material.emissiveIntensity = entry.baseIntensity;
      }
    }

    if (reaction && t >= 1) {
      this.enemyHitReactions.delete(enemyId);
    }
  }

  private updateEnemyTelegraph(actor: Actor, enemy: FieldEnemy): void {
    if (!actor.telegraph) {
      return;
    }

    const avatars = (["P1", "P2"] as PlayerId[])
      .map((playerId) => this.isPlayerControllable(playerId) ? this.options.getPlayerAvatar(playerId) : null)
      .filter((entry): entry is FieldAvatarView => Boolean(entry));
    if (avatars.length <= 0) {
      actor.telegraph.visible = false;
      return;
    }

    const currentTime = this.currentFrameTime || performance.now();
    const profile = getHaven3DEnemyAttackProfile(enemy);
    const isWindup = enemy.attackState === "windup";
    const isRecovery = enemy.attackState === "recovery";
    const distance = avatars.reduce((best, avatar) => Math.min(best, Math.hypot(enemy.x - avatar.x, enemy.y - avatar.y)), Number.POSITIVE_INFINITY);
    const isLocked = this.isTargetLockedByAnyPlayer("enemy", enemy.id);
    const telegraphRange = Math.max(ENEMY_TELEGRAPH_RANGE_PX, profile.triggerRange);
    const dangerRange = Math.min(ENEMY_DANGER_RANGE_PX, profile.triggerRange * 0.62);
    const shouldShow = isWindup || isRecovery || distance <= telegraphRange || (isLocked && distance <= telegraphRange * 1.35);
    actor.telegraph.visible = shouldShow;
    if (!shouldShow) {
      return;
    }

    const danger = isWindup
      ? THREE.MathUtils.clamp((currentTime - Number(enemy.attackStartedAt ?? currentTime)) / profile.windupMs, 0, 1)
      : isRecovery
        ? 1 - THREE.MathUtils.clamp((currentTime - Number(enemy.attackStartedAt ?? currentTime)) / profile.recoveryMs, 0, 1)
        : 1 - THREE.MathUtils.clamp((distance - dangerRange) / Math.max(1, telegraphRange - dangerRange), 0, 1);
    const pulse = (Math.sin(currentTime * 0.015) + 1) * 0.5;
    const profileLength = THREE.MathUtils.clamp(profile.reach / 92, 0.95, 4.4);
    const widthScale = THREE.MathUtils.clamp(profile.halfWidth / 34, 0.52, 1.65);
    const attackLength = isWindup || isRecovery
      ? profileLength * (0.78 + danger * 0.32)
      : profileLength * (0.48 + danger * 0.22);
    actor.telegraph.position.z = isWindup || isRecovery ? 0.98 : 0.88;
    actor.telegraph.scale.set((0.72 + danger * 0.38 + pulse * 0.05) * widthScale, 1, attackLength);
    actor.telegraph.traverse((node) => {
      if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshBasicMaterial) {
        node.material.opacity = isRecovery
          ? Math.max(0.05, danger * 0.18)
          : 0.08 + danger * 0.38 + pulse * 0.08;
        node.material.color.setHex(profile.style === "shot" ? 0xffb23e : isWindup ? 0xff3d2e : 0xff7a3e);
      }
    });
  }

  private updateActorTargetRing(actor: Actor, kind: Haven3DTargetKind, id: string): void {
    if (!actor.targetRing) {
      return;
    }
    actor.targetRing.visible = this.isTargetLockedByAnyPlayer(kind, id);
  }

  private getTargetCandidates(playerId: PlayerId = "P1"): Haven3DTargetCandidate[] {
    const avatar = this.options.getPlayerAvatar(playerId);
    return createHaven3DTargetCandidates(
      avatar,
      this.options.getNpcs(),
      this.options.getEnemies(),
      this.options.getLootOrbs?.() ?? [],
    );
  }

  private getLockedTargetCandidate(playerId: PlayerId = "P1"): Haven3DTargetCandidate | null {
    const targetLock = this.getPlayerTargetLock(playerId);
    if (!targetLock) {
      return null;
    }

    const target = this.getTargetCandidates(playerId).find((candidate) => candidate.key === targetLock.key) ?? null;
    if (!target || target.distance > TARGET_LOCK_BREAK_DISTANCE_PX) {
      this.setPlayerTargetLock(playerId, null);
      this.setPlayerTargetOrbitYawOffset(playerId, 0);
      return null;
    }
    return target;
  }

  private selectNextTarget(playerOrReverse: PlayerId | boolean = "P1", maybeReverse = false): void {
    const playerId: PlayerId = typeof playerOrReverse === "boolean" ? "P1" : playerOrReverse;
    const reverse = typeof playerOrReverse === "boolean" ? playerOrReverse : maybeReverse;
    if (!this.isPlayerControllable(playerId)) {
      return;
    }
    const targets = this.getTargetCandidates(playerId);
    this.setPlayerTargetLock(playerId, selectNextHaven3DTarget(targets, this.getPlayerTargetLock(playerId), reverse));
    this.setPlayerTargetOrbitYawOffset(playerId, 0);
    if (playerId === "P1") {
      this.cameraYawPan = null;
    } else {
      this.splitCameraYawPans.P2 = null;
    }
  }

  private snapCameraToPlayerFacing(playerId: PlayerId = "P1"): void {
    const avatar = this.options.getPlayerAvatar(playerId);
    if (!avatar) {
      return;
    }

    this.setPlayerTargetLock(playerId, null);
    this.setPlayerTargetOrbitYawOffset(playerId, 0);
    this.mouseDx = 0;
    this.mouseDy = 0;
    const pan: CameraYawPan = {
      startedAt: this.currentFrameTime || performance.now(),
      durationMs: CAMERA_FORWARD_PAN_DURATION_MS,
      fromYaw: playerId === "P1" ? this.yaw : this.splitCameraStates[playerId].yaw,
      toYaw: getCameraYawForFacing(avatar.facing),
    };
    if (playerId === "P1") {
      this.cameraYawPan = pan;
    } else {
      this.splitCameraYawPans[playerId] = pan;
    }
  }

  private getRotationForFacing(facing: PlayerAvatar["facing"]): number {
    switch (facing) {
      case "north":
        return Math.PI;
      case "south":
        return 0;
      case "east":
        return Math.PI / 2;
      case "west":
        return -Math.PI / 2;
      default:
        return 0;
    }
  }

  private updateModeHud(): void {
    const splitActive = this.getEffectiveCameraMode() === "split";
    const hybridBehaviorActive = this.cameraBehavior === "hybrid" && this.options.isPlayerActive("P2");
    const sharedUi = document.querySelector<HTMLElement>("[data-haven3d-shared-ui]");
    const splitUi = document.querySelector<HTMLElement>("[data-haven3d-split-ui]");
    if (sharedUi) {
      sharedUi.hidden = splitActive;
    }
    if (splitUi) {
      splitUi.hidden = !splitActive;
    }
    document.querySelectorAll<HTMLElement>("[data-haven3d-coop-camera-label]").forEach((label) => {
      label.textContent = hybridBehaviorActive ? "Hybrid View" : "Shared View";
    });
    document.querySelectorAll<HTMLButtonElement>("[data-haven3d-coop-action='toggle-split']").forEach((button) => {
      button.classList.toggle("haven3d-coop-control--active", hybridBehaviorActive);
      button.setAttribute("aria-pressed", hybridBehaviorActive ? "true" : "false");
    });

    document.querySelectorAll<HTMLElement>("[data-gearblade-mode-selector]").forEach((selector) => {
      const playerId = selector.closest<HTMLElement>("[data-haven3d-player]")?.dataset.haven3dPlayer === "P2"
        ? "P2"
        : "P1";
      const activeMode = this.getPlayerActiveMode(playerId) ?? "blade";
      const activeMeta = GEARBLADE_MODE_UI[activeMode];
      selector.dataset.activeMode = activeMode;
      const icon = selector.querySelector<HTMLImageElement>("[data-gearblade-mode-selector-icon]");
      if (icon) {
        icon.src = activeMeta.icon;
        icon.alt = `${activeMeta.label} mode`;
      }
      const label = selector.querySelector<HTMLElement>("[data-gearblade-mode-selector-label]");
      if (label) {
        label.textContent = activeMeta.label;
      }

      selector.querySelectorAll<HTMLElement>("[data-gearblade-mode-hotspot]").forEach((hotspotElement) => {
        const hotspot = hotspotElement.dataset.gearbladeModeHotspot as GearbladeModeSelectorHotspot | undefined;
        const destination = hotspot ? GEARBLADE_MODE_SELECTOR_DESTINATIONS[activeMode][hotspot] : undefined;
        if (!destination) {
          return;
        }

        const meta = GEARBLADE_MODE_UI[destination];
        hotspotElement.dataset.haven3dMode = destination;
        hotspotElement.setAttribute("aria-label", `Switch to ${meta.label} mode`);
        hotspotElement.setAttribute("title", `${meta.key} - ${meta.label}`);
      });
    });

    this.modeElements.forEach((element) => {
      const mode = element.dataset.haven3dMode as Haven3DGearbladeMode | undefined;
      const isEnabled = Boolean(mode && this.enabledModes.has(mode));
      element.hidden = !isEnabled;
      element.setAttribute("aria-pressed", "false");
      if (element instanceof HTMLButtonElement) {
        element.disabled = !isEnabled;
      }
    });

    document.querySelectorAll<HTMLElement>("[data-haven3d-reticle]").forEach((reticle) => {
      const playerId = reticle.dataset.haven3dReticlePlayer === "P2"
        ? "P2"
        : "P1";
      const showReticle = this.getPlayerActiveMode(playerId) === "launcher"
        && !this.isPlayerGrinding(playerId)
        && (splitActive || playerId === "P1");
      reticle.classList.toggle("haven3d-reticle--visible", showReticle);
      reticle.setAttribute("aria-hidden", showReticle ? "false" : "true");
    });
  }

  private updatePrompt(): void {
    const buildPromptText = (playerId: PlayerId, basePrompt: string | null): string => {
      const target = this.getLockedTargetCandidate(playerId);
      const targetText = target ? `TARGET :: ${target.label.toUpperCase()}` : null;
      const activeMode = this.getPlayerActiveMode(playerId);
      const modeText = activeMode ? `MODE :: ${activeMode.toUpperCase()}` : null;
      return [basePrompt, targetText, modeText].filter(Boolean).join(" | ");
    };

    const cameraMode = this.getEffectiveCameraMode();

    if (this.promptElement) {
      const promptText = cameraMode === "shared"
        ? buildPromptText("P1", this.options.getPrompt())
        : "";
      this.promptElement.textContent = promptText;
      this.promptElement.classList.toggle("haven3d-prompt--visible", Boolean(promptText));
    }

    (["P1", "P2"] as PlayerId[]).forEach((playerId) => {
      const promptElement = document.querySelector<HTMLElement>(`[data-haven3d-prompt-player="${playerId}"]`);
      if (!promptElement) {
        return;
      }
      const promptText = cameraMode === "split"
        ? buildPromptText(playerId, this.options.getPlayerPrompt?.(playerId) ?? this.options.getPrompt())
        : "";
      promptElement.textContent = promptText;
      promptElement.classList.toggle("haven3d-prompt--visible", Boolean(promptText));
    });
  }

  private resize(): void {
    const width = Math.max(1, this.options.host.clientWidth || window.innerWidth);
    const height = Math.max(1, this.options.host.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const splitAspect = Math.max(1, width / 2) / height;
    this.splitCameras.P1.aspect = splitAspect;
    this.splitCameras.P2.aspect = splitAspect;
    this.splitCameras.P1.updateProjectionMatrix();
    this.splitCameras.P2.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
    this.renderer.setSize(width, height, false);
  }
}

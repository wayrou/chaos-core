import * as THREE from "three";
import type { PlayerId } from "../../core/types";
import type { WeaponsmithUtilityItemId } from "../../core/weaponsmith";
import {
  getPlayerInput,
  handleKeyDown as handlePlayerInputKeyDown,
  handleKeyUp as handlePlayerInputKeyUp,
  isPlayerInputActionEvent,
} from "../../core/playerInput";
import type { FieldEnemy, FieldMap, FieldNpc, FieldObject, FieldProjectile, PlayerAvatar } from "../types";
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
  utility?: "attack" | "flare";
};

type Haven3DLauncherFire = {
  playerId: PlayerId;
  x: number;
  y: number;
  target: Haven3DTargetRef | null;
  utility: "attack" | "flare";
};

type Haven3DGrappleImpact = {
  playerId: PlayerId;
  x: number;
  y: number;
  target: Haven3DTargetRef;
  damage: number;
  knockback: number;
};

type BladeSwingState = {
  startedAt: number;
  struck: boolean;
  target: Haven3DTargetRef | null;
  direction: { x: number; y: number };
  side: 1 | -1;
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
  mesh: THREE.Object3D;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttlMs: number;
  target: Haven3DTargetRef | null;
  utility: "attack" | "flare";
  radius: number;
  damage: number;
  knockback: number;
};

type PlayerVerticalState = {
  elevation: number;
  velocity: number;
  grounded: boolean;
  gliding: boolean;
  gliderDeployedAt: number;
  jumpStartedAt: number;
  jumpFlipDirection: 1 | -1;
  groundElevation: number;
  worldElevation: number;
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

type GrappleMoveState = {
  startedAt: number;
  target: Haven3DTargetRef | GrappleAnchorTargetRef | GrappleZiplineTargetRef;
  targetPoint: { x: number; y: number };
  targetHeight: number;
  impacted: boolean;
  line: THREE.Line;
  hook: THREE.Mesh;
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

export type Haven3DFieldCameraState = {
  yaw: number;
  pitch: number;
  distance: number;
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
  getNpcs: () => FieldNpc[];
  getEnemies: () => FieldEnemy[];
  getFieldProjectiles?: () => FieldProjectile[];
  getCompanion?: () => Companion | null | undefined;
  getPlayerAvatar: (playerId: PlayerId) => FieldAvatarView | null;
  isPlayerActive: (playerId: PlayerId) => boolean;
  isPaused: () => boolean;
  setPlayerAvatar: (playerId: PlayerId, x: number, y: number, facing: PlayerAvatar["facing"]) => void;
  constrainPlayerPosition?: (
    playerId: PlayerId,
    desired: FieldAvatarView,
    previous: FieldAvatarView,
  ) => FieldAvatarView;
  getPrompt: () => string | null;
  onInteractPressed: (playerId: PlayerId) => void;
  onOpenMenu: () => void;
  onFrame: (deltaMs: number, currentTime: number) => void;
  isFieldObjectVisible?: (objectId: string, object?: FieldObject) => boolean;
  onPlayerFootstep?: (playerId: PlayerId, side: "left" | "right", speedRatio: number) => void;
  onBladeStrike?: (strike: Haven3DBladeStrike) => boolean;
  onLauncherFire?: (fire: Haven3DLauncherFire) => boolean;
  onLauncherImpact?: (impact: Haven3DLauncherImpact) => boolean;
  onGrappleImpact?: (impact: Haven3DGrappleImpact) => boolean;
  canUseGlider?: (playerId: PlayerId) => boolean;
  hasApronUtility?: (playerId: PlayerId, utilityItemId: WeaponsmithUtilityItemId) => boolean;
  enableGearbladeModes?: boolean;
  enabledGearbladeModes?: readonly Haven3DGearbladeMode[];
};

const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 32;
const PLAYER_SPEED_PX_PER_SECOND = 278;
const DASH_MULTIPLIER = 2.475;
const CAMERA_MIN_PITCH = -0.38;
const CAMERA_MAX_PITCH = 0.62;
const CAMERA_DEFAULT_DISTANCE = 8.8;
const CAMERA_MIN_DISTANCE = 5.4;
const CAMERA_MAX_DISTANCE = 15.5;
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
const SABLE_SPRINT_SPEED_RATIO_START = 1.1;
const SABLE_SPRINT_SPEED_RATIO_SPAN = 0.42;
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

function normalizeHaven3DCameraState(
  state: Haven3DFieldCameraState | null | undefined,
  profile: Haven3DMapProfile,
): Haven3DFieldCameraState | null {
  if (!state || !isFiniteCameraValue(state.yaw)) {
    return null;
  }

  return {
    yaw: state.yaw,
    pitch: THREE.MathUtils.clamp(
      isFiniteCameraValue(state.pitch) ? state.pitch : profile.camera.defaultPitch,
      CAMERA_MIN_PITCH,
      CAMERA_MAX_PITCH,
    ),
    distance: THREE.MathUtils.clamp(
      isFiniteCameraValue(state.distance) ? state.distance : profile.camera.defaultDistance,
      profile.camera.minDistance,
      profile.camera.maxDistance,
    ),
  };
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
  private readonly fieldObjectGroups = new Map<string, THREE.Object3D>();
  private readonly fieldObjectsById = new Map<string, FieldObject>();
  private distantHavenLandmark: THREE.Group | null = null;
  private companionActor: Actor | null = null;
  private mapProfile: Haven3DMapProfile = HAVEN3D_BASE_MAP_PROFILE;
  private readonly clockForward = new THREE.Vector3(0, 0, -1);
  private readonly clockRight = new THREE.Vector3(1, 0, 0);
  private resizeObserver: ResizeObserver | null = null;
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private yaw = 0;
  private pitch = 0.2;
  private cameraDistance = CAMERA_DEFAULT_DISTANCE;
  private mouseDx = 0;
  private mouseDy = 0;
  private rightMouseDown = false;
  private pointerLocked = false;
  private promptElement: HTMLElement | null = null;
  private disposed = false;
  private targetLock: Haven3DTargetRef | null = null;
  private targetOrbitYawOffset = 0;
  private activeGearbladeMode: Haven3DGearbladeMode | null = null;
  private actionCooldownUntil = 0;
  private launcherRecoilStartedAt = Number.NEGATIVE_INFINITY;
  private bladeSwing: BladeSwingState | null = null;
  private nextBladeSwingSide: 1 | -1 = 1;
  private gearbladeTransform: GearbladeTransformState | null = null;
  private grappleMove: GrappleMoveState | null = null;
  private ziplineDismountDrift: ZiplineDismountDrift | null = null;
  private readonly launcherProjectiles: LauncherProjectile[] = [];
  private readonly enemyHpSnapshot = new Map<string, number>();
  private readonly enemyHitReactions = new Map<string, EnemyHitReaction>();
  private readonly visualEffects: VisualEffect[] = [];
  private readonly playerVerticalStates = new Map<PlayerId, PlayerVerticalState>();
  private readonly grappleAnchors = new Map<string, GrappleAnchor>();
  private readonly grappleZiplineSegments = new Map<string, GrappleZiplineSegment>();
  private readonly cameraImpulse = new THREE.Vector3();
  private modeElements: HTMLElement[] = [];
  private currentFrameTime = 0;
  private hitstopRemainingMs = 0;
  private cameraYawPan: CameraYawPan | null = null;
  private snapCameraNextFrame = true;
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
    this.setGearbladeMode(mode);
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
        this.snapCameraToPlayerFacing();
      }
      return;
    }

    if (event.code === "KeyZ" || event.key === "z" || event.key === "Z") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) {
        this.selectNextTarget(event.shiftKey);
      }
      return;
    }

    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) {
        this.tryStartPlayerJump("P1");
      }
      return;
    }

    const requestedMode = this.getModeForKeyEvent(event);
    if (requestedMode) {
      event.preventDefault();
      event.stopPropagation();
      this.setGearbladeMode(requestedMode);
      return;
    }

    if (event.code === "KeyQ" || event.key === "q" || event.key === "Q") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) {
        this.cycleGearbladeMode();
      }
      return;
    }

    if (
      this.activeMode !== null
      && !event.repeat
      && isPlayerInputActionEvent(event, "P1", "attack")
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.triggerPrimaryAction();
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
    this.yaw = initialCameraState?.yaw ?? 0;
    this.pitch = initialCameraState?.pitch ?? this.mapProfile.camera.defaultPitch;
    this.cameraDistance = initialCameraState?.distance ?? this.mapProfile.camera.defaultDistance;
    this.modeController = createHaven3DModeController({
      enableGearbladeModes: options.enableGearbladeModes === true,
      enabledModes: options.enabledGearbladeModes,
      initialMode: "blade",
    });
    this.activeGearbladeMode = this.modeController.activeMode;
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

  getCameraState(): Haven3DFieldCameraState {
    return {
      yaw: this.getSnapshotYaw(),
      pitch: this.pitch,
      distance: this.cameraDistance,
    };
  }

  replaceMap(map: FieldMap): void {
    if (this.disposed) {
      return;
    }

    this.finishGrappleMove(false);
    this.clearMapBoundTransients();
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
    this.syncDynamicActors();
    this.syncFieldProjectiles();
    this.resize();
    this.snapCameraNextFrame = true;
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
    const anchor = this.findGrappleAnchor(rangePx);
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

  private setGearbladeMode(mode: Haven3DGearbladeMode): void {
    if (!this.enabledModes.has(mode) || this.activeGearbladeMode === mode) {
      return;
    }

    const previousMode = this.activeGearbladeMode;
    this.activeGearbladeMode = mode;
    if (previousMode) {
      this.gearbladeTransform = {
        from: previousMode,
        to: mode,
        startedAt: this.currentFrameTime || performance.now(),
        durationMs: GEARBLADE_TRANSFORM_MS,
      };
      this.cameraImpulse.y += 0.025;
    }
    if (mode !== "blade") {
      this.bladeSwing = null;
    }
    if (mode !== "grapple") {
      this.finishGrappleMove(false);
    }
    this.updateModeHud();
  }

  private readGearbladeTransform(now = this.currentFrameTime || performance.now()): GearbladeTransformSnapshot | null {
    const transform = this.gearbladeTransform;
    if (!transform) {
      return null;
    }

    const t = THREE.MathUtils.clamp((now - transform.startedAt) / transform.durationMs, 0, 1);
    if (t >= 1) {
      this.gearbladeTransform = null;
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

  private cycleGearbladeMode(): void {
    const enabledModes = Array.from(this.enabledModes);
    if (enabledModes.length === 0) {
      return;
    }

    const currentIndex = this.activeGearbladeMode
      ? enabledModes.indexOf(this.activeGearbladeMode)
      : -1;
    this.setGearbladeMode(enabledModes[(currentIndex + 1 + enabledModes.length) % enabledModes.length]);
  }

  start(): void {
    this.disposed = false;
    this.options.host.innerHTML = "";
    this.options.host.appendChild(this.renderer.domElement);
    this.promptElement = document.querySelector<HTMLElement>("[data-haven3d-prompt]");
    this.bindEvents();
    this.resize();
    this.lastFrameTime = performance.now();
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
        this.triggerPrimaryAction();
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
    this.camera.far = Math.max(
      this.mapProfile.camera.farMin,
      Math.hypot(worldWidth, worldDepth) * this.mapProfile.camera.farScale,
    );
    this.camera.updateProjectionMatrix();
  }

  private buildScene(): void {
    this.clearSkyboxBackground = applyArdyciaToonSceneStyle(this.scene, this.mapProfile.scene);

    this.buildWorldScene();
    this.createPlayerActor("P1", 0xd48342);
    this.createPlayerActor("P2", 0x7b66c9);
    this.syncDynamicActors();
  }

  private buildWorldScene(): void {
    this.buildTerrainUnderlay();
    this.buildTileDeck();
    this.buildInteractionZones();
    this.buildFieldObjects();
    this.buildGrappleAnchors();
    this.buildGrappleZiplineSegments();
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
    this.distantHavenLandmark = null;
  }

  private rebuildWorldScene(): void {
    this.clearWorldScene();
    this.buildWorldScene();
  }

  private clearMapBoundTransients(): void {
    this.ziplineDismountDrift = null;

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
    blade.add(grip, guard, bladeMesh, bladeTip, bladeTrail);

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
    this.updateCamera(deltaMs / 1000);
    this.updateDistantHavenLandmark();
    this.updateGrappleAnchors(currentTime);
    this.syncDynamicActors();
    this.syncFieldProjectiles();
    this.updatePrompt();
    this.renderer.render(this.scene, this.camera);
    if (this.disposed) {
      return;
    }

    this.animationFrameId = requestAnimationFrame((time) => this.loop(time));
  }

  private movePlayers(deltaMs: number): void {
    (["P1", "P2"] as PlayerId[]).forEach((playerId) => {
      if (!this.options.isPlayerActive(playerId)) {
        return;
      }
      if (playerId === "P1" && this.grappleMove) {
        return;
      }

      const avatar = this.options.getPlayerAvatar(playerId);
      if (!avatar) {
        return;
      }

      const input = getPlayerInput(playerId);
      const movement = this.getPlayerMovementInputVector(playerId);
      if (!movement) {
        return;
      }

      const verticalState = this.getPlayerVerticalState(playerId);
      const speed = PLAYER_SPEED_PX_PER_SECOND
        * (input.special1 && !verticalState.gliding ? DASH_MULTIPLIER : 1)
        * (verticalState.gliding ? PLAYER_GLIDER_MOVEMENT_MULTIPLIER : 1)
        * this.getActionMovementMultiplier(playerId);
      const step = speed * (deltaMs / 1000);
      const moveX = movement.x;
      const moveY = movement.y;
      let nextX = avatar.x + moveX * step;
      let nextY = avatar.y + moveY * step;
      const lockedTarget = playerId === "P1" ? this.getLockedTargetCandidate() : null;
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
    const drift = this.ziplineDismountDrift;
    if (!drift) {
      return;
    }
    if (this.grappleMove || !this.options.isPlayerActive(drift.playerId)) {
      this.ziplineDismountDrift = null;
      return;
    }

    const avatar = this.options.getPlayerAvatar(drift.playerId);
    if (!avatar) {
      this.ziplineDismountDrift = null;
      return;
    }

    const vertical = this.getPlayerVerticalState(drift.playerId);
    const elapsed = Math.max(0, currentTime - drift.startedAt);
    if (vertical.grounded || elapsed >= drift.durationMs) {
      this.ziplineDismountDrift = null;
      return;
    }

    const t = THREE.MathUtils.clamp(elapsed / Math.max(1, drift.durationMs), 0, 1);
    const falloff = 1 - smoothstep(t);
    const deltaSeconds = Math.min(0.05, Math.max(0, deltaMs / 1000));
    const moveX = drift.vx * falloff * deltaSeconds;
    const moveY = drift.vy * falloff * deltaSeconds;
    if (Math.hypot(moveX, moveY) < 0.01) {
      this.ziplineDismountDrift = null;
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
      this.ziplineDismountDrift = null;
      return;
    }

    const constrained = this.options.constrainPlayerPosition?.(
      drift.playerId,
      { x: nextX, y: nextY, facing },
      avatar,
    ) ?? { x: nextX, y: nextY, facing };
    this.options.setPlayerAvatar(drift.playerId, constrained.x, constrained.y, constrained.facing);
  }

  private getPlayerMovementInputVector(playerId: PlayerId): { x: number; y: number } | null {
    const input = getPlayerInput(playerId);
    let moveX = 0;
    let moveY = 0;
    if (input.up) {
      moveX += this.clockForward.x;
      moveY += this.clockForward.z;
    }
    if (input.down) {
      moveX -= this.clockForward.x;
      moveY -= this.clockForward.z;
    }
    if (input.right) {
      moveX += this.clockRight.x;
      moveY += this.clockRight.z;
    }
    if (input.left) {
      moveX -= this.clockRight.x;
      moveY -= this.clockRight.z;
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
        gliderDeployedAt: Number.NEGATIVE_INFINITY,
        jumpStartedAt: Number.NEGATIVE_INFINITY,
        jumpFlipDirection: 1,
        groundElevation: 0,
        worldElevation: 0,
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
        state.grounded = false;
        state.gliding = false;
        state.velocity = Math.min(0, state.velocity);
        state.worldElevation = Math.max(state.worldElevation, state.groundElevation);
        state.elevation = Math.max(0, state.worldElevation - groundElevation);
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

  private playerHasApronUtility(playerId: PlayerId, utilityItemId: WeaponsmithUtilityItemId): boolean {
    return Boolean(
      this.options.hasApronUtility?.(playerId, utilityItemId)
      || (utilityItemId === "apron_glider" && this.options.canUseGlider?.(playerId) === true),
    );
  }

  private tryStartPlayerJump(playerId: PlayerId): void {
    if (this.options.isPaused() || !this.options.isPlayerActive(playerId)) {
      return;
    }
    if (playerId === "P1" && this.grappleMove) {
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
    this.cameraImpulse.y += playerId === "P1" ? 0.045 : 0;
  }

  private tryDeployPlayerGlider(playerId: PlayerId): boolean {
    if (
      this.options.isPaused()
      || !this.options.isPlayerActive(playerId)
      || !this.playerHasApronUtility(playerId, "apron_glider")
    ) {
      return false;
    }
    if (playerId === "P1" && this.grappleMove) {
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
    if (playerId !== "P1") {
      return false;
    }

    const lockedTarget = this.getLockedTargetCandidate();
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
      if (
        playerId === "P1"
        && (this.grappleMove?.target.kind === "grapple-node" || this.grappleMove?.target.kind === "zipline-track")
      ) {
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

        state.grounded = false;
        state.gliding = false;
        state.velocity = Math.min(0, state.velocity);
        state.worldElevation = Math.max(state.worldElevation, state.groundElevation);
        state.elevation = Math.max(0, state.worldElevation - groundElevation);
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
    if (state.grounded) {
      state.gliding = false;
      state.jumpFlipDirection = 1;
    }
  }

  private releasePlayerFromZipline(
    point: { x: number; y: number },
    riderWorldHeight: number,
    direction: { x: number; y: number },
    verticalVelocity: number,
    currentTime: number,
  ): void {
    const state = this.getPlayerVerticalState("P1");
    const groundElevation = this.getGroundElevationAtPoint(point);
    const worldElevation = Math.max(riderWorldHeight, groundElevation + 0.18);
    const directionLength = Math.max(0.001, Math.hypot(direction.x, direction.y));
    const exitDirection = {
      x: direction.x / directionLength,
      y: direction.y / directionLength,
    };

    state.grounded = false;
    state.gliding = false;
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

    this.ziplineDismountDrift = {
      playerId: "P1",
      vx: exitDirection.x * GRAPPLE_ZIPLINE_DISMOUNT_SPEED_PX_PER_SECOND,
      vy: exitDirection.y * GRAPPLE_ZIPLINE_DISMOUNT_SPEED_PX_PER_SECOND,
      startedAt: currentTime,
      durationMs: GRAPPLE_ZIPLINE_DISMOUNT_DURATION_MS,
    };
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

  private getActionMovementMultiplier(playerId: PlayerId): number {
    if (playerId !== "P1" || !this.bladeSwing) {
      return 1;
    }

    const elapsed = this.currentFrameTime - this.bladeSwing.startedAt;
    if (elapsed < BLADE_SWING_WINDUP_MS) {
      return 0.36;
    }
    if (elapsed < BLADE_LUNGE_END_MS) {
      return 0.62;
    }
    return 0.42;
  }

  private triggerPrimaryAction(): void {
    if (this.options.isPaused() || !this.activeMode) {
      return;
    }

    switch (this.activeMode) {
      case "blade":
        this.triggerBladeSwing();
        break;
      case "launcher":
        this.fireLauncher();
        break;
      case "grapple":
        this.fireGrapple();
        break;
      default:
        break;
    }
  }

  private getActionDirection(
    avatar: FieldAvatarView,
    target: Pick<Haven3DTargetCandidate, "x" | "y"> | null = null,
  ): { x: number; y: number } {
    const rawDirection = target
      ? { x: target.x - avatar.x, y: target.y - avatar.y }
      : { x: this.clockForward.x, y: this.clockForward.z };
    const length = Math.hypot(rawDirection.x, rawDirection.y);
    if (length > 0.001) {
      return { x: rawDirection.x / length, y: rawDirection.y / length };
    }

    return getFacingVector(avatar.facing);
  }

  private findEnemyActionTarget(
    avatar: FieldAvatarView,
    rangePx: number,
    minForwardDot: number,
  ): Haven3DTargetCandidate | null {
    const lockedTarget = this.getLockedTargetCandidate();
    if (lockedTarget?.kind === "enemy" && lockedTarget.distance <= rangePx) {
      return lockedTarget;
    }

    const direction = this.getActionDirection(avatar);
    let best: Haven3DTargetCandidate | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of this.getTargetCandidates()) {
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

  private findActionTarget(rangePx: number): Haven3DTargetCandidate | null {
    const avatar = this.options.getPlayerAvatar("P1");
    if (!avatar) {
      return null;
    }

    const lockedTarget = this.getLockedTargetCandidate();
    if (lockedTarget && lockedTarget.distance <= rangePx) {
      return lockedTarget;
    }

    const direction = this.getActionDirection(avatar);
    let best: Haven3DTargetCandidate | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of this.getTargetCandidates()) {
      if (candidate.distance > rangePx) {
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

  private findGrappleZiplineTarget(rangePx: number): GrappleZiplineTarget | null {
    const avatar = this.options.getPlayerAvatar("P1");
    if (!avatar || this.grappleZiplineSegments.size === 0) {
      return null;
    }

    const direction = this.getActionDirection(avatar);
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

  private findGrappleAnchor(rangePx: number): GrappleAnchor | null {
    const avatar = this.options.getPlayerAvatar("P1");
    if (!avatar || this.grappleAnchors.size === 0) {
      return null;
    }

    const direction = this.getActionDirection(avatar);
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

  private findTargetForRef(target: Haven3DTargetRef): Haven3DTargetCandidate | null {
    return this.getTargetCandidates().find((candidate) => candidate.key === target.key) ?? null;
  }

  private triggerBladeSwing(): void {
    if (this.activeMode !== "blade" || this.options.isPaused() || this.bladeSwing) {
      return;
    }

    const avatar = this.options.getPlayerAvatar("P1");
    if (!avatar) {
      return;
    }

    const target = this.findEnemyActionTarget(avatar, BLADE_SWING_RANGE_PX * 1.45, -0.18);
    const direction = this.getActionDirection(avatar, target);
    const directionLength = Math.max(0.001, Math.hypot(direction.x, direction.y));
    const side = this.nextBladeSwingSide;
    this.nextBladeSwingSide = side === 1 ? -1 : 1;
    this.bladeSwing = {
      startedAt: performance.now(),
      struck: false,
      target,
      direction: {
        x: direction.x / directionLength,
        y: direction.y / directionLength,
      },
      side,
    };
    this.spawnBladeDrawSmear(avatar, this.bladeSwing.direction, side);

    this.options.setPlayerAvatar(
      "P1",
      avatar.x,
      avatar.y,
      fieldFacingFromDelta(direction.x, direction.y, avatar.facing),
    );
  }

  private updateBladeSwing(deltaMs: number, currentTime: number): void {
    if (!this.bladeSwing) {
      return;
    }

    const elapsed = currentTime - this.bladeSwing.startedAt;
    const avatar = this.options.getPlayerAvatar("P1");
    if (!avatar) {
      this.bladeSwing = null;
      return;
    }

    if (elapsed >= BLADE_LUNGE_START_MS && elapsed <= BLADE_LUNGE_END_MS) {
      const step = BLADE_LUNGE_SPEED_PX_PER_SECOND * (deltaMs / 1000);
      const nextX = avatar.x + this.bladeSwing.direction.x * step;
      const nextY = avatar.y + this.bladeSwing.direction.y * step;
      let lungeX = avatar.x;
      let lungeY = avatar.y;
      if (this.canPlayerMoveTo("P1", nextX, avatar.y, PLAYER_WIDTH, PLAYER_HEIGHT)) {
        lungeX = nextX;
      }
      if (this.canPlayerMoveTo("P1", lungeX, nextY, PLAYER_WIDTH, PLAYER_HEIGHT)) {
        lungeY = nextY;
      }
      this.options.setPlayerAvatar("P1", lungeX, lungeY, avatar.facing);
    }

    if (!this.bladeSwing.struck && elapsed >= BLADE_SWING_IMPACT_MS) {
      this.bladeSwing.struck = true;
      const strikeLine = this.getBladeStrikeLine(avatar, this.bladeSwing);
      const didHit = this.options.onBladeStrike?.({
        playerId: "P1",
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
        target: this.bladeSwing.target,
        radius: Math.max(
          BLADE_SWING_RANGE_PX,
          Math.hypot(strikeLine.hilt.x - avatar.x, strikeLine.hilt.y - avatar.y),
          Math.hypot(strikeLine.tip.x - avatar.x, strikeLine.tip.y - avatar.y),
        ),
        arcRadians: BLADE_SWING_ARC_RADIANS,
        damage: BLADE_SWING_DAMAGE,
        knockback: BLADE_SWING_KNOCKBACK,
      }) ?? false;
      this.spawnBladeSlashEffect(strikeLine, this.bladeSwing.side, didHit);
      if (didHit) {
        this.spawnHitSpark(
          {
            x: (strikeLine.hilt.x + strikeLine.tip.x) / 2,
            y: (strikeLine.hilt.y + strikeLine.tip.y) / 2,
          },
          0xf2b04d,
          this.getBladeSlashNormal(strikeLine, this.bladeSwing.side),
        );
        this.beginImpactFeedback({
          x: (strikeLine.hilt.x + strikeLine.tip.x) / 2,
          y: (strikeLine.hilt.y + strikeLine.tip.y) / 2,
        }, 1);
      }
    }

    if (elapsed >= BLADE_SWING_TOTAL_MS) {
      this.bladeSwing = null;
    }
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
    const pose = this.getBladeSwingPoseValues(elapsed, swing.side);
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
    side: 1 | -1,
  ): Omit<BladeSwingPose, "bladeDirection" | "hilt" | "tip"> {
    const handedSide = side * PLAYER_RIGHT_HAND_LOCAL_X;
    const startYaw = BLADE_SWING_START_LOCAL_YAW * handedSide;
    const endYaw = BLADE_SWING_END_LOCAL_YAW * handedSide;
    const swingProgress = this.getBladeSwingArcProgress(elapsed);
    const slashPulse = Math.sin(swingProgress * Math.PI);
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

  private fireLauncher(): void {
    const now = this.currentFrameTime || performance.now();
    if (this.activeMode !== "launcher" || now < this.actionCooldownUntil) {
      return;
    }

    const avatar = this.options.getPlayerAvatar("P1");
    if (!avatar) {
      return;
    }

    const target = this.findEnemyActionTarget(avatar, LAUNCHER_RANGE_PX, 0.12);
    const direction = this.getActionDirection(avatar, target);
    const originX = avatar.x + direction.x * 36;
    const originY = avatar.y + direction.y * 36;
    const originPoint = { x: originX, y: originY };
    const utility: "attack" | "flare" = target?.kind === "enemy" ? "attack" : "flare";
    const canFire = this.options.onLauncherFire?.({
      playerId: "P1",
      x: originX,
      y: originY,
      target,
      utility,
    }) ?? true;
    if (!canFire) {
      return;
    }

    const projectileGroup = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(utility === "flare" ? 0.18 : 0.14, 14, 10),
      createArdyciaToonMaterial({
        color: utility === "flare" ? 0x8af0ff : 0xf2b04d,
        emissive: utility === "flare" ? 0x31b4d2 : 0x8c3f10,
        emissiveIntensity: utility === "flare" ? 2.3 : 1.8,
      }),
    );
    projectileGroup.add(mesh);
    if (utility === "flare") {
      const flareLight = new THREE.PointLight(0x8af0ff, 1.8, 5.8, 1.55);
      projectileGroup.add(flareLight);
    }
    const world = fieldToHavenWorld(this.options.map, originPoint, this.getGroundElevationAtPoint(originPoint) + 1.12);
    projectileGroup.position.set(world.x, world.y, world.z);
    mesh.castShadow = true;
    this.dynamicGroup.add(projectileGroup);

    this.launcherProjectiles.push({
      mesh: projectileGroup,
      x: originX,
      y: originY,
      vx: direction.x * LAUNCHER_SPEED_PX_PER_SECOND,
      vy: direction.y * LAUNCHER_SPEED_PX_PER_SECOND,
      ttlMs: (LAUNCHER_RANGE_PX / LAUNCHER_SPEED_PX_PER_SECOND) * 1000,
      target,
      utility,
      radius: LAUNCHER_HIT_RADIUS_PX,
      damage: LAUNCHER_DAMAGE,
      knockback: LAUNCHER_KNOCKBACK,
    });

    this.actionCooldownUntil = now + LAUNCHER_COOLDOWN_MS;
    this.launcherRecoilStartedAt = now;
    this.options.setPlayerAvatar("P1", avatar.x, avatar.y, fieldFacingFromDelta(direction.x, direction.y, avatar.facing));
  }

  private updateLauncherProjectiles(deltaMs: number): void {
    for (let index = this.launcherProjectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.launcherProjectiles[index];
      projectile.ttlMs -= deltaMs;

      const target = projectile.target ? this.findTargetForRef(projectile.target) : null;
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

      const hitEnemy = projectile.utility === "attack"
        ? this.options.getEnemies()
            .filter((enemy) => enemy.hp > 0)
            .find((enemy) => Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) <= projectile.radius + Math.max(enemy.width, enemy.height) * 0.5)
        : null;
      if (hitEnemy) {
        const didHit = this.options.onLauncherImpact?.({
          playerId: "P1",
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
          utility: projectile.utility,
        }) ?? false;
        this.spawnHitSpark({ x: projectile.x, y: projectile.y }, didHit ? 0xf2b04d : 0x6f6a5d);
        if (didHit) {
          this.beginImpactFeedback({ x: projectile.x, y: projectile.y }, 0.72);
        }
        this.removeLauncherProjectile(index);
        continue;
      }

      if (projectile.ttlMs <= 0) {
        if (projectile.utility === "flare") {
          this.options.onLauncherImpact?.({
            playerId: "P1",
            x: projectile.x,
            y: projectile.y,
            target: null,
            radius: projectile.radius,
            damage: 0,
            knockback: 0,
            utility: "flare",
          });
          this.spawnFlareBeacon({ x: projectile.x, y: projectile.y });
        } else {
          this.spawnHitSpark({ x: projectile.x, y: projectile.y }, 0x6f6a5d);
        }
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

  private fireGrapple(): void {
    const now = this.currentFrameTime || performance.now();
    if (this.activeMode !== "grapple" || now < this.actionCooldownUntil || this.grappleMove) {
      return;
    }

    const avatar = this.options.getPlayerAvatar("P1");
    const lockedTarget = this.getLockedTargetCandidate();
    const lockedActionTarget = lockedTarget && lockedTarget.distance <= GRAPPLE_RANGE_PX
      ? lockedTarget
      : null;
    const ziplineTarget = lockedActionTarget ? null : this.findGrappleZiplineTarget(GRAPPLE_RANGE_PX);
    const anchor = lockedActionTarget || ziplineTarget ? null : this.findGrappleAnchor(GRAPPLE_RANGE_PX);
    const actionTarget = lockedActionTarget ?? (ziplineTarget || anchor ? null : this.findActionTarget(GRAPPLE_RANGE_PX));
    if (!avatar || (!ziplineTarget && !anchor && !actionTarget)) {
      this.actionCooldownUntil = now + GRAPPLE_COOLDOWN_MS * 0.45;
      return;
    }

    this.ziplineDismountDrift = null;

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
    const direction = this.getActionDirection(avatar, targetPoint);
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

    this.grappleMove = {
      startedAt: now,
      target: targetRef,
      targetPoint,
      targetHeight: ziplineTarget?.attachHeight ?? anchor?.height ?? this.getGroundElevationAtPoint(targetPoint) + 1.08,
      impacted: false,
      line,
      hook,
      swing: anchor
        ? {
          startX: avatar.x,
          startY: avatar.y,
          durationMs: GRAPPLE_SWING_DURATION_MS,
          arcHeight: GRAPPLE_SWING_ARC_HEIGHT,
        }
        : undefined,
      zipline: ziplineTarget
        ? {
          segmentKey: ziplineTarget.segment.key,
          startX: avatar.x,
          startY: avatar.y,
          startHeight: this.getPlayerVisualWorldElevation("P1", { x: avatar.x, y: avatar.y }),
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
        : undefined,
    };
    this.actionCooldownUntil = now + GRAPPLE_COOLDOWN_MS;
    this.options.setPlayerAvatar("P1", avatar.x, avatar.y, fieldFacingFromDelta(direction.x, direction.y, avatar.facing));
    this.updateGrappleLine();
  }

  private updateGrappleMove(deltaMs: number, currentTime: number): void {
    if (!this.grappleMove) {
      return;
    }

    const avatar = this.options.getPlayerAvatar("P1");
    if (!avatar) {
      this.finishGrappleMove(false);
      return;
    }

    if (this.grappleMove.target.kind === "zipline-track") {
      this.updateGrappleZipline(currentTime, avatar);
      return;
    }

    if (this.grappleMove.target.kind === "grapple-node") {
      this.updateGrappleSwing(currentTime, avatar);
      return;
    }

    const liveTarget = this.findTargetForRef(this.grappleMove.target);
    if (liveTarget) {
      this.grappleMove.targetPoint = { x: liveTarget.x, y: liveTarget.y };
    }

    if (!this.grappleMove.impacted && this.grappleMove.target.kind === "enemy") {
      this.grappleMove.impacted = true;
      const didHit = this.options.onGrappleImpact?.({
        playerId: "P1",
        x: avatar.x,
        y: avatar.y,
        target: this.grappleMove.target,
        damage: GRAPPLE_DAMAGE,
        knockback: GRAPPLE_KNOCKBACK,
      }) ?? false;
      if (didHit) {
        this.spawnHitSpark(this.grappleMove.targetPoint, 0x4fb4a4);
        this.beginImpactFeedback(this.grappleMove.targetPoint, 0.72);
      }
    }

    const dx = this.grappleMove.targetPoint.x - avatar.x;
    const dy = this.grappleMove.targetPoint.y - avatar.y;
    const distance = Math.hypot(dx, dy);
    const elapsed = currentTime - this.grappleMove.startedAt;
    if (distance <= GRAPPLE_STOP_DISTANCE_PX || elapsed >= GRAPPLE_MAX_DURATION_MS) {
      this.finishGrappleMove(true);
      return;
    }

    const step = Math.min(distance - GRAPPLE_STOP_DISTANCE_PX, GRAPPLE_PULL_SPEED_PX_PER_SECOND * (deltaMs / 1000));
    const moveX = (dx / Math.max(0.001, distance)) * step;
    const moveY = (dy / Math.max(0.001, distance)) * step;
    let nextX = avatar.x + moveX;
    let nextY = avatar.y + moveY;
    if (!this.canPlayerMoveTo("P1", nextX, avatar.y, PLAYER_WIDTH, PLAYER_HEIGHT)) {
      nextX = avatar.x;
    }
    if (!this.canPlayerMoveTo("P1", nextX, nextY, PLAYER_WIDTH, PLAYER_HEIGHT)) {
      nextY = avatar.y;
    }

    this.options.setPlayerAvatar("P1", nextX, nextY, fieldFacingFromDelta(dx, dy, avatar.facing));
    this.updateGrappleLine();
  }

  private updateGrappleSwing(currentTime: number, avatar: FieldAvatarView): void {
    if (!this.grappleMove?.swing) {
      this.finishGrappleMove(false);
      return;
    }

    const elapsed = currentTime - this.grappleMove.startedAt;
    const progress = THREE.MathUtils.clamp(elapsed / this.grappleMove.swing.durationMs, 0, 1);
    const easedProgress = smoothstep(progress);
    const startX = this.grappleMove.swing.startX;
    const startY = this.grappleMove.swing.startY;
    const targetX = this.grappleMove.targetPoint.x;
    const targetY = this.grappleMove.targetPoint.y;
    const nextX = THREE.MathUtils.lerp(startX, targetX, easedProgress);
    const nextY = THREE.MathUtils.lerp(startY, targetY, easedProgress);
    const lift = Math.sin(progress * Math.PI) * this.grappleMove.swing.arcHeight;
    const facing = fieldFacingFromDelta(targetX - avatar.x, targetY - avatar.y, avatar.facing);

    this.options.setPlayerAvatar("P1", nextX, nextY, facing);
    this.setPlayerSwingElevation("P1", lift);
    this.updateGrappleLine();

    if (progress >= 1) {
      this.finishGrappleMove(true);
    }
  }

  private updateGrappleZipline(currentTime: number, avatar: FieldAvatarView): void {
    const move = this.grappleMove;
    const zipline = move?.zipline;
    if (!move || !zipline) {
      this.finishGrappleMove(false);
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
      "P1",
      nextX,
      nextY,
      fieldFacingFromDelta(rideVector.x, rideVector.y, avatar.facing),
    );
    const groundElevation = this.getGroundElevationAtPoint({ x: nextX, y: nextY });
    this.setPlayerSwingElevation("P1", Math.max(0, riderWorldHeight - groundElevation));
    this.updateGrappleLine();

    if (rideComplete) {
      this.releasePlayerFromZipline(
        { x: nextX, y: nextY },
        riderWorldHeight,
        rideVector,
        rideVerticalVelocity,
        currentTime,
      );
      this.finishGrappleMove(true, { preserveAirborne: true });
    }
  }

  private updateGrappleLine(): void {
    if (!this.grappleMove) {
      return;
    }

    const avatar = this.options.getPlayerAvatar("P1");
    if (!avatar) {
      return;
    }

    const avatarPoint = { x: avatar.x, y: avatar.y };
    const playerWorldElevation = this.getPlayerVisualWorldElevation("P1", avatarPoint);
    const lineStartHeight = this.grappleMove.target.kind === "zipline-track"
      ? playerWorldElevation + GRAPPLE_ZIPLINE_RIDER_HAND_OFFSET_WORLD
      : playerWorldElevation + 1.18;
    const from = fieldToHavenWorld(this.options.map, avatarPoint, lineStartHeight);
    const to = fieldToHavenWorld(this.options.map, this.grappleMove.targetPoint, this.grappleMove.targetHeight);
    this.grappleMove.line.geometry.setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    this.grappleMove.hook.position.set(to.x, to.y, to.z);
    this.grappleMove.hook.rotation.z += 0.18;
  }

  private finishGrappleMove(spawnSpark: boolean, options: FinishGrappleMoveOptions = {}): void {
    if (!this.grappleMove) {
      return;
    }

    const wasAirborneGrapple = this.grappleMove.target.kind === "grapple-node"
      || this.grappleMove.target.kind === "zipline-track";
    if (spawnSpark) {
      this.spawnHitSpark(this.grappleMove.targetPoint, 0x4fb4a4);
    }
    this.dynamicGroup.remove(this.grappleMove.line, this.grappleMove.hook);
    disposeObject(this.grappleMove.line);
    disposeObject(this.grappleMove.hook);
    this.grappleMove = null;
    if (wasAirborneGrapple && !options.preserveAirborne) {
      this.landPlayerVertical("P1");
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
    if (motion.moving) {
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

    this.applySableMotion(actor.sable, motion, companion);
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

    const leftWalkArm = counterSwing * 0.4 * walkAmount;
    const rightWalkArm = swing * 0.4 * walkAmount;
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

  private applySableMotion(sable: SableRig | undefined, motion: ActorMotionState, companion: Companion): void {
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

    if (this.bladeSwing) {
      this.bladeSwing.startedAt += hitstopMs;
    }
    if (this.grappleMove) {
      this.grappleMove.startedAt += hitstopMs;
    }

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
    side: 1 | -1,
  ): void {
    const directionLength = Math.hypot(direction.x, direction.y);
    if (directionLength <= 0.001) {
      return;
    }

    const forward = { x: direction.x / directionLength, y: direction.y / directionLength };
    const right = { x: forward.y, y: -forward.x };
    const handedSide = side * PLAYER_RIGHT_HAND_LOCAL_X;
    const start = {
      x: avatar.x - forward.x * 18 + right.x * 46 * handedSide,
      y: avatar.y - forward.y * 18 + right.y * 46 * handedSide,
    };
    const end = {
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
    group.rotation.z = Math.atan2(worldDy, length) + 0.22 * side;

    const smearMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe6a6,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const smear = new THREE.Mesh(new THREE.PlaneGeometry(length * 1.12, 0.2), smearMaterial);
    smear.name = "blade-draw-main-smear";
    group.add(smear);

    const glintMaterial = new THREE.MeshBasicMaterial({
      color: 0x67cab5,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const glint = new THREE.Mesh(new THREE.PlaneGeometry(length * 0.58, 0.055), glintMaterial);
    glint.name = "blade-draw-edge-glint";
    glint.position.set(length * 0.08, 0.06, 0.006);
    group.add(glint);

    group.renderOrder = 25;
    this.dynamicGroup.add(group);
    this.visualEffects.push({
      object: group,
      startedAt: this.currentFrameTime || performance.now(),
      durationMs: BLADE_DRAW_SMEAR_MS,
      velocity: new THREE.Vector3(0, 0.12, 0),
      baseScale: group.scale.clone(),
      opacity: 0.5,
      scaleGrowth: 0.2,
    });
  }

  private spawnBladeSlashEffect(strikeLine: BladeSwingPose, side: 1 | -1, didHit: boolean): void {
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
    group.rotation.y = Math.atan2(-worldDz, worldDx);
    group.rotation.z = 0.16 * side;

    const mainMaterial = new THREE.MeshBasicMaterial({
      color: didHit ? 0xfff0b8 : 0xf6d28a,
      transparent: true,
      opacity: didHit ? 0.82 : 0.58,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mainSlash = new THREE.Mesh(new THREE.PlaneGeometry(length * 1.05, didHit ? 0.62 : 0.46), mainMaterial);
    mainSlash.name = "blade-slash-main-ribbon";
    group.add(mainSlash);

    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: 0x67cab5,
      transparent: true,
      opacity: didHit ? 0.58 : 0.36,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const edgeSlash = new THREE.Mesh(new THREE.PlaneGeometry(length * 0.76, 0.12), edgeMaterial);
    edgeSlash.name = "blade-slash-edge-ribbon";
    edgeSlash.position.y = didHit ? 0.15 : 0.11;
    edgeSlash.position.x = -0.08 * side;
    group.add(edgeSlash);

    const groundMaterial = new THREE.MeshBasicMaterial({
      color: didHit ? 0xffd67a : 0x67cab5,
      transparent: true,
      opacity: didHit ? 0.32 : 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const groundSlash = new THREE.Mesh(new THREE.PlaneGeometry(length * 1.12, didHit ? 0.28 : 0.2), groundMaterial);
    groundSlash.name = "blade-slash-ground-streak";
    groundSlash.rotation.x = -Math.PI / 2;
    groundSlash.position.y = -0.96;
    groundSlash.position.x = -0.06 * side;
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
      velocity: new THREE.Vector3(0, didHit ? 0.32 : 0.22, 0),
      spin: 1.8 * side,
      baseScale: group.scale.clone(),
      opacity: didHit ? 0.86 : 0.62,
      scaleGrowth: didHit ? 0.48 : 0.3,
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
    const visible = this.activeMode === "grapple";
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
    if (Math.abs(yawDelta) > 0.000001) {
      this.cameraYawPan = null;
    }
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - this.mouseDy * mouseSensitivity,
      CAMERA_MIN_PITCH,
      CAMERA_MAX_PITCH,
    );
    this.mouseDx = 0;
    this.mouseDy = 0;

    const avatar = this.options.getPlayerAvatar("P1");
    const playerPoint = avatar ? { x: avatar.x, y: avatar.y } : null;
    const playerWorld = avatar && playerPoint
      ? fieldToHavenWorld(this.options.map, playerPoint, this.getPlayerVisualWorldElevation("P1", playerPoint) + 1.15)
      : { x: 0, y: 1.15, z: 0 };
    const lockedTarget = this.getLockedTargetCandidate();
    const cameraProfile = this.mapProfile.camera;
    const cameraDistance = THREE.MathUtils.clamp(
      this.cameraDistance,
      cameraProfile.minDistance,
      cameraProfile.maxDistance,
    );

    let cameraYaw = this.yaw + yawDelta;
    let focus = new THREE.Vector3(playerWorld.x, playerWorld.y, playerWorld.z);
    let distance = cameraDistance;
    let forwardPanActive = false;

    if (avatar && lockedTarget) {
      this.cameraYawPan = null;
      this.targetOrbitYawOffset += yawDelta;
      const targetPoint = { x: lockedTarget.x, y: lockedTarget.y };
      const targetWorld = fieldToHavenWorld(this.options.map, targetPoint, this.getGroundElevationAtPoint(targetPoint) + 1.1);
      const playerToTargetX = targetWorld.x - playerWorld.x;
      const playerToTargetZ = targetWorld.z - playerWorld.z;
      const targetDistance = Math.hypot(playerToTargetX, playerToTargetZ);
      const lockYaw = targetDistance > 0.001
        ? -Math.atan2(playerToTargetX, -playerToTargetZ)
        : this.yaw;
      this.targetOrbitYawOffset = THREE.MathUtils.clamp(this.targetOrbitYawOffset, -0.72, 0.72);
      cameraYaw = lockYaw + this.targetOrbitYawOffset;
      const lockPitch = THREE.MathUtils.clamp(this.pitch, -0.12, 0.34);
      this.pitch = THREE.MathUtils.lerp(this.pitch, lockPitch, 1 - Math.pow(0.0005, dt));
      distance = THREE.MathUtils.clamp(
        cameraProfile.lockedBaseDistance + Math.min(cameraProfile.lockedTargetAddMax, targetDistance * cameraProfile.lockedTargetScale),
        cameraProfile.lockedMinDistance,
        cameraProfile.lockedMaxDistance,
      );
      focus = new THREE.Vector3(
        (playerWorld.x * 0.64) + (targetWorld.x * 0.36),
        Math.max(playerWorld.y, targetWorld.y) + 0.28,
        (playerWorld.z * 0.64) + (targetWorld.z * 0.36),
      );
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
      this.yaw = cameraYaw;
      this.targetOrbitYawOffset = 0;
    }

    const cosPitch = Math.cos(this.pitch);
    const offset = new THREE.Vector3(
      Math.sin(cameraYaw) * distance * cosPitch,
      cameraProfile.heightOffset + Math.sin(this.pitch) * distance,
      Math.cos(cameraYaw) * distance * cosPitch,
    );
    const shoulderOffset = lockedTarget
      ? new THREE.Vector3(Math.cos(cameraYaw) * 0.62, 0, -Math.sin(cameraYaw) * 0.62)
      : new THREE.Vector3();
    const desired = focus.clone().add(offset).add(shoulderOffset);
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

    this.yaw = cameraYaw;
    this.clockForward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw)).normalize();
    this.clockRight.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw)).normalize();
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
    const lockedTarget = playerId === "P1" ? this.getLockedTargetCandidate() : null;
    actor.group.position.set(world.x, world.y, world.z);
    const bladeLookDirection = playerId === "P1" && this.bladeSwing
      ? this.bladeSwing.direction
      : null;
    const lookDirection = lockedTarget
      ? { x: lockedTarget.x - avatar.x, y: lockedTarget.y - avatar.y }
      : bladeLookDirection;
    this.updateActorMotion(
      actor,
      avatar.x,
      avatar.y,
      playerId === "P1" ? 1.08 : 1,
      this.getRotationForFacing(avatar.facing),
      lookDirection,
      getPlayerInput(playerId).special1 && !vertical.gliding,
      !vertical.grounded,
    );
    this.applyChibiJumpPose(actor.chibi, vertical);
    if (vertical.grounded) {
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

    const activeMode = playerId === "P1" ? this.activeMode : "blade";
    const isTargetReady = playerId === "P1" && Boolean(lockedTarget) && activeMode !== null;
    const transform = playerId === "P1" ? this.readGearbladeTransform() : null;
    this.updatePlayerWeaponForm(actor, activeMode, transform);
    if (activeMode !== "blade") {
      if (playerId === "P1" && activeMode === "grapple" && this.grappleMove?.target.kind === "zipline-track") {
        this.applyZiplineRidePose(actor);
        this.updateZiplineGrappleGripPose(actor);
      } else if (isTargetReady && activeMode) {
        this.applyTargetReadyBodyPose(actor, activeMode);
      }
      this.stowBladeOnBack(actor);
      this.hideBladeTrail(actor);
      return;
    }

    if (activeMode && transform && !this.bladeSwing) {
      actor.blade.visible = true;
      this.applyGearbladeTransformBodyPose(actor, transform);
      this.mountBladeOnSwingHand(actor);
      this.updateGearbladeTransformWeaponPose(actor, transform);
      this.hideBladeTrail(actor);
      return;
    }

    const swing = playerId === "P1" ? this.bladeSwing : null;
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
      0.02 - (0.045 * swing.side * PLAYER_RIGHT_HAND_LOCAL_X * pose.slashPulse),
      0.006,
      0.92 + (0.1 * pose.slashPulse),
    );
    actor.bladeTrail.scale.set(
      1.12 + (0.5 * pose.slashPulse) + (0.22 * impactFlash),
      1.05 + (1.5 * slashPulse),
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
    const swingProgress = this.getBladeSwingArcProgress(elapsed);
    const slashPulse = Math.sin(swingProgress * Math.PI);
    const recoveryProgress = smoothstep((elapsed - BLADE_LUNGE_END_MS) / (BLADE_SWING_TOTAL_MS - BLADE_LUNGE_END_MS));
    const handedSide = side * PLAYER_RIGHT_HAND_LOCAL_X;
    const cutSnap = Math.sin(Math.min(1, swingProgress / 0.82) * Math.PI);
    const hiltStartX = side === 1 ? 0.72 * PLAYER_RIGHT_HAND_LOCAL_X : -0.38 * PLAYER_RIGHT_HAND_LOCAL_X;
    const hiltEndX = side === 1 ? -0.36 * PLAYER_RIGHT_HAND_LOCAL_X : 0.66 * PLAYER_RIGHT_HAND_LOCAL_X;
    const wristFollow = (0.16 * handedSide * slashPulse) - (0.08 * handedSide * recoveryProgress);

    return {
      hiltX: THREE.MathUtils.lerp(hiltStartX, hiltEndX, swingProgress) - (0.045 * handedSide * slashPulse),
      hiltY: 0.97 + (0.105 * slashPulse) - (0.02 * recoveryProgress),
      hiltZ: 0.28 + (0.25 * cutSnap) - (0.065 * recoveryProgress),
      bladePitch: -0.08 + (0.095 * slashPulse) - (0.025 * recoveryProgress),
      bladeYaw: THREE.MathUtils.lerp(1.28 * handedSide, -1.14 * handedSide, swingProgress) + wristFollow,
      bladeRoll: THREE.MathUtils.lerp(-0.18 * handedSide, 0.18 * handedSide, swingProgress) - (0.06 * handedSide * recoveryProgress),
      swingProgress,
      slashPulse,
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
    const handedSide = side * PLAYER_RIGHT_HAND_LOCAL_X;
    const weaponPose = this.getBladeSwingWeaponPoseValues(swing, elapsed);
    const swingProgress = weaponPose.swingProgress;
    const slashPulse = weaponPose.slashPulse;
    const cutCommit = Math.sin(Math.min(1, swingProgress / 0.72) * Math.PI);
    const bodyTwist = THREE.MathUtils.lerp(-0.38 * handedSide, 0.46 * handedSide, swingProgress);
    const recoveryEase = THREE.MathUtils.clamp(recovery, 0, 1);
    const strikePulse = Math.sin(THREE.MathUtils.clamp(strike, 0, 1) * Math.PI);
    const blendRotation = (node: THREE.Object3D, x: number, y: number, z: number, amount: number): void => {
      node.rotation.set(
        THREE.MathUtils.lerp(node.rotation.x, x, amount),
        THREE.MathUtils.lerp(node.rotation.y, y, amount),
        THREE.MathUtils.lerp(node.rotation.z, z, amount),
      );
    };

    chibi.root.position.y -= 0.018 + (0.02 * slashPulse) + (0.014 * strikePulse);
    chibi.root.position.z += 0.018 * cutCommit;
    chibi.torso.rotation.x = THREE.MathUtils.lerp(chibi.torso.rotation.x, 0.055 + (0.045 * slashPulse), 0.74);
    chibi.torso.rotation.y = THREE.MathUtils.lerp(chibi.torso.rotation.y, bodyTwist, 0.86);
    chibi.torso.rotation.z = THREE.MathUtils.lerp(chibi.torso.rotation.z, -0.08 * handedSide * slashPulse, 0.62);
    chibi.pelvis.rotation.x = THREE.MathUtils.lerp(chibi.pelvis.rotation.x, 0.045 + (0.028 * windup), 0.76);
    chibi.pelvis.rotation.y = THREE.MathUtils.lerp(chibi.pelvis.rotation.y, bodyTwist * 0.34, 0.78);
    chibi.head.rotation.x = THREE.MathUtils.lerp(chibi.head.rotation.x, 0.022 - (0.018 * slashPulse), 0.6);
    chibi.head.rotation.y = THREE.MathUtils.lerp(chibi.head.rotation.y, bodyTwist * -0.32, 0.72);

    const shoulder = chibi.rightShoulderPivot.position;
    const gripPoint = new THREE.Vector3(weaponPose.hiltX, weaponPose.hiltY, weaponPose.hiltZ);
    const bladeRotation = new THREE.Euler(weaponPose.bladePitch, weaponPose.bladeYaw, weaponPose.bladeRoll);
    const bladeForward = new THREE.Vector3(0, 0, 1).applyEuler(bladeRotation).normalize();
    const bladeRight = new THREE.Vector3(1, 0, 0).applyEuler(bladeRotation).normalize();
    const wristPoint = gripPoint.clone()
      .addScaledVector(bladeForward, -BLADE_SWING_WRIST_TO_GRIP)
      .addScaledVector(bladeRight, 0.012 * handedSide * (1 - slashPulse));
    wristPoint.y -= BLADE_SWING_WRIST_DROP_FROM_GRIP;
    const shoulderToWrist = wristPoint.clone().sub(shoulder);
    const hiltDistance = Math.max(0.001, shoulderToWrist.length());
    const hiltDirection = shoulderToWrist.clone().normalize();
    const upperArmLength = 0.31;
    const relaxedLowerArmLength = 0.29 + (0.055 * slashPulse) + (0.05 * swingProgress);
    const lowerArmLength = THREE.MathUtils.clamp(
      relaxedLowerArmLength,
      Math.max(0.22, hiltDistance - upperArmLength + 0.012),
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
      THREE.MathUtils.lerp(0.24 * handedSide, -0.12 * handedSide, swingProgress),
      -0.88,
      -0.4 - (0.24 * slashPulse),
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
    chibi.rightHandMount.rotateZ((-0.12 * handedSide * (1 - recoveryEase)) + (0.04 * handedSide * slashPulse));
    chibi.rightHand.position.set(0, -0.006, BLADE_SWING_WRIST_TO_GRIP * 0.82);
    chibi.rightHand.scale.set(0.92, 0.72, 0.62);

    blendRotation(
      chibi.leftUpperArm,
      0.34 + (0.045 * slashPulse),
      0.12 - (0.035 * bodyTwist),
      -0.3 - (0.05 * handedSide * slashPulse),
      0.74,
    );
    blendRotation(
      chibi.leftForearm,
      -0.56,
      0.06,
      -0.18 - (0.04 * handedSide * slashPulse),
      0.74,
    );

    const leftLeads = handedSide === 1;
    const leadThighX = 0.22 + (0.055 * slashPulse);
    const rearThighX = -0.06 - (0.04 * slashPulse);
    const leadShinX = 0.18 + (0.04 * slashPulse);
    const rearShinX = 0.28 + (0.035 * slashPulse);
    const leadFootX = -0.1 - (0.035 * strikePulse);
    const rearFootX = 0.14 + (0.035 * slashPulse);
    const plantAmount = 0.82;

    blendRotation(chibi.pelvis, 0.035, bodyTwist * 0.28, -0.055 * handedSide * slashPulse, plantAmount);

    blendRotation(
      chibi.leftThigh,
      leftLeads ? leadThighX : rearThighX,
      leftLeads ? 0.05 : -0.06,
      leftLeads ? 0.18 : -0.02,
      plantAmount,
    );
    blendRotation(
      chibi.rightThigh,
      leftLeads ? rearThighX : leadThighX,
      leftLeads ? 0.06 : -0.05,
      leftLeads ? 0.02 : -0.18,
      plantAmount,
    );
    blendRotation(chibi.leftShin, leftLeads ? leadShinX : rearShinX, 0, leftLeads ? -0.08 : -0.02, plantAmount);
    blendRotation(chibi.rightShin, leftLeads ? rearShinX : leadShinX, 0, leftLeads ? 0.02 : 0.08, plantAmount);
    blendRotation(chibi.leftFoot, leftLeads ? leadFootX : rearFootX, 0, leftLeads ? -0.12 : 0.04, plantAmount);
    blendRotation(chibi.rightFoot, leftLeads ? rearFootX : leadFootX, 0, leftLeads ? -0.04 : 0.12, plantAmount);
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
  }

  private syncCompanionActor(): void {
    const companion = this.options.getCompanion?.() ?? null;
    if (!companion) {
      if (this.companionActor) {
        this.dynamicGroup.remove(this.companionActor.group);
        disposeObject(this.companionActor.group);
        this.companionActor = null;
      }
      return;
    }

    if (!this.companionActor) {
      this.companionActor = this.createSableActor();
    }

    const actor = this.companionActor;
    actor.group.visible = true;
    const companionPoint = { x: companion.x, y: companion.y };
    const world = fieldToHavenWorld(this.options.map, companionPoint, this.getGroundElevationAtPoint(companionPoint) + 0.035);
    actor.group.position.set(world.x, world.y, world.z);
    const lookDirection = companion.target
      ? { x: companion.target.x - companion.x, y: companion.target.y - companion.y }
      : null;
    this.updateSableMotion(actor, companion, lookDirection);
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

    const avatar = this.options.getPlayerAvatar("P1");
    if (!avatar) {
      actor.telegraph.visible = false;
      return;
    }

    const currentTime = this.currentFrameTime || performance.now();
    const profile = getHaven3DEnemyAttackProfile(enemy);
    const isWindup = enemy.attackState === "windup";
    const isRecovery = enemy.attackState === "recovery";
    const distance = Math.hypot(enemy.x - avatar.x, enemy.y - avatar.y);
    const isLocked = this.targetLock?.kind === "enemy" && this.targetLock.id === enemy.id;
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
    actor.targetRing.visible = this.targetLock?.kind === kind && this.targetLock.id === id;
  }

  private getTargetCandidates(): Haven3DTargetCandidate[] {
    const avatar = this.options.getPlayerAvatar("P1");
    return createHaven3DTargetCandidates(
      avatar,
      this.options.getNpcs(),
      this.options.getEnemies(),
    );
  }

  private getLockedTargetCandidate(): Haven3DTargetCandidate | null {
    if (!this.targetLock) {
      return null;
    }

    const target = this.getTargetCandidates().find((candidate) => candidate.key === this.targetLock?.key) ?? null;
    if (!target || target.distance > TARGET_LOCK_BREAK_DISTANCE_PX) {
      this.targetLock = null;
      this.targetOrbitYawOffset = 0;
      return null;
    }
    return target;
  }

  private selectNextTarget(reverse = false): void {
    const targets = this.getTargetCandidates();
    this.targetLock = selectNextHaven3DTarget(targets, this.targetLock, reverse);
    this.targetOrbitYawOffset = 0;
    this.cameraYawPan = null;
  }

  private snapCameraToPlayerFacing(): void {
    const avatar = this.options.getPlayerAvatar("P1");
    if (!avatar) {
      return;
    }

    this.targetLock = null;
    this.targetOrbitYawOffset = 0;
    this.mouseDx = 0;
    this.mouseDy = 0;
    this.cameraYawPan = {
      startedAt: this.currentFrameTime || performance.now(),
      durationMs: CAMERA_FORWARD_PAN_DURATION_MS,
      fromYaw: this.yaw,
      toYaw: getCameraYawForFacing(avatar.facing),
    };
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
    const activeMode = this.activeMode ?? "blade";
    document.querySelectorAll<HTMLElement>("[data-gearblade-mode-selector]").forEach((selector) => {
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
  }

  private updatePrompt(): void {
    if (!this.promptElement) {
      return;
    }

    const prompt = this.options.getPrompt();
    const target = this.getLockedTargetCandidate();
    const targetText = target ? `TARGET :: ${target.label.toUpperCase()}` : null;
    const modeText = this.activeMode ? `MODE :: ${this.activeMode.toUpperCase()}` : null;
    const promptText = [prompt, targetText, modeText].filter(Boolean).join(" | ");
    this.promptElement.textContent = promptText;
    this.promptElement.classList.toggle("haven3d-prompt--visible", Boolean(promptText));
  }

  private resize(): void {
    const width = Math.max(1, this.options.host.clientWidth || window.innerWidth);
    const height = Math.max(1, this.options.host.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
    this.renderer.setSize(width, height, false);
  }
}

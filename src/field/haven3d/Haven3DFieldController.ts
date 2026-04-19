import * as THREE from "three";
import type { PlayerId } from "../../core/types";
import {
  getPlayerInput,
  handleKeyDown as handlePlayerInputKeyDown,
  handleKeyUp as handlePlayerInputKeyUp,
  isPlayerInputActionEvent,
} from "../../core/playerInput";
import type { FieldEnemy, FieldMap, FieldNpc, FieldObject, PlayerAvatar } from "../types";
import type { Companion } from "../companion";
import {
  HAVEN3D_FIELD_TILE_SIZE,
  HAVEN3D_WORLD_TILE_SIZE,
  canAvatarMoveTo,
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
  weaponForms?: Partial<Record<Haven3DGearbladeMode, THREE.Object3D>>;
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

type GearbladePartName = "blade" | "launcher" | "grapple";

type GearbladePartPose = {
  position: THREE.Vector3Tuple;
  rotation: THREE.Vector3Tuple;
  scale: THREE.Vector3Tuple;
};

type LauncherProjectile = {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttlMs: number;
  target: Haven3DTargetRef | null;
  radius: number;
  damage: number;
  knockback: number;
};

type PlayerVerticalState = {
  elevation: number;
  velocity: number;
  grounded: boolean;
  jumpStartedAt: number;
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
};

type GrappleAnchorTargetRef = {
  kind: "grapple-node";
  id: string;
  key: string;
};

type GrappleMoveState = {
  startedAt: number;
  target: Haven3DTargetRef | GrappleAnchorTargetRef;
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
  isFieldObjectVisible?: (objectId: string) => boolean;
  onPlayerFootstep?: (playerId: PlayerId, side: "left" | "right", speedRatio: number) => void;
  onBladeStrike?: (strike: Haven3DBladeStrike) => boolean;
  onLauncherImpact?: (impact: Haven3DLauncherImpact) => boolean;
  onGrappleImpact?: (impact: Haven3DGrappleImpact) => boolean;
  enableGearbladeModes?: boolean;
  enabledGearbladeModes?: readonly Haven3DGearbladeMode[];
};

const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 32;
const PLAYER_SPEED_PX_PER_SECOND = 278;
const DASH_MULTIPLIER = 1.65;
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
    farMin: 520,
    farScale: 1.6,
    lockedBaseDistance: 9.2,
    lockedTargetScale: 0.18,
    lockedTargetAddMax: 5.5,
    lockedMinDistance: 7.4,
    lockedMaxDistance: 16.2,
  },
  scene: {
    fogColor: 0x151f20,
    fogDensity: 0.0046,
    hemisphereIntensity: 0.66,
    sunIntensity: 3.85,
    fillIntensity: 0.92,
    rimIntensity: 0.82,
  },
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
    fogColor: 0x151b1c,
    fogDensity: 0.0158,
    hemisphereIntensity: 0.56,
    sunIntensity: 3.72,
    fillIntensity: 1.1,
    rimIntensity: 0.78,
  },
};
const CAMERA_FORWARD_PAN_DURATION_MS = 260;
const BLADE_SWING_WINDUP_MS = 300;
const BLADE_SWING_IMPACT_MS = 430;
const BLADE_SWING_TOTAL_MS = 1080;
const BLADE_SWING_RANGE_PX = 136;
const BLADE_SWING_ARC_RADIANS = Math.PI * 1.08;
const BLADE_SWING_HIT_WIDTH_PX = 17;
const BLADE_SWING_DAMAGE = 38;
const BLADE_SWING_KNOCKBACK = 620;
const BLADE_LUNGE_START_MS = 300;
const BLADE_LUNGE_END_MS = 560;
const BLADE_LUNGE_SPEED_PX_PER_SECOND = 205;
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
const PLAYER_JUMP_VELOCITY = 5.1;
const PLAYER_JUMP_GRAVITY = 15.2;
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
const ENEMY_PING_HEIGHT = 3.36;

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

function getGearbladePartPose(mode: Haven3DGearbladeMode, part: GearbladePartName): GearbladePartPose {
  switch (mode) {
    case "launcher":
      if (part === "blade") {
        return {
          position: [0.17, -0.08, 0.48],
          rotation: [0.08, 0.16, 0.74],
          scale: [0.48, 0.62, 0.58],
        };
      }
      if (part === "grapple") {
        return {
          position: [-0.12, 0.1, -0.05],
          rotation: [0.12, Math.PI / 2, 0.44],
          scale: [0.54, 0.58, 0.54],
        };
      }
      return {
        position: [0, 0.02, 0.16],
        rotation: [0, 0, 0],
        scale: [1.24, 1.12, 1.42],
      };
    case "grapple":
      if (part === "blade") {
        return {
          position: [-0.14, -0.08, 0.44],
          rotation: [0.04, -0.2, -0.58],
          scale: [0.56, 0.58, 0.66],
        };
      }
      if (part === "launcher") {
        return {
          position: [0.09, -0.04, -0.1],
          rotation: [0, 0.36, -0.14],
          scale: [0.82, 0.86, 0.82],
        };
      }
      return {
        position: [0, 0.04, 0.1],
        rotation: [0, 0, 0],
        scale: [1.28, 1.28, 1.28],
      };
    case "blade":
    default:
      if (part === "launcher") {
        return {
          position: [0.02, -0.09, -0.18],
          rotation: [0.08, -0.24, Math.PI * 0.5],
          scale: [0.44, 0.52, 0.68],
        };
      }
      if (part === "grapple") {
        return {
          position: [0.04, 0.07, -0.06],
          rotation: [0.12, Math.PI / 2, -0.26],
          scale: [0.46, 0.5, 0.46],
        };
      }
      return {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1.18, 1.16, 1.12],
      };
  }
}

function lerpTuple(from: THREE.Vector3Tuple, to: THREE.Vector3Tuple, amount: number): THREE.Vector3Tuple {
  return [
    THREE.MathUtils.lerp(from[0], to[0], amount),
    THREE.MathUtils.lerp(from[1], to[1], amount),
    THREE.MathUtils.lerp(from[2], to[2], amount),
  ];
}

function blendGearbladePartPose(
  fromMode: Haven3DGearbladeMode,
  toMode: Haven3DGearbladeMode,
  part: GearbladePartName,
  amount: number,
): GearbladePartPose {
  const from = getGearbladePartPose(fromMode, part);
  const to = getGearbladePartPose(toMode, part);
  return {
    position: lerpTuple(from.position, to.position, amount),
    rotation: lerpTuple(from.rotation, to.rotation, amount),
    scale: lerpTuple(from.scale, to.scale, amount),
  };
}

function applyGearbladePartPose(object: THREE.Object3D, pose: GearbladePartPose): void {
  object.position.set(...pose.position);
  object.rotation.set(...pose.rotation);
  object.scale.set(...pose.scale);
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
  leftUpperArm.position.set(-0.34, 0.98, 0.03);
  leftUpperArm.rotation.set(0.28, 0.1, -0.24);
  const leftUpperArmMesh = createChibiCapsule(0.085, 0.22, bodyMaterial, [0, -0.14, 0.01]);
  const leftForearm = new THREE.Group();
  leftForearm.position.set(0, -0.3, 0.03);
  leftForearm.rotation.set(-0.48, 0.05, -0.16);
  const leftForearmMesh = createChibiCapsule(0.075, 0.2, bodyMaterial, [0, -0.13, 0.02]);
  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), headMaterial);
  leftHand.position.set(0, -0.28, 0.04);
  leftHand.scale.set(0.9, 0.72, 0.62);
  leftHand.castShadow = true;
  leftForearm.add(leftForearmMesh, leftHand);
  leftUpperArm.add(leftUpperArmMesh, leftForearm);

  const rightUpperArm = new THREE.Group();
  rightUpperArm.position.set(0.34, 0.98, 0.03);
  rightUpperArm.rotation.set(0.26, -0.08, 0.24);
  const rightUpperArmMesh = createChibiCapsule(0.085, 0.22, bodyMaterial, [0, -0.14, 0.01]);
  const rightForearm = new THREE.Group();
  rightForearm.position.set(0, -0.3, 0.03);
  rightForearm.rotation.set(-0.46, -0.05, 0.16);
  const rightForearmMesh = createChibiCapsule(0.075, 0.2, bodyMaterial, [0, -0.13, 0.02]);
  const rightHandMount = new THREE.Group();
  rightHandMount.position.set(0, -0.28, 0.04);
  const rightHand = leftHand.clone();
  rightHand.position.set(0, 0, 0);
  rightHandMount.add(rightHand);
  rightForearm.add(rightForearmMesh, rightHandMount);
  rightUpperArm.add(rightUpperArmMesh, rightForearm);

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
    rightUpperArm,
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
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly worldGroup = new THREE.Group();
  private readonly dynamicGroup = new THREE.Group();
  private readonly playerActors = new Map<PlayerId, Actor>();
  private readonly npcActors = new Map<string, Actor>();
  private readonly enemyActors = new Map<string, Actor>();
  private readonly fieldObjectGroups = new Map<string, THREE.Object3D>();
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
  private readonly launcherProjectiles: LauncherProjectile[] = [];
  private readonly enemyHpSnapshot = new Map<string, number>();
  private readonly enemyHitReactions = new Map<string, EnemyHitReaction>();
  private readonly visualEffects: VisualEffect[] = [];
  private readonly playerVerticalStates = new Map<PlayerId, PlayerVerticalState>();
  private readonly grappleAnchors = new Map<string, GrappleAnchor>();
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

  isFieldObjectVisible(objectId: string): boolean {
    return this.fieldObjectGroups.get(objectId)?.visible === true;
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

    this.buildTileDeck();
    this.buildInteractionZones();
    this.buildFieldObjects();
    this.buildGrappleAnchors();
    this.createPlayerActor("P1", 0xd48342);
    this.createPlayerActor("P2", 0x7b66c9);
    this.syncDynamicActors();
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

  private buildTileDeck(): void {
    const walkableTiles = this.options.map.tiles.flatMap((row) => row.filter((tile) => tile.walkable));
    const doorWallTileMask = this.createHavenBuildingDoorWallTileMask();
    const wallTiles = this.options.map.tiles.flatMap((row) => row.filter((tile) => (
      !tile.walkable && !doorWallTileMask.has(`${tile.x},${tile.y}`)
    )));
    const walkableGeometry = new THREE.BoxGeometry(
      HAVEN3D_WORLD_TILE_SIZE * 0.98,
      0.1,
      HAVEN3D_WORLD_TILE_SIZE * 0.98,
    );
    const wallGeometry = new THREE.BoxGeometry(
      HAVEN3D_WORLD_TILE_SIZE,
      1.15,
      HAVEN3D_WORLD_TILE_SIZE,
    );
    const wallMaterial = createArdyciaToonMaterial({ color: 0x3d4144 });

    const matrix = new THREE.Matrix4();
    const walkableTilesByType = new Map<FieldMap["tiles"][number][number]["type"], typeof walkableTiles>();
    walkableTiles.forEach((tile) => {
      const typedTiles = walkableTilesByType.get(tile.type) ?? [];
      typedTiles.push(tile);
      walkableTilesByType.set(tile.type, typedTiles);
    });

    for (const [tileType, tiles] of walkableTilesByType.entries()) {
      const walkableMesh = new THREE.InstancedMesh(
        walkableGeometry.clone(),
        createArdyciaToonMaterial({ color: getHaven3DTileColor(tileType) }),
        tiles.length,
      );
      tiles.forEach((tile, index) => {
        const fieldPoint = {
          x: (tile.x + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
          y: (tile.y + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
        };
        const world = fieldToHavenWorld(this.options.map, {
          x: fieldPoint.x,
          y: fieldPoint.y,
        }, this.getGroundElevationAtPoint(fieldPoint) - 0.05);
        matrix.makeTranslation(world.x, world.y, world.z);
        walkableMesh.setMatrixAt(index, matrix);
      });
      walkableMesh.receiveShadow = true;
      this.worldGroup.add(walkableMesh);
    }

    const wallMesh = new THREE.InstancedMesh(wallGeometry, wallMaterial, wallTiles.length);
    wallTiles.forEach((tile, index) => {
      const fieldPoint = {
        x: (tile.x + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
        y: (tile.y + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
      };
      const world = fieldToHavenWorld(this.options.map, {
        x: fieldPoint.x,
        y: fieldPoint.y,
      }, this.getGroundElevationAtPoint(fieldPoint) + 0.52);
      matrix.makeTranslation(world.x, world.y, world.z);
      wallMesh.setMatrixAt(index, matrix);
    });
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;

    const wallOutlineMesh = new THREE.InstancedMesh(
      wallGeometry,
      createInvertedHullOutlineMaterial(),
      wallTiles.length,
    );
    const outlinePosition = new THREE.Vector3();
    const outlineRotation = new THREE.Quaternion();
    const outlineScale = new THREE.Vector3(
      ARDYCIA_TOON_OUTLINE_SCALE.architecture,
      ARDYCIA_TOON_OUTLINE_SCALE.architecture,
      ARDYCIA_TOON_OUTLINE_SCALE.architecture,
    );
    wallTiles.forEach((tile, index) => {
      const fieldPoint = {
        x: (tile.x + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
        y: (tile.y + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
      };
      const world = fieldToHavenWorld(this.options.map, {
        x: fieldPoint.x,
        y: fieldPoint.y,
      }, this.getGroundElevationAtPoint(fieldPoint) + 0.52);
      outlinePosition.set(world.x, world.y, world.z);
      matrix.compose(outlinePosition, outlineRotation, outlineScale);
      wallOutlineMesh.setMatrixAt(index, matrix);
    });
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
    const explicitAnchors = this.options.map.objects
      .filter((object) => object.metadata?.grappleAnchor === true)
      .map((object) => {
        const fieldCenter = {
          x: (object.x + (object.width / 2)) * HAVEN3D_FIELD_TILE_SIZE,
          y: (object.y + (object.height / 2)) * HAVEN3D_FIELD_TILE_SIZE,
        };
        const anchorHeight = Number(object.metadata?.anchorHeight);
        return {
          id: object.id,
          label: String(object.metadata?.name ?? "Swing Node"),
          fieldCenter,
          height: Number.isFinite(anchorHeight)
            ? anchorHeight
            : this.getGroundElevationAtPoint(fieldCenter) + GRAPPLE_NODE_HEIGHT,
        };
      });
    const sourcePoints = [
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
      });
    });
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

  private createOuterDeckFieldObjectGroup(
    placement: Haven3DSceneObjectPlacement,
    sourceObject: FieldObject | undefined,
  ): THREE.Group | null {
    const sprite = sourceObject?.sprite ?? "";
    const width = placement.worldSize.width;
    const depth = placement.worldSize.depth;
    const group = new THREE.Group();

    switch (sprite) {
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
    const group = this.createHavenBuildingGroup(placement, sourceObject)
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
        const group = this.createFieldObjectGroup(object, sourceObjectsById.get(object.id));
        group.name = `Haven3DFieldObject:${object.id}`;
        group.position.set(object.worldCenter.x, 0, object.worldCenter.z);
        this.fieldObjectGroups.set(object.id, group);
        this.worldGroup.add(group);
      });
    this.syncFieldObjectVisibility();
  }

  private syncFieldObjectVisibility(): void {
    for (const [objectId, group] of this.fieldObjectGroups.entries()) {
      group.visible = this.options.isFieldObjectVisible?.(objectId) ?? true;
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
    const gearGlow = createArdyciaToonMaterial({
      color: 0x58c1aa,
      emissive: 0x123c37,
      emissiveIntensity: 0.75,
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
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.42), leather);
    grip.position.z = -0.04;
    grip.castShadow = true;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.08), brass);
    guard.position.z = 0.2;
    guard.castShadow = true;
    const bladeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.08, 1.52),
      gearEdge,
    );
    bladeMesh.position.z = 1.02;
    bladeMesh.castShadow = true;
    const bladeTrail = new THREE.Mesh(
      new THREE.PlaneGeometry(1.95, 0.54),
      new THREE.MeshBasicMaterial({
        color: 0xf6d28a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    bladeTrail.name = "bladeTrail";
    bladeTrail.position.set(0.02, 0.02, 1.0);
    bladeTrail.rotation.x = Math.PI / 2;
    bladeTrail.visible = false;
    bladeForm.add(grip, guard, bladeMesh, bladeTrail);

    const launcherForm = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.86, 14), leather);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.42;
    barrel.castShadow = true;
    const chamber = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 10), brass);
    chamber.position.z = 0.02;
    chamber.castShadow = true;
    const sight = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.28),
      gearGlow,
    );
    sight.position.set(0, 0.16, -0.36);
    launcherForm.add(barrel, chamber, sight);

    const grappleForm = new THREE.Group();
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 8, 18), brass);
    coil.rotation.y = Math.PI / 2;
    const hookBase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.56, 10), leather);
    hookBase.rotation.x = Math.PI / 2;
    hookBase.position.z = -0.34;
    hookBase.castShadow = true;
    const hook = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.03, 8, 16, Math.PI * 1.35),
      gearGlow,
    );
    hook.position.z = -0.72;
    hook.rotation.x = Math.PI / 2;
    grappleForm.add(coil, hookBase, hook);

    applyGearbladePartPose(bladeForm, getGearbladePartPose("blade", "blade"));
    applyGearbladePartPose(launcherForm, getGearbladePartPose("blade", "launcher"));
    applyGearbladePartPose(grappleForm, getGearbladePartPose("blade", "grapple"));
    blade.add(bladeForm, launcherForm, grappleForm);
    anatomy.root.add(shoulderStrap, blade);
    addInvertedHullOutlines(anatomy.root, ARDYCIA_TOON_OUTLINE_SCALE.character);
    group.add(anatomy.root);
    this.dynamicGroup.add(group);
    this.playerActors.set(playerId, {
      group,
      chibi: anatomy,
      blade,
      bladeTrail,
      weaponForms: {
        blade: bladeForm,
        launcher: launcherForm,
        grapple: grappleForm,
      },
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
    this.updateGrappleAnchors(currentTime);
    this.syncDynamicActors();
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
        return;
      }

      moveX /= length;
      moveY /= length;
      const speed = PLAYER_SPEED_PX_PER_SECOND
        * (input.special1 ? DASH_MULTIPLIER : 1)
        * this.getActionMovementMultiplier(playerId);
      const step = speed * (deltaMs / 1000);
      let nextX = avatar.x + moveX * step;
      let nextY = avatar.y + moveY * step;
      const lockedTarget = playerId === "P1" ? this.getLockedTargetCandidate() : null;
      const facing = lockedTarget
        ? fieldFacingFromDelta(lockedTarget.x - avatar.x, lockedTarget.y - avatar.y, avatar.facing)
        : fieldFacingFromDelta(nextX - avatar.x, nextY - avatar.y, avatar.facing);

      if (!canAvatarMoveTo(this.options.map, nextX, avatar.y, PLAYER_WIDTH, PLAYER_HEIGHT)) {
        nextX = avatar.x;
      }
      if (!canAvatarMoveTo(this.options.map, nextX, nextY, PLAYER_WIDTH, PLAYER_HEIGHT)) {
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

  private getPlayerVerticalState(playerId: PlayerId): PlayerVerticalState {
    let state = this.playerVerticalStates.get(playerId);
    if (!state) {
      state = {
        elevation: 0,
        velocity: 0,
        grounded: true,
        jumpStartedAt: Number.NEGATIVE_INFINITY,
      };
      this.playerVerticalStates.set(playerId, state);
    }
    return state;
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
    if (!state.grounded || state.elevation > 0.025) {
      return;
    }

    state.grounded = false;
    state.elevation = 0.02;
    state.velocity = PLAYER_JUMP_VELOCITY;
    state.jumpStartedAt = this.currentFrameTime || performance.now();
    this.cameraImpulse.y += playerId === "P1" ? 0.045 : 0;
  }

  private updatePlayerVertical(deltaMs: number): void {
    const deltaSeconds = Math.min(0.05, Math.max(0, deltaMs / 1000));
    (["P1", "P2"] as PlayerId[]).forEach((playerId) => {
      const state = this.getPlayerVerticalState(playerId);
      if (playerId === "P1" && this.grappleMove?.target.kind === "grapple-node") {
        return;
      }
      if (state.grounded && state.elevation <= 0) {
        return;
      }

      state.velocity -= PLAYER_JUMP_GRAVITY * deltaSeconds;
      state.elevation += state.velocity * deltaSeconds;
      if (state.elevation <= 0) {
        state.elevation = 0;
        state.velocity = 0;
        state.grounded = true;
      } else {
        state.grounded = false;
      }
    });
  }

  private setPlayerSwingElevation(playerId: PlayerId, elevation: number): void {
    const state = this.getPlayerVerticalState(playerId);
    state.elevation = Math.max(0, elevation);
    state.velocity = 0;
    state.grounded = state.elevation <= 0.015;
  }

  private landPlayerVertical(playerId: PlayerId): void {
    const state = this.getPlayerVerticalState(playerId);
    state.elevation = 0;
    state.velocity = 0;
    state.grounded = true;
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

  private findGrappleAnchor(rangePx: number): GrappleAnchor | null {
    const avatar = this.options.getPlayerAvatar("P1");
    if (!avatar || this.grappleAnchors.size === 0) {
      return null;
    }

    const direction = this.getActionDirection(avatar);
    let best: GrappleAnchor | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const anchor of this.grappleAnchors.values()) {
      const distance = Math.hypot(anchor.x - avatar.x, anchor.y - avatar.y);
      if (distance > rangePx) {
        continue;
      }

      const toAnchor = { x: anchor.x - avatar.x, y: anchor.y - avatar.y };
      const length = Math.max(0.001, Math.hypot(toAnchor.x, toAnchor.y));
      const dot = ((toAnchor.x / length) * direction.x) + ((toAnchor.y / length) * direction.y);
      if (dot < 0.08 && distance > 118) {
        continue;
      }

      const score = distance * 0.03 + (1 - dot) * 4.2;
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
      if (canAvatarMoveTo(this.options.map, nextX, avatar.y, PLAYER_WIDTH, PLAYER_HEIGHT)) {
        lungeX = nextX;
      }
      if (canAvatarMoveTo(this.options.map, lungeX, nextY, PLAYER_WIDTH, PLAYER_HEIGHT)) {
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
        directionX: this.bladeSwing.direction.x,
        directionY: this.bladeSwing.direction.y,
        hiltX: strikeLine.hilt.x,
        hiltY: strikeLine.hilt.y,
        tipX: strikeLine.tip.x,
        tipY: strikeLine.tip.y,
        bladeHalfWidth: BLADE_SWING_HIT_WIDTH_PX,
        target: this.bladeSwing.target,
        radius: BLADE_SWING_RANGE_PX,
        arcRadians: BLADE_SWING_ARC_RADIANS,
        damage: BLADE_SWING_DAMAGE,
        knockback: BLADE_SWING_KNOCKBACK,
      }) ?? false;
      if (didHit) {
        this.beginImpactFeedback({
          x: avatar.x + this.bladeSwing.direction.x * 72,
          y: avatar.y + this.bladeSwing.direction.y * 72,
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
  ): { hilt: { x: number; y: number }; tip: { x: number; y: number } } {
    const forward = swing.direction;
    const right = { x: forward.y, y: -forward.x };
    const hilt = {
      x: avatar.x + forward.x * 20 + right.x * 14 * swing.side,
      y: avatar.y + forward.y * 20 + right.y * 14 * swing.side,
    };
    const tip = {
      x: hilt.x + forward.x * BLADE_SWING_RANGE_PX + right.x * -38 * swing.side,
      y: hilt.y + forward.y * BLADE_SWING_RANGE_PX + right.y * -38 * swing.side,
    };

    return { hilt, tip };
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
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 14, 10),
      createArdyciaToonMaterial({
        color: 0xf2b04d,
        emissive: 0x8c3f10,
        emissiveIntensity: 1.8,
      }),
    );
    const world = fieldToHavenWorld(this.options.map, originPoint, this.getGroundElevationAtPoint(originPoint) + 1.12);
    mesh.position.set(world.x, world.y, world.z);
    mesh.castShadow = true;
    this.dynamicGroup.add(mesh);

    this.launcherProjectiles.push({
      mesh,
      x: originX,
      y: originY,
      vx: direction.x * LAUNCHER_SPEED_PX_PER_SECOND,
      vy: direction.y * LAUNCHER_SPEED_PX_PER_SECOND,
      ttlMs: (LAUNCHER_RANGE_PX / LAUNCHER_SPEED_PX_PER_SECOND) * 1000,
      target,
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

      const hitEnemy = this.options.getEnemies()
        .filter((enemy) => enemy.hp > 0)
        .find((enemy) => Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) <= projectile.radius + Math.max(enemy.width, enemy.height) * 0.5);
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
    const anchor = lockedActionTarget ? null : this.findGrappleAnchor(GRAPPLE_RANGE_PX);
    const actionTarget = lockedActionTarget ?? (anchor ? null : this.findActionTarget(GRAPPLE_RANGE_PX));
    if (!avatar || (!anchor && !actionTarget)) {
      this.actionCooldownUntil = now + GRAPPLE_COOLDOWN_MS * 0.45;
      return;
    }

    const targetPoint = anchor
      ? { x: anchor.x, y: anchor.y }
      : { x: actionTarget?.x ?? avatar.x, y: actionTarget?.y ?? avatar.y };
    const targetRef: Haven3DTargetRef | GrappleAnchorTargetRef = anchor
      ? { kind: "grapple-node", id: anchor.id, key: anchor.key }
      : {
        kind: actionTarget!.kind,
        id: actionTarget!.id,
        key: actionTarget!.key,
      };
    const direction = this.getActionDirection(avatar, targetPoint);
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
      targetHeight: anchor?.height ?? this.getGroundElevationAtPoint(targetPoint) + 1.08,
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
    if (!canAvatarMoveTo(this.options.map, nextX, avatar.y, PLAYER_WIDTH, PLAYER_HEIGHT)) {
      nextX = avatar.x;
    }
    if (!canAvatarMoveTo(this.options.map, nextX, nextY, PLAYER_WIDTH, PLAYER_HEIGHT)) {
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

    this.setPlayerSwingElevation("P1", lift);
    this.options.setPlayerAvatar("P1", nextX, nextY, facing);
    this.updateGrappleLine();

    if (progress >= 1) {
      this.finishGrappleMove(true);
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

    const playerElevation = this.getPlayerVerticalState("P1").elevation;
    const avatarPoint = { x: avatar.x, y: avatar.y };
    const from = fieldToHavenWorld(this.options.map, avatarPoint, this.getGroundElevationAtPoint(avatarPoint) + 1.18 + playerElevation);
    const to = fieldToHavenWorld(this.options.map, this.grappleMove.targetPoint, this.grappleMove.targetHeight);
    this.grappleMove.line.geometry.setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    this.grappleMove.hook.position.set(to.x, to.y, to.z);
    this.grappleMove.hook.rotation.z += 0.18;
  }

  private finishGrappleMove(spawnSpark: boolean): void {
    if (!this.grappleMove) {
      return;
    }

    const wasSwing = this.grappleMove.target.kind === "grapple-node";
    if (spawnSpark) {
      this.spawnHitSpark(this.grappleMove.targetPoint, 0x4fb4a4);
    }
    this.dynamicGroup.remove(this.grappleMove.line, this.grappleMove.hook);
    disposeObject(this.grappleMove.line);
    disposeObject(this.grappleMove.hook);
    this.grappleMove = null;
    if (wasSwing) {
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
      const stateBoost = companion.state === "attack" ? 1.16 : companion.state === "fetch" ? 1.08 : 1;
      const cycleRate = THREE.MathUtils.clamp(motion.speedPxPerSecond / 36, 4.8, 14.2);
      motion.cycle += deltaSeconds * cycleRate * stateBoost;
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

    chibi.root.position.y = 0.18 + bob;
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
      THREE.MathUtils.lerp(0.28 + leftWalkArm, 1.18 + (0.08 * runAmount) + (0.46 * dashBurstPose) + (0.035 * armStream), streamPoseBlend),
      THREE.MathUtils.lerp(0.1, 0.34 + (0.14 * dashBurstPose) + (0.035 * armStream), streamPoseBlend),
      THREE.MathUtils.lerp(-0.24 - (0.06 * walkAmount), -0.5 - (0.04 * runAmount) - (0.18 * dashBurstPose), streamPoseBlend),
    );
    chibi.rightUpperArm.rotation.set(
      THREE.MathUtils.lerp(0.26 + rightWalkArm, 1.16 + (0.08 * runAmount) + (0.46 * dashBurstPose) - (0.035 * armStream), streamPoseBlend),
      THREE.MathUtils.lerp(-0.08, -0.34 - (0.14 * dashBurstPose) + (0.035 * armStream), streamPoseBlend),
      THREE.MathUtils.lerp(0.24 + (0.06 * walkAmount), 0.5 + (0.04 * runAmount) + (0.18 * dashBurstPose), streamPoseBlend),
    );
    chibi.leftForearm.rotation.set(
      THREE.MathUtils.lerp(-0.48 - (0.16 * walkAmount), 0.16 + (0.16 * dashBurstPose) + (0.045 * armStream), streamPoseBlend),
      THREE.MathUtils.lerp(0.05, 0.12 + (0.08 * dashBurstPose), streamPoseBlend),
      THREE.MathUtils.lerp(-0.16 - (0.04 * walkAmount), -0.08, streamPoseBlend),
    );
    chibi.rightForearm.rotation.set(
      THREE.MathUtils.lerp(-0.46 - (0.16 * walkAmount), 0.16 + (0.16 * dashBurstPose) - (0.045 * armStream), streamPoseBlend),
      THREE.MathUtils.lerp(-0.05, -0.12 - (0.08 * dashBurstPose), streamPoseBlend),
      THREE.MathUtils.lerp(0.16 + (0.04 * walkAmount), 0.08, streamPoseBlend),
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
    chibi.rightHandMount.position.set(0, -0.28, 0.04);
    chibi.rightHand.scale.set(0.9, 0.72, 0.62);
  }

  private applyChibiJumpPose(chibi: ChibiRig | undefined, vertical: PlayerVerticalState): void {
    if (!chibi || vertical.grounded) {
      return;
    }

    const liftBlend = THREE.MathUtils.clamp(vertical.elevation / 1.4, 0, 1);
    const risingBlend = vertical.velocity > 0
      ? THREE.MathUtils.clamp(vertical.velocity / PLAYER_JUMP_VELOCITY, 0, 1)
      : 0;
    const fallingBlend = vertical.velocity < 0
      ? THREE.MathUtils.clamp(Math.abs(vertical.velocity) / PLAYER_JUMP_VELOCITY, 0, 1)
      : 0;
    const tuck = Math.max(liftBlend, 0.42 + fallingBlend * 0.28);

    chibi.root.rotation.x += 0.1 * liftBlend;
    chibi.torso.rotation.x += 0.12 * liftBlend;
    chibi.head.rotation.x -= 0.05 * fallingBlend;
    chibi.leftUpperArm.rotation.x = THREE.MathUtils.lerp(chibi.leftUpperArm.rotation.x, 0.78, 0.32 + risingBlend * 0.18);
    chibi.rightUpperArm.rotation.x = THREE.MathUtils.lerp(chibi.rightUpperArm.rotation.x, 0.78, 0.32 + risingBlend * 0.18);
    chibi.leftUpperArm.rotation.z = THREE.MathUtils.lerp(chibi.leftUpperArm.rotation.z, -0.52, 0.34);
    chibi.rightUpperArm.rotation.z = THREE.MathUtils.lerp(chibi.rightUpperArm.rotation.z, 0.52, 0.34);
    chibi.leftForearm.rotation.x = THREE.MathUtils.lerp(chibi.leftForearm.rotation.x, -0.72, 0.3);
    chibi.rightForearm.rotation.x = THREE.MathUtils.lerp(chibi.rightForearm.rotation.x, -0.72, 0.3);
    chibi.leftThigh.rotation.x = THREE.MathUtils.lerp(chibi.leftThigh.rotation.x, 0.68, tuck);
    chibi.rightThigh.rotation.x = THREE.MathUtils.lerp(chibi.rightThigh.rotation.x, 0.48, tuck);
    chibi.leftShin.rotation.x = THREE.MathUtils.lerp(chibi.leftShin.rotation.x, 0.82, tuck);
    chibi.rightShin.rotation.x = THREE.MathUtils.lerp(chibi.rightShin.rotation.x, 0.72, tuck);
    chibi.leftFoot.rotation.x = THREE.MathUtils.lerp(chibi.leftFoot.rotation.x, -0.18, tuck);
    chibi.rightFoot.rotation.x = THREE.MathUtils.lerp(chibi.rightFoot.rotation.x, -0.08, tuck);
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
    const attackIntent = companion.state === "attack" ? 1 : 0;
    const fetchIntent = companion.state === "fetch" ? 1 : 0;
    const alertBlend = Math.max(attackIntent, fetchIntent * 0.58);
    const cycle = motion.cycle;
    const stride = Math.sin(cycle);
    const counterStride = Math.sin(cycle + Math.PI);
    const doubleStep = Math.sin((cycle * 2) + 0.2);
    const stepLift = Math.abs(Math.sin(cycle));
    const idleBreath = Math.sin(currentTime * 0.003 + cycle * 0.12);
    const wagSpeed = companion.state === "idle" ? 0.006 : companion.state === "attack" ? 0.021 : 0.014;
    const wagAmount = 0.18 + (0.18 * moveBlend) + (0.2 * alertBlend);
    const lean = 0.025 + (0.06 * moveBlend) + (0.1 * runBlend) + (0.07 * alertBlend);

    sable.root.position.y = 0.13
      + (idleBreath * 0.01 * (1 - moveBlend))
      + (stepLift * 0.018 * moveBlend)
      + (Math.abs(doubleStep) * 0.018 * runBlend);
    sable.root.rotation.set(lean, 0, doubleStep * 0.018 * moveBlend);
    sable.body.rotation.set(
      0.045 + (0.055 * runBlend) + (0.035 * alertBlend),
      stride * 0.028 * moveBlend,
      doubleStep * 0.026 * moveBlend,
    );
    sable.chest.rotation.set(
      -0.02 + (0.06 * runBlend) + (0.04 * alertBlend),
      -stride * 0.018 * moveBlend,
      -doubleStep * 0.018 * moveBlend,
    );
    sable.head.rotation.set(
      -0.045 - (0.035 * runBlend) + (0.06 * alertBlend) + (idleBreath * 0.018 * (1 - moveBlend)),
      -stride * 0.045 * moveBlend,
      -doubleStep * 0.028 * moveBlend,
    );
    sable.snout.position.z = 0.27 + (alertBlend * Math.sin(currentTime * 0.018) * 0.012);
    sable.tail.rotation.set(
      -0.46 - (0.1 * alertBlend) + (0.07 * runBlend),
      Math.sin((currentTime * wagSpeed) + cycle * 0.22) * wagAmount,
      Math.cos((currentTime * wagSpeed) + cycle * 0.18) * 0.08 * (0.4 + moveBlend),
    );

    const strideAmount = ((0.34 * moveBlend) + (0.42 * runBlend)) * (1 + alertBlend * 0.18);
    const legLift = 0.025 * moveBlend + (0.025 * runBlend);
    const frontLeftLift = Math.max(0, stride) * legLift;
    const frontRightLift = Math.max(0, counterStride) * legLift;
    const rearLeftLift = Math.max(0, counterStride) * legLift;
    const rearRightLift = Math.max(0, stride) * legLift;

    sable.frontLeftLeg.position.y = 0.52 + frontLeftLift;
    sable.frontRightLeg.position.y = 0.52 + frontRightLift;
    sable.rearLeftLeg.position.y = 0.52 + rearLeftLift;
    sable.rearRightLeg.position.y = 0.52 + rearRightLift;
    sable.frontLeftLeg.rotation.set(0.08 + (stride * strideAmount), 0.018 * moveBlend, -0.055);
    sable.frontRightLeg.rotation.set(0.08 + (counterStride * strideAmount), -0.018 * moveBlend, 0.055);
    sable.rearLeftLeg.rotation.set(0.02 + (counterStride * strideAmount * 0.92), -0.012 * moveBlend, -0.045);
    sable.rearRightLeg.rotation.set(0.02 + (stride * strideAmount * 0.92), 0.012 * moveBlend, 0.045);
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

  private spawnHitSpark(point: { x: number; y: number }, color: number): void {
    const world = fieldToHavenWorld(this.options.map, point, this.getGroundElevationAtPoint(point) + 0.62);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 24), material);
    ring.position.set(world.x, world.y, world.z);
    ring.rotation.x = Math.PI / 2;
    ring.renderOrder = 22;
    this.dynamicGroup.add(ring);
    this.visualEffects.push({
      object: ring,
      startedAt: this.currentFrameTime || performance.now(),
      durationMs: 260,
      velocity: new THREE.Vector3(0, 1.15, 0),
      spin: 8.5,
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
    const playerElevation = avatar ? this.getPlayerVerticalState("P1").elevation : 0;
    const playerPoint = avatar ? { x: avatar.x, y: avatar.y } : null;
    const playerWorld = avatar && playerPoint
      ? fieldToHavenWorld(this.options.map, playerPoint, this.getGroundElevationAtPoint(playerPoint) + 1.15 + playerElevation)
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
    const world = fieldToHavenWorld(this.options.map, avatarPoint, this.getGroundElevationAtPoint(avatarPoint) + 0.04);
    const vertical = this.getPlayerVerticalState(playerId);
    const lockedTarget = playerId === "P1" ? this.getLockedTargetCandidate() : null;
    actor.group.position.set(world.x, world.y + vertical.elevation, world.z);
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
      getPlayerInput(playerId).special1,
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
    if (activeMode && transform && !this.bladeSwing) {
      actor.blade.visible = true;
      this.applyGearbladeTransformBodyPose(actor, transform);
      this.mountBladeOnSwingHand(actor);
      this.updateGearbladeTransformWeaponPose(actor, transform);
      this.hideBladeTrail(actor);
      return;
    }

    if (activeMode !== "blade") {
      actor.blade.visible = true;
      const recoilElapsed = (this.currentFrameTime || performance.now()) - this.launcherRecoilStartedAt;
      const recoil = activeMode === "launcher" && recoilElapsed >= 0 && recoilElapsed < LAUNCHER_RECOIL_MS
        ? Math.sin((1 - recoilElapsed / LAUNCHER_RECOIL_MS) * Math.PI)
        : 0;
      const grapplePulse = activeMode === "grapple" && this.grappleMove
        ? Math.sin(((this.currentFrameTime || performance.now()) - this.grappleMove.startedAt) * 0.018) * 0.06
        : 0;

      if (isTargetReady && activeMode) {
        this.applyTargetReadyBodyPose(actor, activeMode);
        this.mountBladeOnSwingHand(actor);
        this.updateTargetReadyWeaponPose(actor, activeMode, recoil, grapplePulse);
        this.hideBladeTrail(actor);
        return;
      }

      this.mountBladeOnChibiRoot(actor);
      actor.blade.position.set(0.42, 0.98, 0.22 - recoil * 0.18);
      actor.blade.rotation.set(-0.54 + grapplePulse, 0.18, -0.16);
      this.hideBladeTrail(actor);
      return;
    }

    const swing = playerId === "P1" ? this.bladeSwing : null;
    if (!swing) {
      actor.blade.visible = true;
      if (isTargetReady && activeMode) {
        this.applyTargetReadyBodyPose(actor, activeMode);
        this.mountBladeOnSwingHand(actor);
        this.updateTargetReadyWeaponPose(actor, activeMode);
        this.hideBladeTrail(actor);
        return;
      }

      this.mountBladeOnChibiRoot(actor);
      actor.blade.position.copy(BLADE_BACK_POSITION);
      actor.blade.rotation.copy(BLADE_BACK_ROTATION);
      this.hideBladeTrail(actor);
      return;
    }

    actor.blade.visible = true;
    const elapsed = this.currentFrameTime - swing.startedAt;
    const windup = smoothstep(elapsed / BLADE_SWING_WINDUP_MS);
    const strike = smoothstep((elapsed - BLADE_SWING_WINDUP_MS) / (BLADE_LUNGE_END_MS - BLADE_SWING_WINDUP_MS));
    const recovery = smoothstep((elapsed - BLADE_LUNGE_END_MS) / (BLADE_SWING_TOTAL_MS - BLADE_LUNGE_END_MS));
    const side = swing.side;
    this.applyBladeSwingArmPose(actor, swing, elapsed, windup, strike, recovery);
    this.mountBladeOnSwingHand(actor);
    this.updateHeldBladeSwingPose(actor, side, elapsed, windup, strike, recovery);

    if (actor.bladeTrail) {
      const active = elapsed >= BLADE_SWING_WINDUP_MS && elapsed <= BLADE_LUNGE_END_MS + 70;
      actor.bladeTrail.visible = active;
      const material = actor.bladeTrail instanceof THREE.Mesh ? actor.bladeTrail.material : null;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = active ? 0.32 + (0.44 * (1 - recovery)) : 0;
      }
    }
  }

  private hideBladeTrail(actor: Actor): void {
    if (!actor.bladeTrail) {
      return;
    }

    actor.bladeTrail.visible = false;
    const material = actor.bladeTrail instanceof THREE.Mesh ? actor.bladeTrail.material : null;
    if (material instanceof THREE.MeshBasicMaterial) {
      material.opacity = 0;
    }
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

    chibi.rightUpperArm.rotation.set(
      isBlade ? 0.32 : 0.24,
      isBlade ? -0.12 : -0.1,
      isBlade ? 0.44 : 0.34,
    );
    chibi.rightForearm.rotation.set(
      isBlade ? -0.64 : -0.56,
      isBlade ? 0.06 : 0.02,
      isBlade ? 0.18 : 0.16,
    );

    chibi.leftUpperArm.rotation.set(
      0.3,
      0.1,
      -0.24,
    );
    chibi.leftForearm.rotation.set(
      -0.5,
      0.05,
      -0.16,
    );

    chibi.rightHandMount.position.set(0, -0.3, isBlade ? 0.07 : 0.08);
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
      actor.blade.position.set(0.02, -0.03 + idleLift, 0.16);
      actor.blade.rotation.set(0.25, 0.4, -0.2);
      return;
    }

    if (activeMode === "launcher") {
      actor.blade.position.set(0.03, -0.02 + idleLift, 0.1 - recoil * 0.08);
      actor.blade.rotation.set(0.16 - recoil * 0.08, 0.18, -0.12);
      return;
    }

    actor.blade.position.set(0.03, -0.02 + idleLift, 0.1);
    actor.blade.rotation.set(0.12 + grapplePulse, 0.22, -0.1);
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

    chibi.rightUpperArm.rotation.set(
      THREE.MathUtils.lerp(-0.22, 0.34, settle) - (0.32 * pulse),
      THREE.MathUtils.lerp(-0.28, -0.1, settle) - (0.1 * pulse),
      THREE.MathUtils.lerp(0.76, 0.38, settle) + (0.24 * side * pulse),
    );
    chibi.rightForearm.rotation.set(
      THREE.MathUtils.lerp(-0.78, -0.5, settle) - (0.16 * pulse),
      THREE.MathUtils.lerp(0.22, 0.04, settle),
      THREE.MathUtils.lerp(0.42, 0.16, settle) + (0.16 * side * pulse),
    );
    chibi.leftUpperArm.rotation.set(
      THREE.MathUtils.lerp(-0.18, 0.22, settle) - (0.12 * pulse),
      0.18 * side,
      THREE.MathUtils.lerp(-0.82 * side, -0.28, settle),
    );
    chibi.leftForearm.rotation.set(
      THREE.MathUtils.lerp(-0.72, -0.46, settle),
      -0.18 * side,
      THREE.MathUtils.lerp(-0.44 * side, -0.12, settle),
    );
    chibi.rightHandMount.position.set(0, -0.29 + (0.035 * pulse), 0.08 + (0.08 * pulse));
  }

  private updateGearbladeTransformWeaponPose(actor: Actor, transform: GearbladeTransformSnapshot): void {
    if (!actor.blade) {
      return;
    }

    const shudder = Math.sin(transform.t * Math.PI * 4);
    actor.blade.position.set(
      0.03 + (0.018 * shudder * transform.pulse),
      -0.03 + (0.055 * transform.pulse),
      0.17 + (0.11 * transform.pulse),
    );
    actor.blade.rotation.set(
      THREE.MathUtils.lerp(0.24, 0.12, transform.eased) - (0.26 * transform.pulse),
      THREE.MathUtils.lerp(0.48, 0.22, transform.eased) + (0.18 * transform.pulse),
      THREE.MathUtils.lerp(-0.26, -0.1, transform.eased) + (0.26 * shudder * transform.pulse),
    );
  }

  private mountBladeOnChibiRoot(actor: Actor): void {
    if (!actor.blade || !actor.chibi || actor.blade.parent === actor.chibi.root) {
      return;
    }

    actor.chibi.root.attach(actor.blade);
  }

  private mountBladeOnSwingHand(actor: Actor): void {
    if (!actor.blade || !actor.chibi || actor.blade.parent === actor.chibi.rightHandMount) {
      return;
    }

    actor.chibi.rightHandMount.attach(actor.blade);
  }

  private updateHeldBladeSwingPose(
    actor: Actor,
    side: 1 | -1,
    elapsed: number,
    windup: number,
    strike: number,
    recovery: number,
  ): void {
    if (!actor.blade) {
      return;
    }

    const impactBias = elapsed >= BLADE_SWING_WINDUP_MS && elapsed < BLADE_LUNGE_END_MS
      ? Math.sin(strike * Math.PI)
      : 0;
    const heavyArc = Math.sin(THREE.MathUtils.clamp(elapsed / BLADE_SWING_TOTAL_MS, 0, 1) * Math.PI);
    const shudder = Math.sin(elapsed * 0.055) * impactBias * 0.045;
    actor.blade.position.set(
      (0.03 * side) + shudder,
      -0.04 + 0.035 * impactBias,
      0.2 + 0.12 * impactBias + 0.04 * heavyArc,
    );

    if (elapsed < BLADE_SWING_WINDUP_MS) {
      actor.blade.rotation.set(
        THREE.MathUtils.lerp(-0.12, -0.68, windup),
        THREE.MathUtils.lerp(0.28 * side, 1.16 * side, windup),
        THREE.MathUtils.lerp(-0.28 * side, 0.52 * side, windup),
      );
      return;
    }

    if (elapsed < BLADE_LUNGE_END_MS) {
      const snap = 1 - ((1 - strike) ** 1.72);
      actor.blade.rotation.set(
        THREE.MathUtils.lerp(-0.68, 0.34, snap),
        THREE.MathUtils.lerp(1.16 * side, -1.18 * side, snap),
        THREE.MathUtils.lerp(0.52 * side, -0.82 * side, snap),
      );
      return;
    }

    actor.blade.rotation.set(
      THREE.MathUtils.lerp(0.34, -0.12, recovery),
      THREE.MathUtils.lerp(-1.18 * side, 0.28 * side, recovery),
      THREE.MathUtils.lerp(-0.82 * side, -0.18 * side, recovery),
    );
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
    const impactBias = elapsed >= BLADE_SWING_WINDUP_MS && elapsed < BLADE_LUNGE_END_MS
      ? Math.sin(strike * Math.PI)
      : 0;
    const armStrike = 1 - ((1 - strike) ** 1.45);
    const plant = elapsed < BLADE_SWING_WINDUP_MS
      ? windup
      : elapsed < BLADE_LUNGE_END_MS
        ? 1
        : 1 - recovery;
    const counter = elapsed < BLADE_SWING_WINDUP_MS
      ? windup
      : elapsed < BLADE_LUNGE_END_MS
        ? armStrike
        : 1 - recovery;
    const blendRotation = (node: THREE.Object3D, x: number, y: number, z: number, amount: number): void => {
      node.rotation.set(
        THREE.MathUtils.lerp(node.rotation.x, x, amount),
        THREE.MathUtils.lerp(node.rotation.y, y, amount),
        THREE.MathUtils.lerp(node.rotation.z, z, amount),
      );
    };

    if (elapsed < BLADE_SWING_WINDUP_MS) {
      chibi.rightUpperArm.rotation.set(
        THREE.MathUtils.lerp(0.26, -1.82, windup),
        THREE.MathUtils.lerp(-0.08, -0.72 * side, windup),
        THREE.MathUtils.lerp(0.24, 1.48 * side, windup),
      );
      chibi.rightForearm.rotation.set(
        THREE.MathUtils.lerp(-0.46, -1.2, windup),
        THREE.MathUtils.lerp(-0.05, 0.58 * side, windup),
        THREE.MathUtils.lerp(0.16, 1.18 * side, windup),
      );
      chibi.torso.rotation.y = THREE.MathUtils.lerp(0, -0.54 * side, windup);
      chibi.torso.rotation.z += -0.08 * side * windup;
      chibi.head.rotation.y = THREE.MathUtils.lerp(0, 0.24 * side, windup);
      blendRotation(chibi.leftUpperArm, -0.46, 0.34 * side, -1.08 * side, counter);
      blendRotation(chibi.leftForearm, -0.9, 0.26 * side, -0.72 * side, counter);
    } else if (elapsed < BLADE_LUNGE_END_MS) {
      chibi.rightUpperArm.rotation.set(
        THREE.MathUtils.lerp(-1.82, 1.38, armStrike),
        THREE.MathUtils.lerp(-0.72 * side, 1.12 * side, armStrike),
        THREE.MathUtils.lerp(1.48 * side, -1.86 * side, armStrike),
      );
      chibi.rightForearm.rotation.set(
        THREE.MathUtils.lerp(-1.2, 0.28, armStrike),
        THREE.MathUtils.lerp(0.58 * side, -0.96 * side, armStrike),
        THREE.MathUtils.lerp(1.18 * side, -1.28 * side, armStrike),
      );
      chibi.torso.rotation.y = THREE.MathUtils.lerp(-0.54 * side, 0.78 * side, armStrike);
      chibi.torso.rotation.z += 0.34 * side * impactBias;
      chibi.head.rotation.y = THREE.MathUtils.lerp(0.24 * side, -0.34 * side, armStrike);
      blendRotation(chibi.leftUpperArm, 0.88, -0.78 * side, 1.34 * side, counter);
      blendRotation(chibi.leftForearm, -0.62, 0.56 * side, 0.92 * side, counter);
    } else {
      chibi.rightUpperArm.rotation.set(
        THREE.MathUtils.lerp(1.38, 0.26, recovery),
        THREE.MathUtils.lerp(1.12 * side, -0.08, recovery),
        THREE.MathUtils.lerp(-1.86 * side, 0.24, recovery),
      );
      chibi.rightForearm.rotation.set(
        THREE.MathUtils.lerp(0.28, -0.46, recovery),
        THREE.MathUtils.lerp(-0.96 * side, -0.05, recovery),
        THREE.MathUtils.lerp(-1.28 * side, 0.16, recovery),
      );
      chibi.torso.rotation.y = THREE.MathUtils.lerp(0.78 * side, 0, recovery);
      chibi.head.rotation.y = THREE.MathUtils.lerp(-0.34 * side, 0, recovery);
      chibi.leftUpperArm.rotation.set(
        THREE.MathUtils.lerp(0.88, 0.28, recovery),
        THREE.MathUtils.lerp(-0.78 * side, 0.1, recovery),
        THREE.MathUtils.lerp(1.34 * side, -0.24, recovery),
      );
      chibi.leftForearm.rotation.set(
        THREE.MathUtils.lerp(-0.62, -0.48, recovery),
        THREE.MathUtils.lerp(0.56 * side, 0.05, recovery),
        THREE.MathUtils.lerp(0.92 * side, -0.16, recovery),
      );
    }

    const leftLeads = side === 1;
    const leadThighX = 0.48 + 0.08 * impactBias;
    const rearThighX = -0.18 - 0.05 * impactBias;
    const leadShinX = 0.24 + 0.12 * impactBias;
    const rearShinX = 0.62 + 0.16 * impactBias;
    const leadFootX = -0.18 - 0.06 * impactBias;
    const rearFootX = 0.28 + 0.08 * impactBias;
    const plantAmount = THREE.MathUtils.clamp(plant, 0, 1);

    chibi.root.position.y -= 0.038 * plantAmount + 0.026 * impactBias;
    blendRotation(chibi.pelvis, 0.1, -0.2 * side, -0.12 * side, plantAmount);
    chibi.torso.rotation.x = THREE.MathUtils.lerp(chibi.torso.rotation.x, -0.18, plantAmount);
    chibi.head.rotation.x = THREE.MathUtils.lerp(chibi.head.rotation.x, 0.1, plantAmount);

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

    const handPulse = 1 + 0.16 * impactBias;
    chibi.rightHandMount.position.set(0, -0.28 + 0.05 * impactBias, 0.04 + 0.24 * impactBias);
    chibi.rightHand.scale.set(0.9 * handPulse, 0.72 * handPulse, 0.62 * handPulse);
  }

  private updatePlayerWeaponForm(
    actor: Actor,
    activeMode: Haven3DGearbladeMode | null,
    transform: GearbladeTransformSnapshot | null = null,
  ): void {
    if (actor.blade) {
      actor.blade.scale.setScalar(1 + ((transform?.pulse ?? 0) * 0.05));
    }

    if (!activeMode) {
      for (const object of Object.values(actor.weaponForms ?? {})) {
        object.visible = false;
      }
      return;
    }

    for (const [mode, object] of Object.entries(actor.weaponForms ?? {}) as Array<[GearbladePartName, THREE.Object3D]>) {
      object.visible = true;
      const pose = transform
        ? blendGearbladePartPose(transform.from, transform.to, mode, transform.eased)
        : getGearbladePartPose(activeMode, mode);
      applyGearbladePartPose(object, pose);

      if (transform) {
        const snapDirection = mode === "blade" ? 1 : mode === "launcher" ? -0.7 : 0.9;
        object.rotation.z += transform.pulse * snapDirection * 0.18;
        object.rotation.y += Math.sin(transform.t * Math.PI * 4) * transform.pulse * 0.08;
        object.position.y += transform.pulse * (mode === "launcher" ? 0.05 : 0.035);
      }
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
        this.spawnHitSpark({ x: enemy.x, y: enemy.y }, 0xf2b04d);
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
      this.updateEnemyHitReaction(actor, enemy.id, widthScale, heightScale);
      this.updateEnemyDefenseVisuals(actor, enemy);
      this.updateEnemyTelegraph(actor, enemy);
      this.updateActorTargetRing(actor, "enemy", enemy.id);
    });
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
    this.modeElements.forEach((element) => {
      const mode = element.dataset.haven3dMode as Haven3DGearbladeMode | undefined;
      const isEnabled = Boolean(mode && this.enabledModes.has(mode));
      const isActive = Boolean(mode && this.activeMode === mode);
      element.hidden = !isEnabled;
      element.classList.toggle("haven3d-mode-chip--active", isActive);
      element.setAttribute("aria-pressed", String(isActive));
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
  }
}

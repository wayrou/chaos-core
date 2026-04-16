import * as THREE from "three";
import type { PlayerId } from "../../core/types";
import {
  getPlayerInput,
  handleKeyDown as handlePlayerInputKeyDown,
  handleKeyUp as handlePlayerInputKeyUp,
  isPlayerInputActionEvent,
} from "../../core/playerInput";
import type { FieldEnemy, FieldMap, FieldNpc, PlayerAvatar } from "../types";
import {
  HAVEN3D_FIELD_TILE_SIZE,
  HAVEN3D_WORLD_TILE_SIZE,
  canAvatarMoveTo,
  createHaven3DSceneLayout,
  fieldFacingFromDelta,
  fieldToHavenWorld,
  type Haven3DGearbladeMode,
  type Haven3DModeController,
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

type FieldAvatarView = {
  x: number;
  y: number;
  facing: PlayerAvatar["facing"];
};

type Actor = {
  group: THREE.Group;
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

type Haven3DBladeStrike = {
  playerId: PlayerId;
  x: number;
  y: number;
  facing: PlayerAvatar["facing"];
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

type GrappleMoveState = {
  startedAt: number;
  target: Haven3DTargetRef;
  targetPoint: { x: number; y: number };
  impacted: boolean;
  line: THREE.Line;
  hook: THREE.Mesh;
};

type ReactiveMaterial = {
  material: THREE.MeshStandardMaterial;
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
};

type Haven3DFieldControllerOptions = {
  host: HTMLElement;
  map: FieldMap;
  getNpcs: () => FieldNpc[];
  getEnemies: () => FieldEnemy[];
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
  onBladeStrike?: (strike: Haven3DBladeStrike) => void;
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
const BLADE_SWING_WINDUP_MS = 240;
const BLADE_SWING_IMPACT_MS = 330;
const BLADE_SWING_TOTAL_MS = 860;
const BLADE_SWING_RANGE_PX = 102;
const BLADE_SWING_ARC_RADIANS = Math.PI * 0.82;
const BLADE_SWING_DAMAGE = 38;
const BLADE_SWING_KNOCKBACK = 620;
const BLADE_LUNGE_START_MS = 250;
const BLADE_LUNGE_END_MS = 430;
const BLADE_LUNGE_SPEED_PX_PER_SECOND = 148;
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
const ENEMY_HIT_REACTION_MS = 320;
const ENEMY_TELEGRAPH_RANGE_PX = 118;
const ENEMY_DANGER_RANGE_PX = 58;
const ENEMY_ATTACK_WINDUP_MS = 760;
const ENEMY_ATTACK_RECOVERY_MS = 680;

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
  marker.position.y = 2.05;
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
  private grappleMove: GrappleMoveState | null = null;
  private readonly launcherProjectiles: LauncherProjectile[] = [];
  private readonly enemyHpSnapshot = new Map<string, number>();
  private readonly enemyHitReactions = new Map<string, EnemyHitReaction>();
  private readonly visualEffects: VisualEffect[] = [];
  private modeElements: HTMLElement[] = [];
  private currentFrameTime = 0;

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
      CAMERA_MIN_DISTANCE,
      CAMERA_MAX_DISTANCE,
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

    if (event.code === "KeyZ" || event.key === "z" || event.key === "Z") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) {
        this.selectNextTarget(event.shiftKey);
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
    this.modeController = createHaven3DModeController({
      enableGearbladeModes: options.enableGearbladeModes === true,
      enabledModes: options.enabledGearbladeModes,
      initialMode: "blade",
    });
    this.activeGearbladeMode = this.modeController.activeMode;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

    this.activeGearbladeMode = mode;
    if (mode !== "blade") {
      this.bladeSwing = null;
    }
    if (mode !== "grapple") {
      this.finishGrappleMove(false);
    }
    this.updateModeHud();
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

  private buildScene(): void {
    this.scene.background = new THREE.Color(0x151816);
    this.scene.fog = new THREE.Fog(0x151816, 44, 150);

    const hemi = new THREE.HemisphereLight(0xe4d5b5, 0x111412, 1.75);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xf0c98f, 2.45);
    sun.position.set(18, 30, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 42;
    sun.shadow.camera.bottom = -42;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0x6bb8a8, 0.56);
    fill.position.set(-18, 10, -18);
    this.scene.add(fill);

    this.buildTileDeck();
    this.buildInteractionZones();
    this.buildFieldObjects();
    this.createPlayerActor("P1", 0xd48342);
    this.createPlayerActor("P2", 0x7b66c9);
    this.syncDynamicActors();
  }

  private buildTileDeck(): void {
    const walkableTiles = this.options.map.tiles.flatMap((row) => row.filter((tile) => tile.walkable));
    const wallTiles = this.options.map.tiles.flatMap((row) => row.filter((tile) => !tile.walkable));
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
    const deckMaterial = new THREE.MeshStandardMaterial({
      color: 0x55493a,
      roughness: 0.86,
      metalness: 0.14,
    });
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d4144,
      roughness: 0.78,
      metalness: 0.18,
    });

    const matrix = new THREE.Matrix4();
    const walkableMesh = new THREE.InstancedMesh(walkableGeometry, deckMaterial, walkableTiles.length);
    walkableTiles.forEach((tile, index) => {
      const world = fieldToHavenWorld(this.options.map, {
        x: (tile.x + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
        y: (tile.y + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
      }, -0.05);
      matrix.makeTranslation(world.x, world.y, world.z);
      walkableMesh.setMatrixAt(index, matrix);
    });
    walkableMesh.receiveShadow = true;
    this.worldGroup.add(walkableMesh);

    const wallMesh = new THREE.InstancedMesh(wallGeometry, wallMaterial, wallTiles.length);
    wallTiles.forEach((tile, index) => {
      const world = fieldToHavenWorld(this.options.map, {
        x: (tile.x + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
        y: (tile.y + 0.5) * HAVEN3D_FIELD_TILE_SIZE,
      }, 0.52);
      matrix.makeTranslation(world.x, world.y, world.z);
      wallMesh.setMatrixAt(index, matrix);
    });
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    this.worldGroup.add(wallMesh);
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

  private buildFieldObjects(): void {
    createHaven3DSceneLayout(this.options.map).objects
      .forEach((object) => {
        const color = object.type === "station"
          ? 0x8d6840
          : object.type === "door"
            ? 0x5d6c73
            : object.type === "resource"
              ? 0x66a872
              : 0x665c4f;
        const material = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.72,
          metalness: object.type === "station" ? 0.34 : 0.16,
        });
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(object.worldSize.width, object.worldSize.height, object.worldSize.depth),
          material,
        );
        mesh.position.set(object.worldCenter.x, object.worldSize.height / 2, object.worldCenter.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.worldGroup.add(mesh);

        if (object.type === "station" && object.label) {
          const sprite = createLabelSprite(object.label.toUpperCase());
          sprite.position.set(object.worldCenter.x, object.worldSize.height + 0.72, object.worldCenter.z);
          this.worldGroup.add(sprite);
        }
      });
  }

  private createPlayerActor(playerId: PlayerId, color: number): void {
    const group = new THREE.Group();
    group.name = `Haven3DPlayer${playerId}`;

    const coat = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.16 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x231d19, roughness: 0.88, metalness: 0.06 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xb88745, roughness: 0.5, metalness: 0.55 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.82, 6, 12), coat);
    body.position.y = 0.9;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), leather);
    head.position.y = 1.54;
    head.castShadow = true;
    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.16), brass);
    pauldron.position.set(0.18, 1.2, 0.03);
    pauldron.castShadow = true;
    const blade = new THREE.Group();
    blade.position.set(0.42, 1.05, 0.2);

    const bladeForm = new THREE.Group();
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.42), leather);
    grip.position.z = 0.06;
    grip.castShadow = true;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.08), brass);
    guard.position.z = -0.15;
    guard.castShadow = true;
    const bladeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.08, 1.12),
      new THREE.MeshStandardMaterial({
        color: 0xc8b16f,
        roughness: 0.32,
        metalness: 0.72,
        emissive: 0x2b1708,
        emissiveIntensity: 0.15,
      }),
    );
    bladeMesh.position.z = -0.72;
    bladeMesh.castShadow = true;
    const bladeTrail = new THREE.Mesh(
      new THREE.PlaneGeometry(1.25, 0.34),
      new THREE.MeshBasicMaterial({
        color: 0xf6d28a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    bladeTrail.position.set(0.2, 0.02, -0.78);
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
      new THREE.MeshStandardMaterial({
        color: 0x58c1aa,
        roughness: 0.38,
        metalness: 0.35,
        emissive: 0x123c37,
        emissiveIntensity: 0.75,
      }),
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
      new THREE.MeshStandardMaterial({
        color: 0x4fb4a4,
        roughness: 0.35,
        metalness: 0.35,
        emissive: 0x123c37,
        emissiveIntensity: 0.85,
      }),
    );
    hook.position.z = -0.72;
    hook.rotation.x = Math.PI / 2;
    grappleForm.add(coil, hookBase, hook);

    blade.add(bladeForm, launcherForm, grappleForm);
    group.add(body, head, pauldron, blade);
    this.dynamicGroup.add(group);
    this.playerActors.set(playerId, {
      group,
      blade,
      bladeTrail,
      weaponForms: {
        blade: bladeForm,
        launcher: launcherForm,
        grapple: grappleForm,
      },
    });
  }

  private createNpcActor(npc: FieldNpc): Actor {
    const group = new THREE.Group();
    group.name = `Haven3DNpc:${npc.id}`;
    const material = new THREE.MeshStandardMaterial({
      color: 0x4f7f76,
      roughness: 0.82,
      metalness: 0.08,
    });
    const brass = new THREE.MeshStandardMaterial({
      color: 0xb58b4c,
      roughness: 0.58,
      metalness: 0.35,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.68, 5, 10), material);
    body.position.y = 0.78;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), brass);
    head.position.y = 1.34;
    head.castShadow = true;
    const label = createLabelSprite(npc.name, { accent: "rgba(103, 202, 181, 0.72)", width: 320 });
    label.position.y = 1.92;
    const targetRing = createTargetRing(0x67cab5);
    group.add(body, head, label, targetRing);
    this.dynamicGroup.add(group);
    return { group, label, targetRing };
  }

  private createEnemyActor(enemy: FieldEnemy): Actor {
    const group = new THREE.Group();
    group.name = `Haven3DEnemy:${enemy.id}`;
    const hide = new THREE.MeshStandardMaterial({
      color: 0x8a2f36,
      roughness: 0.76,
      metalness: 0.12,
    });
    const core = new THREE.MeshStandardMaterial({
      color: 0xf2a14b,
      roughness: 0.46,
      metalness: 0.34,
      emissive: 0x3d1208,
      emissiveIntensity: 0.35,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.72, 5, 12), hide);
    body.position.y = 0.82;
    body.castShadow = true;
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), core);
    crest.position.y = 1.28;
    crest.castShadow = true;
    const label = createLabelSprite(enemy.name, { accent: "rgba(242, 112, 74, 0.76)", width: 340 });
    label.position.y = 1.92;
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
    shieldRing.position.y = 0.95;
    const shieldBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.025, 8, 28),
      new THREE.MeshBasicMaterial({
        color: 0xa7fff1,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    shieldBand.position.y = 0.95;
    defenseShield.add(shieldRing, shieldBand);
    defenseShield.visible = false;

    const defenseArmor = new THREE.Group();
    const armorMaterial = new THREE.MeshStandardMaterial({
      color: 0xd49b45,
      roughness: 0.4,
      metalness: 0.72,
      emissive: 0x3c2206,
      emissiveIntensity: 0.28,
    });
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.42, 0.08), armorMaterial);
    chestPlate.position.set(0, 0.98, -0.3);
    chestPlate.castShadow = true;
    const shoulderPlate = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.12, 0.16), armorMaterial);
    shoulderPlate.position.set(0, 1.28, 0);
    shoulderPlate.castShadow = true;
    defenseArmor.add(chestPlate, shoulderPlate);
    defenseArmor.visible = false;

    group.add(body, crest, label, targetRing, telegraph, defenseShield, defenseArmor);
    this.dynamicGroup.add(group);
    return {
      group,
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

    if (!this.options.isPaused()) {
      this.movePlayers(deltaMs);
      this.updateBladeSwing(deltaMs, currentTime);
      this.updateGrappleMove(deltaMs, currentTime);
      this.updateLauncherProjectiles(deltaMs);
      this.updateVisualEffects(deltaMs, currentTime);
    }

    this.options.onFrame(deltaMs, currentTime);
    if (this.disposed) {
      return;
    }

    this.updateCamera(deltaMs / 1000);
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

    const target = this.getLockedTargetCandidate()
      ?? this.getTargetCandidates().find((candidate) => candidate.kind === "enemy") ?? null;
    const direction = target
      ? { x: target.x - avatar.x, y: target.y - avatar.y }
      : getFacingVector(avatar.facing);
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
      this.options.onBladeStrike?.({
        playerId: "P1",
        x: avatar.x,
        y: avatar.y,
        facing: avatar.facing,
        target: this.bladeSwing.target,
        radius: BLADE_SWING_RANGE_PX,
        arcRadians: BLADE_SWING_ARC_RADIANS,
        damage: BLADE_SWING_DAMAGE,
        knockback: BLADE_SWING_KNOCKBACK,
      });
    }

    if (elapsed >= BLADE_SWING_TOTAL_MS) {
      this.bladeSwing = null;
    }
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
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 14, 10),
      new THREE.MeshStandardMaterial({
        color: 0xf2b04d,
        roughness: 0.35,
        metalness: 0.15,
        emissive: 0x8c3f10,
        emissiveIntensity: 1.8,
      }),
    );
    const world = fieldToHavenWorld(this.options.map, { x: originX, y: originY }, 1.12);
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
      const world = fieldToHavenWorld(this.options.map, { x: projectile.x, y: projectile.y }, 1.12);
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
    const target = this.findActionTarget(GRAPPLE_RANGE_PX);
    if (!avatar || !target) {
      this.actionCooldownUntil = now + GRAPPLE_COOLDOWN_MS * 0.45;
      return;
    }

    const direction = this.getActionDirection(avatar, target);
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
      target,
      targetPoint: { x: target.x, y: target.y },
      impacted: false,
      line,
      hook,
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

  private updateGrappleLine(): void {
    if (!this.grappleMove) {
      return;
    }

    const avatar = this.options.getPlayerAvatar("P1");
    if (!avatar) {
      return;
    }

    const from = fieldToHavenWorld(this.options.map, { x: avatar.x, y: avatar.y }, 1.18);
    const to = fieldToHavenWorld(this.options.map, this.grappleMove.targetPoint, 1.08);
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

    if (spawnSpark) {
      this.spawnHitSpark(this.grappleMove.targetPoint, 0x4fb4a4);
    }
    this.dynamicGroup.remove(this.grappleMove.line, this.grappleMove.hook);
    disposeObject(this.grappleMove.line);
    disposeObject(this.grappleMove.hook);
    this.grappleMove = null;
  }

  private spawnHitSpark(point: { x: number; y: number }, color: number): void {
    const world = fieldToHavenWorld(this.options.map, point, 0.62);
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
      effect.object.scale.setScalar(1 + t * 1.35);
      if (effect.spin) {
        effect.object.rotation.z += effect.spin * (deltaMs / 1000);
      }
      effect.object.traverse((node) => {
        if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshBasicMaterial) {
          node.material.opacity = Math.max(0, 0.82 * (1 - t));
        }
      });
      if (t >= 1) {
        this.dynamicGroup.remove(effect.object);
        disposeObject(effect.object);
        this.visualEffects.splice(index, 1);
      }
    }
  }

  private updateCamera(dt: number): void {
    const mouseSensitivity = 0.003;
    const yawDelta = -this.mouseDx * mouseSensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - this.mouseDy * mouseSensitivity,
      CAMERA_MIN_PITCH,
      CAMERA_MAX_PITCH,
    );
    this.mouseDx = 0;
    this.mouseDy = 0;

    const avatar = this.options.getPlayerAvatar("P1");
    const playerWorld = avatar
      ? fieldToHavenWorld(this.options.map, { x: avatar.x, y: avatar.y }, 1.15)
      : { x: 0, y: 1.15, z: 0 };
    const lockedTarget = this.getLockedTargetCandidate();
    const cameraDistance = this.cameraDistance;

    let cameraYaw = this.yaw + yawDelta;
    let focus = new THREE.Vector3(playerWorld.x, playerWorld.y, playerWorld.z);
    let distance = cameraDistance;

    if (avatar && lockedTarget) {
      this.targetOrbitYawOffset += yawDelta;
      const targetWorld = fieldToHavenWorld(this.options.map, { x: lockedTarget.x, y: lockedTarget.y }, 1.1);
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
      distance = THREE.MathUtils.clamp(6.6 + Math.min(4.5, targetDistance * 0.22), CAMERA_MIN_DISTANCE, 11.4);
      focus = new THREE.Vector3(
        (playerWorld.x * 0.64) + (targetWorld.x * 0.36),
        Math.max(playerWorld.y, targetWorld.y) + 0.28,
        (playerWorld.z * 0.64) + (targetWorld.z * 0.36),
      );
    } else {
      this.yaw = cameraYaw;
      this.targetOrbitYawOffset = 0;
    }

    const cosPitch = Math.cos(this.pitch);
    const offset = new THREE.Vector3(
      Math.sin(cameraYaw) * distance * cosPitch,
      2.55 + Math.sin(this.pitch) * distance,
      Math.cos(cameraYaw) * distance * cosPitch,
    );
    const shoulderOffset = lockedTarget
      ? new THREE.Vector3(Math.cos(cameraYaw) * 0.62, 0, -Math.sin(cameraYaw) * 0.62)
      : new THREE.Vector3();
    const desired = focus.clone().add(offset).add(shoulderOffset);
    this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    this.camera.lookAt(focus);

    this.yaw = cameraYaw;
    this.clockForward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw)).normalize();
    this.clockRight.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw)).normalize();
  }

  private syncDynamicActors(): void {
    this.syncPlayerActor("P1");
    this.syncPlayerActor("P2");
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

    const world = fieldToHavenWorld(this.options.map, { x: avatar.x, y: avatar.y }, 0.04);
    const lockedTarget = playerId === "P1" ? this.getLockedTargetCandidate() : null;
    actor.group.position.set(world.x, world.y, world.z);
    actor.group.rotation.y = lockedTarget
      ? getYawFromFieldDelta(lockedTarget.x - avatar.x, lockedTarget.y - avatar.y, this.getRotationForFacing(avatar.facing))
      : this.getRotationForFacing(avatar.facing);
    this.updatePlayerBladePose(actor, playerId);
  }

  private updatePlayerBladePose(actor: Actor, playerId: PlayerId): void {
    if (!actor.blade) {
      return;
    }

    const activeMode = playerId === "P1" ? this.activeMode : "blade";
    this.updatePlayerWeaponForm(actor, activeMode);
    if (activeMode !== "blade") {
      const recoilElapsed = (this.currentFrameTime || performance.now()) - this.launcherRecoilStartedAt;
      const recoil = activeMode === "launcher" && recoilElapsed >= 0 && recoilElapsed < LAUNCHER_RECOIL_MS
        ? Math.sin((1 - recoilElapsed / LAUNCHER_RECOIL_MS) * Math.PI)
        : 0;
      const grapplePulse = activeMode === "grapple" && this.grappleMove
        ? Math.sin(((this.currentFrameTime || performance.now()) - this.grappleMove.startedAt) * 0.018) * 0.06
        : 0;
      actor.blade.position.set(0.42, 1.03, 0.22 - recoil * 0.18);
      actor.blade.rotation.set(-0.54 + grapplePulse, 0.18, -0.16);
      if (actor.bladeTrail) {
        actor.bladeTrail.visible = false;
      }
      return;
    }

    const swing = playerId === "P1" ? this.bladeSwing : null;
    if (!swing) {
      actor.blade.position.set(0.42, 1.02, 0.24);
      actor.blade.rotation.set(-0.62, 0.28, -0.42);
      if (actor.bladeTrail) {
        actor.bladeTrail.visible = false;
        const material = actor.bladeTrail instanceof THREE.Mesh ? actor.bladeTrail.material : null;
        if (material instanceof THREE.MeshBasicMaterial) {
          material.opacity = 0;
        }
      }
      return;
    }

    const elapsed = this.currentFrameTime - swing.startedAt;
    const windup = smoothstep(elapsed / BLADE_SWING_WINDUP_MS);
    const strike = smoothstep((elapsed - BLADE_SWING_WINDUP_MS) / (BLADE_LUNGE_END_MS - BLADE_SWING_WINDUP_MS));
    const recovery = smoothstep((elapsed - BLADE_LUNGE_END_MS) / (BLADE_SWING_TOTAL_MS - BLADE_LUNGE_END_MS));
    const side = swing.side;

    if (elapsed < BLADE_SWING_WINDUP_MS) {
      actor.blade.position.set(0.44 + 0.08 * windup, 1.02 + 0.2 * windup, 0.24 - 0.22 * windup);
      actor.blade.rotation.set(
        -0.62 - (0.7 * windup),
        0.28 - (0.95 * windup),
        (-0.42 - (1.12 * windup)) * side,
      );
    } else if (elapsed < BLADE_LUNGE_END_MS) {
      actor.blade.position.set(0.52 - 0.18 * strike, 1.2 - 0.16 * strike, 0.02 + 0.34 * strike);
      actor.blade.rotation.set(
        -1.34 + (0.72 * strike),
        -0.72 + (1.58 * strike),
        (-1.56 + (3.12 * strike)) * side,
      );
    } else {
      actor.blade.position.set(0.34 + 0.08 * recovery, 1.04 - 0.02 * recovery, 0.36 - 0.12 * recovery);
      actor.blade.rotation.set(
        -0.62 - (0.18 * (1 - recovery)),
        0.86 - (0.58 * recovery),
        (1.56 - (1.98 * recovery)) * side,
      );
    }

    if (actor.bladeTrail) {
      const active = elapsed >= BLADE_SWING_WINDUP_MS && elapsed <= BLADE_LUNGE_END_MS + 70;
      actor.bladeTrail.visible = active;
      const material = actor.bladeTrail instanceof THREE.Mesh ? actor.bladeTrail.material : null;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.opacity = active ? 0.24 + (0.38 * (1 - recovery)) : 0;
      }
    }
  }

  private updatePlayerWeaponForm(actor: Actor, activeMode: Haven3DGearbladeMode | null): void {
    for (const [mode, object] of Object.entries(actor.weaponForms ?? {}) as Array<[Haven3DGearbladeMode, THREE.Object3D]>) {
      object.visible = activeMode === mode;
    }
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

      const world = fieldToHavenWorld(this.options.map, { x: npc.x, y: npc.y }, 0.04);
      actor.group.position.set(world.x, world.y, world.z);
      actor.group.rotation.y = this.getRotationForFacing(npc.direction);
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

      const world = fieldToHavenWorld(this.options.map, { x: enemy.x, y: enemy.y }, 0.04);
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
      actor.group.rotation.y = this.getRotationForFacing(enemy.facing);
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
    const isWindup = enemy.attackState === "windup";
    const isRecovery = enemy.attackState === "recovery";
    const distance = Math.hypot(enemy.x - avatar.x, enemy.y - avatar.y);
    const isLocked = this.targetLock?.kind === "enemy" && this.targetLock.id === enemy.id;
    const shouldShow = isWindup || isRecovery || distance <= ENEMY_TELEGRAPH_RANGE_PX || (isLocked && distance <= ENEMY_TELEGRAPH_RANGE_PX * 1.7);
    actor.telegraph.visible = shouldShow;
    if (!shouldShow) {
      return;
    }

    const danger = isWindup
      ? THREE.MathUtils.clamp((currentTime - Number(enemy.attackStartedAt ?? currentTime)) / ENEMY_ATTACK_WINDUP_MS, 0, 1)
      : isRecovery
        ? 1 - THREE.MathUtils.clamp((currentTime - Number(enemy.attackStartedAt ?? currentTime)) / ENEMY_ATTACK_RECOVERY_MS, 0, 1)
        : 1 - THREE.MathUtils.clamp((distance - ENEMY_DANGER_RANGE_PX) / (ENEMY_TELEGRAPH_RANGE_PX - ENEMY_DANGER_RANGE_PX), 0, 1);
    const pulse = (Math.sin(currentTime * 0.015) + 1) * 0.5;
    const attackLength = isWindup || isRecovery ? 1.38 + danger * 0.72 : 0.88 + danger * 0.52;
    actor.telegraph.position.z = isWindup || isRecovery ? 0.98 : 0.88;
    actor.telegraph.scale.set(0.8 + danger * 0.42 + pulse * 0.06, 1, attackLength);
    actor.telegraph.traverse((node) => {
      if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshBasicMaterial) {
        node.material.opacity = isRecovery
          ? Math.max(0.05, danger * 0.18)
          : 0.08 + danger * 0.38 + pulse * 0.08;
        node.material.color.setHex(isWindup ? 0xff3d2e : 0xff7a3e);
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
    if (!target) {
      this.targetLock = null;
      this.targetOrbitYawOffset = 0;
    }
    return target;
  }

  private selectNextTarget(reverse = false): void {
    const targets = this.getTargetCandidates();
    this.targetLock = selectNextHaven3DTarget(targets, this.targetLock, reverse);
    this.targetOrbitYawOffset = 0;
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

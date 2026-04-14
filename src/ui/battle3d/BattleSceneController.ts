import * as THREE from "three";
import type { BattleCameraViewPreset } from "../../core/types";
import {
  getBattleBillboardPerspectiveFromOrbitYaw,
  getBattleUnitBillboardSpriteCandidates,
  type BattleBillboardPerspective,
} from "../../core/portraits";
import {
  BOARD_TILE_BASE_BOTTOM,
  BOARD_TILE_SIZE,
  BOARD_TILE_TOP_THICKNESS,
  tileColumnHeight,
  tileToWorld,
} from "./boardMath";
import type {
  BattleBoardPick,
  BattleBoardPoint,
  BattleBoardSnapshot,
  BattleSceneInteractionHandlers,
} from "./types";

type UnitActor = {
  group: THREE.Group;
  ring: THREE.Mesh;
  sprite: THREE.Sprite;
  spriteMaterial: THREE.SpriteMaterial;
  statusGroup: THREE.Group;
  hpFill: THREE.Mesh;
  unitId: string;
  spriteRequestKey: string | null;
};

type MovementAnim = {
  actor: UnitActor;
  path: BattleBoardPoint[];
  width: number;
  height: number;
  startTime: number;
  durationMs: number;
  onComplete: () => void;
};

type AttackAnim = {
  attacker: UnitActor;
  target: UnitActor;
  attackerBase: THREE.Vector3;
  targetBase: THREE.Vector3;
  dir: THREE.Vector3;
  startTime: number;
  durationMs: number;
  onComplete: () => void;
};

type BillboardTextureMetrics = {
  aspect: number;
  bottomRatio: number;
  visibleHeightRatio: number;
};

type LoadedBillboardTexture = {
  path: string;
  texture: THREE.Texture;
};

function createColorMaterial(color: string, opacity = 1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    roughness: 0.76,
    metalness: 0.18,
  });
}

type FadeableMaterial = THREE.Material & {
  opacity: number;
};

function isFadeableMaterial(material: THREE.Material): material is FadeableMaterial {
  return "opacity" in material;
}

function getSurfaceColors(surface: string): { top: string; side: string } {
  switch (surface) {
    case "stone":
      return { top: "#7d7d78", side: "#55524c" };
    case "dirt":
      return { top: "#7c6242", side: "#4f3926" };
    case "grate":
      return { top: "#4f5b63", side: "#2a3137" };
    case "metal":
      return { top: "#7f848e", side: "#48515f" };
    case "ruin":
      return { top: "#816a59", side: "#4c392e" };
    case "industrial":
    default:
      return { top: "#59647a", side: "#31384a" };
  }
}

function getObjectColor(type: string): string {
  switch (type) {
    case "barricade_wall":
    case "destructible_wall":
      return "#4b4f5e";
    case "destructible_cover":
      return "#7a6345";
    case "med_station":
      return "#84c7ae";
    case "ammo_crate":
      return "#d9b26b";
    case "proximity_mine":
      return "#db6b6b";
    case "smoke_emitter":
      return "#77819b";
    case "portable_ladder":
      return "#a98a63";
    case "light_tower":
      return "#ece2aa";
    case "extraction_anchor":
      return "#82d4d8";
    default:
      return "#8d8d8d";
  }
}

function getHighlightColor(tile: BattleBoardSnapshot["tiles"][number]): string | null {
  if (tile.attackOption) return "#df5d5d";
  if (tile.moveOption) return "#5ad690";
  if (tile.placementOption) return "#64b6ff";
  if (tile.facingOption) return "#f5d567";
  if (tile.extractionZone) return "#b383ff";
  if (tile.friendlyBreach) return "#95efc2";
  if (tile.enemyBreach) return "#ffaf7b";
  if (tile.relayZone || tile.squadObjective) return "#f5cb66";
  if (tile.echoFieldCenter) return tile.selectedEchoField ? "#ffe88f" : "#ff9c4d";
  if (tile.echoField) return "#ff9c4d";
  if (tile.hovered) return "#ffffff";
  return null;
}

function createPlaceholderBillboardTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) {
    const data = new Uint8Array([255, 255, 255, 255]);
    const texture = new THREE.DataTexture(data, 1, 1);
    texture.needsUpdate = true;
    return texture;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineJoin = "round";
  context.lineCap = "round";

  const drawShape = (drawer: () => void) => {
    context.lineWidth = 10;
    context.strokeStyle = "rgba(10, 14, 24, 0.9)";
    context.fillStyle = "#ffffff";
    drawer();
    context.fill();
    context.stroke();
  };

  drawShape(() => {
    context.beginPath();
    context.arc(48, 26, 13, 0, Math.PI * 2);
  });

  drawShape(() => {
    context.beginPath();
    context.roundRect(30, 42, 36, 34, 10);
  });

  drawShape(() => {
    context.beginPath();
    context.roundRect(18, 48, 14, 30, 7);
  });

  drawShape(() => {
    context.beginPath();
    context.roundRect(64, 48, 14, 30, 7);
  });

  drawShape(() => {
    context.beginPath();
    context.roundRect(33, 74, 12, 34, 7);
  });

  drawShape(() => {
    context.beginPath();
    context.roundRect(51, 74, 12, 34, 7);
  });

  drawShape(() => {
    context.beginPath();
    context.roundRect(28, 102, 18, 10, 5);
  });

  drawShape(() => {
    context.beginPath();
    context.roundRect(50, 102, 18, 10, 5);
  });

  context.fillStyle = "rgba(255, 255, 255, 0.2)";
  context.beginPath();
  context.ellipse(48, 121, 26, 5, 0, 0, Math.PI * 2);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

const PLACEHOLDER_BILLBOARD_TEXTURE = createPlaceholderBillboardTexture();
const BILLBOARD_BASE_HEIGHT = 1.22;
const UNIT_TILE_CLEARANCE_Y = 0.002;

function getUnitAnchorY(tileTopY: number): number {
  return tileTopY + BOARD_TILE_TOP_THICKNESS + UNIT_TILE_CLEARANCE_Y;
}

function getUnitFacingVector(facing?: "north" | "south" | "east" | "west"): { x: number; z: number } | null {
  switch (facing) {
    case "north":
      return { x: 0, z: -1 };
    case "south":
      return { x: 0, z: 1 };
    case "east":
      return { x: 1, z: 0 };
    case "west":
      return { x: -1, z: 0 };
    default:
      return null;
  }
}

export class BattleSceneController {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  private readonly boardGroup = new THREE.Group();
  private readonly objectGroup = new THREE.Group();
  private readonly traversalGroup = new THREE.Group();
  private readonly unitGroup = new THREE.Group();
  private readonly highlightGroup = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly tileCaps = new Map<string, THREE.Mesh>();
  private readonly tileTopWorld = new Map<string, THREE.Vector3>();
  private readonly unitActors = new Map<string, UnitActor>();
  private readonly fadedMaterials = new Map<THREE.Material, { opacity: number; transparent: boolean }>();
  private readonly textureLoader = new THREE.TextureLoader();
  private readonly loadedBillboardTextures = new Map<string, THREE.Texture>();
  private readonly mirroredBillboardTextures = new Map<string, THREE.Texture>();
  private readonly pendingBillboardTextures = new Map<string, Promise<LoadedBillboardTexture>>();
  private readonly missingBillboardTextures = new Set<string>();
  private readonly billboardTextureMetrics = new Map<string, BillboardTextureMetrics>();
  private host: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private snapshot: BattleBoardSnapshot | null = null;
  private animationFrameId: number | null = null;
  private hoveredTileKey: string | null = null;
  private handlers: BattleSceneInteractionHandlers = {};
  private orbitYaw = Math.PI / 4;
  private orbitPitch = 0.82;
  private orbitDistance = 13;
  private zoomFactor = 1.3;
  private readonly baseTarget = new THREE.Vector3(0, 0.45, 0);
  private readonly boardFocus = new THREE.Vector3(0, 0.45, 0);
  private hasManualPan = false;
  private readonly pointerDown = {
    button: -1,
    x: 0,
    y: 0,
    dragging: false,
  };
  private movementAnim: MovementAnim | null = null;
  private attackAnim: AttackAnim | null = null;
  private viewChangeHandler: ((view: BattleCameraViewPreset) => void) | null = null;
  private currentBillboardPerspective: BattleBillboardPerspective = getBattleBillboardPerspectiveFromOrbitYaw(this.orbitYaw);

  constructor() {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = "battle-3d-canvas";

    this.scene.background = new THREE.Color("#070b11");
    this.scene.add(this.boardGroup, this.objectGroup, this.traversalGroup, this.unitGroup, this.highlightGroup);

    const ambient = new THREE.AmbientLight("#f1f0e8", 1.8);
    const keyLight = new THREE.DirectionalLight("#fff1cf", 1.6);
    keyLight.position.set(7, 14, 9);
    const rimLight = new THREE.DirectionalLight("#98b7ff", 0.8);
    rimLight.position.set(-8, 10, -6);
    this.scene.add(ambient, keyLight, rimLight);
    this.scene.fog = new THREE.FogExp2("#0c1119", 0.032);

    this.camera.position.set(10, 9, 10);
    this.camera.lookAt(this.baseTarget);
  }

  mount(host: HTMLElement): void {
    if (this.host === host) {
      this.ensureLoop();
      return;
    }

    this.host = host;
    host.innerHTML = "";
    host.appendChild(this.renderer.domElement);
    this.bindHostEvents(host);
    this.resizeRenderer();
    this.ensureLoop();
  }

  setInteractionHandlers(handlers: BattleSceneInteractionHandlers): void {
    this.handlers = handlers;
  }

  setViewChangeHandler(handler: ((view: BattleCameraViewPreset) => void) | null): void {
    this.viewChangeHandler = handler;
  }

  sync(snapshot: BattleBoardSnapshot): void {
    const boardChanged = this.snapshot?.boardKey !== snapshot.boardKey;
    this.snapshot = snapshot;

    if (boardChanged) {
      this.rebuildBoard(snapshot);
    }

    this.syncHighlights(snapshot);
    this.syncUnits(snapshot);
    this.syncFocus(snapshot);
    this.render();
  }

  setZoomFactor(zoomFactor: number): void {
    const nextZoomFactor = Math.max(0.6, Math.min(1.6, zoomFactor));
    if (Math.abs(this.zoomFactor - nextZoomFactor) < 0.0001) {
      return;
    }
    this.zoomFactor = nextZoomFactor;
    this.render();
    this.notifyViewChanged();
  }

  panScreen(dx: number, dy: number): void {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const effectiveDistance = this.orbitDistance / this.zoomFactor;
    const scale = 0.0016 * effectiveDistance;
    this.hasManualPan = true;
    this.boardFocus.addScaledVector(right, -dx * scale);
    this.boardFocus.addScaledVector(forward, -dy * scale);
    this.clampBoardFocus();
    this.render();
    this.notifyViewChanged();
  }

  adjustOrbit(deltaYaw: number, deltaPitch: number): void {
    this.orbitYaw += deltaYaw;
    this.orbitPitch = Math.max(0.35, Math.min(1.25, this.orbitPitch + deltaPitch));
    this.syncBillboardPerspective();
    this.render();
    this.notifyViewChanged();
  }

  focusTile(tile: BattleBoardPoint | null | undefined): void {
    if (!this.snapshot || !tile) {
      return;
    }
    const tileVisual = this.snapshot.tiles.find((entry) => entry.x === tile.x && entry.y === tile.y);
    if (!tileVisual) {
      return;
    }
    const world = tileToWorld(tile.x, tile.y, tileVisual.elevation, this.snapshot.width, this.snapshot.height);
    this.boardFocus.copy(world).setY(world.y + 0.3);
    this.hasManualPan = false;
    this.clampBoardFocus();
    this.render();
    this.notifyViewChanged();
  }

  getViewState(): BattleCameraViewPreset {
    return {
      orbitYaw: this.orbitYaw,
      orbitPitch: this.orbitPitch,
      orbitDistance: this.orbitDistance,
      zoomFactor: this.zoomFactor,
      focusX: this.boardFocus.x,
      focusY: this.boardFocus.y,
      focusZ: this.boardFocus.z,
      hasManualPan: this.hasManualPan,
    };
  }

  applyViewState(view: BattleCameraViewPreset, emit = false): void {
    this.orbitYaw = Number.isFinite(view.orbitYaw) ? view.orbitYaw : Math.PI / 4;
    this.orbitPitch = Math.max(0.35, Math.min(1.25, Number.isFinite(view.orbitPitch) ? view.orbitPitch : 0.82));
    this.orbitDistance = Math.max(4.5, Math.min(30, Number.isFinite(view.orbitDistance) ? view.orbitDistance : 13));
    this.zoomFactor = Math.max(0.6, Math.min(1.6, Number.isFinite(view.zoomFactor) ? view.zoomFactor : 1.3));
    this.boardFocus.set(
      Number.isFinite(view.focusX) ? view.focusX : 0,
      Number.isFinite(view.focusY) ? view.focusY : 0.45,
      Number.isFinite(view.focusZ) ? view.focusZ : 0,
    );
    this.hasManualPan = Boolean(view.hasManualPan);
    this.clampBoardFocus();
    this.syncBillboardPerspective(true);
    this.render();
    if (emit) {
      this.notifyViewChanged();
    }
  }

  projectTileToOverlay(x: number, y: number): { x: number; y: number } | null {
    const key = `${x},${y}`;
    const world = this.tileTopWorld.get(key);
    if (!world || !this.host) {
      return null;
    }

    const projected = world.clone().project(this.camera);
    const bounds = this.host.getBoundingClientRect();
    return {
      x: ((projected.x + 1) / 2) * bounds.width,
      y: ((-projected.y + 1) / 2) * bounds.height,
    };
  }

  triggerUnitPulse(unitId: string): void {
    const actor = this.unitActors.get(unitId);
    if (!actor) {
      return;
    }
    actor.ring.scale.setScalar(1.35);
    window.setTimeout(() => {
      actor.ring.scale.setScalar(1);
    }, 240);
  }

  animateUnitMove(
    unitId: string,
    path: BattleBoardPoint[],
    durationMs: number,
    onComplete: () => void,
  ): void {
    const actor = this.unitActors.get(unitId);
    if (!actor || !this.snapshot || path.length < 2) {
      onComplete();
      return;
    }

    this.movementAnim = {
      actor,
      path,
      width: this.snapshot.width,
      height: this.snapshot.height,
      startTime: performance.now(),
      durationMs,
      onComplete,
    };
    this.ensureLoop();
  }

  animateAttackBump(attackerId: string, targetId: string, durationMs: number, onComplete: () => void): void {
    const attacker = this.unitActors.get(attackerId);
    const target = this.unitActors.get(targetId);
    if (!attacker || !target) {
      onComplete();
      return;
    }

    const attackerBase = attacker.group.position.clone();
    const targetBase = target.group.position.clone();
    const dir = targetBase.clone().sub(attackerBase).normalize();
    this.attackAnim = {
      attacker,
      target,
      attackerBase,
      targetBase,
      dir,
      startTime: performance.now(),
      durationMs,
      onComplete,
    };
    this.ensureLoop();
  }

  hasActiveAnimations(): boolean {
    return Boolean(this.movementAnim || this.attackAnim);
  }

  dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    Array.from(this.unitActors.values()).forEach((actor) => this.disposeUnitActor(actor));
    this.unitActors.clear();
    this.renderer.dispose();
    this.host = null;
    this.snapshot = null;
  }

  private bindHostEvents(host: HTMLElement): void {
    host.oncontextmenu = (event) => {
      event.preventDefault();
    };

    host.onpointerdown = (event) => {
      this.pointerDown.button = event.button;
      this.pointerDown.x = event.clientX;
      this.pointerDown.y = event.clientY;
      this.pointerDown.dragging = false;
      host.setPointerCapture(event.pointerId);
    };

    host.onpointermove = (event) => {
      if (!this.snapshot) {
        return;
      }

      const deltaX = event.clientX - this.pointerDown.x;
      const deltaY = event.clientY - this.pointerDown.y;
      if (event.buttons !== 0 && Math.abs(deltaX) + Math.abs(deltaY) > 2) {
        this.pointerDown.dragging = true;
      }

      if (this.pointerDown.button === 2 && event.buttons !== 0) {
        this.adjustOrbit(-deltaX * 0.008, -deltaY * 0.006);
        this.pointerDown.x = event.clientX;
        this.pointerDown.y = event.clientY;
        return;
      }

      if (this.pointerDown.button === 1 && event.buttons !== 0) {
        this.panScreen(deltaX, deltaY);
        this.pointerDown.x = event.clientX;
        this.pointerDown.y = event.clientY;
        return;
      }

      if (event.buttons === 0) {
        const pick = this.pickAt(event.clientX, event.clientY);
        const hoverKey = pick ? `${pick.x},${pick.y}` : null;
        if (hoverKey !== this.hoveredTileKey) {
          this.hoveredTileKey = hoverKey;
          this.handlers.onHoverTile?.(pick ? { x: pick.x, y: pick.y } : null);
        }
      }
    };

    host.onpointerup = (event) => {
      if (this.pointerDown.button === 0 && !this.pointerDown.dragging) {
        const pick = this.pickAt(event.clientX, event.clientY);
        if (pick) {
          this.handlers.onPrimaryPick?.(pick);
        }
      }
      this.pointerDown.button = -1;
      this.pointerDown.dragging = false;
    };

    host.onpointerleave = () => {
      if (this.hoveredTileKey !== null) {
        this.hoveredTileKey = null;
        this.handlers.onHoverTile?.(null);
      }
    };

    host.onwheel = (event) => {
      event.preventDefault();
      this.orbitDistance = Math.max(4.5, Math.min(30, this.orbitDistance + event.deltaY * 0.008));
      this.render();
      this.notifyViewChanged();
    };

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.resizeRenderer());
    this.resizeObserver.observe(host);
  }

  private resizeRenderer(): void {
    if (!this.host) {
      return;
    }
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  private rebuildBoard(snapshot: BattleBoardSnapshot): void {
    this.clearGroup(this.boardGroup);
    this.clearGroup(this.objectGroup);
    this.clearGroup(this.traversalGroup);
    this.clearGroup(this.highlightGroup);
    this.tileCaps.clear();
    this.tileTopWorld.clear();

    snapshot.tiles.forEach((tile) => {
      const world = tileToWorld(tile.x, tile.y, tile.elevation, snapshot.width, snapshot.height);
      const colors = getSurfaceColors(tile.surface);

      const column = new THREE.Mesh(
        new THREE.BoxGeometry(BOARD_TILE_SIZE * 0.98, tileColumnHeight(tile.elevation), BOARD_TILE_SIZE * 0.98),
        createColorMaterial(colors.side),
      );
      column.position.copy(world);
      column.position.y = BOARD_TILE_BASE_BOTTOM + tileColumnHeight(tile.elevation) / 2;
      this.boardGroup.add(column);

      const top = new THREE.Mesh(
        new THREE.BoxGeometry(BOARD_TILE_SIZE * 0.92, BOARD_TILE_TOP_THICKNESS, BOARD_TILE_SIZE * 0.92),
        createColorMaterial(colors.top),
      );
      top.position.copy(world);
      top.position.y += BOARD_TILE_TOP_THICKNESS / 2;
      top.userData = { tileKey: tile.key, x: tile.x, y: tile.y, pickable: true };
      this.boardGroup.add(top);
      this.tileCaps.set(tile.key, top);
      this.tileTopWorld.set(tile.key, top.position.clone());

      if (tile.terrain === "wall" || tile.terrain === "heavy_cover") {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(0.78, 0.62, 0.32),
          createColorMaterial(tile.terrain === "wall" ? "#494d5a" : "#8a714e"),
        );
        wall.position.copy(world);
        wall.position.y += 0.42;
        wall.rotation.y = Math.PI / 4;
        this.objectGroup.add(wall);
      } else if (tile.terrain === "light_cover") {
        const cover = new THREE.Mesh(
          new THREE.BoxGeometry(0.68, 0.34, 0.24),
          createColorMaterial("#8a714e"),
        );
        cover.position.copy(world);
        cover.position.y += 0.26;
        cover.rotation.y = Math.PI / 5;
        this.objectGroup.add(cover);
      }
    });

    snapshot.traversalLinks.forEach((link) => {
      const fromTile = snapshot.tiles.find((tile) => tile.x === link.from.x && tile.y === link.from.y);
      const toTile = snapshot.tiles.find((tile) => tile.x === link.to.x && tile.y === link.to.y);
      if (!fromTile || !toTile) {
        return;
      }
      const from = tileToWorld(link.from.x, link.from.y, fromTile.elevation, snapshot.width, snapshot.height).add(new THREE.Vector3(0, 0.12, 0));
      const to = tileToWorld(link.to.x, link.to.y, toTile.elevation, snapshot.width, snapshot.height).add(new THREE.Vector3(0, 0.12, 0));
      const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
      const material = new THREE.LineBasicMaterial({ color: "#d8c493", transparent: true, opacity: 0.82 });
      this.traversalGroup.add(new THREE.Line(geometry, material));
    });

    snapshot.objects.forEach((objectVisual) => {
      if (!objectVisual.active) {
        return;
      }

      const baseTile = snapshot.tiles.find((tile) => tile.x === objectVisual.x && tile.y === objectVisual.y);
      const world = tileToWorld(objectVisual.x, objectVisual.y, baseTile?.elevation ?? objectVisual.elevation, snapshot.width, snapshot.height);
      const group = new THREE.Group();
      group.userData = { objectId: objectVisual.id, tileKey: `${objectVisual.x},${objectVisual.y}` };

      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.26, objectVisual.type === "light_tower" ? 1.1 : 0.5, 6),
        createColorMaterial(getObjectColor(objectVisual.type), objectVisual.hidden ? 0.35 : 0.94),
      );
      body.position.y = objectVisual.type === "light_tower" ? 0.62 : 0.28;
      group.add(body);

      if (objectVisual.radius && objectVisual.radius > 0) {
        const aura = new THREE.Mesh(
          new THREE.RingGeometry(objectVisual.radius * 0.72, objectVisual.radius * 0.92, 36),
          new THREE.MeshBasicMaterial({
            color: objectVisual.type === "light_tower" ? "#ffe598" : "#9db6ff",
            transparent: true,
            opacity: 0.16,
            side: THREE.DoubleSide,
          }),
        );
        aura.rotation.x = -Math.PI / 2;
        aura.position.y = 0.02;
        group.add(aura);
      }

      group.position.copy(world);
      group.position.y += 0.14;
      this.objectGroup.add(group);
    });
  }

  private syncHighlights(snapshot: BattleBoardSnapshot): void {
    this.clearGroup(this.highlightGroup);
    snapshot.tiles.forEach((tile) => {
      const color = getHighlightColor(tile);
      if (!color) {
        return;
      }
      const world = this.tileTopWorld.get(tile.key);
      if (!world) {
        return;
      }
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.2, tile.hovered ? 0.48 : 0.42, 30),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: tile.hovered ? 0.88 : 0.6,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(world);
      ring.position.y += 0.08;
      this.highlightGroup.add(ring);
    });
  }

  private syncUnits(snapshot: BattleBoardSnapshot): void {
    const seen = new Set<string>();
    const perspective = this.currentBillboardPerspective;

    snapshot.units.forEach((unit) => {
      seen.add(unit.id);
      let actor = this.unitActors.get(unit.id);
      if (!actor) {
        actor = this.createUnitActor(unit.id);
        this.unitActors.set(unit.id, actor);
        this.unitGroup.add(actor.group);
      }

      this.syncUnitActorBillboard(actor, unit, perspective);
      actor.group.visible = !unit.hidden;
      const ringMaterial = actor.ring.material as THREE.MeshBasicMaterial;
      ringMaterial.color.set(unit.active ? "#ffe48f" : unit.isEnemy ? "#f26d6d" : "#61b6ff");
      ringMaterial.opacity = unit.active ? 0.95 : 0.72;

      actor.spriteMaterial.color.set(unit.active ? "#ffe7b8" : unit.isEnemy ? "#ff9d8f" : "#a8dcff");

      const hpRatio = Math.max(0, Math.min(1, unit.maxHp > 0 ? unit.hp / unit.maxHp : 0));
      actor.hpFill.scale.x = Math.max(0.12, hpRatio);
      actor.hpFill.position.x = -0.22 + actor.hpFill.scale.x * 0.22;

      if (!this.movementAnim || this.movementAnim.actor.unitId !== unit.id) {
        const world = tileToWorld(unit.x, unit.y, unit.elevation, snapshot.width, snapshot.height);
        actor.group.position.copy(world);
        actor.group.position.y = getUnitAnchorY(world.y);
      }
    });

    Array.from(this.unitActors.entries()).forEach(([unitId, actor]) => {
      if (!seen.has(unitId)) {
        this.unitGroup.remove(actor.group);
        this.disposeUnitActor(actor);
        this.unitActors.delete(unitId);
      }
    });
  }

  private syncFocus(snapshot: BattleBoardSnapshot): void {
    if (snapshot.focusTile) {
      const tile = snapshot.tiles.find((entry) => entry.x === snapshot.focusTile?.x && entry.y === snapshot.focusTile?.y);
      if (tile) {
        const world = tileToWorld(tile.x, tile.y, tile.elevation, snapshot.width, snapshot.height);
        this.baseTarget.copy(world).setY(world.y + 0.3);
      }
    } else {
      this.baseTarget.set(0, 0.35, 0);
    }

    if (!Number.isFinite(this.boardFocus.x) || !Number.isFinite(this.boardFocus.y) || !Number.isFinite(this.boardFocus.z)) {
      this.boardFocus.copy(this.baseTarget);
      this.hasManualPan = false;
    } else if (!this.hasManualPan) {
      this.boardFocus.copy(this.baseTarget);
    }
  }

  private syncBillboardPerspective(force = false): void {
    const nextPerspective = getBattleBillboardPerspectiveFromOrbitYaw(this.orbitYaw);
    if (!force && nextPerspective === this.currentBillboardPerspective) {
      return;
    }

    this.currentBillboardPerspective = nextPerspective;
    if (!this.snapshot) {
      return;
    }

    this.snapshot.units.forEach((unit) => {
      const actor = this.unitActors.get(unit.id);
      if (actor) {
        this.syncUnitActorBillboard(actor, unit, nextPerspective);
      }
    });
  }

  private syncUnitActorBillboard(
    actor: UnitActor,
    unit: BattleBoardSnapshot["units"][number],
    perspective: BattleBillboardPerspective,
  ): void {
    const candidates = getBattleUnitBillboardSpriteCandidates({
      unitId: unit.id,
      baseUnitId: unit.baseUnitId,
      classId: unit.classId,
      perspective,
      standPath: unit.standPath,
      fallbackPath: unit.portraitPath,
    });
    const requestKey = `${unit.facing ?? "none"}|${candidates.join("|")}`;
    if (actor.spriteRequestKey === requestKey) {
      return;
    }

    actor.spriteRequestKey = requestKey;
    void this.loadFirstAvailableBillboardTexture(candidates)
      .then(({ path, texture }) => {
        if (actor.spriteRequestKey !== requestKey) {
          return;
        }
        this.applyBillboardTexture(
          actor,
          texture,
          this.shouldMirrorBillboardTexture(path, unit.facing),
        );
      })
      .catch(() => {
        if (actor.spriteRequestKey !== requestKey) {
          return;
        }
        this.applyBillboardTexture(
          actor,
          PLACEHOLDER_BILLBOARD_TEXTURE,
          this.shouldMirrorFallbackBillboardForUnit(unit.facing),
        );
      });
  }

  private loadFirstAvailableBillboardTexture(candidates: string[]): Promise<LoadedBillboardTexture> {
    const deduped = Array.from(new Set(candidates.filter(Boolean)));
    if (deduped.length <= 0) {
      return Promise.resolve({
        path: "__placeholder__",
        texture: PLACEHOLDER_BILLBOARD_TEXTURE,
      });
    }

    let chain = Promise.reject<LoadedBillboardTexture>(new Error("No billboard sprite candidates resolved."));
    deduped.forEach((candidate) => {
      chain = chain.catch(() => this.loadBillboardTexture(candidate));
    });
    return chain.catch(() => ({
      path: "__placeholder__",
      texture: PLACEHOLDER_BILLBOARD_TEXTURE,
    }));
  }

  private loadBillboardTexture(path: string): Promise<LoadedBillboardTexture> {
    if (this.loadedBillboardTextures.has(path)) {
      return Promise.resolve({
        path,
        texture: this.loadedBillboardTextures.get(path)!,
      });
    }
    if (this.missingBillboardTextures.has(path)) {
      return Promise.reject(new Error(`Missing billboard texture: ${path}`));
    }
    const pending = this.pendingBillboardTextures.get(path);
    if (pending) {
      return pending;
    }

    const promise = new Promise<LoadedBillboardTexture>((resolve, reject) => {
      this.textureLoader.load(
        path,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.magFilter = THREE.NearestFilter;
          texture.minFilter = THREE.NearestFilter;
          texture.generateMipmaps = false;
          this.loadedBillboardTextures.set(path, texture);
          resolve({ path, texture });
        },
        undefined,
        (error) => {
          this.missingBillboardTextures.add(path);
          reject(error instanceof Error ? error : new Error(`Failed to load billboard texture: ${path}`));
        },
      );
    }).finally(() => {
      this.pendingBillboardTextures.delete(path);
    });

    this.pendingBillboardTextures.set(path, promise);
    return promise;
  }

  private shouldMirrorFallbackBillboardForUnit(
    facing?: BattleBoardSnapshot["units"][number]["facing"],
  ): boolean {
    const facingVector = getUnitFacingVector(facing);
    if (!facingVector) {
      return false;
    }

    const cameraRightX = Math.sin(this.orbitYaw);
    const cameraRightZ = -Math.cos(this.orbitYaw);
    const screenRightDot = (facingVector.x * cameraRightX) + (facingVector.z * cameraRightZ);
    return screenRightDot > 0.0001;
  }

  private shouldMirrorBillboardTexture(
    path: string,
    facing?: BattleBoardSnapshot["units"][number]["facing"],
  ): boolean {
    if (/_Battle_(NW|NE|SE|SW)\.(png|webp|jpg|jpeg)$/i.test(path)) {
      return false;
    }
    return this.shouldMirrorFallbackBillboardForUnit(facing);
  }

  private applyBillboardTexture(actor: UnitActor, texture: THREE.Texture, mirrored = false): void {
    const resolvedTexture = mirrored ? this.getMirroredBillboardTexture(texture) : texture;
    actor.spriteMaterial.map = resolvedTexture;
    actor.spriteMaterial.needsUpdate = true;

    const metrics = this.getBillboardTextureMetrics(resolvedTexture);
    const spriteWidth = THREE.MathUtils.clamp(BILLBOARD_BASE_HEIGHT * metrics.aspect, 0.52, 1.6);
    actor.sprite.scale.set(
      spriteWidth,
      BILLBOARD_BASE_HEIGHT,
      1,
    );
    actor.sprite.position.y = -(metrics.bottomRatio * BILLBOARD_BASE_HEIGHT);
    const visibleTopY = (metrics.bottomRatio + metrics.visibleHeightRatio) * BILLBOARD_BASE_HEIGHT;
    actor.statusGroup.position.set(0, Math.max(0.72, visibleTopY + 0.08), 0);
  }

  private getMirroredBillboardTexture(texture: THREE.Texture): THREE.Texture {
    const cached = this.mirroredBillboardTextures.get(texture.uuid);
    if (cached) {
      return cached;
    }

    const image = texture.image as CanvasImageSource & { width?: number; height?: number } | undefined;
    const width = image?.width ?? 0;
    const height = image?.height ?? 0;
    if (!image || width <= 0 || height <= 0) {
      return texture;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        return texture;
      }

      context.translate(width, 0);
      context.scale(-1, 1);
      context.drawImage(image, 0, 0, width, height);

      const mirroredTexture = new THREE.CanvasTexture(canvas);
      mirroredTexture.colorSpace = THREE.SRGBColorSpace;
      mirroredTexture.magFilter = THREE.NearestFilter;
      mirroredTexture.minFilter = THREE.NearestFilter;
      mirroredTexture.generateMipmaps = false;
      this.mirroredBillboardTextures.set(texture.uuid, mirroredTexture);
      return mirroredTexture;
    } catch {
      return texture;
    }
  }

  private getBillboardTextureMetrics(texture: THREE.Texture): BillboardTextureMetrics {
    const cached = this.billboardTextureMetrics.get(texture.uuid);
    if (cached) {
      return cached;
    }

    const image = texture.image as CanvasImageSource & { width?: number; height?: number } | undefined;
    const width = image?.width ?? 96;
    const height = image?.height ?? 128;
    const fallback: BillboardTextureMetrics = {
      aspect: width > 0 && height > 0 ? width / height : 0.75,
      bottomRatio: 0,
      visibleHeightRatio: 1,
    };

    if (!image || width <= 0 || height <= 0) {
      this.billboardTextureMetrics.set(texture.uuid, fallback);
      return fallback;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        this.billboardTextureMetrics.set(texture.uuid, fallback);
        return fallback;
      }

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const data = context.getImageData(0, 0, width, height).data;
      let minY = height;
      let maxY = -1;

      for (let y = 0; y < height; y += 1) {
        const rowOffset = y * width * 4;
        for (let x = 0; x < width; x += 1) {
          const alpha = data[rowOffset + x * 4 + 3];
          if (alpha > 8) {
            if (y < minY) {
              minY = y;
            }
            if (y > maxY) {
              maxY = y;
            }
          }
        }
      }

      if (maxY < 0) {
        this.billboardTextureMetrics.set(texture.uuid, fallback);
        return fallback;
      }

      const bottomTransparentRows = Math.max(0, height - 1 - maxY);
      const visibleHeight = Math.max(1, maxY - minY + 1);
      const metrics: BillboardTextureMetrics = {
        aspect: fallback.aspect,
        bottomRatio: bottomTransparentRows / height,
        visibleHeightRatio: visibleHeight / height,
      };
      this.billboardTextureMetrics.set(texture.uuid, metrics);
      return metrics;
    } catch {
      this.billboardTextureMetrics.set(texture.uuid, fallback);
      return fallback;
    }
  }

  private createUnitActor(unitId: string): UnitActor {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.33, 36),
      new THREE.MeshBasicMaterial({
        color: "#61b6ff",
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    const spriteMaterial = new THREE.SpriteMaterial({
      map: PLACEHOLDER_BILLBOARD_TEXTURE,
      color: "#a8dcff",
      transparent: true,
      alphaTest: 0.08,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.center.set(0.5, 0);
    sprite.scale.set(0.92, BILLBOARD_BASE_HEIGHT, 1);
    sprite.userData = { unitId };
    group.add(sprite);

    const statusGroup = new THREE.Group();
    statusGroup.position.set(0, BILLBOARD_BASE_HEIGHT + 0.08, 0);
    group.add(statusGroup);

    const hpBack = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.06),
      new THREE.MeshBasicMaterial({ color: "#2d1013", transparent: true, opacity: 0.9 }),
    );
    statusGroup.add(hpBack);

    const hpFill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.04),
      new THREE.MeshBasicMaterial({ color: "#82f0a7", transparent: true, opacity: 0.92 }),
    );
    hpFill.position.set(0, 0, 0.001);
    statusGroup.add(hpFill);

    return {
      group,
      ring,
      sprite,
      spriteMaterial,
      statusGroup,
      hpFill,
      unitId,
      spriteRequestKey: null,
    };
  }

  private disposeUnitActor(actor: UnitActor): void {
    actor.ring.geometry.dispose();
    (actor.ring.material as THREE.Material).dispose();
    actor.sprite.geometry.dispose();
    actor.spriteMaterial.dispose();
    actor.statusGroup.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  private pickAt(clientX: number, clientY: number): BattleBoardPick | null {
    if (!this.host || !this.snapshot) {
      return null;
    }

    const rect = this.host.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const unitIntersections = this.raycaster.intersectObjects(
      Array.from(this.unitActors.values()).map((actor) => actor.sprite),
      false,
    );
    if (unitIntersections.length > 0) {
      const unitId = unitIntersections[0].object.userData["unitId"] as string | undefined;
      const unit = this.snapshot.units.find((entry) => entry.id === unitId);
      if (unit) {
        return { x: unit.x, y: unit.y, unitId: unit.id };
      }
    }

    const tileIntersections = this.raycaster.intersectObjects(Array.from(this.tileCaps.values()), false);
    if (tileIntersections.length <= 0) {
      return null;
    }
    const object = tileIntersections[0].object;
    const x = Number(object.userData["x"]);
    const y = Number(object.userData["y"]);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      return null;
    }
    return { x, y };
  }

  private updateCamera(): void {
    this.clampBoardFocus();
    const target = this.boardFocus.clone();

    const effectiveDistance = this.orbitDistance / this.zoomFactor;
    const offset = new THREE.Vector3(
      Math.cos(this.orbitYaw) * Math.cos(this.orbitPitch) * effectiveDistance,
      Math.sin(this.orbitPitch) * effectiveDistance,
      Math.sin(this.orbitYaw) * Math.cos(this.orbitPitch) * effectiveDistance,
    );

    this.camera.position.copy(target).add(offset);
    this.camera.lookAt(target);

    this.unitActors.forEach((actor) => {
      actor.statusGroup.lookAt(this.camera.position);
    });
  }

  private updateAnimations(now: number): void {
    if (this.movementAnim && this.snapshot) {
      const progress = Math.max(0, Math.min(1, (now - this.movementAnim.startTime) / this.movementAnim.durationMs));
      const scaled = progress * (this.movementAnim.path.length - 1);
      const segment = Math.min(this.movementAnim.path.length - 2, Math.floor(scaled));
      const localProgress = scaled - segment;
      const from = this.movementAnim.path[segment];
      const to = this.movementAnim.path[segment + 1];
      const fromElevation = this.snapshot.tiles.find((tile) => tile.x === from.x && tile.y === from.y)?.elevation ?? 0;
      const toElevation = this.snapshot.tiles.find((tile) => tile.x === to.x && tile.y === to.y)?.elevation ?? 0;
      const start = tileToWorld(from.x, from.y, fromElevation, this.movementAnim.width, this.movementAnim.height);
      const end = tileToWorld(to.x, to.y, toElevation, this.movementAnim.width, this.movementAnim.height);
      const current = start.lerp(end, localProgress);
      current.y = getUnitAnchorY(current.y);
      this.movementAnim.actor.group.position.copy(current);

      if (progress >= 1) {
        const onComplete = this.movementAnim.onComplete;
        this.movementAnim = null;
        onComplete();
      }
    }

    if (this.attackAnim) {
      const progress = Math.max(0, Math.min(1, (now - this.attackAnim.startTime) / this.attackAnim.durationMs));
      const strike = Math.sin(progress * Math.PI);
      this.attackAnim.attacker.group.position.copy(
        this.attackAnim.attackerBase.clone().add(this.attackAnim.dir.clone().multiplyScalar(0.18 * strike)),
      );
      this.attackAnim.target.group.position.copy(
        this.attackAnim.targetBase.clone().add(this.attackAnim.dir.clone().multiplyScalar(-0.09 * strike)),
      );

      if (progress >= 1) {
        this.attackAnim.attacker.group.position.copy(this.attackAnim.attackerBase);
        this.attackAnim.target.group.position.copy(this.attackAnim.targetBase);
        const onComplete = this.attackAnim.onComplete;
        this.attackAnim = null;
        onComplete();
      }
    }
  }

  private updateOcclusion(): void {
    this.fadedMaterials.forEach((original, material) => {
      material.transparent = original.transparent;
      if (isFadeableMaterial(material)) {
        material.opacity = original.opacity;
      }
    });
    this.fadedMaterials.clear();

    if (!this.snapshot) {
      return;
    }

    const anchor =
      this.snapshot.hoveredTile
      ?? this.snapshot.focusTile
      ?? this.snapshot.units.find((unit) => unit.active)
      ?? null;
    if (!anchor) {
      return;
    }

    const anchorTile = this.snapshot.tiles.find((tile) => tile.x === anchor.x && tile.y === anchor.y);
    if (!anchorTile) {
      return;
    }

    const target = tileToWorld(anchor.x, anchor.y, anchorTile.elevation, this.snapshot.width, this.snapshot.height).add(new THREE.Vector3(0, 0.55, 0));
    const direction = target.clone().sub(this.camera.position).normalize();
    this.raycaster.set(this.camera.position, direction);
    const distance = this.camera.position.distanceTo(target);
    const occluders = this.raycaster.intersectObjects(
      [...this.boardGroup.children, ...this.objectGroup.children],
      true,
    );

    occluders.forEach((hit: THREE.Intersection<THREE.Object3D>) => {
      if (hit.distance >= distance - 0.15) {
        return;
      }
      const material = hit.object instanceof THREE.Mesh ? hit.object.material : null;
      if (!material || Array.isArray(material) || !isFadeableMaterial(material)) {
        return;
      }
      if (!this.fadedMaterials.has(material)) {
        this.fadedMaterials.set(material, {
          opacity: material.opacity,
          transparent: material.transparent,
        });
      }
      material.transparent = true;
      material.opacity = Math.min(material.opacity, 0.25);
    });
  }

  private clampBoardFocus(): void {
    if (!this.snapshot || this.snapshot.tiles.length <= 0) {
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    this.snapshot.tiles.forEach((tile) => {
      const world = this.tileTopWorld.get(tile.key) ?? tileToWorld(tile.x, tile.y, tile.elevation, this.snapshot!.width, this.snapshot!.height);
      minX = Math.min(minX, world.x);
      maxX = Math.max(maxX, world.x);
      minZ = Math.min(minZ, world.z);
      maxZ = Math.max(maxZ, world.z);
    });

    const effectiveDistance = this.orbitDistance / this.zoomFactor;
    const margin = Math.max(1.25, Math.min(3.5, effectiveDistance * 0.22));
    this.boardFocus.x = THREE.MathUtils.clamp(this.boardFocus.x, minX - margin, maxX + margin);
    this.boardFocus.z = THREE.MathUtils.clamp(this.boardFocus.z, minZ - margin, maxZ + margin);
  }

  private notifyViewChanged(): void {
    this.viewChangeHandler?.(this.getViewState());
  }

  private clearGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children.pop();
      if (!child) {
        continue;
      }
      group.remove(child);
      child.traverse((node: THREE.Object3D) => {
        if (node instanceof THREE.Mesh || node instanceof THREE.Line) {
          node.geometry.dispose();
          if (Array.isArray(node.material)) {
            node.material.forEach((material: THREE.Material) => material.dispose());
          } else {
            node.material.dispose();
          }
        }
      });
    }
  }

  private ensureLoop(): void {
    if (this.animationFrameId !== null) {
      return;
    }

    const tick = (time: number) => {
      this.animationFrameId = requestAnimationFrame(tick);
      this.updateAnimations(time);
      this.render();
    };
    this.animationFrameId = requestAnimationFrame(tick);
  }

  private render(): void {
    if (!this.host) {
      return;
    }
    this.updateCamera();
    this.updateOcclusion();
    this.renderer.render(this.scene, this.camera);
  }
}

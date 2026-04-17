import * as THREE from "three";
import { applyChaosSkyboxBackground } from "./threeSkybox";

export const ARDYCIA_TOON_FOG_COLOR = 0x17211e;
export const ARDYCIA_TOON_FOG_DENSITY = 0.0125;
export const ARDYCIA_TOON_COLOR_GRADE_FILTER = "saturate(1.1) contrast(1.08) brightness(0.98) sepia(0.035)";
export const ARDYCIA_TOON_TONE_EXPOSURE = 1.08;
export const ARDYCIA_TOON_OUTLINE_COLOR = 0x050607;

export const ARDYCIA_TOON_OUTLINE_SCALE = {
  prop: 1.05,
  character: 1.078,
  enemy: 1.088,
  armor: 1.052,
  architecture: 1.035,
  tacticalTile: 1.032,
} as const;

function createToonGradientMap(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([18, 64, 146, 255]), 4, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

const ARDYCIA_TOON_GRADIENT_MAP = createToonGradientMap();

export function applyArdyciaToonRendererStyle(renderer: THREE.WebGLRenderer): void {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = ARDYCIA_TOON_TONE_EXPOSURE;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.filter = ARDYCIA_TOON_COLOR_GRADE_FILTER;
}

export function applyArdyciaToonSceneStyle(scene: THREE.Scene): () => void {
  const clearSkyboxBackground = applyChaosSkyboxBackground(scene, ARDYCIA_TOON_FOG_COLOR);
  scene.fog = new THREE.FogExp2(ARDYCIA_TOON_FOG_COLOR, ARDYCIA_TOON_FOG_DENSITY);

  const hemi = new THREE.HemisphereLight(0xffead0, 0x123447, 0.58);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffc167, 3.65);
  sun.position.set(22, 32, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -60;
  sun.shadow.camera.right = 60;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x63c6d6, 1.05);
  fill.position.set(-24, 14, -28);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xb0f4ff, 0.72);
  rim.position.set(-26, 18, 24);
  scene.add(rim);

  return clearSkyboxBackground;
}

export function createArdyciaToonMaterial(options: {
  color: THREE.ColorRepresentation;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
}): THREE.MeshToonMaterial {
  const parameters: THREE.MeshToonMaterialParameters = {
    color: options.color,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    gradientMap: ARDYCIA_TOON_GRADIENT_MAP,
  };
  if (options.transparent !== undefined) {
    parameters.transparent = options.transparent;
  }
  if (options.opacity !== undefined) {
    parameters.opacity = options.opacity;
  }
  if (options.side !== undefined) {
    parameters.side = options.side;
  }
  return new THREE.MeshToonMaterial(parameters);
}

export function createInvertedHullOutlineMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: ARDYCIA_TOON_OUTLINE_COLOR,
    side: THREE.BackSide,
    depthWrite: true,
    fog: true,
  });
}

function hasToonMaterial(material: THREE.Material | THREE.Material[] | null | undefined): boolean {
  if (!material) {
    return false;
  }
  return Array.isArray(material)
    ? material.some((entry) => entry instanceof THREE.MeshToonMaterial)
    : material instanceof THREE.MeshToonMaterial;
}

export function addInvertedHullOutlines(root: THREE.Object3D, scale: number = ARDYCIA_TOON_OUTLINE_SCALE.character): void {
  const meshes: THREE.Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.Mesh && !(node instanceof THREE.InstancedMesh) && hasToonMaterial(node.material)) {
      meshes.push(node);
    }
  });

  meshes.forEach((mesh) => {
    const outline = new THREE.Mesh(
      mesh.geometry,
      createInvertedHullOutlineMaterial(),
    );
    outline.name = "toon-outline-shell";
    outline.scale.setScalar(scale);
    outline.castShadow = false;
    outline.receiveShadow = false;
    outline.renderOrder = 0;
    mesh.add(outline);
  });
}

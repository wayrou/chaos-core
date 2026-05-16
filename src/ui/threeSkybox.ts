import * as THREE from "three";

export const CHAOS_SKYBOX_BACKGROUND_PATH = "/assets/environment/skybox.png";

let sharedSkyboxTexture: THREE.Texture | null = null;
let pendingSkyboxTexture: Promise<THREE.Texture> | null = null;

function loadChaosSkyboxTexture(): Promise<THREE.Texture> {
  if (sharedSkyboxTexture) {
    return Promise.resolve(sharedSkyboxTexture);
  }

  if (!pendingSkyboxTexture) {
    pendingSkyboxTexture = new THREE.TextureLoader()
      .loadAsync(CHAOS_SKYBOX_BACKGROUND_PATH)
      .then((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        sharedSkyboxTexture = texture;
        return texture;
      })
      .catch((error) => {
        pendingSkyboxTexture = null;
        throw error;
      });
  }

  return pendingSkyboxTexture;
}

export function applyChaosSkyboxBackground(
  scene: THREE.Scene,
  fallbackColor: THREE.ColorRepresentation,
): () => void {
  let isActive = true;
  scene.background = new THREE.Color(fallbackColor);

  void loadChaosSkyboxTexture()
    .then((texture) => {
      if (isActive) {
        scene.background = texture;
      }
    })
    .catch(() => {
      if (isActive) {
        scene.background = new THREE.Color(fallbackColor);
      }
    });

  return () => {
    isActive = false;
  };
}

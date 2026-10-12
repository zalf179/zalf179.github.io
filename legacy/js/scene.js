import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { CONFIG } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: CONFIG.renderer.antialias,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.renderer.pixelRatioCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.renderer.toneMappingExposure;
  renderer.shadowMap.enabled = !!CONFIG.renderer.shadows;
  if (CONFIG.renderer.shadows) {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  renderer.setClearColor(CONFIG.renderer.clearColor, 1);
  return renderer;
}

export function createCamera(aspect) {
  return new THREE.PerspectiveCamera(40, aspect, CONFIG.camera.near, CONFIG.camera.far);
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.renderer.clearColor);
  return scene;
}

export function addLights(scene, bounds) {
  const { hemisphere, key, fill } = CONFIG.lights;

  const hemi = new THREE.HemisphereLight(hemisphere.sky, hemisphere.ground, hemisphere.intensity);
  hemi.position.set(0, 3, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(key.color, key.intensity);
  dir.position.set(...key.position);
  const centre = bounds ? bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3();
  dir.target.position.copy(centre);
  scene.add(dir);
  scene.add(dir.target);

  if (CONFIG.renderer.shadows) {
    dir.castShadow = true;
    dir.shadow.mapSize.set(CONFIG.renderer.shadowMapSize, CONFIG.renderer.shadowMapSize);
    const b = CONFIG.lights.shadowBounds;
    dir.shadow.camera.near = 0.1;
    dir.shadow.camera.far = 12;
    dir.shadow.camera.left = -b;
    dir.shadow.camera.right = b;
    dir.shadow.camera.top = b;
    dir.shadow.camera.bottom = -b;
    dir.shadow.bias = -0.0006;
    dir.shadow.camera.updateProjectionMatrix();
  }

  const fillLight = new THREE.DirectionalLight(fill.color, fill.intensity);
  fillLight.position.set(...fill.position);
  scene.add(fillLight);

  return { hemi, dir, fill: fillLight };
}

// Loads scene.glb (meshopt-compressed + webp textures) and applies correct
// color space / anisotropy / filtering to every texture it contains.
export function loadRoom(manager) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader(manager);
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      CONFIG.assets.glb,
      (gltf) => {
        processTextures(gltf.scene);
        resolve(gltf);
      },
      undefined,
      reject
    );
  });
}

// Returns { maxAnisotropy } for logging and reports low-res textures.
export function processTextures(room) {
  const seen = new Map();
  const lowRes = [];

  room.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const key of Object.keys(mat)) {
        const tex = mat[key];
        if (!tex || !tex.isTexture) continue;

        // Colour textures must be sRGB; data textures (normal/rough/metal) stay linear.
        const isColor = /map$/i.test(key) && !/normal|roughness|metalness|specular|alpha/i.test(key);
        tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;

        const maxAniso = getMaxAnisotropy();
        tex.anisotropy = maxAniso;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;

        const img = tex.image;
        const w = img?.width || img?.videoWidth || 0;
        const h = img?.height || img?.videoHeight || 0;
        if (w && h && !seen.has(tex.uuid)) {
          seen.set(tex.uuid, true);
          if (Math.max(w, h) < 512) lowRes.push({ name: tex.name || key, w, h, mesh: obj.name });
        }
      }
    }
  });

  return { lowRes };
}

// Small helper so processTextures can report without a renderer handle.
let _maxAniso = 1;
export function setMaxAnisotropy(v) { _maxAniso = Math.max(1, v | 0); }
function getMaxAnisotropy() { return _maxAniso; }

// Exact-name lookup for the four screen meshes + a list of all screen quads.
export function collectScreens(room) {
  const byName = new Map();
  const all = [];
  room.traverse((obj) => {
    if (obj.isMesh) byName.set(obj.name, obj);
  });
  for (const stop of CONFIG.stops) {
    const mesh = byName.get(stop.mesh);
    if (mesh) all.push(mesh);
  }
  return { byName, all };
}

export function measureBounds(room) {
  return new THREE.Box3().setFromObject(room);
}

export function resizeRenderer(renderer, camera) {
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.renderer.pixelRatioCap));
  renderer.setSize(w, h, false);
  return { width: w, height: h };
}

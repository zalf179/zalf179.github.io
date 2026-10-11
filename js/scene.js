import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.renderer.pixelRatioCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.renderer.toneMappingExposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(CONFIG.renderer.clearColor, 1);
  return renderer;
}

export function createCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(38, aspect, CONFIG.camera.near, CONFIG.camera.far);
  return camera;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.renderer.clearColor);
  return scene;
}

export function addLights(scene, roomBounds) {
  const lights = [];

  const hemi = new THREE.HemisphereLight(
    CONFIG.lights.hemisphere.sky,
    CONFIG.lights.hemisphere.ground,
    CONFIG.lights.hemisphere.intensity
  );
  scene.add(hemi);
  lights.push(hemi);

  const key = new THREE.DirectionalLight(CONFIG.lights.key.color, CONFIG.lights.key.intensity);
  key.position.set(...CONFIG.lights.key.position);
  key.castShadow = true;
  key.shadow.mapSize.set(CONFIG.renderer.shadowMapSize, CONFIG.renderer.shadowMapSize);
  const b = CONFIG.lights.shadowBounds;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 12;
  key.shadow.camera.left = -b;
  key.shadow.camera.right = b;
  key.shadow.camera.top = b;
  key.shadow.camera.bottom = -b;
  key.shadow.bias = -0.0005;
  key.target.position.set(roomBounds ? roomBounds.getCenter(new THREE.Vector3()) : 0, 0.9, 0);
  scene.add(key);
  scene.add(key.target);
  lights.push(key);

  const fill = new THREE.DirectionalLight(CONFIG.lights.fill.color, CONFIG.lights.fill.intensity);
  fill.position.set(...CONFIG.lights.fill.position);
  scene.add(fill);
  lights.push(fill);

  return { lights, key };
}

// Loads the .gltf via a shared LoadingManager so the loading screen can track
// progress across the model + every texture.
export function loadRoom(manager) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader(manager);
    loader.load(CONFIG.assets.gltf, (gltf) => resolve(gltf), undefined, reject);
  });
}

// Collect references used for idle motion / live tweaks.
// Returns { chair, chairBaseY, screens[], bounds }
export function collectRefs(room) {
  const refs = { chair: null, chairBaseY: 0, screens: [], bounds: null };
  const bounds = new THREE.Box3();

  room.traverse((obj) => {
    if (!obj.isMesh) return;

    bounds.expandByObject(obj);

    if (obj.name === 'Chair') {
      refs.chair = obj;
      refs.chairBaseY = obj.rotation.y;
    }
    // Screens light up the desk monitors/wall TV. Cheap emissive sheen only.
    if (/Screen/i.test(obj.name) || /^Tv_.*_0$/i.test(obj.name)) {
      const clone = obj.material.clone();
      clone.emissive = new THREE.Color(0x00ff41);
      clone.emissiveIntensity = CONFIG.idle.glowFlicker * 0.4;
      obj.material = clone;
      refs.screens.push(obj);
    }
  });

  if (bounds.isEmpty()) return refs;
  refs.bounds = bounds;
  return refs;
}

export function resizeRenderer(renderer, camera) {
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.renderer.pixelRatioCap));
  return { width: w, height: h };
}
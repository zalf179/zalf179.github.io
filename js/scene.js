import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CONFIG, FEATURES, QUALITY } from './config.js';

// Renderer: SRGB output, ACES tone mapping, capped pixel ratio, transparent
// canvas so the CSS3D screen can remain visible beneath the WebGL scene.
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: CONFIG.renderer.antialias,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.renderer.toneMappingExposure;
  renderer.shadowMap.enabled = CONFIG.shadows.enabled;
  if (CONFIG.shadows.enabled) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(CONFIG.renderer.clearColor, CONFIG.renderer.clearAlpha);
  return renderer;
}

export function createCamera(aspect) {
  return new THREE.PerspectiveCamera(CONFIG.camera.fov, aspect, CONFIG.camera.near, CONFIG.camera.far);
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = null; // CSS room-tone color shows through the alpha canvas
  const f = CONFIG.environment.fog;
  scene.fog = new THREE.Fog(CONFIG.room.backgroundColor, f.near, f.far);
  return scene;
}

// PMREM + RoomEnvironment: low-intensity IBL for believable PBR reflections.
export function setupEnvironment(scene, renderer) {
  const R = CONFIG.room;
  const surfaceDetail = FEATURES.surfaceDetail ? makeSurfaceDetailTexture(96) : null;
  const floorDetail = surfaceDetail && surfaceDetail.clone();
  if (floorDetail) {
    floorDetail.wrapS = floorDetail.wrapT = THREE.RepeatWrapping;
    floorDetail.repeat.set(18, 18);
    floorDetail.needsUpdate = true;
  }
  const wallDetail = surfaceDetail && surfaceDetail.clone();
  if (wallDetail) {
    wallDetail.wrapS = wallDetail.wrapT = THREE.RepeatWrapping;
    wallDetail.repeat.set(5, 3);
    wallDetail.needsUpdate = true;
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(R.floorSize, R.floorSize),
    new THREE.MeshStandardMaterial({
      color: R.floorColor, roughness: R.floorRoughness, roughnessMap: floorDetail || null,
      bumpMap: floorDetail || null, bumpScale: 0.012,
    }),
  );
  floor.name = 'room-floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(R.wallWidth, R.wallHeight),
    new THREE.MeshStandardMaterial({
      color: R.wallColor, roughness: R.wallRoughness, roughnessMap: wallDetail || null,
      bumpMap: wallDetail || null, bumpScale: 0.006,
    }),
  );
  wall.name = 'room-back-wall';
  wall.position.set(0, R.wallHeight / 2, R.wallZ);
  wall.receiveShadow = true;
  scene.add(wall);

  // Side walls close the room around the desk while staying beyond the
  // free-look orbit. Their inner faces point toward the center of the room.
  const sideGeometry = new THREE.PlaneGeometry(R.sideWallDepth, R.wallHeight);
  const sideMaterial = new THREE.MeshStandardMaterial({
    color: R.wallColor, roughness: R.wallRoughness, roughnessMap: wallDetail || null,
    bumpMap: wallDetail || null, bumpScale: 0.006,
    side: THREE.DoubleSide,
  });
  for (const [name, x, rotationY] of [
    ['left', -R.sideWallX, Math.PI / 2],
    ['right', R.sideWallX, -Math.PI / 2],
  ]) {
    const sideWall = new THREE.Mesh(sideGeometry, sideMaterial);
    sideWall.name = `room-${name}-wall`;
    sideWall.rotation.y = rotationY;
    sideWall.position.set(x, R.wallHeight / 2, (R.sideWallFrontZ + R.wallZ) / 2);
    sideWall.receiveShadow = true;
    scene.add(sideWall);
  }

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();
  return envTex;
}

let _maxAniso = 1;
export function setMaxAnisotropy(v) { _maxAniso = Math.max(1, v | 0); }
export function getMaxAnisotropy() { return _maxAniso; }

// Loads computer_desk-opt.glb (meshopt-compressed + webp + quantized) and
// fixes colour space / anisotropy / filtering on every texture.
export function loadModel(manager, onProgress) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader(manager);
    loader.setMeshoptDecoder(MeshoptDecoder); // REQUIRED for this file
    loader.load(
      CONFIG.assets.model,
      (gltf) => {
        const report = processTextures(gltf.scene);
        resolve({ gltf, report });
      },
      onProgress,
      reject,
    );
  });
}

export function processTextures(root) {
  const seen = new Map();
  const lowRes = [];

  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat) continue;

      // Low-intensity env map so reflections read but stay dark.
      if ('envMapIntensity' in mat) mat.envMapIntensity = CONFIG.env.intensity;

      for (const key of Object.keys(mat)) {
        const tex = mat[key];
        if (!tex || !tex.isTexture) continue;

        // Colour maps must be sRGB; data maps (normal/rough/metal/ao) linear.
        const isColor = /map$/i.test(key) && !/normal|rough|metal|specular|alpha|ao|occlusion/i.test(key);
        tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.anisotropy = _maxAniso;
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

  return { lowRes, textures: seen.size };
}

export function measureBounds(root) {
  return new THREE.Box3().setFromObject(root);
}

export function resizeRenderer(renderer, camera) {
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const cap = window.innerWidth < CONFIG.mobileWidth ? QUALITY.mobilePixelRatioCap : CONFIG.renderer.pixelRatioCap;
  const qualityCap = QUALITY.deviceTier === 'low' || QUALITY.mode === 'low' ? 1 : cap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityCap));
  renderer.setSize(w, h, false);
  return { width: w, height: h };
}

// Find specific named meshes once, for references (chair sway, screen verify).
export function findMeshes(root) {
  const byName = new Map();
  root.traverse((o) => { if (o.isMesh) byName.set(o.name, o); });
  return byName;
}

// Debug helper: re-derive the display quad from the monitor mesh geometry and
// compare with CONFIG.screen. Returns { ok, center, ... } or null.
export function verifyScreenQuad(monitorMesh) {
  if (!monitorMesh) return null;
  const g = monitorMesh.geometry;
  const pos = g.attributes.position;
  const idx = g.index;
  const nm = new THREE.Matrix3().getNormalMatrix(monitorMesh.matrixWorld);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  const groups = new Map();
  const gp = (i) => a.fromBufferAttribute(pos, i).applyMatrix4(monitorMesh.matrixWorld).clone();

  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    const v0 = gp(i0); const v1 = gp(i1); const v2 = gp(i2);
    n.fromBufferAttribute(g.attributes.normal, i0).applyMatrix3(nm).normalize();
    const key = [Math.round(n.x * 5) / 5, Math.round(n.y * 5) / 5, Math.round(n.z * 5) / 5].join(',');
    const area = new THREE.Vector3().subVectors(v1, v0).cross(new THREE.Vector3().subVectors(v2, v0)).length() / 2;
    if (!groups.has(key)) groups.set(key, { n: n.clone(), area: 0, pts: [] });
    const grp = groups.get(key);
    grp.area += area;
    grp.pts.push(v0, v1, v2);
  }

  // Largest-area group whose normal points forward (+Z) — the display panel.
  let best = null;
  for (const grp of groups.values()) {
    if (grp.n.z < 0.5) continue;
    if (!best || grp.area > best.area) best = grp;
  }
  if (!best) return null;

  const box = new THREE.Box3();
  for (const p of best.pts) box.expandByPoint(p);
  const center = box.getCenter(new THREE.Vector3());
  return { ok: true, center, normal: best.n.clone(), area: best.area };
}

// Tiny generated grayscale grain tiles keep the room surfaces from reading
// as perfectly flat without adding an external texture dependency.
export function makeSurfaceDetailTexture(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  let seed = 179;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const value = 112 + (seed % 32);
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CONFIG } from './config.js';

// Renderer: SRGB output, ACES tone mapping, capped pixel ratio, transparent
// canvas so the CSS3D screen can remain visible beneath the WebGL scene.
export function createRenderer(canvas) {
  const palette = CONFIG.field;
  const cssColor = (value) => `#${value.toString(16).padStart(6, '0')}`;
  document.documentElement.style.setProperty('--field-sky', cssColor(palette.skyColor));
  document.documentElement.style.setProperty('--field-haze', cssColor(palette.hazeColor));
  document.documentElement.style.setProperty('--field-ground', cssColor(palette.groundColor));
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
  scene.background = null; // CSS sky shows through the alpha canvas and display hole
  const f = CONFIG.environment.fog;
  scene.fog = new THREE.Fog(CONFIG.field.hazeColor, f.near, f.far);
  return scene;
}

// Open field floor plus a procedural grass detail texture. The sky stays in
// the page background so this environment never paints over the CSS3D screen.
export function setupEnvironment(scene, renderer) {
  const F = CONFIG.field;
  const grassTexture = makeGrassTexture(F, renderer);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(F.size, F.size),
    new THREE.MeshStandardMaterial({
      color: F.groundColor,
      map: grassTexture,
      roughness: F.roughness,
    }),
  );
  floor.name = 'grass-field';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);
  const wavingGrass = F.wavingGrass.enabled ? createWavingGrass(scene, F) : null;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();
  return wavingGrass;
}

export async function loadFieldModels(manager) {
  const loader = new GLTFLoader(manager);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const [grassAsset, treeAsset] = await Promise.all([
    loader.loadAsync(CONFIG.assets.fieldGrass),
    loader.loadAsync(CONFIG.assets.fieldTree),
  ]);
  processTextures(grassAsset.scene);
  processTextures(treeAsset.scene);
  return { grassAsset, treeAsset };
}

export function setupFieldModels(scene, { grassAsset, treeAsset }) {
  const F = CONFIG.field;
  const patches = F.grassPatches;
  const grassRoot = grassAsset.scene;
  grassRoot.updateMatrixWorld(true);
  const grassSources = [];
  grassRoot.traverse((object) => {
    if (object.isMesh && object.name.startsWith('Grass1_')) grassSources.push(object);
  });
  let grassTrianglesPerPatch = 0;
  let treeTrianglesPerModel = 0;
  if (grassSources.length && patches.count > 0) {
    const halfArea = patches.area / 2;
    let seed = 882743;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const placements = Array.from({ length: patches.count }, () => {
      let x = 0;
      let z = 0;
      do {
        x = (random() * 2 - 1) * halfArea;
        z = (random() * 2 - 1) * halfArea;
      } while (x * x + z * z < patches.excludeDeskRadius * patches.excludeDeskRadius);
      return {
        position: new THREE.Vector3(x, 0, z),
        rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * Math.PI * 2),
      };
    });

    grassRoot.updateWorldMatrix(true, true);
    for (const sourceMesh of grassSources) {
      sourceMesh.geometry.computeBoundingBox();
      const localCenter = sourceMesh.geometry.boundingBox.getCenter(new THREE.Vector3());
      const world = sourceMesh.matrixWorld.clone();
      const sourcePosition = new THREE.Vector3();
      const sourceRotation = new THREE.Quaternion();
      const sourceScale = new THREE.Vector3();
      world.decompose(sourcePosition, sourceRotation, sourceScale);
      const sourceBasis = new THREE.Matrix4().compose(new THREE.Vector3(), sourceRotation, sourceScale);
      const recenter = new THREE.Matrix4().makeTranslation(-localCenter.x, -localCenter.y, -localCenter.z);
      const instances = new THREE.InstancedMesh(sourceMesh.geometry, sourceMesh.material, patches.count);
      const placement = new THREE.Matrix4();
      const scale = new THREE.Vector3(patches.scale, patches.scale, patches.scale);
      const baseMatrix = new THREE.Matrix4();
      const geometry = sourceMesh.geometry;
      const indexCount = geometry.index ? geometry.index.count : geometry.attributes.position.count;
      grassTrianglesPerPatch += Math.floor(indexCount / 3);
      for (let i = 0; i < placements.length; i++) {
        placement.compose(placements[i].position, placements[i].rotation, scale);
        baseMatrix.copy(placement).multiply(sourceBasis).multiply(recenter);
        instances.setMatrixAt(i, baseMatrix);
      }
      instances.instanceMatrix.needsUpdate = true;
      instances.name = `field-grass-${sourceMesh.name}`;
      instances.castShadow = false;
      instances.receiveShadow = false;
      instances.computeBoundingSphere();
      scene.add(instances);
    }
  } else {
    console.warn('[field] no Grass1 meshes were found in grass.glb.');
  }

  const mixers = [];
  const treeTemplate = treeAsset.scene;
  treeTemplate.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry;
    const indexCount = geometry.index ? geometry.index.count : geometry.attributes.position.count;
    treeTrianglesPerModel += Math.floor(indexCount / 3);
  });
  for (const [x, z] of F.trees.placements) {
    const tree = treeTemplate.clone(true);
    tree.name = 'field-tree';
    tree.rotation.z = -Math.PI / 2; // The source tree grows along local -X.
    tree.scale.setScalar(F.trees.scale);
    tree.position.set(x, 0.17, z);
    tree.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = false;
      object.receiveShadow = true;
    });
    scene.add(tree);
    if (treeAsset.animations.length) {
      const mixer = new THREE.AnimationMixer(tree);
      const action = mixer.clipAction(treeAsset.animations[0]);
      action.play();
      mixer.timeScale = F.trees.animationSpeed;
      mixers.push(mixer);
    }
  }

  const resourceBytes = (path) => {
    const url = new URL(path, document.baseURI).href;
    const entry = performance.getEntriesByName(url).at(-1);
    return entry?.encodedBodySize || entry?.transferSize || 0;
  };
  let lastUpdate = null;
  return {
    stats: {
      grassFileBytes: resourceBytes(CONFIG.assets.fieldGrass),
      grassTrianglesPerPatch,
      grassPatches: grassSources.length ? patches.count : 0,
      treeFileBytes: resourceBytes(CONFIG.assets.fieldTree),
      treeTrianglesPerModel,
      treeInstances: F.trees.placements.length,
    },
    update(now) {
      const delta = lastUpdate === null ? 0 : Math.min(0.1, (now - lastUpdate) / 1000);
      lastUpdate = now;
      for (const mixer of mixers) mixer.update(delta);
      return mixers.length > 0;
    },
  };
}

function createWavingGrass(scene, field) {
  const config = field.wavingGrass;
  let seed = 1987421;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const palette = field.grassColors.map((hex) => new THREE.Color(hex));
  const halfArea = config.area / 2;
  const bladeCount = config.tuftCount * config.bladesPerTuft;
  const verticesPerBlade = 6;
  const positions = new Float32Array(bladeCount * verticesPerBlade * 3);
  const colors = new Float32Array(bladeCount * verticesPerBlade * 3);
  const tips = new Float32Array(bladeCount * verticesPerBlade);
  const phases = new Float32Array(bladeCount * verticesPerBlade);
  const winds = new Float32Array(bladeCount * verticesPerBlade * 2);
  const indices = new Uint32Array(bladeCount * 12);
  const sectionT = [0, 0, 0.55, 0.55, 1, 1];
  const sectionSide = [-1, 1, -1, 1, -1, 1];
  const vertexColor = [0.62, 0.62, 0.88, 0.88, 1.08, 1.08];

  let blade = 0;
  for (let i = 0; i < config.tuftCount; i++) {
    let x = 0;
    let z = 0;
    // Leave a tidy clear patch under the desk and chair, then grow dense
    // little clumps around the rest of the field.
    do {
      x = (random() * 2 - 1) * halfArea;
      z = (random() * 2 - 1) * halfArea;
    } while (x * x + z * z < config.excludeDeskRadius * config.excludeDeskRadius);

    const tuftRadius = 0.018 + random() * 0.04;
    for (let b = 0; b < config.bladesPerTuft; b++, blade++) {
      const rootX = x + (random() - 0.5) * tuftRadius;
      const rootZ = z + (random() - 0.5) * tuftRadius;
      const height = config.heightMin + random() * (config.heightMax - config.heightMin);
      const width = config.widthMin + random() * (config.widthMax - config.widthMin);
      const angle = random() * Math.PI * 2;
      const windX = Math.cos(angle + Math.PI / 2);
      const windZ = Math.sin(angle + Math.PI / 2);
      const phase = random() * Math.PI * 2;
      const color = palette[Math.floor(random() * palette.length)].clone().multiplyScalar(0.82 + random() * 0.3);
      const baseVertex = blade * verticesPerBlade;

      // Three tapered cross sections form a gently curved leaf strip.
      for (let v = 0; v < verticesPerBlade; v++) {
        const section = sectionT[v];
        const side = sectionSide[v];
        const halfWidth = width * 0.5 * (1 - section * 0.97);
        const curve = height * 0.13 * section * section;
        const sideX = Math.cos(angle) * halfWidth * side;
        const sideZ = Math.sin(angle) * halfWidth * side;
        const out = (baseVertex + v) * 3;
        positions[out] = rootX + windX * curve + sideX;
        positions[out + 1] = 0.006 + height * section;
        positions[out + 2] = rootZ + windZ * curve + sideZ;
        const tint = vertexColor[v] * (0.88 + random() * 0.12);
        colors[out] = color.r * tint;
        colors[out + 1] = color.g * tint;
        colors[out + 2] = color.b * tint;
        tips[baseVertex + v] = section;
        phases[baseVertex + v] = phase;
        winds[(baseVertex + v) * 2] = windX;
        winds[(baseVertex + v) * 2 + 1] = windZ;
      }

      const idx = blade * 12;
      for (let segment = 0; segment < 2; segment++) {
        const v = baseVertex + segment * 2;
        const index = idx + segment * 6;
        indices[index] = v;
        indices[index + 1] = v + 1;
        indices[index + 2] = v + 2;
        indices[index + 3] = v + 2;
        indices[index + 4] = v + 1;
        indices[index + 5] = v + 3;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aTip', new THREE.BufferAttribute(tips, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aWind', new THREE.BufferAttribute(winds, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  const uniforms = {
    time: { value: 0 },
    speed: { value: config.windSpeed },
    strength: { value: config.windStrength },
  };
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGrassTime = uniforms.time;
    shader.uniforms.uGrassSpeed = uniforms.speed;
    shader.uniforms.uGrassStrength = uniforms.strength;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uGrassTime;\nuniform float uGrassSpeed;\nuniform float uGrassStrength;\nattribute float aTip;\nattribute float aPhase;\nattribute vec2 aWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float breeze = sin(uGrassTime * uGrassSpeed + aPhase);
        transformed.xz += aWind * breeze * uGrassStrength * aTip * aTip;`);
  };
  material.customProgramCacheKey = () => 'waving-grass-v1';

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'waving-grass-blades';
  mesh.frustumCulled = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  scene.add(mesh);
  return { update: (now) => { uniforms.time.value = now * 0.001; return true; } };
}

function makeGrassTexture(config, renderer) {
  const size = config.textureResolution;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const colors = config.grassColors.map((color) => `#${color.toString(16).padStart(6, '0')}`);
  ctx.fillStyle = colors[1];
  ctx.fillRect(0, 0, size, size);

  // Deterministic, varied short strokes make the ground read as grass while
  // keeping the field to one mesh and one draw call.
  let seed = 934857;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < config.bladesPerTexture; i++) {
    const x = random() * size;
    const y = random() * size;
    const length = 2 + random() * 9;
    const lean = (random() - 0.5) * 8;
    ctx.strokeStyle = colors[Math.floor(random() * colors.length)];
    ctx.globalAlpha = 0.28 + random() * 0.5;
    ctx.lineWidth = 0.7 + random() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.45, y - length * 0.55, x + lean, y - length);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(config.textureRepeat, config.textureRepeat);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
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

      if (/(leaf|branch|grass)/i.test(mat.name || '')) {
        mat.alphaTest = 0.5;
        mat.transparent = false;
        mat.depthWrite = true;
        mat.side = THREE.DoubleSide;
        mat.needsUpdate = true;
      }

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.renderer.pixelRatioCap));
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

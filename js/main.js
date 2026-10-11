import * as THREE from 'three';
import { CONFIG } from './config.js';
import {
  createRenderer,
  createCamera,
  createScene,
  addLights,
  loadRoom,
  collectScreens,
  measureBounds,
  resizeRenderer,
  setMaxAnisotropy,
} from './scene.js';

const canvas = document.getElementById('scene-canvas');
const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderLabel = document.getElementById('loader-label');
const errorEl = document.getElementById('scene-error');

let dirty = true;
const markDirty = () => { dirty = true; };

// ---------------------------------------------------------------- UI helpers
function setProgress(pct) {
  if (loaderFill) loaderFill.style.width = `${pct}%`;
  if (loaderLabel) loaderLabel.textContent = `LOADING ${Math.round(pct)}%`;
}

function fadeLoader() {
  if (!loaderEl) return;
  loaderEl.classList.add('done');
  window.setTimeout(() => loaderEl.remove(), 700);
}

function showError(message) {
  document.body.classList.add('no-webgl');
  if (errorEl) {
    errorEl.hidden = false;
    const msg = errorEl.querySelector('[data-message]');
    if (msg) msg.textContent = message;
  }
  if (loaderEl) loaderEl.classList.add('done');
  markDirty();
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------- boot
function boot() {
  if (!canvas) return;

  if (!webglAvailable()) {
    showError('WebGL is not available on this device, so the 3D room cannot render. The full portfolio is shown as plain text instead.');
    return;
  }

  let renderer;
  try {
    renderer = createRenderer(canvas);
  } catch (err) {
    console.error('Renderer init failed:', err);
    showError('Could not initialise WebGL. The full portfolio is shown as plain text instead.');
    return;
  }

  setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

  const scene = createScene();
  const camera = createCamera(window.innerWidth / Math.max(window.innerHeight, 1));

  // Establish the room in frame before the model arrives (nice wide shot).
  camera.position.set(2.6, 1.55, 2.6);
  camera.lookAt(-0.12, 0.9, -0.15);

  resizeRenderer(renderer, camera);
  renderer.render(scene, camera);

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    if (total > 0) setProgress((loaded / total) * 100);
  };
  manager.onError = (url) => console.error('Asset load error:', url);

  window.addEventListener('resize', () => { resizeRenderer(renderer, camera); markDirty(); });
  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => { resizeRenderer(renderer, camera); markDirty(); }, 150);
  });

  loadRoom(manager)
    .then((gltf) => {
      const room = gltf.scene || gltf.scenes[0];
      scene.add(room);

      const bounds = measureBounds(room);
      addLights(scene, bounds);

      // Keep references for later stages (screens / camera path).
      const screens = collectScreens(room);
      app.room = room;
      app.bounds = bounds;
      app.screens = screens;

      setProgress(100);
      fadeLoader();
      markDirty();

      // Optional debug surface: ?debug in the URL, or press D for OrbitControls.
      if (new URLSearchParams(location.search).has('debug')) {
        window.__zally = app;
      }
    })
    .catch((err) => {
      console.error('Scene load failed:', err);
      showError('The 3D scene could not be loaded. The full portfolio is shown as plain text instead.');
    });

  // ---------------------------------------------------------- debug controls
  let orbit = null;
  window.addEventListener('keydown', async (e) => {
    if (e.key !== 'd' && e.key !== 'D') return;
    if (!orbit) {
      const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
      orbit = new OrbitControls(camera, canvas);
      orbit.enableDamping = true;
      orbit.target.set(-0.12, 0.9, -0.15);
      orbit.addEventListener('change', markDirty);
      console.log('[debug] OrbitControls enabled — drag to orbit, press D again for info.');
    } else {
      const info = renderer.info;
      console.log('[debug] camera', camera.position.toArray().map((n) => +n.toFixed(3)));
      console.log('[debug] target', orbit.target.toArray().map((n) => +n.toFixed(3)));
      console.log('[debug] fov', camera.fov);
      console.log('[debug] renderer.info', {
        triangles: info.render.triangles,
        calls: info.render.calls,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length,
      });
      orbit.update();
    }
    markDirty();
  });

  // ------------------------------------------------------------ render loop
  let last = performance.now();
  function loop() {
    requestAnimationFrame(loop);
    if (document.hidden) { last = performance.now(); return; }

    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    if (app.onFrame) app.onFrame(now, dt, markDirty);

    if (orbit) orbit.update();

    if (dirty) {
      renderer.render(scene, camera);
      dirty = false;
    }
  }

  // Shared app object so later stages can register hooks without globals.
  const app = { renderer, scene, camera, room: null, bounds: null, screens: null, markDirty, onFrame: null };
  loop();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

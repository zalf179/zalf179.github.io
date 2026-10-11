import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRenderer, createCamera, createScene, addLights, loadRoom, collectRefs, resizeRenderer } from './scene.js';
import { createCameraPath } from './camera-path.js';

const canvas = document.getElementById('scene-canvas');
const loader = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderLabel = document.getElementById('loader-label');
const errorBox = document.getElementById('scene-error');

// --- public helpers ---------------------------------------------------------
function setLoadingProgress(pct) {
  if (!loaderFill) return;
  loaderFill.style.width = `${pct}%`;
  if (loaderLabel) loaderLabel.textContent = `LOADING_SCENE ${Math.round(pct)}%`;
}

function fadeLoadingScreen() {
  if (!loader) return;
  loader.classList.add('done');
  window.setTimeout(() => {
    if (loader.parentNode) loader.parentNode.removeChild(loader);
  }, 700);
}

function showError(message) {
  if (errorBox) {
    errorBox.hidden = false;
    const msgEl = errorBox.querySelector('[data-message]');
    if (msgEl) msgEl.textContent = message;
  }
  // Make the page readable without the 3D scene behind it.
  document.body.classList.add('no-webgl');
  if (loader) {
    loader.classList.add('done');
    window.setTimeout(() => {
      if (loader.parentNode) loader.parentNode.removeChild(loader);
    }, 700);
  }
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl'))
    );
  } catch (err) {
    return false;
  }
}

function boot() {
  if (!canvas) return;
  if (!webglAvailable()) {
    showError('WebGL is not available on this device, so the 3D room cannot render. All portfolio content below still works.');
    return;
  }

  let renderer;
  try {
    renderer = createRenderer(canvas);
  } catch (err) {
    console.error('Renderer init failed:', err);
    showError('Could not initialise WebGL. All portfolio content below still works.');
    return;
  }

  const camera = createCamera(window.innerWidth / Math.max(window.innerHeight, 1));
  const scene = createScene();
  addLights(scene);

  // Loading manager drives the progress bar across gltf + all textures.
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    if (total > 0) setLoadingProgress((loaded / total) * 100);
  };
  manager.onError = (url) => {
    console.error('Asset load error:', url);
  };

  let path = null;

  const onResizePath = () => {
    if (path) path.rebuild();
  };

  window.addEventListener('resize', () => {
    resizeRenderer(renderer, camera);
    onResizePath();
  });
  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => {
      resizeRenderer(renderer, camera);
      onResizePath();
    }, 150);
  });

  loadRoom(manager)
    .then((gltf) => {
      const room = gltf.scene || gltf.scenes[0];
      scene.add(room);
      const refs = collectRefs(room);

      // Keep the loader bar finishing at 100% then fade it out.
      setLoadingProgress(100);
      fadeLoadingScreen();

      path = createCameraPath({ camera, refs, onDirty: () => (dirty = true) });
      path.ready(true);

      // Debug hook (optional): open with ?debug to read live camera state.
      if (new URLSearchParams(window.location.search).has('debug')) {
        window.__zally = {
          camera,
          renderer,
          state: () => ({
            scrollY: window.pageYOffset,
            pos: camera.position.toArray().map((n) => +n.toFixed(3)),
            target: path ? path.rig.target.toArray().map((n) => +n.toFixed(3)) : null,
            fov: camera.fov,
          }),
        };
      }

      requestAnimationFrame(loop);
    })
    .catch((err) => {
      console.error('Scene load failed:', err);
      showError('The 3D scene could not be loaded. All portfolio content below still works.');
    });

  // --- render loop ----------------------------------------------------------
  let dirty = true;
  let last = performance.now();

  function loop() {
    requestAnimationFrame(loop);

    // Skip all work while the tab is hidden.
    if (document.hidden) {
      last = performance.now();
      return;
    }

    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    if (path) path.update(now, dt);

    if (dirty) {
      renderer.render(scene, camera);
      dirty = false;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
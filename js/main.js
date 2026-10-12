import * as THREE from 'three';
import { CONFIG } from './config.js';
import {
  createRenderer, createCamera, createScene, setupEnvironment,
  loadModel, measureBounds, resizeRenderer, setMaxAnisotropy,
  findMeshes, verifyScreenQuad,
} from './scene.js';
import { setupLights } from './lighting.js';

const canvas = document.getElementById('scene-canvas');
const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderLabel = document.getElementById('loader-label');
const errorEl = document.getElementById('scene-error');
const hintEl = document.getElementById('scroll-hint');

export const REDUCED = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

// ------------------------------------------------------------------- UI
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
}
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

// ------------------------------------------------------------------- boot
function boot() {
  if (!canvas) return;

  if (!webglAvailable()) {
    showError('WebGL is not available on this device, so the 3D scene cannot render. The full portfolio is shown as plain text instead.');
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

  // Stage-1 establishing shot (replaced by the scrubbed path in stage 3).
  // A 3/4 view from the right so the chair doesn't block the desk.
  camera.position.set(2.2, 1.55, 1.35);
  camera.lookAt(0.0, 0.72, 0.05);

  resizeRenderer(renderer, camera);
  renderer.render(scene, camera);

  const app = {
    renderer, scene, camera, model: null, bounds: null, meshes: null,
    lights: null, debug: false, markDirty: () => { dirty = true; },
  };
  window.__zally = app;

  let dirty = true;

  window.addEventListener('resize', () => { resizeRenderer(renderer, camera); dirty = true; });
  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => { resizeRenderer(renderer, camera); dirty = true; }, 150);
  });

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => { if (total > 0) setProgress((loaded / total) * 100); };
  manager.onError = (url) => console.error('Asset load error:', url);

  setupEnvironment(scene, renderer);

  loadModel(manager)
    .then(({ gltf, report }) => {
      const model = gltf.scene || gltf.scenes[0];
      scene.add(model);

      const bounds = measureBounds(model);
      const lights = setupLights(scene, bounds);

      app.model = model;
      app.bounds = bounds;
      app.meshes = findMeshes(model);
      app.lights = lights;
      lights.lamp.setOn(1); // stage 4 drives this from camera proximity

      console.log(
        `[scene] loaded · ${report.textures} textures` +
        (report.lowRes.length ? ` · low-res: ${report.lowRes.map(t => `${t.mesh}/${t.name} ${t.w}x${t.h}`).join(', ')}` : ''),
      );

      setProgress(100);
      fadeLoader();
      dirty = true;

      const params = new URLSearchParams(location.search);
      if (params.has('debug')) enableDebugInfo();
    })
    .catch((err) => {
      console.error('Scene load failed:', err);
      showError('The 3D scene could not be loaded. The full portfolio is shown as plain text instead.');
    });

  // Hide the scroll hint after the first scroll.
  if (hintEl) {
    const onFirstScroll = () => { hintEl.classList.add('hidden'); window.removeEventListener('scroll', onFirstScroll); };
    window.addEventListener('scroll', onFirstScroll, { passive: true });
  }

  // ------------------------------------------------------------ debug
  // D = toggle OrbitControls (free-look tuning) + perf logging.
  // V = verify the hardcoded screen quad against the mesh geometry.
  let orbit = null;
  let infoOn = false;
  function enableDebugInfo() {
    infoOn = true;
    app.debug = true;
    console.log('[debug] info logging ON — press D for OrbitControls, V to verify screen quad.');
  }

  window.addEventListener('keydown', async (e) => {
    const key = e.key.toLowerCase();
    if (key === 'd') {
      if (!orbit) {
        const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
        orbit = new OrbitControls(camera, canvas);
        orbit.enableDamping = true;
        orbit.addEventListener('change', () => { dirty = true; });
        console.log('[debug] OrbitControls ON — drag to orbit. Press D again to stop.');
      } else {
        orbit.dispose();
        orbit = null;
        console.log('[debug] OrbitControls OFF.');
      }
      dirty = true;
      return;
    }
    if (key === 'v' && app.meshes) {
      const mon = app.meshes.get('Monitor_Monitor_0');
      const r = verifyScreenQuad(mon);
      if (!r) { console.warn('[verify] could not measure monitor mesh.'); return; }
      const expected = new THREE.Vector3(...CONFIG.screen.center);
      const d = r.center.distanceTo(expected);
      console.log(
        `[verify] measured screen centre ${r.center.toArray().map(v => v.toFixed(4)).join(', ')} ` +
        `vs config ${CONFIG.screen.center.join(', ')} · delta ${d.toFixed(4)}`,
      );
      if (d > 0.02) console.warn('[verify] WARNING: hardcoded screen quad may have drifted.');
      return;
    }
  });

  // ------------------------------------------------------------ loop
  let last = performance.now();
  let frames = 0;
  let perfLast = performance.now();

  function loop() {
    requestAnimationFrame(loop);
    if (document.hidden) { last = performance.now(); return; }

    const now = performance.now();
    last = now;

    if (orbit) { orbit.update(); dirty = true; }

    if (dirty) {
      renderer.render(scene, camera);
      dirty = false;
    }

    frames++;
    if (infoOn && now - perfLast >= 1000) {
      const fps = Math.round((frames * 1000) / (now - perfLast));
      const i = renderer.info;
      console.log(`[perf] ${fps} fps · calls ${i.render.calls} · tris ${i.render.triangles} · tex ${i.memory.textures} · geo ${i.memory.geometries}`);
      frames = 0;
      perfLast = now;
    }
  }

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  loop();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

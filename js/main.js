import * as THREE from 'three';
import { CONFIG } from './config.js';
import {
  createRenderer, createCamera, createScene, setupEnvironment,
  loadModel, measureBounds, resizeRenderer, setMaxAnisotropy,
  findMeshes, verifyScreenQuad,
} from './scene.js';
import { setupLights } from './lighting.js';
import { createScreen } from './screen.js';
import { createControls } from './controls.js';
import { createInteraction } from './interaction.js';

const canvas = document.getElementById('scene-canvas');
const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderLabel = document.getElementById('loader-label');
const errorEl = document.getElementById('scene-error');
const hintEl = document.getElementById('hint');

export const REDUCED = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

// ------------------------------------------------------------------- UI
function setProgress(pct) {
  if (loaderFill) loaderFill.classList.remove('indeterminate');
  if (loaderFill) loaderFill.style.width = `${pct}%`;
  if (loaderLabel) loaderLabel.textContent = `LOADING ${Math.round(pct)}%`;
}
function setIndeterminateProgress() {
  if (loaderFill) {
    loaderFill.classList.add('indeterminate');
    loaderFill.style.width = '30%';
  }
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
async function boot() {
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

  // Free-look framing: a 3/4 view from the front-right of the desk.
  camera.position.set(...CONFIG.orbit.start.position);
  camera.lookAt(new THREE.Vector3(...CONFIG.orbit.target));

  resizeRenderer(renderer, camera);
  renderer.render(scene, camera);

  const app = {
    renderer, scene, camera, model: null, bounds: null, meshes: null,
    lights: null, screen: null, interaction: null, debug: false,
    markDirty: () => { dirty = true; },
  };
  window.__zally = app;

  let dirty = true;

  window.addEventListener('resize', () => {
    resizeRenderer(renderer, camera);
    if (app.screen) app.screen.resize(window.innerWidth, window.innerHeight);
    if (app.interaction) app.interaction.resize();
    dirty = true;
  });
  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => {
      resizeRenderer(renderer, camera);
      if (app.screen) app.screen.resize(window.innerWidth, window.innerHeight);
      if (app.interaction) app.interaction.resize();
      dirty = true;
    }, 150);
  });

  const manager = new THREE.LoadingManager();
  manager.onError = (url) => console.error('Asset load error:', url);

  setupEnvironment(scene, renderer);

  try {
    const { gltf, report } = await loadModel(manager, (event) => {
      if (event.total > 0) {
        window.__portfolioModelBytes = event.total;
        setProgress(Math.min(90, (event.loaded / event.total) * 90));
      } else setIndeterminateProgress();
    });
    setProgress(90);
    const model = gltf.scene || gltf.scenes[0];
    scene.add(model);
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = CONFIG.shadows.enabled;
      object.receiveShadow = CONFIG.shadows.enabled;
    });

    const bounds = measureBounds(model);
    const lights = setupLights(scene, bounds);

    app.model = model;
    app.bounds = bounds;
    app.meshes = findMeshes(model);
    app.lights = lights;
    lights.lamp.setOn(1);

      // CSS3D monitor screen (real HTML on the display quad).
    const screen = createScreen({ webglScene: scene, camera, onNeedsRender: () => { dirty = true; } });
    app.screen = screen;
    if (screen.hole) {
      screen.hole.castShadow = false;
      screen.hole.receiveShadow = false;
    }
    screen.setActive('home');
    screen.setVisible(true);
    screen.setInteractive(false);

      // Free-look orbit controls.
    app.controls = createControls({
      camera, domElement: canvas, reduced: REDUCED,
      onChange: () => { dirty = true; },
    });

      // Hover / click the computer -> fly to the screen; interactive screen.
    app.interaction = createInteraction({
      canvas, camera, scene, screen, controls: app.controls, lights, meshes: app.meshes,
      reduced: REDUCED, onNeedsRender: () => { dirty = true; },
    });

    console.log(
      `[scene] loaded · ${report.textures} textures` +
      (report.lowRes.length ? ` · low-res: ${report.lowRes.map(t => `${t.mesh}/${t.name} ${t.w}x${t.h}`).join(', ')}` : ''),
    );

    const params = new URLSearchParams(location.search);
    if (params.has('debug')) enableDebugInfo();

    let compileProgress = 90;
    const compileTicker = window.setInterval(() => {
      compileProgress = Math.min(99, compileProgress + 0.35);
      setProgress(compileProgress);
    }, 80);
    try {
      if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
      else renderer.compile(scene, camera);
    } catch (compileError) {
      console.warn('Async shader compilation failed; using synchronous compilation:', compileError);
      renderer.compile(scene, camera);
    } finally {
      window.clearInterval(compileTicker);
    }
    reportLoadMetrics(params.has('debug'));
    setProgress(100);
    fadeLoader();
    dirty = true;
  } catch (err) {
    console.error('Scene load failed:', err);
    if (window.__showPortfolioLoadError) {
      window.__showPortfolioLoadError('The 3D scene could not be loaded. Check your connection and try again.');
    } else {
      showError('The 3D scene could not be loaded. The full portfolio is shown as plain text instead.');
    }
  }

  // Fade the hint out after the first interaction.
  if (hintEl) {
    const hideHint = () => {
      hintEl.classList.add('hidden');
      window.removeEventListener('pointerdown', hideHint);
      window.removeEventListener('wheel', hideHint);
    };
    window.addEventListener('pointerdown', hideHint, { passive: true });
    window.addEventListener('wheel', hideHint, { passive: true });
  }

  // ------------------------------------------------------------ debug
  // D = toggle unlimited free orbit (tuning). V = verify the screen quad.
  let freeOrbit = false;
  let infoOn = false;
  function enableDebugInfo() {
    infoOn = true;
    app.debug = true;
    console.log('[debug] info logging ON — press D for unlimited orbit, V to verify screen quad.');
  }

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'd') {
      freeOrbit = !freeOrbit;
      if (app.controls) app.controls.setFree(freeOrbit);
      console.log(`[debug] unlimited orbit ${freeOrbit ? 'ON' : 'OFF'}.`);
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

    if (app.controls) { if (app.controls.update(now)) dirty = true; }

    if (app.interaction) { if (app.interaction.update(now)) dirty = true; }

    if (app.screen) { if (app.screen.update(now)) dirty = true; }

    if (dirty) {
      renderer.render(scene, camera);
      // CSS camera updated in the SAME frame as the WebGL one, so the DOM
      // stays locked to the canvas during fly-to and resize.
      if (app.screen) app.screen.render();
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

  loop();
}

function reportLoadMetrics(debug) {
  if (!debug) return;
  const allEntries = performance.getEntriesByType('resource');
  const unavailableSizes = allEntries.filter((entry) => entry.transferSize === 0 && entry.decodedBodySize === 0).length;
  const entries = allEntries
    .filter((entry) => entry.transferSize > 0)
    .sort((a, b) => b.transferSize - a.transferSize);
  const modelEntry = entries.find((entry) => new URL(entry.name).pathname.endsWith('/computer_desk-opt.glb'));
  const resourceBytes = entries.reduce((sum, entry) => sum + entry.transferSize, 0);
  const totalBytes = resourceBytes + (!modelEntry ? (window.__portfolioModelBytes || 0) : 0);
  const elapsedMs = performance.now() - window.__portfolioLoadStartedAt;
  const largest = entries.slice(0, 8).map((entry) =>
    `${new URL(entry.name).pathname.split('/').pop() || entry.name}: ${(entry.transferSize / 1024).toFixed(1)} KiB`,
  );
  if (!modelEntry && window.__portfolioModelBytes) {
    largest.push(`computer_desk-opt.glb: ${(window.__portfolioModelBytes / 1024).toFixed(1)} KiB (download size)`);
  }
  console.log(
    `[load] ${(totalBytes / 1024).toFixed(1)} KiB observed transfer · ${(elapsedMs / 1000).toFixed(2)} s` +
    (unavailableSizes ? ` · ${unavailableSizes} request size(s) hidden by cache or cross-origin timing policy` : '') +
    (entries.length ? `\n[load] largest requests: ${largest.join(' · ')}` : '\n[load] request transfer sizes unavailable'),
  );
}

export function start() {
  return new Promise((resolve) => {
    const run = () => boot().then(resolve, (error) => {
      console.error('Startup failed:', error);
      if (window.__showPortfolioLoadError) window.__showPortfolioLoadError('Startup failed. Check your connection and try again.');
      resolve();
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
  });
}

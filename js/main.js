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
import { createScreens } from './screens.js';
import { createCameraPath } from './camera-path.js';

const canvas = document.getElementById('scene-canvas');
const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-fill');
const loaderLabel = document.getElementById('loader-label');
const errorEl = document.getElementById('scene-error');
const dotEls = Array.from(document.querySelectorAll('#dots button'));
const hintEl = document.getElementById('scroll-hint');

let dirty = true;
const markDirty = () => { dirty = true; };

const REDUCED = window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

// Lenis smooth scroll, connected to ScrollTrigger + driven by the gsap ticker.
// Disabled entirely under prefers-reduced-motion.
function setupSmoothScroll() {
  if (REDUCED || !window.Lenis || !window.gsap || !window.ScrollTrigger) return null;
  const lenis = new window.Lenis({ duration: 1.05, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.5 });
  lenis.on('scroll', window.ScrollTrigger.update);
  window.gsap.ticker.add((t) => lenis.raf(t * 1000));
  window.gsap.ticker.lagSmoothing(0);
  return lenis;
}

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
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

function setDotActive(index) {
  dotEls.forEach((d, i) => d.classList.toggle('active', i === index));
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

  const app = { renderer, scene, camera, room: null, bounds: null, screens: null, screensUI: null, path: null, lenis: null, debug: false, pathDebugOn: false, markDirty, onFrame: null };
  let path = null;

  const lenis = setupSmoothScroll();
  app.lenis = lenis;

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    if (total > 0) setProgress((loaded / total) * 100);
  };
  manager.onError = (url) => console.error('Asset load error:', url);

  window.addEventListener('resize', () => {
    resizeRenderer(renderer, camera);
    if (path) path.rebuild();
    if (app.screensUI) app.screensUI.setPortrait(window.innerWidth < CONFIG.mobileWidth);
    markDirty();
  });
  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => {
      resizeRenderer(renderer, camera);
      if (path) path.rebuild();
      if (app.screensUI) app.screensUI.setPortrait(window.innerWidth < CONFIG.mobileWidth);
      markDirty();
    }, 150);
  });

  loadRoom(manager)
    .then(async (gltf) => {
      const room = gltf.scene || gltf.scenes[0];
      scene.add(room);

      const bounds = measureBounds(room);
      addLights(scene, bounds);

      const screens = collectScreens(room);
      app.room = room;
      app.bounds = bounds;
      app.screens = screens;

      // Wait for the monospace font so the canvas text is crisp on first draw.
      try { await document.fonts.ready; } catch { /* draw anyway */ }

      const screensUI = createScreens({
        renderer,
        stops: CONFIG.stops,
        screens,
        onNeedsRender: markDirty,
      });
      screensUI.drawAll();
      app.screensUI = screensUI;
      if (CONFIG.stops[0]) screensUI.setActive(CONFIG.stops[0].id);

      // Scrubbed, spline-based, damped camera path through the four stops.
      path = createCameraPath({
        scene,
        camera,
        lenis,
        reduced: REDUCED,
        onNeedsRender: markDirty,
        onStop: (index, stop) => {
          setDotActive(index);
          screensUI.setActive(stop.id);
        },
      });
      app.path = path;
      app.onFrame = (now, dt) => {
        let active = path.update(now, dt);
        if (screensUI.update(now)) active = true;
        return active;
      };

      // Dots: click = smooth scroll to that stop.
      dotEls.forEach((dot) => {
        dot.addEventListener('click', () => path.scrollToStop(Number(dot.dataset.stop)));
      });

      // In-scene links: hover for a pointer cursor, click to open.
      const hitAt = (e) => screensUI.pick(e.clientX, e.clientY, camera, canvas);
      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        canvas.style.cursor = hitAt(e) ? 'pointer' : 'default';
      });
      canvas.addEventListener('pointerleave', () => { canvas.style.cursor = 'default'; });
      canvas.addEventListener('click', (e) => {
        const hit = hitAt(e);
        if (!hit) return;
        const a = document.createElement('a');
        a.href = hit.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
      });

      setProgress(100);
      fadeLoader();
      setDotActive(0);
      markDirty();

      // Debug helpers: ?debug exposes the app + path overlay, ?stop=N jumps.
      const params = new URLSearchParams(location.search);
      if (params.has('debug')) {
        app.debug = true;
        app.pathDebugOn = true;
        path.setDebug(true);
      }
      if (params.has('stop')) {
        const i = Math.max(0, Math.min(CONFIG.stops.length - 1, parseInt(params.get('stop'), 10) || 0));
        window.requestAnimationFrame(() => path.scrollToStop(i));
      }
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

  // ---------------------------------------------------------- debug controls
  // D  = toggle path debug (splines, waypoint spheres, progress HUD)
  // O  = toggle OrbitControls (free-look tuning)
  let orbit = null;
  window.addEventListener('keydown', async (e) => {
    const key = e.key.toLowerCase();

    if (key === 'd') {
      app.debug = true;
      app.pathDebugOn = !app.pathDebugOn;
      if (path) path.setDebug(app.pathDebugOn);
      console.log(`[debug] path overlay ${app.pathDebugOn ? 'ON' : 'OFF'} · perf logging ON`);
      markDirty();
      return;
    }

    if (key === 'o') {
      if (!orbit) {
        const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
        orbit = new OrbitControls(camera, canvas);
        orbit.enableDamping = true;
        orbit.addEventListener('change', markDirty);
        console.log('[debug] OrbitControls enabled — drag to orbit, press O again to stop.');
        markDirty();
      } else {
        orbit.dispose();
        orbit = null;
        console.log('[debug] OrbitControls disabled.');
        markDirty();
      }
    }
  });

  // ------------------------------------------------------------ render loop
  // Stays "active" (rendering every frame) while the damped camera is still
  // converging, while scrolling, or while a screen is typing; otherwise it
  // goes idle and only re-renders on demand.
  let last = performance.now();
  let perfFrames = 0;
  let perfRenders = 0;
  let perfLast = performance.now();

  function loop() {
    requestAnimationFrame(loop);
    if (document.hidden) { last = performance.now(); return; }

    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    let active = false;
    if (app.onFrame) active = app.onFrame(now, dt);
    if (orbit) { orbit.update(); active = true; }

    perfFrames++;
    if (dirty || active) {
      renderer.render(scene, camera);
      dirty = false;
      perfRenders++;
    }

    if (app.debug && now - perfLast >= 1000) {
      const fps = Math.round((perfFrames * 1000) / (now - perfLast));
      console.log(`[perf] ${fps} fps · ${perfRenders} renders/s · calls ${renderer.info.render.calls} · ${active ? 'active' : 'idle'}`);
      perfFrames = 0;
      perfRenders = 0;
      perfLast = now;
    }
  }

  // Start at the top on (re)load.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  window.__zally = app; // always available for the keyboard debug shortcut
  loop();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

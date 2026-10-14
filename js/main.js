import * as THREE from 'three';
import { CONFIG, FEATURES, QUALITY } from './config.js';
import {
  createRenderer, createCamera, createScene, setupEnvironment,
  loadModel, measureBounds, resizeRenderer, setMaxAnisotropy,
  findMeshes, verifyScreenQuad, makeSurfaceDetailTexture,
} from './scene.js';
import { setupLights } from './lighting.js';
import { createScreen } from './screen.js';
import { createControls } from './controls.js';
import { createInteraction } from './interaction.js';
import { createPostProcessing } from './postprocessing.js';
import { createAudioController } from './audio.js';

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
  const audioButton = document.getElementById('audio-toggle');
  if (audioButton) audioButton.hidden = true;
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

function createChairMotion(scene, chair, reduced) {
  if (!chair || !FEATURES.chairSway || reduced) return null;
  chair.updateWorldMatrix(true, false);
  const box = new THREE.Box3().setFromObject(chair);
  const pivot = new THREE.Group();
  pivot.name = 'chair-sway-pivot';
  pivot.position.copy(box.getCenter(new THREE.Vector3()));
  scene.add(pivot);
  pivot.attach(chair);
  return {
    update(now) {
      pivot.rotation.y = Math.sin(now * 0.001 * CONFIG.idle.chairSwaySpeed) *
        THREE.MathUtils.degToRad(CONFIG.idle.chairSwayDeg);
      return true;
    },
  };
}

function createCoffeeEffect(scene, cup, camera) {
  const cfg = CONFIG.coffee;
  if (!cfg?.enabled || !cup) return null;

  cup.updateWorldMatrix(true, false);
  cup.geometry.computeBoundingBox();
  const rimLocal = new THREE.Vector3(
    cfg.openingCenter[0],
    cup.geometry.boundingBox.max.y,
    cfg.openingCenter[2],
  );
  const rim = cup.localToWorld(rimLocal.clone());
  const surfaceY = rim.y - cfg.surfaceInset;

  const coffeeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWarm: { value: new THREE.Color(cfg.color) },
      uDark: { value: new THREE.Color(cfg.darkColor) },
      uCrema: { value: new THREE.Color(cfg.cremaColor) },
      uCream: { value: new THREE.Color(cfg.creamColor) },
      uHighlight: { value: new THREE.Color(cfg.highlightColor) },
      uTextureStrength: { value: cfg.textureStrength },
      uHeartScale: { value: cfg.heartScale },
      uEtchStrength: { value: cfg.artGrooveStrength },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uTextureStrength;
      uniform vec3 uWarm;
      uniform vec3 uDark;
      uniform vec3 uCrema;
      uniform vec3 uCream;
      uniform vec3 uHighlight;
      uniform float uHeartScale;
      uniform float uEtchStrength;
      varying vec2 vUv;

      float hash(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.5);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float n = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          n += a * noise(p);
          p = p * 2.0 + vec2(13.7, 8.2);
          a *= 0.5;
        }
        return n;
      }
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float angle = atan(p.y, p.x);
        float t = uTime * 0.12;

        // Slow, uneven marbling gives the dark liquid a subtle roasted-coffee texture.
        vec2 warped = p * 5.5 + vec2(fbm(p * 4.0 + t), fbm(p * 4.0 - t)) * 1.8;
        float grain = fbm(warped + vec2(cos(angle + r * 11.0 - t), sin(angle + r * 11.0 - t)) * 0.22);
        float swirl = sin(angle * 2.0 + r * 21.0 - t * 1.4) * 0.5 + 0.5;
        float shade = clamp(0.34 + grain * 0.5 + (swirl - 0.5) * uTextureStrength, 0.0, 1.0);
        vec3 color = mix(uDark, uWarm, shade);

        // A broken, very thin crema ring sits just inside the cup's edge.
        float edgeNoise = noise(vec2(angle * 7.0, t * 0.25)) * 0.025;
        float cremaBand = smoothstep(0.80, 0.88, r + edgeNoise) *
                          (1.0 - smoothstep(0.96, 1.0, r + edgeNoise));
        float cremaVariation = 0.12 + grain * 0.22 + max(0.0, swirl - 0.58) * 0.12;
        color = mix(color, uCrema, cremaBand * cremaVariation);

        // Ivory microfoam forms a soft heart with a fine caramel-colored edge.
        vec2 heart = vec2(p.x / uHeartScale, (p.y + 0.015) / uHeartScale);
        float heartBase = dot(heart, heart) - 1.0;
        float heartValue = heartBase * heartBase * heartBase - heart.x * heart.x * heart.y * heart.y * heart.y;
        vec2 outerHeart = heart / 1.075;
        float outerBase = dot(outerHeart, outerHeart) - 1.0;
        float outerValue = outerBase * outerBase * outerBase - outerHeart.x * outerHeart.x * outerHeart.y * outerHeart.y * outerHeart.y;
        float heartMask = 1.0 - smoothstep(-0.035, 0.035, heartValue);
        float outerMask = 1.0 - smoothstep(-0.035, 0.035, outerValue);
        float heartEdge = max(0.0, outerMask - heartMask);
        float foamGrain = noise(heart * 38.0 + vec2(t * 0.12, 0.0));
        color = mix(color, uCrema, heartEdge * 0.78);
        color = mix(color, mix(uCream, uHighlight, foamGrain * 0.09), heartMask * 0.96);
        float stem = exp(-pow(heart.x * 30.0, 2.0)) *
                     smoothstep(-0.82, -0.58, heart.y) * (1.0 - smoothstep(0.4, 0.58, heart.y));
        float etching = stem * heartMask * uEtchStrength;
        color = mix(color, uCrema, etching * 0.32);

        // Soft elongated reflection with a faint ripple response.
        vec2 reflection = vec2(p.x * 0.78 + p.y * 0.63, -p.x * 0.63 + p.y * 0.78);
        float streak = exp(-pow((reflection.x + 0.16) / 0.52, 2.0) - pow((reflection.y - 0.28) / 0.075, 2.0));
        float ripple = 0.5 + 0.5 * sin(r * 58.0 - t * 4.0 + grain * 2.5);
        float sheen = streak * (0.12 + ripple * 0.08) + pow(max(0.0, grain - 0.72), 3.0) * 0.12;
        color = mix(color, uHighlight, clamp(sheen, 0.0, 0.24));

        float mask = 1.0 - smoothstep(0.985, 1.0, r);
        gl_FragColor = vec4(color, mask);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(cfg.surfaceRadius, 64), coffeeMaterial);
  coffee.name = 'coffee-surface';
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.set(rim.x, surfaceY, rim.z);
  coffee.castShadow = false;
  coffee.receiveShadow = false;
  scene.add(coffee);

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
  const fragmentShader = `
    uniform float uTime;
    uniform float uSeed;
    uniform float uOpacity;
    uniform vec3 uColor;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float n = 0.0;
      float a = 0.5;
      for (int i = 0; i < 4; i++) {
        n += a * noise(p);
        p = p * 2.03 + vec2(17.1, 9.2);
        a *= 0.5;
      }
      return n;
    }
    void main() {
      vec2 p = vUv;
      float t = uTime * 0.24;
      vec2 warp = vec2(
        fbm(p * vec2(3.0, 5.0) + vec2(t, uSeed)),
        fbm(p * vec2(3.0, 5.0) + vec2(6.7, -t * 0.8 + uSeed))
      );
      float n = fbm(p * vec2(5.0, 8.0) + warp * 2.4 + vec2(-t * 0.7, uSeed));
      float drift = (n - 0.48) * 0.19 + sin(p.y * 8.0 + uTime * 0.72 + uSeed) * 0.055;
      float center = 0.5 + drift * smoothstep(0.0, 0.8, p.y);
      float width = mix(0.075, 0.34, p.y);
      float across = abs(p.x - center) / width;
      float softShape = exp(-across * across * 2.4);
      float billows = smoothstep(0.16, 0.73, n + (1.0 - across) * 0.17);
      float verticalFade = smoothstep(0.0, 0.15, p.y) * (1.0 - smoothstep(0.78, 1.0, p.y));
      float alpha = softShape * billows * verticalFade * uOpacity;
      if (alpha < 0.004) discard;
      gl_FragColor = vec4(uColor, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;
  const wisps = [];
  for (let i = 0; i < 3; i++) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: i * 4.17 },
        uOpacity: { value: 0 },
        uColor: { value: new THREE.Color(cfg.steamColor) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const wisp = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    wisp.name = `coffee-steam-${i + 1}`;
    wisp.scale.set(0.075, cfg.steamHeight, 1);
    wisp.renderOrder = 1;
    scene.add(wisp);
    wisps.push({ sprite: wisp, phase: i / 3, offset: (i - 1) * 0.009 });
  }

  let lastUpdate = -Infinity;
  return {
    update(now) {
      if (now - lastUpdate < 32) return false;
      lastUpdate = now;
      const seconds = now / 1000;
      coffeeMaterial.uniforms.uTime.value = seconds * cfg.swirlSpeed;
      for (const { sprite, phase: phaseOffset, offset } of wisps) {
        const phase = (seconds * cfg.steamSpeed + phaseOffset) % 1;
        const drift = phase * phase;
        sprite.position.set(
          rim.x + offset + Math.sin(seconds * 1.1 + phaseOffset * 8) * 0.009 * (1 + drift),
          surfaceY + 0.008 + phase * cfg.steamHeight * 0.7,
          rim.z + Math.cos(seconds * 0.9 + phaseOffset * 7) * 0.007 * (1 + drift),
        );
        sprite.quaternion.copy(camera.quaternion);
        sprite.material.uniforms.uTime.value = seconds + phaseOffset * 2.0;
        sprite.material.uniforms.uOpacity.value = Math.sin(Math.PI * phase) * cfg.steamOpacity;
      }
      return true;
    },
  };
}

// ------------------------------------------------------------------- boot
async function boot() {
  if (!canvas) return;

  const weakDevice = (navigator.deviceMemory || 8) <= 1;
  if (QUALITY.mode === 'auto' && ((navigator.deviceMemory || 8) <= 2 || (navigator.hardwareConcurrency || 8) <= 2)) {
    QUALITY.deviceTier = 'low';
  }
  if (weakDevice && FEATURES.lightweightFallback) {
    showError('This device is using the lightweight portfolio view instead of the 3D scene.');
    return;
  }
  const audio = createAudioController();

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
  const postProcessing = createPostProcessing(renderer, scene, camera);

  // Free-look framing: a 3/4 view from the front-right of the desk.
  camera.position.set(...CONFIG.orbit.start.position);
  camera.lookAt(new THREE.Vector3(...CONFIG.orbit.target));

  resizeRenderer(renderer, camera);
  if (postProcessing) postProcessing.resize(window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);

  const app = {
    renderer, scene, camera, model: null, bounds: null, meshes: null,
    lights: null, screen: null, interaction: null, postProcessing, chairMotion: null, debug: false,
    markDirty: () => { dirty = true; },
  };
  window.__zally = app;

  let dirty = true;

  window.addEventListener('resize', () => {
    resizeRenderer(renderer, camera);
    if (app.screen) app.screen.resize(window.innerWidth, window.innerHeight);
    if (app.postProcessing) app.postProcessing.resize(window.innerWidth, window.innerHeight);
    if (app.interaction) app.interaction.resize();
    dirty = true;
  });
  window.addEventListener('orientationchange', () => {
    window.setTimeout(() => {
      resizeRenderer(renderer, camera);
      if (app.screen) app.screen.resize(window.innerWidth, window.innerHeight);
      if (app.postProcessing) app.postProcessing.resize(window.innerWidth, window.innerHeight);
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
    const fabricDetail = makeSurfaceDetailTexture(96);
    fabricDetail.wrapS = fabricDetail.wrapT = THREE.RepeatWrapping;
    fabricDetail.repeat.set(3, 5);
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = CONFIG.shadows.enabled;
      object.receiveShadow = CONFIG.shadows.enabled;
      if (/^Chair_Chair_/i.test(object.name)) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!material || !('roughness' in material)) continue;
          material.roughness = Math.max(material.roughness || 0, 0.86);
          material.bumpMap = fabricDetail;
          material.bumpScale = 0.003;
          material.needsUpdate = true;
        }
      }
    });

    const bounds = measureBounds(model);
    const lights = setupLights(scene, bounds);

    app.model = model;
    app.bounds = bounds;
    app.meshes = findMeshes(model);
    app.chairMotion = createChairMotion(scene, app.meshes.get('Chair_Chair_0'), REDUCED);
    app.coffee = createCoffeeEffect(scene, app.meshes.get(CONFIG.coffee.cupMesh), camera);
    app.lights = lights;
    lights.lamp.setOn(1);

      // CSS3D monitor screen (real HTML on the display quad).
    const screen = createScreen({ webglScene: scene, camera, onNeedsRender: () => { dirty = true; } });
    app.screen = screen;
    screen.element?.addEventListener('click', (event) => {
      if (event.target.closest('button, a')) audio.play('click');
    });
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
      reduced: REDUCED, audio, onNeedsRender: () => { dirty = true; },
    });

    console.log(
      `[scene] loaded · ${report.textures} textures` +
      (report.lowRes.length ? ` · low-res: ${report.lowRes.map(t => `${t.mesh}/${t.name} ${t.w}x${t.h}`).join(', ')}` : ''),
    );

    const params = new URLSearchParams(location.search);
    if (params.has('debug')) {
      enableDebugInfo();
    }

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
  let frames = 0;
  let perfLast = performance.now();
  let lowFpsDuration = 0;
  let qualityStep = 0;
  let rafId = 0;

  function scheduleLoop() {
    if (!document.hidden && !rafId) rafId = requestAnimationFrame(loop);
  }
  function loop() {
    rafId = 0;
    if (document.hidden) return;

    const now = performance.now();
    if (app.controls) { if (app.controls.update(now)) dirty = true; }

    if (app.interaction) { if (app.interaction.update(now)) dirty = true; }

    if (app.screen) { if (app.screen.update(now)) dirty = true; }

    if (app.chairMotion?.update(now)) dirty = true;
    if (app.coffee?.update(now)) dirty = true;
    if (dirty) {
      if (app.postProcessing) app.postProcessing.render(now);
      else renderer.render(scene, camera);
      // CSS camera updated in the SAME frame as the WebGL one, so the DOM
      // stays locked to the canvas during fly-to and resize.
      if (app.screen) app.screen.render();
      dirty = false;
      frames++;
    }

    const sampleDuration = now - perfLast;
    if (sampleDuration >= 1000) {
      const fps = (frames * 1000) / sampleDuration;
      if (infoOn) {
        const i = renderer.info;
        console.log(`[perf] ${Math.round(fps)} fps · draw calls ${i.render.calls} · rendered tris ${i.render.triangles} · tex ${i.memory.textures} · geo ${i.memory.geometries}`);
      }
      if (FEATURES.adaptiveQuality && QUALITY.mode === 'auto' && qualityStep < 3) {
        lowFpsDuration = fps < QUALITY.adaptiveTargetFps ? lowFpsDuration + sampleDuration : 0;
        if (lowFpsDuration >= 3000) {
          qualityStep++;
          lowFpsDuration = 0;
          if (qualityStep === 1) {
            renderer.shadowMap.enabled = false;
            if (app.lights?.lamp?.spot) app.lights.lamp.spot.castShadow = false;
            if (app.lights?.key) app.lights.key.castShadow = false;
            if (app.lights?.grounding) app.lights.grounding.castShadow = false;
          } else if (qualityStep === 2 && app.postProcessing) {
            app.postProcessing.setEnabled(false);
          } else if (qualityStep === 3) {
            renderer.setPixelRatio(Math.max(0.7, renderer.getPixelRatio() * 0.75));
            renderer.setSize(window.innerWidth, window.innerHeight, false);
          }
          dirty = true;
          console.info(`[quality] reduced graphics quality to step ${qualityStep}`);
        }
      }
      frames = 0;
      perfLast = now;
    }
    scheduleLoop();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    } else {
      dirty = true;
      scheduleLoop();
    }
  });
  scheduleLoop();
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

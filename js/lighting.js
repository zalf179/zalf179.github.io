import * as THREE from 'three';
import { SpotLightHelper } from 'three/addons/helpers/SpotLightHelper.js';
import { CONFIG } from './config.js';

// ---------------------------------------------------------------------------
// Lighting rig. The glb ships with no lights, so we build the whole mood:
// soft IBL fill + warm key + cool screen spill + a warm desk-lamp spot and
// one soft grounding light, with baked contact shadows as a low-cost fill.
// ---------------------------------------------------------------------------
export function setupLights(scene, bounds) {
  const L = CONFIG.lights;
  const centre = bounds ? bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3();

  const hemi = new THREE.HemisphereLight(L.hemi.sky, L.hemi.ground, L.hemi.intensity);
  hemi.position.set(0, 3, 0);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(L.key.color, L.key.intensity);
  key.position.set(...L.key.position);
  key.target.position.copy(centre);
  scene.add(key, key.target);
  const grounding = new THREE.DirectionalLight(CONFIG.shadows.groundingColor, CONFIG.shadows.groundingIntensity);
  grounding.position.set(centre.x - 2.2, centre.y + 3.8, centre.z + 2.6);
  grounding.target.position.copy(centre);
  scene.add(grounding, grounding.target);
  if (CONFIG.shadows.enabled) {
    grounding.castShadow = true;
    grounding.shadow.mapSize.set(CONFIG.shadows.groundingMapSize, CONFIG.shadows.groundingMapSize);
    const size = bounds ? bounds.getSize(new THREE.Vector3()) : new THREE.Vector3(2, 1.5, 2);
    const radius = size.length() * 0.5 + 0.25;
    Object.assign(grounding.shadow.camera, {
      near: 0.1, far: 10,
      left: -radius, right: radius, top: radius, bottom: -radius,
    });
    grounding.shadow.bias = CONFIG.shadows.bias;
    grounding.shadow.normalBias = CONFIG.shadows.normalBias;
    grounding.shadow.radius = CONFIG.shadows.radius;
    grounding.shadow.camera.updateProjectionMatrix();
  }

  const fill = new THREE.DirectionalLight(L.fill.color, L.fill.intensity);
  fill.position.set(...L.fill.position);
  scene.add(fill);

  // Cool rim from behind/above the chair — reads the silhouette edges.
  const rim = new THREE.DirectionalLight(L.rim.color, L.rim.intensity);
  rim.position.set(...L.rim.position);
  rim.target.position.set(...L.rim.target);
  scene.add(rim, rim.target);

  // Cool light bleeding off the monitor onto the desk/keyboard.
  const s = CONFIG.screen;
  const screenSpill = new THREE.PointLight(L.screenSpill.color, L.screenSpill.intensity, L.screenSpill.distance, 2);
  screenSpill.position.set(s.center[0] + s.normal[0] * 0.25, s.center[1] - 0.18, s.center[2] + s.normal[2] * 0.25);
  scene.add(screenSpill);

  // Warm desk lamp.
  const lamp = createLamp(scene);
  const previousBeforeRender = scene.onBeforeRender;
  scene.onBeforeRender = function (...args) {
    if (previousBeforeRender) previousBeforeRender.apply(this, args);
    lamp.update(performance.now() / 1000);
  };

  // Baked contact shadows.
  const contact = createContactShadows(scene, bounds);

  return { hemi, key, grounding, fill, rim, screenSpill, lamp, contact, centre };
}

// Derive the shade opening from the upper lamp-head vertices in world space.
function findLampOpening(scene) {
  const mesh = scene.getObjectByName('DeskLamp_DeskLamp_0');
  const positions = mesh && mesh.geometry && mesh.geometry.attributes.position;
  if (!positions) return null;

  mesh.updateWorldMatrix(true, false);
  const points = [];
  const point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
    if (point.y > 1.28) points.push(point.clone());
  }
  if (points.length < 3) return null;

  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const span = maxY - minY;
  if (span < 0.01) return null;

  const openingBand = minY + Math.max(0.008, span * 0.1);
  const upperBand = minY + span * 0.55;
  const opening = new THREE.Vector3();
  const upper = new THREE.Vector3();
  let openingCount = 0;
  let upperCount = 0;
  for (const p of points) {
    if (p.y <= openingBand) { opening.add(p); openingCount++; }
    if (p.y >= upperBand) { upper.add(p); upperCount++; }
  }
  if (!openingCount || !upperCount) return null;
  opening.multiplyScalar(1 / openingCount);
  upper.multiplyScalar(1 / upperCount);
  const center = opening.clone();
  const axis = opening.sub(upper);
  if (axis.lengthSq() < 1e-6) return null;
  if (axis.y > 0) axis.negate();
  axis.normalize();
  return { center, axis };
}

// Desk lamp: a geometry-aligned shadow spotlight and a tiny, depth-tested
// glow at the shade opening. `setOn` remains the eased master level.
export function createLamp(scene) {
  const P = CONFIG.lamp;
  const detected = findLampOpening(scene);
  const fallbackEmitter = new THREE.Vector3(...P.fallbackEmitter);
  const fallbackAim = new THREE.Vector3(...P.fallbackAim);
  const emitter = (detected ? detected.center : fallbackEmitter).add(new THREE.Vector3(...P.emitter));
  const axis = detected
    ? detected.axis
    : fallbackAim.sub(fallbackEmitter).normalize();
  const aim = emitter.clone()
    .addScaledVector(axis, P.distance * 0.72)
    .add(new THREE.Vector3(...P.aim));

  const group = new THREE.Group();
  group.name = 'lamp-rig';
  scene.add(group);

  const spot = new THREE.SpotLight(P.color, 0, P.distance, P.angle, P.penumbra, P.decay);
  spot.name = 'lamp-spot';
  spot.castShadow = CONFIG.shadows.enabled;
  spot.position.copy(emitter);
  spot.target.position.copy(aim);
  group.add(spot, spot.target);
  if (CONFIG.shadows.enabled) {
    spot.shadow.mapSize.set(CONFIG.shadows.mapSize, CONFIG.shadows.mapSize);
    spot.shadow.bias = CONFIG.shadows.bias;
    spot.shadow.normalBias = CONFIG.shadows.normalBias;
    spot.shadow.radius = CONFIG.shadows.radius;
    spot.shadow.camera.near = 0.03;
    spot.shadow.camera.far = P.distance;
    spot.shadow.camera.fov = THREE.MathUtils.radToDeg(P.angle * 2);
    spot.shadow.camera.updateProjectionMatrix();
  }

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    color: P.glowColor,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    opacity: 0,
  }));
  glow.name = 'lamp-opening-glow';
  glow.scale.setScalar(P.glowSize);
  glow.position.copy(emitter).addScaledVector(axis, 0.008);
  scene.add(glow);

  const target = { spot: P.intensity, glow: P.glowOpacity };
  let level = 0;
  let flickerScale = 1;
  const applyIntensity = () => {
    const k = level * flickerScale;
    spot.intensity = target.spot * k;
    glow.material.opacity = Math.max(0, Math.min(1, target.glow * k));
  };

  let spotHelper = null;
  let axisHelper = null;
  if (new URLSearchParams(location.search).has('debug')) {
    spotHelper = new SpotLightHelper(spot, P.glowColor);
    axisHelper = new THREE.ArrowHelper(axis.clone(), emitter.clone(), 0.45, P.glowColor);
    scene.add(spotHelper, axisHelper);
    spotHelper.update();
    console.log(
      `[lamp] opening ${emitter.toArray().map((v) => v.toFixed(3)).join(', ')}` +
      ` · axis ${axis.toArray().map((v) => v.toFixed(3)).join(', ')}` +
      (detected ? '' : ' · using configured fallback'),
    );
  }

  return {
    group, spot, glow, emitter, axis, aim, spotHelper, axisHelper,
    // on: 0..1 master intensity multiplier (used by the scroll story).
    setOn(v) {
      level = Math.max(0, Math.min(1, v));
      applyIntensity();
    },
    update(t) {
      // Faint flicker is shared by the pool and the visible bulb glow.
      const f = P.flicker;
      const n = Math.sin(t * 11.0) * 0.5 + Math.sin(t * 23.7 + 1.3) * 0.5;
      flickerScale = 1 + n * f;
      applyIntensity();
      if (spotHelper) spotHelper.update();
    },
  };
}

function makeGlowTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,240,210,0.55)');
  g.addColorStop(1.0, 'rgba(255,220,170,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Baked contact shadows: soft radial-gradient blobs under the desk and chair.
// ---------------------------------------------------------------------------
function createContactShadows(scene, bounds) {
  const y = CONFIG.environment.contactShadow.y;
  const opacity = CONFIG.environment.contactShadow.opacity;
  const tex = makeShadowTexture();

  const group = new THREE.Group();
  group.name = 'contact-shadows';

  const add = (w, h, cx, cz) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: tex, color: 0x000000, transparent: true, opacity,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, y, cz);
    mesh.renderOrder = -1;
    group.add(mesh);
  };

  add(2.6, 1.5, -0.02, 0.16);  // desk
  add(1.6, 1.5, 0.0, 0.72);    // chair
  scene.add(group);
  return group;
}

function makeShadowTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

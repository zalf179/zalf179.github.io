import * as THREE from 'three';
import { CONFIG } from './config.js';

// ---------------------------------------------------------------------------
// Lighting rig. The glb ships with no lights, so we build the whole mood:
// soft IBL fill + warm key + cool screen spill + a warm desk-lamp spot, plus
// baked contact-shadow blobs on the floor (cheap, no real-time shadow maps).
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
  if (CONFIG.renderer.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(CONFIG.renderer.shadowMapSize, CONFIG.renderer.shadowMapSize);
    const b = L.shadowBounds;
    Object.assign(key.shadow.camera, { near: 0.1, far: 12, left: -b, right: b, top: b, bottom: -b });
    key.shadow.bias = -0.0006;
    key.shadow.camera.updateProjectionMatrix();
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

  // Baked contact shadows.
  const contact = createContactShadows(scene, bounds);

  return { hemi, key, fill, rim, screenSpill, lamp, contact, centre };}

// ---------------------------------------------------------------------------
// Desk lamp: warm spot + a soft additive glow sprite at the head. Returned so
// the idle loop can flicker it and the scroll story can fade it on/off.
// ---------------------------------------------------------------------------
export function createLamp(scene) {
  const P = CONFIG.lamp;

  const group = new THREE.Group();
  group.name = 'lamp-rig';
  group.position.set(...P.light);
  scene.add(group);

  const spot = new THREE.SpotLight(P.color, 0, P.distance, 0.72, 0.55, P.decay);
  spot.name = 'lamp-spot';
  spot.position.set(0, 0, 0);
  spot.target.position.set(P.target[0] - P.light[0], P.target[1] - P.light[1], P.target[2] - P.light[2]);
  group.add(spot, spot.target);

  // Small point light fills the shade interior so the head reads as "on".
  const bulb = new THREE.PointLight(0xffe0b0, 0, 0.9, 2);
  group.add(bulb);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    color: P.glowColor,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
  }));
  glow.name = 'lamp-glow';
  glow.scale.setScalar(P.glowSize);
  glow.position.set(0, -0.02, 0);
  group.add(glow);

  const target = { spot: P.intensity, bulb: P.intensity * 0.32, glow: 0.55 };

  return {
    group, spot, bulb, glow,
    // on: 0..1 master intensity multiplier (used by the scroll story).
    setOn(v) {
      const k = Math.max(0, Math.min(1, v));
      spot.intensity = target.spot * k;
      bulb.intensity = target.bulb * k;
      glow.material.opacity = target.glow * k;
    },
    update(t) {
      // Faint flicker around the current "on" level.
      const f = P.flicker;
      const n = Math.sin(t * 11.0) * 0.5 + Math.sin(t * 23.7 + 1.3) * 0.5;
      const scale = 1 + n * f;
      spot.intensity = target.spot * scale;
      bulb.intensity = target.bulb * scale;
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

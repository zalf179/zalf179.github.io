import * as THREE from 'three';
import { CONFIG } from './config.js';

// ===========================================================================
// Interaction + state machine + camera transition.
//
//   IDLE_ORBIT -> FLYING_IN -> SCREEN_ACTIVE -> FLYING_OUT -> IDLE_ORBIT
//
//  * IDLE_ORBIT: freely orbit; raycast the monitor for hover (cursor + glow);
//    a click/tap on the computer flies the camera to the screen.
//  * FLYING_IN / FLYING_OUT: ONE eased progress value drives position, rotation
//    and fov together — no independent tweens. Position is a quadratic Bezier,
//    rotation is a quaternion slerp (never a lerped lookAt point), and fov eases
//    with a small pull-back at mid-travel. OrbitControls is disabled and its
//    damping ignored for the whole flight; Esc reverses mid-flight.
//  * SCREEN_ACTIVE: the CSS3D screen is interactive; Esc / outside click /
//    in-screen power button / the BACK button all fly back out.
// ===========================================================================
export const STATES = ['IDLE_ORBIT', 'FLYING_IN', 'SCREEN_ACTIVE', 'FLYING_OUT'];

const DEG = Math.PI / 180;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const DESK_CLEARANCE_Y = 0.98;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smoothish = (a, b, x) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

export function createInteraction({ canvas, camera, scene, screen, controls, lights, meshes, reduced, onNeedsRender }) {
  const S = CONFIG.screen;
  const F = CONFIG.flyTo;
  const debugMode = new URLSearchParams(location.search).has('debug');

  const center = new THREE.Vector3(...S.center);
  const normal = new THREE.Vector3(...S.normal).normalize();
  const up = new THREE.Vector3(...S.up).normalize();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const targets = [];
  for (const name of ['Monitor_Monitor_0', 'Keyboard_Keyboard_0', 'Computer_Computer_0']) {
    const m = meshes.get(name);
    if (m) targets.push(m);
  }
  if (screen.hole) targets.push(screen.hole);

  const monitor = meshes.get('Monitor_Monitor_0') || null;
  const emissiveMats = [];
  if (monitor) {
    const mats = Array.isArray(monitor.material) ? monitor.material : [monitor.material];
    for (const m of mats) {
      if (m && 'emissiveIntensity' in m) {
        emissiveMats.push({ m, base: m.emissiveIntensity || 0 });
      }
    }
  }
  const spillBase = lights && lights.screenSpill ? lights.screenSpill.intensity : 0;

  const backBtn = document.getElementById('back-btn');
  const hintEl = document.getElementById('hint');

  let state = 'IDLE_ORBIT';
  let hoverTarget = 0;
  let hover = 0;
  let down = null;
  let downHit = false;
  let prevBack = false;

  // ---- camera / target poses --------------------------------------------
  const _lookMat = new THREE.Matrix4();
  function lookQuat(eye, target) {
    return new THREE.Quaternion().setFromRotationMatrix(_lookMat.lookAt(eye, target, WORLD_UP));
  }

  function focusPose() {
    const aspect = camera.aspect || 1;
    const fov = F.fov;
    const tanHalf = Math.tan(fov * DEG / 2);
    const fill = F.screenFill;
    const dH = S.height / (2 * fill * tanHalf);
    const dW = S.width / (2 * fill * aspect * tanHalf);
    const d = Math.max(dH, dW);
    const pos = center.clone().addScaledVector(normal, d);
    const look = center.clone();
    return { pos, look, quat: lookQuat(pos, look), fov };
  }

  function currentPose() {
    return { pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov };
  }

  function defaultOrbit() {
    return {
      position: new THREE.Vector3(...CONFIG.orbit.start.position),
      target: new THREE.Vector3(...CONFIG.orbit.target),
      fov: CONFIG.camera.fov,
    };
  }

  let savedOrbit = null;

  function pathControlPoint(P0, P2) {
    const P1 = new THREE.Vector3()
      .addVectors(P0, P2).multiplyScalar(0.5)
      .addScaledVector(normal, -F.arcPullBack)
      .addScaledVector(WORLD_UP, F.arcLift);

    // Lift the curve as needed to stay above the desk, without clamping the
    // camera itself (which would move it discontinuously at the flight start).
    for (let i = 1; i < 100; i++) {
      const t = i / 100;
      const u = 1 - t;
      const weight = 2 * u * t;
      const y = u * u * P0.y + weight * P1.y + t * t * P2.y;
      if (y < DESK_CLEARANCE_Y) P1.y += (DESK_CLEARANCE_Y - y) / weight;
    }
    return P1;
  }

  // ---- flight -----------------------------------------------------------
  // One object, one progress value. `dir` +1 = fly in, -1 = fly out.
  let flight = null;

  function beginFlight(dir, fromPose, toPose, duration) {
    const P0 = fromPose.pos.clone();
    const P2 = toPose.pos.clone();
    // Bezier control point pulled slightly back from the screen and lifted
    // above the desk, so the path bows "pullback" and never clips the desk.
    const P1 = pathControlPoint(P0, P2);
    flight = {
      dir,
      startT: performance.now(),
    dur: duration,
      P0, P1, P2,
      q0: fromPose.quat.clone(),
      q1: toPose.quat.clone(),
      f0: fromPose.fov,
      f1: toPose.fov,
    };
    onNeedsRender && onNeedsRender();
  }

  function bezierPos(t) {
    const { P0, P1, P2 } = flight;
    const u = 1 - t;
    const p = new THREE.Vector3()
      .addScaledVector(P0, u * u)
      .addScaledVector(P1, 2 * u * t)
      .addScaledVector(P2, t * t);
    return p;
  }

  function applyTuning(dir, t) {
    const s = easeInOutCubic(t);
    // Screen brightness ramps 0.65 -> 1 only near arrival; keep full at idle.
    if (screen && screen.setBrightness) {
      screen.setBrightness(dir > 0 ? 0.65 + 0.35 * smoothish(0.65, 1, t) : 1);
    }
    // Screen spill + desk lamp gently follow the travel.
    if (lights && lights.screenSpill) {
      const f = 1 - 0.45 * Math.sin(Math.PI * s);
      lights.screenSpill.intensity = spillBase * (1 + F.hoverBoost * hover) * f;
    }
    if (lights && lights.lamp) {
      lights.lamp.setOn(1 - 0.1 * Math.sin(Math.PI * s));
    }
  }

  function setArrivedLights() {
    if (lights && lights.screenSpill) lights.screenSpill.intensity = spillBase * (1 + F.hoverBoost * hover);
    if (lights && lights.lamp) lights.lamp.setOn(1);
  }

  function tick(now) {
    if (!flight) return false;
    const t = clamp((now - flight.startT) / flight.dur, 0, 1);
    const e = easeInOutCubic(t);
    // Position: Bezier. Rotation: slerp. FOV: eased + small mid pull-back.
    // All three share the SAME eased progress `e`, so position, rotation and
    // fov start and stop together at zero velocity (no lurch at the seams).
    camera.position.copy(bezierPos(e));
    camera.quaternion.copy(flight.q0).slerp(flight.q1, e);
    const base = flight.f0 + (flight.f1 - flight.f0) * e;
    camera.fov = flight.dir > 0 ? base + F.fovPullBack * Math.sin(Math.PI * e) : base;
    camera.updateProjectionMatrix();
    applyTuning(flight.dir, t);
    onNeedsRender && onNeedsRender();
    if (t >= 1) finish(flight.dir);
    return true;
  }

  function finish(dir) {
    const done = flight;
    flight = null;
    if (!done) return;
    camera.fov = done.f1;
    camera.updateProjectionMatrix();
    if (dir > 0) {
      // Arrival: brightness full, boot animation, keyboard focus on the DOM.
      state = 'SCREEN_ACTIVE';
      setArrivedLights();
      screen.setBrightness(1);
      screen.setInteractive(true);
      if (screen.boot) screen.boot();
    } else {
      // Hand back to orbit with zero lingering damping: set the target, run one
      // controls.update() with damping off, then re-enable. No jump at the seam.
      const back = savedOrbit || defaultOrbit();
      if (controls) {
        controls.controls.target.copy(back.target);
        const damp = controls.controls.enableDamping;
        controls.controls.enableDamping = false;
        controls.controls.update();
        controls.controls.enableDamping = damp;
        controls.setEnabled(true);
      }
      state = 'IDLE_ORBIT';
      setArrivedLights();
      screen.setBrightness(1);
      canvas.style.pointerEvents = 'auto';
    }
    onNeedsRender && onNeedsRender();
  }

  // ---- state entries ----------------------------------------------------
  function enter() {
    if (state !== 'IDLE_ORBIT') return;
    state = 'FLYING_IN';
    downHit = false;
    hoverTarget = 0;
    canvas.style.cursor = 'default';
    savedOrbit = controls.save();
    controls.setEnabled(false);
    // Canvas ignores pointers so the DOM screen gets them, but only once the
    // fly-in has finished (setInteractive(true) is called on arrival).
    canvas.style.pointerEvents = 'none';
    fadeHint(false);
    const fp = focusPose();
    screen.setBrightness(0.65);
    beginFlight(1, currentPose(), fp, F.duration);
  }

  function exit() {
    if (state !== 'SCREEN_ACTIVE') return;
    state = 'FLYING_OUT';
    screen.setInteractive(false);
    canvas.style.pointerEvents = 'auto';
      if (screen.powerOff) screen.powerOff();
    const back = savedOrbit || defaultOrbit();
    beginFlight(-1, currentPose(), {
      pos: back.position,
      look: back.target,
      quat: lookQuat(back.position, back.target),
      fov: back.fov,
    }, F.exitDuration);
    onNeedsRender && onNeedsRender();
  }

  // Esc mid-flight: stop and travel smoothly back to the orbit pose.
  function onEscape() {
    if (state === 'SCREEN_ACTIVE') { exit(); return; }
    if (state === 'FLYING_IN' && flight) {
      state = 'FLYING_OUT';
      screen.setInteractive(false);
      canvas.style.pointerEvents = 'auto';
      const back = savedOrbit || defaultOrbit();
      beginFlight(-1, currentPose(), {
        pos: back.position,
        look: back.target,
        quat: lookQuat(back.position, back.target),
        fov: back.fov,
      }, F.exitDuration);
      return;
    }
    if (state === 'FLYING_OUT' && flight) {
      state = 'FLYING_IN';
      canvas.style.pointerEvents = 'none';
      beginFlight(1, currentPose(), focusPose(), F.duration);
    }
  }

  // ---- UI fades (~250 ms) ----------------------------------------------
  function fadeHint(show) {
    if (!hintEl) return;
    hintEl.classList.toggle('hidden', !show);
  }

  function fadeBack(show) {
    if (!backBtn) return;
    if (show) {
      backBtn.hidden = false;
      requestAnimationFrame(() => backBtn.classList.add('show'));
    } else {
      backBtn.classList.remove('show');
      window.setTimeout(() => { if (!backBtn.classList.contains('show')) backBtn.hidden = true; }, 280);
    }
  }

  // ---- pointer ----------------------------------------------------------
  function setPointerFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  function raycastHit() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(targets, false);
    return hits.length > 0;
  }

  function onPointerMove(e) {
    if (state !== 'IDLE_ORBIT') { hoverTarget = 0; return; }
    setPointerFromEvent(e);
    hoverTarget = raycastHit() ? 1 : 0;
    canvas.style.cursor = hoverTarget ? 'pointer' : 'default';
  }

  function onPointerDown(e) {
    if (state !== 'IDLE_ORBIT') return;
    down = { x: e.clientX, y: e.clientY };
    setPointerFromEvent(e);
    downHit = raycastHit();
  }

  function onPointerUp(e) {
    if (state !== 'IDLE_ORBIT') { down = null; return; }
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const wasHit = downHit;
    down = null;
    downHit = false;
    if (moved > F.clickSlopPx) return; // it was a drag, not a click
    if (wasHit) enter();
  }

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', () => { hoverTarget = 0; canvas.style.cursor = 'default'; });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { onEscape(); return; }
    // ?debug: replay the transition from the keyboard.
    if (debugMode && !e.repeat && (e.key === 't' || e.key === 'T')) {
      if (state === 'IDLE_ORBIT') enter();
      else if (state === 'SCREEN_ACTIVE') exit();
    }
  });

  // While zoomed in the canvas ignores pointers, so exit on any click that is
  // not on the screen itself (links/buttons/taskbar keep working).
  window.addEventListener('pointerup', (e) => {
    if (state !== 'SCREEN_ACTIVE') return;
    if (screen.element && screen.element.contains(e.target)) return;
    exit();
  });

  if (backBtn) backBtn.addEventListener('click', () => exit());
  if (screen.setOnExit) screen.setOnExit(() => exit());

  // ---- debug flight path (?debug): paint the Bezier + endpoints, press T ----
  let dbgGroup = null;
  let pathLine = null;
  let ptStart = null;
  let ptEnd = null;
  function initDebugPath() {
    dbgGroup = new THREE.Group();
    dbgGroup.name = 'flight-path-debug';
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(49 * 3), 3));
    pathLine = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xff3df0, transparent: true, opacity: 0.85 }),
    );
    pathLine.raycast = () => null;
    dbgGroup.add(pathLine);
    const mk = (color) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 10, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: false }),
      );
      m.raycast = () => null;
      dbgGroup.add(m);
      return m;
    };
    ptStart = mk(0x3df0ff);
    ptEnd = mk(0xffd23d);
    scene.add(dbgGroup);
  }
  if (debugMode) initDebugPath();

  function updateDebugPath() {
    if (!dbgGroup) return;
    const show = state === 'IDLE_ORBIT';
    dbgGroup.visible = show;
    if (!show) return;
    const P0 = camera.position.clone();
    const P2 = focusPose().pos;
    const P1 = pathControlPoint(P0, P2);
    const pos = pathLine.geometry.attributes.position;
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      const u = 1 - t;
      pos.setXYZ(
        i,
        u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x,
        u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y,
        u * u * P0.z + 2 * u * t * P1.z + t * t * P2.z,
      );
    }
    pos.needsUpdate = true;
    pathLine.geometry.computeBoundingSphere();
    ptStart.position.copy(P0);
    ptEnd.position.copy(P2);
    onNeedsRender && onNeedsRender();
  }

  // ------------------------------------------------------------- update
  function update(now) {
    // Fly the camera when in a tween (also completes it deterministically).
    let changed = tick(now);

    // Hover ease + visual feedback.
    const prevHover = hover;
    hover += (hoverTarget - hover) * 0.15;
    if (hover < 0.001 && hoverTarget === 0) hover = 0;
    if (Math.abs(hover - prevHover) > 0.0005) changed = true;
    const boost = 1 + F.hoverBoost * hover;
    if (lights && lights.screenSpill && !flight) {
      lights.screenSpill.intensity = spillBase * boost;
    }
    for (const { m, base } of emissiveMats) m.emissiveIntensity = base + 0.25 * hover;

    if (debugMode) updateDebugPath();

    if (backBtn) {
      const wantBack = state === 'SCREEN_ACTIVE';
      if (wantBack !== prevBack) {
        prevBack = wantBack;
        fadeBack(wantBack);
        changed = true;
      }
    }
    return changed;
  }

  return {
    enter, exit, update,
    resize() {},
    get state() { return state; },
    get hover() { return hover; },
    // Debug helper: names hit at a viewport pixel (used by headless tests).
    pick(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(targets, false)
        .map((h) => h.object.name || h.object.type);
    },
    _targets: targets,
  };
}

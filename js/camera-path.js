import * as THREE from 'three';
import { CONFIG } from './config.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

const UP = new THREE.Vector3(0, 1, 0);
const DEG = Math.PI / 180;

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

// ============================================================
// Scroll-driven, damped camera path through the four monitor stops.
//
//   1. two CatmullRomCurve3 splines (position + lookAt) thread every stop,
//      with an auto-inserted "arc" point between each pair so the camera
//      swings out and around rather than sliding straight across;
//   2. one 0..1 progress value from ScrollTrigger samples both curves;
//   3. each stop's range holds still for `holdRatio`, then travels the rest,
//      eased so motion accelerates out of a stop and settles into the next;
//   4. the real camera chases the sampled pose with frame-rate independent
//      exponential damping (lookAt lags position for a cinematic feel);
//   5. fov widens and a touch of roll appears at mid-travel, returning to 0.
// ============================================================
export function createCameraPath({ scene, camera, onNeedsRender, onStop, lenis = null, reduced = false }) {
  const M = CONFIG.motion;
  const stops = CONFIG.stops;
  const n = stops.length;

  let portrait = globalThis.innerWidth < CONFIG.mobileWidth;
  const wp = (i) => (portrait ? stops[i].mobile : stops[i].desktop);

  // ---- waypoints + splines ------------------------------------------------
  const stopPos = [];
  const stopLook = [];
  const stopFov = [];
  let posCurve = null;
  let lookCurve = null;

  let debugGroup = null;
  let hud = null;
  let disposed = false;
  let lastStop = -1;
  let lastProgress = -1;
  let programmatic = false;
  let snapTimer = null;

  const mouse = { x: 0, y: 0 };
  const par = { x: 0, y: 0 };

  // The damped "current" pose (what we render) and the curve "target".
  const current = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40, roll: 0 };

  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _off = new THREE.Vector3();

  function readWaypoints() {
    stopPos.length = stopLook.length = stopFov.length = 0;
    for (let i = 0; i < n; i++) {
      const w = wp(i);
      stopPos.push(new THREE.Vector3(...w.pos));
      stopLook.push(new THREE.Vector3(...w.look));
      stopFov.push(w.fov);
    }
  }

  function buildCurves() {
    readWaypoints();

    const posPts = [stopPos[0].clone()];
    const lookPts = [stopLook[0].clone()];

    for (let i = 0; i < n - 1; i++) {
      const a = stopPos[i];
      const b = stopPos[i + 1];
      const la = stopLook[i];
      const lb = stopLook[i + 1];

      const mid = a.clone().add(b).multiplyScalar(0.5);
      const midLook = la.clone().add(lb).multiplyScalar(0.5);

      // Pull the arc back, away from where the camera is looking (the desk).
      const dir = mid.clone().sub(midLook);
      if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1);
      dir.normalize();
      const arc = mid.addScaledVector(dir, M.arcPullBack).addScaledVector(UP, M.arcLift);

      posPts.push(arc, b.clone());
      lookPts.push(midLook, lb.clone());
    }

    const type = M.curveType || 'centripetal';
    posCurve = new THREE.CatmullRomCurve3(posPts, false, type, M.curveTension);
    lookCurve = new THREE.CatmullRomCurve3(lookPts, false, type, M.curveTension);

    // Stop i sits at spline parameter i/(n-1) (equal spacing across segments).
    if (debugGroup) rebuildDebugLines();
  }

  // Sampled pose for a global progress value in 0..1.
  const _pos = new THREE.Vector3();
  const _look = new THREE.Vector3();
  function sample(p) {
    p = clamp01(p);
    const seg = p * (n - 1);
    let i = Math.floor(seg);
    let f = seg - i;
    if (i >= n - 1) { i = n - 1; f = 0; }

    let u = 0;
    if (f > M.holdRatio && n > 1) u = easeInOutCubic((f - M.holdRatio) / (1 - M.holdRatio));

    const t = n > 1 ? (i + u) / (n - 1) : 0;
    posCurve.getPoint(t, _pos);
    lookCurve.getPoint(t, _look);

    const ni = Math.min(n - 1, i + 1);
    const bump = Math.sin(Math.PI * u); // 0 at holds, 1 at mid-travel
    const fov = stopFov[i] + (stopFov[ni] - stopFov[i]) * u + M.fovPullBack * bump;

    return { pos: _pos, look: _look, fov, roll: M.rollAmount * bump * DEG, bump };
  }

  // ---- scroll wiring ------------------------------------------------------
  let trigger = null;

  function handleStop(index) {
    if (index === lastStop) return;
    lastStop = index;
    onStop && onStop(index, stops[index]);
  }

  function build() {
    buildCurves();

    if (trigger) trigger.kill();
    trigger = ScrollTrigger.create({
      trigger: document.getElementById('spacer') || document.body,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: () => { onNeedsRender && onNeedsRender(); },
    });

    // Snap the damped pose onto the path immediately (no fly-in on load).
    const s = sample(trigger.progress || 0);
    current.pos.copy(s.pos);
    current.look.copy(s.look);
    current.fov = s.fov;
    current.roll = s.roll;
    handleStop(Math.min(n - 1, Math.floor((trigger.progress || 0) * (n - 1) + 1e-6)));

    if (debugGroup) rebuildDebugLines();
  }

  // ---- navigation + snap --------------------------------------------------
  function scrollYFor(i) {
    if (!trigger) return 0;
    const p = n > 1 ? i / (n - 1) : 0;
    return trigger.start + p * (trigger.end - trigger.start);
  }

  function goToY(y, duration) {
    if (lenis) {
      programmatic = true;
      lenis.scrollTo(y, {
        duration: duration ?? 0.7,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        onComplete: () => { programmatic = false; },
      });
    } else {
      programmatic = true;
      window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
      window.setTimeout(() => { programmatic = false; }, reduced ? 0 : 600);
    }
  }

  function scrollToStop(i) {
    goToY(scrollYFor(Math.max(0, Math.min(n - 1, i))));
  }

  function onLenisScroll() {
    if (!programmatic) scheduleSnap();
  }

  function scheduleSnap() {
    if (reduced || !M.snapEnabled || !lenis) return;
    clearTimeout(snapTimer);
    snapTimer = window.setTimeout(() => {
      if (programmatic || !trigger) return;
      const p = trigger.progress;
      const i = Math.round(p * (n - 1));
      const tp = n > 1 ? i / (n - 1) : 0;
      if (Math.abs(p - tp) < M.snapEpsilon) return;
      programmatic = true;
      lenis.scrollTo(scrollYFor(i), {
        duration: M.snapDuration,
        easing: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2), // power2.inOut
        onComplete: () => { programmatic = false; },
      });
    }, 150);
  }

  if (lenis) lenis.on('scroll', onLenisScroll);

  function onPointerMove(e) {
    mouse.x = (e.clientX / globalThis.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / globalThis.innerHeight) * 2 - 1;
  }
  if (!reduced) globalThis.addEventListener('pointermove', onPointerMove, { passive: true });

  // ---- per-frame update ---------------------------------------------------
  function update(now, dt) {
    if (disposed) return false;
    dt = Math.min(dt || 0.016, 0.1);

    const p = trigger ? trigger.progress : 0;

    // Stop / typing trigger uses the raw progress so the plateau is exact.
    handleStop(Math.min(n - 1, Math.floor(p * (n - 1) + 1e-6)));

    const s = sample(p);

    if (reduced) {
      // Reduced motion: no easing lag, no parallax, no roll.
      current.pos.copy(s.pos);
      current.look.copy(s.look);
      current.roll = 0;
    } else {
      current.pos.x = damp(current.pos.x, s.pos.x, M.positionLambda, dt);
      current.pos.y = damp(current.pos.y, s.pos.y, M.positionLambda, dt);
      current.pos.z = damp(current.pos.z, s.pos.z, M.positionLambda, dt);
      current.look.x = damp(current.look.x, s.look.x, M.lookAtLambda, dt);
      current.look.y = damp(current.look.y, s.look.y, M.lookAtLambda, dt);
      current.look.z = damp(current.look.z, s.look.z, M.lookAtLambda, dt);
      current.roll = damp(current.roll, s.roll, M.lookAtLambda, dt);
    }
    current.fov = damp(current.fov, s.fov, M.positionLambda, dt);

    // Mouse parallax, faded out during travel so it never fights the move.
    const fade = reduced ? 0 : 1 - s.bump;
    const pk = 1 - Math.pow(1 - CONFIG.idle.parallaxLerp, dt * 60);
    par.x += (mouse.x * fade - par.x) * pk;
    par.y += (mouse.y * fade - par.y) * pk;

    _fwd.subVectors(current.look, current.pos).normalize();
    _right.crossVectors(_fwd, UP).normalize();
    _up.crossVectors(_right, _fwd).normalize();
    const strength = CONFIG.idle.parallaxStrength;
    _off.copy(_right).multiplyScalar(par.x * strength * 2).addScaledVector(_up, par.y * strength);

    camera.position.copy(current.pos).add(_off);
    camera.lookAt(current.look);
    if (current.roll) camera.rotateZ(current.roll);

    if (Math.abs(camera.fov - current.fov) > 1e-4) {
      camera.fov = current.fov;
      camera.updateProjectionMatrix();
    }

    // Converged? Then this frame doesn't need a render (unless scrolling).
    const eps2 = M.settleEpsilon * M.settleEpsilon;
    const settled =
      current.pos.distanceToSquared(s.pos) < eps2 &&
      current.look.distanceToSquared(s.look) < eps2 &&
      Math.abs(current.fov - s.fov) < 0.01 &&
      Math.abs(current.roll - s.roll) < 0.0005 &&
      Math.abs(par.x) < 1e-4 && Math.abs(par.y) < 1e-4;

    const scrolling = Math.abs(p - lastProgress) > 1e-6;
    lastProgress = p;

    if (hud && hud.visible) updateHud(p, s);

    return !settled || scrolling || programmatic;
  }

  // ---- debug visualisation ------------------------------------------------
  function tagOnTop(obj) {
    obj.renderOrder = 999;
    if (obj.material) obj.material.depthTest = false;
  }

  function rebuildDebugLines() {
    if (!debugGroup) return;
    const visible = debugGroup.visible;
    // Clear everything but keep the group.
    for (let i = debugGroup.children.length - 1; i >= 0; i--) {
      const c = debugGroup.children[i];
      debugGroup.remove(c);
      c.geometry?.dispose?.();
      c.material?.dispose?.();
    }

    const posLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(posCurve.getPoints(300)),
      new THREE.LineBasicMaterial({ color: 0x39ff88 }),
    );
    const lookLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(lookCurve.getPoints(300)),
      new THREE.LineBasicMaterial({ color: 0xff66cc }),
    );
    tagOnTop(posLine);
    tagOnTop(lookLine);
    debugGroup.add(posLine, lookLine);

    const sphere = new THREE.SphereGeometry(0.022, 12, 8);
    const posMat = new THREE.MeshBasicMaterial({ color: 0x39ff88 });
    const lookMat = new THREE.MeshBasicMaterial({ color: 0xff66cc });
    for (const p of stopPos) {
      const m = new THREE.Mesh(sphere, posMat);
      m.position.copy(p);
      tagOnTop(m);
      debugGroup.add(m);
    }
    for (const l of stopLook) {
      const m = new THREE.Mesh(sphere, lookMat);
      m.position.copy(l);
      tagOnTop(m);
      debugGroup.add(m);
    }
    debugGroup.visible = visible;
  }

  function ensureHud() {
    if (hud) return hud;
    hud = document.createElement('div');
    hud.id = 'path-debug-hud';
    Object.assign(hud.style, {
      position: 'fixed', left: '12px', bottom: '12px', zIndex: '200',
      font: '11px/1.5 ui-monospace, monospace', color: '#9effc0',
      background: 'rgba(3,8,6,0.78)', border: '1px solid #1d3b2a',
      padding: '8px 10px', whiteSpace: 'pre', pointerEvents: 'none', maxWidth: '60vw',
    });
    document.body.appendChild(hud);
    return hud;
  }

  function updateHud(p, s) {
    if (!hud) return;
    const c = camera.position;
    hud.textContent =
      `progress  ${p.toFixed(3)}\n` +
      `stop      ${lastStop}/${n - 1}  ${stops[lastStop]?.id ?? ''}\n` +
      `target    ${s.pos.x.toFixed(2)} ${s.pos.y.toFixed(2)} ${s.pos.z.toFixed(2)}\n` +
      `camera    ${c.x.toFixed(2)} ${c.y.toFixed(2)} ${c.z.toFixed(2)}\n` +
      `fov       ${camera.fov.toFixed(1)}\n` +
      `calls     ${window.__zally?.renderer?.info?.render?.calls ?? '-'}`;
  }

  function setDebug(on) {
    if (on && !debugGroup) {
      debugGroup = new THREE.Group();
      debugGroup.name = 'path-debug';
      scene && scene.add(debugGroup);
      rebuildDebugLines();
    }
    if (debugGroup) debugGroup.visible = on;
    if (on) { ensureHud().style.display = 'block'; onNeedsRender && onNeedsRender(); }
    else if (hud) hud.style.display = 'none';
  }

  // ---- build / rebuild / dispose -----------------------------------------
  build();

  function rebuild() {
    const next = globalThis.innerWidth < CONFIG.mobileWidth;
    if (next === portrait && trigger) {
      ScrollTrigger.refresh();
      return;
    }
    portrait = next;
    build();
    onNeedsRender && onNeedsRender();
  }

  function dispose() {
    disposed = true;
    globalThis.removeEventListener('pointermove', onPointerMove);
    if (lenis) lenis.off('scroll', scheduleSnap);
    if (snapTimer) clearTimeout(snapTimer);
    if (trigger) trigger.kill();
    if (debugGroup) {
      scene && scene.remove(debugGroup);
      debugGroup.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    }
    if (hud) hud.remove();
  }

  return {
    update, rebuild, dispose, scrollToStop, setDebug,
    get progress() { return trigger ? trigger.progress : 0; },
    get trigger() { return trigger; },
    get current() { return current; },
  };
}

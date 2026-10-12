import * as THREE from 'three';
import { CONFIG } from './config.js';

// ===========================================================================
// Scroll-driven camera path (stage 3).
//
//  * Two CatmullRomCurve3 splines (position + lookAt) thread every stop.
//    Between stops we auto-insert an "arc" control point (pulled back + lifted)
//    so the camera swings around objects instead of cutting straight through;
//    a stop may instead supply explicit `via` control points (used by the intro
//    orbit -> lamp/books detail pass -> dolly into the monitor).
//  * A single 0..1 scroll progress samples both curves. Each stop HOLDS still
//    for `holdRatio` of its scroll range, then eases to the next (holds, not
//    linear ramps), so the camera "arrives" and reads before moving on.
//  * Everything is damped (frame-rate independent) and mildly rolls + widens
//    fov mid-travel for a cinematic feel; both return to 0 at each stop.
//  * Lenis + ScrollTrigger drive progress; the 5 dots jump between stops and a
//    snap pulls the scroll to the nearest stop once the user stops scrolling.
// ===========================================================================

const DEG = Math.PI / 180;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

export function createCameraPath({ camera, webglScene, onStop, onProgress, reduced }) {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const Lenis = window.Lenis;
  const M = CONFIG.motion;
  const stops = CONFIG.stops;
  const nStops = stops.length;

  if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  const spacer = document.getElementById('spacer');
  const dotEls = Array.from(document.querySelectorAll('#dots button'));

  // ------------------------------------------------------------- control nets
  // Build the control-point list for a breakpoint; both are prebuilt at init so
  // crossing the mobile breakpoint needs no curve rebuild.
  function build(bp) {
    const posPts = [];
    const lookPts = [];
    const stopIndex = [];

    for (let i = 0; i < nStops; i++) {
      const d = stops[i][bp];
      if (!d) return null;

      if (i === 0) {
        posPts.push(v3(d.pos));
        lookPts.push(v3(d.look));
        stopIndex.push(0);
        continue;
      }

      const prevPos = posPts[posPts.length - 1];
      const prevLook = lookPts[lookPts.length - 1];
      const target = v3(d.pos);
      const targetLook = v3(d.look);

      const via = stops[i].via ? stops[i].via[bp] : null;
      if (via && via.length) {
        for (const p of via) {
          posPts.push(v3(p.pos));
          lookPts.push(p.look ? v3(p.look) : targetLook.clone());
        }
      } else {
        const pull = stops[i].arc && stops[i].arc.pull != null ? stops[i].arc.pull : M.arcPullBack;
        const lift = stops[i].arc && stops[i].arc.lift != null ? stops[i].arc.lift : M.arcLift;
        const dist = prevPos.distanceTo(target);
        const midPos = prevPos.clone().lerp(target, 0.5);
        const midLook = prevLook.clone().lerp(targetLook, 0.5);
        const back = midPos.clone().sub(midLook);
        back.y = 0;
        if (back.lengthSq() > 1e-6) back.normalize(); else back.set(0, 0, 0);
        midPos.addScaledVector(back, pull * dist * 0.5);
        midPos.y += lift * dist * 0.5;
        posPts.push(midPos);
        lookPts.push(midLook);
      }

      posPts.push(target);
      lookPts.push(targetLook);
      stopIndex.push(posPts.length - 1);
    }

    const N = posPts.length;
    return {
      posCurve: new THREE.CatmullRomCurve3(posPts, false, M.curveType, M.curveTension),
      lookCurve: new THREE.CatmullRomCurve3(lookPts, false, M.curveType, M.curveTension),
      params: stopIndex.map((idx) => idx / (N - 1)),
      posPts, lookPts, N,
    };
  }

  const nets = { desktop: build('desktop'), mobile: build('mobile') };
  let breakpoint = window.innerWidth < CONFIG.mobileWidth ? 'mobile' : 'desktop';
  if (!nets[breakpoint]) breakpoint = breakpoint === 'mobile' ? 'desktop' : 'mobile';

  // ------------------------------------------------------------- sampling
  function sampleAt(bp, p) {
    const c = nets[bp];
    const seg = clamp01(p) * (nStops - 1);
    let i = Math.floor(seg);
    let f = seg - i;
    if (i >= nStops - 1) { i = nStops - 2; f = 1; }
    if (i < 0) { i = 0; f = 0; }

    const hold = M.holdRatio;
    const u = f > hold ? easeInOutCubic((f - hold) / (1 - hold)) : 0;
    const t0 = c.params[i];
    const t1 = c.params[i + 1];
    const t = t0 + (t1 - t0) * u;

    const pos = c.posCurve.getPoint(t);
    const look = c.lookCurve.getPoint(t);

    const fovA = stops[i][bp].fov;
    const fovB = stops[i + 1][bp].fov;
    const bump = Math.sin(Math.PI * u);
    const fov = fovA + (fovB - fovA) * u + (reduced ? 0 : M.fovPullBack * bump);
    const roll = reduced ? 0 : M.rollAmount * bump * DEG;

    // Which stop we're "at": switch near arrival (u ~ 0.9), not at the midpoint.
    const arrival = u >= 0.9;
    const activeIdx = arrival ? i + 1 : i;
    const holding = f <= hold && !arrival;

    return { pos, look, fov, roll, u, i, f, activeIdx, holding };
  }

  // ------------------------------------------------------------- state
  const cur = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: camera.fov };
  let progress = 0;
  let activeIdx = -1;
  let settled = false;
  let holding = false;
  let lastUpdate = performance.now();
  let lastScroll = performance.now();
  let snapBusyUntil = 0;
  let dragging = false;

  // Seed the camera exactly on the first stop (no fly-in from stage-1 pose).
  {
    const s = sampleAt(breakpoint, 0);
    cur.pos.copy(s.pos); cur.look.copy(s.look); cur.fov = s.fov;
    applyCamera(s.pos, s.look, s.fov, s.roll);
  }

  function applyCamera(pos, look, fov, roll) {
    camera.position.copy(pos);
    if (roll) {
      camera.up.set(0, 1, 0);
      camera.lookAt(look);
      camera.rotateZ(-roll);
    } else {
      camera.up.set(0, 1, 0);
      camera.lookAt(look);
    }
    if (Math.abs(camera.fov - fov) > 1e-4) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  function maxScroll() {
    return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }
  function progressToY(p) { return p * maxScroll(); }

  // ------------------------------------------------------------- scroll source
  let lenis = null;
  if (Lenis && !reduced) {
    lenis = new Lenis({ duration: 1.05, smoothWheel: true, touchMultiplier: 1.4 });
    if (ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
    const tick = (time) => lenis.raf(time * 1000);
    if (gsap) { gsap.ticker.add(tick); gsap.ticker.lagSmoothing(0); }
    else { const loop = (t) => { lenis.raf(t); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  }

  let trigger = null;
  if (ScrollTrigger && spacer) {
    trigger = ScrollTrigger.create({
      trigger: spacer,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => { progress = self.progress; lastScroll = performance.now(); onProgress && onProgress(progress); },
      onRefresh: (self) => { progress = self.progress; },
    });
    progress = trigger.progress || 0;
  } else {
    // Fallback: raw scroll.
    const onScroll = () => { progress = clamp01(window.scrollY / maxScroll()); lastScroll = performance.now(); onProgress && onProgress(progress); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  if (lenis && ScrollTrigger) {
    // Lenis writes scroll via ScrollTrigger's scroller proxy handled internally.
    lenis.on('scroll', () => { lastScroll = performance.now(); });
  }

  // ------------------------------------------------------------- dots
  function setDotActive(idx) {
    dotEls.forEach((d, i) => d.classList.toggle('active', i === idx));
  }
  function goToStop(idx) {
    idx = Math.max(0, Math.min(nStops - 1, idx));
    const y = progressToY(idx / (nStops - 1));
    snapBusyUntil = performance.now() + M.snapDuration * 1000 + 150;
    if (lenis) lenis.scrollTo(y, { duration: M.snapDuration, easing: easeInOutCubic });
    else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }
  dotEls.forEach((d) => d.addEventListener('click', () => goToStop(Number(d.dataset.stop) || 0)));
  if (spacer) spacer.addEventListener('pointerdown', () => { dragging = true; });
  window.addEventListener('pointerup', () => { dragging = false; });

  // ------------------------------------------------------------- update
  function update(now) {
    const dt = Math.min(0.05, Math.max(1e-4, (now - lastUpdate) / 1000));
    lastUpdate = now;

    const bp = window.innerWidth < CONFIG.mobileWidth ? 'mobile' : 'desktop';
    breakpoint = nets[bp] ? bp : breakpoint;

    // Snap to nearest stop once the user stops scrolling.
    if (M.snapEnabled && !reduced && !dragging && now > snapBusyUntil && now - lastScroll > 150) {
      const nearest = Math.round(clamp01(progress) * (nStops - 1));
      const targetP = nearest / (nStops - 1);
      if (Math.abs(progress - targetP) > M.snapEpsilon) goToStop(nearest);
    }

    const want = sampleAt(breakpoint, progress);

    const aPos = reduced ? 1 : 1 - Math.exp(-M.positionLambda * dt);
    const aLook = reduced ? 1 : 1 - Math.exp(-M.lookAtLambda * dt);
    const aMisc = reduced ? 1 : 1 - Math.exp(-6.0 * dt);

    const before = cur.pos.distanceTo(want.pos) + cur.look.distanceTo(want.look);
    cur.pos.lerp(want.pos, aPos);
    cur.look.lerp(want.look, aLook);
    cur.fov += (want.fov - cur.fov) * aMisc;

    // Kill the asymptotic tail: once we're close, land exactly on the target so
    // the damping actually terminates (important at low frame rates).
    if (cur.pos.distanceTo(want.pos) < M.snapClose) cur.pos.copy(want.pos);
    if (cur.look.distanceTo(want.look) < M.snapClose) cur.look.copy(want.look);
    if (Math.abs(want.fov - cur.fov) < 0.03) cur.fov = want.fov;

    applyCamera(cur.pos, cur.look, cur.fov, want.roll);

    settled = want.pos.distanceTo(cur.pos) < M.settleEpsilon &&
      want.look.distanceTo(cur.look) < M.settleEpsilon &&
      Math.abs(want.fov - cur.fov) < 0.05;
    holding = want.holding && settled;

    if (want.activeIdx !== activeIdx) {
      activeIdx = want.activeIdx;
      setDotActive(activeIdx);
      onStop && onStop(activeIdx, stops[activeIdx]);
    }

    return !settled || before > M.settleEpsilon;
  }

  // ------------------------------------------------------------- debug
  let debugGroup = null;
  function enableDebug() {
    if (debugGroup || !webglScene) return;
    debugGroup = new THREE.Group();
    debugGroup.name = 'camera-path-debug';
    for (const bp of ['desktop', 'mobile']) {
      const c = nets[bp];
      if (!c) continue;
      const dim = bp === 'mobile';
      const posLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(c.posCurve.getPoints(160)),
        new THREE.LineBasicMaterial({ color: dim ? 0x3355ff : 0x39ff88 }),
      );
      const lookLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(c.lookCurve.getPoints(160)),
        new THREE.LineBasicMaterial({ color: dim ? 0x553388 : 0xffaa33 }),
      );
      debugGroup.add(posLine, lookLine);
      const addDots = (pts, color, size) => {
        for (const p of pts) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10), new THREE.MeshBasicMaterial({ color }));
          m.position.copy(p);
          debugGroup.add(m);
        }
      };
      addDots(c.posPts, dim ? 0x5577ff : 0x39ff88, 0.015);
      addDots(c.lookPts, dim ? 0x9966ff : 0xffaa33, 0.012);
    }
    webglScene.add(debugGroup);
  }

  function refresh() {
    if (trigger) trigger.refresh();
    else progress = clamp01(window.scrollY / maxScroll());
  }

  return {
    update, goToStop, refresh, enableDebug,
    get progress() { return progress; },
    get activeIdx() { return activeIdx; },
    get settled() { return settled; },
    get holding() { return holding; },
    get breakpoint() { return breakpoint; },
    stopCount: nStops,
  };
}

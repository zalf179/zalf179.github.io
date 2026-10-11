import * as THREE from 'three';
import { CONFIG } from './config.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

const REDUCED = globalThis.matchMedia
  ? globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

export function createCameraPath({ camera, refs, onDirty }) {
  // The scrubbed timeline drives these two vectors; position/lookAt are then
  // composed each frame (so mouse parallax can nudge the rig without fighting
  // the tween).
  const rig = {
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
  };

  const timeline = gsap.timeline({ paused: true });
  let trigger = null;
  let portrait = window.innerWidth < CONFIG.mobileWidth;

  // --- mouse parallax state ------------------------------------------------
  const mouseTarget = { x: 0, y: 0 };
  const parallax = { x: 0, y: 0 };
  let parallaxEnabled = !REDUCED;

  const onPointerMove = (e) => {
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    mouseTarget.x = nx;
    mouseTarget.y = ny;
  };
  globalThis.addEventListener('pointermove', onPointerMove, { passive: true });

  // --- idle motion state ---------------------------------------------------
  const { chair, chairBaseY, screens } = refs;
  const chairSwingRad = (CONFIG.idle.chairSwingDeg * Math.PI) / 180;
  const glowFlicker = CONFIG.idle.glowFlicker;

  // --- waypoint helpers ----------------------------------------------------
  function waypointList() {
    return portrait ? CONFIG.waypoints.mobile : CONFIG.waypoints.desktop;
  }

  function applyWaypoint(w, immediate) {
    if (immediate) {
      timeline.progress(0).pause();
    }
    rig.pos.set(...w.pos);
    rig.target.set(...w.look);
    camera.fov = w.fov;
    camera.updateProjectionMatrix();
  }

  // --- timeline construction ----------------------------------------------
  function buildScrubTimeline() {
    const wps = waypointList();

    timeline.clear();
    let cursor = 0;

    // Scroll mapping aligns with the real layout: segment i travels to wps[i]
    // while you scroll through the section BEFORE it (wps[i-1].section). The
    // segment's duration = measured height of that section (scaled) * weight,
    // so the camera always lands exactly when the target section enters view.
    const scale = 500;

    // How many segments travel through each source section (they split it evenly).
    const bySection = new Map();
    for (let i = 1; i < wps.length; i++) {
      const src = wps[i - 1].section;
      bySection.set(src, (bySection.get(src) || 0) + 1);
    }

    for (let i = 1; i < wps.length; i++) {
      const w = wps[i];
      const src = wps[i - 1].section;
      const el = document.querySelector(src);
      const height = el ? el.offsetHeight : 700;
      const split = bySection.get(src) || 1;
      const weight = typeof w.duration === 'number' ? w.duration : 1;
      const d = Math.max(0.25, (height / split / scale) * weight);

      timeline
        .to(rig.pos, { x: w.pos[0], y: w.pos[1], z: w.pos[2], duration: d, ease: CONFIG.scroll.ease }, cursor)
        .to(rig.target, { x: w.look[0], y: w.look[1], z: w.look[2], duration: d, ease: CONFIG.scroll.ease }, cursor)
        .to(camera, { fov: w.fov, duration: d, ease: CONFIG.scroll.ease, onUpdate: () => camera.updateProjectionMatrix() }, cursor);
      cursor += d;
    }

    if (trigger) trigger.kill();
    trigger = ScrollTrigger.create({
      trigger: document.querySelector('main') || document.body,
      start: 'top top',
      end: 'bottom bottom',
      scrub: CONFIG.scroll.scrub,
      animation: timeline,
    });
  }

  // --- reduced-motion fallback --------------------------------------------
  // No scrubbing: each section simply tweens the camera to its waypoint with a
  // short transition when you arrive. Parallax / idle motion are off.
  const motionTriggers = [];

  function buildSectionTriggers() {
    const wps = waypointList();

    // One transition per section (last waypoint listed for that section).
    const perSection = new Map();
    wps.forEach((w) => perSection.set(w.section, w));

    perSection.forEach((w, selector) => {
      const el = document.querySelector(selector);
      if (!el) return;
      motionTriggers.push(
        ScrollTrigger.create({
          trigger: el,
          start: 'top center',
          end: 'bottom center',
          onEnter: () => animateTo(w, CONFIG.scroll.reducedTransition),
          onEnterBack: () => animateTo(w, CONFIG.scroll.reducedTransition),
        })
      );
    });
  }

  let activeTween = null;
  function animateTo(w, dur) {
    if (activeTween) activeTween.kill();
    const ease = 'power2.inOut';
    activeTween = gsap.timeline({ ease });
    activeTween
      .to(rig.pos, { x: w.pos[0], y: w.pos[1], z: w.pos[2], duration: dur, ease }, 0)
      .to(rig.target, { x: w.look[0], y: w.look[1], z: w.look[2], duration: dur, ease }, 0)
      .to(camera, { fov: w.fov, duration: dur, ease, onUpdate: () => camera.updateProjectionMatrix() }, 0);
    activeTween.eventCallback('onComplete', () => {
      activeTween = null;
    });
  }

  function ready(initial) {
    if (initial) applyWaypoint(waypointList()[0], true);
    if (REDUCED) {
      buildSectionTriggers();
    } else {
      buildScrubTimeline();
    }
  }

  // --- per-frame update ----------------------------------------------------
  function update(now, dt) {
    if (parallaxEnabled) {
      parallax.x += (mouseTarget.x - parallax.x) * CONFIG.idle.parallaxLerp;
      parallax.y += (mouseTarget.y - parallax.y) * CONFIG.idle.parallaxLerp;
    } else {
      parallax.x = 0;
      parallax.y = 0;
    }

    // Idle motion (skipped under reduced-motion).
    if (!REDUCED) {
      if (chair) {
        chair.rotation.y = chairBaseY + Math.sin(now * CONFIG.idle.chairSwingSpeed) * chairSwingRad;
      }
      for (let i = 0; i < screens.length; i++) {
        const s = screens[i];
        s.material.emissiveIntensity =
          glowFlicker * 0.4 +
          Math.sin(now * CONFIG.idle.glowFlickerSpeed + i * 1.7) * glowFlicker * 0.6;
      }
    }

    // Compose final camera pose: start from the rig, add a small lateral
    // parallax offset perpendicular to the view axis.
    const offset = computeParallaxOffset();
    const pos = rig.pos.clone().add(offset);

    camera.position.copy(pos);
    camera.lookAt(rig.target);

    onDirty();
  }

  function computeParallaxOffset() {
    if (!parallaxEnabled) return new THREE.Vector3();
    const forward = rig.target.clone().sub(rig.pos).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const s = CONFIG.idle.parallaxStrength;
    return right.multiplyScalar(parallax.x * s * 2).add(up.multiplyScalar(parallax.y * s));
  }

  // --- responsive ----------------------------------------------------------
  function rebuild() {
    portrait = window.innerWidth < CONFIG.mobileWidth;
    timeline.kill();
    trigger && trigger.kill();
    trigger = null;
    motionTriggers.forEach((t) => t.kill());
    motionTriggers.length = 0;
    activeTween && activeTween.kill();
    ready();
  }

  function dispose() {
    globalThis.removeEventListener('pointermove', onPointerMove);
    timeline && timeline.kill();
    trigger && trigger.kill();
    motionTriggers.forEach((t) => t.kill());
    activeTween && activeTween.kill();
    parallaxEnabled = false;
  }

  return { ready, update, rebuild, dispose, get rig() { return rig; } };
}
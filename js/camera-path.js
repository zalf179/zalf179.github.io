import * as THREE from 'three';
import { CONFIG } from './config.js';

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

const REDUCED = globalThis.matchMedia
  ? globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

const UP = new THREE.Vector3(0, 1, 0);

// Scrubbed, cinematic camera path through the four monitor stops.
// - position, lookAt and fov are all interpolated with soft easing
// - a single GSAP timeline is scrubbed by ScrollTrigger (scrub: 1)
// - a tiny lerped mouse parallax is layered on top while idle
export function createCameraPath({ camera, onNeedsRender, onStop }) {
  const stops = CONFIG.stops;
  const rig = { pos: new THREE.Vector3(), target: new THREE.Vector3() };

  const mouse = { x: 0, y: 0 };
  const par = { x: 0, y: 0 };

  const prevPos = new THREE.Vector3(Infinity, Infinity, Infinity);
  const prevTarget = new THREE.Vector3(Infinity, Infinity, Infinity);
  let prevFov = -1;

  let portrait = window.innerWidth < CONFIG.mobileWidth;
  let timeline = null;
  let trigger = null;
  let lastStop = -1;
  let disposed = false;

  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _off = new THREE.Vector3();

  const waypoint = (i) => (portrait ? stops[i].mobile : stops[i].desktop);
  const weight = (i) => (typeof stops[i].weight === 'number' ? stops[i].weight : 1);

  function setImmediate(i) {
    const w = waypoint(i);
    rig.pos.set(...w.pos);
    rig.target.set(...w.look);
    camera.fov = w.fov;
    camera.updateProjectionMatrix();
  }

  function nearestStopIndex(progress) {
    const n = stops.length;
    return Math.max(0, Math.min(n - 1, Math.round(progress * (n - 1))));
  }

  function handleProgress(progress) {
    const i = nearestStopIndex(progress);
    if (i !== lastStop) {
      lastStop = i;
      onStop && onStop(i, stops[i]);
    }
    onNeedsRender && onNeedsRender();
  }

  function build() {
    setImmediate(0);

    if (timeline) timeline.kill();
    if (trigger) trigger.kill();

    timeline = gsap.timeline({ paused: true });

    let cursor = 0;
    for (let i = 1; i < stops.length; i++) {
      const w = waypoint(i);
      const d = weight(i);
      timeline.to(rig.pos, { x: w.pos[0], y: w.pos[1], z: w.pos[2], duration: d, ease: CONFIG.scroll.ease }, cursor);
      timeline.to(rig.target, { x: w.look[0], y: w.look[1], z: w.look[2], duration: d, ease: CONFIG.scroll.ease }, cursor);
      timeline.to(camera, {
        fov: w.fov, duration: d, ease: CONFIG.scroll.ease,
        onUpdate: () => camera.updateProjectionMatrix(),
      }, cursor);
      cursor += d;
    }

    trigger = ScrollTrigger.create({
      trigger: document.getElementById('spacer') || document.body,
      start: 'top top',
      end: 'bottom bottom',
      scrub: REDUCED ? true : CONFIG.scroll.scrub,
      animation: timeline,
      onUpdate: (self) => handleProgress(self.progress),
    });

    // Sync to however far the page is already scrolled (e.g. after reload).
    handleProgress(trigger.progress || 0);
  }

  // Scroll the page so stop i sits at the top of its range.
  function scrollToStop(i) {
    if (!trigger) return;
    const n = stops.length;
    const p = n > 1 ? i / (n - 1) : 0;
    const y = trigger.start + p * (trigger.end - trigger.start);
    window.scrollTo({ top: y, behavior: REDUCED ? 'auto' : 'smooth' });
  }

  function onPointerMove(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }
  if (!REDUCED) globalThis.addEventListener('pointermove', onPointerMove, { passive: true });

  // Compose the final pose and report whether anything changed.
  function update() {
    if (disposed) return false;

    const lerp = CONFIG.idle.parallaxLerp;
    par.x += ((REDUCED ? 0 : mouse.x) - par.x) * lerp;
    par.y += ((REDUCED ? 0 : mouse.y) - par.y) * lerp;

    _fwd.subVectors(rig.target, rig.pos).normalize();
    _right.crossVectors(_fwd, UP).normalize();
    _up.crossVectors(_right, _fwd).normalize();
    const s = CONFIG.idle.parallaxStrength;
    _off.copy(_right).multiplyScalar(par.x * s * 2).addScaledVector(_up, par.y * s);

    camera.position.copy(rig.pos).add(_off);
    camera.lookAt(rig.target);

    const changed =
      camera.position.distanceToSquared(prevPos) > 1e-10 ||
      rig.target.distanceToSquared(prevTarget) > 1e-10 ||
      Math.abs(camera.fov - prevFov) > 1e-6;

    if (changed) {
      prevPos.copy(camera.position);
      prevTarget.copy(rig.target);
      prevFov = camera.fov;
    }
    return changed;
  }

  function rebuild() {
    const nextPortrait = window.innerWidth < CONFIG.mobileWidth;
    if (nextPortrait === portrait && trigger) {
      ScrollTrigger.refresh();
      return;
    }
    portrait = nextPortrait;
    build();
  }

  function dispose() {
    disposed = true;
    globalThis.removeEventListener('pointermove', onPointerMove);
    if (timeline) timeline.kill();
    if (trigger) trigger.kill();
  }

  build();

  return { update, rebuild, dispose, scrollToStop, get rig() { return rig; }, get trigger() { return trigger; } };
}

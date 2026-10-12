import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from './config.js';

// ===========================================================================
// Free-look orbit (the default, "walk up to the desk" state).
//  * Damped OrbitControls around the desk centre, rotate + zoom, no pan.
//  * Distance / polar / azimuth limits so you can't get lost or see the empty
//    back of the scene; portrait overrides below the mobile breakpoint.
//  * A very slow auto-sway after some idle time that stops on any input.
// ===========================================================================
export function createControls({ camera, domElement, reduced, onChange }) {
  const O = CONFIG.orbit;

  const controls = new OrbitControls(camera, domElement);
  controls.target.set(...O.target);
  controls.enableDamping = true;
  controls.dampingFactor = O.damping;
  controls.rotateSpeed = O.rotateSpeed;
  controls.zoomSpeed = O.zoomSpeed;
  controls.enablePan = false;
  controls.autoRotateSpeed = O.autoRotateSpeed;
  controls.addEventListener('change', onChange);

  const DEG = Math.PI / 180;
  let free = false; // debug: unlimited orbiting

  function applyLimits() {
    const mobile = window.innerWidth < CONFIG.mobileWidth;
    const m = O.mobile || {};
    controls.minDistance = free ? 0.2 : (mobile && m.minDistance) || O.minDistance;
    controls.maxDistance = free ? 50 : (mobile && m.maxDistance) || O.maxDistance;
    controls.minPolarAngle = free ? 0 : O.minPolar;
    controls.maxPolarAngle = free ? Math.PI : O.maxPolar;
    const az = (!free && mobile && m.azimuth) || O.azimuth;
    controls.minAzimuthAngle = az[0] * DEG;
    controls.maxAzimuthAngle = az[1] * DEG;
  }
  applyLimits();

  // Idle auto-sway.
  let lastInput = performance.now();
  const markInput = () => { lastInput = performance.now(); controls.autoRotate = false; };
  domElement.addEventListener('pointerdown', markInput);
  domElement.addEventListener('wheel', markInput, { passive: true });
  domElement.addEventListener('touchstart', markInput, { passive: true });
  controls.addEventListener('start', markInput);

  function update(now) {
    if (!controls.enabled) { controls.autoRotate = false; return false; }
    controls.autoRotate = !reduced && (now - lastInput) > O.idleDelay * 1000;
    return controls.update();
  }

  return {
    controls,
    update,
    resize: applyLimits,
    markInput,
    setEnabled(v) { controls.enabled = !!v; if (!v) controls.autoRotate = false; },
    setFree(v) { free = !!v; applyLimits(); },
    // Snap the controls to the current camera pose (after a fly-in/out tween).
    sync(target) {
      if (target) controls.target.copy(target);
      controls.update();
    },
    save() {
      return { position: camera.position.clone(), target: controls.target.clone(), fov: camera.fov };
    },
    restore(state) {
      camera.position.copy(state.position);
      controls.target.copy(state.target);
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
      controls.update();
    },
    dispose() { controls.dispose(); },
  };
}

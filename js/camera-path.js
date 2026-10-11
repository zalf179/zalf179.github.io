import * as THREE from 'three';
import { CONFIG } from './config.js';

// Stage 1: static camera at the hero waypoint (scroll path arrives in stage 2).
export function createCameraPath({ camera, onDirty }) {
  const w = CONFIG.waypoints.desktop[0];
  const rig = {
    pos: new THREE.Vector3(...w.pos),
    target: new THREE.Vector3(...w.look),
  };

  camera.position.copy(rig.pos);
  camera.fov = w.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(rig.target);

  return {
    ready() {},
    update() {
      if (onDirty) onDirty();
    },
    rebuild() {},
    dispose() {},
    get rig() {
      return rig;
    },
  };
}
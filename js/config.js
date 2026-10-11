// ============================================================
// Central config for the 3D scroll portfolio.
// Everything you may want to hand-tune lives here.
// ============================================================
//
// WAYPOINTS
// ----------
// Each stop frames one monitor screen almost head-on. A waypoint is:
//   pos   : camera position  [x, y, z]   (world units, Y is up)
//   look  : lookAt target    [x, y, z]   (usually the screen centre)
//   fov   : vertical field of view in degrees
//   mesh  : the glTF screen mesh this stop shows content on
//
// They were derived as: pos = screenCentre + screenFaceNormal * distance,
// where distance is chosen so the screen fills ~66% of the viewport height
// (desktop) or ~78% of the width (mobile, wider fov, further back).
// Tweaks: increase `distance` (move pos away from `look`) to zoom out;
// smaller fov = more telephoto/flatter. Keep `look` on the screen centre.

export const CONFIG = {
  assets: {
    // Relative path so it works on https://zalf179.github.io/ and sub-paths.
    glb: 'scene.glb',
  },

  renderer: {
    antialias: true,
    pixelRatioCap: 1.5,
    toneMappingExposure: 1.05,
    clearColor: 0x07090d,
    // Soft shadows are OFF by default (see report). Flip to true to enable a
    // single 1024 shadow map from the key light.
    shadows: false,
    shadowMapSize: 1024,
  },

  // The glb ships with no lights, so we build a bright "window light" rig
  // matching the preview mood.
  lights: {
    hemisphere: { sky: 0xd7e3ff, ground: 0x2b2620, intensity: 1.15 },
    key: { color: 0xfff3e2, intensity: 2.1, position: [-2.0, 3.0, 1.6] },
    fill: { color: 0xa9c2ff, intensity: 0.35, position: [2.2, 1.1, 2.4] },
    shadowBounds: 3.0,
  },

  camera: { near: 0.02, far: 100 },

  // Subtle idle seasoning on top of the scrubbed path.
  idle: {
    parallaxStrength: 0.018,
    parallaxLerp: 0.05,
  },

  scroll: {
    scrub: 1, // kept for reference; the path now smooths via damped follow
    ease: 'power1.inOut',
    reducedTransition: 0.6, // seconds, used under prefers-reduced-motion
  },

  // ---------------- camera motion (scroll-driven, damped) ----------------
  // The path is one CatmullRomCurve3 for position and a separate one for the
  // lookAt target, both threaded through every stop. A single 0..1 progress
  // (from ScrollTrigger) samples both curves; an arc point is auto-inserted
  // between each pair of stops so the camera swings out and around the desk
  // instead of sliding straight sideways.
  motion: {
    curveType: 'centripetal', // CatmullRom type (tension only applies to 'catmullrom')
    curveTension: 0.5,        // used when curveType === 'catmullrom'

    // Auto-inserted mid-travel arc, in world units, relative to the segment
    // midpoint: pulled back along (midpoint - midpointLook) then raised.
    arcPullBack: 0.55,
    arcLift: 0.22,

    // Fraction of each stop's scroll range spent holding still at the monitor;
    // the rest is travel. Typing starts when the camera enters the hold.
    holdRatio: 0.38,

    // Frame-rate independent exponential damping lambdas (higher = snappier).
    positionLambda: 5.0,
    lookAtLambda: 3.2, // lower so the look direction trails the movement

    // FOV widens this many degrees at mid-travel, then returns to the stop fov.
    fovPullBack: 10,
    // Subtle roll (degrees) at mid-travel, returning to 0 at each stop.
    rollAmount: 1.2,

    // Ease to the nearest stop once the user stops scrolling.
    snapEnabled: true,
    snapDuration: 0.6,   // seconds for the snap tween
    snapEpsilon: 0.004,  // skip snap if already this close to a stop
    settleEpsilon: 0.0004, // distance to target() below which the loop idles
  },

  screens: {
    canvasWidth: 2048,
    canvasHeight: 1152,
    font: '"JetBrains Mono", ui-monospace, monospace',
    // milliseconds per typed character
    typeMs: 14,
    blinkMs: 530,
    colors: {
      bg: '#080d12',
      panel: '#0c141b',
      frame: '#16232c',
      fg: '#c9f5d6',
      green: '#39ff88',
      dim: '#2f8f57',
      comment: '#4b6b5a',
      accent: '#7ee787',
      warn: '#ffd479',
      link: '#66b8ff',
      red: '#ff6b6b',
    },
  },

  // Below this viewport width we use the portrait waypoints.
  mobileWidth: 768,

  // Scroll stops, in scroll order. 4 stops == 4 progress dots.
  stops: [
    {
      id: 'home',
      label: 'Home',
      mesh: 'Monitor_2_Screen_3_0', // centre desk monitor
      desktop: { pos: [-0.370, 0.940, -0.537], look: [-0.162, 0.940, -1.112], fov: 36 },
      mobile: { pos: [-0.672, 0.960, 0.298], look: [-0.162, 0.940, -1.112], fov: 42 },
    },
    {
      id: 'skills',
      label: 'Skills',
      mesh: 'Monitor_3_Screen_1_0', // left desk monitor (L-wing)
      desktop: { pos: [-0.594, 0.940, -0.678], look: [-1.150, 0.940, -0.935], fov: 36 },
      mobile: { pos: [0.216, 0.960, -0.305], look: [-1.150, 0.940, -0.935], fov: 42 },
    },
    {
      id: 'projects',
      label: 'Projects',
      mesh: 'Monitor_1_Screen_2_0', // right desk monitor
      desktop: { pos: [-0.738, 0.940, -0.585], look: [-0.738, 0.940, -1.196], fov: 36 },
      mobile: { pos: [-0.738, 0.960, 0.304], look: [-0.738, 0.940, -1.196], fov: 42 },
    },
    {
      id: 'contact',
      label: 'Contact',
      mesh: 'Tv_Tv1_0', // wall-mounted monitor (top right)
      desktop: { pos: [-0.180, 1.314, 0.082], look: [0.419, 1.408, -0.780], fov: 40 },
      mobile: { pos: [-0.950, 1.192, 1.188], look: [0.419, 1.408, -0.780], fov: 44 },
    },
  ],
};

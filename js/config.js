// ============================================================
// Central config for the pure-3D, scroll-driven portfolio.
// Everything you may want to hand-tune lives here.
// ============================================================
//
// COORDINATE SYSTEM
// -----------------
// World units are metres. Y is up. The model's decoded bounds are
//   min (-1.094, -0.034, -0.342)  max (1.040, 1.385, 1.399)
// The desk surface sits at y ~= 0.974 and the user/chair is at +Z,
// so the monitor faces -X/+Z (toward the seat).

// >>> CREDIT_TEXT placeholder — replace with Sketchfab "Copy Credits" text. <<<
export const CREDIT_TEXT =
  'This work is based on "Computer Desk" ' +
  '(https://sketchfab.com/3d-models/computer-desk-ff0674f66e11462e8b3417dee2b58ac9) ' +
  'by CR!STALLL (https://sketchfab.com/CR1STALLL) licensed under CC-BY-4.0 ' +
  '(http://creativecommons.org/licenses/by/4.0/). Model optimized/compressed by me. ' +
  'This work is based on "Tree Animate" ' +
  '(https://sketchfab.com/3d-models/tree-animate-f0f9eb5e6c104bbb8e1f41c97019e6f2) ' +
  'by RandyGF (https://sketchfab.com/RandyGF) licensed under CC-BY-4.0 ' +
  '(http://creativecommons.org/licenses/by/4.0/). ' +
  'This work is based on "Grass" ' +
  '(https://sketchfab.com/3d-models/grass-f2f2bddb2728483a9105c5f5114eb15e) ' +
  'by Cosmic_dust (https://sketchfab.com/Cosmic_dust) licensed under CC-BY-4.0 ' +
  '(http://creativecommons.org/licenses/by/4.0/).';

export const CONFIG = {
  assets: {
    // Repo-root file; relative path so it works on the github.io subpath.
    model: 'computer_desk-opt.glb',
    fieldGrass: 'assets/environment/grass/grass.glb',
    fieldTree: 'assets/environment/tree/tree.glb',
  },

  renderer: {
    antialias: true,
    pixelRatioCap: 1.5,
    toneMappingExposure: 1.05,
    // Transparent canvas lets the CSS sky gradient show through.
    clearColor: 0x05070a,
    clearAlpha: 0,
  },

  shadows: {
    enabled: true,
    mapSize: 2048,
    groundingMapSize: 1024,
    groundingColor: 0xffead7,
    groundingIntensity: 0.25,
    bias: -0.0005,
    normalBias: 0.02,
    radius: 3,
  },

  field: {
    groundColor: 0x648d3c,
    grassColors: [0x3e642e, 0x537d34, 0x769b43, 0x91a94d],
    skyColor: 0x9bcdf0,
    hazeColor: 0xc4dfeb,
    roughness: 0.96,
    size: 240,
    textureRepeat: 120,
    textureResolution: 512,
    bladesPerTexture: 5200,
    wavingGrass: {
      enabled: true,
      tuftCount: 30000,
      bladesPerTuft: 4,
      area: 24,
      heightMin: 0.1,
      heightMax: 0.27,
      widthMin: 0.004,
      widthMax: 0.009,
      windStrength: 0.055,
      windSpeed: 0.9,
      excludeDeskRadius: 1.5,
    },
    grassPatches: { count: 20, scale: 0.55, area: 24, excludeDeskRadius: 3.2 },
    trees: {
      scale: 0.016,
      animationSpeed: 0.25,
      // Keep the trees within the free-look area, but outside the monitor's
      // projected screen so they cannot cover its CSS3D content.
      placements: [[-4.8, -7.6], [-9, -0.3], [8.5, -6], [10, 7]],
    },
  },

  camera: {
    near: 0.02,
    far: 100,
    fov: 42,
  },

  // Image-based lighting (PMREM + RoomEnvironment) at low intensity so the
  // PBR materials get soft reflections without washing the dark mood out.
  env: {
    intensity: 0.58,
  },

  // Lights are entirely ours: the glb ships with none. Values are a starting
  // mood (warm desk lighting in a cool, open landscape).
  lights: {
    hemi: { sky: 0xb9ddf5, ground: 0x38512b, intensity: 0.42 },
    key: { color: 0xffe9cf, intensity: 2.4, position: [-2.1, 2.6, 2.2] },
    fill: { color: 0x9fc2ff, intensity: 0.14, position: [2.4, 1.2, 2.6] },
    // Faint cool rim from behind/above the chair so its silhouette reads
    // against the dark background without lifting the whole scene.
    rim: { color: 0x88b4ff, intensity: 0.5, position: [0.15, 2.3, 3.0], target: [0.0, 0.95, 0.72] },
    // Cool photons spilling off the monitor onto the desk/keyboard.
    screenSpill: { color: 0x63d0ff, intensity: 0.7, distance: 1.6 },
  },

  // Warm desk lamp. The emitter and aim values are world-space nudges from the
  // geometry-derived shade opening and its axis (use ?debug to tune them).
  lamp: {
    emitter: [0, 0, 0],
    aim: [0, 0, 0],
    emitterForward: 0.035,
    fallbackEmitter: [0.011, 1.3, -0.041],
    fallbackAim: [0.16, 0.974, 0.02],
    color: 0xffd9a0,
    intensity: 3.2,
    distance: 3.4,
    angle: 0.55,
    penumbra: 0.6,
    decay: 2.0,
    glowSize: 0.06,
    glowOpacity: 0.28,
    glowColor: 0xffd9a0,
    flicker: 0.025,
  },

  // Display quad in WORLD space. The 4 corners are the SOURCE OF TRUTH:
  // Monitor_Monitor_0 is a single mesh (frame+stand+display), and these were
  // extracted from its flat, front-facing 2-triangle panel. The right/up/
  // normal basis, width and height are DERIVED from the corners at runtime
  // (see js/screen.js), so editing corners is enough.
  //   bl (0.2919, 1.0316, -0.1265)  br (0.7830, 1.0316,  0.1077)
  //   tr (0.8011, 1.3781,  0.0696)  tl (0.3101, 1.3781, -0.1646)
  screen: {
    corners: {
      bl: [0.2919, 1.0316, -0.1265],
      br: [0.7830, 1.0316, 0.1077],
      tr: [0.8011, 1.3781, 0.0696],
      tl: [0.3101, 1.3781, -0.1646],
    },
    // Reference values (kept in sync with corners; used by lights/interaction).
    center: [0.5465, 1.2049, -0.0284],
    width: 0.5441,
    height: 0.3491,
    normal: [-0.42729, 0.12097, 0.89597],
    right: [0.90261, 0, 0.43044],
    up: [0.05214, 0.99267, -0.10916],
    // -------- calibration knobs (applied at startup; see ?debug / C key) ----
    // Trim this fraction off each side of the full quad so the displayed
    // content sits inside the glass only (the corners include the bezel).
    inset: { left: 0.01, right: 0.01, top: 0.02, bottom: 0.04 },
    // Nudge in world units along [right, up, normal] of the screen plane.
    offset: [0, 0, 0],
    // Uniform scale multiplier applied on top of (contentWidth / pageWidth).
    scale: 1,
    // Small local tilt of the object in degrees (yaw/pitch/roll).
    rotationOffset: { yaw: 0, pitch: 0, roll: 0 },
    // Depth-only "hole" plane pushed this far along the normal (no z-fight).
    holeOffset: 0.002,
    // CSS3D page resolution — matches the quad's 1.559:1 aspect, no letterbox.
    pageWidth: 1280,
    pageHeight: 821,
    // Debug-only: re-measure the mesh and warn if the hardcoded quad drifts.
    verifyInDebug: true,
  },

  environment: {
    fog: { near: 20, far: 70 },
    treeHeight: 5,
    treeCount: 12,
    treeSeed: 482731,
    treeRadiusMin: 6,
    treeRadiusMax: 18,
    treeClearRadius: 5,
    treeMinSeparation: 3,
    // Soft baked contact-shadow blobs that supplement the real-time shadows.
    contactShadow: { opacity: 0.24, y: 0.003 },
  },

  idle: {
    parallaxStrength: 0.02,
    parallaxLerp: 0.05,
    chairSwayDeg: 2.4,
    chairSwaySpeed: 0.32,
    dustCount: 90,
  },

  // ---------------------------------------------------------------
  // 3D model credit shown on the CONTACT screen.
  // >>> CREDIT_TEXT: replace the string below with the exact text from
  //     Sketchfab's "Copy Credits" for the "Computer Desk" model.
  // ---------------------------------------------------------------
  credit: {
    placeholder: true,
    text: CREDIT_TEXT,
  },

  // Below this viewport width we use the portrait waypoints.
  mobileWidth: 768,

  // ---------------- free-look orbit (default state) ----------------
  orbit: {
    target: [0.0, 0.85, 0.1],   // desk centre
    damping: 0.06,
    rotateSpeed: 0.6,
    zoomSpeed: 0.7,
    minDistance: 1.2,
    maxDistance: 3.5,
    minPolar: 0.35,             // never fully top-down
    maxPolar: 1.45,             // never below the floor
    azimuth: [-20, 95],         // degrees; front-left .. right side (no empty back)
    idleDelay: 4.0,             // seconds of stillness before the slow sway
    autoRotateSpeed: 0.35,
    // Portrait overrides (applied when the viewport is narrower than mobileWidth).
    mobile: { minDistance: 1.4, maxDistance: 4.4, azimuth: [-28, 105] },
    // The initial free-look framing (front-right 3/4 view).
    start: { position: [2.2, 1.55, 1.35] },
  },

  // ---------------- click the computer -> fly to the screen ----------------
  flyTo: {
    // Flight profile: a single eased progress drives position, rotation and
    // fov together (quadratic Bezier path for position, quaternion slerp for
    // rotation). duration = fly-in, exitDuration = fly-out.
    duration: 2.0,          // seconds, fly-in
    exitDuration: 1.3,      // seconds, fly-out / Esc-reverse
    // Bezier control point offsets from the path mid-point: pullBack backs the
    // curve away from the screen (-normal), lift lifts it above the desk.
    arcPullBack: 0.25,      // m
    arcLift: 0.2,           // m
    fovPullBack: 5,         // extra degrees of fov at mid-travel (arrival)
    screenFill: 0.8,        // target: screen height as fraction of viewport height
    fov: 34,                // narrower fov when focused on the screen
    hoverBoost: 0.5,        // extra emissive/glow while hovering the monitor
    clickSlopPx: 5,         // pointer travel beyond this cancels a click
  },
  idleSway: {
    lampFlicker: 0.05,          // fraction of desk-lamp intensity that wobbles
  },
};

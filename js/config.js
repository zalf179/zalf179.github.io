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
  'by CR!STALLL (https://sketchfab.com/CR1STALLL) and "simple pot and plant" ' +
  '(https://sketchfab.com/3d-models/simple-pot-and-plant-d489a069b49c4451a0fa17130fba4c28) ' +
  'by YouniqueĪdeaStudio licensed under CC-BY-4.0. Models optimized/compressed by me.';

// One place to tune optional features and device quality.
export const QUALITY = {
  mode: 'auto', // 'auto' | 'high' | 'low'
  deviceTier: 'auto', // resolved at runtime: 'auto' | 'low'
  pixelRatioCap: 2,
  mobilePixelRatioCap: 1.25,
  adaptiveTargetFps: 40,
};

export const FEATURES = {
  roomStoryProps: true,
  surfaceDetail: true,
  postProcessing: true,
  adaptiveQuality: true,
  ambientAudio: false,
  interactionAudio: true,
  chairSway: true,
  lightweightFallback: true,
};

export const CONFIG = {
  assets: {
    // Repo-root file; relative path so it works on the github.io subpath.
    model: 'computer_desk-opt.glb',
    plant: 'simple_pot_and_plant.glb',
  },

  renderer: {
    antialias: true,
    pixelRatioCap: QUALITY.pixelRatioCap,
    toneMappingExposure: 1.05,
    // Transparent canvas lets the CSS room-tone color show through.
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

  room: {
    floorColor: 0x241e1a,
    wallColor: 0x2b3644,
    backgroundColor: 0x10151c,
    floorRoughness: 0.9,
    wallRoughness: 1,
    floorSize: 40,
    wallWidth: 30,
    wallHeight: 14,
    wallZ: -2.85,
    sideWallX: 5,
    sideWallFrontZ: 12,
    sideWallDepth: 14.85,
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
  // mood ("a lit corner of a dark room").
  lights: {
    hemi: { sky: 0x9fb4d6, ground: 0x14100c, intensity: 0.2 },
    key: { color: 0xffe9cf, intensity: 2.4, position: [-2.1, 2.6, 2.2] },
    fill: { color: 0x9fc2ff, intensity: 0.14, position: [2.4, 1.2, 2.6] },
    // Faint cool rim from behind/above the chair so its silhouette reads
    // against the dark background without lifting the whole scene.
    rim: { color: 0x88b4ff, intensity: 0.5, position: [0.15, 2.3, 3.0], target: [0.0, 0.95, 0.72] },
    // Cool photons spilling off the monitor onto the desk/keyboard.
    screenSpill: { color: 0x63d0ff, intensity: 0.7, distance: 1.6 },
    windowFill: { color: 0x94c9ff, intensity: 0.48, distance: 7, position: [-4.25, 2.8, 0.15] },
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
  },

  coffee: {
    enabled: true,
    cupMesh: 'Cup_Cup_0',
    // Cup_Cup_0's local origin is slightly offset from its opening.
    openingCenter: [0, 0, -0.29],
    color: 0x392014,
    darkColor: 0x160b07,
    cremaColor: 0x8a5030,
    highlightColor: 0xf3c58b,
    creamColor: 0xf2dfc2,
    heartScale: 0.58,
    artGrooveStrength: 0.48,
    surfaceInset: 0.006,
    surfaceRadius: 0.026,
    textureStrength: 0.16,
    swirlSpeed: 0.12,
    steamColor: 0xfff0dc,
    steamOpacity: 0.18,
    steamHeight: 0.16,
    steamSpeed: 0.48,
  },

  plant: {
    position: [-0.84, 0.98, -0.12],
    scale: 2.2,
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
    fog: { near: 3.2, far: 10.5 },
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

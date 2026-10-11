// Central configuration for the 3D scroll experience.
// Tweak waypoints / magic numbers here without touching the render code.

// Waypoint format:
//   { id, section, pos:[x,y,z] (camera position), look:[x,y,z] (lookAt target),
//     fov (degrees), duration (1 = default, acts as a weight multiplier on the
//     measured height of the section you are scrolling *through*). }
//
// Scroll mapping is auto-aligned to the real page layout: the camera reaches a
// waypoint exactly when its section enters the viewport, because each segment's
// travel time is set from the measured height of the section being scrolled.
// Bump `duration` above 1 to linger longer on that object, or below 1 to speed
// the pass. Waypoints sharing the same target section split that section
// evenly (e.g. projects-left / projects-right share the #projects height).

export const CONFIG = {
  assets: {
    // Relative to the repo root. Must stay a relative path so the site works
    // on https://zalf179.github.io/ and on any sub-path.
    gltf: 'scene.gltf',
  },

  renderer: {
    pixelRatioCap: 2,
    shadowMapSize: 2048,
    toneMappingExposure: 1.1,
    clearColor: 0x0a0e14,
  },

  lights: {
    // No lights in the .gltf, so we build a soft "window light" rig matching
    // the preview mood (window sits on the -X wall, guitar/AC on that wall).
    hemisphere: { sky: 0xc7d4ff, ground: 0x1c2026, intensity: 0.55 },
    key: { color: 0xfff1dd, intensity: 1.7, position: [-2.2, 2.6, 1.4] },
    fill: { color: 0x4a8eff, intensity: 0.28, position: [1.8, 0.7, 2.2] },
    shadowBounds: 3.2, // ± bounds of the directional shadow camera (whole room)
  },

  camera: {
    near: 0.05,
    far: 100,
  },

  // Subtle idle motion. Keep small; this is seasoning, not the dish.
  idle: {
    parallaxStrength: 0.02, // world-space offset per unit of normalized mouse pos
    parallaxLerp: 0.045,    // exponential smoothing factor
    chairSwingDeg: 3.5,     // max chair y-rotation in degrees
    chairSwingSpeed: 0.55,  // radians / second component
    glowFlicker: 0.035,     // emissive intensity added to monitor screens
    glowFlickerSpeed: 1.4,
  },

  scroll: {
    scrub: 1,               // ScrollTrigger smoothing seconds
    ease: 'power1.inOut',
    reducedTransition: 0.7, // tween length under prefers-reduced-motion
  },

  // Mobile breakpoint for switching between portrait/portrait-style waypoints.
  mobileWidth: 768,

  // NOTE: "Monitor_2" is the centre desk monitor (indexed by part order, not
  // position). Skills -> Monitor_1. Projects panned across Monitor_3 -> Monitor_2.
  waypoints: {
    desktop: [
      {
        id: 'hero',
        section: '#home',
        pos: [2.0, 1.45, 2.0],
        look: [-0.15, 0.75, -0.15],
        fov: 38,
        duration: 1.0,
      },
      {
        id: 'skills',
        section: '#skills',
        pos: [-0.74, 0.98, 0.35],
        look: [-0.74, 0.97, -1.15],
        fov: 36,
        duration: 1.0,
      },
      {
        id: 'projects-left',
        section: '#projects',
        pos: [-1.14, 0.98, 0.15],
        look: [-1.15, 0.96, -0.85],
        fov: 32,
        duration: 0.9,
      },
      {
        id: 'projects-right',
        section: '#projects',
        pos: [-0.2, 0.98, 0.05],
        look: [-0.2, 0.96, -1.1],
        fov: 32,
        duration: 1.1,
      },
      {
        id: 'contact-chair',
        section: '#contact',
        pos: [0.95, 0.7, 0.85],
        look: [-0.3, 0.78, -0.23],
        fov: 32,
        duration: 1.0,
      },
      {
        id: 'contact-wide',
        section: '#contact',
        pos: [2.3, 1.05, 2.3],
        look: [-0.1, 0.6, -0.3],
        fov: 42,
        duration: 1.2,
      },
    ],

    // Portrait / narrow screens: push the camera further out with a wider fov
    // so each object stays framed above a bottom-anchored text card.
    mobile: [
      {
        id: 'hero',
        section: '#home',
        pos: [2.6, 1.6, 2.7],
        look: [-0.15, 0.8, -0.15],
        fov: 48,
        duration: 1.0,
      },
      {
        id: 'skills',
        section: '#skills',
        pos: [-0.74, 1.05, 0.75],
        look: [-0.74, 0.97, -1.15],
        fov: 42,
        duration: 1.0,
      },
      {
        id: 'projects-left',
        section: '#projects',
        pos: [-1.15, 1.05, 0.55],
        look: [-1.15, 0.95, -0.85],
        fov: 38,
        duration: 0.9,
      },
      {
        id: 'projects-right',
        section: '#projects',
        pos: [-0.2, 1.05, 0.5],
        look: [-0.2, 0.95, -1.1],
        fov: 38,
        duration: 1.1,
      },
      {
        id: 'contact-chair',
        section: '#contact',
        pos: [1.2, 0.85, 1.1],
        look: [-0.3, 0.78, -0.23],
        fov: 40,
        duration: 1.0,
      },
      {
        id: 'contact-wide',
        section: '#contact',
        pos: [2.9, 1.3, 2.9],
        look: [-0.1, 0.6, -0.3],
        fov: 52,
        duration: 1.2,
      },
    ],
  },
};
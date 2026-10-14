# Portfolio upgrade changelog

## Phase 1 — Lighting

- Kept the existing physically based renderer setup: ACES Filmic, sRGB output, 1.05 exposure, hemispheric/key/fill/rim lighting, a warm shadowed desk lamp, cool monitor spill, and tuned directional/spot shadow settings.
- Added a configurable cool point fill at the generated room window. Lamp flicker was removed in phase 6.
- No external lighting or post-processing package was added.

## Phase 2 — Materials and grounding

- Added small generated, repeatable grayscale detail textures for floor and walls, used as subtle bump and roughness maps.
- Added a very subtle woven bump detail and higher roughness to the GLB chair material.
- Retained the existing radial contact-shadow planes below the desk and chair. The source GLB contains no separate PC tower object; its computer is one desktop-computer mesh.

## Phase 3 — Room props

- Added low-poly procedural room details: rug, baseboard, cool window, geometric poster, shelf/books, desk plant, sticky notes, and a cable run.
- Existing model props (books, mug, stationery) and generated coffee/steam remain in place. New props use shared primitive geometry/material patterns and no downloaded assets.

## Phase 4 — Post-processing

- Added Three.js `EffectComposer`, `UnrealBloomPass`, and a small shader pass for subtle vignette, grain, and cool grading.
- `FEATURES.postProcessing` and `QUALITY.mode` can disable the effect; it is also disabled on low-tier devices. Grain is disabled for reduced-motion users.
- Depth of field was left out so the monitor remains sharp and the camera transition stays unchanged.

## Phase 5 — Performance and mobile

- Capped device pixel ratio at 2 on desktop and 1.25 on mobile; low-tier devices use a cap of 1.
- Added staged adaptive quality after three seconds below 40 rendered frames per second: disable shadows, disable post-processing, then lower pixel ratio.
- The animation frame loop now fully pauses while the document is hidden. Resize and orientation-change handling remain active.
- Shortened fly-in/out duration for reduced-motion users while preserving the existing path and easing.
- Weak devices reporting at most 1 GB device memory use the existing 2D accessibility portfolio view.
- The GLB is already Meshopt-compressed, quantized, and uses embedded WebP textures (glTF-Transform v4.5.1 metadata). Reproduction command matching those extensions:

  ```sh
  gltf-transform optimize computer_desk.glb computer_desk-opt.glb --compress meshopt --texture-compress webp
  ```

  This is a reproducible equivalent, not a recoverable historical shell invocation: the original source GLB and optimization script are not present, so I did not regenerate or replace the existing model. The command syntax is documented by [glTF Transform CLI](https://gltf-transform.dev/cli). KTX2/Basis conversion was not applied: it would require switching the runtime to `KTX2Loader` and shipping its transcoder assets; the current WebP GLB is only about 1.4 MB.

## Phase 6 — Audio and micro-interactions

- Added gentle chair sway (disabled for reduced-motion users) and emissive hover feedback for the clickable computer, monitor, and keyboard.
- Added synthesized, short UI tones with a visible mute/unmute control. Sound defaults to muted, starts only after a user gesture, and remembers the preference.
- Ambient room audio remains disabled (`FEATURES.ambientAudio: false`); no audio asset is required. Desk-lamp flicker is removed.

## Phase 7 — Accessibility and SEO

- Added Open Graph and Twitter card metadata and a 1200×630 social preview image (`preview.png`, editable source `preview.svg`).
- Added a keyboard focus target and label to the 3D canvas. The CSS3D monitor becomes available to assistive technology while zoomed in and is hidden from it outside the active monitor state.
- Added visible focus treatment to monitor controls, an accessible exit label on BACK, and focus return to the canvas after exiting. The existing hidden semantic portfolio content remains the no-WebGL fallback and crawler-readable page.

## Performance note

- Asset sizes in this checkout: `computer_desk-opt.glb` is 1,460,412 bytes (embedded textures included); `preview.png` is 129,124 bytes.
- Before/after FPS and draw-call counts were not captured: this environment has no browser/WebGL runtime. In a browser, append `?debug` to log FPS, draw calls, triangles, texture count, and geometry count. No numeric runtime improvement is claimed without that measurement.
- This is a static ES-module site with no package manifest or bundler, so each phase was checked with Node's ES-module syntax parser and `git diff --check`; a bundler build does not exist in the project.

## Configuration

`QUALITY` and `FEATURES` are at the top of `js/config.js`. Set `QUALITY.mode` to `high`, `low`, or `auto`, and toggle the feature flags there.

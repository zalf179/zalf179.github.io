import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FEATURES, QUALITY } from './config.js';

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.012 },
    uVignette: { value: 0.18 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uVignette;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float vignette = 1.0 - smoothstep(0.18, 0.92, length((vUv - 0.5) * vec2(1.0, 0.82)));
      float grain = (hash(vUv * 900.0 + uTime) - 0.5) * uGrain;
      color.rgb *= 1.0 - (1.0 - vignette) * uVignette;
      color.rgb += grain;
      color.rgb = mix(color.rgb, color.rgb * vec3(0.985, 1.0, 1.018), 0.18);
      gl_FragColor = color;
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

export function createPostProcessing(renderer, scene, camera) {
  if (!FEATURES.postProcessing || QUALITY.mode === 'low' || QUALITY.deviceTier === 'low') return null;
  const width = window.innerWidth || 1;
  const height = window.innerHeight || 1;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.24, 0.65, 0.88);
  composer.addPass(bloom);
  const finish = new ShaderPass(FinishShader);
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) finish.uniforms.uGrain.value = 0;
  composer.addPass(finish);

  let enabled = true;
  return {
    render(now) {
      if (!enabled) { renderer.render(scene, camera); return; }
      finish.uniforms.uTime.value = now * 0.001;
      composer.render();
    },
    resize(w, h) { composer.setSize(w, h); },
    setEnabled(value) { enabled = !!value; },
    setQuality(level) {
      bloom.strength = level === 'low' ? 0.12 : 0.24;
      finish.uniforms.uGrain.value = level === 'low' ? 0 : 0.012;
    },
    dispose() { composer.dispose(); },
  };
}

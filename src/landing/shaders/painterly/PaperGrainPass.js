// Paper grain multiply pass — adds subtle noise texture to simulate
// printed-on-paper feel. Grain is procedural (no texture load needed).

import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform float uStrength;    // 0.0 - 0.3
  uniform float uScale;       // grain scale, ~800
  uniform float uTime;

  varying vec2 vUv;

  // Hash-based noise (fast, no texture needed)
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec3 color = texture2D(tDiffuse, vUv).rgb;

    // Multi-octave grain
    float grain = noise(vUv * uScale);
    grain += noise(vUv * uScale * 2.0 + uTime * 0.01) * 0.5;
    grain = grain / 1.5;

    // Remap to center around 1.0 (multiply-neutral)
    grain = 1.0 - (grain - 0.5) * uStrength * 2.0;

    // Multiply blend — darkens in grain valleys, neutral on peaks
    color *= grain;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createPaperGrainMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      uStrength: { value: 0.08 },
      uScale: { value: 800.0 },
      uTime: { value: 0.0 },
    },
    vertexShader,
    fragmentShader,
  });
}

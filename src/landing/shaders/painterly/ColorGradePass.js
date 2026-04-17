// Warm color grade — shifts palette toward Moebius/Shinkai warm space.
// Lifts shadows into violet, warms midtones amber, cools highlights slightly.

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
  uniform float uStrength;     // 0.0 - 1.0, blend with original
  uniform vec3 uShadowTint;    // color to push shadows toward
  uniform vec3 uMidTint;       // color to push midtones toward
  uniform vec3 uHighTint;      // color to push highlights toward

  varying vec2 vUv;

  vec3 linearToSRGB(vec3 c) {
    return pow(c, vec3(1.0 / 2.2));
  }

  vec3 sRGBToLinear(vec3 c) {
    return pow(c, vec3(2.2));
  }

  void main() {
    vec3 color = texture2D(tDiffuse, vUv).rgb;

    // Luminance for zone mapping
    float lum = dot(color, vec3(0.299, 0.587, 0.114));

    // Three-zone color grade (shadow / mid / highlight)
    float shadowWeight = smoothstep(0.4, 0.0, lum);
    float highWeight   = smoothstep(0.6, 1.0, lum);
    float midWeight    = 1.0 - shadowWeight - highWeight;

    vec3 graded = color;
    graded = mix(graded, graded * uShadowTint, shadowWeight * 0.3);
    graded = mix(graded, graded * uMidTint,    midWeight    * 0.15);
    graded = mix(graded, graded * uHighTint,   highWeight   * 0.1);

    // Slight contrast boost
    graded = (graded - 0.5) * 1.08 + 0.5;

    // Slight saturation boost in warm tones
    float gray = dot(graded, vec3(0.299, 0.587, 0.114));
    graded = mix(vec3(gray), graded, 1.15);

    // Blend with original
    color = mix(color, graded, uStrength);

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

export function createColorGradeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      uStrength: { value: 0.7 },
      uShadowTint: { value: new THREE.Vector3(0.7, 0.5, 1.0) },   // violet shadows
      uMidTint:    { value: new THREE.Vector3(1.1, 0.95, 0.85) },  // warm amber mids
      uHighTint:   { value: new THREE.Vector3(0.95, 0.95, 1.05) }, // cool highlights
    },
    vertexShader,
    fragmentShader,
  });
}

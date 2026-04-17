// Nebula backdrop — large inverted sphere with noise-modulated radial gradients.
// Warm rose-amber gaseous clouds on deep violet-black space.
// Colors bleed like wet ink, not hard circles.

import React, { useMemo } from 'react';
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vPos;

  // Simplex-ish hash noise
  vec3 mod289v3(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289v4(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 perm(vec4 x) { return mod289v4(((x*34.0)+1.0)*x); }

  float noise3(vec3 p) {
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d*d*(3.0-2.0*d);
    vec4 b = a.xxyy + vec4(0.0,1.0,0.0,1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);
    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);
    vec4 o1 = fract(k3 * (1.0/41.0));
    vec4 o2 = fract(k4 * (1.0/41.0));
    vec4 o3 = o2*d.z + o1*(1.0-d.z);
    vec2 o4 = o3.yw*d.x + o3.xz*(1.0-d.x);
    return o4.y*d.y + o4.x*(1.0-d.y);
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 5; i++) {
      v += a * noise3(p);
      p = p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vPos);

    // Slowly drifting noise coordinates
    vec3 noiseCoord = dir * 2.5 + uTime * 0.008;
    float n1 = fbm(noiseCoord);
    float n2 = fbm(noiseCoord + vec3(5.2, 1.3, 2.8));
    float n3 = fbm(noiseCoord * 1.5 + vec3(1.7, 9.2, 3.4));

    // Base: deep violet-black space
    vec3 color = vec3(0.04, 0.03, 0.08);

    // Rose cloud band (upper region)
    float roseMask = smoothstep(0.2, 0.7, n1) * smoothstep(-0.2, 0.5, dir.y + n2 * 0.5);
    color = mix(color, vec3(0.30, 0.12, 0.25), roseMask * 0.6);

    // Amber glow (off-center, like a distant sun)
    float amberMask = smoothstep(0.3, 0.8, n2) * smoothstep(0.0, 0.6, 1.0 - length(dir.xz - vec2(0.3, -0.2)));
    color = mix(color, vec3(0.55, 0.25, 0.10), amberMask * 0.4);

    // Teal wisps (cool accent in the opposite direction)
    float tealMask = smoothstep(0.4, 0.9, n3) * smoothstep(-0.8, -0.1, dir.y);
    color = mix(color, vec3(0.10, 0.30, 0.30), tealMask * 0.3);

    // Bright star clusters (sharp high-frequency noise)
    float stars = smoothstep(0.92, 0.98, noise3(dir * 80.0));
    // Warm off-white stars, not pure white
    color += stars * vec3(0.95, 0.90, 0.80) * 0.8;

    // Faint scattered stars
    float faint = smoothstep(0.85, 0.95, noise3(dir * 40.0));
    color += faint * vec3(0.6, 0.5, 0.7) * 0.15;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function Nebula({ radius = 80 }) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  return (
    <mesh>
      <sphereGeometry args={[radius, 32, 32]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

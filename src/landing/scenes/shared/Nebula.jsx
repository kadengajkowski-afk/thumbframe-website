// Nebula backdrop — inverted sphere, fBm noise, painted space.
//
// Palette-configurable per spec §13. Each page's scene passes its own
// palette:
//   • Landing (/)   — purple   { #2a1850, #6a3880, #e8a8c0, #c86020 }
//   • Pricing       — teal     { #0f2a2e, #2a6670, #9ad0c0, #e8c050 }
//   • Features      — fire     { #0a0502, #c85020, #ffc850, #a850c8 }
// Defaults to the landing purple palette.
//
// Animation (active when `animate` is true):
//   • Slow internal brush drift — noise field translates on uTime axis
//   • Gentle brightness pulse — ±10% over ~4s period (spec §6)

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const NEBULA_PALETTES = {
  purple: {
    core:      '#2a1850',
    mid:       '#6a3880',
    highlight: '#e8a8c0',
    accent:    '#c86020',
  },
  teal: {
    core:      '#0f2a2e',
    mid:       '#2a6670',
    highlight: '#9ad0c0',
    accent:    '#e8c050',
  },
  fire: {
    core:      '#0a0502',
    mid:       '#c85020',
    highlight: '#ffc850',
    accent:    '#a850c8',
  },
};

const vertexShader = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// fBm shader — 3 overlapping masks painted on top of the core color:
//   mid       — large drifting cloud, strongest band
//   highlight — hot pocket in the upper field
//   accent    — sparse warm filaments (used sparingly, ~15%)
// A dense + faint star layer + a slow 4s brightness pulse finishes it.
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3  uCore;
  uniform vec3  uMid;
  uniform vec3  uHigh;
  uniform vec3  uAccent;
  uniform float uPulseAmp;
  varying vec3 vPos;

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
    float v = 0.0, a = 0.5;
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
    // Very slow internal drift — shifting the sample space gives the
    // impression of brush strokes migrating without tearing the masks apart.
    vec3 drift = vec3(uTime * 0.010, uTime * 0.006, uTime * 0.008);
    vec3 nc = dir * 2.5 + drift;

    float n1 = fbm(nc);
    float n2 = fbm(nc + vec3(5.2, 1.3, 2.8));
    float n3 = fbm(nc * 1.5 + vec3(1.7, 9.2, 3.4));

    vec3 color = uCore;

    // Spec §53: "Mix between tones using smoothed noise thresholds."
    // Three masks, each gated by an independent fBm channel. Pockets,
    // not broad washes — the warm wash experiment from 91fea9a
    // overshot the spec.

    // Rose-violet mid tone — broad, upper-hemisphere-biased.
    float midMask = smoothstep(0.2, 0.7, n1)
                  * smoothstep(-0.2, 0.5, dir.y + n2 * 0.5);
    color = mix(color, uMid, midMask * 0.70);

    // Dusty rose highlight — a hot pocket in the upper-right area.
    float highMask = smoothstep(0.3, 0.8, n2)
                   * smoothstep(0.0, 0.6, 1.0 - length(dir.xz - vec2(0.3, -0.2)));
    color = mix(color, uHigh, highMask * 0.50);

    // Amber accent — distinct pockets, noise-gated, gentle lower bias.
    float accentMask = smoothstep(0.50, 0.90, n3)
                     * smoothstep(0.30, -0.30, dir.y);
    color = mix(color, uAccent, accentMask * 0.40);

    // Dense bright stars
    float stars = smoothstep(0.92, 0.98, noise3(dir * 80.0));
    color += stars * vec3(0.95, 0.90, 0.80) * 0.8;

    // Faint haze stars
    float faint = smoothstep(0.85, 0.95, noise3(dir * 40.0));
    color += faint * vec3(0.6, 0.5, 0.7) * 0.15;

    // Global brightness pulse — ±uPulseAmp on a 4s period (ω = 2π/4 ≈ 1.5708).
    float pulse = 1.0 + uPulseAmp * sin(uTime * 1.5708);
    color *= pulse;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function toColor(hex) {
  return new THREE.Color(hex);
}

export default function Nebula({
  radius = 50,
  palette = NEBULA_PALETTES.purple,
  animate = true,
  pulseAmplitude = 0.10,
}) {
  const matRef = useRef();

  const uniforms = useMemo(() => ({
    uTime:     { value: 0 },
    uCore:     { value: toColor(palette.core) },
    uMid:      { value: toColor(palette.mid) },
    uHigh:     { value: toColor(palette.highlight) },
    uAccent:   { value: toColor(palette.accent) },
    uPulseAmp: { value: pulseAmplitude },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [palette.core, palette.mid, palette.highlight, palette.accent, pulseAmplitude]);

  useFrame(({ clock }) => {
    if (!animate || !matRef.current) return;
    matRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh renderOrder={-10}>
      <sphereGeometry args={[radius, 32, 32]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

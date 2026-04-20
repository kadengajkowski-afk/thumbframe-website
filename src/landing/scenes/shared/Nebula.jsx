// Nebula backdrop — inverted sphere, domain-warped fBm, sumi-e ink-wash feel.
//
// Palette-configurable per spec §13. Each page's scene passes its own
// palette:
//   • Landing (/)   — purple   { #4a2e6b, #6a3880, #e8a8c0, #c86020 }
//   • Pricing       — teal     { #0f2a2e, #2a6670, #9ad0c0, #e8c050 }
//   • Features      — fire     { #0a0502, #c85020, #ffc850, #a850c8 }
// Defaults to the landing purple palette.
//
// Rendering character:
//   • Domain-warped fBm — a slower large-scale flow field warps the
//     base sample position, so clouds bloom and drift like ink in
//     water rather than feeling static / isotropic.
//   • Ink-rim edge darkening — high noise-gradient regions pull toward
//     core × 0.6, giving the wet-edge pooling look of ink wash.
//   • Two-sine breathing pulse (0.25 + 0.17 rad/s, amplitudes 0.10 +
//     0.05) — non-repeating soft brightness modulation.

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const NEBULA_PALETTES = {
  purple: {
    // colorCore lifted from #2a1850 → #4a2e6b so the dark floor no
    // longer eats the middle of the frame. Mid/high/accent unchanged.
    core:      '#4a2e6b',
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
  varying vec3 vWorldPos;
  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3  uCore;
  uniform vec3  uMid;
  uniform vec3  uHigh;
  uniform vec3  uAccent;
  varying vec3  vWorldPos;

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

  // fBm — 5 octaves, lacunarity 2.0, gain 0.5. At the low base
  // frequency below, a 6th octave starts adding fine noise that
  // hurts the soft large-cloud read.
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
    // Flow field — large-scale warp at 0.05 frequency matches the
    // scale of the cloud cells below. Three fbm channels so each
    // axis drifts on its own clock.
    vec3 flow = vec3(
      fbm(vWorldPos * 0.05 + vec3(uTime * 0.03, 0.0, 0.0)),
      fbm(vWorldPos * 0.05 + vec3(0.0, uTime * 0.04, 0.0)),
      fbm(vWorldPos * 0.05 + vec3(0.0, 0.0, uTime * 0.02))
    );
    // Warp amplitude 2.5 — broader warp at this larger scale keeps
    // the motion readable without tearing the cloud masses apart.
    vec3 warpedPos = vWorldPos + (flow - 0.5) * 2.5;

    // Base frequency 0.08 (down from 0.35). 3-5 large distinct
    // cloud regions across the frame, soft gradient transitions.
    float n         = fbm(warpedPos * 0.08 + vec3(uTime * 0.02));
    float amberMask = fbm(warpedPos * 0.12 + vec3(47.3, 18.9, 93.1));

    vec3 colorCore   = uCore;
    vec3 colorMid    = uMid;
    vec3 colorHigh   = uHigh;
    vec3 colorAccent = uAccent;

    // Palette distribution — smoothstep bands lowered so colorMid
    // takes over earlier and less of the frame sits in colorCore.
    vec3 color = mix(colorCore, colorMid, smoothstep(0.15, 0.45, n));
    // colorHigh (dusty rose) — threshold lifted further 0.60→0.68,
    // weight 0.45→0.35 so pale-pink retreats from the right side
    // to target ~10-15% frame coverage.
    color = mix(color, colorHigh, smoothstep(0.68, 0.88, n) * 0.35);

    // Amber pockets — reuse warpedPos so the amber flows with the
    // main ink field instead of drifting on its own clock. Threshold
    // lifted 0.55→0.62, weight 0.4→0.35 so amber sits near the
    // target ~20% coverage and violets dominate.
    color = mix(color, colorAccent, smoothstep(0.62, 0.88, amberMask) * 0.35);

    // Ink-rim edge darkening — softened at the new scale. Rim
    // detection smoothstep widened (0.5-1.2) so it triggers less
    // often, and mix weight dropped 0.35 → 0.15 so cloud
    // boundaries read as gradient transitions, not outlined rims.
    // Epsilon samples use the same 0.08 base frequency as the main n.
    float eps = 0.02;
    float nx = fbm(warpedPos * 0.08 + vec3(eps, 0.0, 0.0));
    float ny = fbm(warpedPos * 0.08 + vec3(0.0, eps, 0.0));
    float gradMag = length(vec2(nx - n, ny - n)) / eps;
    float inkRim = smoothstep(0.5, 1.2, gradMag);
    color = mix(color, colorCore * 0.6, inkRim * 0.15);

    // Dense bright stars
    vec3 dir = normalize(vWorldPos);
    float stars = smoothstep(0.92, 0.98, noise3(dir * 80.0));
    color += stars * vec3(0.95, 0.90, 0.80) * 0.8;

    // Faint haze stars
    float faint = smoothstep(0.85, 0.95, noise3(dir * 40.0));
    color += faint * vec3(0.6, 0.5, 0.7) * 0.15;

    // Two-sine breathing — amplitudes 0.10 + 0.05 at different
    // periods so the pulse never visibly loops.
    float brightness = 1.0
                     + sin(uTime * 0.25) * 0.10
                     + sin(uTime * 0.17 + 1.3) * 0.05;
    color *= brightness;

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
}) {
  const matRef = useRef();

  const uniforms = useMemo(() => ({
    uTime:   { value: 0 },
    uCore:   { value: toColor(palette.core) },
    uMid:    { value: toColor(palette.mid) },
    uHigh:   { value: toColor(palette.highlight) },
    uAccent: { value: toColor(palette.accent) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [palette.core, palette.mid, palette.highlight, palette.accent]);

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

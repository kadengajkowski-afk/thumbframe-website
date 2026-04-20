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

// Cycle palettes — when <Nebula cycle /> is set, the shader's color
// uniforms lerp through these in order, looping back to purple. The
// ship reads as traveling through different galaxies.
export const NEBULA_CYCLE_PALETTES = [
  // noiseScale = inverse feature-size multiplier — bigger value → bigger features.
  // octaves    = fBm depth (3..6).  turbulence = warp amplitude (0.5 = baseline).
  { core: '#2a1850', mid: '#6a3880', highlight: '#e8a8c0', accent: '#c86020',
    noiseScale: 1.0, octaves: 5, turbulence: 0.5 }, // purple — dense, swirling
  { core: '#0a2a1a', mid: '#3a7050', highlight: '#a0d8b0', accent: '#e8c050',
    noiseScale: 1.4, octaves: 4, turbulence: 0.3 }, // green — looser, open clouds
  { core: '#0a1a3a', mid: '#3050a0', highlight: '#a0c0e8', accent: '#e87050',
    noiseScale: 0.7, octaves: 6, turbulence: 0.7 }, // blue — tight, chaotic
  { core: '#2a0a08', mid: '#c85020', highlight: '#ffb870', accent: '#50a0c8',
    noiseScale: 1.8, octaves: 3, turbulence: 0.8 }, // orange — big sweeping, volcanic
];

const CYCLE_HOLD_S       = 35;
const CYCLE_TRANSITION_S = 40;
const CYCLE_SEGMENT_S    = CYCLE_HOLD_S + CYCLE_TRANSITION_S;             // 75
const CYCLE_TOTAL_S      = CYCLE_SEGMENT_S * NEBULA_CYCLE_PALETTES.length; // 300 (5 min)

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
  uniform vec3  uCoreNext;
  uniform vec3  uMidNext;
  uniform vec3  uHighNext;
  uniform vec3  uAccentNext;
  uniform float uNoiseScale;
  uniform float uOctaves;
  uniform float uTurbulence;
  uniform float uNoiseScaleNext;
  uniform float uOctavesNext;
  uniform float uTurbulenceNext;
  uniform vec2  uResolution;
  uniform float uTransition; // 0 outside transition window, 0..1 across the sweep
  uniform float uTimeScale;  // multiplier on time fed to noise — slow auth pages, fast landing
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

  // fBm — up to 6 octaves with per-octave alpha so callers can pass
  // a fractional octave count. Lacunarity 2.0, gain 0.5. Per-palette
  // octaves drive how much fine structure the cloud field carries.
  float fbm(vec3 p, float oct) {
    float v = 0.0, a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 6; i++) {
      float w = clamp(oct - float(i), 0.0, 1.0);
      v += a * w * noise3(p);
      p = p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  // Per-palette nebula composition — full color contribution for one
  // palette's params. Called twice per pixel; the spatial sweep mask
  // mixes the two results so each side of the screen carries its own
  // brushstroke structure during transitions.
  vec3 composeNebula(vec3 wp, float t, float ns, float oct, float turb,
                     vec3 core, vec3 mid, vec3 high, vec3 accent) {
    // Position multiplier is 1/ns so larger noiseScale = bigger features.
    float baseFreq = 0.05 / ns;
    float mainFreq = 0.08 / ns;
    float amberFreq = 0.12 / ns;

    vec3 flow = vec3(
      fbm(wp * baseFreq + vec3(t * 0.09, 0.0, 0.0), oct),
      fbm(wp * baseFreq + vec3(0.0, t * 0.12, 0.0), oct),
      fbm(wp * baseFreq + vec3(0.0, 0.0, t * 0.06), oct)
    );
    // Warp amplitude scales with turbulence (0.5 = current 2.5 baseline).
    vec3 warpedPos = wp + (flow - 0.5) * 5.0 * turb;

    float n         = fbm(warpedPos * mainFreq + vec3(t * 0.06), oct);
    float amberMask = fbm(warpedPos * amberFreq + vec3(47.3, 18.9, 93.1), oct);

    vec3 c = mix(core, mid, smoothstep(0.15, 0.45, n));
    c = mix(c, high, smoothstep(0.50, 0.75, n) * 0.6);
    c = mix(c, accent, smoothstep(0.4, 0.75, amberMask) * 0.6);

    // Ink-rim edge darkening — per-palette since gradient depends on params.
    float eps = 0.02;
    float nx = fbm(warpedPos * mainFreq + vec3(eps, 0.0, 0.0), oct);
    float ny = fbm(warpedPos * mainFreq + vec3(0.0, eps, 0.0), oct);
    float gradMag = length(vec2(nx - n, ny - n)) / eps;
    float inkRim = smoothstep(0.5, 1.2, gradMag);
    c = mix(c, core * 0.6, inkRim * 0.15);
    return c;
  }

  void main() {
    float st = uTime * uTimeScale;
    // Compose each palette's full nebula — colors AND structural
    // params (noiseScale / octaves / turbulence) — independently,
    // then mix spatially via the right→left sweep mask.
    vec3 colorA = composeNebula(vWorldPos, st,
      uNoiseScale,     uOctaves,     uTurbulence,
      uCore,     uMid,     uHigh,     uAccent);
    vec3 colorB = composeNebula(vWorldPos, st,
      uNoiseScaleNext, uOctavesNext, uTurbulenceNext,
      uCoreNext, uMidNext, uHighNext, uAccentNext);

    // Sweep boundary: at uTransition=0 → x=1.1 (off-screen right);
    // at uTransition=1 → x=-0.1 (off-screen left). 0.2-wide feather
    // (~20% of viewport width) for soft edge, not a hard line.
    vec2  screenUv  = gl_FragCoord.xy / uResolution;
    float boundaryX = 1.1 - uTransition * 1.2;
    float sweep     = smoothstep(boundaryX - 0.1, boundaryX + 0.1, screenUv.x);
    vec3  color     = mix(colorA, colorB, sweep);

    // Dense bright stars (palette-independent)
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

// Mobile or reduced-motion users get one random palette on mount and
// no cycling — saves battery on phones and respects accessibility.
function shouldFreezePalette() {
  if (typeof window === 'undefined') return true;
  const mm = window.matchMedia;
  if (mm && mm('(prefers-reduced-motion: reduce)').matches) return true;
  if (mm && mm('(hover: none)').matches) return true;
  if (window.innerWidth < 768) return true;
  return false;
}

const CYCLE_PALETTE_COLORS = NEBULA_CYCLE_PALETTES.map((p) => ({
  core:       new THREE.Color(p.core),
  mid:        new THREE.Color(p.mid),
  highlight:  new THREE.Color(p.highlight),
  accent:     new THREE.Color(p.accent),
  noiseScale: p.noiseScale,
  octaves:    p.octaves,
  turbulence: p.turbulence,
}));

// Defaults for non-cycling callers (NebulaTest, future per-page palettes).
const DEFAULT_PATTERN = { noiseScale: 1.0, octaves: 5, turbulence: 0.5 };

export default function Nebula({
  radius = 50,
  palette = NEBULA_PALETTES.purple,
  animate = true,
  cycle = false,
  driftSpeed = 1.0,
}) {
  const matRef = useRef();

  const cycleConfig = useMemo(() => {
    if (!cycle) return null;
    const frozen = shouldFreezePalette();
    const startIdx = frozen
      ? Math.floor(Math.random() * NEBULA_CYCLE_PALETTES.length)
      : 0;
    return { frozen, startIdx };
  }, [cycle]);

  const activePalette = cycle
    ? NEBULA_CYCLE_PALETTES[cycleConfig.startIdx]
    : palette;

  const activePattern = {
    noiseScale: activePalette.noiseScale ?? DEFAULT_PATTERN.noiseScale,
    octaves:    activePalette.octaves    ?? DEFAULT_PATTERN.octaves,
    turbulence: activePalette.turbulence ?? DEFAULT_PATTERN.turbulence,
  };

  const uniforms = useMemo(() => ({
    uTime:            { value: 0 },
    uCore:            { value: toColor(activePalette.core) },
    uMid:             { value: toColor(activePalette.mid) },
    uHigh:            { value: toColor(activePalette.highlight) },
    uAccent:          { value: toColor(activePalette.accent) },
    uCoreNext:        { value: toColor(activePalette.core) },
    uMidNext:         { value: toColor(activePalette.mid) },
    uHighNext:        { value: toColor(activePalette.highlight) },
    uAccentNext:      { value: toColor(activePalette.accent) },
    uNoiseScale:      { value: activePattern.noiseScale },
    uOctaves:         { value: activePattern.octaves },
    uTurbulence:      { value: activePattern.turbulence },
    uNoiseScaleNext:  { value: activePattern.noiseScale },
    uOctavesNext:     { value: activePattern.octaves },
    uTurbulenceNext:  { value: activePattern.turbulence },
    uResolution:      { value: new THREE.Vector2(1, 1) },
    uTransition:      { value: 0 },
    uTimeScale:       { value: driftSpeed },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [activePalette.core, activePalette.mid, activePalette.highlight, activePalette.accent]);

  useFrame(({ clock, gl }) => {
    if (!animate || !matRef.current) return;
    const t = clock.elapsedTime;
    const u = matRef.current.uniforms;
    u.uTime.value = t;
    u.uTimeScale.value = driftSpeed;
    gl.getDrawingBufferSize(u.uResolution.value);

    if (!cycle || cycleConfig.frozen) return;

    const cycleT  = t % CYCLE_TOTAL_S;
    const segIdx  = Math.floor(cycleT / CYCLE_SEGMENT_S);
    const segT    = cycleT - segIdx * CYCLE_SEGMENT_S;
    const nextIdx = (segIdx + 1) % NEBULA_CYCLE_PALETTES.length;
    const a = CYCLE_PALETTE_COLORS[segIdx];
    const b = CYCLE_PALETTE_COLORS[nextIdx];

    u.uCore.value.copy(a.core);
    u.uMid.value.copy(a.mid);
    u.uHigh.value.copy(a.highlight);
    u.uAccent.value.copy(a.accent);
    u.uCoreNext.value.copy(b.core);
    u.uMidNext.value.copy(b.mid);
    u.uHighNext.value.copy(b.highlight);
    u.uAccentNext.value.copy(b.accent);

    u.uNoiseScale.value     = a.noiseScale;
    u.uOctaves.value        = a.octaves;
    u.uTurbulence.value     = a.turbulence;
    u.uNoiseScaleNext.value = b.noiseScale;
    u.uOctavesNext.value    = b.octaves;
    u.uTurbulenceNext.value = b.turbulence;

    u.uTransition.value = segT < CYCLE_HOLD_S
      ? 0
      : (segT - CYCLE_HOLD_S) / CYCLE_TRANSITION_S;
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

// SettingsScene — deep-space starfield + aurora tendrils for /settings.
//
// Layering (back to front, enforced via renderOrder):
//   1. Nebula sphere     — barely visible, pure dark atmospheric depth.
//   2. DeepStarfield     — dense white points, fixed, independent twinkle.
//   3. AuroraTendrils    — 5 wispy flowing ribbons, additive, morphing.
//   4. ShootingStars     — rare painterly streaks.
//   5. PainterlyPost     — Kuwahara/grain/grade, unchanged.

import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Nebula from './shared/Nebula';
import ShootingStars from './shared/ShootingStars';
import PainterlyPost from '../shaders/painterly/PainterlyPost';

const POST_DISABLED = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('raw') === '1';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

// Near-black base — all color comes from the aurora layer above.
const SETTINGS_PALETTE = {
  core:       '#020210',
  mid:        '#050515',
  highlight:  '#0a0a1a',
  accent:     '#0a0a1a',
  noiseScale: 1.5,
  octaves:    3,
  turbulence: 0.2,
};

// ── DeepStarfield (unchanged from previous revision) ─────────────────────────
const STAR_SPREAD_XY = 36;
const STAR_SPREAD_Z  = 20;

function generateStars(count) {
  const pos    = new Float32Array(count * 3);
  const size   = new Float32Array(count);
  const phase  = new Float32Array(count);
  const freq   = new Float32Array(count);
  const color  = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * STAR_SPREAD_XY;
    pos[i * 3 + 1] = (Math.random() - 0.5) * STAR_SPREAD_XY;
    pos[i * 3 + 2] = (Math.random() - 0.5) * STAR_SPREAD_Z;

    const r = Math.random();
    if (r < 0.90)       size[i] = 0.8 + Math.random() * 0.4;
    else if (r < 0.98)  size[i] = 1.5 + Math.random() * 0.5;
    else                size[i] = 2.5 + Math.random() * 0.5;

    phase[i] = Math.random() * Math.PI * 2;
    const period = 2 + Math.random() * 4;
    freq[i] = (Math.PI * 2) / period;

    const warmRoll = Math.random();
    if (r >= 0.98 && warmRoll < 0.5) {
      color[i * 3] = 1.00; color[i * 3 + 1] = 0.92; color[i * 3 + 2] = 0.78;
    } else {
      const warm = Math.random() < 0.2;
      color[i * 3] = 1.00;
      color[i * 3 + 1] = warm ? 0.97 : 1.00;
      color[i * 3 + 2] = warm ? 0.94 : 1.00;
    }
  }
  return { pos, size, phase, freq, color };
}

function DeepStarfield({ count }) {
  const { pos, size, phase, freq, color } = useMemo(() => generateStars(count), [count]);

  const vertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aPhase;
    attribute float aFreq;
    attribute vec3  aColor;
    uniform float uTime;
    varying float vAlpha;
    varying vec3  vColor;
    void main() {
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      float t = sin(uTime * aFreq + aPhase) * 0.3 + 0.7;
      vAlpha = clamp(t, 0.4, 1.0);
      vColor = aColor;
      gl_PointSize = clamp(aSize * 2.2, 2.0, 7.0);
      gl_Position = projectionMatrix * mvPos;
    }
  `;
  const fragmentShader = /* glsl */ `
    varying float vAlpha;
    varying vec3  vColor;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float core = smoothstep(0.5, 0.15, d);
      gl_FragColor = vec4(vColor, core * vAlpha);
    }
  `;
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ clock }) => { uniforms.uTime.value = clock.elapsedTime; });

  return (
    <points frustumCulled={false} renderOrder={0}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={pos}   count={count} itemSize={3} />
        <bufferAttribute attach="attributes-aSize"    array={size}  count={count} itemSize={1} />
        <bufferAttribute attach="attributes-aPhase"   array={phase} count={count} itemSize={1} />
        <bufferAttribute attach="attributes-aFreq"    array={freq}  count={count} itemSize={1} />
        <bufferAttribute attach="attributes-aColor"   array={color} count={count} itemSize={3} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ── Aurora tendril ───────────────────────────────────────────────────────────
//
// Implementation: a long thin plane (length × thickness world units) with
// many x-segments. The vertex shader displaces each vertex's y-position
// using summed 1-D noise keyed on (x, time) — this is what makes the
// ribbon curl and morph organically. The fragment shader paints a bright
// core fading to a soft outer glow, with end-fade on U so ribbon ends
// don't pop in/out when the mesh wraps across the viewport.
//
// Each tendril slowly drifts horizontally across the scene. When it
// travels past the wrap threshold it jumps back to the other edge —
// the fragment's end-fade hides the discontinuity.

const AURORA_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uPhase;
  uniform float uWaveAmp;
  varying vec2 vUv;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float noise1(float x) {
    float i = floor(x);
    float f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(hash(i), hash(i + 1.0), f);
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Summed octaves of 1-D noise along the ribbon length, time-varying.
    float n1 = noise1(pos.x * 0.45 + uTime * uSpeed + uPhase);
    float n2 = noise1(pos.x * 1.10 + uTime * uSpeed * 0.70 + uPhase * 1.7);
    float n3 = noise1(pos.x * 2.30 + uTime * uSpeed * 0.45 + uPhase * 0.5);
    float disp = (n1 - 0.5) * 1.0 + (n2 - 0.5) * 0.45 + (n3 - 0.5) * 0.22;

    // Push every vertex up/down by the same noise value — the whole cross
    // section shifts together, so the ribbon keeps its thickness while it
    // curls. Scaled by uWaveAmp so each tendril can be more/less sinuous.
    pos.y += disp * uWaveAmp;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const AURORA_FRAG = /* glsl */ `
  uniform vec3  uColor;
  uniform float uOpacity;
  varying vec2  vUv;

  void main() {
    // Ribbon cross-section: bright core + soft outer glow.
    float dy   = abs(vUv.y - 0.5);
    float core = 1.0 - smoothstep(0.08, 0.32, dy);
    float glow = 1.0 - smoothstep(0.15, 0.50, dy);

    // End fade on U — ribbon starts/ends translucent so wrap is invisible.
    float endFade = smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x));

    float alpha = (core * 0.9 + glow * 0.35) * endFade * uOpacity;
    vec3 color  = uColor * (0.75 + core * 0.5);

    gl_FragColor = vec4(color, alpha);
  }
`;

function AuroraTendril({
  color,
  center,        // [x, y, z] world position midpoint
  rotation = [0, 0, 0],
  length = 8,
  thickness = 1.2,
  waveSpeed = 0.25,
  waveAmp = 1.6,
  waveOffset = 0,
  driftSpeed = 0.18,   // world units per second
  driftRange = 18,     // total horizontal sweep before wrap
  opacity = 0.72,
  startOffset = 0,     // 0..1 — where in its drift cycle it starts
}) {
  const meshRef = useRef();

  const uniforms = useMemo(() => ({
    uTime:     { value: 0 },
    uSpeed:    { value: waveSpeed },
    uPhase:    { value: waveOffset },
    uWaveAmp:  { value: waveAmp },
    uColor:    { value: new THREE.Color(color) },
    uOpacity:  { value: opacity },
  }), [color, opacity, waveSpeed, waveAmp, waveOffset]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    uniforms.uTime.value = t;

    if (meshRef.current) {
      // Horizontal drift with wrap. The end-fade in the fragment shader
      // hides the discontinuity at wrap-around.
      const period = driftRange / Math.max(driftSpeed, 0.001);
      const phaseT = ((t / period) + startOffset) % 1.0;
      const offset = phaseT * driftRange - driftRange / 2;
      meshRef.current.position.x = center[0] + offset;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={center}
      rotation={rotation}
      renderOrder={2}
      frustumCulled={false}
    >
      <planeGeometry args={[length, thickness, 96, 4]} />
      <shaderMaterial
        vertexShader={AURORA_VERT}
        fragmentShader={AURORA_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── Aurora config — 5 tendrils, weighted color palette ───────────────────────
//
// Emerald 40%, violet 30%, pink 15%, cyan 15%. Tendrils spread across the
// upper 60% of the viewport, at mixed angles and depths. Speeds and wave
// params vary so motion feels staggered and natural.
const AURORA_TENDRILS = [
  {
    color: '#3afa9a',         // emerald
    center: [0, 2.6, -1],
    rotation: [0, 0, 0.10],
    length: 10, thickness: 1.4,
    waveSpeed: 0.22, waveAmp: 1.8, waveOffset: 0.0,
    driftSpeed: 0.30, driftRange: 20,
    opacity: 0.75, startOffset: 0.00,
  },
  {
    color: '#3afa9a',         // emerald #2
    center: [0, 1.4, 0.5],
    rotation: [0, 0, -0.22],
    length: 8.5, thickness: 1.1,
    waveSpeed: 0.19, waveAmp: 1.5, waveOffset: 1.8,
    driftSpeed: 0.24, driftRange: 18,
    opacity: 0.68, startOffset: 0.35,
  },
  {
    color: '#9060e0',         // violet
    center: [0, 3.1, -0.5],
    rotation: [0, 0, 0.45],   // more diagonal
    length: 7.5, thickness: 1.0,
    waveSpeed: 0.17, waveAmp: 2.0, waveOffset: 3.2,
    driftSpeed: 0.20, driftRange: 18,
    opacity: 0.70, startOffset: 0.60,
  },
  {
    color: '#f890c8',         // soft pink
    center: [0, 0.4, 1.0],
    rotation: [0, 0, -0.08],
    length: 9, thickness: 0.9,
    waveSpeed: 0.25, waveAmp: 1.3, waveOffset: 5.1,
    driftSpeed: 0.28, driftRange: 19,
    opacity: 0.62, startOffset: 0.15,
  },
  {
    color: '#5ad0d8',         // cyan
    center: [0, 2.0, -1.5],
    rotation: [0, 0, 0.28],
    length: 8, thickness: 1.2,
    waveSpeed: 0.20, waveAmp: 1.7, waveOffset: 2.4,
    driftSpeed: 0.22, driftRange: 18,
    opacity: 0.65, startOffset: 0.75,
  },
];

function AuroraField() {
  return (
    <group>
      {AURORA_TENDRILS.map((cfg, i) => (
        <AuroraTendril key={i} {...cfg} />
      ))}
    </group>
  );
}

// ── Scene graph ───────────────────────────────────────────────────────────────
function SceneGraph() {
  return (
    <>
      {/* Barely-visible near-black nebula — atmospheric depth only. */}
      <Nebula palette={SETTINGS_PALETTE} driftSpeed={0.07} />

      {/* Stars: behind aurora. */}
      <DeepStarfield count={isMobile ? 1400 : 1800} />

      {/* Aurora: on top of stars, behind shooting stars. */}
      <AuroraField />

      {/* Shooting stars at [20, 40]s cycle — unchanged. */}
      <ShootingStars singleRange={[20, 40]} />

      <ambientLight color="#0a0e20" intensity={0.2} />
      <directionalLight color="#3a4068" position={[3, 2, 4]} intensity={0.15} />

      {!POST_DISABLED && <PainterlyPost />}
    </>
  );
}

export default function SettingsScene() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: '#020308',
      }}
    >
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 200, position: [0, 0, 9] }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SceneGraph />
        </Suspense>
      </Canvas>
    </div>
  );
}

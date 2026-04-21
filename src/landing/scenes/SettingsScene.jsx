// SettingsScene — deep-space starfield for /settings.
//
// Aesthetic contrast vs. other pages: near-black nebula, very sparing
// color, dense starfield as the focal visual. Rare shooting stars.
// No ship, no planet, no fireworks.

import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Nebula from './shared/Nebula';
import ShootingStars from './shared/ShootingStars';
import PainterlyPost from '../shaders/painterly/PainterlyPost';

const POST_DISABLED = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('raw') === '1';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

// Dark, minimal nebula — the color hints are whispers, not statements.
const SETTINGS_PALETTE = {
  core:       '#030515',
  mid:        '#0a1028',
  highlight:  '#1a2048',
  accent:     '#2a2060',
  noiseScale: 1.5,
  octaves:    3,
  turbulence: 0.2,
};

// ── Dense starfield (inline — doesn't modify the shared Stardust) ────────────
//
// Tiered size distribution: 60% tiny pinpricks, 30% small twinkles, 10%
// brighter stars. Per-star color attribute: mostly warm white, occasional
// blue-white, pale amber, and rare deep red. Independent twinkle phase
// per star gives an organic shimmer.

const STAR_COLORS = [
  { color: [1.00, 0.96, 0.88], weight: 70 }, // warm white (#fff4e0)
  { color: [0.78, 0.88, 1.00], weight: 18 }, // blue-white (#c8e0ff)
  { color: [1.00, 0.91, 0.75], weight: 10 }, // pale amber (#ffe8c0)
  { color: [0.97, 0.69, 0.63], weight:  2 }, // deep red (#f8b0a0)
];

function pickColor() {
  const total = STAR_COLORS.reduce((s, c) => s + c.weight, 0);
  let r = Math.random() * total;
  for (const entry of STAR_COLORS) {
    r -= entry.weight;
    if (r <= 0) return entry.color;
  }
  return STAR_COLORS[0].color;
}

function pickSize() {
  const r = Math.random();
  if (r < 0.60) return 0.3 + Math.random() * 0.3;   // tiny pinpricks
  if (r < 0.90) return 0.7 + Math.random() * 0.5;   // small twinkles
  return 1.4 + Math.random() * 1.0;                  // brighter stars
}

const SPREAD = 30;

function DeepStarfield({ count = 1000 }) {
  const pointsRef = useRef();

  const { positions, sizes, phases, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const ph = new Float32Array(count);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * SPREAD;
      pos[i * 3 + 1] = (Math.random() - 0.5) * SPREAD;
      pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
      sz[i] = pickSize();
      ph[i] = Math.random() * Math.PI * 2;
      const [r, g, b] = pickColor();
      col[i * 3]     = r;
      col[i * 3 + 1] = g;
      col[i * 3 + 2] = b;
    }
    return { positions: pos, sizes: sz, phases: ph, colors: col };
  }, [count]);

  const vertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aPhase;
    attribute vec3  aColor;
    uniform float uTime;
    varying float vAlpha;
    varying vec3  vColor;

    void main() {
      // Very slight GPU-only drift — keeps the field alive without scroll.
      vec3 driftPos = position;
      driftPos.y += sin(uTime * 0.18 + aPhase) * 0.20;
      driftPos.x += cos(uTime * 0.13 + aPhase * 1.3) * 0.12;

      vec4 mvPos = modelViewMatrix * vec4(driftPos, 1.0);

      // Independent twinkle per star — amplitude scales with size so
      // bright stars pulse more, tiny pinpricks barely shimmer.
      float twinkle = sin(uTime * 0.9 + aPhase) * (0.20 + aSize * 0.15) + 0.75;
      vAlpha = twinkle * (0.30 + aSize * 0.30);
      vColor = aColor;

      gl_PointSize = clamp(aSize, 1.0, 3.5);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    varying float vAlpha;
    varying vec3  vColor;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float alpha = smoothstep(0.5, 0.1, d) * vAlpha;
      gl_FragColor = vec4(vColor, alpha);
    }
  `;

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
        <bufferAttribute attach="attributes-aSize"    array={sizes}     count={count} itemSize={1} />
        <bufferAttribute attach="attributes-aPhase"   array={phases}    count={count} itemSize={1} />
        <bufferAttribute attach="attributes-aColor"   array={colors}    count={count} itemSize={3} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ── Scene graph ───────────────────────────────────────────────────────────────
function SceneGraph() {
  return (
    <>
      {/* Dark, very slow nebula — mostly negative space behind the stars. */}
      <Nebula palette={SETTINGS_PALETTE} driftSpeed={0.08} />

      {/* Dense starfield — the visual focal point. */}
      <DeepStarfield count={isMobile ? 800 : 1100} />

      {/* Slightly more frequent than auth (20-40s vs 30-60s). */}
      <ShootingStars singleRange={[20, 40]} />

      {/* Minimal lighting — keeps the scene feeling like deep space. */}
      <ambientLight color="#0a0e20" intensity={0.25} />
      <directionalLight color="#4a5080" position={[3, 2, 4]} intensity={0.2} />

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

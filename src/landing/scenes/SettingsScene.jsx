// SettingsScene — deep-space starfield for /settings.
//
// Aesthetic: near-black nebula, dense white starfield as the dominant
// visual, rare painterly shooting stars. No ship, no planet.
//
// Kuwahara note — the painterly post-process uses a 2-6px minimum kernel
// at half composer resolution. Stars must have enough rasterised footprint
// to survive that averaging or they smear into the background. The inline
// DeepStarfield below oversizes the point quad (smoothstep keeps the
// visible core pinprick-small) so even the smallest tier punches through.

import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Nebula from './shared/Nebula';
import ShootingStars from './shared/ShootingStars';
import PainterlyPost from '../shaders/painterly/PainterlyPost';

const POST_DISABLED = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('raw') === '1';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

const SETTINGS_PALETTE = {
  core:       '#030515',
  mid:        '#0a1028',
  highlight:  '#1a2048',
  accent:     '#2a2060',
  noiseScale: 1.5,
  octaves:    3,
  turbulence: 0.2,
};

// ── DeepStarfield (inline — doesn't modify shared Stardust) ──────────────────
//
// Distribution per spec:
//   • 90% tiny white pinpricks
//   •  8% slightly larger white twinkles
//   •  2% bright (occasional warm tint)
//
// Independent twinkle per star — random frequency in [2s, 6s] period. No
// drift; stars stay fixed. Additive blending + pure-white color + oversized
// point quads keep them visible through PainterlyPost.

const SPREAD_XY = 36;
const SPREAD_Z  = 20;

function generateStars(count) {
  const pos    = new Float32Array(count * 3);
  const size   = new Float32Array(count);
  const phase  = new Float32Array(count);
  const freq   = new Float32Array(count);
  const color  = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * SPREAD_XY;
    pos[i * 3 + 1] = (Math.random() - 0.5) * SPREAD_XY;
    pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_Z;

    const r = Math.random();
    if (r < 0.90) {
      // Tiny pinprick — 0.8-1.2 visual size tier
      size[i] = 0.8 + Math.random() * 0.4;
    } else if (r < 0.98) {
      // Small twinkle
      size[i] = 1.5 + Math.random() * 0.5;
    } else {
      // Bright star
      size[i] = 2.5 + Math.random() * 0.5;
    }

    phase[i] = Math.random() * Math.PI * 2;
    // Period 2-6s → angular frequency 2π/T
    const period = 2 + Math.random() * 4;
    freq[i] = (Math.PI * 2) / period;

    // 98% white/near-white, 2% warm tint (only on the bright tier)
    const warmRoll = Math.random();
    if (r >= 0.98 && warmRoll < 0.5) {
      color[i * 3]     = 1.00;
      color[i * 3 + 1] = 0.92;
      color[i * 3 + 2] = 0.78; // pale amber
    } else {
      // Pure white or warm-white
      const warm = Math.random() < 0.2;
      color[i * 3]     = 1.00;
      color[i * 3 + 1] = warm ? 0.97 : 1.00;
      color[i * 3 + 2] = warm ? 0.94 : 1.00;
    }
  }
  return { pos, size, phase, freq, color };
}

function DeepStarfield({ count }) {
  const pointsRef = useRef();

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

      // Independent twinkle — period 2-6s per star (via aFreq).
      // Oscillates opacity between 0.4 and 1.0.
      float t = sin(uTime * aFreq + aPhase) * 0.3 + 0.7;
      vAlpha = clamp(t, 0.4, 1.0);
      vColor = aColor;

      // Oversize the rasterised quad so small stars have enough pixel
      // footprint to survive the Kuwahara post-process. The smoothstep
      // falloff in the fragment shader keeps the visible core tight.
      gl_PointSize = clamp(aSize * 2.2, 2.0, 7.0);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    varying float vAlpha;
    varying vec3  vColor;
    void main() {
      // Sharper falloff than default — keeps the pinprick read
      // crisp while the full quad gives Kuwahara something to latch.
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float core = smoothstep(0.5, 0.15, d);
      gl_FragColor = vec4(vColor, core * vAlpha);
    }
  `;

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
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

// ── Scene graph ───────────────────────────────────────────────────────────────
function SceneGraph() {
  return (
    <>
      {/* Very slow, very dark nebula — atmosphere only. */}
      <Nebula palette={SETTINGS_PALETTE} driftSpeed={0.08} />

      {/* Dense starfield — the dominant visual. */}
      <DeepStarfield count={isMobile ? 1400 : 1800} />

      {/* Rare painterly shooting stars (20-40s cycle). */}
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

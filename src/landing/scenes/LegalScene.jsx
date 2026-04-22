// LegalScene — teal/aqua dark-space backdrop for legal & info pages
// (/terms, /privacy, /refund, /changelog).
//
// Structure mirrors AuroraScene: a near-black nebula with a dense white
// starfield as the dominant visual, plus rare shooting stars. Only the
// nebula palette changes — cool teal undertones with a soft aqua accent
// instead of the warm-cream tint used on the account area.

import React, { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Nebula from './shared/Nebula';
import ShootingStars from './shared/ShootingStars';
import PainterlyPost from '../shaders/painterly/PainterlyPost';

const POST_DISABLED = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('raw') === '1';

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

// Default palette — teal/aqua. Each page can pass its own palette prop
// to LegalScene to render a distinct backdrop while sharing all other
// scene structure (starfield, shooting stars, painterly pipeline).
const DEFAULT_PALETTE = {
  core:      '#020812',
  mid:       '#0a2438',
  highlight: '#2a6878',
  accent:    '#80c0c8',
};
const NEBULA_PARAMS = {
  noiseScale: 1.3,
  octaves:    isMobile ? 2 : 3,
  turbulence: 0.3,
};

// ── DeepStarfield (inline — mirrors AuroraScene's tiered-size variant) ───────
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
    if (r < 0.90)      size[i] = 0.8 + Math.random() * 0.4;   // tiny
    else if (r < 0.98) size[i] = 1.5 + Math.random() * 0.5;   // small
    else               size[i] = 2.5 + Math.random() * 0.5;   // bright

    phase[i] = Math.random() * Math.PI * 2;
    const period = 2 + Math.random() * 4;
    freq[i] = (Math.PI * 2) / period;

    // 98% warm-white, 2% cool-blue tint on the bright tier for variety
    if (r >= 0.98 && Math.random() < 0.5) {
      color[i * 3] = 0.82; color[i * 3 + 1] = 0.94; color[i * 3 + 2] = 1.00;
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

function SceneGraph({ palette }) {
  const nebulaPalette = { ...palette, ...NEBULA_PARAMS };
  return (
    <>
      <Nebula palette={nebulaPalette} driftSpeed={0.08} />
      <DeepStarfield count={isMobile ? 1200 : 1700} />
      <ShootingStars singleRange={[30, 60]} />

      <ambientLight color="#0a1a28" intensity={0.22} />
      <directionalLight color="#3a7888" position={[3, 2, 4]} intensity={0.18} />

      {!POST_DISABLED && <PainterlyPost />}
    </>
  );
}

export default function LegalScene({ palette }) {
  const resolved = { ...DEFAULT_PALETTE, ...(palette || {}) };
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: resolved.core,
      }}
    >
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 200, position: [0, 0, 9] }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SceneGraph palette={resolved} />
        </Suspense>
      </Canvas>
    </div>
  );
}

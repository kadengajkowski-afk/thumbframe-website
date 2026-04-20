// Stardust — ~300 billboard motes with per-particle twinkle.
// Drift is computed in the vertex shader (sin-based oscillation around the
// spawn position) so there's no per-frame JS loop or buffer re-upload.
//
// aSize is raw pixel scale (not world units) so points render as sharp
// pinpricks. Perspective distance scaling is dropped — if point size
// fell off with depth, Kuwahara's minimum-kernel pass would smear the
// far dim ones into gray watercolor blobs instead of pinpricks.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 300;
const SPREAD = 30;

export default function Stardust() {
  const pointsRef = useRef();

  const { positions, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const sz = new Float32Array(PARTICLE_COUNT);
    const ph = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * SPREAD;
      pos[i * 3 + 1] = (Math.random() - 0.5) * SPREAD;
      pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
      sz[i] = 0.5 + Math.random() * 1.0;  // raw pixel scale, clamped 1..3 in the shader
      ph[i] = Math.random() * Math.PI * 2;
    }
    return { positions: pos, sizes: sz, phases: ph };
  }, []);

  const vertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aPhase;
    uniform float uTime;
    varying float vAlpha;

    void main() {
      // Oscillatory vertical drift — bounded, no integration, entirely GPU.
      vec3 driftPos = position;
      driftPos.y += sin(uTime * 0.22 + aPhase) * 0.35;
      driftPos.x += cos(uTime * 0.17 + aPhase * 1.3) * 0.18;

      vec4 mvPos = modelViewMatrix * vec4(driftPos, 1.0);
      float twinkle = sin(uTime * 0.8 + aPhase) * 0.3 + 0.7;
      // Brightness varies with size so larger points read as slightly
      // brighter stars; no perspective falloff so Kuwahara doesn't
      // smear far points into blobs.
      vAlpha = twinkle * (0.35 + aSize * 0.25);
      gl_PointSize = clamp(aSize, 1.0, 3.0);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float alpha = smoothstep(0.5, 0.1, d) * vAlpha;
      // Warm off-white
      gl_FragColor = vec4(0.94, 0.88, 0.82, alpha);
    }
  `;

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={PARTICLE_COUNT} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" array={sizes} count={PARTICLE_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aPhase" array={phases} count={PARTICLE_COUNT} itemSize={1} />
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

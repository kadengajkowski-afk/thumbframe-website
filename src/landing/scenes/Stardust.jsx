// Stardust — ~300 billboard motes drifting slowly with per-particle twinkle.
// Occasional cosmic ray streak every 8-12s.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 300;
const SPREAD = 30;

export default function Stardust() {
  const pointsRef = useRef();
  const phasesRef = useRef();

  const { positions, sizes, phases } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const sz = new Float32Array(PARTICLE_COUNT);
    const ph = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * SPREAD;
      pos[i * 3 + 1] = (Math.random() - 0.5) * SPREAD;
      pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
      sz[i] = 0.03 + Math.random() * 0.06;
      ph[i] = Math.random() * Math.PI * 2;
    }
    return { positions: pos, sizes: sz, phases: ph };
  }, []);

  phasesRef.current = phases;

  const vertexShader = /* glsl */ `
    attribute float aSize;
    attribute float aPhase;
    uniform float uTime;
    varying float vAlpha;

    void main() {
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      float twinkle = sin(uTime * 0.8 + aPhase) * 0.3 + 0.7;
      vAlpha = twinkle * (0.3 + aSize * 5.0);
      gl_PointSize = aSize * 300.0 / -mvPos.z;
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
    if (uniforms.uTime) uniforms.uTime.value = clock.elapsedTime;

    // Slow drift
    if (pointsRef.current) {
      const posAttr = pointsRef.current.geometry.attributes.position;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        posAttr.array[i * 3 + 1] += 0.001 * Math.sin(clock.elapsedTime * 0.2 + phases[i]);
      }
      posAttr.needsUpdate = true;
    }
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

// Scene 1 — Arrival (scroll 0.0 – 1.0)
// Deep nebula, space station (right of center for overlay text), stardust,
// distant planet silhouette with nebula color pickup.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import * as THREE from 'three';
import SpaceStation from './SpaceStation';
import Stardust from './Stardust';

// Distant planet — subtle rim light + nebula color pickup, not a black void
const distantPlanetVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalMatrix * normal;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const distantPlanetFrag = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 lightDir = normalize(vec3(1.0, 0.5, 0.3));
    float NdotL = max(dot(n, lightDir), 0.0);

    // Base: very dark violet, not black
    vec3 color = vec3(0.08, 0.05, 0.12);

    // Faint lit side from the nebula's amber glow
    color += vec3(0.15, 0.08, 0.05) * NdotL * 0.5;

    // Rim light — nebula scatter
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    color += vec3(0.20, 0.12, 0.25) * rim * 0.6;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function DistantPlanet() {
  const uniforms = useMemo(() => ({}), []);
  return (
    <mesh position={[18, -4, -45]}>
      <sphereGeometry args={[5, 24, 24]} />
      <shaderMaterial
        vertexShader={distantPlanetVert}
        fragmentShader={distantPlanetFrag}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export default function Arrival() {
  const groupRef = useRef();
  const scroll = useScroll();

  useFrame(({ clock, camera }) => {
    const t = scroll.offset;
    const sceneProgress = Math.min(t / (1 / 7), 1);

    // Camera start: z=12, closer than before so station detail is visible.
    // Station is right-of-center at x=2, so camera starts offset left
    // to frame station on the right ~65% of viewport.
    const startZ = 12;
    const endZ = 2;
    const z = THREE.MathUtils.lerp(startZ, endZ, sceneProgress * sceneProgress);

    // Breathing drift
    const drift = Math.sin(clock.elapsedTime * 0.3) * 0.2;
    const driftY = Math.sin(clock.elapsedTime * 0.2 + 1.0) * 0.1;

    // Camera offset left so station reads at ~68% horizontal
    camera.position.set(-2.0 + drift, driftY + 0.3, z);

    // Look: starts at station (x=3), gradually pans toward distant planet
    const lookX = THREE.MathUtils.lerp(3, 6, sceneProgress);
    const lookY = THREE.MathUtils.lerp(0, -0.8, sceneProgress);
    const lookZ = THREE.MathUtils.lerp(0, -12, sceneProgress);
    camera.lookAt(lookX, lookY, lookZ);
  });

  return (
    <group ref={groupRef}>
      {/* Station at ~68% horizontal, scaled 2.5x for visible architecture */}
      <SpaceStation position={[3, 0, 0]} scale={2.5} />

      <DistantPlanet />
      <Stardust />

      {/* Lighting */}
      <directionalLight position={[5, 4, 3]} intensity={0.9} color="#f0c080" />
      <ambientLight intensity={0.35} color="#8060a0" />
      <directionalLight position={[-3, 1, -5]} intensity={0.15} color="#6040a0" />
    </group>
  );
}

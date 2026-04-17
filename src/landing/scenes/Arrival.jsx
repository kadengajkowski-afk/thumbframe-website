// Scene 1 — Arrival (scroll 0.0 – 1.0)
// Deep nebula, space station, stardust, distant planet silhouette.
// Camera: static with subtle drift → forward creep → oriented toward Scene 2.

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import * as THREE from 'three';
import SpaceStation from './SpaceStation';
import Stardust from './Stardust';

// Distant planet silhouette (Scene 2 teaser)
function DistantPlanet() {
  return (
    <mesh position={[15, -3, -40]}>
      <sphereGeometry args={[4, 16, 16]} />
      <meshBasicMaterial color="#1a1030" />
    </mesh>
  );
}

export default function Arrival() {
  const groupRef = useRef();
  const scroll = useScroll();

  useFrame(({ clock, camera }) => {
    const t = scroll.offset; // 0-1 across all pages
    const sceneProgress = Math.min(t / (1 / 7), 1); // 0-1 within Scene 1 (first of 7 pages)

    // Camera choreography for Scene 1:
    // 0.0: positioned at z=15, facing station, subtle drift
    // 0.5: forward creep begins
    // 1.0: pulled past station at z=3, angled toward distant planet

    const startZ = 15;
    const endZ = 3;
    const z = THREE.MathUtils.lerp(startZ, endZ, sceneProgress * sceneProgress); // ease-in

    // Subtle drift — breathing motion
    const drift = Math.sin(clock.elapsedTime * 0.3) * 0.3;
    const driftY = Math.sin(clock.elapsedTime * 0.2 + 1.0) * 0.15;

    camera.position.set(drift, driftY + 0.5, z);

    // Look direction: starts at station, gradually pans toward distant planet
    const lookX = THREE.MathUtils.lerp(0, 3, sceneProgress);
    const lookY = THREE.MathUtils.lerp(0, -0.5, sceneProgress);
    const lookZ = THREE.MathUtils.lerp(0, -10, sceneProgress);
    camera.lookAt(lookX, lookY, lookZ);
  });

  return (
    <group ref={groupRef}>
      {/* Space station — centered, slowly rotating */}
      <SpaceStation position={[0, 0, 0]} scale={1.2} />

      {/* Distant planet silhouette — Scene 2 teaser */}
      <DistantPlanet />

      {/* Stardust particles throughout the scene */}
      <Stardust />

      {/* Warm amber key light from upper-right */}
      <directionalLight position={[5, 4, 3]} intensity={0.8} color="#f0c080" />
      {/* Violet ambient fill */}
      <ambientLight intensity={0.3} color="#8060a0" />
      {/* Faint back light for depth */}
      <directionalLight position={[-3, 1, -5]} intensity={0.15} color="#6040a0" />
    </group>
  );
}

// Generic galaxy-planet wrapper — positions a child mesh in world space,
// listens for pointer events to trigger goToPlanet, and applies a subtle
// hover emissive boost via an ambient light that activates only when
// hoveredPlanet === id.
//
// Each planet id (signal / dead / singularity / docking / science) mounts
// a specific child component inside this wrapper. For Step 2 placeholders
// are sphere meshes; real assets replace them in Step 5.

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGalaxyStore } from '../state/galaxyStore';

export default function GalaxyPlanet({ id, position, radius = 2.0, children }) {
  const groupRef = useRef();
  const goToPlanet = useGalaxyStore((s) => s.goToPlanet);
  const setHovered = useGalaxyStore((s) => s.setHovered);

  // Subtle hover "lift" — scale bump + breathing on hover.
  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const hovered = useGalaxyStore.getState().hoveredPlanet === id;
    const targetScale = hovered ? 1.08 : 1.0;
    const s = g.scale.x + (targetScale - g.scale.x) * 0.12;
    g.scale.setScalar(s);
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(id);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        if (useGalaxyStore.getState().hoveredPlanet === id) {
          setHovered(null);
          document.body.style.cursor = '';
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        goToPlanet(id);
      }}
    >
      {children}
      {/* Invisible slightly-larger sphere as a raycast target — keeps
          clicks reliable even when the visible mesh has irregular
          geometry (broken artifacts, thin tunnels, etc). */}
      <mesh visible={false}>
        <sphereGeometry args={[radius * 1.15, 16, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

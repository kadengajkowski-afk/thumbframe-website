// Planet 4 — The Docking Station. Procedural station geometry per user's
// §10 answer (not the pirate-planet texture).
//
// Composition: a long cylindrical hull with a ring hangar, three forward
// spires, two side stabilizers, a few lit windows. Evokes a commerce
// station without mimicking any specific reference. Warm-amber accents
// for "this is where the money happens."
//
// Kept intentionally small (overall bounding ~3 × 2 × 2) so at galaxy
// distance it reads as a silhouette, not a detailed model. Detail ramps
// up visually when the camera docks (Step 5).

import React from 'react';

const HULL = '#4a4050';
const HULL_LIGHT = '#6c6278';
const ACCENT_AMBER = '#ffb06a';
const AMBER_GLOW = '#f0a040';
const VIOLET_RIM = '#6a3878';

export default function Planet4DockingMesh() {
  return (
    <group rotation={[0.08, 0.4, 0]}>
      {/* Main hull — long cylinder running along local Z axis. */}
      <mesh>
        <cylinderGeometry args={[0.55, 0.55, 2.6, 20]} />
        <meshStandardMaterial color={HULL} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Central ring hangar — torus wrapping the hull. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.95, 0.14, 12, 32]} />
        <meshStandardMaterial color={HULL_LIGHT} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Accent ring glow — thin amber band on the hangar. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.98, 0.03, 8, 48]} />
        <meshBasicMaterial color={ACCENT_AMBER} toneMapped={false} />
      </mesh>
      {/* Forward nose — tapered cone. */}
      <mesh position={[0, 1.55, 0]}>
        <coneGeometry args={[0.38, 0.8, 14]} />
        <meshStandardMaterial color={HULL_LIGHT} roughness={0.65} metalness={0.25} />
      </mesh>
      {/* Forward antenna spire — tiny amber tip. */}
      <mesh position={[0, 2.0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
        <meshBasicMaterial color={ACCENT_AMBER} toneMapped={false} />
      </mesh>
      {/* Aft engine block. */}
      <mesh position={[0, -1.45, 0]}>
        <cylinderGeometry args={[0.48, 0.62, 0.5, 14]} />
        <meshStandardMaterial color={HULL} roughness={0.75} metalness={0.3} />
      </mesh>
      {/* Engine glow disc. */}
      <mesh position={[0, -1.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 20]} />
        <meshBasicMaterial color={AMBER_GLOW} toneMapped={false} />
      </mesh>
      {/* Two lateral stabilizers — flat fin boxes. */}
      <mesh position={[0.85, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.04, 0.6, 0.9]} />
        <meshStandardMaterial color={HULL} roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[-0.85, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.04, 0.6, 0.9]} />
        <meshStandardMaterial color={HULL} roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Window strip along the hull. */}
      {[-0.8, -0.4, 0.0, 0.4, 0.8].map((y, i) => (
        <mesh key={i} position={[0.56, y, 0.0]}>
          <boxGeometry args={[0.02, 0.08, 0.12]} />
          <meshBasicMaterial color={ACCENT_AMBER} toneMapped={false} />
        </mesh>
      ))}
      {/* Scoped lighting. */}
      <pointLight position={[2, 1, 2]} intensity={1.2} color="#ffbd80" distance={12} />
      <ambientLight intensity={0.18} color={VIOLET_RIM} />
    </group>
  );
}

// Planet 1 — Signal. Visual = the existing space station + small amber star
// accent behind it. Reused from v2 SpaceStation.jsx. Scale tuned so station
// reads at galaxy-overview distance (~22 units from camera).

import React from 'react';
import SpaceStation from './SpaceStation';

export default function Planet1SignalMesh() {
  return (
    <group>
      <SpaceStation position={[0, 0, 0]} scale={1.4} />
      {/* Small warm amber sun behind the station — the "home signal." */}
      <mesh position={[1.4, 0.6, -1.6]}>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshBasicMaterial color="#ffc870" toneMapped={false} />
      </mesh>
      {/* Scoped key light so the station reads at galaxy distance. */}
      <directionalLight position={[5, 4, 3]} intensity={0.9} color="#f0c080" />
      <ambientLight intensity={0.35} color="#8060a0" />
    </group>
  );
}

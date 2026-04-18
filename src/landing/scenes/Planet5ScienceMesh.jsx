// Planet 5 — The Science. Placeholder until the Midjourney asset arrives
// (will be swapped in Step 5 per user's §10 answer). Current impl: small
// translucent shell with a hot orange core visible through it — matches
// the spec's "small intense planet with hot orange core" description.

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const CORE_COLOR  = '#ff7030';
const SHELL_COLOR = '#a0604a';

export default function Planet5ScienceMesh() {
  const coreRef = useRef();
  const shellRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Core pulses slightly — "this score is alive."
    if (coreRef.current) {
      const pulse = 1.0 + Math.sin(t * 1.5) * 0.04;
      coreRef.current.scale.setScalar(pulse);
    }
    // Shell slow-rotates (different axis from core).
    if (shellRef.current) {
      shellRef.current.rotation.y = t * 0.08;
      shellRef.current.rotation.x = t * 0.03;
    }
  });

  return (
    <group>
      {/* Hot core. */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.65, 24, 24]} />
        <meshBasicMaterial color={CORE_COLOR} toneMapped={false} />
      </mesh>
      {/* Translucent fractured shell. */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[1.15, 1]} />
        <meshBasicMaterial
          color={SHELL_COLOR}
          transparent
          opacity={0.35}
          wireframe
          toneMapped={false}
        />
      </mesh>
      {/* Outer amber halo for silhouette pop. */}
      <mesh>
        <sphereGeometry args={[1.35, 20, 20]} />
        <meshBasicMaterial
          color="#ff9050"
          transparent
          opacity={0.10}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

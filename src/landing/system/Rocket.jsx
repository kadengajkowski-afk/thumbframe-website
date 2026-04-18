// Placeholder rocket — small painterly ship that leads the camera during
// click-to-travel transitions (v3 §4 step 2 + 3). Visible only while the
// store is in `entering` or `exiting` state. Position = camera.position +
// 0.8·forward so the ship sits slightly ahead in frame. Orientation
// matches the camera's quaternion so it always points along travel.
//
// Procedural geometry — narrow body + nose cone + hot amber engine glow +
// two small stabilizer fins. No external assets.

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGalaxyStore } from '../state/galaxyStore';

const LEAD_DISTANCE = 0.9;     // units ahead of camera along view direction
const Y_OFFSET      = -0.12;   // slightly below centre so it doesn't block look target

export default function Rocket() {
  const groupRef = useRef();
  const fwd = useMemo(() => new THREE.Vector3(), []);
  const up  = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, clock }) => {
    const g = groupRef.current;
    if (!g) return;

    const s = useGalaxyStore.getState();
    const transitioning = s.transitionState === 'entering' || s.transitionState === 'exiting';

    if (!transitioning) {
      if (g.visible) g.visible = false;
      return;
    }
    if (!g.visible) g.visible = true;

    // Place the rocket a short distance in front of the camera along its
    // current view direction, slightly below centre of frame.
    fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);

    g.position.copy(camera.position)
      .addScaledVector(fwd, LEAD_DISTANCE)
      .addScaledVector(up,  Y_OFFSET);

    g.quaternion.copy(camera.quaternion);

    // Subtle engine flicker.
    const t = clock.elapsedTime;
    const flicker = 0.85 + Math.sin(t * 22) * 0.12 + Math.sin(t * 8) * 0.05;
    const engine = g.getObjectByName('engine');
    if (engine) engine.scale.setScalar(flicker);
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Body — narrow painted canister oriented -Z (camera forward). */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.055, 0.24, 10]} />
        <meshBasicMaterial color="#e8d8b0" toneMapped={false} />
      </mesh>
      {/* Hull stripe — small warm amber accent band. */}
      <mesh position={[0, 0, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.056, 0.056, 0.04, 10]} />
        <meshBasicMaterial color="#f97316" toneMapped={false} />
      </mesh>
      {/* Nose cone pointing forward (-Z). */}
      <mesh position={[0, 0, -0.18]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.045, 0.12, 10]} />
        <meshBasicMaterial color="#f0e4d0" toneMapped={false} />
      </mesh>
      {/* Cockpit dome — small amber bubble on top. */}
      <mesh position={[0, 0.035, -0.05]}>
        <sphereGeometry args={[0.022, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshBasicMaterial color="#ffb060" toneMapped={false} />
      </mesh>
      {/* Lateral fins — two thin trapezoid boxes. */}
      <mesh position={[ 0.055, 0, 0.09]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.02, 0.085, 0.08]} />
        <meshBasicMaterial color="#d8c8a0" toneMapped={false} />
      </mesh>
      <mesh position={[-0.055, 0, 0.09]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.02, 0.085, 0.08]} />
        <meshBasicMaterial color="#d8c8a0" toneMapped={false} />
      </mesh>
      {/* Engine glow — hot amber pulse behind (+Z from rocket body). */}
      <mesh name="engine" position={[0, 0, 0.14]}>
        <sphereGeometry args={[0.06, 14, 12]} />
        <meshBasicMaterial color="#ffc070" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.18]}>
        <sphereGeometry args={[0.09, 12, 10]} />
        <meshBasicMaterial
          color="#ff8020"
          transparent
          opacity={0.35}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

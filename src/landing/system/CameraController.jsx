// Camera controller — single source of truth for the R3F default camera.
//
// Reads `useGalaxyStore` each frame and interpolates position + look target
// between fromPose and toPose using the stored transition progress. When
// idle on galaxy overview, applies the slow Y orbit + breathing zoom from
// v3 §3. When on-planet, camera holds at the planet's orbit pose.
//
// The transition tween is ease-in-out-cubic in position. A Catmull-Rom
// curve is overkill for a 2-waypoint journey — a straight-line LERP with
// cubic easing + a subtle sine-based arc on Y gives the same visual
// "flight path" feel without the dependency weight.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGalaxyStore, OVERVIEW_POSE } from '../state/galaxyStore';

const OVERVIEW_ORBIT_SPEED      = 0.02;   // rad/s around world Y
const OVERVIEW_BREATHE_PERIOD   = 8.0;    // seconds for one breath cycle
const OVERVIEW_BREATHE_AMPLITUDE = 0.5;   // ±units in world-Z radial

// Ease in/out cubic — snappy mid-transition, soft start & end.
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Subtle arc — during travel the camera lifts slightly then settles. Gives
// visual interest vs. a flat straight-line zoom.
function arcOffset(t) {
  return Math.sin(t * Math.PI) * 0.8;
}

export default function CameraController() {
  const tmpCam  = useRef(new THREE.Vector3());
  const tmpLook = useRef(new THREE.Vector3());

  useFrame(({ camera, clock }) => {
    const nowMs = performance.now();
    useGalaxyStore.getState().tickTransition(nowMs);

    const s = useGalaxyStore.getState();
    const elapsed = clock.elapsedTime;

    // Determine current pose based on transition state.
    if (s.transitionState === 'idle') {
      // Galaxy overview — slow Y orbit + breathing radial zoom.
      const angle = elapsed * OVERVIEW_ORBIT_SPEED;
      const baseX = OVERVIEW_POSE.cam[0];
      const baseY = OVERVIEW_POSE.cam[1];
      const baseZ = OVERVIEW_POSE.cam[2];
      const baseRadius = Math.hypot(baseX, baseZ);

      const breatheMul = 1 + Math.sin(elapsed * (2 * Math.PI / OVERVIEW_BREATHE_PERIOD)) *
                            (OVERVIEW_BREATHE_AMPLITUDE / baseRadius);
      const r = baseRadius * breatheMul;

      camera.position.set(
        Math.sin(angle) * r,
        baseY,
        Math.cos(angle) * r,
      );
      camera.lookAt(OVERVIEW_POSE.look[0], OVERVIEW_POSE.look[1], OVERVIEW_POSE.look[2]);
      return;
    }

    if (s.transitionState === 'on-planet') {
      // Hold at planet orbit pose. Add a gentle per-axis breathing so the
      // frame is never dead still.
      const pose = s.toPose;
      const breathe = Math.sin(elapsed * 0.6) * 0.04;
      camera.position.set(pose.cam[0] + breathe, pose.cam[1], pose.cam[2] + breathe * 0.5);
      camera.lookAt(pose.look[0], pose.look[1], pose.look[2]);
      return;
    }

    // entering or exiting — interpolate fromPose → toPose.
    const t = s.transitionProgress;
    const e = easeInOutCubic(t);
    const arc = arcOffset(t);

    const from = s.fromPose;
    const to   = s.toPose;

    tmpCam.current.set(
      THREE.MathUtils.lerp(from.cam[0], to.cam[0], e),
      THREE.MathUtils.lerp(from.cam[1], to.cam[1], e) + arc,
      THREE.MathUtils.lerp(from.cam[2], to.cam[2], e),
    );
    tmpLook.current.set(
      THREE.MathUtils.lerp(from.look[0], to.look[0], e),
      THREE.MathUtils.lerp(from.look[1], to.look[1], e),
      THREE.MathUtils.lerp(from.look[2], to.look[2], e),
    );

    camera.position.copy(tmpCam.current);
    camera.lookAt(tmpLook.current);
  });

  return null;
}

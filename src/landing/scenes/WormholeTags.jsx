// Scene 3 Steps 3-5 — six feature tags that:
//   (1) fall past the camera from behind to ahead during sceneIdx 2.9 → 3.2
//   (2) warp toward satellite positions around the editor plane during 3.2 → 3.5
//   (3) lock into those positions with HTML labels from 3.5 onward
//
// All positions are LOCAL to the Wormhole group (anchored at world (0, 0, -45)).
// Editor plane sits at local z = -85. Satellites sit just in front of it at
// local z = -83, arranged around a 7 × 4 rectangle so they frame the editor
// without overlapping it.

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll, Html } from '@react-three/drei';
import * as THREE from 'three';

// ── Colour tokens (match the spec: paper-highlight outline, warm amber fill) ─

const LINE_COLOR = '#f0e4d0'; // paper-highlight — outlines, accents
const FILL_COLOR = '#ffb060'; // warm amber — fill shapes
const DARK_COLOR = '#2a1a30'; // deep plum — pips, eyes, mouths

// ── Icon geometries — each reads as the named shape, not an abstract blob ───

function IconScissors() {
  return (
    <group>
      {/* Two crossed blades */}
      <mesh rotation={[0, 0, Math.PI / 7]} position={[0, 0.10, 0]}>
        <boxGeometry args={[0.07, 0.44, 0.02]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 7]} position={[0, 0.10, 0]}>
        <boxGeometry args={[0.07, 0.44, 0.02]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      {/* Pivot */}
      <mesh position={[0, -0.05, 0]}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshBasicMaterial color={FILL_COLOR} toneMapped={false} />
      </mesh>
      {/* Handle loops */}
      <mesh position={[-0.11, -0.18, 0]}>
        <torusGeometry args={[0.07, 0.015, 8, 16]} />
        <meshBasicMaterial color={FILL_COLOR} toneMapped={false} />
      </mesh>
      <mesh position={[0.11, -0.18, 0]}>
        <torusGeometry args={[0.07, 0.015, 8, 16]} />
        <meshBasicMaterial color={FILL_COLOR} toneMapped={false} />
      </mesh>
    </group>
  );
}

function IconTarget() {
  return (
    <group>
      {/* Concentric rings */}
      <mesh>
        <torusGeometry args={[0.20, 0.018, 8, 32]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.12, 0.018, 8, 32]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshBasicMaterial color={FILL_COLOR} toneMapped={false} />
      </mesh>
      {/* Crosshair — four short segments instead of one long line so the
          rings aren't bisected through the centre */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.015, 0.10, 0.01]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.22, 0]}>
        <boxGeometry args={[0.015, 0.10, 0.01]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      <mesh position={[0.22, 0, 0]}>
        <boxGeometry args={[0.10, 0.015, 0.01]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      <mesh position={[-0.22, 0, 0]}>
        <boxGeometry args={[0.10, 0.015, 0.01]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
    </group>
  );
}

function IconDice() {
  const o = 0.10; // pip offset from face centre
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.32, 0.32, 0.32]} />
        <meshBasicMaterial color={FILL_COLOR} toneMapped={false} />
      </mesh>
      {/* 1 pip on +Z face */}
      <mesh position={[0, 0, 0.162]}>
        <sphereGeometry args={[0.032, 10, 10]} />
        <meshBasicMaterial color={DARK_COLOR} toneMapped={false} />
      </mesh>
      {/* 2 pips on +X face */}
      <mesh position={[0.162, o, o]}>
        <sphereGeometry args={[0.027, 10, 10]} />
        <meshBasicMaterial color={DARK_COLOR} toneMapped={false} />
      </mesh>
      <mesh position={[0.162, -o, -o]}>
        <sphereGeometry args={[0.027, 10, 10]} />
        <meshBasicMaterial color={DARK_COLOR} toneMapped={false} />
      </mesh>
      {/* 3 pips on +Y face */}
      <mesh position={[0, 0.162, 0]}>
        <sphereGeometry args={[0.027, 10, 10]} />
        <meshBasicMaterial color={DARK_COLOR} toneMapped={false} />
      </mesh>
      <mesh position={[o, 0.162, o]}>
        <sphereGeometry args={[0.027, 10, 10]} />
        <meshBasicMaterial color={DARK_COLOR} toneMapped={false} />
      </mesh>
      <mesh position={[-o, 0.162, -o]}>
        <sphereGeometry args={[0.027, 10, 10]} />
        <meshBasicMaterial color={DARK_COLOR} toneMapped={false} />
      </mesh>
    </group>
  );
}

function IconSparkles() {
  // 4-point burst with a small diagonal secondary burst
  return (
    <group>
      {/* Primary 4-point */}
      <mesh>
        <boxGeometry args={[0.06, 0.48, 0.02]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.48, 0.06, 0.02]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      {/* Diagonal secondary */}
      <mesh rotation={[0, 0, Math.PI / 4]} scale={[1, 0.6, 1]}>
        <boxGeometry args={[0.035, 0.48, 0.02]} />
        <meshBasicMaterial color={FILL_COLOR} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]} scale={[1, 0.6, 1]}>
        <boxGeometry args={[0.035, 0.48, 0.02]} />
        <meshBasicMaterial color={FILL_COLOR} toneMapped={false} />
      </mesh>
      {/* Centre node */}
      <mesh>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
    </group>
  );
}

function IconFace() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.20, 20, 20]} />
        <meshBasicMaterial color={FILL_COLOR} toneMapped={false} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.07, 0.05, 0.17]}>
        <sphereGeometry args={[0.028, 10, 10]} />
        <meshBasicMaterial color={DARK_COLOR} toneMapped={false} />
      </mesh>
      <mesh position={[0.07, 0.05, 0.17]}>
        <sphereGeometry args={[0.028, 10, 10]} />
        <meshBasicMaterial color={DARK_COLOR} toneMapped={false} />
      </mesh>
      {/* Smile arc — half-torus */}
      <mesh position={[0, -0.05, 0.17]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.06, 0.013, 6, 16, Math.PI]} />
        <meshBasicMaterial color={DARK_COLOR} toneMapped={false} />
      </mesh>
    </group>
  );
}

function IconGrid() {
  // 3×3 grid — outer frame + two horizontals + two verticals
  return (
    <group>
      {/* Outer frame */}
      <mesh position={[0, 0.20, 0]}>
        <boxGeometry args={[0.42, 0.022, 0.01]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.20, 0]}>
        <boxGeometry args={[0.42, 0.022, 0.01]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      <mesh position={[0.21, 0, 0]}>
        <boxGeometry args={[0.022, 0.42, 0.01]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      <mesh position={[-0.21, 0, 0]}>
        <boxGeometry args={[0.022, 0.42, 0.01]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      {/* Internal dividers */}
      <mesh position={[0, 0.067, 0]}>
        <boxGeometry args={[0.42, 0.016, 0.01]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.067, 0]}>
        <boxGeometry args={[0.42, 0.016, 0.01]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      <mesh position={[0.070, 0, 0]}>
        <boxGeometry args={[0.016, 0.42, 0.01]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
      <mesh position={[-0.070, 0, 0]}>
        <boxGeometry args={[0.016, 0.42, 0.01]} />
        <meshBasicMaterial color={LINE_COLOR} toneMapped={false} />
      </mesh>
    </group>
  );
}

const ICON_MAP = {
  scissors: IconScissors,
  target:   IconTarget,
  dice:     IconDice,
  sparkles: IconSparkles,
  face:     IconFace,
  grid:     IconGrid,
};

// ── Tag configs ─────────────────────────────────────────────────────────────
// Six tags caught in the singularity's spiral. Each icon:
//   Phase 1 (2.9-3.2): enters from behind the camera at orbitOuter radius,
//     revolving slowly, translating from phase1ZStart → phase1ZEnd.
//   Phase 2 (3.2-3.5): radius collapses orbitOuter → satRadius, angular
//     velocity spikes (conservation-of-angular-momentum term: the 1/(r+ε)
//     kick), icon is sucked inward toward the editor plane.
//   Phase 3 (3.5-3.95): decelerates to rest at the satellite position
//     (derived from the final satRadius + satAngle). Labels fade in.
//
// Satellites still sit at local z=-83, framing the 6 × 3.375 editor plane.

const TAG_CONFIGS = [
  {
    type: 'scissors', label: 'Cut & Edit',
    satellite: { x: -3.5, y:  1.9, z: -83 },
    orbitOuter: 9.5,
    angularSpeed: 0.95,
    spiralTightness: 0.32,
    phase1ZStart: -10, phase1ZEnd: -55,
    labelOffset: { x: -0.55, y: 0 },
    rotX: 1.4, rotY: 1.1, rotZ: 0.7,
  },
  {
    type: 'target', label: 'CTR Score',
    satellite: { x:  3.5, y:  1.9, z: -83 },
    orbitOuter: 9.0,
    angularSpeed: 0.85,
    spiralTightness: 0.28,
    phase1ZStart: -14, phase1ZEnd: -58,
    labelOffset: { x:  0.55, y: 0 },
    rotX: 0.8, rotY: 1.6, rotZ: 1.2,
  },
  {
    type: 'dice', label: 'A/B Test',
    satellite: { x: -3.8, y:  0.0, z: -83 },
    orbitOuter: 10.2,
    angularSpeed: 1.10,
    spiralTightness: 0.36,
    phase1ZStart: -18, phase1ZEnd: -62,
    labelOffset: { x: -0.6, y: 0 },
    rotX: 1.1, rotY: 0.9, rotZ: 1.5,
  },
  {
    type: 'sparkles', label: 'AI Generate',
    satellite: { x:  3.8, y:  0.0, z: -83 },
    orbitOuter: 9.8,
    angularSpeed: 1.00,
    spiralTightness: 0.30,
    phase1ZStart: -22, phase1ZEnd: -65,
    labelOffset: { x:  0.6, y: 0 },
    rotX: 1.8, rotY: 1.3, rotZ: 0.9,
  },
  {
    type: 'face', label: 'Face Detect',
    satellite: { x: -3.5, y: -1.9, z: -83 },
    orbitOuter: 9.3,
    angularSpeed: 0.80,
    spiralTightness: 0.34,
    phase1ZStart: -26, phase1ZEnd: -70,
    labelOffset: { x: -0.55, y: 0 },
    rotX: 0.9, rotY: 1.1, rotZ: 1.3,
  },
  {
    type: 'grid', label: 'Safe Zone',
    satellite: { x:  3.5, y: -1.9, z: -83 },
    orbitOuter: 10.0,
    angularSpeed: 1.20,
    spiralTightness: 0.26,
    phase1ZStart: -30, phase1ZEnd: -74,
    labelOffset: { x:  0.55, y: 0 },
    rotX: 1.2, rotY: 0.7, rotZ: 1.6,
  },
];

// ── One feature tag ─────────────────────────────────────────────────────────

function FeatureTag({ config }) {
  const groupRef = useRef();
  const labelRef = useRef();
  const scroll = useScroll();
  const Icon = ICON_MAP[config.type];

  // Precompute polar of the final satellite — spiral trajectories land
  // precisely here at sceneIdx 3.5 so phase-3 can ease out without snap.
  const satAngle = useMemo(
    () => Math.atan2(config.satellite.y, config.satellite.x),
    [config.satellite.x, config.satellite.y]
  );
  const satRadius = useMemo(
    () => Math.hypot(config.satellite.x, config.satellite.y),
    [config.satellite.x, config.satellite.y]
  );

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;

    const sceneIdx = scroll.offset * 7;

    // Hide when outside the tag lifetime.
    if (sceneIdx < 2.9 || sceneIdx > 3.95) {
      if (g.visible) g.visible = false;
      if (labelRef.current) labelRef.current.style.opacity = '0';
      return;
    }
    if (!g.visible) g.visible = true;

    const t = clock.elapsedTime;
    const { orbitOuter, angularSpeed, spiralTightness } = config;
    const EPS = 0.1;

    let x, y, z;
    let labelAlpha = 0;
    let tumbleDamp = 1.0;

    if (sceneIdx < 3.2) {
      // Phase 1 — icon enters from behind the camera on an outer orbit.
      //   radius = orbitOuter (held constant — tag is just orbiting).
      //   angle  = satAngle + angularSpeed·t (slow revolution).
      //   z      = phase1ZStart → phase1ZEnd (dropping into tunnel).
      const p = (sceneIdx - 2.9) / 0.3;
      const e = p * p * (3 - 2 * p);
      const angle = satAngle + angularSpeed * t;
      x = Math.cos(angle) * orbitOuter;
      y = Math.sin(angle) * orbitOuter;
      z = THREE.MathUtils.lerp(config.phase1ZStart, config.phase1ZEnd, e);
    } else if (sceneIdx < 3.5) {
      // Phase 2 — spiral inward. Radius collapses orbitOuter → satRadius;
      // angular velocity spikes via a 1/(r+ε) kick (conservation-of-angular-
      // momentum analogue). Z eases from phase1ZEnd to satellite.z.
      const p = (sceneIdx - 3.2) / 0.3;
      const e = p * p * (3 - 2 * p);
      const radius = THREE.MathUtils.lerp(orbitOuter, satRadius, e);
      const spiralKick = spiralTightness * (orbitOuter - radius) / (radius + EPS);
      const angle = satAngle + angularSpeed * t + spiralKick;
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
      z = THREE.MathUtils.lerp(config.phase1ZEnd, config.satellite.z, e);
    } else {
      // Phase 3 — ease out of the spiral to rest at the satellite. Blend
      // from the *current* spiral position (continuity with phase-2 end)
      // to the fixed satellite (x, y). Tumble damps to zero.
      const p = Math.min(1, (sceneIdx - 3.5) / 0.25);
      const e = p * p * (3 - 2 * p);

      const spiralKick = spiralTightness * (orbitOuter - satRadius) / (satRadius + EPS);
      const spinAngle  = satAngle + angularSpeed * t + spiralKick;
      const spinX = Math.cos(spinAngle) * satRadius;
      const spinY = Math.sin(spinAngle) * satRadius;

      x = THREE.MathUtils.lerp(spinX, config.satellite.x, e);
      y = THREE.MathUtils.lerp(spinY, config.satellite.y, e);
      z = config.satellite.z;
      tumbleDamp = Math.max(0, 1 - e);
      labelAlpha = e;
    }

    g.position.set(x, y, z);

    g.rotation.x = t * config.rotX * tumbleDamp;
    g.rotation.y = t * config.rotY * tumbleDamp;
    g.rotation.z = t * config.rotZ * tumbleDamp;

    if (labelRef.current) {
      labelRef.current.style.opacity = String(labelAlpha);
    }
  });

  return (
    <>
      <group ref={groupRef} visible={false}>
        <Icon />
      </group>
      {/* HTML label — fixed at satellite position, fades in post-snap. */}
      <Html
        position={[
          config.satellite.x + (config.labelOffset?.x ?? 0),
          config.satellite.y + (config.labelOffset?.y ?? 0) - 0.48,
          config.satellite.z,
        ]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'none' }}
      >
        <div
          ref={labelRef}
          style={{
            color: '#f0e4d0',
            fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.12em',
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
            opacity: 0,
            transition: 'opacity 320ms ease',
            textShadow: '0 2px 10px rgba(10, 7, 20, 0.95)',
          }}
        >
          {config.label}
        </div>
      </Html>
    </>
  );
}

// ── Export ──────────────────────────────────────────────────────────────────

export default function WormholeTags() {
  const tags = useMemo(() => TAG_CONFIGS, []);
  return (
    <group>
      {tags.map((cfg, i) => (
        <FeatureTag key={i} config={cfg} />
      ))}
    </group>
  );
}

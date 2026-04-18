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
// Six tags with staggered fall paths and six satellite positions around the
// editor plane perimeter. Editor plane is 6 wide × 3.4 tall at local z=-85;
// satellites sit at local z=-83, on a 7 × 4 rectangle so they frame the plane.

const TAG_CONFIGS = [
  {
    type: 'scissors', label: 'Cut & Edit',
    phase1Start: { x:  2.0, y:  1.2, z: -20 },
    phase1End:   { x:  1.3, y:  0.7, z: -55 },
    satellite:   { x: -3.5, y:  1.9, z: -83 },
    labelOffset: { x: -0.55, y: 0 },
    rotX: 1.4, rotY: 1.1, rotZ: 0.7,
  },
  {
    type: 'target', label: 'CTR Score',
    phase1Start: { x: -2.2, y:  1.1, z: -24 },
    phase1End:   { x: -1.6, y:  0.6, z: -59 },
    satellite:   { x:  3.5, y:  1.9, z: -83 },
    labelOffset: { x:  0.55, y: 0 },
    rotX: 0.8, rotY: 1.6, rotZ: 1.2,
  },
  {
    type: 'dice', label: 'A/B Test',
    phase1Start: { x:  0.6, y: -1.8, z: -28 },
    phase1End:   { x:  0.8, y: -1.0, z: -63 },
    satellite:   { x: -3.8, y:  0.0, z: -83 },
    labelOffset: { x: -0.6, y: 0 },
    rotX: 1.1, rotY: 0.9, rotZ: 1.5,
  },
  {
    type: 'sparkles', label: 'AI Generate',
    phase1Start: { x: -1.5, y: -1.2, z: -32 },
    phase1End:   { x: -1.1, y: -0.7, z: -67 },
    satellite:   { x:  3.8, y:  0.0, z: -83 },
    labelOffset: { x:  0.6, y: 0 },
    rotX: 1.8, rotY: 1.3, rotZ: 0.9,
  },
  {
    type: 'face', label: 'Face Detect',
    phase1Start: { x:  2.3, y:  0.2, z: -36 },
    phase1End:   { x:  1.8, y:  0.1, z: -71 },
    satellite:   { x: -3.5, y: -1.9, z: -83 },
    labelOffset: { x: -0.55, y: 0 },
    rotX: 0.9, rotY: 1.1, rotZ: 1.3,
  },
  {
    type: 'grid', label: 'Safe Zone',
    phase1Start: { x: -0.8, y: -0.2, z: -40 },
    phase1End:   { x: -0.5, y: -0.1, z: -75 },
    satellite:   { x:  3.5, y: -1.9, z: -83 },
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

    let x, y, z;
    let labelAlpha = 0;

    if (sceneIdx < 3.2) {
      // Phase 1 — fall past the camera from behind to ahead.
      const p = (sceneIdx - 2.9) / 0.3;
      const e = p * p * (3 - 2 * p);
      x = THREE.MathUtils.lerp(config.phase1Start.x, config.phase1End.x, e);
      y = THREE.MathUtils.lerp(config.phase1Start.y, config.phase1End.y, e);
      z = THREE.MathUtils.lerp(config.phase1Start.z, config.phase1End.z, e);
    } else if (sceneIdx < 3.5) {
      // Phase 2 — warp toward satellite position.
      const p = (sceneIdx - 3.2) / 0.3;
      const e = p * p * (3 - 2 * p);
      x = THREE.MathUtils.lerp(config.phase1End.x, config.satellite.x, e);
      y = THREE.MathUtils.lerp(config.phase1End.y, config.satellite.y, e);
      z = THREE.MathUtils.lerp(config.phase1End.z, config.satellite.z, e);
    } else {
      // Phase 3 — locked at satellite; label fades in.
      x = config.satellite.x;
      y = config.satellite.y;
      z = config.satellite.z;
      labelAlpha = THREE.MathUtils.clamp((sceneIdx - 3.5) / 0.25, 0, 1);
    }

    g.position.set(x, y, z);

    // Tumble during phases 1-2, damp to a resting orientation in phase 3.
    const t = clock.elapsedTime;
    const tumbleDamp = sceneIdx < 3.5
      ? 1.0
      : Math.max(0, 1.0 - (sceneIdx - 3.5) / 0.25);
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

// Scene 3 Step 3 — six feature tag icons fall past the camera during
// sceneIdx 2.80 → 3.20. Each tag has a unique trajectory (offset x/y,
// spawn/end z in Wormhole-local coords), tumble rates, and color.
// Past the tunnel midpoint (local z < midZ), a vector-field pull warps
// x/y toward the tunnel axis so tags converge on the far-end point.
//
// All positions are LOCAL to the Wormhole group (anchored at (0, 0, -45)
// in world). Tunnel runs local z = 0 (event horizon) → -90 (far end).

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import * as THREE from 'three';

// ── Icon geometries — simple, distinctive, one color each ───────────────────

function IconScissors({ color }) {
  // Two crossed thin bars → X silhouette
  return (
    <group>
      <mesh rotation={[0, 0, 0.45]}>
        <boxGeometry args={[0.08, 0.6, 0.08]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, -0.45]}>
        <boxGeometry args={[0.08, 0.6, 0.08]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

function IconTarget({ color }) {
  return (
    <group>
      <mesh>
        <torusGeometry args={[0.28, 0.04, 8, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.16, 0.03, 8, 24]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

function IconDice({ color }) {
  // Cube plus a few pip dots on visible faces for a 'die' feel
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.42, 0.42, 0.42]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0.215, 0, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#0b0a14" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.215, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#0b0a14" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.215]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#0b0a14" toneMapped={false} />
      </mesh>
    </group>
  );
}

function IconSparkles({ color }) {
  // Two overlapping octahedra — spiky, stands apart
  return (
    <group>
      <mesh>
        <octahedronGeometry args={[0.28, 0]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]} scale={0.7}>
        <octahedronGeometry args={[0.28, 0]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

function IconFace({ color }) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.26, 16, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[-0.09, 0.06, 0.22]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#0b0a14" toneMapped={false} />
      </mesh>
      <mesh position={[0.09, 0.06, 0.22]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#0b0a14" toneMapped={false} />
      </mesh>
    </group>
  );
}

function IconGrid({ color }) {
  // + with a secondary crossbar — reads as a layout guide
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.5, 0.06, 0.06]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.06, 0.5, 0.06]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.36, 0.04, 0.04]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.36, 0.04, 0.04]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

const ICON_MAP = {
  scissors: IconScissors,
  target: IconTarget,
  dice: IconDice,
  sparkles: IconSparkles,
  face: IconFace,
  grid: IconGrid,
};

// ── Tag configs ─────────────────────────────────────────────────────────────

// Local coords (Wormhole group origin is at world (0, 0, -45)).
// Tunnel runs local z = 0 (event horizon) → -90 (far end / editor point).
// midZ is the warp threshold — z values past it (more negative) get pulled
// toward the tunnel axis.
const TAG_CONFIGS = [
  {
    type: 'scissors',  color: '#ff9040',
    x:  1.9, y:  0.9,
    spawnZ: -20, endZ: -92, midZ: -50,
    spawnAt: 2.80, lifetime: 0.40,
    rotX: 1.4, rotY: 1.1, rotZ: 0.7,
    scale: 1.0,
  },
  {
    type: 'target',    color: '#40d8c0',
    x: -2.2, y: -0.5,
    spawnZ: -25, endZ: -95, midZ: -52,
    spawnAt: 2.84, lifetime: 0.40,
    rotX: 0.8, rotY: 1.6, rotZ: 1.2,
    scale: 1.0,
  },
  {
    type: 'dice',      color: '#f0b848',
    x:  0.7, y:  1.8,
    spawnZ: -30, endZ: -100, midZ: -55,
    spawnAt: 2.88, lifetime: 0.40,
    rotX: 1.1, rotY: 0.9, rotZ: 1.5,
    scale: 1.0,
  },
  {
    type: 'sparkles',  color: '#c880f0',
    x: -1.5, y:  1.2,
    spawnZ: -35, endZ: -105, midZ: -57,
    spawnAt: 2.92, lifetime: 0.40,
    rotX: 1.8, rotY: 1.3, rotZ: 0.9,
    scale: 1.0,
  },
  {
    type: 'face',      color: '#f0a060',
    x:  2.3, y: -0.4,
    spawnZ: -40, endZ: -110, midZ: -60,
    spawnAt: 2.96, lifetime: 0.40,
    rotX: 0.9, rotY: 1.1, rotZ: 1.3,
    scale: 1.0,
  },
  {
    type: 'grid',      color: '#80d0ff',
    x: -0.8, y: -1.4,
    spawnZ: -45, endZ: -115, midZ: -62,
    spawnAt: 3.00, lifetime: 0.40,
    rotX: 1.2, rotY: 0.7, rotZ: 1.6,
    scale: 1.0,
  },
];

// ── One tag ─────────────────────────────────────────────────────────────────

function FeatureTag({ config }) {
  const groupRef = useRef();
  const scroll = useScroll();

  const Icon = ICON_MAP[config.type];

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;

    const sceneIdx = scroll.offset * 7;
    const localT = sceneIdx - config.spawnAt;
    const inLife = localT >= 0 && localT <= config.lifetime;

    if (g.visible !== inLife) g.visible = inLife;
    if (!inLife) return;

    const p = localT / config.lifetime;

    // Straight-line descent from spawnZ to endZ.
    const z = THREE.MathUtils.lerp(config.spawnZ, config.endZ, p);

    let x = config.x;
    let y = config.y;

    // Vector-field pull — past midpoint, x/y converge toward tunnel axis
    // (0, 0). Strength grows quadratically with distance past the midpoint
    // so tags hook inward more aggressively as they approach the far end.
    if (z < config.midZ) {
      const warpP = THREE.MathUtils.clamp(
        (config.midZ - z) / (config.midZ - config.endZ),
        0, 1,
      );
      const warp = warpP * warpP;
      x = THREE.MathUtils.lerp(x, 0, warp);
      y = THREE.MathUtils.lerp(y, 0, warp);
    }

    g.position.set(x, y, z);

    // Fade in at spawn / fade out at death so tags don't pop.
    const fadeIn  = THREE.MathUtils.clamp(p / 0.12, 0, 1);
    const fadeOut = THREE.MathUtils.clamp((1 - p) / 0.12, 0, 1);
    const s = config.scale * Math.min(fadeIn, fadeOut);
    g.scale.setScalar(s);

    // Rotational tumble — unique axis per tag.
    const t = clock.elapsedTime;
    g.rotation.x = t * config.rotX;
    g.rotation.y = t * config.rotY;
    g.rotation.z = t * config.rotZ;
  });

  return (
    <group ref={groupRef} visible={false}>
      <Icon color={config.color} />
    </group>
  );
}

// ── Export ──────────────────────────────────────────────────────────────────

export default function WormholeTags() {
  // Memoize the tag list so identity is stable and React never remounts them.
  const tags = useMemo(() => TAG_CONFIGS, []);
  return (
    <group>
      {tags.map((cfg, i) => (
        <FeatureTag key={i} config={cfg} />
      ))}
    </group>
  );
}

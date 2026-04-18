// Decorative vortex debris — feature-label stickers and painterly creator
// objects caught in the singularity's spiral. Staggered entry across
// sceneIdx 2.7 → 3.4 so there's a continuous stream of matter being
// devoured (not all arriving at once). Each object follows the same polar
// vortex math as WormholeTags' FeatureTag (Phase 1 outer orbit, Phase 2
// spiral inward with 1/(r+ε) angular-momentum kick), but without a final
// satellite — debris shrinks to zero and vanishes before the editor reveal
// at sceneIdx 3.5+.

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import * as THREE from 'three';

const LINE = '#f0e4d0'; // paper-highlight
const FILL = '#ffb060'; // warm amber
const DARK = '#2a1a30'; // deep plum
const WARM = '#c86020'; // rust accent
const CYAN = '#86c4c0'; // accent (palette disc)

// ── Sticker label shape ─────────────────────────────────────────────────────
// Rounded-rectangle body with two horizontal strips suggesting text lines.
// 6 instances cover the feature-name callouts listed in the spec.
function StickerShape({ tint = FILL }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.60, 0.22, 0.03]} />
        <meshBasicMaterial color={tint} toneMapped={false} />
      </mesh>
      <mesh position={[-0.05, 0.04, 0.018]}>
        <boxGeometry args={[0.40, 0.035, 0.02]} />
        <meshBasicMaterial color={DARK} toneMapped={false} />
      </mesh>
      <mesh position={[-0.10, -0.04, 0.018]}>
        <boxGeometry args={[0.30, 0.035, 0.02]} />
        <meshBasicMaterial color={DARK} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Camera silhouette ──────────────────────────────────────────────────────
function CameraShape() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.38, 0.24, 0.22]} />
        <meshBasicMaterial color={LINE} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.14, 0.06, 0.16]} />
        <meshBasicMaterial color={LINE} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.08, 16]} />
        <meshBasicMaterial color={FILL} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.20]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 12]} />
        <meshBasicMaterial color={DARK} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Paintbrush ─────────────────────────────────────────────────────────────
function PaintbrushShape() {
  return (
    <group rotation={[0, 0, Math.PI / 6]}>
      <mesh position={[-0.18, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.36, 12]} />
        <meshBasicMaterial color={LINE} toneMapped={false} />
      </mesh>
      <mesh position={[0.05, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.025, 0.12, 12]} />
        <meshBasicMaterial color={FILL} toneMapped={false} />
      </mesh>
      <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.032, 0.12, 12]} />
        <meshBasicMaterial color={WARM} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Palette disc ───────────────────────────────────────────────────────────
function PaletteShape() {
  const dots = [
    { pos: [ 0.12,  0.04, 0.03], color: FILL },
    { pos: [ 0.04,  0.13, 0.03], color: LINE },
    { pos: [-0.10,  0.08, 0.03], color: WARM },
    { pos: [-0.12, -0.05, 0.03], color: CYAN },
    { pos: [ 0.02, -0.13, 0.03], color: DARK },
  ];
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 20]} />
        <meshBasicMaterial color={LINE} toneMapped={false} />
      </mesh>
      {dots.map((d, i) => (
        <mesh key={i} position={d.pos}>
          <sphereGeometry args={[0.038, 10, 10]} />
          <meshBasicMaterial color={d.color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Play button ────────────────────────────────────────────────────────────
function PlayShape() {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.20, 0.20, 0.04, 20]} />
        <meshBasicMaterial color={FILL} toneMapped={false} />
      </mesh>
      <mesh position={[0.02, 0, 0.03]} rotation={[Math.PI / 2, 0, Math.PI / 2]}>
        <coneGeometry args={[0.10, 0.18, 3]} />
        <meshBasicMaterial color={DARK} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Upload clock ───────────────────────────────────────────────────────────
// Circle with an upward arrow and a small clock tick — "scheduled upload".
function UploadShape() {
  return (
    <group>
      <mesh>
        <torusGeometry args={[0.18, 0.022, 8, 24]} />
        <meshBasicMaterial color={LINE} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.04, 0.18, 0.02]} />
        <meshBasicMaterial color={FILL} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <coneGeometry args={[0.07, 0.09, 3]} />
        <meshBasicMaterial color={FILL} toneMapped={false} />
      </mesh>
    </group>
  );
}

const SHAPE_MAP = {
  sticker:    StickerShape,
  camera:     CameraShape,
  brush:      PaintbrushShape,
  palette:    PaletteShape,
  play:       PlayShape,
  upload:     UploadShape,
};

// ── Debris configs ──────────────────────────────────────────────────────────
// Staggered entryStart across 2.70–3.40 so objects stream in continuously.
// Each has its own orbit radius, angular speed, spiral tightness, initial
// angle (spread around the circle), and z-path. Fade-out at sceneIdx 3.55
// shrinks the debris to zero before the editor reveal at 3.8.

const DEBRIS_CONFIGS = [
  // 6 sticker labels — feature-name callouts.
  { type: 'sticker', tint: FILL,  entry: 2.72, orbit: 10.8, angSpeed: 0.85, tight: 0.30, a0: 0.20, tumble: [1.2, 0.8, 0.6], z0: -6,  z1: -58 },
  { type: 'sticker', tint: '#ff9040', entry: 2.84, orbit:  9.6, angSpeed: 1.10, tight: 0.26, a0: 1.15, tumble: [0.9, 1.4, 0.7], z0: -10, z1: -62 },
  { type: 'sticker', tint: '#e88060', entry: 2.96, orbit: 11.4, angSpeed: 0.72, tight: 0.34, a0: 2.35, tumble: [1.5, 0.6, 1.1], z0: -4,  z1: -55 },
  { type: 'sticker', tint: '#ffa050', entry: 3.08, orbit:  9.2, angSpeed: 1.25, tight: 0.28, a0: 3.50, tumble: [0.7, 1.2, 0.9], z0: -8,  z1: -68 },
  { type: 'sticker', tint: '#f09070', entry: 3.18, orbit: 10.4, angSpeed: 0.95, tight: 0.32, a0: 4.60, tumble: [1.3, 0.9, 1.4], z0: -12, z1: -65 },
  { type: 'sticker', tint: FILL,      entry: 3.32, orbit:  9.8, angSpeed: 1.05, tight: 0.30, a0: 5.70, tumble: [1.0, 1.1, 0.8], z0: -6,  z1: -60 },
  // 5 painterly creator objects — staggered between the stickers.
  { type: 'camera',  entry: 2.78, orbit: 10.2, angSpeed: 0.80, tight: 0.36, a0: 0.80, tumble: [1.6, 1.0, 0.5], z0: -14, z1: -70 },
  { type: 'brush',   entry: 2.90, orbit: 11.0, angSpeed: 0.65, tight: 0.38, a0: 2.00, tumble: [2.1, 0.5, 1.3], z0:  -8, z1: -58 },
  { type: 'palette', entry: 3.02, orbit:  9.4, angSpeed: 1.15, tight: 0.24, a0: 3.15, tumble: [0.6, 1.7, 1.0], z0: -10, z1: -63 },
  { type: 'play',    entry: 3.14, orbit: 10.6, angSpeed: 0.90, tight: 0.32, a0: 4.25, tumble: [1.1, 1.2, 0.9], z0:  -5, z1: -56 },
  { type: 'upload',  entry: 3.26, orbit:  9.7, angSpeed: 1.00, tight: 0.30, a0: 5.40, tumble: [1.4, 0.7, 1.6], z0:  -7, z1: -60 },
];

// Per-item lifetime windows:
//   [entry,          entry + 0.4]        Phase 1 — outer orbit + z-drop.
//   [entry + 0.4,    entry + 0.8]        Phase 2 — spiral inward, radius collapses toward 0.
//   [3.50, 3.65]                         Global fade-out (shrink-to-zero scale).
// Past 3.65 the debris mesh is hidden entirely.
//
// The singularity "consumes" debris by collapsing its radius to a tiny core
// value + shrinking the object scale simultaneously.

function DebrisMesh({ config }) {
  const groupRef = useRef();
  const scroll = useScroll();
  const Shape = SHAPE_MAP[config.type];

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;

    const sceneIdx = scroll.offset * 7;
    const { entry, orbit, angSpeed, tight, a0, tumble, z0, z1 } = config;

    // Global fade window.
    const fadeP = Math.max(0, Math.min(1, (3.65 - sceneIdx) / 0.15));

    // Not yet arrived.
    if (sceneIdx < entry) {
      if (g.visible) g.visible = false;
      return;
    }
    // Fully consumed.
    if (sceneIdx >= 3.65) {
      if (g.visible) g.visible = false;
      return;
    }
    if (!g.visible) g.visible = true;

    const t = clock.elapsedTime;
    const local = sceneIdx - entry;           // 0 at entry
    const EPS = 0.15;

    // Radius trajectory: orbit for 0.4 units of scene, then collapse over 0.4.
    let radius;
    let zLocal;
    if (local < 0.4) {
      // Phase 1 — outer orbit, z drops.
      const p = local / 0.4;
      const e = p * p * (3 - 2 * p);
      radius = orbit;
      zLocal = THREE.MathUtils.lerp(z0, z1, e);
    } else {
      // Phase 2 — collapse toward the core, 1/(r+ε) angular acceleration.
      const p = Math.min(1, (local - 0.4) / 0.4);
      const e = p * p * (3 - 2 * p);
      radius = THREE.MathUtils.lerp(orbit, 0.5, e);
      zLocal = THREE.MathUtils.lerp(z1, -82, e);
    }

    const spiralKick = tight * (orbit - radius) / (radius + EPS);
    const angle = a0 + angSpeed * t + spiralKick;

    g.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      zLocal,
    );

    // Tumble — continues through collapse until fade-out takes over.
    g.rotation.x = t * tumble[0];
    g.rotation.y = t * tumble[1];
    g.rotation.z = t * tumble[2];

    // Scale ramps up on entry + shrinks during the global fade window.
    const entryRamp = Math.min(1, local / 0.15);
    g.scale.setScalar(entryRamp * fadeP);
  });

  return (
    <group ref={groupRef} visible={false}>
      <Shape tint={config.tint} />
    </group>
  );
}

export default function WormholeDebris() {
  const items = useMemo(() => DEBRIS_CONFIGS, []);
  return (
    <>
      {items.map((cfg, i) => (
        <DebrisMesh key={i} config={cfg} />
      ))}
    </>
  );
}

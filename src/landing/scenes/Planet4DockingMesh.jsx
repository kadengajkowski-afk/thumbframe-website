// Planet 4 — The Docking Station. Procedural station geometry (per user
// §10 Q1). Detail-pass adds amber window panels down the hull, hull
// paneling via vertical colour segments, a small comm / radar dish on
// top, and a slow-pulsing amber beacon at the nose.
//
// Overall bounding roughly 3 × 2 × 2 — at galaxy overview distance
// (~35 units) reads as a recognizable commerce station silhouette
// without demanding attention from neighbouring planets.

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const HULL_DARK   = '#3a3240';   // mid-hull shadow segments
const HULL_MID    = '#4a4052';   // main hull colour
const HULL_LIGHT  = '#6a6078';   // top cap / highlight segments
const ACCENT      = '#ffb06a';   // amber UI accents
const WINDOW_WARM = '#ffd090';   // lit window panels
const BEACON      = '#f8a040';   // nose beacon base colour

export default function Planet4DockingMesh() {
  const beaconRef = useRef();
  const dishRef   = useRef();

  // Small window panels spaced along the hull, each lit amber. Three on
  // each visible side so the station reads as "inhabited" from all angles.
  const windowPositions = useMemo(() => {
    const out = [];
    // Front-facing side (+X)
    [-0.65, -0.20, 0.25, 0.70].forEach((y) => out.push({ pos: [ 0.56, y, 0.02], rotY: 0 }));
    // Back side (-X) for when the orbit camera comes around
    [-0.65, -0.20, 0.25, 0.70].forEach((y) => out.push({ pos: [-0.56, y, 0.02], rotY: Math.PI }));
    // One ring of windows on the hangar ring (front only — Z-facing)
    [0, 2.09, 4.19].forEach((a) => {
      out.push({ pos: [Math.cos(a) * 0.97, 0, Math.sin(a) * 0.97], rotY: a });
    });
    return out;
  }, []);

  // Hull panel segments — alternating mid / dark stripes along the hull
  // length. Cheap way to imply "sections welded together."
  const panelSegments = useMemo(() => {
    const out = [];
    const h = 2.6;
    const count = 6;
    const segH = h / count;
    for (let i = 0; i < count; i++) {
      const y = -h / 2 + segH * (i + 0.5);
      out.push({ y, color: i % 2 === 0 ? HULL_MID : HULL_DARK, segH });
    }
    return out;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Beacon pulses — slow sine, 60% → 120% intensity, 2.8s period.
    if (beaconRef.current) {
      const pulse = 0.6 + 0.6 * (0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 2.8)));
      beaconRef.current.material.color.setScalar(pulse);
      beaconRef.current.material.color.r = Math.min(1, pulse * 1.0);
      beaconRef.current.material.color.g = Math.min(1, pulse * 0.60);
      beaconRef.current.material.color.b = Math.min(1, pulse * 0.25);
    }
    // Dish slowly spins — comms scanning.
    if (dishRef.current) {
      dishRef.current.rotation.y = t * 0.45;
    }
  });

  return (
    <group rotation={[0.08, 0.5, 0]}>
      {/* ── Hull stack — vertical paneling segments ───────────────────── */}
      {panelSegments.map((seg, i) => (
        <mesh key={`p${i}`} position={[0, seg.y, 0]}>
          <cylinderGeometry args={[0.55, 0.55, seg.segH * 0.98, 20]} />
          <meshStandardMaterial
            color={seg.color}
            roughness={0.7}
            metalness={0.2}
          />
        </mesh>
      ))}

      {/* ── Central hangar ring ───────────────────────────────────────── */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.95, 0.13, 12, 32]} />
        <meshStandardMaterial color={HULL_LIGHT} roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.985, 0.025, 8, 48]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>

      {/* ── Nose cone ─────────────────────────────────────────────────── */}
      <mesh position={[0, 1.55, 0]}>
        <coneGeometry args={[0.38, 0.8, 14]} />
        <meshStandardMaterial color={HULL_LIGHT} roughness={0.65} metalness={0.25} />
      </mesh>

      {/* ── Beacon atop the nose — pulsing amber ──────────────────────── */}
      <mesh ref={beaconRef} position={[0, 2.1, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshBasicMaterial color={BEACON} toneMapped={false} />
      </mesh>
      {/* Thin antenna mast below beacon */}
      <mesh position={[0, 2.0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.24, 6]} />
        <meshBasicMaterial color={HULL_LIGHT} toneMapped={false} />
      </mesh>

      {/* ── Comm dish array on top-front of nose ──────────────────────── */}
      <group ref={dishRef} position={[0, 1.75, 0]}>
        <mesh position={[0.18, 0, 0.22]} rotation={[-0.4, 0, -0.3]}>
          <sphereGeometry args={[0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={HULL_LIGHT} roughness={0.5} metalness={0.4} side={2} />
        </mesh>
        {/* Dish feed spike */}
        <mesh position={[0.17, 0.08, 0.20]}>
          <cylinderGeometry args={[0.008, 0.008, 0.14, 6]} />
          <meshBasicMaterial color={ACCENT} toneMapped={false} />
        </mesh>
      </group>

      {/* ── Aft engine block ──────────────────────────────────────────── */}
      <mesh position={[0, -1.45, 0]}>
        <cylinderGeometry args={[0.48, 0.62, 0.5, 14]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.75} metalness={0.3} />
      </mesh>
      <mesh position={[0, -1.72, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 20]} />
        <meshBasicMaterial color={ACCENT} toneMapped={false} />
      </mesh>

      {/* ── Lateral stabilizer fins ───────────────────────────────────── */}
      <mesh position={[ 0.85, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.04, 0.6, 0.9]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[-0.85, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.04, 0.6, 0.9]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* ── Window panels (amber, distributed around hull) ────────────── */}
      {windowPositions.map((w, i) => (
        <mesh key={`w${i}`} position={w.pos} rotation={[0, w.rotY, 0]}>
          <boxGeometry args={[0.028, 0.13, 0.08]} />
          <meshBasicMaterial color={WINDOW_WARM} toneMapped={false} />
        </mesh>
      ))}

      {/* ── Scoped lighting for the standard-material parts ──────────── */}
      <pointLight position={[2, 1, 2]} intensity={1.2} color="#ffbd80" distance={12} />
      <ambientLight intensity={0.18} color="#6a3878" />
    </group>
  );
}

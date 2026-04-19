// Planet 3 — Singularity active-state reveal.
//
// Mounts conditionally when activePlanet === 'singularity' and renders:
//   • An editor plane (painterly UI rectangle) behind the event-horizon
//     disc — suggests "the editor emerged from inside the singularity."
//   • Six feature-satellite icons orbiting slowly around the editor plane.
//     One per feature on Chapter 1 of the content overlay: BG Remover,
//     CTR Score, A/B Variants, AI Generate, Face Cutout, Templates.
//
// Uses a single `reveal` progress value derived from the galaxy store:
//   - 0 while not active
//   - ramps 0→1 during entering
//   - 1 while on-planet
//   - ramps 1→0 during exiting
//
// Editor plane fades in between reveal 0.3 → 0.7.
// Satellites fade in between reveal 0.6 → 1.0, then hold at full opacity.

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGalaxyStore, PLANET_POSITIONS } from '../state/galaxyStore';

const EDITOR_W = 4.4;
const EDITOR_H = 2.5;
const SAT_ORBIT_R = 3.4;
const SAT_ORBIT_SPEED = 0.18;   // rad/s

// Per-feature satellite configs. Colour-codes each so even at galaxy
// distance they read as distinct items. Each maps 1:1 with the feature
// bullets in PlanetContent.jsx's SingularityBlock.
const FEATURES = [
  { key: 'bg',       color: '#ff9050', shape: 'box',    label: 'BG Remover'   },
  { key: 'ctr',      color: '#ffc870', shape: 'ring',   label: 'CTR Score'    },
  { key: 'ab',       color: '#f0a060', shape: 'duo',    label: 'A/B Variants' },
  { key: 'ai',       color: '#ffb050', shape: 'burst',  label: 'AI Generate'  },
  { key: 'face',     color: '#e89070', shape: 'sphere', label: 'Face Cutout'  },
  { key: 'tpl',      color: '#d8a870', shape: 'grid',   label: 'Templates'    },
];

function SatelliteShape({ color, shape }) {
  switch (shape) {
    case 'ring':
      return (
        <group>
          <mesh>
            <torusGeometry args={[0.16, 0.04, 8, 20]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.085, 0.03, 6, 14]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        </group>
      );
    case 'duo':
      return (
        <group>
          <mesh position={[-0.09, 0.04, 0]}>
            <boxGeometry args={[0.13, 0.13, 0.07]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <mesh position={[0.09, -0.04, 0]}>
            <boxGeometry args={[0.13, 0.13, 0.07]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        </group>
      );
    case 'burst':
      return (
        <group>
          <mesh rotation={[0, 0, 0]}>
            <boxGeometry args={[0.32, 0.05, 0.02]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.32, 0.05, 0.02]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.22, 0.03, 0.02]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <mesh rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[0.22, 0.03, 0.02]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        </group>
      );
    case 'sphere':
      return (
        <mesh>
          <sphereGeometry args={[0.18, 14, 14]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      );
    case 'grid':
      return (
        <group>
          {[-0.08, 0.08].map((y, i) => (
            <mesh key={`h${i}`} position={[0, y, 0]}>
              <boxGeometry args={[0.30, 0.03, 0.02]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
          ))}
          {[-0.08, 0.08].map((x, i) => (
            <mesh key={`v${i}`} position={[x, 0, 0]}>
              <boxGeometry args={[0.03, 0.30, 0.02]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
          ))}
        </group>
      );
    case 'box':
    default:
      return (
        <mesh>
          <boxGeometry args={[0.22, 0.22, 0.08]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      );
  }
}

export default function Planet3SingularityReveal() {
  const groupRef = useRef();
  const editorBodyRef = useRef();
  const editorToolbarRef = useRef();
  const editorCanvasRef = useRef();
  const editorPanelRef = useRef();
  const satWrapRefs = useRef([]);
  const satMatRefs = useRef([]); // flat list of every material that needs opacity

  // Shared reference for opacity animation
  const revealRef = useRef(0);

  useFrame(({ clock }) => {
    const s = useGalaxyStore.getState();
    const active = s.activePlanet === 'singularity';
    let reveal = revealRef.current;

    if (active) {
      if (s.transitionState === 'on-planet') reveal = 1;
      else if (s.transitionState === 'entering') reveal = s.transitionProgress;
      else if (s.transitionState === 'exiting')  reveal = 1 - s.transitionProgress;
    } else {
      reveal = 0;
    }
    revealRef.current = reveal;

    const g = groupRef.current;
    if (!g) return;

    // Hide the whole group when nothing to show.
    const shouldShow = reveal > 0.01;
    if (g.visible !== shouldShow) g.visible = shouldShow;
    if (!shouldShow) return;

    // ── Editor plane opacity: 0 until reveal=0.3, full by 0.7. ─────────
    const editorOp = THREE.MathUtils.clamp((reveal - 0.3) / 0.4, 0, 1);
    [editorBodyRef, editorToolbarRef, editorCanvasRef, editorPanelRef].forEach((r) => {
      if (r.current) r.current.material.opacity = editorOp;
    });

    // ── Satellite opacity: 0 until reveal=0.6, full by 1.0. ────────────
    const satOp = THREE.MathUtils.clamp((reveal - 0.6) / 0.4, 0, 1);
    satMatRefs.current.forEach((m) => { if (m) m.opacity = satOp; });

    // ── Satellite orbit around the editor plane. ───────────────────────
    const t = clock.elapsedTime;
    const satEntryScale = THREE.MathUtils.clamp((reveal - 0.55) / 0.3, 0, 1);
    satWrapRefs.current.forEach((w, i) => {
      if (!w) return;
      const baseAngle = (i / FEATURES.length) * Math.PI * 2;
      const angle = baseAngle + t * SAT_ORBIT_SPEED;
      // Ellipse (flatter on Y so satellites read as a ring, not a sphere).
      w.position.x = Math.cos(angle) * SAT_ORBIT_R;
      w.position.y = Math.sin(angle) * SAT_ORBIT_R * 0.55;
      w.position.z = Math.sin(angle * 0.5) * 0.25; // slight depth wobble
      // Slow tumble per satellite
      w.rotation.x = t * (0.4 + i * 0.05);
      w.rotation.y = t * (0.3 + i * 0.04);
      // Scale-in on reveal
      w.scale.setScalar(satEntryScale);
    });

    // ── Editor plane pulses faintly when fully on-planet. ──────────────
    if (editorBodyRef.current && reveal > 0.9) {
      const pulse = 1 + Math.sin(t * 1.5) * 0.015;
      editorBodyRef.current.scale.setScalar(pulse);
    }
  });

  const [sx, sy, sz] = PLANET_POSITIONS.singularity;
  // Reveal stack sits slightly BEHIND the disc so the disc remains the
  // foreground focal point during the transition.
  const zOff = -1.6;

  // Collect satellite material refs (two passes — on mount the refs
  // resolve and we can grab every material via the satWrapRefs group).
  const collectMat = (groupRef) => {
    if (!groupRef) return;
    groupRef.traverse((node) => {
      if (node.isMesh && node.material) {
        if (node.material.opacity === undefined) node.material.opacity = 0;
        node.material.transparent = true;
        satMatRefs.current.push(node.material);
      }
    });
  };

  return (
    <group ref={groupRef} position={[sx, sy, sz + zOff]} visible={false}>
      {/* ─── Editor plane — painterly rectangle behind the disc ─────── */}
      <mesh ref={editorBodyRef} position={[0, 0, 0]}>
        <planeGeometry args={[EDITOR_W, EDITOR_H]} />
        <meshBasicMaterial
          color="#1f1824"
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
      {/* Toolbar strip */}
      <mesh ref={editorToolbarRef} position={[0, EDITOR_H * 0.42, 0.01]}>
        <planeGeometry args={[EDITOR_W * 0.96, EDITOR_H * 0.12]} />
        <meshBasicMaterial
          color="#3a2430"
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
      {/* Canvas body (the main editing surface) */}
      <mesh ref={editorCanvasRef} position={[-EDITOR_W * 0.08, -EDITOR_H * 0.05, 0.015]}>
        <planeGeometry args={[EDITOR_W * 0.60, EDITOR_H * 0.70]} />
        <meshBasicMaterial
          color="#c86020"
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
      {/* Right-side panel */}
      <mesh ref={editorPanelRef} position={[EDITOR_W * 0.38, -EDITOR_H * 0.05, 0.015]}>
        <planeGeometry args={[EDITOR_W * 0.16, EDITOR_H * 0.70]} />
        <meshBasicMaterial
          color="#2a2030"
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
      {/* Faint paper-highlight frame — top + bottom only */}
      <mesh position={[0, EDITOR_H * 0.495, 0.02]}>
        <planeGeometry args={[EDITOR_W, 0.025]} />
        <meshBasicMaterial color="#f0e4d0" transparent opacity={0} toneMapped={false}
          onUpdate={(m) => { satMatRefs.current.push(m); }} />
      </mesh>
      <mesh position={[0, -EDITOR_H * 0.495, 0.02]}>
        <planeGeometry args={[EDITOR_W, 0.025]} />
        <meshBasicMaterial color="#f0e4d0" transparent opacity={0} toneMapped={false}
          onUpdate={(m) => { satMatRefs.current.push(m); }} />
      </mesh>

      {/* ─── 6 feature satellites orbiting the editor ──────────────── */}
      {FEATURES.map((f, i) => (
        <group
          key={f.key}
          ref={(r) => {
            satWrapRefs.current[i] = r;
            if (r) collectMat(r);
          }}
        >
          <SatelliteShape color={f.color} shape={f.shape} />
        </group>
      ))}
    </group>
  );
}

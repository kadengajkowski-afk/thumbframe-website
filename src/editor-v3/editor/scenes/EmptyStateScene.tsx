import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { KuwaharaEffect } from "@/atmosphere/painterly/KuwaharaEffect";
import { PaperGrainEffect } from "@/atmosphere/painterly/PaperGrainEffect";
import { ColorGradeEffect } from "@/atmosphere/painterly/ColorGradeEffect";
import Nebula from "@/atmosphere/Nebula";
import { useUiStore } from "@/state/uiStore";
import { OceanScene } from "@/editor/scenes/OceanContent";

/** Day 67 (Part 18) — empty-state cosmic scene.
 *
 *  Lives INSIDE the canvas grid cell (not the body bg). Renders
 *  when the editor has no canvas content yet — replaces the prior
 *  static cosmic empty state with a live painterly Three.js scene.
 *
 *  Composition:
 *    - Background plane: deep cosmic gradient, charcoal-deep top,
 *      charcoal middle, slightly purple-blue bottom, with a faint
 *      brass-amber bloom band lower-third.
 *    - Stardust: 250 oversized Point particles (so Kuwahara post
 *      doesn't eat them). Sizes 60% small / 30% medium / 10%
 *      larger. Cream color with varied opacity 30-90%.
 *    - 5 themed constellation paint dabs (compass, anchor, sail,
 *      quill, ship's wheel). NOT lines — pattern recognition only.
 *      Each dab pulses opacity 60-100% on staggered 12-18s loops.
 *    - Shooting star paint streaks: random every 8-15s, varied
 *      angles (20°, 35°, 60°, 145°, 160°), 6-10 trail particles.
 *
 *  Runs r3f at dpr 0.6. The 250 + ~38 + transient streak particles
 *  total ~290. Single Canvas, separate from BodyAtmosphere context. */

const STAR_COUNT = 250;
const CREAM = "#F4EAD5";

// ── Helpers ──────────────────────────────────────────────────

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// ── Painterly cosmic nebula backdrop ────────────────────────
//
// Day 64a-empty-fix — replaces the prior solid-gradient plane with
// the same Nebula component the landing uses (domain-warped fBm,
// ink-rim edge darkening, breathing pulse). Editor-empty-state
// palette is calmer than landing: charcoal-navy with a single
// brass-amber bloom — NO purple / orange / rose. driftSpeed 0.08
// is much slower than landing's 1.0 so the empty state feels
// contemplative rather than animated. Nebula renders as an
// inverted sphere around the camera; constellation dabs +
// shooting stars sit IN FRONT of it and all go through the
// PainterlyPost composer below.
const EMPTY_STATE_PALETTE = {
  core:      "#0F1219",
  mid:       "#1A1F2E",
  highlight: "#2A2A3E",
  accent:    "#B8864B",
};
const EMPTY_STATE_DRIFT = 0.08;

// ── Ambient stars ────────────────────────────────────────────

function StarField() {
  const ref = useRef<THREE.Points>(null);

  const { positions, sizes, alphas } = useMemo(() => {
    const rand = rng(0xCAFEBABE);
    const pos = new Float32Array(STAR_COUNT * 3);
    const sz = new Float32Array(STAR_COUNT);
    const al = new Float32Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT; i++) {
      // Spread across the visible plane area.
      pos[i * 3 + 0] = (rand() - 0.5) * 38;
      pos[i * 3 + 1] = (rand() - 0.5) * 24;
      pos[i * 3 + 2] = -8 - rand() * 6;
      const r = rand();
      sz[i] = r < 0.6 ? 0.02 : r < 0.9 ? 0.05 : 0.08;
      al[i] = r < 0.5 ? 0.30 + rand() * 0.20 : 0.55 + rand() * 0.35;
    }
    return { positions: pos, sizes: sz, alphas: al };
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    // Very slow drift for parallax. Wraps via simple modulo.
    const t = clock.getElapsedTime();
    ref.current.position.x = ((t * 0.2) % 38) - 19;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={STAR_COUNT} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} count={STAR_COUNT} />
        <bufferAttribute attach="attributes-alpha" args={[alphas, 1]} count={STAR_COUNT} />
      </bufferGeometry>
      <pointsMaterial
        color={CREAM}
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </points>
  );
}

// ── Themed constellations as paint dabs (oversize particles) ─

type Constellation = {
  name: string;
  cx: number;
  cy: number;
  dabs: { x: number; y: number; r: number }[];
  delay: number;
};

const CONSTELLATIONS: Constellation[] = [
  {
    // Compass — top-center
    name: "compass",
    cx: 0, cy: 7,
    dabs: [
      { x: 0, y: 1.6, r: 0.22 },   // N
      { x: 0, y: 0,   r: 0.16 },   // hub
      { x: 1.6, y: 0, r: 0.18 },   // E
      { x: 0, y: -1.6, r: 0.16 },  // S
      { x: -1.6, y: 0, r: 0.18 },  // W
    ],
    delay: 0,
  },
  {
    // Anchor — upper-right
    name: "anchor",
    cx: 11, cy: 5,
    dabs: [
      { x: 0, y: 1.6, r: 0.18 },   // ring top
      { x: 0, y: 0.8, r: 0.14 },   // crossbar middle
      { x: -1.0, y: 0.4, r: 0.16 },// crossbar L
      { x: 1.0, y: 0.4, r: 0.16 }, // crossbar R
      { x: 0, y: -1.5, r: 0.20 },  // shaft bottom
      { x: -1.4, y: -1.0, r: 0.14 },// hook L
    ],
    delay: 3,
  },
  {
    // Sail — mid-right
    name: "sail",
    cx: 13, cy: -1,
    dabs: [
      { x: 0, y: 1.6, r: 0.22 },
      { x: 1.4, y: -1.2, r: 0.18 },
      { x: -1.2, y: -1.2, r: 0.18 },
      { x: 0, y: -1.2, r: 0.14 },
    ],
    delay: 6,
  },
  {
    // Quill — upper-left
    name: "quill",
    cx: -10, cy: 5,
    dabs: [
      { x: -1.5, y: 1.4, r: 0.18 },
      { x: -0.8, y: 0.8, r: 0.16 },
      { x: -0.2, y: 0.2, r: 0.20 },
      { x: 0.4, y: -0.4, r: 0.22 },
      { x: 1.0, y: -0.9, r: 0.16 },
      { x: 1.4, y: -1.4, r: 0.14 },
      { x: 1.7, y: -1.7, r: 0.20 },
    ],
    delay: 9,
  },
  {
    // Ship's wheel — mid-left
    name: "wheel",
    cx: -11, cy: -1,
    dabs: (() => {
      const arr = [{ x: 0, y: 0, r: 0.18 }];
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        arr.push({ x: Math.cos(a) * 1.4, y: Math.sin(a) * 1.4, r: 0.16 });
      }
      return arr;
    })(),
    delay: 12,
  },
];

function ConstellationDab({
  x, y, z, r, baseAlpha, delay,
}: {
  x: number; y: number; z: number; r: number; baseAlpha: number; delay: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() + delay;
    // Pulse opacity 60% to 100% over a slow ~14s loop.
    const a = baseAlpha * (0.60 + 0.40 * (0.5 + 0.5 * Math.sin(t * 0.45)));
    const m = ref.current.material as THREE.MeshBasicMaterial;
    m.opacity = a;
  });
  return (
    <mesh ref={ref} position={[x, y, z]}>
      <circleGeometry args={[r, 16]} />
      <meshBasicMaterial color={CREAM} transparent opacity={baseAlpha} depthWrite={false} />
    </mesh>
  );
}

function Constellations() {
  return (
    <>
      {CONSTELLATIONS.map((c) => (
        <group key={c.name} position={[c.cx, c.cy, -7]}>
          {c.dabs.map((d, i) => (
            <ConstellationDab
              key={i}
              x={d.x}
              y={d.y}
              z={0}
              r={d.r}
              baseAlpha={0.85}
              delay={c.delay + i * 0.4}
            />
          ))}
        </group>
      ))}
    </>
  );
}

// ── Shooting star streaks ─────────────────────────────────────

function ShootingStars() {
  // Spawn a single shooting star at a time on a randomized
  // 8-15s cadence. Each streak is 6 trail dots fading from head.
  const [spawn, setSpawn] = useTickSpawn();

  return (
    <>
      {spawn && <ShootingStreak key={spawn.id} {...spawn} onDone={() => setSpawn(null)} />}
    </>
  );
}

type SpawnConfig = {
  id: number;
  startX: number; startY: number;
  endX: number; endY: number;
};

function useTickSpawn(): [SpawnConfig | null, (s: SpawnConfig | null) => void] {
  const [s, setS] = useStateLocal<SpawnConfig | null>(null);
  const idRef = useRef(0);
  const nextRef = useRef(8 + Math.random() * 7);
  const acc = useRef(0);
  useFrame((_, dt) => {
    if (s) return;
    acc.current += dt;
    if (acc.current >= nextRef.current) {
      acc.current = 0;
      nextRef.current = 8 + Math.random() * 7;
      idRef.current += 1;
      // Pick angle from the spec set.
      const angles = [20, 35, 60, 145, 160];
      const angDeg = angles[Math.floor(Math.random() * angles.length)] ?? 35;
      const ang = (angDeg * Math.PI) / 180;
      const dist = 12 + Math.random() * 10;
      const startX = (Math.random() - 0.5) * 30;
      const startY = (Math.random() - 0.5) * 18;
      const endX = startX + Math.cos(ang) * dist;
      const endY = startY + Math.sin(ang) * dist;
      setS({ id: idRef.current, startX, startY, endX, endY });
    }
  });
  return [s, setS];
}

// Tiny local useState that doesn't flush on every parent rerender
// when we don't need to. We use the real hook here; this wrapper
// just centralizes the type.
import { useState as useStateLocal } from "react";

function ShootingStreak({
  startX, startY, endX, endY, onDone,
}: {
  id: number;
  startX: number; startY: number;
  endX: number; endY: number;
  onDone: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const matsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const elapsed = useRef(0);
  const TRAVEL_SEC = 2.5;
  const FADE_SEC = 1.5;

  // Day 64a-empty-fix — 8 trail particles spaced 0.18 world units
  // apart (~6 screen-px at z=-6 with our camera). Head r=0.16
  // (~6px diameter), tail r=0.10 (~4px) per spec. Backward unit
  // vector along travel direction so the trail trails the head.
  const trailCount = 8;
  const dxNorm = endX - startX;
  const dyNorm = endY - startY;
  const len = Math.hypot(dxNorm, dyNorm) || 1;
  const ux = -dxNorm / len;
  const uy = -dyNorm / len;
  const STEP = 0.18;

  useFrame((_, dt) => {
    elapsed.current += dt;
    const tTravel = Math.min(elapsed.current / TRAVEL_SEC, 1);
    if (groupRef.current) {
      groupRef.current.position.x = (endX - startX) * tTravel;
      groupRef.current.position.y = (endY - startY) * tTravel;
    }
    // Day 64a-empty-fix — explicit fade across the FADE_SEC tail.
    // Without this the trail froze in place + popped out.
    const fadeT = Math.max(
      0,
      Math.min(1, (elapsed.current - TRAVEL_SEC) / FADE_SEC),
    );
    const fadeMul = 1 - fadeT;
    matsRef.current.forEach((m, i) => {
      const t = i / (trailCount - 1);
      const baseAlpha = 1.0 - t * 0.85;
      m.opacity = baseAlpha * fadeMul;
    });
    if (elapsed.current > TRAVEL_SEC + FADE_SEC) onDone();
  });

  return (
    <group ref={groupRef} position={[startX, startY, -6]}>
      {Array.from({ length: trailCount }).map((_, i) => {
        const t = i / (trailCount - 1);
        const r = 0.16 - t * 0.06;
        const alpha = 1.0 - t * 0.85;
        return (
          <mesh key={i} position={[ux * STEP * i, uy * STEP * i, 0]}>
            <circleGeometry args={[r, 14]} />
            <meshBasicMaterial
              ref={(m) => {
                if (m) matsRef.current[i] = m;
              }}
              color={CREAM}
              transparent
              opacity={alpha}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Painterly post-processing ────────────────────────────────
//
// Mirrors the landing PainterlyPost pipeline (src/landing/shaders/
// painterly/PainterlyPost.jsx) MINUS the outline pass — the empty
// state's loose paint dabs already read as painted; an extra ink
// wash over them muddies the constellation read. Kuwahara kernelFar
// 6 + PaperGrain strength 0.28 / scale 600 + ColorGrade strength
// 0.7 match the landing intensity exactly.

const IS_MOBILE =
  typeof window !== "undefined" && window.innerWidth < 768;
const KUWAHARA_SCALE = IS_MOBILE ? 0.25 : 0.40;

function KuwaharaPass() {
  const { size, viewport } = useThree();
  const effect = useMemo(
    () =>
      new KuwaharaEffect({
        kernelNear: 2.0,
        kernelFar: IS_MOBILE ? 5.0 : 6.0,
      }),
    [],
  );
  useEffect(() => {
    const dpr = viewport.dpr || 1;
    effect.setSize(
      size.width * dpr * KUWAHARA_SCALE,
      size.height * dpr * KUWAHARA_SCALE,
    );
  }, [size, viewport, effect]);
  return <primitive object={effect} dispose={null} />;
}

function PaperGrainPass() {
  const effect = useMemo(
    () => new PaperGrainEffect({ strength: 0.28, scale: 600 }),
    [],
  );
  return <primitive object={effect} dispose={null} />;
}

function ColorGradePass() {
  const effect = useMemo(() => new ColorGradeEffect({ strength: 0.7 }), []);
  return <primitive object={effect} dispose={null} />;
}

// ── Composed scene ────────────────────────────────────────────

export function EmptyStateScene() {
  const theme = useUiStore((s) => s.theme);
  const isLight = theme === "light";
  return (
    <div
      aria-hidden="true"
      data-alive="empty-state-scene"
      data-theme={theme}
      style={{
        // Fill the viewport behind the upload card. The card has
        // its own wrap with z-index:1; this scene is z-index:0 and
        // covers the editor's empty state space entirely.
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <Canvas
        gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
        dpr={0.6}
        camera={{ position: [0, 0, 12], fov: 50, near: 0.1, far: 100 }}
      >
        {isLight ? (
          // Day 64e — ocean horizon for light mode. Same painterly
          // pipeline (Kuwahara + paper grain + color grade) so the
          // watercolor character matches the cosmic mode.
          <OceanScene />
        ) : (
          <>
            <Nebula
              palette={EMPTY_STATE_PALETTE}
              driftSpeed={EMPTY_STATE_DRIFT}
            />
            <StarField />
            <Constellations />
            <ShootingStars />
          </>
        )}
        <EffectComposer multisampling={0} resolutionScale={0.5} depthBuffer>
          <KuwaharaPass />
          <PaperGrainPass />
          <ColorGradePass />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

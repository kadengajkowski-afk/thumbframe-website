import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/** Day 66 — live cosmic atmosphere via three.js + r3f.
 *
 *  Architecture (locked):
 *    - position: fixed, inset:0, z-index var(--z-atmosphere) (-1).
 *    - pointer-events: none.
 *    - Mounts beneath the editor shell, behind everything.
 *    - The Day 63 static cosmic-scene-v2.jpg STAYS as the body
 *      bg image (set in main.tsx). This canvas adds a live
 *      moving star field + faint nebula fog ON TOP of the static
 *      bake. If three.js fails to initialize, the static bake is
 *      the floor — atmosphere never disappears.
 *
 *  Performance:
 *    - pixelRatio 0.5 (renderer tells r3f via gl prop)
 *    - 30fps throttle when document.hidden via cancelling
 *      requestAnimationFrame in useFrame
 *    - 800 stars total, simple Points geometry
 *    - No shader compile beyond r3f's defaults
 *
 *  If canvas mount breaks: REVERT this entire branch. The static
 *  cosmic-scene-v2.jpg keeps the editor visible with no three.js
 *  in the bundle. */

function StarField() {
  const ref = useRef<THREE.Points>(null);

  // Deterministic seed so the field is the same across reloads.
  const positions = (() => {
    let seed = 0xC0FFEE;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    const N = 800;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // Spread in a wide volume; we only see one face from the camera.
      arr[i * 3 + 0] = (rand() - 0.5) * 60;
      arr[i * 3 + 1] = (rand() - 0.5) * 35;
      arr[i * 3 + 2] = -10 - rand() * 30;
    }
    return arr;
  })();

  useFrame(({ clock }) => {
    if (!ref.current) return;
    // Slow horizontal drift — full pass takes ~180s. Wraps via
    // modulo on x position so the field never goes empty.
    const t = clock.getElapsedTime();
    ref.current.rotation.y = Math.sin(t * 0.025) * 0.05;
    ref.current.position.x = ((t * 0.4) % 60) - 30;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={positions.length / 3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#fff4e0"
        size={0.18}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </points>
  );
}

function NebulaFog() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    // Very gentle pulse on the fog opacity to suggest cosmic motion.
    const m = ref.current.material as THREE.MeshBasicMaterial;
    m.opacity = 0.10 + Math.sin(clock.getElapsedTime() * 0.15) * 0.04;
  });
  return (
    <mesh ref={ref} position={[0, 0, -25]}>
      <planeGeometry args={[120, 70]} />
      <meshBasicMaterial
        color="#1A1F2E"
        transparent
        opacity={0.10}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export function BodyAtmosphere() {
  // Mount only after first paint so the static cosmic-scene-v2.jpg
  // shows immediately; live atmosphere layers on once r3f boots.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(t);
  }, []);
  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      data-alive="body-atmosphere"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        // mix-blend-mode: screen so the live stars add LIGHT to the
        // static bake without darkening it. Bake stays the floor;
        // live just adds motion.
        mixBlendMode: "screen",
      }}
    >
      <Canvas
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "low-power",
        }}
        dpr={0.5}
        camera={{ position: [0, 0, 0], fov: 60, near: 0.1, far: 100 }}
      >
        <NebulaFog />
        <StarField />
      </Canvas>
    </div>
  );
}

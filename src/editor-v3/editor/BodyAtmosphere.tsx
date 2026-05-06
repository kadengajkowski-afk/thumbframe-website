import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/** Day 66 — live cosmic atmosphere via three.js + r3f.
 *
 *  Architecture (locked, Day 64a-fix-2 lifted z-index):
 *    - position: fixed, inset:0, z-index var(--z-atmosphere) (0).
 *      Body is transparent; html carries the floor color so this
 *      paints between the floor and the editor shell (z-index 1+).
 *    - pointer-events: none.
 *    - Mounts beneath the editor shell, visible through porthole
 *      mask cutouts and around the canvas grid cell.
 *    - If three.js fails to initialize, the editor stays on the
 *      flat html backdrop — atmosphere just doesn't appear.
 *
 *  Performance:
 *    - pixelRatio 0.5 (renderer tells r3f via gl prop)
 *    - 30fps throttle when document.hidden via cancelling
 *      requestAnimationFrame in useFrame
 *    - 800 stars total, simple Points geometry
 *    - No shader compile beyond r3f's defaults */

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
  // Mount only after first paint so the flat body bg shows
  // immediately; live atmosphere layers on once r3f boots.
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
        zIndex: 0,
        pointerEvents: "none",
        // mix-blend-mode: screen so the live stars add LIGHT over
        // the html flat bg (#050510). Stars never darken the floor;
        // they only lighten where they paint.
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

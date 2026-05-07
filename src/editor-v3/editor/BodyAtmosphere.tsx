import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useUiStore } from "@/state/uiStore";
import { OceanScene } from "@/editor/scenes/OceanContent";

/** Day 66 — live cosmic atmosphere via three.js + r3f.
 *  Day 64e — extended with an ocean variant for light mode.
 *
 *  Cosmic (dark): StarField + NebulaFog. Mounted with mix-blend-mode:
 *    screen so cream stars add light over the dark html floor.
 *
 *  Ocean (light): horizon gradient + drifting cream/white cloud blobs
 *    + 1-2 pale fish silhouettes underwater. Mounted with normal
 *    blend so deeper water reads opaquely on top of the html floor.
 *
 *  Both use the same r3f canvas, dpr 0.5, alpha:true. Theme switches
 *  swap the children only — the canvas stays mounted. */

function StarField() {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    let seed = 0xC0FFEE;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    const N = 800;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      arr[i * 3 + 0] = (rand() - 0.5) * 60;
      arr[i * 3 + 1] = (rand() - 0.5) * 35;
      arr[i * 3 + 2] = -10 - rand() * 30;
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
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

function CosmicScene() {
  return (
    <>
      <NebulaFog />
      <StarField />
    </>
  );
}

export function BodyAtmosphere() {
  const theme = useUiStore((s) => s.theme);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(t);
  }, []);
  if (!mounted) return null;

  // Cosmic uses mix-blend-mode: screen so cream stars add light to
  // the dark html floor. Ocean uses normal blend — deeper water reads
  // opaquely against the lighter html floor.
  const blendMode = theme === "light" ? "normal" : "screen";

  return (
    <div
      aria-hidden="true"
      data-alive="body-atmosphere"
      data-theme={theme}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        mixBlendMode: blendMode,
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
        {theme === "light" ? <OceanScene /> : <CosmicScene />}
      </Canvas>
    </div>
  );
}

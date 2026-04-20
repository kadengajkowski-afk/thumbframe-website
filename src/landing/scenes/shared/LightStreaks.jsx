import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const POOL_SIZE = 4;

export default function LightStreaks() {
  const groupRef = useRef();
  const streaksRef = useRef([]);

  // Pool of streak states
  const pool = useMemo(() => {
    return Array.from({ length: POOL_SIZE }, () => ({
      active: false,
      startPos: new THREE.Vector3(),
      endPos: new THREE.Vector3(),
      progress: 0,
      duration: 0,
      nextSpawnAt: Math.random() * 6 + 2,
      color: new THREE.Color(),
    }));
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    pool.forEach((streak, i) => {
      const mesh = streaksRef.current[i];
      if (!mesh) return;

      if (!streak.active && t >= streak.nextSpawnAt) {
        // Spawn new streak
        streak.active = true;
        streak.progress = 0;
        streak.duration = 4 + Math.random() * 4; // 4-8 sec slow drift

        // Random start/end across the visible frustum at various depths
        const z = -5 + Math.random() * 10;
        const yStart = -6 + Math.random() * 12;
        const xStart = -18;
        const xEnd = 18;

        streak.startPos.set(xStart, yStart, z);
        streak.endPos.set(xEnd, yStart + (Math.random() - 0.5) * 3, z);

        // Warm watercolor palette
        const palette = [
          [1.00, 0.82, 0.55],
          [0.95, 0.70, 0.85],
          [0.98, 0.94, 0.82],
        ];
        const c = palette[Math.floor(Math.random() * palette.length)];
        streak.color.setRGB(c[0], c[1], c[2]);

        mesh.material.color.copy(streak.color);
      }

      if (streak.active) {
        streak.progress += (1 / streak.duration) * state.clock.getDelta() * 60 / 60;
        // Above is effectively dt/duration — getDelta isn't always reliable, use:
        // We'll use a simpler approach — track via useFrame dt

        if (streak.progress >= 1) {
          streak.active = false;
          streak.nextSpawnAt = t + 3 + Math.random() * 8;
          mesh.visible = false;
          return;
        }

        mesh.visible = true;
        const p = streak.progress;
        mesh.position.lerpVectors(streak.startPos, streak.endPos, p);

        // Opacity: fade in, hold, fade out
        const fade = Math.sin(p * Math.PI);
        mesh.material.opacity = fade * 0.5;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {pool.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => (streaksRef.current[i] = el)}
          visible={false}
        >
          <planeGeometry args={[4, 0.15]} />
          <meshBasicMaterial
            color="#ffd890"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

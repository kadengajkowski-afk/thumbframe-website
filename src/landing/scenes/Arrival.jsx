// Scene 1 — Arrival (scroll 0.0 – 1.0)
// Deep nebula, space station (right of center for overlay text), stardust,
// distant planet silhouette with nebula color pickup.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import * as THREE from 'three';
import SpaceStation from './SpaceStation';
import Stardust from './Stardust';

// Distant planet — subtle rim light + nebula color pickup, not a black void
const distantPlanetVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalMatrix * normal;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const distantPlanetFrag = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 lightDir = normalize(vec3(1.0, 0.5, 0.3));
    float NdotL = max(dot(n, lightDir), 0.0);

    // Base: very dark violet, not black
    vec3 color = vec3(0.08, 0.05, 0.12);

    // Faint lit side from the nebula's amber glow
    color += vec3(0.15, 0.08, 0.05) * NdotL * 0.5;

    // Rim light — nebula scatter
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    color += vec3(0.20, 0.12, 0.25) * rim * 0.6;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function DistantPlanet() {
  const uniforms = useMemo(() => ({}), []);
  const meshRef = useRef();
  const scroll = useScroll();

  // Only render during Scene 1 (and a short lead-in to Scene 2). Hidden once
  // the camera moves into the wormhole region so it doesn't clip the frame.
  useFrame(() => {
    if (!meshRef.current) return;
    const sceneIdx = scroll.offset * 7;
    meshRef.current.visible = sceneIdx < 1.5;
  });

  return (
    <mesh ref={meshRef} position={[18, -4, -45]}>
      <sphereGeometry args={[5, 24, 24]} />
      <shaderMaterial
        vertexShader={distantPlanetVert}
        fragmentShader={distantPlanetFrag}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export default function Arrival() {
  const groupRef = useRef();
  const scroll = useScroll();

  useFrame(({ clock, camera }) => {
    const sceneIdx = scroll.offset * 7;

    // Arrival owns the frame up to sceneIdx 1.95. Past that the wormhole takes
    // over exclusively — hide the entire Arrival group so leftover Station /
    // DistantPlanet / Stardust geometry can't leak into wormhole shots (the
    // "purple planet to the right" regression).
    if (groupRef.current) {
      const shouldShow = sceneIdx < 1.95;
      if (groupRef.current.visible !== shouldShow) {
        groupRef.current.visible = shouldShow;
      }
    }

    // Arrival owns the camera for sceneIdx 0 → 1.95. At 1.95, Wormhole's
    // CameraRig takes over (matches this phase's end state exactly).
    //
    //   [0.00, 0.85]  station viewing (original Scene 1)
    //   [0.85, 1.00]  arc left past the ship — ship swings from centre to +X side
    //   [1.00, 1.95]  fly forward toward wormhole approach start
    //
    // Past 1.95 this block early-returns so Wormhole can take over cleanly.
    if (sceneIdx >= 1.95) return;

    const t = clock.elapsedTime;

    if (sceneIdx < 0.85) {
      // Phase A — station viewing.
      const p = sceneIdx / 0.85; // 0..1
      const startZ = 12;
      const endZ = 2;
      const z = THREE.MathUtils.lerp(startZ, endZ, p * p);

      const drift  = Math.sin(t * 0.3) * 0.2;
      const driftY = Math.sin(t * 0.2 + 1.0) * 0.1;

      camera.position.set(-2.0 + drift, driftY + 0.3, z);

      const lookX = THREE.MathUtils.lerp(3, 6, p);
      const lookY = THREE.MathUtils.lerp(0, -0.8, p);
      const lookZ = THREE.MathUtils.lerp(0, -12, p);
      camera.lookAt(lookX, lookY, lookZ);
      return;
    }

    if (sceneIdx < 1.0) {
      // Phase B — arc past the ship. Camera swings left (ship is at x=+3)
      // and forward past the ship's z extent (~[-2.5, 2.5] at scale 2.5).
      // Start: (-2, 0.3, 2) looking at (6, -0.8, -12)   ← phase A end
      // End:   (-4.2, 0.4, -8) looking at (0, 0, -30)  ← ship now off to the right
      const p = (sceneIdx - 0.85) / 0.15;
      const e = p * p * (3.0 - 2.0 * p); // smoothstep

      const driftX = Math.sin(t * 0.3) * 0.15 * (1.0 - e);
      const driftY = Math.sin(t * 0.2 + 1.0) * 0.08 * (1.0 - e);

      camera.position.set(
        THREE.MathUtils.lerp(-2.0, -4.2, e) + driftX,
        THREE.MathUtils.lerp(0.3, 0.4, e) + driftY,
        THREE.MathUtils.lerp(2.0, -8.0, e),
      );

      camera.lookAt(
        THREE.MathUtils.lerp(6.0, 0.0, e),
        THREE.MathUtils.lerp(-0.8, 0.0, e),
        THREE.MathUtils.lerp(-12.0, -30.0, e),
      );
      return;
    }

    // Phase C — fly forward toward wormhole approach start.
    // End state matches Wormhole Step 1 start: (0, 0.4, -17) looking at (0,0,-45).
    const p = (sceneIdx - 1.0) / 0.95;
    const e = p * p * (3.0 - 2.0 * p);

    camera.position.set(
      THREE.MathUtils.lerp(-4.2, 0.0, e),
      0.4,
      THREE.MathUtils.lerp(-8.0, -17.0, e),
    );

    camera.lookAt(
      0.0,
      THREE.MathUtils.lerp(0.0, 0.0, e),
      THREE.MathUtils.lerp(-30.0, -45.0, e),
    );
  });

  return (
    <group ref={groupRef}>
      {/* Station at ~68% horizontal, scaled 2.5x for visible architecture */}
      <SpaceStation position={[3, 0, 0]} scale={2.5} />

      <DistantPlanet />
      <Stardust />

      {/* Lighting */}
      <directionalLight position={[5, 4, 3]} intensity={0.9} color="#f0c080" />
      <ambientLight intensity={0.35} color="#8060a0" />
      <directionalLight position={[-3, 1, -5]} intensity={0.15} color="#6040a0" />
    </group>
  );
}

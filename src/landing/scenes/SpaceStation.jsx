// Procedural space station — asymmetric, mixed shape language.
// Moebius/NASA concept art reference: cylinders, angled modules, visible
// antennae, docking bay with inner glow, large window panels.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const toonVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalMatrix * normal;
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const toonFrag = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uLightDir;
  uniform float uRimPower;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 l = normalize(uLightDir);
    float NdotL = dot(n, l);

    // 3-band ramp with warm highlight / deep violet shadow
    vec3 warmHighlight = vec3(0.83, 0.78, 0.69); // ~#d4c8b0
    vec3 deepShadow   = vec3(0.23, 0.18, 0.29); // ~#3a2d4a

    vec3 color;
    if (NdotL > 0.4) color = mix(uBaseColor, warmHighlight, 0.45);
    else if (NdotL > -0.05) color = uBaseColor * 0.6;
    else color = mix(uBaseColor * 0.3, deepShadow, 0.6);

    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), uRimPower);
    color += vec3(0.40, 0.35, 0.55) * rim * 0.35;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function Toon({ color = '#8080a0', rimPower = 3.0 }) {
  const uniforms = useMemo(() => ({
    uBaseColor: { value: new THREE.Color(color) },
    uLightDir: { value: new THREE.Vector3(5, 4, 3).normalize() },
    uRimPower: { value: rimPower },
  }), [color, rimPower]);
  return <shaderMaterial vertexShader={toonVert} fragmentShader={toonFrag} uniforms={uniforms} />;
}

function Glow({ color = '#f9a040' }) {
  return <meshBasicMaterial color={color} toneMapped={false} />;
}

export default function SpaceStation({ position = [0, 0, 0], scale = 1 }) {
  const groupRef = useRef();
  const dishRef = useRef();
  const beacon1Ref = useRef();
  const beacon2Ref = useRef();

  useFrame(({ clock }) => {
    // Full rotation in ~75 seconds: 2*PI / (75*60) ≈ 0.0014 rad/frame
    if (groupRef.current) groupRef.current.rotation.y += 0.0014;
    if (dishRef.current) dishRef.current.rotation.y = clock.elapsedTime * 0.35;

    // Pulsing beacons at ~1Hz
    const pulse = Math.sin(clock.elapsedTime * 6.28) * 0.3 + 0.9;
    if (beacon1Ref.current) beacon1Ref.current.material.opacity = pulse;
    if (beacon2Ref.current) beacon2Ref.current.material.opacity = 1.3 - pulse;
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>

      {/* ═══ MAIN HULL — long horizontal cylinder, the spine ═══ */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.45, 0.5, 3.2, 8]} />
        <Toon color="#6a6a8a" />
      </mesh>

      {/* Hull segment ring — breaks up the cylinder visually */}
      <mesh position={[0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, 0.08, 8]} />
        <Toon color="#5a5a7a" />
      </mesh>
      <mesh position={[-0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.53, 0.53, 0.06, 8]} />
        <Toon color="#5a5a7a" />
      </mesh>

      {/* ═══ BRIDGE MODULE — upper, offset forward-right, octagonal ═══ */}
      <mesh position={[0.6, 0.55, 0.1]}>
        <cylinderGeometry args={[0.35, 0.38, 0.4, 8]} />
        <Toon color="#7a7a9a" />
      </mesh>
      {/* Bridge window band — large amber rectangle */}
      <mesh position={[0.6, 0.55, 0.39]}>
        <planeGeometry args={[0.45, 0.18]} />
        <Glow color="#f0a040" />
      </mesh>
      {/* Bridge window side */}
      <mesh position={[0.97, 0.55, 0.1]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.35, 0.18]} />
        <Glow color="#d08030" />
      </mesh>

      {/* ═══ HABITAT RING — torus offset below, asymmetric ═══ */}
      <mesh position={[-0.2, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.8, 0.1, 8, 16]} />
        <Toon color="#6a6888" />
      </mesh>
      {/* Ring struts (4 connecting to hull) */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a, i) => (
        <mesh key={i} position={[-0.2 + Math.cos(a) * 0.4, -0.15, Math.sin(a) * 0.4]}
          rotation={[0, 0, a * 0.5]} scale={[0.03, 0.35, 0.03]}>
          <boxGeometry />
          <Toon color="#5a5878" />
        </mesh>
      ))}

      {/* ═══ ENGINE SECTION — rear, angled, larger ═══ */}
      <mesh position={[-1.4, 0.1, 0]} rotation={[0, 0, Math.PI / 2 + 0.08]}>
        <cylinderGeometry args={[0.3, 0.55, 0.8, 6]} />
        <Toon color="#555578" />
      </mesh>
      {/* Engine nozzle cluster — 3 cones */}
      {[[-1.85, 0.25, 0.15], [-1.85, -0.05, -0.18], [-1.85, 0.15, -0.05]].map((p, i) => (
        <mesh key={i} position={p} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.12, 0.3, 6]} />
          <Toon color="#4a4a6a" />
        </mesh>
      ))}
      {/* Engine exhaust — warm orange core + violet outer bloom */}
      <mesh position={[-1.9, 0.12, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <Glow color="#f09030" />
      </mesh>
      <mesh position={[-1.95, 0.12, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial color="#6a40c0" transparent opacity={0.25} toneMapped={false} />
      </mesh>
      {/* Thrust trail — faint painterly streak extending left */}
      <mesh position={[-2.4, 0.12, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.08, 1.0, 6]} />
        <meshBasicMaterial color="#c07030" transparent opacity={0.12} toneMapped={false} />
      </mesh>
      <mesh position={[-2.8, 0.12, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.04, 0.6, 6]} />
        <meshBasicMaterial color="#8050a0" transparent opacity={0.06} toneMapped={false} />
      </mesh>

      {/* ═══ DOCKING BAY — right side, rectangular inset with amber inner glow ═══ */}
      <group position={[1.5, -0.15, 0.2]}>
        {/* Outer frame */}
        <mesh>
          <boxGeometry args={[0.5, 0.55, 0.6]} />
          <Toon color="#5a5a7a" />
        </mesh>
        {/* Inner cavity (dark recess) */}
        <mesh position={[0.15, 0, 0]}>
          <boxGeometry args={[0.25, 0.35, 0.4]} />
          <meshBasicMaterial color="#15101a" />
        </mesh>
        {/* Amber interior glow */}
        <mesh position={[0.02, 0, 0]}>
          <planeGeometry args={[0.2, 0.3]} />
          <Glow color="#c07020" />
        </mesh>
        {/* Docking guide lights — two small dots */}
        <mesh position={[0.26, 0.2, 0.22]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <Glow color="#40c070" />
        </mesh>
        <mesh position={[0.26, 0.2, -0.22]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <Glow color="#40c070" />
        </mesh>
      </group>

      {/* ═══ SOLAR PANEL ARRAY — offset, angled, asymmetric ═══ */}
      <group position={[0.3, 0.15, 0.85]} rotation={[0.15, 0.1, 0.05]}>
        {/* Panel arm */}
        <mesh>
          <boxGeometry args={[0.04, 0.04, 0.5]} />
          <Toon color="#5a6a80" />
        </mesh>
        {/* Panel left */}
        <mesh position={[-0.45, 0, 0.1]}>
          <boxGeometry args={[0.85, 0.02, 0.35]} />
          <Toon color="#3a5070" />
        </mesh>
        {/* Panel right (shorter — asymmetry) */}
        <mesh position={[0.35, 0, 0.1]}>
          <boxGeometry args={[0.6, 0.02, 0.35]} />
          <Toon color="#3a5070" />
        </mesh>
      </group>

      {/* ═══ ANTENNAE — 3 tall thin masts, 3x longer, 50% thinner ═══ */}
      {/* Antenna 1: tallest, slight backward tilt */}
      <group position={[0.2, 0.5, -0.15]}>
        <mesh rotation={[0.12, 0, -0.08]}>
          <cylinderGeometry args={[0.006, 0.012, 2.8, 4]} />
          <Toon color="#9090a8" />
        </mesh>
        {/* Crossbar near tip */}
        <mesh position={[0, 1.35, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.004, 0.004, 0.25, 4]} />
          <Toon color="#a0a0b0" />
        </mesh>
        {/* Warm tip highlight */}
        <mesh position={[0, 1.42, 0]}>
          <sphereGeometry args={[0.018, 6, 6]} />
          <Glow color="#f0c080" />
        </mesh>
      </group>
      {/* Antenna 2: medium, tilted left */}
      <group position={[-0.4, 0.5, 0.2]}>
        <mesh rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.005, 0.01, 2.0, 4]} />
          <Toon color="#9090a8" />
        </mesh>
        <mesh position={[-0.2, 0.95, 0]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <Glow color="#f0c080" />
        </mesh>
      </group>
      {/* Antenna 3: shorter, tilted right-forward */}
      <group position={[0.8, 0.45, -0.1]}>
        <mesh rotation={[-0.15, 0, -0.25]}>
          <cylinderGeometry args={[0.005, 0.008, 1.4, 4]} />
          <Toon color="#9090a8" />
        </mesh>
        <mesh position={[0.17, 0.67, 0]}>
          <sphereGeometry args={[0.012, 6, 6]} />
          <Glow color="#f0c080" />
        </mesh>
      </group>

      {/* ═══ COMMS ARRAY / RADAR DISH — rotating, on top ═══ */}
      <group ref={dishRef} position={[-0.1, 0.72, 0.05]}>
        {/* Dish mount */}
        <mesh>
          <cylinderGeometry args={[0.03, 0.03, 0.15, 6]} />
          <Toon color="#8080a0" />
        </mesh>
        {/* Dish — flattened cone */}
        <mesh position={[0, 0.12, 0]} rotation={[0.3, 0, 0]}>
          <coneGeometry args={[0.25, 0.08, 12]} />
          <Toon color="#8888a8" />
        </mesh>
        {/* Feed horn */}
        <mesh position={[0, 0.2, 0.05]} rotation={[0.3, 0, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.15, 4]} />
          <Toon color="#a0a0b0" />
        </mesh>
      </group>

      {/* ═══ BEACONS — pulsing amber, on antenna tips ═══ */}
      <mesh ref={beacon1Ref} position={[0.2, 1.08, -0.15]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshBasicMaterial color="#f0a030" transparent toneMapped={false} />
      </mesh>
      <mesh ref={beacon2Ref} position={[-0.4, 0.9, 0.2]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshBasicMaterial color="#f0a030" transparent toneMapped={false} />
      </mesh>

      {/* ═══ HULL DETAIL WINDOWS — scattered amber panels ═══ */}
      {/* Forward window strip */}
      <mesh position={[0.9, 0.1, 0.47]}>
        <planeGeometry args={[0.5, 0.08]} />
        <Glow color="#d89030" />
      </mesh>
      {/* Mid-hull window */}
      <mesh position={[-0.2, 0.2, 0.48]}>
        <planeGeometry args={[0.2, 0.12]} />
        <Glow color="#c08028" />
      </mesh>
      {/* Underside running light */}
      <mesh position={[0.3, -0.48, 0.1]}>
        <planeGeometry args={[0.15, 0.04]} />
        <Glow color="#f97316" />
      </mesh>

      {/* ═══ ThumbFrame logo — orange square on hull ═══ */}
      <mesh position={[1.0, 0.3, 0.48]}>
        <planeGeometry args={[0.2, 0.2]} />
        <meshBasicMaterial color="#f97316" />
      </mesh>
    </group>
  );
}

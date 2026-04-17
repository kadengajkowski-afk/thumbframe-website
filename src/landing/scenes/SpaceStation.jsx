// Procedural space station — ~300 tris, asymmetric, built from primitives.
// Stepped toon ramp material, orange emissive window + blinking beacon.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 3-band toon ramp material
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

    // 3-band toon ramp
    float shade;
    if (NdotL > 0.5) shade = 1.0;
    else if (NdotL > 0.0) shade = 0.65;
    else shade = 0.35;

    vec3 color = uBaseColor * shade;

    // Rim light (faked)
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), uRimPower);
    color += vec3(0.3, 0.4, 0.5) * rim * 0.25;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function ToonMaterial({ color = '#8080a0', rimPower = 3.0 }) {
  const uniforms = useMemo(() => ({
    uBaseColor: { value: new THREE.Color(color) },
    uLightDir: { value: new THREE.Vector3(5, 4, 3).normalize() },
    uRimPower: { value: rimPower },
  }), [color, rimPower]);

  return <shaderMaterial vertexShader={toonVert} fragmentShader={toonFrag} uniforms={uniforms} />;
}

function GlowMesh({ position, scale = [0.1, 0.1, 0.1], color = '#f97316', intensity = 2.0 }) {
  return (
    <mesh position={position} scale={scale}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

export default function SpaceStation({ position = [0, 0, 0], scale = 1 }) {
  const groupRef = useRef();
  const dishRef = useRef();
  const beaconRef = useRef();

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0008;
    }
    if (dishRef.current) {
      dishRef.current.rotation.y = clock.elapsedTime * 0.4;
    }
    if (beaconRef.current) {
      const pulse = Math.sin(clock.elapsedTime * 3.0) * 0.5 + 0.5;
      beaconRef.current.material.opacity = 0.3 + pulse * 0.7;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Main hull — elongated box, slightly tapered */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.8, 0.6, 0.8]} />
        <ToonMaterial color="#6a6a8a" />
      </mesh>

      {/* Bridge module — offset cylinder on top */}
      <mesh position={[0.3, 0.45, 0]}>
        <cylinderGeometry args={[0.25, 0.3, 0.35, 6]} />
        <ToonMaterial color="#7a7a9a" />
      </mesh>

      {/* Engine block — rear, wider */}
      <mesh position={[-0.8, -0.05, 0]}>
        <boxGeometry args={[0.5, 0.7, 0.9]} />
        <ToonMaterial color="#5a5a7a" />
      </mesh>

      {/* Engine nozzles — two cylinders */}
      <mesh position={[-1.1, 0.15, 0.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.12, 0.25, 8]} />
        <ToonMaterial color="#4a4a6a" />
      </mesh>
      <mesh position={[-1.1, -0.15, -0.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.12, 0.25, 8]} />
        <ToonMaterial color="#4a4a6a" />
      </mesh>

      {/* Docking bay — open-faced box on the right side */}
      <mesh position={[1.1, -0.1, 0]}>
        <boxGeometry args={[0.4, 0.45, 0.5]} />
        <ToonMaterial color="#5a5a7a" />
      </mesh>

      {/* Solar panel arm — thin offset */}
      <mesh position={[0, 0.1, 0.7]}>
        <boxGeometry args={[1.2, 0.02, 0.4]} />
        <ToonMaterial color="#3a5070" />
      </mesh>

      {/* Antenna 1 — tall, tilted */}
      <mesh position={[0.5, 0.7, 0.1]} rotation={[0, 0, -0.15]}>
        <cylinderGeometry args={[0.015, 0.015, 0.6, 4]} />
        <ToonMaterial color="#9090a0" />
      </mesh>

      {/* Antenna 2 — shorter, different angle */}
      <mesh position={[-0.3, 0.55, -0.2]} rotation={[0.2, 0, 0.3]}>
        <cylinderGeometry args={[0.012, 0.012, 0.4, 4]} />
        <ToonMaterial color="#9090a0" />
      </mesh>

      {/* Antenna 3 — offset rear */}
      <mesh position={[-0.6, 0.5, 0.15]} rotation={[-0.1, 0, -0.2]}>
        <cylinderGeometry args={[0.01, 0.01, 0.35, 4]} />
        <ToonMaterial color="#9090a0" />
      </mesh>

      {/* Radar dish — slowly rotating */}
      <group ref={dishRef} position={[0.2, 0.65, -0.1]}>
        <mesh rotation={[Math.PI / 4, 0, 0]}>
          <coneGeometry args={[0.18, 0.06, 8]} />
          <ToonMaterial color="#8888a8" />
        </mesh>
        <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 4, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.12, 4]} />
          <ToonMaterial color="#9090a0" />
        </mesh>
      </group>

      {/* Glowing window — warm orange emissive */}
      <GlowMesh position={[0.4, 0.3, 0.41]} scale={[0.12, 0.06, 0.02]} color="#f9a040" />

      {/* Blinking beacon — amber */}
      <mesh ref={beaconRef} position={[0.5, 0.98, 0.1]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshBasicMaterial color="#f0a030" transparent toneMapped={false} />
      </mesh>

      {/* ThumbFrame logo face — small orange rectangle on hull */}
      <mesh position={[0.6, 0.0, 0.41]}>
        <planeGeometry args={[0.15, 0.15]} />
        <meshBasicMaterial color="#f97316" />
      </mesh>
    </group>
  );
}

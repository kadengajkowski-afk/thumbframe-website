// Space station — asymmetric, inhabited, weathered.
// Mixed cylinders/boxes, hull panel color variation, porthole rows,
// flickering windows, engine exhaust trail, rotating dish, nav lights.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import EnginePlume from './EnginePlume';

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

    // High-contrast 3-band ramp
    vec3 warmHi = vec3(0.91, 0.85, 0.72); // #e8d8b8 lit
    vec3 deepSh = vec3(0.16, 0.12, 0.23); // #2a1e3a shadow

    vec3 color;
    if (NdotL > 0.35) color = mix(uBaseColor, warmHi, 0.5);
    else if (NdotL > -0.1) color = uBaseColor * 0.55;
    else color = mix(uBaseColor * 0.22, deepSh, 0.65);

    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), uRimPower);
    color += vec3(0.40, 0.35, 0.55) * rim * 0.35;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function Toon({ color = '#7a7a9a', rimPower = 3.0 }) {
  const uniforms = useMemo(() => ({
    uBaseColor: { value: new THREE.Color(color) },
    uLightDir: { value: new THREE.Vector3(5, 4, 3).normalize() },
    uRimPower: { value: rimPower },
  }), [color, rimPower]);
  return <shaderMaterial vertexShader={toonVert} fragmentShader={toonFrag} uniforms={uniforms} />;
}

function Glow({ color = '#f0a040' }) {
  return <meshBasicMaterial color={color} toneMapped={false} />;
}


export default function SpaceStation({ position = [0, 0, 0], scale = 1 }) {
  const groupRef = useRef();
  const dishRef = useRef();
  const beacon1Ref = useRef();
  const beacon2Ref = useRef();
  const navLightRef = useRef();
  const flickerRefs = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Zero-g swimming motion — three independent sine waves with different
    // periods so the ship feels alive and weightless, not rocking in sync.
    //   yaw   ±15° on ~10.0s period  (ω = 2π/10)
    //   pitch ±3°  on ~8.0s period   (ω = 2π/8)  — nose up/down
    //   bob   ±0.3 on ~6.0s period   (ω = 2π/6)  — vertical drift around base Y
    // Phase offsets keep the three from ever crossing zero together.
    // ±15° yaw keeps the engine plume ≤45° off its local -X, never at camera.
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.628) * (15 * Math.PI / 180);
      groupRef.current.rotation.x = Math.sin(t * 0.785 + 0.7) * (3 * Math.PI / 180);
      groupRef.current.position.y = Math.sin(t * 1.047 + 2.1) * 0.3;
    }
    if (dishRef.current) dishRef.current.rotation.y = t * 0.35;

    // Pulsing beacons ~1Hz
    const pulse = Math.sin(t * 6.28) * 0.3 + 0.9;
    if (beacon1Ref.current) beacon1Ref.current.material.opacity = pulse;
    if (beacon2Ref.current) beacon2Ref.current.material.opacity = 1.3 - pulse;

    // Green nav light — slow blink
    if (navLightRef.current) {
      navLightRef.current.material.opacity = Math.sin(t * 2.0) > 0.3 ? 0.9 : 0.15;
    }

    // Flickering windows — someone walking past
    flickerRefs.current.forEach((ref, i) => {
      if (ref?.material) {
        const flicker = Math.sin(t * (3.0 + i * 1.7) + i * 5.0) * 0.5 + 0.5;
        ref.material.opacity = 0.4 + flicker * 0.6;
      }
    });
  });

  const setFlickerRef = (i) => (el) => { flickerRefs.current[i] = el; };

  return (
    <group ref={groupRef} position={position} scale={scale}>

      {/* ═══ MAIN HULL — 4 panel sections with distinct color variation ═══ */}
      {/* Mid hull — cool slate */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.45, 0.5, 1.2, 8]} />
        <Toon color="#5e5878" />
      </mesh>
      {/* Forward-mid hull — warmer gray */}
      <mesh position={[0.7, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.47, 0.48, 0.9, 8]} />
        <Toon color="#726a7e" />
      </mesh>
      {/* Aft hull — cooler, darker */}
      <mesh position={[-0.7, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.48, 0.5, 1.1, 8]} />
        <Toon color="#584e6a" />
      </mesh>

      {/* Panel seam rings — visible breaks between sections */}
      <mesh position={[0.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.53, 0.53, 0.06, 8]} />
        <Toon color="#4a4260" />
      </mesh>
      <mesh position={[-0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.54, 0.54, 0.05, 8]} />
        <Toon color="#4a4260" />
      </mesh>

      {/* Rust/weathering patch near engine */}
      <mesh position={[-1.0, -0.1, 0.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.48, 0.48, 0.15, 8]} />
        <Toon color="#6a5040" />
      </mesh>
      <mesh position={[-0.9, 0.15, -0.25]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.47, 0.47, 0.12, 8]} />
        <Toon color="#5e4a42" />
      </mesh>

      {/* ═══ FORWARD SECTION — distinctly warmer ═══ */}
      <mesh position={[1.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.42, 0.48, 0.6, 8]} />
        <Toon color="#7a7088" />
      </mesh>

      {/* ═══ BRIDGE — octagonal, offset, large amber windows ═══ */}
      <mesh position={[0.6, 0.55, 0.1]}>
        <cylinderGeometry args={[0.35, 0.38, 0.4, 8]} />
        <Toon color="#807898" />
      </mesh>
      {/* Bridge window band — large, clearly glowing */}
      <mesh position={[0.6, 0.55, 0.39]}>
        <planeGeometry args={[0.48, 0.2]} />
        <Glow color="#f0a840" />
      </mesh>
      <mesh position={[0.97, 0.55, 0.1]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.38, 0.18]} />
        <Glow color="#d89030" />
      </mesh>

      {/* ═══ HABITAT RING — torus with struts ═══ */}
      <mesh position={[-0.2, -0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.8, 0.1, 8, 16]} />
        <Toon color="#686080" />
      </mesh>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a, i) => (
        <mesh key={`strut-${i}`} position={[-0.2 + Math.cos(a) * 0.4, -0.15, Math.sin(a) * 0.4]}
          rotation={[0, 0, a * 0.5]} scale={[0.03, 0.35, 0.03]}>
          <boxGeometry />
          <Toon color="#5a5270" />
        </mesh>
      ))}

      {/* ═══ ENGINE — angled, tapered, with exhaust ═══ */}
      <mesh position={[-1.4, 0.1, 0]} rotation={[0, 0, Math.PI / 2 + 0.08]}>
        <cylinderGeometry args={[0.3, 0.55, 0.8, 6]} />
        <Toon color="#554a68" />
      </mesh>
      {/* 3-cone nozzle cluster */}
      {[[-1.85, 0.25, 0.15], [-1.85, -0.05, -0.18], [-1.85, 0.15, -0.05]].map((p, i) => (
        <mesh key={`noz-${i}`} position={p} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.12, 0.3, 6]} />
          <Toon color="#4a4060" />
        </mesh>
      ))}
      {/* Engine plume — animated flame, sparks, nozzle glow */}
      <EnginePlume position={[-1.85, 0.12, 0]} />

      {/* ═══ DOCKING BAY — rectangular with dark recess + amber glow ═══ */}
      <group position={[1.5, -0.15, 0.2]}>
        <mesh><boxGeometry args={[0.5, 0.55, 0.6]} /><Toon color="#5a5270" /></mesh>
        <mesh position={[0.15, 0, 0]}><boxGeometry args={[0.25, 0.35, 0.4]} /><meshBasicMaterial color="#0e0a14" /></mesh>
        <mesh position={[0.02, 0, 0]}><planeGeometry args={[0.2, 0.3]} /><Glow color="#c07020" /></mesh>
        <mesh position={[0.26, 0.2, 0.22]}><sphereGeometry args={[0.025, 6, 6]} /><Glow color="#40c070" /></mesh>
        <mesh position={[0.26, 0.2, -0.22]}><sphereGeometry args={[0.025, 6, 6]} /><Glow color="#40c070" /></mesh>
      </group>

      {/* ═══ SOLAR ARRAY — asymmetric ═══ */}
      <group position={[0.3, 0.15, 0.85]} rotation={[0.15, 0.1, 0.05]}>
        <mesh><boxGeometry args={[0.04, 0.04, 0.5]} /><Toon color="#5a6a80" /></mesh>
        <mesh position={[-0.45, 0, 0.1]}><boxGeometry args={[0.85, 0.02, 0.35]} /><Toon color="#3a5070" /></mesh>
        <mesh position={[0.35, 0, 0.1]}><boxGeometry args={[0.6, 0.02, 0.35]} /><Toon color="#3a5070" /></mesh>
      </group>

      {/* ═══ ANTENNAE — thicker bases connecting to hull, thin shafts ═══ */}
      {/* Antenna 1: tallest */}
      <group position={[0.2, 0.48, -0.15]}>
        {/* Base mount — thick, visibly connected to hull */}
        <mesh>
          <cylinderGeometry args={[0.04, 0.05, 0.12, 6]} />
          <Toon color="#6a6280" />
        </mesh>
        {/* Shaft — thicker than before so it reads at distance */}
        <mesh position={[0, 0.06, 0]} rotation={[0.12, 0, -0.08]}>
          <cylinderGeometry args={[0.012, 0.02, 2.8, 4]} />
          <Toon color="#9090a8" />
        </mesh>
        <mesh position={[0, 1.42, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.006, 0.006, 0.25, 4]} />
          <Toon color="#a0a0b0" />
        </mesh>
        <mesh position={[0, 1.48, 0]}>
          <sphereGeometry args={[0.022, 6, 6]} /><Glow color="#f0c080" />
        </mesh>
      </group>
      {/* Antenna 2: medium */}
      <group position={[-0.4, 0.48, 0.2]}>
        <mesh>
          <cylinderGeometry args={[0.035, 0.045, 0.1, 6]} />
          <Toon color="#6a6280" />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.01, 0.018, 2.0, 4]} />
          <Toon color="#9090a8" />
        </mesh>
        <mesh position={[-0.2, 1.0, 0]}>
          <sphereGeometry args={[0.018, 6, 6]} /><Glow color="#f0c080" />
        </mesh>
      </group>
      {/* Antenna 3: shorter, forward */}
      <group position={[0.8, 0.44, -0.1]}>
        <mesh>
          <cylinderGeometry args={[0.03, 0.04, 0.08, 6]} />
          <Toon color="#6a6280" />
        </mesh>
        <mesh position={[0, 0.04, 0]} rotation={[-0.15, 0, -0.25]}>
          <cylinderGeometry args={[0.008, 0.015, 1.4, 4]} />
          <Toon color="#9090a8" />
        </mesh>
        <mesh position={[0.17, 0.72, 0]}>
          <sphereGeometry args={[0.015, 6, 6]} /><Glow color="#f0c080" />
        </mesh>
      </group>

      {/* ═══ COMMS DISH — rotating ═══ */}
      <group ref={dishRef} position={[-0.1, 0.72, 0.05]}>
        <mesh><cylinderGeometry args={[0.03, 0.03, 0.15, 6]} /><Toon color="#8080a0" /></mesh>
        <mesh position={[0, 0.12, 0]} rotation={[0.3, 0, 0]}>
          <coneGeometry args={[0.25, 0.08, 12]} /><Toon color="#8888a8" />
        </mesh>
        <mesh position={[0, 0.2, 0.05]} rotation={[0.3, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.15, 4]} /><Toon color="#a0a0b0" />
        </mesh>
      </group>

      {/* ═══ BEACONS — pulsing amber on antenna tips ═══ */}
      <mesh ref={beacon1Ref} position={[0.2, 1.95, -0.15]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshBasicMaterial color="#f0a030" transparent toneMapped={false} />
      </mesh>
      <mesh ref={beacon2Ref} position={[-0.4, 1.48, 0.2]}>
        <sphereGeometry args={[0.035, 6, 6]} />
        <meshBasicMaterial color="#f0a030" transparent toneMapped={false} />
      </mesh>

      {/* ═══ GREEN NAV LIGHT — slow blink on comms array ═══ */}
      <mesh ref={navLightRef} position={[-0.1, 0.92, 0.15]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshBasicMaterial color="#30e070" transparent toneMapped={false} />
      </mesh>

      {/* ═══ PORTHOLE ROWS — inhabited feel ═══ */}
      {/* Forward hull — 8 portholes, some dim (unused), some flickering */}
      {Array.from({ length: 8 }, (_, i) => {
        const x = -0.8 + i * 0.25;
        const isDim = i === 1 || i === 5;
        const isFlicker = i === 3 || i === 6;
        return (
          <mesh key={`port-top-${i}`} position={[x, 0.25, 0.48]}
            ref={isFlicker ? setFlickerRef(i) : undefined}>
            <planeGeometry args={[0.07, 0.045]} />
            <meshBasicMaterial
              color={isDim ? '#405870' : '#e0a040'}
              toneMapped={false}
              transparent={isFlicker}
            />
          </mesh>
        );
      })}
      {/* Lower hull — 6 smaller portholes */}
      {Array.from({ length: 6 }, (_, i) => {
        const x = -0.5 + i * 0.28;
        const isDim = i === 2;
        return (
          <mesh key={`port-bot-${i}`} position={[x, -0.2, 0.48]}>
            <planeGeometry args={[0.05, 0.035]} />
            <meshBasicMaterial color={isDim ? '#405870' : '#d09030'} toneMapped={false} />
          </mesh>
        );
      })}

      {/* ═══ REAR-FACING PORTHOLES (-Z side) — 7 upper, 5 lower ═══ */}
      {Array.from({ length: 7 }, (_, i) => {
        const x = -0.6 + i * 0.25;
        const isDim = i === 2 || i === 4;
        return (
          <mesh key={`port-rear-top-${i}`} position={[x, 0.2, -0.48]}
            rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.065, 0.04]} />
            <meshBasicMaterial color={isDim ? '#405870' : '#d89030'} toneMapped={false} />
          </mesh>
        );
      })}
      {Array.from({ length: 5 }, (_, i) => {
        const x = -0.4 + i * 0.28;
        const isDim = i === 3;
        return (
          <mesh key={`port-rear-bot-${i}`} position={[x, -0.18, -0.48]}
            rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.05, 0.035]} />
            <meshBasicMaterial color={isDim ? '#405870' : '#c08028'} toneMapped={false} />
          </mesh>
        );
      })}
      {/* Rear side window strip */}
      <mesh position={[0.5, 0.08, -0.48]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.4, 0.07]} /><Glow color="#c89030" />
      </mesh>

      {/* ═══ SIDE-FACING WINDOWS (+X and -X sides) ═══ */}
      {/* Starboard side (+X) */}
      <mesh position={[0.2, 0.15, 0.44]} rotation={[0, 0.5, 0]}>
        <planeGeometry args={[0.3, 0.06]} /><Glow color="#d09038" />
      </mesh>
      {/* Port side (-X) — near engine, dimmer */}
      <mesh position={[-0.5, 0.1, -0.44]} rotation={[0, Math.PI + 0.4, 0]}>
        <planeGeometry args={[0.25, 0.05]} /><Glow color="#a07028" />
      </mesh>

      {/* ═══ HULL WINDOWS — large panels (front face, kept from before) ═══ */}
      <mesh position={[0.9, 0.1, 0.48]}>
        <planeGeometry args={[0.5, 0.08]} /><Glow color="#d89838" />
      </mesh>
      <mesh position={[-0.2, -0.42, 0.1]}>
        <planeGeometry args={[0.15, 0.04]} /><Glow color="#f97316" />
      </mesh>

      {/* ═══ THUMBFRAME LOGO — painted stencil on hull ═══ */}
      <mesh position={[1.0, 0.3, 0.49]}>
        <planeGeometry args={[0.2, 0.2]} />
        <meshBasicMaterial color="#f97316" toneMapped={false} />
      </mesh>
    </group>
  );
}

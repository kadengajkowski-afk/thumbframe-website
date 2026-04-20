import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import EnginePlume from './EnginePlume';

// ===== SAIL COMPONENT =====

const sailVertex = `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Parabolic curve: sail bows outward, max bow at vertical center
    // vUv.y goes 0 (bottom) to 1 (top)
    float bowCurve = sin(vUv.y * 3.14159);
    pos.z += bowCurve * 0.35;

    // Gentle ripple — slack flutter, not strong wind
    float ripple1 = sin(vUv.y * 5.0 + uTime * 1.2) * 0.03;
    float ripple2 = sin(vUv.x * 3.0 - uTime * 0.8 + vUv.y * 2.0) * 0.02;
    pos.z += (ripple1 + ripple2) * bowCurve;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const sailFragment = `
  uniform float uShowT;
  uniform float uTSize;
  varying vec2 vUv;

  float softBar(float x, float a, float b, float soft) {
    return smoothstep(a - soft, a + soft, x) - smoothstep(b - soft, b + soft, x);
  }

  void main() {
    // Sail fabric — warm cream with faint gold sheen
    vec3 sailColor = vec3(0.98, 0.94, 0.86);
    vec3 tColor    = vec3(0.95, 0.45, 0.12);

    // Radial struts — fan out from bottom center (the mast attachment)
    // Compute angle from bottom-center
    vec2 fromBase = vec2(vUv.x - 0.5, vUv.y);
    float angle = atan(fromBase.x, fromBase.y);  // -PI to PI
    // 5 struts fanning across the sail
    float strutPattern = abs(sin(angle * 3.5));
    float strut = 1.0 - smoothstep(0.92, 0.98, strutPattern);
    strut *= smoothstep(0.05, 0.25, vUv.y); // no struts at base

    // T letter — sized by uTSize so smaller sails get smaller T
    float s = uTSize;
    float tCenterY = 0.5;
    float horiz = softBar(vUv.x, 0.5 - 0.38*s, 0.5 + 0.38*s, 0.015)
                * softBar(vUv.y, tCenterY + 0.22*s, tCenterY + 0.38*s, 0.015);
    float vert  = softBar(vUv.x, 0.5 - 0.06*s, 0.5 + 0.06*s, 0.015)
                * softBar(vUv.y, tCenterY - 0.30*s, tCenterY + 0.38*s, 0.015);
    float tMask = max(horiz, vert) * uShowT;

    vec3 color = mix(sailColor, tColor, tMask);

    // Apply strut darkening (struts are darker bronze lines)
    vec3 strutColor = vec3(0.55, 0.40, 0.22);
    color = mix(color, strutColor, strut * 0.6);

    // Soft edge glow — gives solar sail "catching light" feel
    float edgeGlow = smoothstep(0.85, 1.0, 1.0 - length(vUv - 0.5) * 1.4);
    color += vec3(1.0, 0.85, 0.55) * edgeGlow * 0.15;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function SolarSail({ position, size = [1.0, 1.4], showT = true, tSize = 1.0, rotation = [0, 0, 0] }) {
  const matRef = useRef();
  const uniforms = useMemo(() => ({
    uTime:   { value: 0 },
    uShowT:  { value: showT ? 1 : 0 },
    uTSize:  { value: tSize },
  }), [showT, tSize]);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size[0], size[1], 32, 40]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={sailVertex}
        fragmentShader={sailFragment}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

// ===== LANTERN (small amber glow anchor points) =====

function Lantern({ position }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.06, 10, 8]} />
        <meshBasicMaterial color="#ffb060" toneMapped={false} />
      </mesh>
      <pointLight color="#ffb060" intensity={0.3} distance={1.2} />
    </group>
  );
}

// ===== MAIN SHIP =====

export default function SpaceStation({ position = [0, 0, 0], scale = 1, rotation = [0, 0, 0] }) {
  const groupRef = useRef();

  // Gentle ship rock — three independent sines, different periods.
  // Rock is layered on top of the base rotation passed in via props so the
  // three-quarter hero yaw holds while the ship still sways.
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.y = rotation[1] + Math.sin(t * 0.28) * 0.15;
    groupRef.current.position.y = position[1] + Math.sin(t * 0.42) * 0.12;
    groupRef.current.rotation.x = rotation[0] + Math.sin(t * 0.35) * 0.035;
    groupRef.current.rotation.z = rotation[2];
  });

  return (
    <group ref={groupRef} position={position} scale={scale} rotation={rotation}>
      {/* ===== HULL ===== */}
      {/* Main hull — stretched ellipsoid, flatter top */}
      <mesh position={[0, 0, 0]} scale={[1.4, 0.3, 0.5]}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshStandardMaterial color="#b8855a" roughness={0.8} metalness={0.05} />
      </mesh>

      {/* Deck plank */}
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[2.4, 0.06, 0.85]} />
        <meshStandardMaterial color="#c89968" roughness={0.75} />
      </mesh>

      {/* Hull waterline trim */}
      <mesh position={[0, -0.02, 0]} scale={[1.42, 0.08, 0.52]}>
        <sphereGeometry args={[1, 20, 8]} />
        <meshStandardMaterial color="#6a4228" roughness={0.85} />
      </mesh>

      {/* Stern cabin */}
      <mesh position={[-0.85, 0.35, 0]}>
        <boxGeometry args={[0.55, 0.45, 0.7]} />
        <meshStandardMaterial color="#9a6d42" roughness={0.8} />
      </mesh>

      {/* Stern cabin roof */}
      <mesh position={[-0.85, 0.60, 0]}>
        <boxGeometry args={[0.65, 0.08, 0.78]} />
        <meshStandardMaterial color="#5a3a20" roughness={0.85} />
      </mesh>

      {/* ===== CENTRAL SPINE (single mast running length of ship) ===== */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.045, 0.06, 1.8, 10]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
      </mesh>

      {/* ===== MAST CROSSBEAM (horizontal spine from which sails hang) ===== */}
      <mesh position={[0, 1.7, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 3.0, 8]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
      </mesh>

      {/* ===== SOLAR SAILS — fore-and-aft along ship ===== */}
      {/* Fore sail (bow-side, smallest) */}
      <SolarSail
        position={[1.25, 1.6, 0]}
        size={[0.7, 1.0]}
        showT={true}
        tSize={0.7}
      />

      {/* Main sail (center, largest) */}
      <SolarSail
        position={[0.0, 1.7, 0]}
        size={[1.1, 1.4]}
        showT={true}
        tSize={1.0}
      />

      {/* Aft sail (stern-side, medium) */}
      <SolarSail
        position={[-1.1, 1.55, 0]}
        size={[0.85, 1.2]}
        showT={true}
        tSize={0.85}
      />

      {/* Mast cap */}
      <mesh position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.06, 10, 8]} />
        <meshStandardMaterial color="#6a4228" />
      </mesh>

      {/* ===== BOWSPRIT ===== */}
      <mesh position={[1.45, 0.25, 0]} rotation={[0, 0, -0.18]}>
        <cylinderGeometry args={[0.025, 0.035, 0.75, 8]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
      </mesh>

      {/* ===== LANTERNS ===== */}
      <Lantern position={[0.9, 0.35, 0.38]} />
      <Lantern position={[-0.3, 0.35, 0.38]} />
      <Lantern position={[0.2, 2.05, 0]} />

      {/* ===== ENGINE NOZZLE AT STERN ===== */}
      <mesh position={[-1.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.25, 0.3, 16]} />
        <meshStandardMaterial color="#2a2030" metalness={0.6} roughness={0.5} />
      </mesh>

      {/* Nozzle emissive ring */}
      <mesh position={[-1.45, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.2, 0.035, 8, 20]} />
        <meshBasicMaterial color="#ffb060" toneMapped={false} />
      </mesh>

      {/* ===== FLAME ===== */}
      <EnginePlume position={[-2.4, 0, 0]} />
    </group>
  );
}

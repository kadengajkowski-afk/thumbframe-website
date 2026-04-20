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

    // Sail attached at top edge (uv.y = 1), free at bottom.
    // Displacement grows toward free edge.
    float amp = 1.0 - vUv.y;

    float wave1 = sin(vUv.x * 5.0 + uTime * 2.0) * 0.08;
    float wave2 = sin(vUv.x * 2.5 - uTime * 1.4 + vUv.y * 3.0) * 0.05;

    pos.z += (wave1 + wave2) * amp;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const sailFragment = `
  uniform float uShowT;
  varying vec2 vUv;

  float softBar(float x, float a, float b, float soft) {
    return smoothstep(a - soft, a + soft, x) - smoothstep(b - soft, b + soft, x);
  }

  void main() {
    vec3 sailColor = vec3(0.96, 0.92, 0.85);   // warm cream
    vec3 tColor    = vec3(0.95, 0.45, 0.12);   // ThumbFrame orange

    float soft = 0.02;
    // Horizontal bar of T — top portion of sail
    float horiz = softBar(vUv.x, 0.12, 0.88, soft) * softBar(vUv.y, 0.72, 0.92, soft);
    // Vertical stem of T — centered, runs most of height
    float vert  = softBar(vUv.x, 0.44, 0.56, soft) * softBar(vUv.y, 0.10, 0.92, soft);
    float tMask = max(horiz, vert) * uShowT;

    vec3 color = mix(sailColor, tColor, tMask);

    // Subtle top-to-bottom shading for natural cloth feel
    color *= 0.88 + vUv.y * 0.15;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function Sail({ position, size = [1.6, 1.3], showT = true }) {
  const matRef = useRef();
  const uniforms = useMemo(() => ({
    uTime:  { value: 0 },
    uShowT: { value: showT ? 1 : 0 },
  }), [showT]);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh position={position}>
      <planeGeometry args={[size[0], size[1], 24, 18]} />
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

export default function SpaceStation({ position = [0, 0, 0], scale = 1 }) {
  const groupRef = useRef();

  // Gentle ship rock — three independent sines, different periods
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.rotation.y = Math.sin(t * 0.28) * 0.15;
    groupRef.current.position.y = position[1] + Math.sin(t * 0.42) * 0.12;
    groupRef.current.rotation.x = Math.sin(t * 0.35) * 0.035;
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* ===== HULL ===== */}
      {/* Main hull — stretched ellipsoid, flatter top */}
      <mesh position={[0, 0, 0]} scale={[1.4, 0.3, 0.5]}>
        <sphereGeometry args={[1, 20, 14]} />
        <meshStandardMaterial color="#6b4a2e" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Deck plank */}
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[2.4, 0.06, 0.85]} />
        <meshStandardMaterial color="#8a6a42" roughness={0.8} />
      </mesh>

      {/* Hull waterline trim */}
      <mesh position={[0, -0.02, 0]} scale={[1.42, 0.08, 0.52]}>
        <sphereGeometry args={[1, 20, 8]} />
        <meshStandardMaterial color="#3d2814" roughness={0.9} />
      </mesh>

      {/* Stern cabin */}
      <mesh position={[-0.85, 0.4, 0]}>
        <boxGeometry args={[0.55, 0.45, 0.7]} />
        <meshStandardMaterial color="#5a3e26" roughness={0.85} />
      </mesh>

      {/* Stern cabin roof */}
      <mesh position={[-0.85, 0.65, 0]}>
        <boxGeometry args={[0.65, 0.08, 0.78]} />
        <meshStandardMaterial color="#3d2814" roughness={0.9} />
      </mesh>

      {/* ===== MAIN MAST ===== */}
      <mesh position={[0.2, 1.3, 0]}>
        <cylinderGeometry args={[0.045, 0.055, 2.3, 10]} />
        <meshStandardMaterial color="#3d2814" roughness={0.9} />
      </mesh>

      {/* Main yard (horizontal spar) */}
      <mesh position={[0.2, 2.15, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 1.9, 8]} />
        <meshStandardMaterial color="#3d2814" roughness={0.9} />
      </mesh>

      {/* Mainsail — big T flag */}
      <Sail position={[0.2, 1.45, 0]} size={[1.75, 1.35]} showT={true} />

      {/* Mast top cap */}
      <mesh position={[0.2, 2.5, 0]}>
        <coneGeometry args={[0.05, 0.15, 8]} />
        <meshStandardMaterial color="#3d2814" />
      </mesh>

      {/* ===== FOREMAST ===== */}
      <mesh position={[1.0, 0.95, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 1.6, 10]} />
        <meshStandardMaterial color="#3d2814" roughness={0.9} />
      </mesh>

      {/* Foresail — smaller, blank */}
      <Sail position={[1.0, 1.15, 0]} size={[0.85, 0.95]} showT={false} />

      {/* ===== BOWSPRIT ===== */}
      <mesh position={[1.45, 0.25, 0]} rotation={[0, 0, -0.18]}>
        <cylinderGeometry args={[0.025, 0.035, 0.75, 8]} />
        <meshStandardMaterial color="#3d2814" roughness={0.9} />
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
      <EnginePlume position={[-1.8, 0, 0]} />
    </group>
  );
}

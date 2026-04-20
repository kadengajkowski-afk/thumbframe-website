import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import EnginePlume from './EnginePlume';

// ===== SAIL COMPONENT =====

const sailVertex = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // === BILLOW: sail catches wind, bulges outward from flat ===
    // Max bulge at center of sail (uv = 0.5, 0.5), zero at edges
    float bulgeX = sin(vUv.x * 3.14159);   // 0 at x=0, 1 at x=0.5, 0 at x=1
    float bulgeY = sin(vUv.y * 3.14159);   // same for y
    float bulge = bulgeX * bulgeY;

    // Wind direction (+Z = toward camera in local space when ship yaws)
    // Billow pushes sail outward along its normal (+Z in local plane space)
    pos.z += bulge * 0.4 + bulgeX * bulgeY * sin(uTime * 0.8) * 0.05;

    // === FLUTTER: wind ripple on top of the billow ===
    // Stronger at free edges (bottom & right), subtle at attached top
    float flutterAmp = (1.0 - vUv.y) * 0.5 + 0.1;
    float wave1 = sin(vUv.x * 6.0 + uTime * 2.2) * 0.05;
    float wave2 = sin(vUv.y * 4.0 - uTime * 1.6 + vUv.x * 2.0) * 0.04;
    pos.z += (wave1 + wave2) * flutterAmp;

    // Compute a bent normal for lighting (approximate)
    vNormal = normalize(vec3(
      -cos(vUv.x * 3.14159) * bulgeY * 0.35,
      -cos(vUv.y * 3.14159) * bulgeX * 0.35,
      1.0
    ));

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const sailFragment = `
  uniform float uShowT;
  varying vec2 vUv;
  varying vec3 vNormal;

  float softBar(float x, float a, float b, float soft) {
    return smoothstep(a - soft, a + soft, x) - smoothstep(b - soft, b + soft, x);
  }

  void main() {
    vec3 sailColor = vec3(0.99, 0.95, 0.88);
    vec3 tColor    = vec3(0.95, 0.45, 0.12);

    float soft = 0.02;
    float horiz = softBar(vUv.x, 0.12, 0.88, soft) * softBar(vUv.y, 0.72, 0.92, soft);
    float vert  = softBar(vUv.x, 0.44, 0.56, soft) * softBar(vUv.y, 0.10, 0.92, soft);
    float tMask = max(horiz, vert) * uShowT;

    vec3 color = mix(sailColor, tColor, tMask);

    // Shade the billow using the bent normal — light from upper-front
    vec3 lightDir = normalize(vec3(0.3, 0.5, 0.8));
    float shade = dot(normalize(vNormal), lightDir) * 0.5 + 0.5;
    color *= 0.92 + shade * 0.15;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function Sail({ position, size = [1.6, 1.3], showT = true, rotation = [0, 0, 0] }) {
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
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size[0], size[1], 40, 30]} />
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

      {/* ===== MAIN MAST ===== */}
      <mesh position={[0.2, 1.3, 0]}>
        <cylinderGeometry args={[0.045, 0.055, 2.3, 10]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
      </mesh>

      {/* Main yard (horizontal spar) */}
      <mesh position={[0.2, 2.15, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 1.9, 8]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
      </mesh>

      {/* Mainsail — big T flag */}
      <Sail position={[0.2, 1.45, 0.06]} size={[1.75, 1.35]} showT={true} />

      {/* Mast top cap */}
      <mesh position={[0.2, 2.5, 0]}>
        <coneGeometry args={[0.05, 0.15, 8]} />
        <meshStandardMaterial color="#4a3020" />
      </mesh>

      {/* ===== FOREMAST ===== */}
      <mesh position={[1.15, 0.85, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 1.4, 10]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
      </mesh>

      {/* Foresail — smaller, blank */}
      <Sail position={[1.15, 1.0, 0.05]} size={[0.7, 0.8]} showT={false} />

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

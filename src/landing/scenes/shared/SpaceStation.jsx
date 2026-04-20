import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import EnginePlume from './EnginePlume';

// ===== SAIL COMPONENT =====

const sailVertex = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vBow;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // === FREEDOM ENVELOPE ===
    // Both top (uv.y=1) and bottom (uv.y=0) are pinned.
    // Freedom is maximum at the middle.
    float freedom = sin(vUv.y * 3.14159);

    // === MICRO-NOISE JITTER ===
    // Small pseudo-random jitter per-vertex so motion has organic
    // texture instead of smooth sine sweeps
    float jx = sin(vUv.x * 47.3 + vUv.y * 23.1) * 0.5 + 0.5;
    float jy = sin(vUv.x * 31.7 - vUv.y * 19.4) * 0.5 + 0.5;

    // === FOUR NON-HARMONIC SINES ===
    // Frequencies chosen as non-integer multiples so the combined
    // motion has a very long period (effectively never repeats
    // during viewing).
    float a = uTime * 1.37;
    float b = uTime * 2.13;
    float c = uTime * 0.89;
    float d = uTime * 3.41;

    // === HORIZONTAL STREAM (the banner blowing in the wind) ===
    // Bottom of sail streams horizontally in +X direction, with
    // wave traveling DOWN from top to bottom.
    float streamX = sin(a - vUv.y * 4.7 + jx * 2.0) * 0.40
                  + sin(c * 1.7 + vUv.y * 2.3 - jx) * 0.28
                  + sin(b * 0.6 - vUv.y * 6.1) * 0.18;
    pos.x += streamX * freedom;

    // === DEPTH BILLOW (sail bulging in/out) ===
    float depthZ = sin(b - vUv.y * 3.9 + jy) * 0.35
                 + sin(d * 0.5 + vUv.x * 2.7 - vUv.y * 3.0) * 0.22
                 + sin(a * 1.4 - vUv.x * 1.3) * 0.15;
    pos.z += depthZ * freedom;

    // === VERTICAL FLUTTER (flag curls up and down) ===
    float flutterY = sin(c - vUv.y * 5.2 + jx * 3.0) * 0.25
                   + sin(d * 0.7 + vUv.x * 1.9) * 0.18;
    pos.y += flutterY * freedom;

    // === HIGH-FREQUENCY EDGE CHOP ===
    // Stronger on the far (trailing) edge only, very fast small
    // motions on top of the larger waves
    float edgeChop = sin(d * 2.1 + vUv.x * 7.0 + vUv.y * 4.0) * 0.04
                   + sin(b * 3.3 - vUv.y * 9.0) * 0.03;
    float trailingEdge = smoothstep(0.4, 1.0, vUv.x);
    pos.z += edgeChop * trailingEdge * freedom;

    vBow = 0.7;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const sailFragment = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vBow;

  float softBar(float x, float a, float b, float soft) {
    return smoothstep(a - soft, a + soft, x) - smoothstep(b - soft, b + soft, x);
  }

  void main() {
    float ux = 1.0 - vUv.x;

    // Golden solar sail — warm amber base with cream highlights
    vec3 sailDark  = vec3(0.72, 0.48, 0.20);   // deep amber/bronze
    vec3 sailLight = vec3(0.98, 0.86, 0.55);   // bright gold
    vec3 tColor    = vec3(0.55, 0.22, 0.08);   // deep rust (T reads dark on gold)

    // Base: gradient from deep amber at edges to bright gold at center
    // Use the billow magnitude as a proxy for "lit by sun" — center
    // bulge catches more light than flat edges
    vec3 baseColor = mix(sailDark, sailLight, vBow * 1.2);

    // Large T painted across the sail — big and readable
    float soft = 0.02;
    float horiz = softBar(ux, 0.15, 0.85, soft)
                * softBar(vUv.y, 0.68, 0.85, soft);
    float vert  = softBar(ux, 0.46, 0.54, soft)
                * softBar(vUv.y, 0.15, 0.85, soft);
    float tMask = max(horiz, vert);

    vec3 color = mix(baseColor, tColor, tMask * 0.85);

    // Sheen band — subtle moving highlight across the sail
    float sheen = smoothstep(0.0, 0.15,
      0.15 - abs(vUv.x - 0.5 + sin(uTime * 0.3) * 0.3));
    color += vec3(1.0, 0.92, 0.70) * sheen * 0.12;

    // Warm rim glow at all edges — "sail catching starlight"
    float rimX = smoothstep(0.0, 0.08, vUv.x) * smoothstep(0.0, 0.08, 1.0 - vUv.x);
    float rimY = smoothstep(0.0, 0.08, vUv.y) * smoothstep(0.0, 0.08, 1.0 - vUv.y);
    float rim = 1.0 - (rimX * rimY);
    color += vec3(1.0, 0.78, 0.35) * rim * 0.25;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function SolarSail({ position, size = [3.0, 2.4], rotation = [0, 0, 0] }) {
  const matRef = useRef();
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size[0], size[1], 64, 48]} />
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
    // Gentle rock (slower, smaller)
    groupRef.current.rotation.y = rotation[1] + Math.sin(t * 0.22) * 0.08;
    // Pronounced bob — rides a swell of solar wind
    groupRef.current.position.y = position[1] + Math.sin(t * 0.55) * 0.35;
    // Subtle pitch phase-linked to the bob so tilt syncs with rise/fall
    groupRef.current.rotation.x = rotation[0] + Math.sin(t * 0.55 + 0.5) * 0.08;
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

      {/* ===== MAST (single tall spine, slight aft lean) ===== */}
      <mesh position={[-0.05, 1.7, 0]} rotation={[0, 0, 0.08]}>
        <cylinderGeometry args={[0.05, 0.07, 3.6, 10]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
      </mesh>

      {/* ===== YARD (horizontal spar sail hangs from) ===== */}
      <mesh position={[0.1, 2.95, 0]} rotation={[Math.PI / 2 + 0.12, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 3.2, 8]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
      </mesh>

      {/* ===== BOOM (horizontal spar at bottom of sail) ===== */}
      <mesh position={[0.1, 1.02, 0]} rotation={[0, 0, Math.PI / 2 + 0.12]}>
        <cylinderGeometry args={[0.03, 0.03, 3.0, 8]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
      </mesh>

      {/* ===== SINGLE LARGE SOLAR SAIL ===== */}
      {/* Positioned above and slightly behind ship center, large and swept */}
      <SolarSail
        position={[0.1, 2.2, 0]}
        size={[3.0, 2.4]}
        rotation={[0, Math.PI / 2, 0]}
      />

      {/* ===== MAST TOP FINIAL (small ornament at top of mast) ===== */}
      <mesh position={[0.15, 3.55, 0]}>
        <coneGeometry args={[0.06, 0.18, 8]} />
        <meshStandardMaterial color="#6a4228" />
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

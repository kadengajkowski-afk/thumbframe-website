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

    // Big parabolic billow — max at sail center, zero at all edges.
    // This is what gives the sail its "catching solar wind" bulge.
    float bowX = sin(vUv.x * 3.14159);
    float bowY = sin(vUv.y * 3.14159);
    float bow = bowX * bowY;
    vBow = bow;

    // Deep billow forward (+Z in local space)
    pos.z += bow * 0.55;

    // Swept-back shape — top edge pulled back more than bottom
    // This gives the sail its "swept" silhouette when rotated into
    // place (vs being a plain rectangle)
    pos.z += vUv.y * 0.35;

    // Gentle slack ripple
    float ripple = sin(vUv.y * 4.5 + uTime * 1.0) * 0.025
                 + sin(vUv.x * 3.0 - uTime * 0.7) * 0.020;
    pos.z += ripple * bow;

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
      <planeGeometry args={[size[0], size[1], 48, 36]} />
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
      {/* ===== MAIN HULL BODY — tapered with curved bow/stern ===== */}
      {/* Bow section (front, wider, curves up) */}
      <mesh position={[0.9, 0, 0]} rotation={[0, 0, -0.12]} scale={[1.0, 0.32, 0.55]}>
        <sphereGeometry args={[0.95, 24, 16]} />
        <meshStandardMaterial color="#a47548" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Midsection (main hull volume) */}
      <mesh position={[-0.05, 0, 0]} scale={[1.4, 0.34, 0.58]}>
        <sphereGeometry args={[1.0, 24, 16]} />
        <meshStandardMaterial color="#8a6038" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Stern section (back, slightly taller for aftcastle base) */}
      <mesh position={[-1.0, 0.05, 0]} rotation={[0, 0, 0.15]} scale={[0.85, 0.38, 0.5]}>
        <sphereGeometry args={[0.9, 24, 16]} />
        <meshStandardMaterial color="#8a6038" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* ===== WATERLINE TRIM (dark band running full hull length) ===== */}
      <mesh position={[0, -0.05, 0.3]} scale={[2.6, 0.05, 0.05]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#3d2814" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.05, -0.3]} scale={[2.6, 0.05, 0.05]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#3d2814" roughness={0.9} />
      </mesh>

      {/* ===== UPPER HULL STRAKE (lighter trim above waterline) ===== */}
      <mesh position={[0, 0.12, 0.33]} scale={[2.55, 0.04, 0.03]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#c89968" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.12, -0.33]} scale={[2.55, 0.04, 0.03]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#c89968" roughness={0.8} />
      </mesh>

      {/* ===== DECK ===== */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[2.4, 0.04, 0.9]} />
        <meshStandardMaterial color="#c89968" roughness={0.75} />
      </mesh>

      {/* ===== DECK PLANKS (thin stripes for plank detail) ===== */}
      {[-0.3, 0, 0.3].map((z, i) => (
        <mesh key={`plank-${i}`} position={[0, 0.22, z]}>
          <boxGeometry args={[2.3, 0.005, 0.015]} />
          <meshStandardMaterial color="#6a4228" />
        </mesh>
      ))}

      {/* ===== RAILINGS (low bulwark around deck perimeter) ===== */}
      {/* Starboard rail */}
      <mesh position={[0, 0.32, 0.42]}>
        <boxGeometry args={[2.3, 0.18, 0.04]} />
        <meshStandardMaterial color="#8a6038" roughness={0.85} />
      </mesh>
      {/* Port rail */}
      <mesh position={[0, 0.32, -0.42]}>
        <boxGeometry args={[2.3, 0.18, 0.04]} />
        <meshStandardMaterial color="#8a6038" roughness={0.85} />
      </mesh>

      {/* Rail top caps (lighter wood) */}
      <mesh position={[0, 0.42, 0.42]}>
        <boxGeometry args={[2.3, 0.025, 0.06]} />
        <meshStandardMaterial color="#c89968" roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.42, -0.42]}>
        <boxGeometry args={[2.3, 0.025, 0.06]} />
        <meshStandardMaterial color="#c89968" roughness={0.75} />
      </mesh>

      {/* Rail vertical supports (stanchions) */}
      {[-1.0, -0.5, 0, 0.5, 1.0].map((x, i) => (
        <group key={`stanchion-${i}`}>
          <mesh position={[x, 0.32, 0.42]}>
            <boxGeometry args={[0.05, 0.2, 0.06]} />
            <meshStandardMaterial color="#6a4228" />
          </mesh>
          <mesh position={[x, 0.32, -0.42]}>
            <boxGeometry args={[0.05, 0.2, 0.06]} />
            <meshStandardMaterial color="#6a4228" />
          </mesh>
        </group>
      ))}

      {/* ===== PORTHOLES (circular windows along hull side) ===== */}
      {[-0.8, -0.4, 0, 0.4, 0.8].map((x, i) => (
        <group key={`porthole-${i}`}>
          {/* Starboard porthole */}
          <mesh position={[x, -0.02, 0.42]}>
            <torusGeometry args={[0.055, 0.012, 8, 16]} />
            <meshStandardMaterial color="#3d2814" />
          </mesh>
          <mesh position={[x, -0.02, 0.415]}>
            <circleGeometry args={[0.05, 16]} />
            <meshBasicMaterial color="#ffb060" toneMapped={false} />
          </mesh>
          {/* Port porthole */}
          <mesh position={[x, -0.02, -0.42]} rotation={[0, Math.PI, 0]}>
            <torusGeometry args={[0.055, 0.012, 8, 16]} />
            <meshStandardMaterial color="#3d2814" />
          </mesh>
          <mesh position={[x, -0.02, -0.415]} rotation={[0, Math.PI, 0]}>
            <circleGeometry args={[0.05, 16]} />
            <meshBasicMaterial color="#ffb060" toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* ===== AFTCASTLE (raised stern deck/cabin) ===== */}
      {/* Lower tier */}
      <mesh position={[-0.95, 0.45, 0]}>
        <boxGeometry args={[0.7, 0.3, 0.72]} />
        <meshStandardMaterial color="#8a6038" roughness={0.85} />
      </mesh>
      {/* Upper tier (captain's quarters) */}
      <mesh position={[-1.05, 0.75, 0]}>
        <boxGeometry args={[0.55, 0.3, 0.62]} />
        <meshStandardMaterial color="#9a6d42" roughness={0.85} />
      </mesh>
      {/* Stern cabin windows (big amber glow) */}
      <mesh position={[-1.34, 0.75, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.55, 0.2]} />
        <meshBasicMaterial color="#ffcc70" toneMapped={false} />
      </mesh>
      {/* Stern window frame (dark trim around the window) */}
      <mesh position={[-1.335, 0.75, 0]} rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry args={[0.13, 0.16, 4, 1, 0, Math.PI * 2]} />
        <meshBasicMaterial color="#3d2814" toneMapped={false} />
      </mesh>

      {/* Aftcastle roof */}
      <mesh position={[-1.05, 0.92, 0]}>
        <boxGeometry args={[0.6, 0.04, 0.68]} />
        <meshStandardMaterial color="#3d2814" roughness={0.9} />
      </mesh>

      {/* Decorative stern trim (scroll/cornice) */}
      <mesh position={[-1.35, 0.55, 0]}>
        <torusGeometry args={[0.09, 0.02, 6, 12]} />
        <meshStandardMaterial color="#c89968" />
      </mesh>

      {/* ===== FORECASTLE (raised bow deck) ===== */}
      <mesh position={[1.0, 0.35, 0]}>
        <boxGeometry args={[0.45, 0.18, 0.75]} />
        <meshStandardMaterial color="#8a6038" roughness={0.85} />
      </mesh>

      {/* ===== BOWSPRIT (short pole angled up from prow) ===== */}
      <mesh position={[1.65, 0.55, 0]} rotation={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.02, 0.025, 0.4, 8]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
      </mesh>

      {/* Bowsprit decorative ring near tip */}
      <mesh position={[1.82, 0.67, 0]} rotation={[0, 0, -0.4 + Math.PI / 2]}>
        <torusGeometry args={[0.03, 0.008, 6, 12]} />
        <meshStandardMaterial color="#c89968" />
      </mesh>

      {/* ===== ANCHOR (hanging off the bow starboard side) ===== */}
      <group position={[0.95, -0.08, 0.42]} rotation={[0.1, 0, 0.1]}>
        {/* Shaft */}
        <mesh>
          <cylinderGeometry args={[0.015, 0.015, 0.22, 6]} />
          <meshStandardMaterial color="#2a2030" metalness={0.6} roughness={0.5} />
        </mesh>
        {/* Crossbar (top) */}
        <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.14, 6]} />
          <meshStandardMaterial color="#2a2030" metalness={0.6} roughness={0.5} />
        </mesh>
        {/* Ring (bottom curved flukes — simplified as a torus arc) */}
        <mesh position={[0, -0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.06, 0.012, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#2a2030" metalness={0.6} roughness={0.5} />
        </mesh>
      </group>

      {/* ===== UPSWEPT PROW (bow curves up like a classic galleon) ===== */}
      {/* Main prow block — rises from hull line up and forward */}
      <mesh position={[1.45, 0.25, 0]} rotation={[0, 0, 0.35]} scale={[0.25, 0.5, 0.5]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#8a6038" roughness={0.85} />
      </mesh>
      {/* Prow upper curve — decorative scroll at top */}
      <mesh position={[1.52, 0.55, 0]} rotation={[Math.PI / 2, 0, 0.3]}>
        <torusGeometry args={[0.07, 0.025, 6, 12]} />
        <meshStandardMaterial color="#c89968" />
      </mesh>
      {/* Small figurehead medallion on the prow face */}
      <mesh position={[1.55, 0.35, 0]}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshStandardMaterial color="#c89968" roughness={0.6} metalness={0.2} />
      </mesh>

      {/* ===== ENGINE HOUSING (where rudder would be, below stern) ===== */}
      <mesh position={[-1.45, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.28, 0.4, 12]} />
        <meshStandardMaterial color="#3d2814" roughness={0.85} />
      </mesh>

      {/* Engine housing brass bands */}
      <mesh position={[-1.55, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.24, 0.018, 6, 20]} />
        <meshStandardMaterial color="#c89968" metalness={0.3} />
      </mesh>
      <mesh position={[-1.35, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.27, 0.018, 6, 20]} />
        <meshStandardMaterial color="#c89968" metalness={0.3} />
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

      {/* Nozzle emissive ring — aligned to rear face of new engine housing */}
      <mesh position={[-1.68, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.2, 0.035, 8, 20]} />
        <meshBasicMaterial color="#ffb060" toneMapped={false} />
      </mesh>

      {/* ===== FLAME ===== */}
      <EnginePlume position={[-2.4, 0, 0]} />
    </group>
  );
}

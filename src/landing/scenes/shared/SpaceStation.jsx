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

    // Both top (uv.y=1) and bottom (uv.y=0) pinned. Max freedom in middle.
    float edgeDist = vUv.y * (1.0 - vUv.y) * 4.0;
    float freedom = pow(edgeDist, 1.2);

    // ============================================
    // FOUR NON-HARMONIC TIME RATES
    // Frequencies use irrational-ish ratios so combined motion
    // has effectively infinite period.
    // ============================================
    float a = uTime * 1.37;
    float b = uTime * 2.13;
    float c = uTime * 0.89;
    float d = uTime * 3.41;

    // Spatial hash for per-vertex phase variation
    float jx = sin(vUv.x * 47.3 + vUv.y * 23.1) * 0.5 + 0.5;
    float jy = sin(vUv.x * 31.7 - vUv.y * 19.4) * 0.5 + 0.5;

    // ============================================
    // WIND FROM LEFT
    // In local space (before the Y-rotation on the mesh), wind
    // blowing from left pushes the sail in the NEGATIVE Z direction
    // when the sail is flipped 90°.
    // Negative Z displacement = sail bulges toward camera-facing side.
    // ============================================

    // Main billow: wind pressure bulges sail in -Z
    float billow = sin(a * 0.5 + vUv.y * 1.2) * 0.18 + 0.55;  // range ~0.37 to 0.73
    pos.z += billow * freedom;

    // Depth variation (wave-like in/out motion on top of billow)
    float depthZ = sin(b - vUv.y * 3.9 + jy) * 0.25
                 + sin(d * 0.5 + vUv.x * 2.7 - vUv.y * 3.0) * 0.16
                 + sin(a * 1.4 - vUv.x * 1.3) * 0.10;
    pos.z += depthZ * freedom;

    // Vertical ripple (sail surface rippling up/down)
    float rippleY = sin(c - vUv.y * 5.2 + jx * 3.0) * 0.12
                  + sin(d * 0.7 + vUv.x * 1.9) * 0.08;
    pos.y += rippleY * freedom;

    // Lateral wobble (sail surface waves side to side slightly)
    float wobbleX = sin(b * 0.6 - vUv.y * 6.1 + jy * 2.0) * 0.08
                  + sin(c * 1.7 + vUv.x * 2.3 - jx) * 0.06;
    pos.x += wobbleX * freedom;

    // High-freq edge chop (trailing edge has faster small ripples)
    float edgeChop = sin(d * 2.1 + vUv.x * 7.0 + vUv.y * 4.0) * 0.035
                   + sin(b * 3.3 - vUv.y * 9.0) * 0.025;
    float trailingEdge = smoothstep(0.4, 1.0, vUv.x);
    pos.z += edgeChop * trailingEdge * freedom;

    // Pin at both top AND bottom — wider blend zones (25% each)
    // to avoid visible seams between pinned and free regions
    float topPin = smoothstep(1.0, 0.75, vUv.y);
    float botPin = smoothstep(0.0, 0.25, vUv.y);
    float pinFactor = topPin * botPin;
    pos = mix(position, pos, pinFactor);

    vBow = billow;

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
    vec3 tColor    = vec3(0.93, 0.48, 0.18);   // warm watercolor orange

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
  const thrustRef = useRef(1.0);
  const lastXRef = useRef(position[0]);

  // === MANEUVER STATE MACHINE ===
  const maneuverRef = useRef({
    state: 'idle',               // 'idle' | 'charging' | 'executing' | 'recovering'
    type: null,                  // 'vertLoop' | 'horizLoop' | 'barrelRoll' | 'figure8'
    startTime: 0,
    duration: 0,
    nextTriggerAt: 5,            // TEMPORARY — maneuver fires in 5 seconds
    // Store idle position to return to
    idleX: position[0],
    idleY: position[1],
    idleZ: position[2],
  });

  const trailRef = useRef({ active: false });     // light streak trail toggle
  const restAnchorRef = useRef({
    x: position[0],
    y: position[1],
    z: position[2],
  });

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const m = maneuverRef.current;

    // === STATE TRANSITIONS ===

    if (m.state === 'idle' && t >= m.nextTriggerAt) {
      m.type = 'horizLoop';
      m.state = 'charging';
      m.startTime = t;
      m.duration = 1.6;  // was 0.8 — ship takes longer to build up thrust
    }

    else if (m.state === 'charging' && t - m.startTime >= m.duration) {
      // Transition to executing
      m.state = 'executing';
      m.startTime = t;
      m.duration = 5.5;
      // Capture ACTUAL position at moment of launch — no more teleport
      m.idleX = groupRef.current.position.x;
      m.idleY = groupRef.current.position.y;
      m.idleZ = groupRef.current.position.z;
      trailRef.current.active = true;
    }

    else if (m.state === 'executing' && t - m.startTime >= m.duration) {
      // Set restAnchor so the idle drift THIS frame produces the
      // ship's current position — no jump when drift takes over.
      // We compute what drift would output at this exact t, then
      // subtract that from ship position to get the anchor.
      const driftX = Math.sin(t * 0.18) * 2.5
                   + Math.sin(t * 0.11 + 1.2) * 1.3
                   + Math.sin(t * 0.07 + 2.1) * 0.8;
      const driftZ = Math.sin(t * 0.13 + 0.7) * 0.6
                   + Math.cos(t * 0.09) * 0.4;
      const bob = Math.sin(t * 0.55);
      const bobY = bob > 0 ? bob * 0.35 : bob * 0.75;
      const roamY = Math.sin(t * 0.08 + 1.7) * 0.8
                  + Math.sin(t * 0.14 + 0.3) * 0.4;

      restAnchorRef.current.x = groupRef.current.position.x - driftX;
      restAnchorRef.current.y = groupRef.current.position.y - bobY - roamY;
      restAnchorRef.current.z = groupRef.current.position.z - driftZ;

      m.state = 'idle';
      m.type = null;
      m.nextTriggerAt = t + 120 + Math.random() * 120;
      trailRef.current.active = false;
    }

    // === IDLE DRIFT (when not executing maneuver) ===
    let baseX = position[0];
    let baseY = position[1];
    let baseZ = position[2];
    let rotY = rotation?.[1] ?? 0;
    let rotX = 0;
    let rotZ = 0;

    if (m.state === 'idle' || m.state === 'charging') {
      // Bob
      const bob = Math.sin(t * 0.55);
      const bobY = bob > 0 ? bob * 0.35 : bob * 0.75;

      // Wide drift
      const driftX = Math.sin(t * 0.18) * 2.5
                   + Math.sin(t * 0.11 + 1.2) * 1.3
                   + Math.sin(t * 0.07 + 2.1) * 0.8;
      const driftZ = Math.sin(t * 0.13 + 0.7) * 0.6
                   + Math.cos(t * 0.09) * 0.4;
      const roamY = Math.sin(t * 0.08 + 1.7) * 0.8
                  + Math.sin(t * 0.14 + 0.3) * 0.4;

      // Gust lurches
      const gustCycle = Math.sin(t * 0.18 + 0.5);
      const gustIntensity = Math.pow(Math.max(0, gustCycle), 8);
      const gustX = gustIntensity * Math.sin(t * 2.3) * 0.3;
      const gustY = gustIntensity * Math.sin(t * 1.9) * 0.2;

      baseX = restAnchorRef.current.x + driftX + gustX;
      baseY = restAnchorRef.current.y + bobY + roamY + gustY;
      baseZ = restAnchorRef.current.z + driftZ;

      rotY = (rotation?.[1] ?? 0) + Math.sin(t * 0.22) * 0.06 + driftX * 0.015;
      rotX = Math.sin(t * 0.55 + 0.5) * 0.07;
      rotZ = Math.sin(t * 0.31 + 0.3) * 0.05;
    }

    // === MANEUVER OVERRIDES ===

    if (m.state === 'executing') {
      const p = (t - m.startTime) / m.duration;  // 0 to 1

      if (m.type === 'horizLoop') {
        // Horizontal circle — big sweep across frame
        const loopT = p * Math.PI * 2;
        const radius = 4.5;
        baseX = m.idleX + Math.sin(loopT) * radius;
        // Shift so loop starts AND ends at y=idleY instead of y=idleY+1.2
        baseY = m.idleY + (Math.cos(loopT) - 1.0) * 1.2;
        baseZ = m.idleZ - (1 - Math.cos(loopT)) * 2.0;  // arcs into depth
        rotY = (rotation?.[1] ?? 0) + loopT;      // ship yaws through circle
      }
    }

    // === APPLY ALL TRANSFORMS ===
    groupRef.current.position.x = baseX;
    groupRef.current.position.y = baseY;
    groupRef.current.position.z = baseZ;
    groupRef.current.rotation.y = rotY;
    groupRef.current.rotation.x = rotX;
    groupRef.current.rotation.z = rotZ;

    // === THRUST MODULATION ===
    // During maneuvers, thrust is FULL regardless of velocity
    if (m.state === 'executing' || m.state === 'charging') {
      thrustRef.current = 1.5;  // overpower during maneuver
    } else {
      // Normal velocity-based thrust
      const currentX = groupRef.current.position.x;
      const vx = (currentX - lastXRef.current) * 60;
      thrustRef.current = Math.min(1.0, Math.max(0, vx / 0.8));
    }
    lastXRef.current = groupRef.current.position.x;

    // Gentle pull of rest anchor back toward mount over long time
    if (m.state === 'idle') {
      restAnchorRef.current.x += (position[0] - restAnchorRef.current.x) * 0.001;
      restAnchorRef.current.y += (position[1] - restAnchorRef.current.y) * 0.001;
      restAnchorRef.current.z += (position[2] - restAnchorRef.current.z) * 0.001;
    }
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
      <mesh position={[-0.2, 1.55, 0]} rotation={[0, 0, 0.08]}>
        <cylinderGeometry args={[0.05, 0.07, 3.3, 10]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
      </mesh>

      {/* ===== YARD (horizontal spar sail hangs from) ===== */}
      <mesh position={[-0.15, 3.1, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 3.05, 10]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
      </mesh>

      {/* ===== BOOM (horizontal spar at bottom of sail) ===== */}
      <mesh position={[-0.15, 1.15, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 3.05, 10]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} />
      </mesh>

      {/* ===== SINGLE LARGE SOLAR SAIL ===== */}
      {/* Positioned above and slightly behind ship center, large and swept */}
      <SolarSail
        position={[-0.15, 2.15, 0]}
        size={[3.0, 2.55]}
        rotation={[0, Math.PI / 2, 0]}
      />

      {/* ===== LANTERNS ===== */}
      <Lantern position={[0.9, 0.35, 0.38]} />
      <Lantern position={[-0.3, 0.35, 0.38]} />

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
      <EnginePlume position={[-2.4, 0, 0]} thrustRef={thrustRef} />
    </group>
  );
}

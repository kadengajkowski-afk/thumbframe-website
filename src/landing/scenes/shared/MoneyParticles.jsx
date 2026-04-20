// Money particles for /pricing — gold coins, dollar bills, gold sparkles.
//
// Wind-carried from screen-LEFT to screen-RIGHT with slight vertical
// wobble. Simple mesh geometries with strong saturated colors so the
// painterly post (Kuwahara + Moebius outline + paper grain) has
// enough signal to render them as watercolor shapes.
//
// Each particle is pre-allocated with its own phase; when it exits
// right, it respawns off-screen left.

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// World-space envelope for camera fov=50, pos=[0,0,9] at z=0. Wider
// entry/exit margins so particles are fully off-screen before swap.
const SPAWN_X_MIN = -9.0, SPAWN_X_MAX = -6.5;
const EXIT_X      = 8.5;
const Y_MIN       = -3.0, Y_MAX      = 3.0;
const Z_MIN       = -1.2, Z_MAX      = 1.0;

function randRange(min, max) { return min + Math.random() * (max - min); }

// ─── Gold coins ────────────────────────────────────────────────────────────
function GoldCoins({ count = 5 }) {
  const groupRef = useRef();

  // Transit 12-18s. Scene width ≈ 17.5 units → speed 0.97..1.46.
  const coins = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x:       randRange(SPAWN_X_MIN - i * 2.5, SPAWN_X_MAX), // stagger entry
    y:       randRange(Y_MIN + 0.5, Y_MAX - 0.5),
    z:       randRange(Z_MIN, Z_MAX),
    vx:      randRange(0.97, 1.46),
    wobAmp:  randRange(0.15, 0.35),
    wobFreq: randRange(0.6, 1.1),
    spin:    randRange(1.2, 2.2),
    phase:   randRange(0, Math.PI * 2),
    size:    randRange(0.22, 0.38),
    yBase:   0,
  })), [count]);
  // Capture each coin's initial Y as its wobble baseline.
  coins.forEach((c) => { c.yBase = c.y; });

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const t = performance.now() / 1000;
    groupRef.current.children.forEach((mesh, i) => {
      const c = coins[i];
      c.x += c.vx * delta;
      if (c.x > EXIT_X) {
        c.x = randRange(SPAWN_X_MIN, SPAWN_X_MAX);
        c.yBase = randRange(Y_MIN + 0.5, Y_MAX - 0.5);
        c.z = randRange(Z_MIN, Z_MAX);
      }
      const wobY = Math.sin(t * c.wobFreq + c.phase) * c.wobAmp;
      mesh.position.set(c.x, c.yBase + wobY, c.z);
      mesh.rotation.y = t * c.spin + c.phase;  // tumbles sideways
      mesh.rotation.z = Math.sin(t * 0.5 + c.phase) * 0.12;
    });
  });

  return (
    <group ref={groupRef}>
      {coins.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]} scale={c.size}>
          <circleGeometry args={[0.5, 24]} />
          <meshStandardMaterial
            color="#ffc340"
            emissive="#ffb020"
            emissiveIntensity={0.4}
            roughness={0.45}
            metalness={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Dollar bills ──────────────────────────────────────────────────────────
function DollarBills({ count = 2 }) {
  const groupRef = useRef();

  // Transit ~10s → speed 1.7-2.1.
  const bills = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x:       randRange(SPAWN_X_MIN - i * 3.0, SPAWN_X_MAX),
    y:       randRange(Y_MIN + 0.5, Y_MAX - 0.5),
    z:       randRange(Z_MIN, Z_MAX),
    vx:      randRange(1.7, 2.1),
    wobAmp:  randRange(0.2, 0.4),
    wobFreq: randRange(0.7, 1.3),
    flutter: randRange(2.4, 3.4),
    phase:   randRange(0, Math.PI * 2),
    size:    randRange(0.34, 0.44),
    yBase:   0,
  })), [count]);
  bills.forEach((b) => { b.yBase = b.y; });

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const t = performance.now() / 1000;
    groupRef.current.children.forEach((mesh, i) => {
      const b = bills[i];
      b.x += b.vx * delta;
      if (b.x > EXIT_X) {
        b.x = randRange(SPAWN_X_MIN, SPAWN_X_MAX);
        b.yBase = randRange(Y_MIN + 0.5, Y_MAX - 0.5);
        b.z = randRange(Z_MIN, Z_MAX);
      }
      const wobY = Math.sin(t * b.wobFreq + b.phase) * b.wobAmp;
      mesh.position.set(b.x, b.yBase + wobY, b.z);
      // Flutter (Z-axis tumble) + gentle Y-tilt for paper-in-wind feel.
      mesh.rotation.z = Math.sin(t * b.flutter + b.phase) * 0.5;
      mesh.rotation.y = Math.sin(t * 0.9 + b.phase) * 0.3;
    });
  });

  return (
    <group ref={groupRef}>
      {bills.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]} scale={b.size}>
          <planeGeometry args={[2.2, 1.0]} />
          <meshStandardMaterial
            color="#c8b878"
            emissive="#8a7a40"
            emissiveIntensity={0.25}
            roughness={0.75}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Gold sparkles ─────────────────────────────────────────────────────────
function GoldSparkles({ count = 18 }) {
  const pointsRef = useRef();

  const { positions, sizes, phases, vx, yBase } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz  = new Float32Array(count);
    const ph  = new Float32Array(count);
    const vx_ = new Float32Array(count);
    const yb  = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = randRange(SPAWN_X_MIN - i * 1.5, EXIT_X);
      pos[i * 3 + 1] = randRange(Y_MIN, Y_MAX);
      pos[i * 3 + 2] = randRange(Z_MIN, Z_MAX);
      sz[i] = randRange(1.2, 2.4);
      ph[i] = randRange(0, Math.PI * 2);
      vx_[i] = randRange(0.55, 0.85); // slower than coins
      yb[i] = pos[i * 3 + 1];
    }
    return { positions: pos, sizes: sz, phases: ph, vx: vx_, yBase: yb };
  }, [count]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    uniforms.uTime.value = performance.now() / 1000;
    const arr = pointsRef.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      arr[i * 3] += vx[i] * delta;
      if (arr[i * 3] > EXIT_X) {
        arr[i * 3] = randRange(SPAWN_X_MIN, SPAWN_X_MAX);
        yBase[i] = randRange(Y_MIN, Y_MAX);
      }
      const wobY = Math.sin(uniforms.uTime.value * 0.7 + phases[i]) * 0.25;
      arr[i * 3 + 1] = yBase[i] + wobY;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  const vert = /* glsl */ `
    attribute float aSize;
    attribute float aPhase;
    uniform float uTime;
    varying float vAlpha;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float tw = sin(uTime * 0.9 + aPhase) * 0.5 + 0.5;
      vAlpha = 0.45 + tw * 0.5;
      gl_PointSize = clamp(aSize, 1.0, 3.0);
      gl_Position = projectionMatrix * mv;
    }
  `;
  const frag = /* glsl */ `
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.1, d) * vAlpha;
      gl_FragColor = vec4(1.0, 0.82, 0.3, a);
    }
  `;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
        <bufferAttribute attach="attributes-aSize"    array={sizes}     count={count} itemSize={1} />
        <bufferAttribute attach="attributes-aPhase"   array={phases}    count={count} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function MoneyParticles({
  coinCount = 5,
  billCount = 2,
  sparkleCount = 18,
}) {
  return (
    <>
      <GoldSparkles count={sparkleCount} />
      <GoldCoins count={coinCount} />
      <DollarBills count={billCount} />
    </>
  );
}

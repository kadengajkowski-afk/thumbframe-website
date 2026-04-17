// Engine plume — nozzle bell + sprite-based teardrop flame + sparks.
// Flame is multiple billboard planes for viewing-angle independence.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Nozzle bell — dark metal with hot emissive ring ─────────────────────────

function Nozzle() {
  return (
    <group>
      {/* Bell cone — dark metal */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.14, 0.28, 8]} />
        <meshStandardMaterial color="#3a3050" roughness={0.8} metalness={0.3} />
      </mesh>
      {/* Hot emissive ring at nozzle exit */}
      <mesh position={[0.14, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.12, 0.018, 8, 16]} />
        <meshBasicMaterial color="#ffe0a0" toneMapped={false} />
      </mesh>
    </group>
  );
}

// ── Flame — multiple cross-planes (always visible from any angle) ───────────

const flameFrag = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    // Teardrop shape: wide at left (nozzle), tapering to right (tip)
    float progress = vUv.x; // 0=nozzle, 1=tip

    // Vertical taper — flame narrows toward tip
    float halfWidth = 0.5 - progress * 0.4;
    float edgeDist = abs(vUv.y - 0.5) / halfWidth;
    if (edgeDist > 1.0) discard;

    // Soft edge
    float soft = smoothstep(1.0, 0.6, edgeDist);

    // Core brightness — hottest at nozzle
    float core = smoothstep(0.8, 0.0, edgeDist) * smoothstep(0.7, 0.0, progress);

    // Color ramp: white-hot core → amber → deep red → fade
    vec3 hotCore  = vec3(1.0, 0.96, 0.82); // #fff5d0
    vec3 amber    = vec3(0.98, 0.45, 0.09); // #f97316
    vec3 deepRed  = vec3(0.78, 0.13, 0.13); // #c82020

    vec3 color = mix(deepRed, amber, smoothstep(0.6, 0.2, progress));
    color = mix(color, hotCore, core);

    // Flicker
    float flicker = sin(uTime * 40.0 + progress * 8.0) * 0.06
                  + sin(uTime * 27.0 - progress * 5.0) * 0.04;
    color *= 1.0 + flicker;

    float alpha = soft * smoothstep(1.0, 0.15, progress) * 0.8;

    gl_FragColor = vec4(color, alpha);
  }
`;

const flameVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function FlamePlane({ rotationZ = 0 }) {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const ref = useRef();

  useFrame(({ clock }) => { uniforms.uTime.value = clock.elapsedTime; });

  return (
    <mesh ref={ref} position={[-0.55, 0, 0]} rotation={[rotationZ, 0, 0]}>
      <planeGeometry args={[1.2, 0.35]} />
      <shaderMaterial
        vertexShader={flameVert}
        fragmentShader={flameFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function FlameCore() {
  return (
    <group>
      {/* 3 crossing planes — visible from any rotation angle */}
      <FlamePlane rotationZ={0} />
      <FlamePlane rotationZ={Math.PI / 3} />
      <FlamePlane rotationZ={-Math.PI / 3} />
    </group>
  );
}

// ── Sparks ───────────────────────────────────────────────────────────────────

const SPARK_COUNT = 40;

function resetSpark(positions, velocities, lifetimes, ages, sizes, i) {
  positions[i * 3]     = 0;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 0.08;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
  const speed = 1.2 + Math.random() * 1.8;
  const spread = 0.44;
  velocities[i] = [
    -speed,
    Math.sin((Math.random() - 0.5) * spread) * speed * 0.25,
    Math.sin((Math.random() - 0.5) * spread) * speed * 0.25,
  ];
  lifetimes[i] = 0.4 + Math.random() * 0.4;
  ages[i] = 0;
  sizes[i] = 0.01 + Math.random() * 0.02;
}

function Sparks() {
  const pointsRef = useRef();
  const { positions, velocities, lifetimes, ages, sizes } = useMemo(() => {
    const p = new Float32Array(SPARK_COUNT * 3);
    const v = Array.from({ length: SPARK_COUNT }, () => [0, 0, 0]);
    const lt = new Float32Array(SPARK_COUNT);
    const a = new Float32Array(SPARK_COUNT);
    const s = new Float32Array(SPARK_COUNT);
    for (let i = 0; i < SPARK_COUNT; i++) {
      resetSpark(p, v, lt, a, s, i);
      a[i] = Math.random() * lt[i];
    }
    return { positions: p, velocities: v, lifetimes: lt, ages: a, sizes: s };
  }, []);

  useFrame((_, dt) => {
    for (let i = 0; i < SPARK_COUNT; i++) {
      ages[i] += dt;
      if (ages[i] >= lifetimes[i]) resetSpark(positions, velocities, lifetimes, ages, sizes, i);
      positions[i * 3]     += velocities[i][0] * dt;
      positions[i * 3 + 1] += velocities[i][1] * dt;
      positions[i * 3 + 2] += velocities[i][2] * dt;
      velocities[i][0] *= 0.97;
      velocities[i][1] *= 0.97;
      velocities[i][2] *= 0.97;
    }
    if (pointsRef.current) {
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.geometry.attributes.aAge.needsUpdate = true;
    }
  });

  const sparkVert = /* glsl */ `
    attribute float aSize;
    attribute float aAge;
    attribute float aLifetime;
    varying float vLife;
    void main() {
      vLife = clamp(aAge / aLifetime, 0.0, 1.0);
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (1.0 - vLife * 0.5) * 200.0 / -mvPos.z;
      gl_Position = projectionMatrix * mvPos;
    }
  `;
  const sparkFrag = /* glsl */ `
    varying float vLife;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5) discard;
      float soft = smoothstep(0.5, 0.15, d);
      vec3 col = mix(vec3(1.0, 0.7, 0.2), vec3(0.6, 0.1, 0.05), vLife);
      gl_FragColor = vec4(col, soft * (1.0 - vLife));
    }
  `;
  const sparkUniforms = useMemo(() => ({}), []);

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={SPARK_COUNT} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" array={sizes} count={SPARK_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aAge" array={ages} count={SPARK_COUNT} itemSize={1} />
        <bufferAttribute attach="attributes-aLifetime" array={lifetimes} count={SPARK_COUNT} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial vertexShader={sparkVert} fragmentShader={sparkFrag}
        uniforms={sparkUniforms} transparent depthWrite={false}
        blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────

export default function EnginePlume({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <Nozzle />
      <FlameCore />
      <Sparks />
    </group>
  );
}

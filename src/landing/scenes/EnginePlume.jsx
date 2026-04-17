// Engine plume — animated plasma flame with noise displacement,
// spark particles, and hot nozzle glow.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ── Flame mesh — noise-displaced cone with animated color ───────────────────

const flameVert = /* glsl */ `
  uniform float uTime;
  uniform float uLength;
  varying float vProgress;
  varying float vDisplace;

  vec3 mod289(vec3 x) { return x - floor(x*(1.0/289.0))*289.0; }
  vec4 mod289(vec4 x) { return x - floor(x*(1.0/289.0))*289.0; }
  vec4 perm(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  float noise3(vec3 p) {
    vec3 a = floor(p); vec3 d = p-a; d = d*d*(3.0-2.0*d);
    vec4 b = a.xxyy + vec4(0,1,0,1);
    vec4 k1 = perm(b.xyxy); vec4 k2 = perm(k1.xyxy+b.zzww);
    vec4 c = k2+a.zzzz; vec4 k3 = perm(c); vec4 k4 = perm(c+1.0);
    vec4 o1 = fract(k3*(1.0/41.0)); vec4 o2 = fract(k4*(1.0/41.0));
    vec4 o3 = o2*d.z + o1*(1.0-d.z);
    vec2 o4 = o3.yw*d.x + o3.xz*(1.0-d.x);
    return o4.y*d.y + o4.x*(1.0-d.y);
  }

  void main() {
    // progress: 0 at nozzle, 1 at tip
    vProgress = (position.y + 0.5);

    // Noise displacement — irregular flame tongues
    float n1 = noise3(position * 4.0 + vec3(0.0, uTime * 6.0, 0.0));
    float n2 = noise3(position * 8.0 + vec3(uTime * 4.0, 0.0, uTime * 3.0));
    float displacement = (n1 * 0.6 + n2 * 0.4 - 0.5) * 0.15;

    // Flame narrows toward tip, widens at base
    float taper = 1.0 - vProgress * 0.7;
    // Radial displacement (push outward in XZ)
    vec3 radial = normalize(vec3(position.x, 0.0, position.z));
    float radialMag = length(position.xz);

    vec3 pos = position;
    pos.xz += radial.xz * displacement * taper;
    // Length oscillation
    pos.y *= uLength;
    // Flicker at tip
    pos.y += (n1 - 0.5) * 0.1 * vProgress;

    vDisplace = displacement;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const flameFrag = /* glsl */ `
  uniform float uTime;
  varying float vProgress;
  varying float vDisplace;

  void main() {
    // Hot core → midtone → outer edge color ramp
    vec3 hotCore  = vec3(1.0, 0.85, 0.56);  // #ffd890
    vec3 midTone  = vec3(0.98, 0.45, 0.09);  // #f97316
    vec3 outerEdge = vec3(0.78, 0.13, 0.13); // #c82020
    vec3 tipFade   = vec3(0.3, 0.08, 0.05);

    // Core is brightest at nozzle, fading along length
    float coreWeight = smoothstep(0.6, 0.0, vProgress);
    float midWeight  = smoothstep(0.0, 0.4, vProgress) * smoothstep(0.9, 0.5, vProgress);
    float tipWeight  = smoothstep(0.5, 1.0, vProgress);

    vec3 color = hotCore * coreWeight + midTone * midWeight + outerEdge * tipWeight * 0.5;
    color = mix(color, tipFade, tipWeight * 0.6);

    // Brightness flicker ~8Hz
    float flicker = sin(uTime * 50.0) * 0.08 + sin(uTime * 31.0) * 0.05;
    color *= 1.0 + flicker * (1.0 - vProgress);

    // Alpha: solid at base, fading at tip
    float alpha = smoothstep(1.05, 0.3, vProgress);
    alpha *= 0.9;

    gl_FragColor = vec4(color, alpha);
  }
`;

function FlameCore() {
  const meshRef = useRef();
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uLength: { value: 1.0 },
  }), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    uniforms.uTime.value = t;
    uniforms.uLength.value = 0.95 + Math.sin(t * 5.0) * 0.05 + Math.sin(t * 8.0) * 0.03;
  });

  return (
    <mesh ref={meshRef} rotation={[0, 0, -Math.PI / 2]} position={[-0.5, 0, 0]}>
      <coneGeometry args={[0.18, 1.4, 12, 8]} />
      <shaderMaterial
        vertexShader={flameVert}
        fragmentShader={flameFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── Spark particles — emitted from nozzle ───────────────────────────────────

const SPARK_COUNT = 50;

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
      a[i] = Math.random() * lt[i]; // stagger initial ages
    }
    return { positions: p, velocities: v, lifetimes: lt, ages: a, sizes: s };
  }, []);

  useFrame((_, dt) => {
    for (let i = 0; i < SPARK_COUNT; i++) {
      ages[i] += dt;
      if (ages[i] >= lifetimes[i]) {
        resetSpark(positions, velocities, lifetimes, ages, sizes, i);
      }
      // Move
      positions[i * 3]     += velocities[i][0] * dt;
      positions[i * 3 + 1] += velocities[i][1] * dt;
      positions[i * 3 + 2] += velocities[i][2] * dt;
      // Deceleration
      velocities[i][0] *= 0.98;
      velocities[i][1] *= 0.98;
      velocities[i][2] *= 0.98;
    }
    if (pointsRef.current) {
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.geometry.attributes.aAge.needsUpdate = true;
      pointsRef.current.geometry.attributes.aLifetime.needsUpdate = true;
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

      // amber → dark red → invisible
      vec3 col = mix(vec3(1.0, 0.7, 0.2), vec3(0.6, 0.1, 0.05), vLife);
      float alpha = soft * (1.0 - vLife);

      gl_FragColor = vec4(col, alpha);
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
      <shaderMaterial
        vertexShader={sparkVert}
        fragmentShader={sparkFrag}
        uniforms={sparkUniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function resetSpark(positions, velocities, lifetimes, ages, sizes, i) {
  // Emit from nozzle area
  positions[i * 3]     = -0.05 + Math.random() * 0.1;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 0.1;

  // Velocity: rearward (negative X) with ~25° cone spread
  const speed = 1.5 + Math.random() * 2.0;
  const spreadAngle = (Math.random() - 0.5) * 0.44; // ~25° half-angle
  const spreadAngle2 = (Math.random() - 0.5) * 0.44;
  velocities[i] = [
    -speed,
    Math.sin(spreadAngle) * speed * 0.3,
    Math.sin(spreadAngle2) * speed * 0.3,
  ];

  lifetimes[i] = 0.5 + Math.random() * 0.4;
  ages[i] = 0;
  sizes[i] = 0.015 + Math.random() * 0.025;
}

// ── Nozzle glow ring — hot white-orange emissive ────────────────────────────

function NozzleGlow() {
  return (
    <group>
      {/* Hot ring at each nozzle exit */}
      {[[0, 0.13, 0.03], [0, -0.13, -0.06], [0, 0.03, -0.13]].map((offset, i) => (
        <mesh key={i} position={offset} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.1, 0.015, 8, 12]} />
          <meshBasicMaterial color="#ffe0a0" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Exported group — drop into station at engine position ───────────────────

export default function EnginePlume({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <FlameCore />
      <Sparks />
      <NozzleGlow />
    </group>
  );
}

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ===== PARTICLE LAYER =====

const particleVS = `
  uniform float uTime;
  attribute float aSpeed;
  attribute float aOffset;
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    vec3 pos = position;

    // Flow from left (stern side) to right (bow direction)
    // Using aOffset so each particle has its own cycle position
    float cycle = mod(uTime * aSpeed + aOffset, 1.0);
    pos.x = mix(-14.0, 10.0, cycle);

    // Fade in near start, fade out near end
    vAlpha = smoothstep(0.0, 0.15, cycle) * (1.0 - smoothstep(0.85, 1.0, cycle));

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * 180.0 * (1.0 / -mv.z);
    gl_PointSize = clamp(gl_PointSize, 4.0, 11.0);
  }
`;

const particleFS = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    float soft = 1.0 - smoothstep(0.1, 0.5, dist);
    gl_FragColor = vec4(vColor, vAlpha * soft * 1.3);
  }
`;

function WindParticles({ count = 200 }) {
  const matRef = useRef();

  const { positions, speeds, offsets, sizes, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const palette = [
      [1.00, 0.82, 0.45],  // amber
      [1.00, 0.70, 0.35],  // deep amber
      [0.82, 0.60, 0.95],  // violet
      [0.70, 0.55, 0.98],  // deep violet
      [0.98, 0.88, 0.70],  // pale amber
    ];

    for (let i = 0; i < count; i++) {
      // Spread particles across Y and Z; X is driven by shader
      positions[i * 3]     = 0;  // overwritten in shader
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;

      speeds[i] = 0.06 + Math.random() * 0.08;  // 0.06-0.14
      offsets[i] = Math.random();
      sizes[i] = 0.04 + Math.random() * 0.08;

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3]     = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }
    return { positions, speeds, offsets, sizes, colors };
  }, [count]);

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
        <bufferAttribute attach="attributes-aSpeed" array={speeds} count={count} itemSize={1} />
        <bufferAttribute attach="attributes-aOffset" array={offsets} count={count} itemSize={1} />
        <bufferAttribute attach="attributes-aSize" array={sizes} count={count} itemSize={1} />
        <bufferAttribute attach="attributes-aColor" array={colors} count={count} itemSize={3} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={particleVS}
        fragmentShader={particleFS}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

// ===== COMBINED =====

export default function SolarWind() {
  return (
    <>
      <WindParticles count={280} />
    </>
  );
}

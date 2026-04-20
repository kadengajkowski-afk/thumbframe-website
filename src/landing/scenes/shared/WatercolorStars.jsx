import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  uniform float uTime;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    // Slow pulse — stars breathe at different rates
    vAlpha = 0.55 + sin(uTime * 0.4 + aPhase) * 0.25;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * 200.0 * (1.0 / -mv.z);
    gl_PointSize = clamp(gl_PointSize, 3.0, 14.0);
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Soft radial falloff — painterly glow
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    // Core bright center with soft halo
    float core = 1.0 - smoothstep(0.0, 0.15, dist);
    float halo = 1.0 - smoothstep(0.15, 0.5, dist);

    vec3 color = vColor * (core * 1.2 + halo * 0.4);
    float alpha = (core + halo * 0.5) * vAlpha;

    gl_FragColor = vec4(color, alpha);
  }
`;

export default function WatercolorStars({ count = 50 }) {
  const matRef = useRef();
  const pointsRef = useRef();

  const { positions, sizes, phases, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    // Palette: warm cream, amber, dusty rose, icy violet
    const palette = [
      [0.98, 0.94, 0.82],
      [1.00, 0.82, 0.55],
      [0.95, 0.78, 0.70],
      [0.82, 0.75, 0.95],
    ];

    for (let i = 0; i < count; i++) {
      // Distribute in a large sphere shell — keeps them in visible range
      const r = 15 + Math.random() * 25;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      sizes[i] = 0.08 + Math.random() * 0.14;
      phases[i] = Math.random() * Math.PI * 2;

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3]     = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }
    return { positions, sizes, phases, colors };
  }, [count]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          array={sizes}
          count={count}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aPhase"
          array={phases}
          count={count}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aColor"
          array={colors}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

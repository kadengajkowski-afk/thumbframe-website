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
    gl_PointSize = clamp(gl_PointSize, 4.0, 16.0);
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
    gl_FragColor = vec4(vColor, vAlpha * soft * 1.2);
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

// ===== RIBBON LAYER =====

const ribbonVS = `
  uniform float uTime;
  attribute float aOffset;
  attribute float aSpeed;
  attribute float aYBase;
  attribute float aZBase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vUv;

  void main() {
    vColor = aColor;
    vUv = uv;
    vec3 pos = position;

    // Ribbon flows from -X to +X over time
    float cycle = mod(uTime * aSpeed + aOffset, 1.0);
    float ribbonX = mix(-16.0, 12.0, cycle);

    // Ribbon is a long thin plane. UV.x 0→1 = length along ribbon.
    // Each ribbon is 4 units long, so offset its vertices along X
    pos.x = ribbonX + (uv.x - 0.5) * 5.0;
    pos.y = aYBase + sin(pos.x * 0.3 + uTime * 0.8) * 0.25;
    pos.z = aZBase;

    // Fade in/out at cycle edges, taper at ribbon length edges
    float cycleFade = smoothstep(0.0, 0.2, cycle) * (1.0 - smoothstep(0.8, 1.0, cycle));
    float lengthFade = sin(uv.x * 3.14159);
    vAlpha = cycleFade * lengthFade * 0.4;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const ribbonFS = `
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vUv;

  void main() {
    // Taper thickness — ribbon is thin at the center of its length,
    // slightly thicker elsewhere
    float thickness = 1.0 - abs(vUv.y - 0.5) * 2.0;
    thickness = smoothstep(0.0, 1.0, thickness);
    gl_FragColor = vec4(vColor, vAlpha * thickness);
  }
`;

function WindRibbons({ count = 8 }) {
  const matRefs = useRef([]);

  const ribbons = useMemo(() => {
    const palette = [
      [1.00, 0.78, 0.42],
      [0.85, 0.62, 0.95],
      [0.95, 0.70, 0.55],
      [0.75, 0.60, 1.00],
    ];
    return Array.from({ length: count }, (_, i) => ({
      key: i,
      yBase: (Math.random() - 0.5) * 10,
      zBase: (Math.random() - 0.5) * 5 - 1,
      offset: Math.random(),
      speed: 0.04 + Math.random() * 0.05,
      color: palette[Math.floor(Math.random() * palette.length)],
    }));
  }, [count]);

  useFrame((state) => {
    matRefs.current.forEach((m) => {
      if (m) m.uniforms.uTime.value = state.clock.elapsedTime;
    });
  });

  return (
    <group>
      {ribbons.map((r, i) => {
        const uniforms = {
          uTime:   { value: 0 },
          aOffset: { value: r.offset },
          aSpeed:  { value: r.speed },
          aYBase:  { value: r.yBase },
          aZBase:  { value: r.zBase },
          aColor:  { value: new THREE.Color(r.color[0], r.color[1], r.color[2]) },
        };
        return (
          <mesh key={r.key}>
            <planeGeometry args={[5, 0.18, 32, 1]} />
            <shaderMaterial
              ref={(el) => (matRefs.current[i] = el)}
              uniforms={{
                uTime:  { value: 0 },
                aSpeed: { value: r.speed },
                aOffset: { value: r.offset },
                aYBase: { value: r.yBase },
                aZBase: { value: r.zBase },
                aColor: { value: new THREE.Color(r.color[0], r.color[1], r.color[2]) },
              }}
              vertexShader={ribbonVS.replace('attribute float aOffset;', 'uniform float aOffset;')
                                     .replace('attribute float aSpeed;', 'uniform float aSpeed;')
                                     .replace('attribute float aYBase;', 'uniform float aYBase;')
                                     .replace('attribute float aZBase;', 'uniform float aZBase;')
                                     .replace('attribute vec3 aColor;', 'uniform vec3 aColor;')}
              fragmentShader={ribbonFS}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ===== COMBINED =====

export default function SolarWind() {
  return (
    <>
      <WindParticles count={500} />
      <WindRibbons count={8} />
    </>
  );
}

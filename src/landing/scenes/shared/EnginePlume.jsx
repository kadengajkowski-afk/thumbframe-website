import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vDist;

  // hash-based smooth noise
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(p + vec3(0,0,0)), hash(p + vec3(1,0,0)), f.x),
                   mix(hash(p + vec3(0,1,0)), hash(p + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(p + vec3(0,0,1)), hash(p + vec3(1,0,1)), f.x),
                   mix(hash(p + vec3(0,1,1)), hash(p + vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main() {
    vUv = uv;
    vDist = uv.y;  // 0 at base, 1 at tip

    // Radial displacement, tapered so tip stays pointy
    vec3 radDir = normalize(vec3(position.x, 0.0, position.z));
    float taper = 1.0 - vDist;
    float n = noise(position * 3.0 + vec3(uTime * 2.5, 0.0, 0.0));
    vec3 displaced = position + radDir * (n - 0.5) * 0.12 * taper;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vDist;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(p + vec3(0,0,0)), hash(p + vec3(1,0,0)), f.x),
                   mix(hash(p + vec3(0,1,0)), hash(p + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(p + vec3(0,0,1)), hash(p + vec3(1,0,1)), f.x),
                   mix(hash(p + vec3(0,1,1)), hash(p + vec3(1,1,1)), f.x), f.y), f.z);
  }

  void main() {
    // Radial distance from flame axis: vUv.x goes 0→1 around cylinder,
    // so center of flame is at vUv.x = 0.5
    float radial = abs(vUv.x - 0.5) * 2.0;  // 0 at center, 1 at edge

    // Color ramp: white-hot → amber → orange → red
    vec3 cWhite  = vec3(1.00, 0.96, 0.88);
    vec3 cAmber  = vec3(1.00, 0.78, 0.40);
    vec3 cOrange = vec3(0.95, 0.45, 0.12);
    vec3 cRed    = vec3(0.75, 0.18, 0.08);

    vec3 color = mix(cWhite, cAmber,  smoothstep(0.0, 0.35, radial));
    color      = mix(color,  cOrange, smoothstep(0.35, 0.65, radial));
    color      = mix(color,  cRed,    smoothstep(0.65, 1.0,  radial));

    // Soft turbulence — modulates BRIGHTNESS, not alpha
    float turb = noise(vec3(vUv * 4.0, uTime * 1.5)) * 0.25 + 0.85;
    color *= turb;

    // Alpha: fade at tip and at radial edge. No holes, no splotches.
    float tipFade  = 1.0 - smoothstep(0.6, 1.0, vDist);
    float edgeFade = 1.0 - smoothstep(0.7, 1.0, radial);
    float alpha = tipFade * edgeFade * 0.95;

    gl_FragColor = vec4(color, alpha);
  }
`;

export default function EnginePlume({ position = [0, 0, 0] }) {
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
    <mesh position={position} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.04, 0.35, 2.2, 32, 16, true]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

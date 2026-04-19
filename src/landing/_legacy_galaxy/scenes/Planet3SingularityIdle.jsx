// Planet 3 — The Singularity. IDLE representation only (shown on galaxy
// overview + while transitioning to this planet). Just the swirling event
// horizon disc + a subtle outer amber halo — no tunnel, no editor, no
// tags. The full wormhole plunge mounts on-click via a separate
// `Planet3SingularityTransit` component in Step 5.
//
// Shader is a trimmed copy of v2 Wormhole's EventHorizonDisc — spiralling
// accretion disc with hot white-amber core, orange mid, deep violet rim.

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Bumped 1.8 → 2.8 so the swirling amber disc reads clearly from the
// galaxy-overview distance (~35 units). Without this the disc was
// projecting to ~6% viewport width — too small to carry focal weight.
const DISC_RADIUS = 2.8;

const noiseHelpers = /* glsl */ `
  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm2(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.02; a *= 0.5; }
    return v;
  }
`;

const discVert = /* glsl */ `
  varying vec2 vLocalXY;
  void main() {
    vLocalXY = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const discFrag = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  varying vec2 vLocalXY;
  ${noiseHelpers}

  void main() {
    vec2 p = vLocalXY / uRadius;
    float r = length(p);
    if (r > 1.0) discard;

    float theta = atan(p.y, p.x);
    float swirlAdd = uTime * (0.6 + 1.4 / (r + 0.22));
    float a = theta + swirlAdd;

    vec2 sUV = vec2(cos(a), sin(a)) * r;
    float n1 = fbm2(sUV * 3.2 + vec2(uTime * 0.25, -uTime * 0.18));
    float n2 = fbm2(sUV * 8.0 + vec2(-uTime * 0.35, uTime * 0.28));
    float n  = n1 * 0.65 + n2 * 0.35;

    float t = clamp(r + (n - 0.5) * 0.30, 0.0, 1.0);

    vec3 cHot    = vec3(1.7, 1.35, 0.90);
    vec3 cAmber  = vec3(1.0, 0.72, 0.28);
    vec3 cOrange = vec3(0.95, 0.42, 0.10);
    vec3 cRed    = vec3(0.55, 0.14, 0.12);
    vec3 cViolet = vec3(0.40, 0.18, 0.58);

    vec3 col;
    if      (t < 0.20) col = mix(cHot,    cAmber,  t / 0.20);
    else if (t < 0.45) col = mix(cAmber,  cOrange, (t - 0.20) / 0.25);
    else if (t < 0.72) col = mix(cOrange, cRed,    (t - 0.45) / 0.27);
    else               col = mix(cRed,    cViolet, (t - 0.72) / 0.28);

    col *= 1.0 + (1.0 - r) * 1.3;
    col *= 0.82 + n * 0.40;

    float alpha = 1.0 - smoothstep(0.95, 1.0, r);
    gl_FragColor = vec4(col, alpha);
  }
`;

export default function Planet3SingularityIdle() {
  const ref = useRef();
  const uniforms = useMemo(() => ({
    uTime:   { value: 0 },
    uRadius: { value: DISC_RADIUS },
  }), []);
  useFrame(({ clock, camera }) => {
    uniforms.uTime.value = clock.elapsedTime;
    // Always face the camera — the disc is meant to read as a swirling
    // circle, not an edge-on ellipse when viewed from galaxy overview.
    if (ref.current) ref.current.quaternion.copy(camera.quaternion);
  });
  return (
    <group>
      <mesh ref={ref} renderOrder={1}>
        <circleGeometry args={[DISC_RADIUS, 96]} />
        <shaderMaterial
          vertexShader={discVert}
          fragmentShader={discFrag}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* Soft amber halo behind the disc for silhouette pop. */}
      <mesh position={[0, 0, -0.05]}>
        <circleGeometry args={[DISC_RADIUS * 1.45, 48]} />
        <meshBasicMaterial
          color="#ff8a40"
          transparent
          opacity={0.22}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

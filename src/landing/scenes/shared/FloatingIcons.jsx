// FloatingIcons — faint painterly icon silhouettes drifting through
// the nebula on /features. Low opacity, staggered, not focal. The
// painterly post (Moebius outline + Kuwahara) turns the silhouettes
// into ink-like shapes automatically.
//
// Four SDF shapes — sparkle, heart, eye, arrow — drawn in a single
// fragment shader, selected per-instance via the aIconId attribute.

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const VERT = /* glsl */ `
  attribute float aIconId;
  varying vec2  vUv;
  varying float vIconId;
  void main() {
    vUv = uv;
    vIconId = aIconId;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  varying vec2  vUv;
  varying float vIconId;
  uniform vec3  uColor;
  uniform float uOpacity;

  float sdSparkle(vec2 p) {
    // 4-point starburst: plus sign + 45° diagonals.
    float h  = step(abs(p.x), 0.08) * step(abs(p.y), 0.45);
    float v  = step(abs(p.y), 0.08) * step(abs(p.x), 0.45);
    vec2 r   = mat2(0.707, -0.707, 0.707, 0.707) * p;
    float h2 = step(abs(r.x), 0.05) * step(abs(r.y), 0.30);
    float v2 = step(abs(r.y), 0.05) * step(abs(r.x), 0.30);
    return max(max(h, v), max(h2, v2));
  }

  float sdHeart(vec2 p) {
    // Two lobes + V. Centered, height ~0.9.
    p.y = -p.y + 0.15;
    float x = abs(p.x);
    float lobe = step(length(vec2(x - 0.2, p.y - 0.2)), 0.22);
    float tri  = step(0.0, p.y + 0.1 - x) * step(x, 0.45) * step(-0.5, p.y);
    return max(lobe, tri);
  }

  float sdEye(vec2 p) {
    // Almond — two arcs meeting at endpoints.
    float outer = step(length(p / vec2(0.5, 0.22)), 1.0);
    float inner = step(length(p), 0.12);
    return max(outer * (1.0 - inner * 0.7), inner);
  }

  float sdArrow(vec2 p) {
    // Upward-right chart arrow + base bar.
    float bar   = step(-0.45, p.x) * step(p.x, 0.45) * step(abs(p.y + 0.38), 0.05);
    // Diagonal line from bottom-left to upper-right.
    float diag  = step(abs(p.y - p.x * 0.9), 0.06) * step(abs(p.x), 0.4);
    // Small arrowhead.
    float head  = step(length(p - vec2(0.35, 0.32)), 0.12) * step(-0.08, p.x - 0.3);
    return max(max(bar, diag), head);
  }

  void main() {
    vec2 p = vUv - 0.5;
    float mask = 0.0;
    int id = int(vIconId + 0.5);
    if      (id == 0) mask = sdSparkle(p);
    else if (id == 1) mask = sdHeart(p);
    else if (id == 2) mask = sdEye(p);
    else              mask = sdArrow(p);
    if (mask < 0.05) discard;
    gl_FragColor = vec4(uColor, uOpacity * mask);
  }
`;

const SPAWN_X_MIN = -8.5, SPAWN_X_MAX = -6.0;
const EXIT_X      = 8.5;
const Y_MIN       = -3.0, Y_MAX       = 3.2;

function randRange(min, max) { return min + Math.random() * (max - min); }

export default function FloatingIcons({ count = 8, color = '#f0e4b8', opacity = 0.22 }) {
  const groupRef = useRef();

  const icons = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x:       randRange(SPAWN_X_MIN - i * 2.5, EXIT_X),
    y:       randRange(Y_MIN + 0.4, Y_MAX - 0.4),
    z:       randRange(-1.5, 0.8),
    vx:      randRange(0.35, 0.6),
    wobAmp:  randRange(0.2, 0.4),
    wobFreq: randRange(0.35, 0.65),
    phase:   randRange(0, Math.PI * 2),
    size:    randRange(0.65, 1.1),
    rotSpin: randRange(-0.15, 0.15),
    iconId:  i % 4,
    yBase:   0,
  })), [count]);
  icons.forEach((ic) => { ic.yBase = ic.y; });

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uColor:   { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    },
    transparent: true,
    depthWrite: false,
  }), [color, opacity]);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const arr = new Float32Array(4); // 4 verts, one aIconId each — patched per mesh
    geo.setAttribute('aIconId', new THREE.BufferAttribute(arr, 1));
    return geo;
  }, []);

  // Each mesh needs its own geometry so aIconId can differ.
  const geometries = useMemo(() => icons.map((ic) => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const arr = new Float32Array([ic.iconId, ic.iconId, ic.iconId, ic.iconId]);
    geo.setAttribute('aIconId', new THREE.BufferAttribute(arr, 1));
    return geo;
  }), [icons]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const t = performance.now() / 1000;
    groupRef.current.children.forEach((mesh, i) => {
      const ic = icons[i];
      ic.x += ic.vx * delta;
      if (ic.x > EXIT_X) {
        ic.x = randRange(SPAWN_X_MIN, SPAWN_X_MAX);
        ic.yBase = randRange(Y_MIN + 0.4, Y_MAX - 0.4);
        ic.z = randRange(-1.5, 0.8);
      }
      const wobY = Math.sin(t * ic.wobFreq + ic.phase) * ic.wobAmp;
      mesh.position.set(ic.x, ic.yBase + wobY, ic.z);
      mesh.rotation.z = t * ic.rotSpin + ic.phase;
    });
  });

  return (
    <group ref={groupRef}>
      {icons.map((ic, i) => (
        <mesh key={i} geometry={geometries[i]} material={material} scale={ic.size} />
      ))}
    </group>
  );
}

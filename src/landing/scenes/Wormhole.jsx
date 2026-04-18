// Scene 3 — Wormhole / singularity.
// Step 1 scope: exterior view only.
//
// Structure (front-to-back):
//   EinsteinRim         — thin bright amber ring at the horizon (light bending)
//   EventHorizonDisc    — swirling amber core disc (NormalBlending, solid body)
//   InnerTorusHalo      — hot amber-to-violet ring just outside the rim
//   MidTorusHalo        — violet, fainter
//   OuterTorusHalo      — deep violet, faintest, outermost
//
// Uses a simple 2D value-noise (inline) rather than 3D simplex — fewer surface
// quirks across drivers, and the motion is all in UV rotation anyway.
//
// Camera rig: active scene index 1.95–3.95. Step 1 runs the exterior approach
// from distance 28 → 14 across sceneIdx 2.0 → 2.5 and holds.

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import * as THREE from 'three';

// ── Shared value-noise + fbm helpers (GLSL) ─────────────────────────────────

const noiseHelpers = /* glsl */ `
  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
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
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }
`;

// ── Wormhole world origin (inside Nebula sphere r=80) ───────────────────────

const WORMHOLE_POS = new THREE.Vector3(0, 0, -45);

// ── Event horizon disc ──────────────────────────────────────────────────────

const DISC_RADIUS = 5.0;

const discVert = /* glsl */ `
  varying vec2 vLocalXY;
  void main() {
    vLocalXY = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Spec: color-ramp deep violet at outer edge → warm amber mid → bright
// white-amber hot center. Alpha = 1.0 inside 0.95, smoothstep fade 0.95-1.0.
const discFrag = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  varying vec2 vLocalXY;
  ${noiseHelpers}

  void main() {
    vec2 p = vLocalXY / uRadius; // -1..1
    float r = length(p);
    if (r > 1.0) discard;

    // Polar coords + differential rotation (inner faster)
    float theta = atan(p.y, p.x);
    float swirlAdd = uTime * (0.6 + 1.4 / (r + 0.22));
    float a = theta + swirlAdd;

    // Swirled UV for noise sampling — creates spiral streaks
    vec2 sUV = vec2(cos(a), sin(a)) * r;

    float n1 = fbm2(sUV * 3.2 + vec2(uTime * 0.25, -uTime * 0.18));
    float n2 = fbm2(sUV * 8.0 + vec2(-uTime * 0.35, uTime * 0.28));
    float n  = n1 * 0.65 + n2 * 0.35; // 0..~1

    // Radial position warped by noise → streaky bands
    float t = clamp(r + (n - 0.5) * 0.30, 0.0, 1.0);

    // Temperature palette (HDR in the core)
    vec3 cHot    = vec3(1.7, 1.35, 0.90); // white-hot
    vec3 cAmber  = vec3(1.0, 0.72, 0.28); // warm amber
    vec3 cOrange = vec3(0.95, 0.42, 0.10);
    vec3 cRed    = vec3(0.55, 0.14, 0.12);
    vec3 cViolet = vec3(0.40, 0.18, 0.58);

    vec3 col;
    if      (t < 0.20) col = mix(cHot,    cAmber,  t / 0.20);
    else if (t < 0.45) col = mix(cAmber,  cOrange, (t - 0.20) / 0.25);
    else if (t < 0.72) col = mix(cOrange, cRed,    (t - 0.45) / 0.27);
    else               col = mix(cRed,    cViolet, (t - 0.72) / 0.28);

    // Brighten the hot core, modulate with turbulence
    col *= 1.0 + (1.0 - r) * 1.3;
    col *= 0.82 + n * 0.40;

    // Per spec: opaque inside 0.95, smoothstep fade to the edge.
    float alpha = 1.0 - smoothstep(0.95, 1.0, r);

    gl_FragColor = vec4(col, alpha);
  }
`;

function EventHorizonDisc() {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uRadius: { value: DISC_RADIUS },
  }), []);
  useFrame(({ clock }) => { uniforms.uTime.value = clock.elapsedTime; });

  return (
    <mesh renderOrder={1}>
      <circleGeometry args={[DISC_RADIUS, 128]} />
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
  );
}

// ── Einstein rim — thin bright amber at the horizon (light bending) ─────────

function EinsteinRim() {
  return (
    <mesh renderOrder={2}>
      <ringGeometry args={[DISC_RADIUS - 0.12, DISC_RADIUS + 0.28, 128, 1]} />
      <meshBasicMaterial
        color="#ffd890"
        transparent
        opacity={0.95}
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── Torus halo — reusable violet/amber ring ─────────────────────────────────

const haloVert = /* glsl */ `
  varying vec2 vLocalXY;
  void main() {
    vLocalXY = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const haloFrag = /* glsl */ `
  uniform float uTime;
  uniform float uInner;
  uniform float uOuter;
  uniform vec3  uColorInner;
  uniform vec3  uColorOuter;
  uniform float uAlphaScale;
  uniform float uSwirlRate;
  uniform float uSeed;
  varying vec2 vLocalXY;
  ${noiseHelpers}

  void main() {
    float r = length(vLocalXY);
    float rn = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);

    // Angular swirl for wispiness
    float theta = atan(vLocalXY.y, vLocalXY.x);
    float a = theta + uTime * uSwirlRate + uSeed;
    vec2 sUV = vec2(cos(a), sin(a)) * (0.3 + rn * 0.6);
    float n = fbm2(sUV * 2.5 + vec2(uSeed, uTime * 0.1));

    vec3 col = mix(uColorInner, uColorOuter, rn);
    col *= 0.7 + n * 0.6;

    // Bright at the inner edge, fade out toward the outer
    float rim  = 1.0 - smoothstep(0.0, 0.22, rn);
    float fade = 1.0 - smoothstep(0.35, 1.0, rn);
    float alpha = (rim * 0.85 + fade * 0.65) * (0.55 + n * 0.55) * uAlphaScale;

    gl_FragColor = vec4(col, alpha);
  }
`;

function TorusHalo({
  inner, outer, colorInner, colorOuter,
  alphaScale = 1.0, swirlRate = 0.15, seed = 0.0, renderOrder = 0,
}) {
  const majorR = (inner + outer) * 0.5;
  const tubeR  = (outer - inner) * 0.5;

  const uniforms = useMemo(() => ({
    uTime:        { value: 0 },
    uInner:       { value: inner },
    uOuter:       { value: outer },
    uColorInner:  { value: new THREE.Color(colorInner) },
    uColorOuter:  { value: new THREE.Color(colorOuter) },
    uAlphaScale:  { value: alphaScale },
    uSwirlRate:   { value: swirlRate },
    uSeed:        { value: seed },
  }), [inner, outer, colorInner, colorOuter, alphaScale, swirlRate, seed]);

  useFrame(({ clock }) => { uniforms.uTime.value = clock.elapsedTime; });

  return (
    <mesh renderOrder={renderOrder}>
      <torusGeometry args={[majorR, tubeR, 20, 96]} />
      <shaderMaterial
        vertexShader={haloVert}
        fragmentShader={haloFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── Three concentric violet halo rings ──────────────────────────────────────

function HaloStack() {
  return (
    <>
      {/* Inner — hot amber/orange ring just outside the rim */}
      <TorusHalo
        inner={5.2} outer={7.6}
        colorInner="#ff9c48" colorOuter="#7a2e6a"
        alphaScale={1.0} swirlRate={0.18} seed={0.3}
        renderOrder={0}
      />
      {/* Mid — violet */}
      <TorusHalo
        inner={7.7} outer={11.0}
        colorInner="#7a2e6a" colorOuter="#3a1560"
        alphaScale={0.75} swirlRate={0.12} seed={1.9}
        renderOrder={0}
      />
      {/* Outer — deep violet, very faint */}
      <TorusHalo
        inner={11.1} outer={15.5}
        colorInner="#3a1560" colorOuter="#140a2a"
        alphaScale={0.5} swirlRate={0.08} seed={3.4}
        renderOrder={0}
      />
    </>
  );
}

// ── Camera rig — active during scene index 1.95–3.95 ────────────────────────

function CameraRig({ groupRef }) {
  const scroll = useScroll();

  useFrame(({ camera, clock }) => {
    const sceneIdx = scroll.offset * 7;

    const active = sceneIdx >= 1.95 && sceneIdx <= 3.95;
    if (groupRef.current) groupRef.current.visible = active;
    if (!active) return;

    // Step 1: exterior approach only (scene index 2.0 → 2.5 → hold).
    const approach = THREE.MathUtils.clamp((sceneIdx - 2.0) / 0.5, 0, 1);
    const startDist = 28;
    const endDist = 14;
    const ease = 1 - Math.pow(1 - approach, 3);
    const dist = THREE.MathUtils.lerp(startDist, endDist, ease);

    const t = clock.elapsedTime;
    const driftX = Math.sin(t * 0.25) * 0.35;
    const driftY = 0.4 + Math.cos(t * 0.22) * 0.25;

    camera.position.set(
      WORMHOLE_POS.x + driftX,
      WORMHOLE_POS.y + driftY,
      WORMHOLE_POS.z + dist,
    );
    camera.lookAt(WORMHOLE_POS);
  });

  return null;
}

// ── Export ──────────────────────────────────────────────────────────────────

export default function Wormhole() {
  const groupRef = useRef();

  return (
    <>
      <CameraRig groupRef={groupRef} />
      <group ref={groupRef} position={WORMHOLE_POS} visible={false}>
        <HaloStack />
        <EventHorizonDisc />
        <EinsteinRim />
      </group>
    </>
  );
}

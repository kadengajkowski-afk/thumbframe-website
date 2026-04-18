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
import WormholeTags from './WormholeTags';

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

function EventHorizonDisc({ meshRef }) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uRadius: { value: DISC_RADIUS },
  }), []);
  useFrame(({ clock }) => { uniforms.uTime.value = clock.elapsedTime; });

  return (
    <mesh ref={meshRef} renderOrder={1}>
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

// ── Wormhole tunnel — interior of a cylinder with scrolling painterly noise ──
// BackSide render (only inner faces visible). Noise stretched along travel
// axis gives longitudinal brushstroke streaks; scrolling UV.y over time makes
// the walls feel like they're rushing past as the camera travels in.

const TUNNEL_RADIUS = 6.0;
const TUNNEL_LENGTH = 90.0;
// Local Z (relative to WORMHOLE_POS). Cylinder centered so its top (after
// X-rotation of π/2 maps +Y → +Z) sits at local z = +LENGTH/2 = +45, aligning
// with the event horizon plane (local z=0). With mesh.position.z = -LENGTH/2,
// top (event-horizon-adjacent) is at local z=0 and bottom at local z=-LENGTH.
const TUNNEL_Z_OFFSET = -TUNNEL_LENGTH / 2;

const tunnelVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const tunnelFrag = /* glsl */ `
  uniform float uTime;
  uniform float uScrollSpeed;
  varying vec2 vUv;
  ${noiseHelpers}

  void main() {
    vec2 uv = vUv;

    // Scroll along cylinder length — walls rush past the camera as it advances.
    uv.y += uTime * uScrollSpeed;

    // Noise channels. Still stretched (low freq along length, higher around
    // the circumference) for brushstroke streaks, but toned down vs. v1 —
    // the old angular frequency of 22 made the streaks read as a 2D sunburst.
    float broad = fbm2(vec2(uv.x *  3.2, uv.y * 0.7) + vec2(7.1, 2.3));
    float mid   = fbm2(vec2(uv.x *  7.0, uv.y * 1.5) + vec2(3.0, 1.2));
    float streak = fbm2(vec2(uv.x * 14.0, uv.y * 4.5));

    // Painterly muted palette — matches the warm-amber / deep-violet / teal-mist
    // brief, well away from the saturated "candy" tones of v1.
    vec3 cAmber     = vec3(0.78, 0.38, 0.12); // #c86020
    vec3 cAmberDeep = vec3(0.54, 0.25, 0.12); // #8a4020
    vec3 cTeal      = vec3(0.23, 0.40, 0.38); // #3a6660
    vec3 cViolet    = vec3(0.16, 0.10, 0.31); // #2a1850
    vec3 cVoid      = vec3(0.04, 0.03, 0.09);

    // Smoothly blend across the palette using noise channels — no hard bands.
    vec3 base = cViolet;
    base = mix(base, cTeal,      smoothstep(0.15, 0.55, mid * 0.75 + broad * 0.25));
    base = mix(base, cAmber,     smoothstep(0.45, 0.80, mid * 0.55 + streak * 0.45));
    base = mix(base, cAmberDeep, smoothstep(0.35, 0.70, broad) * 0.6);

    // Brushstroke brightness — stronger weighting on streak noise gives the
    // "painted swipe" feel, broader noise handles macro shading.
    float bright = pow(streak, 1.6) * 0.9 + broad * 0.3;
    vec3 col = mix(cVoid, base, bright * 0.85 + 0.15);
    col *= 0.75 + mid * 0.35;

    // Subtle darkening near the event-horizon end so depth reads correctly
    // as the camera flies deeper.
    float darkenNear = 1.0 - smoothstep(0.75, 1.05, fract(vUv.y));
    col *= 0.58 + 0.42 * darkenNear;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function WormholeTunnel() {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uScrollSpeed: { value: 0.32 },
  }), []);
  useFrame(({ clock }) => { uniforms.uTime.value = clock.elapsedTime; });

  // Cylinder's natural axis is +Y; rotate X by π/2 so +Y → +Z → tunnel lies
  // along the world Z axis (matching camera travel direction).
  return (
    <mesh
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 0, TUNNEL_Z_OFFSET]}
      renderOrder={-1}
    >
      <cylinderGeometry args={[TUNNEL_RADIUS, TUNNEL_RADIUS, TUNNEL_LENGTH, 48, 1, true]} />
      <shaderMaterial
        vertexShader={tunnelVert}
        fragmentShader={tunnelFrag}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
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

// ── Tunnel far-end backdrop ─────────────────────────────────────────────────
// Circle capping the open far end of the tunnel. Radial amber gradient that
// reads as "warm light behind the exit". Without this, the open cylinder end
// shows pure black (camera is outside the nebula sphere), which was the
// "black hole at the centre" you were seeing.

const backdropVert = /* glsl */ `
  varying vec2 vLocalXY;
  void main() {
    vLocalXY = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const backdropFrag = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uRadius;
  varying vec2 vLocalXY;
  ${noiseHelpers}

  void main() {
    float r = length(vLocalXY) / uRadius;
    if (r > 1.0) discard;

    // Radial gradient — warm amber core fading to deep violet tunnel color.
    vec3 cCore  = vec3(1.15, 0.78, 0.40); // warm amber glow
    vec3 cMid   = vec3(0.42, 0.18, 0.22); // dim amber/violet blend
    vec3 cEdge  = vec3(0.08, 0.05, 0.14); // deep violet / tunnel void

    vec3 col;
    if (r < 0.35) col = mix(cCore, cMid, r / 0.35);
    else          col = mix(cMid, cEdge, (r - 0.35) / 0.65);

    // Painterly brush flecks
    float n = fbm2(vLocalXY * 1.2 + vec2(uTime * 0.06, 0.0));
    col *= 0.78 + n * 0.45;

    // Soft falloff at the circle edge
    float alpha = 1.0 - smoothstep(0.88, 1.0, r);
    // Intensity ramps with scroll so the backdrop brightens as the camera closes.
    col *= 0.55 + 0.6 * uIntensity;

    gl_FragColor = vec4(col, alpha);
  }
`;

const TUNNEL_FAR_END_LOCAL_Z = -88.5;
const TUNNEL_FAR_END_RADIUS = 6.0;

function TunnelFarEndBackdrop({ intensityRef }) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIntensity: { value: 0 },
    uRadius: { value: TUNNEL_FAR_END_RADIUS },
  }), []);
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    if (intensityRef.current !== undefined) {
      uniforms.uIntensity.value = intensityRef.current;
    }
  });
  return (
    <mesh position={[0, 0, TUNNEL_FAR_END_LOCAL_Z]} renderOrder={-2}>
      <circleGeometry args={[TUNNEL_FAR_END_RADIUS, 64]} />
      <shaderMaterial
        vertexShader={backdropVert}
        fragmentShader={backdropFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

// ── Editor plane ────────────────────────────────────────────────────────────
// 16:9 curved plane at the tunnel far end. Emissive amber glow that reads as
// "the editor emerging from inside the wormhole". Size/shader designed so the
// plane fills ~60% of the viewport when the camera reaches sceneIdx 3.8.
//
// Step 5 will swap this shader for a drei <Html transform occlude> mapping the
// actual ThumbFrame editor UI onto the plane.

const EDITOR_LOCAL_Z = -85.0;
const EDITOR_WIDTH   = 6.0;
const EDITOR_HEIGHT  = 3.4;

const editorPlaneVert = /* glsl */ `
  uniform float uBend;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Gentle concave dome — edges pushed toward +Z so the plane cups slightly
    // toward the camera (which sits on +Z side of the editor). 0.25 max offset.
    vec2 n = uv * 2.0 - 1.0;
    vec3 bent = position;
    bent.z += uBend * (1.0 - n.x * n.x) * (1.0 - n.y * n.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(bent, 1.0);
  }
`;

const editorPlaneFrag = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  ${noiseHelpers}

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);

    // Gradient: white-hot near the centre, warm amber toward the edge.
    vec3 cCore  = vec3(1.85, 1.55, 1.10); // HDR white-amber core
    vec3 cWarm  = vec3(1.25, 0.78, 0.32); // amber body
    vec3 cEdge  = vec3(0.95, 0.50, 0.18); // warm amber edge
    vec3 col;
    if (r < 0.35) col = mix(cCore, cWarm, r / 0.35);
    else          col = mix(cWarm, cEdge, clamp((r - 0.35) / 0.8, 0.0, 1.0));

    // Painterly brush noise for texture — low-freq so Kuwahara doesn't wipe it.
    float n = fbm2(vUv * 5.5 + vec2(uTime * 0.08, 0.0));
    col *= 0.85 + n * 0.30;

    // Soft rectangular edge falloff — plane feels like light through an aperture.
    float fx = 1.0 - smoothstep(0.85, 1.0, abs(p.x));
    float fy = 1.0 - smoothstep(0.80, 1.0, abs(p.y));
    float edge = fx * fy;

    // Slight horizontal "scan" highlight — hints at a UI surface animating.
    float scan = 0.88 + 0.12 * sin(vUv.y * 42.0 + uTime * 1.4);
    col *= scan;

    // Alpha/intensity ramp — editor ignites across sceneIdx 2.8 → 3.8.
    float alpha = edge * clamp(uIntensity * 1.6, 0.0, 1.0);
    col *= 0.6 + 1.2 * uIntensity;

    gl_FragColor = vec4(col, alpha);
  }
`;

function EditorPlane({ intensityRef }) {
  const uniforms = useMemo(() => ({
    uTime:      { value: 0 },
    uIntensity: { value: 0 },
    uBend:      { value: 0.35 },
  }), []);
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    if (intensityRef.current !== undefined) {
      uniforms.uIntensity.value = intensityRef.current;
    }
  });

  return (
    <mesh position={[0, 0, EDITOR_LOCAL_Z]} renderOrder={3}>
      <planeGeometry args={[EDITOR_WIDTH, EDITOR_HEIGHT, 32, 18]} />
      <shaderMaterial
        vertexShader={editorPlaneVert}
        fragmentShader={editorPlaneFrag}
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

// ── Camera rig — active during scene index 1.95–3.95 ────────────────────────
//
// Phases:
//   [ 2.0, 2.5 ]  Step 1 — exterior approach (dist 28 → 14)
//   [ 2.5, 3.1 ]  Step 2 — tilt + fall-in, then travel through the tunnel
//                   2.5 → 2.7: camera crosses event horizon (z -31 → z -50)
//                   2.7 → 3.1: travel from z -50 → z -100
//   [ 3.1, 3.95]  Held at tunnel-mid; remaining steps not built yet.

function CameraRig({ groupRef, discRef, editorIntensityRef }) {
  const scroll = useScroll();

  useFrame(({ camera, clock }) => {
    const sceneIdx = scroll.offset * 7;

    // Visibility: render from scene index 0.85 onward so the user sees the
    // wormhole while Arrival is still arcing past the ship. Avoid per-frame
    // .visible assignment when it isn't changing.
    const shouldBeVisible = sceneIdx >= 0.85 && sceneIdx <= 3.95;
    if (groupRef.current && groupRef.current.visible !== shouldBeVisible) {
      groupRef.current.visible = shouldBeVisible;
    }

    // Editor silhouette intensity — brightens 2.8 → 3.8 (squared ease).
    if (editorIntensityRef) {
      const raw = THREE.MathUtils.clamp((sceneIdx - 2.8) / 1.0, 0, 1);
      editorIntensityRef.current = raw * raw;
    }

    // Plunge transition — disc scales 1 → 2.8 across sceneIdx 2.4 → 2.67 so
    // it fills the viewport right before the camera crosses the event horizon.
    // This hides the "empty nebula frame" that was visible between Step 1 and
    // Step 2 by making the disc dominate the view at the moment of entry.
    if (discRef.current) {
      let scale = 1.0;
      if (sceneIdx >= 2.4 && sceneIdx < 2.67) {
        const p = (sceneIdx - 2.4) / 0.27;
        scale = THREE.MathUtils.lerp(1.0, 2.8, p);
      } else if (sceneIdx >= 2.67) {
        scale = 2.8; // hold — camera is past, so this only matters visually
                     // during the short moment before frustum culls the disc.
      }
      if (discRef.current.scale.x !== scale) {
        discRef.current.scale.setScalar(scale);
      }
    }

    const active = sceneIdx >= 1.95 && sceneIdx <= 3.95;
    if (!active) return;

    const t = clock.elapsedTime;

    let camX, camY, camZ;
    let lookX = WORMHOLE_POS.x;
    let lookY = WORMHOLE_POS.y;
    let lookZ = WORMHOLE_POS.z;

    if (sceneIdx < 2.5) {
      // Step 1: exterior approach.
      const approach = THREE.MathUtils.clamp((sceneIdx - 2.0) / 0.5, 0, 1);
      const ease = 1 - Math.pow(1 - approach, 3);
      const dist = THREE.MathUtils.lerp(28, 14, ease);

      camX = WORMHOLE_POS.x + Math.sin(t * 0.25) * 0.35;
      camY = WORMHOLE_POS.y + 0.4 + Math.cos(t * 0.22) * 0.25;
      camZ = WORMHOLE_POS.z + dist;
    } else if (sceneIdx < 3.1) {
      // Step 2: fall-in + tunnel travel.
      const travel = (sceneIdx - 2.5) / 0.6; // 0..1 across step 2
      const ease = travel * travel * (3.0 - 2.0 * travel);

      // +14 (Step 1 end) → -55 (deep inside the tunnel).
      const offsetZ = THREE.MathUtils.lerp(14, -55, ease);
      camZ = WORMHOLE_POS.z + offsetZ;

      // Lateral drift shrinks as we dive in — camera locks to the axis.
      const axisLockin = 1.0 - ease;
      camX = WORMHOLE_POS.x + Math.sin(t * 0.25) * 0.3 * axisLockin;
      camY = WORMHOLE_POS.y + (0.4 + Math.cos(t * 0.22) * 0.22) * axisLockin;

      const lookOffsetZ = THREE.MathUtils.lerp(0, -TUNNEL_LENGTH * 0.9, ease);
      lookZ = WORMHOLE_POS.z + lookOffsetZ;
    } else if (sceneIdx < 3.8) {
      // Step 4 — final approach to the editor plane.
      // Editor plane sits at local z = EDITOR_LOCAL_Z (-85). We want the plane
      // (6 × 3.4) to fill ~60% of the viewport at sceneIdx 3.8, which at
      // fov=50° / aspect=1.78 puts the camera ~6 units in front of it
      //   → world z = EDITOR world z + 6 = -130 + 6 = -124
      //   → offsetZ = -124 - WORMHOLE_POS.z = -79.
      const travel = (sceneIdx - 3.1) / 0.7;
      const ease = travel * travel * (3.0 - 2.0 * travel);
      const offsetZ = THREE.MathUtils.lerp(-55, -79, ease);

      camX = WORMHOLE_POS.x;
      camY = WORMHOLE_POS.y;
      camZ = WORMHOLE_POS.z + offsetZ;

      // Look target sits AT the editor plane centre so the camera faces it
      // square-on. Interpolate from tunnel-look to editor-look.
      const lookZStart = WORMHOLE_POS.z - TUNNEL_LENGTH * 0.9; // -126
      const lookZEnd   = WORMHOLE_POS.z + EDITOR_LOCAL_Z;      // -130
      lookZ = THREE.MathUtils.lerp(lookZStart, lookZEnd, ease);
    } else {
      // Hold — editor fills the frame, waiting for the Step-5/6 exit.
      camX = WORMHOLE_POS.x;
      camY = WORMHOLE_POS.y;
      camZ = WORMHOLE_POS.z - 79;
      lookZ = WORMHOLE_POS.z + EDITOR_LOCAL_Z;
    }

    camera.position.set(camX, camY, camZ);
    camera.lookAt(lookX, lookY, lookZ);
  });

  return null;
}

// ── Export ──────────────────────────────────────────────────────────────────

export default function Wormhole() {
  const groupRef = useRef();
  const discRef = useRef();
  const editorIntensityRef = useRef(0);

  return (
    <>
      <CameraRig
        groupRef={groupRef}
        discRef={discRef}
        editorIntensityRef={editorIntensityRef}
      />
      <group ref={groupRef} position={WORMHOLE_POS} visible={false}>
        {/* Tunnel is behind the event horizon (renderOrder -1) so the disc
            still covers it during Step 1's exterior approach. */}
        <WormholeTunnel />
        <HaloStack />
        <EventHorizonDisc meshRef={discRef} />
        <EinsteinRim />
        {/* Tunnel far-end: warm amber backdrop circle + bright curved editor
            plane in front of it. Backdrop kills the "black hole" read; the
            editor plane is the destination the camera flies toward. */}
        <TunnelFarEndBackdrop intensityRef={editorIntensityRef} />
        <EditorPlane intensityRef={editorIntensityRef} />
        <WormholeTags />
      </group>
    </>
  );
}

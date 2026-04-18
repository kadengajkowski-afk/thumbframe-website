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

    // Darken the tunnel wall as we approach the editor end so the bright
    // rectangular plane has a high-contrast dark frame to sit against.
    // Strong falloff on the far 35% of the wall (uv.y in [0.65, 1.0]).
    float darkenNear = 1.0 - smoothstep(0.75, 1.05, fract(vUv.y));
    float darkenFar  = smoothstep(0.65, 1.00, fract(vUv.y));
    col *= (0.58 + 0.42 * darkenNear) * (1.0 - darkenFar * 0.55);

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

    // Warm amber fill only — drop the violet outer ring so the backdrop reads
    // as light behind the editor, not a moon. The rectangular backlight in
    // front handles the frame-glow.
    vec3 cCore = vec3(0.80, 0.45, 0.18); // warm amber
    vec3 cEdge = vec3(0.28, 0.12, 0.08); // dim warm

    vec3 col = mix(cCore, cEdge, smoothstep(0.0, 1.0, r));

    float n = fbm2(vLocalXY * 1.1 + vec2(uTime * 0.06, 0.0));
    col *= 0.85 + n * 0.3;

    float alpha = (1.0 - smoothstep(0.80, 1.0, r)) * (0.4 + 0.6 * uIntensity);

    gl_FragColor = vec4(col, alpha);
  }
`;

const TUNNEL_FAR_END_LOCAL_Z = -88.5;
// Radius matches the plane height so the backdrop reads as a soft amber
// aura tucked behind the editor rectangle, not a full-viewport circle
// that drowns the plane once Kuwahara blurs it.
const TUNNEL_FAR_END_RADIUS = 3.2;

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
// 16:9 plane, sized so it fills ~60% of viewport width at sceneIdx 3.8 and
// ~40% at 3.6 with fov=50° camera. Camera path (below) tightened to match.
const EDITOR_WIDTH   = 6.0;
const EDITOR_HEIGHT  = 3.375;

// Flat plane — no dome bend. A curved plane viewed head-on reads like a disc
// once the painterly blur softens the silhouette; we want unambiguous 16:9.
const editorPlaneVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const editorPlaneFrag = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  ${noiseHelpers}

  // Thick smoothstep helper for UI strokes (stays readable after Kuwahara).
  float sstep(float lo, float hi, float x) { return smoothstep(lo, hi, x); }
  // Binary box: 1.0 inside [a,b], 0.0 outside. Used for UI slabs that need to
  // survive the painterly blur — soft edges get eaten by the 0.2x-res Kuwahara.
  float box(float v, float a, float b) { return step(a, v) - step(b, v); }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0; // -1..1

    // HARD rectangular silhouette — binary step, no antialias band.
    // The painterly post-process already smooths edges; an in-shader AA band
    // compounds with Kuwahara and turns the corners into a rounded blob.
    float rectMask = step(abs(p.x), 1.0) * step(abs(p.y), 1.0);
    if (rectMask < 0.5) discard;

    // Palette — warm paper-highlight base with bold amber UI elements.
    // HDR values cranked high so the plane stays visibly brighter than the
    // surrounding tunnel even after Kuwahara 0.2x-res smoothing washes it out.
    vec3 paper  = vec3(1.90, 1.55, 1.15); // warm paper-highlight
    vec3 amber  = vec3(1.80, 0.95, 0.32); // warm amber UI lines / bars
    vec3 amberD = vec3(0.78, 0.38, 0.14); // darker amber (canvas body)
    vec3 border = vec3(2.60, 1.65, 0.82); // bright rect frame

    vec3 col = paper;

    // ─── Top toolbar strip (uv.y 0.86 – 0.97) — wider and solid ──────────
    float topBand = box(vUv.y, 0.86, 0.97);
    col = mix(col, amber * 0.90, topBand * 0.70);
    // Toolbar icon-button pattern — 8 big slots so each survives the blur.
    float slotX = fract(vUv.x * 8.0);
    float iconHit = box(slotX, 0.22, 0.78);
    col = mix(col, amber * 1.25, topBand * iconHit * 0.80);

    // ─── Bottom status bar (uv.y 0.03 – 0.10) — solid amber band ─────────
    float botBand = box(vUv.y, 0.03, 0.10);
    col = mix(col, amber * 0.75, botBand * 0.75);

    // ─── Left tool strip (uv.x 0.03 – 0.14) ──────────────────────────────
    float leftStrip = box(vUv.x, 0.03, 0.14) * box(vUv.y, 0.12, 0.84);
    col = mix(col, amberD * 1.6, leftStrip * 0.65);
    // 6 fat tool buttons — bigger than before so Kuwahara preserves them.
    float rowY = fract((vUv.y - 0.12) / ((0.84 - 0.12) / 6.0));
    float rowHit = box(rowY, 0.20, 0.80);
    col = mix(col, amber * 1.20, leftStrip * rowHit * 0.80);

    // ─── Right properties panel (uv.x 0.75 – 0.97) ───────────────────────
    float rightPanel = box(vUv.x, 0.75, 0.97) * box(vUv.y, 0.12, 0.84);
    col = mix(col, amberD * 1.4, rightPanel * 0.55);
    // 4 panel sections with fat dividers.
    float divRow = fract(vUv.y * 5.0);
    float divider = box(divRow, 0.42, 0.58);
    col = mix(col, amber * 1.05, rightPanel * divider * 0.85);
    // Amber "value bars" — two fat horizontal bars per section.
    float bar1 = box(divRow, 0.06, 0.18);
    float bar2 = box(divRow, 0.72, 0.88);
    float barX = box(vUv.x, 0.77, 0.90);
    col = mix(col, amber * 1.15, rightPanel * (bar1 + bar2) * barX * 0.75);

    // ─── Canvas area (uv.x 0.15 – 0.73, uv.y 0.14 – 0.84) — darker well ──
    float canvas = box(vUv.x, 0.15, 0.73) * box(vUv.y, 0.14, 0.84);
    col = mix(col, amberD * 0.85, canvas * 0.75);
    // 16:9 thumbnail inside the canvas, solid amber glow.
    float thumb = box(vUv.x, 0.22, 0.66) * box(vUv.y, 0.28, 0.72);
    col = mix(col, amber * 1.05, thumb * 0.75);
    // Bright saliency marker — upper-right of thumbnail.
    float saliency = box(vUv.x, 0.56, 0.64) * box(vUv.y, 0.62, 0.70);
    col = mix(col, amber * 1.60, saliency * 0.85);

    // ─── FAT bright rectangular frame at 93 – 99% — defines the silhouette
    // Two-band frame so Kuwahara leaves behind a recognizable border even
    // after smoothing. Thickness scales with plane size in viewport.
    float edgeDist = max(abs(p.x), abs(p.y));
    float outerFrame = step(0.94, edgeDist);
    col = mix(col, border, outerFrame * 0.95);

    // ─── Painterly brush variation over the whole surface ────────────────
    float n = fbm2(vUv * 5.0 + vec2(uTime * 0.08, 0.0));
    col *= 0.92 + n * 0.14;

    // Intensity ramp — editor ignites across sceneIdx 2.8 → 3.8.
    // Floor at 0.65 so the plane is already clearly visible the moment it
    // registers, then scales up to 1x brightness at climax.
    col *= 0.65 + 1.05 * uIntensity;
    float alpha = rectMask * clamp(uIntensity * 2.2 + 0.15, 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
  }
`;

function EditorPlane({ intensityRef }) {
  const uniforms = useMemo(() => ({
    uTime:      { value: 0 },
    uIntensity: { value: 0 },
  }), []);
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    if (intensityRef.current !== undefined) {
      uniforms.uIntensity.value = intensityRef.current;
    }
  });

  return (
    <mesh position={[0, 0, EDITOR_LOCAL_Z]} renderOrder={3}>
      <planeGeometry args={[EDITOR_WIDTH, EDITOR_HEIGHT, 1, 1]} />
      <shaderMaterial
        vertexShader={editorPlaneVert}
        fragmentShader={editorPlaneFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
}

// ── Editor backlight ────────────────────────────────────────────────────────
// Rectangular halo BEHIND the editor plane. Additive, slightly larger than the
// editor, so warm amber light appears to escape around the rectangle's edges —
// instead of the circular radial glow that made v1 read as a soft moon.

// Backlight plane is sized so the halo band extends ONLY ~20% beyond the
// editor edge on each side. Wider halos bleed into a circular radial glow
// once the painterly blur kicks in — the goal is clearly rectangular
// "light escaping around the frame", not a lens-flare aura.
const BACKLIGHT_WIDTH   = 7.2;   // EDITOR_WIDTH * 1.20
const BACKLIGHT_HEIGHT  = 4.05;  // EDITOR_HEIGHT * 1.20
const BACKLIGHT_LOCAL_Z = -86.0;

const backlightFrag = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0; // -1..1 over backlight extent

    // Editor edge in backlight-UV space: EW/BW = 6.0/7.2 = 0.833, EH/BH same.
    float editorEdgeX = 0.833;
    float editorEdgeY = 0.833;

    // Chebyshev rectangular distance past the editor edge, normalized to
    // [0, 1] where 0 = right at the plane edge, 1 = outer backlight rim.
    float dx = (abs(p.x) - editorEdgeX) / (1.0 - editorEdgeX);
    float dy = (abs(p.y) - editorEdgeY) / (1.0 - editorEdgeY);
    float d  = max(dx, dy);

    // Halo only in the annulus outside the editor: 0 inside plane, bright
    // right at the edge, fading to 0 at the backlight rim. Sharp falloff so
    // the halo reads as a frame-glow, not a radial moon.
    float halo = 1.0 - clamp(d, 0.0, 1.0);
    halo *= step(0.0, d);
    halo = pow(halo, 1.8);

    // A tiny glow boost right at the inner edge of the halo (d ~ 0..0.15)
    // to accentuate light spilling from behind the rectangle.
    float lip = (1.0 - smoothstep(0.0, 0.25, d)) * step(0.0, d);

    vec3 col = vec3(2.20, 1.10, 0.38); // warm amber backlight (HDR)
    float alpha = (halo * 1.00 + lip * 0.70) * uIntensity;
    col *= 0.8 + 1.4 * uIntensity;

    gl_FragColor = vec4(col, alpha);
  }
`;

const backlightVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function EditorBacklight({ intensityRef }) {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIntensity: { value: 0 },
  }), []);
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    if (intensityRef.current !== undefined) {
      uniforms.uIntensity.value = intensityRef.current;
    }
  });

  return (
    <mesh position={[0, 0, BACKLIGHT_LOCAL_Z]} renderOrder={2}>
      <planeGeometry args={[BACKLIGHT_WIDTH, BACKLIGHT_HEIGHT]} />
      <shaderMaterial
        vertexShader={backlightVert}
        fragmentShader={backlightFrag}
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
    // After sceneIdx >= 2.75 the camera is fully past the disc, so force it
    // hidden — frustum culling alone was leaking the scaled bounding sphere
    // into the tunnel/editor shots as a purple halo.
    if (discRef.current) {
      const hideAfter = 2.75;
      if (sceneIdx >= hideAfter) {
        if (discRef.current.visible) discRef.current.visible = false;
      } else {
        if (!discRef.current.visible) discRef.current.visible = true;
        let scale = 1.0;
        if (sceneIdx >= 2.4 && sceneIdx < 2.67) {
          const p = (sceneIdx - 2.4) / 0.27;
          scale = THREE.MathUtils.lerp(1.0, 2.8, p);
        } else if (sceneIdx >= 2.67) {
          scale = 2.8;
        }
        if (discRef.current.scale.x !== scale) {
          discRef.current.scale.setScalar(scale);
        }
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

      // +14 (Step 1 end) → -62 (deep inside the tunnel, matching step-4 start).
      const offsetZ = THREE.MathUtils.lerp(14, -62, ease);
      camZ = WORMHOLE_POS.z + offsetZ;

      // Lateral drift shrinks as we dive in — camera locks to the axis.
      const axisLockin = 1.0 - ease;
      camX = WORMHOLE_POS.x + Math.sin(t * 0.25) * 0.3 * axisLockin;
      camY = WORMHOLE_POS.y + (0.4 + Math.cos(t * 0.22) * 0.22) * axisLockin;

      const lookOffsetZ = THREE.MathUtils.lerp(0, -TUNNEL_LENGTH * 0.9, ease);
      lookZ = WORMHOLE_POS.z + lookOffsetZ;
    } else if (sceneIdx < 3.8) {
      // Step 4 — final approach to the editor plane.
      // Plane sits at local z = EDITOR_LOCAL_Z (-85); 6 × 3.375 (16:9).
      // Targets (fov=50°, aspect=1.78):
      //   sceneIdx 3.6 → ~40% viewport width → d ≈ 9.05
      //   sceneIdx 3.8 → ~60% viewport width → d ≈ 6.03
      // offsetZ start = -62 (d=23 at sceneIdx 3.1, smoothstep ease),
      //           end = -79 (d=6). Solves sceneIdx 3.6 to d ≈ 9.4.
      const travel = (sceneIdx - 3.1) / 0.7;
      const ease = travel * travel * (3.0 - 2.0 * travel);
      const offsetZ = THREE.MathUtils.lerp(-62, -79, ease);

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
        {/* Tunnel far-end stack, back to front:
              backdrop  — dim circle, kills the "black hole at centre" read
              backlight — rectangular amber halo that leaks around the plane
              plane     — sharp rectangular editor UI surface (NormalBlending) */}
        <TunnelFarEndBackdrop intensityRef={editorIntensityRef} />
        <EditorBacklight intensityRef={editorIntensityRef} />
        <EditorPlane intensityRef={editorIntensityRef} />
        <WormholeTags />
      </group>
    </>
  );
}

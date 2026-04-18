// Scene 3 — Wormhole / singularity.
// Step 1 scope: exterior view only.
//   - Event horizon disc: swirling noise-distorted UV shader,
//     amber hot core → orange → deep red → violet → void.
//   - Outer halo ring: violet gradient with slow swirl (suggests accretion +
//     gravitational lensing at the edge).
//   - Thin Einstein-ring rim at the inner edge of the halo (light bending).
//   - CameraRig pulls the camera to an exterior approach during scene 3
//     local progress 0.0–0.3 (global scroll offsets ~2.0/7 → 2.5/7).
//
// Later steps add: tunnel interior, feature tags, editor reveal, satellites, exit.

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import * as THREE from 'three';

// ── Shared simplex noise ────────────────────────────────────────────────────

const simplexNoise = /* glsl */ `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g,l.zxy);
    vec3 i2=max(g,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
`;

// ── Wormhole world origin ───────────────────────────────────────────────────
// Must live INSIDE the Nebula sphere (radius 80 at origin, BackSide) — camera
// positions that end up outside the sphere see pure black because BackSide
// faces are culled from that side. z = -45 keeps us well inside.

const WORMHOLE_POS = new THREE.Vector3(0, 0, -45);

// ── Event horizon disc — swirling accretion-disc-like shader ────────────────

const DISC_RADIUS = 5.0;

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
  ${simplexNoise}

  void main() {
    float r = length(vLocalXY) / uRadius; // 0 center → 1 edge
    if (r > 1.0) discard;

    float theta = atan(vLocalXY.y, vLocalXY.x);

    // Differential rotation — inner spins much faster (Keplerian feel).
    float swirlSpeed = 0.7 / (r * 1.8 + 0.22);
    float a = theta + uTime * swirlSpeed;

    // Sample noise in swirled coords → spiral streaks
    vec2 sUV = vec2(cos(a), sin(a)) * r;
    float n1 = snoise(vec3(sUV * 3.2, uTime * 0.22)) * 0.5 + 0.5;
    float n2 = snoise(vec3(sUV * 9.5 + vec3(1.7, 3.3, 0.0), uTime * 0.45)) * 0.5 + 0.5;
    float noise = n1 * 0.68 + n2 * 0.32;

    // Radial ramp perturbed by noise → streakiness
    float ramp = clamp(r + (noise - 0.5) * 0.22, 0.0, 1.0);

    // Temperature palette: core → violet → void
    vec3 cHot    = vec3(1.5, 1.15, 0.75); // white-hot core (HDR)
    vec3 cAmber  = vec3(1.0, 0.70, 0.28); // #ffb347-ish
    vec3 cOrange = vec3(0.96, 0.42, 0.09); // #f56e16
    vec3 cRed    = vec3(0.62, 0.13, 0.13); // #a02020
    vec3 cViolet = vec3(0.42, 0.16, 0.55); // deep violet
    vec3 cVoid   = vec3(0.05, 0.03, 0.12);

    vec3 col;
    if (ramp < 0.14)       col = mix(cHot,    cAmber,  ramp / 0.14);
    else if (ramp < 0.36)  col = mix(cAmber,  cOrange, (ramp - 0.14) / 0.22);
    else if (ramp < 0.58)  col = mix(cOrange, cRed,    (ramp - 0.36) / 0.22);
    else if (ramp < 0.82)  col = mix(cRed,    cViolet, (ramp - 0.58) / 0.24);
    else                   col = mix(cViolet, cVoid,   (ramp - 0.82) / 0.18);

    // Hot core amplification
    col *= 1.0 + (1.0 - r) * 1.4;

    // Turbulence brightness modulation
    col *= 0.78 + noise * 0.45;

    // Soft outer silhouette; nearly opaque in the body.
    // NOTE: GLSL smoothstep is undefined when edge0 >= edge1, so invert rather
    // than swap the args — earlier version silently broke alpha on some drivers.
    float alpha = 1.0 - smoothstep(0.45, 1.0, r);

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

// ── Outer halo — torus with violet accretion + gravitational lensing glow ──
// Spec calls for a torus (3D ring with depth) — gives the lensed edge some
// volume rather than a paper-flat annulus.

const HALO_INNER = 5.1;
const HALO_OUTER = 9.2;
const TORUS_RADIUS = (HALO_INNER + HALO_OUTER) * 0.5;
const TORUS_TUBE = (HALO_OUTER - HALO_INNER) * 0.5;

const haloFrag = /* glsl */ `
  uniform float uTime;
  uniform float uInner;
  uniform float uOuter;
  varying vec2 vLocalXY;
  ${simplexNoise}

  void main() {
    float r = length(vLocalXY);
    float rn = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);

    float theta = atan(vLocalXY.y, vLocalXY.x);
    float swirl = theta + uTime * 0.12;
    vec2 sUV = vec2(cos(swirl), sin(swirl)) * (r * 0.12);

    float n1 = snoise(vec3(sUV * 1.4, uTime * 0.15)) * 0.5 + 0.5;
    float n2 = snoise(vec3(sUV * 4.0 + vec3(5.0, 2.0, 0.0), uTime * 0.3)) * 0.5 + 0.5;
    float n = n1 * 0.6 + n2 * 0.4;

    // Inner edge glows orange (hot rim), fades to violet, fades to transparent
    vec3 cRim    = vec3(1.05, 0.55, 0.18);
    vec3 cMid    = vec3(0.65, 0.22, 0.55);
    vec3 cOuter  = vec3(0.22, 0.08, 0.32);

    vec3 col;
    if (rn < 0.25) col = mix(cRim, cMid, rn / 0.25);
    else           col = mix(cMid, cOuter, (rn - 0.25) / 0.75);
    col *= 0.75 + n * 0.5;

    // Alpha: bright rim, fades out; modulated by swirl noise for wispiness
    float rim = 1.0 - smoothstep(0.0, 0.15, rn);
    float fade = 1.0 - smoothstep(0.5, 1.0, rn);
    float alpha = (rim * 0.7 + fade * 0.55) * (0.55 + n * 0.45);

    gl_FragColor = vec4(col, alpha);
  }
`;

const haloVert = discVert; // reuse — local-xy varying is all we need

function OuterHalo() {
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uInner: { value: HALO_INNER },
    uOuter: { value: HALO_OUTER },
  }), []);
  useFrame(({ clock }) => { uniforms.uTime.value = clock.elapsedTime; });

  // Torus: face-on (axis = +Z), the tube bulges toward/away from camera.
  // vLocalXY = position.xy gives distance from the axis in the plane,
  // which ranges from (majorR - tube) = HALO_INNER to (majorR + tube) = HALO_OUTER.
  return (
    <mesh renderOrder={0}>
      <torusGeometry args={[TORUS_RADIUS, TORUS_TUBE, 24, 96]} />
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

// ── Einstein-ring rim — thin bright edge at the horizon (light bending) ─────

function EinsteinRim() {
  // Thick enough (~0.35) to survive the half-resolution Kuwahara pass.
  return (
    <mesh renderOrder={2}>
      <ringGeometry args={[DISC_RADIUS - 0.18, DISC_RADIUS + 0.22, 128, 1]} />
      <meshBasicMaterial
        color="#ffd890"
        transparent
        opacity={0.9}
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ── Camera rig — active during scene 3 (scroll scene index ≥ ~1.95) ─────────

function CameraRig({ groupRef }) {
  const scroll = useScroll();

  useFrame(({ camera, clock }) => {
    const sceneIdx = scroll.offset * 7; // global page index (drei pages=7)

    const active = sceneIdx >= 1.95 && sceneIdx <= 3.95;
    if (groupRef.current) groupRef.current.visible = active;
    if (!active) return;

    // Step 1: exterior approach only (scene index 2.2 → 2.5 → hold).
    // Map sceneIdx 2.0..2.5 → approach 0..1; hold at 1 past 2.5 until later steps land.
    const approach = THREE.MathUtils.clamp((sceneIdx - 2.0) / 0.5, 0, 1);

    // Distances tuned so the wormhole stays inside the nebula (r=80) AND
    // reads at a meaningful size in the viewport.
    const startDist = 28;
    const endDist = 14;
    const ease = 1 - Math.pow(1 - approach, 3);
    const dist = THREE.MathUtils.lerp(startDist, endDist, ease);

    const t = clock.elapsedTime;
    const driftX = Math.sin(t * 0.25) * 0.4;
    const driftY = 0.6 + Math.cos(t * 0.22) * 0.25;

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
        <OuterHalo />
        <EventHorizonDisc />
        <EinsteinRim />
      </group>
    </>
  );
}

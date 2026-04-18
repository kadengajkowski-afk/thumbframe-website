// Scene 2 — Problem Planet (sceneIdx 1.00 – 2.20).
//
// Dead gray-violet planet cracked by a single deep groove (amber heat
// escaping). Three broken "tool artefact" objects drift in slow decaying
// orbits — evocative of the wrong-tool-for-the-job editors, not branded.
//
// Camera choreography:
//   1.00 – 1.10  establish — camera holds near Arrival exit pose, pivots
//                look target onto the planet (upper-left entry framing).
//   1.10 – 1.45  arc — camera swings left-to-right along a 12-unit-radius
//                arc around the planet's +Y axis, revealing the crack.
//   1.45 – 1.75  artefact close-up — camera eases toward the cracked-bitmap
//                slab drifting near the planet, look target follows.
//   1.75 – 2.20  peel-out — camera rotates back onto the tunnel axis and
//                ends at Wormhole Step-1 start pose (0, 0, -17) → (0,0,-45).
//
// All handoff poses match the previous/next scenes so there's no visible
// cut on the scroll boundary.
//
// Overlay copy (right-half of viewport) lives separately in
// src/landing/overlays/ProblemCopy.jsx — rendered as static HTML synced via
// the scrollBridge, matching the HeroCopy pattern.

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll } from '@react-three/drei';
import * as THREE from 'three';

// Moved further left (x -5 → -8) and scaled down 40% so the planet:
//   (1) stays in the LEFT portion of the frame while the right-half overlay
//       text is up (sceneIdx 1.15–1.85) — doesn't occlude the paragraph.
//   (2) no longer reads as "full-moon close-up" — sits in frame as a
//       distant dead world, not a dominant sphere.
const PLANET_POS = new THREE.Vector3(-8, 1, -20);
const PLANET_RADIUS = 2.4;
// Self-rotation (rad/s) around Y. Slow enough to be subliminal but present.
const PLANET_SPIN = 0.08;

// ── Shared GLSL noise helpers ───────────────────────────────────────────────

const noiseGLSL = /* glsl */ `
  vec3 mod289v3(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289v4(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 perm(vec4 x) { return mod289v4(((x*34.0)+1.0)*x); }

  float noise3(vec3 p) {
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d*d*(3.0-2.0*d);
    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);
    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);
    vec4 o1 = fract(k3 * (1.0/41.0));
    vec4 o2 = fract(k4 * (1.0/41.0));
    vec4 o3 = o2*d.z + o1*(1.0-d.z);
    vec2 o4 = o3.yw*d.x + o3.xz*(1.0-d.x);
    return o4.y*d.y + o4.x*(1.0-d.y);
  }

  float fbm6(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 6; i++) {
      v += a * noise3(p);
      p = p * 2.02 + vec3(7.1, 3.7, 11.3);
      a *= 0.5;
    }
    return v;
  }
`;

// ── Planet surface shader ───────────────────────────────────────────────────

const planetVert = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying float vCrackMask;
  varying float vSurfaceHeight;

  ${noiseGLSL}

  // Great-circle crack — band along a fixed plane normal, width modulated
  // by a low-freq tear noise so the groove looks ragged, not machined.
  const vec3 CRACK_N = vec3(0.28, 0.81, 0.51);

  float crackMask(vec3 n) {
    float c = dot(n, normalize(CRACK_N));
    // Tear noise along the band coordinate so the crack wobbles — no
    // machined edge. Higher amplitude (0.14) so the groove looks torn.
    float tear = noise3(n * 3.2) - 0.5;
    float offset = tear * 0.14;
    float dist = abs(c - offset);
    // Wide, readable band — core is solid to ~0.05, fade out by 0.22.
    return 1.0 - smoothstep(0.05, 0.22, dist);
  }

  void main() {
    // Position in object space, before displacement.
    vec3 p = position;
    vec3 n = normalize(p);

    // Painterly lumps — 6-octave fBm in object space.
    float height = fbm6(n * 2.1);
    float displaced = 0.35 * (height - 0.5);

    // Crack groove — deep negative displacement inside the crack band so the
    // surface is clearly split, not just tinted.
    float crack = crackMask(n);
    displaced -= crack * 1.15;

    vec3 bent = p + n * displaced;

    // World-space pipeline values for the fragment shader.
    vec4 worldPos = modelMatrix * vec4(bent, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * n);
    vCrackMask = crack;
    vSurfaceHeight = height;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const planetFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3  uKeyDir;        // world-space key light (from below+front)
  uniform vec3  uCameraPos;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  varying float vCrackMask;
  varying float vSurfaceHeight;

  ${noiseGLSL}

  void main() {
    vec3 N = normalize(vWorldNormal);
    float NdotL = dot(N, normalize(uKeyDir));

    // Dead-planet gray-violet palette — darkened across all bands so the lit
    // side caps at the MID tone (per spec revision), not the highlight, and
    // the planet reads as a dead world, not a moon lit by a close star.
    vec3 cShadow = vec3(0.10, 0.075, 0.13);  // ~#1B1322
    vec3 cMid    = vec3(0.30, 0.26, 0.34);   // ~#4D4257
    vec3 cLit    = vec3(0.42, 0.38, 0.47);   // #6A6278 — spec mid; used as cap

    // Smooth ramp from shadow to the lit cap based on key-light incidence.
    // smoothstep keeps bands soft (no hard toon line) and guarantees the
    // brightest pixel tops at cLit.
    float litness = smoothstep(-0.20, 0.35, NdotL);
    vec3 base = mix(cShadow, cLit, litness);

    // Height stipple — very subtle. Recesses a touch darker, peaks a touch
    // lighter, but not enough to push past the lit cap.
    base *= 0.88 + vSurfaceHeight * 0.16;

    // Fresnel rim — cold violet silhouette against the nebula, toned down
    // so the planet's silhouette is crisp but not glowing.
    vec3 V = normalize(uCameraPos - vWorldPos);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    base += vec3(0.16, 0.08, 0.22) * rim * 0.30;

    // Crack — amber "heat" glow along the groove. Stronger mix strength and
    // a more saturated amber so the crack clearly reads as "this planet is
    // broken," not just a tonal shift.
    float flicker = 0.82 + 0.18 * sin(uTime * 1.3 + vSurfaceHeight * 11.0);
    vec3 crackEmissive = vec3(1.20, 0.55, 0.18) * 1.05 * flicker;
    base = mix(base, crackEmissive, vCrackMask * 0.95);

    gl_FragColor = vec4(base, 1.0);
  }
`;

function ProblemPlanetBody() {
  const meshRef = useRef();
  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uKeyDir:     { value: new THREE.Vector3(0.2, -0.8, 0.3).normalize() },
    uCameraPos:  { value: new THREE.Vector3() },
  }), []);

  useFrame(({ clock, camera }) => {
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uCameraPos.value.copy(camera.position);
    // Slow self-rotation — carries the crack across the lit hemisphere
    // during the arc phase.
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * PLANET_SPIN;
    }
  });

  return (
    <mesh ref={meshRef} position={PLANET_POS.toArray()}>
      <icosahedronGeometry args={[PLANET_RADIUS, 5]} />
      <shaderMaterial
        vertexShader={planetVert}
        fragmentShader={planetFrag}
        uniforms={uniforms}
      />
    </mesh>
  );
}

// ── Broken tool artifacts ───────────────────────────────────────────────────
// Tool-evocative, not branded. Each is built from primitives with visible
// separation gaps so it reads as "fragmented" without a full voronoi shader.

const ART_COLOR_FRAME   = '#50483c'; // warm grey-brown frame
const ART_COLOR_PANEL   = '#6a5a4a'; // panel tone
const ART_COLOR_ACCENT  = '#8a6050'; // rust accent
const ART_COLOR_DESAT   = '#504858'; // grey-violet
const ART_COLOR_TEAL    = '#506066'; // faded teal
const ART_COLOR_SWATCH_A = '#a86040';
const ART_COLOR_SWATCH_B = '#506670';
const ART_COLOR_LINE    = '#8a8498'; // dusty highlight (wireframe)

// 1. Cracked bitmap-editor slab — Photoshop-evocative.
function CrackedBitmapSlab() {
  return (
    <group>
      {/* Torn left half of a dark rectangular editor body */}
      <mesh position={[-0.22, 0, 0]}>
        <boxGeometry args={[0.80, 1.10, 0.05]} />
        <meshBasicMaterial color={ART_COLOR_FRAME} toneMapped={false} />
      </mesh>
      {/* Torn right half — offset outward + rotated slightly (shows tear) */}
      <mesh position={[0.30, -0.06, 0.04]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.68, 0.98, 0.05]} />
        <meshBasicMaterial color={ART_COLOR_FRAME} toneMapped={false} />
      </mesh>
      {/* Top "tool strip" — narrow band across the top of the left half */}
      <mesh position={[-0.22, 0.48, 0.04]}>
        <boxGeometry args={[0.70, 0.10, 0.03]} />
        <meshBasicMaterial color={ART_COLOR_ACCENT} toneMapped={false} />
      </mesh>
      {/* A few dark square tool icons inside the strip */}
      <mesh position={[-0.42, 0.48, 0.07]}>
        <boxGeometry args={[0.06, 0.06, 0.02]} />
        <meshBasicMaterial color={ART_COLOR_PANEL} toneMapped={false} />
      </mesh>
      <mesh position={[-0.30, 0.48, 0.07]}>
        <boxGeometry args={[0.06, 0.06, 0.02]} />
        <meshBasicMaterial color={ART_COLOR_PANEL} toneMapped={false} />
      </mesh>
      <mesh position={[-0.18, 0.48, 0.07]}>
        <boxGeometry args={[0.06, 0.06, 0.02]} />
        <meshBasicMaterial color={ART_COLOR_PANEL} toneMapped={false} />
      </mesh>
      {/* Inner panel (the "canvas" area, ruined) */}
      <mesh position={[-0.22, -0.08, 0.05]}>
        <boxGeometry args={[0.58, 0.72, 0.01]} />
        <meshBasicMaterial color={ART_COLOR_PANEL} toneMapped={false} />
      </mesh>
    </group>
  );
}

// 2. Leaning "canvas frame" — Canva-evocative.
function LeaningCanvasFrame() {
  return (
    <group>
      {/* Outer square frame — hollow, four sides */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.90, 0.08, 0.05]} />
        <meshBasicMaterial color={ART_COLOR_LINE} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.45, 0]}>
        <boxGeometry args={[0.90, 0.08, 0.05]} />
        <meshBasicMaterial color={ART_COLOR_LINE} toneMapped={false} />
      </mesh>
      <mesh position={[-0.41, 0, 0]}>
        <boxGeometry args={[0.08, 0.90, 0.05]} />
        <meshBasicMaterial color={ART_COLOR_LINE} toneMapped={false} />
      </mesh>
      <mesh position={[0.41, 0, 0]}>
        <boxGeometry args={[0.08, 0.90, 0.05]} />
        <meshBasicMaterial color={ART_COLOR_LINE} toneMapped={false} />
      </mesh>
      {/* Detached colour swatches drifting alongside */}
      <mesh position={[0.70, 0.22, 0.08]} rotation={[0, 0, 0.22]}>
        <boxGeometry args={[0.22, 0.22, 0.04]} />
        <meshBasicMaterial color={ART_COLOR_SWATCH_A} toneMapped={false} />
      </mesh>
      <mesh position={[0.82, -0.12, 0.12]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[0.18, 0.18, 0.04]} />
        <meshBasicMaterial color={ART_COLOR_SWATCH_B} toneMapped={false} />
      </mesh>
    </group>
  );
}

// 3. Half-dissolved wireframe cube — Photopea-evocative.
function WireframeCubeFragment() {
  // 12 potential edges of a unit cube; we only render the ones listed below
  // (3 deleted → reads as decaying). Each edge is a thin box.
  const edgeThick = 0.03;
  const half = 0.5;
  const edges = [
    // bottom face (4 edges, keep 3)
    { pos: [ 0,       -half, -half ], size: [1,          edgeThick, edgeThick] },
    { pos: [ 0,       -half,  half ], size: [1,          edgeThick, edgeThick] },
    { pos: [-half,    -half,  0    ], size: [edgeThick,  edgeThick, 1       ] },
    // top face (keep 2)
    { pos: [ 0,        half, -half ], size: [1,          edgeThick, edgeThick] },
    { pos: [ half,     half,  0    ], size: [edgeThick,  edgeThick, 1       ] },
    // verticals (keep 4)
    { pos: [-half,     0,    -half ], size: [edgeThick,  1,         edgeThick] },
    { pos: [ half,     0,    -half ], size: [edgeThick,  1,         edgeThick] },
    { pos: [-half,     0,     half ], size: [edgeThick,  1,         edgeThick] },
    { pos: [ half,     0,     half ], size: [edgeThick,  1,         edgeThick] },
  ];
  return (
    <group>
      {edges.map((e, i) => (
        <mesh key={i} position={e.pos}>
          <boxGeometry args={e.size} />
          <meshBasicMaterial color={ART_COLOR_TEAL} toneMapped={false} />
        </mesh>
      ))}
      {/* A single free-floating fragment drifting off the cube */}
      <mesh position={[0.65, 0.25, -0.20]} rotation={[0.3, 0.5, 0.1]}>
        <boxGeometry args={[edgeThick, 0.35, edgeThick]} />
        <meshBasicMaterial color={ART_COLOR_DESAT} toneMapped={false} />
      </mesh>
    </group>
  );
}

// All three artefacts orbit in the +X hemisphere so the camera (which
// stays on the +X side of the planet throughout scene 2) always has line
// of sight to all three. Scales bumped ~1.6× since the planet shrunk.
const ARTIFACT_DEFS = [
  // Orbit radius is in world units around PLANET_POS. Angle 0 = +X.
  // tilt rotates the orbit plane off the horizontal.
  { Shape: CrackedBitmapSlab,     orbitRadius: 4.0, orbitAngle:  0.00, orbitSpeed: 0.060, tilt:  0.50, tumble: [0.32, 0.18, 0.25], scale: 2.10 },
  { Shape: LeaningCanvasFrame,    orbitRadius: 4.6, orbitAngle:  1.10, orbitSpeed: 0.050, tilt: -0.40, tumble: [0.22, 0.30, 0.14], scale: 1.85 },
  { Shape: WireframeCubeFragment, orbitRadius: 3.8, orbitAngle: -1.00, orbitSpeed: 0.075, tilt:  0.30, tumble: [0.26, 0.14, 0.28], scale: 1.80 },
];

function Artifact({ def }) {
  const groupRef = useRef();
  const { Shape } = def;

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const theta = def.orbitAngle + t * def.orbitSpeed;
    // Elliptical-ish orbit in the planet's XZ plane, lifted by tilt.
    const x = PLANET_POS.x + Math.cos(theta) * def.orbitRadius;
    const z = PLANET_POS.z + Math.sin(theta) * def.orbitRadius * 0.85;
    const y = PLANET_POS.y + Math.sin(theta * 0.9) * def.tilt;
    g.position.set(x, y, z);
    g.rotation.x = t * def.tumble[0];
    g.rotation.y = t * def.tumble[1];
    g.rotation.z = t * def.tumble[2];
  });

  return (
    <group ref={groupRef} scale={def.scale}>
      <Shape />
    </group>
  );
}

// ── Camera rig ──────────────────────────────────────────────────────────────

function ProblemCameraRig({ groupRef }) {
  const scroll = useScroll();

  useFrame(({ camera }) => {
    const sceneIdx = scroll.offset * 7;

    // Group visibility — render everything between 0.95 (soft arrival-end
    // crossfade) and 2.20 (hard handoff to wormhole).
    if (groupRef.current) {
      const shouldShow = sceneIdx >= 0.95 && sceneIdx <= 2.20;
      if (groupRef.current.visible !== shouldShow) {
        groupRef.current.visible = shouldShow;
      }
    }

    // Only take over camera in the scene-2 scroll window.
    if (sceneIdx < 1.00 || sceneIdx >= 2.20) return;

    // Pose keyframes (world space):
    //   K0  (1.00)  from Arrival phase-B end — cam (-4.2, 0.4, -8), look (0, 0, -30)
    //   K1  (1.10)  look pivots near planet but offset +X / −Y so the planet
    //               sits in the UPPER-LEFT of the frame, not dead centre.
    //   K2  (1.45)  arc end — cam (+8, 0.5, -22), look held off-right so
    //               planet stays in LEFT third; right-half overlay is clear.
    //   K3  (1.75)  artefact close-up — cam (+4, -0.5, -16), look at the
    //               slab orbit position around +X from planet centre.
    //   K4  (2.20)  handoff to Wormhole Step-1 — cam (0, 0, -17), look (0,0,-45)
    //
    // K1/K2 look offsets deliberately keep the planet in the left portion of
    // the frame so the right-half ProblemCopy overlay isn't occluded.

    const PLANET = PLANET_POS;
    const K0 = { cam: [-4.2, 0.4, -8.0], look: [0.0, 0.0, -30.0] };
    const K1 = { cam: [-4.2, 0.4, -8.0], look: [PLANET.x + 3.0, PLANET.y - 1.0, PLANET.z - 2.0] };
    const K2 = { cam: [ 8.0, 0.5, -22.0], look: [0.0, 0.0, -22.0] };
    // K3 artefact focus — roughly the CrackedBitmapSlab's +X orbit position
    // at the midpoint of scene 2.
    const K3 = { cam: [ 4.0, -0.5, -16.0], look: [-4.0, 1.0, -18.0] };
    const K4 = { cam: [ 0.0, 0.0, -17.0], look: [0.0, 0.0, -45.0] };

    const lerpV = (a, b, e) => [
      THREE.MathUtils.lerp(a[0], b[0], e),
      THREE.MathUtils.lerp(a[1], b[1], e),
      THREE.MathUtils.lerp(a[2], b[2], e),
    ];
    const sstep = (x) => x * x * (3.0 - 2.0 * x);

    let camP, lookP;
    if (sceneIdx < 1.10) {
      const p = (sceneIdx - 1.00) / 0.10;
      const e = sstep(p);
      camP = lerpV(K0.cam, K1.cam, e);
      lookP = lerpV(K0.look, K1.look, e);
    } else if (sceneIdx < 1.45) {
      const p = (sceneIdx - 1.10) / 0.35;
      const e = sstep(p);
      camP = lerpV(K1.cam, K2.cam, e);
      lookP = lerpV(K1.look, K2.look, e);
    } else if (sceneIdx < 1.75) {
      const p = (sceneIdx - 1.45) / 0.30;
      const e = sstep(p);
      camP = lerpV(K2.cam, K3.cam, e);
      lookP = lerpV(K2.look, K3.look, e);
    } else {
      // 1.75 – 2.20 peel-out.
      const p = (sceneIdx - 1.75) / 0.45;
      const e = sstep(p);
      camP = lerpV(K3.cam, K4.cam, e);
      lookP = lerpV(K3.look, K4.look, e);
    }

    camera.position.set(camP[0], camP[1], camP[2]);
    camera.lookAt(lookP[0], lookP[1], lookP[2]);
  });

  return null;
}

// ── Export ──────────────────────────────────────────────────────────────────

export default function ProblemPlanet() {
  const groupRef = useRef();
  return (
    <>
      <ProblemCameraRig groupRef={groupRef} />
      <group ref={groupRef} visible={false}>
        <ProblemPlanetBody />
        {ARTIFACT_DEFS.map((def, i) => (
          <Artifact key={i} def={def} />
        ))}
        {/* Harsh key from below + cold violet fill — spec-defined lighting.
            The planet shader already bakes this into its toon ramp, but the
            scene-level lights also light the artifacts' meshBasicMaterial
            surfaces (meshBasic ignores lighting, so this is mostly ambient
            for any future Lambert upgrade). */}
        <directionalLight position={[2, -5, 3]} intensity={0.6} color="#b89078" />
        <ambientLight intensity={0.2} color="#4a3858" />
      </group>
    </>
  );
}

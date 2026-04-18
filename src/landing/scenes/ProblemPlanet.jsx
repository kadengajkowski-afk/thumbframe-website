// Scene 2 — Problem Planet (sceneIdx 1.00 – 2.20).
//
// Texture-based dead world. The painted albedo is generated externally
// (public/assets/textures/problem-planet.png, 1024×1024) and already carries
// the "painterly cracked surface" look — we do NOT mix in a procedural
// crack shader here; the two always fight.
//
// Shader work is minimal: texture sample + gentle warm-amber directional
// key from below-right (intensity 0.5) + subtle cold-violet Fresnel rim
// for silhouette against the nebula. Painterly post-process (scene-wide
// Kuwahara → Outline → PaperGrain → ColorGrade) handles refinement.
//
// Camera choreography — per Scene 2 spec rework:
//   1.00 – 1.30  wide establishing — planet in LEFT third, right 2/3 clear
//                for overlay text.
//   1.30 – 1.70  arc — camera swings right, planet sweeps toward the LEFT
//                edge, artefacts drift into the right of frame.
//   1.70 – 2.00  push — camera pushes toward artefact #1 (cracked window),
//                planet falls out-of-frame left. Overlay text fades out.
//   2.00 – 2.20  peel — camera rotates back onto the tunnel axis, ending
//                exactly at Wormhole Step-1 start (0, 0, -17) → (0, 0, -45).

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useScroll, useTexture } from '@react-three/drei';
import * as THREE from 'three';

// ── Constants ───────────────────────────────────────────────────────────────

const PLANET_POS = new THREE.Vector3(-6, 1, -18);
const PLANET_RADIUS = 2.5;
// Target: one full revolution every 120 s  → ω = 2π / 120 ≈ 0.0524 rad/s.
const PLANET_SPIN = 0.05236;

// Artefact-1 "showcase" position — approximate world location of the cracked
// photo-editor window at the start of the scene (angle 0 on its orbit).
// The camera push (1.7–2.0) aims here so artefact 1 is foregrounded.
const ARTIFACT1_SHOWCASE = new THREE.Vector3(
  PLANET_POS.x + 4.5,        // +X offset (on the camera-facing hemisphere)
  PLANET_POS.y + 0.0,
  PLANET_POS.z + 0.0,
);

// ── Planet shader ───────────────────────────────────────────────────────────

const planetVert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorldPos = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const planetFrag = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3  uLightDir;       // world-space; below-right warm-amber key
  uniform float uLightIntensity; // 0.5 per spec
  uniform vec3  uCameraPos;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 tex = texture2D(uMap, vUv).rgb;
    vec3 N = normalize(vNormal);

    // Dramatic wrap — shadow hemisphere drops to ~18% of albedo, lit side
    // goes up to ~1.2× for amber-key punch. Without this the planet read
    // as flat navy and the painted crack detail had nothing to fight against.
    // 0.18 + 1.05·NdotL · uLightIntensity gives the spec's "intensity 1.2"
    // peak on full lit-facing normals while preserving base visibility on
    // the dark side.
    float NdotL = max(dot(N, normalize(uLightDir)), 0.0);
    float lit = 0.18 + 1.05 * NdotL * uLightIntensity;
    vec3 shaded = tex * lit;

    // Warm amber hue-shift on the lit side — stronger than before so the
    // light-struck hemisphere reads amber, not neutral.
    vec3 amberTint = vec3(1.18, 0.92, 0.62);
    shaded = mix(shaded, shaded * amberTint, NdotL * 0.75);

    // Two-layer rim:
    //   1. Wide violet fill — "rim fill at 0.3" per spec. Adds a halo of
    //      cold violet into the silhouette and shadow terminator so the
    //      dark side reads violet, not black.
    //   2. Narrow crisp rim line — pops the planet against the nebula.
    vec3 V = normalize(uCameraPos - vWorldPos);
    float facing = 1.0 - max(dot(N, V), 0.0);
    float rimFill = pow(facing, 1.6);
    float rimLine = pow(facing, 4.5);
    shaded += vec3(0.22, 0.12, 0.34) * rimFill * 0.30;
    shaded += vec3(0.36, 0.18, 0.42) * rimLine * 0.55;

    gl_FragColor = vec4(shaded, 1.0);
  }
`;

function ProblemPlanetBody() {
  const meshRef = useRef();
  const texture = useTexture('/assets/textures/problem-planet.png');

  // Ensure the texture is sampled as sRGB → linear so the painterly colours
  // don't come out washed-out after the three.js linear-workflow pipeline.
  // Also clamp anisotropy/filtering defaults that look good under Kuwahara.
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const uniforms = useMemo(() => ({
    uMap:            { value: texture },
    uLightDir:       { value: new THREE.Vector3(0.6, -0.7, 0.4).normalize() },
    // Per spec revision: bumped 0.5 → 1.2 so the shading actually reads.
    // Combined with the shader's (0.18 + 1.05·NdotL·I) wrap this pushes
    // the lit peak to ~1.2× albedo and the shadow floor to ~18%.
    uLightIntensity: { value: 1.2 },
    uCameraPos:      { value: new THREE.Vector3() },
  }), [texture]);

  useFrame(({ clock, camera }) => {
    uniforms.uCameraPos.value.copy(camera.position);
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * PLANET_SPIN;
    }
  });

  return (
    <mesh ref={meshRef} position={PLANET_POS.toArray()}>
      <icosahedronGeometry args={[PLANET_RADIUS, 4]} />
      <shaderMaterial
        vertexShader={planetVert}
        fragmentShader={planetFrag}
        uniforms={uniforms}
      />
    </mesh>
  );
}

// ── Broken tool artefacts ───────────────────────────────────────────────────
// Painterly silhouettes built from primitives. No branded clones; each is
// "evocative" of a category of tool — the reader gets the reference without
// the logo.

const RUST_DARK      = '#5a3a30'; // cracked window body — warmer brown, less saturated
const RUST_TOOLBAR   = '#4a2a22'; // toolbar strip (darker than body)
const PAPER_OUTLINE  = '#f0e4d0'; // window outline highlight
const WINDOW_ICON    = '#f0c090'; // tiny toolbar icons (paper-amber)
const TEAL_FADED     = '#3f6864'; // canvas frame
const SWATCH_A       = '#c87050'; // canvas swatch 1 (rust)
const SWATCH_B       = '#4a7878'; // canvas swatch 2 (teal)
const COLD_GRAY      = '#6a6e7a'; // wireframe cube

// 1. Cracked photo-editor window — a FLAT rectangular frame with a clear
//    "application window" silhouette: thin toolbar strip across the top,
//    broken upper-right corner, paper-highlight outline framing three sides.
//    Evokes Photoshop without being it; reads as a torn UI window, not a
//    chunk of industrial junk.
function CrackedPhotoWindow() {
  const W = 0.95;       // width (was 1.20)
  const H = 0.62;       // height (was 0.80)
  const D = 0.015;      // flat depth (was 0.06 — ~4× thinner now)
  const T = 0.02;       // outline thickness
  const TB_H = 0.10;    // toolbar strip height

  // The main body is split into a large L-shape (left + bottom) plus a
  // detached top-right fragment offset outward → reads as "torn corner."
  return (
    <group>
      {/* Main body — left 70% of the window, full height, flat slab. */}
      <mesh position={[-W * 0.15, 0, 0]}>
        <boxGeometry args={[W * 0.70, H, D]} />
        <meshBasicMaterial color={RUST_DARK} toneMapped={false} />
      </mesh>
      {/* Bottom-right extension — finishes the "L." */}
      <mesh position={[ W * 0.32, -H * 0.25, 0]}>
        <boxGeometry args={[W * 0.36, H * 0.50, D]} />
        <meshBasicMaterial color={RUST_DARK} toneMapped={false} />
      </mesh>
      {/* Torn top-right corner fragment — drifted out + slightly rotated. */}
      <mesh position={[ W * 0.40, H * 0.28, D + 0.01]} rotation={[0, 0, -0.22]}>
        <boxGeometry args={[W * 0.32, H * 0.28, D]} />
        <meshBasicMaterial color={RUST_DARK} toneMapped={false} />
      </mesh>

      {/* Toolbar strip along the top of the main body. */}
      <mesh position={[-W * 0.15, H * 0.5 - TB_H * 0.5, D * 0.55]}>
        <boxGeometry args={[W * 0.70, TB_H, D * 0.5]} />
        <meshBasicMaterial color={RUST_TOOLBAR} toneMapped={false} />
      </mesh>
      {/* Three tiny toolbar icons (paper-amber squares). */}
      {[-0.28, -0.15, -0.02].map((x, i) => (
        <mesh key={i} position={[x, H * 0.5 - TB_H * 0.5, D * 0.55 + 0.006]}>
          <boxGeometry args={[0.045, 0.045, 0.004]} />
          <meshBasicMaterial color={WINDOW_ICON} toneMapped={false} />
        </mesh>
      ))}

      {/* Paper-highlight outline — left / bottom / partial top framing the
          L-shape. Sides facing the torn corner left bare. */}
      <mesh position={[-W * 0.50 + T * 0.5, 0, D * 0.5 + 0.002]}>
        <boxGeometry args={[T, H, 0.004]} />
        <meshBasicMaterial color={PAPER_OUTLINE} toneMapped={false} />
      </mesh>
      <mesh position={[-W * 0.15, -H * 0.5 + T * 0.5, D * 0.5 + 0.002]}>
        <boxGeometry args={[W * 0.70, T, 0.004]} />
        <meshBasicMaterial color={PAPER_OUTLINE} toneMapped={false} />
      </mesh>
      <mesh position={[-W * 0.35, H * 0.5 - T * 0.5, D * 0.5 + 0.002]}>
        <boxGeometry args={[W * 0.30, T, 0.004]} />
        <meshBasicMaterial color={PAPER_OUTLINE} toneMapped={false} />
      </mesh>
    </group>
  );
}

// 2. Abandoned design canvas — 1.0 × 1.0 hollow faded-teal frame with two
//    detached colour-swatch squares drifting alongside. Evokes Canva.
function DesignCanvas() {
  const E = 1.0;   // edge length
  const T = 0.08;  // frame thickness
  const D = 0.04;  // depth
  return (
    <group>
      {/* Four frame strips forming a hollow square. */}
      <mesh position={[0,  E / 2, 0]}>
        <boxGeometry args={[E, T, D]} />
        <meshBasicMaterial color={TEAL_FADED} toneMapped={false} />
      </mesh>
      <mesh position={[0, -E / 2, 0]}>
        <boxGeometry args={[E, T, D]} />
        <meshBasicMaterial color={TEAL_FADED} toneMapped={false} />
      </mesh>
      <mesh position={[-E / 2, 0, 0]}>
        <boxGeometry args={[T, E, D]} />
        <meshBasicMaterial color={TEAL_FADED} toneMapped={false} />
      </mesh>
      <mesh position={[ E / 2, 0, 0]}>
        <boxGeometry args={[T, E, D]} />
        <meshBasicMaterial color={TEAL_FADED} toneMapped={false} />
      </mesh>
      {/* Two detached swatches — slightly rotated, offset from the frame. */}
      <mesh position={[ E * 0.75,  E * 0.30, 0.10]} rotation={[0, 0, 0.28]}>
        <boxGeometry args={[0.26, 0.26, 0.04]} />
        <meshBasicMaterial color={SWATCH_A} toneMapped={false} />
      </mesh>
      <mesh position={[ E * 0.90, -E * 0.20, 0.16]} rotation={[0, 0, -0.16]}>
        <boxGeometry args={[0.22, 0.22, 0.04]} />
        <meshBasicMaterial color={SWATCH_B} toneMapped={false} />
      </mesh>
    </group>
  );
}

// 3. Wireframe cube fragment — 8 edges of a unit cube (12 − 4 removed).
//    Reads as a broken hollow wireframe. Evokes Photopea's utilitarian look.
//    Edge thickness ~2× vs. first pass so the bars actually survive
//    Kuwahara smoothing at 0.4× effective resolution.
function WireframeCube() {
  const H = 0.5; // unit cube half-length
  const T = 0.065;
  const edges = [
    // 4 of 4 bottom-face edges: keep 3.
    { pos: [ 0,   -H, -H ], size: [1.0, T, T] },
    { pos: [ 0,   -H,  H ], size: [1.0, T, T] },
    { pos: [-H,   -H,  0 ], size: [T,   T, 1.0] },
    // 4 top-face edges: keep 2.
    { pos: [ 0,    H, -H ], size: [1.0, T, T] },
    { pos: [ H,    H,  0 ], size: [T,   T, 1.0] },
    // 4 vertical edges: keep 3 (one removed).
    { pos: [-H,    0, -H ], size: [T, 1.0, T] },
    { pos: [ H,    0, -H ], size: [T, 1.0, T] },
    { pos: [-H,    0,  H ], size: [T, 1.0, T] },
  ];
  return (
    <group>
      {edges.map((e, i) => (
        <mesh key={i} position={e.pos}>
          <boxGeometry args={e.size} />
          <meshBasicMaterial color={COLD_GRAY} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Artefact orbit defs ─────────────────────────────────────────────────────
// Each orbits PLANET_POS with its own radius / angle / speed / tilt. The
// orbit uses a slightly elliptical XZ ellipse with a Y component driven by
// tilt · sin(angle · 0.9), giving each artefact a different orbital plane.

// All three start on the +X hemisphere (cos(θ₀) > 0) so that during the
// Scene-2 viewing window — when the camera is always on the +X side of
// the planet — all three are visible simultaneously. Speeds slow enough
// that a typical 30 s traversal only drifts them ~1–2 rad (≤ 90°), so
// none end up behind the planet during the scroll.
const ARTIFACT_DEFS = [
  // 1. Cracked photo-editor window — slowest orbit, starts at +X centre
  //    so it matches ARTIFACT1_SHOWCASE for the camera push (1.7–2.0).
  {
    key: 'window',
    Shape: CrackedPhotoWindow,
    orbitRadius: 4.5,
    orbitAngle:  0.00,        // +X centre
    orbitSpeed:  0.040,
    tiltDeg:     20,
    tumble:      [0.05, 0.03, 0.04],
    scale:       1.15,
  },
  // 2. Abandoned design canvas — larger radius, above + behind on +X.
  {
    key: 'canvas',
    Shape: DesignCanvas,
    orbitRadius: 6.0,
    orbitAngle:  0.85,        // +X upper-back (cos ≈ 0.66)
    orbitSpeed:  0.055,
    tiltDeg:     35,
    tumble:      [0.04, 0.06, 0.03],
    scale:       1.10,
  },
  // 3. Wireframe cube fragment — medium radius, below + forward on +X.
  //    Slower than first pass so it doesn't swing behind the planet
  //    within the scene's typical viewing time.
  {
    key: 'cube',
    Shape: WireframeCube,
    orbitRadius: 5.2,
    orbitAngle: -0.75,        // +X lower-front (cos ≈ 0.73)
    orbitSpeed:  0.060,
    tiltDeg:     25,
    tumble:      [0.06, 0.04, 0.07],
    scale:       1.30,        // bumped so the hollow wireframe reads
  },
];

function Artefact({ def }) {
  const groupRef = useRef();
  const { Shape } = def;
  const tiltRad = (def.tiltDeg * Math.PI) / 180;

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const theta = def.orbitAngle + t * def.orbitSpeed;

    // Elliptical XZ orbit (0.85 Z-flatten) with a Y wobble driven by tilt.
    const x = PLANET_POS.x + Math.cos(theta) * def.orbitRadius;
    const z = PLANET_POS.z + Math.sin(theta) * def.orbitRadius * 0.85;
    const y = PLANET_POS.y + Math.sin(theta * 0.9) * tiltRad * def.orbitRadius * 0.35;
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

    // Scene-2 group visibility window.
    if (groupRef.current) {
      const shouldShow = sceneIdx >= 0.95 && sceneIdx <= 2.20;
      if (groupRef.current.visible !== shouldShow) {
        groupRef.current.visible = shouldShow;
      }
    }

    // Only drive camera within Scene 2.
    if (sceneIdx < 1.00 || sceneIdx >= 2.20) return;

    // Keyframes (world-space pairs of [cam, look]):
    //   K0 (1.00)  Arrival phase-B end — cam (-4.2, 0.4, -8), look (0,0,-30)
    //   K1 (1.30)  wide-shot end — cam drift, look targets RIGHT-of-planet
    //              so planet sits in the LEFT third of the frame.
    //   K2 (1.70)  arc end — cam (+8, 0.5, -22), look even further right
    //              so the planet has swept to the LEFT edge.
    //   K3 (2.00)  push end — cam close to artefact 1, look on artefact 1;
    //              planet falls out-of-frame to the left.
    //   K4 (2.20)  handoff — cam (0, 0, -17), look (0, 0, -45) (wormhole).

    const ART1 = ARTIFACT1_SHOWCASE;
    const P = PLANET_POS;

    const K0 = { cam: [-4.2, 0.4, -8.0], look: [ 0.0,  0.0, -30.0] };
    const K1 = { cam: [-3.0, 0.4, -10.0], look: [P.x + 5.0, P.y - 0.5, P.z - 2.0] };
    const K2 = { cam: [ 8.0, 0.5, -22.0], look: [ 1.5, -0.2, -22.0] };
    const K3 = { cam: [ ART1.x + 2.0, ART1.y - 0.5, ART1.z + 3.5],
                 look: [ ART1.x,       ART1.y,       ART1.z      ] };
    const K4 = { cam: [ 0.0, 0.0, -17.0], look: [ 0.0,  0.0, -45.0] };

    const lerpV = (a, b, e) => [
      THREE.MathUtils.lerp(a[0], b[0], e),
      THREE.MathUtils.lerp(a[1], b[1], e),
      THREE.MathUtils.lerp(a[2], b[2], e),
    ];
    const sstep = (x) => x * x * (3.0 - 2.0 * x);

    let camP, lookP;
    if (sceneIdx < 1.30) {
      // 1.00 – 1.30  wide establishing.
      const p = (sceneIdx - 1.00) / 0.30;
      const e = sstep(p);
      camP  = lerpV(K0.cam,  K1.cam,  e);
      lookP = lerpV(K0.look, K1.look, e);
    } else if (sceneIdx < 1.70) {
      // 1.30 – 1.70  arc right.
      const p = (sceneIdx - 1.30) / 0.40;
      const e = sstep(p);
      camP  = lerpV(K1.cam,  K2.cam,  e);
      lookP = lerpV(K1.look, K2.look, e);
    } else if (sceneIdx < 2.00) {
      // 1.70 – 2.00  push toward artefact #1.
      const p = (sceneIdx - 1.70) / 0.30;
      const e = sstep(p);
      camP  = lerpV(K2.cam,  K3.cam,  e);
      lookP = lerpV(K2.look, K3.look, e);
    } else {
      // 2.00 – 2.20  peel to wormhole entry.
      const p = (sceneIdx - 2.00) / 0.20;
      const e = sstep(p);
      camP  = lerpV(K3.cam,  K4.cam,  e);
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
        {ARTIFACT_DEFS.map((def) => (
          <Artefact key={def.key} def={def} />
        ))}
      </group>
    </>
  );
}

// Phase 1 test — isolates the painterly pipeline on a single icosphere
// so we can verify the Kuwahara / Outline / PaperGrain / ColorGrade
// chain is producing brush patches, dark contour edges, and paper
// texture. Nothing else in the frame.
//
// Spec: hero-rebuild-spec.md §21.
//
// Kept as a test scene (src/landing/scenes/_tests/) so later phases can
// mount their own isolated tests without rewriting Phase 1.

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import PainterlyPost from '../../shaders/painterly/PainterlyPost';

// Procedural color variation: a toon-ish shader that quantises view-angle
// lighting into bands of warm highlight, base violet-grey, and deep
// violet shadow. Gives the Kuwahara real edges/patches to work on
// instead of a uniform matte.
const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vNormal = normalMatrix * normal;
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uLightDir;
  varying vec3 vNormal;
  varying vec3 vWorld;

  void main() {
    vec3 n = normalize(vNormal);
    float NdotL = dot(n, normalize(uLightDir));

    vec3 base = vec3(0.36, 0.28, 0.50);
    vec3 warmHi = vec3(0.82, 0.76, 0.60);
    vec3 deepSh = vec3(0.12, 0.08, 0.20);

    vec3 color;
    if (NdotL > 0.45)      color = mix(base, warmHi, 0.55);
    else if (NdotL > 0.0)  color = base;
    else                   color = mix(base * 0.6, deepSh, 0.6);

    // Rim light — amber warmth on silhouette.
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.5);
    color += vec3(0.80, 0.55, 0.25) * rim * 0.45;

    gl_FragColor = vec4(color, 1.0);
  }
`;

function Icosphere() {
  return (
    <mesh>
      <icosahedronGeometry args={[1.6, 3]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uLightDir: { value: [5, 3, 2] },
        }}
      />
    </mesh>
  );
}

export default function PainterlyTest() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: '#0a0714',
      }}
    >
      <Canvas
        camera={{ fov: 45, near: 0.1, far: 50, position: [0, 0, 5] }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} color="#2a1850" />
          <directionalLight
            position={[5, 3, 2]}
            intensity={0.8}
            color="#ffd890"
          />
          <Icosphere />
          <PainterlyPost />
        </Suspense>
      </Canvas>
    </div>
  );
}

import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ScrollControls, useScroll } from '@react-three/drei';
import { SheetProvider, PerspectiveCamera as TheatreCamera, useCurrentSheet } from '@theatre/r3f';
import { val } from '@theatre/core';
import { mainSheet } from './choreography/theatreProject';
import PainterlyPost from './shaders/painterly/PainterlyPost';

// Conditionally load Theatre.js Studio in dev
if (process.env.NODE_ENV !== 'production') {
  import('@theatre/studio').then((studio) => {
    studio.default.initialize();
  });
}

// Noisy planet material — vertex displacement + color variation gives
// Kuwahara real texture to work with (flat colors produce no brush strokes).
const noisyPlanetVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplace;

  // Simple 3D noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314*r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g, l.zxy);
    vec3 i2 = max(g, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0*floor(p*ns.z*ns.z);
    vec4 x_ = floor(j*ns.z);
    vec4 y_ = floor(j - 7.0*x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  void main() {
    vNormal = normalMatrix * normal;
    // Multi-octave displacement
    float n = snoise(position * 1.5) * 0.4
            + snoise(position * 3.0) * 0.2
            + snoise(position * 6.0) * 0.1;
    vDisplace = n;
    vec3 displaced = position + normal * n;
    vPosition = (modelMatrix * vec4(displaced, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const noisyPlanetFrag = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying float vDisplace;

  void main() {
    vec3 norm = normalize(vNormal);
    vec3 lightDir = normalize(vec3(5.0, 4.0, 3.0));
    float diff = max(dot(norm, lightDir), 0.0);
    float rim = pow(1.0 - max(dot(norm, normalize(cameraPosition - vPosition)), 0.0), 2.5);

    // Color varies with displacement — ocean blue in valleys, orange peaks, green midlands
    vec3 deepColor = vec3(0.15, 0.10, 0.35);   // violet-blue
    vec3 midColor  = vec3(0.20, 0.50, 0.30);   // green
    vec3 highColor = vec3(0.90, 0.55, 0.20);   // orange
    vec3 peakColor = vec3(0.95, 0.90, 0.80);   // snow/cream

    float h = smoothstep(-0.3, 0.5, vDisplace);
    vec3 baseColor = mix(deepColor, midColor, smoothstep(0.0, 0.3, h));
    baseColor = mix(baseColor, highColor, smoothstep(0.3, 0.6, h));
    baseColor = mix(baseColor, peakColor, smoothstep(0.7, 1.0, h));

    // Lighting: ambient + diffuse + rim
    vec3 ambient = baseColor * vec3(0.25, 0.20, 0.35);
    vec3 lit = ambient + baseColor * diff * vec3(1.0, 0.90, 0.75);
    lit += rim * vec3(0.30, 0.50, 0.60) * 0.4;

    gl_FragColor = vec4(lit, 1.0);
  }
`;

function TestScene() {
  const planetRef = useRef();
  const torusRef = useRef();
  useFrame((_, dt) => {
    if (planetRef.current) planetRef.current.rotation.y += dt * 0.15;
    if (torusRef.current) torusRef.current.rotation.x += dt * 0.2;
  });
  return (
    <group>
      {/* Noisy planet — displacement + color variation for Kuwahara to work with */}
      <mesh ref={planetRef} position={[0, 0, 0]}>
        <icosahedronGeometry args={[2.5, 64]} />
        <shaderMaterial
          vertexShader={noisyPlanetVert}
          fragmentShader={noisyPlanetFrag}
        />
      </mesh>

      {/* Torus ring — teal, adds edge contrast */}
      <mesh ref={torusRef} position={[0, 0, 0]} rotation={[0.4, 0, 0.2]}>
        <torusGeometry args={[3.8, 0.12, 16, 64]} />
        <meshStandardMaterial color="#3a6660" roughness={0.5} metalness={0.2} />
      </mesh>

      {/* Small moons with different colors */}
      <mesh position={[-4, 1.5, -2]}>
        <sphereGeometry args={[0.6, 24, 24]} />
        <meshStandardMaterial color="#c86020" roughness={0.7} />
      </mesh>
      <mesh position={[4, -1, -3]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color="#4a2040" roughness={0.8} />
      </mesh>
      <mesh position={[2, 3, -4]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#3a6660" roughness={0.6} />
      </mesh>

      {/* Background nebula plane — gradient for the filter to show strokes on */}
      <mesh position={[0, 0, -12]}>
        <planeGeometry args={[40, 25]} />
        <meshBasicMaterial color="#1a1030" />
      </mesh>
    </group>
  );
}

// Scroll-driven Theatre.js playhead
function ScrollSheet() {
  const sheet = useCurrentSheet();
  const scroll = useScroll();

  useFrame(() => {
    if (!sheet) return;
    const len = val(sheet.sequence.pointer.length);
    sheet.sequence.position = scroll.offset * len;
  });

  return null;
}

// Scene graph
function SceneGraph() {
  return (
    <>
      <ScrollSheet />

      <TheatreCamera
        theatreKey="MainCamera"
        makeDefault
        position={[0, 0, 12]}
        fov={50}
        near={0.1}
        far={1000}
      />

      {/* Warm amber key + violet fill — painterly lighting */}
      <ambientLight intensity={0.35} color="#8060a0" />
      <directionalLight position={[5, 4, 3]} intensity={0.9} color="#f0c080" />
      <directionalLight position={[-3, 2, -4]} intensity={0.3} color="#6040a0" />

      <TestScene />

      <PainterlyPost />

      <color attach="background" args={['#0a0714']} />
    </>
  );
}

export default function Experience() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <Canvas
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <ScrollControls pages={7} damping={0.3}>
            <SheetProvider sheet={mainSheet}>
              <SceneGraph />
            </SheetProvider>
          </ScrollControls>
        </Suspense>
      </Canvas>
    </div>
  );
}

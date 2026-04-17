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

// Test scene — multiple objects to showcase the painterly effect.
function TestScene() {
  const sphereRef = useRef();
  const torusRef = useRef();
  useFrame((_, dt) => {
    if (sphereRef.current) sphereRef.current.rotation.y += dt * 0.3;
    if (torusRef.current) torusRef.current.rotation.x += dt * 0.2;
  });
  return (
    <group>
      {/* Main sphere — orange, warm */}
      <mesh ref={sphereRef} position={[0, 0, 0]}>
        <icosahedronGeometry args={[2, 4]} />
        <meshStandardMaterial color="#f97316" roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Torus — teal accent */}
      <mesh ref={torusRef} position={[3.5, 1, -2]}>
        <torusGeometry args={[1, 0.35, 16, 32]} />
        <meshStandardMaterial color="#3a6660" roughness={0.7} metalness={0.0} />
      </mesh>

      {/* Small moon — violet */}
      <mesh position={[-3, -0.5, 1]}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial color="#4a2040" roughness={0.8} metalness={0.0} />
      </mesh>

      {/* Ground plane for shadow reference */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1a1030" roughness={1} metalness={0} />
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

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ScrollControls } from '@react-three/drei';
import PainterlyPost from './shaders/painterly/PainterlyPost';
import Arrival from './scenes/Arrival';
import Nebula from './scenes/Nebula';

// Scene graph — Arrival scene + nebula backdrop + painterly post-processing
function SceneGraph() {
  return (
    <>
      {/* Camera is driven by Arrival's scroll-based choreography */}
      <perspectiveCamera makeDefault position={[0, 0, 15]} fov={50} near={0.1} far={200} />

      <Nebula radius={80} />
      <Arrival />

      <PainterlyPost />
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
            <SceneGraph />
          </ScrollControls>
        </Suspense>
      </Canvas>
    </div>
  );
}

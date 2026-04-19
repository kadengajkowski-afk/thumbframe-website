// v3 Canvas root. Replaces the v2 ScrollControls-based experience.
// Galaxy scene graph + state-driven CameraController + painterly post.

import React, { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import Galaxy from './Galaxy';
import CameraController from './system/CameraController';
import Rocket from './system/Rocket';
import PainterlyPost from './shaders/painterly/PainterlyPost';
import { registerOverviewCamera } from './overlays/PlanetHoverLabel';

const IS_DEV = process.env.NODE_ENV !== 'production';
const POST_DISABLED = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('raw') === '1';

// Publish the active camera to the label overlay so it can project
// world-space planet positions to screen-space.
function CameraBridge() {
  const { camera } = useThree();
  useEffect(() => { registerOverviewCamera(camera); }, [camera]);
  return null;
}

function SceneGraph() {
  return (
    <>
      <CameraController />
      <Galaxy />
      <Rocket />
      {!POST_DISABLED && <PainterlyPost />}
      {IS_DEV && <Stats />}
      <CameraBridge />
    </>
  );
}

export default function Experience() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 200, position: [0, 2, 22] }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SceneGraph />
        </Suspense>
      </Canvas>
    </div>
  );
}

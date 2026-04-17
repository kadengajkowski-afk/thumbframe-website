import React, { Suspense, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ScrollControls, Stats, useScroll } from '@react-three/drei';
import PainterlyPost from './shaders/painterly/PainterlyPost';
import Arrival from './scenes/Arrival';
import Nebula from './scenes/Nebula';
import { setScrollOffset, setScrollEl } from './lib/scrollBridge';

const IS_DEV = process.env.NODE_ENV !== 'production';

// Writes the current scroll offset and container element to the bridge
// each frame so HTML overlays can sync without re-rendering React.
function ScrollReader() {
  const scroll = useScroll();
  useEffect(() => {
    setScrollEl(scroll.el);
    return () => setScrollEl(null);
  }, [scroll.el]);
  useFrame(() => setScrollOffset(scroll.offset));
  return null;
}

function SceneGraph() {
  return (
    <>
      <perspectiveCamera makeDefault position={[0, 0, 15]} fov={50} near={0.1} far={200} />

      <Nebula radius={80} />
      <Arrival />

      <PainterlyPost />

      {IS_DEV && <Stats />}
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
            <ScrollReader />
          </ScrollControls>
        </Suspense>
      </Canvas>
    </div>
  );
}

import React, { Suspense, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ScrollControls, Stats, useScroll } from '@react-three/drei';
import PainterlyPost from './shaders/painterly/PainterlyPost';
import Arrival from './scenes/Arrival';
import Nebula from './scenes/Nebula';
import ProblemPlanet from './scenes/ProblemPlanet';
import Wormhole from './scenes/Wormhole';
import { setScrollOffset, setScrollEl } from './lib/scrollBridge';

const IS_DEV = process.env.NODE_ENV !== 'production';

// Debug: `?raw=1` disables the painterly post-process so raw shader output is
// visible. Lets you compare what the 3D scene looks like before/after Kuwahara.
const POST_DISABLED = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('raw') === '1';

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
      <Nebula radius={80} />
      <Arrival />
      <ProblemPlanet />
      <Wormhole />

      {!POST_DISABLED && <PainterlyPost />}

      {IS_DEV && <Stats />}
    </>
  );
}

export default function Experience() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <Canvas
        camera={{ fov: 50, near: 0.1, far: 200, position: [0, 0, 15] }}
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

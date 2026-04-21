// AuroraOverlay — post-composer render pass for the AURORA_LAYER.
//
// useFrame priority=2 fires AFTER @react-three/postprocessing's
// EffectComposer (which registers at priority=1). We temporarily flip
// camera.layers to AURORA_LAYER, render the scene (only the AuroraPlane
// is on that layer), then restore layer 0. autoClear is disabled around
// the call so the composer's painterly output isn't wiped — the aurora
// draws on top with additive blending.

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AURORA_LAYER } from './constants';

export default function AuroraOverlay() {
  const { gl, scene, camera } = useThree();
  const lastLogRef = useRef(0);
  const frameCountRef = useRef(0);

  useFrame(({ clock }) => {
    const prevAutoClear = gl.autoClear;
    gl.autoClear = false;
    camera.layers.set(AURORA_LAYER);
    gl.clearDepth();
    gl.render(scene, camera);
    camera.layers.set(0);
    gl.autoClear = prevAutoClear;

    // Rate-limited diagnostic — 1 log per second.
    frameCountRef.current += 1;
    const now = clock.elapsedTime;
    if (now - lastLogRef.current > 1) {
      lastLogRef.current = now;
      // eslint-disable-next-line no-console
      console.log('[aurora] priority-2 tick — frames since last log:',
        frameCountRef.current,
        'scene children:', scene.children.length,
        'camera.layers.mask before reset:', (1 << AURORA_LAYER));
      frameCountRef.current = 0;
    }
  }, 2);

  return null;
}

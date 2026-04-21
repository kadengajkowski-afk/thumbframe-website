// AuroraOverlay — post-composer render pass for the AURORA_LAYER.
//
// useFrame priority=2 fires AFTER @react-three/postprocessing's
// EffectComposer (which registers at priority=1). We temporarily flip
// camera.layers to AURORA_LAYER, render the scene (only the AuroraPlane
// is on that layer), then restore layer 0. autoClear is disabled around
// the call so the composer's painterly output isn't wiped — the aurora
// draws on top with additive blending.

import { useFrame, useThree } from '@react-three/fiber';
import { AURORA_LAYER } from './constants';

export default function AuroraOverlay() {
  const { gl, scene, camera } = useThree();

  useFrame(() => {
    const prevAutoClear = gl.autoClear;
    gl.autoClear = false;
    camera.layers.set(AURORA_LAYER);
    gl.clearDepth();
    gl.render(scene, camera);
    camera.layers.set(0);
    gl.autoClear = prevAutoClear;
  }, 2);

  return null;
}

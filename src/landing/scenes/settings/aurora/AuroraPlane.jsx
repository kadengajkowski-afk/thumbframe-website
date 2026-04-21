// AuroraPlane — full-screen quad carrying the aurora shader, assigned
// to the AURORA_LAYER so the painterly EffectComposer skips it.
//
// Uniforms (time, resolution) are driven from useFrame. The mesh is
// flipped onto AURORA_LAYER in a layout effect so the layer assignment
// takes effect before the first render.

import React, { useEffect, useRef } from 'react';
import { ScreenQuad } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import './AuroraMaterial';
import { AURORA_LAYER } from './constants';

const isMobile = typeof window !== 'undefined' && (
  window.innerWidth < 768 ||
  (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
);

// Diagnostics driven by the ?aurora=… query param.
const AURORA_QS = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('aurora')
  : null;
const DEBUG_MAGENTA = AURORA_QS === 'debug';
const DEBUG_CROP    = AURORA_QS === 'crop';

export default function AuroraPlane({
  intensity = 0.7,
  speed     = 0.04,
  altitudeMask = [0.2, 0.55],
}) {
  const meshRef = useRef();
  const matRef  = useRef();
  const { size } = useThree();

  // Move the mesh onto AURORA_LAYER before the first render. `set`
  // replaces the mask so the mesh renders only when the camera is
  // looking at layer AURORA_LAYER.
  useEffect(() => {
    const m = meshRef.current;
    // eslint-disable-next-line no-console
    console.log('[aurora] AuroraPlane mounted — ref:', m ? 'ok' : 'NULL',
      'layers.mask before:', m && m.layers && m.layers.mask);
    if (m) {
      m.layers.set(AURORA_LAYER);
      // eslint-disable-next-line no-console
      console.log('[aurora] AuroraPlane layers.mask after set:', m.layers.mask,
        '(expected', (1 << AURORA_LAYER), ')');
    }
    // eslint-disable-next-line no-console
    console.log('[aurora] material ref:', matRef.current ? 'ok' : 'NULL');
  }, []);

  useFrame((state) => {
    if (!matRef.current) return;
    matRef.current.uTime = state.clock.elapsedTime;
    matRef.current.uResolution.set(size.width, size.height);
  });

  return (
    <ScreenQuad ref={meshRef}>
      <auroraMaterial
        ref={matRef}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
        uIntensity={intensity}
        uSpeed={speed}
        uAltitudeMask={new THREE.Vector2(altitudeMask[0], altitudeMask[1])}
        uBandCount={isMobile ? 30 : 50}
        uDebug={DEBUG_MAGENTA ? 1 : 0}
        uCropDebug={DEBUG_CROP ? 1 : 0}
      />
    </ScreenQuad>
  );
}

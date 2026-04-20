// PainterlyPost — Kuwahara (depth-modulated) → Outline → Paper Grain → Color Grade

import React, { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer } from '@react-three/postprocessing';
import { KuwaharaEffect } from './KuwaharaEffect';
import { OutlineEffect } from './OutlineEffect';
import { PaperGrainEffect } from './PaperGrainEffect';
import { ColorGradeEffect } from './ColorGradeEffect';

// Evaluated once at import — viewport class is not expected to change
// mid-session on the landing.
const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768;
// Kuwahara internal buffer as a fraction of canvas pixels. Kuwahara smooths
// regardless of input resolution, so dropping this is almost free visually
// but large wins in pixel work. Mobile is further throttled because the
// wormhole scene carries more overdraw.
const KUWAHARA_SCALE = IS_MOBILE ? 0.30 : 0.50;

function KuwaharaPass() {
  const { size, viewport } = useThree();
  // Widened near/far gap for the ink-over-watercolor contrast —
  // planets at kernelNear=2 (barely smoothed), nebula at kernelFar=12.
  const effect = useMemo(
    () => new KuwaharaEffect({
      kernelNear: IS_MOBILE ? 2.0 : 2.5,
      kernelFar:  IS_MOBILE ? 10.0 : 16.0,
    }),
    []
  );

  useEffect(() => {
    const dpr = viewport.dpr || 1;
    effect.setSize(
      size.width  * dpr * KUWAHARA_SCALE,
      size.height * dpr * KUWAHARA_SCALE,
    );
  }, [size, viewport, effect]);

  return <primitive object={effect} dispose={null} />;
}

function OutlinePass() {
  const { size, viewport } = useThree();
  // Cranked for explicit ink-illustration read: strength 1.4 (was 0.85;
  // values >1 fully saturate the line at strong edges), sampleStride 2.2
  // (was 1.4) for ~3–4px thick contour lines.
  const effect = useMemo(() => new OutlineEffect({
    strength: 1.4,
    sampleStride: 2.2,
  }), []);

  useEffect(() => {
    const dpr = viewport.dpr || 1;
    effect.setSize(size.width * dpr, size.height * dpr);
  }, [size, viewport, effect]);

  return <primitive object={effect} dispose={null} />;
}

function PaperGrainPass() {
  const effect = useMemo(() => new PaperGrainEffect({ strength: 0.18, scale: 600 }), []);
  return <primitive object={effect} dispose={null} />;
}

function ColorGradePass() {
  const effect = useMemo(() => new ColorGradeEffect({ strength: 0.7 }), []);
  return <primitive object={effect} dispose={null} />;
}

export default function PainterlyPost() {
  return (
    <EffectComposer multisampling={0} resolutionScale={0.5} depthBuffer={true}>
      <KuwaharaPass />
      <OutlinePass />
      <PaperGrainPass />
      <ColorGradePass />
    </EffectComposer>
  );
}

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
const KUWAHARA_SCALE = IS_MOBILE ? 0.25 : 0.40;

function KuwaharaPass() {
  const { size, viewport } = useThree();
  // Softer watercolor target — dropped kernelFar from 12 to 6 so
  // gradients inside cloud/hull regions are preserved instead of
  // quantised into paint-by-numbers bands.
  const effect = useMemo(
    () => new KuwaharaEffect({
      kernelNear: IS_MOBILE ? 2.0 : 2.0,
      kernelFar:  IS_MOBILE ? 5.0 : 6.0,
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
  // Watercolor-soft outline — strength 1.4 → 0.15. Lines now bleed
  // through as a subtle ink wash rather than saturating the contour.
  // sampleStride kept at 2.2 so the wash has some width when it does
  // show.
  const effect = useMemo(() => new OutlineEffect({
    strength: 0.15,
    sampleStride: 2.2,
  }), []);

  useEffect(() => {
    const dpr = viewport.dpr || 1;
    effect.setSize(size.width * dpr, size.height * dpr);
  }, [size, viewport, effect]);

  return <primitive object={effect} dispose={null} />;
}

function PaperGrainPass() {
  // Grain bumped 0.18 → 0.28 for more visible paper fibre — pushes
  // the image away from the flat-digital read. The grain multiplier
  // is symmetric around 1.0 so this doesn't darken the frame.
  const effect = useMemo(() => new PaperGrainEffect({ strength: 0.28, scale: 600 }), []);
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

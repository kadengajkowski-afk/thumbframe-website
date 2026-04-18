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
  // Mobile uses a smaller kernel too — less detail needs preserving.
  const effect = useMemo(
    () => new KuwaharaEffect({
      kernelNear: IS_MOBILE ? 3.0 : 4.0,
      kernelFar:  IS_MOBILE ? 7.0 : 10.0,
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
  const effect = useMemo(() => new OutlineEffect({ strength: 0.55 }), []);

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

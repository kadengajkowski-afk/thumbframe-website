// PainterlyPost — Kuwahara (depth-modulated) → Outline → Paper Grain → Color Grade

import React, { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer } from '@react-three/postprocessing';
import { KuwaharaEffect } from './KuwaharaEffect';
import { OutlineEffect } from './OutlineEffect';
import { PaperGrainEffect } from './PaperGrainEffect';
import { ColorGradeEffect } from './ColorGradeEffect';

function KuwaharaPass() {
  const { size, viewport } = useThree();
  // Kuwahara is a smoothing filter, so dropping resolution from 0.5 → 0.4
  // is visually fine and reduces per-pixel work by ~35%. This is a scroll-
  // smoothness optimization — the Kuwahara pass was the largest per-frame
  // cost besides the raw scene render.
  const effect = useMemo(() => new KuwaharaEffect({ kernelNear: 4.0, kernelFar: 10.0 }), []);

  useEffect(() => {
    const dpr = viewport.dpr || 1;
    effect.setSize(size.width * dpr * 0.4, size.height * dpr * 0.4);
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

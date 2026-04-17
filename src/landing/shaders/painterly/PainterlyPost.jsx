// PainterlyPost — Kuwahara → Paper Grain → Color Grade
// Render at 50% resolution for the Kuwahara pass (the bottleneck).

import React, { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer } from '@react-three/postprocessing';
import { KuwaharaEffect } from './KuwaharaEffect';
import { PaperGrainEffect } from './PaperGrainEffect';
import { ColorGradeEffect } from './ColorGradeEffect';

function KuwaharaPass() {
  const { size, viewport } = useThree();
  // Kernel 8 instead of 12 — cuts per-pixel samples ~55%, still visibly painterly
  const effect = useMemo(() => new KuwaharaEffect({ kernelSize: 8.0 }), []);

  useEffect(() => {
    const dpr = viewport.dpr || 1;
    // Feed half-res dimensions so the shader samples fewer actual texels
    effect.setSize(size.width * dpr * 0.5, size.height * dpr * 0.5);
  }, [size, viewport, effect]);

  return <primitive object={effect} dispose={null} />;
}

function PaperGrainPass() {
  const effect = useMemo(() => new PaperGrainEffect({ strength: 0.20, scale: 600 }), []);
  return <primitive object={effect} dispose={null} />;
}

function ColorGradePass() {
  const effect = useMemo(() => new ColorGradeEffect({ strength: 0.7 }), []);
  return <primitive object={effect} dispose={null} />;
}

export default function PainterlyPost() {
  return (
    <EffectComposer multisampling={0} resolutionScale={0.5}>
      <KuwaharaPass />
      <PaperGrainPass />
      <ColorGradePass />
    </EffectComposer>
  );
}

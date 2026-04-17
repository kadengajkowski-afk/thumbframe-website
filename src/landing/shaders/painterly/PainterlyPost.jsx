// PainterlyPost — full-screen post-processing using @react-three/postprocessing.
// This properly takes over R3F's render loop (no double-render issue).
//
// Pipeline: Scene → Kuwahara → Paper Grain → Color Grade → Screen

import React, { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer } from '@react-three/postprocessing';
import { KuwaharaEffect } from './KuwaharaEffect';
import { PaperGrainEffect } from './PaperGrainEffect';
import { ColorGradeEffect } from './ColorGradeEffect';

function KuwaharaPass() {
  const { size, viewport } = useThree();
  const effect = useMemo(() => new KuwaharaEffect({ kernelSize: 6.0 }), []);

  useEffect(() => {
    const dpr = viewport.dpr || 1;
    effect.setSize(size.width * dpr, size.height * dpr);
  }, [size, viewport, effect]);

  return <primitive object={effect} dispose={null} />;
}

function PaperGrainPass() {
  const effect = useMemo(() => new PaperGrainEffect({ strength: 0.12, scale: 800 }), []);
  return <primitive object={effect} dispose={null} />;
}

function ColorGradePass() {
  const effect = useMemo(() => new ColorGradeEffect({ strength: 0.7 }), []);
  return <primitive object={effect} dispose={null} />;
}

export default function PainterlyPost() {
  return (
    <EffectComposer multisampling={0}>
      <KuwaharaPass />
      <PaperGrainPass />
      <ColorGradePass />
    </EffectComposer>
  );
}

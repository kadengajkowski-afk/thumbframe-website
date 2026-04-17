// PainterlyPost — full-screen post-processing pipeline.
// Pipeline: Scene → Structure Tensor → Anisotropic Kuwahara → Paper Grain → Color Grade → Screen
//
// Renders the scene to an offscreen target, then runs each pass in sequence.
// Uses Three.js EffectComposer + ShaderPass for the pipeline.

import { useRef, useEffect, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { StructureTensorMaterial } from './StructureTensorPass';
import { createKuwaharaMaterial } from './KuwaharaPass';
import { createPaperGrainMaterial } from './PaperGrainPass';
import { createColorGradeMaterial } from './ColorGradePass';

export default function PainterlyPost({ enabled = true }) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef();
  const structureTargetRef = useRef();
  const kuwaharaPassRef = useRef();
  const paperPassRef = useRef();

  // Materials (stable across renders)
  const materials = useMemo(() => ({
    structure: StructureTensorMaterial.clone(),
    kuwahara: createKuwaharaMaterial(),
    paper: createPaperGrainMaterial(),
    colorGrade: createColorGradeMaterial(),
  }), []);

  useEffect(() => {
    if (!enabled) return;

    const dpr = gl.getPixelRatio();
    const w = size.width * dpr;
    const h = size.height * dpr;

    // Render target for the structure tensor (separate from main pipeline)
    const structureTarget = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });
    structureTargetRef.current = structureTarget;

    // Main composer
    const composer = new EffectComposer(gl);
    composer.setSize(w, h);

    // Pass 1: Render the scene normally
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Pass 2: Structure tensor (runs separately, output feeds into Kuwahara)
    // We compute this in useFrame before the composer runs

    // Pass 3: Kuwahara filter
    const kuwaharaPass = new ShaderPass(materials.kuwahara);
    kuwaharaPass.uniforms.uResolution.value.set(w, h);
    composer.addPass(kuwaharaPass);
    kuwaharaPassRef.current = kuwaharaPass;

    // Pass 4: Paper grain
    const paperPass = new ShaderPass(materials.paper);
    composer.addPass(paperPass);
    paperPassRef.current = paperPass;

    // Pass 5: Color grade (final, renders to screen)
    const gradePass = new ShaderPass(materials.colorGrade);
    composer.addPass(gradePass);

    composerRef.current = composer;

    return () => {
      composer.dispose();
      structureTarget.dispose();
    };
  }, [enabled, gl, scene, camera, size, materials]);

  // Handle resize
  useEffect(() => {
    if (!composerRef.current) return;
    const dpr = gl.getPixelRatio();
    const w = size.width * dpr;
    const h = size.height * dpr;
    composerRef.current.setSize(w, h);
    if (structureTargetRef.current) {
      structureTargetRef.current.setSize(w, h);
    }
    if (kuwaharaPassRef.current) {
      kuwaharaPassRef.current.uniforms.uResolution.value.set(w, h);
    }
  }, [size, gl]);

  useFrame(({ clock }) => {
    if (!enabled || !composerRef.current) return;

    const dpr = gl.getPixelRatio();
    const w = size.width * dpr;
    const h = size.height * dpr;

    // Step 1: Render scene to the composer's first render target to get the scene texture
    // The RenderPass does this automatically as part of the composer

    // Step 2: Compute structure tensor from the scene render
    // We render a full-screen quad with the structure tensor shader
    // reading from the composer's read buffer
    const structureMat = materials.structure;
    structureMat.uniforms.uResolution.value.set(w, h);

    // The structure tensor reads from the same scene — we'll let the
    // Kuwahara pass read from the RenderPass output and compute structure inline.
    // For Phase B simplicity, the Kuwahara pass computes its own local gradients
    // instead of a separate structure tensor pass.

    // Update time for paper grain animation
    if (paperPassRef.current) {
      paperPassRef.current.uniforms.uTime.value = clock.elapsedTime;
    }

    // Run the full pipeline
    composerRef.current.render();
  }, 1); // priority 1 = runs after scene updates

  return null;
}

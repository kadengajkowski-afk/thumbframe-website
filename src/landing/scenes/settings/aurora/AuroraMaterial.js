// drei's shaderMaterial + R3F extend. Registers <auroraMaterial> as a
// JSX-mountable component with uniforms typed from the defaults passed
// below. Import this module anywhere the material is used so the extend
// call has run before render.

import * as THREE from 'three';
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';

import vertexShader from './shaders/aurora.vert.js';
import fragmentShader from './shaders/aurora.frag.js';

export const AuroraMaterial = shaderMaterial(
  {
    uTime:          0,
    uResolution:    new THREE.Vector2(1, 1),
    uIntensity:     0.7,
    uSpeed:         0.04,
    // sin anchor vector — green/cyan/magenta/violet sweep per iteration.
    uHueA:          new THREE.Vector3(2.15, -0.5, 1.2),
    // Optional secondary anchor — left at 0 for now, available for tuning.
    uHueB:          new THREE.Vector3(0, 0, 0),
    // Vertical crop bounds (vUv.y space) — aurora sits between these.
    uAltitudeMask:  new THREE.Vector2(0.2, 0.55),
    // Iteration count — 50 desktop, 30 mobile.
    uBandCount:     50,
    // Debug solid-color override (set to 1 via ?aurora=debug).
    uDebug:         0,
  },
  vertexShader,
  fragmentShader,
);

extend({ AuroraMaterial });

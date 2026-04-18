// Floating label shown above the currently-hovered planet. Converts the
// planet's world position to screen-space via the camera's matrix.

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGalaxyStore, PLANET_POSITIONS } from '../state/galaxyStore';

const LABEL_TEXT = {
  signal:      'SIGNAL',
  dead:        'DEAD WORLD',
  singularity: 'SINGULARITY',
  docking:     'DOCKING',
  science:     'SCIENCE',
};

// Access the R3F camera via a global hook — the Experience sets it.
let _activeCamera = null;
export function registerOverviewCamera(cam) { _activeCamera = cam; }

export default function PlanetHoverLabel() {
  const ref = useRef(null);

  useEffect(() => {
    const v = new THREE.Vector3();
    let rafId = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const s = useGalaxyStore.getState();
        const id = s.hoveredPlanet;
        // Only show on overview, not during transitions or while on-planet.
        const visible = id && s.transitionState === 'idle' && _activeCamera;
        if (visible) {
          const p = PLANET_POSITIONS[id];
          v.set(p[0], p[1] + 2.5, p[2]);
          v.project(_activeCamera);
          // NDC [-1, 1] → pixel space.
          const x = (v.x * 0.5 + 0.5) * window.innerWidth;
          const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
          el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
          el.textContent = LABEL_TEXT[id] || '';
          const target = 1;
          const current = parseFloat(el.style.opacity || '0');
          el.style.opacity = String(current + (target - current) * 0.25);
        } else {
          const current = parseFloat(el.style.opacity || '0');
          el.style.opacity = String(current * 0.8);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: 0, top: 0,
        zIndex: 14,
        color: '#f0e4d0',
        fontFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif",
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '0.32em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        opacity: 0,
        textShadow: '0 0 14px rgba(10,7,20,0.9), 0 0 4px rgba(10,7,20,1)',
        willChange: 'transform, opacity',
      }}
    />
  );
}

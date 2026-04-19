// Mouse parallax — tracks pointer position in [-1, 1] screen-normalised
// coords and exposes a getMouseOffset() helper for the CameraController.
//
// Returns a damped offset each frame so the camera glides rather than
// snapping to the cursor. Disabled implicitly during travel animations
// (the CameraController only applies the offset while the galaxy store
// is in the 'idle' state).

import { useEffect } from 'react';

// Module-level pointer state — read-only from outside via getMouseOffset().
let rawX = 0;   // target, updated every mousemove ∈ [-1, 1]
let rawY = 0;
let curX = 0;   // damped
let curY = 0;

const MAX_OFFSET = 1.0;   // world units on each of X/Y at the camera
const DAMP = 0.06;        // per-frame lerp factor; smaller = smoother

export function getMouseOffset() {
  return { x: curX, y: curY };
}

// Updated every frame by CameraController before reading the offset.
// Keeps damp rate frame-rate-agnostic(-ish) without introducing a separate
// rAF — the camera already ticks once per frame.
export function stepMouseOffset() {
  curX += (rawX - curX) * DAMP;
  curY += (rawY - curY) * DAMP;
}

export function resetMouseOffset() {
  rawX = rawY = 0;
  curX = curY = 0;
}

export default function MouseParallax() {
  useEffect(() => {
    const onMove = (e) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const nx = (e.clientX / w) * 2 - 1;     // -1 (left) → +1 (right)
      const ny = -((e.clientY / h) * 2 - 1);  // -1 (bottom) → +1 (top)
      rawX = nx * MAX_OFFSET;
      rawY = ny * MAX_OFFSET;
    };
    const onLeave = () => { rawX = 0; rawY = 0; };
    const onTouchMove = (e) => {
      if (!e.touches || e.touches.length === 0) return;
      const t = e.touches[0];
      const nx = (t.clientX / window.innerWidth) * 2 - 1;
      const ny = -((t.clientY / window.innerHeight) * 2 - 1);
      rawX = nx * MAX_OFFSET;
      rawY = ny * MAX_OFFSET;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  return null;
}

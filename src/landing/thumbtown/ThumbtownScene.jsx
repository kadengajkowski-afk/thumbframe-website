// Thumbtown scene — simplified hero.
//
// Replaces the prior multi-layer compositor. One painted panorama fills
// the viewport as an object-cover hero image with a slow Ken Burns
// transform, and a transparent SVG overlay animates three accent
// elements on top (clouds, birds, sun glow). Everything else — Frame
// placeholder, sprite characters, floating islands, mountain-main
// stack, gradient stubs — is gone from the render tree. Files remain
// in the repo but no longer load.
//
// Children mounted:
//   panorama.png       single full-viewport image
//   SceneOverlay       SVG with 3 animated elements
//
// Nav + WorldHero are mounted by LandingPageV2.jsx, not here.

import React from 'react';
import SceneOverlay from './SceneOverlay';

const PANORAMA_SRC = '/assets/thumbtown/panorama.png';

export default function ThumbtownScene() {
  return (
    <>
      <style>{kenBurnsCSS}</style>
      <div
        className="absolute inset-0 overflow-hidden select-none"
        style={{ background: '#18101c' }}
        aria-hidden
      >
        <img
          src={PANORAMA_SRC}
          alt=""
          draggable={false}
          className="tt-panorama"
        />
        <SceneOverlay />
      </div>
    </>
  );
}

// Ken Burns — subtle 40s scale + pan, alternating so the image drifts
// back and forth without a hard reset. Disabled under
// prefers-reduced-motion and below 768 px (touch devices — save battery).
const kenBurnsCSS = `
.tt-panorama {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
  transform-origin: 50% 50%;
  will-change: transform;
  animation: tt-kb 40s ease-in-out infinite alternate;
  user-select: none;
}

@keyframes tt-kb {
  from { transform: scale(1.00) translate(0%, 0%); }
  to   { transform: scale(1.05) translate(-1%, -0.5%); }
}

@media (max-width: 767px) {
  .tt-panorama { animation: none; transform: scale(1.02); }
}

@media (prefers-reduced-motion: reduce) {
  .tt-panorama { animation: none; transform: scale(1.02); }
}
`;

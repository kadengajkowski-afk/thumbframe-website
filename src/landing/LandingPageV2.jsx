// Thumbtown landing — video hero with SVG Frame portal.
//
// Composition:
//   • ThumbtownScene — full-viewport looping MJ panorama video +
//     ornate Frame. Clicking the Frame triggers the warp transition,
//     and onOpenEditor routes to the editor.
//   • Navbar — transparent top navigation, sits over the video.
//   • HeroOverlay — top-left copy + primary CTA.
//
// Navigation is prop-driven via `setPage` from App.js. If the prop is
// absent we fall back to a plain window.location navigation so the
// landing stays functional as a standalone mount.

import React from 'react';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './landing.built.css';
import Navbar from './components/layout/Navbar';
import ThumbtownScene from './thumbtown/ThumbtownScene';
import HeroOverlay from './thumbtown/HeroOverlay';

export default function LandingPageV2({ setPage }) {
  const goTo = (target) => {
    if (typeof setPage === 'function') setPage(target);
    else window.location.href = '/' + target;
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        background: '#141024',
      }}
    >
      <ThumbtownScene />
      <Navbar onNavigate={goTo} />
      <HeroOverlay onStartFree={() => goTo('signup')} />
    </div>
  );
}

// Thumbtown landing — Phase 2 static composition.
//
// Renders:
//   • Navbar (transparent, sits over the scene)
//   • ThumbtownScene — layered PNG compositor + colour stubs
//   • WorldHero — top-left overlay with eyebrow / H1 / CTA
//
// No ambient motion yet (Phase 3). No easter-egg clicks (Phase 4). No
// pricing island transition (Phase 5). No 3D Frame warp (Phase 6). No
// scroll content below the scene (Phase 7).
//
// Mobile: ThumbtownScene and Navbar handle their own responsive scaling
// via Tailwind md: breakpoints and CSS media queries.

import React from 'react';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './landing.built.css';
import Navbar from './components/layout/Navbar';
import ThumbtownScene from './thumbtown/ThumbtownScene';
import WorldHero from './thumbtown/WorldHero';

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
      {/* Layered painted scene — back-to-front PNG stack + stubs. */}
      <ThumbtownScene />

      {/* Top navigation — sits above scene, transparent background. */}
      <Navbar onNavigate={goTo} />

      {/* Hero overlay — top-left per spec §7. */}
      <WorldHero onStartFree={() => goTo('signup')} />
    </div>
  );
}

import React, { Suspense, lazy } from 'react';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './landing.built.css';
import GalaxyHero from './overlays/GalaxyHero';
import PlanetContent from './overlays/PlanetContent';
import ReturnToGalaxyButton from './overlays/ReturnToGalaxyButton';
import PlanetHoverLabel from './overlays/PlanetHoverLabel';
import ScrollDebug from './overlays/ScrollDebug';
import KeyboardNav from './system/KeyboardNav';
import HashRouter from './system/HashRouter';
import ScrollTour from './system/ScrollTour';

const Experience = lazy(() => import('./Experience'));

function isLowEnd() {
  if (typeof navigator === 'undefined') return false;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return true;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return true;
  try {
    const c = document.createElement('canvas');
    if (!c.getContext('webgl2') && !c.getContext('webgl')) return true;
  } catch { return true; }
  return false;
}

export default function LandingPageV2({ setPage }) {
  const lowEnd = isLowEnd();

  return (
    <div style={{ background: '#0a0714', color: '#f0e4d0', minHeight: '100vh', height: '100vh', overflow: 'hidden' }}>
      {!lowEnd ? (
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter Variable, system-ui, sans-serif' }}>
            <p style={{ color: '#a0a0b0', fontSize: 14 }}>Loading experience…</p>
          </div>
        }>
          <Experience />
        </Suspense>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter Variable, system-ui, sans-serif' }}>
          <p style={{ color: '#a0a0b0', fontSize: 14 }}>Static fallback — coming in Phase J</p>
        </div>
      )}

      {/* Overlays — galaxy hero, active-planet content, return button, hover label. */}
      <GalaxyHero setPage={setPage} />
      <PlanetContent setPage={setPage} />
      <ReturnToGalaxyButton />
      <PlanetHoverLabel />

      {/* Systems — no visual output, just side-effects on the store. */}
      <KeyboardNav />
      <HashRouter />
      <ScrollTour />

      <ScrollDebug />
    </div>
  );
}

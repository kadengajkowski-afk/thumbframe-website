import React, { Suspense, lazy } from 'react';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './landing.built.css';
import HeroCopy from './overlays/HeroCopy';

const Experience = lazy(() => import('./Experience'));

// Low-end device detection — route to static fallback
function isLowEnd() {
  if (typeof navigator === 'undefined') return false;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return true;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return true;
  // Check for WebGL support
  try {
    const c = document.createElement('canvas');
    if (!c.getContext('webgl2') && !c.getContext('webgl')) return true;
  } catch { return true; }
  return false;
}

export default function LandingPageV2({ setPage }) {
  const lowEnd = isLowEnd();

  // HeroCopy is rendered synchronously (outside the lazy Experience boundary)
  // so Scene 1 hero markup is present in the initial HTML for SEO/crawlers.
  return (
    <div style={{ background: '#0a0714', color: '#f0e4d0', minHeight: '100vh' }}>
      {!lowEnd ? (
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter Variable, system-ui, sans-serif' }}>
            <p style={{ color: '#a0a0b0', fontSize: 14 }}>Loading experience...</p>
          </div>
        }>
          <Experience />
        </Suspense>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter Variable, system-ui, sans-serif' }}>
          <p style={{ color: '#a0a0b0', fontSize: 14 }}>Static fallback — coming in Phase J</p>
        </div>
      )}

      <HeroCopy setPage={setPage} />
    </div>
  );
}

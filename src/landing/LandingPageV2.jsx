// Thumbtown landing page — mount point.
//
// Phase 1 state: static placeholder. The scene compositor, 3D Frame, easter
// eggs, pricing island, and ambient motion all land in later phases as the
// Midjourney asset pipeline fills out (see src/landing/thumbtown/README.md).
//
// Navbar + Footer are reused as-is from the v1 components/layout/ tree —
// they were already Tailwind + framer-motion + lucide-react shells with
// ThumbFrame branding. No scroll content below yet; spec §8 Features /
// Pricing / FAQ / FinalCTA sections already exist under components/sections/
// and will mount in Phase 7.

import React from 'react';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './landing.built.css';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

function isLowEnd() {
  if (typeof navigator === 'undefined') return false;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) return true;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return true;
  return false;
}

export default function LandingPageV2({ setPage }) {
  const goTo = (target) => {
    if (typeof setPage === 'function') setPage(target);
    else window.location.href = '/' + target;
  };

  return (
    <div style={{ background: '#0a0714', color: '#f0e4d0', minHeight: '100vh' }}>
      <Navbar onNavigate={goTo} />

      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 clamp(24px, 6vw, 80px)',
          fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 640, textAlign: 'center' }}>
          <div
            style={{
              color: '#ffb060',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              marginBottom: 22,
            }}
          >
            Thumbframe
          </div>
          <h1
            style={{
              fontFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif",
              fontWeight: 450,
              fontSize: 'clamp(40px, 5vw, 62px)',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: '#f0e4d0',
              margin: 0,
              marginBottom: 22,
            }}
          >
            Every thumbnail<br />starts with a frame.
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.55,
              color: '#b8d4d0',
              margin: '0 auto',
              marginBottom: 34,
              maxWidth: 520,
            }}
          >
            Thumbtown is being painted. Step through the frame soon.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => goTo('signup')}
              style={{
                background: '#f97316',
                color: '#1a0a00',
                fontFamily: 'inherit',
                fontWeight: 600,
                fontSize: 15,
                padding: '14px 22px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                boxShadow:
                  '0 0 32px -4px rgba(249,115,22,0.55), 0 4px 16px rgba(249,115,22,0.28)',
              }}
            >
              Start free — no credit card
            </button>
            <button
              type="button"
              onClick={() => goTo('editor')}
              style={{
                background: 'transparent',
                color: '#f0e4d0',
                fontFamily: 'inherit',
                fontWeight: 500,
                fontSize: 15,
                padding: '13px 20px',
                borderRadius: 10,
                border: '1px solid rgba(240,228,208,0.35)',
                cursor: 'pointer',
              }}
            >
              Open Editor →
            </button>
          </div>
          {isLowEnd() && (
            <div style={{ marginTop: 48, fontSize: 12, color: '#8090a0' }}>
              (static fallback — low-end device detected)
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

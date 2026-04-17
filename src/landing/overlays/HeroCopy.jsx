// Scene 1 hero overlay — HTML layered on top of the 3D Canvas.
// Left half of the viewport, vertically centered.
// Fades in 200ms after mount over 600ms.
// Pinned while scene-1 local progress is in [0, 0.85]; fades out to 0 by 1.0.
// Rendered synchronously so markup is present in static HTML for SEO.

import React, { useEffect, useRef } from 'react';
import { getScrollOffset, scrollByViewport } from '../lib/scrollBridge';

// The Arrival scene occupies the first 1/7 of ScrollControls' 7 pages.
// Local scene progress = global offset * TOTAL_PAGES.
const TOTAL_PAGES = 7;
const FADE_OUT_START = 0.85;
const FADE_OUT_END = 1.0;
const FADE_IN_DELAY_MS = 200;
const FADE_IN_DURATION_MS = 600;

export default function HeroCopy({ setPage }) {
  const rootRef = useRef(null);
  const mountedAtRef = useRef(0);

  useEffect(() => {
    mountedAtRef.current = performance.now();
    let rafId = 0;

    const tick = () => {
      const el = rootRef.current;
      if (el) {
        const elapsed = performance.now() - mountedAtRef.current;
        const fadeIn = clamp((elapsed - FADE_IN_DELAY_MS) / FADE_IN_DURATION_MS, 0, 1);

        const sceneProgress = Math.min(getScrollOffset() * TOTAL_PAGES, 1);
        const fadeOut = 1 - clamp(
          (sceneProgress - FADE_OUT_START) / (FADE_OUT_END - FADE_OUT_START),
          0,
          1,
        );

        const opacity = fadeIn * fadeOut;
        el.style.opacity = String(opacity);
        // Stop receiving clicks once invisible so the ghost doesn't block.
        el.style.visibility = opacity < 0.02 ? 'hidden' : 'visible';
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleStartFree = () => {
    if (typeof setPage === 'function') {
      setPage('signup');
    } else {
      // Fallback if the overlay is used standalone.
      window.location.href = '/signup';
    }
  };

  const handleSeeGalaxy = (e) => {
    e.preventDefault();
    scrollByViewport();
  };

  return (
    <div
      ref={rootRef}
      aria-label="ThumbFrame hero"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        padding: '0 clamp(24px, 6vw, 80px)',
        pointerEvents: 'none', // wheel/touch pass through to ScrollControls
        opacity: 0, // starts hidden; rAF loop fades it in
        fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: '50%',
          maxWidth: 620,
          minWidth: 320,
          textShadow: '0 2px 20px rgba(10, 7, 20, 0.8)',
        }}
      >
        {/* Eyebrow */}
        <div
          style={{
            color: '#ffb060',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 22,
          }}
        >
          You are here.
        </div>

        {/* H1 — Fraunces serif */}
        <h1
          style={{
            fontFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif",
            fontWeight: 450,
            fontSize: 'clamp(36px, 4.3vw, 56px)',
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
            color: '#f0e4d0',
            margin: 0,
            marginBottom: 24,
          }}
        >
          Every thumbnail is a universe.
          <br />
          Most editors are the wrong map.
        </h1>

        {/* Subhead */}
        <p
          style={{
            fontSize: 18,
            lineHeight: 1.55,
            color: '#b8d4d0',
            margin: 0,
            marginBottom: 34,
            maxWidth: 540,
          }}
        >
          ThumbFrame is the editor built for the one image that decides
          whether anyone clicks play. AI generation. CTR scoring.
          Painted with care.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleStartFree}
            style={ctaPrimaryStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, ctaPrimaryHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, ctaPrimaryStyle)}
          >
            Start free — no credit card
          </button>

          <button
            type="button"
            onClick={handleSeeGalaxy}
            style={ctaGhostStyle}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, ctaGhostHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, ctaGhostStyle)}
          >
            See the galaxy ↓
          </button>
        </div>
      </div>
    </div>
  );
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Button styles extracted so hover can swap cleanly without stomping transition.
const ctaPrimaryStyle = {
  pointerEvents: 'auto',
  background: '#f97316',
  color: '#1a0a00',
  fontFamily: 'inherit',
  fontWeight: 600,
  fontSize: 15,
  letterSpacing: '0.005em',
  padding: '14px 22px',
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  boxShadow:
    '0 0 32px -4px rgba(249, 115, 22, 0.55), 0 4px 16px rgba(249, 115, 22, 0.28)',
  transform: 'translateY(0)',
  transition: 'transform 160ms ease, box-shadow 160ms ease',
};

const ctaPrimaryHover = {
  ...ctaPrimaryStyle,
  transform: 'translateY(-1px)',
  boxShadow:
    '0 0 44px -2px rgba(249, 115, 22, 0.75), 0 6px 22px rgba(249, 115, 22, 0.38)',
};

const ctaGhostStyle = {
  pointerEvents: 'auto',
  background: 'transparent',
  color: '#f0e4d0',
  fontFamily: 'inherit',
  fontWeight: 500,
  fontSize: 15,
  padding: '13px 20px',
  borderRadius: 10,
  border: '1px solid rgba(240, 228, 208, 0.35)',
  cursor: 'pointer',
  transition: 'border-color 160ms ease, background 160ms ease',
};

const ctaGhostHover = {
  ...ctaGhostStyle,
  borderColor: 'rgba(240, 228, 208, 0.65)',
  background: 'rgba(240, 228, 208, 0.06)',
};

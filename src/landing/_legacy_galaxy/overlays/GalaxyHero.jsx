// v3 galaxy-overview hero overlay. Always present, fades to 0 while a
// planet is active (v3 §4.1). Copy matches v3 §3 verbatim.

import React, { useEffect, useRef } from 'react';
import { useGalaxyStore } from '../state/galaxyStore';

export default function GalaxyHero({ setPage }) {
  const rootRef = useRef(null);

  useEffect(() => {
    // Imperative rAF opacity so we don't re-render React on every frame.
    let rafId = 0;
    const tick = () => {
      const el = rootRef.current;
      if (el) {
        const s = useGalaxyStore.getState();
        // Overview idle = 1; during entering / on-planet / exiting = 0.
        const active = s.transitionState !== 'idle';
        // Also hide while tour-mode is running.
        const target = (active || s.tourMode) ? 0 : 1;
        const current = parseFloat(el.style.opacity || '1');
        const next = current + (target - current) * 0.10;
        el.style.opacity = String(next);
        el.style.visibility = next < 0.02 ? 'hidden' : 'visible';
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const startFree = () => {
    if (typeof setPage === 'function') setPage('signup');
    else window.location.href = '/signup';
  };
  const takeTour = () => {
    useGalaxyStore.getState().startTour();
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
        pointerEvents: 'none',
        opacity: 1,
        fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ width: '48%', maxWidth: 640, minWidth: 320, textShadow: '0 2px 20px rgba(10,7,20,0.8)' }}>
        <div style={{ color: '#ffb060', fontSize: 12, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 22 }}>
          Thumbframe
        </div>
        <h1 style={{
          fontFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif",
          fontWeight: 450,
          fontSize: 'clamp(38px, 4.6vw, 58px)',
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          color: '#f0e4d0',
          margin: 0,
          marginBottom: 18,
        }}>
          An out-of-this-world<br />thumbnail editor.
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.45, color: '#9ab0ad', margin: 0, marginBottom: 16, maxWidth: 560, fontStyle: 'italic' }}>
          Every thumbnail tool was built for something else. This one isn't.
        </p>
        <p style={{ fontSize: 18, lineHeight: 1.55, color: '#b8d4d0', margin: 0, marginBottom: 34, maxWidth: 560 }}>
          Click any planet to explore. Or scroll to take the tour.<br />
          AI generation, CTR scoring, A/B variants — built for YouTubers.
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <button type="button" onClick={startFree} style={ctaPrimary}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, ctaPrimaryHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, ctaPrimary)}>
            Start free — no credit card
          </button>
          <button type="button" onClick={takeTour} style={ctaGhost}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, ctaGhostHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, ctaGhost)}>
            Take the tour ↓
          </button>
        </div>
      </div>
    </div>
  );
}

const ctaPrimary = {
  pointerEvents: 'auto',
  background: '#f97316',
  color: '#1a0a00',
  fontFamily: 'inherit',
  fontWeight: 600,
  fontSize: 15,
  padding: '14px 22px',
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 0 32px -4px rgba(249,115,22,0.55), 0 4px 16px rgba(249,115,22,0.28)',
  transform: 'translateY(0)',
  transition: 'transform 160ms ease, box-shadow 160ms ease',
};
const ctaPrimaryHover = { ...ctaPrimary, transform: 'translateY(-1px)',
  boxShadow: '0 0 44px -2px rgba(249,115,22,0.75), 0 6px 22px rgba(249,115,22,0.38)' };
const ctaGhost = {
  pointerEvents: 'auto',
  background: 'transparent',
  color: '#f0e4d0',
  fontFamily: 'inherit',
  fontWeight: 500,
  fontSize: 15,
  padding: '13px 20px',
  borderRadius: 10,
  border: '1px solid rgba(240,228,208,0.35)',
  cursor: 'pointer',
  transition: 'border-color 160ms ease, background 160ms ease',
};
const ctaGhostHover = { ...ctaGhost, borderColor: 'rgba(240,228,208,0.65)', background: 'rgba(240,228,208,0.06)' };

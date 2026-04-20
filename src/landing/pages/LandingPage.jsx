// LandingPage — the "/" route.
//
// Composes:
//   • LandingScene as full-viewport fixed background (z:0)
//   • Navbar sitting on top (z:50, transparent)
//   • Hero overlay: eyebrow + H1 + subhead + dual CTAs, top-left, ~30%
//     viewport width per spec §2.
//
// CTA route logic is Phase 3 — for now the handlers accept a setPage
// prop (matches existing App.js navigation) and fall back to
// window.location when the prop isn't wired.

import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/layout/Navbar';
import LandingScene from '../scenes/LandingScene';
import { heroFade } from '../lib/motion';

function HeroOverlay({ onStartFree, onOpenEditor }) {
  return (
    <div
      aria-label="ThumbFrame hero"
      className="absolute top-16 left-0 z-20 pointer-events-none"
      style={{
        padding: '0 clamp(24px, 5vw, 64px)',
        fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
      }}
    >
      <div
        className="max-w-md"
        style={{
          textShadow:
            '0 2px 24px rgba(10, 6, 20, 0.95), 0 0 6px rgba(10, 6, 20, 0.85)',
        }}
      >
        <motion.div
          {...heroFade(0.10)}
          style={{
            color: '#ffb060',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}
        >
          Thumbframe
        </motion.div>

        <motion.h1
          {...heroFade(0.22)}
          style={{
            fontFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif",
            fontWeight: 450,
            fontSize: 'clamp(32px, 4.2vw, 54px)',
            lineHeight: 1.04,
            letterSpacing: '-0.02em',
            color: '#f5ebd4',
            margin: 0,
            marginBottom: 18,
          }}
        >
          An out-of-this-world<br />thumbnail editor.
        </motion.h1>

        <motion.p
          {...heroFade(0.32)}
          style={{
            fontSize: 16,
            lineHeight: 1.55,
            color: '#cfe6de',
            margin: 0,
            marginBottom: 26,
            maxWidth: 380,
          }}
        >
          AI generation, CTR scoring, A/B variants —
          built for YouTubers.
        </motion.p>

        <motion.div
          {...heroFade(0.42)}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap', pointerEvents: 'auto' }}
        >
          <button
            type="button"
            onClick={onStartFree}
            style={{
              background: '#f97316',
              color: '#1a0a00',
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: 15,
              padding: '13px 22px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              boxShadow:
                '0 0 28px -4px rgba(249, 115, 22, 0.55), 0 4px 14px rgba(249, 115, 22, 0.28)',
              transform: 'translateY(0)',
              transition: 'transform 160ms ease, box-shadow 160ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow =
                '0 0 40px -2px rgba(249, 115, 22, 0.75), 0 6px 20px rgba(249, 115, 22, 0.38)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow =
                '0 0 28px -4px rgba(249, 115, 22, 0.55), 0 4px 14px rgba(249, 115, 22, 0.28)';
            }}
          >
            Start free — no credit card
          </button>

          <button
            type="button"
            onClick={onOpenEditor}
            style={{
              background: 'transparent',
              color: '#f5ebd4',
              fontFamily: 'inherit',
              fontWeight: 500,
              fontSize: 15,
              padding: '12px 20px',
              borderRadius: 10,
              border: '1px solid rgba(245, 235, 212, 0.35)',
              cursor: 'pointer',
              transition: 'background 160ms ease, border-color 160ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(245, 235, 212, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(245, 235, 212, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(245, 235, 212, 0.35)';
            }}
          >
            Open Editor →
          </button>
        </motion.div>
      </div>
    </div>
  );
}

export default function LandingPage({ setPage }) {
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
      }}
    >
      <LandingScene />
      <Navbar onNavigate={goTo} />
      <HeroOverlay
        onStartFree={() => goTo('signup')}
        onOpenEditor={() => goTo('editor')}
      />
    </div>
  );
}

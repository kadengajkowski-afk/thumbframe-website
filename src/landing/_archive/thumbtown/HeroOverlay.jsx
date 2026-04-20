// HeroOverlay — top-left copy + primary CTA, rendered over the video.
//
// Copy per spec: eyebrow "THUMBFRAME", H1 "Every thumbnail / starts
// with a frame.", subhead "Step through.", and the signup CTA.
//
// Sits inside the thumbtown-hero section so the `warping` class on
// the section can fade this overlay out when the Frame warp transition
// begins (see styles/thumbtown.css — `.thumbtown-hero.warping
// .hero-overlay`).

import React from 'react';
import { motion } from 'framer-motion';
import { heroFade } from '../lib/motion';

export default function HeroOverlay({ onStartFree }) {
  return (
    <div
      aria-label="ThumbFrame hero"
      className="hero-overlay absolute top-16 left-0 z-20 pointer-events-none"
      style={{
        padding: '0 clamp(24px, 5vw, 64px)',
        fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
      }}
    >
      <div
        className="max-w-md"
        style={{ textShadow: '0 2px 24px rgba(20, 12, 28, 0.95), 0 0 6px rgba(20, 12, 28, 0.85)' }}
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
          Every thumbnail<br />starts with a frame.
        </motion.h1>

        <motion.p
          {...heroFade(0.32)}
          style={{
            fontSize: 16,
            lineHeight: 1.5,
            color: '#e6d5b8',
            margin: 0,
            marginBottom: 26,
            maxWidth: 340,
          }}
        >
          Step through.
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
        </motion.div>
      </div>
    </div>
  );
}

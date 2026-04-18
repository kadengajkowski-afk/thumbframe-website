// Scene 2 overlay — right-half viewport copy for the Problem Planet scene.
//
// Lifecycle (sceneIdx = scrollOffset * 7):
//   1.10 – 1.15   fade-in + 20px Y translate
//   1.15 – 1.80   hold
//   1.80 – 1.95   fade-out + reverse translate  (done before 2.00 peel)
//
// Rendered synchronously so markup is present in static HTML for SEO.

import React, { useEffect, useRef } from 'react';
import { getScrollOffset } from '../lib/scrollBridge';

const TOTAL_PAGES = 7;
const FADE_IN_START  = 1.10;
const FADE_IN_END    = 1.15;
const FADE_OUT_START = 1.80;
const FADE_OUT_END   = 1.95;
const Y_TRAVEL_PX    = 20;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default function ProblemCopy() {
  const rootRef = useRef(null);

  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      const el = rootRef.current;
      if (el) {
        const sceneIdx = getScrollOffset() * TOTAL_PAGES;
        const fadeIn  = clamp(
          (sceneIdx - FADE_IN_START) / (FADE_IN_END - FADE_IN_START), 0, 1,
        );
        const fadeOut = 1 - clamp(
          (sceneIdx - FADE_OUT_START) / (FADE_OUT_END - FADE_OUT_START), 0, 1,
        );
        const opacity = fadeIn * fadeOut;

        // Y-translate: +20px at fadeIn=0 easing to 0 at fadeIn=1, then reverses
        // (symmetric) as fadeOut ramps down. Exit drifts DOWN for "falling away."
        const yIn  = (1 - fadeIn)  * Y_TRAVEL_PX;
        const yOut = (1 - fadeOut) * Y_TRAVEL_PX;
        const translate = yIn + yOut;

        el.style.opacity = String(opacity);
        el.style.transform = `translateY(${translate}px)`;
        el.style.visibility = opacity < 0.02 ? 'hidden' : 'visible';
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      ref={rootRef}
      aria-label="Scene 2 — The dead planet"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 clamp(24px, 6vw, 80px)',
        pointerEvents: 'none',
        opacity: 0,
        transform: `translateY(${Y_TRAVEL_PX}px)`,
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
        {/* Eyebrow — amber */}
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
          Chapter 1 — The dead planet
        </div>

        {/* H2 — Fraunces serif */}
        <h2
          style={{
            fontFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif",
            fontWeight: 450,
            fontSize: 'clamp(32px, 3.4vw, 44px)',
            lineHeight: 1.12,
            letterSpacing: '-0.01em',
            color: '#f0e4d0',
            margin: 0,
            marginBottom: 28,
          }}
        >
          Every thumbnail tool was built for something else.
        </h2>

        {/* Three lines — Inter, teal-mist */}
        <div
          style={{
            color: '#b8d4d0',
            fontSize: 16,
            lineHeight: 1.6,
            marginBottom: 26,
          }}
        >
          <p style={{ margin: 0, marginBottom: 6 }}>
            Canva was built for everything. That's the problem.
          </p>
          <p style={{ margin: 0, marginBottom: 6 }}>
            Photoshop was built for magazines in 1988.
          </p>
          <p style={{ margin: 0 }}>
            Photopea was built to imitate Photoshop in 2013. It shows.
          </p>
        </div>

        {/* Tag line — orange-core */}
        <div
          style={{
            color: '#f97316',
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '0.01em',
          }}
        >
          ThumbFrame is built for exactly one thing.
        </div>
      </div>
    </div>
  );
}

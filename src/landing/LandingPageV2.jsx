// Landing placeholder — Phase 1 archive/cleanup complete, Phase 2 will
// restore the real scene (purple nebula + ship) per the multi-page space
// theme spec. Thumbtown code has been archived under
// src/landing/_archive/thumbtown.

import React from 'react';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './landing.built.css';

export default function LandingPageV2() {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0614',
        color: '#e8d8ff',
        fontFamily: '"Inter Variable", Inter, system-ui, sans-serif',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 560 }}>
        <div
          style={{
            fontSize: '0.75rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#c86020',
            marginBottom: '1rem',
          }}
        >
          ThumbFrame
        </div>
        <h1
          style={{
            fontFamily: '"Fraunces Variable", Fraunces, serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 500,
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          Landing page — rebuild in progress.
        </h1>
        <p style={{ opacity: 0.7, marginTop: '1.25rem', fontSize: '1rem' }}>
          Multi-page space theme incoming.
        </p>
      </div>
    </div>
  );
}

// Dev-only scroll position overlay. Enabled with ?dbg=1 on the URL.
// Shows current scroll.offset, sceneIdx, and which choreography phase is
// active. Imperative text updates via rAF so it never triggers a React
// re-render (stays out of the way of the main scene).

import React, { useEffect, useRef } from 'react';
import { getScrollOffset } from '../lib/scrollBridge';

// Phase boundaries lifted from Arrival.jsx + Wormhole.jsx camera rigs.
// Keep in sync if those change.
function phaseFor(sceneIdx) {
  if (sceneIdx < 0.85)  return 'arrival · station';
  if (sceneIdx < 1.00)  return 'arrival · arc past ship';
  if (sceneIdx < 1.95)  return 'arrival · fly to wormhole';
  if (sceneIdx < 2.50)  return 'wormhole · step 1 approach';
  if (sceneIdx < 2.67)  return 'wormhole · plunge (disc scale)';
  if (sceneIdx < 3.10)  return 'wormhole · step 2 tunnel travel';
  if (sceneIdx < 3.20)  return 'wormhole · step 3 tags falling';
  if (sceneIdx < 3.50)  return 'wormhole · step 3 tags warping';
  if (sceneIdx < 3.80)  return 'wormhole · step 4 editor approach';
  if (sceneIdx < 3.95)  return 'wormhole · hold at editor';
  return '— unbuilt —';
}

export default function ScrollDebug() {
  const enabled =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('dbg') === '1';

  const offsetRef = useRef(null);
  const sceneRef  = useRef(null);
  const phaseRef  = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const tick = () => {
      const o = getScrollOffset();
      const s = o * 7;
      if (offsetRef.current) offsetRef.current.textContent = o.toFixed(4);
      if (sceneRef.current)  sceneRef.current.textContent  = s.toFixed(3);
      if (phaseRef.current)  phaseRef.current.textContent  = phaseFor(s);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  if (!enabled) return null;

  const labelStyle = {
    color: '#8a8aa0',
    fontWeight: 400,
    marginRight: 8,
  };
  const valueStyle = {
    color: '#f0e4d0',
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 1000,
        padding: '8px 12px',
        borderRadius: 6,
        background: 'rgba(10, 7, 20, 0.8)',
        border: '1px solid rgba(240, 228, 208, 0.18)',
        color: '#f0e4d0',
        fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, monospace",
        fontSize: 12,
        lineHeight: 1.45,
        pointerEvents: 'none',
        userSelect: 'none',
        minWidth: 220,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div>
        <span style={labelStyle}>offset</span>
        <span ref={offsetRef} style={valueStyle}>0.0000</span>
      </div>
      <div>
        <span style={labelStyle}>sceneIdx</span>
        <span ref={sceneRef} style={valueStyle}>0.000</span>
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: '#b8d4d0' }}>
        <span ref={phaseRef}>arrival · station</span>
      </div>
    </div>
  );
}

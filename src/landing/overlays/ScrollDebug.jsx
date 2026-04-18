// Dev-only overlay showing current galaxy-store state. Enabled with ?dbg=1.
// Imperative text updates via rAF so it doesn't re-render React.

import React, { useEffect, useRef } from 'react';
import { useGalaxyStore } from '../state/galaxyStore';

export default function ScrollDebug() {
  const enabled =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('dbg') === '1';

  const activeRef = useRef(null);
  const stateRef  = useRef(null);
  const progRef   = useRef(null);
  const hoverRef  = useRef(null);
  const tourRef   = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const tick = () => {
      const s = useGalaxyStore.getState();
      if (activeRef.current) activeRef.current.textContent = s.activePlanet || '—';
      if (stateRef.current)  stateRef.current.textContent  = s.transitionState;
      if (progRef.current)   progRef.current.textContent   = s.transitionProgress.toFixed(3);
      if (hoverRef.current)  hoverRef.current.textContent  = s.hoveredPlanet || '—';
      if (tourRef.current)   tourRef.current.textContent   = s.tourMode ? `tour ${s.tourScrollOffset.toFixed(2)}` : 'off';
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  if (!enabled) return null;

  const label = { color: '#8a8aa0', fontWeight: 400, marginRight: 8 };
  const value = { color: '#f0e4d0', fontVariantNumeric: 'tabular-nums' };

  return (
    <div style={{
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
      minWidth: 240,
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    }}>
      <div><span style={label}>active </span><span ref={activeRef} style={value}>—</span></div>
      <div><span style={label}>state  </span><span ref={stateRef}  style={value}>idle</span></div>
      <div><span style={label}>prog   </span><span ref={progRef}   style={value}>0.000</span></div>
      <div><span style={label}>hover  </span><span ref={hoverRef}  style={value}>—</span></div>
      <div><span style={label}>tour   </span><span ref={tourRef}   style={value}>off</span></div>
    </div>
  );
}

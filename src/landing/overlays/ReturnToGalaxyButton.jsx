// Top-left "← Return to galaxy" button. Visible whenever activePlanet is
// not null. Always listens for Esc.

import React, { useEffect, useRef } from 'react';
import { useGalaxyStore } from '../state/galaxyStore';

export default function ReturnToGalaxyButton() {
  const ref = useRef(null);

  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const s = useGalaxyStore.getState();
        const visible = s.activePlanet !== null;
        const target = visible ? 1 : 0;
        const current = parseFloat(el.style.opacity || '0');
        const next = current + (target - current) * 0.15;
        el.style.opacity = String(next);
        el.style.pointerEvents = next > 0.4 ? 'auto' : 'none';
        el.style.visibility = next < 0.02 ? 'hidden' : 'visible';
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleClick = () => {
    useGalaxyStore.getState().returnToGalaxy();
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      aria-label="Return to galaxy overview"
      style={{
        position: 'fixed',
        top: 18,
        left: 18,
        zIndex: 15,
        background: 'rgba(20, 12, 28, 0.55)',
        border: '1px solid rgba(240, 228, 208, 0.22)',
        color: '#f0e4d0',
        fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '0.04em',
        padding: '9px 14px',
        borderRadius: 10,
        cursor: 'pointer',
        opacity: 0,
        backdropFilter: 'blur(6px)',
        transition: 'background 160ms ease, border-color 160ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(40, 24, 52, 0.75)';
        e.currentTarget.style.borderColor = 'rgba(240, 228, 208, 0.55)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(20, 12, 28, 0.55)';
        e.currentTarget.style.borderColor = 'rgba(240, 228, 208, 0.22)';
      }}
    >
      ← Return to galaxy
    </button>
  );
}

// Scroll / auto-tour binding — v3 §5.
//
// Two trigger modes:
//   1. "Take the tour" CTA → startTour() → auto-plays the sequence on a
//      wall-clock timer. The user doesn't need to scroll.
//   2. Manual scroll-wheel/touch input while on galaxy overview → each
//      scroll delta advances a virtual 0..1 "tourScrollOffset"; planet
//      index is derived from ranges in v3 §5.
//
// Any click on a planet cancels the tour.

import { useEffect } from 'react';
import { useGalaxyStore } from '../state/galaxyStore';

const SCROLL_STEP = 0.0012;   // offset delta per pixel of wheel deltaY
const TOUCH_STEP  = 0.0020;   // offset delta per pixel of touchmove
const TOUR_DURATION_MS = 22000; // ~22s for the auto-play through all 5 planets

function planetForOffset(offset) {
  // v3 §5 mapping — planet index by scroll range.
  if (offset < 0.15) return null;
  if (offset < 0.30) return 'signal';
  if (offset < 0.45) return 'dead';
  if (offset < 0.65) return 'singularity';
  if (offset < 0.80) return 'docking';
  if (offset < 0.95) return 'science';
  return null;
}

export default function ScrollTour() {
  useEffect(() => {
    // ── Manual scroll / touch input ────────────────────────────────────
    const onWheel = (e) => {
      const s = useGalaxyStore.getState();
      // Only treat wheel as tour input when no planet is active. Active
      // state owns scroll context (for page-like scrolling within the
      // content overlay if needed).
      if (s.activePlanet !== null) return;

      e.preventDefault();
      const next = s.tourScrollOffset + e.deltaY * SCROLL_STEP;
      useGalaxyStore.getState().setTourScrollOffset(next);
      const target = planetForOffset(useGalaxyStore.getState().tourScrollOffset);
      if (target && s.activePlanet !== target) {
        useGalaxyStore.getState().goToPlanet(target);
      }
    };

    let touchY = 0;
    const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
    const onTouchMove = (e) => {
      const s = useGalaxyStore.getState();
      if (s.activePlanet !== null) return;
      const ny = e.touches[0].clientY;
      const delta = touchY - ny;
      touchY = ny;
      const next = s.tourScrollOffset + delta * TOUCH_STEP;
      useGalaxyStore.getState().setTourScrollOffset(next);
      const target = planetForOffset(useGalaxyStore.getState().tourScrollOffset);
      if (target && s.activePlanet !== target) {
        useGalaxyStore.getState().goToPlanet(target);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove',  onTouchMove,  { passive: true });

    // ── Auto-tour (CTA "Take the tour") ────────────────────────────────
    let tourTimer = null;
    const unsub = useGalaxyStore.subscribe((s, prev) => {
      // When tourMode flips on from off, kick off the auto-play sequence.
      if (s.tourMode && !prev.tourMode) {
        const start = performance.now();
        if (tourTimer) clearInterval(tourTimer);
        tourTimer = setInterval(() => {
          const tt = (performance.now() - start) / TOUR_DURATION_MS;
          if (tt >= 1.0) {
            clearInterval(tourTimer);
            tourTimer = null;
            useGalaxyStore.getState().returnToGalaxy();
            // Clear tourMode a beat later so goToPlanet doesn't fire
            // tour durations for the return-home path.
            setTimeout(() => {
              const cur = useGalaxyStore.getState();
              if (!cur.activePlanet) useGalaxyStore.setState({ tourMode: false, tourScrollOffset: 0 });
            }, 1400);
            return;
          }
          // Step through the 5 planets evenly, skipping the ~15% overview
          // head/tail per v3 §5.
          const t = 0.15 + tt * 0.80;
          const target = planetForOffset(t);
          const cur = useGalaxyStore.getState();
          if (target && cur.activePlanet !== target) {
            useGalaxyStore.getState().goToPlanet(target);
          }
          useGalaxyStore.getState().setTourScrollOffset(t);
        }, 60);
      }
      if (!s.tourMode && tourTimer) {
        clearInterval(tourTimer);
        tourTimer = null;
      }
    });

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove',  onTouchMove);
      if (tourTimer) clearInterval(tourTimer);
      unsub();
    };
  }, []);

  return null;
}

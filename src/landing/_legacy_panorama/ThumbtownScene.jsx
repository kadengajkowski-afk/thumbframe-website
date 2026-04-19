// Thumbtown scene — simplified hybrid-animated hero.
//
// Layers (back to front):
//   1. panorama.png as an <img> filling the viewport, object-cover,
//      Ken Burns animation via CSS.
//   2. <SceneOverlay/> — SVG cloud wisps + birds + DIV sun glow.
//
// Nav + WorldHero are mounted separately by LandingPageV2.jsx.
//
// Performance hooks:
//   • Page Visibility API pauses all animations when the tab hides
//     (avoids mobile battery drain in background tabs).
//   • IntersectionObserver pauses all animations when the hero
//     scrolls off-screen (Phase 7 will add scroll content below).
//
// Both hooks target every element carrying the `ambient-animated`
// class (panorama image, all SVG wisps + birds, sun-glow div).

import React, { useEffect, useRef } from 'react';
import SceneOverlay from './SceneOverlay';
import './styles/hero-animations.css';

const PANORAMA_SRC = '/assets/thumbtown/panorama.png';

export default function ThumbtownScene() {
  const heroRef = useRef(null);

  // ── Page Visibility: pause animations when the tab is hidden ──
  useEffect(() => {
    const setPlayState = (state) => {
      const els = document.querySelectorAll('.ambient-animated');
      els.forEach((el) => {
        el.style.animationPlayState = state;
      });
    };
    const onVisibility = () => {
      setPlayState(document.hidden ? 'paused' : 'running');
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // ── IntersectionObserver: pause when hero scrolls off-screen ──
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const state = entry.isIntersecting ? 'running' : 'paused';
        document.querySelectorAll('.ambient-animated').forEach((el) => {
          el.style.animationPlayState = state;
        });
      },
      { threshold: 0.1 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={heroRef}
      className="thumbtown-hero"
      aria-hidden
      style={{ background: '#18101c' }}
    >
      <img
        src={PANORAMA_SRC}
        alt=""
        draggable={false}
        className="ken-burns-image ambient-animated"
      />
      <SceneOverlay />
    </div>
  );
}

// ThumbtownScene — looping Midjourney panorama video as a
// full-viewport ambient hero. That's it. The nav bar carries the
// Open Editor CTA; this section is purely atmospheric.
//
// useAmbientPause pauses the video when the tab is hidden or the
// hero scrolls off-screen. VideoHero itself handles the
// prefers-reduced-motion fallback (static poster).

import React, { useRef } from 'react';
import VideoHero from './VideoHero';
import { useAmbientPause } from './hooks/useAmbientPause';
import './styles/thumbtown.css';

export default function ThumbtownScene() {
  const videoRef = useRef(null);
  useAmbientPause(videoRef);

  return (
    <section
      className="thumbtown-hero"
      aria-label="Thumbtown landing scene"
    >
      <VideoHero ref={videoRef} />
    </section>
  );
}

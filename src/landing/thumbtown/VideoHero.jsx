// VideoHero — full-viewport looping background video.
//
// A Midjourney-generated painterly panorama loop (H.264, muted, no
// audio, loops cleanly). Plays inline on iOS via the
// autoPlay + muted + playsInline triad. Shows panorama-poster.jpg
// while loading, and permanently on iOS Low Power Mode when
// autoplay is blocked.
//
// `prefers-reduced-motion: reduce` users see only the poster — no
// video loop, no motion. The poster is high quality so the scene
// still looks intentional.

import React, { forwardRef } from 'react';

const VIDEO_WEBM = '/assets/thumbtown/panorama.webm';
const VIDEO_MP4  = '/assets/thumbtown/panorama.mp4';
const POSTER_SRC = '/assets/thumbtown/panorama-poster.jpg';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const VideoHero = forwardRef(function VideoHero(_props, ref) {
  if (prefersReducedMotion) {
    return (
      <img
        src={POSTER_SRC}
        alt=""
        className="video-hero video-hero-poster"
        draggable={false}
      />
    );
  }

  return (
    <video
      ref={ref}
      className="video-hero"
      autoPlay
      loop
      muted
      playsInline
      disablePictureInPicture
      controlsList="nodownload noplaybackrate nofullscreen"
      onContextMenu={(e) => e.preventDefault()}
      poster={POSTER_SRC}
      preload="auto"
      aria-hidden
    >
      {/* WebM first — Chrome/Firefox/Edge pick it for sharper compression.
          Safari falls through to the MP4. */}
      <source src={VIDEO_WEBM} type="video/webm" />
      <source src={VIDEO_MP4}  type="video/mp4" />
    </video>
  );
});

export default VideoHero;

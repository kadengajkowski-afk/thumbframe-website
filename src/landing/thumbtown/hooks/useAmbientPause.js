// useAmbientPause — pauses the hero video when the tab is hidden or
// the hero section scrolls off-screen. Resumes when visible again.
//
// `.play()` returns a promise that browsers reject in various states
// (tab hidden, autoplay policy changes, etc). We swallow those
// rejections so they don't surface as console errors.

import { useEffect } from 'react';

export function useAmbientPause(videoRef) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const safePlay = () => {
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };

    const onVisibilityChange = () => {
      if (document.hidden) video.pause();
      else safePlay();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    let observer;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) safePlay();
          else video.pause();
        },
        { threshold: 0.1 },
      );
      observer.observe(video);
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (observer) observer.disconnect();
    };
  }, [videoRef]);
}

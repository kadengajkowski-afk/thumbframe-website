import { useEffect, useRef } from "react";

/** Day 58 — crisp stardust overlay that sits BEHIND the editor grid
 * but IN FRONT of the body bg (the baked painterly nebula). Vanilla
 * canvas2D — no Three.js, no shaders, no bundle weight. Keeps stars
 * sharp at any zoom (vs being Kuwahara-quantized when baked into the
 * nebula PNG).
 *
 * Architecture (locked, from DEFERRED Day 57 redo plan):
 *   - position: fixed, inset: 0
 *   - z-index: 0 (behind editor grid, above body bg)
 *   - pointer-events: none (cannot intercept clicks on the editor)
 *   - NEVER mounted inside canvasSurface or any editor-grid descendant
 *
 * 150 cream stars, varied sizes (0.5-2.5 px) and opacities (40-90%),
 * very slow drift (~0.02 px/s on each axis, twinkles ~5s period).
 * Animation pauses when the tab is hidden (visibilitychange) so we
 * don't burn CPU in background tabs. */

type Star = {
  x: number;
  y: number;
  r: number;       // radius in px
  a: number;       // base alpha 0..1
  twinkle: number; // 0..2π phase
  vx: number;
  vy: number;
};

const STAR_COUNT = 150;
const CREAM = "#fff4e0";

function seedStars(w: number, h: number): Star[] {
  const stars: Star[] = [];
  // Deterministic per-mount via a seeded PRNG so the constellation
  // looks the same on every refresh.
  let seed = 0x57bACE;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) / 0xffffffff);
  };
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: rand() * w,
      y: rand() * h,
      r: 0.5 + rand() * 2.0,
      a: 0.4 + rand() * 0.5,
      twinkle: rand() * Math.PI * 2,
      vx: (rand() - 0.5) * 0.04,
      vy: (rand() - 0.5) * 0.04,
    });
  }
  return stars;
}

export function EditorBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    let dpr = window.devicePixelRatio || 1;
    let stars: Star[] = seedStars(w, h);

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      dpr = window.devicePixelRatio || 1;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Reseed on resize so stars don't bunch in old viewport bounds.
      stars = seedStars(w, h);
    }
    resize();

    let last = performance.now();
    let running = true;
    function frame(now: number) {
      if (!running) return;
      const dt = Math.min(50, now - last) / 1000; // seconds, clamp to 50ms
      last = now;
      ctx!.clearRect(0, 0, w, h);
      for (const s of stars) {
        // Drift + wrap.
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x += w;
        else if (s.x > w) s.x -= w;
        if (s.y < 0) s.y += h;
        else if (s.y > h) s.y -= h;
        // Twinkle: slow sine modulation on alpha.
        s.twinkle += dt * 0.6;
        const a = s.a * (0.7 + 0.3 * Math.sin(s.twinkle));
        ctx!.globalAlpha = a;
        ctx!.fillStyle = CREAM;
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    function onVisibility() {
      if (document.hidden) {
        running = false;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      } else if (!running) {
        running = true;
        last = performance.now();
        rafRef.current = requestAnimationFrame(frame);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-alive="stardust"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}

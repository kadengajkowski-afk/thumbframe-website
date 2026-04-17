import React, { useRef, useEffect } from 'react';

export default function StarField() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rafId;
    let paused = false;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = window.innerWidth  * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width  = window.innerWidth  + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const stars = Array.from({ length: 230 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: 0.5 + Math.random() * 1,
      baseAlpha: 0.3 + Math.random() * 0.5,
      twinkleOffset: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.04,
    }));

    const shootingStars = [];
    let nextShoot = performance.now() + 8000 + Math.random() * 6000;

    function render(t) {
      if (paused) { rafId = requestAnimationFrame(render); return; }

      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        const alpha = prefersReduced ? s.baseAlpha : s.baseAlpha + Math.sin(t * 0.001 * s.speed * 25 + s.twinkleOffset) * 0.2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, Math.min(1, alpha))})`;
        ctx.fill();
      }

      if (!prefersReduced) {
        if (t > nextShoot) {
          shootingStars.push({
            x: Math.random() * w * 0.8,
            y: Math.random() * h * 0.3,
            vx: 4 + Math.random() * 3,
            vy: 2 + Math.random() * 2,
            life: 0,
            maxLife: 600,
          });
          nextShoot = t + 8000 + Math.random() * 6000;
        }

        for (let i = shootingStars.length - 1; i >= 0; i--) {
          const ss = shootingStars[i];
          ss.life += 16;
          ss.x += ss.vx;
          ss.y += ss.vy;
          const progress = ss.life / ss.maxLife;
          const alpha = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;
          ctx.beginPath();
          ctx.moveTo(ss.x, ss.y);
          ctx.lineTo(ss.x - ss.vx * 8, ss.y - ss.vy * 8);
          ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, alpha * 0.6)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          if (ss.life >= ss.maxLife) shootingStars.splice(i, 1);
        }
      }

      rafId = requestAnimationFrame(render);
    }

    resize();
    rafId = requestAnimationFrame(render);

    let resizeTimer;
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 200); };
    const onVisibility = () => { paused = document.hidden; };

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: -10 }}
      aria-hidden="true"
    />
  );
}

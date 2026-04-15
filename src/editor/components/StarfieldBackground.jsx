// src/editor/components/StarfieldBackground.jsx
// Animated starfield canvas rendered behind the PixiJS editor canvas.
// 150 white drift stars + 10 orange/amber glow particles.

import React, { useRef, useEffect } from 'react';

export default function StarfieldBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W = 0, H = 0;
    let raf;
    let stars = [], glows = [];

    const GLOW_COLORS = ['249,115,22', '251,146,60', '234,179,8'];

    function init(w, h) {
      W = w; H = h;
      stars = Array.from({ length: 150 }, () => ({
        x:    Math.random() * W,
        y:    Math.random() * H,
        r:    0.4 + Math.random() * 1.4,
        op:   0.25 + Math.random() * 0.50,
        dx:   (Math.random() - 0.5) * 0.07,
        dy:   (Math.random() - 0.5) * 0.05,
        twSpeed: 0.003 + Math.random() * 0.004,
        phase:   Math.random() * Math.PI * 2,
      }));
      glows = Array.from({ length: 10 }, () => ({
        x:    Math.random() * W,
        y:    Math.random() * H,
        r:    3 + Math.random() * 4,
        op:   0.06 + Math.random() * 0.10,
        dx:   (Math.random() - 0.5) * 0.035,
        dy:   (Math.random() - 0.5) * 0.028,
        color: GLOW_COLORS[Math.floor(Math.random() * GLOW_COLORS.length)],
        pulseSpeed: 0.001 + Math.random() * 0.002,
        phase: Math.random() * Math.PI * 2,
      }));
    }

    // Resize observer — reinits star positions when container changes size
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = Math.round(e.contentRect.width);
        const h = Math.round(e.contentRect.height);
        if (w > 0 && h > 0) {
          canvas.width  = w;
          canvas.height = h;
          init(w, h);
        }
      }
    });
    const parent = canvas.parentElement;
    if (parent) ro.observe(parent);
    // Initial size
    const iw = canvas.offsetWidth  || parent?.offsetWidth  || 800;
    const ih = canvas.offsetHeight || parent?.offsetHeight || 600;
    canvas.width  = iw;
    canvas.height = ih;
    init(iw, ih);

    let t = 0;
    const draw = () => {
      t++;
      ctx.clearRect(0, 0, W, H);

      // White drift stars
      for (const s of stars) {
        s.x = ((s.x + s.dx) % W + W) % W;
        s.y = ((s.y + s.dy) % H + H) % H;
        const alpha = Math.max(0.05, s.op + Math.sin(t * s.twSpeed + s.phase) * 0.14);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
        ctx.fill();
      }

      // Orange/amber glow blobs
      for (const g of glows) {
        g.x = ((g.x + g.dx) % W + W) % W;
        g.y = ((g.y + g.dy) % H + H) % H;
        const alpha = Math.max(0.01, g.op + Math.sin(t * g.pulseSpeed + g.phase) * 0.03);
        const spread = g.r * 5;
        const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, spread);
        grad.addColorStop(0,   `rgba(${g.color},${alpha.toFixed(3)})`);
        grad.addColorStop(0.4, `rgba(${g.color},${(alpha * 0.35).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(${g.color},0)`);
        ctx.beginPath();
        ctx.arc(g.x, g.y, spread, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}

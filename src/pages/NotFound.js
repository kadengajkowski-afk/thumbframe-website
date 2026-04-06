import React, { useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';

export default function NotFound({ setPage }) {
  const canvasRef = useRef(null);

  useSEO({
    title: '404 — Page Not Found | ThumbFrame',
    description: "This page doesn't exist. But your next thumbnail could.",
  });

  // Animated particle background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let w, h;

    function resize() {
      w = canvas.width  = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const COUNT = 60;
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + 0.4,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.4 + 0.1,
    }));

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(249,115,22,${p.alpha})`;
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
      }
      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <style>{`
        .tf-404-page {
          background: var(--bg-primary);
          min-height: 100vh;
          color: var(--text-primary);
          font-family: var(--font-body);
        }
        .tf-404-hero {
          position: relative;
          min-height: calc(100vh - 200px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 120px 24px 80px;
          overflow: hidden;
        }
        .tf-404-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .tf-404-number {
          font-size: clamp(120px, 20vw, 220px);
          font-weight: 900;
          letter-spacing: -0.05em;
          line-height: 1;
          color: var(--accent);
          font-family: var(--font-display);
          position: relative;
          margin-bottom: 16px;
          text-shadow: 0 0 80px rgba(249,115,22,0.3);
        }
        .tf-404-headline {
          font-size: clamp(18px, 3vw, 28px);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin-bottom: 14px;
          position: relative;
          max-width: 500px;
        }
        .tf-404-sub {
          font-size: 16px;
          color: var(--text-secondary);
          margin-bottom: 40px;
          position: relative;
        }
        .tf-404-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
          position: relative;
        }
        .tf-404-btn-primary {
          padding: 12px 28px;
          border-radius: 8px;
          border: none;
          background: var(--accent);
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          font-family: var(--font-body);
          transition: opacity 0.15s, transform 0.15s;
          min-height: 44px;
        }
        .tf-404-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .tf-404-btn-secondary {
          padding: 12px 28px;
          border-radius: 8px;
          border: 1px solid var(--border-hover);
          background: transparent;
          color: var(--text-secondary);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          font-family: var(--font-body);
          transition: border-color 0.15s, color 0.15s;
          min-height: 44px;
        }
        .tf-404-btn-secondary:hover { border-color: var(--accent); color: var(--accent); }

        @media (prefers-reduced-motion: reduce) {
          .tf-404-canvas { display: none; }
        }
      `}</style>
      <div className="tf-404-page">
        <Navbar setPage={setPage} currentPage="404" />

        <div className="tf-404-hero">
          <canvas ref={canvasRef} className="tf-404-canvas" aria-hidden="true" />
          <div className="tf-404-number">404</div>
          <h1 className="tf-404-headline">
            This page doesn't exist.<br />But your next thumbnail could.
          </h1>
          <p className="tf-404-sub">
            Whatever you were looking for, it isn't here.
          </p>
          <div className="tf-404-actions">
            <button className="tf-404-btn-primary" onClick={() => setPage('home')}>
              Go Home
            </button>
            <button className="tf-404-btn-secondary" onClick={() => setPage('editor')}>
              Open Editor
            </button>
          </div>
        </div>

        <Footer setPage={setPage} />
      </div>
    </>
  );
}

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';

export default function NotFound({ setPage }) {
  const canvasRef = useRef(null);

  useSEO({
    title: '404 — Thumbnail Not Found | ThumbFrame',
    description: "This thumbnail doesn't exist. But your next one could.",
  });

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

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + 0.4,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.35 + 0.05,
    }));

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,107,0,${p.alpha})`;
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
    <div style={{ background: '#050507', minHeight: '100vh', fontFamily: "'Satoshi', sans-serif", color: '#f0f0f3' }}>
      <Navbar setPage={setPage} currentPage="404" />

      <div style={{
        position: 'relative',
        minHeight: 'calc(100vh - 200px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '120px 24px 80px',
        overflow: 'hidden',
      }}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
          }}
        />

        {/* Orange glow orb */}
        <div style={{
          position: 'absolute', top: '40%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400, height: 200,
          background: 'radial-gradient(ellipse, rgba(255,107,0,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: 'relative' }}
        >
          {/* 404 number */}
          <div style={{
            fontSize: 'clamp(100px, 18vw, 200px)',
            fontWeight: 900,
            letterSpacing: '-0.05em',
            lineHeight: 1,
            color: '#FF6B00',
            marginBottom: 12,
            textShadow: '0 0 80px rgba(255,107,0,0.3)',
          }}>
            404
          </div>

          {/* Thumbnail strip gag */}
          <div style={{
            display: 'flex', gap: 6, justifyContent: 'center',
            marginBottom: 32,
          }}>
            {['???', '???', '???'].map((t, i) => (
              <div key={i} style={{
                width: 64, height: 36, borderRadius: 5,
                background: 'rgba(255,107,0,0.06)',
                border: '1px solid rgba(255,107,0,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#55555e', fontWeight: 700,
                letterSpacing: '0.06em',
              }}>
                {t}
              </div>
            ))}
          </div>

          <h1 style={{
            fontSize: 'clamp(20px, 3vw, 30px)',
            fontWeight: 800, letterSpacing: '-0.02em',
            margin: '0 0 14px', color: '#f0f0f3',
          }}>
            Thumbnail not found.
          </h1>

          <p style={{
            fontSize: 16, color: '#8a8a93',
            margin: '0 0 8px', lineHeight: 1.65,
          }}>
            This page got background-removed a little too hard.
          </p>
          <p style={{
            fontSize: 14, color: '#55555e',
            margin: '0 0 40px',
          }}>
            But your next thumbnail? That's still very much makeable.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setPage('home'); window.scrollTo({ top: 0 }); }}
              style={{
                padding: '12px 28px', borderRadius: 10, border: 'none',
                background: '#FF6B00', color: '#fff', cursor: 'pointer',
                fontSize: 14, fontWeight: 700, fontFamily: "'Satoshi', sans-serif",
                boxShadow: '0 0 24px rgba(255,107,0,0.25)',
              }}
            >
              Go Home →
            </button>
            <button
              onClick={() => { setPage('editor'); window.scrollTo({ top: 0 }); }}
              style={{
                padding: '12px 22px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent', color: '#8a8a93',
                cursor: 'pointer', fontSize: 14, fontWeight: 600,
                fontFamily: "'Satoshi', sans-serif",
              }}
            >
              Make a Thumbnail
            </button>
          </div>
        </motion.div>
      </div>

      <Footer setPage={setPage} />
    </div>
  );
}

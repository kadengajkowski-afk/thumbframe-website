// src/editor/components/StarfieldBackground.jsx
// Animated starfield — 160 background stars with twinkle + occasional shooting stars.

import React, { useRef, useEffect } from 'react';

const rand = (lo, hi) => lo + Math.random() * (hi - lo);

// ─────────────────────────────────────────────────────────────────────────────
// ShootingStar
// ─────────────────────────────────────────────────────────────────────────────
class ShootingStar {
  constructor(canvasW, canvasH) {
    this.reset(canvasW, canvasH);
  }

  reset(canvasW, canvasH) {
    const spawnZone = Math.random();

    if (spawnZone < 0.5) {
      // Spawn across entire top edge
      this.x = Math.random() * canvasW;
      this.y = -10;
      // Travel downward at varied angles
      this.angle = (200 + Math.random() * 60) * Math.PI / 180; // 200-260 degrees
    } else if (spawnZone < 0.8) {
      // Spawn along entire right edge
      this.x = canvasW + 10;
      this.y = Math.random() * canvasH;
      // Travel left-downward
      this.angle = (195 + Math.random() * 40) * Math.PI / 180; // 195-235 degrees
    } else {
      // Spawn along top-left area too
      this.x = Math.random() * canvasW * 0.4;
      this.y = -10;
      // Travel more steeply downward
      this.angle = (230 + Math.random() * 40) * Math.PI / 180; // 230-270 degrees
    }

    // Vary speed more — slow dreamy ones and fast streaks
    this.speed = 300 + Math.random() * 600;
    this.tailLength = 50 + Math.random() * 100;
    this.isOrange = Math.random() < 0.3;
    this.isBright = Math.random() < 0.2;
    this.brightness = this.isBright ? 1.0 : 0.4 + Math.random() * 0.5;
    this.headSize = this.isBright ? 2.5 : 1.2 + Math.random() * 1.2;
    this.alive = true;
    this.canvasW = canvasW;
    this.canvasH = canvasH;
  }

  update(dt) {
    const dist = this.speed * dt / 1000;
    this.x += Math.cos(this.angle) * dist;
    this.y += Math.sin(this.angle) * dist;
    if (this.x < -200 || this.y > this.canvasH + 200) {
      this.alive = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const color = this.isOrange ? [249, 115, 22] : [255, 255, 255];
    const tailColor = this.isOrange ? [249, 115, 22] : [200, 220, 255];
    const tailEndX = this.x - Math.cos(this.angle) * this.tailLength;
    const tailEndY = this.y - Math.sin(this.angle) * this.tailLength;
    const grad = ctx.createLinearGradient(this.x, this.y, tailEndX, tailEndY);
    grad.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${this.brightness})`);
    grad.addColorStop(0.4, `rgba(${tailColor[0]}, ${tailColor[1]}, ${tailColor[2]}, ${this.brightness * 0.3})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = this.headSize * 0.8;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(tailEndX, tailEndY);
    ctx.stroke();
    const headGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.headSize * 4);
    headGrad.addColorStop(0, `rgba(255, 255, 255, ${this.brightness})`);
    headGrad.addColorStop(0.3, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${this.brightness * 0.6})`);
    headGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.headSize * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function StarfieldBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const GLOW_COLORS = ['249,115,22', '251,146,60', '234,179,8'];

    // ── Mutable state — only valid after initStars() ───────────────────────
    let initialized = false;
    let W = 0, H = 0;
    let stars = [], glows = [];
    let tick     = 0;
    let prevTime = performance.now();

    // Shooting star state
    let shootingStars = [];
    let nextStarIn = 2000 + Math.random() * 4000;

    // ── initStars — never called with zero dimensions ──────────────────────
    function initStars(w, h) {
      if (w <= 0 || h <= 0) return;

      canvas.width  = w;
      canvas.height = h;
      W = w; H = h;

      stars = Array.from({ length: 160 }, () => ({
        x:       Math.random() * w,
        y:       Math.random() * h,
        r:       0.4 + Math.random() * 1.5,
        op:      0.20 + Math.random() * 0.55,
        dx:      (Math.random() - 0.5) * 0.06,
        dy:      (Math.random() - 0.5) * 0.045,
        twSpeed: 0.002 + Math.random() * 0.005,
        phase:   Math.random() * Math.PI * 2,
      }));

      glows = Array.from({ length: 12 }, () => ({
        x:          Math.random() * w,
        y:          Math.random() * h,
        r:          3 + Math.random() * 5,
        op:         0.05 + Math.random() * 0.09,
        dx:         (Math.random() - 0.5) * 0.03,
        dy:         (Math.random() - 0.5) * 0.025,
        color:      GLOW_COLORS[Math.floor(Math.random() * GLOW_COLORS.length)],
        pulseSpeed: 0.001 + Math.random() * 0.002,
        phase:      Math.random() * Math.PI * 2,
      }));

      initialized = true;
    }

    // ── Animation loop ─────────────────────────────────────────────────────
    let animId;

    const draw = (now) => {
      animId = requestAnimationFrame(draw);

      // Skip drawing until we have real dimensions
      if (!initialized || W <= 0 || H <= 0) return;

      try {
        const dt = Math.min(now - prevTime, 100);
        prevTime = now;
        tick++;

        ctx.clearRect(0, 0, W, H);

        // Background stars
        for (const s of stars) {
          s.x = ((s.x + s.dx) % W + W) % W;
          s.y = ((s.y + s.dy) % H + H) % H;
          const alpha = Math.max(0.04, s.op + Math.sin(tick * s.twSpeed + s.phase) * 0.13);
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
          ctx.fill();
        }

        // Orange glow blobs
        for (const g of glows) {
          g.x = ((g.x + g.dx) % W + W) % W;
          g.y = ((g.y + g.dy) % H + H) % H;
          const alpha  = Math.max(0.008, g.op + Math.sin(tick * g.pulseSpeed + g.phase) * 0.025);
          const spread = g.r * 5;
          const grad   = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, spread);
          grad.addColorStop(0,   `rgba(${g.color},${alpha.toFixed(3)})`);
          grad.addColorStop(0.4, `rgba(${g.color},${(alpha * 0.3).toFixed(3)})`);
          grad.addColorStop(1,   `rgba(${g.color},0)`);
          ctx.beginPath();
          ctx.arc(g.x, g.y, spread, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Shooting stars
        nextStarIn -= dt;
        if (nextStarIn <= 0 && shootingStars.length < 4) {
          shootingStars.push(new ShootingStar(canvas.width, canvas.height));
          if (Math.random() < 0.25) {
            shootingStars.push(new ShootingStar(canvas.width, canvas.height));
          }
          nextStarIn = 2000 + Math.random() * 4000;
        }
        for (const star of shootingStars) {
          star.update(dt);
          star.draw(ctx);
        }
        shootingStars = shootingStars.filter(s => s.alive);

      } catch (err) { console.error('[Starfield] draw error:', err); }
    };

    // ── ResizeObserver — always reinit with real dimensions ────────────────
    const parent = canvas.parentElement;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = Math.round(e.contentRect.width);
        const h = Math.round(e.contentRect.height);
        if (w > 0 && h > 0) initStars(w, h);
      }
    });
    if (parent) ro.observe(parent);

    // ── Try immediate init ─────────────────────────────────────────────────
    const pw = parent?.offsetWidth  || 0;
    const ph = parent?.offsetHeight || 0;
    if (pw > 0 && ph > 0) initStars(pw, ph);

    // ── Start loop (runs even while uninitialized — just skips drawing) ────
    animId = requestAnimationFrame(draw);

    // ── One-frame safety delay: catches cases where layout finalizes ───────
    // after useEffect but before the ResizeObserver fires
    const safetyId = requestAnimationFrame(() => {
      if (!initialized && parent) {
        const w2 = parent.offsetWidth;
        const h2 = parent.offsetHeight;
        if (w2 > 0 && h2 > 0) initStars(w2, h2);
      }
    });

    return () => {
      cancelAnimationFrame(animId);
      cancelAnimationFrame(safetyId);
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

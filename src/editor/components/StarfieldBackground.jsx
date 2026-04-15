// src/editor/components/StarfieldBackground.jsx
// Animated starfield with periodic cinematic space events:
//   MeteorShower  — 15-25 meteors rain diagonally across the screen
//   PlanetKiller  — massive asteroid crosses the canvas after each shower
// Events cycle: shower → 500 ms gap → asteroid → 45-90 s gap → shower → …

import React, { useRef, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// MeteorShower
// ─────────────────────────────────────────────────────────────────────────────
class MeteorShower {
  constructor() {
    this.meteors = [];
    this.active  = false;
    this.W = 800; this.H = 600;
  }

  resize(w, h) { this.W = w; this.H = h; }

  trigger() {
    this.active  = true;
    this.meteors = [];
    const count = 15 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
      this.meteors.push({
        x:       this.W * 0.5 + Math.random() * this.W * 0.6,
        y:       -20 - Math.random() * 100,
        speed:   800 + Math.random() * 600,
        angle:   210 + (Math.random() - 0.5) * 30,
        length:  80  + Math.random() * 70,
        size:    1.5 + Math.random() * 1.5,
        opacity: 0.6 + Math.random() * 0.4,
        delay:   i * (80 + Math.random() * 60),
        elapsed: 0,
        started: false,
        done:    false,
      });
    }
  }

  // Returns true when every meteor has left the screen (signal: spawn planet killer)
  update(dt, ctx) {
    if (!this.active) return false;

    let allDone = true;
    for (const m of this.meteors) {
      m.elapsed += dt;
      if (m.elapsed < m.delay) { allDone = false; continue; }
      if (!m.started) m.started = true;

      const t   = (m.elapsed - m.delay) / 1000;
      const rad = (m.angle * Math.PI) / 180;
      const x   = m.x + Math.cos(rad) * m.speed * t;
      const y   = m.y + Math.sin(rad) * m.speed * t;

      if (x < -200 || y > this.H + 200) { m.done = true; continue; }
      allDone = false;

      // Tail
      const tailX = x - Math.cos(rad) * m.length;
      const tailY = y - Math.sin(rad) * m.length;
      const grad  = ctx.createLinearGradient(x, y, tailX, tailY);
      grad.addColorStop(0,   `rgba(255,255,240,${m.opacity})`);
      grad.addColorStop(0.3, `rgba(180,220,255,${(m.opacity * 0.6).toFixed(2)})`);
      grad.addColorStop(1,   'rgba(180,220,255,0)');

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tailX, tailY);
      ctx.strokeStyle = grad;
      ctx.lineWidth   = m.size;
      ctx.stroke();

      // Head glow
      const headGlow = ctx.createRadialGradient(x, y, 0, x, y, m.size * 4);
      headGlow.addColorStop(0, `rgba(255,255,255,${m.opacity})`);
      headGlow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = headGlow;
      ctx.beginPath();
      ctx.arc(x, y, m.size * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (allDone) { this.active = false; return true; }
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PlanetKiller
// ─────────────────────────────────────────────────────────────────────────────
class PlanetKiller {
  constructor() {
    this.active  = false;
    this.elapsed = 0;
    this.W = 800; this.H = 600;
    this.trail   = [];
    this.debris  = [];
  }

  resize(w, h) { this.W = w; this.H = h; }

  trigger() {
    this.active   = true;
    this.elapsed  = 0;
    this.duration = 5000 + Math.random() * 1000;
    this.size     = 60 + Math.random() * 40;
    this.startX   = this.W + this.size;
    this.startY   = -this.size;
    this.endX     = -this.size * 2;
    this.endY     = this.H + this.size;
    this.rotation = 0;
    this.rotSpeed = (Math.random() - 0.5) * 0.5;
    this.trail    = [];
    this.flashed  = false;

    this.debris = Array.from({ length: 3 }, () => ({
      delay:   this.duration * 0.3 + Math.random() * 500,
      size:    15 + Math.random() * 25,
      offsetX: (Math.random() - 0.5) * 80,
      offsetY: (Math.random() - 0.5) * 80,
      opacity: 0.5 + Math.random() * 0.3,
    }));
  }

  update(dt, ctx) {
    if (!this.active) return;
    this.elapsed += dt;

    const t  = Math.min(1, this.elapsed / this.duration);
    const x  = this.startX + (this.endX - this.startX) * t;
    const y  = this.startY + (this.endY - this.startY) * t;
    this.rotation += this.rotSpeed * (dt / 16); // normalise to ~60 fps

    // Smoke trail
    this.trail.push({ x, y, age: 0 });
    for (const p of this.trail) p.age += dt;
    this.trail = this.trail.filter(p => p.age < 1500);

    for (const p of this.trail) {
      const a = (1 - p.age / 1500) * 0.15;
      const r = this.size * 0.3 * (p.age / 1500 + 0.5);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100,80,60,${a.toFixed(3)})`;
      ctx.fill();
    }

    // Asteroid body
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.rotation);

    // Orange entry-heat glow
    const glow = ctx.createRadialGradient(0, 0, this.size * 0.6, 0, 0, this.size * 1.4);
    glow.addColorStop(0,   'rgba(249,115,22,0)');
    glow.addColorStop(0.7, 'rgba(249,115,22,0.08)');
    glow.addColorStop(1,   'rgba(249,115,22,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, this.size * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Irregular rocky silhouette
    ctx.beginPath();
    const pts = 12;
    for (let i = 0; i < pts; i++) {
      const angle = (i / pts) * Math.PI * 2;
      const r = this.size * (
        0.75
        + Math.sin(i * 2.3 + 1.7) * 0.15
        + Math.sin(i * 5.1)        * 0.08
      );
      if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else         ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();

    const bodyGrad = ctx.createRadialGradient(
      -this.size * 0.2, -this.size * 0.2, 0,
       0, 0, this.size,
    );
    bodyGrad.addColorStop(0,   '#4a4a52');
    bodyGrad.addColorStop(0.5, '#2a2a30');
    bodyGrad.addColorStop(1,   '#1a1a1e');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Surface craters
    for (let i = 0; i < 5; i++) {
      const cx = Math.sin(i * 1.7) * 0.5 * this.size * 0.6;
      const cy = Math.cos(i * 2.3) * 0.5 * this.size * 0.6;
      const cr = this.size * (0.08 + Math.sin(i) * 0.04);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, cr), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fill();
    }

    ctx.restore();

    // Subtle screen flash at midpoint
    if (t > 0.45 && t < 0.55 && !this.flashed) {
      this.flashed = true;
      ctx.fillStyle = 'rgba(255,200,100,0.04)';
      ctx.fillRect(0, 0, this.W, this.H);
    }

    // Debris chunks
    for (const d of this.debris) {
      if (this.elapsed < d.delay) continue;
      const dt2 = this.elapsed - d.delay;
      const t2  = Math.min(1, dt2 / (this.duration * 0.7));
      const dx  = (this.startX + d.offsetX) + (this.endX - this.startX + d.offsetX) * t2;
      const dy  = (this.startY + d.offsetY) + (this.endY - this.startY + d.offsetY) * t2;
      ctx.beginPath();
      ctx.arc(dx, dy, d.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(45,45,50,${(d.opacity * (1 - t2 * 0.5)).toFixed(3)})`;
      ctx.fill();
    }

    if (t >= 1) this.active = false;
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

    let W = 0, H = 0;
    let raf;
    let stars = [], glows = [];

    const GLOW_COLORS = ['249,115,22', '251,146,60', '234,179,8'];

    // ── Event instances ────────────────────────────────────────────────────────
    const meteorShower = new MeteorShower();
    const planetKiller = new PlanetKiller();

    // First shower fires in 30-60 s; subsequent ones in 45-90 s
    let nextShowerIn       = 30000 + Math.random() * 30000;
    let pendingPlanetKiller = false;
    let planetKillerDelay   = 0;

    // ── Init stars ─────────────────────────────────────────────────────────────
    function init(w, h) {
      W = w; H = h;
      meteorShower.resize(w, h);
      planetKiller.resize(w, h);

      stars = Array.from({ length: 150 }, () => ({
        x:       Math.random() * W,
        y:       Math.random() * H,
        r:       0.4 + Math.random() * 1.4,
        op:      0.25 + Math.random() * 0.50,
        dx:      (Math.random() - 0.5) * 0.07,
        dy:      (Math.random() - 0.5) * 0.05,
        twSpeed: 0.003 + Math.random() * 0.004,
        phase:   Math.random() * Math.PI * 2,
      }));
      glows = Array.from({ length: 10 }, () => ({
        x:          Math.random() * W,
        y:          Math.random() * H,
        r:          3 + Math.random() * 4,
        op:         0.06 + Math.random() * 0.10,
        dx:         (Math.random() - 0.5) * 0.035,
        dy:         (Math.random() - 0.5) * 0.028,
        color:      GLOW_COLORS[Math.floor(Math.random() * GLOW_COLORS.length)],
        pulseSpeed: 0.001 + Math.random() * 0.002,
        phase:      Math.random() * Math.PI * 2,
      }));
    }

    // ── Resize ─────────────────────────────────────────────────────────────────
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
    const iw = canvas.offsetWidth  || parent?.offsetWidth  || 800;
    const ih = canvas.offsetHeight || parent?.offsetHeight || 600;
    canvas.width  = iw;
    canvas.height = ih;
    init(iw, ih);

    // ── Animation loop ─────────────────────────────────────────────────────────
    let t        = 0;
    let prevTime = performance.now();

    const draw = (now) => {
      const dt = Math.min(now - prevTime, 100); // cap at 100 ms to survive tab sleep
      prevTime = now;
      t++;

      ctx.clearRect(0, 0, W, H);

      // ── Background stars ──────────────────────────────────────────────────
      for (const s of stars) {
        s.x = ((s.x + s.dx) % W + W) % W;
        s.y = ((s.y + s.dy) % H + H) % H;
        const alpha = Math.max(0.05, s.op + Math.sin(t * s.twSpeed + s.phase) * 0.14);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
        ctx.fill();
      }

      // ── Orange glow blobs ─────────────────────────────────────────────────
      for (const g of glows) {
        g.x = ((g.x + g.dx) % W + W) % W;
        g.y = ((g.y + g.dy) % H + H) % H;
        const alpha  = Math.max(0.01, g.op + Math.sin(t * g.pulseSpeed + g.phase) * 0.03);
        const spread = g.r * 5;
        const grad   = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, spread);
        grad.addColorStop(0,   `rgba(${g.color},${alpha.toFixed(3)})`);
        grad.addColorStop(0.4, `rgba(${g.color},${(alpha * 0.35).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(${g.color},0)`);
        ctx.beginPath();
        ctx.arc(g.x, g.y, spread, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // ── Event scheduling ──────────────────────────────────────────────────
      if (!meteorShower.active && !planetKiller.active && !pendingPlanetKiller) {
        nextShowerIn -= dt;
        if (nextShowerIn <= 0) {
          meteorShower.trigger();
        }
      }

      const showerDone = meteorShower.update(dt, ctx);
      if (showerDone && !pendingPlanetKiller) {
        pendingPlanetKiller = true;
        planetKillerDelay   = 500;
      }

      if (pendingPlanetKiller) {
        planetKillerDelay -= dt;
        if (planetKillerDelay <= 0) {
          pendingPlanetKiller = false;
          planetKiller.trigger();
          nextShowerIn = 45000 + Math.random() * 45000;
        }
      }

      planetKiller.update(dt, ctx);

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

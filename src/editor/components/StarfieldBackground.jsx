// src/editor/components/StarfieldBackground.jsx
// Animated starfield with periodic cinematic space events:
//   MeteorShower  — depth-layered meteors with additive blending, colour variation, acceleration
//   PlanetKiller  — rocky asteroid with procedural texture, sparks, amber warmth flash
// Timing: first shower 20-40 s → 1 s gap → asteroid (6-10 s) → 60-120 s gap → repeat

import React, { useRef, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const rand    = (lo, hi) => lo + Math.random() * (hi - lo);
const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Weighted colour picker
const METEOR_COLOR_TYPES = [
  { r: 255, g: 255, b: 255, weight: 5 },   // white (most common)
  { r: 200, g: 220, b: 255, weight: 4 },   // blue-white
  { r: 255, g: 155, b:  70, weight: 1 },   // orange rare
  { r: 175, g: 255, b: 185, weight: 1 },   // green rare
];
const COLOR_WEIGHT_TOTAL = METEOR_COLOR_TYPES.reduce((s, c) => s + c.weight, 0);
function pickColor() {
  let r = Math.random() * COLOR_WEIGHT_TOTAL;
  for (const c of METEOR_COLOR_TYPES) { r -= c.weight; if (r <= 0) return c; }
  return METEOR_COLOR_TYPES[0];
}

// Depth-layer config: bg (slow/dim) → fg (fast/bright)
const LAYER_CFG = [
  { speedLo: 500, speedHi:  800, brightnessLo: 0.35, brightnessHi: 0.60, headSize: 1.5, tailLen: 60,  accel: 1.10, countLo: 6,  countHi: 9  },
  { speedLo: 900, speedHi: 1200, brightnessLo: 0.60, brightnessHi: 0.85, headSize: 2.2, tailLen: 110, accel: 1.25, countLo: 5,  countHi: 8  },
  { speedLo:1300, speedHi: 1800, brightnessLo: 0.85, brightnessHi: 1.00, headSize: 3.0, tailLen: 160, accel: 1.40, countLo: 3,  countHi: 5  },
];

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

    LAYER_CFG.forEach((cfg, layerIdx) => {
      const count = randInt(cfg.countLo, cfg.countHi);
      for (let i = 0; i < count; i++) {
        const color = pickColor();
        this.meteors.push({
          layer:   layerIdx,
          x:       this.W * 0.45 + rand(0, this.W * 0.65),
          y:       rand(-150, -10),
          speed:   rand(cfg.speedLo, cfg.speedHi),
          accel:   cfg.accel,
          angle:   210 + rand(-18, 18),           // roughly south-west
          tailLen: cfg.tailLen * rand(0.75, 1.25),
          headSize:cfg.headSize,
          bright:  rand(cfg.brightnessLo, cfg.brightnessHi),
          color,
          delay:   i * rand(60, 130) + layerIdx * rand(30, 80),
          elapsed: 0,
          done:    false,
          flicker: rand(0.003, 0.008),
          flickerPhase: rand(0, Math.PI * 2),
        });
      }
    });
  }

  _draw(ctx, m, rad) {
    const t      = (m.elapsed - m.delay) / 1000;
    // Integrate with acceleration: x = v0*t + 0.5*(accel*v0)*t^2
    const effSpeed = m.speed + 0.5 * (m.accel - 1) * m.speed * t;
    const dist   = m.speed * t + 0.5 * (m.accel - 1) * m.speed * t * t;
    const x      = m.x + Math.cos(rad) * dist;
    const y      = m.y + Math.sin(rad) * dist;

    // Flicker brightness
    const flicker = 1 + Math.sin(m.elapsed * m.flicker * 1000 + m.flickerPhase) * 0.08;
    const bright  = clamp(m.bright * flicker, 0, 1);

    // Build tail as overlapping radial gradient circles for realistic glow
    const tailLen = m.tailLen * (0.9 + 0.1 * bright);
    const steps   = Math.max(2, Math.min(28, Math.ceil(tailLen / 5))); // min 2 so frac never NaN
    const savedOp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';

    for (let s = 0; s < steps; s++) {
      const frac   = s / (steps - 1);             // 0 = head, 1 = tail end
      const sx     = x - Math.cos(rad) * tailLen * frac;
      const sy     = y - Math.sin(rad) * tailLen * frac;

      // Alpha falls off quadratically toward tail
      const alpha  = bright * (1 - frac * frac) * (s === 0 ? 1.0 : 0.38);
      // Colour shifts: white at head → meteor colour in tail
      const rr     = Math.round(255 + (m.color.r - 255) * frac);
      const gg     = Math.round(255 + (m.color.g - 255) * frac);
      const bb     = Math.round(255 + (m.color.b - 255) * frac);

      // Radius tapers from headSize → tiny
      const circR  = m.headSize * (1 - frac * 0.7) * (m.layer + 1) * 0.55 + 1.2;

      const grd    = ctx.createRadialGradient(sx, sy, 0, sx, sy, circR * 4);
      grd.addColorStop(0,   `rgba(${rr},${gg},${bb},${(alpha * 0.9).toFixed(3)})`);
      grd.addColorStop(0.4, `rgba(${rr},${gg},${bb},${(alpha * 0.35).toFixed(3)})`);
      grd.addColorStop(1,   `rgba(${rr},${gg},${bb},0)`);

      ctx.beginPath();
      ctx.arc(sx, sy, circR * 4, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }

    // Bright white core at head
    const coreR  = m.headSize * (m.layer * 0.4 + 0.9);
    const coreG  = ctx.createRadialGradient(x, y, 0, x, y, coreR * 5);
    coreG.addColorStop(0,   `rgba(255,255,255,${(bright * 0.95).toFixed(3)})`);
    coreG.addColorStop(0.25,`rgba(255,255,255,${(bright * 0.55).toFixed(3)})`);
    coreG.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(x, y, coreR * 5, 0, Math.PI * 2);
    ctx.fillStyle = coreG;
    ctx.fill();

    ctx.globalCompositeOperation = savedOp;

    return { x, y, effSpeed };
  }

  // Returns true when all meteors are done (signal: spawn planet killer)
  update(dt, ctx) {
    if (!this.active) return false;

    let allDone = true;
    for (const m of this.meteors) {
      m.elapsed += dt;
      if (m.elapsed < m.delay) { allDone = false; continue; }
      if (m.done) continue;

      const rad  = (m.angle * Math.PI) / 180;
      const { x, y } = this._draw(ctx, m, rad);

      if (x < -300 || y > this.H + 300) { m.done = true; continue; }
      allDone = false;
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
  }

  resize(w, h) { this.W = w; this.H = h; }

  trigger() {
    this.active      = true;
    this.elapsed     = 0;
    this.duration    = rand(6000, 10000);
    this.size        = rand(55, 95);
    this.startX      = this.W + this.size + 20;
    this.startY      = rand(-this.size * 0.5, this.size);
    this.endX        = -this.size * 2;
    this.endY        = this.H + this.size;
    this.rotation    = rand(0, Math.PI * 2);
    this.rotSpeed    = (Math.random() - 0.5) * 0.6;
    this.trail       = [];
    this.flashed     = false;
    this.flashProgress = 0; // 0 = not started, > 0 animates sin curve
    this._seed       = Math.random() * 1000;

    // Sparks that break off during passage
    const sparkCount = randInt(6, 10);
    this.sparks = Array.from({ length: sparkCount }, (_, i) => ({
      breakT:  rand(0.15, 0.75),
      offsetX: rand(-this.size * 0.8, this.size * 0.8),
      offsetY: rand(-this.size * 0.8, this.size * 0.8),
      vx:      rand(-120, 120),
      vy:      rand(-90, 30),
      life:    rand(1200, 2500),
      elapsed: 0,
      size:    rand(2, 8),
      broken:  false,
      bx: 0, by: 0,
      color: Math.random() < 0.6
        ? { r: 255, g: rand(120, 200), b: 40 }   // amber
        : { r: 200, g: 220, b: 255 },             // blue-white
    }));
  }

  // Build irregular rocky silhouette (13 points, multi-freq sin perturbation)
  _rockyPath(ctx, size, seed) {
    const pts = 13;
    ctx.beginPath();
    for (let i = 0; i < pts; i++) {
      const angle = (i / pts) * Math.PI * 2;
      const r = size * (
        0.74
        + Math.sin(i * 2.3 + seed)         * 0.14
        + Math.sin(i * 5.1 + seed * 0.7)   * 0.08
        + Math.sin(i * 8.7 + seed * 1.3)   * 0.04
      );
      if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else         ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
  }

  update(dt, ctx) {
    if (!this.active) return;
    this.elapsed += dt;

    const t  = Math.min(1, this.elapsed / this.duration);
    const x  = this.startX + (this.endX - this.startX) * t;
    const y  = this.startY + (this.endY - this.startY) * t;
    this.rotation += this.rotSpeed * (dt / 16);

    // ── Additive smoke trail ──────────────────────────────────────────────
    this.trail.push({ x, y, age: 0, r: this.size * rand(0.25, 0.45) });
    for (const p of this.trail) p.age += dt;
    this.trail = this.trail.filter(p => p.age < 1800);

    const savedOp = ctx.globalCompositeOperation;
    for (const p of this.trail) {
      const a = (1 - p.age / 1800) * 0.12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.5 + p.age / 1800), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(110,85,55,${a.toFixed(3)})`;
      ctx.fill();
    }

    // ── Sparks ────────────────────────────────────────────────────────────
    for (const sp of this.sparks) {
      if (!sp.broken && t >= sp.breakT) {
        sp.broken = true;
        sp.bx = x + sp.offsetX;
        sp.by = y + sp.offsetY;
      }
      if (!sp.broken) continue;

      sp.elapsed += dt;
      if (sp.elapsed > sp.life) continue;

      const st   = sp.elapsed / sp.life;
      const sx   = sp.bx + sp.vx * (sp.elapsed / 1000);
      const sy   = sp.by + sp.vy * (sp.elapsed / 1000) + 40 * (sp.elapsed / 1000) ** 2; // gravity
      const alpha = (1 - st) * 0.85;
      const sr    = sp.size * (1 - st * 0.6);

      ctx.globalCompositeOperation = 'lighter';
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 3);
      sg.addColorStop(0,  `rgba(${sp.color.r},${sp.color.g},${sp.color.b},${(alpha * 0.9).toFixed(3)})`);
      sg.addColorStop(1,  `rgba(${sp.color.r},${sp.color.g},${sp.color.b},0)`);
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 3, 0, Math.PI * 2);
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.globalCompositeOperation = savedOp;
    }

    // ── Asteroid body ─────────────────────────────────────────────────────
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.rotation);

    // Pulsing orange entry-heat glow (additive)
    const glowPulse = 0.08 + 0.03 * Math.sin(this.elapsed * 0.006);
    ctx.globalCompositeOperation = 'lighter';
    const outerGlow = ctx.createRadialGradient(0, 0, this.size * 0.5, 0, 0, this.size * 1.8);
    outerGlow.addColorStop(0,   `rgba(249,115,22,0)`);
    outerGlow.addColorStop(0.6, `rgba(249,115,22,${glowPulse.toFixed(3)})`);
    outerGlow.addColorStop(1,   'rgba(249,115,22,0)');
    ctx.beginPath();
    ctx.arc(0, 0, this.size * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = outerGlow;
    ctx.fill();
    ctx.globalCompositeOperation = savedOp;

    // Rocky silhouette — fill base colour
    this._rockyPath(ctx, this.size, this._seed);
    const bodyGrad = ctx.createRadialGradient(
      -this.size * 0.25, -this.size * 0.25, 0,
       0, 0, this.size,
    );
    bodyGrad.addColorStop(0,   '#52505a');
    bodyGrad.addColorStop(0.5, '#2e2c34');
    bodyGrad.addColorStop(1,   '#1a1820');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Surface texture inside clip region
    ctx.save();
    this._rockyPath(ctx, this.size, this._seed);
    ctx.clip();

    // Lighter rock patches (additive — luminous surface facets)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const px = Math.sin(i * 1.9 + this._seed) * this.size * 0.45;
      const py = Math.cos(i * 2.7 + this._seed) * this.size * 0.45;
      const pr = this.size * (0.12 + Math.abs(Math.sin(i * 3.1)) * 0.10);
      const pg = ctx.createRadialGradient(px, py, 0, px, py, pr);
      pg.addColorStop(0,   'rgba(100,95,115,0.18)');
      pg.addColorStop(1,   'rgba(100,95,115,0)');
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = pg;
      ctx.fill();
    }
    ctx.globalCompositeOperation = savedOp;

    // Craters
    for (let i = 0; i < 6; i++) {
      const cx = Math.sin(i * 1.7 + this._seed * 0.4) * this.size * 0.5;
      const cy = Math.cos(i * 2.3 + this._seed * 0.6) * this.size * 0.5;
      const cr = Math.max(1, this.size * (0.07 + Math.abs(Math.sin(i + this._seed)) * 0.05));
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
      // Crater rim highlight
      ctx.beginPath();
      ctx.arc(cx - cr * 0.25, cy - cr * 0.25, cr * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,115,130,0.12)';
      ctx.fill();
    }

    // Rim shadow (top-right darkening)
    const rimG = ctx.createRadialGradient(
      this.size * 0.3, -this.size * 0.3, this.size * 0.3,
      0, 0, this.size * 1.1,
    );
    rimG.addColorStop(0,   'rgba(0,0,0,0)');
    rimG.addColorStop(0.7, 'rgba(0,0,0,0.0)');
    rimG.addColorStop(1,   'rgba(0,0,0,0.55)');
    ctx.beginPath();
    ctx.arc(0, 0, this.size * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = rimG;
    ctx.fill();

    ctx.restore(); // pop clip

    ctx.restore(); // pop translate/rotate

    // ── Amber warmth flash near midpoint ─────────────────────────────────
    if (t > 0.42 && t < 0.70) {
      if (!this.flashed) {
        this.flashed      = true;
        this.flashProgress = 0.001;
      }
    }
    if (this.flashProgress > 0) {
      this.flashProgress += dt;
      const fp     = this.flashProgress / 300;          // 0→1 over 300 ms
      const falpha = Math.sin(Math.min(fp, 1) * Math.PI) * 0.06; // peaks at 0.06
      if (falpha > 0.001) {
        ctx.fillStyle = `rgba(255,160,50,${falpha.toFixed(4)})`;
        ctx.fillRect(0, 0, this.W, this.H);
      }
      if (fp >= 1) this.flashProgress = 0;
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

    const meteorShower = new MeteorShower();
    const planetKiller = new PlanetKiller();

    // First shower fires in 20-40 s; subsequent ones in 60-120 s
    let nextShowerIn        = rand(20000, 40000);
    let pendingPlanetKiller = false;
    let planetKillerDelay   = 0;

    // ── Init stars ────────────────────────────────────────────────────────
    function init(w, h) {
      W = w; H = h;
      meteorShower.resize(w, h);
      planetKiller.resize(w, h);

      stars = Array.from({ length: 160 }, () => ({
        x:       Math.random() * W,
        y:       Math.random() * H,
        r:       0.4 + Math.random() * 1.5,
        op:      0.20 + Math.random() * 0.55,
        dx:      (Math.random() - 0.5) * 0.06,
        dy:      (Math.random() - 0.5) * 0.045,
        twSpeed: 0.002 + Math.random() * 0.005,
        phase:   Math.random() * Math.PI * 2,
      }));
      glows = Array.from({ length: 12 }, () => ({
        x:          Math.random() * W,
        y:          Math.random() * H,
        r:          3 + Math.random() * 5,
        op:         0.05 + Math.random() * 0.09,
        dx:         (Math.random() - 0.5) * 0.03,
        dy:         (Math.random() - 0.5) * 0.025,
        color:      GLOW_COLORS[Math.floor(Math.random() * GLOW_COLORS.length)],
        pulseSpeed: 0.001 + Math.random() * 0.002,
        phase:      Math.random() * Math.PI * 2,
      }));
    }

    // ── Resize ────────────────────────────────────────────────────────────
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

    // ── Animation loop ────────────────────────────────────────────────────
    let tick     = 0;
    let prevTime = performance.now();

    const draw = (now) => {
      raf = requestAnimationFrame(draw); // schedule next frame first so errors can't kill loop
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

      // Event scheduling
      if (!meteorShower.active && !planetKiller.active && !pendingPlanetKiller) {
        nextShowerIn -= dt;
        if (nextShowerIn <= 0) meteorShower.trigger();
      }

      const showerDone = meteorShower.update(dt, ctx);
      if (showerDone && !pendingPlanetKiller) {
        pendingPlanetKiller = true;
        planetKillerDelay   = 1000;
      }

      if (pendingPlanetKiller) {
        planetKillerDelay -= dt;
        if (planetKillerDelay <= 0) {
          pendingPlanetKiller = false;
          planetKiller.trigger();
          nextShowerIn = rand(60000, 120000);
        }
      }

      planetKiller.update(dt, ctx);

      } catch (err) { console.error('[Starfield] draw error:', err); }
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

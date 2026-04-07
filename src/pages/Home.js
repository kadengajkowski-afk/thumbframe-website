import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Lightning, Scissors, TextT, Shuffle, PaintBrush, ArrowRight
} from '@phosphor-icons/react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';

// ─── Animation variants ────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

// ─── Space spiral canvas (homepage only) ──────────────────────────────────────
function SpaceCanvas() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H, raf;
    let cx, cy;

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      cx = W * 0.72;
      cy = H * 0.44;
    }
    resize();
    window.addEventListener('resize', resize);

    // Layer 4 — background star field (80 dots)
    const bgStars = Array.from({ length: 80 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 0.7 + 0.2,
      op: Math.random() * 0.13 + 0.03,
      ph: Math.random() * Math.PI * 2,
    }));

    // Layer 4b — ambient drifting starfield (orange + white, 100 stars)
    // Initial speed is low — gravitational pull does the work
    const driftStars = Array.from({ length: 100 }, () => {
      const isOrange = Math.random() < 0.38;
      const pick = Math.random();
      const [cr, cg, cb] = isOrange
        ? (pick < 0.5 ? [255, 106,  0] : [255, 140, 51])
        : (pick < 0.5 ? [255, 255, 255] : [224, 224, 224]);
      const speed = 0.04 + Math.random() * 0.18; // slower base — gravity accelerates
      const angle = Math.random() * Math.PI * 2;
      return {
        x:  Math.random() * W,
        y:  Math.random() * H,
        r:  0.5 + Math.random() * 1.0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ph: Math.random() * Math.PI * 2,
        ts: 0.4 + Math.random() * 0.8,
        cr, cg, cb,
        bcr: cr, bcg: cg, bcb: cb, // base color (for lerp)
      };
    });

    // Layer 1+3 — spiral particles (3 arms × 200)
    const particles = [];
    const ARMS = 3;
    for (let arm = 0; arm < ARMS; arm++) {
      for (let i = 0; i < 200; i++) {
        const t = i / 200;
        const dist = 18 + t * 210;
        const theta = arm * ((2 * Math.PI) / ARMS) + t * Math.PI * 4.2;
        particles.push({
          bx: dist * Math.cos(theta) * 1.3,
          by: dist * Math.sin(theta) * 0.7,
          sz: Math.random() * 1.6 + 0.3,
          hue: 18 + Math.random() * 22,
          br: 0.05 + Math.random() * 0.3,
          ph: Math.random() * Math.PI * 2,
        });
      }
    }

    // Layer 5 — flow lines (4 sinusoids, appear on scroll)
    const flowLines = Array.from({ length: 4 }, (_, i) => ({
      yFrac: 0.68 + i * 0.08,
      phase: i * 0.9,
      amp:   28 + i * 14,
      freq:  0.0025 + i * 0.0008,
    }));

    // Color lerp helper (component arrays — no hex parsing in hot loop)
    function lerpRGB(r1, g1, b1, r2, g2, b2, t) {
      return [
        Math.round(r1 + (r2 - r1) * t),
        Math.round(g1 + (g2 - g1) * t),
        Math.round(b1 + (b2 - b1) * t),
      ];
    }

    // Center sparks — matter being consumed by singularity (10 tiny orbiting dots)
    const sparks = Array.from({ length: 10 }, (_, i) => ({
      angle:    (i / 10) * Math.PI * 2,
      orbitR:   10 + Math.random() * 15,
      speed:    (0.05 + Math.random() * 0.06) * (Math.random() < 0.5 ? 1 : -1),
      size:     0.8 + Math.random() * 0.7,
      alpha:    0.8 + Math.random() * 0.2,
      trail:    [],
      fallIn:   false,
      fallProgress: 0,
      respawnTimer: Math.floor(90 + Math.random() * 210),
    }));

    let rot  = 0;
    let time = 0;

    function draw() {
      const scrollY = window.scrollY;
      const pcy = cy - scrollY * 0.12; // parallax

      ctx.clearRect(0, 0, W, H);
      rot  += 0.00035;
      time += 0.016;

      // Layer 4 — background stars
      bgStars.forEach(s => {
        const a = s.op * (0.65 + 0.35 * Math.sin(time * 0.7 + s.ph));
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,200,150,${a})`;
        ctx.fill();
      });

      // Layer 4b — drifting starfield with gravitational attraction toward singularity
      driftStars.forEach(s => {
        const dx = s.x - cx;
        const dy = s.y - pcy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Inverse-square gravity (capped to prevent escape velocity)
        const gravity = Math.min(0.5, 800 / (dist * dist + 100));
        s.vx -= (dx / dist) * gravity;
        s.vy -= (dy / dist) * gravity;

        // Tangential nudge — keeps stars orbiting instead of falling straight in
        s.vx += (-dy / dist) * gravity * 0.3;
        s.vy += ( dx / dist) * gravity * 0.3;

        // Velocity damping
        s.vx *= 0.995;
        s.vy *= 0.995;

        s.x += s.vx;
        s.y += s.vy;

        // Consumed by singularity → respawn at a random screen edge
        if (dist < 15) {
          const edge = Math.floor(Math.random() * 4);
          if      (edge === 0) { s.x = 0; s.y = Math.random() * H; }
          else if (edge === 1) { s.x = W; s.y = Math.random() * H; }
          else if (edge === 2) { s.x = Math.random() * W; s.y = 0; }
          else                 { s.x = Math.random() * W; s.y = H; }
          s.vx = 0; s.vy = 0;
        }

        // Proximity effects — bigger and more orange near the center
        const sizeMult   = 1 + Math.max(0, (200 - dist) / 200) * 2;     // up to 3× near center
        const orangeT    = Math.max(0, Math.min(1, (300 - dist) / 300)) * 0.7;
        const [rr, rg, rb] = lerpRGB(s.bcr, s.bcg, s.bcb, 255, 106, 0, orangeT);

        const a = 0.65 + 0.35 * Math.sin(time * s.ts + s.ph);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * sizeMult, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rr},${rg},${rb},${a})`;
        ctx.fill();
      });

      // Layer 2 — core glow + nebula
      const g1 = ctx.createRadialGradient(cx, pcy, 0, cx, pcy, 110);
      g1.addColorStop(0, 'rgba(255,107,0,0.09)');
      g1.addColorStop(0.6, 'rgba(255,107,0,0.025)');
      g1.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(cx, pcy, 110, 0, Math.PI * 2);
      ctx.fillStyle = g1; ctx.fill();

      const g2 = ctx.createRadialGradient(cx, pcy, 0, cx, pcy, 480);
      g2.addColorStop(0, 'rgba(255,107,0,0.022)');
      g2.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(cx, pcy, 480, 0, Math.PI * 2);
      ctx.fillStyle = g2; ctx.fill();

      // Layer 1+3 — spiral + orbiting stars
      const cosR = Math.cos(rot), sinR = Math.sin(rot);
      particles.forEach(p => {
        const rx = p.bx * cosR - p.by * sinR;
        const ry = p.bx * sinR + p.by * cosR;
        const px = cx + rx, py = pcy + ry;
        if (px < -8 || px > W + 8 || py < -8 || py > H + 8) return;
        const a = p.br * (0.55 + 0.45 * Math.sin(time * 1.4 + p.ph));
        ctx.beginPath();
        ctx.arc(px, py, p.sz, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},100%,65%,${a})`;
        ctx.fill();
      });

      // ── Singularity — pulsing black hole aura ────────────────────────────
      const pulse1 = 1 + 0.15 * Math.sin(time * 2.0);
      const pulse2 = 1 + 0.15 * Math.sin(time * 2.0 + Math.PI * 0.5);
      const pulse3 = 1 + 0.15 * Math.sin(time * 2.0 + Math.PI);
      const auraRot = time * 0.3;

      // Ring 3 — faint wide warm glow
      const gr3 = ctx.createRadialGradient(cx, pcy, 0, cx, pcy, 150 * pulse3);
      gr3.addColorStop(0,   'rgba(255,106,0,0.05)');
      gr3.addColorStop(1,   'transparent');
      ctx.beginPath(); ctx.arc(cx, pcy, 150 * pulse3, 0, Math.PI * 2);
      ctx.fillStyle = gr3; ctx.fill();

      // Ring 2 — mid orange halo
      const gr2 = ctx.createRadialGradient(cx, pcy, 0, cx, pcy, 80 * pulse2);
      gr2.addColorStop(0,   'rgba(255,140,51,0.10)');
      gr2.addColorStop(1,   'transparent');
      ctx.beginPath(); ctx.arc(cx, pcy, 80 * pulse2, 0, Math.PI * 2);
      ctx.fillStyle = gr2; ctx.fill();

      // Ring 1 — bright inner corona
      const gr1 = ctx.createRadialGradient(cx, pcy, 0, cx, pcy, 40 * pulse1);
      gr1.addColorStop(0,   'rgba(255,106,0,0.18)');
      gr1.addColorStop(0.4, 'rgba(255,106,0,0.08)');
      gr1.addColorStop(1,   'transparent');
      ctx.beginPath(); ctx.arc(cx, pcy, 40 * pulse1, 0, Math.PI * 2);
      ctx.fillStyle = gr1; ctx.fill();

      // Rotating off-center swirl — makes it look like matter spiraling in
      const swX = cx  + Math.cos(auraRot) * 12;
      const swY = pcy + Math.sin(auraRot) * 8;
      const gSwirl = ctx.createRadialGradient(swX, swY, 0, cx, pcy, 50 * pulse1);
      gSwirl.addColorStop(0,   'rgba(255,170,60,0.14)');
      gSwirl.addColorStop(1,   'transparent');
      ctx.beginPath(); ctx.arc(cx, pcy, 50 * pulse1, 0, Math.PI * 2);
      ctx.fillStyle = gSwirl; ctx.fill();

      // Black core — the event horizon
      ctx.beginPath();
      ctx.arc(cx, pcy, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();

      // ── Center sparks — matter orbiting the event horizon ────────────────
      sparks.forEach(sp => {
        if (!sp.fallIn) {
          sp.angle += sp.speed;
          sp.respawnTimer--;
          if (sp.respawnTimer <= 0) {
            sp.fallIn = true;
            sp.fallProgress = 0;
          }
          const spx = cx  + Math.cos(sp.angle) * sp.orbitR;
          const spy = pcy + Math.sin(sp.angle) * sp.orbitR * 0.55; // elliptical
          sp.trail.push({ x: spx, y: spy });
          if (sp.trail.length > 3) sp.trail.shift();
          // Trail
          sp.trail.forEach((pt, ti) => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, sp.size * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,106,0,${(ti + 1) / sp.trail.length * 0.35})`;
            ctx.fill();
          });
          // Spark
          ctx.beginPath();
          ctx.arc(spx, spy, sp.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,170,60,${sp.alpha})`;
          ctx.fill();
        } else {
          // Falling into the black hole — shrinks and vanishes
          sp.fallProgress += 0.035;
          if (sp.fallProgress >= 1) {
            sp.fallIn = false; sp.fallProgress = 0;
            sp.angle    = Math.random() * Math.PI * 2;
            sp.orbitR   = 10 + Math.random() * 15;
            sp.respawnTimer = Math.floor(90 + Math.random() * 210);
            sp.trail    = [];
          } else {
            const r   = sp.orbitR * (1 - sp.fallProgress);
            const spx = cx  + Math.cos(sp.angle + sp.fallProgress * 3) * r;
            const spy = pcy + Math.sin(sp.angle + sp.fallProgress * 3) * r * 0.55;
            ctx.beginPath();
            ctx.arc(spx, spy, sp.size * (1 - sp.fallProgress), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,200,60,${sp.alpha * (1 - sp.fallProgress)})`;
            ctx.fill();
          }
        }
      });

      // Layer 5 — flow lines (fade in after scrolling past hero)
      const fade = Math.min(1, Math.max(0, (scrollY - 180) / 250));
      if (fade > 0) {
        flowLines.forEach((line, i) => {
          const yBase = line.yFrac * H;
          ctx.beginPath();
          ctx.moveTo(0, yBase);
          for (let x = 0; x <= W; x += 5) {
            const y = yBase
              + Math.sin(x * line.freq + time * 0.4 + line.phase) * line.amp
              + Math.cos(x * line.freq * 0.6 + time * 0.25) * (line.amp * 0.4);
            ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(255,107,0,${(0.022 - i * 0.004) * fade})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }

      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        zIndex: 0, pointerEvents: 'none',
      }}
    />
  );
}

// ─── Marquee ──────────────────────────────────────────────────────────────────
const MARQUEE_ITEMS = [
  'AI Background Removal', 'Smart Text Engine', 'A/B Testing',
  'One-Click Export', 'YouTube Optimized', 'Brush Tools',
  'Layer System', 'Clone Stamp', 'Rim Light', 'Blend Modes',
];

function Marquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div style={{
      borderTop: '1px solid rgba(255,255,255,0.05)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      padding: '14px 0', overflow: 'hidden',
      background: 'rgba(12,12,15,0.6)',
      position: 'relative', zIndex: 1,
    }}>
      <div style={{
        display: 'flex', gap: 0,
        animation: 'tf-marquee 30s linear infinite',
        width: 'max-content',
      }}>
        {items.map((t, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px', whiteSpace: 'nowrap' }}>
            <span style={{ color: '#FF6B00', fontSize: 8 }}>●</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#55555e', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {t}
            </span>
          </span>
        ))}
      </div>
      <style>{`@keyframes tf-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}

// ─── Bento feature cards ───────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: <Lightning size={22} weight="duotone" />,
    tag: 'Free', title: 'Professional Editor',
    desc: 'Full layer system, blend modes, masks, text engine, and 12 brush tools. Everything Photoshop has — for thumbnails.',
    wide: true,
    glow: true,
  },
  {
    icon: <Scissors size={22} weight="duotone" />,
    tag: 'Pro', title: 'AI Background Removal',
    desc: 'Messy hair, complex edges, anything. Remove it in 3 seconds. No cleanup needed.',
  },
  {
    icon: <TextT size={22} weight="duotone" />,
    tag: 'Free', title: 'Smart Text Engine',
    desc: '500+ fonts, custom spacing, stroke, glow — get the exact look you need without a typography degree.',
  },
  {
    icon: <Shuffle size={22} weight="duotone" />,
    tag: 'Pro', title: 'A/B Testing',
    desc: 'Make two thumbnail variants and test which one clicks more. Real data, not guesses.',
  },
  {
    icon: <PaintBrush size={22} weight="duotone" />,
    tag: 'Free', title: '12 Brush Tools',
    desc: 'Dodge, burn, heal, clone stamp, blur, sharpen. The full retouching toolkit, built in.',
  },
];

function FeatureCard({ icon, tag, title, desc, wide, glow }) {
  const isPro = tag === 'Pro';
  return (
    <motion.div
      variants={fadeUp}
      className={wide ? 'tf-bento-wide' : undefined}
      style={{
        background: '#0c0c0f',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: '28px 32px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.2s, transform 0.2s',
        cursor: 'default',
      }}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
      onHoverStart={e => { e.currentTarget.style.borderColor = 'rgba(255,107,0,0.2)'; }}
      onHoverEnd={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
    >
      {glow && (
        <div style={{
          position: 'absolute', bottom: -40, right: -40,
          width: 200, height: 200,
          background: 'radial-gradient(circle, rgba(255,107,0,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'rgba(255,107,0,0.08)',
          border: '1px solid rgba(255,107,0,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#FF6B00',
        }}>
          {icon}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', padding: '3px 8px',
          borderRadius: 999,
          background: isPro ? 'rgba(255,107,0,0.1)' : 'rgba(255,255,255,0.05)',
          border: isPro ? '1px solid rgba(255,107,0,0.25)' : '1px solid rgba(255,255,255,0.08)',
          color: isPro ? '#FF6B00' : '#55555e',
        }}>
          {tag}
        </span>
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: '#f0f0f3', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      <p style={{ fontSize: 14, color: '#8a8a93', margin: 0, lineHeight: 1.6 }}>{desc}</p>
    </motion.div>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: 'lol i used to spend like 2 hours per thumbnail in photoshop. made one in thumbframe in 20 min last night and it lowkey looks better??',
    handle: '@creativewithcass', sub: '8K subs',
    highlight: true,
  },
  {
    quote: "the background remover is actually insane. tried it on a super messy background and it just... worked. no cleanup needed.",
    handle: 'u/editjunkie42', sub: 'r/NewTubers',
  },
  {
    quote: "ok real talk i was skeptical bc $15/mo but my CTR went from like 4% to 8% in two weeks. the A/B testing feature is the reason.",
    handle: '@jakeplaysgames', sub: '34K subs',
  },
  {
    quote: "i literally cancelled my photoshop subscription. this does everything i was using it for and the interface doesn't make me want to cry",
    handle: '@daniielcreates', sub: '5K subs',
  },
];

// ─── Home page ─────────────────────────────────────────────────────────────────
export default function Home({ setPage }) {
  useSEO({
    title: 'ThumbFrame — YouTube Thumbnail Editor for Creators',
    description: 'Stop wasting hours on thumbnails. ThumbFrame is the AI-powered editor built by a creator, for creators. Free to start.',
    url: 'https://thumbframe.com',
  });

  const go = (page) => { setPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div style={{ background: '#050507', minHeight: '100vh', overflowX: 'hidden', fontFamily: "'Satoshi', sans-serif", color: '#f0f0f3', position: 'relative' }}>
      <SpaceCanvas />
      <Navbar setPage={setPage} currentPage="home" />

      {/* ─── HERO ──────────────────────────────────────────────────────────── */}
      <section className="tf-hero-section" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        padding: '100px 24px 60px', maxWidth: 800, margin: '0 auto',
        position: 'relative', zIndex: 1,
      }}>
        {/* Left */}
        <motion.div
          variants={stagger} initial="hidden" animate="visible"
          style={{ width: '100%' }}
        >
          {/* Badge */}
          <motion.div variants={fadeUp} style={{ marginBottom: 28 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', borderRadius: 999,
              background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.2)',
              fontSize: 13, fontWeight: 600, color: '#FF8533',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', background: '#FF6B00',
                boxShadow: '0 0 8px rgba(255,107,0,0.8)',
                animation: 'tf-pulse 2s ease-in-out infinite',
                display: 'inline-block',
              }} />
              Built for YouTube creators
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1 variants={fadeUp} style={{ margin: '0 0 16px' }}>
            CREATE THUMBNAILS<br />
            THAT{' '}
            <span style={{
              color: '#FF6B00',
              textShadow: '0 0 40px rgba(255,107,0,0.4)',
            }}>
              GET CLICKED.
            </span>
          </motion.h1>

          <motion.p variants={fadeUp} style={{
            fontSize: 15, color: '#55555e', fontWeight: 400,
            margin: '0 0 20px', letterSpacing: '0.04em',
          }}>
            / the Photoshop replacement for creators /
          </motion.p>

          <motion.p variants={fadeUp} style={{
            fontSize: 16, color: '#8a8a93', lineHeight: 1.65,
            margin: '0 0 36px', maxWidth: 480,
          }}>
            Stop spending 2 hours per thumbnail. ThumbFrame has AI background removal,
            A/B testing, 500+ fonts, and the full brush toolkit — in a tool that doesn't
            require a design degree.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={fadeUp} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => go('editor')}
              style={{
                padding: '13px 28px', borderRadius: 10, border: 'none',
                background: '#FF6B00', color: '#fff',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 0 30px rgba(255,107,0,0.3)',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: "'Satoshi', sans-serif",
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 45px rgba(255,107,0,0.45)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 30px rgba(255,107,0,0.3)'}
            >
              Create Your First Thumbnail
              <ArrowRight size={16} weight="bold" />
            </button>
            <button
              onClick={() => go('pricing')}
              style={{
                padding: '13px 22px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent', color: '#8a8a93',
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'Satoshi', sans-serif",
              }}
            >
              See pricing →
            </button>
          </motion.div>

          <motion.p variants={fadeUp} style={{ fontSize: 12, color: '#55555e', margin: '16px 0 0' }}>
            Free forever · No credit card needed
          </motion.p>
        </motion.div>

      </section>

      {/* ─── MARQUEE ──────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Marquee />
      </div>

      {/* ─── FEATURES BENTO ───────────────────────────────────────────────── */}
      <motion.section
        variants={stagger} initial="hidden" whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        style={{ maxWidth: 1100, margin: '0 auto', padding: '100px 24px', position: 'relative', zIndex: 1 }}
      >
        <motion.div variants={fadeUp} style={{ marginBottom: 56 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FF6B00', margin: '0 0 12px' }}>
            FEATURES
          </p>
          <h2 style={{ margin: 0, maxWidth: 520 }}>
            Everything you need.<br />Nothing you don't.
          </h2>
        </motion.div>

        <div className="tf-bento-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}>
          {FEATURES.map((f, i) => <FeatureCard key={i} {...f} />)}
        </div>
      </motion.section>

      {/* ─── STATS ────────────────────────────────────────────────────────── */}
      <motion.section
        variants={stagger} initial="hidden" whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        style={{
          textAlign: 'center', padding: '80px 24px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          position: 'relative', zIndex: 1,
        }}
      >
        <div style={{
          display: 'flex', gap: 0, justifyContent: 'center',
          flexWrap: 'wrap', maxWidth: 700, margin: '0 auto',
        }}>
          {[
            { num: '50+',    label: 'Active creators' },
            { num: '2,400+', label: 'Thumbnails created' },
            { num: '15 min', label: 'Avg creation time' },
          ].map(({ num, label }, i) => (
            <motion.div key={i} variants={fadeUp} style={{
              flex: '1 1 200px', padding: '20px 32px',
              borderRight: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}>
              <div style={{
                fontSize: 'clamp(36px,4vw,52px)', fontWeight: 900,
                color: '#FF6B00', letterSpacing: '-0.04em',
                textShadow: '0 0 40px rgba(255,107,0,0.35)',
                marginBottom: 8,
              }}>
                {num}
              </div>
              <div style={{ fontSize: 15, color: '#55555e', fontWeight: 500 }}>{label}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <motion.section
        variants={stagger} initial="hidden" whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        style={{ padding: '80px 24px', position: 'relative', zIndex: 1 }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FF6B00', margin: '0 0 12px' }}>
              HOW IT WORKS
            </p>
            <h2 style={{ margin: '0 0 12px' }}>Create Thumbnails That Get Clicked</h2>
            <p style={{ fontSize: 16, color: '#55555e', margin: 0 }}>Three steps. Zero design experience needed.</p>
          </motion.div>
          <div className="tf-how-grid">
            {[
              { n: '01', title: 'Upload', desc: 'Drop any screenshot, photo, or design. ThumbFrame auto-detects YouTube dimensions and sets up your canvas instantly.' },
              { n: '02', title: 'Enhance', desc: 'AI analyzes your image and suggests improvements. One-click fixes for brightness, contrast, color, and composition.' },
              { n: '03', title: 'Export', desc: 'Download at perfect 1280×720 or test multiple variants. A/B test layouts to find what clicks more.' },
            ].map(({ n, title, desc }) => (
              <motion.div key={n} variants={fadeUp} style={{
                background: '#0c0c0f', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.06)',
                padding: '36px 32px', position: 'relative', overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,107,0,0.18)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}>
                <div style={{
                  position: 'absolute', top: 16, right: 20,
                  fontSize: 'clamp(52px,6vw,72px)', fontWeight: 900,
                  color: 'rgba(255,107,0,0.07)', lineHeight: 1, userSelect: 'none',
                  letterSpacing: '-0.04em',
                }}>{n}</div>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, marginBottom: 20,
                  background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 900, color: '#FF6B00',
                }}>{n}</div>
                <h3 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 700, color: '#f0f0f3' }}>{title}</h3>
                <p style={{ margin: 0, fontSize: 15, color: '#8a8a93', lineHeight: 1.65 }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ─── AI FEATURES 2×3 ──────────────────────────────────────────────── */}
      <motion.section
        variants={stagger} initial="hidden" whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        style={{ padding: '80px 24px', position: 'relative', zIndex: 1, borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 52 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FF6B00', margin: '0 0 12px' }}>
              AI-POWERED ANALYSIS
            </p>
            <h2 style={{ margin: 0 }}>Intelligence built into every pixel</h2>
          </motion.div>
          <div className="tf-ai-grid">
            {[
              { icon: '◉', title: 'Smart CTR Score', desc: 'Real image analysis, not guesswork. Face detection, color metrics, composition scoring — all calculated from your actual pixels.' },
              { icon: '⚠', title: 'YouTube Safe Zones', desc: 'See exactly where timestamps, progress bars, and UI elements overlap your thumbnail. No more hidden text.' },
              { icon: '📱', title: 'Multi-Device Preview', desc: 'See your thumbnail at every YouTube size simultaneously. If it works at 116px wide, it works everywhere.' },
              { icon: '👁', title: 'Color Blind Check', desc: '8% of male viewers have color vision deficiency. Preview your thumbnail through their eyes in one click.' },
              { icon: '⚡', title: 'One-Click Fixes', desc: 'Auto brighten, boost contrast, add vignette, fix white balance — each button does exactly what it says.' },
              { icon: '🎯', title: 'Niche Intelligence', desc: 'Gaming thumbnails get different advice than vlogs. The AI adapts recommendations to your content type.' },
            ].map(({ icon, title, desc }) => (
              <motion.div key={title} variants={fadeUp} style={{
                background: '#0c0c0f', borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.06)',
                padding: '28px', transition: 'border-color 0.2s, transform 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,107,0,0.2)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, marginBottom: 16,
                  background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, color: '#FF6B00',
                }}>{icon}</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#f0f0f3', letterSpacing: '-0.01em' }}>{title}</h3>
                <p style={{ margin: 0, fontSize: 14, color: '#8a8a93', lineHeight: 1.6 }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ─── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <motion.section
        variants={stagger} initial="hidden" whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        style={{ maxWidth: 1000, margin: '0 auto', padding: '80px 24px', position: 'relative', zIndex: 1 }}
      >
        <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 52 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FF6B00', margin: '0 0 12px' }}>
            TRUSTED BY CREATORS
          </p>
          <h2 style={{ margin: 0 }}>Real results from real channels</h2>
        </motion.div>

        <div className="tf-testimonials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { quote: 'I was spending 2 hours per thumbnail in Photoshop. ThumbFrame cut that to 15 minutes and the results look better.', name: 'Alex R.', sub: '45K subscribers', init: 'A', color: '#f97316' },
            { quote: "The safe zone overlay alone is worth it. I kept putting text where YouTube's timestamp was covering it. Can't believe I didn't know.", name: 'Maya L.', sub: '12K subscribers', init: 'M', color: '#22c55e' },
            { quote: "The AI actually understands gaming thumbnails. It doesn't tell me to add a face to my Minecraft builds. That's huge.", name: 'Jordan K.', sub: '89K subscribers', init: 'J', color: '#0ea5e9' },
          ].map(({ quote, name, sub, init, color }) => (
            <motion.div key={name} variants={fadeUp} style={{
              background: '#0c0c0f',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 14, padding: '28px',
            }}>
              <p style={{ fontSize: 15, color: '#8a8a93', lineHeight: 1.7, margin: '0 0 20px', fontStyle: 'italic' }}>
                "{quote}"
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: `${color}22`, border: `1px solid ${color}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color,
                }}>{init}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f3' }}>{name}</div>
                  <div style={{ fontSize: 12, color: '#55555e' }}>{sub}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ─── FINAL CTA ────────────────────────────────────────────────────── */}
      <motion.section
        variants={stagger} initial="hidden" whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        style={{
          textAlign: 'center', padding: '80px 24px 100px',
          position: 'relative', zIndex: 1, overflow: 'hidden',
          background: 'linear-gradient(180deg, transparent 0%, rgba(255,107,0,0.03) 50%, transparent 100%)',
        }}
      >
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(255,107,0,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <motion.h2 variants={fadeUp} style={{ margin: '0 0 14px', fontSize: 'clamp(28px,4vw,44px)' }}>
          Your Next Thumbnail Starts Here
        </motion.h2>
        <motion.p variants={fadeUp} style={{ fontSize: 17, color: '#8a8a93', margin: '0 0 36px', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
          Free to use. No credit card required. Pro features for creators who want more.
        </motion.p>
        <motion.div variants={fadeUp} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => go('editor')}
            style={{
              padding: '15px 36px', borderRadius: 12, border: 'none',
              background: '#FF6B00', color: '#fff',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 0 40px rgba(255,107,0,0.3)',
              fontFamily: "'Satoshi', sans-serif",
              display: 'inline-flex', alignItems: 'center', gap: 10,
              transition: 'box-shadow 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 60px rgba(255,107,0,0.45)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 40px rgba(255,107,0,0.3)'}
          >
            Open Editor — It's Free
            <ArrowRight size={18} weight="bold" />
          </button>
          <p style={{ fontSize: 13, color: '#55555e', margin: 0 }}>
            Join 500+ creators already using ThumbFrame
          </p>
        </motion.div>
      </motion.section>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Footer setPage={setPage} />
      </div>

      <style>{`
        @keyframes tf-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(255,107,0,0.8); }
          50% { opacity: 0.6; box-shadow: 0 0 4px rgba(255,107,0,0.4); }
        }

        /* ── How It Works grid ── */
        .tf-how-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        /* ── AI Features grid ── */
        .tf-ai-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        /* ── Mobile responsive ── */
        .tf-bento-wide { grid-column: span 2; }

        @media (max-width: 900px) {
          .tf-how-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .tf-ai-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .tf-hero-section {
            min-height: auto !important;
            padding-top: 120px !important;
          }
          .tf-bento-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .tf-bento-wide {
            grid-column: span 2 !important;
          }
        }
        @media (max-width: 600px) {
          .tf-bento-grid {
            grid-template-columns: 1fr !important;
          }
          .tf-bento-wide {
            grid-column: span 1 !important;
          }
          .tf-testimonials-grid {
            grid-template-columns: 1fr !important;
          }
          .tf-how-grid {
            grid-template-columns: 1fr !important;
          }
          .tf-ai-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

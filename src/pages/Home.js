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
    const driftStars = Array.from({ length: 100 }, () => {
      const isOrange = Math.random() < 0.38;
      const pick = Math.random();
      const [cr, cg, cb] = isOrange
        ? (pick < 0.5 ? [255, 106,  0] : [255, 140, 51])   // #ff6a00 / #ff8c33
        : (pick < 0.5 ? [255, 255, 255] : [224, 224, 224]); // #ffffff / #e0e0e0
      const speed = 0.1 + Math.random() * 0.4;
      const angle = Math.random() * Math.PI * 2;
      return {
        x:  Math.random() * W,
        y:  Math.random() * H,
        r:  0.5 + Math.random() * 1.0,          // 0.5–1.5px radius → 1–3px diameter
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ph: Math.random() * Math.PI * 2,
        ts: 0.4 + Math.random() * 0.8,          // twinkle speed
        cr, cg, cb,
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

      // Layer 4b — drifting ambient starfield
      driftStars.forEach(s => {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < -3) s.x = W + 3;
        else if (s.x > W + 3) s.x = -3;
        if (s.y < -3) s.y = H + 3;
        else if (s.y > H + 3) s.y = -3;
        const a = 0.65 + 0.35 * Math.sin(time * s.ts + s.ph); // oscillates 0.3–1.0
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.cr},${s.cg},${s.cb},${a})`;
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

      {/* ─── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <motion.section
        variants={stagger} initial="hidden" whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        style={{ maxWidth: 960, margin: '0 auto', padding: '100px 24px', position: 'relative', zIndex: 1 }}
      >
        <motion.div variants={fadeUp} style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#55555e', margin: 0 }}>
            WHAT CREATORS ARE SAYING
          </p>
        </motion.div>

        <div className="tf-testimonials-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {TESTIMONIALS.map((t, i) => (
            <motion.div key={i} variants={fadeUp} style={{
              background: '#0c0c0f',
              border: '1px solid rgba(255,255,255,0.06)',
              borderLeft: t.highlight ? '3px solid #FF6B00' : undefined,
              borderRadius: 12, padding: '24px 28px',
            }}>
              <p style={{
                fontSize: 15, color: '#8a8a93', lineHeight: 1.7,
                margin: '0 0 16px', fontStyle: 'normal',
              }}>
                "{t.quote}"
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(255,107,0,0.1)',
                  border: '1px solid rgba(255,107,0,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#FF6B00',
                }}>
                  {t.handle[0] === '@' ? 'Y' : 'R'}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f3' }}>{t.handle}</div>
                  <div style={{ fontSize: 12, color: '#55555e' }}>{t.sub}</div>
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
          textAlign: 'center', padding: '100px 24px 120px',
          position: 'relative', zIndex: 1, overflow: 'hidden',
        }}
      >
        {/* Glow orb */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(255,107,0,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <motion.h2 variants={fadeUp} style={{ margin: '0 0 16px' }}>
          Stop overthinking your thumbnails.
        </motion.h2>
        <motion.p variants={fadeUp} style={{ fontSize: 17, color: '#8a8a93', margin: '0 0 40px' }}>
          Join 50+ creators who make better thumbnails in less time.
        </motion.p>
        <motion.div variants={fadeUp}>
          <button
            onClick={() => go('editor')}
            style={{
              padding: '15px 36px', borderRadius: 12, border: 'none',
              background: '#FF6B00', color: '#fff',
              fontSize: 16, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 0 40px rgba(255,107,0,0.3)',
              fontFamily: "'Satoshi', sans-serif",
              display: 'inline-flex', alignItems: 'center', gap: 10,
            }}
          >
            Create Your First Thumbnail — Free
            <ArrowRight size={18} weight="bold" />
          </button>
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

        /* ── Mobile responsive ── */
        .tf-bento-wide { grid-column: span 2; }

        @media (max-width: 900px) {
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
        }
      `}</style>
    </div>
  );
}

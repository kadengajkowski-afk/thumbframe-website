import React from 'react';
import { motion } from 'framer-motion';
import {
  Lightning, Scissors, TextT, Shuffle, PaintBrush,
  Eye, Image, Palette, Sparkle, Stack,
  ArrowRight, Sliders,
} from '@phosphor-icons/react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { handleUpgrade } from '../utils/checkout';
import { useSEO } from '../hooks/useSEO';

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

const ALL_FEATURES = [
  { icon: <Lightning size={20} weight="duotone" />,  tag: 'Free', title: 'Professional Canvas',
    desc: 'Full layer system with blend modes, masks, and non-destructive editing. Everything you need for a 1280×720 image.' },
  { icon: <Scissors size={20} weight="duotone" />,   tag: 'Pro',  title: 'AI Background Removal',
    desc: 'Complex edges, messy hair, anything. One click — done in 3 seconds. No manual cleanup.' },
  { icon: <TextT size={20} weight="duotone" />,      tag: 'Free', title: 'Smart Text Engine',
    desc: '500+ fonts, custom spacing, stroke, glow effects, and text on path. Make any headline pop.' },
  { icon: <Shuffle size={20} weight="duotone" />,    tag: 'Pro',  title: 'A/B Variant Testing',
    desc: 'Create two versions of your thumbnail and test which clicks more. Your CTR will thank you.' },
  { icon: <PaintBrush size={20} weight="duotone" />, tag: 'Free', title: '12 Brush Tools',
    desc: 'Dodge, burn, heal, clone stamp, blur, sharpen, smudge. The full retouching suite.' },
  { icon: <Sparkle size={20} weight="duotone" />,    tag: 'Pro',  title: 'AI Image Generation',
    desc: 'Describe a background or element and generate it on the canvas. No external tools needed.' },
  { icon: <Eye size={20} weight="duotone" />,        tag: 'Pro',  title: 'CTR Intelligence',
    desc: 'Automatic scoring of your thumbnail\'s click potential — contrast, face visibility, text readability.' },
  { icon: <Image size={20} weight="duotone" />,      tag: 'Free', title: 'Smart Cutout + Lasso',
    desc: 'Precise AI-assisted selection tools for cutting out subjects with clean edges.' },
  { icon: <Palette size={20} weight="duotone" />,    tag: 'Free', title: 'Brand Kit',
    desc: 'Save your brand colors, fonts, and logo. Apply them with one click to any new thumbnail.' },
  { icon: <Sliders size={20} weight="duotone" />,    tag: 'Pro',  title: 'Rim Light + Liquify',
    desc: 'Add dramatic rim lighting and warp elements. The pro finishing touches that make people stop scrolling.' },
  { icon: <Stack size={20} weight="duotone" />,      tag: 'Free', title: 'Layer Blend Modes',
    desc: '16 blend modes including Multiply, Screen, Overlay, and Luminosity. Full Photoshop-grade compositing.' },
  { icon: <ArrowRight size={20} weight="duotone" />, tag: 'Free', title: 'One-Click Export',
    desc: 'Export at YouTube\'s exact 1280×720 spec as PNG or JPG. No resizing, no guessing.' },
];

function FeatureCard({ icon, tag, title, desc }) {
  const isPro = tag === 'Pro';
  return (
    <motion.div
      variants={fadeUp}
      style={{
        background: '#0c0c0f',
        borderWidth: 1, borderStyle: 'solid',
        borderColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12, padding: '24px',
      }}
      whileHover={{ y: -3, borderColor: 'rgba(255,107,0,0.18)', transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9,
          background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.13)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF6B00',
        }}>
          {icon}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999,
          background: isPro ? 'rgba(255,107,0,0.1)' : 'rgba(255,255,255,0.04)',
          border: isPro ? '1px solid rgba(255,107,0,0.22)' : '1px solid rgba(255,255,255,0.07)',
          color: isPro ? '#FF6B00' : '#55555e',
        }}>
          {tag}
        </span>
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f3', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: '#8a8a93', margin: 0, lineHeight: 1.65 }}>{desc}</p>
    </motion.div>
  );
}

export default function Features({ setPage }) {
  useSEO({
    title: 'Features — ThumbFrame',
    description: 'Every tool you need to make thumbnails that get clicked. AI background removal, A/B testing, 500+ fonts, brush tools, and more.',
    url: 'https://thumbframe.com/features',
  });

  return (
    <div style={{ background: '#050507', minHeight: '100vh', fontFamily: "'Satoshi', sans-serif", color: '#f0f0f3' }}>
      <Navbar setPage={setPage} currentPage="features" />

      {/* Hero */}
      <motion.div
        variants={stagger} initial="hidden" animate="visible"
        style={{
          textAlign: 'center',
          padding: '140px 24px 80px',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,107,0,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <motion.p variants={fadeUp} style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: '#FF6B00', margin: '0 0 16px',
        }}>
          FEATURES
        </motion.p>
        <motion.h1 variants={fadeUp} style={{ margin: '0 0 20px', maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
          Everything you need.<br />
          <span style={{ color: '#FF6B00' }}>Nothing you don't.</span>
        </motion.h1>
        <motion.p variants={fadeUp} style={{ fontSize: 17, color: '#8a8a93', margin: '0 auto 40px', maxWidth: 480, lineHeight: 1.6 }}>
          Built specifically for YouTube thumbnails. Not a full design suite you'll be lost in for an hour.
        </motion.p>
        <motion.div variants={fadeUp} style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => { setPage('editor'); window.scrollTo({ top: 0 }); }}
            style={{
              padding: '12px 26px', borderRadius: 10, border: 'none',
              background: '#FF6B00', color: '#fff', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, fontFamily: "'Satoshi', sans-serif",
              boxShadow: '0 0 24px rgba(255,107,0,0.25)',
            }}
          >
            Try it free →
          </button>
          <button
            onClick={handleUpgrade}
            style={{
              padding: '12px 22px', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'transparent', color: '#8a8a93',
              cursor: 'pointer', fontSize: 14, fontWeight: 600,
              fontFamily: "'Satoshi', sans-serif",
            }}
          >
            Start Free Trial →
          </button>
        </motion.div>
      </motion.div>

      {/* Feature grid */}
      <motion.div
        variants={stagger} initial="hidden" whileInView="visible"
        viewport={{ once: false, margin: '-60px' }}
        style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 120px' }}
      >
        {/* Free vs Pro legend */}
        <motion.div variants={fadeUp} style={{
          display: 'flex', gap: 20, marginBottom: 36, flexWrap: 'wrap',
        }}>
          {[['Free', false], ['Pro', true]].map(([label, isPro]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999,
                background: isPro ? 'rgba(255,107,0,0.1)' : 'rgba(255,255,255,0.04)',
                border: isPro ? '1px solid rgba(255,107,0,0.22)' : '1px solid rgba(255,255,255,0.07)',
                color: isPro ? '#FF6B00' : '#55555e',
              }}>
                {label}
              </span>
              <span style={{ fontSize: 13, color: '#55555e' }}>
                {isPro ? '— requires Pro plan ($15/mo)' : '— available on all plans'}
              </span>
            </div>
          ))}
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 14,
        }}>
          {ALL_FEATURES.map((f, i) => <FeatureCard key={i} {...f} />)}
        </div>

        {/* Bottom CTA */}
        <motion.div
          variants={fadeUp}
          style={{
            marginTop: 64, textAlign: 'center',
            padding: '48px 32px', borderRadius: 16,
            background: '#0c0c0f', border: '1px solid rgba(255,107,0,0.12)',
            position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 400, height: 200,
            background: 'radial-gradient(ellipse, rgba(255,107,0,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <h2 style={{ margin: '0 0 12px', fontSize: 'clamp(24px,3vw,34px)' }}>
            Ready to stop overthinking thumbnails?
          </h2>
          <p style={{ color: '#8a8a93', margin: '0 0 28px', fontSize: 15 }}>
            Free forever on the core tools. Upgrade to Pro when you need AI power.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setPage('editor'); window.scrollTo({ top: 0 }); }}
              style={{
                padding: '12px 24px', borderRadius: 10, border: 'none',
                background: '#FF6B00', color: '#fff', cursor: 'pointer',
                fontSize: 14, fontWeight: 700, fontFamily: "'Satoshi', sans-serif",
                boxShadow: '0 0 24px rgba(255,107,0,0.25)',
              }}
            >
              Start for free →
            </button>
            <button
              onClick={handleUpgrade}
              style={{
                padding: '12px 22px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent', color: '#8a8a93',
                cursor: 'pointer', fontSize: 14, fontWeight: 600,
                fontFamily: "'Satoshi', sans-serif",
              }}
            >
              Start Free Trial — 7 Days Free
            </button>
          </div>
        </motion.div>
      </motion.div>

      <Footer setPage={setPage} />
    </div>
  );
}

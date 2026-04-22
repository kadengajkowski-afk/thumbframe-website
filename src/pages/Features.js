import React, { useState, useEffect } from 'react';
import '@fontsource-variable/fraunces';
import {
  MessageCircle, TrendingUp, Scissors, Wand2, Brush, Lasso, Check,
} from 'lucide-react';
import FeaturesScene from '../landing/scenes/FeaturesScene';
import SaturnOverlay from '../landing/scenes/SaturnOverlay';
import Navbar from '../landing/components/layout/Navbar';
import Footer from '../landing/components/layout/Footer';
import { useSEO } from '../hooks/useSEO';
import { useAuth } from '../context/AuthContext';

const FRAUNCES = "'Fraunces Variable', 'Fraunces', Georgia, serif";
const INTER    = "'Inter Variable', 'Inter', system-ui, sans-serif";
const CREAM    = '#faecd0';
const AMBER    = '#f97316';

const HERO_FEATURES = [
  {
    Icon: MessageCircle,
    name: 'ThumbFriend',
    tag: 'Smart feature',
    tagline: 'Your creative partner.',
    desc: 'Five distinct personalities help you brainstorm, critique, and refine thumbnails. Canvas editing and long-term memory on Pro.',
  },
  {
    Icon: TrendingUp,
    name: 'CTR Score',
    tag: 'Analytics',
    tagline: 'Know before you publish.',
    desc: 'Analyzes your thumbnail for click-through potential. Detailed breakdowns on face detection, contrast, text legibility, and niche benchmarks.',
  },
  {
    Icon: Scissors,
    name: 'Background Remover',
    tag: 'Smart feature',
    tagline: 'One click. Gone.',
    desc: 'Cut backgrounds instantly — even hair, glass, and soft edges. Five free per month, unlimited on Pro.',
  },
  {
    Icon: Wand2,
    name: 'Auto Thumbnail',
    tag: 'Pro feature',
    tagline: 'Describe it. Get it.',
    desc: 'Type what your video is about. Get a complete thumbnail end-to-end — faces, text, composition, all laid out.',
  },
  {
    Icon: Brush,
    name: 'Brush & Spot Healing',
    tag: 'Core editor',
    tagline: 'Real editing power.',
    desc: "Paint, erase, clone, dodge, burn, sponge. All the pixel-level tools you'd expect from Photoshop — built for thumbnails.",
  },
  {
    Icon: Lasso,
    name: 'Magic Wand & Lasso',
    tag: 'Core editor',
    tagline: 'Select anything. Instantly.',
    desc: 'Color-based magic wand selection and freehand lasso. Cut out what you want, keep what matters.',
  },
];

const CATEGORIES = [
  {
    eyebrow: 'Hands-on tools',
    name: 'Paint & Edit',
    items: ['Brush', 'Eraser', 'Clone Stamp', 'Dodge', 'Burn', 'Sponge', 'Undo/Redo'],
  },
  {
    eyebrow: 'Smart shortcuts',
    name: 'Smart Shortcuts',
    items: ['Image generator', 'A/B Variants', 'Face Enhancement', 'Style Transfer', 'Text Suggestions'],
  },
  {
    eyebrow: 'Know before you ship',
    name: 'Analytics & Preview',
    items: ['CTR Score breakdown', 'YouTube Feed Simulator', 'Stamp Test', 'Expression Coach', 'Niche Presets'],
  },
  {
    eyebrow: 'The boring essentials',
    name: 'Workflow',
    items: ['12 starter templates', 'Unsplash stock photos', 'Asset packs', 'Auto-save', 'Export PNG/JPEG', 'YouTube channel integration'],
  },
];

function useWideViewport(breakpoint = 768) {
  const [wide, setWide] = useState(
    typeof window !== 'undefined' && window.innerWidth >= breakpoint
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const h = (e) => setWide(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [breakpoint]);
  return wide;
}

export default function Features({ setPage }) {
  useSEO({
    title: 'Features — ThumbFrame',
    description: 'Everything you need to design thumbnails that get clicks.',
  });

  const wide = useWideViewport();
  const { user } = useAuth();

  const handleCta = () => setPage(user ? 'editor' : 'signup');

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      fontFamily: INTER,
      color: CREAM,
    }}>
      <FeaturesScene />
      <SaturnOverlay />
      <Navbar onNavigate={setPage} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: 1100,
        margin: '0 auto',
        padding: '120px 24px 96px',
      }}>
        {/* ───────── HERO COPY ───────── */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{
            fontFamily: FRAUNCES,
            fontSize: 13, fontWeight: 500,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: CREAM, opacity: 0.7, marginBottom: 16,
          }}>
            Features
          </div>
          <h1 style={{
            fontFamily: FRAUNCES,
            fontSize: 'clamp(40px, 5.5vw, 64px)',
            fontWeight: 500, letterSpacing: '-0.02em',
            color: CREAM, lineHeight: 1.05, margin: '0 0 16px',
            textShadow: '0 4px 32px rgba(0,0,0,0.5)',
          }}>
            Everything you need.<br />Nothing you don&rsquo;t.
          </h1>
          <p style={{
            fontSize: 17, lineHeight: 1.5,
            color: CREAM, opacity: 0.8, margin: 0,
          }}>
            Built for creators who ship.
          </p>
        </div>

        {/* ───────── SIX HERO CARDS ───────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: wide ? 'repeat(2, 1fr)' : '1fr',
          gap: 24,
          marginBottom: 96,
        }}>
          {HERO_FEATURES.map((f) => <HeroCard key={f.name} feature={f} />)}
        </div>

        {/* ───────── PLUS A WHOLE LOT MORE ───────── */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{
            fontFamily: FRAUNCES,
            fontSize: 'clamp(28px, 3.5vw, 40px)',
            fontWeight: 500, letterSpacing: '-0.02em',
            color: CREAM, margin: 0, lineHeight: 1.1,
          }}>
            Plus a whole lot more.
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: wide ? 'repeat(2, 1fr)' : '1fr',
          gap: 20,
          marginBottom: 96,
        }}>
          {CATEGORIES.map((c) => <CategoryCard key={c.name} category={c} />)}
        </div>

        {/* ───────── FINAL CTA ───────── */}
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <h2 style={{
            fontFamily: FRAUNCES,
            fontSize: 'clamp(36px, 4.5vw, 52px)',
            fontWeight: 500, letterSpacing: '-0.02em',
            color: CREAM, margin: '0 0 12px', lineHeight: 1.1,
          }}>
            Ready to ship?
          </h2>
          <p style={{
            fontSize: 16, color: CREAM, opacity: 0.8,
            margin: '0 0 28px',
          }}>
            Start free. Upgrade when you&rsquo;re ready.
          </p>
          <button
            onClick={handleCta}
            style={{
              padding: '14px 32px',
              borderRadius: 10,
              border: 'none',
              background: AMBER,
              color: '#1a0a00',
              fontFamily: INTER,
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
              boxShadow: '0 0 28px -4px rgba(249,115,22,0.55), 0 4px 14px rgba(249,115,22,0.28)',
              transition: 'transform 160ms ease, box-shadow 160ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 0 36px -2px rgba(249,115,22,0.75), 0 5px 18px rgba(249,115,22,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 0 28px -4px rgba(249,115,22,0.55), 0 4px 14px rgba(249,115,22,0.28)';
            }}
          >
            Open editor →
          </button>
        </div>
      </div>

      <Footer setPage={setPage} />
    </div>
  );
}

function HeroCard({ feature }) {
  const { Icon, name, tag, tagline, desc } = feature;
  return (
    <div style={{
      padding: 28,
      borderRadius: 16,
      background: 'rgba(10, 7, 20, 0.75)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      <Icon size={38} strokeWidth={1.6} color={CREAM} style={{ opacity: 0.9, marginBottom: 16 }} />
      <h3 style={{
        fontFamily: FRAUNCES,
        fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em',
        color: CREAM, margin: '0 0 6px', lineHeight: 1.15,
      }}>
        {name}
      </h3>
      <p style={{
        fontSize: 14, fontWeight: 600,
        color: CREAM, opacity: 0.75,
        margin: '0 0 10px', lineHeight: 1.45,
      }}>
        {tagline}
      </p>
      <p style={{
        fontSize: 14, color: CREAM, opacity: 0.65,
        margin: 0, lineHeight: 1.55, flex: 1,
      }}>
        {desc}
      </p>
      {tag && (
        <span style={{
          alignSelf: 'flex-start',
          marginTop: 18,
          padding: '4px 10px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: AMBER,
          background: 'rgba(249,115,22,0.1)',
          border: '1px solid rgba(249,115,22,0.3)',
        }}>
          {tag}
        </span>
      )}
    </div>
  );
}

function CategoryCard({ category }) {
  const { eyebrow, name, items } = category;
  return (
    <div style={{
      padding: 24,
      borderRadius: 14,
      background: 'rgba(10, 7, 20, 0.72)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        color: CREAM, opacity: 0.55, marginBottom: 6,
      }}>
        {eyebrow}
      </div>
      <h3 style={{
        fontFamily: FRAUNCES,
        fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em',
        color: CREAM, margin: '0 0 16px', lineHeight: 1.15,
      }}>
        {name}
      </h3>
      <ul style={{
        listStyle: 'none', padding: 0, margin: 0,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {items.map((it, i) => (
          <li key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            fontSize: 14, lineHeight: 1.45,
            color: CREAM, opacity: 0.75,
          }}>
            <Check size={15} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2, color: AMBER, opacity: 0.85 }} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

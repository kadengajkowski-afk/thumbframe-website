import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from '@phosphor-icons/react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.09 } } };

const ROADMAP = [
  { done: true,  item: 'Canvas editor with full layer system' },
  { done: true,  item: 'AI background removal' },
  { done: true,  item: 'A/B thumbnail testing' },
  { done: true,  item: 'Brand kit + text engine' },
  { done: false, item: 'CTR tracking with YouTube API' },
  { done: false, item: 'Thumbnail templates library' },
  { done: false, item: 'Team collaboration / shared brand kits' },
  { done: false, item: 'Mobile app (iOS)' },
];

export default function About({ setPage }) {
  useSEO({
    title: 'About — ThumbFrame',
    description: 'ThumbFrame was built by Kaden, a creator who was tired of spending 2 hours per thumbnail in Photoshop. Here\'s the real story.',
    url: 'https://thumbframe.com/about',
  });

  const go = (page) => { setPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div style={{ background: '#050507', minHeight: '100vh', fontFamily: "'Satoshi', sans-serif", color: '#f0f0f3' }}>
      <Navbar setPage={setPage} currentPage="about" />

      {/* Hero — asymmetric, text-heavy */}
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '140px 24px 80px',
        display: 'grid',
        gridTemplateColumns: '1.2fr 0.8fr',
        gap: 80, alignItems: 'center',
        position: 'relative',
      }}>
        {/* Glow */}
        <div style={{
          position: 'absolute', top: 0, left: '-10%',
          width: '50%', height: '60%',
          background: 'radial-gradient(ellipse 60% 40% at 0% 50%, rgba(255,107,0,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Left text */}
        <motion.div variants={stagger} initial="hidden" animate="visible">
          <motion.p variants={fadeUp} style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#FF6B00', margin: '0 0 16px',
          }}>
            THE STORY
          </motion.p>

          <motion.h1 variants={fadeUp} style={{ margin: '0 0 28px' }}>
            Built this because<br />
            <span style={{ color: '#FF6B00' }}>Photoshop is overkill</span><br />
            for a 1280×720 image.
          </motion.h1>

          <motion.div variants={stagger} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              "I'm Kaden. I make Minecraft content and I was spending something like 2 hours per thumbnail in Photoshop. Cut out the subject, fix the edges, add text that doesn't look trash, export at the right size — every single time. For a thumbnail.",
              "At some point I looked around for a faster option. There wasn't one that actually worked. The thumbnail tools I found were either broken, ugly, or trying to be full design suites I'd get lost in.",
              "So I built ThumbFrame. Started as a side project in my bedroom, mostly for myself. Added the AI background remover because I was spending the most time on that. Added A/B testing because I had no idea which of my thumbnails would actually get clicked.",
              "Now 50+ creators use it. People are actually cancelling their Photoshop subscriptions. That's still kind of wild to me.",
            ].map((para, i) => (
              <motion.p key={i} variants={fadeUp} style={{
                fontSize: 16, color: '#8a8a93', lineHeight: 1.75, margin: 0,
              }}>
                {para}
              </motion.p>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} style={{ marginTop: 36, display: 'flex', gap: 12 }}>
            <button
              onClick={() => go('editor')}
              style={{
                padding: '12px 24px', borderRadius: 10, border: 'none',
                background: '#FF6B00', color: '#fff', cursor: 'pointer',
                fontSize: 14, fontWeight: 700, fontFamily: "'Satoshi', sans-serif",
                boxShadow: '0 0 24px rgba(255,107,0,0.25)',
                display: 'flex', alignItems: 'center', gap: 7,
              }}
            >
              Try it yourself <ArrowRight size={14} weight="bold" />
            </button>
            <a
              href="mailto:hi@thumbframe.app"
              style={{
                padding: '12px 22px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent', color: '#8a8a93',
                fontSize: 14, fontWeight: 600,
                fontFamily: "'Satoshi', sans-serif",
                textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
              }}
            >
              Say hi →
            </a>
          </motion.div>
        </motion.div>

        {/* Right — "About Kaden" card */}
        <motion.div
          initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{
            background: '#0c0c0f',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: '32px',
          }}>
            {/* Avatar placeholder */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(255,107,0,0.1)',
              border: '2px solid rgba(255,107,0,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, marginBottom: 20,
            }}>
              K
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f0f0f3', marginBottom: 4, letterSpacing: '-0.02em' }}>
              Kaden
            </div>
            <div style={{ fontSize: 13, color: '#55555e', marginBottom: 20 }}>
              Minecraft creator → accidental startup founder
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 20 }} />
            {[
              ['Channel', 'YouTube (Minecraft)'],
              ['Location', 'United States'],
              ['Building with', 'React, Node, Supabase'],
              ['Contact', 'hi@thumbframe.app'],
            ].map(([label, value]) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                fontSize: 13,
              }}>
                <span style={{ color: '#55555e' }}>{label}</span>
                <span style={{ color: '#8a8a93', fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Mission */}
      <motion.section
        variants={stagger} initial="hidden" whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          padding: '80px 24px',
        }}
      >
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <motion.p variants={fadeUp} style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#FF6B00', margin: '0 0 16px',
          }}>
            THE MISSION
          </motion.p>
          <motion.h2 variants={fadeUp} style={{ margin: '0 0 24px' }}>
            Make great thumbnails accessible<br />to every creator.
          </motion.h2>
          <motion.p variants={fadeUp} style={{ fontSize: 16, color: '#8a8a93', lineHeight: 1.75 }}>
            Big channels have full-time thumbnail designers. A creator with 2,000 subscribers doesn't. That gap
            isn't about talent — it's about tooling. ThumbFrame exists to close it. The goal is for every
            creator to be able to make a thumbnail that looks like it took a pro hours, in under 20 minutes.
          </motion.p>
        </div>
      </motion.section>

      {/* Roadmap */}
      <motion.section
        variants={stagger} initial="hidden" whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          padding: '80px 24px',
        }}
      >
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <motion.p variants={fadeUp} style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#FF6B00', margin: '0 0 16px',
          }}>
            WHAT'S NEXT
          </motion.p>
          <motion.h2 variants={fadeUp} style={{ margin: '0 0 36px' }}>Roadmap</motion.h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {ROADMAP.map(({ done, item }, i) => (
              <motion.div key={i} variants={fadeUp} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 0',
                borderBottom: i < ROADMAP.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: done ? 'rgba(255,107,0,0.12)' : 'rgba(255,255,255,0.04)',
                  border: done ? '1.5px solid rgba(255,107,0,0.35)' : '1.5px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: done ? '#FF6B00' : '#55555e',
                }}>
                  {done ? '✓' : '·'}
                </div>
                <span style={{
                  fontSize: 15, color: done ? '#f0f0f3' : '#55555e',
                  textDecoration: done ? 'none' : 'none',
                  fontWeight: done ? 500 : 400,
                }}>
                  {item}
                </span>
                {!done && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: '#55555e', background: 'rgba(255,255,255,0.04)',
                    padding: '2px 8px', borderRadius: 999,
                  }}>
                    Coming soon
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <Footer setPage={setPage} />
    </div>
  );
}

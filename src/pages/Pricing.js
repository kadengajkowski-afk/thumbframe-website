import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';
import { handleUpgrade } from '../utils/checkout';

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

const FREE_FEATURES = [
  { yes: true,  text: 'Full canvas editor' },
  { yes: true,  text: '10 saved projects' },
  { yes: true,  text: '5 AI operations / month' },
  { yes: true,  text: 'Basic export (JPG, PNG)' },
  { yes: true,  text: 'Layer system & blend modes' },
  { yes: true,  text: 'Text engine (500+ fonts)' },
  { yes: false, text: 'Unlimited AI generations', dimmed: true },
  { yes: false, text: 'CTR Intelligence scoring', dimmed: true },
  { yes: false, text: 'A/B variant generation', dimmed: true },
  { yes: false, text: 'Unlimited projects', dimmed: true },
  { yes: false, text: 'Priority support', dimmed: true },
];

const PRO_FEATURES = [
  { text: 'Everything in Free' },
  { text: 'Unlimited AI generations' },
  { text: 'CTR Intelligence scoring' },
  { text: 'A/B variant generation' },
  { text: 'Unlimited projects' },
  { text: 'AI background generation' },
  { text: 'Expression enhancement' },
  { text: 'Prompt-to-Thumbnail' },
  { text: 'Priority support' },
  { text: 'Early access to new features' },
  { text: 'Export up to 4K resolution' },
];

const FAQS = [
  {
    q: 'Can I cancel anytime?',
    a: "Yes. There are no contracts, no lock-ins. Cancel from your account settings and you'll keep Pro access until the end of your billing period.",
  },
  {
    q: 'What happens when I hit my AI limit?',
    a: "On the Free plan, once you hit 5 AI operations for the month, AI features are paused until your next billing cycle. The full canvas editor still works. Upgrade to Pro for unlimited AI.",
  },
  {
    q: 'Is there a free trial for Pro?',
    a: "Yes — new accounts get 7 days of full Pro access to try every feature. No credit card required to start. You'll only be charged if you decide to keep Pro after the trial.",
  },
  {
    q: 'Do you offer a refund?',
    a: "If you're not happy within 7 days of your first charge, email hi@thumbframe.app and we'll refund you. No questions, no friction.",
  },
  {
    q: 'Is there annual pricing?',
    a: 'Annual billing is coming soon and will save you ~20%. Sign up for the newsletter to get notified when it launches.',
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.maxHeight = open ? bodyRef.current.scrollHeight + 'px' : '0px';
    }
  }, [open]);

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', background: 'none', border: 'none', padding: '22px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', fontFamily: "'Satoshi',sans-serif",
          fontSize: 17, fontWeight: 600, color: '#f0f0f3', textAlign: 'left', gap: 16,
        }}
      >
        <span>{q}</span>
        <span style={{
          flexShrink: 0, fontSize: 22, color: '#FF6B00', lineHeight: 1,
          transform: open ? 'rotate(45deg)' : 'none',
          transition: 'transform 0.25s ease',
        }}>+</span>
      </button>
      <div
        ref={bodyRef}
        style={{
          overflow: 'hidden', maxHeight: 0,
          opacity: open ? 1 : 0,
          transition: 'max-height 300ms ease, opacity 300ms ease',
        }}
      >
        <p style={{ padding: '0 0 22px', fontSize: 15, color: '#8a8a93', lineHeight: 1.7 }}>{a}</p>
      </div>
    </div>
  );
}

export default function Pricing({ setPage }) {
  useSEO({
    title: 'Pricing — ThumbFrame Free & Pro Plans',
    description: 'ThumbFrame is free to start. Pro is $15/month for unlimited AI thumbnail generation, unlimited exports, and priority support.',
    url: 'https://thumbframe.com/pricing',
  });

  const go = (page) => { setPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div style={{ background: '#050507', minHeight: '100vh', fontFamily: "'Satoshi', sans-serif", color: '#f0f0f3' }}>
      <Navbar setPage={setPage} currentPage="pricing" />

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
          background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,107,0,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <motion.p variants={fadeUp} style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: '#FF6B00', margin: '0 0 16px',
        }}>
          PRICING
        </motion.p>
        <motion.h1 variants={fadeUp} style={{ margin: '0 0 20px', maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
          Simple pricing.<br />
          <span style={{ color: '#FF6B00' }}>No surprises.</span>
        </motion.h1>
        <motion.p variants={fadeUp} style={{ fontSize: 17, color: '#8a8a93', margin: '0 auto', maxWidth: 380, lineHeight: 1.6 }}>
          Start free. Upgrade when you need more AI power.
        </motion.p>
      </motion.div>

      {/* Pricing Cards */}
      <motion.div
        variants={stagger} initial="hidden" whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        className="tf-pricing-grid"
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 24, maxWidth: 860, margin: '0 auto 24px', padding: '0 24px',
        }}
      >
        {/* Free */}
        <motion.div variants={fadeUp} style={{
          background: '#0c0c0f', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 16, padding: '40px',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f3', marginBottom: 4 }}>Free</div>
          <p style={{ fontSize: 13, color: '#55555e', marginBottom: 24, lineHeight: 1.5 }}>
            Get started with the core editor. No credit card required.
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
            <span style={{ fontSize: 52, fontWeight: 800, color: '#f0f0f3', letterSpacing: '-0.04em', lineHeight: 1 }}>$0</span>
            <span style={{ fontSize: 14, color: '#55555e' }}>/ forever</span>
          </div>
          <p style={{ fontSize: 12, color: '#55555e', marginBottom: 28 }}>Always free.</p>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 24 }} />
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
            {FREE_FEATURES.map((f, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.4 }}>
                <span style={{ color: f.yes ? '#FF6B00' : '#55555e', fontSize: 15, flexShrink: 0, marginTop: 1 }}>{f.yes ? '✓' : '✗'}</span>
                <span style={{ color: f.dimmed ? '#55555e' : '#8a8a93', textDecoration: f.dimmed ? 'line-through' : 'none', opacity: f.dimmed ? 0.6 : 1 }}>
                  {f.text}
                </span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => go('editor')}
            style={{
              width: '100%', padding: 14, borderRadius: 9,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'transparent', color: '#f0f0f3',
              fontFamily: "'Satoshi',sans-serif", fontSize: 15, fontWeight: 600,
              cursor: 'pointer', marginTop: 'auto',
              transition: 'border-color 0.15s',
            }}
          >
            Start Free
          </button>
        </motion.div>

        {/* Pro */}
        <motion.div variants={fadeUp} style={{
          background: '#0c0c0f',
          border: '1px solid rgba(255,107,0,0.3)',
          borderRadius: 16, padding: '40px',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
          boxShadow: '0 0 60px rgba(255,107,0,0.07)',
        }}>
          {/* Trial badge */}
          <div style={{
            position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
            background: '#FF6B00', color: '#fff', borderRadius: 999,
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', padding: '4px 12px', whiteSpace: 'nowrap',
          }}>
            7-Day Free Trial
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f3', marginBottom: 4 }}>Pro</div>
          <p style={{ fontSize: 13, color: '#55555e', marginBottom: 24, lineHeight: 1.5 }}>
            Everything you need to grow your channel with great thumbnails.
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 52, fontWeight: 800, color: '#f0f0f3', letterSpacing: '-0.04em', lineHeight: 1 }}>$15</span>
            <span style={{ fontSize: 14, color: '#55555e' }}>/ month</span>
          </div>
          <p style={{ fontSize: 12, color: '#FF6B00', marginBottom: 4, fontWeight: 600 }}>after 7-day free trial</p>
          <p style={{ fontSize: 12, color: '#55555e', marginBottom: 28 }}>No credit card required. Cancel anytime.</p>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 24 }} />
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
            {PRO_FEATURES.map((f, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, lineHeight: 1.4 }}>
                <span style={{ color: '#FF6B00', fontSize: 15, flexShrink: 0, marginTop: 1 }}>✓</span>
                <span style={{ color: '#8a8a93' }}>{f.text}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={handleUpgrade}
            style={{
              width: '100%', padding: 14, borderRadius: 9, border: 'none',
              background: '#FF6B00', color: '#fff',
              fontFamily: "'Satoshi',sans-serif", fontSize: 15, fontWeight: 700,
              cursor: 'pointer', marginTop: 'auto',
              boxShadow: '0 0 28px rgba(255,107,0,0.3)',
            }}
          >
            Start Free Trial →
          </button>
        </motion.div>
      </motion.div>

      <p style={{ textAlign: 'center', fontSize: 13, color: '#55555e', marginBottom: 80 }}>
        All prices in USD · Billed monthly · Cancel anytime
      </p>

      {/* FAQ */}
      <motion.section
        variants={stagger} initial="hidden" whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '80px 24px' }}
      >
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <motion.p variants={fadeUp} style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#FF6B00', margin: '0 0 16px', textAlign: 'center',
          }}>
            FAQ
          </motion.p>
          <motion.h2 variants={fadeUp} style={{ margin: '0 0 48px', textAlign: 'center' }}>
            Common questions.
          </motion.h2>
          {FAQS.map((faq) => <FaqItem key={faq.q} q={faq.q} a={faq.a} />)}
        </div>
      </motion.section>

      {/* Bottom CTA */}
      <motion.section
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ textAlign: 'center', padding: '0 24px 100px' }}
      >
        <div style={{
          maxWidth: 560, margin: '0 auto',
          padding: '48px 32px', borderRadius: 16,
          background: '#0c0c0f', border: '1px solid rgba(255,107,0,0.12)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 400, height: 200,
            background: 'radial-gradient(ellipse, rgba(255,107,0,0.05) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <h2 style={{ margin: '0 0 12px', fontSize: 'clamp(22px,3vw,30px)' }}>Still on the fence?</h2>
          <p style={{ color: '#8a8a93', margin: '0 0 28px', fontSize: 15 }}>
            Try the full editor for free. No account required.
          </p>
          <button
            onClick={() => go('editor')}
            style={{
              padding: '13px 28px', borderRadius: 10, border: 'none',
              background: '#FF6B00', color: '#fff', cursor: 'pointer',
              fontSize: 15, fontWeight: 700, fontFamily: "'Satoshi',sans-serif",
              boxShadow: '0 0 24px rgba(255,107,0,0.25)',
            }}
          >
            Open the Editor →
          </button>
        </div>
      </motion.section>

      <style>{`
        @media (max-width: 640px) {
          .tf-pricing-grid {
            grid-template-columns: 1fr !important;
            max-width: 480px !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
        }
      `}</style>

      <Footer setPage={setPage} />
    </div>
  );
}

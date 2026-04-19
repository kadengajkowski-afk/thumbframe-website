// Per-planet HTML content — v3 Step 4.
// Conditionally rendered based on useGalaxyStore.activePlanet. Fades in
// 300 ms after the travel transition completes; fades out 300 ms on exit.
//
// All copy preserved from the v2 spec — only the layout has changed.

import React, { useEffect, useRef } from 'react';
import { useGalaxyStore } from '../state/galaxyStore';

export default function PlanetContent({ setPage }) {
  const rootRef = useRef(null);

  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      const el = rootRef.current;
      if (el) {
        const s = useGalaxyStore.getState();
        // Only fully visible when on-planet.
        let target = 0;
        if (s.transitionState === 'on-planet') target = 1;
        else if (s.transitionState === 'entering') target = Math.max(0, (s.transitionProgress - 0.7) / 0.3);
        else if (s.transitionState === 'exiting')  target = 1 - Math.min(1, s.transitionProgress / 0.4);

        const current = parseFloat(el.style.opacity || '0');
        const next = current + (target - current) * 0.18;
        el.style.opacity = String(next);
        el.style.visibility = next < 0.02 ? 'hidden' : 'visible';
        // Refresh which planet's copy to render whenever the active planet changes.
        el.dataset.planet = s.activePlanet || '';
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Reactive re-render when activePlanet changes so the correct copy block mounts.
  const activePlanet = useGalaxyStore((s) => s.activePlanet);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 clamp(24px, 6vw, 80px)',
        pointerEvents: 'none',
        opacity: 0,
        fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ width: '48%', maxWidth: 620, minWidth: 320, textShadow: '0 2px 20px rgba(10,7,20,0.85)' }}>
        {activePlanet === 'signal' && <SignalBlock setPage={setPage} />}
        {activePlanet === 'singularity' && <SingularityBlock setPage={setPage} />}
        {activePlanet === 'docking' && <DockingBlock />}
      </div>
    </div>
  );
}

// ── Per-planet copy blocks ────────────────────────────────────────────────

function SignalBlock({ setPage }) {
  return (
    <>
      <Eyebrow>Chapter 0 — Home signal</Eyebrow>
      <H2>Every thumbnail is a universe.</H2>
      <Body>
        ThumbFrame is the editor built for the one image that decides whether
        anyone clicks play. AI generation. CTR scoring. Painted with care.
      </Body>
      <CTARow>
        <CTAPrimary onClick={() => setPage && setPage('signup')}>Start free — no credit card</CTAPrimary>
      </CTARow>
    </>
  );
}

function SingularityBlock({ setPage }) {
  return (
    <>
      <Eyebrow>Chapter 1 — The singularity</Eyebrow>
      <H2>Six features. One editor.</H2>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', marginBottom: 24 }}>
        <FeatureItem name="BG Remover"   desc="Auto-clean photo backgrounds — no manual masking." />
        <CTRScoreItem />
        <FeatureItem name="A/B Variants" desc="Generate 3 takes in one shot. Pick the winner." />
        <FeatureItem name="AI Generate"  desc="Prompt → painterly thumbnail in under 10 seconds." />
        <FeatureItem name="Face Cutout"  desc="Isolate the talent. Punch through background noise." />
        <FeatureItem name="Templates"    desc="Niche packs — tech / gaming / vlog — hand-tuned." />
      </ul>
      <CTARow>
        <CTAPrimary onClick={() => setPage && setPage('signup')}>Try ThumbFrame free</CTAPrimary>
      </CTARow>
    </>
  );
}

function FeatureItem({ name, desc }) {
  return (
    <li style={{ marginBottom: 10, color: '#b8d4d0', fontSize: 15, lineHeight: 1.5 }}>
      <span style={{ color: '#ffb060', fontWeight: 600 }}>{name}</span>
      <span style={{ opacity: 0.5 }}> — </span>
      {desc}
    </li>
  );
}

// CTR Score feature — hover reveals an animated 0→87 counter (inherited
// from the v2 Science-planet concept, folded here per v3.1 scope).
function CTRScoreItem() {
  const [hover, setHover] = React.useState(false);
  const scoreRef = React.useRef(null);

  React.useEffect(() => {
    if (!hover) {
      if (scoreRef.current) scoreRef.current.textContent = '—';
      return;
    }
    const start = performance.now();
    const DURATION = 1200;
    const TARGET = 87;
    let raf = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / DURATION);
      const e = 1 - Math.pow(1 - p, 3);
      const n = Math.round(e * TARGET);
      if (scoreRef.current) {
        scoreRef.current.textContent = String(n);
        const hue = 48 - (n / TARGET) * 28;
        const sat = 20 + (n / TARGET) * 72;
        scoreRef.current.style.color = `hsl(${hue.toFixed(1)}, ${sat.toFixed(1)}%, 60%)`;
      }
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hover]);

  return (
    <li
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        marginBottom: 10,
        color: '#b8d4d0',
        fontSize: 15,
        lineHeight: 1.5,
        pointerEvents: 'auto',
        cursor: 'default',
      }}
    >
      <span style={{ color: '#ffb060', fontWeight: 600 }}>CTR Score</span>
      <span style={{ opacity: 0.5 }}> — </span>
      See click-through probability before you upload.{' '}
      <span
        ref={scoreRef}
        style={{
          display: 'inline-block',
          minWidth: 28,
          textAlign: 'right',
          fontFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif",
          fontWeight: 500,
          fontSize: 17,
          fontVariantNumeric: 'tabular-nums',
          color: '#f0e4d0',
          letterSpacing: '-0.01em',
          marginLeft: 4,
        }}
      >—</span>
      <span style={{ opacity: 0.5, fontSize: 11, marginLeft: 4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        hover
      </span>
    </li>
  );
}

function DockingBlock() {
  // Toggle state — default monthly per spec.
  const [annual, setAnnual] = React.useState(false);

  return (
    <>
      <Eyebrow>Chapter 3 — The docking station</Eyebrow>
      <H2>Fair pricing. No surprises.</H2>

      <BillingToggle annual={annual} onChange={setAnnual} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        <FreeCard />
        <ProCard annual={annual} />
      </div>

      <div style={{
        color: '#8090a0',
        fontSize: 12,
        lineHeight: 1.5,
        marginBottom: 18,
      }}>
        Cancel anytime from your dashboard. Keep Pro access through your billing period.
      </div>

      <Faq />
    </>
  );
}

function BillingToggle({ annual, onChange }) {
  const base = {
    pointerEvents: 'auto',
    background: 'transparent',
    border: '1px solid rgba(240,228,208,0.22)',
    color: '#b8d4d0',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 500,
    padding: '6px 14px',
    cursor: 'pointer',
    transition: 'background 160ms ease, color 160ms ease, border-color 160ms ease',
  };
  const active = {
    ...base,
    background: 'rgba(249,115,22,0.12)',
    color: '#f0e4d0',
    borderColor: 'rgba(249,115,22,0.55)',
  };
  return (
    <div style={{ display: 'inline-flex', borderRadius: 999, overflow: 'hidden', marginBottom: 16, gap: 0 }}>
      <button type="button" onClick={() => onChange(false)}
        style={{ ...(annual ? base : active), borderRadius: '999px 0 0 999px', borderRight: 'none' }}>
        Monthly
      </button>
      <button type="button" onClick={() => onChange(true)}
        style={{ ...(annual ? active : base), borderRadius: '0 999px 999px 0' }}>
        Annual — save 20%
      </button>
    </div>
  );
}

function FreeCard() {
  const features = [
    '5 thumbnails per month',
    'Free background remover',
    '10 starter templates',
    '1280×720 export',
    'Community support',
  ];
  return (
    <div style={{
      border: '1px solid rgba(240,228,208,0.18)',
      background: 'rgba(20,12,28,0.45)',
      borderRadius: 14,
      padding: '16px 18px',
      color: '#d8d2c0',
      fontSize: 13,
      lineHeight: 1.5,
    }}>
      <div style={{ color: '#b8d4d0', fontWeight: 600, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
        Free
      </div>
      <div style={{ color: '#f0e4d0', fontSize: 26, fontWeight: 500, marginBottom: 2 }}>
        $0 <span style={{ fontSize: 14, color: '#8090a0', marginLeft: 4 }}>/ month</span>
      </div>
      <div style={{ color: '#9ab0ad', marginBottom: 12, fontStyle: 'italic' }}>
        For creators just getting started.
      </div>
      <FeatureList features={features} />
      <CTAPrimary>Start free →</CTAPrimary>
    </div>
  );
}

function ProCard({ annual }) {
  const features = [
    'Everything in Free, plus:',
    'Unlimited thumbnails',
    'CTR scoring on every export',
    'A/B variant generator',
    'AI thumbnail generation',
    'All templates + niche packs',
    'Face cutout + auto-outline',
    'Priority AI processing',
    'No watermark',
    'Priority support',
  ];
  return (
    <div style={{
      position: 'relative',
      border: '1px solid rgba(249,115,22,0.55)',
      background: 'rgba(249,115,22,0.08)',
      borderRadius: 14,
      padding: '16px 18px',
      color: '#e8e0ce',
      fontSize: 13,
      lineHeight: 1.5,
      boxShadow: '0 0 30px -10px rgba(249,115,22,0.4)',
    }}>
      {/* Most popular badge */}
      <div style={{
        position: 'absolute',
        top: -10,
        right: 12,
        background: '#f97316',
        color: '#1a0a00',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        padding: '3px 9px',
        borderRadius: 999,
      }}>
        Most popular
      </div>

      <div style={{ color: '#f97316', fontWeight: 600, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
        Pro
      </div>
      <div style={{ color: '#f0e4d0', fontSize: 26, fontWeight: 500, marginBottom: 2 }}>
        ${annual ? '12' : '15'}
        <span style={{ fontSize: 14, color: '#8090a0', marginLeft: 4 }}>
          / month{annual ? ' (billed annually)' : ''}
        </span>
      </div>
      <div style={{ color: '#c0a890', marginBottom: 2, fontStyle: 'italic' }}>
        For creators who ship.
      </div>
      <div style={{ color: '#8090a0', fontSize: 11, marginBottom: 12 }}>
        {annual ? 'Saving 20% vs. monthly' : 'Or $12/mo billed annually — save 20%'}
      </div>

      <FeatureList features={features} highlightFirst accent />
      <CTAPrimary>Go Pro →</CTAPrimary>
    </div>
  );
}

function FeatureList({ features, highlightFirst = false, accent = false }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', marginBottom: 14 }}>
      {features.map((f, i) => {
        const isHeader = highlightFirst && i === 0;
        return (
          <li key={i} style={{
            marginBottom: 4,
            color: isHeader ? '#f0e4d0' : '#c0b8a8',
            fontWeight: isHeader ? 600 : 400,
            fontSize: isHeader ? 12 : 13,
            letterSpacing: isHeader ? '0.08em' : 'normal',
            textTransform: isHeader ? 'uppercase' : 'none',
          }}>
            {!isHeader && <span style={{ color: accent ? '#f97316' : '#7aa0b0', marginRight: 6 }}>✓</span>}
            {f}
          </li>
        );
      })}
    </ul>
  );
}

// ── Primitives ────────────────────────────────────────────────────────────

const Eyebrow = ({ children }) => (
  <div style={{ color: '#ffb060', fontSize: 12, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 18 }}>
    {children}
  </div>
);
const H2 = ({ children }) => (
  <h2 style={{
    fontFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif",
    fontWeight: 450,
    fontSize: 'clamp(30px, 3.4vw, 44px)',
    lineHeight: 1.12,
    letterSpacing: '-0.01em',
    color: '#f0e4d0',
    margin: 0,
    marginBottom: 26,
  }}>{children}</h2>
);
const Body = ({ children }) => (
  <p style={{ fontSize: 16, lineHeight: 1.6, color: '#b8d4d0', margin: 0, marginBottom: 26 }}>{children}</p>
);
const CTARow = ({ children }) => (
  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{children}</div>
);
const CTAPrimary = ({ onClick, children }) => (
  <button type="button" onClick={onClick} style={{
    pointerEvents: 'auto',
    background: '#f97316',
    color: '#1a0a00',
    fontFamily: 'inherit',
    fontWeight: 600,
    fontSize: 15,
    padding: '12px 20px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 0 24px -4px rgba(249,115,22,0.55), 0 4px 12px rgba(249,115,22,0.28)',
  }}>{children}</button>
);

function Faq() {
  const items = [
    ['How do you calculate CTR scores?', 'Trained on 10K+ labeled YouTube thumbnails. Re-ranks as you edit.'],
    ['Can I cancel anytime?', 'Yes. Month-to-month; no commitment.'],
    ['Does this work on mobile?', 'Desktop-first. Mobile editor is lightweight — most features work.'],
  ];
  return (
    <details style={{ fontSize: 13, lineHeight: 1.55, color: '#b8d4d0', pointerEvents: 'auto' }}>
      <summary style={{ cursor: 'pointer', color: '#f0e4d0', marginBottom: 10 }}>FAQ</summary>
      {items.map(([q, a], i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ color: '#f0e4d0' }}>{q}</div>
          <div style={{ opacity: 0.75 }}>{a}</div>
        </div>
      ))}
    </details>
  );
}

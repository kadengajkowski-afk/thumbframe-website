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
        {activePlanet === 'dead' && <DeadBlock />}
        {activePlanet === 'singularity' && <SingularityBlock setPage={setPage} />}
        {activePlanet === 'docking' && <DockingBlock />}
        {activePlanet === 'science' && <ScienceBlock setPage={setPage} />}
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

function DeadBlock() {
  return (
    <>
      <Eyebrow>Chapter 1 — The dead planet</Eyebrow>
      <H2>Every thumbnail tool was built for something else.</H2>
      <TriLine>
        <div>Canva was built for everything. That's the problem.</div>
        <div>Photoshop was built for magazines in 1988.</div>
        <div>Photopea was built to imitate Photoshop in 2013. It shows.</div>
      </TriLine>
      <Tag>ThumbFrame is built for exactly one thing.</Tag>
    </>
  );
}

function SingularityBlock({ setPage }) {
  const features = [
    ['BG Remover',    'Auto-clean photo backgrounds — no manual masking.'],
    ['CTR Score',     'See click-through probability before you upload.'],
    ['A/B Variants',  'Generate 3 takes in one shot. Pick the winner.'],
    ['AI Generate',   'Prompt → painterly thumbnail in under 10 seconds.'],
    ['Face Cutout',   'Isolate the talent. Punch through background noise.'],
    ['Templates',     'Niche packs — tech / gaming / vlog — hand-tuned.'],
  ];
  return (
    <>
      <Eyebrow>Chapter 2 — The singularity</Eyebrow>
      <H2>Six features. One editor.</H2>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', marginBottom: 28 }}>
        {features.map(([name, desc], i) => (
          <li key={i} style={{ marginBottom: 12, color: '#b8d4d0', fontSize: 15, lineHeight: 1.5 }}>
            <span style={{ color: '#ffb060', fontWeight: 600 }}>{name}</span>
            <span style={{ opacity: 0.5 }}> — </span>
            {desc}
          </li>
        ))}
      </ul>
      <CTARow>
        <CTAPrimary onClick={() => setPage && setPage('signup')}>Try ThumbFrame free</CTAPrimary>
      </CTARow>
    </>
  );
}

function DockingBlock() {
  return (
    <>
      <Eyebrow>Chapter 3 — The docking station</Eyebrow>
      <H2>Fair pricing. No surprises.</H2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 26 }}>
        <PriceCard
          name="Free"
          price="$0"
          desc="All manual tools. 3 AI thumbnails / month."
          cta="Start free"
        />
        <PriceCard
          name="Pro"
          price="$12"
          period="/ month"
          desc="Unlimited AI. CTR scoring. A/B variants. Face cutout."
          cta="Go Pro"
          accent
        />
      </div>
      <Faq />
    </>
  );
}

function ScienceBlock({ setPage }) {
  return (
    <>
      <Eyebrow>Chapter 4 — The science</Eyebrow>
      <H2>Score every thumbnail before you upload.</H2>
      <Body>
        Our CTR model predicts click-through probability from 10,000+
        labeled YouTube thumbnails. The score updates in real-time as you
        edit — see the number climb as you tune the composition.
      </Body>
      <CTARow>
        <CTAPrimary onClick={() => setPage && setPage('signup')}>Start free — no credit card</CTAPrimary>
      </CTARow>
    </>
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
const TriLine = ({ children }) => (
  <div style={{ color: '#b8d4d0', fontSize: 16, lineHeight: 1.65, marginBottom: 22 }}>
    {React.Children.map(children, (child, i) => (
      <div key={i} style={{ marginBottom: 6 }}>{child}</div>
    ))}
  </div>
);
const Tag = ({ children }) => (
  <div style={{ color: '#f97316', fontSize: 16, fontWeight: 600, letterSpacing: '0.01em' }}>{children}</div>
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

function PriceCard({ name, price, period, desc, cta, accent }) {
  return (
    <div style={{
      border: `1px solid ${accent ? 'rgba(249,115,22,0.55)' : 'rgba(240,228,208,0.18)'}`,
      background: accent ? 'rgba(249,115,22,0.08)' : 'rgba(20,12,28,0.45)',
      borderRadius: 14,
      padding: '16px 18px',
      fontSize: 14,
      lineHeight: 1.5,
      color: '#d8d2c0',
    }}>
      <div style={{ color: accent ? '#f97316' : '#b8d4d0', fontWeight: 600, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
        {name}
      </div>
      <div style={{ color: '#f0e4d0', fontSize: 26, fontWeight: 500, marginBottom: 2 }}>
        {price}
        {period && <span style={{ fontSize: 14, color: '#8090a0', marginLeft: 4 }}>{period}</span>}
      </div>
      <div style={{ color: '#9ab0ad', marginBottom: 14 }}>{desc}</div>
      <CTAPrimary>{cta}</CTAPrimary>
    </div>
  );
}

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

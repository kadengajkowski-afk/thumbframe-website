import React, { useState, useEffect, useRef } from 'react';
import supabase from './supabaseClient';

// ── ThumbFrame Landing Page ────────────────────────────────────────────────────
// Fonts: Syne (headings) + Plus Jakarta Sans (body)
// Skills: ui-ux-pro-max (Pattern #32 Hero-Centric + #3 Product Demo + #8 Pricing)
//         frontend-design (dark studio aesthetic, no generic AI look)

const C = {
  bg:    '#0a0a0a',
  bg2:   '#0f0f0f',
  card:  '#141414',
  card2: '#1c1c1c',
  bdr:   '#202020',
  bdr2:  '#2d2d2d',
  text:  '#f4f4f5',
  text2: '#a1a1aa',
  muted: '#52525b',
  acc:   '#f97316',
  acc2:  '#ea580c',
};
const OG   = 'linear-gradient(135deg, #f97316, #ea580c)';
const GLOW = '0 0 32px rgba(249,115,22,0.28), 0 4px 12px rgba(0,0,0,0.5)';
const FH   = '"Syne", sans-serif';
const FB   = '"Plus Jakarta Sans", sans-serif';

// ── Inject keyframes once ─────────────────────────────────────────────────────
function useStyles() {
  useEffect(() => {
    const id = 'tf-lp-css';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      @keyframes tf-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
      @keyframes tf-fadeup{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
      .tf-float{animation:tf-float 4s ease-in-out infinite}
      .tf-a1{animation:tf-fadeup .6s ease forwards}
      .tf-a2{animation:tf-fadeup .6s .1s ease both}
      .tf-a3{animation:tf-fadeup .6s .2s ease both}
      .tf-a4{animation:tf-fadeup .6s .3s ease both}
      .tf-a5{animation:tf-fadeup .6s .4s ease both}
      .tf-btn:hover{opacity:.88;transform:translateY(-1px)}
      .tf-btn{transition:all .2s}
      .tf-card:hover{transform:translateY(-3px);transition:transform .25s}
      .tf-tpl:hover{transform:scale(1.03);transition:transform .2s}
      .tf-nl:hover{color:#f4f4f5!important;transition:color .15s}
      .tf-faq:hover{background:#141414!important}
    `;
    document.head.appendChild(s);
  }, []);
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function LandingNav({ setPage, user }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  const scroll = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const links = [
    { l: 'Home',      fn: () => setPage('home') },
    { l: 'Features',  fn: () => scroll('features') },
    { l: 'Templates', fn: () => scroll('templates') },
    { l: 'Pricing',   fn: () => scroll('pricing-section') },
    { l: 'Blog',      fn: null },
    { l: 'About',     fn: null },
    { l: 'Support',   fn: null },
  ];

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
      background: scrolled ? 'rgba(10,10,10,0.88)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      borderBottom: scrolled ? `1px solid ${C.bdr}` : '1px solid transparent',
      transition: 'all .3s ease', padding: '0 28px',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <button onClick={() => setPage('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, padding: 0 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: OG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff', fontFamily: FH, boxShadow: GLOW }}>T</div>
          <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 18, color: C.text, letterSpacing: '-.3px' }}>
            Thumb<span style={{ color: C.acc }}>Frame</span>
          </span>
        </button>

        {/* Links */}
        <div style={{ display: 'flex', gap: 2 }}>
          {links.map(({ l, fn }) => (
            <button key={l} className="tf-nl" onClick={fn || undefined} style={{
              background: 'none', border: 'none', cursor: fn ? 'pointer' : 'default',
              padding: '8px 13px', borderRadius: 7,
              fontSize: 14, fontWeight: 500, fontFamily: FB,
              color: fn ? C.text2 : C.muted,
            }}>{l}</button>
          ))}
        </div>

        {/* Auth-aware CTA group */}
        {user ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="tf-btn tf-nl" onClick={() => setPage('dashboard')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 14px', borderRadius: 7,
              fontSize: 14, fontWeight: 500, fontFamily: FB, color: C.text2,
            }}>Dashboard</button>
            <button className="tf-btn" onClick={() => { supabase.auth.signOut(); setPage('home'); }} style={{
              background: 'transparent', border: `1px solid ${C.bdr2}`, cursor: 'pointer',
              padding: '8px 16px', borderRadius: 9,
              fontSize: 14, fontWeight: 600, fontFamily: FB, color: C.text2,
            }}>Log Out</button>
            <button className="tf-btn" onClick={() => setPage('editor')} style={{
              background: OG, border: 'none', cursor: 'pointer',
              padding: '9px 20px', borderRadius: 9,
              fontSize: 14, fontWeight: 700, fontFamily: FB, color: '#fff', boxShadow: GLOW,
            }}>Go to Editor</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="tf-btn" onClick={() => setPage('login')} style={{
              background: 'transparent', border: `1px solid ${C.bdr2}`, cursor: 'pointer',
              padding: '8px 18px', borderRadius: 9,
              fontSize: 14, fontWeight: 600, fontFamily: FB, color: C.text2,
            }}>Log In</button>
            <button className="tf-btn" onClick={() => setPage('signup')} style={{
              background: OG, border: 'none', cursor: 'pointer',
              padding: '9px 20px', borderRadius: 9,
              fontSize: 14, fontWeight: 700, fontFamily: FB, color: '#fff', boxShadow: GLOW,
            }}>Sign Up</button>
          </div>
        )}
      </div>
    </nav>
  );
}

// ── Editor mockup ─────────────────────────────────────────────────────────────
const THUMBS = [
  { bg: 'linear-gradient(135deg,#1e3a5f,#0d1f33)', title: '5 SECRETS', sub: "YouTube Won't Tell You", col: '#60a5fa' },
  { bg: 'linear-gradient(135deg,#7c2d12,#1c0a00)', title: 'I QUIT', sub: 'My $200K Job (here\'s why)', col: '#f97316' },
  { bg: 'linear-gradient(135deg,#14532d,#052e16)', title: '$10K MONTH', sub: 'Full breakdown inside', col: '#4ade80' },
];

function EditorMockup() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(p => (p + 1) % THUMBS.length), 2600);
    return () => clearInterval(t);
  }, []);
  const th = THUMBS[active];

  return (
    <div style={{ background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
      {/* Title bar */}
      <div style={{ background: C.card2, borderBottom: `1px solid ${C.bdr}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, background: C.bg2, borderRadius: 5, padding: '3px 10px', fontSize: 11, color: C.muted, fontFamily: FB, textAlign: 'center' }}>thumbframe.com/editor</div>
        <div style={{ background: OG, borderRadius: 5, padding: '3px 10px', fontSize: 10, fontWeight: 700, fontFamily: FB, color: '#fff' }}>LIVE</div>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <div style={{ width: 76, background: C.bg2, borderRight: `1px solid ${C.bdr}`, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 9, color: C.muted, fontFamily: FB, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Templates</div>
          {THUMBS.map((t, i) => (
            <div key={i} onClick={() => setActive(i)} style={{
              width: 60, height: 34, borderRadius: 5, background: t.bg, cursor: 'pointer',
              border: i === active ? `2px solid ${C.acc}` : `1px solid ${C.bdr}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .2s',
            }}>
              <div style={{ fontSize: 6, color: '#fff', fontFamily: FH, fontWeight: 700, textAlign: 'center', padding: '0 4px', lineHeight: 1.2 }}>{t.title}</div>
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, padding: 14, background: C.bg2 }}>
          <div style={{ width: '100%', aspectRatio: '16/9', background: th.bg, borderRadius: 8, overflow: 'hidden', position: 'relative', transition: 'background .5s' }}>
            <div style={{ position: 'absolute', right: 14, bottom: 0, width: 72, height: 100, background: 'rgba(255,255,255,0.05)', borderRadius: '50% 50% 0 0' }} />
            <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
              <div style={{ fontSize: 19, fontWeight: 800, fontFamily: FH, color: th.col, lineHeight: 1.1, textShadow: '0 2px 8px rgba(0,0,0,0.8)', transition: 'color .5s' }}>{th.title}</div>
              <div style={{ fontSize: 8, fontFamily: FB, color: 'rgba(255,255,255,0.75)', marginTop: 3, maxWidth: 110 }}>{th.sub}</div>
            </div>
          </div>
          {/* Toolbar */}
          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            {['Text','Image','Shape','Brand Kit','Export'].map(tool => (
              <div key={tool} style={{ flex: 1, padding: '5px 0', background: C.card, borderRadius: 5, fontSize: 8, fontWeight: 500, fontFamily: FB, color: C.text2, textAlign: 'center', border: `1px solid ${C.bdr}` }}>{tool}</div>
            ))}
          </div>
        </div>
      </div>

      {/* AB bar */}
      <div style={{ background: C.card2, borderTop: `1px solid ${C.bdr}`, padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: C.muted, fontFamily: FB }}>A/B Test active — <span style={{ color: '#4ade80' }}>comparing variants</span></div>
        <div style={{ background: OG, borderRadius: 5, padding: '3px 11px', fontSize: 11, fontWeight: 600, fontFamily: FB, color: '#fff', cursor: 'pointer' }}>Publish</div>
      </div>
    </div>
  );
}

// ── [S1] Hero ─────────────────────────────────────────────────────────────────
function HeroSection({ setPage, user }) {
  const scroll = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  return (
    <section style={{ background: C.bg, paddingTop: 116, paddingBottom: 80, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-5%', left: '35%', width: 560, height: 560, borderRadius: '50%', background: 'radial-gradient(circle,rgba(249,115,22,.07) 0%,transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>
          {/* Left */}
          <div>
            <div className="tf-a1">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 20, border: `1px solid ${C.bdr2}`, background: 'rgba(249,115,22,.07)', marginBottom: 26, fontSize: 12, color: C.muted, fontFamily: FB, fontWeight: 500 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
                Now in Beta — Free to start
              </div>
            </div>
            <h1 className="tf-a2" style={{ fontFamily: FH, fontWeight: 800, fontSize: 'clamp(36px,4vw,60px)', lineHeight: 1.05, color: C.text, margin: '0 0 20px', letterSpacing: '-1px' }}>
              Make thumbnails<br />
              <span style={{ color: C.acc }}>that stop</span><br />
              the scroll
            </h1>
            <p className="tf-a3" style={{ fontFamily: FB, fontSize: 17, lineHeight: 1.65, color: C.text2, margin: '0 0 36px', maxWidth: 430 }}>
              AI-powered editor with A/B testing, brand kits, and smart templates. Create click-worthy thumbnails in minutes — not hours.
            </p>
            <div className="tf-a4" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="tf-btn" onClick={() => setPage(user ? 'editor' : 'signup')} style={{ background: OG, border: 'none', cursor: 'pointer', padding: '13px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700, fontFamily: FB, color: '#fff', boxShadow: GLOW }}>
                {user ? 'Open Editor' : 'Sign Up Free'}
              </button>
              <button className="tf-btn" onClick={() => scroll('features')} style={{ background: 'transparent', border: `1px solid ${C.bdr2}`, cursor: 'pointer', padding: '13px 22px', borderRadius: 10, fontSize: 15, fontWeight: 600, fontFamily: FB, color: C.text2 }}>
                See how it works →
              </button>
            </div>
            <div className="tf-a5" style={{ marginTop: 28, display: 'flex', gap: 20 }}>
              {[['Optimized for CTR','⚡'],['Instant A/B Testing','🔀'],['Cloud-Powered Assets','☁️']].map(([label, icon]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <span style={{ fontFamily: FB, fontSize: 12, fontWeight: 500, color: C.text2 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right */}
          <div className="tf-float"><EditorMockup /></div>
        </div>
      </div>
    </section>
  );
}

// ── [S2] Feature highlights banner ────────────────────────────────────────────
function FeatureBanner() {
  const items = [
    { icon: '🎯', label: 'Optimized for CTR' },
    { icon: '🔀', label: 'Instant A/B Testing' },
    { icon: '☁️', label: 'Cloud-Powered Assets' },
    { icon: '🎨', label: 'Full Brand Kit' },
  ];
  return (
    <div style={{ background: C.bg2, borderTop: `1px solid ${C.bdr}`, borderBottom: `1px solid ${C.bdr}`, padding: '24px 32px' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', gap: 24 }}>
        {items.map(({ icon, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontFamily: FH, fontWeight: 600, fontSize: 15, color: C.text, letterSpacing: '-.2px' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── [S3] Features ─────────────────────────────────────────────────────────────
function ABVisual() {
  return (
    <div style={{ padding: 24, background: C.bg2, borderRadius: 14, border: `1px solid ${C.bdr}` }}>
      <div style={{ fontSize: 10, color: C.muted, fontFamily: FB, letterSpacing: 1, marginBottom: 18, textTransform: 'uppercase' }}>A/B Variant Engine</div>
      {[['Variant A', 70, true],['Variant B', 45, false]].map(([label, pct, lead], i) => (
        <div key={i} style={{ marginBottom: i === 0 ? 14 : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontFamily: FB, fontSize: 12, color: C.text2 }}>{label}</span>
            {lead && <span style={{ fontFamily: FB, fontSize: 11, color: '#4ade80', fontWeight: 600 }}>LEADING</span>}
          </div>
          <div style={{ height: 8, background: C.bdr, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: lead ? OG : C.bdr2, borderRadius: 4, transition: 'width 1s ease' }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 18, padding: '8px 12px', background: 'rgba(249,115,22,.06)', border: '1px solid rgba(249,115,22,.15)', borderRadius: 8 }}>
        <div style={{ fontFamily: FB, fontSize: 11, color: C.acc }}>Compare two thumbnails and see which one performs better.</div>
      </div>
    </div>
  );
}

function TemplatesVisual() {
  const cards = [
    { bg:'linear-gradient(135deg,#1e3a5f,#0d1f33)', label:'Tech Tutorial' },
    { bg:'linear-gradient(135deg,#7c2d12,#1c0a00)', label:'Reaction' },
    { bg:'linear-gradient(135deg,#14532d,#052e16)', label:'Finance' },
    { bg:'linear-gradient(135deg,#3b0764,#1e0542)', label:'Gaming' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {cards.map(({ bg, label }) => (
        <div key={label} style={{ height: 70, borderRadius: 9, background: bg, display: 'flex', alignItems: 'flex-end', padding: '8px 10px', border: `1px solid ${C.bdr}` }}>
          <span style={{ fontFamily: FB, fontSize: 10, color: 'rgba(255,255,255,.65)' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function BrandVisual() {
  return (
    <div style={{ padding: 22, background: C.bg2, borderRadius: 14, border: `1px solid ${C.bdr}` }}>
      <div style={{ fontSize: 10, color: C.muted, fontFamily: FB, letterSpacing: 1, marginBottom: 14, textTransform: 'uppercase' }}>Brand Kit</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[C.acc, '#60a5fa', '#4ade80', '#f4f4f5'].map(col => (
          <div key={col} style={{ width: 28, height: 28, borderRadius: 6, background: col, border: `1px solid ${C.bdr}` }} />
        ))}
      </div>
      <div style={{ fontFamily: FB, fontSize: 12, color: C.text2, marginBottom: 10 }}>
        Fonts: <span style={{ color: C.acc }}>Syne Bold</span> + Plus Jakarta Sans
      </div>
      <div style={{ padding: '7px 12px', background: C.card2, borderRadius: 7, fontFamily: FH, fontSize: 14, fontWeight: 700, color: C.text }}>YourChannel</div>
    </div>
  );
}

function AnalyticsVisual() {
  const bars = [55, 70, 48, 80, 95, 62, 74];
  return (
    <div style={{ padding: 22, background: C.bg2, borderRadius: 14, border: `1px solid ${C.bdr}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 28, color: C.acc }}>CTR</div>
          <div style={{ fontFamily: FB, fontSize: 11, color: C.muted }}>Track click-through rate</div>
        </div>
        <div style={{ fontFamily: FB, fontSize: 12, color: '#4ade80' }}>Real-time data</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48, marginBottom: 6 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, background: i === 4 ? OG : C.bdr2, borderRadius: '3px 3px 0 0', transition: 'height .3s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} style={{ flex: 1, fontSize: 9, fontFamily: FB, color: C.muted, textAlign: 'center' }}>{d}</div>
        ))}
      </div>
    </div>
  );
}

const FEATURES = [
  { icon:'⚡', title:'A/B Variant Engine', desc:'Upload two thumbnail variants and compare performance side by side. See which version drives more clicks on your videos.', tags:['Compare variants','Track performance','Pick winners'], Visual: ABVisual },
  { icon:'🎨', title:'Smart Templates', desc:'Ready-made templates designed for YouTube thumbnails. Apply a style in one click, then customize text, colors, and layout.', tags:['Multiple styles','Quick customization','YouTube-optimized'], Visual: TemplatesVisual },
  { icon:'🔖', title:'Brand Kit', desc:'Save your colors, fonts, and logo once. Every thumbnail you create stays on-brand automatically.', tags:['Custom fonts','Color palette','Logo placement'], Visual: BrandVisual },
  { icon:'📊', title:'Analytics Dashboard', desc:'Track impressions and CTR across your thumbnails. See what works and iterate on your best-performing designs.', tags:['CTR tracking','Performance overview','Data-driven decisions'], Visual: AnalyticsVisual },
];

function FeaturesSection() {
  return (
    <section id="features" style={{ background: C.bg, padding: '100px 32px' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
          <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, border: `1px solid ${C.bdr2}`, background: 'rgba(249,115,22,.06)', fontSize: 12, color: C.muted, fontFamily: FB, fontWeight: 500, marginBottom: 16 }}>Everything you need</div>
          <h2 style={{ fontFamily: FH, fontWeight: 800, fontSize: 'clamp(28px,3.5vw,48px)', color: C.text, margin: 0, letterSpacing: '-.5px' }}>
            Built for creators who<br /><span style={{ color: C.acc }}>take clicks seriously</span>
          </h2>
        </div>

        {FEATURES.map(({ icon, title, desc, tags, Visual }, i) => {
          const copy = (
            <div>
              <div style={{ fontSize: 34, marginBottom: 14 }}>{icon}</div>
              <h3 style={{ fontFamily: FH, fontWeight: 700, fontSize: 28, color: C.text, margin: '0 0 14px', letterSpacing: '-.3px' }}>{title}</h3>
              <p style={{ fontFamily: FB, fontSize: 15, color: C.text2, lineHeight: 1.7, margin: '0 0 22px' }}>{desc}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {tags.map(tag => (
                  <span key={tag} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.bdr2}`, background: C.card, fontSize: 12, fontFamily: FB, color: C.text2 }}>{tag}</span>
                ))}
              </div>
            </div>
          );
          const visual = <Visual />;
          return (
            <div key={title} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center', marginBottom: i < FEATURES.length - 1 ? 80 : 0 }}>
              {i % 2 === 0 ? <>{copy}{visual}</> : <>{visual}{copy}</>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── [S4] Template showcase ────────────────────────────────────────────────────
const GALLERY = [
  { bg:'linear-gradient(135deg,#1e3a5f,#0d1f33)', title:'5 SECRETS', sub:"YouTube Won't Tell You", cat:'Tutorial' },
  { bg:'linear-gradient(135deg,#7c2d12,#1c0a00)', title:'I QUIT My Job', sub:'At 28 Years Old', cat:'Vlog' },
  { bg:'linear-gradient(135deg,#14532d,#052e16)', title:'$10K MONTH', sub:'Passive Income Breakdown', cat:'Finance' },
  { bg:'linear-gradient(135deg,#3b0764,#1e0542)', title:'SPEEDRUN', sub:'World Record Attempt', cat:'Gaming' },
  { bg:'linear-gradient(135deg,#78350f,#1c0a00)', title:'HONEST REVIEW', sub:'After 90 Days', cat:'Review' },
  { bg:'linear-gradient(135deg,#164e63,#0c2a36)', title:'HOW I ACTUALLY', sub:'Learned to Code in 30 Days', cat:'Dev' },
  { bg:'linear-gradient(135deg,#1e1b4b,#0d0b26)', title:'TIER LIST', sub:'Every VS Code Extension', cat:'Dev' },
  { bg:'linear-gradient(135deg,#4c0519,#1c0009)', title:'REACTING TO', sub:'Your Setups 2024', cat:'Reaction' },
  { bg:'linear-gradient(135deg,#052e16,#001408)', title:'FREE TOOLS', sub:'Pros Use Daily', cat:'Productivity' },
  { bg:'linear-gradient(135deg,#1c1917,#0a0907)', title:'MINIMALIST', sub:'Productivity System', cat:'Lifestyle' },
];

function TemplatesSection({ setPage }) {
  const ref = useRef(null);
  return (
    <section id="templates" style={{ background: C.bg2, padding: '100px 0' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 32px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, border: `1px solid ${C.bdr2}`, background: 'rgba(249,115,22,.06)', fontSize: 12, color: C.muted, fontFamily: FB, marginBottom: 16 }}>Template library</div>
            <h2 style={{ fontFamily: FH, fontWeight: 800, fontSize: 'clamp(26px,3.2vw,44px)', color: C.text, margin: 0, letterSpacing: '-.5px' }}>
              Pick a template.<br /><span style={{ color: C.acc }}>Make it yours in 60 seconds.</span>
            </h2>
          </div>
          <button className="tf-btn" onClick={() => setPage('editor')} style={{ background: 'transparent', border: `1px solid ${C.bdr2}`, cursor: 'pointer', padding: '10px 22px', borderRadius: 9, fontSize: 14, fontWeight: 600, fontFamily: FB, color: C.text2 }}>
            Browse all templates →
          </button>
        </div>
      </div>

      <div ref={ref} style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '0 32px 8px', scrollbarWidth: 'none' }}>
        {GALLERY.map(({ bg, title, sub, cat }) => (
          <div key={title} className="tf-tpl" style={{ flex: '0 0 230px', height: 130, borderRadius: 10, background: bg, position: 'relative', overflow: 'hidden', cursor: 'pointer', border: `1px solid ${C.bdr}` }}>
            <div style={{ position: 'absolute', right: 8, bottom: 0, width: 62, height: 88, background: 'rgba(255,255,255,.05)', borderRadius: '40% 40% 0 0' }} />
            <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <div style={{ fontFamily: FH, fontWeight: 800, fontSize: 15, color: '#fff', lineHeight: 1.1, maxWidth: 120 }}>{title}</div>
              <div style={{ fontFamily: FB, fontSize: 8, color: 'rgba(255,255,255,.55)', marginTop: 3, maxWidth: 110 }}>{sub}</div>
            </div>
            <div style={{ position: 'absolute', top: 8, right: 8, padding: '2px 7px', borderRadius: 4, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)', fontSize: 9, fontFamily: FB, color: 'rgba(255,255,255,.65)' }}>{cat}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── [S5] Pricing ──────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: 'Starter', price: 'Free', period: 'forever', primary: false,
    desc: 'Basic canvas to get started.',
    features: ['Basic thumbnail canvas','Standard export quality','Community support'],
    cta: 'Get started free',
  },
  {
    name: 'Pro Creator', price: '$15', period: '/month', primary: true, badge: 'Most popular',
    desc: 'Everything you need to grow your channel.',
    features: ['A/B Variant Engine','Full Brand Kit (fonts, colors, logo)','Unlimited exports','All templates','No watermarks','Priority support'],
    cta: 'Upgrade to Pro Creator',
  },
];

function PricingSection({ setPage, onCheckout }) {
  return (
    <section id="pricing-section" style={{ background: C.bg, padding: '100px 32px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, border: `1px solid ${C.bdr2}`, background: 'rgba(249,115,22,.06)', fontSize: 12, color: C.muted, fontFamily: FB, marginBottom: 16 }}>Simple pricing</div>
          <h2 style={{ fontFamily: FH, fontWeight: 800, fontSize: 'clamp(28px,3.5vw,48px)', color: C.text, margin: 0, letterSpacing: '-.5px' }}>
            Start free. Upgrade when<br /><span style={{ color: C.acc }}>you're ready to scale.</span>
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
          {PLANS.map(({ name, price, period, primary, badge, desc, features, cta }) => (
            <div key={name} style={{
              background: primary ? 'linear-gradient(135deg,rgba(249,115,22,.09),rgba(234,88,12,.04))' : C.card,
              border: primary ? '1px solid rgba(249,115,22,.32)' : `1px solid ${C.bdr}`,
              borderRadius: 16, padding: 30, position: 'relative',
              boxShadow: primary ? GLOW : 'none',
            }}>
              {badge && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: OG, padding: '4px 16px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: FB, color: '#fff', whiteSpace: 'nowrap' }}>{badge}</div>
              )}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 18, color: C.text, marginBottom: 4 }}>{name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontFamily: FH, fontWeight: 800, fontSize: 38, color: primary ? C.acc : C.text }}>{price}</span>
                  <span style={{ fontFamily: FB, fontSize: 13, color: C.muted }}>{period}</span>
                </div>
                <div style={{ fontFamily: FB, fontSize: 13, color: C.muted }}>{desc}</div>
              </div>
              <button className="tf-btn" onClick={primary ? onCheckout : () => setPage('editor')} style={{
                width: '100%', padding: '12px 0', borderRadius: 9,
                background: primary ? OG : 'transparent',
                border: primary ? 'none' : `1px solid ${C.bdr2}`,
                cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: FB,
                color: primary ? '#fff' : C.text2, marginBottom: 22,
                boxShadow: primary ? GLOW : 'none',
              }}>{cta}</button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <span style={{ color: '#4ade80', fontSize: 13, marginTop: 1, flexShrink: 0 }}>✓</span>
                    <span style={{ fontFamily: FB, fontSize: 13, color: C.text2, lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── [S6] FAQ ──────────────────────────────────────────────────────────────────
const FAQS = [
  ['Is ThumbFrame free to use?', 'Yes — the Starter plan gives you a basic canvas at no cost. Sign up and start creating right away, no credit card needed.'],
  ['Can I use my own fonts and colors?', 'With Pro Creator, you get a full Brand Kit — upload custom fonts, set your color palette, and add your logo.'],
  ['How does A/B testing work?', 'Upload two thumbnail variants for the same video. ThumbFrame tracks which one gets more clicks so you can pick the winner.'],
  ['What can I export?', 'You can export your thumbnails as PNG images, sized for YouTube (1280×720).'],
  ['Can I cancel anytime?', 'Yes. No contracts, no cancellation fees. Cancel from your dashboard anytime.'],
  ['How much is Pro Creator?', '$15/month. Includes the A/B Variant Engine, full Brand Kit, unlimited exports, and no watermarks.'],
];

function FAQSection() {
  const [open, setOpen] = useState(null);
  return (
    <section id="faq" style={{ background: C.bg2, padding: '100px 32px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2 style={{ fontFamily: FH, fontWeight: 800, fontSize: 'clamp(26px,3.2vw,42px)', color: C.text, margin: 0, letterSpacing: '-.5px' }}>
            Frequently asked <span style={{ color: C.acc }}>questions</span>
          </h2>
        </div>
        {FAQS.map(([q, a], i) => (
          <div key={i} style={{ borderBottom: `1px solid ${C.bdr}` }}>
            <button className="tf-faq" onClick={() => setOpen(open === i ? null : i)} style={{
              width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
            }}>
              <span style={{ fontFamily: FH, fontWeight: 600, fontSize: 16, color: C.text, letterSpacing: '-.2px' }}>{q}</span>
              <span style={{ fontSize: 20, color: C.muted, flexShrink: 0, display: 'inline-block', transition: 'transform .25s', transform: open === i ? 'rotate(45deg)' : 'none' }}>+</span>
            </button>
            <div style={{ maxHeight: open === i ? 180 : 0, overflow: 'hidden', transition: 'max-height .3s ease' }}>
              <div style={{ fontFamily: FB, fontSize: 14, color: C.text2, lineHeight: 1.7, paddingBottom: 20 }}>{a}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── [S7] Footer ───────────────────────────────────────────────────────────────
function FooterSection({ setPage }) {
  const scroll = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const cols = [
    { t: 'Product',  links: ['Features','Templates','Pricing','Changelog'],  fns: [()=>scroll('features'),()=>scroll('templates'),()=>setPage('pricing'),null] },
    { t: 'Company',  links: ['About','Blog','Careers','Contact'],            fns: [null,null,null,null] },
    { t: 'Support',  links: ['Help Center','Terms','Privacy','Status'],      fns: [null,null,null,null] },
  ];
  return (
    <footer style={{ background: C.bg, borderTop: `1px solid ${C.bdr}`, padding: '64px 32px 36px' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: OG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', fontFamily: FH }}>T</div>
              <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 17, color: C.text }}>Thumb<span style={{ color: C.acc }}>Frame</span></span>
            </div>
            <p style={{ fontFamily: FB, fontSize: 13, color: C.muted, lineHeight: 1.65, maxWidth: 230, margin: '0 0 16px' }}>The professional thumbnail editor for creators who take their channel seriously.</p>
            <div style={{ fontFamily: FB, fontSize: 12, color: C.muted, marginBottom: 14 }}>support@thumbframe.com</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {['𝕏','▶','in'].map(icon => (
                <div key={icon} style={{ width: 32, height: 32, borderRadius: 7, background: C.card, border: `1px solid ${C.bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: C.muted, cursor: 'pointer', fontFamily: 'serif' }}>{icon}</div>
              ))}
            </div>
          </div>
          {/* Link cols */}
          {cols.map(({ t, links, fns }) => (
            <div key={t}>
              <div style={{ fontFamily: FH, fontWeight: 600, fontSize: 13, color: C.text, marginBottom: 14, letterSpacing: '.4px' }}>{t}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {links.map((link, i) => (
                  <button key={link} onClick={fns[i] || undefined} style={{ background: 'none', border: 'none', padding: 0, fontFamily: FB, fontSize: 13, color: C.muted, cursor: fns[i] ? 'pointer' : 'default', textAlign: 'left' }}>{link}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${C.bdr}`, paddingTop: 22, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontFamily: FB, fontSize: 12, color: C.muted }}>© 2024 ThumbFrame. All rights reserved.</div>
          <div style={{ fontFamily: FB, fontSize: 12, color: C.muted }}>Made with ♥ for creators</div>
        </div>
      </div>
    </footer>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function LandingPage({ setPage, onCheckout }) {
  useStyles();
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: FB }}>
      <LandingNav setPage={setPage} user={user} />
      <HeroSection setPage={setPage} user={user} />
      <FeatureBanner />
      <FeaturesSection />
      <TemplatesSection setPage={setPage} />
      <PricingSection setPage={setPage} onCheckout={onCheckout} />
      <FAQSection />
      <FooterSection setPage={setPage} />
    </div>
  );
}

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { useSEO } from '../hooks/useSEO';
import { handleUpgrade } from '../utils/checkout';

const homeStyles = `
  /* ── Hero ────────────────────────────────────────────────────────────── */
  .tf-hero {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 120px 24px 80px;
    position: relative;
    overflow: hidden;
  }
  .tf-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,107,0,0.06) 0%, transparent 70%);
    pointer-events: none;
  }
  .tf-hero-badge {
    margin-bottom: 28px;
  }
  .tf-hero h1 {
    font-size: var(--text-hero);
    letter-spacing: -0.03em;
    line-height: 1.05;
    max-width: 760px;
    margin-bottom: 24px;
  }
  .tf-hero-sub {
    font-size: 18px;
    color: var(--text-secondary);
    max-width: 520px;
    line-height: 1.7;
    margin-bottom: 40px;
  }
  .tf-hero-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 64px;
  }
  .tf-hero-img-wrap {
    width: 100%;
    max-width: 900px;
    position: relative;
  }
  .tf-hero-img-glow {
    position: absolute;
    inset: -2px;
    border-radius: 18px;
    background: radial-gradient(ellipse 60% 40% at 50% 100%, rgba(255,107,0,0.18) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
  .tf-hero-img {
    width: 100%;
    border-radius: 16px;
    border: 1px solid var(--border);
    box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,107,0,0.08);
    transform: perspective(1200px) rotateX(4deg) rotateY(-2deg);
    display: block;
    position: relative;
    z-index: 1;
    background: var(--bg-tertiary);
    aspect-ratio: 16/10;
    object-fit: cover;
  }
  .tf-hero-img-placeholder {
    width: 100%;
    aspect-ratio: 16/10;
    border-radius: 16px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    transform: perspective(1200px) rotateX(4deg) rotateY(-2deg);
    box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,107,0,0.08);
    position: relative;
    z-index: 1;
  }
  .tf-hero-img-placeholder span:first-child {
    font-size: 48px;
    opacity: 0.3;
  }
  .tf-hero-img-placeholder span:last-child {
    font-size: 13px;
    color: var(--text-muted);
    font-family: var(--font-body);
  }
  .tf-trust-bar {
    margin-top: 32px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: var(--text-muted);
  }
  .tf-trust-dots {
    display: flex;
    gap: -4px;
  }
  .tf-trust-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--bg-tertiary);
    border: 2px solid var(--bg-primary);
    display: inline-block;
    margin-left: -6px;
  }
  .tf-trust-dot:first-child { margin-left: 0; background: #FF6B00; opacity: 0.7; }
  .tf-trust-dot:nth-child(2) { background: #FF8533; opacity: 0.6; }
  .tf-trust-dot:nth-child(3) { background: #FFA060; opacity: 0.5; }
  .tf-trust-dot:nth-child(4) { background: #A3A3A3; opacity: 0.4; }

  /* ── Problem / Solution ───────────────────────────────────────────────── */
  .tf-problem-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    margin-top: 48px;
  }
  .tf-problem-icon {
    font-size: 28px;
    margin-bottom: 16px;
    display: block;
  }
  .tf-problem-title {
    font-size: 18px;
    font-family: var(--font-display);
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 10px;
    letter-spacing: -0.02em;
  }
  .tf-problem-body {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.65;
  }

  /* ── Feature Showcase ────────────────────────────────────────────────── */
  .tf-features-list {
    display: flex;
    flex-direction: column;
    gap: 80px;
    margin-top: 64px;
  }
  .tf-feature-row {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 64px;
    align-items: center;
  }
  .tf-feature-row.reverse {
    grid-template-columns: 2fr 3fr;
    direction: rtl;
  }
  .tf-feature-row.reverse > * {
    direction: ltr;
  }
  .tf-feature-text {}
  .tf-feature-text .badge {
    margin-bottom: 16px;
  }
  .tf-feature-text h3 {
    font-size: 28px;
    margin-bottom: 14px;
    line-height: 1.2;
  }
  .tf-feature-text p {
    font-size: 15px;
    color: var(--text-secondary);
    line-height: 1.7;
  }
  .tf-feature-screenshot-placeholder {
    aspect-ratio: 16/10;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  .tf-feature-screenshot-placeholder::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(110deg, transparent 30%, rgba(255,107,0,0.03) 50%, transparent 70%);
    animation: tf-shimmer 3s ease-in-out infinite;
  }
  @keyframes tf-shimmer {
    0%, 100% { opacity: 0; }
    50% { opacity: 1; }
  }
  .tf-feature-screenshot-placeholder span {
    font-size: 13px;
    color: var(--text-muted);
    font-family: var(--font-body);
  }

  /* ── Gallery Preview ─────────────────────────────────────────────────── */
  .tf-gallery-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-top: 48px;
  }
  .tf-gallery-card {
    aspect-ratio: 16/9;
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
    cursor: pointer;
    transition: transform var(--transition-base), border-color var(--transition-base);
  }
  .tf-gallery-card:hover {
    transform: translateY(-3px) scale(1.01);
    border-color: var(--border-hover);
  }
  .tf-gallery-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,107,0,0.03) 0%, transparent 60%);
  }
  .tf-gallery-card-label {
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-body);
    z-index: 1;
    text-align: center;
    padding: 8px;
  }

  /* ── Testimonials ────────────────────────────────────────────────────── */
  .tf-testimonials-scroll {
    display: flex;
    gap: 20px;
    overflow-x: auto;
    padding-bottom: 16px;
    margin-top: 48px;
    scrollbar-width: none;
  }
  .tf-testimonials-scroll::-webkit-scrollbar { display: none; }
  .tf-testimonial-card {
    flex-shrink: 0;
    width: 340px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 28px;
    transition: border-color var(--transition-base), transform var(--transition-base);
  }
  .tf-testimonial-card:hover {
    border-color: var(--border-hover);
    transform: translateY(-2px);
  }
  .tf-testimonial-stars {
    color: var(--accent);
    font-size: 14px;
    margin-bottom: 14px;
  }
  .tf-testimonial-quote {
    font-size: 15px;
    color: var(--text-secondary);
    line-height: 1.65;
    margin-bottom: 20px;
  }
  .tf-testimonial-author {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .tf-testimonial-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }
  .tf-testimonial-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    font-family: var(--font-display);
  }
  .tf-testimonial-sub {
    font-size: 12px;
    color: var(--text-muted);
  }

  /* ── Pricing Preview ─────────────────────────────────────────────────── */
  .tf-pricing-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    max-width: 800px;
    margin: 48px auto 0;
  }
  .tf-pricing-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    padding: 36px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: relative;
    transition: all var(--transition-base);
  }
  .tf-pricing-card.pro {
    border-color: rgba(255,107,0,0.25);
    box-shadow: 0 0 40px rgba(255,107,0,0.07);
  }
  .tf-pricing-card.pro:hover {
    box-shadow: 0 0 60px rgba(255,107,0,0.12);
  }
  .tf-pricing-popular {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
  }
  .tf-pricing-tier {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
  }
  .tf-pricing-price {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }
  .tf-pricing-price .amount {
    font-family: var(--font-display);
    font-size: 44px;
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1;
    letter-spacing: -0.03em;
  }
  .tf-pricing-price .period {
    font-size: 14px;
    color: var(--text-muted);
  }
  .tf-pricing-desc {
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.5;
  }
  .tf-pricing-features {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tf-pricing-features li {
    font-size: 14px;
    color: var(--text-secondary);
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .tf-pricing-features li span.check {
    color: var(--success);
    font-size: 15px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .tf-pricing-btn {
    width: 100%;
    padding: 13px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-base);
    margin-top: auto;
  }
  .tf-pricing-btn:hover {
    border-color: var(--border-hover);
    background: var(--bg-hover);
  }
  .tf-pricing-btn.pro-btn {
    background: var(--accent-gradient);
    border: none;
    color: #fff;
    box-shadow: var(--shadow-accent);
  }
  .tf-pricing-btn.pro-btn:hover {
    box-shadow: 0 0 50px rgba(255,107,0,0.2);
    transform: translateY(-1px);
  }

  /* ── Final CTA ──────────────────────────────────────────────────────── */
  .tf-cta-section {
    position: relative;
    text-align: center;
    padding: var(--space-30) 24px;
    overflow: hidden;
  }
  .tf-cta-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 600px;
    height: 400px;
    background: radial-gradient(ellipse at center, rgba(255,107,0,0.1) 0%, transparent 70%);
    pointer-events: none;
  }
  .tf-cta-section h2 {
    font-size: clamp(32px, 4vw, 52px);
    margin-bottom: 20px;
    position: relative;
    z-index: 1;
  }
  .tf-cta-section p {
    font-size: 16px;
    color: var(--text-secondary);
    margin-bottom: 36px;
    position: relative;
    z-index: 1;
  }
  .tf-cta-section .btn {
    position: relative;
    z-index: 1;
    font-size: 16px;
  }

  /* ── Section headings ────────────────────────────────────────────────── */
  .tf-section-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 12px;
    font-family: var(--font-body);
  }
  .tf-section-h2 {
    font-size: clamp(28px, 3.5vw, 44px);
    line-height: 1.1;
    letter-spacing: -0.03em;
    margin-bottom: 16px;
  }
  .tf-section-sub {
    font-size: 16px;
    color: var(--text-secondary);
    line-height: 1.65;
    max-width: 540px;
  }

  /* ── Responsive ──────────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .tf-problem-grid { grid-template-columns: 1fr; }
    .tf-feature-row,
    .tf-feature-row.reverse { grid-template-columns: 1fr; direction: ltr; gap: 32px; }
    .tf-gallery-grid { grid-template-columns: repeat(2, 1fr); }
    .tf-pricing-grid { grid-template-columns: 1fr; max-width: 400px; }
  }
  @media (max-width: 480px) {
    .tf-gallery-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .tf-hero { padding: 100px 16px 60px; }
    .tf-hero h1 { font-size: clamp(28px, 8vw, 42px); }
    .tf-hero-sub { font-size: 16px; }
    .tf-features-list { gap: 48px; }
    .tf-feature-row, .tf-feature-row.reverse { grid-template-columns: 1fr; direction: ltr; gap: 24px; }
    .tf-section-h2 { font-size: clamp(24px, 6vw, 36px); }
    .tf-pricing-grid { grid-template-columns: 1fr; max-width: 360px; }
    .tf-pricing-card.pro { order: -1; }
    .container { padding: 60px 16px; }
    .section { padding: 64px 16px !important; }
  }
  /* Swipeable testimonials */
  .tf-testimonial-carousel {
    position: relative;
    overflow: hidden;
  }
  .tf-testimonial-track {
    display: flex;
    transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
    will-change: transform;
  }
  .tf-testimonial-track .tf-testimonial-card {
    flex-shrink: 0;
    width: 340px;
  }
  @media (max-width: 640px) {
    .tf-testimonial-track .tf-testimonial-card { width: calc(100vw - 48px); }
  }
  .tf-carousel-dots {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin-top: 24px;
  }
  .tf-carousel-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--border);
    border: none;
    cursor: pointer;
    padding: 0;
    transition: background 0.2s, transform 0.2s;
    min-height: unset;
    min-width: unset;
  }
  .tf-carousel-dot.active {
    background: var(--accent);
    transform: scale(1.4);
  }
`;

const PROBLEMS = [
  {
    icon: '⏱',
    title: 'Photoshop takes forever',
    body: 'You spend 3 hours on a thumbnail that might not even perform. The feedback loop is broken and momentum dies.',
  },
  {
    icon: '🎨',
    title: 'Generic templates look amateur',
    body: 'Canva templates are used by thousands of creators. Your thumbnail looks like everyone else\'s — and viewers can tell.',
  },
  {
    icon: '📊',
    title: 'You\'re guessing on CTR',
    body: 'You ship the thumbnail hoping it clicks. There\'s no data, no feedback, no way to know if it\'ll work before it goes live.',
  },
];

const FEATURES = [
  {
    badge: 'AI',
    title: 'AI-Powered Editing',
    body: 'Remove backgrounds, enhance expressions, generate elements, and apply studio-quality effects with a single prompt. No Photoshop skills required.',
  },
  {
    badge: 'Editor',
    title: 'Professional Editor',
    body: 'A canvas editor built for thumbnails. Full layer system, blend modes, masking, a text engine with 500+ fonts, and every tool you\'d expect from a pro tool.',
    reverse: true,
  },
  {
    badge: 'Generate',
    title: 'Prompt-to-Thumbnail',
    body: 'Describe your thumbnail idea in plain English. Our AI generates a complete, polished thumbnail you can tweak and export in under a minute.',
  },
  {
    badge: 'Analytics',
    title: 'CTR Intelligence',
    body: 'Before you upload, get an AI-powered CTR score with specific recommendations. Know which elements are working and which ones hurt your click rate.',
    reverse: true,
  },
  {
    badge: 'A/B Test',
    title: 'One-Click Variants',
    body: 'Generate multiple thumbnail variations from a single design. Test different colors, text, or compositions — and let YouTube\'s algorithm tell you which wins.',
  },
];

const TESTIMONIALS = [
  {
    quote: "I went from spending 4 hours per thumbnail to 25 minutes. The AI background removal alone is worth the subscription.",
    name: 'Alex R.',
    subs: '180K subscribers',
    emoji: '🎮',
  },
  {
    quote: "The CTR scoring actually works. Changed the font on one thumbnail based on the feedback and went from 3.2% to 6.1% CTR.",
    name: 'Sarah T.',
    subs: '92K subscribers',
    emoji: '🍳',
  },
  {
    quote: "Finally a thumbnail tool built by someone who actually makes YouTube videos. Every feature makes sense.",
    name: 'Marcus L.',
    subs: '340K subscribers',
    emoji: '💪',
  },
];

function FeatureMockup({ index }) {
  const base = { className: 'tf-feature-screenshot-placeholder', style: { alignItems: 'stretch', padding: 0, overflow: 'hidden', gap: 0, flexDirection: 'column' } };

  if (index === 0) { // AI Editing
    return (
      <div {...base}>
        <div style={{ background: '#0f0f0f', borderBottom: '1px solid #1e1e1e', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 9, color: '#f97316', fontWeight: 700, fontFamily: 'monospace' }}>✦ AI TOOLS</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#141414', padding: 20, gap: 16 }}>
          <div style={{ position: 'relative', width: 100, aspectRatio: '1', borderRadius: 8, overflow: 'hidden', border: '1px solid #2a2a2a' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#1a1a2e,#2d1b69)' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>👤</div>
            <div style={{ position: 'absolute', inset: 0, border: '2px solid #f97316', borderRadius: 8, boxShadow: '0 0 12px rgba(249,115,22,0.4)' }} />
            <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 8, color: '#f97316', fontWeight: 700, fontFamily: 'monospace' }}>CUTOUT ✓</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['Remove BG','#22c55e'],['Enhance Face','#f97316'],['Add Glow','#60a5fa']].map(([lbl,c]) => (
              <div key={lbl} style={{ padding: '5px 10px', borderRadius: 5, background: '#1a1a1a', border: `1px solid ${c}30`, fontSize: 9, color: c, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />{lbl}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (index === 1) { // Professional Editor
    return (
      <div {...base}>
        <div style={{ flex: 1, display: 'flex', background: '#141414' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 4, overflow: 'hidden', position: 'relative', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#0f2027,#2c5364)' }} />
              <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, background: 'rgba(0,0,0,0.7)', borderRadius: 3, padding: '3px 6px' }}>
                <div style={{ fontSize: 9, color: '#fff', fontWeight: 900, fontFamily: 'Impact,sans-serif' }}>THE TRUTH ABOUT YOUTUBE</div>
              </div>
            </div>
          </div>
          <div style={{ width: 90, background: '#0f0f0f', borderLeft: '1px solid #1e1e1e', padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 7, color: '#555', letterSpacing: 1, marginBottom: 4, fontFamily: 'monospace' }}>LAYERS ×3</div>
            {[['T Text','#f97316',true],['⬜ Image','#60a5fa',false],['◎ BG','#a3a3a3',false]].map(([lbl,c,a]) => (
              <div key={lbl} style={{ padding: '3px 5px', borderRadius: 3, background: a ? `${c}15` : '#1a1a1a', border: `1px solid ${a ? c+'40' : 'transparent'}`, fontSize: 8, color: a ? c : '#555', fontFamily: 'monospace' }}>{lbl}</div>
            ))}
            <div style={{ marginTop: 8, fontSize: 7, color: '#555', letterSpacing: 1, fontFamily: 'monospace' }}>BLEND</div>
            <div style={{ padding: '3px 5px', borderRadius: 3, background: '#1a1a1a', fontSize: 8, color: '#a3a3a3', fontFamily: 'monospace' }}>Normal ▾</div>
          </div>
        </div>
      </div>
    );
  }
  if (index === 2) { // Prompt-to-Thumbnail
    return (
      <div {...base}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#141414', padding: 16, gap: 12, justifyContent: 'center' }}>
          <div style={{ background: '#0f0f0f', border: '1px solid #f97316', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: '#666', fontFamily: 'monospace', flex: 1 }}>gaming thumbnail, dramatic lighting, face reaction...</span>
            <div style={{ padding: '3px 8px', borderRadius: 4, background: '#f97316', fontSize: 9, color: '#fff', fontWeight: 700, flexShrink: 0 }}>Generate ✦</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {['linear-gradient(135deg,#1a1a2e,#c45c2e)','linear-gradient(135deg,#0f2027,#2c5364)','linear-gradient(135deg,#1a472a,#2d6a4f)','linear-gradient(135deg,#2c2c54,#706fd3)'].map((bg, i) => (
              <div key={i} style={{ aspectRatio: '16/9', borderRadius: 5, background: bg, border: i === 0 ? '2px solid #f97316' : '1px solid #2a2a2a', display: 'flex', alignItems: 'flex-end', padding: '4px 5px' }}>
                <div style={{ fontSize: 7, fontWeight: 900, color: '#fff', fontFamily: 'Impact,sans-serif', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>VARIANT {i + 1}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (index === 3) { // CTR Intelligence
    return (
      <div {...base}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#141414', padding: 20, gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <svg viewBox="0 0 100 60" style={{ width: 100, height: 60 }}>
              <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="#1e1e1e" strokeWidth="8" strokeLinecap="round" />
              <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="#f97316" strokeWidth="8" strokeLinecap="round" strokeDasharray="125.7" strokeDashoffset="30" />
              <text x="50" y="46" textAnchor="middle" fontSize="14" fontWeight="900" fill="#f97316" fontFamily="monospace">8.4</text>
              <text x="50" y="56" textAnchor="middle" fontSize="7" fill="#555" fontFamily="monospace">/ 10</text>
            </svg>
            <div style={{ fontSize: 9, color: '#f97316', fontWeight: 700, fontFamily: 'monospace' }}>CTR SCORE</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[['Contrast','92%','#22c55e'],['Text Size','88%','#22c55e'],['Face Visibility','74%','#f59e0b'],['Composition','81%','#22c55e']].map(([lbl,val,c]) => (
              <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 8, color: '#555', fontFamily: 'monospace', width: 72 }}>{lbl}</div>
                <div style={{ flex: 1, height: 3, borderRadius: 2, background: '#1e1e1e', position: 'relative', width: 60 }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: val, background: c, borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 8, color: c, fontFamily: 'monospace', width: 24, textAlign: 'right' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  // index === 4: A/B Variants
  return (
    <div {...base}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#141414', padding: 12, gap: 8, justifyContent: 'center' }}>
        <div style={{ fontSize: 8, color: '#555', fontFamily: 'monospace', letterSpacing: 1 }}>5 VARIANTS GENERATED</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {[['#1a1a2e,#c45c2e',true],['#0f2027,#2c5364',false],['#1a472a,#2d6a4f',false],['#2c2c54,#706fd3',false],['#3d0000,#c0392b',false]].map(([colors, selected], i) => (
            <div key={i} style={{ aspectRatio: '16/9', borderRadius: 4, background: `linear-gradient(135deg, ${colors})`, border: selected ? '2px solid #f97316' : '1px solid #2a2a2a', position: 'relative' }}>
              {selected && <div style={{ position: 'absolute', top: 2, right: 2, width: 10, height: 10, borderRadius: '50%', background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6, color: '#fff' }}>✓</div>}
            </div>
          ))}
          <div style={{ aspectRatio: '16/9', borderRadius: 4, background: '#1a1a1a', border: '1px dashed #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, color: '#2a2a2a' }}>+</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home({ setPage }) {
  useScrollAnimation();
  const [fetchedReviews, setFetchedReviews] = useState([]);

  useSEO({
    title: 'ThumbFrame — AI YouTube Thumbnail Editor',
    description: 'The AI thumbnail editor that turns your ideas into scroll-stopping YouTube thumbnails in minutes. Built by a creator, for creators. Free to start.',
    url: 'https://thumbframe.com',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'ThumbFrame',
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Web browser',
      description: 'AI-powered YouTube thumbnail editor with background removal, CTR scoring, and AI generation.',
      url: 'https://thumbframe.com',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      author: { '@type': 'Person', name: 'Kaden' },
      aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '3' },
    },
  });

  useEffect(() => {
    const API = process.env.REACT_APP_API_URL || '';
    fetch(`${API}/api/reviews`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.reviews)) setFetchedReviews(d.reviews); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.title = 'ThumbFrame — AI YouTube Thumbnail Editor';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute('content', 'The AI thumbnail editor that turns your ideas into scroll-stopping thumbnails in minutes. Built by a YouTube creator for creators.');
    }
  }, []);

  const go = (page) => {
    setPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{homeStyles}</style>
      <Navbar setPage={setPage} currentPage="home" />

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="tf-hero">
        <div className="tf-hero-badge animate-on-scroll">
          <span className="badge badge-accent">Now with AI-powered editing ✦</span>
        </div>

        <h1 className="animate-on-scroll" style={{ animationDelay: '60ms' }}>
          Create thumbnails that<br />
          <span className="text-gradient">actually get clicked.</span>
        </h1>

        <p className="tf-hero-sub animate-on-scroll" style={{ animationDelay: '120ms' }}>
          The AI thumbnail editor that turns your ideas into scroll-stopping thumbnails in minutes, not hours.
          Built by a YouTube creator who got tired of Photoshop.
        </p>

        <div className="tf-hero-actions animate-on-scroll" style={{ animationDelay: '180ms' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => go('editor')}
          >
            Get Started Free →
          </button>
          <button
            className="btn btn-ghost btn-lg"
            onClick={() => go('features')}
          >
            See How It Works
          </button>
        </div>

        <div className="tf-hero-img-wrap animate-on-scroll" style={{ animationDelay: '240ms' }}>
          <div className="tf-hero-img-glow" />
          {/* Rich fake editor screenshot */}
          <div className="tf-hero-img-placeholder" style={{ flexDirection: 'column', alignItems: 'stretch', padding: 0, overflow: 'hidden', gap: 0 }}>
            {/* Fake top bar */}
            <div style={{ background: '#0f0f0f', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316' }} />
              <div style={{ width: 60, height: 6, borderRadius: 3, background: '#1e1e1e' }} />
              <div style={{ flex: 1 }} />
              <div style={{ width: 40, height: 20, borderRadius: 4, background: '#f97316', opacity: 0.9 }} />
              <div style={{ width: 50, height: 20, borderRadius: 4, background: '#1e1e1e' }} />
            </div>
            {/* Fake workspace */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              {/* Left sidebar */}
              <div style={{ width: 44, background: '#0f0f0f', borderRight: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 6px', flexShrink: 0 }}>
                {['▣','T','✦','✂','⬜','🖌'].map((icon, i) => (
                  <div key={i} style={{ width: 32, height: 28, borderRadius: 5, background: i === 0 ? '#f97316' : '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: i === 0 ? '#fff' : '#555' }}>{icon}</div>
                ))}
              </div>
              {/* Canvas area */}
              <div style={{ flex: 1, background: '#161616', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                <div style={{ width: '100%', maxWidth: 220, aspectRatio: '16/9', borderRadius: 6, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b69 40%, #c45c2e 100%)' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#fff', lineHeight: 1.1, textTransform: 'uppercase', fontFamily: 'Impact, sans-serif', textShadow: '0 2px 6px rgba(0,0,0,0.6)' }}>I CAN'T<br />BELIEVE<br />THIS WORKED</div>
                    <div style={{ marginTop: 4, width: 40, height: 3, borderRadius: 2, background: '#f97316' }} />
                  </div>
                  {/* Fake AI badge */}
                  <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(249,115,22,0.9)', borderRadius: 3, padding: '1px 5px', fontSize: 8, color: '#fff', fontWeight: 700 }}>AI ✦</div>
                </div>
              </div>
              {/* Right panel */}
              <div style={{ width: 80, background: '#0f0f0f', borderLeft: '1px solid #1e1e1e', padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                <div style={{ fontSize: 7, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2, fontFamily: 'monospace' }}>LAYERS</div>
                {[['▣ Text', true], ['▣ BG', false], ['▣ Base', false]].map(([lbl, active], i) => (
                  <div key={i} style={{ padding: '3px 6px', borderRadius: 4, background: active ? '#f9731620' : '#1a1a1a', border: active ? '1px solid #f9731640' : '1px solid transparent', fontSize: 8, color: active ? '#f97316' : '#555', whiteSpace: 'nowrap', overflow: 'hidden' }}>{lbl}</div>
                ))}
                <div style={{ marginTop: 4, fontSize: 7, color: '#555', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'monospace' }}>CTR</div>
                <div style={{ position: 'relative', height: 36 }}>
                  <svg viewBox="0 0 60 36" style={{ width: '100%', height: '100%' }}>
                    <path d="M5 30 A25 25 0 0 1 55 30" fill="none" stroke="#1e1e1e" strokeWidth="5" strokeLinecap="round" />
                    <path d="M5 30 A25 25 0 0 1 55 30" fill="none" stroke="#f97316" strokeWidth="5" strokeLinecap="round" strokeDasharray="78.5" strokeDashoffset="20" />
                    <text x="30" y="28" textAnchor="middle" fontSize="9" fontWeight="700" fill="#f97316" fontFamily="monospace">8.1</text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="tf-trust-bar animate-on-scroll" style={{ animationDelay: '300ms' }}>
          <div className="tf-trust-dots">
            <div className="tf-trust-dot" />
            <div className="tf-trust-dot" />
            <div className="tf-trust-dot" />
            <div className="tf-trust-dot" />
          </div>
          <span>Trusted by 500+ YouTube creators</span>
        </div>
      </section>

      {/* ── PROBLEM / SOLUTION ───────────────────────────────────────────── */}
      <section className="section" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <div style={{ maxWidth: 560 }}>
            <p className="tf-section-label">Why ThumbFrame</p>
            <h2 className="tf-section-h2 animate-on-scroll">The thumbnail problem<br />nobody solved right.</h2>
            <p className="tf-section-sub animate-on-scroll">
              Every creator knows the pain. You have a great video but a mediocre thumbnail kills your CTR.
              The old tools weren't built for this.
            </p>
          </div>
          <div className="tf-problem-grid stagger-children">
            {PROBLEMS.map((p) => (
              <div className="card" key={p.title}>
                <span className="tf-problem-icon">{p.icon}</span>
                <div className="tf-problem-title">{p.title}</div>
                <p className="tf-problem-body">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURE SHOWCASE ─────────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div style={{ maxWidth: 560, marginBottom: 0 }}>
            <p className="tf-section-label">Features</p>
            <h2 className="tf-section-h2 animate-on-scroll">Every tool you need.<br />Nothing you don't.</h2>
          </div>
          <div className="tf-features-list">
            {FEATURES.map((f, i) => (
              <div key={f.title} className={`tf-feature-row${f.reverse ? ' reverse' : ''} animate-on-scroll`}>
                <div className="tf-feature-text">
                  <span className="badge badge-accent">{f.badge}</span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                  <button
                    className="btn btn-ghost"
                    style={{ marginTop: 20 }}
                    onClick={() => go('features')}
                  >
                    Learn more →
                  </button>
                </div>
                <FeatureMockup index={i} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY PREVIEW ──────────────────────────────────────────────── */}
      <section className="section" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 0, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <p className="tf-section-label">Gallery</p>
              <h2 className="tf-section-h2 animate-on-scroll">Made with ThumbFrame.</h2>
            </div>
            <button className="btn btn-ghost" onClick={() => go('gallery')}>
              View all →
            </button>
          </div>
          <div className="tf-gallery-grid stagger-children">
            {[
              { bg: 'linear-gradient(135deg,#1a1a2e,#4a3060)', text: 'WATCH THIS', color: '#FFD700' },
              { bg: 'linear-gradient(135deg,#0f2027,#2c5364)', text: 'THE TRUTH', color: '#fff' },
              { bg: 'linear-gradient(135deg,#c45c2e,#f7a642)', text: "YOU WON'T BELIEVE", color: '#fff' },
              { bg: 'linear-gradient(135deg,#1a472a,#2d6a4f)', text: 'How I Did It', color: '#95d5b2' },
              { bg: 'linear-gradient(135deg,#2c2c54,#706fd3)', text: 'EPIC MOMENT', color: '#fff' },
              { bg: 'linear-gradient(135deg,#3d0000,#c0392b)', text: 'GONE WRONG', color: '#fff' },
              { bg: 'linear-gradient(135deg,#f7971e,#ffd200)', text: '5 TIPS', color: '#1a1a1a' },
              { bg: 'linear-gradient(135deg,#11998e,#38ef7d)', text: 'I TRIED IT', color: '#fff' },
            ].map((item, i) => (
              <div key={i} className="tf-gallery-card" onClick={() => go('gallery')} style={{ background: item.bg, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: item.color, fontFamily: 'Impact,sans-serif', textShadow: '1px 1px 0 rgba(0,0,0,0.5)', textAlign: 'center', padding: '0 6px', lineHeight: 1.2, letterSpacing: 0.5 }}>{item.text}</span>
                <div style={{ position: 'absolute', bottom: 3, right: 3, background: 'rgba(0,0,0,0.7)', borderRadius: 2, padding: '1px 3px', fontSize: 7, color: '#fff' }}>0:00</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <p className="tf-section-label">Creators love it</p>
          <h2 className="tf-section-h2 animate-on-scroll">Don't take our word for it.</h2>
          <TestimonialCarousel items={[
            ...TESTIMONIALS.map((t) => ({
              stars: '★★★★★', quote: t.quote, avatar: t.emoji,
              name: t.name, sub: t.subs,
            })),
            ...fetchedReviews.map((r) => ({
              stars: '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating),
              quote: r.reviewText, avatar: '★',
              name: r.name, sub: r.channelUrl ? r.channelUrl : '',
              accentAvatar: true,
            })),
          ]} />
        </div>
      </section>

      {/* ── PRICING PREVIEW ──────────────────────────────────────────────── */}
      <section className="section" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <div style={{ textAlign: 'center' }}>
            <p className="tf-section-label">Pricing</p>
            <h2 className="tf-section-h2 animate-on-scroll">Simple, honest pricing.</h2>
            <p className="tf-section-sub animate-on-scroll" style={{ margin: '0 auto' }}>
              Start free. Upgrade when you're ready.
            </p>
          </div>
          <div className="tf-pricing-grid">
            {/* Free */}
            <div className="tf-pricing-card">
              <div className="tf-pricing-tier">Free</div>
              <div className="tf-pricing-price">
                <span className="amount">$0</span>
                <span className="period">/ forever</span>
              </div>
              <p className="tf-pricing-desc">Get started with the core editor. No credit card required.</p>
              <ul className="tf-pricing-features">
                <li><span className="check">✓</span> Professional canvas editor</li>
                <li><span className="check">✓</span> 5 AI generations / month</li>
                <li><span className="check">✓</span> 10 saved projects</li>
                <li><span className="check">✓</span> Basic export (JPG/PNG)</li>
              </ul>
              <button className="tf-pricing-btn" onClick={() => go('editor')}>
                Start Free
              </button>
            </div>

            {/* Pro */}
            <div className="tf-pricing-card pro">
              <span className="tf-pricing-popular">
                <span className="badge badge-accent">Popular</span>
              </span>
              <div className="tf-pricing-tier">Pro</div>
              <div className="tf-pricing-price">
                <span className="amount">$15</span>
                <span className="period">/ month</span>
              </div>
              <p className="tf-pricing-desc">Everything you need to grow your channel with great thumbnails.</p>
              <ul className="tf-pricing-features">
                <li><span className="check">✓</span> Unlimited AI generations</li>
                <li><span className="check">✓</span> CTR Intelligence scoring</li>
                <li><span className="check">✓</span> Unlimited projects</li>
                <li><span className="check">✓</span> A/B variant generation</li>
                <li><span className="check">✓</span> Priority support</li>
              </ul>
              <button className="tf-pricing-btn pro-btn" onClick={handleUpgrade}>
                Start Pro Trial →
              </button>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button className="btn btn-ghost" onClick={() => go('pricing')}>
              See full pricing details →
            </button>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="tf-cta-section">
        <div className="tf-cta-glow" />
        <h2 className="animate-on-scroll">
          Your next thumbnail<br />
          <span className="text-gradient">starts here.</span>
        </h2>
        <p className="animate-on-scroll">
          Join 500+ creators who ship better thumbnails, faster.
        </p>
        <button
          className="btn btn-primary btn-lg animate-on-scroll"
          onClick={() => go('editor')}
          style={{ fontSize: 17, padding: '16px 36px' }}
        >
          Get Started Free →
        </button>
      </section>

      <Footer setPage={setPage} />

      {/* Mobile sticky CTA */}
      <div className="tf-mobile-cta">
        <button className="tf-mobile-cta-btn" onClick={() => go('editor')}>
          Get Started Free →
        </button>
      </div>
    </div>
  );
}

/* ── Testimonial Carousel ─────────────────────────────────────────────────── */
function TestimonialCarousel({ items }) {
  const [active, setActive] = useState(0);
  const trackRef = useRef(null);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const isDragging = useRef(false);

  const goTo = useCallback((idx) => {
    setActive(Math.max(0, Math.min(idx, items.length - 1)));
  }, [items.length]);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  };

  const onTouchMove = (e) => {
    if (!touchStartX.current) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (dx > dy && dx > 5) { isDragging.current = true; e.preventDefault(); }
  };

  const onTouchEnd = (e) => {
    if (!touchStartX.current || !isDragging.current) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -50) goTo(active + 1);
    else if (dx > 50) goTo(active - 1);
    touchStartX.current = null;
    isDragging.current = false;
  };

  if (!items.length) return null;

  // Desktop: horizontal scroll; Mobile: carousel
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;

  if (!isMobile) {
    return (
      <div className="tf-testimonials-scroll">
        {items.map((t, i) => <TestimonialCard key={i} t={t} />)}
      </div>
    );
  }

  return (
    <div>
      <div
        className="tf-testimonial-carousel"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          ref={trackRef}
          className="tf-testimonial-track"
          style={{ transform: `translateX(calc(-${active} * (100vw - 48px) - ${active * 20}px))`, gap: '20px' }}
        >
          {items.map((t, i) => <TestimonialCard key={i} t={t} />)}
        </div>
      </div>
      <div className="tf-carousel-dots">
        {items.map((_, i) => (
          <button
            key={i}
            className={`tf-carousel-dot${i === active ? ' active' : ''}`}
            onClick={() => goTo(i)}
            aria-label={`Go to testimonial ${i + 1}`}
            style={{ minHeight: 'unset', minWidth: 'unset' }}
          />
        ))}
      </div>
    </div>
  );
}

function TestimonialCard({ t }) {
  return (
    <div className="tf-testimonial-card">
      <div className="tf-testimonial-stars">{t.stars}</div>
      <p className="tf-testimonial-quote">"{t.quote}"</p>
      <div className="tf-testimonial-author">
        <div className="tf-testimonial-avatar" style={t.accentAvatar ? { fontSize: 16, background: 'rgba(255,107,0,0.1)', color: 'var(--accent)' } : undefined}>{t.avatar}</div>
        <div>
          <div className="tf-testimonial-name">{t.name}</div>
          {t.sub && <div className="tf-testimonial-sub">{t.sub}</div>}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

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

export default function Home({ setPage, onCheckout }) {
  useScrollAnimation();

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
          <div className="tf-hero-img-placeholder">
            <span>🖼</span>
            <span>ThumbFrame Editor Preview</span>
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
                <div className="tf-feature-screenshot-placeholder">
                  <span>Feature {i + 1} Preview</span>
                </div>
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
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="tf-gallery-card" onClick={() => go('gallery')}>
                <span className="tf-gallery-card-label">Made with ThumbFrame</span>
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
          <div className="tf-testimonials-scroll">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="tf-testimonial-card">
                <div className="tf-testimonial-stars">★★★★★</div>
                <p className="tf-testimonial-quote">"{t.quote}"</p>
                <div className="tf-testimonial-author">
                  <div className="tf-testimonial-avatar">{t.emoji}</div>
                  <div>
                    <div className="tf-testimonial-name">{t.name}</div>
                    <div className="tf-testimonial-sub">{t.subs}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
              <button className="tf-pricing-btn pro-btn" onClick={onCheckout}>
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
    </div>
  );
}

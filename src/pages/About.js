import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const aboutStyles = `
  .tf-about-hero {
    padding: 140px 24px 80px;
    position: relative;
    overflow: hidden;
  }
  .tf-about-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 60% 40% at 0% 50%, rgba(255,107,0,0.05) 0%, transparent 70%);
    pointer-events: none;
  }
  .tf-about-hero-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 80px;
    align-items: center;
  }
  .tf-about-hero-text .badge {
    margin-bottom: 24px;
  }
  .tf-about-hero-text h1 {
    font-size: clamp(36px, 4.5vw, 54px);
    letter-spacing: -0.03em;
    line-height: 1.08;
    margin-bottom: 20px;
  }
  .tf-about-hero-text p {
    font-size: 17px;
    color: var(--text-secondary);
    line-height: 1.7;
  }
  .tf-about-avatar-wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
  }
  .tf-about-avatar {
    width: 240px;
    height: 240px;
    border-radius: var(--radius-xl);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    position: relative;
    overflow: hidden;
  }
  .tf-about-avatar::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 30% 30%, rgba(255,107,0,0.08) 0%, transparent 70%);
  }
  .tf-about-avatar span.emoji {
    font-size: 64px;
    z-index: 1;
  }
  .tf-about-avatar span.name {
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
    z-index: 1;
  }
  .tf-about-avatar span.age {
    font-size: 13px;
    color: var(--text-muted);
    z-index: 1;
  }

  /* ── Story ──────────────────────────────────────────────────────── */
  .tf-about-story {
    max-width: 680px;
    margin: 0 auto;
    padding: 0 24px 100px;
  }
  .tf-about-story-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 16px;
    font-family: var(--font-body);
  }
  .tf-about-story p {
    font-size: 17px;
    color: var(--text-secondary);
    line-height: 1.8;
    margin-bottom: 24px;
  }
  .tf-about-story p:first-of-type {
    font-size: 20px;
    color: var(--text-primary);
    font-weight: 500;
    line-height: 1.65;
  }
  .tf-about-story blockquote {
    border-left: 3px solid var(--accent);
    padding: 4px 0 4px 24px;
    margin: 32px 0;
  }
  .tf-about-story blockquote p {
    font-size: 18px;
    color: var(--text-primary);
    font-style: italic;
    font-family: var(--font-display);
    margin-bottom: 0;
  }

  /* ── Mission ────────────────────────────────────────────────────── */
  .tf-about-mission {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 80px 24px;
  }
  .tf-about-mission-inner {
    max-width: 900px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 64px;
    align-items: start;
  }
  .tf-about-mission h2 {
    font-size: clamp(26px, 3vw, 38px);
    letter-spacing: -0.025em;
    margin-bottom: 20px;
    line-height: 1.2;
  }
  .tf-about-mission p {
    font-size: 15px;
    color: var(--text-secondary);
    line-height: 1.7;
  }
  .tf-about-mission-values {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-top: 8px;
  }
  .tf-about-mission-value {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .tf-about-mission-value-icon {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    background: var(--accent-glow);
    border: 1px solid rgba(255,107,0,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }
  .tf-about-mission-value-text h4 {
    font-size: 15px;
    font-family: var(--font-display);
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
    letter-spacing: -0.01em;
  }
  .tf-about-mission-value-text p {
    font-size: 13px;
    margin-bottom: 0;
  }

  /* ── What's Next ────────────────────────────────────────────────── */
  .tf-about-next {
    padding: 80px 24px;
  }
  .tf-about-next-inner {
    max-width: 680px;
    margin: 0 auto;
  }
  .tf-about-next h2 {
    font-size: clamp(26px, 3vw, 38px);
    letter-spacing: -0.025em;
    margin-bottom: 12px;
  }
  .tf-about-next-desc {
    font-size: 15px;
    color: var(--text-secondary);
    margin-bottom: 36px;
    line-height: 1.65;
  }
  .tf-roadmap {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .tf-roadmap-item {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    padding: 20px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    transition: all var(--transition-base);
  }
  .tf-roadmap-item:hover {
    border-color: var(--border-hover);
    transform: translateX(4px);
  }
  .tf-roadmap-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
    margin-top: 6px;
  }
  .tf-roadmap-dot.soon {
    background: var(--warning);
  }
  .tf-roadmap-dot.future {
    background: var(--border);
  }
  .tf-roadmap-text h4 {
    font-size: 15px;
    font-family: var(--font-display);
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
    letter-spacing: -0.01em;
  }
  .tf-roadmap-text p {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
  }
  .tf-roadmap-badge {
    margin-left: auto;
    flex-shrink: 0;
  }

  /* ── Final CTA ──────────────────────────────────────────────────── */
  .tf-about-cta {
    padding: 80px 24px 100px;
    text-align: center;
    border-top: 1px solid var(--border);
    position: relative;
    overflow: hidden;
  }
  .tf-about-cta::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 500px;
    height: 300px;
    background: radial-gradient(ellipse at center, rgba(255,107,0,0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .tf-about-cta h2 {
    font-size: clamp(28px, 3.5vw, 44px);
    margin-bottom: 16px;
    position: relative;
    z-index: 1;
  }
  .tf-about-cta p {
    font-size: 16px;
    color: var(--text-secondary);
    margin-bottom: 32px;
    position: relative;
    z-index: 1;
  }

  @media (max-width: 768px) {
    .tf-about-hero-inner { grid-template-columns: 1fr; gap: 48px; }
    .tf-about-avatar-wrap { order: -1; }
    .tf-about-avatar { width: 180px; height: 180px; }
    .tf-about-mission-inner { grid-template-columns: 1fr; gap: 40px; }
  }
`;

const VALUES = [
  {
    icon: '🎯',
    title: 'Creator-first.',
    body: 'Every decision — every feature, every default — is made by asking: "does this make a creator\'s life easier?"',
  },
  {
    icon: '🚫',
    title: 'No bloat.',
    body: 'We don\'t add features because they look impressive. We add features because they\'re actually needed.',
  },
  {
    icon: '🔬',
    title: 'AI that earns its place.',
    body: 'AI is only in ThumbFrame where it demonstrably produces better results faster than doing it manually.',
  },
];

const ROADMAP = [
  {
    title: 'YouTube Analytics Integration',
    body: 'Connect your channel and see actual CTR data alongside your designs. Real feedback loop.',
    status: 'active',
    label: 'In progress',
  },
  {
    title: 'Brand Kit Pro',
    body: 'Team-shareable brand kits with color palettes, fonts, overlays, and logo placement rules.',
    status: 'soon',
    label: 'Coming soon',
  },
  {
    title: 'Template Marketplace',
    body: 'Creator-made templates you can buy, sell, and remix. Quality over quantity.',
    status: 'soon',
    label: 'Coming soon',
  },
  {
    title: 'Batch Thumbnail Export',
    body: 'Generate a full series of thumbnails from a single template + variable inputs.',
    status: 'future',
    label: 'Planned',
  },
];

export default function About({ setPage }) {
  useScrollAnimation();

  useEffect(() => {
    document.title = 'About | ThumbFrame — AI YouTube Thumbnail Editor';
  }, []);

  const go = (page) => {
    setPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <style>{aboutStyles}</style>
      <Navbar setPage={setPage} currentPage="about" />

      {/* Hero */}
      <section className="tf-about-hero">
        <div className="tf-about-hero-inner">
          <div className="tf-about-hero-text animate-on-scroll">
            <span className="badge badge-accent" style={{ marginBottom: 24 }}>About</span>
            <h1>
              Built by one person.<br />
              <span className="text-gradient">For everyone.</span>
            </h1>
            <p>
              ThumbFrame isn't a startup. It's a tool built by a creator who got frustrated enough to solve the problem himself.
            </p>
          </div>
          <div className="tf-about-avatar-wrap animate-on-scroll">
            <div className="tf-about-avatar">
              <span className="emoji">👨‍💻</span>
              <span className="name">Kaden</span>
              <span className="age">Founder · 20</span>
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section style={{ borderTop: '1px solid var(--border)' }}>
        <div className="tf-about-story animate-on-scroll">
          <p className="tf-about-story-label">The story</p>

          <p>
            I'm Kaden. I'm 20 years old and I built ThumbFrame by myself.
          </p>

          <p>
            It started because I was trying to grow a Minecraft YouTube channel.
            I was spending hours making thumbnails in Photoshop — watching tutorials,
            fighting with layers, trying to figure out why my thumbnails looked
            like garbage while everyone else's looked clean.
          </p>

          <p>
            I tried Canva. Too limiting. The templates looked generic and every
            other small creator was using the same ones. I tried other thumbnail
            tools. They were either too expensive, too basic, or clearly designed
            by people who had never made a YouTube video in their life.
          </p>

          <blockquote>
            <p>So I built my own.</p>
          </blockquote>

          <p>
            ThumbFrame started as a side project — just a simple editor that did
            what I needed. Then I added AI. Then I added expression scoring. Then
            background generation. Then CTR prediction. And it kept growing because
            every feature I added was something I actually needed as a creator.
          </p>

          <p>
            This isn't a product built by a committee or a VC-funded startup with
            a marketing team. It's built by one person who makes videos and got
            frustrated enough to solve the problem.
          </p>

          <p>
            That's ThumbFrame.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="tf-about-mission">
        <div className="tf-about-mission-inner">
          <div className="animate-on-scroll">
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12, fontFamily: 'var(--font-body)' }}>Mission</p>
            <h2>
              Make professional thumbnails accessible to every creator.
            </h2>
            <p>
              Skill shouldn't be the bottleneck between a creator's idea and a great thumbnail.
              ThumbFrame exists to collapse that gap — using AI where it genuinely helps, and staying
              out of the way everywhere else.
            </p>
          </div>
          <div className="tf-about-mission-values stagger-children">
            {VALUES.map((v) => (
              <div className="tf-about-mission-value" key={v.title}>
                <div className="tf-about-mission-value-icon">{v.icon}</div>
                <div className="tf-about-mission-value-text">
                  <h4>{v.title}</h4>
                  <p>{v.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's Next */}
      <section className="tf-about-next">
        <div className="tf-about-next-inner">
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12, fontFamily: 'var(--font-body)' }}>
            What's next
          </p>
          <h2 className="animate-on-scroll">The roadmap.</h2>
          <p className="tf-about-next-desc animate-on-scroll">
            What I'm building next, in order of "things I need as a creator."
          </p>
          <div className="tf-roadmap stagger-children">
            {ROADMAP.map((item) => (
              <div className="tf-roadmap-item" key={item.title}>
                <div className={`tf-roadmap-dot ${item.status}`} />
                <div className="tf-roadmap-text">
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                </div>
                <div className="tf-roadmap-badge">
                  <span className="badge" style={{
                    background: item.status === 'active' ? 'rgba(34,197,94,0.1)' : item.status === 'soon' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
                    color: item.status === 'active' ? 'var(--success)' : item.status === 'soon' ? 'var(--warning)' : 'var(--text-muted)',
                    border: `1px solid ${item.status === 'active' ? 'rgba(34,197,94,0.25)' : item.status === 'soon' ? 'rgba(245,158,11,0.25)' : 'var(--border)'}`,
                    fontSize: 11,
                  }}>
                    {item.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="tf-about-cta">
        <h2 className="animate-on-scroll">
          Try the editor.<br />
          <span className="text-gradient">It's free.</span>
        </h2>
        <p className="animate-on-scroll">
          No account. No credit card. Just open it and start.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <button className="btn btn-primary btn-lg" onClick={() => go('editor')}>
            Open ThumbFrame →
          </button>
          <button className="btn btn-ghost btn-lg" onClick={() => go('pricing')}>
            View Pricing
          </button>
        </div>
      </section>

      <Footer setPage={setPage} />
    </div>
  );
}

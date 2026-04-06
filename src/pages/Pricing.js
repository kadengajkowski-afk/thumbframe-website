import React, { useEffect, useState, useRef } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const pricingStyles = `
  .tf-pricing-hero {
    padding: 140px 24px 80px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .tf-pricing-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,107,0,0.06) 0%, transparent 70%);
    pointer-events: none;
  }
  .tf-pricing-hero h1 {
    font-size: clamp(36px, 5vw, 58px);
    letter-spacing: -0.03em;
    line-height: 1.08;
    max-width: 600px;
    margin: 0 auto 20px;
  }
  .tf-pricing-hero p {
    font-size: 18px;
    color: var(--text-secondary);
    max-width: 420px;
    margin: 0 auto;
    line-height: 1.6;
  }

  /* ── Cards ─────────────────────────────────────────────────────────── */
  .tf-pricing-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    max-width: 860px;
    margin: 64px auto 0;
    padding: 0 24px;
  }
  .tf-pc {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    padding: 40px;
    display: flex;
    flex-direction: column;
    gap: 0;
    position: relative;
    transition: all var(--transition-base);
  }
  .tf-pc.pro {
    border-color: rgba(255,107,0,0.3);
    box-shadow: 0 0 60px rgba(255,107,0,0.08);
  }
  .tf-pc.pro:hover {
    box-shadow: 0 0 80px rgba(255,107,0,0.14);
  }
  .tf-pc-popular {
    position: absolute;
    top: -14px;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
  }
  .tf-pc-tier {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
  }
  .tf-pc-tagline {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 24px;
    line-height: 1.5;
  }
  .tf-pc-price {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-bottom: 8px;
  }
  .tf-pc-price .amt {
    font-family: var(--font-display);
    font-size: 52px;
    font-weight: 800;
    color: var(--text-primary);
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .tf-pc-price .per {
    font-size: 14px;
    color: var(--text-muted);
  }
  .tf-pc-billing {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 28px;
  }
  .tf-pc-divider {
    height: 1px;
    background: var(--border);
    margin-bottom: 24px;
  }
  .tf-pc-features {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 11px;
    margin-bottom: 32px;
    flex: 1;
  }
  .tf-pc-features li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 14px;
    line-height: 1.4;
  }
  .tf-pc-features li .icon-yes {
    color: var(--success);
    font-size: 15px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .tf-pc-features li .icon-no {
    color: var(--text-muted);
    font-size: 15px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .tf-pc-features li .feat-text {
    color: var(--text-secondary);
  }
  .tf-pc-features li .feat-text.dimmed {
    color: var(--text-muted);
    text-decoration: line-through;
    opacity: 0.6;
  }
  .tf-pc-btn {
    width: 100%;
    padding: 14px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-base);
    margin-top: auto;
  }
  .tf-pc-btn:hover {
    border-color: var(--border-hover);
    background: var(--bg-hover);
  }
  .tf-pc-btn.pro-btn {
    background: var(--accent-gradient);
    border: none;
    color: #fff;
    box-shadow: var(--shadow-accent);
  }
  .tf-pc-btn.pro-btn:hover {
    box-shadow: 0 0 60px rgba(255,107,0,0.25);
    transform: translateY(-1px);
  }

  /* ── Comparison note ─────────────────────────────────────────────── */
  .tf-pricing-note {
    text-align: center;
    margin-top: 24px;
    font-size: 13px;
    color: var(--text-muted);
  }

  /* ── FAQ ─────────────────────────────────────────────────────────── */
  .tf-faq {
    max-width: 680px;
    margin: 0 auto;
    padding: 0 24px;
  }
  .tf-faq-item {
    border-bottom: 1px solid var(--border);
    overflow: hidden;
  }
  .tf-faq-q {
    width: 100%;
    background: none;
    border: none;
    padding: 22px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 600;
    color: var(--text-primary);
    text-align: left;
    gap: 16px;
    transition: color var(--transition-base);
  }
  .tf-faq-q:hover { color: var(--accent); }
  .tf-faq-icon {
    flex-shrink: 0;
    font-size: 22px;
    color: var(--accent);
    transition: transform var(--transition-base);
    line-height: 1;
  }
  .tf-faq-icon.open { transform: rotate(45deg); }
  .tf-faq-body {
    overflow: hidden;
    transition: max-height 300ms ease, opacity 300ms ease;
    max-height: 0;
    opacity: 0;
  }
  .tf-faq-body.open {
    opacity: 1;
  }
  .tf-faq-body p {
    padding: 0 0 22px;
    font-size: 15px;
    color: var(--text-secondary);
    line-height: 1.7;
  }

  @media (max-width: 640px) {
    .tf-pricing-cards {
      grid-template-columns: 1fr;
      max-width: 420px;
      padding: 0 16px;
    }
    .tf-pricing-hero { padding: 120px 20px 60px; }
  }
`;

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
  { yes: true, text: 'Everything in Free' },
  { yes: true, text: 'Unlimited AI generations' },
  { yes: true, text: 'CTR Intelligence scoring' },
  { yes: true, text: 'A/B variant generation' },
  { yes: true, text: 'Unlimited projects' },
  { yes: true, text: 'AI background generation' },
  { yes: true, text: 'Expression enhancement' },
  { yes: true, text: 'Prompt-to-Thumbnail' },
  { yes: true, text: 'Priority support' },
  { yes: true, text: 'Early access to new features' },
  { yes: true, text: 'Export up to 4K resolution' },
];

const FAQS = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. There are no contracts, no lock-ins. Cancel from your account settings and you\'ll keep Pro access until the end of your billing period.',
  },
  {
    q: 'What happens when I hit my AI limit?',
    a: 'On the Free plan, once you hit 5 AI operations for the month, AI features are paused until your next billing cycle. The full canvas editor still works. Upgrade to Pro for unlimited AI.',
  },
  {
    q: 'Is there a free trial for Pro?',
    a: 'Yes — new accounts get 7 days of full Pro access to try every feature. No credit card required to start. You\'ll only be charged if you decide to keep Pro after the trial.',
  },
  {
    q: 'Do you offer a refund?',
    a: 'If you\'re not happy within 7 days of your first charge, email hi@thumbframe.app and we\'ll refund you. No questions, no friction.',
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
    <div className="tf-faq-item">
      <button className="tf-faq-q" onClick={() => setOpen(v => !v)}>
        <span>{q}</span>
        <span className={`tf-faq-icon${open ? ' open' : ''}`}>+</span>
      </button>
      <div ref={bodyRef} className={`tf-faq-body${open ? ' open' : ''}`}>
        <p>{a}</p>
      </div>
    </div>
  );
}

export default function Pricing({ setPage, onCheckout }) {
  useScrollAnimation();

  useEffect(() => {
    document.title = 'Pricing | ThumbFrame — AI YouTube Thumbnail Editor';
  }, []);

  const go = (page) => {
    setPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <style>{pricingStyles}</style>
      <Navbar setPage={setPage} currentPage="pricing" />

      {/* Hero */}
      <div className="tf-pricing-hero">
        <span className="badge badge-accent" style={{ marginBottom: 24 }}>Pricing</span>
        <h1 className="animate-on-scroll">
          Simple pricing.<br />
          <span className="text-gradient">No surprises.</span>
        </h1>
        <p className="animate-on-scroll">
          Start free. Upgrade when you need more AI power.
        </p>
      </div>

      {/* Cards */}
      <div className="tf-pricing-cards stagger-children">
        {/* Free */}
        <div className="tf-pc">
          <div className="tf-pc-tier">Free</div>
          <p className="tf-pc-tagline">Get started with the core editor. No credit card required.</p>
          <div className="tf-pc-price">
            <span className="amt">$0</span>
            <span className="per">/ forever</span>
          </div>
          <p className="tf-pc-billing">Always free.</p>
          <div className="tf-pc-divider" />
          <ul className="tf-pc-features">
            {FREE_FEATURES.map((f, i) => (
              <li key={i}>
                <span className={f.yes ? 'icon-yes' : 'icon-no'}>{f.yes ? '✓' : '✗'}</span>
                <span className={`feat-text${f.dimmed ? ' dimmed' : ''}`}>{f.text}</span>
              </li>
            ))}
          </ul>
          <button className="tf-pc-btn" onClick={() => go('editor')}>
            Start Free
          </button>
        </div>

        {/* Pro */}
        <div className="tf-pc pro">
          <span className="tf-pc-popular">
            <span className="badge badge-accent">Most Popular</span>
          </span>
          <div className="tf-pc-tier">Pro</div>
          <p className="tf-pc-tagline">Everything you need to grow your channel with great thumbnails.</p>
          <div className="tf-pc-price">
            <span className="amt">$15</span>
            <span className="per">/ month</span>
          </div>
          <p className="tf-pc-billing">7-day free trial. Cancel anytime.</p>
          <div className="tf-pc-divider" />
          <ul className="tf-pc-features">
            {PRO_FEATURES.map((f, i) => (
              <li key={i}>
                <span className="icon-yes">✓</span>
                <span className="feat-text">{f.text}</span>
              </li>
            ))}
          </ul>
          <button className="tf-pc-btn pro-btn" onClick={onCheckout}>
            Start Pro Trial →
          </button>
        </div>
      </div>

      <p className="tf-pricing-note animate-on-scroll">
        All prices in USD · Billed monthly · Cancel anytime
      </p>

      {/* FAQ */}
      <section className="section">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12, fontFamily: 'var(--font-body)' }}>FAQ</p>
          <h2 style={{ fontSize: 'clamp(26px, 3vw, 38px)', letterSpacing: '-0.025em' }} className="animate-on-scroll">
            Common questions.
          </h2>
        </div>
        <div className="tf-faq">
          {FAQS.map((faq) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ textAlign: 'center', padding: '0 24px 100px', borderTop: '1px solid var(--border)', paddingTop: 80 }}>
        <h2 style={{ fontSize: 'clamp(26px, 3vw, 38px)', marginBottom: 16 }} className="animate-on-scroll">
          Still on the fence?
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 32, maxWidth: 420, margin: '0 auto 32px' }}>
          Try the full editor for free. No account required.
        </p>
        <button className="btn btn-primary btn-lg" onClick={() => go('editor')}>
          Open the Editor →
        </button>
      </section>

      <Footer setPage={setPage} />
    </div>
  );
}

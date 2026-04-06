import React, { useEffect, useState, useRef } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const supportStyles = `
  .tf-support-hero {
    padding: 140px 24px 80px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .tf-support-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,107,0,0.06) 0%, transparent 70%);
    pointer-events: none;
  }
  .tf-support-hero h1 {
    font-size: clamp(36px, 5vw, 56px);
    letter-spacing: -0.03em;
    margin-bottom: 20px;
  }
  .tf-support-hero p {
    font-size: 18px;
    color: var(--text-secondary);
    max-width: 420px;
    margin: 0 auto 36px;
    line-height: 1.6;
  }
  .tf-support-channels {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    max-width: 900px;
    margin: 0 auto;
    padding: 0 24px 80px;
  }
  .tf-support-channel {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 32px 28px;
    text-align: center;
    transition: all var(--transition-base);
    cursor: pointer;
    text-decoration: none;
    display: block;
  }
  .tf-support-channel:hover {
    border-color: var(--border-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  .tf-support-channel-icon {
    font-size: 32px;
    margin-bottom: 14px;
  }
  .tf-support-channel h3 {
    font-size: 17px;
    margin-bottom: 8px;
    color: var(--text-primary);
  }
  .tf-support-channel p {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.5;
  }
  .tf-support-faq {
    max-width: 680px;
    margin: 0 auto;
    padding: 0 24px 100px;
  }
  .tf-support-faq-item {
    border-bottom: 1px solid var(--border);
    overflow: hidden;
  }
  .tf-support-faq-q {
    width: 100%;
    background: none;
    border: none;
    padding: 22px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    text-align: left;
    gap: 16px;
    transition: color var(--transition-base);
  }
  .tf-support-faq-q:hover { color: var(--accent); }
  .tf-support-faq-icon {
    flex-shrink: 0;
    font-size: 22px;
    color: var(--accent);
    transition: transform var(--transition-base);
    line-height: 1;
  }
  .tf-support-faq-icon.open { transform: rotate(45deg); }
  .tf-support-faq-body {
    overflow: hidden;
    transition: max-height 300ms ease, opacity 300ms ease;
    max-height: 0;
    opacity: 0;
  }
  .tf-support-faq-body.open { opacity: 1; }
  .tf-support-faq-body p {
    padding: 0 0 22px;
    font-size: 15px;
    color: var(--text-secondary);
    line-height: 1.7;
  }
  @media (max-width: 640px) {
    .tf-support-channels { grid-template-columns: 1fr; }
  }
`;

const SUPPORT_FAQS = [
  {
    q: 'How do I remove a background from my image?',
    a: 'Upload your image to the editor, then click the "Remove BG" button in the AI tools panel on the left sidebar. The AI will automatically detect and remove the background. You can refine the edges with the erase/restore brush.',
  },
  {
    q: 'Why isn\'t my project saving?',
    a: 'Projects auto-save to the cloud every few seconds. If saving fails, check your internet connection. Your work is also stored locally in the browser as a backup. Make sure you\'re signed in to sync across devices.',
  },
  {
    q: 'How do I export at the right YouTube thumbnail size?',
    a: 'Go to File → Export → YouTube Thumbnail. This automatically exports at 1280×720px, which is the recommended YouTube thumbnail resolution. JPG at 80% quality keeps the file under YouTube\'s 2MB limit.',
  },
  {
    q: 'What AI operations count against my free limit?',
    a: 'Background removal, background generation, expression enhancement, prompt-to-thumbnail, healing brush, and CTR scoring each count as one AI operation. Basic editing (layers, text, filters) never counts against any limit.',
  },
  {
    q: 'Can I use my own fonts?',
    a: 'Custom font upload is on the roadmap. Currently, ThumbFrame gives you access to 500+ Google Fonts. Search by name in the text tool font picker.',
  },
  {
    q: 'How do I contact support?',
    a: 'Email hi@thumbframe.app or join the Discord server. Response time is usually within a few hours.',
  },
];

function SupportFaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.style.maxHeight = open ? bodyRef.current.scrollHeight + 'px' : '0px';
    }
  }, [open]);

  return (
    <div className="tf-support-faq-item">
      <button className="tf-support-faq-q" onClick={() => setOpen(v => !v)}>
        <span>{q}</span>
        <span className={`tf-support-faq-icon${open ? ' open' : ''}`}>+</span>
      </button>
      <div ref={bodyRef} className={`tf-support-faq-body${open ? ' open' : ''}`}>
        <p>{a}</p>
      </div>
    </div>
  );
}

export default function Support({ setPage }) {
  useScrollAnimation();

  useEffect(() => {
    document.title = 'Support | ThumbFrame — AI YouTube Thumbnail Editor';
  }, []);

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <style>{supportStyles}</style>
      <Navbar setPage={setPage} currentPage="support" />

      <div className="tf-support-hero">
        <span className="badge badge-accent" style={{ marginBottom: 24 }}>Support</span>
        <h1 className="animate-on-scroll">
          How can we help?
        </h1>
        <p className="animate-on-scroll">
          Find answers fast or reach out directly.
        </p>
      </div>

      <div className="tf-support-channels stagger-children">
        <a href="mailto:hi@thumbframe.app" className="tf-support-channel">
          <div className="tf-support-channel-icon">✉️</div>
          <h3>Email Support</h3>
          <p>hi@thumbframe.app — response within a few hours.</p>
        </a>
        <a href="https://discord.gg/thumbframe" target="_blank" rel="noopener noreferrer" className="tf-support-channel">
          <div className="tf-support-channel-icon">◈</div>
          <h3>Discord</h3>
          <p>Join the community for quick answers and creator tips.</p>
        </a>
        <a href="/docs" className="tf-support-channel">
          <div className="tf-support-channel-icon">📖</div>
          <h3>Documentation</h3>
          <p>In-depth guides for every tool and feature.</p>
        </a>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 48px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12, fontFamily: 'var(--font-body)' }}>FAQ</p>
        <h2 style={{ fontSize: 'clamp(26px, 3vw, 36px)', letterSpacing: '-0.025em', marginBottom: 36 }} className="animate-on-scroll">
          Common questions.
        </h2>
      </div>
      <div className="tf-support-faq">
        {SUPPORT_FAQS.map((faq) => (
          <SupportFaqItem key={faq.q} q={faq.q} a={faq.a} />
        ))}
      </div>

      <Footer setPage={setPage} />
    </div>
  );
}

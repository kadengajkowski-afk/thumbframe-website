// Shared wrapper for /terms /privacy /refund /changelog. Mounts the
// LegalScene backdrop, shared Navbar, and a frosted-glass content card.
// Page-specific content is passed as children. Prose styling lives in
// the embedded <style> block so any <h2>/<h3>/<p>/<ul>/<a> inside the
// children renders consistently without each page having to restyle.

import React from 'react';
import '@fontsource-variable/fraunces';
import { ArrowLeft } from 'lucide-react';
import LegalScene from '../../landing/scenes/LegalScene';
import Navbar from '../../landing/components/layout/Navbar';
import Footer from '../../landing/components/layout/Footer';

const FRAUNCES = "'Fraunces Variable', 'Fraunces', Georgia, serif";
const INTER    = "'Inter Variable', 'Inter', system-ui, sans-serif";
const CREAM    = '#faecd0';
const CREAM_60 = 'rgba(250,236,208,0.6)';

const PROSE_CSS = `
  .tf-legal-page {
    min-height: 100vh;
    position: relative;
    font-family: ${INTER};
    color: ${CREAM};
  }
  .tf-legal-content {
    position: relative;
    z-index: 1;
    max-width: 800px;
    margin: 0 auto;
    padding: 120px 24px 80px;
  }
  .tf-legal-card {
    background: rgba(10,7,20,0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    padding: 48px;
  }
  .tf-legal-eyebrow {
    font-family: ${FRAUNCES};
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(250,236,208,0.6);
    margin: 0 0 16px;
  }
  .tf-legal-card h1 {
    font-family: ${FRAUNCES};
    font-size: clamp(32px, 4vw, 44px);
    font-weight: 500;
    letter-spacing: -0.02em;
    color: ${CREAM};
    line-height: 1.1;
    margin: 0 0 10px;
    text-shadow: 0 4px 24px rgba(0,0,0,0.4);
  }
  .tf-legal-subtitle {
    font-size: 16px;
    color: rgba(250,236,208,0.75);
    margin: 0 0 8px;
    line-height: 1.5;
  }
  .tf-legal-updated {
    font-size: 13px;
    color: rgba(250,236,208,0.55);
    margin: 0;
    letter-spacing: 0.02em;
  }
  .tf-legal-divider {
    height: 1px;
    background: rgba(255,255,255,0.08);
    margin: 24px 0 36px;
    border: 0;
  }
  .tf-legal-disclaimer {
    padding: 14px 18px;
    border-radius: 10px;
    background: rgba(128,192,200,0.08);
    border: 1px solid rgba(128,192,200,0.18);
    color: rgba(250,236,208,0.8);
    font-size: 14px;
    line-height: 1.6;
    margin: 0 0 32px;
  }
  .tf-legal-card h2 {
    font-family: ${FRAUNCES};
    font-size: 22px;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: ${CREAM};
    margin: 48px 0 16px;
    line-height: 1.25;
  }
  .tf-legal-card h3 {
    font-family: ${FRAUNCES};
    font-size: 17px;
    font-weight: 500;
    color: ${CREAM};
    margin: 32px 0 12px;
    line-height: 1.3;
  }
  .tf-legal-card p {
    font-family: ${INTER};
    font-size: 15px;
    line-height: 1.7;
    color: rgba(250,236,208,0.85);
    margin: 0 0 14px;
  }
  .tf-legal-card ul,
  .tf-legal-card ol {
    padding-left: 22px;
    margin: 0 0 16px;
  }
  .tf-legal-card li {
    font-family: ${INTER};
    font-size: 15px;
    line-height: 1.7;
    color: rgba(250,236,208,0.8);
    margin-bottom: 6px;
  }
  .tf-legal-card strong {
    color: ${CREAM};
    font-weight: 600;
  }
  .tf-legal-card a {
    color: ${CREAM};
    text-decoration: underline;
    transition: color 0.15s;
  }
  .tf-legal-card a:hover { color: #ffffff; }

  .tf-legal-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 32px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: ${INTER};
    font-size: 13px;
    color: ${CREAM_60};
    transition: color 0.15s;
  }
  .tf-legal-back:hover { color: ${CREAM}; }

  @media (max-width: 600px) {
    .tf-legal-content { padding: 100px 16px 60px; }
    .tf-legal-card    { padding: 24px; }
    .tf-legal-card h1 { font-size: 28px; }
    .tf-legal-card h2 { margin-top: 36px; font-size: 20px; }
  }
`;

export default function LegalPageTemplate({
  setPage,
  eyebrow = 'Legal',
  title,
  subtitle,
  lastUpdated,
  palette,
  children,
}) {
  return (
    <div className="tf-legal-page">
      <LegalScene palette={palette} />
      <Navbar onNavigate={setPage} />
      <style>{PROSE_CSS}</style>

      <div className="tf-legal-content">
        <div className="tf-legal-card">
          <div className="tf-legal-eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          {subtitle && <p className="tf-legal-subtitle">{subtitle}</p>}
          {lastUpdated && (
            <p className="tf-legal-updated">Last updated {lastUpdated}</p>
          )}
          <hr className="tf-legal-divider" />
          {children}
        </div>

        <button
          type="button"
          className="tf-legal-back"
          onClick={() => setPage('home')}
        >
          <ArrowLeft size={12} /> Back to home
        </button>
      </div>

      <Footer setPage={setPage} />
    </div>
  );
}

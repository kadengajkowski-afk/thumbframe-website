import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const featuresStyles = `
  .tf-feat-hero {
    padding: 140px 24px 80px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .tf-feat-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,107,0,0.06) 0%, transparent 70%);
    pointer-events: none;
  }
  .tf-feat-hero h1 {
    font-size: clamp(36px, 5vw, 60px);
    letter-spacing: -0.03em;
    line-height: 1.08;
    max-width: 680px;
    margin: 0 auto 20px;
  }
  .tf-feat-hero-sub {
    font-size: 18px;
    color: var(--text-secondary);
    max-width: 500px;
    margin: 0 auto;
    line-height: 1.65;
  }
  .tf-feat-toc {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
    margin-top: 36px;
    flex-wrap: wrap;
  }
  .tf-feat-toc a {
    padding: 8px 16px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-secondary);
    font-size: 13px;
    font-family: var(--font-body);
    font-weight: 500;
    text-decoration: none;
    transition: all var(--transition-base);
    cursor: pointer;
  }
  .tf-feat-toc a:hover {
    color: var(--text-primary);
    border-color: var(--border-hover);
    background: var(--bg-hover);
  }

  .tf-feat-section {
    padding: 80px 0;
    border-top: 1px solid var(--border);
  }
  .tf-feat-section-header {
    margin-bottom: 48px;
  }
  .tf-feat-section-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 12px;
    font-family: var(--font-body);
  }
  .tf-feat-section h2 {
    font-size: clamp(26px, 3vw, 38px);
    letter-spacing: -0.025em;
    margin-bottom: 14px;
  }
  .tf-feat-section-desc {
    font-size: 16px;
    color: var(--text-secondary);
    max-width: 520px;
    line-height: 1.65;
  }

  .tf-feat-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }
  .tf-feat-item {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: all var(--transition-base);
  }
  .tf-feat-item:hover {
    border-color: var(--border-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
  .tf-feat-item-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .tf-feat-item-icon {
    font-size: 28px;
    flex-shrink: 0;
  }
  .tf-feat-item h3 {
    font-size: 18px;
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    line-height: 1.3;
  }
  .tf-feat-item p {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.65;
  }

  @media (max-width: 768px) {
    .tf-feat-grid { grid-template-columns: 1fr; }
    .tf-feat-hero { padding: 120px 20px 60px; }
  }
`;

const AI_FEATURES = [
  {
    icon: '🎭',
    title: 'AI Background Removal',
    body: 'One-click subject isolation with edge refinement. No green screen, no manual selection — just clean cutouts every time.',
    badge: 'Free',
    badgeClass: 'badge-accent',
  },
  {
    icon: '✨',
    title: 'AI Background Generation',
    body: 'Describe the background you want. The AI generates a photorealistic or artistic scene perfectly matched to your subject.',
    badge: 'Pro',
    badgeClass: 'badge-pro',
  },
  {
    icon: '😊',
    title: 'Expression Enhancement',
    body: 'AI detects facial expressions and suggests enhancements. Brighten eyes, amplify shock, intensify emotion — stay authentic.',
    badge: 'Pro',
    badgeClass: 'badge-pro',
  },
  {
    icon: '🖼',
    title: 'Prompt-to-Thumbnail',
    body: 'Describe your complete thumbnail in natural language. Get a fully-composed, export-ready design you can customize.',
    badge: 'Pro',
    badgeClass: 'badge-pro',
  },
  {
    icon: '📊',
    title: 'CTR Intelligence Scoring',
    body: 'Before you publish, get an AI-generated CTR score and actionable feedback on color, text, contrast, and emotional punch.',
    badge: 'Pro',
    badgeClass: 'badge-pro',
  },
  {
    icon: '🔢',
    title: 'A/B Variant Generation',
    body: 'One design, multiple variations. The AI creates color, text, and layout variants automatically. Test and ship the winner.',
    badge: 'Pro',
    badgeClass: 'badge-pro',
  },
  {
    icon: '🧹',
    title: 'AI Healing Brush',
    body: 'Paint over distractions, blemishes, or unwanted elements. The AI fills them in seamlessly using context-aware generation.',
    badge: 'Pro',
    badgeClass: 'badge-pro',
  },
  {
    icon: '💡',
    title: 'Smart Subject Enhancement',
    body: 'Automatic contrast boost, skin tone balancing, and shadow fill specifically tuned for YouTube thumbnail subject framing.',
    badge: 'Pro',
    badgeClass: 'badge-pro',
  },
];

const EDITOR_FEATURES = [
  {
    icon: '📐',
    title: 'Layer System',
    body: 'Full non-destructive layers with groups, lock, visibility toggle, and blend mode per layer. Full Photoshop-compatible workflow.',
    badge: 'Free',
  },
  {
    icon: '🎨',
    title: 'Blend Modes',
    body: '20+ blend modes including Multiply, Screen, Overlay, Luminosity. Identical results to Photoshop.',
    badge: 'Free',
  },
  {
    icon: '✍️',
    title: 'Text Engine',
    body: '500+ fonts from Google Fonts. Per-character color, stroke, shadow, gradient fill. Variable font support.',
    badge: 'Free',
  },
  {
    icon: '🖌',
    title: 'Brush & Retouch Tools',
    body: 'Healing brush, clone stamp, dodge/burn, blur/sharpen. Everything for fine-tuning expressions and skin.',
    badge: 'Free',
  },
  {
    icon: '🔲',
    title: 'Selection Tools',
    body: 'Marquee, Lasso, Polygon Lasso, and Magic Wand. Full selection modification (grow, shrink, feather, invert).',
    badge: 'Free',
  },
  {
    icon: '🌊',
    title: 'Liquify Filter',
    body: 'Mesh-based warp tool. Push, pull, pinch, and bloat. Perfect for exaggerating expressions for emotional impact.',
    badge: 'Free',
  },
  {
    icon: '⚙️',
    title: 'Curves & Adjustments',
    body: 'Interactive LUT-based curves panel with RGB channel control. HSL, Levels, Brightness/Contrast, and more.',
    badge: 'Free',
  },
  {
    icon: '🎭',
    title: 'Masks',
    body: 'Non-destructive pixel and vector masks on every layer. Painted masks, gradient masks, luminosity masks.',
    badge: 'Free',
  },
];

const WORKFLOW_FEATURES = [
  {
    icon: '💾',
    title: 'Auto-Save',
    body: 'Your work is saved automatically to the cloud after every change. Never lose a design.',
    badge: 'Free',
  },
  {
    icon: '📁',
    title: 'Multi-Project Management',
    body: 'Organize designs by channel, series, or date. Unlimited projects on Pro. Full search and tagging.',
    badge: 'Free',
  },
  {
    icon: '📤',
    title: 'Export Formats',
    body: 'Export as PNG, JPG, WebP. Custom resolution up to 4K. Lossless or compressed. Direct YouTube dimension presets.',
    badge: 'Free',
  },
  {
    icon: '🔑',
    title: 'Keyboard Shortcuts',
    body: 'Full Photoshop-compatible shortcut system. Every tool, panel, and action accessible from the keyboard.',
    badge: 'Free',
  },
  {
    icon: '⌨️',
    title: 'Command Palette',
    body: 'VS Code-style command palette (Ctrl+K). Search and run any action by typing. Power user mode.',
    badge: 'Free',
  },
  {
    icon: '📱',
    title: 'Mobile View',
    body: 'Preview your thumbnail at mobile scale before export. See exactly how it looks in the YouTube app.',
    badge: 'Free',
  },
];

function FeatureSection({ id, label, title, description, features }) {
  return (
    <section className="tf-feat-section" id={id}>
      <div className="container">
        <div className="tf-feat-section-header animate-on-scroll">
          <p className="tf-feat-section-label">{label}</p>
          <h2>{title}</h2>
          <p className="tf-feat-section-desc">{description}</p>
        </div>
        <div className="tf-feat-grid stagger-children">
          {features.map((f) => (
            <div className="tf-feat-item" key={f.title}>
              <div className="tf-feat-item-top">
                <div>
                  <div className="tf-feat-item-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                </div>
                <span className={`badge ${f.badgeClass || 'badge-accent'}`}>{f.badge}</span>
              </div>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Features({ setPage }) {
  useScrollAnimation();

  useEffect(() => {
    document.title = 'Features | ThumbFrame — AI YouTube Thumbnail Editor';
  }, []);

  const go = (page) => {
    setPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <style>{featuresStyles}</style>
      <Navbar setPage={setPage} currentPage="features" />

      {/* Hero */}
      <div className="tf-feat-hero">
        <span className="badge badge-accent" style={{ marginBottom: 24 }}>Features</span>
        <h1 className="animate-on-scroll">
          Every tool a creator<br />
          <span className="text-gradient">actually needs.</span>
        </h1>
        <p className="tf-feat-hero-sub animate-on-scroll">
          AI that works, an editor built for thumbnails, and a workflow that gets out of your way.
        </p>
        <nav className="tf-feat-toc">
          <a href="#ai-tools">AI-Powered Tools</a>
          <a href="#editor">Professional Editor</a>
          <a href="#workflow">Workflow</a>
        </nav>
      </div>

      <FeatureSection
        id="ai-tools"
        label="AI-Powered Tools"
        title="AI that actually understands thumbnails."
        description="Not generic AI tools ported from Photoshop. These are purpose-built for YouTube thumbnails and CTR."
        features={AI_FEATURES}
      />

      <FeatureSection
        id="editor"
        label="Professional Editor"
        title="Pro-grade editing without the learning curve."
        description="All the power of Photoshop, none of the friction. Built specifically for the 1280×720 thumbnail workflow."
        features={EDITOR_FEATURES}
      />

      <FeatureSection
        id="workflow"
        label="Workflow"
        title="Ship thumbnails faster, not slower."
        description="Every workflow decision was made with one question: does this help a creator ship faster?"
        features={WORKFLOW_FEATURES}
      />

      {/* CTA */}
      <section className="section" style={{ textAlign: 'center', borderTop: '1px solid var(--border)' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(28px, 3vw, 42px)', marginBottom: 16 }} className="animate-on-scroll">
            Ready to try it?
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 32 }} className="animate-on-scroll">
            Start free. No credit card. Full editor access.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-lg" onClick={() => go('editor')}>
              Open the Editor →
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => go('pricing')}>
              View Pricing
            </button>
          </div>
        </div>
      </section>

      <Footer setPage={setPage} />
    </div>
  );
}

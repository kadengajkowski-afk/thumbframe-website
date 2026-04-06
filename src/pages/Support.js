import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

// ── FAQ Data ──────────────────────────────────────────────────────────────────
const FAQ_CATEGORIES = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    items: [
      {
        q: 'Is ThumbFrame free?',
        a: 'Yes — ThumbFrame has a free plan that includes the full editor and a limited number of AI-powered exports per month. Pro is $15/month and unlocks unlimited exports, advanced AI features, and priority support.',
      },
      {
        q: 'Do I need to download anything?',
        a: 'Nope. ThumbFrame runs entirely in your browser — no installs, no plugins, no extensions. Open it in Chrome or Edge and start creating.',
      },
      {
        q: 'What file formats can I import?',
        a: 'JPEG, PNG, WebP, and GIF are all supported. Max file size is 20MB per image. For best results with background removal, use a high-resolution PNG.',
      },
      {
        q: "What's the best way to get started?",
        a: 'Click "Start creating" on the homepage, upload your subject photo, and try the AI Background Remover first. From there, pick a preset background or use AI Generate to build one from a text prompt.',
      },
      {
        q: 'Can I use ThumbFrame without an account?',
        a: "Yes — you can use the editor and export locally without signing up. Creating an account unlocks cloud saves, revision history, and AI features.",
      },
    ],
  },
  {
    id: 'editor',
    label: 'Editor',
    items: [
      {
        q: 'How do I remove the background from my image?',
        a: 'Select the layer with your subject and click the AI Background Remover button in the toolbar (or press B). It runs in about 3–5 seconds and gives you a clean cutout with sharp edges.',
      },
      {
        q: 'Can I use custom fonts?',
        a: "Not yet — we include 20+ premium fonts built directly into the editor. Custom font upload is on the roadmap for Q2 this year. We're prioritizing fonts that actually perform well on YouTube.",
      },
      {
        q: 'How do layers work?',
        a: 'Layers work like Photoshop — stacked top to bottom. Open the Layers panel on the right sidebar to add, reorder, rename, or hide layers. Double-click a layer thumbnail to edit it.',
      },
      {
        q: 'Can I export as PSD?',
        a: 'Yes — go to File → Export → PSD. All your layers are preserved so you can continue editing in Photoshop or pass it to a designer.',
      },
      {
        q: "What's the keyboard shortcut for [action]?",
        a: 'Press Ctrl+K (or Cmd+K on Mac) to open the Command Palette and search for any tool or action by name. Full shortcut list also available at Settings → Keyboard Shortcuts.',
      },
      {
        q: 'How do I undo/redo?',
        a: 'Ctrl+Z to undo, Ctrl+Y or Ctrl+Shift+Z to redo. The History panel on the right shows your full edit timeline and lets you jump to any state with a single click.',
      },
    ],
  },
  {
    id: 'ai-features',
    label: 'AI Features',
    items: [
      {
        q: 'How does the CTR score work?',
        a: "Our AI analyzes your thumbnail against YouTube's best-performing thumbnails and scores it 0–100 across four dimensions: contrast, face visibility, text readability, and composition. A score above 70 is competitive. Above 85 is excellent.",
      },
      {
        q: 'How accurate is the AI background removal?',
        a: "Very accurate on clean subject/background separations — usually better than remove.bg. Complex hair, fur, and transparent objects may need a quick touch-up with the edge refinement brush.",
      },
      {
        q: 'Can the AI generate thumbnail backgrounds?',
        a: 'Yes — use the AI Generate tool and describe the background you want. We use DALL-E 3 as the primary model with Flux and SDXL as automatic fallbacks, so you almost always get a result.',
      },
      {
        q: 'What AI models does ThumbFrame use?',
        a: "DALL-E 3 for image generation, a custom fine-tuned model for background removal, and Claude for CTR analysis and smart suggestions. We pick the best model for each task rather than using one for everything.",
      },
      {
        q: 'How many AI credits do I have?',
        a: "Free plan includes 10 AI actions per month (background removals + generations). Pro is unlimited. Check the quota indicator in the top bar — it updates in real time.",
      },
    ],
  },
  {
    id: 'billing',
    label: 'Account & Billing',
    items: [
      {
        q: 'How do I cancel my subscription?',
        a: 'Go to Settings → Billing and click "Cancel plan." Your Pro features stay active until the end of the billing period — we don\'t cut you off mid-cycle.',
      },
      {
        q: 'Do you offer refunds?',
        a: "Yes — full refund within 7 days of purchase, no questions asked. Email support@thumbframe.com with your account email and we'll process it same day.",
      },
      {
        q: 'Is my payment info secure?',
        a: "All payments go through Stripe — we never see or store your card details. ThumbFrame is PCI-DSS compliant through Stripe's certified infrastructure.",
      },
      {
        q: 'Can I use ThumbFrame for a team?',
        a: "Team plans are coming in Q3. For now, each account is individual. If you need multiple seats urgently, email us and we'll work something out.",
      },
      {
        q: 'What happens to my projects if I downgrade?',
        a: "Your projects are always yours — they stay saved. On the free plan you just lose access to Pro-only features. Re-upgrade anytime to unlock them again.",
      },
    ],
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
    items: [
      {
        q: "The editor is running slow — what should I do?",
        a: "Chrome or Edge gives the best performance. Make sure hardware acceleration is enabled (Settings → System in Chrome). Closing other heavy tabs helps too. If it's still slow, try reducing canvas resolution under Editor Settings.",
      },
      {
        q: "My file won't upload — what's wrong?",
        a: "Check that the file is under 20MB and is a supported format (JPEG, PNG, WebP, or GIF). If you're getting a CORS error, try a hard refresh (Ctrl+Shift+R) and disable any ad-blockers.",
      },
      {
        q: "I lost my work after closing the tab.",
        a: "ThumbFrame auto-saves to your browser's local storage every 30 seconds. If you're logged in, projects also sync to the cloud. Open the editor and check the Recent Projects panel — your work should be there.",
      },
      {
        q: "The AI features aren't working.",
        a: "Check that you have an active Pro subscription or free credits remaining — the quota indicator in the top bar will show 0 if you're out. If you have credits but still see an error, try logging out and back in.",
      },
      {
        q: "My export looks different from what I see in the editor.",
        a: "This is almost always a DPI or color profile issue. Export using PNG for the most faithful result. JPEG compression can shift colors slightly — use quality 95+ if JPEG is required.",
      },
    ],
  },
];

// ── JSON-LD FAQ Schema ────────────────────────────────────────────────────────
function FAQSchema() {
  const allItems = FAQ_CATEGORIES.flatMap((c) => c.items);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: allItems.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
    font-size: clamp(36px, 5vw, 60px);
    letter-spacing: -0.03em;
    line-height: 1.05;
    margin: 0 auto 16px;
    max-width: 600px;
  }
  .tf-support-hero p {
    font-size: 18px;
    color: var(--text-secondary);
    max-width: 440px;
    margin: 0 auto;
    line-height: 1.6;
  }

  /* ── FAQ ──────────────────────────────────────────────────────────────── */
  .tf-faq-section {
    max-width: 860px;
    margin: 0 auto;
    padding: 0 24px 100px;
  }
  .tf-faq-cat-label {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 40px;
    margin-top: 64px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .tf-faq-cat-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }
  .tf-faq-item {
    border-bottom: 1px solid var(--border);
    overflow: hidden;
  }
  .tf-faq-item:first-of-type {
    border-top: 1px solid var(--border);
  }
  .tf-faq-trigger {
    width: 100%;
    background: none;
    border: none;
    padding: 20px 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    cursor: pointer;
    text-align: left;
    color: var(--text-primary);
  }
  .tf-faq-q {
    font-size: 16px;
    font-weight: 500;
    line-height: 1.4;
    transition: color 0.2s;
    font-family: var(--font-body);
  }
  .tf-faq-trigger:hover .tf-faq-q {
    color: var(--accent);
  }
  .tf-faq-trigger.is-open .tf-faq-q {
    color: var(--accent);
  }
  .tf-faq-chevron {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 1.5px solid var(--border-subtle);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, border-color 0.2s, transform 0.3s;
    font-size: 9px;
    color: var(--text-muted);
  }
  .tf-faq-trigger.is-open .tf-faq-chevron {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
    transform: rotate(180deg);
  }
  .tf-faq-body {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.38s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s;
    opacity: 0;
  }
  .tf-faq-body.is-open {
    max-height: 400px;
    opacity: 1;
  }
  .tf-faq-body-inner {
    padding: 0 0 22px;
    font-size: 15px;
    color: var(--text-secondary);
    line-height: 1.75;
    max-width: 720px;
  }

  /* ── Shared form section ──────────────────────────────────────────────── */
  .tf-contact-section {
    background: #0d0d0d;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 100px 24px;
  }
  .tf-contact-inner {
    max-width: 680px;
    margin: 0 auto;
  }
  .tf-section-eyebrow {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 12px;
  }
  .tf-section-heading {
    font-size: clamp(28px, 4vw, 42px);
    letter-spacing: -0.02em;
    line-height: 1.1;
    margin: 0 0 12px;
    font-family: var(--font-display);
  }
  .tf-section-sub {
    font-size: 16px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0 0 48px;
  }
  .tf-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 0;
  }
  @media (max-width: 600px) {
    .tf-form-row { grid-template-columns: 1fr; }
  }
  .tf-form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
  }
  .tf-form-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    letter-spacing: 0.01em;
  }
  .tf-form-input,
  .tf-form-select,
  .tf-form-textarea {
    background: #141414;
    border: 1.5px solid var(--border);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 15px;
    font-family: var(--font-body);
    padding: 12px 14px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    width: 100%;
    box-sizing: border-box;
    -webkit-appearance: none;
  }
  .tf-form-select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23555' d='M6 8L0 0h12z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    padding-right: 36px;
    cursor: pointer;
  }
  .tf-form-select option {
    background: #141414;
    color: var(--text-primary);
  }
  .tf-form-input:focus,
  .tf-form-select:focus,
  .tf-form-textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(255,107,0,0.12);
  }
  .tf-form-input::placeholder,
  .tf-form-textarea::placeholder {
    color: #3a3a3a;
  }
  .tf-form-textarea {
    resize: vertical;
    min-height: 120px;
  }
  .tf-form-error {
    font-size: 12px;
    color: #ef4444;
  }
  .tf-upload-area {
    border: 1.5px dashed #2a2a2a;
    border-radius: 8px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 14px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    background: #141414;
  }
  .tf-upload-area:hover {
    border-color: var(--accent);
    background: rgba(255,107,0,0.03);
  }
  .tf-upload-icon {
    width: 38px;
    height: 38px;
    border-radius: 8px;
    background: rgba(255,107,0,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    font-size: 18px;
    flex-shrink: 0;
  }
  .tf-upload-text {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.4;
  }
  .tf-upload-text strong {
    color: var(--accent);
    font-weight: 500;
  }
  .tf-upload-text span {
    display: block;
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 3px;
  }
  .tf-upload-preview {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: var(--text-secondary);
    background: #141414;
    border: 1.5px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
  }
  .tf-upload-preview img {
    width: 38px;
    height: 38px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid var(--border);
  }
  .tf-upload-remove {
    background: none;
    border: none;
    color: #555;
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    padding: 0;
    margin-left: auto;
    transition: color 0.15s;
  }
  .tf-upload-remove:hover { color: #ef4444; }
  .tf-submit-btn {
    width: 100%;
    padding: 14px;
    border-radius: 8px;
    border: none;
    background: var(--accent);
    color: #fff;
    font-size: 15px;
    font-weight: 600;
    font-family: var(--font-body);
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
    margin-top: 8px;
    letter-spacing: 0.01em;
  }
  .tf-submit-btn:hover:not(:disabled) { background: #e55f00; }
  .tf-submit-btn:active:not(:disabled) { transform: scale(0.99); }
  .tf-submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .tf-success-state {
    text-align: center;
    padding: 48px 0;
  }
  .tf-success-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: rgba(34,197,94,0.12);
    color: #22c55e;
    font-size: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    font-weight: 700;
  }
  .tf-success-state h3 {
    font-size: 22px;
    font-weight: 600;
    margin: 0 0 8px;
    letter-spacing: -0.02em;
  }
  .tf-success-state p {
    font-size: 15px;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .tf-char-count {
    font-size: 12px;
    color: var(--text-muted);
    text-align: right;
    margin-top: 4px;
  }

  /* ── Review stars ─────────────────────────────────────────────────────── */
  .tf-review-section {
    max-width: 680px;
    margin: 0 auto;
    padding: 100px 24px;
  }
  .tf-star-row {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }
  .tf-star-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 30px;
    line-height: 1;
    color: #2a2a2a;
    padding: 2px;
    transition: color 0.12s, transform 0.1s;
  }
  .tf-star-btn.filled { color: var(--accent); }
  .tf-star-btn:hover { transform: scale(1.18); }
  .tf-star-label {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 20px;
    min-height: 20px;
  }
  .tf-global-error {
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 14px;
    color: #ef4444;
    margin-bottom: 16px;
  }
`;

const STAR_LABELS = ['', 'Not good', 'Could be better', 'Pretty good', 'Really good', 'Amazing!'];

// ── FAQ Accordion ─────────────────────────────────────────────────────────────
function FAQAccordion() {
  const [openId, setOpenId] = useState(null);

  return (
    <div className="tf-faq-section">
      {FAQ_CATEGORIES.map((cat) => (
        <div key={cat.id}>
          <div className="tf-faq-cat-label animate-on-scroll">{cat.label}</div>
          {cat.items.map((item, i) => {
            const id = `${cat.id}-${i}`;
            const isOpen = openId === id;
            return (
              <div key={id} className="tf-faq-item">
                <button
                  className={`tf-faq-trigger${isOpen ? ' is-open' : ''}`}
                  onClick={() => setOpenId(isOpen ? null : id)}
                  aria-expanded={isOpen}
                >
                  <span className="tf-faq-q">{item.q}</span>
                  <span className="tf-faq-chevron">▼</span>
                </button>
                <div className={`tf-faq-body${isOpen ? ' is-open' : ''}`} aria-hidden={!isOpen}>
                  <div className="tf-faq-body-inner">{item.a}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Contact Form ──────────────────────────────────────────────────────────────
function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', category: '', subject: '', message: '' });
  const [screenshot, setScreenshot] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const setField = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email required.';
    if (!form.category) e.category = 'Please pick a category.';
    if (!form.subject.trim()) e.subject = 'Subject is required.';
    if (form.message.trim().length < 20) e.message = 'Message must be at least 20 characters.';
    return e;
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
      setErrors((err) => ({ ...err, screenshot: 'Only PNG, JPG, and GIF allowed.' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshot({ name: file.name, dataUrl: ev.target.result });
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const API = process.env.REACT_APP_API_URL || '';
      const res = await fetch(`${API}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, screenshot: screenshot?.dataUrl || null }),
      });
      if (!res.ok) throw new Error('Server error');
      setSuccess(true);
    } catch {
      setErrors({ _global: 'Something went wrong. Please try again or email support@thumbframe.com directly.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="tf-success-state">
        <div className="tf-success-icon">✓</div>
        <h3>Message sent!</h3>
        <p>We'll get back to you within 24 hours.<br />Check your inbox for a confirmation.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="tf-form-row">
        <div className="tf-form-group">
          <label className="tf-form-label">Name</label>
          <input className="tf-form-input" type="text" placeholder="Your name" value={form.name} onChange={(e) => setField('name', e.target.value)} />
          {errors.name && <span className="tf-form-error">{errors.name}</span>}
        </div>
        <div className="tf-form-group">
          <label className="tf-form-label">Email</label>
          <input className="tf-form-input" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setField('email', e.target.value)} />
          {errors.email && <span className="tf-form-error">{errors.email}</span>}
        </div>
      </div>

      <div className="tf-form-row">
        <div className="tf-form-group">
          <label className="tf-form-label">Category</label>
          <select className="tf-form-select" value={form.category} onChange={(e) => setField('category', e.target.value)}>
            <option value="">Select a category</option>
            <option value="Getting Started">Getting Started</option>
            <option value="Bug Report">Bug Report</option>
            <option value="Feature Request">Feature Request</option>
            <option value="Billing">Billing</option>
            <option value="Other">Other</option>
          </select>
          {errors.category && <span className="tf-form-error">{errors.category}</span>}
        </div>
        <div className="tf-form-group">
          <label className="tf-form-label">Subject</label>
          <input className="tf-form-input" type="text" placeholder="Brief summary" value={form.subject} onChange={(e) => setField('subject', e.target.value)} />
          {errors.subject && <span className="tf-form-error">{errors.subject}</span>}
        </div>
      </div>

      <div className="tf-form-group">
        <label className="tf-form-label">Message</label>
        <textarea className="tf-form-textarea" placeholder="Describe your issue or question in detail..." value={form.message} onChange={(e) => setField('message', e.target.value)} rows={5} />
        <div className="tf-char-count" style={{ color: form.message.length < 20 ? '#ef4444' : 'var(--text-muted)' }}>{form.message.length} / 20 min</div>
        {errors.message && <span className="tf-form-error">{errors.message}</span>}
      </div>

      <div className="tf-form-group">
        <label className="tf-form-label">Screenshot <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
        <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg,.gif" style={{ display: 'none' }} onChange={handleFile} />
        {screenshot ? (
          <div className="tf-upload-preview">
            <img src={screenshot.dataUrl} alt="screenshot preview" />
            <span>{screenshot.name}</span>
            <button type="button" className="tf-upload-remove" onClick={() => { setScreenshot(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>×</button>
          </div>
        ) : (
          <div className="tf-upload-area" onClick={() => fileInputRef.current?.click()}>
            <div className="tf-upload-icon">↑</div>
            <div className="tf-upload-text">
              <strong>Click to upload</strong> or drag and drop
              <span>PNG, JPG, GIF — max 5MB</span>
            </div>
          </div>
        )}
        {errors.screenshot && <span className="tf-form-error">{errors.screenshot}</span>}
      </div>

      {errors._global && <div className="tf-global-error">{errors._global}</div>}

      <button type="submit" className="tf-submit-btn" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send message →'}
      </button>
    </form>
  );
}

// ── Review Form ───────────────────────────────────────────────────────────────
function ReviewForm() {
  const [form, setForm] = useState({ name: '', channelUrl: '', reviewText: '' });
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const setField = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (rating === 0) e.rating = 'Please select a star rating.';
    if (form.reviewText.trim().length < 30) e.reviewText = 'Review must be at least 30 characters.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const API = process.env.REACT_APP_API_URL || '';
      const res = await fetch(`${API}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, rating }),
      });
      if (!res.ok) throw new Error('Server error');
      setSuccess(true);
    } catch {
      setErrors({ _global: 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="tf-success-state">
        <div className="tf-success-icon">✓</div>
        <h3>Review submitted!</h3>
        <p>Thanks for the feedback. Reviews are approved within 24 hours<br />before appearing on the homepage.</p>
      </div>
    );
  }

  const displayRating = hoverRating || rating;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="tf-form-group">
        <label className="tf-form-label">Your rating</label>
        <div className="tf-star-row">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`tf-star-btn${n <= displayRating ? ' filled' : ''}`}
              onClick={() => { setRating(n); setErrors((e) => ({ ...e, rating: '' })); }}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
            >★</button>
          ))}
        </div>
        <div className="tf-star-label">{STAR_LABELS[displayRating] || 'Select a rating'}</div>
        {errors.rating && <span className="tf-form-error" style={{ display: 'block', marginTop: '-12px', marginBottom: 12 }}>{errors.rating}</span>}
      </div>

      <div className="tf-form-row">
        <div className="tf-form-group">
          <label className="tf-form-label">Your name</label>
          <input className="tf-form-input" type="text" placeholder="e.g. Alex R." value={form.name} onChange={(e) => setField('name', e.target.value)} />
          {errors.name && <span className="tf-form-error">{errors.name}</span>}
        </div>
        <div className="tf-form-group">
          <label className="tf-form-label">Channel URL <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
          <input className="tf-form-input" type="url" placeholder="youtube.com/@yourchannel" value={form.channelUrl} onChange={(e) => setField('channelUrl', e.target.value)} />
        </div>
      </div>

      <div className="tf-form-group">
        <label className="tf-form-label">Your review</label>
        <textarea
          className="tf-form-textarea"
          placeholder="Tell us what you think about ThumbFrame — what's working, what you love, what could be better..."
          value={form.reviewText}
          onChange={(e) => setField('reviewText', e.target.value)}
          rows={5}
        />
        <div className="tf-char-count" style={{ color: form.reviewText.length < 30 ? '#ef4444' : 'var(--text-muted)' }}>{form.reviewText.length} / 30 min</div>
        {errors.reviewText && <span className="tf-form-error">{errors.reviewText}</span>}
      </div>

      {errors._global && <div className="tf-global-error">{errors._global}</div>}

      <button type="submit" className="tf-submit-btn" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit review →'}
      </button>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Support({ setPage }) {
  useScrollAnimation();

  useEffect(() => {
    document.title = 'Support — ThumbFrame';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Get help with ThumbFrame. Browse our FAQ, contact support, or leave a review.');
  }, []);

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
      <style>{supportStyles}</style>
      <FAQSchema />
      <Navbar setPage={setPage} currentPage="support" />

      {/* Hero */}
      <section className="tf-support-hero">
        <div className="animate-on-scroll" style={{ marginBottom: 16 }}>
          <span className="badge badge-accent">Support</span>
        </div>
        <h1 className="animate-on-scroll" style={{ animationDelay: '60ms' }}>
          Got questions?<br />
          <span className="text-gradient">We've got answers.</span>
        </h1>
        <p className="animate-on-scroll" style={{ animationDelay: '120ms' }}>
          Browse the FAQ below or send us a message. We respond within 24 hours.
        </p>
      </section>

      {/* FAQ Accordion */}
      <FAQAccordion />

      {/* Contact Form */}
      <section className="tf-contact-section">
        <div className="tf-contact-inner">
          <div className="tf-section-eyebrow animate-on-scroll">Contact</div>
          <h2 className="tf-section-heading animate-on-scroll" style={{ animationDelay: '40ms' }}>
            Still need help?
          </h2>
          <p className="tf-section-sub animate-on-scroll" style={{ animationDelay: '80ms' }}>
            Send us a message and we'll get back to you within 24 hours. For urgent billing issues, email{' '}
            <a href="mailto:support@thumbframe.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>support@thumbframe.com</a>{' '}
            directly.
          </p>
          <div className="animate-on-scroll" style={{ animationDelay: '120ms' }}>
            <ContactForm />
          </div>
        </div>
      </section>

      {/* Review Submission */}
      <section style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="tf-review-section">
          <div className="tf-section-eyebrow animate-on-scroll">Reviews</div>
          <h2 className="tf-section-heading animate-on-scroll" style={{ animationDelay: '40ms' }}>
            Leave a review
          </h2>
          <p className="tf-section-sub animate-on-scroll" style={{ animationDelay: '80ms' }}>
            Using ThumbFrame? Share what you think. Approved reviews appear on the homepage.
          </p>
          <div className="animate-on-scroll" style={{ animationDelay: '120ms' }}>
            <ReviewForm />
          </div>
        </div>
      </section>

      <Footer setPage={setPage} />
    </div>
  );
}

import React, { useRef, useState } from 'react';
import '@fontsource-variable/fraunces';
import { Plus } from 'lucide-react';
import LegalScene from '../landing/scenes/LegalScene';
import Navbar from '../landing/components/layout/Navbar';
import Footer from '../landing/components/layout/Footer';
import { useAuth } from '../context/AuthContext';
import { useSEO } from '../hooks/useSEO';

const FRAUNCES = "'Fraunces Variable', 'Fraunces', Georgia, serif";
const FONT_UI  = "'Inter Variable', 'Inter', system-ui, sans-serif";

const CREAM    = '#faecd0';
const CREAM_60 = 'rgba(250,236,208,0.6)';
const CREAM_70 = 'rgba(250,236,208,0.7)';
const CREAM_80 = 'rgba(250,236,208,0.8)';
const BORDER   = 'rgba(255,255,255,0.08)';
const BORDER_SOFT = 'rgba(255,255,255,0.05)';
const CARD_BG  = 'rgba(10,7,20,0.75)';
const INPUT_BG = '#0c0c0f';
const INPUT_TXT = '#f0f0f3';
const DANGER   = '#e87050';
const SUCCESS  = '#86efac';

const API_URL = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');

const FAQ = [
  {
    q: 'How do I cancel my subscription?',
    a: "You can cancel anytime from the Billing tab in Settings. Click “Manage subscription” and you’ll be taken to the Stripe Customer Portal where you can cancel. Your Pro access stays active until the end of your current paid period, then your account reverts to Free.",
  },
  {
    q: 'Can I use ThumbFrame commercially?',
    a: "Yes. Thumbnails you create with ThumbFrame belong to you. You can use them on YouTube, social media, paid promotions, client work — anywhere. ThumbFrame doesn’t claim any rights to your output.",
  },
  {
    q: "What’s the difference between Free and Pro?",
    a: "Free includes the full editor (paint, erase, clone, selections, text, layers, templates) with watermark-free exports, 5 ThumbFriend messages per day, and 5 background removals per month. Pro adds unlimited AI features (AI Generate, Auto Thumbnail, Face Enhancement, Style Transfer, A/B Variants), unlimited background removals, unlimited ThumbFriend messages, deep memory, premium templates, CTR Score breakdowns, and priority support — all for $15/month.",
  },
  {
    q: 'How does AI Generate work?',
    a: "You describe what you want and we use DALL-E 3 to generate a full image. It’s not just backgrounds — the AI builds a complete scene based on your prompt. Pro only. Each generation costs us money, but it’s included in your subscription.",
  },
  {
    q: 'How do I connect my YouTube channel?',
    a: "Click the Connections tab in Settings → YouTube channel → Connect. This is launching soon — right now the option is visible but not yet functional. Once live, connecting gives you CTR benchmarks from your actual videos and lets ThumbFrame learn what works for your audience.",
  },
  {
    q: 'Do you offer refunds?',
    a: "We don’t. You can cancel anytime from Billing and keep Pro access through the end of your paid period. If you’re unhappy, email hello@thumbframe.com — we genuinely want to hear why.",
  },
  {
    q: 'Is my data safe?',
    a: "Yes. Your designs are stored encrypted at rest in Supabase (US-East region). Passwords are handled by Supabase Auth, never stored in plaintext. Payment info is handled entirely by Stripe — we never see your card. See the Privacy Policy for the full breakdown.",
  },
  {
    q: 'What happens to my designs if I cancel?',
    a: "Nothing immediately. Your designs stay in your gallery even on the Free plan. If you delete your account entirely, all your designs are removed within 30 days.",
  },
  {
    q: 'How accurate is the CTR Score?',
    a: "The CTR Score uses a combination of face detection, contrast analysis, text legibility, color psychology, and benchmarks against successful thumbnails in your niche. It’s a directional guide — not a guarantee. Published thumbnails with higher CTR Scores consistently outperform lower-scored ones, but the final click rate depends on your title, audience, and timing too.",
  },
  {
    q: 'Can I upload my own fonts?',
    a: "Not yet. We’re working on it. For now, the editor includes a curated set of fonts that work well for thumbnails at YouTube’s display size.",
  },
  {
    q: 'I found a bug. Where do I report it?',
    a: "Send us a message below or email hello@thumbframe.com with a screenshot and a description. We read everything and ship fixes fast.",
  },
  {
    q: 'How do I request a new feature?',
    a: "Same place — use the contact form below or email hello@thumbframe.com. We keep a public changelog and many features come directly from user requests.",
  },
];

const CSS = `
  .tf-support-page {
    min-height: 100vh;
    position: relative;
    font-family: ${FONT_UI};
    color: ${CREAM};
  }
  .tf-support-content {
    position: relative;
    z-index: 1;
    max-width: 900px;
    margin: 0 auto;
    padding: 120px 24px 80px;
  }
  .tf-support-eyebrow {
    font-family: ${FRAUNCES};
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: ${CREAM_60};
    margin: 0 0 16px;
  }
  .tf-support-h1 {
    font-family: ${FRAUNCES};
    font-size: clamp(34px, 4.6vw, 48px);
    font-weight: 500;
    letter-spacing: -0.02em;
    color: ${CREAM};
    line-height: 1.05;
    margin: 0 0 14px;
    text-shadow: 0 4px 24px rgba(0,0,0,0.4);
  }
  .tf-support-sub {
    font-size: 16px;
    color: ${CREAM_70};
    margin: 0 0 48px;
    line-height: 1.55;
  }

  .tf-support-card {
    background: ${CARD_BG};
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid ${BORDER};
    border-radius: 16px;
    padding: 32px;
    max-width: 800px;
    margin: 0 auto 32px;
  }
  .tf-support-card + .tf-support-card { margin-top: 0; }

  .tf-support-section-h {
    font-family: ${FRAUNCES};
    font-size: 24px;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: ${CREAM};
    margin: 0 0 6px;
  }
  .tf-support-section-sub {
    font-size: 14px;
    color: ${CREAM_60};
    margin: 0 0 20px;
    line-height: 1.5;
  }

  /* ── FAQ accordion ──────────────────────────────────────────── */
  .tf-faq-list { display: flex; flex-direction: column; }
  .tf-faq-item { border-bottom: 1px solid ${BORDER_SOFT}; }
  .tf-faq-item:last-child { border-bottom: none; }

  .tf-faq-q {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 0;
    background: none;
    border: none;
    cursor: pointer;
    font-family: ${FRAUNCES};
    font-size: 16px;
    font-weight: 500;
    color: ${CREAM};
    text-align: left;
    transition: color 0.15s;
  }
  .tf-faq-q:hover { color: #ffffff; }

  .tf-faq-icon {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
    color: ${CREAM_70};
  }
  .tf-faq-icon.open { transform: rotate(45deg); }

  .tf-faq-wrap {
    overflow: hidden;
    transition: max-height 260ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .tf-faq-a {
    font-family: ${FONT_UI};
    font-size: 14px;
    line-height: 1.7;
    color: ${CREAM_80};
    padding: 0 0 20px;
    margin: 0;
  }

  /* ── Contact form ──────────────────────────────────────────── */
  .tf-support-form { display: flex; flex-direction: column; gap: 14px; }
  .tf-support-row2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .tf-support-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: ${CREAM_70};
    margin-bottom: 6px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-family: ${FONT_UI};
  }
  .tf-support-input, .tf-support-textarea {
    width: 100%;
    padding: 12px 14px;
    border-radius: 8px;
    border: 1px solid ${BORDER};
    background: ${INPUT_BG};
    color: ${INPUT_TXT};
    font-size: 15px;
    font-family: ${FONT_UI};
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  .tf-support-textarea { resize: vertical; min-height: 120px; line-height: 1.55; }
  .tf-support-input:focus, .tf-support-textarea:focus {
    border-color: rgba(250,236,208,0.3);
  }

  .tf-support-submit {
    align-self: flex-end;
    padding: 13px 26px;
    border-radius: 10px;
    border: none;
    background: rgba(255,244,224,1);
    color: rgba(10,7,20,1);
    font-size: 15px;
    font-weight: 700;
    font-family: ${FONT_UI};
    cursor: pointer;
    transition: background-color 0.15s, opacity 0.15s;
    margin-top: 6px;
  }
  .tf-support-submit:hover:not(:disabled) { background: #ffffff; }
  .tf-support-submit:disabled { opacity: 0.6; cursor: wait; }

  .tf-support-alert {
    padding: 11px 14px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.5;
  }
  .tf-support-alert.err {
    background: rgba(232,112,80,0.1);
    border: 1px solid rgba(232,112,80,0.25);
    color: ${DANGER};
  }
  .tf-support-success {
    text-align: center;
    padding: 32px 16px;
  }
  .tf-support-success-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px; height: 48px;
    border-radius: 50%;
    background: rgba(134,239,172,0.12);
    border: 1px solid rgba(134,239,172,0.3);
    color: ${SUCCESS};
    font-size: 24px;
    margin-bottom: 14px;
  }

  .tf-support-mailto {
    text-align: center;
    margin: 24px 0 0;
    font-size: 14px;
    color: ${CREAM_60};
  }
  .tf-support-mailto a {
    color: ${CREAM};
    text-decoration: underline;
  }
  .tf-support-mailto a:hover { color: #ffffff; }

  @media (max-width: 640px) {
    .tf-support-content { padding: 100px 16px 60px; }
    .tf-support-card { padding: 24px; }
    .tf-support-row2 { grid-template-columns: 1fr; }
    .tf-support-submit { align-self: stretch; width: 100%; }
  }
`;

// Autofill styling so the dark inputs don't flash white on Chrome.
const AUTOFILL_FIX = `
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active,
  textarea:-webkit-autofill {
    -webkit-box-shadow: 0 0 0 1000px ${INPUT_BG} inset !important;
    -webkit-text-fill-color: ${INPUT_TXT} !important;
    caret-color: ${INPUT_TXT} !important;
    transition: background-color 9999s ease-in-out 0s;
  }
`;

// ── FAQ accordion ────────────────────────────────────────────────────────────
function AccordionItem({ q, a }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef(null);
  const answerId = `tf-faq-${q.slice(0, 24).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

  const maxHeight = open && contentRef.current
    ? `${contentRef.current.scrollHeight}px`
    : '0px';

  return (
    <div className="tf-faq-item">
      <button
        type="button"
        className="tf-faq-q"
        aria-expanded={open}
        aria-controls={answerId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{q}</span>
        <span className={`tf-faq-icon ${open ? 'open' : ''}`}>
          <Plus size={18} strokeWidth={2} />
        </span>
      </button>
      <div className="tf-faq-wrap" style={{ maxHeight }}>
        <p id={answerId} ref={contentRef} className="tf-faq-a">
          {a}
        </p>
      </div>
    </div>
  );
}

function FAQSection() {
  return (
    <div className="tf-support-card">
      <h2 className="tf-support-section-h" style={{ marginBottom: 20 }}>
        Frequently asked
      </h2>
      <div className="tf-faq-list">
        {FAQ.map((item, i) => (
          <AccordionItem key={i} q={item.q} a={item.a} />
        ))}
      </div>
    </div>
  );
}

// ── Contact form ──────────────────────────────────────────────────────────────
function ContactForm() {
  const { user } = useAuth();
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState(user?.email || '');
  const [subject, setSubject]   = useState('');
  const [message, setMessage]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus]     = useState(null);         // 'success' | 'error'
  const [submittedEmail, setSubmittedEmail] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setStatus(null);
    setErrorMsg('');
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/support-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.error || "You're sending messages too fast. Please wait a minute.");
        setStatus('error');
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error('Unexpected response');

      setSubmittedEmail(email);
      setStatus('success');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[support] send failed:', err);
      setErrorMsg('Something went wrong. Please email hello@thumbframe.com directly.');
      setStatus('error');
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'success') {
    return (
      <div className="tf-support-card">
        <div className="tf-support-success" role="status" aria-live="polite">
          <div className="tf-support-success-icon">✓</div>
          <h2 className="tf-support-section-h" style={{ margin: '0 0 10px' }}>
            Message sent
          </h2>
          <p style={{ color: CREAM_70, fontSize: 15, margin: 0, lineHeight: 1.6 }}>
            We&rsquo;ll get back to you at{' '}
            <span style={{ color: CREAM, fontWeight: 600 }}>{submittedEmail}</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tf-support-card">
      <h2 className="tf-support-section-h">Send us a message</h2>
      <p className="tf-support-section-sub">We usually respond within 24 hours.</p>

      <form className="tf-support-form" onSubmit={handleSubmit}>
        <div className="tf-support-row2">
          <div>
            <label className="tf-support-label" htmlFor="sp-name">Name</label>
            <input
              id="sp-name"
              className="tf-support-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="tf-support-label" htmlFor="sp-email">Email</label>
            <input
              id="sp-email"
              className="tf-support-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <label className="tf-support-label" htmlFor="sp-subject">Subject</label>
          <input
            id="sp-subject"
            className="tf-support-input"
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div>
          <label className="tf-support-label" htmlFor="sp-message">Message</label>
          <textarea
            id="sp-message"
            className="tf-support-textarea"
            rows={6}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {status === 'error' && (
          <div className="tf-support-alert err" role="alert" aria-live="polite">
            {errorMsg || (
              <>
                Something went wrong. Please email{' '}
                <a href="mailto:hello@thumbframe.com" style={{ color: DANGER, textDecoration: 'underline' }}>
                  hello@thumbframe.com
                </a>{' '}
                directly.
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          className="tf-support-submit"
          disabled={submitting}
        >
          {submitting ? 'Sending…' : 'Send message'}
        </button>
      </form>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Support({ setPage }) {
  useSEO({
    title: 'Support — ThumbFrame',
    description: 'Find answers in the FAQ or send the ThumbFrame team a message.',
  });

  return (
    <div className="tf-support-page">
      <LegalScene palette={{
        core:      '#020812',
        mid:       '#0a2438',
        highlight: '#2a6878',
        accent:    '#80c0c8',
      }} />
      <Navbar onNavigate={setPage} />
      <style>{CSS}</style>
      <style>{AUTOFILL_FIX}</style>

      <div className="tf-support-content">
        <div className="tf-support-eyebrow">Support</div>
        <h1 className="tf-support-h1">How can we help?</h1>
        <p className="tf-support-sub">
          Check the FAQ below, or send us a message &mdash; we read every one.
        </p>

        <FAQSection />
        <ContactForm />

        <p className="tf-support-mailto">
          Or email us directly at{' '}
          <a href="mailto:hello@thumbframe.com">hello@thumbframe.com</a>
        </p>
      </div>

      <Footer setPage={setPage} />
    </div>
  );
}

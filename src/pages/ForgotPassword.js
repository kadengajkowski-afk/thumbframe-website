import React, { useEffect, useRef, useState } from 'react';
import '@fontsource-variable/fraunces';
import { ArrowLeft, Mail } from 'lucide-react';
import supabase from '../supabaseClient';
import AuthScene from '../landing/scenes/AuthScene';
import Navbar from '../landing/components/layout/Navbar';
import Footer from '../landing/components/layout/Footer';
import { useSEO } from '../hooks/useSEO';

const FRAUNCES = "'Fraunces Variable', 'Fraunces', Georgia, serif";
const FONT_UI  = "'Satoshi', sans-serif";

const CREAM     = '#faecd0';
const CREAM_60  = 'rgba(250,236,208,0.6)';
const CREAM_70  = 'rgba(250,236,208,0.7)';
const CREAM_80  = 'rgba(250,236,208,0.8)';
const BORDER    = 'rgba(255,255,255,0.08)';
const CARD_BG   = 'rgba(10,7,20,0.75)';
const INPUT_BG  = '#0c0c0f';
const INPUT_TXT = '#f0f0f3';
const DANGER    = '#e87050';

const cardStyle = {
  width: '100%',
  maxWidth: 440,
  position: 'relative',
  zIndex: 1,
  padding: '36px 32px',
  borderRadius: 16,
  background: CARD_BG,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: `1px solid ${BORDER}`,
  boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
  fontFamily: FONT_UI,
};

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: CREAM_70,
  marginBottom: 6,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  fontFamily: FONT_UI,
};

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  background: INPUT_BG,
  color: INPUT_TXT,
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: FONT_UI,
  transition: 'border-color 0.15s',
};

const creamBtn = {
  width: '100%',
  padding: '13px',
  borderRadius: 10,
  border: 'none',
  background: 'rgba(255,244,224,1)',
  color: 'rgba(10,7,20,1)',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'background-color 0.15s, opacity 0.15s',
  fontFamily: FONT_UI,
  marginTop: 4,
};

const backLink = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'none',
  border: 'none',
  padding: 0,
  fontFamily: FONT_UI,
  fontSize: 13,
  color: CREAM_60,
  cursor: 'pointer',
  transition: 'color 0.15s',
};

const RESEND_SECONDS = 60;

export default function ForgotPassword({ setPage }) {
  const [stage,       setStage]       = useState('form'); // 'form' | 'sent'
  const [email,       setEmail]       = useState('');
  const [submittedTo, setSubmittedTo] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [countdown,   setCountdown]   = useState(RESEND_SECONDS);
  const [toast,       setToast]       = useState('');
  const emailRef      = useRef(null);
  const toastTimerRef = useRef(null);

  useSEO({
    title: 'Reset your password — ThumbFrame',
    description: 'Request a password reset link for your ThumbFrame account.',
  });

  // Autofocus email input on the form stage.
  useEffect(() => {
    if (stage === 'form' && emailRef.current) emailRef.current.focus();
  }, [stage]);

  // Countdown tick while in 'sent' stage.
  useEffect(() => {
    if (stage !== 'sent' || countdown <= 0) return undefined;
    const t = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, countdown]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  async function sendReset(targetEmail) {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: 'https://www.thumbframe.com/update-password',
    });
    if (resetError) {
      const msg = (resetError.message || '').toLowerCase();
      const isRateLimit = resetError.status === 429 || msg.includes('rate limit');
      if (isRateLimit) {
        throw new Error('Too many requests. Please wait a few minutes and try again.');
      }
      throw new Error(resetError.message || 'Something went wrong. Please try again.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await sendReset(email);
      setSubmittedTo(email);
      setStage('sent');
      setCountdown(RESEND_SECONDS);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      await sendReset(submittedTo);
      setCountdown(RESEND_SECONDS);
      setToast('Resent!');
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(''), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: FONT_UI, position: 'relative',
    }}>
      <AuthScene />
      <Navbar onNavigate={setPage} />

      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px ${INPUT_BG} inset !important;
          -webkit-text-fill-color: ${INPUT_TXT} !important;
          caret-color: ${INPUT_TXT} !important;
          transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>

      <div style={cardStyle}>
        {/* Logo */}
        <button onClick={() => setPage('home')} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          marginBottom: 28, padding: 0,
        }}>
          <img src="/logo.jpg" alt="ThumbFrame" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: CREAM }}>ThumbFrame</span>
        </button>

        {stage === 'form' ? (
          <FormStage
            email={email}
            setEmail={setEmail}
            error={error}
            loading={loading}
            onSubmit={handleSubmit}
            emailRef={emailRef}
            onBack={() => setPage('login')}
          />
        ) : (
          <SentStage
            email={submittedTo}
            countdown={countdown}
            loading={loading}
            error={error}
            toast={toast}
            onResend={handleResend}
            onBack={() => setPage('login')}
          />
        )}
      </div>
    </div>
    <Footer setPage={setPage} />
    </>
  );
}

// ── Form stage (A) ────────────────────────────────────────────────────────────
function FormStage({ email, setEmail, error, loading, onSubmit, emailRef, onBack }) {
  return (
    <>
      <h1 style={{
        fontFamily: FRAUNCES,
        fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em',
        color: CREAM, margin: '0 0 10px', lineHeight: 1.1,
      }}>
        Reset your password
      </h1>
      <p style={{ fontSize: 14, color: CREAM_70, margin: '0 0 28px', lineHeight: 1.5 }}>
        Enter your email and we'll send you a reset link.
      </p>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label htmlFor="forgot-email" style={labelStyle}>Email</label>
          <input
            ref={emailRef}
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com"
            style={inputStyle}
            autoComplete="email"
            onFocus={(e) => (e.target.style.borderColor = 'rgba(250,236,208,0.3)')}
            onBlur={(e) => (e.target.style.borderColor = BORDER)}
          />
        </div>

        {error && (
          <div
            role="alert"
            aria-live="polite"
            style={{
              padding: '11px 14px',
              borderRadius: 8,
              background: 'rgba(232,112,80,0.1)',
              border: '1px solid rgba(232,112,80,0.25)',
              fontSize: 13,
              color: DANGER,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            ...creamBtn,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'wait' : 'pointer',
          }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#ffffff'; }}
          onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(255,244,224,1)'; }}
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <button
          type="button"
          onClick={onBack}
          style={backLink}
          onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
          onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_60)}
        >
          <ArrowLeft size={12} /> Back to login
        </button>
      </div>
    </>
  );
}

// ── Sent stage (B) ────────────────────────────────────────────────────────────
function SentStage({ email, countdown, loading, error, toast, onResend, onBack }) {
  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 56, height: 56,
        borderRadius: '50%',
        background: 'rgba(250,236,208,0.08)',
        border: `1px solid ${BORDER}`,
        margin: '0 auto 20px',
      }}>
        <Mail size={24} color={CREAM} strokeWidth={1.5} />
      </div>

      <h1 style={{
        fontFamily: FRAUNCES,
        fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em',
        color: CREAM, margin: '0 0 14px', lineHeight: 1.15, textAlign: 'center',
      }}>
        Check your email
      </h1>

      <p
        role="status"
        aria-live="polite"
        style={{
          fontSize: 14, color: CREAM_80, margin: '0 0 24px',
          lineHeight: 1.6, textAlign: 'center',
        }}
      >
        If an account exists for{' '}
        <span style={{ color: CREAM, fontWeight: 600 }}>{email}</span>
        , we've sent a password reset link. Click the link to set a new password.
      </p>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            padding: '11px 14px',
            borderRadius: 8,
            background: 'rgba(232,112,80,0.1)',
            border: '1px solid rgba(232,112,80,0.25)',
            fontSize: 13,
            color: DANGER,
            lineHeight: 1.5,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ textAlign: 'center', marginBottom: 20, minHeight: 22 }}>
        {countdown > 0 ? (
          <span style={{ fontSize: 13, color: CREAM_60 }}>
            Didn't get it? Resend available in {countdown}s
          </span>
        ) : (
          <button
            type="button"
            onClick={onResend}
            disabled={loading}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontFamily: FONT_UI, fontSize: 13,
              color: CREAM, cursor: loading ? 'wait' : 'pointer',
              textDecoration: 'underline',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Resending…' : 'Resend email'}
          </button>
        )}
        {toast && (
          <span style={{ marginLeft: 10, fontSize: 12, color: '#86efac' }}>
            {toast}
          </span>
        )}
      </div>

      <div style={{ textAlign: 'center' }}>
        <button
          type="button"
          onClick={onBack}
          style={backLink}
          onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
          onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_60)}
        >
          <ArrowLeft size={12} /> Back to login
        </button>
      </div>
    </>
  );
}

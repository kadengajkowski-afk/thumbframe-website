import React, { useEffect, useRef, useState } from 'react';
import '@fontsource-variable/fraunces';
import { ArrowLeft, Check, Eye, EyeOff, Minus } from 'lucide-react';
import supabase from '../supabaseClient';
import AuthScene from '../landing/scenes/AuthScene';
import Navbar from '../landing/components/layout/Navbar';
import { useSEO } from '../hooks/useSEO';

const FRAUNCES = "'Fraunces Variable', 'Fraunces', Georgia, serif";
const FONT_UI  = "'Satoshi', sans-serif";

const CREAM     = '#faecd0';
const CREAM_40  = 'rgba(250,236,208,0.4)';
const CREAM_60  = 'rgba(250,236,208,0.6)';
const CREAM_70  = 'rgba(250,236,208,0.7)';
const CREAM_80  = 'rgba(250,236,208,0.8)';
const BORDER    = 'rgba(255,255,255,0.08)';
const CARD_BG   = 'rgba(10,7,20,0.75)';
const INPUT_BG  = '#0c0c0f';
const INPUT_TXT = '#f0f0f3';
const DANGER    = '#e87050';
const SUCCESS   = '#86efac';

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
  padding: '12px 44px 12px 14px',
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

// ── Main page ──────────────────────────────────────────────────────────────────
export default function UpdatePassword({ setPage }) {
  // 'checking' | 'form' | 'success' | 'expired'
  const [stage, setStage] = useState('checking');

  useSEO({
    title: 'Set a new password — ThumbFrame',
    description: 'Choose a new password for your ThumbFrame account.',
  });

  // Detect recovery token on mount. Supabase auto-parses the URL fragment
  // (#access_token=…&type=recovery). We check for either an error in the
  // hash (expired/invalid) or a valid session after a short grace period.
  useEffect(() => {
    let cancelled = false;
    let sub = null;

    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const hashHasError = /error_code=|error_description=/i.test(hash);
    if (hashHasError) {
      setStage('expired');
      return () => {};
    }

    // Subscribe to PASSWORD_RECOVERY event — fires when Supabase has
    // successfully parsed the recovery token from the URL.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY') {
        setStage('form');
      }
    });
    sub = data?.subscription || null;

    // Fallback: check existing session. Supabase may have already parsed
    // the URL before we mounted, in which case no event fires.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        setStage('form');
      } else {
        // Give the SDK a moment to parse hash, then give up.
        setTimeout(() => {
          if (cancelled) return;
          setStage((prev) => (prev === 'checking' ? 'expired' : prev));
        }, 1500);
      }
    });

    return () => {
      cancelled = true;
      if (sub) sub.unsubscribe();
    };
  }, []);

  return (
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

        {stage === 'checking' && <CheckingStage />}
        {stage === 'form'     && <FormStage setPage={setPage} onSuccess={() => setStage('success')} onExpired={() => setStage('expired')} />}
        {stage === 'success'  && <SuccessStage setPage={setPage} />}
        {stage === 'expired'  && <ExpiredStage setPage={setPage} />}
      </div>
    </div>
  );
}

// ── Checking (brief loading before we know the stage) ────────────────────────
function CheckingStage() {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0 8px', color: CREAM_70, fontSize: 14 }}>
      Verifying link…
    </div>
  );
}

// ── Form stage (A) ────────────────────────────────────────────────────────────
function FormStage({ setPage, onSuccess, onExpired }) {
  const [pw,      setPw]      = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const pwRef = useRef(null);

  useEffect(() => {
    if (pwRef.current) pwRef.current.focus();
  }, []);

  const lengthOk = pw.length >= 8;
  const matchOk  = pw.length > 0 && confirm.length > 0 && pw === confirm;
  const canSubmit = lengthOk && matchOk && !loading;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: pw });
      if (updateError) throw updateError;
      onSuccess();
    } catch (err) {
      const msg    = (err.message || '').toLowerCase();
      const status = err.status;
      if (
        status === 401 || status === 422
        || msg.includes('token') || msg.includes('expired') || msg.includes('invalid')
      ) {
        onExpired();
      } else if (msg.includes('weak') || msg.includes('password')) {
        setError('Password is too weak. Try a longer or more complex one.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 style={{
        fontFamily: FRAUNCES,
        fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em',
        color: CREAM, margin: '0 0 10px', lineHeight: 1.1,
      }}>
        Set a new password
      </h1>
      <p style={{ fontSize: 14, color: CREAM_70, margin: '0 0 28px', lineHeight: 1.5 }}>
        Choose a strong password you haven't used before.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PasswordField
          id="new-pw"
          label="New password"
          inputRef={pwRef}
          value={pw}
          onChange={setPw}
          show={showPw}
          onToggle={() => setShowPw((v) => !v)}
          autoComplete="new-password"
        />
        <PasswordField
          id="confirm-pw"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          show={showConfirm}
          onToggle={() => setShowConfirm((v) => !v)}
          autoComplete="new-password"
        />

        {/* Validation checklist */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6,
          marginTop: 2, marginBottom: 2,
        }} aria-live="polite">
          <ValidationLine ok={lengthOk} text="At least 8 characters" />
          <ValidationLine ok={matchOk}  text="Passwords match" />
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
          disabled={!canSubmit}
          style={{
            ...creamBtn,
            opacity: canSubmit ? 1 : 0.5,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
          onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.background = '#ffffff'; }}
          onMouseLeave={(e) => { if (canSubmit) e.currentTarget.style.background = 'rgba(255,244,224,1)'; }}
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <button
          type="button"
          onClick={() => setPage('login')}
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

// ── Success stage (B) ─────────────────────────────────────────────────────────
function SuccessStage({ setPage }) {
  useEffect(() => {
    const t = setTimeout(() => setPage('login'), 2000);
    return () => clearTimeout(t);
  }, [setPage]);

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 56, height: 56, borderRadius: '50%',
        background: 'rgba(134,239,172,0.1)',
        border: `1px solid rgba(134,239,172,0.3)`,
        margin: '0 auto 20px',
      }}>
        <Check size={26} color={SUCCESS} strokeWidth={2} />
      </div>

      <h1 style={{
        fontFamily: FRAUNCES,
        fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em',
        color: CREAM, margin: '0 0 12px', lineHeight: 1.15,
      }}>
        Password updated
      </h1>
      <p
        role="status"
        aria-live="polite"
        style={{ fontSize: 14, color: CREAM_70, margin: 0, lineHeight: 1.6 }}
      >
        You're all set. Redirecting to login…
      </p>
    </div>
  );
}

// ── Expired stage (C) ─────────────────────────────────────────────────────────
function ExpiredStage({ setPage }) {
  return (
    <div>
      <h1 style={{
        fontFamily: FRAUNCES,
        fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em',
        color: CREAM, margin: '0 0 12px', lineHeight: 1.15,
      }}>
        This link has expired
      </h1>
      <p style={{ fontSize: 14, color: CREAM_70, margin: '0 0 24px', lineHeight: 1.6 }}>
        Password reset links expire after a short time for security. Request a new one to try again.
      </p>

      <button
        type="button"
        onClick={() => setPage('forgot-password')}
        style={creamBtn}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#ffffff')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,244,224,1)')}
      >
        Request new link
      </button>

      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <button
          type="button"
          onClick={() => setPage('login')}
          style={backLink}
          onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
          onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_60)}
        >
          <ArrowLeft size={12} /> Back to login
        </button>
      </div>
    </div>
  );
}

// ── Reusable password field with show/hide toggle ────────────────────────────
function PasswordField({ id, label, inputRef, value, onChange, show, onToggle, autoComplete }) {
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          style={inputStyle}
          autoComplete={autoComplete}
          onFocus={(e) => (e.target.style.borderColor = 'rgba(250,236,208,0.3)')}
          onBlur={(e) => (e.target.style.borderColor = BORDER)}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            padding: 6,
            cursor: 'pointer',
            color: CREAM_60,
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
          onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_60)}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

// ── Validation line (single item in the checklist) ───────────────────────────
function ValidationLine({ ok, text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 12, color: ok ? CREAM_80 : CREAM_40,
      transition: 'color 0.15s',
    }}>
      {ok ? <Check size={12} color={CREAM} strokeWidth={2.5} /> : <Minus size={12} color={CREAM_40} />}
      <span>{text}</span>
    </div>
  );
}

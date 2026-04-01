import { useState } from 'react';
import supabase from './supabaseClient';

const C = {
  bg:       '#0a0a0a',
  bg2:      '#0f0f0f',
  panel:    '#141414',
  border:   '#202020',
  border2:  '#2d2d2d',
  text:     '#f4f4f5',
  text2:    '#a1a1aa',
  muted:    '#52525b',
  accent:   '#f97316',
  accent2:  '#ea580c',
  success:  '#22c55e',
};

export default function ForgotPassword({ setPage }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleReset(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://www.thumbframe.com/update-password',
      });

      if (resetError) throw resetError;

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 7,
    border: `1.5px solid ${C.border2}`,
    fontSize: 14,
    fontFamily: 'inherit',
    background: C.bg2,
    color: C.text,
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  if (success) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', background: C.panel, borderRadius: 12, padding: 40, border: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 16, color: '#fff' }}>✓</span>
            </div>
            <span style={{ fontSize: 17, fontWeight: '700', color: C.text }}>Check your email</span>
          </div>

          <p style={{ fontSize: 14, color: C.text2, marginBottom: 24, lineHeight: 1.6 }}>
            Check your email for the reset link. If you don't see it, check your spam folder.
          </p>

          <button onClick={() => setPage('login')} style={{
            width: '100%',
            padding: '12px',
            borderRadius: 7,
            border: 'none',
            background: C.accent,
            color: '#fff',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: '700',
            boxShadow: `0 4px 16px ${C.accent}44`,
          }}>
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 420, width: '100%', background: C.panel, borderRadius: 12, padding: 40, border: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, color: '#fff', fontWeight: '800' }}>S</span>
          </div>
          <span style={{ fontSize: 17, fontWeight: '700', color: C.text }}>ThumbFrame</span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: '800', letterSpacing: '-0.5px', marginBottom: 6, color: C.text }}>
          Reset your password
        </h1>
        <p style={{ fontSize: 14, color: C.muted, marginBottom: 28, lineHeight: 1.5 }}>
          Enter your email and we'll send you a link to reset your password.
        </p>

        <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: '600', color: C.text2, display: 'block', marginBottom: 5 }}>Email</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@gmail.com"
              style={inputStyle}
              type="email"
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border2}
            />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 7, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', fontSize: 13, color: '#f87171' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%',
            padding: '12px',
            borderRadius: 7,
            border: 'none',
            background: loading ? C.muted : C.accent,
            color: '#fff',
            cursor: loading ? 'default' : 'pointer',
            fontSize: 14,
            fontWeight: '700',
            marginTop: 6,
            boxShadow: loading ? 'none' : `0 4px 16px ${C.accent}44`,
          }}>
            {loading ? 'Sending…' : 'Send reset link →'}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <span onClick={() => setPage('login')} style={{ fontSize: 12, color: C.muted, cursor: 'pointer', textDecoration: 'underline' }}>
            Back to login
          </span>
        </div>
      </div>
    </div>
  );
}

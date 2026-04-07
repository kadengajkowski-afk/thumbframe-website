import React, { useState } from 'react';
import supabase from '../supabaseClient';

export default function Login({ setPage }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // Read ?redirect=xxx so we can bounce there after login
  const redirectTo = new URLSearchParams(window.location.search).get('redirect') || 'editor';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required.'); return; }
    setLoading(true); setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message || 'Login failed. Check your email and password.');
      setLoading(false);
      return;
    }

    if (data?.session) {
      // Manually persist so AuthContext paints instantly on next page
      localStorage.setItem('thumbframe_token', data.session.access_token);
      localStorage.setItem('thumbframe_user', JSON.stringify({
        id:    data.user.id,
        email: data.user.email,
        name:  data.user.user_metadata?.name || data.user.email.split('@')[0],
        plan:  'free',
        is_pro: false,
      }));
      setPage(redirectTo);
    }
    setLoading(false);
  }

  const inp = {
    width: '100%', padding: '12px 14px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)', background: '#0c0c0f',
    color: '#f0f0f3', fontSize: 15, outline: 'none',
    boxSizing: 'border-box', fontFamily: "'Satoshi', sans-serif",
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#050507',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'Satoshi', sans-serif",
    }}>
      {/* Orange glow behind card */}
      <div style={{
        position: 'fixed', top: '40%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(255,107,0,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>

        {/* Logo */}
        <button onClick={() => setPage('home')} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          marginBottom: 40, padding: 0,
        }}>
          <img src="/logo.jpg" alt="ThumbFrame" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f3' }}>ThumbFrame</span>
        </button>

        <h1 style={{
          fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em',
          color: '#f0f0f3', margin: '0 0 8px',
        }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 14, color: '#8a8a93', margin: '0 0 32px', lineHeight: 1.5 }}>
          Log in to access your saved thumbnails.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8a8a93', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@gmail.com" style={inp} autoComplete="email"
              onFocus={e => e.target.style.borderColor = '#FF6B00'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8a8a93', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Your password" style={inp} autoComplete="current-password"
              onFocus={e => e.target.style.borderColor = '#FF6B00'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          {error && (
            <div style={{
              padding: '11px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 13, color: '#f87171', lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '13px', borderRadius: 8, border: 'none',
            background: loading ? '#1e1e24' : '#FF6B00',
            color: loading ? '#55555e' : '#fff',
            cursor: loading ? 'default' : 'pointer',
            fontSize: 15, fontWeight: 700,
            boxShadow: loading ? 'none' : '0 0 30px rgba(255,107,0,0.25)',
            transition: 'all 0.2s', marginTop: 4,
            fontFamily: "'Satoshi', sans-serif",
          }}>
            {loading ? 'Logging in…' : 'Log in →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', margin: '14px 0 0', fontSize: 12, color: '#55555e' }}>
          <span
            onClick={() => setPage('forgot-password')}
            style={{ color: '#FF6B00', cursor: 'pointer' }}
          >
            Forgot password?
          </span>
        </p>

        {/* Switch to signup */}
        <div style={{
          marginTop: 28, padding: '16px', borderRadius: 10,
          background: '#0c0c0f', border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: 13, color: '#55555e' }}>Don't have an account? </span>
          <span
            onClick={() => setPage('signup')}
            style={{ fontSize: 13, color: '#FF6B00', cursor: 'pointer', fontWeight: 600 }}
          >
            Sign up free →
          </span>
        </div>

      </div>
    </div>
  );
}

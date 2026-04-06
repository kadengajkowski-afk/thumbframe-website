import React, { useState } from 'react';
import supabase from '../supabaseClient';

export default function Signup({ setPage }) {
  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error,           setError]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [checkEmail,      setCheckEmail]      = useState(false);

  const redirectTo = new URLSearchParams(window.location.search).get('redirect') || 'editor';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords don\'t match.'); return; }
    setLoading(true); setError('');

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name || email.split('@')[0] } },
    });

    if (authError) {
      // Supabase surfaces "already registered" as a generic error — handle it
      if (authError.message?.toLowerCase().includes('already')) {
        setError(
          <span>
            You already have an account.{' '}
            <span onClick={() => setPage('login')} style={{ color: '#FF6B00', cursor: 'pointer', textDecoration: 'underline' }}>
              Log in instead →
            </span>
          </span>
        );
      } else {
        setError(authError.message || 'Signup failed. Please try again.');
      }
      setLoading(false);
      return;
    }

    // Supabase returns identities: [] when the email already exists (obfuscated)
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      setError(
        <span>
          An account with this email already exists.{' '}
          <span onClick={() => setPage('login')} style={{ color: '#FF6B00', cursor: 'pointer', textDecoration: 'underline' }}>
            Log in instead →
          </span>
        </span>
      );
      setLoading(false);
      return;
    }

    if (data?.session) {
      // Email confirmation off — session returned immediately
      localStorage.setItem('thumbframe_token', data.session.access_token);
      localStorage.setItem('thumbframe_user', JSON.stringify({
        id:    data.user.id,
        email: data.user.email,
        name:  data.user.user_metadata?.name || email.split('@')[0],
        plan:  'free',
        is_pro: false,
      }));
      setPage(redirectTo);
    } else {
      // Email confirmation on — ask user to check inbox
      setCheckEmail(true);
    }
    setLoading(false);
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/editor` },
    });
  }

  const inp = {
    width: '100%', padding: '12px 14px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.08)', background: '#0c0c0f',
    color: '#f0f0f3', fontSize: 15, outline: 'none',
    boxSizing: 'border-box', fontFamily: "'Satoshi', sans-serif",
    transition: 'border-color 0.2s',
  };

  if (checkEmail) {
    return (
      <div style={{
        minHeight: '100vh', background: '#050507',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, fontFamily: "'Satoshi', sans-serif",
      }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: 28,
          }}>
            ✉️
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f0f0f3', letterSpacing: '-0.03em', margin: '0 0 12px' }}>
            Check your email
          </h1>
          <p style={{ color: '#8a8a93', lineHeight: 1.6, margin: '0 0 28px' }}>
            We sent a confirmation link to <strong style={{ color: '#f0f0f3' }}>{email}</strong>.
            Click it to activate your account.
          </p>
          <button onClick={() => setPage('login')} style={{
            padding: '11px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
            background: 'transparent', color: '#f0f0f3', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, fontFamily: "'Satoshi', sans-serif",
          }}>
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#050507',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'Satoshi', sans-serif",
    }}>
      {/* Orange glow */}
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
          Create your account
        </h1>
        <p style={{ fontSize: 14, color: '#8a8a93', margin: '0 0 32px', lineHeight: 1.5 }}>
          Free forever. No credit card required.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8a8a93', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Your name
            </label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Jane Smith" style={inp} autoComplete="name"
              onFocus={e => e.target.style.borderColor = '#FF6B00'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

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
              placeholder="At least 8 characters" style={inp} autoComplete="new-password"
              onFocus={e => e.target.style.borderColor = '#FF6B00'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8a8a93', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Confirm password
            </label>
            <input
              type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password" style={inp} autoComplete="new-password"
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
            {loading ? 'Creating account…' : 'Create account →'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ fontSize: 12, color: '#55555e' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Google OAuth */}
        <button onClick={handleGoogle} style={{
          width: '100%', padding: '12px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.08)',
          background: '#0c0c0f', color: '#f0f0f3',
          cursor: 'pointer', fontSize: 14, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          transition: 'border-color 0.2s', fontFamily: "'Satoshi', sans-serif",
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Switch to login */}
        <div style={{
          marginTop: 28, padding: '16px', borderRadius: 10,
          background: '#0c0c0f', border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: 13, color: '#55555e' }}>Already have an account? </span>
          <span
            onClick={() => setPage('login')}
            style={{ fontSize: 13, color: '#FF6B00', cursor: 'pointer', fontWeight: 600 }}
          >
            Log in →
          </span>
        </div>

      </div>
    </div>
  );
}

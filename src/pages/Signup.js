import React, { useState } from 'react';
import '@fontsource-variable/fraunces';
import supabase from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import AuthScene from '../landing/scenes/AuthScene';
import Navbar from '../landing/components/layout/Navbar';
import Footer from '../landing/components/layout/Footer';

const FRAUNCES = "'Fraunces Variable', 'Fraunces', Georgia, serif";

const AUTOFILL_FIX = `
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 1000px #0c0c0f inset !important;
    -webkit-text-fill-color: #f0f0f3 !important;
    caret-color: #f0f0f3 !important;
    transition: background-color 9999s ease-in-out 0s;
  }
`;

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
            <button onClick={() => setPage('login')} style={{ color: '#FF6B00', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, font: 'inherit', touchAction: 'manipulation' }}>
              Log in instead →
            </button>
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
          <button onClick={() => setPage('login')} style={{ color: '#FF6B00', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, font: 'inherit', touchAction: 'manipulation' }}>
            Log in instead →
          </button>
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
      trackEvent('sign_up', { method: 'email' });
      setPage(redirectTo);
    } else {
      // Email confirmation on — ask user to check inbox
      trackEvent('sign_up', { method: 'email' });
      setCheckEmail(true);
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

  if (checkEmail) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, fontFamily: "'Satoshi', sans-serif",
        position: 'relative',
      }}>
        <AuthScene />
        <Navbar onNavigate={setPage} />
        <style>{AUTOFILL_FIX}</style>
        <div style={{
          width: '100%', maxWidth: 420, textAlign: 'center', position: 'relative', zIndex: 1,
          padding: '36px 32px',
          borderRadius: 16,
          background: 'rgba(10, 7, 20, 0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: 28,
          }}>
            ✉️
          </div>
          <h1 style={{
            fontFamily: FRAUNCES,
            fontSize: 30, fontWeight: 600, color: '#f0f0f3',
            letterSpacing: '-0.02em', margin: '0 0 12px', lineHeight: 1.1,
          }}>
            Check your email
          </h1>
          <p style={{ color: '#a8a0b0', lineHeight: 1.6, margin: '0 0 28px' }}>
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
    <>
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'Satoshi', sans-serif",
      position: 'relative',
    }}>
      <AuthScene />
      <Navbar onNavigate={setPage} />
      <style>{AUTOFILL_FIX}</style>

      <div style={{
        width: '100%', maxWidth: 420, position: 'relative', zIndex: 1,
        padding: '36px 32px',
        borderRadius: 16,
        background: 'rgba(10, 7, 20, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
      }}>

        {/* Logo */}
        <button onClick={() => setPage('home')} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          marginBottom: 28, padding: 0,
        }}>
          <img src="/logo.jpg" alt="ThumbFrame" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f3' }}>ThumbFrame</span>
        </button>

        <h1 style={{
          fontFamily: FRAUNCES,
          fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em',
          color: '#f0f0f3', margin: '0 0 8px', lineHeight: 1.1,
        }}>
          Create your account
        </h1>
        <p style={{ fontSize: 14, color: '#a8a0b0', margin: '0 0 28px', lineHeight: 1.5 }}>
          Free forever. No credit card required.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8a8a93', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Username
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

        {/* Switch to login */}
        <div style={{
          marginTop: 24, padding: '14px', borderRadius: 10,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: 13, color: '#8a8294' }}>Already have an account? </span>
          <span
            onClick={() => setPage('login')}
            style={{ fontSize: 13, color: '#FF6B00', cursor: 'pointer', fontWeight: 600 }}
          >
            Log in →
          </span>
        </div>

      </div>
    </div>
    <Footer setPage={setPage} />
    </>
  );
}

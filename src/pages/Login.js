import React, { useState } from 'react';
import '@fontsource-variable/fraunces';
import supabase from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import AuthScene from '../landing/scenes/AuthScene';
import Navbar from '../landing/components/layout/Navbar';
import Footer from '../landing/components/layout/Footer';

const FRAUNCES = "'Fraunces Variable', 'Fraunces', Georgia, serif";

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
      trackEvent('login', { method: 'email' });
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
    <>
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: "'Satoshi', sans-serif",
      position: 'relative',
    }}>
      <AuthScene />
      <Navbar onNavigate={setPage} />

      {/* Suppress Chrome's white autofill background on the dark inputs. */}
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #0c0c0f inset !important;
          -webkit-text-fill-color: #f0f0f3 !important;
          caret-color: #f0f0f3 !important;
          transition: background-color 9999s ease-in-out 0s;
        }
      `}</style>

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

        {/* Logo — ship mark + wordmark, matches the shared Navbar */}
        <button onClick={() => setPage('home')} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          marginBottom: 28, padding: 0,
        }}>
          <img
            src="/brand/ship-logo-final.png"
            alt="ThumbFrame"
            style={{
              height: 40, width: 'auto', display: 'block',
              filter: 'drop-shadow(0 1px 6px rgba(20, 12, 28, 0.85))',
            }}
          />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f3' }}>ThumbFrame</span>
        </button>

        <h1 style={{
          fontFamily: FRAUNCES,
          fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em',
          color: '#f0f0f3', margin: '0 0 8px', lineHeight: 1.1,
        }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 14, color: '#a8a0b0', margin: '0 0 28px', lineHeight: 1.5 }}>
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
            width: '100%', padding: '13px', borderRadius: 10, border: 'none',
            background: loading ? 'rgba(255,244,224,0.25)' : 'rgba(255,244,224,1)',
            color: loading ? 'rgba(10,7,20,0.4)' : 'rgba(10,7,20,1)',
            cursor: loading ? 'default' : 'pointer',
            fontSize: 15, fontWeight: 700,
            transition: 'background-color 0.15s, opacity 0.15s', marginTop: 4,
            fontFamily: "'Satoshi', sans-serif",
          }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#ffffff'; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(255,244,224,1)'; }}
          >
            {loading ? 'Logging in…' : 'Log in →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', margin: '14px 0 0', fontSize: 12, color: '#55555e' }}>
          <span
            onClick={() => setPage('forgot-password')}
            style={{ color: 'rgba(255,244,224,0.9)', cursor: 'pointer', transition: 'text-decoration 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            Forgot password?
          </span>
        </p>

        {/* Switch to signup */}
        <div style={{
          marginTop: 24, padding: '14px', borderRadius: 10,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: 13, color: '#8a8294' }}>Don't have an account? </span>
          <span
            onClick={() => setPage('signup')}
            style={{ fontSize: 13, color: 'rgba(255,244,224,0.9)', cursor: 'pointer', fontWeight: 600, transition: 'text-decoration 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            Sign up free →
          </span>
        </div>

      </div>
    </div>
    <Footer setPage={setPage} />
    </>
  );
}

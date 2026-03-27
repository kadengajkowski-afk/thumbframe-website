import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const C = {
  bg:       '#f5f0e8',
  bg2:      '#ede8dc',
  panel:    '#faf7f2',
  border:   '#d9d0c0',
  border2:  '#c9bfaa',
  text:     '#1a1612',
  text2:    '#3d3530',
  muted:    '#8a7d6e',
  accent:   '#c45c2e',
  accent2:  '#a34a22',
  success:  '#4a7c59',
};

export default function UpdatePassword({ setPage }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if user has a valid session from the recovery link
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setError('Invalid or expired reset link. Please request a new one.');
      }
    });
  }, []);

  async function handleUpdatePassword(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      
      // Redirect to editor after 2 seconds
      setTimeout(() => {
        setPage('editor');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to update password. Please try again.');
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
    background: '#fff',
    color: C.text,
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  if (success) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', background: C.panel, borderRadius: 12, padding: 40, border: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 16, color: '#fff' }}>✓</span>
            </div>
            <span style={{ fontSize: 17, fontWeight: '700', color: C.text }}>Password updated</span>
          </div>

          <p style={{ fontSize: 14, color: C.text2, marginBottom: 24, lineHeight: 1.6 }}>
            Your password has been successfully updated. Redirecting to editor...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ maxWidth: 420, width: '100%', background: C.panel, borderRadius: 12, padding: 40, border: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, color: '#fff', fontWeight: '800' }}>S</span>
          </div>
          <span style={{ fontSize: 17, fontWeight: '700', color: C.text }}>ThumbFrame</span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: '800', letterSpacing: '-0.5px', marginBottom: 6, color: C.text }}>
          Update your password
        </h1>
        <p style={{ fontSize: 14, color: C.muted, marginBottom: 28, lineHeight: 1.5 }}>
          Enter your new password below.
        </p>

        <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: '600', color: C.text2, display: 'block', marginBottom: 5 }}>New password</label>
            <input
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              style={inputStyle}
              type="password"
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border2}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: '600', color: C.text2, display: 'block', marginBottom: 5 }}>Confirm password</label>
            <input
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              style={inputStyle}
              type="password"
              onFocus={e => e.target.style.borderColor = C.accent}
              onBlur={e => e.target.style.borderColor = C.border2}
            />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#b91c1c' }}>
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
            {loading ? 'Updating…' : 'Update password →'}
          </button>
        </form>
      </div>
    </div>
  );
}

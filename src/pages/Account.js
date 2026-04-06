import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { handleUpgrade } from '../utils/checkout';
import supabase from '../supabaseClient';

const API_URL = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');

function PlanBadge({ plan }) {
  if (plan === 'pro') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 999,
        background: 'rgba(255,107,0,0.12)', border: '1px solid rgba(255,107,0,0.3)',
        fontSize: 12, fontWeight: 700, color: '#FF6B00',
        letterSpacing: '0.04em', textTransform: 'uppercase',
      }}>
        ⚡ Pro
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 999,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      fontSize: 12, fontWeight: 700, color: '#8a8a93',
      letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      Free
    </span>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: '#0c0c0f', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 14, padding: '28px 32px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: '#FF6B00',
      margin: '0 0 20px',
    }}>
      {children}
    </p>
  );
}

function Row({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: 14, color: '#8a8a93' }}>{label}</span>
      <span style={{ fontSize: 14, color: '#f0f0f3', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function Account({ setPage }) {
  const { user, logout } = useAuth();
  const [liveUser,     setLiveUser]     = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const checkoutSuccess = new URLSearchParams(window.location.search).get('checkout') === 'success';

  // Fetch up-to-date user data from backend
  useEffect(() => {
    const token = localStorage.getItem('thumbframe_token');
    if (!token) return;
    fetch(`${API_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setLiveUser(u); })
      .catch(() => {});
  }, []);

  const displayUser = liveUser || user;
  if (!displayUser) return null;

  const plan       = displayUser.plan || 'free';
  const isPro      = plan === 'pro';
  const memberSince = displayUser.createdAt
    ? new Date(displayUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  async function handleManageSubscription() {
    setPortalLoading(true);
    const token = localStorage.getItem('thumbframe_token');
    try {
      const res = await fetch(`${API_URL}/api/create-portal-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const { url, error } = await res.json();
      if (!res.ok || !url) throw new Error(error || 'No portal URL returned');
      window.location.href = url;
    } catch (err) {
      alert(err.message || 'Could not open billing portal. Try again.');
      setPortalLoading(false);
    }
  }

  async function handleDeleteAccount() {
    if (!window.confirm('Delete your account and all saved projects? This cannot be undone.')) return;
    setDeleteLoading(true);
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('thumbframe_token');
      localStorage.removeItem('thumbframe_user');
      logout();
      setPage('home');
    } catch {
      setDeleteLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#050507',
      fontFamily: "'Satoshi', sans-serif", color: '#f0f0f3',
    }}>
      <Navbar setPage={setPage} currentPage="account" />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '120px 24px 80px' }}>

        {/* Checkout success banner */}
        {checkoutSuccess && (
          <div style={{
            marginBottom: 32, padding: '16px 20px', borderRadius: 10,
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>🎉</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#4ade80' }}>You're on Pro!</div>
              <div style={{ fontSize: 13, color: '#8a8a93', marginTop: 2 }}>All Pro features are now unlocked. Go make some great thumbnails.</div>
            </div>
          </div>
        )}

        {/* Page header */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 8px' }}>
            Account
          </h1>
          <p style={{ color: '#8a8a93', margin: 0, fontSize: 15 }}>
            Manage your profile, subscription, and settings.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Profile */}
          <Card>
            <SectionLabel>Profile</SectionLabel>
            <Row label="Email"        value={displayUser.email} />
            <Row label="Name"         value={displayUser.name || '—'} />
            <Row label="Member since" value={memberSince} />
          </Card>

          {/* Subscription */}
          <Card>
            <SectionLabel>Subscription</SectionLabel>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div>
                <div style={{ fontSize: 14, color: '#8a8a93', marginBottom: 6 }}>Current plan</div>
                <PlanBadge plan={plan} />
              </div>
              {isPro ? (
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  style={{
                    padding: '9px 18px', borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'transparent', color: '#f0f0f3',
                    cursor: portalLoading ? 'default' : 'pointer',
                    fontSize: 13, fontWeight: 600, opacity: portalLoading ? 0.6 : 1,
                    fontFamily: "'Satoshi', sans-serif",
                  }}
                >
                  {portalLoading ? 'Opening…' : 'Manage Subscription'}
                </button>
              ) : (
                <button
                  onClick={handleUpgrade}
                  style={{
                    padding: '9px 18px', borderRadius: 8, border: 'none',
                    background: '#FF6B00', color: '#fff',
                    cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    boxShadow: '0 0 20px rgba(255,107,0,0.2)',
                    fontFamily: "'Satoshi', sans-serif",
                  }}
                >
                  Upgrade to Pro — $15/mo
                </button>
              )}
            </div>

            {!isPro && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  'Unlimited AI generations',
                  'CTR Intelligence scoring',
                  'A/B variant generation',
                  'Unlimited saved projects',
                  'Priority support',
                ].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#8a8a93' }}>
                    <span style={{ color: '#FF6B00', fontSize: 12 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Usage */}
          <Card>
            <SectionLabel>Usage</SectionLabel>
            <Row label="AI operations this month" value={isPro ? 'Unlimited' : `${displayUser.aiUsage ?? '—'} / 5`} />
            <Row label="Saved projects"            value={displayUser.projectCount ?? '—'} />
            <Row label="Plan"                      value={isPro ? 'Pro' : 'Free'} />
          </Card>

          {/* Danger zone */}
          <Card style={{ borderColor: 'rgba(239,68,68,0.12)' }}>
            <SectionLabel>Danger Zone</SectionLabel>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => { logout(); setPage('home'); }}
                style={{
                  padding: '9px 18px', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'transparent', color: '#8a8a93',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  fontFamily: "'Satoshi', sans-serif",
                }}
              >
                Log out
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                style={{
                  padding: '9px 18px', borderRadius: 8,
                  border: '1px solid rgba(239,68,68,0.2)',
                  background: 'rgba(239,68,68,0.06)', color: '#f87171',
                  cursor: deleteLoading ? 'default' : 'pointer',
                  fontSize: 13, fontWeight: 600, opacity: deleteLoading ? 0.6 : 1,
                  fontFamily: "'Satoshi', sans-serif",
                }}
              >
                {deleteLoading ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}

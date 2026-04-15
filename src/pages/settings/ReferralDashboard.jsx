import React, { useState, useEffect } from 'react';

const API_URL = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');

export default function ReferralDashboard({ user, supabaseSession }) {
  const [code, setCode]         = useState(null);
  const [stats, setStats]       = useState({ clicks: 0, signups: 0, conversions: 0, freeMonths: 0 });
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [copied, setCopied]     = useState(false);

  const referralLink = code ? `${window.location.origin}/?ref=${code}` : '';
  const token = supabaseSession?.access_token;
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/referrals/my-code`, { headers }).then(r => r.json()).catch(() => ({})),
      fetch(`${API_URL}/api/referrals/dashboard`, { headers }).then(r => r.json()).catch(() => ({})),
    ]).then(([codeData, dashData]) => {
      if (codeData.code) setCode(codeData.code);
      if (dashData.stats) setStats(dashData.stats);
      if (dashData.history) setHistory(dashData.history);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const copy = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const STAT_CARDS = [
    { label: 'Link Clicks',   value: stats.clicks,      icon: '👆', color: '#3b82f6' },
    { label: 'Sign-ups',      value: stats.signups,     icon: '🙋', color: '#22c55e' },
    { label: 'Conversions',   value: stats.conversions, icon: '💰', color: '#f97316' },
    { label: 'Free Months',   value: stats.freeMonths,  icon: '🎁', color: '#8b5cf6' },
  ];

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', fontFamily: 'Inter, -apple-system, sans-serif', color: 'var(--text-1)' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>🤝 Refer a Friend</h2>
        <p style={{ fontSize: 13, color: 'var(--text-4)', lineHeight: 1.6 }}>
          Share your link. When someone signs up and goes Pro, you both get a free month.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-4)' }}>Loading...</div>
      ) : (
        <>
          {/* Referral link */}
          <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Your Referral Link</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                readOnly
                value={referralLink || 'Loading...'}
                style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-2)', border: '1px solid var(--border-1)', borderRadius: 8, color: 'var(--text-2)', fontSize: 12, fontFamily: 'monospace' }}
              />
              <button
                onClick={copy}
                style={{ padding: '8px 16px', background: copied ? '#22c55e' : '#f97316', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
            {STAT_CARDS.map(card => (
              <div key={card.label} style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{card.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border-1)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-1)', fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>Referral History</div>
              {history.slice(0, 10).map((ref, i) => (
                <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'monospace' }}>{ref.referrer_code}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{new Date(ref.created_at).toLocaleDateString()}</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                    background: ref.status === 'converted' ? 'rgba(34,197,94,0.15)' : ref.status === 'signed_up' ? 'rgba(249,115,22,0.15)' : 'rgba(156,163,175,0.15)',
                    color: ref.status === 'converted' ? '#22c55e' : ref.status === 'signed_up' ? '#f97316' : '#9ca3af',
                    textTransform: 'uppercase',
                  }}>
                    {ref.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

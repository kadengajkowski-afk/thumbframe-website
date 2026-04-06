import { useState } from 'react';
import { handleUpgrade } from './utils/checkout';

const C = {
  bg:       '#0a0a0a',
  bg2:      '#0f0f0f',
  bg3:      '#1c1c1c',
  panel:    '#141414',
  border:   '#202020',
  border2:  '#2d2d2d',
  text:     '#f4f4f5',
  text2:    '#a1a1aa',
  muted:    '#52525b',
  accent:   '#f97316',
  accent2:  '#ea580c',
  accent3:  '#fb923c',
  success:  '#22c55e',
  warning:  '#f59e0b',
  error:    '#ef4444',
};

const API_URL = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');

export default function BillingTab() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleManageSubscription() {
    setError('');
    setIsLoading(true);
    try {
      const token = localStorage.getItem('thumbframe_token');
      if (!token) throw new Error('Not logged in.');

      const response = await fetch(`${API_URL}/api/create-portal-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${response.status})`);
      }

      const { url } = await response.json();
      if (!url) throw new Error('No portal URL returned');
      window.location.href = url;
    } catch (err) {
      setError(err?.message || 'Failed to open billing portal');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ padding: '24px 0' }}>
      {/* Card Container */}
      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: C.panel,
          padding: '32px',
          maxWidth: 600,
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 8 }}>
            💳 Subscription Management
          </h2>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
            Manage your billing details, download invoices, or cancel your subscription directly from the Stripe Customer Portal.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: '#fde8e8',
              border: `1px solid ${C.error}`,
              color: C.error,
              fontSize: 13,
              marginBottom: 20,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleManageSubscription}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '12px 18px',
            borderRadius: 8,
            border: 'none',
            background: isLoading ? C.border2 : C.accent,
            color: '#fff',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: '700',
            transition: 'background-color 0.2s',
            opacity: isLoading ? 0.7 : 1,
            textAlign: 'center',
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.background = C.accent2;
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              e.currentTarget.style.background = C.accent;
            }
          }}
        >
          {isLoading ? '⏳ Opening portal...' : '→ Manage subscription'}
        </button>

        {/* Helper text */}
        <p style={{ fontSize: 12, color: C.muted, marginTop: 16, textAlign: 'center', lineHeight: 1.5 }}>
          You'll be redirected to Stripe's Customer Portal where you can view invoices, update payment methods, and manage your subscription.
        </p>
      </div>
    </div>
  );
}

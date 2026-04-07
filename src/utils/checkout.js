import { trackEvent } from './analytics';

const API_URL = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');

/**
 * handleUpgrade — the ONE function every Pro button calls.
 * Redirects to /signup if not logged in, otherwise opens Stripe checkout.
 */
export async function handleUpgrade() {
  const token = localStorage.getItem('thumbframe_token');

  if (!token) {
    window.location.href = '/signup?redirect=pricing';
    return;
  }

  trackEvent('begin_checkout');

  try {
    const res = await fetch(`${API_URL}/api/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Checkout failed — please try again.');
      return;
    }

    const { url } = await res.json();
    window.location.href = url;
  } catch {
    alert('Unable to start checkout. Check your connection and try again.');
  }
}

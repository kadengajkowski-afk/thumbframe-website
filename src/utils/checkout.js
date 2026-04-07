import { trackEvent } from './analytics';
import supabase from '../supabaseClient';

const API_URL = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');

/**
 * handleUpgrade — the ONE function every Pro button calls.
 * Redirects to /signup if not logged in, otherwise opens Stripe checkout.
 *
 * Uses a fresh Supabase session token (same as Editor.js) so the token
 * is never stale, even if localStorage.thumbframe_token is out of date.
 */
export async function handleUpgrade() {
  // Get a fresh session token from Supabase — this is the same pattern
  // Editor.js uses for all its authenticated API calls.
  let token = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token || null;
  } catch {
    // Fall back to cached token if Supabase is unreachable.
    token = localStorage.getItem('thumbframe_token');
  }

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

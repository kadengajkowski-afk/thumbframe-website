import { trackEvent } from './analytics';
import supabase from '../supabaseClient';

const API_URL = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');

export async function handleUpgrade() {
  console.log('[checkout] handleUpgrade called');

  // Get a fresh session token from Supabase.
  let token = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token || null;
    console.log('[checkout] supabase session token:', token ? 'exists' : 'MISSING');
  } catch {
    token = localStorage.getItem('thumbframe_token');
    console.log('[checkout] supabase failed, localStorage token:', token ? 'exists' : 'MISSING');
  }

  if (!token) {
    console.log('[checkout] no token — redirecting to signup');
    window.location.href = '/signup?redirect=pricing';
    return;
  }

  trackEvent('begin_checkout');

  const endpoint = `${API_URL}/api/create-checkout-session`;
  console.log('[checkout] POST', endpoint);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    console.log('[checkout] response status:', res.status);
    const text = await res.text();
    console.log('[checkout] raw response:', text.slice(0, 300));

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('[checkout] response is not JSON — backend is probably returning HTML (wrong URL or 404 page)');
      alert('Checkout failed — server error. Check console for details.');
      return;
    }

    console.log('[checkout] parsed:', data);

    if (!data.url) {
      console.error('[checkout] no url in response:', data);
      alert(data.error || 'Checkout failed — no redirect URL returned.');
      return;
    }

    console.log('[checkout] redirecting to Stripe:', data.url);
    window.location.href = data.url;
  } catch (err) {
    console.error('[checkout] fetch error:', err);
    alert('Unable to start checkout. Check your connection and try again.');
  }
}
